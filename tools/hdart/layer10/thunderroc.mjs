import { sphere, ellipsoid, cone, tube, slab, U, Sub, Disp, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { STAIR, PUDDLE, TOWER, RIM, BOLT, towerFloor, bolt2d, crackle, sparks, rain, clouds } from "../storm.mjs";
export const meta = { id: "bs_thunderroc", key: "hd_thunderroc", w: 96, h: 96,
  note: "雷鳴の大鵬: 塔の外壁の張り出しにとまり、両の翼を高く振り上げた巨鳥。黒紫の羽の先は雷雲のようにほつれ、翼の骨に沿って稲光が走る。大きく開いた鉤くちばしから雷の息を吐いて隊をまとめて撃つ (ブレス・多用)。風を切るのが速く、たいてい先に動く (俊敏)" };
export function build() {
  const mats = {
    feather: { ramp: ramp(["#030308", "#0a0914", "#131124", "#1e1a36", "#2a2548", "#38315c", "#4a4272", "#5e5688"], 8), dither: 0.6, amb: 0.22,
      shade: p => 0.12 * Math.sin(p.x * 0.9 + p.y * 1.6 + 2 * fbm(p.x * 0.3, p.y * 0.3)) },
    wing: { ramp: ramp(["#030308", "#08070f", "#100e1d", "#19162c", "#24203d", "#302a50", "#3e3766", "#50487c"], 8), dither: 0.55, amb: 0.24,
      shade: p => 0.18 * (Math.abs(Math.sin(Math.hypot(p.x - 48, p.y - 46) * 0.55)) - 0.5) },
    beak: { ramp: ramp(["#0a0804", "#221c0e", "#3e341c", "#62542e", "#8c7c48", "#b8aa74"], 6), spec: 1, pow: 30, dither: 0.4 },
    claw: { ramp: ramp(["#050506", "#121216", "#24242c", "#3a3a46"], 4), spec: 0.8, pow: 24 },
    maw: { ramp: ["#000000", "#0a0a1a", "#1c2048"], amb: 0.05, dif: 0.2, noRim: true },
    eye: { ramp: [BOLT[2], BOLT[3], BOLT[4]], emit: () => 0.95 },
    stair: STAIR, puddle: PUDDLE, tower: TOWER,
  };
  const body = ellipsoid([52, 60, 0], [11, 15, 10], "feather", 14);
  const breast = ellipsoid([46, 58, 5], [7, 11, 6], "feather", 14);
  const neck = tube([[46, 50, 4, 6], [40, 42, 7, 5], [37, 34, 9, 4.6]], "feather");
  const head = ellipsoid([35, 31, 10], [7, 6, 6], "feather", -10);
  const crest = [cone([38, 27, 6], [50, 20, 2], 2.2, 0.3, "feather"), cone([37, 29, 5], [51, 26, 1], 1.8, 0.3, "feather"), cone([39, 25, 7], [47, 14, 4], 1.8, 0.3, "feather")];
  const upper = tube([[31, 29, 13, 3.4], [23, 30, 15, 2.6], [17, 35, 14, 1.4], [16, 38, 13, 0.5]], "beak", { seg: 3 });
  const lower = tube([[31, 34, 12, 2.4], [24, 38, 13, 1.6], [20, 40, 12, 0.6]], "beak", { seg: 3 });
  const maw = ellipsoid([26, 35, 14], [5, 2, 2.4], "maw", 20);
  const eye = sphere([34, 29, 15.4], 1.1, "eye");
  // 振り上げた両翼: 骨 (肩 → 手首 → 先) と、先が羽に割れた膜
  const wing = (side, z) => {
    const sh = side < 0 ? [44, 48] : [60, 46];
    const wr = side < 0 ? [24, 22] : [74, 18];
    const tp = side < 0 ? [6, 4] : [92, 2];
    const poly = side < 0
      ? [sh, [34, 34], wr, tp, [8, 14], [4, 18], [10, 24], [4, 30], [14, 32], [8, 40], [20, 40], [16, 48], [30, 48], [30, 56], [40, 56]]
      : [sh, [66, 30], wr, tp, [90, 12], [96, 18], [88, 24], [96, 30], [84, 32], [92, 40], [78, 40], [84, 48], [68, 48], [70, 56], [60, 58]];
    return [slab(poly, z, 1.1, "wing", 0.7, 1.2), tube([[...sh, z + 1, 2.6], [...wr, z + 1, 1.8], [...tp, z + 1, 0.8]], "feather", { seg: 2 })];
  };
  const tail = [cone([56, 72, -2], [66, 88, -6], 4.4, 1.2, "feather"), cone([54, 72, 0], [58, 90, -2], 3.6, 1, "feather")];
  const legs = [tube([[48, 72, 4, 2.6], [46, 82, 5, 1.6], [46, 87, 6, 1.4]], "claw"), tube([[58, 72, -2, 2.6], [60, 82, -2, 1.6], [60, 87, -2, 1.4]], "claw")];
  const talons = [];
  for (const [x, z] of [[46, 6], [60, -2]]) for (const d of [-3, 0, 3]) talons.push(cone([x, 87, z], [x + d, 89.5, z + 2], 0.9, 0.3, "claw"));
  const ledge = towerFloor(54, 94, 30, 10, { n: 1, seed: 10101, wet: 0.1 });
  const bird = Sub(U(1.4, body, breast, neck, head, ...crest, ...tail), maw, 0.2);
  const scene = U(0, ledge, bird, upper, lower, ...wing(-1, 4), ...wing(1, -6), eye, ...legs, ...talons);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [16, 40, 22], r: 20, k: 0.5 }] });
  const C = new Canvas(r);
  // 翼の骨に沿って走る稲光
  bolt2d(C, 44, 47, 8, 6, { seed: 9, jag: 1.4, branch: 2, all: true, glow: false, cols: [BOLT[1], BOLT[1], BOLT[2], BOLT[3], BOLT[3]] });
  bolt2d(C, 60, 45, 90, 4, { seed: 13, jag: 1.4, branch: 2, all: true, glow: false, cols: [BOLT[1], BOLT[1], BOLT[2], BOLT[2], BOLT[3]] });
  // 雷の息 (くちばしから左下へ広がる稲妻の束)
  for (const [x1, y1, s] of [[2, 62, 1], [6, 78, 2], [16, 88, 3]]) bolt2d(C, 18, 39, x1, y1, { seed: s, jag: 2.6, branch: 1 });
  crackle(C, 10103, ["wing"], 0.012);
  clouds(C, [[48, 6, 14, 4]], { dens: 0.6, seed: 11 });
  rain(C, 10105, 40);
  sparks(C, 10107, 10);
  return C.toArt();
}
