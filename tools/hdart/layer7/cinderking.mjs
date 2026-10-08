import { sphere, ellipsoid, cone, tube, box, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { fingers } from "../human.mjs";
import { BASALT, CRUST, LAVA, RIM, EMBER, lavaFloor, underglow, embers, flame2d } from "../lava.mjs";
export const meta = { id: "el_cinderking", key: "hd_cinderking", w: 112, h: 128,
  note: "残り火の王 (名のある強敵): 燃えさしの山から立ちのぼる、揺らめく炎の体の王。頭には炭になった木で編んだ黒い冠、肩には燃え残りの外套。顔の炎の奥で渦を巻く二つの眼は、見つめた者の心を奪って味方へ刃を向けさせる (魅了)。両手を広げると、火の粉の羽虫が群れになって集まってくる" };
export function build() {
  const W = 112, H = 128;
  const FR = ["#2a0602", "#4e0e04", "#7a1a06", "#a8300a", "#d24e10", "#f07a1c", "#ffae3a", "#ffdc7a", "#fff4c4"];
  const mats = {
    fire: { ramp: FR, noRim: true, emit: p => 0.02 + 0.62 * Math.max(0, p.nz) ** 2 + 0.35 * fbm(p.x * 0.15, p.y * 0.1 + 3, p.z * 0.15) - 0.15 * Math.max(0, (p.y - 70) / 40) },
    char: { ramp: ramp(["#010101", "#060404", "#0e0907", "#181009", "#24170d", "#322011"], 6), spec: 0.4, pow: 18, dither: 0.55,
      shade: p => 0.1 * fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5) },
    mantle: { ramp: ramp(["#020101", "#070304", "#100607", "#1a0a0a", "#260f0d"], 5), dither: 0.6,
      shade: p => 0.12 * Math.sin(p.x * 0.6 + 2 * fbm(p.x * 0.2, p.y * 0.2)) },
    hole: { ramp: ["#140402", "#2a0804"], amb: 0, dif: 0.1, noRim: true },
    basalt: BASALT, crust: CRUST, lava: LAVA,
  };
  const lick = (x, y, z) => 1.8 * fbm(x * 0.12, y * 0.09 + 1.5, z * 0.12, 3);
  // 炎の体: 胴は下へ太く燃えさしの山に溶け、上は肩から頭へ
  const torso = U(5, ellipsoid([56, 60, 0], [13, 18, 10], "fire"), cone([56, 74, 0], [56, 108, -2], 12, 19, "fire"), ellipsoid([56, 40, 1], [9, 10, 8], "fire"));
  const armL = tube([[44, 54, 3, 6], [32, 50, 6, 4.6], [20, 42, 8, 3.4]], "fire", { seg: 3 });
  const armR = tube([[68, 54, 3, 6], [80, 50, 6, 4.6], [92, 42, 8, 3.4]], "fire", { seg: 3 });
  const handL = fingers([20, 42, 8], -150, "fire", { n: 4, len: 7, spread: 36, r: 1.1, curl: 0.3, z: 1 });
  const handR = fingers([92, 42, 8], -30, "fire", { n: 4, len: 7, spread: 36, r: 1.1, curl: -0.3, z: 1 });
  // 上へ伸びる炎の舌 (頭と肩から)
  const tongues = [cone([56, 34, 0], [54, 14, -2], 6, 0.6, "fire"), cone([50, 36, 0], [44, 20, -2], 3.4, 0.4, "fire"), cone([62, 36, 0], [68, 20, -2], 3.4, 0.4, "fire"),
    cone([44, 50, -2], [36, 34, -4], 3, 0.4, "fire"), cone([68, 50, -2], [76, 34, -4], 3, 0.4, "fire")];
  const flames0 = Disp(U(3, torso, armL, armR, ...handL, ...handR, ...tongues), lick);
  // 炎の中に浮かぶ燃えさしの黒いかけら (胴の下ほど多い)
  const flames = Paint(flames0, (x, y, z, m) => (y > 50 && Math.pow(1 - Math.abs(vnoise(x * 0.16, y * 0.16, z * 0.16)), 8) > 0.6 - (y - 50) / 200) ? "char" : m);
  const face = Sub(flames, U(0, ellipsoid([51.5, 40, 10], [3.6, 2.6, 4], "hole", 18), ellipsoid([60.5, 40, 10], [3.6, 2.6, 4], "hole", -18), ellipsoid([56, 47, 9.5], [3, 1.6, 3], "hole")), 0.8);
  // 炭の冠: 黒い棘が並ぶ輪
  const crown = [box([56, 32, 1], [9, 2, 7], "char", 1)];
  for (let i = 0; i < 7; i++) { const a = (i - 3) * 0.32; crown.push(cone([56 + Math.sin(a) * 8, 31, 1 + Math.cos(a) * 6], [56 + Math.sin(a) * 11, 21 - (i % 2) * 3, 1 + Math.cos(a) * 7], 1.8, 0.3, "char")); }
  // 燃え残りの外套 (肩から背へ)
  const mantle = Disp(U(2, ellipsoid([56, 50, -6], [20, 8, 8], "mantle"), cone([56, 52, -8], [56, 90, -10], 16, 22, "mantle")), (x, y, z) => 1.2 * Math.max(0, vnoise(x * 0.3, y * 0.3, 1)) + (y > 80 ? 2 * Math.max(0, fbm(x * 0.4, y * 0.4, 2)) : 0));
  // 足元の燃えさしの山
  const R = rand(9101);
  const pile = [];
  for (let i = 0; i < 22; i++) { const a = R() * Math.PI * 2, d = R() * 22; pile.push(Disp(box([56 + Math.cos(a) * d * 1.3, 116 - R() * 8, Math.sin(a) * d * 0.6], [3 + R() * 3, 1.6 + R() * 1.6, 2 + R() * 2], "char", 1, R() * 180), (x, y, z) => 0.4 * fbm(x * 0.7, y * 0.7, z * 0.7))); }
  const pileP = pile.map(n => Paint(n, (x, y, z, m) => (vnoise(x * 0.5, y * 0.5, z * 0.5) > 0.35 ? "lava" : m)));
  const scene = U(0, lavaFloor(56, 122, 54, 16, { n: 4, seed: 9103 }), mantle, face, ...crown, ...pileP);
  const r = render(scene, mats, { w: W, h: H, rim: RIM, lights: [{ p: [56, 60, 30], r: 50, k: 0.4 }] });
  const C = new Canvas(r);
  // 炎の縁はちらちら欠ける
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = C.pix[y * W + x]; if (!p || p.m !== "fire") continue;
    if ((!C.get(x - 1, y) || !C.get(x + 1, y) || !C.get(x, y - 1)) && fbm(x * 0.45, y * 0.45, 7) > 0.1) C.set(x, y, null);
  }
  // 肩・腕・頭から立ちのぼる炎の舌
  for (const [x, y, w, h, sd] of [[40, 52, 3, 12, 1], [72, 52, 3, 12, 2], [30, 48, 2.4, 10, 3], [82, 48, 2.4, 10, 4], [48, 34, 2.4, 9, 5], [64, 34, 2.4, 9, 6], [46, 70, 3, 10, 7], [66, 74, 3, 10, 8]])
    flame2d(C, x, y, w, h, { seed: sd, own: ["fire"], cols: ["#7a1a06", "#d24e10", "#f07a1c", "#ffc04a", "#fff0b0"] });
  // 渦巻く魅了の眼 (紫と金の渦)
  const SW = ["#2a0a3a", "#6a1a8a", "#c050d0", "#ffd8ff"];
  for (const [cx, cy] of [[51.5, 40], [60.5, 40]]) for (let t = 0; t < 1; t += 0.02) {
    const a = t * Math.PI * 4, rr = 0.3 + t * 2.6;
    C.set(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.7, SW[Math.min(3, Math.floor((1 - t) * 4))]);
  }
  // 両手に集まる火の粉の羽虫 (小さな黒い体と光る腹)
  for (const [cx, cy] of [[12, 30], [22, 22], [8, 46], [98, 30], [88, 22], [104, 46], [30, 18], [82, 16]]) {
    if (C.get(cx, cy)) continue;
    C.set(cx, cy, "#1a0c08"); C.set(cx + 1, cy, "#ffae3a"); C.set(cx + 2, cy, "#f07a1c"); C.set(cx, cy - 1, "#3e2a24"); C.set(cx - 1, cy - 1, "#2c1c18");
  }
  underglow(C, { skip: ["fire"] });
  embers(C, 9105, 60, [4, 2, W - 8, 100]);
  return C.toArt();
}
