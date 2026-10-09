import { sphere, ellipsoid, cone, tube, U, Sub, Disp, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { fingers } from "../human.mjs";
import { RIM, SOUL, FROST, AURORA, snowfall, dissolve, crystal } from "../ice.mjs";
export const meta = { id: "bs_frostmaiden", key: "hd_frostmaiden", w: 96, h: 96,
  note: "氷の乙女: 氷柱に閉ざされて凍え死んだ乙女の霊。霜の結晶を編んだような薄い衣と、氷の髪飾り。長い髪は凍った房になって後ろへ流れ、目を閉じたまま口を開いて哀歌を歌う。胸の前で組んだ手から癒しの光の雪がこぼれ (治癒)、歌声は心を奪う淡い波の輪になって広がる (魅了)。裾は吹雪にほどけて消える" };
export function build() {
  const mats = {
    gown: { ramp: ramp(["#04070c", "#0c1622", "#162636", "#22384c", "#304c64", "#42627c", "#5a7c94", "#7a9aae", "#a0bccc"], 9), dither: 0.6, amb: 0.3,
      shade: p => 0.14 * Math.sin(p.x * 0.9 + p.y * 0.05 + 1.6 * fbm(p.x * 0.15, p.y * 0.1)) },
    skin: { ramp: ramp(["#0a0e14", "#1e2a36", "#344656", "#4e6474", "#6c8494", "#90a8b6", "#b8ccd8"], 7), dither: 0.45, amb: 0.32 },
    hair: { ramp: ramp(["#060a12", "#122030", "#20344c", "#304c68", "#466a86", "#6a90aa"], 6), spec: 0.8, pow: 22, specCol: "#c4e0f0", dither: 0.5 },
    hole: { ramp: ["#000000", "#02040a"], amb: 0, dif: 0.05, noRim: true },
    ice: { ramp: ["#1e4c7a", "#4686bc", "#94c8ec", "#e4f6ff"], spec: 1.4, pow: 40, specCol: "#ffffff", dither: 0.4 },
    glow: { ramp: [AURORA.green[2], AURORA.green[3], AURORA.green[4], "#d0fbe6"], noRim: true, emit: p => 0.4 + 0.55 * Math.max(0, p.nz) },
  };
  const head = ellipsoid([48, 24, 4], [5, 6.2, 5], "skin");
  const neck = tube([[48, 29, 3, 2], [48, 33, 2, 2.3]], "skin");
  const torso = Disp(U(2, ellipsoid([48, 40, 1], [8, 7, 5.4], "gown"), ellipsoid([48, 50, 0], [6.4, 6, 4.6], "gown")), (x, y, z) => 0.1 * fbm(x, y, z));
  const skirt = Disp(cone([48, 50, 0], [48, 92, -2], 7, 20, "gown"), (x, y, z) => 0.9 * Math.sin(Math.atan2(z, x - 48) * 7 + y * 0.08) * Math.max(0, (y - 54) / 30));
  const armL = tube([[41, 37, 2, 2.2], [38, 46, 6, 1.9], [45, 50, 9, 1.6]], "skin", { seg: 3 });
  const armR = tube([[55, 37, 2, 2.2], [58, 46, 6, 1.9], [51, 50, 9, 1.6]], "skin", { seg: 3 });
  const hands = [ellipsoid([46, 50, 10], [2, 2, 1.6], "skin"), ellipsoid([50, 50, 10], [2, 2, 1.6], "skin")];
  const light = sphere([48, 51, 13], 2.2, "glow");
  // 後ろへ流れる髪の房と氷の髪飾り
  const hair = [ellipsoid([48, 21, 1], [6, 6, 5.6], "hair")];
  const R = rand(9501);
  for (let i = 0; i < 8; i++) { const y0 = 20 + i * 2, L = 18 + R() * 12, s = i % 2 ? 1 : -1; hair.push(tube([[50, y0, -1, 2.4], [56 + L * 0.4, y0 + 2 + R() * 4, -4, 1.8], [56 + L, y0 + 8 + R() * 10, -6, 0.5]], "hair", { seg: 3 })); }
  const tiara = []; for (let i = 0; i < 5; i++) { const x = 44 + i * 2, h = i === 2 ? 6 : i % 2 ? 4 : 3; tiara.push(cone([x, 19, 5], [x, 19 - h, 4], 0.9, 0.2, "ice")); }
  const cut = U(0, ellipsoid([46, 23, 8.6], [1.6, 0.4, 0.8], "hole"), ellipsoid([50, 23, 8.6], [1.6, 0.4, 0.8], "hole"), ellipsoid([48, 27.6, 8.4], [1.2, 1.6, 1], "hole"));
  const scene = U(0, Sub(U(1, head, neck), cut, 0.2), ...hair, ...tiara, U(1.4, torso, skirt), armL, armR, ...hands, light);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [48, 52, 18], r: 22, k: 0.45 }] });
  const C = new Canvas(r);
  // 歌声の波の輪 (心を奪う)
  const W = [AURORA.violet[1], AURORA.violet[2], AURORA.violet[3]];
  for (let k = 1; k <= 3; k++) { const rr = 8 + k * 6; for (let a = -0.9; a <= 0.9; a += 0.03) for (const side of [-1, 1]) { const X = Math.round(48 + side * Math.cos(a) * rr), Y = Math.round(27 + Math.sin(a) * rr * 0.8); if (!C.get(X, Y)) C.set(X, Y, W[Math.max(0, 3 - k - (Math.abs(a) > 0.55 ? 1 : 0))]); } }
  // 手からこぼれる癒しの光の雪
  for (let i = 0; i < 16; i++) { const x = 44 + R() * 10, y = 54 + R() * 22; if (!C.get(Math.round(x), Math.round(y)) || C.pix[Math.round(y) * 96 + Math.round(x)]?.m === "gown") C.set(x, y, AURORA.green[2 + Math.floor(R() * 3)]); }
  dissolve(C, 64, 94, { seed: 9, darken: mats.gown.ramp });
  snowfall(C, 9503, 40);
  return C.toArt();
}
