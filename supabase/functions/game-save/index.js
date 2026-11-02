import { replayBattleLedger, BATTLE_RULES } from "../../../src/cloud-ledger-replay.js";
import { createAuthenticator } from "./auth.js";
import { replayCloudCommand } from "../../../src/cloud-command-replay.js";
import { encodeCloudReply } from "../../../src/cloud-wire.js";
import { commandPacketBase } from "../../../src/cloud-command-codec.js";
import { createCloudChange, applyCloudChange } from "../../../src/cloud-change.js";
import { LEGAL_VERSION } from "../../../src/legal.js";
import { refSerialize, refDeserialize } from "../../../src/savegraph.js";
import { resolveCloudBattle, resolveCloudTurn, resolveCloudCommand } from "../../../src/cloud-battle.js";

const url = Deno.env.get("SUPABASE_URL");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const origins = (Deno.env.get("GAME_ALLOWED_ORIGINS") || "").split(",").map((s) => s.trim()).filter(Boolean);
// 進行した記録や戦闘中の参照グラフは2MiBを超える。上限はUTF-8の実バイト数。
const MAX_REQUEST_BYTES = 16 * 1024 * 1024;
async function readSaveRequest(req) {
  if (!req.body) return "";
  const reader = req.body.getReader(), decoder = new TextDecoder(), parts = [];
  let bytes = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_REQUEST_BYTES) {
        await reader.cancel();
        throw Object.assign(new Error("記録が送信できる大きさを超えています"), { status: 413, bytes });
      }
      parts.push(decoder.decode(value, { stream: true }));
    }
    parts.push(decoder.decode());
    return parts.join("");
  } finally { reader.releaseLock(); }
}
const authenticate = createAuthenticator({ url, serviceKey });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function callRPC(name, body) {
  const textRPC = name === "cloud_claim_slot" || name === "cloud_commit_slot" || name.endsWith("_text");
  const endpoint = name === "cloud_claim_slot" ? "cloud_claim_text" : name === "cloud_commit_slot" ? "cloud_commit_text" : name;
  if (name === "cloud_commit_slot") body = { p_payload: JSON.stringify(body) };
  const r = await fetch(`${url}/rest/v1/rpc/${endpoint}`, {
    method: "POST", headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const value = await r.json();
  if (!r.ok) {
    const code = String(value.message || "").match(/cloud_[a-z_]+/)?.[0];
    throw Object.assign(new Error(code || "保存先に接続できません"), { status: code ? 409 : 503, databaseCode: value.code });
  }
  return textRPC ? JSON.parse(value) : value;
}

async function command(user, body, measure) {
  const rpc = (name, data) => measure(name.includes("claim") ? "read" : "write", () => callRPC(name, data));
  if (body.protocol !== 1) throw Object.assign(new Error("cloud_version_mismatch"), { status: 409 });
  if (body.op === "consent") {
    if (body.version !== LEGAL_VERSION) throw Object.assign(new Error("cloud_version_mismatch"), { status: 409 });
    return rpc("cloud_accept_terms", { p_user: user.id, p_version: LEGAL_VERSION });
  }
  if (!uuid.test(body.sessionId)) throw Object.assign(new Error("通信の形式が不正です"), { status: 400 });
  const slot = body.slot === undefined ? 1 : body.slot;
  if (slot !== 1) throw Object.assign(new Error("記録の番号が不正です"), { status: 400 });
  if (body.op === "renew" && body.battleLedger === true) return rpc("cloud_battle_renew_text",{p_payload:JSON.stringify({p_user:user.id,p_session:body.sessionId,p_revision:body.revision,p_terms:LEGAL_VERSION})});
  const s = await rpc("cloud_claim_slot", { p_user: user.id, p_session: body.sessionId, p_slot: slot });
  if (s.terms_version !== LEGAL_VERSION) throw Object.assign(new Error("cloud_version_mismatch"), { status: 409 });
  if (body.op === "delete-account") {
    const r = await fetch(`${url}/auth/v1/admin/users/${user.id}`, { method: "DELETE",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
    if (!r.ok) throw Object.assign(new Error("アカウントを削除できません"), { status: 503 });
    return { deleted: true };
  }
  const ledger = body.battleLedger === true || ["ledger-finish","ledger-preview"].includes(body.op) ? await rpc("cloud_battle_read", { p_user: user.id }) : null;
  if (body.op === "ledger-preview") {
    if (!ledger || ledger.id !== body.battleId || ledger.seq !== body.seq || s.revision !== body.revision || !uuid.test(body.commandId)) throw Object.assign(new Error("cloud_revision_conflict"),{status:409});
    const base = await measure("replay", () => replayBattleLedger(s.snapshot,ledger,{measure}));
    return measure("replay", () => replayCloudCommand(base.snapshot,body.command,body.commandId,true));
  }
  if (body.op === "ledger-finish") {
    if (!uuid.test(body.commandId)) throw Object.assign(new Error("通信の形式が不正です"), {status:400});
    if (!ledger) {
      if (s.last_command === body.commandId && s.last_request?.op === "ledger-finish") return s.last_response;
      throw Object.assign(new Error("cloud_battle_missing"),{status:409});
    }
    if (ledger.id !== body.battleId || ledger.seq !== body.seq || ledger.rules !== BATTLE_RULES || s.revision !== body.revision) throw Object.assign(new Error("cloud_revision_conflict"),{status:409});
    const replay = await measure("replay", () => replayBattleLedger(s.snapshot,ledger,{measure}));
    if (!replay.terminal) throw Object.assign(new Error("cloud_battle_unfinished"),{status:409});
    return rpc("cloud_battle_finish_text",{p_payload:JSON.stringify({p_user:user.id,p_session:body.sessionId,p_battle:ledger.id,p_seq:ledger.seq,p_command:body.commandId,p_request:body,p_snapshot:replay.snapshot,p_response:{battleHash:replay.hash}})});
  }
  if (body.op === "claim") {
    if (ledger) {
      const replay = await measure("replay", () => replayBattleLedger(s.snapshot,ledger,{measure}));
      return {revision:s.revision,snapshot:replay.snapshot,battleTurn:true,compactGraph:true,backgroundBattle:false,actionCommands:true,commandReplay:true,forcedTurns:true,battleLedger:true,ledger:{id:ledger.id,seq:ledger.seq,rules:ledger.rules}};
    }
    const snapshot = s.snapshot?.format === 2 && !body.compactGraph ? refSerialize(refDeserialize(s.snapshot)) : s.snapshot;
    return { revision: s.revision, snapshot, battleTurn: true, compactGraph: true, backgroundBattle: false, actionCommands: true, commandReplay: true, forcedTurns: true, battleLedger: true };
  }
  if (body.op === "renew") {
    if (s.revision !== body.revision) throw Object.assign(new Error("cloud_revision_conflict"), { status: 409 });
    return { revision: s.revision };
  }
  if (!uuid.test(body.commandId) || !Number.isSafeInteger(body.revision) || body.revision < 0) {
    throw Object.assign(new Error("通信の形式が不正です"), { status: 400 });
  }
  if (s.last_command === body.commandId) {
    if (s.last_response?.ledger && body.battleLedger === true) return rpc("cloud_battle_begin_text",{p_payload:JSON.stringify({p_user:user.id,p_session:body.sessionId,p_revision:body.revision,p_command:body.commandId,p_request:body,p_snapshot:s.snapshot,p_response:s.last_response})});
    // JSONBのキー順には依存せず、DB側の構造比較で一致を確かめる。
    return await rpc("cloud_commit_slot", { p_user: user.id, p_session: body.sessionId, p_slot: slot,
      p_revision: body.revision, p_command: body.commandId, p_request: body,
      p_snapshot: s.snapshot, p_response: s.last_response });
  }
  if (s.revision !== body.revision) throw Object.assign(new Error("cloud_revision_conflict"), { status: 409 });
  let snapshot = s.snapshot, response = {}, beginLedger = false;
  if (body.op === "save" || body.op === "turn") {
    const graph = body.snapshot || applyCloudChange(s.snapshot, body.change);
    const next = refDeserialize(graph);
    if (!next || !["town", "board", "combat", "over"].includes(next.state) || !Array.isArray(next.party) || !Array.isArray(next.souls)) {
      throw Object.assign(new Error("記録の形式が不正です"), { status: 400 });
    }
    snapshot = graph;
    beginLedger = body.op === "save" && body.battleLedger === true && next.state === "combat" && !!next.battle && !next.battle.result;
    if (body.openingCommand && (!beginLedger || !["enemy","stunned"].includes(next.battle.phase) || body.openingCommand.operation !== next.battle.phase || !Number.isSafeInteger(body.openingCommand.forcedCount) || body.openingCommand.forcedCount<0 || body.openingCommand.forcedCount>16)) throw Object.assign(new Error("cloud_invalid_choice"),{status:400});
    if (body.op === "turn") {
      if (next.state !== "combat" || !next.battle || !["commit", "enemy", "stunned"].includes(body.action)) {
        throw Object.assign(new Error("戦闘の形式が不正です"), { status: 400 });
      }
      response = resolveCloudTurn(next, body.action, { compact: body.snapshot?.format === 2 });
      snapshot = refSerialize(next, { compact: body.snapshot?.format === 2 });
    }
  } else if (body.op === "command") {
    if (!s.snapshot) throw Object.assign(new Error("cloud_revision_conflict"), { status: 409 });
    if (body.replay === true) {
      // 状態の写しは返さず、同じ計算結果のSHA-256とDB更新番号だけを確定後に返す。
      const replay = await measure("replay", () => replayCloudCommand(s.snapshot, body.command, body.commandId, body.forcedTurns === true));
      snapshot = replay.snapshot;
      refDeserialize(snapshot);
      if (new TextEncoder().encode(JSON.stringify(snapshot)).length > MAX_REQUEST_BYTES) throw Object.assign(new Error("記録が送信できる大きさを超えています"), { status: 413 });
      response = { replayHash: replay.hash };
    } else {
      const current = refDeserialize(s.snapshot);
      response = resolveCloudCommand(current, body.command, { compact: true });
      const basePacket = commandPacketBase(s.snapshot);
      response.packetChange = createCloudChange(basePacket, response.packet) || { change: [] };
      response.nextPacketChange = response.nextPacket ? createCloudChange(basePacket, response.nextPacket) || { change: [] } : null;
      delete response.packet; delete response.nextPacket;
      snapshot = refSerialize(current, { compact: true });
      refDeserialize(snapshot);
      if (new TextEncoder().encode(JSON.stringify(snapshot)).length > MAX_REQUEST_BYTES) throw Object.assign(new Error("記録が送信できる大きさを超えています"), { status: 413 });
      response.sync = createCloudChange(s.snapshot, snapshot)?.change;
      // syncは受信端末の確定済みグラフ更新用。全体が小さい場合も差分の形にする。
      if (!response.sync) response.sync = [["set", [], snapshot]];
    }
  } else if (body.op === "reset") {
    snapshot = null;
  } else if (body.op === "battle") {
    const current = refDeserialize(snapshot);
    // 乱数・フックを結線して計算し終えるまでawaitを挟まず、別の要求と混ざらないようにする。
    response.packet = refSerialize(resolveCloudBattle(current, body.action));
    snapshot = refSerialize(current);
  } else throw Object.assign(new Error("通信の種類が不正です"), { status: 400 });
  if (body.syncGraph && ["battle", "turn"].includes(body.op)) response.sync = createCloudChange(s.snapshot, snapshot)?.change || [["set", [], snapshot]];
  const commit = { p_user: user.id, p_session: body.sessionId, p_slot: slot,
    p_revision: body.revision, p_command: body.commandId, p_request: body,
    p_snapshot: snapshot, p_response: response };
  if (body.op === "reset" && body.battleLedger === true) return rpc("cloud_battle_reset_text",{p_payload:JSON.stringify(commit)});
  return beginLedger ? rpc("cloud_battle_begin_text", {p_payload:JSON.stringify(commit)}) : rpc("cloud_commit_slot", commit);
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const headers = { "Content-Type": "application/json", "Cache-Control": "no-store", "Vary": "Origin" };
  if (origin && origins.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Headers"] = "authorization, apikey, content-type, x-region";
    headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    headers["Access-Control-Expose-Headers"] = "Server-Timing, x-sb-edge-region";
  } else if (origin) return new Response(JSON.stringify({ error: "接続元が許可されていません" }), { status: 403, headers });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return new Response(null, { status: 405, headers });
  const requestId = crypto.randomUUID();
  const started = performance.now(), durations = {};
  const measure = async (name, fn) => {
    const begin = performance.now();
    try { return await fn(); } finally { durations[name] = (durations[name] || 0) + performance.now() - begin; }
  };
  const timing = () => {
    durations.total = performance.now() - started;
    headers["Server-Timing"] = Object.entries(durations).map(([name, ms]) => `${name};dur=${ms.toFixed(1)}`).join(", ");
    const region = Deno.env.get("SB_REGION");
    if (region) headers["x-sb-edge-region"] = region;
  };
  try {
    const authorization = req.headers.get("Authorization") || "";
    const raw = await readSaveRequest(req);
    let body;
    try { body = JSON.parse(raw); } catch { throw Object.assign(new Error("通信の形式が不正です"),{status:400}); }
    const user = await measure("auth", () => authenticate(authorization, { online: ["claim", "delete-account", "reset", "consent"].includes(body.op) }));
    const result = await command(user, body, measure);
    const response = await measure("encode", async () => JSON.stringify(body.acceptEncoding === "gzip" ? await encodeCloudReply(result) : result));
    timing();
    return new Response(response, { headers });
  } catch (e) {
    // 認証情報・冒険の中身は記録しない。利用者の問い合わせ番号と結び付ける。
    console.error(JSON.stringify({ requestId, status: e.status || 503, name: e.name, message: e.message, bytes: e.bytes, databaseCode: e.databaseCode }));
    timing();
    return new Response(JSON.stringify({ error: e.status ? e.message : "記録の処理に失敗しました", requestId }), { status: e.status || 503, headers });
  }
});
