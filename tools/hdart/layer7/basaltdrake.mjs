import { sphere, ellipsoid, cone, tube, cyl, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand, fangs } from "../sdf.mjs";
import { BASALT, CRUST, LAVA, RIM, lavaFloor, underglow, embers } from "../lava.mjs";
export const meta = { id: "bs_basaltdrake", key: "hd_basaltdrake", w: 96, h: 96,
  note: "玄武岩の竜: 四肢を踏ん張って低く構える、翼のない重い竜。背には六角の玄武岩の柱が鱗のように何本も突き立ち、刃をほとんど通さない。灰白に光る両眼でにらみつけると、見られた者は冷えた溶岩のように灰色に固まっていく。足元には石になりかけた獲物の腕" };
export function build() {
  const mats = {
    hide: { ramp: ramp(["#020202", "#080707", "#111010", "#1b1918", "#262321", "#322e2b", "#413c38"], 7), spec: 0.4, pow: 18, dither: 0.55,
      shade: p => 0.12 * fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5) },
    column: { ramp: ramp(["#030303", "#0c0b0b", "#181716", "#262423", "#363331", "#4a4643", "#625d59"], 7), spec: 0.6, pow: 22, dither: 0.45 },
    eye: { ramp: ["#4a4c50", "#9a9ea8", "#dce0e8", "#ffffff"], noRim: true, emit: () => 0.9 },
    stone: { ramp: ramp(["#0c0c0c", "#262626", "#424242", "#606060", "#828282"], 5), spec: 0.2, dither: 0.5 },
    maw: { ramp: ["#120402", "#4a0e04", "#a8300a"], noRim: true, emit: p => 0.25 + 0.4 * Math.max(0, p.nz) },
    basalt: BASALT, crust: CRUST, lava: LAVA,
  };
  // 低い胴、太い脚、前へ突き出た重い頭 (左向き)
  const torso = ellipsoid([56, 56, 0], [26, 13, 13], "hide", -4);
  const neck = tube([[36, 56, 3, 9], [26, 58, 6, 7]], "hide");
  const skull = ellipsoid([20, 58, 7], [9, 7, 7], "hide", 6);
  const snout = cone([16, 60, 8], [5, 63, 9], 5.4, 3.4, "hide");
  const jaw = cone([16, 66, 8], [6, 68, 9], 3.6, 2.2, "hide");
  const maw = ellipsoid([10, 65.5, 11], [6, 1.6, 3], "maw", 12);
  const legs = [tube([[34, 62, 8, 6.4], [30, 74, 10, 5], [28, 86, 10, 5]], "hide"), tube([[40, 62, -8, 6], [40, 74, -8, 4.6], [38, 86, -8, 4.6]], "hide"),
    tube([[72, 62, 8, 7], [76, 74, 9, 5.4], [74, 86, 9, 5]], "hide"), tube([[78, 60, -8, 6.4], [82, 72, -8, 5], [82, 86, -8, 4.6]], "hide")];
  const tail = tube([[80, 54, -2, 7], [90, 60, -2, 4.4], [95, 70, 0, 2.4]], "hide");
  const brow = ellipsoid([20, 53.5, 11], [7, 2.2, 4], "hide", 8);
  const drake = Disp(U(3, torso, neck, skull, snout, jaw, ...legs, tail, brow), (x, y, z) => 0.6 * Math.pow(1 - Math.abs(vnoise(x * 0.25, y * 0.25, z * 0.25)), 6) + 0.2 * fbm(x * 0.6, y * 0.6, z * 0.6));
  // 背の六角柱 (玄武岩の柱状節理)
  const R = rand(8801);
  const cols = [];
  for (let i = 0; i < 16; i++) {
    const t = i / 15, x = 30 + t * 54 + (R() - 0.5) * 3, z = (R() - 0.5) * 14;
    const top = 48 - 10 * Math.sin(t * Math.PI) - Math.abs(z) * 0.1;
    const h = 8 + 10 * Math.sin(t * Math.PI) * (0.6 + R() * 0.5);
    cols.push(cyl([x, top + 4, z], [x + (R() - 0.5) * 2, top - h, z], 2.2 + R() * 0.8, "column", 0.3));
  }
  const eyes = [sphere([17, 56.5, 13], 1.4, "eye"), sphere([22.5, 56, 13.4], 1.3, "eye")];
  // 足元の石になりかけた腕
  const arm = U(1, tube([[12, 88, 12, 1.8], [18, 86, 13, 1.6], [22, 87, 13, 1.3]], "stone"), sphere([11, 87, 12], 2, "stone"));
  const scene = U(0, lavaFloor(50, 92, 46, 13, { n: 3, seed: 8803 }), Sub(drake, maw, 0.4), ...cols, ...eyes, arm);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, inner: 2.5 });
  const C = new Canvas(r);
  // 六角柱の頭の面を明るく (切り口)
  for (let y = 1; y < 96; y++) for (let x = 0; x < 96; x++) { const p = C.pix[y * 96 + x]; if (p && p.m === "column" && p.ny < -0.7) C.set(x, y, "#625d59"); }
  fangs(C, "maw", 6, 16, { step: 2, top: [1, 2], bot: [1, 2], cols: ["#3a3632", "#8a847c", "#c8c0b4"], seed: 8805 });
  // にらむ眼から放つ灰白の光の筋
  const GZ = ["#3a3c40", "#6a6e76", "#a8acb4"];
  for (const [ex, ey] of [[16, 57], [22, 56]]) for (let k = 0; k < 3; k++) {
    const a = Math.PI * (0.9 + k * 0.08);
    for (let d = 3; d < 16; d++) { const x = Math.round(ex + Math.cos(a) * d), y = Math.round(ey + Math.sin(a) * d * 0.5 - k); if (!C.get(x, y) && d % 2 === 0) C.set(x, y, GZ[d < 7 ? 2 : d < 11 ? 1 : 0]); }
  }
  C.set(16, 56, "#ffffff"); C.set(22, 55, "#ffffff");
  underglow(C, { skip: ["eye", "maw"] });
  embers(C, 8807, 20, [4, 2, 88, 40]);
  return C.toArt();
}
