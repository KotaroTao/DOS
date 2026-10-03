import { tube, sphere, ellipsoid, cone, slab, U, Sub, Disp, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { RIM } from "../fort.mjs";
export const meta = { id: "d03_ghost", key: "hd_wanderghost", w: 96, h: 96,
  note: "さまよう亡霊: 骸さえ見つからなかった者の魂。透けた屍衣をまとい前へ身を乗り出して宙を漂い、虚ろな眼窩と口の空いた顔で、冷たく長い指を伸ばして生者の熱を探る。指先へ小さな魂の光が吸い寄せられていく" };
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
// 骨ばった長い指: 手の甲から指先まで、関節で少し曲げる
function finger(base, deg, len, mat, droop = 0.2, r = 0.95) {
  const a = deg * Math.PI / 180, b = a + droop, c = b + droop;
  const p1 = [base[0] + Math.cos(a) * len * 0.42, base[1] + Math.sin(a) * len * 0.42, base[2] + 1];
  const p2 = [p1[0] + Math.cos(b) * len * 0.33, p1[1] + Math.sin(b) * len * 0.33, base[2] + 1.6];
  const p3 = [p2[0] + Math.cos(c) * len * 0.25, p2[1] + Math.sin(c) * len * 0.25, base[2] + 2];
  return tube([[...base, r * 1.1], [...p1, r], [...p2, r * 0.8], [...p3, r * 0.45]], mat, { seg: 2 });
}
export function build() {
  const mats = {
    shroud: { ramp: ramp(["#05070a", "#0b1015", "#131a22", "#1c2731", "#283642", "#364756", "#48596a", "#5f7282", "#7c909e"], 9), dither: 0.75, amb: 0.3, dif: 0.8,
      shade: p => 0.13 * Math.sin(p.x * 0.55 - p.y * 0.4) + 0.07 * fbm(p.x * 0.3, p.y * 0.3) },
    flesh: { ramp: ramp(["#06080a", "#121820", "#202a34", "#323f4a", "#485662", "#62707a", "#808c94", "#a2acb0"], 8), spec: 0.5, pow: 22, dither: 0.45, amb: 0.3 },
    hole: { ramp: ["#000000", "#000000", "#020305"], amb: 0, dif: 0.1, noRim: true },
  };
  // 前へ傾いた胴と頭巾をかぶった頭
  const head = ellipsoid([52, 22, 3], [9, 10, 8], "shroud", -14);
  const torso = ellipsoid([60, 44, -1], [14, 15, 9], "shroud", -24);
  // 屍衣の裾: 右下へうねって細る尾
  const tail = [];
  for (let i = 0; i < 12; i++) { const t = i / 11; tail.push(sphere([62 + t * 26 + Math.sin(t * 6) * 4, 52 + t * 40 - t * t * 6, -2 + Math.cos(t * 4) * 2], 13 * Math.pow(1 - t, 1.1) + 1.5, "shroud")); }
  const body = Disp(U(3, head, torso, ...tail), (x, y, z) => 0.8 * Math.sin(x * 0.45 + y * 0.22) * Math.max(0, (y - 40) / 40) + 0.3 * fbm(x * 0.2, y * 0.2, z * 0.2));
  // 頭巾の開口から覗く窪んだ顔: 縦に垂れた眼窩と、開いたままの口
  const hoodHole = ellipsoid([47.5, 24.5, 10], [5.6, 7.6, 5], "hole", -14);
  const face = ellipsoid([48.5, 24.5, 4.5], [5, 6.8, 5.4], "flesh", -14);
  const hollows = U(0, ellipsoid([45.8, 22.4, 9.4], [1.8, 2.8, 2.4], "hole", -4), ellipsoid([51.2, 21.8, 9.2], [1.7, 2.6, 2.4], "hole", -4), ellipsoid([48.4, 29.4, 9.4], [2.2, 0.7, 2.4], "hole", -24));
  const visage = Sub(face, hollows, 0.5);
  // 腕: 骨ばった前腕と、垂れ下がる屍衣の袖
  const armA = tube([[50, 36, 4, 3.8], [36, 38, 8, 2.8], [23, 37, 12, 1.8]], "flesh");
  const armB = tube([[60, 40, 2, 3.6], [44, 50, 8, 2.8], [29, 54, 11, 1.7]], "flesh");
  const sleeveA = Disp(slab([[53, 32], [40, 34], [33, 37], [29, 50], [34, 47], [37, 55], [41, 46], [45, 52], [53, 42]], 7, 1.8, "shroud", 0.8), (x, y, z) => 0.5 * Math.sin(x * 1.1 + y * 0.3));
  const sleeveB = Disp(slab([[62, 37], [48, 45], [40, 50], [36, 64], [41, 59], [44, 68], [48, 58], [53, 64], [62, 49]], 5, 1.8, "shroud", 0.8), (x, y, z) => 0.5 * Math.sin(x * 1.1 + y * 0.3));
  const handA = U(0.7, ellipsoid([22, 37.5, 12], [2.6, 2, 2], "flesh"), finger([20.5, 36, 12.5], 196, 13, "flesh", 0.12), finger([20, 37.5, 13], 182, 15, "flesh", 0.14), finger([20.5, 39, 12.8], 168, 13, "flesh", 0.16), finger([21.5, 40, 12], 150, 9, "flesh", 0.2, 0.85));
  const handB = U(0.7, ellipsoid([28, 54.5, 11], [2.6, 2, 2], "flesh"), finger([26.5, 53, 11.5], 186, 12, "flesh", 0.15), finger([26, 54.5, 12], 172, 14, "flesh", 0.18), finger([26.5, 56, 11.8], 158, 12, "flesh", 0.2), finger([27.5, 57, 11], 140, 8, "flesh", 0.25, 0.85));
  const scene = U(0, Sub(body, hoodHole, 0.8), visage, sleeveA, sleeveB, armA, armB, handA, handB);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, rimTh: 0.1 });
  const C = new Canvas(r);
  // 透け: 尾と袖の先へ、筋になって薄れていく
  for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) {
    const p = C.pix[y * 96 + x]; if (!p || p.m !== "shroud") continue;
    const fy = Math.max(0, (y - 64) / 34), fs = Math.max(0, (46 - x) / 16) * Math.max(0, (y - 46) / 16);
    const n = fbm(x * 0.1 - y * 0.07, y * 0.1 + x * 0.06, 9, 3);
    const a = 1.1 - Math.max(fy, fs) * 1.25 + 0.9 * n;
    if (a < (BAYER[y & 3][x & 3] + 0.5) / 16 * 0.8 + 0.1) C.set(x, y, null);
  }
  // 眼窩の奥の小さな燐光
  C.set(46, 22, "#9ab8c8"); C.set(51, 21, "#9ab8c8");
  // 指先へ吸い寄せられる魂の光: 渦を描いて集まる粒
  const So = ["#2a4a5a", "#4c7a8c", "#8cc0cc", "#dcf4f4"];
  const R = rand(433);
  const tips = [[7, 38], [12, 56]];
  for (const [tx, ty] of tips) {
    for (let s = 0; s < 3; s++) {
      const a0 = 1.4 + s * 1.3 + R() * 0.6, d0 = 16 + R() * 10, spin = 1.2 + R() * 0.6;
      for (let k = 0; k <= 9; k++) {
        const t = k / 9, d = d0 * (1 - t) + 2.2, a = a0 + spin * t;
        const x = tx + Math.cos(a) * d * 0.6, y = ty + Math.sin(a) * d * 0.9;
        if (t < 0.5 && k % 2) continue;
        if (!C.get(Math.round(x), Math.round(y))) C.set(x, y, So[Math.min(3, Math.floor(t * 4))]);
      }
    }
  }
  for (const [tx, ty] of tips) { C.set(tx, ty, So[3]); C.set(tx + 1, ty, So[2]); C.set(tx, ty + 1, So[2]); C.set(tx - 1, ty, So[1]); C.set(tx, ty - 1, So[1]); }
  return C.toArt();
}
