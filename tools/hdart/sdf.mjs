// 小さな SDF レイマーチャ → ドット絵 {palette, art}
// 座標: x=右, y=下 (画像と同じ), z=手前 (視点側)。正射影で z+ から z- へレイを飛ばす。
import { writePNG } from "./png.mjs";

// ---------- vec ----------
const len3 = (x, y, z) => Math.sqrt(x * x + y * y + z * z);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const mix = (a, b, t) => a + (b - a) * t;
export const smin = (a, b, k) => { if (k <= 0) return Math.min(a, b); const h = clamp(0.5 + 0.5 * (b - a) / k, 0, 1); return mix(b, a, h) - k * h * (1 - h); };

// ---------- noise ----------
function hash3(x, y, z) { let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
export function vnoise(x, y, z = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  let r = 0;
  for (let dz = 0; dz < 2; dz++) for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
    const h = hash3(xi + dx, yi + dy, zi + dz);
    r += h * (dx ? u : 1 - u) * (dy ? v : 1 - v) * (dz ? w : 1 - w);
  }
  return r * 2 - 1;
}
export function fbm(x, y, z = 0, oct = 3) { let a = 0.5, s = 0, f = 1; for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f, z * f); f *= 2.03; a *= 0.5; } return s; }
export function rand(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// ---------- primitives (leaf: {d(x,y,z), mat, b:[cx,cy,cz,R]}) ----------
function leaf(f, mat, bound) { return { leaf: true, f, mat, bound }; }
export function sphere([cx, cy, cz], r, mat) {
  return leaf((x, y, z) => len3(x - cx, y - cy, z - cz) - r, mat, [cx, cy, cz, r]);
}
// 楕円体 (回転: rz = 画面内の回転角(度))
export function ellipsoid([cx, cy, cz], [rx, ry, rz], mat, rot = 0, tilt = 0) {
  const c = Math.cos(rot * Math.PI / 180), s = Math.sin(rot * Math.PI / 180);
  const ct = Math.cos(tilt * Math.PI / 180), st = Math.sin(tilt * Math.PI / 180);
  return leaf((x, y, z) => {
    let px = x - cx, py = y - cy, pz = z - cz;
    let u = c * px + s * py, v = -s * px + c * py;
    let w = pz; const v2 = ct * v + st * w; w = -st * v + ct * w; v = v2;
    const k0 = len3(u / rx, v / ry, w / rz), k1 = len3(u / (rx * rx), v / (ry * ry), w / (rz * rz));
    return k0 * (k0 - 1) / (k1 || 1e-9);
  }, mat, [cx, cy, cz, Math.max(rx, ry, rz)]);
}
// 丸い円錐 (2点 + 半径)
export function cone([ax, ay, az], [bx, by, bz], ra, rb, mat) {
  const bax = bx - ax, bay = by - ay, baz = bz - az;
  const l2 = bax * bax + bay * bay + baz * baz, rr = ra - rb, a2 = l2 - rr * rr, il2 = 1 / (l2 || 1e-9);
  const R = Math.sqrt(l2) / 2 + Math.max(ra, rb);
  return leaf((x, y, z) => {
    const pax = x - ax, pay = y - ay, paz = z - az;
    const yv = pax * bax + pay * bay + paz * baz, zv = yv - l2;
    const qx = pax * l2 - bax * yv, qy = pay * l2 - bay * yv, qz = paz * l2 - baz * yv;
    const x2 = qx * qx + qy * qy + qz * qz, y2 = yv * yv * l2, z2 = zv * zv * l2;
    const k = Math.sign(rr) * rr * rr * x2;
    if (Math.sign(zv) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - rb;
    if (Math.sign(yv) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - ra;
    return (Math.sqrt(x2 * a2 * il2) + yv * rr) * il2 - ra;
  }, mat, [(ax + bx) / 2, (ay + by) / 2, (az + bz) / 2, R]);
}
// 管: 点列 [[x,y,z,r],...] を Catmull-Rom で滑らかに繋いだ丸円錐の鎖
export function tube(pts, mat, { seg = 4, k = 0 } = {}) {
  const P = [];
  const n = pts.length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
    for (let j = 0; j < seg; j++) {
      const t = j / seg, t2 = t * t, t3 = t2 * t;
      P.push(p1.map((_, c) => 0.5 * ((2 * p1[c]) + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3)));
    }
  }
  P.push(pts[n - 1]);
  const kids = [];
  for (let i = 0; i < P.length - 1; i++) kids.push(cone(P[i].slice(0, 3), P[i + 1].slice(0, 3), P[i][3], P[i + 1][3], mat));
  return U(k, ...kids);
}
// 箱 (中心, 半径, 角丸, 画面内回転)
export function box([cx, cy, cz], [hx, hy, hz], mat, round = 0, rot = 0) {
  const c = Math.cos(rot * Math.PI / 180), s = Math.sin(rot * Math.PI / 180);
  return leaf((x, y, z) => {
    const px = x - cx, py = y - cy;
    const u = Math.abs(c * px + s * py) - hx + round, v = Math.abs(-s * px + c * py) - hy + round, w = Math.abs(z - cz) - hz + round;
    return len3(Math.max(u, 0), Math.max(v, 0), Math.max(w, 0)) + Math.min(Math.max(u, v, w), 0) - round;
  }, mat, [cx, cy, cz, len3(hx, hy, hz)]);
}
// 板: 画面上の多角形を厚み t で押し出し、角を丸める (ひれ・刃・爪・甲板)
export function slab(poly, zc, t, mat, round = 0.6, bulge = 0) {
  let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
  for (const [x, y] of poly) { minx = Math.min(minx, x); miny = Math.min(miny, y); maxx = Math.max(maxx, x); maxy = Math.max(maxy, y); }
  const cx = (minx + maxx) / 2, cy = (miny + maxy) / 2;
  const d2 = (x, y) => {
    let d = 1e9, s = 1;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [ax, ay] = poly[j], [bx, by] = poly[i];
      const ex = bx - ax, ey = by - ay, wx = x - ax, wy = y - ay;
      const h = clamp((wx * ex + wy * ey) / (ex * ex + ey * ey || 1e-9), 0, 1);
      const dx = wx - ex * h, dy = wy - ey * h; d = Math.min(d, dx * dx + dy * dy);
      const c1 = ay <= y, c2 = by > y, c3 = ex * wy > ey * wx;
      if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) s = -s;
    }
    return s * Math.sqrt(d);
  };
  return leaf((x, y, z) => {
    const a = d2(x, y) + round;
    const th = t + (bulge ? bulge * clamp(-a / 4, 0, 1) : 0);
    const b = Math.abs(z - zc) - th + round;
    return len3(Math.max(a, 0), Math.max(b, 0), 0) + Math.min(Math.max(a, b), 0) - round;
  }, mat, [cx, cy, zc, len3(maxx - minx, maxy - miny, 0) / 2 + t + 1]);
}
export function torus([cx, cy, cz], R, r, mat, rot = 0, tilt = 90) {
  // tilt=90 で輪が画面に正対
  const c = Math.cos(rot * Math.PI / 180), s = Math.sin(rot * Math.PI / 180);
  const ct = Math.cos(tilt * Math.PI / 180), st = Math.sin(tilt * Math.PI / 180);
  return leaf((x, y, z) => {
    let px = x - cx, py = y - cy, pz = z - cz;
    const u = c * px + s * py; let v = -s * px + c * py;
    const v2 = ct * v + st * pz, w = -st * v + ct * pz;
    const q = Math.sqrt(u * u + w * w) - R;
    return Math.sqrt(q * q + v2 * v2) - r;
  }, mat, [cx, cy, cz, R + r]);
}

// ---------- ops ----------
export function U(k, ...kids) { return { op: "U", k, kids: kids.flat().filter(Boolean) }; }
export function Sub(a, b, k = 0) { return { op: "S", k, kids: [a, b] }; } // a から b を削る (切り口は b の材質)
export function Inter(a, b, k = 0) { return { op: "I", k, kids: [a, b] }; }
export function Disp(node, fn) { return { op: "D", fn, kids: [node] }; } // 凹凸: d += fn(x,y,z)
export function Paint(node, fn) { return { op: "P", fn, kids: [node] }; } // 材質の塗り分け fn(x,y,z,mat)→mat

function ev(n, x, y, z) {
  if (n.leaf) {
    const b = n.bound; const bd = len3(x - b[0], y - b[1], z - b[2]) - b[3];
    if (bd > 2) return [bd, n.mat];
    return [n.f(x, y, z), n.mat];
  }
  if (n.op === "U") {
    let d = 1e9, m = null, best = 1e9;
    for (const c of n.kids) {
      const [cd, cm] = ev(c, x, y, z);
      if (cd < best) { best = cd; m = cm; }
      d = n.k ? smin(d, cd, n.k) : Math.min(d, cd);
    }
    return [d, m];
  }
  if (n.op === "S") {
    const [a, am] = ev(n.kids[0], x, y, z), [b, bm] = ev(n.kids[1], x, y, z);
    const nb = -b;
    if (n.k) { const h = clamp(0.5 - 0.5 * (a + b) / n.k, 0, 1); const d = mix(a, nb, h) + n.k * h * (1 - h); return [d, nb > a - 0.3 ? bm : am]; }
    return nb > a ? [nb, bm] : [a, am];
  }
  if (n.op === "I") {
    const [a, am] = ev(n.kids[0], x, y, z), [b] = ev(n.kids[1], x, y, z);
    return [n.k ? -smin(-a, -b, n.k) : Math.max(a, b), am];
  }
  if (n.op === "D") { const [d, m] = ev(n.kids[0], x, y, z); return [d < 3 ? d + n.fn(x, y, z) : d, m]; }
  if (n.op === "P") { const [d, m] = ev(n.kids[0], x, y, z); return [d, d < 1.5 ? n.fn(x, y, z, m) : m]; }
  throw new Error("bad node");
}

// ---------- color ----------
const hex2 = s => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
const rgb2hex = ([r, g, b]) => "#" + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0")).join("");
// 色の段階: stops (暗→明) を n 段に補間
export function ramp(stops, n = stops.length) {
  const S = stops.map(hex2), out = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1) * (S.length - 1), a = Math.floor(t), f = t - a, b = Math.min(S.length - 1, a + 1);
    out.push(rgb2hex(S[a].map((v, c) => v + (S[b][c] - v) * f)));
  }
  return out;
}
export { hex2, rgb2hex };

const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]].map(r => r.map(v => (v + 0.5) / 16 - 0.5));

// ---------- render ----------
// mats: { name: {ramp:[hex..], amb, dif, spec, pow, specCol, dither, emit, rim, shade(x,y,z,n)→offset, flat} }
export function render(scene, mats, opt = {}) {
  const W = opt.w || 96, H = opt.h || 96;
  const L = (() => { const l = opt.light || [-0.55, -0.7, 0.55]; const s = len3(...l); return l.map(v => v / s); })();
  const zTop = opt.zTop ?? 60, zBot = opt.zBot ?? -60;
  const pix = new Array(W * H).fill(null);
  const eps = 0.35;
  for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
    const x = px + 0.5, y = py + 0.5;
    let z = zTop, hit = false, m = null, it = 0;
    while (z > zBot && it++ < 400) {
      const [d, mm] = ev(scene, x, y, z);
      if (d < 0.05) { hit = true; m = mm; break; }
      z -= Math.max(0.05, d * 0.8);
    }
    if (!hit) continue;
    // 法線
    const g = (dx, dy, dz) => ev(scene, x + dx, y + dy, z + dz)[0];
    let nx = g(eps, 0, 0) - g(-eps, 0, 0), ny = g(0, eps, 0) - g(0, -eps, 0), nz = g(0, 0, eps) - g(0, 0, -eps);
    const nl = len3(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
    pix[py * W + px] = { x, y, z, nx, ny, nz, m };
  }
  // 影 (光源へのソフトシャドウ) と AO。L は物体から光源へ向かう向き (左上手前)
  for (const p of pix) {
    if (!p) continue;
    const lx = L[0], ly = L[1], lz = L[2];
    let sh = 1, t = 1.2;
    for (let i = 0; i < 40 && t < 50; i++) {
      const d = ev(scene, p.x + p.nx * 0.4 + lx * t, p.y + p.ny * 0.4 + ly * t, p.z + p.nz * 0.4 + lz * t)[0];
      if (d < 0.02) { sh = 0; break; }
      sh = Math.min(sh, 6 * d / t); t += Math.max(0.3, d);
    }
    p.sh = clamp(sh, 0, 1);
    let ao = 0;
    for (let i = 1; i <= 4; i++) { const h = i * 1.2; const d = ev(scene, p.x + p.nx * h, p.y + p.ny * h, p.z + p.nz * h)[0]; ao += (h - d) / Math.pow(1.7, i); }
    p.ao = clamp(1 - ao * 0.35, 0, 1);
  }
  // 陰影 → 段階
  const lights = opt.lights || []; // 点光源 {p:[x,y,z], r, k, mat?}
  const out = new Array(W * H).fill(null);
  for (let i = 0; i < W * H; i++) {
    const p = pix[i]; if (!p) continue;
    const M = mats[p.m]; if (!M) throw new Error("no mat " + p.m);
    const px = i % W, py = (i / W) | 0;
    if (M.solid) { out[i] = M.solid; continue; }
    let v;
    if (M.emit) v = M.emit(p);
    else {
      const lam = Math.max(0, p.nx * L[0] + p.ny * L[1] + p.nz * L[2]);
      const amb = M.amb ?? 0.14, dif = M.dif ?? 0.95;
      v = amb * (0.55 + 0.45 * p.ao) + dif * lam * (0.25 + 0.75 * p.sh) * (0.7 + 0.3 * p.ao);
      // 下からの照り返し (濡れた床)
      if (opt.bounce) v += opt.bounce * Math.max(0, p.ny) * p.ao;
      for (const l of lights) {
        const dx = l.p[0] - p.x, dy = l.p[1] - p.y, dz = l.p[2] - p.z, dl = len3(dx, dy, dz);
        const ll = Math.max(0, (p.nx * dx + p.ny * dy + p.nz * dz) / dl);
        v += (l.k ?? 1) * ll * Math.max(0, 1 - dl / l.r) ** 1.5;
      }
      if (M.shade) v += M.shade(p);
      // 鏡面 (視線 = +z)
      if (M.spec) {
        const hx = L[0], hy = L[1], hz = L[2] + 1, hl = len3(hx, hy, hz);
        const sp = Math.pow(Math.max(0, (p.nx * hx + p.ny * hy + p.nz * hz) / hl), M.pow || 30) * M.spec * p.sh;
        if (sp > 0.5 && M.specCol) { out[i] = M.specCol; continue; }
        v += sp;
      }
    }
    const n = M.ramp.length;
    const dith = (M.dither ?? 0.6) * BAYER[py & 3][px & 3];
    const idx = clamp(Math.floor(clamp(v, 0, 1.2) * (M.gain ?? 1) * n + dith), 0, n - 1);
    out[i] = M.ramp[idx];
    p.idx = idx;
  }
  // 奥行きの段差に暗い線 (前の物の後ろ側を締める)
  const edge = opt.inner ?? 3.5;
  const res = out.slice();
  for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
    const i = py * W + px, p = pix[i]; if (!p || !out[i] || mats[p.m].emit || mats[p.m].solid) continue;
    let deeper = false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const q = pix[(py + dy) * W + px + dx]; if (!q || px + dx < 0 || px + dx >= W) continue;
      if (q.z - p.z > edge) deeper = true;
    }
    if (deeper) res[i] = mats[p.m].ramp[0];
  }
  // 寒色のリム: シルエット右・下側の縁
  const rim = opt.rim;
  if (rim) for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
    const i = py * W + px, p = pix[i]; if (!p || mats[p.m].emit || mats[p.m].solid || mats[p.m].noRim) continue;
    const empty = (dx, dy) => { const X = px + dx, Y = py + dy; return X < 0 || Y < 0 || X >= W || Y >= H || !pix[Y * W + X]; };
    if ((empty(1, 0) || empty(1, 1)) && p.nx > (opt.rimTh ?? 0.25) && !empty(-1, 0)) res[i] = mats[p.m].rimCol || rim;
  }
  return { W, H, px: res, pix };
}

// ---------- 仕上げ: 2D の上描き ----------
export class Canvas {
  constructor(r) { this.W = r.W; this.H = r.H; this.px = r.px; this.pix = r.pix; }
  get(x, y) { return x < 0 || y < 0 || x >= this.W || y >= this.H ? null : this.px[y * this.W + x]; }
  set(x, y, c) { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= this.W || y >= this.H) return; this.px[y * this.W + x] = c; }
  line(x0, y0, x1, y1, c) { const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))) || 1; for (let i = 0; i <= n; i++) this.set(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, c); }
  only(x, y, c) { if (this.get(Math.round(x), Math.round(y))) this.set(x, y, c); } // 既に塗られた所だけ
  disc(cx, cy, r, c) { for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) this.set(x, y, c); }
  // 色の置換 (1段明るく/暗く) を ramp の中で
  shift(x, y, ramp, d) { const c = this.get(x, y); const i = ramp.indexOf(c); if (i >= 0) this.set(x, y, ramp[clamp(i + d, 0, ramp.length - 1)]); }
  toArt() {
    const cols = new Map(); cols.set("#000000", "o");
    const CH = "ABCDEFGHIJKLMNPQRSTUVWXYZabcdefghijklmnpqrstuvwxyz0123456789@#$%&*+=?!";
    let ci = 0;
    for (const c of this.px) if (c && !cols.has(c)) { if (ci >= CH.length) throw new Error("palette overflow"); cols.set(c, CH[ci++]); }
    const palette = {}; for (const [c, k] of cols) palette[k] = c;
    // 未使用の o は残しても無害
    const art = [];
    for (let y = 0; y < this.H; y++) { let s = ""; for (let x = 0; x < this.W; x++) { const c = this.px[y * this.W + x]; s += c ? cols.get(c) : "."; } art.push(s); }
    return { palette, art };
  }
}

// プレビュー PNG (黒い縁取り付き、背景色)
export function preview(path, arts, s = 3, cols = 4, bg = "#1a1c22") {
  const cw = Math.max(...arts.map(a => a.art[0].length)) + 6, ch = Math.max(...arts.map(a => a.art.length)) + 6;
  const rows = Math.ceil(arts.length / cols), Wd = cw * cols * s, Hd = ch * rows * s;
  const buf = new Uint8Array(Wd * Hd * 4); const b = hex2(bg);
  for (let i = 0; i < Wd * Hd; i++) { buf[i * 4] = b[0]; buf[i * 4 + 1] = b[1]; buf[i * 4 + 2] = b[2]; buf[i * 4 + 3] = 255; }
  const put = (X, Y, c, a = 1) => { for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) { const p = ((Y * s + dy) * Wd + X * s + dx) * 4; for (let k = 0; k < 3; k++) buf[p + k] = buf[p + k] * (1 - a) + c[k] * a; } };
  arts.forEach((a, i) => {
    const ox = (i % cols) * cw + 3, oy = Math.floor(i / cols) * ch + 3;
    const at = (x, y) => { const r = a.art[y]; return r && r[x] && r[x] !== "." ? a.palette[r[x]] : null; };
    for (let y = 0; y < a.art.length; y++) for (let x = 0; x < a.art[y].length; x++) if (at(x, y)) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) if (!at(x + dx, y + dy)) put(ox + x + dx, oy + y + dy, [0, 0, 0], 0.88);
    for (let y = 0; y < a.art.length; y++) for (let x = 0; x < a.art[y].length; x++) { const c = at(x, y); if (c) put(ox + x, oy + y, hex2(c)); }
  });
  writePNG(path, Wd, Hd, buf);
}
// 平らな端の円柱 (2点 + 半径)
export function cyl([ax, ay, az], [bx, by, bz], r, mat, round = 0) {
  const bax = bx - ax, bay = by - ay, baz = bz - az, baba = bax * bax + bay * bay + baz * baz;
  return leaf((x, y, z) => {
    const pax = x - ax, pay = y - ay, paz = z - az, paba = pax * bax + pay * bay + paz * baz;
    const cx = len3(pax * baba - bax * paba, pay * baba - bay * paba, paz * baba - baz * paba) - (r - round) * baba;
    const cy = Math.abs(paba - baba * 0.5) - baba * 0.5;
    const x2 = cx * cx, y2 = cy * cy * baba;
    const d = Math.max(cx, cy) < 0 ? -Math.min(x2, y2) : (cx > 0 ? x2 : 0) + (cy > 0 ? y2 : 0);
    return Math.sign(d) * Math.sqrt(Math.abs(d)) / baba - round;
  }, mat, [(ax + bx) / 2, (ay + by) / 2, (az + bz) / 2, Math.sqrt(baba) / 2 + r]);
}
// 口の中 (材質 mawMat の画素) の上縁・下縁から牙を生やす
export function fangs(C, mawMat, x0, x1, { step = 3, top = [3, 5], bot = [2, 4], cols = ["#5c5a4a", "#a8a28a", "#e8e2c8"], seed = 1, lean = 0 } = {}) {
  let s = seed >>> 0 || 1; const R = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const isM = (x, y) => { const p = C.pix[y * C.W + x]; return p && p.m === mawMat; };
  for (let x = x0; x <= x1; x += step) {
    let yt = -1, yb = -1;
    for (let y = 0; y < C.H; y++) if (isM(x, y)) { if (yt < 0) yt = y; yb = y; }
    if (yt < 0) continue;
    const gap = yb - yt;
    const lt = Math.min(Math.floor(gap * 0.6), top[0] + Math.floor(R() * (top[1] - top[0] + 1)));
    const lb = Math.min(Math.floor(gap * 0.5), bot[0] + Math.floor(R() * (bot[1] - bot[0] + 1)));
    for (let k = 0; k < lt; k++) C.set(x + lean * k, yt + k, cols[k === lt - 1 ? 2 : k === 0 ? 0 : 1]);
    for (let k = 0; k < lb; k++) C.set(x - lean * k, yb - k, cols[k === lb - 1 ? 2 : k === 0 ? 0 : 1]);
  }
}
// 管の点列の片側へずらした多角形 (ひれ用)
export function ribbon(pts, side, w0, w1, from = 0, to = 1) {
  const n = pts.length, a = Math.floor(from * (n - 1)), b = Math.ceil(to * (n - 1));
  const out = [], back = [];
  for (let i = a; i <= b; i++) {
    const p = pts[i], q = pts[Math.min(n - 1, i + 1)], o = pts[Math.max(0, i - 1)];
    const tx = q[0] - o[0], ty = q[1] - o[1], l = Math.hypot(tx, ty) || 1, nx = -ty / l * side, ny = tx / l * side;
    const t = (i - a) / Math.max(1, b - a), w = w0 + (w1 - w0) * t;
    back.push([p[0] + nx * (p[3] * 0.4), p[1] + ny * (p[3] * 0.4)]);
    out.push([p[0] + nx * (p[3] + w), p[1] + ny * (p[3] + w)]);
  }
  return out.concat(back.reverse());
}
