import { sphere, ellipsoid, cone, tube, slab, U, Sub, Disp, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { SHELF, SNOW, ICE, RIM, SOUL, FROST, iceFloor, hoarfrost, glints, snowfall, afterimage } from "../ice.mjs";
export const meta = { id: "bs_snowmantis", key: "hd_snowmantis", w: 96, h: 96,
  note: "霜の大カマキリ: 人の背丈ほどもある、白く霜をまとった大カマキリ。研ぎ澄まされた氷の鎌を二本ともふりかぶり、三角の頭をかしげて獲物を見すえる。薄い翅は氷の膜のように透け、目にも止まらぬ速さで動くので、体の後ろに白い残像がいくつも尾を引く (神速)" };
export function build() {
  const mats = {
    chitin: { ramp: ramp(["#030406", "#0a0f14", "#141c26", "#202c3a", "#30404f", "#445868", "#5c7282", "#7a90a0"], 8), spec: 0.8, pow: 24, specCol: "#c8dce8", dither: 0.5 },
    blade: { ramp: ramp(["#06101c", "#123050", "#24507a", "#3e78a4", "#6aa4c8", "#b4dcf0"], 6), spec: 1.6, pow: 50, specCol: "#f0faff", dither: 0.35 },
    wing: { ramp: ramp(["#060a10", "#0e1824", "#18283a", "#243a50"], 4), dither: 0.7, amb: 0.3 },
    eye: { ramp: [SOUL[1], SOUL[3], SOUL[4]], emit: p => 0.5 + 0.5 * Math.max(0, p.nz) },
    shelf: SHELF, snow: SNOW, ice: ICE,
  };
  // 体: 後ろ脚4本で立ち、長い前胸を起こしている (左向き)
  const abdomen = Disp(ellipsoid([70, 64, -2], [18, 8, 8], "chitin", -12), (x, y, z) => 0.6 * Math.abs(Math.sin(x * 0.7)));
  const thorax = tube([[56, 62, 0, 5], [48, 48, 4, 3.8], [42, 32, 8, 3.4], [39, 24, 10, 3]], "chitin");
  const head = U(1.2, ellipsoid([38, 18, 12], [7.4, 5, 4.6], "chitin", 10), cone([36, 20, 14], [34, 27, 15], 3, 1, "chitin"));
  const eyes = [ellipsoid([32, 16, 14], [2.8, 3.2, 3], "eye"), ellipsoid([44, 15, 13], [2.8, 3.2, 3], "eye")];
  const antennae = [tube([[35, 13, 13, 0.5], [28, 5, 12, 0.4], [22, 1, 11, 0.3]], "chitin"), tube([[40, 12, 13, 0.5], [44, 4, 12, 0.4], [50, 1, 11, 0.3]], "chitin")];
  const legs = [];
  for (const [hx, hz, kx, ky, fx] of [[56, 9, 48, 68, 42], [58, -7, 52, 70, 48], [62, 9, 76, 72, 80], [64, -7, 78, 74, 86]]) legs.push(tube([[hx, 62, hz, 2], [kx, ky, hz + 1, 1.7], [fx, 89, hz + 2, 1]], "chitin", { seg: 2 }));
  // 鎌の腕: 胸から前上へ突き上げた太い上腕 (棘つき) と、そこから下へ折れ曲がる大きな氷の鎌
  const scythe = (z, ux, uy, tx, ty) => [tube([[44, 38, z, 3], [ux, uy, z + 2, 3.6]], "chitin"),
    tube([[ux, uy, z + 2, 3.4], [ux - 7, uy + 5, z + 3, 3], [tx, ty, z + 3, 0.5]], "blade", { seg: 4 })];
  const arms = [...scythe(16, 22, 26, 8, 54), ...scythe(4, 28, 22, 16, 50)];
  const wing = Disp(slab([[50, 54], [72, 50], [92, 58], [86, 64], [60, 62]], 4, 0.5, "wing", 0.4), (x, y, z) => 0.1 * Math.sin(x));
  const scene = U(0, iceFloor(56, 93, 40, 13, { n: 3, seed: 9001, snow: 0.1 }), U(1.4, abdomen, thorax, head), ...antennae, ...legs, ...arms, wing, ...eyes);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  // 鎌の内刃のぎざぎざ
  for (const [x0, y0, x1, y1] of [[15, 31, 9, 52], [21, 27, 16, 48]]) for (let t = 0.1; t < 1; t += 0.14) { const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t; C.only(x + 1, y, "#b4dcf0"); }
  hoarfrost(C, ["chitin"], { th: 0.4, seed: 19 });
  glints(C, 9003, ["blade"], 4);
  afterimage(C, [[7, 1, 0.35, "#1e3042"], [14, 2, 0.2, "#132232"]], [0, 0, 60, 86]);
  snowfall(C, 9005, 30);
  return C.toArt();
}
