import { sphere, ellipsoid, cone, tube, box, cyl, torus, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { MUD, POOL, ROTWOOD, RIM, ROT, MIASMA, bogFloor, miasma, motes, scum, lampHand, slime } from "../swamp.mjs";
export const meta = { id: "bs_discardeddoll", key: "hd_discardeddoll", w: 96, h: 96,
  note: "捨てられた人業: 沼のほとりに積まれた作りかけの器の山から、一体が身を起こす。のっぺりした丸い木の頭は割れ、片腕は肩から無く、関節には黒い鉄の帯。胸の板には「灯を掌に載せた手」の印が彫られ、その下の胸の洞は空っぽ。残った手を前へ伸ばすと、生者の魂の灯が尾を引いて洞へ吸い寄せられる (魂奪)。足元には外れた腕や頭が泥に沈む" };
export function build() {
  const mats = {
    wood: { ramp: ramp(["#040302", "#0e0a06", "#1a130b", "#281e12", "#382a19", "#4a3822", "#5e4a2e", "#76603e"], 8), dither: 0.5, amb: 0.24, spec: 0.3, pow: 18,
      shade: p => 0.08 * Math.sin(p.y * 2.2 + 2 * fbm(p.x * 0.2, p.y * 0.1, p.z * 0.2)) },
    pile: { ramp: ramp(["#030202", "#090705", "#120d08", "#1c150d", "#271d12"], 5), dither: 0.55, amb: 0.22 },
    iron: { ramp: ramp(["#020203", "#08080a", "#121216", "#1e1e24", "#2c2c34", "#40404a"], 6), spec: 1, pow: 30, specCol: "#7a7a88", dither: 0.4 },
    hole: { ramp: ["#000000", "#020101", "#060403"], amb: 0, dif: 0.05, noRim: true },
    soul: { ramp: ["#3a2a10", "#7a5a20", "#c09040", "#f0d088", "#fff6d8"], noRim: true, emit: p => 0.4 + 0.55 * Math.max(0, p.nz) },
    mud: MUD, pool: POOL, rotwood: ROTWOOD,
  };
  // 器の山 (背景): 外れた腕・脚・頭が積み重なる
  const R = rand(9901);
  const heap = [Disp(ellipsoid([70, 84, -16], [30, 16, 12], "pile"), (x, y, z) => 0.8 * fbm(x * 0.4, y * 0.4, z * 0.4))];
  for (let i = 0; i < 9; i++) {
    const x = 50 + R() * 44, y = 70 + R() * 14, z = -10 + R() * 10, a = R() * Math.PI, l = 7 + R() * 6;
    heap.push(cyl([x, y, z], [x + Math.cos(a) * l, y - Math.sin(a) * l * 0.5, z + 2], 1.6 + R() * 0.8, "pile", 0.6));
  }
  for (const [x, y, z, r] of [[86, 66, -12, 4.6], [62, 72, -8, 4], [92, 80, -4, 3.6]]) heap.push(sphere([x, y, z], r, "pile"));
  // 身を起こす器: 上体を前へ傾けて座り込み、右腕を伸ばす
  const torso = Disp(U(1.6, ellipsoid([44, 52, 0], [11, 12, 8], "wood", -8), ellipsoid([46, 66, 0], [9, 7, 7], "wood")), (x, y, z) => -0.25 * Math.abs(Math.sin(y * 1.1)));
  const chestPlate = box([42, 50, 7], [7, 7, 1.4], "wood", 1.4, -8);
  const cavity = ellipsoid([43, 61, 7.5], [4.6, 3.6, 4], "hole");
  const neck = U(0.5, cyl([41, 42, 0], [40, 32, 1], 3, "iron"), torus([40.6, 37, 0.5], 3, 1, "iron", 0, 80));
  const head = Sub(sphere([39, 25, 2], 8.6, "wood"), U(0, box([33, 18, 6], [4, 6, 6], "hole", 0, 30), cone([38, 14, 8], [41, 26, 10], 2.2, 0.2, "hole")), 0.3);
  const jointL = torus([54, 42, -2], 3.4, 1.2, "iron", 0, 30);
  const stump = U(0, cyl([54, 42, -2], [57, 46, -4], 3, "wood", 0.6), torus([56, 44, -3], 3, 1, "iron", -30, 40));
  const armR = U(0.8, cyl([33, 44, 5], [24, 54, 12], 2.6, "wood", 0.8), torus([24, 54, 12], 2.6, 1.2, "iron", 40, 70), cyl([24, 54, 12], [12, 56, 18], 2.2, "wood", 0.8));
  const hand = U(0.6, ellipsoid([10, 56, 19], [2.6, 2.2, 1.8], "wood"),
    ...[[-14, 3], [-6, 2.6], [2, 2.4], [10, 2]].map(([a, L], i) => cyl([9, 56 + i * 0.4 - 1, 19], [9 + Math.cos((180 + a) * Math.PI / 180) * L * 2, 56 + Math.sin((180 + a) * Math.PI / 180) * L * 2 - 1 + i * 0.8, 19], 0.7, "wood", 0.3)));
  const hips = ellipsoid([48, 74, 2], [10, 5, 7], "wood");
  const legs = [U(0.6, cyl([42, 76, 6], [32, 82, 14], 3, "wood", 1), torus([32, 82, 14], 2.8, 1.1, "iron", 30, 60), cyl([32, 82, 14], [26, 90, 16], 2.6, "wood", 1)),
    U(0.6, cyl([54, 76, 2], [64, 84, 6], 3, "wood", 1), cyl([64, 84, 6], [66, 91, 8], 2.6, "wood", 1))];
  // 泥に転がる外れた頭と腕
  const loose = [sphere([18, 89, 8], 4, "wood"), cyl([74, 90, 10], [86, 88, 12], 1.8, "wood", 0.6)];
  // 吸い寄せられる魂の灯
  const souls = [U(1, sphere([4, 38, 14], 2.6, "soul"), cone([4, 38, 14], [8, 46, 15], 1.8, 0.3, "soul")), sphere([12, 30, 12], 1.4, "soul")];
  const doll = Sub(U(1.2, torso, chestPlate, head, armR, hand, hips, ...legs, stump), cavity, 0.5);
  const scene = U(0, bogFloor(48, 94, 46, 13, { n: 2, seed: 9903, wet: 0.05, logs: 1 }), ...heap, doll, neck, jointL, ...loose, ...souls);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [6, 38, 22], r: 22, k: 0.35 }, { p: [43, 61, 16], r: 10, k: 0.25 }] });
  const C = new Canvas(r);
  // 胸の印 (彫り)
  lampHand(C, 42, 50, ["#2a1c0c", "#140c05", "#e8b858"]);
  // 魂の灯の尾 (洞へ吸い込まれる筋)
  for (let t = 0; t <= 1; t += 0.03) { const x = 6 + t * 34, y = 40 + t * 20 + Math.sin(t * 8) * 1.5; if (!C.get(Math.round(x), Math.round(y))) C.set(x, y, ["#7a5a20", "#c09040", "#f0d088"][Math.floor(t * 2.99)]); }
  // 頭の割れ目の奥と、木目のひび
  for (let y = 18; y < 34; y++) for (let x = 30; x < 50; x++) { const p = C.pix[y * 96 + x]; if (p && p.m === "wood" && Math.abs(x - 40 + (y - 26) * 0.6) < 0.6 && y > 20) C.set(x, y, "#0e0a06"); }
  slime(C, 9905, ["wood", "pile"], 0.06);
  scum(C, 9907);
  miasma(C, 9909, 2, [0, 62, 96, 26], 0.22);
  motes(C, 9911, 26, [2, 2, 92, 70], true);
  return C.toArt();
}
