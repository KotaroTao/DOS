import { sphere, ellipsoid, cone, tube, slab, U, Sub, render, ramp, Canvas, fbm, rand, fangs } from "../sdf.mjs";
import { RIM, BOLT, sparks, rain, windStreaks, afterimage } from "../storm.mjs";
export const meta = { id: "bs_windscythe", key: "hd_windscythe", w: 96, h: 96,
  note: "風のかまいたち: つむじ風に乗って宙を跳ぶ、イタチに似た細長い魔。両の前足は鎌のような長い刃になっている。体を三日月に反らせて跳びかかり、一度に三度、真空の刃で斬りつける (3連撃)。傷口はあとから開く。風そのものの速さで身をかわし、刃がなかなか届かない (回避)" };
export function build() {
  const mats = {
    fur: { ramp: ramp(["#040306", "#0b090f", "#15111b", "#211b29", "#2e2638", "#3e344a", "#52465e", "#6a5c76"], 8), dither: 0.55, amb: 0.24,
      shade: p => 0.1 * Math.sin(p.x * 1.4 - p.y * 0.8) },
    belly: { ramp: ramp(["#0c0a0e", "#221e26", "#3a3440", "#56505e", "#766e80"], 5), dither: 0.5, amb: 0.3 },
    blade: { ramp: ramp(["#06080e", "#141a28", "#28324a", "#44526e", "#6a7c9c", "#a4b4d0", "#e4ecff"], 7), spec: 1.8, pow: 50, specCol: "#ffffff", dither: 0.35 },
    maw: { ramp: ["#000000", "#16060a", "#3a0e16"], dither: 0.3 },
    eye: { ramp: ["#5a1406", "#e05a18", "#ffd080"], emit: () => 0.95 },
  };
  // 三日月に反った胴 (頭は左上、尾は右下で巻く)
  const spine = [[24, 30, 6, 5], [34, 38, 6, 6], [46, 46, 4, 6.4], [58, 52, 2, 5.6], [70, 54, 0, 4.4], [80, 52, -2, 3.4], [88, 46, -2, 2.6], [90, 38, -2, 1.8], [86, 32, -2, 1.2]];
  const body = tube(spine, "fur", { seg: 4 });
  const belly = tube([[30, 38, 10, 3.6], [42, 48, 8, 4.4], [56, 56, 6, 3.6]], "belly", { seg: 3 });
  const head = U(1, ellipsoid([18, 26, 8], [6.6, 5, 5], "fur", -20), ellipsoid([11, 24, 9], [4.4, 2.6, 3.4], "fur", -10));
  const ears = [cone([20, 22, 4], [22, 15, 2], 1.8, 0.3, "fur"), cone([16, 21, 8], [16, 14, 8], 1.6, 0.3, "fur")];
  const maw = ellipsoid([10, 27, 11.6], [3.6, 1.2, 1.6], "maw", -5);
  const eye = sphere([15.6, 23.4, 12], 0.9, "eye");
  // 鎌の前足 (前へ振り下ろす / 後ろへ振りかぶる)
  const scytheA = U(0.5, tube([[30, 40, 8, 2.2], [24, 50, 10, 1.6]], "fur"), slab([[24, 50], [14, 58], [4, 62], [10, 56], [20, 48]], 10, 0.6, "blade", 0.3));
  const scytheB = U(0.5, tube([[38, 44, -2, 2.2], [40, 32, -2, 1.6]], "fur"), slab([[40, 32], [46, 20], [50, 8], [48, 18], [42, 30]], -2, 0.6, "blade", 0.3));
  const hind = [tube([[62, 56, 4, 2.6], [58, 64, 6, 1.6], [52, 66, 6, 1]], "fur"), tube([[66, 56, -4, 2.4], [68, 64, -4, 1.4], [64, 68, -4, 1]], "fur")];
  const scene = U(0, Sub(U(1.6, body, belly, head, ...ears, ...hind), maw, 0.3), eye, scytheA, scytheB);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  fangs(C, "maw", 7, 12, { step: 2, top: [1, 1], bot: [1, 1], cols: ["#3a3226", "#a09068", "#e0d8b8"], seed: 11701 });
  // 三筋の真空の刃 (斬り跡の白い弧)
  for (const [cx, cy, rr, a0, a1, w] of [[40, 70, 34, 3.6, 5.0, 1], [36, 74, 28, 3.7, 5.1, 1], [32, 78, 22, 3.8, 5.2, 0]]) for (let a = a0; a < a1; a += 0.01) {
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * 0.7, t = (a - a0) / (a1 - a0);
    if (C.get(Math.round(x), Math.round(y))) continue;
    C.set(x, y, t > 0.3 && t < 0.8 ? "#e4ecff" : "#6a7c9c");
    if (w && t > 0.2 && t < 0.9 && !C.get(Math.round(x), Math.round(y) + 1)) C.set(x, y + 1, "#2c3650");
  }
  afterimage(C, [[-6, 4, 0.4, "#14101a"], [-12, 8, 0.22, "#0e0b12"]], [0, 0, 96, 80]);
  // 体をとりまくつむじ風
  for (let a = 0; a < Math.PI * 2; a += 0.02) { const x = 52 + Math.cos(a) * 40, y = 46 + Math.sin(a) * 18 + Math.sin(a * 3) * 3; if (!C.get(Math.round(x), Math.round(y)) && Math.sin(a * 4) > 0) C.set(x, y, Math.sin(a * 4) > 0.7 ? "#4a5278" : "#262a44"); }
  windStreaks(C, 11703, 16, [0, 0, 96, 96]);
  rain(C, 11705, 30, [0, 0, 96, 96], { slope: 1 });
  sparks(C, 11707, 6);
  return C.toArt();
}
