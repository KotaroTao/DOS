import { sphere, ellipsoid, cone, tube, box, cyl, torus, slab, U, Sub, Disp, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { humanoid, fingers } from "../human.mjs";
import { SAND, BLOOD, ASHBED, STONE, IRON, RIM, sandFloor, ashfall, embers, rough } from "../arena.mjs";
export const meta = { id: "bs_executioner", key: "hd_executioner", w: 96, h: 96,
  note: "処刑人: 敗れた闘士の首をはねてきた、黒い覆面の大男。尖った頭巾の覗き穴から赤い眼。両手で担いだ大斧の刃には落ちない錆と古い血がこびりつき、刃先だけが鋭く光る — 鎧の継ぎ目の急所を何度も断つ (痛撃・多用)。厚い革の前掛けと鉄の肩当てが刃を半ば阻む (物理抵抗50)。足元には首を据える木の台" };
export function build() {
  const mats = {
    skin: { ramp: ["#050403", "#120d0a", "#221812", "#33251b", "#463326", "#5c4433", "#745742"], dither: 0.5, amb: 0.24,
      shade: p => 0.06 * fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5) },
    hood: { ramp: ["#020202", "#070707", "#0e0d0e", "#171617", "#222022"], dither: 0.6, amb: 0.2 },
    apron: { ramp: ["#040201", "#0e0805", "#1c110a", "#2c1b10", "#3e2717"], dither: 0.55, spec: 0.4, pow: 16,
      shade: p => 0.08 * fbm(p.x * 0.3, p.y * 0.3) },
    wood: { ramp: ["#040201", "#0e0905", "#1c1209", "#2a1b0e", "#3a2614"], dither: 0.5 },
    blade: { ramp: ["#060607", "#121215", "#202024", "#323238", "#46464e", "#5e5e68"], spec: 1.2, pow: 30, specCol: "#d4d4e0", dither: 0.4 },
    hole: { ramp: ["#000000", "#010102"], amb: 0, dif: 0.05, noRim: true },
    eye: { ramp: ["#5a0a06", "#c42a1a", "#ff8a6a"], emit: () => 0.95 },
    sand: SAND, blood: BLOOD, ashbed: ASHBED, stone: STONE, iron: IRON,
  };
  const J = { head: [44, 24, 2], neck: [44, 31, 1], chest: [45, 42, 0], waist: [46, 55, 0], hip: [46, 62, 0],
    shL: [33, 37, 4], elL: [28, 50, 8], haL: [36, 58, 12], shR: [57, 37, -2], elR: [64, 46, 6], haR: [54, 42, 12],
    hpL: [39, 65, 2], knL: [32, 78, 6], ftL: [28, 91, 6], hpR: [53, 65, -2], knR: [60, 78, 0], ftR: [64, 91, -2] };
  const body = Disp(humanoid(J, { skin: "skin", leg: "hood" }, { k: 2, w: { headX: 5, headY: 5.6, chestX: 13, chestY: 10, chestZ: 8, waistX: 11, waistY: 8, hipX: 10, arm: 4.4, arm2: 3.8, wrist: 3, thigh: 4.8, knee: 3.8, ankle: 3 } }), rough(0.3, 0.4));
  // 尖った黒頭巾 (肩まで垂れる)
  const hood = U(1.2, cone([44, 30, 1], [43, 10, -1], 7, 1, "hood"), ellipsoid([44, 32, 0], [9, 3.4, 7], "hood"));
  const holes = U(0, ellipsoid([41.6, 23, 6.4], [1.4, 1, 1.4], "hole"), ellipsoid([46.4, 23, 6.4], [1.4, 1, 1.4], "hole"));
  const eyes = [sphere([41.6, 23, 5.6], 0.8, "eye"), sphere([46.4, 23, 5.6], 0.8, "eye")];
  const pauldron = [ellipsoid([32, 36, 4], [6.6, 4.6, 6.4], "iron", -25), ellipsoid([58, 36, -2], [6.6, 4.6, 6.4], "iron", 25)];
  const apron = Disp(slab([[36, 46], [56, 46], [58, 74], [34, 74]], 8.4, 0.8, "apron", 0.8), (x, y, z) => 0.4 * Math.sin(y * 0.5) * 0.4 + 0.3 * fbm(x * 0.3, y * 0.3));
  const strap = tube([[36, 40, 7, 1.1], [44, 46, 9, 1.1], [54, 40, 6, 1.1]], "apron");
  // 両手で担いだ大斧: 柄は右下から左上へ、大きな刃は頭の上
  const haft = cyl([30, 68, 13], [70, 10, 13], 1.5, "wood");
  const edgeArc = Disp(slab([[66, 8], [72, 14], [78, 26], [86, 30], [92, 22], [94, 10], [90, 2], [80, 0], [72, 4]], 13, 1.4, "blade", 0.6), (x, y, z) => 0.2 * fbm(x * 0.6, y * 0.6));
  const block = U(0.5, box([12, 88, 4], [9, 4, 7], "wood", 0.8), box([12, 84, 4], [3, 1.4, 6], "wood", 0.3));
  const handL = fingers([36, 58, 12], 10, "skin", { n: 4, len: 4, spread: 14, r: 0.9, curl: 1.2 });
  const handR = fingers([54, 42, 12], 190, "skin", { n: 4, len: 4, spread: 14, r: 0.9, curl: 1.2 });
  const scene = U(0, sandFloor(48, 95, 46, 13, { seed: 11701, blood: 0.28, ash: 0.05, flags: 0 }), block, Sub(U(1.4, body, hood), holes, 0.2), ...eyes, ...pauldron, apron, strap, haft, edgeArc, ...handL, ...handR);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [6, 6, 24], r: 20, k: 0.3 }] });
  const C = new Canvas(r);
  // 斧の刃先の鋭い光 (外側の弧) と、錆と古い血の染み
  for (let a = -1.3; a <= 1.2; a += 0.02) { const x = 80 + Math.cos(a) * 14, y = 15 + Math.sin(a) * 15; for (let k = 0; k < 2; k++) { const X = Math.round(x - Math.cos(a) * k), Y = Math.round(y - Math.sin(a) * k); if (C.pix[Y * 96 + X]?.m === "blade") { C.set(X, Y, k ? "#8a8a96" : (a > -0.6 && a < 0.5 ? "#e8e8f0" : "#b4b4c0")); break; } } }
  for (let y = 0; y < 32; y++) for (let x = 64; x < 96; x++) { const p = C.pix[y * 96 + x]; if (p && p.m === "blade" && fbm(x * 0.35, y * 0.35, 2) > 0.18) C.set(x, y, fbm(x * 0.7, y * 0.7, 5) > 0.25 ? "#330e09" : "#3e2617"); }
  for (const [x, y] of [[84, 32], [84, 34], [86, 33], [85, 37]]) if (!C.get(x, y)) C.set(x, y, "#330e09");
  // 急所を断つ赤い閃き (刃先)
  for (const [x, y, c] of [[93, 12, "#ff8a6a"], [92, 12, "#c42a1a"], [94, 12, "#c42a1a"], [93, 11, "#c42a1a"], [93, 13, "#c42a1a"], [91, 12, "#5a0a06"], [95, 12, "#5a0a06"], [93, 9, "#5a0a06"], [93, 15, "#5a0a06"]]) C.set(x, y, c);
  ashfall(C, 11703, 50);
  embers(C, 11705, 6, [0, 40, 96, 40]);
  return C.toArt();
}
