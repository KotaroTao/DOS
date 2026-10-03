import { tube, sphere, ellipsoid, cone, slab, torus, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { humanoid, fingers } from "../human.mjs";
import { MOULD, MOSS, ROOT, RIM, MIST, forestFloor, mist, spores, leaves } from "../forest.mjs";
export const meta = { id: "bs_satyrpiper", key: "hd_satyrpiper", w: 96, h: 96,
  note: "角笛の森人: 巻いた角と山羊の脚をもつ毛深い半獣人。片脚で跳ねながら曲がった獣角の笛を吹き鳴らし、笛の口から音の波が弧を描いて広がる。跳ねる体の後ろには残像が尾を引く" };
export function build() {
  const mats = {
    skin: { ramp: ramp(["#040302", "#0e0a06", "#1c140c", "#2c2014", "#3e2e1c", "#523e26", "#6a5232"], 7), spec: 0.6, pow: 25, specCol: "#9a7e52", dither: 0.55,
      shade: p => 0.06 * fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5) },
    fur: { ramp: ramp(["#030302", "#0a0806", "#15110c", "#211a12", "#2f2618", "#3e3320"], 6), dither: 0.75, amb: 0.2,
      shade: p => 0.16 * Math.abs(Math.sin(p.x * 1.4 + p.y * 0.5 + 2 * fbm(p.x * 0.3, p.y * 0.3))) - 0.05 },
    horn: { ramp: ramp(["#060504", "#1a1610", "#33291c", "#504230", "#726048", "#988466"], 6), spec: 0.9, pow: 30, dither: 0.45,
      shade: p => -0.1 * Math.pow(Math.abs(Math.sin((p.x + p.y) * 1.6)), 6) },
    hoof: { ramp: ramp(["#020202", "#0a0a0a", "#161616", "#262624"], 4), spec: 1, pow: 40 },
    eye: { ramp: ["#4a6a10", "#a0d040", "#e8ff90"], emit: p => 0.55 + 0.45 * Math.max(0, p.nz) },
    maw: { ramp: ["#000000", "#0a0404", "#140808"], amb: 0.2, dif: 0.2, noRim: true },
    mould: MOULD, moss: MOSS, root: ROOT,
  };
  // 上体: 斜め右を向き、胸を反らして笛を吹く。腕は笛を支える
  const J = { head: [40, 23, 8], neck: [42, 30, 4], chest: [45, 39, 2], waist: [46, 49, 0], hip: [47, 57, -1],
    shL: [37, 34, 5], elL: [36, 43, 12], haL: [47, 33, 15], shR: [54, 34, 0], elR: [62, 41, 7], haR: [59, 28, 12] };
  const body = humanoid(J, { skin: "skin", hip: "fur" }, { w: { headX: 5, headY: 5.8, headZ: 5.2, neck: 2.4, chestX: 9.5, chestY: 7.5, chestZ: 6.2, waistX: 7, waistY: 6, hipX: 9, hipY: 5.5, arm: 2.8, arm2: 2.3, wrist: 1.7 }, k: 1.5 });
  const handL = fingers([47, 33, 15], -30, "skin", { n: 4, len: 3.6, spread: 14, r: 0.75, curl: 0.9, z: 0.5 });
  const handR = fingers([59, 28, 12], -40, "skin", { n: 4, len: 3.6, spread: 14, r: 0.75, curl: 0.9, z: 0.5 });
  // 顔: 尖った耳、山羊の顎ひげ、獣じみた鼻筋
  const ears = [cone([36, 22, 4], [29, 19, 2], 1.8, 0.3, "skin"), cone([45, 21, 2], [51, 17, 0], 1.6, 0.3, "skin")];
  const nose = ellipsoid([44, 24, 12], [2, 2.6, 2], "skin", -20);
  const beard = Disp(cone([42, 28, 11], [40, 37, 11], 2.8, 0.6, "horn"), (x, y, z) => 0.4 * Math.abs(Math.sin(x * 2.2)));
  const hair = Disp(ellipsoid([38, 17, 5], [6, 3.6, 5.5], "fur", -10), (x, y, z) => 0.7 * Math.abs(Math.sin(x * 1.6 + z)));
  // 巻いた角: こめかみから後ろへ渦を巻く
  const curl = (cx, cy, cz, s, z0) => {
    const pts = [];
    for (let i = 0; i <= 10; i++) { const t = i / 10, a = -1.7 + s * t * 4.8, R = 8 - t * 4.4; pts.push([cx + Math.cos(a) * R * s * -1, cy + Math.sin(a) * R, cz + z0 * t, 3 - t * 2]); }
    return tube(pts, "horn", { seg: 3 });
  };
  const horns = [curl(33, 21, 6, 1, -3), curl(45, 19, 0, 1, -4)];
  // 毛深い下半身: 腰回りから太腿まで長い毛
  const hips = Disp(ellipsoid([47, 59, -1], [10, 7, 7], "fur"), (x, y, z) => 0.9 * Math.abs(Math.sin(x * 1.3 + y * 0.6)) * Math.max(0, (y - 54) / 8));
  // 山羊の脚: 太腿 → 前へ出る膝 → 後ろへ折れる飛節 → 蹄。軸脚は床、もう片方は跳ね上げる
  const goatLeg = (hip, knee, hock, hoof, z) => [
    Disp(tube([[...hip, 6.4], [...knee, 4.4]], "fur", { seg: 2 }), (x, y, zz) => 0.6 * Math.abs(Math.sin(x * 1.5 + y * 0.8))),
    tube([[...knee, 3.6], [...hock, 2.5], [...hoof, 1.8]], "fur", { seg: 3 }),
    Disp(ellipsoid(hock, [2.6, 2.6, 2.4], "fur"), (x, y, zz) => 0.5 * Math.abs(Math.sin(y * 2.5))),
  ];
  const legA = goatLeg([42, 61, 2], [38, 71, 8], [45, 80, 4], [42, 87, 6]);
  const hoofA = cone([42, 86, 6], [41, 90, 7], 1.7, 2.1, "hoof");
  const legB = goatLeg([54, 61, -2], [63, 64, 6], [58, 73, 4], [65, 77, 6]);
  const hoofB = cone([64, 76.5, 6], [68, 79, 7], 1.6, 2, "hoof");
  const tail = Disp(cone([56, 56, -6], [62, 52, -8], 2.2, 0.8, "fur"), (x, y, z) => 0.4 * Math.abs(Math.sin(y * 2)));
  const satyr = Disp(U(1.2, body, ...handL, ...handR, ...ears, nose, hips, ...legA, ...legB, tail), (x, y, z) => 0.08 * fbm(x * 0.8, y * 0.8, z * 0.8));
  const sockets = U(0, ellipsoid([40, 22, 12.5], [1.6, 1, 2], "maw", -10), ellipsoid([45, 21, 11.5], [1.4, 0.9, 2], "maw", -10));
  const eyes = [ellipsoid([40, 22.1, 12], [1.2, 0.7, 1], "eye", -10), ellipsoid([45, 21.1, 11], [1.1, 0.65, 1], "eye", -10)];
  // 角笛: 口から右上へ、曲がりながら太くなる獣角。先は開いた口
  const pipePts = [[44, 28, 13, 0.9], [52, 30, 15, 1.3], [62, 27, 14, 2.1], [70, 21, 11, 3], [74, 14, 8, 4.2]];
  const pipe = Sub(U(0.8, tube(pipePts, "horn", { seg: 4 }), torus([74.5, 13, 8], 4.2, 1, "horn", 30, 60)), ellipsoid([75, 12.5, 9], [3.2, 3.2, 3], "maw", 30), 0.3);
  const rings = [torus([57, 29, 14.5], 1.8, 0.6, "hoof", 70, 0), torus([66, 24.5, 12.5], 2.6, 0.6, "hoof", 55, 0)];
  const scene = U(0, forestFloor(46, 91, 38, 14, { n: 5, roots: 3, seed: 531 }), Sub(satyr, sockets, 0.3), ...eyes, beard, hair, ...horns, hoofA, hoofB, pipe, ...rings);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [76, 12, 18], r: 22, k: 0.4 }] });
  const C = new Canvas(r);
  // 残像: 跳ねてきた左下へ、体の形を淡い色でずらして二重に
  const own = new Set(["skin", "fur", "horn", "hoof", "eye"]);
  const mask = [];
  for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) { const p = C.pix[y * 96 + x]; if (p && own.has(p.m) && y < 86) mask.push([x, y, p.idx ?? 2]); }
  const BY = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  for (const [dx, dy, a, c0] of [[-8, 3, 0.5, 1], [-16, 6, 0.28, 0]]) for (const [x, y, i] of mask) {
    const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= 96 || Y >= 96 || C.get(X, Y)) continue;
    if (a > (BY[Y & 3][X & 3] + 0.5) / 16) C.set(X, Y, MIST[c0 + (i > 3 ? 2 : i > 1 ? 1 : 0)]);
  }
  // 音の波: 笛の口から右上へ広がる弧
  const W = ["#3a5a20", "#6a9a30", "#a8d860", "#e0ffa0"];
  for (const [rr, col, a0, a1] of [[7, 3, -2.2, 0.7], [11, 2, -2.0, 0.8], [15.5, 1, -1.8, 0.9], [20, 0, -1.6, 0.9]]) {
    for (let a = a0; a <= a1; a += 0.5 / rr) { const x = 76 + Math.cos(a) * rr, y = 12 + Math.sin(a) * rr; if (!C.get(Math.round(x), Math.round(y))) C.set(x, y, W[col]); }
  }
  // 音符めいた光の粒
  const Rn = rand(533);
  for (let i = 0; i < 9; i++) { const a = -1.8 + Rn() * 2.6, d = 8 + Rn() * 16, x = 76 + Math.cos(a) * d, y = 12 + Math.sin(a) * d; if (!C.get(Math.round(x), Math.round(y))) C.set(x, y, W[2 + (Rn() < 0.3 ? 1 : 0)]); }
  leaves(C, 535, 46, 90, 34, 16);
  spores(C, 537, 8, [2, 30, 30, 50]);
  return C.toArt();
}
