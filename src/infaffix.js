// ===== 無限迷宮の追加の能力・特性 (docs/infinite-affixes.md — 2026-10-11 採用の137種 + 2026-10-15 の極「鏡鎧の」) =====
// 無限迷宮で拾った装備にだけ、ランダムな追加の能力・特性が付く (本編の迷宮で拾った品には付かない)。
//  ・品の実体に it.afx = [{ k: 種類のid, v: 振った値 }] を保存する。目録から写し直した後、品質の後・＋N の段の前に applyAffixes で掛け直す
//    (game.js resyncItem・items.js itemAtQuality)。値は「同じランクの標準品の点」B(R) の割合か、固定の幅
//  ・能力値・%補正・属攻/属防・抵抗値・ブレス耐性・追加効果 (onHit)・戦闘効果 (eff) は今の項目へ足す。
//    条件つき・発動するもの (✱) は jobkit の fx の成分として it.afxFx に入れ、items.js recalc が member.gearFx に集め、
//    combat.js perksOf が固有パッシブと同じように読む。階を降りた時などは it.afxMisc (game.js が読む)
//  ・値段は性能点に追加の点を足して付け直す (pricing.js の物差し)。名前の前に一番格の高い追加の名、後ろに格の印 (◇◆★)
// このモジュールは純粋なデータ/ロジックのみ (game.js・ui を import しない)。

import { random } from "./rng.js";
import { equipScore, priceForScore } from "./pricing.js";
import { MON_RACES } from "./dungeons/schema.js";

// 格: c 常 / u 稀 (◇) / r 秘 (◆) / x 極 (★)
export const AFX_TIERS = { c: { name: "常", mark: "", rank: 0 }, u: { name: "稀", mark: "◇", rank: 1 }, r: { name: "秘", mark: "◆", rank: 2 }, x: { name: "極", mark: "★", rank: 3 } };

// 同じランクの標準品の性能点の目安 B(R) (R10 ≈ 28 / R15 ≈ 49 / R20 ≈ 76)
export function afxBase(it) {
  const R = Math.max(1, Math.min(20, Math.ceil((it && it.lv || 1) / 10)));
  return Math.max(3, 1.2 * R + 0.13 * R * R);
}

// 部位: all = すべて / w = 武器 / a = 防具 (体・頭・足・小手・盾) / acc = 装飾 / 個別の部位 (shield / feet / hands)
const SLOT_GROUP = { weapon: ["all", "w"], body: ["all", "a", "body"], head: ["all", "a"], feet: ["all", "a", "feet"], hands: ["all", "a", "hands"], shield: ["all", "a", "shield"], acc: ["all", "acc"] };
const fitsSlot = (d, it) => (SLOT_GROUP[it.slot] || []).some((g) => d.slots.includes(g));

const STAT_W = { atk: 1, vit: 1, agi: 1, int: 0.7, pie: 0.7, luk: 0.6, hp: 0.15, mp: 0.25 };
const STAT_JA = { atk: "STR", vit: "VIT", agi: "AGI", int: "INT", pie: "PIE", luk: "LUK", hp: "HP", mp: "MP" };
const EL_JA = { fire: "火", water: "水", wind: "風", earth: "土", light: "光", dark: "闇" };
const RES_JA = { poison: "毒", paralyze: "麻痺", sleep: "眠り", charm: "魅了", confuse: "混乱", stone: "石化", seal: "封印", flinch: "怯み", death: "即死", physResist: "物理", magResist: "魔法" };
const RACE_JA = Object.fromEntries(MON_RACES.map((r) => [r.key, r.label]));
const pct = (v) => `${Math.round(v * 1000) / 10}%`;
const mulx = (v) => `×${Math.round(v * 100) / 100}`;
const pt = (v) => Math.max(1, Math.round(v));

export const AFX = [];
const AFX_MAP = {};
function def(o) {
  if (AFX_MAP[o.id]) throw new Error(`infaffix: id が重複: ${o.id}`);
  o.slots = o.slots || ["all"];
  AFX.push(o); AFX_MAP[o.id] = o;
}
// 値 v の決め方: kind "B" = B(R) × [lo, hi] の点 (能力値に直す) / "abs" = [lo, hi] の値そのまま
// pts(v, B) = 値段・上限に数える点 / apply(it, v, B) = 品へ足す / text(v, B) = 説明

// ---- A. 能力値ひとつ (常・全) ----
const ONE = [["A01", "頑丈な", "hp"], ["A02", "澄んだ", "mp"], ["A03", "力の", "atk"], ["A04", "堅い", "vit"], ["A05", "軽い", "agi"], ["A06", "賢い", "int"], ["A07", "敬虔な", "pie"], ["A08", "幸運の", "luk"]];
for (const [id, name, s] of ONE) def({ id, name, tier: "c", kind: "B", r: [0.15, 0.25],
  apply: (it, v) => { it[s] = (it[s] || 0) + pt(v / STAT_W[s]); }, text: (v) => `${STAT_JA[s]}+${pt(v / STAT_W[s])}` });
def({ id: "A09", name: "鋭い", tier: "u", kind: "abs", r: [0.01, 0.03], pts: (v) => v * 100,
  apply: (it, v) => { it.crit = Math.round(((it.crit || 0) + v) * 1000) / 1000; }, text: (v) => `会心率+${pct(v)}` });

// ---- B. 能力値ふたつ (稀・全、半分ずつ) ----
const TWO = [["B01", "剛健の", "atk", "vit"], ["B02", "疾風の", "atk", "agi"], ["B03", "博徒の", "atk", "luk"], ["B04", "城壁の", "vit", "hp"], ["B05", "猫の", "agi", "luk"], ["B06", "学徒の", "int", "mp"],
  ["B07", "祈り手の", "pie", "mp"], ["B08", "賢者の", "int", "pie"], ["B09", "影の", "agi", "int"], ["B10", "魔剣の", "atk", "int"], ["B11", "聖戦の", "atk", "pie"], ["B12", "器の", "hp", "mp"]];
for (const [id, name, a, b] of TWO) def({ id, name, tier: "u", kind: "B", r: [0.25, 0.35],
  apply: (it, v) => { it[a] = (it[a] || 0) + pt(v / 2 / STAT_W[a]); it[b] = (it[b] || 0) + pt(v / 2 / STAT_W[b]); },
  text: (v) => `${STAT_JA[a]}+${pt(v / 2 / STAT_W[a])} ${STAT_JA[b]}+${pt(v / 2 / STAT_W[b])}` });

// ---- C. 割合の補正 (秘・全) ----
const MUL = [["C01", "生命の", "hp"], ["C02", "魔力の", "mp"], ["C03", "怪力の", "atk"], ["C04", "鉄壁の", "vit"], ["C05", "迅速の", "agi"], ["C06", "叡智の", "int"], ["C07", "信心の", "pie"], ["C08", "天運の", "luk"]];
for (const [id, name, s] of MUL) def({ id, name, tier: "r", kind: "abs", r: [0.03, 0.06], pts: (v) => v * 60,
  apply: (it, v) => { it.mult = { ...(it.mult || {}) }; it.mult[s] = Math.round(((it.mult[s] || 0) + v) * 1000) / 1000; }, text: (v) => `${STAT_JA[s]}+${pct(v)}` });

// ---- D. 属性 (稀) ----
const ATK_EL = [["D01", "灼熱の", "fire"], ["D02", "流水の", "water"], ["D03", "烈風の", "wind"], ["D04", "大地の", "earth"], ["D05", "聖光の", "light"], ["D06", "暗黒の", "dark"]];
for (const [id, name, el] of ATK_EL) def({ id, name, tier: "u", kind: "fixB", r: [0.25, 0.25], slots: ["w", "acc"], group: "eAtk",
  apply: (it) => { if (!it.eAtk) it.eAtk = { el, lv: 1 }; }, text: () => `属攻 ${EL_JA[el]}◯` });
// 属防は攻撃の属性に勝つ属性でないと効かない: 火の攻撃 → 水 / 水 → 土 / 風 → 火 / 土 → 風 / 闇 → 光 / 光 → 闇
const DEF_EL = [["D07", "耐火の", "water", "火"], ["D08", "耐水の", "earth", "水"], ["D09", "耐風の", "fire", "風"], ["D10", "耐地の", "wind", "土"], ["D11", "退魔の", "light", "闇"], ["D12", "光除けの", "dark", "光"]];
for (const [id, name, el, from] of DEF_EL) def({ id, name, tier: "u", kind: "fixB", r: [0.2, 0.2], slots: ["a", "acc"], group: "eDef",
  apply: (it) => { if (!it.eDef) it.eDef = { el, lv: 1 }; }, text: () => `${from}の攻撃を和らげる (属防 ${EL_JA[el]}◯)` });

// ---- E. 抵抗 ----
const RES = [["E01", "毒除けの", "poison"], ["E02", "しびれ除けの", "paralyze"], ["E03", "眠らずの", "sleep"], ["E04", "惑わずの", "charm"], ["E05", "正気の", "confuse"], ["E06", "石除けの", "stone"], ["E07", "封じ除けの", "seal"], ["E08", "怯まずの", "flinch"]];
const addRes = (it, k, v) => { it.resists = { ...(it.resists || {}) }; it.resists[k] = Math.min(100, (it.resists[k] || 0) + Math.round(v)); };
for (const [id, name, k] of RES) def({ id, name, tier: "c", kind: "abs", r: [5, 15], slots: ["a", "acc"], pts: (v) => v * 0.25, apply: (it, v) => addRes(it, k, v), text: (v) => `${RES_JA[k]}の抵抗値+${Math.round(v)}` });
def({ id: "E09", name: "死除けの", tier: "u", kind: "abs", r: [5, 15], slots: ["a", "acc"], pts: (v) => v * 0.35, apply: (it, v) => addRes(it, "death", v), text: (v) => `即死の抵抗値+${Math.round(v)}` });
def({ id: "E10", name: "鋼の", tier: "r", kind: "abs", r: [2, 5], slots: ["a"], pts: (v) => v * 3, apply: (it, v) => addRes(it, "physResist", v), text: (v) => `物理の抵抗値+${Math.round(v)}` });
def({ id: "E11", name: "魔除けの", tier: "r", kind: "abs", r: [2, 5], slots: ["a"], pts: (v) => v * 3, apply: (it, v) => addRes(it, "magResist", v), text: (v) => `魔法の抵抗値+${Math.round(v)}` });
def({ id: "E12", name: "竜鱗の", tier: "u", kind: "abs", r: [0.03, 0.08], slots: ["a", "acc"], pts: (v) => v * 100,
  apply: (it, v) => { it.bRes = Math.round(((it.bRes || 0) + v) * 1000) / 1000; }, text: (v) => `ブレス耐性+${pct(v)}` });

// ---- F. 追加効果 (武) ----
const HIT = [["F01", "毒牙の", "poison", [0.05, 0.12], "毒"], ["F02", "雷撃の", "paralyze", [0.03, 0.08], "麻痺"], ["F03", "子守唄の", "sleep", [0.03, 0.08], "眠り"], ["F04", "惑わしの", "confuse", [0.03, 0.08], "混乱"], ["F05", "魅惑の", "charm", [0.03, 0.06], "魅了"]];
for (const [id, name, k, r, ja] of HIT) def({ id, name, tier: "u", kind: "abs", r, slots: ["w"], group: "onHit", pts: (v) => v * 60,
  apply: (it, v) => { if (!it.onHit) it.onHit = k === "poison" ? { k, chance: Math.round(v * 100) / 100, pct: 0.05 } : { k, chance: Math.round(v * 100) / 100 }; }, text: (v) => `物理が当たると ${pct(v)} で${ja}` });
def({ id: "F06", name: "封じの", tier: "r", kind: "abs", r: [0.03, 0.06], slots: ["w"], pts: (v) => v * 70,
  fx: (v) => [{ t: "hit", chance: v, ail: "seal", turns: 2 }], text: (v) => `物理が当たると ${pct(v)} で特技封じ` });
def({ id: "F07", name: "砕きの", tier: "r", kind: "abs", r: [0.04, 0.08], slots: ["w"], pts: (v) => v * 70,
  fx: (v) => [{ t: "hit", chance: v, ail: "flinch" }], text: (v) => `物理が当たると ${pct(v)} で怯ませる` });

// ---- G. 特効 (稀・武・飾) ----
const SLAY = ["粘体殺し", "獣殺し", "飛獣殺し", "鳥人殺し", "虫殺し", "草刈り", "水棲殺し", "爬虫殺し", "竜殺し", "亜人殺し", "巨人殺し", "不死祓い", "幽鬼祓い", "悪魔祓い", "機巧崩し", "鎧砕き", "精霊散らし"];
MON_RACES.forEach((r, i) => def({ id: `G${String(i + 1).padStart(2, "0")}`, name: `${SLAY[i] || r.label + "殺し"}の`, tier: "u", kind: "abs", r: [0.06, 0.15], slots: ["w", "acc"], pts: (v) => v * 50,
  fx: (v) => [{ t: "deal", v, when: { race: [r.key] } }], text: (v) => `${r.label}への与ダメ+${pct(v)}` }));

// ---- H. 守りの特効 (稀・防) ----
const WARD = [["H01", "墓守の", ["undead", "specter"]], ["H02", "狩人の", ["beast", "wing"]], ["H03", "竜騎の", ["dragon", "reptile"]], ["H04", "聖職の", ["demon", "elemental"]], ["H05", "職人の", ["construct", "armored"]], ["H06", "兵士の", ["humanoid", "giant"]]];
for (const [id, name, races] of WARD) def({ id, name, tier: "u", kind: "abs", r: [0.04, 0.10], slots: ["a"], pts: (v) => v * 70,
  fx: (v) => [{ t: "take", v, when: { race: races } }], text: (v) => `${races.map((x) => RACE_JA[x]).join("・")}からの被ダメ−${pct(v)}` });

// ---- I. 条件つき (秘) ----
const COND = [
  ["I01", "窮地の", ["w", "acc"], [0.08, 0.15], (v) => [{ t: "deal", v, when: { selfLow: 0.5 } }], (v) => `自分のHPが50%以下で与ダメ+${pct(v)}`],
  ["I02", "盤石の", ["a"], [0.05, 0.10], (v) => [{ t: "take", v, when: { selfHigh: 0.8 } }], (v) => `自分のHPが80%以上で被ダメ−${pct(v)}`],
  ["I03", "介錯の", ["w"], [0.10, 0.20], (v) => [{ t: "deal", v, when: { tgtLow: 0.3 } }], (v) => `HP30%以下の敵へ与ダメ+${pct(v)}`],
  ["I04", "先陣の", ["w", "acc"], [0.10, 0.20], (v) => [{ t: "deal", v, when: { round1: true } }], (v) => `1ターン目の与ダメ+${pct(v)}`],
  ["I05", "持久の", ["w", "acc"], [0.05, 0.10], (v) => [{ t: "deal", v, when: { roundGE: 3 } }], (v) => `3ターン目から与ダメ+${pct(v)}`],
  ["I06", "奇手の", ["w", "acc"], [0.08, 0.15], (v) => [{ t: "deal", v, when: { preempt: true } }], (v) => `先制した戦闘で与ダメ+${pct(v)}`],
  ["I07", "主狩りの", ["w", "acc"], [0.05, 0.10], (v) => [{ t: "deal", v, when: { strong: true } }], (v) => `主・強敵への与ダメ+${pct(v)}`],
  ["I08", "群れ払いの", ["w"], [0.05, 0.10], (v) => [{ t: "deal", v, when: { crowd: 3 } }], (v) => `敵が3体以上の時 与ダメ+${pct(v)}`],
  ["I09", "一騎打ちの", ["w", "acc"], [0.08, 0.15], (v) => [{ t: "deal", v, when: { lastFoe: true } }], (v) => `敵が残り1体の時 与ダメ+${pct(v)}`],
  ["I10", "弔いの", ["acc"], [0.10, 0.20], (v) => [{ t: "deal", v, when: { allyDown: true } }], (v) => `倒れた味方がいる時 与ダメ+${pct(v)}`],
  ["I11", "孤高の", ["a", "acc"], [0.15, 0.25], (v) => [{ t: "take", v, when: { alone: true } }], (v) => `生き残りが自分だけの時 被ダメ−${pct(v)}`],
  ["I12", "前衛の", ["a"], [0.04, 0.08], (v) => [{ t: "take", v, when: { front: true } }], (v) => `前列にいる時 被ダメ−${pct(v)}`],
  ["I13", "後衛の", ["w", "acc"], [0.05, 0.10], (v) => [{ t: "deal", v, on: "spell", when: { back: true } }], (v) => `後列にいる時 攻撃呪文の与ダメ+${pct(v)}`],
  ["I14", "追い打ちの", ["w"], [0.06, 0.12], (v) => [{ t: "deal", v, when: { tgtWeakened: true } }], (v) => `状態異常・怯み・弱体中の敵へ与ダメ+${pct(v)}`],
  ["I15", "弱点突きの", ["w", "acc"], [0.06, 0.12], (v) => [{ t: "deal", v, when: { tgtWeak: true } }], (v) => `弱点の属性で攻めた時 与ダメ+${pct(v)}`],
  ["I16", "構えの", ["shield", "a"], [0.10, 0.20], (v) => [{ t: "take", v, when: { defending: true } }], (v) => `防御中の被ダメ−${pct(v)}`],
  ["I17", "昂りの", ["acc"], [0.05, 0.10], (v) => [{ t: "deal", v, when: { buffed: true } }], (v) => `強化中の与ダメ+${pct(v)}`],
  ["I18", "満ちる", ["acc"], [0.05, 0.10], (v) => [{ t: "deal", v, on: "spell", when: { mpHigh: 0.5 } }], (v) => `MP50%以上で攻撃呪文の与ダメ+${pct(v)}`],
  ["I19", "見切りの", ["feet", "acc"], [0.02, 0.04], (v) => [{ t: "evade", v }], (v) => `敵の物理をかわす+${pct(v)}`],
  ["I20", "急所狙いの", ["w"], [0.05, 0.10], (v) => [{ t: "crit", v, when: { tgtAil: true } }], (v) => `状態異常の敵への会心+${pct(v)}`],
  ["I21", "詠唱の", ["acc", "shield"], [0.03, 0.06], (v) => [{ t: "cost", v, on: "atk" }], (v) => `攻撃呪文の消費MP−${pct(v)}`],
  ["I22", "癒し手の", ["acc", "shield"], [0.03, 0.06], (v) => [{ t: "cost", v, on: "heal" }], (v) => `回復の技の消費MP−${pct(v)}`],
  ["I23", "慈雨の", ["acc", "shield"], [0.05, 0.10], (v) => [{ t: "heal", v }], (v) => `回復量+${pct(v)}`],
  ["I24", "息避けの", ["a"], [0.08, 0.15], (v) => [{ t: "take", v, on: "breath" }], (v) => `ブレスの被ダメ−${pct(v)}`],
  ["I25", "呪文避けの", ["a"], [0.08, 0.15], (v) => [{ t: "take", v, on: "spell" }], (v) => `敵の全体呪文の被ダメ−${pct(v)}`],
];
for (const [id, name, slots, r, fx, text] of COND) def({ id, name, tier: "r", kind: "abs", r, slots, pts: (v) => v * (id === "I19" ? 200 : 60), fx, text });

// ---- J. 発動する特性 (1つの品に1つまで) ----
const JMARK = { group: "J" };
const effPut = (k, val) => (it) => { it.eff = { ...(it.eff || {}) }; it.eff[k] = val(it); };
def({ id: "J01", name: "守りの帳の", tier: "r", kind: "abs", r: [1, 1], slots: ["a"], ...JMARK, pts: () => 10,
  fx: () => [{ t: "start", wall: 1 }], text: () => "戦闘の始めに魔法壁1回 (受けるダメージ半減)" });
def({ id: "J02", name: "号令の", tier: "x", kind: "abs", r: [0.20, 0.35], slots: ["acc"], ...JMARK, pts: (v) => v * 50,
  fx: (v) => [{ t: "start", chance: v, party: true, buff: { atk: 1.25 }, dur: 2 }], text: (v) => `戦闘の始めに ${pct(v)} で味方全員の STR+1段 (2ターン)` });
def({ id: "J03", name: "討ち癒しの", tier: "r", kind: "abs", r: [0.02, 0.04], slots: ["w"], ...JMARK, pts: (v) => v * 250,
  fx: (v) => [{ t: "kill", hp: v }], text: (v) => `敵を倒すと HP ${pct(v)} 回復` });
def({ id: "J04", name: "討ち魔の", tier: "r", kind: "abs", r: [0.01, 0.02], slots: ["w"], ...JMARK, pts: (v) => v * 400,
  fx: (v) => [{ t: "kill", mp: v }], text: (v) => `敵を倒すと MP ${pct(v)} 回復` });
def({ id: "J05", name: "痛みの糧の", tier: "r", kind: "abs", r: [0.02, 0.03], slots: ["a"], ...JMARK, pts: (v) => v * 250,
  fx: (v) => [{ t: "hurt", chance: 0.25, mp: v }], text: (v) => `物理を受けると 25% で MP ${pct(v)} 回復` });
// やり返しは「受けたダメージの割合」ではなく持ち主の能力 × 係数 (2026-10 ユーザーの指示で統一。combat.js _retaliate)。
// 装備の効果はパッシブと同じく低め (使う技の反撃の構えは高め — combat.js stanceMulOf)
def({ id: "J06", name: "茨の", tier: "r", kind: "abs", r: [0.10, 0.20], slots: ["a"], ...JMARK, pts: (v) => v * 60,
  fx: (v) => [{ t: "hurt", ret: { stat: "vit", k: v } }], text: (v) => `物理を受けるたび VIT${mulx(v)} でやり返す` });
def({ id: "J07", name: "再生の", tier: "r", kind: "abs", r: [0.01, 0.02], slots: ["a", "acc"], ...JMARK, pts: (v) => v * 150, apply: (it, v) => effPut("regen", () => v)(it), text: (v) => `毎ターン HP ${pct(v)} 回復` });
def({ id: "J08", name: "吸血の", tier: "r", kind: "abs", r: [0.03, 0.06], slots: ["w"], ...JMARK, pts: (v) => v * 60, apply: (it, v) => effPut("lifesteal", () => v)(it), text: (v) => `与ダメの ${pct(v)} を吸う` });
def({ id: "J09", name: "報復の", tier: "r", kind: "abs", r: [0.08, 0.15], slots: ["w", "shield"], ...JMARK, pts: (v) => v * 50, apply: (it, v) => effPut("counter", () => v)(it), text: (v) => `物理を受けるたび 攻撃力${mulx(v)} でやり返す` });
def({ id: "J10", name: "一番手の", tier: "x", kind: "abs", r: [1, 1], slots: ["feet", "acc"], ...JMARK, pts: () => 15, apply: effPut("actFirst", () => true), text: () => "戦闘の1ターン目に一番手で動く" });
def({ id: "J11", name: "不屈の", tier: "x", kind: "abs", r: [0.1, 0.1], slots: ["acc"], ...JMARK, pts: () => 8, apply: (it, v) => effPut("autoRevive", () => v)(it), text: () => "1戦闘に1度、倒れずに HP 10% で踏みとどまる" });
def({ id: "J12", name: "守りの気の", tier: "r", kind: "abs", r: [0.03, 0.05], slots: ["a"], ...JMARK, pts: (v) => v * 100, apply: (it, v) => effPut("guard", () => v)(it), text: (v) => `被ダメ−${pct(v)}` });
def({ id: "J13", name: "節約の", tier: "r", kind: "abs", r: [0.05, 0.10], slots: ["acc", "w"], ...JMARK, pts: (v) => v * 60, apply: (it, v) => effPut("spellCostMul", () => Math.round((1 - v) * 100) / 100)(it), text: (v) => `消費MP−${pct(v)}` });
def({ id: "J14", name: "金運の", tier: "u", kind: "abs", r: [0.10, 0.20], slots: ["acc"], ...JMARK, pts: (v) => v * 30, apply: (it, v) => effPut("goldUp", () => v)(it), text: (v) => `金貨+${pct(v)}` });
def({ id: "J15", name: "魂導の", tier: "u", kind: "abs", r: [0.05, 0.10], slots: ["acc"], ...JMARK, pts: (v) => v * 30, apply: (it, v) => effPut("soulUp", () => v)(it), text: (v) => `✦Soul+${pct(v)}` });
def({ id: "J16", name: "錠外しの", tier: "u", kind: "abs", r: [0.05, 0.10], slots: ["acc", "hands"], ...JMARK, pts: (v) => v * 40, apply: (it, v) => effPut("disarmUp", () => v)(it), text: (v) => `罠を外す確率+${pct(v)}` });
def({ id: "J17", name: "灯の", tier: "u", kind: "abs", r: [0.03, 0.05], slots: ["acc"], ...JMARK, pts: (v) => v * 100, misc: (v) => ({ descHp: v }), text: (v) => `階を降りると HP ${pct(v)} 回復` });
def({ id: "J18", name: "風読みの", tier: "u", kind: "abs", r: [0.02, 0.03], slots: ["acc"], ...JMARK, pts: (v) => v * 150, misc: (v) => ({ descMp: v }), text: (v) => `階を降りると MP ${pct(v)} 回復` });
def({ id: "J19", name: "泥除けの", tier: "u", kind: "abs", r: [0.5, 0.5], slots: ["feet"], ...JMARK, pts: () => 4, misc: () => ({ mudGuard: true }), text: () => "蝕む床の痛手を半分に (毒消しの書きつけと重ならない)" });
def({ id: "J20", name: "鏡鎧の", tier: "x", kind: "abs", r: [0.4, 0.7], slots: ["body"], ...JMARK, pts: (v) => v * 20,
  fx: (v) => [{ t: "hurt", on: "magic", ret: { stat: "vit", k: v, magic: true } }], text: (v) => `ブレス・呪文を受けるたび VIT${mulx(v)} の魔法の一撃で返す` });

// ---- K. 諸刃 (大きな得と小さな損。点は得 − 損) ----
const EDGE = [["K01", "狂刃の", "atk", "vit"], ["K02", "砂時計の", "agi", "hp"], ["K03", "血盟の", "hp", "mp"], ["K04", "禁書の", "int", "pie"], ["K05", "苦行の", "pie", "luk"], ["K06", "鉛の", "vit", "agi"]];
for (const [id, name, up, down] of EDGE) def({ id, name, tier: "u", kind: "B", r: [0.3, 0.3], ptsMul: 0.3,
  apply: (it, v, B) => { it[up] = (it[up] || 0) + pt(B * 0.5 / STAT_W[up]); it[down] = (it[down] || 0) - pt(B * 0.2 / STAT_W[down]); },
  text: (v, B) => `${STAT_JA[up]}+${pt(B * 0.5 / STAT_W[up])} ${STAT_JA[down]}−${pt(B * 0.2 / STAT_W[down])}` });
def({ id: "K07", name: "博打の", tier: "r", kind: "abs", r: [0.04, 0.06], pts: (v) => v * 100 - 5,
  apply: (it, v) => { it.crit = Math.round(((it.crit || 0) + v) * 1000) / 1000; }, fx: () => [{ t: "take", v: -0.05 }], text: (v) => `会心率+${pct(v)}・被ダメ+5%` });
def({ id: "K08", name: "背水の", tier: "r", kind: "abs", r: [0.2, 0.2], slots: ["w", "acc"], pts: () => 8,
  apply: (it) => { it.mult = { ...(it.mult || {}) }; it.mult.hp = Math.round(((it.mult.hp || 0) - 0.05) * 1000) / 1000; }, fx: (v) => [{ t: "deal", v, when: { selfLow: 0.5 } }], text: (v) => `HP50%以下で与ダメ+${pct(v)}・最大HP−5%` });
def({ id: "K09", name: "呪われた宝の", tier: "r", kind: "abs", r: [0.3, 0.3], slots: ["acc"], pts: () => 5,
  apply: (it, v) => effPut("goldUp", () => v)(it), fx: () => [{ t: "take", v: -0.05 }], text: (v) => `金貨+${pct(v)}・被ダメ+5%` });
def({ id: "K10", name: "生き急ぎの", tier: "r", kind: "abs", r: [0.3, 0.3], slots: ["w", "acc"], pts: () => 8,
  fx: (v) => [{ t: "deal", v, when: { round1: true } }, { t: "deal", v: -0.1, when: { roundGE: 3 } }], text: (v) => `1ターン目の与ダメ+${pct(v)}・3ターン目から−10%` });

export const AFX_COUNT = AFX.length;
export function afxDef(k) { return AFX_MAP[k] || null; }

// 1つの追加の点 (値段・品ごとの上限に数える)
function afxPts(d, v, B) {
  if (d.kind === "B") return v * (d.ptsMul || 1);
  if (d.kind === "fixB") return B * d.r[0];
  return d.pts ? d.pts(v, B) : 0;
}

// ===== 深さで変わる付く数と格の出やすさ (docs 1-3) =====
const DEPTH_ROWS = [
  { to: 20, n: 1, extra: 0.25, w: { c: 85, u: 15, r: 0, x: 0 } },
  { to: 40, n: 1, extra: 0.50, w: { c: 70, u: 25, r: 5, x: 0 } },
  // 極は付呪で誰にでも書けるので、拾える割合はごく低く (2026-10-15 ユーザーの指示。以前は 1 / 3 / 5 / 7)
  { to: 60, n: 2, extra: 0.30, w: { c: 55, u: 32, r: 12, x: 0.05 } },
  { to: 80, n: 2, extra: 0.60, w: { c: 45, u: 35, r: 17, x: 0.1 } },
  { to: 100, n: 3, extra: 0.30, w: { c: 35, u: 38, r: 22, x: 0.25 } },
  { to: Infinity, n: 3, extra: 0.60, w: { c: 30, u: 38, r: 25, x: 0.4 } },
];
const depthRow = (f) => DEPTH_ROWS.find((r) => (f || 1) <= r.to);
const AFX_SLOTS = new Set(["weapon", "shield", "body", "head", "hands", "feet", "acc"]);

// 品 it (目録から作った直後) に、深さ floor の追加を振る。it.afx = [{k, v}] を返す (付けなければ null)
export function rollAffixes(it, floor, rng = random) {
  if (!it || !AFX_SLOTS.has(it.slot) || it.cursed || it.price === 0) return null;
  const row = depthRow(floor);
  const n = row.n + (rng() < row.extra ? 1 : 0);
  const B = afxBase(it);
  const deep = Math.min(1, (floor || 1) / 100);
  for (let tries = 0; tries < 12; tries++) {
    const out = [];
    let sum = 0, j = false, x = false;
    const groups = new Set();
    for (let i = 0; i < n; i++) {
      // 格を引く
      let tot = 0; for (const t in row.w) tot += row.w[t];
      let pick = rng() * tot, tier = "c";
      for (const t in row.w) { pick -= row.w[t]; if (pick < 0) { tier = t; break; } }
      if (tier === "x" && x) tier = "r";
      let cand = AFX.filter((d) => d.tier === tier && fitsSlot(d, it) && !out.some((o) => o.k === d.id)
        && !(d.group && groups.has(d.group)) && !(d.group === "J" && j)
        && !(d.group === "eAtk" && it.eAtk) && !(d.group === "eDef" && it.eDef) && !(d.group === "onHit" && it.onHit));
      if (!cand.length) cand = AFX.filter((d) => d.tier === "c" && fitsSlot(d, it) && !out.some((o) => o.k === d.id));
      if (!cand.length) continue;
      const d = cand[Math.floor(rng() * cand.length)];
      // 幅の中の値: 深い階ほど上の方が出やすい
      const r = Math.min(1, rng() * (1 - 0.4 * deep) + 0.4 * deep * rng() + 0.3 * deep * rng());
      const lo = d.kind === "B" ? d.r[0] * B : d.r[0], hi = d.kind === "B" ? d.r[1] * B : d.r[1];
      const v = d.kind === "B" ? lo + (hi - lo) * r : Math.round((lo + (hi - lo) * r) * 1000) / 1000;
      out.push({ k: d.id, v });
      if (d.kind === "B" || d.kind === "fixB") sum += afxPts(d, v, B);
      if (d.group) groups.add(d.group);
      if (d.group === "J") j = true;
      if (d.tier === "x") x = true;
    }
    // 1つの品の能力値の追加の合計は B(R) × 1.0 まで (超えたら引き直す)
    if (sum <= B * 1.0 + 1e-6) return out.length ? out : null;
  }
  return null;
}

// 目録から写し直した品 it に、追加 it.afx を掛ける (品質の後・＋N の段の前に1回だけ)。名前の前置き・印・説明・値段も付け直す
export function applyAffixes(it) {
  delete it.afxFx; delete it.afxMisc; delete it.afxPre; delete it.afxMark; delete it.afxText; delete it.afxTier;
  if (!it || !Array.isArray(it.afx) || !it.afx.length) return it;
  const B = afxBase(it);
  const basePts = equipScore(it);
  let pts = 0, top = null;
  const fx = [], misc = {}, text = [];
  for (const a of it.afx) {
    const d = AFX_MAP[a.k];
    if (!d) continue;
    if (d.apply) d.apply(it, a.v, B);
    if (d.fx) for (const c of d.fx(a.v, B)) fx.push({ c, label: d.name.replace(/の$/, "") });
    if (d.misc) Object.assign(misc, d.misc(a.v, B));
    pts += afxPts(d, a.v, B);
    text.push({ k: d.id, name: d.name, tier: d.tier, text: d.text(a.v, B) });
    if (!top || AFX_TIERS[d.tier].rank > AFX_TIERS[top.tier].rank) top = d;
  }
  if (fx.length) it.afxFx = fx;
  if (Object.keys(misc).length) it.afxMisc = misc;
  it.afxText = text;
  if (top) { it.afxPre = top.name; it.afxMark = AFX_TIERS[top.tier].mark; it.afxTier = top.tier; }
  // 値段: 性能点に追加の点を足す (元の値段 0 の品は付け直さない)
  if (it.price > 0) {
    const p = priceForScore(it.slot, Math.max(0, basePts) + Math.max(0, pts));
    if (p != null) it.price = Math.max(it.price, p);
  }
  it.afxPts = Math.round(pts * 10) / 10;
  return it;
}
// 追加の組の強さ (商会の棚で強い方を選んでおく)
export function affixPower(it, afx) {
  if (!afx || !afx.length) return 0;
  const B = afxBase(it);
  return afx.reduce((s, a) => { const d = AFX_MAP[a.k]; return s + (d ? afxPts(d, a.v, B) : 0); }, 0);
}
// 組の説明 (品を作らずに)
export function affixLines(it, afx) {
  const B = afxBase(it);
  return (afx || []).map((a) => { const d = AFX_MAP[a.k]; return d ? `${AFX_TIERS[d.tier].mark}${d.name.replace(/の$/, "")} ― ${d.text(a.v, B)}` : ""; }).filter(Boolean);
}

// 隊の1人が装備全体から受ける上限 (種類ごと、docs 1-4): 与ダメ +40% / 被ダメ −30% / 会心 +10% / 回避 +6% / 消費MP −20% / 回復量 +20%
export const GEAR_FX_CAP = { deal: 0.40, take: 0.30, crit: 0.10, evade: 0.06, cost: 0.20, heal: 0.20 };
// 装備の fx を集めて上限で切る。返り値は combat.js perksOf の形 [{c, lv:1, label, key}]
export function gearPerks(list) {
  const sums = {};
  for (const { c } of list) if (GEAR_FX_CAP[c.t] != null && c.v > 0) sums[c.t] = (sums[c.t] || 0) + c.v;
  return list.map(({ c, label }, i) => {
    const cap = GEAR_FX_CAP[c.t];
    const k = cap != null && c.v > 0 && sums[c.t] > cap ? cap / sums[c.t] : 1;
    return { c: k === 1 ? c : { ...c, v: Math.round(c.v * k * 1000) / 1000 }, lv: 1, label, key: `afx${i}` };
  });
}

// ===== 付呪 (第十一章の結び — docs/infinite-affixes.md 6章、2026-10-15 ユーザーの決定) =====
// 無限迷宮で拾った品の追加の能力・特性を1つ選んで「特性の巻物」に写し取り (元の品は消える)、任意の装備へ書き込む。
//  ・書ける数はレア度で決まる (コモン1 / アンコモン2 / レア3 / スーパーレア4 / レジェンド5)。格の上限は無い
//  ・能力値の追加 (kind B・fixB) の合計は、書き込む品の B(R) × ENCHANT_CAP[レア度] まで (LR の 1.0 = 無限迷宮で拾う品と同じ天井)
//  ・同じ種類は1つ、属攻・属防・追加効果・発動する特性 (J) はそれぞれ1つ、極は1つの品に1つまで (拾う品と同じ決まり)。
//    隊の別々の人業が同じ極を付けるのはよい
//  ・巻物の値: 能力値の追加 (kind B) は B(R) に対する割合で持ち、書き込む品のランクで値を出し直す。それ以外 (割合・固定の値) はそのまま
export const ENCHANT_SLOTS = { c: 1, uc: 2, r: 3, sr: 4, lr: 5 };
export const ENCHANT_CAP = { c: 0.35, uc: 0.55, r: 0.75, sr: 0.9, lr: 1.0 };
// 書き込みの費用 = 書き込む品の買値 × 格の倍率 × 枠の倍率 (1枠目1・2枠目1.5・3枠目2… — game.js enchantCost)
export const ENCHANT_TIER_COST = { c: 0.5, u: 1, r: 2, x: 4 };

// 品 it の追加 a ({k, v}) を写し取った巻物 ({k, v} か、kind B なら {k, r})
export function pageFromAffix(it, a) {
  const d = AFX_MAP[a && a.k];
  if (!d) return null;
  const src = { from: it.name, lv: it.lv || 1 };
  if (d.kind === "B") return { k: d.id, r: Math.round((a.v / afxBase(it)) * 10000) / 10000, ...src };
  return { k: d.id, v: a.v, ...src };
}
// 巻物を品 it に書いた時の値
export function pageValue(page, it) {
  const d = AFX_MAP[page && page.k];
  if (!d) return 0;
  if (d.kind === "B") return Math.round((page.r != null ? page.r : 0) * afxBase(it) * 100) / 100;
  return page.v != null ? page.v : d.r[0];
}
export function pageDef(page) { return AFX_MAP[page && page.k] || null; }
// 巻物の特性をその部位の品に書けるか (書く先の一覧に出すか)
export function pageFitsSlot(page, it) { const d = pageDef(page); return !!(d && it && fitsSlot(d, it)); }
// 巻物の説明 (品 it に書いた時の値で。it が無ければ写し取った品のランクでの値)
export function pageText(page, it = null) {
  const d = pageDef(page);
  if (!d) return "";
  if (it) { const B = afxBase(it); return d.text(pageValue(page, it), B); }
  if (d.kind === "B") { const ref = { lv: page.lv || 1 }; const B = afxBase(ref); return d.text(pageValue(page, ref), B); }
  return d.text(page.v != null ? page.v : d.r[0], 1);
}
// 品の「能力値の追加」の点 (容量に数える分)
function capPts(it, afx) {
  const B = afxBase(it);
  return (afx || []).reduce((s, a) => { const d = AFX_MAP[a.k]; return s + (d && (d.kind === "B" || d.kind === "fixB") ? afxPts(d, a.v, B) : 0); }, 0);
}
// 品の書き込みの枠と容量: { slots, used, cap, capUsed }。rk = レア度 (c/uc/r/sr/lr)
export function enchantRoom(it, rk) {
  const B = afxBase(it);
  return { slots: ENCHANT_SLOTS[rk] || 1, used: (it.afx || []).length, cap: Math.round(B * (ENCHANT_CAP[rk] || ENCHANT_CAP.c) * 10) / 10, capUsed: Math.round(capPts(it, it.afx) * 10) / 10 };
}
// 巻物を品 it に書けない理由 (書ければ null)。tmpl = 目録の品 (生まれつきの属攻・属防・追加効果を見る)
export function enchantBlock(it, page, rk, tmpl = null) {
  const d = pageDef(page);
  if (!d) return "読めない巻物";
  if (!it || !AFX_SLOTS.has(it.slot)) return "装備品にだけ書ける";
  if (!fitsSlot(d, it)) return "この部位には書けない特性";
  const afx = it.afx || [];
  const room = enchantRoom(it, rk);
  if (afx.length >= room.slots) return `書ける数 ${room.slots}つがいっぱい`;
  if (afx.some((a) => a.k === d.id)) return "同じ特性がもう書いてある";
  const has = (fn) => afx.some((a) => { const x = AFX_MAP[a.k]; return x && fn(x); });
  if (d.tier === "x" && has((x) => x.tier === "x")) return "極は1つの品に1つまで";
  if (d.group && has((x) => x.group === d.group)) return d.group === "J" ? "発動する特性は1つの品に1つまで" : d.group === "eAtk" ? "属攻は1つまで" : d.group === "eDef" ? "属防は1つまで" : "追加効果は1つまで";
  const base = tmpl || {};
  if (d.group === "eAtk" && base.eAtk) return "この品には属攻が元からある";
  if (d.group === "eDef" && base.eDef) return "この品には属防が元からある";
  if (d.group === "onHit" && base.onHit) return "この品には追加効果が元からある";
  if (d.kind === "B" || d.kind === "fixB") {
    const add = afxPts(d, pageValue(page, it), afxBase(it));
    if (room.capUsed + add > room.cap + 1e-6) return `能力値の容量を超える (${Math.round((room.capUsed + add) * 10) / 10} / ${room.cap})`;
  }
  return null;
}

// 検査 (読み込み時): 138種そろっているか (2026-10-15 に極「鏡鎧の」を足した)
if (AFX.length !== 138) throw new Error(`infaffix: 追加の種類は138のはず (いま ${AFX.length})`);
