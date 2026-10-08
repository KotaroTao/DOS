import { tube, sphere, ellipsoid, cone, cyl, torus, slab, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { fingers } from "../human.mjs";
import { RIM, bubbles, motes } from "../temple.mjs";
export const meta = { id: "d04_grudge", key: "hd_grudge", w: 96, h: 96,
  note: "供物盗りの怨霊: 神殿の供物を盗んで溺れた者たちの妄執が凝った黒紫のもや。痩せた顔は欲に歪んで口を裂き、黄の眼をぎらつかせる。片手に黄金の聖杯を抱え込み、もう片手の長い爪を前へ伸ばして懐を探る。抱えた聖杯から金貨がこぼれ、尾はもやにほどけて宙に浮く" };
export function build() {
  const mats = {
    mist: { ramp: ramp(["#040306", "#0a0810", "#120e1a", "#1a1426", "#241c34", "#302644", "#3e3256"], 7), dither: 0.7, amb: 0.22,
      shade: p => 0.16 * fbm(p.x * 0.25, p.y * 0.25, p.z * 0.25) + 0.08 * Math.sin(p.y * 0.6 + p.x * 0.2) },
    bone: { ramp: ramp(["#06050a", "#16131c", "#28232e", "#3e3746", "#584e60", "#74697c", "#928898"], 7), spec: 0.4, pow: 20, dither: 0.45, amb: 0.22 },
    gold: { ramp: ramp(["#080502", "#1e1206", "#38220a", "#583610", "#7c4e18", "#a46c24", "#cc9238", "#ecbc58"], 8), spec: 1.6, pow: 34, specCol: "#fff0b0", dither: 0.4, amb: 0.2 },
    eye: { ramp: ["#5a4a08", "#c8a018", "#fff070"], emit: p => 0.5 + 0.5 * Math.max(0, p.nz) },
    hole: { ramp: ["#000000", "#000000", "#020104"], amb: 0, dif: 0.05, noRim: true },
  };
  // 頭: 前へ突き出した痩せた顔。頬はこけ、口が耳まで裂ける
  const skull = U(1.2, ellipsoid([44, 28, 4], [6.4, 7, 6], "bone", -12), ellipsoid([46, 35, 6], [4.6, 3.2, 4.4], "bone", -12));
  const holes = U(0, ellipsoid([41.5, 27, 9.4], [2, 1.6, 1.6], "hole"), ellipsoid([47.5, 26.4, 9.4], [2, 1.6, 1.6], "hole"),
    Disp(ellipsoid([45.5, 35.4, 9.2], [5, 1.8, 2], "hole", -8), (x, y, z) => 0.4 * Math.sin(x * 2.4)));
  const eyes = [sphere([41.6, 27.1, 8.6], 1, "eye"), sphere([47.4, 26.5, 8.6], 1, "eye")];
  // もやの体: 肩から下は渦を巻いて尾へ細る
  const body = Disp(U(4, ellipsoid([46, 44, 0], [13, 9, 8], "mist"), ellipsoid([52, 58, -2], [10, 9, 7], "mist"),
    tube([[54, 62, -2, 7], [60, 72, -3, 5], [56, 82, -3, 3.4], [48, 88, -2, 2], [42, 90, -1, 0.8]], "mist", { seg: 4 })),
    (x, y, z) => 1.0 * fbm(x * 0.2, y * 0.2, z * 0.2) + 0.5 * Math.max(0, vnoise(x * 0.5, y * 0.5, z * 0.5)));
  // フードのように頭を包むもや
  const cowl = Disp(ellipsoid([46, 25, -1], [10, 10, 8], "mist", -12), (x, y, z) => 1.2 * fbm(x * 0.3, y * 0.3, z * 0.3));
  const cowlCut = ellipsoid([43, 29, 9], [8, 9, 7], "mist", -12);
  // 前へ伸ばす腕と長い爪 (懐を探る)
  const armF = Disp(tube([[38, 42, 4, 4], [28, 46, 9, 3], [19, 46, 12, 2]], "mist", { seg: 3 }), (x, y, z) => 0.5 * fbm(x * 0.3, y * 0.3, z * 0.3));
  const handF = U(0.6, ellipsoid([17.5, 46, 12.4], [2.2, 2.2, 1.8], "bone"), ...fingers([17, 46, 12.6], 170, "bone", { n: 4, len: 8, spread: 26, r: 0.6, curl: -0.25 }));
  // 聖杯を抱える腕
  const armB = Disp(tube([[56, 42, 2, 4], [62, 52, 7, 3], [56, 58, 11, 2.4]], "mist", { seg: 3 }), (x, y, z) => 0.5 * fbm(x * 0.3, y * 0.3, z * 0.3));
  const handB = U(0.6, ellipsoid([55, 57.5, 12], [2.4, 2.4, 2], "bone"), ...fingers([55, 57.5, 12], 200, "bone", { n: 3, len: 5, spread: 16, r: 0.6, curl: 0.6, z: 1.4 }));
  // 黄金の聖杯: 鉢・節・脚
  const cup = U(0.6, Sub(ellipsoid([50, 51, 12], [5.4, 4.4, 4.6], "gold"), ellipsoid([50, 48.4, 12], [4.6, 3.2, 3.8], "gold"), 0.3), sphere([50, 56.4, 12], 1.6, "gold"),
    cyl([50, 57, 12], [50, 61, 12], 0.9, "gold"), ellipsoid([50, 61.6, 12], [3.4, 0.9, 3], "gold"));
  const coinsIn = [];
  for (const [x, z] of [[48, 11], [50.5, 13], [52.5, 11.5], [49.5, 10]]) coinsIn.push(cyl([x, 47.8, z], [x + 0.4, 46.8, z + 0.5], 1.4, "gold", 0.3));
  const scene = U(0, Sub(U(1.4, body, Sub(cowl, cowlCut, 1), armF, armB), U(0), 0), Sub(skull, holes, 0.3), ...eyes, handF, handB, cup, ...coinsIn);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [50, 48, 22], r: 16, k: 0.4 }] });
  const C = new Canvas(r);
  // 杯からこぼれ落ちる金貨 (縦長の楕円と横の線)
  const G = mats.gold.ramp;
  for (const [x, y, w] of [[54, 64, 1], [52, 69, 0], [55, 74, 1], [51, 79, 0], [56, 84, 1], [46, 87, 0]]) {
    if (w) { C.set(x - 1, y, G[3]); C.set(x, y, G[6]); C.set(x + 1, y, G[4]); C.set(x, y - 1, G[5]); C.set(x, y + 1, G[2]); }
    else { C.set(x, y - 1, G[5]); C.set(x, y, G[7]); C.set(x, y + 1, G[3]); }
  }
  // 杯のきらめき
  C.set(47, 49, "#fff0b0"); C.set(46, 50, G[6]);
  for (const [x, y] of [[44, 44], [57, 46], [50, 41]]) { C.set(x, y, G[6]); C.set(x - 1, y, G[3]); C.set(x + 1, y, G[3]); C.set(x, y - 1, G[3]); C.set(x, y + 1, G[3]); }
  // もやの尾からたなびく筋
  const Rr = rand(721);
  for (let i = 0; i < 40; i++) {
    const a = Rr() * Math.PI * 2, d = 10 + Rr() * 16, x = 52 + Math.cos(a) * d * 1.1, y = 58 + Math.sin(a) * d;
    const X = Math.round(x), Y = Math.round(y);
    if (!C.get(X, Y) && (X + Y) % 2 === 0) C.set(X, Y, Rr() < 0.4 ? "#1a1426" : "#120e1a");
  }
  C.set(41, 26, "#fff070"); C.set(47, 25, "#fff070");
  bubbles(C, 723, 9);
  motes(C, 725, 16);
  return C.toArt();
}
