import { tube, sphere, ellipsoid, cone, slab, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { humanoid, fingers } from "../human.mjs";
import { MOULD, MOSS, ROOT, RIM, forestFloor, mushrooms, leaves } from "../forest.mjs";
export const meta = { id: "bs_sporezombie", key: "hd_sporezombie", w: 96, h: 96,
  note: "胞子の苗床: 前屈みによろめく亡骸。背と頭から大小のキノコの傘が群生し、大きく裂けた口と傘から黄緑の胞子の雲を前へ噴き出す (ブレス)。崩れた肉は苔とキノコに置き換わって再生し続ける" };
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
export function build() {
  const mats = {
    skin: { ramp: ramp(["#040504", "#0e100c", "#1b1e16", "#292d21", "#383c2c", "#4a4c38", "#5e5e46"], 7), spec: 0.5, pow: 22, specCol: "#9a9c7c", dither: 0.6, amb: 0.2,
      shade: p => 0.12 * fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5) },
    rag: { ramp: ramp(["#040303", "#110e0b", "#201a13", "#30281d", "#3e3425"], 5), dither: 0.65, amb: 0.2, shade: p => 0.1 * Math.sin(p.x * 0.9 + p.y * 0.3) },
    cap: { ramp: ramp(["#080403", "#1c0f08", "#341c0e", "#502c16", "#6e4020", "#8e5a30", "#ae7a48"], 7), spec: 0.8, pow: 25, specCol: "#e0b080", dither: 0.45, amb: 0.2,
      shade: p => (vnoise(p.x * 1.3, p.y * 1.3, p.z * 1.3) > 0.55 ? 0.3 : 0) },
    gill: { ramp: ramp(["#0c0a06", "#2a2414", "#4a4224", "#6a6036"], 4), dither: 0.5, amb: 0.3 },
    stem: { ramp: ramp(["#0e0d09", "#2a281e", "#4a4634", "#6e6a50", "#928c6c"], 5), dither: 0.5, amb: 0.25 },
    maw: { ramp: ["#000000", "#060402", "#0e0a06"], amb: 0.1, dif: 0.2, noRim: true },
    eye: { ramp: ["#3a4a10", "#7a9420", "#c0d850"], emit: p => 0.5 + 0.5 * Math.max(0, p.nz) },
    spore: { ramp: ramp(["#151a10", "#1e2616", "#28331c", "#344423", "#43572b", "#566e34", "#6e8a40", "#8ca852"], 8), dither: 0.8, amb: 0.12, dif: 0.85, noRim: true,
      shade: p => 0.14 * fbm(p.x * 0.15, p.y * 0.15, p.z * 0.15) + 0.35 * Math.max(0, 1 - Math.hypot(p.x - 68, p.y - 48) / 20) },
    mould: MOULD, moss: MOSS, root: ROOT,
  };
  // 骨格: 腰から首へ斜めに曲がった背骨。頭を前へ低く突き出し、口を大きく開く
  const spine = tube([[34, 62, 0, 6.6], [36, 53, 0, 7.2], [42, 44, 0, 7.6], [50, 39, 1, 6.6], [56, 40, 3, 3]], "skin", { seg: 4, k: 1 });
  const head = ellipsoid([60.5, 44.5, 6], [6.4, 4.8, 5], "skin", 35);
  const brow = ellipsoid([61.5, 43, 9], [3, 1.3, 2], "skin", 30);
  const jaw = ellipsoid([63.5, 51, 7], [3.4, 2.3, 3.6], "skin", 40);
  const maw = U(0, ellipsoid([65.5, 47.5, 10], [3.2, 3, 3.4], "maw", 35), ellipsoid([66.5, 48, 6], [3.2, 2.8, 3.4], "maw", 35));
  // 背骨の瘤と浮いた肋
  const knobs = [[38, 47], [41, 42.5], [45, 39], [49, 36.5]].map(([x, y]) => sphere([x - 1.5, y - 2.5, -1], 1.6, "skin"));
  const ribs = (x, y, z) => (x > 40 && x < 56 && y > 40 && y < 52 ? -0.5 * Math.max(0, Math.sin((x - 40) * 1.2 - (y - 40) * 0.6)) : 0);
  // 腕: 手前の腕は前へだらりと伸び、奥の腕は垂れ下がる
  const armN = tube([[51, 43, 6, 2.8], [56, 54, 9, 2.2], [63, 61, 11, 1.7]], "skin", { seg: 3 });
  const armF = tube([[46, 40, -5, 2.6], [47, 53, -5, 2.1], [50, 63, -4, 1.6]], "skin", { seg: 3 });
  const hands = [...fingers([63.5, 61.5, 11], 65, "skin", { n: 4, len: 4.4, spread: 14, r: 0.65, curl: 0.45 }), ...fingers([50, 63.5, -4], 85, "skin", { n: 4, len: 4, spread: 12, r: 0.6, curl: 0.2 })];
  // 脚: 膝の抜けた千鳥足
  const legs = [tube([[32, 63, -3, 3.6], [26, 74, -1, 2.7], [25, 86, -2, 2]], "skin", { seg: 3 }), tube([[38, 64, 3, 3.6], [45, 74, 5, 2.7], [42, 86, 6, 2]], "skin", { seg: 3 })];
  const feet = [ellipsoid([26, 87, 0], [3, 1.6, 3.4], "skin"), ellipsoid([44, 87, 8], [3.2, 1.6, 3.4], "skin")];
  // 腰布と、肩から裂けて垂れるシャツの残骸
  const pants = Disp(ellipsoid([35, 62, 0], [7.6, 5.4, 5.6], "rag"), (x, y, z) => 0.3 * Math.sin(x * 1.3));
  const rags = [Disp(slab([[28, 60], [42, 60], [44, 72], [40, 69], [37, 74], [33, 69], [29, 73]], 3, 1, "rag", 0.5), (x, y, z) => 0.4 * Math.sin(x * 0.9)),
    Disp(slab([[30, 54], [40, 56], [46, 52], [48, 58], [44, 62], [40, 60], [36, 64], [31, 60]], 6.5, 0.9, "rag", 0.5), (x, y, z) => 0.3 * Math.sin(x))];
  const corpse = Sub(Disp(U(1.4, spine, head, brow, jaw, ...knobs, armN, armF, ...hands, ...legs, ...feet, pants), (x, y, z) => ribs(x, y, z) + 0.2 * fbm(x * 0.7, y * 0.7, z * 0.7)), maw, 0.5);
  // 背と頭のキノコ: 傘を表面の外向きに傾けて群生させる
  const fungi = [];
  const shroom = (bx, by, bz, dx, dy, len, capR, capH = capR * 0.5) => {
    const l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l;
    const tx = bx + ux * len, ty = by + uy * len;
    fungi.push(cone([bx, by, bz], [tx, ty, bz + 0.5], capR * 0.3, capR * 0.22, "stem"));
    const rot = Math.atan2(uy, ux) * 180 / Math.PI + 90;
    fungi.push(Disp(ellipsoid([tx + ux * capH * 0.3, ty + uy * capH * 0.3, bz + 0.5], [capR, capH, capR * 0.9], "cap", rot), (x, y, z) => 0));
    fungi.push(ellipsoid([tx - ux * capH * 0.15, ty - uy * capH * 0.15, bz + 0.5], [capR * 0.92, capH * 0.45, capR * 0.82], "gill", rot));
  };
  shroom(37, 41, 1, -0.3, -1, 5.5, 7.4);
  shroom(30, 48, 0, -1, -0.6, 5, 5.4);
  shroom(45, 35, 2, 0.1, -1, 5.5, 5.6);
  shroom(51, 33.5, 3, 0.4, -1, 3.6, 3.6);
  shroom(55, 37.5, 2, -0.5, -1, 4, 4.6);
  shroom(28, 56, 0, -1, 0.1, 3.6, 3.6);
  shroom(41, 38, 6, -0.1, -1, 2.6, 2.6);
  shroom(33, 45, 4, -0.7, -1, 2.6, 2.4);
  shroom(48, 36, 6, 0.6, -1, 2, 2);
  // 前へ噴き出す胞子の雲 (ブレス): 口から右へ広がる綿の塊
  const R = rand(901);
  const puffs = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8, x = 67 + t * 17, y = 48 - t * 2 + Math.sin(t * 5) * 2, r = 2.4 + t * 9.4;
    puffs.push(sphere([x, y, 6 - t * 6], r, "spore"));
    if (i > 1) for (const s of [-1, 1]) puffs.push(sphere([x + (R() - 0.5) * 4, y + s * r * (0.85 + R() * 0.3), 7 - t * 6 + (R() - 0.3) * 4], r * (0.5 + R() * 0.2), "spore"));
    if (i > 4) puffs.push(sphere([x + (R() - 0.5) * 4, y + (R() - 0.5) * r, 9], r * 0.45, "spore"));
  }
  const cloud = Disp(U(0.4, ...puffs), (x, y, z) => 0.5 * fbm(x * 0.3, y * 0.3, z * 0.3));
  const eyes = [sphere([62.6, 43.4, 10], 0.9, "eye"), sphere([59, 42.8, 10.2], 0.8, "eye")];
  const floor = forestFloor(44, 89, 42, 12, { n: 6, roots: 3, seed: 903 });
  const ground = mushrooms([[14, 86, 4, 1.1], [18, 87, 7, 0.8], [66, 87, 5, 1], [71, 86, 2, 0.7]], "cap", "stem");
  const scene = U(0, floor, ...ground, corpse, ...fungi, ...rags, cloud, ...eyes);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, rimTh: 0.45, lights: [{ p: [72, 48, 16], r: 26, k: 0.35 }] });
  const C = new Canvas(r);
  // 雲の縁はほどけて粒になる
  for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) {
    const p = C.pix[y * 96 + x]; if (!p || p.m !== "spore") continue;
    const edge = !C.get(x - 1, y) || !C.get(x + 1, y) || !C.get(x, y - 1) || !C.get(x, y + 1);
    if (edge && fbm(x * 0.5, y * 0.5, 13) > 0.12) C.set(x, y, null);
  }
  // 胞子の粒: 雲のまわりと傘の上に漂う燐光
  const G = ["#4a5c22", "#7a9438", "#b4cc64", "#e4f2a8"];
  for (let i = 0; i < 60; i++) {
    const a = R() * Math.PI * 2, d = 8 + R() * 14;
    const x = Math.round(80 + Math.cos(a) * d * 1.0), y = Math.round(46 + Math.sin(a) * d * 1.4);
    if (x < 1 || x > 94 || y < 1 || y > 84 || C.get(x, y)) continue;
    C.set(x, y, G[Math.floor(R() * R() * 4)]);
    if (R() < 0.4 && !C.get(x + 1, y)) C.set(x + 1, y, G[0]);
  }
  // 傘から立ちのぼる細い胞子の煙
  for (const [x0, y0] of [[35, 30], [24, 37], [47, 27], [55, 30]]) {
    for (let k = 0; k < 9; k++) { const x = Math.round(x0 + Math.sin(k * 0.8 + x0) * 1.5), y = y0 - k * 1.6; if (y < 1 || C.get(x, Math.round(y))) continue; if (k % 2 === 0) C.set(x, y, G[k < 3 ? 2 : k < 6 ? 1 : 0]); }
  }
  // 眼の芯
  C.set(62, 43, "#e4f2a8");
  leaves(C, 907, 44, 89, 36, 16);
  return C.toArt();
}
