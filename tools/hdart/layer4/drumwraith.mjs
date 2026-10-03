import { tube, sphere, ellipsoid, cone, slab, cyl, box, torus, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { FLAG, STONE, WOOD, RIM, flagstones, ash, grit } from "../fort.mjs";
export const meta = { id: "bs_drumwraith", key: "hd_drumwraith", w: 96, h: 96,
  note: "戦鼓の亡霊: 終わらぬ進軍の太鼓を打ち続ける鼓手の骸。へこんだ筒帽にぼろの青い軍服、はだけた胸から肋骨がのぞく。腰に吊った革張りの戦鼓へ両手のばちを振り上げ、鼓からは淡い緑白の音の波紋が広がる" };
export function build() {
  const mats = {
    coat: { ramp: ramp(["#030405", "#0a0e12", "#141b22", "#202a33", "#2c3a46", "#3a4b5a"], 6), dither: 0.6,
      shade: p => 0.1 * Math.sin(p.x * 0.9 + p.y * 0.15) + 0.06 * fbm(p.x * 0.5, p.y * 0.5) },
    bone: { ramp: ramp(["#050505", "#151410", "#28261e", "#3f3b2f", "#5a5545", "#78725e", "#99937c"], 7), spec: 0.5, pow: 22, dither: 0.45 },
    hide: { ramp: ramp(["#090706", "#2a2219", "#4a3e2e", "#6e5e46", "#8e7e62"], 5), dither: 0.6, amb: 0.2,
      shade: p => 0.12 * fbm(p.x * 0.4, p.y * 0.4) },
    shell: { ramp: ramp(["#050202", "#170807", "#2c0f0b", "#441a12", "#5a2618"], 5), spec: 0.8, pow: 30, specCol: "#7a4a32", dither: 0.5,
      shade: p => 0.08 * Math.sin(p.x * 1.6) },
    brass: { ramp: ramp(["#050302", "#160f05", "#2c1f0a", "#463210", "#644a18", "#866624"], 6), spec: 1.3, pow: 30, specCol: "#d8b870", dither: 0.4 },
    cord: { ramp: ramp(["#060504", "#1c1a14", "#36332a", "#585244"], 4), dither: 0.3 },
    felt: { ramp: ramp(["#020203", "#07080a", "#0e1013", "#171a1e", "#22262c"], 5), spec: 0.4, pow: 18, dither: 0.5 },
    leather: { ramp: ramp(["#030202", "#0c0806", "#181009", "#24180e", "#322214"], 5), spec: 0.5, pow: 20, dither: 0.5 },
    eye: { ramp: ["#1c4a38", "#4aa078", "#b8f6d4"], emit: p => 0.6 + 0.4 * Math.max(0, p.nz) },
    hole: { ramp: ["#000000", "#000000", "#020203"], amb: 0, dif: 0.1, noRim: true },
    flag: FLAG, stone: STONE, wood: WOOD,
  };
  // 髑髏と顎、筒帽 (へこみ・前章・折れた羽根飾り)
  const skull = U(1, sphere([48, 19, 4], 5.2, "bone"), ellipsoid([48, 24.5, 5], [3.4, 2.2, 3.2], "bone"));
  const face = Sub(skull, U(0, sphere([45.8, 19.6, 8.6], 1.6, "hole"), sphere([50.4, 19.6, 8.6], 1.6, "hole"), ellipsoid([48, 22.4, 9], [0.7, 1, 1.2], "hole"), box([48, 25.2, 8], [2.6, 0.35, 2], "hole", 0.1)), 0.3);
  const shako = Disp(cone([48, 15.5, 3], [48.6, 5, 2], 5.6, 6.4, "leather"), (x, y, z) => (x > 51 && y < 9 ? 0.7 : 0) + 0.1 * fbm(x * 0.7, y * 0.7));
  const visor = ellipsoid([48, 15.6, 7.5], [5, 0.9, 3], "leather", 0);
  const badge = ellipsoid([48.2, 10, 8.2], [1.8, 2.2, 0.8], "brass");
  const plume = tube([[45, 5, 3, 1.2], [43, 1.5, 2, 0.9], [44.5, -0.5, 2, 0.5]], "coat");
  // 肋骨: 胸郭から横の溝を抜く。背骨
  let cage = ellipsoid([48, 37, 0], [7.4, 8.6, 5.6], "bone");
  for (let k = 0; k < 5; k++) cage = Sub(cage, box([48, 32 + k * 3, 4], [5.2, 0.7, 4], "hole", 0.3, (k - 2) * 3), 0.2);
  cage = Sub(cage, ellipsoid([48, 38, -0.5], [6.2, 7.6, 4.6], "hole"));
  const spine = tube([[48, 28, -1, 1.2], [48, 40, -2, 1.3], [48, 52, -1, 1.4]], "bone");
  const sternum = tube([[48, 30, 5.4, 0.9], [48, 38, 5, 0.7]], "bone");
  // はだけた軍服: 胸の両脇と肩章、千切れた袖
  const coatL = Sub(ellipsoid([41, 39, 0], [6.4, 11, 6.2], "coat", 8), box([47, 40, 6], [2.6, 12, 4], "coat", 1, 8), 1);
  const coatR = Sub(ellipsoid([55, 39, 0], [6.4, 11, 6.2], "coat", -8), box([49, 40, 6], [2.6, 12, 4], "coat", 1, -8), 1);
  const tails = Disp(U(0, slab([[38, 46], [45, 47], [44, 64], [41, 70], [37, 62]], -2, 2, "coat", 0.8), slab([[58, 46], [51, 47], [52, 64], [55, 70], [59, 62]], -2, 2, "coat", 0.8)), (x, y, z) => 0.3 * Math.sin(y * 1.3 + x));
  const eps = [ellipsoid([38, 29, 1], [5.4, 2.8, 5], "brass", 20), ellipsoid([58, 29, 1], [5.4, 2.8, 5], "brass", -20)];
  const sleeves = [tube([[38, 30, 1, 3.6], [33, 25, 3, 3.2], [31, 22, 4, 3]], "coat"), tube([[58, 30, 1, 3.6], [63, 25, 3, 3.2], [65, 22, 4, 3]], "coat")];
  const buttons = [];
  for (let k = 0; k < 4; k++) { buttons.push(sphere([43.6, 32 + k * 4, 5.6], 0.9, "brass")); buttons.push(sphere([52.4, 32 + k * 4, 5.6], 0.9, "brass")); }
  // 骨の前腕と手、振り上げたばち
  const fore = [tube([[31, 22, 4, 1.4], [28, 15, 6, 1.1]], "bone"), tube([[65, 22, 4, 1.4], [68, 15, 6, 1.1]], "bone")];
  const hands = [ellipsoid([27.6, 13, 6.4], [2.2, 2.4, 2], "bone"), ellipsoid([68.4, 13, 6.4], [2.2, 2.4, 2], "bone")];
  const sticks = [cyl([28.5, 14.5, 7], [17, 3, 9], 0.9, "wood", 0.3), sphere([16.6, 2.6, 9], 1.9, "hide"), cyl([67.5, 14.5, 7], [80, 3.5, 9], 0.9, "wood", 0.3), sphere([80.4, 3.1, 9], 1.9, "hide")];
  // 戦鼓: 斜めに吊った胴、革の鼓面、上下の縁と締め紐、斜めがけの吊り帯
  const A = [48, 66, -4], B = [48, 55, 6];
  const ax = [0, -0.739, 0.672], u = [1, 0, 0], v = [0, 0.672, 0.739];
  const Rd = 13;
  const shellN = cyl(A, B, Rd, "shell", 1);
  const head = cyl([48, 55, 6], [48, 53.6, 7.25], Rd - 1.8, "hide", 0.3);
  const at = (c, R, th) => c.map((cv, i) => cv + R * (Math.cos(th) * u[i] + Math.sin(th) * v[i]));
  const rimT = torus([48, 54.3, 6.6], Rd - 0.6, 1.2, "wood", 0, 90 - 42);
  const rimB = torus([48, 66.4, -4.4], Rd - 0.4, 1.2, "wood", 0, 90 - 42);
  const lace = [];
  const tops = [], bots = [];
  for (let i = 0; i <= 6; i++) { const th = -0.15 + i / 6 * (Math.PI + 0.3); tops.push(at([48, 56, 5], Rd + 0.6, th)); bots.push(at([48, 65, -3], Rd + 0.6, th + Math.PI / 12)); }
  for (let i = 0; i < 6; i++) { lace.push(cyl(tops[i], bots[i], 0.6, "bone")); lace.push(cyl(bots[i], tops[i + 1], 0.6, "bone")); }
  const tacks = []; for (let i = 0; i < 9; i++) tacks.push(sphere(at([48, 55.4, 5.6], Rd + 0.9, i / 8 * Math.PI), 0.7, "brass"));
  const strap = tube([[58, 29, 4, 1.3], [53, 40, 6.5, 1.3], [44, 52, 8, 1.3]], "leather");
  // 骨の脚にぼろの脚衣、すり切れた長靴
  const legs = [tube([[42, 64, -3, 3.2], [40, 76, 0, 2.6]], "coat"), tube([[54, 64, -3, 3.2], [57, 76, -1, 2.6]], "coat"),
    tube([[40, 76, 0, 1.5], [38.5, 86, 1, 1.3]], "bone"), tube([[57, 76, -1, 1.5], [59, 86, 0, 1.3]], "bone")];
  const knees = [sphere([40, 76.5, 1], 1.9, "bone"), sphere([57, 76.5, 0], 1.9, "bone")];
  const boots = [U(0.8, cyl([38.4, 84, 1], [38.2, 89, 1.5], 2.6, "leather", 0.6), ellipsoid([37, 89.4, 3], [4, 2, 4.6], "leather")), U(0.8, cyl([59, 84, 0], [59.2, 89, 0.5], 2.6, "leather", 0.6), ellipsoid([60.4, 89.4, 2], [4, 2, 4.6], "leather"))];
  const eyes = [sphere([45.8, 19.6, 7.6], 0.9, "eye"), sphere([50.4, 19.6, 7.6], 0.9, "eye")];
  const rags = Disp(U(0, ...legs.slice(0, 2)), (x, y, z) => 0.4 * Math.sin(x * 1.7 + y * 0.6));
  const scene = U(0, flagstones(48, 92, 40, 13, { n: 4, seed: 411, big: 3 }), face, ...eyes, shako, visor, badge, plume, cage, spine, sternum, coatL, coatR, tails, ...eps, ...sleeves, ...buttons,
    ...fore, ...hands, ...sticks, shellN, head, rimT, rimB, ...lace, ...tacks, strap, rags, ...legs.slice(2), ...knees, ...boots);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [40, 72, 26], r: 30, k: 0.45 }] });
  const C = new Canvas(r);
  C.set(45, 19, "#b8f6d4"); C.set(50, 19, "#b8f6d4");
  // 音の波紋: 鼓面から左右へ広がる弧 (内ほど明るく、外ほど淡く途切れる)
  const Wv = ["#b4e2cc", "#7cb49c", "#4e7c6c", "#2e4c44"];
  const R = rand(413);
  [[19, 0], [26, 1], [33, 2], [40, 3]].forEach(([rad, k]) => {
    for (const [a0, a1] of [[150, 215], [-35, 30]]) for (let a = a0; a <= a1; a += 1.2) {
      const t = a * Math.PI / 180, x = 48 + Math.cos(t) * rad, y = 58 + Math.sin(t) * rad * 0.62;
      if (y > 84 || ((a * 7 + k * 13) % 23) < 4 + k * 2) continue;
      if (!C.get(Math.round(x), Math.round(y))) C.set(x, y, Wv[k]);
    }
  });
  // ばちの先から散る打撃の残光
  for (const [x0, y0] of [[16, 3], [81, 3]]) for (let i = 0; i < 4; i++) { const a = R() * 6.28, d = 3 + R() * 2.5; if (!C.get(Math.round(x0 + Math.cos(a) * d), Math.round(y0 + Math.sin(a) * d))) C.set(x0 + Math.cos(a) * d, y0 + Math.sin(a) * d, Wv[1 + Math.floor(R() * 2)]); }
  grit(C, 417, 48, 91, 36, 16);
  ash(C, 419, 8, [4, 30, 88, 50]);
  return C.toArt();
}
