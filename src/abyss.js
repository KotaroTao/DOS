// ===== 無限迷宮 (ローグライク) — docs/infinite-labyrinth.md =====
// 第八章の結びで開く (game.js FEATURES.infinite)。本編の「奈落」(第五章〜の物語の舞台) とは別のもの。
// ・隊の人業は魂のひとかけを土くれの仮の器6体に移し (記憶だけが残る — 器の名は隊の名のまま)、入口に漂う「名もなき魂の欠片」を宿して Lv1 から降りる (本編の人業・魂は街に残る)
// ・5の倍数の階 = 風だまり (回収人・灯番) → 主 → 「帰る / 続ける」。帰還魔法陣は無い
// ・深さごとの推奨Lv は INF_LV の表だけで決まる (第二部の壁は乗せない)。育つ速さも表の傾きから自動で決まる
// ・帰れば、拾った魂 (＋1 の素材)・品 (商会の棚へ)・魂の残火を本編へ持ち帰る。最初に宿した魂・金貨・✦Soul は残らない
//
// このモジュールは純粋なデータ/ロジックのみ。演出・状態管理・描画は game.js と ui/infinite.js が担う。
// 内部の名前 (abyss・G.abyss) は旧仕様の奈落から引き継いでいる。画面の呼び名はすべて「無限迷宮」。

import { random } from "./rng.js";
import { lvMinutes, EXP_COST_K } from "./levelcurve.js";
import { SOUL_CLASSES, SOUL_KEYS } from "./souls.js";

export const INF_NAME = "無限迷宮";
export const INF_REST_EVERY = 5;   // 風だまり (回収人・灯番) と主が立つ周期 (階)
export const INF_HAZ_FROM = 6;     // 落ちる床・蝕む床が出始める階
export const INF_MIN_PER_FLOOR = 3; // 1階の長さの見込み (分)。育つ速さの計算に使う
export const INF_PARTY = 6;        // 仮の器の数
export const INF_RED_MAX = 100;    // 全滅の時に払う赤い魂の上限

// ===== 深さごとの推奨Lv (仮の表 — テストプレイで直す。直すのはここだけ) =====
// [階, 推奨Lv]。間は直線で結び、最後の行より深い階は1階ごとに +1
export const INF_LV = [[1, 1], [5, 6], [10, 12], [20, 24], [30, 35], [50, 55], [75, 78], [100, 100]];

// 階 f の推奨Lv (小数)
export function infLevel(f) {
  f = Math.max(1, f || 1);
  const T = INF_LV;
  if (f <= T[0][0]) return T[0][1];
  for (let i = 1; i < T.length; i++) {
    const [a, la] = T[i - 1], [b, lb] = T[i];
    if (f <= b) return la + (lb - la) * (f - a) / (b - a);
  }
  const [lf, ll] = T[T.length - 1];
  return ll + (f - lf);
}
// 階 f での1階あたりの推奨Lv の伸び
export function infLvSlope(f) {
  f = Math.max(1, f || 1);
  return Math.max(0.05, infLevel(f + 1) - infLevel(f));
}
// 育つ速さの倍率 = 本編でその Lv を1つ上げる分数 ÷ 無限迷宮でその Lv を1つ上げる分数 (1階の分数 ÷ 1階の伸び)。
// 戦闘の経験値と ✦Soul の入り方に掛ける。表を直せば、育ちの速さも一緒に合う (16-2章)。
// EXP_COST_K (本編の1Lv の費用を2倍にした上乗せ) も打ち消す: あれは本編の戦闘が設計の約2.75倍の速さ (157戦/時) だった分の
// 手直しで、無限迷宮の実測は設計どおり (2026-10-12 のテスト記録: 1〜5階で75戦/時・1階2.8戦)。打ち消さないと育ちが半分になり、
// 全部の敵を倒しても 5階で Lv2 (推奨Lv6) だった — 主に全滅した。打ち消すと、灯番で ✦ を注げば推奨Lv どおりに育つ
export function infGrowthMul(f) {
  const lv = infLevel(f);
  const perLv = INF_MIN_PER_FLOOR / infLvSlope(f);
  return Math.max(1, lvMinutes(lv) * EXP_COST_K / perLv);
}
// 通し試験を踏まえた強さ補正。本編の強さの素とは分け、Lv1開始の育成・補給に合わせる。
// 20階まで0.70、50階0.80、100階0.95。推奨Lvによる敵の成長は別に掛かる。
// 100階以降も1階につき0.006を足し、育ち切った隊にも奥ほど圧力が増す。
export function infEnemyMul(f) {
  f = Math.max(1, Number(f) || 1);
  if (f <= 20) return 0.70;
  if (f <= 50) return 0.70 + (f - 20) * (0.10 / 30);
  if (f <= 100) return 0.80 + (f - 50) * 0.003;
  return 0.95 + (f - 100) * 0.006;
}
// 全滅した階の赤い魂の費用 (1階ごとに1、上限100)
export function infRedCost(f) { return Math.max(1, Math.min(INF_RED_MAX, Math.floor(f || 1))); }
// その階が風だまり (主の階) か
export const isRestFloor = (f) => (f || 0) > 0 && f % INF_REST_EVERY === 0;

// ===== 深さで段を分けた掟 (5階ごとの区切りに1つ) =====
// 形は台帳の迷宮の掟 (world.js の trait) と同じ: game.js dungeonTrait() がこれを返すので、mods・開幕の効果・physOnly・
// alwaysAmbush などは本編の迷宮と同じ道筋で効く。from = その階から出る (浅い階は軽く、深くなるほど強い掟が混ざる)。
// boon = 恵み (呪いより稀)。最初の区切り (1〜5階) には掟が無い。id はセーブに残るので変えない
export const INF_RULES = [
  // --- 6階から (軽いもの) ---
  { id: "mist",     from: 6,  name: "濃い霧", sym: "🌫", accent: "#8a90a8", mods: { ambushMul: 1.6 }, lines: ["霧が濃く、奇襲を受けやすい。"] },
  { id: "pack",     from: 6,  name: "群れの匂い", sym: "Ψ", accent: "#c08a4a", mods: { packMin: 2 }, lines: ["魔物は2体以上で現れる。"] },
  { id: "hotwind",  from: 6,  name: "熱い風", sym: "♨", accent: "#d4682e", hpDrain: 0.04, say: "熱い風が肌を焼く", lines: ["戦闘の始めに、隊の HP が 4% 焼ける (HP1 は残る)。"] },
  { id: "soulfont", from: 6,  boon: true, name: "魂の湧泉", sym: "✧", accent: "#7fd0ff", mods: { soulMul: 1.3 }, lines: ["得られる ✦Soul が 1.3倍 になる。"] },
  { id: "goldvein", from: 6,  boon: true, name: "黄金の鉱脈", sym: "💰", accent: "#ffd84a", mods: { goldMul: 1.5 }, lines: ["得られる金貨が 1.5倍 になる。"] },
  { id: "hoard",    from: 6,  boon: true, name: "秘蔵の気配", sym: "▣", accent: "#e8c47a", mods: { chestRankUp: 1 }, lines: ["宝箱が 1ランク上等になる。"] },
  // --- 16階から ---
  { id: "enrage",   from: 16, name: "魔物の激昂", sym: "🔥", accent: "#d4504e", mods: { enemyMul: 1.15 }, lines: ["魔物の力が +15% される。"] },
  { id: "swarm",    from: 16, name: "湧き出る群れ", sym: "Ψ", accent: "#c08a4a", mods: { packMin: 3 }, lines: ["魔物は3体以上で現れる。"] },
  { id: "snare",    from: 16, name: "退路の封印", sym: "⛓", accent: "#9aa0ac", mods: { noFlee: true }, lines: ["戦闘から逃げられない。"] },
  { id: "coldwind", from: 16, name: "凍てつく風", sym: "❄", accent: "#9fd0e6", chill: 1, say: "凍てつく風が隊の足を鈍らせる", lines: ["戦闘の始めに、隊の全員の AGI が1段下がる (3ターン)。"] },
  { id: "soulwind", from: 16, name: "魂を吸う風", sym: "◌", accent: "#7f9fff", mpDrain: 0.05, say: "風が隊の魔力を吸い上げる", lines: ["戦闘の始めに、隊の MP が 5% 奪われる。"] },
  { id: "miasma",   from: 16, name: "腐れの瘴気", sym: "☣", accent: "#8a2be2", poisonStart: 0.25, say: "腐れの瘴気が隊を蝕む", lines: ["戦闘の始めに、隊の一人ひとりが 25% で毒に冒される。"] },
  { id: "bounty",   from: 16, boon: true, name: "恵みの風", sym: "✦", accent: "#9be88a", mods: { soulMul: 1.25, goldMul: 1.25 }, lines: ["✦Soul と金貨が 1.25倍 になる。"] },
  // --- 31階から ---
  { id: "bloodlust",from: 31, name: "血の渇き", sym: "🩸", accent: "#c0392b", mods: { enemyMul: 1.25 }, lines: ["魔物の力が +25% される。"] },
  { id: "bolt",     from: 31, name: "落雷", sym: "⚡", accent: "#b6a4e0", boltStart: 0.2, say: "雷が隊の一人を打つ", lines: ["戦闘の始めに、隊の一人へ雷が落ちる (最大HPの 20%。ブレス耐性で和らぐ)。"] },
  { id: "rise",     from: 31, name: "起き上がる濁り魂", sym: "☠", accent: "#8a7a5a", foeRise: 0.3, lines: ["倒れた魔物が、一度だけ HP 30% で起き上がる。"] },
  { id: "rally",    from: 31, name: "飢えた獣", sym: "⚔", accent: "#c9a05a", foeRally: 1, lines: ["戦闘の始めに、敵の攻撃が1段上がる (3ターン)。"] },
  { id: "fervor",   from: 31, name: "高まる戦意", sym: "✶", accent: "#e0a050", fervor: true, lines: ["2ターン目から、敵も味方も攻撃が1段ずつ上がっていく (3段まで)。"] },
  { id: "treasure", from: 31, boon: true, name: "眠る宝", sym: "▣", accent: "#e8c47a", mods: { chestRankUp: 2, lootBonusLv: 6 }, lines: ["宝箱が 2ランク上等になり、落ちている装備の質が上がる。"] },
  // --- 51階から (強い掟) ---
  { id: "physOnly", from: 51, name: "魔封じの風", sym: "🚫", accent: "#9a7ad0", physOnly: true, lines: ["物理技のほかの技 (呪文・回復・強化・弱体) を使えない。道具は使える。"] },
  { id: "ambush",   from: 51, name: "闇の待ち伏せ", sym: "🌘", accent: "#7a5ad0", alwaysAmbush: true, lines: ["主の戦いのほかは、どの戦闘も必ず敵が先に動く。"] },
  { id: "haste",    from: 51, name: "疾風の巣", sym: "≫", accent: "#9fe0c0", allHaste: true, lines: ["魔物はみな神速 (ターンの頭に動き、後半にもう一度動く)。主を除く。"] },
  { id: "feast",    from: 51, name: "魂喰らいの闇", sym: "◆", accent: "#6a4a8a", soulFeast: 2, lines: ["人業を倒した魔物は、攻撃が2段上がる (3ターン)。"] },
];
export const INF_RULE_MAP = Object.fromEntries(INF_RULES.map((r) => [r.id, r]));
// 階 f から始まる区切りの掟を1つ引く (rng は 0..1 を返す関数)。前の区切りと同じ掟は避ける。恵みは呪いの 1/3 の重み
export function rollInfRule(rng, f, prevId = null) {
  if (f <= INF_REST_EVERY) return null;
  let pool = INF_RULES.filter((r) => r.from <= f && r.id !== prevId);
  if (!pool.length) return null;
  // 深い階ほど、その深さで解禁された掟が出やすい (浅い掟ばかりにならない)
  const w = (r) => (r.boon ? 1 : 3) * (1 + (r.from >= 51 ? 0.6 : r.from >= 31 ? 0.3 : 0) * (f >= r.from ? 1 : 0));
  let total = 0; for (const r of pool) total += w(r);
  let x = (rng ? rng() : random()) * total;
  for (const r of pool) { x -= w(r); if (x < 0) return r.id; }
  return pool[pool.length - 1].id;
}

// ===== 始まりの魂の3択 =====
// 出るのはコモンとレアだけ (通常の入手の 70:20 を2種で割り直す = 7:2)。3つはすべて違う職業で、ほかの器が選んだ職業は出ない。
// 引いたレア度に残りが無ければ、もう一方から引く (コモン6職のうち5職が選ばれた後も、同じ職業を並べない)
const START_POOL = {
  common: SOUL_KEYS.filter((k) => SOUL_CLASSES[k].rarity === "common"),
  rare: SOUL_KEYS.filter((k) => SOUL_CLASSES[k].rarity === "rare"),
};
export const START_RARE_SHARE = 2 / 9;
export function rollStartSouls(taken = [], rng = random) {
  const out = [];
  const used = new Set(taken);
  for (let i = 0; i < 3; i++) {
    let rar = rng() < START_RARE_SHARE ? "rare" : "common";
    let cand = START_POOL[rar].filter((k) => !used.has(k) && !out.includes(k));
    if (!cand.length) { rar = rar === "rare" ? "common" : "rare"; cand = START_POOL[rar].filter((k) => !used.has(k) && !out.includes(k)); }
    if (!cand.length) break;
    out.push(cand[Math.floor(rng() * cand.length)]);
  }
  return out;
}

// 仮の器の名の控え (隊と控えが6人に満たない時だけ。ふだんは隊の人業の名 — game.js infVesselNames)
export const VESSEL_NAMES = ["一の器", "二の器", "三の器", "四の器", "五の器", "六の器"];

// 決定的乱数 (mulberry32)。掟の抽選などに使う
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
