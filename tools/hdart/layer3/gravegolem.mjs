import { tube, sphere, ellipsoid, cone, slab, box, cyl, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { GRAVEL, ROCK, RIM, rubble, pebbles, cracks } from "../mine.mjs";
export const meta = { id: "d04_golem", key: "hd_gravegolem", w: 96, h: 96,
  note: "墓守ゴーレム: 切り石を積み上げて彫り出された直立の番人。目地の通った角張った体、無表情な石の仮面、胸の碑文が青白く灯る。左腕は墓碑を盾に、右の拳は石の槌" };
export function build() {
  const mats = {
    ashlar: { ramp: ramp(["#030303", "#0a0a0b", "#131416", "#1d1e21", "#282a2e", "#35373c", "#44474d", "#575a60", "#6c6f74"], 9), spec: 0.4, pow: 20, specCol: "#9a9ea6", dither: 0.5,
      shade: p => 0.08 * fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5) },
    mortar: { ramp: ramp(["#020202", "#060607", "#0b0b0d", "#111214"], 4), dither: 0.5 },
    mask: { ramp: ramp(["#040404", "#111110", "#1f1e1c", "#2f2d2a", "#423f3a", "#58544d", "#706b62", "#8a847a"], 8), spec: 0.6, pow: 25, specCol: "#b8b0a2", dither: 0.45 },
    glyph: { ramp: ["#0a1e2a", "#1c4a62", "#3a86a8", "#8ad0e8"], emit: p => 0.55 + 0.3 * Math.max(0, p.nz) },
    hole: { ramp: ["#000000", "#000000", "#020203"], amb: 0, dif: 0.1, noRim: true },
    gravel: GRAVEL, rock: ROCK,
  };
  // 目地: 積み石の水平・垂直の溝 (段ごとに半個ずらす)
  const joints = (x, y, z) => { const row = Math.floor(y / 6); const ux = x + (row % 2) * 4; return (((y % 6) + 6) % 6 < 0.6 || (((ux % 8) + 8) % 8) < 0.6) ? 0.45 : 0; };
  const blk = (c, h, rot = 0) => box(c, h, "ashlar", 1, rot);
  const torso = blk([48, 44, 0], [14, 14, 9]);
  const waist = blk([48, 61, -1], [10, 4, 7]);
  const shoulders = [blk([30, 32, 0], [6, 5, 7], 8), blk([66, 32, 0], [6, 5, 7], -8)];
  const arms = [blk([25, 48, 2], [5, 10, 5], 6), blk([71, 48, 2], [5, 10, 5], -6)];
  const legs = [blk([40, 77, 0], [5.5, 11, 6]), blk([56, 77, 0], [5.5, 11, 6])];
  const feet = [blk([40, 89, 3], [7, 2.5, 8]), blk([56, 89, 3], [7, 2.5, 8])];
  const head = blk([48, 23, 2], [6.5, 6.5, 6]);
  const body = Paint(Disp(U(0.8, torso, waist, ...shoulders, ...arms, ...legs, ...feet, head), (x, y, z) => joints(x, y, z) + cracks(0.5, 0.35)(x, y, z) + 0.12 * fbm(x * 0.8, y * 0.8, z * 0.8)),
    (x, y, z, m) => (m === "ashlar" && (((y % 6) + 6) % 6 < 0.6 || (((x + (Math.floor(y / 6) % 2) * 4) % 8 + 8) % 8) < 0.6)) ? "mortar" : m);
  // 無表情な石の仮面: 細い眼の切れ込みと閉じた口
  const mask = Sub(Disp(ellipsoid([48, 23, 8.5], [6, 6.8, 2.5], "mask"), (x, y, z) => 0.1 * fbm(x * 0.9, y * 0.9)), U(0, box([45.2, 21.5, 11], [1.8, 0.5, 2], "hole"), box([50.8, 21.5, 11], [1.8, 0.5, 2], "hole"), box([48, 26.5, 11], [2.2, 0.3, 2], "hole")), 0.3);
  // 左腕の墓碑の盾と、右の石槌
  const stele = Disp(Sub(U(0, box([22, 60, 10], [9, 14, 2.4], "ashlar", 1), cyl([22, 46, 10], [22, 46, 10.1], 9, "ashlar")), box([22, 60, 13.4], [6, 9, 1], "hole"), 0.5), (x, y, z) => 0.2 * fbm(x * 0.5, y * 0.5));
  const steleFace = box([22, 60, 12.6], [6.4, 9.4, 0.4], "ashlar", 0.2);
  const hammer = [blk([74, 66, 4], [7, 6, 6], -6), cyl([72, 56, 4], [74, 62, 4], 2, "ashlar")];
  const scene = U(0, rubble(48, 93, 44, 14, { n: 7, seed: 161, big: 3.2 }), body, mask, stele, steleFace, ...hammer);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  // 胸と墓碑に刻まれた青白い碑文
  const G = ["#1c4a62", "#3a86a8", "#8ad0e8"];
  for (let i = 0; i < 4; i++) { C.line(42 + i * 4, 38, 42 + i * 4, 44 - (i % 2) * 2, G[1]); C.set(42 + i * 4, 37, G[2]); }
  C.line(41, 47, 55, 47, G[0]);
  for (let i = 0; i < 4; i++) C.line(18, 54 + i * 3.5, 26 - (i % 2) * 2, 54 + i * 3.5, G[i === 0 ? 2 : 0]);
  C.set(45, 21, G[2]); C.set(51, 21, G[2]);
  pebbles(C, 71, 48, 92, 40);
  return C.toArt();
}
