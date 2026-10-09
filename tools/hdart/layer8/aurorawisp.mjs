import { sphere, ellipsoid, cone, U, Sub, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { RIM, AURORA, SOUL, aurora, snowfall } from "../ice.mjs";
export const meta = { id: "bs_aurorawisp", key: "hd_aurorawisp", w: 96, h: 96,
  note: "極光の群火: 氷に閉じ込められた魂の光が、極光の色の鬼火となって群れ飛ぶもの。緑と紫に揺らめく炎の玉が五つ、それぞれ小さな顔のような暗いくぼみを持ち、尾を引いて輪を描く。後ろには極光の帳が垂れ、見とれた者は正気を失う (混乱)" };
export function build() {
  const G = AURORA.green, V = AURORA.violet;
  const mats = {
    green: { ramp: [G[1], G[2], G[3], G[4], "#c8fbe0"], noRim: true, emit: p => 0.3 + 0.65 * Math.max(0, p.nz) + 0.1 * fbm(p.x * 0.4, p.y * 0.4) },
    violet: { ramp: [V[1], V[2], V[3], V[4], "#e2d6fa"], noRim: true, emit: p => 0.3 + 0.65 * Math.max(0, p.nz) + 0.1 * fbm(p.x * 0.4, p.y * 0.4) },
    hole: { ramp: ["#000000", "#03040a"], amb: 0, dif: 0.05, noRim: true },
  };
  // 五つの鬼火: 位置・大きさ・色・尾の向き
  const wisps = [[48, 40, 10, "green", 0.6], [24, 58, 7, "violet", -0.3], [72, 58, 7.5, "green", 0.4], [30, 26, 5.5, "violet", 0.9], [70, 24, 6, "violet", -0.8]];
  const parts = [], holes = [];
  for (const [x, y, r, m, lean] of wisps) {
    parts.push(U(r * 0.4, sphere([x, y, 0], r, m), cone([x, y - r * 0.3, 0], [x + lean * r * 1.6, y - r * 2.6, -2], r * 0.8, 0.4, m)));
    holes.push(ellipsoid([x - r * 0.32, y - r * 0.1, r * 0.9], [r * 0.16, r * 0.3, r * 0.3], "hole", 20), ellipsoid([x + r * 0.32, y - r * 0.1, r * 0.9], [r * 0.16, r * 0.3, r * 0.3], "hole", -20),
      ellipsoid([x, y + r * 0.42, r * 0.9], [r * 0.2, r * 0.3, r * 0.3], "hole"));
  }
  const scene = Sub(U(0, ...parts), U(0, ...holes), 0.2);
  const r = render(scene, mats, { w: 96, h: 96 });
  const C = new Canvas(r);
  // 鬼火が描く輪の軌跡
  const R = rand(9101);
  for (let a = 0; a < Math.PI * 2; a += 0.02) {
    const x = 48 + Math.cos(a) * 30, y = 46 + Math.sin(a) * 16;
    if (!C.get(Math.round(x), Math.round(y)) && R() < 0.55) C.set(x, y, (a < Math.PI ? G : V)[1 + Math.floor(R() * 2)]);
  }
  // 極光の帳 (後ろ)
  aurora(C, [[0, 50, 2, 44, G, 1], [40, 96, 0, 40, V, 3], [20, 76, 8, 30, G, 5]], 0.55);
  snowfall(C, 9103, 40, [2, 50, 92, 44]);
  return C.toArt();
}
