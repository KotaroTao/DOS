import { tube, sphere, ellipsoid, cone, cyl, torus, slab, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { FLAG, POOL, MARBLE, RIM, PHOS, templeFloor, ripples, bubbles, motes } from "../temple.mjs";
export const meta = { id: "bs_fonthorror", key: "hd_fonthorror", w: 96, h: 96,
  note: "聖水盤の異形: 彫刻のある石の聖水盤から、ぬめる肉の塊と触手があふれ出す。盤の縁にいくつもの濁った眼。腐った聖水を口から噴き出して前へ浴びせ (ブレス)、盤の縁からも黒緑の水がこぼれる。削いだ肉はすぐ盛り上がる" };
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
export function build() {
  const mats = {
    flesh: { ramp: ramp(["#040404", "#0e0c0d", "#1c1619", "#2a2026", "#3a2c34", "#4c3a44", "#624c56", "#7a6068"], 8), spec: 1.1, pow: 34, specCol: "#c0a8b0", dither: 0.5, amb: 0.18,
      shade: p => 0.12 * fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5) },
    eye: { ramp: ["#4a4a20", "#a8a040", "#e8e4a0"], emit: p => 0.45 + 0.55 * Math.max(0, p.nz) },
    pupil: { ramp: ["#000000", "#050403"], amb: 0.1, dif: 0.1, noRim: true },
    maw: { ramp: ["#000000", "#050304", "#0c0709"], amb: 0.1, dif: 0.2, noRim: true },
    foul: { ramp: ramp(["#06100c", "#0e2018", "#183024", "#244432", "#345a42", "#4a7656", "#68946c"], 7), dither: 0.75, amb: 0.2, dif: 0.7, noRim: true,
      shade: p => 0.12 * Math.sin(p.y * 1.5 + p.x * 0.3) },
    flag: FLAG, pool: POOL, marble: MARBLE,
  };
  const R = rand(621);
  // 聖水盤: 太い柱の台座の上に、縁の厚い浅い鉢。縁に彫りの帯
  const basin = Sub(U(1.2, cyl([46, 87, 0], [46, 72, 0], 6, "marble", 1), ellipsoid([46, 87, 0], [11, 3, 9], "marble"), ellipsoid([46, 72, 0], [9, 3, 8], "marble"),
    ellipsoid([46, 64, 0], [25, 9, 16], "marble")), ellipsoid([46, 57, 0], [23, 7, 14.5], "marble"), 0.8);
  const rimBand = Disp(torus([46, 58, 0], 24, 2.4, "marble", 0, -80), (x, y, z) => 0.35 * Math.abs(Math.sin(Math.atan2(z, x - 46) * 16)));
  // 鉢の腹の彫り (縦の溝)
  const flutes = (x, y, z, m) => m === "marble" && y > 61 && y < 70 && Math.abs(Math.sin((x - 46) * 0.9)) > 0.92 ? "pool" : m;
  // 盤からあふれる肉の塊: 大きな頭のこぶと、前へ伸びる喉
  const mass = Disp(U(4, ellipsoid([46, 50, -2], [17, 8, 11], "flesh"), ellipsoid([45, 38, 0], [10, 10, 8], "flesh"), ellipsoid([53, 41, 6], [7, 6, 6], "flesh"), ellipsoid([36, 45, 4], [6, 5, 5], "flesh")),
    (x, y, z) => 0.8 * fbm(x * 0.22, y * 0.22, z * 0.22) + 0.3 * Math.max(0, vnoise(x * 0.6, y * 0.6, z * 0.6)));
  // 口: 塊の前の大きな裂け目から聖水を噴く
  const mouth = ellipsoid([55, 42, 12], [4.4, 3.4, 4], "maw", -25);
  // 縁の眼 (大小)
  const eyesAt = [[34, 37, 8, 2.4], [43, 31, 9, 2.8], [52, 31, 8, 2], [40, 47, 12, 1.7], [30, 48, 8, 1.5], [61, 50, 10, 1.6], [48, 52, 12, 1.4]];
  const eyes = [], pupils = [];
  for (const [x, y, z, s] of eyesAt) { eyes.push(sphere([x, y, z], s, "eye")); pupils.push(ellipsoid([x + s * 0.2, y, z + s * 0.75], [s * 0.3, s * 0.7, s * 0.4], "pupil")); }
  // 触手: 盤の縁から床へ垂れ、宙をうねる
  const tent = [];
  for (const [x0, y0, z0, dx, dy, r0] of [[24, 58, 8, -14, 24, 2.8], [24, 52, 0, -16, -10, 2.4], [68, 57, 8, 10, 26, 2.8], [36, 33, -2, -12, -18, 1.8], [62, 50, 0, 12, -16, 2]]) {
    const pts = [];
    for (let k = 0; k <= 5; k++) { const u = k / 5; pts.push([x0 + dx * u + Math.sin(u * 5 + x0) * 2.4, y0 + dy * u - Math.sin(u * 3.1) * 3 * Math.sign(dy), z0 + u * 3, r0 * (1 - u * 0.75)]); }
    tent.push(tube(pts, "flesh", { seg: 3 }));
  }
  // 盤の縁からこぼれる腐った水と、口から噴く流れ (ブレス)
  const spill = [];
  for (const [x, z] of [[31, 10], [52, 15], [62, 9]]) spill.push(Disp(tube([[x, 60, z, 1.3], [x + (x - 46) * 0.05, 70, z + 1.4, 0.9], [x + (x - 46) * 0.08, 80, z + 2, 0.7], [x + (x - 46) * 0.1, 89, z + 2.4, 1.4]], "foul", { seg: 3 }), (X, Y, Z) => 0.25 * Math.sin(Y * 1.4)));
  const jet = Disp(tube([[58, 43, 14, 2.4], [64, 45, 16, 2.8], [70, 48, 17, 2.6]], "foul", { seg: 3 }), (x, y, z) => 0.7 * fbm(x * 0.4, y * 0.4, z * 0.4));
  const scene = U(0, templeFloor(46, 91, 46, 14, { n: 3, seed: 623, wet: 0.35 }), Paint(basin, flutes), rimBand, Paint(Sub(mass, mouth, 0.6), (x, y, z, m) => m), ...eyes, ...pupils, ...tent, ...spill, jet);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, bounce: 0.1, lights: [{ p: [62, 44, 26], r: 22, k: 0.3 }] });
  const C = new Canvas(r);
  // 浴びせる水の飛沫 (前方へ散る点)
  const F = mats.foul.ramp;
  // 噴き出す流れ: 口から前へ扇に広がる何本もの筋と飛沫
  for (let j = 0; j < 9; j++) {
    const spread = (j - 4) * 0.07, w = 1 - Math.abs(j - 4) / 5;
    for (let t = 0; t < 1; t += 0.012) {
      const x = 70 + t * 25, y = 48 + t * 6 + spread * t * 60 + t * t * 10;
      if (R() < 0.15 + 0.6 * w * (1 - t)) { const X = Math.round(x), Y = Math.round(y); if (!C.get(X, Y)) C.set(X, Y, F[Math.min(6, 2 + Math.floor(R() * 3 + w * 2 * (1 - t)))]); }
    }
  }
  for (let i = 0; i < 50; i++) {
    const t = R(), x = 74 + t * 21 + (R() - 0.5) * 4, y = 48 + t * 9 + (R() - 0.5) * (4 + t * 20);
    if (!C.get(Math.round(x), Math.round(y))) C.set(x, y, F[1 + Math.floor(R() * 4)]);
  }
  // 眼の芯の光
  for (const [x, y, , s] of eyesAt) C.set(x - s * 0.4, y - s * 0.4, "#e8e4a0");
  ripples(C, 625);
  bubbles(C, 627, 11, [4, 4, 88, 60]);
  motes(C, 629, 16, [4, 4, 88, 80], true);
  return C.toArt();
}
