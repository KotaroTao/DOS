import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { authSettings, publicKey, configSource, migrationQuery, run, SITE, emailTemplates } from "../../supabase/deploy.mjs";

const ref = "abcdefghijklmnopqrst", env = { SUPABASE_PROJECT_REF: ref, SUPABASE_ACCESS_TOKEN: "test-only-token" };
const jwt = (role) => "test." + Buffer.from(JSON.stringify({ role })).toString("base64url") + ".test";
const keys = [{ name: "service_role", api_key: jwt("service_role") }, { name: "anon", api_key: jwt("anon") }];
assert.equal(publicKey(keys), jwt("anon"));
assert.throws(() => publicKey([{ name: "anon", api_key: jwt("service_role") }]));
assert.throws(() => publicKey([{ type: "publishable", api_key: "sb_secret_test" }]));
assert.equal(publicKey([{ type: "publishable", api_key: "sb_publishable_test" }]), "sb_publishable_test");
assert.throws(() => authSettings({ site_url: "https://another-app.invalid" }));
assert.equal(authSettings({ site_url: new URL(SITE).origin }).site_url, SITE);
assert.throws(() => authSettings({ site_url: new URL("/another-app/", SITE).href }));
const settings = authSettings({ site_url: "http://localhost:3000", uri_allow_list: "https://existing.invalid" });
assert(settings.uri_allow_list.includes("https://existing.invalid")); assert(settings.uri_allow_list.includes(SITE));
for (const type of ["confirmation", "email_change", "recovery", "magic_link", "invite"]) {
  const templates = emailTemplates();
  assert.match(templates["mailer_subjects_" + type], /[ぁ-んァ-ヶ一-龠]/);
  assert.match(templates["mailer_subjects_" + type], /[A-Za-z]/);
  const body = templates["mailer_templates_" + type + "_content"];
  assert(body.includes('lang="ja"')); assert(body.includes('lang="en"'));
  assert(body.includes('href="{{ .ConfirmationURL }}"'));
  assert.equal(settings["mailer_templates_" + type + "_content"], body);
}
assert.equal(settings.mailer_autoconfirm, false);
assert.equal(settings.external_anonymous_users_enabled, true);
assert.equal(settings.rate_limit_anonymous_users, 10);
assert.throws(() => configSource("bad-project", "public"));
await assert.rejects(run("--prepare", { env: {} }), /Project ID/);
await assert.rejects(run("--prepare", { env: { SUPABASE_PROJECT_REF: ref } }), /アクセストークン/);

function fixture({ smtp = true, cors = true, authenticated = false, permission = true, captcha = false, anonymous = true } = {}) {
  const calls = [], writes = [];
  const auth = { ...settings, external_anonymous_users_enabled: anonymous, security_captcha_enabled: captcha, security_captcha_provider: "turnstile", smtp_host: smtp ? "smtp.example.invalid" : "", smtp_admin_email: smtp ? "sender@example.invalid" : "" };
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
for (const [condition, message] of [[{ smtp: false }, /SMTP/], [{ cors: false }, /接続元/], [{ authenticated: true }, /認証/], [{ permission: false }, /権限/], [{ captcha: true }, /サイトキー/], [{ anonymous: false }, /ゲスト認証/]]) {
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
  const slotsSQL = await readFile(new URL("../../supabase/migrations/202610160001_save_slots.sql", import.meta.url), "utf8");
  await db.exec(migrationQuery(slotsSQL, "202610160001"));
  await db.exec(migrationQuery(slotsSQL, "202610160001"));
  const old = (await db.query("select slot, revision, snapshot from public.cloud_saves")).rows[0];
  assert.equal(old.slot, 1); assert.equal(old.revision, 7); assert.deepEqual(old.snapshot, { progress: true });
  const guestSQL = await readFile(new URL("../../supabase/migrations/202610300001_guest_onboarding.sql", import.meta.url), "utf8");
  // 旧テスト枠を残したまま、本番の一枠へ移行する。
  await db.exec("insert into public.cloud_saves(user_id,slot,revision,snapshot) values ('11111111-1111-4111-8111-111111111111', 2, 9, '{\"test\":true}');");
  await db.exec(migrationQuery(guestSQL, "202610300001"));
  await db.exec(migrationQuery(guestSQL, "202610300001"));
  const preserved = (await db.query("select slot,revision from public.cloud_saves order by slot")).rows;
  assert.deepEqual(preserved, [{ slot: 1, revision: 7 }, { slot: 2, revision: 9 }]);
  const transportSQL = await readFile(new URL("../../supabase/migrations/202610300002_large_save_transport.sql", import.meta.url), "utf8");
  await db.exec(migrationQuery(transportSQL, "202610300002"));
  await db.exec(migrationQuery(transportSQL, "202610300002"));
  assert.deepEqual((await db.query("select slot,revision from public.cloud_saves order by slot")).rows, preserved);
  const deadlineSQL = await readFile(new URL("../../supabase/migrations/202610300003_save_rpc_deadline.sql", import.meta.url), "utf8");
  await db.exec(migrationQuery(deadlineSQL,"202610300003"));
  await db.exec(migrationQuery(deadlineSQL,"202610300003"));
  const settings=(await db.query("select proconfig from pg_proc where pronamespace='public'::regnamespace and proname in ('cloud_claim_text','cloud_commit_text')")).rows;
  assert.equal(settings.length,2);
  for(const row of settings)assert(row.proconfig.includes('statement_timeout=45s'));
  assert.deepEqual((await db.query("select slot,revision from public.cloud_saves order by slot")).rows,preserved);
  const methods=(await db.query("select proname from pg_proc where pronamespace='public'::regnamespace and proname in ('cloud_claim_text','cloud_commit_text')")).rows;
  assert.equal(methods.length,2);
  for(const role of ['anon','authenticated']){
    await db.exec('set role '+role);
    await assert.rejects(db.query("select public.cloud_commit_text('{}')"),/permission denied/);
    await db.exec('reset role');
  }
  await db.exec("set role service_role");
  await assert.rejects(db.query("select public.cloud_claim_slot_internal('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',2)"), /permission denied/);
  await assert.rejects(db.query("select public.cloud_claim_slot('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',2)"), /cloud_invalid_slot/);
  await db.query("select public.cloud_claim_slot('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',1)");
  await db.exec("reset role");
  await db.close();
}
console.log("自動セットアップ: 管理キー非公開・既存設定保護・SMTP/認証/権限確認・再実行と記録保持 OK");
