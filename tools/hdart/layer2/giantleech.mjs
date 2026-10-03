import { tube, sphere, ellipsoid, cone, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, torus, rand } from "../sdf.mjs";
export const meta = { id: "bs_giantleech", key: "hd_giantleech", w: 96, h: 96,
  note: "吸血大蛭: 汚水から鎌首をもたげる肥えた蛭。環節の溝、吸った血で透ける赤黒い腹、正面を向く円い吸盤に三重の歯" };
export function build() {
  const mats = {
    skin: { ramp: ramp(["#060406", "#140a0c", "#261012", "#3c1617", "#58201e", "#7c3428", "#a8583c"], 7), spec: 1.1, pow: 45, specCol: "#e8c8b4", dither: 0.55,
      shade: p => -0.05 },
    belly: { ramp: ramp(["#080405", "#22080b", "#420c12", "#6a1418", "#962222", "#c04a34"], 6), spec: 1.1, pow: 45, specCol: "#ffd0b8", dither: 0.55,
      shade: p => 0.06 * Math.sin(p.x * 0.7 + p.y * 0.2) },
    lip: { ramp: ramp(["#0a0406", "#2a0e10", "#4c1c1a", "#76362a", "#a8644a"], 5), spec: 0.8, pow: 30, specCol: "#f0c8b0", dither: 0.5 },
    maw: { ramp: ["#000000", "#000000", "#14040a", "#2e0810", "#4c1016"], dither: 0.4, amb: 0.2, dif: 0.5 },
    tooth: { ramp: ramp(["#2a221c", "#7a6a52", "#c8bc98", "#f0ead4"], 4), spec: 0.5, pow: 20, specCol: "#ffffff", dither: 0.2 },
    water: { ramp: ramp(["#030506", "#081012", "#101c20", "#1a2c30"], 4), spec: 1.2, pow: 80, specCol: "#4a6a6c", dither: 0.8, amb: 0.5, dif: 0.4, noRim: true },
  };
  const spine = [
    [8, 86, -10, 3], [18, 84, -4, 7], [32, 84, 0, 11], [48, 80, 4, 14], [60, 70, 6, 15], [63, 56, 8, 14], [57, 43, 11, 12.5], [48, 33, 16, 11.5], [44, 25, 22, 11], [45, 21, 26, 11],
  ];
  // 環節の溝: 体軸に沿った位相で深い溝を刻む
  let acc = [0]; for (let i = 1; i < spine.length; i++) acc.push(acc[i - 1] + Math.hypot(spine[i][0] - spine[i - 1][0], spine[i][1] - spine[i - 1][1], spine[i][2] - spine[i - 1][2]));
  const along = (x, y, z) => { // 最寄りの節点から弧長を近似
    let best = 1e9, s = 0;
    for (let i = 0; i < spine.length - 1; i++) {
      const a = spine[i], b = spine[i + 1]; const ex = b[0] - a[0], ey = b[1] - a[1], ez = b[2] - a[2]; const l2 = ex * ex + ey * ey + ez * ez;
      const t = Math.max(0, Math.min(1, ((x - a[0]) * ex + (y - a[1]) * ey + (z - a[2]) * ez) / l2));
      const d = (x - a[0] - ex * t) ** 2 + (y - a[1] - ey * t) ** 2 + (z - a[2] - ez * t) ** 2;
      if (d < best) { best = d; s = acc[i] + t * Math.sqrt(l2); }
    }
    return s;
  };
  const groove = (x, y, z) => { const s = along(x, y, z); const f = Math.abs(Math.sin(s * Math.PI / 4.2)); return 1.5 * Math.pow(1 - f, 3) - 0.3 + 0.25 * fbm(x * 0.4, y * 0.4, z * 0.4); };
  const body = Paint(Disp(tube(spine, "skin", { seg: 6, k: 2 }), groove),
    (x, y, z, m) => (z > 9 && x > 44 && y > 46 && y < 82 && fbm(x * 0.15, y * 0.15) > -0.25) ? "belly" : m);
  const disk = ellipsoid([45, 19, 30], [13, 12, 5.5], "lip", 0, -25);
  const mouth = Sub(U(2.5, body, disk), ellipsoid([45, 18.5, 36.5], [9, 8.2, 6], "maw", 0, -25), 1.2);
  const teeth = [];
  for (const [rx, ry, n, zz, ln] of [[8.6, 7.8, 18, 33.2, 2.6], [6.4, 5.8, 14, 32.0, 2.2], [4.3, 3.9, 10, 30.8, 1.6]]) {
    for (let i = 0; i < n; i++) {
      const a = (i + (n % 4) * 0.25) / n * Math.PI * 2;
      const bx = 45 + Math.cos(a) * rx, by = 18.5 + Math.sin(a) * ry;
      teeth.push(cone([bx, by, zz], [45 + Math.cos(a) * (rx - ln), 18.5 + Math.sin(a) * (ry - ln), zz + 0.8], 0.8, 0.1, "tooth"));
    }
  }
  const water = Disp(ellipsoid([42, 88, -2], [40, 4, 16], "water"), (x, y, z) => 0.25 * Math.sin(Math.hypot(x - 46, (z + 2) * 2.4) * 1.1));
  const scene = U(0, water, mouth);
  const r = render(scene, mats, { w: 96, h: 96, rim: "#4e6470", bounce: 0.06 });
  const C = new Canvas(r);
  // 歯: 吸盤の内縁から中心へ向かう三重の鉤歯 (2D で描く)
  const T = ["#4a3e30", "#7e705a", "#b8aa88", "#e8e0c8"];
  for (const [rx, ry, n, ln, off] of [[8.4, 7.6, 12, 3.2, 0], [4.9, 4.4, 8, 2.2, 0.5]]) {
    for (let i = 0; i < n; i++) {
      const a = (i + off) / n * Math.PI * 2, cx = 45, cy = 18.5;
      const x0 = cx + Math.cos(a) * rx, y0 = cy + Math.sin(a) * ry;
      const x1 = cx + Math.cos(a) * (rx - ln), y1 = cy + Math.sin(a) * (ry - ln);
      const lit = Math.cos(a - 3.9) > 0.2; // 左上の歯ほど明るい
      C.line(x0, y0, x1, y1, lit ? T[2] : T[1]); C.set(x1, y1, lit ? T[3] : T[2]);
    }
  }
  C.disc(45, 19, 1.9, "#000000");
  const drip = "#4a0e12", dripL = "#9a2c24";
  for (const [x, y0, l] of [[37, 29, 6], [41, 31, 9], [52, 30, 4], [55, 27, 7]]) { C.line(x, y0, x, y0 + l, drip); C.set(x, y0 + l + 1, dripL); }
  for (let x = 6; x < 80; x++) { const y = Math.round(88 + 3.4 * Math.sqrt(Math.max(0, 1 - ((x - 42) / 38) ** 2))); if (C.get(x, y) && ((x * 7) % 9) < 4) C.set(x, y, "#2c4446"); }
  return C.toArt();
}
