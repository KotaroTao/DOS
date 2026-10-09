import { sphere, ellipsoid, cone, tube, slab, U, Sub, Disp, render, ramp, Canvas, fbm, rand, fangs } from "../sdf.mjs";
import { humanoid, fingers } from "../human.mjs";
import { RIM, BOLT, sparks, rain, windStreaks, afterimage, spikes } from "../storm.mjs";
export const meta = { id: "bs_zephyrfiend", key: "hd_zephyrfiend", w: 96, h: 96,
  note: "旋風の鬼: つむじ風に乗って宙を舞う、やせた黒い鬼。後ろへ反った二本の角、裂けた口、両腕の先には鎌のように長い爪。足は渦巻く旋風の中に溶けている。目にも止まらぬ速さで一度に二度動き (神速)、残像を引いて回り込み、爪で鎧の継ぎ目の急所を断つ (痛撃)" };
export function build() {
  const mats = {
    hide: { ramp: ramp(["#030204", "#0a070c", "#140e17", "#201624", "#2e2034", "#3e2c46", "#523a5c"], 7), dither: 0.5, amb: 0.22, spec: 0.5, pow: 24,
      shade: p => 0.08 * fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5) },
    horn: { ramp: ramp(["#0a0806", "#1e1a14", "#3a3226", "#5e523e", "#8a7c60"], 5), spec: 0.8, pow: 24, dither: 0.4 },
    claw: { ramp: ramp(["#08080c", "#1c1c26", "#3a3a4e", "#62627e", "#9a9ab8"], 5), spec: 1.2, pow: 40, specCol: "#e0e4ff", dither: 0.35 },
    maw: { ramp: ["#000000", "#16060a", "#3a0e16"], amb: 0.05, dif: 0.2, noRim: true },
    eye: { ramp: ["#5a1406", "#e05a18", "#ffd080"], emit: () => 0.95 },
  };
  const J = { head: [42, 22, 4], neck: [44, 28, 2], chest: [46, 38, 0], waist: [50, 50, 0], hip: [54, 58, 0],
    shL: [38, 33, 4], elL: [28, 40, 8], haL: [18, 48, 10], shR: [54, 33, -2], elR: [64, 26, 0], haR: [74, 18, 2] };
  const body = humanoid(J, { skin: "hide" }, { w: { headX: 4.8, headY: 5.6, chestX: 9, chestY: 8, chestZ: 6, waistX: 6.4, waistY: 6.4, hipX: 6.4, arm: 2.4, arm2: 2, wrist: 1.5 }, k: 3 });
  // 足のかわりに旋風へ溶ける下半身
  const vortex = Disp(cone([54, 58, 0], [52, 86, -4], 6, 0.8, "hide"), (x, y, z) => 0.6 * Math.sin(y * 0.9 + x * 0.6) + 0.5 * fbm(x * 0.3, y * 0.3));
  const horns = [tube([[40, 18, 2, 1.8], [36, 10, 0, 1.4], [40, 2, -2, 0.6], [46, 0, -2, 0.2]], "horn"), tube([[45, 17, 0, 1.6], [48, 9, -2, 1.2], [54, 4, -4, 0.5], [58, 4, -4, 0.2]], "horn")];
  const maw = ellipsoid([39, 25, 8.6], [3, 1.6, 1.4], "maw", 10);
  const eyes = [sphere([39.4, 20.6, 8.2], 0.9, "eye"), sphere([43.6, 20.4, 8.2], 0.9, "eye")];
  const ears = [cone([37, 20, 2], [30, 16, 0], 1.4, 0.3, "hide")];
  // 鎌のような長い爪
  const claws = [
    ...spikes([[[18, 48, 10], [4, 62, 12], 1.4, 0.2], [[18, 48, 10], [6, 56, 12], 1.2, 0.2], [[19, 49, 10], [10, 66, 12], 1.2, 0.2]], "claw"),
    ...spikes([[[74, 18, 2], [92, 6, 2], 1.4, 0.2], [[74, 18, 2], [90, 14, 2], 1.2, 0.2], [[74, 17, 2], [84, 2, 2], 1.2, 0.2]], "claw"),
  ];
  const spine = spikes([[[48, 32, -4], [52, 26, -8], 1.2], [[50, 38, -4], [56, 33, -8], 1.2], [[52, 44, -4], [58, 41, -8], 1]], "hide");
  const scene = U(0, Sub(U(1.4, body, vortex, ...ears, ...spine), maw, 0.3), ...horns, ...eyes, ...claws);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [20, 40, 24], r: 18, k: 0.3 }] });
  const C = new Canvas(r);
  fangs(C, "maw", 37, 41, { step: 2, top: [1, 1], bot: [1, 1], cols: ["#3a3226", "#a09068", "#e0d8b8"], seed: 10701 });
  // 下半身の旋風 (螺旋の筋)
  for (const ph of [0, 3.1]) for (let t = 0; t < 1; t += 0.002) {
    if (fbm(t * 9, ph, 1) > 0.25) continue;
    const y = 94 - t * 40 + 2 * fbm(t * 12, ph), a = t * 19 + ph, rr = 20 - t * 14 + 3 * fbm(t * 6, ph + 3);
    const x = 52 + Math.cos(a) * rr, front = Math.sin(a) > 0;
    if (!front && C.get(Math.round(x), Math.round(y))) continue;
    C.set(x, y, front ? (t < 0.4 ? "#565c8c" : "#7a84bc") : "#262840");
    if (front && t < 0.5) C.set(x, y + 1, "#2e3252");
  }
  // 爪の軌跡 (斬りつけた弧)
  for (let a = -0.4; a < 1.1; a += 0.02) { const x = 30 + Math.cos(a + 1.6) * 30, y = 46 + Math.sin(a + 1.6) * 18; if (!C.get(Math.round(x), Math.round(y))) C.set(x, y, a > 0.7 ? BOLT[1] : BOLT[3]); }
  afterimage(C, [[8, 3, 0.45, "#1c1426"], [16, 6, 0.25, "#130e1a"]], [0, 0, 96, 70]);
  windStreaks(C, 10703, 20, [0, 0, 96, 92]);
  rain(C, 10705, 30);
  sparks(C, 10707, 8);
  return C.toArt();
}
