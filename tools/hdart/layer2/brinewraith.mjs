import { tube, sphere, ellipsoid, cone, slab, cyl, torus, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { humanoid, fingers } from "../human.mjs";
export const meta = { id: "bs_brinewraith", key: "hd_brinewraith", w: 96, h: 96,
  note: "塩水の亡霊: 溺れ死んだ水夫の霊。毛糸帽と破れた外套、首に絡む千切れた舫い綱、塩の結晶がこびりつく。窪んだ眼窩の奥に青白い光、両腕を広げて命を吸い、下半身は渦巻く水煙にほどける" };
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
export function build() {
  const mats = {
    ghost: { ramp: ramp(["#03080c", "#081620", "#0e2432", "#163646", "#224a5a", "#34646e", "#4e8486", "#78aca4", "#b0d8cc"], 9), dither: 0.7, amb: 0.36, dif: 0.85, spec: 0.8, pow: 30, specCol: "#e0fff4",
      shade: p => 0.25 * Math.pow(1 - Math.abs(p.nz), 2) + 0.1 * fbm(p.x * 0.2, p.y * 0.2, 3) },
    coat: { ramp: ramp(["#02060a", "#061018", "#0a1a26", "#102634", "#183442", "#244650", "#365c62", "#4e7a7a"], 8), dither: 0.7, amb: 0.3, dif: 0.85,
      shade: p => 0.12 * Math.sin(p.x * 0.8 + p.y * 0.25) + 0.15 * Math.pow(1 - Math.abs(p.nz), 2) },
    cap: { ramp: ramp(["#020304", "#06080c", "#0c1018", "#141a24", "#1e2632"], 5), dither: 0.5, shade: p => 0.12 * ((Math.floor(p.x * 0.8)) % 2 ? 1 : -1) },
    skull: { ramp: ramp(["#05080a", "#0e1a1e", "#1c3032", "#2e4a48", "#4a6c66", "#709488", "#a0c0b0", "#d0e8dc"], 8), dither: 0.5, amb: 0.34, spec: 0.6, pow: 30, specCol: "#f0fff8" },
    rope: { ramp: ramp(["#060504", "#16120c", "#2a2216", "#403420", "#5a4a30"], 5), dither: 0.4, shade: p => 0.15 * Math.sin((p.x + p.y) * 2.2) },
    hole: { ramp: ["#000000", "#000000", "#020406"], amb: 0, dif: 0.1, noRim: true },
  };
  const J = { head: [48, 22, 6], neck: [48, 30, 4], chest: [48, 40, 2], waist: [48, 52, 0], hip: [48, 60, -1],
    shL: [39, 34, 4], elL: [26, 36, 8], haL: [14, 30, 12], shR: [57, 34, 4], elR: [70, 36, 8], haR: [82, 30, 12] };
  const body = humanoid(J, { skin: "ghost", head: "skull", torso: "coat", hip: "coat", arm: "coat" }, { w: { chestX: 9, chestY: 8, chestZ: 6, waistX: 7.5, arm: 2.8, arm2: 2.4, wrist: 1.4, headX: 5, headY: 6, headZ: 5 } });
  const coatTail = Disp(tube([[48, 50, 0, 9], [48, 62, -1, 11], [46, 74, -2, 13], [42, 86, -4, 15]], "coat"), (x, y, z) => 0.9 * Math.max(0, Math.sin(x * 0.7 + y * 0.1)) + 0.4 * fbm(x * 0.3, y * 0.3, z * 0.3));
  const collar = U(1, ellipsoid([42, 32, 7], [5, 3, 3], "coat", 30), ellipsoid([54, 32, 7], [5, 3, 3], "coat", -30));
  const cap = U(1, ellipsoid([48, 16.5, 5], [5.2, 3.6, 5], "cap"), torus([48, 18.5, 5], 4.9, 1.1, "cap", 0, 0));
  const face = Sub(body, U(0, ellipsoid([45.8, 22.5, 10], [2.1, 2.4, 3.2], "hole"), ellipsoid([50.4, 22.5, 10], [2.1, 2.4, 3.2], "hole"), ellipsoid([48, 28, 10], [2.2, 2.4, 3.2], "hole")), 0.5);
  const noose = torus([48, 30, 5], 4.2, 1.1, "rope", 0, 80);
  const ropeEnd = tube([[52, 32, 8, 1.1], [56, 40, 10, 1.0], [54, 48, 10, 0.9], [57, 54, 9, 0.8]], "rope");
  const hL = fingers(J.haL, -150, "ghost", { n: 4, len: 7, spread: 26, r: 0.9, curl: 0.4, z: 1 }), hR = fingers(J.haR, -30, "ghost", { n: 4, len: 7, spread: 26, r: 0.9, curl: -0.4, z: 1 });
  const scene = U(0, U(1.5, face, coatTail, collar), cap, noose, ropeEnd, ...hL, ...hR);
  const r = render(scene, mats, { w: 96, h: 96, rim: "#78aca4", rimTh: 0.15 });
  const C = new Canvas(r);
  // 下半身を水煙へ透かしてほどく
  for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) {
    const p = C.pix[y * 96 + x]; if (!p) continue;
    const a = 1.0 - Math.max(0, (y - 54) / 30) * 1.3 + 0.45 * fbm(x * 0.16, y * 0.12, 4) - (p.m === "coat" && y > 44 ? 0.15 : 0);
    if (a < (BAYER[y & 3][x & 3] + 0.5) / 16) C.set(x, y, null);
  }
  // 眼窩の奥の光、外套の二列のボタンと開いた胸の肋
  C.set(46, 23, "#b0f0e8"); C.set(50, 23, "#b0f0e8"); C.set(46, 22, "#4e8486"); C.set(50, 22, "#4e8486");
  for (let i = 0; i < 4; i++) { C.only(42, 40 + i * 5, "#4e8486"); C.only(54, 40 + i * 5, "#4e8486"); C.only(42, 39 + i * 5, "#78aca4"); C.only(54, 39 + i * 5, "#78aca4"); }
  for (let i = 0; i < 4; i++) for (let x = 45; x <= 51; x++) if (x !== 48) C.only(x, 37 + i * 3, i % 2 ? "#163646" : "#4e8486");
  // 渦を巻く水煙と、こびりつく塩の結晶
  const R = rand(19); const F = ["#0e2432", "#163646", "#224a5a", "#34646e", "#4e8486"];
  for (const x0 of [30, 40, 54, 64]) { let x = x0; for (let y = 90; y > 58; y--) { x += Math.sin(y * 0.3 + x0) * 0.6; if ((y + x0) % 3 === 0 && !C.get(Math.round(x), y)) C.set(x, y, F[1 + (y % 2)]); } }
  for (let i = 0; i < 30; i++) { const x = 6 + R() * 84, y = 6 + R() * 86; if (!C.get(Math.round(x), Math.round(y))) C.set(x, y, F[Math.floor(R() * 3)]); }
  const S = ["#d8ece8", "#ffffff", "#9cc4bc"];
  for (let i = 0; i < 60; i++) { const x = Math.floor(28 + R() * 40), y = Math.floor(14 + R() * 42); const p = C.pix[y * 96 + x]; if (p && C.get(x, y) && p.ny < -0.2) C.set(x, y, S[Math.floor(R() * 3)]); }
  return C.toArt();
}
