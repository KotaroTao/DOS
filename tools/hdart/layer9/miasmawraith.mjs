import { sphere, ellipsoid, cone, tube, torus, U, Sub, Disp, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { fingers } from "../human.mjs";
import { MUD, POOL, ROTWOOD, RIM, ROT, MIASMA, bogFloor, scum, motes, dissolve, afterimage, puffs } from "../swamp.mjs";
export const meta = { id: "bs_miasmawraith", key: "hd_miasmawraith", w: 96, h: 96,
  note: "瘴気の霊: 沼から立ちのぼる瘴気が、腐った魂を核にして人の上半身の形をとったもの。黄緑の霧の体、ぽっかり空いた眼と口、胸の奥に濁った光の核。両腕を広げて頭上に崩れかけた呪の輪を回し、毒の呪いを隊全体へ降らせる (全体呪文・多用)。輪郭はゆらいでぶれ、刃は霧をすり抜ける (回避)" };
export function build() {
  const mats = {
    fog: { ramp: ramp(["#020302", "#060b06", "#0c140b", "#142010", "#1d2e16", "#283e1c", "#344f23", "#44642c"], 8), dither: 0.8, amb: 0.3,
      shade: p => 0.12 * Math.sin(p.y * 0.6 + p.x * 0.3 + 2 * fbm(p.x * 0.2, p.y * 0.15)) },
    hole: { ramp: ["#000000", "#010201", "#030602"], amb: 0, dif: 0.05, noRim: true },
    core: { ramp: ROT, noRim: true, emit: p => 0.4 + 0.55 * Math.max(0, p.nz) },
    eye: { ramp: [ROT[2], ROT[4], ROT[5]], emit: () => 0.8 },
    mud: MUD, pool: POOL, rotwood: ROTWOOD,
  };
  const torso = Disp(U(3, ellipsoid([48, 50, 0], [12, 12, 8], "fog"), ellipsoid([49, 66, 0], [8, 12, 7], "fog", 6), ellipsoid([51, 80, 0], [5, 9, 5], "fog", 10)), (x, y, z) => 1.4 * fbm(x * 0.22, y * 0.12, z * 0.22) + 0.6 * Math.abs(Math.sin(x * 0.9 + y * 0.2)));
  const head = ellipsoid([48, 31, 3], [6.4, 8.4, 6.4], "fog");
  const hood = Disp(U(2, ellipsoid([48, 30, 0], [10, 11, 9], "fog"), cone([48, 24, -2], [52, 10, -6], 6, 0.6, "fog")), (x, y, z) => 1 * fbm(x * 0.3, y * 0.3, z * 0.3));
  const holes = U(0, ellipsoid([45, 30, 9], [2, 2.8, 1.8], "hole", -10), ellipsoid([51, 30, 9], [2, 2.8, 1.8], "hole", 10), ellipsoid([48, 37, 8.8], [2.2, 3.6, 1.8], "hole"));
  const arms = [Disp(tube([[38, 46, 2, 3.4], [26, 40, 6, 2.4], [16, 28, 8, 1.6]], "fog", { seg: 3 }), (x, y, z) => 0.6 * fbm(x * 0.4, y * 0.4)), Disp(tube([[58, 46, 2, 3.4], [70, 40, 6, 2.4], [80, 28, 8, 1.6]], "fog", { seg: 3 }), (x, y, z) => 0.6 * fbm(x * 0.4, y * 0.4))];
  const hands = [...fingers([15, 27, 8], -120, "fog", { n: 4, len: 9, spread: 40, r: 0.7, curl: 0.5 }), ...fingers([81, 27, 8], -60, "fog", { n: 4, len: 9, spread: 40, r: 0.7, curl: -0.5 })];
  const core = sphere([48, 54, 7], 3.6, "core");
  const eyes = [sphere([45, 29.4, 8.8], 0.7, "eye"), sphere([51, 29.4, 8.8], 0.7, "eye")];
  const ghost = Sub(U(2, torso, head, hood, ...arms, ...hands), U(0, holes, sphere([48, 54, 9], 3, "hole")), 0.3);
  const scene = U(0, bogFloor(48, 94, 40, 12, { n: 1, seed: 10101, wet: 0.4, logs: 1 }), ghost, core, ...eyes);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [48, 54, 18], r: 18, k: 0.4 }, { p: [48, 10, 10], r: 26, k: 0.25 }] });
  const C = new Canvas(r);
  dissolve(C, 62, 90, { seed: 3, x0: 30, x1: 66, darken: mats.fog.ramp });
  // 頭上の崩れかけた呪の輪
  for (let a = 0; a < Math.PI * 2; a += 0.04) {
    const x = 48 + Math.cos(a) * 22, y = 10 + Math.sin(a) * 5;
    if (C.get(Math.round(x), Math.round(y))) continue;
    if (Math.sin(a * 7) > -0.3) C.set(x, y, Math.sin(a * 3) > 0 ? ROT[3] : ROT[2]);
    if (Math.sin(a * 13) > 0.6) C.set(x, y - 1, ROT[4]);
  }
  // 輪から降る毒の雫
  const R = rand(10103);
  for (let i = 0; i < 26; i++) { const x = 28 + R() * 40, y = 16 + R() * 20; if (!C.get(Math.round(x), Math.round(y))) { C.set(x, y, ROT[2]); if (!C.get(Math.round(x), Math.round(y) + 1)) C.set(x, y + 1, ROT[1]); } }
  afterimage(C, [[5, 1, 0.4, "#0f1c0f"], [-5, 1, 0.3, "#0f1c0f"]], [0, 18, 96, 60]);
  puffs(C, [[40, 92, 6], [56, 92, 6], [48, 88, 5]], MIASMA, { dens: 0.9, seed: 5, own: ["mud", "pool"] });
  scum(C, 10105);
  motes(C, 10107, 20, [2, 2, 92, 70], true);
  return C.toArt();
}
