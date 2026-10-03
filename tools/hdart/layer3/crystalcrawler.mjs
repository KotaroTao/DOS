import { tube, sphere, ellipsoid, cone, slab, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { GRAVEL, ROCK, RIM, rubble, pebbles, tri, cracks } from "../mine.mjs";
export const meta = { id: "bs_crystalcrawler", key: "hd_crystalcrawler", w: 96, h: 96,
  note: "水晶喰い蟲: 背に鋭い晶の林を生やした巨大な甲虫。黒い甲殻の割れ目から青白い鉱脈の光が漏れ、太い大顎を開いて水晶の欠片を噛み砕く" };
export function build() {
  const mats = {
    shell: { ramp: ramp(["#020203", "#06070a", "#0c0e13", "#13161d", "#1b1f29", "#252a37", "#323848", "#444c60"], 8), spec: 1.6, pow: 50, specCol: "#b8c8e8", dither: 0.45,
      shade: p => 0.08 * fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5) },
    crys: { ramp: ramp(["#03070c", "#08141e", "#0e2232", "#163448", "#204a62", "#2e6680", "#4688a0", "#68aec0", "#a0dce4"], 9), spec: 2.4, pow: 60, specCol: "#e8ffff", dither: 0.35, amb: 0.3,
      shade: p => 0.25 * Math.max(0, p.nx * -0.3 + p.nz * 0.5) },
    vein: { ramp: ["#0e2a34", "#1e5a6a", "#3a98a8", "#7ad8e0"], emit: p => 0.45 + 0.4 * Math.max(0, p.nz) },
    mand: { ramp: ramp(["#020101", "#0a0606", "#160c0a", "#241410", "#341e18", "#482a20"], 6), spec: 1.6, pow: 50, specCol: "#c0a090", dither: 0.4 },
    gravel: GRAVEL, rock: ROCK,
  };
  // 甲殻: 低く幅広い背、前に頭、割れ目に鉱脈の光
  const back = ellipsoid([52, 62, -4], [32, 15, 20], "shell");
  const head = ellipsoid([30, 66, 12], [11, 9, 10], "shell", -10);
  const pron = ellipsoid([38, 60, 6], [13, 10, 13], "shell", -15);
  const shellBody = Paint(Disp(U(2.2, back, head, pron), (x, y, z) => cracks(0.9, 0.28)(x, y, z) + 0.12 * fbm(x * 0.8, y * 0.8, z * 0.8)),
    (x, y, z, m) => (m === "shell" && Math.abs(vnoise(x * 0.14, y * 0.12, z * 0.14) + 0.2 * vnoise(x * 0.5, y * 0.5, z * 0.5)) < 0.045 && y > 52) ? "vein" : m);
  // 背の晶の林: 傾いた六角柱の束
  const crys = [];
  const R = rand(111);
  const spot = [[44, 50, 2, -30, 18], [52, 48, -2, -6, 24], [60, 50, -4, 14, 20], [68, 54, -6, 30, 15], [38, 54, 6, -45, 12], [56, 52, 8, 0, 14], [74, 58, -8, 50, 11], [48, 54, 10, -18, 10], [64, 56, 6, 24, 10]];
  for (const [x, y, z, a, L] of spot) {
    const r = a * Math.PI / 180, tx = x + Math.sin(r) * L, ty = y - Math.cos(r) * L;
    const w = 2.6 + L * 0.08;
    crys.push(cone([x, y, z], [tx, ty, z + (R() - 0.5) * 4], w, 0.25, "crys"));
  }
  // 大顎と脚
  const mand = [tube([[24, 70, 18, 2.4], [16, 72, 22, 1.8], [12, 68, 22, 1.2], [13, 64, 20, 0.4]], "mand", { seg: 3 }), tube([[26, 73, 14, 2.4], [18, 78, 18, 1.8], [12, 77, 18, 1.2], [11, 73, 17, 0.4]], "mand", { seg: 3 })];
  const legs = [];
  for (const [bx, kx, ky, fx, z] of [[34, 22, 70, 18, 14], [46, 40, 72, 36, 16], [62, 66, 72, 70, 14], [74, 86, 70, 90, 8]]) legs.push(tube([[bx, 70, z, 2.4], [kx, ky, z + 2, 1.9], [fx, 88, z + 2, 0.6]], "shell", { seg: 3 }));
  const scene = U(0, rubble(52, 92, 44, 15, { n: 7, seed: 113, big: 3 }), shellBody, ...crys, ...mand, ...legs);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  // 噛み砕かれた晶の欠片と、晶の稜のきらめき
  for (const [x, y] of [[12, 86], [20, 88], [8, 89], [26, 87]]) { C.set(x, y, "#68aec0"); C.set(x + 1, y, "#2e6680"); C.set(x, y - 1, "#a0dce4"); }
  // 眼
  C.set(24, 63, "#7ad8e0"); C.set(25, 63, "#3a98a8");
  pebbles(C, 47, 52, 91, 40);
  return C.toArt();
}
