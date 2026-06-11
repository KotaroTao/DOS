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

// 武器ベース
const WEAPON_BASES = [
  { k: "dagger", n: "短剣", art: "sword", atk: 3, two: false },
  { k: "sword", n: "剣", art: "sword", atk: 6 },
  { k: "saber", n: "曲刀", art: "sword", atk: 7 },
  { k: "katana", n: "刀", art: "sword", atk: 8 },
  { k: "rapier", n: "細剣", art: "spear", atk: 5, spd: 1 },
  { k: "spear", n: "槍", art: "spear", atk: 7, two: true },
  { k: "axe", n: "戦斧", art: "axe", atk: 9, two: true },
  { k: "greataxe", n: "大斧", art: "axe", atk: 12, two: true, spd: -1 },
  { k: "mace", n: "槌矛", art: "mace", atk: 8 },
  { k: "warhammer", n: "戦槌", art: "mace", atk: 10, two: true },
  { k: "staff", n: "杖", art: "staff", atk: 4, mp: 4 },
  { k: "rod", n: "魔杖", art: "staff", atk: 5, mp: 6 },
];
// 防具系ベース
const ARMOR_BASES = {
  body: [{ k: "leather", n: "革鎧", def: 4 }, { k: "scale", n: "鱗鎧", def: 6 }, { k: "chain", n: "鎖帷子", def: 8 }, { k: "plate", n: "板金鎧", def: 11, spd: -1 }, { k: "robe", n: "法衣", def: 2, mp: 3 }, { k: "garb", n: "装束", def: 3, spd: 1 }],
  shield: [{ k: "buckler", n: "小盾", def: 2 }, { k: "round", n: "丸盾", def: 4 }, { k: "kite", n: "凧盾", def: 6 }, { k: "tower", n: "塔盾", def: 9, spd: -1 }],
  head: [{ k: "cap", n: "帽子", def: 1 }, { k: "leathercap", n: "革兜", def: 2 }, { k: "helm", n: "兜", def: 4 }, { k: "greathelm", n: "大兜", def: 6, spd: -1 }, { k: "circlet", n: "宝冠", def: 2, mp: 3 }],
  hands: [{ k: "gloves", n: "手袋", def: 1 }, { k: "gauntlet", n: "籠手", def: 3 }, { k: "vambrace", n: "腕甲", def: 4, atk: 1 }],
  feet: [{ k: "shoes", n: "靴", def: 1, spd: 1 }, { k: "boots", n: "長靴", def: 2 }, { k: "greaves", n: "脚甲", def: 4, spd: -1 }],
};
const ACC_BASES = [
  { k: "ring_str", n: "力の指輪", art: "ring", atk: 3 },
  { k: "ring_def", n: "守りの指輪", art: "ring", def: 3 },
  { k: "ring_spd", n: "俊足の指輪", art: "ring", spd: 3 },
  { k: "amu_hp", n: "生命の護符", art: "amulet", hp: 12 },
  { k: "amu_mp", n: "魔力の護符", art: "amulet", mp: 10 },
  { k: "amu_luck", n: "幸運の護符", art: "amulet", luk: 4 },
  { k: "ring_crit", n: "会心の指輪", art: "ring", crit: 0.05 },
  { k: "amu_ward", n: "退魔の護符", art: "amulet", def: 2, mp: 4 },
];
// 変異 (二つ名 + 副次ボーナス)
const VARIANTS = [
  { p: "", add: {} },
  { p: "剛力の", add: { atk: 2 } },
  { p: "鉄壁の", add: { def: 2 } },
  { p: "疾風の", add: { spd: 2 } },
  { p: "生命の", add: { hp: 10 } },
  { p: "賢者の", add: { mp: 5 } },
];

let _gid = 0;
function mkItem(slot, base, rank, variant, artKey) {
  const mul = RANK_MUL[rank];
  const it = { id: "g" + (++_gid), slot, rank, classes: null };
  const namePfx = (RANK_PREFIX[rank] ? RANK_PREFIX[rank] : "") + (variant.p || "");
  it.name = namePfx + base.n;
  // 性能 (ベース×ランク + 変異)
  const scale = (v) => v ? Math.max(1, Math.round(v * mul)) : 0;
  if (base.atk) it.atk = scale(base.atk) + (variant.add.atk || 0);
  if (base.def) it.def = scale(base.def) + (variant.add.def || 0);
  if (base.spd) it.spd = (base.spd > 0 ? scale(base.spd) : base.spd);
  if (variant.add.spd) it.spd = (it.spd || 0) + variant.add.spd;
  if (base.mp) it.mp = scale(base.mp);
  if (variant.add.mp) it.mp = (it.mp || 0) + variant.add.mp;
  if (base.hp) it.hp = scale(base.hp);
  if (variant.add.hp) it.hp = (it.hp || 0) + variant.add.hp;
  if (base.luk) it.luk = base.luk + (rank - 2);
  if (base.crit) it.crit = base.crit;
  if (base.two) it.twoHanded = true;
  if (slot === "weapon") { it.hit = rank; it.dice = `1d${4 + rank}`; it.swings = 1; }
  it.price = Math.round((10 + (it.atk || 0) * 8 + (it.def || 0) * 10 + (it.mp || 0) * 4 + (it.hp || 0) * 2) * (0.8 + rank * 0.3));
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

// ===== モンスター生成 =====
// アーキタイプ別ベース絵 (sprites.js の既存絵を再利用 + 数体)
const MON_ARCH = {
  slime: { n: "スライム", hp: 14, atk: 5, def: 1, spd: 4, exp: 6, gold: 4,
    palette: { "0": "#15431a", "1": "#3fae46", "2": "#9be88a", "3": "#0a0a0a", "4": "#ffffff" },
    art: ["....0000....", "..00111100..", ".0011111100.", "001111111100", "011211112110", "011411114110", "011211112110", "011111111110", "011112211110", "001111111100", ".0011111100.", "..00000000.."] },
  bat: { n: "コウモリ", hp: 11, atk: 6, def: 2, spd: 9, exp: 7, gold: 3,
    palette: { "0": "#2a1638", "1": "#6b3fa0", "2": "#b07be0", "3": "#ff3b3b", "4": "#0a0a0a" },
    art: ["0..........0", "00........00", "010......010", "0110....0110", "01110.0.1110", "0111101111110", ".01111441110.", "..0113443110.", "...011331110.", "....011110...", ".....0220....", "......00...."] },
  beast: { n: "牙獣", hp: 24, atk: 11, def: 4, spd: 7, exp: 14, gold: 10,
    palette: { "0": "#2a1d12", "1": "#7a5230", "2": "#caa06a", "3": "#0a0a0a", "4": "#d4504e" },
    art: ["..0......0..", "..00....00..", ".0220..0220.", ".0212..2120.", ".0111111110.", ".0113443110.", ".0111111110.", "..02111120..", "..0211 1120..", "...02..20...", "..00....00..", ".0.0....0.0."] },
  skeleton: { n: "スケルトン", hp: 22, atk: 11, def: 4, spd: 7, exp: 16, gold: 12,
    palette: { "0": "#3d3d2a", "1": "#d9d4bf", "2": "#ffffff", "3": "#0a0a0a", "4": "#8a8470" },
    art: ["...000000...", "..01111110..", "..01311310..", "..01111110..", "..00133100..", "...011110...", "..010110110..", ".0101111010.", "..00111100..", "...01..10...", "...01..10...", "..010..010.."] },
  orc: { n: "オーク", hp: 30, atk: 14, def: 6, spd: 5, exp: 24, gold: 20,
    palette: { "0": "#1f3315", "1": "#4f7a3a", "2": "#79a857", "3": "#0a0a0a", "4": "#d4504e", "5": "#8a8a9a", "6": "#5a3a1a" },
    art: ["..2......2..", ".0211111120.", "021111111120", "021311131120", "021111111120", "021144441120", "021133331120", "00211111100", "650211110256", "66502110566", "..021 1120..", ".0220..0220."] },
  golem: { n: "ゴーレム", hp: 50, atk: 12, def: 14, spd: 2, exp: 30, gold: 25,
    palette: { "0": "#33373b", "1": "#6a727a", "2": "#9aa3ab", "3": "#0a0a0a", "4": "#7fd0e6" },
    art: [".00000000...", ".02222220...", ".02144120...", ".02211220...", ".02222220...", "002222222 00", "022022022 20", "022022022 20", ".00.00.00...", ".22..22.....", ".22..22.....", "022..022...."] },
  wraith: { n: "レイス", hp: 26, atk: 13, def: 5, spd: 10, exp: 22, gold: 18,
    palette: { "0": "#10202e", "1": "#2b5f7a", "2": "#5fb8d6", "3": "#aef0ff", "4": "#0a0a0a", "5": "#ff5577" },
    art: ["....0000....", "..00111100..", ".0011111100.", "011151151110", "011544445110", "011151151110", "011111111110", ".011111110.", ".0211111120.", "..021111 20..", "...021120...", "....0220...."] },
  imp: { n: "インプ", hp: 18, atk: 10, def: 3, spd: 11, exp: 13, gold: 9,
    palette: { "0": "#3a0d0d", "1": "#9c2a2a", "2": "#d65a3a", "3": "#0a0a0a", "4": "#f2c14e" },
    art: ["..0....0....", "..00..00....", "..010.010...", "..0111110...", ".011311310.", ".011111110.", ".001111100.", "...01110....", "..0211120...", ".021..120...", ".0.0..0.0...", "............"] },
  lizard: { n: "リザード", hp: 28, atk: 12, def: 7, spd: 6, exp: 20, gold: 15,
    palette: { "0": "#15401f", "1": "#3a8a3a", "2": "#7fd06a", "3": "#0a0a0a", "4": "#e8c24a" },
    art: ["..00........", ".0110.......", ".0310.0000..", ".0110011110.", "..01111111 0.", "..0111441110", "..0111111110", "...011111110", "....0111100.", "...0110110..", "..0.0..0.0..", "............"] },
  ghost: { n: "ゴースト", hp: 20, atk: 9, def: 4, spd: 9, exp: 15, gold: 11,
    palette: { "0": "#1a2630", "1": "#4a6e80", "2": "#9fd6e6", "3": "#ffffff", "4": "#0a0a0a" },
    art: ["....0000....", "..00222200..", ".0233333320.", ".0234334320.", ".0233333320.", ".0233333320.", ".0233333320.", ".0233333320.", ".0202020 20.", ".0.0.0.0.0..", "............", "............"] },
  knightmare: { n: "騎甲兵", hp: 40, atk: 16, def: 10, spd: 6, exp: 34, gold: 28,
    palette: { "0": "#1a1a24", "1": "#5a5f7a", "2": "#9aa0c0", "3": "#0a0a0a", "4": "#d4504e" },
    art: ["...02220....", "..0212120...", "..0242420...", "..0222220...", ".002222200.", ".021222120.", ".021222120.", ".001222100.", "...02220....", "...02.20....", "..022.220...", ".022..220..."] },
  dragon: { n: "ドラゴン", boss: false, hp: 90, atk: 22, def: 10, spd: 8, exp: 120, gold: 120,
    palette: { "0": "#3a0d0d", "1": "#9c2a2a", "2": "#d65a3a", "3": "#f2c14e", "4": "#0a0a0a", "5": "#ffd24a", "6": "#6b1414" },
    art: ["0..........0", "010......010", "0110.33..0110", "01110331101110", "0111133221110", "011153522 1110", "0111544521110", ".011122221 10.", "..01122221 10.", "...0112110...", "..660110666..", ".660....066."] },
  // --- 追加アーキタイプ (種族分類を充実させる。末尾に追加してIDの安定性を保つ) ---
  harpy: { n: "ハーピー", hp: 20, atk: 11, def: 4, spd: 10, exp: 16, gold: 12,
    palette: { "0": "#5a3a1a", "1": "#caa06a", "2": "#e8c24a", "3": "#d98a5a", "4": "#0a0a0a" },
    art: ["....3443....", "...344443...", "...344443...", "....3443....", "2..011110..2", "22.011110.22", ".2201111022.", "..0111110...", "...01110....", "...0...0....", "..02...20...", ".020...020.."] },
  spider: { n: "大蜘蛛", hp: 22, atk: 10, def: 5, spd: 8, exp: 15, gold: 11,
    palette: { "0": "#1a0f1a", "1": "#4a2d4a", "2": "#7a3a6a", "3": "#d4504e", "4": "#0a0a0a" },
    art: ["0.........0", "00.......00", ".00.....00.", "..0..0..0..", "...00000...", "..0011100..", ".001313100.", ".001111100.", "..0011100..", "...00000...", "..0.....0..", ".00.....00."] },
  mandrake: { n: "マンドレイク", hp: 26, atk: 9, def: 6, spd: 3, exp: 18, gold: 14,
    palette: { "0": "#143a14", "1": "#3a8a3a", "2": "#8fd06a", "3": "#caa06a", "4": "#0a0a0a", "5": "#e8c24a" },
    art: ["..1..5..1...", "..11.5.11...", "...1151 1...", "....111.....", "...03330....", "..0343430...", "..0331330...", "..0343430...", "...03330....", "....333.....", "...3.3.3....", "..3..3..3..."] },
  sahagin: { n: "サハギン", hp: 24, atk: 12, def: 6, spd: 7, exp: 19, gold: 15,
    palette: { "0": "#0a2a3a", "1": "#1f6a7a", "2": "#4fb0c0", "3": "#9be8e0", "4": "#0a0a0a", "5": "#caa06a" },
    art: ["...2....2...", "...22..22...", "....2002....", "...021120...", "..02141 20..", "..0211120...", "..0211120...", "...02220 5..", "...021205...", "...0210 5...", "..02.020....", ".020..020..."] },
  ogre: { n: "オーガ", hp: 46, atk: 18, def: 8, spd: 4, exp: 34, gold: 30,
    palette: { "0": "#2a1d12", "1": "#7a5a3a", "2": "#b08a5a", "3": "#0a0a0a", "4": "#d4504e", "5": "#8a8a9a" },
    art: ["...02220....", "..0222220...", "..0232320...", "..0222220...", ".5022222205", ".5022222205", "..02222220..", "..02222220..", "..02.0.020..", "..02...020..", ".022...0220.", ".022...0220."] },
};

// アーキタイプ別の説明文 (図鑑用)
const ARCH_DESC = {
  slime: "地を這う不定形の魔物。粘体に覆われ、油断した冒険者を包み込む。",
  bat: "暗闇を舞う吸血性の翼獣。素早く、群れで現れると厄介だ。",
  beast: "牙と爪を持つ野生の獣。単純だが力強い一撃を繰り出す。",
  skeleton: "朽ちぬ骨に魔が宿りし不死者。痛みを知らず剣を振るう。",
  orc: "緑肌の戦闘種族。粗野だが頑強で、群れて襲いかかる亜人。",
  golem: "術者が造りし魔法の人形。鈍重だが圧倒的な防御を誇る構造体。",
  wraith: "怨念が形を成した幽鬼。実体に乏しく、冷気をまとって漂う。",
  imp: "下級の悪魔。狡猾で素早く、いたずらに人を惑わす。",
  lizard: "硬い鱗に覆われた爬虫の魔物。沼地や洞窟に潜む。",
  ghost: "成仏できぬ亡霊。生者の温もりを求めてさまよう幽鬼。",
  knightmare: "持ち主を失い、鎧そのものが動き出した機鎧。忠実に侵入者を斬る。",
  dragon: "迷宮の頂点に立つ竜。圧倒的な膂力と魔力を備えた古き支配者。",
  harpy: "女面鳥身の魔物。甲高い声で羽ばたき、空から急襲する鳥人。",
  spider: "巣を張る大蟲。毒牙を持ち、獲物を糸で搦め捕る。",
  mandrake: "魔力を帯びた人型の植物。引き抜かれると絶叫を放つ。",
  sahagin: "鱗をもつ半魚人。水辺に棲み、銛を手に群れで襲う水棲種。",
  ogre: "巨躯を誇る人喰い巨人。一撃は岩をも砕く。",
};

// ===== 種族分類 (16タイプ) =====
// 各種族は1つ以上のアーキタイプを束ねる。図鑑のタブ分けに使う。
export const MON_RACES = [
  { key: "amorph", label: "不定形", archs: ["slime"] },
  { key: "beast", label: "獣", archs: ["beast"] },
  { key: "wing", label: "飛獣", archs: ["bat"] },
  { key: "avian", label: "鳥人", archs: ["harpy"] },
  { key: "insect", label: "蟲", archs: ["spider"] },
  { key: "plant", label: "植物", archs: ["mandrake"] },
  { key: "aquatic", label: "水棲", archs: ["sahagin"] },
  { key: "reptile", label: "爬虫", archs: ["lizard"] },
  { key: "dragon", label: "竜", archs: ["dragon"] },
  { key: "humanoid", label: "亜人", archs: ["orc"] },
  { key: "giant", label: "巨人", archs: ["ogre"] },
  { key: "undead", label: "不死", archs: ["skeleton"] },
  { key: "specter", label: "幽鬼", archs: ["wraith", "ghost"] },
  { key: "demon", label: "悪魔", archs: ["imp"] },
  { key: "construct", label: "構造体", archs: ["golem"] },
  { key: "armored", label: "機鎧", archs: ["knightmare"] },
];
// アーキタイプ → 種族key の逆引き
export const ARCH_RACE = (() => {
  const m = {};
  for (const r of MON_RACES) for (const a of r.archs) m[a] = r.key;
  return m;
})();
export const RACE_LABEL = (() => {
  const m = {};
  for (const r of MON_RACES) m[r.key] = r.label;
  return m;
})();
// 属性変異 (色 + 接頭辞 + 微ステ傾向)
const MON_ELEM = [
  { p: "", tint: null, amt: 0 },
  { p: "炎の", tint: "#ff6b3a", amt: 0.4 },
  { p: "氷の", tint: "#7fd0ff", amt: 0.4 },
  { p: "雷の", tint: "#f2e14a", amt: 0.35 },
  { p: "毒の", tint: "#8fe06a", amt: 0.4 },
  { p: "闇の", tint: "#6a4a8a", amt: 0.45 },
  { p: "鋼の", tint: "#aab0bc", amt: 0.45 },
  { p: "古の", tint: "#caa24a", amt: 0.35 },
];
const MON_TIER = [
  { p: "", mul: 1.0 }, { p: "強い", mul: 1.5 }, { p: "猛き", mul: 2.2 },
  { p: "古き", mul: 3.2 }, { p: "王の", mul: 4.6 }, { p: "伝説の", mul: 6.5 },
];

let _mid = 0;
export function generateMonsters() {
  const out = {};
  const archKeys = Object.keys(MON_ARCH);
  for (const ak of archKeys) {
    const base = MON_ARCH[ak];
    for (let ti = 0; ti < MON_TIER.length; ti++) {
      const tier = MON_TIER[ti];
      for (const el of MON_ELEM) {
        const id = "m" + (++_mid);
        const mul = tier.mul * (1 + el.amt * 0.3);
        const m = {
          id, key: id, archetype: ak, race: ARCH_RACE[ak] || "beast",
          name: `${tier.p}${el.p}${base.n}`,
          desc: ARCH_DESC[ak] || "",
          rank: Math.min(6, ti + 1),
          maxhp: Math.round(base.hp * mul), hp: 0,
          atk: Math.max(1, Math.round(base.atk * mul)),
          def: Math.round(base.def * mul),
          spd: base.spd + ti,
          exp: Math.round(base.exp * mul), gold: Math.round(base.gold * mul),
          art: base.art,
          palette: el.tint ? tintPalette(base.palette, el.tint, el.amt) : base.palette,
        };
        m.hp = m.maxhp;
        out[id] = m;
      }
    }
  }
  return out;
}

// ダンジョンの深さ(1始まり)に応じた、出現に適したモンスターキー配列
export function monstersForDungeon(genMon, dungeonRank, floorRatio) {
  // dungeonRank(1-4) と 階の進行(floorRatio 0-1) から狙うモンスターrankを決める
  const targetRank = Math.max(1, Math.min(6, Math.round(dungeonRank + floorRatio * 1.5)));
  const keys = Object.keys(genMon).filter((k) => Math.abs(genMon[k].rank - targetRank) <= 1);
  return keys.length ? keys : Object.keys(genMon);
}
