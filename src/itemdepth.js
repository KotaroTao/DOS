// 無限迷宮の敵と装備に共通の深度曲線。数値性能だけを伸ばし、割合・確率は変えない。
import { lvPow } from "./levelcurve.js";
export const DEPTH_START = 200;
export function infEnemyMul(f) {
  f = Math.max(1, Number(f) || 1);
  if (f <= 20) return 0.70;
  if (f <= 50) return 0.70 + (f - 20) * (0.10 / 30);
  if (f <= 100) return 0.80 + (f - 50) * 0.003;
  return 0.95 + (f - 100) * 0.006;
}
export function itemDepthMul(it) {
  const d = Number(it?.depth);
  if (!Number.isFinite(d) || d <= DEPTH_START) return 1;
  return lvPow(d) / lvPow(DEPTH_START) * infEnemyMul(d) / infEnemyMul(DEPTH_START);
}
// 目録から品質を掛けた直後に一度だけ適用する。深度は入手時に固定する。
export function applyItemDepth(it) {
  const m = itemDepthMul(it);
  if (m === 1) return it;
  for (const k of ["atk", "vit", "agi", "int", "pie", "luk", "hp", "mp"]) {
    if (typeof it[k] === "number") it[k] = Math.round(it[k] * m);
  }
  // 武器係数は固定。深度で増えた武器性能を参照能力へ足し、係数との二重成長を防ぐ。
  if (it.weaponRating && it.scale) {
    const total = Object.values(it.scale).reduce((s, v) => s + v, 0);
    if (total > 0) for (const [k, v] of Object.entries(it.scale)) {
      it[k] = (it[k] || 0) + Math.round(it.weaponRating * (m - 1) * v / total);
    }
  }
  return it;
}
