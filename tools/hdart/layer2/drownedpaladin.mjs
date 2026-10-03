import { tube, sphere, ellipsoid, cone, slab, cyl, box, torus, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { RIM, WATER, puddle, ripples } from "../lib.mjs";
import { humanoid, fingers } from "../human.mjs";
export const meta = { id: "el_drownedpaladin", key: "hd_drownedpaladin", w: 112, h: 128,
  note: "沈みし聖騎士 (強敵): 水を吸って錆びた重甲冑の骸。藤壺と藻に覆われ、褪せた陽光の紋の陣羽織、兜の覗き穴から黒い水が絶えず滴る。紋章の大盾と、刃こぼれした長剣を床に突く" };
export function build() {
  const W = 112, H = 128;
  const mats = {
    plate: { ramp: ramp(["#020303", "#070a0a", "#0e1314", "#171e1e", "#222a2a", "#30393a", "#44504e", "#606c66", "#8a9488"], 9), spec: 2.0, pow: 45, specCol: "#d0dcd4", dither: 0.45,
      shade: p => 0.1 * fbm(p.x * 0.3, p.y * 0.3, p.z * 0.3) },
    shield: { ramp: ramp(["#020303", "#060808", "#0c1010", "#141a1a", "#1e2626", "#2a3434", "#3c4846", "#56625c"], 8), spec: 1.6, pow: 45, specCol: "#b8c4bc", dither: 0.45,
      shade: p => 0.12 * fbm(p.x * 0.3, p.y * 0.3, p.z * 0.3) - 0.05 },
    rust: { ramp: ramp(["#040201", "#120804", "#221006", "#36180a", "#4c240e", "#663416", "#844a22"], 7), spec: 0.4, pow: 20, dither: 0.6 },
    cloth: { ramp: ramp(["#030304", "#0a0a0e", "#141620", "#1e2230", "#2a3042", "#384056", "#4a546c"], 7), spec: 0.3, pow: 20, dither: 0.6,
      shade: p => 0.12 * Math.sin(p.x * 0.8 + p.y * 0.1) + 0.08 * fbm(p.x * 0.4, p.y * 0.4) },
    gold: { ramp: ramp(["#060402", "#1a1206", "#30220a", "#4a3610", "#665018", "#866c26", "#a88c3c"], 7), spec: 1.4, pow: 40, specCol: "#f0e0a0", dither: 0.4 },
    barn: { ramp: ramp(["#060605", "#1a1a16", "#32302a", "#4c4a40", "#6c685a", "#908a78"], 6), spec: 0.6, pow: 20, dither: 0.5 },
    weed: { ramp: ramp(["#020402", "#06100a", "#0c1c10", "#142c16", "#1e3e1c", "#2c5426"], 6), dither: 0.6, spec: 0.8, pow: 30 },
    void: { ramp: ["#000000", "#000000", "#020304"], amb: 0, dif: 0.1, noRim: true },
    water: WATER,
  };
  const J = { head: [56, 22, 6], neck: [56, 30, 4], chest: [56, 42, 2], waist: [56, 56, 0], hip: [56, 66, -1],
    shL: [42, 36, 4], elL: [36, 52, 10], haL: [38, 66, 16], shR: [70, 36, 2], elR: [80, 50, 6], haR: [82, 64, 10],
    hpL: [50, 68, 0], knL: [47, 88, 3], ftL: [46, 112, 2], hpR: [62, 68, -1], knR: [66, 88, 1], ftR: [68, 112, 0] };
  const body = humanoid(J, { skin: "plate", head: "plate" }, { w: { headX: 6.4, headY: 8, headZ: 6.5, neck: 4, chestX: 13, chestY: 11, chestZ: 8, waistX: 10, waistY: 7, hipX: 11, arm: 4.4, arm2: 3.8, wrist: 3.2, thigh: 5.6, knee: 4.6, ankle: 3.6 }, k: 2.2 });
  // 兜: 円筒の大兜に十字の覗き穴
  const helm = Sub(U(1, cyl([56, 15, 6], [56, 30, 6], 7.2, "plate", 2.5), ellipsoid([56, 15, 6], [7, 3, 7], "plate")), U(0, box([56, 21, 13], [5.2, 1.0, 4], "void"), box([56, 24.5, 13], [1.0, 4.5, 4], "void")));
  const crest = U(0, ...[0, 1, 2, 3, 4].map(i => cone([56, 12, 4 + i], [52 + i * 2, 4 - (i % 2) * 2, 2 + i], 1.1, 0.3, "cloth")));
  const pauldL = ellipsoid([40, 35, 4], [9, 7, 8], "plate", -20), pauldR = ellipsoid([72, 35, 2], [9, 7, 8], "plate", 20);
  const ridges = [ellipsoid([40, 39, 6], [9.4, 2, 8], "plate", -20), ellipsoid([72, 39, 4], [9.4, 2, 8], "plate", 20)];
  const knees = [sphere(J.knL, 5, "plate"), sphere(J.knR, 5, "plate")];
  const boots = [ellipsoid([45, 113, 6], [5.5, 3.5, 8], "plate"), ellipsoid([69, 113, 2], [5.5, 3.5, 8], "plate")];
  // 陣羽織: 胸から膝まで垂れる布、裾は千切れる
  const tabard = Disp(slab([[46, 40], [66, 40], [68, 70], [66, 88], [60, 84], [56, 92], [52, 85], [46, 88], [44, 70]], 10, 1.1, "cloth", 0.8), (x, y, z) => 0.5 * Math.sin(x * 0.7) * Math.max(0, (y - 60) / 30));
  const rust = (x, y, z, m) => (m === "plate" && fbm(x * 0.12 + 7, y * 0.12, z * 0.12, 4) > 0.18) ? "rust" : m;
  // 盾: 左手の大盾 (手前)、紋章は陽光
  const shield = Disp(slab([[22, 50], [44, 48], [46, 74], [40, 92], [33, 100], [26, 92], [20, 74]], 22, 2.2, "shield", 1.4, 1.2), (x, y, z) => 0.3 * fbm(x * 0.4, y * 0.4, z * 0.4));
  const boss = sphere([33, 70, 26.5], 3.4, "gold");
  // 剣: 右手で床に突き立てる
  const blade = slab([[81, 70], [85, 70], [85, 112], [83, 118], [81, 112]], 12, 1.2, "plate", 0.3);
  const guard = box([83, 68, 12], [7, 1.3, 1.6], "gold", 0.5), grip = cyl([83, 58, 12], [83, 67, 12], 1.3, "cloth"), pommel = sphere([83, 57, 12], 2.2, "gold");
  // 藤壺
  const R = rand(14);
  const barns = []; for (let i = 0; i < 26; i++) { const x = 36 + R() * 42, y = 30 + R() * 80; barns.push([x, y]); }
  const scene = U(0, puddle(56, 118, 50, 18), Paint(Disp(U(1.2, body, helm, pauldL, pauldR, ...ridges, ...knees, ...boots), (x, y, z) => 0.12 * fbm(x * 0.7, y * 0.7, z * 0.7)), rust), crest, tabard, blade, guard, grip, pommel, shield, boss);
  const r = render(scene, mats, { w: W, h: H, rim: RIM });
  const C = new Canvas(r);
  // 紋章: 盾と陣羽織に褪せた陽光
  const sun = (cx, cy, rr, col, col2) => { for (let a = 0; a < 6.28; a += 0.4) C.line(cx + Math.cos(a) * (rr - 1), cy + Math.sin(a) * (rr - 1), cx + Math.cos(a) * (rr + 3), cy + Math.sin(a) * (rr + 3), col2); C.disc(cx, cy, rr, col); };
  sun(33, 70, 6.5, "#665018", "#4a3610"); C.disc(33, 70, 3.2, "#866c26"); C.set(32, 69, "#d8c070");
  sun(56, 56, 3.5, "#4a3610", "#30220a");
  // 藤壺と藻
  for (const [x, y] of barns) { const xi = Math.round(x), yi = Math.round(y); const p = C.pix[yi * W + xi]; if (!p || p.m === "void" || p.m === "cloth") continue; C.set(xi, yi, "#908a78"); C.set(xi + 1, yi, "#4c4a40"); C.set(xi, yi + 1, "#32302a"); C.set(xi + 1, yi + 1, "#000000"); }
  const Wd = ["#0c1c10", "#142c16", "#1e3e1c", "#2c5426"];
  for (const [x, y0, l] of [[40, 42, 9], [44, 40, 6], [70, 42, 12], [74, 41, 7], [47, 94, 10], [66, 94, 8], [24, 92, 7], [30, 99, 9], [38, 92, 6]]) for (let i = 0; i < l; i++) C.set(x + Math.sin(i * 0.8) * 0.8, y0 + i, Wd[i % 4]);
  // 兜の覗き穴から滴る黒い水
  const BW = ["#000000", "#06090a", "#0e1618"];
  for (const [x, l] of [[52, 12], [56, 20], [60, 9]]) { for (let i = 0; i < l; i++) C.set(x, (x === 56 ? 29 : 22) + i, BW[i % 3 === 2 ? 1 : 0]); C.set(x, (x === 56 ? 29 : 22) + l, "#1a2c30"); }
  for (const [x, y] of [[50, 118], [62, 120], [44, 121], [57, 116]]) C.set(x, y, "#2c4446");
  ripples(C, 56, 118, 50);
  return C.toArt();
}
