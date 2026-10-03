import { sphere, ellipsoid, cone, slab, cyl, box, torus, tube, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { fingers } from "../human.mjs";
import { FLAG, STONE, RIM, flagstones } from "../fort.mjs";
export const meta = { id: "bs_shadowmage", key: "hd_shadowmage", w: 96, h: 96,
  note: "影の術師: 禁呪に魂を喰われ、影だけが残った術師。中身の無い頭巾と法衣は縁から闇に溶け、宙に浮く骨ばった両手がねじれた杖と紫の魔法陣を操る。呼び出された小さな霊の灯がまわりを漂う" };
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
export function build() {
  const mats = {
    robe: { ramp: ramp(["#010102", "#040307", "#08060d", "#0e0a15", "#15101e", "#1d1629", "#271d36"], 7), dither: 0.8, amb: 0.2, dif: 0.75, rimCol: "#4a3a6e",
      shade: p => 0.12 * Math.sin(Math.atan2(p.z + 2, p.x - 48) * 7 + p.y * 0.05) + 0.08 * fbm(p.x * 0.2, p.y * 0.2, 4) },
    bone: { ramp: ramp(["#040406", "#121218", "#24232b", "#38363f", "#4f4c56", "#69646e", "#86808a"], 7), amb: 0.3, spec: 0.6, pow: 25, specCol: "#b4aebc", dither: 0.45 },
    staff: { ramp: ramp(["#020102", "#09060a", "#130d13", "#1e161d", "#2a1f28"], 5), dither: 0.5, spec: 0.5, pow: 20,
      shade: p => 0.15 * Math.sin(p.y * 1.3 + p.x * 0.8) },
    orb: { ramp: ["#2a1240", "#5c2a8e", "#9c5cdc", "#dcb4ff"], emit: p => 0.45 + 0.55 * Math.max(0, p.nz) * Math.max(0, -p.ny * 0.5 + 0.6) },
    hole: { ramp: ["#000000", "#000000", "#010102"], amb: 0, dif: 0.05, noRim: true },
    flag: FLAG, stone: { ...STONE, ramp: ramp(["#030303", "#141416", "#2b2d31", "#4c4f56"], 5) },
  };
  // 頭巾と法衣: 肩から裾へ広がる円錐、裾は襞を打ってほどける
  const hood = U(2.5, ellipsoid([48, 22, 1], [9.5, 10, 8.5], "robe"), cone([48, 18, -1], [43, 6, -4], 6, 0.8, "robe"));
  const robe = Disp(cone([48, 30, 0], [48, 82, -2], 9.5, 21, "robe"), (x, y, z) => 0.9 * Math.sin(Math.atan2(z + 2, x - 48) * 7 + y * 0.08) * Math.max(0, (y - 40) / 40));
  const shoulders = ellipsoid([48, 34, 0], [15, 6, 8], "robe");
  // 袖: 左は杖へ下がり、右は魔法陣へ高く掲げる。袖口は空洞
  const sleeveL = tube([[38, 34, 2, 4], [31, 44, 6, 5], [26, 54, 9, 7.2]], "robe");
  const sleeveR = tube([[58, 34, 2, 4], [67, 30, 5, 5], [74, 21, 8, 6.6]], "robe");
  let body = Disp(U(3, hood, shoulders, robe, sleeveL, sleeveR), (x, y, z) => 0.5 * fbm(x * 0.15, y * 0.15, z * 0.15, 3));
  // 中身の無い頭巾の奥、袖口の闇
  body = Sub(body, ellipsoid([48, 25, 9], [5.6, 7.2, 6], "hole"), 1.2);
  body = Sub(body, ellipsoid([25, 57, 11], [5.2, 3.6, 5], "hole"), 0.8);
  body = Sub(body, ellipsoid([76, 18, 10], [4.6, 3.6, 4.6], "hole", -30), 0.8);
  // 宙に浮く骨の手: 袖から離れて浮かぶ
  const handL = U(0.4, ellipsoid([22, 63, 12], [3, 3.4, 2.2], "bone"), ...fingers([22, 63, 12], 0, "bone", { n: 4, len: 6, spread: 10, r: 0.75, curl: 1.6, z: 1 }), cyl([24, 59, 11], [23, 61, 11.5], 0.9, "bone"));
  const handR = U(0.4, ellipsoid([80, 13, 11], [3, 3.4, 2.2], "bone", 20), ...fingers([80, 12, 11], -70, "bone", { n: 4, len: 7.5, spread: 26, r: 0.7, curl: -0.15, z: 1 }), cone([83, 14, 11], [87, 10, 12], 0.75, 0.4, "bone"), cyl([78, 15, 10], [77, 16.5, 10], 0.8, "bone"));
  // ねじれた杖: 細かくうねる柄、頭は鉤に巻いて紫の宝珠を抱く
  const sp = [];
  for (let y = 88; y >= 18; y -= 5) sp.push([21 + Math.sin(y * 0.45) * 1.1, y, 11 + Math.cos(y * 0.45) * 0.8, 1.25 + (88 - y) * 0.004]);
  sp.push([19, 12, 11, 1.3], [21, 6, 11, 1.2], [26.5, 5.5, 11, 1.1], [28, 10.5, 11, 0.9], [25.5, 14, 11.5, 0.7]);
  const staff = Disp(tube(sp, "staff", { seg: 3 }), (x, y, z) => 0.2 * Math.sin(y * 2.2));
  const orb = sphere([23.8, 10, 11.5], 2.3, "orb");
  const scene = U(0, body, handL, handR, staff, orb);
  // 床は別に描いて、法衣が溶けて空いた所にだけ敷く (浮いているので台は小さく)
  const floor = render(flagstones(48, 91, 30, 10, { n: 3, seed: 97, big: 2.6 }), mats, { w: 96, h: 96 });
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, rimTh: 0.15, lights: [{ p: [24, 10, 16], r: 26, k: 0.55 }, { p: [80, 14, 18], r: 22, k: 0.35 }] });
  const C = new Canvas(r);
  // 法衣の縁が闇に溶ける: 輪郭に近いほど、裾ほど画素を抜く
  const W = 96, H = 96;
  const near = (x, y) => { let n = 0; for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H || !C.pix[Y * W + X]) n++; } return n / 49; };
  const drop = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = C.pix[y * W + x]; if (!p || p.m !== "robe") continue;
    const e = near(x, y), fadeY = Math.max(0, (y - 62) / 22);
    const a = 0.98 - e * 1.9 - fadeY * 1.1 + 0.45 * fbm(x * 0.22, y * 0.12 - 3, 6);
    if (a < (BAYER[y & 3][x & 3] + 0.5) / 16) drop.push(y * W + x);
  }
  for (const i of drop) C.px[i] = null;
  // 裾から垂れて消える影の筋
  const Sh = ["#010102", "#040307", "#08060d"];
  const Rt = rand(103);
  for (let k = 0; k < 9; k++) { let x = 34 + Rt() * 30, y = 74 + Rt() * 6; const L = 6 + Rt() * 10; for (let i = 0; i < L; i++) { if (Rt() < 0.75) C.set(x, y, Sh[i < L * 0.4 ? 2 : i < L * 0.75 ? 1 : 0]); y += 1; x += Math.sin(i * 0.6 + k) * 0.6; } }
  for (let i = 0; i < W * H; i++) if (!C.px[i] && floor.px[i]) C.px[i] = floor.px[i];
  // 背後の魔法陣 (空いている所にだけ描く = 影の後ろ)
  const P = ["#1e0e30", "#3e1e62", "#6a36a4", "#a670e6", "#dcb4ff"];
  const back = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (!C.get(x, y)) C.set(x, y, c); };
  const cx = 50, cy = 46;
  for (let a = 0; a < Math.PI * 2; a += 0.012) {
    back(cx + Math.cos(a) * 33, cy + Math.sin(a) * 33, P[2]);
    back(cx + Math.cos(a) * 28, cy + Math.sin(a) * 28, P[1]);
    back(cx + Math.cos(a) * 13, cy + Math.sin(a) * 13, P[1]);
  }
  // 環の間の文字 (小さな刻みの並び)
  const Rr = rand(101);
  for (let a = 0; a < Math.PI * 2; a += 0.26) {
    const k = Math.floor(Rr() * 4);
    const x0 = cx + Math.cos(a) * 30.5, y0 = cy + Math.sin(a) * 30.5;
    const tx = -Math.sin(a), ty = Math.cos(a), nx = Math.cos(a), ny = Math.sin(a);
    const glyph = [[[0, -1], [0, 1]], [[-1, -1], [1, 1]], [[-1, 0], [1, 0], [0, -1]], [[-1, 1], [0, -1], [1, 1]]][k];
    for (const [u, v] of glyph) back(x0 + tx * u + nx * v, y0 + ty * u + ny * v, P[3]);
  }
  // 五芒の星 (外環に内接)
  const star = []; for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * Math.PI * 4 / 5; star.push([cx + Math.cos(a) * 28, cy + Math.sin(a) * 28]); }
  for (let i = 0; i < 5; i++) { const [x0, y0] = star[i], [x1, y1] = star[(i + 1) % 5]; const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0)); for (let j = 0; j <= n; j++) back(x0 + (x1 - x0) * j / n, y0 + (y1 - y0) * j / n, j % 7 === 3 ? P[0] : P[1]); }
  // 掲げた手の指先から陣へ伸びる紫の糸
  for (let i = 0; i <= 14; i++) { const t = i / 14; const x = 83 - t * 4 + Math.sin(t * 9) * 1.2, y = 7 + t * 9; back(x, y - 4, i % 2 ? P[3] : P[2]); }
  // 頭巾の奥の、かすかな二つの眼
  C.set(46, 25, "#6a36a4"); C.set(50, 25, "#6a36a4"); C.set(46, 24, "#a670e6"); C.set(50, 24, "#a670e6");
  // 呼び出された霊の灯: 尾を引く小さな青紫の炎
  const S = ["#2a2a5a", "#4a5aa0", "#8aa0e8", "#dce4ff"];
  for (const [x, y, dx, dy] of [[8, 34, 1, 1], [86, 52, -1, 1], [12, 78, 1, -1], [80, 76, -1, -0.6], [62, 6, -1, 0.5]]) {
    for (let i = 4; i >= 1; i--) back(x + dx * i * 1.1, y + dy * i * 0.9, S[Math.max(0, 1 - Math.floor(i / 3))]);
    for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [1, 1], [0, -1], [1, -1]]) back(x + ox - 0.5, y + oy - 0.5, oy === -1 ? S[1] : S[2]);
    C.set(x, y, S[3]);
  }
  // 床に落ちる陣の照り返し
  for (let x = 24; x <= 72; x++) { const y = 92 + Math.round(Math.sin(x * 0.5)); if (C.get(x, 91) && (x % 3)) C.set(x, 91, x % 2 ? P[0] : P[1]); }
  return C.toArt();
}
