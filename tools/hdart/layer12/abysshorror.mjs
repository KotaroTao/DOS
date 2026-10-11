import { sphere, ellipsoid, cone, tube, box, U, Sub, Disp, render, Canvas, fbm, rand, vnoise } from "../sdf.mjs";
import { BED, ROCK, GLASS, FRAME, MURKGLASS, GLOOM, MURK, RIM, cavernFloor, soot, murkMotes, puffs } from "../cavern.mjs";
export const meta = { id: "bs_abysshorror", key: "hd_abysshorror", w: 96, h: 96,
  note: "深淵の異形: 床に開いた暗い溜まりからにじみ出る、いくつもの濁った魂が溶け合った黒紫の霊の塊。盛り上がった塊の表面に、顔とも手ともつかないものがいくつも浮かんでは沈み、顔の目と口に濁った琥珀の微光。塊から伸びる何本もの手が隊へ這い寄り、触れて命を吸う (吸命・多用)。溶け合った体は刃を半ば呑みこむ (物理抵抗50)。床の溜まりごと描く (揺らさない)" };
export function build() {
  const mats = {
    ooze: { ramp: GLOOM, dither: 0.6, amb: 0.26, spec: 0.8, pow: 30, specCol: "#7a6a90",
      shade: p => 0.12 * fbm(p.x * 0.25, p.y * 0.25, p.z * 0.25) },
    pool: { ramp: ["#000000", "#030106", "#08040e", "#0e0818"], spec: 1.4, pow: 60, specCol: "#3a2e50", dither: 0.6, amb: 0.4, dif: 0.3, noRim: true },
    hole: { ramp: ["#000000", "#020104"], amb: 0.02, dif: 0.05, noRim: true },
    glow: { ramp: MURK.slice(2, 6), emit: () => 0.8 },
    bed: BED, rock: ROCK, glass: GLASS, frame: FRAME, murk: MURKGLASS,
  };
  const pool = Disp(ellipsoid([48, 92, 0], [40, 2.6, 14], "pool"), (x, y, z) => 0.3 * fbm(x * 0.2, z * 0.3));
  const blob = Disp(U(6, ellipsoid([48, 72, 0], [26, 20, 14], "ooze"), ellipsoid([40, 52, 2], [15, 14, 12], "ooze"), ellipsoid([60, 56, 0], [12, 12, 10], "ooze"), ellipsoid([49, 38, 0], [9, 10, 8], "ooze")),
    (x, y, z) => 1.4 * fbm(x * 0.12, y * 0.12, z * 0.12) + 0.6 * Math.sin(y * 0.5 + x * 0.1));
  // 浮かぶ顔 [x, y, z, 大きさ]
  const faces = [[42, 50, 14, 5.4], [61, 56, 11, 4.4], [49, 37, 8, 4], [34, 72, 15, 4.6], [58, 76, 14, 5], [71, 67, 10, 3.6]];
  const masks = faces.map(([x, y, z, s]) => ellipsoid([x, y, z - s * 0.4], [s * 1.1, s * 1.35, s * 0.8], "ooze"));
  const holes = [];
  for (const [x, y, z, s] of faces) holes.push(ellipsoid([x - s * 0.42, y - s * 0.2, z + s * 0.25], [s * 0.24, s * 0.3, s * 0.5], "hole"), ellipsoid([x + s * 0.42, y - s * 0.2, z + s * 0.25], [s * 0.24, s * 0.3, s * 0.5], "hole"), ellipsoid([x, y + s * 0.62, z + s * 0.25], [s * 0.3, s * 0.36, s * 0.5], "hole"));
  // 這い寄る手
  const arms = [];
  for (const [ax, ay, bx, by, z] of [[28, 78, 6, 88, 10], [32, 64, 10, 56, 12], [66, 80, 88, 88, 8], [68, 58, 86, 48, 6], [44, 84, 30, 92, 16]]) {
    arms.push(tube([[ax, ay, z, 4], [(ax + bx) / 2, (ay + by) / 2 - 2, z + 2, 2.6], [bx, by, z + 2, 1.6]], "ooze", { seg: 3 }));
    for (let k = 0; k < 4; k++) { const a = Math.atan2(by - ay, bx - ax) + (k - 1.5) * 0.4; arms.push(cone([bx, by, z + 2], [bx + Math.cos(a) * 4, by + Math.sin(a) * 4, z + 2], 0.8, 0.3, "ooze")); }
  }
  const scene = U(0, cavernFloor(48, 96, 47, 13, { seed: 13501, rocks: 2, lamps: 2 }), pool, Sub(U(1.6, blob, ...masks, ...arms), U(0, ...holes), 0.3));
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  // 目と口の微光
  for (const [x, y, z, s] of faces) for (const [dx, dy] of [[-s * 0.42, -s * 0.2], [s * 0.42, -s * 0.2], [0, s * 0.62]]) { const X = Math.round(x + dx), Y = Math.round(y + dy); const p = C.pix[Y * 96 + X]; if (p && p.m === "hole") C.set(X, Y, MURK[s > 4 ? 4 : 3]); }
  // 溜まりから立ちのぼる闇
  puffs(C, [[48, 84, 30], [30, 70, 14], [66, 64, 14]], GLOOM.slice(0, 3), { dens: 0.6, seed: 13503 });
  murkMotes(C, 13505, 14, [6, 10, 84, 40]);
  soot(C, 13507, 30);
  return C.toArt();
}
