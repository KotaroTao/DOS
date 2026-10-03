import { tube, sphere, ellipsoid, cone, slab, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { RIM, WATER, puddle, ripples } from "../lib.mjs";
import { arcParam } from "../arc.mjs";
export const meta = { id: "el_bloatqueen", key: "hd_bloatqueen", w: 112, h: 128,
  note: "孕み蛭の女王 (強敵): 牛ほどもある雌の大蛭。半ば透けた巨大な腹の中に幾百の子が蠢き、鎌首の先の吸盤は花弁のように裂けて歯が並ぶ。足元には産み落とされた子蛭が這う" };
export function build() {
  const W = 112, H = 128;
  const mats = {
    skin: { ramp: ramp(["#050304", "#12080a", "#200c10", "#321216", "#4a1a1c", "#682822", "#8c3e2e", "#b4624a"], 8), spec: 1.4, pow: 45, specCol: "#f0c8b8", dither: 0.55 },
    sac: { ramp: ramp(["#080304", "#1c070a", "#34090e", "#521012", "#721a18", "#962c22", "#bc4a34", "#e07a56"], 8), spec: 1.6, pow: 55, specCol: "#ffe0d0", dither: 0.55, amb: 0.24,
      shade: p => 0.32 * Math.pow(1 - Math.abs(p.nz), 2) - 0.08 },
    lip: { ramp: ramp(["#080406", "#22100e", "#401c18", "#622e24", "#884632", "#b06a4c"], 6), spec: 0.9, pow: 30, specCol: "#f0c8b0", dither: 0.5 },
    maw: { ramp: ["#000000", "#000000", "#14040a", "#2c0a10", "#481218"], amb: 0.15, dif: 0.5 },
    young: { ramp: ramp(["#040203", "#140709", "#260c0e", "#3c1414", "#5a201c", "#7c3226"], 6), spec: 1.4, pow: 45, specCol: "#f0c0a8", dither: 0.5 },
    water: WATER,
  };
  // 腹: 床に据わった巨大な卵嚢、後ろへ環節が細る
  const sac = Disp(ellipsoid([64, 88, 0], [36, 24, 26], "sac", -6), (x, y, z) => 0.6 * fbm(x * 0.12, y * 0.12, z * 0.12) - 0.4 * Math.max(0, vnoise(x * 0.3, y * 0.3, z * 0.3) - 0.4));
  // 首: 腹の前から立ち上がり、吸盤は左上で正面を向く
  const neck = [[50, 92, 14, 14], [40, 80, 18, 13], [34, 64, 20, 12], [34, 48, 22, 11.5], [40, 36, 24, 11], [44, 30, 28, 11]];
  const s = arcParam(neck);
  const ring = (x, y, z) => 1.3 * Math.pow(1 - Math.abs(Math.sin(s(x, y, z) * Math.PI / 5)), 3) - 0.25 + 0.2 * fbm(x * 0.4, y * 0.4, z * 0.4);
  const neckN = Disp(tube(neck, "skin", { seg: 6, k: 2 }), ring);
  const tailR = [[90, 92, -8, 14], [100, 98, -12, 9], [106, 106, -14, 5], [104, 112, -12, 2.5]];
  const tail = Disp(tube(tailR, "skin", { seg: 4, k: 2 }), (x, y, z) => 1.0 * Math.pow(1 - Math.abs(Math.sin((x + y) * 0.4)), 3) - 0.2);
  // 吸盤: 花弁のように五つに裂けた口
  const disk = ellipsoid([44, 27, 33], [14, 13, 5.5], "lip", 0, -30);
  const head = Sub(U(3, neckN, disk), ellipsoid([44, 26.5, 39], [9.5, 9, 6.5], "maw", 0, -30), 1.2);
  const petals = [];
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 - Math.PI / 2; petals.push(ellipsoid([44 + Math.cos(a) * 13, 27 + Math.sin(a) * 12, 34], [5.5, 3.4, 2.4], "lip", a * 180 / Math.PI)); }
  // 産み落とされた子蛭
  const R = rand(29);
  const young = [];
  for (const [x, y, d, a] of [[8, 112, 1, 0.5], [30, 122, -1, -0.3], [92, 120, 1, -0.6], [78, 124, -1, 0.15]]) { const pts = []; for (let t = 0; t <= 1; t += 0.25) pts.push([x + t * 13 * d, y + Math.sin(t * 6.28) * 2 + t * 13 * a, 18, 2.4 - t * 0.9 + Math.sin(t * 3.14) * 0.7]); young.push(tube(pts, "young", { seg: 3 })); }
  const scene = U(0, puddle(56, 118, 54, 20), Paint(U(4, sac, tail), (x, y, z, m) => m), head, ...petals, ...young);
  const r = render(scene, mats, { w: W, h: H, rim: RIM });
  const C = new Canvas(r);
  // 腹の中で蠢く子蛭の影 (透けて見える)
  const SR = mats.sac.ramp;
  for (let i = 0; i < 28; i++) {
    const cx = 40 + R() * 50, cy = 72 + R() * 30, a = R() * 6.28, L = 5 + R() * 5;
    for (let t = 0; t <= 1; t += 0.08) { const x = Math.round(cx + Math.cos(a) * L * t + Math.sin(t * 6 + i) * 1.5), y = Math.round(cy + Math.sin(a) * L * t); const p = C.pix[y * W + x]; if (p && p.m === "sac" && SR.includes(C.get(x, y))) { C.shift(x, y, SR, -3); } }
  }
  // 歯
  const T = ["#4a3e30", "#7e705a", "#b8aa88", "#e8e0c8"];
  for (const [rx, ry, n, ln, off] of [[9, 8.4, 14, 3.4, 0], [5.4, 5, 9, 2.4, 0.5]]) for (let i = 0; i < n; i++) {
    const a = (i + off) / n * Math.PI * 2, cx = 44, cy = 27;
    const x0 = cx + Math.cos(a) * rx, y0 = cy + Math.sin(a) * ry, x1 = cx + Math.cos(a) * (rx - ln), y1 = cy + Math.sin(a) * (ry - ln);
    const lit = Math.cos(a - 3.9) > 0.2; C.line(x0, y0, x1, y1, lit ? T[2] : T[1]); C.set(x1, y1, lit ? T[3] : T[2]);
  }
  C.disc(44, 27.5, 2.2, "#000000");
  // 血と粘液の滴り
  for (const [x, y0, l] of [[36, 38, 8], [40, 40, 12], [50, 39, 6], [54, 36, 9]]) { for (let i = 0; i < l; i++) C.set(x, y0 + i, "#4a0e12"); C.set(x, y0 + l, "#9a2c24"); }
  ripples(C, 56, 118, 54);
  return C.toArt();
}
