import { sphere, ellipsoid, cone, tube, box, U, Sub, Disp, render, Canvas, fbm, rand, fangs } from "../sdf.mjs";
import { BED, ROCK, GLASS, FRAME, MURKGLASS, RIM, cavernFloor, spikes, soot, murkMotes, shards, afterimage } from "../cavern.mjs";
export const meta = { id: "bs_blindhorror", key: "hd_blindhorror", w: 96, h: 96,
  note: "盲いた深淵獣: 光の届かない底で目を失った、やせた大きな獣。青白い灰の皮に肋骨と背骨が浮き、目のあった所はなめらかな皮でふさがる。かわりに頭の左右に大きな耳が二つずつ、計四つ立ち、内側は薄い桃色。前脚を低く折って尻を上げた、跳びかかる直前の構え。裂けた口に長い牙 (痛撃・多用)、素早い (俊敏) — かすかな残像" };
export function build() {
  const mats = {
    skin: { ramp: ["#060606", "#121211", "#201f1e", "#302f2d", "#43423f", "#585754", "#706f6b", "#8c8b86", "#a6a59f"], dither: 0.5, amb: 0.24,
      shade: p => 0.05 * fbm(p.x * 0.6, p.y * 0.6, p.z * 0.6) },
    ear: { ramp: ["#120a0c", "#2c1a1e", "#4a2e34", "#6a4650", "#8a6470", "#a8848e"], dither: 0.4, amb: 0.3 },
    maw: { ramp: ["#000000", "#1a0608", "#36100e"], dither: 0.3 },
    bed: BED, rock: ROCK, glass: GLASS, frame: FRAME, murk: MURKGLASS,
  };
  // 肋骨の浮いた胴 (前が低く、後ろが高い)
  const ribs = (x, y, z) => (x > 36 && x < 62 ? -0.55 * Math.max(0, Math.sin((x - 36) * 0.85)) * Math.max(0, (y - 48) / 14) : 0) + 0.15 * fbm(x * 0.5, y * 0.5, z * 0.5);
  const torso = Disp(U(4, ellipsoid([50, 58, 0], [18, 9, 10], "skin", 14), ellipsoid([70, 50, -1], [10, 9, 9], "skin", 10), ellipsoid([33, 64, 2], [9, 8, 9], "skin")), ribs);
  const spine = [];
  for (let i = 0; i < 10; i++) spine.push(sphere([30 + i * 5, 54 - i * 1.6 + (i > 6 ? 1 : 0), 1], 2.4, "skin"));
  const neck = tube([[34, 62, 3, 6], [24, 68, 5, 5], [16, 72, 6, 4.4]], "skin");
  const head = U(2, ellipsoid([14, 72, 7], [8, 6, 7], "skin", 12), ellipsoid([5, 77, 9], [6, 3.6, 5], "skin", 24));
  const jaw = ellipsoid([6, 81, 9], [6, 2, 4], "skin", 20);
  const maw = ellipsoid([4, 79, 12], [6, 1.8, 4], "maw", 22);
  // 四つの耳 (左右に二つずつ、外へ大きく開く)
  const earPolys = [[[16, 67, 10], [10, 52, 14], 3.4], [[19, 66, 8], [22, 50, 8], 3.6], [[13, 68, 2], [4, 56, 0], 3], [[18, 67, 2], [28, 54, -2], 3.2]];
  const ears = earPolys.map(([a, b, r]) => U(0.5, cone(a, b, r, 0.6, "skin"), cone([a[0], a[1], a[2] + 0.8], [b[0], b[1] + 1.4, b[2] + 0.8], r * 0.62, 0.3, "ear")));
  const legs = [tube([[34, 66, 6, 4], [26, 78, 10, 3], [22, 92, 10, 2.4]], "skin"), tube([[38, 66, -4, 4], [30, 80, -6, 3], [30, 92, -6, 2.2]], "skin"),
    tube([[70, 54, 6, 5.4], [80, 70, 8, 3.6], [74, 82, 8, 2.6], [76, 92, 8, 2]], "skin"), tube([[72, 52, -6, 5], [84, 66, -6, 3.4], [84, 80, -6, 2.4], [88, 92, -6, 1.8]], "skin")];
  const claws = spikes([[[22, 92, 12], [16, 93, 13], 1, 0.2], [[22, 92, 9], [16, 94, 9], 1, 0.2], [[76, 92, 10], [70, 93, 10], 0.9, 0.2]], "skin");
  const tail = tube([[78, 46, -2, 2.6], [88, 40, -3, 1.8], [94, 30, -3, 1]], "skin");
  const scene = U(0, cavernFloor(48, 95, 46, 13, { seed: 12601, rocks: 3, lamps: 2 }), Sub(U(1.6, torso, ...spine, neck, head, jaw, ...legs, tail, ...ears), maw, 0.3), ...claws);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  fangs(C, "maw", 0, 9, { step: 2, top: [2, 3], bot: [2, 3], cols: ["#3a3630", "#a8a28a", "#e8e2c8"], seed: 12603 });
  afterimage(C, [[5, -1, 0.3, "#1b1b1a"], [10, -2, 0.18, "#121211"]], [0, 30, 96, 66]);
  murkMotes(C, 12605, 14, [20, 6, 70, 40]);
  shards(C, 12607, ["bed"], 14);
  soot(C, 12609, 36);
  return C.toArt();
}
