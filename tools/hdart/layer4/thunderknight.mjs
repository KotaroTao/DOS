import { sphere, ellipsoid, cone, slab, cyl, box, torus, tube, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { FLAG, STONE, WOOD, RIM, flagstones, grit, flutter } from "../fort.mjs";
export const meta = { id: "bs_thunderknight", key: "hd_thunderknight", w: 96, h: 96,
  note: "雷電の騎士: 紺鉄の鎧に真鍮の角飾りの兜。後ろ足を伸ばし前のめりに踏み込んで長槍を突き出す躍動の構え、外套は後ろへ激しくなびく。槍の柄から穂先へ白青の稲妻がのたうち、兜の覗き穴にも雷光が宿る" };
export function build() {
  const mats = {
    navy: { ramp: ramp(["#020306", "#060a14", "#0c1424", "#121e34", "#1a2a46", "#243858", "#30486c", "#405c84", "#58769e"], 9), spec: 1.6, pow: 40, specCol: "#b8d0f0", dither: 0.45, amb: 0.17,
      shade: p => 0.08 * fbm(p.x * 0.35, p.y * 0.35, p.z * 0.35) },
    brass: { ramp: ramp(["#050302", "#171005", "#2e220c", "#4a3814", "#6a521e", "#8e7030", "#b0924a"], 7), spec: 1.4, pow: 35, specCol: "#ffeab0", dither: 0.4 },
    cape: { ramp: ramp(["#030306", "#08080f", "#100f1a", "#191726", "#232034", "#2f2a44"], 6), dither: 0.7, amb: 0.22,
      shade: p => 0.12 * Math.sin(p.y * 0.7 + p.x * 0.15) },
    steel: { ramp: ramp(["#05070a", "#10141a", "#1e2530", "#303a48", "#485668", "#66788e", "#8ea2b8"], 7), spec: 2, pow: 45, specCol: "#f0f8ff", dither: 0.4 },
    leather: { ramp: ramp(["#030202", "#0e0907", "#1a110c", "#281a12", "#36241a"], 5), dither: 0.5 },
    void: { ramp: ["#000000", "#000000", "#010103"], amb: 0, dif: 0.05, noRim: true },
    flag: FLAG, stone: STONE, wood: WOOD,
  };
  // 槍の線: 柄尻 B → 穂先 T
  const B = [30, 66, 8], T = [93, 27, 5];
  const at = t => B.map((v, i) => v + (T[i] - v) * t);
  const hb = at(0.33), hf = at(0.66);
  // 前のめりの胴 (右へ傾く)
  const chest = U(1, ellipsoid([50, 40, 0], [10, 8.6, 7], "navy", -24), ellipsoid([51, 41, 2.4], [2, 8, 6], "navy", -24));
  const trim = Sub(ellipsoid([50, 40, 0.3], [10.4, 9, 7.3], "brass", -24), ellipsoid([50, 38.6, 0.3], [10.6, 9, 7.6], "brass", -24));
  const waist = ellipsoid([45, 51, -0.5], [7.6, 5.4, 6], "navy", -18);
  const faulds = [0, 1].map(i => Sub(ellipsoid([43 - i, 57.5 + i * 3.4, -0.5], [9 + i, 2.4, 7 + i * 0.5], "navy", -14), ellipsoid([43 - i, 55.6 + i * 3.4, -0.5], [8 + i, 2.4, 6.4 + i * 0.5], "navy", -14)));
  const gorget = cyl([56, 27, 1], [53, 32, 1], 5, "navy", 1.4);
  // 兜: 前へ突き出た丸兜、細い覗き穴、真鍮の角
  const helm = Sub(U(0.6, ellipsoid([58, 21, 2], [7.2, 8, 6.8], "navy", -16), cone([60, 23, 4], [65, 26, 6], 4.6, 2.4, "navy")),
    box([61.5, 21.8, 9], [4.4, 0.8, 3.4], "void", 0.2, -10), 0.3);
  const hornL = tube([[56, 15, 6, 2], [51, 11, 7, 1.7], [45, 9, 7, 1.3], [39, 9.5, 6, 0.8], [35, 12, 5, 0.4]], "brass");
  const hornR = tube([[60, 14, -1, 1.9], [56, 8, -2, 1.6], [50, 4.5, -3, 1.2], [44, 4, -4, 0.7], [40, 6, -4, 0.35]], "brass");
  const brow = torus([58, 18.5, 2], 6.4, 0.7, "brass", -16, 90 - 70);
  // 肩当て: 尖った大肩
  const paulN = [ellipsoid([55, 33, 6], [7, 4.6, 6], "navy", -30), ellipsoid([56.5, 36.4, 7], [6, 2.8, 5], "navy", -34)];
  const paulF = ellipsoid([46, 31, -5], [6.4, 4, 5.4], "navy", -10);
  // 腕: 奥の腕は前へ伸ばし穂先側を握る、手前の腕は柄の後ろを握る
  const armF = [tube([[47, 33, -4, 3], [61, 37, 0, 2.7], [hf[0] - 1, hf[1] + 1, hf[2] - 1, 2.4]], "navy", { seg: 3 }), ellipsoid([hf[0], hf[1] + 0.5, hf[2] + 1], [3, 2.8, 3], "navy")];
  const armN = [tube([[55, 37, 6, 3.1], [46, 46, 10, 2.8], [hb[0] - 1, hb[1], hb[2] + 2, 2.4]], "navy", { seg: 3 }), sphere([46, 46, 10], 2.6, "brass"), ellipsoid([hb[0], hb[1], hb[2] + 3], [3.2, 3, 3], "navy")];
  // 脚: 後ろ足を伸ばし、前足は膝を曲げて踏み込む
  const legB = [tube([[40, 61, -3, 4.2], [30, 74, -2, 3.4], [21, 86, -1, 2.8]], "navy", { seg: 3 }), sphere([30, 74, 0], 3, "navy"), ellipsoid([22, 88.5, 0], [5.4, 2.4, 4.6], "navy", 6)];
  const legN = [tube([[47, 61, 2, 4.4], [61, 69, 4, 3.6], [64, 86, 3, 3]], "navy", { seg: 3 }), ellipsoid([61.5, 69, 6.4], [3.6, 3, 3], "navy"), sphere([61.5, 69, 7.6], 1.3, "brass"), ellipsoid([67, 88.5, 4], [6, 2.5, 5], "navy")];
  // 長槍: 柄・鍔・葉形の大穂先
  const shaft = cyl(B, at(0.84), 1.3, "leather", 0.2);
  const dx = T[0] - B[0], dy = T[1] - B[1], L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
  const P = (s, w) => [T[0] - ux * s + nx * w, T[1] - uy * s + ny * w];
  const head = slab([P(0, 0), P(7, 3.4), P(14, 1.8), P(16, 1), P(16, -1), P(14, -1.8), P(7, -3.4)], 5.2, 1, "steel", 0.3, 0.6);
  const socket = cyl([...P(15, 0), 5.4], [...P(19, 0), 5.8], 1.7, "brass", 0.4);
  const wings = cyl([...P(18.5, -4), 5.8], [...P(18.5, 4), 5.8], 0.9, "brass", 0.3);
  // 外套: 肩から後ろ (左) へ吹き流れる
  const capePoly = [[50, 28], [42, 26], [32, 22], [20, 19], [9, 21], [3, 28], [7, 33], [2, 40], [9, 44], [5, 52], [14, 54], [16, 62], [24, 58], [30, 54], [38, 47], [44, 38]];
  const cape = Sub(Disp(slab(capePoly, -8, 1.6, "cape", 0.8), (x, y, z) => 0.7 * Math.sin(y * 0.55 - x * 0.12 + 1.2 * fbm(x * 0.12, y * 0.12))),
    U(0, sphere([12, 36, -8], 1.8, "cape"), sphere([20, 48, -8], 1.5, "cape")));
  const scene = U(0, flagstones(46, 92, 42, 12, { n: 4, seed: 81 }),
    cape, chest, trim, waist, ...faulds, gorget, helm, hornL, hornR, brow, ...paulN, paulF, ...armF, ...armN, ...legB, ...legN, shaft, head, socket, wings);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [80, 34, 14], r: 34, k: 0.55 }] });
  const C = new Canvas(r);
  // 稲妻: 柄にまとわりつき、穂先から前へ走る
  const Z = ["#1a3a8a", "#3a78e0", "#9cd4ff", "#ffffff"];
  const R = rand(83);
  const bolt = (x0, y0, x1, y1, amp, seg, width) => {
    const pts = [[x0, y0]];
    const lx = x1 - x0, ly = y1 - y0, ll = Math.hypot(lx, ly), qx = -ly / ll, qy = lx / ll;
    for (let i = 1; i < seg; i++) { const t = i / seg, o = (R() * 2 - 1) * amp; pts.push([x0 + lx * t + qx * o, y0 + ly * t + qy * o]); }
    pts.push([x1, y1]);
    for (let k = 0; k < pts.length - 1; k++) {
      const [ax, ay] = pts[k], [bx, by] = pts[k + 1];
      if (width) for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) C.line(ax + ox, ay + oy, bx + ox, by + oy, Z[width > 1 ? 1 : 0]);
      C.line(ax, ay, bx, by, Z[width ? 2 : 1]);
    }
    for (let k = 1; k < pts.length - 1; k++) if (width) C.set(pts[k][0], pts[k][1], Z[3]);
    return pts;
  };
  // 柄にからむ稲妻 (二筋が柄を巻く)
  const main = bolt(...at(0.1).slice(0, 2), ...P(20, 0), 3, 12, 2);
  bolt(...at(0.4).slice(0, 2), ...P(21, 0), 2.4, 7, 1);
  // 穂先から前方へ散る枝
  bolt(...P(-0.5, 0), 95, 17, 2.5, 4, 1);
  bolt(...P(0, 0), 95, 35, 2, 3, 0);
  bolt(...P(7, -3.4), 84, 11, 2, 3, 0);
  bolt(...P(7, 3.4), 92, 44, 1.5, 2, 0);
  { const [px, py] = main[4]; bolt(px, py, px - 4, py + 10, 2, 3, 0); }
  // 覗き穴の雷光
  for (let x = 58; x <= 65; x++) C.only(x, 22, x % 2 ? Z[2] : Z[3]);
  // 足元の火花
  for (let i = 0; i < 10; i++) { const a = -Math.PI * R(), d = 2 + R() * 6; C.set(67 + Math.cos(a) * d, 89 + Math.sin(a) * d * 0.5, Z[1 + Math.floor(R() * 3)]); }
  grit(C, 87, 46, 91, 38);
  return C.toArt();
}
