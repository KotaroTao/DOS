import { tube, sphere, ellipsoid, cone, slab, cyl, box, torus, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { humanoid, fingers } from "../human.mjs";
import { FLAG, STONE, WOOD, RIM, flagstones, ash, grit } from "../fort.mjs";
export const meta = { id: "bs_stormgiant", key: "hd_stormgiant", w: 96, h: 96,
  note: "嵐の巨人: 青灰の肌の筋骨の巨体が、肩から背へ渦巻く雷雲を外套のようにまとう。雲の髭と逆立つ雲の髪、白く光る眼。振り上げた拳に稲妻がまとわりつき、踏みしめた足元の石畳は地響きで放射状に割れている" };
export function build() {
  const mats = {
    skin: { ramp: ramp(["#030405", "#090c10", "#10151b", "#182029", "#212c37", "#2c3946", "#394858", "#4a5a6c", "#607284"], 9), spec: 0.8, pow: 25, specCol: "#9cb0c4", dither: 0.55,
      shade: p => 0.08 * fbm(p.x * 0.45, p.y * 0.45, p.z * 0.45) },
    cloud: { ramp: ramp(["#040508", "#0a0d13", "#11151d", "#191e29", "#232a37", "#2f3746", "#3e4758", "#505a6c"], 8), dither: 0.8, amb: 0.16, dif: 0.8,
      shade: p => 0.16 * fbm(p.x * 0.25, p.y * 0.25, p.z * 0.25) },
    beard: { ramp: ramp(["#0c0e12", "#1a1e26", "#2a303b", "#3e4552", "#565e6c", "#747c8a", "#959caa"], 7), dither: 0.7, amb: 0.25,
      shade: p => 0.12 * fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5) },
    leather: { ramp: ramp(["#030202", "#0c0806", "#18100b", "#241810", "#322216", "#42301e"], 6), dither: 0.55, shade: p => 0.1 * fbm(p.x * 0.6, p.y * 0.6) },
    iron: { ramp: ramp(["#020203", "#08090b", "#121418", "#1d2026", "#2a2e36", "#3c414b", "#555b66"], 7), spec: 1.2, pow: 40, specCol: "#aab4c4", dither: 0.45 },
    bolt: { ramp: ["#2a4a6a", "#5a90c0", "#a8d8ff", "#eaf8ff"], emit: p => 0.55 + 0.45 * Math.max(0, p.nz) },
    eye: { ramp: ["#3a5a7a", "#8ac0e8", "#e0f4ff"], emit: p => 0.6 + 0.4 * Math.max(0, p.nz) },
    maw: { ramp: ["#000000", "#05070a", "#0a0e14"], amb: 0.1, dif: 0.2, noRim: true },
    flag: FLAG, stone: STONE,
  };
  // 巨体: 右手 (画面右) の拳を振り上げ、左の拳は低く握る。脚を開いて踏みしめる
  const J = { head: [44, 24, 8], neck: [45, 31, 4], chest: [46, 41, 2], waist: [46, 55, 0], hip: [46, 63, -1],
    shL: [31, 35, 3], elL: [22, 50, 9], haL: [20, 63, 15], shR: [61, 34, 2], elR: [74, 26, 6], haR: [80, 13, 8],
    hpL: [39, 65, 0], knL: [33, 77, 5], ftL: [29, 88, 4], hpR: [54, 65, -1], knR: [60, 77, 4], ftR: [64, 88, 2] };
  const body = humanoid(J, { skin: "skin", hip: "leather" }, { w: { headX: 5.4, headY: 6.2, headZ: 5.8, neck: 4.4, chestX: 15, chestY: 10, chestZ: 9, waistX: 10.5, waistY: 8, waistZ: 7.5, hipX: 11, hipY: 5.5, hipZ: 7.5,
    arm: 5.8, arm2: 4.8, wrist: 3.6, thigh: 7.2, knee: 5.4, ankle: 4.4 }, k: 2.6 });
  // 筋肉: 胸板・腹筋・僧帽筋・二の腕の盛り上がり
  const pecs = [ellipsoid([40, 40, 8], [7, 4.6, 4], "skin", 12), ellipsoid([52, 40, 7], [7, 4.6, 4], "skin", -12)];
  const abs = []; for (const y of [48, 53, 58]) for (const x of [43, 49]) abs.push(ellipsoid([x, y, 6.5], [2.8, 2.2, 2], "skin"));
  const traps = [ellipsoid([37, 31, 0], [7, 4, 5], "skin", 25), ellipsoid([54, 30, 0], [7, 4, 5], "skin", -25)];
  const bic = [ellipsoid([25, 43, 6], [4.6, 6.5, 4.6], "skin", -30), ellipsoid([68, 30, 5], [6.5, 4.4, 4.6], "skin", -40)];
  const fists = [Disp(ellipsoid([19, 67, 16], [5.4, 5.2, 5.2], "skin"), (x, y, z) => 0.35 * Math.max(0, Math.sin(x * 1.4))),
    Disp(ellipsoid([81, 10, 9], [5.4, 5.2, 5.2], "skin"), (x, y, z) => 0.35 * Math.max(0, Math.sin(x * 1.4)))];
  const brow = ellipsoid([44, 21, 13], [5.6, 1.8, 2.6], "skin");
  const nose = ellipsoid([44, 25, 14], [1.5, 2.2, 1.6], "skin");
  const bracers = [cyl([21, 57, 13], [20, 63, 15], 4.2, "iron", 1), cyl([78, 18, 7], [80, 13, 8], 4.2, "iron", 1)];
  const belt = torus([46, 61, -1], 11, 1.6, "leather", 0, 8);
  const buckle = box([46, 61, 11], [2.6, 2.2, 1], "iron", 0.6);
  const loin = Disp(slab([[38, 62], [54, 62], [55, 74], [50, 78], [46, 75], [42, 78], [37, 74]], 9, 1, "leather", 0.6), (x, y, z) => 0.4 * Math.sin(x * 0.8) * Math.max(0, (y - 66) / 10));
  const giant = Disp(U(2, body, ...pecs, ...abs, ...traps, ...bic, ...fists, brow, nose), (x, y, z) => 0.12 * fbm(x * 0.6, y * 0.6, z * 0.6));
  const mouth = ellipsoid([44, 29.5, 13], [2.6, 0.9, 2], "maw");
  const sockets = U(0, ellipsoid([41.6, 23, 12.5], [1.6, 1.1, 2], "maw"), ellipsoid([46.4, 23, 12.5], [1.6, 1.1, 2], "maw"));
  const eyes = [sphere([41.6, 23.2, 12], 1, "eye"), sphere([46.4, 23.2, 12], 1, "eye")];
  // 雷雲の外套: 肩から背、腰の後ろへ渦巻いて垂れる綿の塊
  const R = rand(611);
  const puffs = [];
  const swirl = [[22, 30, -6, 8], [30, 24, -9, 8], [44, 20, -12, 9], [58, 22, -9, 8], [68, 28, -6, 7], [14, 40, -8, 7], [12, 54, -10, 7], [16, 68, -12, 6.5], [72, 40, -10, 7], [76, 52, -12, 7], [74, 64, -13, 6],
    [24, 32, 2, 5.5], [64, 30, 1, 5.5], [8, 48, -6, 5], [82, 46, -8, 5], [20, 78, -12, 5], [72, 74, -12, 5]];
  for (const [x, y, z, r] of swirl) { puffs.push(sphere([x, y, z], r, "cloud")); for (let i = 0; i < 2; i++) puffs.push(sphere([x + (R() - 0.5) * r * 1.4, y + (R() - 0.5) * r, z + (R() - 0.3) * r], r * (0.45 + R() * 0.3), "cloud")); }
  const mantle = Disp(U(2.6, ...puffs), (x, y, z) => 0.9 * fbm(x * 0.18, y * 0.18, z * 0.18));
  // 雲の髭と逆立つ雲の髪
  const beardP = [[44, 32, 12, 4.6], [40, 35, 11, 3.6], [48, 35, 11, 3.6], [44, 38, 12, 3.8], [41, 41, 11, 3], [47, 41, 11, 3], [44, 44, 11, 2.6], [38.5, 30, 11, 2.6], [49.5, 30, 11, 2.6]];
  const beard = Disp(U(1.6, ...beardP.map(([x, y, z, r]) => sphere([x, y, z], r, "beard"))), (x, y, z) => 0.6 * fbm(x * 0.4, y * 0.4, z * 0.4));
  const hairP = [[44, 17, 5, 4.4], [39, 16, 3, 3.2], [49, 14, 2, 3.8], [55, 12, -2, 3.8], [61, 13, -5, 3.6], [66, 16, -7, 3.2], [45, 11, 1, 3.2], [52, 8, -2, 3], [58, 7, -4, 2.6], [64, 9, -6, 2.4], [37, 12, 0, 2.2]];
  const hair = Disp(U(1.8, ...hairP.map(([x, y, z, r]) => sphere([x, y, z], r, "beard"))), (x, y, z) => 0.6 * fbm(x * 0.35, y * 0.35, z * 0.35));
  // 拳にまとわる雷の玉
  const feet = [ellipsoid([28, 89, 8], [5.6, 2.8, 7], "skin"), ellipsoid([65, 89, 6], [5.6, 2.8, 7], "skin")];
  const spark = sphere([81, 10, 14], 1.6, "bolt");
  const scene = U(0, flagstones(46, 91, 44, 14, { n: 6, seed: 613, big: 3.2 }), mantle, Sub(giant, U(0, mouth, sockets), 0.6), ...eyes, beard, hair, ...bracers, ...feet, belt, buckle, loin, spark);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [80, 12, 22], r: 40, k: 0.55 }] });
  const C = new Canvas(r);
  // 稲妻 (2D のジグザグ): 拳から上と横へ、もう一筋は外套を伝って床へ
  const B = ["#5a90c0", "#a8d8ff", "#eaf8ff"];
  const zig = (x, y, steps, dx, dy, jit, seed, core = true) => {
    const Rz = rand(seed); let px = x, py = y;
    for (let i = 0; i < steps; i++) {
      const nx = px + dx + (Rz() - 0.5) * jit, ny = py + dy + (Rz() - 0.5) * jit;
      C.line(px + 1, py, nx + 1, ny, B[0]); C.line(px, py, nx, ny, core ? B[2] : B[1]);
      px = nx; py = ny;
    }
  };
  zig(83, 6, 3, 2, -2.4, 4, 1);
  zig(86, 10, 3, 2.6, 1.4, 3, 2);
  zig(76, 7, 3, -1.8, -2, 3, 3, false);
  zig(88, 16, 5, 0.6, 4, 4, 4, false);
  zig(12, 40, 4, -0.8, 3.6, 3, 5, false);
  // 雲の中の稲光 (外套の内側を細く光らせる)
  for (const [x, y] of [[70, 44], [71, 45], [72, 47], [16, 52], [15, 54], [16, 55], [28, 26], [29, 27]]) C.only(x, y, B[1]);
  // 地響きで割れた石畳: 両足から放射状のひび
  const crack = (x, y, ang, l, seed) => { const Rc = rand(seed); let px = x, py = y; for (let i = 0; i < l; i++) { const nx = px + Math.cos(ang) * 2 + (Rc() - 0.5), ny = py + Math.sin(ang) * 0.6 + (Rc() - 0.5) * 0.5; C.line(px, py, nx, ny, "#000000"); px = nx; py = ny; } };
  for (const [x, a, l, s] of [[28, Math.PI, 7, 1], [30, Math.PI * 0.8, 4, 2], [65, 0, 7, 3], [63, Math.PI * 0.15, 5, 4], [46, Math.PI * 0.5, 2, 5]]) crack(x, 91, a, l, s + 620);
  grit(C, 623, 46, 90, 40, 22);
  ash(C, 627, 12);
  return C.toArt();
}
