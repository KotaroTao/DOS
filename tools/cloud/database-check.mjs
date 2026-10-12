// 開発用Postgres互換実行環境を引数で指定する。ゲームの依存には追加しない。
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { refSerialize, refDeserialize } from "../../src/savegraph.js";
import { Battle } from "../../src/combat.js";
import { makeDoll } from "../../src/souls.js";
import { reseedRng, rngState } from "../../src/rng.js";

const { PGlite } = await import(pathToFileURL(process.argv[2]));
const db = new PGlite();
await db.exec(`create schema auth; create table auth.users(id uuid primary key);
  create role anon; create role authenticated; create role service_role;
  insert into auth.users values ('11111111-1111-4111-8111-111111111111'), ('22222222-2222-4222-8222-222222222222');`);
await db.exec(await readFile(new URL("../../supabase/migrations/202610120001_cloud_save.sql", import.meta.url), "utf8"));
const user = "11111111-1111-4111-8111-111111111111", otherUser = "22222222-2222-4222-8222-222222222222";
const session = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", otherSession = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const command = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const claim = async (u, s) => (await db.query("select public.cloud_claim($1::uuid,$2::uuid) as value", [u, s])).rows[0].value;
const commit = async (u, s, revision, id, request, snapshot = {}, response = {}) => (await db.query(
  "select public.cloud_commit($1::uuid,$2::uuid,$3::bigint,$4::uuid,$5::jsonb,$6::jsonb,$7::jsonb) as value",
  [u, s, revision, id, JSON.stringify(request), JSON.stringify(snapshot), JSON.stringify(response)])).rows[0].value;

assert.equal((await claim(user, session)).revision, 0);
assert.equal((await commit(user, session, 0, command, { action: 1 })).revision, 1);
assert.equal((await commit(user, session, 0, command, { action: 1 })).revision, 1);
await assert.rejects(commit(user, session, 0, command, { action: 2 }), /cloud_command_reused/);
await assert.rejects(claim(user, otherSession), /cloud_session_busy/);
await assert.rejects(commit(user, session, 0, otherSession, {}), /cloud_revision_conflict/);
assert.equal((await claim(otherUser, otherSession)).revision, 0);
await db.query("update public.cloud_saves set lease_until = now() - interval '1 second' where user_id = $1::uuid", [user]);
await claim(user, otherSession);
await assert.rejects(commit(user, session, 1, otherSession, {}), /cloud_session_lost/);

for (const role of ["anon", "authenticated"]) {
  await db.exec("set role " + role);
  await assert.rejects(db.query("select * from public.cloud_saves"), /permission denied/);
  await assert.rejects(claim(user, session), /permission denied/);
  await assert.rejects(commit(user, session, 1, command, {}), /permission denied/);
  await db.exec("reset role");
}

// 実際のEdge Functionを起動し、AuthとRPCだけをこのDBへ接続する。
let handler;
globalThis.Deno = {
  env: { get: (k) => ({ SUPABASE_URL: "https://db.invalid", SUPABASE_SERVICE_ROLE_KEY: "test-service-key", GAME_ALLOWED_ORIGINS: "https://game.invalid" })[k] },
  serve: (fn) => { handler = fn; },
};
globalThis.fetch = async (url, opts) => {
  if (url.endsWith("/auth/v1/user")) return opts.headers.Authorization === "Bearer valid-token" ? Response.json({ id: otherUser }) : Response.json({}, { status: 401 });
  const b = JSON.parse(opts.body);
  try {
    let value;
    if (url.endsWith("/cloud_claim")) value = await claim(b.p_user, b.p_session);
    else if (url.endsWith("/cloud_commit")) value = await commit(b.p_user, b.p_session, b.p_revision, b.p_command, b.p_request, b.p_snapshot, b.p_response);
    else throw new Error("不明なRPC");
    return Response.json(value);
  } catch (e) { return Response.json({ message: e.message }, { status: 400 }); }
};
await import("../../supabase/functions/game-save/index.js");
const request = (body, token = "valid-token", origin = "https://game.invalid") => handler(new Request("https://db.invalid/functions/v1/game-save", {
  method: "POST", headers: { Authorization: "Bearer " + token, Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body),
}));
const base = { protocol: 1, sessionId: otherSession };
assert.equal((await request({ ...base, op: "claim" }, "invalid-token")).status, 401);
assert.equal((await request({ ...base, op: "claim" }, "valid-token", "https://bad.invalid")).status, 403);
assert.equal((await request({ ...base, op: "claim", protocol: 99 })).status, 409);
const save = { ...base, op: "save", revision: 0, commandId: command,
  snapshot: refSerialize({ state: "town", party: [], souls: [] }) };
const saved = await request(save); assert.equal(saved.status, 200); assert.equal((await saved.json()).revision, 1);
const retry = await request(save); assert.equal(retry.status, 200); assert.equal((await retry.json()).revision, 1);
assert.equal((await request({ ...save, commandId: session })).status, 409);
assert.equal((await request({ ...save, snapshot: refSerialize({ state: "over", party: [], souls: [] }) })).status, 409);
const read = await request({ ...base, op: "claim" }); assert.equal(read.status, 200);
assert.deepEqual((await read.json()).snapshot, save.snapshot);
assert.equal((await request({ ...base, op: "renew", revision: 1 })).status, 200);
// 戦闘の保存・実行・再送・次の手番も、実際のAPIとDBで確認する。
reseedRng(7);
const p = Object.assign(makeDoll("検証の人業"), { hp: 100, maxhp: 100, atk: 30, vit: 10, agi: 1000 });
const e = { uid: 9, key: "bs_ghoul", name: "検証の敵", side: "enemy", alive: true, hp: 100, maxhp: 100, atk: 10, vit: 10, agi: 1, int: 10, pie: 10, luk: 8, lv: 1, element: "none" };
const battle = new Battle([p], [e], () => {});
battle.chooseAction("attack"); battle.chooseTarget(e);
const state = { state: "combat", battle, party: [p], reserve: [], souls: [], rng: rngState(),
  codex: { mon: {}, fresh: { mon: {} } }, events: {}, world: {}, order: { picks: [] }, gold: 100, soulPts: 100, floor: 1, dungeonIdx: 0 };
const start = await request({ ...base, op: "save", revision: 1, commandId: crypto.randomUUID(), snapshot: refSerialize(state) });
assert.equal(start.status, 200); assert.equal((await start.json()).revision, 2);
const action = { ...base, op: "battle", action: "commit", revision: 2, commandId: crypto.randomUUID() };
const result = await request(action); assert.equal(result.status, 200);
const payload = await result.json(), packet = refDeserialize(payload.packet);
assert.equal(payload.revision, 3); assert.equal(packet.snapshot.battle._acted, true);
assert.equal(packet.result.actor, packet.snapshot.party[0]);
const again = await request(action); assert.equal(again.status, 200); assert.deepEqual(await again.json(), payload);
const current = refDeserialize((await (await request({ ...base, op: "claim" })).json()).snapshot);
assert.equal(current.battle.enemies[0].hp, packet.snapshot.battle.enemies[0].hp); assert.deepEqual(current.rng, packet.snapshot.rng);
const advanced = await request({ ...base, op: "battle", action: "advance", revision: 3, commandId: crypto.randomUUID() });
assert.equal(advanced.status, 200); assert.equal((await advanced.json()).revision, 4);
console.log("DB・Edge Function: 最新1件・再送・競合・占有期限・権限・認証・CORS・版番号 OK");
await db.close();
