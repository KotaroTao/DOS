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

// 魂レベル → 必要経験値 (累積はせず、各レベルで gainSoulExp 内で消費)
export function soulExpToNext(level) {
  return 20 + (level - 1) * 24;
}
export const SOUL_MAX_LEVEL = 9;

let _soulUid = 0;

// 魂を生成。clsKey: 職業 / level: 初期レベル
export function makeSoul(clsKey, level = 1) {
  if (!SOUL_CLASSES[clsKey]) return null;
  return { uid: ++_soulUid, clsKey, level, exp: 0 };
}

// 魂の表示名。例: 「戦士の魂 Lv3」
export function soulName(s) {
  return `${SOUL_CLASSES[s.clsKey].label}の魂 Lv${s.level}`;
}

// レベル係数: 1部位の寄与は (1 + (level-1)*0.12) 倍
function lvlFactor(level) {
  return 1 + (level - 1) * 0.12;
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
export function recalcDoll(doll) {
  let hp = 0, mp = 0, atk = 0, def = 0, spd = 0;
  for (const p of PARTS) {
    const s = doll.parts[p];
    if (!s) continue;
    const st = SOUL_CLASSES[s.clsKey].stat;
    const f = lvlFactor(s.level);
    hp += st.hp * f; mp += st.mp * f; atk += st.atk * f; def += st.def * f; spd += st.spd * f;
  }
  // 器そのものの最低体力 (魂が少なくても即死しないよう下駄)
  hp += 6;

  const dom = dominantClass(doll);
  const spells = [];
  const passives = [];
  let clsLabel = "空の器";
  let clsKey = "fighter";
  let tier = "none"; // none | basic | advanced

  if (dom) {
    clsKey = dom.clsKey;
    const def0 = SOUL_CLASSES[dom.clsKey];
    clsLabel = def0.label;
    if (dom.count >= 5) tier = "advanced";
    else if (dom.count >= 3) tier = "basic";

    if (tier === "basic" || tier === "advanced") {
      for (const sk of def0.basic) if (dom.maxLevel >= sk.lvl && !spells.includes(sk.key)) spells.push(sk.key);
      if (def0.passive) passives.push(def0.passive.label);
    }
    if (tier === "advanced") {
      for (const sk of def0.advanced) if (dom.maxLevel >= sk.lvl && !spells.includes(sk.key)) spells.push(sk.key);
    }
    // パッシブ補正 (5部位そろい=advanced時のみフル適用、3部位は半分)
    if (def0.passive && (tier === "basic" || tier === "advanced")) {
      const ratio = tier === "advanced" ? 1 : 0.5;
      if (def0.passive.atkMul) atk *= 1 + (def0.passive.atkMul - 1) * ratio;
      if (def0.passive.defMul) def *= 1 + (def0.passive.defMul - 1) * ratio;
      if (def0.passive.spdMul) spd *= 1 + (def0.passive.spdMul - 1) * ratio;
    }
  }

  doll.clsKey = clsKey;
  doll.cls = clsLabel + (tier === "advanced" ? "(覚醒)" : tier === "basic" ? "(開眼)" : "");
  doll.tier = tier;
  doll.dominant = dom;
  // 人業の「レベル」= 封印した魂の平均レベル (表示用)
  const souls = dollSouls(doll);
  doll.level = souls.length ? Math.max(1, Math.round(souls.reduce((a, s) => a + s.level, 0) / souls.length)) : 1;

  doll.base = {
    hp: Math.round(hp), mp: Math.round(mp),
    atk: Math.round(atk), def: Math.round(def), spd: Math.max(1, Math.round(spd)),
  };
  doll.spells = spells;
  doll.passives = passives;
  // 会心ボーナス (盗賊魂のパッシブ)
  doll.critBonus = (dom && SOUL_CLASSES[dom.clsKey].passive && SOUL_CLASSES[dom.clsKey].passive.critBonus && tier !== "none")
    ? SOUL_CLASSES[dom.clsKey].passive.critBonus * (tier === "advanced" ? 1 : 0.5) : 0;

  // 装備補正を base に重ねて最終ステータス確定 (items.js の recalc を流用)
  recalc(doll);
  return doll;
}

// 戦闘経験を魂に配分してレベルアップ判定。
// 封印中の各魂に exp を与え、上がった魂の通知メッセージ配列を返す。
export function gainSoulExp(doll, amount) {
  const msgs = [];
  const souls = dollSouls(doll);
  if (!souls.length) return msgs;
  const each = Math.max(1, Math.floor(amount / souls.length));
  for (const s of souls) {
    if (s.level >= SOUL_MAX_LEVEL) continue;
    s.exp += each;
    while (s.level < SOUL_MAX_LEVEL && s.exp >= soulExpToNext(s.level)) {
      s.exp -= soulExpToNext(s.level);
      s.level++;
      msgs.push(`${SOUL_CLASSES[s.clsKey].label}の魂が Lv${s.level} に成長した`);
    }
  }
  if (msgs.length) recalcDoll(doll);
  return msgs;
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
  for (const p of PARTS) garo.parts[p] = makeSoul("fighter", 1);
  recalcDoll(garo);
  dolls.push(garo);

  const saria = makeDoll("サリア");
  saria.parts.head = makeSoul("mage", 1);
  saria.parts.rhand = makeSoul("mage", 1);
  saria.parts.body = makeSoul("mage", 1);
  saria.parts.lhand = makeSoul("thief", 1);
  saria.parts.legs = makeSoul("thief", 1);
  recalcDoll(saria);
  dolls.push(saria);

  const mina = makeDoll("ミナ");
  mina.parts.head = makeSoul("priest", 1);
  mina.parts.rhand = makeSoul("priest", 1);
  mina.parts.body = makeSoul("priest", 1);
  mina.parts.lhand = makeSoul("knight", 1);
  mina.parts.legs = makeSoul("knight", 1);
  recalcDoll(mina);
  dolls.push(mina);

  // 予備の魂 (組み替え・新しい人業づくり用)
  const souls = [
    makeSoul("fighter", 1), makeSoul("fighter", 1),
    makeSoul("knight", 1),
    makeSoul("thief", 1), makeSoul("thief", 1),
    makeSoul("mage", 1),
    makeSoul("priest", 1),
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
