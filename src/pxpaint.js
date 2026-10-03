// 手続き的ドット絵の「絵筆」— タイトル画面とオープニングの一枚絵を描くための小さな描画エンジン
//
// 方針: 形 (マスク) を作り、ピクセルごとに光と影を「連続値の RGB」で塗り、
// 最後に限られた色数のマスターパレットへ順序ディザで量子化する。
// これで画面全体が同じ色相シフトのランプ (影=冷たいすみれ、光=温かい骨色) で統一され、
// 手打ちのドット絵らしい色の固まりと、境目だけに入る細いディザが得られる。
// 画像ファイルは一切使わない。

// ---- ディザ ----
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export const bay = (x, y) => (BAYER[((y & 3) << 2) | (x & 3)] + 0.5) / 16;

// ---- 色 ----
export function hx(c) {
  return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
}
export const ramp = (list) => list.map(hx);
// ランプ上の連続位置 t (0-1) の色
export function rc(R, t) {
  const n = R.length - 1;
  const u = !(t > 0) ? 0 : t >= 1 ? n : t * n; // NaN も 0 扱い
  const i = Math.min(n - 1, Math.floor(u)), f = u - i;
  const a = R[i], b = R[i + 1] || a;
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}
export const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const addc = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
export const mulc = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const smooth = (e0, e1, v) => { const t = clamp((v - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };

// ---- マスターパレット (色相シフトしたランプの集合) ----
// 影は冷たいすみれ、光は温かい骨色へ。差し色は 魂火 (青緑)・おき火 (橙)・血 (紅) のみ。
export const R_NIGHT = ramp(["#030206", "#06050b", "#0a0811", "#0f0c18", "#15111f", "#1c1727", "#241e31", "#2d263b", "#383046", "#443a52", "#52475f", "#62566d", "#74677c", "#887a8c"]);
export const R_BONE = ramp(["#5e5050", "#7a6a66", "#97857c", "#b3a08e", "#cdb9a2", "#e2d1b8", "#f2e7d2"]);
export const R_SOUL = ramp(["#071214", "#0b1d1f", "#10292a", "#163835", "#1d4a42", "#275f50", "#357a62", "#4a9a76", "#66ba8c", "#8ed6a6", "#bdeec6", "#e9fff2"]);
export const R_EMBER = ramp(["#1c0a06", "#34130a", "#52200e", "#763212", "#9c4816", "#c4641c", "#e2892c", "#f4b04a", "#fcd77e", "#fff3c4"]);
export const R_BLOOD = ramp(["#12040a", "#22070f", "#360b14", "#4e1019", "#6a161e", "#8a1e22", "#ac2c28", "#c84a34", "#de7048", "#eea064"]);
export const R_DUSK = ramp(["#1a0f1c", "#2a1626", "#3c1e2e", "#522838", "#6c3440"]);
export const R_FOG = ramp(["#2c2838", "#3a3548", "#4c465c", "#605a70", "#78728a", "#958fa4"]);
export const R_WOOD = ramp(["#140d0a", "#1e140f", "#2e1f16", "#43301f", "#5c432b", "#7a5a3a", "#9a7a52", "#b89a6c"]);
export const R_STEEL = ramp(["#121418", "#1b1f25", "#262b33", "#343a43", "#4b535c", "#66707a", "#8a949c", "#b4bcc0", "#dfe4e2"]);
export const R_SOULSTONE = ramp(["#0c1418", "#111e22", "#172a2c", "#1f3836", "#2a4a44", "#3a6254", "#527e68", "#73a084"]);
const MASTER = [R_NIGHT, R_BONE, R_SOUL, R_EMBER, R_BLOOD, R_DUSK, R_FOG, R_WOOD, R_STEEL, R_SOULSTONE].flat();

// 最近色 (redmean 距離)。6bit の遅延 LUT でキャッシュする
export class Palette {
  constructor(cols = MASTER) {
    this.cols = cols;
    this.lut = new Int16Array(1 << 18).fill(-1);
  }
  near(r, g, b) {
    r = r < 0 ? 0 : r > 255 ? 255 : r;
    g = g < 0 ? 0 : g > 255 ? 255 : g;
    b = b < 0 ? 0 : b > 255 ? 255 : b;
    const key = ((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2);
    let v = this.lut[key];
    if (v >= 0) return v;
    const R = ((r >> 2) << 2) + 2, G = ((g >> 2) << 2) + 2, B = ((b >> 2) << 2) + 2;
    let best = 1e18;
    for (let i = 0; i < this.cols.length; i++) {
      const c = this.cols[i];
      const rm = (R + c[0]) / 2, dr = R - c[0], dg = G - c[1], db = B - c[2];
      const d = (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
      if (d < best) { best = d; v = i; }
    }
    this.lut[key] = v;
    return v;
  }
}
export const PAL = new Palette();

// ---- ノイズ ----
export function h2(x, y, s = 0) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
export function h1(i, s = 0) { return h2(i, 7, s); }
export function vnoise(x, y, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  let fx = x - xi, fy = y - yi;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const a = h2(xi, yi, s), b = h2(xi + 1, yi, s), c = h2(xi, yi + 1, s), d = h2(xi + 1, yi + 1, s);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
export function fbm(x, y, s = 0, oct = 4) {
  let v = 0, amp = 0.5, f = 1, tot = 0;
  for (let i = 0; i < oct; i++) { v += vnoise(x * f, y * f, s + i * 17) * amp; tot += amp; amp *= 0.5; f *= 2.03; }
  return v / tot;
}
// 決定的な乱数列
export function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s = (Math.imul(s ^ (s >>> 15), 2246822519) + 0x9e3779b9) >>> 0; s ^= s >>> 13; return (s >>> 0) / 4294967296; };
}

// ---- 形 (マスク) ----
export class Mask {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.m = new Uint8Array(w * h);
    this.x0 = w; this.y0 = h; this.x1 = -1; this.y1 = -1;
  }
  _span(y, xa, xb, v) {
    if (y < 0 || y >= this.h) return;
    xa = Math.max(0, xa); xb = Math.min(this.w - 1, xb);
    if (xb < xa) return;
    const o = y * this.w;
    for (let x = xa; x <= xb; x++) this.m[o + x] = v;
    if (v) {
      if (xa < this.x0) this.x0 = xa; if (xb > this.x1) this.x1 = xb;
      if (y < this.y0) this.y0 = y; if (y > this.y1) this.y1 = y;
    }
  }
  // 多角形 (平らな座標列 [x0,y0,x1,y1,...]) を偶奇規則で塗る。画素中心 (+0.5) で判定
  poly(p, v = 1) {
    const n = p.length >> 1;
    let ymin = Infinity, ymax = -Infinity;
    for (let i = 0; i < n; i++) { ymin = Math.min(ymin, p[i * 2 + 1]); ymax = Math.max(ymax, p[i * 2 + 1]); }
    const xs = [];
    for (let y = Math.max(0, Math.floor(ymin)); y <= Math.min(this.h - 1, Math.ceil(ymax)); y++) {
      const yc = y + 0.5;
      xs.length = 0;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const xi = p[i * 2], yi = p[i * 2 + 1], xj = p[j * 2], yj = p[j * 2 + 1];
        if ((yi > yc) !== (yj > yc)) xs.push(xi + ((yc - yi) / (yj - yi)) * (xj - xi));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) this._span(y, Math.ceil(xs[k] - 0.5), Math.ceil(xs[k + 1] - 0.5) - 1, v);
    }
    return this;
  }
  ellipse(cx, cy, rx, ry, v = 1) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      const t = (y + 0.5 - cy) / ry;
      if (t <= -1 || t >= 1) continue;
      const hw = rx * Math.sqrt(1 - t * t);
      this._span(y, Math.ceil(cx - hw - 0.5), Math.ceil(cx + hw - 0.5) - 1, v);
    }
    return this;
  }
  rect(x, y, w, h, v = 1) {
    for (let yy = Math.round(y); yy < Math.round(y + h); yy++) this._span(yy, Math.round(x), Math.round(x + w) - 1, v);
    return this;
  }
  // 太さ th の線分 (端は丸めない四角)
  line(x0, y0, x1, y1, th, v = 1, th1 = th) {
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L, ny = dx / L;
    return this.poly([x0 + nx * th / 2, y0 + ny * th / 2, x1 + nx * th1 / 2, y1 + ny * th1 / 2, x1 - nx * th1 / 2, y1 - ny * th1 / 2, x0 - nx * th / 2, y0 - ny * th / 2], v);
  }
  at(x, y) {
    x |= 0; y |= 0;
    return x < 0 || y < 0 || x >= this.w || y >= this.h ? 0 : this.m[y * this.w + x];
  }
  // 光の方向 (dx,dy) へ何ピクセルで外に出るか (1..max、出なければ max+1)
  rim(x, y, dx, dy, max = 3) {
    for (let d = 1; d <= max; d++) if (!this.at(Math.round(x + dx * d), Math.round(y + dy * d))) return d;
    return max + 1;
  }
  edge(x, y) { return !this.at(x - 1, y) || !this.at(x + 1, y) || !this.at(x, y - 1) || !this.at(x, y + 1); }
  // 横方向の擬似法線 (-1 = 左を向く面 .. 1 = 右を向く面)。左右の縁までの距離から円筒とみなす
  nx(x, y, max = 10, same = 0) {
    const v0 = this.at(x, y);
    const ok = (xx) => (same ? this.at(xx, y) === v0 : this.at(xx, y));
    let dl = 0, dr = 0;
    while (dl < max && ok(x - dl - 1)) dl++;
    while (dr < max && ok(x + dr + 1)) dr++;
    return (dl - dr) / (dl + dr + 1);
  }
}

// ---- 層 (浮動小数 RGB + 被覆率) ----
export class Layer {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.c = new Float32Array(w * h * 3);
    this.a = new Float32Array(w * h);
  }
  // 1 ピクセルを上に重ねる (a<1 は半透明合成)
  px(x, y, col, a = 1) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || a <= 0) return;
    const i = y * this.w + x, k = i * 3;
    if (a >= 1) { this.c[k] = col[0]; this.c[k + 1] = col[1]; this.c[k + 2] = col[2]; this.a[i] = 1; return; }
    const A = this.a[i], na = a + A * (1 - a);
    const wa = a / na, wb = 1 - wa;
    this.c[k] = col[0] * wa + this.c[k] * wb;
    this.c[k + 1] = col[1] * wa + this.c[k + 1] * wb;
    this.c[k + 2] = col[2] * wa + this.c[k + 2] * wb;
    this.a[i] = na;
  }
  // 既に塗られた画素へ光を足す
  add(x, y, col, k = 1) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x;
    if (this.a[i] <= 0) return;
    const j = i * 3;
    this.c[j] += col[0] * k; this.c[j + 1] += col[1] * k; this.c[j + 2] += col[2] * k;
  }
  get(x, y) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    const i = y * this.w + x;
    return this.a[i] > 0 ? [this.c[i * 3], this.c[i * 3 + 1], this.c[i * 3 + 2]] : null;
  }
  // 矩形の各画素で fn(x,y) を呼ぶ。戻り値 [r,g,b] または [r,g,b,a] を重ねる (null は塗らない)
  shade(x0, y0, x1, y1, fn) {
    x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0));
    x1 = Math.min(this.w - 1, Math.ceil(x1)); y1 = Math.min(this.h - 1, Math.ceil(y1));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const c = fn(x, y);
      if (c) this.px(x, y, c, c.length > 3 ? c[3] : 1);
    }
  }
  // マスクの内側だけを塗る。fn(x,y,v) — v はマスク値
  paint(m, fn) {
    for (let y = m.y0; y <= m.y1; y++) for (let x = m.x0; x <= m.x1; x++) {
      const v = m.m[y * m.w + x];
      if (!v) continue;
      const c = fn(x, y, v);
      if (c) this.px(x, y, c, c.length > 3 ? c[3] : 1);
    }
  }
  // パレットへ量子化して canvas にする。amp = ディザの振れ幅 (RGB 単位)
  canvas(amp = 14, pal = PAL) {
    const cv = document.createElement("canvas");
    cv.width = this.w; cv.height = this.h;
    const g = cv.getContext("2d");
    const img = g.createImageData(this.w, this.h);
    const d = img.data, cols = pal.cols;
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const i = y * this.w + x, a = this.a[i];
      if (a <= 0) continue;
      if (a < 0.999 && a <= bay(x + 2, y + 1)) continue; // 半透明はディザで間引く
      const k = i * 3;
      // 暗部は色の段差が小さいので、ディザの振れ幅も明るさに合わせて絞る (市松模様のざらつきを防ぐ)
      const lum = this.c[k] * 0.3 + this.c[k + 1] * 0.5 + this.c[k + 2] * 0.2;
      const o = (bay(x, y) - 0.5) * amp * (lum < 70 ? 0.25 + 0.75 * (lum / 70) : 1);
      const c = cols[pal.near((this.c[k] + o) | 0, (this.c[k + 1] + o) | 0, (this.c[k + 2] + o) | 0)];
      const p = i * 4;
      d[p] = c[0]; d[p + 1] = c[1]; d[p + 2] = c[2]; d[p + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return cv;
  }
}

// 霧・光の帯など「ざらつかせたくない半透明」用: 色は量子化、透明度は段階 (levels) で残す
export function softCanvas(L, levels = 5, pal = PAL) {
  const cv = document.createElement("canvas");
  cv.width = L.w; cv.height = L.h;
  const g = cv.getContext("2d");
  const img = g.createImageData(L.w, L.h);
  const d = img.data, cols = pal.cols;
  for (let i = 0; i < L.w * L.h; i++) {
    const a = L.a[i];
    if (a <= 0.01) continue;
    const q = Math.round(a * levels) / levels;
    if (q <= 0) continue;
    const k = i * 3;
    const c = cols[pal.near(L.c[k] | 0, L.c[k + 1] | 0, L.c[k + 2] | 0)];
    const p = i * 4;
    d[p] = c[0]; d[p + 1] = c[1]; d[p + 2] = c[2]; d[p + 3] = Math.round(q * 255);
  }
  g.putImageData(img, 0, 0);
  return cv;
}

// 放射状の光の玉 (毎フレーム lighter で重ねる用)。ディザを使わず数段の同心の帯で減衰させる
// (ドット絵らしい段々の光。暗い面に重ねても市松模様が出ない)。R は明るい側を末尾にしたランプ
export function glowSprite(rad, R, { pow = 1.6, squash = 1, core = 1, levels = 7 } = {}) {
  const s = Math.ceil(rad) * 2 + 1;
  const c = document.createElement("canvas");
  c.width = s; c.height = Math.ceil(s * squash) | 1;
  const g = c.getContext("2d");
  const img = g.createImageData(c.width, c.height);
  const cx = (c.width - 1) / 2, cy = (c.height - 1) / 2;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    const d = Math.hypot(x - cx, (y - cy) / squash) / rad;
    if (d >= 1) continue;
    const t = Math.floor(Math.pow(1 - d, pow) * core * levels) / levels;
    if (t <= 0) continue;
    const col = rc(R, t);
    const p = (y * c.width + x) * 4;
    img.data[p] = col[0]; img.data[p + 1] = col[1]; img.data[p + 2] = col[2]; img.data[p + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

// 画面 (CSS px) に対し、整数倍で拡大したときにちょうど覆う低解像度サイズを選ぶ
// maxArea 以下に収まる最小の倍率を採る → くっきりした均一なドット
export function pickRes(cssW, cssH, dpr, { maxArea = 150000, maxW = 520, minW = 0 } = {}) {
  const dw = Math.max(1, Math.round(cssW * dpr)), dh = Math.max(1, Math.round(cssH * dpr));
  for (let s = 1; s <= 16; s++) {
    const w = Math.ceil(dw / s), h = Math.ceil(dh / s);
    if (w * h <= maxArea && w <= maxW) {
      if (w < minW && s > 1) { const s2 = s - 1; return { w: Math.ceil(dw / s2), h: Math.ceil(dh / s2), s: s2, cssScale: s2 / dpr }; }
      return { w, h, s, cssScale: s / dpr };
    }
  }
  return { w: Math.ceil(dw / 16), h: Math.ceil(dh / 16), s: 16, cssScale: 16 / dpr };
}

export function canvasOf(w, h) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return c;
}

// セル (ウォロノイ) ノイズ: 石畳・ひび割れ用。[最近点距離, 2 番目の距離, セルID]
export function worley(x, y, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  let f1 = 9, f2 = 9, id = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = xi + i, cy = yi + j;
    const px = cx + h2(cx, cy, s), py = cy + h2(cx, cy, s + 1);
    const d = Math.hypot(px - x, py - y);
    if (d < f1) { f2 = f1; f1 = d; id = h2(cx, cy, s + 2); } else if (d < f2) f2 = d;
  }
  return [f1, f2, id];
}
