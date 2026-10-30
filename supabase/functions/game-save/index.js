import { LEGAL_VERSION } from "../../../src/legal.js";
import { refSerialize, refDeserialize } from "../../../src/savegraph.js";
import { resolveCloudBattle, resolveCloudTurn } from "../../../src/cloud-battle.js";

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
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function rpc(name, body) {
  const textRPC = name === "cloud_claim_slot" || name === "cloud_commit_slot";
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

async function command(user, body) {
  if (body.protocol !== 1) throw Object.assign(new Error("cloud_version_mismatch"), { status: 409 });
  if (body.op === "consent") {
    if (body.version !== LEGAL_VERSION) throw Object.assign(new Error("cloud_version_mismatch"), { status: 409 });
    return rpc("cloud_accept_terms", { p_user: user.id, p_version: LEGAL_VERSION });
  }
  if (!uuid.test(body.sessionId)) throw Object.assign(new Error("通信の形式が不正です"), { status: 400 });
  const slot = body.slot === undefined ? 1 : body.slot;
  if (slot !== 1) throw Object.assign(new Error("記録の番号が不正です"), { status: 400 });
  const s = await rpc("cloud_claim_slot", { p_user: user.id, p_session: body.sessionId, p_slot: slot });
  if (s.terms_version !== LEGAL_VERSION) throw Object.assign(new Error("cloud_version_mismatch"), { status: 409 });
  if (body.op === "delete-account") {
    const r = await fetch(`${url}/auth/v1/admin/users/${user.id}`, { method: "DELETE",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
    if (!r.ok) throw Object.assign(new Error("アカウントを削除できません"), { status: 503 });
    return { deleted: true };
  }
  if (body.op === "claim") {
    const snapshot = s.snapshot?.format === 2 && !body.compactGraph ? refSerialize(refDeserialize(s.snapshot)) : s.snapshot;
    return { revision: s.revision, snapshot, battleTurn: true, compactGraph: true, backgroundBattle: true };
  }
  if (body.op === "renew") {
    if (s.revision !== body.revision) throw Object.assign(new Error("cloud_revision_conflict"), { status: 409 });
    return { revision: s.revision };
  }
  if (!uuid.test(body.commandId) || !Number.isSafeInteger(body.revision) || body.revision < 0) {
    throw Object.assign(new Error("通信の形式が不正です"), { status: 400 });
  }
  if (s.last_command === body.commandId) {
    // JSONBのキー順には依存せず、DB側の構造比較で一致を確かめる。
    return await rpc("cloud_commit_slot", { p_user: user.id, p_session: body.sessionId, p_slot: slot,
      p_revision: body.revision, p_command: body.commandId, p_request: body,
      p_snapshot: s.snapshot, p_response: s.last_response });
  }
  if (s.revision !== body.revision) throw Object.assign(new Error("cloud_revision_conflict"), { status: 409 });
  let snapshot = s.snapshot, response = {};
  if (body.op === "save" || body.op === "turn") {
    const next = refDeserialize(body.snapshot);
    if (!next || !["town", "board", "combat", "over"].includes(next.state) || !Array.isArray(next.party) || !Array.isArray(next.souls)) {
      throw Object.assign(new Error("記録の形式が不正です"), { status: 400 });
    }
    snapshot = body.snapshot;
    if (body.op === "turn") {
      if (next.state !== "combat" || !next.battle || !["commit", "enemy", "stunned"].includes(body.action)) {
        throw Object.assign(new Error("戦闘の形式が不正です"), { status: 400 });
      }
      response = resolveCloudTurn(next, body.action, { compact: body.snapshot?.format === 2 });
      snapshot = refSerialize(next, { compact: body.snapshot?.format === 2 });
    }
  } else if (body.op === "reset") {
    snapshot = null;
  } else if (body.op === "battle") {
    const current = refDeserialize(snapshot);
    // 乱数・フックを結線して計算し終えるまでawaitを挟まず、別の要求と混ざらないようにする。
    response.packet = refSerialize(resolveCloudBattle(current, body.action));
    snapshot = refSerialize(current);
  } else throw Object.assign(new Error("通信の種類が不正です"), { status: 400 });
  return await rpc("cloud_commit_slot", { p_user: user.id, p_session: body.sessionId, p_slot: slot,
    p_revision: body.revision, p_command: body.commandId, p_request: body,
    p_snapshot: snapshot, p_response: response });
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const headers = { "Content-Type": "application/json", "Cache-Control": "no-store", "Vary": "Origin" };
  if (origin && origins.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Headers"] = "authorization, apikey, content-type";
    headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
  } else if (origin) return new Response(JSON.stringify({ error: "接続元が許可されていません" }), { status: 403, headers });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return new Response(null, { status: 405, headers });
  const requestId = crypto.randomUUID();
  try {
    const authorization = req.headers.get("Authorization") || "";
    const auth = await fetch(`${url}/auth/v1/user`, { headers: { apikey: serviceKey, Authorization: authorization } });
    if (!auth.ok) return new Response(JSON.stringify({ error: "ログインし直してください" }), { status: 401, headers });
    const user = await auth.json();
    if (!user.id) return new Response(null, { status: 401, headers });
    const raw = await readSaveRequest(req);
    const body = JSON.parse(raw);
    const result = await command(user, body);
    return new Response(JSON.stringify(result), { headers });
  } catch (e) {
    // 認証情報・冒険の中身は記録しない。利用者の問い合わせ番号と結び付ける。
    console.error(JSON.stringify({ requestId, status: e.status || 503, name: e.name, message: e.message, bytes: e.bytes, databaseCode: e.databaseCode }));
    return new Response(JSON.stringify({ error: e.status ? e.message : "記録の処理に失敗しました", requestId }), { status: e.status || 503, headers });
  }
});
