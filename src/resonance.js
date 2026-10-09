// ===== 魂の共鳴 (第七章「毒沼」の結びで開く。FEATURES.resonance) =====
// 隊に特定の職の組み合わせがそろうと、隊全体に小さな効果が付く。発見式: 初めてそろえた時に名前が明かされ、
// 図鑑の「共鳴」に記される (まだの組は「？？？」と職の数だけ)。
// 判定は隊に出ている (生死を問わず編成中の) 人業のメイン魂の職だけ。サブ魂は数えない (隊を組み替える動機にするため)。
// このファイルはデータと判定だけ (game.js も ui も import しない)。効果の入口:
//   戦闘の中 (combat.js setResonance → _perkSum / perkCostCut / fleeChance / _ailRes):
//     deal / take / crit / evade / heal / cost  … jobkit の固有パッシブの fx と同じ語彙 (on / when も同じ。aura は要らない — 隊全体に効く)
//     flee    … 逃走の成功率 +v
//     ailRes  … 状態異常 (毒・麻痺・眠り・魅了・混乱) の付与率を −v (石化・即死は含めない)
//   戦闘の外 (game.js resonanceSum):
//     preempt … 先制の確率 +v (主・強敵の戦いでは先制・奇襲そのものが起きない)
//     ambush  … 奇襲される確率 ×(1 − v)
//     soul / gold … 迷宮で得る ✦Soul / 金貨 +v (町の依頼・報告は対象外)
// 複数の共鳴は同時に効き、同じ種類の効果は足し合う。種類ごとの合計は RESONANCE_CAP まで (条件付きの成分は、その時に効く分の合計を頭打ち)。
// id はセーブ (G.resonance.found) に残るので、改名・使い回し・削除をしない。並びを変えるのは構わない。
import { JOBKIT } from "./jobkit/index.js";

// 同じ種類の効果の合計の上限 (共鳴どうしの足し合いの頭打ち。職の固有パッシブ・装備の分とは別)
export const RESONANCE_CAP = {
  deal: 0.12, take: 0.12, crit: 0.06, evade: 0.05, heal: 0.20, cost: 0.20, flee: 0.15, ailRes: 0.15,
  preempt: 0.15, ambush: 0.40, soul: 0.10, gold: 0.15,
};
// 戦闘の中で combat.js が読む種類 / 戦闘の外で game.js が読む種類
export const RESONANCE_BATTLE_TYPES = ["deal", "take", "crit", "evade", "heal", "cost", "flee", "ailRes"];
export const RESONANCE_FIELD_TYPES = ["preempt", "ambush", "soul", "gold"];

// 組の表。jobs = 職の鍵 (2〜3)、fx = 効果の成分、text = 図鑑の一言 (どう響き合うか)
export const RESONANCES = [
  // ---- 2職の組 ----
  { id: "r01", name: "剣と祈り", jobs: ["fighter", "priest"], fx: [{ t: "take", v: 0.04 }],
    text: "最初の操霊師たちが組んだという、いちばん古い組。刃が前に立ち、祈りが背を支える。" },
  { id: "r02", name: "双つの盾", jobs: ["knight", "guardian"], fx: [{ t: "take", v: 0.06, on: "phys" }],
    text: "二つの盾が縁を重ねると、すき間がなくなる。打ちこまれる刃がそれだけ浅くなる。" },
  { id: "r03", name: "鍵と目利き", jobs: ["thief", "bishop"], fx: [{ t: "gold", v: 0.10 }],
    text: "開ける者と見る者。値打ちのある物を取りこぼさない。" },
  { id: "r04", name: "影と刃", jobs: ["samurai", "shadow"], fx: [{ t: "preempt", v: 0.10 }],
    text: "影が足音を消し、刃は抜く前から間合いにいる。敵が気づいた時には、もう遅い。" },
  { id: "r05", name: "癒しの誓い", jobs: ["priest", "paladin"], fx: [{ t: "heal", v: 0.10 }],
    text: "祈る者と、祈りを誓いにした者。重ねた祈りは、傷によく届く。" },
  { id: "r06", name: "獣道", jobs: ["hunter", "thief"], fx: [{ t: "ambush", v: 0.30 }],
    text: "狩人は風を読み、盗賊は物音を聞く。待ち伏せの気配を先に知る。" },
  { id: "r07", name: "血の宴", jobs: ["berserker", "asura"], fx: [{ t: "deal", v: 0.05, on: "phys" }],
    text: "猛る血は、隣の猛る血に応える。どちらが先に倒れるかを、競うように振るう。" },
  { id: "r08", name: "拳と経", jobs: ["monk", "ascetic"], fx: [{ t: "ailRes", v: 0.12 }],
    text: "鍛えた体と、鍛えた心。毒も眠りも、揺らがぬ者には入りにくい。" },
  { id: "r09", name: "呪いと屍", jobs: ["hexer", "necromancer"], fx: [{ t: "deal", v: 0.08, when: { tgtWeakened: true } }],
    text: "呪いで弱らせ、死の術で刈る。弱った獲物ほど、深く傷つく。" },
  { id: "r10", name: "巡礼の道", jobs: ["hermit", "archbishop"], fx: [{ t: "cost", v: 0.10, on: "heal" }],
    text: "長い道を歩く者は、祈りの息を惜しむすべを知っている。" },
  { id: "r11", name: "魔刃の型", jobs: ["spellblade", "battlemage"], fx: [{ t: "deal", v: 0.04 }],
    text: "刃に術を、術に刃を。二つの型が交わると、どちらの一撃も重くなる。" },
  { id: "r12", name: "盗人の仁義", jobs: ["arcthief", "brigand"], fx: [{ t: "evade", v: 0.03 }],
    text: "身軽な者どうし、逃げ道を譲り合う。隊の誰もが、半歩だけ身をかわしやすくなる。" },
  { id: "r13", name: "白と黒の騎士", jobs: ["knight", "darkknight"], fx: [{ t: "deal", v: 0.05, on: "phys", when: { front: true } }],
    text: "光の誓いと闇の誓い。並んで前に立つと、互いに負けまいと剣が冴える。" },
  { id: "r14", name: "破魔と護法", jobs: ["exorcist", "warden"], fx: [{ t: "take", v: 0.08, on: "spell" }, { t: "take", v: 0.08, on: "breath" }],
    text: "魔を払う者と、魔を防ぐ者。敵の呪文と吐く息が、隊に届く前に弱まる。" },
  { id: "r15", name: "秘術の書庫", jobs: ["arcanist", "archmage"], fx: [{ t: "deal", v: 0.06, on: "spell" }],
    text: "二人ぶんの知識が、一つの呪文を研ぎ澄ます。" },
  { id: "r16", name: "勇者と竜", jobs: ["hero", "dragonknight"], fx: [{ t: "crit", v: 0.04 }],
    text: "竜を討つ物語と、竜とともに戦う物語。二つの伝説が重なると、刃が急所を探しあてる。" },
  { id: "r17", name: "審判の炎", jobs: ["inquisitor", "crusader"], fx: [{ t: "deal", v: 0.06, when: { boss: true } }],
    text: "裁く者と、攻め入る者。大いなる敵の前でこそ、その炎は強く燃える。" },
  { id: "r18", name: "生と死の境", jobs: ["necromancer", "cardinal"], fx: [{ t: "take", v: 0.08, when: { allyDown: true } }],
    text: "死を操る者と、生を祈る者。仲間が倒れた時、二人は境に立って残る者を守る。" },
  { id: "r19", name: "山野の隠れ道", jobs: ["hermit", "ascetic"], fx: [{ t: "flee", v: 0.10 }],
    text: "山にこもる者は、山を下りる道もよく知っている。" },
  { id: "r20", name: "一番槍", jobs: ["fighter", "samurai"], fx: [{ t: "deal", v: 0.08, when: { round1: true } }],
    text: "どちらが先に斬りこむか。張り合う二人の最初の一撃は、いつもより重い。" },
  { id: "r21", name: "師と弟子", jobs: ["mage", "archmage"], fx: [{ t: "cost", v: 0.10, on: "atk" }],
    text: "弟子の呪文に、師が息を添える。攻める呪文の魔力が少なくてすむ。" },
  { id: "r22", name: "長柄と弓", jobs: ["hunter", "dragonknight"], fx: [{ t: "deal", v: 0.08, on: "phys", when: { back: true } }],
    text: "槍の間合いの外から、矢が届く。後ろに立つ者の一撃が冴える。" },
  // ---- 3職の組 (2職より少し強い) ----
  { id: "r23", name: "三賢の座", jobs: ["mage", "sage", "bishop"], fx: [{ t: "cost", v: 0.12 }],
    text: "学ぶ者・極めた者・見定める者。三人が座をなすと、どの技も少ない魔力で編める。" },
  { id: "r24", name: "聖なる三騎", jobs: ["crusader", "templar", "paladin"], fx: [{ t: "take", v: 0.05 }, { t: "deal", v: 0.03 }],
    text: "旗を掲げる騎士が三人そろえば、隊は小さな軍になる。" },
  { id: "r25", name: "聖座の祈り", jobs: ["cardinal", "chaplain", "archbishop"], fx: [{ t: "heal", v: 0.15 }],
    text: "高い座に就いた三人の祈りは、一つの聖歌のように重なる。" },
  { id: "r26", name: "不落の城", jobs: ["guardian", "templar", "warden"], fx: [{ t: "take", v: 0.08, on: "phys" }],
    text: "城壁と、神殿の柱と、結界。三つが重なった守りは、そう簡単には崩れない。" },
  { id: "r27", name: "荒ぶる魂", jobs: ["asura", "darkknight", "battlemage"], fx: [{ t: "deal", v: 0.12, when: { selfLow: 0.5 } }],
    text: "追いつめられた時ほど燃える魂が三つ。傷の深い者ほど、強く打つ。" },
  { id: "r28", name: "伝説の一行", jobs: ["hero", "mage", "priest"], fx: [{ t: "soul", v: 0.08 }],
    text: "勇者と魔導士と僧侶。昔語りのとおりの一行は、迷宮から多くの魂を持ち帰る。" },
  { id: "r29", name: "影の一座", jobs: ["shadow", "arcthief", "thief"], fx: [{ t: "preempt", v: 0.08 }, { t: "ambush", v: 0.20 }],
    text: "闇で稼ぐ三人が組めば、闇はもう敵の味方ではない。" },
  { id: "r30", name: "異端狩り", jobs: ["exorcist", "inquisitor", "hexer"], fx: [{ t: "deal", v: 0.10, when: { race: ["undead", "specter", "demon"] } }],
    text: "払う者・裁く者・呪いを知る者。不浄の者 (不死・幽鬼・悪魔) を、三方から追いつめる。" },
];
export const RESONANCE_MAP = Object.fromEntries(RESONANCES.map((r) => [r.id, r]));

// ---- 検証 (読み込み時に壊れた定義を弾く) ----
const FX_FIELDS = {
  deal: "v on when", take: "v on when", crit: "v on when", evade: "v when", heal: "v", cost: "v on",
  flee: "v", ailRes: "v", preempt: "v", ambush: "v", soul: "v", gold: "v",
};
(() => {
  const ids = new Set(), sets = new Set();
  for (const r of RESONANCES) {
    const bad = (m) => { throw new Error(`resonance ${r.id}: ${m}`); };
    if (!/^r\d{2,}$/.test(r.id) || ids.has(r.id)) bad("id が不正か重複");
    ids.add(r.id);
    if (!r.name || !r.text) bad("name/text が必要");
    if (!Array.isArray(r.jobs) || r.jobs.length < 2 || r.jobs.length > 3) bad("jobs は2〜3職");
    if (new Set(r.jobs).size !== r.jobs.length) bad("jobs に同じ職");
    for (const j of r.jobs) if (!JOBKIT[j] || j === "sera") bad(`職の鍵 ${j}`);
    const key = [...r.jobs].sort().join("+");
    if (sets.has(key)) bad("同じ組み合わせが他にある");
    sets.add(key);
    if (!Array.isArray(r.fx) || !r.fx.length) bad("fx が必要");
    for (const c of r.fx) {
      const allow = FX_FIELDS[c.t];
      if (!allow) bad(`未知の fx ${c.t}`);
      const ok = new Set(["t", ...allow.split(" ")]);
      for (const k in c) if (!ok.has(k)) bad(`fx ${c.t} に未知の項目 ${k}`);
      if (!(c.v > 0 && c.v <= RESONANCE_CAP[c.t])) bad(`fx ${c.t} の v は 0〜上限`);
    }
  }
  if (new Set(RESONANCES.map((r) => r.name)).size !== RESONANCES.length) throw new Error("resonance: 名前が重複");
})();

// ---- 判定 ----
// jobs = 隊のメイン魂の職の鍵 (配列か Set)。そろっている組を表の順で返す
export function activeResonances(jobs) {
  const have = jobs instanceof Set ? jobs : new Set(jobs || []);
  return RESONANCES.filter((r) => r.jobs.every((j) => have.has(j)));
}
// あと1職でそろう組 ({res, missing: 職の鍵, have: そろっている職の鍵の配列})
export function nearResonances(jobs) {
  const have = jobs instanceof Set ? jobs : new Set(jobs || []);
  const out = [];
  for (const r of RESONANCES) {
    const miss = r.jobs.filter((j) => !have.has(j));
    if (miss.length === 1) out.push({ res: r, missing: miss[0], have: r.jobs.filter((j) => have.has(j)) });
  }
  return out;
}
// 戦闘で combat.js に渡す成分 (jobkit の perksOf と同じ形 {c, lv, label, key})
export function resonanceFx(list) {
  const out = [];
  for (const r of list || []) for (const c of r.fx) if (RESONANCE_BATTLE_TYPES.includes(c.t)) out.push({ c, lv: 1, label: r.name, key: r.id });
  return out;
}
// 戦闘の外の種類 (preempt / ambush / soul / gold) の合計 (上限つき)
export function resonanceSum(list, type) {
  let v = 0;
  for (const r of list || []) for (const c of r.fx) if (c.t === type) v += c.v;
  return Math.min(v, RESONANCE_CAP[type] ?? v);
}

// ---- 表示 ----
const pct = (v) => `${Math.round(v * 1000) / 10}%`;
const ON_TEXT = { phys: "物理の", basic: "通常攻撃の", skill: "物理技の", spell: "攻撃呪文の", breath: "ブレスの" };
const ON_TAKE = { phys: "敵の物理で受ける", basic: "敵の通常攻撃で受ける", skill: "敵の物理技で受ける", spell: "敵の呪文で受ける", breath: "敵のブレスで受ける" };
const COST_ON = { phys: "物理技", atk: "攻撃呪文", heal: "回復の技", buff: "強化の技", debuff: "弱体の技", cure: "治療の技" };
function whenText(w) {
  if (!w) return "";
  if (w.tgtWeakened) return "状態異常・弱体の敵に";
  if (w.boss) return "迷宮の主に";
  if (w.allyDown) return "倒れた仲間がいる時、";
  if (w.round1) return "1ラウンド目、";
  if (w.front) return "前衛の";
  if (w.back) return "後衛の";
  if (w.selfLow != null) return `HP${Math.round(w.selfLow * 100)}%以下の者の`;
  if (w.race) return "不死・幽鬼・悪魔に";
  return "";
}
// 成分1つの説明 (例: 「物理の与ダメージ +5%」)
export function resonanceFxText(c) {
  const w = whenText(c.when), v = pct(c.v);
  switch (c.t) {
    case "deal": return `${w}${c.on ? ON_TEXT[c.on] || "" : ""}与ダメージ +${v}`;
    case "take": return `${w}${c.on ? ON_TAKE[c.on] || "" : "受ける"}ダメージ −${v}`;
    case "crit": return `${w}会心率 +${v}`;
    case "evade": return `敵の物理をかわす率 +${v}`;
    case "heal": return `回復量 +${v}`;
    case "cost": return `${c.on ? COST_ON[c.on] || "技" : "技・呪文"}の消費MP −${v}`;
    case "flee": return `逃走の成功率 +${v}`;
    case "ailRes": return `状態異常にかかる確率 −${v}`;
    case "preempt": return `先制の確率 +${v}`;
    case "ambush": return `奇襲される確率 −${v}`;
    case "soul": return `迷宮で得る ✦Soul +${v}`;
    case "gold": return `迷宮で得る金貨 +${v}`;
    default: return "";
  }
}
export function resonanceText(r) { return r ? r.fx.map(resonanceFxText).join("・") : ""; }
// いま効いている共鳴の合計 (種類ごと・上限つき) の一覧。条件付きの成分は別の行にする
export function resonanceTotals(list) {
  const rows = new Map();
  for (const r of list || []) for (const c of r.fx) {
    const k = JSON.stringify([c.t, c.on || "", c.when || null]);
    const row = rows.get(k) || { c: { ...c, v: 0 }, n: 0 };
    row.c.v += c.v; row.n++;
    rows.set(k, row);
  }
  return [...rows.values()].map(({ c, n }) => {
    const cap = RESONANCE_CAP[c.t];
    const capped = c.v > cap;
    return { text: resonanceFxText({ ...c, v: Math.min(c.v, cap) }) + (capped ? " (上限)" : ""), n };
  });
}
