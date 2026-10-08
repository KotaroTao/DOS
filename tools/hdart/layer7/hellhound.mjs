import { sphere, ellipsoid, cone, tube, torus, U, Sub, Disp, render, ramp, Canvas, fbm, vnoise, rand, fangs } from "../sdf.mjs";
import { BASALT, CRUST, LAVA, RIM, EMBER, lavaFloor, underglow, embers, flame2d, afterimage } from "../lava.mjs";
export const meta = { id: "bs_hellhound", key: "hd_hellhound", w: 96, h: 96,
  note: "業火の番犬: 釜場を守る、黒い肌の大きな猟犬。首には千切れた鎖の首輪、背と首筋のたてがみは燃え盛る炎。前脚を突っ張って大口を開け、喉の奥から炎を吐きかける。駆けてきた後ろには目にも止まらぬ速さの残像が尾を引く" };
export function build() {
  const mats = {
    hide: { ramp: ramp(["#020101", "#080404", "#120707", "#1c0b0a", "#28100d", "#361612", "#461d17"], 7), spec: 0.6, pow: 20, specCol: "#8a4a3a", dither: 0.55,
      shade: p => 0.08 * fbm(p.x * 0.7, p.y * 0.7, p.z * 0.7) },
    iron: { ramp: ramp(["#040404", "#101012", "#1e1e22", "#30303a", "#484854", "#686876"], 6), spec: 1.1, pow: 30, specCol: "#b0b0c0", dither: 0.4 },
    eye: { ramp: ["#7a4a04", "#f0b020", "#fff0a0"], emit: () => 0.9 },
    maw: { ramp: ["#140402", "#4a0e04", "#a8300a", "#f07a1c"], noRim: true, emit: p => 0.25 + 0.55 * Math.max(0, p.nz) },
    claw: { ramp: ["#0c0808", "#3a302c", "#8a7a70"], spec: 1, pow: 30, dither: 0.3 },
    basalt: BASALT, crust: CRUST, lava: LAVA,
  };
  // 前脚を突っ張り、頭を前へ突き出して炎を吐く (左向き)
  const chest = ellipsoid([44, 50, 2], [12, 13, 10], "hide", 20);
  const barrel = ellipsoid([60, 48, 0], [15, 10, 9], "hide", -4);
  const haunch = ellipsoid([74, 48, -1], [9, 11, 9], "hide", 20);
  const neck = tube([[42, 44, 3, 8], [32, 42, 5, 6.4], [26, 44, 6, 5.4]], "hide");
  const skull = ellipsoid([22, 44, 7], [7, 6, 6], "hide", 5);
  const snout = cone([18, 44, 8], [7, 45, 9], 4.2, 2.4, "hide");
  const jaw = cone([18, 50, 8], [8, 56, 9], 3, 1.6, "hide");
  const maw = ellipsoid([12, 50, 10], [7, 3, 3.6], "maw", 28);
  const ears = [cone([24, 39, 3], [30, 30, 1], 2.6, 0.3, "hide"), cone([22, 39, 10], [26, 30, 11], 2.4, 0.3, "hide")];
  const legs = [
    tube([[40, 58, 8, 4.4], [34, 70, 9, 3], [28, 82, 10, 2.4], [24, 86, 10, 2]], "hide", { seg: 3 }),
    tube([[46, 58, -6, 4], [44, 70, -6, 2.8], [40, 82, -6, 2.2], [36, 86, -6, 1.8]], "hide", { seg: 3 }),
    tube([[74, 54, 6, 5.6], [82, 64, 7, 3.4], [80, 76, 7, 2.4], [86, 86, 7, 2]], "hide", { seg: 3 }),
    tube([[74, 54, -6, 5], [78, 66, -6, 3], [76, 78, -6, 2.2], [80, 86, -6, 1.8]], "hide", { seg: 3 }),
  ];
  const tail = tube([[82, 44, -1, 2.4], [88, 38, -2, 1.6], [91, 30, -3, 0.8]], "hide");
  const hound = Disp(U(2.5, chest, barrel, haunch, neck, skull, snout, jaw, ...ears, ...legs, tail), (x, y, z) => 0.25 * fbm(x * 0.6, y * 0.6, z * 0.6) + (x > 30 && x < 70 && y > 40 && y < 56 ? -0.5 * Math.max(0, Math.sin(x * 1.1)) * 0.5 : 0));
  const head = Sub(hound, maw, 0.4);
  // 鎖の首輪と千切れた鎖
  const collar = torus([36, 44, 4], 7, 1.4, "iron", 70, 80);
  const chain = [];
  for (let i = 0; i < 4; i++) chain.push(torus([38 + i * 2.4, 52 + i * 3.6, 9], 1.6, 0.6, "iron", 20 + i * 50, i % 2 ? 0 : 90));
  const eyes = [sphere([19, 41.5, 11.5], 1.1, "eye"), sphere([24, 41, 11], 1, "eye")];
  const claws = [cone([24, 86, 12], [20, 88, 13], 0.8, 0.2, "claw"), cone([86, 86, 9], [82, 88, 10], 0.8, 0.2, "claw")];
  const scene = U(0, lavaFloor(54, 92, 42, 13, { n: 3, seed: 8201 }), head, collar, ...chain, ...eyes, ...claws);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  fangs(C, "maw", 7, 17, { step: 2, top: [2, 3], bot: [2, 3], cols: ["#5c5040", "#c8b898", "#f4ecd8"], seed: 8203 });
  C.set(18, 41, "#fff0a0");
  // 燃えるたてがみ: 首筋から背へ
  for (const [x, y, w, h, s] of [[30, 40, 3, 10, 1], [36, 41, 3.5, 13, 2], [42, 40, 3.5, 14, 3], [48, 40, 3, 12, 4], [54, 40, 3, 10, 5], [60, 40, 2.5, 8, 6], [66, 40, 2.5, 7, 7]]) flame2d(C, x, y, w, h, { seed: s, own: ["hide"], lean: 0.6 });
  // 吐き出す炎: 口から左下へ広がる扇
  const FL = ["#7a1a06", "#c43e0c", "#f07a1c", "#ffc04a", "#fff0b0"];
  const BY = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  for (let y = 40; y < 80; y++) for (let x = 0; x < 14; x++) {
    if (C.get(x, y)) continue;
    const dx = 10 - x, dy = y - 52; if (dx < 0) continue;
    const spread = 2 + dx * 0.7, v = (1 - Math.abs(dy - dx * 0.5) / spread) * (1 - dx / 14) + 0.25 * fbm(x * 0.4, y * 0.4, 4);
    if (v > (BY[y & 3][x & 3] + 0.5) / 16 * 0.7) C.set(x, y, FL[Math.max(0, Math.min(4, Math.floor(v * 5)))]);
  }
  afterimage(C, ["hide"], [[10, -1, 2], [19, -1, 3]]);
  underglow(C, { skip: ["eye", "maw"] });
  embers(C, 8205, 26, [4, 2, 88, 50]);
  return C.toArt();
}
