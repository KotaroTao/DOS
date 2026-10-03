import { tube, sphere, ellipsoid, cone, slab, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
export const meta = { id: "bs_fogspecter", key: "hd_fogspecter", w: 96, h: 96,
  note: "汚水の靄: 水面から立ちのぼる瘴気が痩せた人の形をなした霊。引き伸ばされた顔に窪んだ眼と縦に裂けた口、長い腕は靄にほどけ、下は水面へ溶ける" };
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
export function build() {
  const mats = {
    fog: { ramp: ramp(["#05070a", "#0b1114", "#121c1e", "#1c2828", "#283632", "#36463c", "#4a5a48", "#66745a"], 8), dither: 0.9, amb: 0.22, dif: 0.8,
      shade: p => 0.2 * fbm(p.x * 0.16, p.y * 0.16 - 3, 1) },
    hole: { ramp: ["#000000", "#000000", "#020304"], amb: 0, dif: 0.2, noRim: true },
    water: { ramp: ramp(["#030506", "#081012", "#101c20", "#1a2c30"], 4), spec: 1.2, pow: 80, specCol: "#4a6a6c", dither: 0.8, amb: 0.5, dif: 0.4, noRim: true },
  };
  const wisp = (x, y, z) => 1.5 * fbm(x * 0.13, y * 0.11 - 1, z * 0.13, 4);
  const head = ellipsoid([49, 22, 6], [7, 11.5, 7], "fog", -8);
  const neck = tube([[48, 32, 4, 3.5], [47, 38, 3, 5]], "fog");
  const torso = Disp(ellipsoid([47, 50, 0], [11, 14, 8], "fog", 4), (x, y, z) => (y > 42 && y < 56 ? 0.45 * Math.max(0, Math.sin(y * 1.0)) : 0) * (Math.abs(x - 47) < 7 ? 1 : 0)); // 肋の影
  const skirt = tube([[47, 60, 0, 10], [50, 72, -2, 12], [54, 84, -4, 15]], "fog");
  const armL = tube([[38, 40, 2, 4], [28, 46, 8, 3.5], [18, 42, 12, 3], [10, 34, 14, 2.4], [6, 28, 14, 1.6]], "fog");
  const armR = tube([[56, 40, 2, 4], [64, 50, 6, 3.4], [70, 62, 10, 3], [74, 72, 12, 2.2], [76, 78, 12, 1.4]], "fog");
  const fingers = [];
  for (const [x, y, a] of [[6, 28, -140], [6, 28, -110], [6, 28, -80]]) { const r = a * Math.PI / 180; fingers.push(tube([[x, y, 14, 1.1], [x + Math.cos(r) * 5, y + Math.sin(r) * 5, 14, 0.6]], "fog")); }
  const body = Disp(U(3, head, neck, torso, skirt, armL, armR, ...fingers), wisp);
  const face = Sub(body, U(0, ellipsoid([45.5, 19, 12], [2.2, 3.6, 4], "hole", -8), ellipsoid([52, 20, 12], [2, 3.2, 4], "hole", -8), ellipsoid([49, 29, 12], [1.9, 5.5, 4], "hole", -6)), 1.0);
  const water = Disp(ellipsoid([52, 90, -2], [42, 3.5, 16], "water"), (x, y, z) => 0.25 * Math.sin(Math.hypot(x - 56, (z + 2) * 2.4) * 1.1));
  const scene = U(0, water, face);
  const r = render(scene, mats, { w: 96, h: 96, rim: "#4a5c50", rimTh: 0.1 });
  const C = new Canvas(r);
  // 靄の透け: 芯から離れ、下へ行くほど、組織的ディザで画素を抜く
  for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) {
    const p = C.pix[y * 96 + x]; if (!p || p.m !== "fog") continue;
    const fadeY = Math.max(0, (y - 58) / 30), fadeX = Math.max(0, (Math.abs(x - 47) - 16) / 30);
    const a = 1.05 - Math.max(fadeY, fadeX) * 1.2 + 0.45 * fbm(x * 0.18, y * 0.14, 9);
    if (a < (BAYER[y & 3][x & 3] + 0.5) / 16) C.set(x, y, null);
  }
  C.set(45, 19, "#2c3c34"); C.set(52, 20, "#2c3c34");
  // 立ちのぼる瘴気の筋と粒
  const R = rand(31);
  const F = ["#121c1e", "#1c2828", "#283632", "#36463c"];
  for (let i = 0; i < 50; i++) { const x = 4 + R() * 88, y = 2 + R() * 86; if (!C.get(Math.round(x), Math.round(y))) C.set(x, y, F[Math.floor(R() * 4)]); }
  for (const x0 of [16, 28, 70, 84]) { let x = x0; for (let y = 87; y > 46 + (x0 % 7) * 3; y -= 1) { x += Math.sin(y * 0.25 + x0) * 0.6; if ((y + x0) % 4 === 0 && !C.get(Math.round(x), y)) C.set(x, y, F[1 + (y % 4 === 0 ? 1 : 0)]); } }
  return C.toArt();
}
