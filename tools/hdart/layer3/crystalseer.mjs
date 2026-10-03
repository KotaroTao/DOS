import { tube, sphere, ellipsoid, cone, slab, cyl, box, torus, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { humanoid, fingers } from "../human.mjs";
import { GRAVEL, ROCK, RIM, rubble, pebbles, tri } from "../mine.mjs";
export const meta = { id: "el_crystalseer", key: "hd_crystalseer", w: 112, h: 128,
  note: "晶に憑かれし錬金術師 (強敵): 宮廷錬金術師の長衣をまとった痩身の男。右半身は皮膚を破って生えた水晶に覆われ、肩と背から晶の柱が突き出す。右眼は晶と化して青白く光り、左手には晶の芽吹く蒸留瓶。足元の岩にも晶が広がる" };
export function build() {
  const W = 112, H = 128;
  const mats = {
    robe: { ramp: ramp(["#030204", "#09060c", "#110b16", "#1a1122", "#24182e", "#30203c", "#3e2a4c", "#4e365e"], 8), spec: 0.4, pow: 20, dither: 0.6,
      shade: p => 0.14 * Math.sin(p.x * 0.75 + p.y * 0.1) + 0.06 * fbm(p.x * 0.4, p.y * 0.4) },
    trim: { ramp: ramp(["#050302", "#160f05", "#2c1f0a", "#463210", "#644a18", "#866624"], 6), spec: 1.3, pow: 35, specCol: "#ffe0a0", dither: 0.4 },
    skin: { ramp: ramp(["#040304", "#141012", "#272024", "#3c3236", "#54484a", "#6e6060", "#8c7c76"], 7), spec: 0.6, pow: 25, dither: 0.5 },
    crys: { ramp: ramp(["#03070c", "#08141e", "#0e2232", "#163448", "#204a62", "#2e6680", "#4688a0", "#68aec0", "#a0dce4"], 9), spec: 2.4, pow: 60, specCol: "#f0ffff", dither: 0.35, amb: 0.32,
      shade: p => 0.25 * Math.max(0, -p.nx * 0.3 + p.nz * 0.5) },
    vio: { ramp: ramp(["#06040c", "#120c22", "#1e1438", "#2c1e52", "#3e2c6e", "#56428e", "#7660ae"], 7), spec: 2.2, pow: 60, specCol: "#e8e0ff", dither: 0.35, amb: 0.3 },
    glass: { ramp: ramp(["#030506", "#08100e", "#0e1a18", "#162824", "#203a34"], 5), spec: 2.4, pow: 70, specCol: "#d0fff0", dither: 0.35, amb: 0.3 },
    eye: { ramp: ["#1a3a44", "#3a7a8a", "#7ad0e0", "#e0ffff"], emit: p => 0.6 + 0.4 * Math.max(0, p.nz) },
    hole: { ramp: ["#000000", "#000000", "#020203"], amb: 0, dif: 0.1, noRim: true },
    gravel: GRAVEL, rock: ROCK,
  };
  const J = { head: [56, 26, 6], neck: [56, 33, 3], chest: [56, 44, 0], waist: [56, 58, -1], hip: [56, 66, -2],
    shL: [46, 38, 2], elL: [38, 52, 8], haL: [34, 64, 14], shR: [66, 38, 0], elR: [74, 52, 6], haR: [76, 66, 10] };
  const body = humanoid(J, { skin: "robe", head: "skin" }, { w: { headX: 5.6, headY: 6.8, headZ: 5.6, neck: 2.4, chestX: 9.5, chestY: 8.5, chestZ: 6.5, waistX: 7, waistY: 7, hipX: 8,
    arm: 3, arm2: 2.6, wrist: 1.6 }, k: 1.5 });
  // 長衣: 裾は床まで広がる。襟と縁に金の縫い取り
  const skirt = Disp(cone([56, 56, -1], [56, 116, -2], 9, 17, "robe"), (x, y, z) => 0.9 * Math.sin(Math.atan2(z + 2, x - 56) * 6 + y * 0.1) * Math.max(0, (y - 64) / 50));
  const hem = Disp(torus([56, 115, -2], 16.2, 1.2, "trim", 0, 0), (x, y, z) => 0.9 * Math.sin(Math.atan2(z + 2, x - 56) * 6 + 115 * 0.1));
  // 前合わせの金の縁取り
  const placket = [tube([[55, 36, 9.4, 0.8], [54.5, 60, 9, 0.8], [53.5, 90, 13, 0.9], [53, 114, 17, 0.9]], "trim"), tube([[57, 36, 9.4, 0.8], [57.5, 60, 9, 0.8], [58.5, 90, 13, 0.9], [59, 114, 17, 0.9]], "trim")];
  const collar = torus([56, 34, 3], 6.5, 1.3, "trim", 0, 20);
  const hood = Disp(ellipsoid([56, 30, -4], [9, 9, 6], "robe"), (x, y, z) => 0.2 * fbm(x * 0.5, y * 0.5));
  // 右半身の晶: 肩・腕・頬を破って生える柱の群れ
  const crys = [];
  const R = rand(231);
  const cl = (x, y, z, a, L, w, m = "crys") => { const r = a * Math.PI / 180; crys.push(cone([x, y, z], [x + Math.sin(r) * L, y - Math.cos(r) * L, z + (R() - 0.3) * 4], w, 0.25, m)); };
  for (const [x, y, z, a, L, w] of [[68, 36, 2, 30, 20, 3.4], [70, 38, -2, 55, 16, 2.8], [64, 34, -4, 10, 22, 3], [72, 42, 2, 80, 12, 2.4], [62, 30, 2, 20, 12, 2], [74, 50, 8, 70, 10, 2.2], [76, 58, 10, 100, 9, 2], [66, 46, 6, 40, 8, 1.8], [60, 22, 8, 40, 7, 1.4], [62, 50, -8, -10, 26, 3.6], [52, 46, -8, -25, 18, 2.6]]) cl(x, y, z, a, L, w);
  for (const [x, y, z, a, L, w] of [[70, 44, -6, 60, 14, 2.2], [58, 48, -10, -40, 14, 2], [78, 62, 10, 140, 8, 1.8]]) cl(x, y, z, a, L, w, "vio");
  // 右手は晶の塊、左手に蒸留瓶
  const handR = Disp(ellipsoid([77, 68, 11], [4, 4.5, 4], "crys"), (x, y, z) => 0.4 * fbm(x * 0.7, y * 0.7, z * 0.7));
  const handL = fingers([34, 64, 14], 70, "skin", { n: 4, len: 4, spread: 18, r: 0.8, curl: 1.2, z: 1 });
  const flask = U(1, sphere([34, 72, 16], 5, "glass"), cyl([34, 63, 16], [34, 68, 16], 1.6, "glass", 0.3));
  const flaskCrys = [cone([33, 72, 18], [31, 66, 20], 1.4, 0.2, "crys"), cone([35, 73, 18], [38, 67, 19], 1.2, 0.2, "vio"), cone([34, 74, 18], [34, 69, 21], 1.1, 0.2, "crys")];
  const face = Sub(U(1.4, body, hood), U(0, ellipsoid([53.2, 25.4, 12.2], [1.6, 1.2, 1.6], "hole"), ellipsoid([56, 31.5, 11.6], [2.2, 0.7, 1.4], "hole")), 0.3);
  const eye = sphere([59, 25.4, 11.4], 1.9, "eye");
  const cheek = [cone([59, 27, 9], [63, 21, 10], 1.5, 0.2, "crys"), cone([60, 29, 8], [65, 27, 9], 1.2, 0.2, "crys")];
  // 足元の岩に広がる晶
  const ground = [];
  for (const [x, a, L] of [[26, -30, 10], [30, 10, 7], [84, 20, 12], [90, 50, 8], [80, -10, 6], [20, -60, 6], [96, 30, 5]]) { const r = a * Math.PI / 180; ground.push(cone([x, 118, 6], [x + Math.sin(r) * L, 118 - Math.cos(r) * L, 8], 2 + L * 0.12, 0.25, L > 8 ? "crys" : "vio")); }
  const scene = U(0, rubble(56, 120, 52, 18, { n: 9, seed: 233, big: 4 }), face, skirt, hem, ...placket, collar, ...crys, handR, ...handL, flask, ...flaskCrys, eye, ...cheek, ...ground);
  const r = render(scene, mats, { w: W, h: H, rim: RIM, lights: [{ p: [70, 40, 26], r: 30, k: 0.35 }] });
  const C = new Canvas(r);
  C.set(53, 25, "#3a2a2a");
  // 晶眼から放たれる凝視の光
  const Gl = ["#1a3a44", "#3a7a8a", "#7ad0e0"];
  for (let k = 2; k < 12; k++) if (k % 2 === 0 || k < 5) { const x = 60 + k, y = 25.4 - k * 0.15; if (!C.get(Math.round(x), Math.round(y))) C.set(x, y, Gl[k < 5 ? 2 : k < 8 ? 1 : 0]); }
  // 宙に舞う晶の粉
  for (let i = 0; i < 22; i++) { const x = 50 + R() * 56, y = 6 + R() * 70; if (!C.get(Math.round(x), Math.round(y))) C.set(x, y, R() < 0.5 ? "#4688a0" : "#a0dce4"); }
  pebbles(C, 237, 56, 118, 48, 30);
  return C.toArt();
}
