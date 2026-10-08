import { tube, sphere, ellipsoid, cone, cyl, box, torus, slab, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { FLAG, POOL, MARBLE, RIM, PHOS, templeFloor, ripples, bubbles, motes, column } from "../temple.mjs";
export const meta = { id: "bs_idolguardian", key: "hd_idolguardian", w: 96, h: 96,
  note: "神像の番人: 旧き神を象った、顔のない石の守り像。四本の腕のうち二本で神殿の紋の大盾を前に立て、残る二本は盾の縁を押さえて後ろの者をかばう。盾の面には刃を数度だけ受け止める守りの文字が青緑に浮かぶ。石肌は藻と貝にくすむ" };
export function build() {
  const mats = {
    stone: { ramp: ramp(["#030404", "#0a0d0c", "#141918", "#1e2524", "#2a3332", "#384342", "#4a5654", "#5e6c68"], 8), spec: 0.4, pow: 18, dither: 0.55,
      shade: p => 0.1 * fbm(p.x * 0.4, p.y * 0.4, p.z * 0.4) },
    algae: { ramp: ramp(["#020403", "#06100a", "#0c1c12", "#14281a", "#1e3824"], 5), dither: 0.75, amb: 0.25 },
    rune: { ramp: [PHOS[1], PHOS[2], PHOS[3], PHOS[4]], emit: p => 0.45 + 0.4 * Math.max(0, p.nz) },
    hole: { ramp: ["#000000", "#010202", "#030505"], amb: 0.05, dif: 0.1, noRim: true },
    flag: FLAG, pool: POOL, marble: MARBLE,
  };
  const alg = (x, y, z, m) => m === "stone" && fbm(x * 0.22 + 4, y * 0.22, z * 0.22) > 0.18 + 0.004 * (y - 50) ? "algae" : m;
  // 体: 高い頭飾りの冠、顔は平らな面に一本の縦溝。肩の広い胴と四本の腕
  const head = U(1, ellipsoid([48, 18, 0], [6, 7, 5.6], "stone"), cyl([48, 13, -1], [48, 3, -2], 5, "stone", 1.4), cone([48, 4, -2], [48, -1, -2], 4.4, 1, "stone"));
  const faceCut = U(0, box([48, 18, 5.4], [0.6, 4.6, 1], "hole", 0.2), box([48, 14.6, 5.4], [3.4, 0.5, 1], "hole", 0.2));
  const torso = U(2, ellipsoid([48, 34, -2], [15, 8, 8], "stone"), ellipsoid([48, 46, -2], [11, 9, 7], "stone"), ellipsoid([48, 58, -2], [10, 6, 6.4], "stone"));
  const armsUp = [tube([[35, 32, -1, 3.6], [24, 30, 3, 3], [20, 22, 8, 2.6]], "stone", { seg: 3 }), tube([[61, 32, -1, 3.6], [72, 30, 3, 3], [76, 22, 8, 2.6]], "stone", { seg: 3 })];
  const armsLo = [tube([[37, 40, 0, 3.2], [28, 48, 5, 2.8], [24, 60, 9, 2.4]], "stone", { seg: 3 }), tube([[59, 40, 0, 3.2], [68, 48, 5, 2.8], [72, 60, 9, 2.4]], "stone", { seg: 3 })];
  const hands = [ellipsoid([20, 21, 9.4], [2.6, 3, 2.4], "stone"), ellipsoid([76, 21, 9.4], [2.6, 3, 2.4], "stone"), ellipsoid([24, 61, 10], [2.6, 3, 2.4], "stone"), ellipsoid([72, 61, 10], [2.6, 3, 2.4], "stone")];
  const legs = [cyl([42, 62, -2], [40, 84, -1], 5, "stone", 1.6), cyl([54, 62, -2], [56, 84, -1], 5, "stone", 1.6)];
  const feet = [box([39, 86, 1], [6, 2.4, 6], "stone", 1), box([57, 86, 1], [6, 2.4, 6], "stone", 1)];
  // 大盾: 四本の手が縁を押さえる、縦長の丸い大盾 (盾の後ろに胴が隠れる)
  const shield = Disp(U(0.6, Sub(ellipsoid([48, 42, 12], [24, 27, 4], "stone"), ellipsoid([48, 42, 18], [21, 24, 4], "stone"), 0.5), ellipsoid([48, 42, 11], [21.5, 24.5, 3.4], "stone")),
    (x, y, z) => 0.2 * fbm(x * 0.4, y * 0.4, z * 0.4));
  const boss = U(0.8, sphere([48, 42, 15], 4.4, "stone"), torus([48, 42, 14.4], 7.6, 0.9, "stone", 0, 0));
  // 盾の紋と守りの文字: 中心の輪から放射、外周に文字の帯
  const runes = (x, y, z, m) => {
    if (m !== "stone" || z < 13) return m;
    const dx = x - 48, dy = (y - 42) * 0.9, rr = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    if (rr > 15.2 && rr < 16.6 && Math.sin(a * 14) > -0.3) return "rune";
    if (rr > 10 && rr < 14.6 && Math.abs(Math.sin(a * 4)) < 0.1) return "rune";
    if (rr > 17.8 && rr < 19.4 && (Math.floor((a + 4) * 9) % 3 === 0) && Math.sin(a * 27) > 0) return "rune";
    return m;
  };
  const guard = Paint(Sub(U(1.2, head, torso, ...armsUp, ...armsLo, ...hands, ...legs, ...feet), faceCut, 0.3), alg);
  const scene = U(0, templeFloor(48, 91, 46, 14, { n: 3, seed: 803, cols: 1 }), column(10, 88, -14, 50, 4.6, { seed: 3 }), column(86, 88, -14, 34, 4.6, { seed: 5 }), guard, Paint(Paint(U(0.6, shield, boss), runes), alg));
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, bounce: 0.12, lights: [{ p: [48, 42, 30], r: 30, k: 0.25 }] });
  const C = new Canvas(r);
  // 盾の前に揺らぐ守りの膜 (障壁): 盾の縁に沿った淡い輪
  const P = PHOS;
  for (let a = 0; a < Math.PI * 2; a += 0.01) {
    for (const [k, c] of [[1.12, 1], [1.2, 0]]) {
      const X = Math.round(48 + Math.cos(a) * 24 * k), Y = Math.round(42 + Math.sin(a) * 27 * k);
      if (!C.get(X, Y) && Math.sin(a * 18) > -0.2) C.set(X, Y, P[c]);
    }
  }
  C.set(46, 39, P[4]);
  ripples(C, 805);
  bubbles(C, 807, 8);
  motes(C, 809, 8, undefined, true);
  return C.toArt();
}
