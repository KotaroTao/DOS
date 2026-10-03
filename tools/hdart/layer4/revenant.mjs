import { sphere, ellipsoid, cone, slab, cyl, box, torus, tube, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { FLAG, STONE, RIM, flagstones } from "../fort.mjs";
export const meta = { id: "d04_revenant", key: "hd_revenant", w: 96, h: 96,
  note: "亡霊騎士: 誇り高く敗れた騎士の霊が宿る淡い銀青の鎧。継ぎ目という継ぎ目から青白い霊光が滲み、割れた兜の奥で光が明滅する。ぼろぼろの陣羽織と千切れた外套、切っ先を床に下ろし柄頭に両手を重ねた誓いの構え。足元は霊気の靄にほどける" };
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
export function build() {
  const mats = {
    plate: { ramp: ramp(["#04060a", "#0a1018", "#131c28", "#1c2836", "#283646", "#364658", "#48596e", "#5e7188", "#7c8ea4"], 9), spec: 1.5, pow: 40, specCol: "#c8dcec", dither: 0.45, amb: 0.16,
      shade: p => 0.08 * fbm(p.x * 0.3, p.y * 0.3, p.z * 0.3) },
    tabard: { ramp: ramp(["#030507", "#071014", "#0c1a20", "#12252c", "#1a323a", "#244048", "#304e56"], 7), dither: 0.7, amb: 0.2,
      shade: p => 0.12 * Math.sin(p.x * 0.9 + p.y * 0.06) + 0.08 * fbm(p.x * 0.4, p.y * 0.4) },
    cape: { ramp: ramp(["#030305", "#08080d", "#0f1018", "#171a24", "#212532"], 5), dither: 0.7, amb: 0.22,
      shade: p => 0.14 * Math.sin(p.x * 0.6 + p.y * 0.05) },
    spirit: { ramp: ["#0c2a36", "#1e5c70", "#4aa0b8", "#9ae0ee", "#e0fcff"], emit: p => 0.5 + 0.5 * Math.max(0, p.nz) + 0.15 * vnoise(p.x * 0.5, p.y * 0.5) },
    void: { ramp: ["#000000", "#000000", "#010204"], amb: 0, dif: 0.05, noRim: true },
    flag: FLAG, stone: STONE,
  };
  // 霊の芯: 鎧の内側を満たす青白い光。継ぎ目からのぞく
  const core = U(1,
    ellipsoid([48, 46, -1], [7.8, 14, 5.4], "spirit"), sphere([51, 14.5, 3], 4.2, "spirit"),
    tube([[39, 33, 0, 2.4], [34, 46, 4, 2.2], [45, 53, 10, 1.8]], "spirit"),
    tube([[57, 33, 0, 2.4], [62, 46, 4, 2.2], [51, 53, 10, 1.8]], "spirit"),
    cyl([48, 24, 1], [48, 30, 1], 3.8, "spirit"));
  // 痩せた胴: 胸甲と腰の段板 (段の間に霊光)
  const breast = U(1, ellipsoid([48, 37, 0.5], [9.4, 8, 6.4], "plate"), ellipsoid([48, 37, 2.6], [1.6, 7.5, 5.6], "plate"));
  const waist = [0, 1].map(i => ellipsoid([48, 47.6 + i * 4.2, 0], [7.2 + i * 0.6, 1.5, 5.6], "plate"));
  // 兜: 頭を垂れた丸兜。右上が砕けて欠け、割れ口は霊光
  const helm = Sub(Sub(U(0.6, ellipsoid([48, 17, 3], [6.6, 7.8, 6.6], "plate", 4), cyl([48, 21, 3], [48, 26, 2], 6, "plate", 1.5)),
    U(0, box([47.6, 19.5, 10], [4.4, 0.8, 3], "void", 0.2, 4), box([47.8, 22.2, 10], [0.9, 2.8, 3], "void", 0.2, 4)), 0.3),
    Disp(sphere([55, 10.5, 6], 5.6, "void"), (x, y, z) => 1.1 * vnoise(x * 0.8, y * 0.8, z * 0.8)), 0.2);
  // 肩当て: 片方は割れて前へ垂れる
  const pauldL = [ellipsoid([38, 31, 1.5], [7.2, 4.4, 6.4], "plate", -22), ellipsoid([37, 34.5, 2.5], [6.2, 3, 5.6], "plate", -26)];
  const pauldR = [Sub(ellipsoid([58, 31, 1.5], [7.2, 4.4, 6.4], "plate", 22), sphere([63, 28, 5], 3.4, "spirit"), 0.3)];
  // 腕: 上腕・前腕の板の間 (肘) に光
  const arms = [cyl([38.5, 35, 2], [35, 44, 4], 3, "plate", 1.1), cyl([34.5, 48.5, 5], [43, 53, 10], 2.7, "plate", 1.1),
    cyl([57.5, 35, 2], [61, 44, 4], 3, "plate", 1.1), cyl([61.5, 48.5, 5], [53, 53, 10], 2.7, "plate", 1.1)];
  const hands = [ellipsoid([45.4, 53.5, 12.4], [2.8, 2.4, 2.4], "plate"), ellipsoid([50.6, 52.6, 13.2], [2.8, 2.4, 2.4], "plate")];
  // 長剣: 柄頭に両手、切っ先は床へ (わずかに傾く)
  const tx = 0.05;
  const sword = U(0, sphere([48.1, 50.2, 13], 1.9, "plate"),
    cyl([48.2, 54, 12.6], [48.4, 58, 12.4], 1.1, "cape"),
    cyl([42, 58.8, 12.4], [54.8, 58.4, 12.4], 1.1, "plate", 0.4),
    slab([[46.6, 60], [50.2, 60], [49.9 + tx * 28, 86], [48.4 + tx * 30, 91], [46.9 + tx * 28, 86]], 12.4, 0.8, "plate", 0.3, 0.4));
  // 陣羽織: 胸から膝下まで、裾は千切れて穴が開く
  const hem = [[39, 44], [57, 44], [60, 58], [62, 72], [59, 70], [58, 78], [55, 73], [53, 82], [50, 75], [47, 84], [44, 74], [41, 79], [39, 70], [35, 73], [36, 58]];
  const tabard = Sub(Disp(slab(hem, 7.5, 0.8, "tabard", 0.6), (x, y, z) => 0.6 * Math.sin(x * 0.8 + 1.4 * fbm(x * 0.2, y * 0.2)) * Math.max(0, (y - 52) / 30)),
    U(0, sphere([42, 64, 8], 1.6, "tabard"), sphere([55, 62, 8], 1.2, "tabard"), sphere([52, 70, 8], 1.4, "tabard")));
  // 千切れた外套: 背で大きく広がり、裾は割れて垂れる
  const capePoly = [[37, 28], [59, 28], [68, 46], [76, 66], [79, 84], [73, 78], [70, 88], [66, 80], [61, 86], [36, 86], [31, 80], [27, 88], [24, 78], [18, 84], [20, 66], [27, 46]];
  const cape = Sub(Disp(slab(capePoly, -6, 1, "cape", 0.8), (x, y, z) => 0.9 * Math.sin(x * 0.5 + 1.6 * fbm(x * 0.15, y * 0.15))),
    U(0, sphere([24, 70, -6], 2, "cape"), sphere([73, 60, -6], 1.7, "cape"), sphere([69, 74, -6], 1.5, "cape")));
  // 脚: 陣羽織の下に脛当て、足先は靄に溶ける
  const legs = [cyl([44, 74, -1], [42.5, 88, 1], 3.4, "plate", 1.3), cyl([52, 74, -1], [54, 88, 0], 3.4, "plate", 1.3),
    ellipsoid([42.8, 79, 3.2], [3, 2, 2.4], "plate"), ellipsoid([53.6, 79, 2.4], [3, 2, 2.4], "plate")];
  const belt = Sub(cyl([48, 44.6, 0], [48, 46.4, 0], 9.2, "cape", 0.4), cyl([48, 43, 0], [48, 48, 0], 7, "cape"));
  const scene = U(0, belt, flagstones(48, 93, 34, 11, { n: 3, seed: 71, big: 2.6 }),
    core, breast, ...waist, helm, ...pauldL, ...pauldR, ...arms, ...hands, sword, tabard, cape, ...legs);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [48, 46, 12], r: 24, k: 0.22 }, { p: [55, 12, 12], r: 12, k: 0.3 }] });
  const C = new Canvas(r);
  // 靄にほどける下半身・外套の裾
  for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) {
    const p = C.pix[y * 96 + x]; if (!p || p.m === "flag" || p.m === "stone" || p.m === "spirit") continue;
    const a = 1.15 - Math.max(0, (y - 74) / 16) * 1.1 + 0.35 * fbm(x * 0.25, y * 0.2, 9);
    if (a < (BAYER[y & 3][x & 3] + 0.5) / 16) C.set(x, y, null);
  }
  // 兜の覗き穴に明滅する霊光
  const S = ["#1e5c70", "#4aa0b8", "#9ae0ee", "#e0fcff"];
  C.set(45, 20, S[1]); C.set(46, 20, S[2]); C.set(47, 20, S[0]); C.set(50, 20, S[1]); C.set(49, 20, S[0]);
  C.set(48, 23, S[0]);
  // 靄: 足元を這う霊気の帯と、立ちのぼる筋
  const R = rand(73);
  const M = ["#0a2230", "#12384a", "#1e5c70", "#4aa0b8"];
  const free = (x, y) => { const p = C.pix[y * 96 + x]; return !C.get(x, y) || !p || p.m === "flag" || p.m === "stone"; };
  for (let y = 70; y < 96; y++) for (let x = 6; x < 90; x++) {
    let v = 0;
    for (const [x0, y0, rx, ry, k] of [[48, 88, 30, 4.5, 1], [46, 82, 20, 5, 0.7], [62, 90, 18, 3, 0.6], [32, 90, 16, 3, 0.6]]) { const d = ((x - x0) / rx) ** 2 + ((y - y0) / ry) ** 2; v = Math.max(v, k * (1 - d)); }
    v *= 0.75 + 0.6 * fbm(x * 0.18, y * 0.35, 3);
    if (v <= 0.05) continue;
    const t = v * 3.2 + (BAYER[y & 3][x & 3] + 0.5) / 16 - 0.5;
    if (t < 0.25 || !free(x, y)) continue;
    C.set(x, y, M[Math.min(3, Math.floor(t))]);
  }
  for (const [x0, y0, l] of [[30, 70, 12], [66, 68, 14], [24, 58, 8], [72, 50, 7]]) for (let i = 0; i < l; i++) { const x = x0 + Math.sin(i * 0.6 + x0) * 1.6, y = y0 - i; if (!C.get(Math.round(x), Math.round(y)) && i % 4 !== 3) C.set(x, y, M[i < 3 ? 2 : i < 8 ? 1 : 0]); }
  // 陣羽織の褪せた紋章: 白銀の翼
  const E = ["#3a4a52", "#56686e", "#7a8c90"];
  const emb = (x, y, c) => { const p = C.pix[y * 96 + x]; if (p && p.m === "tabard") C.set(x, y, c); };
  for (let i = 0; i < 7; i++) { emb(47 - i, 62 - Math.round(i * 0.6), E[i < 2 ? 2 : 1]); emb(49 + i, 62 - Math.round(i * 0.6), E[i < 2 ? 2 : 1]); emb(47 - i, 63 - Math.round(i * 0.3), E[0]); emb(49 + i, 63 - Math.round(i * 0.3), E[0]); }
  for (let y = 60; y <= 67; y++) emb(48, y, E[y < 63 ? 2 : 1]);
  // 兜の割れ目から走るひびの光
  for (const pts of [[[51, 13], [49, 15], [50, 17], [48, 19]], [[54, 15], [55, 18], [54, 21]], [[57, 32], [55, 35], [56, 37]]]) for (let k = 0; k < pts.length - 1; k++) { const [x0, y0] = pts[k], [x1, y1] = pts[k + 1]; const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let i = 0; i <= n; i++) C.only(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, k === 0 ? S[2] : S[1]); }
  return C.toArt();
}
