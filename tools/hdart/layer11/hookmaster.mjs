import { sphere, ellipsoid, cone, tube, box, cyl, torus, U, Sub, Disp, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { humanoid, fingers } from "../human.mjs";
import { SAND, BLOOD, ASHBED, STONE, IRON, BRASS, RIM, SOULS, sandFloor, ashfall, afterimage, sandDust } from "../arena.mjs";
export const meta = { id: "bs_hookmaster", key: "hd_hookmaster", w: 96, h: 96,
  note: "かぎ縄の使い手: 鉤のついた縄を腰に何本も巻いた、すばしこい小男の闘士。頭巾と口当て、ぎょろりとした目。身を低くして片手で縄を回し、間合いの外から投げた鉤に、懐の金貨の袋を引っかけてかすめ取っていく (金貨奪い・多用) — 縄の先の鉤に袋が掛かり、金貨がこぼれる。すばしこく動く (俊敏)" };
export function build() {
  const mats = {
    skin: { ramp: ["#060403", "#140e0a", "#251a12", "#38281b", "#4e3826", "#664a33"], dither: 0.5, amb: 0.26 },
    cloth: { ramp: ["#030403", "#090c09", "#121712", "#1c241b", "#283326"], dither: 0.6 },
    rope: { ramp: ["#060402", "#160f07", "#2a1e0f", "#40301a", "#584428"], dither: 0.4 },
    pouch: { ramp: ["#060302", "#160b06", "#2c180c", "#442614"], dither: 0.4 },
    brass: BRASS, steel: { ramp: ["#060607", "#16161a", "#2c2c34", "#4a4a56", "#7a7a88"], spec: 1.2, pow: 26, specCol: "#d0d0e0", dither: 0.4 },
    hole: { ramp: ["#000000", "#010102"], amb: 0, dif: 0.05, noRim: true },
    eye: { ramp: ["#4a3a06", "#c0a030", "#fff0a0"], emit: () => 0.95 },
    sand: SAND, blood: BLOOD, ashbed: ASHBED, stone: STONE, iron: IRON,
  };
  // 低く構えた小男 (体は右寄り、縄を左へ投げる)
  const J = { head: [62, 46, 2], neck: [62, 51, 1], chest: [62, 58, 0], waist: [63, 66, 0], hip: [64, 71, 0],
    shL: [56, 55, 4], elL: [48, 50, 8], haL: [40, 46, 10], shR: [68, 55, -2], elR: [74, 46, 0], haR: [76, 36, 2],
    hpL: [60, 73, 4], knL: [52, 80, 8], ftL: [48, 91, 8], hpR: [68, 73, -2], knR: [78, 80, 0], ftR: [82, 91, -2] };
  const body = humanoid(J, { skin: "cloth", head: "skin", arm: "skin", leg: "cloth" }, { w: { headX: 4.4, headY: 4.6, chestX: 7, chestY: 5.6, chestZ: 5, waistX: 5.4, waistY: 4, hipX: 6, arm: 2.2, arm2: 1.9, wrist: 1.4, thigh: 3, knee: 2.4, ankle: 1.8 } });
  const hood = Sub(ellipsoid([62, 44, 0], [5.6, 5.4, 5.6], "cloth"), ellipsoid([61, 47, 6], [3.8, 3.2, 3], "cloth"), 0.3);
  const mask = ellipsoid([61, 49, 4.4], [3.8, 1.8, 2.4], "cloth");
  const eyes = [sphere([59.4, 46.4, 5.8], 0.85, "eye"), sphere([62.6, 46.4, 5.8], 0.85, "eye")];
  // 腰に巻いた縄の束と、ぶら下がる鉤
  const coils = [torus([64, 66, 0], 6.6, 1.2, "rope", 0, 12), torus([64, 68.4, 0], 6.8, 1.2, "rope", 0, 8), torus([70, 70, 6], 3, 0.9, "rope", 20, 70), torus([58, 70, 6], 2.8, 0.9, "rope", -20, 70)];
  const hooks = [tube([[70, 73, 7, 0.6], [70, 77, 8, 0.6], [68, 79, 8, 0.5], [67, 77, 8, 0.4]], "steel", { seg: 2 }), tube([[58, 73, 7, 0.6], [58, 78, 8, 0.6], [56, 80, 8, 0.5], [55, 78, 8, 0.4]], "steel", { seg: 2 })];
  // 頭上で回す縄の輪 (右手)
  const loop = torus([76, 26, 2], 8, 0.8, "rope", 10, 70);
  const scene = U(0, sandFloor(56, 95, 44, 13, { seed: 12401, blood: 0.05, ash: 0.1, flags: 1 }), Sub(U(1.2, body, hood, mask), U(0, sphere([59.4, 46.4, 6.4], 1.1, "hole"), sphere([62.6, 46.4, 6.4], 1.1, "hole")), 0.2), ...eyes, ...coils, ...hooks, loop);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  // 投げた縄 (左手から左上へ弧を描き、先の鉤に金貨の袋)
  const RP = ["#2a1e0f", "#40301a", "#584428"];
  let ex = 0, ey = 0;
  for (let t = 0; t <= 1; t += 0.006) { const x = 40 - t * 30, y = 46 - Math.sin(t * Math.PI * 0.9) * 22 + t * 10; ex = x; ey = y; if (!C.get(Math.round(x), Math.round(y))) C.set(x, y, RP[Math.round(t * 40) % 3 === 0 ? 2 : 1]); }
  // 鉤 (三つ爪)
  const HK = ["#2c2c34", "#7a7a88", "#d0d0e0"];
  for (const [dx, dy] of [[-1, 0], [-2, 1], [-2, 2], [-1, 3], [1, 0], [2, 1], [2, 2], [1, 3], [0, 1], [0, 2]]) C.set(ex + dx, ey + dy, HK[dy < 2 ? 2 : 1]);
  // 引っかけた金貨の袋と、こぼれる金貨
  const px = Math.round(ex), py = Math.round(ey) + 5;
  for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) if (x * x / 9 + y * y / 9 <= 1) C.set(px + x, py + y, ["#160b06", "#2c180c", "#442614", "#5c3a20"][Math.max(0, Math.min(3, 2 - Math.round((x + y) / 2)))]);
  C.set(px, py - 4, "#40301a"); C.set(px - 1, py - 4, "#2a1e0f"); C.set(px + 1, py - 4, "#2a1e0f");
  const R = rand(12403);
  for (let i = 0; i < 9; i++) { const x = px + (R() - 0.3) * 12, y = py + 5 + R() * 34; if (!C.get(Math.round(x), Math.round(y))) { C.set(x, y, "#ccb070"); if (R() < 0.6) C.set(x + 1, y, "#725826"); } }
  afterimage(C, [[6, 0, 0.26, "#14100b"], [11, 0, 0.12, "#0d0a07"]], [44, 30, 46, 62]);
  sandDust(C, 12405, 24, [40, 84, 50, 10]);
  ashfall(C, 12407, 50);
  return C.toArt();
}
