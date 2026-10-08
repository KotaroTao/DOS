import { tube, sphere, ellipsoid, cone, cyl, box, torus, slab, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { humanoid, fingers } from "../human.mjs";
import { FLAG, POOL, MARBLE, RIM, templeFloor, ripples, bubbles, motes, column } from "../temple.mjs";
export const meta = { id: "el_fallenidol", key: "hd_fallenidol", w: 112, h: 128,
  note: "堕ちた神像 (強敵): 祈られることに飢えた、背の高い女神の石像。ひびの走る白い石肌に金箔がはがれ残り、薄布の下でほほえむ顔の片側が欠けて闇がのぞく。両腕を大きく広げて抱きしめようとし、胸の前から薄紅の光の輪が広がって見る者の心を奪う。台座の下には、藻に巻かれた参拝者たちがひざまずいて祈る" };
export function build() {
  const W = 112, H = 128;
  const mats = {
    stone: { ramp: ramp(["#070706", "#151412", "#25231f", "#38352f", "#4e4a42", "#686258", "#847d70", "#a49b8a", "#c4baa6"], 9), spec: 0.7, pow: 22, specCol: "#f0e6d0", dither: 0.45, amb: 0.2,
      shade: p => 0.08 * fbm(p.x * 0.4, p.y * 0.4, p.z * 0.4) },
    leaf: { ramp: ramp(["#0a0602", "#2a1a06", "#4e340c", "#7a5414", "#a8781e", "#d8a838"], 6), spec: 1.6, pow: 34, specCol: "#fff0b0", dither: 0.4 },
    veil: { ramp: ramp(["#0c0a0a", "#221e1e", "#3a3434", "#565050", "#746e6c"], 5), dither: 0.6, amb: 0.3, shade: p => 0.14 * Math.sin(p.x * 1.1 + p.y * 0.15) },
    hole: { ramp: ["#000000", "#000000", "#030202"], amb: 0, dif: 0.05, noRim: true },
    eye: { ramp: ["#5a1a30", "#c04a78", "#ffa8c8", "#ffe8f0"], emit: p => 0.6 + 0.4 * Math.max(0, p.nz) },
    kelp: { ramp: ramp(["#020302", "#071008", "#0d1c0e", "#162a15", "#22381c"], 5), dither: 0.6, amb: 0.22 },
    flag: FLAG, pool: POOL, marble: MARBLE,
  };
  const cx = 56;
  // 台座: 段の付いた四角い台
  const plinth = U(0.6, box([cx, 104, 0], [22, 5, 14], "marble", 1), box([cx, 97, 0], [18, 3, 12], "marble", 0.8));
  // 女神の体: 高く伸びた像。腕は左右へ大きく広げる
  const J = { head: [cx, 20, 2], neck: [cx, 27, 1], chest: [cx, 37, 1], waist: [cx, 49, 0], hip: [cx, 58, 0],
    shL: [cx - 10, 32, 1], elL: [cx - 24, 34, 6], haL: [cx - 36, 28, 9], shR: [cx + 10, 32, 1], elR: [cx + 24, 34, 6], haR: [cx + 36, 28, 9] };
  const body = humanoid(J, { skin: "stone" }, { w: { headX: 6, headY: 7.4, headZ: 6, chestX: 10, chestY: 8, waistX: 7, hipX: 9, arm: 3, arm2: 2.6, wrist: 1.9 } });
  const hands = [U(0.5, ellipsoid([cx - 38, 27.4, 9.6], [2.6, 2.6, 2], "stone"), ...fingers([cx - 39, 27, 9.6], 200, "stone", { n: 4, len: 6, spread: 26, r: 0.8, curl: -0.3 })),
    U(0.5, ellipsoid([cx + 38, 27.4, 9.6], [2.6, 2.6, 2], "stone"), ...fingers([cx + 39, 27, 9.6], -20, "stone", { n: 4, len: 6, spread: 26, r: 0.8, curl: 0.3 }))];
  // 長い衣 (腰から台座まで、ひだが流れる)
  const gown = Disp(cone([cx, 52, 0], [cx, 95, 0], 9, 17, "stone"), (x, y, z) => 1.0 * Math.sin(Math.atan2(z, x - cx) * 9 + y * 0.04) * Math.max(0, (y - 56) / 36));
  // 頭の薄布: 頭頂から肩へ垂れる
  const veil = Disp(U(1.2, ellipsoid([cx, 16, -2], [7.6, 7.6, 6.4], "veil"), cone([cx, 20, -4], [cx, 46, -6], 7.6, 13, "veil")), (x, y, z) => 0.5 * Math.sin(Math.atan2(z, x - cx) * 7 + y * 0.1));
  const veilCut = ellipsoid([cx, 23, 6], [6.2, 8, 6], "veil");
  // 顔: 閉じた眼と微笑み。右半分 (見る側の右) が欠けて闇
  const smile = U(0, ellipsoid([cx - 2.4, 20, 7.6], [1.6, 0.4, 0.8], "hole", 10), Disp(ellipsoid([cx, 25.4, 7.8], [2.6, 0.5, 0.8], "hole"), (x, y, z) => -0.6 * ((x - cx) / 2.6) ** 2));
  const broken = Disp(ellipsoid([cx + 6, 19, 8], [4, 6, 4], "hole"), (x, y, z) => 1.2 * vnoise(x * 0.9, y * 0.9, z * 0.9));
  const eyeIn = sphere([cx + 3.4, 19.6, 4.4], 1.3, "eye");
  // 金箔の残り: 衣の縁・胸・冠の帯
  const gild = (x, y, z, m) => {
    if (m !== "stone") return m;
    if (fbm(x * 0.35, y * 0.35, z * 0.35) > 0.3) return m === "stone" ? "leaf" : m;
    if (y > 88 && y < 91) return "leaf";
    return m;
  };
  // 胸の前の光源 (魅了の光)
  const heart = sphere([cx, 40, 10], 2.4, "eye");
  // 台座にすがる参拝者 (藻に巻かれた小さな人影)
  const pilgrims = [];
  for (const [x, z, s] of [[cx - 26, 14, 1], [cx + 24, 15, 1], [cx - 12, 18, 0.9], [cx + 10, 19, 0.85]]) {
    pilgrims.push(Disp(U(1.4, ellipsoid([x, 112 - 6 * s, z], [3.4 * s, 4.6 * s, 3 * s], "kelp", 20 * Math.sign(cx - x)), ellipsoid([x + 2 * Math.sign(cx - x), 106 - 8 * s, z + 1], [2.2 * s, 2.4 * s, 2.2 * s], "kelp"),
      tube([[x, 108 - 6 * s, z + 2, 1 * s], [x + 5 * Math.sign(cx - x) * s, 100 - 6 * s, z + 3, 0.8 * s]], "kelp")), (X, Y, Z) => 0.4 * vnoise(X, Y, Z)));
  }
  const idol = Paint(Sub(Sub(U(1.4, body, gown, ...hands), smile, 0.2), broken, 0.6), gild);
  const scene = U(0, templeFloor(cx, 118, 54, 16, { n: 3, seed: 1001, cols: 1 }), column(8, 116, -16, 76, 5, { seed: 7 }), column(104, 116, -16, 58, 5, { seed: 9 }), plinth, idol, Sub(veil, veilCut, 1), eyeIn, heart, ...pilgrims);
  const r = render(scene, mats, { w: W, h: H, rim: RIM, bounce: 0.12, lights: [{ p: [cx, 40, 24], r: 30, k: 0.45 }] });
  const C = new Canvas(r);
  // ひび: 体を走る黒い割れ目
  const R = rand(1003);
  for (let i = 0; i < 7; i++) {
    let x = cx - 14 + R() * 28, y = 30 + R() * 50, a = Math.PI / 2 + (R() - 0.5);
    for (let k = 0; k < 14; k++) { const p = C.pix[Math.round(y) * W + Math.round(x)]; if (p && (p.m === "stone" || p.m === "leaf")) C.set(x, y, "#070706"); x += Math.cos(a); y += Math.sin(a); a += (R() - 0.5) * 0.9; }
  }
  // 魅了の光の輪: 胸の前から広がる薄紅の輪
  const P = ["#3a1020", "#6a2040", "#b04a78", "#ffa8c8"];
  for (const [rr, c] of [[14, 3], [24, 2], [36, 1], [50, 0]]) {
    for (let a = 0; a < Math.PI * 2; a += 0.006) {
      const X = Math.round(cx + Math.cos(a) * rr), Y = Math.round(40 + Math.sin(a) * rr * 0.8);
      if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
      if (!C.get(X, Y) && Math.sin(a * 10 + rr) > -0.5) C.set(X, Y, P[c]);
    }
  }
  C.set(cx - 1, 39, "#ffe8f0"); C.set(cx + 3, 19, "#ffe8f0");
  ripples(C, 1005);
  bubbles(C, 1007, 10);
  motes(C, 1009, 12);
  return C.toArt();
}
