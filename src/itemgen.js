// ===== 装備の世代 (docs/item-generations.md) =====
// 装備の種類も名前も増やさず、同じ装備が「世代」を重ねて強くなる。品の実体に it.gen (1 以上の整数。無い品は 1) を持つ。
//   通しLv = 200 × (世代 − 1) + 隠しLv (第2世代の隠しLv1 = 通しLv201 ≒ 第1世代の隠しLv200 の性能)
//   通しR  = 20 × (世代 − 1) + R (R = ceil(隠しLv / 10))
// 性能は「その通しLv の品が落とし物の帯の上限に来る推奨Lv での敵の曲線」に合わせる (旧来の深度補正と同じ考え方:
// 敵の Lv の伸び lvPow × 無限迷宮の倍率 infEnemyMul)。世代ごとの掛け算はしない (桁があふれる)。
// 割合・確率・枠数・会心・抵抗の上限は変えず、実数の能力 (STR〜LUK・HP・MP) だけを伸ばす。
// 武器は係数を目録のまま、増えた攻撃性能を参照する能力へ足す (係数の比で配分)。
// このモジュールは純粋なデータ/ロジックのみ (game.js・ui・world.js を import しない)。
import { baselineLv, LV_EST } from "./baseline.js";
import { lvPow, refGold } from "./levelcurve.js";

export const GEN_LV_SPAN = 200;
export const GEN_R_SPAN = 20;
export const GEN_STAT_KEYS = ["atk", "vit", "agi", "int", "pie", "luk", "hp", "mp"];

// 品の世代 (無い・壊れた値は 1)
export function genOf(it) {
  const g = Math.floor(Number(it && it.gen));
  return Number.isFinite(g) && g >= 1 ? g : 1;
}
// 世代と隠しLv → 通しLv / 通しR
export const totalLvOf = (lv, gen = 1) => GEN_LV_SPAN * (Math.max(1, gen) - 1) + Math.max(1, lv || 1);
export const innerROf = (it) => Math.max(1, Math.min(GEN_R_SPAN, (it && it.r20) || Math.ceil(((it && it.lv) || 1) / 10)));
export const totalROf = (it, gen = genOf(it)) => GEN_R_SPAN * (Math.max(1, gen) - 1) + innerROf(it);
// 通しR → 世代 / 世代の中のランク
export const genOfTotalR = (r) => Math.max(1, Math.floor((Math.max(1, Math.round(r)) - 1) / GEN_R_SPAN) + 1);
export const innerOfTotalR = (r) => ((Math.max(1, Math.round(r)) - 1) % GEN_R_SPAN) + 1;
// 抽選の出現上限 capR (通しR) のもとで、ランク R の品が落ちる世代 (上限を越えない一番上の世代)
export function genForCap(R, capR) {
  return Math.max(1, Math.floor((Math.round(capR) - Math.max(1, R)) / GEN_R_SPAN) + 1);
}

// 無限迷宮の敵の強さ補正 (階 f)。20階まで0.70、50階0.80、100階0.95、以降1階+0.006
export function infEnemyMul(f) {
  f = Math.max(1, Number(f) || 1);
  if (f <= 20) return 0.70;
  if (f <= 50) return 0.70 + (f - 20) * (0.10 / 30);
  if (f <= 100) return 0.80 + (f - 50) * 0.003;
  return 0.95 + (f - 100) * 0.006;
}

// 通しLv T の品が、落とし物の帯の上限にちょうど来る推奨Lv (world.js lootBand の上限 = n × 2 の逆引き)
export function lootTopLevel(T) {
  const n = Math.max(1, T) / 2;
  return Math.max(1, 1 + (baselineLv(Math.max(0, n - 1)) - 1) * LV_EST);
}
// 敵の曲線 (推奨Lv の伸び × 無限迷宮の倍率)。100階より先は階 = 推奨Lv
function enemyCurve(T) {
  const L = lootTopLevel(T);
  return lvPow(L) * infEnemyMul(Math.max(100, L));
}
const CURVE_200 = enemyCurve(GEN_LV_SPAN);

// 部位ごとの標準品 (catalog/defs.js のビルダー既定値) の性能点。隠しLv の単調増加関数 (pricing.js も使う)
export const STANDARD_PERF = {
  weapon: (lv) => 2 + lv * 0.82 + lv * lv * 0.0026,                                  // 長剣 (片手) の ATK
  shield: (lv) => 2 + lv * 0.16 + lv * lv * 0.0014,                                  // 盾の VIT
  body: (lv) => 3 + lv * 0.22 + lv * lv * 0.0014,                                    // 重鎧の VIT
  head: (lv) => 1 + lv * 0.10 + lv * lv * 0.0012,                                    // 兜の VIT
  feet: (lv) => (1 + lv * 0.09 + lv * lv * 0.0010) + (0.6 + lv * 0.085),             // 革靴の VIT + AGI
  hands: (lv) => (0.8 + lv * 0.16 + lv * lv * 0.0006) + lv * 0.05,                   // 籠手の ATK + VIT
  acc: (lv) => 0.17 * (2 + lv * 0.82 + lv * lv * 0.0026),                            // 標準の腕輪・護符
};
// 標準品の性能を通しLv へ延ばす (200 までは目録の曲線、その先は敵の曲線の比)
export function standardPerfAt(slot, T) {
  const ref = STANDARD_PERF[slot] || STANDARD_PERF.weapon;
  if (T <= GEN_LV_SPAN) return ref(Math.max(0, T));
  return ref(GEN_LV_SPAN) * enemyCurve(T) / CURVE_200;
}
// 標準品の性能が score になる通しLv (200 より先だけを探す。score が200 の値以下なら 200)
export function totalLvForPerf(slot, score) {
  const ref = STANDARD_PERF[slot] || STANDARD_PERF.weapon;
  if (!(score > ref(GEN_LV_SPAN))) return GEN_LV_SPAN;
  let lo = GEN_LV_SPAN, hi = GEN_LV_SPAN * 2;
  while (standardPerfAt(slot, hi) < score && hi < 1e15) { lo = hi; hi *= 2; }
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (standardPerfAt(slot, mid) < score) lo = mid; else hi = mid;
  }
  return hi;
}

// 品 (隠しLv lv・部位 slot) を世代 gen で作った時の、実数の能力の倍率
export function genMulOf(slot, lv, gen) {
  if (!(gen > 1)) return 1;
  const ref = STANDARD_PERF[slot];
  if (!ref) return 1;
  const L = Math.max(1, Math.min(GEN_LV_SPAN, lv || 1));
  return standardPerfAt(slot, totalLvOf(L, gen)) / ref(L);
}
export function genMul(it, gen = genOf(it)) {
  return it ? genMulOf(it.slot, it.lv, gen) : 1;
}
// 部位に依らない世代の伸び (追加特性の基準 B・戦闘効果の点に使う)
export function genScale(lv, gen) { return genMulOf("weapon", lv, gen); }

// 目録から品質を掛けた直後に一度だけ適用する (再構築の順: 目録 → 品質 → 世代 → 追加特性 → 鍛造)
export function applyGen(it, gen = genOf(it)) {
  const m = genMul(it, gen);
  if (m === 1) return it;
  for (const k of GEN_STAT_KEYS) {
    if (typeof it[k] === "number") it[k] = Math.round(it[k] * m);
  }
  // 武器係数は固定。世代で増えた武器性能を参照能力へ足し、係数との二重成長を防ぐ。
  if (it.weaponRating && it.scale) {
    const total = Object.values(it.scale).reduce((s, v) => s + v, 0);
    if (total > 0) for (const [k, v] of Object.entries(it.scale)) {
      it[k] = (it[k] || 0) + Math.round(it.weaponRating * (m - 1) * v / total);
    }
  }
  return it;
}

// 値段: 通しLv200 より先は、その通しLv の品が落ちる推奨Lv での1戦の金貨に比例させる (200 でつながる)
export function genPriceRatio(slot, score) {
  const T = totalLvForPerf(slot, score);
  return refGold(lootTopLevel(T)) / refGold(lootTopLevel(GEN_LV_SPAN));
}

// ---- 旧セーブの移し替え (深度補正の廃止) ----
// 旧来の深度補正 (入手階 d が 200 を越えた品) の倍率
export function legacyDepthMul(d) {
  d = Number(d);
  if (!Number.isFinite(d) || d <= GEN_LV_SPAN) return 1;
  return lvPow(d) / lvPow(GEN_LV_SPAN) * infEnemyMul(d) / infEnemyMul(GEN_LV_SPAN);
}
// 旧来の深度補正の性能を下回らない、一番低い世代
export function genForLegacyDepth(slot, lv, d) {
  const m = legacyDepthMul(d);
  if (m <= 1) return 1;
  let g = 2;
  while (genMulOf(slot || "weapon", lv, g) < m && g < 100000) g++;
  return g;
}
