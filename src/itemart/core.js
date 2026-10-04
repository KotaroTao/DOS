// 装備の絵の自動生成: 共通の土台 (24×24 の升目・素材の階調・パレットの組み立て・輪郭)
//
// 絵は「素材 (鋼・金・木・革・布・宝石…) × 階調 0-4」を升目に塗ってから、使った色だけで
// パレット (一文字 → 色) を組み立てる。光源は左上。階調は 0 = 深い影 (縁) / 1 = 影 / 2 = 地 / 3 = 明 / 4 = 鏡面。
// 輪郭: 形の右・下に接する空きの升を黒 (k) で縁取る (左上は素材の深い影で締める — 既存の手描きと同じ流儀)。
// 乱数は品の id から作るので、同じ品はいつも同じ絵になる。

export const W = 24, H = 24;

// ---- 色 ----
const hex2 = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const rgb2 = (r, g, b) => "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
export function mix(a, b, t) {
  const A = hex2(a), B = hex2(b);
  return rgb2(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}
// 階調の列を色へ寄せる (明るさは保ったまま色味だけ寄せる)
export function tintRamp(ramp, col, amt) {
  const C = hex2(col);
  const cl = (C[0] * 0.3 + C[1] * 0.59 + C[2] * 0.11) || 1;
  return ramp.map((h) => {
    const A = hex2(h);
    const l = A[0] * 0.3 + A[1] * 0.59 + A[2] * 0.11;
    const k = l / cl;
    const T = [C[0] * k, C[1] * k, C[2] * k];
    return rgb2(A[0] + (T[0] - A[0]) * amt, A[1] + (T[1] - A[1]) * amt, A[2] + (T[2] - A[2]) * amt);
  });
}
// 二色の間を 5 階調で (深い影 → 鏡面)
export function ramp5(deep, mid, spec) {
  return [deep, mix(deep, mid, 0.55), mid, mix(mid, spec, 0.55), spec];
}

// ---- 素材の階調 (0 深い影 / 1 影 / 2 地 / 3 明 / 4 鏡面) ----
// 既存の手描きのパレット (catalog/defs.js の P) に揃えてある
export const MAT = {
  steel: ["#262433", "#4a4a5c", "#7c7d88", "#b5b2ad", "#e9e3d6"],
  iron: ["#211c22", "#3e3a40", "#635d5e", "#8f8780", "#bdb3a4"],
  silver: ["#2c2d3c", "#5b5f74", "#9499aa", "#cfd2da", "#f6f6f2"],
  mithril: ["#1d2a3a", "#3e5a72", "#76a0b8", "#b4d6e2", "#effaff"],
  black: ["#110f16", "#24212c", "#3c3846", "#5e5868", "#8e8698"],
  adamant: ["#1c1530", "#3b2d5c", "#6a5a94", "#a596c8", "#e6defa"],
  gold: ["#2e2016", "#6b5221", "#a88a3e", "#dcc78a", "#f6ecc0"],
  bronze: ["#2a1810", "#5c3a1e", "#9a6634", "#c99a5e", "#ecd2a0"],
  copper: ["#2a120e", "#5e2a1c", "#9c5236", "#cf8a62", "#f2c4a0"],
  wood: ["#1c130f", "#35241a", "#574030", "#7d6449", "#a08766"],
  darkwood: ["#140c0c", "#28181a", "#43292a", "#644240", "#86625a"],
  palewood: ["#2a2016", "#4e3e2a", "#7c6646", "#a8916a", "#cdbb92"],
  leather: ["#241a16", "#4b3628", "#7a5f45", "#a88f70", "#cdb898"],
  darkleather: ["#160f10", "#2e2022", "#4a3434", "#6a5050", "#8c7270"],
  bone: ["#2e2820", "#4a4236", "#8f8670", "#c9c0a6", "#efe8d2"],
  cloth: ["#17161f", "#2c2b3a", "#484a5e", "#6e7088", "#9a9cb0"],
  red: ["#240a0e", "#3a1016", "#7a2028", "#b8564a", "#eaa08a"],
  blue: ["#10162a", "#1a2234", "#34506e", "#7aa0b4", "#c8e2ec"],
  green: ["#0e180e", "#1a2618", "#3e5a34", "#7d9a62", "#c2d8a0"],
  purple: ["#1c1426", "#3b2a4c", "#66507a", "#a08cb0", "#dccce8"],
  amber: ["#2a1606", "#5c3410", "#a06418", "#dca040", "#fbe08a"],
  white: ["#3a3a44", "#6e6e7a", "#a8a8b2", "#dedee4", "#ffffff"],
  teal: ["#0c1c1e", "#163638", "#2e6a68", "#5ea8a0", "#b8eee2"],
  pink: ["#2a1020", "#4e1e38", "#8a4064", "#c47c9c", "#f0c4d6"],
  flesh: ["#2e1a16", "#5a3428", "#a0566a", "#c88a8a", "#ecc0b0"],
  crystal: ["#1a2236", "#34507a", "#6c9ac8", "#b0d8f4", "#f2fcff"],
  ember: ["#2a0c06", "#6a1c0a", "#c04414", "#f08a2a", "#ffe08a"],
  ice: ["#18283a", "#30587a", "#6aa0c8", "#b4e0f4", "#f4ffff"],
  shadow: ["#0c0814", "#1c1428", "#34264a", "#5a4478", "#9a80c0"],
  holy: ["#3a3018", "#7a6a34", "#c8b466", "#f0e4a4", "#fffcec"],
  moss: ["#121a10", "#24321c", "#40522e", "#667a46", "#9aaa70"],
  stone: ["#1e1c20", "#38363c", "#5c5a60", "#86848a", "#b4b2b6"],
  obsidian: ["#08060c", "#16121e", "#2a2236", "#463a58", "#7a6a96"],
};
// 属性 → 染め色 (catalog/defs.js の ELEM_TINT と同じ)
export const ELEM_COL = {
  fire: "#ff6b3a", water: "#4aa3ff", wind: "#5fd08a",
  earth: "#c89a4a", light: "#ffe27a", dark: "#9b6bd0",
};
// 属性 → 宝石・刃の光の素材
export const ELEM_GEM = { fire: "red", water: "blue", wind: "green", earth: "amber", light: "holy", dark: "purple" };
export const ELEM_GLOW = { fire: "ember", water: "ice", wind: "green", earth: "amber", light: "holy", dark: "shadow" };

// ---- 乱数 (id の FNV-1a → mulberry32) ----
export function hashStr(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
export function rng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const r = {
    f: next,
    i: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
    // 重みつき: [[値, 重み], ...]
    wpick: (pairs) => {
      const tot = pairs.reduce((s, p) => s + p[1], 0);
      let x = next() * tot;
      for (const p of pairs) { x -= p[1]; if (x < 0) return p[0]; }
      return pairs[pairs.length - 1][0];
    },
  };
  return r;
}

// ---- 升目 ----
// 各升 = { m: 素材名, t: 階調 } | null。素材は this.mats[名] = 5階調の色 (塗る前に def で登録する)
export class Grid {
  constructor(w = W, h = H) {
    this.w = w; this.h = h;
    this.c = new Array(w * h).fill(null);
    this.mats = {};
    this.noOutline = new Set();
  }
  def(name, ramp) { this.mats[name] = ramp; return name; }
  in(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  get(x, y) { return this.in(x, y) ? this.c[y * this.w + x] : null; }
  set(x, y, m, t) {
    x = Math.round(x); y = Math.round(y);
    if (!this.in(x, y)) return;
    if (m == null) { this.c[y * this.w + x] = null; return; }
    this.c[y * this.w + x] = { m, t: Math.max(0, Math.min(4, Math.round(t))) };
  }
  // 塗られている升だけ階調を足し引き
  shade(x, y, d) {
    const p = this.get(x, y);
    if (p && p.m !== "k") p.t = Math.max(0, Math.min(4, p.t + d));
  }
  // 黒 (輪郭) を直接置く
  ink(x, y) { this.set(x, y, "k", 0); }
  filled(x, y) { return !!this.get(x, y); }
  // 左右反転 (左半分を描いてから写すとき: x < w/2 の升を右へ写す)
  mirrorX(cx2 = this.w - 1) {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const tx = cx2 - x;
      if (tx <= x || !this.in(tx, y)) continue;
      const p = this.get(x, y);
      this.c[y * this.w + tx] = p ? { ...p } : null;
    }
  }
  // 全体を (dx, dy) ずらす
  shift(dx, dy) {
    const n = new Array(this.w * this.h).fill(null);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const p = this.get(x, y);
      if (!p) continue;
      const X = x + dx, Y = y + dy;
      if (this.in(X, Y)) n[Y * this.w + X] = p;
    }
    this.c = n;
  }
  // 塗られた範囲
  bbox() {
    let x0 = this.w, y0 = this.h, x1 = -1, y1 = -1;
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (this.get(x, y)) {
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    return { x0, y0, x1, y1 };
  }
  // 輪郭: 形の右・下に接する空き升を黒に。all = 四方すべて (正面向きの防具など)
  outline(all = false) {
    const add = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.get(x, y)) continue;
      const L = this.get(x - 1, y), U = this.get(x, y - 1), R = this.get(x + 1, y), D = this.get(x, y + 1);
      const real = (p) => p && p.m !== "k";
      if (real(L) || real(U) || (all && (real(R) || real(D)))) add.push([x, y]);
    }
    for (const [x, y] of add) this.ink(x, y);
  }
  // 1升だけ浮いた黒・塗りを掃除 (斜めの段差に出るゴミ)
  tidy() {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const p = this.get(x, y);
      if (!p || p.m !== "k") continue;
      let n = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        const q = this.get(x + dx, y + dy);
        if (q && q.m !== "k") n++;
      }
      if (n === 0) this.set(x, y, null);
    }
  }
  // {palette, art} に書き出す。使った (素材, 階調) に一文字ずつ割り当てる
  toArt() {
    const keys = new Map();
    const palette = { ".": null, k: "#0d0b10" };
    const CH = "abcdefghijlmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&+=?!<>";
    let ci = 0;
    const art = [];
    for (let y = 0; y < this.h; y++) {
      let row = "";
      for (let x = 0; x < this.w; x++) {
        const p = this.get(x, y);
        if (!p) { row += "."; continue; }
        if (p.m === "k") { row += "k"; continue; }
        const ramp = this.mats[p.m];
        if (!ramp) throw new Error("itemart: unknown material " + p.m);
        const col = ramp[p.t];
        let ch = keys.get(col);
        if (!ch) {
          if (ci >= CH.length) throw new Error("itemart: palette overflow");
          ch = CH[ci++];
          keys.set(col, ch);
          palette[ch] = col;
        }
        row += ch;
      }
      art.push(row);
    }
    return { palette, art };
  }
}

// ---- 斜め (左下 → 右上) の座標: 武器の軸 ----
// a = x − y (軸に沿う。柄頭が負・切っ先が正)、p = x + y − 23 (軸に直交。負 = 左上 = 光の側)
// 升目は (a, p) の偶奇がそろう升だけが実在する。軸方向の 1 升 = a が 2 進む
export const diagAP = (x, y) => [x - y, x + y - 23];
export const diagXY = (a, p) => [(a + p + 23) / 2, (p + 23 - a) / 2];
// 斜めの帯を塗る: a ∈ [a0, a1] で p ∈ [lo(a), hi(a)]。tone(a, p, lo, hi) が階調、mat は素材名か関数
export function diagFill(g, a0, a1, lo, hi, mat, tone) {
  a0 = Math.max(Math.ceil(a0), -23); a1 = Math.min(Math.floor(a1), 23);
  for (let a = a0; a <= a1; a++) {
    const L = lo(a), Hh = hi(a);
    // 升目が実在するのは a + p が奇数の升だけ
    let p = Math.ceil(L);
    if (((a + p) & 1) === 0) p++;
    for (; p <= Hh; p += 2) {
      const x = (a + p + 23) / 2, y = (p + 23 - a) / 2;
      if (x < 0 || y < 0 || x >= g.w || y >= g.h) continue;
      const m = typeof mat === "function" ? mat(a, p, L, Hh) : mat;
      if (!m) continue;
      g.set(x, y, m, tone(a, p, L, Hh));
    }
  }
}
// 刃の断面の階調 (光の側の縁 = 深い影 → 明 → 鏡面 → 影)
export function bladeTone(p, lo, hi) {
  const n = hi - lo;
  const i = p - lo;
  if (n <= 0) return 3;
  if (i === 0) return n >= 3 ? 0 : 1;
  if (n === 1) return 2;
  if (n === 2) return i === 1 ? 4 : 1;
  if (n === 3) return [0, 3, 4, 1][i];
  if (n === 4) return [0, 3, 4, 2, 1][i];
  if (n === 5) return [0, 3, 4, 3, 1, 0][i];
  if (n === 6) return [0, 3, 4, 3, 2, 1, 0][i];
  const r = i / n;
  return r < 0.15 ? 0 : r < 0.32 ? 3 : r < 0.48 ? 4 : r < 0.7 ? 3 : r < 0.88 ? 1 : 0;
}
// 丸い棒 (柄・柄の巻き) の断面
export function rodTone(p, lo, hi) {
  const n = hi - lo, i = p - lo;
  if (n <= 0) return 2;
  if (n === 1) return i === 0 ? 3 : 1;
  if (n === 2) return [3, 2, 0][i];
  return i === 0 ? 2 : i === 1 ? 3 : i === n ? 0 : i === n - 1 ? 1 : 2;
}

// ---- 正面の形: 円・楕円・多角形の中を球のように陰影づけ ----
// 中心 (cx, cy)、半径 rx, ry。光は左上
export function sphereTone(x, y, cx, cy, rx, ry, base = 2) {
  const nx = (x - cx) / rx, ny = (y - cy) / ry;
  const l = -(nx * 0.7 + ny * 0.7);
  const d = nx * nx + ny * ny;
  let t = base + l * 1.6;
  if (d > 0.72) t -= 1;
  // 鏡面の小さな点
  if (Math.abs(nx + 0.38) < 0.2 && Math.abs(ny + 0.38) < 0.2) t = 4;
  return Math.max(0, Math.min(4, Math.round(t)));
}
export function fillEllipse(g, cx, cy, rx, ry, mat, toneFn) {
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
    if (nx * nx + ny * ny > 1) continue;
    g.set(x, y, mat, toneFn ? toneFn(x, y) : sphereTone(x + 0.5, y + 0.5, cx, cy, rx, ry));
  }
}
// 多角形の内側判定
export function inPoly(px, py, pts) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
export function fillPoly(g, pts, mat, toneFn) {
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    if (!inPoly(x + 0.5, y + 0.5, pts)) continue;
    g.set(x, y, mat, toneFn ? toneFn(x, y) : 2);
  }
}
// 線分 (太さ 1)
export function line(g, x0, y0, x1, y1, mat, tone) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= n; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / n), y = Math.round(y0 + ((y1 - y0) * i) / n);
    if (mat === "k") g.ink(x, y); else g.set(x, y, mat, typeof tone === "function" ? tone(x, y, i, n) : tone);
  }
}
// 塗られた形の中で「左上が空き」の升を明るく、「右下が空き」の升を暗く (縁の立体感)
export function bevel(g, region, up = 1, down = 1) {
  const sel = [];
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    const p = g.get(x, y);
    if (!p || p.m === "k" || (region && !region(x, y, p))) continue;
    const same = (q) => q && q.m !== "k";
    const ul = !same(g.get(x - 1, y)) || !same(g.get(x, y - 1));
    const dr = !same(g.get(x + 1, y)) || !same(g.get(x, y + 1));
    if (ul && !dr) sel.push([x, y, up]);
    else if (dr && !ul) sel.push([x, y, -down]);
  }
  for (const [x, y, d] of sel) g.shade(x, y, d);
}
