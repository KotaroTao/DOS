// ===== 戦闘背景: 層ごとのピクセルアート情景 =====
// 公開関数は drawBattleBackdrop(ctx, w, h, layer, now, opts) のみ。
// ・静的な情景は (層, サイズ, 変種) ごとに半解像度 (480x320 → 240x160) のオフスクリーンへ一度だけ描いて
//   キャッシュし、毎フレームは 2 倍拡大 (補間なし) で貼る → ゲーム本体と同じ「粗いドット」の質感になる。
// ・その上に安価なアニメ層 (粒子・灯火の揺らぎ・霧・明滅) を重ねる。粒子は now から決定的に算出し、
//   毎フレームの乱数や状態の蓄積はしない。
// ・半解像度ラスタ Pix は「表面 (照明を受ける)」と「自発光 (空・溶岩・炎)」の 2 枚を持ち、
//   照明 × 表面 + 自発光 → 名札帯の均し・中央減光・周辺減光 → ベイヤー減色 の順で仕上げる。
// 構図の約束: 地平はおよそ 0.56-0.62h。敵が立つ中央 (x15-85%, y15-70%) は暗く低コントラストに保ち、
// 名札/HPバーが載る 0.62h-0.80h 帯は均一で暗く。強いシルエットや光源は左右の縁・上部・遠景へ寄せる。

const SURF = 0, SKY = 1, ADD = 2; // 描画モード: 表面 / 自発光(上書き) / 自発光(加算)
const TAU = Math.PI * 2;
const Q = 5; // 最終減色の階調幅 (0-255 を Q 刻みにベイヤー誤差拡散)

// ---------- 色と乱数の小道具 ----------
const memoC = new Map();
function C(h) {
  if (typeof h !== "string") return h;
  let c = memoC.get(h);
  if (!c) { const n = parseInt(h.slice(1), 16); c = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; memoC.set(h, c); }
  return c;
}
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const sstep = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const bayer = (x, y) => BAYER[((y & 3) << 2) | (x & 3)];
function hash(a, b = 0, s = 0) {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(s | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y, s) => vnoise(x, y, s) * 0.58 + vnoise(x * 2.07, y * 2.07, s + 7) * 0.28 + vnoise(x * 4.3, y * 4.3, s + 13) * 0.14;
function rnd(seed) { // mulberry32: 配置用の決定的乱数
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function stopCol(stops, t) {
  if (t <= stops[0][0]) return C(stops[0][1]);
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) { const [t0, c0] = stops[i - 1], [t1, c1] = stops[i]; return mix(C(c0), C(c1), (t - t0) / (t1 - t0 || 1)); }
  }
  return C(stops[stops.length - 1][1]);
}
// ノイズ混色のテクスチャ関数 (色関数として poly/rect に渡す)
const tex = (c0, c1, sx, seed, sy = sx) => (x, y) => mix(C(c0), C(c1), fbm(x * sx, y * sy, seed));

function makeCanvas(w, h) {
  if (typeof document !== "undefined" && document.createElement) {
    const c = document.createElement("canvas"); c.width = w; c.height = h; return c;
  }
  return new OffscreenCanvas(w, h);
}

// ---------- 半解像度ラスタ ----------
class Pix {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.al = new Float32Array(w * h * 3); // 表面の色 (照明で乗算される)
    this.em = new Float32Array(w * h * 3); // 自発光 (照明の影響を受けない)
    this.m = SURF; this.amb = [1, 1, 1]; this.lights = []; this.post = [];
  }
  _b(i, c, a) {
    const al = this.al, em = this.em;
    if (this.m === SURF) {
      al[i] += (c[0] - al[i]) * a; al[i + 1] += (c[1] - al[i + 1]) * a; al[i + 2] += (c[2] - al[i + 2]) * a;
      const k = 1 - a; em[i] *= k; em[i + 1] *= k; em[i + 2] *= k;
    } else if (this.m === SKY) {
      em[i] += (c[0] - em[i]) * a; em[i + 1] += (c[1] - em[i + 1]) * a; em[i + 2] += (c[2] - em[i + 2]) * a;
      const k = 1 - a; al[i] *= k; al[i + 1] *= k; al[i + 2] *= k;
    } else { em[i] += c[0] * a; em[i + 1] += c[1] * a; em[i + 2] += c[2] * a; }
  }
  span(y, xa, xb, c, a = 1) {
    if (y < 0 || y >= this.h) return;
    const x0 = Math.max(0, Math.round(xa)), x1 = Math.min(this.w, Math.round(xb)), f = typeof c === "function";
    if (!f) c = C(c);
    for (let x = x0; x < x1; x++) { const cc = f ? c(x, y) : c; if (cc) this._b((y * this.w + x) * 3, cc, a); }
  }
  rect(x, y, w, h, c, a = 1) {
    const y0 = Math.max(0, Math.round(y)), y1 = Math.min(this.h, Math.round(y + h));
    for (let yy = y0; yy < y1; yy++) this.span(yy, x, x + w, c, a);
  }
  px(x, y, c, a = 1) { this.rect(Math.floor(x), Math.floor(y), 1, 1, c, a); }
  poly(pts, c, a = 1) {
    let y0 = Infinity, y1 = -Infinity;
    for (const p of pts) { if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
    const n = pts.length, xs = [];
    for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(this.h - 1, Math.ceil(y1)); y++) {
      const sy = y + 0.5; xs.length = 0;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const yi = pts[i][1], yj = pts[j][1];
        if ((yi > sy) !== (yj > sy)) xs.push(pts[i][0] + ((sy - yi) / (yj - yi)) * (pts[j][0] - pts[i][0]));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) this.span(y, xs[k], xs[k + 1], c, a);
    }
  }
  ellipse(cx, cy, rx, ry, c, a = 1) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      const dy = (y + 0.5 - cy) / ry; if (dy * dy >= 1) continue;
      const hw = rx * Math.sqrt(1 - dy * dy); this.span(y, cx - hw, cx + hw, c, a);
    }
  }
  line(x0, y0, x1, y1, c, a = 1, t = 1) {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    let lx = 1e9, ly = 1e9;
    for (let i = 0; i <= n; i++) {
      const x = Math.round(x0 + ((x1 - x0) * i) / n - t / 2), y = Math.round(y0 + ((y1 - y0) * i) / n - t / 2);
      if (x === lx && y === ly) continue; lx = x; ly = y;
      this.rect(x, y, t, t, c, a);
    }
  }
  taper(x0, y0, x1, y1, t0, t1, c, a = 1) { // 先細りの帯 (枝・根・肋骨)
    if (Math.max(t0, t1) < 1.4) return this.line(x0, y0, x1, y1, c, a, 1);
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    this.poly([[x0 + (nx * t0) / 2, y0 + (ny * t0) / 2], [x1 + (nx * t1) / 2, y1 + (ny * t1) / 2],
      [x1 - (nx * t1) / 2, y1 - (ny * t1) / 2], [x0 - (nx * t0) / 2, y0 - (ny * t0) / 2]], c, a);
  }
  glow(cx, cy, rx, ry, c, k = 1, steps = 5) { // 加算の光暈 (段階的に量子化してドット絵らしい光の輪に)
    c = C(c); const pm = this.m; this.m = ADD;
    const x0 = Math.max(0, Math.floor(cx - rx)), x1 = Math.min(this.w, Math.ceil(cx + rx));
    const y0 = Math.max(0, Math.floor(cy - ry)), y1 = Math.min(this.h, Math.ceil(cy + ry));
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, d2 = dx * dx + dy * dy;
      if (d2 >= 1) continue;
      let f = 1 - Math.sqrt(d2); f *= f;
      if (steps) f = Math.floor(f * steps + bayer(x, y)) / steps;
      if (f > 0) this._b((y * this.w + x) * 3, c, k * f);
    }
    this.m = pm;
  }
  vgrad(x, y, w, h, stops, a = 1) {
    for (let yy = Math.round(y); yy < Math.round(y + h); yy++) this.span(yy, x, x + w, stopCol(stops, (yy - y) / Math.max(1, h - 1)), a);
  }
  light(x, y, r, col, k = 1, ry = r) { const c = C(col); this.lights.push({ x, y, rx: r, ry, c: [c[0] / 255 * k, c[1] / 255 * k, c[2] / 255 * k] }); }
  compose() {
    const { w, h, al, em, lights, amb } = this, out = new Float32Array(w * h * 3);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3; let r = amb[0], g = amb[1], b = amb[2];
      for (let k = 0; k < lights.length; k++) {
        const L = lights[k], dx = (x + 0.5 - L.x) / L.rx, dy = (y + 0.5 - L.y) / L.ry, d2 = dx * dx + dy * dy;
        if (d2 < 1) { let f = 1 - Math.sqrt(d2); f = Math.floor(f * f * 6 + bayer(x, y)) / 6; r += L.c[0] * f; g += L.c[1] * f; b += L.c[2] * f; }
      }
      out[i] = al[i] * r + em[i]; out[i + 1] = al[i + 1] * g + em[i + 1]; out[i + 2] = al[i + 2] * b + em[i + 2];
    }
    for (const fn of this.post) fn(out, w, h);
    return out;
  }
}

// 合成済みバッファ → ベイヤー減色してキャンバス化
function toCanvas(buf, w, h) {
  const cv = makeCanvas(w, h), cx = cv.getContext("2d"), id = cx.createImageData(w, h), d = id.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, j = i * 3, o = i * 4, b = bayer(x, y) - 0.5;
    for (let k = 0; k < 3; k++) { const v = Math.round(buf[j + k] / Q + b) * Q; d[o + k] = v < 0 ? 0 : v > 255 ? 255 : v; }
    d[o + 3] = 255;
  }
  cx.putImageData(id, 0, 0);
  return cv;
}

// ---------- 情景の部品 ----------
function stars(R, seed, n, ymax, col, x0 = 0, x1 = R.w) {
  const r = rnd(seed), c = C(col); R.m = SKY;
  for (let i = 0; i < n; i++) {
    const x = x0 + r() * (x1 - x0), y = r() * ymax, b = 0.25 + r() * 0.75;
    R.px(x, y, c, b * 0.8);
    if (b > 0.92) { R.px(x - 1, y, c, 0.25); R.px(x + 1, y, c, 0.25); R.px(x, y - 1, c, 0.25); R.px(x, y + 1, c, 0.25); }
  }
}
function moon(R, x, y, r, c0 = "#e4eaf0", c1 = "#8d98aa") {
  R.m = SKY;
  R.ellipse(x, y, r, r, (px, py) => {
    const dx = (px + 0.5 - x) / r, dy = (py + 0.5 - y) / r;
    let k = clamp01(0.85 - dx * 0.25 - dy * 0.35);
    if (vnoise(px * 0.45, py * 0.45, 77) > 0.62) k *= 0.8; // 海 (クレーター)
    return mix(C(c1), C(c0), k);
  });
}
function clouds(R, seed, y0, y1, col, thr, rim, sx = 0.022, sy = 0.085) {
  const c = C(col), rc = rim && C(rim); R.m = SKY;
  for (let y = Math.max(0, Math.floor(y0)); y < Math.min(R.h, y1); y++) {
    const edge = Math.min(1, (y - y0) / 6, (y1 - y) / 6);
    for (let x = 0; x < R.w; x++) {
      const v = (fbm(x * sx, y * sy, seed) - thr) * 7 * edge;
      if (v <= 0) continue;
      const a = Math.min(1, Math.floor(v * 3 + bayer(x, y)) / 3);
      if (a <= 0) continue;
      const top = rc && fbm(x * sx, (y - 2) * sy, seed) < thr + 0.01;
      R._b((y * R.w + x) * 3, top ? rc : c, a * 0.92);
    }
  }
}
function ridge(R, seed, base, amp, fr, col, mode = SKY) {
  R.m = mode; const c = C(col);
  for (let x = 0; x < R.w; x++) { const top = Math.round(base - amp * fbm(x * fr, 0.5, seed)); R.rect(x, top, 1, R.h - top, c); }
}
function fogBand(R, y, hgt, col, a, seed, sx = 0.03) {
  const c = C(col), pm = R.m; R.m = SKY;
  for (let yy = Math.floor(y - hgt / 2); yy < y + hgt / 2; yy++) {
    if (yy < 0 || yy >= R.h) continue;
    const p = 1 - Math.abs(yy + 0.5 - y) / (hgt / 2);
    for (let x = 0; x < R.w; x++) {
      const k = a * p * p * (0.35 + fbm(x * sx, yy * 0.2, seed));
      if (k > 0.01) R._b((yy * R.w + x) * 3, c, Math.min(1, k));
    }
  }
  R.m = pm;
}
function ground(R, gy, c0, c1, seed, sc = 0.09, k = 0.3) {
  const a = C(c0), b = C(c1); R.m = SURF;
  for (let y = gy; y < R.h; y++) {
    const base = mix(a, b, (y - gy) / Math.max(1, R.h - gy));
    R.span(y, 0, R.w, (x) => mul(base, 1 - k / 2 + k * fbm(x * sc, y * sc * 2.4, seed)));
  }
}
// 遠近の目地: 消失点 (vx,vy) から放射する線 + 手前ほど間隔の広がる横目地
function perspGrid(R, gy, vx, vy, col, a, nRays, rows, y1 = R.h) {
  const c = C(col); R.m = SURF;
  for (let i = -nRays; i <= nRays; i++) {
    const bx = vx + i * (R.w / nRays) * 0.75, xg = vx + ((bx - vx) * (gy - vy)) / (y1 - vy);
    R.line(xg, gy, bx, y1, c, a);
  }
  for (let k = 1; k <= rows; k++) { const y = Math.round(gy + (y1 - gy) * Math.pow(k / rows, 1.7)); R.rect(0, y, R.w, 1, c, a * 0.8); }
}
function bricks(R, x0, y0, x1, y1, c, mortar, bw, bh, seed, jit = 0.22) {
  const cb = C(c), cm = C(mortar); R.m = SURF;
  R.rect(x0, y0, x1 - x0, y1 - y0, (x, y) => {
    const row = Math.floor((y - y0) / bh), off = row & 1 ? bw >> 1 : 0, lx0 = x - x0 + off;
    const col = Math.floor(lx0 / bw), lx = lx0 - col * bw, ly = y - y0 - row * bh;
    if (ly === bh - 1 || lx === bw - 1) return cm;
    const v = 1 - jit / 2 + jit * hash(col, row, seed), hl = ly === 0 ? 1.18 : lx === 0 ? 1.08 : 1;
    return mul(cb, v * hl * (0.9 + 0.2 * vnoise(x * 0.6, y * 0.6, seed)));
  });
}
// アーチ形の多角形 (p=0: 半円 / p>0: 尖頭アーチ)
function archPts(cx, top, hw, bot, p = 0, n = 12) {
  const r = hw * (1 + p), sy = top + hw * Math.sqrt(1 + 2 * p), ccx = cx + hw * p;
  const aEnd = TAU - Math.acos(-p / (1 + p)), L = [];
  for (let i = 0; i <= n; i++) { const a = Math.PI + ((aEnd - Math.PI) * i) / n; L.push([ccx + r * Math.cos(a), sy + r * Math.sin(a)]); }
  const Rr = L.slice().reverse().map(([x, y]) => [2 * cx - x, y]);
  return [[cx - hw, bot], ...L, ...Rr, [cx + hw, bot]];
}
// 石組みのアーチ枠 (外周を石色で描いて内側を c2 でくり抜く)。joints で迫石の目地を入れる
function archFrame(R, cx, top, hw, bot, th, stone, inner, p = 0, joints = 0, jc) {
  R.m = SURF; R.poly(archPts(cx, top - th, hw + th, bot, p), stone);
  if (joints) {
    const sy = top + hw * Math.sqrt(1 + 2 * p);
    for (let i = 1; i < joints; i++) {
      const a = Math.PI + (Math.PI * i) / joints, ca = Math.cos(a), sa = Math.sin(a);
      R.line(cx + ca * hw, sy + sa * (sy - top), cx + ca * (hw + th), sy + sa * (sy - top + th), jc, 0.8);
    }
  }
  if (inner) { R.m = inner.sky ? SKY : SURF; R.poly(archPts(cx, top, hw, bot, p), inner.c || inner); R.m = SURF; }
}
// 円柱 (左上から光: 左明・右暗の縦陰影)。o.cap/o.base で柱頭・柱礎、o.broken で上端を折る、o.flute で縦溝
function column(R, x, top, bot, w, c, o = {}) {
  const cb = C(c);
  const sh = (xx, yy) => {
    const u = (xx + 0.5 - x) / w;
    let k = u < 0.2 ? 0.95 : u < 0.45 ? 1.15 : u < 0.7 ? 0.9 : u < 0.88 ? 0.7 : 0.5;
    if (o.flute && (xx - Math.round(x)) % 3 === 2) k *= 0.82;
    return mul(cb, k * (0.9 + 0.2 * vnoise(xx * 0.5, yy * 0.12, 5)) * (o.fade ? 1 - o.fade * clamp01((yy - top) / (bot - top)) : 1));
  };
  R.m = o.mode ?? SURF;
  if (o.broken) {
    const r = rnd(o.broken), j = () => r() * 5;
    R.poly([[x, bot], [x, top + j()], [x + w * 0.3, top - j() * 0.6], [x + w * 0.5, top + j()], [x + w * 0.75, top - j() * 0.4], [x + w, top + j() + 2], [x + w, bot]], sh);
  } else R.rect(x, top, w, bot - top, sh);
  if (o.cap && !o.broken) { R.rect(x - 2, top - 2, w + 4, 2, mul(cb, 1.05)); R.rect(x - 3, top - 4, w + 6, 2, mul(cb, 1.2)); R.rect(x - 3, top - 2, w + 6, 1, mul(cb, 0.5)); }
  if (o.base) { R.rect(x - 2, bot - 3, w + 4, 3, mul(cb, 0.95)); R.rect(x - 2, bot - 3, w + 4, 1, mul(cb, 1.2)); }
}
// つらら石 (dir=1 下向き) / 石筍 (dir=-1 上向き)。左面明・右面暗、縦に段の筋
function spike(R, x, y, len, w, c, dir = 1, lit = 1) {
  const cb = C(c), tip = y + len * dir;
  const pts = [[x - w / 2, y], [x + w / 2, y], [x + w * 0.12, y + dir * len * 0.62], [x + 0.5, tip], [x - w * 0.14, y + dir * len * 0.55]];
  R.m = SURF;
  R.poly(pts, (px, py) => {
    const rel = (px + 0.5 - x) / (w / 2);
    const k = rel < -0.35 ? 1.12 * lit : rel < 0.25 ? 0.92 : 0.66;
    return mul(cb, k * (0.88 + 0.24 * vnoise(px * 0.3, py * 0.5, 9)));
  });
}
// 枯れ木 (再帰的に枝分かれ。各枝を 2 分割して途中で折りくねらせる)
function tree(R, x, by, h, seed, col, o = {}) {
  const rng = rnd(seed), segs = [], depth = o.depth ?? 5, spread = o.spread ?? 0.75;
  const grow = (x0, y0, ang, len, th, d) => {
    const k = (rng() - 0.5) * (o.gnarl ?? 0.6);
    const xm = x0 + Math.cos(ang + k) * len * 0.5, ym = y0 + Math.sin(ang + k) * len * 0.5;
    const x1 = xm + Math.cos(ang - k) * len * 0.5, y1 = ym + Math.sin(ang - k) * len * 0.5;
    segs.push([x0, y0, xm, ym, th, th * 0.83], [xm, ym, x1, y1, th * 0.83, th * 0.68]);
    if (d <= 0 || len < 2.5) { if (o.tips) o.tips.push([x1, y1]); return; }
    const n = d > depth - 2 ? 2 : 2 + (rng() < 0.35 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const a = ang + (i - (n - 1) / 2) * spread + (rng() - 0.5) * 0.5 + (o.bias || 0);
      grow(x1, y1, a, len * (0.62 + rng() * 0.2), th * 0.68, d - 1);
    }
  };
  grow(x, by, -Math.PI / 2 + (o.lean || 0), h * 0.36, o.th ?? Math.max(2, h * 0.08), depth);
  R.m = SURF;
  if (o.rim) for (const s of segs) R.taper(s[0] + (o.rimDx ?? 1), s[1] - 1, s[2] + (o.rimDx ?? 1), s[3] - 1, s[4], s[5], o.rim);
  for (const s of segs) R.taper(s[0], s[1], s[2], s[3], s[4], s[5], col);
  // 根元の張り出し
  const th0 = o.th ?? Math.max(2, h * 0.08);
  R.poly([[x - th0 * 1.4, by + 1], [x - th0 * 0.4, by - th0 * 1.5], [x + th0 * 0.4, by - th0 * 1.5], [x + th0 * 1.5, by + 1]], col);
}
// 墓石 (0=丸頭 1=十字 2=肩付き 3=オベリスク 4=ケルト十字)。tilt で傾け、rim で月光側の縁取り
function tomb(R, x, by, w, h, kind, col, tilt = 0, rim = null) {
  const hw = w / 2, polys = [];
  if (kind === 0) { const p = [[-hw, 0], [-hw, -h + hw]]; for (let i = 1; i < 10; i++) { const a = Math.PI + (Math.PI * i) / 10; p.push([Math.cos(a) * hw, -h + hw + Math.sin(a) * hw]); } p.push([hw, -h + hw], [hw, 0]); polys.push(p); }
  else if (kind === 1 || kind === 4) {
    const bw = Math.max(2, w * 0.34) / 2, cy = -h * 0.72;
    polys.push([[-bw, 0], [-bw, -h], [bw, -h], [bw, 0]], [[-hw, cy - bw], [hw, cy - bw], [hw, cy + bw], [-hw, cy + bw]]);
    if (kind === 4) polys.push([[-hw * 0.7, 0], [-hw * 0.7, -h * 0.25], [hw * 0.7, -h * 0.25], [hw * 0.7, 0]]);
  } else if (kind === 2) polys.push([[-hw, 0], [-hw, -h * 0.8], [-hw * 0.6, -h * 0.8], [-hw * 0.6, -h], [hw * 0.6, -h], [hw * 0.6, -h * 0.8], [hw, -h * 0.8], [hw, 0]]);
  else polys.push([[-hw, 0], [-hw * 0.65, -h * 0.86], [0, -h], [hw * 0.65, -h * 0.86], [hw, 0]]);
  const cs = Math.cos(tilt), sn = Math.sin(tilt), cb = C(col), rc = rim && C(rim);
  const fn = (px, py) => {
    const dx = px + 0.5 - x, dy = py + 0.5 - by, u = dx * cs + dy * sn, v = -dx * sn + dy * cs;
    if (rc && u > hw - 1.3 && kind !== 1 && kind !== 4) return rc;
    let k = u < -hw + 1.2 ? 0.7 : 1;
    k *= 0.85 + 0.3 * vnoise(px * 0.5, py * 0.5, 3);
    if (v > -h * 0.3 && vnoise(px * 0.6, py * 0.6, 8) > 0.6) return mul(mix(cb, [30, 40, 26], 0.5), k); // 苔
    return mul(cb, k);
  };
  R.m = SURF;
  for (const p of polys) {
    const T = p.map(([u, v]) => [x + u * cs - v * sn, by + u * sn + v * cs]);
    if (rc) R.poly(T.map(([a, b]) => [a + 1, b]), rc);
    R.poly(T, fn);
  }
  if (kind === 0 && h > 10) R.line(x - 1 + 0.5, by - h * 0.62, x + 1.5, by - h * 0.62, mul(cb, 0.55)); // 碑文の刻み
}
function skull(R, x, y, c, dark, s = 1) { // 5x5 の髑髏 (s=2 で倍)
  const P = [".###.", "#####", "#.#.#", "##.##", ".#.#."];
  R.m = SURF;
  for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) {
    const ch = P[j][i];
    if (ch === "#") R.rect(x + i * s, y + j * s, s, s, j === 0 ? mul(C(c), 1.15) : i > 3 ? mul(C(c), 0.75) : c);
    else if (dark && (j === 2 || j === 3)) R.rect(x + i * s, y + j * s, s, s, dark);
  }
}
function chainV(R, x, y0, y1, c) { // 縦の鎖 (輪と横向きの輪を交互に)
  R.m = SURF; const cb = C(c);
  for (let y = y0, k = 0; y < y1; y += 3, k++) {
    if (k & 1) R.rect(x, y, 1, 3, cb); else { R.rect(x - 1, y, 3, 1, cb); R.rect(x - 1, y + 2, 3, 1, mul(cb, 0.7)); R.px(x - 1, y + 1, cb); R.px(x + 1, y + 1, mul(cb, 0.7)); }
  }
}
function chainSag(R, x0, y0, x1, y1, sag, c, th = 1) { // 垂れ下がる鎖 (放物線)
  const n = Math.ceil(Math.abs(x1 - x0) / 2), cb = C(c); R.m = SURF;
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t + sag * 4 * t * (1 - t);
    R.rect(Math.round(x), Math.round(y) - (i & 1 ? 0 : 1), th + 1, i & 1 ? th : th + 1, i & 1 ? mul(cb, 0.75) : cb);
  }
}
function banner(R, x, y, w, h, c, seed, trim) { // 裂けた旗 (下端がぼろぼろ)
  const r = rnd(seed), cb = C(c), cuts = [];
  for (let i = 0; i < w; i++) cuts.push(h - Math.floor(r() * h * 0.35) - (i % 3 === 1 ? 2 : 0));
  R.m = SURF;
  for (let i = 0; i < w; i++) {
    const fold = 0.75 + 0.35 * Math.sin((i / w) * Math.PI * 2.4 + 0.6);
    R.rect(x + i, y, 1, cuts[i], (px, py) => mul(cb, fold * (0.85 + 0.25 * vnoise(px * 0.4, py * 0.3, seed))));
  }
  if (trim) { R.rect(x, y + 2, w, 1, trim); R.rect(x, y, 1, Math.min(...cuts), mul(C(trim), 0.7)); R.rect(x + w - 1, y, 1, Math.min(...cuts), mul(C(trim), 0.7)); }
  R.rect(x - 2, y - 1, w + 4, 2, "#1a1612");
}
function flame(R, A, x, y, s, inner, outer, flick = true, lightR = 0, lightK = 1) { // 小さな炎 (自発光) + 揺らぎ登録
  R.m = SKY;
  R.poly([[x - s * 0.8, y], [x - s * 0.5, y - s * 1.2], [x, y - s * 2.4], [x + s * 0.5, y - s * 1.2], [x + s * 0.8, y]], outer);
  R.poly([[x - s * 0.35, y], [x, y - s * 1.4], [x + s * 0.35, y]], inner);
  R.glow(x, y - s, s * 5, s * 5, outer, 0.3, 4);
  if (lightR) R.light(x, y - s, lightR, outer, lightK);
  if (flick && A) A.flick(x, y - s, Math.max(6, s * 7), outer, 0.45, 1);
  R.m = SURF;
}
// 結晶柱: 内部発光する尖った柱 + 周囲の淡い光
function crystal(R, x, by, h, w, lean, c, gk = 0.25) {
  const cb = C(c), tx = x + lean * h;
  R.m = SKY;
  R.poly([[x - w / 2, by], [x - w / 2 + lean * h * 0.8, by - h * 0.78], [tx, by - h], [x + w / 2 + lean * h * 0.8, by - h * 0.78], [x + w / 2, by]], (px, py) => {
    const cxl = x + lean * (by - py), rel = (px + 0.5 - cxl) / (w / 2), up = clamp01((by - py) / h);
    return mul(cb, (rel < -0.1 ? 0.75 : rel < 0.35 ? 1.05 : 0.45) * (0.45 + 0.6 * up));
  });
  R.line(x - w * 0.1, by - 1, tx - 0.5, by - h + 1, mix(cb, [255, 255, 255], 0.45), 0.7);
  if (gk) R.glow(x + lean * h * 0.5, by - h * 0.5, h * 1.3, h * 1.1, cb, gk, 5);
  R.m = SURF;
}
function bookshelf(R, x, y, w, h, seed, dim = 1) { // 書架: 枠・段板・くすんだ背表紙
  const r = rnd(seed), pal = ["#4a1f22", "#23304a", "#2d3a22", "#4a3a1c", "#3a2448", "#5a4a30", "#20383a", "#3a1a30", "#504838"];
  R.m = SURF;
  R.rect(x, y, w, h, mul(C("#1c130e"), dim));
  const rows = Math.max(1, Math.floor((h - 3) / 9));
  for (let k = 0; k < rows; k++) {
    const sy = y + 2 + k * 9;
    R.rect(x + 1, sy, w - 2, 8, mul(C("#0b0807"), dim));
    let bx = x + 2;
    while (bx < x + w - 3) {
      const bw = 1 + Math.floor(r() * 3), bh = 5 + Math.floor(r() * 3);
      if (r() < 0.08) { bx += 2 + Math.floor(r() * 3); continue; } // 抜けた隙間
      const c = mul(C(pal[Math.floor(r() * pal.length)]), dim * (0.7 + r() * 0.5));
      R.rect(bx, sy + 8 - bh, bw, bh, c);
      R.rect(bx, sy + 8 - bh, bw, 1, mul(c, 1.35));
      if (bw > 1 && r() < 0.5) R.rect(bx, sy + 8 - bh + 2, bw, 1, mul(C("#a08840"), dim * 0.5)); // 金の帯
      bx += bw;
    }
    R.rect(x, sy + 8, w, 1, mul(C("#3a2818"), dim)); R.rect(x, sy + 9, w, 1, mul(C("#140d09"), dim));
  }
  R.rect(x, y, 2, h, mul(C("#3a2818"), dim)); R.rect(x + w - 2, y, 2, h, mul(C("#24180f"), dim));
  R.rect(x - 1, y - 2, w + 2, 2, mul(C("#4a3420"), dim));
}
function reeds(R, x, by, n, col, seed, hmax = 22, cattail = "#2a1a10") {
  const r = rnd(seed); R.m = SURF;
  for (let i = 0; i < n; i++) {
    const rx = x + (r() - 0.5) * n * 1.6, h = hmax * (0.5 + r() * 0.5), lean = (r() - 0.5) * 0.5;
    R.line(rx, by, rx + lean * h, by - h, mul(C(col), 0.7 + r() * 0.5));
    if (r() < 0.35) R.rect(Math.round(rx + lean * h * 0.85) - 1, Math.round(by - h * 0.85) - 1, 2, 4, cattail);
  }
}
function tufts(R, seed, n, x0, x1, y0, y1, col) {
  const r = rnd(seed), c = C(col); R.m = SURF;
  for (let i = 0; i < n; i++) {
    const x = Math.round(x0 + r() * (x1 - x0)), y = Math.round(y0 + r() * (y1 - y0)), h = 1 + Math.floor(r() * 3);
    R.rect(x, y - h, 1, h, c); if (r() < 0.6) R.px(x - 1, y - 1, mul(c, 0.8)); if (r() < 0.6) R.px(x + 1, y - h + 1, mul(c, 1.1));
  }
}
function rubble(R, seed, n, x0, x1, y0, y1, col) { // 瓦礫 (上面が明るい石塊)
  const r = rnd(seed), c = C(col); R.m = SURF;
  for (let i = 0; i < n; i++) {
    const x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0), s = 2 + r() * 4 * (0.5 + (y - y0) / Math.max(1, y1 - y0));
    R.poly([[x - s, y], [x - s * 0.7, y - s * 0.7], [x + s * 0.4, y - s * 0.8], [x + s, y - s * 0.2], [x + s * 0.8, y]], mul(c, 0.8 + r() * 0.3));
    R.rect(x - s * 0.6, y - s * 0.75, s, 1, mul(c, 1.3));
  }
}

// ---------- アニメ仕様 (情景ごとに登録) ----------
function animSpec() {
  return {
    parts: [], flicks: [], fogs: [], pulses: [], special: null,
    part(o) { this.parts.push(o); },
    flick(x, y, r, col, a = 0.45, sp = 1) { this.flicks.push({ x, y, r: Math.round(r), col, a, sp, s: this.flicks.length * 2.3 + x * 0.1 }); },
    fog(col, y, n, a, sp, fw = 90, fh = 12) { this.fogs.push({ col, y, n, a, sp, fw, fh, seed: this.fogs.length + 3 }); },
    pulse(draw, f) { this.pulses.push({ draw, f }); },
  };
}

// =====================================================================
// 層 1 墓地: 月夜の墓所。傾いた墓石と十字、枯れ木、鉄柵、地を這う霧と鬼火
function sGraveyard(R, A) {
  const { w: W, h: H } = R, gy = Math.round(H * 0.56);
  R.m = SKY;
  R.vgrad(0, 0, W, gy + 6, [[0, "#05060c"], [0.55, "#0f1324"], [1, "#272c3c"]]);
  stars(R, 11, 60, gy * 0.6, "#aab4d0");
  const mx = Math.round(W * 0.8), my = Math.round(H * 0.16);
  R.glow(mx, my, 70, 56, "#4a5a7c", 0.6, 6);
  moon(R, mx, my, 12);
  clouds(R, 4, 4, gy * 0.72, "#0b0e1a", 0.6, "#3c4862");
  ridge(R, 21, gy - 3, 10, 0.02, "#131623");
  // 遠景の礼拝堂 (丘の上の影。窓にかすかな灯)
  const chx = Math.round(W * 0.27), chy = gy - 9;
  R.m = SKY; const cc = C("#10131d");
  R.rect(chx - 7, chy - 7, 14, 9, cc); R.poly([[chx - 8, chy - 7], [chx, chy - 12], [chx + 8, chy - 7]], cc);
  R.rect(chx + 4, chy - 19, 4, 12, cc); R.poly([[chx + 3, chy - 19], [chx + 6, chy - 25], [chx + 9, chy - 19]], cc);
  R.rect(chx + 5, chy - 29, 1, 4, cc); R.rect(chx + 4, chy - 28, 3, 1, cc);
  R.px(chx - 3, chy - 4, "#6a5a3a", 0.8); R.px(chx + 2, chy - 4, "#6a5a3a", 0.6);
  // 地平の小さな墓標の列
  const r = rnd(5);
  for (let i = 0; i < 34; i++) {
    const x = r() * W; if (Math.abs(x - W / 2) < W * 0.12) continue;
    const s = 2 + r() * 2; R.m = SKY; R.rect(x, gy - s - 1 + r() * 3, s * 0.7, s + 1, "#161a26");
  }
  fogBand(R, gy - 3, 16, "#46506a", 0.32, 31);
  ground(R, gy, "#1b1c1c", "#0b0b0a", 7, 0.1, 0.35);
  const rim = "#5c6680";
  // 鉄柵 (中景・左右へ続く)
  const ft = gy - 12, fb = gy + 3, fc = C("#08090e");
  R.m = SURF; R.rect(0, ft + 3, W, 1, fc); R.rect(0, fb - 4, W, 1, fc);
  for (let x = 1; x < W; x += 4) {
    if (x > W * 0.62 && x < W * 0.7) { if (x % 8 === 1) R.line(x, fb, x + 3, ft + 4, fc); continue; } // 壊れた区画
    R.rect(x, ft, 1, fb - ft, fc); R.px(x - 1, ft + 1, fc); R.px(x + 1, ft + 1, fc); R.px(x, ft - 1, fc);
  }
  for (const px of [W * 0.06, W * 0.36, W * 0.58, W * 0.94]) { R.rect(px - 2, ft - 3, 5, fb - ft + 3, "#0c0d13"); R.rect(px - 3, ft - 4, 7, 2, "#14161e"); }
  // 枯れ木 (左右の額縁)。月側 (右) に縁取り
  tree(R, 9, H * 0.86, H * 0.95, 101, "#08080b", { lean: 0.12, bias: 0.12, rim: "#2a3044" });
  tree(R, W - 6, H * 0.8, H * 0.8, 202, "#08080b", { lean: -0.2, bias: -0.15, rim: "#3a4460", rimDx: 1 });
  // 霊廟 (左の中景): 列柱と三角破風、闇の入口
  const mz = Math.round(W * 0.2), mb = gy + 4, mc = (x, y) => mul(C("#2c2e36"), 0.8 + 0.3 * vnoise(x * 0.4, y * 0.4, 2));
  R.m = SURF; R.rect(mz - 14, mb - 3, 28, 3, mc); R.rect(mz - 12, mb - 20, 24, 17, mc);
  R.poly([[mz - 15, mb - 20], [mz, mb - 29], [mz + 15, mb - 20]], mc); R.line(mz, mb - 29, mz + 15, mb - 20, rim, 0.8);
  R.rect(mz - 15, mb - 21, 30, 1, "#4a4e5c"); R.rect(mz + 11, mb - 20, 1, 17, rim, 0.7);
  for (const dx of [-10, -5, 4, 9]) R.rect(mz + dx, mb - 19, 2, 16, "#3a3c46");
  R.m = SKY; R.rect(mz - 2, mb - 16, 5, 13, "#030305"); R.m = SURF; R.rect(mz, mb - 25, 1, 3, "#4a4e5c");
  // 墓の盛り土と手前の墓石 (左右に寄せる)
  const L = [[16, H * 0.93, 13, 24, 0, -0.1], [40, H * 0.76, 9, 15, 1, 0.12], [8, H * 0.7, 7, 11, 2, -0.05], [52, H * 0.66, 6, 9, 0, 0.18], [30, H * 0.64, 5, 7, 3, 0], [64, H * 0.84, 7, 11, 2, 0.08]];
  const Rr = [[W - 20, H * 0.95, 13, 28, 4, 0.06], [W - 44, H * 0.78, 9, 15, 0, 0.16], [W - 9, H * 0.7, 8, 12, 2, -0.12], [W - 58, H * 0.66, 6, 9, 1, -0.1], [W - 30, H * 0.63, 5, 7, 0, 0], [W - 66, H * 0.86, 7, 10, 0, -0.2]];
  for (const [x, by, w] of [...L, ...Rr]) R.ellipse(x, by, w * 0.9, 2.5, "#1c1b16");
  for (const [x, by, w, h, k, t] of [...L, ...Rr]) tomb(R, x, by, w, h, k, "#4a4c56", t, "#7a86a4");
  tufts(R, 9, 120, 0, W, H * 0.62, H, "#22261a");
  fogBand(R, H * 0.9, 18, "#3a4256", 0.22, 17);
  A.fog("#a6b2c6", 0.62, 5, 0.12, 6, 110, 10);
  A.fog("#a6b2c6", 0.86, 4, 0.1, -4, 120, 12);
  A.part({ n: 6, col: "#bff0e4", x0: 0.04, x1: 0.96, y0: 0.4, y1: 0.78, sway: 14, swf: 0.25, bob: 6, bobf: 0.5, a: 0.55, blink: 0.4, halo: 0.2, sz: 2 });
}

// 層 2 地下水路: 煉瓦のアーチ、奥へ続く下水路、錆びた配管、手前の水路の映り込み、滴る水
function sWaterway(R, A) {
  const { w: W, h: H } = R, gy = Math.round(H * 0.57), wy = Math.round(H * 0.84), cx = W / 2;
  R.amb = [0.62, 0.72, 0.76];
  bricks(R, 0, 0, W, gy, "#2c3537", "#111819", 8, 4, 2);
  R.m = SURF; // 苔と水垢の筋
  for (let i = 0; i < 40; i++) { const x = hash(i, 1, 4) * W, y = hash(i, 2, 4) * gy * 0.7, l = 6 + hash(i, 3, 4) * 26; R.rect(x, y, 1 + (i % 2), l, i % 3 ? "#1e2c24" : "#16201e", 0.55); }
  const aw = Math.round(W * 0.19), at = Math.round(H * 0.17);
  archFrame(R, cx, at, aw, gy, 6, tex("#3c4648", "#2c3436", 0.3, 3), null, 0, 13, "#151c1d");
  R.m = SKY; R.poly(archPts(cx, at, aw, gy), (x, y) => mix(C("#0c1416"), C("#020405"), clamp01(1 - Math.abs(x - cx) / aw) * 0.9 + (y - at) / H * 0.1));
  for (let k = 1; k <= 3; k++) { // 奥へ連なるアーチ
    const s = 1 - k * 0.22; R.m = SKY;
    R.poly(archPts(cx, at + k * 9, aw * s + 2, gy - k * 2), mul(C("#101a1c"), 1 - k * 0.2));
    R.poly(archPts(cx, at + k * 9 + 2, aw * s, gy - k * 2), mul(C("#030607"), 1));
  }
  R.m = SKY; R.rect(cx - aw * 0.5, gy - 8, aw, 6, "#0a1a1e"); R.rect(cx - aw * 0.4, gy - 6, aw * 0.8, 1, "#1d3a40", 0.5); // 奥の水面
  for (const sx of [-1, 1]) { // 左右の小アーチ (画面外へ切れる)
    const ax = cx + sx * W * 0.5; archFrame(R, ax, H * 0.3, W * 0.12, gy, 5, "#384244", { c: "#040708", sky: true }, 0, 9, "#151c1d");
  }
  // 錆びた配管
  const pc = tex("#4a3626", "#2a1e16", 0.4, 6);
  R.m = SURF;
  R.rect(0, H * 0.24, W * 0.2, 5, pc); R.rect(W * 0.2 - 5, H * 0.24, 5, gy - H * 0.24, pc);
  R.rect(0, H * 0.24, W * 0.2, 1, "#6a5038"); R.rect(W * 0.2 - 5, H * 0.24, 1, gy - H * 0.24, "#5a4430");
  for (const y of [H * 0.24, H * 0.4]) R.rect(W * 0.2 - 6, y + (y > H * 0.3 ? 0 : 5), 7, 2, "#5a4632");
  R.rect(W * 0.86, 0, 4, gy, pc); R.rect(W * 0.92, 0, 6, gy, pc); R.rect(W * 0.86, 0, 1, gy, "#5a4430"); R.rect(W * 0.92, 0, 1, gy, "#6a5038");
  R.ellipse(W * 0.95, H * 0.36, 5, 5, "#3a2a1e"); R.ellipse(W * 0.95, H * 0.36, 3, 3, "#1a120c"); R.rect(W * 0.95 - 5, H * 0.36, 10, 1, "#5a4430");
  // 壁灯 (檻入りの緑がかった灯)
  for (const lx of [cx - aw - 18, cx + aw + 18]) {
    R.m = SURF; R.rect(lx - 1, H * 0.3, 3, 2, "#2a2a26"); R.rect(lx - 3, H * 0.32, 7, 8, "#14181a");
    R.m = SKY; R.rect(lx - 2, H * 0.33, 5, 6, "#9fe0c4"); R.rect(lx - 1, H * 0.34, 3, 4, "#e4fff0");
    R.m = SURF; R.rect(lx, H * 0.32, 1, 8, "#14181a");
    R.glow(lx, H * 0.36, 18, 18, "#3a8070", 0.35); R.light(lx, H * 0.37, 46, "#7fd0b0", 0.75, 40);
    A.flick(lx, H * 0.36, 12, "#7fd0b0", 0.25, 0.6);
  }
  // 床: 石畳の歩廊
  R.m = SURF; R.rect(0, gy - 2, W, 3, "#3a4446"); R.rect(0, gy - 2, W, 1, "#4e5a5c");
  ground(R, gy + 1, "#1d2426", "#121819", 12, 0.12, 0.2);
  perspGrid(R, gy + 1, cx, gy - 30, "#0c1112", 0.7, 8, 4, wy);
  R.m = SURF; R.rect(0, gy - 8, W, 6, (x, y) => (fbm(x * 0.12, y * 0.4, 5) > 0.5 - (y - gy + 8) * 0.05 ? C("#1e3428") : null), 0.8); // 壁際の苔
  for (const [x, y, w] of [[W * 0.1, H * 0.7, 18], [W * 0.88, H * 0.74, 22], [W * 0.3, H * 0.79, 12]]) { R.ellipse(x, y, w, 2.5, "#0c1618"); R.rect(x - w * 0.5, y - 1, w * 0.6, 1, "#3a6a70", 0.5); }
  // 水路の縁と水面 (合成後に上の景色を揺らして映す)
  R.rect(0, wy - 1, W, 3, "#384244"); R.rect(0, wy - 1, W, 1, "#56625e");
  R.m = SKY; R.rect(0, wy + 2, W, H - wy - 2, "#071214");
  R.post.push((out, w, h) => {
    for (let y = wy + 2; y < h; y++) {
      const src = Math.round(wy - 2 - (y - wy) * 3.2);
      for (let x = 0; x < w; x++) {
        const sx = Math.min(w - 1, Math.max(0, x + Math.round(Math.sin(y * 1.3 + x * 0.05) * 1.5)));
        const i = (y * w + x) * 3, j = (Math.max(0, src) * w + sx) * 3, k = 0.6 * (1 - ((y - wy) / (h - wy)) * 0.5);
        const sh = Math.sin(x * 0.21 + y * 2.7) * Math.sin(x * 0.05 - y * 0.6) > 0.82 ? 16 : 0; // きらめく波頭
        for (let c = 0; c < 3; c++) out[i + c] = out[i + c] * (1 - k) + out[j + c] * k * 0.9 + (c === 0 ? 2 : c === 1 ? 6 : 8) + sh * (c === 0 ? 0.4 : c === 1 ? 0.8 : 1);
      }
    }
  });
  A.part({ n: 5, col: "#8fd0d8", x0: 0.02, x1: 0.26, y0: 0.18, y1: 0.84, vy: 0.55, a: 0.5, sz: 2, len: 2 });
  A.part({ n: 5, col: "#8fd0d8", x0: 0.74, x1: 0.98, y0: 0.12, y1: 0.84, vy: 0.6, a: 0.5, sz: 2, len: 2, seed: 9 });
  A.special = ripples(0.88, 0.99, "#9fe0e8", 6);
}
function ripples(y0, y1, col, n) { // 水面の波紋 (広がって消える楕円の破線)
  return (ctx, w, h, t) => {
    ctx.fillStyle = col;
    for (let i = 0; i < n; i++) {
      const per = 2600 + hash(i, 5, 2) * 1800, ph = (t / per + hash(i, 6, 2)) % 1, cyc = Math.floor(t / per + hash(i, 6, 2));
      const x = (0.05 + 0.9 * hash(i, cyc, 3)) * w, y = (y0 + (y1 - y0) * hash(i, cyc, 4)) * h;
      const rx = 3 + ph * 22, ry = rx * 0.28; ctx.globalAlpha = 0.32 * (1 - ph);
      const sx = (v) => Math.round(v / 2) * 2;
      ctx.fillRect(sx(x - rx), sx(y), 4, 2); ctx.fillRect(sx(x + rx) - 2, sx(y), 4, 2);
      ctx.fillRect(sx(x - rx * 0.5), sx(y - ry), Math.max(2, sx(rx)), 2); ctx.fillRect(sx(x - rx * 0.5), sx(y + ry), Math.max(2, sx(rx)), 2);
    }
  };
}

// 層 3 廃坑: 坑木の枠が奥へ連なる坑道、レール、トロッコ、吊りランタンと鉱石のきらめき
function sMine(R, A) {
  const { w: W, h: H } = R, gy = Math.round(H * 0.58), cx = W / 2;
  R.amb = [0.4, 0.36, 0.34];
  R.m = SURF; R.rect(0, 0, W, H, (x, y) => {
    const n = fbm(x * 0.06, y * 0.16 + Math.sin(x * 0.03) * 0.6, 3), st = Math.sin(y * 0.55 + Math.sin(x * 0.04) * 3 + vnoise(x * 0.05, y * 0.05, 4) * 4);
    const c = mix(C("#2a2119"), C("#6a5640"), clamp01(n * 1.5 - 0.25));
    return st > 0.93 ? mul(c, 1.22) : st < -0.96 ? mul(c, 0.55) : c;
  });
  // 坑道の奥 (中央の闇の穴)
  const hole = []; for (let i = 0; i <= 20; i++) { const a = Math.PI + (Math.PI * i) / 20; hole.push([cx + Math.cos(a) * W * 0.17 * (0.92 + 0.12 * hash(i, 1, 2)), gy + Math.sin(a) * H * 0.36 * (0.9 + 0.12 * hash(i, 2, 2))]); }
  R.m = SKY; R.poly(hole, (x, y) => mix(C("#0e0a07"), C("#020101"), clamp01(1 - Math.abs(x - cx) / (W * 0.16)) * 0.8 + 0.2 * clamp01((y - gy * 0.4) / gy)));
  const wood = (dim) => (x, y) => mul(mix(C("#5a3e22"), C("#3a2614"), vnoise(x * 0.8, y * 0.06, 4)), dim);
  const frame = (x0, x1, top, bot, th, dim) => {
    R.m = SURF;
    R.rect(x0, top, th, bot - top, wood(dim)); R.rect(x1 - th, top, th, bot - top, wood(dim));
    R.rect(x0 - th * 0.4, top - th, x1 - x0 + th * 0.8, th, wood(dim * 1.05));
    R.rect(x0 - th * 0.4, top - th, x1 - x0 + th * 0.8, 1, mul(C("#8a6a40"), dim)); R.rect(x0, top, 1, bot - top, mul(C("#7a5a36"), dim));
    R.taper(x0 + th, top + th * 2.5, x0 + th * 3, top, th * 0.7, th * 0.7, wood(dim * 0.85));
    R.taper(x1 - th, top + th * 2.5, x1 - th * 3, top, th * 0.7, th * 0.7, wood(dim * 0.85));
  };
  frame(cx - W * 0.1, cx + W * 0.1, H * 0.33, gy - 3, 2, 0.35);
  frame(cx - W * 0.16, cx + W * 0.16, H * 0.26, gy, 3, 0.55);
  // 床: 砂利とレール
  ground(R, gy, "#2c241b", "#15110c", 5, 0.2, 0.4);
  R.m = SURF;
  for (let k = 0; k < 9; k++) { // 枕木
    const t = Math.pow(k / 8, 1.6), y = gy + 2 + (H - gy) * t, hw = W * (0.035 + 0.2 * t);
    R.rect(cx - hw, y, hw * 2, 1 + t * 3, mul(C("#3a2a1a"), 0.5 + t * 0.4));
  }
  for (const s of [-1, 1]) { R.line(cx + s * 3, gy + 1, cx + s * W * 0.17, H, "#4a4440", 1, 2); R.line(cx + s * 3, gy + 1, cx + s * W * 0.17, H - 1, "#8a7a68", 0.6, 1); }
  // 手前の大きな坑木の枠
  frame(W * 0.02, W * 0.98, H * 0.1, H, 9, 1);
  // 鉱石のきらめき (縁の岩肌)
  const r = rnd(33);
  for (let i = 0; i < 46; i++) {
    const x = r() * W, y = r() * gy; if (x > W * 0.2 && x < W * 0.8 && y > H * 0.12) continue;
    const c = i % 3 ? "#e8c060" : "#70d8c8"; R.m = SKY; R.px(x, y, c, 0.9); R.px(x + 1, y, c, 0.35); R.px(x, y + 1, c, 0.3);
  }
  // ランタン (左の柱に吊り下げ) + 奥の消えかけた灯
  const lx = Math.round(W * 0.115), ly = Math.round(H * 0.34);
  R.m = SURF; R.rect(lx - 6, ly - 8, 7, 1, "#2a2420"); R.rect(lx, ly - 8, 1, 3, "#2a2420");
  R.rect(lx - 2, ly - 5, 5, 1, "#3a3028"); R.rect(lx - 2, ly + 3, 5, 2, "#3a3028");
  R.m = SKY; R.rect(lx - 2, ly - 4, 5, 7, "#ffb050"); R.rect(lx - 1, ly - 3, 3, 4, "#fff0b0");
  R.m = SURF; R.rect(lx, ly - 4, 1, 7, "#2a2018");
  R.glow(lx, ly, 26, 26, "#a05a20", 0.45); R.light(lx + 4, ly + 6, 80, "#ffa050", 1.3, 72);
  A.flick(lx, ly, 18, "#ffa050", 0.35, 1.3);
  const lx2 = Math.round(W * 0.885), ly2 = Math.round(H * 0.3);
  R.m = SURF; R.rect(lx2, ly2 - 8, 6, 1, "#2a2420"); R.rect(lx2, ly2 - 8, 1, 3, "#2a2420"); R.rect(lx2 - 2, ly2 - 5, 5, 1, "#3a3028"); R.rect(lx2 - 2, ly2 + 3, 5, 2, "#3a3028");
  R.m = SKY; R.rect(lx2 - 2, ly2 - 4, 5, 7, "#ffa848"); R.rect(lx2 - 1, ly2 - 3, 3, 4, "#ffe8a8");
  R.m = SURF; R.rect(lx2, ly2 - 4, 1, 7, "#2a2018");
  R.glow(lx2, ly2, 24, 24, "#a05a20", 0.4); R.light(lx2 - 4, ly2 + 20, 76, "#ff9a48", 1.15, 80);
  A.flick(lx2, ly2, 16, "#ffa050", 0.32, 1.1);
  R.m = SKY; R.rect(cx + 9, H * 0.4, 2, 2, "#c07030"); R.glow(cx + 10, H * 0.41, 9, 9, "#6a3010", 0.4); R.light(cx + 10, H * 0.42, 22, "#ff9040", 0.5);
  A.flick(cx + 10, H * 0.41, 7, "#ff9040", 0.3, 0.8);
  // トロッコ (右下) と樽・つるはし (左下)
  const tx = W * 0.86, ty = H * 0.86; R.m = SURF;
  R.poly([[tx - 26, ty - 20], [tx + 26, ty - 20], [tx + 21, ty], [tx - 21, ty]], tex("#4a4440", "#2a2624", 0.3, 8));
  R.rect(tx - 26, ty - 20, 52, 2, "#8a7e70"); R.rect(tx - 20, ty - 12, 40, 1, "#2a2420"); R.line(tx - 26, ty - 19, tx - 21, ty, "#7a6e60");
  for (const rx of [tx - 16, tx, tx + 16]) { R.rect(rx, ty - 18, 2, 17, "#2e2a26"); R.px(rx, ty - 15, "#9a8e7e"); R.px(rx, ty - 5, "#9a8e7e"); }
  for (let i = 0; i < 8; i++) R.ellipse(tx - 18 + i * 5, ty - 21 - (i % 3), 3.5, 2.5, i % 3 ? "#3a3430" : "#5a4a38");
  R.m = SKY; R.px(tx - 6, ty - 23, "#e8c060"); R.px(tx + 9, ty - 22, "#e8c060", 0.7); R.m = SURF;
  for (const wx of [tx - 14, tx + 14]) { R.ellipse(wx, ty + 2, 5, 5, "#1a1816"); R.ellipse(wx, ty + 2, 2, 2, "#4a4440"); }
  R.ellipse(W * 0.16, H * 0.93, 9, 3, "#120e0a"); R.rect(W * 0.1, H * 0.76, 13, 15, tex("#4a3420", "#2e2012", 0.5, 2)); R.rect(W * 0.1, H * 0.79, 13, 1, "#2a2a2a"); R.rect(W * 0.1, H * 0.87, 13, 1, "#2a2a2a");
  R.line(W * 0.2, H * 0.98, W * 0.25, H * 0.7, "#4a3420", 1, 2); R.poly([[W * 0.22, H * 0.72], [W * 0.28, H * 0.69], [W * 0.27, H * 0.71]], "#6a6a70");
  A.part({ n: 22, col: "#d8b080", x0: 0.03, x1: 0.35, y0: 0.15, y1: 0.75, vy: 0.012, sway: 6, swf: 0.3, a: 0.4, tw: 1.2 });
  A.part({ n: 14, col: "#a89070", x0: 0.3, x1: 0.95, y0: 0.15, y1: 0.7, vy: 0.008, sway: 5, swf: 0.2, a: 0.2, tw: 0.8, seed: 4 });
}

// 層 4 捨て砦: 崩れた城壁と胸壁、壊れた落とし格子、裂けた軍旗、塔の松明と舞う火の粉
function sFort(R, A) {
  const { w: W, h: H } = R, gy = Math.round(H * 0.57), cx = W / 2;
  R.amb = [0.55, 0.57, 0.66];
  R.m = SKY; R.vgrad(0, 0, W, gy, [[0, "#05060b"], [0.6, "#121522"], [1, "#1e2130"]]);
  stars(R, 41, 40, gy * 0.5, "#9aa2bc");
  R.glow(W * 0.24, H * 0.1, 40, 30, "#3a4258", 0.5); moon(R, W * 0.24, H * 0.1, 6, "#c8d0dc", "#7a8496");
  clouds(R, 14, 0, gy * 0.6, "#0b0d16", 0.57, "#363c50");
  const stone = tex("#3a3c46", "#24262e", 0.12, 4);
  // 城壁 + 胸壁 (所々欠けている)
  const wt = Math.round(H * 0.34);
  bricks(R, 0, wt, W, gy, "#2c2e36", "#141519", 12, 5, 7);
  for (let x = 0, k = 0; x < W; x += 14, k++) { if (k === 4 || k === 12 || k === 13) continue; R.m = SURF; R.rect(x, wt - 6, 8, 6, stone); R.rect(x, wt - 6, 8, 1, "#4a4c58"); }
  R.m = SKY; R.poly([[W * 0.66, wt - 1], [W * 0.7, wt + 5], [W * 0.73, wt + 2], [W * 0.76, wt + 9], [W * 0.8, wt - 1]], "#1a1d2a"); // 崩れた欠け
  // 門楼と落とし格子
  const gx0 = cx - W * 0.13, gx1 = cx + W * 0.13, gt = Math.round(H * 0.2);
  bricks(R, gx0, gt, gx1, gy, "#30323a", "#141519", 10, 5, 9);
  for (let x = gx0; x < gx1 - 4; x += 10) { R.m = SURF; R.rect(x, gt - 5, 6, 5, stone); }
  R.m = SKY; R.poly(archPts(cx, H * 0.33, W * 0.075, gy), (x, y) => mix(C("#07080c"), C("#020203"), clamp01((y - H * 0.33) / (gy - H * 0.33))));
  R.m = SURF; const pg = C("#1e1c1c");
  for (let x = cx - W * 0.07; x <= cx + W * 0.07; x += 4) { const bot = gy - 10 - hash(x | 0, 1, 1) * 18; R.rect(x, H * 0.33, 1, bot - H * 0.33, pg); R.px(x, bot, "#2a2826"); }
  for (let y = H * 0.36; y < gy - 18; y += 5) R.rect(cx - W * 0.072, y, W * 0.144, 1, pg);
  R.line(cx + W * 0.03, gy - 22, cx + W * 0.05, gy - 4, pg); // 曲がった格子
  // 左右の円塔 (上端は崩れ、矢狭間)
  for (const s of [-1, 1]) {
    const tx0 = s < 0 ? -4 : W * 0.83, tw = W * 0.17 + 4, tt = H * 0.06;
    const cyl = (x, y) => { const u = (x - tx0) / tw; return mul(stone(x, y), 0.55 + 0.7 * Math.sin(Math.PI * clamp01(u * 0.9 + 0.05))); };
    const top = []; for (let i = 0; i <= 8; i++) top.push([tx0 + (tw * i) / 8, tt + hash(i, s + 3, 6) * 10]);
    R.m = SURF; R.poly([...top, [tx0 + tw, gy + 6], [tx0, gy + 6]], cyl);
    R.rect(tx0, H * 0.32, tw, 2, mul(C("#4a4c58"), 0.9)); R.rect(tx0, H * 0.34, tw, 1, "#141519");
    for (const yy of [H * 0.2, H * 0.48]) R.rect(tx0 + tw * 0.5, yy, 2, 8, "#050507");
  }
  // 裂けた軍旗
  banner(R, W * 0.25 - 6, wt - 2, 12, 30, "#4e1a1c", 3, "#8a7040");
  banner(R, W * 0.75 - 6, wt - 2, 12, 26, "#4e1a1c", 8, "#8a7040");
  R.m = SURF; for (const bx of [W * 0.25, W * 0.75]) { R.rect(bx - 2, wt + 9, 4, 4, "#8a7a50", 0.5); }
  // 塔の松明
  for (const tx of [W * 0.13, W * 0.87]) {
    const ty = Math.round(H * 0.44); R.m = SURF; R.rect(tx - 1, ty, 3, 6, "#2a2018"); R.rect(tx - 2, ty, 5, 1, "#3a3028");
    flame(R, A, tx, ty, 2.4, "#fff0a0", "#ff8a30", true, 70, 1.2);
  }
  // 中庭: 踏み固めた土と石畳、左右の瓦礫
  ground(R, gy, "#22211f", "#0f0e0d", 12, 0.14, 0.35);
  R.m = SURF; R.rect(0, gy, W, 1, "#34343a");
  rubble(R, 4, 14, 0, W * 0.2, H * 0.68, H * 0.98, "#3a3a42");
  rubble(R, 7, 14, W * 0.8, W, H * 0.68, H * 0.98, "#3a3a42");
  R.line(W * 0.78, H * 0.97, W * 0.92, H * 0.76, "#3a2a1a", 1, 2); R.ellipse(W * 0.2, H * 0.92, 6, 4, "#3a3634"); R.ellipse(W * 0.2, H * 0.92, 3, 2, "#5a2020");
  A.part({ n: 14, col: "#ffa040", x0: 0.06, x1: 0.22, y0: 0.05, y1: 0.45, vy: -0.05, sway: 8, swf: 0.6, a: 0.7, tw: 3 });
  A.part({ n: 14, col: "#ffa040", x0: 0.78, x1: 0.94, y0: 0.05, y1: 0.45, vy: -0.05, sway: 8, swf: 0.6, a: 0.7, tw: 3, seed: 5 });
  A.part({ n: 18, col: "#8a8a90", x0: 0, x1: 1, y0: 0.05, y1: 0.85, vy: 0.012, vx: 0.01, sway: 10, swf: 0.2, a: 0.22, seed: 8 });
}

// 層 5 霧の森: 霧に溶ける幾重もの幹、張り出した根、光るキノコ、蛍
function sForest(R, A) {
  const { w: W, h: H } = R, gy = Math.round(H * 0.58);
  R.amb = [0.68, 0.78, 0.66];
  R.m = SKY; R.vgrad(0, 0, W, gy + 4, [[0, "#0a100b"], [0.45, "#1a261e"], [1, "#3a4a3e"]]);
  // 遠い幹 (霧で淡い)
  const r = rnd(55);
  for (let i = 0; i < 22; i++) { const x = r() * W, w = 2 + r() * 3; R.m = SKY; R.rect(x, 0, w, gy + 2, mix(C("#2a382e"), C("#3a4a3e"), r()), 0.85); }
  fogBand(R, gy - 6, 26, "#4a5a4c", 0.45, 9);
  for (let i = 0; i < 12; i++) { // 中景の幹
    let x = r() * W; if (Math.abs(x - W / 2) < W * 0.1) x += W * 0.2 * (x < W / 2 ? -1 : 1);
    const w = 4 + r() * 5; R.m = SKY; R.rect(x, 0, w, gy + 4, (px, py) => mul(C("#18221a"), 0.85 + 0.3 * vnoise(px * 0.8, py * 0.05, i)));
    R.poly([[x - 3, gy + 5], [x, gy - 4], [x + w, gy - 4], [x + w + 3, gy + 5]], "#18221a");
  }
  fogBand(R, gy + 2, 14, "#3e4c40", 0.35, 12);
  // 木漏れ日の筋 (樹冠の隙間から斜めに)
  R.m = ADD;
  for (const [x, wd, k] of [[W * 0.3, 7, 0.07], [W * 0.46, 4, 0.05], [W * 0.62, 9, 0.06], [W * 0.72, 4, 0.05]]) {
    for (let y = 0; y < gy; y++) { const xo = x - y * 0.3, f = k * (1 - y / gy); R.span(y, xo, xo + wd, (px) => mul(C("#a8c8a0"), Math.floor(f * 30 + bayer(px, y)) / 30), 1); }
  }
  // 樹冠 (上辺を覆う葉叢の塊) と垂れるつる
  R.m = SURF;
  for (let y = 0; y < H * 0.34; y++) for (let x = 0; x < W; x++) {
    const d = fbm(x * 0.07, y * 0.09, 71) + (1 - y / (H * 0.3)) * 0.55 - 0.62 + (Math.abs(x - W / 2) / W) * 0.25;
    if (d <= 0) continue;
    const a = Math.min(1, Math.floor(d * 10 + bayer(x, y)) / 2);
    if (a <= 0) continue;
    const hl = vnoise(x * 0.25, y * 0.25, 5) > 0.66 && d < 0.2;
    R._b((y * W + x) * 3, hl ? C("#2a3c22") : C("#0c140b"), a);
  }
  R.m = SURF; for (let i = 0; i < 24; i++) { const x = r() * W, l = 6 + r() * 30; R.line(x, 0, x + (r() - 0.5) * 4, l, "#0e160e", 0.9); }
  ground(R, gy, "#1a2414", "#0b1008", 5, 0.12, 0.4);
  // 手前の巨木 (左右)。樹皮の縦筋と根
  for (const [x0, w, s] of [[-6, W * 0.15, -1], [W * 0.87, W * 0.15, 1]]) {
    const bark = (px, py) => {
      const u = (px - x0) / w, inner = s < 0 ? u : 1 - u, ridge = Math.sin(px * 1.1 + vnoise(px * 0.15, py * 0.03, 3) * 7);
      let c = C(inner > 0.88 ? "#46543a" : "#2e2e22");
      if (ridge > 0.6) c = mul(c, 0.5); else if (ridge < -0.75) c = mul(c, 1.25);
      if (inner > 0.6 && vnoise(px * 0.3, py * 0.08, 8) > 0.62) c = mix(c, C("#3e5e2c"), 0.6); // 苔
      return mul(c, (0.8 + 0.3 * vnoise(px * 0.9, py * 0.04, 3)) * (0.5 + 0.65 * inner));
    };
    R.m = SURF; R.poly([[x0, 0], [x0 + w, 0], [x0 + w * (s < 0 ? 1.1 : 0.9), H * 0.7], [x0 + w + (s < 0 ? 18 : -2), H], [x0 - (s < 0 ? 4 : 16), H]], bark);
    for (let k = 0; k < 4; k++) { const rx = s < 0 ? x0 + w : x0, ry = H * (0.72 + k * 0.07); R.taper(rx, ry, rx - s * (16 + k * 9), H * (0.8 + k * 0.05), 5 - k, 1, "#16140f"); }
    R.ellipse(s < 0 ? x0 + w * 0.55 : x0 + w * 0.45, H * 0.35, 3, 5, "#060504"); // 洞
  }
  R.m = SURF; for (let k = 0; k < 3; k++) R.taper(W * 0.15, H * (0.88 + k * 0.04), W * (0.35 + k * 0.08), H * (0.96 + k * 0.02), 3, 1, "#14120d");
  // 光るキノコ (根元)
  for (const [x, y, n, sd] of [[W * 0.17, H * 0.84, 4, 1], [W * 0.82, H * 0.8, 5, 2], [W * 0.08, H * 0.97, 3, 3], [W * 0.93, H * 0.95, 3, 4]]) {
    const q = rnd(sd);
    for (let i = 0; i < n; i++) {
      const mx = x + (q() - 0.5) * 12, my = y + (q() - 0.5) * 4, s = 1 + q() * 2;
      const sx = Math.round(mx), top = Math.round(my - s * 2);
      R.m = SURF; R.rect(sx, top, 1, Math.round(s * 2), "#7a8a70");
      R.m = SKY; R.rect(sx - Math.round(s), top - 1, Math.round(s) * 2 + 1, 1, "#6aa050"); R.rect(sx - Math.round(s) + 1, top - 2, Math.round(s) * 2 - 1, 1, "#a8e070"); R.px(sx - Math.round(s) + 1, top - 2, "#e8ffc0");
      R.glow(sx, top, 7, 5, "#4a8a30", 0.18, 4);
    }
    R.light(x, y - 2, 30, "#9ad070", 0.6, 20);
  }
  tufts(R, 3, 70, 0, W, H * 0.62, H, "#22301a");
  R.m = SURF; for (const [fx, fy, s] of [[W * 0.03, H, -1], [W * 0.97, H, 1], [W * 0.22, H, -1]]) for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + s * (i - 3) * 0.28; R.line(fx, fy, fx + Math.cos(a) * 16, fy + Math.sin(a) * 18, "#1e3018"); }
  fogBand(R, H * 0.84, 20, "#3a4a3c", 0.25, 21);
  A.fog("#b0c4b0", 0.58, 5, 0.13, 5, 120, 12);
  A.fog("#b0c4b0", 0.8, 4, 0.1, -3, 120, 14);
  A.part({ n: 16, col: "#e8f070", x0: 0.02, x1: 0.98, y0: 0.25, y1: 0.85, sway: 18, swf: 0.18, bob: 8, bobf: 0.3, a: 0.85, blink: 0.9, halo: 0.25 });
}

// 層 6 沈没神殿: 水底に沈んだ列柱と神殿の影、天から差す光の柱、海藻、立ちのぼる泡
function sTemple(R, A) {
  const { w: W, h: H } = R, gy = Math.round(H * 0.6), cx = W / 2;
  R.amb = [0.55, 0.75, 0.82];
  R.m = SKY; R.vgrad(0, 0, W, H, [[0, "#174250"], [0.35, "#0b2632"], [0.7, "#05151e"], [1, "#030c12"]]);
  for (let x = 0; x < W; x++) { const y = 2 + Math.round(Math.sin(x * 0.18) * 1.2 + Math.sin(x * 0.07) * 1); R.px(x, y, "#5ab0c0", 0.5); } // 水面のゆらぎ
  // 遠景の神殿 (破風と列柱の影)
  const fc = C("#0e2a34"), ft = Math.round(H * 0.22); R.m = SKY;
  R.poly([[cx - W * 0.2, ft + 8], [cx, ft - 4], [cx + W * 0.2, ft + 8]], fc); R.rect(cx - W * 0.2, ft + 8, W * 0.4, 4, fc);
  for (let i = 0; i < 7; i++) { if (i === 5) continue; R.rect(cx - W * 0.18 + i * W * 0.058, ft + 12, 5, gy - ft - 12, mul(fc, 1 - (i % 2) * 0.1)); }
  R.rect(cx - W * 0.21, gy - 4, W * 0.42, 4, fc); R.rect(cx - 4, ft + 20, 8, gy - ft - 24, "#081a22");
  // 光の柱 (斜めに差し込む)
  R.m = ADD;
  for (const [x, wd, k] of [[W * 0.12, 16, 0.1], [W * 0.38, 10, 0.07], [W * 0.62, 22, 0.08], [W * 0.84, 12, 0.1]]) {
    for (let y = 0; y < H * 0.9; y++) { const fade = 1 - y / (H * 0.9), xo = x + y * 0.35; R.span(y, xo, xo + wd, (px) => mul(C("#5ac8d8"), Math.floor((k * fade * (0.7 + 0.6 * vnoise(px * 0.2, y * 0.03, 4))) * 24 + bayer(px, y)) / 24), 1); }
  }
  // 砂の床 (風紋)
  R.m = SURF; ground(R, gy, "#24383a", "#0e1a1c", 8, 0.1, 0.25);
  R.m = SURF; for (let y = gy + 2; y < H; y += 3) R.span(y, 0, W, (x) => (Math.sin(x * 0.12 + y * 0.9) > 0.6 ? mul(C("#30484a"), 0.9) : null), 0.5);
  // 柱 (左: 完全 / 折れ, 右: 傾いた折れ柱)
  column(R, W * 0.03, H * 0.1, gy + 6, 13, "#3a5a60", { cap: true, base: true, flute: true });
  column(R, W * 0.2, H * 0.36, gy + 4, 9, "#34525a", { broken: 4, base: true, flute: true });
  R.m = SURF; const tc = (x, y) => mul(C("#3a5a60"), 0.75 + 0.35 * vnoise(x * 0.4, y * 0.4, 2));
  R.poly([[W * 0.84, gy + 6], [W * 0.9, H * 0.14], [W * 0.96, H * 0.16], [W * 0.92, H * 0.2], [W * 0.95, H * 0.24], [W * 0.92, gy + 6]], tc);
  R.line(W * 0.88, H * 0.3, W * 0.86, gy, "#506e74", 0.5);
  R.ellipse(W * 0.74, H * 0.9, 12, 5, "#2a4248"); R.ellipse(W * 0.74, H * 0.88, 12, 4, "#3a565c"); R.ellipse(W * 0.74, H * 0.88, 8, 2.5, "#2e464c");
  R.ellipse(W * 0.33, H * 0.93, 7, 4, "#2e464c"); // 落ちた石の頭 (像)
  R.ellipse(W * 0.12, H * 0.94, 10, 5, "#30484c"); R.rect(W * 0.12 - 2, H * 0.9, 4, 2, "#1a2a2e");
  // 海藻
  const kelp = (x, n, sd) => { const q = rnd(sd); for (let i = 0; i < n; i++) { const kx = x + (q() - 0.5) * 18, h = H * (0.25 + q() * 0.3), ph = q() * 6; for (let y = 0; y < h; y++) { const yy = H - y, xx = kx + Math.sin(y * 0.12 + ph) * (1 + y * 0.04); R.rect(xx, yy, 2, 1, mix(C("#123826"), C("#2a6a44"), y / h)); } } };
  R.m = SURF; kelp(W * 0.06, 4, 3); kelp(W * 0.95, 5, 4); kelp(W * 0.28, 2, 7);
  // 揺らぐ網目の光 (コースティクス)
  A.pulse((P) => {
    P.m = ADD;
    for (let y = 0; y < P.h; y++) for (let x = 0; x < P.w; x++) {
      const cm = 1 - 0.75 * (1 - sstep(0.18, 0.36, Math.abs(x / P.w - 0.5))) * (1 - sstep(0.15, 0.4, Math.abs(y / P.h - 0.45)));
      const fl = (y > gy ? 0.8 : 0.3) * cm, n = Math.abs(Math.sin(x * 0.21 + vnoise(x * 0.05, y * 0.08, 3) * 6) + Math.sin(y * 0.33 + x * 0.05 + vnoise(x * 0.07, y * 0.05, 5) * 5));
      if (n < 0.28) P._b((y * P.w + x) * 3, C("#3a8090"), 0.5 * fl * (1 - n / 0.28));
    }
  }, (t) => 0.3 + 0.2 * Math.sin(t * 0.0011));
  A.part({ n: 22, col: "#9ae0f0", x0: 0.02, x1: 0.98, y0: 0.05, y1: 0.95, vy: -0.05, sway: 4, swf: 1.4, a: 0.45, big: 0.25, ring: true });
  A.part({ n: 16, col: "#c8f0ff", x0: 0, x1: 1, y0: 0, y1: 0.9, vy: 0.004, sway: 6, swf: 0.2, a: 0.18, tw: 0.8, seed: 6 });
}

// 層 7 灼熱の洞: 溶岩の河と溶岩滝、柱状玄武岩、赤く照らされたつらら石、昇る火の粉
function sLava(R, A) {
  const { w: W, h: H } = R, gy = Math.round(H * 0.58), cx = W / 2;
  R.amb = [0.42, 0.3, 0.27];
  R.m = SURF; R.rect(0, 0, W, gy, (x, y) => { const n = fbm(x * 0.05, y * 0.09, 7); return mix(C("#2e1e18"), C("#5a3e32"), clamp01(n * 1.6 - 0.3)); });
  // 溶岩滝と川 (自発光)
  const lava = (x, y, k = 1) => { const n = fbm(x * 0.12, y * 0.05 - x * 0.02, 11); return mul(mix(C("#a02808"), C("#ffb840"), clamp01((n - 0.3) * 2.2)), k); };
  for (const [fx, fw, sd] of [[W * 0.2, 7, 1], [W * 0.8, 6, 2]]) { // 岩棚から溢れ落ちる溶岩滝
    const top = Math.round(H * 0.17), pts = [];
    for (let y = top; y <= gy - 6; y += 2) { const t = (y - top) / (gy - 6 - top); pts.push([fx - fw * (0.55 + 0.45 * t) / 2 * 2 + Math.sin(y * 0.35 + sd) * 0.9, y]); }
    for (let y = gy - 6; y >= top; y -= 2) { const t = (y - top) / (gy - 6 - top); pts.push([fx + fw * (0.55 + 0.45 * t) / 2 * 2 + Math.sin(y * 0.3 + sd * 2) * 0.9, y]); }
    R.m = SKY; R.poly(pts, (x, y) => { const v = vnoise(x * 0.9, y * 0.06 - x * 0.2, 11 + sd), e = Math.abs(x + 0.5 - fx) / fw; return mix(C("#7a1a04"), C("#ffb040"), clamp01(v * 1.3 - 0.25 + (e < 0.25 ? 0.25 : 0) - e * 0.5)); });
    R.m = SURF; R.poly([[fx - fw - 9, top + 1], [fx - fw - 4, top - 6], [fx + fw + 3, top - 7], [fx + fw + 9, top + 1], [fx + fw * 0.6, top + 2], [fx - fw * 0.6, top + 2]], tex("#4a3024", "#2a1a14", 0.3, sd));
    R.m = SKY; R.rect(fx - fw * 0.55, top + 2, fw * 1.1, 1, "#ffa040");
    R.ellipse(fx, gy - 6, fw + 6, 2.5, "#ffb850"); R.glow(fx, gy - 6, 20, 8, "#ff9030", 0.45); // 着水のしぶき
    for (const d of [-1, 1]) { R.px(fx + d * (fw + 4), gy - 9, "#ffb040"); R.px(fx + d * (fw + 7), gy - 8, "#e06018", 0.8); }
    R.glow(fx, H * 0.36, 30, 64, "#a03010", 0.28);
    R.light(fx, H * 0.38, 56, "#ff6020", 1.2, 80);
  }
  R.m = SKY; R.rect(0, gy - 8, W, 8, (x, y) => { const crust = fbm(x * 0.08, y * 0.3, 5) > 0.55; const k = 0.4 + 0.6 * clamp01(Math.abs(x - cx) / (W * 0.3)); return crust ? mul(C("#3a1a10"), 1) : lava(x, y, k); });
  R.glow(cx, gy - 4, W * 0.7, 24, "#801c04", 0.35);
  R.light(W * 0.2, gy - 4, 60, "#ff5010", 1, 26); R.light(W * 0.8, gy - 4, 60, "#ff5010", 1, 26); R.light(cx, gy - 4, 70, "#ff4010", 0.5, 18);
  // つらら石 (上辺)
  R.m = SURF; R.rect(0, 0, W, 6, "#1c120e");
  const r = rnd(17);
  for (let i = 0; i < 18; i++) { const x = r() * W, l = 6 + r() * (Math.abs(x - cx) < W * 0.25 ? 10 : 30); spike(R, x, 3, l, 4 + r() * 6, "#3a2620", 1); }
  // 柱状玄武岩 (左右)
  const basalt = (x0, n, dir) => {
    for (let i = 0; i < n; i++) {
      const w = 7 + (i % 3), x = x0 + dir * i * 7, top = H * (0.18 + 0.26 * hash(i, dir + 2, 4)) + i * 4;
      const sh = (px, py) => mul(C("#4a3a34"), (px - x < w * 0.35 ? 1.25 : px - x < w * 0.7 ? 0.95 : 0.6) * (0.9 + 0.2 * vnoise(px * 0.4, py * 0.2, i)));
      R.m = SURF; R.rect(x, top, w, H - top, sh); R.rect(x, top, w, 2, "#8a6a5a"); R.rect(x, top + 2, w, 1, "#150d0a");
      R.rect(dir > 0 ? x + w - 1 : x, top + 3, 1, H - top, "#a04a20", 0.5);
      for (let y = top + 14; y < H; y += 16 + i) R.rect(x, y, w, 1, "#120a08");
    }
  };
  basalt(-2, 6, 1); basalt(W - 8, 6, -1);
  // 床: 玄武岩 + 発光する亀裂
  ground(R, gy, "#4a3020", "#140b07", 3, 0.12, 0.35);
  R.light(cx, gy + 4, W * 0.7, "#ff5a18", 1.2, 30);
  // 床を這う赤熱の亀裂 (横へ枝分かれする網目)
  const crack = (x, y, n, sd, dir) => {
    const q = rnd(sd); let px = x, py = y; R.m = SKY;
    for (let i = 0; i < n; i++) {
      const nx = px + dir * (3 + q() * 6), ny = py + (q() - 0.4) * 3;
      R.line(px, py, nx, ny, i < n / 2 ? "#ffa040" : "#d04810"); R.glow(px, py, 7, 4, "#801c04", 0.28, 3);
      if (q() < 0.3 && n > 3) crack(nx, ny, Math.floor(n / 2), sd * 7 + i, q() < 0.5 ? dir : -dir);
      px = nx; py = ny;
    }
  };
  crack(W * 0.02, H * 0.7, 7, 3, 1); crack(W * 0.98, H * 0.66, 7, 5, -1); crack(W * 0.06, H * 0.9, 9, 8, 1); crack(W * 0.94, H * 0.92, 9, 9, -1);
  crack(W * 0.36, H * 0.95, 5, 11, 1); crack(W * 0.64, H * 0.97, 5, 12, -1);
  A.pulse((P) => { P.glow(cx, gy - 4, W * 0.75, 30, "#a02a08", 0.3); P.glow(W * 0.2, H * 0.36, 28, 60, "#a03010", 0.22); P.glow(W * 0.8, H * 0.36, 28, 60, "#a03010", 0.22); }, (t) => 0.5 + 0.5 * Math.sin(t * 0.0012));
  A.part({ n: 34, col: "#ffa040", x0: 0.02, x1: 0.98, y0: 0.05, y1: 0.95, vy: -0.06, sway: 10, swf: 0.5, a: 0.8, tw: 2.5, big: 0.12 });
  A.part({ n: 12, col: "#ff5020", x0: 0.1, x1: 0.9, y0: 0.2, y1: 0.6, vy: -0.03, sway: 6, swf: 0.4, a: 0.5, tw: 1.5, seed: 4 });
}

// 層 8 氷結回廊: 氷壁の回廊、透ける氷柱、天井の氷柱 (つらら)、鏡のような氷床、降る雪
function sIce(R, A) {
  const { w: W, h: H } = R, gy = Math.round(H * 0.56), cx = W / 2;
  R.amb = [0.6, 0.75, 0.9];
  const ice = (k) => (x, y) => mul(mix(C("#1a3a4c"), C("#3a6a84"), clamp01(vnoise(x * 0.07 + y * 0.03, y * 0.05 - x * 0.02, 4) * 1.3 - 0.15)), k);
  const bx0 = W * 0.3, bx1 = W * 0.7, by0 = H * 0.2;
  R.m = SURF; R.rect(0, 0, W, gy, ice(0.75));
  R.poly([[0, 0], [bx0, by0], [bx0, gy], [0, H * 0.82]], ice(0.95)); R.poly([[W, 0], [bx1, by0], [bx1, gy], [W, H * 0.82]], ice(0.85));
  R.poly([[0, 0], [W, 0], [bx1, by0], [bx0, by0]], ice(0.6));
  R.m = SKY; R.rect(bx0, by0, bx1 - bx0, gy - by0, (x, y) => mix(C("#0a1820"), C("#16364a"), clamp01(1 - Math.hypot((x - cx) / (W * 0.2), (y - gy * 0.85) / (H * 0.4)))));
  R.glow(cx, gy - 6, W * 0.22, 26, "#2a6a8a", 0.25);
  for (let k = 0; k < 3; k++) { const pts = archPts(cx, by0 + 8 + k * 7, W * (0.15 - k * 0.035), gy, 0.3); R.m = SKY; for (let i = 0; i + 1 < pts.length; i++) R.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], "#3a7a98", 0.35 - k * 0.08); }
  // 割れ目のハイライト (氷の切子)
  const r = rnd(8); R.m = SURF;
  for (let i = 0; i < 26; i++) { const x = r() < 0.5 ? r() * bx0 : bx1 + r() * (W - bx1), y = r() * gy, l = 4 + r() * 12, a = -0.9 + r() * 1.8; R.line(x, y, x + Math.cos(a) * l, y + Math.sin(a) * l, "#7ab8d0", 0.45); }
  // 氷柱 (透ける太い柱)
  for (const [x, w] of [[W * 0.06, 18], [W * 0.94 - 18, 18]]) {
    R.m = SKY; R.rect(x, 0, w, H * 0.86, (px, py) => { const u = clamp01((px + 0.5 - x) / w), f = Math.min(3, Math.floor(u * 4)); return mul(mix(C("#1e4a62"), C("#6aa8c4"), [0.55, 0.85, 0.5, 0.25][Math.min(3, f)] * (0.6 + 0.5 * vnoise(px * 0.2, py * 0.04, 3))), u < 0.08 || u > 0.92 ? 0.55 : 0.85); });
    R.rect(x + Math.round(w * 0.3), 0, 1, H * 0.86, "#b8e4f8", 0.45); R.rect(x, 0, w, H * 0.86, (px, py) => (vnoise(px * 0.3, py * 0.12, 9) > 0.72 ? C("#d0f0ff") : null), 0.18);
    R.m = SURF; R.rect(x - 3, H * 0.86 - 4, w + 6, 4, "#5a8aa0"); R.rect(x - 3, H * 0.86 - 4, w + 6, 1, "#b8e0f0");
    R.glow(x + w / 2, H * 0.45, 24, 60, "#2a7090", 0.2); R.light(x + w / 2, H * 0.6, 40, "#60b0d0", 0.5, 50);
  }
  // つらら
  for (let i = 0; i < 46; i++) {
    const x = r() * W, back = x > bx0 && x < bx1; // 天井と側壁の境 (奥ほど低い) に沿って垂れる
    const top = back ? by0 - 1 : x < bx0 ? (x / bx0) * by0 : ((W - x) / (W - bx1)) * by0;
    spike(R, x, top - 1, (back ? 3 : 6) + r() * (back ? 6 : 22), 2 + r() * 3, "#9ad0e8", 1, 1.2);
  }
  // 氷床: 光沢 + 柱の映り込み + 雪溜まり
  R.m = SURF; ground(R, gy, "#1e3644", "#0b1820", 4, 0.06, 0.18);
  R.m = SURF; for (let y = gy + 1; y < H; y += 1) { const k = (y - gy) / (H - gy); if ((y * 7) % 5 === 0) R.span(y, W * 0.1, W * 0.9, "#2a5060", 0.18 * (1 - k)); }
  R.m = ADD; for (const x of [W * 0.06 + 9, W * 0.94 - 9]) for (let y = gy; y < H; y++) R.span(y, x - 7, x + 7, (px) => (((px + y) & 3) === 0 ? null : C("#163848")), 0.6 * (1 - (y - gy) / (H - gy)));
  R.m = SURF; R.rect(0, gy, W, 1, "#4a7a90");
  R.m = SURF; for (let i = 0; i < 10; i++) { const x = r() < 0.5 ? r() * W * 0.25 : W * 0.75 + r() * W * 0.25, y = gy + 4 + r() * (H - gy - 4); R.line(x, y, x + (r() - 0.5) * 20, y + (r() - 0.5) * 4, "#6a9ab0", 0.35); }
  for (const [x, s] of [[0, 1], [W, -1]]) { R.m = SURF; R.ellipse(x + s * 10, H + 2, 30, 9, "#5a7a8c"); R.ellipse(x + s * 22, H + 3, 18, 6, "#6a8a9c"); R.ellipse(x + s * 8, H + 3, 26, 7, "#7a9aac"); R.rect(x + (s > 0 ? 0 : -30), H - 7, 30, 1, "#a8cce0", 0.6); }
  A.part({ n: 40, col: "#e8f6ff", x0: 0, x1: 1, y0: 0, y1: 1, vy: 0.03, vx: 0.006, sway: 10, swf: 0.4, a: 0.5, big: 0.15 });
  A.part({ n: 12, col: "#ffffff", x0: 0.02, x1: 0.98, y0: 0.02, y1: 0.95, a: 0.8, blink: 0.7, seed: 7 });
}

// 層 9 毒沼: 霞んだ空、苔の垂れる捻れ木、枯れ葦、毒々しく光る沼と浮かぶ泡・胞子
function sSwamp(R, A) {
  const { w: W, h: H } = R, gy = Math.round(H * 0.56);
  R.amb = [0.55, 0.62, 0.48];
  R.m = SKY; R.vgrad(0, 0, W, gy + 4, [[0, "#070a06"], [0.5, "#141c10"], [1, "#2c3a1e"]]);
  R.glow(W * 0.3, H * 0.15, 40, 30, "#4a5a1a", 0.4); R.m = SKY; R.ellipse(W * 0.3, H * 0.15, 7, 7, "#8a9a50", 0.5);
  clouds(R, 23, 6, gy * 0.8, "#0c1209", 0.56, "#2a3618");
  // 遠景の枯れ木 (霞)
  for (let i = 0; i < 9; i++) { const x = hash(i, 1, 9) * W; if (Math.abs(x - W / 2) < W * 0.1) continue; R.m = SKY; tree(R, x, gy + 2, 24 + hash(i, 2, 9) * 16, 300 + i, "#1c2614", { depth: 3, th: 1.5 }); }
  fogBand(R, gy - 2, 18, "#3a4a24", 0.4, 7);
  // 沼地: 泥と黒い水溜まり
  R.m = SURF; ground(R, gy, "#1c1e12", "#0c0e08", 6, 0.08, 0.35);
  R.m = SKY; for (let i = 0; i < 9; i++) { const x = hash(i, 3, 4) * W, y = gy + 4 + hash(i, 4, 4) * (H - gy - 8), rx = 8 + hash(i, 5, 4) * 26; R.ellipse(x, y, rx, rx * 0.16 + 1, "#080c08"); R.rect(x - rx * 0.4, y - 1, rx * 0.5, 1, "#28361c", 0.6); }
  // 毒の池 (自発光)
  for (const [x, y, rx, ry] of [[W * 0.1, H * 0.8, 24, 5], [W * 0.88, H * 0.73, 20, 4], [W * 0.22, H * 0.62, 11, 2.5], [W * 0.74, H * 0.61, 9, 2]]) {
    R.m = SKY; R.ellipse(x, y, rx + 1, ry + 1, "#2a3a10"); R.ellipse(x, y, rx, ry, (px, py) => mix(C("#4a6a10"), C("#a8c838"), clamp01(1 - Math.hypot((px - x) / rx, (py - y) / ry)) * (0.6 + 0.6 * vnoise(px * 0.3, py, 2))));
    R.glow(x, y - 2, rx * 2.2, ry * 6, "#4a6a10", 0.3); R.light(x, y - 4, rx * 2.6, "#a0c040", 0.8, rx * 1.6);
  }
  // 捻れた枯れ木 (左右) と垂れ苔
  for (const [x, by, h, sd, lean] of [[W * 0.05, H * 0.9, H * 0.9, 41, 0.25], [W * 0.95, H * 0.84, H * 0.85, 42, -0.3]]) {
    const tips = []; tree(R, x, by, h, sd, "#0c0e08", { lean, gnarl: 1.1, tips, bias: lean * 0.5 });
    R.m = SURF; for (const [tx, ty] of tips) if (hash(tx | 0, ty | 0, 1) < 0.45) R.line(tx, ty, tx + 1, ty + 4 + hash(tx | 0, 2, 2) * 12, "#2a3418", 0.9);
  }
  reeds(R, W * 0.16, H, 18, "#3a3a20", 3, 30); reeds(R, W * 0.86, H, 18, "#3a3a20", 4, 32); reeds(R, W * 0.3, H * 0.66, 6, "#2a2c18", 5, 12); reeds(R, W * 0.66, H * 0.64, 6, "#2a2c18", 6, 12);
  fogBand(R, H * 0.7, 18, "#2e3c1c", 0.3, 33);
  A.fog("#a8c060", 0.66, 4, 0.1, 4, 110, 12);
  A.part({ n: 8, col: "#c8e860", x0: 0.02, x1: 0.2, y0: 0.6, y1: 0.8, vy: -0.03, sway: 2, swf: 1, a: 0.7, ring: true });
  A.part({ n: 7, col: "#c8e860", x0: 0.8, x1: 0.96, y0: 0.55, y1: 0.73, vy: -0.03, sway: 2, swf: 1, a: 0.7, ring: true, seed: 3 });
  A.part({ n: 26, col: "#b8d060", x0: 0, x1: 1, y0: 0.1, y1: 0.9, vy: -0.008, vx: 0.004, sway: 12, swf: 0.2, a: 0.32, tw: 1, seed: 5 });
}

// 層 10 嵐の尖塔: 尖塔の頂の石室、割れた尖頭窓とバラ窓から覗く嵐空、雨、稲光、落ちた鐘
function sSpire(R, A) {
  const { w: W, h: H } = R, gy = Math.round(H * 0.58), cx = W / 2;
  R.amb = [0.5, 0.5, 0.62];
  bricks(R, 0, 0, W, gy, "#2a2834", "#121118", 12, 6, 3);
  const skies = [];
  const stormSky = (pts) => { skies.push(pts); R.m = SKY; R.poly(pts, (x, y) => mix(C("#1c1636"), C("#3a3060"), clamp01(fbm(x * 0.05, y * 0.07, 3) * 1.4 - 0.3))); };
  // 左右の尖頭窓 (割れた硝子と中柱)
  for (const wx of [W * 0.14, W * 0.86]) {
    const hw = W * 0.085, top = H * 0.06, bot = H * 0.5;
    archFrame(R, wx, top, hw, bot, 4, "#3a3846", null, 0.4, 0);
    stormSky(archPts(wx, top, hw, bot, 0.4));
    R.m = SURF; R.rect(wx - 1, top + 12, 2, bot - top - 12 - (wx < cx ? 18 : 0), "#2a2834"); R.rect(wx - hw, H * 0.3, hw * 2, 1, "#2a2834");
    R.poly([[wx - hw, bot], [wx - hw, bot - 9], [wx - hw + 6, bot - 3], [wx - hw + 9, bot]], "#4a5a78", 0.6); R.poly([[wx + hw, top + 16], [wx + hw - 5, top + 24], [wx + hw, top + 28]], "#4a5a78", 0.6);
    R.rect(wx - hw - 3, bot, hw * 2 + 6, 3, "#3a3846");
  }
  // 頂のバラ窓 (中央上)
  const rx = cx, ry = Math.round(H * 0.11), rr = Math.round(W * 0.075);
  R.m = SURF; R.ellipse(rx, ry, rr + 3, rr + 3, "#3a3846");
  const rose = []; for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU; rose.push([rx + Math.cos(a) * rr, ry + Math.sin(a) * rr]); }
  stormSky(rose);
  R.m = SURF; for (let i = 0; i < 8; i++) { if (i === 2 || i === 3) continue; const a = (i / 8) * TAU; R.line(rx, ry, rx + Math.cos(a) * rr, ry + Math.sin(a) * rr, "#2a2834"); }
  R.ellipse(rx, ry, 3, 3, "#2a2834");
  // 床: 濡れた石床と水溜まり
  ground(R, gy, "#24222c", "#0e0d13", 4, 0.1, 0.25);
  perspGrid(R, gy, cx, gy - 40, "#121118", 0.8, 7, 5);
  R.m = SURF; for (const [x, y, w] of [[W * 0.16, H * 0.74, 22], [W * 0.84, H * 0.78, 26], [W * 0.5, H * 0.92, 30]]) { R.ellipse(x, y, w, 3, "#30304a", 0.7); R.rect(x - w * 0.4, y - 1, w * 0.5, 1, "#5a5a80", 0.4); }
  // 落ちた鐘 (右下) と瓦礫 (左下)
  { // 落ちて傾いた大鐘: 口をこちらへ向け、内側の闇と青錆が見える
    const bx = W * 0.85, by = H * 0.9, rot = -0.55, cs = Math.cos(rot), sn = Math.sin(rot);
    const tf = ([u, v]) => [bx + u * cs - v * sn, by + u * sn + v * cs];
    const prof = [[-5, -27], [5, -27], [8, -22], [9, -12], [11, -5], [15, 0], [-15, 0], [-11, -5], [-9, -12], [-8, -22]];
    const bronze = (x, y) => { const u = (x - bx) * cs + (y - by) * sn, n = vnoise(x * 0.35, y * 0.35, 6); const c = n > 0.62 ? mix(C("#7a5a30"), C("#4a7a6a"), 0.7) : C("#7a5a30"); return mul(c, (u < -5 ? 1.35 : u < 4 ? 1 : 0.62) * (0.85 + 0.25 * vnoise(x * 0.5, y * 0.2, 2))); };
    R.m = SURF; R.ellipse(bx + 4, by + 8, 24, 3, "#08070a", 0.6); R.poly(prof.map(tf), bronze);
    R.rect(...tf([-3, -31]), 6, 4, "#5a4426"); R.line(...tf([-9, -12]), ...tf([9, -12]), "#a8884a", 0.7);
    const mouth = []; for (let i = 0; i <= 20; i++) { const a = (i / 20) * TAU; mouth.push(tf([Math.cos(a) * 15, Math.sin(a) * 6])); }
    R.poly(mouth, (x, y) => mix(C("#2a1e10"), C("#060504"), clamp01(Math.hypot(x - bx, y - by) / 12)));
    for (let i = 0; i < 10; i++) R.line(...mouth[i], ...mouth[i + 1], i > 2 && i < 8 ? "#d8b878" : "#8a6a3a", 1, 1); // 手前の縁
    R.line(...tf([-3, -20]), ...tf([3, -6]), "#1a120a"); // ひび
  }
  R.light(W * 0.84, H * 0.8, 46, "#8a80c0", 0.6, 30);
  rubble(R, 12, 12, 0, W * 0.22, H * 0.7, H * 0.98, "#3a3846");
  R.light(W * 0.14, H * 0.3, 60, "#8a80c0", 0.5, 70); R.light(W * 0.86, H * 0.3, 60, "#8a80c0", 0.5, 70);
  // 稲光: 空の部分だけを白く光らせるパルス + 稲妻の枝
  A.pulse((P) => { P.m = ADD; for (const pts of skies) P.poly(pts, (x, y) => mix(C("#3a3470"), C("#c8c0ff"), clamp01(fbm(x * 0.05, y * 0.07, 3) * 1.6 - 0.35)), 0.6); P.glow(W * 0.14, H * 0.3, 60, 70, "#6a60a0", 0.4); P.glow(W * 0.86, H * 0.3, 60, 70, "#6a60a0", 0.4); P.glow(cx, ry, 40, 30, "#6a60a0", 0.35); }, lightning);
  A.special = (ctx, w, h, t) => {
    const f = lightning(t); if (f < 0.3) return;
    const k = Math.floor(t / 7000), side = hash(k, 1, 4) < 0.5 ? 0.14 : 0.86;
    ctx.globalAlpha = f * 0.75; ctx.fillStyle = "#f0ecff";
    let x = side * w + (hash(k, 2, 4) - 0.5) * 20, y = h * 0.04;
    for (let i = 0; i < 14; i++) { const nx = x + (hash(k, i + 5, 4) - 0.5) * 14, ny = y + h * 0.032; for (let s = 0; s < 3; s++) ctx.fillRect(Math.round((x + (nx - x) * s / 3) / 2) * 2, Math.round((y + (ny - y) * s / 3) / 2) * 2, 2, 4); x = nx; y = ny; }
  };
  A.part({ n: 40, col: "#a8a8d8", x0: -0.1, x1: 1, y0: 0, y1: 1, vy: 1.1, vx: 0.22, a: 0.2, streak: 5, slant: 0.4 });
}
// 稲光の明るさ (約7秒周期で、二度だけ短く閃く)
function lightning(t) {
  const per = 7000, k = Math.floor(t / per), p = t - k * per - hash(k, 0, 9) * 3000;
  if (p < 0) return 0;
  return p < 90 ? 1 - p / 90 : p > 160 && p < 300 ? (1 - (p - 160) / 140) * 0.7 : 0;
}

// 層 11 闘技場跡: 弧を描く観客席とアーケード、崩れた区画、折れた柱、破れた天幕、砂地
function sArena(R, A) {
  const { w: W, h: H } = R, gy = Math.round(H * 0.58), cx = W / 2;
  R.amb = [0.62, 0.55, 0.5];
  R.m = SKY; R.vgrad(0, 0, W, gy, [[0, "#07060a"], [0.55, "#1a1218"], [1, "#3a2418"]]);
  stars(R, 61, 30, H * 0.25, "#b0a090");
  const st = (x, y) => mul(C("#4a3c2c"), 0.8 + 0.35 * vnoise(x * 0.3, y * 0.4, 4));
  const yAt = (base, d, x) => base - d * Math.pow((x - cx) / (W / 2), 2);
  // 上層アーケード (U 字に反る)
  R.m = SURF;
  for (let x = 0; x < W; x++) { const t = yAt(H * 0.2, 20, x); R.rect(x, t, 1, gy - t, st); }
  for (let i = -9; i <= 9; i++) { const x = cx + i * W * 0.055, t = yAt(H * 0.2, 20, x); R.m = SURF; R.poly(archPts(x, t + 3, 3, t + 12), "#0c0806"); R.rect(x - 5, t, 10, 1, "#6a5a44"); }
  // 観客席の段 (上ほど強く反る)
  const tiers = 7;
  for (let k = 0; k < tiers; k++) {
    const base = H * (0.3 + k * 0.034), d = 18 * (1 - k / tiers);
    for (let x = 0; x < W; x++) { const y = Math.round(yAt(base, d, x)); R.m = SURF; R.rect(x, y, 1, 1, "#7a6448"); R.rect(x, y + 1, 1, 3, "#2a2018"); }
  }
  for (let i = -8; i <= 8; i++) { const x0 = cx + i * W * 0.07; R.m = SURF; R.line(x0, yAt(H * 0.3, 18, x0), x0 * 0.92 + cx * 0.08, H * 0.52, "#1a140e", 0.7, 2); } // 通路
  // 崩れた区画 (右奥)
  R.m = SKY; R.poly([[W * 0.33, H * 0.1], [W * 0.35, H * 0.28], [W * 0.38, H * 0.24], [W * 0.4, H * 0.34], [W * 0.43, H * 0.3], [W * 0.46, H * 0.12]], (x, y) => stopCol([[0, "#07060a"], [0.55, "#1a1218"], [1, "#3a2418"]], y / gy));
  R.glow(W * 0.6, H * 0.075, 34, 22, "#6a2a1a", 0.5); R.m = SKY; R.ellipse(W * 0.6, H * 0.075, 6, 6, "#c88060"); R.ellipse(W * 0.6 + 2, H * 0.075 - 1, 5, 5, "#6a3022", 0.55);
  // 基壇の壁と入場門 (∩ 字)
  for (let x = 0; x < W; x++) { const t = Math.round(H * 0.47 + 6 * Math.pow((x - cx) / (W / 2), 2)); R.m = SURF; R.rect(x, t, 1, gy - t + 1, st); R.px(x, t, "#7a6448"); }
  for (const gx of [cx - W * 0.3, cx + W * 0.3]) { R.poly(archPts(gx, H * 0.5, 5, gy), "#0a0705"); }
  R.poly(archPts(cx, H * 0.47, 9, gy), "#050302");
  // 砂地
  ground(R, gy, "#33291c", "#17120c", 9, 0.07, 0.3);
  R.m = SURF; for (let i = 0; i < 12; i++) { const y = gy + 3 + i * 4.5, x = hash(i, 1, 3) * W; R.rect(x, y, 16 + hash(i, 2, 3) * 30, 1, "#3e3222", 0.6); }
  R.ellipse(W * 0.28, H * 0.88, 12, 3, "#2a1410", 0.6);
  // 折れた柱 (左右手前)
  column(R, W * 0.02, H * 0.22, H * 0.96, 15, "#6a5a44", { broken: 3, base: true, flute: true });
  column(R, W * 0.9, H * 0.34, H * 0.94, 13, "#6a5a44", { broken: 6, base: true, flute: true });
  R.m = SURF; R.poly([[W * 0.72, H * 0.98], [W * 0.75, H * 0.9], [W * 0.87, H * 0.92], [W * 0.86, H * 1.0]], tex("#5a4a38", "#3a2e22", 0.3, 2));
  // 破れた天幕 (上辺の左右)
  for (const s of [-1, 1]) {
    const x0 = s < 0 ? 0 : W; R.m = SURF; R.line(x0, H * 0.02, x0 - s * W * 0.32, H * 0.0, "#2a1e14", 1, 2);
    for (let i = 0; i < 14; i++) { const x = x0 - s * i * W * 0.022, l = 6 + hash(i, s + 4, 5) * 26 * (1 - i / 16); R.rect(x - (s > 0 ? 5 : 0), 1, 5, l, i % 2 ? "#5a2a1c" : "#6a4a22", 0.95); R.rect(x - (s > 0 ? 5 : 0), 1 + l, 2, 2, i % 2 ? "#3a1a10" : "#4a3418"); }
  }
  // 剣と盾 (砂に突き立つ)
  R.m = SURF; R.line(W * 0.14, H * 0.96, W * 0.17, H * 0.74, "#7a7a80", 1, 2); R.rect(W * 0.15 - 3, H * 0.78, 8, 2, "#5a4a30");
  R.light(W * 0.5, H * 0.1, 160, "#c08050", 0.25, 90);
  A.part({ n: 30, col: "#d0b080", x0: -0.05, x1: 1.05, y0: 0.4, y1: 1, vx: 0.04, sway: 4, swf: 0.6, a: 0.3, tw: 1 });
  A.fog("#c0a070", 0.82, 3, 0.07, 9, 120, 8);
}

// 層 12 地底大空洞: 巨大なつらら石と石筍、深い裂け目、遠くで光る結晶群、細い地底滝
function sCavern(R, A) {
  const { w: W, h: H } = R, gy = Math.round(H * 0.58), cx = W / 2;
  R.amb = [0.55, 0.55, 0.6];
  R.m = SKY; R.rect(0, 0, W, H * 0.48, (x, y) => mix(C("#0e0f15"), C("#1e1e26"), fbm(x * 0.04, y * 0.07, 3)));
  R.m = SKY; R.rect(W * 0.6, H * 0.08, 2, H * 0.4, (x, y) => mix(C("#2a3a48"), C("#5a7a90"), vnoise(x, y * 0.3, 2)), 0.6); R.glow(W * 0.6, H * 0.46, 14, 6, "#3a5a70", 0.4);
  // 遠景の岩柱 (天井と床をつなぐ巨柱。霞んで淡い)
  for (const [x, w, k] of [[W * 0.3, 16, 0.75], [W * 0.68, 20, 0.8], [W * 0.5, 9, 0.55]]) {
    R.m = SKY; R.poly([[x - w * 0.5, 0], [x + w * 0.5, 0], [x + w * 0.25, H * 0.2], [x + w * 0.35, H * 0.3], [x + w * 0.2, H * 0.36], [x + w * 0.45, H * 0.48], [x - w * 0.5, H * 0.48], [x - w * 0.3, H * 0.36], [x - w * 0.4, H * 0.24], [x - w * 0.25, H * 0.16]],
      (px, py) => mul(mix(C("#1e1e26"), C("#2c2c36"), vnoise(px * 0.3, py * 0.06, 3)), k * (px < x - w * 0.1 ? 1.15 : 0.85)));
  }
  for (const [x, y, s, c] of [[W * 0.14, H * 0.42, 11, "#4ad0e0"], [W * 0.38, H * 0.3, 6, "#a070e0"], [W * 0.62, H * 0.44, 7, "#4ad0e0"], [W * 0.86, H * 0.4, 11, "#a070e0"], [W * 0.5, H * 0.2, 4, "#4ad0e0"]]) {
    R.glow(x, y - s * 0.4, s * 5, s * 3.5, c, 0.16);
    for (const i of [0, 3, 1, 2]) crystal(R, x + (i - 1.5) * s * 0.45, y, s * (0.7 + hash(i, s, 2) * 0.9) * (i === 1 || i === 2 ? 1.3 : 0.8), Math.max(3, s * 0.45), (i - 1.5) * 0.18, c, 0);
  }
  // 裂け目 (遠景の下は底なしの闇)
  R.m = SKY; R.vgrad(0, H * 0.46, W, gy - H * 0.46, [[0, "#0a0b10"], [1, "#010102"]]);
  fogBand(R, H * 0.5, 10, "#20242e", 0.4, 4);
  // 足場 (手前の岩棚)
  R.m = SURF; const lip = []; for (let x = 0; x <= W; x += 4) lip.push([x, gy - 2 + hash(x, 1, 5) * 4]);
  R.poly([...lip, [W, H], [0, H]], (x, y) => mix(C("#2a261e"), C("#141210"), clamp01((y - gy) / (H - gy)) * 0.8 + fbm(x * 0.1, y * 0.2, 4) * 0.2));
  for (const [x, y] of lip) { R.px(x, y, "#5a5040"); R.px(x + 1, y, "#4a4234"); R.px(x + 2, y + 1, "#3a3428"); }
  // 天井の岩と巨大なつらら石
  R.m = SURF; for (let x = 0; x < W; x++) R.rect(x, 0, 1, 4 + fbm(x * 0.05, 0, 3) * 10, "#1e1a16");
  for (const [x, l, w] of [[W * 0.07, H * 0.62, 24], [W * 0.2, H * 0.32, 12], [W * 0.38, H * 0.12, 6], [W * 0.46, H * 0.08, 4], [W * 0.56, H * 0.14, 6], [W * 0.66, H * 0.09, 5], [W * 0.79, H * 0.3, 12], [W * 0.93, H * 0.56, 26], [W * 0.28, H * 0.18, 7], [W * 0.72, H * 0.2, 8]]) spike(R, x, 2, l, w, "#4a4236", 1);
  for (const [x, l, w, by] of [[W * 0.04, H * 0.5, 20, H], [W * 0.17, H * 0.24, 10, H * 0.94], [W * 0.97, H * 0.55, 22, H], [W * 0.84, H * 0.22, 9, H * 0.9], [W * 0.26, H * 0.08, 5, H * 0.68], [W * 0.75, H * 0.07, 5, H * 0.66]]) spike(R, x, by, l, w, "#4a4236", -1);
  // 手前の結晶群 (左右下)
  for (const [x, y, c, n] of [[W * 0.1, H * 0.98, "#4ad0e0", 5], [W * 0.9, H * 0.96, "#a070e0", 5]]) {
    for (let i = 0; i < n; i++) crystal(R, x + (i - 2) * 5, y, 10 + hash(i, n, 7) * 16, 4, (i - 2) * 0.12, c, 0.15);
    R.light(x, y - 12, 60, c, 0.9, 40);
  }
  A.part({ n: 24, col: "#b0a890", x0: 0, x1: 1, y0: 0.05, y1: 0.95, vy: 0.006, vx: 0.003, sway: 8, swf: 0.15, a: 0.25, tw: 0.8 });
  A.part({ n: 14, col: "#a0f0ff", x0: 0.05, x1: 0.95, y0: 0.12, y1: 0.42, a: 0.8, blink: 0.6, seed: 6 });
  A.part({ n: 8, col: "#e0c8ff", x0: 0.02, x1: 0.98, y0: 0.82, y1: 0.98, a: 0.8, blink: 0.5, seed: 8 });
}

// 層 13 魔導書庫: そびえる書架、手摺の回廊、宙に浮く魔導書、燭台、床に灯る魔法陣と昇る符
function sLibrary(R, A) {
  const { w: W, h: H } = R, gy = Math.round(H * 0.58), cx = W / 2;
  R.amb = [0.4, 0.36, 0.5];
  R.m = SURF; R.rect(0, 0, W, gy, "#120e18");
  for (let i = 0; i < 6; i++) bookshelf(R, W * 0.22 + i * W * 0.094, H * 0.34, W * 0.09, gy - H * 0.34, 20 + i, 0.5);
  // 上階の回廊 (手摺)
  for (let i = 0; i < 6; i++) bookshelf(R, W * 0.2 + i * W * 0.1, 0, W * 0.095, H * 0.26, 40 + i, 0.4);
  R.m = SURF; R.rect(0, H * 0.27, W, 3, "#3a2618"); R.rect(0, H * 0.27, W, 1, "#5a3e24"); R.rect(0, H * 0.33, W, 1, "#2a1a10");
  for (let x = 2; x < W; x += 5) R.rect(x, H * 0.29, 1, H * 0.04, "#2a1a10");
  // 左右の巨大な書架 + 梯子
  bookshelf(R, -2, 0, W * 0.2, H * 0.98, 7, 1); bookshelf(R, W * 0.8 + 2, 0, W * 0.2, H * 0.98, 8, 1);
  R.m = SURF; R.line(W * 0.15, H * 0.98, W * 0.19, H * 0.1, "#4a3018", 1, 2); R.line(W * 0.2, H * 0.98, W * 0.235, H * 0.1, "#4a3018", 1, 2);
  for (let k = 0; k < 14; k++) { const t = k / 14, y = H * 0.98 - (H * 0.88) * t; R.line(W * 0.15 + W * 0.04 * t, y, W * 0.2 + W * 0.035 * t, y, "#3a2414"); }
  // 床: 暗い板張り + 魔法陣
  ground(R, gy, "#1c1418", "#0c080b", 5, 0.05, 0.2);
  R.m = SURF; for (let y = gy + 2, k = 0; y < H; y += 3 + k, k++) R.rect(0, y, W, 1, "#0a0709");
  const ring = (P, k) => {
    const ccx = cx, ccy = H * 0.8, rx = W * 0.34, ry = H * 0.12;
    for (let a = 0; a < TAU; a += 0.012) for (const s of [1, 0.86, 0.5]) P.px(ccx + Math.cos(a) * rx * s, ccy + Math.sin(a) * ry * s, "#9d7ad0", k * (s === 0.5 ? 0.6 : 1));
    for (let i = 0; i < 6; i++) { const a1 = (i / 6) * TAU, a2 = ((i + 2) / 6) * TAU; P.line(ccx + Math.cos(a1) * rx * 0.86, ccy + Math.sin(a1) * ry * 0.86, ccx + Math.cos(a2) * rx * 0.86, ccy + Math.sin(a2) * ry * 0.86, "#9d7ad0", k * 0.6); }
    for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU; P.rect(ccx + Math.cos(a) * rx * 0.93 - 1, ccy + Math.sin(a) * ry * 0.93, 2, 1, "#c8a8f0", k); }
  };
  R.m = ADD; ring(R, 0.18);
  A.pulse((P) => { P.m = ADD; ring(P, 0.45); P.glow(cx, H * 0.8, W * 0.38, H * 0.15, "#3a2060", 0.4); }, (t) => 0.22 + 0.22 * Math.sin(t * 0.0013));
  // 燭台 (3 本の蝋燭)
  for (const x of [W * 0.25, W * 0.75]) {
    R.m = SURF; R.rect(x - 4, H * 0.64, 9, 2, "#4a3a20"); R.rect(x, H * 0.36, 1, H * 0.28, "#5a4628"); R.rect(x - 6, H * 0.38, 13, 1, "#5a4628");
    for (const dx of [-6, 0, 6]) { R.rect(x + dx - 0.5, H * 0.38 - 5 - (dx ? 0 : 2), 2, 5, "#d8d0b8"); flame(R, A, x + dx + 0.5, H * 0.38 - 5 - (dx ? 0 : 2), 1.3, "#fff4c0", "#ffa040", dx === 0, dx === 0 ? 60 : 0, 0.9); }
  }
  // 宙に浮く魔導書 (淡い紫の縁光)
  for (const [x, y, open] of [[W * 0.32, H * 0.1, 1], [W * 0.6, H * 0.06, 0], [W * 0.7, H * 0.18, 1], [W * 0.44, H * 0.2, 0]]) {
    R.glow(x, y, 16, 10, "#6a40a0", 0.3); R.m = SURF;
    if (open) { R.poly([[x - 8, y], [x - 1, y + 2], [x - 1, y - 3], [x - 8, y - 5]], "#c8c0a8"); R.poly([[x + 8, y], [x + 1, y + 2], [x + 1, y - 3], [x + 8, y - 5]], "#a8a088"); R.rect(x - 1, y - 3, 2, 6, "#3a2448"); }
    else { R.poly([[x - 7, y + 2], [x + 6, y - 1], [x + 7, y - 5], [x - 6, y - 2]], "#3a2448"); R.line(x - 6, y - 2, x + 7, y - 5, "#a08840"); }
  }
  A.part({ n: 14, col: "#c8a8ff", x0: 0.18, x1: 0.82, y0: 0.4, y1: 0.95, vy: -0.03, sway: 6, swf: 0.3, a: 0.55, tw: 1.2, rune: true });
  A.part({ n: 16, col: "#e8d8b0", x0: 0, x1: 1, y0: 0, y1: 0.9, vy: 0.006, sway: 8, swf: 0.25, a: 0.25, tw: 0.9, seed: 4 });
}

// 層 14 屍蝋の回廊: 髑髏と大腿骨を積んだ壁、骨のアーチ、壁龕の蝋燭、骨の散らばる床
function sOssuary(R, A) {
  const { w: W, h: H } = R, gy = Math.round(H * 0.58), cx = W / 2;
  R.amb = [0.3, 0.27, 0.22];
  const bone = C("#b0a07c"), dark = C("#0c0a08");
  R.m = SURF; R.rect(0, 0, W, gy, (x, y) => {
    const band = Math.floor(y / 9), ly = y - band * 9;
    if (band % 2) { return ly < 3 ? mul(bone, (ly === 0 ? 1.1 : 0.8) * (0.8 + 0.3 * hash(x >> 3, band, 2))) : ly === 3 ? dark : null; }
    return null;
  });
  for (let band = 0; band * 9 < gy; band += 2) for (let x = (band / 2) % 2 ? 3 : 0; x < W; x += 6) {
    const k = 0.7 + 0.4 * hash(x, band, 3); skull(R, x, band * 9 + 2 + (band ? 0 : 0), mul(bone, k), dark);
    R.m = SURF; R.rect(x + 5, band * 9 + 1, 1, 7, dark);
  }
  R.m = SURF; for (let band = 1; band * 9 < gy; band += 2) for (let x = 0; x < W; x += 6) { R.rect(x + (band % 4 === 1 ? 0 : 3), band * 9, 2, 3, mul(bone, 1.05)); } // 骨端のこぶ
  // 中央の骨のアーチ (奥へ続く暗い通路)
  const at = H * 0.2, aw = W * 0.14;
  R.m = SURF; R.poly(archPts(cx, at - 7, aw + 7, gy), "#2a2218");
  for (let i = 0; i <= 12; i++) { const a = Math.PI + (Math.PI * i) / 12; skull(R, cx + Math.cos(a) * (aw + 3.5) - 2.5, at + aw + Math.sin(a) * (aw + 3.5) - 2.5, mul(bone, 0.95), dark); }
  for (let y = at + aw; y < gy - 4; y += 6) { skull(R, cx - aw - 6, y, mul(bone, 0.9), dark); skull(R, cx + aw + 1, y, mul(bone, 0.9), dark); }
  R.m = SKY; R.poly(archPts(cx, at, aw, gy), (x, y) => mix(C("#0c0906"), C("#020101"), clamp01(1 - Math.abs(x - cx) / aw)));
  R.poly(archPts(cx, at + 18, aw * 0.5, gy - 3), "#000000", 0.7);
  // 壁龕 (左右) の蝋燭
  for (const nx of [W * 0.11, W * 0.89]) {
    R.m = SURF; R.poly(archPts(nx, H * 0.24, 9, H * 0.46), "#2a2218"); R.m = SKY; R.poly(archPts(nx, H * 0.26, 7, H * 0.45), "#0a0806");
    R.m = SURF; R.rect(nx - 9, H * 0.46, 18, 2, "#4a3e2c"); skull(R, nx + 1, H * 0.46 - 5, mul(bone, 1.1), dark);
    for (const dx of [-4, -1]) { R.rect(nx + dx, H * 0.46 - 6 - (dx + 4), 2, 6 + (dx + 4), "#e0d4a8"); flame(R, A, nx + dx + 1, H * 0.46 - 6 - (dx + 4), 1.2, "#fff8d0", "#ffc860", dx === -4, dx === -4 ? 80 : 0, 1.1); }
  }
  // 天井の骨のリブ
  R.m = SURF; for (let i = 0; i < 3; i++) { const yy = i * 3; chainSag(R, 0, yy, W, yy, -2, "#7a6c52", 1); }
  // 床: 石畳と散らばる骨
  ground(R, gy, "#221d16", "#0d0b08", 6, 0.1, 0.3);
  perspGrid(R, gy, cx, gy - 34, "#0e0b08", 0.7, 6, 4);
  R.m = SURF; R.rect(0, gy, W, 1, "#3a3024");
  const r = rnd(14);
  for (let i = 0; i < 26; i++) { const x = r() < 0.5 ? r() * W * 0.26 : W * 0.74 + r() * W * 0.26, y = gy + 6 + r() * (H - gy - 8), a = r() * Math.PI; R.line(x, y, x + Math.cos(a) * 6, y + Math.sin(a) * 2, mul(bone, 0.6), 1); R.px(x - 1, y, mul(bone, 0.7)); }
  skull(R, W * 0.06, H * 0.88, mul(bone, 0.75), dark, 2); skull(R, W * 0.87, H * 0.86, mul(bone, 0.7), dark, 2);
  for (const [x, y] of [[W * 0.2, H * 0.92], [W * 0.8, H * 0.95]]) { R.m = SURF; R.ellipse(x, y + 1, 7, 2, "#d8cca0"); for (const dx of [-3, 1, 4]) { R.rect(x + dx, y - 5 - (dx & 3), 2, 5 + (dx & 3), "#e8dcb0"); flame(R, A, x + dx + 1, y - 5 - (dx & 3), 1.1, "#fff8d0", "#ffc860", dx === 1, dx === 1 ? 50 : 0, 0.9); } }
  A.part({ n: 22, col: "#e0d0a0", x0: 0, x1: 1, y0: 0.05, y1: 0.9, vy: 0.005, sway: 6, swf: 0.2, a: 0.25, tw: 0.8 });
}

// 層 15 溶鉄炉: 巨大な炉の口、吊られたるつぼと注がれる溶鉄、床を走る溶鉄の溝、鎖、金床と火花
function sForge(R, A) {
  const { w: W, h: H } = R, gy = Math.round(H * 0.58), cx = W / 2;
  R.amb = [0.5, 0.4, 0.36];
  bricks(R, 0, 0, W, gy, "#3a2a24", "#140c0a", 10, 5, 5);
  R.m = SURF; R.rect(0, H * 0.06, W, 7, tex("#3a3230", "#24201e", 0.2, 3)); R.rect(0, H * 0.06, W, 1, "#5a4a44"); // 天井の梁
  const molten = (x, y, k = 1) => mul(mix(C("#c03808"), C("#ffd060"), clamp01(fbm(x * 0.2, y * 0.1, 3) * 1.6 - 0.3)), k);
  // 左の大炉
  const fx = W * 0.13; R.m = SURF;
  R.poly([[-4, H], [-4, H * 0.12], [fx - 10, H * 0.02], [fx + 10, H * 0.02], [fx + 26, H * 0.12], [fx + 28, H]], (x, y) => mul(tex("#3a2a22", "#22160f", 0.15, 4)(x, y), 0.6 + 0.6 * clamp01(1 - Math.abs(x - fx - 6) / 34)));
  for (let y = H * 0.14; y < H; y += 6) R.rect(-4, y, fx + 32, 1, "#140c08", 0.6);
  R.m = SURF; R.poly(archPts(fx + 6, H * 0.34, 20, H * 0.74), tex("#4a3a32", "#2e221c", 0.3, 9)); R.line(fx - 14, H * 0.74, fx - 14, H * 0.44, "#6a5448");
  R.m = SKY; R.poly(archPts(fx + 6, H * 0.38, 15, H * 0.72), (x, y) => molten(x, y, 0.7 + 0.4 * (1 - (y - H * 0.38) / (H * 0.34))));
  R.m = SURF; for (let i = -2; i <= 2; i++) R.rect(fx + 6 + i * 6, H * 0.4, 1, H * 0.32, "#1a1210"); R.rect(fx - 9, H * 0.56, 30, 1, "#1a1210");
  R.rect(fx - 16, H * 0.74, 44, 3, "#4a3a32"); R.rect(fx - 16, H * 0.74, 44, 1, "#8a6a50");
  R.glow(fx + 6, H * 0.56, 46, 40, "#a03a08", 0.4); R.light(fx + 6, H * 0.6, 130, "#ff7020", 1.5, 100);
  // 右のるつぼ (鎖で吊られ、傾いて注ぐ)
  const kx = W * 0.85, ky = H * 0.26;
  chainV(R, kx - 8, 0, ky - 10, "#6a5a54"); chainV(R, kx + 10, 0, ky - 13, "#6a5a54");
  { // るつぼ: 丸底の鉄鍋を左へ傾けて注ぐ
    const rot = -0.22, cs = Math.cos(rot), sn = Math.sin(rot), body = [];
    for (let i = 0; i <= 12; i++) { const a = (i / 12) * Math.PI; body.push([Math.cos(a) * 15, -3 + Math.sin(a) * 15]); }
    body.push([-17, -6], [-15, -10], [15, -10], [17, -6]);
    const T = body.map(([u, v]) => [kx + u * cs - v * sn, ky + u * sn + v * cs]);
    R.m = SURF; R.poly(T, (x, y) => mul(tex("#5a5250", "#2a2624", 0.3, 4)(x, y), (x - kx) < -5 ? 1.3 : (x - kx) < 6 ? 0.95 : 0.6));
    const rim = [[-16, -10], [16, -10]].map(([u, v]) => [kx + u * cs - v * sn, ky + u * sn + v * cs]);
    R.line(rim[0][0], rim[0][1], rim[1][0], rim[1][1], "#9a8a80", 1, 2); R.line(rim[0][0], rim[0][1] + 2, rim[1][0], rim[1][1] + 2, "#c06030", 0.6);
    R.rect(kx - 10, ky + 2, 20, 1, "#1e1a18", 0.7);
  }
  R.m = SKY; R.ellipse(kx - 15, ky - 5, 3, 2, "#ffd060"); R.rect(kx - 17, ky - 4, 3, gy + 6 - ky, (x, y) => molten(x, y * 0.3, 1));
  R.glow(kx - 16, gy + 4, 22, 10, "#c05010", 0.5); R.light(kx - 14, gy, 100, "#ff8030", 1.2, 80); R.light(kx, ky, 50, "#ff8030", 0.6, 40);
  // 溶鉄の溝 (床を横切る)
  ground(R, gy, "#22160f", "#0e0806", 7, 0.1, 0.3);
  R.m = SURF; R.rect(0, gy, W, 5, "#2a1e1a"); R.rect(0, gy, W, 1, "#5a4438");
  R.m = SKY; R.rect(0, gy + 2, W, 2, (x, y) => molten(x, y, 0.12 + 0.88 * clamp01(Math.abs(x - cx) / (W * 0.3) - 0.35)));
  R.m = SKY; for (let x = 0; x < W; x++) { const y = Math.round(H * 0.9 + Math.sin(x * 0.03) * 2); R.rect(x, y, 1, 3, molten(x, y, 0.9)); }
  R.glow(cx, H * 0.91, W * 0.6, 10, "#801c04", 0.4); R.light(cx, H * 0.92, W * 0.6, "#ff5010", 0.7, 18);
  // 天井から垂れる鎖とフック
  for (const [x, l] of [[W * 0.3, H * 0.3], [W * 0.38, H * 0.18], [W * 0.62, H * 0.22], [W * 0.7, H * 0.36]]) { chainV(R, x, H * 0.08, H * 0.08 + l, "#6a5a54"); R.m = SURF; R.line(x, H * 0.08 + l, x, H * 0.08 + l + 3, "#4a4444"); R.line(x, H * 0.08 + l + 3, x + 3, H * 0.08 + l + 1, "#4a4444"); }
  // 金床と槌 (左下)、水桶 (右下)
  const ax = W * 0.27, ay = H * 0.9; R.m = SURF;
  R.poly([[ax - 14, ay - 12], [ax + 12, ay - 12], [ax + 18, ay - 9], [ax + 6, ay - 8], [ax + 4, ay - 3], [ax + 8, ay], [ax - 8, ay], [ax - 5, ay - 3], [ax - 7, ay - 8]], "#2a2626"); R.rect(ax - 14, ay - 12, 26, 1, "#6a5a50");
  R.line(ax - 4, ay - 13, ax + 8, ay - 22, "#3a2818", 1, 2); R.rect(ax + 6, ay - 25, 6, 4, "#3a3634");
  R.rect(W * 0.66, H * 0.84, 16, 12, tex("#3a2a1c", "#22180e", 0.5, 2)); R.rect(W * 0.66, H * 0.84, 16, 1, "#7a5a3a"); R.rect(W * 0.66 + 1, H * 0.85, 14, 1, "#203038");
  A.pulse((P) => { P.glow(fx + 6, H * 0.56, 50, 46, "#c04a10", 0.35); P.glow(kx - 14, gy, 30, 18, "#c05010", 0.3); }, (t) => 0.5 + 0.35 * Math.sin(t * 0.0017) + 0.15 * Math.sin(t * 0.0061));
  A.special = sparks([[0.27, 0.86, 1], [0.79, 0.6, -1]], "#ffd070");
  A.part({ n: 26, col: "#ff9a40", x0: 0.02, x1: 0.98, y0: 0.05, y1: 0.95, vy: -0.05, sway: 10, swf: 0.5, a: 0.65, tw: 2.5 });
}
// 火花: 発生源から放物線を描いて飛び、落ちて消える (決定的)
function sparks(srcs, col) {
  return (ctx, w, h, t) => {
    ctx.fillStyle = col;
    for (let s = 0; s < srcs.length; s++) {
      const [sx, sy, dir] = srcs[s];
      for (let i = 0; i < 9; i++) {
        const per = 1400 + hash(i, s, 1) * 900, ph = (t / per + hash(i, s, 2)) % 1, cyc = Math.floor(t / per + hash(i, s, 2));
        const vx = (hash(i, cyc, 3) - 0.3) * 90 * dir, vy = -60 - hash(i, cyc, 4) * 70, tt = ph * 1.1;
        const x = sx * w + vx * tt, y = sy * h + vy * tt + 120 * tt * tt;
        ctx.globalAlpha = 0.9 * (1 - ph);
        ctx.fillRect(Math.round(x / 2) * 2, Math.round(y / 2) * 2, 2, 2);
      }
    }
  };
}

// 層 16 深淵の聖堂: 尖頭アーチの身廊、穢れて光るバラ窓と縦長の色硝子、斜めの光の帯、会衆席
function sCathedral(R, A) {
  const { w: W, h: H } = R, gy = Math.round(H * 0.6), cx = W / 2;
  R.amb = [0.4, 0.38, 0.36];
  bricks(R, 0, 0, W, gy, "#24221e", "#0e0d0b", 14, 6, 9);
  R.m = SURF; R.rect(0, 0, W, gy, (x, y) => (Math.abs(x - cx) < W * 0.24 ? C("#000000") : null), 0.35);
  const glass = ["#7a1020", "#4a2070", "#a08020", "#203a6a", "#5a1050", "#802818"];
  const panes = [];
  // バラ窓
  const rx = cx, ry = Math.round(H * 0.15), rr = Math.round(W * 0.11);
  R.m = SURF; R.ellipse(rx, ry, rr + 4, rr + 4, "#3a362e");
  const roseFn = (x, y) => { const dx = x + 0.5 - rx, dy = y + 0.5 - ry, d = Math.hypot(dx, dy) / rr, a = Math.atan2(dy, dx); const seg = Math.floor(((a + Math.PI) / TAU) * 12); if (d > 0.97 || (d > 0.32 && d < 0.38)) return C("#141210"); if (d > 0.38 && Math.abs(((a + Math.PI) / TAU) * 12 - seg - 0.5) > 0.42) return C("#141210"); return mul(C(glass[(seg + (d < 0.35 ? 3 : 0)) % glass.length]), 0.4 + 0.3 * vnoise(x * 0.5, y * 0.5, 4)); };
  R.m = SKY; R.ellipse(rx, ry, rr, rr, roseFn); panes.push(["e", rx, ry, rr]);
  R.m = SURF; R.line(rx - rr * 0.6, ry - rr * 0.3, rx + rr * 0.1, ry + rr * 0.7, "#141210"); // ひび
  // 縦長の色硝子 (左右)
  for (const lx of [W * 0.08, W * 0.92]) {
    archFrame(R, lx, H * 0.08, 7, H * 0.5, 3, "#3a362e", null, 0.6);
    const pts = archPts(lx, H * 0.08, 7, H * 0.5, 0.6); panes.push(["p", pts]);
    R.m = SKY; R.poly(pts, (x, y) => { const k = Math.floor(y / 6) + Math.floor(x / 4); return ((y % 6 === 0) || (x - Math.round(lx)) === 0) ? C("#141210") : mul(C(glass[k % glass.length]), 0.5 + 0.3 * vnoise(x, y * 0.3, 2)); });
  }
  // 光の帯 (窓から床へ)
  R.m = ADD;
  const shaft = (x0, x1, y0, dx, k) => { for (let y = y0; y < H * 0.95; y++) { const t = (y - y0) / (H - y0), f = (1 - t) * k; R.span(y, x0 + dx * t * H, x1 + dx * t * H, (px) => mul(C("#e0c890"), Math.floor(f * 30 + bayer(px, y)) / 30), 1); } };
  shaft(rx - 12, rx + 4, ry + rr, -0.45, 0.05); shaft(rx - 2, rx + 12, ry + rr, 0.45, 0.05);
  shaft(W * 0.08 - 6, W * 0.08 + 6, H * 0.5, 0.5, 0.06); shaft(W * 0.92 - 6, W * 0.92 + 6, H * 0.5, -0.5, 0.06);
  R.light(W * 0.12, H * 0.8, 60, "#e0b890", 0.6, 30); R.light(W * 0.88, H * 0.8, 60, "#e0b890", 0.6, 30);
  // 身廊の束ね柱と尖頭リブ
  for (const px of [W * 0.2, W * 0.8 - 10]) { column(R, px, 0, gy + 8, 10, "#3e3a32", { base: true }); R.m = SURF; R.rect(px + 3, 0, 1, gy, "#1a1814"); R.rect(px + 7, 0, 1, gy, "#1a1814"); }
  R.m = SURF; const rib = archPts(cx, -10, W * 0.3, H * 0.4, 0.6, 20);
  for (let i = 1; i < rib.length - 2; i++) R.line(rib[i][0], rib[i][1], rib[i + 1][0], rib[i + 1][1], "#3e3a32", 1, 3);
  // 奥の祭壇 (かすか)
  R.m = SURF; R.rect(cx - 12, gy - 8, 24, 8, "#1c1a16"); R.rect(cx - 12, gy - 8, 24, 1, "#3a362e"); R.rect(cx - 1, gy - 22, 2, 14, "#2a2620"); R.rect(cx - 5, gy - 18, 10, 2, "#2a2620");
  for (const ax of [cx - 9, cx + 9]) { R.rect(ax, gy - 12, 1, 4, "#c8c0a0"); flame(R, A, ax + 0.5, gy - 12, 0.9, "#fff0c0", "#ffb060", true, 30, 0.5); }
  // 床: 市松の大理石 (遠近)
  R.m = SURF; for (let y = gy; y < H; y++) { const z = 30 / (y - gy + 6), row = Math.floor(z * 8); R.span(y, 0, W, (x) => { const u = Math.floor(((x - cx) * z) / 6); return ((u + row) & 1) ? C("#24211c") : C("#141210"); }); }
  // 会衆席 (左右・手前ほど大きい)
  for (let k = 0; k < 5; k++) {
    const t = k / 4, y = gy + 6 + (H - gy - 6) * Math.pow(t, 1.3), hgt = 4 + t * 8, len = W * (0.12 + t * 0.16);
    for (const s of [-1, 1]) { const x0 = s < 0 ? -2 : W - len + 2; R.m = SURF; R.rect(x0, y - hgt, len, hgt * 0.45, "#2e2016"); R.rect(x0, y - hgt, len, 1, "#7a5634"); R.rect(x0, y - hgt * 0.4, len, hgt * 0.4, "#1a110b"); R.rect(x0, y - hgt * 0.55, len, 1, "#5a3e26"); for (let px = x0 + 6; px < x0 + len; px += 14) R.rect(px, y - hgt, 1, hgt, "#140d09"); }
  }
  A.pulse((P) => { P.m = ADD; P.ellipse(rx, ry, rr, rr, (x, y) => mul(roseFn(x, y), 0.5)); for (const p of panes) if (p[0] === "p") P.poly(p[1], "#5a3040", 0.5); P.glow(rx, ry, rr * 2, rr * 1.6, "#6a2040", 0.25); }, (t) => 0.3 + 0.3 * Math.sin(t * 0.0009));
  A.part({ n: 16, col: "#f0e0a0", x0: 0.32, x1: 0.68, y0: 0.3, y1: 0.95, vy: 0.008, sway: 8, swf: 0.2, a: 0.4, tw: 1 });
  A.part({ n: 10, col: "#f0e0a0", x0: 0.04, x1: 0.2, y0: 0.5, y1: 0.95, vy: 0.008, sway: 6, swf: 0.2, a: 0.35, tw: 1, seed: 3 });
  A.part({ n: 10, col: "#f0e0a0", x0: 0.8, x1: 0.96, y0: 0.5, y1: 0.95, vy: 0.008, sway: 6, swf: 0.2, a: 0.35, tw: 1, seed: 4 });
}

// 層 17 凍てつく王墓: 王の石棺と横たわる像、凍りついた王と騎士の像、霜の柱、凍てた王旗
function sTomb(R, A) {
  const { w: W, h: H } = R, gy = Math.round(H * 0.58), cx = W / 2;
  R.amb = [0.5, 0.58, 0.7];
  bricks(R, 0, 0, W, gy, "#2a323c", "#10141a", 14, 7, 6);
  R.m = SURF; R.rect(0, 0, W, gy, (x, y) => (fbm(x * 0.06, y * 0.08, 4) + (1 - y / gy) * 0.2 + Math.abs(x / W - 0.5) * 0.3 > 0.78 && ((x + y) & 1) ? C("#b8d4e8") : null), 0.22); // 霜
  R.rect(0, 0, W, gy, (x, y) => (Math.abs(x - cx) < W * 0.26 ? C("#000000") : null), 0.3);
  const gold = "#a08840";
  // 封印された王墓の扉と紋章
  R.m = SURF; R.rect(cx - 20, H * 0.24, 40, gy - H * 0.24, "#1c232c"); R.rect(cx - 20, H * 0.24, 40, 1, "#4a5a6a"); R.rect(cx, H * 0.26, 1, gy - H * 0.26, "#0c1014");
  R.poly([[cx - 24, H * 0.24], [cx, H * 0.14], [cx + 24, H * 0.24]], "#2a3440"); R.line(cx - 24, H * 0.24, cx, H * 0.14, gold, 0.6); R.line(cx, H * 0.14, cx + 24, H * 0.24, gold, 0.6);
  R.poly([[cx - 4, H * 0.19], [cx - 4, H * 0.16], [cx - 2, H * 0.175], [cx, H * 0.155], [cx + 2, H * 0.175], [cx + 4, H * 0.16], [cx + 4, H * 0.19]], gold, 0.7); // 王冠
  // 凍てた王旗
  for (const bx of [W * 0.33, W * 0.67]) { banner(R, bx - 6, H * 0.08, 12, 36, "#1a2a5a", 11 + bx, gold); R.m = SURF; R.rect(bx - 6, H * 0.08 + 33, 12, 3, "#c8e0f0", 0.4); R.poly([[bx - 2, H * 0.2], [bx - 2, H * 0.17], [bx, H * 0.185], [bx + 2, H * 0.17], [bx + 2, H * 0.2]], gold, 0.8); }
  // 霜の角柱 + 氷の鞘 + つらら
  for (const px of [W * 0.18, W * 0.82 - 12]) {
    column(R, px, H * 0.1, gy + 6, 12, "#4a5866", { cap: true, base: true });
    R.m = SKY; R.rect(px - 1, gy - 26, 14, 32, (x, y) => mix(C("#3a6a88"), C("#a8d8f0"), vnoise(x * 0.3, y * 0.1, 3)), 0.45);
    R.m = SURF; R.rect(px - 3, H * 0.1 - 5, 18, 2, "#d8ecf8"); for (let i = 0; i < 6; i++) spike(R, px - 2 + i * 3, H * 0.1 - 1, 3 + hash(i, px | 0, 2) * 7, 2, "#b8dcf0", 1, 1.2);
  }
  // 凍りついた像 (左: 剣を掲げる王, 右: 槍の騎士)
  const statue = (x, s, sd) => {
    const st = (px, py) => mul(mix(C("#5a6a78"), C("#a8c0d0"), vnoise(px * 0.3, py * 0.2, sd) * 0.6 + (s < 0 ? 0.3 : 0)), 0.8);
    R.m = SURF; R.rect(x - 10, H * 0.66, 20, 8, "#34404c"); R.rect(x - 10, H * 0.66, 20, 1, "#7a90a0");
    R.poly([[x - 6, H * 0.66], [x - 7, H * 0.4], [x - 5, H * 0.3], [x + 5, H * 0.3], [x + 7, H * 0.4], [x + 6, H * 0.66]], st);
    R.ellipse(x, H * 0.26, 4, 4.5, st); R.poly([[x - 4, H * 0.23], [x - 4, H * 0.19], [x - 2, H * 0.21], [x, H * 0.18], [x + 2, H * 0.21], [x + 4, H * 0.19], [x + 4, H * 0.23]], s < 0 ? gold : st);
    R.line(x - s * 8, H * 0.6, x - s * 8, H * 0.08, "#8a9aa8", 1, 2); R.rect(x - s * 8 - 3, H * 0.5, 7, 2, "#6a7a88");
    R.rect(x - 6, H * 0.3, 12, 2, "#d8ecf8", 0.6);
  };
  statue(W * 0.045, -1, 3); statue(W * 0.955, 1, 4);
  // 床: 霜の敷石
  ground(R, gy, "#28323c", "#10161c", 4, 0.08, 0.25);
  perspGrid(R, gy, cx, gy - 40, "#121820", 0.7, 7, 5);
  R.m = SURF; R.rect(0, gy, W, 1, "#5a6a7a");
  // 石棺 (左右手前): 横たわる王の像
  for (const s of [-1, 1]) {
    const x0 = s < 0 ? W * 0.02 : W * 0.7, x1 = s < 0 ? W * 0.3 : W * 0.98, top = H * 0.78;
    R.m = SURF; R.rect(x0 - 3, top + 14, x1 - x0 + 6, 6, "#222a32"); R.rect(x0 - 3, top + 14, x1 - x0 + 6, 1, "#5a6a7a");
    R.rect(x0, top, x1 - x0, 14, tex("#3a4654", "#2a323c", 0.2, 3)); R.rect(x0, top + 3, x1 - x0, 1, gold, 0.6); R.rect(x0, top + 11, x1 - x0, 1, gold, 0.5);
    R.rect(x0 - 1, top - 3, x1 - x0 + 2, 3, "#566676"); R.rect(x0 - 1, top - 3, x1 - x0 + 2, 1, "#c8dcec");
    const hx = s < 0 ? x0 + 6 : x1 - 6, dir = s < 0 ? 1 : -1;
    R.ellipse(hx, top - 5, 3.5, 3, "#7a8a9a"); R.rect(hx - 3, top - 9, 7, 2, gold);
    R.poly([[hx + dir * 4, top - 3], [hx + dir * 4, top - 8], [x1 - (x1 - x0) * (s < 0 ? 0.1 : 0.9), top - 6], [x1 - (x1 - x0) * (s < 0 ? 0.08 : 0.92), top - 3]], "#6a7a8a");
    R.line(hx + dir * 8, top - 8, hx + dir * (x1 - x0 - 16), top - 8, "#a8b8c8"); R.rect(hx + dir * 10 - 1, top - 10, 3, 3, gold, 0.8);
    R.rect(x0, top - 3, x1 - x0, 1, "#e8f4ff", 0.35);
  }
  // 青い鬼火の燭台
  for (const x of [W * 0.26, W * 0.74]) { R.m = SURF; R.rect(x - 3, H * 0.4, 7, 2, "#3a4652"); R.rect(x, H * 0.4, 1, 6, "#3a4652"); flame(R, A, x + 0.5, H * 0.4, 1.8, "#e0f8ff", "#60a8e0", true, 60, 0.9); }
  fogBand(R, H * 0.66, 12, "#6a8aa0", 0.18, 5);
  A.fog("#c0d8f0", 0.68, 4, 0.08, 3, 120, 10);
  A.part({ n: 28, col: "#e8f4ff", x0: 0, x1: 1, y0: 0, y1: 1, vy: 0.012, vx: -0.002, sway: 12, swf: 0.25, a: 0.45 });
  A.part({ n: 14, col: "#ffffff", x0: 0.02, x1: 0.98, y0: 0.05, y1: 0.95, a: 0.85, blink: 0.5, seed: 9 });
}

// 層 18 冥府の門: 髑髏を刻んだ巨大な門柱と門扉、渡された鎖、霊火の篝火、手前を流れる魂の川
function sHadesGate(R, A) {
  const { w: W, h: H } = R, gy = Math.round(H * 0.6), cx = W / 2, rv = Math.round(H * 0.85);
  R.amb = [0.42, 0.36, 0.5];
  R.m = SURF; R.rect(0, 0, W, gy, (x, y) => mix(C("#120d18"), C("#1e1626"), fbm(x * 0.05, y * 0.08, 3)));
  const stone = (x, y) => mul(C("#2e2636"), 0.8 + 0.35 * vnoise(x * 0.25, y * 0.25, 5));
  // 門扉 (中央、わずかに開いて冥府の光が漏れる)
  const dt = Math.round(H * 0.15);
  R.m = SURF; R.rect(W * 0.2, dt, W * 0.6, gy - dt, (x, y) => { const lx = (x - W * 0.2) % (W * 0.1), ly = (y - dt) % 18; return mul(C("#1e1824"), (lx < 1 || ly < 1 ? 0.6 : lx < 2 || ly < 2 ? 1.3 : 1) * (0.85 + 0.25 * vnoise(x * 0.2, y * 0.1, 7))); });
  for (let x = W * 0.22; x < W * 0.8; x += W * 0.05) for (let y = dt + 6; y < gy; y += 18) { R.px(x, y, "#5a4a6a"); R.px(x + 1, y + 1, "#0a080c"); }
  R.m = SKY; R.rect(cx - 1, dt, 2, gy - dt, "#7a5aa8"); R.rect(cx, dt, 1, gy - dt, "#c8a8f0", 0.6); R.glow(cx, (dt + gy) / 2, 14, (gy - dt) * 0.7, "#4a2a70", 0.35);
  R.light(cx, gy, 50, "#a070e0", 0.5, 20);
  // 門柱 (左右) と髑髏の浮彫
  for (const s of [-1, 1]) {
    const x0 = s < 0 ? 0 : W * 0.8, x1 = s < 0 ? W * 0.2 : W;
    R.m = SURF; R.rect(x0, 0, x1 - x0, gy + 4, stone); R.rect(s < 0 ? x1 - 2 : x0, 0, 2, gy + 4, s < 0 ? "#120e16" : "#4a3e56");
    for (let y = H * 0.18; y < gy - 8; y += 14) { const kx = (x0 + x1) / 2 - 5; R.rect(kx - 2, y - 2, 14, 14, "#1e1826"); skull(R, kx, y, "#6a5e72", "#0a080c", 2); }
    for (const gxx of [x0 + 4, x1 - 6]) R.rect(gxx, H * 0.15, 2, gy - H * 0.15, "#1a1420");
  }
  // まぐさ石と角のある髑髏の要石
  R.m = SURF; R.rect(0, 0, W, dt, stone); R.rect(0, dt - 2, W, 2, "#0e0a12"); R.rect(0, dt - 4, W, 1, "#4a3e56");
  R.poly([[cx - 16, 2], [cx - 30, -8], [cx - 18, 8]], "#4a3e40"); R.poly([[cx + 16, 2], [cx + 30, -8], [cx + 18, 8]], "#4a3e40");
  R.rect(cx - 12, 1, 24, dt + 4, "#2a2232"); skull(R, cx - 10, 3, "#8a7e86", "#050306", 4);
  R.m = SKY; R.rect(cx - 6, 11, 4, 3, "#c070ff"); R.rect(cx + 2, 11, 4, 3, "#c070ff"); R.glow(cx, 12, 20, 12, "#6a2aa0", 0.4);
  A.flick(cx - 4, 12, 8, "#c070ff", 0.35, 0.5); A.flick(cx + 4, 12, 8, "#c070ff", 0.35, 0.5);
  // 門扉に渡された鎖
  chainSag(R, W * 0.18, H * 0.3, W * 0.82, H * 0.3, H * 0.12, "#4a4250", 1); chainSag(R, W * 0.18, H * 0.48, W * 0.82, H * 0.48, H * 0.06, "#3e3646", 1);
  R.m = SURF; R.rect(cx - 5, H * 0.38, 10, 9, "#3a3242"); R.rect(cx - 3, H * 0.36, 6, 3, "#3a3242"); R.rect(cx - 2, H * 0.37, 4, 2, "#0e0a12"); R.px(cx, H * 0.42, "#0e0a12");
  // 地面と魂の川
  ground(R, gy, "#1c1622", "#0e0b12", 4, 0.1, 0.3);
  R.m = SURF; R.rect(0, gy, W, 1, "#3a3046"); R.rect(0, rv - 2, W, 2, "#2e2638"); R.rect(0, rv - 2, W, 1, "#4a3e56");
  const river = (x, y, k = 1) => mul(mix(C("#2a2050"), C("#a0c0e8"), clamp01(fbm(x * 0.04, y * 0.3, 8) * 1.8 - 0.55)), k);
  R.m = SKY; R.rect(0, rv, W, H - rv, (x, y) => river(x, y, 0.75));
  R.glow(cx, rv + 4, W * 0.7, 14, "#3a3070", 0.3);
  // 霊火の篝火 (門柱の足元)
  for (const bx of [W * 0.1, W * 0.9]) {
    R.m = SURF; R.poly([[bx - 9, gy - 4], [bx + 9, gy - 4], [bx + 6, gy + 2], [bx - 6, gy + 2]], "#3a3442"); R.rect(bx - 9, gy - 4, 18, 1, "#6a5a7a");
    R.line(bx - 5, gy + 2, bx - 8, H * 0.76, "#2a2432", 1, 2); R.line(bx + 5, gy + 2, bx + 8, H * 0.76, "#2a2432", 1, 2);
    flame(R, A, bx, gy - 4, 4, "#e0f8ff", "#7a60e0", true, 80, 1.1);
  }
  A.special = (ctx, w, h, t) => { // 川の流れ (横へ流れる光の筋)
    ctx.fillStyle = "#d8e8ff";
    for (let i = 0; i < 14; i++) {
      const sp = 14 + hash(i, 1, 6) * 16, x = (((hash(i, 2, 6) * (w + 60) + (t / 1000) * sp) % (w + 60)) - 30), y = (0.87 + hash(i, 3, 6) * 0.12) * h, l = 6 + hash(i, 4, 6) * 14;
      ctx.globalAlpha = 0.18 + 0.12 * Math.sin(t * 0.002 + i); ctx.fillRect(Math.round(x / 2) * 2, Math.round(y / 2) * 2, Math.round(l / 2) * 2, 2);
    }
  };
  A.part({ n: 14, col: "#c8e0ff", x0: 0.02, x1: 0.98, y0: 0.35, y1: 0.95, vy: -0.035, sway: 10, swf: 0.4, a: 0.5, halo: 0.2, tw: 1 });
  A.part({ n: 6, col: "#d0b0ff", x0: 0.47, x1: 0.53, y0: 0.15, y1: 0.6, vy: -0.02, sway: 6, swf: 0.5, a: 0.3, tw: 1.3, seed: 4 });
}

// 層 19 竜の巣: 焼け焦げた岩壁と赤い噴気孔、巨大な肋骨の弧、竜の頭骨、財宝の山と卵
function sDragonNest(R, A) {
  const { w: W, h: H } = R, gy = Math.round(H * 0.58), cx = W / 2;
  R.amb = [0.4, 0.3, 0.27];
  R.m = SURF; R.rect(0, 0, W, gy, (x, y) => mul(mix(C("#2a1610"), C("#3e2418"), fbm(x * 0.05, y * 0.08, 6)), vnoise(x * 0.1, y * 0.1, 2) > 0.65 ? 0.55 : 1));
  // 岩壁の灼けた裂け目 (縦にのびる赤熱の亀裂)
  for (const [x, y, l, sd] of [[W * 0.08, H * 0.08, 34, 1], [W * 0.3, H * 0.2, 20, 2], [W * 0.7, H * 0.16, 24, 3], [W * 0.93, H * 0.12, 30, 4]]) {
    const q = rnd(sd); let px = x, py = y; R.m = SKY;
    for (let i = 0; i < l / 3; i++) { const nx = px + (q() - 0.5) * 1.6, ny = py + 3, w = 1 + (i > 1 && i < l / 3 - 2 ? 1 : 0); R.rect(Math.round(nx), Math.round(py), w, 3, i % 4 ? "#b02a0c" : "#ff7a30"); R.glow(px, py, 7, 5, "#701804", 0.25, 3); px = nx; py = ny; }
  }
  ground(R, gy, "#332016", "#110a07", 6, 0.1, 0.35);
  // 巨竜の肋骨: 骸の内側から背骨の方向を見通す構図。手前ほど大きな骨の弧が奥へ連なる
  const bone = (k) => (x, y) => mul(mix(C("#5a4a38"), C("#b0a080"), clamp01(vnoise(x * 0.2, y * 0.15, 4) * 0.7 + 0.25)), k);
  const vpY = H * 0.16;
  for (let k = 4; k >= 0; k--) {
    const sc = 1 - k * 0.19, top = vpY - H * 0.34 * sc, floor = gy + (H - gy) * 0.9 * sc - (1 - sc) * 8;
    const rx = W * 0.5 * sc * 1.02, ry = (floor - top) * 0.62, th = Math.max(2, 9 * sc), dim = 0.45 + 0.55 * sc;
    for (const s of [-1, 1]) {
      let px = cx + s * 2, py = top;
      for (let i = 1; i <= 18; i++) {
        const th0 = -Math.PI / 2 + (i / 18) * (Math.PI / 2 + 0.55), x = cx + s * (2 + rx * Math.cos(th0)), y = top + ry + ry * Math.sin(th0);
        const tt = th * (0.55 + 0.45 * (i / 18));
        R.m = SURF; R.taper(px, py, x, y, tt, tt, bone(dim));
        R.taper(px + s * tt * 0.3, py, x + s * tt * 0.3, y, 1.2, 1.2, mul(C("#d8c8a0"), dim * 0.9));
        px = x; py = y;
      }
    }
    R.m = SURF; R.ellipse(cx, top + 1, th * 0.9, th * 0.6, bone(dim * 1.05)); R.rect(cx - 1, top - th * 0.9, 2, th * 0.6, bone(dim)); // 椎骨
  }
  // 床: 爪痕
  R.m = SURF; for (let i = 0; i < 4; i++) R.line(W * 0.36 + i * 4, H * 0.66, W * 0.3 + i * 4, H * 0.76, "#0a0503", 1);
  // 財宝の山 (左下) と卵
  const goldC = (x, y) => { const n = vnoise(x * 0.6, y * 0.6, 3); return mix(C("#5a3a10"), C("#d0a040"), clamp01(n * 1.4 - 0.2)); };
  R.m = SURF; R.ellipse(W * 0.14, H * 1.02, W * 0.2, H * 0.2, goldC); R.ellipse(W * 0.32, H * 1.02, W * 0.1, H * 0.1, goldC); R.ellipse(W * 0.9, H * 0.66, W * 0.07, H * 0.05, goldC); R.ellipse(W * 0.1, H * 0.64, W * 0.06, H * 0.04, goldC);
  R.line(W * 0.2, H * 0.86, W * 0.24, H * 0.72, "#8a8a90", 1, 2); R.rect(W * 0.2 - 3, H * 0.84, 8, 2, "#c09030");
  R.rect(W * 0.07, H * 0.84, 6, 4, "#c09030"); R.rect(W * 0.08, H * 0.88, 4, 3, "#a07020"); R.rect(W * 0.07, H * 0.84, 6, 1, "#ffe080");
  for (let i = 0; i < 3; i++) { const ex = W * 0.32 + i * 7, ey = H * 0.82 - (i === 1 ? 3 : 0); R.m = SURF; R.ellipse(ex, ey, 4, 6, "#2a1a14"); R.m = SKY; R.line(ex - 1, ey - 4, ex + 1, ey + 2, "#e04010"); R.glow(ex, ey, 8, 9, "#601808", 0.3); }
  R.light(W * 0.15, H * 0.9, 60, "#ffc060", 0.7, 30); R.light(W * 0.8, H * 0.8, 60, "#ff6030", 0.5, 30);
  // 竜の頭骨 (右下)
  const sx = W * 0.8, sy = H * 0.86; R.m = SURF;
  const sk = bone(1.05);
  R.poly([[sx - 30, sy + 4], [sx - 34, sy - 4], [sx - 14, sy - 14], [sx + 10, sy - 20], [sx + 26, sy - 16], [sx + 34, sy - 2], [sx + 30, sy + 10], [sx - 4, sy + 10]], sk);
  R.poly([[sx + 18, sy - 18], [sx + 40, sy - 34], [sx + 32, sy - 14]], bone(0.85)); R.poly([[sx + 6, sy - 19], [sx + 20, sy - 40], [sx + 16, sy - 18]], bone(0.95));
  R.line(sx - 32, sy - 4, sx - 12, sy - 14, "#d8c8a0", 0.8); R.line(sx - 12, sy - 14, sx + 10, sy - 20, "#d8c8a0", 0.8);
  R.ellipse(sx + 12, sy - 8, 5, 4, "#0a0503"); R.m = SKY; R.px(sx + 12, sy - 8, "#ff4010", 0.7); R.m = SURF;
  R.ellipse(sx - 26, sy - 4, 2, 1.5, "#0a0503");
  for (let i = 0; i < 7; i++) R.poly([[sx - 28 + i * 5, sy + 4], [sx - 26 + i * 5, sy + 9], [sx - 24 + i * 5, sy + 4]], "#d8c8a8");
  R.rect(sx - 30, sy + 3, 50, 1, "#140a06");
  A.part({ n: 28, col: "#ff8030", x0: 0, x1: 1, y0: 0.1, y1: 0.95, vy: -0.045, sway: 10, swf: 0.5, a: 0.7, tw: 2.4 });
  A.part({ n: 14, col: "#ffe890", x0: 0.0, x1: 0.36, y0: 0.82, y1: 1, a: 0.9, blink: 0.8, seed: 7 });
  A.part({ n: 6, col: "#ffe890", x0: 0.82, x1: 0.97, y0: 0.6, y1: 0.7, a: 0.8, blink: 0.7, seed: 8 });
}

// 層 20 終焉の玄室: 虚無の星海、空に渦巻く魂の螺旋、宙に浮く折れた柱、遠い玉座、崩れゆく足場
function sThrone(R, A) {
  const { w: W, h: H } = R, gy = Math.round(H * 0.58), cx = W / 2, sx = cx, sy = Math.round(H * 0.17);
  R.amb = [0.42, 0.36, 0.5];
  R.m = SKY; R.vgrad(0, 0, W, H, [[0, "#04020a"], [0.5, "#0c0716"], [1, "#05030a"]]);
  R.m = ADD; R.rect(0, 0, W, H, (x, y) => { const n = fbm(x * 0.02, y * 0.035, 12), m = fbm(x * 0.03 + 9, y * 0.02, 4); return mix(mul(C("#4a1a6a"), clamp01(n * 1.6 - 0.75) * 0.6), mul(C("#123a4a"), clamp01(m * 1.6 - 0.8) * 0.5), 0.5); });
  stars(R, 81, 120, H, "#d8c8f0");
  // 魂の螺旋 (腕の淡い光)
  R.m = ADD; for (let arm = 0; arm < 3; arm++) for (let s = 0; s < 1; s += 0.004) { const a = arm * TAU / 3 + s * 5.5, r = 4 + s * W * 0.32; R.px(sx + Math.cos(a) * r, sy + Math.sin(a) * r * 0.42, "#8a60c0", 0.35 * (1 - s)); }
  R.glow(sx, sy, 34, 16, "#a070e0", 0.5);
  // 浮かぶ柱の断片
  const frag = (x, y, w, h, rot, k) => {
    const cs = Math.cos(rot), sn = Math.sin(rot), pts = [[-w / 2, -h / 2], [w / 2, -h / 2 + 2], [w / 2, h / 2], [w * 0.1, h / 2 + 3], [-w / 2, h / 2 - 1]].map(([u, v]) => [x + u * cs - v * sn, y + u * sn + v * cs]);
    R.m = SURF; R.poly(pts.map(([a, b]) => [a + 1, b - 1]), mul(C("#7a5aa0"), k));
    R.poly(pts, (px, py) => { const u = (px - x) * cs + (py - y) * sn; return mul(C("#3a3048"), k * (u < -w / 4 ? 1.2 : u < w / 4 ? 0.95 : 0.65) * (0.85 + 0.3 * vnoise(px * 0.4, py * 0.2, 3))); });
  };
  frag(W * 0.07, H * 0.34, 14, 46, 0.25, 1); frag(W * 0.2, H * 0.12, 8, 20, -0.4, 0.7); frag(W * 0.93, H * 0.38, 15, 52, -0.2, 1); frag(W * 0.8, H * 0.1, 9, 18, 0.5, 0.7);
  frag(W * 0.36, H * 0.06, 5, 10, 0.9, 0.45); frag(W * 0.66, H * 0.3, 4, 9, -0.7, 0.4);
  // 遠い玉座 (虚無の淡光を背負う)
  R.glow(cx, gy - 12, 30, 22, "#4a2a70", 0.3);
  R.m = SKY; const tc = C("#140e1c");
  R.rect(cx - 14, gy - 3, 28, 3, tc); R.rect(cx - 10, gy - 6, 20, 3, tc); R.rect(cx - 5, gy - 26, 10, 20, tc); R.rect(cx - 8, gy - 12, 16, 3, tc);
  R.poly([[cx - 5, gy - 26], [cx - 3, gy - 32], [cx - 1, gy - 26]], tc); R.poly([[cx - 1, gy - 26], [cx, gy - 35], [cx + 1, gy - 26]], tc); R.poly([[cx + 1, gy - 26], [cx + 3, gy - 32], [cx + 5, gy - 26]], tc);
  R.rect(cx - 5, gy - 26, 1, 20, "#5a3a80", 0.6);
  // 足場 (奥へ細る浮島。縁は崩れ、亀裂がかすかに光る)
  const plat = [[W * 0.18, gy], [W * 0.82, gy], [W * 1.12, H], [-W * 0.12, H]];
  R.m = SURF; R.poly(plat, (x, y) => { const z = 30 / (y - gy + 6), u = Math.floor(((x - cx) * z) / 7), v = Math.floor(z * 6); return mul(C(((u + v) & 1) ? "#221a2c" : "#1a1422"), 0.8 + 0.3 * vnoise(x * 0.2, y * 0.3, 7)); });
  R.m = SURF; R.line(W * 0.18, gy, -W * 0.12, H, "#4a3a5a", 0.8); R.line(W * 0.82, gy, W * 1.12, H, "#4a3a5a", 0.8); R.rect(W * 0.18, gy, W * 0.64, 1, "#3a2e48");
  for (const [x, y, l] of [[W * 0.1, H * 0.8, 20], [W * 0.86, H * 0.86, 24], [W * 0.3, H * 0.95, 14], [W * 0.68, H * 0.7, 10]]) { const q = rnd(x | 0); let px = x, py = y; R.m = SKY; for (let i = 0; i < 5; i++) { const nx = px + (q() - 0.5) * l * 0.5, ny = py + (q() - 0.3) * 4; R.line(px, py, nx, ny, "#8a5ac0", 0.7); px = nx; py = ny; } }
  for (const [x, y, s] of [[W * 0.04, H * 0.66, 4], [W * 0.95, H * 0.62, 3], [W * 0.12, H * 0.72, 2], [W * 0.9, H * 0.74, 2.5]]) { R.m = SURF; R.poly([[x - s, y], [x + s, y - s * 0.4], [x + s * 0.6, y + s], [x - s * 0.5, y + s * 0.8]], "#2a2234"); }
  A.special = (ctx, w, h, t) => { // 渦を巻いて中心へ吸い込まれる魂
    const cxx = (sx / W) * w, cyy = (sy / H) * h, ts = t / 1000;
    ctx.fillStyle = "#e0c8ff";
    for (let i = 0; i < 42; i++) {
      const arm = i % 3, s = (hash(i, 1, 20) - ts * 0.02 * (0.7 + hash(i, 2, 20) * 0.6)) % 1, ss = s < 0 ? s + 1 : s;
      const a = arm * TAU / 3 + ss * 5.5 + ts * 0.05, r = 8 + ss * w * 0.32;
      ctx.globalAlpha = 0.6 * Math.min(1, ss * 6) * (1 - ss * 0.6);
      ctx.fillRect(Math.round((cxx + Math.cos(a) * r) / 2) * 2, Math.round((cyy + Math.sin(a) * r * 0.42) / 2) * 2, 2, 2);
    }
  };
  A.part({ n: 22, col: "#b890e0", x0: 0, x1: 1, y0: 0.05, y1: 1, vy: -0.006, vx: 0.004, sway: 8, swf: 0.15, a: 0.35, tw: 0.8 });
  A.part({ n: 14, col: "#ffffff", x0: 0, x1: 1, y0: 0, y1: 0.55, a: 0.6, blink: 0.35, seed: 6 });
}

// 既定 (奈落・不明層): 果てしない闇、かすかな紫の奥光、消えてゆく床の格子、漂う塵
function sVoid(R, A) {
  const { w: W, h: H } = R, gy = Math.round(H * 0.6), cx = W / 2;
  R.m = SKY; R.rect(0, 0, W, H, (x, y) => mix(C("#1e1428"), C("#040306"), clamp01(Math.hypot((x - cx) / (W * 0.6), (y - H * 0.36) / (H * 0.6)))));
  R.m = ADD; R.rect(0, 0, W, gy, (x, y) => mul(C("#2a1a40"), clamp01(fbm(x * 0.03, y * 0.05, 3) * 1.4 - 0.6) * 0.6));
  stars(R, 99, 40, gy * 0.8, "#8a7aa8");
  R.m = SKY; R.vgrad(0, gy, W, H - gy, [[0, "#0e0a14"], [1, "#030205"]]);
  perspGrid(R, gy, cx, gy - 50, "#3a2a50", 0.4, 9, 6);
  R.m = SKY; R.rect(0, gy, W, 1, "#3a2a50", 0.6);
  A.part({ n: 30, col: "#b090e0", x0: 0, x1: 1, y0: 0, y1: 1, vy: -0.01, sway: 10, swf: 0.2, a: 0.35, tw: 0.9 });
}

const SCENES = [sVoid, sGraveyard, sWaterway, sMine, sFort, sForest, sTemple, sLava, sIce, sSwamp, sSpire,
  sArena, sCavern, sLibrary, sOssuary, sForge, sCathedral, sTomb, sHadesGate, sDragonNest, sThrone];

// =====================================================================
// 迷宮の顔 (出撃シートの上半分に出す、迷宮ごとの情景)
// 層の情景を土台に、その迷宮だけの見せ場 (地下へ降りる石段・取水口の鉄格子・雷雨・軍議の卓…) を中央へ描き足す。
// 戦闘背景と違って中央は空けない (敵が立たないので、迷宮の顔を真ん中に置く)。台帳に無い迷宮は層の情景だけ
function ghost(R, x, by, h, col, a = 0.5) { // 半透明の亡霊 (頭巾の影・ほつれた裾)
  const c = C(col), w = h * 0.42, pm = R.m;
  R.m = ADD;
  R.poly([[x - w * 0.3, by - h * 0.82], [x - w * 0.05, by - h], [x + w * 0.3, by - h * 0.84], [x + w * 0.45, by - h * 0.4], [x + w * 0.62, by - h * 0.06],
    [x + w * 0.22, by - h * 0.16], [x + w * 0.02, by], [x - w * 0.24, by - h * 0.14], [x - w * 0.58, by - h * 0.04], [x - w * 0.48, by - h * 0.42]],
  (px, py) => mul(c, a * (0.35 + 0.65 * clamp01((by - py) / h)) * (0.8 + 0.4 * vnoise(px * 0.5, py * 0.3, 3))));
  R.m = SKY; R.ellipse(x - w * 0.02, by - h * 0.8, w * 0.17, h * 0.07, "#020204", 0.9);
  R.glow(x, by - h * 0.55, w * 1.8, h * 0.75, col, a * 0.35, 4);
  R.m = pm;
}
function hooded(R, x, by, h, col, rim) { // 頭巾の人影 (祈る修道士・将の亡霊の影)
  const cb = C(col), w = h * 0.5;
  R.m = SURF;
  R.poly([[x - w * 0.5, by], [x - w * 0.42, by - h * 0.55], [x - w * 0.22, by - h * 0.92], [x + w * 0.05, by - h], [x + w * 0.3, by - h * 0.86], [x + w * 0.45, by - h * 0.5], [x + w * 0.52, by]],
    (px, py) => mul(cb, 0.8 + 0.3 * vnoise(px * 0.4, py * 0.25, 7)));
  if (rim) R.line(x + w * 0.3, by - h * 0.86, x + w * 0.5, by - h * 0.1, rim, 0.55);
  R.m = SKY; R.ellipse(x + w * 0.04, by - h * 0.78, w * 0.16, h * 0.08, "#020203");
  R.m = SURF;
}
// w01 忘れられた地下墓地: 丘に半ば埋もれた墓所の口。闇へ降りる石段と、脇に灯る角灯
function vCrypt(R, A) {
  const { w: W, h: H } = R, cx = W / 2, by = Math.round(H * 0.74);
  const stone = tex("#3e404a", "#202228", 0.2, 21);
  R.m = SURF;
  R.ellipse(cx, by + 3, 50, 10, "#16150f"); R.ellipse(cx, by + 1, 36, 6, "#1e1d17");
  // 霊廟の口: 三角破風 + 柱 + 半円の戸口
  R.poly([[cx - 30, by - 30], [cx, by - 44], [cx + 30, by - 30]], stone); R.line(cx, by - 44, cx + 30, by - 30, "#6a7690", 0.7);
  R.rect(cx - 31, by - 30, 62, 2, "#4a4c58"); R.rect(cx - 28, by - 28, 56, 28, stone);
  for (const dx of [-26, 20]) { R.rect(cx + dx, by - 28, 6, 28, "#34363e"); R.rect(cx + dx, by - 28, 1, 28, "#4a4c58"); }
  R.rect(cx + 27, by - 28, 1, 28, "#6a7690", 0.5);
  R.m = SKY; R.poly(archPts(cx, by - 24, 14, by), (x, y) => mix(C("#0c0806"), C("#020203"), clamp01((by - y) / 22)));
  R.m = SURF;
  for (let i = 0; i < 6; i++) { const y = by - 1 - i * 3, hw = 13 - i * 1.8; R.rect(cx - hw, y, hw * 2, 1, "#3e404a", 0.95 - i * 0.15); }
  skull(R, cx - 2, by - 40, "#6a6c78", "#16171d");
  R.glow(cx, by - 6, 12, 8, "#7a3a10", 0.35, 4);
  const lx = cx + 38, ly = by - 12;
  R.m = SURF; R.rect(lx, ly, 1, 14, "#1a1612"); R.rect(lx - 3, ly - 1, 7, 1, "#2a2620"); R.rect(lx - 2, ly - 7, 5, 6, "#2a2620");
  R.m = SKY; R.rect(lx - 1, ly - 6, 3, 4, "#ffd890");
  R.glow(lx + 0.5, ly - 4, 18, 18, "#c07a20", 0.45, 5); R.light(lx, ly - 4, 50, "#ffb050", 1.1, 40);
  A.flick(lx + 0.5, ly - 4, 12, "#ffb050", 0.4, 0.8);
}
// w02 亡骸の囁く回廊: 骨の回廊を漂う亡霊たちと、壁から漏れる囁き (淡い文字)
function vWhispers(R, A) {
  const { w: W, h: H } = R, cx = W / 2;
  ghost(R, cx - 4, H * 0.66, 22, "#7ab8c8", 0.45);
  ghost(R, cx + 30, H * 0.78, 36, "#8ac8d8", 0.5);
  ghost(R, cx - 40, H * 0.86, 44, "#7ab0c0", 0.42);
  R.light(cx, H * 0.6, 90, "#5a9ab0", 0.5, 60);
  A.part({ n: 22, col: "#a8e0f0", x0: 0.2, x1: 0.8, y0: 0.15, y1: 0.75, vx: 0.004, sway: 6, swf: 0.3, a: 0.45, tw: 1.1, rune: true, seed: 12 });
  A.fog("#8ab8c8", 0.82, 4, 0.1, 5, 110, 10);
}
// w03 朽ちた骸の修道院: 祭壇へ向かって祈り続ける頭巾の骸たちと、天井から垂れる骨の燭台
function vAbbey(R, A) {
  const { w: W, h: H } = R, cx = W / 2;
  const by = Math.round(H * 0.8);
  for (const [dx, dy, h] of [[-46, -10, 18], [-22, -12, 16], [24, -12, 16], [48, -10, 18], [-34, 4, 24], [36, 4, 24]]) hooded(R, cx + dx, by + dy, h, "#3a3428", "#8a8060");
  // 骨の燭台 (鎖で吊る輪 + 蝋燭)
  const ry = Math.round(H * 0.3);
  chainV(R, cx, 0, ry - 2, "#5a5040");
  R.m = SURF; R.ellipse(cx, ry, 20, 3, "#8a7c60"); R.ellipse(cx, ry - 1, 17, 1.6, "#1a1610");
  for (let i = -2; i <= 2; i++) { const x = cx + i * 8; R.rect(x, ry - 4, 1, 3, "#d0c8a8"); flame(R, A, x + 0.5, ry - 4, 1, "#fff4c0", "#ffb040", i % 2 === 0, i === 0 ? 70 : 0, 0.9); }
  for (let i = -3; i <= 3; i += 2) skull(R, cx + i * 6 - 2, ry + 1, "#b0a07c", "#1a1610");
  R.glow(cx, ry, 40, 20, "#7a5a20", 0.25, 5); R.light(cx, by - 10, 90, "#c09a60", 0.6, 40);
  A.part({ n: 16, col: "#9ab070", x0: 0.15, x1: 0.85, y0: 0.4, y1: 0.95, vy: -0.01, sway: 6, swf: 0.3, a: 0.3, tw: 1, seed: 4 });
}
// w04 黒水の取水口: 大アーチを塞ぐ鉄格子の取水口。格子の間から黒い水が滝のように落ちる
function vIntake(R, A) {
  const { w: W, h: H } = R, cx = W / 2, gy = Math.round(H * 0.57), aw = Math.round(W * 0.19), at = Math.round(H * 0.17);
  R.m = SKY; R.poly(archPts(cx, at + 4, aw - 4, gy + 2), (x, y) => mix(C("#05080a"), C("#0c1418"), vnoise(x * 0.4, y * 0.08, 6)));
  // 落ちる黒い水
  R.m = SKY; R.rect(cx - aw * 0.75, gy - 26, aw * 1.5, 30, (x, y) => (vnoise(x * 0.7, y * 0.06, 2) > 0.45 ? mix(C("#0e1c20"), C("#2a4a50"), vnoise(x * 0.9, y * 0.2, 5)) : C("#060a0c")));
  R.m = ADD; R.rect(cx - aw * 0.8, gy, aw * 1.6, 3, "#3a6a70", 0.6);
  // 鉄格子 (錆びて歪む)
  R.m = SURF; const ir = C("#2a2420");
  for (let x = cx - aw + 6; x <= cx + aw - 6; x += 6) {
    const top = at + 4 + (aw - Math.sqrt(Math.max(0, aw * aw - (x - cx) * (x - cx)))) * 1.05;
    R.rect(x, top, 2, gy - top, ir); R.rect(x, top, 1, gy - top, "#5a4030");
  }
  for (const y of [H * 0.3, H * 0.42, gy - 6]) R.rect(cx - aw + 2, y, aw * 2 - 4, 2, ir);
  R.rect(cx - aw + 2, H * 0.3, aw * 2 - 4, 1, "#6a4a34");
  // 取水口の銘板
  R.rect(cx - 12, at - 9, 24, 6, "#3a3226"); R.rect(cx - 12, at - 9, 24, 1, "#7a6a4a"); R.rect(cx - 9, at - 7, 18, 1, "#1a140c"); R.rect(cx - 7, at - 5, 14, 1, "#1a140c");
  A.part({ n: 18, col: "#5a8a90", x0: 0.32, x1: 0.68, y0: 0.42, y1: 0.58, vy: 0.5, a: 0.45, sz: 2, len: 3, seed: 21 });
}
// w05 鎖の垂れる坑口: 天井の梁から垂れる罪人の鎖と枷、坑口に打ち付けた封の板
function vChains(R, A) {
  const { w: W, h: H } = R, cx = W / 2;
  for (const [x, l] of [[W * 0.24, H * 0.42], [W * 0.31, H * 0.28], [W * 0.4, H * 0.36], [W * 0.6, H * 0.32], [W * 0.68, H * 0.44], [W * 0.76, H * 0.26]]) {
    chainV(R, x, H * 0.04, H * 0.04 + l, "#7a6a5a");
    const y = H * 0.04 + l; R.m = SURF; R.ellipse(x + 0.5, y + 3, 3, 2.5, "#5a4a3c"); R.ellipse(x + 0.5, y + 3, 1.6, 1.2, "#120c08");
  }
  chainSag(R, W * 0.31, H * 0.2, W * 0.6, H * 0.18, 10, "#6a5a4a");
  // 封の板 (坑口の上に×に打ち付けた板と、王家の封蝋)
  const py = Math.round(H * 0.28);
  R.m = SURF;
  R.taper(cx - 22, py - 8, cx + 22, py + 8, 5, 5, tex("#5a4228", "#3a2a18", 0.3, 3)); R.taper(cx - 22, py + 8, cx + 22, py - 8, 5, 5, tex("#5a4228", "#3a2a18", 0.3, 5));
  R.line(cx - 22, py + 6, cx + 22, py - 10, "#8a6a40", 0.6);
  R.ellipse(cx, py, 4, 4, "#7a1810"); R.ellipse(cx - 1, py - 1, 2, 2, "#b03020");
  A.part({ n: 12, col: "#a09080", x0: 0.2, x1: 0.8, y0: 0.05, y1: 0.6, vy: 0.02, sway: 4, swf: 0.4, a: 0.3, seed: 31 });
}
// w06 亡兵の守る外郭: 中庭に隊列を組んで並ぶ亡兵の影 (槍ぶすま)。眼だけが青く光る
function vRanks(R, A) {
  const { w: W, h: H } = R, cx = W / 2;
  const rows = [[H * 0.7, 9, 14, 0.75], [H * 0.8, 7, 19, 0.9], [H * 0.93, 5, 26, 1]];
  for (const [by, n, h, k] of rows) {
    const gap = h * 0.95;
    for (let i = 0; i < n; i++) {
      const x = cx + (i - (n - 1) / 2) * gap + (hash(i, by | 0, 3) - 0.5) * 2, w = h * 0.38;
      R.m = SURF;
      R.poly([[x - w * 0.5, by], [x - w * 0.45, by - h * 0.62], [x - w * 0.3, by - h * 0.8], [x - w * 0.18, by - h * 0.94], [x + w * 0.2, by - h * 0.94], [x + w * 0.32, by - h * 0.8], [x + w * 0.48, by - h * 0.62], [x + w * 0.5, by]],
        mul(C("#0e1016"), k));
      R.rect(x - w * 0.22, by - h * 0.98, w * 0.44, 2, mul(C("#2a2e3a"), k)); // 兜の縁
      R.m = SURF; R.line(x + w * 0.42, by - h * 0.4, x + w * 0.55, by - h * 1.6, mul(C("#2a2420"), k)); // 槍
      R.m = SKY; R.rect(x + w * 0.5, by - h * 1.68, 1, 3, mul(C("#9aa4c0"), k));
      R.m = ADD; R.rect(x - w * 0.14, by - h * 0.82, 1, 1, "#7ac8ff", 0.9 * k); R.rect(x + w * 0.06, by - h * 0.82, 1, 1, "#7ac8ff", 0.9 * k);
    }
  }
  R.glow(cx, H * 0.8, W * 0.4, H * 0.12, "#2a4a7a", 0.18, 5);
  A.part({ n: 10, col: "#9ad0ff", x0: 0.15, x1: 0.85, y0: 0.55, y1: 0.95, sway: 3, swf: 0.4, a: 0.35, blink: 0.6, seed: 17 });
}
// w07 捨て砦の地下牢: 左右に並ぶ牢の鉄格子、奥へ続く獄の通路、壁の松明、垂れる鎖と枷
function vPrison(R, A) {
  const { w: W, h: H } = R, gy = Math.round(H * 0.6), cx = W / 2;
  R.amb = [0.42, 0.44, 0.52];
  bricks(R, 0, 0, W, gy, "#2c2c32", "#101014", 10, 5, 13);
  R.m = SURF; R.rect(0, 0, W, H * 0.08, tex("#1a1a1e", "#0c0c0e", 0.2, 3)); R.rect(0, H * 0.08, W, 1, "#3a3a42");
  // 奥へ続く通路 (重なるアーチと遠い灯)
  const aw = Math.round(W * 0.12), at = Math.round(H * 0.22);
  archFrame(R, cx, at, aw, gy, 5, tex("#3a3a42", "#26262c", 0.3, 7), null, 0, 11, "#141418");
  R.m = SKY; R.poly(archPts(cx, at, aw, gy), (x, y) => mix(C("#0a0a0e"), C("#020203"), clamp01(1 - Math.abs(x - cx) / aw)));
  for (let k = 1; k <= 3; k++) { const s = 1 - k * 0.24; R.m = SKY; R.poly(archPts(cx, at + k * 8, aw * s + 2, gy - k * 2), mul(C("#16161c"), 1 - k * 0.22)); R.poly(archPts(cx, at + k * 8 + 2, aw * s, gy - k * 2), "#030304"); }
  R.glow(cx, gy - 10, 8, 6, "#a05020", 0.45, 4); R.m = SKY; R.rect(cx - 1, gy - 12, 2, 3, "#ffb060");
  // 左右の牢 (手前ほど大きい鉄格子の扉)
  for (const s of [-1, 1]) {
    for (const [d, x0, x1, top] of [[0, 0.02, 0.3, 0.12], [1, 0.3, 0.38, 0.3]]) {
      const xa = s < 0 ? W * x0 : W * (1 - x1), xb = s < 0 ? W * x1 : W * (1 - x0), t = H * top, b = d ? gy - 2 : H * 0.98;
      R.m = SKY; R.rect(xa, t, xb - xa, b - t, (x, y) => mix(C("#08080a"), C("#121216"), vnoise(x * 0.2, y * 0.1, 9)));
      R.m = SURF; const step = d ? 3 : 6, ir = C("#2e2a28");
      for (let x = xa + 1; x < xb; x += step) { R.rect(x, t, d ? 1 : 2, b - t, ir); if (!d) R.rect(x, t, 1, b - t, "#5a524a"); }
      for (const yy of [t, t + (b - t) * 0.3, b - 3]) R.rect(xa, yy, xb - xa, d ? 1 : 3, ir);
      if (!d) R.rect(xa, t, xb - xa, 1, "#6a625a");
    }
  }
  // 牢の中の骸 (左の床に崩れた骨)
  skull(R, W * 0.1, H * 0.86, "#8a8270", "#141210"); R.m = SURF; R.line(W * 0.13, H * 0.91, W * 0.24, H * 0.93, "#7a7262"); R.line(W * 0.16, H * 0.89, W * 0.2, H * 0.95, "#6a6252");
  // 鍵束と枷 (右の格子に掛かる)
  R.m = SURF; R.ellipse(W * 0.82, H * 0.5, 4, 4, "#8a7a4a"); R.ellipse(W * 0.82, H * 0.5, 2.5, 2.5, "#0a0a0c");
  for (const k of [-2, 0, 2]) R.line(W * 0.82 + k, H * 0.53, W * 0.82 + k * 1.5, H * 0.6, "#a08a50");
  chainSag(R, W * 0.36, H * 0.12, W * 0.46, H * 0.14, 8, "#5a5650"); chainSag(R, W * 0.54, H * 0.14, W * 0.64, H * 0.12, 8, "#5a5650");
  // 壁の松明
  for (const tx of [W * 0.38, W * 0.62]) {
    const ty = Math.round(H * 0.34); R.m = SURF; R.rect(tx - 1, ty, 3, 6, "#2a2018"); R.rect(tx - 2, ty, 5, 1, "#3a3028");
    flame(R, A, tx, ty, 2.2, "#fff0a0", "#ff8a30", true, 70, 1.2);
  }
  ground(R, gy, "#1e1d1e", "#0c0c0d", 12, 0.12, 0.3);
  perspGrid(R, gy, cx, gy - 26, "#0a0a0c", 0.7, 8, 5);
  R.m = SURF; R.rect(0, gy, W, 1, "#36363e");
  tufts(R, 23, 50, W * 0.3, W * 0.7, H * 0.64, H, "#3a3220");
  A.part({ n: 18, col: "#8a8a90", x0: 0.3, x1: 0.7, y0: 0.1, y1: 0.9, vy: 0.01, sway: 8, swf: 0.2, a: 0.2, seed: 27 });
  A.part({ n: 8, col: "#6a8aa0", x0: 0.33, x1: 0.67, y0: 0.08, y1: 0.6, vy: 0.5, a: 0.4, sz: 2, len: 2, seed: 29 });
}
// w08 雷雨の大手門: 止まぬ雷雨。稲妻が門楼を照らし、雨が叩きつける
function vStorm(R, A) {
  const { w: W, h: H } = R, cx = W / 2;
  R.post.push((out, w, h) => { // 嵐の空気: 全体を青く沈め、空を更に暗く
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3, k = y < h * 0.35 ? 0.55 + 0.45 * (y / (h * 0.35)) : 1;
      out[i] *= 0.62 * k; out[i + 1] *= 0.72 * k; out[i + 2] = out[i + 2] * 0.95 * k + 6;
    }
  });
  clouds(R, 71, 0, H * 0.3, "#0a0c16", 0.42, "#2a3450");
  // 打ち破られた門扉 (傾いた扉板)
  R.m = SURF; const wd = tex("#3a2c20", "#1e160e", 0.3, 12);
  R.poly([[cx - W * 0.07, H * 0.57], [cx - W * 0.075, H * 0.4], [cx - W * 0.02, H * 0.44], [cx - W * 0.015, H * 0.6]], wd);
  R.poly([[cx + W * 0.03, H * 0.58], [cx + W * 0.08, H * 0.42], [cx + W * 0.11, H * 0.46], [cx + W * 0.06, H * 0.62]], wd);
  // 水たまり
  for (const [x, y, w] of [[W * 0.32, H * 0.7, 26], [W * 0.62, H * 0.78, 34], [W * 0.45, H * 0.9, 40]]) { R.m = SURF; R.ellipse(x, y, w, 3, "#0a0e18"); R.rect(x - w * 0.6, y - 1, w * 0.7, 1, "#3a4a6a", 0.6); }
  A.pulse((P) => { // 稲妻 (ジグザグの光の筋 + 空の閃き)
    P.m = ADD; P.rect(0, 0, W, H * 0.45, "#6a7aa8", 0.22);
    const r = rnd(5); let x = W * 0.68, y = 0;
    while (y < H * 0.36) { const nx = x + (r() - 0.5) * 14, ny = y + 3 + r() * 5; P.line(x, y, nx, ny, "#e8f0ff", 1, 1); P.line(x + 1, y, nx + 1, ny, "#8aa0e0", 0.5, 1); if (r() < 0.2) P.line(nx, ny, nx + (r() - 0.5) * 18, ny + 8, "#a8b8f0", 0.6, 1); x = nx; y = ny; }
    P.glow(W * 0.66, H * 0.2, 60, 40, "#5a6aa8", 0.5, 5);
  }, (t) => lightning(t));
  A.part({ n: 70, col: "#8a9ac0", x0: 0, x1: 1, y0: 0, y1: 1, vy: 1.4, vx: -0.08, a: 0.35, streak: 3, slant: -0.5, seed: 41 });
}
// w09 捨て砦の本丸: 軍議の間。地図を広げた卓を、将たちの亡霊がいまも囲む
function vCouncil(R, A) {
  const { w: W, h: H } = R, cx = W / 2, ty = Math.round(H * 0.74);
  // 将の亡霊 (卓の奥に3体、左右に1体ずつ)
  for (const [dx, dy, h] of [[-26, -6, 26], [0, -8, 28], [26, -6, 26]]) ghost(R, cx + dx, ty + dy, h, "#c8a070", 0.36);
  ghost(R, cx - 52, ty + 8, 32, "#c8a070", 0.32); ghost(R, cx + 52, ty + 8, 32, "#c8a070", 0.32);
  // 卓 (奥へすぼまる天板と脚)
  const wd = tex("#4a3420", "#2a1c10", 0.25, 8);
  R.m = SURF;
  R.poly([[cx - 44, ty], [cx - 34, ty - 10], [cx + 34, ty - 10], [cx + 44, ty]], wd);
  R.rect(cx - 44, ty, 88, 3, "#24180c"); R.rect(cx - 44, ty, 88, 1, "#6a4a2a");
  for (const lx of [cx - 40, cx + 38]) R.rect(lx, ty + 3, 3, 12, "#1a120a");
  // 広げた地図と駒
  R.poly([[cx - 22, ty - 1], [cx - 17, ty - 8], [cx + 19, ty - 8], [cx + 24, ty - 1]], (x, y) => mix(C("#8a7a54"), C("#b0a070"), vnoise(x * 0.3, y * 0.5, 4)));
  R.line(cx - 12, ty - 6, cx + 4, ty - 3, "#5a3a20", 0.8); R.line(cx + 4, ty - 3, cx + 14, ty - 6, "#7a2010", 0.8);
  for (const [x, c] of [[cx - 8, "#2a2a3a"], [cx + 6, "#7a1a10"], [cx + 12, "#7a1a10"], [cx - 14, "#2a2a3a"]]) R.rect(x, ty - 7, 2, 3, c);
  for (const x of [cx - 32, cx + 30]) { R.rect(x, ty - 14, 2, 4, "#d8d0b0"); flame(R, A, x + 1, ty - 14, 1.3, "#fff4c0", "#ffb040", true, 60, 1); }
  // 焼けた軍旗 (卓の奥に交差して立つ)
  R.m = SURF; R.line(cx - 6, ty - 10, cx - 18, H * 0.3, "#2a2018", 1, 1); R.line(cx + 6, ty - 10, cx + 18, H * 0.3, "#2a2018", 1, 1);
  banner(R, cx - 30, H * 0.3, 12, 18, "#4a1416", 14, "#7a6034"); banner(R, cx + 18, H * 0.3, 12, 16, "#4a1416", 15, "#7a6034");
  A.part({ n: 14, col: "#ffc070", x0: 0.3, x1: 0.7, y0: 0.4, y1: 0.75, vy: -0.03, sway: 5, swf: 0.5, a: 0.45, tw: 2, seed: 19 });
}
// ws1 沈んだ礼拝堂: 水底に沈んだ大鐘。夜ごと鳴るという鐘に、緑青と光の筋
function vBell(R, A) {
  const { w: W, h: H } = R, cx = W / 2, by = Math.round(H * 0.78);
  const bh = 40, bw = 26;
  const pts = [[cx - bw, by], [cx - bw * 0.82, by - 6], [cx - bw * 0.56, by - bh * 0.55], [cx - bw * 0.42, by - bh * 0.9], [cx - bw * 0.2, by - bh], [cx + bw * 0.2, by - bh], [cx + bw * 0.42, by - bh * 0.9], [cx + bw * 0.56, by - bh * 0.55], [cx + bw * 0.82, by - 6], [cx + bw, by]];
  R.m = SURF;
  R.poly(pts, (x, y) => { const u = (x - cx) / bw, k = u < -0.4 ? 1.15 : u < 0.1 ? 0.95 : u < 0.5 ? 0.7 : 0.5; return mul(mix(C("#3a5a48"), C("#6a5a38"), vnoise(x * 0.25, y * 0.2, 3)), k); });
  R.rect(cx - bw, by - 2, bw * 2, 2, "#2a3a30"); R.rect(cx - bw * 0.6, by - bh * 0.5, bw * 1.2, 1, "#8aa080", 0.6); R.rect(cx - bw * 0.7, by - bh * 0.3, bw * 1.4, 1, "#1a2a22", 0.8);
  R.rect(cx - 4, by - bh - 5, 8, 5, "#3a4a3a"); R.ellipse(cx, by - bh - 6, 5, 3, "#2a3a2e");
  R.m = SKY; R.ellipse(cx, by, bw * 0.9, 3, "#020a0e");
  R.glow(cx, by - bh * 0.5, 50, 40, "#3a8a8a", 0.3, 5); R.light(cx - 20, by - bh, 80, "#7ad0d0", 0.7, 60);
  chainSag(R, cx - 4, by - bh - 6, cx - 60, H * 0.04, 14, "#3a4a44"); chainSag(R, cx + 4, by - bh - 6, cx + 50, H * 0.02, 10, "#3a4a44");
  A.part({ n: 14, col: "#a8e8f0", x0: 0.4, x1: 0.6, y0: 0.2, y1: 0.75, vy: -0.08, sway: 4, swf: 0.6, a: 0.55, ring: true, big: 0.3, seed: 33 });
}
// ws2 石眠りの石切り場: 鑿を握ったまま石になった鉱夫たちと、切り出しかけの石材
function vQuarry(R, A) {
  const { w: W, h: H } = R, cx = W / 2;
  const st = tex("#6a6a6e", "#3a3a40", 0.3, 15);
  // 切り出しかけの石材 (段になった切羽)
  R.m = SURF;
  for (const [x, y, w, h] of [[cx - 30, H * 0.5, 60, 9], [cx - 22, H * 0.44, 44, 7], [cx - 14, H * 0.39, 28, 6]]) { R.rect(x, y, w, h, st); R.rect(x, y, w, 1, "#9a9aa0"); R.rect(x + w - 1, y, 1, h, "#2a2a2e"); }
  // 石の鉱夫 (鑿・鶴嘴を振り上げたまま固まった像)
  const miner = (x, by, h, dir) => {
    const w = h * 0.36;
    R.m = SURF;
    R.poly([[x - w * 0.5, by], [x - w * 0.4, by - h * 0.55], [x - w * 0.3, by - h * 0.78], [x + w * 0.3, by - h * 0.78], [x + w * 0.42, by - h * 0.55], [x + w * 0.5, by]], st);
    R.ellipse(x + dir * w * 0.1, by - h * 0.86, w * 0.3, h * 0.1, st);
    R.taper(x + dir * w * 0.3, by - h * 0.7, x + dir * w * 1.1, by - h * 1.1, 2, 1.5, st); // 振り上げた腕
    R.line(x + dir * w * 1.1, by - h * 1.1, x + dir * w * 0.6, by - h * 1.35, "#4a4a50", 1, 1); // 鶴嘴の柄
    R.line(x + dir * w * 0.4, by - h * 1.4, x + dir * w * 0.85, by - h * 1.28, "#5a5a60", 1, 1);
    R.line(x - dir * w * 0.45, by - h * 0.5, x - dir * w * 0.45, by - 2, "#8a8a90", 0.5);
    R.m = SURF; R.rect(x - w * 0.2, by - h * 0.4, w * 0.4, 1, "#2a2a2e", 0.7); // 苔むした割れ目
  };
  miner(cx - 56, H * 0.9, 38, 1); miner(cx + 54, H * 0.92, 40, -1); miner(cx - 24, H * 0.74, 24, 1); miner(cx + 26, H * 0.73, 22, -1);
  R.light(cx, H * 0.7, 110, "#b0b8c8", 0.5, 60);
  rubble(R, 9, 12, cx - 40, cx + 40, H * 0.74, H * 0.96, "#5a5a60");
  A.part({ n: 24, col: "#b0b0a8", x0: 0.15, x1: 0.85, y0: 0.2, y1: 0.95, vy: 0.008, vx: 0.004, sway: 6, swf: 0.2, a: 0.25, seed: 37 });
}
// ws3 霧の迷い森: 幾重もの霧が道を食う。小径の先に、落ちて灯ったままの手提げ灯
function vMistwood(R, A) {
  const { w: W, h: H } = R, cx = W / 2;
  fogBand(R, H * 0.5, 30, "#9ab8a8", 0.45, 61); fogBand(R, H * 0.68, 24, "#8aa898", 0.35, 62);
  // 小径 (奥へ細る踏み跡)
  R.m = SURF; R.poly([[cx - 6, H * 0.6], [cx + 6, H * 0.6], [cx + 34, H], [cx - 30, H]], (x, y) => mul(C("#2a2a1e"), 0.8 + 0.3 * vnoise(x * 0.2, y * 0.2, 4)), 0.7);
  // 落ちた手提げ灯
  const lx = cx + 10, ly = Math.round(H * 0.82);
  R.m = SURF; R.poly([[lx - 4, ly], [lx - 3, ly - 6], [lx + 4, ly - 7], [lx + 5, ly - 1]], "#2a2418");
  R.m = SKY; R.rect(lx - 2, ly - 5, 5, 4, "#ffd890");
  R.glow(lx, ly - 3, 26, 14, "#c08a30", 0.45, 5); R.light(lx, ly - 3, 60, "#ffc060", 1, 36);
  A.flick(lx, ly - 3, 10, "#ffc060", 0.4, 0.7);
  fogBand(R, H * 0.88, 20, "#9ab8a8", 0.3, 63);
  A.fog("#c0d8c8", 0.48, 5, 0.18, 4, 130, 12); A.fog("#c0d8c8", 0.7, 5, 0.16, -3, 140, 14);
  A.part({ n: 26, col: "#c8e0a0", x0: 0, x1: 1, y0: 0.3, y1: 0.95, vy: -0.015, sway: 8, swf: 0.3, a: 0.4, tw: 1.2, seed: 43 });
}
// ---- 第四章「王都の地下」(第6層・沈んだ旧都) ----
// 石灯籠 (基礎・竿・中台・火袋・笠・宝珠)。(x,by) = 足元、s = 大きさ。lit = 火袋に青白い灯
function toro(R, A, x, by, s, col, lit = false) {
  const c = C(col), P = (pts) => pts.map(([u, v]) => [x + u * s, by - v * s]);
  const sh = (px, py) => mul(c, ((px + 0.5 - x) / s < -2 ? 1.18 : (px + 0.5 - x) / s < 2 ? 0.95 : 0.7) * (0.85 + 0.3 * vnoise(px * 0.5, py * 0.5, 3)));
  R.m = SURF;
  R.poly(P([[-7, 0], [7, 0], [6, 4], [-6, 4]]), sh);
  R.poly(P([[-2.6, 4], [2.6, 4], [2.2, 18], [-2.2, 18]]), sh);
  R.poly(P([[-6, 18], [6, 18], [7.5, 21], [-7.5, 21]]), sh);
  R.poly(P([[-4.5, 21], [4.5, 21], [4.5, 29], [-4.5, 29]]), sh);
  R.poly(P([[-13, 30.8], [-11, 29], [11, 29], [13, 30.8], [9, 31.8], [3, 34.6], [-3, 34.6], [-9, 31.8]]), (px, py) => mul(c, py > by - 31 * s ? 0.6 : 1.1));
  R.poly(P([[-1.6, 34.6], [1.6, 34.6], [1.9, 36.6], [0, 39], [-1.9, 36.6]]), sh);
  R.m = SKY; R.poly(P([[-2.6, 22.4], [2.6, 22.4], [2.6, 27.6], [-2.6, 27.6]]), lit ? "#d8fff4" : "#04080a");
  if (lit) {
    R.glow(x, by - 25 * s, 16 * s, 14 * s, "#5ad0d0", 0.45, 5); R.light(x, by - 25 * s, 50 * s, "#8ae8f0", 1.2, 40 * s);
    R.m = SKY; R.rect(x - 1, by - 33 * s, 2, 2, "#8ae8d0"); // 笠の師の印
    A.flick(x, by - 25 * s, Math.max(6, 8 * s), "#8ae8f0", 0.4, 0.6);
  }
  R.m = SURF;
}
// w14 水底の参道: 水の底へ灯籠を連ねる参道。灯籠のひとつにだけ青白い灯
function vApproach(R, A) {
  const { w: W, h: H } = R, vx = W / 2, hz = Math.round(H * 0.5);
  // 参道の敷石 (奥へすぼまる)
  R.m = SURF; R.poly([[vx - 4, hz], [vx + 4, hz], [vx + 80, H], [vx - 80, H]], (x, y) => { const z = 40 / Math.max(1, y - hz + 2); const w = Math.floor(((x - vx) * z) / 3) + Math.floor(z * 3); return mul(C("#3a5458"), (w & 1 ? 0.8 : 1) * (0.85 + 0.3 * vnoise(x * 0.2, y * 0.3, 5))); });
  const at = (side, z) => ({ s: 2.1 / z, x: vx + side * 66 / z, y: hz + 52 / z });
  const list = [];
  for (const z of [7, 5, 3.6, 2.6, 1.9, 1.4]) { list.push([-1, z]); list.push([1, z]); }
  list.sort((a, b) => b[1] - a[1]);
  for (const [side, z] of list) { const p = at(side, z); toro(R, A, p.x, p.y, p.s, z > 3 ? "#2a4448" : "#46666a", side === 1 && z === 1.9); }
  R.light(vx, H * 0.2, 120, "#5a9aa8", 0.5, 80);
  A.part({ n: 18, col: "#a8e8f0", x0: 0.55, x1: 0.8, y0: 0.15, y1: 0.7, vy: -0.06, sway: 4, swf: 0.6, a: 0.5, ring: true, big: 0.3, seed: 71 });
}
// w15 溺れた聖歌の回廊: 水没した聖歌隊席に並ぶ亡霊の歌い手。奥の色硝子から金の光が射す
function vChoir(R, A) {
  const { w: W, h: H } = R, cx = W / 2, top = Math.round(H * 0.08), bot = Math.round(H * 0.5);
  // 尖頭の色硝子 (中央奥)
  R.m = SURF; R.poly(archPts(cx, top - 2, 24, bot + 2, 0.5), "#2a3a40");
  R.m = SKY; R.poly(archPts(cx, top, 21, bot, 0.5), (x, y) => {
    const cell = (Math.floor((x - cx + 40) / 6) + Math.floor((y - top) / 7) * 3) % 5;
    const lead = (x - cx + 40) % 6 === 0 || (y - top) % 7 === 0 || Math.abs(x - cx) < 1;
    if (lead) return C("#0a1014");
    return mul(C(["#c8a040", "#3a6aa0", "#a03a3a", "#d8c890", "#4a8a6a"][cell]), 0.7 + 0.3 * vnoise(x * 0.3, y * 0.3, 4));
  });
  R.glow(cx, H * 0.3, 40, 34, "#e8d890", 0.35, 5);
  // 斜めに射し込む金の光の帯
  R.m = ADD;
  for (let y = bot; y < H; y++) { const t = (y - bot) / (H - bot), x0 = cx - 18 - t * 30, x1 = cx + 18 + t * 10; R.span(y, x0, x1, (x) => mul(C("#e8d890"), Math.floor((0.16 * (1 - t * 0.6) * (0.7 + 0.5 * vnoise(x * 0.1, y * 0.05, 6))) * 20 + bayer(x, y)) / 20)); }
  // 聖歌隊席 (左右に段をなす木の席。奥ほど小さい)
  for (const s of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      const z = 1 + k * 0.55, y = H * 0.62 + 34 / z, xa = cx + s * (26 + 10 / z), xb = cx + s * (26 + 110 / z), hgt = 12 / z;
      R.m = SURF; R.rect(Math.min(xa, xb), y - hgt, Math.abs(xb - xa), hgt, tex("#3a2a1c", "#22180e", 0.3, 9 + k));
      R.rect(Math.min(xa, xb), y - hgt, Math.abs(xb - xa), 1, "#6a5034");
      for (let i = 0; i < 4; i++) ghost(R, xa + s * (i + 0.6) * (Math.abs(xb - xa) / 4.2), y - hgt + 2, 24 / z, "#d8e8c0", 0.4);
    }
  }
  R.light(cx, H * 0.4, 110, "#e8d890", 0.7, 70);
  A.part({ n: 16, col: "#f0e0a0", x0: 0.2, x1: 0.8, y0: 0.3, y1: 0.8, vy: -0.02, sway: 6, swf: 0.4, a: 0.5, tw: 1.4, rune: true, seed: 73 });
  A.part({ n: 12, col: "#c8f0ff", x0: 0.1, x1: 0.9, y0: 0.2, y1: 0.95, vy: -0.05, sway: 3, swf: 0.6, a: 0.4, ring: true, big: 0.3, seed: 74 });
}
// w16 洗礼の大水槽: 水の引いた巨大な水槽。モザイクの壁を大樹の根が這い、底には昏い水たまり
function vFont(R, A) {
  const { w: W, h: H } = R, cx = W / 2, gy = Math.round(H * 0.6);
  R.amb = [0.42, 0.52, 0.58];
  // 水槽の壁 (青緑と白のモザイク。上は水の跡でくすむ)
  R.m = SURF; R.rect(0, 0, W, gy, (x, y) => {
    const tx = Math.floor(x / 3), ty = Math.floor(y / 3), gap = x % 3 === 0 || y % 3 === 0, id = hash(tx, ty, 5);
    let c = gap ? C("#22292a") : ty % 7 === 3 ? mix(C("#a08a50"), C("#6a5a30"), id) : mix(C("#2a6064"), C("#9ab0a8"), id > 0.8 ? 1 : id * 0.3);
    c = mix(c, C("#3a4a44"), 0.35 + 0.3 * (fbm(x * 0.05, y * 0.1, 7) > 0.6 ? 1 : 0)); // 水の跡でくすむ
    return mul(c, 0.6 + 0.4 * clamp01(y / gy));
  });
  R.rect(0, H * 0.08, W, 2, "#c8c0a8"); R.rect(0, H * 0.08 + 2, W, 1, "#1a1c1c"); // 昔の水面の線
  // 底へ降りる石段 (右)
  for (let i = 0; i < 7; i++) { R.m = SURF; R.rect(W * 0.7 + i * 6, gy - 30 + i * 5, W, 5, mul(C("#6a706c"), 1 - i * 0.04)); R.rect(W * 0.7 + i * 6, gy - 30 + i * 5, W, 1, "#a8aca0"); }
  // 底 (濡れた石と水たまり)
  ground(R, gy, "#56605a", "#20282a", 21, 0.08, 0.3);
  perspGrid(R, gy, cx, gy - 40, "#1a2020", 0.5, 7, 4);
  for (const [x, y, w] of [[cx - 40, H * 0.74, 34], [cx + 24, H * 0.86, 46], [cx - 70, H * 0.92, 30]]) { R.m = SKY; R.ellipse(x, y, w, 4, "#050c10"); R.m = ADD; R.rect(x - w * 0.5, y - 1, w * 0.6, 1, "#3a7078", 0.6); }
  // 大樹の根 (壁の継ぎ目から底へ這い、水たまりに口をつける)
  const root = (pts, t0, t1, sd) => { const n = pts.length - 1; for (let i = 0; i < n; i++) { const a = pts[i], b = pts[i + 1]; R.m = SURF; R.taper(a[0], a[1], b[0], b[1], t0 + (t1 - t0) * (i / n), t0 + (t1 - t0) * ((i + 1) / n), tex("#4a3a2a", "#241a12", 0.3, sd)); } };
  root([[cx - 20, 0], [cx - 24, H * 0.3], [cx - 34, gy], [cx - 40, H * 0.74]], 20, 6, 3);
  root([[cx + 40, 0], [cx + 30, H * 0.26], [cx + 12, gy + 4], [cx + 22, H * 0.86]], 15, 5, 5);
  root([[W * 0.08, H * 0.2], [W * 0.14, H * 0.5], [cx - 70, H * 0.92]], 10, 3, 7);
  root([[cx + 30, H * 0.26], [cx + 70, H * 0.36], [W * 0.92, H * 0.3]], 6, 2, 11);
  root([[cx - 24, H * 0.3], [cx - 52, H * 0.4], [W * 0.1, H * 0.46]], 4, 1.5, 9);
  root([[cx - 36, gy + 2], [cx - 80, gy + 10], [W * 0.02, gy + 14]], 6, 2, 13);   // 底を這う根
  root([[cx + 14, gy + 6], [cx + 60, gy + 16], [W * 0.98, H * 0.78]], 6, 2, 15);
  root([[cx - 38, H * 0.7], [cx - 10, H * 0.8], [cx + 10, H * 0.98]], 4, 1.5, 17);
  R.m = ADD; for (let i = 0; i < 30; i++) { const y = hash(i, 1, 9) * gy; R.px(cx - 24 - (y / gy) * 10 + (hash(i, 2, 9) - 0.5) * 6, y, "#3ac0a0", 0.6); }
  R.light(cx, -10, 170, "#8ad0e8", 1.0, 130);
  A.part({ n: 14, col: "#8ad0e8", x0: 0.3, x1: 0.7, y0: 0.0, y1: 0.7, vy: 0.4, a: 0.35, sz: 2, len: 2, seed: 75 });
  A.part({ n: 14, col: "#5ad0b0", x0: 0.3, x1: 0.6, y0: 0.1, y1: 0.7, vy: 0.03, sway: 3, swf: 0.4, a: 0.4, tw: 1.4, seed: 76 });
}
// w17 沈める大神殿: 祭壇を突き破って昇る大樹の幹。その前に、祈り続ける信徒たちがひざまずく
function vSunkenTemple(R, A) {
  const { w: W, h: H } = R, cx = W / 2, gy = Math.round(H * 0.62);
  // 幹 (上は水の闇へ消える。中央に縦に裂けた虚から魂の光)
  R.m = SURF;
  R.poly([[cx - 18, 0], [cx + 18, 0], [cx + 22, gy - 24], [cx + 44, gy + 4], [cx - 44, gy + 4], [cx - 22, gy - 24]], (x, y) => {
    const g = Math.sin(x * 0.9 + fbm(x * 0.1, y * 0.2, 5) * 7) * 0.5 + 0.5;
    return mul(mix(C("#2a2218"), C("#5a4630"), g * 0.7), 0.7 + 0.5 * clamp01(1 - Math.abs(x - cx) / 40));
  });
  for (const s of [-1, 1]) { R.m = SURF; R.taper(cx + s * 30, gy - 4, cx + s * 74, gy + 22, 10, 3, tex("#4a3a28", "#241a10", 0.3, 4)); R.taper(cx + s * 16, gy, cx + s * 40, H * 0.9, 8, 2, tex("#4a3a28", "#241a10", 0.3, 6)); }
  R.m = SKY; R.poly([[cx - 2, 0], [cx + 3, 0], [cx + 5, gy * 0.5], [cx + 2, gy - 14], [cx - 3, gy * 0.5]], (x, y) => mix(C("#2a8a70"), C("#a8f0d0"), clamp01(0.3 + vnoise(x * 0.4, y * 0.1, 8) * 0.7)));
  R.glow(cx, gy * 0.5, 22, 50, "#3ac0a0", 0.35, 5); R.light(cx, gy * 0.5, 70, "#6ad8c0", 0.8, 90);
  // 割れて押しのけられた祭壇の石
  for (const [x, y, w, h] of [[cx - 52, gy - 8, 20, 9], [cx + 32, gy - 10, 22, 10], [cx - 30, gy + 2, 12, 6], [cx + 20, gy + 4, 14, 6]]) { R.m = SURF; R.rect(x, y, w, h, tex("#8a8a84", "#5a5a56", 0.3, x | 0)); R.rect(x, y, w, 1, "#c0c0b4"); }
  // 祈り続ける信徒 (幹に向かって並ぶ頭巾の影。手前ほど大きい)
  for (const [dx, dy, h] of [[-66, 0.76, 22], [-44, 0.78, 24], [44, 0.78, 24], [66, 0.76, 22], [-86, 0.94, 34], [-54, 0.97, 36], [54, 0.97, 36], [86, 0.94, 34]]) hooded(R, cx + dx, H * dy, h, "#3a4a4c", "#a8e0d0");
  A.part({ n: 18, col: "#a8f0d0", x0: 0.44, x1: 0.56, y0: 0.05, y1: 0.6, vy: -0.05, sway: 3, swf: 0.6, a: 0.55, tw: 1.6, seed: 77 });
  A.part({ n: 10, col: "#c0a0e0", x0: 0.1, x1: 0.9, y0: 0.55, y1: 0.95, vy: -0.01, sway: 5, swf: 0.3, a: 0.3, blink: 0.5, seed: 78 });
}
// ws5 王都の古井戸: 井戸の底から見上げる石の筒と、遠い口の光。底に積もった願いの品
function vWell(R, A) {
  const { w: W, h: H } = R, cx = W / 2, oy = Math.round(H * 0.22);
  R.amb = [0.3, 0.28, 0.4];
  // 石の筒 (口へ向かって同心に狭まる石積み)
  R.m = SURF; R.rect(0, 0, W, H, (x, y) => {
    const dx = x + 0.5 - cx, dy = (y + 0.5 - oy) * 1.25, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    const ring = Math.log(Math.max(1, r)) * 6, row = Math.floor(ring), u = (a / TAU + 1 + (row & 1) * 0.04) * (18 + row * 3);
    const joint = ring - row < 0.12 || u - Math.floor(u) < 0.08;
    const c = joint ? C("#0e0c14") : mix(C("#3a3646"), C("#5a5466"), hash(Math.floor(u), row, 3));
    return mul(c, 0.4 + 0.75 * clamp01(1 - r / (W * 0.62)) + (fbm(x * 0.1, y * 0.1, 4) > 0.64 ? -0.15 : 0));
  });
  // 遠い井戸の口 (夜空と月の光)
  R.m = SKY; R.ellipse(cx, oy, 14, 11, (x, y) => mix(C("#4a5a8a"), C("#c8d0e8"), clamp01(1 - Math.hypot(x - cx - 3, y - oy + 3) / 12)));
  R.glow(cx, oy, 50, 44, "#8a9ad0", 0.35, 5); R.light(cx, oy, 130, "#a0b0e0", 1, 120);
  // 口から垂れる綱と桶
  R.m = SURF; R.line(cx + 4, oy + 8, cx + 10, H * 0.62, "#6a5a40"); R.rect(cx + 6, H * 0.62, 9, 7, "#4a3a28"); R.rect(cx + 6, H * 0.62, 9, 1, "#8a7050");
  // 底に積もった願いの品 (金貨・指輪・人形・手紙) と、紫に灯る願い
  R.m = SURF; R.ellipse(cx, H * 1.02, W * 0.48, H * 0.2, tex("#2a2430", "#141018", 0.2, 6));
  const r = rnd(81);
  for (let i = 0; i < 70; i++) {
    const x = cx + (r() - 0.5) * W * 0.8, y = H * 0.86 + r() * H * 0.14 - (1 - Math.abs(x - cx) / (W * 0.4)) * 8;
    const k = r();
    R.m = SKY;
    if (k < 0.55) { R.rect(x, y, 2, 1, "#e8c060"); R.px(x, y - 1, "#fff0a0", 0.6); }
    else if (k < 0.75) { R.m = SURF; R.ellipse(x, y, 2, 1.4, "#a89070"); R.m = SKY; R.px(x, y - 1, "#f0e8d0", 0.5); }
    else if (k < 0.9) { R.m = SURF; R.rect(x, y - 3, 3, 4, "#8a6a4a"); R.rect(x + 1, y - 5, 1, 2, "#8a6a4a"); }
    else { R.m = SURF; R.rect(x, y - 1, 4, 2, "#c8c0a8"); }
  }
  R.glow(cx, H * 0.92, 60, 18, "#9080c0", 0.3, 5);
  A.part({ n: 22, col: "#b0a0e8", x0: 0.15, x1: 0.85, y0: 0.6, y1: 0.98, vy: -0.015, sway: 6, swf: 0.3, a: 0.5, tw: 1.6, seed: 83 });
  A.part({ n: 8, col: "#c8d0f0", x0: 0.44, x1: 0.58, y0: 0.2, y1: 0.8, vy: 0.3, a: 0.4, sz: 2, len: 1, seed: 84 });
}

// ---- 第五章「灼熱の洞」(第7層・火) ----
// w18 火を噴く地割れ: 赤く脈打つ岩の割れ目から、火柱が噴き上がる
function vVent(R, A) {
  const { w: W, h: H } = R, cx = W / 2, gy = Math.round(H * 0.62);
  const jets = [[cx - 46, gy + 8, 36], [cx + 6, gy + 2, 52], [cx + 54, gy + 12, 30]];
  for (const [x, y] of jets) { R.m = SKY; R.poly([[x - 16, y + 1], [x - 4, y - 2], [x + 6, y - 1], [x + 18, y + 2], [x + 4, y + 3]], "#ffb040"); R.glow(x, y, 26, 8, "#ff5010", 0.5, 4); }
  R.m = SKY; R.line(cx - 90, gy + 6, cx - 46, gy + 8, "#ff9030"); R.line(cx - 46, gy + 8, cx + 6, gy + 2, "#ff9030"); R.line(cx + 6, gy + 2, cx + 54, gy + 12, "#ff9030"); R.line(cx + 54, gy + 12, cx + 100, gy + 8, "#ff9030");
  const jet = (P, x, y, h, w) => {
    P.m = SKY;
    P.poly([[x - w, y], [x - w * 0.6, y - h * 0.5], [x - w * 0.2, y - h], [x + w * 0.3, y - h * 0.86], [x + w * 0.7, y - h * 0.4], [x + w, y]], (px, py) => mix(C("#c03010"), C("#fff0b0"), clamp01(0.3 + (py - (y - h)) / h * 0.5 + (1 - Math.abs(px - x) / w) * 0.4 + (vnoise(px * 0.4, py * 0.15, 3) - 0.5) * 0.4)));
    P.glow(x, y - h * 0.5, w * 3, h * 0.7, "#ff6020", 0.5, 5);
  };
  for (const [x, y, h] of jets) R.light(x, y - h * 0.5, 70, "#ff7020", 1.2, h);
  A.pulse((P) => { for (const [x, y, h] of jets) jet(P, x, y, h, 6 + h * 0.08); }, (t) => 0.55 + 0.45 * Math.max(0, Math.sin(t * 0.0021)));
  A.pulse((P) => { for (const [x, y, h] of jets) jet(P, x + 2, y, h * 0.7, 5 + h * 0.06); }, (t) => 0.55 + 0.45 * Math.max(0, Math.sin(t * 0.0021 + Math.PI)));
  A.part({ n: 40, col: "#ffb050", x0: 0.25, x1: 0.75, y0: 0.1, y1: 0.7, vy: -0.12, sway: 6, swf: 0.6, a: 0.8, tw: 2.4, big: 0.15, seed: 85 });
}
// w19 灰の降る祭場: 灰の雨に霞む祭場。火の祭壇の前に、焼かれた人業の殻が積み上がる
function vAsh(R, A) {
  const { w: W, h: H } = R, cx = W / 2, by = Math.round(H * 0.84);
  R.post.push((out, w, h) => { // 灰に霞む: 色を抜いて灰色に寄せる
    for (let i = 0; i < out.length; i += 3) { const l = out[i] * 0.3 + out[i + 1] * 0.55 + out[i + 2] * 0.15; out[i] = out[i] * 0.55 + l * 0.45 + 10; out[i + 1] = out[i + 1] * 0.55 + l * 0.45 + 9; out[i + 2] = out[i + 2] * 0.55 + l * 0.45 + 9; }
  });
  // 火の祭壇 (奥の石の大鉢)
  R.m = SURF; R.poly([[cx - 18, H * 0.36], [cx + 18, H * 0.36], [cx + 10, H * 0.44], [cx - 10, H * 0.44]], "#5a4a40"); R.rect(cx - 3, H * 0.44, 6, H * 0.16, "#4a3a30");
  flame(R, A, cx, H * 0.36, 8, "#fff0b0", "#ff7020", true, 120, 1.4);
  // 殻の山 (左右。焼けた腕・脚・頭の影)
  for (const [x0, w, sd] of [[cx - 58, 46, 3], [cx + 56, 50, 5], [cx, 34, 7]]) {
    const r = rnd(sd), hgt = w * 0.6;
    R.light(x0, by - hgt, w * 1.6, "#ff8040", 0.9, hgt * 1.4);
    R.m = SURF; R.poly([[x0 - w, by], [x0 - w * 0.4, by - hgt * 0.8], [x0, by - hgt], [x0 + w * 0.5, by - hgt * 0.7], [x0 + w, by]], tex("#8a7a72", "#3a3230", 0.3, sd));
    for (let i = 0; i < 14; i++) {
      const x = x0 + (r() - 0.5) * w * 1.4, y = by - r() * hgt * (1 - Math.abs(x - x0) / (w * 1.1)), a = r() * Math.PI;
      if (r() < 0.6) { R.taper(x, y, x + Math.cos(a) * 12, y - Math.sin(a) * 7, 3.4, 2.4, "#9a8a80"); R.px(x + Math.cos(a) * 12, y - Math.sin(a) * 7, "#8a8a92"); }
      else { R.ellipse(x, y, 4, 4.2, "#9a8a80"); R.px(x - 1, y, "#050404"); R.px(x + 1, y, "#050404"); }
      if (r() < 0.4) { R.m = SKY; R.px(x, y + 1, "#ff7020", 0.8); R.m = SURF; }
    }
    R.m = SURF; R.rect(x0 - w * 0.6, by - hgt * 0.95, w * 1.2, 1, "#8a8480", 0.5);
  }
  R.glow(cx, H * 0.4, 90, 60, "#a04018", 0.25, 5);
  A.part({ n: 80, col: "#b0a8a0", x0: 0, x1: 1, y0: 0, y1: 1, vy: 0.05, vx: 0.01, sway: 6, swf: 0.3, a: 0.55, big: 0.1, seed: 87 });
  A.part({ n: 16, col: "#ff9040", x0: 0.35, x1: 0.65, y0: 0.1, y1: 0.5, vy: -0.05, sway: 5, swf: 0.6, a: 0.6, tw: 2, seed: 88 });
}
// 大釜 (黒鉄の胴と縁。中で煮える樹液、立つ湯気)。s = 大きさ
function kettle(R, A, x, by, s, steam = true, fire = true) {
  const rw = 22 * s, rh = 18 * s, top = by - rh, dk = s > 1.5 ? 0.55 : 1; // 大きな釜は近くの火に照らされすぎないよう沈める
  R.m = SURF;
  R.poly(Array.from({ length: 17 }, (_, i) => { const a = Math.PI * i / 16; return [x - Math.cos(a) * rw, top + Math.sin(a) * rh]; }), (px, py) => {
    const u = (px - x) / rw, v = (py - top) / rh;
    return mul(C("#7a6e70"), dk * (u < -0.4 ? 1.2 : u < 0.25 ? 0.95 : 0.62) * (0.9 + 0.2 * vnoise(px * 0.3, py * 0.3, 5)) * (0.75 + 0.25 * (1 - v)));
  });
  R.rect(x - rw * 0.98, top + rh * 0.35, rw * 1.96, Math.max(1, s), "#a09090");
  R.m = SURF; R.ellipse(x, top, rw * 1.05, 3.2 * s, "#9a8e8c");
  R.m = SKY; R.ellipse(x, top, rw * 0.9, 2.2 * s, (px, py) => mix(C("#c04010"), C("#ffc860"), vnoise(px * 0.4 / s, py * 0.8, 3)));
  R.m = ADD; // 下の火に照らされた胴の下側
  R.poly(Array.from({ length: 17 }, (_, i) => { const a = Math.PI * i / 16; return [x - Math.cos(a) * rw, top + Math.sin(a) * rh]; }), (px, py) => mul(C("#ff6020"), 0.6 * clamp01((py - top) / rh - 0.7)));
  R.glow(x, top, rw * 1.6, rw * 0.8, "#ff7020", 0.3, 4);
  if (fire) { // 下で燃える魂の火 (青白い芯)
    R.m = SKY;
    for (const dx of [-0.5, -0.2, 0.15, 0.5]) { const fx = x + dx * rw, fh = (5 + 4 * hash(dx * 10 | 0, 3, x | 0)) * s; R.poly([[fx - 3 * s, by + 2], [fx - 1.5 * s, by - fh * 0.6], [fx, by - fh], [fx + 1.5 * s, by - fh * 0.5], [fx + 3 * s, by + 2]], (px, py) => mix(C("#c03010"), C("#ffd070"), clamp01((py - (by - fh)) / fh))); }
    R.px(x, by - 1, "#a8f0d8"); R.glow(x, by, rw, 6 * s, "#ff5010", 0.4, 4);
  }
  R.light(x, top, 40 * s, "#ff8030", 1, 30 * s);
  if (steam) A.part({ n: 6, col: "#c8a890", x0: (x - rw * 0.6) / R.w, x1: (x + rw * 0.6) / R.w, y0: Math.max(0, (top - 30 * s) / R.h), y1: top / R.h, vy: -0.03, sway: 4, swf: 0.4, a: 0.3, seed: (x | 0) + 90 });
  R.m = SURF;
}
// w20 魂を煮る釜場: 奥へ並ぶいくつもの釜。釜の下の火は、呑まれた魂の色を帯びる
function vKettles(R, A) {
  const { w: W, h: H } = R, cx = W / 2;
  for (let i = 0; i < 5; i++) kettle(R, A, cx + (i - 2) * 46, H * 0.66, 0.8, i % 2 === 0);   // 奥に並ぶ釜
  for (const sx of [-1, 1]) kettle(R, A, cx + sx * 104, H * 1.0, 1.7, false);                 // 手前の左右の釜 (画面の外へ切れる)
  A.part({ n: 20, col: "#8ae8d0", x0: 0.15, x1: 0.85, y0: 0.2, y1: 0.85, vy: -0.04, sway: 6, swf: 0.4, a: 0.5, tw: 1.4, seed: 91 });
  A.part({ n: 24, col: "#ffa050", x0: 0.1, x1: 0.9, y0: 0.1, y1: 0.9, vy: -0.08, sway: 6, swf: 0.5, a: 0.7, tw: 2.2, seed: 92 });
}
// w21 業火の大釜: 底の見えない穴の上に鎖で吊られた巨大な釜。穴の縁から業火が噴き上がる
function vInferno(R, A) {
  const { w: W, h: H } = R, cx = W / 2, py = Math.round(H * 0.84);
  // 底の見えない穴 (縁だけが赤く光る)
  R.m = SKY; R.ellipse(cx, py, W * 0.36, 11, (x, y) => { const d = Math.hypot((x - cx) / (W * 0.36), (y - py) / 11); return d > 0.86 ? mix(C("#a02808"), C("#ffb040"), (d - 0.86) * 7) : mix(C("#000000"), C("#2a0804"), clamp01((d - 0.3) * 1.4)); });
  // 鎖 (天井の闇から)
  for (const [x0, x1] of [[cx - 70, cx - 40], [cx - 16, cx - 12], [cx + 16, cx + 12], [cx + 70, cx + 40]]) chainSag(R, x0, 0, x1, H * 0.3, 2, "#4a3e3a");
  // 穴から噴き上がる業火 (釜の底を舐める)
  R.m = SKY;
  for (let x = cx - 70; x <= cx + 70; x++) {
    const t = Math.sqrt(Math.max(0, 1 - Math.abs(x - cx) / 71)), base = py - 10 * Math.sqrt(Math.max(0, 1 - ((x - cx) / (W * 0.36)) ** 2));
    const top = base - 8 - t * 34 - Math.max(0, Math.sin(x * 0.5)) * 14 * t - vnoise(x * 0.3, 2, 4) * 8 * t;
    R.rect(x, top, 1, base - top, (px, yy) => mix(C("#a02808"), C("#ffe090"), clamp01((yy - top) / (base - top) * 0.9)));
  }
  // 大釜 (炎の上に吊られている)
  kettle(R, A, cx, H * 0.62, 2.1, true, false);
  R.glow(cx, py - 10, W * 0.4, 30, "#ff5010", 0.4, 5); R.light(cx, py - 10, W * 0.5, "#ff6020", 1.4, 50);
  A.pulse((P) => { P.glow(cx, py - 14, W * 0.42, 34, "#c03008", 0.4); }, (t) => 0.5 + 0.5 * Math.sin(t * 0.0017));
  A.part({ n: 40, col: "#ffb050", x0: 0.15, x1: 0.85, y0: 0.2, y1: 0.85, vy: -0.1, sway: 8, swf: 0.5, a: 0.8, tw: 2.4, big: 0.15, seed: 93 });
}
// ---- 第六章「氷結回廊」(第8層・氷) ----
// 氷の柱 (透ける青白い氷。中に人影を閉じ込めることもある)。(x,by) = 足もとの中央、h = 高さ、w = 幅、fig = 人影の姿勢 (null = なし / -1 = 人の形に抜けた空洞)
function icePillar(R, x, by, h, w, fig = null, seed = 1) {
  R.m = SKY;
  R.rect(x - w / 2, by - h, w, h, (px, py) => {
    const u = clamp01((px + 0.5 - (x - w / 2)) / w), f = Math.min(3, Math.floor(u * 4));
    return mul(mix(C("#1e4a62"), C("#7ab4d0"), [0.6, 0.9, 0.55, 0.3][f] * (0.6 + 0.5 * vnoise(px * 0.3, py * 0.05, seed))), u < 0.1 || u > 0.9 ? 0.6 : 0.85);
  });
  if (fig !== null) {
    const s = h / 64, fy = by - 3 * s, P = (pts) => pts.map(([u, v]) => [x + u * s, fy - v * s]);
    const body = P([[-5.4, 0], [-4.4, 14], [-4.6, 28], [-6, 37], [-4, 40], [4, 40], [6, 37], [4.6, 28], [4.4, 14], [5.4, 0]]);
    const hx = x + (fig === 3 ? s : 0), hy = fy - (fig === 3 ? 44 : 46) * s;
    if (fig === -1) { // 人の形に抜けた空洞 (縁が白く光る)
      R.m = SKY; R.poly(body, "#0e2a3c", 0.7); R.ellipse(hx, hy, 3.2 * s, 3.9 * s, "#0e2a3c", 0.7);
      R.m = ADD; for (let k = 1; k < body.length; k++) R.line(body[k - 1][0], body[k - 1][1], body[k][0], body[k][1], "#a8e0f8", 0.7);
      for (let k = 0; k < 16; k++) { const a = k / 16 * TAU; R.px(hx + Math.cos(a) * 3.2 * s, hy + Math.sin(a) * 3.9 * s, "#a8e0f8", 0.7); }
      R.line(x - 2 * s, fy - 20 * s, x - 7 * s, fy - 26 * s, "#a8e0f8", 0.5); R.line(x + 2 * s, fy - 12 * s, x + 7 * s, fy - 6 * s, "#a8e0f8", 0.5); // 空洞から走るひび
    } else {
      R.m = SKY; R.poly(body, "#0a1626", 0.78); R.rect(x - 1.2 * s, fy - 44 * s, 2.4 * s, 4 * s, "#0a1626", 0.78);
      R.ellipse(hx, hy, 3.2 * s, 3.9 * s, "#0a1626", 0.78); R.ellipse(hx + 0.4 * s, hy + 0.5 * s, 2.1 * s, 2.7 * s, "#8aa8c0", 0.7);
      if (fig === 0) R.rect(x - 5 * s, fy - 29 * s, 10 * s, 3 * s, "#14243a", 0.8);
      if (fig === 2) { R.line(x + 6 * s, fy - 37 * s, x + 4 * s, fy - 43 * s, "#8aa8c0", 0.7, Math.max(1, Math.round(1.6 * s))); }
    }
  }
  R.m = SKY; R.rect(x - w / 2 + Math.round(w * 0.28), by - h, 1, h, "#c8ecfc", 0.45);
  R.m = SURF; R.ellipse(x, by, w * 0.8, 2.4, "#8ab4c8"); R.rect(x - w * 0.8, by - 1, w * 1.6, 1, "#c8e4f0", 0.6);
  R.glow(x, by - h * 0.5, w * 1.4, h * 0.6, "#2a7090", 0.18);
}
// w22 奈落の氷棚: 大釜の底の穴の下に開く縦穴。向かいの壁を螺旋に下る氷の棚。手前の棚から、雪が吹き上げる闇をのぞく
function vLedge(R, A) {
  const { w: W, h: H } = R, cx = W / 2;
  R.amb = [0.38, 0.48, 0.62];
  // 向かいの縦穴の壁 (縦に流れる氷。下ほど闇に沈む)
  R.m = SURF; R.rect(0, 0, W, H, (x, y) => mul(mix(C("#16263a"), C("#3c5874"), vnoise(x * 0.3, y * 0.03, 3) * 0.7), (0.65 + 0.35 * fbm(x * 0.05, y * 0.08, 5)) * (1 - 0.8 * clamp01(y / H))));
  // 螺旋に下る氷の棚 (円筒の壁なので、中ほどが垂れる弧)
  const r = rnd(41), hy = H * 0.66;   // 目の高さ: これより上の棚は中ほどが垂れ、下の棚は中ほどが持ち上がって見える
  for (let k = 0; k < 7; k++) {
    const yb = -4 + k * 19 + hash(k, 1, 41) * 5;
    for (let x = 0; x < W; x++) {
      const y = yb + x * 0.06 + Math.sin(x / W * Math.PI) * (hy - yb) * 0.32;
      if (y < 0 || y >= H) continue;
      const fade = clamp01(1 - y / (H * 0.85)) * (0.55 + 0.45 * vnoise(x * 0.12, k, 3));
      R.m = SURF; R.px(x, y, mix(C("#14202c"), C("#c8e4f4"), fade)); R.px(x, y + 1, mix(C("#0c141c"), C("#5a84a0"), fade)); R.px(x, y + 2, "#0a1018", fade * 0.6);
      if (r() < 0.16) spike(R, x, y + 2, 2 + r() * 6 * fade, 2, "#7ab0cc", 1, 1);
    }
  }
  // 底の見えない闇と、その奥で青白く光る氷
  R.m = SKY; for (let y = Math.floor(H * 0.55); y < H; y++) R.span(y, 0, W, "#02050a", clamp01((y - H * 0.55) / (H * 0.4)) * 0.85);
  R.glow(cx + 20, H * 1.05, W * 0.45, 30, "#2a6a9a", 0.4, 5); R.light(cx + 20, H * 1.05, W * 0.7, "#5aa8d8", 1.1, H * 0.7);
  // 上: 大釜の底の穴 (縁だけが火の名残で鈍く赤い)
  R.m = SKY; R.ellipse(cx + 16, -4, 46, 14, (x, y) => { const d = Math.hypot((x - cx - 16) / 46, (y + 4) / 14); return d > 0.82 ? mix(C("#401008"), C("#c04818"), (d - 0.82) * 5) : C("#080305"); });
  R.glow(cx + 16, 2, 50, 16, "#a03010", 0.25, 4); R.light(cx + 16, 0, 60, "#ff6020", 0.6, 30);
  // 手前の氷の棚 (左下から張り出す。上面は雪、正面は切子の氷、下につらら)
  const top = (x) => H * 0.74 + x * 0.06 + Math.sin(x * 0.2) * 0.8, tip = W * 0.62;
  R.m = SURF; R.poly([[0, top(0) - 6], [tip * 0.5, top(tip * 0.5) - 4], [tip, top(tip)], [tip - 6, top(tip) + 5], [0, H]], tex("#d8e8f4", "#a0bcd0", 0.2, 7));
  R.poly([[0, top(0) + 2], [tip - 6, top(tip) + 5], [tip - 14, top(tip) + 14], [W * 0.3, H], [0, H]], (x, y) => mix(C("#2a5a7a"), C("#8ac0dc"), clamp01(vnoise(x * 0.3, y * 0.2, 9) * 1.2 - 0.1)));
  for (let x = 4; x < tip - 8; x += 3 + Math.floor(r() * 4)) spike(R, x, top(x) + 3 + (x > tip * 0.6 ? 6 : 0), 4 + r() * 10, 2 + r() * 2, "#9ad0e8", 1, 1.2);
  R.m = SKY; R.line(0, top(0) - 6, tip, top(tip), "#f0f8ff", 0.6);
  R.light(W * 0.15, H * 0.7, 50, "#ffc080", 0.5, 30);  // 手元のランタン
  A.part({ n: 60, col: "#e8f6ff", x0: 0, x1: 1, y0: 0, y1: 1, vy: -0.08, vx: 0.01, sway: 10, swf: 0.5, a: 0.6, big: 0.12, seed: 95 });
  A.part({ n: 14, col: "#ffffff", x0: 0, x1: 1, y0: 0.1, y1: 0.95, vy: -0.16, a: 0.4, sz: 2, len: 2, seed: 96 });
}
// w23 凍れる操霊師の間: 氷の回廊の広間に氷柱が並び、ひとつずつ操霊師の人影が閉じ込められている。一本だけ空
function vFrozenHall(R, A) {
  const { w: W, h: H } = R, cx = W / 2, gy = Math.round(H * 0.56);
  const list = [];
  for (const z of [3.2, 2.2, 1.5, 1]) for (const s of [-1, 1]) list.push([s, z]);
  let i = 0;
  for (const [s, z] of list) {
    const x = cx + s * W * 0.36 / z, by = gy + 30 / z, h = 74 / z, w = 15 / z;
    const empty = s === 1 && z === 1.5;
    icePillar(R, x, by, h, w, empty ? -1 : (i++ * 3 + 1) % 4, 30 + i);
  }
  R.light(cx, gy - 10, W * 0.5, "#8ad0f0", 0.8, H * 0.5);
  A.part({ n: 16, col: "#c8f0ff", x0: 0.15, x1: 0.85, y0: 0.2, y1: 0.9, a: 0.6, blink: 0.6, seed: 97 });
}
// w24 極光の氷窟: 氷窟の天井に揺らめく極光 (氷に閉じ込められた魂の光)。氷の床がそれを映す
function vAurora(R, A) {
  const { w: W, h: H } = R, cx = W / 2, gy = Math.round(H * 0.66);
  R.amb = [0.3, 0.42, 0.55];
  // 天井の氷 (闇に沈む切子)
  R.m = SURF; R.rect(0, 0, W, gy, (x, y) => { const v = vnoise(x * 0.09 + y * 0.03, y * 0.08, 7); return mul(mix(C("#0a1424"), C("#24405a"), v), 0.7 + 0.3 * (Math.floor(v * 5) % 2)); });
  // 極光の帳 (緑 → 青 → 紫。縦の光の筋)
  const cur = (x, y) => {
    let c = [0, 0, 0];
    for (const [y0, amp, fr, ph, k] of [[H * 0.4, 8, 0.05, 0.4, 1], [H * 0.26, 6, 0.07, 2.3, 0.8], [H * 0.52, 4, 0.08, 4.1, 0.5]]) {
      const base = y0 + Math.sin(x * fr + ph) * amp + Math.sin(x * fr * 2.7 + ph) * amp * 0.35, d = base - y;
      if (d < -2) continue;
      const ray = 0.4 + 0.6 * Math.pow(vnoise(x * 0.5 + ph * 3, ph, 7), 1.4), f = (d < 0 ? 1 + d / 2 : Math.exp(-d / 14)) * ray * k;
      const col = d < 4 ? C("#60ffa0") : d < 11 ? mix(C("#40e0c8"), C("#4a8cff"), (d - 4) / 7) : mix(C("#4a8cff"), C("#9a5ae8"), clamp01((d - 11) / 10));
      c = [c[0] + col[0] * f, c[1] + col[1] * f, c[2] + col[2] * f];
    }
    return c;
  };
  R.m = ADD; R.rect(0, 0, W, gy, (x, y) => mul(cur(x, y), Math.floor(0.9 * 6 + bayer(x, y)) / 6), 0.9);
  R.light(cx, H * 0.35, W * 0.7, "#60e8b0", 1.0, H * 0.5); R.light(W * 0.2, H * 0.2, 60, "#9a6ae0", 0.6, 50);
  // 天井の氷のひび (極光を透かして白く光る筋)
  const r = rnd(43);
  R.m = ADD;
  for (let i = 0; i < 22; i++) { let x = r() * W, y = r() * gy * 0.8; for (let k = 0; k < 4; k++) { const nx = x + (r() - 0.5) * 18, ny = y + (r() - 0.3) * 8; R.line(x, y, nx, ny, "#5a8aa0", 0.35); x = nx; y = ny; } }
  for (let i = 0; i < 40; i++) { const x = r() * W; spike(R, x, -1, 3 + r() * (Math.abs(x - cx) / cx) * 18, 2 + r() * 3, "#5a8aa8", 1, 1); }
  // 両側の氷の壁 (極光を背に暗い)
  for (const s of [-1, 1]) {
    const pts = [];
    for (let y = 0; y <= H; y += 4) pts.push([s < 0 ? 18 + (y / H) ** 2 * 16 + vnoise(1, y * 0.2, 3) * 6 : W - 20 - (y / H) ** 2 * 14 - vnoise(2, y * 0.2, 5) * 6, y]);
    R.m = SURF; R.poly(s < 0 ? [[0, 0], ...pts, [0, H]] : [[W, 0], ...pts, [W, H]], (x, y) => mul(mix(C("#101c2c"), C("#2a4660"), vnoise(x * 0.2, y * 0.1, 9)), 0.8));
  }
  // 床: 極光を映す氷 (行ごとに揺れ、ところどころ途切れる)
  R.m = SKY;
  for (let y = gy; y < H; y++) {
    const d = y - gy, sy = gy - 1 - d * 1.6, k = (Math.sin(y * 2.1) > 0.7 ? 0.12 : 0.45) * (1 - d / (H - gy) * 0.6);
    R.span(y, 0, W, (x) => { const c = cur(x - Math.sin(y * 1.3) * 2, sy); return [12 + c[0] * k, 22 + c[1] * k, 34 + c[2] * k]; });
  }
  R.m = SKY; for (let i = 0; i < 18; i++) { const y = gy + 3 + r() * (H - gy - 4), x = r() * W; R.rect(x, y, 6 + r() * 20, 1, "#8ac8d8", 0.25); } // 氷の床の照り
  R.m = SKY; R.rect(0, gy, W, 1, "#5a9aa8", 0.6);
  A.part({ n: 30, col: "#e0fff0", x0: 0.1, x1: 0.9, y0: 0.05, y1: 0.55, vy: -0.01, sway: 6, swf: 0.3, a: 0.7, tw: 1.6, seed: 98 });
  A.pulse((P) => { P.glow(cx, H * 0.36, W * 0.4, 20, "#40d0a0", 0.25); }, (t) => 0.5 + 0.5 * Math.sin(t * 0.0011));
}
// w25 凍てつく大回廊: 氷の回廊の果てに、氷の玉座。冠をかぶった老いた操霊師が坐り、凍った先人たちを見張る
function vGlacialThrone(R, A) {
  const { w: W, h: H } = R, cx = W / 2, gy = Math.round(H * 0.56);
  // 玉座へ続く氷の段と、磨かれた床の道
  R.m = SURF; R.poly([[cx - 10, gy], [cx + 10, gy], [cx + 46, H], [cx - 46, H]], (x, y) => mul(C("#4a7a94"), 0.75 + 0.35 * vnoise(x * 0.1, y * 0.4, 3)));
  R.m = SKY; R.line(cx - 10, gy, cx - 46, H, "#a8d8ec", 0.5); R.line(cx + 10, gy, cx + 46, H, "#a8d8ec", 0.5);
  for (let k = 0; k < 3; k++) { R.m = SURF; R.rect(cx - 16 - k * 3, gy - 4 - k * 3, 32 + k * 6, 3, "#7ab0c8"); R.rect(cx - 16 - k * 3, gy - 4 - k * 3, 32 + k * 6, 1, "#d0ecf8"); }
  // 玉座 (尖った氷の背)
  const ty = gy - 13;
  R.m = SKY; R.poly([[cx - 12, ty], [cx - 13, ty - 22], [cx - 9, ty - 30], [cx - 6, ty - 25], [cx - 3, ty - 36], [cx, ty - 28], [cx + 3, ty - 38], [cx + 6, ty - 26], [cx + 9, ty - 32], [cx + 13, ty - 22], [cx + 12, ty]],
    (x, y) => mix(C("#3a7a9a"), C("#c8ecfc"), clamp01(0.4 + (cx - x) / 30 + vnoise(x * 0.4, y * 0.2, 5) * 0.4)));
  R.m = SURF; R.rect(cx - 15, ty - 4, 30, 6, "#8ac0d8"); R.rect(cx - 15, ty - 4, 30, 1, "#e0f4fc");
  // 凍王 (青灰の衣・白いひげ・氷の冠)
  R.m = SURF; R.poly([[cx - 5, ty - 18], [cx + 5, ty - 18], [cx + 7, ty - 8], [cx + 8, ty], [cx - 8, ty], [cx - 7, ty - 8]], "#3e3a52");
  R.ellipse(cx, ty - 21, 3, 3.6, "#c8c0ba"); R.poly([[cx - 2.4, ty - 19], [cx + 2.4, ty - 19], [cx, ty - 13]], "#e8eef4");
  R.m = SKY; for (let k = 0; k < 4; k++) R.rect(cx - 3 + k * 2, ty - 27 + (k % 3 ? 1 : 0), 1, 3, "#d8f4ff"); R.rect(cx - 3, ty - 24, 7, 1, "#a8e0f8");
  R.glow(cx, ty - 22, 14, 10, "#9ae0ff", 0.35, 4); R.glow(cx, ty - 16, 40, 34, "#2a7aa8", 0.3, 5);
  R.light(cx, ty - 20, 90, "#a8e8ff", 1.2, 70);
  // 回廊の両側に立つ氷柱の人影 (凍った先人たち)
  for (const [s, z] of [[-1, 2.4], [1, 2.4], [-1, 1.6], [1, 1.6]]) icePillar(R, cx + s * W * 0.3 / z, gy + 26 / z, 60 / z, 12 / z, (z * 10 | 0) % 4, 50 + z);
  A.part({ n: 40, col: "#e8f6ff", x0: 0, x1: 1, y0: 0, y1: 1, vy: 0.03, vx: -0.01, sway: 10, swf: 0.4, a: 0.5, big: 0.12, seed: 99 });
  A.flick(cx, ty - 23, 6, "#c8f0ff", 0.4, 0.5);
}
// ---- 各層の寄り道 (ws6〜ws8) ----
// ws6 見捨てられた狼煙台: 砦の外れの石の塔。頂の火皿で、援軍を呼ぶ火が百年燃えている
function vBeacon(R, A) {
  const { w: W, h: H } = R, cx = W / 2, by = Math.round(H * 0.76);
  const st = tex("#5a5450", "#2e2a28", 0.25, 101);
  R.m = SURF; R.poly([[cx - 14, by], [cx - 10, by - 70], [cx + 10, by - 70], [cx + 14, by]], st);
  for (let y = by - 64; y < by; y += 7) R.rect(cx - 12, y, 24, 1, "#1e1a18", 0.6);
  R.rect(cx + 8, by - 70, 1, 70, "#8a7a6a", 0.5);
  R.rect(cx - 18, by - 76, 36, 6, "#3a3230"); R.rect(cx - 18, by - 76, 36, 1, "#7a6a5a");
  for (let i = 0; i < 9; i++) { R.m = SURF; R.ellipse(cx + 8 + i * 11, by - 108 - i * 4, 8 + i * 1.6, 5 + i, "#3a3434", 0.5 - i * 0.04); } // 風下へたなびく煙
  const fy = by - 77;
  R.m = SKY; R.poly([[cx - 16, fy], [cx - 12, fy - 14], [cx - 6, fy - 10], [cx - 2, fy - 28], [cx + 4, fy - 16], [cx + 9, fy - 22], [cx + 12, fy - 8], [cx + 16, fy]],
    (px, py) => mix(C("#c03010"), C("#fff0b0"), clamp01((py - (fy - 28)) / 28 * 0.6 + (1 - Math.abs(px - cx) / 16) * 0.5)));
  R.glow(cx, fy - 10, 60, 40, "#ff6020", 0.45, 5); R.light(cx, fy - 10, 140, "#ff8030", 1.4, 100);
  A.flick(cx, fy - 10, 20, "#ff9040", 0.5, 0.9);
  ghost(R, cx - 32, by + 8, 24, "#e0a070", 0.4); ghost(R, cx + 34, by + 10, 22, "#e0a070", 0.36); // 薪を抱えた火の番
  A.part({ n: 36, col: "#ffb050", x0: 0.4, x1: 0.62, y0: 0.05, y1: 0.35, vy: -0.08, sway: 6, swf: 0.6, a: 0.8, tw: 2.4, seed: 103 });
}
// ws7 獄吏の詰所: 鍵束を掛けた板と、押収品を納めた鉄帯の箱。見回りを続ける獄吏の骸
function vGuardroom(R, A) {
  const { w: W, h: H } = R, cx = W / 2, gy = Math.round(H * 0.62);
  R.amb = [0.35, 0.33, 0.38];
  bricks(R, 0, 0, W, gy, "#3a3638", "#141214", 14, 6, 111);
  R.m = SURF; R.rect(0, gy, W, H - gy, tex("#2a2624", "#161412", 0.15, 112)); R.rect(0, gy, W, 1, "#4a4440");
  R.rect(cx - 40, gy - 50, 80, 14, tex("#5a4026", "#3a2a18", 0.3, 113)); R.rect(cx - 40, gy - 50, 80, 1, "#7a5a36");
  for (let i = 0; i < 7; i++) {
    const x = cx - 34 + i * 11;
    R.m = SURF; R.rect(x, gy - 47, 1, 3, "#2a2a2a"); R.ellipse(x + 0.5, gy - 40, 4, 4, "#8a7a50"); R.ellipse(x + 0.5, gy - 40, 2.6, 2.6, "#3a2a18");
    for (let k = 0; k < 3; k++) R.rect(x - 1 + k * 1.5, gy - 37 + k, 1, 4, "#a89060");
  }
  for (const [x, y, w, h] of [[cx - 72, gy + 16, 28, 16], [cx - 38, gy + 22, 24, 14], [cx + 10, gy + 20, 26, 15], [cx + 44, gy + 14, 30, 17], [cx - 12, gy + 36, 30, 17]]) {
    R.m = SURF; R.rect(x, y - h, w, h, tex("#5a3e24", "#3a2614", 0.3, x | 0)); R.rect(x, y - h, w, 2, "#7a5a36");
    R.rect(x, y - h + Math.round(h * 0.5), w, 1, "#2a2a2a"); for (const dx of [2, w - 4]) R.rect(x + dx, y - h, 2, h, "#4a4a4a");
    R.rect(x + w / 2 - 1, y - h + 3, 3, 3, "#c0a050");
  }
  const lx = cx, ly = gy - 66;
  R.m = SURF; R.line(lx, 0, lx, ly, "#2a2420"); R.rect(lx - 3, ly, 7, 7, "#2a2620");
  R.m = SKY; R.rect(lx - 2, ly + 1, 5, 5, "#ffd890");
  R.glow(lx, ly + 3, 30, 26, "#c07a20", 0.45, 5); R.light(lx, ly + 4, 150, "#ffb050", 1.2, 110); A.flick(lx, ly + 4, 10, "#ffb050", 0.4, 0.8);
  hooded(R, cx + 88, gy + 34, 44, "#2a2a30", "#6a6a80"); hooded(R, cx - 92, gy + 38, 48, "#2a2a30", "#6a6a80");
}
// ws8 沈んだ書庫: 水に沈んだ書架。封をした書の箱が並び、開いた一冊が青く光って漂う
function vDrownedLib(R, A) {
  const { w: W, h: H } = R, cx = W / 2, by = Math.round(H * 0.86);
  R.post.push((out) => { // 水の底: 青緑へ寄せる
    for (let i = 0; i < out.length; i += 3) { const l = out[i] * 0.3 + out[i + 1] * 0.5 + out[i + 2] * 0.2; out[i] = l * 0.45 + out[i] * 0.2; out[i + 1] = l * 0.85 + out[i + 1] * 0.15 + 4; out[i + 2] = l * 0.95 + out[i + 2] * 0.2 + 10; }
  });
  for (const [x, y, w, h] of [[cx - 62, by, 22, 12], [cx - 36, by + 6, 20, 11], [cx + 14, by + 4, 24, 12], [cx + 44, by - 2, 20, 11], [cx - 12, by - 8, 22, 10]]) {
    R.m = SURF; R.rect(x, y - h, w, h, tex("#5a4430", "#2e2218", 0.3, x | 0)); R.rect(x, y - h, w, 1, "#8a7050");
    R.rect(x + w / 2 - 2, y - h + 2, 4, 4, "#7a1810"); R.rect(x + w / 2 - 1, y - h + 3, 2, 2, "#b03020");
  }
  const bx = cx, bky = Math.round(H * 0.42);
  R.m = SURF; R.poly([[bx - 16, bky + 2], [bx - 14, bky - 6], [bx, bky - 4], [bx + 14, bky - 6], [bx + 16, bky + 2], [bx, bky + 4]], "#d8d0b0"); R.line(bx, bky - 4, bx, bky + 4, "#8a8070");
  for (let i = 0; i < 3; i++) { R.rect(bx - 12, bky - 3 + i * 2, 9, 1, "#5a5a6a", 0.6); R.rect(bx + 3, bky - 3 + i * 2, 9, 1, "#5a5a6a", 0.6); }
  R.glow(bx, bky, 34, 22, "#80c0e0", 0.4, 5); R.light(bx, bky, 90, "#a0d8f0", 1, 70);
  R.m = ADD; for (const x0 of [W * 0.28, W * 0.55, W * 0.72]) R.poly([[x0, 0], [x0 + 8, 0], [x0 + 28, H], [x0 + 16, H]], "#4a8a9a", 0.12);
  A.part({ n: 24, col: "#a8e8f0", x0: 0.15, x1: 0.85, y0: 0.2, y1: 0.95, vy: -0.08, sway: 4, swf: 0.6, a: 0.5, ring: true, big: 0.3, seed: 121 });
}
// ws9 黒曜の切り場: 冷えて固まった黒いガラスの崖。割れ口が溶岩の照り返しで紫に光る
function vObsidian(R, A) {
  const { w: W, h: H } = R, cx = W / 2, gy = Math.round(H * 0.72), r = rnd(131);
  const shard = (x, by, h, w, lean) => {
    R.m = SURF;
    R.poly([[x - w, by], [x - w * 0.6 + lean * 0.4, by - h * 0.6], [x + lean, by - h], [x + w * 0.5 + lean * 0.6, by - h * 0.55], [x + w, by]],
      (px, py) => mix(C("#0a0810"), C("#2a2038"), clamp01(vnoise(px * 0.2, py * 0.1, 3) * 0.8)));
    R.m = SKY; R.line(x - w * 0.6 + lean * 0.4, by - h * 0.6, x + lean, by - h, "#c070a0", 0.7); R.line(x + lean, by - h, x + w * 0.5 + lean * 0.6, by - h * 0.55, "#ff8060", 0.5);
    R.line(x + lean * 0.5 - 1, by - h * 0.5, x + lean * 0.2, by - h * 0.1, "#6a5080", 0.4);
  };
  for (const [x, h, w, l] of [[cx - 72, 40, 10, -4], [cx - 46, 62, 13, 3], [cx - 14, 82, 14, -2], [cx + 18, 70, 12, 5], [cx + 50, 54, 12, -3], [cx + 78, 36, 9, 2]]) shard(x, gy, h, w, l);
  for (let i = 0; i < 10; i++) shard(cx + (r() - 0.5) * 190, gy + 8 + r() * 22, 8 + r() * 14, 3 + r() * 3, (r() - 0.5) * 4);
  R.m = SKY; R.rect(0, gy + 2, W, 2, "#ff6020", 0.4);
  R.glow(cx, gy + 10, W * 0.5, 20, "#ff4010", 0.4, 5); R.light(cx, gy + 10, W * 0.6, "#ff6030", 1.1, 60);
  A.part({ n: 20, col: "#e0a0ff", x0: 0.2, x1: 0.8, y0: 0.2, y1: 0.7, a: 0.6, tw: 3, seed: 133 });
  A.part({ n: 24, col: "#ffb050", x0: 0.1, x1: 0.9, y0: 0.5, y1: 0.95, vy: -0.06, sway: 5, swf: 0.5, a: 0.7, tw: 2, seed: 134 });
}
// ws10 火守りの僧院: 石の火皿に燃える祈りの火。炎の中に淡い顔が浮かび、頭巾の火守りが祈り続ける
function vPyreAbbey(R, A) {
  const { w: W, h: H } = R, cx = W / 2, by = Math.round(H * 0.8);
  R.m = SURF; R.poly([[cx - 18, by - 14], [cx + 18, by - 14], [cx + 12, by - 6], [cx - 12, by - 6]], "#4a3a34"); R.rect(cx - 4, by - 6, 8, 8, "#3a2e2a"); R.rect(cx - 10, by + 1, 20, 3, "#4a3a34"); R.rect(cx - 18, by - 14, 36, 1, "#8a6a50");
  const fy = by - 15;
  R.m = SKY; R.poly([[cx - 16, fy], [cx - 11, fy - 18], [cx - 5, fy - 12], [cx - 1, fy - 34], [cx + 5, fy - 20], [cx + 10, fy - 26], [cx + 13, fy - 10], [cx + 16, fy]],
    (px, py) => mix(C("#c03010"), C("#fff0b0"), clamp01((py - (fy - 34)) / 34 * 0.6 + (1 - Math.abs(px - cx) / 16) * 0.5)));
  R.m = ADD; for (const [dx, dy] of [[-5, -16], [5, -22], [0, -9]]) { R.ellipse(cx + dx, fy + dy, 2.6, 3.2, "#ffe0c0", 0.35); R.px(cx + dx - 1, fy + dy - 1, "#401008", 0.5); R.px(cx + dx + 1, fy + dy - 1, "#401008", 0.5); }
  R.glow(cx, fy - 14, 70, 50, "#ff6020", 0.45, 5); R.light(cx, fy - 14, 150, "#ff8030", 1.4, 110); A.flick(cx, fy - 14, 18, "#ff9040", 0.5, 0.9);
  for (const [dx, dy, h] of [[-62, 8, 30], [-36, 0, 24], [36, 0, 24], [62, 8, 30]]) hooded(R, cx + dx, by + dy, h, "#4a2a24", "#c07050");
  A.part({ n: 30, col: "#ffb050", x0: 0.4, x1: 0.6, y0: 0.1, y1: 0.6, vy: -0.1, sway: 6, swf: 0.6, a: 0.8, tw: 2.4, seed: 141 });
}
function wolf(R, x, by, s, dir) { // 白霜の狼 (横向き。dir = 1 右向き / -1 左向き)
  const c = "#8aa0b4", d = "#3a4e62";
  R.m = SURF;
  R.taper(x - dir * 8 * s, by - 7 * s, x - dir * 15 * s, by - 4 * s, 3 * s, 1.5 * s, c);
  for (const lx of [-6, -3, 4, 7]) R.rect(x + dir * lx * s - 0.5 * s, by - 4 * s, 1.5 * s, 4 * s, lx % 2 ? c : d);
  R.ellipse(x, by - 6 * s, 9 * s, 4 * s, c);
  R.ellipse(x + dir * 9 * s, by - 9 * s, 4 * s, 3 * s, c);
  R.poly([[x + dir * 10 * s, by - 9 * s], [x + dir * 15 * s, by - 7.5 * s], [x + dir * 10 * s, by - 6 * s]], c);
  R.poly([[x + dir * 7.5 * s, by - 11 * s], [x + dir * 8.5 * s, by - 14.5 * s], [x + dir * 10.5 * s, by - 11.5 * s]], c);
  R.rect(x - 8 * s, by - 3 * s, 16 * s, 1, d, 0.6); R.ellipse(x + dir * 2 * s, by - 9 * s, 7 * s, 1.2 * s, "#d8e8f4", 0.8); // 背の霜
  R.m = SKY; R.px(x + dir * 11 * s, by - 10 * s, "#a0e8ff"); R.glow(x + dir * 11 * s, by - 10 * s, 4, 3, "#80d0ff", 0.6, 3);
}
// ws11 白狼の吹き溜まり: 奈落の壁のくぼみの雪だまり。落とし物の突き出た雪の上を、白霜の狼が渡る
function vWolfDrift(R, A) {
  const { w: W, h: H } = R, cx = W / 2, by = Math.round(H * 0.84);
  R.m = SURF; R.poly([[0, H], [0, by - 6], [cx - 60, by - 18], [cx - 20, by - 30], [cx + 30, by - 26], [cx + 80, by - 12], [W, by - 4], [W, H]],
    (x, y) => mix(C("#7a98b0"), C("#e0eef8"), clamp01(1 - (y - (by - 30)) / 50 + (vnoise(x * 0.1, y * 0.2, 5) - 0.5) * 0.4)));
  R.m = SURF; R.rect(cx - 30, by - 36, 5, 7, "#4a3424"); R.rect(cx - 31, by - 31, 8, 2, "#3a2a1c");
  R.poly([[cx + 12, by - 27], [cx + 20, by - 36], [cx + 26, by - 29]], "#5a2a2a"); R.line(cx + 40, by - 24, cx + 46, by - 46, "#6a5a40", 1, 1);
  wolf(R, cx - 58, by - 15, 1.3, 1); wolf(R, cx + 66, by - 14, 1.4, -1); wolf(R, cx + 2, by - 26, 1.0, 1);
  R.light(cx, by - 30, 120, "#c0e0ff", 0.6, 60);
  A.fog("#e0f0ff", 0.82, 5, 0.2, 6, 120, 12);
  A.part({ n: 70, col: "#f0f8ff", x0: 0, x1: 1, y0: 0, y1: 1, vy: 0.05, vx: 0.04, sway: 10, swf: 0.5, a: 0.6, big: 0.15, seed: 151 });
}
// ws12 氷河の裂け目: 氷の壁に走る深い裂け目。雪解けの細い滝が落ち、氷の中の魂が光る。抜け落ちた者たちが裂け目へ歩く
function vCrevasse(R, A) {
  const { w: W, h: H } = R, cx = W / 2;
  R.amb = [0.4, 0.5, 0.62];
  R.m = SKY; R.poly([[cx - 30, 0], [cx + 28, 0], [cx + 10, H * 0.8], [cx - 8, H * 0.8]], (x, y) => mix(C("#0a1e2e"), C("#02060a"), clamp01(y / (H * 0.8))));
  R.m = SURF; R.poly([[0, 0], [cx - 30, 0], [cx - 24, H * 0.3], [cx - 14, H * 0.55], [cx - 8, H * 0.8], [cx - 30, H], [0, H]], (x, y) => mix(C("#2a5a7a"), C("#9ad0e8"), clamp01(vnoise(x * 0.12, y * 0.05, 7) * 0.9 + x / cx * 0.3 - 0.2)));
  R.poly([[W, 0], [cx + 28, 0], [cx + 22, H * 0.32], [cx + 14, H * 0.58], [cx + 10, H * 0.8], [cx + 34, H], [W, H]], (x, y) => mul(mix(C("#1e4a64"), C("#7ab4d0"), clamp01(vnoise(x * 0.12, y * 0.05, 8) * 0.9)), 0.8));
  R.m = SKY; R.line(cx - 30, 0, cx - 8, H * 0.8, "#d0f0ff", 0.6); R.line(cx + 28, 0, cx + 10, H * 0.8, "#5a9ab8", 0.5);
  R.m = SKY; R.rect(cx - 1, 0, 3, H * 0.8, (x, y) => mix(C("#6ab0d0"), C("#e0f8ff"), vnoise(x, y * 0.2, 4)), 0.7);
  R.glow(cx, H * 0.8, 26, 8, "#a0e0ff", 0.4, 4);
  const r = rnd(161);
  for (let i = 0; i < 16; i++) { const left = r() < 0.5, x = left ? r() * (cx - 40) : cx + 40 + r() * (cx - 40), y = r() * H * 0.9; R.glow(x, y, 4, 4, "#a0f0d0", 0.5, 3); R.m = SKY; R.px(x, y, "#e0fff0"); }
  R.m = SURF; R.poly([[cx - 40, H], [cx - 8, H * 0.8], [cx + 10, H * 0.8], [cx + 44, H]], tex("#a8c8dc", "#6a8aa0", 0.2, 9));
  ghost(R, cx - 24, H * 0.98, 34, "#a8d8f0", 0.45); ghost(R, cx + 22, H * 0.94, 28, "#a8d8f0", 0.4); ghost(R, cx + 2, H * 0.86, 18, "#a8d8f0", 0.35);
  R.light(cx, H * 0.5, 100, "#80c8f0", 0.9, 90);
  A.part({ n: 20, col: "#c8f0ff", x0: 0.47, x1: 0.53, y0: 0, y1: 0.8, vy: 0.3, a: 0.4, sz: 2, len: 2, seed: 162 });
  A.part({ n: 30, col: "#e8f6ff", x0: 0, x1: 1, y0: 0, y1: 1, vy: 0.03, sway: 8, swf: 0.4, a: 0.4, big: 0.1, seed: 163 });
}
// ---- 第七章「毒沼」(第9層・土) ----
// 作りかけの人業 (腰を下ろした胴と、のっぺりした球の頭)。chest = 胸の印の金の照り
function swampDoll(R, x, by, s, { head = true, chest = true, col = "#8a7458", lean = 0 } = {}) {
  const c = C(col), d = mul(c, 0.6), P = (u, v) => [x + (u + v * lean) * s, by - v * s];
  R.m = SURF;
  R.poly([P(-3.4, 0), P(3.4, 0), P(3, 5), P(4.6, 9), P(5, 12), P(-5, 12), P(-4.6, 9), P(-3, 5)], (px, py) => mul(c, 0.7 + 0.45 * clamp01((x - px) / (6 * s) + 0.5) + 0.1 * vnoise(px * 0.5, py * 0.3, 3)));
  R.rect(...P(-5.2, 0), 10.4 * s, 1.6 * s, d);                                     // 投げ出した脚
  if (head) { const [hx, hy] = P(0, 16.4); R.ellipse(hx, hy, 3.4 * s, 3.6 * s, (px, py) => mul(c, 0.8 + 0.3 * clamp01((hx - px) / (3 * s) + 0.5))); R.rect(hx - 1 * s, hy + 3 * s, 2 * s, 1.4 * s, "#2a2a30"); }
  for (const sd of [-1, 1]) { const [ax, ay] = P(sd * 6, 11); R.line(ax, ay, ax + sd * 0.6 * s, ay + 8 * s, d, 1, Math.max(1, Math.round(1.6 * s))); }
  if (chest) { const [cx2, cy2] = P(0, 7.6); R.m = SKY; R.px(cx2, cy2, "#c89640"); if (s > 1.2) { R.px(cx2 - 1, cy2, "#a87830"); R.px(cx2 + 1, cy2, "#a87830"); R.px(cx2, cy2 - 1, "#ffe090"); R.glow(cx2, cy2 - 1, 2.4 * s, 2.4 * s, "#c08a30", 0.25, 3); } }
}
// 葦の茂み (根元 y、手前ほど濃い)。col = 茎の色
function reedBank(R, seed, n, x0, x1, by, hmin, hmax, col, cat = "#2a1a10") {
  const r = rnd(seed), c = C(col); R.m = SURF;
  for (let i = 0; i < n; i++) {
    const x = x0 + r() * (x1 - x0), h = hmin + r() * (hmax - hmin), lean = (r() - 0.5) * 0.5, b = by + r() * 4;
    R.line(x, b, x + lean * h, b - h, mul(c, 0.7 + r() * 0.5));
    if (r() < 0.5) { const t = 0.3 + r() * 0.4, sx = x + lean * h * t, sy = b - h * t, d = r() < 0.5 ? -1 : 1; R.line(sx, sy, sx + d * h * 0.25, sy - h * 0.12, mul(c, 0.8)); R.line(sx + d * h * 0.25, sy - h * 0.12, sx + d * h * 0.36, sy - h * 0.02, mul(c, 0.7)); }
    if (r() < 0.3) R.rect(Math.round(x + lean * h * 0.85) - 1, Math.round(b - h * 0.85) - 1, 2, 4, cat);
  }
}
// w26 腐れ水の岸: 上の闇から雪解けの滝が落ち、黒い泥の岸を浸す。泥は底まで落ちて腐った魂
function vBogShore(R, A) {
  const { w: W, h: H } = R, cx = W / 2, gy = Math.round(H * 0.56);
  // 滝 (はるか上の氷の棚から。下ほど広がり、水際で白いしぶき)
  R.m = SKY;
  for (let y = 0; y < gy + 2; y++) { const t = y / gy, hw = 3 + t * 6; R.span(y, cx - hw + t * 3, cx + hw + t * 3, (x) => mix(C("#6a8a88"), C("#e0f0ee"), vnoise(x * 0.9, y * 0.08 - x * 0.1, 7) * (0.6 + 0.4 * t))); }
  R.m = SKY; for (let k = 0; k < 5; k++) { const x = cx - 10 + k * 5; R.poly([[x - 2, 0], [x + 2, 0], [x, 3 + hash(k, 1, 8) * 6]], "#a8c8c8"); }   // 落ち口の解けかけた氷
  R.glow(cx + 3, gy, 30, 10, "#a0d0c8", 0.5, 5); R.light(cx + 3, gy - 6, 80, "#b8e0d8", 1, 60);
  R.m = SKY; R.ellipse(cx + 3, gy + 1, 16, 3, "#c8e0dc", 0.6);
  // 手前の黒い泥の岸 (濡れて光る。ところどころ毒の水溜まり)
  R.m = SURF; R.poly([[0, H], [0, H * 0.8], [W * 0.2, H * 0.76], [W * 0.45, H * 0.8], [W * 0.7, H * 0.77], [W, H * 0.82], [W, H]], tex("#2a2618", "#141208", 0.12, 31));
  R.m = SKY; R.line(0, H * 0.8, W * 0.2, H * 0.76, "#4a5a2a", 0.6); R.line(W * 0.2, H * 0.76, W * 0.45, H * 0.8, "#4a5a2a", 0.6); R.line(W * 0.45, H * 0.8, W * 0.7, H * 0.77, "#4a5a2a", 0.6);
  R.m = SKY; for (const [x, y, rx] of [[W * 0.3, H * 0.9, 14], [W * 0.72, H * 0.93, 10]]) { R.ellipse(x, y, rx, 2.2, "#1a2410"); R.rect(x - rx * 0.5, y - 1, rx * 0.7, 1, "#a0c050", 0.5); }
  // 泥に沈みかけた折れた氷のかけら (溶けて泥と混じる)
  R.m = SURF; for (const [x, y] of [[W * 0.4, H * 0.84], [W * 0.55, H * 0.87]]) { R.poly([[x - 6, y], [x - 2, y - 3], [x + 5, y - 2], [x + 7, y]], "#7a9a98"); R.line(x - 2, y - 3, x + 5, y - 2, "#d0e8e8", 0.7); }
  A.part({ n: 26, col: "#d8f0ec", x0: 0.47, x1: 0.56, y0: 0, y1: 0.56, vy: 0.4, a: 0.45, sz: 2, len: 3, seed: 171 });
  A.part({ n: 14, col: "#e8f8f0", x0: 0.42, x1: 0.62, y0: 0.5, y1: 0.58, vy: -0.03, sway: 4, swf: 1.2, a: 0.5, seed: 172 });
}
// w27 器の捨て場: 沼のほとりの谷に、作りかけの人業が山と積まれる。胸にはみな同じ金の印。ひとつが起き上がる
function vDollDump(R, A) {
  const { w: W, h: H } = R, cx = W / 2;
  R.amb = [0.42, 0.46, 0.36];
  R.m = SKY; R.vgrad(0, 0, W, H, [[0, "#050804"], [0.45, "#1c2a12"], [1, "#0a0c06"]]);
  R.glow(cx, H * 0.38, W * 0.5, 30, "#5a7a20", 0.35, 5);
  // 谷の両側の泥の斜面
  R.m = SURF;
  R.poly([[0, 0], [W * 0.22, 0], [W * 0.3, H * 0.4], [W * 0.18, H], [0, H]], (x, y) => mul(mix(C("#2a2418"), C("#141008"), vnoise(x * 0.3, y * 0.05, 3)), 0.9));
  R.poly([[W, 0], [W * 0.78, 0], [W * 0.7, H * 0.42], [W * 0.84, H], [W, H]], (x, y) => mul(mix(C("#2a2418"), C("#141008"), vnoise(x * 0.3, y * 0.05, 4)), 0.8));
  // 器の山 (手足と頭が絡み合う)
  const hill = (x) => H * 0.42 + Math.abs(x - cx) * 0.42;
  R.m = SURF; R.poly([[W * 0.12, H], [cx - 30, hill(cx - 30)], [cx, hill(cx) - 2], [cx + 30, hill(cx + 30)], [W * 0.88, H]], tex("#2e2618", "#1a140c", 0.2, 5));
  const r = rnd(181);
  for (let i = 0; i < 140; i++) {
    const x = cx + (r() - 0.5) * W * 0.7, y = hill(x) + 2 + r() * (H - hill(x)), k = r();
    const c = mul(C("#7a6448"), 0.45 + 0.4 * (y / H)), a = r() * Math.PI;
    R.m = SURF;
    if (k < 0.6) R.line(x, y, x + Math.cos(a) * 5, y + Math.sin(a) * 3, c, 1, 2);
    else if (k < 0.85) R.ellipse(x, y, 2.2, 2.4, c);
    else { R.rect(x - 2.5, y - 3, 5, 6, c); R.m = SKY; R.px(x, y - 1, "#c89a40", 0.8); }
  }
  // 山の上に坐らされた器の列 (どれも胸に金の印)
  for (let i = 0; i < 7; i++) { const x = cx - 45 + i * 15; swampDoll(R, x, hill(x) + 10, 0.8, { head: i !== 1 && i !== 5, lean: ((i * 7) % 3 - 1) * 0.15 }); }
  // 起き上がる器 (手前。泥から身を起こし、のっぺりした頭をこちらへ向ける)
  swampDoll(R, cx + 34, H * 0.98, 1.6, { col: "#9a8466", lean: -0.1 });
  R.light(cx + 34, H * 0.7, 60, "#c0a060", 0.6, 40);
  A.fog("#a8c060", 0.4, 4, 0.12, 4, 110, 12);
  A.part({ n: 18, col: "#e8c060", x0: 0.25, x1: 0.75, y0: 0.4, y1: 0.95, a: 0.6, blink: 0.5, seed: 183 });
}
// w28 毒霧の葦原: 背丈を越える葦が幾重にも並ぶ。黄緑の毒霧が流れ、葦のあいだに光る目
function vMiasmaReeds(R, A) {
  const { w: W, h: H } = R;
  const FOG = "#7a9a40";
  R.m = SKY; R.vgrad(0, 0, W, H, [[0, "#0a1006"], [0.4, "#2a3816"], [0.7, "#1c2610"], [1, "#0a0c06"]]);
  clouds(R, 199, 0, H * 0.45, "#3a4a20", 0.5, "#5a6a30", 0.03, 0.1);
  R.glow(W * 0.5, H * 0.4, W * 0.6, H * 0.3, "#6a8a28", 0.3, 5);
  for (const [n, by, hmin, hmax, col, sd, fa] of [[60, H * 0.6, 14, 30, "#3a4a24", 191, 0.5], [44, H * 0.78, 22, 44, "#2a3018", 192, 0.4], [30, H * 1.02, 34, 64, "#1a1c10", 193, 0]]) {
    reedBank(R, sd, n, -6, W + 6, by, hmin, hmax, col);
    if (fa) fogBand(R, by - 6, 24, FOG, fa, sd + 5, 0.025);
  }
  // 葦のあいだの光る目 (這い回るもの)
  const r = rnd(195);
  for (let i = 0; i < 4; i++) { const x = W * (0.2 + r() * 0.6), y = H * (0.6 + r() * 0.2); R.m = SKY; R.px(x, y, "#e0ff60"); R.px(x + 2, y, "#e0ff60"); R.glow(x + 1, y, 5, 3, "#a0d020", 0.5, 3); }
  R.light(W * 0.5, H * 0.3, W * 0.8, "#a0c050", 0.6, H * 0.6);
  A.fog("#b0d060", 0.55, 5, 0.14, 5, 120, 14);
  A.fog("#90b040", 0.8, 4, 0.12, 3, 100, 12);
  A.part({ n: 40, col: "#c8e870", x0: 0, x1: 1, y0: 0.1, y1: 0.95, vy: -0.01, vx: 0.01, sway: 10, swf: 0.3, a: 0.4, tw: 1.4, seed: 197 });
}
// w29 よどみの底: 沼のいちばん深いところ。腐った魂がよどんで黒く光り、古い島と崩れた工房が沈みかける
function vStagnant(R, A) {
  const { w: W, h: H } = R, cx = W / 2, gy = Math.round(H * 0.6);
  R.amb = [0.36, 0.4, 0.32];
  R.m = SKY; R.vgrad(0, 0, W, gy, [[0, "#030402"], [0.7, "#0e1408"], [1, "#1c2a10"]]);
  fogBand(R, gy - 4, 16, "#3a4a20", 0.5, 201);
  // よどんだ水 (油のような照り。奥は凪ぎ、腐った魂が淡く光って沈む)
  R.m = SKY; R.rect(0, gy, W, H - gy, (x, y) => { const t = (y - gy) / (H - gy), v = vnoise(x * 0.05, y * 0.3, 203); return mix(C("#0a1008"), C("#1a2410"), v * (1 - t * 0.5)); });
  R.m = SKY; for (let y = gy + 2; y < H; y += 3) R.span(y, 0, W, (x) => (vnoise(x * 0.06, y * 0.5, 205) > 0.6 ? C("#4a3a5a") : null), 0.18);   // 油の虹色
  // 沈みかけた島 (傾いだ岩と、崩れた石の工房。戸口の奥にかすかな灯)
  const iy = gy + 2;
  R.m = SURF; R.poly([[cx - 40, iy + 2], [cx - 30, iy - 8], [cx - 6, iy - 12], [cx + 22, iy - 10], [cx + 42, iy + 2]], tex("#2a2e1e", "#141810", 0.2, 207));
  R.m = SURF; R.poly([[cx - 22, iy - 9], [cx - 22, iy - 34], [cx - 12, iy - 42], [cx - 2, iy - 36], [cx + 6, iy - 40], [cx + 18, iy - 30], [cx + 18, iy - 10]], tex("#3a3a30", "#1e1e18", 0.25, 209));
  R.m = SURF; R.rect(cx - 22, iy - 34, 40, 1, "#5a5a48", 0.6);
  R.m = SKY; R.poly(archPts(cx - 2, iy - 26, 5, iy - 10), "#060604");
  R.m = SKY; R.rect(cx - 3, iy - 18, 3, 4, "#e8b860"); R.glow(cx - 2, iy - 16, 14, 10, "#a07020", 0.45, 4); R.light(cx - 2, iy - 16, 50, "#ffb060", 0.8, 40);
  A.flick(cx - 2, iy - 16, 8, "#ffb060", 0.35, 0.6);
  for (const [x, w2] of [[cx - 30, 5], [cx + 26, 4]]) { R.m = SURF; R.rect(x, iy - 14 - w2 * 2, w2, 14 + w2 * 2, "#2a2a22"); }   // 倒れかけた柱
  // 島の映り込み
  R.m = SKY; for (let y = iy + 1; y < iy + 30 && y < H; y++) if ((y & 1) === 0) R.span(y, cx - 30 + Math.sin(y) * 2, cx + 26 + Math.sin(y) * 2, "#141a0e", 0.5);
  R.m = SKY; R.rect(cx - 3, iy + 14, 3, 3, "#a07030", 0.5);
  R.light(cx, H * 0.8, W * 0.7, "#6a8a30", 0.5, H * 0.5);
  A.part({ n: 24, col: "#a8d070", x0: 0.05, x1: 0.95, y0: 0.62, y1: 0.98, vy: 0.008, sway: 4, swf: 0.3, a: 0.45, tw: 1.2, seed: 211 });
  A.part({ n: 8, col: "#c8e860", x0: 0.1, x1: 0.9, y0: 0.66, y1: 0.95, vy: -0.03, sway: 2, swf: 1, a: 0.6, ring: true, seed: 212 });
}
// ws13 疫病塚の底: 王都が大疫病の死者を投げこんだ縦穴の底。布にくるまれた亡骸の山と、梁から下がる錆びた鐘
function vPlagueMound(R, A) {
  const { w: W, h: H } = R, cx = W / 2;
  R.amb = [0.36, 0.38, 0.3];
  // 縦穴の壁 (上の口へすぼまる石積み)
  bricks(R, 0, 0, W, H, "#2a2a22", "#0e0e0a", 12, 6, 221);
  R.m = SKY; R.ellipse(cx, H * 0.06, 24, 8, (x, y) => mix(C("#c8c8a8"), C("#6a6a54"), clamp01(Math.hypot((x - cx) / 24, (y - H * 0.06) / 8))));   // 遠い塚の口 (地上の曇り空)
  R.m = ADD; R.poly([[cx - 20, H * 0.08], [cx + 20, H * 0.08], [cx + 46, H * 0.8], [cx - 46, H * 0.8]], (x, y) => mul(C("#5a5a40"), 0.5 * (1 - y / (H * 0.8)) * (0.6 + 0.4 * vnoise(x * 0.2, 1, 3))), 0.6);   // 射しこむ光の筋
  R.glow(cx, H * 0.06, 50, 30, "#9a9a70", 0.35, 5); R.light(cx, H * 0.2, 120, "#c8c8a0", 1.0, 110);
  // 口から下がる綱と、梁の錆びた鐘
  R.m = SURF; R.line(cx - 34, H * 0.2, cx + 34, H * 0.24, "#3a2a1a", 1, 3); chainV(R, cx + 6, H * 0.22, H * 0.34, "#5a5040");
  R.m = SURF; R.poly([[cx + 1, H * 0.35], [cx + 11, H * 0.35], [cx + 14, H * 0.47], [cx - 2, H * 0.47]], (x, y) => mix(C("#6a4a2a"), C("#3a2414"), clamp01((x - cx) / 14)));
  R.rect(cx - 3, H * 0.47, 18, 2, "#4a3020"); R.rect(cx + 2, H * 0.36, 2, 10, "#9a7a4a", 0.5);
  // 縦穴の底 (黒い泥。奈落の沼へ染み出す)
  R.m = SURF; R.rect(0, H * 0.56, W, H * 0.44, tex("#22200e", "#0e0c06", 0.12, 229)); R.rect(0, H * 0.56, W, 1, "#3a3820", 0.7);
  // 布にくるまれた亡骸の山 (手前ほど大きい)
  const r = rnd(223);
  for (let i = 0; i < 46; i++) {
    const t = i / 46, x = cx + (r() - 0.5) * W * (1 - t * 0.4), y = H * 0.6 + t * H * 0.42 - (1 - Math.abs(x - cx) / (W * 0.5)) * 10, s = 2.4 + t * 4.4, a = (r() - 0.5) * 0.5;
    const body = (dx, dy) => [[x - s * 2.6 + dx, y + s * a + dy], [x - s * 2.2 + dx, y - s * 0.6 + s * a + dy], [x + s * 2.0 + dx, y - s * 0.7 - s * a + dy], [x + s * 2.7 + dx, y - s * 0.2 - s * a + dy], [x + s * 2.3 + dx, y + s * 0.4 - s * a + dy], [x - s * 2.2 + dx, y + s * 0.5 + s * a + dy]];
    R.m = SURF; R.poly(body(0, 1), "#16140e");                                                  // 下の影
    R.poly(body(0, 0), (px, py) => mul(mix(C("#b0a480"), C("#5a5440"), clamp01((py - y + s * 0.7) / (s * 1.3) + (vnoise(px * 0.4, py * 0.4, i) - 0.5) * 0.4)), 0.65 + t * 0.45));
    R.m = SURF; R.ellipse(x + s * 2.1, y - s * 0.25 - s * a, s * 0.7, s * 0.55, mul(C("#9a8e6c"), 0.65 + t * 0.45));   // 頭のふくらみ
    R.m = SURF; for (const k of [-1.5, -0.3, 1.0]) R.line(x + s * k, y - s * 0.6 + s * a * -k * 0.2, x + s * k + 0.6, y + s * 0.45, "#3a2a1a", 0.8);   // 縛った縄
  }
  fogBand(R, H * 0.62, 14, "#5a6a30", 0.25, 225);
  A.fog("#a0b060", 0.72, 4, 0.12, 3, 100, 12);
  A.part({ n: 20, col: "#d8d8b0", x0: 0.35, x1: 0.65, y0: 0, y1: 0.6, vy: 0.02, sway: 6, swf: 0.4, a: 0.4, seed: 227 });
}
// ws14 沈んだ渡し場: 沼の島へ器を運んだ古い桟橋。杭だけが霧の奥へ続き、沈んだ舟の舳先が覗く。渡し守の灯が揺れる
function vFerry(R, A) {
  const { w: W, h: H } = R, cx = W / 2, gy = Math.round(H * 0.56);
  // 桟橋の杭 (手前から霧の奥へ。奥ほど小さく、霞む)
  for (let k = 7; k >= 0; k--) {
    const z = 1 + k * 0.7, y = gy + 40 / z, x0 = cx - 22 / z - k * 3, x1 = cx + 18 / z - k * 3, h = 26 / z, w2 = Math.max(1, Math.round(4 / z)), f = clamp01(1 - k / 8);
    const col = mix(C("#4a5a3a"), C("#4a3624"), f);
    R.m = SURF; for (const x of [x0, x1]) { R.rect(x, y - h, w2, h + 4 / z, col); R.rect(x, y - h, Math.max(1, w2 - 1), h, mix(C("#5a6a40"), C("#6a5034"), f), 0.6); R.rect(x, y - h, w2, 1, mix(C("#6a7a48"), C("#9a8058"), f)); }
    if (k > 2 && k % 2) { R.m = SURF; R.rect(x0, y - h * 0.4, x1 - x0 + w2, Math.max(1, 2 / z), col); }   // 残った踏み板
  }
  // 沈んだ舟 (舳先だけが水から突き出す)
  R.m = SURF; R.poly([[cx + 40, gy + 30], [cx + 54, gy + 8], [cx + 58, gy + 10], [cx + 52, gy + 30]], tex("#4a3420", "#2a1c10", 0.3, 231)); R.line(cx + 54, gy + 8, cx + 52, gy + 30, "#6a5030", 0.6);
  R.m = SKY; R.ellipse(cx + 48, gy + 30, 12, 2, "#0a1006", 0.8);
  // 渡し守の灯 (霧の奥の杭に掛かって揺れる)
  const lx = cx - 12, ly = gy + 2;
  R.m = SURF; R.rect(lx - 1, ly - 2, 3, 4, "#2a2418");
  R.m = SKY; R.rect(lx, ly - 1, 1, 2, "#fff0b0"); R.glow(lx, ly, 22, 18, "#c09040", 0.5, 5); R.light(lx, ly, 70, "#ffc070", 0.9, 50);
  A.flick(lx, ly, 14, "#ffc070", 0.45, 0.7);
  ghost(R, lx + 6, ly + 14, 16, "#c0d0a0", 0.3);   // 灯のそばの、渡し守の影
  fogBand(R, gy + 4, 20, "#5a6a40", 0.55, 233);
  A.fog("#b0c890", 0.6, 4, 0.12, 3, 110, 12);
  A.part({ n: 10, col: "#c8e860", x0: 0.1, x1: 0.9, y0: 0.7, y1: 0.95, vy: -0.03, sway: 2, swf: 1, a: 0.5, ring: true, seed: 235 });
}
// ---- 第八章「嵐の尖塔」の迷宮 (沼の島の工房の奥から、奈落の縦穴をまっすぐ上へ伸びる塔) ----
// 雷雲の空 (y0〜y1)。紫灰の雲を二重に重ねる
function stormSky(R, y0, y1, seed) {
  R.m = SKY; R.vgrad(0, y0, R.w, y1 - y0, [[0, "#08070e"], [0.5, "#1a1628"], [1, "#2c2640"]]);
  clouds(R, seed, y0, y1, "#2a2440", 0.42, "#5a5078", 0.03, 0.09);
  clouds(R, seed + 1, y0, y1 * 0.7, "#1a1628", 0.5, "#3a3454", 0.05, 0.12);
}
// 稲妻の閃き (空の部分を白く光らせ、ジグザグの筋を一本)。x = 落ちる位置、y1 = 届く高さ
function boltPulse(A, W, H, x, y1, seed, sky = null) {
  A.pulse((P) => {
    P.m = ADD; if (sky) for (const pts of sky) P.poly(pts, "#6a64a8", 0.35); else P.rect(0, 0, W, y1, "#5a5898", 0.22);
    const r = rnd(seed); let px = x, py = 0;
    while (py < y1) { const nx = px + (r() - 0.5) * 12, ny = py + 3 + r() * 5; P.line(px, py, nx, ny, "#eef2ff", 1, 1); P.line(px + 1, py, nx + 1, ny, "#8aa0f0", 0.5, 1); if (r() < 0.22) P.line(nx, ny, nx + (r() - 0.5) * 16, ny + 7, "#a8b8f8", 0.6, 1); px = nx; py = ny; }
    P.glow(x, y1 * 0.4, 60, 40, "#5a64b0", 0.5, 5);
  }, (t) => lightning(t + seed * 977));
}
// 魂縛りの像 (頭巾の石像。両腕を掲げ、腕の先から鎖が上へ)
function bindStatue(R, x, by, s, col, chainTo = null) {
  const c = C(col), P = (pts) => pts.map(([u, v]) => [x + u * s, by - v * s]);
  R.m = SURF;
  R.poly(P([[-6, 0], [6, 0], [5, 3], [-5, 3]]), mul(c, 0.8));
  R.poly(P([[-5, 3], [5, 3], [3.6, 16], [4.2, 19], [-4.2, 19], [-3.6, 16]]), (px) => mul(c, px < x ? 1.1 : 0.75));
  R.ellipse(x, by - 23 * s, 3 * s, 3.4 * s, (px) => mul(c, px < x ? 1.1 : 0.75)); R.poly(P([[-2.4, 24], [2.4, 24], [0.3, 28.6]]), mul(c, 0.9));
  R.ellipse(x, by - 22.6 * s, 1.4 * s, 1.8 * s, "#0a0a10");
  for (const sd of [-1, 1]) {
    R.taper(x + sd * 3.4 * s, by - 18.6 * s, x + sd * 7.6 * s, by - 30 * s, 2.4 * s, 1.8 * s, mul(c, sd < 0 ? 1.05 : 0.7));
    if (chainTo) {                                                                // 腕の先の鎖 → 縛られた魂の光の筋になって渦へ
      const [tx, ty] = chainTo, x0 = x + sd * 7.6 * s, y0 = by - 30 * s, n = 40;
      for (let i = 0; i < n; i++) {
        const t = i / n, px = x0 + (tx - x0) * t * 0.7 + Math.sin(t * 5 + x0) * 4 * t, py = y0 + (ty - y0) * t * 0.7;
        if (t < 0.25) { R.m = SURF; R.rect(Math.round(px), Math.round(py), 1, 1, i & 1 ? "#4a4c5c" : "#a8aac0"); }
        else if (i % 2 === 0) { R.m = ADD; R.px(px, py, "#5ad8b0", 0.9 - t); }
      }
    }
  }
}
// w30 風鳴りの螺旋: 塔の中の吹き抜けを真下から仰ぐ。壁を巡る螺旋階段が渦のように上へすぼまり、はるか上の口に雷雲。下から風が吹き上げる
function vSpiral(R, A) {
  const { w: W, h: H } = R, cx = W / 2, oy = H * 0.14;
  R.amb = [0.42, 0.42, 0.52];
  // 吹き抜けの壁 (口へ向かうほど明るい。石積みの目地が渦に沿う)
  R.m = SURF; R.rect(0, 0, W, H, (x, y) => {
    const dx = x - cx, dy = (y - oy) * 1.5, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    const ring = Math.log(r + 4) * 9, joint = ((ring % 1) + 1) % 1 < 0.14 || (((a * 12 + ring * 0.5) % 1) + 1) % 1 < 0.06;
    return mul(joint ? C("#100e16") : mix(C("#2c2a38"), C("#46445a"), hash(Math.floor(a * 12 + ring * 0.5), Math.floor(ring), 3)), clamp01(1.15 - r / (W * 0.62)));
  });
  // はるか上の口 (雷雲の空)
  const top = [];
  for (let i = 0; i <= 24; i++) { const a = (i / 24) * TAU; top.push([cx + Math.cos(a) * 14, oy + Math.sin(a) * 5]); }
  R.m = SKY; R.poly(top, (x, y) => mix(C("#2a2444"), C("#8a80b8"), clamp01(fbm(x * 0.1, y * 0.3, 7) * 1.4 - 0.3)));
  R.glow(cx, oy, 40, 18, "#6a64b0", 0.4, 5); R.light(cx, oy, 150, "#8a88d0", 1.0, 120);
  // 螺旋階段 (壁を巡る石の段。奥の半周を先に、手前の半周を後に。内側の縁に鎖の手すり)
  const turns = 5, n = 3200;
  for (const front of [false, true]) for (let i = 0; i < n; i++) {
    const t = i / n, th = t * turns * TAU, sn = Math.sin(th);
    if ((sn > 0) !== front) continue;
    const k = Math.pow(1 - t, 1.5), r = 16 + W * 0.66 * k, y = oy + 4 + (H * 0.95) * k + sn * r * 0.3, x = cx + Math.cos(th) * r;
    const thick = 1 + 9 * k, lit = clamp01(0.35 + (1 - k) * 0.5 + (front ? 0.15 : -0.1));
    const step = ((th * 6) % 1) < 0.18;
    R.m = SURF; R.rect(Math.round(x), Math.round(y), 2, Math.round(thick), (px, py) => mix(C("#141218"), C(step ? "#4a485c" : py - y < 1.5 ? "#b8b4cc" : "#6a6880"), lit));
    R.rect(Math.round(x), Math.round(y + thick), 1, 1, "#08080c", 0.8);
    if (i % 7 === 0 && k > 0.12) { const ix = cx + Math.cos(th) * (r - 4 * k - 2), iy = y - 3 * k - 1; R.rect(Math.round(ix), Math.round(iy), 1, 1, i % 14 ? "#3a3c4c" : "#8a8ca0"); }   // 鎖の手すり
  }
  R.light(W * 0.18, H * 0.92, 70, "#ffc080", 0.6, 34);
  boltPulse(A, W, H, cx + 4, oy + 4, 3, [top]);
  A.part({ n: 44, col: "#c8c8d8", x0: 0.1, x1: 0.9, y0: 0.15, y1: 1, vy: -0.14, sway: 10, swf: 0.6, a: 0.4, len: 2, seed: 301 });
  A.part({ n: 8, col: "#e0d8b8", x0: 0.2, x1: 0.8, y0: 0.2, y1: 1, vy: -0.07, sway: 16, swf: 0.4, a: 0.6, tw: 2, seed: 302 });
}
// w31 嵐を鳴らす鐘楼: 梁から大小の鐘がいくつも吊られ、開いた拱の外は雷雲。鐘は風に揺れて鳴りやまない
function vBelfry(R, A) {
  const { w: W, h: H } = R, cx = W / 2, gy = Math.round(H * 0.8);
  R.amb = [0.42, 0.42, 0.52];
  stormSky(R, 0, gy, 51);
  // 尖った拱 (柱と拱の上の石壁。拱の内は雷雲) と梁
  const ops = [[W * 0.165, W * 0.13], [W * 0.5, W * 0.14], [W * 0.835, W * 0.13]];
  const inArch = (x, y) => ops.some(([ax, hw]) => { const Rr = hw * 1.7, yb = 26 + Math.sqrt(Rr * Rr - (Rr - hw) ** 2), d = Math.abs(x - ax); return d < hw && (y >= yb || Math.hypot(d + (Rr - hw), y - yb) < Rr); });
  const stone = tex("#3a3848", "#26242e", 0.2, 53);
  R.m = SURF; R.rect(0, 10, W, gy - 10, (x, y) => (inArch(x, y) ? null : mul(stone(x, y), inArch(x - 2, y) || inArch(x + 2, y) || inArch(x, y + 2) ? 1.5 : 1)));
  R.rect(0, 0, W, 10, tex("#3a2a1e", "#22180e", 0.3, 55)); R.rect(0, 10, W, 1, "#100a06");
  R.rect(0, gy, W, H - gy, (x, y) => mul(mix(C("#4a3a28"), C("#2a2016"), vnoise(x * 0.05, y * 0.6, 57)), (Math.round((x - W / 2) / (1 + (y - gy) * 0.08)) % 9 === 0) ? 0.5 : 1));
  R.rect(0, gy, W, 1, "#7a6a58");
  R.m = SKY; for (const [ax, hw] of ops) R.rect(ax - hw * 0.7, gy + 2, hw * 1.4, 3, "#4a4870", 0.35);   // 濡れた床に映る拱
  // 吊られた鐘 (大小。梁から綱で。いくつかは風に揺れて傾く。口の奥は闇)
  const bells = [[W * 0.165, 30, 15, 0.14], [W * 0.5, 50, 26, 0], [W * 0.835, 36, 17, -0.16], [W * 0.33, 18, 9, -0.1], [W * 0.67, 22, 10, 0.12]];
  for (const [bx, len, s, tilt] of bells) {
    const cs = Math.cos(tilt), sn = Math.sin(tilt), py = 10;
    const tf = ([u, v]) => { const w = len + s * 1.1 + v; return [bx + u * cs + w * sn, py - u * sn + w * cs]; };
    R.m = SURF; R.line(bx, py, ...tf([0, -s * 1.1]), "#5a4a38");
    const prof = [[-s * 0.3, -s * 1.1], [s * 0.3, -s * 1.1], [s * 0.45, -s * 0.8], [s * 0.5, -s * 0.35], [s * 0.62, -s * 0.1], [s * 0.8, 0], [-s * 0.8, 0], [-s * 0.62, -s * 0.1], [-s * 0.5, -s * 0.35], [-s * 0.45, -s * 0.8]];
    R.poly(prof.map(tf), (x, y) => { const u = ((x - bx) * cs - (y - py) * sn) / s - sn * (len / s + 1); return mul(mix(C("#8a6234"), C("#4a7a68"), vnoise(x * 0.4, y * 0.4, bx) > 0.7 ? 0.6 : 0), u < -0.35 ? 1.3 : u < 0.2 ? 1 : 0.62); });
    const mouth = []; for (let i = 0; i <= 16; i++) { const a = (i / 16) * TAU; mouth.push(tf([Math.cos(a) * s * 0.78, Math.sin(a) * s * 0.12])); }
    R.poly(mouth, "#140c06");
    R.line(...tf([-s * 0.8, 0]), ...tf([s * 0.8, 0]), "#c8a060", 0.7);
    R.line(...tf([-s * 0.5, -s * 0.5]), ...tf([s * 0.5, -s * 0.5]), "#3a2a16", 0.6);
  }
  // 大鐘の縁に一門の印 (灯を掌に載せた手。金の小さな浮き彫り)
  { const y = 10 + 50 + 26 * 1.1 - 8; R.m = SKY; R.rect(cx - 2, y, 5, 2, "#c89a50"); R.rect(cx + 2, y - 2, 1, 2, "#c89a50"); R.rect(cx - 1, y - 4, 2, 3, "#ffd080"); R.glow(cx, y - 2, 7, 6, "#c08030", 0.45, 3); }
  R.light(W * 0.85, H * 0.2, 120, "#8a88d0", 0.8, 90); R.light(W * 0.2, H * 0.85, 60, "#ffc080", 0.5, 30);
  boltPulse(A, W, H, W * 0.84, gy * 0.7, 5);
  A.part({ n: 60, col: "#a8a8d8", x0: -0.1, x1: 1, y0: 0, y1: 0.8, vy: 1.2, vx: -0.25, a: 0.25, streak: 4, slant: -0.4, seed: 311 });
}
// w32 雷の落ちる回廊: 塔の外壁を巡る吹きさらしの回廊。鉄の手すりの外は雷雲で、稲妻が手すりを打つ
function vGallery(R, A) {
  const { w: W, h: H } = R, fy = Math.round(H * 0.56);
  R.amb = [0.45, 0.45, 0.56];
  stormSky(R, 0, H, 61);
  // 遠くで落ちる稲妻 (いつも見えている細い筋)
  { const r = rnd(62); let x = W * 0.86, y = 0; R.m = SKY; while (y < H * 0.5) { const nx = x + (r() - 0.5) * 8, ny = y + 3 + r() * 4; R.line(x, y, nx, ny, "#9aa8e8", 0.8); x = nx; y = ny; } R.glow(W * 0.86, H * 0.2, 30, 40, "#4a5098", 0.35, 4); }
  // 塔の外壁 (左。円筒の側面。右の縁ほど暗い。灯のもれる戸口)
  bricks(R, 0, 0, W * 0.3, H, "#4a4858", "#18161e", 10, 5, 63);
  R.m = SURF; for (let x = Math.floor(W * 0.18); x < W * 0.3; x++) R.rect(x, 0, 1, H, "#08080c", (x - W * 0.18) / (W * 0.12) * 0.8);
  R.m = SURF; R.poly(archPts(W * 0.12, fy - 30, 7, fy), "#0c0806"); R.m = SKY; R.poly(archPts(W * 0.12, fy - 26, 4, fy), (x, y) => mix(C("#e0a050"), C("#5a3010"), clamp01((fy - y) / 26)), 0.8);
  R.light(W * 0.12, fy - 10, 40, "#ffb060", 0.8, 30); A.flick(W * 0.12, fy - 12, 10, "#ffb060", 0.35, 0.7);
  // 回廊の床 (手前から左奥へ回りこむ。濡れて空を映す)
  const edge = (y) => { const t = clamp01((y - fy) / (H - fy)); return W * 0.3 + W * 0.5 * (t * 0.4 + t * t * 0.6); };
  R.m = SURF; for (let y = fy; y < H; y++) R.span(y, 0, edge(y), (x) => mul(mix(C("#3e3e50"), C("#5c5c72"), vnoise(x * 0.15, y * 0.5, 65)), 0.55 + 0.45 * (y / H)));
  const rr = rnd(67); R.m = SKY; for (let i = 0; i < 40; i++) { const y = fy + 4 + rr() * (H - fy - 4), x = rr() * edge(y), l = 3 + rr() * 8; R.rect(x, y, l, 1, "#7a7ab8", 0.35); }   // 水溜まりの照り
  // 鉄の手すり (外の縁に沿って。手前ほど太い。打たれた所は黒く焦げる)
  let prev = null;
  for (const t of [0.0, 0.07, 0.15, 0.27, 0.43, 0.64, 0.95]) {
    const y = fy + t * (H - fy), x = edge(y), h = 5 + t * 40, w = 1 + Math.round(t * 3), burnt = t > 0.5 && t < 0.8;
    R.m = SURF; R.rect(x, y - h, w, h, burnt ? "#1a161a" : "#7a7c94"); R.rect(x, y - h, 1, h, burnt ? "#2a2428" : "#a8aac4");
    if (prev) { R.line(prev[0], prev[1] - prev[2], x, y - h, burnt ? "#1a161a" : "#8a8ca8", 1, Math.max(1, w - 1)); R.line(prev[0], prev[1] - prev[2] * 0.5, x, y - h * 0.5, "#5a5c70", 1, 1); }
    prev = [x, y, h];
  }
  R.m = SKY; for (let i = 0; i < 7; i++) R.px(edge(fy + 0.6 * (H - fy)) - 8 + i * 3, fy + 0.6 * (H - fy) - 30 + i * 0.4, "#ffc890", 0.8);   // 溶けた鉄の粒
  R.light(W * 0.7, H * 0.25, 150, "#8a88d0", 1.0, 120);
  // 回廊の手すりを打つ稲妻 (閃くたびに、落ちた所が白く燃える)
  const hx = edge(fy + 0.62 * (H - fy)), hy = fy + 0.62 * (H - fy) - 30;
  A.pulse((P) => {
    P.m = ADD; P.rect(W * 0.3, 0, W * 0.7, H, "#4a4890", 0.25);
    const r = rnd(9); let x = hx + 20, y = 0;
    while (y < hy) { const nx = x + (r() - 0.5) * 12 + (hx - x) * 0.12, ny = Math.min(hy, y + 3 + r() * 5); P.line(x, y, nx, ny, "#f4f6ff", 1, 2); P.line(x + 2, y, nx + 2, ny, "#8aa0f0", 0.5, 1); if (r() < 0.25) P.line(nx, ny, nx + (r() - 0.5) * 18, ny + 8, "#a8b8f8", 0.6, 1); x = nx; y = ny; }
    P.glow(hx, hy, 26, 18, "#c8d0ff", 0.8, 5); P.glow(W * 0.7, H * 0.3, 80, 60, "#5a64b0", 0.4, 5);
  }, lightning);
  A.part({ n: 80, col: "#a8a8d8", x0: -0.1, x1: 1, y0: 0, y1: 1, vy: 1.4, vx: -0.35, a: 0.3, streak: 4, slant: -0.5, seed: 321 });
  A.part({ n: 10, col: "#ffe0a0", x0: hx / W - 0.04, x1: hx / W + 0.04, y0: hy / H, y1: hy / H + 0.12, vy: 0.05, sway: 4, swf: 2, a: 0.7, blink: 3, seed: 322 });
}
// w33 嵐の尖塔の頂: 火のともらない大きな灯台。まわりを魂縛りの像が輪に囲み、縛られた魂の光が渦を巻いて雷雲になる
function vSummit(R, A) {
  const { w: W, h: H } = R, cx = W / 2, vy = H * 0.12;
  R.amb = [0.36, 0.38, 0.46];
  // 渦を巻く雷雲 (螺旋の腕に魂の光)
  R.m = SKY; R.rect(0, 0, W, H, (x, y) => {
    const dx = x - cx, dy = (y - vy) * 2.2, r = Math.hypot(dx, dy) + 0.01, a = Math.atan2(dy, dx), arm = Math.sin(a * 3 - Math.log(r) * 4.2);
    const t = clamp01(fbm(x * 0.03, y * 0.06, 71) * 0.9 + arm * 0.25);
    const c = mix(C("#0c0b14"), C("#5a5478"), t * t), s = clamp01(1 - r / 140) * clamp01(arm * 0.7 + 0.3);
    return [c[0] + 20 * s, c[1] + 90 * s, c[2] + 76 * s];
  });
  R.glow(cx, vy, 40, 18, "#4ac8a8", 0.5, 5);
  // 頂の床
  const gy = Math.round(H * 0.72);
  R.m = SURF; R.ellipse(cx, H * 0.9, W * 0.62, H * 0.2, tex("#3a3a4a", "#22222c", 0.12, 73));
  R.rect(0, H * 0.9, W, H * 0.1, tex("#2a2a36", "#16161e", 0.12, 74));
  // 灯台 (石の胴・暗い大レンズ・笠)
  R.m = SURF; R.poly([[cx - 16, gy + 14], [cx - 12, gy - 40], [cx + 12, gy - 40], [cx + 16, gy + 14]], (x, y) => mul(C("#4a4858"), x < cx - 4 ? 1.2 : x < cx + 6 ? 0.95 : 0.65));
  for (let y = gy - 36; y < gy + 14; y += 6) R.rect(cx - 15, y, 30, 1, "#18161e", 0.6);
  R.rect(cx - 18, gy - 43, 36, 3, "#3a3a48");
  R.ellipse(cx, gy - 54, 11, 11, (x, y) => { const d = Math.hypot(x - cx, y - gy + 54) / 11; return mix(C("#1a3a40"), C("#0a1418"), d) ; });
  for (const r2 of [4, 7, 10]) for (let i = 0; i < 28; i++) { const a = (i / 28) * TAU; R.px(cx + Math.cos(a) * r2, gy - 54 + Math.sin(a) * r2, "#2a5a5a", 0.6); }
  R.line(cx - 6, gy - 62, cx + 4, gy - 46, "#04060a", 1, 1);  // レンズのひび
  R.poly([[cx - 14, gy - 64], [cx, gy - 76], [cx + 14, gy - 64]], "#3a3a4a"); R.rect(cx - 1, gy - 82, 2, 7, "#3a3a4a");
  // 像の輪 (奥は小さく霞む。手前右のひとつは砕けている)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + 0.3, x = cx + Math.cos(a) * W * 0.4, y = H * 0.86 + Math.sin(a) * H * 0.1, s = 0.9 + Math.sin(a) * 0.4;
    if (i === 1) { R.m = SURF; R.rect(x - 5 * s, y - 6 * s, 10 * s, 6 * s, "#3a3a48"); rubble(R, 81, 6, x - 14, x + 14, y - 2, y + 4, "#4a4a58"); continue; }   // 師が壊した像
    bindStatue(R, x, y, s, Math.sin(a) < 0 ? "#3a3c4a" : "#5a5c6c", [cx, vy]);
  }
  R.light(cx, vy, 140, "#5ad8b8", 0.9, 100); R.light(cx, H * 0.85, W * 0.5, "#5ab8a8", 0.6, H * 0.3);
  A.part({ n: 50, col: "#9af0d8", x0: 0.1, x1: 0.9, y0: 0, y1: 0.6, vy: -0.04, vx: 0.03, sway: 16, swf: 0.4, a: 0.55, tw: 1.6, seed: 331 });
  boltPulse(A, W, H, W * 0.78, H * 0.4, 7);
}
// ws15 雷鳥の巣: 塔の外壁に張りついた巨大な巣。折れた梁と鎖と枯れ枝を編み、帯電した卵が青白く光る
function vNest(R, A) {
  const { w: W, h: H } = R, cx = W * 0.52, ny = H * 0.5, rx = W * 0.32;
  R.amb = [0.42, 0.42, 0.52];
  stormSky(R, 0, H, 81);
  bricks(R, 0, 0, W * 0.24, H, "#3a3848", "#141218", 10, 5, 83);
  R.m = SURF; for (let x = Math.floor(W * 0.16); x < W * 0.24; x++) R.rect(x, 0, 1, H, "#08080c", (x - W * 0.16) / (W * 0.08) * 0.7);
  // 壁から突き出た折れた梁 (巣の土台)
  R.m = SURF; R.taper(W * 0.18, ny + 18, cx + rx * 0.6, ny + 26, 6, 3, "#3a2a1e"); R.taper(W * 0.2, ny + 4, cx - rx * 0.1, ny + 14, 5, 3, "#4a3624");
  const twig = (x, y) => { const v = vnoise((x + y) * 0.45, (x - y) * 0.12, 85), w = vnoise((x - y) * 0.4, (x + y) * 0.1, 86); return mix(C("#1a140e"), C("#7a6448"), clamp01(Math.max(v, w) * 1.5 - 0.45)); };
  // 巣の下の膨らみ (枝を編んだ鉢)
  const under = []; for (let i = 0; i <= 24; i++) { const a = (i / 24) * Math.PI; under.push([cx + Math.cos(a) * rx, ny + Math.sin(a) * 38]); }
  R.m = SURF; R.poly(under, (x, y) => mul(twig(x, y), 1.1 - (y - ny) / 48));
  // 奥の縁と窪み
  R.ellipse(cx, ny, rx, 10, twig); R.ellipse(cx, ny + 1, rx * 0.84, 7, "#0c0908");
  // 帯電した卵 (半ば手前の縁に隠れる)
  for (const [dx, s] of [[-24, 8], [0, 11], [22, 8]]) { R.m = SURF; R.ellipse(cx + dx, ny - s * 0.4, s * 0.72, s, (x, y) => mix(C("#d8e0ff"), C("#5a64a8"), clamp01((x - cx - dx) / (s * 1.3) + 0.35))); R.glow(cx + dx, ny - s * 0.4, s * 2.4, s * 2, "#6a7ae0", 0.45, 4); }
  // 手前の縁 (下の弧) と、はみ出した枝
  R.m = SURF; for (let i = 0; i <= 80; i++) { const a = (i / 80) * Math.PI, x = cx + Math.cos(a) * rx, y = ny + Math.sin(a) * 10; R.rect(x - 1, y - 2, 3, 5, twig(x * 3, y * 3)); }
  const r = rnd(85);
  for (let i = 0; i < 70; i++) { const a = r() * Math.PI * (r() < 0.5 ? 1 : -0.15) , x = cx + Math.cos(a) * rx * (0.95 + r() * 0.1), y = ny + Math.sin(a) * (a > 0 ? 10 + r() * 28 : 10), ang = Math.atan2(y - ny, x - cx) + (r() - 0.5) * 1.4, l = 4 + r() * 12; R.line(x, y, x + Math.cos(ang) * l, y + Math.sin(ang) * l * 0.6, mix(C("#2a2018"), C("#8a7458"), r()), 1, 1); }
  chainSag(R, W * 0.22, ny + 2, cx + rx * 0.3, ny + 22, 8, "#6a6c80");
  R.light(cx, ny - 10, 110, "#8a98f0", 1.0, 60);
  // 抜け落ちた大きな羽根 (風に舞う)
  for (const [x, y, a] of [[W * 0.84, H * 0.22, 0.6], [W * 0.36, H * 0.14, -0.4]]) { R.m = SKY; R.taper(x, y, x + Math.cos(a) * 20, y + Math.sin(a) * 20, 5, 1, "#b8b0c8"); R.line(x, y, x + Math.cos(a) * 20, y + Math.sin(a) * 20, "#5a5268"); }
  A.part({ n: 14, col: "#b8c8ff", x0: 0.4, x1: 0.65, y0: 0.4, y1: 0.52, vy: -0.03, sway: 4, swf: 3, a: 0.8, blink: 4, seed: 341 });
  A.part({ n: 50, col: "#a8a8d8", x0: -0.1, x1: 1, y0: 0, y1: 1, vy: 1.2, vx: 0.3, a: 0.22, streak: 4, slant: 0.5, seed: 342 });
  boltPulse(A, W, H, W * 0.88, H * 0.5, 11);
}
// ws16 錆びた避雷針の林: 塔の段に、錆びた避雷針が林のように立ち並ぶ。雷はどれかを打ち、針の先で火花が散る
function vRodForest(R, A) {
  const { w: W, h: H } = R, gy = Math.round(H * 0.66);
  R.amb = [0.42, 0.4, 0.5];
  stormSky(R, 0, gy, 91);
  ground(R, gy, "#3a3440", "#1a1820", 93, 0.1, 0.3);
  R.m = SURF; R.rect(0, gy, W, 1, "#6a6278");
  // 避雷針 (奥ほど細く短い。錆の赤茶。根もとに銅の線が這う)
  const r = rnd(95), tips = [];
  for (let k = 0; k < 34; k++) {
    const z = r(), x = r() * W, by = gy + 2 + z * (H - gy - 4), h = 26 + z * 70, w = z > 0.6 ? 2 : 1;
    const col = mix(C("#3a2a24"), C("#8a4a2a"), 0.3 + z * 0.7);
    R.m = SURF; R.rect(x, by - h, w, h, col); R.rect(x, by - h, 1, h, mul(col, 1.3));
    if (z > 0.4) { R.rect(x - 1, by - h * 0.6, w + 2, 1, mul(col, 0.8)); R.rect(x - 1, by - h * 0.3, w + 2, 1, mul(col, 0.8)); }
    R.line(x, by, x + (r() - 0.5) * 30, by + 2, "#a0603a", 0.6);
    tips.push([x, by - h]);
  }
  R.light(W * 0.5, H * 0.1, 160, "#8a88d0", 0.8, 100);
  const hit = tips.sort((p, q) => p[1] - q[1])[3];
  A.pulse((P) => {
    P.m = ADD; P.rect(0, 0, W, gy, "#4a4890", 0.25);
    const rr = rnd(7); let x = hit[0] + 10, y = 0;
    while (y < hit[1] - 3) { const nx = x + (rr() - 0.5) * 10 + (hit[0] - x) * 0.15, ny = Math.min(hit[1], y + 3 + rr() * 5); P.line(x, y, nx, ny, "#f4f6ff", 1, 1); x = nx; y = ny; }
    P.line(x, y, hit[0], hit[1], "#f4f6ff", 1, 1);
    P.glow(hit[0], hit[1], 18, 14, "#c8d0ff", 0.9, 5); P.glow(hit[0], hit[1] + 20, 40, 30, "#5a64b0", 0.4, 5);
  }, lightning);
  A.part({ n: 16, col: "#ffd090", x0: hit[0] / W - 0.03, x1: hit[0] / W + 0.03, y0: hit[1] / H, y1: hit[1] / H + 0.15, vy: 0.08, sway: 6, swf: 2, a: 0.8, blink: 2, seed: 351 });
  A.part({ n: 60, col: "#a8a8d8", x0: -0.1, x1: 1, y0: 0, y1: 1, vy: 1.2, vx: -0.2, a: 0.25, streak: 4, slant: -0.3, seed: 352 });
}
// ws17 雲上の庭: 雷雲を抜けた塔の段に、崩れた庭園。雲の海の上で、澄んだ泉だけが静かに湧く
function vCloudGarden(R, A) {
  const { w: W, h: H } = R, cx = W / 2, gy = Math.round(H * 0.6);
  R.amb = [0.62, 0.6, 0.66];
  R.m = SKY; R.vgrad(0, 0, W, gy, [[0, "#1a2240"], [0.6, "#5a6088"], [1, "#b8a8b0"]]);
  stars(R, 101, 30, gy * 0.4, "#e8eaff");
  // 雲の海 (足もとに広がる。下に時おり雷が光る)
  R.m = SKY; R.rect(0, gy - 6, W, 12, (x, y) => mix(C("#8a8aa8"), C("#c8c4d4"), clamp01(fbm(x * 0.04, y * 0.3, 103) * 1.4 - 0.2)));
  clouds(R, 105, gy - 10, gy + 8, "#a8a6c0", 0.45, "#e0dce8", 0.02, 0.2);
  // 庭の段 (崩れた縁石と、苔むした敷石)
  ground(R, gy + 4, "#4a5048", "#22261e", 107, 0.09, 0.35);
  R.m = SURF; R.rect(0, gy + 4, W, 2, "#7a8070");
  // 崩れた拱と柱 (つる草が這う)
  column(R, W * 0.14, gy - 50, gy + 8, 7, "#7a7884", { broken: 3 });
  column(R, W * 0.82, gy - 60, gy + 8, 7, "#7a7884", { cap: true, base: true });
  R.m = SURF; R.poly([[W * 0.82 - 30, gy - 64], [W * 0.82 + 9, gy - 64], [W * 0.82 + 9, gy - 58], [W * 0.82 - 22, gy - 58], [W * 0.82 - 26, gy - 54]], "#6a6874");   // 崩れた拱の残り
  for (const x of [W * 0.14 + 3, W * 0.82 + 3]) for (let y = gy - 50; y < gy + 6; y += 2) R.px(x + Math.sin(y * 0.3) * 3, y, "#4a6a3a");
  tree(R, W * 0.3, gy + 10, 30, 109, "#3a3428", { depth: 4 });
  // 澄んだ泉 (中央。円い石の縁と、湧き上がる水)
  R.m = SURF; R.ellipse(cx, gy + 22, 34, 9, "#6a6878"); R.ellipse(cx, gy + 21, 30, 7, (x, y) => mix(C("#9ad0e8"), C("#3a6a8a"), clamp01((y - gy - 14) / 14)));
  R.m = SKY; R.rect(cx - 1, gy + 4, 3, 16, "#d8f0fa", 0.7); R.ellipse(cx, gy + 18, 6, 2, "#e8f8ff", 0.7);
  R.glow(cx, gy + 18, 40, 16, "#7ac0e0", 0.35, 5); R.light(cx, gy + 18, 80, "#a8e0f8", 0.8, 40);
  rubble(R, 111, 10, 0, W, gy + 20, H, "#5a5864");
  A.part({ n: 16, col: "#e8f8ff", x0: 0.47, x1: 0.53, y0: 0.62, y1: 0.75, vy: -0.06, sway: 3, swf: 1, a: 0.7, seed: 361 });
  A.fog("#c8c4d8", 0.62, 4, 0.18, 3, 120, 10);
  A.pulse((P) => { P.m = ADD; P.rect(0, gy - 8, W, 18, "#6a6ac0", 0.3); P.glow(W * 0.3, gy, 50, 10, "#8a90e0", 0.5, 4); }, lightning);
}
const VISTAS = {
  w01: [1, vCrypt], w02: [14, vWhispers], w03: [16, vAbbey], w04: [2, vIntake], w05: [3, vChains],
  w06: [4, vRanks], w07: [0, vPrison], w08: [4, vStorm], w09: [17, vCouncil],
  ws1: [6, vBell], ws2: [12, vQuarry], ws3: [5, vMistwood],
  w14: [6, vApproach], w15: [6, vChoir], w16: [0, vFont], w17: [6, vSunkenTemple], ws5: [0, vWell],
  w18: [7, vVent], w19: [7, vAsh], w20: [7, vKettles], w21: [7, vInferno],
  w22: [0, vLedge], w23: [8, vFrozenHall], w24: [0, vAurora], w25: [8, vGlacialThrone],
  ws6: [4, vBeacon], ws7: [0, vGuardroom],
  ws8: [13, vDrownedLib], ws9: [7, vObsidian], ws10: [16, vPyreAbbey], ws11: [8, vWolfDrift], ws12: [0, vCrevasse],
  w26: [9, vBogShore], w27: [0, vDollDump], w28: [0, vMiasmaReeds], w29: [0, vStagnant], ws13: [0, vPlagueMound], ws14: [9, vFerry],
  w30: [0, vSpiral], w31: [0, vBelfry], w32: [0, vGallery], w33: [0, vSummit], ws15: [0, vNest], ws16: [0, vRodForest], ws17: [0, vCloudGarden],
};
function finishVista(out, w, h) { // 周辺減光だけ (名札帯・中央減光はしない)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 3, vx = x / w - 0.5, vy = y / h - 0.5, k = 0.6 + 0.4 * clamp01(1 - (vx * vx * 1.4 + vy * vy * 1.8) * 1.3);
    out[i] *= k; out[i + 1] *= k; out[i + 2] *= k;
  }
}
function buildVista(id, layer, w, h) {
  const hw = Math.max(8, Math.ceil(w / 2)), hh = Math.max(8, Math.ceil(h / 2));
  const R = new Pix(hw, hh), A = animSpec(), v = VISTAS[id];
  if (v) { if (v[0]) SCENES[v[0]](R, A); v[1](R, A); } else (SCENES[layer] || sVoid)(R, A);
  const out = R.compose();
  finishVista(out, hw, hh);
  const S = { img: toCanvas(out, hw, hh), hw, hh, A, pulses: [] };
  for (const p of A.pulses) { const P = new Pix(hw, hh); P.amb = [0, 0, 0]; p.draw(P); S.pulses.push({ img: toCanvas(P.compose(), hw, hh), f: p.f }); }
  return S;
}
// 迷宮の顔を描く。dn = 台帳の迷宮 ({ id, layer })。w×h は戦闘背景と同じ 3:2 を想定 (表示側で上下を切る)
export function drawDungeonVista(ctx, w, h, dn, now) {
  w = Math.max(16, Math.round(w)); h = Math.max(16, Math.round(h));
  const id = (dn && dn.id) || "", L = dn && dn.layer >= 1 && dn.layer <= 20 ? Math.floor(dn.layer) : 0;
  const key = "v|" + id + "|" + L + "|" + w + "x" + h;
  let S = CACHE.get(key);
  if (!S) {
    S = buildVista(id, L, w, h);
    CACHE.set(key, S);
    if (CACHE.size > CACHE_MAX) CACHE.delete(CACHE.keys().next().value);
  }
  paint(ctx, S, w, h, now, false, false);
}

// ---------- 仕上げ (名札帯の均し・中央減光・周辺減光・強敵/首領の色調) ----------
function finish(out, w, h, boss, elite) {
  // 名札/HPバー帯 (0.62h-0.80h): 行の平均色へ寄せてコントラストを落とし、やや沈める
  const y0 = Math.floor(h * 0.6), y1 = Math.ceil(h * 0.82);
  for (let y = y0; y < y1; y++) {
    const e = Math.min(1, (y - y0 + 1) / 4, (y1 - y) / 4);
    let mr = 0, mg = 0, mb = 0, n = 0;
    for (let x = Math.floor(w * 0.12); x < w * 0.88; x++) { const i = (y * w + x) * 3; mr += out[i]; mg += out[i + 1]; mb += out[i + 2]; n++; }
    mr /= n; mg /= n; mb /= n;
    for (let x = 0; x < w; x++) {
      const ex = 1 - sstep(0.3, 0.46, Math.abs(x / w - 0.5)), k = 0.5 * e * ex, i = (y * w + x) * 3;
      out[i] = (out[i] + (mr - out[i]) * k) * (1 - 0.18 * k); out[i + 1] = (out[i + 1] + (mg - out[i + 1]) * k) * (1 - 0.18 * k); out[i + 2] = (out[i + 2] + (mb - out[i + 2]) * k) * (1 - 0.18 * k);
    }
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 3, nx = x / w, ny = y / h;
    // 中央減光 (敵の立ち位置を沈めて浮かせる)
    const cm = (1 - sstep(0.22, 0.4, Math.abs(nx - 0.5))) * (1 - sstep(0.22, 0.36, Math.abs(ny - 0.42)));
    // 周辺減光
    const vx = nx - 0.5, vy = ny - 0.46, v = clamp01(1 - (vx * vx * 1.5 + vy * vy * 1.9) * 1.25);
    let k = (1 - 0.3 * cm) * (0.55 + 0.45 * v);
    if (boss) k *= 0.82 + 0.18 * sstep(0.1, 0.6, ny);
    out[i] *= k; out[i + 1] *= k; out[i + 2] *= k;
    if (boss) { const g = sstep(0.35, 0.95, ny) * 10; out[i] += g * 1.4; out[i + 2] += g * 0.6; }
    if (elite) { const e = (1 - v) * 22; out[i] += e; out[i + 1] *= 0.96; }
  }
}

// ---------- 構築 (キャッシュ単位) ----------
function build(L, w, h, boss, elite) {
  const hw = Math.max(8, Math.ceil(w / 2)), hh = Math.max(8, Math.ceil(h / 2));
  const R = new Pix(hw, hh), A = animSpec();
  (SCENES[L] || sVoid)(R, A);
  const out = R.compose();
  finish(out, hw, hh, boss, elite);
  const S = { img: toCanvas(out, hw, hh), hw, hh, A, pulses: [] };
  for (const p of A.pulses) { const P = new Pix(hw, hh); P.amb = [0, 0, 0]; p.draw(P); S.pulses.push({ img: toCanvas(P.compose(), hw, hh), f: p.f }); }
  if (boss) {
    const P = new Pix(hw, hh); P.amb = [0, 0, 0];
    P.glow(hw / 2, hh * 0.6, hw * 0.46, hh * 0.32, "#a01838", 0.55, 6); P.glow(hw / 2, hh * 0.62, hw * 0.3, hh * 0.14, "#6a20a0", 0.4, 6);
    S.pulses.push({ img: toCanvas(P.compose(), hw, hh), f: (t) => 0.55 + 0.35 * Math.sin(t * 0.0016) });
  }
  return S;
}

// ---------- アニメ層の部品 (フル解像度、2px グリッドに揃える) ----------
const spriteCache = new Map();
function glowSprite(col, r) {
  const key = col + r; let cv = spriteCache.get(key); if (cv) return cv;
  const n = r * 2 + 1, c = C(col); cv = makeCanvas(n, n);
  const cx = cv.getContext("2d"), id = cx.createImageData(n, n), d = id.data;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const dd = Math.hypot(x - r, y - r) / (r + 0.5); if (dd >= 1) continue;
    const f = Math.floor((1 - dd) * (1 - dd) * 4 + bayer(x, y)) / 4, o = (y * n + x) * 4;
    d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = Math.round(f * 255);
  }
  cx.putImageData(id, 0, 0); spriteCache.set(key, cv); return cv;
}
function fogSprite(col, fw, fh, seed) {
  const key = "f" + col + fw + "x" + fh + seed; let cv = spriteCache.get(key); if (cv) return cv;
  const c = C(col); cv = makeCanvas(fw, fh);
  const cx = cv.getContext("2d"), id = cx.createImageData(fw, fh), d = id.data;
  for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
    const dx = (x - fw / 2) / (fw / 2), dy = (y - fh / 2) / (fh / 2), e = 1 - dx * dx - dy * dy; if (e <= 0) continue;
    const a = e * (0.4 + 0.9 * fbm(x * 0.08, y * 0.25, seed)), q = Math.floor(a * 4 + bayer(x, y)) / 4, o = (y * fw + x) * 4;
    d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = Math.round(clamp01(q) * 255);
  }
  cx.putImageData(id, 0, 0); spriteCache.set(key, cv); return cv;
}
const RUNES = [[0, 0, 2, 0, 1, 1, 1, 2], [0, 0, 0, 2, 2, 1, 1, 0], [1, 0, 0, 1, 2, 1, 1, 2], [0, 0, 1, 1, 2, 2, 0, 2], [0, 1, 2, 1, 1, 0, 1, 2]];
const flickN = (t, s) => 0.62 + 0.2 * Math.sin(t * 0.009 + s) + 0.12 * Math.sin(t * 0.023 + s * 2.1) + 0.06 * Math.sin(t * 0.051 + s * 3.7);
const buckets = [[], [], [], []];
function drawParts(ctx, w, h, t, p) {
  const n = p.n, s = p.seed || 1, ts = t / 1000, x0 = p.x0 * w, xr = (p.x1 - p.x0) * w, y0 = p.y0 * h, yr = (p.y1 - p.y0) * h;
  for (const b of buckets) b.length = 0;
  for (let i = 0; i < n; i++) {
    const u1 = hash(i, 1, s), u2 = hash(i, 2, s), u3 = hash(i, 3, s), u4 = hash(i, 4, s), sp = 0.6 + 0.8 * u3;
    let fy = u2 + ((p.vy || 0) * sp * ts * h) / Math.max(1, yr); fy -= Math.floor(fy);
    let fx = u1 + ((p.vx || 0) * sp * ts * w) / Math.max(1, xr); fx -= Math.floor(fx);
    const x = x0 + fx * xr + (p.sway ? Math.sin(ts * (p.swf || 1) * sp + u4 * TAU) * p.sway : 0);
    const y = y0 + fy * yr + (p.bob ? Math.sin(ts * (p.bobf || 1) + u1 * TAU) * p.bob : 0);
    let a = 1;
    if (p.tw) a *= 0.55 + 0.45 * Math.sin(ts * p.tw * sp + u4 * TAU);
    if (p.blink) { const b = Math.sin(ts * p.blink * sp + u4 * TAU); a *= b > 0 ? b * b : 0; }
    if (p.vy) a *= Math.min(1, fy * 6, (1 - fy) * 6); else if (p.vx) a *= Math.min(1, fx * 8, (1 - fx) * 8);
    if (a <= 0.08) continue;
    const k = Math.min(3, Math.floor(a * 4)), sz = p.big && u3 > 1 - p.big ? 4 : p.sz || 2;
    buckets[k].push(Math.round(x / 2) * 2, Math.round(y / 2) * 2, sz, i);
  }
  ctx.fillStyle = p.col;
  for (let k = 0; k < 4; k++) {
    const b = buckets[k]; if (!b.length) continue;
    const al = p.a * (k + 1) / 4;
    if (p.halo) { ctx.globalAlpha = al * p.halo; ctx.beginPath(); for (let j = 0; j < b.length; j += 4) ctx.rect(b[j] - b[j + 2], b[j + 1] - b[j + 2], b[j + 2] * 3, b[j + 2] * 3); ctx.fill(); }
    ctx.globalAlpha = al; ctx.beginPath();
    for (let j = 0; j < b.length; j += 4) {
      const x = b[j], y = b[j + 1], sz = b[j + 2];
      if (p.streak) { for (let q = 0; q < p.streak; q++) ctx.rect(x + Math.round(q * p.slant * 2 / 2) * 2, y + q * 2, 2, 2); }
      else if (p.len) ctx.rect(x, y, sz, sz * (p.len + 1));
      else if (p.ring && sz === 4) { ctx.rect(x - 2, y - 4, 4, 2); ctx.rect(x - 2, y + 2, 4, 2); ctx.rect(x - 4, y - 2, 2, 4); ctx.rect(x + 2, y - 2, 2, 4); }
      else if (p.rune) { const g = RUNES[b[j + 3] % RUNES.length]; for (let q = 0; q < g.length; q += 2) ctx.rect(x + g[q] * 2, y + g[q + 1] * 2, 2, 2); }
      else ctx.rect(x, y, sz, sz);
    }
    ctx.fill();
  }
}

let RMQ = null;
function reducedMotion() {
  try {
    if (RMQ === null) RMQ = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : false;
    return !!(RMQ && RMQ.matches);
  } catch (e) { return false; }
}

const CACHE = new Map();
const CACHE_MAX = 12;

// ctx: メインキャンバス (480x320 想定だが固定しない)。layer: 1-20 (それ以外は奈落の既定背景)。
// now: performance.now() (ms)。opts: { boss?: boolean, elite?: boolean }
export function drawBattleBackdrop(ctx, w, h, layer, now, opts = {}) {
  w = Math.max(16, Math.round(w)); h = Math.max(16, Math.round(h));
  const L = layer >= 1 && layer <= 20 ? Math.floor(layer) : 0;
  const boss = !!(opts && opts.boss), elite = !boss && !!(opts && opts.elite);
  const key = L + "|" + w + "x" + h + "|" + (boss ? "b" : elite ? "e" : "n");
  let S = CACHE.get(key);
  if (!S) {
    S = build(L, w, h, boss, elite);
    CACHE.set(key, S);
    if (CACHE.size > CACHE_MAX) CACHE.delete(CACHE.keys().next().value);
  }
  paint(ctx, S, w, h, now, boss, elite);
}
// キャッシュした静的情景 + アニメ層を貼る (戦闘背景と迷宮の顔で共用)
function paint(ctx, S, w, h, now, boss, elite) {
  const rm = reducedMotion(), t = rm ? 0 : now || 0, A = S.A;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
  ctx.drawImage(S.img, 0, 0, S.hw * 2, S.hh * 2);
  // 霧 (横へ漂う淡い帯)
  for (const f of A.fogs) {
    const img = fogSprite(f.col, f.fw, f.fh, f.seed), span = w + f.fw * 2;
    for (let i = 0; i < f.n; i++) {
      const u = hash(i, 7, f.seed), x = ((u * span + (t / 1000) * f.sp * (0.7 + 0.6 * hash(i, 8, f.seed))) % span + span) % span - f.fw * 2;
      const y = f.y * h + (hash(i, 9, f.seed) - 0.5) * f.fh * 3;
      ctx.globalAlpha = f.a * (0.7 + 0.3 * Math.sin(t * 0.0004 + i));
      ctx.drawImage(img, Math.round(x / 2) * 2, Math.round((y - f.fh) / 2) * 2, f.fw * 2, f.fh * 2);
    }
  }
  ctx.globalCompositeOperation = "lighter";
  // 明滅する発光層 (コースティクス・炉の脈動・稲光・魔法陣など)
  for (const p of S.pulses) { const a = rm ? 0.4 : clamp01(p.f(t)); if (a > 0.01) { ctx.globalAlpha = a; ctx.drawImage(p.img, 0, 0, S.hw * 2, S.hh * 2); } }
  // 灯火の揺らぎ
  for (const f of A.flicks) {
    const img = glowSprite(f.col, f.r);
    ctx.globalAlpha = f.a * (rm ? 0.7 : flickN(t * f.sp, f.s));
    ctx.drawImage(img, Math.round(f.x - f.r) * 2, Math.round(f.y - f.r) * 2, (f.r * 2 + 1) * 2, (f.r * 2 + 1) * 2);
  }
  ctx.globalCompositeOperation = "source-over";
  for (const p of A.parts) drawParts(ctx, w, h, t, p);
  if (A.special) A.special(ctx, w, h, t);
  if (boss) drawParts(ctx, w, h, t, BOSS_MOTES);
  if (elite) {
    const img = fogSprite("#a01818", 110, 14, 41);
    for (let i = 0; i < 4; i++) {
      const span = w + 440, x = ((hash(i, 1, 41) * span + (t / 1000) * (6 + i * 2)) % span) - 220, y = h * (0.3 + 0.13 * i);
      ctx.globalAlpha = 0.2; ctx.drawImage(img, Math.round(x / 2) * 2, Math.round(y / 2) * 2, 220, 28);
    }
  }
  ctx.restore();
}
const BOSS_MOTES = { n: 16, col: "#ff4a6a", x0: 0.15, x1: 0.85, y0: 0.25, y1: 0.8, vy: -0.035, sway: 8, swf: 0.4, a: 0.45, tw: 1.4, seed: 66 };
