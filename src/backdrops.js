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
// 鍾乳石 (dir=1 下向き) / 石筍 (dir=-1 上向き)。左面明・右面暗、縦に段の筋
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

// 層 7 灼熱の洞: 溶岩の河と溶岩滝、柱状玄武岩、赤く照らされた鍾乳石、昇る火の粉
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
  // 鍾乳石 (上辺)
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

// 層 12 地底大空洞: 巨大な鍾乳石と石筍、深い裂け目、遠くで光る結晶群、細い地底滝
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
  // 天井の岩と巨大な鍾乳石
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
  R.m = SURF; for (let band = 1; band * 9 < gy; band += 2) for (let x = 0; x < W; x += 6) { R.rect(x + (band % 4 === 1 ? 0 : 3), band * 9, 2, 3, mul(bone, 1.05)); } // 骨端の瘤
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
