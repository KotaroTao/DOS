import { sphere, ellipsoid, cone, tube, slab, U, Sub, Disp, render, ramp, Canvas, fbm, vnoise, rand, fangs } from "../sdf.mjs";
import { BASALT, CRUST, LAVA, RIM, lavaFloor, underglow, embers } from "../lava.mjs";
export const meta = { id: "bs_flamedrake", key: "hd_flamedrake", w: 96, h: 96,
  note: "炎の幼竜: 朱色の鱗のまだ若い火竜が後ろ脚で立ち上がり、皮膜の翼を大きく広げる。長い首をしならせて大口を開け、喉の奥から炎の奔流を前へ吐きかける。腹は淡い橙の蛇腹、背には小さな棘の列、尾は床をむち打つ" };
export function build() {
  const mats = {
    scale: { ramp: ramp(["#050101", "#140303", "#260605", "#3a0a07", "#52100a", "#6c180c", "#88220f", "#a83014"], 8), spec: 0.9, pow: 26, specCol: "#e08050", dither: 0.5,
      shade: p => 0.12 * Math.abs(Math.sin(p.x * 1.4) * Math.sin(p.y * 1.4)) },
    belly: { ramp: ramp(["#140802", "#3a1a06", "#6a320c", "#9a5216", "#c87a26"], 5), spec: 0.6, pow: 20, dither: 0.45,
      shade: p => (Math.sin(p.y * 1.6) > 0.6 ? -0.15 : 0) },
    wing: { ramp: ramp(["#060102", "#140405", "#22080a", "#320c0c", "#441210"], 5), dither: 0.6, amb: 0.35, spec: 0.3 },
    horn: { ramp: ["#140e08", "#3e3020", "#7a6644", "#c8b688"], spec: 1, pow: 30, dither: 0.35 },
    eye: { ramp: ["#7a4a04", "#f0c020", "#fff4a0"], emit: () => 0.9 },
    maw: { ramp: ["#140402", "#5a1004", "#c43e0c", "#ffae3a"], noRim: true, emit: p => 0.3 + 0.6 * Math.max(0, p.nz) },
    basalt: BASALT, crust: CRUST, lava: LAVA,
  };
  // 立ち上がった胴と、左へしなる首
  const torso = ellipsoid([56, 56, 0], [12, 17, 10], "scale", -12);
  const bellyS = ellipsoid([53, 58, 6], [8, 14, 6], "belly", -12);
  const neck = tube([[52, 42, 2, 7], [44, 32, 4, 5.4], [34, 30, 6, 4.6], [26, 34, 7, 4.2]], "scale", { seg: 4 });
  const skull = ellipsoid([22, 34, 8], [6.4, 5, 5], "scale", 10);
  const snout = cone([18, 35, 9], [8, 38, 10], 3.6, 2, "scale");
  const jaw = cone([18, 40, 9], [9, 45, 10], 2.6, 1.4, "scale");
  const maw = ellipsoid([12, 41, 11], [6, 2.4, 3.2], "maw", 22);
  const horns = [cone([24, 30, 5], [32, 22, 2], 1.8, 0.3, "horn"), cone([22, 30, 11], [28, 22, 12], 1.6, 0.3, "horn")];
  const legs = [tube([[60, 68, 6, 6], [56, 78, 8, 4.4], [60, 86, 8, 3.4]], "scale", { seg: 3 }), tube([[62, 68, -6, 5.6], [66, 78, -6, 4], [66, 86, -6, 3.2]], "scale", { seg: 3 })];
  const arms = [tube([[48, 50, 8, 3], [42, 56, 11, 2.2], [40, 62, 12, 1.6]], "scale"), tube([[54, 48, -4, 2.8], [48, 54, -4, 2], [46, 58, -4, 1.4]], "scale")];
  const tail = tube([[64, 70, -2, 5], [76, 80, -2, 3.6], [86, 86, 0, 2.4], [92, 82, 2, 1.2], [94, 76, 2, 0.4]], "scale", { seg: 4 });
  const spine = [];
  for (let i = 0; i < 9; i++) { const t = i / 8, x = 50 + t * 14, y = 42 + t * 26; spine.push(cone([x + 4, y, -2], [x + 9, y - 3, -3], 1.6, 0.2, "horn")); }
  const drake = Disp(U(2.4, torso, neck, skull, snout, jaw, ...legs, ...arms, tail), (x, y, z) => 0.2 * fbm(x * 0.8, y * 0.8, z * 0.8));
  // 皮膜の翼 (広げる)
  const wingL = slab([[50, 40], [40, 18], [30, 6], [26, 14], [20, 12], [22, 22], [16, 24], [26, 34], [38, 38]], -6, 0.6, "wing", 0.4);
  const wingR = slab([[60, 40], [72, 14], [86, 2], [88, 14], [94, 16], [90, 26], [94, 34], [80, 38], [70, 46]], -8, 0.6, "wing", 0.4);
  const bones = [tube([[50, 40, -5, 1.8], [40, 18, -6, 1.2], [30, 6, -6, 0.5]], "scale"), tube([[60, 40, -7, 1.8], [72, 14, -8, 1.2], [86, 2, -8, 0.5]], "scale")];
  const eye = sphere([22, 32, 12.4], 1.1, "eye");
  const scene = U(0, lavaFloor(56, 92, 40, 12, { n: 3, seed: 8501 }), Sub(drake, maw, 0.4), bellyS, ...horns, ...spine, wingL, wingR, ...bones, eye);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  fangs(C, "maw", 8, 16, { step: 2, top: [2, 2], bot: [1, 2], cols: ["#5c5040", "#c8b898", "#f4ecd8"], seed: 8503 });
  C.set(21, 31, "#fff4a0");
  // 炎の奔流: 口から左下へ扇状に
  const FL = ["#7a1a06", "#c43e0c", "#f07a1c", "#ffc04a", "#fff0b0"];
  const BY = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  for (let y = 30; y < 84; y++) for (let x = 0; x < 14; x++) {
    if (C.get(x, y)) continue;
    const dx = 12 - x, dy = y - 42; if (dx < 0) continue;
    const spread = 2 + dx * 0.9, v = (1 - Math.abs(dy - dx * 0.9) / spread) * (1.1 - dx / 16) + 0.3 * fbm(x * 0.4, y * 0.4, 5);
    if (v > (BY[y & 3][x & 3] + 0.5) / 16 * 0.7) C.set(x, y, FL[Math.max(0, Math.min(4, Math.floor(v * 5)))]);
  }
  underglow(C, { skip: ["eye", "maw"] });
  embers(C, 8505, 26, [4, 2, 88, 60]);
  return C.toArt();
}
