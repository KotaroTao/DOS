// 街の絵 — ダークファンタジーのドット絵と、施設の情景・人物の描き下ろし原画
//
// ・Relief: 画素ごとに「材質 / 法線 / 奥行き / 遮蔽」を持つ浮彫りラスタ。形 (楕円体・管・多角形) を
//   塗り重ね、凹凸 (bump) を足してから光源で陰影を付け、材質ごとの色ランプ (影=冷たい紫 → 光=暖かい色)
//   へベイヤー網で量子化する。一つの主光源で明暗を統一し、輪郭は影側だけ濃くする (選択的アウトライン)。
// ・施設の情景 (vignette)・番人の胸像・王の肖像・街の夜景パノラマをこの道具で描く。
// ・動きは数コマを前もって描き溜め、共有の rAF ループ (livingCanvas) で差し替えるだけ。
//   画面を作り直しても静的な層はキャッシュから貼るので、再描画は軽い。最初のコマ以外と夜景の
//   下ごしらえはアイドル時間に片付ける (prewarmTown)。
//
// 公開するもの:
//   createTownScene()        広場の夜景パノラマ (canvas 240x170・動く)
//   townSpots()              夜景の名所の位置 (割合) — 広場の札を重ねる
//   vignetteCanvas(key)      施設の情景 (canvas 120x75・灯が揺らぐ。原画のある鍵は townpaint.js の高精細版)
//   keeperCanvas(key)        施設の人物の胸像 (原画版480x560 / ドット絵48x56)
//   iconCanvas(key)          迷宮の門・封じられた門・潜行の号令・錠前・奈落の紋章 (静止画)
//   kingCanvas()             物語の王の胸像 (原画版480x480 / ドット絵42x42)
//   KING_PORTRAIT            従来の王の胸像 ({ palette, art } 42x42)
//   prewarmTown(keys)        上の絵をアイドル時間に描き溜める

import { hasPaintedVignette, paintedVignette } from "./townpaint.js";
import { TOWN_KEEPERART, TOWN_ICONART } from "./townkeyart.js";

const TAU = Math.PI * 2;
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
const fbm = (x, y, s) => vnoise(x, y, s) * 0.55 + vnoise(x * 2.03, y * 2.03, s + 7) * 0.3 + vnoise(x * 4.1, y * 4.1, s + 13) * 0.15;
const fbm2 = (x, y, s) => vnoise(x, y, s) * 0.65 + vnoise(x * 2.03, y * 2.03, s + 7) * 0.35; // 凹凸用の軽い 2 オクターブ
function rng(seed) { // mulberry32
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const _hx = new Map();
function hex(h) {
  if (typeof h !== "string") return h;
  let c = _hx.get(h);
  if (!c) { const n = parseInt(h.slice(1), 16); c = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; _hx.set(h, c); }
  return c;
}
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const hasDOM = () => typeof document !== "undefined" && typeof document.createElement === "function";
function makeCanvas(w, h) {
  if (!hasDOM()) return null;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return c;
}

// ───────────────────────────────────────────────────────────────────────────
// 材質 (色ランプ)。暗部は冷たい紫〜藍、明部ほど暖かく。spec = 金属の照り、tint = 光の色の乗り
// ───────────────────────────────────────────────────────────────────────────
const MAT = {
  stone:   { ramp: ["#050409", "#0e0c16", "#1a1722", "#2a2530", "#3e3740", "#575050", "#77705f", "#9d9378", "#c4b896"], tint: 0.55 },
  stoneD:  { ramp: ["#040307", "#0a0910", "#13111a", "#1e1a24", "#2c2731", "#3e3840", "#57504f", "#776e62"], tint: 0.55 },
  wood:    { ramp: ["#060408", "#120b0f", "#211414", "#331f18", "#4a2d1c", "#643f23", "#83562d", "#a8743c", "#cf9a55"], tint: 0.5 },
  woodD:   { ramp: ["#050307", "#0d080b", "#180f10", "#251812", "#352217", "#48301d", "#5e4026"], tint: 0.5 },
  iron:    { ramp: ["#040407", "#0b0b12", "#15151e", "#22222c", "#33333d", "#4a4a52", "#66656b", "#8c8a8c", "#bdb8b0"], spec: 0.55, shine: 14, tint: 0.6 },
  gold:    { ramp: ["#080406", "#1a0e0a", "#33200f", "#4f3414", "#715019", "#956f22", "#b8902f", "#dbb44a", "#f6dc86"], spec: 0.7, shine: 18, tint: 0.35 },
  bone:    { ramp: ["#07060a", "#16131a", "#28232a", "#3d3634", "#585045", "#776c58", "#978b6f", "#b9ab88", "#ddd0aa"], tint: 0.5 },
  skin:    { ramp: ["#070407", "#170c10", "#2a1618", "#40221f", "#5a3329", "#774836", "#956048", "#b47b5c", "#d29a76"], tint: 0.45 },
  skinPale:{ ramp: ["#06050a", "#130f16", "#241c22", "#38292c", "#4f3b39", "#6a5049", "#86675b", "#a5826f", "#c4a088"], tint: 0.45 },
  crimson: { ramp: ["#060307", "#13060c", "#240911", "#380c15", "#4f111a", "#6a1820", "#87232a", "#a63a36", "#c75a48"], tint: 0.45 },
  cloth:   { ramp: ["#050408", "#0c0a10", "#151219", "#1f1a22", "#2b252c", "#3a3237", "#4c4246", "#625557"], tint: 0.55 },
  violet:  { ramp: ["#050409", "#0d0a16", "#171126", "#221838", "#2f2149", "#3e2c5c", "#523a70", "#6a4d86"], tint: 0.5 },
  fur:     { ramp: ["#07070b", "#14141b", "#24232b", "#38363c", "#504c4f", "#6d6866", "#8f897f", "#b3ab9a", "#d8cfb8"], tint: 0.5 },
  hair:    { ramp: ["#050407", "#0e0b0e", "#191316", "#251c1c", "#342823", "#46372c", "#5c4a39"], tint: 0.5 },
  grey:    { ramp: ["#060609", "#121218", "#202027", "#313038", "#45434a", "#5d5a5e", "#7a7675", "#9b958f", "#c0b9ae"], tint: 0.5 },
  parch:   { ramp: ["#080608", "#1a1310", "#2e2219", "#453422", "#5f4a2f", "#7c623d", "#9b7d4f", "#bb9b66", "#d9bc84"], tint: 0.45 },
  leather: { ramp: ["#060406", "#120b0c", "#1f1310", "#2e1c14", "#40281a", "#553521", "#6c4429"], tint: 0.5 },
  plaster: { ramp: ["#050408", "#0e0b11", "#19141a", "#251d22", "#33292b", "#453735", "#5a4842", "#735d50", "#8f7562"], tint: 0.55 },
  slate:   { ramp: ["#04040a", "#0a0a14", "#12121f", "#1b1b2b", "#262638", "#333346", "#444456", "#5a5a68", "#76747c"], tint: 0.6 },
  moss:    { ramp: ["#040506", "#0a0d0c", "#121611", "#1b2016", "#252b1b", "#323821", "#424829"], tint: 0.5 },
  glass:   { ramp: ["#05060a", "#0c1018", "#141c26", "#203040", "#34495a", "#557080", "#86a0a8"], spec: 0.9, shine: 30, tint: 0.6 },
  // 自発光
  flame:   { emit: true, ramp: ["#2a0806", "#5c1408", "#992e0c", "#d25a14", "#f08a26", "#ffbf52", "#ffe39a", "#fff6d8"] },
  ember:   { emit: true, ramp: ["#140406", "#2e0808", "#561008", "#86200c", "#b83c12", "#e2661c", "#ff9a3a"] },
  window:  { emit: true, ramp: ["#100606", "#2c0e08", "#5a1e0a", "#8e3810", "#c45e1a", "#ec8e30", "#ffc061", "#ffe6a6"] },
  soulRed: { emit: true, ramp: ["#12030a", "#300610", "#5a0a18", "#8c1222", "#c02230", "#e8443e", "#ff7a5c", "#ffb89a", "#fff0e0"] },
  soul:    { emit: true, ramp: ["#0a0614", "#1a0e30", "#2c1a52", "#45307a", "#6650a4", "#8c7ccc", "#b4b4ea", "#dcf2fa", "#ffffff"] },
  moon:    { emit: true, ramp: ["#1a1824", "#3a3648", "#5e5868", "#8a8290", "#b6aeb0", "#d8d0c6", "#efe8da"] },
  dark:    { emit: true, ramp: ["#000000", "#030205", "#06040a", "#0a0710"] },
};

// ───────────────────────────────────────────────────────────────────────────
// Relief: 浮彫りラスタ
// 形の共通オプション o:
//   m: 材質, z: 奥行きの基準 (大きいほど手前), id: 物体番号 (輪郭判定), tone: 明度の底上げ,
//   tex: [縮尺, 振幅, 種, 縦縮尺] 明度のムラ, bump: [縮尺, 強さ, 種, 縦縮尺] 法線の凹凸,
//   tf(x,y): 明度の追加関数, em: 自発光の強さ (emit 材質), emf(x,y), ao: 環境光の遮蔽,
//   under: 既に塗られた画素は塗らない (背面に描く), clip(x,y): 塗る範囲の制限
// ───────────────────────────────────────────────────────────────────────────
class Relief {
  constructor(w, h) {
    const n = w * h;
    this.w = w; this.h = h;
    this.m = new Int16Array(n).fill(-1);
    this.nx = new Float32Array(n); this.ny = new Float32Array(n); this.nz = new Float32Array(n).fill(1);
    this.z = new Float32Array(n);
    this.ao = new Float32Array(n).fill(1);
    this.sh = new Float32Array(n).fill(1);
    this.tn = new Float32Array(n);
    this.em = new Float32Array(n);
    this.id = new Uint16Array(n);
    this.mats = []; this._mm = new Map();
    this.lights = []; this.glows = [];
    this.ambK = 0.1; this.ambC = [0.75, 0.8, 1.2];
    this._id = 1;
  }
  _mi(m) {
    let i = this._mm.get(m);
    if (i == null) {
      i = this.mats.length;
      this.mats.push({ ramp: m.ramp.map(hex), emit: !!m.emit, spec: m.spec || 0, shine: m.shine || 12, tint: m.tint ?? 0.5, gain: m.gain || 1 });
      this._mm.set(m, i);
    }
    return i;
  }
  newId() { return ++this._id; }
  _P(o) {
    return {
      mi: this._mi(o.m || MAT.stone), z: o.z || 0, id: o.id || 1, tone: o.tone || 0, tex: o.tex, bump: o.bump, tf: o.tf,
      em: o.em || 0, emf: o.emf, ao: o.ao ?? 1, under: o.under, clip: o.clip, only: o.only,
    };
  }
  _put(x, y, P, nx, ny, nz, dz) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x;
    if (P.under && this.m[i] >= 0) return;
    if (P.only != null && this.id[i] !== P.only) return;
    if (P.clip && !P.clip(x, y)) return;
    let t = P.tone;
    if (P.tex) t += (fbm(x * P.tex[0], y * (P.tex[3] ?? P.tex[0]), P.tex[2]) - 0.5) * P.tex[1];
    if (P.tf) t += P.tf(x, y);
    if (P.bump) { // 前進差分で勾配を取る (中心の値を使い回して軽く)
      const s = P.bump[0], k = P.bump[1] * 2, sd = P.bump[2], sy = P.bump[3] ?? s, f0 = fbm2(x * s, y * sy, sd);
      nx += (f0 - fbm2((x + 1) * s, y * sy, sd)) * k;
      ny += (f0 - fbm2(x * s, (y + 1) * sy, sd)) * k;
    }
    this.m[i] = P.mi; this.nx[i] = nx; this.ny[i] = ny; this.nz[i] = nz;
    this.z[i] = P.z + dz; this.ao[i] = P.ao; this.sh[i] = 1; this.tn[i] = t;
    this.em[i] = P.emf ? P.emf(x, y) : P.em; this.id[i] = P.id;
  }
  // 楕円体 (o.flat で平たく、o.rot で回転、o.depth で厚み)
  ell(cx, cy, rx, ry, o = {}) {
    const P = this._P(o), fl = o.flat || 0, dep = o.depth ?? Math.min(rx, ry), rot = o.rot || 0;
    const cs = Math.cos(rot), sn = Math.sin(rot), R = Math.max(rx, ry) + 1;
    for (let y = Math.floor(cy - R); y <= Math.ceil(cy + R); y++) for (let x = Math.floor(cx - R); x <= Math.ceil(cx + R); x++) {
      const X = x + 0.5 - cx, Y = y + 0.5 - cy;
      const u = (X * cs + Y * sn) / rx, v = (-X * sn + Y * cs) / ry, d2 = u * u + v * v;
      if (d2 >= 1) continue;
      const w = Math.sqrt(1 - d2), lx = u * (1 - fl), ly = v * (1 - fl);
      this._put(x, y, P, lx * cs - ly * sn, lx * sn + ly * cs, w + fl, w * dep);
    }
    return this;
  }
  // 多角形 (o.n = 法線 [x,y,z] / o.nf(x,y) / o.dz 奥行き)
  poly(pts, o = {}) {
    const P = this._P(o), nf = o.nf, n0 = o.n || [0, 0, 1], dzf = typeof o.dz === "function" ? o.dz : null, dz0 = typeof o.dz === "number" ? o.dz : 0;
    let y0 = Infinity, y1 = -Infinity;
    for (const p of pts) { if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
    const n = pts.length, xs = [];
    for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(this.h - 1, Math.ceil(y1)); y++) {
      const sy = y + 0.5; xs.length = 0;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const yi = pts[i][1], yj = pts[j][1];
        if ((yi > sy) !== (yj > sy)) xs.push(pts[i][0] + ((sy - yi) / (yj - yi)) * (pts[j][0] - pts[i][0]));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.max(0, Math.round(xs[k])); x < Math.min(this.w, Math.round(xs[k + 1])); x++) {
          const nn = nf ? nf(x, y) : n0;
          this._put(x, y, P, nn[0], nn[1], nn[2], dzf ? dzf(x, y) : dz0);
        }
      }
    }
    return this;
  }
  rect(x, y, w, h, o = {}) { return this.poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], o); }
  // 管 (先細り可)。断面は円筒: 光は軸に直交する向きで回り込む。o.cap で端を丸める
  tube(x0, y0, x1, y1, r0, r1, o = {}) {
    const P = this._P(o), fl = o.flat || 0, dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1, R = Math.max(r0, r1) + 1;
    for (let y = Math.floor(Math.min(y0, y1) - R); y <= Math.ceil(Math.max(y0, y1) + R); y++) {
      for (let x = Math.floor(Math.min(x0, x1) - R); x <= Math.ceil(Math.max(x0, x1) + R); x++) {
        const X = x + 0.5, Y = y + 0.5;
        const t = ((X - x0) * dx + (Y - y0) * dy) / L2;
        if (!o.cap && (t < 0 || t > 1)) continue;
        const tc = t < 0 ? 0 : t > 1 ? 1 : t, r = r0 + (r1 - r0) * tc;
        const ex = X - (x0 + dx * tc), ey = Y - (y0 + dy * tc), d2 = (ex * ex + ey * ey) / (r * r);
        if (d2 >= 1) continue;
        const w = Math.sqrt(1 - d2);
        this._put(x, y, P, (ex / r) * (1 - fl), (ey / r) * (1 - fl), w + fl, w * r);
      }
    }
    return this;
  }
  // 折れ線の管 (鎖・枝・紐)
  path(pts, r0, r1, o = {}) {
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = r0 + ((r1 - r0) * i) / (pts.length - 1), b = r0 + ((r1 - r0) * (i + 1)) / (pts.length - 1);
      this.tube(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], a, b, { ...o, cap: true });
    }
    return this;
  }
  // 凹凸: ガウス形の高さを法線に足す (amp<0 で窪み)。o.ao で窪みの陰、o.tone で明度
  bump(cx, cy, rx, ry, amp, o = {}) {
    const rot = o.rot || 0, cs = Math.cos(rot), sn = Math.sin(rot), R = Math.max(rx, ry) * 1.7;
    for (let y = Math.max(0, Math.floor(cy - R)); y <= Math.min(this.h - 1, Math.ceil(cy + R)); y++) {
      for (let x = Math.max(0, Math.floor(cx - R)); x <= Math.min(this.w - 1, Math.ceil(cx + R)); x++) {
        const i = y * this.w + x;
        if (this.m[i] < 0 || (o.id != null && this.id[i] !== o.id)) continue;
        const X = x + 0.5 - cx, Y = y + 0.5 - cy, u = (X * cs + Y * sn) / rx, v = (-X * sn + Y * cs) / ry;
        const g = Math.exp(-(u * u + v * v) * 2.2);
        if (g < 0.02) continue;
        const gu = amp * g * (-4.4 * u), gv = amp * g * (-4.4 * v); // 局所座標での勾配 (1/r は振幅に含める)
        const gx = gu * cs - gv * sn, gy = gu * sn + gv * cs;
        this.nx[i] -= gx / Math.max(1, rx); this.ny[i] -= gy / Math.max(1, ry);
        if (o.ao) this.ao[i] *= 1 - o.ao * g;
        if (o.tone) this.tn[i] += o.tone * g;
        if (o.sh) this.sh[i] *= 1 - o.sh * g;
      }
    }
    return this;
  }
  // 影を落とす (主光源のみ遮る)。楕円の柔らかい影
  shade(cx, cy, rx, ry, k, o = {}) {
    for (let y = Math.max(0, Math.floor(cy - ry)); y <= Math.min(this.h - 1, Math.ceil(cy + ry)); y++) {
      for (let x = Math.max(0, Math.floor(cx - rx)); x <= Math.min(this.w - 1, Math.ceil(cx + rx)); x++) {
        const i = y * this.w + x;
        if (o.id != null && this.id[i] !== o.id) continue;
        const u = (x + 0.5 - cx) / rx, v = (y + 0.5 - cy) / ry, d = Math.sqrt(u * u + v * v);
        if (d >= 1) continue;
        const f = k * sstep(1, o.soft ?? 0.4, d);
        if (o.ao) this.ao[i] *= 1 - f; else this.sh[i] *= 1 - f;
      }
    }
    return this;
  }
  // 多角形の影
  shadePoly(pts, k, o = {}) {
    let y0 = Infinity, y1 = -Infinity;
    for (const p of pts) { if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
    const n = pts.length, xs = [];
    for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(this.h - 1, Math.ceil(y1)); y++) {
      const sy = y + 0.5; xs.length = 0;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const yi = pts[i][1], yj = pts[j][1];
        if ((yi > sy) !== (yj > sy)) xs.push(pts[i][0] + ((sy - yi) / (yj - yi)) * (pts[j][0] - pts[i][0]));
      }
      xs.sort((a, b) => a - b);
      for (let q = 0; q + 1 < xs.length; q += 2) for (let x = Math.max(0, Math.round(xs[q])); x < Math.min(this.w, Math.round(xs[q + 1])); x++) {
        const i = y * this.w + x;
        if (o.id != null && this.id[i] !== o.id) continue;
        if (o.ao) this.ao[i] *= 1 - k; else this.sh[i] *= 1 - k;
      }
    }
    return this;
  }
  // 光源: 平行光 (向き = 表面から光へ) / 点光源 / 縁光 (輪郭をなぞる逆光)
  dir(x, y, z, col, k, o = {}) { const l = Math.hypot(x, y, z) || 1; this.lights.push({ t: 0, x: x / l, y: y / l, z: z / l, c: col, k, wrap: o.wrap || 0, shadow: o.shadow !== false }); return this; }
  point(x, y, z, col, k, r, o = {}) { this.lights.push({ t: 1, x, y, z, c: col, k, r, cut: o.cut || r * 4, wrap: o.wrap ?? 0.15, shadow: !!o.shadow }); return this; }
  rim(x, y, z, col, k, p = 2) { const l = Math.hypot(x, y, z) || 1; this.lights.push({ t: 0, rim: true, x: x / l, y: y / l, z: z / l, c: col, k, p, wrap: 0, shadow: false }); return this; }
  amb(col, k) { this.ambC = col; this.ambK = k; return this; }
  // 加算の光暈 (段階的に量子化して光の輪に)。仕上げで足す
  glow(x, y, r, col, k, ry = r, steps = 5) { this.glows.push({ x, y, r, ry, c: hex(col), k, steps }); return this; }

  // 陰影を計算して RGBA を返す。o.bg(x,y) = 何も塗られていない画素の色 (無ければ透明)
  // o.outline: 輪郭の暗さ (影側 / 光側)。o.q: 減色の階調幅。o.grade(rgb,x,y): 最終の色調整
  render(o = {}) {
    const { w, h } = this, n = w * h, out = new Float32Array(n * 3), lum = new Float32Array(n), a = new Uint8Array(n);
    const L = this.lights, aC = this.ambC, aK = this.ambK;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, mi = this.m[i], j = i * 3;
      if (mi < 0) {
        if (o.bg) { const c = o.bg(x, y); out[j] = c[0]; out[j + 1] = c[1]; out[j + 2] = c[2]; a[i] = 255; }
        continue;
      }
      a[i] = 255;
      const M = this.mats[mi], ramp = M.ramp, N = ramp.length - 1;
      if (M.emit) {
        const v = clamp01(this.em[i] + this.tn[i]), pos = v * N, lo = Math.floor(pos);
        const c = ramp[Math.min(N, pos - lo > bayer(x, y) ? lo + 1 : lo)];
        out[j] = c[0]; out[j + 1] = c[1]; out[j + 2] = c[2]; lum[i] = v + 1;
        continue;
      }
      let nx = this.nx[i], ny = this.ny[i], nz = this.nz[i];
      const inv = 1 / (Math.hypot(nx, ny, nz) || 1); nx *= inv; ny *= inv; nz *= inv;
      const X = x + 0.5, Y = y + 0.5, Z = this.z[i], ao = this.ao[i], sh = this.sh[i];
      let I = aK * ao, tr = I * aC[0], tg = I * aC[1], tb = I * aC[2], sr = 0, sg = 0, sb = 0;
      for (let k = 0; k < L.length; k++) {
        const l = L[k];
        let lx, ly, lz, att = l.k;
        if (l.t === 0) { lx = l.x; ly = l.y; lz = l.z; if (l.shadow) att *= sh; }
        else {
          lx = l.x - X; if (lx > l.cut || lx < -l.cut) continue;
          ly = l.y - Y; if (ly > l.cut || ly < -l.cut) continue;
          lz = l.z - Z;
          const d = Math.hypot(lx, ly, lz) || 1;
          if (d > l.cut) continue;
          lx /= d; ly /= d; lz /= d;
          const q = d / l.r; att *= (1 / (1 + q * q)) * (1 - d / l.cut);
          if (l.shadow) att *= sh;
        }
        let dd = nx * lx + ny * ly + nz * lz;
        if (l.rim) {
          if (dd <= 0) continue;
          const f = Math.pow(1 - nz, l.p) * dd * att;
          sr += f * l.c[0]; sg += f * l.c[1]; sb += f * l.c[2];
          continue;
        }
        if (l.wrap) dd = (dd + l.wrap) / (1 + l.wrap);
        if (dd <= 0) continue;
        const c = dd * att * (0.55 + 0.45 * ao);
        I += c; tr += c * l.c[0]; tg += c * l.c[1]; tb += c * l.c[2];
        if (M.spec) {
          const hz = lz + 1, hl = Math.hypot(lx, ly, hz) || 1;
          const s = Math.pow(Math.max(0, (nx * lx + ny * ly + nz * hz) / hl), M.shine) * M.spec * att;
          sr += s * l.c[0]; sg += s * l.c[1]; sb += s * l.c[2];
        }
      }
      const v = clamp01(I * M.gain + this.tn[i]), pos = v * N, lo = Math.floor(pos);
      const c = ramp[Math.min(N, pos - lo > bayer(x, y) ? lo + 1 : lo)];
      const ti = I > 1e-4 ? 1 / I : 0, k = M.tint;
      out[j] = c[0] * (1 + (tr * ti - 1) * k) + sr * 160;
      out[j + 1] = c[1] * (1 + (tg * ti - 1) * k) + sg * 160;
      out[j + 2] = c[2] * (1 + (tb * ti - 1) * k) + sb * 160;
      lum[i] = v;
    }
    // 選択的アウトライン: 背景や奥の物体に接する縁を、影側は濃く・光側はわずかに沈める
    const ol = o.outline === false ? null : (o.outline || [0.38, 0.78]);
    if (ol) {
      const edge = new Uint8Array(n);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (this.m[i] < 0) continue;
        const zi = this.z[i], id = this.id[i];
        const nb = (xx, yy) => {
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) return false;
          const q = yy * w + xx;
          return this.m[q] < 0 ? !o.bg || o.edgeBg : this.id[q] !== id && this.z[q] < zi - (o.edgeZ ?? 3);
        };
        if (nb(x - 1, y) || nb(x + 1, y) || nb(x, y - 1) || nb(x, y + 1)) edge[i] = 1;
      }
      for (let i = 0; i < n; i++) if (edge[i] && lum[i] <= 1) {
        const f = lum[i] < 0.42 ? ol[0] : ol[1];
        out[i * 3] *= f; out[i * 3 + 1] *= f; out[i * 3 + 2] *= f;
      }
    }
    // 光暈
    for (const g of this.glows) {
      const x0 = Math.max(0, Math.floor(g.x - g.r)), x1 = Math.min(w, Math.ceil(g.x + g.r));
      const y0 = Math.max(0, Math.floor(g.y - g.ry)), y1 = Math.min(h, Math.ceil(g.y + g.ry));
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const i = y * w + x;
        if (!a[i]) continue;
        const dx = (x + 0.5 - g.x) / g.r, dy = (y + 0.5 - g.y) / g.ry, d2 = dx * dx + dy * dy;
        if (d2 >= 1) continue;
        let f = 1 - Math.sqrt(d2); f *= f;
        if (g.steps) f = Math.floor(f * g.steps + bayer(x, y)) / g.steps;
        if (f <= 0) continue;
        out[i * 3] += g.c[0] * g.k * f; out[i * 3 + 1] += g.c[1] * g.k * f; out[i * 3 + 2] += g.c[2] * g.k * f;
      }
    }
    // 減色 (ベイヤー網) → RGBA
    const Q = o.q || 4, px = new Uint8ClampedArray(n * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!a[i]) continue;
      let r = out[i * 3], g = out[i * 3 + 1], b = out[i * 3 + 2];
      if (o.grade) { const c = o.grade([r, g, b], x, y); r = c[0]; g = c[1]; b = c[2]; }
      const d = bayer(x, y) - 0.5;
      px[i * 4] = Math.round(r / Q + d) * Q; px[i * 4 + 1] = Math.round(g / Q + d) * Q; px[i * 4 + 2] = Math.round(b / Q + d) * Q;
      px[i * 4 + 3] = a[i];
    }
    return px;
  }
}

// RGBA → canvas
function pxCanvas(px, w, h, cv) {
  const c = cv || makeCanvas(w, h);
  if (!c) return null;
  const g = c.getContext && c.getContext("2d");
  if (!g) return c;
  const id = g.createImageData(w, h);
  id.data.set(px);
  g.putImageData(id, 0, 0);
  return c;
}

// 周辺減光 (情景の縁を闇に沈める)
const vignetteGrade = (w, h, k = 0.55, cx = 0.5, cy = 0.45) => (c, x, y) => {
  const dx = (x / w - cx) * 1.25, dy = (y / h - cy) * 1.6, f = 1 - k * sstep(0.35, 1.05, Math.sqrt(dx * dx + dy * dy));
  return [c[0] * f, c[1] * f, c[2] * f];
};

// 光の色 (輝度 ≈ 1 に揃えた色相ベクトル)
const LC = {
  candle: [1.32, 0.92, 0.55], fire: [1.4, 0.82, 0.45], moon: [0.72, 0.88, 1.32], soul: [0.95, 0.8, 1.35],
  red: [1.6, 0.48, 0.42], cold: [0.7, 0.8, 1.35], white: [1, 1, 1], gold: [1.3, 1.0, 0.6],
};

// ───────────────────────────────────────────────────────────────────────────
// 生きた canvas: 共有の rAF ループで数コマを切り替える。DOM から外れたら自ら止まる。
// ───────────────────────────────────────────────────────────────────────────
const REDUCED = (() => { try { return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } })();
const _live = new Set();
let _loopOn = false;
const nowMs = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
function livingCanvas(c, draw, fps = 10) {
  draw(REDUCED ? 3000 : nowMs());
  if (REDUCED || typeof requestAnimationFrame !== "function") return c;
  _live.add({ c, draw, iv: 1000 / fps, last: 0, born: nowMs(), seen: false });
  if (!_loopOn) { _loopOn = true; requestAnimationFrame(_tick); }
  return c;
}
function _tick(ts) {
  const hidden = typeof document !== "undefined" && document.hidden;
  for (const e of _live) {
    if (e.c.isConnected) e.seen = true;
    else if (e.seen || ts - e.born > 15000) { _live.delete(e); continue; }
    if (hidden || !e.seen || ts - e.last < e.iv - 2) continue;
    e.last = ts;
    if (!e.c.getClientRects || e.c.getClientRects().length) e.draw(ts);
  }
  if (_live.size) requestAnimationFrame(_tick);
  else _loopOn = false;
}
// 後回しの仕事: アイドル時間に少しずつ片付ける (残りのコマ・夜景の下ごしらえ)
const _idleQ = [];
let _idleOn = false;
function idle(fn) {
  _idleQ.push(fn);
  if (_idleOn) return;
  _idleOn = true;
  const sched = (f) => (typeof requestIdleCallback === "function" ? requestIdleCallback(f, { timeout: 500 }) : setTimeout(f, 40));
  const run = (dl) => {
    const t0 = nowMs();
    do { try { _idleQ.shift()(); } catch (e) { /* 演出のみ */ } }
    while (_idleQ.length && (dl && typeof dl.timeRemaining === "function" && !dl.didTimeout ? dl.timeRemaining() > 6 : nowMs() - t0 < 10));
    if (_idleQ.length) sched(run); else _idleOn = false;
  };
  sched(run);
}
// コマ列のキャッシュ: 最初のコマだけすぐ描き、残りはアイドル時間に描き足す
function lazyFrames(cache, key, n, make) {
  let fr = cache.get(key);
  if (fr) return fr;
  fr = new Array(n).fill(null);
  fr[0] = make(0);
  cache.set(key, fr);
  for (let i = 1; i < n; i++) idle(() => { if (!fr[i]) fr[i] = make(i); });
  return fr;
}

// コマ列を不規則に切り替える (蝋燭の揺らぎ)。seq は再生順
function flickerSeq(n, len, seed) {
  const r = rng(seed), s = [];
  for (let i = 0; i < len; i++) s.push(Math.floor(r() * n));
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 施設の情景 (vignette) — 120x75。各 painter(R, f) は f = { i: コマ番号, k: 揺らぎ 0.85-1.15, t: 位相 }
// ═══════════════════════════════════════════════════════════════════════════
export const VW = 120, VH = 75;

// 尖頭アーチの多角形 (p=0 半円 / p=1 正三角アーチ)。sy = 迫元の高さ、bot = 足元
function archPts(cx, sy, hw, bot, p = 0.6, n = 14) {
  const r = hw * (1 + p), Cx = cx + hw * p, a1 = Math.acos(-p / (1 + p)), left = [];
  for (let i = 0; i <= n; i++) { const a = Math.PI + (a1 - Math.PI) * (i / n); left.push([Cx + r * Math.cos(a), sy - r * Math.sin(a)]); }
  const right = left.slice().reverse().map(([x, y]) => [2 * cx - x, y]);
  return [[cx - hw, bot], ...left, ...right, [cx + hw, bot]];
}

// 石積みの壁 (目地の窪み + 石ごとの明度ムラ + 凹凸)
function ashlar(R, x0, y0, x1, y1, o = {}) {
  const bw = o.bw || 9, bh = o.bh || 5, sd = o.seed || 3;
  R.rect(x0, y0, x1 - x0, y1 - y0, {
    m: o.m || MAT.stone, z: o.z || 0, id: o.id, bump: [0.35, 0.9, sd],
    tf: (x, y) => {
      const row = Math.floor((y - y0) / bh), off = row & 1 ? bw >> 1 : 0, lx0 = x - x0 + off;
      const col = Math.floor(lx0 / bw), lx = lx0 - col * bw, ly = y - y0 - row * bh;
      if (ly === bh - 1 || lx === bw - 1) return -0.09;
      return (hash(col, row, sd) - 0.5) * 0.06 + (ly === 0 ? 0.025 : 0);
    },
  });
}

// 蝋燭 (蝋の柱 + 炎)。f.k で炎の揺らぎ。light で点光源も置く
function candle(R, x, y, hgt, f, o = {}) {
  const k = f.k * (o.k || 1), sw = Math.sin(f.t * 1.7 + x) * 0.5;
  R.tube(x, y - hgt, x, y, o.r || 1.2, (o.r || 1.2) * 1.1, { m: o.wax || MAT.bone, z: (o.z || 0) + 2, flat: 0.2 });
  R.ell(x + sw * 0.4, y - hgt - 2.2 * k, 0.9, 2.2 * k, { m: MAT.flame, em: 0.95, z: (o.z || 0) + 3, emf: (px, py) => 0.55 + 0.45 * (1 - (py - (y - hgt - 4.4 * k)) / (4.4 * k)) });
  if (o.light !== false) R.point(x, y - hgt - 2, (o.z || 0) + 8, o.lc || LC.candle, (o.lk || 0.9) * k, o.lr || 14);
  R.glow(x + sw * 0.4, y - hgt - 2, (o.gr || 6) * k, o.gc || "#ff9a3a", 0.35 * k, (o.gr || 6) * 1.2 * k);
}

// 赤い魂の祠: 尖頭アーチの壁龕に脈打つ紅い魂。紅光が石と骨を下から照らす
function paintShrine(R, f) {
  const W = VW, H = VH;
  R.amb(LC.cold, 0.05);
  // 奥の壁
  ashlar(R, 0, 0, W, 58, { seed: 11, bw: 10, bh: 6, z: 0 });
  // 壁龕 (尖頭アーチ): 外枠の迫石 → 内側の深い闇
  const cx = 60, sy = 24, hw = 15, bot = 52;
  R.poly(archPts(cx, sy, hw + 4, bot, 0.7), { m: MAT.stone, z: 4, tex: [0.5, 0.12, 21], bump: [0.5, 0.7, 22],
    tf: (x, y) => (y < sy && ((Math.atan2(y - sy, x - cx) / Math.PI) * 9 + 20) % 1 < 0.12 ? -0.08 : 0) });
  R.poly(archPts(cx, sy, hw, bot, 0.7), { m: MAT.stoneD, z: -6, tex: [0.2, 0.06, 23] });
  // 鎖 (アーチの両肩から垂れる)
  for (const sx of [cx - hw - 7, cx + hw + 7]) {
    const pts = [];
    for (let i = 0; i <= 10; i++) pts.push([sx + Math.sin(i * 0.6 + sx) * 0.6, 4 + i * 3.2]);
    for (let i = 0; i < pts.length - 1; i++) R.ell(pts[i][0], pts[i][1] + 1.2, i & 1 ? 0.8 : 1.3, 1.7, { m: MAT.iron, z: 9, flat: 0.1 });
  }
  // 台座 (段)
  R.poly([[cx - 12, 44], [cx + 12, 44], [cx + 14, 52], [cx - 14, 52]], { m: MAT.stoneD, z: 6, n: [0, -0.7, 0.7], tex: [0.4, 0.16, 31], bump: [0.5, 0.6, 34] });
  R.rect(cx - 9, 37, 18, 7, { m: MAT.stoneD, z: 7, tex: [0.5, 0.16, 32], bump: [0.45, 0.9, 33],
    tf: (x, y) => (y === 40 && (x & 1) ? -0.12 : y === 39 || y === 41 ? -0.05 : 0) });
  R.rect(cx - 10, 36, 20, 2, { m: MAT.stone, z: 8, n: [0, -1, 0.5], tex: [0.6, 0.1, 35] });
  // 紅い魂 (心臓のように脈打つ) と、それを吊る鉄の環
  const pulse = 0.8 + 0.2 * Math.pow(Math.max(0, Math.sin(f.t * 2.4)), 3);
  const oy = 26, orr = 7.4 * (0.97 + 0.05 * pulse);
  R.path([[cx, 0], [cx, 6], [cx, 13], [cx, oy - orr - 1]], 0.7, 0.7, { m: MAT.iron, z: 10 });
  for (let i = 0; i < 6; i++) R.ell(cx + (i & 1 ? 0.2 : -0.2), 2 + i * 3, i & 1 ? 0.6 : 1.1, 1.6, { m: MAT.iron, z: 12, flat: 0.1 });
  R.ell(cx, oy, orr, orr * 1.04, {
    m: MAT.soulRed, z: 14,
    emf: (x, y) => {
      const dx = x + 0.5 - cx + 1.5, dy = y + 0.5 - oy + 2, d = Math.hypot(dx, dy) / orr;
      const sw = 0.1 * Math.sin(Math.atan2(dy, dx) * 3 + f.t * 2.5 + d * 7);
      return clamp01((1.12 - d * 0.95) * pulse + sw + 0.05);
    },
  });
  // 魂を抱く鉄の帯 (三本の弧)
  for (const ax of [-0.62, 0, 0.62]) {
    const pts = [];
    for (let i = 0; i <= 10; i++) { const a = -Math.PI / 2 + (Math.PI * i) / 10; pts.push([cx + Math.cos(a) * orr * ax * 1.05 + (ax ? 0 : 0), oy + Math.sin(a) * (orr + 0.8)]); }
    if (ax) R.path(pts.map(([x, y]) => [x, y]), 0.5, 0.5, { m: MAT.iron, z: 16 });
  }
  R.tube(cx - orr - 0.5, oy, cx + orr + 0.5, oy, 0.6, 0.6, { m: MAT.iron, z: 16 });
  R.ell(cx, oy - orr - 0.6, 2.2, 1.1, { m: MAT.iron, z: 16, flat: 0.3 });
  R.point(cx - 1, oy, 13, LC.red, 2.4 * pulse, 14);
  R.point(cx, oy + 4, 10, LC.red, 0.8 * pulse, 24, { wrap: 0.35 });
  R.glow(cx, oy, 30, "#a01024", 0.3 * pulse, 26, 6);
  R.glow(cx - 1, oy - 1, 13, "#ff6a4a", 0.45 * pulse, 13, 4);
  R.glow(cx - 2, oy - 2, 4, "#fff0e0", 0.5 * pulse, 4, 2);
  // 床 (石畳)
  R.poly([[0, 58], [W, 58], [W, H], [0, H]], { m: MAT.stoneD, z: 10, n: [0, -0.85, 0.55], tex: [0.25, 0.14, 41, 0.6], bump: [0.4, 0.6, 42, 0.9] });
  // 供物: 積まれた頭蓋骨と骨
  const skull = (x, y, s, z, turn = 0) => {
    R.ell(x, y, 3.5 * s, 3.1 * s, { m: MAT.bone, z, bump: [0.8, 0.35, 51 + x] });
    R.ell(x + turn * s, y + 2.5 * s, 2.4 * s, 1.6 * s, { m: MAT.bone, z: z + 1, flat: 0.25 });
    R.bump(x, y - 1.2 * s, 2.4 * s, 1.4 * s, 0.6);
    R.bump(x - 1.35 * s + turn * s, y + 0.5 * s, 1.2 * s, 1.1 * s, -1.4, { ao: 0.5 });
    R.bump(x + 1.35 * s + turn * s, y + 0.5 * s, 1.2 * s, 1.1 * s, -1.4, { ao: 0.5 });
    R.ell(x - 1.3 * s + turn * s, y + 0.8 * s, 0.85 * s, 0.95 * s, { m: MAT.dark, z: z + 2 });
    R.ell(x + 1.3 * s + turn * s, y + 0.8 * s, 0.85 * s, 0.95 * s, { m: MAT.dark, z: z + 2 });
    R.ell(x + turn * s, y + 2.2 * s, 0.45 * s, 0.6 * s, { m: MAT.dark, z: z + 2 });
    for (let k = -1; k <= 1; k++) R.rect(Math.round(x + turn * s + k * 0.9 * s - 0.3), Math.round(y + 3.4 * s), 1, 1, { m: MAT.dark, z: z + 2 });
  };
  skull(cx - 23, 54, 1.3, 14, -0.3); skull(cx - 17, 59, 1.15, 18, 0.2); skull(cx - 28, 60, 1, 17, -0.4);
  skull(cx + 23, 55, 1.25, 14, 0.3); skull(cx + 18, 60, 1.1, 18, -0.2);
  skull(cx + 3, 64, 1.4, 22, 0.1);
  R.tube(cx - 34, 66, cx - 20, 64, 1, 0.8, { m: MAT.bone, z: 20, cap: true });
  R.tube(cx + 10, 69, cx + 26, 66, 1.1, 0.8, { m: MAT.bone, z: 22, cap: true });
  R.point(cx, 50, 30, LC.red, 0.7 * pulse, 30, { wrap: 0.4 });
  // 床を這う紅い靄
  R.glow(cx, 60, 52, "#5a0a14", 0.35 * pulse, 9, 4);
  // 紅い蝋燭
  const cw = { wax: MAT.crimson, lc: LC.red, gc: "#ff4a2a", lk: 0.6, lr: 10 };
  candle(R, cx - 13, 44, 5, f, { ...cw, z: 8 });
  candle(R, cx + 12, 44, 7, { k: f.k * 0.95, t: f.t + 2 }, { ...cw, z: 8 });
  candle(R, cx - 26, 60, 4, { k: f.k * 1.05, t: f.t + 4 }, { ...cw, z: 16 });
  candle(R, cx + 30, 61, 6, { k: f.k, t: f.t + 1 }, { ...cw, z: 16 });
  R.ell(cx - 26, 60.5, 2.4, 0.9, { m: MAT.crimson, z: 15, flat: 0.5 });
  R.ell(cx + 30, 61.5, 2.6, 1, { m: MAT.crimson, z: 15, flat: 0.5 });
}

// ---- 情景の部品 ----
// 遠近の床板 (消失点 vx,vy へ集まる板目 + 手前ほど広がる継ぎ目)。奥 = y0、手前 = 下端
function floorPlanks(R, y0, vx, vy, o = {}) {
  const k = o.k || 5, H = VH;
  R.rect(0, y0, VW, H - y0, { m: o.m || MAT.wood, z: o.z || 0, n: [0, -0.88, 0.48], tex: [0.07, 0.14, o.seed || 5, 0.5],
    dz: (x, y) => (y - y0) * 1.6,
    tf: (x, y) => {
      const u = ((x + 0.5 - vx) / Math.max(1, y + 0.5 - vy)) * k, f = u - Math.floor(u);
      let t = f < 0.1 ? -0.13 : 0;
      t += (hash(Math.floor(u), 3, o.seed || 5) - 0.5) * 0.09;
      const seam = Math.floor(Math.log(y - vy + 1) * 4.2 + hash(Math.floor(u), 9, 2) * 1.5);
      if (Math.floor(Math.log(y - vy + 2) * 4.2 + hash(Math.floor(u), 9, 2) * 1.5) !== seam) t -= 0.08;
      return t;
    } });
}
// 板張りの壁 (縦板)
function wallBoards(R, x0, y0, x1, y1, o = {}) {
  const bw = o.bw || 6;
  R.rect(x0, y0, x1 - x0, y1 - y0, { m: o.m || MAT.woodD, z: o.z || 0, bump: [0.5, 0.4, o.seed || 9, 0.08], tex: [0.12, 0.12, o.seed || 9, 0.03],
    tf: (x) => { const c = Math.floor((x - x0) / bw), lx = (x - x0) - c * bw; return (lx === 0 ? -0.1 : 0) + (hash(c, 1, o.seed || 9) - 0.5) * 0.08; } });
}
// 太い梁
function beamH(R, x0, x1, y, h, o = {}) {
  R.rect(x0, y, x1 - x0, h, { m: o.m || MAT.woodD, z: o.z || 30, nf: (x, yy) => [0, (yy - y) / h * 1.6 - 0.8, 0.7], tex: [0.15, 0.18, o.seed || 11, 0.6] });
}
// 鎖 (二点を結ぶ輪の列)
function chain(R, x0, y0, x1, y1, z, o = {}) {
  const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / 1.8));
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * (o.sag || 0);
    R.ell(x, y, i & 1 ? 0.55 : 0.95, 1.1, { m: o.m || MAT.iron, z, flat: 0.1, rot: Math.atan2(y1 - y0, x1 - x0) - Math.PI / 2 });
  }
}
// 人の頭身の「器」(人業の素体)。cx = 胸の中心、top = 頭頂、s = 頭の高さ (全身 ≒ 7.5 頭身)。
// pose: hang (吊られて手足が垂れる) / stand (直立)。陶器の肌に球体関節、顔は無い
function vessel(R, cx, top, s, o = {}) {
  const z = o.z || 20, m = o.m || MAT.bone, id = R.newId(), P = { m, z, id }, J = { m: o.joint || MAT.grey, z: z + 1, id };
  const hang = o.pose !== "stand", tilt = o.tilt || 0;
  const hy = top + s * 0.5, hx = cx + tilt * s * 0.5;
  // 脚 (吊られていれば爪先が下を向いて垂れる)
  const hipY = top + s * 4, kneeY = top + s * 5.75, ftY = top + s * 7.4, sp = hang ? 0.35 : 0.55;
  for (const sd of [-1, 1]) {
    const hx2 = cx + sd * s * 0.42, kx = cx + sd * s * (sp + 0.05), fx = cx + sd * s * (sp - 0.05) + (hang ? sd * 0.2 * s : 0);
    R.tube(hx2, hipY, kx, kneeY, s * 0.36, s * 0.27, { ...P, z: z - 1 });
    R.tube(kx, kneeY, fx, ftY - s * 0.2, s * 0.25, s * 0.17, { ...P, z: z - 1 });
    R.ell(kx, kneeY, s * 0.24, s * 0.22, { ...J, z: z });
    if (hang) R.ell(fx, ftY, s * 0.14, s * 0.32, { ...P, z: z - 1 });
    else R.ell(fx + sd * s * 0.08, ftY - s * 0.05, s * 0.32, s * 0.14, { ...P, z: z - 1 });
  }
  // 骨盤と胴 (肩幅 ≒ 2 頭、腰で絞る)
  R.ell(cx, hipY - s * 0.15, s * 0.78, s * 0.55, P);
  R.poly([[cx - s * 0.62, hipY - s * 0.3], [cx - s * 1.0, top + s * 1.55], [cx - s * 0.8, top + s * 1.25], [cx + s * 0.8, top + s * 1.25], [cx + s * 1.0, top + s * 1.55], [cx + s * 0.62, hipY - s * 0.3]],
    { ...P, nf: (x, y) => { const u = (x + 0.5 - cx) / (s * 0.95); return [u * 0.9, (y - (top + s * 2.4)) / (s * 3) * 0.6, Math.sqrt(Math.max(0, 1 - u * u)) * 0.8 + 0.2]; } });
  R.bump(cx, top + s * 2.0, s * 0.45, s * 0.35, 0.6, { id }); // 胸
  R.bump(cx, top + s * 3.1, s * 0.12, s * 0.7, -0.5, { id }); // 正中の溝
  R.ell(cx, top + s * 3.55, s * 0.62, s * 0.18, { ...J }); // 腰の球体関節
  // 首と頭 (うなだれる)
  R.tube(cx, top + s * 1.3, hx, hy + s * 0.3, s * 0.17, s * 0.19, P);
  R.ell(hx, hy, s * 0.38, s * 0.5, { ...P, z: z + 2, rot: tilt });
  R.bump(hx + tilt * s * 0.1, hy + s * 0.05, s * 0.25, s * 0.12, -0.6, { id, ao: 0.25 }); // 目の穴の窪み (顔は無い)
  // 腕 (肩・肘の球体関節)
  for (const sd of [-1, 1]) {
    const shx = cx + sd * s * 0.95, shy = top + s * 1.5;
    const ex = shx + sd * s * (hang ? 0.15 : 0.12) + (o.armOut || 0) * sd * s, ey = shy + s * 1.45;
    const wx = ex + sd * s * (hang ? 0.05 : 0.02) + (o.armOut || 0) * sd * s * 0.6, wy = ey + s * 1.35;
    R.tube(shx, shy, ex, ey, s * 0.22, s * 0.18, { ...P, z: z + 2 });
    R.tube(ex, ey, wx, wy, s * 0.18, s * 0.13, { ...P, z: z + 2 });
    R.ell(shx, shy, s * 0.28, s * 0.26, { ...J, z: z + 3 });
    R.ell(ex, ey, s * 0.17, s * 0.17, { ...J, z: z + 3 });
    R.ell(wx, wy + s * 0.3, s * 0.15, s * 0.32, { ...P, z: z + 2 });
    if (o.wrists) o.wrists.push([wx, wy]);
  }
  return id;
}
// 頭巾の人影 (客・番人の遠景)。dir = 顔の向き
function hooded(R, cx, base, h, o = {}) {
  const z = o.z || 20, m = o.m || MAT.cloth, id = R.newId();
  R.poly([[cx - h * 0.28, base], [cx - h * 0.22, base - h * 0.55], [cx - h * 0.16, base - h * 0.78], [cx + h * 0.16, base - h * 0.78], [cx + h * 0.22, base - h * 0.55], [cx + h * 0.28, base]],
    { m, z, id, bump: [0.5, 0.9, cx, 0.12], nf: (x) => { const u = (x + 0.5 - cx) / (h * 0.26); return [u * 0.8, -0.1, Math.sqrt(Math.max(0, 1 - u * u)) * 0.8 + 0.2]; } });
  R.ell(cx + (o.dir || 0) * h * 0.03, base - h * 0.84, h * 0.13, h * 0.15, { m, z: z + 1, id });
  if (o.face !== false) R.ell(cx + (o.dir || 0) * h * 0.05, base - h * 0.82, h * 0.07, h * 0.08, { m: MAT.dark, z: z + 2 });
  return id;
}
// 樽
function barrel(R, cx, base, w, h, z) {
  R.rect(cx - w / 2, base - h, w, h, { m: MAT.wood, z, nf: (x, y) => { const u = (x + 0.5 - cx) / (w / 2); return [u * 0.9, (y - (base - h / 2)) / h * 0.4, Math.sqrt(Math.max(0, 1 - u * u)) + 0.1]; },
    tf: (x, y) => ((y - (base - h)) === Math.round(h * 0.2) || (y - (base - h)) === Math.round(h * 0.78) ? -0.18 : ((x - cx) % 3 === 0 ? -0.05 : 0)) });
  R.ell(cx, base - h, w / 2, 1.2, { m: MAT.woodD, z: z + 1, flat: 0.6 });
}
// 杯 (錫のジョッキ)
function tankard(R, x, base, z) {
  R.rect(x - 1.5, base - 4, 3, 4, { m: MAT.iron, z, nf: (px) => [(px + 0.5 - x) / 1.5 * 0.9, 0, 0.6] });
  R.tube(x + 1.5, base - 3.5, x + 2.6, base - 1.5, 0.45, 0.45, { m: MAT.iron, z, cap: true });
  R.ell(x, base - 4, 1.5, 0.5, { m: MAT.bone, z: z + 1, flat: 0.5, tone: -0.1 });
}
// 瓶
function bottle(R, x, base, h, m, z) {
  R.ell(x, base - h * 0.32, h * 0.2, h * 0.32, { m, z });
  R.rect(x - 0.5, base - h, 1.2, h * 0.5, { m, z, n: [-0.3, 0, 1] });
}

// 人業の館: 人形師の工房。梁から鎖で吊られた人の頭身の器、月光の窓、作業台の蝋燭と瓶詰めの魂
function paintMansion(R, f) {
  const W = VW, H = VH;
  R.amb(LC.cold, 0.05);
  // 奥の壁 (漆喰の剥げた石) と尖頭の高窓
  ashlar(R, 0, 0, W, 58, { seed: 41, bw: 11, bh: 6, m: MAT.stoneD });
  const wx = 30;
  R.poly(archPts(wx, 14, 8, 44, 0.8), { m: MAT.stone, z: 2, tex: [0.4, 0.1, 43] });
  R.poly(archPts(wx, 14, 6, 42, 0.8), { m: MAT.moon, z: -30, emf: (x, y) => clamp01(0.42 - (y - 4) / 120 + (Math.abs(x - wx) < 0.6 || Math.abs(y - 27) < 0.6 ? -0.4 : 0) + vnoise(x * 0.5, y * 0.5, 3) * 0.12) });
  // 窓から差す月光の帯 (床へ斜めに落ちる)
  R.dir(-0.45, -0.55, 0.7, LC.moon, 0.42);
  R.rim(-0.9, -0.2, 0.2, LC.moon, 0.55, 1.5);
  R.glow(wx, 26, 20, "#3a3a6a", 0.3, 24, 4);
  // 床
  floorPlanks(R, 58, 64, 30, { seed: 45, k: 4 });
  R.poly([[wx - 6, 58], [wx + 6, 58], [wx + 30, H], [wx + 6, H]], { m: MAT.wood, z: 1, n: [0, -0.88, 0.48], tone: 0.1, dz: (x, y) => (y - 58) * 1.6, only: undefined, under: false,
    tf: (x, y) => { const u = ((x + 0.5 - 64) / Math.max(1, y + 0.5 - 30)) * 4; return (u - Math.floor(u) < 0.1 ? -0.13 : 0) + 0.02; } });
  // 梁 (天井)
  beamH(R, 0, W, 0, 5, { z: 40, seed: 47 });
  // 吊られた器: 奥 → 手前
  const sw = Math.sin(f.t * 0.6) * 0.6;
  const dolls = [
    { cx: 56, top: 13, s: 5.2, z: 12, tilt: 0.25 },
    { cx: 92, top: 9, s: 5.6, z: 16, tilt: -0.3 },
    { cx: 74, top: 18, s: 6.4, z: 26, tilt: 0.12 },
  ];
  for (const d of dolls) {
    const cx = d.cx + sw * (d.z / 26);
    chain(R, d.cx, 4, cx, d.top + d.s * 1.2, d.z - 1);
    const wr = [];
    vessel(R, cx, d.top, d.s, { z: d.z, tilt: d.tilt, wrists: wr, m: d.z > 20 ? MAT.bone : MAT.skinPale });
    // 手首に結ばれた糸 (梁へ)
    for (const [x, y] of wr) R.tube(x, y, x + (x < cx ? -3 : 3), 4, 0.3, 0.3, { m: MAT.grey, z: d.z + 3, tone: -0.1 });
  }
  // 作業台 (右手前) と蝋燭・瓶詰めの魂・器の頭
  R.rect(84, 52, 36, 4, { m: MAT.wood, z: 34, n: [0, -0.9, 0.45], tex: [0.2, 0.15, 51, 0.8] });
  R.rect(84, 56, 36, 3, { m: MAT.woodD, z: 36, n: [0, 0.2, 1] });
  R.rect(86, 59, 3, 16, { m: MAT.woodD, z: 34 }); R.rect(115, 59, 3, 16, { m: MAT.woodD, z: 34 });
  candle(R, 90, 52, 6, f, { z: 36, lk: 1.4, lr: 26 });
  candle(R, 95, 52, 4, { k: f.k * 0.92, t: f.t + 2 }, { z: 36, lk: 0.7, lr: 16 });
  // 瓶詰めの魂 (青白く脈打つ)
  const pu = 0.75 + 0.25 * Math.sin(f.t * 1.8);
  R.ell(106, 46, 4, 5.4, { m: MAT.glass, z: 37 });
  R.ell(106, 47, 2.4, 2.6, { m: MAT.soul, z: 38, emf: (x, y) => clamp01(0.85 * pu - Math.hypot(x + 0.5 - 106, y + 0.5 - 47) / 4) });
  R.rect(103.5, 40, 5, 1.6, { m: MAT.woodD, z: 38 });
  R.point(106, 47, 44, LC.soul, 0.8 * pu, 9);
  R.glow(106, 47, 10, "#6a5ad8", 0.28 * pu, 10, 4);
  // 器の頭 (台の上に転がる)
  R.ell(115, 49.5, 2.6, 3, { m: MAT.bone, z: 37, rot: 0.7 });
  R.bump(114.6, 49.8, 1.6, 0.8, -0.8, { ao: 0.3 });
  // 床の工具と、外れた腕
  R.tube(60, 69, 72, 66, 1.1, 0.9, { m: MAT.bone, z: 44, cap: true });
  R.ell(72.5, 66, 1.2, 1.2, { m: MAT.grey, z: 45 });
}

// 酒場「沈まぬ灯」: 天井から吊るされた消えない灯、長卓の客、奥の棚と炉の火
function paintTavern(R, f) {
  const W = VW, H = VH;
  R.amb(LC.cold, 0.04);
  wallBoards(R, 0, 0, W, 50, { seed: 61, bw: 7 });
  // 奥の棚と酒瓶
  for (const sy of [16, 28]) {
    R.rect(4, sy, 46, 2, { m: MAT.wood, z: 6, n: [0, -0.8, 0.6] });
    for (let i = 0; i < 9; i++) {
      const bx = 7 + i * 5 + (hash(i, sy, 1) - 0.5) * 2, h = 6 + hash(i, sy, 2) * 4;
      bottle(R, bx, sy, h, i % 3 === 0 ? MAT.glass : i % 3 === 1 ? MAT.woodD : MAT.crimson, 7);
    }
  }
  // 炉 (右奥): 石の炉口と燃え盛る火
  ashlar(R, 82, 8, 120, 50, { seed: 63, bw: 6, bh: 4, z: 4 });
  R.poly(archPts(101, 30, 10, 50, 0.2), { m: MAT.dark, z: 2 });
  const fk = f.k;
  R.poly([[93, 50], [96, 40 - 3 * fk], [99, 44], [101, 34 - 4 * fk], [104, 43], [107, 38 - 3 * fk], [110, 50]], { m: MAT.flame, z: 6, emf: (x, y) => clamp01(0.35 + (y - 34) / 22 + vnoise(x * 0.6, y * 0.4 + f.t * 2, 5) * 0.3) });
  R.rect(92, 49, 19, 2, { m: MAT.ember, z: 7, em: 0.7 });
  R.point(101, 42, 16, LC.fire, 1.6 * fk, 24, { wrap: 0.3 });
  R.glow(101, 43, 22, "#d2501a", 0.3 * fk, 18, 5);
  // 床
  floorPlanks(R, 50, 60, 22, { seed: 65, k: 5 });
  // 長卓と客 (卓の奥に座る頭巾の二人)
  hooded(R, 42, 54, 26, { z: 18, dir: 1 });
  hooded(R, 70, 55, 24, { z: 18, dir: -1, m: MAT.leather });
  R.rect(22, 52, 66, 3, { m: MAT.wood, z: 26, n: [0, -0.9, 0.45], tex: [0.15, 0.15, 67, 0.8] });
  R.rect(22, 55, 66, 3, { m: MAT.woodD, z: 28 });
  R.rect(26, 58, 3, 14, { m: MAT.woodD, z: 26 }); R.rect(81, 58, 3, 14, { m: MAT.woodD, z: 26 });
  tankard(R, 36, 52, 28); tankard(R, 63, 52, 28); tankard(R, 76, 52, 28);
  candle(R, 52, 52, 4, f, { z: 28, lk: 0.9, lr: 18 });
  // 手前の背を向けた客 (肩越しの人影)
  hooded(R, 14, H + 6, 36, { z: 46, face: false, m: MAT.cloth });
  barrel(R, 108, H, 12, 16, 44);
  // 沈まぬ灯 (鎖で吊るされた鉄の灯籠)
  const lx = 60, ly = 20;
  chain(R, lx, 0, lx, ly - 6, 30);
  R.poly([[lx - 4, ly - 5], [lx + 4, ly - 5], [lx + 3, ly + 5], [lx - 3, ly + 5]], { m: MAT.flame, z: 32, emf: (x, y) => clamp01(0.9 * fk - Math.hypot(x + 0.5 - lx, y + 0.5 - ly) / 9) });
  for (const bx of [-4, -1.3, 1.3, 4]) R.tube(lx + bx * 0.9, ly - 5, lx + bx * 0.75, ly + 5, 0.45, 0.45, { m: MAT.iron, z: 33 });
  R.poly([[lx - 5, ly - 5], [lx, ly - 9], [lx + 5, ly - 5]], { m: MAT.iron, z: 33, n: [0, -0.7, 0.7] });
  R.rect(lx - 3.5, ly + 5, 7, 1.4, { m: MAT.iron, z: 33 });
  R.point(lx, ly, 34, LC.candle, 1.5 * fk, 26, { wrap: 0.25 });
  R.glow(lx, ly, 34, "#a0501a", 0.22 * fk, 28, 6);
  R.glow(lx, ly, 10, "#ffcf7a", 0.35 * fk, 10, 4);
}

// 商店「黒鉄商会」: 鉄の帯で締めた勘定台、天秤と金貨、壁一面の武器と枷
function paintShop(R, f) {
  const W = VW, H = VH;
  R.amb(LC.cold, 0.07);
  wallBoards(R, 0, 0, W, 54, { seed: 81, bw: 8, m: MAT.woodD });
  // 壁の武器掛け: 剣・斧・槍・盾
  const sword = (x, y, len, z) => {
    R.rect(x - 0.8, y, 1.8, len, { m: MAT.iron, z, nf: (px) => [px < x ? -0.7 : 0.6, 0, 0.7] });
    R.poly([[x - 0.8, y + len], [x + 1, y + len], [x + 0.1, y + len + 2.5]], { m: MAT.iron, z });
    R.rect(x - 3, y - 1.5, 6.2, 1.4, { m: MAT.gold, z: z + 1 });
    R.rect(x - 0.5, y - 6, 1.2, 4.6, { m: MAT.leather, z: z + 1 });
    R.ell(x + 0.1, y - 6.6, 1, 1, { m: MAT.gold, z: z + 2 });
  };
  sword(10, 12, 22, 10); sword(18, 10, 26, 10); sword(94, 12, 20, 10);
  // 斧
  R.rect(31.5, 6, 1.6, 34, { m: MAT.wood, z: 10 });
  R.poly([[33, 8], [40, 5], [42, 12], [40, 19], [33, 16]], { m: MAT.iron, z: 11, nf: (x) => [x > 39 ? 0.6 : -0.2, -0.2, 0.8], tf: (x) => (x > 40 ? 0.12 : 0) });
  // 槍
  R.rect(107, 4, 1.4, 44, { m: MAT.wood, z: 10 });
  R.poly([[106.2, 4], [108.9, 4], [107.6, -4]], { m: MAT.iron, z: 11 });
  // 紋章の盾 (黒鉄に紅の獣)
  R.poly([[52, 8], [68, 8], [68, 18], [60, 27], [52, 18]], { m: MAT.iron, z: 12, nf: (x, y) => [(x - 60) / 9 * 0.6, (y - 16) / 12 * 0.4, 0.8], bump: [0.6, 0.3, 83] });
  R.poly([[54, 10], [66, 10], [66, 17.5], [60, 24.5], [54, 17.5]], { m: MAT.crimson, z: 13, nf: (x, y) => [(x - 60) / 9 * 0.5, (y - 16) / 12 * 0.3, 0.85] });
  R.rect(59.3, 10, 1.6, 14, { m: MAT.gold, z: 14 }); R.rect(54, 14, 12, 1.4, { m: MAT.gold, z: 14 });
  // 吊るした枷と鎖
  chain(R, 78, 2, 74, 20, 12, { sag: 2 }); chain(R, 78, 2, 84, 22, 12, { sag: 2 });
  R.ell(74, 22, 2.2, 1.8, { m: MAT.iron, z: 13, flat: 0.4 }); R.ell(84, 24, 2.2, 1.8, { m: MAT.iron, z: 13, flat: 0.4 });
  R.ell(74, 22, 1.1, 0.9, { m: MAT.dark, z: 14 }); R.ell(84, 24, 1.1, 0.9, { m: MAT.dark, z: 14 });
  // 勘定台 (鉄帯と鋲)
  const cy = 46;
  R.rect(0, cy, W, 3, { m: MAT.wood, z: 30, n: [0, -0.9, 0.45], tex: [0.15, 0.15, 85, 0.8] });
  R.rect(0, cy + 3, W, H - cy - 3, { m: MAT.woodD, z: 32, tex: [0.1, 0.12, 86, 0.4],
    tf: (x, y) => ((y - cy - 3) % 9 === 3 || (y - cy - 3) % 9 === 4 ? 0 : 0) + (x % 14 === 0 ? -0.08 : 0) });
  for (const by of [cy + 7, cy + 18]) {
    R.rect(0, by, W, 2.4, { m: MAT.iron, z: 34, nf: (x, y) => [0, y - by < 1 ? -0.7 : 0.3, 0.7] });
    for (let x = 4; x < W; x += 11) R.ell(x, by + 1.2, 0.9, 0.9, { m: MAT.iron, z: 35 });
  }
  // 天秤 (真鍮) と金貨
  const sx = 34, sy = 26;
  R.rect(sx - 0.6, sy, 1.4, cy - sy, { m: MAT.gold, z: 31 });
  R.ell(sx, cy - 0.5, 4, 1.2, { m: MAT.gold, z: 31, flat: 0.4 });
  const tiltB = Math.sin(f.t * 0.7) * 0.6;
  R.tube(sx - 11, sy + 1 + tiltB, sx + 11, sy + 1 - tiltB, 0.6, 0.6, { m: MAT.gold, z: 32 });
  for (const [px, dd] of [[sx - 11, tiltB], [sx + 11, -tiltB]]) {
    R.tube(px, sy + 1 + dd, px - 3, sy + 9 + dd, 0.25, 0.25, { m: MAT.gold, z: 32 });
    R.tube(px, sy + 1 + dd, px + 3, sy + 9 + dd, 0.25, 0.25, { m: MAT.gold, z: 32 });
    R.ell(px, sy + 9.5 + dd, 4, 1.2, { m: MAT.gold, z: 33, flat: 0.3 });
  }
  for (let i = 0; i < 5; i++) R.ell(sx - 11 + (i - 2) * 1.2, sy + 8.5 + tiltB - (i % 2), 1.1, 0.6, { m: MAT.gold, z: 34, flat: 0.4 });
  // 金貨の山と帳簿
  for (let i = 0; i < 14; i++) R.ell(58 + (hash(i, 1, 3) - 0.5) * 10, cy - 1 - hash(i, 2, 3) * 3, 1.3, 0.6, { m: MAT.gold, z: 33 + i * 0.1, flat: 0.4 });
  R.poly([[72, cy], [90, cy], [92, cy - 2.5], [74, cy - 2.5]], { m: MAT.parch, z: 33, n: [0, -0.9, 0.45], tf: (x) => (x === 82 ? -0.15 : (x % 2 ? -0.03 : 0)) });
  // 灯 (台の上、天秤と金貨を照らす)
  const lx = 50, ly = 37;
  R.rect(lx - 3, ly - 6, 6, 9, { m: MAT.flame, z: 34, emf: (x, y) => clamp01(0.95 * f.k - Math.hypot(x + 0.5 - lx, y + 0.5 - ly + 1) / 7) });
  for (const bx of [-3, 3]) R.rect(lx + bx - 0.5, ly - 6, 1, 9, { m: MAT.iron, z: 35 });
  R.poly([[lx - 4, ly - 6], [lx, ly - 10], [lx + 4, ly - 6]], { m: MAT.iron, z: 35, n: [0, -0.7, 0.7] });
  R.rect(lx - 3.5, ly + 3, 7, 1.5, { m: MAT.iron, z: 35 });
  R.point(lx, ly - 1, 42, LC.candle, 1.9 * f.k, 34, { wrap: 0.25 });
  R.glow(lx, ly - 1, 30, "#b0601a", 0.22 * f.k, 26, 5);
  R.glow(lx, ly - 1, 8, "#ffcf7a", 0.35 * f.k, 9, 3);
  // 壁の松明 (右): 武器の刃を照らす
  const tx = 114, ty = 18;
  R.rect(tx - 1, ty, 2, 9, { m: MAT.woodD, z: 14 });
  R.poly([[tx - 2, ty + 1], [tx - 1, ty - 4 - 2 * f.k], [tx, ty - 1], [tx + 1, ty - 5 - 2 * f.k], [tx + 2, ty + 1]], { m: MAT.flame, z: 16, emf: (x, y) => clamp01(0.45 + (y - (ty - 6)) / 8) });
  R.point(tx, ty - 3, 22, LC.fire, 1.1 * f.k, 26, { wrap: 0.2 });
  R.glow(tx, ty - 3, 16, "#c0501a", 0.25 * f.k, 16, 5);
}

// 宿屋「白狼」: 白狼の毛皮を掛けた寝台。足もとで牙を剥く狼の頭、枕元の蝋燭、月明かりの小窓、扉の爪痕
function paintInn(R, f) {
  const W = VW, H = VH;
  R.amb(LC.cold, 0.06);
  wallBoards(R, 0, 0, W, 44, { seed: 101, bw: 6, m: MAT.woodD });
  // 小窓 (月光) と格子
  R.rect(12, 6, 16, 18, { m: MAT.stoneD, z: 2 });
  R.rect(14, 8, 12, 14, { m: MAT.moon, z: -20, emf: (x, y) => clamp01(0.4 + vnoise(x * 0.4, y * 0.4, 7) * 0.12 - (y - 8) * 0.012) });
  R.rect(19.6, 8, 0.8, 14, { m: MAT.iron, z: 3 }); R.rect(14, 14.6, 12, 0.8, { m: MAT.iron, z: 3 });
  R.dir(-0.55, -0.45, 0.7, LC.moon, 0.3);
  R.glow(20, 15, 16, "#34345e", 0.22, 14, 4);
  // 扉 (右端) と三本の爪痕
  R.rect(100, 2, 22, 42, { m: MAT.wood, z: 4, tex: [0.12, 0.15, 103, 0.04], tf: (x) => ((x - 100) % 5 === 0 ? -0.1 : 0) });
  for (const by of [8, 34]) R.rect(100, by, 22, 2, { m: MAT.iron, z: 5 });
  for (let k = 0; k < 3; k++) R.poly([[104 + k * 3, 12], [105.2 + k * 3, 12], [110 + k * 3, 30], [108.8 + k * 3, 30]], { m: MAT.dark, z: 6 });
  // 床
  floorPlanks(R, 44, 60, 14, { seed: 105, k: 5 });
  // 寝台: 頭板 (左) から右手前へ。寝具の上を白狼の毛皮が覆う
  R.rect(4, 22, 5, 34, { m: MAT.woodD, z: 18, nf: (x) => [x < 6 ? -0.6 : 0.6, 0, 0.8] });
  R.ell(6.5, 22, 3.2, 2.2, { m: MAT.woodD, z: 19 });
  R.poly([[8, 36], [86, 36], [98, 58], [8, 58]], { m: MAT.cloth, z: 22, n: [0, -0.75, 0.65], bump: [0.4, 0.8, 106, 0.6], dz: (x, y) => (y - 36) * 0.8 });
  R.rect(8, 58, 92, 7, { m: MAT.woodD, z: 30, nf: (x, y) => [0, y < 60 ? -0.6 : 0.3, 0.8] });
  R.ell(20, 37, 10, 4, { m: MAT.parch, z: 24, bump: [0.6, 0.6, 107] }); // 枕
  R.poly([[28, 35], [84, 35], [96, 56], [92, 64], [74, 66], [52, 63], [34, 65], [26, 52]],
    { m: MAT.grey, z: 26, n: [0, -0.6, 0.8], bump: [0.9, 1.5, 108, 0.32], tex: [0.45, 0.22, 109, 0.18], dz: (x, y) => (y - 35) * 0.8, tone: -0.1 });
  // 狼の頭 (横顔。長い鼻面を蝋燭へ向け、唇をめくって牙を剥く)
  const hx = 70, hy = 40;
  R.point(hx + 26, hy - 4, 58, LC.candle, 1.1 * f.k, 20); // 蝋燭が狼の顔を照らす
  R.shade(hx + 4, hy + 9, 16, 6, 0.75); // 頭が毛皮に落とす影
  R.shade(hx + 4, hy + 9, 16, 6, 0.5, { ao: true });
  R.poly([[hx - 7, hy - 2], [hx - 5, hy - 16], [hx + 1, hy - 4]], { m: MAT.fur, z: 37, n: [-0.3, -0.4, 0.85], tone: -0.1 }); // 奥の耳
  R.ell(hx - 8, hy + 3, 8, 7.5, { m: MAT.fur, z: 38, bump: [0.9, 1.4, 115, 0.4], tone: -0.06 }); // 首の毛
  R.ell(hx, hy, 8, 6.4, { m: MAT.fur, z: 40, bump: [0.9, 1.2, 110, 0.45], rot: -0.15 });
  R.poly([[hx - 2, hy - 4], [hx + 1.5, hy - 17], [hx + 5, hy - 5]], { m: MAT.fur, z: 42, n: [0.25, -0.5, 0.8] }); // 手前の耳
  R.poly([[hx - 0.2, hy - 6], [hx + 1.5, hy - 13.5], [hx + 3.2, hy - 6]], { m: MAT.dark, z: 43 });
  R.tube(hx + 4, hy + 0.5, hx + 19, hy + 4, 4.3, 2.3, { m: MAT.fur, z: 42, bump: [0.9, 0.7, 111, 0.5] }); // 鼻面
  R.bump(hx + 4.5, hy - 3, 3, 2.2, 0.9); // 額の段
  R.ell(hx + 19.8, hy + 3.4, 1.7, 1.5, { m: MAT.dark, z: 46 }); // 鼻
  R.poly([[hx + 6, hy + 5], [hx + 19, hy + 5.4], [hx + 17.5, hy + 8.6], [hx + 7, hy + 7.4]], { m: MAT.dark, z: 45 }); // 口
  R.tube(hx + 6, hy + 8, hx + 16.5, hy + 9.6, 1.7, 1.2, { m: MAT.fur, z: 44 }); // 下顎
  for (const [tx, ty, dn] of [[hx + 16.4, hy + 5.2, 1], [hx + 11, hy + 5.3, 1], [hx + 15, hy + 8.4, -1], [hx + 8.5, hy + 5.4, 1]]) {
    R.poly([[tx - 0.75, ty], [tx + 0.75, ty], [tx, ty + dn * 2.6]], { m: MAT.bone, z: 47, tone: 0.15 }); // 牙
  }
  // 硝子の眼 (蝋燭を映して鈍く光る)
  R.ell(hx + 4, hy - 1.4, 2, 1.1, { m: MAT.dark, z: 45, rot: -0.3 });
  R.rect(Math.round(hx + 4.6), Math.round(hy - 2.2), 1, 1, { m: MAT.window, z: 46, em: 0.95 });
  // 枕元の小卓と蝋燭 (狼の頭を下から照らす)
  R.rect(96, 50, 12, 2, { m: MAT.wood, z: 46, n: [0, -0.9, 0.45] });
  R.rect(100.5, 52, 2.5, 23, { m: MAT.woodD, z: 46 });
  candle(R, 102, 50, 7, f, { z: 48, lk: 1.7, lr: 22 });
  R.ell(102, 50.5, 3.4, 1, { m: MAT.bone, z: 47, flat: 0.5 });
}

// 王宮: 玉座の間。列柱の奥、篝火に挟まれた玉座に、うなだれた老王の影
function vigPalace(R, f) {
  const W = VW, H = VH, vx = 60, vy = 30;
  R.amb(LC.cold, 0.04);
  // 奥の壁と尖頭の高窓 (月光)
  ashlar(R, 0, 0, W, 50, { seed: 121, bw: 8, bh: 5, m: MAT.stoneD });
  for (const wx of [40, 80]) {
    R.poly(archPts(wx, 10, 4, 30, 0.8), { m: MAT.moon, z: -30, emf: (x, y) => clamp01(0.3 - (y - 4) / 90 + (Math.abs(x - wx) < 0.6 ? -0.3 : 0)) });
  }
  R.dir(0.1, -0.6, 0.6, LC.moon, 0.18);
  // 床 (石畳) と玉座へ続く紅い絨毯
  R.rect(0, 50, W, H - 50, { m: MAT.stoneD, z: 0, n: [0, -0.9, 0.45], tex: [0.1, 0.12, 123, 0.4], dz: (x, y) => (y - 50) * 1.6,
    tf: (x, y) => { const u = ((x + 0.5 - vx) / Math.max(1, y + 0.5 - vy)) * 3; return (u - Math.floor(u) < 0.06 ? -0.1 : 0) + (Math.floor(Math.log(y - vy + 1) * 5) % 2 ? 0 : -0.03); } });
  R.poly([[56, 50], [64, 50], [86, H], [34, H]], { m: MAT.crimson, z: 1, n: [0, -0.9, 0.45], dz: (x, y) => (y - 50) * 1.6 + 0.5, tex: [0.2, 0.12, 124, 0.6],
    tf: (x, y) => { const e = Math.abs(x + 0.5 - 60) / (4 + (y - 50) * 0.96); return e > 0.86 ? 0.12 : 0; } });
  // 壇と玉座
  R.rect(44, 44, 32, 3, { m: MAT.stone, z: 4, n: [0, -0.9, 0.45] }); R.rect(44, 47, 32, 3, { m: MAT.stone, z: 5 });
  R.rect(40, 50, 40, 2, { m: MAT.stone, z: 6, n: [0, -0.9, 0.45] });
  R.poly([[52, 44], [52, 20], [55, 14], [60, 10], [65, 14], [68, 20], [68, 44]], { m: MAT.gold, z: 6, nf: (x) => [(x - 60) / 9 * 0.6, -0.1, 0.8], tex: [0.5, 0.2, 125] });
  R.poly([[54.5, 42], [54.5, 21], [60, 15], [65.5, 21], [65.5, 42]], { m: MAT.crimson, z: 7, tex: [0.4, 0.15, 126] });
  // うなだれた王 (毛皮のマントと王冠の鈍い光)
  R.poly([[53, 44], [53.5, 32], [56, 27], [64, 27], [66.5, 32], [67, 44]], { m: MAT.grey, z: 10, bump: [0.7, 1, 127, 0.4], nf: (x) => [(x - 60) / 7 * 0.7, -0.2, 0.7] });
  R.poly([[56, 44], [57, 33], [63, 33], [64, 44]], { m: MAT.cloth, z: 11 });
  R.ell(60.5, 26, 2.8, 3.2, { m: MAT.skinPale, z: 12, tone: -0.12 });
  R.rect(58.6, 25.4, 1.3, 1.2, { m: MAT.dark, z: 13 }); R.rect(61.3, 25.4, 1.3, 1.2, { m: MAT.dark, z: 13 });
  R.poly([[57.5, 23.5], [58, 20.5], [59.2, 22.5], [60.5, 20], [61.8, 22.5], [63, 20.5], [63.5, 23.5]], { m: MAT.gold, z: 13 });
  R.poly([[58, 28], [63, 28], [62, 33], [60.5, 34], [59, 33]], { m: MAT.fur, z: 12, tone: 0.1 }); // 白い髭
  // 列柱 (手前ほど大きく、太く)
  const cols = [[30, 6, 48, 6], [90, 6, 48, 6], [14, 0, 56, 9], [106, 0, 56, 9], [-4, 0, 70, 13], [124 - 13 + 4, 0, 70, 13]];
  for (const [x, top, bot, w] of cols) {
    R.rect(x - w / 2, top, w, bot - top, { m: MAT.stone, z: 10 + w * 2, nf: (px) => { const u = clamp01((px + 0.5 - (x - w / 2)) / w) * 2 - 1; return [u, 0, Math.sqrt(1 - u * u) + 0.05]; },
      tf: (px) => ((px - Math.round(x - w / 2)) % 3 === 2 ? -0.06 : 0), bump: [0.4, 0.4, x + 130] });
    R.rect(x - w / 2 - 1.5, bot - 3, w + 3, 3, { m: MAT.stone, z: 11 + w * 2, n: [0, -0.5, 0.85] });
  }
  // 紅い垂れ幕 (柱の間、金の縁)
  for (const [x, top, len, w] of [[22, 8, 30, 6], [98, 8, 30, 6]]) {
    R.rect(x - w / 2, top, w, len, { m: MAT.crimson, z: 22, tex: [0.5, 0.15, x], tf: (px, py) => ((px - (x - w / 2)) % 3 === 0 ? -0.08 : 0) + (py > top + len - 4 && (px + py) % 3 === 0 ? -0.3 : 0) });
    R.rect(x - w / 2, top, w, 1.2, { m: MAT.gold, z: 23 });
    R.ell(x, top + 9, 1.6, 2, { m: MAT.gold, z: 23 });
  }
  // 篝火 (玉座の左右の火皿)
  for (const bx of [44, 76]) {
    R.rect(bx - 0.6, 36, 1.4, 14, { m: MAT.iron, z: 14 });
    R.ell(bx, 35.5, 3.4, 1.4, { m: MAT.iron, z: 15, flat: 0.3 });
    R.poly([[bx - 3, 35], [bx - 1.5, 30 - 2 * f.k], [bx, 32], [bx + 1, 28 - 3 * f.k], [bx + 3, 35]], { m: MAT.flame, z: 16, emf: (x, y) => clamp01(0.4 + (y - 28) / 9) });
    R.point(bx, 31, 24, LC.fire, 1.2 * f.k, 20, { wrap: 0.25 });
    R.glow(bx, 31, 14, "#c0501a", 0.28 * f.k, 14, 5);
  }
}

// 魂の祭壇: 石の祭壇の上に浮かぶ青白い魂火。床に刻まれた環が仄かに光る
function paintAltar(R, f) {
  const W = VW, H = VH, cx = 60;
  R.amb(LC.cold, 0.04);
  ashlar(R, 0, 0, W, 50, { seed: 141, bw: 9, bh: 6, m: MAT.stoneD });
  R.poly(archPts(cx, 18, 20, 50, 0.6), { m: MAT.stoneD, z: -8, tone: -0.06 });
  chain(R, 18, 0, 26, 30, 6, { sag: 3 }); chain(R, 102, 0, 94, 30, 6, { sag: 3 });
  // 床と、刻まれた環
  R.rect(0, 50, W, H - 50, { m: MAT.stoneD, z: 0, n: [0, -0.9, 0.45], tex: [0.12, 0.15, 143, 0.5], dz: (x, y) => (y - 50) * 1.6 });
  const pu = 0.75 + 0.25 * Math.sin(f.t * 1.6);
  R.ell(cx, 62, 40, 9, { m: MAT.soul, z: 2, em: 0.42 * pu, clip: (x, y) => { const d = Math.hypot((x + 0.5 - cx) / 40, (y + 0.5 - 62) / 9); return Math.abs(d - 0.92) < 0.05 || Math.abs(d - 0.72) < 0.035; } });
  for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU + 0.2; R.rect(Math.round(cx + Math.cos(a) * 33), Math.round(62 + Math.sin(a) * 7.4), 2, 1, { m: MAT.soul, z: 3, em: 0.5 * pu }); }
  // 祭壇 (台座 + 鉢)
  R.rect(cx - 14, 46, 28, 12, { m: MAT.stone, z: 20, tex: [0.4, 0.15, 145], bump: [0.5, 0.7, 146], nf: (x) => [x < cx - 11 ? -0.6 : x > cx + 11 ? 0.6 : 0, 0, 0.85] });
  R.rect(cx - 16, 44, 32, 3, { m: MAT.stone, z: 22, n: [0, -0.8, 0.6] });
  R.ell(cx, 42, 8, 3, { m: MAT.iron, z: 24, flat: 0.2 });
  R.ell(cx, 41, 6.5, 1.6, { m: MAT.dark, z: 25 });
  // 浮かぶ魂火
  const fy = 28 + Math.sin(f.t * 1.3) * 1.2;
  R.poly([[cx - 6, fy + 6], [cx - 4, fy - 3], [cx - 1.5, fy - 1], [cx, fy - 12 - 2 * f.k], [cx + 1.5, fy - 2], [cx + 4, fy - 5], [cx + 6, fy + 6], [cx, fy + 9]],
    { m: MAT.soul, z: 30, emf: (x, y) => clamp01(1 - Math.hypot((x + 0.5 - cx) / 6, (y + 0.5 - fy - 2) / 9) * 0.75 + vnoise(x * 0.6, y * 0.5 + f.t, 9) * 0.15) });
  R.point(cx, fy, 34, LC.soul, 2.2 * pu, 26, { wrap: 0.3 });
  R.glow(cx, fy, 34, "#3a2a8a", 0.3 * pu, 30, 6);
  R.glow(cx, fy + 1, 10, "#c8d8ff", 0.35 * pu, 12, 4);
  // 鉄の燭台 (左右)
  for (const sx of [24, 96]) {
    R.rect(sx - 0.7, 34, 1.6, 24, { m: MAT.iron, z: 18 });
    R.ell(sx, 58, 3.5, 1.2, { m: MAT.iron, z: 18, flat: 0.4 });
    R.ell(sx, 34, 3, 1, { m: MAT.iron, z: 19, flat: 0.4 });
    candle(R, sx, 34, 5, { k: f.k * (sx > 60 ? 0.95 : 1.05), t: f.t + sx }, { z: 20, lk: 0.6, lr: 12 });
  }
}

// パーティ編成: 隊列を組んで立つ器たち。松明に照らされ、背後に軍旗
function paintParty(R, f) {
  const W = VW, H = VH;
  R.amb(LC.cold, 0.05);
  ashlar(R, 0, 0, W, 54, { seed: 161, bw: 10, bh: 6, m: MAT.stoneD });
  for (const bx of [30, 90]) {
    R.rect(bx - 6, 0, 12, 34, { m: MAT.crimson, z: 3, tex: [0.5, 0.15, bx], tf: (x, y) => ((x - bx) % 4 === 0 ? -0.08 : 0) + (y > 28 && (x + y) % 3 === 0 ? -0.3 : 0) });
    R.rect(bx - 6, 0, 12, 1.5, { m: MAT.gold, z: 4 });
    R.poly([[bx - 3, 10], [bx + 3, 10], [bx + 3, 17], [bx, 21], [bx - 3, 17]], { m: MAT.gold, z: 4 });
  }
  R.rect(0, 54, W, H - 54, { m: MAT.stoneD, z: 0, n: [0, -0.9, 0.45], tex: [0.12, 0.15, 163, 0.5], dz: (x, y) => (y - 54) * 1.6 });
  // 器 (鎧を着せた三体と後衛の二体)
  const armor = (cx, top, s, z, o = {}) => {
    vessel(R, cx, top, s, { z, pose: "stand", m: MAT.bone, armOut: 0.15 });
    R.ell(cx, top + s * 0.45, s * 0.46, s * 0.55, { m: MAT.iron, z: z + 4 }); // 兜
    R.rect(cx - s * 0.32, top + s * 0.45, s * 0.64, s * 0.12, { m: MAT.dark, z: z + 5 }); // 覗き穴
    R.poly([[cx - s * 0.95, top + s * 1.35], [cx + s * 0.95, top + s * 1.35], [cx + s * 0.7, top + s * 3.4], [cx - s * 0.7, top + s * 3.4]], { m: MAT.iron, z: z + 3, nf: (x) => [(x - cx) / s * 0.7, -0.1, 0.75] });
    if (o.spear) R.rect(cx + s * 1.25, top - s * 1.2, 1.1, s * 9, { m: MAT.wood, z: z + 6 });
    if (o.spear) R.poly([[cx + s * 1.25 - 0.8, top - s * 1.2], [cx + s * 1.25 + 1.9, top - s * 1.2], [cx + s * 1.25 + 0.55, top - s * 1.2 - 4]], { m: MAT.iron, z: z + 6 });
    if (o.shield) R.poly([[cx - s * 1.9, top + s * 2], [cx - s * 0.5, top + s * 2], [cx - s * 0.5, top + s * 4.2], [cx - s * 1.2, top + s * 5.2], [cx - s * 1.9, top + s * 4.2]], { m: MAT.iron, z: z + 7, nf: (x) => [(x - (cx - s * 1.2)) / s * 0.6, 0, 0.8], tf: (x, y) => (Math.abs(x - (cx - s * 1.2)) < 0.6 ? 0.15 : 0) });
  };
  armor(38, 22, 4.6, 12, { spear: true }); armor(82, 22, 4.6, 12, { spear: true });
  armor(24, 26, 5.6, 22, { shield: true }); armor(60, 24, 6, 26, { shield: true, spear: true }); armor(96, 26, 5.6, 22, {});
  // 松明 (左右の壁)
  for (const tx of [6, 114]) {
    R.rect(tx - 1, 28, 2, 9, { m: MAT.woodD, z: 30 });
    R.poly([[tx - 2.2, 29], [tx - 1, 23 - 2 * f.k], [tx, 26], [tx + 1, 22 - 2 * f.k], [tx + 2.2, 29]], { m: MAT.flame, z: 32, emf: (x, y) => clamp01(0.45 + (y - 22) / 8) });
    R.point(tx, 25, 36, LC.fire, 1.6 * f.k, 34, { wrap: 0.25 });
    R.glow(tx, 25, 18, "#c0501a", 0.28 * f.k, 18, 5);
  }
}

// 人業保管庫: 棺のような縦長の箱が奥まで並ぶ。手前のひとつが開き、器が立っている
function paintManage(R, f) {
  const W = VW, H = VH, vx = 60, vy = 26;
  R.amb(LC.cold, 0.08);
  ashlar(R, 0, 0, W, 40, { seed: 181, bw: 9, bh: 5, m: MAT.stoneD, z: -40 });
  R.rect(0, 40, W, H - 40, { m: MAT.stoneD, z: -40, n: [0, -0.9, 0.45], tex: [0.12, 0.15, 183, 0.5], dz: (x, y) => (y - 40) * 2.4 });
  // 両側の棺の列 (奥から手前へ)
  const caseAt = (x, base, w, h, z, open = false) => {
    const id = R.newId();
    R.poly([[x, base], [x - w * 0.12, base - h * 0.62], [x + w * 0.1, base - h], [x + w * 0.9, base - h], [x + w * 1.12, base - h * 0.62], [x + w, base]],
      { m: MAT.woodD, z, id, tex: [0.25, 0.15, x * 3, 0.1], nf: (px) => [(px - (x + w / 2)) / w * 0.6, 0, 0.85], tf: (px) => (Math.abs(px - (x + w / 2)) < 0.6 ? -0.06 : 0) });
    if (open) {
      R.poly([[x + w * 0.12, base - 1], [x + 0.02 * w, base - h * 0.6], [x + w * 0.18, base - h * 0.92], [x + w * 0.82, base - h * 0.92], [x + w * 0.98, base - h * 0.6], [x + w * 0.88, base - 1]], { m: MAT.dark, z: z + 1 });
      return id;
    }
    R.rect(x + w * 0.35, base - h * 0.62, w * 0.3, h * 0.08, { m: MAT.gold, z: z + 1 });
    for (const by of [0.2, 0.85]) R.rect(x - w * 0.02, base - h * by, w * 1.04, 1, { m: MAT.iron, z: z + 1 });
    return id;
  };
  for (let k = 4; k >= 0; k--) {
    const t = k / 4, s = 1 - t * 0.68, base = 40 + (H - 40) * (1 - t) * 0.92 + 2;
    const w = 15 * s, h = 34 * s, z = -30 + (1 - t) * 50;
    caseAt(vx - 10 - (1 - t) * 44 - w, base, w, h, z, k === 0);
    caseAt(vx + 10 + (1 - t) * 44, base, w, h, z, false);
  }
  // 開いた棺に立つ器 (左手前)
  vessel(R, 13, 34, 4.8, { z: 26, pose: "stand", m: MAT.bone, tilt: 0.1 });
  // 床の燭台と蝋燭
  candle(R, 60, 64, 5, f, { z: 30, lk: 2, lr: 40 });
  candle(R, 56, 64, 3, { k: f.k * 0.9, t: f.t + 1 }, { z: 30, lk: 0.6, lr: 18 });
  R.ell(58, 64.5, 5, 1.2, { m: MAT.bone, z: 29, flat: 0.5 });
  candle(R, 26, 66, 4, { k: f.k * 1.05, t: f.t + 3 }, { z: 34, lk: 1.2, lr: 22 });
  R.point(60, 34, -20, LC.soul, 1.6, 40); // 通路の奥の青い仄明かり
  R.glow(60, 34, 14, "#26305a", 0.25, 10, 4);
}

// モンスター図鑑: 書見台に開いた古書と、角の生えた獣の頭蓋
function paintCodexMon(R, f) {
  const W = VW, H = VH;
  R.amb(LC.cold, 0.05);
  wallBoards(R, 0, 0, W, 48, { seed: 201, bw: 7 });
  // 背後の書架
  for (const sy of [12, 26, 40]) {
    R.rect(0, sy, W, 2, { m: MAT.wood, z: 3, n: [0, -0.8, 0.6] });
    for (let x = 2; x < W - 2;) { const bw = 2 + Math.floor(hash(x, sy, 5) * 3), bh = 8 + hash(x, sy, 6) * 4; R.rect(x, sy - bh, bw, bh, { m: [MAT.crimson, MAT.leather, MAT.woodD, MAT.cloth][Math.floor(hash(x, sy, 7) * 4)], z: 2, nf: (px) => [(px - x - bw / 2) / bw, 0, 0.8] }); x += bw + (hash(x, sy, 8) > 0.85 ? 2 : 0); }
  }
  R.rect(0, 48, W, H - 48, { m: MAT.woodD, z: 0, n: [0, -0.9, 0.45], dz: (x, y) => (y - 48) * 1.6, tex: [0.1, 0.12, 203, 0.5] });
  // 書見台と開いた古書 (獣の素描)
  R.poly([[40, 50], [80, 50], [76, 75], [44, 75]], { m: MAT.woodD, z: 28 });
  R.poly([[34, 50], [86, 50], [80, 36], [40, 36]], { m: MAT.wood, z: 30, n: [0, -0.6, 0.8] });
  R.poly([[38, 49], [60, 48], [60, 37], [42, 38]], { m: MAT.parch, z: 32, n: [-0.15, -0.55, 0.8], tex: [0.6, 0.12, 204] });
  R.poly([[60, 48], [82, 49], [78, 38], [60, 37]], { m: MAT.parch, z: 32, n: [0.15, -0.55, 0.8], tex: [0.6, 0.12, 205] });
  for (let i = 0; i < 4; i++) R.rect(63, 40 + i * 2, 12 - i, 0.7, { m: MAT.leather, z: 33, tone: -0.1 });
  R.poly([[44, 46], [47, 40], [50, 42], [53, 39], [56, 44], [52, 46]], { m: MAT.leather, z: 33, tone: -0.15 }); // 素描
  // 角の頭蓋 (台座の上)
  const kx = 98, ky = 30;
  R.rect(90, 40, 16, 35, { m: MAT.stone, z: 20, nf: (x) => [x < 93 ? -0.6 : x > 103 ? 0.6 : 0, 0, 0.8], tex: [0.4, 0.15, 206] });
  R.rect(88, 38, 20, 3, { m: MAT.stone, z: 21, n: [0, -0.8, 0.6] });
  R.path([[kx - 4, ky - 3], [kx - 9, ky - 9], [kx - 10, ky - 16], [kx - 7, ky - 20]], 1.8, 0.6, { m: MAT.bone, z: 24 });
  R.path([[kx + 4, ky - 3], [kx + 9, ky - 9], [kx + 10, ky - 16], [kx + 7, ky - 20]], 1.8, 0.6, { m: MAT.bone, z: 24 });
  R.ell(kx, ky, 6, 5.5, { m: MAT.bone, z: 26, bump: [0.8, 0.3, 207] });
  R.poly([[kx - 3.5, ky + 2], [kx + 3.5, ky + 2], [kx + 2.5, ky + 9], [kx - 2.5, ky + 9]], { m: MAT.bone, z: 26 });
  R.ell(kx - 2.4, ky + 0.5, 1.6, 1.8, { m: MAT.dark, z: 27 }); R.ell(kx + 2.4, ky + 0.5, 1.6, 1.8, { m: MAT.dark, z: 27 });
  R.ell(kx, ky + 4, 0.7, 1.1, { m: MAT.dark, z: 27 });
  for (let k = -2; k <= 2; k++) R.poly([[kx + k * 1.1 - 0.4, ky + 8.8], [kx + k * 1.1 + 0.4, ky + 8.8], [kx + k * 1.1, ky + 10.6]], { m: MAT.bone, z: 27 });
  candle(R, 26, 50, 7, f, { z: 34, lk: 1.4, lr: 30 });
  candle(R, 86, 38, 4, { k: f.k * 0.92, t: f.t + 2 }, { z: 30, lk: 1.3, lr: 22 });
}

// アイテム図鑑: 天鵞絨の上の古剣、背後の紋章盾と兜
function paintCodexItem(R, f) {
  const W = VW, H = VH;
  R.amb(LC.cold, 0.05);
  ashlar(R, 0, 0, W, 46, { seed: 221, bw: 10, bh: 6, m: MAT.stoneD });
  R.poly([[26, 4], [58, 4], [58, 24], [42, 40], [26, 24]], { m: MAT.iron, z: 8, nf: (x, y) => [(x - 42) / 16 * 0.6, (y - 20) / 20 * 0.4, 0.8], bump: [0.5, 0.4, 223] });
  R.poly([[29, 7], [55, 7], [55, 23], [42, 36], [29, 23]], { m: MAT.violet, z: 9, nf: (x, y) => [(x - 42) / 16 * 0.5, (y - 20) / 20 * 0.3, 0.85] });
  R.path([[34, 12], [42, 20], [50, 12]], 1, 1, { m: MAT.gold, z: 10 }); R.rect(41.3, 10, 1.5, 22, { m: MAT.gold, z: 10 });
  // 兜 (右)
  R.ell(86, 24, 9, 10, { m: MAT.iron, z: 10, bump: [0.6, 0.3, 224] });
  R.rect(79, 23, 14, 2, { m: MAT.dark, z: 11 }); R.rect(85.4, 25, 1.4, 8, { m: MAT.dark, z: 11 });
  R.poly([[86, 13], [88, 2], [90, 13]], { m: MAT.crimson, z: 9 });
  // 台と天鵞絨
  R.rect(0, 46, W, H - 46, { m: MAT.woodD, z: 10, n: [0, -0.9, 0.45], dz: (x, y) => (y - 46) * 1.6 });
  R.poly([[8, 50], [112, 48], [116, 70], [4, 72]], { m: MAT.crimson, z: 14, n: [0, -0.8, 0.6], bump: [0.3, 0.9, 225, 0.5], dz: (x, y) => (y - 48) * 1.4 });
  // 古剣 (斜めに置かれた長剣)
  R.poly([[20, 63], [92, 53], [97, 55.5], [24, 67.5]], { m: MAT.iron, z: 60, nf: (x, y) => [0, y < 65.2 - (x - 20) * 0.15 ? -0.8 : 0.35, 0.6] });
  R.poly([[92, 53], [103, 53.4], [97, 55.5]], { m: MAT.iron, z: 60, n: [0.2, -0.5, 0.8] });
  R.tube(18, 57, 22, 73, 1.3, 1.3, { m: MAT.gold, z: 62, cap: true }); // 鍔
  R.tube(7, 67, 18, 65.5, 1.4, 1.2, { m: MAT.leather, z: 61 }); // 握り
  R.ell(5.5, 67.4, 2.2, 2.2, { m: MAT.gold, z: 62 });
  R.point(64, 40, 90, LC.candle, 1.6 * f.k, 50);
  candle(R, 66, 46, 8, f, { z: 22, lk: 1.4, lr: 30 });
  candle(R, 71, 46, 5, { k: f.k * 0.9, t: f.t + 1 }, { z: 22, lk: 0.6, lr: 18 });
}

// 職業図鑑: 棚に並ぶ色とりどりの魂の瓶と巻物
function paintCodexJob(R, f) {
  const W = VW, H = VH;
  R.amb(LC.cold, 0.04);
  wallBoards(R, 0, 0, W, H, { seed: 241, bw: 8 });
  const cols = [MAT.soulRed, MAT.soul, MAT.ember, MAT.soul, MAT.soulRed, MAT.soul];
  const lc = [LC.red, LC.soul, LC.fire, LC.cold, LC.red, LC.soul];
  let n = 0;
  for (const sy of [24, 46, 68]) {
    R.rect(0, sy, W, 3, { m: MAT.wood, z: 10, n: [0, -0.8, 0.6] });
    for (let i = 0; i < 6; i++) {
      const x = 10 + i * 19 + (sy % 3) * 2, k = (i + sy) % cols.length, pu = 0.7 + 0.3 * Math.sin(f.t * (1.2 + i * 0.2) + sy);
      if ((i + sy) % 5 === 2) { // 巻物
        R.tube(x - 6, sy - 2.5, x + 6, sy - 2.5, 2.3, 2.3, { m: MAT.parch, z: 12 });
        R.rect(x - 1, sy - 5, 2, 5, { m: MAT.crimson, z: 13 });
        continue;
      }
      R.ell(x, sy - 6, 4.3, 5.8, { m: MAT.glass, z: 12 });
      R.ell(x, sy - 5.5, 2.6, 3.2, { m: cols[k], z: 13, emf: (px, py) => clamp01(0.85 * pu - Math.hypot(px + 0.5 - x, py + 0.5 - sy + 5.5) / 5) });
      R.rect(x - 2, sy - 13, 4, 2, { m: MAT.woodD, z: 13 });
      R.point(x, sy - 6, 20, lc[k], 0.7 * pu, 10);
      R.glow(x, sy - 6, 8, "#5a3aa0", 0.12 * pu, 8, 3);
      n++;
    }
  }
}

// 勲章の間: 黒い天鵞絨に並ぶ勲章と綬
function paintCodexAch(R, f) {
  const W = VW, H = VH;
  R.amb(LC.cold, 0.06);
  R.rect(0, 0, W, H, { m: MAT.crimson, z: 0, bump: [0.25, 0.8, 261, 0.12], tone: -0.08 });
  R.rect(6, 6, W - 12, H - 12, { m: MAT.cloth, z: 2, bump: [0.3, 0.5, 262], tex: [0.2, 0.08, 263] });
  for (const [x0, y0, w, h] of [[6, 6, W - 12, 2], [6, H - 8, W - 12, 2], [6, 6, 2, H - 12], [W - 8, 6, 2, H - 12]]) R.rect(x0, y0, w, h, { m: MAT.gold, z: 4 });
  const medal = (x, y, r, rib, z) => {
    R.poly([[x - 3, y - 18], [x + 3, y - 18], [x + 2.4, y - r], [x - 2.4, y - r]], { m: rib, z, tf: (px) => (Math.abs(px - x) < 0.8 ? 0.12 : 0) });
    R.ell(x, y, r, r, { m: MAT.gold, z: z + 1, bump: [0.9, 0.4, x] });
    R.ell(x, y, r * 0.62, r * 0.62, { m: MAT.gold, z: z + 2, tone: -0.06 });
    for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; R.rect(Math.round(x + Math.cos(a) * r * 0.82), Math.round(y + Math.sin(a) * r * 0.82), 1, 1, { m: MAT.gold, z: z + 3, tone: 0.1 }); }
  };
  medal(24, 34, 5.5, MAT.crimson, 10); medal(46, 30, 6.5, MAT.violet, 10); medal(72, 30, 6.5, MAT.crimson, 10); medal(96, 34, 5.5, MAT.violet, 10);
  medal(60, 56, 7.5, MAT.crimson, 12);
  candle(R, 110, 70, 9, f, { z: 30, lk: 1.6, lr: 50 });
  R.dir(0.4, -0.5, 0.7, LC.candle, 0.2);
}

// 宝物庫: 円天井の下、金貨の溢れる箱と王冠、杯
function paintTreasury(R, f) {
  const W = VW, H = VH;
  R.amb(LC.cold, 0.05);
  ashlar(R, 0, 0, W, 50, { seed: 281, bw: 8, bh: 5, m: MAT.stoneD });
  R.poly(archPts(60, 20, 34, 50, 0.1), { m: MAT.stoneD, z: -10, tone: -0.08 });
  R.rect(0, 50, W, H - 50, { m: MAT.stoneD, z: 0, n: [0, -0.9, 0.45], dz: (x, y) => (y - 50) * 1.6 });
  // 金貨の山 (手前に広がる)
  const coins = (cx, cy, rx, ry, n, z, seed) => {
    R.ell(cx, cy, rx, ry, { m: MAT.gold, z, bump: [1.2, 0.9, seed], tex: [0.8, 0.25, seed + 1], flat: 0.2 });
    for (let i = 0; i < n; i++) { const a = hash(i, seed, 1) * TAU, d = Math.sqrt(hash(i, seed, 2)); R.ell(cx + Math.cos(a) * rx * d, cy + Math.sin(a) * ry * d * 0.8, 1.2, 0.7, { m: MAT.gold, z: z + 2, flat: 0.5 }); }
  };
  // 宝箱 (左右) — 蓋が開き金が溢れる
  for (const [bx, by, z] of [[14, 60, 20], [84, 58, 18]]) {
    R.rect(bx, by - 10, 24, 12, { m: MAT.wood, z, tex: [0.3, 0.15, bx], tf: (x) => ((x - bx) % 6 === 0 ? -0.08 : 0) });
    for (const ox of [3, 20]) R.rect(bx + ox, by - 10, 2, 12, { m: MAT.iron, z: z + 1 });
    R.poly([[bx, by - 10], [bx + 24, by - 10], [bx + 22, by - 22], [bx + 2, by - 22]], { m: MAT.woodD, z: z - 4, n: [0, -0.3, 0.9] });
    coins(bx + 12, by - 11, 11, 3.5, 10, z + 2, bx);
  }
  coins(60, 66, 30, 6, 26, 26, 291);
  // 王冠 (中央の台座の上) と杯
  R.rect(52, 40, 16, 14, { m: MAT.stone, z: 20, nf: (x) => [x < 55 ? -0.6 : x > 65 ? 0.6 : 0, 0, 0.8] });
  R.rect(50, 38, 20, 3, { m: MAT.stone, z: 21, n: [0, -0.8, 0.6] });
  R.ell(60, 36, 8, 2.5, { m: MAT.crimson, z: 22, flat: 0.3 });
  R.poly([[53, 35], [53, 28], [55.5, 31], [57.5, 26], [60, 30.5], [62.5, 26], [64.5, 31], [67, 28], [67, 35]], { m: MAT.gold, z: 25, nf: (x) => [(x - 60) / 8 * 0.6, -0.1, 0.8] });
  for (const [gx, col] of [[57.5, MAT.soulRed], [62.5, MAT.soul]]) R.ell(gx, 32.5, 1, 1, { m: col, z: 26, em: 0.8 });
  R.poly([[96, 50], [102, 50], [100.5, 44], [101, 40], [97, 40], [97.5, 44]], { m: MAT.gold, z: 26 }); // 杯
  R.ell(99, 40, 3, 1, { m: MAT.gold, z: 27, flat: 0.4 });
  // 松明 (左右の壁)
  for (const tx of [6, 114]) {
    R.rect(tx - 1, 22, 2, 9, { m: MAT.woodD, z: 30 });
    R.poly([[tx - 2.2, 23], [tx - 1, 17 - 2 * f.k], [tx, 20], [tx + 1, 16 - 2 * f.k], [tx + 2.2, 23]], { m: MAT.flame, z: 32, emf: (x, y) => clamp01(0.45 + (y - 16) / 8) });
    R.point(tx, 19, 36, LC.fire, 1.5 * f.k, 40, { wrap: 0.25 });
    R.glow(tx, 19, 16, "#c0501a", 0.26 * f.k, 16, 5);
  }
}

// 無限迷宮「奈落」: 縁から覗き込む底なしの縦穴。壁に沿って螺旋の階段が闇へ下る
function paintAbyss(R, f) {
  const W = VW, H = VH, cx = 60, cy = 40;
  R.amb(LC.cold, 0.09);
  R.dir(0, -0.7, 0.7, LC.moon, 0.3);
  R.rect(0, 0, W, H, { m: MAT.stoneD, z: 0, bump: [0.2, 1.4, 301, 0.3], tex: [0.15, 0.2, 302] });
  // 穴 (同心の楕円が奥へ縮み、闇に沈む)
  for (let k = 0; k < 9; k++) {
    const t = k / 8, rx = 56 * (1 - t * 0.82), ry = 30 * (1 - t * 0.82), yy = cy + t * 10;
    R.ell(cx, yy, rx, ry, { m: k === 8 ? MAT.soul : MAT.stone, z: -10 - k * 12, emf: k === 8 ? (x, y) => clamp01(0.55 - Math.hypot(x + 0.5 - cx, (y + 0.5 - yy) * 1.6) / 14) : undefined,
      tone: -t * 0.12, bump: [0.4, 1.1, 303 + k, 0.6], nf: (x, y) => [-(x + 0.5 - cx) / rx * 0.8, -(y + 0.5 - yy) / ry * 0.6, 0.5] });
  }
  // 螺旋の階段 (内壁に張り付いて下る段)
  for (let i = 0; i < 46; i++) {
    const t = i / 46, a = t * TAU * 2.3 + 0.6, rr = 1 - t * 0.78;
    const x = cx + Math.cos(a) * 50 * rr, y = cy + t * 9 + Math.sin(a) * 26 * rr;
    if (Math.sin(a) < -0.2 && t > 0.15) continue; // 向こう側の段は闇に隠れる
    R.rect(x - 2.5 * rr, y, 5 * rr + 0.5, 1.6 * rr + 0.6, { m: MAT.stone, z: -8 - t * 90, n: [0, -0.9, 0.45], tone: 0.06 - t * 0.2 });
  }
  R.point(cx, cy + 12, -70, LC.soul, 6, 90, { wrap: 0.35 });
  R.glow(cx, cy + 10, 44, "#3a1a7a", 0.4, 24, 6);
  R.glow(cx, cy + 10, 12, "#b8a8ff", 0.3, 6, 3);
  // 縁の崩れた石と、手前の鎖の柵
  R.rect(0, 64, W, 11, { m: MAT.stone, z: 30, n: [0, -0.7, 0.7], bump: [0.4, 1, 305], tex: [0.2, 0.2, 306] });
  for (let x = 8; x < W; x += 26) { R.rect(x - 1, 54, 3, 14, { m: MAT.iron, z: 34 }); if (x + 26 < W) chain(R, x + 1, 56, x + 25, 56, 33, { sag: 4 }); }
}

const VIGNETTES = {
  shrine: paintShrine, mansion: paintMansion, tavern: paintTavern, shop: paintShop, inn: paintInn, palace: vigPalace,
  altar: paintAltar, party: paintParty, manage: paintManage, codexMon: paintCodexMon, codexItem: paintCodexItem,
  codexJob: paintCodexJob, codexAch: paintCodexAch, treasury: paintTreasury, abyss: paintAbyss,
};
const _vigCache = new Map();
const VIG_FRAMES = 6;
// 施設の情景のコマ列 (キャッシュ)。各コマは canvas
const VIG_K = [1, 0.9, 1.08, 0.94, 1.12, 0.86];
function vignetteFrames(key) {
  const paint = VIGNETTES[key];
  if (!paint || !hasDOM()) return null;
  return lazyFrames(_vigCache, key, VIG_FRAMES, (i) => {
    const R = new Relief(VW, VH);
    paint(R, { i, k: VIG_K[i], t: i * 1.05 });
    return pxCanvas(R.render({ bg: () => [4, 3, 7], grade: vignetteGrade(VW, VH, 0.6) }), VW, VH);
  });
}
// 施設の情景 canvas (揺らぐ灯つき)
export function vignetteCanvas(key) {
  // 描き下ろしの原画がある情景 (酒場・宿屋・祠) は townpaint.js が高精細に描き、明かりだけを揺らす
  if (hasPaintedVignette(key) && hasDOM()) return paintedVignette(key, livingCanvas, () => pixelVignette(key));
  return pixelVignette(key);
}
function pixelVignette(key) {
  const frames = vignetteFrames(key);
  const c = makeCanvas(VW, VH);
  if (!c || !frames) return c;
  c.className = "tw-vig";
  const g = c.getContext && c.getContext("2d");
  if (!g) return c;
  const seq = flickerSeq(VIG_FRAMES, 37, key.length * 7 + 3);
  let last = null;
  return livingCanvas(c, (ts) => {
    const fr = frames[seq[Math.floor(ts / 110) % seq.length]] || frames[0];
    if (fr === last || !fr) return;
    last = fr;
    g.clearRect(0, 0, VW, VH);
    g.drawImage(fr, 0, 0);
  }, 10);
}


// ═══════════════════════════════════════════════════════════════════════════
// 番人の胸像 (48x56・実際の頭身の頭と肩)。顔は楕円体の頭に凹凸 (眉弓・目の穴・鼻梁・頬骨・顎) を
// 彫り込み、一灯の主光源 + 逆側の冷たい縁光で陰影を付ける。
// ═══════════════════════════════════════════════════════════════════════════
export const KW = 48, KH = 56;

// 顔: cx,cy = 顔の中心 (眼の高さよりやや下)、rx,ry = 頭の半径。o で骨格と表情を変える
function face(R, cx, cy, rx, ry, o = {}) {
  const skin = o.skin || MAT.skin, z = o.z || 30, id = R.newId(), F = { id };
  const turn = o.turn || 0; // 顔の向き (-1 左 … 1 右): 鼻と口の位置をずらす
  const sx = (v) => cx + v + turn * rx * 0.18;
  // 頭 (やや面長の楕円体) と顎のライン
  R.ell(cx, cy - ry * 0.08, rx, ry, { m: skin, z, id, depth: rx * 1.1, tex: [0.5, 0.06, 401 + (o.seed || 0)] });
  R.ell(cx + turn * 0.5, cy + ry * 0.48, rx * (o.jaw || 0.74), ry * 0.5, { m: skin, z: z + 1, id, depth: rx * 0.8, flat: 0.15 });
  // 耳
  if (o.ears !== false) for (const s of [-1, 1]) R.ell(cx + s * rx * 0.98 - turn * 0.6, cy + ry * 0.02, rx * 0.16, ry * 0.22, { m: skin, z: z - 2, id, tone: -0.05, under: true });
  const ey = cy - ry * 0.12, es = rx * 0.38; // 眼の高さと間隔
  // 眉弓 (張り出し) と額
  R.bump(sx(0), ey - ry * 0.26, rx * 0.62, ry * 0.12, 0.9 * (o.brow || 1), F);
  R.bump(sx(0), cy - ry * 0.62, rx * 0.6, ry * 0.25, 0.5, F);
  // 目の穴 (窪み) — 深いほど影が落ちる
  const deep = o.deep || 1;
  for (const s of [-1, 1]) {
    R.bump(sx(s * es), ey + ry * 0.02, rx * 0.3, ry * 0.14, -2.2 * deep, { ...F, ao: 0.55 * deep, sh: 0.5 * deep });
    R.shade(sx(s * es), ey - ry * 0.04, rx * 0.3, ry * 0.11, 0.55 * deep, F); // 眉弓が落とす影
  }
  // 頬骨と、その下のこけた頬
  for (const s of [-1, 1]) {
    R.bump(sx(s * rx * 0.5), cy + ry * 0.12, rx * 0.22, ry * 0.12, 0.8, F);
    if (o.gaunt) R.bump(sx(s * rx * 0.5), cy + ry * 0.36, rx * 0.2, ry * 0.18, -1.1 * o.gaunt, { ...F, ao: 0.35 * o.gaunt });
  }
  // 鼻 (鼻梁 + 鼻先 + 小鼻) と、その影
  const nl = o.nose || 1;
  R.bump(sx(rx * 0.04), ey + ry * 0.16 * nl, rx * 0.12, ry * 0.28 * nl, 2.0, F);
  R.bump(sx(rx * 0.06), ey + ry * 0.38 * nl, rx * 0.15, ry * 0.09, 1.6, F);
  const ld = o.lightSide || -1; // 主光源の側 (-1 左 / 1 右)。鼻の影は逆側へ落ちる
  R.shade(sx(-ld * rx * 0.2), ey + ry * 0.3 * nl, rx * 0.2, ry * 0.2, 0.85, F);
  R.rect(Math.round(sx(-ld * rx * 0.1)), Math.round(ey + ry * 0.43 * nl), 1, 1, { m: skin, z: z + 3, id, tone: -0.3 });
  // 口 (薄い唇の線と下唇の照り) と顎
  const my = cy + ry * 0.52;
  const mw = Math.max(2, Math.round(rx * (o.mouthW || 0.56)));
  R.rect(Math.round(sx(-mw / 2)), Math.round(my), mw, 1, { m: o.lip || skin, z: z + 3, id, tone: o.lip ? 0 : -0.35 });
  R.bump(sx(0), my + 1.3, rx * 0.2, ry * 0.06, 0.6, F);
  R.bump(sx(0), cy + ry * 0.8, rx * 0.22, ry * 0.1, 0.7, F);
  // 皺 (老い)
  if (o.age) {
    for (const s of [-1, 1]) {
      R.rect(Math.round(sx(s * rx * 0.3)), Math.round(cy + ry * 0.3), 1, Math.round(ry * 0.22), { m: skin, z: z + 3, id, tone: -0.12 * o.age }); // 法令線
      R.rect(Math.round(sx(s * rx * 0.62)), Math.round(ey - 0.5), 1, 1, { m: skin, z: z + 3, id, tone: -0.1 * o.age }); // 目尻
    }
    R.rect(Math.round(cx - rx * 0.3), Math.round(cy - ry * 0.55), Math.round(rx * 0.6), 1, { m: skin, z: z + 3, id, tone: -0.08 * o.age });
  }
  // 眼: hollow (闇だけ) / normal (瞳と照り) / glow (光る瞳) / none
  const eyes = o.eyes || "normal";
  for (const s of [-1, 1]) {
    const ex = sx(s * es), patch = (o.patch === s);
    if (patch) continue;
    if (eyes === "none") continue;
    if (eyes === "normal") {
      // 白目 (光を受けても鈍く) → 瞳 → 上瞼の濃い線。照りは光の側の眼にだけ 1 点
      const ix = Math.round(ex - 0.5 + turn * 0.8), iy = Math.round(ey);
      R.ell(ex, ey + 0.5, rx * 0.2, 0.95, { m: MAT.bone, z: z + 4, tone: -0.22 });
      R.rect(ix, iy, 1, 1, { m: o.iris || MAT.grey, z: z + 5, tone: -0.05 });
      R.rect(Math.round(ex - rx * 0.2), iy - 1, Math.max(2, Math.round(rx * 0.4)), 1, { m: MAT.dark, z: z + 6 });
      if (s === (o.lightSide || -1)) R.rect(ix + (s < 0 ? 1 : -1), iy, 1, 1, { m: MAT.bone, z: z + 6, tone: 0.18 });
    } else R.ell(ex, ey + 0.4, rx * 0.15, ry * 0.05 + 0.4, { m: MAT.dark, z: z + 4 });
    if (eyes === "glow") R.rect(Math.round(ex), Math.round(ey), 1, 1, { m: o.glowM || MAT.soul, z: z + 5, em: 0.8 });
  }
  // 眼帯 (片目) と頭を巡る紐
  if (o.patch) {
    const px = sx(o.patch * es);
    R.ell(px, ey + 0.3, rx * 0.25, ry * 0.15, { m: MAT.leather, z: z + 5, tone: -0.05 });
    R.tube(px - o.patch * rx * 0.2, ey - 1, cx - o.patch * rx * 0.95, ey - ry * 0.45, 0.45, 0.45, { m: MAT.leather, z: z + 5 });
    R.tube(px + o.patch * rx * 0.2, ey, cx + o.patch * rx * 0.98, ey + 0.5, 0.45, 0.45, { m: MAT.leather, z: z + 5 });
  }
  // 傷 (斜めの古傷)
  if (o.scar) R.tube(sx(o.scar[0]), cy + o.scar[1], sx(o.scar[2]), cy + o.scar[3], 0.35, 0.35, { m: skin, z: z + 4, tone: 0.12 });
  return { id, ey, my, es };
}

// 肩と胴 (衣)。m = 衣の材質、w = 肩幅
function shoulders(R, cx, top, w, o = {}) {
  const m = o.m || MAT.cloth, z = o.z || 10;
  R.poly([[cx - w * 0.5, KH], [cx - w * 0.5, top + 9], [cx - w * 0.36, top + 2], [cx - w * 0.14, top], [cx + w * 0.14, top], [cx + w * 0.36, top + 2], [cx + w * 0.5, top + 9], [cx + w * 0.5, KH]],
    { m, z, bump: o.bump || [0.35, 1.1, 431, 0.2], tex: o.tex, tone: o.tone ?? -0.08, nf: (x, y) => { const u = (x + 0.5 - cx) / (w * 0.5); return [u * 0.85, -0.25 + (y - top) / KH * 0.3, Math.sqrt(Math.max(0, 1 - u * u)) * 0.8 + 0.25]; } });
}
// 首
function neck(R, cx, y0, y1, w, skin, z) {
  R.rect(cx - w / 2, y0, w, y1 - y0, { m: skin, z, nf: (x) => { const u = (x + 0.5 - cx) / (w / 2); return [u * 0.9, 0, Math.sqrt(Math.max(0, 1 - u * u)) + 0.1]; } });
  R.shade(cx, y0 + 1, w * 0.7, 3, 0.85); // 顎の落とす影
}
// 背景: 番人の居場所の色をうっすらまとった闇
const keeperBg = (c0, c1) => (x, y) => {
  const d = Math.hypot((x - KW * 0.5) / KW, (y - KH * 0.38) / KH);
  const k = clamp01(1 - d * 1.5);
  return mixc(hex(c0), hex(c1), Math.floor(k * k * 6 + bayer(x, y)) / 6);
};

const KEEPERS = {
  // 人形師 オルドー: 痩せた老人。禿げ上がった頭に長い白髪、片眼に拡大鏡、薄い山羊髭、高い襟の黒衣と革の前掛け
  binder: {
    bg: keeperBg("#050408", "#1c1830"),
    paint(R, f) {
      const cx = 24, cy = 20;
      R.amb(LC.cold, 0.08);
      R.dir(0.78, -0.2, 0.6, LC.candle, 1.05 * f.k, { wrap: 0.45 }); // 作業台の蝋燭 (右から)
      R.rim(-0.9, -0.3, -0.25, LC.moon, 0.9, 1.5); // 窓の月光 (左の縁)
      shoulders(R, cx, 37, 42, { m: MAT.cloth, z: 6 });
      R.poly([[cx - 9, KH], [cx - 6, 41], [cx + 6, 41], [cx + 9, KH]], { m: MAT.leather, z: 8, bump: [0.4, 0.6, 433] }); // 前掛け
      R.tube(cx - 14, 40, cx - 8, KH, 0.8, 0.8, { m: MAT.leather, z: 9 }); // 肩紐
      R.poly([[cx - 9, 33], [cx - 13, 42], [cx - 7, 43], [cx - 3.5, 36]], { m: MAT.cloth, z: 12, n: [-0.5, -0.3, 0.8] }); // 高い襟
      R.poly([[cx + 9, 33], [cx + 13, 42], [cx + 7, 43], [cx + 3.5, 36]], { m: MAT.cloth, z: 12, n: [0.5, -0.3, 0.8] });
      neck(R, cx, 28, 38, 7, MAT.skinPale, 14);
      R.ell(cx, cy + 4, 11.5, 13, { m: MAT.grey, z: 10, bump: [0.9, 1.4, 435, 0.25], tone: 0.02 }); // 長い白髪 (後ろ)
      face(R, cx, cy, 8.2, 10.8, { skin: MAT.skinPale, age: 1.5, gaunt: 1.1, deep: 1.3, nose: 1.15, jaw: 0.66, lightSide: 1, eyes: "normal", iris: MAT.grey, seed: 1 });
      for (const s of [-1, 1]) R.ell(cx + s * 8.2, cy + 1, 2.6, 7, { m: MAT.grey, z: 34, bump: [1, 1.2, 436 + s, 0.3], tone: 0.06 }); // 両脇の白髪
      R.poly([[cx - 2.4, cy + 8], [cx + 2.4, cy + 8], [cx + 1.3, cy + 16], [cx, cy + 18.5], [cx - 1.1, cy + 16]], { m: MAT.grey, z: 36, bump: [1.2, 1, 437, 0.3], tone: 0.1 }); // 山羊髭
      // 片眼の拡大鏡 (真鍮の筒と、蝋燭を映す硝子)
      const lx = cx + 3.4, ly = cy - 1.4;
      R.ell(lx, ly, 2.7, 2.7, { m: MAT.gold, z: 40, flat: 0.2 });
      R.ell(lx, ly, 1.7, 1.7, { m: MAT.glass, z: 41 });
      R.rect(Math.round(lx + 0.4), Math.round(ly - 1), 1, 1, { m: MAT.window, z: 42, em: 0.95 });
      R.tube(lx + 2.4, ly - 1, cx + 9, ly - 5, 0.35, 0.35, { m: MAT.gold, z: 40 });
    },
  },
  // 酒場の主 グラム: 剃り上げた頭に古傷、片眼の眼帯、黒い濃い髭。太い首と肩、革の胴着
  barkeep: {
    bg: keeperBg("#060406", "#2e1a10"),
    paint(R, f) {
      const cx = 24, cy = 20;
      R.amb(LC.cold, 0.06);
      R.dir(-0.72, -0.4, 0.57, LC.candle, 1.05 * f.k, { wrap: 0.45 }); // 吊り灯 (左上から)
      R.rim(0.9, 0.1, -0.2, LC.fire, 0.75 * f.k, 1.6); // 炉の火 (右の縁)
      shoulders(R, cx, 34, 48, { m: MAT.parch, z: 6, bump: [0.4, 1.4, 441, 0.25], tone: -0.2 });
      R.poly([[cx - 21, KH], [cx - 16, 37], [cx - 6, 40], [cx - 5, KH]], { m: MAT.leather, z: 8, bump: [0.4, 0.6, 442] });
      R.poly([[cx + 21, KH], [cx + 16, 37], [cx + 6, 40], [cx + 5, KH]], { m: MAT.leather, z: 8, bump: [0.4, 0.6, 443] });
      R.poly([[cx + 9, 35], [cx + 20, 37], [cx + 18, 48], [cx + 11, 46]], { m: MAT.parch, z: 10, tone: -0.12, bump: [0.8, 0.8, 444] }); // 肩の布巾
      neck(R, cx, 27, 37, 12, MAT.skin, 12);
      face(R, cx, cy, 9, 10.6, { skin: MAT.skin, age: 0.8, deep: 1.1, nose: 0.95, jaw: 0.86, brow: 1.5, lightSide: -1, patch: 1, eyes: "normal", iris: MAT.grey, scar: [-7, -10, -1.5, -3.5], seed: 2 });
      R.bump(cx - 1, cy - 9, 6, 3, 0.7, {}); // 剃り上げた頭頂の照り
      R.poly([[cx - 9, cy + 1], [cx - 7.5, cy + 10], [cx - 3.5, cy + 15], [cx + 3.5, cy + 15], [cx + 7.5, cy + 10], [cx + 9, cy + 1], [cx + 5.5, cy + 6], [cx + 2.2, cy + 4.6], [cx - 2.2, cy + 4.6], [cx - 5.5, cy + 6]],
        { m: MAT.hair, z: 36, bump: [1.1, 1.3, 445, 0.35], nf: (x) => [(x - cx) / 10 * 0.8, 0.1, 0.7] }); // 濃い髭
      R.rect(cx - 2, cy + 6.2, 4, 1, { m: MAT.dark, z: 37 });
    },
  },
  // 黒鉄商会 ヴォス: 撫でつけた黒髪、細い口髭、鋭い鼻。金鎖の片眼鏡、鉄の喉当てと毛皮の襟
  merchant: {
    bg: keeperBg("#050406", "#2a1c10"),
    paint(R, f) {
      const cx = 24, cy = 20;
      R.amb(LC.cold, 0.06);
      R.dir(0.62, 0.3, 0.72, LC.candle, 1.15 * f.k, { wrap: 0.5 }); // 勘定台の灯 (右下から)
      R.rim(-0.9, -0.3, -0.2, LC.moon, 0.6, 1.6);
      shoulders(R, cx, 36, 42, { m: MAT.cloth, z: 6 });
      R.poly([[cx - 21, 41], [cx - 14, 35], [cx - 4, 38], [cx - 6, 45], [cx - 21, 47]], { m: MAT.fur, z: 9, bump: [1, 1.2, 451, 0.4], tone: -0.22 }); // 毛皮の襟
      R.poly([[cx + 21, 41], [cx + 14, 35], [cx + 4, 38], [cx + 6, 45], [cx + 21, 47]], { m: MAT.fur, z: 9, bump: [1, 1.2, 452, 0.4], tone: -0.22 });
      R.poly([[cx - 6.5, 31], [cx + 6.5, 31], [cx + 7.5, 38.5], [cx, 41.5], [cx - 7.5, 38.5]], { m: MAT.grey, z: 11, tone: -0.08, nf: (x, y) => [(x - cx) / 7 * 0.6, (y - 34) / 8 - 0.3, 0.75] }); // 喉当て
      for (const ox of [-4, 0, 4]) R.ell(cx + ox, 37, 0.6, 0.6, { m: MAT.gold, z: 12 });
      neck(R, cx, 27, 32, 7, MAT.skinPale, 10);
      face(R, cx, cy, 7.8, 10.8, { skin: MAT.skinPale, age: 0.6, gaunt: 0.8, deep: 1, nose: 1.3, jaw: 0.62, lightSide: 1, eyes: "normal", iris: MAT.gold, seed: 3, turn: 0.15 });
      R.poly([[cx - 8.4, cy - 2], [cx - 8, cy - 9], [cx - 3.5, cy - 13], [cx + 3.5, cy - 13], [cx + 8, cy - 9], [cx + 8.4, cy - 2], [cx + 6.2, cy - 8.4], [cx, cy - 9.4], [cx - 6.2, cy - 8.4]],
        { m: MAT.hair, z: 36, bump: [1.0, 0.8, 453, 0.2], tf: (x) => ((x * 2) % 5 === 0 ? 0.1 : 0), nf: (x) => [(x - cx) / 8 * 0.6, -0.6, 0.6] }); // 撫でつけた黒髪
      R.poly([[cx - 4.6, cy + 6], [cx - 0.8, cy + 4.4], [cx + 0.8, cy + 4.4], [cx + 4.6, cy + 6], [cx + 0.8, cy + 5.2], [cx - 0.8, cy + 5.2]], { m: MAT.hair, z: 37, tone: -0.1 }); // 細い口髭
      const ex = cx + 4.2, ey = cy - 1.2;
      R.ell(ex, ey, 2.3, 2.3, { m: MAT.gold, z: 39, flat: 0.3 });
      R.ell(ex, ey, 1.4, 1.4, { m: MAT.glass, z: 40 });
      R.rect(Math.round(ex), Math.round(ey - 1), 1, 1, { m: MAT.window, z: 41, em: 0.85 });
      R.path([[ex + 1.8, ey + 1.6], [ex + 3.4, ey + 8], [ex + 2.4, ey + 14], [ex - 1, ey + 19]], 0.3, 0.3, { m: MAT.gold, z: 39 }); // 金鎖
    },
  },
  // 宿の女主 イルザ: 白狼の頭の毛皮を頭巾のようにかぶる女。強い顔立ちに古傷、編んだ灰金の髪
  innkeeper: {
    bg: keeperBg("#050407", "#221a24"),
    paint(R, f) {
      const cx = 24, cy = 23;
      R.amb(LC.cold, 0.07);
      R.dir(-0.75, 0.15, 0.64, LC.candle, 1.05 * f.k, { wrap: 0.45 }); // 枕元の蝋燭 (左下から)
      R.rim(0.9, -0.3, -0.2, LC.moon, 0.7, 1.5);
      shoulders(R, cx, 35, 46, { m: MAT.fur, z: 6, bump: [0.9, 1.6, 461, 0.35], tex: [0.5, 0.15, 462] }); // 毛皮のマント
      R.poly([[cx - 6, KH], [cx - 4, 40], [cx + 4, 40], [cx + 6, KH]], { m: MAT.leather, z: 8 });
      neck(R, cx, 30, 38, 7, MAT.skin, 10);
      for (let i = 0; i < 6; i++) R.ell(cx - 7.5 - i * 0.4, 32 + i * 3, 2.2, 2, { m: MAT.parch, z: 16, bump: [1, 0.8, 463 + i], tone: 0.02 }); // 編んだ髪
      face(R, cx, cy, 7.6, 10, { skin: MAT.skin, age: 0.5, gaunt: 0.4, deep: 1, nose: 1, jaw: 0.68, lightSide: -1, eyes: "normal", iris: MAT.glass, scar: [3.5, 1, 6, 7], mouthW: 0.5, seed: 4 });
      // 白狼の頭 (上顎と鼻面が額を覆い、牙が額に掛かる)
      for (const s of [-1, 1]) R.poly([[cx + s * 7, cy - 10], [cx + s * 11.5, cy - 8], [cx + s * 12, cy + 7], [cx + s * 9, cy + 13], [cx + s * 7.8, cy + 2]], { m: MAT.fur, z: 38, bump: [0.9, 1.3, 467 + s, 0.35], n: [s * 0.5, 0, 0.85] });
      R.ell(cx, cy - 11, 12, 7, { m: MAT.fur, z: 40, bump: [0.9, 1.2, 465, 0.45] });
      for (const s of [-1, 1]) {
        R.poly([[cx + s * 10, cy - 14], [cx + s * 8, cy - 24], [cx + s * 4.5, cy - 15]], { m: MAT.fur, z: 41, n: [s * 0.3, -0.5, 0.8] }); // 耳
        R.poly([[cx + s * 7.3, cy - 15], [cx + s * 7.3, cy - 21], [cx + s * 5.4, cy - 15.5]], { m: MAT.dark, z: 42 });
      }
      R.tube(cx, cy - 10, cx, cy - 5, 4.6, 3.3, { m: MAT.fur, z: 44, bump: [0.9, 0.8, 466, 0.5] }); // 鼻面
      R.ell(cx, cy - 4.2, 1.7, 1.2, { m: MAT.dark, z: 46 });
      for (const s of [-1, 1]) {
        R.ell(cx + s * 5, cy - 11.5, 1.4, 0.9, { m: MAT.dark, z: 45 }); // 狼の目の穴
        R.poly([[cx + s * 2.8 - 0.7, cy - 5], [cx + s * 2.8 + 0.7, cy - 5], [cx + s * 2.8, cy - 2]], { m: MAT.bone, z: 47, tone: 0.1 }); // 牙
      }
    },
  },
  // 宰相 モルデン: 骸のように痩せた老人。黒い高帽、落ち窪んだ眼、細く長い鼻、金の官職の鎖
  minister: {
    bg: keeperBg("#040306", "#1a1424"),
    paint(R, f) {
      const cx = 24, cy = 24;
      R.amb(LC.cold, 0.06);
      R.dir(0.35, -0.8, 0.48, LC.moon, 0.95, { wrap: 0.35 }); // 高窓の月光 (上から)
      R.dir(0.6, 0.5, 0.6, LC.fire, 0.35 * f.k); // 篝火 (右下から)
      R.rim(-0.9, -0.2, -0.2, LC.moon, 0.5, 1.6);
      shoulders(R, cx, 37, 40, { m: MAT.cloth, z: 6, bump: [0.4, 1.2, 471, 0.15] });
      R.poly([[cx - 4, 37], [cx + 4, 37], [cx + 2, KH], [cx - 2, KH]], { m: MAT.crimson, z: 7 });
      for (let i = 0; i <= 14; i++) { const t = i / 14, x = cx - 13 + 26 * t, y = 39 + Math.sin(t * Math.PI) * 8; R.ell(x, y, 1.1, 0.9, { m: MAT.gold, z: 12, flat: 0.2 }); } // 官職の鎖
      R.ell(cx, 48.5, 2.8, 3.2, { m: MAT.gold, z: 13 });
      R.ell(cx, 48.5, 1.3, 1.6, { m: MAT.soulRed, z: 14, em: 0.55 });
      neck(R, cx, 31, 38, 6, MAT.skinPale, 9);
      face(R, cx, cy, 7.2, 10.2, { skin: MAT.skinPale, age: 1.6, gaunt: 1.5, deep: 1.7, nose: 1.35, jaw: 0.58, lightSide: 1, eyes: "hollow", seed: 5, mouthW: 0.5 });
      // 黒い頭巾 (額と頬を覆い、顔だけを闇から浮かせる)
      R.poly([[cx - 8.6, cy + 12], [cx - 10.5, cy + 1], [cx - 9.5, cy - 9], [cx - 5, cy - 14.5], [cx + 5, cy - 14.5], [cx + 9.5, cy - 9], [cx + 10.5, cy + 1], [cx + 8.6, cy + 12], [cx + 6.2, cy + 4], [cx + 6, cy - 5], [cx, cy - 8.2], [cx - 6, cy - 5], [cx - 6.2, cy + 4]],
        { m: MAT.cloth, z: 40, bump: [0.5, 1.1, 472, 0.3], nf: (x, y) => { const u = (x + 0.5 - cx) / 10; return [u * 0.9, (y - cy) / 16 * 0.4, Math.sqrt(Math.max(0, 1 - u * u)) * 0.7 + 0.2]; } });
      R.poly([[cx - 6.4, cy - 4.8], [cx, cy - 8.1], [cx + 6.4, cy - 4.8], [cx + 5.6, cy - 4], [cx, cy - 6.6], [cx - 5.6, cy - 4]], { m: MAT.gold, z: 41 });
      R.shade(cx, cy - 3, 7, 4, 0.6); // 頭巾の庇が落とす影
      R.poly([[cx - 1.1, cy + 8], [cx + 1.1, cy + 8], [cx + 0.7, cy + 15], [cx, cy + 16], [cx - 0.7, cy + 15]], { m: MAT.grey, z: 37, tone: 0.1 }); // 細い顎髭
    },
  },
  // 祠守の巫女: 眼を覆う紅い紗、白い肌、黒く長い髪。足もとの紅い魂に下から照らされる
  maiden: {
    bg: keeperBg("#060205", "#3a0a14"),
    paint(R, f) {
      const cx = 24, cy = 21;
      const pu = 0.8 + 0.2 * Math.pow(Math.max(0, Math.sin(f.t * 2.4)), 3);
      R.amb(LC.cold, 0.05);
      R.dir(0.05, 0.7, 0.7, LC.red, 1.1 * pu, { wrap: 0.4 }); // 足もとの紅い魂 (真下から)
      R.rim(0.9, -0.3, -0.2, LC.red, 0.5, 1.5);
      R.poly([[cx - 12, KH], [cx - 12, cy], [cx - 8, cy - 12], [cx + 8, cy - 12], [cx + 12, cy], [cx + 12, KH]], { m: MAT.hair, z: 4, bump: [1.0, 0.9, 481, 0.12], tone: -0.05 }); // 長い黒髪 (背後)
      shoulders(R, cx, 37, 36, { m: MAT.parch, z: 6, bump: [0.4, 1, 482, 0.2], tone: -0.15 });
      R.poly([[cx - 18, KH], [cx - 16, 41], [cx - 5, 45], [cx - 2, KH]], { m: MAT.crimson, z: 8, tone: -0.12 });
      R.poly([[cx + 18, KH], [cx + 16, 41], [cx + 5, 45], [cx + 2, KH]], { m: MAT.crimson, z: 8, tone: -0.12 });
      neck(R, cx, 29, 38, 6, MAT.skinPale, 10);
      face(R, cx, cy, 7.2, 9.8, { skin: MAT.skinPale, age: 0, deep: 0.8, nose: 0.9, jaw: 0.6, lightSide: 1, eyes: "none", lip: MAT.crimson, mouthW: 0.45, seed: 6, ears: false });
      R.poly([[cx - 7.8, cy - 2], [cx - 7.4, cy - 9], [cx - 2.5, cy - 12], [cx + 3, cy - 12], [cx + 7.4, cy - 9], [cx + 7.8, cy - 2], [cx + 4.5, cy - 7.4], [cx, cy - 8], [cx - 4.5, cy - 7.4]], { m: MAT.hair, z: 36, bump: [1.0, 0.8, 483, 0.2] }); // 前髪
      for (const s of [-1, 1]) R.poly([[cx + s * 6.8, cy - 7], [cx + s * 8.6, cy - 6], [cx + s * 9, cy + 16], [cx + s * 6.6, cy + 11]], { m: MAT.hair, z: 36, bump: [1.0, 0.8, 484 + s, 0.12] });
      // 眼を覆う紅い紗 (額の帯から垂れる)
      R.poly([[cx - 8, cy - 4.8], [cx + 8, cy - 4.8], [cx + 7.5, cy + 2.6], [cx + 3.4, cy + 2], [cx, cy + 2.9], [cx - 3.4, cy + 2], [cx - 7.5, cy + 2.6]],
        { m: MAT.crimson, z: 39, nf: (x, y) => [(x - cx) / 8 * 0.8, (y - cy) / 6 * 0.3, 0.7], tex: [0.9, 0.15, 485], tf: (x) => ((x * 3) % 4 === 0 ? -0.06 : 0) });
      R.rect(cx - 8, cy - 5.2, 16, 1.3, { m: MAT.gold, z: 40 });
      R.ell(cx, cy - 4.6, 1.1, 1.1, { m: MAT.soulRed, z: 41, em: 0.75 * pu });
      R.glow(24, 62, 22, "#a01020", 0.32 * pu, 14, 4);
    },
  },
};

const _keepCache = new Map();
function keeperFrames(key) {
  const K = KEEPERS[key];
  if (!K || !hasDOM()) return null;
  return lazyFrames(_keepCache, key, 4, (i) => {
    const R = new Relief(KW, KH);
    K.paint(R, { i, k: [1, 0.92, 1.07, 0.96][i], t: i * 1.3 });
    return pxCanvas(R.render({ bg: K.bg, outline: [0.4, 0.8], edgeBg: true, q: 4 }), KW, KH);
  });
}
// 番人の胸像 canvas (灯の揺らぎで陰影がわずかに揺れる)
function pixelKeeperCanvas(key) {
  if (key === "king") {
    if (!hasDOM()) return null;
    const R = new Relief(42, 42);
    paintKing(R);
    const c = pxCanvas(R.render({ outline: [0.4, 0.8] }), 42, 42);
    if (c) c.className = "tw-bust";
    return c;
  }
  const frames = keeperFrames(key);
  const c = makeCanvas(KW, KH);
  if (!c || !frames) return null;
  c.className = "tw-bust";
  const g = c.getContext && c.getContext("2d");
  if (!g) return c;
  const seq = flickerSeq(4, 29, key.length * 13 + 1);
  let last = null;
  return livingCanvas(c, (ts) => {
    const fr = frames[seq[Math.floor(ts / 140) % seq.length]] || frames[0];
    if (fr === last || !fr) return;
    last = fr;
    g.drawImage(fr, 0, 0);
  }, 8);
}

// 描き下ろしの胸像は静止画。読めない時は従来の胸像へ戻す。
const _paintedImages = new Map();
function paintedStill(src, width, height, className, fallback, contain = false) {
  const c = makeCanvas(width, height);
  if (!c) return null;
  c.className = className;
  c.style.imageRendering = "auto";
  const g = c.getContext && c.getContext("2d");
  if (!g) return c;
  if (!_paintedImages.has(src)) {
    _paintedImages.set(src, new Promise((resolve) => {
      const im = new Image();
      im.decoding = "async";
      im.onload = () => resolve(im);
      im.onerror = () => resolve(false);
      im.src = src;
    }));
  }
  _paintedImages.get(src).then((im) => {
    if (!im) {
      const fb = fallback();
      if (fb && c.parentNode) c.parentNode.replaceChild(fb, c);
      return;
    }
    const fit = contain ? Math.min : Math.max;
    const s = fit(c.width / im.naturalWidth, c.height / im.naturalHeight);
    const w = im.naturalWidth * s, h = im.naturalHeight * s;
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = "high";
    g.drawImage(im, (c.width - w) / 2, (c.height - h) / 2, w, h);
  });
  return c;
}
export function keeperCanvas(key) {
  const src = TOWN_KEEPERART[key];
  return src ? paintedStill(src, 480, 560, "tw-bust tw-bust-hd", () => pixelKeeperCanvas(key)) : pixelKeeperCanvas(key);
}
// 王の対話枠は正方形。王冠を含む原画全体を収める。
export function kingCanvas() {
  const src = TOWN_KEEPERART.king;
  return src ? paintedStill(src, 480, 480, "tw-bust tw-bust-hd", () => pixelKeeperCanvas("king")) : pixelKeeperCanvas("king");
}

// 街の絵の下ごしらえ: 夜景と施設の情景を、アイドル時間に少しずつ描いておく (初めて街を開く時の引っかかりを消す)
export function prewarmTown(keys = []) {
  if (!hasDOM()) return;
  for (let i = 0; i < SCENE_STAGES.length; i++) idle(() => { if (!_scene) sceneStep(); });
  for (const k of keys) idle(() => vignetteFrames(k));
}

// ───────────────────────────────────────────────────────────────────────────
// 小さな紋章 (迷宮の門・封じられた門・潜行の号令・錠前・奈落)。背景は透明
// ───────────────────────────────────────────────────────────────────────────
function iconGate(R, w, h, mode) {
  const cx = w / 2, bot = h - 1, sy = h * 0.42, hw = w * 0.3;
  R.amb(LC.cold, 0.16);
  R.dir(-0.6, -0.5, 0.65, LC.moon, 0.55);
  // 石の枠 (尖頭アーチ) と、足もとの段
  R.poly(archPts(cx, sy, hw + 2.6, bot, 0.7, 10), { m: MAT.stone, z: 4, bump: [0.6, 0.8, 501], tex: [0.6, 0.15, 502],
    tf: (x, y) => (y < sy && ((Math.atan2(y - sy, x - cx) / Math.PI) * 7 + 20) % 1 < 0.14 ? -0.1 : 0) });
  R.rect(cx - hw - 3.5, bot - 1.2, hw * 2 + 7, 2.2, { m: MAT.stone, z: 6, n: [0, -0.8, 0.6] });
  const inner = archPts(cx, sy, hw, bot - 1, 0.7, 10);
  if (mode === "open") {
    R.poly(inner, { m: MAT.soul, z: -10, emf: (x, y) => clamp01(0.9 - Math.hypot((x + 0.5 - cx) / hw, (y + 0.5 - bot) / (h * 0.5)) * 0.75) });
    R.point(cx, bot - 4, 10, LC.soul, 1.6, 10);
    R.glow(cx, bot - 5, hw * 2, "#6a4ad0", 0.3, h * 0.45, 4);
  } else if (mode === "done") {
    R.poly(inner, { m: MAT.dark, z: -10 });
    R.ell(cx, bot - 3, hw * 0.8, 2.6, { m: MAT.ember, z: -8, em: 0.35 });
    R.point(cx, bot - 4, 6, LC.gold, 0.6, 7);
  } else {
    R.poly(inner, { m: MAT.dark, z: -10 });
    for (let k = 0; k < 3; k++) R.rect(cx - hw + 1 + k, bot - 2 - k * 2.2, (hw - 1 - k) * 2, 1, { m: MAT.stoneD, z: -6 - k * 2, n: [0, -1, 0.4], tone: -0.04 * k });
  }
  if (mode === "sealed") {
    for (let k = 0; k < 4; k++) R.rect(cx - hw + 1.2 + k * (hw * 2 - 2.4) / 3 - 0.5, sy - hw * 0.4, 1.2, bot - sy + hw * 0.4 - 1, { m: MAT.iron, z: 8, nf: (x) => [x % 2 ? 0.5 : -0.5, 0, 0.8] });
    chain(R, cx - hw - 2, sy - 2, cx + hw + 2, bot - 3, 12);
    chain(R, cx + hw + 2, sy - 2, cx - hw - 2, bot - 3, 11);
    const ly = (sy + bot) / 2 + 1;
    R.ell(cx, ly - 2.2, 2.2, 2.4, { m: MAT.iron, z: 14, flat: 0.5 });
    R.ell(cx, ly - 2.2, 1.1, 1.3, { m: MAT.dark, z: 15 });
    R.rect(cx - 2.6, ly - 1, 5.2, 4.2, { m: MAT.iron, z: 16, nf: (x) => [(x - cx) / 3 * 0.6, 0, 0.8] });
    R.rect(Math.round(cx - 0.5), Math.round(ly + 0.4), 1, 1.6, { m: MAT.dark, z: 17 });
  }
}
function iconDive(R, w, h) {
  const cx = w / 2, bot = h - 1, sy = h * 0.4, hw = w * 0.3;
  R.amb(LC.cold, 0.14);
  // 塚に埋もれた墓所の門。奥から魂火、手前に崩れた階段
  R.poly([[0, bot], [1, h * 0.5], [cx - hw - 2, h * 0.2], [cx + hw + 2, h * 0.2], [w - 1, h * 0.5], [w, bot]], { m: MAT.moss, z: 0, bump: [0.6, 1, 511], tone: -0.08 });
  R.poly([[cx - hw - 3, bot], [cx - hw - 3, sy - 2], [cx, h * 0.06], [cx + hw + 3, sy - 2], [cx + hw + 3, bot]], { m: MAT.stone, z: 4, bump: [0.6, 0.8, 512], tex: [0.6, 0.15, 513] });
  R.ell(cx, sy - 3.6, 1.6, 1.5, { m: MAT.bone, z: 6 });
  R.rect(cx - 1, sy - 4, 0.8, 0.8, { m: MAT.dark, z: 7 }); R.rect(cx + 0.4, sy - 4, 0.8, 0.8, { m: MAT.dark, z: 7 });
  R.poly(archPts(cx, sy + 2, hw, bot, 0.8, 10), { m: MAT.soul, z: -10, emf: (x, y) => clamp01(0.95 - Math.hypot((x + 0.5 - cx) / hw, (y + 0.5 - bot + 3) / (h * 0.42)) * 0.85) });
  for (let k = 0; k < 4; k++) R.rect(cx - hw + 0.5 + k * 0.6, bot - 1.6 - k * 2.4, (hw - 0.5 - k * 0.6) * 2, 1.2, { m: MAT.stoneD, z: -4 - k * 2, n: [0, -1, 0.4], tone: 0.06 - k * 0.04 });
  R.point(cx, bot - 6, 8, LC.soul, 2, 12);
  R.glow(cx, bot - 7, hw * 2.2, "#6a4ad0", 0.35, h * 0.5, 4);
}
function iconLock(R, w, h) {
  const cx = w / 2;
  R.amb(LC.cold, 0.18);
  R.dir(-0.6, -0.5, 0.65, LC.candle, 0.8);
  R.ell(cx, h * 0.34, w * 0.3, h * 0.26, { m: MAT.iron, z: 6, flat: 0.4 });
  R.ell(cx, h * 0.34, w * 0.17, h * 0.17, { m: MAT.dark, z: 7 });
  R.rect(cx - w * 0.17, h * 0.34, w * 0.34, h * 0.2, { m: MAT.dark, z: 7 });
  R.rect(cx - w * 0.38, h * 0.46, w * 0.76, h * 0.5, { m: MAT.iron, z: 10, nf: (x, y) => [(x - cx) / (w * 0.4) * 0.6, (y - h * 0.7) / h * 0.5, 0.8], bump: [0.8, 0.4, 521] });
  for (const by of [0.52, 0.88]) R.rect(cx - w * 0.38, h * by, w * 0.76, 1, { m: MAT.iron, z: 11, tone: -0.1 });
  R.ell(cx, h * 0.66, 1.4, 1.4, { m: MAT.dark, z: 12 });
  R.rect(Math.round(cx - 0.5), Math.round(h * 0.66), 1, 3, { m: MAT.dark, z: 12 });
}
function iconAbyss(R, w, h) {
  const cx = w / 2, cy = h * 0.55;
  R.amb(LC.cold, 0.14);
  for (let k = 0; k < 5; k++) {
    const t = k / 4, rx = (w * 0.48) * (1 - t * 0.7), ry = (h * 0.3) * (1 - t * 0.7);
    R.ell(cx, cy + t * 2, rx, ry, { m: k === 4 ? MAT.soul : MAT.stone, z: -k * 6, em: 0.6, tone: k === 4 ? 0 : -t * 0.15, nf: (x, y) => [-(x + 0.5 - cx) / rx * 0.8, -(y + 0.5 - cy) / ry * 0.6, 0.5] });
  }
  R.point(cx, cy + 2, -20, LC.soul, 3, 20);
  R.glow(cx, cy + 2, w * 0.4, "#5a2aa0", 0.4, h * 0.25, 4);
}
const ICONS_DEF = {
  gate: [20, 24, (R, w, h) => iconGate(R, w, h, "closed")],
  gateOpen: [20, 24, (R, w, h) => iconGate(R, w, h, "open")],
  gateDone: [20, 24, (R, w, h) => iconGate(R, w, h, "done")],
  gateSealed: [20, 24, (R, w, h) => iconGate(R, w, h, "sealed")],
  dive: [22, 26, iconDive],
  lock: [18, 22, iconLock],
  abyss: [20, 24, iconAbyss],
};
const _iconPx = new Map();
function iconPx(key) {
  if (_iconPx.has(key)) return _iconPx.get(key);
  const d = ICONS_DEF[key];
  if (!d) return null;
  const R = new Relief(d[0], d[1]);
  d[2](R, d[0], d[1]);
  const px = { w: d[0], h: d[1], px: R.render({ outline: [0.35, 0.7] }) };
  _iconPx.set(key, px);
  return px;
}
// 紋章 canvas (静止画)
function pixelIconCanvas(key) {
  const I = iconPx(key);
  if (!I || !hasDOM()) return null;
  const c = pxCanvas(I.px, I.w, I.h);
  if (c) c.className = "tw-icon";
  return c;
}

export function iconCanvas(key) {
  const d = ICONS_DEF[key], src = TOWN_ICONART[key];
  if (!d) return null;
  return src ? paintedStill(src, d[0] * 12, d[1] * 12, "tw-icon tw-icon-hd", () => pixelIconCanvas(key), true) : pixelIconCanvas(key);
}

// ───────────────────────────────────────────────────────────────────────────
// 王の肖像 (物語の対話用の胸像 42x42)。老いて痩せた王: 鈍く光る棘の王冠、長い白髪と髭、
// 落ち窪んだ眼に微かな灯、白貂の毛皮のマントと深紅の衣。篝火 (左下) と月光の縁 (右)。
// 他の絵と同じく { palette, art } の形で書き出す (spriteCanvas でそのまま描ける)
// ───────────────────────────────────────────────────────────────────────────
function paintKing(R) {
  const W = 42, H = 42, cx = 21, cy = 18;
  R.amb(LC.cold, 0.06);
  R.dir(-0.7, 0.25, 0.66, LC.fire, 1.0, { wrap: 0.4 }); // 篝火 (左下から)
  R.dir(0.3, -0.8, 0.5, LC.moon, 0.25); // 高窓の月光
  R.rim(0.9, -0.25, -0.2, LC.moon, 0.85, 1.5);
  // マント (白貂の毛皮の襟 + 深紅の衣)
  R.poly([[0, H], [1, 33], [6, 28.5], [14, 27], [28, 27], [36, 28.5], [41, 33], [42, H]], { m: MAT.crimson, z: 4, bump: [0.35, 1.1, 601, 0.2], tone: -0.06,
    nf: (x) => { const u = (x + 0.5 - cx) / 21; return [u * 0.85, -0.2, Math.sqrt(Math.max(0, 1 - u * u)) * 0.8 + 0.25]; } });
  for (const s of [-1, 1]) {
    R.poly([[cx + s * 20.5, H], [cx + s * 20, 33], [cx + s * 14, 28], [cx + s * 6, 29], [cx + s * 4, 36], [cx + s * 5, H]],
      { m: MAT.fur, z: 8, bump: [0.9, 1.6, 602 + s, 0.4], tex: [0.6, 0.16, 604], n: [s * 0.55, -0.3, 0.75], tone: -0.34 });
    for (const [ox, oy] of [[10, 33], [14, 37], [8, 39], [16, 31]]) R.ell(cx + s * ox, oy, 0.5, 1, { m: MAT.dark, z: 9 }); // 白貂の尾の黒い斑
  }
  // 首 (痩せて筋張る)
  R.rect(cx - 3.5, 25, 7, 6, { m: MAT.skinPale, z: 10, nf: (x) => { const u = (x + 0.5 - cx) / 3.5; return [u * 0.9, 0, Math.sqrt(Math.max(0, 1 - u * u)) + 0.1]; } });
  // 長い白髪 (背後から肩へ垂れる)
  R.poly([[cx - 11, 32], [cx - 10.5, cy - 2], [cx - 7, cy - 10], [cx + 7, cy - 10], [cx + 10.5, cy - 2], [cx + 11, 32], [cx + 7, 30], [cx - 7, 30]], { m: MAT.grey, z: 6, bump: [1.0, 0.8, 605, 0.14], tone: 0.06 });
  face(R, cx, cy, 6.8, 9, { skin: MAT.skinPale, age: 1.8, gaunt: 1.5, deep: 1.8, nose: 1.25, jaw: 0.64, lightSide: -1, eyes: "glow", glowM: MAT.window, seed: 7, z: 20, ears: false });
  // 両脇の髪 (顔を縁取る)
  for (const s of [-1, 1]) R.poly([[cx + s * 6, cy - 7], [cx + s * 8.2, cy - 5], [cx + s * 9, cy + 9], [cx + s * 7, cy + 13], [cx + s * 6.2, cy + 2]], { m: MAT.grey, z: 30, bump: [1.0, 0.7, 606 + s, 0.15], tone: 0.08 });
  // 白い髭 (胸まで垂れ、先が細る)
  R.poly([[cx - 6.2, cy + 2], [cx - 5.6, cy + 8], [cx - 4, cy + 14], [cx - 1.5, cy + 19], [cx, cy + 21], [cx + 1.5, cy + 19], [cx + 4, cy + 14], [cx + 5.6, cy + 8], [cx + 6.2, cy + 2], [cx + 3.4, cy + 5.6], [cx + 1.2, cy + 4.6], [cx - 1.2, cy + 4.6], [cx - 3.4, cy + 5.6]],
    { m: MAT.grey, z: 32, bump: [1.1, 0.8, 608, 0.16], tone: 0.1, nf: (x, y) => [(x - cx) / 7 * 0.7, (y - cy - 8) / 20 * 0.4, 0.7] });
  R.rect(cx - 1.6, cy + 5.6, 3.2, 1, { m: MAT.dark, z: 33 }); // 口の闇
  // 棘の王冠 (鈍い金の輪、黒ずんだ宝石)
  const by = cy - 8.6;
  R.poly([[cx - 7.2, by + 2.6], [cx - 7, by], [cx + 7, by], [cx + 7.2, by + 2.6]], { m: MAT.gold, z: 34, nf: (x) => [(x - cx) / 8 * 0.8, -0.1, 0.65], tex: [0.8, 0.2, 609] });
  for (const [ox, hgt] of [[-6.2, 3.2], [-3.2, 4.6], [0, 6.4], [3.2, 4.6], [6.2, 3.2]]) R.poly([[cx + ox - 1.2, by + 0.2], [cx + ox, by - hgt], [cx + ox + 1.2, by + 0.2]], { m: MAT.gold, z: 35, nf: (x) => [x < cx + ox ? -0.6 : 0.6, -0.4, 0.7] });
  R.ell(cx, by + 1.3, 1.1, 1, { m: MAT.soulRed, z: 36, em: 0.55 });
  for (const s of [-1, 1]) R.ell(cx + s * 4.2, by + 1.3, 0.8, 0.8, { m: MAT.glass, z: 36 });
}

function spriteFromPx(px, w, h) {
  const palette = {}, rows = [], keyOf = new Map();
  let next = 0x4e00;
  for (let y = 0; y < h; y++) {
    let row = "";
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (px[i + 3] < 128) { row += "."; continue; }
      const hx = "#" + [px[i], px[i + 1], px[i + 2]].map((v) => v.toString(16).padStart(2, "0")).join("");
      let k = keyOf.get(hx);
      if (!k) { k = String.fromCharCode(next++); keyOf.set(hx, k); palette[k] = hx; }
      row += k;
    }
    rows.push(row);
  }
  return { palette, art: rows };
}
function makeKingPortrait() {
  try {
    const R = new Relief(42, 42);
    paintKing(R);
    return spriteFromPx(R.render({ outline: [0.4, 0.8] }), 42, 42);
  } catch (e) {
    return { palette: { a: "#1a1418" }, art: ["a"] };
  }
}
export const KING_PORTRAIT = makeKingPortrait();

// ═══════════════════════════════════════════════════════════════════════════
// 街の夜景パノラマ「辺境の街 ロアダル」 (内部解像度 240x170)
// 左手前に迷宮の口 (地下墓所の門) と墓地・吊るし籠の枯れ木、中央に城壁と家並み、
// 右の岩山に王宮、その背後の雲間に月。迷宮の口からは魂の柱が天へ昇る。
// 静的な層は一度だけ描いてキャッシュし、毎フレームは 雲・霧の流れ / 窓の揺らぎ / 煙 / 魂の燐光 / 籠の揺れ / 鴉 だけを重ねる。
// ═══════════════════════════════════════════════════════════════════════════
export const SCENE_W = 240, SCENE_H = 170;
const SW = SCENE_W, SH = SCENE_H;
const MOON = { x: 190, y: 34, r: 10 };
const MOON_L = [0.55, -0.5, 0.67]; // 月光の向き (右上、王宮の背後から)

// 横に巡回するノイズ (雲・霧の帯を継ぎ目なく流す)
function pnoise(x, y, s, P) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), m = (k) => ((k % P) + P) % P;
  const a = hash(m(xi), yi, s), b = hash(m(xi + 1), yi, s), c = hash(m(xi), yi + 1, s), d = hash(m(xi + 1), yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const pfbm = (x, y, s, P) => pnoise(x, y, s, P) * 0.55 + pnoise(x * 2, y * 2, s + 7, P * 2) * 0.3 + pnoise(x * 4, y * 4, s + 13, P * 4) * 0.15;
function stopsAt(stops, t) {
  if (t <= stops[0][0]) return hex(stops[0][1]);
  for (let i = 1; i < stops.length; i++) if (t <= stops[i][0]) {
    const [t0, c0] = stops[i - 1], [t1, c1] = stops[i];
    return mixc(hex(c0), hex(c1), (t - t0) / (t1 - t0 || 1));
  }
  return hex(stops[stops.length - 1][1]);
}

// 夜空 (ディザの段を残したグラデーション + 月の暈 + 星 + 月)
function paintSkyPx() {
  const px = new Uint8ClampedArray(SW * SH * 4);
  const stops = [[0, "#030208"], [0.3, "#07061a"], [0.6, "#0f0c24"], [0.82, "#1a1430"], [1, "#2a1f38"]];
  const halo = hex("#4e4a70"), halo2 = hex("#a29cc0");
  for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
    const t = clamp01(y / 118);
    let c = stopsAt(stops, Math.floor(t * 14 + bayer(x, y)) / 14);
    const d = Math.hypot(x + 0.5 - MOON.x, (y + 0.5 - MOON.y) * 1.1);
    const hk = Math.floor((Math.exp(-d / 26) * 0.55 + Math.exp(-d / 9) * 0.35) * 8 + bayer(x, y)) / 8;
    if (hk > 0) c = mixc(c, d < 16 ? halo2 : halo, Math.min(0.75, hk));
    const i = (y * SW + x) * 4;
    px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255;
  }
  // 星 (月の近くと地平の靄の中は避ける)
  const r = rng(77);
  for (let k = 0; k < 120; k++) {
    const x = Math.floor(r() * SW), y = Math.floor(r() * 92), b = r();
    if (Math.hypot(x - MOON.x, y - MOON.y) < 24) continue;
    const i = (y * SW + x) * 4, v = 60 + b * b * 170 * (1 - y / 120);
    px[i] = Math.max(px[i], v * 0.9); px[i + 1] = Math.max(px[i + 1], v * 0.92); px[i + 2] = Math.max(px[i + 2], v);
  }
  // 月: 左上を照り、右下へ欠ける十三夜。海 (暗い斑) と縁の減光
  const M = MOON, mr = hex("#f2ecdc"), md = hex("#8f8aa0");
  for (let y = -M.r - 1; y <= M.r + 1; y++) for (let x = -M.r - 1; x <= M.r + 1; x++) {
    const d = Math.hypot(x + 0.5, y + 0.5) / M.r;
    if (d > 1) continue;
    const X = M.x + x, Y = M.y + y, i = (Y * SW + X) * 4;
    const term = Math.hypot(x + 0.5 - M.r * 0.55, y + 0.5 + M.r * 0.35) / (M.r * 1.25); // 欠け際
    let v = 0.92 - d * d * 0.25 - (vnoise(X * 0.42, Y * 0.42, 5) > 0.58 ? 0.22 : 0) - (vnoise(X * 0.9, Y * 0.9, 6) > 0.7 ? 0.08 : 0);
    if (term > 1) v -= (term - 1) * 2.2;
    v = Math.floor(clamp01(v) * 6 + bayer(X, Y)) / 6;
    const c = mixc(md, mr, v);
    px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2];
  }
  return px;
}

// 雲の帯 (480 幅で巡回)。上縁は月光で淡く縁取り、腹は暗い
function paintCloudsPx(W, H, seed, thr, dens) {
  const px = new Uint8ClampedArray(W * H * 4);
  const body = hex("#0d0b1a"), mid = hex("#1d1a30"), rim = hex("#5a5578");
  const P = 6;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const fx = (x / W) * P, fy = y * 0.055;
    const edge = Math.min(1, y / 8, (H - y) / 10);
    const v = (pfbm(fx, fy, seed, P) - thr) * dens * edge;
    if (v <= 0) continue;
    const a = Math.min(1, Math.floor(v * 4 + bayer(x, y)) / 4);
    if (a <= 0) continue;
    const up = (pfbm(fx, (y - 2) * 0.055, seed, P) - thr) * dens;
    const c = up <= 0.05 ? rim : up < 0.35 ? mid : body;
    const i = (y * W + x) * 4;
    px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = Math.round(a * 235);
  }
  return px;
}
// 霧の帯 (半透明)
function paintFogPx(W, H, seed, col, k) {
  const px = new Uint8ClampedArray(W * H * 4), c = hex(col), P = 6;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = 1 - Math.abs(y + 0.5 - H / 2) / (H / 2);
    const v = k * p * p * (0.25 + pfbm((x / W) * P, y * 0.16, seed, P));
    const a = Math.floor(v * 5 + bayer(x, y)) / 5;
    if (a <= 0) continue;
    const i = (y * W + x) * 4;
    px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = Math.round(Math.min(1, a) * 255);
  }
  return px;
}

// 魂の柱 (迷宮の口から天へ昇る、加算合成の光)
function paintColumnPx(W, H) {
  const px = new Uint8ClampedArray(W * H * 4), core = hex("#c8c0ff"), mid = hex("#7a5ad8"), edge = hex("#3a2280");
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const t = y / H, hw = 1.6 + (1 - t) * (W / 2 - 2.5), dx = Math.abs(x + 0.5 - W / 2) / hw;
    if (dx >= 1) continue;
    const k = Math.pow(1 - dx, 1.6) * sstep(0, 0.22, t) * (0.45 + 0.55 * t) * (0.75 + 0.25 * vnoise(x * 0.3, y * 0.08, 151));
    const a = Math.floor(k * 5 + bayer(x, y)) / 5;
    if (a <= 0) continue;
    const c = a > 0.75 ? core : a > 0.35 ? mid : edge, i = (y * W + x) * 4;
    px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = Math.round(a * 255);
  }
  return px;
}

// 魂の渦 (柱の行き着く空で、雲がゆっくり渦を巻く)。位相をずらしたコマを描き溜める
function paintVortexPx(W, H, phase) {
  const px = new Uint8ClampedArray(W * H * 4), core = hex("#e8e0ff"), mid = hex("#9a7af0"), edge = hex("#4a2a98");
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = (x + 0.5 - W / 2) / (W / 2), v = (y + 0.5 - H / 2) / (H / 2), r = Math.hypot(u, v);
    if (r >= 1) continue;
    const th = Math.atan2(v, u), arm = Math.cos(th * 3 - Math.log(r + 0.05) * 3.2 + phase);
    const k = clamp01((arm * 0.5 + 0.5) * (1 - r) * 1.6 - 0.25) + clamp01(0.35 - r) * 2.2;
    const a = Math.floor(k * 4 + bayer(x, y)) / 4;
    if (a <= 0) continue;
    const c = a > 0.75 ? core : a > 0.4 ? mid : edge, i = (y * W + x) * 4;
    px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = Math.round(Math.min(1, a) * 220);
  }
  return px;
}

// ---- 家 (切妻を正面に向けた木組みの家。右奥へ斜投影) ----
const OBL = [0.6, -0.34]; // 奥行き 1 あたりの画面上のずれ
function house(R, o, out) {
  const { x, base, w, h, rh, d = 6, z = 0 } = o;
  const id = R.newId(), ex = OBL[0] * d, ey = OBL[1] * d;
  const top = base - h, A = [x + w / 2, top - rh], El = [x - 1, top], Er = [x + w + 1, top];
  const roof = o.roof || MAT.slate, wall = o.wall || MAT.plaster;
  const rb = [0.35, 0.5, 300 + x];
  // 屋根: 奥の左斜面 (月光を浴びる) → 右斜面
  R.poly([A, El, [El[0] + ex, El[1] + ey], [A[0] + ex, A[1] + ey]], { m: roof, z: z - 2, id, n: [-0.62, -0.6, 0.5], bump: rb, tf: (px, py) => ((py * 2 + px) % 3 === 0 ? -0.04 : 0) });
  R.poly([A, Er, [Er[0] + ex, Er[1] + ey], [A[0] + ex, A[1] + ey]], { m: roof, z: z - 1, id, n: [0.6, -0.62, 0.5], bump: rb, tf: (px, py) => ((py * 2 - px) % 3 === 0 ? -0.05 : 0) });
  // 右の側壁 (陰)
  R.poly([[x + w, base], [x + w, top], [x + w + ex, top + ey], [x + w + ex, base + ey]], { m: wall, z: z - 1, id, n: [0.88, 0, 0.45], tex: [0.3, 0.1, x] });
  // 煙突
  if (o.chim) {
    const cx = A[0] + ex * 0.6 + o.chim, cy = A[1] + ey * 0.6 + Math.abs(o.chim) * (2 * rh / w) - 1;
    R.rect(cx - 1, cy - 5, 3, 7, { m: MAT.stoneD, z: z + 1, id, n: [-0.3, 0, 1], tex: [0.6, 0.15, x] });
    R.rect(cx - 1.5, cy - 6, 4, 1.4, { m: MAT.stone, z: z + 2, id, n: [0, -1, 0.5] });
    out.chimneys.push({ x: cx + 0.5, y: cy - 6, seed: x });
  }
  // 正面の壁と破風 (木組み)
  const beam = (px, py) => {
    const lx = px - x, ly = py - top;
    if (ly < 0) { const gx = Math.abs(px + 0.5 - A[0]), gy = A[1] - py; return Math.abs(gx * (rh / (w / 2 + 1)) + gy) < 1.1 ? -0.16 : 0; }
    if (lx === 0 || lx === w - 1 || ly === 0 || ly === Math.floor(h * 0.5) || (w > 13 && lx === Math.floor(w / 2))) return -0.15;
    if (o.brace && ly > Math.floor(h * 0.5) && Math.abs((lx - 1) - (ly - Math.floor(h * 0.5)) * 0.9) < 0.7) return -0.13;
    return 0;
  };
  R.poly([[x, base], [x, top], El, A, Er, [x + w, top], [x + w, base]], { m: wall, z, id, n: [-0.05, -0.04, 1], tex: [0.25, 0.14, x + 1], bump: [0.6, 0.35, x + 2], tf: beam });
  // 軒の陰
  R.shadePoly([[El[0], top], [Er[0], top], [Er[0], top + 1.5], [El[0], top + 1.5]], 0.6, { id });
  // 窓 (灯る窓は自発光 + 壁を照らす小さな光)
  for (const wn of o.wins || []) {
    const wx = x + wn[0], wy = top + wn[1], ww = wn[2] || 2, wh = wn[3] || 2, lit = wn[4] ?? 0.7;
    if (lit <= 0) { R.rect(wx, wy, ww, wh, { m: MAT.dark, z: z + 1, id }); continue; }
    R.rect(wx, wy, ww, wh, { m: MAT.window, z: z + 1, id, em: lit, emf: (px, py) => lit * (py === wy + wh - 1 ? 0.8 : 1) });
    R.point(wx + ww / 2, wy + wh / 2 + 1, z + 4, LC.candle, 0.35 * lit, 3.2, { cut: 9 });
    out.windows.push({ x: wx, y: wy, w: ww, h: wh, lit, ph: hash(wx, wy, 9) * TAU, sp: 0.6 + hash(wy, wx, 3) * 1.6 });
  }
  if (o.door) R.rect(x + w / 2 - 1.5, base - 5, 3, 5, { m: MAT.woodD, z: z + 1, id, tone: -0.05 });
  return { A, top, id };
}

// 円筒の塔 + 円錐の屋根
function tower(R, cx, r, top, base, roofTop, o = {}) {
  const z = o.z || 0, id = R.newId();
  R.rect(cx - r, top, r * 2, base - top, { m: o.m || MAT.stone, z, id, bump: [0.45, 0.5, cx],
    nf: (x) => { const u = clamp01((x + 0.5 - (cx - r)) / (2 * r)) * 2 - 1; return [u, 0, Math.sqrt(1 - u * u) + 0.05]; },
    tf: (x, y) => ((y - top) % 4 === 0 ? -0.05 : 0) });
  if (roofTop != null) {
    const rr = r + 1.2;
    R.poly([[cx - rr, top + 0.5], [cx + rr, top + 0.5], [cx, roofTop]], { m: o.roof || MAT.slate, z: z + 1, id,
      nf: (x, y) => { const hw = Math.max(0.6, rr * (y - roofTop) / (top - roofTop)), u = Math.max(-1, Math.min(1, (x + 0.5 - cx) / hw)); return [u * 0.85, -0.5, Math.sqrt(1 - u * u) * 0.75 + 0.15]; },
      tf: (x, y) => ((y - roofTop) % 3 === 0 ? -0.04 : 0) });
    R.shadePoly([[cx - r, top], [cx + r, top], [cx + r, top + 1.5], [cx - r, top + 1.5]], 0.7, { id });
  }
  return id;
}

// 王宮 (岩山の上の大聖堂めいた城)
function paintPalace(R, out) {
  const z = -46;
  // 岩山
  const crag = [[132, SH], [138, 136], [146, 124], [152, 112], [160, 104], [168, 99], [176, 96], [190, 94], [214, 93], [230, 95], [240, 97], [240, SH]];
  R.poly(crag, { m: MAT.stoneD, z: z - 4, bump: [0.16, 2.6, 61, 0.07], tex: [0.1, 0.3, 62, 0.05],
    nf: (x, y) => [x < 165 && y < 125 ? -0.5 : 0.25, -0.15, 0.95],
    tf: (x, y) => (vnoise(x * 0.35, y * 0.06, 63) > 0.72 ? -0.12 : 0) - clamp01((y - 100) / 70) * 0.12 });
  // 城壁 (胸壁と矢狭間)
  const wallId = R.newId();
  R.rect(160, 80, 78, 16, { m: MAT.stone, z, id: wallId, tex: [0.35, 0.12, 63], bump: [0.5, 0.45, 64], tf: (x, y) => ((y - 80) % 4 === 3 ? -0.06 : 0) });
  for (let x = 160; x < 238; x += 4) R.rect(x, 77, 2, 3, { m: MAT.stone, z, id: wallId });
  for (const ax of [172, 188, 222, 232]) R.rect(ax, 85, 1, 3, { m: MAT.dark, z: z + 1 });
  // 大広間 (身廊) と急勾配の屋根
  const hall = R.newId();
  R.rect(180, 50, 40, 32, { m: MAT.stone, z: z + 2, id: hall, tex: [0.3, 0.12, 65], bump: [0.5, 0.5, 66], tf: (x, y) => ((y - 50) % 5 === 4 ? -0.05 : 0) });
  R.poly([[178, 50.5], [222, 50.5], [200, 30]], { m: MAT.slate, z: z + 2, id: hall, nf: (x) => [x < 200 ? -0.55 : 0.55, -0.55, 0.6], tf: (x, y) => ((y + x) % 3 === 0 ? -0.04 : 0) });
  // 控え壁と飛び梁
  for (const bx of [182, 196, 204, 218]) R.rect(bx - 1, 60, 2.5, 22, { m: MAT.stone, z: z + 3, id: hall, n: [-0.4, 0, 0.9] });
  R.path([[176, 82], [178, 70], [181, 62]], 0.9, 0.7, { m: MAT.stone, z: z + 3 });
  R.path([[224, 82], [222, 70], [219, 62]], 0.9, 0.7, { m: MAT.stone, z: z + 3 });
  // 尖塔の小塔 (ピナクル)
  for (const [px, pt] of [[180, 38], [220, 40], [190, 44], [210, 44]]) {
    R.rect(px - 1, pt + 6, 2, 50 - pt - 6 + 2, { m: MAT.stone, z: z + 4, n: [-0.3, 0, 1] });
    R.poly([[px - 1.5, pt + 6.5], [px + 1.5, pt + 6.5], [px, pt]], { m: MAT.slate, z: z + 4, nf: (x) => [x < px ? -0.7 : 0.7, -0.4, 0.6] });
  }
  // 中央の鐘楼と大尖塔
  const sp = R.newId();
  R.rect(194, 18, 12, 34, { m: MAT.stone, z: z + 5, id: sp, tex: [0.3, 0.12, 67], bump: [0.5, 0.5, 68],
    nf: (x) => [x < 196 ? -0.6 : x > 203 ? 0.6 : 0, 0, 0.8], tf: (x, y) => ((y - 18) % 5 === 4 ? -0.05 : 0) });
  R.poly([[192.5, 18.5], [207.5, 18.5], [200, -6]], { m: MAT.slate, z: z + 6, id: sp,
    nf: (x, y) => { const hw = Math.max(0.6, 7.5 * (y + 6) / 24.5), u = Math.max(-1, Math.min(1, (x + 0.5 - 200) / hw)); return [u * 0.85, -0.45, Math.sqrt(1 - u * u) * 0.75 + 0.15]; },
    tf: (x, y) => ((y + 6) % 3 === 0 ? -0.04 : 0) });
  for (const px of [194, 206]) R.poly([[px - 1.2, 19], [px + 1.2, 19], [px, 10]], { m: MAT.slate, z: z + 7, nf: (x) => [x < px ? -0.7 : 0.7, -0.4, 0.6] });
  // 鐘楼の窓 (仄暗い灯) と薔薇窓
  R.poly(archPts(200, 26, 2, 32, 0.6, 6), { m: MAT.window, z: z + 6, em: 0.35 });
  R.ell(200, 60, 4.6, 4.6, { m: MAT.stoneD, z: z + 3 });
  R.ell(200, 60, 3.6, 3.6, { m: MAT.window, z: z + 4, emf: (x, y) => { const a = Math.atan2(y + 0.5 - 60, x + 0.5 - 200), d = Math.hypot(x + 0.5 - 200, y + 0.5 - 60); return d < 1 ? 0.75 : (Math.cos(a * 8) > 0.2 ? 0.6 : 0.25); } });
  R.point(200, 62, z + 12, LC.candle, 0.45, 6);
  for (const [wx, wy] of [[186, 64], [192, 64], [208, 64], [214, 64], [186, 72], [214, 72]]) {
    R.poly(archPts(wx + 0.5, wy + 1.5, 1, wy + 5, 0.6, 4), { m: MAT.window, z: z + 3, em: 0.25 + hash(wx, wy, 1) * 0.5 });
    if (hash(wx, wy, 2) > 0.4) out.windows.push({ x: wx, y: wy + 1, w: 1, h: 4, lit: 0.55, ph: hash(wx, wy, 3) * TAU, sp: 0.5 });
  }
  // 両翼の塔
  tower(R, 165, 5, 54, 96, 36, { z: z + 6 });
  tower(R, 233, 5, 60, 96, 45, { z: z + 6 });
  for (const [wx, wy] of [[164, 62], [166, 74], [232, 68], [234, 80]]) {
    R.rect(wx, wy, 1, 2, { m: MAT.window, z: z + 8, em: 0.6 });
    out.windows.push({ x: wx, y: wy, w: 1, h: 2, lit: 0.6, ph: hash(wx, wy, 4) * TAU, sp: 0.8 });
  }
  // 城門 (奥に篝火)
  R.poly(archPts(200, 88, 4, 96, 0.5, 6), { m: MAT.dark, z: z + 1 });
  R.ell(200, 94, 3, 2, { m: MAT.ember, z: z + 2, em: 0.6 });
  R.point(200, 93, z + 6, LC.fire, 0.9, 7);
  // 王家の垂れ幕 (深紅・裾は裂けている)
  for (const bx of [178, 222]) {
    R.rect(bx - 2, 81, 4, 11, { m: MAT.crimson, z: z + 2, n: [0, 0, 1], tex: [0.9, 0.2, bx], tf: (x, y) => (y > 89 && (x + y) % 3 === 0 ? -0.3 : (x === bx ? 0.06 : 0)) });
    R.rect(bx - 1, 84, 2, 2, { m: MAT.gold, z: z + 3, n: [0, 0, 1] });
  }
  // 頂の王旗の位置 (アニメで翻らせる)
  out.flag = { x: 200, y: -2 };
  out.spots.palace = { x: 196, y: 66 };
}

// 迷宮の口 — 丘に埋もれた地下墓所の門。階段が闇へ下り、奥から青紫の魂火が昇る
function paintCrypt(R, out) {
  const z = 6, cx = 38, sy = 120, hw = 9, bot = 146;
  // 背後の塚
  R.poly([[0, 150], [4, 128], [14, 116], [30, 110], [46, 110], [62, 117], [74, 130], [80, 150]], { m: MAT.moss, z: z - 6, bump: [0.3, 1.2, 71], tex: [0.2, 0.25, 72], nf: (x) => [x < 38 ? -0.5 : 0.4, -0.6, 0.6] });
  // 門の外枠 (重い石の切妻 + 頭蓋の浮彫り)
  const fid = R.newId();
  R.poly([[cx - 18, bot], [cx - 18, 112], [cx, 98], [cx + 18, 112], [cx + 18, bot]], { m: MAT.stoneD, z, id: fid, tex: [0.35, 0.16, 73], bump: [0.45, 0.8, 74], tf: (x, y) => ((y - 98) % 5 === 4 && y > 112 ? -0.07 : 0) });
  R.poly([[cx - 20, 113], [cx, 96], [cx + 20, 113], [cx + 20, 115], [cx, 98.5], [cx - 20, 115]], { m: MAT.stone, z: z + 1, id: fid, n: [0, -0.8, 0.6] });
  // 柱
  for (const px of [cx - 16, cx + 13]) R.rect(px, 114, 3, bot - 114, { m: MAT.stone, z: z + 2, id: fid, nf: (x) => [x === px ? -0.7 : x === px + 2 ? 0.7 : 0, 0, 0.8], tf: (x, y) => ((y - 114) % 6 === 0 ? -0.06 : 0) });
  // 頭蓋の要石
  R.ell(cx, 106.5, 2.6, 2.4, { m: MAT.bone, z: z + 3 });
  R.rect(cx - 1.6, 106, 1, 1.2, { m: MAT.dark, z: z + 4 }); R.rect(cx + 0.7, 106, 1, 1.2, { m: MAT.dark, z: z + 4 });
  // 門口 (尖頭アーチ) — 闇の底へ下る階段と、奥の魂火
  const inner = archPts(cx, sy, hw, bot, 0.8, 10);
  R.poly(inner, { m: MAT.dark, z: z - 20 });
  for (let k = 0; k < 6; k++) {
    const yy = bot - 2 - k * 2.2, hw2 = hw - 1 - k * 0.9;
    R.rect(cx - hw2, yy, hw2 * 2, 1.2, { m: MAT.stoneD, z: z - 4 - k * 3, n: [0, -1, 0.4], tone: -0.02 * k });
  }
  R.ell(cx, 132, 5.5, 4, { m: MAT.soul, z: z - 18, emf: (x, y) => clamp01(0.7 - Math.hypot(x + 0.5 - cx, (y + 0.5 - 133) * 1.4) / 7) });
  R.point(cx, 130, z - 2, LC.soul, 1.5, 10);
  R.point(cx, 140, z + 6, LC.soul, 0.5, 18, { wrap: 0.3 });
  R.glow(cx, 130, 26, "#4a2a8a", 0.28, 22, 5);
  R.glow(cx, 133, 9, "#9aa8ff", 0.22, 7, 3);
  // 崩れた扉 (片方は傾いて残る)
  R.poly([[cx + hw - 1, bot], [cx + hw + 4, 125], [cx + hw + 7, 126], [cx + hw + 3, bot + 1]], { m: MAT.woodD, z: z + 3, n: [0.3, 0, 1], tex: [0.9, 0.2, 75, 0.2], tf: (x, y) => ((x * 3 + y) % 5 === 0 ? -0.1 : 0) });
  // 頭巾の石像 (左右)
  for (const [sx, dir] of [[cx - 24, -1], [cx + 23, 1]]) {
    const sid = R.newId();
    R.rect(sx - 3, 140, 6, 7, { m: MAT.stone, z: z + 4, id: sid, nf: (x) => [x < sx - 1 ? -0.7 : x > sx + 1 ? 0.6 : 0, 0, 0.8] });
    R.ell(sx, 132, 3.6, 8, { m: MAT.stone, z: z + 5, id: sid, bump: [0.7, 0.6, sx], flat: 0.15 });
    R.ell(sx + dir * 0.3, 124.5, 2.6, 2.8, { m: MAT.stone, z: z + 6, id: sid });
    R.ell(sx + dir * 0.6, 125.2, 1.5, 1.6, { m: MAT.dark, z: z + 7 });
    R.tube(sx - 3, 130, sx + 2.5 * dir, 136, 0.9, 0.8, { m: MAT.stone, z: z + 7, id: sid });
  }
  out.crypt = { x: cx, y: 131 };
  out.spots.crypt = { x: cx, y: 118 };
}

// 枯れ木 (再帰的に枝分かれ)
function deadTree(R, x, by, h, seed, o = {}) {
  const r = rng(seed), segs = [];
  const grow = (x0, y0, ang, len, th, d) => {
    const k = (r() - 0.5) * 0.7, xm = x0 + Math.cos(ang + k) * len * 0.5, ym = y0 + Math.sin(ang + k) * len * 0.5;
    const x1 = xm + Math.cos(ang - k) * len * 0.5, y1 = ym + Math.sin(ang - k) * len * 0.5;
    segs.push([x0, y0, xm, ym, th, th * 0.85], [xm, ym, x1, y1, th * 0.85, th * 0.7]);
    if (d <= 0 || len < 3) return;
    const n = d > 3 ? 2 : 2 + (r() < 0.4 ? 1 : 0);
    for (let i = 0; i < n; i++) grow(x1, y1, ang + (i - (n - 1) / 2) * 0.8 + (r() - 0.5) * 0.5 + (o.bias || 0), len * (0.6 + r() * 0.22), th * 0.66, d - 1);
  };
  grow(x, by, -Math.PI / 2 + (o.lean || 0), h * 0.34, o.th || 3.2, o.depth || 5);
  const P = { m: MAT.woodD, z: o.z || 20, id: R.newId() };
  for (const s of segs) R.tube(s[0], s[1], s[2], s[3], Math.max(0.5, s[4] / 2), Math.max(0.5, s[5] / 2), { ...P, cap: true, bump: [0.8, 0.5, seed] });
  if (o.hook) R.tube(o.hook[0], o.hook[1], o.hook[2], o.hook[3], 1.2, 0.7, { ...P, cap: true });
  R.poly([[x - 5, by + 1], [x - 1.5, by - 6], [x + 1.5, by - 6], [x + 5, by + 1]], P);
}

// 墓石 (0=丸頭 1=十字 2=尖頭)
function grave(R, x, by, w, h, kind, z, tilt = 0) {
  const id = R.newId(), cs = Math.cos(tilt), sn = Math.sin(tilt);
  const T = (pts) => pts.map(([px, py]) => [x + px * cs - py * sn, by + px * sn + py * cs]);
  const hw = w / 2, o = { m: MAT.stone, z, id, tex: [0.6, 0.2, x * 7], bump: [0.7, 0.5, x], nf: (px) => [(px + 0.5 - x) / hw * 0.7, -0.2, 0.75] };
  if (kind === 1) { R.poly(T([[-0.8, 0], [-0.8, -h], [0.8, -h], [0.8, 0]]), o); R.poly(T([[-hw, -h * 0.72], [hw, -h * 0.72], [hw, -h * 0.72 + 1.6], [-hw, -h * 0.72 + 1.6]]), o); }
  else if (kind === 2) R.poly(T([[-hw, 0], [-hw, -h + hw], [0, -h], [hw, -h + hw], [hw, 0]]), o);
  else { const p = [[-hw, 0], [-hw, -h + hw]]; for (let i = 1; i < 8; i++) { const a = Math.PI + (Math.PI * i) / 8; p.push([Math.cos(a) * hw, -h + hw + Math.sin(a) * hw]); } p.push([hw, -h + hw], [hw, 0]); R.poly(T(p), o); }
}

// 地上の静的な層 (山・王宮・家並み・墓地・迷宮の口) を浮彫りで描き、動く光の位置を out に記録する
function paintLandPx() {
  const out = { windows: [], chimneys: [], spots: {}, flag: null, crypt: null, shrine: null, lantern: null, cage: null, torches: [] };
  const R = new Relief(SW, SH);
  R.amb(LC.cold, 0.07);
  R.dir(MOON_L[0], MOON_L[1], MOON_L[2], LC.moon, 0.42);
  // 遠い山並み (靄に霞む) → 近い丘
  const far = (x) => 80 - 18 * fbm(x * 0.03, 0.5, 81) - 8 * Math.exp(-(((x - 120) / 30) ** 2));
  R.poly([[0, SH], ...Array.from({ length: SW + 1 }, (_, x) => [x, far(x)]), [SW, SH]], { m: MAT.stone, z: -160, tex: [0.1, 0.18, 82, 0.05],
    nf: (x) => { const s = far(x + 1) - far(x - 1); return [s * 0.7, -0.5, 0.8]; } });
  const mid = (x) => 104 - 8 * fbm(x * 0.05, 1.5, 83);
  R.poly([[0, SH], ...Array.from({ length: SW + 1 }, (_, x) => [x, mid(x)]), [SW, SH]], { m: MAT.stoneD, z: -100, bump: [0.2, 1.2, 84, 0.1],
    nf: (x) => { const s = mid(x + 1) - mid(x - 1); return [s * 0.6, -0.55, 0.8]; } });
  paintPalace(R, out);
  // 家並み (奥の列 → 手前の列)。王宮の丘へ向かって段々に上る
  const rows = [
    { z: -38, list: [
      { x: 104, base: 106, w: 11, h: 9, rh: 9, wins: [[3, 3], [7, 3, 2, 2, 0]], chim: 2 },
      { x: 118, base: 104, w: 13, h: 10, rh: 10, wins: [[2, 4], [8, 4, 2, 2, 0.5]] },
      { x: 133, base: 101, w: 10, h: 9, rh: 8, wins: [[4, 3]], chim: -2 },
      { x: 145, base: 99, w: 12, h: 10, rh: 9, wins: [[3, 4, 2, 2, 0], [7, 4]] },
    ] },
    { z: -30, list: [
      // 人業の館: 高く痩せた館に、傾いた尖塔と丸窓
      { x: 82, base: 120, w: 14, h: 18, rh: 13, wins: [[3, 4, 2, 3, 0.85], [9, 4, 2, 3, 0], [3, 11, 2, 2, 0.5], [9, 11, 2, 2, 0.75]], brace: true, key: "mansion" },
      { x: 100, base: 118, w: 12, h: 10, rh: 9, wins: [[3, 4], [8, 4, 2, 2, 0]], chim: 3 },
      { x: 115, base: 116, w: 17, h: 12, rh: 11, wins: [[3, 4, 3, 2, 0.9], [11, 4, 3, 2, 0.95], [7, 8, 3, 3, 0.8]], chim: -4, key: "tavern", door: true },
      { x: 135, base: 113, w: 14, h: 11, rh: 10, wins: [[3, 4, 2, 2, 0.65], [9, 4, 2, 2, 0.7]], key: "inn", brace: true },
      { x: 152, base: 111, w: 11, h: 10, rh: 8, wins: [[4, 4, 2, 2, 0.4]], chim: 2 },
    ] },
    { z: -22, list: [
      { x: 92, base: 132, w: 13, h: 11, rh: 9, wins: [[3, 3], [8, 3, 2, 2, 0.6]], chim: -2, key: "shop", door: true },
      { x: 108, base: 130, w: 11, h: 10, rh: 9, wins: [[4, 3, 2, 2, 0]] },
      { x: 122, base: 129, w: 15, h: 11, rh: 10, wins: [[3, 3, 2, 2, 0.5], [9, 3]], chim: 3, brace: true },
      { x: 140, base: 127, w: 12, h: 10, rh: 9, wins: [[4, 3]] },
    ] },
  ];
  const houseAt = {};
  for (const row of rows) for (const hs of row.list) {
    const r = house(R, { ...hs, z: row.z, d: 6 }, out);
    if (hs.key) houseAt[hs.key] = { ...hs, ...r, z: row.z };
  }
  // 人業の館の尖塔 (細い塔と丸窓)
  { const m = houseAt.mansion; tower(R, m.x + 12, 2.6, m.top - 6, m.base - 4, m.top - 22, { z: m.z + 3 });
    R.ell(m.x + 12, m.top - 2, 1.3, 1.3, { m: MAT.window, z: m.z + 6, em: 0.7 });
    out.windows.push({ x: m.x + 11, y: m.top - 3, w: 2, h: 2, lit: 0.7, ph: 2.2, sp: 0.5 });
    out.spots.mansion = { x: m.x + 8, y: m.top - 8 }; }
  // 酒場「沈まぬ灯」: 腕木の灯
  { const t = houseAt.tavern, lx = t.x + t.w + 3, ly = t.top + 2;
    R.tube(t.x + t.w - 1, ly - 2, lx + 1, ly - 2, 0.5, 0.5, { m: MAT.iron, z: t.z + 4 });
    out.lantern = { x: lx, y: ly + 1 };
    out.spots.tavern = { x: t.x + t.w / 2, y: t.top - 6 }; }
  // 宿屋「白狼」: 白い狼の毛皮の幟
  { const n = houseAt.inn, bx = n.x - 2;
    R.tube(bx, n.top - 1, bx, n.top + 8, 0.45, 0.45, { m: MAT.iron, z: n.z + 4 });
    R.poly([[bx + 0.5, n.top], [bx + 4, n.top + 1], [bx + 4.5, n.top + 7], [bx + 2.5, n.top + 9], [bx + 0.5, n.top + 7]], { m: MAT.fur, z: n.z + 5, n: [-0.3, 0, 1], tex: [1.2, 0.25, 91, 0.4] });
    out.spots.inn = { x: n.x + n.w / 2, y: n.top - 6 }; }
  { const s = houseAt.shop; out.spots.shop = { x: s.x + s.w / 2, y: s.top - 5 };
    R.tube(s.x - 1, s.top + 3, s.x - 4, s.top + 3, 0.4, 0.4, { m: MAT.iron, z: s.z + 4 });
    R.rect(s.x - 5.5, s.top + 4, 3, 3, { m: MAT.iron, z: s.z + 5, n: [-0.2, 0, 1] }); }
  // 城壁と門楼 (家並みの裾を隠す)
  const wz = -14, wallId = R.newId();
  R.rect(78, 132, 66, 14, { m: MAT.stone, z: wz, id: wallId, tex: [0.3, 0.14, 101], bump: [0.45, 0.6, 102], tf: (x, y) => ((y - 132) % 4 === 3 || ((x + ((y - 132) >> 2) * 3) % 7 === 0) ? -0.07 : 0) });
  for (let x = 98; x < 144; x += 4) R.rect(x, 129.5, 2, 2.6, { m: MAT.stone, z: wz, id: wallId });
  R.shadePoly([[78, 132], [144, 132], [144, 134], [78, 134]], 0.4, { id: wallId });
  tower(R, 84, 6, 120, 147, 104, { z: wz + 4 });
  tower(R, 98, 4.5, 124, 146, 112, { z: wz + 3 });
  R.poly(archPts(91, 140, 3, 147, 0.4, 6), { m: MAT.dark, z: wz + 6 });
  R.ell(91, 145, 2, 1.4, { m: MAT.ember, z: wz + 7, em: 0.5 });
  R.point(91, 143, wz + 8, LC.fire, 0.7, 6);
  // 門の松明
  for (const tx of [86.5, 95.5]) { R.rect(tx, 136, 1, 3, { m: MAT.woodD, z: wz + 8 }); out.torches.push({ x: tx + 0.5, y: 135 }); R.point(tx + 0.5, 134, wz + 10, LC.fire, 0.45, 5); }
  // 地面と、迷宮から門へ続く踏み分け道
  const gy = (x) => 146 + 3 * Math.sin(x * 0.04) + (x < 70 ? (70 - x) * 0.06 : 0);
  R.poly([[0, SH], ...Array.from({ length: SW + 1 }, (_, x) => [x, gy(x)]), [SW, SH]], { m: MAT.moss, z: 0,
    n: [0, -0.55, 0.8], bump: [0.4, 0.9, 111, 0.8], tex: [0.15, 0.3, 112, 0.5],
    tf: (x, y) => { const py = 149 + (x - 40) * 0.02 + Math.sin(x * 0.12) * 1.2; return (x > 30 && x < 96 && Math.abs(y - py) < 1.8 + (y - 146) * 0.08 ? 0.06 : 0) - clamp01((y - 146) / 24) * 0.12; } });
  paintCrypt(R, out);
  // 赤い魂の祠 (道端の小さな石の祠)
  { const sx = 72, sb = 152, sid = R.newId();
    R.rect(sx - 4, sb - 9, 8, 9, { m: MAT.stoneD, z: 10, id: sid, tex: [0.5, 0.15, 121], nf: (x) => [x < sx - 2 ? -0.6 : x > sx + 2 ? 0.6 : 0, 0, 0.8] });
    R.poly([[sx - 6, sb - 8.5], [sx, sb - 14], [sx + 6, sb - 8.5]], { m: MAT.slate, z: 11, id: sid, nf: (x) => [x < sx ? -0.6 : 0.6, -0.5, 0.6] });
    R.rect(sx - 2, sb - 7, 4, 4, { m: MAT.dark, z: 11 });
    R.ell(sx, sb - 5, 1.4, 1.5, { m: MAT.soulRed, z: 12, em: 0.85 });
    R.point(sx, sb - 5, 13, LC.red, 0.7, 7);
    out.shrine = { x: sx, y: sb - 5 };
    out.spots.shrine = { x: sx, y: sb - 16 }; }
  // 墓地 (傾いた墓石)
  const gr = rng(131);
  for (let k = 0; k < 16; k++) {
    const x = 4 + gr() * 74, by = gy(x) + 2 + gr() * 14;
    if (x > 18 && x < 60 && by < 152) continue; // 門の前は空ける
    grave(R, x, by, 3 + gr() * 3, 5 + gr() * 6, Math.floor(gr() * 3), 4 + (by - 146), (gr() - 0.5) * 0.5);
  }
  for (const [x, by, w, h, k, t] of [[150, 168, 6, 11, 1, 0.12], [163, 171, 7, 9, 0, -0.18], [228, 170, 8, 14, 2, 0.08], [212, 172, 5, 8, 0, 0.2]]) grave(R, x, by, w, h, k, 30, t);
  // 墓地を囲う錆びた鉄柵 (槍先の柱と横木。ところどころ傾き、折れている)
  { const fz = 30, fy = 163;
    for (let x = 1, k = 0; x < 78; x += 3.4, k++) {
      if (k === 9 || k === 10) continue; // 柵の切れ目 (迷宮へ続く道)
      const lean = (hash(k, 7, 3) - 0.5) * 2.4 + (k > 15 ? 1.6 : 0), top = fy - 11 - (k % 3 === 0 ? 1.5 : 0);
      R.tube(x, fy + 2, x + lean, top, 0.5, 0.5, { m: MAT.iron, z: fz });
      R.poly([[x + lean - 0.9, top + 0.6], [x + lean, top - 2.2], [x + lean + 0.9, top + 0.6]], { m: MAT.iron, z: fz + 1 });
    }
    R.tube(0, fy - 7, 30, fy - 6.4, 0.45, 0.45, { m: MAT.iron, z: fz + 1 });
    R.tube(0, fy - 2, 30, fy - 1.6, 0.45, 0.45, { m: MAT.iron, z: fz + 1 });
    R.tube(38, fy - 6, 78, fy - 8.5, 0.45, 0.45, { m: MAT.iron, z: fz + 1 });
    R.tube(38, fy - 1.5, 78, fy - 3, 0.45, 0.45, { m: MAT.iron, z: fz + 1 }); }
  // 道端の吊り灯の柱 (曲がった鉄の腕に、消えかけた灯)
  { const lx = 58, ly = 154;
    R.tube(lx, ly + 4, lx + 0.6, ly - 20, 0.7, 0.55, { m: MAT.woodD, z: 24 });
    R.path([[lx + 0.6, ly - 19], [lx + 3, ly - 21], [lx + 5.5, ly - 20]], 0.4, 0.4, { m: MAT.iron, z: 25 });
    R.rect(lx + 4.5, ly - 19, 2, 3, { m: MAT.iron, z: 25 });
    R.point(lx + 5.5, ly - 17, 28, LC.candle, 0.5, 6);
    out.torches.push({ x: lx + 5.6, y: ly - 16.5, dim: true }); }
  // 吊るし籠の枯れ木 (籠はアニメで揺らす)
  deadTree(R, 9, SH + 2, 112, 7, { z: 26, bias: 0.12, th: 4.2, depth: 5, lean: 0.08, hook: [12, 92, 30, 86] });
  out.cage = { x: 28, y: 87 };
  // 手前の土と草
  R.poly([[0, SH], [0, 162], ...Array.from({ length: 25 }, (_, i) => [i * 10, 163 + 3 * Math.sin(i * 1.7) + (hash(i, 3, 5) > 0.6 ? -2 : 0)]), [SW, 166], [SW, SH]], { m: MAT.moss, z: 34, n: [0, -0.5, 0.85], bump: [0.6, 1, 141], tex: [0.3, 0.2, 142], tone: -0.08 });

  // 仕上げ: 奥ほど靄に溶かす (空気遠近)
  const haze = hex("#211c38");
  const px = R.render({ outline: [0.45, 0.85], grade: (c, x, y) => {
    const zz = R.z[y * SW + x], f = clamp01((-zz - 25) / 150) * 0.85;
    const v = 1 - 0.45 * sstep(0.5, 1.15, Math.hypot((x / SW - 0.5) * 1.3, (y / SH - 0.42) * 1.1));
    const cc = f <= 0 ? c : mixc(c, haze, f);
    return [cc[0] * v, cc[1] * v, cc[2] * v];
  } });
  return { px, out };
}

// 夜景の下ごしらえは段階に分ける (アイドル時間に一段ずつ片付けられるように)
const SCENE_STAGES = [
  ["land", paintLandPx],
  ["sky", paintSkyPx],
  ["clouds", () => paintCloudsPx(480, 70, 9, 0.48, 3.2)],
  ["clouds2", () => paintCloudsPx(480, 46, 21, 0.5, 2.6)],
  ["fog", () => paintFogPx(480, 26, 31, "#2c2642", 0.75)],
  ["fog2", () => paintFogPx(480, 18, 37, "#3a3352", 0.6)],
  ["column", () => paintColumnPx(34, 128)],
  ["vortex", () => Array.from({ length: 8 }, (_, i) => paintVortexPx(96, 28, (i / 8) * TAU))],
];
const _sceneParts = {};
let _scene = null;
function sceneStep() {
  for (const [k, f] of SCENE_STAGES) if (!(k in _sceneParts)) { _sceneParts[k] = f(); return true; }
  return false;
}
function buildScene() {
  if (_scene) return _scene;
  while (sceneStep());
  const P = _sceneParts;
  _scene = { land: P.land.px, out: P.land.out, sky: P.sky, clouds: P.clouds, clouds2: P.clouds2, fog: P.fog, fog2: P.fog2, column: P.column, vortex: P.vortex };
  return _scene;
}

// 名所の位置 (パノラマに対する割合)。game.js が札を重ねる
export function townSpots() {
  const s = buildScene().out.spots, r = {};
  for (const k in s) r[k] = { x: s[k].x / SW, y: s[k].y / SH };
  return r;
}

export function createTownScene() {
  const c = makeCanvas(SW, SH);
  if (!c) return null;
  c.className = "town-scene";
  if (typeof c.setAttribute === "function") { c.setAttribute("role", "img"); c.setAttribute("aria-label", "辺境の街ロアダルの夜景"); }
  const ctx = c.getContext && c.getContext("2d");
  if (!ctx) return c;
  const S = buildScene(), O = S.out;
  S.skyC = S.skyC || pxCanvas(S.sky, SW, SH);
  S.landC = S.landC || pxCanvas(S.land, SW, SH);
  S.cloudC = S.cloudC || pxCanvas(S.clouds, 480, 70);
  S.cloud2C = S.cloud2C || pxCanvas(S.clouds2, 480, 46);
  S.fogC = S.fogC || pxCanvas(S.fog, 480, 26);
  S.fog2C = S.fog2C || pxCanvas(S.fog2, 480, 18);
  S.colC = S.colC || pxCanvas(S.column, 34, 128);
  S.vorC = S.vorC || S.vortex.map((v) => pxCanvas(v, 96, 28));
  const winRamp = MAT.window.ramp.map(hex), soul = MAT.soul.ramp.map(hex);
  const P = (col, x, y, w = 1, h = 1) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
  const rgb = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
  const wrapDraw = (img, off, y, W) => { const o = ((off % W) + W) % W; ctx.drawImage(img, -o, y); ctx.drawImage(img, W - o, y); };
  const blob = (col, x, y, r, a) => { ctx.globalAlpha = a; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; };
  function draw(ms) {
    const t = ms / 1000;
    ctx.drawImage(S.skyC, 0, 0);
    // 遠い雷光 (およそ 23 秒に一度、雲の奥が二度瞬く)
    const lc = t / 23, lf = lc - Math.floor(lc), flash = lf < 0.012 || (lf > 0.02 && lf < 0.028);
    wrapDraw(S.cloud2C, t * 1.1, 4, 480);
    wrapDraw(S.cloudC, t * 2.2 + 140, 14, 480);
    if (flash) { ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.35; wrapDraw(S.cloudC, t * 2.2 + 140, 14, 480); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; }
    // 魂の渦 (迷宮の真上の空で、ゆっくり回る)
    if (O.crypt) {
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.7 + 0.2 * Math.sin(t * 0.6);
      ctx.drawImage(S.vorC[Math.floor(t * 1.6) % 8], O.crypt.x - 48, O.crypt.y - 108);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
    }
    // 鴉の群れ (およそ 31 秒に一度、空を横切る)
    const bc = t / 31, bf = bc - Math.floor(bc);
    if (bf < 0.4) {
      const p = bf / 0.4, k = Math.floor(bc);
      for (let i = 0; i < 5; i++) {
        const x = -10 + p * 270 - i * 6 - (i % 2) * 3, y = 22 + (k % 3) * 9 + i * 2.2 + Math.sin(t * 3 + i) * 1.5;
        const up = Math.floor(t * 9 + i * 1.7) % 2;
        P("#05040a", x, y, 3, 1);
        P("#05040a", x - 1, y + (up ? -1 : 1)); P("#05040a", x + 3, y + (up ? -1 : 1));
      }
    }
    ctx.drawImage(S.landC, 0, 0);
    // 窓の灯 (ゆっくり揺らぎ、時に陰る)
    for (const w of O.windows) {
      const f = w.lit * (0.82 + 0.12 * Math.sin(t * w.sp + w.ph) + 0.08 * Math.sin(t * w.sp * 3.3 + w.ph * 2));
      const k = Math.min(winRamp.length - 1, Math.round(clamp01(f) * (winRamp.length - 1)));
      P(rgb(winRamp[k]), w.x, w.y, w.w, w.h);
      if (w.h >= 2) P(rgb(winRamp[Math.max(0, k - 2)]), w.x, w.y + w.h - 1, w.w, 1);
    }
    // 酒場の灯「沈まぬ灯」と門の松明
    if (O.lantern) {
      const L = O.lantern, f = 0.85 + 0.15 * Math.sin(t * 7.3) * Math.sin(t * 2.1 + 1);
      blob("#ff9a3a", L.x + 0.5, L.y + 1, 6, 0.16 * f); blob("#ff9a3a", L.x + 0.5, L.y + 1, 3, 0.3 * f);
      P("#140c0a", L.x - 1, L.y - 1, 3, 1); P(f > 0.9 ? "#ffe39a" : "#ffbf52", L.x - 1, L.y, 3, 2); P("#140c0a", L.x - 1, L.y + 2, 3, 1);
    }
    for (const T of O.torches) {
      const f = Math.sin(t * 11 + T.x) * 0.5 + Math.sin(t * 17.3 + T.x * 2) * 0.5;
      if (T.dim && Math.sin(t * 0.7 + 1.3) > 0.93) continue; // 消えかけの灯は時おり瞬いて消える
      blob("#ff8a2a", T.x, T.y, (T.dim ? 3 : 4) + f * 0.6, T.dim ? 0.14 : 0.2);
      P("#ffbf52", T.x - 0.5, T.y - 1, 1, 2); P(f > 0 ? "#fff0b0" : "#f08a26", T.x - 0.5, T.y - 2 + (f > 0.5 ? -1 : 0), 1, 1);
    }
    // 赤い魂の祠 (心臓のように脈打つ)
    if (O.shrine) {
      const S2 = O.shrine, f = 0.65 + 0.35 * Math.pow(Math.max(0, Math.sin(t * 2.4)), 3);
      blob("#e01830", S2.x, S2.y, 7, 0.18 * f); blob("#e01830", S2.x, S2.y, 3, 0.32 * f);
      P(f > 0.85 ? "#ffb89a" : "#ff7a5c", S2.x - 0.5, S2.y - 0.5, 1, 1);
    }
    // 迷宮の口から天へ昇る魂の柱と、渦を巻いて昇る燐光
    if (O.crypt) {
      const C = O.crypt, pu = 0.5 + 0.5 * Math.sin(t * 0.8);
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.46 + 0.14 * Math.sin(t * 0.7) + 0.06 * Math.sin(t * 2.9);
      ctx.drawImage(S.colC, C.x - 17, C.y - 124);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
      blob("#7a5ad8", C.x, C.y + 4, 8, 0.1 + 0.08 * pu);
      for (let i = 0; i < 22; i++) {
        const life = (t * 0.045 + i / 22 + hash(i, 1, 2) * 0.04) % 1;
        const x = C.x + Math.sin(life * 9 + i * 2.1 + t * 0.6) * (1.5 + life * 10);
        const y = C.y + 6 - life * 132, a = Math.sin(Math.PI * Math.min(1, life * 1.15));
        if (a < 0.1) continue;
        ctx.globalAlpha = a * 0.35; P(rgb(soul[3]), x - 1, y, 3, 1); P(rgb(soul[3]), x, y - 1, 1, 3);
        ctx.globalAlpha = Math.min(1, a * 1.2); P(rgb(soul[life < 0.25 ? 4 : a > 0.7 ? 7 : 6]), x, y);
        ctx.globalAlpha = 1;
      }
    }
    // 墓地を漂う鬼火
    for (let i = 0; i < 4; i++) {
      const x = 10 + i * 19 + Math.sin(t * 0.3 + i * 2) * 6, y = 150 + Math.sin(t * 0.5 + i) * 3 + (i % 2) * 6;
      const a = 0.4 + 0.4 * Math.sin(t * 1.3 + i * 1.7);
      if (a < 0.15) continue;
      ctx.globalAlpha = a * 0.3; P(rgb(soul[4]), x - 1, y - 1, 3, 3); ctx.globalAlpha = a; P(rgb(soul[6]), x, y); ctx.globalAlpha = 1;
    }
    // 煙突の煙
    for (const ch of O.chimneys) {
      for (let i = 0; i < 6; i++) {
        const life = (t * 0.09 + i / 6 + ch.seed * 0.013) % 1;
        const x = ch.x + life * 14 + Math.sin(life * 6 + i + ch.seed) * 1.3, y = ch.y - life * 22, a = (1 - life) * 0.45;
        if (a < 0.06) continue;
        const sz = 1 + Math.floor(life * 3.5);
        ctx.globalAlpha = a; P("#4a4462", x - (sz >> 1), y - (sz >> 1), sz, sz); ctx.globalAlpha = 1;
      }
    }
    // 王旗 (深紅)
    if (O.flag) {
      const F = O.flag;
      P("#08060c", F.x, F.y - 4, 1, 5);
      for (let i = 1; i < 8; i++) {
        const dy = Math.round(Math.sin(t * 3.1 - i * 0.8) * 0.9 * (i / 7));
        P(i < 2 ? "#a63a36" : "#6a1820", F.x + i, F.y - 4 + dy, 1, i < 7 ? 2 : 1);
      }
    }
    // 吊るし籠 (骸を閉じ込めた鉄籠が、風にきしんで揺れる)
    if (O.cage) {
      const G = O.cage, ang = Math.sin(t * 0.9) * 0.12 + Math.sin(t * 2.3) * 0.03;
      const cx = Math.round(G.x + Math.sin(ang) * 9), cy = Math.round(G.y + Math.cos(ang) * 9);
      for (let k = 0; k <= 9; k++) P("#0b0910", G.x + (cx - G.x) * k / 9, G.y + (cy - G.y) * k / 9);
      P("#0b0910", cx - 3, cy, 7, 1); P("#0b0910", cx - 2, cy - 1, 5, 1); P("#0b0910", cx - 3, cy + 11, 7, 1);
      for (let k = 0; k < 4; k++) P("#0b0910", cx - 3 + k * 2, cy, 1, 12);
      P("#262030", cx - 2, cy + 3, 1, 1); P("#262030", cx + 1, cy + 2, 2, 2); P("#1a1622", cx, cy + 5, 1, 4); // 骸
      P("#3a3448", cx - 3, cy + 1, 1, 9); // 月光の縁
    }
    // 霧 (地を這う帯が二層、別々の速さで流れる)
    ctx.globalAlpha = 0.85; wrapDraw(S.fogC, t * 3.2, 134, 480);
    ctx.globalAlpha = 0.7; wrapDraw(S.fog2C, -t * 2.1 + 90, 150, 480); ctx.globalAlpha = 1;
  }
  return livingCanvas(c, draw, 15);
}

// 検証用 (ヘッドレスで絵を確かめる): 情景・胸像のコマを全部その場で描いて返す / 夜景の各段の所要時間
export const _townartDebug = {
  vignette(key) { const f = vignetteFrames(key); if (f) for (let i = 0; i < f.length; i++) if (!f[i]) { const R = new Relief(VW, VH); VIGNETTES[key](R, { i, k: VIG_K[i], t: i * 1.05 }); f[i] = pxCanvas(R.render({ bg: () => [4, 3, 7], grade: vignetteGrade(VW, VH, 0.6) }), VW, VH); } return f; },
  keeper(key) { return keeperFrames(key); },
  sceneTimes() { const r = {}; for (const [k, f] of SCENE_STAGES) { const t = nowMs(); f(); r[k] = Math.round(nowMs() - t); } return r; },
};
