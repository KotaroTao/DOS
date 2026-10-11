import { sphere, ellipsoid, cone, tube, box, cyl, torus, U, Sub, Disp, render, ramp, Canvas, fbm, rand, fangs } from "../sdf.mjs";
import { SAND, BLOOD, ASHBED, STONE, IRON, RIM, sandFloor, chain, ashfall, slashArc, sandDust, spikes } from "../arena.mjs";
export const meta = { id: "bs_arenabeast", key: "hd_arenabeast", w: 96, h: 96,
  note: "闘獣: 見世物のために飢えさせられた、牛ほどもある大きな獣。灰色の毛皮は鞭の傷で縞になり、首には引きちぎった鎖の輪と垂れた鎖。後ろ脚で立ち上がり、左右の前足の爪と牙で一度に三度襲いかかる (三連撃) — 三筋の爪痕が空を裂く。手負いで荒れ狂う (激昂)" };
export function build() {
  const mats = {
    fur: { ramp: ["#040404", "#0e0d0c", "#1a1816", "#282522", "#373330", "#48433f", "#5c5652"], dither: 0.6, amb: 0.24,
      shade: p => (Math.sin(p.y * 0.9 + p.x * 0.5 + 2 * fbm(p.x * 0.2, p.y * 0.2)) > 0.86 ? -0.22 : 0) + 0.08 * fbm(p.x * 0.6, p.y * 0.6, p.z * 0.6) },
    belly: { ramp: ["#060504", "#151210", "#26201c", "#383029", "#4c4238"], dither: 0.6 },
    scar: { ramp: ["#120606", "#2a0e0c", "#481a16", "#6a2a22"], dither: 0.4 },
    claw: { ramp: ["#100e0a", "#3a352a", "#7a7262", "#c8c0a8"], spec: 1, pow: 20, dither: 0.3 },
    maw: { ramp: ["#000000", "#1a0606", "#3e1010"], dither: 0.3 },
    eye: { ramp: ["#5a2a06", "#c8761a", "#ffd27a"], emit: () => 0.9 },
    sand: SAND, blood: BLOOD, ashbed: ASHBED, stone: STONE, iron: IRON,
  };
  // 後ろ脚で立ち上がる (頭は左上)
  const torso = Disp(U(4, ellipsoid([56, 52, 0], [14, 18, 12], "fur", 22), ellipsoid([62, 70, 0], [12, 10, 11], "fur"), ellipsoid([46, 34, 2], [12, 10, 11], "fur", 30)), (x, y, z) => 0.5 * fbm(x * 0.4, y * 0.4, z * 0.4));
  const belly = ellipsoid([50, 56, 8], [7, 12, 4], "belly", 22);
  const head = Disp(U(2, ellipsoid([34, 26, 6], [9, 8, 8], "fur", 10), ellipsoid([24, 30, 8], [7, 5, 6], "fur", 18)), (x, y, z) => 0.4 * fbm(x * 0.5, y * 0.5, z * 0.5));
  const maw = ellipsoid([20, 32, 10], [6, 2.6, 4], "maw", 22);
  const ears = spikes([[[36, 20, 2], [40, 12, -2], 2.2], [[30, 20, 4], [28, 13, 2], 2]], "fur");
  // 前足 (左右に振り上げる)
  const armA = tube([[46, 38, 8, 5], [32, 46, 12, 4], [20, 50, 14, 3]], "fur");
  const armB = tube([[50, 30, 4, 5.4], [46, 16, 8, 4.2], [36, 10, 10, 3.4]], "fur");
  const clawsA = spikes([[[18, 48, 14], [10, 46, 15], 1, 0.2], [[18, 51, 15], [10, 52, 16], 1, 0.2], [[19, 53, 13], [12, 57, 14], 1, 0.2]], "claw");
  const clawsB = spikes([[[33, 8, 10], [27, 2, 12], 1, 0.2], [[35, 7, 11], [32, 0, 12], 1, 0.2], [[37, 7, 10], [37, 0, 11], 1, 0.2]], "claw");
  // 後ろ脚と尾
  const legs = [tube([[58, 72, 8, 6], [52, 82, 10, 4], [50, 92, 8, 3]], "fur"), tube([[66, 72, -6, 6], [72, 82, -4, 4], [72, 92, -4, 3]], "fur")];
  const feet = [ellipsoid([47, 92, 10], [4, 2, 3], "fur"), ellipsoid([75, 92, -2], [4, 2, 3], "fur")];
  const tail = tube([[72, 72, -4, 3.4], [84, 80, -6, 2.4], [92, 88, -6, 1.6], [94, 94, -4, 1]], "fur");
  // 鞭の傷 (赤い筋)
  const scars = [tube([[62, 44, 11, 0.8], [66, 50, 10, 0.8], [70, 58, 8, 0.7]], "scar"), tube([[56, 40, 12, 0.7], [58, 48, 12, 0.7]], "scar"), tube([[66, 64, 10, 0.7], [70, 70, 9, 0.7]], "scar")];
  // 引きちぎった鎖の首輪と垂れた鎖
  const collar = torus([42, 38, 4], 10, 1.6, "iron", 25, 70);
  const links = chain([50, 46, 12], [56, 64, 14], 1.5, "iron", 0.55);
  const eye = sphere([30, 23, 12.4], 1.1, "eye");
  const scene = U(0, sandFloor(56, 95, 44, 13, { seed: 11301, blood: 0.18, ash: 0.05, flags: 1 }), Sub(U(2, torso, head, armA, armB, ...legs, ...feet, tail, ...ears), maw, 0.4), belly, ...scars, ...clawsA, ...clawsB, collar, ...links, eye);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  fangs(C, "maw", 15, 25, { step: 2, top: [2, 3], bot: [1, 2], cols: ["#3a352a", "#a8a088", "#e8e0c8"], seed: 11303 });
  // 三筋の爪痕
  for (let i = 0; i < 3; i++) slashArc(C, 64, 44, 48 + i * 5, 2.35, 2.85, { w: 1.6, cols: ["#3a1210", "#7a2a22", "#c86a50", "#f0c0a0"] });
  sandDust(C, 11305, 40, [20, 82, 70, 12]);
  ashfall(C, 11307, 40);
  return C.toArt();
}
