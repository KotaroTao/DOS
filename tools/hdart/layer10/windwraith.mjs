import { sphere, ellipsoid, cone, tube, U, Sub, Disp, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { fingers } from "../human.mjs";
import { RIM, SOULS, BOLT, bolt2d, sparks, rain, windStreaks, afterimage, dissolve } from "../storm.mjs";
export const meta = { id: "bs_windwraith", key: "hd_windwraith", w: 96, h: 96,
  note: "疾風の霊: 塔を吹き上がる風に巻かれた魂。青白くすけた細い体は風に引き延ばされ、裾と髪は長い帯になって右へ流れる。両腕を後ろへはね上げ、裂けるほど口を開けて叫ぶ。その叫びを聞いた者は敵と味方の見分けがつかなくなる (混乱・多用)。実体が薄く、呪文の熱にはもろい (魔法弱点)" };
export function build() {
  const mats = {
    veil: { ramp: ramp(["#03060a", "#081018", "#0f1b26", "#172836", "#213848", "#2d4a5c", "#3c5f72", "#507a8c", "#6a96a6"], 9), dither: 0.75, amb: 0.3,
      shade: p => 0.14 * Math.sin(p.y * 0.8 - p.x * 0.25 + 2 * fbm(p.x * 0.15, p.y * 0.3)) },
    face: { ramp: ramp(["#0a141c", "#1c303c", "#33505e", "#527684", "#7aa2ae", "#a6ccd4"], 6), dither: 0.45, amb: 0.34 },
    hole: { ramp: ["#000000", "#010204", "#03070b"], amb: 0, dif: 0.05, noRim: true },
    eye: { ramp: [SOULS[2], SOULS[3], SOULS[4]], emit: () => 0.95 },
  };
  // 風に引き延ばされた体: 胸から右下へ流れる長い帯
  const tail = (x, y, z) => 1.1 * fbm(x * 0.12, y * 0.3, z * 0.2) + 0.7 * Math.sin(x * 0.25 + y * 0.6);
  const torso = Disp(tube([[34, 40, 0, 9], [46, 52, 0, 8], [60, 60, -2, 6], [74, 64, -4, 4], [88, 62, -6, 2.4], [96, 58, -6, 1]], "veil", { seg: 4 }), tail);
  const tail2 = Disp(tube([[44, 56, -2, 5], [58, 72, -4, 3.6], [74, 80, -6, 2.4], [92, 82, -8, 1]], "veil", { seg: 4 }), tail);
  const head = ellipsoid([30, 30, 4], [7, 8, 6.4], "face", -18);
  // 後ろへ流れる髪
  const hair = Disp(U(1.5, tube([[30, 22, -2, 5], [44, 18, -4, 4], [62, 18, -6, 2.6], [80, 22, -6, 1.4], [94, 24, -6, 0.6]], "veil", { seg: 4 }),
    tube([[34, 26, -3, 4], [50, 28, -5, 3], [68, 32, -6, 2], [86, 38, -6, 0.8]], "veil", { seg: 4 })), tail);
  const holes = U(0, ellipsoid([26.5, 28.5, 9.6], [1.8, 2.4, 1.6], "hole", -18), ellipsoid([32.5, 27, 9.8], [1.8, 2.4, 1.6], "hole", -18),
    ellipsoid([30, 37, 8.6], [2.6, 4.4, 2], "hole", -18));
  // はね上げた両腕
  const arms = [
    Disp(tube([[30, 42, 4, 3], [20, 34, 7, 2.2], [12, 20, 8, 1.4]], "veil", { seg: 3 }), (x, y, z) => 0.5 * fbm(x * 0.4, y * 0.4)),
    Disp(tube([[42, 40, -2, 3], [54, 30, -2, 2.2], [64, 20, -2, 1.4]], "veil", { seg: 3 }), (x, y, z) => 0.5 * fbm(x * 0.4, y * 0.4)),
  ];
  const hands = [...fingers([12, 19, 8], -110, "veil", { n: 4, len: 7, spread: 36, r: 0.6, curl: 0.4 }), ...fingers([64, 19, -2], -70, "veil", { n: 4, len: 7, spread: 36, r: 0.6, curl: -0.4 })];
  const eyes = [sphere([26.6, 28.4, 9.4], 0.7, "eye"), sphere([32.6, 26.9, 9.6], 0.7, "eye")];
  const ghost = Sub(U(2.2, torso, tail2, hair, head, ...arms, ...hands), holes, 0.3);
  const scene = U(0, ghost, ...eyes);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [30, 32, 22], r: 18, k: 0.35 }] });
  const C = new Canvas(r);
  // 帯の先は風にちぎれて散る
  for (let y = 0; y < 96; y++) for (let x = 70; x < 96; x++) { const c = C.get(x, y); if (c && fbm(x * 0.3, y * 0.3, 2) + (x - 70) / 40 > 0.75 && (x + y) % 2) C.px[y * 96 + x] = null; }
  // 叫び声の波 (口から左へ広がる弧)
  for (const [r0, c] of [[8, SOULS[3]], [13, SOULS[2]], [18, SOULS[1]]]) for (let a = 2.2; a < 4.2; a += 0.05) {
    const x = 28 + Math.cos(a) * r0, y = 38 + Math.sin(a) * r0 * 1.2;
    if (!C.get(Math.round(x), Math.round(y)) && Math.sin(a * 9 + r0) > -0.5) C.set(x, y, c);
  }
  afterimage(C, [[-5, 2, 0.35, "#0c1822"], [-10, 3, 0.2, "#091219"]], [0, 10, 96, 80]);
  windStreaks(C, 9201, 22, [0, 4, 96, 88], { cols: ["#0e1a24", "#1a2c3a", "#2c4656"] });
  rain(C, 9203, 30, [0, 0, 96, 96], { slope: 0.8 });
  sparks(C, 9205, 10, [2, 2, 92, 90], SOULS);
  return C.toArt();
}
