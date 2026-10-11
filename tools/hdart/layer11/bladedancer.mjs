import { sphere, ellipsoid, cone, tube, box, cyl, torus, slab, U, Sub, Disp, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { humanoid } from "../human.mjs";
import { SAND, BLOOD, ASHBED, STONE, IRON, STEEL, BRASS, RIM, SOULS, sandFloor, ashfall, afterimage, sandDust } from "../arena.mjs";
export const meta = { id: "bs_bladedancer", key: "hd_bladedancer", w: 96, h: 96,
  note: "双刃の舞い手: 薄布の衣をひるがえし、二振りの曲刀を手に片足で回る花形の闘士。足首の鈴が鳴るたびに姿がぶれ、目にも止まらぬ速さで一度に二度動く (神速) — 左右に淡い残像が二重に重なる。風をはらんだ薄布が長くなびき、舞に見とれた者は心を奪われる (魅了) — 薄紅の香気の渦が刃のまわりを巡る" };
export function build() {
  const mats = {
    skin: { ramp: ["#060405", "#150e10", "#28191c", "#3c272a", "#52363a", "#6a4a4c", "#86605e"], dither: 0.5, amb: 0.26 },
    veil: { ramp: ["#08040a", "#180c1a", "#2a162c", "#3e2240", "#563058", "#6e4270"], dither: 0.65, amb: 0.3 },
    sash: { ramp: ["#0e0304", "#2a080c", "#4a1218", "#6e2028"], dither: 0.5 },
    hair: { ramp: ["#030203", "#0c080a", "#181014", "#261a20"], dither: 0.5 },
    steel: STEEL, brass: BRASS,
    hole: { ramp: ["#000000", "#010102"], amb: 0, dif: 0.05, noRim: true },
    eye: { ramp: [SOULS[2], SOULS[3], SOULS[4]], emit: () => 0.95 },
    sand: SAND, blood: BLOOD, ashbed: ASHBED, stone: STONE, iron: IRON,
  };
  // 片足で回る構え: 右脚は膝を高く上げ、左脚一本で立つ
  const J = { head: [50, 26, 2], neck: [50, 32, 1], chest: [50, 40, 0], waist: [51, 50, 0], hip: [51, 56, 0],
    shL: [43, 36, 4], elL: [32, 32, 6], haL: [22, 26, 8], shR: [57, 36, -2], elR: [66, 44, 2], haR: [76, 50, 6],
    hpL: [48, 59, 2], knL: [46, 74, 4], ftL: [46, 90, 4], hpR: [55, 59, -2], knR: [64, 64, 6], ftR: [60, 76, 2] };
  const body = humanoid(J, { skin: "skin" }, { w: { headX: 3.8, headY: 4.8, chestX: 6, chestY: 5.6, chestZ: 4.4, waistX: 4.4, waistY: 5, hipX: 6, arm: 1.8, arm2: 1.5, wrist: 1.1, thigh: 2.8, knee: 2, ankle: 1.4 } });
  const hair = Disp(U(1.4, ellipsoid([51, 24, -1], [4.4, 4.4, 4.4], "hair"), tube([[52, 24, -2, 3], [60, 22, -4, 2.4], [70, 26, -6, 1.6], [78, 22, -6, 0.8]], "hair")), (x, y, z) => 0.3 * fbm(x * 0.6, y * 0.6));
  const bodice = ellipsoid([50, 40, 1], [6.4, 4.4, 4.8], "sash");
  const sash = U(0.8, torus([51, 52, 0], 5, 1.4, "sash", 0, 10), tube([[55, 53, 3, 1.2], [66, 58, 2, 0.9], [78, 56, 0, 0.6]], "sash"));
  // 腰から回るように広がる薄布の衣
  const skirt = Disp(slab([[44, 54], [58, 54], [80, 66], [72, 70], [62, 66], [56, 72], [44, 74], [34, 70], [24, 66], [38, 62]], 0, 1.6, "veil", 0.8),
    (x, y, z) => 0.5 * Math.sin(x * 0.5 + y * 0.3));
  const veil = Disp(slab([[44, 34], [36, 31], [26, 34], [14, 40], [4, 52], [10, 52], [22, 44], [34, 40], [44, 40]], -3, 1.1, "veil", 0.6), (x, y, z) => 0.4 * Math.sin(x * 0.6));
  const bells = [sphere([44, 88, 7], 1.1, "brass"), sphere([47, 89, 7.4], 1.1, "brass"), sphere([59, 75, 5.6], 1, "brass")];
  // 曲刀: 手 (x, y) から向き ang へ長さ L、反り bend で伸びる三日月の刃
  const scim = ([x, y, z], ang, L, bend) => {
    const top = [], bot = [], dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx;
    for (let i = 0; i <= 12; i++) { const t = i / 12, c = bend * t * t * L, w = 2.8 * Math.sin(Math.PI * Math.min(1, 0.2 + t * 0.85)) + 0.3;
      const px = x + dx * t * L + nx * c, py = y + dy * t * L + ny * c; top.push([px + nx * w, py + ny * w]); bot.push([px, py]); }
    return slab(top.concat(bot.reverse()), z, 0.6, "steel", 0.3);
  };
  const bladeL = scim([21, 25, 8], -2.3, 22, 0.35);
  const bladeR = scim([77, 51, 6], 0.5, 18, -0.4);
  const hilts = [box([22, 26, 8], [0.6, 2.4, 0.9], "brass", 0.2, -40), box([76, 50, 6], [0.6, 2.4, 0.9], "brass", 0.2, 28)];
  const eyes = [sphere([48.6, 26, 5.6], 0.55, "eye"), sphere([51.4, 26, 5.6], 0.55, "eye")];
  const scene = U(0, sandFloor(50, 95, 40, 13, { seed: 11601, blood: 0.05, ash: 0.12, flags: 1 }), skirt, veil, hair, Sub(U(0.8, body, bodice), U(0, sphere([48.6, 26, 6], 0.8, "hole"), sphere([51.4, 26, 6], 0.8, "hole")), 0.2), sash, ...bells, bladeL, bladeR, ...hilts, ...eyes);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  // 神速の残像 (左右に二重)
  afterimage(C, [[-8, 0, 0.3, "#24141e"], [8, 0, 0.3, "#24141e"], [-15, 0, 0.12, "#160c13"], [15, 0, 0.12, "#160c13"]], [30, 18, 40, 72]);
  // 魅了の香気の渦 (薄紅の螺旋)
  const CH = ["#3a1626", "#6a2a44", "#a8507a", "#e8a0c0"];
  for (let t = 0; t < 1; t += 0.003) {
    const a = t * 14, rr = 6 + t * 26, x = 50 + Math.cos(a) * rr, y = 46 + Math.sin(a) * rr * 0.55;
    if (Math.sin(a * 2.2) < -0.3) continue;
    const X = Math.round(x), Y = Math.round(y); if (X < 0 || Y < 0 || X > 95 || Y > 95 || C.get(X, Y)) continue;
    C.set(X, Y, CH[Math.min(3, Math.floor((1 - t) * 4))]);
  }
  for (const [x, y] of [[12, 22], [86, 36], [20, 60], [84, 80]]) { C.set(x, y, CH[3]); C.set(x - 1, y - 1, CH[2]); C.set(x + 1, y - 1, CH[2]); C.set(x, y + 1, CH[1]); }
  sandDust(C, 11603, 30, [24, 84, 50, 10]);
  ashfall(C, 11605, 40);
  return C.toArt();
}
