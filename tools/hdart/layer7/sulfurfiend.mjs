import { sphere, ellipsoid, cone, tube, U, Sub, Disp, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { humanoid, fingers } from "../human.mjs";
import { BASALT, CRUST, LAVA, RIM, lavaFloor, underglow, embers, puffs, afterimage, spikes, scaleAt } from "../lava.mjs";
export const meta = { id: "bs_sulfurfiend", key: "hd_sulfurfiend", w: 96, h: 96,
  note: "硫黄の鬼: 硫黄の結晶がこびりついた黄土色の肌の、痩せて手足の長い鬼。反り返った二本角、吊り上がった黄色い眼、かぎ爪を広げて低く飛びかかる。体の後ろには目にも止まらぬ速さの残像が二重に尾を引き" };
export function build() {
  const mats = {
    skin: { ramp: ramp(["#060402", "#140e05", "#241a08", "#36280c", "#4a3810", "#5e4a16", "#76601e", "#92782a"], 8), spec: 0.5, pow: 18, specCol: "#c8b058", dither: 0.6,
      shade: p => 0.1 * fbm(p.x * 0.6, p.y * 0.6, p.z * 0.6) + (vnoise(p.x * 0.6, p.y * 0.6, p.z * 0.6) > 0.55 ? 0.22 : 0) },
    horn: { ramp: ramp(["#040302", "#141009", "#2a2214", "#463a24", "#6a5a3a"], 5), spec: 0.9, pow: 26, dither: 0.4 },
    claw: { ramp: ["#120c06", "#3e3020", "#7a6644", "#c8b688"], spec: 1.2, pow: 30, dither: 0.3 },
    eye: { ramp: ["#5a4a04", "#c8a810", "#ffe040", "#fffcc0"], emit: p => 0.6 + 0.4 * Math.max(0, p.nz) },
    maw: { ramp: ["#000000", "#140604", "#2a0c06"], amb: 0.1, dif: 0.2, noRim: true },
    basalt: BASALT, crust: CRUST, lava: LAVA,
  };
  // 低く飛びかかる姿勢: 左へ身を投げ、腕を前と上へ
  const J = { head: [28, 36, 6], neck: [33, 40, 4], chest: [42, 46, 2], waist: [54, 50, 0], hip: [62, 52, -1],
    shL: [34, 42, 9], elL: [22, 46, 13], haL: [12, 42, 15], shR: [46, 40, -5], elR: [38, 30, -3], haR: [28, 22, 0],
    hpL: [60, 56, 5], knL: [52, 68, 9], ftL: [56, 84, 9], hpR: [66, 55, -6], knR: [78, 62, -7], ftR: [86, 80, -7] };
  const body = humanoid(J, { skin: "skin" }, { w: { headX: 5.4, headY: 5.6, chestX: 10, chestY: 8.4, waistX: 7, hipX: 7.4, arm: 3.2, arm2: 2.6, wrist: 1.8, thigh: 4.4, knee: 3, ankle: 2.1 } });
  const jaw = ellipsoid([23, 40, 7], [5, 3, 4], "skin", 20);
  const lean = Disp(U(1.5, body, jaw), (x, y, z) => 0.35 * fbm(x * 0.6, y * 0.6, z * 0.6));
  const maw = ellipsoid([21.5, 40, 10], [3.2, 1.4, 2], "maw", 15);
  const fiend = Sub(lean, maw, 0.3);
  const horns = [tube([[30, 31, 9, 1.8], [34, 24, 10, 1.3], [40, 21, 9, 0.8], [44, 23, 8, 0.3]], "horn"), tube([[32, 31, 1, 1.6], [37, 25, 0, 1.2], [43, 23, -1, 0.6], [46, 26, -1, 0.25]], "horn")];
  const claws = [...fingers(J.haL, 190, "claw", { n: 3, len: 7, spread: 28, r: 0.7, curl: 0.5, z: 0.5 }), ...fingers(J.haR, 230, "claw", { n: 3, len: 7, spread: 28, r: 0.7, curl: 0.5, z: 0.5 })];
  const toes = spikes([[[55, 84, 11], [50, 86, 12], 1], [[85, 80, -6], [80, 84, -5], 0.9]], "claw");
  const spines = spikes([[[44, 41, -2], [48, 33, -3], 1.4], [[50, 45, -2], [55, 37, -3], 1.3], [[56, 48, -2], [62, 41, -3], 1.2]], "horn");
  const eyes = [sphere([25.5, 34.5, 10.2], 0.95, "eye"), sphere([29.5, 34, 9.6], 0.85, "eye")];
  const tail = tube([[64, 52, -2, 1.8], [74, 46, -3, 1.3], [82, 40, -4, 0.9], [88, 34, -4, 0.4]], "skin");
  // 少し大きく: 足元を中心に 1.13 倍
  const scene = U(0, lavaFloor(54, 92, 42, 13, { n: 3, seed: 7601, cracks: 0.88 }), scaleAt(U(0, fiend, ...horns, ...claws, ...toes, ...spines, ...eyes, tail), 1.13, 54, 86));
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  C.set(24, 33, "#fffcc0");
  // 神速の残像 (右後ろへ二重)
  afterimage(C, ["skin", "horn"], [[8, -1, 2], [16, -2, 3]], [["#3e3412", "#544618"], ["#2a240c", "#342a10"]]);
  underglow(C, { skip: ["eye"] });
  embers(C, 7605, 22, [4, 2, 88, 60]);
  return C.toArt();
}
