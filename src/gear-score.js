import { SOUL_CLASSES } from "./souls.js";
const GEAR_W_CACHE = {};
export function gearWeights(doll) {
  const key = doll && (doll.jobKey || doll.clsKey);
  if (key && GEAR_W_CACHE[key]) return GEAR_W_CACHE[key];
  const st = key && SOUL_CLASSES[key] && SOUL_CLASSES[key].stat;
  let W;
  if (!st) {
    W = { atk: 1, vit: 1, agi: 0.8, int: 0.6, pie: 0.6, luk: 0.4, hp: 0.2, mp: 0.15 };
    if (doll) {
      const a = doll.atk || 0;
      if ((doll.int || 0) > a) { W.int = 1.2; W.atk = 0.4; }
      if ((doll.pie || 0) > a) { W.pie = 1.2; W.atk = Math.min(W.atk, 0.5); }
    }
    return W;
  }
  const ks = ["atk", "vit", "agi", "int", "pie", "luk"];
  const mx = Math.max(...ks.map((k) => st[k] || 0)) || 1;
  W = {};
  // 最低の重みは 0.15 (2026-10: 0.35 だと使わない能力も重く数え、騎士・戦士が神理の法衣 (VIT19・PIE37) を
  // 竜王の鎧 (VIT39) より良いとして法衣を着ていた)。一番伸びる能力の重みは 1.25 のまま
  for (const k of ks) W[k] = Math.round((0.15 + 1.1 * ((st[k] || 0) / mx)) * 100) / 100;
  W.hp = 0.25;
  W.mp = (st.mp || 0) >= 1.5 ? 0.15 : 0.03;
  return (GEAR_W_CACHE[key] = W);
}
// 全部位で攻撃力・能力・特殊効果を同じ重みで比べる。武器交換だけの追加倍率は付けない。
// 武器の攻撃力を最優先する度合い 0〜1: STR・AGIの重みとINT・PIEを比較（弓・短剣も物理職として扱う）
// (聖騎士・審問官のような打撃と祈りの両刀は半ばほど)
export function weaponShare(W) {
  const mag = Math.max(W.int || 0, W.pie || 0);
  if (!mag) return 1;
  return Math.max(0, Math.min(1, (Math.max(W.atk || 0, W.agi || 0) / mag - 0.85) / 0.15));
}
// 最適装備は職業別の能力値だけで選ぶ。属性・会心・耐性・特殊効果は採点しない。
// 魔力・信仰はINT・PIEと重なる表示用の値なので、二重には加点しない。
export function gearScore(doll, delta) {
  if (!delta) return 0;
  const W = gearWeights(doll);
  let s = 0;
  for (const k in W) {
    const v = k === "atk" && delta.power != null
      ? delta.power * Math.max(0.15, weaponShare(W)) : (delta[k] || 0);
    s += v * W[k];
  }
  return Math.round(s * 10) / 10;
}

