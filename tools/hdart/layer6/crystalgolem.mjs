import { tube, sphere, ellipsoid, cone, cyl, box, slab, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { FLAG, POOL, MARBLE, RIM, templeFloor, ripples, bubbles, motes, tri } from "../temple.mjs";
export const meta = { id: "bs_crystalgolem", key: "hd_crystalgolem", w: 96, h: 96,
  note: "水晶の巨像: 祭壇の水晶が寄り集まって立ち上がった巨像。角張った結晶の塊を積んだ体は透けるように青白く、胸の芯に冷たい光を宿す。肩と背からは鋭い結晶の柱が突き出す。刃は面にすべって通らないが、魔の力を受けると細かなひびが走る" };
export function build() {
  const mats = {
    cry: { ramp: ramp(["#05101a", "#0a1c2c", "#12283e", "#1c3852", "#284a66", "#365e7c", "#487494", "#5e8eac", "#7aaac4", "#a2cce0"], 10), spec: 1.8, pow: 40, specCol: "#e8faff", dither: 0.35, amb: 0.3,
      shade: p => 0.2 * Math.round(Math.sin(p.x * 0.9 + p.y * 0.4) * 2) / 2 + 0.1 * Math.round(Math.sin(p.y * 0.7 - p.z * 0.8) * 2) / 2 },
    core: { ramp: ["#2a5070", "#5aa0d0", "#a8e0ff", "#f0ffff"], emit: p => 0.5 + 0.5 * Math.max(0, p.nz) },
    flag: FLAG, pool: POOL, marble: MARBLE,
  };
  // 結晶の塊: 角張った箱を傾けて積む (面がはっきりと立つよう角丸は小さく)
  const blk = (c, h, rot, mat = "cry") => Disp(box(c, h, mat, 0.6, rot), (x, y, z) => 0.15 * vnoise(x * 0.5, y * 0.5, z * 0.5));
  const torso = U(0.4, blk([48, 44, 0], [11, 12, 8], 6), blk([48, 60, 0], [8, 6, 6.5], -4));
  const head = blk([47, 25, 3], [5.6, 5.4, 5], 10);
  const shoulders = [blk([33, 35, 1], [7, 6, 6.4], -18), blk([63, 35, 1], [7, 6, 6.4], 22)];
  const arms = [blk([27, 49, 3], [4.6, 8, 4.6], 10), blk([25, 64, 5], [5.6, 7, 5.4], -6), blk([69, 49, 3], [4.6, 8, 4.6], -12), blk([72, 64, 5], [5.6, 7, 5.4], 8)];
  const legs = [blk([40, 75, 1], [5.6, 9, 5.6], 4), blk([57, 75, 1], [5.6, 9, 5.6], -4), blk([39, 86, 4], [7, 2.6, 6.4], 0), blk([58, 86, 4], [7, 2.6, 6.4], 0)];
  // 突き出す結晶の柱 (肩と背)
  const spires = [];
  for (const [x0, y0, x1, y1, r] of [[30, 30, 22, 10, 3], [34, 30, 32, 6, 2.6], [64, 30, 72, 8, 3], [60, 30, 62, 12, 2.2], [52, 34, 56, 14, 2.2], [42, 34, 40, 16, 2], [24, 58, 14, 52, 1.8], [74, 58, 84, 54, 1.8]]) {
    spires.push(cone([x0, y0, -3], [x1, y1, -4], r, 0.15, "cry"));
  }
  const coreGem = Disp(ellipsoid([48, 44, 8.6], [3.4, 4.6, 1.8], "core"), (x, y, z) => 0.2 * Math.abs(Math.sin(x * 2)));
  const eye = box([47, 25.4, 8.6], [3.4, 0.7, 0.6], "core", 0.2, 10);
  const scene = U(0, templeFloor(48, 91, 44, 14, { n: 4, seed: 863, cols: 1 }), torso, head, ...shoulders, ...arms, ...legs, ...spires, coreGem, eye);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, bounce: 0.2, inner: 2.2, lights: [{ p: [48, 44, 18], r: 22, k: 0.4 }] });
  const C = new Canvas(r);
  // 面の稜線のきらめき (明るい斜線) と、芯から走る細いひび (魔に弱い)
  const Cr = mats.cry.ramp;
  for (let y = 1; y < 95; y++) for (let x = 1; x < 95; x++) {
    const p = C.pix[y * 96 + x], q = C.pix[(y - 1) * 96 + x - 1];
    if (p && q && p.m === "cry" && q.m === "cry" && (p.nx - q.nx) ** 2 + (p.ny - q.ny) ** 2 > 0.5 && (x + y) % 2 === 0) C.set(x, y, Cr[8]);
  }
  const R = rand(865);
  for (let i = 0; i < 5; i++) {
    let x = 48, y = 44, a = R() * Math.PI * 2;
    for (let k = 0; k < 12; k++) { x += Math.cos(a) * 1.2; y += Math.sin(a) * 1.2; a += (R() - 0.5) * 0.8; if (C.pix[Math.round(y) * 96 + Math.round(x)]?.m === "cry") C.set(x, y, k < 6 ? "#a8e0ff" : "#5aa0d0"); }
  }
  ripples(C, 867);
  bubbles(C, 869, 8);
  motes(C, 871, 10, undefined, true);
  return C.toArt();
}
