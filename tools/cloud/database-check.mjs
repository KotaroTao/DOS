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
await db.exec(await readFile(new URL("../../supabase/migrations/202610160001_save_slots.sql", import.meta.url), "utf8"));
await db.exec(await readFile(new URL("../../supabase/migrations/202610300001_guest_onboarding.sql", import.meta.url), "utf8"));
await db.exec(await readFile(new URL("../../supabase/migrations/202610300002_large_save_transport.sql", import.meta.url), "utf8"));
const user = "11111111-1111-4111-8111-111111111111", otherUser = "22222222-2222-4222-8222-222222222222";
const session = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", otherSession = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const command = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const claim = async (u, s, slot = 1) => (await db.query("select public.cloud_claim_slot($1::uuid,$2::uuid,$3::integer) as value", [u, s, slot])).rows[0].value;
const commit = async (u, s, revision, id, request, snapshot = {}, response = {}, slot = 1) => (await db.query(
  "select public.cloud_commit_slot($1::uuid,$2::uuid,$3::bigint,$4::uuid,$5::jsonb,$6::jsonb,$7::jsonb,$8::integer) as value",
  [u, s, revision, id, JSON.stringify(request), JSON.stringify(snapshot), JSON.stringify(response), slot])).rows[0].value;

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

// 記録2・3はサーバーでも閉じる。旧APIは記録1のまま。
for (const slot of [0, 2, 3, 4, null]) await assert.rejects(claim(user, session, slot), /cloud_invalid_slot/);
assert.equal((await db.query("select public.cloud_claim($1::uuid,$2::uuid) as v", [user, otherSession])).rows[0].v.slot, 1);

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
    if (url.endsWith("/cloud_claim_text")) value = (await db.query("select public.cloud_claim_text($1::uuid,$2::uuid,$3::integer) as value", [b.p_user,b.p_session,b.p_slot])).rows[0].value;
    else if (url.endsWith("/cloud_commit_text")) value = (await db.query("select public.cloud_commit_text($1::text) as value", [b.p_payload])).rows[0].value;
    else if (url.endsWith("/cloud_accept_terms")) value = (await db.query("select public.cloud_accept_terms($1::uuid,$2::text) as value", [b.p_user, b.p_version])).rows[0].value;
    else if (url.endsWith("/cloud_claim_slot")) value = await claim(b.p_user, b.p_session, b.p_slot);
    else if (url.endsWith("/cloud_commit_slot")) value = await commit(b.p_user, b.p_session, b.p_revision, b.p_command, b.p_request, b.p_snapshot, b.p_response, b.p_slot);
    else throw new Error("不明なRPC");
    return Response.json(value);
  } catch (e) { return Response.json({ message: e.message }, { status: 400 }); }
};
await import(process.argv[3] ? pathToFileURL(process.argv[3]) : "../../supabase/functions/game-save/index.js");
const request = (body, token = "valid-token", origin = "https://game.invalid") => handler(new Request("https://db.invalid/functions/v1/game-save", {
  method: "POST", headers: { Authorization: "Bearer " + token, Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body),
}));
const base = { protocol: 1, sessionId: otherSession };
assert.equal((await request({ ...base, op: "claim" })).status, 409);
assert.equal((await request({ protocol: 1, op: "consent", version: "old" })).status, 409);
assert.equal((await request({ protocol: 1, op: "consent", version: "2026-10-30" })).status, 200);
const accepted = (await db.query("select terms_accepted_at from public.cloud_saves where user_id = $1::uuid", [otherUser])).rows[0].terms_accepted_at;
await request({ protocol: 1, op: "consent", version: "2026-10-30" });
assert.deepEqual((await db.query("select terms_accepted_at from public.cloud_saves where user_id = $1::uuid", [otherUser])).rows[0].terms_accepted_at, accepted);

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
for (const slot of [0, 2, 3, 4, null, "2", 1.5]) assert.equal((await request({ ...base, slot, op: "claim" })).status, 400);
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
// 一括戦闘の返答喪失でも同じ要求は一度だけ確定する。次手番まで再開できる。
const turn = { ...base, op: "turn", action: "commit", revision: 4, commandId: crypto.randomUUID(), snapshot: refSerialize(state) };
const tr = await request(turn); assert.equal(tr.status, 200);
const tp = await tr.json(); assert.equal(tp.revision, 5);
assert.equal(refDeserialize(tp.packet).snapshot.battle._acted, true);
assert.equal(refDeserialize(tp.nextPacket).snapshot.battle._acted, false);
const repeated = await request(turn); assert.equal(repeated.status, 200); assert.deepEqual(await repeated.json(), tp);
const claimTurn = await (await request({ ...base, op: "claim" })).json();
assert.equal(claimTurn.battleTurn, true);
const afterTurn = refDeserialize(claimTurn.snapshot);
assert.equal(afterTurn.battle._acted, false);
assert.deepEqual(afterTurn.rng, refDeserialize(tp.nextPacket).snapshot.rng);
const badTurn = await request({ ...turn, commandId:crypto.randomUUID(), revision:5, action:"advance" });
assert.equal(badTurn.status,400);
console.log("DB・Edge Function: 一括戦闘の保存・次手番・同じIDの再送・不正操作拒否 OK");
// 通常の日本語を含む2MiB超の記録が保存・戦闘・再送・再起動で失われない。
const largeState = { ...state, journal: { text: "冒険の記録。".repeat(150000) } };
const largeSave = { ...base, op: "save", revision: 5, commandId: crypto.randomUUID(), snapshot: refSerialize(largeState) };
assert(new TextEncoder().encode(JSON.stringify(largeSave)).length > 2 * 1024 * 1024);
const largeSaved = await request(largeSave); assert.equal(largeSaved.status, 200);
assert.equal((await largeSaved.json()).revision, 6);
const largeTurn = { ...largeSave, op: "turn", action: "commit", revision: 6, commandId: crypto.randomUUID() };
const largeResult = await request(largeTurn); assert.equal(largeResult.status, 200);
const largePayload = await largeResult.json(); assert.equal(largePayload.revision, 7);
const retryLarge = await request(largeTurn); assert.equal(retryLarge.status, 200);
assert.deepEqual(await retryLarge.json(), largePayload);
const largeClaim = await (await request({ ...base, op: "claim" })).json();
assert.equal(largeClaim.revision, 7);
const loaded = refDeserialize(largeClaim.snapshot);
assert.equal(loaded.journal.text, largeState.journal.text);
assert.deepEqual(loaded.rng, refDeserialize(largePayload.nextPacket).snapshot.rng);
// 上限は文字数でなくUTF-8バイト数。超過時はDBを更新しない。
const tooLarge = { ...largeSave, revision: 7, commandId: crypto.randomUUID(), snapshot: refSerialize({ ...largeState, journal: "魂".repeat(6 * 1024 * 1024) }) };
const rejected = await request(tooLarge); assert.equal(rejected.status, 413);
assert((await rejected.json()).requestId);
assert.equal((await (await request({ ...base, op: "claim" })).json()).revision, 7);
// UTF-8の文字の途中で分割されるストリームでも記録を壊さない。
const streamBytes = new TextEncoder().encode(JSON.stringify({ ...largeSave, revision: 7, commandId: crypto.randomUUID() }));
let offset = 0;
const streamed = await handler(new Request("https://db.invalid/functions/v1/game-save", {
  method: "POST", headers: { Authorization: "Bearer valid-token", Origin: "https://game.invalid" }, duplex: "half",
  body: new ReadableStream({ pull(controller) {
    if (offset >= streamBytes.length) { controller.close(); return; }
    controller.enqueue(streamBytes.slice(offset, offset + 65536)); offset += 65536;
  } }),
}));
assert.equal(streamed.status, 200);
const streamClaim = await (await request({ ...base, op: "claim" })).json();
assert.equal(streamClaim.revision, 8);
assert.equal(refDeserialize(streamClaim.snapshot).journal.text, largeState.journal.text);
console.log("大きな記録: 2MiB超の保存・戦闘・同一ID再送・再開、16MiB超の拒否と記録保持 OK");
// 圧縮形式も再送は一度だけ。旧クライアントのclaimは従来形式に戻して渡す。
const compactTurn={...base,op:'turn',action:'commit',revision:8,commandId:crypto.randomUUID(),snapshot:refSerialize(state,{compact:true})};
const compactResult=await (await request(compactTurn)).json();
assert.equal(compactResult.revision,9);assert.equal(compactResult.packet.format,2);
assert.deepEqual(await (await request(compactTurn)).json(),compactResult);
const compactClaim=await (await request({...base,op:'claim',compactGraph:true})).json();
const legacyClaim=await (await request({...base,op:'claim'})).json();
assert.equal(compactClaim.snapshot.format,2);assert.equal(legacyClaim.snapshot.format,undefined);
assert.deepEqual(refDeserialize(compactClaim.snapshot),refDeserialize(legacyClaim.snapshot));
assert.equal(compactClaim.compactGraph,true);
console.log('圧縮保存API: 確定・再送・次手番・旧クライアントへの読み戻し OK');

// 小さな戦闘命令を実DBで確定し、結果の応答を失っても選び直さない。
const {createCloudChange,applyCloudChange}=await import('../../src/cloud-change.js');
const {decodeCommandResponse}=await import('../../src/cloud-command-codec.js');
const {battleCommand}=await import('../../src/cloud-battle.js');
const source=refDeserialize(refSerialize(state,{compact:true}));
source.battle.pending=null;source.battle.phase='input';source.battle._acted=false;source.battle.result=null;
const commandGraph=refSerialize(source,{compact:true});
await request({...base,op:'save',revision:9,commandId:crypto.randomUUID(),snapshot:commandGraph});
const choose=refDeserialize(commandGraph);Object.setPrototypeOf(choose.battle,Battle.prototype);
choose.battle.chooseAction('attack');choose.battle.chooseTarget(choose.battle.enemies[0]);
const cmd={...base,op:'command',revision:10,commandId:crypto.randomUUID(),command:battleCommand(choose.battle,'commit')};
const cr=await request(cmd);assert.equal(cr.status,200);
const wire=await cr.json();const decodedCommand=decodeCommandResponse(commandGraph,wire);
assert(decodedCommand.packet);assert.equal(wire.revision,11);
assert.deepEqual(await (await request(cmd)).json(),wire);
assert.equal((await request({...cmd,command:{...cmd.command,action:'defend'}})).status,409);
const commandClaim=await (await request({...base,op:'claim',compactGraph:true})).json();
assert.equal(commandClaim.backgroundBattle,true);assert.equal(commandClaim.actionCommands,true);assert.equal(commandClaim.revision,11);
assert.deepEqual(applyCloudChange(commandGraph,wire.sync),commandClaim.snapshot);
const latest=structuredClone(commandClaim.snapshot);latest.templates[0].o.audit='差分';
const patch=createCloudChange(commandClaim.snapshot,latest);
const patchRequest={...base,op:'save',revision:11,commandId:crypto.randomUUID(),...patch};
assert.equal((await request(patchRequest)).status,200);assert.equal((await request(patchRequest)).status,200);
assert.deepEqual((await (await request({...base,op:'claim',compactGraph:true})).json()).snapshot,latest);
console.log('命令・差分API: 行動をDB確定・同一ID再送・選び直し拒否・再開・差分確定 OK');

// 旧方式の未完了手番を進めた後も、新しい差分の基準を同じグラフへ合わせる。
const bridgeBefore=await (await request({...base,op:'claim',compactGraph:true})).json();
const bridgeState=refDeserialize(bridgeBefore.snapshot);
const bridgeAction=bridgeState.battle.phase==='enemy'?'enemy':'stunned';
const bridgeResult=await request({...base,op:'battle',action:bridgeAction,syncGraph:true,revision:bridgeBefore.revision,commandId:crypto.randomUUID()});
assert.equal(bridgeResult.status,200);const bridgeWire=await bridgeResult.json();
const bridgeAfter=await (await request({...base,op:'claim',compactGraph:true})).json();
assert.deepEqual(applyCloudChange(bridgeBefore.snapshot,bridgeWire.sync),bridgeAfter.snapshot);
console.log('旧手番の互換復旧: 確定後の差分基準とDB記録の一致 OK');
await db.close();
