import { sphere, ellipsoid, cone, tube, U, Sub, Disp, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { MUD, POOL, ROTWOOD, RIM, ROT, MIASMA, bogFloor, scum, motes, puffs } from "../swamp.mjs";
export const meta = { id: "bs_plaguewraith", key: "hd_plaguewraith", w: 96, h: 96,
  note: "疫病の亡霊: 疫病で死に、奈落の底まで落ちて腐った者たちの魂が、ひとつに溶け合ったもや。布に巻かれた亡骸の山から立ちのぼり、黄ばんだもやの中に苦しむ顔がいくつも浮かぶ。触れた者を熱と病に沈める (毒)。撃ち込まれた呪文は、もやの奥の顔たちに呑まれて消える (魔法抵抗100)" };
export function build() {
  const mats = {
    haze: { ramp: ramp(["#040402", "#0c0c06", "#16160a", "#22210e", "#2f2d14", "#3e3b1a", "#504c22", "#64602c"], 8), dither: 0.75, amb: 0.32,
      shade: p => 0.14 * Math.sin(p.y * 0.5 + 2 * fbm(p.x * 0.15, p.y * 0.1, p.z * 0.1)) },
    face: { ramp: ramp(["#0c0c06", "#22210e", "#3e3b1a", "#5e5a2a", "#807a3c", "#a49e58"], 6), dither: 0.45, amb: 0.3 },
    shroud: { ramp: ramp(["#060504", "#12100c", "#201c16", "#302a20", "#40392c", "#544a3a"], 6), dither: 0.55, amb: 0.25 },
    hole: { ramp: ["#000000", "#020201"], amb: 0, dif: 0.05, noRim: true },
    eye: { ramp: [ROT[3], ROT[4], ROT[5]], emit: () => 0.9 },
    mud: MUD, pool: POOL, rotwood: ROTWOOD,
  };
  // 立ちのぼるもや: 下が細く上へ広がる渦
  const column = Disp(U(4, ellipsoid([48, 74, 0], [10, 12, 8], "haze"), ellipsoid([46, 54, 0], [18, 14, 11], "haze", -10), ellipsoid([50, 34, -2], [24, 16, 12], "haze", 8)),
    (x, y, z) => 2.2 * fbm(x * 0.12, y * 0.1, z * 0.12) + 0.8 * Math.sin(y * 0.4 + x * 0.25));
  // もやに浮かぶ顔 [x, y, z, 大きさ, 傾き]
  const faces = [[38, 32, 10, 1.2, -15], [56, 28, 10, 1.4, 10], [46, 50, 10, 1.1, 0], [66, 42, 6, 0.9, 25], [30, 46, 7, 0.9, -25], [50, 68, 7, 0.8, 5]];
  const fs = [], holes = [];
  for (const [x, y, z, s, a] of faces) {
    fs.push(ellipsoid([x, y, z], [4 * s, 5 * s, 3 * s], "face", a));
    holes.push(ellipsoid([x - 1.5 * s, y - 1 * s, z + 2.6 * s], [1 * s, 1.3 * s, 0.9 * s], "hole"), ellipsoid([x + 1.5 * s, y - 1 * s, z + 2.6 * s], [1 * s, 1.3 * s, 0.9 * s], "hole"), ellipsoid([x, y + 2.4 * s, z + 2.4 * s], [1.2 * s, 1.8 * s, 1 * s], "hole"));
  }
  // 布に巻かれた亡骸の山
  const shrouds = [];
  for (const [x, y, z, l, a] of [[30, 88, 4, 14, 10], [62, 89, 2, 16, -8], [48, 84, -6, 14, 4], [20, 90, 12, 10, -20], [74, 86, -10, 12, 15]])
    shrouds.push(Disp(ellipsoid([x, y, z], [l, 3.6, 4.4], "shroud", a), (X, Y, Z) => 0.4 * Math.abs(Math.sin(X * 1.1))));
  const ghost = Sub(U(1.6, column, ...fs), U(0, ...holes), 0.2);
  const scene = U(0, bogFloor(48, 95, 46, 14, { n: 1, seed: 10601, wet: 0.05, logs: 0 }), ghost, ...shrouds);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  for (const [x, y, z, s] of faces) { C.only(x - 1.5 * s, y - 1 * s, ROT[4]); C.only(x + 1.5 * s, y - 1 * s, ROT[3]); }
  // 呪文がもやの顔に呑まれる (右上から来た光が渦を巻いて消える)
  for (let t = 0; t < 1; t += 0.02) { const a = t * Math.PI * 3, rr = 14 * (1 - t) + 2, x = 74 + Math.cos(a) * rr - t * 8, y = 18 + Math.sin(a) * rr * 0.6 + t * 6; if (!C.get(Math.round(x), Math.round(y))) C.set(x, y, ["#3a4a5a", "#6a88a0", "#b0d0e8"][Math.min(2, Math.floor((1 - t) * 3))]); }
  // 外へ漏れる病のもや
  puffs(C, [[20, 30, 6], [76, 54, 6], [80, 30, 4], [16, 60, 5]], ["#0c0c06", "#16160a", "#22210e", "#2f2d14", "#3e3b1a"], { dens: 0.8, seed: 3 });
  scum(C, 10603);
  motes(C, 10605, 22, [2, 2, 92, 80], true);
  return C.toArt();
}
