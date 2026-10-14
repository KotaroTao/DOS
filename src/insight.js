// 操霊師の見識。所持品や通貨ではなく、保存済みの図鑑記録だけを評価する。
import { rarityKey } from "./rarity.js";
import { revealSteps } from "./monsterreveal.js";
export const INSIGHT_JOB = { common: 10, rare: 15, epic: 20, legend: 30, unique: 20 };
export const INSIGHT_EVENT = { common: 1, uncommon: 2, rare: 5, mythic: 10 };
const positive = (n) => Number.isFinite(Number(n)) ? Math.max(0, Math.floor(Number(n))) : 0;
// 見識は消費せず、現在の合計から称号を決める。物語上の「魂の王」は使わない。
export const INSIGHT_TITLES = [
  { min: 0, title: "かけ出し操霊師" },
  { min: 100, title: "修練の操霊師" },
  { min: 300, title: "一人前の操霊師" },
  { min: 600, title: "熟練の操霊師" },
  { min: 1000, title: "名高き操霊師" },
  { min: 1500, title: "魂の探究者" },
  { min: 2200, title: "迷宮の識者" },
  { min: 3000, title: "魂の賢者" },
  { min: 4000, title: "深淵の賢者" },
  { min: 5500, title: "魂の大賢者" },
  { min: 7000, title: "万霊の導師" },
  { min: 9000, title: "万霊の大導師" },
  { min: 11000, title: "伝説の大操霊師" },
];
export function insightTitle(total) {
  const points = positive(total);
  return INSIGHT_TITLES.findLast(rank => points >= rank.min);
}
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
