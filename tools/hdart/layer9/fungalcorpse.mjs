import { sphere, ellipsoid, cone, tube, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { humanoid, fingers } from "../human.mjs";
import { MUD, POOL, ROTWOOD, RIM, ROT, bogFloor, scum, motes, slime } from "../swamp.mjs";
export const meta = { id: "bs_fungalcorpse", key: "hd_fungalcorpse", w: 96, h: 96,
  note: "キノコまみれの死人: 沼に倒れ、全身を毒キノコに乗っ取られた死人。頭も肩も背中も紫がかった傘のキノコで埋まり、顔は半ば菌糸に覆われる。前のめりに腕を垂らしてよろめき、傘から惑わしの胞子を雲のように撒く (混乱・多用)。後ろの霧の中に、同じ姿がもう一体 (群棲)" };
export function build() {
  const mats = {
    flesh: { ramp: ramp(["#030302", "#0a0a07", "#14130e", "#201e16", "#2e2b20", "#3e3a2c", "#504a3a"], 7), dither: 0.55, amb: 0.24,
      shade: p => 0.08 * fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5) },
    rag: { ramp: ramp(["#020202", "#080706", "#110f0c", "#1b1813", "#26221b"], 5), dither: 0.6 },
    cap: { ramp: ramp(["#060308", "#120a16", "#201228", "#30203a", "#43304e", "#5a4266", "#76587e"], 7), spec: 0.8, pow: 22, specCol: "#a888b0", dither: 0.45, amb: 0.24 },
    gill: { ramp: ramp(["#0c0a06", "#2a2416", "#4a4028", "#6a5e3e"], 4), dither: 0.4 },
    stem: { ramp: ramp(["#14120c", "#2e2a1e", "#4c4632", "#6a6248", "#8a8064"], 5), dither: 0.4, amb: 0.3 },
    myc: { ramp: ramp(["#1a1814", "#34302a", "#54504a", "#7a766c"], 4), dither: 0.6, amb: 0.35 },
    far: { ramp: ramp(["#08070a", "#100e14", "#18151e", "#221e2a", "#2e2836"], 5), dither: 0.7, amb: 0.35, noRim: true },
    eye: { ramp: [ROT[2], ROT[4], ROT[5]], emit: () => 0.9 },
    mud: MUD, pool: POOL, rotwood: ROTWOOD,
  };
  const J = { head: [40, 32, 6], neck: [42, 38, 4], chest: [46, 48, 2], waist: [48, 60, 2], hip: [50, 68, 2],
    shL: [36, 42, 6], elL: [32, 56, 10], haL: [30, 68, 12], shR: [56, 42, 0], elR: [60, 56, 4], haR: [62, 68, 8],
    hpL: [46, 70, 4], knL: [40, 80, 8], ftL: [36, 91, 8], hpR: [54, 70, 0], knR: [58, 80, 2], ftR: [62, 91, 2] };
  const body = Paint(Disp(humanoid(J, { skin: "flesh", torso: "rag", hip: "rag" }, { w: { headX: 5.4, headY: 6.4, chestX: 10, chestY: 9, waistX: 8, hipX: 9, arm: 2.8, arm2: 2.4, wrist: 1.8, thigh: 3.6, knee: 2.8, ankle: 2 } }),
    (x, y, z) => 0.4 * fbm(x * 0.4, y * 0.4, z * 0.4)), (x, y, z, m) => (fbm(x * 0.3, y * 0.3, z * 0.3 + 5) > 0.32 ? "myc" : m));
  const handL = [ellipsoid([30, 69, 13], [2.2, 2.4, 2], "flesh"), ...fingers([30, 70, 13], 95, "flesh", { n: 4, len: 4, spread: 20, r: 0.7, curl: 0.3 })];
  const handR = [ellipsoid([62, 69, 9], [2.2, 2.4, 2], "flesh"), ...fingers([62, 70, 9], 85, "flesh", { n: 4, len: 4, spread: 20, r: 0.7, curl: -0.3 })];
  // キノコ: [根元 x, y, z, 傾き, 大きさ]
  const R = rand(10001);
  const shrooms = [[39, 25, 6, -0.3, 2], [45, 27, 2, 0.3, 1.5], [34, 29, 8, -0.7, 1.1], [31, 40, 6, -0.9, 1.4], [57, 37, -2, 0.7, 1.8], [62, 42, -4, 1, 1.2], [50, 37, 0, 0.1, 2.2], [44, 42, 8, -0.1, 1], [59, 52, 0, 0.9, 1.1], [35, 53, 8, -0.8, 1], [52, 62, 6, 0.4, 0.8]];
  const caps = [], stems = [];
  for (const [x, y, z, lean, s] of shrooms) {
    const tx = x + lean * 4 * s, ty = y - 5 * s;
    stems.push(cone([x, y, z], [tx, ty, z], 1 * s, 0.7 * s, "stem"));
    caps.push(Disp(ellipsoid([tx, ty - 0.6 * s, z], [3.6 * s, 1.8 * s, 3.4 * s], "cap", lean * 18), (X, Y, Z) => Math.max(0, (Y - (ty - 0.6 * s)) * 1.1)));
  }
  const eyes = [sphere([38, 33, 11], 0.8, "eye")];
  // 後ろの霧の中のもう一体
  const J2 = { head: [80, 36, -22], neck: [80, 41, -22], chest: [80, 50, -22], waist: [81, 60, -22], hip: [82, 67, -22],
    shL: [74, 46, -20], elL: [72, 58, -18], haL: [72, 68, -16], shR: [87, 46, -24], elR: [90, 58, -22], haR: [92, 66, -20],
    hpL: [78, 68, -20], knL: [76, 78, -18], ftL: [74, 89, -18], hpR: [86, 68, -24], knR: [88, 78, -24], ftR: [90, 89, -24] };
  const other = U(1, humanoid(J2, { skin: "far" }, { scale: 0.8 }), Disp(ellipsoid([80, 30, -22], [6, 2.6, 5], "far"), (X, Y, Z) => Math.max(0, (Y - 30) * 1.1)), Disp(ellipsoid([86, 40, -24], [4, 2, 4], "far"), (X, Y, Z) => Math.max(0, (Y - 40) * 1.1)));
  const scene = U(0, bogFloor(50, 94, 46, 14, { n: 2, seed: 10003, wet: 0.05, logs: 1 }), U(1.2, body, ...handL, ...handR), ...stems, ...caps, ...eyes, other);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  // 傘の裏のひだと白い斑点
  for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) { const p = C.pix[y * 96 + x]; if (p && p.m === "cap" && p.ny > 0.35) C.set(x, y, "#2a2416"); else if (p && p.m === "cap" && vnoise2(p) > 0.62) C.set(x, y, "#b8a8b8"); }
  // 惑わしの胞子の雲 (淡い紫と黄緑のまだら)
  const sp = ["#1c1424", "#2c2038", "#44345a", "#6a5488", ROT[3], "#c8b0e0"];
  for (let i = 0; i < 160; i++) {
    const a = R() * Math.PI * 2, d = Math.sqrt(R()) * 22, x = 44 + Math.cos(a) * d * 1.3, y = 22 + Math.sin(a) * d * 0.8;
    if (!C.get(Math.round(x), Math.round(y))) C.set(x, y, sp[Math.min(sp.length - 1, Math.floor(R() * R() * sp.length * 1.2 + (d < 10 ? 1 : 0)))]);
  }
  // 霧の奥の一体は輪郭を霧にほどく
  for (let y = 0; y < 96; y++) for (let x = 66; x < 96; x++) { const p = C.pix[y * 96 + x]; if (p && p.m === "far" && fbm(x * 0.2, y * 0.2, 9) > 0.15 && (x + y) % 2) C.px[y * 96 + x] = null; }
  slime(C, 10005, ["flesh", "rag"], 0.05);
  scum(C, 10007);
  motes(C, 10009, 12, [2, 50, 92, 30], true);
  return C.toArt();
}
function vnoise2(p) { return Math.abs(Math.sin(p.x * 2.3) * Math.sin(p.z * 2.1 + p.y * 1.7)); }
