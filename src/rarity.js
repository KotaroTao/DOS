// 装備のレア度 (5段階) — ハクスラの手触りの要
//
// コモン(白) / アンコモン(緑) / レア(青) / スーパーレア(橙) / レジェンドレア(赤)。
// 名前の色でひと目で格が分かるようにする (未鑑定でも色だけは見える)。
// 分類は catalog/index.js が出自から付ける (it.rar):
//   ランク別標準装備 (ranks/rNN.js) … 同部位2種の下位=コモン / 上位=アンコモン
//   来歴つきの一点物 (weapons/armor/gear) … レア (能力 ×RARE_STAT_MUL)
//   職業専用装備 (x_)・伝説装備・層ごとの逸品 … スーパーレア
//   LR (lr_) … レジェンドレア
// 出現率: 装備ドロップのたびにレア度を先に抽選し (rollRarity)、その格の品を
// ランク窓から選ぶ。深い層ほど上位の格が出やすい。レジェンドレアも同じ抽選で出て、
// 重みはいつもスーパーレアの1/3 (2026-10 ユーザーの指示: 時間の天井は廃止・同じ品を何度でも拾える)。

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

// 装備ドロップ1回あたりのレア度の重み (コモン〜スーパーレア)。レジェンドレアはスーパーレアの LR_PER_SR 倍。
// 1時間の探索で装備はおよそ30点前後拾う想定 → 第1層でレア≒3点/時、スーパーレア≒0.6点/時。
// 深い層ほど格上げ度 (layerRarityUp) が乗り、レア・スーパーレアの割合が増える
export const RARITY_WEIGHTS = { c: 60, uc: 28, r: 10, sr: 2 };
export function layerRarityUp(layer) { return Math.max(0, (layer || 1) - 1) * 0.2; }

// レジェンドレアの重み = (補正後の) スーパーレアの重み × これ
export const LR_PER_SR = 1 / 3;

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
// 宝箱ランク・強敵・ミミック・黒い宝箱などで上位の重みを伸ばし、コモンを削る。
// noLR = レジェンドレアを抽選に入れない (迷宮のイベントが直接渡す品)
export function rarityWeights(up = 0, noLR = false) {
  const u = Math.max(0, up);
  const sr = RARITY_WEIGHTS.sr * (1 + u * 1.2);
  return {
    c: RARITY_WEIGHTS.c / (1 + u * 0.6),
    uc: RARITY_WEIGHTS.uc * (1 + u * 0.15),
    r: RARITY_WEIGHTS.r * (1 + u * 0.7),
    sr,
    lr: noLR ? 0 : sr * LR_PER_SR,
  };
}
export function rollRarity(up = 0, rnd = Math.random, noLR = false) {
  const w = rarityWeights(up, noLR);
  const total = w.c + w.uc + w.r + w.sr + w.lr;
  let x = rnd() * total;
  for (const k of ["lr", "sr", "r", "uc", "c"]) { if ((x -= w[k]) < 0) return k; }
  return "c";
}

// レアの能力補正 (カタログ統合時に一度だけ適用)
export function applyRareBoost(it) {
  for (const k of STAT_KEYS) {
    if (typeof it[k] === "number" && it[k] !== 0) it[k] = Math.round(it[k] * RARE_STAT_MUL);
  }
  // 値段はここでは触らない (game.js が起動時に性能から付け直す: src/pricing.js)
}
