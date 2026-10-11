import { sphere, ellipsoid, cone, tube, box, cyl, torus, slab, U, Sub, Disp, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { humanoid, fingers } from "../human.mjs";
import { SAND, BLOOD, ASHBED, STONE, IRON, RIM, GHOST, SOULS, sandFloor, ashfall, sandDust, spikes, dents } from "../arena.mjs";
export const meta = { id: "el_dragonslayer", key: "hd_dragonslayer", w: 112, h: 128,
  note: "竜殺しの亡霊 (強敵): 竜を討って闘技場の英雄に祭り上げられ、最後は観客の前で二頭目の竜と相打ちになった闘士の霊。竜の鱗を打ち直した鈍い青緑の鎧は刃をほとんど通さず (物理抵抗75)、兜の上には最初の竜の頭骨を角ごとかぶる — 上顎の牙が額の上に並び、眼窩の奥に青白い魂の灯。竜の背骨と顎骨を束ねた大剣を頭上へ振りかぶり、鎧ごと守りを叩き割る (守り崩し・多用) — 足元の砂と石畳には叩き割った跡のひび" };
export function build() {
  const W = 112, H = 128;
  const mats = {
    scale: { ramp: ["#040505", "#0a0e0d", "#121917", "#1b2421", "#25302c", "#303d38", "#3e4c46", "#4e5e57"], spec: 0.8, pow: 26, specCol: "#9ab8a6", dither: 0.45,
      shade: p => { const u = p.x * 0.55 + (Math.floor(p.y * 0.55) % 2) * 0.5, v = p.y * 0.55; return ((v % 1) < 0.28 ? -0.22 : 0) + 0.16 * (0.5 - Math.abs((u % 1) - 0.5)) + 0.05 * fbm(p.x * 0.4, p.y * 0.4, p.z * 0.4); } },
    bone: { ramp: ["#0a0907", "#1c1914", "#302b22", "#4a4234", "#685d4a", "#8a7d64", "#ada084", "#cfc4a6"], dither: 0.45, amb: 0.26,
      shade: p => 0.08 * fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5) },
    ghost: { ramp: GHOST, dither: 0.6, amb: 0.3 },
    leather: { ramp: ["#040302", "#100b07", "#1e150d", "#2e2014"], dither: 0.5 },
    hole: { ramp: ["#000000", "#010102"], amb: 0, dif: 0.05, noRim: true },
    eye: { ramp: [SOULS[2], SOULS[3], SOULS[4]], emit: () => 0.95 },
    sand: SAND, blood: BLOOD, ashbed: ASHBED, stone: STONE, iron: IRON,
  };
  // 大剣を頭上へ振りかぶる (両手は頭の右上)
  const J = { head: [56, 44, 2], neck: [56, 51, 1], chest: [56, 63, 0], waist: [57, 77, 0], hip: [57, 84, 0],
    shL: [44, 58, 4], elL: [56, 66, 12], haL: [74, 46, 14], shR: [68, 58, -2], elR: [86, 56, 6], haR: [80, 42, 14],
    hpL: [50, 88, 2], knL: [42, 103, 8], ftL: [36, 122, 6], hpR: [64, 88, -2], knR: [72, 103, 2], ftR: [78, 122, -2] };
  const body = Disp(humanoid(J, { skin: "scale", leg: "scale" }, { k: 2, w: { headX: 5.6, headY: 6.4, chestX: 13, chestY: 11, chestZ: 9, waistX: 10, waistY: 8, hipX: 11, arm: 4, arm2: 3.4, wrist: 2.6, thigh: 5, knee: 4, ankle: 3.4 } }), dents(0.3, 0.35));
  const pauldrons = [Disp(ellipsoid([42, 56, 4], [8, 5.6, 7], "scale", -30), dents(0.4, 0.4)), Disp(ellipsoid([70, 56, -2], [8, 5.6, 7], "scale", 30), dents(0.4, 0.4))];
  const belt = torus([57, 78, 0], 10, 1.4, "leather", 0, 10);
  const tassets = [box([50, 88, 7], [5, 6, 1.2], "scale", 0.6, 10), box([64, 88, 6], [5, 6, 1.2], "scale", 0.6, -10)];
  // 兜の上にかぶった竜の頭骨 (鼻先は前へ、角は後ろへ反る)
  const skull = Disp(U(2, ellipsoid([56, 35, 2], [11, 8, 10], "bone"), ellipsoid([56, 34, 11], [7.4, 4.6, 7], "bone"), ellipsoid([56, 34, 17], [5, 3.4, 4], "bone")), dents(0.5, 0.4));
  const horns = [tube([[48, 30, -2, 3], [38, 22, -6, 2.2], [30, 12, -8, 1.4], [32, 4, -8, 0.5]], "bone", { seg: 3 }), tube([[64, 30, -2, 3], [70, 20, -6, 2.2], [68, 10, -8, 1.4], [62, 4, -8, 0.5]], "bone", { seg: 3 })];
  const sockets = U(0, ellipsoid([50, 32, 11.4], [2.6, 2, 3], "hole", -20), ellipsoid([62, 32, 11.4], [2.6, 2, 3], "hole", 20), ellipsoid([54.4, 32.6, 18.6], [0.8, 0.7, 1], "hole"), ellipsoid([57.6, 32.6, 18.6], [0.8, 0.7, 1], "hole"));
  const skullEyes = [sphere([50, 32, 9.4], 1.1, "eye"), sphere([62, 32, 9.4], 1.1, "eye")];
  // 頭骨の上顎の牙 (額の上に並ぶ)
  const teeth = spikes([[[50, 38, 13], [50, 43, 14], 0.9, 0.15], [[53, 37.6, 16], [53, 43, 17], 0.9, 0.15], [[56, 37.4, 19], [56, 42, 19], 0.9, 0.15], [[59, 37.6, 16], [59, 43, 17], 0.9, 0.15], [[62, 38, 13], [62, 43, 14], 0.9, 0.15]], "bone");
  const visor = box([56, 46, 7.6], [3.6, 0.8, 1.2], "hole");
  const visorEyes = [sphere([54.4, 46, 7], 0.6, "eye"), sphere([57.6, 46, 7], 0.6, "eye")];
  // 竜の骨の大剣: 柄は顎骨、刃は背骨の節を束ねたもの。頭上から右へ振りかぶる
  const grip = cyl([72, 50, 15], [82, 38, 15], 1.4, "leather");
  const spine = [];
  for (let i = 0; i < 9; i++) { const t = i / 8, x = 84 + t * 12, y = 34 - t * 31; spine.push(Disp(ellipsoid([x, y, 15], [3.6 - t * 1.2, 2.6 - t * 0.6, 2.6], "bone", 70), dents(0.4, 0.6))); }
  const guard = Disp(slab([[78, 38], [90, 32], [92, 36], [82, 42]], 15, 1.4, "bone", 0.6), dents(0.4, 0.5));
  const edge = spikes([[[82, 30, 15], [76, 28, 15], 1.1, 0.2], [[84, 23, 15], [78, 20, 15], 1.1, 0.2], [[86, 16, 15], [80, 13, 15], 1, 0.2], [[88, 10, 15], [83, 7, 15], 0.9, 0.2], [[89, 26, 15], [95, 25, 15], 1.1, 0.2], [[92, 16, 15], [98, 15, 15], 1, 0.2], [[95, 8, 15], [100, 7, 15], 0.8, 0.2]], "bone");
  const hands = [...fingers([74, 46, 15], -50, "scale", { n: 4, len: 3, spread: 14, r: 0.9, curl: 1.4 }), ...fingers([80, 42, 15], -50, "scale", { n: 4, len: 3, spread: 14, r: 0.9, curl: 1.4 })];
  const scene = U(0, sandFloor(56, 127, 52, 15, { seed: 13201, blood: 0.1, ash: 0.12, flags: 3, swords: 1, big: 4 }), Sub(U(1.2, body, ...pauldrons, skull, ...horns), U(0, sockets, visor), 0.3), ...skullEyes, ...visorEyes, ...teeth, belt, ...tassets, grip, ...spine, guard, ...edge, ...hands);
  const r = render(scene, mats, { w: W, h: H, rim: RIM, lights: [{ p: [56, 34, 22], r: 14, k: 0.35 }] });
  const C = new Canvas(r);
  // 亡霊の淡い縁 (鎧の外側に灰青の揺らぎ)
  const snap = C.px.slice();
  for (let y = 1; y < H - 8; y++) for (let x = 1; x < W - 1; x++) {
    if (snap[y * W + x]) continue;
    let n = 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const p = r.pix[(y + dy) * W + x + dx]; if (p && (p.m === "scale" || p.m === "bone")) n++; }
    if (n && ((x + y) % 2 === 0) && fbm(x * 0.2, y * 0.2, 3) > -0.1) C.set(x, y, GHOST[2]);
  }
  // 叩き割った砂と石畳のひび
  for (const [x0, y0, a] of [[30, 124, -0.3], [44, 125, 0.2], [70, 125, -0.1], [86, 124, 0.3]]) { let x = x0, y = y0; for (let k = 0; k < 8; k++) { C.only(x, y, "#000000"); x += Math.cos(a) * 1.2 + (k % 2 ? 0.6 : -0.6); y += (k % 3 === 0 ? 1 : 0) * 0.3; } }
  sandDust(C, 13203, 50, [10, 112, 92, 12]);
  ashfall(C, 13205, 80);
  return C.toArt();
}
