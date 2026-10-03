import { tube, sphere, ellipsoid, cone, slab, cyl, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { RIM } from "../lib.mjs";
export const meta = { id: "bs_abysstentacle", key: "hd_abysstentacle", w: 96, h: 96,
  note: "深淵の触手: 排水路の床の鉄格子を押し破って伸びる吸盤だらけの太い腕。一本は鎌首を上げてこちらへ巻きつこうとし、奥の闇に巨大な眼がひとつ" };
export function build() {
  const mats = {
    skin: { ramp: ramp(["#030204", "#0c0610", "#160c1a", "#221426", "#321e32", "#46283e", "#5e3848", "#7c4e58"], 8), spec: 1.8, pow: 45, specCol: "#e0c8d8", dither: 0.5 },
    under: { ramp: ramp(["#060404", "#1a1012", "#30201e", "#4a342c", "#66483a", "#86624c", "#a8826a"], 7), spec: 1.4, pow: 40, specCol: "#f8e0d0", dither: 0.5 },
    sucker: { ramp: ramp(["#040203", "#160a0c", "#2c1416", "#4a2420", "#6e3c30"], 5), spec: 1.2, pow: 40, dither: 0.3 },
    iron: { ramp: ramp(["#030202", "#0c0806", "#18100a", "#261a10", "#382616", "#4e3820", "#6a4c2e"], 7), spec: 0.6, pow: 25, dither: 0.6, shade: p => 0.12 * fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5) },
    hole: { ramp: ["#000000", "#000000", "#030205"], amb: 0, dif: 0.1, noRim: true },
    eye: { ramp: ramp(["#100800", "#4a2c00", "#8a5a08", "#c89018", "#f0c840"], 5), emit: p => 0.25 + 0.75 * Math.max(0, p.nz), dither: 0.4 },
  };
  // 床の排水口: 斜め上から見た円い縁と、その奥の闇
  const n = [0, -0.94, 0.34], v = [0, 0.34, 0.94], c = [48, 82, 0];
  const at = (k, dx = 0, dv = 0) => [c[0] + n[0] * k + dx, c[1] + n[1] * k + v[1] * dv, c[2] + n[2] * k + v[2] * dv];
  const rim = Sub(cyl(at(-3), at(1.2), 45, "iron", 1), cyl(at(-30), at(6), 37, "hole"));
  const hole = cyl(at(-1.2), at(-0.6), 37.5, "hole");
  // 触手: 一本は手前へ鎌首、二本は左右へのたうつ
  const T1 = [[52, 90, -8, 9], [56, 70, 0, 8.5], [52, 54, 6, 7.5], [40, 42, 12, 6.5], [32, 28, 18, 5.5], [38, 16, 22, 4.5], [50, 12, 24, 3.5], [58, 18, 25, 2.5], [56, 25, 25, 1.6], [51, 25, 25, 0.8]];
  const T2 = [[30, 90, -12, 6.5], [22, 72, -6, 5.5], [12, 64, -2, 4.6], [8, 52, 0, 3.6], [12, 44, 2, 2.6], [17, 44, 3, 1.4]];
  const T3 = [[72, 90, -12, 7], [80, 70, -6, 6], [86, 56, -4, 5], [84, 42, -2, 4], [78, 34, 0, 3], [74, 36, 1, 1.8], [75, 40, 1, 1]];
  const S = [T1, T2, T3];
  // 吸盤側 (内側の腹) を淡く塗る: 管の中心から見て曲がりの内側
  const underFn = (pts) => (x, y, z, m) => { if (m !== "skin") return m; let best = 1e9, bi = 0; for (let i = 0; i < pts.length; i++) { const d = (x - pts[i][0]) ** 2 + (y - pts[i][1]) ** 2 + (z - pts[i][2]) ** 2; if (d < best) { best = d; bi = i; } } const a = pts[Math.max(0, bi - 1)], b = pts[Math.min(pts.length - 1, bi + 1)]; const tx = b[0] - a[0], ty = b[1] - a[1]; const nx = ty, ny = -tx; const s = (x - pts[bi][0]) * nx + (y - pts[bi][1]) * ny; return s < -0.3 * Math.hypot(nx, ny) * pts[bi][3] ? "under" : m; };
  const arms = S.map(pts => Paint(Disp(tube(pts, "skin", { seg: 6, k: 1 }), (x, y, z) => 0.3 * fbm(x * 0.4, y * 0.4, z * 0.4)), underFn(pts)));
  // 吸盤: 内側の縁に沿って並ぶ小さな円盤
  const suckers = [];
  for (const pts of S) for (let i = 0; i < pts.length - 1; i++) for (let t = 0; t < 1; t += 0.5) {
    const a = pts[i], b = pts[i + 1]; const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t, z = a[2] + (b[2] - a[2]) * t, r = a[3] + (b[3] - a[3]) * t;
    const tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1; const nx = -ty / l, ny = tx / l;
    if (r < 1.5) continue;
    suckers.push(Sub(ellipsoid([x - nx * r * 0.8, y - ny * r * 0.8, z + r * 0.45], [r * 0.38, r * 0.38, r * 0.3], "sucker"), sphere([x - nx * r * 0.95, y - ny * r * 0.95, z + r * 0.75], r * 0.2, "hole")));
  }
  // 鉄格子: 外側の数本だけ残り、内側は触手に押し破られて上へ折れ曲がる
  const bars = [];
  for (const dx of [-30, -20, 22, 31]) { const h = Math.sqrt(37 * 37 - dx * dx); bars.push(cyl(at(0, dx, -h), at(0, dx, h), 1.5, "iron", 0.4)); }
  bars.push(tube([[...at(0, -10, -34), 1.5], [...at(0, -10, -8), 1.5], [...at(10, -14, 2), 1.4], [...at(18, -18, 4), 1.3]], "iron"));
  bars.push(tube([[...at(0, 10, 34), 1.5], [...at(0, 10, 10), 1.5], [...at(12, 16, 4), 1.4], [...at(20, 22, 0), 1.3]], "iron"));
  const scene = U(0, rim, hole, ...bars, ...arms, ...suckers);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  // 穴の奥の眼
  for (let y = -3; y <= 3; y++) for (let x = -6; x <= 6; x++) { if ((x / 6) ** 2 + (y / 3) ** 2 > 1) continue; const px = 66 + x, py = 86 + y; const p = C.pix[py * 96 + px]; if (p && p.m !== "hole") continue; C.set(px, py, Math.abs(x) < 1 ? "#000000" : (x / 6) ** 2 + (y / 3) ** 2 > 0.6 ? "#4a2c00" : "#a87410"); }
  C.set(64, 85, "#f0d880");
  // 滴る汚水
  const R = rand(9); const D = ["#1a2c30", "#2c4446", "#56767a"];
  for (const [x, y0, l] of [[41, 47, 5], [33, 33, 4], [10, 58, 6], [84, 48, 5]]) { let y = y0; while (C.get(x, y) && y < 95) y++; for (let i = 0; i < l; i++) C.set(x, y + i, D[i < l - 1 ? 1 : 2]); }
  return C.toArt();
}
