// サーバーとWorkerで同じ命令を計算する。サーバーの確定通知と照合するまで結果は見せない。
import { refSerialize, refDeserialize } from "./savegraph.js";
import { resolveCloudCommand, battleCommand } from "./cloud-battle.js";
export function orderedCloudValue(value) {
  if (Array.isArray(value)) return value.map(orderedCloudValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, orderedCloudValue(value[key])]));
}
export async function replayCloudCommand(graph, command, commandId, forcedTurns = false) {
  const state = refDeserialize(orderedCloudValue(graph));
  const packets = resolveCloudCommand(state, command, { compact: true, commandToken: commandId });
  const forcedPackets = [];
  // 大きな記録で結果の写しを積み過ぎない。通常の確定通知は引き続き約100バイト。
  const packetBytes = forcedTurns ? new TextEncoder().encode(JSON.stringify(packets)).length : 0;
  const forcedLimit = packetBytes ? Math.min(16, Math.floor(4 * 1024 * 1024 / packetBytes)) : 0;
  // 選べる手番までの敵・行動不能だけを一度に確定する。次の味方の選択は決めない。
  while (forcedTurns && !state.battle.result && ["enemy", "stunned"].includes(state.battle.phase) && forcedPackets.length < forcedLimit) {
    const operation = state.battle.phase;
    const next = battleCommand(state.battle, operation, state.rng);
    const turn = resolveCloudCommand(state, next, { compact: true, commandToken: `${commandId}:${forcedPackets.length + 1}` });
    forcedPackets.push({ operation, ...turn });
  }
  const result = { ...packets, ...(forcedTurns ? { forcedPackets } : {}), snapshot: refSerialize(state, { compact: true }) };
  const bytes = new TextEncoder().encode(JSON.stringify(orderedCloudValue(result)));
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return { ...result, hash: [...digest].map(byte => byte.toString(16).padStart(2, "0")).join("") };
}
