import { tube, sphere, ellipsoid, cone, slab, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { RIM, MIST, mist, spores, tri } from "../forest.mjs";
export const meta = { id: "bs_giantowl", key: "hd_giantowl", w: 96, h: 96,
  note: "霧渡りの梟: 翼を大きく広げて霧の中から急降下してくる大梟。金色に光る大きな丸い眼、前へ突き出した鉤爪。翼の後ろには残像と羽ばたきの速度の筋が尾を引き、目で追えないほど速い" };
const BY = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
// 急降下の傾き: 左翼を下げてバンクし、左下へずらす (局所座標 ↔ 画面座標)
const ANG = -6 * Math.PI / 180, SC = 0.9, CA = Math.cos(ANG) * SC, SA = Math.sin(ANG) * SC, OX = -1, OY = 11;
const fwd = (x, y) => { const dx = x - 48, dy = y - 48; return [48 + OX + CA * dx - SA * dy, 48 + OY + SA * dx + CA * dy]; };
const inv = (x, y) => { const dx = x - 48 - OX, dy = y - 48 - OY, k = 1 / (SC * SC); return [48 + (CA * dx + SA * dy) * k, 48 + (-SA * dx + CA * dy) * k]; };
function xf(n) {
  if (n.leaf) { const f = n.f, b = n.bound, c = fwd(b[0], b[1]); return { leaf: true, mat: n.mat, bound: [c[0], c[1], b[2], b[3]], f: (x, y, z) => { const [u, v] = inv(x, y); return f(u, v, z / SC) * SC; } }; }
  const o = { ...n, kids: n.kids.map(xf) };
  if (n.fn) { const fn = n.fn; o.fn = n.op === "D" ? (x, y, z) => { const [u, v] = inv(x, y); return fn(u, v, z / SC) * SC; } : (x, y, z, m) => { const [u, v] = inv(x, y); return fn(u, v, z / SC, m); }; }
  return o;
}
const loc = p => inv(p.x, p.y);
export function build() {
  const mats = {
    feather: { ramp: ramp(["#050404", "#0f0d0b", "#1b1814", "#29241e", "#383028", "#4a3f33", "#5e5040", "#78664e"], 8), dither: 0.6, spec: 0.2, pow: 15,
      shade: p => { const [x, y] = loc(p); return 0.1 * Math.sin(y * 1.4 + 0.4 * x + 2 * fbm(x * 0.2, y * 0.2)); } },
    wing: { ramp: ramp(["#040303", "#0d0b09", "#181512", "#25201b", "#332c25", "#433a30", "#564a3d", "#6c5e4c"], 8), dither: 0.55, amb: 0.2,
      shade: p => { const [x, y] = loc(p); const a = Math.atan2(y - 30, x - 48); return 0.13 * Math.sin(a * 26) + 0.08 * Math.sin(Math.hypot(x - 48, y - 30) * 0.9); } },
    disc: { ramp: ramp(["#0e0b08", "#261f18", "#3e3226", "#584634", "#745c44", "#907458", "#ac8e6e"], 7), dither: 0.5, amb: 0.3,
      shade: p => { const [x, y] = loc(p); return 0.1 * Math.sin(Math.min(Math.hypot(x - 42.5, y - 32), Math.hypot(x - 53.5, y - 32)) * 1.8); } },
    beak: { ramp: ramp(["#060504", "#1a1610", "#342c1e", "#52462e", "#746444"], 5), spec: 1.2, pow: 35, specCol: "#c0ac80", dither: 0.4 },
    claw: { ramp: ramp(["#030303", "#0c0b0a", "#1a1816", "#2c2a26", "#44403a"], 5), spec: 1.2, pow: 40, specCol: "#9a948a", dither: 0.4 },
    toe: { ramp: ramp(["#060504", "#16120c", "#2a2216", "#403422", "#584830"], 5), spec: 0.5, pow: 25, dither: 0.45 },
    eye: { ramp: ["#5a3a00", "#a06a00", "#e0a010", "#ffd850", "#fff4b0"], emit: p => 0.35 + 0.65 * Math.max(0, p.nz) ** 2 },
    maw: { ramp: ["#000000", "#050404", "#0a0808"], amb: 0.1, dif: 0.2, noRim: true },
    ghost1: { ramp: ramp(["#141c1c", "#1d2828", "#283636", "#364646", "#485a58"], 5), dither: 0.7, amb: 0.3, noRim: true,
      shade: p => { const [x, y] = loc(p); return 0.12 * Math.sin(Math.atan2(y - 30, x - 48) * 26); } },
    ghost2: { ramp: ramp(["#111818", "#172020", "#1d2828", "#283636"], 4), dither: 0.7, amb: 0.3, noRim: true },
  };
  // 胴と頭 (手前へ迫る)
  const body = ellipsoid([48, 52, 2], [12.5, 16, 12], "feather");
  const head = ellipsoid([48, 31, 6], [13.5, 11, 11], "feather");
  const tufts = [cone([39, 24, 4], [33, 12, 1], 3.8, 0.4, "feather"), cone([57, 24, 4], [63, 12, 1], 3.8, 0.4, "feather")];
  const owl = Disp(U(2.2, body, head, ...tufts), (x, y, z) => 0.25 * Math.abs(Math.sin(x * 1.1 + y * 0.8)) * (y > 40 ? 1 : 0.4));
  // 顔盤: 二つの浅い皿
  const dishes = U(1.5, ellipsoid([42.5, 32, 18], [6.6, 6.8, 4], "disc"), ellipsoid([53.5, 32, 18], [6.6, 6.8, 4], "disc"));
  const face = Sub(owl, dishes, 1.0);
  const eyes = [sphere([42.8, 31.5, 13.4], 3.9, "eye"), sphere([53.2, 31.5, 13.4], 3.9, "eye")];
  const brow = [ellipsoid([42.5, 26.6, 15.5], [5.4, 1.4, 2], "feather", 12), ellipsoid([53.5, 26.6, 15.5], [5.4, 1.4, 2], "feather", -12)];
  const beak = tube([[48, 33, 17, 2], [48, 37, 18.5, 1.6], [48, 41, 17, 0.9], [47.6, 42.5, 15, 0.4]], "beak");
  // 翼: 大きく広げ、先が上へ反る (急降下の V 字)。後縁は風切羽のぎざぎざ
  const wingPoly = s => {
    const X = dx => 48 + s * dx;
    return [[X(8), 38], [X(18), 28], [X(30), 18], [X(40), 9], [X(46), 4], [X(45), 10], [X(47), 14], [X(44), 19], [X(46), 23], [X(42), 27], [X(44), 32], [X(39), 35], [X(40), 40], [X(34), 42], [X(34), 48], [X(28), 49], [X(26), 55], [X(20), 55], [X(16), 61], [X(10), 58]];
  };
  const wings = [-1, 1].map(s => Disp(slab(wingPoly(s), -2, 1.6, "wing", 0.8, 1.6), (x, y, z) => 0.25 * Math.abs(Math.sin(Math.atan2(y - 30, x - 48) * 26)) - 0.1));
  // 風切羽の芯 (前縁の骨)
  const arms = [-1, 1].map(s => tube([[48 + s * 9, 39, 1, 3.4], [48 + s * 20, 28, 0, 2.6], [48 + s * 33, 17, -1, 1.6], [48 + s * 45, 6, -2, 0.7]], "wing"));
  // 尾羽 (胴の後ろで扇に開く)
  const tail = slab([[42, 62], [54, 62], [60, 76], [55, 78], [51, 75], [48, 79], [45, 75], [41, 78], [36, 76]], -6, 1.2, "wing", 0.6);
  // 前へ突き出す脚と鉤爪
  const legs = [], claws = [];
  for (const s of [-1, 1]) {
    const hip = [48 + s * 6, 62, 6], ank = [48 + s * 9, 72, 15];
    legs.push(tube([[...hip, 4.4], [48 + s * 8, 67, 11, 3.6], [...ank, 1.8]], "feather"));
    for (const [dx, dy, dz] of [[-4, 6, 4], [0, 7, 5], [4, 6, 4], [s * 1, -2, 5]]) {
      const k = [ank[0] + dx * 0.7, ank[1] + dy * 0.6, ank[2] + dz * 0.7];
      legs.push(tube([[...ank, 1.4], [...k, 1.1]], "toe"));
      claws.push(tube([[...k, 1.0], [k[0] + dx * 0.4, k[1] + dy * 0.5, k[2] + 2.5, 0.65], [k[0] + dx * 0.5, k[1] + dy * 0.75 + 1.5, k[2] + 2, 0.15]], "claw", { seg: 2 }));
    }
  }
  // 残像の翼: 羽ばたきの上の位置に、霧色の翼を二重に (速すぎて翼が何枚にも見える)
  const rotP = (pts, cx, cy, deg) => { const a = deg * Math.PI / 180, c = Math.cos(a), s2 = Math.sin(a); return pts.map(([x, y]) => [cx + c * (x - cx) - s2 * (y - cy), cy + s2 * (x - cx) + c * (y - cy)]); };
  const ghostW = [];
  for (const [deg, mat, z] of [[13, "ghost1", -8], [25, "ghost2", -14]]) for (const sd of [-1, 1])
    ghostW.push(slab(rotP(wingPoly(sd), 48 + sd * 8, 38, -sd * deg), z, 1.2, mat, 0.6));
  const scene = xf(U(0, ...ghostW, tail, ...wings, ...arms, face, ...brow, ...eyes, beak, ...legs, ...claws));
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [48, 32, 26], r: 16, k: 0.2 }] });
  const C = new Canvas(r);
  // 瞳: 黒い縦長の瞳孔と光点
  for (const ex of [42.8, 53.2]) { const [a, b] = fwd(ex, 31.6); C.disc(a, b, 1.7, "#000000"); const [c, d] = fwd(ex - 1.4, 30); C.set(c, d, "#fff8e0"); }
  // 翼の風切羽の切れ目: 手首から放射する暗い筋
  for (const sd of [-1, 1]) for (let k = 0; k < 10; k++) {
    const th = (-55 + k * 13) * Math.PI / 180, ux = sd * Math.cos(th), uy = Math.sin(th);
    for (let r = 7; r < 30; r += 0.5) {
      const [X, Y] = fwd(48 + sd * 24 + ux * r, 26 + uy * r).map(Math.round);
      const q = C.pix[Y * 96 + X]; if (q && q.m === "wing" && C.get(X, Y)) C.shift(X, Y, mats.wing.ramp, -2);
    }
  }
  // 残像の翼を半透明に (ディザで間引き、縁だけ少し濃く)
  const before = new Set();
  for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) {
    const q = C.pix[y * 96 + x]; if (!q || !C.get(x, y)) continue;
    if (q.m !== "ghost1" && q.m !== "ghost2") { before.add(y * 96 + x); continue; }
    let edge = 0; for (const [ex, ey] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = C.pix[(y + ey) * 96 + x + ex]; if (!n) edge = 1; }
    const a = edge ? 0.9 : (q.m === "ghost1" ? 0.6 : 0.35);
    if (a <= (BY[y & 3][x & 3] + 0.5) / 16) C.set(x, y, null);
  }
  // 羽ばたきの弧: 翼の先が通った軌跡を、肩を中心に淡い弧で描く (速すぎる翼)
  const L = ["#2e4442", "#4e6a66", "#7e9c96", "#b4ccc6"];
  for (const sd of [-1, 1]) for (const [tx, ty, k] of [[46, 4, 3], [44, 19, 2], [42, 27, 1]]) {
    const dx = tx - 8, dy = ty - 38, r0 = Math.hypot(dx, dy), a0 = Math.atan2(dy, dx);
    for (let t = 0.02; t < 0.5; t += 0.004) {
      const a = a0 - t * 0.9, lx = 48 + sd * (8 + Math.cos(a) * r0 * 1.04), ly = 38 + Math.sin(a) * r0 * 1.04;
      const [X, Y] = fwd(lx, ly).map(Math.round);
      if (X < 0 || Y < 0 || X >= 96 || Y >= 96 || before.has(Y * 96 + X)) continue;
      const fade = 1 - t / 0.5; if (fade < (BY[Y & 3][X & 3] + 0.5) / 16 * 0.9) continue;
      C.set(X, Y, L[Math.max(0, Math.round(k * fade))]);
    }
  }
  // 体の後ろに流れる短い速度の筋
  for (const [lx, ly, n] of [[26, 66, 7], [32, 72, 9], [64, 72, 9], [70, 66, 7]]) for (let i = 0; i < n; i++) { const X = lx, Y = ly - i; if (!before.has(Y * 96 + X)) C.set(X, Y, L[i < 3 ? 2 : 1]); }
  mist(C, 57, 3, [0, 50, 96, 46], 0.25);
  spores(C, 58, 10);
  return C.toArt();
}
