import { tube, sphere, ellipsoid, cone, cyl, box, torus, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { RIM } from "../mine.mjs";
export const meta = { id: "bs_blastsprite", key: "hd_blastsprite", w: 96, h: 96,
  note: "坑火の精: 割れた坑夫の安全灯から噴き出した可燃ガスの火の精。揺らめく炎の上半身に虚ろな眼と裂けた口、両腕は炎の舌。灯の真鍮の籠は歪み、硝子は砕けている" };
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
export function build() {
  // 炎は自ら光る: 芯ほど白く、外ほど赤黒い
  const flameRamp = ["#1a0402", "#3c0a02", "#6a1804", "#9a2c06", "#c84a0c", "#e8701a", "#f89c34", "#ffc864", "#fff0b4"];
  const mats = {
    flame: { ramp: flameRamp, emit: p => 0.02 + 0.62 * Math.max(0, p.nz) ** 1.6 * (0.45 + 0.55 * Math.max(0, 1 - Math.abs(p.y - 46) / 34)) + 0.22 * fbm(p.x * 0.2, p.y * 0.2 + 3, 1) - 0.25 * Math.max(0, (34 - p.y) / 30) },
    brass: { ramp: ramp(["#050302", "#160f05", "#2c1f0a", "#463210", "#644a18", "#866624", "#a88636"], 7), spec: 1.4, pow: 35, specCol: "#ffe0a0", dither: 0.4 },
    glass: { ramp: ["#140804", "#3a1c0c", "#6a3a1c"], spec: 2, pow: 60, specCol: "#ffe8c0", dither: 0.3 },
    hole: { ramp: ["#000000", "#0a0202", "#160402"], amb: 0, dif: 0.1, noRim: true },
  };
  const lick = (x, y, z) => 2.2 * fbm(x * 0.13, y * 0.09 + 1.5, z * 0.13, 4) * Math.min(1, Math.max(0.2, (70 - y) / 30));
  const head = ellipsoid([48, 26, 6], [9, 10, 8], "flame");
  const torso = ellipsoid([48, 45, 2], [12, 13, 9], "flame");
  const neck = ellipsoid([48, 62, 2], [7, 8, 6], "flame");
  // 炎の舌の腕と、頭から立ちのぼる火柱
  const armL = tube([[38, 40, 2, 4.4], [27, 44, 6, 3.6], [18, 36, 8, 2.6], [14, 24, 8, 1.6], [16, 14, 6, 0.6]], "flame");
  const armR = tube([[58, 40, 2, 4.4], [69, 46, 6, 3.6], [78, 40, 8, 2.6], [82, 28, 8, 1.6], [80, 18, 6, 0.6]], "flame");
  const crest = [tube([[48, 20, 4, 5], [46, 10, 2, 3], [50, 2, 0, 0.6]], "flame"), tube([[42, 22, 3, 3], [36, 12, 0, 1.6], [38, 4, -2, 0.4]], "flame"), tube([[54, 22, 3, 3], [60, 13, 0, 1.6], [57, 6, -2, 0.4]], "flame")];
  const spirit = Disp(U(4, head, torso, neck, armL, armR, ...crest), lick);
  // 吊り上がった眼と、横に裂けて歪んだ口
  const face = Sub(spirit, U(0, ellipsoid([43.5, 25, 13], [3, 1.4, 4], "hole", 28), ellipsoid([52.5, 25, 13], [3, 1.4, 4], "hole", -28), ellipsoid([48, 33, 13], [5.5, 1.6, 4], "hole", -6), ellipsoid([45, 34, 13], [2, 2, 4], "hole")), 0.6);
  // 安全灯: 歪んだ真鍮の籠、砕けた硝子、下の油壺
  const L = [48, 76, 2];
  const cage = [];
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + 0.3, r = 7.5; const bend = i === 1 ? 3 : 0; cage.push(tube([[L[0] + Math.cos(a) * r, 69, L[2] + Math.sin(a) * r, 0.8], [L[0] + Math.cos(a) * (r + bend), 76, L[2] + Math.sin(a) * (r + bend), 0.8], [L[0] + Math.cos(a) * r, 83, L[2] + Math.sin(a) * r, 0.8]], "brass")); }
  const rings = [torus([L[0], 68.5, L[2]], 8, 1.2, "brass", 0, 0), torus([L[0], 83.5, L[2]], 8, 1.2, "brass", 0, 0)];
  const pot = Disp(cyl([L[0], 84, L[2]], [L[0], 92, L[2]], 9, "brass", 1.5), (x, y, z) => (Math.hypot(x - 54, y - 89) < 2.5 ? 0.6 : 0));
  const shards = [box([42, 79, 9], [2, 3, 0.4], "glass", 0.2, 20), box([53, 81, 9], [1.6, 2.4, 0.4], "glass", 0.2, -30)];
  const scene = U(0, face, ...cage, ...rings, pot, ...shards);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [48, 60, 20], r: 34, k: 0.7 }] });
  const C = new Canvas(r);
  // 炎の縁はちらちらと欠け、舞い上がる火の粉
  for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) {
    const p = C.pix[y * 96 + x]; if (!p || p.m !== "flame") continue;
    const edge = !C.pix[y * 96 + x - 1] || !C.pix[y * 96 + x + 1] || !C.pix[(y - 1) * 96 + x];
    if (edge && fbm(x * 0.4, y * 0.4, 7) > 0.05) C.set(x, y, null);
  }
  const R = rand(61);
  for (let i = 0; i < 26; i++) { const x = 10 + R() * 76, y = 2 + R() * 60; if (!C.get(Math.round(x), Math.round(y))) C.set(x, y, flameRamp[4 + Math.floor(R() * 5)]); }
  // 眼窩の芯の白熱
  C.set(44, 25, "#fff0b4"); C.set(52, 25, "#fff0b4");
  for (const x of [44, 47, 50]) C.only(x, 33, "#ffc864");
  return C.toArt();
}
