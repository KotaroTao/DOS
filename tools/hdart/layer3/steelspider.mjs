import { tube, sphere, ellipsoid, cone, slab, cyl, box, torus, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { GRAVEL, ROCK, RIM, rubble, pebbles, tri } from "../mine.mjs";
export const meta = { id: "bs_steelspider", key: "hd_steelspider", w: 96, h: 96,
  note: "鋼蜘蛛: 錬金術師が造った鋼の機械蜘蛛。鋲打ちの装甲板を重ねた胴、真鍮の管が這う硝子の腹、八つの赤い硝子の眼、関節ごとに蝶番の付いた鋼の脚。尻から鋼糸を引く" };
export function build() {
  const mats = {
    steel: { ramp: ramp(["#020203", "#07080a", "#0e1014", "#171a20", "#21252d", "#2d323c", "#3c424e", "#505866", "#6a7482"], 9), spec: 2.0, pow: 55, specCol: "#d0dcec", dither: 0.45,
      shade: p => 0.06 * fbm(p.x * 0.6, p.y * 0.6, p.z * 0.6) },
    brass: { ramp: ramp(["#050302", "#160f05", "#2c1f0a", "#463210", "#644a18", "#866624"], 6), spec: 1.4, pow: 35, specCol: "#ffe0a0", dither: 0.4 },
    glass: { ramp: ramp(["#020504", "#06100c", "#0c1c16", "#142a22", "#1e3c30"], 5), spec: 2.2, pow: 70, specCol: "#c0f0e0", dither: 0.4, amb: 0.3 },
    fluid: { ramp: ["#0a1a06", "#1e400c", "#3a7014", "#6aa828"], emit: p => 0.3 + 0.35 * Math.max(0, p.nz) },
    eye: { ramp: ["#2a0000", "#6a0404", "#b01008", "#f04020", "#ffb090"], emit: p => 0.5 + 0.5 * Math.max(0, p.nz) },
    gravel: GRAVEL, rock: ROCK,
  };
  // 胴: 前の頭胸部 (装甲板) と、後ろの硝子の腹 (緑の溶液)
  const ceph = ellipsoid([48, 54, 6], [14, 9, 11], "steel");
  const plates = [];
  for (let i = 0; i < 3; i++) plates.push(ellipsoid([48, 50 - i * 1.4, 4 - i * 3], [13.5 - i * 1.5, 8, 10 - i], "steel"));
  const abd = ellipsoid([50, 40, -14], [15, 13, 12], "glass");
  const fluid = ellipsoid([50, 44, -14], [12.5, 8, 10], "fluid");
  const ribs = [torus([50, 40, -14], 15.2, 0.9, "brass", 0, 0), torus([50, 40, -14], 15.2, 0.9, "brass", 90, 0), torus([50, 40, -14], 15.2, 0.9, "brass", 45, 0)];
  const pipes = [tube([[36, 50, 4, 1], [34, 42, -2, 1], [38, 30, -10, 1]], "brass"), tube([[60, 50, 4, 1], [64, 42, -2, 1], [60, 30, -10, 1]], "brass")];
  // 眼: 頭の前面に八つの赤い硝子
  const eyes = [];
  for (const [x, y, r] of [[44.5, 52, 1.9], [51.5, 52, 1.9], [41.5, 49.5, 1.2], [54.5, 49.5, 1.2], [46, 48.5, 1], [50, 48.5, 1], [42, 54.5, 0.9], [54, 54.5, 0.9]]) eyes.push(sphere([x, y, 16.2], r, "eye"));
  const fangs = [cone([45, 60, 14], [44, 66, 16], 1.4, 0.3, "steel"), cone([51, 60, 14], [52, 66, 16], 1.4, 0.3, "steel")];
  // 脚: 胴から持ち上がって膝、床へ。関節に蝶番の円筒
  const legs = [];
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) {
    const bx = 48 + s * 11, by = 54 + i * 1.5 - 2, z = 6 - i * 6;
    const kx = 48 + s * [24, 30, 33, 30][i], ky = [36, 30, 30, 36][i], fx = 48 + s * [32, 42, 46, 44][i], fy = [88, 86, 80, 72][i];
    legs.push(tube([[bx, by, z, 2.4], [kx, ky, z - 2, 1.8]], "steel"), tube([[kx, ky, z - 2, 1.8], [(kx + fx) / 2 + s * 2, (ky + fy) / 2, z - 2, 1.4], [fx, fy, z, 0.4]], "steel"));
    legs.push(cyl([kx, ky, z - 4.4], [kx, ky, z + 0.4], 2.4, "brass", 0.4));
  }
  const scene = U(0, rubble(48, 92, 46, 15, { n: 7, seed: 181, big: 3 }), U(0.8, ceph, ...plates), abd, fluid, ...ribs, ...pipes, ...eyes, ...fangs, ...legs);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  // 装甲の鋲
  for (const [x, y] of [[38, 54], [40, 50], [56, 50], [58, 54], [44, 46], [52, 46]]) { C.only(x, y, "#6a7482"); C.only(x + 1, y + 1, "#07080a"); }
  // 尻から垂れる鋼糸
  const T = ["#3c424e", "#8a96a6"];
  for (let i = 0; i < 40; i++) { const x = 64 + i * 0.5, y = 30 - i * 0.7; if (y < 1) break; C.set(x, y, T[i % 5 === 0 ? 1 : 0]); }
  pebbles(C, 79, 48, 91, 42);
  return C.toArt();
}
