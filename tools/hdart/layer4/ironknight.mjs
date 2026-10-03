import { sphere, ellipsoid, cone, slab, cyl, box, torus, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { FLAG, STONE, WOOD, RIM, flagstones, arrowShafts, ash, grit } from "../fort.mjs";
export const meta = { id: "bs_ironknight", key: "hd_ironknight", w: 96, h: 96,
  note: "鉄の騎士: 古代に鋳造された鉄塊の自動人形。箱を積んだような寸胴の胴に鋲を打った分厚い板金、のぞき穴が一本の横スリットだけの桶兜、その奥に青白い炉の光。両手で地に突いた巨大な鉄塊の剣、関節から歯車がのぞく" };
export function build() {
  const mats = {
    iron: { ramp: ramp(["#020203", "#07080a", "#0f1114", "#181b20", "#22262d", "#2e333c", "#3d434e", "#525a66", "#6c7480"], 9), spec: 1.2, pow: 35, specCol: "#a8b0bc", dither: 0.5,
      shade: p => 0.12 * fbm(p.x * 0.35, p.y * 0.35, p.z * 0.35) - 0.08 * Math.max(0, fbm(p.x * 0.9, p.y * 0.9, 3)) },
    rust: { ramp: ramp(["#040202", "#120805", "#22100a", "#341a0e", "#4a2812", "#5e3618"], 6), dither: 0.7, shade: p => 0.1 * fbm(p.x * 0.8, p.y * 0.8) },
    brass: { ramp: ramp(["#050302", "#160f05", "#2c1f0a", "#463210", "#644a18", "#866624"], 6), spec: 1.2, pow: 30, specCol: "#d8b870", dither: 0.4 },
    glow: { ramp: ["#0a2a3a", "#2a7a9a", "#7ad0ee", "#d8f6ff"], emit: p => 0.55 + 0.45 * Math.max(0, p.nz) },
    hole: { ramp: ["#000000", "#000000", "#020203"], amb: 0, dif: 0.1, noRim: true },
    flag: FLAG, stone: STONE, wood: WOOD,
  };
  const rusty = (x, y, z, m) => m === "iron" && fbm(x * 0.3, y * 0.3, z * 0.3) > 0.28 ? "rust" : m;
  // 寸胴の胴: 角を落とした箱を二段に積む
  const chest = box([48, 40, 0], [15, 11, 9], "iron", 3.5);
  const belly = box([48, 56, -1], [12, 7, 8], "iron", 3);
  const plates = [box([48, 63, 1], [13, 2.4, 8.6], "iron", 1), box([48, 68, 0], [12, 2.4, 8], "iron", 1)];
  // 桶兜: 円柱に一本のスリット
  const helm = cyl([48, 13, 2], [48, 30, 2], 8.5, "iron", 2);
  const slit = box([48, 21, 10], [6, 0.9, 3], "hole", 0.2);
  const crest = slab([[46.5, 4], [49.5, 4], [50, 13], [46, 13]], 2, 1.2, "iron", 0.5);
  // 肩の大きな円盾状の肩当て
  const pauldrons = [ellipsoid([31, 33, 1], [8, 6, 8], "iron", 15), ellipsoid([65, 33, 1], [8, 6, 8], "iron", -15)];
  // 腕: 太い管 + 歯車の肘
  const arms = [cyl([30, 38, 2], [32, 54, 6], 4.2, "iron", 1.5), cyl([66, 38, 2], [64, 54, 6], 4.2, "iron", 1.5),
    cyl([32, 56, 7], [42, 64, 12], 3.6, "iron", 1.4), cyl([64, 56, 7], [54, 64, 12], 3.6, "iron", 1.4)];
  const gears = [torus([32, 55, 7], 2.6, 1.1, "brass", 0, 90), torus([64, 55, 7], 2.6, 1.1, "brass", 0, 90)];
  const fists = [box([44, 65, 13], [3.6, 3.4, 3.6], "iron", 1.4), box([52, 65, 13], [3.6, 3.4, 3.6], "iron", 1.4)];
  // 地に突いた鉄塊の剣: 柄頭・鍔・幅広の刃
  const sword = U(0, sphere([48, 58, 14], 2.4, "brass"), cyl([48, 60, 14], [48, 68, 14], 1.5, "rust"), box([48, 69.5, 14], [9, 1.4, 2], "iron", 0.6),
    slab([[43.5, 71], [52.5, 71], [52, 87], [48, 92], [44, 87]], 14, 1.4, "iron", 0.4, 0.6),
    cone([48, 71, 15.6], [48, 89, 15.2], 1.3, 0.5, "iron"));
  // 脚: 短く太い円柱と箱の足
  const legs = [cyl([40, 70, -1], [39, 86, 1], 5, "iron", 1.8), cyl([56, 70, -1], [57, 86, 1], 5, "iron", 1.8)];
  const knees = [torus([39.5, 78, 2], 3.4, 1.2, "brass", 0, 80), torus([56.5, 78, 2], 3.4, 1.2, "brass", 0, 80)];
  const feet = [box([38, 88, 3], [5.5, 2.6, 7], "iron", 1.5), box([58, 88, 3], [5.5, 2.6, 7], "iron", 1.5)];
  // 胸の鋲と炉の覗き窓
  const rivets = [];
  for (const [x, y] of [[36, 32], [42, 31], [54, 31], [60, 32], [36, 48], [60, 48], [38, 54], [58, 54]]) rivets.push(sphere([x, y, 8.8], 1, "brass"));
  const grate = Sub(cyl([48, 42, 6], [48, 42, 9.6], 4.4, "iron", 0.5), cyl([48, 42, 8], [48, 42, 12], 3, "glow"));
  const core = sphere([48, 42, 7], 3.2, "glow");
  const knight = Disp(U(1.2, chest, belly, ...pauldrons, helm), (x, y, z) => 0.15 * fbm(x * 0.6, y * 0.6, z * 0.6));
  const scene = U(0, flagstones(48, 92, 44, 14, { n: 5, seed: 41 }),
    ...arrowShafts([[17, 90, 6, -3, -8, 9], [79, 91, 4, 4, -9, 8]]),
    Sub(knight, slit, 0.3), crest, ...plates, ...arms, ...gears, ...fists, sword, ...legs, ...knees, ...feet, ...rivets, grate, core);
  const C0 = Paint(scene, rusty);
  const r = render(C0, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [48, 42, 18], r: 22, k: 0.5 }] });
  const C = new Canvas(r);
  // スリットの奥の炉の光
  for (let x = 44; x <= 52; x++) C.only(x, 21, x % 3 ? "#2a7a9a" : "#7ad0ee");
  // 矢羽
  for (const [x, y] of [[14, 82], [15, 82], [83, 82], [82, 82]]) C.set(x, y, "#5c5f68");
  grit(C, 43, 48, 91, 40);
  ash(C, 47, 18);
  return C.toArt();
}
