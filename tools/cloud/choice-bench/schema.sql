-- 計測専用。実行ごとの別schemaとRPC名を使用し、本番の記録には触れない。
create schema __SCHEMA__;
revoke all on schema __SCHEMA__ from public, anon, authenticated;
create table __SCHEMA__.runs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  step integer not null default 0,
  expires_at timestamptz not null default now() + interval '1 hour'
);
create table __SCHEMA__.choices (
  run_id uuid not null references __SCHEMA__.runs(id) on delete cascade,
  step integer not null,
  command_id uuid not null,
  choice jsonb not null,
  receipt uuid not null default gen_random_uuid(),
  primary key(run_id, step), unique(run_id, command_id)
);
alter table __SCHEMA__.runs enable row level security;
alter table __SCHEMA__.choices enable row level security;
create function __SCHEMA__.append_choice(p_owner uuid, p_run uuid, p_step integer, p_command uuid, p_choice jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare r __SCHEMA__.runs; c __SCHEMA__.choices;
begin
  if p_owner is null then raise exception 'bench_auth_required' using errcode = '42501'; end if;
  if p_step is null or p_step < 1 or p_step > 256 or p_command is null
    or p_choice is null or jsonb_typeof(p_choice) <> 'object' or pg_column_size(p_choice) > 2048 then
    raise exception 'bench_invalid_request';
  end if;
  select * into r from __SCHEMA__.runs where id = p_run and owner_id = p_owner for update;
  if not found or r.expires_at <= now() then raise exception 'bench_run_unavailable'; end if;
  if p_step <= r.step then
    select * into c from __SCHEMA__.choices where run_id = p_run and step = p_step;
    if not found or c.command_id <> p_command or c.choice is distinct from p_choice then raise exception 'bench_choice_changed'; end if;
    return jsonb_build_object('step', c.step, 'receipt', c.receipt);
  end if;
  if p_step <> r.step + 1 then raise exception 'bench_step_conflict'; end if;
  insert into __SCHEMA__.choices(run_id, step, command_id, choice) values(p_run, p_step, p_command, p_choice) returning * into c;
  update __SCHEMA__.runs set step = p_step where id = p_run;
  return jsonb_build_object('step', c.step, 'receipt', c.receipt);
end $$;
revoke all on function __SCHEMA__.append_choice(uuid,uuid,integer,uuid,jsonb) from public, anon, authenticated;
create function public.__PREFIX___begin(p_owner uuid)
returns uuid language sql security definer set search_path = '' as $$
  insert into __SCHEMA__.runs(owner_id) values(p_owner) returning id;
$$;
create function public.__PREFIX___append_service(p_owner uuid, p_run uuid, p_step integer, p_command uuid, p_choice jsonb)
returns jsonb language sql security definer set search_path = '' as $$
  select __SCHEMA__.append_choice(p_owner, p_run, p_step, p_command, p_choice);
$$;
create function public.__PREFIX___append(p_run uuid, p_step integer, p_command uuid, p_choice jsonb)
returns jsonb language sql security definer set search_path = '' as $$
  select __SCHEMA__.append_choice(auth.uid(), p_run, p_step, p_command, p_choice);
$$;
revoke all on function public.__PREFIX___begin(uuid) from public, anon, authenticated;
revoke all on function public.__PREFIX___append_service(uuid,uuid,integer,uuid,jsonb) from public, anon, authenticated;
revoke all on function public.__PREFIX___append(uuid,integer,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.__PREFIX___begin(uuid) to service_role;
grant execute on function public.__PREFIX___append_service(uuid,uuid,integer,uuid,jsonb) to service_role;
grant execute on function public.__PREFIX___append(uuid,integer,uuid,jsonb) to authenticated;
notify pgrst, 'reload schema';
