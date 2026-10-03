import { tube, sphere, ellipsoid, cone, slab, cyl, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand, fangs } from "../sdf.mjs";
import { RIM, WATER, puddle, ripples } from "../lib.mjs";
import { humanoid, fingers } from "../human.mjs";
export const meta = { id: "bs_deepsahagin", key: "hd_deepsahagin", w: 96, h: 96,
  note: "深海魚人: 背を丸めて這うように迫る眼の無い魚人。鮟鱇のような大顎に針の牙、頭から背に並ぶ青白い発光の斑、長い腕に返しの付いた三叉の毒もり" };
export function build() {
  const mats = {
    skin: { ramp: ramp(["#020103", "#08050c", "#100a16", "#1a1222", "#261a30", "#342440", "#463252", "#5e4668"], 8), spec: 1.0, pow: 30, specCol: "#d8c8ec", dither: 0.5,
      shade: p => 0.12 * fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5) },
    belly: { ramp: ramp(["#050406", "#141018", "#241e28", "#36303a", "#4a444c", "#625c60"], 6), spec: 1.2, pow: 40, dither: 0.5 },
    maw: { ramp: ["#000000", "#000000", "#0e0408", "#200a12"], amb: 0.1, dif: 0.4 },
    glow: { ramp: ["#164848", "#3a9a90", "#8ae8d4", "#e0fff4"], emit: p => 0.35 + 0.65 * Math.max(0, p.nz) },
    iron: { ramp: ramp(["#030202", "#0e0806", "#1c100a", "#2c1a0e", "#422614", "#5a361e", "#76482a"], 7), spec: 1.2, pow: 35, specCol: "#c8a080", dither: 0.4 },
    fin: { ramp: ramp(["#020103", "#08050c", "#120a18", "#1e1226", "#2c1a36"], 5), dither: 0.5, shade: p => 0.12 * Math.sin(p.x * 1.4 + p.y * 0.6) },
    water: WATER,
  };
  // 背を丸めて前屈み: 頭は低く前へ、長い腕
  const J = { head: [30, 34, 10], neck: [38, 34, 6], chest: [48, 38, 2], waist: [56, 48, 0], hip: [58, 58, -1],
    shL: [42, 40, 8], elL: [32, 54, 12], haL: [24, 66, 16], shR: [54, 36, -2], elR: [66, 44, 4], haR: [72, 34, 10],
    hpL: [54, 60, 2], knL: [44, 72, 6], ftL: [42, 86, 4], hpR: [62, 60, -2], knR: [70, 72, 0], ftR: [70, 86, -2] };
  const body = humanoid(J, { skin: "skin" }, { w: { headX: 8, headY: 6.5, headZ: 7, neck: 5, chestX: 11, chestY: 9.5, chestZ: 8, waistX: 8, hipX: 8, arm: 3, arm2: 2.6, wrist: 1.8, thigh: 4.2, knee: 3, ankle: 2.2 }, headRot: 8, k: 3.4 });
  const jaw = ellipsoid([24, 40, 12], [10, 5, 7], "skin", 14);
  const hump = ellipsoid([50, 32, -2], [10, 8, 8], "skin", -20);
  const head = Sub(U(2.4, body, jaw, hump), ellipsoid([20, 37, 16], [9, 3.4, 7], "maw", 10), 0.8);
  const bellyP = (x, y, z, m) => (m === "skin" && z > 6 && y > 42 && y < 60 && x > 44 && x < 62) ? "belly" : m;
  const dfin = slab([[34, 28], [40, 20], [48, 22], [56, 24], [62, 32], [62, 40], [52, 30], [42, 30]], -3, 1, "fin", 0.4);
  // 発光の斑: 頭から背へ
  const spots = [];
  for (const [x, y, z, r] of [[28, 29, 14, 1.2], [34, 28, 12, 1.1], [40, 28, 9, 1.0], [46, 27, 7, 1.0], [52, 28, 4, 0.9], [58, 32, 1, 0.9], [24, 32, 15, 0.9], [62, 40, 2, 0.8], [62, 47, 3, 0.8]]) spots.push(sphere([x, y, z], r, "glow"));
  // 吊り灯: 額から短い竿
  const rod = tube([[26, 30, 14, 0.8], [22, 22, 16, 0.6], [16, 20, 18, 0.5]], "fin");
  const lure = sphere([15, 21, 18], 1.8, "glow");
  const hL = fingers(J.haL, 100, "skin", { n: 3, len: 6, spread: 20, r: 1, curl: 0.4 });
  const hR = fingers(J.haR, -110, "skin", { n: 3, len: 4, spread: 18, r: 1, curl: 0.7 });
  const fL = fingers(J.ftL, 180, "skin", { n: 3, len: 5, spread: 18, r: 1.1, curl: 0.1, z: 2 }), fR = fingers(J.ftR, 0, "skin", { n: 3, len: 5, spread: 18, r: 1.1, curl: -0.1, z: 2 });
  // 三叉の毒もり
  const shaft = cyl([80, 88, 8], [70, 6, 12], 1.1, "iron", 0.3);
  const prongs = [tube([[70.5, 10, 12, 1], [68, 4, 12, 0.9], [67, -1, 12, 0.4]], "iron"), tube([[70.5, 10, 12, 1], [70, 2, 12, 0.9], [70, -3, 12, 0.4]], "iron"), tube([[70.5, 10, 12, 1], [73, 4, 12, 0.9], [74, -1, 12, 0.4]], "iron"), cyl([66, 8, 12], [75, 7, 12], 0.9, "iron")];
  const scene = U(0, puddle(56, 90, 34, 14), dfin, Paint(Disp(head, (x, y, z) => 0.2 * fbm(x * 0.6, y * 0.6, z * 0.6)), bellyP), ...spots, rod, lure, ...hL, ...fL, ...fR, shaft, ...prongs, ...hR);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [15, 21, 18], r: 26, k: 0.7 }] });
  const C = new Canvas(r);
  fangs(C, "maw", 12, 28, { step: 2, top: [2, 4], bot: [2, 4], cols: ["#2a3a3a", "#8aa8a0", "#d8ece4"], seed: 9 });
  // 光の粒と滴る毒
  const R = rand(2);
  for (let i = 0; i < 14; i++) { const x = 8 + R() * 30, y = 12 + R() * 22; if (!C.get(Math.round(x), Math.round(y))) C.set(x, y, R() < 0.5 ? "#164848" : "#3a9a90"); }
  for (const [x, y0, l] of [[66, 10, 4], [74, 10, 3], [16, 46, 5]]) for (let i = 0; i < l; i++) C.set(x, y0 + i, i === l - 1 ? "#8ae8d4" : "#3a9a90");
  ripples(C, 56, 90, 34);
  return C.toArt();
}
