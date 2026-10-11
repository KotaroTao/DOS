// 第11層「闘技場跡」の共通部品: 雲の上の石橋の先、灰に埋もれた古い闘技場の町。
// 血の染みた砂の床と半ば埋もれた石畳・折れた剣・兜、すり鉢形の石の観客席、鎖と杭、雪のように降る灰と熾火の名残、
// 夕暮れの雲海の冷たい縁光、闘士の霊の胸に揺れる青白い魂の灯
import { ellipsoid, sphere, box, cone, cyl, slab, U, Sub, Disp, Paint, ramp, fbm, vnoise, rand } from "./sdf.mjs";
export { tri } from "./mine.mjs";
export { afterimage, dissolve } from "./temple.mjs";
export { puffs, scaleAt, spikes, flame2d } from "./lava.mjs";
export { chain } from "./storm.mjs";
export const BY = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const by = (x, y) => (BY[y & 3][x & 3] + 0.5) / 16;
// 闘技場の砂: くすんだ黄土の灰色。乾いて照り返しは少ない
export const SAND = { ramp: ["#030201", "#0d0a07", "#1a150e", "#2a2217", "#3a2f20", "#4a3c2a"], dither: 0.85, amb: 0.42, dif: 0.55, noRim: true,
  shade: p => 0.12 * fbm(p.x * 0.35, p.z * 0.35) + 0.06 * Math.sin(p.x * 0.9 + p.z * 0.4) };
// 砂に染みた古い血: 黒ずんだ赤錆色
export const BLOOD = { ramp: ["#040101", "#120403", "#220806", "#330e09"], dither: 0.8, amb: 0.42, dif: 0.5, noRim: true,
  shade: p => 0.1 * fbm(p.x * 0.5, p.z * 0.5) };
// 降り積もった灰: 砂の上に雪のように積もった、明るい灰白
export const ASH = ["#0a0a0b", "#1c1b1c", "#2c2b2c", "#403f40", "#5a585a", "#7a787a"];
export const ASHBED = { ramp: ASH, dither: 0.75, amb: 0.46, dif: 0.6, noRim: true,
  shade: p => 0.1 * fbm(p.x * 0.4, p.z * 0.4) };
// 観客席・石畳・柱の石: 灰をかぶった冷たい灰色の切り石。上を向いた面ほど灰で白い
export const STONE = { ramp: ["#030304", "#0b0b0d", "#16161a", "#232328", "#323238", "#44434a", "#57565d"], spec: 0.3, pow: 20, dither: 0.55,
  shade: p => 0.09 * fbm(p.x * 0.45, p.y * 0.45, p.z * 0.45) + (p.ny < -0.6 ? 0.08 : 0) };
// 錆びた鉄 (鎖・杭・折れた剣・兜): 赤茶に錆び、角だけ鈍く光る
export const IRON = { ramp: ["#040202", "#0e0806", "#1c110a", "#2c1b11", "#3e2617", "#563620"], spec: 0.8, pow: 30, specCol: "#9a8676", dither: 0.45,
  shade: p => 0.08 * fbm(p.x * 0.6, p.y * 0.6, p.z * 0.6) };
// 磨かれた鋼 (闘士の鎧・刃): 冷たい灰青。雲海の光を映す
export const STEEL = { ramp: ramp(["#030304", "#09090d", "#131318", "#1e1e25", "#2b2b34", "#3b3b46", "#4f4f5c", "#686876"], 8), spec: 1.2, pow: 30, specCol: "#d0d4e4", dither: 0.45,
  shade: p => 0.06 * fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5) };
// 古びた真鍮・金 (飾り・仮面・覇者の装飾)
export const BRASS = { ramp: ["#0e0904", "#2a1c0c", "#4a3616", "#725826", "#a08040", "#ccb070"], spec: 1.2, pow: 28, specCol: "#f0e0b0", dither: 0.4 };
// 闘技場跡の縁光 (夕暮れの雲海に散った、灰色がかった冷たい光)
export const RIM = "#8a90a8";
// 闘士の霊の胸・鎧の奥に揺れる魂の灯の色 (暗→明): 青白
export const SOULS = ["#0e2030", "#244e68", "#4c8cac", "#9cd2e8", "#eef9ff"];
// 熾火の名残 (暗→明)
export const EMBER = ["#3e0c04", "#8a2208", "#d4500e", "#ffa030", "#fff0b0"];
// 霊の淡い体の色 (暗→明): 灰青
export const GHOST = ["#06070c", "#0d1018", "#151924", "#1f2432", "#2b3142", "#3a4156", "#4c546c", "#626c88"];
// 闘技場の床: 砂の台 + 古い血の染み (blood が大きいほど広い) + 積もった灰 (ash) + 半ば埋もれた石畳 (flags 枚) +
//   折れた剣 (swords 本) + 転がる兜 (helms 個)。材質 "sand" / "blood" / "ashbed" / "stone" / "iron"
export function sandFloor(cx, cy, rx, rz = 14, { seed = 3, blood = 0, ash = 0, flags = 2, swords = 0, helms = 0, big = 3 } = {}) {
  const R = rand(seed);
  const bed = Paint(Disp(ellipsoid([cx, cy, -2], [rx, 3.4, rz], "sand"), (x, y, z) => 0.22 * fbm(x * 0.3, z * 0.3) + 0.12 * Math.sin(x * 0.7 + z * 0.3)),
    (x, y, z, m) => {
      if (m !== "sand") return m;
      if (fbm(x * 0.11 + seed, z * 0.2, 3.3) > 0.24 - blood) return "blood";
      if (fbm(x * 0.07 - seed, z * 0.16, 8.1) > 0.18 - ash) return "ashbed";
      return m;
    });
  const parts = [bed];
  for (let i = 0; i < flags; i++) {
    const a = R() * Math.PI * 2, d = 0.4 + R() * 0.5;
    const x = cx + Math.cos(a) * rx * d, z = -2 + Math.sin(a) * rz * d * 0.8, s = big * (0.8 + R() * 0.6);
    parts.push(Disp(box([x, cy - 3.2, z], [s * 1.4, 0.9, s], "stone", 0.3, R() * 20 - 10), (X, Y, Z) => 0.2 * fbm(X * 0.6, Y * 0.6, Z * 0.6)));
  }
  for (let i = 0; i < swords; i++) {
    const x = cx + (R() < 0.5 ? -1 : 1) * rx * (0.55 + R() * 0.35), z = -2 + (R() - 0.3) * rz * 0.8, lean = (R() - 0.5) * 8, h = 6 + R() * 5;
    parts.push(cone([x, cy - 2, z], [x + lean, cy - 2 - h, z], 1, 0.5, "iron"), box([x + lean * 0.98, cy - 2 - h, z], [2.4, 0.5, 0.6], "iron", 0.2, Math.atan2(h, lean) * 180 / Math.PI - 90));
  }
  for (let i = 0; i < helms; i++) {
    const x = cx + (R() < 0.5 ? -1 : 1) * rx * (0.5 + R() * 0.4), z = -2 + (R() - 0.3) * rz * 0.7, s = 2.6 + R() * 1.2;
    parts.push(Sub(sphere([x, cy - 2.4, z], s, "iron"), box([x, cy + s * 0.4, z], [s * 2, s, s * 2], "iron"), 0.2));
  }
  return U(0.4, ...parts);
}
// すり鉢形の観客席の石段 (SDF): 奥へ上がる n 段。中心 cx、最前段の上面 y、幅 w、奥行き z0 から
export function tiers(cx, y, w, { n = 3, z0 = -16, step = 6, rise = 7, curve = 0.06, mat = "stone" } = {}) {
  const parts = [];
  for (let i = 0; i < n; i++) {
    const yy = y - i * rise, zz = z0 - i * step, ww = w * (1 + i * 0.12);
    parts.push(Disp(box([cx, yy + 3, zz], [ww, 3.4, step * 0.55], mat, 0.4), (X, Y, Z) => curve * (X - cx) * (X - cx) * 0.05 + 0.25 * fbm(X * 0.4, Y * 0.4, Z * 0.4)));
  }
  return U(0, ...parts);
}
// 杭 (SDF): 砂に斜めに刺さった鉄の杭と、頭の環
export function stake(x, y, z, h = 12, lean = 0, mat = "iron") {
  return U(0.3, cone([x, y + 2, z], [x + lean, y - h, z], 0.4, 1.4, mat), cyl([x + lean, y - h, z], [x + lean, y - h - 1.6, z], 1.8, mat, 0.3));
}
// 雪のように降る灰 (空いている所だけ)。ゆっくり舞う薄片で、大きいものは横に2画素
export function ashfall(C, seed, n, area = [0, 0, C.W, C.H], cols = ASH) {
  const R = rand(seed);
  for (let i = 0; i < n; i++) {
    const x = Math.round(area[0] + R() * area[2]), y = Math.round(area[1] + R() * area[3]);
    if (x < 0 || y < 0 || x >= C.W || y >= C.H || C.get(x, y)) continue;
    const k = Math.min(cols.length - 1, 1 + Math.floor(R() * R() * cols.length * 1.3));
    C.set(x, y, cols[k]);
    if (k >= 3 && R() < 0.45 && !C.get(x + 1, y)) C.set(x + 1, y, cols[k - 2]);
  }
}
// 宙に漂う熾火の名残 (空いている所だけ)。赤い芯と暗い滲み
export function embers(C, seed, n, area = [2, 2, C.W - 4, C.H - 4], cols = EMBER) {
  const R = rand(seed);
  for (let i = 0; i < n; i++) {
    const x = Math.round(area[0] + R() * area[2]), y = Math.round(area[1] + R() * area[3]);
    if (x < 0 || y < 0 || x >= C.W || y >= C.H || C.get(x, y)) continue;
    const k = Math.min(cols.length - 1, 1 + Math.floor(R() * R() * cols.length * 1.2));
    C.set(x, y, cols[k]);
    if (k >= 3 && R() < 0.5 && !C.get(x, y + 1)) C.set(x, y + 1, cols[0]);
  }
}
// 灰の中の熾火 (2D): mats の画素の上に、ノイズで選んだ所だけ赤く点す (覇者の鎧の継ぎ目・燃えさしの床)
export function smolder(C, mats, { f = 0.3, th = 0.6, seed = 1, cols = EMBER } = {}) {
  const M = new Set([].concat(mats));
  for (let y = 0; y < C.H; y++) for (let x = 0; x < C.W; x++) {
    const p = C.pix[y * C.W + x]; if (!p || !M.has(p.m)) continue;
    const v = Math.pow(1 - Math.abs(vnoise(p.x * f, p.y * f, p.z * f + seed)), 5);
    if (v < th) continue;
    const t = (v - th) / (1 - th);
    if (t < by(x, y) * 0.6) continue;
    C.set(x, y, cols[Math.min(cols.length - 1, 1 + Math.floor(t * (cols.length - 1)))]);
  }
}
// 魂の灯 (2D): 小さな青白い炎と滲む光の輪。s = 大きさ
export function soulLamp(C, x, y, s = 1, cols = SOULS, ring = true) {
  x = Math.round(x); y = Math.round(y);
  if (ring) for (let a = 0; a < Math.PI * 2; a += 0.3) { const X = Math.round(x + Math.cos(a) * 2.6 * s), Y = Math.round(y + Math.sin(a) * 2.6 * s); if (!C.get(X, Y) && (X + Y) % 2 === 0) C.set(X, Y, cols[0]); }
  C.set(x, y, cols[3]); C.set(x, y - 1, cols[4]); C.set(x - 1, y, cols[2]); C.set(x + 1, y, cols[2]); C.set(x, y + 1, cols[1]);
  if (s > 1) { C.set(x, y - 2, cols[3]); C.set(x, y - 3, cols[1]); C.set(x - 1, y - 1, cols[2]); C.set(x + 1, y - 1, cols[2]); }
}
// 刃の軌跡 (2D): 中心 (cx, cy)、半径 r、角 a0〜a1 の三日月の弧 (空いている所と own の材質の上)。連撃・薙ぎ払いに
export function slashArc(C, cx, cy, r, a0, a1, { w = 2, cols = ["#2b2b34", "#4f4f5c", "#686876", "#d0d4e4"], own = [], squash = 1 } = {}) {
  const ok = (x, y) => { if (x < 0 || y < 0 || x >= C.W || y >= C.H) return false; if (!C.get(x, y)) return true; const p = C.pix[y * C.W + x]; return !!(p && own.includes(p.m)); };
  const n = Math.ceil(Math.abs(a1 - a0) * r * 1.5);
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = a0 + (a1 - a0) * t, ww = w * Math.sin(Math.PI * t);
    for (let k = 0; k <= Math.ceil(ww); k++) {
      const rr = r - k, x = Math.round(cx + Math.cos(a) * rr), y = Math.round(cy + Math.sin(a) * rr * squash);
      if (!ok(x, y)) continue;
      const lvl = k === 0 ? (t > 0.35 && t < 0.8 ? 3 : 2) : k === 1 ? 2 : k < ww - 0.5 ? 1 : 0;
      C.set(x, y, cols[lvl]);
    }
  }
}
// 声・歓声の波 (2D): 口 (x, y) から角 ang へ広がる弧を n 重 (空いている所だけ)
export function shoutWaves(C, x, y, ang, { n = 3, gap = 5, spread = 0.6, cols = ["#2a2e44", "#3c4260", "#565e84"], r0 = 4 } = {}) {
  for (let i = 0; i < n; i++) {
    const r = r0 + i * gap, c = cols[Math.max(0, cols.length - 1 - i)];
    for (let a = ang - spread; a <= ang + spread; a += 0.5 / r) {
      if (Math.sin(a * 23 + i) < -0.5) continue;
      const X = Math.round(x + Math.cos(a) * r), Y = Math.round(y + Math.sin(a) * r);
      if (X < 0 || Y < 0 || X >= C.W || Y >= C.H || C.get(X, Y)) continue;
      C.set(X, Y, c);
    }
  }
}
// 遠い雲海 (2D・空いている所だけ): 画面の下寄りに横長の雲の帯。夕暮れの冷たい光をわずかに受ける
export function cloudSea(C, y0, { seed = 5, cols = ["#0a0b12", "#10121c", "#171a28", "#202436"], dens = 0.6, x0 = 0, x1 = C.W, h = 10 } = {}) {
  for (let y = Math.max(0, y0 - h); y < Math.min(C.H, y0 + h); y++) for (let x = x0; x < x1; x++) {
    if (C.get(x, y)) continue;
    const t = 1 - Math.abs(y - y0) / h;
    const a = t * dens + 0.45 * fbm(x * 0.06, y * 0.25, seed) - 0.25;
    if (a < by(x, y) * 0.8) continue;
    C.set(x, y, cols[Math.max(0, Math.min(cols.length - 1, Math.floor(a * cols.length)))]);
  }
}
// 砂ぼこり・砂煙 (2D・空いている所だけ): 地面すれすれに舞う
export function sandDust(C, seed, n, area = [0, C.H - 20, C.W, 18], cols = SAND.ramp.slice(2)) {
  const R = rand(seed);
  for (let i = 0; i < n; i++) {
    const x = Math.round(area[0] + R() * area[2]), y = Math.round(area[1] + R() * area[3]);
    if (x < 0 || y < 0 || x >= C.W || y >= C.H || C.get(x, y)) continue;
    C.set(x, y, cols[Math.min(cols.length - 1, Math.floor(R() * R() * cols.length * 1.5))]);
  }
}
// 上を向いた面に積もる灰 (2D): mats の画素で法線が上向きの所を、灰白の段で置き換える
export function ashCoat(C, mats, { th = -0.45, seed = 1, cols = ASH.slice(2), k = 1 } = {}) {
  const M = new Set([].concat(mats));
  for (let y = 0; y < C.H; y++) for (let x = 0; x < C.W; x++) {
    const p = C.pix[y * C.W + x]; if (!p || !M.has(p.m)) continue;
    const s = (th - p.ny) * k + 0.3 * fbm(p.x * 0.4, p.y * 0.4, seed) - 0.1;
    if (s < by(x, y) * 0.6) continue;
    C.set(x, y, cols[Math.max(0, Math.min(cols.length - 1, Math.floor(s * cols.length * 1.4)))]);
  }
}
// 鎧・石の凹凸と傷 (Disp に渡す)
export const dents = (k = 0.5, f = 0.35) => (x, y, z) => k * Math.max(0, vnoise(x * f, y * f, z * f) - 0.25);
export const rough = (k = 0.5, f = 0.4) => (x, y, z) => k * fbm(x * f, y * f, z * f);
export { Paint, slab };
