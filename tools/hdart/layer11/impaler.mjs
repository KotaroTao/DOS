import { sphere, ellipsoid, cone, tube, box, cyl, torus, U, Sub, Disp, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { humanoid, fingers } from "../human.mjs";
import { SAND, BLOOD, ASHBED, STONE, IRON, STEEL, BRASS, RIM, SOULS, sandFloor, ashfall, sandDust } from "../arena.mjs";
export const meta = { id: "bs_impaler", key: "hd_impaler", w: 96, h: 96,
  note: "串刺しの槍士: 身の丈の倍もある長槍を構えた無口な闘士。円い兜に顔を覆う面頬、胴には細い板を重ねた鎧。腰を深く落として槍を引いては突き、一度に三度貫く (三連撃) — 穂先の前に三筋の突きの光が並ぶ。柄には勝った試合の数だけ刻み目が入り、端まで続いている" };
export function build() {
  const mats = {
    steel: STEEL, brass: BRASS,
    lam: { ramp: ["#040404", "#0c0c0e", "#18181c", "#25252b", "#34343c", "#46464f"], spec: 0.9, pow: 26, dither: 0.45,
      shade: p => (Math.sin(p.y * 1.6) > 0.7 ? -0.16 : 0) },
    cloth: { ramp: ["#060203", "#160608", "#2a0c10", "#401418"], dither: 0.6 },
    leg: { ramp: ["#050403", "#120e0b", "#221a14", "#33281e", "#463729"], dither: 0.5 },
    wood: { ramp: ["#050301", "#120b05", "#22160a", "#352310", "#4a3218"], dither: 0.45, spec: 0.4, pow: 16 },
    hole: { ramp: ["#000000", "#010102"], amb: 0, dif: 0.05, noRim: true },
    eye: { ramp: [SOULS[2], SOULS[3], SOULS[4]], emit: () => 0.95 },
    sand: SAND, blood: BLOOD, ashbed: ASHBED, stone: STONE, iron: IRON,
  };
  // 腰を深く落とした突きの構え (左へ)
  const J = { head: [62, 34, 2], neck: [62, 40, 1], chest: [60, 48, 0], waist: [62, 58, 0], hip: [64, 64, 0],
    shL: [54, 45, 6], elL: [46, 52, 10], haL: [38, 54, 12], shR: [68, 45, -2], elR: [74, 54, 4], haR: [70, 60, 10],
    hpL: [58, 67, 4], knL: [46, 72, 8], ftL: [38, 90, 8], hpR: [70, 67, -2], knR: [80, 78, 0], ftR: [90, 90, -2] };
  const body = humanoid(J, { skin: "lam", arm: "leg", leg: "leg" }, { w: { headX: 4.6, headY: 5.2, chestX: 8, chestY: 7, chestZ: 6, waistX: 6.4, hipX: 7, arm: 2.6, arm2: 2.2, wrist: 1.6, thigh: 3.6, knee: 2.8, ankle: 2.2 } });
  const helm = U(0.6, ellipsoid([62, 32, 2], [5.4, 5.6, 5.4], "steel"), torus([62, 34, 2], 5.8, 0.9, "steel", 0, 6), box([62, 37, 6.4], [3.6, 3, 1], "steel", 0.6));
  const slits = U(0, box([60.4, 33.6, 7.4], [1.2, 0.5, 1], "hole"), box([63.6, 33.6, 7.4], [1.2, 0.5, 1], "hole"));
  const eyes = [sphere([60.4, 33.6, 6.8], 0.5, "eye"), sphere([63.6, 33.6, 6.8], 0.5, "eye")];
  const skirt = U(0.4, box([60, 68, 6], [2.4, 4, 0.8], "cloth", 0.4, 12), box([65, 68.4, 6.4], [2.4, 4, 0.8], "cloth", 0.4), box([70, 68, 5], [2.4, 4, 0.8], "cloth", 0.4, -12), torus([63, 63, 0], 6.4, 1, "brass", 0, 10));
  const greaves = [cone([46, 74, 9], [39, 88, 8], 2.8, 2.4, "steel"), cone([80, 80, 1], [89, 88, -1], 2.8, 2.4, "steel")];
  // 長槍: 右後ろから左へまっすぐ (柄の刻み目)
  const shaft = cyl([94, 66, 10], [24, 53, 12], 1.1, "wood");
  const head = U(0.3, cone([24, 53, 12], [12, 51, 12], 2.2, 0.2, "steel"), box([25, 53.2, 12], [1.6, 1.3, 1.3], "brass", 0.3, 10));
  const hands = [...fingers([38, 54, 12], 170, "leg", { n: 4, len: 3.4, spread: 14, r: 0.8, curl: 1.2 }), ...fingers([70, 60, 10], 170, "leg", { n: 4, len: 3.4, spread: 14, r: 0.8, curl: 1.2 })];
  const scene = U(0, sandFloor(60, 95, 44, 13, { seed: 12801, blood: 0.12, ash: 0.08, flags: 1, helms: 1 }), Sub(U(1, body, helm), slits, 0.2), ...eyes, skirt, ...greaves, shaft, head, ...hands);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  // 柄の刻み目
  for (let t = 0.05; t < 0.98; t += 0.04) { const x = 94 - t * 70, y = 66 - t * 13; const p = C.pix[Math.round(y) * 96 + Math.round(x)]; if (p && p.m === "wood") C.set(x, y, "#050301"); }
  // 三連の突き (穂先の前に並ぶ三筋の光と、突きの先の星)
  for (const [dy, x0, len] of [[-6, 14, 12], [0, 10, 10], [6, 14, 12]]) {
    for (let k = 0; k < len; k++) { const x = x0 - k, y = 51 + dy + (dy / 6) * k * 0.15; if (x < 0) break; if (!C.get(Math.round(x), Math.round(y))) C.set(x, y, k > len - 3 ? "#d0d4e4" : k > len - 7 ? "#686876" : "#3b3b46"); }
    const tx = x0 - len, ty = Math.round(51 + dy + (dy / 6) * len * 0.15);
    for (const [dx, dd] of [[0, -1], [0, 1], [-1, 0]]) if (tx + dx >= 0 && !C.get(tx + dx, ty + dd)) C.set(tx + dx, ty + dd, "#686876");
  }
  sandDust(C, 12803, 30, [30, 84, 66, 10]);
  ashfall(C, 12805, 50);
  return C.toArt();
}
