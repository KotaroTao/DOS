// 第3層「廃坑」の共通部品: 足元の砂利と落石、宙を舞う粉塵、鉱脈のきらめき
import { ellipsoid, sphere, box, U, Disp, ramp, fbm, vnoise, rand } from "./sdf.mjs";
// 坑道の床 (砂利と炭塵): 照り返しの少ない乾いた低明度
export const GRAVEL = { ramp: ramp(["#030303", "#0a0908", "#131110", "#1d1a17", "#29241f", "#36302a"], 6), dither: 0.9, amb: 0.42, dif: 0.55, noRim: true,
  shade: p => 0.16 * fbm(p.x * 0.35, p.z * 0.35) };
// 落石・岩くれ
export const ROCK = { ramp: ramp(["#030303", "#0b0a09", "#161412", "#221f1b", "#302b26", "#403a32", "#544c42"], 7), spec: 0.3, pow: 20, dither: 0.6,
  shade: p => 0.1 * fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5) };
// 坑道の寒い縁光 (第2層の水色より灰がかった青)
export const RIM = "#4c5668";
// 足元に敷く砂利の平たい山 + 散らばる岩くれ (n 個)。岩は "rock" 材質
export function rubble(cx, cy, rx, rz = 14, { n = 7, seed = 3, big = 3.2 } = {}) {
  const R = rand(seed);
  const bed = Disp(ellipsoid([cx, cy, -2], [rx, 4.2, rz], "gravel"), (x, y, z) => 0.5 * fbm(x * 0.3, z * 0.3) + 0.4 * Math.max(0, vnoise(x * 0.9, z * 0.9) - 0.2));
  const rocks = [];
  for (let i = 0; i < n; i++) {
    const a = R() * Math.PI * 2, d = 0.45 + R() * 0.5;
    const x = cx + Math.cos(a) * rx * d, z = -2 + Math.sin(a) * rz * d * 0.9, s = big * (0.5 + R() * 0.7);
    rocks.push(Disp(box([x, cy - 2 - s * 0.45, z], [s, s * 0.7, s * 0.9], "rock", s * 0.4, R() * 70 - 35), (X, Y, Z) => 0.45 * fbm(X * 0.6, Y * 0.6, Z * 0.6)));
  }
  return U(0, bed, ...rocks);
}
// 宙を漂う炭塵の粒 (空いている所だけ)。cols は暗→明
export function dust(C, seed, n, box = [2, 2, C.W - 4, C.H - 4], cols = ["#1d1a17", "#29241f", "#3e372e", "#5a5044"]) {
  const R = rand(seed);
  for (let i = 0; i < n; i++) {
    const x = box[0] + R() * box[2], y = box[1] + R() * box[3];
    if (!C.get(Math.round(x), Math.round(y))) C.set(x, y, cols[Math.min(cols.length - 1, Math.floor(R() * R() * cols.length * 1.6))]);
  }
}
// 砂利の上の小石 (2D)
export function pebbles(C, seed, cx, cy, rx, n = 24) {
  const R = rand(seed);
  for (let i = 0; i < n; i++) {
    const x = Math.round(cx + (R() * 2 - 1) * rx), y = Math.round(cy + (R() * 2 - 1) * 2.5);
    if (C.get(x, y)) { C.set(x, y, R() < 0.5 ? "#3e372e" : "#544c42"); C.set(x, y + 1, "#060505"); }
  }
}
// 塗りつぶしの三角形 (牙・爪・結晶の切片)
export function tri(C, a, b, c, col) {
  const minx = Math.floor(Math.min(a[0], b[0], c[0])), maxx = Math.ceil(Math.max(a[0], b[0], c[0]));
  const miny = Math.floor(Math.min(a[1], b[1], c[1])), maxy = Math.ceil(Math.max(a[1], b[1], c[1]));
  const e = (p, q, x, y) => (q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0]);
  for (let y = miny; y <= maxy; y++) for (let x = minx; x <= maxx; x++) {
    const X = x + 0.5, Y = y + 0.5, w0 = e(b, c, X, Y), w1 = e(c, a, X, Y), w2 = e(a, b, X, Y);
    if ((w0 >= 0 && w1 >= 0 && w2 >= 0) || (w0 <= 0 && w1 <= 0 && w2 <= 0)) C.set(x, y, typeof col === "function" ? col(x, y) : col);
  }
}
// 岩肌のひび (稜線ノイズ): Disp に足すと細い割れ目が刻まれる
export const cracks = (k = 0.7, f = 0.35) => (x, y, z) => k * Math.pow(1 - Math.abs(vnoise(x * f, y * f, z * f)), 7);
