-- 戦闘の開始記録はcloud_savesに固定し、毎手は小さな選択だけを追記する。
alter table public.cloud_saves add column active_battle uuid;
create schema if not exists battle_ledger;
revoke all on schema battle_ledger from public, anon, authenticated;
create table battle_ledger.heads (
  id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
  revision bigint not null, rules text not null, next_seq integer not null default 0,
  finished boolean not null default false, created_at timestamptz not null default now(),
  finished_at timestamptz, receipt jsonb
);
create unique index battle_ledger_active on battle_ledger.heads(user_id) where not finished;
create table battle_ledger.choices (
  battle_id uuid references battle_ledger.heads(id) on delete cascade,
  seq integer not null, command_id uuid not null, command jsonb not null,
  primary key(battle_id, seq), unique(battle_id, command_id)
);
create table battle_ledger.starts (
  battle_id uuid primary key references battle_ledger.heads(id) on delete cascade,
  change jsonb not null, request jsonb not null
);
alter table battle_ledger.starts enable row level security;
alter table battle_ledger.heads enable row level security;
alter table battle_ledger.choices enable row level security;
revoke all on all tables in schema battle_ledger from public, anon, authenticated;

-- 旧クライアントや通常保存で、選択を記録した戦闘を上書きさせない。
create or replace function public.cloud_commit_slot(p_user uuid, p_session uuid, p_revision bigint,
 p_command uuid, p_request jsonb, p_snapshot jsonb, p_response jsonb, p_slot integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if p_slot is distinct from 1 then raise exception 'cloud_invalid_slot'; end if;
  perform 1 from public.cloud_saves where user_id=p_user and slot=1 for update;
  if exists(select 1 from battle_ledger.heads where user_id=p_user and not finished) then
    raise exception 'cloud_battle_active';
  end if;
  return public.cloud_commit_slot_internal(p_user,p_session,p_revision,p_command,p_request,p_snapshot,p_response,1);
end $$;

create function public.cloud_battle_begin_text(p_payload text)
returns text language plpgsql security definer set search_path = '' as $$
declare p jsonb:=p_payload::jsonb; r jsonb; bid uuid:=(p->>'p_command')::uuid; u uuid:=(p->>'p_user')::uuid;
begin
  perform 1 from public.cloud_saves where user_id=u and slot=1 for update;
  if exists(select 1 from battle_ledger.heads where id=bid and user_id=u) then
    return public.cloud_commit_slot_internal(u,(p->>'p_session')::uuid,(p->>'p_revision')::bigint,bid,p->'p_request',p->'p_snapshot',p->'p_response',1)::text;
  end if;
  r:=public.cloud_commit_slot(u,(p->>'p_session')::uuid,(p->>'p_revision')::bigint,bid,p->'p_request',p->'p_snapshot',
    (p->'p_response') || jsonb_build_object('ledger',jsonb_build_object('id',bid,'seq',0,'rules','battle-1')),1);
  insert into battle_ledger.heads(id,user_id,revision,rules) values(bid,u,(r->>'revision')::bigint,'battle-1');
  update public.cloud_saves set active_battle=bid where user_id=u and slot=1;
  if p->'p_request' ? 'openingCommand' then
    insert into battle_ledger.choices values(bid,0,bid,p->'p_request'->'openingCommand');
    update battle_ledger.heads set next_seq=1 where id=bid;
    r:=jsonb_set(r,'{ledger,seq}','1');
    update public.cloud_saves set last_response=r where user_id=u and slot=1;
  end if;
  return r::text;
end $$;

create function public.cloud_battle_read(p_user uuid)
returns jsonb language sql security definer set search_path = '' as $$
 select jsonb_build_object('id',h.id,'seq',h.next_seq,'rules',h.rules,'revision',h.revision,'startChange',(select s.change from battle_ledger.starts s where s.battle_id=h.id),'choices',
 coalesce((select jsonb_agg(jsonb_build_object('commandId',c.command_id,'command',c.command) order by c.seq)
 from battle_ledger.choices c where c.battle_id=h.id),'[]'::jsonb)) from battle_ledger.heads h where h.user_id=p_user and not h.finished;
$$;

create function public.cloud_battle_append(p_battle uuid,p_session uuid,p_revision bigint,p_seq integer,p_command_id uuid,p_command jsonb,p_rules text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid:=auth.uid(); sid uuid; rev bigint; lease timestamptz; h battle_ledger.heads; c battle_ledger.choices;
begin
  if u is null then raise exception 'cloud_login_required'; end if;
  -- TOASTされたsnapshot/last_requestは一切読み出さない。
  select session_id,revision,lease_until into sid,rev,lease from public.cloud_saves where user_id=u and slot=1 for update;
  if sid is distinct from p_session or lease<=now() or lease is null then raise exception 'cloud_session_lost'; end if;
  select * into h from battle_ledger.heads where id=p_battle and user_id=u for update;
  if not found then raise exception 'cloud_battle_missing'; end if;
  if h.revision<>p_revision or rev<>p_revision then raise exception 'cloud_revision_conflict'; end if;
  if h.rules is distinct from p_rules then raise exception 'cloud_version_mismatch'; end if;
  select * into c from battle_ledger.choices where battle_id=p_battle and command_id=p_command_id;
  if found then
    if c.seq is distinct from p_seq or c.command is distinct from p_command then raise exception 'cloud_command_reused'; end if;
    return jsonb_build_object('revision',rev,'seq',p_seq+1);
  end if;
  if h.finished or p_seq is distinct from h.next_seq then raise exception 'cloud_revision_conflict'; end if;
  if p_seq>=16384 or p_command_id is null or p_command is null or jsonb_typeof(p_command)<>'object' or octet_length(p_command::text)>4096
    or p_command->>'type' is distinct from 'battle' or not coalesce(p_command->>'operation' in ('commit','enemy','stunned'),false) then
    raise exception 'cloud_invalid_choice';
  end if;
  insert into battle_ledger.choices values(p_battle,p_seq,p_command_id,p_command);
  update battle_ledger.heads set next_seq=next_seq+1 where id=p_battle;
  update public.cloud_saves set lease_until=now()+interval '120 seconds' where user_id=u and slot=1;
  return jsonb_build_object('revision',rev,'seq',p_seq+1);
end $$;

create function public.cloud_battle_finish_text(p_payload text)
returns text language plpgsql security definer set search_path = '' as $$
declare p jsonb:=p_payload::jsonb; h battle_ledger.heads; r jsonb; u uuid:=(p->>'p_user')::uuid;
begin
  perform 1 from public.cloud_saves where user_id=u and slot=1 for update;
  select * into h from battle_ledger.heads where id=(p->>'p_battle')::uuid and user_id=u for update;
  if not found then raise exception 'cloud_battle_missing'; end if;
  if h.finished then return h.receipt::text; end if;
  if h.next_seq is distinct from (p->>'p_seq')::integer then raise exception 'cloud_revision_conflict'; end if;
  update battle_ledger.heads set finished=true,finished_at=now() where id=h.id;
  update public.cloud_saves set active_battle=null where user_id=u and slot=1;
  r:=public.cloud_commit_slot_internal(u,(p->>'p_session')::uuid,h.revision,(p->>'p_command')::uuid,
    p->'p_request',p->'p_snapshot',p->'p_response',1);
  update battle_ledger.heads set receipt=r where id=h.id;
  delete from battle_ledger.choices where battle_id=h.id;
  delete from battle_ledger.starts where battle_id=h.id;
  -- 完了通知の再送用に7日間残す。未完了の履歴は期限で消さない。
  delete from battle_ledger.heads where user_id=u and finished and finished_at<now()-interval '7 days';
  return r::text;
end $$;
revoke all on function public.cloud_battle_begin_text(text),public.cloud_battle_read(uuid),public.cloud_battle_finish_text(text) from public,anon,authenticated;
grant execute on function public.cloud_battle_begin_text(text),public.cloud_battle_read(uuid),public.cloud_battle_finish_text(text) to service_role;
revoke all on function public.cloud_battle_append(uuid,uuid,bigint,integer,uuid,jsonb,text) from public,anon;
grant execute on function public.cloud_battle_append(uuid,uuid,bigint,integer,uuid,jsonb,text) to authenticated;
notify pgrst,'reload schema';

-- 冒険全体の明示的な削除は許す。戦闘だけを放棄して元の進行を残す操作は作らない。
create function public.cloud_battle_reset_text(p_payload text)
returns text language plpgsql security definer set search_path = '' as $$
declare p jsonb:=p_payload::jsonb; u uuid:=(p->>'p_user')::uuid;
begin
  if p->'p_request'->>'op' is distinct from 'reset' or p->'p_snapshot' is distinct from 'null'::jsonb then raise exception 'cloud_invalid_choice'; end if;
  perform 1 from public.cloud_saves where user_id=u and slot=1 for update;
  delete from battle_ledger.heads where user_id=u;
  update public.cloud_saves set active_battle=null where user_id=u and slot=1;
  return public.cloud_commit_slot_internal(u,(p->>'p_session')::uuid,(p->>'p_revision')::bigint,(p->>'p_command')::uuid,
    p->'p_request',null,p->'p_response',1)::text;
end $$;
revoke all on function public.cloud_battle_reset_text(text) from public,anon,authenticated;
grant execute on function public.cloud_battle_reset_text(text) to service_role;
notify pgrst,'reload schema';

-- 待機中の占有延長も、セーブ本体の読出しを伴わない。
create function public.cloud_battle_renew_text(p_payload text)
returns text language plpgsql security definer set search_path = '' as $$
declare p jsonb:=p_payload::jsonb; sid uuid; rev bigint; lease timestamptz; terms text;
begin
  select session_id,revision,lease_until,terms_version into sid,rev,lease,terms
    from public.cloud_saves where user_id=(p->>'p_user')::uuid and slot=1 for update;
  if not found or sid is distinct from (p->>'p_session')::uuid then raise exception 'cloud_session_lost'; end if;
  if terms is distinct from p->>'p_terms' then raise exception 'cloud_version_mismatch'; end if;
  if rev is distinct from (p->>'p_revision')::bigint then raise exception 'cloud_revision_conflict'; end if;
  update public.cloud_saves set lease_until=now()+interval '120 seconds' where user_id=(p->>'p_user')::uuid and slot=1;
  return jsonb_build_object('revision',rev)::text;
end $$;
revoke all on function public.cloud_battle_renew_text(text) from public,anon,authenticated;
grant execute on function public.cloud_battle_renew_text(text) to service_role;
notify pgrst,'reload schema';

-- 開始差分も直接保管する。元の大きなセーブの読出し・書直し・Edge往復を省く。
create function public.cloud_battle_begin(p_session uuid,p_revision bigint,p_command_id uuid,p_change jsonb,p_opening jsonb,p_rules text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid:=auth.uid(); sid uuid; rev bigint; lease timestamptz; terms text; h battle_ledger.heads;
 req jsonb:=jsonb_build_object('session',p_session,'revision',p_revision,'commandId',p_command_id,'change',p_change,'opening',p_opening,'rules',p_rules); r jsonb; seq integer:=0;
begin
 if u is null then raise exception 'cloud_login_required'; end if;
 select session_id,revision,lease_until,terms_version into sid,rev,lease,terms from public.cloud_saves where user_id=u and slot=1 for update;
 if not found or sid is distinct from p_session or lease<=now() then raise exception 'cloud_session_lost'; end if;
 if p_rules is distinct from 'battle-1' or terms is distinct from '2026-10-30' then raise exception 'cloud_version_mismatch'; end if;
 select * into h from battle_ledger.heads where id=p_command_id and user_id=u;
 if found then
  if h.finished or h.revision<>rev then raise exception 'cloud_revision_conflict'; end if;
  if not exists(select 1 from battle_ledger.starts where battle_id=h.id and request=req) then raise exception 'cloud_command_reused'; end if;
  return jsonb_build_object('revision',rev,'ledger',jsonb_build_object('id',h.id,'seq',h.next_seq,'rules',h.rules));
 end if;
 if rev is distinct from p_revision or exists(select 1 from battle_ledger.heads where user_id=u and not finished) then raise exception 'cloud_revision_conflict'; end if;
 if p_command_id is null or p_change is null or jsonb_typeof(p_change)<>'object' or octet_length(p_change::text)>16777216
  or not (p_change ? 'snapshot' or p_change ? 'change') then raise exception 'cloud_invalid_choice'; end if;
 if p_opening is not null and p_opening<>'null'::jsonb then
  if jsonb_typeof(p_opening)<>'object' or octet_length(p_opening::text)>4096 or p_opening->>'type' is distinct from 'battle'
   or not coalesce(p_opening->>'operation' in ('enemy','stunned'),false) or not coalesce((p_opening->>'forcedCount')::integer between 0 and 16,false) then raise exception 'cloud_invalid_choice'; end if;
  seq:=1;
 end if;
 insert into battle_ledger.heads(id,user_id,revision,rules,next_seq) values(p_command_id,u,rev+1,p_rules,seq);
 insert into battle_ledger.starts values(p_command_id,p_change,req);
 if seq=1 then insert into battle_ledger.choices values(p_command_id,0,p_command_id,p_opening); end if;
 r:=jsonb_build_object('revision',rev+1,'ledger',jsonb_build_object('id',p_command_id,'seq',seq,'rules',p_rules));
 update public.cloud_saves set active_battle=p_command_id,revision=rev+1,last_command=p_command_id,last_request=jsonb_build_object('op','ledger-begin'),last_response=r,
  lease_until=now()+interval '120 seconds',updated_at=now() where user_id=u and slot=1;
 return r;
end $$;
revoke all on function public.cloud_battle_begin(uuid,bigint,uuid,jsonb,jsonb,text) from public,anon;
grant execute on function public.cloud_battle_begin(uuid,bigint,uuid,jsonb,jsonb,text) to authenticated;
notify pgrst,'reload schema';
