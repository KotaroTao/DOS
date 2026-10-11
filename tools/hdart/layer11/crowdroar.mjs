import { sphere, ellipsoid, cone, tube, box, torus, U, Sub, Disp, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { STONE, ASHBED, RIM, GHOST, ashfall, shoutWaves, afterimage } from "../arena.mjs";
export const meta = { id: "bs_crowdroar", key: "hd_crowdroar", w: 96, h: 96,
  note: "歓声の渦: 闘技場の上に渦を巻く、数えきれない口だけの霊 (群れ)。灰と霧の渦の中に、叫ぶ口・笑う口・歯をむく口が浮かんでは消え、目も鼻もない。口々から広がる声の波を聞いた者は、敵と味方の見分けがつかなくなる (混乱・多用)。声の渦は刃をすり抜ける (回避) — 輪郭は二重にぶれている" };
export function build() {
  const mats = {
    mist: { ramp: GHOST.slice(0, 6), dither: 0.8, amb: 0.3, noRim: true,
      shade: p => 0.16 * Math.sin(Math.atan2(p.z, p.x - 48) * 3 + p.y * 0.35 + 2 * fbm(p.x * 0.12, p.y * 0.12)) },
    lip: { ramp: ["#0c0608", "#22121a", "#3a2230", "#56364a", "#745068"], dither: 0.4, amb: 0.3 },
    maw: { ramp: ["#000000", "#06030a", "#140a18"], amb: 0.05, dif: 0.2, noRim: true },
    tooth: { ramp: ["#2a2824", "#6a665c", "#b4ae9c", "#e2dcc8"], dither: 0.3 },
  };
  // 渦: 上が広く、下へ細って砂に触れる漏斗
  const swirl = (x, y, z) => 1.6 * fbm(x * 0.12, y * 0.09, z * 0.12) + 1.6 * Math.sin(Math.atan2(z, x - 48) * 3 + y * 0.32);
  const vortex = Disp(U(6, tube([[40, 92, 0, 2], [44, 78, 0, 6], [52, 60, 0, 13], [48, 40, 0, 20]], "mist", { seg: 4 }), ellipsoid([48, 28, -2], [32, 11, 16], "mist")), swirl);
  // 浮かぶ口 [x, y, z, 幅, 開き, 傾き]
  const mouths = [[30, 26, 16, 6, 4, -10], [58, 22, 16, 7, 5, 12], [44, 40, 16, 6, 4.4, 0], [66, 44, 12, 5, 3, 20], [26, 46, 10, 4.6, 3, -20], [50, 60, 12, 5, 3.4, 6], [40, 72, 8, 3.6, 2.4, -8], [72, 24, 10, 4, 2.6, 30], [20, 22, 8, 4, 2.4, -30], [48, 82, 6, 3, 2, 0]];
  const lips = [], holes = [];
  for (const [x, y, z, w, h, a] of mouths) {
    lips.push(ellipsoid([x, y, z], [w * 1.05, h * 1.0, 2.6], "lip", a));
    holes.push(ellipsoid([x, y, z + 2.4], [w * 0.8, h * 0.58, 2.6], "maw", a));
  }
  const scene = U(0, Sub(U(2, vortex, ...lips), U(0, ...holes), 0.3));
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  // 歯 (口の上下の縁に並ぶ)
  for (const [x, y, z, w, h] of mouths) {
    for (let X = Math.floor(x - w); X <= x + w; X++) {
      let top = -1, bot = -1;
      for (let Y = Math.floor(y - h - 1); Y <= y + h + 1; Y++) { const p = C.pix[Y * 96 + X]; if (p && p.m === "maw") { if (top < 0) top = Y; bot = Y; } }
      if (top < 0 || bot - top < 2) continue;
      if ((X & 1) === 0) { C.set(X, top, "#b4ae9c"); if (bot - top > 4) C.set(X, top + 1, "#6a665c"); }
      if (w > 4 && (X & 1) === 1) C.set(X, bot, "#6a665c");
    }
  }
  // 渦の帯 (体の上を巡る明るい螺旋の筋)
  for (let t = 0; t < 1; t += 0.0012) {
    const y = 92 - t * 72, rr = 2 + t * 30, a = t * 34, x = 46 + Math.cos(a) * rr + (1 - t) * -4;
    if (Math.sin(a) < 0) continue;
    const p = C.pix[Math.round(y) * 96 + Math.round(x)]; if (!p || p.m !== "mist") continue;
    C.set(x, y, t > 0.5 ? GHOST[6] : GHOST[5]);
  }
  // 声の波 (口々から外へ)
  for (const [x, y, z, w, h, a] of mouths.slice(0, 5)) shoutWaves(C, x, y, Math.atan2(y - 50, x - 48), { n: 3, gap: 4, spread: 0.5, r0: w + 2 });
  // 刃をすり抜ける二重の輪郭
  afterimage(C, [[-5, 2, 0.3, "#0d1018"], [5, -2, 0.3, "#0d1018"]]);
  ashfall(C, 12003, 60);
  return C.toArt();
}
