import { sphere, ellipsoid, cone, tube, cyl, torus, U, Sub, Disp, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { fingers } from "../human.mjs";
import { STAIR, PUDDLE, TOWER, RIM, BOLT, SOULS, towerFloor, bolt2d, sparks, rain, clouds, dissolve } from "../storm.mjs";
export const meta = { id: "bs_stormhag", key: "hd_stormhag", w: 96, h: 96,
  note: "嵐呼びの魔女: ぼろぼろの頭巾をかぶった、腰の曲がった老婆の霊。骨の風鈴を吊るした杖をつき、もう片手には雨水を受ける欠けた椀。風鈴を鳴らしてしわがれ声で呪うと、聞いた者の手足から力が抜ける (弱体・多用)。椀にためた雨水を振りまいて、塔の魔物たちの傷を洗い繕う (治癒役)。裾は雨の霧にほどけている" };
export function build() {
  const mats = {
    robe: { ramp: ramp(["#030305", "#08080d", "#101017", "#181822", "#22222e", "#2e2e3c", "#3c3c4c"], 7), dither: 0.65, amb: 0.24,
      shade: p => 0.12 * Math.sin(p.x * 1.4 + 2 * fbm(p.x * 0.2, p.y * 0.2)) },
    skin: { ramp: ramp(["#0a0908", "#1c1a16", "#302c26", "#48423a", "#625a50", "#80766a"], 6), dither: 0.45, amb: 0.3 },
    hair: { ramp: ramp(["#141418", "#2a2a32", "#44444e", "#62626e", "#84848e"], 5), dither: 0.5 },
    wood: { ramp: ramp(["#060403", "#120d08", "#20180e", "#2e2416", "#3e321e"], 5), dither: 0.5 },
    bone: { ramp: ramp(["#14120c", "#3a3628", "#6a6450", "#a29a80", "#d0c8ac"], 5), spec: 0.6, pow: 20, dither: 0.4 },
    bowl: { ramp: ramp(["#0a0806", "#1e1a14", "#3a3226", "#5e523e"], 4), spec: 0.6, pow: 20 },
    water: { ramp: [SOULS[1], SOULS[2], SOULS[3]], noRim: true, emit: p => 0.4 + 0.5 * Math.max(0, -p.ny) },
    hole: { ramp: ["#000000", "#020203"], amb: 0, dif: 0.05, noRim: true },
    eye: { ramp: [BOLT[2], BOLT[3], BOLT[4]], emit: () => 0.95 },
    stair: STAIR, puddle: PUDDLE, tower: TOWER,
  };
  // 腰の曲がった体: 頭は前へ突き出る
  const robe = Disp(U(4, ellipsoid([50, 58, 0], [14, 18, 11], "robe", 10), ellipsoid([46, 40, 2], [11, 9, 9], "robe", -20), ellipsoid([52, 76, -2], [16, 12, 10], "robe")), (x, y, z) => 0.7 * fbm(x * 0.3, y * 0.3, z * 0.3) + 0.5 * Math.abs(Math.sin(x * 0.9 + y * 0.2)) * (y > 62 ? 1 : 0));
  const hood = Disp(U(1.5, ellipsoid([36, 32, 4], [9, 9, 8], "robe", -20), cone([40, 26, 0], [48, 18, -6], 5, 1, "robe")), (x, y, z) => 0.5 * fbm(x * 0.4, y * 0.4));
  const hoodHole = ellipsoid([33, 34, 11], [6, 7, 5], "hole", -15);
  const face = ellipsoid([33, 35, 7.4], [4.6, 5.4, 4], "skin", -15);
  const nose = cone([31, 34, 11], [27, 37, 12], 1.2, 0.4, "skin");
  const hair = [tube([[30, 30, 9, 1.2], [26, 40, 10, 0.8], [25, 48, 9, 0.4]], "hair"), tube([[36, 30, 10, 1.2], [37, 42, 11, 0.8], [36, 50, 10, 0.4]], "hair")];
  // 杖を握る右腕 (画面左) と、椀を掲げる左腕 (画面右)
  const armR = tube([[38, 44, 6, 2.6], [28, 52, 10, 2.2], [20, 50, 12, 1.6]], "robe");
  const handR = U(0.6, ellipsoid([19, 50, 13], [2, 2.2, 2], "skin"), ...fingers([19, 50, 13], 90, "skin", { n: 3, len: 4, spread: 30, r: 0.6, curl: 0.5 }));
  const staff = cyl([20, 14, 12], [18, 92, 12], 1.2, "wood", 0.4);
  const staffTop = U(0.6, torus([20, 12, 12], 3, 0.8, "wood", 0, 90), cone([20, 14, 12], [24, 8, 12], 0.8, 0.2, "wood"));
  const chimes = [];
  for (const [dx, l] of [[-3, 8], [0, 11], [3, 7], [5, 9]]) { chimes.push(tube([[20 + dx * 0.6, 14, 12, 0.3], [20 + dx, 14 + l, 12, 0.3]], "bone"), ellipsoid([20 + dx, 15 + l, 12], [0.9, 2, 0.9], "bone")); }
  const armL = tube([[58, 44, 4, 2.6], [68, 40, 8, 2.2], [74, 32, 10, 1.6]], "robe");
  const bowl = Sub(ellipsoid([76, 28, 10], [7, 3.6, 6], "bowl"), ellipsoid([76, 25.6, 10], [6, 2.6, 5], "bowl"), 0.4);
  const water = ellipsoid([76, 26.6, 10], [5.4, 0.8, 4.4], "water");
  const eyes = [sphere([31, 34, 11.2], 0.7, "eye"), sphere([35.4, 33.4, 10.8], 0.7, "eye")];
  const scene = U(0, towerFloor(50, 95, 38, 12, { n: 1, seed: 10801, wet: 0.35 }), Sub(U(2, robe, hood, armR, armL), hoodHole, 0.6), face, nose, ...hair, handR, staff, staffTop, ...chimes, bowl, water, ...eyes);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [76, 24, 18], r: 18, k: 0.4 }, { p: [33, 34, 22], r: 10, k: 0.2 }] });
  const C = new Canvas(r);
  dissolve(C, 78, 92, { seed: 5, x0: 34, x1: 70, darken: mats.robe.ramp });
  // 椀から振りまかれる雨水の滴
  const R = rand(10803);
  for (let i = 0; i < 18; i++) { const a = -2.2 + R() * 1.6, d = 6 + R() * 14, x = 76 + Math.cos(a) * d, y = 24 + Math.sin(a) * d * 0.8; if (!C.get(Math.round(x), Math.round(y))) C.set(x, y, SOULS[R() < 0.3 ? 4 : 3]); }
  // 風鈴のまわりの呪いの響き
  for (const [r0, c] of [[7, BOLT[2]], [11, BOLT[1]]]) for (let a = 0; a < Math.PI * 2; a += 0.08) { const x = 20 + Math.cos(a) * r0, y = 20 + Math.sin(a) * r0; if (!C.get(Math.round(x), Math.round(y)) && Math.sin(a * 8) > 0.3) C.set(x, y, c); }
  clouds(C, [[60, 8, 22, 6]], { dens: 0.7, seed: 8 });
  bolt2d(C, 52, 10, 44, 0, { seed: 4, jag: 1.6, branch: 0 });
  rain(C, 10805, 50);
  sparks(C, 10807, 6, [2, 2, 92, 50], SOULS);
  return C.toArt();
}
