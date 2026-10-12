// ローカル検証専用。実際のEdge FunctionとSQLを使い、Authだけを模擬する。
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
const { PGlite } = await import(pathToFileURL(process.argv[2]));
const db = new PGlite();
const user = { id: "11111111-1111-4111-8111-111111111111", email: "player@example.invalid" };
await db.exec(`create schema auth; create table auth.users(id uuid primary key);
  create role anon; create role authenticated; create role service_role;
  insert into auth.users values ('${user.id}');`);
await db.exec(await readFile(new URL("../../supabase/migrations/202610120001_cloud_save.sql", import.meta.url), "utf8"));
let handler;
globalThis.Deno = { env: { get: (k) => ({ SUPABASE_URL: "https://db.invalid", SUPABASE_SERVICE_ROLE_KEY: "test-key",
  GAME_ALLOWED_ORIGINS: "http://127.0.0.1:8001" })[k] }, serve: (fn) => { handler = fn; } };
globalThis.fetch = async (url, opts) => {
  if (url.endsWith("/auth/v1/user")) return opts.headers.Authorization === "Bearer test-token" ? Response.json(user) : Response.json({}, { status: 401 });
  const b = JSON.parse(opts.body);
  try {
    let r;
    if (url.endsWith("/cloud_claim")) r = await db.query("select public.cloud_claim($1::uuid,$2::uuid) as value", [b.p_user, b.p_session]);
    else r = await db.query("select public.cloud_commit($1::uuid,$2::uuid,$3::bigint,$4::uuid,$5::jsonb,$6::jsonb,$7::jsonb) as value",
      [b.p_user, b.p_session, b.p_revision, b.p_command, JSON.stringify(b.p_request), JSON.stringify(b.p_snapshot), JSON.stringify(b.p_response)]);
    return Response.json(r.rows[0].value);
  } catch (e) { return Response.json({ message: e.message }, { status: 400 }); }
};
await import("../../supabase/functions/game-save/index.js");
const server = createServer(async (req, res) => {
  let body = ""; for await (const part of req) body += part;
  let response;
  if (req.url === "/test/reset") { await db.exec("delete from public.cloud_saves"); response = Response.json({}); }
  else if (req.url.startsWith("/auth/v1/token")) response = Response.json({ access_token: "test-token", refresh_token: "test-refresh", expires_in: 3600, user });
  else if (req.url === "/auth/v1/signup") response = Response.json({ user });
  else if (req.url === "/auth/v1/recover") response = Response.json({});
  else if (req.url === "/auth/v1/user") response = Response.json(user);
  else response = await handler(new Request("https://db.invalid" + req.url, { method: req.method, headers: req.headers,
    ...(req.method === "GET" || req.method === "HEAD" ? {} : { body }) }));
  res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(await response.text());
});
server.listen(8002, "127.0.0.1", () => console.log("検証用API: http://127.0.0.1:8002"));
process.on("SIGTERM", () => server.close(async () => { await db.close(); process.exit(); }));
