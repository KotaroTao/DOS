import { sphere, ellipsoid, cone, tube, box, U, Sub, Disp, render, Canvas, fbm, rand } from "../sdf.mjs";
import { BED, ROCK, GLASS, FRAME, MURKGLASS, RIM, cavernFloor, spikes, soot, shards, afterimage } from "../cavern.mjs";
export const meta = { id: "bs_primalbeast", key: "hd_primalbeast", w: 96, h: 96,
  note: "原初の獣: 灯籠が降りはじめるよりずっと前から底に棲む、太古の犀とも猪ともつかない大きな獣。ほかの魔物と違って煤をかぶらない、比較的きれいな赤茶の毛皮。鼻先の大きな角と額の二本目の角、下顎から反り上がる牙。指が六本の太い足。目にも止まらぬ速さで二度動き (神速・2連撃) — 後ろに二重の残像" };
export function build() {
  const mats = {
    fur: { ramp: ["#070302", "#150a06", "#24120a", "#361c10", "#4a2816", "#60361e", "#7a4828", "#945c36"], dither: 0.5, amb: 0.24,
      shade: p => 0.1 * Math.sin(p.x * 1.1 + p.y * 0.6 + 2 * fbm(p.x * 0.2, p.y * 0.2)) * (p.ny < 0.3 ? 1 : 0.3) + 0.05 * fbm(p.x * 0.6, p.y * 0.6, p.z * 0.6) },
    horn: { ramp: ["#0c0a07", "#221d16", "#3c3428", "#5c513e", "#80735a", "#a89a7c", "#cbbf9f"], spec: 0.6, pow: 20, dither: 0.4 },
    hoof: { ramp: ["#050403", "#14110d", "#272119", "#3a3226"], spec: 0.5, pow: 20, dither: 0.4 },
    eye: { ramp: ["#3a1a06", "#a0601a", "#ffd890"], emit: () => 0.9 },
    bed: BED, rock: ROCK, glass: GLASS, frame: FRAME, murk: MURKGLASS,
  };
  const torso = Disp(U(5, ellipsoid([54, 58, 0], [22, 15, 14], "fur", -4), ellipsoid([36, 52, 2], [13, 15, 13], "fur", 16), ellipsoid([72, 60, 0], [13, 13, 12], "fur")), (x, y, z) => 0.4 * fbm(x * 0.4, y * 0.4, z * 0.4));
  const hump = ellipsoid([40, 42, 0], [12, 8, 10], "fur", 20);
  const head = U(3, ellipsoid([20, 60, 6], [10, 9, 9], "fur", 24), ellipsoid([10, 68, 8], [7, 6, 7], "fur", 30));
  const horns = [cone([7, 66, 12], [2, 46, 13], 3.6, 0.3, "horn"), cone([14, 58, 12], [14, 48, 12], 2.4, 0.3, "horn")];
  const tusks = [tube([[8, 73, 13, 1.4], [3, 72, 14, 1], [2, 66, 14, 0.4]], "horn"), tube([[12, 74, 2, 1.2], [8, 74, 2, 0.9], [6, 68, 2, 0.4]], "horn")];
  const legs = [[34, 66, 9, 30, 92, 10], [40, 66, -8, 42, 92, -8], [66, 68, 9, 70, 92, 10], [74, 68, -8, 80, 92, -8]].map(([ax, ay, az, bx, by, bz]) => tube([[ax, ay, az, 6], [(ax + bx) / 2, (ay + by) / 2 + 2, (az + bz) / 2, 4.6], [bx, by - 2, bz, 4]], "fur", { seg: 3 }));
  // 六本の指の蹄
  const toes = [];
  for (const [x, z] of [[30, 10], [42, -8], [70, 10], [80, -8]]) for (let k = 0; k < 6; k++) { const a = Math.PI * (0.15 + 0.7 * k / 5); toes.push(ellipsoid([x - Math.cos(a) * 4.2, 92.6, z + Math.sin(a) * 2.6], [1.3, 1.6, 1.3], "hoof")); }
  const tail = tube([[86, 56, -2, 2], [92, 62, -3, 1.4], [94, 70, -3, 1]], "fur");
  const eye = sphere([18, 56, 14.4], 1, "eye");
  const scene = U(0, cavernFloor(50, 95, 46, 13, { seed: 12801, rocks: 3, lamps: 2 }), U(4, torso, hump, head, ...legs, tail), ...horns, ...tusks, ...toes, eye);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  afterimage(C, [[6, 0, 0.35, "#361c10"], [13, 0, 0.2, "#1a0d07"]], [0, 30, 90, 62]);
  // 走り抜けた風の筋
  for (const [y, x0, x1] of [[44, 60, 94], [52, 76, 95], [70, 84, 95], [80, 82, 95]]) for (let x = x0; x <= x1; x++) if (!C.get(x, y) && (x + y) % 3) C.set(x, y, x % 2 ? "#2e2a28" : "#1d1a18");
  shards(C, 12803, ["bed"], 12);
  soot(C, 12805, 30);
  return C.toArt();
}
