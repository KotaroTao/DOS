import { sphere, ellipsoid, cone, tube, cyl, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, rand, fangs, ribbon, slab } from "../sdf.mjs";
import { STAIR, PUDDLE, TOWER, RIM, BOLT, towerFloor, bolt2d, crackle, sparks, rain } from "../storm.mjs";
export const meta = { id: "bs_tempestserpent", key: "hd_tempestserpent", w: 96, h: 96,
  note: "嵐の蛇竜: 塔の折れた柱に幾重にも巻きつく、雷を帯びた長い蛇竜。黒い鱗の継ぎ目と背びれに沿って稲光が走り、鎌首をもたげて口を大きく開く。雷の牙で続けざまに二度噛みつき (2連撃)、噛まれた者は痺れて動けなくなる (麻痺・多用)" };
export function build() {
  const mats = {
    scale: { ramp: ramp(["#020306", "#06080f", "#0c0f1a", "#141927", "#1e2436", "#2a3248", "#38425e", "#4a5678"], 8), spec: 1.1, pow: 34, specCol: "#a8b8f0", dither: 0.5,
      shade: p => 0.08 * Math.sin(p.x * 2.2) * Math.sin(p.y * 2.2) },
    belly: { ramp: ramp(["#0a0a0e", "#1c1c26", "#30303e", "#46465a", "#5e5e76"], 5), dither: 0.5, amb: 0.25 },
    fin: { ramp: ramp(["#050512", "#0e0e28", "#1c1e48", "#2e3470", "#4652a0"], 5), dither: 0.5, amb: 0.3 },
    maw: { ramp: ["#000000", "#0a0a1e", "#20245a"], amb: 0.05, dif: 0.2, noRim: true },
    eye: { ramp: [BOLT[2], BOLT[3], BOLT[4]], emit: () => 0.95 },
    stair: STAIR, puddle: PUDDLE, tower: TOWER,
  };
  // 折れた柱
  const pillar = Disp(cyl([62, 92, -8], [62, 22, -8], 7, "tower", 0.6), (x, y, z) => 0.3 * Math.abs(Math.sin(Math.atan2(z + 8, x - 62) * 8)) + (y < 28 ? (28 - y) * (0.5 + 0.6 * fbm(x * 0.5, z * 0.5)) : 0));
  // 柱に巻きつく胴 (前を通る所は z+、後ろは z−)
  const spine = [];
  for (let i = 0; i <= 28; i++) {
    const t = i / 28, a = t * Math.PI * 4.2, y = 88 - t * 52;
    spine.push([62 + Math.cos(a + Math.PI / 2) * 13, y, -8 + Math.sin(a + Math.PI / 2) * 11, 4.6 - t * 1]);
  }
  spine.push([46, 30, 8, 3.6], [38, 24, 12, 3.4], [32, 22, 14, 3.2]);
  const body = Paint(tube(spine, "scale", { seg: 3 }), (x, y, z, m) => m === "scale" && z > 1 && Math.sin(x * 0.4 + y * 0.9) > 0.55 ? "belly" : m);
  const head = U(1.2, ellipsoid([26, 20, 15], [10, 6, 7], "scale", -10), ellipsoid([16, 24, 16], [8, 3.6, 5.4], "scale", 15));
  const jaw = ellipsoid([17, 32, 15], [8, 2.8, 4.6], "scale", 24);
  const maw = ellipsoid([16, 28, 19], [8, 3, 3.4], "maw", 18);
  const horns = [cone([30, 15, 12], [42, 4, 8], 2.2, 0.3, "fin"), cone([28, 15, 17], [36, 2, 17], 2, 0.3, "fin")];
  const eye = sphere([25, 17.6, 20.6], 1.4, "eye");
  // 背びれ (首から)
  const finPoly = [[24, 17], [30, 10], [34, 18], [40, 14], [44, 24], [52, 22], [50, 32], [30, 26]];
  const fin = slab(finPoly, 6, 0.6, "fin", 0.4);
  const scene = U(0, towerFloor(56, 95, 40, 12, { n: 2, seed: 10401, wet: 0.15 }), pillar, Sub(U(1.4, body, head, jaw), maw, 0.4), fin, ...horns, eye);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [14, 30, 26], r: 16, k: 0.4 }] });
  const C = new Canvas(r);
  fangs(C, "maw", 9, 23, { step: 2, top: [2, 3], bot: [1, 2], cols: ["#4a5060", "#a8b0c4", "#eef2ff"], seed: 10403 });
  // 鱗の継ぎ目を走る稲光
  for (let i = 0; i < spine.length - 3; i += 2) { const [x, y, z] = spine[i]; if (z > -2) { C.only(x, y - 3, BOLT[3]); C.only(x + 1, y - 3, BOLT[2]); } }
  // 牙の間に跳ねる稲妻
  bolt2d(C, 8, 32, 2, 52, { seed: 3, jag: 2, branch: 1 });
  bolt2d(C, 8, 27, 0, 12, { seed: 5, jag: 1.6, branch: 0 });
  crackle(C, 10405, ["fin", "scale"], 0.02);
  rain(C, 10407, 40);
  sparks(C, 10409, 12);
  return C.toArt();
}
