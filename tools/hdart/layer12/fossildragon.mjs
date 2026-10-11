import { sphere, ellipsoid, cone, tube, box, cyl, U, Sub, Disp, render, Canvas, fbm, rand } from "../sdf.mjs";
import { BED, ROCK, GLASS, FRAME, MURKGLASS, MURK, SOOT, RIM, cavernFloor, cracks, spikes, soot, murkMotes, breathFan, puffs, shards } from "../cavern.mjs";
export const meta = { id: "bs_fossildragon", key: "hd_fossildragon", w: 96, h: 96,
  note: "化石竜: 岩に半ば呑まれて化石になった太古の竜の骨格。下半身と尾は岩盤に埋まり、石化した黄土色の肋骨・背骨・前脚・頭骨だけが岩から起き上がる。骨のすき間で濁った魂が琥珀に鈍く光る。石の顎を開いて砕けた岩と煤の息を吐く (ブレス・多用)。崩れかけた骨は致命の一撃を一度は耐える (不屈)" };
export function build() {
  const mats = {
    bone: { ramp: ["#0a0805", "#1c170f", "#30281a", "#483c28", "#625338", "#7e6c4a", "#9c8860", "#b6a27a"], dither: 0.45, amb: 0.24,
      shade: p => 0.08 * fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5) },
    hole: { ramp: ["#000000", "#060402"], amb: 0.05, dif: 0.1, noRim: true },
    core: { ramp: MURK.slice(1), noRim: true, emit: p => 0.4 + 0.4 * Math.max(0, p.nz) },
    bed: BED, rock: ROCK, glass: GLASS, frame: FRAME, murk: MURKGLASS,
  };
  const bones = (x, y, z) => cracks(0.5, 0.35)(x, y, z) + 0.15 * fbm(x * 0.5, y * 0.5, z * 0.5);
  // 岩盤 (右下で骨を呑む)
  const rock = Disp(U(4, ellipsoid([70, 88, -2], [30, 14, 14], "rock"), ellipsoid([86, 70, -6], [12, 18, 10], "rock")), (x, y, z) => 1.2 * fbm(x * 0.2, y * 0.2, z * 0.2) + cracks(0.6, 0.25)(x, y, z));
  // 背骨 (岩から左上へ立ち上がって首へ)
  const sp = [[80, 70, -2], [70, 62, 0], [60, 56, 0], [50, 50, 0], [42, 42, 2], [36, 32, 4], [30, 24, 6]];
  const verts = [];
  for (let i = 0; i < sp.length - 1; i++) for (let t = 0; t < 1; t += 0.34) {
    const p = sp[i].map((v, k) => v + (sp[i + 1][k] - v) * t);
    verts.push(ellipsoid(p, [2.8, 2.8, 2.8], "bone"), cone(p, [p[0] + 1, p[1] - 4.6, p[2] - 1], 1.2, 0.3, "bone"));
  }
  // 肋骨 (胴の下へ弧を描く)
  const ribs = [];
  for (let i = 0; i < 6; i++) { const x = 72 - i * 5.2, y = 64 - i * 3; ribs.push(tube([[x, y, 0, 1.3], [x - 4, y + 9, 8, 1.1], [x - 2, y + 18 - i, 6, 0.8]], "bone", { seg: 3 }), tube([[x, y, 0, 1.3], [x - 3, y + 9, -8, 1.1], [x - 1, y + 17 - i, -6, 0.8]], "bone", { seg: 3 })); }
  // 前脚 (床をつかむ)
  const arm = U(1, tube([[50, 54, 6, 3], [38, 66, 10, 2.4], [30, 88, 10, 2]], "bone", { seg: 3 }), ellipsoid([38, 66, 10], [3, 3, 3], "bone"));
  const claws = spikes([[[30, 88, 11], [24, 92, 12], 1.4, 0.2], [[30, 89, 9], [25, 94, 8], 1.3, 0.2], [[31, 89, 12], [28, 94, 14], 1.2, 0.2]], "bone");
  // 頭骨 (左を向き、顎を開く)
  const skull = Disp(U(2, ellipsoid([24, 22, 8], [10, 7, 7], "bone", -8), ellipsoid([12, 26, 10], [8, 3.6, 5], "bone", 10)), bones);
  const jaw = Disp(U(1, ellipsoid([14, 34, 9], [9, 2.2, 4], "bone", 26)), bones);
  const horns = spikes([[[28, 16, 4], [38, 6, 0], 2.4, 0.3], [[24, 15, 8], [28, 4, 8], 2, 0.3]], "bone");
  const holes = U(0, ellipsoid([24, 20, 14.4], [2.6, 2.4, 2], "hole"), ellipsoid([8, 25, 14], [1.4, 1, 1.4], "hole"), ellipsoid([30, 24, 13], [3, 2, 2], "hole"));
  const cores = [[24, 20, 12.6, 1.2], [60, 64, 0, 2.2], [52, 60, 0, 1.6], [66, 68, 0, 1.4]].map(([x, y, z, r]) => sphere([x, y, z], r, "core"));
  const scene = U(0, cavernFloor(50, 95, 46, 13, { seed: 13301, rocks: 2, lamps: 1 }), rock, Sub(U(0.8, ...verts, skull, jaw, ...horns, arm), holes, 0.2), ...ribs, ...claws, ...cores);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [58, 70, 10], r: 18, k: 0.35 }] });
  const C = new Canvas(r);
  // 砕けた岩と煤の息 (左下へ)
  breathFan(C, 8, 34, 108, 44, 62, { seed: 13303, cols: [SOOT[2], SOOT[3], SOOT[4], "#5c5248", "#7e7266"], dens: 1.1 });
  const R = rand(13305);
  for (let k = 0; k < 12; k++) { const t = 0.3 + R() * 0.7, a = (108 + (R() - 0.5) * 50) * Math.PI / 180, x = Math.round(8 + Math.cos(a) * 44 * t), y = Math.round(34 + Math.sin(a) * 44 * t); if (x < 1 || x > 94 || y > 94) continue; C.set(x, y, "#50463d"); C.set(x + 1, y, "#2f2823"); C.set(x, y + 1, "#0b0908"); }
  murkMotes(C, 13307, 16, [40, 40, 50, 40]);
  shards(C, 13309, ["bed"], 12);
  soot(C, 13311, 30);
  return C.toArt();
}
