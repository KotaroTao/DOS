import { sphere, ellipsoid, cone, tube, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { arcParam } from "../arc.mjs";
import { SHELF, SNOW, ICE, RIM, SOUL, FROST, iceFloor, hoarfrost, glints, snowfall, crystal } from "../ice.mjs";
export const meta = { id: "bs_rimecrawler", key: "hd_rimecrawler", w: 96, h: 96,
  note: "霜甲の蟲: 人より大きな、節の重なった丸い大蟲 (ダンゴムシに似る)。鏡のように磨かれた氷の甲殻の節ごとに青白い紋が浮かび、撃ち込まれた呪文はその紋に吸われて砕け散る (魔法抵抗100)。前の節から凍った大顎が突き出し、獲物の体温をすする" };
export function build() {
  const mats = {
    plate: { ramp: ramp(["#020306", "#060b12", "#0c1520", "#142130", "#1e3044", "#2a425a", "#3a5874", "#527290", "#7494ae"], 9), spec: 1.6, pow: 36, specCol: "#d8ecf8", dither: 0.45,
      shade: p => 0.06 * fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5) },
    under: { ramp: ramp(["#030406", "#0a0e14", "#141c26", "#202c3a"], 4), dither: 0.5 },
    mandible: { ramp: ramp(["#05070a", "#16202a", "#2e3e4e", "#506274", "#8098ac"], 5), spec: 1, pow: 30, dither: 0.4 },
    eye: { ramp: [SOUL[2], SOUL[3], SOUL[4]], emit: () => 0.9 },
    shelf: SHELF, snow: SNOW, ice: ICE,
  };
  // 背の弧: 頭 (左) から尾 (右) へ、半円に丸まりかけた節の連なり
  const spine = [[20, 68, 4], [28, 54, 2], [40, 44, 0], [54, 41, -1], [68, 46, -2], [78, 58, -2], [82, 72, -2]];
  const ap = arcParam(spine);
  const body = tube(spine.map((p, i) => [...p, [12, 15, 17, 18, 17, 15, 12][i]]), "plate", { seg: 4, k: 2 });
  // 節の溝で甲殻を区切る
  const segs = Disp(body, (x, y, z) => 1.4 * Math.pow(Math.abs(Math.sin(ap(x, y, z) * Math.PI / 9)), 0.12) - 1.2);
  const plated = Paint(segs, (x, y, z, m) => (y > 70 ? "under" : m));
  const legs = [];
  for (let i = 0; i < 7; i++) { const x = 26 + i * 8.4; legs.push(tube([[x, 72, 8, 1.6], [x - 3, 80, 12, 1.2], [x - 5, 88, 12, 0.7]], "under", { seg: 2 })); }
  const head = ellipsoid([18, 70, 8], [9, 9, 10], "plate", 20);
  const mandibles = [tube([[12, 74, 12, 2.2], [4, 76, 14, 1.6], [2, 70, 14, 0.6]], "mandible"), tube([[14, 78, 6, 2], [6, 84, 8, 1.4], [3, 80, 9, 0.5]], "mandible")];
  const antennae = [tube([[14, 64, 10, 0.8], [6, 54, 12, 0.6], [4, 44, 10, 0.3]], "mandible"), tube([[18, 62, 12, 0.8], [14, 50, 16, 0.6], [16, 40, 16, 0.3]], "mandible")];
  const eyes = [sphere([12, 67, 15], 1.3, "eye"), sphere([16, 66, 17], 1.1, "eye")];
  const scene = U(0, iceFloor(50, 93, 44, 14, { n: 3, seed: 8801, snow: 0.1 }), U(1.5, plated, head), ...legs, ...mandibles, ...antennae, ...eyes);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  // 節ごとの青白い紋 (呪文を吸う)
  for (const [x, y] of [[30, 48], [44, 38], [58, 36], [71, 42], [80, 54]]) crystal(C, x, y, 2.4, SOUL, (X, Y) => !!C.get(Math.round(X), Math.round(Y)));
  // 甲殻に当たって砕け散る呪文の火の粉 (左上から飛んできた光の矢が散る)
  const R = rand(8803);
  for (let t = 0; t < 1; t += 0.05) { const x = 28 + t * 14, y = 14 + t * 20; if (!C.get(Math.round(x), Math.round(y))) C.set(x, y, SOUL[Math.min(4, 1 + Math.floor(t * 4))]); }
  for (let i = 0; i < 14; i++) { const a = -Math.PI * (0.15 + R() * 0.8), d = 2 + R() * 9, x = 44 + Math.cos(a) * d, y = 34 + Math.sin(a) * d; if (!C.get(Math.round(x), Math.round(y))) C.set(x, y, SOUL[2 + Math.floor(R() * 3)]); }
  hoarfrost(C, ["plate"], { th: 0.55, seed: 15 });
  glints(C, 8805, ["plate"], 7);
  snowfall(C, 8807, 30);
  return C.toArt();
}
