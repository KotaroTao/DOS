import { sphere, ellipsoid, cone, slab, cyl, box, torus, tube, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { FLAG, STONE, WOOD, RIM, flagstones, arrowShafts, ash, grit } from "../fort.mjs";
import { fingers } from "../human.mjs";
export const meta = { id: "bs_gravecaptain", key: "hd_gravecaptain", w: 96, h: 96,
  note: "亡き守備隊長: 落城の日に斃れた守備隊長の骸。前後の先が尖って反り上がる舟形の鍔と櫛形の鶏冠を持つ鉄のモリオン兜、鶏冠の付け根に色褪せた赤い羽根飾り、へこんだ錆の胸甲、ぼろぼろの肩帯と外套。錆びた指揮刀を前へ突きつけて号令し、髑髏の眼窩には激昂の熾火が燃える" };
export function build() {
  const mats = {
    iron: { ramp: ramp(["#030202", "#0a0807", "#14100c", "#1f1912", "#2c2419", "#3a3022", "#4c3e2c", "#62523a"], 6), spec: 1.2, pow: 30, specCol: "#a89070", dither: 0.5,
      shade: p => 0.1 * fbm(p.x * 0.4, p.y * 0.4, p.z * 0.4) },
    rust: { ramp: ramp(["#040201", "#130805", "#24100a", "#38190d", "#4e2612", "#683618"], 4), dither: 0.7, shade: p => 0.1 * fbm(p.x * 0.8, p.y * 0.8) },
    bone: { ramp: ramp(["#060504", "#16130e", "#2a251c", "#40392c", "#58503e", "#726852", "#908670", "#b0a68c"], 6), spec: 0.6, pow: 25, dither: 0.5, amb: 0.18,
      shade: p => 0.08 * fbm(p.x * 0.7, p.y * 0.7, p.z * 0.7) },
    red: { ramp: ramp(["#060203", "#170607", "#2a0c0c", "#401412", "#581e18", "#702a20"], 5), dither: 0.6, amb: 0.2,
      shade: p => 0.12 * Math.sin(p.x * 0.9 + p.y * 0.3) },
    cloth: { ramp: ramp(["#030303", "#09090a", "#121214", "#1c1c1f", "#26272b", "#323439"], 4), dither: 0.65, amb: 0.2,
      shade: p => 0.12 * Math.sin(p.x * 0.7 + p.y * 0.08) },
    leather: { ramp: ramp(["#030202", "#0c0806", "#18100b", "#241811", "#322218", "#422e20"], 5), spec: 0.6, pow: 25, dither: 0.5 },
    brass: { ramp: ramp(["#050302", "#160f05", "#2c1f0a", "#463210", "#644a18", "#866624", "#a88636"], 5), spec: 1.4, pow: 35, specCol: "#f0d890", dither: 0.4 },
    steel: { ramp: ramp(["#0b0b0c", "#1c1c1f", "#303035", "#4a4a50", "#6c6c74", "#92929a"], 6), spec: 1.8, pow: 30, specCol: "#d4d4dc", dither: 0.45, amb: 0.3,
      shade: p => 0.06 * fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5) },
    eye: { ramp: ["#3a0800", "#9a1c04", "#ff5a14", "#ffc070"], emit: p => 0.6 + 0.4 * Math.max(0, p.nz) },
    void: { ramp: ["#000000", "#000000", "#020101"], amb: 0, dif: 0.05, noRim: true },
    flag: FLAG, stone: STONE, wood: WOOD,
  };
  const rusty = (x, y, z, m) => (m === "iron" && fbm(x * 0.25 + 3, y * 0.25, z * 0.25) > 0.15) ? "rust" : m;
  // 外套: 背から右へなびき、裾はぼろぼろ
  const capePoly = [[40, 30], [62, 30], [72, 44], [82, 60], [86, 76], [80, 72], [78, 84], [72, 78], [66, 86], [60, 80], [44, 84], [36, 78], [34, 60], [36, 44]];
  const cape = Disp(slab(capePoly, -7, 1.3, "cloth", 0.8), (x, y, z) => 0.8 * Math.sin(x * 0.55 + y * 0.12 + 1.4 * fbm(x * 0.2, y * 0.2)));
  // 胴: へこんだ丸い胸甲 (鳩胸)、腰の草摺
  const dents = U(0, sphere([45, 37, 10.2], 2.6, "iron"), sphere([55, 45, 9.4], 2.2, "iron"), sphere([50, 48, 8.4], 1.6, "iron"));
  const breast = Sub(U(1, ellipsoid([50, 41, 0], [10.6, 9.6, 7.4], "iron"), ellipsoid([50, 43, 2.6], [2, 8.6, 6.4], "iron")), dents, 1.2);
  const tassets = [0, 1].map(i => Sub(ellipsoid([50, 53 + i * 3.4, -0.5], [9.6 + i, 2.4, 7 + i * 0.4], "iron"), ellipsoid([50, 51.2 + i * 3.4, -0.5], [8.6 + i, 2.4, 6.2 + i * 0.4], "iron")));
  const belt = cyl([50, 51, 0], [50, 52.6, 0], 9.2, "leather", 0.4);
  // 肩帯: 右肩から左腰へ斜めにかかる赤い帯、端は千切れて垂れる
  const sash = Disp(slab([[57, 31], [61, 33], [44, 54], [40, 52]], 8.4, 0.7, "red", 0.4), (x, y, z) => 0.3 * Math.sin(x * 1.2));
  const sashEnd = Disp(slab([[40, 51], [44, 53], [43, 64], [41, 61], [39, 66], [38, 58]], 8, 0.6, "red", 0.3), (x, y, z) => 0.3 * Math.sin(y * 1.1));
  // 肩当て
  const pauldR = [ellipsoid([60, 33, 1], [6.8, 4.4, 6], "iron", 18), ellipsoid([61, 36.4, 1.6], [6, 2.6, 5.4], "iron", 22)];
  const pauldL = [ellipsoid([40, 33, 2], [6.6, 4.4, 6], "iron", -14), ellipsoid([38.6, 36.2, 2.6], [5.8, 2.6, 5.4], "iron", -10)];
  // 髑髏の頭: 眼窩に熾火、歯の並ぶ顎
  const skull = Sub(U(1, ellipsoid([51, 24, 4], [5, 5.4, 5], "bone"), ellipsoid([51, 28.8, 5.4], [3.6, 2.2, 3.6], "bone")),
    U(0, ellipsoid([48.8, 24.4, 8.4], [1.9, 2.1, 2.6], "void"), ellipsoid([53.6, 24.4, 8.2], [1.9, 2.1, 2.6], "void"), cone([51.2, 26.6, 9.2], [51.2, 27.8, 8.8], 0.9, 0.4, "void"),
      box([51.2, 29.6, 8.6], [2.6, 0.55, 2], "void", 0.2)), 0.4);
  const eyes = [sphere([49, 24.8, 6.2], 0.6, "eye"), sphere([53.4, 24.8, 6], 0.6, "eye")];
  const neck = [cyl([51, 30, 3], [51, 33, 2], 1.6, "bone", 0.5), cyl([51, 30.4, 2.6], [51, 31.6, 2.6], 4.4, "iron", 0.6)];
  // モリオン兜: 顔をやや左 (刀の向き) へ振った斜めの向きで組む。前後に長く尖って反る舟形の鍔、頭頂を前後に走る櫛形の鶏冠
  const Hc = [51, 18, 4], yaw = 22 * Math.PI / 180;
  const F = [-Math.cos(yaw), Math.sin(yaw)], Sd = [Math.sin(yaw), Math.cos(yaw)]; // 前 (左手前) と横 (xz 平面)
  const toL = (x, z) => { const dx = x - Hc[0], dz = z - Hc[2]; return [Hc[0] + dx * F[0] + dz * F[1], Hc[2] + dx * Sd[0] + dz * Sd[1]]; };
  const yawLeaf = (prim, R) => ({ leaf: true, mat: prim.mat, bound: [Hc[0], Hc[1], Hc[2], R], f: (x, y, z) => { const [lx, lz] = toL(x, z); return prim.f(lx, y, lz); } });
  // 鍔: 前後に尖る紡錘形 (左右は短い)、両端が上へ反る
  const brimLeaf = { leaf: true, mat: "steel", bound: [Hc[0], Hc[1], Hc[2], 16], f: (x, y, z) => {
    const [lx, lz] = toL(x, z), dx = lx - Hc[0], dz = lz - Hc[2];
    const r = 14.4, d = 8.4, b = Math.sqrt(r * r - d * d), px = Math.abs(dz), py = Math.abs(dx);
    const v = ((py - b) * d > px * b) ? Math.hypot(px, py - b) : Math.hypot(px + d, py) - r;
    const yc = 21 - 0.068 * dx * dx;
    const w = Math.abs(y - yc) * 0.85 - 0.55;
    return Math.hypot(Math.max(v, 0), Math.max(w, 0)) + Math.min(Math.max(v, w), 0) - 0.2;
  } };
  // 鉢: 平らな底のやや尖った丸鉢
  const bowlE = ellipsoid([Hc[0], 19, Hc[2]], [5.8, 4.8, 4.8], "steel");
  const crownLeaf = { leaf: true, mat: "steel", bound: [Hc[0], Hc[1], Hc[2], 9], f: (x, y, z) => { const [lx, lz] = toL(x, z); return Math.max(bowlE.f(lx, y, lz), y - 20.4); } };
  // 鶏冠: 鉢の頂を前から後ろへ越える半月の板
  const combPts = [];
  for (let i = 0; i <= 12; i++) { const a = Math.PI * i / 12; combPts.push([Hc[0] - Math.cos(a) * 6.4, 16.4 - Math.sin(a) * 9.6]); }
  combPts.push([Hc[0] + 5.6, 18.4], [Hc[0] - 5.6, 18.4]);
  const combLeaf = yawLeaf(slab(combPts, Hc[2], 0.75, "steel", 0.35, 0.25), 12);
  const rivets = [-3.2, 0, 3.2].map(t => { const x = Hc[0] + F[0] * t, z = Hc[2] + F[1] * t; return sphere([x + Sd[0] * 5.1, 19.6, z + Sd[1] * 5.1], 0.7, "brass"); });
  // 羽根飾り: 鶏冠の後ろの付け根から後ろ上へ
  const pb = [Hc[0] - F[0] * 6.6, 16.4, Hc[2] - F[1] * 6.6 - 1];
  const plume = [tube([[pb[0], pb[1], pb[2] - 1, 1.3], [pb[0] + 1.6, 9, pb[2] - 1.5, 1.6], [pb[0] + 5, 4, pb[2] - 2, 1.5], [pb[0] + 10, 2.4, pb[2] - 2.5, 1.1], [pb[0] + 15, 4.4, pb[2] - 3, 0.6]], "red"),
    tube([[pb[0] + 0.6, pb[1], pb[2] - 1.5, 1.1], [pb[0] + 3, 10, pb[2] - 2, 1.3], [pb[0] + 7.6, 7, pb[2] - 2.5, 1.1], [pb[0] + 13, 8, pb[2] - 3, 0.8], [pb[0] + 16, 11.6, pb[2] - 3, 0.4]], "red"),
    tube([[pb[0] - 0.4, pb[1] - 1, pb[2] - 0.5, 1], [pb[0] + 0.4, 6, pb[2] - 1, 1.1], [pb[0] + 3, 1.4, pb[2] - 1.5, 0.8], [pb[0] + 7, 0.6, pb[2] - 2, 0.4]], "red")];
  // 指揮刀の腕 (画面左へ伸ばす): 袖は千切れ、骨の手
  const armS = [tube([[40, 35, 2, 3.2], [30, 38, 5, 2.8], [21, 40, 8, 2.2]], "cloth", { seg: 3 }), cyl([31, 37.8, 5.2], [24, 39.6, 7.4], 2.6, "iron", 1),
    ellipsoid([19.6, 40.6, 9], [2.3, 2, 2.2], "bone")];
  // 腰に当てた手 (画面右)
  const armH = [tube([[61, 35, 1, 3.2], [69, 45, 2, 2.8], [61, 52, 7, 2.2]], "cloth", { seg: 3 }), cyl([69, 46, 2.4], [63, 51.4, 6.4], 2.5, "iron", 1),
    ...fingers([60.6, 52.4, 8], 150, "bone", { n: 3, len: 3.4, spread: 12, r: 0.65, curl: 0.4, z: 0.6 })];
  // 錆びた指揮刀: 籠鍔、反った刃を前 (左上) へ
  const hilt = U(0, cyl([22, 41.6, 9], [18, 39.6, 9], 1.1, "leather", 0.3), torus([19.6, 41.4, 9.6], 2.6, 0.5, "brass", -20, 30), sphere([23, 42.2, 9], 1.3, "brass"));
  const cur = [[17.4, 40], [12.4, 37.6], [8, 34.4], [4.6, 30.4], [2.4, 26.6], [1.6, 24]];
  const back = [], edge = [];
  cur.forEach(([x, y], i) => { const q = cur[Math.min(cur.length - 1, i + 1)], o = cur[Math.max(0, i - 1)]; const tx = q[0] - o[0], ty = q[1] - o[1], l = Math.hypot(tx, ty) || 1, nx = ty / l, ny = -tx / l, w = 1.9 * (1 - i / (cur.length - 1)) + 0.2;
    back.push([x - nx * w * 0.3, y - ny * w * 0.3]); edge.push([x + nx * w, y + ny * w]); });
  const blade = slab(back.concat(edge.reverse()), 9, 0.55, "steel", 0.2, 0.3);
  // 脚: 膨らんだ半ズボンと長靴
  const legs = [tube([[45, 60, -1, 4.6], [43, 72, 1, 3.8]], "cloth"), tube([[55, 60, -1, 4.6], [58, 72, 0, 3.8]], "cloth"),
    tube([[43, 72, 1.4, 3.6], [41.6, 80, 2, 3.3], [41, 86, 2, 3]], "leather"), tube([[58, 72, 0.6, 3.6], [59.6, 80, 1, 3.3], [60.6, 86, 1, 3]], "leather"),
    ellipsoid([40, 88.4, 4], [4.4, 2.4, 6], "leather"), ellipsoid([62, 88.4, 3], [4.4, 2.4, 6], "leather")];
  const scene = U(0, flagstones(50, 92, 44, 13, { n: 5, seed: 111 }),
    cape, Paint(U(0, breast, ...tassets, ...pauldR, ...pauldL), rusty), brimLeaf, crownLeaf, combLeaf, ...rivets, belt, sash, sashEnd, skull, ...eyes, ...neck, ...plume,
    ...armS, ...armH, hilt, blade, ...legs);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [51, 25, 14], r: 11, k: 0.35 }] });
  const C = new Canvas(r);
  // 眼窩の熾火
  const E = ["#3a0800", "#9a1c04", "#ff5a14", "#ffc070"];
  for (const ex of [48, 53]) { C.only(ex, 24, E[2]); C.only(ex + 1, 24, E[3]); C.only(ex, 25, E[1]); C.only(ex + 1, 25, E[2]); C.only(ex + (ex < 50 ? -1 : 2), 24, E[0]); }
  // 鶏冠の縁: 上の弧に鈍い照り、付け根に影の線
  const scr = (lx, y) => { const t = lx - Hc[0]; return [Hc[0] + F[0] * t, y]; };
  for (let i = 0; i <= 24; i++) { const a = Math.PI * i / 24; const [sx, sy] = scr(Hc[0] - Math.cos(a) * 6.0, 16.4 - Math.sin(a) * 9.2); if (C.get(Math.round(sx), Math.round(sy))) C.set(sx, sy, i < 13 ? "#92929a" : "#6c6c74"); }
  for (let t = -5; t <= 5; t += 0.5) { const [sx] = scr(Hc[0] + t, 0); const y = 17.2 - 0.02 * t * t; const p = C.pix[Math.round(y) * 96 + Math.round(sx)]; if (p && p.m === "steel") C.set(sx, y, "#1c1c1f"); }
  // 歯
  for (let x = 49; x <= 53; x += 1) C.only(x, 29, x % 2 ? "#908670" : "#58503e");
  // 刃こぼれと錆
  for (const [x, y] of [[11, 37], [6, 33]]) if (C.get(x, y)) C.set(x, y, "#24100a");
  // 熾火の火の粉 (激昂)
  ash(C, 113, 14, [30, 4, 50, 40], true);
  grit(C, 117, 50, 91, 40);
  return C.toArt();
}
