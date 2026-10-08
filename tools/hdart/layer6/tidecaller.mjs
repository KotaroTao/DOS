import { tube, sphere, ellipsoid, cone, cyl, torus, slab, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { fingers } from "../human.mjs";
import { RIM, PHOS, bubbles, motes, dissolve } from "../temple.mjs";
export const meta = { id: "bs_tidecaller", key: "hd_tidecaller", w: 96, h: 96,
  note: "潮を呼ぶ司祭: 高い司教冠をかぶり、骨の顔を海藻の髭に埋めた背教の大司祭の霊。三叉の杖を高く掲げ、杖の先から渦潮が立ちのぼって頭上で大きな波の輪となり、隊全体へ押し寄せる潮の呪文を唱え続ける。法衣の裾は渦巻く水にほどける" };
export function build() {
  const mats = {
    robe: { ramp: ramp(["#040504", "#0b100c", "#131c15", "#1c2a1f", "#26382a", "#324836", "#425a44"], 7), spec: 0.6, pow: 22, specCol: "#88a890", dither: 0.6, amb: 0.2,
      shade: p => 0.14 * Math.sin((p.x - 50) * 0.75 + p.y * 0.05) },
    trim: { ramp: ramp(["#060504", "#16120a", "#2a2212", "#423620", "#5e4e30", "#7e6a42"], 6), spec: 1.2, pow: 30, specCol: "#d8c890", dither: 0.45 },
    bone: { ramp: ramp(["#06070a", "#17191c", "#2a2e30", "#424646", "#5c605c", "#787a72", "#96968a"], 7), spec: 0.4, pow: 20, dither: 0.4, amb: 0.22 },
    kelp: { ramp: ramp(["#020302", "#071008", "#0d1c0e", "#152a14", "#1f3a1c"], 5), spec: 0.8, pow: 26, specCol: "#4a6a40", dither: 0.55 },
    coral: { ramp: ramp(["#080303", "#200a08", "#3a140e", "#5a2216", "#7e3422"], 5), spec: 0.6, pow: 20, dither: 0.5 },
    eye: { ramp: [PHOS[1], PHOS[2], PHOS[3], PHOS[4]], emit: p => 0.6 + 0.4 * Math.max(0, p.nz) },
    water: { ramp: ramp(["#06141c", "#0c2430", "#143648", "#1e4a60", "#2c6278", "#407e92", "#5e9cac", "#8ac0c8"], 8), spec: 1.2, pow: 30, specCol: "#d0f4f4", dither: 0.6, amb: 0.3,
      shade: p => 0.18 * Math.sin(Math.atan2(p.z, p.x - 34) * 3 + p.y * 0.5) },
    hole: { ramp: ["#000000", "#000000", "#020304"], amb: 0, dif: 0.05, noRim: true },
  };
  const cx = 52;
  // 司教冠 (高く割れた冠) と骨の顔
  const mitre = U(0.6, Sub(cone([cx, 22, 0], [cx, 6, 0], 6.4, 2.6, "trim"), cyl([cx, 4, 0], [cx, 13, 0], 0.9, "hole"), 0.3), cyl([cx, 22.4, 0], [cx, 20.4, 0], 6.8, "trim", 0.6));
  const mitreFace = (x, y, z, m) => m === "trim" && y < 20 && z > 2 && Math.abs(x - cx) > 1.6 ? "robe" : m;
  const skull = U(1, ellipsoid([cx, 26, 2], [5.4, 5.6, 5], "bone"), ellipsoid([cx, 31, 3], [3.6, 2.4, 3.4], "bone"));
  const holes = U(0, ellipsoid([cx - 2.2, 25.6, 6.4], [1.6, 1.5, 1.4], "hole"), ellipsoid([cx + 2.2, 25.6, 6.4], [1.6, 1.5, 1.4], "hole"), ellipsoid([cx, 28.4, 6.8], [0.7, 0.9, 1], "hole"));
  const eyes = [sphere([cx - 2.2, 25.8, 5.6], 0.8, "eye"), sphere([cx + 2.2, 25.8, 5.6], 0.8, "eye")];
  // 海藻の髭と、肩の飾りの珊瑚
  const R = rand(821), beard = [];
  for (let i = 0; i < 7; i++) { const x = cx - 4 + i * 1.3, L = 10 + R() * 9; beard.push(tube([[x, 31, 5, 1.2], [x + (R() - 0.5) * 2, 31 + L * 0.5, 6, 1], [x + (R() - 0.5) * 3, 31 + L, 5.6, 0.4]], "kelp", { seg: 2 })); }
  const corals = [tube([[cx - 10, 35, 1, 1.2], [cx - 13, 30, 2, 0.9], [cx - 12, 26, 2, 0.5]], "coral"), tube([[cx - 12, 32, 2, 0.7], [cx - 16, 30, 3, 0.4]], "coral"), tube([[cx + 10, 35, 1, 1.2], [cx + 13, 31, 2, 0.8]], "coral")];
  // 法衣: 前の帯 (金茶)、袖は大きく広がる
  const robe = Disp(U(2.2, ellipsoid([cx, 39, 0], [11, 6.4, 7], "robe"), cone([cx, 42, 0], [cx + 2, 86, 0], 9.6, 16, "robe")),
    (x, y, z) => 0.9 * Math.sin(Math.atan2(z, x - cx) * 7 + y * 0.06) * Math.max(0, (y - 46) / 30));
  const band = (x, y, z, m) => m === "robe" && Math.abs(x - cx - (y - 40) * 0.04) < 2.4 && z > 4 && y > 38 ? "trim" : m;
  // 杖を掲げる腕 (左) と、前へ差し出す掌 (右)
  const armL = Disp(cone([cx - 9, 37, 1], [cx - 18, 24, 6], 3.4, 4.6, "robe"), (x, y, z) => 0.3 * Math.sin(y * 1.2));
  const handL = ellipsoid([cx - 19, 22, 7], [2, 2.4, 2], "bone");
  const armR = Disp(cone([cx + 9, 38, 1], [cx + 17, 48, 8], 3.4, 4.8, "robe"), (x, y, z) => 0.3 * Math.sin(y * 1.2));
  const handR = U(0.6, ellipsoid([cx + 18, 50, 9], [2, 2.2, 1.8], "bone"), ...fingers([cx + 18.5, 50.5, 9], 60, "bone", { n: 4, len: 4, spread: 20, r: 0.55, curl: 0.2 }));
  // 三叉の杖: 腕から下は床まで、上は三つ叉
  const staffX = cx - 19;
  const staff = U(0.3, cyl([staffX, 84, 7], [staffX, 10, 7], 0.9, "trim"), tube([[staffX, 12, 7, 0.7], [staffX - 4, 9, 7, 0.6], [staffX - 4.6, 3, 7, 0.4]], "trim"), tube([[staffX, 12, 7, 0.7], [staffX + 4, 9, 7, 0.6], [staffX + 4.6, 3, 7, 0.4]], "trim"), cyl([staffX, 12, 7], [staffX, 1, 7], 0.7, "trim"));
  // 杖から立ちのぼる渦潮 (螺旋の水の帯)
  const spiral = [];
  for (let k = 0; k <= 24; k++) { const t = k / 24, a = t * Math.PI * 4; spiral.push([staffX + Math.cos(a) * (2.5 + t * 7), 30 - t * 18, 7 + Math.sin(a) * (2.5 + t * 7), 1.2 + t * 1.4]); }
  const vortex = Disp(tube(spiral, "water", { seg: 2 }), (x, y, z) => 0.3 * fbm(x * 0.4, y * 0.4, z * 0.4));
  // 頭上の大きな波の輪 (隊全体へ押し寄せる潮の呪文): 傾いた水の環の上に波頭が立つ
  const ring = Disp(torus([50, 9, -6], 31, 1.9, "water", 0, -12), (x, y, z) => -1.6 * Math.max(0, Math.sin(Math.atan2(z + 4, x - 48) * 7)) * (y < 12 ? 1 : 0.3) + 0.3 * fbm(x * 0.3, y * 0.3, z * 0.3));
  const crests = [];
  for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2 + 0.2, x = 48 + Math.cos(a) * 30, z = -4 + Math.sin(a) * 30; crests.push(Disp(cone([x, 8 + Math.sin(a) * 3, z], [x + Math.sin(a) * 3, 3 + Math.sin(a) * 3, z - Math.cos(a) * 3], 2.6, 0.6, "water"), (X, Y, Z) => 0.3 * fbm(X * 0.5, Y * 0.5, Z * 0.5))); }
  const priest = U(0, ring, Paint(mitre, mitreFace), Sub(skull, holes, 0.3), ...eyes, ...beard, ...corals, Paint(U(1.2, robe, armL, armR), band), handL, handR, staff, vortex);
  const r = render(priest, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [staffX, 14, 16], r: 24, k: 0.4 }] });
  const C = new Canvas(r);
  const Wc = mats.water.ramp;
  // 掌の前の水の玉
  C.disc(cx + 24, 52, 2.6, Wc[3]); C.disc(cx + 23.6, 51.6, 1.6, Wc[5]); C.set(cx + 23, 51, Wc[7]);
  // 裾は渦巻く水にほどける
  dissolve(C, 70, 94, { seed: 9, x0: 30, x1: 80, darken: mats.robe.ramp });
  for (let a = 0; a < Math.PI * 2; a += 0.012) { const X = Math.round(cx + 2 + Math.cos(a) * 20), Y = Math.round(84 + Math.sin(a) * 5); if (!C.get(X, Y) && Math.sin(a * 6) > -0.3) C.set(X, Y, Wc[Math.sin(a) > 0 ? 4 : 2]); }
  C.set(cx - 3, 25, PHOS[4]); C.set(cx + 1, 25, PHOS[4]);
  bubbles(C, 823, 10);
  motes(C, 825, 8, undefined, true);
  return C.toArt();
}
