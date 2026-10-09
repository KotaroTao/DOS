import { sphere, ellipsoid, cone, tube, slab, U, Sub, Disp, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { MUD, POOL, REED, ROTWOOD, RIM, ROT, bogFloor, reeds, reedTips, scum, motes, afterimage } from "../swamp.mjs";
export const meta = { id: "bs_blightmoth", key: "hd_blightmoth", w: 96, h: 96,
  note: "枯死の大蛾: 人より大きな、ぼろぼろの翅の大蛾。くすんだ灰褐色の翅に、黄緑に濁った大きな目玉模様。羽ばたくたびに枯死の鱗粉が降りそそぎ、浴びた葦は枯れて折れる (麻痺)。翅の残像を引きながら、目にも止まらぬ速さで二度舞い寄る (神速)。羽毛のような触角と毛深い胴" };
export function build() {
  const mats = {
    wing: { ramp: ramp(["#030302", "#0a0907", "#14120e", "#201d17", "#2e2a21", "#3e392d", "#524c3c", "#6a634e"], 8), dither: 0.6, amb: 0.28,
      shade: p => 0.12 * Math.sin(Math.hypot(p.x - 48, p.y - 44) * 0.7) + 0.08 * fbm(p.x * 0.4, p.y * 0.4) },
    fuzz: { ramp: ramp(["#040302", "#0e0b07", "#1c160e", "#2c2316", "#3e3220", "#54452e"], 6), dither: 0.6, amb: 0.25, shade: p => 0.12 * fbm(p.x * 1.2, p.y * 1.2, p.z) },
    eye: { ramp: ["#0a0a04", "#2a2a10", "#4a4818"], dither: 0.3, spec: 1, pow: 30, specCol: "#c8c070" },
    mud: MUD, pool: POOL, reed: REED, rotwood: ROTWOOD,
  };
  // 翅: 前翅と後翅の対。ふちはぎざぎざに欠ける
  const torn = (x, y, z) => 1.4 * Math.max(0, fbm(x * 0.35, y * 0.35, 4) - 0.1);
  const wings = Disp(U(0.8,
    slab([[46, 40], [30, 22], [12, 14], [4, 22], [6, 36], [18, 46], [40, 48]], 0, 1, "wing", 0.6),
    slab([[50, 40], [66, 22], [84, 14], [92, 22], [90, 36], [78, 46], [56, 48]], 0, 1, "wing", 0.6),
    slab([[44, 48], [26, 52], [14, 64], [20, 72], [34, 68], [44, 58]], -2, 1, "wing", 0.6),
    slab([[52, 48], [70, 52], [82, 64], [76, 72], [62, 68], [52, 58]], -2, 1, "wing", 0.6)), torn);
  const body = U(1.5, ellipsoid([48, 38, 4], [4.4, 5, 4.4], "fuzz"), ellipsoid([48, 48, 3], [5, 7, 4.6], "fuzz"), ellipsoid([48, 62, 2], [4.2, 9, 4], "fuzz"));
  const head = ellipsoid([48, 31, 6], [3.6, 3, 3.4], "fuzz");
  const eyes = [sphere([45.6, 30, 8], 1.6, "eye"), sphere([50.4, 30, 8], 1.6, "eye")];
  const ant = [tube([[46, 28, 7, 0.7], [40, 18, 8, 0.6], [34, 14, 8, 0.3]], "fuzz"), tube([[50, 28, 7, 0.7], [56, 18, 8, 0.6], [62, 14, 8, 0.3]], "fuzz")];
  const legs = [tube([[46, 44, 7, 0.8], [40, 52, 9, 0.6], [38, 58, 9, 0.4]], "fuzz"), tube([[50, 44, 7, 0.8], [56, 52, 9, 0.6], [58, 58, 9, 0.4]], "fuzz")];
  const reedList = [[20, 90, -6, 22, 4], [26, 90, -8, 14, 9], [74, 90, -6, 20, -5], [80, 90, -8, 12, -8]];
  const scene = U(0, bogFloor(48, 96, 40, 12, { n: 1, seed: 9603, wet: 0.2, logs: 0 }), wings, body, head, ...eyes, ...ant, ...legs, ...reeds(reedList));
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  // 翅の目玉模様 (腐った魂の色)
  for (const [cx, cy, rr] of [[20, 30, 6], [76, 30, 6], [28, 62, 3.6], [68, 62, 3.6]]) for (let y = cy - rr; y <= cy + rr; y++) for (let x = cx - rr; x <= cx + rr; x++) {
    const d = Math.hypot(x - cx, y - cy) / rr, p = C.pix[Math.round(y) * 96 + Math.round(x)];
    if (!p || p.m !== "wing" || d > 1) continue;
    C.set(x, y, d < 0.3 ? "#060504" : d < 0.55 ? ROT[3] : d < 0.75 ? ROT[1] : d < 0.9 ? "#524c3c" : "#0a0907");
  }
  // 翅脈
  for (const [x0, y0, x1, y1] of [[46, 42, 10, 18], [46, 42, 6, 32], [50, 42, 86, 18], [50, 42, 90, 32], [46, 52, 18, 68], [50, 52, 78, 68]]) for (let t = 0; t < 1; t += 0.02) C.only(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, "#14120e");
  // 枯死の鱗粉 (下へ降りそそぐ)
  const R = rand(9605);
  for (let i = 0; i < 90; i++) { const x = 10 + R() * 76, y = 40 + R() * 50; if (!C.get(Math.round(x), Math.round(y)) && fbm(x * 0.1, y * 0.05) > -0.2) C.set(x, y, [ROT[1], ROT[2], "#6a634e", ROT[3]][Math.floor(R() * R() * 4)]); }
  reedTips(C, reedList, ["#1f1a10", "#2a2214", "#30291a"]);
  afterimage(C, [[-7, -3, 0.45, "#201d17"], [-14, -6, 0.2, "#14120e"]], [0, 0, 96, 76]);
  scum(C, 9607);
  motes(C, 9609, 10, [2, 2, 92, 30], true);
  return C.toArt();
}
