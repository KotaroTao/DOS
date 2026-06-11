// 手続き生成コンテンツ: 1000種以上のアイテム / 500種以上のモンスター。
// 少数のベース絵をランク/属性で再配色し、性能をスケールして大量生成する。
// 各エントリは rank(1-6) を持ち、宝箱/ダンジョンのランク抽選に使われる。

// ---- 色ユーティリティ ----
function hex(n) { return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0"); }
function parseHex(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
function blend(a, b, t) {
  if (!a) return a; const A = parseHex(a), B = parseHex(b);
  return "#" + hex(A[0] + (B[0] - A[0]) * t) + hex(A[1] + (B[1] - A[1]) * t) + hex(A[2] + (B[2] - A[2]) * t);
}
// パレット(キー→色)を tintColor 方向へ amount 混ぜた新パレットを返す
function tintPalette(pal, tintColor, amount) {
  const out = {};
  for (const k in pal) out[k] = pal[k] ? blend(pal[k], tintColor, amount) : pal[k];
  return out;
}

// ===== ランク定義 (アイテム/宝箱/モンスター共通) =====
export const RANK_COLOR = { 1: "#9aa0ac", 2: "#cfc5a2", 3: "#7fd0e6", 4: "#b07be0", 5: "#f2c14e", 6: "#ff7a72" };
export const RANK_NAME = { 1: "並", 2: "上", 3: "精良", 4: "魔法", 5: "秘宝", 6: "神話" };
const RANK_MUL = { 1: 0.6, 2: 1.0, 3: 1.5, 4: 2.2, 5: 3.2, 6: 4.6 };
const RANK_PREFIX = { 1: "古びた", 2: "", 3: "上質な", 4: "魔法の", 5: "秘宝の", 6: "神話の" };

// ===== アイテム生成 =====
// 共有レター→色 パレット (items.js と同等)
const P = {
  ".": null, k: "#15151d", w: "#dadbe6", g: "#888e9c", y: "#e8c24a", o: "#a9781f",
  n: "#7a4a22", s: "#4a2d14", l: "#c8a06a", d: "#8a6438", r: "#cf3b34", b: "#3f7fc4",
  c: "#7fd0e6", p: "#9b59b6", G: "#46b14e", m: "#d36b9a",
};

// スロット別ベース絵 (12x12)
const ART = {
  sword: ["....k.......", "...kwk......", "...kwk......", "...kwk......", "...kwk......", "..kkykk.....", "...oyo......", "...knk......", "...knk......", "....s.......", "............", "............"],
  axe: ["....kkk.....", "...kwwwk....", "..kwwwwgk...", "..kwwwgk....", "...kkgk.....", "....knk.....", "....knk.....", "....knk.....", "....knk.....", "....kns.....", "............", "............"],
  staff: ["....cc......", "...cbbc.....", "...cbbc.....", "....cc......", "....nn......", "....nn......", "....nn......", "....nn......", "....nn......", "....ns......", "............", "............"],
  spear: ["....k.......", "...kwk......", "...kwk......", "....n.......", "....n.......", "....n.......", "....n.......", "....n.......", "....n.......", "....s.......", "............", "............"],
  mace: ["...kkk......", "..kwgwk.....", "..kgwgk.....", "..kwgwk.....", "...knk......", "....n.......", "....n.......", "....n.......", "....n.......", "....s.......", "............", "............"],
  body: [".kkkkkk.....", ".kwwwwwk....", ".kwggggwk...", ".kwgwwgwk...", ".kwgwwgwk...", ".kwggggwk...", ".kwwwwwk....", ".kwwwwwk....", "..kwwwk.....", "..k...k.....", ".kk...kk....", "............"],
  shield: ["..kkkkk.....", ".kwwwwwk....", ".kwyyywk....", ".kwyoywk....", ".kwyyywk....", ".kwwwwwk....", "..kwwwk.....", "...kwk......", "....k.......", "............", "............", "............"],
  head: ["..kkkkk.....", ".kwwwwwk....", "kwggggwk....", "kwgwwgwk....", "kwwwwwwk....", ".kwwwwk.....", "..kkkk......", "............", "............", "............", "............", "............"],
  hands: ["..kk.kk.....", ".klk.klk....", ".kllllllk...", ".kllllllk...", ".kllllllk...", "..klllk.....", "..k...k.....", "............", "............", "............", "............", "............"],
  feet: ["..kkk.......", ".kllk.......", ".kllk.......", ".kllk.......", ".kllk.......", ".kllkkk.....", ".klllllk....", ".kdddddk....", "..kkkkk.....", "............", "............", "............"],
  ring: ["............", "....kkk.....", "..kkyykk....", ".kyo.oyk....", ".ky...yk....", ".ky...yk....", ".kyo.oyk....", "..kkyykk....", "....kkk.....", "............", "............", "............"],
  amulet: ["....kkk.....", "...k...k....", "..k.....k...", ".k..ccc..k..", ".k.ccbcc.k..", ".k.cbpbc.k..", ".k.ccbcc.k..", "..k.ccc.k...", "...k...k....", "....kkk.....", "............", "............"],
  potion: ["....kk......", "....kk......", "...kbbk.....", "..kbccbk....", "..kbccbk....", ".kbccccbk...", ".kbccccbk...", ".kbccccbk...", "..kbbbbk....", "...kkkk.....", "............", "............"],
};
const spr = (artKey, pal) => ({ art: ART[artKey], palette: pal });

// 武器ベース (性能キーは六大ステ: atk/vit/agi/int/pie/luk + hp/mp/crit)
const WEAPON_BASES = [
  { k: "dagger", n: "短剣", art: "sword", atk: 3, two: false },
  { k: "sword", n: "剣", art: "sword", atk: 6 },
  { k: "saber", n: "曲刀", art: "sword", atk: 7 },
  { k: "katana", n: "刀", art: "sword", atk: 8 },
  { k: "rapier", n: "細剣", art: "spear", atk: 5, agi: 1 },
  { k: "spear", n: "槍", art: "spear", atk: 7, two: true },
  { k: "axe", n: "戦斧", art: "axe", atk: 9, two: true },
  { k: "greataxe", n: "大斧", art: "axe", atk: 12, two: true, agi: -1 },
  { k: "mace", n: "槌矛", art: "mace", atk: 8 },
  { k: "warhammer", n: "戦槌", art: "mace", atk: 10, two: true },
  { k: "staff", n: "杖", art: "staff", atk: 4, int: 2, mp: 4 },
  { k: "rod", n: "魔杖", art: "staff", atk: 5, int: 3, mp: 6 },
];
// 防具系ベース
const ARMOR_BASES = {
  body: [{ k: "leather", n: "革鎧", vit: 4 }, { k: "scale", n: "鱗鎧", vit: 6 }, { k: "chain", n: "鎖帷子", vit: 8 }, { k: "plate", n: "板金鎧", vit: 11, agi: -1 }, { k: "robe", n: "法衣", vit: 2, pie: 2, mp: 3 }, { k: "garb", n: "装束", vit: 3, agi: 1 }],
  shield: [{ k: "buckler", n: "小盾", vit: 2 }, { k: "round", n: "丸盾", vit: 4 }, { k: "kite", n: "凧盾", vit: 6 }, { k: "tower", n: "塔盾", vit: 9, agi: -1 }],
  head: [{ k: "cap", n: "帽子", vit: 1 }, { k: "leathercap", n: "革兜", vit: 2 }, { k: "helm", n: "兜", vit: 4 }, { k: "greathelm", n: "大兜", vit: 6, agi: -1 }, { k: "circlet", n: "宝冠", vit: 2, int: 2, mp: 3 }],
  hands: [{ k: "gloves", n: "手袋", vit: 1 }, { k: "gauntlet", n: "籠手", vit: 3 }, { k: "vambrace", n: "腕甲", vit: 4, atk: 1 }],
  feet: [{ k: "shoes", n: "靴", vit: 1, agi: 1 }, { k: "boots", n: "長靴", vit: 2 }, { k: "greaves", n: "脚甲", vit: 4, agi: -1 }],
};
const ACC_BASES = [
  { k: "ring_str", n: "力の指輪", art: "ring", atk: 3 },
  { k: "ring_def", n: "守りの指輪", art: "ring", vit: 3 },
  { k: "ring_spd", n: "俊足の指輪", art: "ring", agi: 3 },
  { k: "amu_hp", n: "生命の護符", art: "amulet", hp: 12 },
  { k: "amu_mp", n: "魔力の護符", art: "amulet", mp: 10 },
  { k: "amu_luck", n: "幸運の護符", art: "amulet", luk: 4 },
  { k: "ring_crit", n: "会心の指輪", art: "ring", crit: 0.05 },
  { k: "amu_ward", n: "退魔の護符", art: "amulet", vit: 2, mp: 4 },
];
// 追加アクセサリ (INT/PIE 用)。生成IDの安定性のため既存 ACC_BASES への挿入は禁止 —
// generateItems() の末尾で別パスとして生成する (追記のみ)。
const ACC_BASES_EXTRA = [
  { k: "ring_int", n: "知恵の指輪", art: "ring", int: 3 },
  { k: "amu_pie", n: "祈りの護符", art: "amulet", pie: 3 },
];
// 変異 (二つ名 + 副次ボーナス)
const VARIANTS = [
  { p: "", add: {} },
  { p: "剛力の", add: { atk: 2 } },
  { p: "鉄壁の", add: { vit: 2 } },
  { p: "疾風の", add: { agi: 2 } },
  { p: "生命の", add: { hp: 10 } },
  { p: "賢者の", add: { mp: 5 } },
];

let _gid = 0;
function mkItem(slot, base, rank, variant, artKey) {
  const mul = RANK_MUL[rank];
  const it = { id: "g" + (++_gid), slot, rank, classes: null };
  const namePfx = (RANK_PREFIX[rank] ? RANK_PREFIX[rank] : "") + (variant.p || "");
  it.name = namePfx + base.n;
  // 性能 (ベース×ランク + 変異)。六大ステ (atk/vit/agi/int/pie/luk) を加算
  const scale = (v) => v ? Math.max(1, Math.round(v * mul)) : 0;
  if (base.atk) it.atk = scale(base.atk) + (variant.add.atk || 0);
  if (base.vit) it.vit = scale(base.vit) + (variant.add.vit || 0);
  if (base.agi) it.agi = (base.agi > 0 ? scale(base.agi) : base.agi);
  if (variant.add.agi) it.agi = (it.agi || 0) + variant.add.agi;
  if (base.int) it.int = scale(base.int);
  if (base.pie) it.pie = scale(base.pie);
  if (base.mp) it.mp = scale(base.mp);
  if (variant.add.mp) it.mp = (it.mp || 0) + variant.add.mp;
  if (base.hp) it.hp = scale(base.hp);
  if (variant.add.hp) it.hp = (it.hp || 0) + variant.add.hp;
  if (base.luk) it.luk = base.luk + (rank - 2);
  if (base.crit) it.crit = base.crit;
  if (base.two) it.twoHanded = true;
  if (slot === "weapon") { it.hit = rank; it.dice = `1d${4 + rank}`; it.swings = 1; }
  it.price = Math.round((10 + (it.atk || 0) * 8 + (it.vit || 0) * 10 + ((it.int || 0) + (it.pie || 0) + (it.luk || 0)) * 6 + (it.mp || 0) * 4 + (it.hp || 0) * 2) * (0.8 + rank * 0.3));
  it.desc = `${RANK_NAME[rank]}級の${base.n}。`;
  const pal = tintPalette(P, RANK_COLOR[rank], rank >= 4 ? 0.4 : 0.18);
  Object.assign(it, spr(artKey, pal));
  return it;
}

// 全アイテムを生成して返す { id: item }
export function generateItems() {
  const out = {};
  const add = (it) => { out[it.id] = it; };
  for (let rank = 1; rank <= 6; rank++) {
    for (const b of WEAPON_BASES) for (const v of VARIANTS) add(mkItem("weapon", b, rank, v, b.art));
    for (const slot of ["body", "shield", "head", "hands", "feet"]) {
      const artKey = slot;
      for (const b of ARMOR_BASES[slot]) for (const v of VARIANTS.slice(0, 4)) add(mkItem(slot, b, rank, v, artKey));
    }
    for (const b of ACC_BASES) for (const v of VARIANTS.slice(0, 3)) add(mkItem("acc", b, rank, v, b.art));
  }
  // 追加ベースは必ず既存ループの後に生成する (生成IDが既存セーブの図鑑/在庫とずれないように)
  for (let rank = 1; rank <= 6; rank++) {
    for (const b of ACC_BASES_EXTRA) for (const v of VARIANTS.slice(0, 3)) add(mkItem("acc", b, rank, v, b.art));
  }
  // 消耗品 (ランク=回復量帯)
  let pid = 0;
  const useDefs = [
    { n: "薬草", heal: 30 }, { n: "上薬草", heal: 70 }, { n: "霊薬", heal: 150 }, { n: "霊験薬", heal: 320 },
    { n: "マナの雫", mp: 20 }, { n: "マナの泉", mp: 50 }, { n: "賢者の水", mp: 120 },
    { n: "毒消し草", cure: "poison" }, { n: "万能薬", cure: "poison" },
  ];
  for (let rank = 1; rank <= 6; rank++) for (const u of useDefs) {
    const it = { id: "gu" + (++pid), slot: "use", rank, classes: null, name: `${RANK_PREFIX[rank] || ""}${u.n}`, use: {}, price: 20 + rank * 30 };
    if (u.heal) it.use.heal = Math.round(u.heal * (0.7 + rank * 0.25));
    if (u.mp) it.use.mp = Math.round(u.mp * (0.7 + rank * 0.25));
    if (u.cure) it.use.cure = u.cure;
    it.desc = `${RANK_NAME[rank]}級の${u.n}。`;
    Object.assign(it, spr("potion", tintPalette(P, RANK_COLOR[rank], 0.25)));
    out[it.id] = it;
  }
  return out;
}
