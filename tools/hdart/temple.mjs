// 第6層「沈没神殿」の共通部品: 水に沈んだ石畳と水たまり、崩れた柱、沈んだ燭台の燐光、立ちのぼる泡と漂う塵
import { ellipsoid, box, cyl, U, Disp, Paint, ramp, fbm, vnoise, rand } from "./sdf.mjs";
export { tri } from "./mine.mjs";
// 石畳: 水に浸かった神殿の床。切り石の目地と、藻にくすんだ青緑の灰
export const FLAG = { ramp: ramp(["#020303", "#070a0a", "#0d1213", "#141b1c", "#1d2627", "#273232"], 6), dither: 0.8, amb: 0.42, dif: 0.55, noRim: true,
  shade: p => {
    const u = p.x * 0.15, v = (p.z + 40) * 0.28, row = Math.floor(v);
    const fu = (u + row * 0.5) % 1, fv = v % 1;
    return ((fu < 0.07 || fv < 0.12) ? -0.26 : 0) + 0.12 * fbm(p.x * 0.4, p.z * 0.4);
  } };
// 床にたまった水: 暗い青緑の鏡面。燐光と月の照り返しだけが白く光る
export const POOL = { ramp: ramp(["#010304", "#03090b", "#071116", "#0c1b21", "#13272e"], 5), spec: 1.4, pow: 70, specCol: "#5e9296", dither: 0.7, amb: 0.5, dif: 0.35, noRim: true };
// 神殿の白い石 (柱・像・祭具)。湿って青緑に沈み、上面ほど藻がくすませる
export const MARBLE = { ramp: ramp(["#030404", "#0a0d0d", "#131818", "#1d2424", "#283131", "#353f3f", "#46514f", "#5b6663"], 8), spec: 0.4, pow: 18, dither: 0.55,
  shade: p => 0.1 * fbm(p.x * 0.45, p.y * 0.45, p.z * 0.45) - 0.08 * Math.max(0, fbm(p.x * 0.2 + 3, p.y * 0.2, p.z * 0.2)) };
// 神殿の寒い縁光 (水面に散った月明かりの青緑)
export const RIM = "#4a7276";
// 燐光の色 (暗→明)。沈んだ燭台・聖なる印・眼の光に使う
export const PHOS = ["#0b302e", "#1a6460", "#3ea89a", "#98e8d6", "#e2fff6"];
// 足元に敷く水浸しの石畳 + 崩れた柱の欠片・切り石 (n 個)。床 "flag"、水たまり "pool"、欠片 "marble" 材質
export function templeFloor(cx, cy, rx, rz = 14, { n = 4, seed = 3, big = 3.2, wet = 0.0, cols = 0 } = {}) {
  const R = rand(seed);
  const bed = Paint(Disp(ellipsoid([cx, cy, -2], [rx, 3.6, rz], "flag"), (x, y, z) => 0.22 * fbm(x * 0.3, z * 0.3) + (vnoise(x * 0.5, z * 0.5) > 0.55 ? 0.5 : 0)),
    (x, y, z, m) => m === "flag" && fbm(x * 0.09 + seed, z * 0.16, 1.7) > -0.08 - wet ? "pool" : m);
  const blocks = [];
  for (let i = 0; i < n; i++) {
    const a = R() * Math.PI * 2, d = 0.55 + R() * 0.4;
    const x = cx + Math.cos(a) * rx * d, z = -2 + Math.sin(a) * rz * d * 0.9, s = big * (0.55 + R() * 0.6);
    if (i < cols) blocks.push(columnDrum([x, cy - 1, z], s * 1.1, s * 1.4, R() * 40 - 20));
    else blocks.push(Disp(box([x, cy - 2 - s * 0.4, z], [s * 1.2, s * 0.6, s * 0.8], "marble", s * 0.2, R() * 40 - 20), (X, Y, Z) => 0.3 * fbm(X * 0.7, Y * 0.7, Z * 0.7)));
  }
  return U(0, bed, ...blocks);
}
// 倒れた柱の胴 (溝彫りの円柱を横倒しに)。p = 床に接する中心
export function columnDrum([x, y, z], r, len, rot = 0) {
  const a = rot * Math.PI / 180, dx = Math.cos(a) * len, dz = Math.sin(a) * len * 0.6;
  return Disp(cyl([x - dx, y - r, z - dz], [x + dx, y - r, z + dz], r, "marble", 0.4), (X, Y, Z) => 0.18 * Math.abs(Math.sin(Math.atan2(Y - y + r, Z - z) * 8)) + 0.25 * fbm(X * 0.5, Y * 0.5, Z * 0.5));
}
// 立った柱 (下から上へ。上端は折れて欠ける)。溝彫り "marble"
export function column(x, yBase, z, h, r, { seed = 1, broken = true } = {}) {
  const top = yBase - h;
  return Disp(cyl([x, yBase, z], [x, top, z], r, "marble", 0.5), (X, Y, Z) => 0.22 * Math.abs(Math.sin(Math.atan2(Z - z, X - x) * 9)) + 0.2 * fbm(X * 0.5, Y * 0.5, Z * 0.5)
    + (broken ? Math.max(0, (top + 4 - Y)) * (0.6 + 0.6 * vnoise(X * 0.6 + seed, Z * 0.6)) : 0));
}
// 水たまりの上のさざ波 (2D): "pool" の画素に、横に流れる明るい筋をまばらに置く
export function ripples(C, seed, cols = ["#1b3438", "#2c5054", "#5e9296"]) {
  const R = rand(seed);
  for (let y = 0; y < C.H; y++) for (let x = 0; x < C.W; x++) {
    const p = C.pix[y * C.W + x]; if (!p || p.m !== "pool") continue;
    const w = Math.sin(x * 0.55 + Math.sin(y * 1.7 + seed) * 2.2 + y * 0.9);
    if (w > 0.93 && R() < 0.7) C.set(x, y, cols[R() < 0.25 ? 2 : R() < 0.6 ? 1 : 0]);
  }
}
// 立ちのぼる泡 (空いている所だけ)。大きい泡は縁だけの輪
export function bubbles(C, seed, n, area = [2, 2, C.W - 4, C.H - 4], cols = ["#1d3c40", "#3a6e70", "#8ac8c4"]) {
  const R = rand(seed);
  for (let i = 0; i < n; i++) {
    const x = Math.round(area[0] + R() * area[2]), y = Math.round(area[1] + R() * area[3]);
    const big = R() < 0.25;
    if (big) {
      const ring = [[0, -1], [1, 0], [0, 1], [-1, 0]];
      if (ring.some(([dx, dy]) => C.get(x + dx, y + dy)) || C.get(x, y)) continue;
      for (const [dx, dy] of ring) C.set(x + dx, y + dy, cols[1]);
      C.set(x - 1, y - 1, cols[2]);
    } else if (!C.get(x, y)) C.set(x, y, cols[R() < 0.3 ? 2 : R() < 0.6 ? 1 : 0]);
  }
}
// 水中を漂う塵と燐光の粒 (空いている所だけ)。glow=true で青緑の燐光
export function motes(C, seed, n, area = [2, 2, C.W - 4, C.H - 4], glow = false) {
  const R = rand(seed);
  const cols = glow ? PHOS.slice(0, 4) : ["#121a1b", "#1c2829", "#2a3a3a", "#3e5050"];
  for (let i = 0; i < n; i++) {
    const x = area[0] + R() * area[2], y = area[1] + R() * area[3];
    if (!C.get(Math.round(x), Math.round(y))) C.set(x, y, cols[Math.min(cols.length - 1, Math.floor(R() * R() * cols.length * 1.6))]);
  }
}
// したたる水滴 (2D): 材質 mats の画素の下端から、空いた所へ短い滴を垂らす
export function drips(C, seed, mats, rate = 0.2, cols = ["#16292c", "#2c5054", "#6aa6a6"]) {
  const R = rand(seed), M = new Set([].concat(mats));
  for (let x = 1; x < C.W - 1; x++) for (let y = 1; y < C.H - 3; y++) {
    const p = C.pix[y * C.W + x]; if (!p || !M.has(p.m) || C.get(x, y + 1) || R() > rate) continue;
    const l = 1 + Math.floor(R() * 3);
    for (let k = 1; k <= l; k++) C.set(x, y + k, cols[k === l ? 2 : k === 1 ? 0 : 1]);
    if (R() < 0.5) C.set(x, y + l + 2, cols[1]);
  }
}
// 沈んだ燭台の燐光 (2D): 小さな青緑の炎と滲む光の輪
export function phosFlame(C, x, y, s = 1) {
  const r = 2.4 * s;
  for (let a = 0; a < Math.PI * 2; a += 0.35) { const X = Math.round(x + Math.cos(a) * r * 1.5), Y = Math.round(y + Math.sin(a) * r * 1.5); if (!C.get(X, Y) && (X + Y) % 2 === 0) C.set(X, Y, PHOS[0]); }
  C.set(x, y, PHOS[2]); C.set(x, y - 1, PHOS[3]); C.set(x, y - 2, PHOS[2]); C.set(x - 1, y, PHOS[1]); C.set(x + 1, y, PHOS[1]);
  if (s > 1) { C.set(x, y - 3, PHOS[1]); C.set(x, y - 1, PHOS[4]); }
}
// 水の流れ・帳 (Disp に渡す): 縦に流れる筋
export const flow = (k = 0.5, f = 1.2) => (x, y, z) => k * Math.sin(x * f + 1.6 * fbm(x * 0.2, y * 0.08, z * 0.2));
// 下へ向かってほどける (2D): y0〜y1 の間、下ほど多く画素を抜き、残りを暗く沈める。霊の裾や水に溶ける体に
const BY = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
export function dissolve(C, y0, y1, { seed = 1, x0 = 0, x1 = C.W, darken = null } = {}) {
  for (let y = Math.max(0, Math.floor(y0)); y < C.H; y++) for (let x = x0; x < x1; x++) {
    const c = C.get(x, y); if (!c) continue;
    if (y >= y1) { C.px[y * C.W + x] = null; continue; }
    const t = 1.4 * (y - y0) / (y1 - y0) + 0.35 * fbm(x * 0.25, y * 0.12, seed) - 0.1;
    if (t > (BY[y & 3][x & 3] + 0.5) / 16 + 0.15) C.px[y * C.W + x] = null;
    else if (darken && t > 0.3) { const i = darken.indexOf(c); if (i > 0) C.px[y * C.W + x] = darken[Math.max(0, i - 1 - (t > 0.6 ? 1 : 0))]; }
  }
}
// 残像 (2D): いまの絵の姿を横へずらし、空いた所にだけ淡い色をまばらに置く (神速・回避の速さ)。
// list = [[dx, dy, 濃さ 0〜1, 色], ...]。濃い残像から先に置く
export function afterimage(C, list, area = [0, 0, C.W, C.H]) {
  const snap = C.px.slice();
  for (const [dx, dy, dens, col] of list) {
    for (let y = area[1]; y < area[1] + area[3]; y++) for (let x = area[0]; x < area[0] + area[2]; x++) {
      if (!snap[y * C.W + x]) continue;
      const X = x + dx, Y = y + dy;
      if (X < 0 || Y < 0 || X >= C.W || Y >= C.H || C.get(X, Y)) continue;
      if (dens > (BY[Y & 3][X & 3] + 0.5) / 16) C.set(X, Y, col);
    }
  }
}
export { Paint };
