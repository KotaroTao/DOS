// 第10層「嵐の尖塔」の共通部品: 奈落の縦穴をまっすぐ上へ伸びる塔の、濡れた黒い石の段と踊り場、
// 吹きつける風の筋と斜めの雨、稲妻の枝と火花、千切れて流れる雷雲、手すりの鎖、嵐の紫と稲光の青白い縁光
import { ellipsoid, box, cyl, torus, U, Disp, Paint, ramp, fbm, vnoise, rand } from "./sdf.mjs";
export { tri } from "./mine.mjs";
export { afterimage, dissolve } from "./temple.mjs";
export { puffs, scaleAt, spikes } from "./lava.mjs";
export const BY = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const by = (x, y) => (BY[y & 3][x & 3] + 0.5) / 16;
// 塔の石段: 雨に濡れた黒い切り石。目地が走り、紫がかった灰の鈍い照り返し
export const STAIR = { ramp: ramp(["#020205", "#06060c", "#0c0c16", "#141421", "#1d1d2d", "#27273a"], 6), dither: 0.8, amb: 0.42, dif: 0.55, noRim: true,
  spec: 0.6, pow: 40, specCol: "#4c5078",
  shade: p => {
    const u = p.x * 0.14, v = (p.z + 40) * 0.26, row = Math.floor(v);
    const fu = (u + row * 0.5) % 1, fv = v % 1;
    return ((fu < 0.07 || fv < 0.12) ? -0.26 : 0) + 0.12 * fbm(p.x * 0.4, p.z * 0.4);
  } };
// 段にたまった雨水: ほとんど黒い紫の水面に、稲光の青白い照り返し
export const PUDDLE = { ramp: ramp(["#010103", "#040409", "#090912", "#10101e", "#181a2c"], 5), spec: 1.5, pow: 70, specCol: "#9aa6e0", dither: 0.7, amb: 0.5, dif: 0.35, noRim: true };
// 塔の壁・崩れた石塊・像の石: 濡れた暗い石。上を向いた面ほど雨に洗われて明るい
export const TOWER = { ramp: ramp(["#030306", "#08080f", "#101019", "#181825", "#222233", "#2e2e42", "#3c3c54", "#4e4e68"], 8), spec: 0.5, pow: 26, dither: 0.55,
  shade: p => 0.1 * fbm(p.x * 0.45, p.y * 0.45, p.z * 0.45) };
// 鉄 (手すりの鎖・杭・避雷の金具): 濡れて黒い。稲光でだけ白く光る
export const IRON = { ramp: ramp(["#030304", "#09090c", "#131318", "#1f1f27", "#2e2e3a", "#42424f"], 6), spec: 1.4, pow: 40, specCol: "#c8d0f0", dither: 0.45 };
// 嵐の尖塔の縁光 (稲光が雨の霧に散った、紫がかった青白)
export const RIM = "#7c84c4";
// 稲妻の色 (暗→明)
export const BOLT = ["#22265e", "#3c4aa6", "#7086e0", "#b4c4ff", "#eef2ff"];
// 雷雲の色 (暗→明): 紫がかった灰
export const CLOUD = ["#0a0912", "#12111e", "#1b1a2c", "#26253a", "#33324a", "#45445e"];
// 塔に縛られた魂の光 (暗→明): 淡い青緑の白。眼・胸の灯・鎖の先の光に
export const SOULS = ["#10283a", "#245a76", "#4c94b0", "#9ad4e4", "#e6fbff"];
// 雨の筋の色
export const RAIN = ["#15172a", "#1f2238", "#2e3250"];
// 足元に敷く塔の踊り場: 濡れた石の床 + 水たまり (wet が大きいほど広い) + 段の縁 (steps 段、奥へ上がる) + 崩れた石塊 (n 個)。
//   材質 "stair" / "puddle" / "tower"
export function towerFloor(cx, cy, rx, rz = 14, { n = 2, seed = 3, wet = 0, steps = 0, big = 3 } = {}) {
  const R = rand(seed);
  const bed = Paint(Disp(ellipsoid([cx, cy, -2], [rx, 3.6, rz], "stair"), (x, y, z) => 0.2 * fbm(x * 0.3, z * 0.3)),
    (x, y, z, m) => m === "stair" && fbm(x * 0.1 + seed, z * 0.18, 4.1) > 0.12 - wet ? "puddle" : m);
  const parts = [bed];
  // 奥へ上がる段 (螺旋階段の先)
  for (let i = 0; i < steps; i++) {
    const w = rx * (0.7 - i * 0.12), side = i % 2 ? 0.2 : -0.2;
    parts.push(box([cx + side * rx, cy - 3.2 - i * 4, -rz * 0.7 - i * 3], [w, 2, 3], "stair", 0.4));
  }
  for (let i = 0; i < n; i++) {
    const a = R() * Math.PI * 2, d = 0.55 + R() * 0.4;
    const x = cx + Math.cos(a) * rx * d, z = -2 + Math.sin(a) * rz * d * 0.9, s = big * (0.55 + R() * 0.6);
    parts.push(Disp(box([x, cy - 2 - s * 0.4, z], [s * 1.2, s * 0.6, s * 0.8], "tower", s * 0.2, R() * 40 - 20), (X, Y, Z) => 0.3 * fbm(X * 0.7, Y * 0.7, Z * 0.7)));
  }
  return U(0, ...parts);
}
// 鉄の鎖 (SDF): 点 a から b へ、輪を交互に向きを変えて並べる。材質 mat
export function chain(a, b, r = 1.6, mat = "iron", th = 0.55) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz), n = Math.max(1, Math.round(L / (r * 1.7)));
  const rot = Math.atan2(dy, dx) * 180 / Math.PI;
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.push(torus([a[0] + dx * t, a[1] + dy * t, a[2] + dz * t], r, th, mat, rot, i % 2 ? 0 : 90));
  }
  return out;
}
// 稲妻 (2D): (x0, y0) から (x1, y1) へ、ぎざぎざに折れながら走り、枝 branch 本を分ける。芯は白く、まわりに青い光の滲み。
//   own = 上書きしてよい材質 (空いていない所でも描く)。all=true なら何の上にも描く
export function bolt2d(C, x0, y0, x1, y1, { seed = 1, jag = 3, branch = 2, cols = BOLT, own = null, all = false, glow = true, thick = 1 } = {}) {
  const R = rand(seed);
  const ok = (x, y) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= C.W || y >= C.H) return false; if (all || !C.get(x, y)) return true; const p = C.pix[y * C.W + x]; return !!(own && p && own.includes(p.m)); };
  const put = (x, y, c) => { if (ok(x, y)) C.set(x, y, c); };
  const seg = (ax, ay, bx, by_, depth) => {
    const L = Math.hypot(bx - ax, by_ - ay), n = Math.max(2, Math.round(L / 5));
    const pts = [[ax, ay]];
    const nx = -(by_ - ay) / (L || 1), ny = (bx - ax) / (L || 1);
    for (let i = 1; i < n; i++) { const t = i / n, o = (R() - 0.5) * 2 * jag * (depth ? 0.7 : 1); pts.push([ax + (bx - ax) * t + nx * o, ay + (by_ - ay) * t + ny * o]); }
    pts.push([bx, by_]);
    for (let i = 0; i < pts.length - 1; i++) {
      const [px, py] = pts[i], [qx, qy] = pts[i + 1], m = Math.ceil(Math.max(Math.abs(qx - px), Math.abs(qy - py))) || 1;
      for (let k = 0; k <= m; k++) {
        const x = px + (qx - px) * k / m, y = py + (qy - py) * k / m;
        if (glow) for (const [ddx, ddy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (ok(x + ddx, y + ddy) && !C.get(Math.round(x + ddx), Math.round(y + ddy))) C.set(x + ddx, y + ddy, cols[depth ? 0 : 1]);
        put(x, y, cols[depth ? 2 : (k % 3 === 0 ? 3 : 4)]);
        if (thick > 1 && !depth) put(x + 1, y, cols[3]);
      }
    }
    if (depth < 1) for (let b = 0; b < branch; b++) {
      const i = 1 + Math.floor(R() * (pts.length - 2)), [sx, sy] = pts[i];
      const ang = Math.atan2(by_ - ay, bx - ax) + (R() < 0.5 ? -1 : 1) * (0.5 + R() * 0.6), l = L * (0.2 + R() * 0.25);
      seg(sx, sy, sx + Math.cos(ang) * l, sy + Math.sin(ang) * l, depth + 1);
    }
  };
  seg(x0, y0, x1, y1, 0);
}
// 体の輪郭を這う小さな放電 (2D): mats の画素の縁 (外側が空いている所) に、まばらに短い火花を跳ねさせる
export function crackle(C, seed, mats, rate = 0.04, cols = BOLT) {
  const R = rand(seed), M = new Set([].concat(mats));
  const edge = [];
  for (let y = 1; y < C.H - 1; y++) for (let x = 1; x < C.W - 1; x++) {
    const p = C.pix[y * C.W + x]; if (!p || !M.has(p.m)) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, -1], [0, 1]]) if (!C.get(x + dx, y + dy)) { edge.push([x, y, dx, dy]); break; }
  }
  for (const [x, y, dx, dy] of edge) {
    if (R() > rate) continue;
    let X = x + dx, Y = y + dy;
    for (let k = 0; k < 3 + Math.floor(R() * 3); k++) {
      if (C.get(X, Y)) break;
      C.set(X, Y, cols[k === 0 ? 4 : k < 2 ? 3 : 2]);
      X += dx + (R() < 0.5 ? (dy ? (R() < 0.5 ? -1 : 1) : 0) : 0); Y += dy + (R() < 0.5 ? (dx ? (R() < 0.5 ? -1 : 1) : 0) : 0);
    }
  }
}
// 宙に跳ねる火花 (空いている所だけ)
export function sparks(C, seed, n, area = [2, 2, C.W - 4, C.H - 4], cols = BOLT) {
  const R = rand(seed);
  for (let i = 0; i < n; i++) {
    const x = Math.round(area[0] + R() * area[2]), y = Math.round(area[1] + R() * area[3]);
    if (C.get(x, y)) continue;
    const k = Math.min(cols.length - 1, 1 + Math.floor(R() * R() * cols.length * 1.4));
    C.set(x, y, cols[k]);
    if (k >= 3 && R() < 0.4) { const d = R() < 0.5 ? 1 : -1; if (!C.get(x + d, y + 1)) C.set(x + d, y + 1, cols[k - 2]); }
  }
}
// 斜めに降る雨 (空いている所だけ): 短い斜めの筋。slope = 横へのずれ / 縦 1
export function rain(C, seed, n, area = [0, 0, C.W, C.H], { slope = 0.4, cols = RAIN, len = [2, 4] } = {}) {
  const R = rand(seed);
  for (let i = 0; i < n; i++) {
    const x = area[0] + R() * area[2], y = area[1] + R() * area[3], l = len[0] + Math.floor(R() * (len[1] - len[0] + 1));
    const c = cols[Math.min(cols.length - 1, Math.floor(R() * R() * cols.length * 1.5))];
    for (let k = 0; k < l; k++) { const X = Math.round(x + slope * k), Y = Math.round(y + k); if (X < 0 || Y < 0 || X >= C.W || Y >= C.H || C.get(X, Y)) break; C.set(X, Y, c); }
  }
}
// 吹きつける風の筋 (空いている所だけ): ゆるく弧を描く横長の細い線。dir = 1 で右へ流れる
export function windStreaks(C, seed, n, area = [0, 0, C.W, C.H], { cols = ["#1c1c2e", "#2c2c44", "#42425e"], len = [8, 18], bend = 0.06 } = {}) {
  const R = rand(seed);
  for (let i = 0; i < n; i++) {
    const x0 = area[0] + R() * area[2], y0 = area[1] + R() * area[3], l = len[0] + R() * (len[1] - len[0]), b = (R() - 0.5) * 2 * bend, c = cols[Math.floor(R() * cols.length)];
    for (let k = 0; k < l; k++) {
      if (R() < 0.12) continue;
      const X = Math.round(x0 + k), Y = Math.round(y0 + b * k * k * 0.3);
      if (X < 0 || Y < 0 || X >= C.W || Y >= C.H || C.get(X, Y)) continue;
      C.set(X, Y, k < 2 || k > l - 3 ? cols[0] : c);
    }
  }
}
// 千切れて流れる雷雲 (2D・空いている所だけ): 楕円の束を fbm で崩してディザで置く。list = [[cx, cy, rx, ry], ...]
export function clouds(C, list, { cols = CLOUD, dens = 1, seed = 7, own = [] } = {}) {
  for (let y = 0; y < C.H; y++) for (let x = 0; x < C.W; x++) {
    const p = C.pix[y * C.W + x]; if (C.get(x, y) && !(p && own.includes(p.m))) continue;
    let a = 0;
    for (const [cx, cy, rx, ry] of list) a = Math.max(a, 1 - Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry));
    if (a <= 0) continue;
    a = a * dens + 0.45 * fbm(x * 0.14, y * 0.22, seed) - 0.05;
    if (a < by(x, y) * 0.7) continue;
    C.set(x, y, cols[Math.max(0, Math.min(cols.length - 1, Math.floor(a * cols.length * 0.75)))]);
  }
}
// 上を向いた面に雨のしずくのきらめき (2D): mats の画素で法線が上向きの所に、まばらに明るい点
export function wetGlint(C, seed, mats, rate = 0.05, cols = ["#6a72a8", "#b4c4ff"]) {
  const R = rand(seed), M = new Set([].concat(mats));
  for (let y = 0; y < C.H; y++) for (let x = 0; x < C.W; x++) {
    const p = C.pix[y * C.W + x]; if (!p || !M.has(p.m) || p.ny > -0.3 || R() > rate) continue;
    C.set(x, y, cols[R() < 0.3 ? 1 : 0]);
  }
}
// 帯電した肌・石の凹凸 (Disp に渡す)
export const rough = (k = 0.5, f = 0.4) => (x, y, z) => k * fbm(x * f, y * f, z * f);
// 体を這う稲妻の筋 (Paint に渡す材質の判定): 稜線ノイズが閾値を越えた所
export const veinAt = (x, y, z, f = 0.25, th = 0.88) => Math.pow(1 - Math.abs(vnoise(x * f, y * f, z * f + 7.7)), 6) > th;
export { Paint, cyl };
