import { sphere, ellipsoid, cone, tube, box, cyl, torus, U, Sub, Disp, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { humanoid, fingers } from "../human.mjs";
import { SAND, BLOOD, ASHBED, STONE, IRON, RIM, sandFloor, chain, stake, ashfall, sandDust, rough } from "../arena.mjs";
export const meta = { id: "bs_chainedogre", key: "hd_chainedogre", w: 96, h: 96,
  note: "鎖の巨闘士: 首と両手首を太い鎖でつながれた、灰色の肌の巨人の闘士。鎖を幾重にも巻きつけた右の拳を頭上へ振り上げ、鎧ごと守りを叩き割る (守り崩し・多用)。分厚い筋肉が刃を半ば阻む (物理抵抗50)。左手の鎖の先には、とうに引き抜いた闘技場の杭が砂を引きずっている" };
export function build() {
  const mats = {
    skin: { ramp: ["#040404", "#0e0e0f", "#1a1a1c", "#28282b", "#37373b", "#48484d", "#5c5c62"], dither: 0.55, amb: 0.24,
      shade: p => 0.08 * fbm(p.x * 0.4, p.y * 0.4, p.z * 0.4) },
    cloth: { ramp: ["#050302", "#120b07", "#22160d", "#332215"], dither: 0.6 },
    hole: { ramp: ["#000000", "#010102"], amb: 0, dif: 0.05, noRim: true },
    eye: { ramp: ["#5a2a06", "#c8761a", "#ffd27a"], emit: () => 0.9 },
    sand: SAND, blood: BLOOD, ashbed: ASHBED, stone: STONE, iron: IRON,
  };
  const J = { head: [46, 24, 2], neck: [46, 31, 1], chest: [47, 42, 0], waist: [48, 56, 0], hip: [48, 63, 0],
    shL: [33, 36, 4], elL: [24, 50, 8], haL: [20, 62, 10], shR: [61, 35, -2], elR: [72, 26, 2], haR: [70, 12, 4],
    hpL: [40, 66, 2], knL: [34, 78, 6], ftL: [30, 91, 6], hpR: [56, 66, -2], knR: [62, 78, 0], ftR: [66, 91, -2] };
  const body = Disp(humanoid(J, { skin: "skin", leg: "skin" }, { k: 2.2, w: { headX: 5.4, headY: 5.6, chestX: 15, chestY: 11, chestZ: 9, waistX: 10, waistY: 7, hipX: 11, arm: 5.6, arm2: 4.8, wrist: 3.8, thigh: 5.4, knee: 4.2, ankle: 3.4 } }), rough(0.4, 0.35));
  const brow = ellipsoid([46, 21, 6], [5, 1.8, 3], "skin");
  const jaw = ellipsoid([46, 28, 5], [5.4, 3, 4], "skin");
  const loin = U(0.8, torus([48, 59, 0], 10, 1.8, "cloth", 0, 10), box([48, 67, 6], [7, 6, 1.2], "cloth", 0.6));
  // 首と手首の鎖の輪
  const collar = torus([46, 32, 1], 6.4, 1.6, "iron", 0, 70);
  const cuffL = cyl([21, 59, 10], [20, 64, 10], 4.6, "iron", 0.6);
  // 右の拳に幾重にも巻いた鎖
  const fist = Disp(ellipsoid([70, 10, 4], [5.4, 5, 5], "skin"), rough(0.4, 0.5));
  const wrap = [torus([71, 15, 4], 4.8, 1.2, "iron", 0, 80), torus([70, 12, 4], 5.4, 1.2, "iron", 10, 70), torus([70, 9, 4], 5.4, 1.2, "iron", -10, 80)];
  const neckChain = chain([52, 34, 6], [72, 20, 6], 1.6, "iron", 0.6);
  // 左手から砂へ垂れる鎖と、引きずる杭
  const drag = [...chain([20, 64, 10], [14, 80, 12], 1.7, "iron", 0.6), ...chain([14, 80, 12], [6, 90, 10], 1.7, "iron", 0.6)];
  const pole = stake(6, 92, 8, 9, -6);
  const eyes = [sphere([44, 23.4, 7.4], 0.8, "eye"), sphere([49, 23.4, 7.4], 0.8, "eye")];
  const scene = U(0, sandFloor(48, 95, 46, 13, { seed: 11501, blood: 0.05, ash: 0.15, flags: 1 }), Sub(U(1.4, body, brow, jaw, fist), U(0, sphere([44, 23.4, 8], 1.1, "hole"), sphere([49, 23.4, 8], 1.1, "hole"), box([46, 29, 9], [2.6, 0.6, 1.2], "hole")), 0.2), loin, collar, cuffL, ...wrap, ...neckChain, ...drag, pole, ...eyes);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [80, 0, 20], r: 20, k: 0.3 }] });
  const C = new Canvas(r);
  // 杭が引いた砂の溝
  for (let x = 8; x < 30; x++) C.only(x, 93 + (x % 3 === 0 ? 1 : 0), "#0d0a07");
  sandDust(C, 11503, 30, [0, 82, 40, 12]);
  ashfall(C, 11505, 60);
  return C.toArt();
}
