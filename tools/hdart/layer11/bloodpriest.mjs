import { sphere, ellipsoid, cone, tube, box, cyl, torus, U, Sub, Disp, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { humanoid, fingers } from "../human.mjs";
import { SAND, BLOOD, ASHBED, RIM, GHOST, SOULS, sandFloor, ashfall, puffs } from "../arena.mjs";
export const meta = { id: "bs_bloodpriest", key: "hd_bloodpriest", w: 96, h: 96,
  note: "血の司祭: 闘技場の砂に流れた血を杯に受けて捧げ続けた司祭の霊。赤黒い法衣に高い頭巾、顔は影に沈み、細い眼だけが光る。縁の欠けた銀の杯を両手で高く掲げると、宿した魂の青白い光が細い筋になって杯へ吸い寄せられる (吸命・多用)。傷ついた闘士には杯の中身を振りかけて傷をふさぐ (治癒役) — 杯から赤い滴があふれる。裾は砂の上に浮いてほどける" };
export function build() {
  const mats = {
    robe: { ramp: ["#060203", "#120406", "#20080b", "#300c10", "#421216", "#58181c"], dither: 0.6, amb: 0.22,
      shade: p => 0.12 * Math.sin(p.x * 1.1 + 2 * fbm(p.x * 0.2, p.y * 0.2)) },
    trim: { ramp: ["#0e0904", "#2a1c0c", "#4a3616", "#725826"], dither: 0.4, spec: 1, pow: 24 },
    silver: { ramp: ["#08080a", "#1a1a20", "#30303a", "#4c4c58", "#72727e", "#a0a0ac", "#d4d4dc"], spec: 1.4, pow: 34, specCol: "#ffffff", dither: 0.4 },
    wine: { ramp: ["#1a0304", "#3e080a", "#6a1210", "#9a2018"], emit: p => 0.3 + 0.6 * Math.max(0, -p.ny) },
    ghost: { ramp: GHOST, dither: 0.6, amb: 0.3 },
    hole: { ramp: ["#000000", "#010102"], amb: 0, dif: 0.05, noRim: true },
    eye: { ramp: ["#5a0a06", "#c42a1a", "#ff8a6a"], emit: () => 0.95 },
    sand: SAND, blood: BLOOD, ashbed: ASHBED,
  };
  const J = { head: [48, 40, 2], neck: [48, 46, 1], chest: [48, 54, 0], waist: [48, 64, 0], hip: [48, 70, 0],
    shL: [41, 50, 4], elL: [34, 38, 8], haL: [44, 21, 10], shR: [55, 50, -2], elR: [62, 38, 6], haR: [52, 21, 10] };
  const body = humanoid(J, { skin: "robe" }, { w: { headX: 4.4, headY: 5.4, chestX: 8.4, chestY: 7.6, chestZ: 6, waistX: 7.4, hipX: 8.6, arm: 2.8, arm2: 2.4, wrist: 1.6 } });
  const robe = Disp(cone([48, 90, 0], [48, 56, 0], 16, 8, "robe"), (x, y, z) => 0.7 * Math.abs(Math.sin(x * 0.8 + y * 0.06)) + 0.5 * fbm(x * 0.3, y * 0.3));
  const hood = U(1, cone([48, 42, 0], [46, 28, -3], 7.4, 1.6, "robe"), ellipsoid([48, 44, 0], [8, 3, 6], "robe"));
  const shadow = ellipsoid([48, 41, 5.4], [3.6, 4, 3], "hole");
  const eyes = [box([46.2, 40, 7.2], [1, 0.35, 0.6], "eye"), box([49.8, 40, 7.2], [1, 0.35, 0.6], "eye")];
  const stole = [tube([[44, 48, 6, 1.4], [42, 66, 10, 1.4], [40, 88, 12, 1.6]], "trim"), tube([[52, 48, 6, 1.4], [54, 66, 10, 1.4], [56, 88, 12, 1.6]], "trim")];
  const hands = [...fingers([44, 20, 10], -60, "ghost", { n: 3, len: 3, spread: 10, r: 0.6, curl: 0.8 }), ...fingers([52, 20, 10], -120, "ghost", { n: 3, len: 3, spread: 10, r: 0.6, curl: -0.8 })];
  // 縁の欠けた銀の杯
  const cup = Sub(U(0.6, cone([48, 15, 10], [48, 8, 10], 2, 5.4, "silver"), cyl([48, 15, 10], [48, 19, 10], 0.9, "silver"), cyl([48, 19, 10], [48, 20.4, 10], 3, "silver", 0.4)),
    U(0, ellipsoid([48, 7.4, 10], [4.4, 1.6, 4.4], "silver"), box([52, 7, 13], [1.4, 1.6, 2], "silver")), 0.2);
  const wine = ellipsoid([48, 8.4, 10], [4, 0.9, 4], "wine");
  const scene = U(0, sandFloor(48, 95, 40, 12, { seed: 12501, blood: 0.3, ash: 0.05, flags: 0 }), Sub(U(1.4, body, robe, hood), shadow, 0.3), ...eyes, ...stole, ...hands, cup, wine);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [48, 4, 18], r: 18, k: 0.4 }] });
  const C = new Canvas(r);
  // 裾を砂の上にほどく
  for (let y = 78; y < 93; y++) for (let x = 24; x < 74; x++) { const p = C.pix[y * 96 + x]; if (p && (p.m === "robe" || p.m === "trim") && (y - 78) / 12 + 0.4 * fbm(x * 0.3, y * 0.2, 6) > 0.55 + ((x * 7 + y * 3) % 5) * 0.08) C.px[y * 96 + x] = null; }
  // 杯へ吸い寄せられる魂の光の筋 (左右の下から)
  for (const [x0, y0, s] of [[8, 70, 1], [88, 64, -1], [14, 40, 1], [86, 34, -1]]) {
    for (let t = 0; t <= 1; t += 0.01) { const x = x0 + (48 - x0) * t + Math.sin(t * 8) * 3 * s, y = y0 + (8 - y0) * t * t; if (C.get(Math.round(x), Math.round(y))) continue; C.set(x, y, SOULS[t > 0.8 ? 3 : t > 0.4 ? 2 : 1]); }
    soulLampDot(C, x0, y0);
  }
  function soulLampDot(C, x, y) { C.set(x, y, SOULS[4]); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!C.get(x + dx, y + dy)) C.set(x + dx, y + dy, SOULS[2]); }
  // 杯からあふれる赤い滴
  for (const [x, y, l] of [[53, 9, 4], [43, 10, 3], [54, 14, 2]]) for (let k = 0; k < l; k++) if (!C.get(x, y + k * 2)) C.set(x, y + k * 2, k === l - 1 ? "#9a2018" : "#6a1210");
  ashfall(C, 12503, 40);
  return C.toArt();
}
