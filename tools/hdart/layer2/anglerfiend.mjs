import { tube, sphere, ellipsoid, cone, slab, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { RIM } from "../lib.mjs";
export const meta = { id: "bs_anglerfiend", key: "hd_anglerfiend", w: 96, h: 96,
  note: "提灯鮟鱇: 闇を漂う巨大な口の醜い魚。額の竿の先に青白い誘い灯、その光が下から照らす針の牙と、ぶら下がる皮弁" };
export function build() {
  const L = [12, 18, 26]; // 誘い灯の位置
  const mats = {
    skin: { ramp: ramp(["#030203", "#0c080b", "#181016", "#261a20", "#38262a", "#4e3634", "#6a4c44", "#8e6c5c"], 8), spec: 0.9, pow: 30, specCol: "#c8b0a0", dither: 0.55, amb: 0.08,
      shade: p => 0.08 * fbm(p.x * 0.35, p.y * 0.35, p.z * 0.35) },
    lit: { ramp: ramp(["#03060a", "#0a1820", "#123040", "#1e4c5c", "#367a86", "#68b0b0", "#b4e8e0"], 7), spec: 1, pow: 30, specCol: "#e8fffa", dither: 0.5 },
    maw: { ramp: ["#000000", "#000000", "#0a0306", "#1a080c", "#2e0e14"], amb: 0.1, dif: 0.4 },
    fin: { ramp: ramp(["#030203", "#0e090c", "#1c1216", "#2c1c1e", "#40282a"], 5), dither: 0.6, shade: p => 0.1 * Math.sin(p.x * 1.5 + p.y * 0.8) },
    lure: { ramp: ["#1c4a50", "#3c8a8a", "#7cd0c4", "#c8fff0", "#ffffff"], emit: p => 0.55 + 0.6 * Math.max(0, -(p.nx * 0.5 + p.ny * 0.6) + p.nz * 0.7), dither: 0.3 },
    stalk: { ramp: ramp(["#040304", "#14100f", "#2a201c", "#463630"], 4), dither: 0.4 },
  };
  const bump = (x, y, z) => 0.6 * Math.max(0, vnoise(x * 0.35, y * 0.35, z * 0.35) - 0.25) + 0.2 * fbm(x * 0.6, y * 0.6, z * 0.6);
  // 体: 頭でっかちの球、右へ細る尾
  const head = ellipsoid([46, 50, 0], [30, 27, 24], "skin", -8);
  const tail = tube([[70, 52, -6, 14], [82, 56, -8, 8], [88, 58, -8, 4]], "skin");
  const jaw = ellipsoid([36, 66, 10], [26, 12, 18], "skin", -12); // 突き出た下顎
  const fish = Sub(U(4, head, tail, jaw), ellipsoid([31, 58, 24], [21, 9, 16], "maw", -14), 2);
  const finT = slab([[84, 50], [92, 40], [95, 44], [93, 58], [95, 70], [91, 74], [84, 64]], -8, 1.4, "fin", 0.6);
  const finD = slab([[54, 26], [60, 18], [66, 20], [70, 30], [62, 30]], -4, 1.2, "fin", 0.6);
  const pect = slab([[56, 66], [62, 78], [68, 82], [70, 72], [64, 64]], 16, 1.2, "fin", 0.6);
  // 竿: 額から前へ弧を描き、先端に灯
  const rod = tube([[36, 25, 12, 1.4], [30, 12, 16, 1.1], [20, 8, 20, 0.9], [13, 13, 24, 0.8], [12, 16, 25, 0.7]], "stalk");
  const lure = sphere(L, 3.4, "lure");
  const eye = sphere([48, 38, 20], 2.4, "skin");
  const lit = (x, y, z, m) => m === "skin" && Math.hypot(x - L[0], y - L[1], z - L[2]) < 34 && (x - L[0]) * -0.0 + 1 > 0 ? m : m;
  const scene = U(0, finT, finD, Paint(Disp(fish, bump), lit), pect, rod, lure, eye);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: L, r: 46, k: 1.1 }] });
  const C = new Canvas(r);
  // 牙: 上下の顎から不揃いな針の牙、灯に照らされて白く
  const T = ["#1e2a2a", "#5a7a7a", "#9cc4bc", "#dcf4ec"];
  const R = rand(3);
  const fang = (x, y0, l, dir, lean) => { for (let k = 0; k < l; k++) { const c = k < 1 ? T[0] : k < l - 1 ? (x < 28 ? T[2] : T[1]) : (x < 28 ? T[3] : T[2]); C.set(x + lean * k, y0 + dir * k, c); } };
  const up = [[13, 50, 7, 0.25], [17, 50, 4, 0], [21, 50, 9, 0.15], [26, 50, 5, -0.1], [30, 51, 8, 0.1], [35, 51, 3, 0], [39, 51, 6, -0.15], [44, 52, 4, 0.1], [48, 52, 5, -0.1]];
  const dn = [[12, 66, 6, 0.3], [16, 67, 9, 0.15], [21, 67, 4, 0], [25, 67, 7, -0.1], [30, 67, 5, 0.1], [34, 66, 8, -0.1], [39, 66, 3, 0], [43, 65, 5, 0.1], [47, 64, 4, -0.1]];
  for (const [x, y, l, ln] of up) fang(x, y, l, 1, ln);
  for (const [x, y, l, ln] of dn) fang(x, y, l, -1, ln);
  // 眼: 小さく濁った白
  C.set(48, 38, "#9ab0a8"); C.set(47, 38, "#d8e8e0"); C.set(48, 39, "#000000");
  // 皮弁: 顎の縁から垂れる襤褸
  for (const [x, y, l] of [[22, 75, 4], [30, 77, 6], [40, 77, 3], [50, 74, 5], [58, 70, 3]]) for (let k = 0; k < l; k++) C.set(x + (k % 2), y + k, k === l - 1 ? "#3a2a26" : "#1a1214");
  // 灯の周りの光の粒
  for (let i = 0; i < 16; i++) { const a = R() * 6.28, d = 5 + R() * 7; const x = L[0] + Math.cos(a) * d, y = L[1] + Math.sin(a) * d; if (!C.get(Math.round(x), Math.round(y))) C.set(x, y, R() < 0.5 ? "#3c8a8a" : "#7cd0c4"); }
  return C.toArt();
}
