import { tube, sphere, ellipsoid, cone, slab, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { RIM, WATER, ripples } from "../lib.mjs";
import { humanoid, fingers } from "../human.mjs";
export const meta = { id: "bs_waterhag", key: "hd_waterhag", w: 96, h: 96,
  note: "水路の妖婆: 腰まで濁り水に浸かって身を乗り出す痩せさらばえた老婆の霊。藻の絡んだ長い白髪が水面に広がり、黄色く濁った眼で睨み、骨張った長い指で呪詛を掴む" };
export function build() {
  const mats = {
    skin: { ramp: ramp(["#030404", "#0a0d0b", "#141a15", "#1e2820", "#2c382c", "#3e4c3a", "#566450", "#768268"], 8), spec: 0.9, pow: 30, specCol: "#c8d0b0", dither: 0.55,
      shade: p => 0.14 * fbm(p.x * 0.6, p.y * 0.6, p.z * 0.6) - 0.03 },
    hair: { ramp: ramp(["#040504", "#10140f", "#1e241c", "#30382c", "#46503e", "#626c56", "#88907a"], 7), spec: 1.2, pow: 40, specCol: "#c8d0b8", dither: 0.5,
      shade: p => 0.16 * Math.sin(p.x * 2.4 + p.y * 0.3) },
    weed: { ramp: ramp(["#020402", "#06100a", "#0c1c10", "#142c16", "#1e3e1c", "#2c5426"], 6), dither: 0.6, spec: 1, pow: 40, specCol: "#8ab070" },
    rag: { ramp: ramp(["#030303", "#090a09", "#121410", "#1c1e18", "#282a20", "#363828"], 6), dither: 0.6 },
    eye: { ramp: ["#3a2a00", "#8a6a08", "#d8b028", "#fff0a0"], emit: p => 0.4 + 0.6 * p.nz },
    water: { ramp: ramp(["#030506", "#081012", "#101c20", "#1a2c30"], 4), spec: 1.2, pow: 80, specCol: "#4a6a6c", dither: 0.8, amb: 0.5, dif: 0.4, noRim: true },
  };
  // 腰から上を水面から突き出し、右手をこちらへ伸ばす
  const J = { head: [44, 26, 12], neck: [46, 34, 8], chest: [47, 44, 4], waist: [48, 56, 0], hip: [48, 66, -2],
    shL: [38, 38, 6], elL: [24, 46, 12], haL: [14, 40, 20], shR: [56, 38, 2], elR: [68, 50, 8], haR: [76, 60, 14] };
  const body0 = humanoid(J, { skin: "skin", torso: "rag" }, { w: { chestX: 7.5, chestY: 7, chestZ: 4.5, waistX: 5.5, waistZ: 4, arm: 2.2, arm2: 1.7, wrist: 1.1, headX: 4.4, headY: 6, headZ: 4.6, neck: 1.6 }, headRot: -14, k: 1.2 });
  const dress = Disp(tube([[47, 40, 3, 7], [48, 52, 1, 6.5], [48, 64, 0, 9], [48, 72, 0, 11]], "rag"), (x, y, z) => 0.6 * Math.max(0, Math.sin(x * 1.1 + y * 0.15)) + 0.3 * fbm(x * 0.4, y * 0.4, z * 0.4));
  const body = U(2, body0, dress);
  const bony = (x, y, z) => -0.4 * Math.max(0, Math.sin(y * 1.2)) * (x > 40 && x < 54 && y > 38 && y < 52 ? 1 : 0) + 0.15 * fbm(x * 0.7, y * 0.7, z * 0.7);
  const hL = fingers(J.haL, -150, "skin", { n: 4, len: 9, spread: 24, r: 0.8, curl: 0.5, z: 2 });
  const hR = fingers(J.haR, 50, "skin", { n: 4, len: 9, spread: 26, r: 0.8, curl: -0.5, z: 2 });
  // 髪: 頭頂から肩・背へ流れ、水面に広がる長い束
  const R = rand(12);
  const hair = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 13 - 0.5) * 2.8, x0 = 44 + Math.sin(a) * 5, z0 = 11 - Math.cos(a) * 3 + (i % 4 === 1 ? 6 : 0);
    const side = Math.sign(a) || 1, spread = 6 + R() * 12, ph = R() * 6;
    const pts = [];
    for (let t = 0; t <= 1.001; t += 0.125) { const y = 21 + t * 54; pts.push([x0 + side * (t * 3 + t * t * spread) + Math.sin(t * 9 + ph) * 2 * t, y, z0 - t * 2 + (i % 4 === 1 ? 2 * t : 0), 1.5 - t * 0.8]); }
    hair.push(tube(pts, (i % 3 === 0) ? "weed" : "hair", { seg: 2 }));
  }
  const cap = ellipsoid([44, 22, 11], [5.4, 5, 5], "hair", -14);
  const water = Disp(ellipsoid([48, 77, 0], [47, 3.6, 36], "water"), (x, y, z) => 0.3 * Math.sin(Math.hypot(x - 48, z * 1.5) * 1.0));
  const scene = U(0, Disp(body, bony), ...hL, ...hR, cap, ...hair, water);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  // 眼と口
  C.set(42, 26, "#000000"); C.set(47, 26, "#000000"); C.set(42, 27, "#000000"); C.set(47, 27, "#000000");
  C.set(42, 26, "#d8b028"); C.set(47, 26, "#d8b028"); C.set(41, 25, "#0a0d0b"); C.set(48, 25, "#0a0d0b");
  for (const [x, y, c] of [[43, 31, "#000000"], [44, 31, "#000000"], [45, 31, "#000000"], [46, 31, "#000000"], [44, 32, "#000000"], [45, 32, "#000000"], [43, 30, "#9a9474"], [46, 32, "#9a9474"]]) C.set(x, y, c);
  // 水面に浮かぶ藻と、指先から滴る水
  const Wd = ["#0c1c10", "#142c16", "#1e3e1c"];
  for (let i = 0; i < 40; i++) { const x = 4 + R() * 88, y = 72 + R() * 8; if (C.get(Math.round(x), Math.round(y))) C.set(x, y, Wd[Math.floor(R() * 3)]); }
  for (const [x, y] of [[10, 34], [9, 37], [80, 70], [82, 74], [78, 72]]) C.set(x, y, "#4e6c6e");
  ripples(C, 48, 76, 46, "#2c4446");
  return C.toArt();
}
