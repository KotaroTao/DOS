import { tube, sphere, ellipsoid, cone, slab, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand, fangs } from "../sdf.mjs";
import { MOULD, MOSS, ROOT, RIM, MIST, forestFloor, mist, spores, leaves, tri } from "../forest.mjs";
export const meta = { id: "bs_fogpanther", key: "hd_fogpanther", w: 96, h: 96,
  note: "霧豹: 霧の中から半ば姿を現した、しなやかな大豹。肩を張って低く伏せ、牙を剥いて今にも飛びかかる。前半身は灰青の毛並み、後ろ半身は霧に溶けて消えかけ、青白い眼だけが光る" };
export function build() {
  const mats = {
    fur: { ramp: ramp(["#030405", "#080a0d", "#0f1317", "#171c22", "#21272e", "#2d343c", "#3c444d", "#4f5862"], 8), spec: 0.4, pow: 20, specCol: "#7c8894", dither: 0.6,
      shade: p => { const n = vnoise(p.x * 0.38, p.y * 0.38, p.z * 0.38); return (n > 0.35 && n < 0.55 ? -0.13 : 0) + 0.06 * fbm(p.x * 0.8, p.y * 0.8, p.z * 0.8); } },
    nose: { ramp: ramp(["#040404", "#0e0c0e", "#1c181c", "#2c262c"], 4), spec: 1.2, pow: 40, specCol: "#6c646c" },
    claw: { ramp: ramp(["#14140f", "#3a382e", "#6a6656", "#a8a28a"], 4), spec: 1, pow: 30 },
    eye: { ramp: ["#2a4e66", "#6aa8cc", "#c4ecff", "#ffffff"], emit: p => 0.6 + 0.4 * Math.max(0, p.nz) },
    maw: { ramp: ["#000000", "#140507", "#26090c"], amb: 0.25, dif: 0.3, noRim: true },
    mould: MOULD, moss: MOSS, root: ROOT,
  };
  // 低く伏せた細長い体: 肩甲骨が高く盛り上がり、頭を突き出して唸る。片方の前脚は爪を剥いて振り上げる
  const chest = ellipsoid([34, 58, 7], [10, 11, 9], "fur", -25);
  const shoulder = [ellipsoid([39, 44, 11], [5.5, 6, 4.5], "fur", -30), ellipsoid([45, 45, -2], [5.5, 6, 4.5], "fur", -30)];
  const torso = tube([[38, 54, 4, 9.5], [52, 57, 0, 8.4], [66, 58, -3, 8.6], [76, 60, -6, 9.4]], "fur", { seg: 3 });
  const belly = ellipsoid([54, 65, 2], [13, 4.5, 6.5], "fur");
  const neck = tube([[34, 50, 8, 7.4], [25, 50, 13, 6.4]], "fur");
  const head = ellipsoid([19, 49, 16], [7.8, 6.8, 7.2], "fur", -10);
  const cheeks = [ellipsoid([15, 53.5, 19], [4, 3.6, 4], "fur"), ellipsoid([24, 53, 16], [4, 3.6, 4], "fur")];
  const muzzle = ellipsoid([11, 53, 21], [4.6, 3.4, 4.4], "fur", -12);
  const jaw = ellipsoid([14, 60, 18], [5, 2.2, 4], "fur", 18);
  const ears = [ellipsoid([15, 42.5, 14], [2.4, 2.4, 1.4], "fur", -25), ellipsoid([24.5, 42, 10], [2.4, 2.4, 1.4], "fur", 25)];
  const brow = ellipsoid([15, 47.5, 22], [4.2, 1.5, 1.8], "fur", -12);
  // 振り上げた前脚 (爪を剥く) と、床を踏みしめる前脚
  const legF = tube([[30, 62, 14, 5], [21, 71, 20, 3.8], [12, 72, 24, 3], [7, 70, 25, 3]], "fur", { seg: 3 });
  const pawF = ellipsoid([6, 70, 25], [3.6, 3.6, 3.8], "fur", 20);
  const legF2 = tube([[40, 64, -2, 5], [36, 76, 4, 3.8], [30, 85, 8, 2.9], [25, 87, 10, 2.9]], "fur", { seg: 3 });
  const pawF2 = ellipsoid([23, 87.5, 10], [4.4, 2.2, 3.8], "fur");
  const legF3 = tube([[30, 64, 2, 4.4], [24, 76, 8, 3.4], [14, 85, 14, 2.8], [10, 87, 15, 2.8]], "fur", { seg: 3 });
  const pawF3 = ellipsoid([8, 87.5, 15], [4.2, 2.2, 3.6], "fur");
  // 後ろ脚: 折り畳んで跳躍の溜め
  const haunch = ellipsoid([74, 62, 2], [9, 10, 8], "fur", 20);
  const legB = tube([[76, 67, 6, 5.5], [66, 79, 10, 3.8], [76, 86, 10, 2.6], [68, 88, 12, 2.4]], "fur", { seg: 3 });
  const legB2 = tube([[80, 65, -10, 4.6], [74, 79, -8, 3.4], [84, 86, -8, 2.4], [78, 88, -6, 2.2]], "fur", { seg: 3 });
  const tail = tube([[82, 57, -6, 3.2], [90, 48, -4, 2.8], [92, 36, -2, 2.5], [89, 27, 0, 2.3], [84, 23, 2, 2.1]], "fur", { seg: 4 });
  const cat = Disp(U(2, chest, ...shoulder, torso, belly, neck, head, ...cheeks, muzzle, jaw, ...ears, brow, legF, pawF, legF2, pawF2, legF3, pawF3, haunch, legB, legB2, tail), (x, y, z) => 0.15 * fbm(x * 0.9, y * 0.9, z * 0.9));
  const earIn = [ellipsoid([15, 43, 15.5], [1.2, 1.2, 0.8], "maw"), ellipsoid([24.5, 42.5, 11.5], [1.2, 1.2, 0.8], "maw")];
  const mouth = ellipsoid([11, 57.5, 23], [5.4, 2.6, 3.6], "maw", 16);
  const sockets = U(0, ellipsoid([13.5, 49.8, 22.6], [2.3, 1.3, 2], "maw", 18), ellipsoid([21.5, 49, 21.6], [2.1, 1.2, 2], "maw", -12));
  const eyes = [ellipsoid([13.5, 50, 22.2], [1.9, 0.9, 1], "eye", 18), ellipsoid([21.5, 49.2, 21.2], [1.7, 0.85, 1], "eye", -12)];
  const nose = ellipsoid([7, 51.5, 24], [2, 1.4, 1.6], "nose");
  // 爪: 振り上げた前脚から鉤爪を剥き、床の前脚は腐葉土に食い込む
  const claws = [];
  for (const [x, z] of [[3, 26], [5, 27.5], [7.5, 28], [10, 27]]) claws.push(cone([x + 0.5, 72.5, z], [x - 1.5, 76.5, z + 0.5], 0.9, 0.25, "claw"));
  for (const [x, z] of [[4, 16], [6, 17.5], [8.5, 18]]) claws.push(cone([x + 1, 87, z], [x - 1, 89.5, z + 1], 0.8, 0.25, "claw"));
  for (const [x, z] of [[19, 12], [21, 13.5], [23.5, 14]]) claws.push(cone([x + 1, 87, z], [x - 1, 89.5, z + 1], 0.8, 0.25, "claw"));
  const scene = U(0, forestFloor(40, 91, 40, 14, { n: 4, roots: 2, seed: 571 }), Sub(cat, U(0, mouth, sockets, ...earIn), 0.5), ...eyes, nose, ...claws);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [16, 48, 32], r: 13, k: 0.25 }] });
  const C = new Canvas(r);
  fangs(C, "maw", 7, 16, { step: 3, top: [3, 4], bot: [2, 3], seed: 7, cols: ["#4c4a40", "#a8a28a", "#e8e2c8"] });
  // 後ろ半身が霧に溶ける: 右へ行くほど体の画素をまばらにし、霧の色に置き換える
  const BY = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) {
    const p = C.pix[y * 96 + x]; if (!p || p.m !== "fur") continue;
    const t = (x - 48) / 28 + 0.6 * fbm(x * 0.08, y * 0.2, 4) + 0.2 * vnoise(x * 0.6, y * 0.2, 9);
    if (t <= 0) continue;
    const b = (BY[y & 3][x & 3] + 0.5) / 16;
    const mi = Math.min(3, Math.round((p.idx ?? 3) * 3 / 7));
    if (t > 0.55 + b * 0.5) C.set(x, y, null);
    else if (t > 0.3 + b * 0.4) C.set(x, y, MIST[Math.max(0, mi - 1)]);
    else if (t > b * 0.6) C.set(x, y, MIST[mi]);
  }
  // 体から立ちのぼる霧のすじ
  mist(C, 573, 6, [46, 14, 50, 70], 0.42);
  mist(C, 579, 1, [0, 36, 40, 12], 0.2);
  spores(C, 575, 10, [4, 6, 88, 40]);
  leaves(C, 577, 30, 90, 30, 14);
  return C.toArt();
}
