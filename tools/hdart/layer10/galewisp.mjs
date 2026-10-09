import { sphere, ellipsoid, U, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { STAIR, PUDDLE, TOWER, RIM, BOLT, SOULS, towerFloor, bolt2d, sparks, rain } from "../storm.mjs";
export const meta = { id: "bs_galewisp", key: "hd_galewisp", w: 96, h: 96,
  note: "稲妻の群火: 塔の吹き抜けを群れで漂う、青白い稲妻の玉。どの玉の奥にも、小さく丸まった人の顔のような影が透けて見える。尾を引いて飛び回り、玉どうしのあいだに稲妻を張って、触れた者を痺れさせる (麻痺・群れ)。光るだけの薄い体は、呪文を浴びるとたやすく散る (魔法弱点)" };
export function build() {
  const glow = (k) => ({ ramp: [SOULS[0], BOLT[1], BOLT[2], SOULS[3], BOLT[3], BOLT[4]], noRim: true, emit: p => 0.08 + 0.92 * Math.max(0, p.nz) ** 1.6 * k });
  const mats = { w1: glow(1), w2: glow(0.9), w3: glow(0.8), w4: glow(0.7), w5: glow(0.6), stair: STAIR, puddle: PUDDLE, tower: TOWER };
  // 玉 [x, y, 半径, 材質]
  const wisps = [[44, 42, 9, "w1"], [72, 28, 6.4, "w2"], [20, 24, 6, "w3"], [74, 66, 5.4, "w4"], [18, 64, 4.6, "w5"]];
  const scene = U(0, towerFloor(48, 95, 40, 12, { n: 2, seed: 11001, wet: 0.4 }), ...wisps.map(([x, y, r, m]) => sphere([x, y, 6], r, m)));
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  const R = rand(11003);
  for (const [x, y, rr] of wisps) {
    // 玉の奥に透ける丸まった顔の影 (眼と口の暗い穴)
    const s = rr / 9;
    for (const [dx, dy, w, h] of [[-2.4, -1.4, 1, 1.4], [2.4, -1.4, 1, 1.4], [0, 3, 1, 1.8]]) for (let j = -h; j <= h; j += 0.5) for (let i = -w; i <= w; i += 0.5) if ((i / w) ** 2 + (j / h) ** 2 <= 1.05) C.only(x + (dx + i) * s, y + (dy + j) * s, SOULS[2]);
    // 揺れる尾 (右下へ流れる)
    for (let k = 0; k < rr * 3; k++) {
      const t = k / (rr * 3), X = x + rr * 0.6 + k * 0.9, Y = y + rr * 0.4 + Math.sin(k * 0.5 + x) * 2 * t + k * 0.35;
      for (let w = -Math.round(rr * 0.5 * (1 - t)); w <= Math.round(rr * 0.5 * (1 - t)); w++) if (!C.get(Math.round(X), Math.round(Y + w)) && R() > t * 0.8) C.set(X, Y + w, t < 0.3 ? BOLT[2] : t < 0.6 ? BOLT[1] : BOLT[0]);
    }
    // 外側の滲む光の輪
    for (let a = 0; a < Math.PI * 2; a += 0.15) { const X = Math.round(x + Math.cos(a) * (rr + 2)), Y = Math.round(y + Math.sin(a) * (rr + 2)); if (!C.get(X, Y) && (X + Y) % 2 === 0) C.set(X, Y, BOLT[0]); }
  }
  // 玉どうしに張られた稲妻
  for (const [a, b, s] of [[0, 1, 1], [0, 2, 2], [0, 3, 3], [2, 4, 4], [1, 3, 5]]) bolt2d(C, wisps[a][0], wisps[a][1], wisps[b][0], wisps[b][1], { seed: s, jag: 2.4, branch: 1, glow: false });
  rain(C, 11005, 50);
  sparks(C, 11007, 24, [2, 2, 92, 80]);
  return C.toArt();
}
