// 武器・防具・アクセサリ・消耗品のカタログ
// 各アイテムは art(12x12) + 共有パレット P で描く。説明文・性能・職業制限つき。
//
// slot: head | weapon | shield | body | feet | acc | use
//   weapon→右手, shield→左手, head/body/feet, acc→アクセサリ枠(2), use→消耗品
// twoHanded: 両手武器 (左手をふさぐ)
// classes: 装備可能な職業キー配列 (null=全職)
// cursed: 呪い (一度装備すると外せない)

// 装備部位 (7か所)
export const SLOTS = ["head", "rhand", "lhand", "body", "feet", "acc1", "acc2"];
export const SLOT_LABEL = {
  head: "頭", rhand: "右手", lhand: "左手", body: "体", feet: "足", acc1: "装飾1", acc2: "装飾2",
};
export const MAX_ITEMS = 12;

// slot種別 → 装備キー
export function slotKeyFor(item, member) {
  if (item.slot === "head") return "head";
  if (item.slot === "weapon") return "rhand";
  if (item.slot === "shield") return "lhand";
  if (item.slot === "body") return "body";
  if (item.slot === "feet") return "feet";
  if (item.slot === "acc") return member.equip.acc1 ? (member.equip.acc2 ? "acc1" : "acc2") : "acc1";
  return null;
}

// 共有パレット
const P = {
  ".": null,
  k: "#15151d", // 黒縁
  w: "#dadbe6", // 鋼(明)
  g: "#888e9c", // 鋼(暗)
  y: "#e8c24a", // 金
  o: "#a9781f", // 金(影)
  n: "#7a4a22", // 木
  s: "#4a2d14", // 木(影)
  l: "#c8a06a", // 革
  d: "#8a6438", // 革(影)
  r: "#cf3b34", // 赤
  b: "#3f7fc4", // 青
  c: "#7fd0e6", // 水
  p: "#9b59b6", // 紫
  G: "#46b14e", // 緑
  m: "#d36b9a", // 桃
};

const sprite = (art) => ({ art, palette: P });

export const ITEMS = {
  // ===== 武器 =====
  dagger: {
    id: "dagger", name: "ダガー", slot: "weapon", atk: 3, price: 30, classes: null,
    desc: "軽く短い両刃の短剣。どの職業でも扱える基本の武器。",
    ...sprite([
      "....k.......",
      "...kwk......",
      "...kwk......",
      "...kwk......",
      "...kwk......",
      "..kkykk.....",
      "...oyo......",
      "...knk......",
      "...knk......",
      "....s.......",
      "............",
      "............",
    ]),
  },
  shortSword: {
    id: "shortSword", name: "ショートソード", slot: "weapon", atk: 6, price: 120,
    classes: ["fighter", "knight", "thief", "priest", "bishop"],
    desc: "標準的な片手剣。前衛に十分な切れ味を持つ。",
    ...sprite([
      "....k.......",
      "...kwk......",
      "...kwk......",
      "...kwk......",
      "...kwk......",
      "...kwk......",
      "..kkykk.....",
      "...oyo......",
      "...knk......",
      "...knk......",
      "....s.......",
      "............",
    ]),
  },
  battleAxe: {
    id: "battleAxe", name: "バトルアックス", slot: "weapon", atk: 13, twoHanded: true, price: 480,
    classes: ["fighter", "knight"],
    desc: "両手で振るう戦斧。絶大な威力だが盾は持てない。",
    ...sprite([
      ".....kn.....",
      "...kkwwn....",
      "..kwwwgn....",
      ".kwwwggn....",
      ".kwggg.n....",
      "..kkg..n....",
      ".....kn.....",
      ".....sn.....",
      ".....sn.....",
      ".....sn.....",
      ".....ss.....",
      "............",
    ]),
  },
  warHammer: {
    id: "warHammer", name: "ウォーハンマー", slot: "weapon", atk: 9, price: 300,
    classes: ["fighter", "knight", "priest"],
    desc: "鈍器。聖職者でも振るえる。骨ある敵に有効。",
    ...sprite([
      "..kkkkkk....",
      ".kggwwggk...",
      ".kgwwwwgk...",
      ".kggwwggk...",
      "..kknkkk....",
      "....n.......",
      "....n.......",
      "....n.......",
      "....n.......",
      "....s.......",
      "....s.......",
      "............",
    ]),
  },
  magicStaff: {
    id: "magicStaff", name: "魔法の杖", slot: "weapon", atk: 4, mp: 4, price: 260,
    classes: ["mage", "bishop", "priest"],
    desc: "蒼い宝玉を戴いた杖。魔力(MP)を高める。",
    ...sprite([
      "....kbk.....",
      "...kbck.....",
      "...kcbk.....",
      "....kbk.....",
      "....knk.....",
      "....knk.....",
      "....knk.....",
      "....knk.....",
      "....knk.....",
      "....knk.....",
      "....ksk.....",
      "............",
    ]),
  },

  // ===== 盾 =====
  woodShield: {
    id: "woodShield", name: "木の盾", slot: "shield", def: 3, price: 80,
    classes: ["fighter", "knight", "thief", "priest", "bishop"],
    desc: "頑丈な木製の小盾。最低限の備え。",
    ...sprite([
      "..kkkkkk....",
      ".knnnnnnk...",
      ".knssssnk...",
      ".knsllsnk...",
      ".knsllsnk...",
      ".knssssnk...",
      ".knnnnnnk...",
      "..knnnnk....",
      "...knnk.....",
      "....kk......",
      "............",
      "............",
    ]),
  },
  kiteShield: {
    id: "kiteShield", name: "カイトシールド", slot: "shield", def: 6, price: 240,
    classes: ["fighter", "knight"],
    desc: "騎士の大盾。広い防御範囲で前衛を守る。",
    ...sprite([
      "..kkkkkk....",
      ".kwggggwk...",
      ".kgwggwgk...",
      ".kggyyggk...",
      ".kggyyggk...",
      ".kgwggwgk...",
      ".kwggggwk...",
      "..kgggwk....",
      "...kggk.....",
      "....kk......",
      "............",
      "............",
    ]),
  },

  // ===== 体 =====
  robe: {
    id: "robe", name: "ローブ", slot: "body", def: 1, mp: 3, price: 90, classes: null,
    desc: "魔法の刺繍が施された外套。魔力を少し高める。",
    ...sprite([
      "...kkkk.....",
      "..kppppk....",
      ".kppbbppk...",
      ".kppbbppk...",
      ".kpppppppk..",
      ".kpppppppk..",
      ".kpppppppk..",
      ".kpppppppk..",
      "..kpppppk...",
      "..kpp.ppk...",
      "..kk..kk....",
      "............",
    ]),
  },
  leatherArmor: {
    id: "leatherArmor", name: "革の鎧", slot: "body", def: 4, price: 160,
    classes: ["fighter", "knight", "thief", "priest", "bishop"],
    desc: "なめし革の鎧。軽くて動きやすい。",
    ...sprite([
      "..kkkkkk....",
      ".kllllllk...",
      "klddlldddk..",
      "kllllllllk..",
      "klldllllk...",
      ".klllllldk..",
      ".klldlllllk.",
      ".kllllldlk..",
      "..klllllk...",
      "..kll.llk...",
      "..kk..kk....",
      "............",
    ]),
  },
  plateArmor: {
    id: "plateArmor", name: "プレートアーマー", slot: "body", def: 11, spd: -1, price: 600,
    classes: ["fighter", "knight"],
    desc: "全身を鋼で固めた重鎧。鉄壁だが少し鈍重になる。",
    ...sprite([
      "..kkkkkk....",
      ".kwggggwk...",
      "kwwgwwgwwk..",
      "kwgwwwwgwk..",
      "kwggwwggwk..",
      ".kwgwwgwk...",
      ".kwggwwggk..",
      ".kwgwwwgwk..",
      "..kwggwwk...",
      "..kww.wwk...",
      "..kk..kk....",
      "............",
    ]),
  },

  // ===== 頭 =====
  cap: {
    id: "cap", name: "布の帽子", slot: "head", def: 1, price: 30, classes: null,
    desc: "簡素な布の帽子。ないよりはまし。",
    ...sprite([
      "............",
      "...kkkk.....",
      "..kbbbbk....",
      ".kbbccbbk...",
      ".kbbbbbbk...",
      "..kkkkkk....",
      "............",
      "............",
      "............",
      "............",
      "............",
      "............",
    ]),
  },
  ironHelm: {
    id: "ironHelm", name: "鉄兜", slot: "head", def: 3, price: 150,
    classes: ["fighter", "knight", "priest"],
    desc: "面頬つきの鉄兜。頭部をしっかり守る。",
    ...sprite([
      "...kkkk.....",
      "..kwggwk....",
      ".kwgwwgwk...",
      ".kwgwwgwk...",
      ".kwwwwwwk...",
      ".kwkkkkwk...",
      ".kwgwwgwk...",
      "..kwwwwk....",
      "...kkkk.....",
      "............",
      "............",
      "............",
    ]),
  },

  // ===== 足 =====
  leatherBoots: {
    id: "leatherBoots", name: "革のブーツ", slot: "feet", def: 1, spd: 1, price: 70, classes: null,
    desc: "丈夫な革靴。素早さがわずかに上がる。",
    ...sprite([
      "............",
      "..kk...kk...",
      ".klk...klk..",
      ".klk...klk..",
      ".klk...klk..",
      ".klk...klk..",
      ".kllk.kllk..",
      ".klllkklllk.",
      ".kdllllldlk.",
      ".kkkkkkkkk..",
      "............",
      "............",
    ]),
  },
  ironGreaves: {
    id: "ironGreaves", name: "鉄の脚甲", slot: "feet", def: 3, price: 180,
    classes: ["fighter", "knight"],
    desc: "鋼の脛当て。蹴撃にも踏みこみにも強い。",
    ...sprite([
      "............",
      "..kk...kk...",
      ".kwk...kwk..",
      ".kgk...kgk..",
      ".kwk...kwk..",
      ".kgk...kgk..",
      ".kwwk.kwwk..",
      ".kgwwkkgwwk.",
      ".kwggwwwggk.",
      ".kkkkkkkkk..",
      "............",
      "............",
    ]),
  },

  // ===== アクセサリ =====
  powerRing: {
    id: "powerRing", name: "力の指輪", slot: "acc", atk: 3, price: 220, classes: null,
    desc: "腕力を漲らせる指輪。攻撃力が上がる。",
    ...sprite([
      "............",
      "....kkk.....",
      "...krrrk....",
      "..kr.k.rk...",
      "..kr.r.rk...",
      "..kr...rk...",
      "...kr.rk....",
      "....krk.....",
      ".....k......",
      "............",
      "............",
      "............",
    ]),
  },
  guardAmulet: {
    id: "guardAmulet", name: "守りの護符", slot: "acc", def: 3, price: 220, classes: null,
    desc: "聖なる加護を宿す護符。防御力が上がる。",
    ...sprite([
      "....kk......",
      "...kbbk.....",
      "..kb..bk....",
      "..kb..bk....",
      "...kbbk.....",
      "..kbccbk....",
      ".kbcyycbk...",
      ".kbcyycbk...",
      ".kbccccbk...",
      "..kbbbbk....",
      "...kkkk.....",
      "............",
    ]),
  },
  swiftRing: {
    id: "swiftRing", name: "俊足の指輪", slot: "acc", spd: 3, price: 260, classes: null,
    desc: "風の精が宿る指輪。素早さが上がる。",
    ...sprite([
      "............",
      "....kkk.....",
      "...kGGGk....",
      "..kG.k.Gk...",
      "..kG.G.Gk...",
      "..kG...Gk...",
      "...kG.Gk....",
      "....kGk.....",
      ".....k......",
      "............",
      "............",
      "............",
    ]),
  },
  lifeAmulet: {
    id: "lifeAmulet", name: "生命の護符", slot: "acc", hp: 12, price: 320, classes: null,
    desc: "鼓動する宝玉の護符。最大HPが上がる。",
    ...sprite([
      "....kk......",
      "...krrk.....",
      "..kr..rk....",
      "..kr..rk....",
      "...krrk.....",
      "..krmrk.....",
      ".krmmmrk....",
      ".krmmmrk....",
      ".krrmrrk....",
      "..krrrk.....",
      "...kkk......",
      "............",
    ]),
  },
  cursedBlade: {
    id: "cursedBlade", name: "妖刀ムラマサ", slot: "weapon", atk: 18, def: -3, cursed: true, price: 0,
    classes: ["fighter", "knight", "thief"],
    desc: "凄まじい斬れ味を持つ呪われた刀。一度握れば手放せぬ…。攻撃は跳ね上がるが身を守れなくなる。",
    ...sprite([
      ".........kp.",
      "........kpk.",
      ".......kpk..",
      "......kpk...",
      ".....kpk....",
      "....kpk.....",
      "...kpk......",
      "..kykk......",
      ".kykk.......",
      "kskk........",
      "ss..........",
      "............",
    ]),
  },

  // ===== 消耗品 =====
  herb: {
    id: "herb", name: "薬草", slot: "use", use: { heal: 30 }, price: 20, classes: null,
    desc: "傷に効く薬草。HPを30回復する。",
    ...sprite([
      "............",
      ".....GG.....",
      "....GGGG....",
      "...GG.GGk...",
      "..GG.k.Gk...",
      "...GkGGGk...",
      "....GGGk....",
      "....knk.....",
      "....knk.....",
      "....ksk.....",
      "............",
      "............",
    ]),
  },
  antidote: {
    id: "antidote", name: "毒消し草", slot: "use", use: { cure: "poison" }, price: 30, classes: null,
    desc: "毒を中和する薬。毒状態を治す。",
    ...sprite([
      "....kk......",
      "...kck......",
      "...kck......",
      "..kGGGk.....",
      "..kGpGk.....",
      "..kpGpk.....",
      "..kGpGk.....",
      "..kpGpk.....",
      "..kGGGk.....",
      "...kkk......",
      "............",
      "............",
    ]),
  },
  manaDrop: {
    id: "manaDrop", name: "マナの雫", slot: "use", use: { mp: 20 }, price: 60, classes: null,
    desc: "輝く魔力の雫。MPを20回復する。",
    ...sprite([
      "............",
      "....kk......",
      "...kbk......",
      "...kck......",
      "..kbcbk.....",
      "..kcbck.....",
      ".kbccbck....",
      ".kcbbbck....",
      ".kbccccbk...",
      "..kbbbbk....",
      "...kkkk.....",
      "............",
    ]),
  },
};

// 派生ステータスを装備から再計算
export function recalc(member) {
  const base = member.base;
  let atk = base.atk, def = base.def, spd = base.spd, hpBonus = 0, mpBonus = 0;
  const counted = new Set();
  for (const slot of SLOTS) {
    const it = member.equip[slot];
    if (!it || counted.has(it)) continue;
    counted.add(it);
    atk += it.atk || 0;
    def += it.def || 0;
    spd += it.spd || 0;
    hpBonus += it.hp || 0;
    mpBonus += it.mp || 0;
  }
  member.atk = Math.max(1, atk);
  member.def = Math.max(0, def);
  member.spd = Math.max(1, spd);
  member.maxhp = base.hp + hpBonus;
  member.maxmp = base.mp + mpBonus;
  if (member.hp > member.maxhp) member.hp = member.maxhp;
  if (member.mp > member.maxmp) member.mp = member.maxmp;
  // AC(アーマークラス): 低いほど堅い (ウィザードリィ風表示用)
  member.ac = 10 - member.def;
}

export function canEquip(member, item) {
  if (!item.classes) return true;
  return item.classes.includes(member.clsKey);
}

// 装備する (置換した装備品は所持品に戻す)。成否メッセージを返す
export function equip(member, item) {
  if (item.slot === "use") return { ok: false, msg: "それは装備できない" };
  if (!canEquip(member, item)) return { ok: false, msg: `${member.cls}は${item.name}を装備できない` };
  const key = slotKeyFor(item, member);
  if (!key) return { ok: false, msg: "装備できない" };
  // 所持品から取り出す
  const idx = member.items.indexOf(item);
  if (idx >= 0) member.items.splice(idx, 1);

  const removed = [];
  // 両手武器: 右手と左手を空ける
  if (item.slot === "weapon" && item.twoHanded) {
    if (member.equip.lhand) removed.push(member.equip.lhand);
    member.equip.lhand = null;
  }
  // 盾は両手武器と併用不可
  if (item.slot === "shield" && member.equip.rhand && member.equip.rhand.twoHanded) {
    removed.push(member.equip.rhand);
    member.equip.rhand = null;
  }
  if (member.equip[key]) removed.push(member.equip[key]);
  member.equip[key] = item;
  if (item.twoHanded) member.equip.lhand = item; // 表示上ふさぐ
  for (const r of removed) if (r && r !== item) member.items.push(r);
  recalc(member);
  return { ok: true, msg: `${member.name}は ${item.name} を装備した` };
}

export function unequip(member, key) {
  const it = member.equip[key];
  if (!it) return { ok: false, msg: "" };
  if (it.cursed) return { ok: false, msg: `${it.name}は呪われていて外せない！` };
  if (member.items.length >= MAX_ITEMS) return { ok: false, msg: "持ち物がいっぱいだ" };
  member.equip[key] = null;
  if (it.twoHanded && member.equip.lhand === it) member.equip.lhand = null;
  if (key === "lhand" && member.equip.rhand && member.equip.rhand.twoHanded) {
    // 両手武器の左手表示を外す = 武器も外す
  }
  member.items.push(it);
  recalc(member);
  return { ok: true, msg: `${member.name}は ${it.name} を外した` };
}
