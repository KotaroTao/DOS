import { sphere, ellipsoid, cone, tube, box, cyl, torus, U, Sub, Disp, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { humanoid, fingers } from "../human.mjs";
import { SAND, BLOOD, ASHBED, STONE, IRON, RIM, GHOST, SOULS, sandFloor, ashfall, soulLamp, dissolve } from "../arena.mjs";
export const meta = { id: "bs_gladiatorlich", key: "hd_gladiatorlich", w: 96, h: 96,
  note: "闘技場の死霊術師: 闘技場の地下で倒れた闘士を立たせてきた死霊術師の骸。黒い法衣のすそを砂に引きずり、骨の指で古い灯の欠片を高く掲げる。欠片の上で闇の輪が渦を巻き、隊の全員へ闇の雨が降る (全体呪文)。足元の砂からは、剣を握った亡霊剣闘士の腕と兜がせり上がる (招来)。骨だけの体は呪文にもろい (魔法に弱い)" };
export function build() {
  const mats = {
    robe: { ramp: ["#030203", "#080608", "#100c10", "#1a141a", "#241c24", "#30262f"], dither: 0.6, amb: 0.22,
      shade: p => 0.1 * Math.sin(p.x * 1.2 + 2 * fbm(p.x * 0.2, p.y * 0.2)) },
    bone: { ramp: ["#0a0907", "#1e1b16", "#363026", "#544a3a", "#766a52", "#9a8c70", "#bcae8e"], dither: 0.45, amb: 0.26 },
    ghost: { ramp: GHOST, dither: 0.7, amb: 0.3 },
    shard: { ramp: [SOULS[1], SOULS[2], SOULS[3], SOULS[4]], noRim: true, emit: p => 0.4 + 0.6 * Math.max(0, p.nz) },
    hole: { ramp: ["#000000", "#010102"], amb: 0, dif: 0.05, noRim: true },
    eye: { ramp: [SOULS[2], SOULS[3], SOULS[4]], emit: () => 0.95 },
    sand: SAND, blood: BLOOD, ashbed: ASHBED, stone: STONE, iron: IRON,
  };
  const J = { head: [54, 26, 2], neck: [54, 32, 1], chest: [54, 41, 0], waist: [54, 52, 0], hip: [54, 58, 0],
    shL: [47, 37, 4], elL: [42, 46, 8], haL: [38, 52, 10], shR: [61, 37, -2], elR: [66, 26, 2], haR: [68, 14, 4] };
  const body = humanoid(J, { skin: "robe", head: "bone", arm: "robe" }, { w: { headX: 4, headY: 5, chestX: 7.4, chestY: 7, chestZ: 5.4, waistX: 6.4, hipX: 7.6, arm: 2.4, arm2: 2, wrist: 1.2 } });
  const robe = Disp(cone([54, 92, -2], [54, 46, 0], 18, 8, "robe"), (x, y, z) => 0.7 * Math.abs(Math.sin(x * 0.8 + y * 0.05)) + 0.5 * fbm(x * 0.3, y * 0.3));
  const cowl = Sub(ellipsoid([54, 25, 0], [6.4, 7, 6.4], "robe"), ellipsoid([54, 27, 6], [4.4, 5.4, 5], "robe"), 0.4);
  const skull = U(0.6, ellipsoid([54, 26, 2.4], [3.8, 4.4, 3.6], "bone"), ellipsoid([54, 30, 3], [2.6, 1.6, 2.4], "bone"));
  const sockets = U(0, ellipsoid([52.4, 25.4, 5.6], [1.1, 1.1, 1], "hole"), ellipsoid([55.6, 25.4, 5.6], [1.1, 1.1, 1], "hole"), ellipsoid([54, 28, 5.8], [0.6, 0.8, 0.8], "hole"));
  const eyes = [sphere([52.4, 25.4, 5], 0.6, "eye"), sphere([55.6, 25.4, 5], 0.6, "eye")];
  const handUp = fingers([68, 14, 4], -90, "bone", { n: 4, len: 4.4, spread: 24, r: 0.55, curl: -0.6 });
  const handLo = fingers([38, 52, 10], 160, "bone", { n: 4, len: 4.4, spread: 30, r: 0.55, curl: 0.3 });
  const shard = Disp(ellipsoid([68, 8, 4], [2.2, 3.2, 1.6], "shard", 20), (x, y, z) => 0.4 * Math.abs(Math.sin(x * 2 + y)));
  // 砂からせり上がる亡霊剣闘士 (兜と剣を握った腕)
  const riser = U(1, ellipsoid([22, 84, 2], [5, 5.4, 5], "ghost"), torus([22, 84, 2], 5, 0.9, "ghost", 0, 10), box([22, 85, 7], [3, 0.6, 1], "hole"),
    tube([[30, 90, 4, 2.2], [34, 80, 6, 1.8], [32, 70, 8, 1.4]], "ghost"), cone([32, 70, 8], [30, 54, 8], 1.1, 0.3, "ghost"), box([32, 70, 8], [2.6, 0.6, 0.8], "ghost", 0.2));
  const scene = U(0, sandFloor(52, 95, 46, 13, { seed: 12201, blood: 0.05, ash: 0.12, flags: 1, swords: 1 }), Sub(U(1.4, body, robe, cowl), ellipsoid([54, 27, 6], [4, 5, 4], "robe"), 0.3), Sub(skull, sockets, 0.2), ...eyes, ...handUp, ...handLo, shard, riser);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [68, 8, 12], r: 22, k: 0.5 }] });
  const C = new Canvas(r);
  // 亡霊の下半分を砂へ沈める
  for (let y = 86; y < 96; y++) for (let x = 12; x < 40; x++) { const p = C.pix[y * 96 + x]; if (p && p.m === "ghost" && y > 87) C.px[y * 96 + x] = "#2a2217"; }
  soulLamp(C, 68, 8, 1.2);
  // 欠片の上で渦を巻く闇の輪
  const DK = ["#120a1e", "#24143c", "#3e2464", "#5e3c8e"];
  for (let a = 0; a < Math.PI * 2; a += 0.03) for (const [rx, ry, c] of [[14, 4, 2], [10, 3, 3], [18, 5, 1]]) { const x = 68 + Math.cos(a) * rx, y = 2 + Math.sin(a) * ry; if (Math.sin(a * 4 + rx) > -0.2 && !C.get(Math.round(x), Math.round(y))) C.set(x, y, DK[c]); }
  // 降り注ぐ闇の雨 (左下の隊へ)
  const R = rand(12203);
  for (let i = 0; i < 46; i++) { const x = R() * 60, y = 4 + R() * 70, l = 2 + Math.floor(R() * 4); for (let k = 0; k < l; k++) { const X = Math.round(x - k * 0.5), Y = Math.round(y + k); if (X < 0 || C.get(X, Y)) break; C.set(X, Y, DK[k === 0 ? 3 : k < 2 ? 2 : 1]); } }
  ashfall(C, 12205, 30);
  return C.toArt();
}
