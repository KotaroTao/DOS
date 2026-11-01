-- B方式の通信計測・戦闘試遊だけに使う。cloud_savesや本編の報酬は更新しない。
create schema if not exists choice_trial;
revoke all on schema choice_trial from public, anon, authenticated;
create table if not exists choice_trial.quotas (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  window_start timestamptz not null default now(),
  starts integer not null default 0
);
create table if not exists choice_trial.runs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  mode text not null,
  version text not null,
  step integer not null default 0,
  expires_at timestamptz not null default now() + interval '1 hour'
);
create index if not exists choice_trial_runs_owner on choice_trial.runs(owner_id);
create index if not exists choice_trial_runs_expiry on choice_trial.runs(expires_at,id);
create table if not exists choice_trial.choices (
  run_id uuid not null references choice_trial.runs(id) on delete cascade,
  step integer not null,
  command_id uuid not null,
  choice jsonb not null,
  receipt uuid not null default gen_random_uuid(),
  primary key(run_id,step), unique(run_id,command_id)
);
alter table choice_trial.quotas enable row level security;
alter table choice_trial.runs enable row level security;
alter table choice_trial.choices enable row level security;
create or replace function public.dos_choice_trial_begin(p_mode text,p_version text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); q choice_trial.quotas; r choice_trial.runs;
begin
  if u is null then raise exception 'choice_trial_auth_required' using errcode='42501'; end if;
  if p_mode is null or p_mode not in ('measure','battle-after','battle-overlap') or p_version is null or length(p_version)>100 then raise exception 'choice_trial_invalid'; end if;
  insert into choice_trial.quotas(owner_id) values(u) on conflict do nothing;
  select * into q from choice_trial.quotas where owner_id=u for update;
  if q.window_start <= now()-interval '1 hour' then q.starts:=0; q.window_start:=now(); end if;
  if q.starts>=12 then raise exception 'choice_trial_rate_limit' using errcode='P0001'; end if;
  delete from choice_trial.runs where id in
    (select id from choice_trial.runs where expires_at<=now() order by expires_at,id limit 100 for update skip locked);
  if (select count(*) from choice_trial.runs where owner_id=u)>=3 then raise exception 'choice_trial_too_many_runs'; end if;
  update choice_trial.quotas set starts=q.starts+1,window_start=q.window_start where owner_id=u;
  insert into choice_trial.runs(owner_id,mode,version) values(u,p_mode,p_version) returning * into r;
  return jsonb_build_object('run',r.id,'step',r.step);
end $$;
create or replace function public.dos_choice_trial_append(p_run uuid,p_step integer,p_command uuid,p_choice jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid:=auth.uid(); r choice_trial.runs; c choice_trial.choices;
begin
  if u is null then raise exception 'choice_trial_auth_required' using errcode='42501'; end if;
  if p_step is null or p_step<1 or p_step>256 or p_command is null or p_choice is null or jsonb_typeof(p_choice)<>'object' or pg_column_size(p_choice)>2048 then raise exception 'choice_trial_invalid'; end if;
  select * into r from choice_trial.runs where id=p_run and owner_id=u for update;
  if not found or r.expires_at<=now() then raise exception 'choice_trial_unavailable'; end if;
  if p_step<=r.step then
    select * into c from choice_trial.choices where run_id=p_run and step=p_step;
    if not found or c.command_id<>p_command or c.choice is distinct from p_choice then raise exception 'choice_trial_choice_changed'; end if;
    return jsonb_build_object('step',c.step,'receipt',c.receipt);
  end if;
  if p_step<>r.step+1 then raise exception 'choice_trial_step_conflict'; end if;
  insert into choice_trial.choices(run_id,step,command_id,choice) values(p_run,p_step,p_command,p_choice) returning * into c;
  update choice_trial.runs set step=p_step where id=p_run;
  return jsonb_build_object('step',c.step,'receipt',c.receipt);
end $$;
create or replace function public.dos_choice_trial_close(p_run uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid:=auth.uid();
begin
  if u is null then raise exception 'choice_trial_auth_required' using errcode='42501'; end if;
  delete from choice_trial.runs where id=p_run and owner_id=u;
  return jsonb_build_object('closed',true);
end $$;
revoke all on function public.dos_choice_trial_begin(text,text) from public,anon,authenticated;
revoke all on function public.dos_choice_trial_append(uuid,integer,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.dos_choice_trial_close(uuid) from public,anon,authenticated;
grant execute on function public.dos_choice_trial_begin(text,text) to authenticated;
grant execute on function public.dos_choice_trial_append(uuid,integer,uuid,jsonb) to authenticated;
grant execute on function public.dos_choice_trial_close(uuid) to authenticated;
notify pgrst,'reload schema';
