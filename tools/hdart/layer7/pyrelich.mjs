import { sphere, ellipsoid, cone, tube, cyl, torus, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { fingers } from "../human.mjs";
import { BASALT, CRUST, LAVA, RIM, EMBER, lavaFloor, underglow, embers, flame2d } from "../lava.mjs";
export const meta = { id: "bs_pyrelich", key: "hd_pyrelich", w: 96, h: 96,
  note: "業火の祭司: 火を拝む教団の祭司の骸。焦げた赤黒の法衣に高い冠帽、骨ばった頬の頭蓋に赤い残り火の眼。片手で長い杖の先の火皿を掲げ、もう片手の上に火の大呪の輪が回る (全体呪文)。法衣の裾には火の印の刺繍" };
export function build() {
  const mats = {
    robe: { ramp: ramp(["#030101", "#0c0304", "#170607", "#230a0a", "#320f0d", "#431512", "#561c16"], 7), dither: 0.6, spec: 0.15,
      shade: p => 0.14 * Math.sin(p.x * 0.8 + 2.4 * fbm(p.x * 0.12, p.y * 0.08, p.z * 0.12)) },
    trim: { ramp: ramp(["#1a0e04", "#3e2408", "#6a420e", "#9a6a1a", "#c89a34"], 5), spec: 1, pow: 26, specCol: "#f0d080", dither: 0.4 },
    bone: { ramp: ramp(["#0a0806", "#221c16", "#3c3228", "#5a4c3e", "#7c6c5a", "#a29078", "#c8b8a0"], 7), spec: 0.5, pow: 18, dither: 0.5 },
    staff: { ramp: ramp(["#030202", "#0e0907", "#1c120c", "#2c1d13", "#3e2a1c"], 5), spec: 0.4, dither: 0.5 },
    eye: { ramp: ["#7a1a06", "#f07a1c", "#ffdc7a"], emit: () => 0.85 },
    rune: { ramp: ["#5a1004", "#b8340a", "#f07a1c", "#ffc04a", "#fff0b0"], noRim: true, emit: p => 0.45 + 0.5 * Math.max(0, p.nz) },
    hole: { ramp: ["#000000", "#040101"], amb: 0, dif: 0.1, noRim: true },
    basalt: BASALT, crust: CRUST, lava: LAVA,
  };
  // 法衣: 肩から裾へ大きく広がる釣鐘形。腰の前に垂れ布
  const robe = Disp(U(3, ellipsoid([46, 40, 0], [12, 9, 8], "robe"), cone([46, 42, 0], [46, 86, -1], 11, 19, "robe"), ellipsoid([46, 86, -1], [19, 3, 13], "robe")),
    (x, y, z) => 0.6 * Math.abs(Math.sin(x * 0.55 + 1.5 * fbm(x * 0.1, y * 0.1))) * Math.min(1, Math.max(0, (y - 50) / 20)) + 0.2 * fbm(x * 0.5, y * 0.5, z * 0.5));
  const stole = Paint(Disp(cone([46, 44, 8], [46, 84, 12], 2.4, 3.6, "trim"), (x, y, z) => 0.2 * fbm(x, y, z)), (x, y, z, m) => m);
  // 頭蓋と冠帽
  const skull = ellipsoid([46, 27, 3], [5, 6, 5], "bone");
  const jaw = ellipsoid([46, 32.5, 4.5], [3.6, 2.2, 3.4], "bone");
  const sockets = U(0, ellipsoid([44, 26.5, 8], [1.6, 1.4, 2], "hole"), ellipsoid([48.2, 26.5, 8], [1.6, 1.4, 2], "hole"), ellipsoid([46, 29.4, 8], [0.9, 1.1, 2], "hole"));
  const mitre = U(1, cone([46, 23, 2], [46, 6, 1], 6.2, 2.4, "robe"), torus([46, 22.5, 2.5], 5.6, 0.9, "trim", 0, 0), cone([46, 21, 7.2], [46, 9, 4.6], 1, 0.6, "trim"));
  const hood = Sub(ellipsoid([46, 30, 0], [9, 10, 8], "robe"), ellipsoid([46, 29, 7], [6.5, 8, 6], "robe"), 1);
  // 腕: 右手 (画面左) は杖、左手 (画面右) は呪の輪を掲げる
  const sleeveL = tube([[38, 40, 3, 4.4], [30, 48, 6, 4.6], [28, 56, 8, 5.2]], "robe");
  const sleeveR = tube([[54, 40, 2, 4.4], [62, 36, 6, 4.2], [70, 30, 8, 4.4]], "robe");
  const handL = [sphere([28, 58, 9], 1.8, "bone"), ...fingers([28, 58, 9], -90, "bone", { n: 4, len: 4, spread: 20, r: 0.6, curl: -0.4, z: 1 })];
  const handR = [sphere([72, 27, 9], 1.8, "bone"), ...fingers([72, 27, 9], -70, "bone", { n: 4, len: 5, spread: 40, r: 0.6, curl: 0.3, z: 1 })];
  const staff = cyl([26, 88, 9], [28, 14, 9], 1.1, "staff");
  const bowl = U(1, cone([28, 16, 9], [28, 11, 9], 1.2, 4.6, "trim"), torus([28, 11, 9], 4.4, 0.6, "trim", 0, 0));
  const ring1 = torus([74, 16, 8], 9, 0.8, "rune", 0, -70);
  const ring2 = torus([74, 16, 8], 6, 0.5, "rune", 0, -70);
  const eyes = [sphere([44, 26.8, 7], 0.8, "eye"), sphere([48.2, 26.8, 7], 0.8, "eye")];
  const scene = U(0, lavaFloor(48, 91, 42, 13, { n: 3, seed: 7901 }), U(1.2, robe, hood, sleeveL, sleeveR), stole, Sub(U(1, skull, jaw), sockets, 0.3), mitre, ...handL, ...handR, staff, bowl, ring1, ring2, ...eyes);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [74, 16, 14], r: 26, k: 0.3 }, { p: [28, 8, 14], r: 18, k: 0.3 }] });
  const C = new Canvas(r);
  // 火皿の炎と、呪の輪の中の火の玉
  flame2d(C, 28, 10, 4, 12, { seed: 3 });
  C.disc(74, 16, 3.2, "#d24e10"); C.disc(73.4, 15.4, 2.2, "#ffae3a"); C.disc(73, 15, 1, "#fff0b0");
  // 輪に刻まれた火の印
  for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283, x = 74 + Math.cos(a) * 7.5 * 0.34, y = 16 + Math.sin(a) * 7.5; if (i % 2 === 0) C.set(x, y, EMBER[3]); }
  // 裾の火の印の刺繍
  for (let x = 30; x < 64; x += 5) { const y = 82 + Math.round(Math.sin(x) * 0.5); if (C.get(x, y)) { C.set(x, y, "#9a6a1a"); C.set(x, y - 1, "#c89a34"); C.set(x - 1, y, "#6a420e"); C.set(x + 1, y, "#6a420e"); } }
  underglow(C, { skip: ["eye", "rune"] });
  embers(C, 7903, 26, [4, 2, 88, 70]);
  return C.toArt();
}
