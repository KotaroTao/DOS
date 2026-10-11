import { sphere, ellipsoid, cone, tube, box, U, Sub, Disp, render, Canvas, fbm, rand } from "../sdf.mjs";
import { BED, ROCK, GLASS, FRAME, MURKGLASS, RIM, cavernFloor, stalagmite, cracks, soot, shards, murkMotes } from "../cavern.mjs";
export const meta = { id: "bs_earthshaker", key: "hd_earthshaker", w: 96, h: 96,
  note: "地揺らす巨体: 背に石筍の生えた岩山を負い、亀のように身をかがめた四つんばいの巨人。土色の肌の太い四肢で床を踏み鳴らすたびに大空洞が揺れ、足元の地割れと天井から落ちる石が隊の全員を打つ (全体呪文・多用)。岩山の甲羅は刃を半ば阻む (物理抵抗50)。小さな頭を甲羅の下から突き出し、足元には踏みつぶされたガラスの砂" };
export function build() {
  const mats = {
    skin: { ramp: ["#060403", "#130d09", "#22180f", "#332417", "#463220", "#5a422b", "#6e5236"], dither: 0.5, amb: 0.24,
      shade: p => 0.08 * fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5) },
    eye: { ramp: ["#3a2a06", "#b08a2a", "#ffe08a"], emit: () => 0.9 },
    crack: { ramp: ["#000000", "#050302"], amb: 0.02, dif: 0.05, noRim: true },
    bed: BED, rock: ROCK, glass: GLASS, frame: FRAME, murk: MURKGLASS,
  };
  // 背の岩山
  const mountain = Disp(U(5, ellipsoid([54, 46, -2], [32, 20, 18], "rock"), ellipsoid([44, 32, -4], [16, 14, 12], "rock"), ellipsoid([66, 34, -4], [12, 12, 10], "rock")), (x, y, z) => cracks(1.4, 0.18)(x, y, z) + 1.2 * fbm(x * 0.14, y * 0.14, z * 0.14));
  const mites = [stalagmite(40, 22, 0, 16, 3), stalagmite(50, 20, -4, 12, 2.6), stalagmite(66, 24, -2, 14, 3), stalagmite(30, 32, 2, 9, 2.2), stalagmite(78, 34, -2, 8, 2)];
  // 四肢 (床を踏みしめる太い腕と脚)
  const limbs = [tube([[30, 56, 10, 8], [18, 72, 14, 6.4], [16, 90, 14, 6]], "skin"), tube([[36, 58, -8, 7], [28, 74, -10, 5.6], [28, 90, -10, 5.4]], "skin"),
    tube([[74, 58, 10, 8], [84, 74, 12, 6.4], [80, 90, 12, 6]], "skin"), tube([[70, 58, -8, 7], [78, 74, -10, 5.6], [76, 90, -10, 5.4]], "skin")];
  const hands = [ellipsoid([14, 91, 15], [8, 3.4, 6], "skin"), ellipsoid([82, 91, 13], [8, 3.4, 6], "skin")];
  const fingersL = [0, 1, 2, 3].map(k => ellipsoid([7 + k * 3.4, 92, 19], [1.6, 2, 1.8], "skin"));
  // 甲羅の下から突き出す小さな頭
  const head = U(2, tube([[30, 56, 8, 6.4], [18, 54, 14, 5.4]], "skin"), ellipsoid([12, 54, 16], [7.4, 6.4, 6.4], "skin"), ellipsoid([6, 58, 18], [4.4, 3, 4], "skin", 20));
  const brow = ellipsoid([12, 49.6, 19], [6, 1.6, 3], "skin", -6);
  const eyes = [sphere([8, 52, 21.6], 1, "eye"), sphere([14, 51.6, 21.6], 1, "eye")];
  // 地割れ
  const rift = U(0, ...[[20, 30], [40, 52], [60, 74]].map(([a, b]) => box([(a + b) / 2, 96, 6], [(b - a) / 2, 1, 1.6], "crack", 0, (a % 7) - 3)));
  const scene = U(0, Sub(cavernFloor(48, 95, 47, 13, { seed: 13601, rocks: 4, lamps: 1 }), rift, 0.3), U(2, ...limbs, ...hands, ...fingersL, head, brow), mountain, ...mites, ...eyes);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  // 踏み鳴らしの揺れ (足元の弧) と落ちてくる石
  for (const [cx, cy] of [[14, 88], [82, 88]]) for (const rr of [11, 15]) for (let a = Math.PI; a < Math.PI * 2; a += 0.5 / rr) { const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * 0.45; if (!C.get(Math.round(x), Math.round(y)) && Math.sin(a * 16) > -0.3) C.set(x, y, rr < 12 ? "#5a422b" : "#332417"); }
  const R = rand(13603);
  for (let k = 0; k < 9; k++) { const x = Math.round(6 + R() * 84), y = Math.round(2 + R() * 18); if (C.get(x, y)) continue; C.set(x, y, "#50463d"); C.set(x + 1, y, "#2f2823"); C.set(x, y - 1, "#161210"); }
  murkMotes(C, 13605, 10, [10, 10, 76, 30]);
  shards(C, 13607, ["bed"], 26);
  soot(C, 13609, 30);
  return C.toArt();
}
