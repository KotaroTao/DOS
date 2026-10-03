import { tube, sphere, ellipsoid, cone, slab, U, Sub, Disp, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { RIM } from "../fort.mjs";
export const meta = { id: "bs_banshee", key: "hd_banshee", w: 96, h: 96,
  note: "バンシー: 死を報せる泣き女の霊。逆立って天へ流れる長い髪、両手で顔を掻きむしり、裂けるほど開いた口から葬送の絶叫を放つ。裂けた埋葬衣の裾は宙にほどけ、絶叫の波が外へ広がる" };
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
// 上半身をまとめて下へずらす (葉の距離関数と Disp/Paint の関数を平行移動)
function shiftY(n, D) {
  if (n.leaf) { const f = n.f, b = n.bound; return { leaf: true, f: (x, y, z) => f(x, y - D, z), mat: n.mat, bound: [b[0], b[1] + D, b[2], b[3]] }; }
  const o = { ...n, kids: n.kids.map(k => shiftY(k, D)) };
  if (n.fn) { const fn = n.fn; o.fn = (x, y, z, m) => fn(x, y - D, z, m); }
  return o;
}
const DY = 6;
function claw(base, deg, len, mat, curl = 0.35, r = 0.8) {
  const a = deg * Math.PI / 180, b = a + curl, c = b + curl;
  const p1 = [base[0] + Math.cos(a) * len * 0.45, base[1] + Math.sin(a) * len * 0.45, base[2] + 0.8];
  const p2 = [p1[0] + Math.cos(b) * len * 0.33, p1[1] + Math.sin(b) * len * 0.33, base[2] + 1.4];
  const p3 = [p2[0] + Math.cos(c) * len * 0.22, p2[1] + Math.sin(c) * len * 0.22, base[2] + 1.6];
  return tube([[...base, r * 1.1], [...p1, r], [...p2, r * 0.8], [...p3, r * 0.4]], mat, { seg: 2 });
}
export function build() {
  const mats = {
    skin: { ramp: ramp(["#07060a", "#16131c", "#28232f", "#3c3646", "#544c5e", "#6e6678", "#8c8494", "#aaa2b0"], 8), spec: 0.4, pow: 20, dither: 0.45, amb: 0.26 },
    hair: { ramp: ramp(["#040306", "#0c0912", "#16111e", "#221a2e", "#302640", "#423654", "#5a4e6c", "#786e8a"], 8), spec: 1.2, pow: 30, specCol: "#a49ab6", dither: 0.5, amb: 0.18,
      shade: p => 0.12 * Math.sin(p.x * 1.5 + p.y * 0.2) },
    dress: { ramp: ramp(["#060607", "#0f0e12", "#1a191d", "#27252b", "#35333a", "#46434b", "#5a575e", "#716d74"], 8), dither: 0.65, amb: 0.24,
      shade: p => 0.14 * Math.sin((p.x - 48) * 0.7 + p.y * 0.05) + 0.06 * fbm(p.x * 0.4, p.y * 0.4) },
    hole: { ramp: ["#000000", "#000000", "#030205"], amb: 0, dif: 0.1, noRim: true },
    thru: { ramp: ["#000000"], noRim: true },
  };
  // 顔: 細い頬、裂けた口、窪んだ眼
  const skull = U(1.2, ellipsoid([48, 29, 3], [6.2, 7.6, 5.8], "skin"), ellipsoid([48, 36, 3.6], [4.2, 3.6, 4.4], "skin"));
  const holes = U(0, ellipsoid([45.4, 27.4, 7.6], [1.6, 1.3, 2], "hole", 20), ellipsoid([50.6, 27.4, 7.6], [1.6, 1.3, 2], "hole", -20), ellipsoid([48, 35.6, 7.4], [2.4, 4.2, 3.4], "hole"));
  const face = Sub(skull, holes, 0.5);
  // 逆立って天へ流れる髪: 頭頂と側頭から上へうねる房
  const strands = [];
  const R = rand(451);
  for (let i = 0; i < 26; i++) {
    const s = (i - 12.5) / 12.5;
    const bx = 48 + s * 6.5, by = 25 - (1 - Math.abs(s)) * 3 + Math.abs(s) * 4, bz = -1 - R() * 4;
    const tx = 48 + s * 32 + (R() - 0.5) * 8, ty = -DY + Math.abs(s) * 8 + R() * 4;
    const ph = R() * 6, amp = 2 + R() * 2.5;
    const pts = [];
    for (let k = 0; k <= 6; k++) {
      const t = k / 6;
      pts.push([bx + (tx - bx) * Math.pow(t, 1.6) + Math.sin(t * 7 + ph) * amp * 1.4 * t, by + (ty - by) * t, bz - t * 3 + Math.cos(t * 4 + ph) * 2, 3.0 - t * 2.0]);
    }
    strands.push(tube(pts, "hair", { seg: 3 }));
  }
  const crown = ellipsoid([48, 25, 0], [7, 6, 6], "hair");
  // 腕: 肘を張り、両手で顔を掻きむしる
  const armL = tube([[40, 44, 0, 2.8], [29, 37, 3, 2.2], [39, 28, 7, 1.6]], "skin");
  const armR = tube([[56, 44, 0, 2.8], [67, 37, 3, 2.2], [57, 28, 7, 1.6]], "skin");
  const handL = U(0.6, ellipsoid([40, 27.6, 7.5], [2, 2.4, 1.8], "skin"), claw([41, 26, 8], -60, 7, "skin", 0.4), claw([41.5, 27.5, 8.2], -30, 7.5, "skin", 0.45), claw([41.5, 29.5, 8], 0, 6.5, "skin", 0.5), claw([40.5, 31, 7.6], 30, 5.5, "skin", 0.5));
  const handR = U(0.6, ellipsoid([56, 27.6, 7.5], [2, 2.4, 1.8], "skin"), claw([55, 26, 8], -120, 7, "skin", -0.4), claw([54.5, 27.5, 8.2], -150, 7.5, "skin", -0.45), claw([54.5, 29.5, 8], 180, 6.5, "skin", -0.5), claw([55.5, 31, 7.6], 150, 5.5, "skin", -0.5));
  // 埋葬衣: 細い胴から裾が広がり、裂けた長い布片が垂れる
  const torso = ellipsoid([48, 49, 0], [8.4, 9, 5.6], "dress");
  const neck = tube([[48, 38, 1, 2.2], [48, 42, 0, 2.6]], "skin");
  const skirt = Disp(cone([48, 58, 0], [49, 84, -1], 8, 16, "dress"), (x, y, z) => 1.2 * Math.sin(Math.atan2(z + 1, x - 48) * 7 + y * 0.12) * Math.max(0, (y - 62) / 24));
  const rags = [];
  for (const [x0, x1, y1, w] of [[37, 28, 92, 2.4], [43, 40, 95, 2], [53, 57, 94, 2.2], [60, 70, 90, 2.4], [48, 48, 95, 1.6]]) rags.push(Disp(slab([[x0 - w, 72], [x0 + w, 72], [x1 + w * 0.5, y1 - 3], [x1, y1], [x1 - w * 0.6, y1 - 4]], 3, 1.2, "dress", 0.5), (x, y, z) => 0.6 * Math.sin(y * 0.6 + x)));
  const tears = U(0, ...[[40, 82, 1.3, 9], [46, 84, 1.1, 7], [56, 83, 1.4, 9], [62, 84, 1.2, 6], [51, 86, 1, 5]].map(([x, y, w, h]) => ellipsoid([x, y, 14], [w, h, 20], "thru", (x - 48) * 1.5)));
  const collar = Disp(ellipsoid([48, 42.5, 1], [6, 2.6, 4.6], "dress"), (x, y, z) => 0.4 * Math.sin(x * 2));
  const upper = shiftY(U(0, U(1.0, ...strands, crown), face, neck, armL, armR, handL, handR), DY);
  // 埋葬の帯紐: 腰に巻いて垂れる
  const sash = U(0, tube([[40, 60, 5.5, 1], [44, 61.5, 8.4, 1.1], [48, 62, 9.2, 1.1], [52, 61.5, 8.4, 1.1], [56, 60, 5.5, 1]], "hair"), tube([[49, 62, 9.4, 0.9], [50, 68, 10.6, 0.8], [49, 75, 12, 0.7]], "hair"), tube([[50.5, 62, 9.4, 0.9], [53, 67, 10.6, 0.8], [54, 72, 11.6, 0.6]], "hair"));
  const scene = U(0, upper, sash, Sub(U(1.4, shiftY(torso, DY), skirt, shiftY(collar, DY)), tears), ...rags);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, rimTh: 0.1, lights: [{ p: [48, 46, 20], r: 18, k: 0.25 }] });
  const C = new Canvas(r);
  // 裾と髪の先は宙にほどける
  for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) {
    const p = C.pix[y * 96 + x]; if (!p) continue;
    if (p.m === "thru") { C.set(x, y, null); continue; }
    let a = 2;
    if (p.m === "dress") a = 1.2 - Math.max(0, (y - 80) / 16) * 1.2 + 0.6 * fbm(x * 0.3, y * 0.08, 4);
    if (p.m === "hair") a = 1.3 - Math.max(0, (4 - y) / 6) - Math.max(0, (Math.abs(x - 48) - 30) / 10) + 0.5 * fbm(x * 0.2, y * 0.2, 6);
    if (a < (BAYER[y & 3][x & 3] + 0.5) / 16) C.set(x, y, null);
  }
  // 眼窩の奥の小さな白い光
  C.set(45, 27 + DY, "#d0c8dc"); C.set(50, 27 + DY, "#d0c8dc");
  // 絶叫の波: 口から左右へ広がる弧
  const Wv = ["#cfc4e0", "#9a8eb4", "#6a5f86", "#463e5c"];
  [[16, 0], [22, 1], [29, 2], [37, 3]].forEach(([rad, k]) => {
    for (const [a0, a1] of [[140, 220], [-40, 40]]) for (let a = a0; a <= a1; a += 1) {
      const t = a * Math.PI / 180, x = 48 + Math.cos(t) * rad, y = 36 + DY + Math.sin(t) * rad * 0.9;
      if (((a * 5 + k * 17 + 400) % 29) < 3 + k * 3) continue;
      if (!C.get(Math.round(x), Math.round(y))) C.set(x, y, Wv[k]);
    }
  });
  return C.toArt();
}
