import { sphere, ellipsoid, cone, tube, box, cyl, U, Sub, Disp, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { MUD, POOL, RIM, ROT, bogFloor, toxBubbles, slime, scum, motes, ooze } from "../swamp.mjs";
export const meta = { id: "bs_rotooze", key: "hd_rotooze", w: 96, h: 96,
  note: "腐敗の泥: 底まで落ちて腐った魂が泥になって盛り上がったもの。黒緑のぬめった山に、沈みかけた頭骨とあばらが半ば埋まり、奥で腐った魂の黄緑の光がいくつも濁る。突き立てられた剣は柄まで沈んで止まり (物理75)、表面は泡を吹いてはじける。呪文の熱には脆い (魔法弱点)" };
export function build() {
  const mats = {
    ooze: { ramp: ramp(["#020301", "#060904", "#0d1308", "#151e0c", "#1f2b11", "#2b3a17", "#3a4c1e", "#4e6226"], 8), spec: 1.6, pow: 36, specCol: "#9ab858", dither: 0.5, amb: 0.22,
      shade: p => 0.12 * fbm(p.x * 0.25, p.y * 0.25, p.z * 0.25) },
    bone: { ramp: ramp(["#0c0a06", "#221e14", "#3a3424", "#56503a", "#767054", "#9a9474"], 6), dither: 0.45, amb: 0.3 },
    steel: { ramp: ramp(["#030304", "#0c0d10", "#1a1c20", "#2c2f34", "#44484e", "#62686e"], 6), spec: 1.2, pow: 30, specCol: "#a8b0b8", dither: 0.4 },
    hole: { ramp: ["#000000", "#020301"], amb: 0, dif: 0.05, noRim: true },
    core: { ramp: ROT, noRim: true, emit: p => 0.35 + 0.5 * Math.max(0, p.nz) },
    mud: MUD, pool: POOL,
  };
  // 泥の山: 下ほど広がり、上へ崩れながら伸びる
  const mass = Disp(U(4, ellipsoid([48, 74, 0], [34, 18, 16], "ooze"), ellipsoid([46, 52, 0], [22, 18, 13], "ooze", -8), ellipsoid([42, 34, 2], [13, 12, 10], "ooze", -12),
    ellipsoid([66, 62, -2], [12, 12, 10], "ooze", 20), ellipsoid([24, 70, 4], [12, 10, 10], "ooze")), (x, y, z) => ooze(1.4, 0.18)(x, y, z) + 0.6 * Math.max(0, vnoise(x * 0.4, y * 0.4, z * 0.4) - 0.3));
  // 半ば沈んだ骨
  const skull = Sub(ellipsoid([40, 36, 10], [5.4, 5.6, 5], "bone", -10), U(0, ellipsoid([37.6, 35.6, 14.6], [1.6, 1.8, 1.4], "hole"), ellipsoid([42.4, 35.2, 14.6], [1.6, 1.8, 1.4], "hole")), 0.2);
  const skull2 = ellipsoid([70, 72, 12], [4, 4, 3.6], "bone", 20);
  const ribs = [];
  for (let i = 0; i < 4; i++) ribs.push(tube([[54 + i * 3, 52, 6], [58 + i * 3.4, 56, 13], [56 + i * 3, 62, 12]].map(p => [...p, 0.9]), "bone", { seg: 3 }));
  // 柄まで沈んだ剣
  const sword = U(0.3, cyl([22, 34, 10], [30, 50, 6], 1.1, "steel"), box([21, 33, 10], [3.6, 0.8, 1], "steel", 0.3, 28), cyl([19, 28, 11], [21.6, 32.6, 10], 0.9, "steel"));
  // 腐った魂の濁った光 (泥の中)
  const cores = [sphere([48, 58, 12], 2.4, "core"), sphere([30, 66, 13], 1.8, "core"), sphere([60, 76, 14], 1.6, "core"), sphere([44, 44, 11], 1.4, "core")];
  const scene = U(0, bogFloor(48, 92, 46, 14, { n: 2, seed: 9201, wet: 0.15, logs: 0 }), Sub(mass, U(0, ...cores.map(c => c)), 0.6), ...cores, skull, skull2, ...ribs, sword);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [48, 58, 22], r: 16, k: 0.3 }] });
  const C = new Canvas(r);
  // 沈んだ骨と光に泥を被せ直す (半透け)
  for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) { const p = C.pix[y * 96 + x]; if (p && p.m === "core" && (x + y) % 3 === 0) C.set(x, y, "#2b3a17"); }
  // 表面ではじける泡
  for (const [x, y] of [[34, 26], [52, 30], [62, 50], [26, 56], [74, 60]]) { C.set(x, y - 1, ROT[2]); C.set(x - 1, y, ROT[1]); C.set(x + 1, y, ROT[1]); C.set(x, y + 1, ROT[1]); }
  toxBubbles(C, 9203, 22, [6, 4, 84, 40]);
  slime(C, 9205, ["ooze"], 0.12, ["#151e0c", "#2b3a17", "#4e6226"]);
  scum(C, 9207);
  motes(C, 9209, 14, [2, 2, 92, 50], true);
  return C.toArt();
}
