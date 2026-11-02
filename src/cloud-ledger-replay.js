// 記録した命令だけから戦況を再生する。全体の読み戻し・ハッシュは戦闘末尾に一度だけ。
import { refSerialize, refDeserialize } from "./savegraph.js";
import { resolveCloudCommand, battleCommand } from "./cloud-battle.js";
import { orderedCloudValue } from "./cloud-command-replay.js";
export const BATTLE_RULES = "battle-1";
export function canonicalBattleGraph(graph) {
  const seen = new Map();
  const stable = value => {
    if (!value || typeof value !== "object") return value;
    if (seen.has(value)) return seen.get(value);
    const copy = Array.isArray(value) ? [] : {};
    seen.set(value, copy);
    for (const key of Object.keys(value).sort((a,b) => Array.isArray(value) ? Number(a)-Number(b) : a < b ? -1 : a > b ? 1 : 0)) Object.defineProperty(copy,key,{value:stable(value[key]),enumerable:true,writable:true,configurable:true});
    return copy;
  };
  return refSerialize(stable(refDeserialize(graph)), { compact: true });
}
export async function battleStateHash(graph) {
  const canonical = canonicalBattleGraph(graph);
  const bytes = new TextEncoder().encode(JSON.stringify(orderedCloudValue(canonical)));
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(b => b.toString(16).padStart(2,"0")).join("");
}
export async function replayBattleLedger(graph, ledger, {measure = async (_,fn) => fn()} = {}) {
  if (ledger.rules !== BATTLE_RULES) throw Object.assign(new Error("cloud_version_mismatch"), { status: 409 });
  const state = refDeserialize(orderedCloudValue(graph));
  for (const { commandId, command } of ledger.choices) {
    const count = command.forcedCount ?? 0;
    if (!Number.isSafeInteger(count) || count<0 || count>16) throw Object.assign(new Error("cloud_invalid_choice"), { status: 400 });
    resolveCloudCommand(state, command, { commandToken: commandId, noPackets: true });
    for (let i=0;i<count;i++) {
      if (state.battle.result || !["enemy","stunned"].includes(state.battle.phase)) throw Object.assign(new Error("cloud_invalid_choice"), { status: 400 });
      resolveCloudCommand(state,battleCommand(state.battle,state.battle.phase,state.rng),{commandToken:`${commandId}:${i+1}`,noPackets:true});
    }
  }
  const snapshot = canonicalBattleGraph(refSerialize(state,{compact:true}));
  return { snapshot, terminal: !!state.battle?.result, hash: await measure("hash",()=>battleStateHash(snapshot)) };
}
