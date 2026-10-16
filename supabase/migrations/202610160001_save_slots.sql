-- 既存の記録は移動・再シリアライズせず、記録1として保持する。
alter table public.cloud_saves add column if not exists slot integer not null default 1 check (slot between 1 and 3);
alter table public.cloud_saves drop constraint cloud_saves_pkey;
alter table public.cloud_saves add primary key (user_id, slot);

create or replace function public.cloud_claim_slot(p_user uuid, p_session uuid, p_slot integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.cloud_saves;
begin
  if p_slot is null or p_slot < 1 or p_slot > 3 then raise exception 'cloud_invalid_slot'; end if;
  insert into public.cloud_saves(user_id, slot) values(p_user, p_slot) on conflict do nothing;
  select * into s from public.cloud_saves where user_id = p_user and slot = p_slot for update;
  if s.session_id is distinct from p_session and s.lease_until > now() then
    raise exception 'cloud_session_busy';
  end if;
  update public.cloud_saves set session_id = p_session, lease_until = now() + interval '120 seconds'
    where user_id = p_user and slot = p_slot returning * into s;
  return to_jsonb(s);
end $$;

create or replace function public.cloud_commit_slot(p_user uuid, p_session uuid, p_revision bigint,
  p_command uuid, p_request jsonb, p_snapshot jsonb, p_response jsonb, p_slot integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.cloud_saves;
begin
  if p_slot is null or p_slot < 1 or p_slot > 3 then raise exception 'cloud_invalid_slot'; end if;
  select * into s from public.cloud_saves where user_id = p_user and slot = p_slot for update;
  if not found or s.session_id is distinct from p_session or s.lease_until <= now() then
    raise exception 'cloud_session_lost';
  end if;
  if s.last_command = p_command then
    if s.last_request is distinct from p_request then raise exception 'cloud_command_reused'; end if;
    return s.last_response;
  end if;
  if s.revision <> p_revision then raise exception 'cloud_revision_conflict'; end if;
  update public.cloud_saves set snapshot = p_snapshot, revision = revision + 1,
    last_command = p_command, last_request = p_request,
    last_response = p_response || jsonb_build_object('revision', revision + 1),
    lease_until = now() + interval '120 seconds', updated_at = now()
    where user_id = p_user and slot = p_slot returning * into s;
  return s.last_response;
end $$;


-- 旧クライアントからの操作も記録1だけに限定する。
create or replace function public.cloud_claim(p_user uuid, p_session uuid)
returns jsonb language sql security definer set search_path = '' as $$
  select public.cloud_claim_slot(p_user, p_session, 1);
$$;
create or replace function public.cloud_commit(p_user uuid, p_session uuid, p_revision bigint,
  p_command uuid, p_request jsonb, p_snapshot jsonb, p_response jsonb)
returns jsonb language sql security definer set search_path = '' as $$
  select public.cloud_commit_slot(p_user, p_session, p_revision, p_command, p_request, p_snapshot, p_response, 1);
$$;
revoke all on function public.cloud_claim_slot(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.cloud_commit_slot(uuid, uuid, bigint, uuid, jsonb, jsonb, jsonb, integer) from public, anon, authenticated;
grant execute on function public.cloud_claim_slot(uuid, uuid, integer) to service_role;
grant execute on function public.cloud_commit_slot(uuid, uuid, bigint, uuid, jsonb, jsonb, jsonb, integer) to service_role;
