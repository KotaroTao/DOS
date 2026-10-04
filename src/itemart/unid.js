// 未鑑定の品の伏せ絵: ジャンル (武器8種・盾・鎧・頭・小手・足・装飾) ごとに一枚。
// 形は目録の手描きの原型 (catalog/defs.js の ARTS) を影絵にし、右下に「？」を重ねる。
// 鑑定に成功するまで本来の絵は見せない (どの品かは名前も絵も伏せる)
import { ARTS } from "../catalog/defs.js";

const SHAPE_OF = {
  ls: ["ls", 0], dg: ["dg", 0], kt: ["kt", 0], ax: ["ax", 0], mc: ["mc", 0], sp: ["sp", 0], bw: ["bw", 0], st: ["st", 0],
  shield: ["kite", 0], body: ["plate", 0], head: ["helm", 0], hands: ["gloves", 0], feet: ["boots", 0], acc: ["ring", 0],
};
// 影の色 (地の色に沈む、青みがかった灰) と「？」の色 (古い羊皮紙)
const VEIL = { a: "#1e1b26", b: "#2e2a3a", c: "#423d52", d: "#5a546c" };
const MARK = { m: "#f2e2b0", n: "#c8ac6a", o: "#7a6232" };
// 「？」 (m = 明 / n = 地 / o = 影)。周りは黒縁で囲む
const QMARK = [
  ".mmmn.",
  "mn..no",
  "....no",
  "...mo.",
  "..mn..",
  "..no..",
  "......",
  "..mn..",
  "..no..",
];

function lum(hex) {
  const n = parseInt(hex.slice(1), 16);
  return ((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11;
}
const PAL_P = (() => {
  // 原型の色鍵 → 明るさ (defs.js の P と同じ並び。ARTS の文字は P のキー)
  const P = {
    k: "#0d0b10", e: "#262433", g: "#4a4a5c", v: "#7c7d88", w: "#b5b2ad", x: "#e9e3d6",
    O: "#2e2016", o: "#6b5221", y: "#a88a3e", Y: "#dcc78a", S: "#1c130f", s: "#35241a", n: "#574030", N: "#7d6449",
    D: "#241a16", d: "#4b3628", l: "#7a5f45", L: "#a88f70", q: "#3a1016", r: "#7a2028", R: "#b8564a",
    u: "#1a2234", b: "#34506e", c: "#7aa0b4", J: "#1c1426", j: "#3b2a4c", p: "#66507a", i: "#a08cb0",
    t: "#1a2618", G: "#3e5a34", h: "#7d9a62", z: "#4a4236", I: "#8f8670", B: "#c9c0a6",
    F: "#17161f", f: "#2c2b3a", C: "#484a5e", A: "#6e7088", m: "#a0566a",
  };
  const out = {};
  for (const k in P) out[k] = lum(P[k]);
  return out;
})();

function build(genre) {
  const [key, i] = SHAPE_OF[genre];
  const a = ARTS[key];
  const src = Array.isArray(a[0]) ? a[i] : a;
  const rows = src.map((r) => [...r.padEnd(24, ".")]);
  // 影絵: 明るさで 4 段に。黒縁はそのまま
  for (const row of rows) for (let x = 0; x < row.length; x++) {
    const c = row[x];
    if (c === "." || c === "k") continue;
    const l = PAL_P[c] != null ? PAL_P[c] : 80;
    row[x] = l < 45 ? "a" : l < 95 ? "b" : l < 150 ? "c" : "d";
  }
  // 「？」を右下へ (斜めの武器は空いた右下、正面の品は重ねて黒縁で浮かせる)
  const ox = 16, oy = 12;
  const put = (x, y, ch) => { if (rows[y] && x >= 0 && x < 24) rows[y][x] = ch; };
  for (let y = -1; y <= QMARK.length; y++) for (let x = -1; x <= QMARK[0].length; x++) {
    const inMark = (yy, xx) => QMARK[yy] && QMARK[yy][xx] && QMARK[yy][xx] !== ".";
    if (inMark(y, x)) continue;
    let near = false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) if (inMark(y + dy, x + dx)) near = true;
    if (near) put(ox + x, oy + y, "k");
  }
  QMARK.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] !== ".") put(ox + x, oy + y, r[x]); });
  return { palette: { ".": null, k: "#0d0b10", ...VEIL, ...MARK }, art: rows.map((r) => r.join("")) };
}

const ICONS = {};
export function unidIcon(it) {
  const genre = it && it.slot === "weapon" ? (SHAPE_OF[it.cat] ? it.cat : "ls") : SHAPE_OF[it && it.slot] ? it.slot : "acc";
  return ICONS[genre] || (ICONS[genre] = build(genre));
}
export const UNID_GENRES = Object.keys(SHAPE_OF);
