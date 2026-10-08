import { tube, sphere, ellipsoid, cone, torus, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { RIM, bubbles, motes } from "../temple.mjs";
export const meta = { id: "bs_abyssjelly", key: "hd_abyssjelly", w: 96, h: 96,
  note: "深みの灯りくらげ: 鐘の形の半透けの傘を持つ大きなくらげ。傘の内に灯りの臓が透けて明滅し、縁から細い触手と、光の玉を連ねた長い腕が垂れる。明滅する光の輪が幾重にも広がって見る者を惑わせる。宙に漂う" };
export function build() {
  const mats = {
    bell: { ramp: ramp(["#06081a", "#0c1230", "#141c46", "#1e285c", "#2a3672", "#3a4888", "#4e5e9e", "#6a7ab4"], 8), spec: 1.6, pow: 40, specCol: "#c8d8ff", dither: 0.6, amb: 0.3,
      shade: p => 0.12 * Math.sin(Math.atan2(p.z, p.x - 48) * 10) + 0.12 * Math.max(0, 1 - Math.hypot(p.x - 48, p.y - 36) / 16) },
    organ: { ramp: ["#3a1450", "#7a2a9a", "#c060e0", "#f0b8ff"], emit: p => 0.4 + 0.6 * Math.max(0, p.nz) + 0.15 * vnoise(p.x * 0.6, p.y * 0.6) },
    tent: { ramp: ramp(["#08091a", "#141834", "#222a50", "#343e6c", "#4a568a"], 5), dither: 0.6, amb: 0.3 },
    bead: { ramp: ["#2a1a6a", "#5a40c0", "#a890ff", "#f0e8ff"], emit: p => 0.5 + 0.5 * Math.max(0, p.nz) },
  };
  const R = rand(761);
  // 傘: 上は丸く、下は口を開けた鐘。縁は波打つ
  const bell = Disp(Sub(ellipsoid([48, 30, 0], [22, 17, 18], "bell"), ellipsoid([48, 42, 0], [19, 14, 15], "bell"), 1.4),
    (x, y, z) => 0.6 * Math.sin(Math.atan2(z, x - 48) * 9) * Math.max(0, (y - 32) / 10) + 0.2 * fbm(x * 0.3, y * 0.3, z * 0.3));
  // 傘の内の灯りの臓 (四つ葉の形)
  const organs = [];
  for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + 0.4; organs.push(ellipsoid([48 + Math.cos(a) * 6, 30, Math.sin(a) * 6 + 3], [4, 3, 3.2], "organ")); }
  organs.push(sphere([48, 27, 6], 3.4, "organ"));
  // 口腕: 中心から垂れる太いひだの帯
  const arms = [];
  for (const [dx, dz, L, ph] of [[-4, 4, 40, 0], [3, 6, 46, 1.4], [0, -2, 36, 2.6], [6, 1, 34, 3.7]]) {
    const pts = [];
    for (let k = 0; k <= 6; k++) { const u = k / 6; pts.push([48 + dx + Math.sin(u * 4 + ph) * 4 * u, 40 + L * u, dz + Math.cos(u * 3 + ph) * 2, 2.6 - u * 1.8]); }
    arms.push(Disp(tube(pts, "tent", { seg: 3 }), (x, y, z) => 0.5 * Math.abs(Math.sin(y * 1.2 + ph))));
  }
  // 縁の細い触手 (長く垂れて揺れる)
  const tents = [];
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * Math.PI * 2, x0 = 48 + Math.cos(a) * 20, z0 = Math.sin(a) * 16;
    const L = 26 + R() * 26, ph = R() * 6, pts = [];
    for (let k = 0; k <= 5; k++) { const u = k / 5; pts.push([x0 + Math.cos(a) * u * 6 + Math.sin(u * 5 + ph) * 3, 42 + L * u, z0 + u * 2, 0.9 - u * 0.5]); }
    tents.push(tube(pts, "tent", { seg: 3 }));
  }
  // 腕の先の光の玉
  const beads = [];
  for (const [x, y, z, s] of [[42, 64, 6, 1.4], [40, 74, 6, 1.2], [44, 82, 5, 1], [54, 70, 8, 1.4], [52, 82, 8, 1.2], [56, 90, 7, 0.9], [50, 60, 2, 1]]) beads.push(sphere([x, y, z], s, "bead"));
  const scene = U(0, bell, ...organs, ...arms, ...tents, ...beads);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [48, 30, 10], r: 26, k: 0.5 }] });
  const C = new Canvas(r);
  // 明滅する光の輪 (惑わし): 傘の周りに楕円の波紋を三重に
  const L = ["#1a1640", "#2e2a6a", "#5248a8", "#9a88e8"];
  for (const [rr, c, gap] of [[27, 2, 7], [33, 1, 11], [40, 0, 5]]) {
    for (let a = 0; a < Math.PI * 2; a += 0.01) {
      if (Math.sin(a * gap + rr) > 0.7) continue;
      const X = Math.round(48 + Math.cos(a) * rr), Y = Math.round(34 + Math.sin(a) * rr * 0.62);
      if (!C.get(X, Y)) C.set(X, Y, L[c]);
    }
  }
  // 傘の上のきらめきと、臓の芯
  C.set(48, 26, "#f0b8ff"); C.set(41, 18, "#c8d8ff"); C.set(40, 19, "#6a7ab4");
  for (let i = 0; i < 18; i++) { const x = 6 + R() * 84, y = 4 + R() * 88; const X = Math.round(x), Y = Math.round(y); if (!C.get(X, Y)) C.set(X, Y, L[1 + Math.floor(R() * 3)]); }
  bubbles(C, 763, 8);
  motes(C, 765, 8);
  return C.toArt();
}
