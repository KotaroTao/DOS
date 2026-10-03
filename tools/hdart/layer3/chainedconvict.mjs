import { tube, sphere, ellipsoid, cone, slab, cyl, box, torus, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { humanoid, fingers } from "../human.mjs";
import { GRAVEL, ROCK, RIM, rubble, pebbles } from "../mine.mjs";
export const meta = { id: "bs_chainedconvict", key: "hd_chainedconvict", w: 96, h: 96,
  note: "鎖つなぎの罪人: 痩せ枯れた罪人の骸。落ち窪んだ眼窩と剥き出しの歯、ぼろの囚衣、錆びたつるはしを振りかぶる。足枷の鎖は床の鉄球へ" };
export function build() {
  const mats = {
    skin: { ramp: ramp(["#030303", "#0b0a08", "#16140f", "#221f17", "#302b20", "#3f392a", "#524a36", "#6a6046", "#857a5a"], 9), spec: 0.5, pow: 25, specCol: "#9c9070", dither: 0.55,
      shade: p => 0.1 * fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5) + (p.y > 38 && p.y < 52 && Math.abs(p.x - 47) < 8 ? -0.16 * Math.max(0, Math.sin(p.y * 1.25)) : 0) },
    rag: { ramp: ramp(["#030303", "#0b0a09", "#15130f", "#211d17", "#2e2820", "#3c3429"], 6), dither: 0.65, spec: 0.2, pow: 15,
      shade: p => 0.12 * Math.sin(p.x * 0.9 + p.y * 0.2) + (Math.floor(p.y * 0.42) % 2 ? -0.06 : 0) },
    iron: { ramp: ramp(["#020203", "#08090b", "#121418", "#1d2026", "#2a2e36", "#3c414b", "#555b66"], 7), spec: 1.1, pow: 40, specCol: "#a0a8b4", dither: 0.45,
      shade: p => 0.1 * fbm(p.x * 0.6, p.y * 0.6, p.z * 0.6) },
    rust: { ramp: ramp(["#030202", "#0f0705", "#1f0f08", "#33180c", "#4a2412", "#64321a"], 6), spec: 0.4, pow: 20, dither: 0.6 },
    wood: { ramp: ramp(["#040302", "#110b07", "#1f150c", "#2e1f12", "#402b19", "#543a22"], 6), dither: 0.5, shade: p => 0.08 * Math.sin(p.x * 3 + p.y * 2) },
    hole: { ramp: ["#000000", "#000000", "#030202"], amb: 0, dif: 0.1, noRim: true },
    gravel: GRAVEL, rock: ROCK,
  };
  // 骨と皮の体: 前のめりに、つるはしを右肩の上へ振りかぶる
  const J = { head: [44, 20, 8], neck: [45, 27, 5], chest: [46, 38, 2], waist: [47, 51, 1], hip: [47, 59, 0],
    shL: [36, 32, 4], elL: [30, 42, 10], haL: [40, 46, 14], shR: [56, 32, 0], elR: [64, 26, 6], haR: [57, 20, 10],
    hpL: [42, 61, 0], knL: [38, 74, 4], ftL: [36, 88, 4], hpR: [52, 61, -1], knR: [58, 74, 2], ftR: [61, 88, 0] };
  const body = humanoid(J, { skin: "skin" }, { w: { headX: 4.3, headY: 5.4, headZ: 4.8, neck: 1.7, chestX: 8, chestY: 7.5, chestZ: 5, waistX: 5, waistY: 6, waistZ: 3.6, hipX: 6.5, hipY: 4.5,
    arm: 2.0, arm2: 1.7, wrist: 1.3, thigh: 2.6, knee: 2.2, ankle: 1.6 }, k: 1.3 });
  // 頭蓋に張りついた皮: 落ち窪んだ眼窩、削げた頬、剥き出しの歯列
  const skull = Sub(Disp(U(1, body, ellipsoid([44, 25, 10], [3.6, 2.2, 3.8], "skin")), (x, y, z) => 0.12 * fbm(x * 0.8, y * 0.8, z * 0.8)),
    U(0, ellipsoid([42, 19, 13], [1.6, 1.6, 2], "hole"), ellipsoid([46.8, 19, 13], [1.6, 1.6, 2], "hole"), ellipsoid([44.5, 25.4, 14], [2.4, 0.9, 1.6], "hole")), 0.8);
  // 囚衣: 腰巻きと裂けた肩布
  const loin = Disp(slab([[39, 55], [56, 55], [57, 66], [53, 64], [50, 70], [46, 65], [42, 69], [38, 64]], 4, 4.8, "rag", 1.2), (x, y, z) => 0.4 * Math.sin(x * 1.1 + y * 0.3));
  const sash = Disp(slab([[36, 30], [41, 29], [54, 46], [51, 50], [47, 47]], 6, 1.2, "rag", 0.5), (x, y, z) => 0.3 * Math.sin(y));
  // つるはし: 両手で握った柄が肩の上へ伸び、鉄の頭は後ろ上へ
  const haft = cyl([38, 50, 15], [64, 8, 8], 1.4, "wood", 0.3);
  const pick = Paint(Disp(tube([[50, 2, 7, 1.4], [58, 4, 8, 2.4], [64, 8, 8, 2.8], [72, 10, 8, 2.2], [80, 16, 7, 1.0], [84, 22, 6, 0.3]], "iron", { seg: 3 }), (x, y, z) => 0.2 * fbm(x * 0.8, y * 0.8)),
    (x, y, z, m) => fbm(x * 0.3, y * 0.3, z * 0.3, 3) > 0.12 ? "rust" : m);
  const handL = fingers([40, 46, 14], -60, "skin", { n: 4, len: 4, spread: 14, r: 0.8, curl: 1.2, z: 1 });
  const handR = fingers([57, 20, 10], -60, "skin", { n: 4, len: 4, spread: 14, r: 0.8, curl: 1.2, z: 1 });
  // 足枷と鎖、床の鉄球
  const shackle = torus([36, 84, 5], 3.2, 1.2, "iron", 0, 70);
  const links = [];
  const chain = (a, b, n) => { for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, p = a.map((v, c) => v + (b[c] - v) * t); p[1] += Math.sin(t * Math.PI) * 1.2; links.push(torus(p, 2.1, 0.75, "iron", Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI, i % 2 ? 0 : 90)); } };
  chain([33, 84, 8], [15, 84, 12], 5);
  const ball = Disp(sphere([10, 83, 12], 5.4, "iron"), (x, y, z) => 0.3 * fbm(x * 0.5, y * 0.5, z * 0.5));
  const scene = U(0, rubble(48, 91, 44, 13, { n: 6, seed: 11, big: 3 }), skull, loin, sash, haft, pick, ...handL, ...handR, shackle, ...links, ball);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  // 眼窩の奥の小さな燐光と、歯
  C.set(42, 19, "#6a7a50"); C.set(47, 19, "#6a7a50");
  for (let x = 42; x <= 47; x++) C.only(x, 25, x % 2 ? "#8a8264" : "#bcb290");
  // 囚人番号の焼き印
  C.line(47, 41, 50, 41, "#140b06"); C.line(48, 43, 51, 43, "#140b06");
  pebbles(C, 5, 48, 90, 40);
  return C.toArt();
}
