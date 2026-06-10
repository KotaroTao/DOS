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
// 各スキルは封じた同職魂の「最高レベル」が lvl 以上で習得。
export const SOUL_CLASSES = {
  fighter: {
    label: "戦士", color: "#d4504e", glow: "#ff7a72",
    stat: { hp: 7.0, mp: 0.0, atk: 2.4, def: 1.6, spd: 1.2 },
    basic: [],                       // 戦士は技ではなく身体能力で戦う
    advanced: [],
    passive: { atkMul: 1.18, label: "鬼神の膂力 (攻撃+18%)" },
  },
  knight: {
    label: "騎士", color: "#7c93c8", glow: "#a9c0ff",
    stat: { hp: 8.4, mp: 0.0, atk: 2.2, def: 2.4, spd: 0.8 },
    basic: [],
    advanced: [],
    passive: { defMul: 1.20, label: "鉄壁の構え (防御+20%)" },
  },
  thief: {
    label: "盗賊", color: "#6fae46", glow: "#9be88a",
    stat: { hp: 4.4, mp: 0.0, atk: 1.8, def: 1.0, spd: 2.4 },
    basic: [],
    advanced: [],
    passive: { spdMul: 1.25, critBonus: 0.12, label: "影駆け (素早さ+25%/会心+)" },
  },
  mage: {
    label: "魔術師", color: "#b06bff", glow: "#d3a8ff",
    stat: { hp: 3.6, mp: 2.8, atk: 1.0, def: 0.6, spd: 1.4 },
    basic: [{ key: "HALITO", lvl: 1 }, { key: "KATINO", lvl: 3 }],
    advanced: [{ key: "MAHALITO", lvl: 5 }],
  },
  priest: {
    label: "僧侶", color: "#e8c47a", glow: "#ffe2a0",
    stat: { hp: 4.8, mp: 2.4, atk: 1.4, def: 1.0, spd: 1.0 },
    basic: [{ key: "DIOS", lvl: 1 }, { key: "DIAL", lvl: 3 }],
    advanced: [{ key: "MADIOS", lvl: 5 }],
  },
  bishop: {
    label: "魔導僧", color: "#5fb8d6", glow: "#aef0ff",
    stat: { hp: 4.4, mp: 3.2, atk: 1.2, def: 0.8, spd: 1.2 },
    basic: [{ key: "HALITO", lvl: 1 }, { key: "DIOS", lvl: 2 }],
    advanced: [{ key: "DIAL", lvl: 4 }, { key: "MAHALITO", lvl: 6 }],
  },
};

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
  let clsLabel = "空の器";
  let clsKey = "fighter";
  let tier = "none"; // none | basic | advanced | hybrid

  // 部位ごとの職業数を集計し、混成職(3+2)を判定
  const counts = {};
  for (const p of PARTS) { const s = doll.parts[p]; if (s) counts[s.clsKey] = (counts[s.clsKey] || 0) + 1; }
  const hybrid = findHybrid(counts);
  doll.hybrid = hybrid ? hybrid.name : null;

  if (dom) {
    clsKey = dom.clsKey;
    const def0 = SOUL_CLASSES[dom.clsKey];
    clsLabel = def0.label;
    if (dom.count >= 5) tier = "advanced";
    else if (dom.count >= 3) tier = "basic";

    // 支配職の中で最も高いランクの魂が、スキル解放を引き上げる
    // 偉大: スキル習得レベル要件 -2 / 伝説: さらに3部位でも上位スキル解放
    let bestRank = 0;
    for (const p of PARTS) {
      const s = doll.parts[p];
      if (s && s.clsKey === dom.clsKey) bestRank = Math.max(bestRank, SOUL_RANKS[s.rank || "normal"].order);
    }
    const lvlEase = bestRank >= 2 ? 2 : 0;       // 偉大+
    const legendBoost = bestRank >= 3;           // 伝説

    if (tier === "basic" || tier === "advanced") {
      for (const sk of def0.basic) if (dom.maxLevel + lvlEase >= sk.lvl && !spells.includes(sk.key)) spells.push(sk.key);
      if (def0.passive) passives.push(def0.passive.label);
    }
    if (tier === "advanced" || (tier === "basic" && legendBoost)) {
      for (const sk of def0.advanced) if (dom.maxLevel + lvlEase >= sk.lvl && !spells.includes(sk.key)) spells.push(sk.key);
    }
    if (bestRank >= 2) passives.push(bestRank >= 3 ? "伝説の魂の輝き" : "偉大な魂の共鳴");
    // パッシブ補正 (5部位そろい=advanced時のみフル適用、3部位は半分)
    if (def0.passive && (tier === "basic" || tier === "advanced")) {
      const ratio = tier === "advanced" ? 1 : 0.5;
      if (def0.passive.atkMul) atk *= 1 + (def0.passive.atkMul - 1) * ratio;
      if (def0.passive.defMul) def *= 1 + (def0.passive.defMul - 1) * ratio;
      if (def0.passive.spdMul) spd *= 1 + (def0.passive.spdMul - 1) * ratio;
    }

    // 混成職が発現していれば: 名称を上書きし、追加スキル・補正を付与
    if (hybrid) {
      tier = "hybrid";
      clsLabel = hybrid.name;
      if (hybrid.spell && !spells.includes(hybrid.spell)) spells.push(hybrid.spell);
      const hp2 = hybrid.passive || {};
      if (hp2.label) passives.push(hp2.label);
      if (hp2.atkMul) atk *= hp2.atkMul;
      if (hp2.defMul) def *= hp2.defMul;
      if (hp2.spdMul) spd *= hp2.spdMul;
    }
  }

  doll.clsKey = clsKey;
  doll.cls = clsLabel + (tier === "hybrid" ? "(混成)" : tier === "advanced" ? "(覚醒)" : tier === "basic" ? "(開眼)" : "");
  doll.tier = tier;
  doll.dominant = dom;
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
  // 会心ボーナス (盗賊魂のパッシブ + 混成職)
  let crit = 0;
  if (dom && SOUL_CLASSES[dom.clsKey].passive && SOUL_CLASSES[dom.clsKey].passive.critBonus && tier !== "none")
    crit += SOUL_CLASSES[dom.clsKey].passive.critBonus * (tier === "advanced" ? 1 : 0.5);
  if (hybrid && hybrid.passive && hybrid.passive.critBonus) crit += hybrid.passive.critBonus;
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
