import { sphere, ellipsoid, cone, tube, torus, slab, cyl, U, Sub, Disp, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { humanoid, fingers } from "../human.mjs";
import { RIM, BOLT, SOULS, bolt2d, sparks, rain, windStreaks, afterimage, dissolve } from "../storm.mjs";
export const meta = { id: "bs_boltarcher", key: "hd_boltarcher", w: 96, h: 96,
  note: "雷弓の亡霊: 塔の物見窓を守り続けた弓兵の霊。ぼろぼろの頭巾と外套、腰から下は雨の霧にほどけている。古い長弓を引きしぼり、稲妻をつがえた矢を放つ。その矢は守りの加護や呪文の障りを射抜いてまとめて消し去る (打ち消し)。風に乗って位置を変え、刃をかわす (回避)" };
export function build() {
  const mats = {
    cloak: { ramp: ramp(["#030407", "#080b10", "#0f141b", "#171e28", "#212a36", "#2c3846", "#3a4858"], 7), dither: 0.65, amb: 0.26,
      shade: p => 0.12 * Math.sin(p.x * 1.2 + 2 * fbm(p.x * 0.2, p.y * 0.2)) },
    pale: { ramp: ramp(["#06080c", "#10161e", "#1c2632", "#2c3a48", "#3e5262", "#566e80", "#7290a2"], 7), dither: 0.5, amb: 0.3 },
    wood: { ramp: ramp(["#060403", "#140e08", "#24190e", "#382816", "#4e3a20", "#664e2c"], 6), spec: 0.4, pow: 20, dither: 0.45 },
    string: { ramp: ["#4c5a74", "#8a9ab8"], amb: 0.5 },
    hole: { ramp: ["#000000", "#010204"], amb: 0, dif: 0.05, noRim: true },
    eye: { ramp: [SOULS[2], SOULS[3], SOULS[4]], emit: () => 0.95 },
  };
  // 左を向いて弓を引く: 弓手 (左腕) を前へ、妻手 (右腕) を頬まで引く
  const J = { head: [52, 26, 2], neck: [53, 32, 1], chest: [54, 42, 0], waist: [56, 54, 0], hip: [57, 62, 0],
    shL: [46, 37, 4], elL: [36, 38, 6], haL: [24, 38, 8], shR: [62, 37, -2], elR: [64, 33, 2], haR: [54, 31, 6] };
  const body = humanoid(J, { skin: "cloak", head: "pale" }, { w: { headX: 4.6, headY: 5.6, chestX: 9, chestY: 8, chestZ: 6, waistX: 7, waistY: 7, hipX: 8, arm: 2.4, arm2: 2, wrist: 1.4 } });
  const hood = Disp(U(1.5, ellipsoid([54, 24, 0], [7, 7.6, 6.6], "cloak"), cone([56, 20, -2], [66, 14, -6], 4, 0.6, "cloak")), (x, y, z) => 0.4 * fbm(x * 0.4, y * 0.4));
  const hoodHole = ellipsoid([49, 27, 7], [4.6, 5.6, 4], "hole", 10);
  const face = ellipsoid([50, 27.6, 4.4], [3.6, 4.6, 3.4], "pale", 10);
  // 腰から下の外套の裾 (霧へほどける)
  const skirt = Disp(U(3, ellipsoid([58, 66, 0], [11, 10, 8], "cloak"), ellipsoid([60, 80, -2], [10, 10, 7], "cloak")), (x, y, z) => 0.8 * Math.abs(Math.sin(x * 0.8 + y * 0.1)) + 0.6 * fbm(x * 0.3, y * 0.3));
  const cape = Disp(slab([[60, 34], [70, 36], [86, 50], [92, 66], [84, 70], [78, 84], [66, 70]], -8, 0.9, "cloak", 0.5), (x, y, z) => 0.8 * Math.sin(y * 0.5 + x * 0.2));
  // 長弓 (弓手の拳を中心に縦へ反る) と弦
  const bowPts = [[26, 6, 8, 0.6], [22, 18, 8, 1.2], [21, 38, 8, 1.6], [22, 58, 8, 1.2], [26, 70, 8, 0.6]];
  const bow = tube(bowPts, "wood", { seg: 4 });
  const strings = [cyl([26, 6, 8], [54, 31, 7], 0.35, "string"), cyl([54, 31, 7], [26, 70, 8], 0.35, "string")];
  const hand = U(0.6, ellipsoid([23.6, 38, 9], [2, 2.4, 2], "pale"), ...fingers([54, 31, 6.6], 180, "pale", { n: 3, len: 3, spread: 20, r: 0.6, curl: 0.4 }));
  const quiver = U(0.6, cyl([66, 30, -6], [72, 50, -8], 3, "wood", 1), cone([66, 30, -6], [62, 22, -6], 0.6, 0.6, "wood"), cone([67, 30, -6], [65, 21, -6], 0.6, 0.6, "wood"));
  const eyes = [sphere([48.6, 26.6, 7.6], 0.7, "eye"), sphere([51.8, 26.6, 7.6], 0.7, "eye")];
  const scene = U(0, cape, quiver, Sub(U(1.5, body, hood, skirt), hoodHole, 0.4), face, bow, ...strings, hand, ...eyes);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [30, 31, 20], r: 26, k: 0.5 }] });
  const C = new Canvas(r);
  dissolve(C, 70, 94, { seed: 8, x0: 44, x1: 80, darken: mats.cloak.ramp });
  // 稲妻をつがえた矢 (弦から弓手を越えて左へ)
  for (let x = 2; x <= 54; x++) { const y = 31 + (54 - x) * 0.13; C.set(x, Math.round(y), x < 10 ? BOLT[4] : (x % 3 ? BOLT[3] : BOLT[4])); if (x % 2 === 0) C.set(x, Math.round(y) - 1, BOLT[1]); }
  bolt2d(C, 2, 37, 0, 52, { seed: 3, jag: 1.4, branch: 0 });
  bolt2d(C, 4, 35, 0, 22, { seed: 5, jag: 1.4, branch: 0 });
  // 鏃の先で砕ける加護の輪 (打ち消し)
  for (let a = 0; a < Math.PI * 2; a += 0.06) { const x = 5 + Math.cos(a) * 4, y = 36 + Math.sin(a) * 7; if (!C.get(Math.round(x), Math.round(y)) && Math.sin(a * 5) > 0.2) C.set(x, y, SOULS[2]); }
  afterimage(C, [[7, 0, 0.35, "#0d141c"], [14, 0, 0.2, "#0a0f15"]], [16, 10, 70, 80]);
  windStreaks(C, 11301, 16, [0, 40, 96, 50]);
  rain(C, 11303, 40);
  sparks(C, 11305, 8, [0, 20, 30, 30]);
  return C.toArt();
}
