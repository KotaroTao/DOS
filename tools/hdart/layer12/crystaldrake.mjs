import { sphere, ellipsoid, cone, tube, box, slab, U, Sub, Disp, render, Canvas, fbm, rand, fangs } from "../sdf.mjs";
import { BED, ROCK, GLASS, FRAME, MURKGLASS, CRYSTAL, RIM, cavernFloor, spikes, specks, glints, soot, breathFan, shards } from "../cavern.mjs";
export const meta = { id: "bs_crystaldrake", key: "hd_crystaldrake", w: 96, h: 96,
  note: "水晶竜: 鉱脈の水晶を食べて育った、透きとおる白青の水晶の鱗の竜 (四つ足・翼なし)。鱗は面ごとに明暗が分かれ、奥に呑んだ濁った魂が黒い粒になって点々と見える。背と尾に結晶の棘が並び、首をもたげた口から砕けた水晶のつぶての息を吐く (ブレス)。水晶の鱗は呪文をほとんど通さない (魔法抵抗75)" };
export function build() {
  const mats = {
    xtal: CRYSTAL,
    spike: { ...CRYSTAL, ramp: CRYSTAL.ramp.slice(2) },
    maw: { ramp: ["#000000", "#06101a", "#0e2030"], dither: 0.3 },
    eye: { ramp: ["#4e7e98", "#9cc4d6", "#f0fbff"], emit: () => 0.9 },
    bed: BED, rock: ROCK, glass: GLASS, frame: FRAME, murk: MURKGLASS,
  };
  const facet = (x, y, z) => 0.5 * Math.abs(Math.sin(x * 0.6 + y * 0.3)) * Math.abs(Math.sin(y * 0.55 - z * 0.4)) + 0.2 * fbm(x * 0.4, y * 0.4, z * 0.4);
  const body = Disp(U(4, ellipsoid([56, 66, 0], [20, 11, 12], "xtal", -6), ellipsoid([40, 60, 2], [10, 10, 10], "xtal", 30),
    tube([[38, 58, 4, 6.4], [30, 46, 6, 5], [26, 34, 8, 4.4]], "xtal", { seg: 3 }),
    ellipsoid([22, 28, 10], [8, 6, 6], "xtal", -10), ellipsoid([13, 32, 12], [6, 3.4, 4.4], "xtal", 10)), facet);
  const jaw = ellipsoid([14, 37, 12], [6, 2, 4], "xtal", 20);
  const maw = ellipsoid([10, 35, 14], [5, 2, 4], "maw", 16);
  const legs = [[44, 68, 8, 40, 92, 10], [50, 70, -6, 52, 92, -6], [68, 70, 8, 72, 92, 10], [72, 70, -6, 78, 92, -6]].map(([ax, ay, az, bx, by, bz]) =>
    Disp(tube([[ax, ay, az, 5], [(ax + bx) / 2 + 2, (ay + by) / 2, az, 3.6], [bx, by, bz, 3]], "xtal", { seg: 3 }), facet));
  const feet = [[40, 92, 10], [52, 92, -6], [72, 92, 10], [78, 92, -6]].map(([x, y, z]) => ellipsoid([x - 1, y, z], [4, 1.8, 3], "xtal"));
  const tail = Disp(tube([[74, 64, -2, 6], [86, 58, -4, 4], [92, 46, -4, 2.6], [90, 36, -4, 1.4]], "xtal", { seg: 3 }), facet);
  const back = spikes([[[30, 40, 4], [36, 34, 2], 2.4, 0.2], [[36, 52, 2], [44, 44, 0], 2.6, 0.2], [[48, 56, 0], [54, 44, -2], 3, 0.2], [[58, 56, 0], [64, 44, -2], 3.2, 0.2], [[68, 58, -2], [74, 47, -2], 2.8, 0.2], [[80, 58, -3], [88, 50, -3], 2.2, 0.2], [[89, 46, -4], [95, 40, -4], 1.6, 0.2],
    [[22, 24, 6], [26, 14, 2], 2, 0.2], [[18, 25, 8], [16, 16, 6], 1.6, 0.2]], "spike");
  const eye = sphere([19, 27, 15.4], 1, "eye");
  const scene = U(0, cavernFloor(52, 95, 44, 13, { seed: 12501, rocks: 3, lamps: 2 }), Sub(U(1.5, body, jaw, ...legs, ...feet, tail), maw, 0.3), ...back, eye);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [10, 36, 24], r: 20, k: 0.3 }] });
  const C = new Canvas(r);
  specks(C, ["xtal"], { f: 0.4, th: 0.72, seed: 12503, cols: ["#000000", "#05080c"] });
  fangs(C, "maw", 6, 14, { step: 2, top: [1, 2], bot: [1, 1], cols: ["#365e78", "#9cc4d6", "#e6f6ff"], seed: 12505 });
  // 水晶のつぶての息 (左下へ)
  breathFan(C, 6, 37, 155, 34, 40, { seed: 12507, cols: ["#0c1622", "#244258", "#4e7e98", "#9cc4d6", "#e6f6ff"], dens: 0.8 });
  const R = rand(12509);
  for (let k = 0; k < 9; k++) { const t = 0.3 + R() * 0.7, a = (155 + (R() - 0.5) * 30) * Math.PI / 180, x = Math.round(6 + Math.cos(a) * 34 * t), y = Math.round(37 + Math.sin(a) * 34 * t); if (x < 1 || y < 1) continue; C.set(x, y, "#e6f6ff"); C.set(x + 1, y, "#4e7e98"); C.set(x, y + 1, "#244258"); }
  glints(C, 12511, ["xtal", "spike"], 9);
  shards(C, 12513, ["bed"], 12, ["#05080c", "#244258", "#9cc4d6"]);
  soot(C, 12515, 26);
  return C.toArt();
}
