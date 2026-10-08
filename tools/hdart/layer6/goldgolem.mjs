import { tube, sphere, ellipsoid, cone, cyl, box, torus, slab, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { FLAG, POOL, MARBLE, RIM, templeFloor, ripples, bubbles, motes } from "../temple.mjs";
export const meta = { id: "bs_goldgolem", key: "hd_goldgolem", w: 96, h: 96,
  note: "黄金の守り像: 宝物庫を守るため金を流し込んで造られた、ずんぐりと重い黄金の像。胸に神殿の紋、頭は兜のような冠で眼は赤い宝石。両の拳を頭上で組み、鎧ごと打ち砕く大振りの一撃を振り下ろそうとしている。金はくすみ、継ぎ目に緑青と藻" };
export function build() {
  const mats = {
    gold: { ramp: ramp(["#060402", "#140d04", "#261908", "#3a270c", "#523810", "#6c4c16", "#8a6420", "#aa8030", "#c8a048"], 9), spec: 1.6, pow: 36, specCol: "#f4dc90", dither: 0.4, amb: 0.16,
      shade: p => 0.07 * fbm(p.x * 0.3, p.y * 0.3, p.z * 0.3) },
    patina: { ramp: ramp(["#030504", "#0a1410", "#122219", "#1c3224", "#284432"], 5), dither: 0.7, amb: 0.25 },
    gem: { ramp: ["#3a0606", "#9a1810", "#f04828", "#ffc0a0"], emit: p => 0.5 + 0.5 * Math.max(0, p.nz) },
    maw: { ramp: ["#000000", "#040302", "#080604"], amb: 0.1, dif: 0.2, noRim: true },
    flag: FLAG, pool: POOL, marble: MARBLE,
  };
  // 継ぎ目の緑青: 窪み (AO の暗いところ) ではなく、継ぎ目の帯で塗り分け
  const verd = (x, y, z, m) => m === "gold" && fbm(x * 0.25, y * 0.25, z * 0.25) > 0.32 ? "patina" : m;
  // 胴: 樽のような胸と腹、太い腰
  const torso = U(2.5, ellipsoid([48, 50, 0], [17, 13, 12], "gold"), ellipsoid([48, 64, 0], [13, 8, 10], "gold"));
  const belt = torus([48, 64, 0], 12.4, 1.6, "gold", 0, -82);
  // 胸の紋: 円と放射
  const crest = (x, y, z, m) => {
    if (m !== "gold" || z < 8) return m;
    const d = Math.hypot(x - 48, y - 49);
    return (d > 4.4 && d < 5.6) || (d < 4.4 && (Math.abs(x - 48) < 0.6 || Math.abs(y - 49) < 0.6)) ? "patina" : m;
  };
  // 頭: 肩に沈む冠の兜。前に眼の宝石、口は細い溝
  const head = U(1.2, ellipsoid([48, 33, 4], [7, 6.4, 6.6], "gold"), cyl([48, 29, 3], [48, 25, 3], 6.2, "gold", 1));
  const crownSpikes = [];
  for (let i = -2; i <= 2; i++) crownSpikes.push(cone([48 + i * 3.2, 25.5, 5 + (2 - Math.abs(i)) * 0.6], [48 + i * 3.6, 19 + Math.abs(i) * 1.6, 5], 1.4, 0.3, "gold"));
  const visor = U(0, ellipsoid([48, 32.6, 10.2], [5.6, 1.5, 2], "maw"));
  const brow = ellipsoid([48, 30.4, 9.4], [6.2, 1.2, 2.2], "gold");
  const eyes = [ellipsoid([44.8, 32.6, 9.4], [1.4, 0.8, 1], "gem"), ellipsoid([51.2, 32.6, 9.4], [1.4, 0.8, 1], "gem")];
  // 肩: 大きな半球の肩当て
  const shL = ellipsoid([30, 41, 1], [8.5, 7.5, 8], "gold"), shR = ellipsoid([66, 41, 1], [8.5, 7.5, 8], "gold");
  // 腕: 頭上へ振り上げ、両拳を組む
  const armL = U(2, tube([[28, 40, 2, 5.4], [26, 28, 4, 4.8], [38, 14, 6, 4.4]], "gold", { seg: 3 }));
  const armR = U(2, tube([[68, 40, 2, 5.4], [70, 28, 4, 4.8], [58, 14, 6, 4.4]], "gold", { seg: 3 }));
  const fists = U(1.4, ellipsoid([43, 10, 7], [6.4, 5.6, 6], "gold"), ellipsoid([53, 10, 7], [6.4, 5.6, 6], "gold"));
  const knuckle = [];
  for (let i = 0; i < 4; i++) knuckle.push(sphere([40.5 + i * 2.2, 7, 11.5], 1.2, "gold"), sphere([50.5 + i * 2.2, 7, 11.5], 1.2, "gold"));
  // 脚: 短く太い柱の脚と、角張った足
  const legs = [cyl([39, 68, 1], [37, 84, 2], 6.6, "gold", 2), cyl([57, 68, 1], [59, 84, 2], 6.6, "gold", 2)];
  const feet = [box([36, 86, 5], [7.5, 2.6, 7], "gold", 1.4), box([60, 86, 5], [7.5, 2.6, 7], "gold", 1.4)];
  const knees = [sphere([38, 74, 6], 3.4, "gold"), sphere([58, 74, 6], 3.4, "gold")];
  const golem = Paint(Paint(Sub(U(1.2, torso, belt, head, brow, ...crownSpikes, shL, shR, armL, armR, fists, ...knuckle, ...legs, ...feet, ...knees), visor, 0.3), crest), verd);
  const scene = U(0, templeFloor(48, 91, 44, 14, { n: 4, seed: 643, cols: 1 }), golem, ...eyes);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, bounce: 0.14, lights: [{ p: [48, 34, 18], r: 12, k: 0.25 }] });
  const C = new Canvas(r);
  // 振り上げた拳の上の力の気配 (振り下ろしの軌跡の弧)
  const G = ["#3a2a0c", "#7a5a1c", "#c8a048"];
  for (let a = -0.9; a <= 0.9; a += 0.02) { const x = 48 + Math.sin(a) * 36, y = 40 - Math.cos(a) * 36; if (!C.get(Math.round(x), Math.round(y))) C.set(x, y, G[Math.abs(a) < 0.5 ? 1 : 0]); }
  for (let a = -0.6; a <= 0.6; a += 0.03) { const x = 48 + Math.sin(a) * 39, y = 40 - Math.cos(a) * 39; if (!C.get(Math.round(x), Math.round(y)) && Math.round(a * 30) % 2 === 0) C.set(x, y, G[0]); }
  C.set(44, 32, "#ffc0a0"); C.set(51, 32, "#ffc0a0");
  ripples(C, 645);
  bubbles(C, 647, 8, [4, 30, 88, 50]);
  motes(C, 649, 14);
  return C.toArt();
}
