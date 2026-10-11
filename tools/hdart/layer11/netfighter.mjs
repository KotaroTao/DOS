import { sphere, ellipsoid, cone, tube, box, cyl, torus, U, Sub, Disp, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { humanoid, fingers } from "../human.mjs";
import { SAND, BLOOD, ASHBED, STONE, IRON, STEEL, BRASS, RIM, SOULS, sandFloor, ashfall, afterimage, sandDust } from "../arena.mjs";
export const meta = { id: "bs_netfighter", key: "hd_netfighter", w: 96, h: 96,
  note: "網ともりの闘士: 左手に投網、右手に三叉のもりを持った軽装の闘士。左肩だけを覆う高い肩当て、腰布と革の脛当て。細い鉤をいくつも結んだ網を大きく投げ広げ、網に絡め取られた者は動けなくなる (麻痺・多用)。腰を落として素早く間合いを取る (俊敏) ので、横へ淡い残像が流れる。網と体からは、雲の上なのに海の水がしたたる" };
export function build() {
  const mats = {
    skin: { ramp: ["#060504", "#130f0c", "#231c16", "#352a21", "#4a3b2e", "#604d3c", "#7a6450"], dither: 0.5, amb: 0.26 },
    steel: STEEL, brass: BRASS,
    cloth: { ramp: ["#03050a", "#0a1018", "#121c28", "#1c2a3a", "#283a4e"], dither: 0.6 },
    leather: { ramp: ["#040302", "#100b07", "#1e150d", "#2e2014", "#40301d"], dither: 0.5 },
    hole: { ramp: ["#000000", "#010102"], amb: 0, dif: 0.05, noRim: true },
    eye: { ramp: [SOULS[2], SOULS[3], SOULS[4]], emit: () => 0.95 },
    sand: SAND, blood: BLOOD, ashbed: ASHBED, stone: STONE, iron: IRON,
  };
  // 腰を落とし、網を左へ投げ広げた構え
  const J = { head: [56, 32, 2], neck: [56, 38, 1], chest: [55, 47, 0], waist: [56, 57, 0], hip: [56, 63, 0],
    shL: [47, 43, 4], elL: [38, 40, 8], haL: [28, 36, 10], shR: [64, 43, -2], elR: [70, 53, 4], haR: [64, 62, 10],
    hpL: [50, 66, 2], knL: [40, 74, 8], ftL: [32, 90, 6], hpR: [62, 66, -2], knR: [72, 76, 0], ftR: [80, 90, -2] };
  const body = humanoid(J, { skin: "skin", leg: "skin" }, { w: { headX: 4.4, headY: 5.4, chestX: 8.4, chestY: 7.4, chestZ: 5.6, waistX: 6, hipX: 7, arm: 2.6, arm2: 2.2, wrist: 1.7, thigh: 3.4, knee: 2.6, ankle: 2 } });
  // 左肩の高い肩当て (galerus) と腕の革巻き
  const galerus = U(0.6, ellipsoid([46, 42, 5], [5.4, 4, 5], "steel", -20), box([44, 37, 6], [4.2, 4.4, 0.9], "steel", 0.5, -18));
  const wraps = [tube([[38, 40, 8, 2.4], [30, 37, 10, 2]], "leather"), tube([[70, 53, 4, 2.3], [65, 61, 9, 1.9]], "leather")];
  // 髪と頭布 (濡れて垂れる)
  const hair = Disp(ellipsoid([56, 30, 0], [4.8, 4.4, 5], "cloth"), (x, y, z) => 0.4 * fbm(x * 0.6, y * 0.6, z * 0.6));
  const loin = Disp(U(0.8, torus([56, 59, 0], 6.6, 1.4, "leather", 0, 10), box([56, 66, 4], [5, 5, 1], "cloth", 0.6), box([52, 66, 3], [3.6, 4.4, 1], "cloth", 0.6, 10)), (x, y, z) => 0.3 * Math.sin(x * 1.2));
  const shins = [cone([40, 76, 8], [33, 88, 6], 2.8, 2.2, "leather"), cone([72, 78, 0], [79, 88, -2], 2.8, 2.2, "leather")];
  const eyes = [sphere([54.4, 32, 6], 0.6, "eye"), sphere([57.6, 32, 6], 0.6, "eye")];
  // 三叉のもり (右手、低く前へ)
  const tri = U(0.3, cyl([90, 50, 6], [10, 76, 14], 0.9, "steel"), cone([12, 75, 14], [3, 78, 14], 0.9, 0.2, "steel"), cone([13, 72, 14], [4, 73, 14], 0.8, 0.2, "steel"), cone([12, 79, 14], [4, 83, 14], 0.8, 0.2, "steel"), cyl([14, 71, 14], [13, 80, 14], 0.8, "steel"));
  const hand = fingers([64, 62, 10], 160, "skin", { n: 4, len: 3.6, spread: 12, r: 0.7, curl: 1 });
  const scene = U(0, sandFloor(56, 95, 44, 13, { seed: 11201, blood: 0.05, ash: 0.1, flags: 1 }), hair, Sub(body, U(0, sphere([54.4, 32, 6.4], 0.9, "hole"), sphere([57.6, 32, 6.4], 0.9, "hole")), 0.2), galerus, ...wraps, loin, ...shins, ...eyes, tri, ...hand);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  // 投げ広げた網 (左上へ扇に広がる。縁には細い鉤)
  const hx = 28, hy = 36, R = rand(11203);
  const P = (u, v) => { const a = -2.5 + v * 0.95, L = 6 + u * 30; return [hx + Math.cos(a) * L, hy + Math.sin(a) * L * 0.85 + u * u * 8 * (1 - Math.abs(v))]; };
  const NET = ["#1a2830", "#2c4250", "#4e6e7a"];
  const put = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < 96 && y < 96) { const p = C.pix[y * 96 + x]; if (!C.get(x, y) || (p && p.m === "sand")) return; } C.set(x, y, c); };
  for (let i = 0; i <= 6; i++) for (let t = 0; t <= 1; t += 0.01) { const [x, y] = P(t, i / 3 - 1); if (!C.get(Math.round(x), Math.round(y))) C.set(x, y, NET[(i + Math.round(t * 20)) % 2 ? 1 : 0]); }
  for (let j = 1; j <= 5; j++) for (let v = -1; v <= 1; v += 0.01) { const [x, y] = P(j / 5, v); if (!C.get(Math.round(x), Math.round(y))) C.set(x, y, NET[j === 5 ? 2 : 1]); }
  for (let v = -1; v <= 1.001; v += 1 / 6) { const [x, y] = P(1, v); C.set(x, y, "#a8b0c0"); C.set(x - 1, y + 1, "#585e6e"); }
  // したたる海の水
  for (let i = 0; i < 18; i++) { const [x, y] = P(0.3 + R() * 0.7, R() * 2 - 1); for (let k = 1; k <= 1 + Math.floor(R() * 3); k++) if (!C.get(Math.round(x), Math.round(y + k * 2))) C.set(x, y + k * 2, k === 1 ? "#3a6a86" : "#1e3a4c"); }
  for (const [x, y] of [[44, 48], [47, 53], [60, 56], [66, 70], [36, 80]]) { C.only(x, y, "#4a8aa8"); if (!C.get(x, y + 2)) C.set(x, y + 2, "#2a5468"); }
  // 素早い間合い取りの残像 (右へ)
  afterimage(C, [[6, 0, 0.3, "#1a1612"], [12, 0, 0.14, "#100e0b"]], [38, 26, 42, 62]);
  sandDust(C, 11205, 30, [40, 84, 56, 10]);
  ashfall(C, 11207, 40);
  return C.toArt();
}
