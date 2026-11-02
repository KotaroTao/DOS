// ローカル検証専用。実際のEdge FunctionとSQLを使い、Authだけを模擬する。
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
const { PGlite } = await import(pathToFileURL(process.argv[2]));
const db = new PGlite();
const user = { id: "11111111-1111-4111-8111-111111111111", email: "", is_anonymous: true };
await db.exec(`create schema auth; create table auth.users(id uuid primary key);
  create role anon; create role authenticated; create role service_role;
  create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  insert into auth.users values ('${user.id}');`);
await db.exec(await readFile(new URL("../../supabase/migrations/202610120001_cloud_save.sql", import.meta.url), "utf8"));
await db.exec(await readFile(new URL("../../supabase/migrations/202610160001_save_slots.sql", import.meta.url), "utf8"));
await db.exec(await readFile(new URL("../../supabase/migrations/202610300001_guest_onboarding.sql", import.meta.url), "utf8"));
await db.exec(await readFile(new URL("../../supabase/migrations/202610300002_large_save_transport.sql", import.meta.url), "utf8"));
await db.exec(await readFile(new URL("../../supabase/migrations/202611020001_battle_ledger.sql", import.meta.url), "utf8"));
let handler;
globalThis.Deno = { env: { get: (k) => ({ SUPABASE_URL: "https://db.invalid", SUPABASE_SERVICE_ROLE_KEY: "test-key",
  GAME_ALLOWED_ORIGINS: "http://127.0.0.1:8001" })[k] }, serve: (fn) => { handler = fn; } };
globalThis.fetch = async (url, opts) => {
  if (url.endsWith("/auth/v1/user")) return opts.headers.Authorization === "Bearer test-token" ? Response.json(user) : Response.json({}, { status: 401 });
  if (url.includes("/auth/v1/admin/users/")) { await db.exec("delete from auth.users"); return Response.json({}); }
  const b = JSON.parse(opts.body);
  try {
    let r;
    if (url.endsWith("/cloud_battle_read")) r = await db.query("select public.cloud_battle_read($1::uuid) as value",[b.p_user]);
    else if (url.endsWith("/cloud_battle_begin_text")) r = await db.query("select public.cloud_battle_begin_text($1::text) as value",[b.p_payload]);
    else if (url.endsWith("/cloud_battle_renew_text")) r = await db.query("select public.cloud_battle_renew_text($1::text) as value",[b.p_payload]);
    else if (url.endsWith("/cloud_battle_reset_text")) r = await db.query("select public.cloud_battle_reset_text($1::text) as value",[b.p_payload]);
    else if (url.endsWith("/cloud_battle_finish_text")) r = await db.query("select public.cloud_battle_finish_text($1::text) as value",[b.p_payload]);
    else if (url.endsWith("/cloud_battle_append")) {
      await db.query("select set_config('request.jwt.claim.sub',$1,false)",[opts.headers.Authorization === "Bearer test-token" ? user.id : ""]);
      r = await db.query("select public.cloud_battle_append($1,$2,$3,$4,$5,$6,$7) as value",[b.p_battle,b.p_session,b.p_revision,b.p_seq,b.p_command_id,JSON.stringify(b.p_command),b.p_rules]);
    }
    else if (url.endsWith("/cloud_claim_text")) r = await db.query("select public.cloud_claim_text($1::uuid,$2::uuid,$3::integer) as value", [b.p_user,b.p_session,b.p_slot]);
    else if (url.endsWith("/cloud_commit_text")) r = await db.query("select public.cloud_commit_text($1::text) as value", [b.p_payload]);
    else if (url.endsWith("/cloud_accept_terms")) r = await db.query("select public.cloud_accept_terms($1::uuid,$2::text) as value", [b.p_user, b.p_version]);
    else if (url.endsWith("/cloud_claim_slot")) r = await db.query("select public.cloud_claim_slot($1::uuid,$2::uuid,$3::integer) as value", [b.p_user, b.p_session, b.p_slot]);
    else r = await db.query("select public.cloud_commit_slot($1::uuid,$2::uuid,$3::bigint,$4::uuid,$5::jsonb,$6::jsonb,$7::jsonb,$8::integer) as value",
      [b.p_user, b.p_session, b.p_revision, b.p_command, JSON.stringify(b.p_request), JSON.stringify(b.p_snapshot), JSON.stringify(b.p_response), b.p_slot]);
    return Response.json(r.rows[0].value);
  } catch (e) { return Response.json({ message: e.message }, { status: 400 }); }
};
await import("../../supabase/functions/game-save/index.js");
const server = createServer(async (req, res) => {
  let body = ""; for await (const part of req) body += part;
  let response;
  const path = new URL(req.url, "http://127.0.0.1:8002").pathname;
  if (req.url === "/test/reset") {
    await db.exec(`delete from battle_ledger.heads; delete from public.cloud_saves; insert into auth.users values ('${user.id}') on conflict do nothing;`);
    user.is_anonymous = true; user.email = ""; response = Response.json({});
  }
  else if (req.url === "/test/confirm") { user.is_anonymous = false; response = Response.json({}); }
  else if (req.url === "/test/state") response = Response.json({ saves: (await db.query("select count(*)::int as n from public.cloud_saves")).rows[0].n, users: (await db.query("select count(*)::int as n from auth.users")).rows[0].n });
  else if (req.url.startsWith("/auth/v1/token")) { if (req.url.includes("grant_type=password")) user.is_anonymous = false; response = Response.json({ access_token: "test-token", refresh_token: "test-refresh", expires_in: 3600, user }); }
  else if (path === "/auth/v1/signup") response = JSON.parse(body).email ? Response.json({ user }) : Response.json({ access_token: "test-token", refresh_token: "test-refresh", expires_in: 3600, user });
  else if (path === "/auth/v1/recover") response = Response.json({});
  else if (path === "/auth/v1/user") {
    if (req.method === "PUT") { const update = JSON.parse(body); user.email = update.email || user.email; }
    response = Response.json(user);
  }
  else if (path === "/rest/v1/rpc/cloud_battle_append") response = await fetch("https://db.invalid"+path,{method:"POST",headers:{Authorization:req.headers.authorization},body});
  else response = await handler(new Request("https://db.invalid" + req.url, { method: req.method, headers: req.headers,
    ...(req.method === "GET" || req.method === "HEAD" ? {} : { body }) }));
  res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(await response.text());
});
server.listen(8002, "127.0.0.1", () => console.log("検証用API: http://127.0.0.1:8002"));
process.on("SIGTERM", () => server.close(async () => { await db.close(); process.exit(); }));
