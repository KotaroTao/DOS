import { sphere, ellipsoid, cone, tube, box, cyl, U, Sub, Disp, render, Canvas, fbm, rand, fangs } from "../sdf.mjs";
import { BED, ROCK, GLASS, FRAME, MURKGLASS, MURK, RIM, cavernFloor, lampHeap, lantern, cracks, soot, murkMotes, murkHalo, shards } from "../cavern.mjs";
export const meta = { id: "bs_cavebehemoth", key: "hd_cavebehemoth", w: 96, h: 96,
  note: "大空洞の巨獣: 山のように大きな灰色の四つ足の巨獣。低く構えた横向き、太い柱のような脚、ひび割れた岩のような厚い皮は刃をほとんど通さない (物理抵抗75)。小さな目の大きな頭を下げ、開いた口から大空洞を揺るがす吠え声 (弱体・多用)。背中には長い年月で降り積もった黒い灯籠が小山になり、鉄枠とガラスが突き出して、足元に黒いガラスがこぼれる" };
export function build() {
  const mats = {
    hide: { ramp: ["#050505", "#0f0e0d", "#1b1a18", "#292725", "#383533", "#484542", "#5a5753", "#6e6a66"], dither: 0.55, amb: 0.24,
      shade: p => 0.07 * fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5) },
    maw: { ramp: ["#000000", "#140606", "#2a0e0c"], dither: 0.3 },
    eye: { ramp: MURK.slice(3, 6), emit: () => 0.85 },
    bed: BED, rock: ROCK, glass: GLASS, frame: FRAME, murk: MURKGLASS,
  };
  const skin = (x, y, z) => cracks(0.9, 0.22)(x, y, z) + 0.4 * fbm(x * 0.3, y * 0.3, z * 0.3);
  const torso = Disp(U(6, ellipsoid([54, 56, 0], [30, 17, 16], "hide", -4), ellipsoid([72, 58, 0], [18, 16, 15], "hide"), ellipsoid([32, 58, 2], [14, 15, 14], "hide")), skin);
  const head = Disp(U(3, ellipsoid([17, 66, 6], [11, 10, 10], "hide", 20), ellipsoid([8, 74, 9], [7, 6, 7], "hide", 20), ellipsoid([24, 58, 4], [9, 9, 9], "hide")), skin);
  const maw = ellipsoid([6, 78, 12], [6, 3, 5], "maw", 30);
  const legs = [[30, 70, 10, 32, 94, 10], [44, 70, -8, 46, 94, -8], [68, 70, 10, 70, 94, 10], [80, 70, -8, 82, 94, -8]].map(([ax, ay, az, bx, by, bz]) =>
    Disp(U(2, tube([[ax, ay, az, 8], [(ax + bx) / 2, (ay + by) / 2, az, 6.4], [bx, by - 3, bz, 6.6]], "hide", { seg: 2 }), ellipsoid([bx, by - 2, bz], [7.6, 3, 7], "hide")), skin));
  const tail = tube([[84, 56, -2, 4], [92, 64, -4, 2.6], [94, 74, -4, 1.4]], "hide");
  const eye = sphere([16, 62, 15], 0.9, "eye");
  // 背中の灯籠の小山
  const heap = lampHeap(56, 42, -2, 24, 11, { seed: 12401, s: 2.3, lit: 0.4, mound: false });
  const backMound = Disp(ellipsoid([56, 42, -2], [22, 6, 12], "bed"), (x, y, z) => 0.8 * fbm(x * 0.3, y * 0.3, z * 0.3));
  const spill = [lantern([20, 93, 14], 1.2, { rot: 80, broken: true, handle: false }), lantern([58, 94, 12], 1.1, { rot: -75, broken: true, handle: false })];
  const scene = U(0, cavernFloor(48, 95, 47, 13, { seed: 12403, rocks: 2, lamps: 0 }), Sub(U(2, torso, head, ...legs, tail), maw, 0.4), eye, backMound, heap, ...spill);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  fangs(C, "maw", 2, 10, { step: 2, top: [1, 2], bot: [1, 2], cols: ["#2a2824", "#6a6458", "#b0a894"], seed: 12405 });
  // 吠え声の波 (口から左へ)
  for (const rr of [8, 13, 18]) for (let a = Math.PI * 0.75; a < Math.PI * 1.25; a += 0.6 / rr) { const x = 6 + Math.cos(a) * rr, y = 78 + Math.sin(a) * rr * 0.9; if (!C.get(Math.round(x), Math.round(y)) && Math.sin(a * 30) > -0.3) C.set(x, y, rr < 10 ? "#5a5753" : rr < 15 ? "#383533" : "#1b1a18"); }
  murkHalo(C, 56, 34, 20, MURK.slice(0, 2), 0.45);
  murkMotes(C, 12407, 16, [30, 10, 60, 30]);
  shards(C, 12409, ["bed"], 18);
  soot(C, 12411, 40);
  return C.toArt();
}
