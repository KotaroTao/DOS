import { sphere, ellipsoid, cone, tube, box, cyl, torus, U, Sub, Disp, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { humanoid, fingers } from "../human.mjs";
import { SAND, BLOOD, ASHBED, BRASS, RIM, GHOST, SOULS, sandFloor, ashfall, shoutWaves, dissolve, puffs, sandDust } from "../arena.mjs";
export const meta = { id: "bs_beastmaster", key: "hd_beastmaster", w: 96, h: 96,
  note: "猛獣使いの亡霊: つば広の帽子に長い外套、腰に鍵束を下げた猛獣使いの霊。腰から下は砂煙にほどけ、砂の上へは決して降りてこない。右手の長い鞭を大きくしならせて鳴らし、檻の闘犬を呼び出す (招来) — 鞭の先で空気が弾ける。左手の指をくわえて鋭い口笛を吹き、闘技場の魔物たちをあおる (鼓舞・多用)" };
export function build() {
  const mats = {
    ghost: { ramp: GHOST, dither: 0.6, amb: 0.28 },
    coat: { ramp: ["#050305", "#0e080c", "#1a1016", "#281a22", "#38262f"], dither: 0.6, amb: 0.24 },
    whip: { ramp: ["#040201", "#120a05", "#24160b", "#382412"], dither: 0.4, spec: 0.6, pow: 16 },
    brass: BRASS,
    hole: { ramp: ["#000000", "#010102"], amb: 0, dif: 0.05, noRim: true },
    eye: { ramp: [SOULS[2], SOULS[3], SOULS[4]], emit: () => 0.95 },
    sand: SAND, blood: BLOOD, ashbed: ASHBED,
  };
  const J = { head: [48, 28, 2], neck: [48, 34, 1], chest: [48, 43, 0], waist: [48, 54, 0], hip: [48, 60, 0],
    shL: [40, 39, 4], elL: [34, 46, 8], haL: [44, 33, 10], shR: [56, 39, -2], elR: [66, 34, 2], haR: [74, 24, 4] };
  const body = humanoid(J, { skin: "coat", head: "ghost" }, { w: { headX: 4.4, headY: 5.2, chestX: 8.4, chestY: 7.6, chestZ: 6, waistX: 7, hipX: 8, arm: 2.6, arm2: 2.2, wrist: 1.6 } });
  const coat = Disp(cone([48, 76, 0], [48, 48, 0], 14, 8, "coat"), (x, y, z) => 0.6 * Math.abs(Math.sin(x * 0.7 + y * 0.1)) + 0.4 * fbm(x * 0.3, y * 0.3));
  const hat = U(0.6, Disp(ellipsoid([48, 23, 1], [12, 1.6, 10], "coat", -6), (x, y, z) => Math.max(0, Math.abs(x - 48) - 7) * 0.18), ellipsoid([48, 20, 0], [5.6, 4, 5.4], "coat"), torus([48, 22, 0], 5.6, 0.7, "brass", 0, 10));
  const face = ellipsoid([47, 30, 4.4], [3.6, 4.2, 3], "ghost");
  const sockets = U(0, ellipsoid([45.6, 29, 7], [1, 0.9, 0.8], "hole"), ellipsoid([48.6, 29, 7], [1, 0.9, 0.8], "hole"));
  const eyes = [sphere([45.6, 29, 6.6], 0.6, "eye"), sphere([48.6, 29, 6.6], 0.6, "eye")];
  // 口笛の指
  const whistle = fingers([44, 33, 10], 200, "ghost", { n: 2, len: 3.4, spread: 8, r: 0.6, curl: 0.4 });
  // 腰の鍵束
  const keys = [torus([56, 56, 6], 2.4, 0.5, "brass"), cone([56, 58, 7], [55, 64, 8], 0.5, 0.4, "brass"), cone([57, 58, 7], [59, 63, 8], 0.5, 0.4, "brass"), cone([55, 58, 7], [53, 62, 8], 0.5, 0.4, "brass")];
  const belt = torus([48, 54, 0], 7.4, 1, "whip", 0, 10);
  const grip = cyl([74, 24, 4], [78, 18, 4], 1, "whip");
  const scene = U(0, sandFloor(48, 95, 40, 12, { seed: 11801, ash: 0.12, flags: 0 }), Sub(U(1.4, body, coat), sockets, 0.2), Sub(face, sockets, 0.2), hat, ...eyes, ...whistle, ...keys, belt, grip);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  // 腰から下を砂煙にほどく
  for (let y = 64; y < 90; y++) for (let x = 20; x < 76; x++) { const p = C.pix[y * 96 + x]; if (p && (p.m === "coat") && (y - 64) / 18 + 0.4 * fbm(x * 0.3, y * 0.2, 6) > 0.4 + ((x * 7 + y * 3) % 5) * 0.08) C.px[y * 96 + x] = null; }
  puffs(C, [[48, 78, 9], [40, 84, 7], [57, 84, 7], [48, 88, 6]], ["#14100b", "#1f1912", "#2b2318", "#382e20"], { dens: 0.75, seed: 4 });
  // しなる鞭 (右手から頭上を回って左へ) と、先で弾ける空気
  const W = ["#120a05", "#24160b", "#382412", "#4e341c"];
  let px = 78, py = 18;
  for (let t = 0; t <= 1; t += 0.004) {
    const x = 78 - t * 74 + Math.sin(t * Math.PI * 1.6) * 6, y = 18 - Math.sin(t * Math.PI) * 16 + t * t * 10 + Math.sin(t * 9) * 3;
    if (!C.get(Math.round(x), Math.round(y))) C.set(x, y, W[t < 0.3 ? 3 : t < 0.7 ? 2 : 1]);
    if (t < 0.25 && !C.get(Math.round(x), Math.round(y + 1))) C.set(x, y + 1, W[1]);
    px = x; py = y;
  }
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) { for (let k = 2; k < 5; k++) { const X = Math.round(px + Math.cos(a) * k), Y = Math.round(py + Math.sin(a) * k); if (!C.get(X, Y)) C.set(X, Y, k === 2 ? "#fff0b0" : k === 3 ? "#d4a050" : "#6a4a20"); } }
  // 口笛の鋭い音
  shoutWaves(C, 42, 32, Math.PI * 1.05, { n: 3, gap: 4, spread: 0.35, r0: 5, cols: ["#3a2e1a", "#6a5430", "#a88a48"] });
  sandDust(C, 11803, 26, [24, 80, 50, 12]);
  ashfall(C, 11805, 50);
  return C.toArt();
}
