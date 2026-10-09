// 第9層「毒沼」の共通部品: 奈落の底の沼 (黒緑の泥・よどんだ水・半ば沈んだ朽ち木・枯れた葦)、
// 立ちこめる毒の霧と浮かぶ泡、腐った魂の黄緑の燐光、緑がかった鈍い縁光、捨てられた器の胸の「灯を掌に載せた手」の印
import { ellipsoid, cone, tube, cyl, U, Disp, Paint, ramp, fbm, vnoise, rand } from "./sdf.mjs";
export { tri } from "./mine.mjs";
export { afterimage, dissolve } from "./temple.mjs";
export { puffs, scaleAt, spikes } from "./lava.mjs";
import { drips as tdrips } from "./temple.mjs";
export const BY = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const by = (x, y) => (BY[y & 3][x & 3] + 0.5) / 16;
// 沼の泥: 黒に近い緑褐色。濡れて鈍く光り、ところどころ浮き草がまだらに
export const MUD = { ramp: ramp(["#020302", "#060805", "#0b0e08", "#12160c", "#1a1f11", "#232916"], 6), dither: 0.85, amb: 0.42, dif: 0.55, noRim: true,
  spec: 0.5, pow: 30, shade: p => 0.14 * fbm(p.x * 0.33, p.z * 0.33) + (vnoise(p.x * 0.9, p.z * 0.9) > 0.5 ? 0.1 : 0) };
// よどんだ水: ほとんど黒い緑の水面に、鈍い緑の照り返し
export const POOL = { ramp: ramp(["#010201", "#030603", "#070d06", "#0d160b", "#152110"], 5), spec: 1.4, pow: 60, specCol: "#4a6236", dither: 0.7, amb: 0.5, dif: 0.35, noRim: true };
// 枯れた葦: くすんだ黄土色の細い茎
export const REED = { ramp: ramp(["#050403", "#110e08", "#1f1a10", "#30291a", "#433924", "#594c30"], 6), dither: 0.5, amb: 0.3 };
// 朽ち木: 水を吸って黒ずんだ倒木と流木 (樹皮の縦筋)
export const ROTWOOD = { ramp: ramp(["#030202", "#090706", "#110e0a", "#1b160f", "#262014", "#332a1b"], 6), dither: 0.55, spec: 0.25, pow: 14,
  shade: p => 0.14 * Math.sin(p.x * 1.4 + 2.2 * fbm(p.x * 0.25, p.y * 0.25, p.z * 0.25)) };
// 毒沼の縁光 (霧に散った、病んだ黄緑がかった灰)
export const RIM = "#5c7048";
// 毒の霧の色 (暗→明)
export const MIASMA = ["#0d1309", "#151e0d", "#1f2c13", "#2c3e1a", "#3c5322", "#516c2c"];
// 腐った魂の燐光 (暗→明)。眼・毒の光・腐れの核に
export const ROT = ["#1a2206", "#34440c", "#587416", "#8aa82a", "#c2da58", "#eef8a8"];
// 足元に敷く沼: 泥の床 + よどんだ水 (wet が大きいほど水が広い) + 半ば沈んだ朽ち木 (logs 本) + 泥の塊 (n 個)。
//   材質 "mud" / "pool" / "rotwood"
export function bogFloor(cx, cy, rx, rz = 14, { n = 3, seed = 3, wet = 0, logs = 1, big = 3 } = {}) {
  const R = rand(seed);
  const bed = Paint(Disp(ellipsoid([cx, cy, -2], [rx, 3.6, rz], "mud"), (x, y, z) => 0.3 * fbm(x * 0.3, z * 0.3) + 0.3 * Math.max(0, vnoise(x * 0.6, z * 0.6) - 0.3)),
    (x, y, z, m) => m === "mud" && fbm(x * 0.08 + seed, z * 0.15, 2.3) > 0.02 - wet ? "pool" : m);
  const parts = [bed];
  for (let i = 0; i < n; i++) {
    const a = R() * Math.PI * 2, d = 0.5 + R() * 0.45;
    const x = cx + Math.cos(a) * rx * d, z = -2 + Math.sin(a) * rz * d * 0.9, s = big * (0.6 + R() * 0.6);
    parts.push(Disp(ellipsoid([x, cy - 2.2, z], [s * 1.5, s * 0.6, s], "mud"), (X, Y, Z) => 0.4 * fbm(X * 0.7, Y * 0.7, Z * 0.7)));
  }
  for (let i = 0; i < logs; i++) {
    const side = i % 2 ? 1 : -1, x0 = cx + side * rx * (0.3 + R() * 0.4), z0 = -2 + (R() - 0.5) * rz;
    const x1 = x0 + side * (10 + R() * 8), r = 1.8 + R() * 1.2;
    parts.push(Disp(cyl([x0, cy - 1.6, z0], [x1, cy - 0.6 - R() * 2, z0 + (R() - 0.5) * 8], r, "rotwood", 0.5), (X, Y, Z) => 0.3 * Math.abs(Math.sin(X * 1.2 + 2 * fbm(X * 0.2, Y * 0.2, Z * 0.2)))));
  }
  return U(0.6, ...parts);
}
// 枯れた葦の茂み (SDF): [根元 x, 床の高さ y, z, 丈, 傾き] の並び。材質 "reed"
export function reeds(list, mat = "reed") {
  return list.map(([x, y, z, h, lean = 0]) => tube([[x, y, z, 0.8], [x + lean * 0.3, y - h * 0.55, z, 0.6], [x + lean, y - h, z, 0.2]], mat, { seg: 2 }));
}
// 葦の穂 (2D): 茎の先に小さな茶色の房を置く
export function reedTips(C, list, cols = ["#30291a", "#433924", "#594c30"]) {
  for (const [x, y, z, h, lean = 0] of list) {
    const tx = Math.round(x + lean), ty = Math.round(y - h);
    for (let k = 0; k < 3; k++) C.set(tx, ty - k, cols[k === 1 ? 2 : 1]);
    C.set(tx + 1, ty - 1, cols[0]);
  }
}
// 立ちこめる毒の霧の帯 (2D・空いている所だけ)
export function miasma(C, seed, bands = 3, area = [0, 0, C.W, C.H], dens = 0.4, cols = MIASMA) {
  const R = rand(seed);
  for (let b = 0; b < bands; b++) {
    const y0 = area[1] + R() * area[3], th = 2 + R() * 4, ph = R() * 10, k = Math.floor(R() * 3);
    for (let x = area[0]; x < area[0] + area[2]; x++) {
      const yc = y0 + Math.sin(x * 0.08 + ph) * 3;
      for (let y = Math.floor(yc - th); y <= yc + th; y++) {
        if (y < 0 || y >= C.H || x < 0 || x >= C.W || C.get(x, y)) continue;
        const a = dens * (1 - Math.abs(y - yc) / th) * (0.5 + 0.5 * fbm(x * 0.12, y * 0.2, b * 7 + seed));
        if (a > by(x, y)) C.set(x, y, cols[Math.min(cols.length - 1, k + (a > 0.35 ? 1 : 0))]);
      }
    }
  }
}
// 浮かぶ毒の泡 (空いている所だけ)。大きい泡は縁だけの輪、まれにはじけた飛沫
export function toxBubbles(C, seed, n, area = [2, 2, C.W - 4, C.H - 4], cols = [ROT[1], ROT[2], ROT[4]]) {
  const R = rand(seed);
  for (let i = 0; i < n; i++) {
    const x = Math.round(area[0] + R() * area[2]), y = Math.round(area[1] + R() * area[3]);
    if (C.get(x, y)) continue;
    if (R() < 0.3) {
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) if (!C.get(x + dx, y + dy)) C.set(x + dx, y + dy, cols[1]);
      if (!C.get(x - 1, y - 1)) C.set(x - 1, y - 1, cols[2]);
    } else C.set(x, y, cols[R() < 0.3 ? 2 : R() < 0.6 ? 1 : 0]);
  }
}
// 水面の浮き藻とさざ波 (2D): "pool" の画素にまだらな緑の藻と、横に流れる鈍い筋
export function scum(C, seed, { mat = "pool", cols = ["#1a2410", "#26341a", "#3a4c24"] } = {}) {
  const R = rand(seed);
  for (let y = 0; y < C.H; y++) for (let x = 0; x < C.W; x++) {
    const p = C.pix[y * C.W + x]; if (!p || p.m !== mat) continue;
    const a = fbm(x * 0.25, y * 0.6, seed);
    if (a > 0.22 && R() < 0.75) C.set(x, y, cols[a > 0.38 ? 1 : 0]);
    else if (Math.sin(x * 0.5 + Math.sin(y * 1.7 + seed) * 2 + y) > 0.95 && R() < 0.6) C.set(x, y, cols[2]);
  }
}
// 宙を漂う胞子・毒の粒 (空いている所だけ)。glow=true で腐った魂の黄緑の燐光
export function motes(C, seed, n, area = [2, 2, C.W - 4, C.H - 4], glow = false, cols = null) {
  const R = rand(seed);
  const cs = cols || (glow ? [ROT[1], ROT[2], ROT[3], ROT[4]] : ["#1a2214", "#26301c", "#38442a", "#4c5a38"]);
  for (let i = 0; i < n; i++) {
    const x = area[0] + R() * area[2], y = area[1] + R() * area[3];
    if (!C.get(Math.round(x), Math.round(y))) C.set(x, y, cs[Math.min(cs.length - 1, Math.floor(R() * R() * cs.length * 1.6))]);
  }
}
// 体から垂れる泥・毒液のしずく (2D): mats の下端から
export function slime(C, seed, mats, rate = 0.2, cols = ["#1a2410", "#3a4c1a", "#7a9a2a"]) { tdrips(C, seed, mats, rate, cols); }
// 一門の印「灯を掌に載せた手」(2D、7x7): 器の胸や旗に刻む。cols = [刻みの暗, 刻みの明, 灯の色]
//   .  .  .  f  .  .  .
//   .  .  f  F  f  .  .
//   .  .  .  L  .  .  .
//   h  .  L  L  L  .  h
//   h  h  .  .  .  h  h
//   .  h  h  h  h  h  .
//   .  .  h  h  h  .  .
export function lampHand(C, x, y, cols = ["#1a1208", "#6a5430", "#e0b050"], own = null) {
  const G = ["...f...", "..fFf..", "...L...", "h.LLL.h", "hh...hh", ".hhhhh.", "..hhh.."];
  for (let j = 0; j < G.length; j++) for (let i = 0; i < 7; i++) {
    const g = G[j][i]; if (g === ".") continue;
    const X = x - 3 + i, Y = y - 3 + j;
    if (own && !own(X, Y)) continue;
    C.set(X, Y, g === "h" ? cols[1] : g === "L" ? cols[0] : g === "F" ? "#fff0b0" : cols[2]);
  }
}
// 体の表面の膿・腫れ物 (2D): mats の画素のうち、ノイズが閾値を越えた所に黄緑の斑点
export function sores(C, seed, mats, { th = 0.42, f = 0.35, cols = [ROT[1], ROT[2], ROT[3]] } = {}) {
  const M = new Set([].concat(mats));
  for (let y = 0; y < C.H; y++) for (let x = 0; x < C.W; x++) {
    const p = C.pix[y * C.W + x]; if (!p || !M.has(p.m)) continue;
    const v = vnoise(p.x * f, p.y * f, p.z * f + seed);
    if (v > th) C.set(x, y, cols[v > th + 0.18 ? 2 : v > th + 0.08 ? 1 : 0]);
  }
}
// 泥・朽ちた肌の凹凸 (Disp に渡す)
export const ooze = (k = 0.6, f = 0.4) => (x, y, z) => k * fbm(x * f, y * f, z * f);
export const bark = (k = 0.5, f = 1.4) => (x, y, z) => k * Math.abs(Math.sin(x * f + 2 * fbm(x * 0.2, y * 0.2, z * 0.2)));
export { Paint, cone };
