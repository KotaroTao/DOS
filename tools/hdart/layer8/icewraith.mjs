import { sphere, ellipsoid, cone, tube, box, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { fingers } from "../human.mjs";
import { ICE, SHELF, SNOW, RIM, SOUL, FROST, iceFloor, iceCracks, hoarfrost, glints, snowfall, dissolve } from "../ice.mjs";
export const meta = { id: "bs_icewraith", key: "hd_icewraith", w: 96, h: 96,
  note: "氷霊: 落ちてきて氷に閉じ込められた魂の霊。腰から下はまだ氷の柱に埋まったまま、青白い上半身だけが身をよじって抜け出し、骨ばった手を前へ伸ばす。手の先には、吸い寄せられた小さな魂の灯が尾を引いて流れ込む (魂奪)。くぼんだ眼と口は暗い穴、髪は凍った房になって逆立つ" };
export function build() {
  const mats = {
    ghost: { ramp: ramp(["#03060a", "#0a1420", "#122436", "#1c364e", "#284a66", "#36607e", "#4c7a96", "#6896ac"], 8), dither: 0.6, amb: 0.3,
      shade: p => 0.1 * Math.sin(p.y * 0.7 + p.x * 0.3 + 2 * fbm(p.x * 0.2, p.y * 0.15)) },
    hair: { ramp: ramp(["#040810", "#0e1a28", "#1a2e44", "#2a4660", "#3e607c"], 5), dither: 0.5, spec: 0.6, pow: 20 },
    hole: { ramp: ["#000000", "#010204", "#03070c"], amb: 0, dif: 0.05, noRim: true },
    soul: { ramp: SOUL, noRim: true, emit: p => 0.4 + 0.55 * Math.max(0, p.nz) },
    eye: { ramp: [SOUL[1], SOUL[2], SOUL[3]], emit: () => 0.6 },
    ice: ICE, shelf: SHELF, snow: SNOW,
  };
  // 氷の柱 (腰まで埋まる)
  const pillar = Disp(U(1, box([46, 74, -2], [17, 18, 12], "ice", 3, 4), box([34, 82, 4], [8, 10, 8], "ice", 2, -14), box([60, 80, 2], [9, 12, 8], "ice", 2, 18)), iceCracks(0.8, 0.28));
  // 上半身: 身をよじって左前へ伸び出す
  const torso = Disp(U(2, ellipsoid([46, 52, 0], [11, 10, 8], "ghost", -12), ellipsoid([44, 40, 1], [12, 8, 8], "ghost", -8)), (x, y, z) => 0.3 * fbm(x * 0.4, y * 0.4, z * 0.4));
  const neck = tube([[44, 36, 1, 3.4], [42, 30, 3, 3]], "ghost");
  const head = ellipsoid([40, 23, 4], [6, 7.4, 6], "ghost", -10);
  const jaw = ellipsoid([39, 29, 5.5], [3.8, 3, 3.6], "ghost", -10);
  const holes = U(0, ellipsoid([36.8, 22.6, 9.4], [1.8, 2.2, 1.6], "hole"), ellipsoid([42.6, 22, 9.6], [1.8, 2.2, 1.6], "hole"), ellipsoid([39.2, 30, 8.6], [1.2, 1.8, 1.4], "hole"));
  const eyes = [sphere([36.8, 22.8, 8.6], 0.8, "eye"), sphere([42.6, 22.2, 8.8], 0.8, "eye")];
  // 凍って後ろへなびく髪の長い房
  const hair = [];
  const R = rand(8301);
  for (let i = 0; i < 7; i++) {
    const y0 = 17 + i * 1.6, x0 = 42 + i * 0.6, L = 14 + R() * 10;
    hair.push(tube([[x0, y0, 0, 2.2], [x0 + L * 0.5, y0 - 4 + R() * 3, -3, 1.8], [x0 + L, y0 - 2 + R() * 6, -5, 0.5]], "hair", { seg: 3 }));
  }
  // 腕: 画面左の手を前へ伸ばす、右の腕は柱をつかむ
  const armL = tube([[36, 40, 4, 3.6], [24, 40, 10, 2.8], [14, 36, 14, 2.2]], "ghost", { seg: 3 });
  const handL = [ellipsoid([12, 36, 15], [2.4, 2, 1.8], "ghost"), ...fingers([11, 36, 15], 190, "ghost", { n: 4, len: 7, spread: 50, r: 0.8, curl: 0.4, z: 0.5 })];
  const armR = tube([[56, 42, -1, 3.6], [64, 50, 2, 2.8], [64, 58, 6, 2.2]], "ghost", { seg: 3 });
  const handR = [ellipsoid([64, 59, 7], [2.4, 2.2, 2], "ghost"), ...fingers([64, 60, 7], 90, "ghost", { n: 4, len: 6, spread: 30, r: 0.8, curl: 0.2, z: 0.5 })];
  // 吸い寄せられる魂の灯 (尾を引いて手へ)
  const souls = [U(1.2, sphere([6, 54, 16], 2.6, "soul"), cone([6, 54, 16], [9, 44, 15], 2, 0.4, "soul")), sphere([4, 66, 14], 1.4, "soul")];
  const ghost = Sub(U(1.5, torso, neck, head, jaw, armL, armR, ...handL, ...handR), holes, 0.3);
  const scene = U(0, iceFloor(48, 92, 40, 13, { n: 3, seed: 8303, snow: 0.1 }), pillar, ghost, ...eyes, ...hair, ...souls);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [8, 50, 20], r: 26, k: 0.45 }] });
  const C = new Canvas(r);
  // 魂の灯の光の尾 (手へ吸い込まれる筋)
  for (let t = 0; t <= 1; t += 0.04) { const x = 6 + t * 5, y = 52 - t * 14 + Math.sin(t * 9) * 1.2; if (!C.get(Math.round(x), Math.round(y))) C.set(x, y, SOUL[Math.min(4, 1 + Math.floor(t * 3))]); }
  // 氷柱に埋まった胴の影: 氷の中に霊の色を透かす
  for (let y = 60; y < 90; y++) for (let x = 30; x < 62; x++) { const p = C.pix[y * 96 + x]; if (p && p.m === "ice" && Math.hypot((x - 46) / 11, (y - 62) / 14) < 1 && (x + y) % 2 === 0) C.set(x, y, "#284a66"); }
  // 霊の体は透けて、氷の向こうの闇がまだらに覗く
  for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) { const p = C.pix[y * 96 + x]; if (p && p.m === "ghost" && p.nz < 0.55 && (x + y * 2) % 5 === 0 && fbm(x * 0.2, y * 0.2, 3) > -0.1) C.set(x, y, "#0a1420"); }
  hoarfrost(C, ["ice", "hair"], { th: 0.4, seed: 7 });
  glints(C, 8305, ["ice"], 5);
  snowfall(C, 8307, 34);
  return C.toArt();
}
