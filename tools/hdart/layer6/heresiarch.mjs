import { tube, sphere, ellipsoid, cone, cyl, box, torus, slab, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { fingers } from "../human.mjs";
import { FLAG, POOL, MARBLE, RIM, templeFloor, ripples, bubbles, motes } from "../temple.mjs";
export const meta = { id: "el_heresiarch", key: "hd_heresiarch", w: 112, h: 128,
  note: "異端大司教 (強敵): 生きながら神殿の地下へ葬られた大司教の亡骸。割れた高い司教冠、干からびた顔に紫の鬼火の眼。逆さの聖印を頂く杖を突き、宙に開いた黒い禁書から闇の文字が渦を巻いて立ちのぼる。足元には逆さの印を刻んだ闇の呪文の輪が回り、隊全体を闇の呪文で撃つ。ちぎれた大外套の裾は床に広がる" };
export function build() {
  const W = 112, H = 128;
  const mats = {
    skin: { ramp: ramp(["#060508", "#141118", "#241f28", "#383040", "#4e4456", "#665a6e", "#82748a"], 7), spec: 0.4, pow: 20, dither: 0.45, amb: 0.22 },
    robe: { ramp: ramp(["#040306", "#0a0810", "#110d1a", "#1a1426", "#241c34", "#302444", "#3e2e56"], 7), spec: 0.5, pow: 18, specCol: "#6a5a8a", dither: 0.6, amb: 0.2,
      shade: p => 0.14 * Math.sin((p.x - 56) * 0.6 + p.y * 0.05) + 0.06 * fbm(p.x * 0.4, p.y * 0.4) },
    red: { ramp: ramp(["#080203", "#1c0608", "#300c10", "#481418", "#621e22"], 5), dither: 0.6, amb: 0.2 },
    gold: { ramp: ramp(["#080502", "#1e1206", "#3a240a", "#5c3a12", "#80561c", "#a8782a", "#d0a040"], 7), spec: 1.5, pow: 34, specCol: "#fff0b0", dither: 0.4 },
    page: { ramp: ramp(["#0a0a08", "#22201a", "#3c382c", "#58523e"], 4), dither: 0.5, amb: 0.3 },
    glow: { ramp: ["#2a0a40", "#6a1a9a", "#b050e0", "#f0c0ff"], emit: p => 0.5 + 0.5 * Math.max(0, p.nz) },
    hole: { ramp: ["#000000", "#000000", "#020104"], amb: 0, dif: 0.05, noRim: true },
    flag: FLAG, pool: POOL, marble: MARBLE,
  };
  const cx = 58;
  // 司教冠: 高く尖り、中ほどで割れて片側が欠ける
  const mitre = Sub(U(0.6, cone([cx, 26, 0], [cx, 4, 0], 7.4, 2.4, "gold"), cyl([cx, 26.4, 0], [cx, 23.6, 0], 7.8, "gold", 0.6)), Disp(box([cx + 4, 8, 0], [3, 6, 9], "gold", 0, 20), (x, y, z) => 0.6 * vnoise(x, y, z)), 0.3);
  const mitreFace = (x, y, z, m) => m === "gold" && y < 23 && Math.abs(x - cx) > 1.8 && !(Math.abs(y - 14) < 1.2) ? "red" : m;
  // 干からびた顔: こけた頬、裂けた口
  const head = U(1, ellipsoid([cx, 31, 2], [6, 7, 5.6], "skin"), ellipsoid([cx, 37.4, 3], [3.8, 2.6, 3.6], "skin"));
  const holes = U(0, ellipsoid([cx - 2.4, 30.4, 6.8], [1.8, 1.6, 1.6], "hole"), ellipsoid([cx + 2.4, 30.4, 6.8], [1.8, 1.6, 1.6], "hole"), ellipsoid([cx, 37.4, 6.4], [2.6, 1.2, 1.4], "hole"),
    ellipsoid([cx - 4, 34, 5.6], [1.2, 2, 1.4], "hole"), ellipsoid([cx + 4, 34, 5.6], [1.2, 2, 1.4], "hole"));
  const eyes = [sphere([cx - 2.4, 30.6, 6], 1, "glow"), sphere([cx + 2.4, 30.6, 6], 1, "glow")];
  // 大外套と法衣: 高い襟、裾は床に広がってちぎれる
  const collar = Disp(U(1, ellipsoid([cx - 8, 40, -2], [5, 8, 5], "red", -20), ellipsoid([cx + 8, 40, -2], [5, 8, 5], "red", 20)), (x, y, z) => 0.3 * fbm(x, y));
  const robe = Disp(U(2.2, ellipsoid([cx, 48, 0], [14, 7, 8], "robe"), cone([cx, 50, 0], [cx, 112, 0], 12, 26, "robe")),
    (x, y, z) => 1.4 * Math.sin(Math.atan2(z, x - cx) * 8 + y * 0.05) * Math.max(0, (y - 56) / 50) + 0.25 * fbm(x * 0.3, y * 0.3, z * 0.3));
  const tear = Disp(cyl([cx, 124, 0], [cx, 110, 0], 32, "robe"), (x, y, z) => -5 * Math.max(0, Math.sin(x * 0.7) * 0.6 + vnoise(x * 0.3, 8) * 0.7));
  // 前の帯: 逆さの十字の刺繍
  const band = (x, y, z, m) => {
    if (m !== "robe" || z < 6 || y < 50) return m;
    const dx = x - cx - (y - 50) * 0.02;
    if (Math.abs(dx) < 3) { if (Math.abs(dx) < 0.7 && y > 60 && y < 82) return "gold"; if (Math.abs(y - 76) < 0.7 && Math.abs(dx) < 2.8) return "gold"; return "red"; }
    return m;
  };
  // 腕: 左手は杖、右手は禁書の上にかざす
  const armL = Disp(cone([cx - 11, 46, 1], [cx - 20, 62, 6], 4, 5.6, "robe"), (x, y, z) => 0.3 * Math.sin(y * 1.2));
  const handL = ellipsoid([cx - 21, 64, 7.4], [2.2, 2.6, 2], "skin");
  const armR = Disp(cone([cx + 11, 46, 1], [cx + 20, 54, 9], 4, 5.6, "robe"), (x, y, z) => 0.3 * Math.sin(y * 1.2));
  const handR = U(0.5, ellipsoid([cx + 22, 55, 11], [2.2, 2.2, 1.8], "skin"), ...fingers([cx + 23, 55.6, 11], 70, "skin", { n: 4, len: 5, spread: 22, r: 0.6, curl: 0.2 }));
  // 逆さの聖印の杖
  const sx = cx - 21;
  const staff = U(0.4, cyl([sx, 116, 7.4], [sx, 22, 7.4], 1, "gold"), cyl([sx, 22, 7.4], [sx, 14, 7.4], 0.9, "gold"), cyl([sx - 5, 19, 7.4], [sx + 5, 19, 7.4], 0.9, "gold"), Disp(torus([sx, 30, 7.4], 3, 0.7, "gold", 0, 90), (x, y, z) => 0));
  // 宙に開いた禁書
  const book = U(0.3, slab([[cx + 16, 68], [cx + 27, 64], [cx + 28, 72], [cx + 17, 75]], 12, 0.7, "page", 0.3), slab([[cx + 27, 64], [cx + 37, 67], [cx + 36, 75], [cx + 28, 72]], 12, 0.7, "page", 0.3),
    slab([[cx + 15.4, 69], [cx + 27, 65.4], [cx + 37.6, 68.4], [cx + 36.6, 76.4], [cx + 28, 73.6], [cx + 16.4, 76.4]], 10.6, 0.6, "red", 0.3));
  const prelate = U(0, Paint(mitre, mitreFace), Sub(head, holes, 0.3), ...eyes, Paint(Sub(U(1.2, collar, robe, armL, armR), tear, 1), band), handL, handR, staff, book);
  const scene = U(0, templeFloor(cx, 118, 54, 16, { n: 3, seed: 1021 }), prelate);
  const r = render(scene, mats, { w: W, h: H, rim: RIM, bounce: 0.1, lights: [{ p: [cx + 26, 60, 22], r: 24, k: 0.45 }] });
  const C = new Canvas(r);
  // 禁書から渦巻いて立ちのぼる闇の文字
  const V = mats.glow.ramp, R = rand(1023);
  for (let t = 0; t < 1; t += 0.004) {
    const a = t * Math.PI * 5, rr = 3 + t * 14, x = cx + 27 + Math.cos(a) * rr, y = 64 - t * 54;
    const X = Math.round(x), Y = Math.round(y + Math.sin(a) * 2);
    if (Y < 0 || C.get(X, Y)) continue;
    if (R() < 0.6) C.set(X, Y, V[(Math.floor(t * 40) % 4 === 0) ? 3 : t < 0.5 ? 2 : 1]);
    if (R() < 0.25 && !C.get(X + 1, Y)) C.set(X + 1, Y, V[1]);
  }
  // 足元の闇の呪文の輪 (逆さの印): 楕円の二重環と、外へ突き出た印
  for (const [rx, c] of [[46, 2], [40, 1]]) for (let a = 0; a < Math.PI * 2; a += 0.004) {
    const X = Math.round(cx + Math.cos(a) * rx), Y = Math.round(118 + Math.sin(a) * rx * 0.2);
    if (X < 0 || X >= W) continue;
    const p = C.pix[Y * W + X];
    if (!C.get(X, Y) || (p && (p.m === "flag" || p.m === "pool"))) C.set(X, Y, V[c]);
  }
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2, X = Math.round(cx + Math.cos(a) * 43), Y = Math.round(118 + Math.sin(a) * 8.6);
    const p = C.pix[Y * W + X];
    if (!C.get(X, Y) || (p && (p.m === "flag" || p.m === "pool"))) { C.set(X, Y, V[3]); C.set(X, Y + 1, V[2]); C.set(X - 1, Y + 1, V[1]); C.set(X + 1, Y + 1, V[1]); }
  }
  C.set(cx - 3, 30, "#f0c0ff"); C.set(cx + 2, 30, "#f0c0ff");
  ripples(C, 1025);
  bubbles(C, 1027, 10);
  motes(C, 1029, 12, undefined, false);
  return C.toArt();
}
