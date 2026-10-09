// 抵抗値は0〜100。装備・敵・画面で共通の種類を使う。
export const RESIST_LABEL = { physResist: "物理", magResist: "魔法", poison: "毒", paralyze: "麻痺", sleep: "眠り", charm: "魅了", confuse: "混乱", stone: "石化", seal: "封印", flinch: "怯み", death: "即死" };
export const AIL_RESIST_KINDS = Object.keys(RESIST_LABEL).filter(k => !["physResist", "magResist"].includes(k));
export const clampResist = v => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
export const zeroResists = () => Object.fromEntries(Object.keys(RESIST_LABEL).map(k => [k, 0]));

// ===== 敵の体質 (効きやすい・効きにくい状態異常) =====
// 強さ (ランク・主/強敵) で上がる基礎値に、種族と特色ごとの「効きやすい / 効きにくい」を重ねる。
// 敵が強くなっても弱点の異常は効き続けるので、相手ごとに異常を使い分ける意味が出る (2026-10、ユーザーの指示)。
//   weak   = 効きやすい: 雑魚0 / 強敵 基礎×0.25 / 主 基礎×0.4
//   slight = やや効きやすい: 基礎×0.5
//   strong = 効きにくい: 基礎+40 (60〜95)
//   imm    = 効かない: 100
// 石化は隊が敵へ掛ける手段が無いので弱点にしない。即死は弱点にしない (強すぎる)。
export const MON_RESIST_WEAKABLE = ["poison", "paralyze", "sleep", "charm", "confuse", "seal", "flinch"];
const WEAKABLE = MON_RESIST_WEAKABLE;
// 種族ごとの体質。imm = 効かない (体のつくり上ありえない異常)
export const RACE_RESIST = {
  amorph:    { weak: ["poison"],   slight: ["confuse"],  strong: ["paralyze", "flinch"] }, // 体の芯が無く、しびれも怯みも散る。毒は全身に回る
  beast:     { weak: ["sleep"],    slight: ["charm"],    strong: ["confuse"] },            // 獣は眠りに落ちやすく、手なずけられる。本能で動くので惑わされない
  wing:      { weak: ["paralyze"], slight: ["confuse"],  strong: ["sleep"] },              // 羽がしびれれば落ちる。夜を飛ぶ者は眠らない
  avian:     { weak: ["paralyze"], slight: ["charm"],    strong: ["confuse"] },
  insect:    { weak: ["poison"],   slight: ["confuse"],  strong: ["charm", "sleep"] },     // 毒に弱い。心が無いので魅了も眠りも効かない
  plant:     { weak: ["poison"],   slight: ["flinch"],   strong: ["charm", "confuse"] },
  aquatic:   { weak: ["paralyze"], slight: ["sleep"],    strong: ["poison"] },             // 水の中の者はしびれに弱い
  reptile:   { weak: ["sleep"],    slight: ["flinch"],   strong: ["poison"] },             // 冷えた血は眠りを呼ぶ
  dragon:    { weak: ["sleep"],    slight: ["paralyze"], strong: ["charm", "confuse", "death"] }, // 竜は眠る。心は揺らがない
  humanoid:  { weak: ["charm"],    slight: ["confuse"],  strong: ["flinch"] },             // 人に近い心は惑わされやすい。戦い慣れて怯まない
  giant:     { weak: ["confuse"],  slight: ["sleep"],    strong: ["flinch"] },             // 鈍い頭は混乱しやすい。巨体は怯まない
  undead:    { weak: ["seal"],     slight: ["paralyze"], strong: ["charm"],  imm: ["poison", "sleep", "death"] }, // 呪いの力を封じれば止まる
  specter:   { weak: ["seal"],     slight: ["confuse"],  strong: ["flinch"], imm: ["poison", "sleep", "death", "paralyze", "stone"] },
  demon:     { weak: ["flinch"],   slight: ["paralyze"], strong: ["charm", "confuse", "death"] }, // 悪魔は心を読ませないが、ひるむ
  construct: { weak: ["paralyze"], slight: ["seal"],     strong: ["flinch", "confuse"], imm: ["poison", "sleep", "charm", "death"] }, // からくりはしびれると止まる
  armored:   { weak: ["confuse"],  slight: ["paralyze"], strong: ["flinch"], imm: ["poison", "sleep", "charm", "death"] }, // 空の鎧は命じる声が乱れると味方を斬る
  elemental: { weak: ["seal"],     slight: ["confuse"],  strong: ["poison", "death"] },   // 精霊は術そのもの。封じれば力を失う
};
// 特色から読む体質 (種族より優先)
function traitResist(m, put) {
  if (m.haste || m.swift) put("sleep", "weak");                   // 速い者ほど眠らせれば止まる
  if (m.evasive) put("paralyze", "weak");                         // しびれた者はかわせない
  if (m.ability === "charge") put("flinch", "weak");              // 力を溜める者はひるみやすい
  if (["breath", "spell"].includes(m.ability) || ["healer", "summoner"].includes(m.role)) put("seal", "slight"); // 封じれば息・術が止まる
  if ((m.magResist || 0) >= 75) put("seal", "strong");            // 魔に強い者は封じにくい
}
// id から決まる小さな揺らぎ (同じ種族でも1体ずつ違う)
function idHash(s) { let h = 2166136261; for (const c of String(s || "")) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

// 種類ごとの段 (base/slight/weak/strong/imm) を決める。値は monsterResists が付ける
export function resistTiers(m) {
  const t = Object.fromEntries(AIL_RESIST_KINDS.map(k => [k, "base"]));
  const race = RACE_RESIST[m.race] || {};
  // 揺らぎ: 種族の決めていない異常から1つを「効きにくい」に
  const free = WEAKABLE.filter(k => ![race.weak, race.slight, race.strong, race.imm].some(a => a && a.includes(k)));
  if (free.length) t[free[idHash(m.id) % free.length]] = "strong";
  for (const k of race.strong || []) t[k] = "strong";
  for (const k of race.slight || []) t[k] = "slight";
  for (const k of race.weak || []) t[k] = "weak";
  // 特色: 種族の段を上書きする (ただし「効きやすい」を「やや」へは下げない)
  const put = (k, tier) => { if (!(tier === "slight" && t[k] === "weak")) t[k] = tier; };
  traitResist(m, put);
  // 自分が使う異常には強い
  if (m.ability && m.ability in t) t[m.ability] = "strong";
  for (const k of race.imm || []) t[k] = "imm";
  if (["construct"].includes(m.race) && /石|岩|鉱|墓像|石像/.test((m.name || "") + (m.desc || ""))) t.stone = "imm";
  if (/stonegolem|rockgolem|mossgolem|gargoyle/.test(m.id || "")) t.stone = "imm";
  if (m.boss) { t.death = "imm"; t.flinch = "imm"; }
  // どの敵にも、隊が狙える「効きやすい」異常を最低1つ残す
  if (!m.metal && !WEAKABLE.some(k => t[k] === "weak")) {
    let cand = WEAKABLE.filter(k => t[k] === "slight");
    if (!cand.length) cand = WEAKABLE.filter(k => t[k] === "base");
    if (!cand.length) cand = WEAKABLE.filter(k => t[k] === "strong" && k !== m.ability);
    if (cand.length) t[cand[idHash(m.id + "w") % cand.length]] = "weak";
  }
  // 効きにくい異常も最低1つ (特色で上書きされて消えた時)
  if (!m.metal && !WEAKABLE.some(k => t[k] === "strong" || t[k] === "imm")) {
    const cand = WEAKABLE.filter(k => t[k] === "base");
    if (cand.length) t[cand[idHash(m.id + "s") % cand.length]] = "strong";
  }
  if (m.metal) for (const k of AIL_RESIST_KINDS) t[k] = "imm";
  return t;
}
// 強さの基礎値 (0〜60)
export const resistBase = m => Math.min(60, Math.max(0, (m.rank || 1) - 1) * 6 + (m.boss ? 40 : m.elite ? 25 : 0));
export function tierValue(tier, m) {
  const b = resistBase(m);
  if (tier === "imm") return 100;
  if (tier === "weak") return m.boss ? Math.round(b * 0.4) : m.elite ? Math.round(b * 0.25) : 0;
  if (tier === "slight") return Math.round(b * 0.5);
  if (tier === "strong") return Math.max(60, Math.min(95, b + 40));
  return b;
}
export function monsterResists(m) {
  const r = zeroResists();
  const tiers = resistTiers(m);
  for (const k of AIL_RESIST_KINDS) r[k] = tierValue(tiers[k], m);
  r.physResist = m.physResist || 0; r.magResist = m.magResist || 0;
  if (m.metal) r.magResist = 100;
  for (const [k, v] of Object.entries(m.resists || {})) {
    if (!(k in r) || !Number.isInteger(v) || v < 0 || v > 100) throw new Error(`抵抗値が不正: ${m.id} ${k}`);
    r[k] = v;
  }
  return r;
}
// 図鑑の表示用: 体質の段から読む。weak = 効きやすい / soft = やや効きやすい / strong = 効きにくい / immune = 効かない。
// 実際の値 (resists) が基礎値と変わらない段は出さない (ランク1の雑魚はどれも0)。石化は隊が掛けられないので出さない
export function resistLean(m, resists = m.resists) {
  const t = resistTiers(m), b = resistBase(m), out = { weak: [], soft: [], strong: [], immune: [] };
  const over = m.resistOverrides || {};
  for (const k of AIL_RESIST_KINDS) {
    const v = resists && resists[k];
    if (k === "stone" || v == null) continue;
    const tier = k in over ? (v >= 100 ? "imm" : v > b ? "strong" : v <= tierValue("weak", m) && v < b ? "weak" : v < b ? "slight" : "base") : t[k];
    if (tier === "imm" || v >= 100) out.immune.push(k);
    else if (tier === "strong" && v > b) out.strong.push(k);
    else if (tier === "weak" && v < b) out.weak.push(k);
    else if (tier === "slight" && v < b) out.soft.push(k);
  }
  return out;
}
