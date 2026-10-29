-- 本番は記録1のみ。旧テスト記録は削除せず、APIから到達できなくする。
alter table public.cloud_saves add column if not exists terms_version text;
alter table public.cloud_saves add column if not exists terms_accepted_at timestamptz;

alter function public.cloud_claim_slot(uuid, uuid, integer) rename to cloud_claim_slot_internal;
alter function public.cloud_commit_slot(uuid, uuid, bigint, uuid, jsonb, jsonb, jsonb, integer) rename to cloud_commit_slot_internal;
revoke all on function public.cloud_claim_slot_internal(uuid, uuid, integer) from public, anon, authenticated, service_role;
revoke all on function public.cloud_commit_slot_internal(uuid, uuid, bigint, uuid, jsonb, jsonb, jsonb, integer) from public, anon, authenticated, service_role;

create function public.cloud_claim_slot(p_user uuid, p_session uuid, p_slot integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if p_slot is distinct from 1 then raise exception 'cloud_invalid_slot'; end if;
  return public.cloud_claim_slot_internal(p_user, p_session, 1);
end $$;
create function public.cloud_commit_slot(p_user uuid, p_session uuid, p_revision bigint,
  p_command uuid, p_request jsonb, p_snapshot jsonb, p_response jsonb, p_slot integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if p_slot is distinct from 1 then raise exception 'cloud_invalid_slot'; end if;
  return public.cloud_commit_slot_internal(p_user, p_session, p_revision, p_command, p_request, p_snapshot, p_response, 1);
end $$;
create function public.cloud_accept_terms(p_user uuid, p_version text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  insert into public.cloud_saves(user_id, slot, terms_version, terms_accepted_at)
    values(p_user, 1, p_version, now())
    on conflict (user_id, slot) do update set terms_version = excluded.terms_version,
      terms_accepted_at = case when public.cloud_saves.terms_version is distinct from excluded.terms_version
        then now() else public.cloud_saves.terms_accepted_at end;
  return jsonb_build_object('version', p_version);
end $$;
revoke all on function public.cloud_claim_slot(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.cloud_commit_slot(uuid, uuid, bigint, uuid, jsonb, jsonb, jsonb, integer) from public, anon, authenticated;
revoke all on function public.cloud_accept_terms(uuid, text) from public, anon, authenticated;
grant execute on function public.cloud_claim_slot(uuid, uuid, integer) to service_role;
grant execute on function public.cloud_commit_slot(uuid, uuid, bigint, uuid, jsonb, jsonb, jsonb, integer) to service_role;
grant execute on function public.cloud_accept_terms(uuid, text) to service_role;
