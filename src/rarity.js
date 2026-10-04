// 装備のレア度 (5段階) — ハクスラの手触りの要
//
// コモン(白) / アンコモン(緑) / レア(青) / スーパーレア(橙) / レジェンドレア(赤)。
// 名前の色でひと目で格が分かるようにする (未鑑定でも色だけは見える)。
// 分類は catalog/index.js が出自から付ける (it.rar):
//   ランク別標準装備 (ranks/rNN.js) … 同部位2種の下位=コモン / 上位=アンコモン
//   来歴つきの一点物 (weapons/armor/gear) … レア (能力 ×RARE_STAT_MUL)
//   伝説装備・層ごとの逸品 … スーパーレア
//   LR (lr_) … レジェンドレア
// 出現率: 装備ドロップのたびにレア度を先に抽選し (rollRarity)、その格の品を
// ランク窓から選ぶ。深い層ほど上位の格が出やすい。レジェンドレアだけは「実プレイ時間」で
// 抽選する (game.js の LR 時計)。第1層ではほぼ出ず、深く潜るほど出やすくなる (推奨Lv107 以降で3時間に1つ)。

export const RARITIES = {
  c: { key: "c", label: "コモン", short: "C", color: "#ece6d8", order: 0 },
  uc: { key: "uc", label: "アンコモン", short: "UC", color: "#46d667", order: 1 },
  r: { key: "r", label: "レア", short: "R", color: "#3f9cff", order: 2 },
  sr: { key: "sr", label: "スーパーレア", short: "SR", color: "#ff9a2e", order: 3 },
  lr: { key: "lr", label: "レジェンドレア", short: "LR", color: "#ff3b3b", order: 4 },
};
export const RARITY_KEYS = ["c", "uc", "r", "sr", "lr"];

// レア (来歴つき一点物) は同じ隠しレベルの標準装備より一段強い
export const RARE_STAT_MUL = 1.15;

// 装備ドロップ1回あたりのレア度の重み (コモン〜スーパーレア)。レジェンドレアは別枠 (時間抽選)。
// 1時間の探索で装備はおよそ30点前後拾う想定 → 第1層でレア≒3点/時、スーパーレア≒0.6点/時。
// 深い層ほど格上げ度 (layerRarityUp) が乗り、レア・スーパーレアの割合が増える
export const RARITY_WEIGHTS = { c: 60, uc: 28, r: 10, sr: 2 };
export function layerRarityUp(layer) { return Math.max(0, (layer || 1) - 1) * 0.2; }

// ===== レジェンドレアの時間抽選 =====
// 出やすさは「どこまで深く潜っているか (その階の推奨Lv)」で決まる (旧来の迷宮番号 n は A1 で廃止。
// 当時の 迷宮15 / 33 / 50 ≒ 推奨Lv 31 / 70 / 107):
//   第1層 = ほぼ出ない (lrLayerFactor) / 推奨Lv31 まで = 5時間に1つ / Lv70 = 4時間に1つ /
//   Lv107 以降 = 3時間に1つ (上限)。間は直線でつなぐ
export function lrIntervalH(lv) {
  if (lv <= 31) return 5;
  if (lv <= 70) return 5 - (lv - 31) / 39;
  if (lv <= 107) return 4 - (lv - 70) / 37;
  return 3;
}
// 抽選は「時間に対するポアソン過程 + 天井」: 平均 M 時間に対し、ハザード平均 M×1.56・天井 M×1.6 とすると
// 実効の平均間隔がほぼ M になり、最悪でも M×1.6 時間で必ず出る
export const LR_HAZARD_K = 1.56;
export const LR_PITY_K = 1.6;
// 層ごとのLR時計の進み方。第1層はほぼ止まる (= ほぼ出ない)。第2層以降は等速
export function lrLayerFactor(layer) { return (layer || 1) <= 1 ? 0.02 : 1; }

const STAT_KEYS = ["atk", "vit", "agi", "int", "pie", "luk", "hp", "mp"];

export function rarityKey(it) {
  if (!it) return null;
  if (it.rar && RARITIES[it.rar]) return it.rar;
  if (it.lr) return "lr";
  return null;
}
export function rarityColor(it) { const k = rarityKey(it); return k ? RARITIES[k].color : null; }
export function rarityLabel(it) { const k = rarityKey(it); return k ? RARITIES[k].label : null; }
export function rarityOrder(it) { const k = rarityKey(it); return k ? RARITIES[k].order : -1; }

// レア度の重み表に補正をかける。up=格上げ度 (0=補正なし)。
// 宝箱ランク・強敵・ミミック・黒い宝箱などで上位の重みを伸ばし、コモンを削る
export function rarityWeights(up = 0) {
  const u = Math.max(0, up);
  return {
    c: RARITY_WEIGHTS.c / (1 + u * 0.6),
    uc: RARITY_WEIGHTS.uc * (1 + u * 0.15),
    r: RARITY_WEIGHTS.r * (1 + u * 0.7),
    sr: RARITY_WEIGHTS.sr * (1 + u * 1.2),
  };
}
export function rollRarity(up = 0, rnd = Math.random) {
  const w = rarityWeights(up);
  const total = w.c + w.uc + w.r + w.sr;
  let x = rnd() * total;
  for (const k of ["sr", "r", "uc", "c"]) { if ((x -= w[k]) < 0) return k; }
  return "c";
}

// レアの能力補正 (カタログ統合時に一度だけ適用)
export function applyRareBoost(it) {
  for (const k of STAT_KEYS) {
    if (typeof it[k] === "number" && it[k] !== 0) it[k] = Math.round(it[k] * RARE_STAT_MUL);
  }
  // 値段はここでは触らない (game.js が起動時に性能から付け直す: src/pricing.js)
}
