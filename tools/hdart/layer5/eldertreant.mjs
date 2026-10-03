import { tube, sphere, ellipsoid, cone, slab, cyl, box, torus, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand, fangs } from "../sdf.mjs";
import { fingers } from "../human.mjs";
import { MOULD, MOSS, ROOT, RIM, MIST, forestFloor, mist, spores, leaves, bark } from "../forest.mjs";
export const meta = { id: "el_eldertreant", key: "hd_eldertreant", w: 112, h: 128,
  note: "古樹の巨人 (強敵): 人の形に立ち上がった巨大な古木。分厚い樹皮の胴と根の脚で大地を踏みしめ、肩と頭には苔と若木が生える。幹の裂けた大口から土砂・小石・木の葉の嵐を前へ吐き出す" };
export function build() {
  const W = 112, H = 128;
  const mats = {
    bark: { ramp: ramp(["#030201", "#0a0705", "#130e09", "#1d150e", "#291e14", "#36281b", "#453423", "#57422d", "#6b5238"], 9), dither: 0.5, spec: 0.2, pow: 14,
      shade: p => 0.17 * Math.sin(p.x * 1.0 + p.y * 0.12 + 2.6 * fbm(p.x * 0.1, p.y * 0.06, p.z * 0.1)) + 0.07 * fbm(p.x * 0.7, p.y * 0.7, p.z * 0.7) },
    leaf: { ramp: ramp(["#020301", "#081006", "#10200b", "#1a3112", "#27441a", "#375a22", "#4a702c"], 7), dither: 0.8, amb: 0.22,
      shade: p => 0.25 * fbm(p.x * 1.2, p.y * 1.2, p.z * 1.2) },
    rock: { ramp: ramp(["#030302", "#0c0b09", "#191713", "#28251f", "#39352d", "#4c473d", "#625b4e"], 7), spec: 0.4, pow: 20, dither: 0.5,
      shade: p => 0.1 * fbm(p.x * 0.8, p.y * 0.8, p.z * 0.8) },
    eye: { ramp: ["#3a2400", "#8a5a08", "#e0a830", "#fff0a0"], emit: p => 0.6 + 0.4 * Math.max(0, p.nz) },
    maw: { ramp: ["#000000", "#000000", "#0a0603", "#160c06"], amb: 0.1, dif: 0.4, noRim: true },
    mould: MOULD, moss: MOSS, root: ROOT,
  };
  const R = rand(5301);
  // 胴: 分厚い樹皮の樽のような胴。前のめりに、肩は苔むした瘤
  const torso = ellipsoid([66, 58, -2], [22, 26, 16], "bark");
  const hips = ellipsoid([66, 80, -2], [18, 10, 13], "bark");
  const shL = ellipsoid([44, 40, 0], [12, 10, 12], "bark", 20), shR = ellipsoid([88, 40, -2], [12, 10, 12], "bark", -20);
  // 頭: 胴にめり込んだ切り株のような頭、張り出した眉
  const head = ellipsoid([66, 24, 2], [12, 11, 11], "bark");
  const brow = ellipsoid([66, 25, 11], [11, 3.4, 4], "bark");
  const sockets = U(0, ellipsoid([61, 28.5, 12], [2.8, 2, 3.4], "maw"), ellipsoid([71, 28.5, 12], [2.8, 2, 3.4], "maw"));
  // 腕: 右 (画面右) は重く垂らし根の拳、左は肘を張って口の前の嵐を煽る
  const armR = tube([[90, 44, 2, 8], [98, 66, 6, 6.6], [100, 88, 10, 6]], "bark", { seg: 4 });
  const fistR = Disp(ellipsoid([100, 94, 12], [7, 7, 7], "bark"), (x, y, z) => 0.6 * Math.abs(Math.sin(x * 1.1)));
  const clawR = fingers([100, 98, 12], 95, "bark", { n: 4, len: 10, spread: 30, r: 1.6, curl: 0.25, z: 2 });
  const armL = tube([[42, 44, 2, 8], [32, 64, 6, 6.6], [30, 86, 10, 6]], "bark", { seg: 4 });
  const handL = [Disp(ellipsoid([30, 92, 12], [6.6, 6.6, 6.6], "bark"), (x, y, z) => 0.6 * Math.abs(Math.sin(x * 1.1))), ...fingers([30, 96, 12], 85, "bark", { n: 4, len: 10, spread: 30, r: 1.6, curl: -0.25, z: 2 })];
  // 根の脚: 腰から太い根の柱が床へ、足元で根が広がって大地を掴む
  const legL = tube([[56, 84, -2, 9], [50, 100, 2, 8], [47, 116, 4, 9]], "bark", { seg: 3 });
  const legR = tube([[76, 84, -2, 9], [82, 100, 0, 8], [86, 116, 2, 9]], "bark", { seg: 3 });
  const feet = [];
  for (const [fx, fz] of [[47, 4], [86, 2]]) for (let i = 0; i < 5; i++) {
    const a = (i / 4 - 0.5) * 2.6 + Math.PI / 2, L = 9 + R() * 6;
    feet.push(tube([[fx, 114, fz, 4], [fx + Math.cos(a) * L * 0.6, 119, fz + Math.sin(a) * L * 0.4 + 2, 2.4], [fx + Math.cos(a) * L, 122, fz + Math.sin(a) * L * 0.6 + 2, 0.8]], "bark", { seg: 2 }));
  }
  // 幹の裂けた大口 (胸)
  const mouth = Disp(ellipsoid([58, 56, 16], [11, 9, 9], "maw", -18), (x, y, z) => 1.2 * fbm(x * 0.4, y * 0.4, z * 0.4));
  const lips = [ellipsoid([60, 46.5, 12], [13, 3.4, 5], "bark", -18), ellipsoid([56, 66, 12], [12, 3.4, 5], "bark", -18)];
  const body = Disp(U(3, torso, hips, shL, shR, head, brow, armR, fistR, ...clawR, armL, ...handL, legL, legR, ...feet, ...lips), bark(0.6, 1.2));
  const giant = Paint(Sub(body, U(0, mouth, sockets), 1),
    (x, y, z, m) => (m === "bark" && ((y < 46 && fbm(x * 0.2, y * 0.2, z * 0.2 + 3) > -0.05) || fbm(x * 0.14 + 9, y * 0.14, z * 0.14, 3) > 0.28)) ? "moss" : m);
  const eyes = [sphere([61, 28.5, 10.6], 1.4, "eye"), sphere([71, 28.5, 10.6], 1.4, "eye")];
  // 肩と頭に生える若木 (細い幹 + 葉の茂み)
  const saplings = [];
  for (const [x, y, z, h, s] of [[60, 15, 0, 6, 1.3], [73, 14, -2, 8, 1.45], [42, 32, 2, 5, 1.05], [90, 32, 0, 5, 1.0], [66, 14, 5, 3, 0.8]]) {
    saplings.push(tube([[x, y + 2, z, 1.4 * s], [x + (R() - 0.5) * 3, y - h * 0.6, z, 0.9 * s], [x + (R() - 0.5) * 4, y - h, z, 0.5]], "root", { seg: 2 }));
    saplings.push(Disp(ellipsoid([x + (R() - 0.5) * 2, y - h - 2 * s, z], [5.8 * s, 4.2 * s, 5 * s], "leaf"), (X, Y, Z) => 1.1 * fbm(X * 0.6, Y * 0.6, Z * 0.6)));
  }
  // 吐き出す土砂の嵐の中の石塊 (立体)
  const rocks = [];
  const B0 = [57, 58], BD = [-45, 58]; // 嵐の芯の線 (口 → 左下)
  const B = (t) => [B0[0] + BD[0] * t, B0[1] + BD[1] * t];
  for (let i = 0; i < 9; i++) {
    const t = 0.18 + R() * 0.75, [bx, by] = B(t), off = (R() - 0.5) * (6 + t * 30);
    rocks.push(Disp(ellipsoid([bx + off * 0.79, by + off * 0.61, 24], [1.4 + R() * 2.2, 1.2 + R() * 1.8, 1.6], "rock", R() * 180), (X, Y, Z) => 0.3 * fbm(X, Y, Z)));
  }
  const scene = U(0, forestFloor(66, 122, 46, 18, { n: 6, roots: 4, seed: 5303 }), giant, ...eyes, ...saplings, ...rocks);
  const r = render(scene, mats, { w: W, h: H, rim: RIM, zTop: 70, lights: [{ p: [66, 30, 22], r: 14, k: 0.3 }] });
  const C = new Canvas(r);
  fangs(C, "maw", 48, 68, { step: 2, top: [2, 4], bot: [2, 4], cols: ["#291e14", "#57422d", "#8a7050"], seed: 13 });
  C.set(61, 28, "#fff0a0"); C.set(71, 28, "#fff0a0");
  // 土砂と木の葉の嵐: 口から左下へ扇状に広がる帯
  const BY = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  const DUST = ["#2a2216", "#43372a", "#5e4f38", "#7e6a4a", "#a08a62", "#c4b088"];
  const LL = BD[0] * BD[0] + BD[1] * BD[1], nX = -BD[1] / Math.sqrt(LL), nY = BD[0] / Math.sqrt(LL);
  for (let y = 44; y < H; y++) for (let x = 0; x < 72; x++) {
    const dx = x - B0[0], dy = y - B0[1], t = (dx * BD[0] + dy * BD[1]) / LL;
    if (t < 0 || t > 1.15) continue;
    const s = dx * nX + dy * nY, swirl = 0.6 * fbm(t * 7, s * 0.32, 7) + 0.4 * fbm(x * 0.15, y * 0.15, 9);
    const w = (4 + t * 24) * (0.85 + 0.35 * fbm(t * 6, s * 0.15, 11));
    const d = Math.abs(s);
    if (d > w) continue;
    const p = C.pix[y * W + x];
    if (p && (p.m === "rock" || p.z > 26)) continue;
    const core = 1 - d / w;
    const a = (0.5 + 0.9 * core) * (0.75 + 0.9 * swirl) * (1 - Math.max(0, t - 0.72) * 2.2);
    if (a > (BY[y & 3][x & 3] + 0.5) / 16 * 0.9) C.set(x, y, DUST[Math.max(0, Math.min(5, Math.floor(0.5 + core * 2.4 + swirl * 4.5 - t * 1.4)))]);
  }
  // 嵐の先で渦を巻く土煙の塊
  for (const [t, off, rr] of [[0.8, -0.6, 9], [0.9, 0.3, 10], [0.7, 0.9, 7], [1.0, -0.2, 8], [0.62, -0.9, 6]]) {
    const w = 4 + t * 24, cx = B0[0] + BD[0] * t + off * w * nX, cy = B0[1] + BD[1] * t + off * w * nY;
    for (let y = Math.floor(cy - rr); y <= cy + rr; y++) for (let x = Math.floor(cx - rr); x <= cx + rr; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const d = Math.hypot(x - cx, y - cy) / rr; if (d > 1) continue;
      const p = C.pix[y * W + x]; if (p && (p.m === "rock" || p.z > 26)) continue;
      const v = (1 - d) * (0.7 + 0.8 * fbm(x * 0.2, y * 0.2, 13)), lit = (cx - x) * 0.04 + (cy - y) * 0.06;
      if (v > (BY[y & 3][x & 3] + 0.5) / 16 * 0.7) C.set(x, y, DUST[Math.max(0, Math.min(4, Math.floor(1 + v * 1.6 + lit * 2.5)))]);
    }
  }
  // 流れの筋 (明るい砂の流線)
  for (let k = 0; k < 9; k++) {
    const s0 = (R() * 2 - 1) * 0.8, t0 = 0.05 + R() * 0.4, t1 = t0 + 0.15 + R() * 0.2;
    for (let t = t0; t < Math.min(1, t1); t += 0.006) {
      const w = 4 + t * 24, off = s0 * w + Math.sin(t * 9 + k) * 1.5;
      const x = B0[0] + BD[0] * t + off * nX, y = B0[1] + BD[1] * t + off * nY, p = C.pix[Math.round(y) * W + Math.round(x)];
      if (p && p.m === "rock") continue;
      C.set(x, y, DUST[(t - t0) / (t1 - t0) < 0.35 ? 5 : 4]);
    }
  }
  // 嵐の中の小石と木の葉 (流れに沿った短い筋)
  const LV = ["#375a22", "#4a702c", "#6a5a1a", "#7a4a1a", "#4e3616"];
  for (let i = 0; i < 70; i++) {
    const t = 0.08 + R() * 0.95, w = 4 + t * 24, off = (R() * 2 - 1) * w;
    const x = B0[0] + BD[0] * t + off * nX, y = B0[1] + BD[1] * t + off * nY;
    if (x < 0 || y >= H) continue;
    if (i % 3 === 0) { C.set(x, y, "#625b4e"); C.set(x + 1, y, "#39352d"); C.set(x, y + 1, "#191713"); }
    else { const c = LV[Math.floor(R() * LV.length)]; C.set(x, y, c); C.set(x - 1, y + 1, c); C.set(x, y + 1, c); C.set(x + 1, y + 1, "#10200b"); }
  }
  spores(C, 5309, 20, [60, 2, 50, 100]);
  leaves(C, 5311, 66, 121, 44, 24);
  return C.toArt();
}
