import { tube, sphere, ellipsoid, cone, slab, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { MOULD, MOSS, ROOT, RIM, forestFloor, mist, spores, leaves, tri } from "../forest.mjs";
export const meta = { id: "bs_griffon", key: "hd_griffon", w: 96, h: 96,
  note: "グリフォン: 黄金がかった羽毛の鷲の頭と大きく広げた翼、獅子の後ろ脚と房のある尾。後ろ脚で立ち上がり、前脚の鉤爪を振り上げて襲いかかる。爪の軌跡が幾筋も宙に残る" };
export function build() {
  const mats = {
    plume: { ramp: ramp(["#040302", "#0e0a05", "#1c1409", "#2c200e", "#3e2e14", "#54401c", "#6e5626", "#8c7034"], 8), spec: 0.5, pow: 25, specCol: "#a08a4a", dither: 0.55,
      shade: p => -0.08 * Math.pow(Math.abs(Math.sin(p.y * 1.1 + Math.abs(p.x - 48) * 0.35)), 6) },
    wing: { ramp: ramp(["#040302", "#0e0a05", "#1c1409", "#2c200e", "#3e2e14", "#54401c"], 6), dither: 0.5, spec: 0.3, pow: 20, shade: p => -0.06 * Math.pow(Math.abs(Math.sin(p.x * 0.9 + p.y * 0.9)), 8) },
    head: { ramp: ramp(["#06050a", "#1e1a14", "#3a3224", "#5a4e36", "#827252", "#a8966c"], 6), spec: 0.6, pow: 25, dither: 0.5,
      shade: p => 0.06 * fbm(p.x * 0.9, p.y * 0.9, p.z * 0.9) },
    fur: { ramp: ramp(["#050302", "#140d06", "#281a0c", "#3e2a13", "#5a3e1c"], 5), dither: 0.6, shade: p => 0.08 * fbm(p.x * 0.6, p.y * 0.6, p.z * 0.6) },
    beak: { ramp: ramp(["#0a0602", "#3a280a", "#7a5816", "#c8a040"], 4), spec: 1.2, pow: 40, specCol: "#f0dca0" },
    claw: { ramp: ramp(["#0a0a08", "#22201a", "#46423a", "#7a7466"], 4), spec: 1.2, pow: 40, specCol: "#f0dca0" },
    eye: { ramp: ["#6a3800", "#c07a10", "#ffd060"], emit: p => 0.55 + 0.45 * Math.max(0, p.nz) },
    maw: { ramp: ["#000000", "#100404", "#1e0808"], amb: 0.2, dif: 0.25, noRim: true },
    mould: MOULD, moss: MOSS, root: ROOT,
  };
  // 翼: 前縁 (肩→手首→翼端) に沿って、雨覆い・次列風切・初列風切を重ねる
  const feather = (bx, by, ang, L, w, z, mat) => {
    const c = Math.cos(ang), sn = Math.sin(ang), nx = -sn, ny = c;
    const P = (u, v) => [bx + c * u + nx * v, by + sn * u + ny * v];
    return slab([P(0, -w * 0.6), P(L * 0.75, -w), P(L, -w * 0.3), P(L * 1.02, 0.4), P(L * 0.8, w * 0.7), P(0, w * 0.6)], z, 0.8, mat, 0.45);
  };
  const wing = (s) => {
    const X = d => 48 + s * d;
    const parts = [];
    const sh = [10, 40], wr = [24, 25], tp = [42, 12];
    parts.push(tube([[X(sh[0]), sh[1], -6, 3.6], [X(wr[0]), wr[1], -8, 2.6], [X(tp[0]), tp[1], -9, 1.4]], "wing", { seg: 3 }));
    // 初列風切: 手首→翼端から外へ扇状に長く開く (翼端ほど上向き)
    for (let i = 0; i < 7; i++) {
      const t = i / 6, bx = wr[0] + (tp[0] - wr[0]) * t, by = wr[1] + (tp[1] - wr[1]) * t;
      const a = (-35 + (1 - t) * 95) * Math.PI / 180, ang = s > 0 ? a : Math.PI - a;
      parts.push(feather(X(bx), by, ang, 16 + t * 6, 2.3, -13 + i * 0.5, "wing"));
    }
    // 次列風切: 肩→手首から下へ
    for (let i = 0; i < 5; i++) {
      const t = i / 4, bx = sh[0] + (wr[0] - sh[0]) * (0.2 + t * 0.8), by = sh[1] + (wr[1] - sh[1]) * (0.2 + t * 0.8);
      const ang = Math.PI / 2 - s * (0.15 + t * 0.25);
      parts.push(feather(X(bx), by, ang, 14 + t * 3, 2.4, -11.5 + i * 0.3, "wing"));
    }
    // 雨覆い: 前縁の下を覆う羽毛の板と、うろこ状の小羽
    parts.push(Disp(slab([[X(sh[0]), sh[1] + 4], [X(sh[0]), sh[1] - 3], [X(wr[0]), wr[1] - 3], [X(tp[0]), tp[1] - 2], [X(tp[0] - 4), tp[1] + 7], [X(wr[0] + 4), wr[1] + 9], [X(sh[0] + 8), sh[1] + 8]], -9, 1.6, "plume", 0.8),
      (x, y, z) => -0.5 * Math.pow(Math.abs(Math.sin(x * 0.7 * s + y * 0.9)), 4)));
    return parts;
  };
  // 胴: 鷲の胸 (羽毛) が左上へ立ち上がり、獅子の腰は右下へ。後ろ脚は獣の逆くの字で踏ん張る
  const chest = ellipsoid([46, 50, 4], [11, 13, 10], "plume", 15);
  const ruff = Disp(ellipsoid([46, 39, 6], [10, 6, 8], "plume", -5), (x, y, z) => 0.6 * Math.abs(Math.sin(x * 1.3 + y * 0.4)));
  const hips = ellipsoid([58, 68, -4], [12, 10, 9], "fur", 25);
  const thighs = [ellipsoid([52, 74, 4], [6.5, 8.5, 6.5], "fur", 25), ellipsoid([68, 72, -6], [6.5, 8.5, 6.5], "fur", 25)];
  const shins = [tube([[48, 80, 7, 3.8], [53, 85, 8, 2.6], [47, 89, 10, 2.6]], "fur", { seg: 3 }), tube([[66, 79, -4, 3.6], [72, 85, -4, 2.4], [64, 89, -2, 2.4]], "fur", { seg: 3 })];
  const paws = [ellipsoid([45, 89, 11], [4.6, 2.4, 4], "fur"), ellipsoid([62, 89, -1], [4.4, 2.4, 3.8], "fur")];
  const tail = tube([[68, 70, -8, 2.6], [80, 80, -6, 2], [88, 74, -2, 1.6], [90, 62, 2, 1.4]], "fur", { seg: 4 });
  const tuft = Disp(ellipsoid([90, 58, 3], [2.8, 4.6, 2.6], "head", -10), (x, y, z) => 0.5 * Math.abs(Math.sin(x * 2 + y)));
  // 頭: 斜め左を向いた鷲の頭、鉤形のくちばしを開いて叫ぶ
  const head = ellipsoid([46, 28, 10], [8, 8.5, 8], "head", -10);
  const crestF = [cone([50, 24, 6], [58, 20, 2], 2.4, 0.4, "head"), cone([51, 28, 5], [59, 27, 1], 2.2, 0.4, "head"), cone([49, 22, 7], [55, 15, 4], 2, 0.4, "head")];
  const beakU = U(0.6, cone([41, 29, 15], [32, 32, 18], 3.6, 1.8, "beak"), cone([32, 32, 18], [30, 37, 18], 1.8, 0.4, "beak"));
  const beakL = cone([41, 35, 14], [34, 37, 16], 2.4, 0.8, "beak");
  const brow = ellipsoid([42, 23.5, 15], [4.6, 1.8, 2.6], "head", -15);
  const eyeS = ellipsoid([42.5, 26, 16.5], [2.4, 1.7, 2], "maw");
  const eye = sphere([42.6, 26.1, 16.3], 1.5, "eye");
  // 前脚: 羽毛の太腿 → 黄色い鱗の脚、鉤爪を大きく開いて振り上げる
  const talon = (base, dir, z) => {
    const out = [];
    for (let i = 0; i < 4; i++) {
      const a = (dir + (i - 1.5) * 30) * Math.PI / 180;
      const m = [base[0] + Math.cos(a) * 3.4, base[1] + Math.sin(a) * 3.4, z + 1];
      const e = [m[0] + Math.cos(a + 0.5) * 3, m[1] + Math.sin(a + 0.5) * 3, z + 1.6];
      out.push(tube([[...base, z, 1.6], [...m, 1.25], [...e, 1]], "beak", { seg: 2 }), cone([...e], [e[0] + Math.cos(a + 1.3) * 3.6, e[1] + Math.sin(a + 1.3) * 3.6, z + 2], 1.1, 0.2, "claw"));
    }
    return out;
  };
  const armL = U(1, tube([[38, 50, 10, 5.5], [30, 50, 15, 4.6]], "plume"), tube([[30, 50, 15, 2.6], [22, 50, 19, 2]], "beak"));
  const armR = U(1, tube([[54, 50, 9, 5.5], [62, 48, 14, 4.6]], "plume"), tube([[62, 48, 14, 2.6], [68, 42, 17, 2]], "beak"));
  const tL = talon([21, 50], -150, 19), tR = talon([69, 41], -55, 17);
  const body = Disp(U(2, chest, ruff, hips, ...thighs, ...shins, ...paws, tail, head, ...crestF, brow), (x, y, z) => 0.15 * fbm(x * 0.8, y * 0.8, z * 0.8));
  const scene = U(0, forestFloor(54, 91, 38, 14, { n: 5, roots: 2, seed: 591 }), ...wing(-1), ...wing(1), Sub(body, eyeS, 0.3), eye, tuft, beakU, beakL, armL, armR, ...tL, ...tR);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  // くちばしの奥と舌
  C.set(36, 34, "#000000"); C.set(37, 34, "#000000"); C.set(38, 34, "#100404"); C.set(36, 35, "#5a1e14");
  // 爪の軌跡: 振り下ろす鉤爪から三筋の弧 (連撃)
  const S = ["#5a4a24", "#a08a4a", "#f0dca0"];
  const arc = (cx, cy, r, a0, a1, w) => { for (let a = a0; a <= a1; a += 0.02) { const t = (a - a0) / (a1 - a0), x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r; if (!C.get(Math.round(x), Math.round(y))) C.set(x, y, S[t < 0.25 ? 0 : t < 0.7 ? 1 : 2]); } };
  for (let k = 0; k < 3; k++) arc(34 + k * 3.2, 44, 20, 1.95, 2.8, 1);
  for (let k = 0; k < 3; k++) arc(58 - k * 3.2, 38, 20, 0.4, 1.25, 1);
  mist(C, 595, 2, [0, 60, 96, 24], 0.25);
  leaves(C, 597, 54, 90, 34, 16);
  return C.toArt();
}
