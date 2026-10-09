import { sphere, ellipsoid, cone, tube, U, Sub, Disp, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { STAIR, PUDDLE, TOWER, RIM, BOLT, CLOUD, towerFloor, bolt2d, crackle, sparks, rain, clouds, afterimage } from "../storm.mjs";
export const meta = { id: "bs_stormelemental", key: "hd_stormelemental", w: 96, h: 96,
  note: "嵐の精: 塔に渦巻く雷雲がひとかたまりになり、人の上半身の形をとったもの。紫灰の雲の体は下へ行くほど渦に巻かれてほどけ、胸の奥で稲光が明滅する。両腕を掲げて頭上に稲妻の輪を回し、雷を隊全体へ降らせる (全体呪文・多用)。輪郭はいつも風に流れてぶれ、刃は雲をすり抜ける (回避)" };
export function build() {
  const mats = {
    cloud: { ramp: ramp(["#020205", "#07070e", "#0e0d19", "#161526", "#201f34", "#2b2a44", "#383756", "#4a4a6a"], 8), dither: 0.8, amb: 0.3,
      shade: p => 0.14 * Math.sin(Math.atan2(p.z, p.x - 48) * 3 + p.y * 0.35 + 2 * fbm(p.x * 0.2, p.y * 0.15)) },
    hole: { ramp: ["#000000", "#010103", "#030308"], amb: 0, dif: 0.05, noRim: true },
    core: { ramp: BOLT, noRim: true, emit: p => 0.45 + 0.5 * Math.max(0, p.nz) },
    eye: { ramp: [BOLT[2], BOLT[3], BOLT[4]], emit: () => 0.9 },
    stair: STAIR, puddle: PUDDLE, tower: TOWER,
  };
  // 渦: 下へ行くほど細くねじれる雲の柱
  const swirl = (x, y, z) => 1.6 * fbm(x * 0.2, y * 0.1, z * 0.2) + 0.9 * Math.sin(Math.atan2(z, x - 48) * 2 + y * 0.45);
  const torso = Disp(U(3.5, ellipsoid([48, 46, 0], [13, 11, 9], "cloud"), ellipsoid([47, 60, 0], [9, 10, 7], "cloud", -8), ellipsoid([44, 72, 0], [6, 8, 5], "cloud", -18), ellipsoid([40, 82, 0], [3.6, 6, 3.6], "cloud", -30)), swirl);
  const head = Disp(ellipsoid([48, 28, 3], [8, 9, 7], "cloud"), (x, y, z) => 0.9 * fbm(x * 0.3, y * 0.3, z * 0.3));
  // 頭の上で渦を巻いて流れる雲の髪 (右へなびく)
  const crest = Disp(tube([[44, 22, 0, 6], [52, 16, -3, 5], [62, 15, -5, 3.4], [70, 19, -6, 1.6]], "cloud", { seg: 3 }), (x, y, z) => 1 * fbm(x * 0.3, y * 0.3));
  const holes = U(0, ellipsoid([44.5, 28, 9.6], [2, 1.4, 1.6], "hole", -15), ellipsoid([51.5, 28, 9.6], [2, 1.4, 1.6], "hole", 15), ellipsoid([48, 34, 9], [2.6, 1.6, 1.6], "hole"));
  const arms = [
    Disp(tube([[36, 42, 2, 4], [24, 34, 5, 3], [16, 20, 6, 2], [14, 12, 6, 1.2]], "cloud", { seg: 3 }), (x, y, z) => 0.8 * fbm(x * 0.35, y * 0.35)),
    Disp(tube([[60, 42, 2, 4], [72, 34, 5, 3], [80, 20, 6, 2], [82, 12, 6, 1.2]], "cloud", { seg: 3 }), (x, y, z) => 0.8 * fbm(x * 0.35, y * 0.35)),
  ];
  const core = sphere([48, 48, 8], 4.4, "core");
  const eyes = [sphere([44.5, 27.8, 9.4], 0.8, "eye"), sphere([51.5, 27.8, 9.4], 0.8, "eye")];
  const body = Sub(U(2.5, torso, head, crest, ...arms), U(0, holes, sphere([48, 48, 10], 3.6, "hole")), 0.4);
  const scene = U(0, towerFloor(48, 94, 40, 12, { n: 1, seed: 10001, wet: 0.2 }), body, core, ...eyes);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [48, 48, 20], r: 24, k: 0.45 }, { p: [48, 6, 10], r: 26, k: 0.3 }] });
  const C = new Canvas(r);
  // 頭上に回る稲妻の輪
  const R = rand(10003);
  for (let a = 0; a < Math.PI * 2; a += 0.035) {
    const x = 48 + Math.cos(a) * 24 + (R() - 0.5) * 1.4, y = 7 + Math.sin(a) * 4.5 + (R() - 0.5) * 1.4;
    if (C.get(Math.round(x), Math.round(y))) continue;
    if (Math.sin(a * 6) > -0.4) { C.set(x, y, Math.sin(a * 11) > 0.3 ? BOLT[4] : BOLT[3]); if (!C.get(Math.round(x), Math.round(y) + 1)) C.set(x, y + 1, BOLT[1]); }
  }
  // 輪から隊へ落ちる稲妻
  bolt2d(C, 22, 12, 12, 62, { seed: 3, jag: 3, branch: 2 });
  bolt2d(C, 74, 12, 86, 66, { seed: 5, jag: 3, branch: 2 });
  bolt2d(C, 34, 13, 28, 38, { seed: 7, jag: 2, branch: 1, glow: false });
  crackle(C, 10005, ["cloud"], 0.012);
  afterimage(C, [[6, 1, 0.35, "#141326"], [-6, 0, 0.25, "#100f1e"]], [0, 16, 96, 64]);
  clouds(C, [[48, 88, 14, 4]], { dens: 0.8, seed: 3, own: ["stair", "puddle"] });
  rain(C, 10007, 40, [0, 0, 96, 92]);
  sparks(C, 10009, 16, [4, 16, 88, 70]);
  return C.toArt();
}
