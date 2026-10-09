import { sphere, ellipsoid, cone, tube, slab, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, rand, fangs } from "../sdf.mjs";
import { RIM, BOLT, sparks, rain, clouds, windStreaks, spikes } from "../storm.mjs";
export const meta = { id: "bs_skydrake", key: "hd_skydrake", w: 96, h: 96,
  note: "蒼天の竜: 雷雲の上の、まだ誰も見たことのない青空の色をした鱗の竜。大きな翼を広げて塔の吹き抜けを舞い、細い首を伸ばして圧し固めた風の息を吐き、隊をまとめて切り裂く (ブレス)。空の色の鱗は板のように厚く、刃をほとんど通さない (物理抵抗75)" };
export function build() {
  const mats = {
    scale: { ramp: ramp(["#020408", "#061020", "#0c1c36", "#14304e", "#1e4468", "#2c5c84", "#3e76a0", "#5a92ba", "#7cb0d2"], 9), spec: 1.2, pow: 34, specCol: "#e0f2ff", dither: 0.5,
      shade: p => 0.07 * Math.sin(p.x * 2.4) * Math.sin(p.y * 2.4) },
    belly: { ramp: ramp(["#0a0c10", "#1e2228", "#363c44", "#525a64", "#727c86", "#98a2ac"], 6), dither: 0.45, amb: 0.26,
      shade: p => -0.12 * (Math.sin(p.y * 1.6) > 0.7 ? 1 : 0) },
    wing: { ramp: ramp(["#020408", "#050c18", "#0a1628", "#10223a", "#183050", "#224066", "#2e527e"], 7), dither: 0.55, amb: 0.24,
      shade: p => 0.14 * (Math.abs(Math.sin(Math.atan2(p.y - 40, p.x - 50) * 5)) - 0.5) },
    horn: { ramp: ramp(["#0e0c08", "#2a261c", "#4e4836", "#7a7258", "#aaa080"], 5), spec: 0.8, pow: 24 },
    maw: { ramp: ["#000000", "#0a0612", "#241430"], amb: 0.05, dif: 0.2, noRim: true },
    eye: { ramp: ["#7a5a10", "#f0c040", "#fff6c0"], emit: () => 0.95 },
  };
  const neckPts = [[54, 50, 0, 7], [44, 40, 4, 5], [36, 32, 8, 4], [28, 28, 10, 3.6]];
  const body = Paint(U(3, ellipsoid([58, 54, 0], [14, 9, 9], "scale", 15), tube(neckPts, "scale"), tube([[68, 60, -2, 6], [80, 70, -4, 4], [88, 82, -6, 2.6], [80, 92, -6, 1.4]], "scale", { seg: 4 })),
    (x, y, z, m) => m === "scale" && z > 4 && y > 44 ? "belly" : m);
  const head = U(1.2, ellipsoid([22, 26, 12], [7, 5, 5.4], "scale", 10), ellipsoid([14, 29, 13], [6, 3, 4], "scale", 18));
  const jaw = ellipsoid([16, 34, 12], [6, 2, 3.6], "scale", 30);
  const maw = ellipsoid([14, 31.6, 15.6], [5.6, 2, 2.4], "maw", 22);
  const horns = [tube([[24, 22, 9, 1.6], [32, 14, 6, 1], [40, 12, 4, 0.3]], "horn"), tube([[22, 22, 14, 1.4], [28, 13, 14, 0.8], [34, 10, 14, 0.3]], "horn")];
  const eye = sphere([21, 24, 16.4], 1.1, "eye");
  // 広げた翼 (前の翼は左下へ、後ろの翼は右上へ)
  const wingF = slab([[52, 50], [40, 52], [24, 60], [8, 72], [16, 74], [12, 82], [24, 80], [24, 88], [36, 80], [42, 86], [48, 72], [58, 64]], 8, 1, "wing", 0.6, 1);
  const wingB = slab([[60, 46], [64, 34], [72, 18], [86, 4], [86, 14], [96, 12], [90, 24], [96, 32], [84, 34], [86, 44], [74, 46], [70, 54]], -8, 1, "wing", 0.6, 1);
  const bonesF = tube([[52, 50, 9, 2.4], [30, 58, 9, 1.6], [8, 72, 9, 0.8]], "scale", { seg: 2 });
  const bonesB = tube([[60, 46, -7, 2.4], [72, 22, -7, 1.6], [86, 4, -7, 0.8]], "scale", { seg: 2 });
  const legs = [tube([[52, 62, 6, 3], [48, 70, 8, 2], [44, 74, 10, 1.4]], "scale"), tube([[64, 62, -4, 3], [64, 72, -2, 2], [60, 76, 0, 1.4]], "scale")];
  const dorsal = spikes([[[46, 38, 0], [48, 32, -2], 1.2], [[54, 46, -2], [58, 40, -4], 1.4], [[64, 48, -4], [70, 42, -6], 1.4], [[74, 56, -4], [80, 52, -6], 1.2]], "horn");
  const scene = U(0, wingB, bonesB, Sub(U(1.4, body, head, jaw, ...legs), maw, 0.3), ...horns, eye, ...dorsal, wingF, bonesF);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [40, 10, 30], r: 40, k: 0.25 }] });
  const C = new Canvas(r);
  fangs(C, "maw", 10, 18, { step: 2, top: [1, 2], bot: [1, 1], cols: ["#4a5060", "#b0b8c8", "#f0f4ff"], seed: 11201 });
  // 圧し固めた風の息 (口から左下へ、渦を巻く筋の束)
  for (let i = 0; i < 6; i++) for (let k = 0; k < 40; k++) {
    const t = k / 40, x = 9 - k * 0.24 + Math.sin(k * 0.4 + i) * (1 + t * 4), y = 34 + k * 0.9 + i * 1.6 * t;
    if (!C.get(Math.round(x), Math.round(y)) && (k + i) % 3) C.set(x, y, t < 0.4 ? "#b4d6f0" : t < 0.7 ? "#6a96c0" : "#36587e");
  }
  windStreaks(C, 11203, 16, [0, 0, 96, 96], { cols: ["#10182a", "#1c2a44", "#2e4466"] });
  clouds(C, [[70, 90, 26, 6]], { dens: 0.6, seed: 14 });
  rain(C, 11205, 30);
  sparks(C, 11207, 6);
  return C.toArt();
}
