// 魂(Soul)と人業(Doll)のデータモデル
//
// 「人業 (Doll)」= 人型の器。頭・右手・左手・胴体・足の5部位があり、
// 各部位に「魂 (Soul)」を封じ込めることで性能が決まる。
// ・5部位中3部位以上を同じ職業の魂で揃えると、その職業の【基本スキル】
// ・5部位すべてを同じ職業で揃えると、さらに【上位スキル】が解放される。
// 魂にはレベルがあり、レベルが上がるほど高位のスキルを覚える。
//
// 既存の戦闘/装備/ステータス画面と互換を保つため、Doll は従来の
// メンバーオブジェクト(hp,maxhp,mp,atk,def,spd,spells,equip,items,alive...)を
// そのまま持ち、recalcDoll() が souls(parts) から base ステータスを算出する。

import { recalc } from "./items.js";

// 人業の5部位 (封印順 = 表示順)
export const PARTS = ["head", "rhand", "lhand", "body", "legs"];
export const PART_LABEL = { head: "頭", rhand: "右手", lhand: "左手", body: "胴体", legs: "足" };

// 魂の職業定義。stat は「1部位あたり / 魂レベル1」の寄与量。
// 5部位そろえた時に従来のプリメイド職とおおよそ釣り合うよう調整。
// basic: 3部位以上で解放 / advanced: 5部位で解放。
// 各職業の基本データ。stat は1部位/Lv1あたりの寄与。
// passive: 職業が発現したとき(職業ランク1以上)に効くステータス倍率。
// 武術系にも少量のMP(気力)を持たせ、技を使えるようにする。
export const SOUL_CLASSES = {
  fighter: {
    label: "戦士", color: "#d4504e", glow: "#ff7a72",
    stat: { hp: 7.0, mp: 0.7, atk: 2.4, def: 1.6, spd: 1.2 },
    passive: { atkMul: 1.18, label: "鬼神の膂力 (攻撃+18%)" },
  },
  knight: {
    label: "騎士", color: "#7c93c8", glow: "#a9c0ff",
    stat: { hp: 8.4, mp: 0.6, atk: 2.2, def: 2.4, spd: 0.8 },
    passive: { defMul: 1.20, label: "鉄壁の構え (防御+20%)" },
  },
  thief: {
    label: "盗賊", color: "#6fae46", glow: "#9be88a",
    stat: { hp: 4.4, mp: 0.8, atk: 1.8, def: 1.0, spd: 2.4 },
    passive: { spdMul: 1.25, critBonus: 0.12, label: "影駆け (素早さ+25%/会心+)" },
  },
  mage: {
    label: "魔術師", color: "#b06bff", glow: "#d3a8ff",
    stat: { hp: 3.6, mp: 2.8, atk: 1.0, def: 0.6, spd: 1.4 },
  },
  priest: {
    label: "僧侶", color: "#e8c47a", glow: "#ffe2a0",
    stat: { hp: 4.8, mp: 2.4, atk: 1.4, def: 1.0, spd: 1.0 },
  },
  bishop: {
    label: "魔導僧", color: "#5fb8d6", glow: "#aef0ff",
    stat: { hp: 4.4, mp: 3.2, atk: 1.2, def: 0.8, spd: 1.2 },
  },
};

// ===== 職業ランク (1〜5) =====
// 上位ランクほど強力なスキルを覚える。各ランクで skills(その段で追加習得する技)、
// passive(発動するパッシブフラグ)、name(称号) を定義。スキルは累積。
export const JOB_RANKS = {
  priest: [
    { name: "見習い僧侶", skills: ["DIOS"] },
    { name: "僧侶",       skills: ["DIOSALL"] },
    { name: "神官",       skills: ["REVIVE"] },
    { name: "聖職者",     skills: ["RESURRECT"] },
    { name: "聖者",       skills: [], flag: "blessing" }, // 全滅時HP1で1回だけ全員復活
  ],
  mage: [
    { name: "見習い魔術師", skills: ["HALITO"] },
    { name: "魔術師",       skills: ["KATINO"] },
    { name: "魔導師",       skills: ["MAHALITO"] },
    { name: "大魔導師",     skills: ["TILTOWAIT"] },
    { name: "大賢者",       skills: [], passive: { spdMul: 1.1 }, flag: "spellMaster" }, // 攻撃呪文+25%
  ],
  bishop: [
    { name: "見習い導師", skills: ["HALITO"] },
    { name: "魔導僧",     skills: ["DIOS"] },
    { name: "導師",       skills: ["MAHALITO"] },
    { name: "大導師",     skills: ["DIAL"] },
    { name: "賢者王",     skills: ["RESURRECT", "TILTOWAIT"], flag: "spellMaster" },
  ],
  fighter: [
    { name: "見習い戦士", skills: ["KYOUGEKI"] },
    { name: "戦士",       skills: ["MIDARE"] },
    { name: "剣士",       skills: [], passive: { critBonus: 0.10 } },
    { name: "剣豪",       skills: [], passive: { atkMul: 1.12 } },
    { name: "剣聖",       skills: [], passive: { atkMul: 1.15, critBonus: 0.12 } },
  ],
  knight: [
    { name: "見習い騎士", skills: [], passive: { defMul: 1.05 } },
    { name: "騎士",       skills: ["KYOUGEKI"] },
    { name: "重騎士",     skills: [], passive: { defMul: 1.10, atkMul: 1.06 } },
    { name: "騎士団長",   skills: ["MIDARE"] },
    { name: "聖堂騎士長", skills: [], passive: { defMul: 1.15 }, flag: "endure" }, // 致死を1回HP1で耐える
  ],
  thief: [
    { name: "見習い盗賊", skills: [], passive: { spdMul: 1.06 } },
    { name: "盗賊",       skills: ["KYOUGEKI"] },
    { name: "ローグ",     skills: [], passive: { spdMul: 1.10, critBonus: 0.08 } },
    { name: "アサシン",   skills: [], passive: { critBonus: 0.16 } },
    { name: "夜刃",       skills: ["MIDARE"], passive: { spdMul: 1.12, critBonus: 0.10 } },
  ],
};

// 魂ランク → 数値 (通常1 / 優秀2 / 偉大3 / 伝説4)
function soulRankNum(s) { return SOUL_RANKS[s.rank || "normal"].order + 1; }

// 人業の支配職の「職業ランク」を判定する。{ clsKey, rank(1-5), count } または null
export function jobRankOf(doll) {
  const dom = dominantClass(doll);
  if (!dom || dom.count < 3) return null;
  const J = dom.clsKey;
  if (!JOB_RANKS[J]) return null;
  // 支配職の各部位の魂ランク(1-4)
  const ranks = [];
  for (const p of PARTS) { const s = doll.parts[p]; if (s && s.clsKey === J) ranks.push(soulRankNum(s)); }
  // base = 「魂ランク>=K の部位が3つ以上」を満たす最大の K (1始まり)
  let base = 1;
  for (let K = 2; K <= 4; K++) if (ranks.filter((r) => r >= K).length >= 3) base = K;
  // 5部位すべて同職なら +1
  const all5 = ranks.length === 5;
  const rank = Math.max(1, Math.min(5, base + (all5 ? 1 : 0)));
  return { clsKey: J, rank, count: dom.count, all5 };
}

export const SOUL_KEYS = Object.keys(SOUL_CLASSES);

// ===== 混成職業 (ハイブリッド) =====
// 5部位を「ある職業3つ + 別の職業2つ」で組むと、特別な上位職が発現する。
// 発見要素: プレイヤーが自分で組み合わせを見つける楽しみ = ビルド探索の核。
// キーは "base+sub" (base=3部位の職業 / sub=2部位の職業)。
// spell: 追加で習得する技 / passive: ステータス倍率と表示名。
export const HYBRIDS = {
  "fighter+thief":  { name: "剣豪",     passive: { critBonus: 0.18, spdMul: 1.12, label: "剣豪の冴え (会心/速)" } },
  "fighter+mage":   { name: "魔法剣士", spell: "HALITO", passive: { atkMul: 1.12, label: "魔剣の理 (攻+)" } },
  "fighter+priest": { name: "聖戦士",   spell: "DIOS",   passive: { atkMul: 1.08, defMul: 1.08, label: "聖なる闘気" } },
  "fighter+knight": { name: "重戦士",   passive: { atkMul: 1.12, defMul: 1.10, label: "鉄血 (攻/防)" } },
  "knight+priest":  { name: "聖騎士",   spell: "DIAL",   passive: { defMul: 1.16, label: "守護の誓い (防++)" } },
  "knight+fighter": { name: "聖堂騎士", spell: "KYOUGEKI", passive: { defMul: 1.10, atkMul: 1.08, label: "城壁の構え" } },
  "knight+thief":   { name: "斥候騎士", passive: { defMul: 1.10, spdMul: 1.15, label: "軽装騎士 (防/速)" } },
  "mage+priest":    { name: "賢者",     spell: "DIAL",   passive: { label: "理を識る者 (全呪文)" } },
  "mage+thief":     { name: "魔盗賊",   spell: "MAHALITO", passive: { spdMul: 1.18, critBonus: 0.10, label: "影呪 (速/会心)" } },
  "mage+fighter":   { name: "戦技師",   spell: "KYOUGEKI", passive: { atkMul: 1.10, label: "武装魔導" } },
  "priest+mage":    { name: "司教",     spell: "MAHALITO", passive: { label: "二道の信徒 (攻呪+)" } },
  "priest+knight":  { name: "審問官",   spell: "MADIOS",  passive: { defMul: 1.10, label: "断罪の祈り" } },
  "priest+fighter": { name: "戦僧",     spell: "MIDARE",  passive: { atkMul: 1.12, label: "破邪の拳" } },
  "thief+mage":     { name: "呪術師",   spell: "HALITO",  passive: { spdMul: 1.18, label: "呪詛 (速++)" } },
  "thief+fighter":  { name: "野伏",     spell: "KYOUGEKI", passive: { critBonus: 0.14, atkMul: 1.06, label: "不意打ち" } },
  "thief+priest":   { name: "祓魔師",   spell: "DIOS",    passive: { spdMul: 1.12, critBonus: 0.08, label: "聖盗 (速/会心)" } },
  "bishop+mage":    { name: "大魔導",   spell: "MAHALITO", passive: { label: "深淵の知識 (攻呪++)" } },
  "bishop+priest":  { name: "大司教",   spell: "MADIOS",  passive: { label: "聖典の守護者" } },
};

// 部位タリーから混成職を判定。base(3) と sub(2) のときのみ成立し {key,name,...} を返す
export function findHybrid(counts) {
  let baseK = null;
  for (const k in counts) if (counts[k] === 3) baseK = k;
  if (!baseK) return null;
  let subK = null;
  for (const k in counts) if (k !== baseK && counts[k] === 2) subK = k;
  if (!subK) return null;
  const key = baseK + "+" + subK;
  const h = HYBRIDS[key];
  return h ? { key, baseK, subK, ...h } : null;
}

// ウィザードリィ風の能力値: 1部位あたりの寄与 (魂レベル/記憶で増加)
// STR筋力 / VIT生命 / AGI敏捷 / IQ知力 / PIE信仰 / LUK幸運
export const ATTR_KEYS = ["str", "vit", "agi", "iq", "pie", "luk"];
export const ATTR_LABEL = { str: "STR", vit: "VIT", agi: "AGI", iq: "IQ", pie: "PIE", luk: "LUK" };
export const ATTR_NAME = { str: "筋力", vit: "生命力", agi: "敏捷", iq: "知力", pie: "信仰", luk: "幸運" };
const SOUL_ATTR = {
  fighter: { str: 2.6, vit: 1.8, agi: 1.2, iq: 0.3, pie: 0.4, luk: 1.0 },
  knight:  { str: 2.0, vit: 2.6, agi: 0.7, iq: 0.4, pie: 0.8, luk: 0.9 },
  thief:   { str: 1.4, vit: 1.0, agi: 2.6, iq: 0.8, pie: 0.4, luk: 2.0 },
  mage:    { str: 0.5, vit: 0.8, agi: 1.2, iq: 2.8, pie: 0.8, luk: 1.0 },
  priest:  { str: 1.0, vit: 1.4, agi: 0.9, iq: 0.9, pie: 2.8, luk: 1.1 },
  bishop:  { str: 0.7, vit: 1.0, agi: 1.0, iq: 2.0, pie: 2.0, luk: 1.0 },
};
const ATTR_MAX = 18; // ウィザードリィ流の上限

let _soulUid = 0;

// ---- 魂のランク ----
// 上位ランクほどステータス係数が高く、初期レベル上限(cap)も高い。
// 優秀以上はダンジョンでのみ入手 (合成では作れない)。
export const SOUL_RANKS = {
  normal: { label: "",       mul: 1.0,  color: null,      order: 0, cap: 10 },
  fine:   { label: "優秀な", mul: 1.25, color: "#7fd0ff", order: 1, cap: 20 },
  great:  { label: "偉大な", mul: 1.6,  color: "#c08aff", order: 2, cap: 30 },
  legend: { label: "伝説の", mul: 2.2,  color: "#ffcf4a", order: 3, cap: 50 },
};
// 限界突破で到達できる上限 (初期cap + 40)
export function soulHardCap(s) { return SOUL_RANKS[s.rank || "normal"].cap + 40; }

// ランク抽選: legend 0.5% / great 1.7% / fine 10% / それ以外 normal
// bonus(0〜): 深い迷宮ほどレア魂が出やすくなる倍率加算
export function rollSoulRank(bonus = 0) {
  const m = 1 + Math.max(0, bonus);
  const pLegend = 0.005 * m;
  const pGreat = 0.017 * m;
  const pFine = Math.min(0.6, 0.10 * (1 + bonus * 0.5));
  const r = Math.random();
  if (r < pLegend) return "legend";
  if (r < pLegend + pGreat) return "great";
  if (r < pLegend + pGreat + pFine) return "fine";
  return "normal";
}

// 魂を生成。clsKey: 職業 / level / part: 対応部位 (省略時ランダム) / rank
export function makeSoul(clsKey, level = 1, part = null, rank = "normal") {
  if (!SOUL_CLASSES[clsKey]) return null;
  if (!part) part = PARTS[Math.floor(Math.random() * PARTS.length)];
  if (!SOUL_RANKS[rank]) rank = "normal";
  const cap = SOUL_RANKS[rank].cap;
  return { uid: ++_soulUid, clsKey, part, rank, level: Math.min(level, cap), cap };
}

// 旧セーブ等で cap 未設定の魂を補正する
export function ensureSoul(s) {
  if (!s) return s;
  if (s.cap == null) s.cap = SOUL_RANKS[s.rank || "normal"].cap;
  if (s.level == null) s.level = 1;
  if (s.level > s.cap) s.level = s.cap;
  return s;
}

// 魂の表示名。例: 「伝説の戦士の魂（頭）Lv3」
export function soulName(s) {
  const rank = SOUL_RANKS[s.rank || "normal"].label;
  const part = s.part ? `（${PART_LABEL[s.part]}）` : "";
  return `${rank}${SOUL_CLASSES[s.clsKey].label}の魂${part} Lv${s.level}`;
}

// レベル係数: 1部位の寄与は (1 + (level-1)*0.12) 倍
function lvlFactor(level) {
  return 1 + (level - 1) * 0.12;
}

// 魂1つの総合係数 (レベル × ランク)
function soulFactor(s) {
  return lvlFactor(s.level) * SOUL_RANKS[s.rank || "normal"].mul;
}

// 魂1つが持つステータス (人業のステータスはこれの合計)
export function soulStats(s) {
  const st = SOUL_CLASSES[s.clsKey].stat;
  const f = soulFactor(s);
  return {
    hp: Math.round(st.hp * f),
    mp: Math.round(st.mp * f),
    atk: Math.round(st.atk * f * 10) / 10,
    def: Math.round(st.def * f * 10) / 10,
    spd: Math.round(st.spd * f * 10) / 10,
  };
}

let _dollUid = 0;

// 空の人業を生成 (部位はすべて空)
export function makeDoll(name) {
  return {
    uid: ++_dollUid,
    name,
    isDoll: true,
    parts: { head: null, rhand: null, lhand: null, body: null, legs: null },
    // --- 以下は recalcDoll が埋める従来メンバー互換フィールド ---
    clsKey: "fighter", cls: "無職",
    level: 1, exp: 0,
    hp: 1, maxhp: 1, mp: 0, maxmp: 0,
    atk: 0, def: 0, spd: 0,
    base: { hp: 1, mp: 0, atk: 0, def: 0, spd: 0 },
    equip: { weapon: null, body: null, shield: null, head: null, hands: null, feet: null, acc1: null, acc2: null },
    items: [],
    ailment: null,
    ac: 10,
    spells: [],
    passives: [],
    alive: true, side: "party",
  };
}

// 封じている魂の配列 (空部位を除く)
export function dollSouls(doll) {
  return PARTS.map((p) => doll.parts[p]).filter(Boolean);
}

// 支配的な職業 { clsKey, count, maxLevel } を返す。魂ゼロなら null
export function dominantClass(doll) {
  const tally = {};
  for (const p of PARTS) {
    const s = doll.parts[p];
    if (!s) continue;
    tally[s.clsKey] = tally[s.clsKey] || { count: 0, maxLevel: 0 };
    tally[s.clsKey].count++;
    tally[s.clsKey].maxLevel = Math.max(tally[s.clsKey].maxLevel, s.level);
  }
  let best = null;
  for (const k in tally) {
    if (!best || tally[k].count > best.count) best = { clsKey: k, ...tally[k] };
  }
  return best;
}

// 人業の合計ステータス・職業・スキルを魂から再計算し、装備補正を適用
// 人業自体の初期ステータスは 0。宿した魂の合計値がそのまま人業の力になる。
export function recalcDoll(doll) {
  let hp = 0, mp = 0, atk = 0, def = 0, spd = 0;
  for (const p of PARTS) {
    const s = doll.parts[p];
    if (!s) continue;
    const st = soulStats(s);
    hp += st.hp; mp += st.mp; atk += st.atk; def += st.def; spd += st.spd;
  }

  const dom = dominantClass(doll);
  const spells = [];
  const passives = [];
  const flags = {};        // blessing / endure / spellMaster
  let crit = 0;
  let clsLabel = "空の器";
  let clsKey = "fighter";

  // 部位ごとの職業数を集計し、混成職(3+2)を判定
  const counts = {};
  for (const p of PARTS) { const s = doll.parts[p]; if (s) counts[s.clsKey] = (counts[s.clsKey] || 0) + 1; }
  const hybrid = findHybrid(counts);
  doll.hybrid = hybrid ? hybrid.name : null;

  // 職業ランク判定 (支配職が3部位以上で発現)
  const jr = jobRankOf(doll);
  doll.jobRank = jr ? jr.rank : 0;

  if (jr) {
    clsKey = jr.clsKey;
    const def0 = SOUL_CLASSES[clsKey];
    const ladder = JOB_RANKS[clsKey];
    clsLabel = ladder[jr.rank - 1].name;

    // 職業の素のパッシブ (発現でフル適用)
    if (def0.passive) {
      passives.push(def0.passive.label);
      if (def0.passive.atkMul) atk *= def0.passive.atkMul;
      if (def0.passive.defMul) def *= def0.passive.defMul;
      if (def0.passive.spdMul) spd *= def0.passive.spdMul;
      if (def0.passive.critBonus) crit += def0.passive.critBonus;
    }

    // 各ランク(1..jr.rank)のスキル・パッシブ・フラグを累積適用
    for (let k = 0; k < jr.rank; k++) {
      const rk = ladder[k];
      for (const sk of rk.skills) if (!spells.includes(sk)) spells.push(sk);
      if (rk.passive) {
        if (rk.passive.atkMul) atk *= rk.passive.atkMul;
        if (rk.passive.defMul) def *= rk.passive.defMul;
        if (rk.passive.spdMul) spd *= rk.passive.spdMul;
        if (rk.passive.critBonus) crit += rk.passive.critBonus;
      }
      if (rk.flag) flags[rk.flag] = true;
    }
    passives.push(`職業ランク${jr.rank}: ${clsLabel}`);

    // 混成職が発現していれば名称を上書きし、追加スキル・補正を付与
    if (hybrid) {
      clsLabel = hybrid.name;
      if (hybrid.spell && !spells.includes(hybrid.spell)) spells.push(hybrid.spell);
      const hp2 = hybrid.passive || {};
      if (hp2.label) passives.push(hp2.label);
      if (hp2.atkMul) atk *= hp2.atkMul;
      if (hp2.defMul) def *= hp2.defMul;
      if (hp2.spdMul) spd *= hp2.spdMul;
      if (hp2.critBonus) crit += hp2.critBonus;
    }
  }

  doll.clsKey = clsKey;
  doll.cls = clsLabel + (hybrid ? "(混成)" : jr ? `・ランク${jr.rank}` : "");
  doll.tier = jr ? (hybrid ? "hybrid" : "rank" + jr.rank) : "none";
  doll.dominant = dom;
  doll.blessing = !!flags.blessing;   // 聖者の祝福 (全滅時1回全員復活)
  doll.endure = !!flags.endure;       // 不屈 (致死を1回HP1で耐える)
  doll.spellMaster = !!flags.spellMaster; // 攻撃呪文ダメージ +25%
  // 人業の「レベル」= 封印した魂の平均レベル (表示用)
  const souls = dollSouls(doll);
  doll.level = souls.length ? Math.max(1, Math.round(souls.reduce((a, s) => a + s.level, 0) / souls.length)) : 1;

  doll.base = {
    // 器そのものは 0。魂の合計がそのまま器の力 (HPだけ最低1で即死を防ぐ)
    hp: Math.max(1, Math.round(hp)), mp: Math.round(mp),
    atk: Math.round(atk), def: Math.round(def), spd: Math.max(1, Math.round(spd)),
  };
  doll.spells = spells;
  doll.passives = passives;
  doll.critBonus = crit;

  // ウィザードリィ風の能力値を魂から算出 (ランク係数も反映)
  const attrs = { str: 0, vit: 0, agi: 0, iq: 0, pie: 0, luk: 0 };
  for (const p of PARTS) {
    const s = doll.parts[p];
    if (!s) continue;
    const w = SOUL_ATTR[s.clsKey];
    const f = (1 + (s.level - 1) * 0.06) * SOUL_RANKS[s.rank || "normal"].mul;
    for (const k of ATTR_KEYS) attrs[k] += w[k] * f;
  }
  for (const k of ATTR_KEYS) attrs[k] = Math.min(ATTR_MAX, Math.round(attrs[k]));
  doll.attrs = attrs;
  doll.luk = attrs.luk;
  doll.agi = attrs.agi;

  // 装備補正を base に重ねて最終ステータス確定 (items.js の recalc を流用)
  recalc(doll);
  return doll;
}

// 部位に魂を封じる。既に封印があれば外して stock へ戻す処理は呼び出し側で。
export function sealSoul(doll, part, soul) {
  doll.parts[part] = soul;
  recalcDoll(doll);
}

// 新規プレイ時の初期編成。3体の人業 + 予備の魂を返す。
// 器そのものは弱いが、魂を鍛え/組み替えて強くしていく導入。
export function createStartingRoster() {
  const dolls = [];

  const garo = makeDoll("ガロ");
  for (const p of PARTS) garo.parts[p] = makeSoul("fighter", 1, p);
  recalcDoll(garo);
  dolls.push(garo);

  const saria = makeDoll("サリア");
  saria.parts.head = makeSoul("mage", 1, "head");
  saria.parts.rhand = makeSoul("mage", 1, "rhand");
  saria.parts.body = makeSoul("mage", 1, "body");
  saria.parts.lhand = makeSoul("thief", 1, "lhand");
  saria.parts.legs = makeSoul("thief", 1, "legs");
  recalcDoll(saria);
  dolls.push(saria);

  const mina = makeDoll("ミナ");
  mina.parts.head = makeSoul("priest", 1, "head");
  mina.parts.rhand = makeSoul("priest", 1, "rhand");
  mina.parts.body = makeSoul("priest", 1, "body");
  mina.parts.lhand = makeSoul("knight", 1, "lhand");
  mina.parts.legs = makeSoul("knight", 1, "legs");
  recalcDoll(mina);
  dolls.push(mina);

  // 予備の魂 (組み替え・新しい人業づくり用)
  const souls = [
    makeSoul("fighter", 1, "rhand"), makeSoul("fighter", 1, "body"),
    makeSoul("knight", 1, "head"),
    makeSoul("thief", 1, "legs"), makeSoul("thief", 1, "lhand"),
    makeSoul("mage", 1, "head"),
    makeSoul("priest", 1, "body"),
  ];

  return { dolls, souls };
}

// 魂のドット絵 (部位スロット/一覧表示用)。職業色の宝珠。
export function soulSprite(clsKey) {
  const c = SOUL_CLASSES[clsKey] || SOUL_CLASSES.fighter;
  return {
    palette: { "0": "#0a0a12", "1": c.color, "2": c.glow, "3": "#ffffff" },
    art: [
      "....0000....",
      "..00222200..",
      ".02211112 20.",
      ".0211333110.",
      "021133331 20",
      "021113311120",
      "021111111120",
      "021111111120",
      ".0211111120.",
      ".0221111220.",
      "..00222200..",
      "....0000....",
    ],
  };
}
