// ===== 盤面の静的な絵: 地下墓地の床と、墓所の蓋石 (手続き生成のドット絵) =====
// 盤面は「1論理px = 1テクセル」の解像度で一度だけ焼き、以後は補間なしで拡大して貼る
// (ゲームの他の絵と同じドットの質感を保ちつつ、光と粒子だけを毎フレーム重ねる)。
// 公開関数:
//   paintCryptFloor(W, H, opt)  … 盤面全体の石床 (+ 骨・蝋燭・血痕・蜘蛛の巣などの小物)
//   paintCryptSlabs(W, H, opt)  … 未踏のマスを覆う墓石の蓋 (彫刻・ひび・苔・欠け)
//   paintCryptWalls(ctx, opt)   … 踏破したマスの境の石壁 (論理解像度のキャンバスへ直接)
// いずれも決定的 (seed が同じなら同じ絵) で、DOM 以外には依存しない。

const TAU = Math.PI * 2;

// ---------- 乱数・ノイズ ----------
export function makeRng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
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
// 毎画素の fbm は重いので、継ぎ目のない fbm の表 (256×256、1単位=16テクセル) を一度だけ作って双線形で引く
const NT = 256, NU = 16, NP = NT / NU;
let _nt = null;
function noiseTable() {
  if (_nt) return _nt;
  _nt = new Float32Array(NT * NT);
  const vp = (x, y, s, P) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const m = (k) => ((k % P) + P) % P;
    const a = hash(m(xi), m(yi), s), b = hash(m(xi + 1), m(yi), s), c = hash(m(xi), m(yi + 1), s), d = hash(m(xi + 1), m(yi + 1), s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  for (let y = 0; y < NT; y++) for (let x = 0; x < NT; x++) {
    const X = x / NU, Y = y / NU;
    _nt[y * NT + x] = vp(X, Y, 1, NP) * 0.58 + vp(X * 2, Y * 2, 8, NP * 2) * 0.28 + vp(X * 4, Y * 4, 14, NP * 4) * 0.14;
  }
  return _nt;
}
function fbm(x, y, s) {
  const t = noiseTable();
  // 種ごとに表の読み出し位置をずらす
  const u = x * NU + ((s * 97) % NT), v = y * NU + ((s * 57) % NT);
  const xi = Math.floor(u), yi = Math.floor(v), xf = u - xi, yf = v - yi;
  const x0 = xi & (NT - 1), y0 = yi & (NT - 1), x1 = (x0 + 1) & (NT - 1), y1 = (y0 + 1) & (NT - 1);
  const a = t[y0 * NT + x0], b = t[y0 * NT + x1], c = t[y1 * NT + x0], d = t[y1 * NT + x1];
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
}
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
// 盤面の構造 (壁の並び) から決定的な種を作る。セーブ形式に手を入れずに、再開後も同じ絵になる
export function boardSeed(board, salt = 0) {
  let h = 2166136261 ^ salt;
  for (const row of board.cells) for (const c of row) {
    const w = (c.walls.n ? 1 : 0) | (c.walls.e ? 2 : 0) | (c.walls.s ? 4 : 0) | (c.walls.w ? 8 : 0);
    h = Math.imul(h ^ w, 16777619);
  }
  return (h ^ ((board.floor || 1) * 2654435761)) >>> 0;
}

// ---------- 論理解像度のラスタ ----------
class Raster {
  constructor(w, h) { this.w = w; this.h = h; this.d = new Uint8ClampedArray(w * h * 4); }
  // 不透明で塗る
  put(x, y, c) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = ((y | 0) * this.w + (x | 0)) * 4, d = this.d;
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
  }
  // 半透明で重ねる (下が透明ならそのまま置く)
  over(x, y, c, a) {
    if (a <= 0 || x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = ((y | 0) * this.w + (x | 0)) * 4, d = this.d;
    if (d[i + 3] === 0) { d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = Math.round(clamp(a, 0, 1) * 255); return; }
    const k = clamp(a, 0, 1);
    d[i] += (c[0] - d[i]) * k; d[i + 1] += (c[1] - d[i + 1]) * k; d[i + 2] += (c[2] - d[i + 2]) * k;
    if (d[i + 3] < 255) d[i + 3] = Math.min(255, d[i + 3] + k * 255);
  }
  // 明度を掛ける (影・照り)
  mul(x, y, k) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = ((y | 0) * this.w + (x | 0)) * 4, d = this.d;
    if (d[i + 3] === 0) return;
    d[i] *= k; d[i + 1] *= k; d[i + 2] *= k;
  }
  // 色味を寄せる
  tint(x, y, c, k) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = ((y | 0) * this.w + (x | 0)) * 4, d = this.d;
    if (d[i + 3] === 0) return;
    d[i] += (c[0] - d[i]) * k; d[i + 1] += (c[1] - d[i + 1]) * k; d[i + 2] += (c[2] - d[i + 2]) * k;
  }
  alpha(x, y) { if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0; return this.d[((y | 0) * this.w + (x | 0)) * 4 + 3]; }
  clear(x, y) { if (x < 0 || y < 0 || x >= this.w || y >= this.h) return; this.d[((y | 0) * this.w + (x | 0)) * 4 + 3] = 0; }
  toCanvas() {
    const c = document.createElement("canvas");
    c.width = this.w; c.height = this.h;
    const g = c.getContext("2d");
    g.putImageData(new ImageData(this.d, this.w, this.h), 0, 0);
    return c;
  }
}

// ---------- 形 (マスク) を陰影つきで置く ----------
// mask(x,y) が真の画素を、左上=照り / 右下=陰 / 外周=輪郭 で塗る (光源は左上)
function stampMask(R, x0, y0, w, h, mask, pal, opt = {}) {
  const inM = (x, y) => x >= 0 && y >= 0 && x < w && y < h && mask(x, y);
  const outlineA = opt.outlineA == null ? 0.9 : opt.outlineA;
  for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) {
    const X = x0 + x, Y = y0 + y;
    if (inM(x, y)) {
      const up = inM(x, y - 1), lf = inM(x - 1, y), dn = inM(x, y + 1), rt = inM(x + 1, y);
      let c = pal.mid;
      if (!up || !lf) c = pal.hi;
      if (!dn || !rt) c = pal.lo;
      if ((!up && !dn) || (!lf && !rt)) c = pal.mid;
      R.over(X, Y, c, opt.a == null ? 1 : opt.a);
    } else if (pal.o && (inM(x - 1, y) || inM(x + 1, y) || inM(x, y - 1) || inM(x, y + 1))) {
      R.over(X, Y, pal.o, outlineA * (opt.a == null ? 1 : opt.a));
    }
  }
  // 落ち影 (右下へ1px)
  if (opt.shadow) {
    for (let y = 0; y <= h; y++) for (let x = 0; x <= w; x++) {
      if (!inM(x, y) && !inM(x - 1, y) && !inM(x, y - 1) && inM(x - 1, y - 1)) R.mul(x0 + x, y0 + y, 0.72);
    }
  }
}
// 文字列のドット絵を置く
function stampSprite(R, x0, y0, rows, pal, flip = false, a = 1) {
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[flip ? row.length - 1 - x : x];
      if (ch === "." || ch === " ") continue;
      const c = pal[ch];
      if (!c) continue;
      if (c.length === 4) R.over(x0 + x, y0 + y, c, c[3] * a);
      else R.over(x0 + x, y0 + y, c, a);
    }
  }
}
// 線分からの距離
function segDist(px, py, x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy || 1;
  const t = clamp(((px - x0) * dx + (py - y0) * dy) / l2, 0, 1);
  const qx = x0 + dx * t - px, qy = y0 + dy * t - py;
  return Math.sqrt(qx * qx + qy * qy);
}

// ---------- 色 ----------
const BONE = { o: [20, 16, 12], hi: [222, 212, 184], mid: [176, 164, 134], lo: [112, 100, 78] };
const BONE_OLD = { o: [20, 16, 12], hi: [190, 178, 146], mid: [146, 134, 106], lo: [94, 84, 64] };
const RUST = { o: [16, 10, 8], hi: [150, 92, 54], mid: [96, 58, 36], lo: [52, 32, 22] };
const IRON = { o: [10, 9, 10], hi: [112, 108, 106], mid: [64, 62, 64], lo: [34, 32, 34] };
const WAX = { o: [40, 32, 22], hi: [240, 230, 196], mid: [212, 196, 152], lo: [150, 132, 96] };
const PEBBLE = { o: [16, 14, 12], hi: [124, 116, 102], mid: [88, 82, 72], lo: [54, 50, 44] };
const SHARD = { o: [18, 10, 6], hi: [150, 92, 60], mid: [112, 64, 40], lo: [66, 36, 22] };

// 頭蓋骨 (斜め上から)。W=骨 B=陰 b=深い陰 k=眼窩 o=輪郭
const SKULL = [
  "...ooooo...",
  "..oWWWWWo..",
  ".oWWWWWWBo.",
  "oWWWWWWWWBo",
  "oWkkkWkkkBo",
  "oWkkkWkkkbo",
  "oBWWWkWWBbo",
  ".oBWkkkWbo.",
  "..oBWBWBo..",
  "..oWoWoWo..",
  "...ooooo...",
];
const SKULL_SIDE = [
  "...oooo....",
  "..oWWWWoo..",
  ".oWWWWWWBo.",
  "oWWWWWWWBbo",
  "oWWWWkkkBbo",
  "oBWWWkkkbo.",
  ".oBWWWWBWo.",
  "..oBBBoBWo.",
  "...oWoWoBo.",
  "....ooooo..",
];
const SKULL_PAL = { o: [18, 14, 10], W: [214, 204, 176], B: [150, 138, 110], b: [96, 86, 66], k: [14, 10, 8] };
// 錆びた鉄の引き輪 (蓋石に打ち込まれた把手)
const RING = [
  "..ooooo..",
  ".oRRrrro.",
  "oRo...oro",
  "oro...oro",
  "oro...oro",
  ".orrrrdo.",
  "..odddo..",
  "...oxo...",
  "..oxxxo..",
  "...ooo...",
];
const RING_PAL = { o: [10, 8, 8], R: [156, 96, 58], r: [98, 60, 38], d: [54, 34, 24], x: [40, 38, 40] };

// ===== 床 (石畳) =====
// opt: { seed, cols, rows, rect(x,y)->{x,y,w,h}, cells, mat, elite }
// mat: { floor:[r,g,b], mortar:[r,g,b], moss:[..], mossHi:[..], blood:bool(既定true), props:bool }
// 戻り値: { canvas, candles:[{x,y,cx,cy}] }  (蝋燭の炎は毎フレーム描くので位置だけ返す)
export function paintCryptFloor(W, H, opt) {
  const R = new Raster(W, H);
  const rnd = makeRng(opt.seed);
  const mat = opt.mat;
  const base = mat.floor, mortar = mat.mortar;
  const c00 = opt.rect(0, 0);
  const rowH = clamp(Math.round(c00.h / 3), 14, 30);
  const s1 = (opt.seed % 997) + 3, s2 = s1 + 101, s3 = s1 + 211;
  // 行ごとの石の区切り (高さも幅も不揃いな敷石)。石ごとに上端を少し揺らして格子に見せない
  const rows = [];
  for (let y = -Math.floor(rnd() * rowH); y < H; ) {
    const hh = Math.max(9, Math.round(rowH * (0.7 + rnd() * 0.6)));
    const xs = [];
    let x = -Math.floor(rnd() * 30);
    while (x < W) { xs.push(x); x += 15 + Math.floor(rnd() * 30); }
    xs.push(x);
    const stones = [];
    for (let i = 0; i < xs.length - 1; i++) {
      stones.push({ k: 0.84 + rnd() * 0.24, warm: rnd() * 0.08 - 0.03, sunk: rnd() < 0.09, cracked: rnd() < 0.24, dy: rnd() < 0.4 ? 1 : 0 });
    }
    rows.push({ y, h: hh, xs, stones });
    y += hh;
  }
  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri];
    const yEnd = Math.min(H, row.y + row.h);
    for (let y = Math.max(0, row.y); y < yEnd; y++) {
      const ly = y - row.y;
      let si = 0;
      for (let x = 0; x < W; x++) {
        while (si < row.xs.length - 2 && x >= row.xs[si + 1]) si++;
        const x0 = row.xs[si], sw = row.xs[si + 1] - x0, st = row.stones[si];
        const lx = x - x0;
        const top = st.dy; // 上端の段差
        if (lx === 0 || ly <= top) {
          // 目地: 土や苔が詰まって濃淡がある
          const m = 0.7 + fbm(x * 0.3, y * 0.3, s2) * 0.9;
          R.put(x, y, [mortar[0] * m, mortar[1] * m, mortar[2] * m]);
          continue;
        }
        let k = st.k * (0.78 + 0.44 * fbm(x * 0.06, y * 0.06, s1)) * (0.88 + 0.24 * hash(x, y, s2));
        if (ly === top + 1 || lx === 1) k *= 1.1;
        else if (ly === row.h - 1 || lx === sw - 1) k *= 0.8;
        if (ly === top + 2 || lx === 2) k *= 1.03;
        if (st.sunk) k *= 0.82;
        // 湿り・煤・土埃 (大きな斑で石畳の格子を崩す)
        const dmp = fbm(x * 0.02, y * 0.02, s3);
        k *= 1.1 - dmp * 0.46;
        const dirt = fbm(x * 0.11, y * 0.11, s3 + 5);
        if (dirt > 0.58) k *= 1 - (dirt - 0.58) * 1.0;
        // 斑点
        const sp = hash(x * 3 + 1, y * 7 + 2, s1);
        if (sp > 0.985) k *= 1.25; else if (sp < 0.014) k *= 0.6;
        R.put(x, y, [base[0] * k * (1 + st.warm), base[1] * k, base[2] * k * (1 - st.warm)]);
      }
    }
    // 石のひび
    for (let i = 0; i < row.stones.length; i++) {
      const st = row.stones[i];
      if (!st.cracked) continue;
      const x0 = row.xs[i], sw = row.xs[i + 1] - x0;
      let cx = x0 + 2 + rnd() * (sw - 4), cy = row.y + 2 + rnd() * (row.h - 4);
      let a = rnd() * TAU;
      const n = 5 + Math.floor(rnd() * 10);
      for (let j = 0; j < n; j++) {
        if (cx > x0 + 1 && cx < x0 + sw - 1 && cy > row.y + 1 && cy < row.y + row.h - 1) {
          R.mul(Math.round(cx), Math.round(cy), 0.5);
          R.mul(Math.round(cx) + 1, Math.round(cy) + 1, 1.12);
        }
        a += (rnd() - 0.5) * 1.2;
        cx += Math.cos(a); cy += Math.sin(a);
      }
    }
  }

  const candles = [];
  const cells = opt.cells;
  const rect = opt.rect;
  // 壁際の煤と苔 (壁のある辺に沿って暗く湿らせる)
  for (let cy = 0; cy < opt.rows; cy++) for (let cx = 0; cx < opt.cols; cx++) {
    const c = cells[cy][cx], r = rect(cx, cy);
    const band = 6;
    for (const d of ["n", "e", "s", "w"]) {
      if (!c.walls[d]) continue;
      for (let i = 0; i < band; i++) {
        const k = 0.55 + 0.45 * (i / band);
        const len = d === "n" || d === "s" ? r.w + 4 : r.h + 4;
        for (let j = -2; j < len - 2; j++) {
          const X = d === "n" || d === "s" ? r.x + j : d === "w" ? r.x + i : r.x + r.w - 1 - i;
          const Y = d === "e" || d === "w" ? r.y + j : d === "n" ? r.y + i : r.y + r.h - 1 - i;
          R.mul(X, Y, k + (1 - k) * 0.4 * hash(X, Y, s3));
          const mz = fbm(X * 0.3, Y * 0.3, s2 + 9);
          if (mz > 0.5 + i * 0.05) R.tint(X, Y, mz > 0.66 ? mat.mossHi : mat.moss, 0.55);
        }
      }
    }
  }

  // ---- 小物 (骨・頭蓋・蝋燭・血痕・瓦礫・蜘蛛の巣・排水格子・床墓) ----
  if (mat.props !== false) {
    for (let cy = 0; cy < opt.rows; cy++) for (let cx = 0; cx < opt.cols; cx++) {
      const c = cells[cy][cx], r = rect(cx, cy);
      const cr = makeRng(opt.seed ^ Math.imul(cx + 1, 73856093) ^ Math.imul(cy + 1, 19349663));
      const busy = c.type !== "empty" && c.type !== "start"; // 中央にアイコンが載るマスは小物を隅へ寄せる
      // 置き場所: busy なら外周の帯、そうでなければ全域
      const spot = (m = 6) => {
        for (let t = 0; t < 12; t++) {
          const x = r.x + m + cr() * (r.w - m * 2), y = r.y + m + cr() * (r.h - m * 2);
          if (busy) {
            const nx = Math.abs(x - (r.x + r.w / 2)) / (r.w / 2), ny = Math.abs(y - (r.y + r.h / 2)) / (r.h / 2);
            if (nx < 0.55 && ny < 0.6) continue;
          }
          return [Math.round(x), Math.round(y)];
        }
        return [Math.round(r.x + m), Math.round(r.y + r.h - m)];
      };
      // 内角の蜘蛛の巣 (2辺の壁が交わる角)
      const corners = [["n", "w", r.x + 1, r.y + 1, 1, 1], ["n", "e", r.x + r.w - 2, r.y + 1, -1, 1], ["s", "w", r.x + 1, r.y + r.h - 2, 1, -1], ["s", "e", r.x + r.w - 2, r.y + r.h - 2, -1, -1]];
      for (const [a, b, x, y, sx, sy] of corners) {
        if (c.walls[a] && c.walls[b] && cr() < 0.5) cobweb(R, x, y, sx, sy, 7 + Math.floor(cr() * 7), cr);
      }
      if (c.type === "start") {
        // 入口: 先人の残した蝋燭の列と、擦り減った敷居
        for (let i = 0; i < 2; i++) { const [x, y] = [r.x + 7 + i * (r.w - 16), r.y + r.h - 9]; candleCluster(R, x, y, cr, candles, cx, cy); }
        continue;
      }
      if (c.type === "poison") {
        // 毒の床: 腐った汚泥の染み (泡と瘴気は毎フレーム描く)
        poisonStain(R, r, cr, s1);
        continue;
      }
      const roll = cr();
      if (roll < 0.13 && !busy) floorTomb(R, r, cr);
      else if (roll < 0.17 && !busy) drainGrate(R, r.x + Math.round(r.w / 2) - 5, r.y + Math.round(r.h / 2) - 5);
      if (cr() < (busy ? 0.12 : 0.24)) { const n = 1 + Math.floor(cr() * 2); for (let i = 0; i < n; i++) { const [x, y] = spot(); bone(R, x, y, cr); } }
      if (cr() < (busy ? 0.08 : 0.16)) { const [x, y] = spot(7); stampSprite(R, x - 4, y - 4, cr() < 0.5 ? SKULL : SKULL_SIDE, SKULL_PAL, cr() < 0.5); }
      if (cr() < (busy ? 0.03 : 0.07)) { const [x, y] = spot(10); ribcage(R, x, y, cr); }
      if (cr() < 0.17) { const [x, y] = spot(6); candleCluster(R, x, y, cr, candles, cx, cy); }
      if (mat.blood !== false && cr() < (opt.elite ? 0.4 : 0.14)) { const [x, y] = spot(6); bloodStain(R, x, y, cr, opt.elite ? 1.4 : 1); }
      if (cr() < 0.35) { const n = 2 + Math.floor(cr() * 4); for (let i = 0; i < n; i++) { const [x, y] = spot(3); pebble(R, x, y, cr); } }
      if (cr() < 0.06) { const [x, y] = spot(6); urnShards(R, x, y, cr); }
      if (c.type === "corpse") { const [x, y] = [r.x + Math.round(r.w / 2), r.y + Math.round(r.h * 0.62)]; bloodStain(R, x, y, cr, 1.1); }
    }
  }
  return { canvas: R.toCanvas(), candles };
}

function cobweb(R, x, y, sx, sy, n, rnd) {
  const col = [196, 196, 186];
  // 放射状の糸
  const spokes = 4;
  for (let i = 0; i <= spokes; i++) {
    const a = (i / spokes) * (Math.PI / 2);
    const dx = Math.cos(a) * sx, dy = Math.sin(a) * sy;
    for (let t = 0; t < n; t++) R.over(Math.round(x + dx * t), Math.round(y + dy * t), col, 0.28 - t * 0.012);
  }
  // 同心の糸 (たるんだ弧)
  for (let ring = 3; ring < n; ring += 3) {
    for (let i = 0; i <= 12; i++) {
      const a = (i / 12) * (Math.PI / 2);
      const sag = 1 - 0.12 * Math.sin(a * 2);
      R.over(Math.round(x + Math.cos(a) * ring * sag * sx), Math.round(y + Math.sin(a) * ring * sag * sy), col, 0.22);
    }
  }
  if (rnd() < 0.4) R.over(Math.round(x + sx * n * 0.5), Math.round(y + sy * n * 0.4), [40, 36, 30], 0.9); // 干からびた虫
}
function bone(R, x, y, rnd) {
  const len = 7 + Math.floor(rnd() * 7), a = rnd() * Math.PI;
  const x0 = x - Math.cos(a) * len / 2, y0 = y - Math.sin(a) * len / 2, x1 = x + Math.cos(a) * len / 2, y1 = y + Math.sin(a) * len / 2;
  const bx = Math.floor(Math.min(x0, x1)) - 3, by = Math.floor(Math.min(y0, y1)) - 3;
  const bw = Math.ceil(Math.abs(x1 - x0)) + 7, bh = Math.ceil(Math.abs(y1 - y0)) + 7;
  const thick = 0.9 + rnd() * 0.35;
  stampMask(R, bx, by, bw, bh, (px, py) => {
    const X = bx + px + 0.5, Y = by + py + 0.5;
    if (segDist(X, Y, x0, y0, x1, y1) <= thick) return true;
    return Math.hypot(X - x0, Y - y0) <= 1.8 || Math.hypot(X - x1, Y - y1) <= 1.8;
  }, rnd() < 0.5 ? BONE : BONE_OLD, { shadow: true });
}
function ribcage(R, x, y, rnd) {
  const flip = rnd() < 0.5 ? 1 : -1;
  // 背骨
  for (let i = -6; i <= 6; i++) { R.over(x + i, y, BONE_OLD.mid, 1); R.over(x + i, y + 1, BONE_OLD.lo, 1); if (i % 2 === 0) R.over(x + i, y - 1, BONE_OLD.hi, 1); }
  // 肋骨 (弧)
  for (let k = -4; k <= 4; k += 2) {
    for (let t = 0; t <= 6; t++) {
      const yy = y + 2 + t * 0.9, xx = x + k + Math.sin(t * 0.45) * 2.4 * flip;
      R.over(Math.round(xx), Math.round(yy), t < 2 ? BONE.hi : BONE.mid, 1);
      R.over(Math.round(xx) + 1, Math.round(yy), [30, 24, 18], 0.6);
      const yu = y - 2 - t * 0.9;
      R.over(Math.round(xx), Math.round(yu), t < 2 ? BONE.mid : BONE.lo, 0.9);
    }
  }
}
function candleCluster(R, x, y, rnd, candles, cx, cy) {
  // 溶けた蝋の溜まり
  const pw = 5 + Math.floor(rnd() * 4), ph = 2 + Math.floor(rnd() * 2);
  for (let j = -ph; j <= ph; j++) for (let i = -pw; i <= pw; i++) {
    if ((i * i) / (pw * pw) + (j * j) / (ph * ph) > 1) continue;
    R.over(x + i, y + j, j < 0 ? WAX.mid : WAX.lo, 0.92);
  }
  const n = 1 + Math.floor(rnd() * 3);
  const offs = [[0, 0], [-3, 1], [3, 1]];
  for (let k = 0; k < n; k++) {
    const [ox, oy] = offs[k];
    const h = 3 + Math.floor(rnd() * 6) - k, w = k === 0 ? 3 : 2;
    const x0 = x + ox - Math.floor(w / 2), yb = y + oy;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const c = i === 0 ? WAX.hi : i === w - 1 ? WAX.lo : WAX.mid;
      R.put(x0 + i, yb - j, c);
    }
    // 垂れた蝋
    if (rnd() < 0.6) { const dx = rnd() < 0.5 ? -1 : w; for (let j = 0; j < 2 + rnd() * 2; j++) R.over(x0 + dx, yb - h + 2 + j, WAX.mid, 0.9); }
    R.put(x0 + Math.floor(w / 2), yb - h, [24, 18, 14]); // 芯
    candles.push({ x: x0 + w / 2, y: yb - h - 0.5, cx, cy, h });
  }
}
function bloodStain(R, x, y, rnd, amt = 1) {
  const dark = [44, 6, 5], fresh = [78, 10, 8];
  // 乾いて黒ずんだ溜まり (外縁ほど薄い)
  const rr = (4 + rnd() * 4) * amt, sx = 1 + rnd() * 0.6;
  for (let j = -Math.ceil(rr); j <= Math.ceil(rr); j++) for (let i = -Math.ceil(rr * sx); i <= Math.ceil(rr * sx); i++) {
    const d = Math.hypot(i / sx, j) / rr + (fbm((x + i) * 0.4, (y + j) * 0.4, 77) - 0.5) * 0.7;
    if (d > 1) continue;
    R.over(x + i, y + j, d < 0.45 ? fresh : dark, 0.62 * (1.15 - d * 0.5));
  }
  // 飛沫
  for (let i = 0; i < 7 * amt; i++) {
    const a = rnd() * TAU, d = rr + 1 + rnd() * 7 * amt;
    R.over(Math.round(x + Math.cos(a) * d * sx), Math.round(y + Math.sin(a) * d), dark, 0.55);
  }
  // 引きずった跡
  if (rnd() < 0.35 * amt) {
    const a = rnd() * TAU, L = 8 + rnd() * 12;
    for (let t = 0; t < L; t++) for (let w = -1; w <= 1; w++) {
      if (hash(t, w, x) < 0.25) continue;
      R.over(Math.round(x + Math.cos(a) * t - Math.sin(a) * w), Math.round(y + Math.sin(a) * t + Math.cos(a) * w), dark, 0.4 * (1 - t / L));
    }
  }
}
function pebble(R, x, y, rnd) {
  const r = 0.8 + rnd() * 1.3;
  const s = Math.ceil(r) * 2 + 1;
  stampMask(R, x - Math.ceil(r), y - Math.ceil(r), s, s, (px, py) => Math.hypot(px - s / 2 + 0.5, (py - s / 2 + 0.5) * 1.2) <= r, PEBBLE, { shadow: true, outlineA: 0.6 });
}
function urnShards(R, x, y, rnd) {
  for (let i = 0; i < 4; i++) {
    const sx = x + Math.round((rnd() - 0.5) * 10), sy = y + Math.round((rnd() - 0.5) * 6);
    const w = 2 + Math.floor(rnd() * 3), h = 1 + Math.floor(rnd() * 2);
    stampMask(R, sx, sy, w, h + 1, (px, py) => py <= h && !(py === 0 && px === 0), SHARD, { shadow: true, outlineA: 0.7 });
  }
}
function drainGrate(R, x, y) {
  for (let j = 0; j < 11; j++) for (let i = 0; i < 11; i++) {
    const edge = i === 0 || j === 0 || i === 10 || j === 10;
    if (edge) R.put(x + i, y + j, i === 0 || j === 0 ? IRON.mid : IRON.lo);
    else if (i % 3 === 1) R.put(x + i, y + j, j === 1 ? IRON.hi : IRON.mid);
    else R.put(x + i, y + j, [6, 5, 5]);
  }
  for (let i = 0; i < 12; i++) R.mul(x + i, y + 11, 0.6);
  // 錆の滲み
  for (let i = 0; i < 9; i++) R.over(x + 1 + Math.floor(hash(i, x, y) * 9), y + 11 + Math.floor(hash(y, i, x) * 2), RUST.mid, 0.5);
}
// 床に埋め込まれた墓 (碑文の刻まれた敷石)
function floorTomb(R, r, rnd) {
  const w = Math.min(r.w - 14, 26), h = Math.min(r.h - 18, 34);
  if (w < 12 || h < 16) return;
  const x0 = Math.round(r.x + (r.w - w) / 2 + (rnd() - 0.5) * 4), y0 = Math.round(r.y + (r.h - h) / 2 + (rnd() - 0.5) * 6);
  const groove = new Set();
  const add = (x, y) => groove.add((x << 16) | (y & 0xffff));
  for (let i = 0; i < w; i++) { add(x0 + i, y0); add(x0 + i, y0 + h - 1); }
  for (let j = 0; j < h; j++) { add(x0, y0 + j); add(x0 + w - 1, y0 + j); }
  // 小さな十字と銘の刻み
  const cx = x0 + Math.floor(w / 2);
  for (let j = 4; j < 11; j++) add(cx, y0 + j);
  for (let i = -2; i <= 2; i++) add(cx + i, y0 + 6);
  for (let line = 0; line < 3; line++) {
    const yy = y0 + 14 + line * 4;
    if (yy > y0 + h - 4) break;
    for (let x = x0 + 4; x < x0 + w - 4; x++) if (hash(x, yy, line) > 0.45) add(x, yy);
  }
  engrave(R, groove, 0.55);
}
// 毒の汚泥の染み
function poisonStain(R, r, rnd, s) {
  const cx = r.x + r.w / 2, cy = r.y + r.h * 0.55, rx = r.w * 0.38, ry = r.h * 0.3;
  for (let y = Math.floor(cy - ry - 3); y <= cy + ry + 3; y++) for (let x = Math.floor(cx - rx - 3); x <= cx + rx + 3; x++) {
    const d = Math.hypot((x - cx) / rx, (y - cy) / ry) + (fbm(x * 0.2, y * 0.2, s + 31) - 0.5) * 0.6;
    if (d > 1.1) continue;
    if (d > 1.0) R.tint(x, y, [26, 34, 12], 0.55);           // 腐食した縁
    else if (d > 0.88) R.tint(x, y, [96, 128, 30], 0.6);     // 汚泥の縁の照り
    else R.tint(x, y, d < 0.45 ? [66, 104, 22] : [48, 78, 18], 0.85);
    if (d < 0.85 && hash(x, y, s + 3) > 0.93) R.tint(x, y, [150, 200, 70], 0.6); // 泡の痕
  }
}

// 溝 (彫り) を刻む: 溝の画素を暗く、溝の右下の縁を照らし、左上の縁に影を落とす
function engrave(R, set, depth = 0.5, glow = null) {
  const has = (x, y) => set.has((x << 16) | (y & 0xffff));
  for (const v of set) {
    const x = v >> 16, y = (v << 16) >> 16;
    if (R.alpha(x, y) === 0) continue;
    R.mul(x, y, depth);
    if (glow) R.tint(x, y, glow.c, glow.k);
    if (!has(x + 1, y + 1) && !has(x, y + 1) && R.alpha(x + 1, y + 1)) R.mul(x + 1, y + 1, 1.14);
    if (!has(x - 1, y) && !has(x, y - 1) && !has(x - 1, y - 1)) R.mul(x - 1, y - 1, 0.86);
  }
}
// 浮き彫り: 形の上辺/左辺を照らし、下辺/右辺を陰に、外の右下へ落ち影
function relief(R, set, lift = 1.08) {
  const has = (x, y) => set.has((x << 16) | (y & 0xffff));
  for (const v of set) {
    const x = v >> 16, y = (v << 16) >> 16;
    if (R.alpha(x, y) === 0) continue;
    let k = lift;
    if (!has(x, y - 1) || !has(x - 1, y)) k *= 1.32;
    if (!has(x, y + 1) || !has(x + 1, y)) k *= 0.6;
    R.mul(x, y, k);
    if (!has(x + 1, y + 1) && R.alpha(x + 1, y + 1)) R.mul(x + 1, y + 1, 0.62);
    if (!has(x + 1, y + 2) && !has(x, y + 1) && R.alpha(x + 1, y + 2)) R.mul(x + 1, y + 2, 0.82);
  }
}

// ===== 墓石の蓋 (未踏マス) =====
// opt: { seed, cols, rows, rect, cells, mat:{slab, slabB, moss, mossHi, lichen}, elite, accent([r,g,b]|null), skip:Set("x,y") }
export function paintCryptSlabs(W, H, opt) {
  const R = new Raster(W, H);
  const mat = opt.mat;
  for (let cy = 0; cy < opt.rows; cy++) for (let cx = 0; cx < opt.cols; cx++) {
    const r = opt.rect(cx, cy);
    const rnd = makeRng((opt.seed * 31) ^ Math.imul(cx + 3, 2654435761) ^ Math.imul(cy + 7, 40503));
    paintSlab(R, r.x, r.y, r.w, r.h, rnd, mat, opt, cx, cy);
  }
  return R.toCanvas();
}

const MOTIFS = [["cross", 20], ["celtic", 13], ["skull", 12], ["gisant", 15], ["script", 13], ["hourglass", 9], ["ring", 9], ["broken", 9]];
function pickMotif(rnd, tall) {
  let tot = 0;
  for (const [k, w] of MOTIFS) if (tall || k !== "gisant") tot += w;
  let r = rnd() * tot;
  for (const [k, w] of MOTIFS) { if (!tall && k === "gisant") continue; r -= w; if (r <= 0) return k; }
  return "cross";
}

function paintSlab(R, x0, y0, w, h, rnd, mat, opt, gx, gy) {
  const seed = Math.floor(rnd() * 1e6);
  // 角の欠け (左上/右上/左下/右下) と縁の不揃い
  const chip = [rnd() < 0.5 ? 0 : 1 + Math.floor(rnd() * 3), rnd() < 0.5 ? 0 : 1 + Math.floor(rnd() * 3), rnd() < 0.6 ? 0 : 1 + Math.floor(rnd() * 4), rnd() < 0.5 ? 0 : 1 + Math.floor(rnd() * 3)];
  const bigChip = rnd() < 0.12 ? Math.floor(rnd() * 4) : -1; // 大きく欠けた角
  const inside = (lx, ly) => {
    const dr = w - 1 - lx, db = h - 1 - ly;
    if (lx + ly < chip[0] || dr + ly < chip[1] || lx + db < chip[2] || dr + db < chip[3]) return false;
    if (bigChip >= 0) {
      const [ax, ay] = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]][bigChip];
      const d = Math.abs(lx - ax) + Math.abs(ly - ay) * 0.8 + (hash(lx, ly, seed) - 0.5) * 2.5;
      if (d < 8) return false;
    }
    // 縁の細かな欠け
    const edge = Math.min(lx, ly, dr, db);
    if (edge === 0 && hash(lx * 5 + 1, ly * 3 + 2, seed) < 0.12) return false;
    return true;
  };
  const tint = rnd();
  const lum = 0.86 + rnd() * 0.24;
  const sb = mix(mat.slab, mat.slabB, tint * 0.9).map((v) => v * lum);
  const warm = (rnd() - 0.5) * 0.08;
  const mossAmt = 0.15 + rnd() * 0.55;
  const s1 = seed % 911 + 5;
  for (let ly = 0; ly < h; ly++) for (let lx = 0; lx < w; lx++) {
    if (!inside(lx, ly)) continue;
    const X = x0 + lx, Y = y0 + ly;
    const dl = lx, dt = ly, dr = w - 1 - lx, db = h - 1 - ly;
    let k = (0.8 + 0.36 * fbm(X * 0.06, Y * 0.06, s1)) * (0.9 + 0.2 * hash(X, Y, s1 + 1));
    // 斑 (花崗岩の粒)
    const g = hash(X * 7 + 3, Y * 5 + 1, s1 + 2);
    if (g > 0.975) k *= 1.22; else if (g < 0.02) k *= 0.66;
    // 面取り: 左上が照り、右下が陰
    const edge = Math.min(dl, dt, dr, db);
    if (edge === 0 || !inside(lx - 1, ly) || !inside(lx + 1, ly) || !inside(lx, ly - 1) || !inside(lx, ly + 1)) k *= dr === 0 || db === 0 ? 0.42 : 0.62;
    else if (dt === 1 || dl === 1) k *= 1.24;
    else if (dt === 2 || dl === 2) k *= 1.08;
    else if (db <= 2 || dr <= 2) k *= 0.7 + Math.min(db, dr) * 0.06;
    // 下ほど煤ける
    k *= 1 - 0.2 * Math.pow(ly / h, 2);
    // 水の染み (上から垂れた黒い筋)
    const streak = vnoise(X * 0.5, Y * 0.03, s1 + 5);
    if (streak > 0.72) k *= 1 - (streak - 0.72) * 1.4;
    let c = [sb[0] * k * (1 + warm), sb[1] * k, sb[2] * k * (1 - warm)];
    R.put(X, Y, c);
  }
  // 浮き縁 (一段彫り下げた額縁の溝)
  const m = w < 44 ? 3 : 4;
  const groove = new Set();
  const add = (x, y) => { if (inside(x - x0, y - y0)) groove.add((x << 16) | (y & 0xffff)); };
  for (let i = m; i < w - m; i++) { add(x0 + i, y0 + m); add(x0 + i, y0 + h - 1 - m); }
  for (let j = m; j < h - m; j++) { add(x0 + m, y0 + j); add(x0 + w - 1 - m, y0 + j); }
  // 四隅の小さな菱 (楔の刻み)
  for (const [cx, cy] of [[x0 + m, y0 + m], [x0 + w - 1 - m, y0 + m], [x0 + m, y0 + h - 1 - m], [x0 + w - 1 - m, y0 + h - 1 - m]]) {
    add(cx - 1, cy); add(cx + 1, cy); add(cx, cy - 1); add(cx, cy + 1);
  }
  const glow = opt.accent ? { c: opt.accent, k: 0.55 } : opt.elite ? { c: [120, 14, 10], k: 0.5 } : null;
  engrave(R, groove, 0.52, glow);

  // ---- 主意匠 ----
  const tall = h >= w * 1.2;
  const motif = pickMotif(rnd, tall);
  const cx = x0 + Math.floor(w / 2), cy = y0 + Math.floor(h / 2);
  const ih = h - m * 2 - 6, iw = w - m * 2 - 6; // 額縁の内側
  const carve = new Set(), raise = new Set();
  const C = (x, y) => { x = Math.round(x); y = Math.round(y); if (inside(x - x0, y - y0)) carve.add((x << 16) | (y & 0xffff)); };
  const Rz = (x, y) => { x = Math.round(x); y = Math.round(y); if (inside(x - x0, y - y0)) raise.add((x << 16) | (y & 0xffff)); };
  if (motif === "cross" || motif === "celtic") {
    const top = cy - Math.round(ih * 0.36), bot = cy + Math.round(ih * 0.36);
    const armY = top + Math.round((bot - top) * (motif === "celtic" ? 0.3 : 0.28));
    const arm = Math.max(5, Math.round(iw * 0.32));
    // 十字は太さ3の溝 (末端が少し広がる)
    for (let y = top; y <= bot; y++) for (let dx = -1; dx <= 1; dx++) C(cx + dx, y);
    for (let x = cx - arm; x <= cx + arm; x++) for (let dy = -1; dy <= 1; dy++) C(x, armY + dy);
    for (const [ex, ey] of [[cx, top], [cx, bot], [cx - arm, armY], [cx + arm, armY]]) {
      if (ey === armY) { C(ex, ey - 2); C(ex, ey + 2); } else { C(ex - 2, ey); C(ex + 2, ey); }
    }
    if (motif === "celtic") {
      const rr = Math.max(5, Math.round(arm * 0.72));
      for (let i = 0; i < 64; i++) { const a = (i / 64) * TAU; C(cx + Math.cos(a) * rr, armY + Math.sin(a) * rr); }
    }
  } else if (motif === "skull") {
    // 髑髏と交差した大腿骨の浮き彫り
    const sy = cy - Math.round(ih * 0.1);
    for (let y = -5; y <= 4; y++) for (let x = -5; x <= 5; x++) {
      const d = Math.hypot(x / 5.2, (y + 0.5) / 5.5);
      if (d <= 1 && !(y >= 2 && Math.abs(x) >= 4)) Rz(cx + x, sy + y);
    }
    for (let y = 3; y <= 6; y++) for (let x = -3; x <= 3; x++) Rz(cx + x, sy + y);
    // 眼窩・鼻は彫り込む
    for (const ex of [-2, 2]) for (let y = -1; y <= 0; y++) for (let x = 0; x <= 1; x++) C(cx + ex + x - (ex < 0 ? 1 : 0), sy + y);
    C(cx, sy + 2);
    for (let x = -2; x <= 2; x += 2) C(cx + x, sy + 5);
    const by = sy + 10, L = Math.round(iw * 0.42);
    for (let t = -L; t <= L; t++) {
      Rz(cx + t, by + t * 0.45); Rz(cx + t, by + 1 + t * 0.45);
      Rz(cx + t, by - t * 0.45); Rz(cx + t, by + 1 - t * 0.45);
    }
    for (const sx of [-1, 1]) for (const sy2 of [-1, 1]) {
      const ex = cx + sx * L, ey = by + sy2 * L * 0.45 * sx;
      Rz(ex, ey - 1); Rz(ex + sx, ey); Rz(ex, ey + 2); Rz(ex + sx, ey + 1);
    }
  } else if (motif === "gisant") {
    // 横たわる屍衣の像 (屍の浮き彫り): 頭・肩・胸で組んだ手・裾
    const top = cy - Math.round(ih * 0.42), bot = cy + Math.round(ih * 0.42);
    const L = bot - top;
    for (let y = top; y <= bot; y++) {
      const t = (y - top) / L;
      let half;
      if (t < 0.13) half = Math.sqrt(Math.max(0, 1 - Math.pow((t - 0.065) / 0.075, 2))) * iw * 0.16; // 頭
      else if (t < 0.18) half = iw * 0.12; // 首
      else if (t < 0.3) half = iw * (0.18 + (t - 0.18) * 1.6); // 肩
      else half = iw * (0.37 - (t - 0.3) * 0.28); // 体から裾へ細る
      half = Math.max(1, half);
      for (let x = -Math.round(half); x <= Math.round(half); x++) Rz(cx + x, y);
    }
    // 屍衣の襞 (彫り)
    for (let k = -1; k <= 1; k += 2) for (let y = top + Math.round(L * 0.5); y < bot - 1; y++) C(cx + k * Math.round(iw * 0.1 + (y - top) * 0.02), y);
    // 胸で組んだ手 (小さな十字)
    const hy = top + Math.round(L * 0.38);
    for (let y = -3; y <= 3; y++) C(cx, hy + y);
    for (let x = -2; x <= 2; x++) C(cx + x, hy - 1);
    // 顔の陰
    C(cx - 1, top + Math.round(L * 0.06)); C(cx + 1, top + Math.round(L * 0.06));
  } else if (motif === "script") {
    // 碑文: 上に小さな十字、下に擦り減った銘の行
    const top = cy - Math.round(ih * 0.34);
    for (let y = 0; y < 9; y++) C(cx, top + y);
    for (let x = -3; x <= 3; x++) C(cx + x, top + 3);
    const lines = Math.max(3, Math.min(6, Math.floor((ih * 0.55) / 5)));
    for (let l = 0; l < lines; l++) {
      const yy = top + 14 + l * 5;
      const half = Math.round(iw * (l === 0 ? 0.42 : 0.36));
      for (let x = -half; x <= half; x++) {
        const hv = hash(x + 50, yy, seed);
        if (hv < 0.42) continue;
        C(cx + x, yy);
        if (hv > 0.82) C(cx + x, yy - 1);
        if (hv > 0.93) C(cx + x, yy + 1);
      }
    }
  } else if (motif === "hourglass") {
    // 翼ある砂時計 (死を想え)
    const hgH = Math.min(Math.round(ih * 0.4), 26), hw = Math.max(4, Math.round(iw * 0.18));
    const top = cy - Math.round(hgH / 2);
    for (let y = 0; y <= hgH; y++) {
      const t = Math.abs(y - hgH / 2) / (hgH / 2);
      const half = Math.max(1, Math.round(hw * t));
      C(cx - half, top + y); C(cx + half, top + y);
      if (y > hgH / 2 && t < 0.8) for (let x = -half + 1; x < half; x++) C(cx + x, top + y); // 落ちた砂
    }
    for (let x = -hw - 1; x <= hw + 1; x++) { C(cx + x, top - 1); C(cx + x, top + hgH + 1); }
    for (const s of [-1, 1]) for (let f = 0; f < 4; f++) for (let t = 0; t < 9 - f * 1.5; t++) {
      C(cx + s * (hw + 3 + t), top + hgH * 0.32 + f * 2 - t * 0.55 + f * 0.4);
    }
  } else if (motif === "ring") {
    // 蓋を引き上げる鉄の環 (上寄り) と小さな十字
    stampSprite(R, cx - 4, y0 + m + 5, RING, RING_PAL);
    for (let i = 0; i < 9; i++) R.over(cx - 4 + i, y0 + m + 15, RUST.mid, 0.45); // 錆の流れ
    for (let j = 0; j < Math.round(ih * 0.2); j++) R.over(cx - 1 + Math.floor(hash(j, gx, gy) * 3), y0 + m + 15 + j, RUST.lo, 0.35);
    const ty = cy + Math.round(ih * 0.12);
    for (let y = -5; y <= 7; y++) C(cx, ty + y);
    for (let x = -4; x <= 4; x++) C(cx + x, ty - 1);
  }
  if (raise.size) relief(R, raise, 1.06);
  if (carve.size) engrave(R, carve, motif === "script" ? 0.6 : 0.48, glow);

  // ---- ひび (縁から内へ) ----
  const nCrack = motif === "broken" ? 3 : (rnd() < 0.55 ? 1 : 0) + (rnd() < 0.2 ? 1 : 0);
  for (let k = 0; k < nCrack; k++) {
    const crack = new Set();
    const side = Math.floor(rnd() * 4);
    let px = side === 0 ? x0 + rnd() * w : side === 1 ? x0 + w - 1 : side === 2 ? x0 + rnd() * w : x0;
    let py = side === 0 ? y0 : side === 1 ? y0 + rnd() * h : side === 2 ? y0 + h - 1 : y0 + rnd() * h;
    let a = Math.atan2(cy - py, cx - px) + (rnd() - 0.5) * 0.9;
    const L = (motif === "broken" ? 0.7 : 0.3 + rnd() * 0.35) * Math.max(w, h);
    for (let t = 0; t < L; t++) {
      const X = Math.round(px), Y = Math.round(py);
      if (inside(X - x0, Y - y0)) { crack.add((X << 16) | (Y & 0xffff)); if (motif === "broken" && k === 0) crack.add(((X + 1) << 16) | (Y & 0xffff)); }
      a += (rnd() - 0.5) * 0.7;
      px += Math.cos(a); py += Math.sin(a);
      if (rnd() < 0.05) { // 枝分かれ
        let bx = px, by = py, ba = a + (rnd() < 0.5 ? 1 : -1) * 0.9;
        for (let u = 0; u < 6 + rnd() * 6; u++) { bx += Math.cos(ba); by += Math.sin(ba); ba += (rnd() - 0.5) * 0.6; const BX = Math.round(bx), BY = Math.round(by); if (inside(BX - x0, BY - y0)) crack.add((BX << 16) | (BY & 0xffff)); }
      }
    }
    engrave(R, crack, 0.32, opt.elite ? { c: [110, 10, 8], k: 0.6 } : null);
  }
  // 割れた蓋: 斜めの大きな断裂で片側が沈み、割れ目に砕片が噛む
  if (motif === "broken") {
    const ax = x0 + rnd() * w, bx = x0 + rnd() * w;
    const fy = (lx) => y0 + h * 0.3 + (h * 0.4) * ((lx - x0) / w) + (ax - bx) * 0.1;
    for (let ly = 0; ly < h; ly++) for (let lx = 0; lx < w; lx++) {
      if (!inside(lx, ly)) continue;
      const X = x0 + lx, Y = y0 + ly, d = Y - fy(X) + (vnoise(X * 0.4, 3, seed) - 0.5) * 3;
      if (d > 0) R.mul(X, Y, d < 1.5 ? 0.25 : d < 3 ? 0.62 : 0.8);
      else if (d > -1.2) R.mul(X, Y, 1.22);
    }
    for (let i = 0; i < 5; i++) { const X = Math.round(x0 + 3 + rnd() * (w - 6)); stampMask(R, X, Math.round(fy(X)) - 1, 2, 2, () => true, PEBBLE, { outlineA: 0.5 }); }
  }

  // ---- 苔と地衣 (下辺・角・溝に溜まる) ----
  for (let ly = 0; ly < h; ly++) for (let lx = 0; lx < w; lx++) {
    if (!inside(lx, ly)) continue;
    const X = x0 + lx, Y = y0 + ly;
    const edge = Math.min(lx, ly, w - 1 - lx, h - 1 - ly);
    const bias = (ly / h) * 0.55 + (edge < 4 ? (4 - edge) * 0.09 : 0) + (groove.has((X << 16) | (Y & 0xffff)) ? 0.15 : 0);
    const n = fbm(X * 0.16, Y * 0.16, s1 + 17);
    const v = n * 0.75 + bias * mossAmt;
    if (v > 0.74) R.tint(X, Y, v > 0.82 ? mat.mossHi : mat.moss, opt.elite ? 0.35 : 0.62);
    else if (hash(X, Y, s1 + 23) > 0.992) R.tint(X, Y, mat.lichen, 0.7);
  }

  // ---- 強敵階: 隙間から滲む血 ----
  if (opt.elite) {
    for (let k = 0; k < 2 + rnd() * 3; k++) {
      let px = x0 + 4 + Math.floor(rnd() * (w - 8)), py = y0 + Math.floor(rnd() * h * 0.6);
      const L = 6 + rnd() * h * 0.4;
      for (let t = 0; t < L; t++) {
        if (inside(px - x0, py - y0)) R.tint(px, py, [96, 8, 6], 0.75 - t / L * 0.4);
        py++; if (rnd() < 0.15) px += rnd() < 0.5 ? -1 : 1;
      }
    }
  }
}

// ===== 石壁 (踏破マスの境) =====
// ctx は論理解像度のキャンバス (変換なし)。walls: [{x,y,w,h,horiz}] (セル境界の帯)、posts: [{x,y}]
// mat: { wall:[r,g,b], wallFront:[r,g,b] }
export function paintCryptWalls(ctx, walls, posts, mat, seed) {
  const top = mat.wall, front = mat.wallFront;
  const css = (c, k = 1) => `rgb(${Math.round(c[0] * k)},${Math.round(c[1] * k)},${Math.round(c[2] * k)})`;
  // 床に落ちる影 (南と東へ)
  ctx.fillStyle = "rgba(0,0,0,0.42)";
  for (const w of walls) {
    if (w.horiz) ctx.fillRect(w.x + 1, w.y + w.h, w.w, 3);
    else ctx.fillRect(w.x + w.w, w.y + 2, 2, w.h);
  }
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  for (const w of walls) {
    if (w.horiz) ctx.fillRect(w.x + 2, w.y + w.h + 3, w.w - 2, 2);
    else ctx.fillRect(w.x + w.w + 2, w.y + 3, 1, w.h - 2);
  }
  for (const w of walls) {
    const r = makeRng(seed ^ Math.imul(w.x + 7, 92837111) ^ Math.imul(w.y + 3, 689287499));
    // 輪郭
    ctx.fillStyle = "#0b0908";
    ctx.fillRect(w.x - 1, w.y - 1, w.w + 2, w.h + 2);
    // 天端 (切石を並べる)
    const len = w.horiz ? w.w : w.h;
    let p = 0;
    while (p < len) {
      const bl = Math.min(len - p, 7 + Math.floor(r() * 7));
      const k = 0.84 + r() * 0.3;
      ctx.fillStyle = css(top, k);
      if (w.horiz) ctx.fillRect(w.x + p, w.y, bl, w.h - 2);
      else ctx.fillRect(w.x, w.y + p, w.w - 1, bl);
      // 石の上辺の照り
      ctx.fillStyle = css(top, k * 1.22);
      if (w.horiz) ctx.fillRect(w.x + p, w.y, bl, 1); else ctx.fillRect(w.x, w.y + p, 1, bl);
      // 目地
      ctx.fillStyle = css(top, 0.42);
      if (p > 0) { if (w.horiz) ctx.fillRect(w.x + p, w.y, 1, w.h - 2); else ctx.fillRect(w.x, w.y + p, w.w - 1, 1); }
      // 欠け・苔
      if (r() < 0.3) { ctx.fillStyle = css(top, 0.6); if (w.horiz) ctx.fillRect(w.x + p + Math.floor(r() * bl), w.y + 1 + Math.floor(r() * 2), 1, 1); else ctx.fillRect(w.x + 1 + Math.floor(r() * 2), w.y + p + Math.floor(r() * bl), 1, 1); }
      if (mat.moss && r() < 0.18) { ctx.fillStyle = css(mat.moss, 1.1); if (w.horiz) ctx.fillRect(w.x + p + Math.floor(r() * (bl - 2)), w.y + w.h - 3, 2, 1); else ctx.fillRect(w.x + w.w - 2, w.y + p + Math.floor(r() * (bl - 2)), 1, 2); }
      p += bl;
    }
    // 正面 (南向きの面が見える。縦の壁は右へ薄い陰)
    if (w.horiz) {
      ctx.fillStyle = css(front, 1);
      ctx.fillRect(w.x, w.y + w.h - 2, w.w, 2);
      ctx.fillStyle = css(front, 0.6);
      ctx.fillRect(w.x, w.y + w.h - 1, w.w, 1);
    } else {
      ctx.fillStyle = css(front, 0.9);
      ctx.fillRect(w.x + w.w - 1, w.y, 1, w.h);
    }
  }
  // 角の柱頭 (壁の交点に一回り大きな石)
  for (const p of posts) {
    ctx.fillStyle = "#0b0908";
    ctx.fillRect(p.x - 5, p.y - 5, 10, 11);
    ctx.fillStyle = css(top, 1.08);
    ctx.fillRect(p.x - 4, p.y - 4, 8, 7);
    ctx.fillStyle = css(top, 1.32);
    ctx.fillRect(p.x - 4, p.y - 4, 8, 1);
    ctx.fillRect(p.x - 4, p.y - 4, 1, 7);
    ctx.fillStyle = css(top, 0.7);
    ctx.fillRect(p.x + 3, p.y - 3, 1, 6);
    ctx.fillStyle = css(front, 1);
    ctx.fillRect(p.x - 4, p.y + 3, 8, 2);
  }
}

// ===== 層ごとの素材 =====
// 第1層は作り込んだ地下墓地。他層は LAYER_VISUALS の床色から汎用の素材を組む (小物なし)
export const CATACOMB = {
  floor: [70, 64, 54], mortar: [22, 19, 15],
  slab: [112, 105, 92], slabB: [96, 92, 84],
  wall: [140, 132, 118], wallFront: [66, 60, 52],
  moss: [44, 56, 30], mossHi: [76, 92, 46], lichen: [150, 156, 104],
  light: [255, 168, 92], dark: [6, 5, 9],
  blood: true, props: true,
};
export function genericMaterial(theme) {
  const t = hexRgb((theme && theme.floorTiles && theme.floorTiles[0]) || "#1b1812");
  const lift = (c, k) => c.map((v) => Math.min(255, v * k + 18));
  const acc = hexRgb((theme && theme.accent) || "#c7bfa6");
  return {
    floor: lift(t, 2.4), mortar: t.map((v) => v * 0.6),
    slab: lift(t, 3.6), slabB: lift(t, 3.1),
    wall: mix(lift(t, 4.6), acc, 0.15), wallFront: lift(t, 2.0),
    moss: [44, 56, 30], mossHi: [70, 84, 44], lichen: [140, 146, 100],
    light: mix([255, 176, 104], acc, 0.25), dark: [5, 5, 8],
    blood: false, props: false,
  };
}
