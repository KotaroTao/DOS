import { tube, sphere, ellipsoid, cone, slab, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { humanoid, fingers } from "../human.mjs";
import { MOULD, MOSS, ROOT, RIM, forestFloor, leaves, mist } from "../forest.mjs";
export const meta = { id: "bs_dryadfey", key: "hd_dryadfey", w: 96, h: 96,
  note: "森の妖魔: 樹皮と若葉の肌を持つ妖艶な女の妖。枝垂れる蔦と白い花の髪、差し伸べた指先で招き、桃色に妖しく光る眼で魅了する。下半身は根に溶けて苔むした床へ繋がり、周りに桃色の花びらと光の粒が漂う" };
export function build() {
  const mats = {
    skin: { ramp: ramp(["#060504", "#13110c", "#221f16", "#332e20", "#463f2c", "#5b533a", "#726a4b", "#8c845f"], 8), spec: 0.5, pow: 22, specCol: "#b4ac84", dither: 0.5, amb: 0.24,
      shade: p => 0.07 * Math.sin(p.x * 2.2 + 3 * fbm(p.x * 0.2, p.y * 0.12, 1)) + 0.05 * fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5) },
    leaf: { ramp: ramp(["#040703", "#0b1608", "#13250d", "#1d3812", "#2a4d17", "#3a641d", "#4e7c26", "#68983a"], 8), spec: 0.7, pow: 25, specCol: "#a8cc70", dither: 0.55, amb: 0.22,
      shade: p => 0.1 * Math.sin(p.x * 1.4 + p.y * 1.9) },
    vine: { ramp: ramp(["#030502", "#081006", "#0f1c0b", "#172a10", "#203816", "#2c4a1e"], 6), dither: 0.6, amb: 0.2 },
    flower: { ramp: ramp(["#2a2626", "#5a5450", "#8e8882", "#bdb6ac", "#e4ded2", "#f8f4ea"], 6), dither: 0.3, amb: 0.4 },
    eye: { ramp: ["#5a1638", "#a83070", "#ec6aa8", "#ffc4e0"], emit: p => 0.55 + 0.45 * Math.max(0, p.nz) },
    lip: { ramp: ramp(["#1a0810", "#3a1424", "#5e2238", "#84344e"], 4), spec: 1, pow: 30, specCol: "#e0a0b8", dither: 0.4 },
    mould: MOULD, moss: MOSS, root: ROOT,
  };
  // 体: 細い首、くびれた腰。右手 (画面右) を差し伸べて招き、左手は腰に
  const J = { head: [42, 19, 6], neck: [43, 27, 3], chest: [43, 36, 2], waist: [45, 48, 1], hip: [46, 58, 0],
    shL: [35, 31, 2], elL: [29, 42, 4], haL: [37, 51, 8], shR: [51, 31, 3], elR: [62, 35, 8], haR: [72, 30, 11] };
  const body = humanoid(J, { skin: "skin" }, { w: { headX: 4.4, headY: 5.4, headZ: 4.8, neck: 1.8, chestX: 7.2, chestY: 6.8, chestZ: 5, waistX: 4.8, waistY: 6, waistZ: 4, hipX: 7.6, hipY: 5.6, hipZ: 5.2,
    arm: 2.1, arm2: 1.7, wrist: 1.3 }, k: 1.4 });
  const bust = [ellipsoid([39.5, 37, 6], [3.4, 3, 3], "skin"), ellipsoid([47, 37, 6], [3.4, 3, 3], "skin")];
  const chin = ellipsoid([42.6, 23.5, 8], [2.6, 2, 2.6], "skin");
  // 招く手: 人差し指を立てて曲げ、他の指は軽く握る
  const hand = ellipsoid([73, 29.5, 11.5], [1.9, 1.6, 1.4], "skin", -30);
  const fing = [tube([[74.5, 28, 12, 0.6], [77, 25.5, 12.5, 0.55], [76.6, 23, 13, 0.4]], "skin", { seg: 2 }), ...fingers([74, 30, 12], 10, "skin", { n: 3, len: 3.6, spread: 18, r: 0.55, curl: 1.4 })];
  const fing2 = fingers([36.5, 53, 8], 70, "skin", { n: 4, len: 3.5, spread: 14, r: 0.5, curl: 0.3 });
  // 下半身: 腰から根の束へほどけて床へ
  const rootsDown = [];
  const R = rand(631);
  for (let i = 0; i < 9; i++) {
    const s = (i - 4) / 4;
    const x0 = 46 + s * 5, x1 = 46 + s * 10 + (R() - 0.5) * 3, x2 = 46 + s * 22 + (R() - 0.5) * 6;
    rootsDown.push(tube([[x0, 60, (R() - 0.5) * 4, 3.4 - Math.abs(s)], [x1, 73, 1 + (R() - 0.5) * 6, 2.6 - Math.abs(s) * 0.6], [x2, 84, 3 + (R() - 0.5) * 8, 1.5]], i % 3 ? "root" : "skin", { seg: 4 }));
  }
  const skirt = Disp(cone([46, 58, 0], [46, 76, 0], 7.6, 11, "root"), (x, y, z) => 0.8 * Math.abs(Math.sin(Math.atan2(z, x - 46) * 6 + y * 0.1)));
  const fey = Disp(U(1.2, body, ...bust, chin, hand, ...fing, ...fing2), (x, y, z) => 0.1 * fbm(x * 0.8, y * 0.8, z * 0.8));
  // 若葉の衣: 胸と腰を覆う葉
  const leafy = [];
  const leafAt = (x, y, z, rot, s = 1) => leafy.push(ellipsoid([x, y, z], [2.6 * s, 1.3 * s, 0.7 * s], "leaf", rot));
  for (const [x, y, z, r] of [[37, 36, 8.6, -30], [41, 39, 9, 20], [45, 35.5, 8.8, -10], [49, 38, 8.4, 35], [43, 41, 8, -60], [40, 44, 6.4, 10], [47, 44, 6.4, -20],
    [40, 55, 6.6, 40], [44, 57, 7.2, -10], [48, 56, 7, 30], [52, 58, 6.4, -40], [42, 60, 6.6, 70], [50, 61, 6.4, -70], [46, 60.5, 7.4, 90]]) leafAt(x, y, z, r, 1.05);
  // 蔦の髪: 頭の後ろに茂る豊かな塊から、肩と背へ枝垂れる長い房
  const hairMass = Disp(U(2.2, ellipsoid([41, 15, 1], [7.4, 6.4, 6], "vine"), ellipsoid([34, 24, -3], [5, 9, 5], "vine", 10), ellipsoid([50, 24, -3], [5, 9, 5], "vine", -10),
    ellipsoid([32, 38, -5], [4.4, 10, 4], "vine", 12), ellipsoid([53, 38, -5], [4.4, 10, 4], "vine", -14)), (x, y, z) => 0.9 * fbm(x * 0.35, y * 0.35, z * 0.35));
  const hair = [Paint(hairMass, (x, y, z, m) => vnoise(x * 0.9, y * 0.9, z * 0.9) > 0.25 ? "leaf" : m)];
  const vines = [];
  for (let i = 0; i < 12; i++) {
    const s = (i - 5.5) / 5.5;
    if (Math.abs(s) < 0.35) continue; // 顔の前には垂らさない
    const side = s < 0 ? -1 : 1;
    const x0 = 42 + s * 7, y0 = 16 + Math.abs(s) * 4;
    const x1 = 42 + s * 11 + side * 2, y1 = 34 + R() * 6;
    const x2 = 42 + s * 13 + side * (3 + R() * 5), y2 = 52 + R() * 18;
    const z0 = -2 - R() * 4;
    vines.push(tube([[x0, y0, z0 + 2, 1.6], [x1, y1, z0, 1.1], [x2, y2, z0 - 2, 0.6]], "vine", { seg: 4 }));
    for (let k = 0; k < 4; k++) { const t = 0.25 + k * 0.2; const x = x0 + (x2 - x0) * t + side * 1.2, y = y0 + (y2 - y0) * t; vines.push(ellipsoid([x, y, z0 + 1], [1.7, 0.8, 0.6], "leaf", side * 50 + R() * 40)); }
  }
  // 頭頂から伸びる細い枝 (冠)
  const twigs = [tube([[38, 11, 2, 1], [33, 4, 0, 0.6], [30, 1, -1, 0.3]], "root"), tube([[45, 10, 2, 1], [49, 3, 0, 0.6], [53, 1, -1, 0.3]], "root"), tube([[33.5, 5, 0, 0.5], [30, 6, -1, 0.3]], "root")];
  const eyes = [ellipsoid([39.6, 18.6, 10.1], [1.25, 0.75, 0.7], "eye", -12), ellipsoid([44.4, 18.6, 10.1], [1.25, 0.75, 0.7], "eye", 12)];
  const lips = ellipsoid([42.4, 24, 10.1], [1.4, 0.55, 0.6], "lip");
  const floor = forestFloor(48, 88, 42, 14, { n: 6, roots: 4, seed: 633 });
  const scene = U(0, floor, U(1.6, fey, skirt, ...rootsDown), ...leafy, ...hair, ...vines, ...twigs, ...eyes, lips);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [42, 19, 16], r: 12, k: 0.25 }, { p: [76, 26, 18], r: 14, k: 0.3 }] });
  const C = new Canvas(r);
  // 白い花 (2D): 頭の冠と、髪の房のところどころに小さく咲く
  const FL = ["#8e8882", "#d8d2c6", "#f8f4ea", "#e8d070"];
  const flower = (x, y, big) => {
    for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) C.set(x + dx, y + dy, FL[dx < 0 || dy < 0 ? 2 : 1]);
    if (big) for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) C.set(x + dx, y + dy, FL[0]);
    C.set(x, y, FL[3]);
  };
  for (const [x, y, b] of [[35, 12, 1], [39, 9, 1], [44, 9, 1], [48, 12, 1], [33, 17, 0], [50, 18, 0], [31, 27, 0], [53, 28, 0], [30, 40, 0], [55, 42, 0], [34, 52, 0], [52, 57, 0]]) flower(x, y, b);
  // 桃色の燐光と花びら: 招く指先から二筋の流れになって漂い出る
  const PK = ["#4a1830", "#8a2c5a", "#d05a94", "#f7a8d0", "#ffe0f0"];
  const Rp = rand(637);
  const streams = [t => [77 + t * 14 + Math.sin(t * 9) * 2.5, 22 - t * 16 + Math.cos(t * 7) * 2], t => [76 + t * 10 + Math.sin(t * 8 + 1) * 3, 26 + t * 34 + Math.sin(t * 5) * 2], t => [74 - t * 16, 24 - t * 14 + Math.sin(t * 9) * 2.5]];
  for (const [si, f] of streams.entries()) for (let i = 0; i < 26; i++) {
    const t = Math.pow(Rp(), 1.3);
    const [x0, y0] = f(t), j = 0.6 + t * 3.5;
    const X = Math.round(x0 + (Rp() - 0.5) * j), Y = Math.round(y0 + (Rp() - 0.5) * j);
    if (X < 1 || X > 94 || Y < 1 || Y > 88 || C.get(X, Y)) continue;
    if (Rp() < t * 0.55) continue;
    const b = t < 0.35 ? (Rp() < 0.5 ? 4 : 3) : (Rp() < 0.5 ? 3 : 2);
    C.set(X, Y, PK[b]);
    if (Rp() < 0.5 && !C.get(X + 1, Y)) C.set(X + 1, Y, PK[b - 1]); // 花びらは2粒
    else if (Rp() < 0.3 && !C.get(X, Y + 1)) C.set(X, Y + 1, PK[b - 2]);
  }
  // 指先の光の珠
  for (const [dx, dy, c] of [[0, 0, 4], [-1, 0, 3], [1, 0, 3], [0, -1, 3], [0, 1, 3], [-1, -1, 2], [1, -1, 2], [-1, 1, 2], [1, 1, 2]]) if (!C.get(77 + dx, 21 + dy) || c === 4) C.set(77 + dx, 21 + dy, PK[c]);
  // 遠くを漂う花びら
  for (let i = 0; i < 10; i++) { const x = 4 + Rp() * 88, y = 4 + Rp() * 74; const X = Math.round(x), Y = Math.round(y); if (C.get(X, Y) || C.get(X + 1, Y)) continue; C.set(X, Y, PK[2]); C.set(X + 1, Y, PK[1]); }
  // 眼の芯と、頬の妖しい照り
  C.set(39, 18, "#fff0f8"); C.set(44, 18, "#fff0f8");
  leaves(C, 639, 48, 88, 34, 18);
  return C.toArt();
}
