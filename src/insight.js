// 操霊師の見識。所持品や通貨ではなく、保存済みの図鑑記録だけを評価する。
import { rarityKey } from "./rarity.js";
import { revealSteps } from "./monsterreveal.js";
export const INSIGHT_JOB = { common: 10, rare: 15, epic: 20, legend: 30, unique: 20 };
export const INSIGHT_EVENT = { common: 1, uncommon: 2, rare: 5, mythic: 10 };
const positive = (n) => Number.isFinite(Number(n)) ? Math.max(0, Math.floor(Number(n))) : 0;
export function insightTotals(state, { monsters, items, jobs, events }) {
  const codex = state.codex || {};
  const result = { mon: 0, item: 0, job: 0, ev: 0, total: 0 };
  const known = new Set([...Object.keys(codex.mon || {}), ...Object.keys(codex.met || {}), ...Object.keys(state.named?.seen || {})]);
  for (const key of known) {
    const m = monsters[key];
    if (!m || key.startsWith("ev_")) continue;
    const rec = codex.mon?.[key];
    const kills = rec === true ? 1 : positive(rec?.kills);
    const met = !!codex.met?.[key] || !!state.named?.seen?.[key];
    if (!kills && !met) continue; // 名前を最初から持つ主も、未遭遇なら加算しない
    const steps = revealSteps(m);
    if (kills >= steps.name) result.mon += 1;
    if (kills >= steps.stats) result.mon += 2;
    if (kills >= steps.lore) result.mon += 3;
  }
  for (const [id, seen] of Object.entries(codex.item || {})) {
    if (seen && items[id]) result.item += rarityKey(items[id]) === "lr" ? 5 : 1;
  }
  for (const [id, rec] of Object.entries(codex.job || {})) {
    if (!rec || !jobs[id]) continue;
    const rank = rec === true ? 1 : Math.min(5, positive(rec.rank));
    result.job += rank * (INSIGHT_JOB[jobs[id].rarity] || 0);
  }
  for (const [id, seen] of Object.entries(state.events?.seen || {})) {
    if (seen && events[id]) result.ev += INSIGHT_EVENT[events[id].tier] || 0;
  }
  result.total = result.mon + result.item + result.job + result.ev;
  return result;
}
