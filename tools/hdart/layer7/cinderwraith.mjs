import { sphere, ellipsoid, cone, tube, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { fingers } from "../human.mjs";
import { RIM, EMBER, embers } from "../lava.mjs";
export const meta = { id: "bs_cinderwraith", key: "hd_cinderwraith", w: 96, h: 96,
  note: "燃え殻の亡霊: 焼け焦げた死に装束のような布をまとって宙に浮く亡霊。布の縁は燃えさしのように赤く光りながら崩れ、ほどけて火の粉に変わる。フードの奥には二つの残り火、伸ばした骨の手は命を吸おうと指を広げ、下半身は煙の尾になって消えている" };
export function build() {
  const mats = {
    cloth: { ramp: ramp(["#020101", "#080505", "#110a09", "#1b110e", "#271813", "#352119"], 6), dither: 0.65, spec: 0.1,
      shade: p => 0.14 * Math.sin(p.x * 0.7 - p.y * 0.25 + 2.5 * fbm(p.x * 0.15, p.y * 0.15, p.z * 0.15)) },
    glow: { ramp: ["#3a0a04", "#7a1a06", "#c43e0c", "#f07a1c", "#ffc04a"], emit: p => 0.25 + 0.55 * Math.max(0, p.nz) + 0.25 * fbm(p.x * 0.5, p.y * 0.5, 3) },
    bone: { ramp: ramp(["#0a0706", "#241c17", "#40342b", "#5e4f42", "#7e6c5c", "#a08c78"], 6), spec: 0.5, pow: 18, dither: 0.5 },
    eye: { ramp: ["#7a1a06", "#f07a1c", "#ffdc7a", "#fff4c4"], emit: p => 0.6 + 0.4 * Math.max(0, p.nz) },
    hole: { ramp: ["#000000", "#030101"], amb: 0, dif: 0.05, noRim: true },
  };
  // 頭巾と肩: 前へ乗り出し、右下へ煙の尾がたなびく
  const hood = U(3, ellipsoid([44, 26, 2], [11, 12, 10], "cloth", -10), cone([46, 18, -2], [52, 8, -6], 7, 1, "cloth"));
  const shoulders = ellipsoid([48, 42, 0], [17, 10, 10], "cloth", 8);
  const robe = tube([[48, 44, 0, 15], [52, 58, -1, 12], [58, 70, -3, 8], [66, 80, -5, 4.6], [76, 86, -6, 2.2], [86, 84, -6, 0.8]], "cloth", { seg: 4, k: 2 });
  // 袖: 前へ伸ばした左腕と、後ろへ下げた右腕
  const sleeveL = tube([[36, 40, 4, 5.5], [26, 46, 9, 4.4], [18, 50, 12, 3.6]], "cloth");
  const sleeveR = tube([[60, 40, -2, 5], [66, 50, -1, 4], [68, 58, 0, 3.2]], "cloth");
  const torn = (x, y, z) => 1.4 * Math.max(0, vnoise(x * 0.35, y * 0.35, z * 0.35)) + 0.5 * fbm(x * 0.2, y * 0.2, z * 0.2);
  const shroud = Disp(U(2.5, hood, shoulders, robe, sleeveL, sleeveR), torn);
  const face = ellipsoid([41, 28, 9], [6.5, 7.5, 5], "hole");
  // 燃えさしの縁: 布の外側寄り (法線が横・下向き) と裾に溶岩色を塗る
  const lit = (x, y, z) => fbm(x * 0.35, y * 0.35, z * 0.35) > 0.28 || (y > 62 && fbm(x * 0.4, y * 0.2, 5) > 0.05);
  const wraith = Paint(Sub(shroud, face, 1.2), (x, y, z, m) => (m === "cloth" && lit(x, y, z)) ? "glow" : m);
  const eyes = [sphere([38.5, 27, 5.5], 1.3, "eye"), sphere([44.5, 27.5, 5], 1.2, "eye")];
  // 骨の手: 指を広げて掴みかかる
  const hand = [sphere([16, 51, 12], 2, "bone"), ...fingers([15, 51, 12], 160, "bone", { n: 4, len: 7, spread: 34, r: 0.75, curl: 0.4, z: 1.5 })];
  const scene = U(0, wraith, ...eyes, ...hand);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [41, 28, 14], r: 14, k: 0.4 }] });
  const C = new Canvas(r);
  // 縁は崩れて欠け、ほどけた所から火の粉が舞い上がる
  const R = rand(7401);
  for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) {
    const p = C.pix[y * 96 + x]; if (!p || p.m === "bone" || p.m === "eye") continue;
    const edge = !C.get(x - 1, y) || !C.get(x + 1, y) || !C.get(x, y + 1);
    if (edge && fbm(x * 0.5, y * 0.5, 9) > 0.1) { C.set(x, y, null); if (R() < 0.3 && y > 4) C.set(x + 1, y - 2 - Math.floor(R() * 3), EMBER[1 + Math.floor(R() * 3)]); }
  }
  C.set(38, 27, "#fff4c4"); C.set(44, 27, "#fff4c4");
  embers(C, 7405, 36, [4, 2, 88, 90]);
  return C.toArt();
}
