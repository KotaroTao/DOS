import { sphere, ellipsoid, cone, cyl, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { FLAG, STONE, WOOD, RIM, arrowShafts, ash, grit, tri } from "../fort.mjs";
export const meta = { id: "bs_siegeballista", key: "hd_siegeballista", w: 96, h: 96,
  note: "自走バリスタ: 守り手の絶えた砦で己の意思で動き出した大弩。鉄の帯を巻いた樫の車台に四つの車輪、張り詰めた弦と後ろの巻き上げ機、つがえた鉄の大矢が斜め手前の獲物を狙う。乗り手のいない照準器の輪の奥に、熾火の眼がひとつ灯る" };
// ---- 斜め見下ろし (3/4 視点) のための自前の部品 ----
const V = {
  add: (a, b) => a.map((v, i) => v + b[i]), sub: (a, b) => a.map((v, i) => v - b[i]), mul: (a, k) => a.map(v => v * k),
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], len: a => Math.hypot(a[0], a[1], a[2]),
  norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return a.map(v => v / l); },
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
};
// 見下ろしの傾き: 奥 (z-) ほど画面の上へ、上面が手前を向く
const PITCH = 26 * Math.PI / 180, CY = 66;
const K = 1.14, KX = 47, KY = 52;
const T0 = ([x, y, z]) => [x, CY - 5 + (y - CY) * Math.cos(PITCH) + z * Math.sin(PITCH), -(y - CY) * Math.sin(PITCH) + z * Math.cos(PITCH)];
const T = p => { const q = T0(p); return [KX + (q[0] - KX) * K, KY + (q[1] - KY) * K, q[2] * K]; };
const TD = ([x, y, z]) => [x, y * Math.cos(PITCH) + z * Math.sin(PITCH), -y * Math.sin(PITCH) + z * Math.cos(PITCH)];
// 任意の向きの角材 (中心, 軸 u/v/w, 半径)
function obox(c, u, v, w, [a, b, d], mat, round = 0.4) {
  a *= K; b *= K; d *= K; round *= K;
  const C0 = T(c), U0 = V.norm(TD(u)), V0 = V.norm(TD(v)), W0 = V.norm(TD(w));
  return { leaf: true, mat, bound: [...C0, Math.hypot(a, b, d) + 1], f: (x, y, z) => {
    const p = [x - C0[0], y - C0[1], z - C0[2]];
    const qx = Math.abs(V.dot(p, U0)) - a + round, qy = Math.abs(V.dot(p, V0)) - b + round, qz = Math.abs(V.dot(p, W0)) - d + round;
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - round;
  } };
}
// 2点の間の角材 (幅の向き side を与える)
function beam(p0, p1, side, hw, hh, mat, round = 0.4) {
  const u = V.norm(V.sub(p1, p0)), s = V.norm(side), up = V.norm(V.cross(u, s));
  return obox(V.mul(V.add(p0, p1), 0.5), u, s, up, [V.len(V.sub(p1, p0)) / 2, hw, hh], mat, round);
}
// 任意の軸の輪
function ring(c, axis, R, r, mat) {
  R *= K; r *= K;
  const C0 = T(c), A = V.norm(TD(axis));
  return { leaf: true, mat, bound: [...C0, R + r + 1], f: (x, y, z) => {
    const p = [x - C0[0], y - C0[1], z - C0[2]], h = V.dot(p, A);
    const q = Math.hypot(p[0] - A[0] * h, p[1] - A[1] * h, p[2] - A[2] * h) - R;
    return Math.hypot(q, h) - r;
  } };
}
const tcyl = (a, b, r, mat, round = 0) => cyl(T(a), T(b), r * K, mat, round * K);
const tcone = (a, b, ra, rb, mat) => cone(T(a), T(b), ra * K, rb * K, mat);
const tsph = (c, r, mat) => sphere(T(c), r * K, mat);
export function build() {
  const mats = {
    oak: { ramp: ramp(["#030201", "#0b0705", "#160e08", "#22170d", "#302012", "#402b19", "#523a22", "#684a2c", "#80603a"], 9), dither: 0.55, spec: 0.3, pow: 18,
      shade: p => 0.12 * Math.sin((p.x + p.z) * 0.9 + 3 * fbm(p.x * 0.2, p.y * 0.2, p.z * 0.2)) + 0.06 * fbm(p.x * 0.7, p.y * 0.7, p.z * 0.7) },
    iron: { ramp: ramp(["#020203", "#08090b", "#111317", "#1b1e24", "#272b33", "#363b45", "#4a505c", "#646b78"], 8), spec: 1.3, pow: 38, specCol: "#a4acb8", dither: 0.45,
      shade: p => 0.1 * fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5) },
    rust: { ramp: ramp(["#040201", "#120804", "#22100a", "#341a0e", "#4a2812", "#603618"], 6), dither: 0.65, shade: p => 0.1 * fbm(p.x * 0.8, p.y * 0.8) },
    rope: { ramp: ramp(["#040302", "#120e09", "#221a10", "#342818", "#483822", "#5e4a2e"], 6), dither: 0.5, shade: p => 0.18 * Math.sin(p.x * 2.6 + p.y * 2.6) },
    ember: { ramp: ["#3a0c02", "#8a2a06", "#e06414", "#ffb048", "#fff0b8"], emit: p => 0.5 + 0.5 * Math.max(0, p.nz) },
    flag: FLAG, stone: STONE, wood: WOOD,
  };
  // 向き: 前 F は左手前、横 L は右手前。上は -y
  const F = V.norm([-0.8, 0, 0.6]), L = V.norm([0.6, 0, 0.8]), UP = [0, -1, 0];
  const O = [54, 0, -4];
  const at = (f, l, y) => [O[0] + F[0] * f + L[0] * l, y, O[2] + F[2] * f + L[2] * l];
  const parts = [];
  // 車台: 二本の側桁 + 横木
  const GY = 92; // 地面
  const AY = 82; // 車軸の高さ
  for (const s of [-11, 11]) parts.push(beam(at(-27, s, 76), at(26, s, 76), UP, 3, 2.6, "oak", 0.6));
  for (const f of [-22, -3, 20]) parts.push(beam(at(f, -14, 75), at(f, 14, 75), UP, 2.6, 2.3, "oak", 0.6));
  // 前の衝角: 鉄張りの横木に突き出す釘
  parts.push(beam(at(27, -15, 76), at(27, 15, 76), UP, 2.4, 3.2, "iron", 0.6));
  for (const l of [-10, -3.5, 3.5, 10]) parts.push(tcone(at(28, l, 76), at(34, l, 77), 1.5, 0.15, "iron"));
  // 側桁の鉄帯
  for (const s of [-11, 11]) for (const f of [-16, 10]) parts.push(beam(at(f - 1, s, 76), at(f + 1, s, 76), UP, 3.5, 3.1, "iron", 0.3));
  // 車輪 4 つ (車軸は横向き) — 太い輪 + 鉄の輪金 + 輻
  for (const f of [-18, 16]) for (const s of [-15.5, 15.5]) {
    const c = at(f, s, AY);
    parts.push(ring(c, L, 8.2, 2, "oak"), ring(V.add(c, V.mul(L, Math.sign(s) * 0.8)), L, 8.8, 1.3, "iron"));
    parts.push(tcyl(V.add(c, V.mul(L, -1.6)), V.add(c, V.mul(L, 1.6)), 2.2, "iron", 0.4));
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + 0.3; const dir = V.add(V.mul(F, Math.cos(a)), V.mul(UP, Math.sin(a)));
      parts.push(beam(c, V.add(c, V.mul(dir, 7.6)), L, 0.9, 0.8, "oak", 0.2)); }
  }
  // 車軸
  for (const f of [-18, 16]) parts.push(tcyl(at(f, -16, AY), at(f, 16, AY), 1.4, "iron"));
  // 旋回台: 太い柱と鉄の受け
  parts.push(tcyl(at(0, 0, 76), at(0, 0, 45), 4.4, "oak", 1), ring(at(0, 0, 70), UP, 4.8, 1.1, "iron"), ring(at(0, 0, 56), UP, 4.8, 1.1, "iron"), tcyl(at(0, 0, 46), at(0, 0, 43), 6.6, "iron", 0.8));
  // 柱を支える斜めの方杖
  for (const [f, l] of [[-12, 0], [10, 0], [0, -10], [0, 10]]) parts.push(beam(at(f, l, 74), at(f * 0.25, l * 0.25, 60), V.norm(V.cross(UP, V.norm(V.add(V.mul(F, f), V.mul(L, l))))), 1.4, 1.2, "oak", 0.4));
  // 弩床: 前後に長い角材 (照準のため前が少し下がる)
  const SY = 40, dip = 0.12;
  const sy = f => SY + f * dip;
  parts.push(beam(at(-30, 0, sy(-30)), at(24, 0, sy(24)), L, 3.6, 2.6, "oak", 0.6));
  for (const f of [-24, -8, 10]) parts.push(beam(at(f - 0.9, 0, sy(f)), at(f + 0.9, 0, sy(f)), L, 4.2, 3.2, "iron", 0.3));
  // 弓腕: 前端から左右へ、先が後ろへ反る (中央が太い)
  const arm = s => [[...at(17, 0, sy(17) - 1), 3.6], [...at(16, s * 10, sy(16) - 1.5), 3.1], [...at(13, s * 20, sy(13) - 2.5), 2.4], [...at(7, s * 28, sy(7) - 3.5), 1.6], [...at(4, s * 31, sy(4) - 3), 1.1]];
  const armTube = pts => pts.slice(0, -1).map((p, i) => tcone(p.slice(0, 3), pts[i + 1].slice(0, 3), p[3], pts[i + 1][3], "oak"));
  parts.push(...armTube(arm(1)), ...armTube(arm(-1)));
  for (const s of [-1, 1]) for (const t of [9, 17]) { const p = at(16 - (t > 10 ? 1.8 : 0), s * t, sy(15) - 1.6 - (t > 10 ? 0.6 : 0)); parts.push(ring(p, V.norm(V.add(L, V.mul(F, -0.2 * s))), t > 10 ? 2.6 : 3.1, 0.8, "iron")); }
  // 弓腕の付け根の鉄の箱 (捻り束)
  parts.push(beam(at(15, -6, sy(15) - 1), at(15, 6, sy(15) - 1), F, 3.8, 4, "iron", 0.8));
  // 弦を引き絞った留め金 (後ろ)
  const nock = at(-17, 0, sy(-17) - 3);
  parts.push(tsph(nock, 1.6, "iron"));
  // 巻き上げ機: 後端の横向きの胴 + ハンドル
  const wc = at(-27, 0, sy(-27) - 3.8);
  parts.push(tcyl(V.add(wc, V.mul(L, -7)), V.add(wc, V.mul(L, 7)), 3, "rope", 0.6));
  for (const s of [-1, 1]) {
    const e = V.add(wc, V.mul(L, s * 7.6));
    parts.push(ring(e, L, 3.6, 0.8, "iron"));
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.6 * s; const dir = V.add(V.mul(F, Math.cos(a)), V.mul(UP, Math.sin(a))); parts.push(beam(e, V.add(e, V.mul(dir, 6.2)), L, 0.7, 0.7, "iron", 0.3)); }
  }
  // 照準器: 弩床の中ほどに立つ輪。輪の奥に熾火の眼
  const sight = at(-4, 0, sy(-4) - 11);
  parts.push(beam(at(-4, 0, sy(-4) - 2), V.add(sight, [0, 3.8, 0]), F, 0.9, 0.9, "iron", 0.3), ring(sight, F, 3.8, 1, "iron"), tsph(sight, 2.5, "ember"));
  // 鉄の大矢: 留め金から前へ大きく突き出す
  const BY = f => sy(f) - 4;
  const b0 = at(-16, 0, BY(-16)), b1 = at(36, 0, BY(36));
  parts.push(tcyl(b0, b1, 1.3, "iron", 0.3));
  const tip = at(48, 0, BY(48));
  parts.push(tcone(b1, tip, 3, 0.2, "iron"));
  // 鏃のかえし (板)
  for (const s of [-1, 1]) parts.push(beam(at(35, 0, BY(35)), at(39, s * 4.6, BY(39)), UP, 1, 0.6, "iron", 0.25));
  // 床: 斜めに見下ろした石畳と崩れた石
  const R = rand(511);
  const bed = Disp(ellipsoid(T([48, GY + 2, 0]), [44, 3.2, 17], "flag", 0, -PITCH * 180 / Math.PI), (x, y, z) => 0.25 * fbm(x * 0.3, z * 0.3) + (vnoise(x * 0.5, z * 0.5) > 0.55 ? 0.5 : 0));
  const blocks = [];
  for (const [f, l, s] of [[30, 24, 3.6], [-30, -20, 3.2], [-8, 30, 2.6], [36, -22, 2.4]]) blocks.push(Disp(beam(at(f, l, GY - s * 0.6), at(f + s * 1.6, l + R() * 2, GY - s * 0.6), UP, s * 0.9, s * 0.6, "stone", 0.5), (X, Y, Z) => 0.3 * fbm(X * 0.7, Y * 0.7, Z * 0.7)));
  const rust = (x, y, z, m) => (m === "iron" && fbm(x * 0.35 + 3, y * 0.35, z * 0.35) > 0.3) ? "rust" : m;
  const scene = U(0, bed, ...blocks, ...arrowShafts([[12, 90, 10, -3, -8, 8]]), Paint(U(0, ...parts), rust));
  const S = T(sight);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [S[0], S[1], S[2] + 6], r: 16, k: 0.6 }] });
  const C = new Canvas(r);
  // 張り詰めた弦: 弓腕の先から留め金へ (2D)
  const scr = p => { const q = T(p); return [q[0], q[1]]; };
  const N = scr(nock);
  for (const s of [-1, 1]) { const t = scr(at(4, s * 31, sy(4) - 3)); C.line(t[0], t[1], N[0], N[1], "#8a7a5a"); C.line(t[0], t[1] + 1, N[0], N[1] + 1, "#1a140c"); }
  // 矢羽 (大矢の後ろ)
  const fb = scr(at(-12, 0, BY(-12)));
  tri(C, [fb[0] + 2, fb[1] - 1], [fb[0] + 7, fb[1] - 5], [fb[0] + 6, fb[1] + 1], "#3a3024");
  tri(C, [fb[0] + 2, fb[1] + 1], [fb[0] + 7, fb[1] + 4], [fb[0] + 5, fb[1] + 2], "#241c14");
  // 照準器の眼の芯
  C.set(Math.round(S[0]) - 1, Math.round(S[1]) - 1, "#fff0b8");
  grit(C, 513, 48, 88, 40, 20);
  ash(C, 517, 7, [2, 2, 92, 40], true);
  ash(C, 519, 12);
  return C.toArt();
}
