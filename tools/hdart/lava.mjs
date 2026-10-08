// 第7層「灼熱の洞」の共通部品: ひび割れた玄武岩の床と溶岩の筋、下からの赤い照り返し、宙を舞う火の粉と灰
import { ellipsoid, box, cone, U, Disp, Paint, ramp, fbm, vnoise, rand } from "./sdf.mjs";
export { tri } from "./mine.mjs";
export const BY = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const by = (x, y) => (BY[y & 3][x & 3] + 0.5) / 16;
// 玄武岩の床: 冷えて黒く固まった溶岩の地。照り返しは少なく、わずかに赤みのある黒灰
export const BASALT = { ramp: ramp(["#030202", "#0a0707", "#130d0c", "#1c1513", "#271d1a", "#332621"], 6), dither: 0.85, amb: 0.42, dif: 0.55, noRim: true,
  shade: p => 0.14 * fbm(p.x * 0.35, p.z * 0.35) };
// 転がる玄武岩の塊・黒い岩殻
export const CRUST = { ramp: ramp(["#030202", "#0b0807", "#161110", "#221a17", "#30241f", "#413029", "#553f35"], 7), spec: 0.35, pow: 22, dither: 0.6,
  shade: p => 0.1 * fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5) };
// 溶岩: 自ら光る。暗い朱から黄白へ。ひびの奥ほど明るい
export const LAVA_RAMP = ["#2a0602", "#4e0e04", "#7a1a06", "#a8300a", "#d24e10", "#f07a1c", "#ffae3a", "#ffdc7a", "#fff4c4"];
export const LAVA = { ramp: LAVA_RAMP, noRim: true, emit: p => 0.38 + 0.45 * Math.max(0, p.nz) + 0.22 * fbm(p.x * 0.25, p.y * 0.25, p.z * 0.25) };
// 灼熱の洞の縁光 (溶岩の照り返しが煙に散った、暗い赤紫)
export const RIM = "#6a2c3a";
// 下からの照り返しに使う赤の段 (暗→明)
export const GLOW = ["#2c0a08", "#481208", "#6a1e0c", "#8e2c10"];
// 火の粉の色 (暗→明)
export const EMBER = ["#7a1a06", "#c43e0c", "#f07a1c", "#ffc04a", "#fff0b0"];
// 灰の色 (暗→明)
export const ASH = ["#1e1a19", "#2e2927", "#433c39", "#5c5450", "#7a716c"];
// 割れた溶岩のひび: 稜線ノイズが閾値を超えた所を溶岩に塗る
export const crackAt = (x, z, f = 0.22, th = 0.86) => Math.pow(1 - Math.abs(vnoise(x * f, z * f, 3.7)), 6) > th;
// 足元に敷く玄武岩の平たい台 + 転がる岩塊 (n 個) + 床を走る溶岩のひび。床 "basalt"、岩 "crust"、ひび "lava"
export function lavaFloor(cx, cy, rx, rz = 14, { n = 4, seed = 3, big = 3.2, cracks = 0.86, pool = null } = {}) {
  const R = rand(seed);
  const bed = Disp(ellipsoid([cx, cy, -2], [rx, 3.6, rz], "basalt"), (x, y, z) => 0.3 * fbm(x * 0.3, z * 0.3) + 0.3 * Math.max(0, vnoise(x * 0.8, z * 0.8) - 0.3));
  const parts = [Paint(bed, (x, y, z, m) => (m === "basalt" && crackAt(x, z, 0.22, cracks)) ? "lava" : m)];
  // 溶岩溜まり [x, z, 半径]: 床より少し低い光る面
  if (pool) parts.push(Disp(ellipsoid([pool[0], cy - 2.6, pool[1]], [pool[2], 1.2, pool[2] * 0.6], "lava"), (x, y, z) => 0.3 * fbm(x * 0.4, z * 0.4)));
  for (let i = 0; i < n; i++) {
    const a = R() * Math.PI * 2, d = 0.5 + R() * 0.45;
    const x = cx + Math.cos(a) * rx * d, z = -2 + Math.sin(a) * rz * d * 0.9, s = big * (0.55 + R() * 0.6);
    parts.push(Disp(box([x, cy - 2 - s * 0.4, z], [s * 1.1, s * 0.7, s * 0.9], "crust", s * 0.35, R() * 60 - 30), (X, Y, Z) => 0.45 * fbm(X * 0.6, Y * 0.6, Z * 0.6)));
  }
  return U(0, ...parts);
}
// 下からの赤い照り返し: 下を向いた面 (法線 y+) に溶岩の赤を乗せる。元の色より明るい時だけ置き換える
const lum = c => { const v = parseInt(c.slice(1), 16); return ((v >> 16) & 255) * 0.3 + ((v >> 8) & 255) * 0.55 + (v & 255) * 0.15; };
export function underglow(C, { k = 1.2, th = 0.15, y0 = 0, skip = [] } = {}) {
  for (let y = y0; y < C.H; y++) for (let x = 0; x < C.W; x++) {
    const p = C.pix[y * C.W + x], c = C.get(x, y);
    if (!p || !c || skip.includes(p.m) || p.m === "lava") continue;
    const s = (p.ny - th) * k * (0.45 + 0.55 * y / C.H);
    if (s <= 0) continue;
    const g = GLOW[Math.min(GLOW.length - 1, Math.floor(s * GLOW.length))];
    if (s > by(x, y) * 0.9 && lum(g) > lum(c)) C.set(x, y, g);
  }
}
// 宙を舞う火の粉 (空いている所だけ)。上ほど暗く小さくなる
export function embers(C, seed, n, area = [2, 2, C.W - 4, C.H - 4]) {
  const R = rand(seed);
  for (let i = 0; i < n; i++) {
    const x = Math.round(area[0] + R() * area[2]), y = Math.round(area[1] + R() * area[3]);
    if (C.get(x, y)) continue;
    const t = 1 - (y - area[1]) / area[3];
    const k = Math.max(0, Math.min(EMBER.length - 1, Math.floor(R() * 3 + (1 - t) * 2.5)));
    C.set(x, y, EMBER[k]);
    if (k >= 3 && !C.get(x, y + 1) && R() < 0.5) C.set(x, y + 1, EMBER[k - 2]);
  }
}
// 降る灰 (空いている所だけ)。斜めに落ちる細い薄片
export function ash(C, seed, n, area = [2, 2, C.W - 4, C.H - 4]) {
  const R = rand(seed);
  for (let i = 0; i < n; i++) {
    const x = Math.round(area[0] + R() * area[2]), y = Math.round(area[1] + R() * area[3]);
    if (C.get(x, y)) continue;
    const c = ASH[Math.min(ASH.length - 1, 1 + Math.floor(R() * R() * 4))];
    C.set(x, y, c); if (R() < 0.35 && !C.get(x + 1, y)) C.set(x + 1, y, ASH[0]);
  }
}
// 煙・湯気・毒気の塊 (2D): 円の束を fbm で崩し、ディザで塊のまま置く。cols は暗→明。own = 置いてよい材質 (既に塗られていても上書き)
export function puffs(C, list, cols, { dens = 1.2, seed = 9, own = [], box = [0, 0, C.W, C.H] } = {}) {
  for (let y = box[1]; y < box[1] + box[3]; y++) for (let x = box[0]; x < box[0] + box[2]; x++) {
    if (x < 0 || y < 0 || x >= C.W || y >= C.H) continue;
    const p = C.pix[y * C.W + x]; if (C.get(x, y) && !(p && own.includes(p.m))) continue;
    let a = 0; for (const [cx, cy, r] of list) a = Math.max(a, 1 - Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r);
    if (a <= 0) continue;
    a = a * dens + 0.3 * fbm(x * 0.3, y * 0.3, seed);
    if (a < by(x, y) * 0.8) continue;
    C.set(x, y, cols[Math.max(0, Math.min(cols.length - 1, Math.floor(a * cols.length * 0.8)))]);
  }
}
// 2D の炎の舌: 根元 (x, y) から上へ、幅 w・高さ h で揺れながら細る。空いている所 (と own の材質) に置く
export function flame2d(C, x0, y0, w, h, { seed = 1, own = [], cols = EMBER, lean = 0 } = {}) {
  for (let y = Math.floor(y0 - h); y <= y0; y++) {
    const t = (y0 - y) / h; // 0 = 根元, 1 = 先
    const sway = Math.sin(t * 5 + seed) * w * 0.25 * t + lean * t * h * 0.3;
    const half = w * (1 - t) ** 0.8 * (0.8 + 0.4 * fbm(y * 0.3, seed));
    for (let x = Math.floor(x0 - half + sway); x <= x0 + half + sway; x++) {
      if (x < 0 || y < 0 || x >= C.W || y >= C.H) continue;
      const p = C.pix[y * C.W + x]; if (C.get(x, y) && !(p && own.includes(p.m))) continue;
      const d = Math.abs(x + 0.5 - x0 - sway) / Math.max(0.5, half);
      const v = (1 - d) * (1 - t * 0.7) + 0.25 * fbm(x * 0.4, y * 0.4, seed);
      if (v < by(x, y) * 0.6) continue;
      C.set(x, y, cols[Math.max(0, Math.min(cols.length - 1, Math.floor(v * cols.length)))]);
    }
  }
}
// 残像 (神速): mats の材質の輪郭を (dx, dy) ずらして、空いている所に暗い写しを置く
export function afterimage(C, mats, shifts, cols = [["#3a1a1e", "#5a2a2a"], ["#24121a", "#381c22"]]) {
  const is = (x, y) => { if (x < 0 || y < 0 || x >= C.W || y >= C.H) return false; const p = C.pix[y * C.W + x]; return p && mats.includes(p.m); };
  const mask = []; for (let y = 0; y < C.H; y++) for (let x = 0; x < C.W; x++) if (is(x, y)) mask.push([x, y]);
  shifts.forEach(([dx, dy, every], gi) => {
    for (const [x, y] of mask) {
      const X = x + dx, Y = y + dy; if (X < 0 || X >= C.W || Y < 0 || Y >= C.H || C.get(X, Y)) continue;
      if (y % every !== 0) continue;
      C.set(X, Y, cols[Math.min(gi, cols.length - 1)][is(x + Math.sign(dx), y) ? 0 : 1]);
    }
  });
}
// 角・爪・棘の円錐の並び (SDF)
export const spikes = (list, mat) => list.map(([a, b, ra, rb = 0.3]) => cone(a, b, ra, rb, mat));
// 組んだ形を (ax, ay) を中心に k 倍する (葉の距離関数と Disp/Paint の関数ごと)
export function scaleAt(n, k, ax, ay) {
  const X = x => ax + (x - ax) / k, Y = y => ay + (y - ay) / k;
  if (n.leaf) { const f = n.f, b = n.bound; return { leaf: true, f: (x, y, z) => f(X(x), Y(y), z / k) * k, mat: n.mat, bound: [ax + (b[0] - ax) * k, ay + (b[1] - ay) * k, b[2] * k, b[3] * k] }; }
  const o = { ...n, kids: n.kids.map(c => scaleAt(c, k, ax, ay)) };
  if (n.fn) { const f0 = n.fn; o.fn = n.op === "D" ? (x, y, z) => f0(X(x), Y(y), z / k) * k : (x, y, z, m) => f0(X(x), Y(y), z / k, m); }
  return o;
}
