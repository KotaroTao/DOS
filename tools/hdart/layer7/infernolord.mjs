import { sphere, ellipsoid, cone, tube, torus, cyl, slab, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { humanoid, fingers } from "../human.mjs";
import { BASALT, CRUST, LAVA, RIM, EMBER, lavaFloor, underglow, embers, flame2d } from "../lava.mjs";
export const meta = { id: "bs_infernolord", key: "hd_infernolord", w: 112, h: 128,
  note: "業火の主 (層ボス): 魂を煮る大釜を守る、巨大な角の悪魔。大釜の後ろに立ち、両腕を釜の上に広げて業火を呼ぶ。黒い肌に溶岩の血管、頭には炎の冠と大きく反った二本の角、胸には火の紋が燃える。釜の中では煮えた霊薬から青白い魂の火がいくつも立ちのぼり、釜の前には火を拝む信徒がひれ伏す" };
export function build() {
  const W = 112, H = 128;
  const mats = {
    skin: { ramp: ramp(["#030101", "#0a0304", "#140607", "#20090a", "#2e0d0d", "#3e1311", "#521a15", "#6a2219"], 8), spec: 0.6, pow: 22, specCol: "#b0604a", dither: 0.55,
      shade: p => 0.08 * fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5) },
    horn: { ramp: ramp(["#060402", "#18120a", "#30261a", "#4e402c", "#746246", "#a08a66", "#c8b28a"], 7), spec: 0.9, pow: 26, dither: 0.4,
      shade: p => 0.1 * Math.sin((p.x + p.y) * 1.4) },
    iron: { ramp: ramp(["#030303", "#0a0908", "#151311", "#221f1c", "#322d29", "#46403a", "#5e5650", "#7a706a"], 8), spec: 1.1, pow: 28, specCol: "#c8b8a8", dither: 0.45,
      shade: p => 0.08 * fbm(p.x * 0.4, p.y * 0.4, p.z * 0.4) },
    brew: { ramp: ["#4e0e04", "#a8300a", "#f07a1c", "#ffae3a", "#ffdc7a", "#fff4c4"], noRim: true, emit: p => 0.4 + 0.4 * Math.max(0, -p.ny) + 0.2 * fbm(p.x * 0.3, p.z * 0.3, 2) },
    soul: { ramp: ["#0e2a4a", "#2a5a8a", "#5a98c8", "#a8d8f0", "#e8f8ff"], noRim: true, emit: p => 0.35 + 0.6 * Math.max(0, p.nz) },
    sigil: { ramp: ["#7a1a06", "#f07a1c", "#ffdc7a"], noRim: true, emit: () => 0.8 },
    eye: { ramp: ["#7a4a04", "#f0c020", "#fff4a0"], emit: () => 0.9 },
    robe: { ramp: ramp(["#030202", "#0a0706", "#14100d", "#201914", "#2c231c"], 5), dither: 0.6 },
    basalt: BASALT, crust: CRUST, lava: LAVA,
  };
  // 主: 釜の後ろに立つ上半身。腕を左右へ広げて釜の上にかざす
  const J = { head: [56, 30, -8], neck: [56, 37, -9], chest: [56, 50, -10], waist: [56, 66, -12], hip: [56, 76, -12],
    shL: [40, 44, -8], elL: [24, 50, -2], haL: [16, 62, 4], shR: [72, 44, -8], elR: [88, 50, -2], haR: [96, 62, 4] };
  const body = humanoid(J, { skin: "skin" }, { w: { headX: 6.4, headY: 7, chestX: 17, chestY: 12, waistX: 12, waistY: 10, hipX: 12, arm: 6, arm2: 5, wrist: 3.6 } });
  const lord = Disp(body, (x, y, z) => 0.35 * fbm(x * 0.4, y * 0.4, z * 0.4) + (y > 46 && y < 64 ? -0.5 * Math.max(0, Math.sin(x * 0.6)) : 0));
  const hands = [...fingers(J.haL, 110, "skin", { n: 4, len: 8, spread: 36, r: 1.4, curl: 0.4, z: 1 }), ...fingers(J.haR, 70, "skin", { n: 4, len: 8, spread: 36, r: 1.4, curl: -0.4, z: 1 })];
  const horns = [tube([[50, 25, -6, 3.2], [40, 18, -6, 2.8], [30, 16, -6, 2.2], [22, 10, -6, 1.4], [20, 2, -6, 0.5]], "horn", { seg: 3 }),
    tube([[62, 25, -6, 3.2], [72, 18, -6, 2.8], [82, 16, -6, 2.2], [90, 10, -6, 1.4], [92, 2, -6, 0.5]], "horn", { seg: 3 })];
  const jaw = ellipsoid([56, 35, -3], [4.6, 2.6, 3.4], "skin");
  const brow = ellipsoid([56, 27, -2.5], [6, 1.6, 2], "skin");
  const eyes = [sphere([53.2, 29, -1.8], 1.1, "eye"), sphere([58.8, 29, -1.8], 1.1, "eye")];
  const crest = Paint(ellipsoid([56, 50, 1.4], [4, 4.6, 1.2], "skin"), () => "sigil");
  // 大釜: 太い鉄の胴、厚い縁、三本の脚、縁から煮えた霊薬
  const pot = Sub(Disp(ellipsoid([56, 94, 6], [36, 20, 22], "iron"), (x, y, z) => 0.3 * fbm(x * 0.3, y * 0.3, z * 0.3)), cyl([56, 70, 6], [56, 88, 6], 32, "iron"), 1);
  const lip = torus([56, 78, 6], 33, 3.2, "iron", 0, 6);
  const brew = ellipsoid([56, 80, 6], [31, 2.6, 19], "brew");
  const legs = [cone([30, 106, 14], [24, 120, 16], 4, 2.6, "iron"), cone([82, 106, 14], [88, 120, 16], 4, 2.6, "iron"), cone([56, 110, 26], [56, 121, 28], 4, 2.6, "iron")];
  const bands = [torus([56, 90, 6], 36, 1.3, "iron", 0, 6), torus([56, 100, 6], 33, 1.1, "iron", 0, 8)];
  // 立ちのぼる魂の火
  const souls = [];
  const R = rand(9301);
  for (let i = 0; i < 6; i++) { const x = 32 + R() * 48, y = 70 - R() * 10, z = 10 + R() * 10; souls.push(U(1.5, sphere([x, y, z], 2.4, "soul"), cone([x, y - 1, z], [x + (R() - 0.5) * 3, y - 8, z], 2, 0.3, "soul"))); }
  // 釜の前にひれ伏す信徒 (小さな丸い背)
  const devotees = [];
  for (const [x, z] of [[24, 34], [88, 34]]) devotees.push(U(1.5, ellipsoid([x, 118, z], [6, 4.4, 5], "robe"), ellipsoid([x - (x < 56 ? -5 : 5), 120, z + 3], [2.6, 2.2, 2.6], "robe")));
  const scene = U(0, lavaFloor(56, 124, 56, 18, { n: 4, seed: 9303 }), lord, ...hands, ...horns, jaw, brow, ...eyes, crest, pot, lip, brew, ...legs, ...bands, ...souls, ...devotees);
  const r = render(scene, mats, { w: W, h: H, rim: RIM, lights: [{ p: [56, 74, 10], r: 46, k: 0.5 }] });
  const C = new Canvas(r);
  C.set(53, 28, "#fff4a0"); C.set(58, 28, "#fff4a0");
  // 炎の冠と、掌に灯る業火
  for (const [x, w, h, s] of [[56, 3.4, 14, 1], [50, 2.4, 9, 2], [62, 2.4, 9, 3], [45, 1.8, 6, 4], [67, 1.8, 6, 5]]) flame2d(C, x, 22, w, h, { seed: s });
  flame2d(C, 13, 68, 4, 14, { seed: 6 }); flame2d(C, 99, 68, 4, 14, { seed: 7 });
  // 溶岩の血管
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const p = C.pix[y * W + x]; if (p && p.m === "skin" && Math.pow(1 - Math.abs(vnoise(x * 0.16, y * 0.16, 4)), 10) > 0.75) C.set(x, y, "#d24e10"); }
  // 釜の胴に刻まれた火の印
  for (let i = 0; i < 7; i++) { const x = 30 + i * 8.6, y = 95 + Math.round(Math.sin(i) * 0.5); if (C.get(x, y)) { C.set(x, y, "#c43e0c"); C.set(x, y - 1, "#f07a1c"); C.set(x - 1, y, "#7a1a06"); C.set(x + 1, y, "#7a1a06"); } }
  underglow(C, { skip: ["eye", "brew", "soul", "sigil"] });
  embers(C, 9305, 60, [4, 2, W - 8, 70]);
  return C.toArt();
}
