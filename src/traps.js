// 罠カタログ: 床罠・宝箱罠の共通定義 (純ロジック。発動演出は game.js)
// ・罠ランク (rank 1-3): 迷宮ランクが罠ランク以上で出現する。
//   ランク1帯 (迷宮1-10) は8種、ランク2帯 (迷宮11-20) で16種、
//   ランク3帯 (迷宮21以降) で全24種が出現する。
// ・迷宮ランクが高いほど高ランク (=危険) な罠ほど重く抽選される。
// ・ダメージの実数値は game.js 側の基準値 (迷宮の魂レベル帯×ランク) に
//   mult/pct を掛けて決まる。ここでは「型と倍率」だけを定義する。
//
// kind:
//   opener … 開けた者 (床罠では先頭の解除役) を狙う
//   one    … 生存メンバーの誰か1人を狙う
//   multi  … hits 回、無作為に襲う
//   party  … 隊全体を巻き込む
//   pct    … 隊全体の最大HP割合ダメージ (生気を吸う)
//   mp     … 隊全体のMPを吸い、軽いダメージ
//   gold   … 所持金を失う
//   soul   … Soul を失う
//   teleport … 同じ階の別の場所へ飛ばされる (宝箱の中身は失われる)
//   alarm  … 怪物を呼び寄せ戦闘になる (horde: 群れを呼ぶ)
// ail/ailChance: 生き残った命中者への状態異常 (poison/paralyze/stone)
// dieChance: 即死の危険 (断頭刃・奈落など最深部の罠のみ)
export const TRAPS = [
  // ---- ランク1 (迷宮1〜): 古典的な小物 ----
  { id: "needle",     name: "毒針",         rank: 1, kind: "opener", mult: 0.8, ail: "poison",   ailChance: 0.6,  flavor: "錠前に仕込まれた針が深々と刺さった。" },
  { id: "bolt",       name: "仕込み矢",     rank: 1, kind: "one",    mult: 1.1,                                   flavor: "壁の隙間から矢が放たれた！" },
  { id: "numb",       name: "痺れ針",       rank: 1, kind: "opener", mult: 0.5, ail: "paralyze", ailChance: 0.5,  flavor: "青く濡れた針が指先を掠めた。" },
  { id: "rock",       name: "落石",         rank: 1, kind: "one",    mult: 1.6,                                   flavor: "頭上の石が崩れ落ちてきた！" },
  { id: "spark",      name: "火花弾",       rank: 1, kind: "party",  mult: 0.45,                                  flavor: "弾けた火花が隊を焼いた！" },
  { id: "gas",        name: "毒霧",         rank: 1, kind: "party",  mult: 0.35, ail: "poison",  ailChance: 0.35, flavor: "緑色の霧が噴き出した！" },
  { id: "alarm",      name: "警報",         rank: 1, kind: "alarm",                                               flavor: "甲高い鐘の音が迷宮に響き渡った！" },
  { id: "blade",      name: "仕込み刃",     rank: 1, kind: "opener", mult: 1.3,                                   flavor: "罅の奥から刃が跳ねた！" },
  // ---- ランク2 (迷宮11〜): 殺意の増した仕掛け ----
  { id: "bomb",       name: "爆裂弾",       rank: 2, kind: "party",  mult: 0.7,                                   flavor: "炸裂音と共に爆風が吹き荒れた！" },
  { id: "stunner",    name: "スタナー",     rank: 2, kind: "opener", mult: 0.4, ail: "paralyze", ailChance: 0.85, flavor: "閃光が瞬き、体の自由が奪われる！" },
  { id: "acid",       name: "酸の噴出",     rank: 2, kind: "one",    mult: 1.4, ail: "poison",   ailChance: 0.5,  flavor: "腐食性の酸が噴き上がった！" },
  { id: "frost",      name: "凍気の罠",     rank: 2, kind: "party",  mult: 0.5, ail: "paralyze", ailChance: 0.25, flavor: "凍てつく冷気が骨まで凍らせる！" },
  { id: "mageblast",  name: "メイジブラスター", rank: 2, kind: "mp", mult: 0.25,                                  flavor: "魔力を喰らう呪具が唸りを上げた！" },
  { id: "arrowstorm", name: "矢の嵐",       rank: 2, kind: "multi",  mult: 0.9, hits: 3,                          flavor: "無数の矢が四方から降り注ぐ！" },
  { id: "goldeater",  name: "黄金喰い",     rank: 2, kind: "gold",                                                flavor: "金貨だけを溶かす粘液が溢れ出た…" },
  { id: "soulleech",  name: "魂喰らい",     rank: 2, kind: "soul",                                                flavor: "蒼白い口が開き、集めた魂を啜った…" },
  // ---- ランク3 (迷宮21〜): 命に関わる大物 ----
  { id: "teleporter", name: "テレポーター", rank: 3, kind: "teleport",                                            flavor: "床の魔法陣が妖しく輝いた——" },
  { id: "guillotine", name: "断頭刃",       rank: 3, kind: "opener", mult: 2.4, dieChance: 0.10,                  flavor: "巨大な刃が鎌のように振り下ろされた！" },
  { id: "inferno",    name: "業火の檻",     rank: 3, kind: "party",  mult: 0.95,                                  flavor: "炎の檻が隊を呑み込んだ！" },
  { id: "stonemist",  name: "石化の霧",     rank: 3, kind: "one",    mult: 0.5, ail: "stone",    ailChance: 0.45, flavor: "灰色の霧が肌を石へ変えていく…" },
  { id: "horde",      name: "大警報",       rank: 3, kind: "alarm",  horde: true,                                 flavor: "迷宮全体に轟く咆哮——群れが来る！" },
  { id: "curse",      name: "呪詛の刻印",   rank: 3, kind: "party",  mult: 0.6, ail: "paralyze", ailChance: 0.3,  flavor: "黒い刻印が浮かび、生気を蝕む！" },
  { id: "lifedrain",  name: "生気吸引",     rank: 3, kind: "pct",    pct: 0.22,                                   flavor: "無形の何かが隊の生命を吸い上げた！" },
  { id: "abyss",      name: "奈落の顎",     rank: 3, kind: "one",    mult: 2.8, dieChance: 0.14,                  flavor: "床が裂け、闇の顎が開いた！" },
];

// 定義の健全性チェック (読み込み時に即死させてデグレを防ぐ)
if (TRAPS.length !== 24) throw new Error("TRAPS は24種でなければならない: " + TRAPS.length);
for (const r of [1, 2, 3]) {
  if (!TRAPS.some((t) => t.rank === r)) throw new Error("罠ランク" + r + "が空");
}
const _ids = new Set();
for (const t of TRAPS) {
  if (_ids.has(t.id)) throw new Error("罠IDが重複: " + t.id);
  _ids.add(t.id);
}

// 迷宮ランク (1-10) に応じて罠を1つ抽選する。
// 罠ランク <= min(3, 迷宮ランク) が出現対象 (= 迷宮21以降は全種)。
// 重み: 深い迷宮ほど高ランクの罠へ指数的に寄る (最深部では大半が致命的な罠)
export function pickTrap(dungeonRank, rng = Math.random) {
  const cap = Math.min(3, Math.max(1, dungeonRank || 1));
  const pool = TRAPS.filter((t) => t.rank <= cap);
  const w = pool.map((t) => Math.pow(1 + 0.35 * ((dungeonRank || 1) - 1), t.rank - 1));
  let total = 0;
  for (const x of w) total += x;
  let r = rng() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= w[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

// ===== 宝箱ランク (1-5) =====
// 高ランクの宝箱ほど中身が豪華だが、罠の解除難度が上がる (disarmNeed が参照)
export const CHEST_RANKS = [null, "朽ちた", "頑丈な", "銀細工の", "黄金の", "宝玉の"];

// depth01: 階の深さ 0-1 / dungeonRank: 迷宮ランク 1-10。
// 深い階・深い迷宮ほど高ランクの宝箱が出やすい
export function rollChestRank(depth01, dungeonRank, rng = Math.random) {
  const push = Math.max(0, depth01 || 0) + Math.min(1, ((dungeonRank || 1) - 1) / 9);
  const base = [50, 26, 13, 7, 4];
  const w = base.map((b, i) => b * Math.pow(1 + push, i * 0.7));
  let total = 0;
  for (const x of w) total += x;
  let r = rng() * total;
  for (let i = 0; i < w.length; i++) {
    r -= w[i];
    if (r <= 0) return i + 1;
  }
  return w.length;
}
