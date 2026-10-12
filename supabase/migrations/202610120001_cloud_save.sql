-- 最新の記録を1件だけ保持。ブラウザには書き込み権限を与えない。
create table if not exists public.cloud_saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 0,
  snapshot jsonb,
  session_id uuid,
  lease_until timestamptz,
  last_command uuid,
  last_request jsonb,
  last_response jsonb,
  updated_at timestamptz not null default now()
);
alter table public.cloud_saves enable row level security;
revoke all on public.cloud_saves from anon, authenticated;

create or replace function public.cloud_claim(p_user uuid, p_session uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.cloud_saves;
begin
  insert into public.cloud_saves(user_id) values(p_user) on conflict do nothing;
  select * into s from public.cloud_saves where user_id = p_user for update;
  if s.session_id is distinct from p_session and s.lease_until > now() then
    raise exception 'cloud_session_busy';
  end if;
  update public.cloud_saves set session_id = p_session, lease_until = now() + interval '120 seconds'
    where user_id = p_user returning * into s;
  return to_jsonb(s);
end $$;

create or replace function public.cloud_commit(p_user uuid, p_session uuid, p_revision bigint,
  p_command uuid, p_request jsonb, p_snapshot jsonb, p_response jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.cloud_saves;
begin
  select * into s from public.cloud_saves where user_id = p_user for update;
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
    where user_id = p_user returning * into s;
  return s.last_response;
end $$;

revoke all on function public.cloud_claim(uuid, uuid) from public, anon, authenticated;
revoke all on function public.cloud_commit(uuid, uuid, bigint, uuid, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.cloud_claim(uuid, uuid) to service_role;
grant execute on function public.cloud_commit(uuid, uuid, bigint, uuid, jsonb, jsonb, jsonb) to service_role;
