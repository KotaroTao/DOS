import { sphere, ellipsoid, cone, slab, cyl, box, torus, tube, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { FLAG, STONE, WOOD, RIM, flagstones, arrowShafts, ash, grit } from "../fort.mjs";
export const meta = { id: "bs_dullahan", key: "hd_dullahan", w: 96, h: 96,
  note: "デュラハン: 首の無い黒紫の重鎧の騎士。断たれた首の喉輪から黒い闇の煙が絶えずくゆり、左脇に抱えた己の兜首の覗き穴で青緑の眼が燃える。棘の大肩、裾の裂けた黒い外套、右手の長剣は切っ先を床へ垂らす" };
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
export function build() {
  const mats = {
    black: { ramp: ramp(["#020203", "#060509", "#0c0a10", "#141118", "#1c1822", "#26202e", "#32293c", "#42384e", "#5a5068"], 9), spec: 1.6, pow: 40, specCol: "#b4aac8", dither: 0.45, amb: 0.17,
      shade: p => 0.08 * fbm(p.x * 0.35, p.y * 0.35, p.z * 0.35) },
    steel: { ramp: ramp(["#05060a", "#10121a", "#1c2030", "#2c3246", "#42485e", "#5e6680", "#848ca6"], 7), spec: 2, pow: 45, specCol: "#e8ecff", dither: 0.4 },
    cape: { ramp: ramp(["#020203", "#060509", "#0c0a10", "#141118", "#1d1922"], 5), dither: 0.7, amb: 0.22,
      shade: p => 0.12 * Math.sin(p.x * 0.8 + p.y * 0.05) },
    smoke: { ramp: ramp(["#020203", "#07050b", "#0e0a15", "#171021", "#22172f", "#302042", "#44305c"], 7), dither: 0.8, amb: 0.3, dif: 0.6, noRim: true,
      shade: p => 0.28 * fbm(p.x * 0.2 + p.y * 0.05, p.y * 0.16, 4) + 0.1 * Math.sin(p.y * 0.6 + p.x * 0.3) },
    brass: { ramp: ramp(["#050302", "#160f05", "#2c1f0a", "#463210", "#644a18", "#866624"], 6), spec: 1.2, pow: 30, specCol: "#d8b870", dither: 0.4 },
    leather: { ramp: ramp(["#030202", "#0e0907", "#1a110c", "#281a12"], 4), dither: 0.5 },
    void: { ramp: ["#000000", "#000000", "#020103"], amb: 0, dif: 0.05, noRim: true },
    flag: FLAG, stone: STONE, wood: WOOD,
  };
  // 外套: 背から床近くまで、裾は裂ける
  const capePoly = [[34, 28], [62, 28], [70, 50], [76, 76], [72, 86], [67, 80], [63, 88], [57, 82], [40, 84], [34, 88], [29, 80], [23, 86], [20, 76], [26, 50]];
  const cape = Disp(slab(capePoly, -7, 1.2, "cape", 0.8), (x, y, z) => 0.7 * Math.sin(x * 0.7 + 1.4 * fbm(x * 0.2, y * 0.2)));
  // 胴: 幅広の胸甲、首は無く喉輪の穴から闇
  const chest = U(1, ellipsoid([48, 39, 0], [12.4, 9.6, 7.6], "black"), ellipsoid([48, 40, 3], [2, 9, 6.4], "black"));
  const waist = ellipsoid([48, 51, 0], [9, 5, 6.4], "black");
  const skirt = [0, 1, 2].map(i => Sub(ellipsoid([48, 57 + i * 4, -0.5], [11 + i * 1.2, 2.6, 7.6 + i * 0.5], "black"), ellipsoid([48, 55 + i * 4, -0.5], [10 + i * 1.2, 2.6, 6.8 + i * 0.5], "black")));
  const collar = Sub(cyl([48, 31, -1.5], [48, 25.5, 2.5], 6.8, "black", 1.4), cyl([48, 29, -0.5], [48, 22, 5], 4.6, "void"), 0.4);
  const stump = cyl([48, 28.6, -0.2], [48, 28, 0.4], 4.4, "void");
  // 首の断面から立ちのぼる闇の煙
  const smoke = Disp(U(2.5, sphere([48, 24, -1], 4.2, "smoke"), sphere([46.5, 19, -1.5], 3.8, "smoke"), sphere([42, 14, -2.5], 4.4, "smoke"), sphere([53, 13, -2.5], 4.6, "smoke"), sphere([37, 8, -3], 3.4, "smoke"), sphere([58, 6, -3], 3.6, "smoke"), sphere([47, 9, -3], 3, "smoke")),
    (x, y, z) => 1.3 * fbm(x * 0.15 + Math.sin(y * 0.2), y * 0.12, z * 0.15, 3));
  // 棘の大肩
  const paul = (x, s) => [ellipsoid([x, 31, 1], [8.6, 5.6, 7.4], "black", s * 16), ellipsoid([x + s * 1.2, 35.6, 2], [7.6, 3, 6.6], "black", s * 22),
    cone([x + s * 1, 27.5, 1], [x + s * 4, 18, 0], 2.4, 0.3, "black"), cone([x + s * 5, 29, 2], [x + s * 11, 22, 1], 2, 0.3, "black")];
  // 右腕 (画面左): 長剣を下げる
  const armR = [cyl([35, 35, 1], [28, 45, 3], 3.6, "black", 1.3), sphere([28, 46, 3.5], 2.8, "black"), cyl([28, 47, 4], [25, 56, 6], 3.2, "black", 1.2), box([24.4, 58, 7], [3.2, 3, 3.2], "black", 1.2)];
  // 左腕 (画面右): 兜首を脇に抱える
  const armL = [cyl([61, 35, 1], [69, 45, -1], 3.6, "black", 1.3), sphere([69.5, 46, -0.5], 2.8, "black"), cyl([69, 48, 0], [62, 58, 9], 3.2, "black", 1.2), box([59.5, 59, 11], [3.4, 2.6, 3], "black", 1.2, 20)];
  // 兜首: 閉じた大兜、十字の覗き穴、頂に短い棘
  const hc = [67.5, 50, 9];
  const headHelm = Sub(U(0.8, ellipsoid(hc, [7.2, 8, 6.8], "black", 10), cyl([hc[0] + 1.4, hc[1] + 5, hc[2]], [hc[0] + 2.4, hc[1] + 8.6, hc[2] - 0.5], 5.6, "black", 1.6)),
    U(0, box([hc[0] + 0.4, hc[1] - 0.5, hc[2] + 7], [4.6, 0.85, 3], "void", 0.2, 10), box([hc[0] + 0.6, hc[1] + 2.6, hc[2] + 7], [0.85, 2.6, 3], "void", 0.2, 10)), 0.3);
  const headRidge = ellipsoid([hc[0] - 0.4, hc[1] - 2, hc[2]], [1.4, 6.4, 6.6], "black", 10);
  const headSpike = cone([hc[0] - 1, hc[1] - 7, hc[2]], [hc[0] - 2.4, hc[1] - 12, hc[2] - 1], 1.6, 0.3, "black");
  // 長剣: 手から左下の床へ
  const sx = 24, sy = 58, dxs = -0.42, dys = 1, ls = Math.hypot(dxs, dys), ux = dxs / ls, uy = dys / ls, nx = -uy, ny = ux;
  const P = (t, w) => [sx + ux * t + nx * w, sy + uy * t + ny * w];
  const blade = slab([P(5, -2), P(5, 2), P(32, 1.6), P(36, 0), P(32, -1.6)], 9, 0.9, "steel", 0.3, 0.4);
  const fuller = slab([P(7, -0.35), P(7, 0.35), P(28, 0.3), P(28, -0.3)], 9.9, 0.2, "void", 0.1);
  const guard = cyl([...P(4, -6), 9], [...P(4, 6), 9], 1.2, "black", 0.4);
  const grip = cyl([...P(-4, 0), 8.6], [...P(3.6, 0), 9], 1.2, "leather", 0.3);
  const pommel = sphere([...P(-5.6, 0), 8.4], 1.9, "brass");
  // 脚: 広く構えた重い脛当て、尖った鉄靴
  const legs = [cyl([42, 66, -1], [39, 76, 1], 4.8, "black", 1.6), cyl([55, 66, -1], [58, 76, 0], 4.8, "black", 1.6),
    cyl([38.6, 78, 2], [37.4, 86, 2], 4.2, "black", 1.4), cyl([58.6, 78, 1], [60, 86, 1], 4.2, "black", 1.4),
    ellipsoid([38.8, 76.8, 4.6], [4, 3, 3], "black"), ellipsoid([58.4, 76.8, 3.6], [4, 3, 3], "black"),
    cone([36, 88.6, 2], [33, 89.6, 10], 3.6, 1, "black"), cone([61, 88.6, 1], [64, 89.6, 9], 3.6, 1, "black")];
  const scene = U(0, flagstones(48, 92, 44, 13, { n: 5, seed: 91 }),
    ...arrowShafts([[80, 90, 4, 3, -8, 8]]),
    cape, smoke, chest, waist, ...skirt, collar, stump, ...paul(36, -1), ...paul(60, 1), ...armR, ...armL, headHelm, headRidge, headSpike, ...legs, blade, fuller, guard, grip, pommel);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [hc[0] + 1, hc[1] - 1, hc[2] + 10], r: 10, k: 0.3 }] });
  const C = new Canvas(r);
  // 煙の上ほど薄れて千切れる
  for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) {
    const p = C.pix[y * 96 + x]; if (!p || p.m !== "smoke") continue;
    const a = 1.15 - Math.max(0, (24 - y) / 22) * 0.75 + 0.8 * fbm(x * 0.28, y * 0.2, 7);
    if (a < 0.6) C.set(x, y, null);
  }
  // 喉輪の奥の闇に、かすかな紫の熾り
  for (const [x, y, c] of [[46, 28, "#2c1d40"], [50, 28, "#2c1d40"], [48, 28, "#58407a"], [47, 28, "#3e2a58"], [49, 28, "#3e2a58"]]) C.only(x, y, c);
  // 兜首の眼: 覗き穴で燃える青緑
  const E = ["#1c4a2a", "#4aa860", "#a8f0a0", "#f0fff0"];
  const ex = hc[0] + 0.4, ey = hc[1] - 0.5;
  C.set(ex - 3, ey, E[1]); C.set(ex - 2, ey, E[3]); C.set(ex - 1, ey, E[1]);
  C.set(ex + 2, ey + 0.5, E[1]); C.set(ex + 3, ey + 0.5, E[2]); C.set(ex + 4, ey + 0.5, E[0]);
  C.set(ex - 2, ey - 1, E[0]); C.set(ex + 3, ey - 0.5, E[0]);
  // 煙の筋: 首から幾筋もよじれて立ちのぼり、上で千切れる
  const R = rand(93);
  const S = ["#0a0710", "#130d1c", "#1e142c", "#2c1d40", "#3e2a58", "#58407a"];
  const freeS = (x, y) => { const p = C.pix[y * 96 + x]; return !C.get(x, y) || (p && p.m === "smoke"); };
  // 細い煙の筋
  for (const [x0, ph, drift, amp, top] of [[42, 0, 0.6, 1.6, 0], [54, 2, -0.5, 1.8, 0], [48, 4, 0.1, 2.2, 1]]) {
    for (let y = 12; y >= top; y--) {
      const t = (12 - y) / (12 - top);
      const x = x0 + amp * Math.sin(y * 0.6 + ph) + drift * (12 - y);
      if (R() < t * 0.4) continue;
      const X = Math.round(x); if (freeS(X, y)) C.set(X, y, S[t < 0.4 ? 3 : 2]);
    }
  }
  for (let i = 0; i < 14; i++) { const x = 38 + R() * 22, y = 0 + R() * 12; if (!C.get(Math.round(x), Math.round(y))) C.set(x, y, S[1 + Math.floor(R() * 3)]); }
  grit(C, 97, 48, 91, 40);
  ash(C, 99, 10);
  return C.toArt();
}
