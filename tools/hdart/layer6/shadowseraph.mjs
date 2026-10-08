import { tube, sphere, ellipsoid, cone, cyl, torus, slab, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { RIM, bubbles, motes } from "../temple.mjs";
export const meta = { id: "bs_shadowseraph", key: "hd_shadowseraph", w: 96, h: 96,
  note: "堕ちた光翼: 体を持たず、六枚の朽ちかけた翼だけが宙に寄り集まった堕ちた御使い。中心に眼を閉じた白い仮面が浮かび、黒ずんだ光輪が欠けて傾く。腐った羽根が抜け落ちながら、力を萎えさせる灰色の光の粉を絶えず振りまく" };
export function build() {
  const mats = {
    feather: { ramp: ramp(["#05050a", "#0e0e18", "#191a28", "#26283a", "#36384e", "#4a4c62", "#626478", "#80808e"], 8), dither: 0.5, amb: 0.24, spec: 0.5, pow: 18,
      shade: p => 0.14 * Math.sin((p.x * 0.6 + p.y * 1.1) * 1.4) },
    rot: { ramp: ramp(["#060504", "#14100a", "#241c12", "#34281a"], 4), dither: 0.6, amb: 0.2 },
    mask: { ramp: ramp(["#0c0c0e", "#26262a", "#44444a", "#66666c", "#8a8a8e", "#b0aeae", "#d4d0cc"], 7), spec: 0.8, pow: 26, dither: 0.35, amb: 0.3 },
    halo: { ramp: ramp(["#0a0804", "#2a2210", "#4a3c1c", "#6a5a2c"], 4), spec: 1.2, pow: 30, specCol: "#c8b070", dither: 0.4 },
    hole: { ramp: ["#000000", "#000000", "#020203"], amb: 0, dif: 0.05, noRim: true },
  };
  // 一枚の翼: 付け根から外へ伸びる骨の線と、その下に並ぶ羽根の板
  const wing = (x0, y0, ang, len, z, curl, n = 6) => {
    const a = ang * Math.PI / 180, ax = Math.cos(a), ay = Math.sin(a), nx = -ay * curl, ny = ax * curl;
    const tip = [x0 + ax * len, y0 + ay * len];
    const parts = [tube([[x0, y0, z, 2.2], [x0 + ax * len * 0.5 + nx * 3, y0 + ay * len * 0.5 + ny * 3, z, 1.6], [tip[0], tip[1], z, 0.6]], "feather", { seg: 3 })];
    for (let i = 0; i < n; i++) {
      const t = 0.2 + i / n * 0.8, bx = x0 + ax * len * t + nx * 3 * Math.sin(t * Math.PI), by = y0 + ay * len * t + ny * 3 * Math.sin(t * Math.PI);
      const fl = len * (0.42 - t * 0.18), fa = a + (curl > 0 ? 1 : -1) * (1.15 + t * 0.2);
      const ex = bx + Math.cos(fa) * fl, ey = by + Math.sin(fa) * fl;
      const w = 2.2;
      parts.push(slab([[bx - Math.cos(a) * w, by - Math.sin(a) * w], [bx + Math.cos(a) * w, by + Math.sin(a) * w], [ex + Math.cos(a) * 0.6, ey + Math.sin(a) * 0.6], [ex - Math.cos(a) * 0.6, ey - Math.sin(a) * 0.6]], z - 0.5 - i * 0.15, 0.55, i % 3 === 2 ? "rot" : "feather", 0.4, 0.3));
    }
    return U(0.5, ...parts);
  };
  const cx = 48, cy = 42;
  const wings = [
    wing(cx - 3, cy - 5, -150, 36, -4, -1), wing(cx + 3, cy - 5, -30, 36, -4, 1),   // 上の二枚: 斜め上へ
    wing(cx - 4, cy, 175, 38, -2, -1), wing(cx + 4, cy, 5, 38, -2, 1),             // 横の二枚
    wing(cx - 3, cy + 5, 125, 30, 0, 1, 5), wing(cx + 3, cy + 5, 55, 30, 0, -1, 5), // 下の二枚: 身を包むように下へ
  ];
  // 中心の仮面: 眼を閉じた白い顔
  const mask = Disp(U(1, ellipsoid([cx, cy, 6], [6.4, 8, 4], "mask"), ellipsoid([cx, cy + 6, 7], [3.6, 2.6, 3], "mask")), (x, y, z) => 0.2 * vnoise(x * 0.8, y * 0.8));
  const lids = U(0, ellipsoid([cx - 2.6, cy - 1, 9.4], [2, 0.5, 0.8], "hole", 10), ellipsoid([cx + 2.6, cy - 1, 9.4], [2, 0.5, 0.8], "hole", -10), ellipsoid([cx, cy + 5, 9.6], [1.6, 0.4, 0.8], "hole"));
  const crack = (x, y, z, m) => m === "mask" && Math.abs((x - cx - 2) - (y - cy) * 0.4 + Math.sin(y * 1.6) * 0.6) < 0.45 && y < cy + 4 ? "hole" : m;
  // 欠けて傾いた光輪
  const halo = Sub(torus([cx, cy - 15, 0], 9, 1, "halo", 14, 70), sphere([cx + 8, cy - 16, 0], 3.4, "halo"), 0.3);
  const scene = U(0, ...wings, Paint(Sub(mask, lids, 0.3), crack), halo);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [cx, cy, 20], r: 24, k: 0.35 }] });
  const C = new Canvas(r);
  // 抜け落ちる羽根と、力を萎えさせる灰色の光の粉
  const R = rand(941);
  const G = ["#26283a", "#4a4c62", "#80808e", "#b8b8c0"];
  for (let i = 0; i < 9; i++) {
    const x = 10 + R() * 76, y = 60 + R() * 30, a = R() * Math.PI;
    for (let k = -2; k <= 2; k++) { const X = Math.round(x + Math.cos(a) * k), Y = Math.round(y + Math.sin(a) * k * 0.6); if (!C.get(X, Y)) C.set(X, Y, k === 0 ? G[2] : G[1]); }
  }
  for (let i = 0; i < 60; i++) {
    const t = R(), x = cx + (R() - 0.5) * 70 * (0.4 + t), y = cy + 8 + t * 46;
    const X = Math.round(x), Y = Math.round(y);
    if (!C.get(X, Y) && Y < 96) C.set(X, Y, G[Math.min(3, Math.floor(R() * R() * 4.6))]);
  }
  bubbles(C, 943, 6);
  motes(C, 945, 6);
  return C.toArt();
}
