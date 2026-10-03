import { tube, sphere, ellipsoid, cone, slab, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { RIM } from "../lib.mjs";
export const meta = { id: "bs_waterelemental", key: "hd_waterelemental", w: 96, h: 96,
  note: "水の精霊: 濁り水が人の形を結んだ精霊。逆巻く波頭の頭、両腕は流れとなって渦を巻き、足元は飛沫を上げる水柱に溶ける" };
export function build() {
  const mats = {
    water: { ramp: ramp(["#02060a", "#061420", "#0c2434", "#14384a", "#1e5062", "#2e6c7a", "#4a8e96", "#7cb6b8", "#c4e4e0"], 9), spec: 2.4, pow: 45, specCol: "#f0fffc", dither: 0.55, amb: 0.1,
      shade: p => 0.3 * Math.pow(1 - Math.abs(p.nz), 2) + 0.1 * Math.sin(p.y * 0.5 + fbm(p.x * 0.2, p.y * 0.2) * 5) - 0.12 }, // 縁が透けて明るい
    core: { ramp: ramp(["#020408", "#04101a", "#081c2a", "#0e2c3c", "#163e4e"], 5), dither: 0.6, amb: 0.1, spec: 2, pow: 45, specCol: "#e0fffa" },
    eye: { ramp: ["#4ab0c0", "#a8f0f0", "#ffffff"], emit: p => 0.6 + 0.5 * p.nz },
    pool: { ramp: ramp(["#020508", "#06121a", "#0c2028", "#163038", "#244850"], 5), spec: 1.4, pow: 80, specCol: "#88b8b8", dither: 0.8, amb: 0.5, dif: 0.4, noRim: true },
  };
  const flow = (x, y, z) => 0.6 * Math.sin(y * 0.55 + x * 0.15 + 2 * fbm(x * 0.12, y * 0.12, z * 0.12)) * 0.5 + 0.3 * fbm(x * 0.3, y * 0.3, z * 0.3);
  const head = ellipsoid([47, 24, 6], [8, 10, 8], "water", 8);
  // 波頭: 頭の後ろから前へ巻く波
  const crest = tube([[54, 30, -2, 5], [60, 20, -3, 6], [58, 9, -1, 5.5], [48, 4, 3, 4.5], [38, 6, 7, 3.5], [33, 12, 10, 2.5], [34, 17, 11, 1.6], [37, 18, 11, 0.8]], "water");
  const torso = ellipsoid([48, 46, 0], [14, 15, 10], "water");
  const waist = tube([[48, 56, 0, 10], [48, 66, 0, 7], [48, 76, 0, 9], [48, 86, -2, 14]], "water");
  const armL = tube([[36, 38, 2, 5.5], [24, 44, 8, 5], [16, 54, 12, 4.5], [18, 64, 14, 3.6], [26, 68, 14, 2.6], [30, 64, 14, 1.6]], "water");
  const armR = tube([[60, 38, 2, 5.5], [72, 34, 6, 5], [82, 24, 8, 4.2], [86, 14, 8, 3.2], [82, 8, 8, 2], [78, 10, 8, 1.2]], "water");
  const body = Disp(U(4, head, crest, torso, waist, armL, armR), flow);
  const core = ellipsoid([48, 46, 8], [5, 6, 3], "core");
  const eyes = [ellipsoid([43.5, 23, 13], [1.8, 1.1, 1], "eye", -15), ellipsoid([51, 23.5, 12.5], [1.8, 1.1, 1], "eye", 15)];
  const pool = Disp(ellipsoid([48, 89, -2], [40, 3.5, 16], "pool"), (x, y, z) => 0.3 * Math.sin(Math.hypot(x - 48, (z + 2) * 2.4) * 1.0));
  const scene = U(0, pool, body, core, ...eyes);
  const r = render(scene, mats, { w: 96, h: 96, rim: "#7cb6b8", rimTh: 0.2 });
  const C = new Canvas(r);
  const R0 = rand(77);
  // 波頭の白い泡
  for (let i = 0; i < 40; i++) { const t = R0(); const a = Math.PI * (0.9 + t * 1.3), x = 47 + Math.cos(a) * (11 + R0() * 3), y = 12 + Math.sin(a) * (8 + R0() * 2); if (R0() < 0.6) C.set(x, y, R0() < 0.5 ? "#c4e4e0" : "#f0fffc"); }
  // 体内の泡
  const R = rand(13);
  const B = ["#4a8e96", "#7cb6b8", "#c4e4e0"];
  for (let i = 0; i < 26; i++) { const x = 36 + R() * 24, y = 32 + R() * 50; const p = C.pix[Math.round(y) * 96 + Math.round(x)]; if (p && p.m === "water") { C.set(x, y, B[Math.floor(R() * 2)]); if (R() < 0.3) C.set(x - 1, y - 1, B[2]); } }
  // 飛沫: 足元と腕の先から散る
  for (let i = 0; i < 46; i++) { const a = R() * Math.PI, d = 8 + R() * 30; const x = 48 + Math.cos(a) * d * 1.3, y = 88 - Math.sin(a) * d * 0.6; if (!C.get(Math.round(x), Math.round(y))) C.set(x, y, B[Math.floor(R() * 3)]); }
  for (let i = 0; i < 18; i++) { const x = 76 + R() * 18, y = 2 + R() * 18; if (!C.get(Math.round(x), Math.round(y))) C.set(x, y, B[Math.floor(R() * 3)]); }
  for (let i = 0; i < 14; i++) { const x = 22 + R() * 16, y = 64 + R() * 14; if (!C.get(Math.round(x), Math.round(y))) C.set(x, y, B[Math.floor(R() * 3)]); }
  return C.toArt();
}
