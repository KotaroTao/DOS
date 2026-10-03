import { tube, sphere, ellipsoid, cone, slab, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { MOULD, MOSS, ROOT, RIM, forestFloor, mist, spores, leaves } from "../forest.mjs";
import { cracks } from "../mine.mjs";
export const meta = { id: "bs_mossgolem", key: "hd_mossgolem", w: 96, h: 96,
  note: "苔生す岩塊: 丸い巨岩を積み上げた森の番人。肩と頭に厚い苔の層とシダが茂り、古い根が胴に巻きつく。岩の隙間から緑の眼光と燐光が洩れ、太い岩の拳を床につく" };
export function build() {
  const mats = {
    stone: { ramp: ramp(["#030403", "#0a0c0a", "#131612", "#1d201b", "#282c25", "#353a31", "#454a3f", "#585e50"], 8), spec: 0.3, pow: 16, dither: 0.55,
      shade: p => 0.12 * fbm(p.x * 0.4, p.y * 0.4, p.z * 0.4) },
    eye: { ramp: ["#1e3a10", "#4c8a20", "#a0e050", "#e8ffb0"], emit: p => 0.55 + 0.45 * Math.max(0, p.nz) },
    maw: { ramp: ["#000000", "#040604", "#080c07"], amb: 0.1, dif: 0.2, noRim: true },
    fern: { ramp: ramp(["#061006", "#10240c", "#1c3a12", "#2c5418", "#40702a"], 5), dither: 0.6, amb: 0.3 },
    mould: MOULD, moss: MOSS, root: ROOT,
  };
  // 岩: 上面ほど苔に覆われる (mk = 苔の下端、中心からの高さの割合)。苔の部分は少し盛り上がる
  const mossy = (c, r, mk) => (x, y, z) => (c[1] - y) / r - mk + 0.35 * fbm(x * 0.3, y * 0.3, z * 0.3) + 0.25 * Math.max(0, (z - c[2]) / r);
  const rock = (c, r, s = 1, mk = 0.45) => Paint(Disp(ellipsoid(c, [r * s, r, r * 0.9], "stone"), (x, y, z) => cracks(0.6, 0.3)(x, y, z) + 0.5 * fbm(x * 0.2, y * 0.2, z * 0.2) - 1.1 * Math.min(1, Math.max(0, mossy(c, r, mk)(x, y, z) * 3)) * (0.6 + 0.6 * fbm(x * 0.5, y * 0.5, z * 0.5))),
    (x, y, z, m) => m === "stone" && mossy(c, r, mk)(x, y, z) > 0 ? "moss" : m);
  // 体: 胴の大岩、腰の岩、肩の岩、首の無い頭岩 (肩の間に沈む)
  const torso = rock([48, 50, 0], 17, 1.12, 0.72);
  const belly = rock([48, 68, 2], 11, 1.2, 0.9);
  const head = rock([47, 27, 7], 8.5, 1.1, 0.5);
  const shL = rock([27, 35, 2], 10.5, 1, 0.3), shR = rock([69, 35, 1], 10.5, 1, 0.3);
  // 腕: 岩の連なり → 太い拳 (床につく)、拳の前に指の節の岩
  const armL = [rock([20, 51, 6], 7.5, 1, 0.7), rock([17, 65, 10], 7, 1, 0.8)], fistL = rock([17, 78, 12], 9.5, 1.05, 0.85);
  const armR = [rock([77, 51, 5], 7.5, 1, 0.7), rock([80, 65, 9], 7, 1, 0.8)], fistR = rock([80, 78, 11], 9.5, 1.05, 0.85);
  const knuck = [];
  for (const [x, z] of [[11, 18], [16, 20], [21, 19], [75, 17], [80, 19], [85, 18]]) knuck.push(rock([x, 84, z], 3.6, 1, 2));
  const legs = [rock([37, 82, 2], 8, 1.1, 2), rock([60, 82, 1], 8, 1.1, 2)];
  const body = U(0.7, torso, belly, head, shL, shR, ...armL, fistL, ...armR, fistR, ...knuck, ...legs);
  // 眼: 頭岩の割れ目
  const slit = U(0, ellipsoid([43.5, 28, 14], [2.6, 1.1, 3], "maw", 10), ellipsoid([51.5, 28, 14], [2.6, 1.1, 3], "maw", -10));
  const eyes = [ellipsoid([43.5, 28.2, 13.6], [1.8, 0.7, 1], "eye", 10), ellipsoid([51.5, 28.2, 13.6], [1.8, 0.7, 1], "eye", -10)];
  // 苔の層: 頭・肩・胴の上面に厚くかぶさる
  const mcap = (c, r, sy) => Disp(ellipsoid(c, [r[0], r[1], r[2]], "moss"), (x, y, z) => 0.9 * fbm(x * 0.35, y * 0.35, z * 0.35) + 0.6 * Math.max(0, y - c[1] - r[1] * 0.2) * sy);
  const mosses = [mcap([26, 26, 1], [9, 3, 8], 0.4), mcap([70, 26, 0], [9, 3, 8], 0.4), mcap([47, 19.5, 6], [7, 2.4, 6.5], 0.4)];
  // 根: 胴と腕に巻きつく古い根
  const roots = [
    tube([[30, 28, 6, 1.8], [36, 42, 15, 1.8], [48, 52, 18, 1.7], [60, 60, 16, 1.5], [64, 72, 10, 1.2], [60, 86, 6, 1]], "root", { seg: 3 }),
    tube([[68, 30, 6, 1.6], [62, 44, 16, 1.5], [52, 62, 13, 1.4], [44, 74, 12, 1.2], [40, 88, 8, 1]], "root", { seg: 3 }),
    tube([[24, 42, 8, 1.3], [14, 52, 12, 1.2], [22, 58, 13, 1.1], [13, 65, 16, 1]], "root", { seg: 3 }),
    tube([[72, 42, 8, 1.3], [84, 52, 10, 1.2], [74, 60, 13, 1.1], [86, 66, 13, 0.9]], "root", { seg: 3 }),
  ];
  const scene = U(0, forestFloor(48, 91, 46, 14, { n: 6, roots: 4, seed: 501 }), Sub(body, slit, 0.4), ...eyes, ...mosses, ...roots);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [47, 30, 22], r: 18, k: 0.35 }] });
  const C = new Canvas(r);
  // シダ: 肩と頭の苔から生える小さな葉 (2D)
  const F = ["#1c3a12", "#2c5418", "#40702a", "#5a8a38"];
  const frond = (x, y, ang, l, seed) => {
    const Rf = rand(seed); let px = x, py = y, a = ang;
    for (let i = 0; i < l; i++) {
      const nx = px + Math.cos(a), ny = py + Math.sin(a); C.set(nx, ny, F[2]);
      if (i > 0 && i % 2 === 1) { const w = i < l - 2 ? 2 : 1; for (let k = 1; k <= w; k++) { C.set(nx + Math.cos(a - 0.9) * k, ny + Math.sin(a - 0.9) * k, F[k > 1 ? 3 : 2]); C.set(nx + Math.cos(a + 0.9) * k, ny + Math.sin(a + 0.9) * k, F[1]); } }
      px = nx; py = ny; a += 0.08 + (Rf() - 0.5) * 0.1;
    }
  };
  frond(42, 20, -2.3, 8, 1); frond(47, 18, -1.6, 9, 2); frond(52, 20, -0.9, 7, 3);
  frond(19, 26, -2.5, 8, 4); frond(25, 24, -1.7, 7, 5); frond(71, 24, -1.4, 7, 6); frond(77, 26, -0.6, 8, 7);
  // 岩の隙間から洩れる燐光 (再生)
  const G = ["#2a5014", "#60a028", "#b0f060"];
  // 苔から垂れる糸苔
  const Rd = rand(509);
  for (let x = 2; x < 94; x++) for (let y = 20; y < 80; y++) {
    const p = C.pix[y * 96 + x], q = C.pix[(y + 1) * 96 + x];
    if (p && p.m === "moss" && q && q.m === "stone" && Rd() < 0.32) { const l = 1 + Math.floor(Rd() * 4); for (let k = 1; k <= l; k++) C.set(x, y + k, MOSS.ramp[k === l ? 2 : 4]); }
  }
  const seams = [];
  for (let y = 1; y < 95; y++) for (let x = 1; x < 95; x++) {
    const p = C.pix[y * 96 + x]; if (!p || p.m !== "stone") continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const q = C.pix[(y + dy) * 96 + x + dx]; if (q && q.m === "stone" && p.z - q.z > 3) { seams.push([x, y]); break; } }
  }
  for (const [x, y] of seams) if (y > 32 && y < 86 && fbm(x * 0.15, y * 0.15, 3) > -0.12) C.set(x, y, fbm(x * 0.3, y * 0.3, 5) > 0.1 ? G[2] : G[1]);
  spores(C, 503, 18, [4, 10, 88, 70], true);
  mist(C, 505, 3, [0, 50, 96, 40], 0.3);
  leaves(C, 507, 48, 90, 42, 20);
  return C.toArt();
}
