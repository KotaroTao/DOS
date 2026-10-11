import { sphere, ellipsoid, cone, tube, box, cyl, torus, U, Sub, Disp, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { SAND, BLOOD, ASHBED, STONE, IRON, RIM, SOULS, sandFloor, ashfall, ashCoat, spikes, dents } from "../arena.mjs";
export const meta = { id: "bs_spikedgolem", key: "hd_spikedgolem", w: 96, h: 96,
  note: "鉄刺の像: 闘技場の仕掛けとして造られた、全身に鉄の刺を生やした大きな像。ずんぐりした鋳鉄の胴に太い腕、兜の細い覗き窓の奥に熾火の目。両腕を大きく広げ、重い足を踏ん張って仲間の前に立ちはだかる (護衛) — 前へ突き出した腕の刺が壁になる。分厚い鉄の体は刃をほとんど通さない (物理抵抗75)。刺の先には昔の挑戦者の布の切れ端が引っかかったまま" };
export function build() {
  const mats = {
    iron2: { ramp: ["#030303", "#0a0908", "#141210", "#1f1c19", "#2c2824", "#3b3631", "#4e4842", "#645d55"], spec: 0.9, pow: 26, specCol: "#a89a8a", dither: 0.45,
      shade: p => 0.08 * fbm(p.x * 0.4, p.y * 0.4, p.z * 0.4) - (fbm(p.x * 0.25 + 9, p.y * 0.25, p.z * 0.25) > 0.35 ? 0.1 : 0) },
    spike: { ramp: ["#040303", "#100d0b", "#221d19", "#3a332d", "#5a5048", "#82766a"], spec: 1.1, pow: 24, specCol: "#c8b8a4", dither: 0.4 },
    rust: { ramp: ["#040202", "#0e0806", "#1c110a", "#2c1b11", "#3e2617"], dither: 0.5, spec: 0.5, pow: 20 },
    cloth: { ramp: ["#0c0402", "#1e0c06", "#36160c", "#522412"], dither: 0.5 },
    hole: { ramp: ["#000000", "#010101"], amb: 0, dif: 0.05, noRim: true },
    eye: { ramp: ["#5a1a06", "#d44a10", "#ffb04a"], emit: () => 0.95 },
    sand: SAND, blood: BLOOD, ashbed: ASHBED, stone: STONE, iron: IRON,
  };
  const torso = Disp(U(3, ellipsoid([48, 50, 0], [17, 18, 13], "iron2"), box([48, 64, 0], [13, 6, 10], "iron2", 3)), dents(0.6, 0.3));
  const head = Disp(U(1.2, box([48, 26, 2], [7, 7, 7], "iron2", 2.4), cone([48, 21, 2], [48, 16, 2], 5, 2, "iron2")), dents(0.4, 0.4));
  const slit = box([48, 27, 9.4], [5, 0.9, 1.4], "hole");
  const eyes = [sphere([45.4, 27, 8], 0.8, "eye"), sphere([50.6, 27, 8], 0.8, "eye")];
  // 広げた腕 (肩から左右へ、前腕は前へ)
  const arms = [tube([[33, 40, 2, 6], [20, 48, 8, 5], [12, 58, 14, 5.4]], "iron2"), tube([[63, 40, 2, 6], [76, 48, 8, 5], [84, 58, 14, 5.4]], "iron2")];
  const fists = [Disp(ellipsoid([11, 62, 15], [5.6, 5, 5], "iron2"), dents(0.4, 0.5)), Disp(ellipsoid([85, 62, 15], [5.6, 5, 5], "iron2"), dents(0.4, 0.5))];
  const legs = [cyl([38, 68, 2], [36, 88, 4], 6, "iron2", 2), cyl([58, 68, 2], [60, 88, 4], 6, "iron2", 2)];
  const feet = [box([34, 90, 6], [8, 3, 7], "iron2", 1.5), box([62, 90, 6], [8, 3, 7], "iron2", 1.5)];
  // 全身の刺: 腕の上側・肩・頭・腿の外側・胸 (画面の中で長さが見える向きに)
  const R = rand(12301), list = [];
  const along = (pts, n, up, len, z = 0) => { for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, k = t * (pts.length - 1), j = Math.min(pts.length - 2, Math.floor(k)), f = k - j;
    const x = pts[j][0] + (pts[j + 1][0] - pts[j][0]) * f, y = pts[j][1] + (pts[j + 1][1] - pts[j][1]) * f, zz = pts[j][2] + (pts[j + 1][2] - pts[j][2]) * f, r = pts[j][3];
    const a = up + (R() - 0.5) * 0.5; list.push([[x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6, zz + z], [x + Math.cos(a) * (r + len), y + Math.sin(a) * (r + len), zz + z + 2], 1.9, 0.2]); } };
  along([[33, 40, 2, 6], [20, 48, 8, 5], [12, 58, 14, 5.4]], 4, -2.2, 6);
  along([[63, 40, 2, 6], [76, 48, 8, 5], [84, 58, 14, 5.4]], 4, -0.9, 6);
  along([[33, 40, 2, 6], [20, 48, 8, 5], [12, 58, 14, 5.4]], 3, 2.0, 5, 2);
  along([[63, 40, 2, 6], [76, 48, 8, 5], [84, 58, 14, 5.4]], 3, 1.1, 5, 2);
  along([[38, 68, 2, 6], [36, 86, 4, 6]], 3, Math.PI, 5, 2); along([[58, 68, 2, 6], [60, 86, 4, 6]], 3, 0, 5, 2);
  for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k - 2) * 0.45; list.push([[48 + Math.cos(a) * 5, 22 + Math.sin(a) * 3, 2], [48 + Math.cos(a) * 11, 22 + Math.sin(a) * 9, 2], 1.6, 0.2]); }
  for (const [x, y, dx, dy] of [[40, 44, -6, -3], [56, 44, 6, -3], [44, 54, -5, 2], [52, 54, 5, 2], [48, 62, 0, 5], [36, 52, -7, 0], [60, 52, 7, 0]]) list.push([[x, y, 11], [x + dx, y + dy, 16], 1.8, 0.2]);
  for (const [x, y] of [[11, 62], [85, 62]]) list.push([[x, y, 18], [x + (x < 48 ? -4 : 4), y + 2, 25], 1.6, 0.15]);
  const thorns = spikes(list, "spike");
  const rag = Disp(box([22, 46, 12], [2, 4, 0.5], "cloth", 0.3, 15), (x, y, z) => 0.4 * Math.sin(y * 1.4));
  const rag2 = Disp(box([66, 34, 12], [1.6, 3.4, 0.5], "cloth", 0.3, -20), (x, y, z) => 0.4 * Math.sin(y * 1.4));
  const scene = U(0, sandFloor(48, 95, 46, 14, { seed: 12303, blood: 0.05, ash: 0.15, flags: 2 }), Sub(U(2, torso, head), slit, 0.3), ...eyes, ...arms, ...fists, ...legs, ...feet, ...thorns, rag, rag2);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [48, 27, 14], r: 8, k: 0.5 }] });
  const C = new Canvas(r);
  ashCoat(C, ["iron2"], { th: -0.6, seed: 4 });
  ashfall(C, 12305, 60);
  return C.toArt();
}
