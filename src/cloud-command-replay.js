// サーバーとWorkerで同じ命令を計算する。サーバーの確定通知と照合するまで結果は見せない。
import { refSerialize, refDeserialize } from "./savegraph.js";
import { resolveCloudCommand } from "./cloud-battle.js";
export function orderedCloudValue(value) {
  if (Array.isArray(value)) return value.map(orderedCloudValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, orderedCloudValue(value[key])]));
}
export async function replayCloudCommand(graph, command, commandId) {
  const state = refDeserialize(orderedCloudValue(graph));
  const packets = resolveCloudCommand(state, command, { compact: true, commandToken: commandId });
  const result = { ...packets, snapshot: refSerialize(state, { compact: true }) };
  const bytes = new TextEncoder().encode(JSON.stringify(orderedCloudValue(result)));
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return { ...result, hash: [...digest].map(byte => byte.toString(16).padStart(2, "0")).join("") };
}
