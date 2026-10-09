import { sphere, ellipsoid, cone, tube, box, cyl, U, Sub, Disp, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { MUD, POOL, ROTWOOD, RIM, ROT, MIASMA, bogFloor, scum, motes, slime, puffs, ooze } from "../swamp.mjs";
export const meta = { id: "bs_toxicgolem", key: "hd_toxicgolem", w: 96, h: 96,
  note: "汚泥の巨塊: 沼の汚泥が幾年も積もって固まり、動き出したずんぐりした巨人。泥の体には折れた槍や器の腕、骨が塗り込められ、継ぎ目から毒の煙が漏れる。頭上に沼底の泥の大塊を両腕で担ぎ上げ、力を溜めてから叩きつける (溜め・多用)。厚い泥は刃をほとんど通さない (物理75)" };
export function build() {
  const mats = {
    mud2: { ramp: ramp(["#020201", "#070705", "#0e0e09", "#16160e", "#202014", "#2b2a1b", "#383623", "#48452d"], 8), spec: 0.9, pow: 28, specCol: "#6a6a44", dither: 0.55, amb: 0.22,
      shade: p => 0.12 * fbm(p.x * 0.3, p.y * 0.3, p.z * 0.3) },
    boulder: { ramp: ramp(["#020301", "#070a05", "#0e1309", "#161d0e", "#202913", "#2c3719"], 6), spec: 0.8, pow: 24, dither: 0.6, amb: 0.22 },
    junk: { ramp: ramp(["#0c0a06", "#221e14", "#3a3424", "#56503a", "#767054"], 5), dither: 0.45, amb: 0.3 },
    seam: { ramp: ["#000000", "#0e1806", "#24400c"], amb: 0, dif: 0.1, noRim: true },
    eye: { ramp: [ROT[3], ROT[4], ROT[5]], emit: () => 0.95 },
    mud: MUD, pool: POOL, rotwood: ROTWOOD,
  };
  // 体: 低い頭、盛り上がった肩、太い腕を上へ
  const torso = U(5, ellipsoid([48, 62, 0], [22, 18, 15], "mud2"), ellipsoid([48, 46, 0], [24, 12, 14], "mud2"), ellipsoid([48, 78, 2], [16, 10, 12], "mud2"));
  const head = ellipsoid([48, 40, 8], [8, 7, 7], "mud2");
  const arms = [tube([[28, 46, 2, 8], [20, 32, 4, 6.4], [24, 18, 6, 5.4]], "mud2", { seg: 3 }), tube([[68, 46, 2, 8], [76, 32, 4, 6.4], [72, 18, 6, 5.4]], "mud2", { seg: 3 })];
  const legs = [tube([[38, 80, 4, 8], [34, 90, 6, 7.4]], "mud2"), tube([[58, 80, 2, 8], [62, 90, 4, 7.4]], "mud2")];
  // 担ぎ上げた泥の大塊
  const boulder = Disp(ellipsoid([48, 12, 2], [26, 10, 12], "boulder"), (x, y, z) => ooze(1.8, 0.2)(x, y, z));
  // 塗り込められた槍・骨・器の腕
  const junk = [cyl([62, 56, 12], [78, 72, 16], 1, "junk"), cyl([30, 64, 12], [24, 54, 18], 1.4, "junk", 0.5), sphere([40, 72, 13], 3, "junk"), cyl([54, 70, 14], [60, 74, 16], 1.6, "junk", 0.5)];
  const seams = U(0, ...[[36, 54], [58, 50], [46, 66], [62, 66], [40, 48]].map(([x, y]) => ellipsoid([x, y, 13], [3, 1, 2], "seam", 30)));
  const golem = Sub(Disp(U(3, torso, head, ...arms, ...legs), (x, y, z) => ooze(1.6, 0.18)(x, y, z) + 0.8 * Math.max(0, vnoise(x * 0.35, y * 0.35, z * 0.35) - 0.4)), U(0, seams, ellipsoid([48, 41, 14], [5, 1.4, 2], "seam")), 0.3);
  const eyes = [sphere([45, 40.6, 13.6], 1.1, "eye"), sphere([51, 40.6, 13.6], 1.1, "eye")];
  const scene = U(0, bogFloor(48, 95, 46, 14, { n: 2, seed: 10501, wet: 0.1, logs: 1 }), golem, boulder, ...junk, ...eyes);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  // 溜めの気配: 塊のまわりに集まる黄緑の毒気の筋
  const R = rand(10503);
  for (let i = 0; i < 9; i++) { const a = -Math.PI * (0.05 + R() * 0.9), r0 = 28 + R() * 8; for (let t = 0; t < 1; t += 0.08) { const x = 48 + Math.cos(a) * (r0 - t * 8), y = 12 + Math.sin(a) * (r0 - t * 8) * 0.55; if (!C.get(Math.round(x), Math.round(y))) C.set(x, y, ROT[1 + Math.floor(t * 3)]); } }
  // 継ぎ目から漏れる毒の煙
  puffs(C, [[30, 50, 4], [70, 46, 4], [74, 40, 3], [24, 44, 3]], MIASMA.slice(1), { dens: 0.9, seed: 7 });
  slime(C, 10505, ["boulder", "mud2"], 0.14, ["#0e0e09", "#202014", "#48452d"]);
  scum(C, 10507);
  motes(C, 10509, 12, [2, 30, 92, 50], true);
  return C.toArt();
}
