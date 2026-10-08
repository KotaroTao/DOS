import { sphere, ellipsoid, cone, tube, slab, U, Sub, Disp, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { BASALT, CRUST, LAVA, RIM, lavaFloor, underglow, embers } from "../lava.mjs";
export const meta = { id: "bs_magmaray", key: "hd_magmaray", w: 96, h: 96,
  note: "溶岩のエイ: 溶岩の海の上を、大きな翼のような胸びれを左右いっぱいに広げて滑るエイ。背は黒い岩肌に赤い斑点、ひれの縁は赤熱して光り、頭の前には二本の頭びれ。鞭のように長い尾の先で黄色い稲妻がはじけ (触れれば痺れる)、ひれの下では溶岩が波立つ" };
export function build() {
  const mats = {
    hide: { ramp: ramp(["#030102", "#0a0405", "#140708", "#200b0b", "#2e100e", "#3e1612", "#521e16", "#6a281c"], 8), spec: 0.9, pow: 26, specCol: "#a86048", dither: 0.55,
      shade: p => (vnoise(p.x * 0.4, p.y * 0.4, 2) > 0.5 ? 0.22 : 0) + 0.06 * fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5) },
    eye: { ramp: ["#5a4a04", "#e0c020", "#fff4a0"], emit: () => 0.9 },
    tail: { ramp: ramp(["#030102", "#0e0506", "#1c0a0a", "#2c100e", "#3c1612"], 5), spec: 0.6, pow: 20, dither: 0.5 },
    basalt: BASALT, crust: CRUST, lava: LAVA,
  };
  // 正面寄りの斜め上から見た翼: 左右に張り出し、翼端は上へ反る。中央は盛り上がった胴
  const wing = slab([[48, 34], [30, 35], [14, 33], [2, 28], [10, 40], [28, 54], [48, 64], [68, 54], [86, 40], [94, 28], [82, 33], [66, 35]], 0, 2.4, "hide", 2, 4);
  const body = ellipsoid([48, 47, 3], [11, 9, 8], "hide");
  const ray = Disp(U(4, wing, body), (x, y, z) => 0.25 * fbm(x * 0.3, y * 0.3, z * 0.3));
  // 頭びれ (前へ巻き込む二本の角のようなひれ)
  const lobes = [tube([[42, 42, 9, 2.4], [38, 46, 13, 2], [37, 52, 14, 1.4], [39, 55, 13, 0.8]], "hide"), tube([[54, 42, 9, 2.4], [58, 46, 13, 2], [59, 52, 14, 1.4], [57, 55, 13, 0.8]], "hide")];
  const mouth = ellipsoid([48, 52, 10.5], [5, 1.2, 1.5], "tail");
  const eyes = [sphere([41, 44, 10], 1.2, "eye"), sphere([55, 44, 10], 1.2, "eye")];
  const tail = tube([[50, 58, -2, 2.6], [58, 66, -4, 1.6], [70, 72, -4, 1.1], [80, 80, -2, 0.7], [84, 86, 0, 0.45]], "tail", { seg: 4 });
  const scene = U(0, lavaFloor(48, 92, 46, 13, { n: 2, seed: 8101, pool: [48, 2, 34], cracks: 0.8 }), U(2, ray, ...lobes), mouth, ...eyes, tail);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, light: [-0.4, -0.8, 0.5] });
  const C = new Canvas(r);
  // ひれの外周に赤熱の縁
  const isRay = (x, y) => { const p = C.pix[y * 96 + x]; return p && p.m === "hide"; };
  const edge = [];
  for (let y = 1; y < 95; y++) for (let x = 1; x < 95; x++) if (isRay(x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !C.get(x + dx, y + dy))) edge.push([x, y]);
  for (const [x, y] of edge) C.set(x, y, (x + y) % 3 ? "#d24e10" : "#ffae3a");
  C.set(41, 43, "#fff4a0"); C.set(55, 43, "#fff4a0");
  // 尾の先の稲妻
  const LT = ["#5a4a04", "#c8a810", "#ffe040", "#fffcc0"];
  const R = rand(8103);
  for (let b = 0; b < 4; b++) {
    let x = 84, y = 86;
    for (let i = 0; i < 7; i++) {
      const nx = x + (R() - 0.5) * 6 + (b - 1.5) * 1.4, ny = y - 1.5 - R() * 2.5;
      C.line(x, y, nx, ny, LT[i < 2 ? 3 : i < 4 ? 2 : 1]); x = nx; y = ny;
    }
  }
  C.disc(84, 86, 1.4, "#fffcc0");
  // ひれの下で波立つ溶岩の飛沫
  for (let i = 0; i < 18; i++) { const x = 14 + R() * 70, y = 66 + R() * 18; if (!C.get(Math.round(x), Math.round(y))) C.set(x, y, ["#a8300a", "#f07a1c", "#ffae3a"][Math.floor(R() * 3)]); }
  underglow(C, { k: 1.6, skip: ["eye"] });
  embers(C, 8105, 22, [4, 2, 88, 24]);
  return C.toArt();
}
