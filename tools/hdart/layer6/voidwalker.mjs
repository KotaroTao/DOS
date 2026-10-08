import { tube, sphere, ellipsoid, cone, cyl, torus, slab, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { fingers } from "../human.mjs";
import { RIM, bubbles, motes, afterimage, dissolve } from "../temple.mjs";
export const meta = { id: "bs_voidwalker", key: "hd_voidwalker", w: 96, h: 96,
  note: "虚無の歩者: 水底の闇から抜け出した、ひょろ長い人の形の虚ろ。顔は無く、胸と顔にぽっかり空いた穴の奥に星のような光の粒が散る。細長い腕をだらりと垂らし、体の縁はゆらいで二重三重にぶれる (刃は空を切り、呪文も吸い込まれる)。足は水にほどける" };
export function build() {
  const mats = {
    shade: { ramp: ramp(["#020205", "#05050c", "#090a14", "#0f101e", "#16182a", "#1f2238", "#2a2e48"], 7), dither: 0.6, amb: 0.2, spec: 0.5, pow: 18, specCol: "#4a5070",
      shade: p => 0.1 * fbm(p.x * 0.3, p.y * 0.3, p.z * 0.3) },
    hole: { ramp: ["#000000"], solid: "#000000" },
  };
  // 細長い体: 小さな頭、長い首、なで肩、垂れた長い腕
  const head = ellipsoid([48, 16, 0], [5, 6.6, 4.6], "shade");
  const neck = tube([[48, 20, 0, 1.8], [48, 27, 0, 2]], "shade");
  const torso = U(2.4, ellipsoid([48, 36, 0], [8.4, 9, 5], "shade"), ellipsoid([48, 52, 0], [5.6, 9, 4], "shade"), ellipsoid([48, 62, 0], [6.4, 4, 4], "shade"));
  const arms = [tube([[41, 30, 0, 2.2], [34, 46, 2, 1.7], [31, 64, 4, 1.3]], "shade", { seg: 3 }), tube([[55, 30, 0, 2.2], [62, 46, 2, 1.7], [65, 64, 4, 1.3]], "shade", { seg: 3 })];
  const hands = [...fingers([31, 64.5, 4], 95, "shade", { n: 4, len: 9, spread: 14, r: 0.6, curl: 0.15 }), ...fingers([65, 64.5, 4], 85, "shade", { n: 4, len: 9, spread: 14, r: 0.6, curl: -0.15 })];
  const legs = [tube([[45, 64, 0, 2.6], [43, 78, 1, 2], [42, 92, 1, 1.6]], "shade", { seg: 3 }), tube([[51, 64, 0, 2.6], [53, 78, 1, 2], [54, 92, 1, 1.6]], "shade", { seg: 3 })];
  // 穴: 顔と胸。奥は真の闇 (星を後から描く)
  const holes = U(0, ellipsoid([48, 16, 4], [3.2, 4.4, 3], "hole"), ellipsoid([48, 38, 4], [5, 6, 4], "hole"));
  const body = Disp(Sub(U(1.6, head, neck, torso, ...arms, ...legs), holes, 0.6), (x, y, z) => 0.25 * vnoise(x * 0.6, y * 0.6, z));
  const r = render(U(0, body, ...hands), mats, { w: 96, h: 96, rim: "#3a4268", rimTh: 0.1 });
  const C = new Canvas(r);
  // 穴の奥の星の粒と、渦巻く淡い光
  const R = rand(881);
  const ST = ["#1a1c3a", "#3a3e78", "#8890d8", "#e8ecff"];
  for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) {
    const p = C.pix[y * 96 + x]; if (!p || p.m !== "hole") continue;
    const v = R();
    if (v < 0.06) C.set(x, y, ST[3]); else if (v < 0.14) C.set(x, y, ST[2]); else if (v < 0.28) C.set(x, y, ST[Math.sin(Math.atan2(y - 38, x - 48) * 3 + Math.hypot(x - 48, y - 38)) > 0.4 ? 1 : 0]);
  }
  // 体の縁のぶれ (回避): 左右へ淡い影を二重に
  afterimage(C, [[-5, 0, 0.5, "#10122a"], [5, 0, 0.5, "#10122a"], [-10, 1, 0.25, "#0a0b1a"], [10, 1, 0.25, "#0a0b1a"]], [0, 0, 96, 84]);
  // 足は水にほどける
  dissolve(C, 76, 94, { seed: 11, darken: mats.shade.ramp });
  // 周りに吸い込まれていく光の粒 (呪文を呑む)
  for (let i = 0; i < 24; i++) {
    const a = R() * Math.PI * 2, d = 14 + R() * 26, x = 48 + Math.cos(a) * d, y = 40 + Math.sin(a) * d * 0.9;
    const X = Math.round(x), Y = Math.round(y);
    if (C.get(X, Y)) continue;
    C.set(X, Y, ST[R() < 0.3 ? 2 : 1]);
    const tx = Math.round(x - Math.cos(a) * 2), ty = Math.round(y - Math.sin(a) * 2);
    if (!C.get(tx, ty)) C.set(tx, ty, ST[0]);
  }
  bubbles(C, 883, 8);
  motes(C, 885, 8);
  return C.toArt();
}
