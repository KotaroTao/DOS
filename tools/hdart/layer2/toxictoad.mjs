import { tube, sphere, ellipsoid, cone, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { WATER, puddle, ripples, RIM } from "../lib.mjs";
export const meta = { id: "bs_toxictoad", key: "hd_toxictoad", w: 96, h: 96,
  note: "毒吐き大蛙: 斜め前を向いてうずくまる疣だらけの大蛙。黄緑に透けて膨れた喉袋、目の後ろの毒腺、口の端から垂れる毒涎" };
export function build() {
  const mats = {
    skin: { ramp: ramp(["#040503", "#0e1108", "#1a1f0c", "#2a3012", "#3e4118", "#585624", "#7a7236"], 7), spec: 0.8, pow: 35, specCol: "#c8c890", dither: 0.55 },
    wart: { ramp: ramp(["#080804", "#24220c", "#423c14", "#665a1c", "#8e7c2c", "#b4a050"], 6), spec: 0.6, pow: 30, specCol: "#e4dc9c", dither: 0.4 },
    gland: { ramp: ramp(["#0c0804", "#2c1c06", "#56360c", "#865412", "#b07822", "#d8a848"], 6), spec: 1.0, pow: 40, specCol: "#ffe8a0", dither: 0.4 },
    belly: { ramp: ramp(["#080806", "#1e1e14", "#3a3826", "#5a563c", "#7c7656", "#9e9672"], 6), spec: 0.5, pow: 30, dither: 0.6 },
    sac: { ramp: ramp(["#080c04", "#142008", "#24360c", "#385212", "#52701a", "#729028", "#a0bc48"], 7), spec: 1.3, pow: 50, specCol: "#e4f4b0", dither: 0.5, amb: 0.22,
      shade: p => 0.1 * Math.max(0, Math.sin(p.y * 1.3 + fbm(p.x * 0.3, p.y * 0.3) * 4)) - 0.03 },
    eye: { ramp: ramp(["#0a0400", "#3a1800", "#7a3600", "#c06008", "#f0a020"], 5), spec: 1.4, pow: 60, specCol: "#fff4d0", dither: 0.3, amb: 0.45 },
    water: WATER,
  };
  const bump = (x, y, z) => { const n = vnoise(x * 0.42, y * 0.42, z * 0.42); return -Math.max(0, n - 0.3) * 2.4 + 0.15 * fbm(x * 0.8, y * 0.8, z * 0.8); };
  // 胴: 右奥へ盛り上がる背、頭は左手前
  const body = ellipsoid([54, 58, -2], [28, 20, 20], "skin", -8);
  const head = ellipsoid([33, 56, 10], [19, 13, 15], "skin", 10);
  const snout = ellipsoid([20, 60, 14], [9, 8, 10], "skin", 20);
  const jaw = ellipsoid([28, 64, 12], [17, 6, 12], "skin", 8);
  // 後ろ脚: 折り畳んだ太腿と大きな水かき
  const thigh = ellipsoid([72, 70, 8], [15, 11, 10], "skin", -25);
  const shin = tube([[82, 76, 10, 6], [70, 82, 14, 4.5], [60, 84, 16, 3.5]], "skin");
  const toes = []; for (const a of [-30, 0, 30]) { const r = a * Math.PI / 180; toes.push(cone([60, 84, 16], [52 - Math.cos(r) * 2, 86.5, 16 + Math.sin(r) * 8], 2.2, 1.3, "skin")); }
  // 前脚: 斜めに突っ張る
  const arm = tube([[34, 66, 16, 5], [28, 76, 22, 4], [26, 84, 24, 3.2]], "skin");
  const fing = []; for (const a of [-50, -15, 20, 55]) { const r = a * Math.PI / 180; fing.push(cone([26, 84, 24], [26 + Math.sin(r) * 7, 86.5, 24 + Math.cos(r) * 5], 1.9, 1.2, "skin")); }
  const armB = tube([[48, 68, -6, 4], [46, 80, -8, 3.5], [44, 86, -8, 2.6]], "skin");
  const gland = ellipsoid([45, 44, 8], [8, 4, 6], "gland", 18);
  const eye = sphere([30, 45, 17], 5.4, "eye");
  const lid = Sub(sphere([30, 44, 16], 6.1, "skin"), ellipsoid([31, 46.5, 21], [7, 4.4, 6], "eye", -14));
  const eye2 = sphere([42, 43, 4], 4.4, "eye"), lid2 = Sub(sphere([42, 42.5, 3.5], 5.2, "skin"), ellipsoid([43, 44.5, 8], [5.4, 2.8, 4], "eye", -10));
  const sac = Disp(ellipsoid([25, 70, 18], [11, 8, 9], "sac", 10), (x, y, z) => 0.2 * fbm(x * 0.5, y * 0.5));
  const skin = Paint(Disp(U(3, body, head, snout, jaw, thigh, shin, ...toes, arm, ...fing, armB), bump),
    (x, y, z, m) => { if (m !== "skin") return m; const n = vnoise(x * 0.42, y * 0.42, z * 0.42); if (n > 0.45) return "wart"; if (y > 64 && z > 6 && x < 40) return "belly"; return m; });
  const scene = U(0, puddle(50, 88, 44, 16), skin, gland, lid, eye, lid2, eye2, sac);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, bounce: 0.05 });
  const C = new Canvas(r);
  // 瞳: 横に細い切れ目
  C.line(27, 47, 33, 47, "#000000"); C.line(28, 48, 32, 48, "#000000"); C.set(28, 45, "#fff0c0");
  C.line(40, 45, 44, 45, "#000000");
  // 口: 鼻先から目の下を通って顎の付け根まで
  for (let x = 12; x <= 46; x++) { const t = (x - 12) / 34; const y = Math.round(62 - 4 * t + 3 * t * t); C.only(x, y, "#000000"); if (x > 16) C.only(x, y + 1, "#0b0d05"); }
  C.set(16, 57, "#000000"); C.set(18, 57, "#000000"); // 鼻孔
  // 毒の涎と瘴気
  const G = ["#24400a", "#4e7a14", "#88bc2c", "#ccf064"];
  for (const [x, y0, l] of [[15, 63, 10], [17, 63, 6], [21, 62, 13], [24, 62, 4]]) { for (let i = 0; i < l; i++) C.set(x, y0 + i, i < l - 2 ? G[1] : G[2]); C.set(x, y0 + l, G[3]); }
  const R = rand(11);
  for (let i = 0; i < 26; i++) { const x = 4 + R() * 30, y = 40 + R() * 22; if (!C.get(Math.round(x), Math.round(y))) C.set(x, y, R() < 0.3 ? G[2] : G[1]); }
  ripples(C, 50, 88, 44);
  return C.toArt();
}
