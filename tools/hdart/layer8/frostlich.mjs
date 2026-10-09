import { sphere, ellipsoid, cone, tube, cyl, torus, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { fingers } from "../human.mjs";
import { SHELF, SNOW, ICE, RIM, SOUL, FROST, iceFloor, hoarfrost, icicles, snowfall, crystal } from "../ice.mjs";
export const meta = { id: "bs_frostlich", key: "hd_frostlich", w: 96, h: 96,
  note: "氷結の死霊術師: 氷に閉じ込められた魂を掘り出して使う術師の骸。霜の付いた濃紺の法衣に、氷の棘を冠にした頭蓋。片手で吊り下げた鳥籠のような灯籠には、捕らえた魂がいくつも青く灯り (氷霊を呼ぶ)、もう片手の前では隊の加護を断ち切る禍言の輪がひび割れて砕け散る (打ち消し)" };
export function build() {
  const mats = {
    robe: { ramp: ramp(["#020306", "#060a12", "#0c1220", "#141c2e", "#1e283e", "#2a3650", "#3a4864"], 7), dither: 0.6, spec: 0.15,
      shade: p => 0.14 * Math.sin(p.x * 0.8 + 2.4 * fbm(p.x * 0.12, p.y * 0.08, p.z * 0.12)) },
    bone: { ramp: ramp(["#0a0c0e", "#20262c", "#384048", "#56606a", "#78848c", "#9eaab0", "#c4d0d4"], 7), spec: 0.5, pow: 18, dither: 0.5 },
    iron: { ramp: ramp(["#030303", "#0e1014", "#1e2228", "#30363e", "#4a525c"], 5), spec: 1, pow: 26, specCol: "#a8b4c0", dither: 0.4 },
    soul: { ramp: SOUL, noRim: true, emit: p => 0.4 + 0.55 * Math.max(0, p.nz) },
    hole: { ramp: ["#000000", "#010204"], amb: 0, dif: 0.1, noRim: true },
    eye: { ramp: [SOUL[2], SOUL[3], SOUL[4]], emit: () => 0.9 },
    ice: ICE, shelf: SHELF, snow: SNOW,
  };
  const robe = Disp(U(3, ellipsoid([48, 40, 0], [12, 9, 8], "robe"), cone([48, 42, 0], [48, 86, -1], 11, 19, "robe"), ellipsoid([48, 86, -1], [19, 3, 13], "robe")),
    (x, y, z) => 0.6 * Math.abs(Math.sin(x * 0.55 + 1.5 * fbm(x * 0.1, y * 0.1))) * Math.min(1, Math.max(0, (y - 50) / 20)) + 0.2 * fbm(x * 0.5, y * 0.5, z * 0.5));
  const hood = Sub(ellipsoid([48, 29, 0], [9, 10, 8], "robe"), ellipsoid([48, 28, 7], [6.5, 8, 6], "robe"), 1);
  const skull = ellipsoid([48, 27, 3], [5, 6, 5], "bone");
  const jaw = ellipsoid([48, 32.5, 4.5], [3.6, 2.2, 3.4], "bone");
  const sockets = U(0, ellipsoid([46, 26.5, 8], [1.6, 1.4, 2], "hole"), ellipsoid([50.2, 26.5, 8], [1.6, 1.4, 2], "hole"), ellipsoid([48, 29.4, 8], [0.9, 1.1, 2], "hole"));
  // 氷の棘の冠
  const crown = []; for (let i = 0; i < 7; i++) { const a = -2.6 + i * 0.36, x = 48 + Math.cos(a) * 5.4, y = 22 + Math.sin(a) * 3; crown.push(cone([x, y, 3 + Math.sin(a + 1.57) * 2], [x + Math.cos(a) * 3, y - 6 - (i === 3 ? 4 : i % 2 ? 0 : 2), 2], 1.2, 0.2, "ice")); }
  // 左手 (画面左) に魂の灯籠、右手 (画面右) は禍言の輪へかざす
  const sleeveL = tube([[40, 40, 3, 4.4], [32, 48, 6, 4.6], [28, 52, 8, 5.2]], "robe");
  const sleeveR = tube([[56, 40, 2, 4.4], [64, 44, 6, 4.2], [70, 42, 8, 4.4]], "robe");
  const handL = [sphere([27, 55, 9], 1.8, "bone"), ...fingers([27, 55, 9], 90, "bone", { n: 3, len: 4, spread: 20, r: 0.6, curl: 0.3, z: 1 })];
  const handR = [sphere([73, 41, 9], 1.8, "bone"), ...fingers([73, 41, 9], 0, "bone", { n: 4, len: 5, spread: 50, r: 0.6, curl: 0.3, z: 1 })];
  const chainL = cyl([27, 57, 9], [24, 64, 10], 0.4, "iron");
  const cage = U(0.6, torus([22, 66, 10], 6, 0.6, "iron", 0, 0), torus([22, 78, 10], 6, 0.6, "iron", 0, 0), ...[0, 1, 2, 3, 4, 5].map(i => { const a = i / 6 * Math.PI * 2; return cyl([22 + Math.cos(a) * 6, 66, 10 + Math.sin(a) * 6], [22 + Math.cos(a) * 6, 78, 10 + Math.sin(a) * 6], 0.5, "iron"); }), cone([22, 66, 10], [24, 63, 10], 5, 0.6, "iron"));
  const souls = [sphere([20, 70, 10], 2.2, "soul"), sphere([24, 74, 11], 1.8, "soul"), sphere([21, 76, 8], 1.4, "soul")];
  const eyes = [sphere([46, 26.8, 7], 0.8, "eye"), sphere([50.2, 26.8, 7], 0.8, "eye")];
  const scene = U(0, iceFloor(50, 93, 42, 13, { n: 3, seed: 9401, snow: 0.08 }), U(1.2, robe, hood, sleeveL, sleeveR), Sub(U(1, skull, jaw), sockets, 0.3), ...crown, ...handL, ...handR, chainL, cage, ...souls, ...eyes);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [22, 72, 16], r: 22, k: 0.4 }] });
  const C = new Canvas(r);
  // 禍言の輪: ひび割れて砕ける (右手の先)
  const RN = rand(9403);
  for (let a = 0; a < Math.PI * 2; a += 0.05) {
    const broken = Math.sin(a * 3 + 1) > 0.55; const rr = 9 + (broken ? RN() * 4 : 0);
    const x = 84 + Math.cos(a) * rr * 0.45, y = 40 + Math.sin(a) * rr;
    if (!C.get(Math.round(x), Math.round(y)) && (!broken || RN() < 0.5)) C.set(x, y, SOUL[broken ? 1 : 3]);
  }
  for (let i = 0; i < 10; i++) { const x = 84 + (RN() - 0.3) * 14, y = 40 + (RN() - 0.5) * 22; if (!C.get(Math.round(x), Math.round(y))) C.set(x, y, SOUL[2 + Math.floor(RN() * 2)]); }
  crystal(C, 84, 40, 3);
  hoarfrost(C, ["robe"], { th: 0.35, seed: 25 });
  icicles(C, 9405, ["robe"], 0.1, 3);
  snowfall(C, 9407, 30);
  return C.toArt();
}
