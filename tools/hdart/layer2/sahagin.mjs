import { tube, sphere, ellipsoid, cone, slab, cyl, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { RIM, WATER, puddle, ripples } from "../lib.mjs";
import { humanoid, fingers } from "../human.mjs";
export const meta = { id: "d03_sahagin", key: "hd_sahagin", w: 96, h: 96,
  note: "深淵のサハギン: 骨のもりを構えて岸辺に立つ半魚人。鰭の冠と鰓の裂け目、退化して白濁した大きな眼、鱗の背と水かきの手足、腰に海藻の帯" };
export function build() {
  const mats = {
    skin: { ramp: ramp(["#020404", "#06100e", "#0c1c18", "#142a24", "#1e3a30", "#2c4e3e", "#406650", "#5e8466"], 8), spec: 1.8, pow: 45, specCol: "#d0f0d8", dither: 0.5,
      shade: p => { const u = p.x / 3.2, v = p.y / 2.6, row = Math.floor(v), fu = (u + (row % 2) * 0.5) % 1 - 0.5, fv = v - row; return (Math.hypot(fu, fv - 0.2) > 0.55 ? -0.12 : 0.02); } },
    belly: { ramp: ramp(["#050605", "#141a14", "#26301f", "#3a462c", "#52603a", "#6e7c4c"], 6), spec: 1.2, pow: 40, specCol: "#e0ecc8", dither: 0.5, shade: p => (Math.floor(p.y * 0.55) % 2 ? -0.06 : 0.04) },
    fin: { ramp: ramp(["#030304", "#0c0a10", "#18121e", "#26182a", "#382036", "#4e2c42"], 6), dither: 0.5, shade: p => 0.14 * Math.sin(p.x * 1.6 + p.y * 0.5) },
    eye: { ramp: ramp(["#1a1c18", "#4a4e44", "#8a8e7e", "#c4c6b4", "#ecece0"], 5), spec: 2.5, pow: 70, specCol: "#ffffff", amb: 0.35 },
    bone: { ramp: ramp(["#060504", "#1a1610", "#302a1e", "#4c4430", "#6e6448", "#968c68", "#c0b890"], 7), spec: 0.8, pow: 30, dither: 0.4 },
    weed: { ramp: ramp(["#020402", "#081008", "#10200e", "#1a3216", "#284620"], 5), dither: 0.6 },
    water: WATER,
  };
  const J = { head: [42, 22, 6], neck: [44, 30, 4], chest: [46, 40, 2], waist: [47, 51, 0], hip: [48, 59, -1],
    shL: [37, 34, 6], elL: [28, 44, 10], haL: [26, 54, 14], shR: [56, 34, 0], elR: [64, 42, 6], haR: [60, 32, 12],
    hpL: [43, 61, 0], knL: [38, 72, 4], ftL: [36, 86, 2], hpR: [53, 61, -2], knR: [58, 72, -2], ftR: [60, 86, -2] };
  const body = humanoid(J, { skin: "skin" }, { w: { headX: 5.4, headY: 6.4, headZ: 5.8, neck: 3.6, chestX: 9.5, chestY: 8, chestZ: 6.5, waistX: 7, hipX: 7.5, arm: 2.8, arm2: 2.4, wrist: 1.7, thigh: 3.8, knee: 2.8, ankle: 2 }, headRot: -10, k: 3.2 });
  const jaw = ellipsoid([38, 26, 9], [6, 3.6, 5], "skin", -20);
  const head = Sub(U(1.5, body, jaw), ellipsoid([33, 27, 12], [4.5, 1.1, 4], "fin", -18), 0.4);
  const bellyP = (x, y, z, m) => (m === "skin" && z > 4 && y > 34 && y < 60 && Math.abs(x - 47 + (y - 46) * 0.05) < 5.5 + fbm(x * 0.2, y * 0.2)) ? "belly" : m;
  const crest = slab([[38, 16], [36, 8], [40, 4], [44, 10], [47, 5], [51, 12], [52, 20], [46, 18]], 4, 1, "fin", 0.4);
  const spine = slab([[52, 30], [60, 32], [62, 42], [58, 54], [54, 48], [54, 38]], -4, 1, "fin", 0.4);
  const gillFin = [slab([[46, 24], [52, 20], [54, 26], [48, 28]], 8, 0.8, "fin", 0.3)];
  const elbowFin = slab([[28, 44], [22, 40], [20, 46], [26, 48]], 10, 0.8, "fin", 0.3);
  const eye = sphere([38, 20, 11], 2.8, "eye");
  const hL = fingers(J.haL, 100, "skin", { n: 3, len: 5, spread: 18, r: 1, curl: 0.3 }), hR = fingers(J.haR, -100, "skin", { n: 3, len: 4, spread: 18, r: 1, curl: 0.6 });
  const fL = fingers(J.ftL, 180, "skin", { n: 3, len: 5, spread: 18, r: 1.1, curl: 0.1, z: 2 }), fR = fingers(J.ftR, 0, "skin", { n: 3, len: 5, spread: 18, r: 1.1, curl: -0.1, z: 2 });
  // 骨のもり: 縦に構え、先に返しの付いた骨の穂
  const shaft = cyl([62, 88, 10], [58, 6, 12], 1.1, "bone", 0.3);
  const tip = slab([[57, 8], [55, 0], [59, 0], [60, 6]], 12, 1, "bone", 0.3), barbs = [cone([57, 6, 12], [54, 9, 12], 0.8, 0.1, "bone"), cone([60, 6, 12], [63, 9, 12], 0.8, 0.1, "bone")];
  const belt = Disp(tube([[39, 58, 6, 1.6], [48, 60, 8, 1.8], [56, 58, 4, 1.6]], "weed"), (x, y, z) => 0.3 * fbm(x, y, z));
  const scene = U(0, puddle(48, 90, 38, 14), spine, Paint(Disp(head, (x, y, z) => 0.15 * fbm(x * 0.8, y * 0.8, z * 0.8)), bellyP), crest, ...gillFin, elbowFin, eye, ...hL, ...fL, ...fR, belt, shaft, tip, ...barbs, ...hR);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  C.set(37, 20, "#ffffff"); C.set(39, 21, "#5a5e52");
  // 口の牙と鰓の線
  for (const x of [33, 35, 37, 39]) C.only(x, 28, "#c4c0a0");
  for (const dy of [0, 3]) for (let i = 0; i < 4; i++) C.only(44 + i * 0.3, 26 + dy + i, "#020404");
  // 海藻の帯の垂れ
  const Wd = ["#10200e", "#1a3216", "#284620"];
  for (const [x, l] of [[42, 8], [46, 11], [50, 6], [53, 9]]) for (let i = 0; i < l; i++) C.set(x + Math.sin(i * 0.9) * 0.7, 61 + i, Wd[i % 3]);
  ripples(C, 48, 90, 38);
  return C.toArt();
}
