import { sphere, ellipsoid, cone, slab, cyl, box, torus, tube, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { FLAG, STONE, RIM, flagstones, ash, grit } from "../fort.mjs";
export const meta = { id: "bs_bonecolossus", key: "hd_bonecolossus", w: 96, h: 96,
  note: "骨の巨兵: 幾十の骸が融け合って立ち上がった巨大な骨の兵。肋骨の籠と埋もれた頭蓋で膨れた胴、片腕は大腿骨を束ねた棍棒、大きな頭蓋に小さな頭蓋が群がる。骨の隙間から閉じ込められた魂の青白い光が漏れる" };
export function build() {
  const mats = {
    bone: { ramp: ramp(["#050504", "#0c0b09", "#1a1814", "#2a2620", "#3a352c", "#4e483c", "#655e4f", "#7e7664", "#9a917c"], 9), spec: 0.6, pow: 22, specCol: "#bdb6a2", dither: 0.55, gain: 0.95,
      shade: p => 0.12 * fbm(p.x * 0.45, p.y * 0.45, p.z * 0.45) - 0.3 * Math.pow(1 - Math.abs(vnoise(p.x * 0.28, p.y * 0.2, p.z * 0.28)), 8) },
    skull: null,
    marrow: { ramp: ramp(["#020202", "#070706", "#0e0d0b", "#17150f"], 4), dither: 0.5 },
    soul: { ramp: ["#0c2a3a", "#1e5a74", "#4aa0c0", "#a6e4f4", "#e8fcff"], emit: p => 0.3 + 0.55 * Math.max(0, p.nz) * Math.max(0, p.nz) },
    hole: { ramp: ["#000000", "#000000", "#020203"], amb: 0, dif: 0.1, noRim: true },
    flag: FLAG, stone: { ...STONE, ramp: ramp(["#030303", "#0f0f11", "#1f2023", "#33353a", "#4c4f56"], 5) },
  };
  mats.skull = { ...mats.bone, gain: 1.1, amb: 0.22 };
  // 頭蓋: 脳頭蓋 + 顎、眼窩と鼻孔を削る。glow なら眼窩の奥に魂の光
  const skull = ([x, y, z], s, rot = 0, glow = false) => {
    const sk = Sub(U(s * 0.3, ellipsoid([x, y, z], [4 * s, 4.4 * s, 4 * s], "skull", rot), ellipsoid([x, y + 3.4 * s, z + 0.9 * s], [2.7 * s, 1.8 * s, 2.7 * s], "skull", rot)),
      U(0, ellipsoid([x - 1.6 * s, y + 0.4 * s, z + 3.5 * s], [1.15 * s, 1.3 * s, 1.6 * s], "hole"), ellipsoid([x + 1.6 * s, y + 0.4 * s, z + 3.5 * s], [1.15 * s, 1.3 * s, 1.6 * s], "hole"),
        ellipsoid([x, y + 2.3 * s, z + 3.8 * s], [0.5 * s, 0.7 * s, 1.2 * s], "hole"), box([x, y + 3.9 * s, z + 3.3 * s], [2 * s, 0.3 * s, 1.2 * s], "hole")), 0.25 * s);
    return glow ? [sk, sphere([x - 1.6 * s, y + 0.5 * s, z + 2.4 * s], 0.7 * s, "soul"), sphere([x + 1.6 * s, y + 0.5 * s, z + 2.4 * s], 0.7 * s, "soul")] : [sk];
  };
  const R = rand(131);
  // 分厚い胴: 背を丸めた樽のような骨の塊
  const torso = ellipsoid([48, 47, -1], [21, 18, 12], "bone");
  const pelvis = ellipsoid([48, 63, -2], [15, 7, 9], "bone");
  const shoulders = [ellipsoid([27, 35, 0], [9, 8, 9], "bone", -20), ellipsoid([69, 35, 0], [9, 8, 9], "bone", 20)];
  let mass = Disp(U(4, torso, pelvis, ...shoulders), (x, y, z) => 0.6 * fbm(x * 0.2, y * 0.2, z * 0.2) + 0.35 * Math.max(0, vnoise(x * 0.7, y * 0.7, z * 0.7)));
  // 胸の空洞 (肋骨の籠の奥に閉じ込められた魂) と、魂の漏れる裂け目
  mass = Sub(mass, ellipsoid([48, 42, 12], [13.5, 9.5, 8], "marrow"), 1.5);
  const rifts = [ellipsoid([49, 60, 9], [5.5, 3.2, 5], "hole", 8), ellipsoid([32, 56, 8], [2.2, 3, 5], "hole", 20), ellipsoid([66, 52, 8], [2, 2.8, 5], "hole", -15)];
  for (const h of rifts) mass = Sub(mass, h, 1);
  const souls = [sphere([48, 43, 4], 7.5, "soul"), sphere([49, 60, 3.5], 3.6, "soul"), sphere([32, 56, 2], 2.2, "soul"), sphere([66, 52, 2], 2, "soul")];
  // 肋骨の籠: 空洞の前を横に渡る弧と、胸骨
  const ribs = [];
  for (let i = 0; i < 4; i++) { const y = 34.5 + i * 4.6, rr = 15.5 - Math.abs(i - 1.5) * 1.0; ribs.push(Sub(torus([48, y + Math.abs(i - 1.5) * 0.5, -1], rr, 1.15, "bone", i % 2 ? 4 : -4, 3), box([48, y, -12], [30, 6, 10], "bone"))); }
  const sternum = cyl([48, 32, 14], [48, 50, 13], 1.7, "bone", 0.6);
  // 胴に埋もれた頭蓋 (表面に半ば沈める)
  const emb = [];
  for (const [x, y, s, rot] of [[29, 47, 0.85, -20], [67, 44, 0.85, 25], [38, 60, 0.75, 10], [59, 62, 0.7, -10], [26, 34, 0.7, -30], [70, 33, 0.7, 30]]) {
    const dx = (x - 48) / 21, dy = (y - 47) / 18; const zs = -1 + 12 * Math.sqrt(Math.max(0.05, 1 - dx * dx - dy * dy));
    emb.push(...skull([x, y, zs + 0.8 * s], s, rot, R() < 0.4));
  }
  // 膝頭も頭蓋
  emb.push(...skull([34.5, 76, 6], 0.95, -8, false), ...skull([61.5, 76, 6], 0.95, 8, false));
  // 頭: 大きな頭蓋に小さな頭蓋が群がる
  const bigSkull = skull([48, 18, 6], 2.0, 0, true);
  const cluster = [];
  for (const [x, y, z, s, rot] of [[34, 13, 3, 1.0, -30], [62, 13, 3, 1.0, 28], [42, 4.5, 0, 0.9, -12], [55, 4.5, 0, 0.9, 15], [31, 26, 2, 0.8, -40], [65, 26, 2, 0.8, 40]]) cluster.push(...skull([x, y, z], s, rot, false));
  const neck = cyl([48, 26, 0], [48, 32, 0], 5, "bone", 1);
  // 左腕 (向かって左): 太い骨の腕に、指骨の鉤爪
  const armL = tube([[26, 38, 2, 6.5], [18, 54, 5, 5.2], [16, 68, 8, 4.4]], "bone");
  const claws = [];
  for (let i = 0; i < 4; i++) { const a = (70 + i * 16) * Math.PI / 180, b = a + 0.5; const p0 = [16 + (i - 1.5) * 2.2, 71, 9]; const p1 = [p0[0] + Math.cos(a) * 4 - 1, p0[1] + Math.sin(a) * 5, 10]; const p2 = [p1[0] + Math.cos(b) * 3 + 1, p1[1] + Math.sin(b) * 3, 10.5];
    claws.push(tube([[...p0, 1.4], [...p1, 1.1], [...p2, 0.5]], "bone", { seg: 2 })); }
  // 右腕: 大腿骨を何本も束ねた棍棒。鉄の帯の代わりに背骨で縛る
  const armR = tube([[70, 38, 2, 6.5], [77, 50, 5, 5.2], [80, 60, 8, 4.4]], "bone");
  const club = [];
  const femur = (a, b, r) => { const k = 0.35; return U(0.8, cyl(a, b, r, "bone", 0.4), sphere([a[0] - 0.6, a[1], a[2]], r * 1.9, "bone"), sphere([a[0] + r * 1.4, a[1] - 0.4, a[2]], r * 1.5, "bone"), sphere([b[0], b[1], b[2]], r * 1.8, "bone"), sphere([b[0] + r * 1.2, b[1] + 0.6, b[2] - 0.5], r * 1.5, "bone")); };
  for (const [ox, oz, ln] of [[0, 0, 0], [-4, 1.5, 2], [4, 1, -1], [-2, 4.5, 3], [2.2, -2.5, 1], [0.5, 3.5, -2]]) club.push(femur([81 + ox * 0.5, 63, 10 + oz], [85 + ox * 1.25, 87 + ln, 11 + oz], 1.7));
  const lashing = [torus([82, 68, 11], 5.4, 1.2, "bone", 8, 8), torus([83, 75, 11], 6.6, 1.2, "bone", 8, 8)];
  // 胴から突き出す骨片 (腕の骨・脛の骨が融けきらずに飛び出す)
  const shards = [];
  for (const [x, y, dx, dy] of [[22, 30, -5, -6], [74, 29, 5, -6], [20, 45, -6, 1], [76, 46, 6, 2], [30, 64, -5, 4], [66, 66, 5, 4], [38, 28, -3, -6], [58, 28, 3, -6]]) {
    const z = 4, l = Math.hypot(dx, dy), ux = dx / l, uy = dy / l;
    shards.push(U(0.6, cyl([x - ux * 3, y - uy * 3, z], [x + dx, y + dy, z + 2], 1.2, "bone", 0.3), sphere([x + dx, y + dy, z + 2], 1.9, "bone"), sphere([x + dx - uy * 1.3, y + dy + ux * 1.3, z + 2], 1.5, "bone")));
  }
  // 脚: 骨を束ねた太く短い柱
  const legs = [tube([[38, 66, -1, 7], [34, 78, 1, 6], [33, 88, 2, 6.4]], "bone"), tube([[58, 66, -1, 7], [62, 78, 1, 6], [63, 88, 2, 6.4]], "bone")];
  const toes = [];
  for (const fx of [33, 63]) for (let i = 0; i < 3; i++) toes.push(cone([fx - 3 + i * 3, 89, 4], [fx - 4.5 + i * 4.5, 91, 10], 1.6, 0.8, "bone"));
  const body = Disp(U(1.4, mass, sternum, neck, armL, armR, ...legs), (x, y, z) => 0.15 * fbm(x * 0.8, y * 0.8, z * 0.8));
  // 骨の継ぎ目に沈む影の溝 (融け合った骸の境目)
  // 縦に走る溝 (束なった長骨の境目) を足して、骨が寄り集まった感じを出す
  const seams = (x, y, z, m) => (m === "bone" && (Math.abs(vnoise(x * 0.16, y * 0.13, z * 0.16)) < 0.055 || Math.abs(vnoise(x * 0.5, y * 0.06, z * 0.5 + 5)) < 0.075)) ? "marrow" : m;
  const scene = U(0, flagstones(48, 92, 46, 14, { n: 6, seed: 137 }), Paint(body, seams), ...ribs, ...shards, ...souls, ...emb, ...bigSkull, ...cluster, ...claws, ...club, ...lashing, ...toes);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [48, 43, 10], r: 22, k: 0.9 }, { p: [48, 60, 16], r: 14, k: 0.4 }] });
  const C = new Canvas(r);
  // 大頭蓋の眼の芯と、裂け目から漂い出す魂の粒
  for (const [x, y] of [[44, 19], [51, 19]]) C.only(x, y, "#e8fcff");
  const S = ["#1e5a74", "#4aa0c0", "#a6e4f4"];
  const Rs = rand(139);
  for (let i = 0; i < 12; i++) { const x = 40 + Rs() * 20, y = 40 - Rs() * 32; if (!C.get(Math.round(x), Math.round(y))) C.set(x, y, S[Math.floor(Rs() * Rs() * 3)]); }
    grit(C, 141, 48, 91, 42);
  ash(C, 143, 10);
  return C.toArt();
}
