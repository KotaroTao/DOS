// 一点物アイテムカタログの共通定義: ドット絵原型 + ビルダー
//
// 「上質な」「秘宝の」のような量産用の二つ名は廃止。すべてのアイテムは
// ここにあるビルダー (W/S/A/H/F/G/R/M/U) を通して固有の名と来歴を持つ一点物として定義する。
//
// 共通ルール:
//  - id は append-only (セーブ/図鑑が参照するため、改名・削除は禁止。増やすのみ)
//  - lv: 隠しレベル (1-200)。出現する迷宮帯・出現率・性能・価格の自動算出に使う
//    (lv1-20=粗末な品 / 165-200=神話級。全100迷宮の lootLv 帯に対応する)
//  - eAtk/eDef: 属性攻撃/属性防御 ["fire",1] 形式 → {el,lv} に変換される
//    Lv1=◯ (有利+50%/不利-50%), Lv2=◎ (有利+100%/不利-100%)
//  - 絵は形の原型 (ARTS) × 色 (属性色 or tint指定) で描き分ける
import { tint } from "../dungeons/schema.js";
import { lvToRank } from "../items.js";

// 共有パレット (items.js と同等)
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

// 属性 → 染め色 (schema.js の ELEMENTS と同系統)
const ELEM_TINT = {
  fire: "#ff6b3a", water: "#4aa3ff", wind: "#5fd08a",
  earth: "#c89a4a", light: "#ffe27a", dark: "#9b6bd0",
};
const ELEM_KEYS = Object.keys(ELEM_TINT);

// ===== 形の原型 (12x12) =====
export const ARTS = {
  // --- 武器 (サブカテゴリと同キー) ---
  ls: [ // 長剣
    "....k.......", "...kwk......", "...kwk......", "...kwk......", "...kwk......", "...kwk......",
    "..kkykk.....", "...oyo......", "...knk......", "...knk......", "....s.......", "............"],
  dg: [ // 短剣
    "....k.......", "...kwk......", "...kwk......", "...kwk......", "...kwk......",
    "..kkykk.....", "...oyo......", "...knk......", "....s.......", "............", "............", "............"],
  kt: [ // 刀
    ".........k..", "........kwk.", ".......kwk..", "......kwk...", ".....kwk....", "....kwk.....",
    "...kwk......", "..kyk.......", ".konk.......", ".kns........", ".ss.........", "............"],
  ax: [ // 斧
    "....kkk.....", "...kwwwk....", "..kwwwwgk...", "..kwwwgk....", "...kkgk.....", "....knk.....",
    "....knk.....", "....knk.....", "....knk.....", "....knk.....", "....ks......", "............"],
  mc: [ // 槌
    "..kkkkkk....", ".kggwwggk...", ".kgwwwwgk...", ".kggwwggk...", "..kknkkk....", "....n.......",
    "....n.......", "....n.......", "....n.......", "....s.......", "....s.......", "............"],
  sp: [ // 槍
    "....k.......", "...kwk......", "...kwk......", "....k.......", "....n.......", "....n.......",
    "....n.......", "....n.......", "....n.......", "....n.......", "....s.......", "............"],
  bw: [ // 弓
    "...kk.......", "..knk.......", ".knk.k......", ".kn...k.....", "kn.....k....", "kn.....k....",
    "kn.....k....", ".kn...k.....", ".knk.k......", "..knk.......", "...kk.......", "............"],
  st: [ // 杖
    "....kbk.....", "...kbck.....", "...kcbk.....", "....kbk.....", "....knk.....", "....knk.....",
    "....knk.....", "....knk.....", "....knk.....", "....knk.....", "....ksk.....", "............"],
  // --- 盾 ---
  kite: [
    "..kkkkkk....", ".kwggggwk...", ".kgwggwgk...", ".kggyyggk...", ".kggyyggk...", ".kgwggwgk...",
    ".kwggggwk...", "..kgggwk....", "...kggk.....", "....kk......", "............", "............"],
  round: [
    "...kkkk.....", "..kwwwwk....", ".kwggggwk...", ".kwgyygwk...", ".kwgyygwk...", ".kwggggwk...",
    "..kwwwwk....", "...kkkk.....", "............", "............", "............", "............"],
  // --- 鎧 ---
  plate: [
    "..kkkkkk....", ".kwggggwk...", "kwwgwwgwwk..", "kwgwwwwgwk..", "kwggwwggwk..", ".kwgwwgwk...",
    ".kwggwwggk..", ".kwgwwwgwk..", "..kwggwwk...", "..kww.wwk...", "..kk..kk....", "............"],
  robe: [
    "...kkkk.....", "..kppppk....", ".kppbbppk...", ".kppbbppk...", ".kpppppppk..", ".kpppppppk..",
    ".kpppppppk..", ".kpppppppk..", "..kpppppk...", "..kpp.ppk...", "..kk..kk....", "............"],
  // --- 頭 ---
  helm: [
    "...kkkk.....", "..kwggwk....", ".kwgwwgwk...", ".kwgwwgwk...", ".kwwwwwwk...", ".kwkkkkwk...",
    ".kwgwwgwk...", "..kwwwwk....", "...kkkk.....", "............", "............", "............"],
  hat: [
    "............", "...kkkk.....", "..kbbbbk....", ".kbbccbbk...", ".kbbbbbbk...", "..kkkkkk....",
    "............", "............", "............", "............", "............", "............"],
  circlet: [
    "............", "....krk.....", "...kyyyk....", "..ky...yk...", "..ky...yk...", "..kyyyyyk...",
    "...kkkkk....", "............", "............", "............", "............", "............"],
  // --- 足 ---
  boots: [
    "............", "..kk...kk...", ".klk...klk..", ".klk...klk..", ".klk...klk..", ".klk...klk..",
    ".kllk.kllk..", ".klllkklllk.", ".kdllllldlk.", ".kkkkkkkkk..", "............", "............"],
  greaves: [
    "............", "..kk...kk...", ".kwk...kwk..", ".kgk...kgk..", ".kwk...kwk..", ".kgk...kgk..",
    ".kwwk.kwwk..", ".kgwwkkgwwk.", ".kwggwwwggk.", ".kkkkkkkkk..", "............", "............"],
  // --- 小手 ---
  gloves: [
    ".klk.klk....", ".klk.klk....", ".kllkllk....", ".kdlllldk...", "..klllk.....", "..kkkkk.....",
    "............", "............", "............", "............", "............", "............"],
  gauntlet: [
    ".kwk.kwk....", ".kgwkgwk....", ".kwgwgwk....", ".kggwggk....", "..kgggk.....", "..kkkkk.....",
    "............", "............", "............", "............", "............", "............"],
  // --- 装飾品 ---
  ring: [
    "............", "....kkk.....", "...kyyyk....", "..ky.k.yk...", "..ky.y.yk...", "..ky...yk...",
    "...ky.yk....", "....kyk.....", ".....k......", "............", "............", "............"],
  amulet: [
    "....kk......", "...kbbk.....", "..kb..bk....", "..kb..bk....", "...kbbk.....", "..kbccbk....",
    ".kbcyycbk...", ".kbcyycbk...", ".kbccccbk...", "..kbbbbk....", "...kkkk.....", "............"],
  // --- 蒐集品 (戦利品) ---
  fang: [
    "............", "....kk......", "...kwwk.....", "...kwwk.....", "..kwwk......", "..kwwk......",
    ".kwwk.......", ".kwk........", ".kwk........", ".kk.........", "............", "............"],
  gem: [
    "............", "....kkk.....", "...kcwck....", "..kcwwwck...", ".kccwwcck...", ".kbccccbk...",
    "..kbccbk....", "...kbbk.....", "....kk......", "............", "............", "............"],
  ore: [
    "............", "...kkkk.....", "..kggwgk....", ".kgwggwgk...", ".kggwgggk...", ".kgwgggwk...",
    "..kgggwk....", "...kkkk.....", "............", "............", "............", "............"],
  bone: [
    "............", ".kk......kk.", "kwwk....kwwk", "kwwwkkkkwwwk", ".kwwwwwwwwk.", "kwwwkkkkwwwk",
    "kwwk....kwwk", ".kk......kk.", "............", "............", "............", "............"],
  coin: [
    "............", "....kkkk....", "...kyyyyk...", "..kyyooyyk..", "..kyoyyoyk..", "..kyoyyoyk..",
    "..kyyooyyk..", "...kyyyyk...", "....kkkk....", "............", "............", "............"],
  vial: [
    "....kk......", "....kk......", "...kbbk.....", "..kbccbk....", "..kbccbk....", ".kbccccbk...",
    ".kbccccbk...", ".kbccccbk...", "..kbbbbk....", "...kkkk.....", "............", "............"],
  cloth: [
    "............", ".kkkkkkkk...", ".kllllllk...", ".kdllllldk..", ".klldlllk...", ".kllllldk...",
    ".kdlllllk...", ".kkkkkkkk...", "............", "............", "............", "............"],
  eye: [
    "............", "...kkkk.....", "..kwwwwk....", ".kwwbbwwk...", ".kwbkkbwk...", ".kwbkkbwk...",
    ".kwwbbwwk...", "..kwwwwk....", "...kkkk.....", "............", "............", "............"],
  bell: [
    "....kk......", "...kyyk.....", "...kyyk.....", "..kyyyyk....", "..kyooyk....", ".kyyyyyyk...",
    ".kyooooyk...", ".kkkkkkkk...", "...kook.....", "............", "............", "............"],
  skull: [
    "...kkkk.....", "..kwwwwk....", ".kwwwwwwk...", ".kwkwwkwk...", ".kwkwwkwk...", ".kwwwwwwk...",
    "..kwkkwk....", "..kwwwwk....", "...kkkk.....", "............", "............", "............"],
  horn: [
    "..........k.", ".........kwk", "........kwk.", ".......kwwk.", "......kwwk..", ".....kwwk...",
    "....kwwk....", "...kwwk.....", "..kwwwk.....", ".kwwwk......", ".kkkk.......", "............"],
  book: [
    "............", "..kkkkkk....", ".kppppppk...", ".kpppppppk..", ".kpyypppk...", ".kpppppppk..",
    ".kppppppk...", "..kkkkkk....", "............", "............", "............", "............"],
  orb: [
    "............", "...kkkk.....", "..kcwwck....", ".kcwwwwck...", ".kcwwbwck...", ".kcwbbwck...",
    ".kccbbcck...", "..kcccck....", "...kkkk.....", "............", "............", "............"],
  pouch: [
    "............", "....ksk.....", "...ksssk....", "..kllllk....", ".kllllllk...", ".kldllllk...",
    ".klllldlk...", "..kllllk....", "...kkkk.....", "............", "............", "............"],
};

// 武器サブカテゴリごとの威力倍率 (職業制限は souls.js の JOB_GEAR テーブルで一元管理)
const W_MUL = { ls: 1.0, dg: 0.78, kt: 1.06, ax: 1.16, mc: 1.1, sp: 1.04, bw: 0.92, st: 0.66 };

// 形状 → 装備重量 (canEquip の鎧重量チェックに使う)
const SHAPE_WEIGHT = {
  plate: "heavy", helm: "heavy", greaves: "heavy", gauntlet: "heavy", kite: "heavy",
  round: "light", boots: "light", gloves: "light", hat: "light",
  robe: "cloth", circlet: "cloth",
};

// 性能はすべてフラット値 (ATK+10 など)。自動算出値は lv の二次関数で単調増加し、
// opt.pow (自動主ステの倍率) と各種ボーナス/ペナルティで装備ごとの個性を出す。
const round = Math.round;
const priceOf = (lv) => round(10 + lv * lv * 0.30 + lv * 5);

function chk(cond, msg) { if (!cond) throw new Error("catalog: " + msg); }

// 共通フィールドを組み立てる
// 性能キーは六大ステ (atk/vit/agi/int/pie/luk) + hp/mp。ビルダーの opt は
// 直感的な別名 (def=VIT, spd=AGI, atkB=ATK) を受け、ここで変換する。
function base(id, name, slot, lv, artKey, opt) {
  chk(id && name, "id/name required");
  chk(lv >= 1 && lv <= 200, "lv out of range (1-200): " + id);
  chk(ARTS[artKey], "unknown art: " + artKey + " (" + id + ")");
  chk(typeof opt.desc === "string" && opt.desc.length >= 24, "desc too short: " + id);
  const it = {
    id, name, slot, lv,
    rank: lvToRank(lv),
    classes: opt.cls !== undefined ? opt.cls : null,
    desc: opt.desc,
  };
  if (opt.eAtk) { chk(ELEM_KEYS.includes(opt.eAtk[0]), "bad eAtk element: " + id); it.eAtk = { el: opt.eAtk[0], lv: opt.eAtk[1] || 1 }; }
  if (opt.eDef) { chk(ELEM_KEYS.includes(opt.eDef[0]), "bad eDef element: " + id); it.eDef = { el: opt.eDef[0], lv: opt.eDef[1] || 1 }; }
  if (opt.spd) it.agi = opt.spd;       // 旧称 spd → AGI
  if (opt.agi) it.agi = (it.agi || 0) + opt.agi;
  if (opt.hp) it.hp = opt.hp;
  if (opt.mp != null) it.mp = opt.mp;
  if (opt.int) it.int = opt.int;
  if (opt.pie) it.pie = opt.pie;
  if (opt.luk) it.luk = opt.luk;
  if (opt.crit) it.crit = opt.crit;
  if (opt.atkB) it.atk = opt.atkB;     // 防具などの攻撃ボーナス
  if (opt.vitB) it.vit = opt.vitB;     // 武器・装飾の VIT 補正 (負値=重武器のペナルティ等)
  if (opt.cursed) it.cursed = true;
  if (opt.align) it.align = opt.align;
  // %補正 (装飾品など): { atk:0.2, hp:0.2 } で +20%。recalc が乗算レイヤーで適用する
  if (opt.mult) it.mult = opt.mult;
  // LR (レジェンドレア・専用装備) のティア。lr が立つと専用ドロップ層・LR表示になる
  if (opt.lr) it.lr = opt.lr;
  if (opt.forJob) it.forJob = opt.forJob;
  if (opt.exclusive) it.exclusive = true;
  // 絵: 原型 × 染め色 (属性があれば属性色が既定)
  const el = (opt.eAtk && opt.eAtk[0]) || (opt.eDef && opt.eDef[0]) || null;
  const tc = opt.tint || (el ? ELEM_TINT[el] : null);
  it.art = ARTS[artKey];
  it.palette = tc ? tint(P, tc, opt.tintAmt != null ? opt.tintAmt : (el ? 0.3 : 0.22)) : P;
  it.price = opt.price != null ? opt.price : priceOf(lv);
  return it;
}

// 武器: W(id, 名, サブカテゴリ, lv, opt)
// opt: { desc(必須), eAtk, two, cls, pow(自動ATKの倍率), vitB, spd, mp, hp, atk(絶対値上書き), tint, tintAmt, cursed, align, price }
export function W(id, name, cat, lv, opt = {}) {
  chk(W_MUL[cat], "unknown weapon cat: " + cat + " (" + id + ")");
  const it = base(id, name, "weapon", lv, cat, { cls: opt.cls !== undefined ? opt.cls : null, ...opt });
  it.cat = cat;
  const two = !!opt.two || cat === "bw"; // 弓は常に両手
  if (two) it.twoHanded = true;
  it.atk = opt.atk != null ? opt.atk : Math.max(1, round((2 + lv * 0.82 + lv * lv * 0.0026) * W_MUL[cat] * (two && cat !== "bw" ? 1.25 : 1) * (opt.pow || 1)));
  it.hit = opt.hit != null ? opt.hit : 1 + Math.floor(lv / 25);
  it.dice = opt.dice || ("1d" + (4 + Math.min(20, Math.floor(lv / 9))) + (lv >= 30 ? "+" + Math.min(15, Math.floor(lv / 13)) : ""));
  it.swings = opt.swings || 1;
  if (cat === "st") {                                                // 杖は魔力の触媒
    // INT は呪文威力に ×0.5 で直結する術者の「攻撃力」— 武器ATKと同格のカーブにする
    if (it.mp == null) it.mp = round(3 + lv * 0.3 + lv * lv * 0.0008);
    if (it.int == null) it.int = Math.max(1, round(2 + lv * 0.5 + lv * lv * 0.0015));
  }
  if (cat === "dg" && it.agi == null) it.agi = Math.max(1, round(1 + lv * 0.06)); // 短剣は取り回しが軽い (lvに比例)
  return it;
}

// 盾: S(id, 名, lv, opt) — opt.shape: "kite"(既定) | "round" | "orb" | "book"。opt.def は VIT の上書き
export function S(id, name, lv, opt = {}) {
  const shape = opt.shape || "kite";
  const it = base(id, name, "shield", lv, shape, { cls: null, ...opt });
  it.vit = opt.def != null ? opt.def : Math.max(1, round((2 + lv * 0.16 + lv * lv * 0.0014) * (opt.pow || 1)));
  it.weight = SHAPE_WEIGHT[shape] || "cloth";  // orb/book 等は cloth 扱い
  return it;
}

// 鎧: A(id, 名, lv, opt) — opt.shape: "plate"(既定) | "robe"。opt.def は VIT の上書き
// opt.weight: "heavy"(既定) | "light" | "cloth" — 省略時は shape から自動決定
export function A(id, name, lv, opt = {}) {
  const robe = opt.shape === "robe";
  const it = base(id, name, "body", lv, robe ? "robe" : "plate", opt);
  const autoWeight = robe ? "cloth" : "heavy";
  const weight = opt.weight || autoWeight;
  const lightMul = weight === "cloth" ? 0.5 : weight === "light" ? 0.75 : 1;
  it.vit = opt.def != null ? opt.def : Math.max(1, round((3 + lv * 0.22 + lv * lv * 0.0014) * lightMul * (opt.pow || 1)));
  if (robe || weight === "cloth") {
    // PIE は回復量に ×0.5 で直結する — 法衣は癒し手の主装備としてしっかり伸ばす
    if (it.mp == null) it.mp = round(2 + lv * 0.25 + lv * lv * 0.0007);
    if (it.pie == null) it.pie = Math.max(1, round(1 + lv * 0.28 + lv * lv * 0.0008));
  }
  it.weight = weight;
  return it;
}

// 段階装備の役割ステ量 (lv に応じて単調増加)。頭/小手の主ステ算出に使う。
const roleStatAmt = (lv) => Math.max(1, round(0.8 + lv * 0.16 + lv * lv * 0.0006));
const tokenVit = (lv) => Math.max(1, round(lv * 0.05));

// 頭: H(id, 名, lv, opt) — opt.shape: "helm"(既定) | "hat" | "circlet"。opt.def は VIT の上書き
// opt.weight: shape から自動決定 (helm=heavy, hat=light, circlet=cloth)。上書き可
// 段階装備の方針: 物理職向け(軽/重)は VIT 主体、術者向け(布)は opt.magStat ("int"|"pie") 主体。
// magStat 指定時のみ VIT をトークンに落として INT/PIE を主ステにする (既存の一点物には無影響)。
export function H(id, name, lv, opt = {}) {
  const shape = opt.shape || "helm";
  const it = base(id, name, "head", lv, shape, opt);
  it.vit = opt.def != null ? opt.def : Math.max(1, round((1 + lv * 0.10 + lv * lv * 0.0012) * (opt.pow || 1)));
  it.weight = opt.weight || SHAPE_WEIGHT[shape];
  if (opt.magStat === "int" || opt.magStat === "pie") {
    it[opt.magStat] = (it[opt.magStat] || 0) + roleStatAmt(lv);
    if (opt.def == null) it.vit = tokenVit(lv);
  }
  return it;
}

// 足: F(id, 名, lv, opt) — opt.shape: "boots"(既定) | "greaves"。opt.def は VIT の上書き
// opt.weight: shape から自動決定 (boots=light, greaves=heavy)。上書き可 (例: weight:"cloth" で布靴)
// 足は「AGI(すばやさ)の部位」: 重量に応じて AGI を自動付与する (布>軽>重)。
// opt.agi/opt.spd を渡すと、その分が自動AGIに上乗せされる (韋駄天の沓など俊足の品)。
const FEET_AGI_COEF = { cloth: 0.11, light: 0.085, heavy: 0.04 };
export function F(id, name, lv, opt = {}) {
  const shape = opt.shape || "boots";
  const it = base(id, name, "feet", lv, shape, opt);
  it.vit = opt.def != null ? opt.def : Math.max(1, round((1 + lv * 0.09 + lv * lv * 0.0010) * (opt.pow || 1)));
  it.weight = opt.weight || SHAPE_WEIGHT[shape];
  // AGI 自動付与 (base() が opt.agi/spd で設定済みの分には上乗せ)
  const coef = FEET_AGI_COEF[it.weight] != null ? FEET_AGI_COEF[it.weight] : 0.085;
  it.agi = (it.agi || 0) + Math.max(1, round(0.6 + lv * coef));
  return it;
}

// 小手: G(id, 名, lv, opt) — opt.shape: "gloves"(既定) | "gauntlet"。opt.def は VIT の上書き
// opt.weight: shape から自動決定 (gloves=light, gauntlet=heavy)。上書き可 (例: weight:"cloth" で布手袋)
// 段階装備の方針: 小手は「攻めの部位」。物理職向け(軽/重)は opt.role:"atk" で ATK 主体、
// 術者向け(布)は opt.magStat ("int"|"pie") 主体。指定時は VIT をトークンに落とす (既存品は無影響)。
export function G(id, name, lv, opt = {}) {
  const shape = opt.shape || "gloves";
  const it = base(id, name, "hands", lv, shape, opt);
  it.vit = opt.def != null ? opt.def : Math.max(1, round((1 + lv * 0.09 + lv * lv * 0.0010) * (opt.pow || 1)));
  it.weight = opt.weight || SHAPE_WEIGHT[shape];
  if (opt.role === "atk") {
    it.atk = (it.atk || 0) + roleStatAmt(lv);
    if (opt.def == null) it.vit = tokenVit(lv);
  } else if (opt.magStat === "int" || opt.magStat === "pie") {
    it[opt.magStat] = (it[opt.magStat] || 0) + roleStatAmt(lv);
    if (opt.def == null) it.vit = tokenVit(lv);
  }
  return it;
}

// 装飾品: R(id, 名, 形, lv, opt) — 防御の自動値は持たず、性能 (hp/mp/luk/crit/eAtk/eDef…) は opt で明示する
export function R(id, name, shape, lv, opt = {}) {
  const it = base(id, name, "acc", lv, shape, opt);
  if (opt.def != null) it.vit = opt.def;
  return it;
}

// 蒐集品 (戦利品): M(id, 名, 形, lv, opt) — 装備も使用もできず、商店で売るか宝物庫に奉納する
export function M(id, name, shape, lv, opt = {}) {
  const it = base(id, name, "misc", lv, shape, opt);
  it.price = opt.price != null ? opt.price : round(8 + lv * lv * 0.25 + lv * 4);
  return it;
}

// 道具 (消耗品): U(id, 名, lv, use, opt) — use: { heal?, mp?, cure? }
export function U(id, name, lv, use, opt = {}) {
  const it = base(id, name, "use", lv, opt.shape || "vial", opt);
  it.use = use;
  if (opt.price == null) it.price = round(14 + lv * lv * 0.30 + lv * 6);
  return it;
}
