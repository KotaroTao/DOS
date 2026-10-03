import { sphere, ellipsoid, cone, slab, cyl, box, torus, tube, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { FLAG, STONE, WOOD, RIM, flagstones, arrowShafts, ash, grit } from "../fort.mjs";
export const meta = { id: "d03_sentinel", key: "hd_sentinel", w: 96, h: 96,
  note: "無人の甲冑: 中身の失せた磨きの板金鎧。面頬を上げた兜の奥は空っぽの闇で、底にぼうと消えぬ白金の聖光。肘や膝の継ぎ目からも空洞がのぞく。褪せた紋章の凧形盾を構え、長剣を高く立てて守りに入る" };
export function build() {
  const mats = {
    steel: { ramp: ramp(["#040506", "#0b0d10", "#151820", "#20242c", "#2d323c", "#3e4450", "#535a68", "#6e7684", "#929aa8", "#b4bcc8"], 10), spec: 1.8, pow: 40, specCol: "#eef2f8", dither: 0.45, amb: 0.2, gain: 1.08,
      shade: p => 0.08 * fbm(p.x * 0.3, p.y * 0.3, p.z * 0.3) },
    gold: { ramp: ramp(["#050403", "#17120a", "#2c2414", "#463a20", "#625430", "#827244"], 6), spec: 1.3, pow: 35, specCol: "#e8dcae", dither: 0.4 },
    paint: { ramp: ramp(["#030406", "#0a0e16", "#131a26", "#1d2636", "#283346", "#344056"], 6), spec: 0.4, pow: 20, dither: 0.7,
      shade: p => 0.12 * fbm(p.x * 0.5, p.y * 0.5) - 0.05 },
    leather: { ramp: ramp(["#030202", "#0e0907", "#1a110c", "#281a12", "#36241a"], 5), dither: 0.5 },
    hollow: { ramp: ["#000000", "#020203", "#05060a", "#0a0c12"], amb: 0.1, dif: 0.25, noRim: true },
    void: { ramp: ["#000000", "#000000", "#010102"], amb: 0, dif: 0.05, noRim: true },
    flag: FLAG, stone: STONE, wood: WOOD,
  };
  // 空洞の芯: 継ぎ目からのぞく闇 (腕・脚・腰の細い管)
  const core = U(0.8,
    cyl([48, 52, -1], [48, 62, -1], 6, "hollow"),
    tube([[60, 34, 1, 2.6], [70, 46, 4, 2.3], [65, 54, 10, 2]], "hollow"),
    tube([[36, 34, 1, 2.6], [29, 48, 4, 2.3], [33, 58, 9, 2]], "hollow"),
    tube([[43, 64, -1, 3], [41, 77, 2, 2.6], [39, 87, 2, 2.2]], "hollow"),
    tube([[54, 64, -1, 3], [58, 77, 1, 2.6], [61, 87, 1, 2.2]], "hollow"));
  // 胸甲: 中央の稜線が立つ丸い鳩胸、腹当て、草摺状の段板
  const breast = U(1, ellipsoid([48, 40, 0], [11, 9.5, 7.5], "steel"), ellipsoid([48, 40, 2.5], [2, 9, 6], "steel"));
  const plackart = ellipsoid([48, 51, 0.5], [8.6, 4.6, 6.6], "steel");
  const faulds = [0, 1, 2].map(i => Sub(ellipsoid([48, 59 + i * 3.6, -0.5], [10 + i * 0.8, 2.2, 7.2 + i * 0.4], "steel"), ellipsoid([48, 57 + i * 3.6, -0.5], [9 + i * 0.8, 2.2, 6.4 + i * 0.4], "steel")));
  const gorget = cyl([48, 26, 1], [48, 31, 1], 5.8, "steel", 1.5);
  // 兜: 丸い兜鉢、顔の穴は闇、上に跳ね上げた尖り面頬
  const helmShell = Sub(U(0.6, ellipsoid([48, 18.5, 2], [7, 8.4, 7], "steel"), cyl([48, 22, 2], [48, 27, 1], 6.4, "steel", 1.5)), ellipsoid([48, 21.5, 9], [4.2, 5, 5.6], "void"), 0.6);
  const visor = Sub(ellipsoid([48, 10.8, 4.5], [7.4, 4, 6.4], "steel", 0, -18), ellipsoid([48, 12.2, 3.6], [6.6, 3.6, 5.8], "steel", 0, -18));
  const visorTip = cone([48, 9.5, 9], [48, 5.5, 12], 2.2, 0.5, "steel");
  const ridge = ellipsoid([48, 16, 2], [1.4, 8, 7.4], "steel");
  const pivots = [sphere([41.2, 19, 4], 1.3, "gold"), sphere([54.8, 19, 4], 1.3, "gold")];
  // 肩当て: 重なる三枚の板
  const paul = (x, s) => [0, 1, 2].map(i => ellipsoid([x + s * i * 0.8, 31 + i * 3.4, 1.5], [8 - i * 0.9, 4.2, 7 - i * 0.6], "steel", s * (18 + i * 6)));
  // 腕甲: 上腕・前腕は板、肘の継ぎ目は空洞がのぞく
  const armR = [cyl([61, 36, 2], [68, 44, 4], 3.3, "steel", 1.2), cyl([69.5, 48, 5], [66, 53, 9], 3, "steel", 1.2), sphere([70, 46, 3.5], 2.2, "steel")];
  const armL = [cyl([35, 36, 2], [30.5, 45, 4], 3.3, "steel", 1.2), cyl([29.5, 50, 5], [32, 56, 8], 3, "steel", 1.2)];
  const gauntR = box([65, 54, 11], [3.2, 2.8, 3], "steel", 1.2);
  // 脚: 腿当て・膝当て・脛当て・鉄靴
  const legs = [cyl([43, 65, -1], [42, 72.5, 1], 4.4, "steel", 1.6), cyl([54, 65, -1], [56.6, 72.5, 0], 4.4, "steel", 1.6),
    cyl([40.6, 80.5, 2], [39.4, 86, 2], 3.7, "steel", 1.4), cyl([58.6, 80.5, 1], [60.6, 86, 1], 3.7, "steel", 1.4)];
  const knees = [ellipsoid([41.2, 76.5, 4.5], [3.2, 2.2, 2.6], "steel"), ellipsoid([58, 76.5, 3.5], [3.2, 2.2, 2.6], "steel")];
  const sabatons = [ellipsoid([38.5, 88.5, 5], [4.6, 2.4, 6.4], "steel"), ellipsoid([62, 88.5, 4], [4.6, 2.4, 6.4], "steel")];
  // 長剣: 胸の前で立て、刃は右上へ
  const sx0 = 65, sy0 = 53, dx = 0.34, dy = -1, l = Math.hypot(dx, dy), ux = dx / l, uy = dy / l, nx = -uy, ny = ux;
  const P = (t, w) => [sx0 + ux * t + nx * w, sy0 + uy * t + ny * w];
  const blade = slab([P(5, -1.9), P(5, 1.9), P(42, 1.5), P(47, 0), P(42, -1.5)], 12, 0.9, "steel", 0.3, 0.4);
  const fuller = slab([P(7, -0.4), P(7, 0.4), P(36, 0.3), P(36, -0.3)], 12.9, 0.2, "hollow", 0.1);
  const guard = cyl([...P(4, -6.5), 12], [...P(4, 6.5), 12], 1.2, "gold", 0.4);
  const grip = cyl([...P(-4, 0), 12], [...P(3.5, 0), 12], 1.3, "leather", 0.3);
  const pommel = sphere([...P(-5.5, 0), 12], 2, "gold");
  // 凧形盾: 鋼の縁 + 褪せた塗りの面
  const shPoly = [[21, 40], [41, 38], [42, 52], [38, 66], [31, 78], [24, 66], [20, 52]];
  const inner = [[23.5, 42], [39, 40.5], [39.6, 52], [36.2, 64.5], [31, 74], [25.6, 64.5], [22.4, 52]];
  const shield = U(0, Disp(slab(shPoly, 13, 1.8, "steel", 1, 1.2), (x, y, z) => 0.2 * fbm(x * 0.4, y * 0.4)), slab(inner, 14.7, 0.6, "paint", 0.4, 0.8));
  const scene = U(0, flagstones(50, 91, 44, 14, { n: 5, seed: 61 }),
    ...arrowShafts([[82, 90, 5, 3, -8, 8], [14, 91, 3, -2, -9, 8]]),
    core, breast, plackart, ...faulds, gorget, helmShell, ridge, visor, visorTip, ...pivots,
    ...paul(37, -1), ...paul(59, 1), ...armR, ...armL, gauntR, ...legs, ...knees, ...sabatons,
    blade, fuller, guard, grip, pommel, shield);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [48, 22, 4], r: 9, k: 0.25 }] });
  const C = new Canvas(r);
  // 盾の褪せた紋章: 剥げかけた金の十字と三つの星
  const G = ["#2c2414", "#463a20", "#625430"];
  const R = rand(63);
  const paintAt = (x, y, c) => { const p = C.pix[y * 96 + x]; if (p && p.m === "paint" && R() < 0.82) C.set(x, y, c); };
  for (let y = 44; y <= 70; y++) for (let x = 30; x <= 32; x++) paintAt(x, y, G[x === 30 ? 2 : x === 31 ? 1 : 0]);
  for (let x = 24; x <= 38; x++) for (let y = 50; y <= 52; y++) paintAt(x, y, G[y === 50 ? 2 : y === 51 ? 1 : 0]);
  for (const [x, y] of [[26, 45], [35, 45], [31, 61]]) { paintAt(x, y, G[1]); paintAt(x - 1, y, G[0]); paintAt(x + 1, y, G[0]); paintAt(x, y - 1, G[0]); paintAt(x, y + 1, G[0]); }
  // 兜の奥の聖光: 闇の底に白金の微光
  const H = ["#2a2618", "#5c5638", "#a89c70", "#f0e8c8"];
  C.set(48, 23, H[3]); C.set(47, 23, H[2]); C.set(49, 23, H[2]); C.set(48, 22, H[2]); C.set(48, 24, H[1]);
  for (const [x, y] of [[46, 22], [50, 22], [46, 24], [50, 24], [48, 21], [48, 25]]) C.set(x, y, H[0]);
  C.set(47, 22, H[1]); C.set(49, 22, H[1]); C.set(47, 24, H[1]); C.set(49, 24, H[1]);
  // 継ぎ目の空洞にも、かすかな聖光の照り
  for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) { const p = C.pix[y * 96 + x]; if (p && p.m === "hollow" && p.nz > 0.6 && (x * 7 + y * 13) % 11 === 0 && y > 40) C.set(x, y, H[0]); }
  grit(C, 67, 50, 90, 40);
  ash(C, 69, 14);
  return C.toArt();
}
