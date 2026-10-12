import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { authSettings, publicKey, configSource, migrationQuery, run, SITE } from "../../supabase/deploy.mjs";

const ref = "abcdefghijklmnopqrst", env = { SUPABASE_PROJECT_REF: ref, SUPABASE_ACCESS_TOKEN: "test-only-token" };
const jwt = (role) => "test." + Buffer.from(JSON.stringify({ role })).toString("base64url") + ".test";
const keys = [{ name: "service_role", api_key: jwt("service_role") }, { name: "anon", api_key: jwt("anon") }];
assert.equal(publicKey(keys), jwt("anon"));
assert.throws(() => publicKey([{ name: "anon", api_key: jwt("service_role") }]));
assert.throws(() => publicKey([{ type: "publishable", api_key: "sb_secret_test" }]));
assert.equal(publicKey([{ type: "publishable", api_key: "sb_publishable_test" }]), "sb_publishable_test");
assert.throws(() => authSettings({ site_url: "https://another-app.invalid" }));
const settings = authSettings({ site_url: "http://localhost:3000", uri_allow_list: "https://existing.invalid" });
assert(settings.uri_allow_list.includes("https://existing.invalid")); assert(settings.uri_allow_list.includes(SITE));
assert.equal(settings.mailer_autoconfirm, false);
assert.throws(() => configSource("bad-project", "public"));
await assert.rejects(run("--prepare", { env: {} }), /Project ID/);
await assert.rejects(run("--prepare", { env: { SUPABASE_PROJECT_REF: ref } }), /アクセストークン/);

function fixture({ smtp = true, cors = true, authenticated = false, permission = true } = {}) {
  const calls = [], writes = [];
  const auth = { ...settings, smtp_host: smtp ? "smtp.example.invalid" : "", smtp_admin_email: smtp ? "sender@example.invalid" : "" };
  const fetcher = async (url, opts) => {
    calls.push({ url, opts });
    if (url.endsWith("/config/auth")) return Response.json(auth);
    if (url.endsWith("/api-keys")) return Response.json(keys);
    if (url.endsWith("/database/query")) return Response.json([{ ready: true, anon_read: !permission, anon_write: false, player_write: false, server_write: true }]);
    if (url.endsWith(ref)) return Response.json({ id: ref, status: "ACTIVE_HEALTHY" });
    if (opts.method === "OPTIONS") return new Response(null, { status: 204, headers: cors ? { "access-control-allow-origin": new URL(SITE).origin } : {} });
    return new Response(null, { status: authenticated ? 200 : 401 });
  };
  return { calls, writes, fetcher, writer: async (path, content) => writes.push({ path, content }) };
}

{
  const f = fixture(); await run("--prepare", { env, fetcher: f.fetcher });
  assert(f.calls.some((c) => c.url.endsWith("/config/auth") && c.opts.method === "PATCH"));
  assert(f.calls.some((c) => c.url.endsWith("/database/query") && JSON.parse(c.opts.body).query.includes("pg_advisory_xact_lock")));
  assert(!f.calls.some((c) => c.url.endsWith("/api-keys")));
}
{
  const f = fixture(); await run("--config", { env, fetcher: f.fetcher, writer: f.writer });
  assert.equal(f.writes.length, 1);
  assert(f.writes[0].content.includes(jwt("anon"))); assert(!f.writes[0].content.includes(jwt("service_role")));
  assert(!f.writes[0].content.includes(env.SUPABASE_ACCESS_TOKEN));
}
for (const [condition, message] of [[{ smtp: false }, /SMTP/], [{ cors: false }, /接続元/], [{ authenticated: true }, /認証/], [{ permission: false }, /権限/]]) {
  const f = fixture(condition); await assert.rejects(run("--config", { env, fetcher: f.fetcher, writer: f.writer }), message);
  assert.equal(f.writes.length, 0);
}
{
  const f = fixture({ smtp: false }); await run("--verify", { env, fetcher: f.fetcher, writer: f.writer });
  assert.equal(f.writes.length, 0);
}

if (process.argv[2]) {
  const { PGlite } = await import(pathToFileURL(process.argv[2])); const db = new PGlite();
  await db.exec("create schema auth; create table auth.users(id uuid primary key); create role anon; create role authenticated; create role service_role;");
  const sql = await readFile(new URL("../../supabase/migrations/202610120001_cloud_save.sql", import.meta.url), "utf8");
  await db.exec(migrationQuery(sql));
  await db.exec("insert into auth.users values ('11111111-1111-4111-8111-111111111111'); insert into public.cloud_saves(user_id,revision,snapshot) values ('11111111-1111-4111-8111-111111111111', 7, '{\"progress\":true}');");
  await db.exec(migrationQuery(sql));
  assert.equal((await db.query("select count(*)::int as count from supabase_migrations.schema_migrations")).rows[0].count, 1);
  assert.equal((await db.query("select revision from public.cloud_saves")).rows[0].revision, 7);
  // SQL Editorで先に設定したプロジェクトでも再実行できる。
  await db.exec("delete from supabase_migrations.schema_migrations;"); await db.exec(migrationQuery(sql));
  assert.equal((await db.query("select revision from public.cloud_saves")).rows[0].revision, 7);
  await db.close();
}
console.log("自動セットアップ: 管理キー非公開・既存設定保護・SMTP/認証/権限確認・再実行と記録保持 OK");
