// 装備の絵の窓口: すべての装備に、その品だけの絵を割り当てる
//
//   スーパーレア・レジェンドレア … hand/ の手描き (HAND_ART[id]) があればそれを使う
//   それ以外 (コモン・アンコモン・レア と、手描きがまだの SR/LR) … 部品の組み合わせで自動生成
//     (theme.js が名前・属性・レア度・隠しレベルから素材と意匠を決め、weapons.js / armor.js が描く)
//
// 絵は描く瞬間に一品ずつ作って id ごとに覚える (起動時に全部は描かない)。
// 色違いの同じ絵 (形と陰影が同じ) が二つ出ないよう、重なる品は乱数をずらす: そのずらし幅は
// tools/itemart/check.mjs が全品を描いて調べ、salts.js に書き出す (品を足したら --apply で更新する)。
// 秘宝 (LR・職業専用・神話級 lv165+) は輪郭の外に淡い燐光をまとう (catalog/defs.js と同じ規則)。
// 未鑑定の品はジャンルごとの伏せ絵 (unid.js) — sprites.js の差し替え口 (setSpriteResolver) から描き分ける。
import { themeOf } from "./theme.js";
import { weaponArt } from "./weapons.js";
import { armorArt } from "./armor.js";
import { HAND_ART } from "./hand/index.js";
import { ART_SALT } from "./salts.js";
import { unidIcon } from "./unid.js";
import { ELEM_COL } from "./core.js";

export const ART_SLOTS = new Set(["weapon", "shield", "body", "head", "hands", "feet", "acc"]);
const GLOW_DEFAULT = "#a8c4ff";
const GLOW_ALPHA = 0.24;

function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
// 輪郭に接する透明画素を燐光 "*" に
function withGlow(art) {
  const at = (x, y) => (art[y] && art[y][x]) || ".";
  return art.map((row, y) => [...row].map((c, x) => (
    c === "." && (at(x + 1, y) !== "." || at(x - 1, y) !== "." || at(x, y + 1) !== "." || at(x, y - 1) !== ".") ? "*" : c
  )).join(""));
}
// 形と陰影だけの指紋 (色は見ない): 色違いの同じ絵を「同じ絵」とみなすため
export function shapeSig(art, palette) {
  const lum = {};
  for (const k in palette) {
    const v = palette[k];
    if (!v || v[0] !== "#") { lum[k] = "."; continue; }
    const n = parseInt(v.slice(1), 16);
    const l = ((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11;
    lum[k] = String(Math.min(5, Math.floor(l / 43)));
  }
  return art.map((row) => [...row].map((c) => (c === "." || c === "*" ? "." : lum[c] || "?")).join("")).join("/");
}

export function isRelic(it) { return !!(it.lr || it.exclusive || (it.lv || 0) >= 165); }

// 一品の絵を新しく描く (salt で乱数をずらす)。手描き・燐光は含まない素の絵
export function drawItem(it, salt = 0) {
  const th = themeOf(it, salt);
  const g = it.slot === "weapon" ? weaponArt(it, th) : armorArt(it, th);
  return g.toArt();
}

// 品 (目録の雛形) の絵: 手描き → 自動生成。燐光つき。id ごとに覚える
const cache = new Map();
export function itemArt(tmpl) {
  if (!tmpl || !tmpl.id || !ART_SLOTS.has(tmpl.slot)) return null;
  let a = cache.get(tmpl.id);
  if (a) return a;
  const base = HAND_ART[tmpl.id] || drawItem(tmpl, ART_SALT[tmpl.id] || 0);
  let art = base.art, palette = { ...base.palette };
  if (isRelic(tmpl)) {
    art = withGlow(art);
    const el = (tmpl.eAtk && tmpl.eAtk.el) || (tmpl.eDef && tmpl.eDef.el) || null;
    palette["*"] = rgba(el ? ELEM_COL[el] : GLOW_DEFAULT, GLOW_ALPHA);
  }
  a = { art, palette };
  cache.set(tmpl.id, a);
  return a;
}

// 描画の差し替え: 装備なら (未鑑定 → 伏せ絵 / 鑑定済み → その品の絵)、それ以外はそのまま。
// items = ITEMS (目録)。品の実体は雛形の一部 (形の手がかり shape など) を持たないので、雛形から描く
export function makeItemSpriteResolver(items) {
  return (spr) => {
    if (!spr || typeof spr !== "object" || !spr.slot || !ART_SLOTS.has(spr.slot)) return null;
    if (spr.unidentified) return unidIcon(spr);
    const tmpl = (spr.id && items[spr.id]) || null;
    return tmpl ? itemArt(tmpl) : null;
  };
}

export { HAND_ART, unidIcon };
