import { tube, sphere, ellipsoid, cone, cyl, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { RIM } from "../mine.mjs";
export const meta = { id: "bs_dustwraith", key: "hd_dustwraith", w: 96, h: 96,
  note: "粉塵の亡霊: 黒い炭塵の渦が坑夫の姿をなした霊。灯の消えた坑夫兜、塵に穿たれた眼窩に毒の燐光、叫ぶように開いた口。下半身は渦を巻いてほどける" };
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
export function build() {
  const mats = {
    dust: { ramp: ramp(["#040404", "#0a0a09", "#121110", "#1b1917", "#25221e", "#312d27", "#3e3930", "#4e483c"], 8), dither: 0.9, amb: 0.24, dif: 0.8,
      shade: p => 0.18 * fbm(p.x * 0.14 + p.y * 0.05, p.y * 0.14, 2) + 0.12 * Math.sin((p.x - 48) * 0.35 + p.y * 0.5) },
    helm: { ramp: ramp(["#030302", "#0d0b07", "#1b170e", "#2b2414", "#3c321c", "#504224"], 6), spec: 0.6, pow: 25, dither: 0.5 },
    glass: { ramp: ["#050505", "#0e100c", "#1a1e16"], spec: 1.4, pow: 50, specCol: "#6a7458", dither: 0.3 },
    hole: { ramp: ["#000000", "#000000", "#020202"], amb: 0, dif: 0.15, noRim: true },
  };
  const swirl = (x, y, z) => 1.6 * fbm(x * 0.12 + Math.sin(y * 0.12) * 0.8, y * 0.1, z * 0.12, 4);
  const head = ellipsoid([46, 26, 6], [7.5, 9, 7], "dust", -6);
  const torso = ellipsoid([47, 44, 0], [13, 13, 8], "dust", 5);
  // 渦: 下へ細くねじれていく漏斗
  const funnel = [];
  for (let i = 0; i < 7; i++) { const t = i / 6, a = t * 5.5; funnel.push(sphere([48 + Math.sin(a) * (8 - t * 5), 56 + t * 34, Math.cos(a) * 4], 11 - t * 8, "dust")); }
  const armL = tube([[36, 38, 2, 4.2], [26, 46, 8, 3.6], [18, 40, 12, 3], [14, 30, 14, 2.4], [16, 22, 12, 1.4]], "dust");
  const armR = tube([[58, 38, 2, 4.2], [68, 44, 6, 3.6], [78, 38, 10, 3], [84, 28, 12, 2.2], [82, 20, 10, 1.2]], "dust");
  const body = Disp(U(4, head, torso, ...funnel, armL, armR), swirl);
  const face = Sub(body, U(0, ellipsoid([42.5, 25, 12], [2.2, 3, 4], "hole", -10), ellipsoid([49.5, 25, 12], [2.2, 3, 4], "hole", 10), ellipsoid([46, 33, 12], [3.2, 4.6, 4], "hole")), 1.0);
  // 坑夫兜 (塵が形をなしても、兜だけは本物のまま)
  const helm = Disp(Sub(ellipsoid([46, 18, 6], [9, 6.5, 8.5], "helm", -6), cyl([30, 23, -10], [62, 22, -10], 30, "helm")), (x, y, z) => 0.15 * fbm(x * 0.7, y * 0.7, z * 0.7));
  const brim = cyl([46, 21.5, 6], [46.3, 22.5, 6], 11, "helm", 0.4);
  const lamp = U(0, cyl([45, 13, 13], [45, 13, 16], 2.6, "helm", 0.6), sphere([45, 13, 16.2], 1.8, "glass"));
  const scene = U(0, face, helm, brim, lamp);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, rimTh: 0.1 });
  const C = new Canvas(r);
  // 塵の透け: 下と腕の先ほど、渦の筋に沿って画素を抜く
  for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) {
    const p = C.pix[y * 96 + x]; if (!p || p.m !== "dust") continue;
    const fadeY = Math.max(0, (y - 60) / 32), fadeX = Math.max(0, (Math.abs(x - 47) - 20) / 22);
    const a = 1.05 - Math.max(fadeY, fadeX) * 1.15 + 0.5 * fbm(x * 0.2 + y * 0.08, y * 0.16, 5);
    if (a < (BAYER[y & 3][x & 3] + 0.5) / 16) C.set(x, y, null);
  }
  // 眼窩の奥の毒の燐光
  const G = ["#3a4a14", "#7a9a22", "#c8e45a"];
  for (const ex of [42, 49]) { C.set(ex, 25, G[1]); C.set(ex + 1, 25, G[2]); C.set(ex, 26, G[0]); C.set(ex + 1, 26, G[1]); }
  // 渦から舞い散る炭塵の筋と粒
  const R = rand(51);
  const D = ["#121110", "#1b1917", "#25221e", "#312d27"];
  for (const [x0, y0, r0] of [[48, 70, 16], [48, 80, 12], [47, 60, 20]]) for (let a = 0; a < 6.28; a += 0.09) { const x = x0 + Math.cos(a) * r0, y = y0 + Math.sin(a) * r0 * 0.28; if (!C.get(Math.round(x), Math.round(y)) && R() < 0.55) C.set(x, y, D[1 + Math.floor(R() * 3)]); }
  for (let i = 0; i < 36; i++) { const x = 4 + R() * 88, y = 4 + R() * 88; if (!C.get(Math.round(x), Math.round(y))) C.set(x, y, (R() < 0.15) ? G[0] : D[Math.floor(R() * 4)]); }
  return C.toArt();
}
