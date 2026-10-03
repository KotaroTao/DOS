import { tube, sphere, ellipsoid, cone, slab, cyl, box, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { GRAVEL, ROCK, RIM, rubble, pebbles, tri, cracks } from "../mine.mjs";
export const meta = { id: "bs_gargoyle", key: "hd_gargoyle", w: 96, h: 96,
  note: "ガーゴイル: 崩れた石柱の上にうずくまる有翼の石像。山羊のような角、牙を剥いた獣の顔、蝙蝠の翼を半ば広げ、爪で柱頭をつかむ。石肌は欠けてひび割れ、眼窩に魔除けの残り火" };
export function build() {
  const mats = {
    stone: { ramp: ramp(["#030303", "#0a0a0a", "#131313", "#1d1d1c", "#282826", "#353431", "#44423d", "#55524b", "#6a665c"], 9), spec: 0.4, pow: 20, specCol: "#8a867a", dither: 0.55,
      shade: p => 0.12 * fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5) },
    pillar: { ramp: ramp(["#030303", "#0a0909", "#141312", "#1f1d1b", "#2b2825", "#383430", "#47423c"], 7), spec: 0.2, pow: 15, dither: 0.6,
      shade: p => (Math.abs(((p.x - 48) % 4 + 4) % 4 - 2) < 0.5 ? -0.12 : 0) + 0.08 * fbm(p.x * 0.4, p.y * 0.4) },
    maw: { ramp: ["#000000", "#060505", "#0e0c0b"], amb: 0.2, dif: 0.2, noRim: true },
    eye: { ramp: ["#1a0c00", "#4a2402", "#8a4a0a", "#d08a20"], emit: p => 0.5 + 0.4 * Math.max(0, p.nz) },
    gravel: GRAVEL, rock: ROCK,
  };
  // 崩れた石柱と柱頭
  const pillar = Sub(cyl([48, 72, -2], [48, 92, -2], 13, "pillar", 1), box([60, 72, -2], [6, 4, 16], "pillar", 0, 30), 1);
  const capital = Disp(box([48, 70, -2], [17, 3, 13], "pillar", 1.2), (x, y, z) => cracks(0.8, 0.4)(x, y, z));
  // うずくまる体: 膝を抱えるように前傾、頭は肩より前
  const torso = ellipsoid([48, 50, 0], [12, 13, 10], "stone", 0);
  const head = ellipsoid([48, 32, 10], [8, 7.5, 7.5], "stone");
  const snout = ellipsoid([48, 36, 16], [5.5, 4, 4.5], "stone");
  const brow = ellipsoid([48, 29, 15], [7, 2.2, 3], "stone");
  const horns = [tube([[42, 27, 8, 2.2], [36, 20, 6, 1.6], [37, 13, 4, 1], [41, 10, 3, 0.3]], "stone"), tube([[54, 27, 8, 2.2], [60, 20, 6, 1.6], [59, 13, 4, 1], [55, 10, 3, 0.3]], "stone")];
  const ears = [cone([40, 31, 6], [33, 30, 3], 2, 0.3, "stone"), cone([56, 31, 6], [63, 30, 3], 2, 0.3, "stone")];
  const thighs = [ellipsoid([36, 62, 6], [7, 6, 8], "stone", -20), ellipsoid([60, 62, 6], [7, 6, 8], "stone", 20)];
  const shins = [tube([[34, 64, 12, 3.4], [33, 69, 10, 2.6]], "stone"), tube([[62, 64, 12, 3.4], [63, 69, 10, 2.6]], "stone")];
  const arms = [tube([[38, 42, 4, 4], [30, 52, 10, 3.2], [36, 64, 15, 2.6]], "stone"), tube([[58, 42, 4, 4], [66, 52, 10, 3.2], [60, 64, 15, 2.6]], "stone")];
  const claws = [];
  for (const [hx, hz] of [[36, 15], [60, 15], [33, 11], [63, 11]]) for (let i = 0; i < 3; i++) claws.push(cone([hx - 2 + i * 2, 66, hz], [hx - 2.5 + i * 2.5, 71, hz + 2], 1.2, 0.3, "stone"));
  const tail = tube([[48, 60, -8, 3], [62, 70, -8, 2.4], [70, 80, -4, 1.6], [74, 88, 2, 0.6]], "stone");
  // 翼: 背から立ち上がる骨と、ひだのある石の膜
  const wing = (s) => {
    const X = d => 48 + s * d;
    const bones = [tube([[X(8), 42, -6, 3], [X(20), 26, -8, 2.4], [X(30), 16, -9, 1.6], [X(40), 10, -10, 0.6]], "stone")];
    for (const [fx, fy] of [[40, 26], [42, 40], [36, 52]]) bones.push(tube([[X(29), 17, -9, 1.3], [X(fx), fy, -10, 0.5]], "stone"));
    const memb = slab([[X(9), 44], [X(20), 27], [X(30), 17], [X(40), 11], [X(40), 26], [X(37), 32], [X(42), 40], [X(36), 45], [X(36), 52], [X(26), 52], [X(14), 56]], -10, 1.2, "stone", 0.6);
    return [Disp(memb, (x, y, z) => 0.35 * Math.sin((x * s) * 0.9)), ...bones];
  };
  const gar = Disp(U(1.6, torso, head, snout, brow, ...horns, ...ears, ...thighs, ...shins, ...arms, ...claws, tail), (x, y, z) => cracks(0.7, 0.3)(x, y, z) + 0.15 * fbm(x * 0.9, y * 0.9, z * 0.9));
  const mouth = ellipsoid([48, 39, 20], [3.6, 1.8, 3], "maw");
  const eyes = [sphere([45, 31, 16.5], 1.1, "eye"), sphere([51, 31, 16.5], 1.1, "eye")];
  const scene = U(0, rubble(48, 92, 44, 14, { n: 8, seed: 81, big: 3 }), pillar, capital, Sub(gar, mouth, 0.6), ...eyes, ...wing(-1), ...wing(1));
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  // 牙
  tri(C, [45, 38.5], [46.3, 38.5], [45.6, 41.5], "#6a665c"); tri(C, [49.7, 38.5], [51, 38.5], [50.4, 41.5], "#6a665c");
  // 欠けた石の破片
  pebbles(C, 29, 48, 91, 40);
  return C.toArt();
}
