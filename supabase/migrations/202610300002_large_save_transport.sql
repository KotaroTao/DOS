-- 大きな参照グラフをPostgRESTの引数展開・返却処理に何度も通さない。
-- JSONの構造比較と保存形式は既存関数のまま。HTTP/RPC境界だけ文字列にする。
create or replace function public.cloud_claim_text(p_user uuid, p_session uuid, p_slot integer)
returns text language sql set search_path = '' as $$
  select public.cloud_claim_slot(p_user, p_session, p_slot)::text;
$$;
create or replace function public.cloud_commit_text(p_payload text)
returns text language plpgsql set search_path = '' as $$
declare p jsonb := p_payload::jsonb;
begin
  return public.cloud_commit_slot((p->>'p_user')::uuid, (p->>'p_session')::uuid,
    (p->>'p_revision')::bigint, (p->>'p_command')::uuid, p->'p_request',
    nullif(p->'p_snapshot', 'null'::jsonb), p->'p_response', (p->>'p_slot')::integer)::text;
end $$;
revoke all on function public.cloud_claim_text(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.cloud_commit_text(text) from public, anon, authenticated;
grant execute on function public.cloud_claim_text(uuid, uuid, integer) to service_role;
grant execute on function public.cloud_commit_text(text) to service_role;
notify pgrst, 'reload schema';
