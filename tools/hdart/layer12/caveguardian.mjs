import { sphere, ellipsoid, cone, tube, box, cyl, slab, U, Sub, Disp, render, Canvas, fbm, rand } from "../sdf.mjs";
import { humanoid, fingers } from "../human.mjs";
import { BED, ROCK, GLASS, FRAME, MURKGLASS, RIM, cavernFloor, cracks, sootCoat, soot, glints, shards } from "../cavern.mjs";
export const meta = { id: "bs_caveguardian", key: "hd_caveguardian", w: 96, h: 96,
  note: "大空洞の守護像: 奥へ続く道に並ぶ、灰色の石の大きな立像。両手で身の丈ほどの分厚い石の板を前に構え、仲間の前に立ちはだかる (護衛)。板と体は何度も打撃を半分に受け流す (障壁3)。顔のない兜の目の穴に冷たい水色の水晶がはめこまれ、台座には「眠らせておけ」と刻んだ古い文字。苔と煤が上を向いた面に積もる" };
export function build() {
  const mats = {
    stone: { ramp: ["#040404", "#0e0d0c", "#1a1917", "#282624", "#383532", "#4a4642", "#5c5852", "#706b64"], spec: 0.3, pow: 18, dither: 0.55,
      shade: p => 0.08 * fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5) },
    moss: { ramp: ["#040603", "#0c1609", "#16260f", "#223818"], dither: 0.7, amb: 0.3 },
    glyph: { ramp: ["#000000", "#06060a"], amb: 0.05, dif: 0.1, noRim: true },
    eye: { ramp: ["#244258", "#6ec4e0", "#e0faff"], emit: () => 0.95 },
    bed: BED, rock: ROCK, glass: GLASS, frame: FRAME, murk: MURKGLASS,
  };
  const J = { head: [48, 20, 0], neck: [48, 26, 0], chest: [48, 36, 0], waist: [48, 48, 0], hip: [48, 54, 0],
    shL: [36, 32, 2], elL: [32, 44, 8], haL: [38, 50, 12], shR: [60, 32, 2], elR: [64, 44, 8], haR: [58, 50, 12],
    hpL: [42, 56, 0], knL: [41, 66, 2], ftL: [40, 76, 2], hpR: [54, 56, 0], knR: [55, 66, 2], ftR: [56, 76, 2] };
  const body = Disp(humanoid(J, { skin: "stone" }, { k: 2, w: { headX: 6.4, headY: 6.6, headZ: 6, chestX: 13, chestY: 10, chestZ: 8, waistX: 9, hipX: 10, arm: 4.6, arm2: 4, wrist: 3.4, thigh: 5, knee: 4.4, ankle: 4.2 } }), cracks(0.6, 0.3));
  const helm = U(1.4, ellipsoid([48, 19, 0], [7.4, 9, 7], "stone"), cone([48, 26, 0], [48, 28, 0], 8.6, 9, "stone"), box([48, 9, -1], [1.4, 4, 6.4], "stone", 0.6), ellipsoid([48, 8, -1], [1.8, 2, 7], "stone"));
  const slits = U(0, box([44.6, 19, 7.4], [2.2, 1, 2], "glyph"), box([51.4, 19, 7.4], [2.2, 1, 2], "glyph"), box([48, 23, 7.4], [0.6, 3, 2], "glyph"));
  const eyes = [sphere([44.6, 19, 6], 1.2, "eye"), sphere([51.4, 19, 6], 1.2, "eye")];
  const pauldrons = [ellipsoid([35, 30, 2], [6, 4.4, 6], "stone", -20), ellipsoid([61, 30, 2], [6, 4.4, 6], "stone", 20)];
  // 前に構えた石の板
  const slab0 = Disp(box([48, 52, 15], [15, 20, 2.6], "stone", 1.6), (x, y, z) => cracks(0.8, 0.25)(x, y, z) + 0.2 * fbm(x * 0.4, y * 0.4, z * 0.4));
  const rune = U(0, ...[[42, 42], [48, 40], [54, 42], [48, 50], [42, 58], [54, 58], [48, 64]].map(([x, y], i) => box([x, y, 18], [i % 2 ? 2.4 : 0.7, i % 2 ? 0.7 : 2.4, 1.2], "glyph")));
  const handsL = fingers([38, 50, 15], 0, "stone", { n: 3, len: 4, spread: 16, r: 1.1, curl: 0.3 });
  const handsR = fingers([58, 50, 15], 180, "stone", { n: 3, len: 4, spread: 16, r: 1.1, curl: -0.3 });
  // 台座と刻んだ文字
  const base = Disp(box([48, 84, 0], [24, 6, 12], "stone", 1.4), cracks(0.6, 0.3));
  const letters = U(0, ...[...Array(9)].map((_, i) => box([30 + i * 4.5, 84 + (i % 2 ? 1 : -1), 12.4], [1.2, 1.8 + (i % 3) * 0.4, 1], "glyph")));
  const scene = U(0, cavernFloor(48, 95, 46, 13, { seed: 13201, rocks: 3, lamps: 2 }), Sub(U(0.8, body, helm, ...pauldrons), slits, 0.2), ...eyes, Sub(slab0, rune, 0.2), ...handsL, ...handsR, Sub(base, letters, 0.1));
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [48, 19, 14], r: 12, k: 0.4 }] });
  const C = new Canvas(r);
  sootCoat(C, ["stone"], { th: -0.55, seed: 13203 });
  // 苔 (上を向いた肩と台座の縁に少し)
  for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) { const p = C.pix[y * 96 + x]; if (p && p.m === "stone" && p.ny < -0.6 && fbm(x * 0.3, y * 0.3, 7) > 0.18) C.set(x, y, fbm(x * 0.6, y * 0.6, 3) > 0.1 ? "#223818" : "#16260f"); }
  // 受け流しの障壁の輪 (板の前に三重)
  for (const [rr, c] of [[24, "#365e78"], [28, "#244258"], [32, "#16243a"]]) for (let a = -Math.PI * 0.8; a < -Math.PI * 0.2; a += 0.5 / rr) { const x = 48 + Math.cos(a) * rr * 0.8, y = 58 + Math.sin(a) * rr; if (!C.get(Math.round(x), Math.round(y)) && Math.sin(a * 20) > -0.5) C.set(x, y, c); }
  glints(C, 13205, ["eye"], 2, ["#6ec4e0", "#e0faff"]);
  shards(C, 13207, ["bed"], 12);
  soot(C, 13209, 30);
  return C.toArt();
}
