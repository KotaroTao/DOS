import { tube, sphere, ellipsoid, cone, cyl, torus, slab, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand, fangs, ribbon } from "../sdf.mjs";
import { POOL, MARBLE, RIM, ripples, bubbles, motes, columnDrum } from "../temple.mjs";
export const meta = { id: "bs_shadowdragon", key: "hd_seadrake", w: 96, h: 96,
  note: "深みの海竜: 沈んだ神殿の大水槽に棲みついた、角とひれの長い首の海竜。暗い水面から鎌首をもたげ、鰓のひれを広げて大きく顎を開き、渦巻く潮のブレスを前へ吐きつける。背の鱗に沿って青い発光の点が並び、水面は波立つ" };
export function build() {
  const mats = {
    scale: { ramp: ramp(["#020405", "#05101a", "#0a1a28", "#102636", "#183446", "#224458", "#2e566c", "#3e6c84"], 8), spec: 1.4, pow: 36, specCol: "#a8d8f0", dither: 0.5, amb: 0.2,
      shade: p => (vnoise(p.x * 1.4, p.y * 1.4, p.z * 1.4) > 0.35 ? 0.1 : 0) },
    belly: { ramp: ramp(["#0a0c0a", "#1e2420", "#384038", "#566052", "#788470"], 5), dither: 0.5, amb: 0.25, shade: p => (Math.sin(p.y * 1.4 + p.x * 0.3) > 0.6 ? -0.18 : 0) },
    fin: { ramp: ramp(["#040814", "#0a1428", "#12223e", "#1c3456", "#28486e"], 5), dither: 0.6, amb: 0.3, shade: p => 0.16 * Math.sin(Math.atan2(p.y - 30, p.x - 30) * 12) },
    horn: { ramp: ramp(["#0a0908", "#22201c", "#3e3a32", "#5e584c", "#848070"], 5), spec: 0.8, pow: 24, dither: 0.4 },
    maw: { ramp: ["#000000", "#08020a", "#140612"], amb: 0.1, dif: 0.25, noRim: true },
    eye: { ramp: ["#0a4a5a", "#30b0d0", "#c0f8ff"], emit: p => 0.6 + 0.4 * Math.max(0, p.nz) },
    water: { ramp: ramp(["#04121a", "#0a2230", "#143448", "#1e4a60", "#2c6278", "#407e92", "#5e9cac", "#9ad0d8"], 8), spec: 1.2, pow: 30, specCol: "#e0ffff", dither: 0.7, amb: 0.35, noRim: true,
      shade: p => 0.2 * fbm(p.x * 0.2, p.y * 0.2, p.z * 0.2) },
    pool: POOL, marble: MARBLE,
  };
  // 水面: 暗い水の広がり (床の代わり)。手前に崩れた柱の胴
  const sea = Disp(ellipsoid([48, 90, -2], [48, 4, 18], "pool"), (x, y, z) => 0.4 * Math.sin(x * 0.5 + z * 0.3));
  // 首と胴: 水から右下で立ち上がり、S 字に曲がって左上で頭を前へ突き出す
  const spine = [[84, 92, -6, 7.4], [80, 76, -4, 7.6], [70, 62, -2, 7], [62, 52, 0, 6.4], [58, 42, 2, 5.8], [52, 33, 4, 5.4], [42, 30, 6, 5]];
  const neck = tube(spine, "scale", { seg: 4, k: 1 });
  const bellyPaint = (x, y, z, m) => m === "scale" && z > 4 + 0.15 * Math.max(0, 60 - y) && y > 34 ? "belly" : m;
  // 水から出た背の弧 (うねり) と尾の先
  const hump = tube([[18, 92, -10, 4.6], [24, 80, -10, 5], [32, 78, -10, 4.6], [38, 92, -10, 4]], "scale", { seg: 3 });
  const tailTip = tube([[8, 92, -14, 2.4], [6, 84, -14, 1.6], [10, 78, -14, 0.6]], "scale");
  // 頭: 長い鼻面、開いた顎 (上顎と下顎)、角とひれの冠
  const skull = U(1.4, ellipsoid([39, 28, 6], [9, 6.2, 6.2], "scale", -10), ellipsoid([28, 27.4, 8], [9, 3.8, 4.8], "scale", -12));
  const jaw = ellipsoid([29, 38, 8], [9.4, 2.8, 4.4], "scale", 20);
  const mouth = U(0, ellipsoid([25, 32, 9], [9, 3.4, 6], "maw", 4));
  const horns = [cone([42, 23, 2], [56, 14, -2], 1.8, 0.3, "horn"), cone([40, 23, 7], [52, 12, 6], 1.6, 0.25, "horn")];
  const eye = sphere([36, 25.6, 10.6], 1.2, "eye");
  // ひれ: 頭の後ろの鰓びれ (扇) と、首の背の背びれ
  const frill = [slab([[42, 26], [50, 14], [54, 22], [58, 20], [56, 30], [60, 34], [48, 34]], 1, 0.6, "fin", 0.4, 0.3), slab([[40, 34], [46, 44], [50, 42], [46, 36]], 8, 0.5, "fin", 0.3)];
  const dorsal = [];
  for (let i = 0; i < 6; i++) { const t = i / 5, p = spine[Math.min(5, 1 + Math.floor(t * 4.9))]; dorsal.push(cone([p[0] + 4, p[1] - 3, p[2] - 3], [p[0] + 11, p[1] - 6 + i, p[2] - 4], 2.2, 0.3, "fin")); }
  const dragon = Paint(Sub(U(1.2, neck, skull, jaw), mouth, 0.6), bellyPaint);
  const scene = U(0, sea, columnDrum([66, 93, 8], 3, 6, 14), dragon, ...horns, eye, ...frill, ...dorsal, hump, tailTip);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, bounce: 0.18, lights: [{ p: [16, 32, 20], r: 26, k: 0.5 }] });
  const C = new Canvas(r);
  fangs(C, "maw", 18, 32, { step: 2, top: [2, 3], bot: [2, 3], cols: ["#3a3a34", "#8a8a7a", "#d8d8c8"], seed: 3 });
  // 潮のブレス: 口から前 (左) へ広がる渦巻く水の流れ
  const Wc = mats.water.ramp, R = rand(901);
  for (let j = 0; j < 16; j++) {
    const sp = j / 15 * 2 - 1, ph = R() * 6, front = 1 - Math.abs(sp);
    for (let t = 0; t < 1; t += 0.006) {
      const x = 19 - t * 21, y = 34 + sp * (2 + t * 14) + Math.sin(t * 10 + ph) * 1.6 * t;
      const X = Math.round(x), Y = Math.round(y);
      if (X < 0 || C.get(X, Y)) continue;
      if (R() > 0.85 - t * 0.35) continue;
      const k = Math.sin(t * 16 + j * 1.3);
      C.set(X, Y, Wc[Math.max(1, Math.min(7, Math.round(2 + front * 4 + k * 1.2 - t * 1.5)))]);
    }
  }
  for (let i = 0; i < 60; i++) { const t = R(), X = Math.round(14 - t * 14 + (R() - 0.5) * 4), Y = Math.round(34 + (R() - 0.5) * (6 + t * 34)); if (X >= 0 && !C.get(X, Y)) C.set(X, Y, Wc[R() < 0.3 ? 7 : 4]); }
  // 背の発光の点
  for (let k = 0; k < 7; k++) { const p = spine[Math.min(6, k)]; const X = Math.round(p[0] + 3.4), Y = Math.round(p[1] - 3.4); if (C.get(X, Y)) { C.set(X, Y, "#30b0d0"); C.set(X + 1, Y, "#0a4a5a"); } }
  // 首の立ち上がる水面の波と白い泡
  for (const [cx, rx] of [[82, 12], [28, 13]]) for (let a = 0; a < Math.PI; a += 0.03) { const X = Math.round(cx + Math.cos(a) * rx), Y = Math.round(90 - Math.sin(a) * 2.4); C.set(X, Y, Wc[Math.sin(a * 6) > 0 ? 7 : 5]); }
  C.set(35, 25, "#c0f8ff");
  ripples(C, 903, ["#1b3438", "#2c5054", "#8ac0c8"]);
  bubbles(C, 905, 8);
  motes(C, 907, 8);
  return C.toArt();
}
