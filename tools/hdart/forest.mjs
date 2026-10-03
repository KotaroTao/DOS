// 第5層「霧の森」の共通部品: 足元の腐葉土と苔むした根、落ち葉とキノコ、宙を漂う霧の筋と胞子
import { ellipsoid, sphere, cone, tube, U, Disp, Paint, ramp, fbm, vnoise, rand } from "./sdf.mjs";
export { tri } from "./mine.mjs";
// 腐葉土の床: 湿った黒土に落ち葉が積もる、照り返しの少ない暗い緑褐色
export const MOULD = { ramp: ramp(["#020302", "#070906", "#0d110b", "#141a10", "#1c2416", "#262f1d"], 6), dither: 0.9, amb: 0.42, dif: 0.55, noRim: true,
  shade: p => 0.16 * fbm(p.x * 0.35, p.z * 0.35) + (vnoise(p.x * 0.8, p.z * 0.8) > 0.45 ? 0.12 : 0) };
// 苔: 床の盛り上がりや根・岩を覆う、湿ってくすんだ緑
export const MOSS = { ramp: ramp(["#020402", "#081008", "#0f1c0e", "#172a14", "#21391b", "#2d4923", "#3c5c2d"], 7), dither: 0.8, amb: 0.3,
  shade: p => 0.18 * fbm(p.x * 0.7, p.y * 0.7, p.z * 0.7) };
// 古い根・朽ち木 (樹皮の縦筋)
export const ROOT = { ramp: ramp(["#030202", "#0b0806", "#15100b", "#211910", "#2e2317", "#3d301f", "#4f3f2a"], 7), dither: 0.55, spec: 0.2, pow: 14,
  shade: p => 0.14 * Math.sin(p.x * 1.6 + 2.2 * fbm(p.x * 0.25, p.y * 0.25, p.z * 0.25)) + 0.06 * fbm(p.x, p.y, p.z) };
// 霧の森の寒い縁光 (月明かりが霧に散った、くすんだ青緑の灰)
export const RIM = "#4e6a64";
// 霧の色 (暗→明)。霧の筋 (mist) と遠景のもやに使う
export const MIST = ["#141c1c", "#1d2828", "#283636", "#364646", "#485a58", "#5e726e"];
// 足元に敷く腐葉土の平たい塚 + 這う根 (roots 本) と苔の塊 (n 個)。床 "mould"、根 "root"、苔 "moss" 材質
export function forestFloor(cx, cy, rx, rz = 14, { n = 5, roots = 3, seed = 3 } = {}) {
  const R = rand(seed);
  const bed = Disp(ellipsoid([cx, cy, -2], [rx, 3.8, rz], "mould"), (x, y, z) => 0.4 * fbm(x * 0.3, z * 0.3) + 0.35 * Math.max(0, vnoise(x * 0.7, z * 0.7) - 0.2));
  const lumps = [];
  for (let i = 0; i < n; i++) {
    const a = R() * Math.PI * 2, d = 0.5 + R() * 0.45;
    const x = cx + Math.cos(a) * rx * d, z = -2 + Math.sin(a) * rz * d * 0.9, s = 2.2 + R() * 2.2;
    lumps.push(Disp(ellipsoid([x, cy - 2.4, z], [s * 1.4, s * 0.7, s], "moss"), (X, Y, Z) => 0.4 * fbm(X * 0.8, Y * 0.8, Z * 0.8)));
  }
  const rs = [];
  for (let i = 0; i < roots; i++) {
    const side = i % 2 ? 1 : -1, x0 = cx + side * (rx * (0.15 + R() * 0.3)), z0 = -4 + R() * 6;
    const x1 = x0 + side * (8 + R() * 10), x2 = x1 + side * (5 + R() * 6);
    rs.push(tube([[x0, cy - 2.6, z0, 1.8], [x1, cy - 1.8 - R() * 1.5, z0 + 2 + R() * 3, 1.3], [x2, cy - 0.8, z0 + 4 + R() * 4, 0.6]], "root", { seg: 3 }));
  }
  return U(0.8, bed, ...lumps, ...rs);
}
// 床から生える小さなキノコ (SDF)。[x, y(床の高さ), z, 大きさ]。傘 cap、柄 stem の材質名を渡す
export function mushrooms(list, cap = "cap", stem = "stem") {
  return list.map(([x, y, z, s = 1]) => U(0.3,
    cone([x, y, z], [x + 0.3 * s, y - 3 * s, z], 0.7 * s, 0.5 * s, stem),
    Disp(ellipsoid([x + 0.3 * s, y - 3.3 * s, z], [2.1 * s, 1.1 * s, 2.1 * s], cap), (X, Y, Z) => Math.max(0, (Y - (y - 3.3 * s)) * 0.9))));
}
// 宙を漂う霧の筋 (2D): 空いている所だけに、横に流れる淡い帯をまばらなディザで置く
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
export function mist(C, seed, bands = 3, area = [0, 0, C.W, C.H], dens = 0.35) {
  const R = rand(seed);
  for (let b = 0; b < bands; b++) {
    const y0 = area[1] + R() * area[3], th = 2 + R() * 4, ph = R() * 10, k = Math.floor(R() * 3);
    for (let x = area[0]; x < area[0] + area[2]; x++) {
      const yc = y0 + Math.sin(x * 0.09 + ph) * 2.5;
      for (let y = Math.floor(yc - th); y <= yc + th; y++) {
        if (y < 0 || y >= C.H || x < 0 || x >= C.W || C.get(x, y)) continue;
        const a = dens * (1 - Math.abs(y - yc) / th) * (0.5 + 0.5 * fbm(x * 0.12, y * 0.2, b * 7 + seed));
        if (a > (BAYER[y & 3][x & 3] + 0.5) / 16) C.set(x, y, MIST[Math.min(MIST.length - 1, k + (a > 0.35 ? 1 : 0))]);
      }
    }
  }
}
// 宙を漂う胞子・羽虫の光 (空いている所だけ)。glow=true で淡い黄緑の燐光
export function spores(C, seed, n, area = [2, 2, C.W - 4, C.H - 4], glow = false) {
  const R = rand(seed);
  const cols = glow ? ["#3a4a1a", "#6a8a2a", "#a8c850", "#e0f0a0"] : ["#1d2622", "#2a3630", "#3e4c44", "#566860"];
  for (let i = 0; i < n; i++) {
    const x = area[0] + R() * area[2], y = area[1] + R() * area[3];
    if (!C.get(Math.round(x), Math.round(y))) C.set(x, y, cols[Math.min(cols.length - 1, Math.floor(R() * R() * cols.length * 1.6))]);
  }
}
// 床の上の落ち葉 (2D): 床の上にだけ、くすんだ黄褐と赤褐の点を散らす
export function leaves(C, seed, cx, cy, rx, n = 22) {
  const R = rand(seed);
  const cols = ["#3a2a12", "#4e3616", "#5a2a14", "#2e3416"];
  for (let i = 0; i < n; i++) {
    const x = Math.round(cx + (R() * 2 - 1) * rx), y = Math.round(cy + (R() * 2 - 1) * 2.5);
    if (C.get(x, y)) { const c = cols[Math.floor(R() * cols.length)]; C.set(x, y, c); if (R() < 0.5) C.set(x + 1, y, c); C.set(x, y + 1, "#050604"); }
  }
}
// 樹皮・枝葉のゆらぎ (Disp に渡す)
export const bark = (k = 0.5, f = 1.4) => (x, y, z) => k * Math.abs(Math.sin(x * f + 2 * fbm(x * 0.2, y * 0.2, z * 0.2)));
export { Paint, sphere };
