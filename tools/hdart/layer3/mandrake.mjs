import { tube, sphere, ellipsoid, cone, slab, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { GRAVEL, ROCK, RIM, rubble, pebbles, tri } from "../mine.mjs";
export const meta = { id: "d03_mandrake", key: "hd_mandrake3", w: 96, h: 96,
  note: "毒マンドレイク: 人の形に捻じれた太い根の体。皺だらけの顔に虚ろな眼と断末魔に裂けた口、頭からは萎れた葉と紫の毒花。根の脚は床の割れ目に食い込み、紫の胞子を吐き散らす" };
export function build() {
  const mats = {
    root: { ramp: ramp(["#030202", "#0b0706", "#160e0b", "#221611", "#2f1f18", "#3e2a20", "#50372a", "#664636"], 8), spec: 0.4, pow: 20, dither: 0.55,
      shade: p => 0.14 * Math.sin(p.y * 1.5 + 3 * fbm(p.x * 0.2, p.z * 0.2)) + 0.08 * fbm(p.x * 0.6, p.y * 0.6, p.z * 0.6) },
    leaf: { ramp: ramp(["#020301", "#060a04", "#0d1508", "#15200c", "#1f2e12", "#2c3e18"], 6), spec: 0.6, pow: 25, dither: 0.55 },
    flower: { ramp: ramp(["#060209", "#160a20", "#2a1238", "#401c52", "#582a6c", "#743c88"], 6), spec: 1, pow: 30, specCol: "#c090d0", dither: 0.45 },
    maw: { ramp: ["#000000", "#060104", "#100308"], amb: 0.2, dif: 0.2, noRim: true },
    gravel: GRAVEL, rock: ROCK,
  };
  const twist = (x, y, z) => 0.6 * Math.sin(y * 0.8 + Math.atan2(z, x - 48) * 3) * 0.5 + 0.3 * fbm(x * 0.4, y * 0.4, z * 0.4);
  const head = ellipsoid([48, 28, 6], [10, 11, 9], "root");
  const torso = ellipsoid([48, 50, 2], [11, 14, 9], "root", 4);
  const neck = tube([[48, 36, 4, 7], [48, 42, 3, 8]], "root");
  const armL = tube([[38, 44, 4, 4], [28, 40, 10, 3], [22, 30, 12, 2.2], [18, 22, 10, 1.2], [14, 18, 8, 0.4]], "root");
  const armL2 = tube([[22, 30, 12, 1.4], [14, 30, 14, 0.8], [10, 26, 14, 0.3]], "root");
  const armR = tube([[58, 44, 4, 4], [68, 42, 10, 3], [76, 32, 12, 2.2], [80, 22, 10, 1.2], [84, 16, 8, 0.4]], "root");
  const armR2 = tube([[76, 32, 12, 1.4], [84, 34, 14, 0.8], [88, 30, 14, 0.3]], "root");
  // 根の脚: 何本にも裂け、床へ食い込む
  const legs = [];
  for (const [fx, fz, w] of [[24, 4, 3], [34, 10, 3.6], [44, 12, 3.4], [56, 10, 3.6], [66, 6, 3.2], [76, 0, 2.6]]) legs.push(tube([[48 + (fx - 48) * 0.2, 62, 2, w + 1], [48 + (fx - 48) * 0.6, 76, fz, w], [fx, 90, fz, w * 0.5], [fx + (fx - 48) * 0.15, 94, fz - 2, 0.4]], "root", { seg: 3 }));
  const body = Disp(U(3, head, torso, neck, armL, armL2, armR, armR2, ...legs), twist);
  const face = Sub(body, U(0, ellipsoid([43.5, 25, 14], [2.4, 2.8, 4], "maw", 15), ellipsoid([52.5, 25, 14], [2.4, 2.8, 4], "maw", -15), ellipsoid([48, 34, 14], [4.2, 5.2, 5], "maw")), 1.2);
  // 頭の葉と毒花
  const leaves = [];
  for (const [a, L] of [[-150, 18], [-120, 22], [-95, 20], [-70, 24], [-40, 16], [-160, 12], [-20, 12]]) { const r = a * Math.PI / 180, x0 = 48 + Math.cos(r) * 6, y0 = 20 + Math.sin(r) * 4; const ex = x0 + Math.cos(r) * L, ey = y0 + Math.sin(r) * L + L * 0.25; const nx = -Math.sin(r), ny = Math.cos(r);
    leaves.push(Disp(slab([[x0, y0], [(x0 + ex) / 2 + nx * 3.6, (y0 + ey) / 2 + ny * 3.6], [ex, ey], [(x0 + ex) / 2 - nx * 3.6, (y0 + ey) / 2 - ny * 3.6]], 4 - Math.abs(a + 90) * 0.05, 0.7, "leaf", 0.4), (x, y, z) => 0.3 * Math.sin((x + y) * 0.8))); }
  const flowers = [];
  for (const [x, y] of [[36, 6], [58, 4], [48, 2]]) { flowers.push(sphere([x, y, 6], 1.6, "flower")); for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; flowers.push(ellipsoid([x + Math.cos(a) * 2.4, y + Math.sin(a) * 2.4, 5], [1.8, 1.1, 0.8], "flower", a * 180 / Math.PI)); } }
  const scene = U(0, rubble(48, 92, 44, 14, { n: 7, seed: 131, big: 3 }), face, ...leaves, ...flowers);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  // 眼窩の奥の紫の灯と、口から噴き出す胞子
  C.set(43, 25, "#9a5ab0"); C.set(52, 25, "#9a5ab0");
  const S = ["#2a1238", "#582a6c", "#9a5ab0", "#d0a0e0"];
  const R = rand(133);
  for (let i = 0; i < 46; i++) { const t = R(), a = (R() - 0.5) * 1.6 + Math.PI / 2; const x = 48 + Math.cos(a) * t * 30 * (R() < 0.5 ? -1 : 1), y = 38 + t * 22 * Math.sin(a) + (R() - 0.5) * 8; if (!C.get(Math.round(x), Math.round(y))) C.set(x, y, S[Math.floor(R() * 4)]); }
  pebbles(C, 59, 48, 91, 40);
  return C.toArt();
}
