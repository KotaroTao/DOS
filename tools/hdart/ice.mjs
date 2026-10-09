// 第8層「氷結回廊」の共通部品: 奈落の壁に張り出した氷の棚 (青黒い氷の床と雪だまり・氷塊)、
// 上を向いた面の霜、下へ垂れる氷柱、降る雪と霜の粒、氷に閉じ込められた魂の光 (極光)、冷たい青白い縁光
import { ellipsoid, box, cone, U, Disp, Paint, ramp, fbm, vnoise, rand } from "./sdf.mjs";
export { tri } from "./mine.mjs";
export { afterimage, dissolve } from "./temple.mjs";
export { puffs, scaleAt, spikes } from "./lava.mjs";
export const BY = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const by = (x, y) => (BY[y & 3][x & 3] + 0.5) / 16;
// 氷のひび: 稜線ノイズが閾値を超えた所
export const iceCrack = (x, z, f = 0.2, th = 0.9) => Math.pow(1 - Math.abs(vnoise(x * f, z * f, 5.3)), 6) > th;
// 氷棚の床: 青黒く透ける古い氷。ひびが白く走り、鈍い鏡面に縁光が映る
export const SHELF = { ramp: ramp(["#020306", "#050a10", "#0a121c", "#101b28", "#172535", "#203244"], 6), dither: 0.8, amb: 0.42, dif: 0.55, noRim: true,
  spec: 0.9, pow: 50, specCol: "#4e6e8a", shade: p => 0.12 * fbm(p.x * 0.35, p.z * 0.35) + (iceCrack(p.x, p.z) ? 0.3 : 0) };
// 吹きだまった雪: 青みのある鈍い白。影は深い藍
export const SNOW = { ramp: ramp(["#04060a", "#0b111a", "#162130", "#243446", "#36495e", "#4c6278", "#667e94"], 7), dither: 0.75, amb: 0.34,
  shade: p => 0.07 * fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5) };
// 氷塊・氷の鎧・氷の殻: 透き通る青。鋭い鏡面と、奥に沈む白い気泡
export const ICE = { ramp: ramp(["#03060c", "#07111e", "#0d1d31", "#152a44", "#1f3b58", "#2c4f6e", "#3e6684", "#5a849e"], 8), spec: 1.4, pow: 40, specCol: "#d4eaf6", dither: 0.5,
  shade: p => 0.1 * fbm(p.x * 0.4, p.y * 0.4, p.z * 0.4) + (Math.pow(1 - Math.abs(vnoise(p.x * 0.3, p.y * 0.3, p.z * 0.3)), 8) > 0.8 ? 0.18 : 0) };
// 氷結回廊の縁光 (極光の照り返しが氷の霧に散った、冷たい青白)
export const RIM = "#6890b0";
// 霜・雪の粒の色 (暗→明)
export const FROST = ["#26364a", "#435a74", "#6c88a4", "#a8c4dc", "#e6f4ff"];
// 氷に閉じ込められた魂の光 (暗→明)。眼・呪の輪・胸の灯に
export const SOUL = ["#0c2440", "#1e4c7a", "#4686bc", "#94c8ec", "#e4f6ff"];
// 極光の帳の色 (暗→明): 緑 / 紫
export const AURORA = { green: ["#071c18", "#0e3a2e", "#1a6a4c", "#34a87a", "#7ae0b0"], violet: ["#120c26", "#241a4a", "#3e2e78", "#6a52aa", "#a690dc"] };
// 足元に敷く氷棚の床 + 雪だまり + 転がる氷塊 (n 個)。床 "shelf"、雪 "snow"、氷塊 "ice"
export function iceFloor(cx, cy, rx, rz = 14, { n = 4, seed = 3, big = 3.2, snow = 0.05, shards = 0 } = {}) {
  const R = rand(seed);
  const bed = Disp(ellipsoid([cx, cy, -2], [rx, 3.6, rz], "shelf"), (x, y, z) => 0.25 * fbm(x * 0.3, z * 0.3) - 0.6 * Math.max(0, fbm(x * 0.12 + seed, z * 0.2, 2.1) - snow) );
  const parts = [Paint(bed, (x, y, z, m) => (m === "shelf" && fbm(x * 0.12 + seed, z * 0.2, 2.1) > snow) ? "snow" : m)];
  for (let i = 0; i < n; i++) {
    const a = R() * Math.PI * 2, d = 0.5 + R() * 0.45;
    const x = cx + Math.cos(a) * rx * d, z = -2 + Math.sin(a) * rz * d * 0.9, s = big * (0.55 + R() * 0.6);
    parts.push(Disp(box([x, cy - 2 - s * 0.45, z], [s * 1.1, s * 0.75, s * 0.9], "ice", s * 0.15, R() * 70 - 35), (X, Y, Z) => 0.25 * fbm(X * 0.6, Y * 0.6, Z * 0.6)));
  }
  // 床から突き出す氷の刃
  for (let i = 0; i < shards; i++) {
    const a = R() * Math.PI * 2, d = 0.55 + R() * 0.4;
    const x = cx + Math.cos(a) * rx * d, z = -2 + Math.sin(a) * rz * d * 0.9, h = big * (1.6 + R() * 1.6);
    parts.push(cone([x, cy - 2, z], [x + (R() - 0.5) * h * 0.6, cy - 2 - h, z], big * 0.7, 0.2, "ice"));
  }
  return U(0, ...parts);
}
// 上を向いた面 (法線 y−) に霜をまぶす。mats の材質だけ。元の色より明るい時だけ置き換える
const lum = c => { const v = parseInt(c.slice(1), 16); return ((v >> 16) & 255) * 0.3 + ((v >> 8) & 255) * 0.55 + (v & 255) * 0.15; };
export function hoarfrost(C, mats, { k = 1, th = 0.35, seed = 1, cols = FROST } = {}) {
  const M = new Set([].concat(mats));
  for (let y = 0; y < C.H; y++) for (let x = 0; x < C.W; x++) {
    const p = C.pix[y * C.W + x], c = C.get(x, y);
    if (!p || !c || !M.has(p.m)) continue;
    const s = (-p.ny - th) * k + 0.35 * fbm(x * 0.4, y * 0.4, seed) - 0.1;
    if (s <= by(x, y) * 0.9) continue;
    const g = cols[Math.max(0, Math.min(cols.length - 1, Math.floor(s * cols.length * 0.9) + (p.sh > 0.5 ? 1 : 0)))];
    if (lum(g) > lum(c)) C.set(x, y, g);
  }
}
// 下へ垂れる氷柱 (2D): mats の画素の下端から、空いた所へ先細りの氷柱を垂らす
export function icicles(C, seed, mats, rate = 0.18, maxLen = 5, cols = ["#152a44", "#3e6684", "#a8c4dc"]) {
  const R = rand(seed), M = new Set([].concat(mats));
  for (let x = 1; x < C.W - 1; x += 1) for (let y = 1; y < C.H - 2; y++) {
    const p = C.pix[y * C.W + x]; if (!p || !M.has(p.m) || C.get(x, y + 1) || R() > rate) continue;
    if (C.get(x - 1, y + 1) && C.get(x + 1, y + 1)) continue;
    const l = 1 + Math.floor(R() * maxLen);
    for (let k = 1; k <= l; k++) { if (C.get(x, y + k)) break; C.set(x, y + k, cols[k === l ? 2 : k === 1 ? 0 : 1]); }
    if (l >= 3 && !C.get(x + 1, y + 1)) C.set(x + 1, y + 1, cols[0]);
    x += 1;
  }
}
// 降る雪 (空いている所だけ)。ほとんどは1粒、まれに斜めの2粒
export function snowfall(C, seed, n, area = [2, 2, C.W - 4, C.H - 4], cols = FROST) {
  const R = rand(seed);
  for (let i = 0; i < n; i++) {
    const x = Math.round(area[0] + R() * area[2]), y = Math.round(area[1] + R() * area[3]);
    if (C.get(x, y)) continue;
    const k = Math.min(cols.length - 1, Math.floor(R() * R() * cols.length * 1.3));
    C.set(x, y, cols[k]);
    if (k >= 2 && R() < 0.3 && !C.get(x - 1, y + 1)) C.set(x - 1, y + 1, cols[k - 2]);
  }
}
// 氷のきらめき: mats の画素のうち明るい所に、まばらに白い十字の光を置く
export function glints(C, seed, mats, n = 6, cols = ["#a8c4dc", "#e6f4ff"]) {
  const R = rand(seed), M = new Set([].concat(mats)), cand = [];
  for (let y = 1; y < C.H - 1; y++) for (let x = 1; x < C.W - 1; x++) { const p = C.pix[y * C.W + x]; if (p && M.has(p.m) && p.sh > 0.5 && p.nz > 0.3) cand.push([x, y]); }
  for (let i = 0; i < n && cand.length; i++) {
    const [x, y] = cand[Math.floor(R() * cand.length)];
    C.set(x, y, cols[1]);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (R() < 0.7) C.set(x + dx, y + dy, cols[0]);
  }
}
// 極光の帳 (2D・空いている所だけ): 上端が波打つ縦の光の幕。下へ向かって薄れる
//   bands = [[x0, x1, 上端y, 丈, 色の段 (AURORA.green など), seed], ...]
export function aurora(C, bands, dens = 0.8) {
  for (const [x0, x1, top, len, cols, seed] of bands) {
    for (let x = Math.floor(x0); x <= x1; x++) {
      const t0 = top + 4 * Math.sin(x * 0.18 + seed) + 3 * fbm(x * 0.1, seed);
      const ray = (0.55 + 0.45 * Math.abs(Math.sin(x * 0.9 + seed * 2.3 + 2 * fbm(x * 0.15, seed + 1)))) * Math.min(1, (x - x0) / 10, (x1 - x) / 10);
      for (let y = Math.floor(t0); y < t0 + len; y++) {
        if (x < 0 || y < 0 || x >= C.W || y >= C.H || C.get(x, y)) continue;
        const f = 1 - (y - t0) / len, v = dens * ray * (f < 0.85 ? f / 0.85 : 1 - (f - 0.85) * 2.5);
        if (v < by(x, y) * 0.9) continue;
        C.set(x, y, cols[Math.max(0, Math.min(cols.length - 1, Math.floor(v * cols.length)))]);
      }
    }
  }
}
// 冷気の息・吹雪の扇 (2D・空いている所だけ): (ox, oy) から角度 ang (度) へ長さ len、開き spread (度)
export function breathFan(C, ox, oy, ang, len, spread, { seed = 1, cols = ["#1e3046", "#3e5a78", "#7a9cb8", "#bcd8ec", "#f0faff"], own = [], dens = 1 } = {}) {
  const a0 = ang * Math.PI / 180, sp = spread * Math.PI / 180;
  for (let y = 0; y < C.H; y++) for (let x = 0; x < C.W; x++) {
    const dx = x + 0.5 - ox, dy = y + 0.5 - oy, d = Math.hypot(dx, dy);
    if (d > len || d < 1) continue;
    let da = Math.atan2(dy, dx) - a0; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
    const w = sp * (0.25 + 0.75 * d / len) / 2;
    if (Math.abs(da) > w) continue;
    const p = C.pix[y * C.W + x]; if (C.get(x, y) && !(p && own.includes(p.m))) continue;
    const v = dens * (1 - Math.abs(da) / w) * (1 - 0.6 * d / len) + 0.3 * fbm(x * 0.35, y * 0.35, seed) - 0.05;
    if (v < by(x, y) * 0.75) continue;
    C.set(x, y, cols[Math.max(0, Math.min(cols.length - 1, Math.floor(v * cols.length)))]);
  }
}
// 氷の結晶の印 (2D): 六本の枝の雪の結晶。呪の輪の飾りや眼の光に
export function crystal(C, cx, cy, r, cols = SOUL, own = null) {
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3 - Math.PI / 2;
    for (let k = 0; k <= r; k++) {
      const x = cx + Math.cos(a) * k, y = cy + Math.sin(a) * k;
      if (own && C.get(Math.round(x), Math.round(y)) && !own(x, y)) continue;
      C.set(x, y, cols[Math.max(0, cols.length - 2 - Math.floor(k / r * 2))]);
      if (k === Math.round(r * 0.6)) for (const s of [-1, 1]) C.set(x + Math.cos(a + s * 0.9) * 1.4, y + Math.sin(a + s * 0.9) * 1.4, cols[1]);
    }
  }
  C.set(cx, cy, cols[cols.length - 1]);
}
// 氷のひび割れ模様の Disp (表面に細い割れ目)
export const iceCracks = (k = 0.6, f = 0.32) => (x, y, z) => k * Math.pow(1 - Math.abs(vnoise(x * f, y * f, z * f + 2.2)), 8);
export { Paint };
