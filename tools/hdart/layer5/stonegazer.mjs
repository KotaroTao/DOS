import { tube, sphere, ellipsoid, cone, slab, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { fingers } from "../human.mjs";
import { MOULD, MOSS, ROOT, RIM, forestFloor, mist, spores, leaves, tri } from "../forest.mjs";
export const meta = { id: "bs_stonegazer", key: "hd_stonegazer", w: 96, h: 96,
  note: "石睨みの大蜥蜴: 鶏冠と棘を背負った苔色の鱗の巨大蜥蜴。黄緑に輝く眼から凝視の光を放ち、その先の床には石にされた犠牲者の半身像と石の手が苔むして転がる" };
export function build() {
  const mats = {
    scale: { ramp: ramp(["#030402", "#090c06", "#11180b", "#1b2611", "#283618", "#364620", "#475a29"], 7), spec: 0.9, pow: 30, specCol: "#9cb070", dither: 0.5,
      shade: p => { const u = p.x * 0.9 + p.y * 0.5, v = p.x * 0.9 - p.y * 0.5 + p.z * 0.4; return -0.09 * Math.pow(Math.max(Math.abs(Math.sin(u)), Math.abs(Math.sin(v))), 6) + 0.06 * fbm(p.x * 0.3, p.y * 0.3, p.z * 0.3); } },
    belly: { ramp: ramp(["#060603", "#1a180d", "#2e2a17", "#4a4426", "#605831"], 5), dither: 0.55, shade: p => -0.08 * Math.pow(Math.abs(Math.sin(p.x * 0.8)), 8) },
    crest: { ramp: ramp(["#080303", "#1e0a07", "#38150c", "#552212", "#74321a"], 5), spec: 0.6, pow: 25, dither: 0.5 },
    horn: { ramp: ramp(["#060504", "#16130e", "#2a251a", "#423a28", "#5e5438", "#7e7450"], 6), spec: 0.8, pow: 30, dither: 0.45 },
    eye: { ramp: ["#4a6a08", "#8cc018", "#d0f040", "#f4ff90"], emit: p => 0.55 + 0.45 * Math.max(0, p.nz) },
    maw: { ramp: ["#000000", "#0a0303", "#160606"], amb: 0.2, dif: 0.25, noRim: true },
    petri: { ramp: ramp(["#060606", "#151514", "#272624", "#3c3a36", "#55534c", "#737068"], 6), spec: 0.3, pow: 18, dither: 0.6,
      shade: p => 0.1 * fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5) },
    mould: MOULD, moss: MOSS, root: ROOT,
  };
  // 体: 右奥から左手前へ、低く這う重い胴。頭は左で鎌首をもたげ、犠牲者を睨みつける
  const spine = [[90, 66, -16, 2.2], [82, 70, -12, 5.5], [70, 72, -6, 11], [57, 70, -1, 12.5], [48, 62, 4, 10], [43, 50, 8, 7.5], [40, 40, 10, 6.5]];
  const body = tube(spine, "scale", { seg: 4, k: 2 });
  const tail = tube([[84, 70, -12, 5.5], [92, 78, -8, 3.6], [90, 86, 0, 2.6], [80, 89, 8, 1.8], [70, 88, 12, 1]], "scale", { seg: 4 });
  const head = ellipsoid([35, 32, 12], [9.5, 7.5, 8.5], "scale", -14);
  const snout = ellipsoid([25, 37, 16], [7.5, 5, 7], "scale", -22);
  const jaw = ellipsoid([29, 42, 14], [9, 3.4, 6.5], "scale", -18);
  const brow = [ellipsoid([29, 27.5, 18], [4, 2.2, 2.8], "scale", -25), ellipsoid([39, 27, 15], [3.8, 2.2, 2.8], "scale", 10)];
  const cheek = ellipsoid([39, 38, 12], [5, 4.5, 5], "scale");
  // 脚: 上腕は横へ張り出し、前腕は床へ。爪で腐葉土をつかむ
  const leg = (sh, el, ft) => [tube([[...sh, 5.2], [...el, 4.2], [...ft, 2.8]], "scale", { seg: 3 }),
    ...[-40, -5, 30].map(a => { const r = a * Math.PI / 180; return cone(ft, [ft[0] + Math.sin(r) * 6, ft[1] + 2.6, ft[2] + Math.cos(r) * 4], 1.7, 0.5, "horn"); })];
  const legs = [...leg([47, 70, 8], [40, 72, 20], [38, 86, 22]), ...leg([50, 66, -8], [56, 70, -16], [56, 82, -16]),
    ...leg([74, 74, 2], [70, 76, 14], [66, 87, 16]), ...leg([78, 70, -14], [86, 74, -18], [86, 82, -18])];
  const bellyN = ellipsoid([60, 77, 4], [15, 4, 8], "belly", -4);
  const lizard = Disp(U(2.4, body, tail, head, snout, jaw, ...brow, cheek, ...legs, bellyN), (x, y, z) => 0.18 * fbm(x * 0.6, y * 0.6, z * 0.6));
  // 背の棘の列 (首から尾へ)
  const spikes = [];
  for (let i = 0; i < 11; i++) {
    const t = i / 10, x = 46 + t * 42, y = 50 + t * 14 - Math.sin(t * Math.PI) * 7, h = 7.5 - t * 4.5;
    spikes.push(cone([x - 1, y + 2, -2 - t * 6], [x + 2.5, y - h, -4 - t * 6], 2.3 - t * 0.9, 0.3, "horn"));
  }
  // 鶏冠: 頭頂から首の後ろへ、ぎざぎざに立つ赤黒い冠
  const crestP = [[27, 25], [26, 18], [30, 21], [31, 12], [35, 18], [38, 10], [40, 18], [45, 13], [45, 22], [50, 19], [48, 28], [53, 28], [47, 33], [38, 28]];
  const crestN = Disp(slab(crestP, 8, 1.3, "crest", 0.6, 0.6), (x, y, z) => 0.3 * Math.sin(x * 1.3));
  const wattle = ellipsoid([31, 46, 13], [2.4, 3.8, 2], "crest", 15);
  const hornL = cone([43, 29, 8], [52, 24, 2], 1.8, 0.3, "horn");
  const mouth = ellipsoid([25, 42, 18], [7.5, 1, 3], "maw", -18);
  const sockets = U(0, ellipsoid([29.5, 30.5, 19], [3, 2.1, 2], "maw", -20), ellipsoid([39.5, 30, 17], [2.8, 2, 2], "maw", 12));
  const eyes = [ellipsoid([29.5, 30.9, 18.6], [2.4, 1.2, 1.2], "eye", -20), ellipsoid([39.5, 30.4, 16.6], [2.2, 1.1, 1.2], "eye", 12)];
  // 石にされた犠牲者: 腰まで床に沈み、腕で顔をかばった姿のまま固まった半身像
  const statue = Paint(Disp(U(0,
    U(0.6, ellipsoid([13, 66, 14], [4.4, 5.2, 4.4], "petri", 15), tube([[14, 70, 13, 2.2], [14, 73, 12, 2.6]], "petri")), // 頭と首 (仰け反る)
    U(1.2, ellipsoid([14, 80, 12], [9, 6.5, 5.5], "petri"), ellipsoid([14, 88, 11], [8, 4, 5], "petri"),
      tube([[22, 76, 14, 2.6], [25, 68, 20, 2.1], [19, 62, 22, 1.7]], "petri", { seg: 3 }), // 顔をかばう腕
      tube([[6, 76, 12, 2.6], [2, 82, 17, 2.2], [3, 90, 18, 1.8]], "petri", { seg: 3 })),
    ...fingers([19, 62, 22], -160, "petri", { n: 4, len: 3.6, spread: 16, r: 0.75, curl: 0.3, z: 0.5 })), (x, y, z) => 0.2 * fbm(x * 0.7, y * 0.7, z * 0.7)),
    (x, y, z, m) => (y < 63 + 2 * fbm(x * 0.4, z * 0.4) && x > 10) || (y > 86 && fbm(x * 0.4, y * 0.4, z * 0.4) > -0.05) || fbm(x * 0.5, y * 0.5, z * 0.5 + 9) > 0.32 ? "moss" : m);
  const hand = Paint(U(0.8, tube([[78, 93, 20, 2.2], [80, 87, 22, 1.8]], "petri"), ...fingers([80, 87, 22], -70, "petri", { n: 4, len: 3.8, spread: 25, r: 0.7, curl: 0.5, z: 1 })),
    (x, y, z, m) => fbm(x * 0.5, y * 0.5, z * 0.5) > 0.18 ? "moss" : m);
  const scene = U(0, forestFloor(50, 91, 46, 16, { n: 5, roots: 2, seed: 551 }), Sub(lizard, U(0, mouth, sockets), 0.5), ...eyes, ...spikes, crestN, wattle, hornL, statue, hand);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [22, 30, 24], r: 20, k: 0.35 }, { p: [18, 56, 26], r: 16, k: 0.3 }] });
  const C = new Canvas(r);
  // 縦に細い瞳
  for (const [x, y] of [[29, 30], [29, 31], [39, 30], [39, 31]]) C.set(x, y, "#1a2402");
  for (const [x, y] of [[26, 29], [27, 28], [32, 29], [31, 28], [36, 28], [42, 28]]) C.set(x, y, "#a8d838");
  // 牙
  for (const x of [20, 23, 26, 29]) { C.only(x, 43 + Math.round((x - 20) * 0.3), "#7e7450"); C.set(x, 44 + Math.round((x - 20) * 0.3), x % 2 ? "#5e5438" : "#7e7450"); }
  // 凝視の光: 眼から石像へ射す扇状の光線
  const Gz = ["#3a5208", "#6a9a14", "#a8d838", "#e0ff90"];
  // 眼を頂点とする扇: 軸からの角度と距離で濃さを決め、空いている所にディザで置く
  const BY = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  const fan = (x0, y0, x1, y1, half, reach) => {
    const ax = x1 - x0, ay = y1 - y0, al = Math.hypot(ax, ay);
    for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) {
      if (C.get(x, y)) continue;
      const dx = x + 0.5 - x0, dy = y + 0.5 - y0, d = Math.hypot(dx, dy); if (d < 3 || d > al * reach) continue;
      const c = (dx * ax + dy * ay) / (d * al); if (c <= 0) continue;
      const ang = Math.acos(Math.min(1, c)), h = half * (0.35 + 0.65 * d / al);
      if (ang > h) continue;
      const a = (1 - ang / h) * (1.05 - 0.6 * d / (al * reach));
      if (a * 1.1 > (BY[y & 3][x & 3] + 0.5) / 16) C.set(x, y, Gz[Math.min(3, Math.floor(a * 3.4))]);
    }
  };
  fan(28.5, 31.5, 14, 64, 0.2, 1.05);
  fan(28, 31.5, 4, 48, 0.07, 1.0);
  // 光を浴びた石像の縁を照らす
  for (let y = 56; y < 92; y++) for (let x = 0; x < 30; x++) { const p = C.pix[y * 96 + x]; if (p && (p.m === "petri" || p.m === "moss") && p.nx > 0.35 && p.ny < 0.2 && (x + y) % 2 === 0) C.set(x, y, Gz[1]); }
  // 石化の粒 (石像のまわりに舞う灰色の粉)
  const Rp = rand(557);
  for (let i = 0; i < 14; i++) { const x = 2 + Rp() * 26, y = 46 + Rp() * 20; if (!C.get(Math.round(x), Math.round(y))) C.set(x, y, Rp() < 0.4 ? Gz[2] : "#5c5a53"); }
  mist(C, 553, 2, [30, 4, 66, 30], 0.28);
  spores(C, 555, 8, [50, 4, 44, 30]);
  leaves(C, 559, 48, 90, 42, 18);
  return C.toArt();
}
