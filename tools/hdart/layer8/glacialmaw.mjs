import { sphere, ellipsoid, cone, tube, box, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { SHELF, SNOW, ICE, RIM, SOUL, FROST, iceFloor, iceCracks, hoarfrost, icicles, glints, snowfall, puffs } from "../ice.mjs";
export const meta = { id: "el_glacialmaw", key: "hd_glacialmaw", w: 112, h: 128,
  note: "氷河の大顎 (名のある強敵): 氷棚の裂け目から突き出した、白い竜の巨大な頭。両側の氷の壁を割って鼻先を持ち上げ、上下の顎を大きく開く。口の縁には氷柱そのものの牙が何列も並び、噛み砕いた氷と獲物の鎧のかけらが喉の奥に見える (痛撃・多用)。顎を覆う鱗は分厚い氷塊で、刃をほとんど通さない。額には小さな眼が六つ、青白く並ぶ" };
export function build() {
  const W = 112, H = 128;
  const mats = {
    scale: { ramp: ramp(["#020306", "#060c14", "#0e1824", "#182636", "#24384c", "#344e66", "#4a6a84", "#6890a8", "#90b4c8"], 9), spec: 1.4, pow: 34, specCol: "#e4f4fc", dither: 0.45,
      shade: p => 0.08 * fbm(p.x * 0.3, p.y * 0.3, p.z * 0.3) },
    gum: { ramp: ramp(["#06030a", "#140a18", "#24122a", "#361c3c"], 4), dither: 0.5 },
    throat: { ramp: ["#000000", "#02030a", "#060a18"], amb: 0, dif: 0.1, noRim: true },
    tooth: { ramp: ramp(["#152a44", "#3e6684", "#7aa0bc", "#b4d0e2", "#e6f4ff"], 5), spec: 1.6, pow: 40, specCol: "#ffffff", dither: 0.35, amb: 0.3 },
    eye: { ramp: [SOUL[1], SOUL[2], SOUL[3]], emit: () => 0.8 },
    iron: { ramp: ramp(["#060606", "#1a1a1e", "#34343a", "#56565e"], 4), spec: 1, pow: 26, dither: 0.4 },
    ice: ICE, shelf: SHELF, snow: SNOW,
  };
  // 両側の裂け目の氷の壁
  const walls = Disp(U(2, box([4, 76, -16], [9, 54, 14], "ice", 2, 6), box([108, 76, -16], [9, 54, 14], "ice", 2, -6)), iceCracks(1.2, 0.22));
  // 上顎: 額から鼻先へ、手前に突き出す
  const upper = Disp(U(3, ellipsoid([56, 30, -4], [30, 18, 20], "scale"), ellipsoid([56, 40, 14], [24, 10, 16], "scale"), ellipsoid([56, 44, 28], [18, 6, 8], "scale")), iceCracks(0.9, 0.22));
  // 下顎: 大きく開いて下へ
  const lower = Disp(U(3, ellipsoid([56, 100, 0], [28, 14, 18], "scale"), ellipsoid([56, 92, 18], [22, 8, 14], "scale"), ellipsoid([56, 90, 28], [16, 5, 7], "scale")), iceCracks(0.9, 0.22));
  // 口の中: 歯茎の縁と暗い喉
  const mouth = ellipsoid([56, 67, 20], [22, 19, 14], "throat");
  const gums = U(1, ellipsoid([56, 49, 22], [21, 4, 11], "gum"), ellipsoid([56, 86, 22], [19, 4, 10], "gum"));
  // 氷柱の牙 (上下)
  const R = rand(10301), teeth = [];
  for (let i = 0; i < 9; i++) { const t = i / 8, x = 38 + t * 36, z = 30 - Math.abs(t - 0.5) * 18, l = 8 + R() * 8 - Math.abs(t - 0.5) * 6; teeth.push(cone([x, 49, z], [x + (t - 0.5) * 3, 49 + l, z + 1], 2.2, 0.2, "tooth")); }
  for (let i = 0; i < 8; i++) { const t = i / 7, x = 40 + t * 32, z = 28 - Math.abs(t - 0.5) * 16, l = 6 + R() * 7 - Math.abs(t - 0.5) * 5; teeth.push(cone([x, 86, z], [x + (t - 0.5) * 3, 86 - l, z + 1], 2, 0.2, "tooth")); }
  // 喉の奥の鎧のかけら
  const debris = [box([48, 72, 10], [3, 2, 1], "iron", 0.4, 30), box([62, 76, 9], [2.4, 1.6, 1], "iron", 0.4, -20)];
  // 額の六つの眼と、後ろへ反る角
  const eyes = []; for (let i = 0; i < 3; i++) for (const s of [-1, 1]) eyes.push(sphere([56 + s * (8 + i * 6), 24 + i * 2, 15.6 - i * 2.6], 1.7 - i * 0.2, "eye"));
  const horns = [tube([[38, 18, -4, 4], [26, 8, -10, 3], [16, 4, -14, 1]], "scale"), tube([[74, 18, -4, 4], [86, 8, -10, 3], [96, 4, -14, 1]], "scale")];
  // 顎のつけ根の頬と、裂け目から伸びる太い首
  const cheeks = U(3, ellipsoid([30, 66, 2], [9, 24, 14], "scale"), ellipsoid([82, 66, 2], [9, 24, 14], "scale"));
  const neck = Disp(cone([56, 124, -14], [56, 64, -6], 30, 24, "scale"), iceCracks(0.8, 0.25));
  const jaw = Sub(U(3, upper, lower, cheeks, neck), mouth, 1.5);
  const scene = U(0, iceFloor(56, 124, 54, 16, { n: 4, seed: 10303, snow: 0.05, shards: 3 }), walls, jaw, gums, ...teeth, ...debris, ...eyes, ...horns);
  const r = render(scene, mats, { w: W, h: H, rim: RIM });
  const C = new Canvas(r);
  for (const e of [[48, 24], [64, 24]]) C.set(e[0] - 0.5, e[1] - 0.6, SOUL[4]);
  // 口から漏れる冷気
  puffs(C, [[20, 64, 7], [92, 66, 7], [14, 76, 5], [98, 78, 5]], ["#0e1a2a", "#182c44", "#284460", "#40627e"], { dens: 0.75, seed: 43 });
  hoarfrost(C, ["scale"], { th: 0.35, seed: 45, k: 1.2 });
  icicles(C, 10305, ["scale", "ice"], 0.12, 5);
  glints(C, 10307, ["scale", "tooth", "ice"], 10);
  snowfall(C, 10309, 40);
  return C.toArt();
}
