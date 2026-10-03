import { tube, sphere, ellipsoid, cone, slab, U, Sub, Disp, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { MOULD, MOSS, ROOT, RIM, forestFloor, mist, leaves, tri } from "../forest.mjs";
export const meta = { id: "bs_chimera", key: "hd_chimera", w: 96, h: 96,
  note: "キマイラ: 獅子の胴に獅子・山羊・蛇の三つ首。たてがみの獅子が顎を裂いて前方へ大きく炎のブレスを吐き、背から捻れ角の山羊が、尾の先から牙を剥いた蛇が鎌首をもたげる。炎に照らされた森の床" };
export function build() {
  const mats = {
    fur: { ramp: ramp(["#040201", "#0e0703", "#1c0f06", "#2c190b", "#3e2611", "#543518", "#6e4820", "#8c602c"], 8), dither: 0.55, spec: 0.2, pow: 14,
      shade: p => 0.08 * fbm(p.x * 0.8, p.y * 0.8, p.z * 0.8) },
    mane: { ramp: ramp(["#040101", "#100503", "#200b05", "#321308", "#481d0c", "#622a12", "#7e3a18"], 7), dither: 0.7,
      shade: p => 0.18 * Math.sin(Math.atan2(p.y - 40, p.x - 40) * 9 + 2 * fbm(p.x * 0.3, p.y * 0.3)) },
    goat: { ramp: ramp(["#050403", "#120f0b", "#221d16", "#352e22", "#4c4231", "#665a42", "#827456"], 7), dither: 0.6, shade: p => 0.08 * fbm(p.x * 0.9, p.y * 0.9) },
    horn: { ramp: ramp(["#080705", "#1e1a12", "#3a3222", "#5c5038", "#857456", "#ab9a78"], 6), spec: 0.6, pow: 20, dither: 0.45,
      shade: p => 0.2 * Math.sin((p.x + p.y) * 1.6) },
    snake: { ramp: ramp(["#020402", "#081008", "#10200f", "#1a3016", "#26421e", "#345628"], 6), spec: 0.8, pow: 25, specCol: "#6a8a4a", dither: 0.5,
      shade: p => 0.14 * (Math.sin(p.x * 1.9) * Math.sin(p.y * 1.9) > 0.2 ? 1 : 0) },
    eye: { ramp: ["#7a3a04", "#e09018", "#fff0a0"], emit: p => 0.5 + 0.5 * Math.max(0, p.nz) },
    seye: { ramp: ["#3a6a10", "#a0e030"], emit: p => 0.4 + 0.6 * Math.max(0, p.nz) },
    maw: { ramp: ["#000000", "#1a0402", "#3a0a04"], amb: 0.1, dif: 0.3, noRim: true },
    mould: MOULD, moss: MOSS, root: ROOT,
  };
  // 獅子の胴: 胸を張った肩から、細く締まった腰へ
  const torso = U(3, ellipsoid([50, 56, 0], [12, 12, 10], "fur"), ellipsoid([66, 55, -1], [14, 9.5, 8.5], "fur"), ellipsoid([78, 56, -1], [8, 9, 8], "fur"));
  const leg = (hip, knee, paw, r) => U(1.2, tube([[...hip, r], [...knee, r * 0.7], [...paw, r * 0.55]], "fur", { seg: 3 }), ellipsoid([paw[0] - 1.5, paw[1] + 1, paw[2] + 1], [r * 0.95, r * 0.55, r * 0.9], "fur"));
  const legs = [
    leg([45, 60, 6], [42, 74, 8], [40, 86, 9], 5), leg([53, 62, -5], [54, 75, -5], [52, 86, -4], 4.4),
    leg([76, 60, 5], [80, 72, 6], [76, 86, 7], 5.2), leg([82, 60, -5], [86, 72, -5], [83, 85, -4], 4.4)];
  // 獅子の頭: 顎を大きく開く (上顎は上へ、下顎は下へ)
  const skull = ellipsoid([33, 40, 7], [7.5, 7, 6.5], "fur");
  const upper = ellipsoid([25, 40, 9], [6, 3.4, 4.4], "fur", 12);
  const lower = ellipsoid([26, 49, 8], [5.4, 2.6, 4], "fur", -22);
  const nose = ellipsoid([20.5, 39.5, 10], [2, 1.6, 2], "fur");
  const brow = ellipsoid([31, 35.5, 11], [4.5, 1.6, 2.4], "fur", -8);
  const ears = [ellipsoid([36, 30, 3], [2.4, 3, 1.8], "fur", 20), ellipsoid([40, 33, -2], [2.4, 3, 1.8], "fur", 30)];
  const lion = U(1.4, skull, upper, lower, nose, brow, ...ears);
  const mawCut = U(0, ellipsoid([24, 44.5, 10], [6, 2.8, 4], "maw", -6));
  // たてがみ: 頭の後ろに房の重なり
  const R = rand(901);
  const tufts = [];
  for (let i = 0; i < 22; i++) {
    const a = -2.2 + i / 21 * 4.4, r0 = 9 + R() * 3;
    const x = 37 + Math.cos(a) * r0 * 0.9, y = 43 + Math.sin(a) * r0, z = -2 - R() * 4;
    const tx = x + Math.cos(a) * 5 + 2, ty = y + Math.sin(a) * 5 + 2;
    tufts.push(cone([x, y, z], [tx, ty, z - 1], 4.2, 1.2, "mane"));
  }
  const mane = Disp(U(2, ellipsoid([39, 44, -2], [10, 12, 8], "mane"), ...tufts), (x, y, z) => 0.6 * fbm(x * 0.4, y * 0.4, z * 0.4));
  // 山羊の頭: 背から伸びる首、斜め前を睨む細い顔、捻れた角
  const gNeck = tube([[63, 50, -1, 5.4], [64, 40, 0, 4.2], [63, 33, 1, 3.6]], "goat", { seg: 3 });
  const gHead = U(1.2, ellipsoid([61, 28, 2], [5, 4.6, 4.4], "goat", 10), ellipsoid([54, 32, 3], [5.8, 3, 3.1], "goat", 26));
  const gEar = ellipsoid([67.5, 31, 3], [3.8, 1.4, 1.4], "goat", 30);
  const beard = Disp(cone([53, 34.5, 4], [54.5, 42, 4], 2, 0.4, "goat"), (x, y, z) => 0.3 * Math.sin(x * 2));
  // 捻れ角: 頭頂から後ろへ巻き込む渦 (内へ巻くほど細く)
  const horn = (ox, oy, z) => {
    const pts = [];
    for (let k = 0; k <= 12; k++) {
      const t = k / 12, a = 2.5 + t * 5.6, r = 7.5 - t * 4.6;
      pts.push([69 + ox + Math.cos(a) * r, 21 + oy + Math.sin(a) * r * 0.95, z - t * 2, 2.6 - t * 1.9]);
    }
    return Disp(tube(pts, "horn", { seg: 2 }), (x, y, z) => 0.3 * Math.sin((x - y) * 2.2));
  };
  const goat = U(1.2, gNeck, gHead, gEar, beard);
  // 蛇の尾: 腰から後ろへ垂れ、跳ね上がって鎌首をもたげる
  const tailPts = [[84, 56, -3, 3], [90, 50, -2, 2.7], [92, 38, -1, 2.5], [91, 24, 0, 2.4], [86, 15, 1, 2.6]];
  const tail = Disp(tube(tailPts, "snake", { seg: 4 }), (x, y, z) => 0.2 * Math.sin(y * 1.6));
  const sHead = U(1, ellipsoid([82, 12, 2], [5, 3.2, 3.2], "snake", -18), ellipsoid([78, 16, 3], [3.6, 1.4, 2.4], "snake", -10));
  const sMaw = ellipsoid([78.5, 14.2, 3.5], [3.4, 1.2, 2.2], "maw", -14);
  const body = U(0, Sub(lion, mawCut, 0.4), mane, U(2.4, torso, ...legs), goat, horn(0, 0, 3), horn(-3.5, -1.5, -2), Sub(U(1, tail, sHead), sMaw, 0.3));
  const eyes = [ellipsoid([28.5, 37.5, 12], [1.4, 0.9, 1], "eye", -10), ellipsoid([59.4, 27.2, 6.4], [1.3, 0.8, 0.8], "eye"), sphere([81, 10.6, 4.6], 0.9, "seye")];
  const scene = U(0, forestFloor(56, 90, 40, 14, { n: 4, roots: 2, seed: 911 }), body, ...eyes);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [14, 46, 24], r: 60, k: 1.1 }] });
  const C = new Canvas(r);
  // 獅子の牙と、蛇の牙
  const F = ["#8a6a3a", "#f0dcb0"];
  for (const x of [21, 27]) tri(C, [x, 42], [x + 1.6, 42], [x + 0.8, 45.4], F[1]);
  for (const x of [22, 28]) tri(C, [x, 47.6], [x + 1.6, 47.6], [x + 0.8, 44.6], F[0]);
  tri(C, [76, 13.4], [77.2, 13.4], [76.6, 16], F[1]); tri(C, [79.4, 13.6], [80.4, 13.6], [79.9, 15.6], F[1]);
  // 炎のブレス (2D): 口から前方やや下へ扇状に広がる火炎。軸からの距離と乱流で舌のような縁を作る
  const FIRE = ["#4a0a02", "#8a1e04", "#c84008", "#ee7414", "#ffb030", "#ffe27a", "#fffadc"];
  const BY = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  const Mx = 21, My = 44.5, dl = Math.hypot(1, 0.22), dx = -1 / dl, dy = 0.22 / dl;
  for (let y = 0; y < 96; y++) for (let x = 1; x < 30; x++) {
    const vx = x + 0.5 - Mx, vy = y + 0.5 - My, t = vx * dx + vy * dy; if (t < -1) continue;
    const l0 = -vx * dy + vy * dx;
    const l = l0 + 6 * fbm(x * 0.12, y * 0.12, 5) * Math.min(1, t / 12) - Math.sin(t * 0.3) * 2;
    const w = 2 + Math.max(0, t) * 1.25;
    const tong = 0.62 + 1.0 * fbm(t * 0.1 + 3, l0 * 0.32, 9);
    let v = (1 - Math.abs(l) / w) * tong * (t > 16 ? Math.max(0, 1 - (t - 16) / 7) : 1);
    if (v <= 0) continue;
    v = v * 1.45 + Math.max(0, 1 - t / 24) * 0.3 + ((BY[y & 3][x & 3] + 0.5) / 16 - 0.5) * 0.18;
    if (v < 0.16) continue;
    C.set(x, y, FIRE[Math.max(0, Math.min(6, Math.floor((v - 0.16) / 0.95 * 7)))]);
  }
  // 山羊の鼻先
  C.set(48, 33, "#000000"); C.set(48, 34, "#000000");
  // 火の粉
  const Rs = rand(919);
  const sp = ["#c84008", "#ffb030", "#ffe27a"];
  for (let i = 0; i < 20; i++) { const x = Math.round(2 + Rs() * 36), y = Math.round(22 + Rs() * 44); if (!C.get(x, y)) C.set(x, y, sp[Math.floor(Rs() * 3)]); }
  mist(C, 913, 2, [40, 4, 56, 20], 0.3);
  leaves(C, 917, 56, 89, 36, 18);
  return C.toArt();
}
