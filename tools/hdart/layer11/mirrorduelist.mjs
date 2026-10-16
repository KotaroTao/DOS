import { sphere, ellipsoid, cone, tube, box, cyl, torus, U, Sub, Disp, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { humanoid } from "../human.mjs";
import { SAND, BLOOD, ASHBED, STONE, IRON, RIM, sandFloor, ashfall, slashArc } from "../arena.mjs";
export const meta = { id: "bs_mirrorduelist", key: "hd_mirrorduelist", w: 96, h: 96,
  note: "鏡写しの決闘者: 全身を磨き上げた鋼の板で覆った、顔のない決闘人業。卵形の頭はつるりとした鏡で、雲海の光と闘技場の砂を映す。片足を大きく踏み出して細剣を突き、続けざまに二度突く (二連撃) — 二筋の突きの光。撃ちこまれた呪文は鏡の体で弾き返され、まったく通らない (魔法抵抗100)。重ねた加護も鏡の面に映して消す (打ち消し)" };
export function build() {
  // 鏡の鋼: 上を向いた面は空 (雲海の冷たい明るさ)、地平の暗い帯、下を向いた面は砂の照り返し
  const mats = {
    mirror: { ramp: ["#040406", "#0c0c12", "#18182a", "#2a2c44", "#46506e", "#7a86a8", "#b8c4dc", "#eef2fa"], dither: 0.3, amb: 0, dif: 0, spec: 1.6, pow: 50, specCol: "#ffffff",
      emit: p => { const ny = -p.ny; let v = ny > 0.15 ? 0.55 + 0.45 * ny : ny > -0.15 ? 0.08 : 0.28 + 0.12 * (-ny); v += 0.15 * Math.max(0, -p.nx * 0.6 + p.nz * 0.3); return v; } },
    sandref: { ramp: ["#1a150e", "#2a2217", "#3a2f20", "#4a3c2a"], emit: p => 0.4 + 0.4 * p.ny },
    joint: { ramp: ["#020203", "#08080c", "#121218", "#1e1e28"], dither: 0.4 },
    hilt: { ramp: ["#0e0904", "#2a1c0c", "#4a3616", "#725826", "#a08040", "#ccb070"], spec: 1.2, pow: 28, dither: 0.4 },
    sand: SAND, blood: BLOOD, ashbed: ASHBED, stone: STONE, iron: IRON,
  };
  // 突きの構え (左へ踏み出す)
  const J = { head: [54, 24, 2], neck: [54, 30, 1], chest: [55, 39, 0], waist: [56, 50, 0], hip: [57, 57, 0],
    shL: [48, 35, 4], elL: [38, 40, 8], haL: [28, 42, 10], shR: [62, 35, -2], elR: [70, 28, -2], haR: [76, 22, 0],
    hpL: [52, 60, 2], knL: [40, 70, 6], ftL: [30, 90, 6], hpR: [62, 60, -2], knR: [70, 74, -2], ftR: [80, 90, -4] };
  const W = { headX: 4.2, headY: 5.4, chestX: 7.6, chestY: 6.8, chestZ: 5, waistX: 5, waistY: 6, hipX: 6.4, arm: 2.2, arm2: 1.9, wrist: 1.4, thigh: 3, knee: 2.2, ankle: 1.8 };
  const body = humanoid(J, { skin: "mirror" }, { k: 0.6, w: W });
  // 関節の黒い継ぎ目
  const joints = ["elL", "elR", "knL", "knR", "neck", "shL", "shR"].map(k => sphere(J[k], k.startsWith("kn") ? 2.4 : 1.9, "joint"));
  const guard = torus([28, 42, 10], 2.2, 0.6, "hilt", -10, 0);
  const blade = cone([26, 42, 10], [-2, 46, 12], 0.7, 0.2, "mirror");
  const scene = U(0, sandFloor(56, 95, 44, 13, { seed: 11901, blood: 0.08, ash: 0.1, flags: 2 }), body, ...joints, guard, blade);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  // 頭の鏡に映る小さな人影 (隊の写り)
  for (const [x, y, c] of [[53, 23, "#18182a"], [53, 24, "#18182a"], [54, 23, "#18182a"], [52, 25, "#2a2c44"], [55, 25, "#2a2c44"]]) C.only(x, y, c);
  // 二連の突き (左へ走る二筋の光)
  for (const [y0, len] of [[42, 26], [47, 22]]) for (let k = 0; k < len; k++) { const x = 24 - k, y = y0 + k * 0.12; if (x < 0) break; if (!C.get(Math.round(x), Math.round(y))) C.set(x, y, k < 4 ? "#eef2fa" : k < 12 ? "#b8c4dc" : k % 2 ? "#46506e" : "#2a2c44"); }
  // 弾かれた呪文 (右上から来て胸で跳ね返る、紫の光)
  const SP = ["#2a1648", "#5a34a0", "#a888e8", "#f0e6ff"];
  for (let t = 0; t < 1; t += 0.02) { const x = 94 - t * 34, y = 4 + t * 32 + Math.sin(t * 20) * 1.2; if (!C.get(Math.round(x), Math.round(y))) C.set(x, y, SP[t > 0.7 ? 2 : 1]); }
  for (let t = 0; t < 1; t += 0.02) { const x = 62 + t * 30, y = 36 + t * 6 - Math.sin(t * 18) * 1.2; if (!C.get(Math.round(x), Math.round(y))) C.set(x, y, SP[t < 0.3 ? 2 : 1]); }
  for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) C.set(61 + dx, 37 + dy, dx || dy ? SP[2] : SP[3]);
  for (const [dx, dy] of [[2, -2], [-2, 2], [2, 2], [-2, -2]]) if (!C.get(61 + dx, 37 + dy)) C.set(61 + dx, 37 + dy, SP[1]);
  ashfall(C, 11903, 50);
  return C.toArt();
}
