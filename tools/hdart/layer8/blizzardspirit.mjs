import { sphere, ellipsoid, cone, tube, torus, U, Sub, Disp, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { RIM, FROST, SOUL, snowfall, crystal, puffs } from "../ice.mjs";
export const meta = { id: "bs_blizzardspirit", key: "hd_blizzardspirit", w: 96, h: 96,
  note: "吹雪の精: 渦を巻く吹雪そのものが意思を持った精。螺旋に巻く雪の帯の中心に、風に削られた仮面のような顔が浮かび、細い眼が青白く光る。頭上には六つの氷の結晶をつないだ呪の輪が回り、隊をまとめて凍らせる吹雪の大呪を呼ぶ (全体呪文)" };
export function build() {
  const mats = {
    gust: { ramp: ramp(["#03060a", "#0a1420", "#14243a", "#203a56", "#305270", "#466e8c", "#6a90aa", "#94b4c8"], 8), dither: 0.65, amb: 0.3, noRim: false,
      shade: p => 0.14 * Math.sin(Math.atan2(p.z, p.x - 48) * 4 + p.y * 0.35) },
    mask: { ramp: ramp(["#0a0e14", "#1e2a36", "#344656", "#506676", "#708a9a", "#98b0be", "#c4d6e0"], 7), dither: 0.45, spec: 0.5, pow: 24 },
    hole: { ramp: ["#000000", "#02050a"], amb: 0, dif: 0.05, noRim: true },
    eye: { ramp: [SOUL[2], SOUL[3], SOUL[4]], emit: () => 0.95 },
    rune: { ramp: SOUL, noRim: true, emit: p => 0.45 + 0.5 * Math.max(0, p.nz) },
  };
  // 仮面の背から渦を巻いて伸びる風の触手 (時計回りの風車のように) と、下へすぼまる竜巻の尾
  const arms = [];
  for (let i = 0; i < 5; i++) {
    const a0 = i / 5 * Math.PI * 2 + 0.4, pts = [];
    for (let k = 0; k <= 6; k++) { const t = k / 6, a = a0 + t * 2.2, r = 8 + t * 30; pts.push([48 + Math.cos(a) * r, 42 + Math.sin(a) * r * 0.8, -4 - t * 4, 5.2 * (1 - t) + 0.6]); }
    arms.push(tube(pts, "gust", { seg: 3 }));
  }
  const tail = Disp(cone([48, 50, -4], [44, 92, -4], 12, 1.5, "gust"), (x, y, z) => 1.2 * Math.max(0, Math.sin(Math.atan2(z + 4, x - 48) * 2 + y * 0.6)) * Math.min(1, (y - 50) / 10));
  const swirl = Disp(U(2.5, ...arms, tail), (x, y, z) => 0.6 * fbm(x * 0.3, y * 0.3, z * 0.3));
  // 仮面の顔
  const face = Disp(ellipsoid([48, 40, 12], [10, 12, 6], "mask"), (x, y, z) => 0.6 * Math.max(0, Math.sin(x * 0.9 + y * 0.2)) * 0.5);
  const cut = U(0, ellipsoid([43.5, 37, 17.4], [3.4, 1.2, 1.8], "hole", -14), ellipsoid([52.5, 37, 17.4], [3.4, 1.2, 1.8], "hole", 14), ellipsoid([48, 47, 17.4], [3.2, 2, 1.8], "hole"));
  const eyes = [ellipsoid([43.5, 37, 16.2], [2.6, 0.7, 1], "eye", -14), ellipsoid([52.5, 37, 16.2], [2.6, 0.7, 1], "eye", 14)];
  // 頭上の呪の輪
  const ring = torus([48, 14, 0], 15, 0.8, "rune", 0, 18);
  const scene = U(0, swirl, Sub(face, cut, 0.4), ...eyes, ring);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  // 輪の上の六つの氷の結晶
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + 0.3, x = Math.round(48 + Math.cos(a) * 15), y = Math.round(14 + Math.sin(a) * 15 * 0.31); crystal(C, x, y, 3); }
  // 渦から吹き出す雪の筋
  const R = rand(8401);
  for (let i = 0; i < 26; i++) { // 渦に沿って流れる雪片の筋
    const a = R() * Math.PI * 2, r0 = 22 + R() * 18, y = 20 + R() * 66;
    for (let k = 0; k < 4; k++) { const x = 48 + Math.cos(a + k * 0.08) * r0, yy = y - k * 0.6; if (!C.get(Math.round(x), Math.round(yy))) C.set(x, yy, FROST[Math.max(0, 3 - k)]); }
  }
  snowfall(C, 8403, 50);
  return C.toArt();
}
