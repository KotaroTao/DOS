import { sphere, ellipsoid, cone, slab, cyl, box, torus, tube, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { humanoid, fingers } from "../human.mjs";
import { FLAG, STONE, RIM, flagstones, ash, grit } from "../fort.mjs";
export const meta = { id: "bs_bloodorc", key: "hd_bloodorc", w: 96, h: 96,
  note: "血狂いのオーク: 赤褐色の肌に返り血と白い戦化粧のオーク。逆立つ黒いたてがみ、吠えて開いた口に牙、刃こぼれした肉切り包丁を両手に振り上げて前へのめる。自ら噛んだ腕の傷から湯気の立つ血が滴る" };
export function build() {
  const mats = {
    skin: { ramp: ramp(["#040201", "#0e0604", "#1a0c07", "#28130b", "#381c10", "#4a2716", "#5e341e", "#764428", "#8e5634"], 9), spec: 0.8, pow: 25, specCol: "#b07a54", dither: 0.55,
      shade: p => 0.1 * fbm(p.x * 0.4, p.y * 0.4, p.z * 0.4) },
    blood: { ramp: ramp(["#080101", "#1e0303", "#380606", "#560a08", "#760f0a", "#9a1a10"], 6), spec: 1.4, pow: 40, specCol: "#e06a50", dither: 0.4 },
    warpaint: { ramp: ramp(["#0c0a08", "#2a2620", "#4a443a", "#6c6656", "#8e8672", "#aca48c"], 4), dither: 0.5 },
    hair: { ramp: ramp(["#010101", "#060505", "#0d0b0a", "#161311", "#211d19"], 5), spec: 0.6, pow: 20, specCol: "#3a3430", dither: 0.5 },
    tusk: { ramp: ramp(["#060504", "#1c180f", "#3a3222", "#5e5438", "#8a7e58", "#b4a87c"], 5), spec: 1.2, pow: 40, specCol: "#ece2c0", dither: 0.4 },
    leather: { ramp: ramp(["#030202", "#0c0806", "#18100b", "#241810", "#322216", "#422d1d"], 6), dither: 0.55, shade: p => 0.08 * fbm(p.x * 0.6, p.y * 0.6) },
    steel: { ramp: ramp(["#020203", "#08090b", "#121418", "#1d2026", "#2a2e36", "#3c414b", "#555b66", "#737a86"], 7), spec: 1.4, pow: 40, specCol: "#bcc4d0", dither: 0.45,
      shade: p => 0.1 * fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5) },
    eye: { ramp: ["#3a1400", "#8a3c04", "#e8a020", "#fff0a0"], emit: p => 0.55 + 0.4 * Math.max(0, p.nz) },
    maw: { ramp: ["#000000", "#140304", "#2a0607"], amb: 0.2, dif: 0.25, noRim: true },
    flag: FLAG, stone: { ...STONE, ramp: ramp(["#030303", "#141416", "#2b2d31", "#4c4f56"], 5) },
  };
  // 前へのめり、両腕を高く振り上げた狂乱の構え。頭は胸の前へ突き出る
  const J = { head: [48, 30, 14], neck: [48, 35, 8], chest: [48, 45, 3], waist: [48, 58, 0], hip: [48, 66, -1],
    shL: [32, 38, 4], elL: [19, 28, 6], haL: [22, 14, 8], shR: [64, 38, 4], elR: [77, 28, 6], haR: [74, 14, 8],
    hpL: [40, 68, 0], knL: [31, 79, 7], ftL: [27, 89, 4], hpR: [56, 68, -1], knR: [65, 79, 7], ftR: [69, 89, 4] };
  const body = humanoid(J, { skin: "skin", hip: "leather" }, { w: { headX: 7.2, headY: 6.8, headZ: 6.6, neck: 5.4, chestX: 15, chestY: 10, chestZ: 9, waistX: 10.5, waistY: 8, waistZ: 7.5, hipX: 11, hipY: 6, hipZ: 7.5,
    arm: 5.4, arm2: 4.6, wrist: 3.6, thigh: 5.4, knee: 4.4, ankle: 3.4 }, k: 2.6 });
  // 盛り上がる肩と胸、握った拳
  const delts = [ellipsoid([31, 37, 4], [7, 6, 6.5], "skin", -30), ellipsoid([65, 37, 4], [7, 6, 6.5], "skin", 30)];
  const pecs = [ellipsoid([42, 45, 9], [6.5, 4.6, 4], "skin", 10), ellipsoid([54, 45, 9], [6.5, 4.6, 4], "skin", -10)];
  const fists = [ellipsoid([22, 13, 9], [4.4, 4.6, 4.4], "skin"), ellipsoid([74, 13, 9], [4.4, 4.6, 4.4], "skin")];
  const brow = ellipsoid([48, 26, 19], [6.5, 2.2, 3], "skin");
  const jaw = ellipsoid([48, 36.5, 17], [6.2, 3.6, 4.2], "skin");
  // 吠える大口
  const mouth = ellipsoid([48, 34, 21.5], [3.5, 2.8, 3], "maw");
  // 返り血・戦化粧・腕の噛み傷を塗り分け
  const paintFn = (x, y, z, m) => {
    if (m !== "skin") return m;
    // 腕の噛み傷 (左前腕)
    if (Math.hypot(x - 20, y - 22, z - 9) < 3.6) return "blood";
    // 白い戦化粧: 眼を横切る帯と胸の三本線
    if (z > 15 && y > 22 && y < 34 && (Math.abs(x - 44.6) < 0.9 || Math.abs(x - 51.4) < 0.9) && !(y > 27 && y < 29.5)) return "warpaint";
    if (z > 15 && y > 20 && y < 25.5 && Math.abs(x - 48) < 0.9) return "warpaint";
    if (z > 8 && y > 41 && y < 54 && Math.abs(((x - 48 + (y - 41) * 0.6) % 6 + 6) % 6 - 3) < 0.8 && Math.abs(x - 48) < 12) return "warpaint";
    // 返り血の飛沫 (胸から顔・腕へ)
    const sp = fbm(x * 0.35 + 11, y * 0.35, z * 0.35, 3) + 0.25 * vnoise(x * 1.3, y * 1.3, z);
    if (sp > 0.34 && y < 62) return "blood";
    return m;
  };
  const orc = Paint(Disp(U(2.2, body, ...delts, ...pecs, ...fists, brow, jaw), (x, y, z) => 0.16 * fbm(x * 0.5, y * 0.5, z * 0.5)), paintFn);
  const tusks = [cone([44, 36.5, 20], [41.5, 30.5, 22.5], 1.15, 0.3, "tusk"), cone([52, 36.5, 20], [54.5, 30.5, 22.5], 1.15, 0.3, "tusk")];
  const ears = [cone([42, 28, 11], [33, 22, 8], 2, 0.3, "skin"), cone([54, 28, 11], [63, 22, 8], 2, 0.3, "skin")];
  const eyes = [sphere([44.6, 28.2, 19.2], 1.1, "eye"), sphere([51.4, 28.2, 19.2], 1.1, "eye")];
  // 逆立つたてがみ: 頭頂から背へ、黒い棘の房
  const mane = [];
  const R = rand(19);
  for (let i = 0; i < 19; i++) {
    const t = i / 18, a = -Math.PI * (0.12 + 0.76 * t);
    const bx = 48 + Math.cos(a) * 4.5, by = 25 + Math.sin(a) * 3.5, bz = 10 - Math.abs(t - 0.5) * 6;
    const L = 9 + R() * 6 + Math.abs(t - 0.5) * 9;
    mane.push(cone([bx, by, bz], [bx + Math.cos(a) * L * 0.8, by + Math.sin(a) * L - 2, bz - 3], 2.2, 0.3, "hair"));
  }
  for (let i = 0; i < 6; i++) mane.push(cone([48 + (i % 2 ? 2 : -2), 30 + i * 2.5, 2 - i], [48 + (i % 2 ? 9 : -9), 20 + i * 2.5, -4 - i], 2, 0.3, "hair"));
  // 肉切り包丁: 握りから外上へ伸びる幅広の刃。刃縁は刃こぼれで欠ける
  const cleaver = (hx, hy, side) => {
    const s = side;
    const handle = cyl([hx + s * 1, hy + 4, 10], [hx - s * 4, hy - 4, 10], 1.3, "leather", 0.3);
    const pts = [[hx - s * 3, hy - 3], [hx - s * 7, hy - 13], [hx - s * 19, hy - 9], [hx - s * 16, hy + 2]].map(([x, y]) => [x, y]);
    let blade = slab(pts, 10, 0.9, "steel", 0.3);
    const R2 = rand(side > 0 ? 31 : 37);
    // 刃縁 (外側の辺) の欠け
    for (let i = 0; i < 4; i++) { const t = 0.15 + R2() * 0.7; const ex = pts[2][0] + (pts[3][0] - pts[2][0]) * t, ey = pts[2][1] + (pts[3][1] - pts[2][1]) * t; blade = Sub(blade, sphere([ex - s * 0.4, ey, 10], 1.1 + R2() * 0.8, "steel"), 0.2); }
    const hole = cyl([hx - s * 8, hy - 9, 8], [hx - s * 8, hy - 9, 12], 1.3, "maw");
    return [Sub(blade, hole), handle, sphere([hx - s * 4.4, hy - 4.4, 10], 1.6, "steel")];
  };
  const blades = [...cleaver(22, 14, 1), ...cleaver(74, 14, -1)];
  // 腰巻き・鋲打ちの革帯
  const belt = torus([48, 61, 0], 11, 2, "leather", 0, 6);
  const studs = []; for (let i = 0; i < 6; i++) { const a = 0.45 + i * 0.45; studs.push(sphere([48 + Math.cos(a + 0.4) * 11.5, 61.5, Math.sin(a + 0.4) * 8 + 2], 0.9, "steel")); }
  const loin = Disp(slab([[38, 63], [58, 63], [57, 78], [52, 74], [48, 80], [44, 74], [39, 78]], 8, 1.4, "leather", 0.6), (x, y, z) => 0.3 * Math.sin(x * 1.2));
  const scene = U(0, flagstones(48, 92, 44, 14, { n: 5, seed: 83 }), Sub(orc, mouth, 0.6), ...tusks, ...ears, ...eyes, ...mane, ...blades, belt, ...studs, loin);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [48, 60, 30], r: 40, k: 0.25 }, { p: [38, 22, 36], r: 42, k: 0.6 }] });
  const C = new Canvas(r);
  // 刃の返り血と滴り
  const B = ["#380606", "#560a08", "#760f0a", "#9a1a10"];
  const Rb = rand(41);
  for (let i = 0; i < 40; i++) { const x = Math.round(4 + Rb() * 88), y = Math.round(2 + Rb() * 20); const p = C.pix[y * 96 + x]; if (p && p.m === "steel") { C.set(x, y, B[Math.floor(Rb() * 3)]); if (Rb() < 0.4) C.only(x, y + 1, B[0]); } }
  // 噛み傷の歯形と、腕を伝う血
  for (const [x, y] of [[18, 21], [20, 20], [22, 21], [18, 24], [20, 25], [22, 24]]) C.only(x, y, "#000000");
  for (let i = 0; i < 9; i++) C.only(23, 26 + i, B[i % 3 === 0 ? 3 : 1]);
  for (let i = 0; i < 4; i++) C.set(23, 36 + i * 1.4, B[2]);
  // 湯気: 血から立つ淡い紅灰の筋
  const S = ["#28130b", "#381c10", "#4a2716"];
  for (const [x0, y0, n] of [[17, 18, 9], [12, 6, 7], [86, 6, 7], [46, 20, 5]]) for (let i = 0; i < n; i++) { const x = x0 + Math.sin(i * 0.9 + x0) * 1.5, y = y0 - i * 1.4; if (!C.get(Math.round(x), Math.round(y)) && i % 3 !== 2) C.set(x, y, S[Math.min(2, Math.floor(i / 3))]); }
  // 口の中の牙
  for (const x of [45, 47, 49, 51]) { C.only(x, 31, "#8a7e58"); C.only(x, 36, "#5e5438"); }
  C.set(44, 27, "#fff0a0"); C.set(51, 27, "#fff0a0");
  // 床の血だまり
  for (let x = 40; x <= 58; x++) if (Math.abs(x - 49) < 9 - Math.abs(Math.sin(x)) * 2) C.only(x, 91 + (x % 3 === 0 ? 1 : 0), x % 2 ? "#380606" : "#1e0303");
  grit(C, 87, 48, 91, 40);
  ash(C, 89, 16, [2, 2, 92, 70], true);
  return C.toArt();
}
