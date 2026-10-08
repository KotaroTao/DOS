import { tube, sphere, ellipsoid, cone, cyl, torus, box, slab, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { fingers } from "../human.mjs";
import { FLAG, POOL, MARBLE, RIM, templeFloor, ripples, bubbles, motes } from "../temple.mjs";
export const meta = { id: "bs_dreadlich", key: "hd_dreadlich", w: 96, h: 96,
  note: "嘆きのリッチ: 朽ちた大神官の衣をまとう骸骨の死霊術師。頭に崩れかけた金の冠、眼窩に紫の鬼火。枯れ枝の指を広げて生者の魂を紫の筋として吸い上げ、周りには魂を分けて隠した三つの宝珠が浮かぶ (砕けても一度は宝珠から蘇る)" };
export function build() {
  const mats = {
    bone: { ramp: ramp(["#06050a", "#16131c", "#28242e", "#3e3946", "#58525e", "#747078", "#929096", "#b2b0b0"], 8), spec: 0.5, pow: 22, dither: 0.4, amb: 0.22 },
    robe: { ramp: ramp(["#040306", "#0a0810", "#120e1a", "#1a1526", "#241c34", "#2e2444"], 6), dither: 0.65, amb: 0.2,
      shade: p => 0.14 * Math.sin((p.x - 48) * 0.8 + p.y * 0.06) + 0.06 * fbm(p.x * 0.4, p.y * 0.4) },
    gold: { ramp: ramp(["#080502", "#1e1206", "#3a240a", "#5c3a12", "#80561c", "#a8782a"], 6), spec: 1.4, pow: 30, specCol: "#f0d898", dither: 0.4 },
    orb: { ramp: ["#2a0a40", "#6a1a9a", "#b050e0", "#f0c0ff"], emit: p => 0.45 + 0.55 * Math.max(0, p.nz) },
    eye: { ramp: ["#4a1070", "#a040e0", "#f0c8ff"], emit: p => 0.6 + 0.4 * Math.max(0, p.nz) },
    hole: { ramp: ["#000000", "#000000", "#020104"], amb: 0, dif: 0.05, noRim: true },
    flag: FLAG, pool: POOL, marble: MARBLE,
  };
  // 頭蓋と冠: やや前へ傾いだ骸骨の頭、欠けた金の冠
  const skull = U(1, ellipsoid([48, 22, 2], [6.4, 7, 6.2], "bone"), ellipsoid([48, 29, 4], [4.4, 2.8, 4], "bone"));
  const holes = U(0, ellipsoid([45.4, 22.4, 7.4], [2.2, 2.2, 2], "hole"), ellipsoid([50.6, 22.4, 7.4], [2.2, 2.2, 2], "hole"), ellipsoid([48, 26, 8], [0.9, 1.2, 1.2], "hole"),
    box([48, 30.2, 7.4], [3.2, 0.5, 1], "hole", 0.2));
  const teeth = (x, y, z, m) => m === "bone" && y > 29.6 && y < 31 && z > 6 && Math.sin(x * 3.2) > 0.3 ? "hole" : m;
  const eyes = [sphere([45.4, 22.6, 6.6], 1.1, "eye"), sphere([50.6, 22.6, 6.6], 1.1, "eye")];
  const crown = Sub(U(0.4, cyl([48, 16.6, 2], [48, 13.4, 2], 6.4, "gold", 0.5), ...[-2, -1, 0, 1, 2].map(i => cone([48 + i * 2.8, 13.6, 2 + (2 - Math.abs(i)) * 0.8], [48 + i * 3.2, 8.4 + Math.abs(i) * 1.2, 2], 1.1, 0.25, "gold"))),
    sphere([53, 10, 5], 3, "gold"), 0.3);
  // 衣: 大神官の高い襟と、肩から床へ垂れる破れた衣。前の帯に金の刺繍
  const collar = Disp(U(1, ellipsoid([41, 30, -1], [4, 6, 4], "robe", -20), ellipsoid([55, 30, -1], [4, 6, 4], "robe", 20)), (x, y, z) => 0.2 * fbm(x, y));
  const robe = Disp(U(2, ellipsoid([48, 38, 0], [12, 6.4, 7], "robe"), cone([48, 40, 0], [48, 86, 0], 10.6, 18, "robe")),
    (x, y, z) => 1.0 * Math.sin(Math.atan2(z, x - 48) * 7 + y * 0.06) * Math.max(0, (y - 46) / 30) + 0.2 * fbm(x * 0.4, y * 0.4, z * 0.4));
  const tear = Disp(cyl([48, 96, 0], [48, 84, 0], 22, "robe"), (x, y, z) => -4 * Math.max(0, Math.sin(x * 0.8) * 0.6 + vnoise(x * 0.3, 5) * 0.7));
  const band = (x, y, z, m) => m === "robe" && Math.abs(x - 48) < 2.6 && z > 5 && y > 40 ? ((Math.floor(y / 2.5) % 2) ? "gold" : "robe") : m;
  // 腕: 左は前へ広げた枯れ枝の指 (魂を吸う)、右は杖を握る
  const armL = tube([[39, 36, 2, 2.4], [31, 42, 8, 1.8], [24, 40, 13, 1.4]], "robe", { seg: 3 });
  const handL = U(0.5, ellipsoid([22, 40, 13.6], [1.8, 2, 1.4], "bone"), ...fingers([21.6, 40, 13.6], 180, "bone", { n: 4, len: 7, spread: 40, r: 0.55, curl: -0.2 }));
  const armR = tube([[57, 36, 2, 2.4], [63, 44, 6, 1.8], [64, 52, 9, 1.4]], "robe", { seg: 3 });
  const handR = ellipsoid([64.4, 53, 9.6], [1.8, 2.2, 1.6], "bone");
  const staff = U(0.4, cyl([65, 88, 9], [64, 22, 9.6], 0.9, "bone"), Disp(torus([64, 18, 9.6], 3.6, 0.8, "bone", 0, 90), (x, y, z) => 0.2 * Math.sin(x * 4)), sphere([64, 18, 9.6], 2, "orb"));
  // 魂を分けた三つの宝珠 (周りに浮く)
  const orbs = [[16, 20, 4, 3.2], [80, 30, 2, 3], [30, 64, 10, 2.6]].map(([x, y, z, r]) => U(0.4, sphere([x, y, z], r, "orb"), torus([x, y, z], r + 1.6, 0.45, "gold", 30, 70)));
  const lich = U(0, Paint(Sub(skull, holes, 0.3), teeth), ...eyes, crown, Paint(Sub(U(1.2, collar, robe, armL, armR), tear, 0.8), band), handL, handR, staff, ...orbs);
  const scene = U(0, templeFloor(48, 91, 44, 14, { n: 3, seed: 923, cols: 1 }), lich);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, bounce: 0.1, lights: [{ p: [20, 40, 20], r: 20, k: 0.4 }, { p: [64, 18, 16], r: 14, k: 0.3 }] });
  const C = new Canvas(r);
  // 吸い上げる魂の筋: 前方から指先へ流れ込む紫の糸
  const V = ["#2a0a40", "#5a1a80", "#a050d8", "#e8b8ff"], R = rand(925);
  for (let j = 0; j < 6; j++) {
    const y0 = 30 + j * 4 + R() * 3, ph = R() * 6;
    for (let t = 0; t < 1; t += 0.02) {
      const x = 2 + t * 13, y = y0 + (40 - y0) * t * t + Math.sin(t * 8 + ph) * 1.4;
      const X = Math.round(x), Y = Math.round(y);
      if (!C.get(X, Y) && R() < 0.4 + t * 0.6) C.set(X, Y, V[Math.min(3, Math.floor(t * 3.5))]);
    }
  }
  // 宝珠の芯
  for (const [x, y] of [[15, 19], [79, 29], [29, 63], [63, 17]]) C.set(x, y, "#f0c0ff");
  C.set(45, 22, "#f0c8ff"); C.set(50, 22, "#f0c8ff");
  ripples(C, 927);
  bubbles(C, 929, 8);
  motes(C, 931, 8);
  return C.toArt();
}
