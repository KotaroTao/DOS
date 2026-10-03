import { sphere, ellipsoid, cone, slab, cyl, box, torus, tube, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { FLAG, STONE, WOOD, RIM, flagstones, arrowShafts, ash, grit } from "../fort.mjs";
export const meta = { id: "bs_pikewall", key: "hd_pikewall", w: 96, h: 96,
  note: "亡兵の槍ぶすま: 盾を並べ槍を揃えたまま朽ちた歩兵の隊列。鉄縁の木の塔盾が三枚重なって壁をなし、その上から錆びた鉄兜の髑髏が覗く。壁の隙間から長槍が針山のように前へ突き出し、盾には折れ矢が刺さったまま" };
// 長槍: 石突き (盾の陰) から穂先まで。穂は柄の向きに沿った木の葉形の板
function spear(butt, tip, { L = 9, w = 2.3 } = {}) {
  const dx = tip[0] - butt[0], dy = tip[1] - butt[1], dz = tip[2] - butt[2], l = Math.hypot(dx, dy, dz);
  const ux = dx / l, uy = dy / l, uz = dz / l;
  const base = [tip[0] - ux * L, tip[1] - uy * L, tip[2] - uz * L];
  const l2 = Math.hypot(ux, uy) || 1, nx = -uy / l2, ny = ux / l2, d2x = ux / l2, d2y = uy / l2;
  const P = (a, b) => [tip[0] - d2x * a * L + nx * b, tip[1] - d2y * a * L + ny * b];
  const blade = slab([P(0, 0), P(0.45, w), P(0.85, w * 0.45), P(1, 0.6), P(1, -0.6), P(0.85, -w * 0.45), P(0.45, -w)], (base[2] + tip[2]) / 2, 0.7, "blade", 0.3);
  const socket = cone([base[0] + ux * 1.2, base[1] + uy * 1.2, base[2] + uz * 1.2], [base[0] - ux * 2.4, base[1] - uy * 2.4, base[2] - uz * 2.4], 1.0, 0.75, "iron");
  return [cyl(butt, base, 0.75, "shaft", 0.2), socket, blade];
}
export function build() {
  const mats = {
    board: { ramp: ramp(["#030202", "#0b0806", "#17110c", "#241b12", "#33271a", "#443423", "#58442e", "#6c5639"], 8), dither: 0.6, amb: 0.2,
      shade: p => { const f = ((p.x % 4.6) + 4.6) % 4.6; return (f < 0.7 ? -0.3 : 0) + 0.12 * fbm(p.x * 0.25, p.y * 0.12, 3) + 0.05 * Math.sin(p.y * 2.1 + p.x); } },
    iron: { ramp: ramp(["#020203", "#08090b", "#111317", "#1b1e23", "#262a31", "#343942", "#474d58", "#606874"], 7), spec: 1.1, pow: 35, specCol: "#9ea6b2", dither: 0.5,
      shade: p => 0.1 * fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5) },
    rust: { ramp: ramp(["#040202", "#130805", "#24110a", "#381b0e", "#4e2812", "#663719"], 6), dither: 0.7, shade: p => 0.1 * fbm(p.x * 0.8, p.y * 0.8) },
    bone: { ramp: ramp(["#040403", "#121009", "#221e14", "#343020", "#4a442e", "#625a3e", "#7c7250", "#968a64"], 8), spec: 0.6, pow: 25, specCol: "#b8ac84", dither: 0.5 },
    shaft: { ramp: ramp(["#030202", "#0e0a07", "#1c150e", "#2a2015", "#3a2d1e", "#4a3b28"], 6), dither: 0.4 },
    blade: { ramp: ramp(["#030304", "#0c0d10", "#171a1f", "#242830", "#343a44", "#4c5460", "#6e7682"], 6), spec: 1.6, pow: 40, specCol: "#c4ccd6", dither: 0.4 },
    paint: { ramp: ramp(["#060202", "#1a0805", "#2e0e08", "#44160c", "#5a2012", "#6e2c18"], 5), dither: 0.7, amb: 0.2 },
    cloth: { ramp: ramp(["#030202", "#0c0605", "#180c09", "#24120d", "#321a12"], 5), dither: 0.6, shade: p => 0.1 * Math.sin(p.x * 0.9 + p.y * 0.3) },
    hole: { ramp: ["#000000", "#000000", "#020203"], amb: 0, dif: 0.1, noRim: true },
    eye: { ramp: ["#0c2a2a", "#2a6a66", "#6ac0b4", "#c8f4ea"], emit: p => 0.5 + 0.4 * Math.max(0, p.nz) },
    flag: FLAG, stone: STONE,
  };
  // 中央の盾に褪せた赤い山形の紋 (擦れて途切れる)
  const chevron = (x, y, z) => z > 4 && Math.abs(x - 48) < 11 && Math.abs(y - (50 + Math.abs(x - 48) * 0.9)) < 2.6 && fbm(x * 0.5, y * 0.5, 9) > -0.15;
  mats.wood = mats.shaft;
  const rusty0 = (x, y, z, m) => m === "board" && chevron(x, y, z) ? "paint" : m;
  const rusty = (x, y, z, m) => (m = rusty0(x, y, z, m), m) && (m === "iron" || m === "blade") && fbm(x * 0.28 + 3, y * 0.28, z * 0.28) > (m === "blade" ? 0.32 : 0.2) ? "rust" : m;
  // 塔盾: 縦板を鉄の縁と二本の帯で留め、中央に鋲の盾心。割れ欠けを少し
  const tower = (cx, cy, hw, hh, z, seed) => {
    const R = rand(seed);
    let bd = Disp(box([cx, cy, z], [hw, hh, 1.5], "board", 1.0), (x, y, zz) => 0.18 * fbm(x * 0.6, y * 0.6, zz));
    // 上縁の欠け
    for (let i = 0; i < 2; i++) bd = Sub(bd, sphere([cx - hw + R() * hw * 2, cy - hh - 0.5, z], 1.6 + R() * 1.2, "board"), 0.4);
    const rim = Sub(box([cx, cy, z + 0.4], [hw + 0.7, hh + 0.7, 1.8], "iron", 0.7), box([cx, cy, z + 0.4], [hw - 1.2, hh - 1.2, 4], "iron"));
    const bands = [box([cx, cy - hh * 0.55, z + 1.5], [hw, 0.9, 0.55], "iron", 0.3), box([cx, cy + hh * 0.55, z + 1.5], [hw, 0.9, 0.55], "iron", 0.3)];
    const rivets = [];
    for (const yy of [cy - hh * 0.55, cy + hh * 0.55]) for (let x = cx - hw + 2.5; x < cx + hw - 1; x += 4.2) rivets.push(sphere([x, yy, z + 2.0], 0.65, "iron"));
    const boss = U(0.5, sphere([cx, cy, z + 1.0], 3.2, "iron"), cyl([cx, cy, z + 1], [cx, cy, z + 1.7], 4.2, "iron", 0.4));
    return U(0, bd, rim, ...bands, ...rivets, boss);
  };
  // 三枚の塔盾 (中央が最も手前、高い)
  const shields = [tower(25, 63, 12.5, 22, -1, 3), tower(71, 64, 12.5, 21, -1, 5), tower(48, 62, 12, 24, 3.5, 7)];
  // 盾の上から覗く髑髏と錆びた鉄兜 (三様)
  const skull = (cx, cy, z, tilt = 0) => {
    const s = Sub(U(1.2, ellipsoid([cx, cy, z], [4.4, 5, 4.5], "bone", tilt), ellipsoid([cx, cy + 4.2, z + 1.2], [3, 2, 3], "bone", tilt)),
      U(0, ellipsoid([cx - 1.8, cy + 0.2, z + 4.2], [1.3, 1.5, 2.2], "hole"), ellipsoid([cx + 1.8, cy + 0.2, z + 4.2], [1.3, 1.5, 2.2], "hole"), ellipsoid([cx, cy + 2.6, z + 4.6], [0.6, 0.8, 1.5], "hole"),
        box([cx, cy + 4.5, z + 4.5], [2.4, 0.35, 1.5], "hole")), 0.3);
    return [s, sphere([cx - 1.8, cy + 0.4, z + 2.6], 0.6, "eye"), sphere([cx + 1.8, cy + 0.4, z + 2.6], 0.6, "eye")];
  };
  // 左: 鍔広の鉄帽 (ケトルハット)
  const kettle = U(0.6, Sub(sphere([25, 29, -3], 6.2, "iron"), box([25, 35, -3], [8, 4, 8], "iron")), cyl([25, 30.2, -3], [25, 31.2, -3.2], 9.2, "iron", 0.4));
  // 中央: 尖った兜に鼻当て
  const pointed = U(0.8, Sub(cone([48, 27, 1], [48, 14, 1], 5.8, 1.2, "iron"), box([48, 33, 1], [8, 3, 8], "iron")), box([48, 30.5, 6.2], [0.8, 3, 0.8], "iron", 0.3), torus([48, 26.6, 1], 5.6, 0.9, "iron", 0, 0));
  // 右: へこんだ丸兜 (片側が裂けて頭蓋が覗く)
  const dented = Sub(Sub(sphere([71, 29, -3], 6, "iron"), box([71, 35, -3], [8, 4, 8], "iron")), sphere([75.5, 26, 1.5], 2.6, "iron"), 0.5);
  const heads = [...skull(25, 32, -2), ...skull(48, 29, 2), ...skull(71, 32.5, -2, 6)];
  // 肩と手: 盾の上縁に掛かる骨の指、肩口の朽ちた布
  const necks = [cyl([25, 36, -3], [25, 44, -4], 1.3, "bone"), cyl([48, 33, 1], [48, 40, 0], 1.3, "bone"), cyl([71, 36, -3], [71, 44, -4], 1.3, "bone")];
  const shoulders = [ellipsoid([19, 46, -4], [6, 3, 4], "cloth"), ellipsoid([31, 46, -4], [5, 3, 4], "cloth"), ellipsoid([42, 43, 0], [5, 3, 4], "cloth"), ellipsoid([54, 43, 0], [5, 3, 4], "cloth"), ellipsoid([65, 46, -4], [5, 3, 4], "cloth"), ellipsoid([77, 46, -4], [6, 3, 4], "cloth")];
  const grip = (x, y, z) => { const f = []; for (let i = 0; i < 3; i++) f.push(tube([[x - 1.4 + i * 1.4, y - 0.8, z - 1.2, 0.75], [x - 1.4 + i * 1.4, y + 0.6, z + 1.2, 0.6], [x - 1.4 + i * 1.4, y + 2.4, z + 1.6, 0.5]], "bone", { seg: 2 })); return f; };
  // 槍ぶすま: 左の兵は左上へ、右の兵は右上へ、中央は前へ。盾の隙間から横へも二本
  const spears = [
    ...spear([36, 58, -8], [3, 10, 16]),
    ...spear([44, 60, -8], [27, 3, 18]),
    ...spear([52, 60, -8], [69, 3, 18]),
    ...spear([60, 58, -8], [93, 10, 16]),
    ...spear([52, 72, -6], [2, 60, 14], { L: 8 }),
    ...spear([44, 74, -6], [94, 66, 14], { L: 8 }),
  ];
  const hands = [...grip(20.5, 39.6, 2), ...grip(37, 37.6, 6.5), ...grip(59, 37.6, 6.5), ...grip(76, 39.6, 2)];
  // 盾に刺さった折れ矢
  const arrows = arrowShafts([[30, 56, 1, -3, -6, 6], [44, 70, 5.5, 4, -5, 7], [66, 75, 1, 5, -4, 6]]);
  const scene = U(0, flagstones(48, 90, 46, 14, { n: 5, seed: 61 }), ...shields, ...heads, kettle, pointed, dented, ...necks, ...shoulders, ...spears, ...hands, ...arrows);
  const r = render(Paint(scene, rusty), mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  // 矢羽
  for (const [x, y] of [[27, 51], [28, 50], [48, 65], [49, 65], [71, 71], [72, 71]]) C.only(x, y, "#5c5f68");
  // 眼窩の燐光の芯
  for (const [x, y] of [[23, 32], [27, 32], [46, 29], [50, 29], [69, 32], [73, 32]]) C.only(x, y, "#c8f4ea");
  grit(C, 63, 48, 90, 42);
  ash(C, 67, 14, [2, 2, 92, 70], true);
  return C.toArt();
}
