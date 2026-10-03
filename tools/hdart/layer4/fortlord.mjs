import { tube, sphere, ellipsoid, cone, slab, cyl, box, torus, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { humanoid, fingers } from "../human.mjs";
import { FLAG, STONE, WOOD, RIM, flagstones, arrowShafts, ash, grit, flutter, tri } from "../fort.mjs";
export const meta = { id: "bs_fortlord", key: "hd_fortlord", w: 112, h: 128,
  note: "砦の主 (層ボス): 砦を枕に討ち死にし、今も退却の許しを待ち続ける将の亡霊。城の塔の狭間を戴いた大兜の覗き穴に熾火の眼、幾重にも重ねた分厚い板金には何本もの折れ矢が突き立ったまま。裂けた大マントを背に、錆びた大剣を両手で斜めに提げて石畳に切っ先を突く。背後には崩れた城壁の狭間" };
export function build() {
  const W = 112, H = 128;
  const mats = {
    plate: { ramp: ramp(["#020203", "#06070a", "#0d0f13", "#15181e", "#1e222a", "#292e37", "#363c47", "#474e5a", "#5d6573"], 9), spec: 1.6, pow: 40, specCol: "#a8b2c0", dither: 0.45,
      shade: p => 0.1 * fbm(p.x * 0.3, p.y * 0.3, p.z * 0.3) - 0.06 * Math.max(0, fbm(p.x * 0.9, p.y * 0.9, 5)) },
    rust: { ramp: ramp(["#040201", "#110704", "#200e07", "#30160b", "#432010", "#582c16"], 6), dither: 0.65, shade: p => 0.1 * fbm(p.x * 0.8, p.y * 0.8) },
    bronze: { ramp: ramp(["#050302", "#150e06", "#2a1d0b", "#423012", "#5e461c", "#7c6028"], 6), spec: 1.3, pow: 35, specCol: "#d0b070", dither: 0.4 },
    cape: { ramp: ramp(["#030102", "#090405", "#110708", "#190a0b", "#220e0f", "#2d1314", "#3a1a19"], 7), dither: 0.65, amb: 0.16,
      shade: p => 0.14 * Math.sin(p.x * 0.55 + 2 * fbm(p.x * 0.1, p.y * 0.1)) + 0.05 * fbm(p.x * 0.5, p.y * 0.5) },
    eye: { ramp: ["#3a0a00", "#8a2404", "#e05a10", "#ffc060", "#fff0b0"], emit: p => 0.55 + 0.45 * Math.max(0, p.nz) },
    shaft: { ramp: ramp(["#0a0705", "#1e140c", "#342416", "#4e3a22", "#6a5232", "#86704a"], 6), dither: 0.4, spec: 0.6, pow: 20 },
    hole: { ramp: ["#000000", "#000000", "#030203"], amb: 0, dif: 0.1, noRim: true },
    flag: FLAG, stone: STONE, wood: WOOD,
  };
  // 重装の巨躯: 両手で大剣の柄を右腰に握り、切っ先を左手前の床へ
  const J = { head: [56, 26, 4], neck: [56, 34, 2], chest: [56, 48, 2], waist: [56, 63, 0], hip: [56, 72, -1],
    shL: [37, 42, 3], elL: [40, 61, 12], haL: [64, 73, 17], shR: [75, 42, 2], elR: [82, 58, 9], haR: [73, 66, 16],
    hpL: [48, 75, 0], knL: [42, 96, 5], ftL: [39, 116, 4], hpR: [64, 75, -1], knR: [70, 96, 4], ftR: [74, 116, 2] };
  const body = humanoid(J, { skin: "plate" }, { w: { headX: 8, headY: 9, headZ: 8, neck: 6, chestX: 19, chestY: 13, chestZ: 11, waistX: 14, waistY: 9, waistZ: 9, hipX: 15, hipY: 6, hipZ: 9,
    arm: 6.6, arm2: 5.6, wrist: 4.2, thigh: 7.6, knee: 6, ankle: 5 }, k: 2.6 });
  // 胸甲の稜線と腹の重ね板 (草摺)
  const ridge = ellipsoid([56, 46, 12], [3, 12, 3], "plate");
  const lames = []; for (let i = 0; i < 4; i++) lames.push(ellipsoid([56, 60 + i * 4.2, 8 - i * 0.4], [14.5 - i * 0.3, 2.6, 8.5], "plate"));
  const tassets = [Disp(slab([[40, 74], [53, 75], [53, 90], [41, 88]], 9, 1.6, "plate", 0.8, 0.8), (x, y, z) => (Math.abs((y - 74) % 5 - 4.5) < 0.6 ? -0.4 : 0)),
    Disp(slab([[59, 75], [72, 74], [71, 88], [59, 90]], 8, 1.6, "plate", 0.8, 0.8), (x, y, z) => (Math.abs((y - 74) % 5 - 4.5) < 0.6 ? -0.4 : 0))];
  // 幾重もの肩当て
  const pauld = [];
  for (let i = 0; i < 3; i++) {
    pauld.push(ellipsoid([33 - i * 1.5, 39 + i * 4.5, 4 + i], [13 - i * 1.2, 7 - i, 10 - i], "plate", 18 + i * 6));
    pauld.push(ellipsoid([79 + i * 1.5, 39 + i * 4.5, 3 + i], [13 - i * 1.2, 7 - i, 10 - i], "plate", -18 - i * 6));
  }
  const pauldTrim = [torus([33, 38, 5], 11.5, 1, "bronze", 18, 14), torus([79, 38, 4], 11.5, 1, "bronze", -18, 14)];
  // 大兜: 円筒の上に城の塔の狭間 (のこぎり歯)、覗き穴に熾火
  const helmC = cyl([56, 13, 4], [56, 36, 4], 10, "plate", 2.5);
  const helmRim = cyl([56, 11, 4], [56, 15, 4], 11.6, "plate", 1);
  const merlons = [];
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + Math.PI / 8; merlons.push(box([56 + Math.cos(a) * 9.6, 7, 4 + Math.sin(a) * 9.6], [2.6, 3.6, 2.6], "plate", 0.5, 0)); }
  const crown = Sub(U(0, ...merlons), cyl([56, 2, 4], [56, 12, 4], 7.4, "hole"));
  const visor = U(0, box([56, 22, 13], [7, 1.1, 4], "hole", 0.3), box([56, 26.5, 13], [1.2, 4, 4], "hole", 0.3));
  const bevor = ellipsoid([56, 33, 9], [10, 5, 6], "plate");
  const helmBand = torus([56, 17, 4], 10.2, 0.9, "bronze", 0, 0);
  const helm = Sub(U(1, helmC, helmRim, bevor), visor, 0.3);
  const eyes = [sphere([52.4, 22, 11], 1.2, "eye"), sphere([59.6, 22, 11], 1.2, "eye")];
  // 籠手・脛当て・鉄靴
  const gaunt = [box([64, 74, 18], [4.2, 4, 4], "plate", 1.6, 30), box([73, 67, 17], [4.2, 4, 4], "plate", 1.6, 30)];
  const knees = [sphere([42, 96, 9], 5.2, "plate"), sphere([70, 96, 8], 5.2, "plate")];
  const boots = [ellipsoid([38, 117, 8], [7, 4, 9], "plate"), ellipsoid([75, 117, 6], [7, 4, 9], "plate")];
  // 大剣: 柄頭は右上、刃は左下の床へ
  const dir = [-0.56, 0.83]; // 刃の向き (画面)
  const g = [62, 77, 17]; // 鍔
  const pom = [g[0] - dir[0] * 16, g[1] - dir[1] * 16, 17];
  const tipP = [g[0] + dir[0] * 50, g[1] + dir[1] * 50];
  const nx = -dir[1], ny = dir[0]; // 刃の幅の向き
  const bw = 4.2;
  const blade = Disp(slab([[g[0] + nx * bw + dir[0] * 2, g[1] + ny * bw + dir[1] * 2], [tipP[0] + nx * 2.2 - dir[0] * 6, tipP[1] + ny * 2.2 - dir[1] * 6], [tipP[0], tipP[1]], [tipP[0] - nx * 2.2 - dir[0] * 6, tipP[1] - ny * 2.2 - dir[1] * 6], [g[0] - nx * bw + dir[0] * 2, g[1] - ny * bw + dir[1] * 2]], 18, 1.6, "plate", 0.4, 0.8),
    (x, y, z) => 0.5 * Math.max(0, vnoise(x * 0.6, y * 0.6) - 0.35));
  const guard = cyl([g[0] + nx * 10, g[1] + ny * 10, 17], [g[0] - nx * 10, g[1] - ny * 10, 17], 1.7, "bronze", 0.5);
  const guardEnds = [sphere([g[0] + nx * 10.5, g[1] + ny * 10.5, 17], 2.2, "bronze"), sphere([g[0] - nx * 10.5, g[1] - ny * 10.5, 17], 2.2, "bronze")];
  const grip = cyl([g[0], g[1], 17], pom, 1.8, "wood", 0.3);
  const pommel = sphere(pom, 3, "bronze");
  // 裂けた大マント: 肩の後ろから床へ、裾は裂けて千切れる
  const capePoly = [[24, 36], [88, 36], [100, 70], [104, 118], [94, 112], [88, 120], [80, 108], [70, 118], [44, 118], [34, 108], [26, 120], [18, 110], [10, 118], [12, 72]];
  const capeCut = U(0, slab([[86, 84], [90, 84], [86, 112], [84, 110]], -10, 4, "hole", 0.3), slab([[22, 80], [25, 80], [28, 106], [24, 104]], -10, 4, "hole", 0.3), slab([[96, 60], [98, 62], [92, 76], [91, 72]], -10, 4, "hole", 0.3));
  const cape = Sub(Disp(slab(capePoly, -10, 1.6, "cape", 0.8), flutter(1.2, 0.35)), capeCut, 0.4);
  const collar = Disp(ellipsoid([56, 36, -3], [24, 6, 9], "cape"), (x, y, z) => 0.6 * Math.sin(x * 0.7));
  // 突き立った折れ矢 [x,y,z, 向き x,y,z, 長さ]
  const arrows = [[45, 46, 12, -0.8, -0.7, 0.3, 12], [66, 50, 11, 0.7, -0.8, 0.3, 11], [28, 40, 11, -0.9, -0.7, 0.2, 10], [86, 47, 9, 0.9, -0.6, 0.2, 10], [50, 64, 10, -0.6, -0.9, 0.3, 8], [73, 88, 11, 0.9, -0.5, 0.3, 9], [43, 84, 10, -0.9, -0.5, 0.3, 8], [94, 66, -6, 0.8, -0.8, 0.2, 10], [20, 78, -6, -0.8, -0.7, 0.2, 9]];
  const shafts = arrows.map(([x, y, z, dx, dy, dz, l]) => { const k = Math.hypot(dx, dy, dz); return cyl([x, y, z - 2], [x + dx / k * l, y + dy / k * l, z + dz / k * l], 0.85, "shaft", 0.25); });
  // 背後の崩れた城壁 (狭間つき) と石塊
  const R = rand(701);
  const wall = [];
  for (let row = 0; row < 7; row++) for (let c = 0; c < 3; c++) {
    if (row > 4 && c === 2) continue;
    const x = 6 + c * 9 + (row % 2) * 4.5, y = 117 - row * 7;
    if (x > 30) continue;
    wall.push(box([x, y, -22 + R() * 2], [4.2, 3.2, 5], "stone", 0.8, R() * 6 - 3));
  }
  for (const x of [4, 18]) wall.push(box([x, 64, -22], [4, 4, 5], "stone", 0.8, R() * 8 - 4));
  for (let row = 0; row < 4; row++) wall.push(box([104 - (row % 2) * 4, 117 - row * 7, -22], [4.4, 3.2, 5], "stone", 0.8, R() * 8 - 4));
  const wallD = Disp(U(0, ...wall), (x, y, z) => 0.4 * fbm(x * 0.5, y * 0.5, z * 0.5));
  const rusty = (x, y, z, m) => (m === "plate" && fbm(x * 0.1 + 11, y * 0.1, z * 0.1, 4) > 0.3) ? "rust" : m;
  const knight = Paint(Disp(U(1.4, body, ridge, ...lames, ...pauld, ...knees, ...boots), (x, y, z) => 0.14 * fbm(x * 0.7, y * 0.7, z * 0.7)), rusty);
  const scene = U(0, flagstones(56, 122, 54, 16, { n: 7, seed: 703, big: 4 }), wallD, cape, collar, knight, ...tassets, ...pauldTrim, Paint(helm, rusty), crown, helmBand, ...eyes, ...gaunt,
    Paint(blade, (x, y, z, m) => fbm(x * 0.22 + 4, y * 0.22, 1) > 0.18 ? "rust" : m), guard, ...guardEnds, grip, pommel, ...shafts, ...arrowShafts([[22, 121, 10, -3, -8, 8], [96, 121, 8, 4, -9, 7]]));
  const r = render(scene, mats, { w: W, h: H, rim: RIM, lights: [{ p: [56, 22, 22], r: 18, k: 0.45 }] });
  const C = new Canvas(r);
  // 覗き穴の熾火の芯
  C.set(52, 21, "#fff0b0"); C.set(59, 21, "#fff0b0");
  // 折れ矢の矢羽と折れ口
  for (const [x, y, z, dx, dy, dz, l] of arrows) {
    const k = Math.hypot(dx, dy, dz), ex = x + dx / k * l, ey = y + dy / k * l;
    C.set(ex, ey, "#7a6a4a");
    if (l >= 10) { C.set(ex + Math.sign(dx), ey, "#5c5f68"); C.set(ex, ey - 1, "#5c5f68"); C.set(ex + Math.sign(dx), ey - 1, "#40424a"); }
    C.set(x, y, "#000000");
  }
  for (const [x, y] of [[19, 113], [93, 112]]) { C.set(x, y, "#5c5f68"); C.set(x + 1, y, "#40424a"); }
  // 刃こぼれ: 刃の縁に暗い欠け
  for (let t = 6; t < 46; t += 7) { const x = g[0] + dir[0] * t + nx * 3.4, y = g[1] + dir[1] * t + ny * 3.4; C.only(x, y, "#000000"); }
  // 鎧の継ぎ目から漏れる冷たい霊気 (亡霊のしるし)
  const Gh = ["#2c4044", "#46646a", "#6a9096"];
  const R2 = rand(707);
  for (let i = 0; i < 26; i++) { const x = 30 + R2() * 52, y = 30 + R2() * 70; if (!C.get(Math.round(x), Math.round(y))) C.set(x, y, Gh[Math.floor(R2() * R2() * 3)]); }
  grit(C, 709, 56, 121, 50, 30);
  ash(C, 711, 18);
  return C.toArt();
}
