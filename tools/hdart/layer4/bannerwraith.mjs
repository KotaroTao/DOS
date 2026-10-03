import { tube, sphere, ellipsoid, cone, slab, cyl, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { WOOD, RIM, ash } from "../fort.mjs";
export const meta = { id: "bs_bannerwraith", key: "hd_bannerwraith", w: 96, h: 96,
  note: "軍旗の亡霊: 陥落の際まで旗を手放さなかった旗手の霊。フードの奥の髑髏が背丈を超える旗竿を握りしめ、裂けて穴だらけになった褪せた深紅の軍旗 (剣の紋章) が大きくはためく。下半身は青白い霊気の靄にほどける" };
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
// 板を z 方向へ波打たせる (はためく旗)。leaf の距離関数を歪めて包み直す
function wave(node, fn, pad = 6) {
  const b = node.bound;
  return { leaf: true, f: (x, y, z) => node.f(x, y, z - fn(x, y)) * 0.8, mat: node.mat, bound: [b[0], b[1], b[2], b[3] + pad] };
}
export function build() {
  const mats = {
    banner: { ramp: ramp(["#040102", "#100306", "#1e050a", "#2e090e", "#401014", "#54171b", "#682024", "#7c2c2c"], 8), dither: 0.6, amb: 0.2, dif: 0.95,
      shade: p => 0.08 * fbm(p.x * 0.3, p.y * 0.3) - 0.1 * Math.max(0, fbm(p.x * 0.9, p.y * 0.9, 2)) + 0.2 * (0.4 + Math.max(0, (p.x - 24) / 64)) * Math.cos(p.x * 0.24 - p.y * 0.07 + 0.6) },
    emblem: { ramp: ramp(["#0a0705", "#21180c", "#3a2c16", "#564422", "#745e32"], 5), dither: 0.5, amb: 0.2 },
    cloth: { ramp: ramp(["#030304", "#08090a", "#101214", "#181b1e", "#21252a", "#2c3238", "#384047"], 7), dither: 0.6,
      shade: p => 0.12 * Math.sin(p.x * 0.8 + p.y * 0.12) + 0.05 * fbm(p.x * 0.4, p.y * 0.4) },
    bone: { ramp: ramp(["#050504", "#16130e", "#2a251b", "#433c2c", "#605641", "#80765a", "#a29878"], 7), spec: 0.5, pow: 20, dither: 0.45 },
    iron: { ramp: ramp(["#020203", "#0a0b0d", "#16181c", "#252931", "#3a404a", "#56606c"], 6), spec: 1.2, pow: 35, specCol: "#9aa4b0", dither: 0.4 },
    mist: { ramp: ["#0d1619", "#18282d", "#263b40", "#3a5557", "#587a77", "#80a49c"], emit: p => 0.08 + Math.min(0.45, Math.max(0, (p.y - 68) / 40)) + 0.25 * Math.max(0, p.nz) + 0.3 * fbm(p.x * 0.18, p.y * 0.12, 2), dither: 0.9 },
    eye: { ramp: ["#1c4a38", "#4aa078", "#b8f6d4"], emit: p => 0.6 + 0.4 * Math.max(0, p.nz) },
    hole: { ramp: ["#000000", "#000000", "#020203"], amb: 0, dif: 0.1, noRim: true },
    thru: { ramp: ["#000000"], noRim: true },
    wood: WOOD,
  };
  // 旗竿 (少し傾けて握る) と槍先の竿頭
  const pole = cyl([22, 6, -2], [27, 92, 2], 1.3, "wood", 0.3);
  const finial = U(0, cone([22, 7, -2], [21.6, -1, -2], 2, 0.2, "iron"), cyl([22.1, 7, -2], [22.2, 9.5, -2], 1.9, "iron", 0.4));
  // 軍旗: 竿から右へ。燕尾に裂け、下縁はぎざぎざ
  const poly = [[23, 8], [44, 8.5], [66, 10], [92, 13], [81, 25], [91, 38], [86, 40], [78, 42], [73, 38], [67, 45], [61, 41], [55, 49], [49, 45], [43, 52], [37, 48], [31, 55], [24, 54]];
  const flat = slab(poly, -6, 0.9, "banner", 0.4);
  const flag = wave(flat, (x, y) => { const t = Math.max(0, (x - 24) / 64); return (1.5 + 5 * t) * Math.sin(x * 0.24 - y * 0.07 + 0.6) + 2 * t * fbm(x * 0.1, y * 0.1); });
  // 虫食い・矢の穴
  const holes = [];
  const R = rand(401);
  for (const [x, y, r] of [[75, 22, 2.6], [47, 40, 2], [82, 33, 1.7], [34, 44, 1.5], [68, 33, 1.3], [86, 17, 1.4], [40, 14, 1.2]]) holes.push(ellipsoid([x, y, -6], [r, r * 1.2, 14], "thru", R() * 60));
  // 紋章: 輪の中に切っ先を下へ向けた剣
  const crest = (x, y, z, m) => {
    if (m !== "banner") return m;
    const dx = x - 59, dy = y - 27, rr = Math.hypot(dx, dy * 1.05);
    if (rr > 9.4 && rr < 11.2) return "emblem";
    if (Math.abs(dx) < 1.3 - Math.max(0, dy - 4) * 0.25 && dy > -8 && dy < 9) return "emblem";
    if (Math.abs(dy + 4) < 1 && Math.abs(dx) < 5) return "emblem";
    if (Math.hypot(dx, dy + 8.5) < 1.7) return "emblem";
    return m;
  };
  const banner = Paint(Sub(flag, U(0, ...holes)), crest);
  // 旗手: フード、髑髏の顔、外套。下半身は靄へ
  const hood = Disp(ellipsoid([44, 33, 2], [7.4, 8.4, 6.8], "cloth", 8), (x, y, z) => 0.2 * fbm(x * 0.5, y * 0.5));
  const cowl = ellipsoid([43.2, 35.5, 8], [4.4, 5.6, 4], "hole", 8);
  const skull = U(0.8, sphere([43, 34, 4.8], 3.8, "bone"), ellipsoid([43.2, 38.4, 5.2], [2.4, 1.8, 2.2], "bone"));
  const sockets = U(0, sphere([41.5, 33.6, 8.4], 1.15, "hole"), sphere([44.6, 33.6, 8.4], 1.15, "hole"), ellipsoid([43, 36.2, 8.6], [0.6, 0.9, 1], "hole"));
  const face = Sub(skull, sockets, 0.2);
  const torso = Disp(ellipsoid([46, 50, 0], [10.5, 11, 7], "cloth", 6), (x, y, z) => 0.3 * Math.sin(x * 0.9 + y * 0.2));
  const robe = Disp(cone([46, 54, 0], [48, 74, -1], 9.5, 12, "cloth"), (x, y, z) => 0.9 * Math.sin(Math.atan2(z, x - 48) * 5 + y * 0.15) * Math.max(0, (y - 58) / 26));
  // 腕: 袖から骨の手が伸び、旗竿を上下で握る
  const sleeveA = tube([[39, 44, 2, 3.4], [33, 49, 6, 3], [27, 46, 6, 2.6]], "cloth");
  const sleeveB = tube([[53, 46, 1, 3.4], [46, 58, 7, 3], [33, 62, 6, 2.6]], "cloth");
  const handA = U(0.6, ellipsoid([25.2, 45.5, 5], [2.3, 2.6, 2.2], "bone"), tube([[26, 44, 6, 0.8], [23.6, 43.6, 6.6, 0.7], [23.4, 45.6, 7, 0.6]], "bone"), tube([[26, 47, 6, 0.8], [23.6, 47, 6.6, 0.7], [23.6, 48.6, 7, 0.6]], "bone"));
  const handB = U(0.6, ellipsoid([28.6, 62.5, 5], [2.4, 2.6, 2.2], "bone"), tube([[29, 61, 6, 0.8], [26.5, 60.6, 6.6, 0.7], [26.3, 62.6, 7, 0.6]], "bone"), tube([[29, 64, 6, 0.8], [26.6, 64, 6.6, 0.7], [26.6, 65.6, 7, 0.6]], "bone"));
  // 霊気の靄: 外套の裾から渦を巻いて流れ落ちる
  const mistB = [];
  for (let i = 0; i < 8; i++) { const t = i / 7, a = t * 5; mistB.push(sphere([48 + Math.sin(a) * (6 - t * 3) - t * 6, 70 + t * 22, Math.cos(a) * 3], 11 - t * 8, "cloth")); }
  const mist = Paint(Disp(U(3, ...mistB), (x, y, z) => 1.5 * fbm(x * 0.13 + Math.sin(y * 0.15), y * 0.11, z * 0.12, 3)), (x, y, z, m) => y > 68 + 7 * fbm(x * 0.12, y * 0.2, 5) ? "mist" : m);
  const eyes = [sphere([41.5, 33.6, 7.4], 0.8, "eye"), sphere([44.6, 33.6, 7.4], 0.8, "eye")];
  const figure = Sub(U(1.2, hood, torso, U(3, robe, mist)), cowl, 0.6);
  const scene = U(0, banner, pole, finial, figure, face, ...eyes, sleeveA, sleeveB, handA, handB);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [43, 36, 14], r: 14, k: 0.35 }] });
  const C = new Canvas(r);
  // 裾は靄へ透けてほどける
  for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) {
    const p = C.pix[y * 96 + x]; if (!p) continue;
    if (p.m === "thru") { C.set(x, y, null); continue; }
    if (p.m === "mist") {
      const a = 1.25 - Math.max(0, (y - 70) / 20) + 0.55 * fbm(x * 0.2 + y * 0.06, y * 0.16, 3);
      if (a < (BAYER[y & 3][x & 3] + 0.5) / 16) C.set(x, y, null);
    } else if (p.m === "wood" && y > 70) {
      // 竿の下端も霧の中へ
      if (y > 84 || ((y - 70) / 14 > (BAYER[y & 3][x & 3] + 0.5) / 16 + 0.3)) C.set(x, y, null);
    }
  }
  // 眼窩の奥の霊火
  C.set(41, 33, "#b8f6d4"); C.set(44, 33, "#b8f6d4");
  // 靄の筋と漂う灰
  const M = ["#18282d", "#263b40", "#3a5557"];
  for (const [x0, y0, r0] of [[50, 84, 13], [50, 76, 17]]) for (let a = 0; a < 6.28; a += 0.1) { const x = x0 + Math.cos(a) * r0, y = y0 + Math.sin(a) * r0 * 0.26; if (!C.get(Math.round(x), Math.round(y)) && R() < 0.45) C.set(x, y, M[Math.floor(R() * 3)]); }
  ash(C, 403, 7, [4, 56, 88, 36]);
  return C.toArt();
}
