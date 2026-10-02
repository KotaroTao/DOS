// 音響合成の基礎部品 (純粋な数値計算のみ。AudioContext に依存しない)
// 楽器サンプル・効果音・残響インパルス応答は、すべてここの関数で Float32Array として生成する。
// ワーカー (music/worker.js) でもメインスレッドでも同じコードが走る。

// ---- 決定的乱数 (mulberry32): 同じ種なら同じ音になる ----
export function rng(seed) {
  let a = (seed >>> 0) || 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// 文字列から種を作る (FNV-1a)
export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const dbToGain = (db) => Math.pow(10, db / 20);
const TAU = Math.PI * 2;

// ---- FFT (基数2・その場変換) ----
const FFT_CACHE = new Map();
function fftTables(n) {
  let t = FFT_CACHE.get(n);
  if (t) return t;
  const bits = Math.round(Math.log2(n));
  const rev = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    let r = 0, x = i;
    for (let b = 0; b < bits; b++) { r = (r << 1) | (x & 1); x >>= 1; }
    rev[i] = r;
  }
  const h = n >> 1;
  const cos = new Float64Array(h), sin = new Float64Array(h);
  for (let i = 0; i < h; i++) { cos[i] = Math.cos(TAU * i / n); sin[i] = Math.sin(TAU * i / n); }
  t = { rev, cos, sin };
  FFT_CACHE.set(n, t);
  return t;
}
// 逆FFT (正規化なし)。re/im は Float64Array、長さは2の冪
export function ifft(re, im) {
  const n = re.length;
  const { rev, cos, sin } = fftTables(n);
  for (let i = 0; i < n; i++) {
    const j = rev[i];
    if (j > i) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1, step = n / size;
    for (let i = 0; i < n; i += size) {
      for (let j = 0, k = 0; j < half; j++, k += step) {
        const wr = cos[k], wi = sin[k];
        const a = i + j, b = a + half;
        const tr = re[b] * wr - im[b] * wi;
        const ti = re[b] * wi + im[b] * wr;
        re[b] = re[a] - tr; im[b] = im[a] - ti;
        re[a] += tr; im[a] += ti;
      }
    }
  }
}

// ---- PADsynth (Paul Nasca 方式) ----
// 倍音ごとに帯域幅を持たせたスペクトルを乱数位相で逆FFTし、
// 「完全にループする」合唱・弦楽合奏・パッドのサンプルを作る。
// 左右は別の乱数位相 (1回の複素IFFTで2ch同時に得る) → 自然な広がり。
//  partials: [[比率, 振幅], ...]  (f0 に対する周波数比)
//  env(f): 周波数ごとの音色包絡 (フォルマント・胴鳴り・ローパス)
//  bw: 基音での帯域幅 (セント)、bwScale: 高次倍音ほど広げる指数 (1=比例)
//  noise(f): 息や弓の擦れなど、倍音に乗らない雑音成分 (任意)
export function padsynth(o) {
  const n = o.n || 65536, sr = o.sr, f0 = o.f0;
  const half = n >> 1, binHz = sr / n;
  const A = new Float64Array(half);
  const bwC = Math.pow(2, (o.bw ?? 20) / 1200) - 1;
  const bwScale = o.bwScale ?? 1;
  const nyq = sr * 0.46;
  const env = o.env || (() => 1);
  for (const [r, a0] of o.partials) {
    const f = f0 * r;
    if (f >= nyq || f < 15) continue;
    const a = a0 * env(f);
    if (a < 1e-6) continue;
    const bwHz = bwC * f0 * Math.pow(r, bwScale);
    const bwi = bwHz / binHz; // ビン単位の幅
    const c = f / binHz;
    if (bwi < 0.6) { // ほぼ単一周波数
      const i = Math.round(c);
      if (i > 0 && i < half) A[i] += a;
      continue;
    }
    const norm = a / Math.sqrt(bwi);
    const lo = Math.max(1, Math.floor(c - 3 * bwi)), hi = Math.min(half - 1, Math.ceil(c + 3 * bwi));
    for (let i = lo; i <= hi; i++) { const x = (i - c) / bwi; A[i] += norm * Math.exp(-x * x); }
  }
  if (o.noise) {
    const nz = o.noise;
    for (let i = 1; i < half; i++) { const f = i * binHz; if (f < nyq) A[i] += nz(f) * 0.02; }
  }
  const rnd = rng(o.seed || 1);
  const re = new Float64Array(n), im = new Float64Array(n);
  // Z = XL + i*XR (XL, XR はエルミート対称) → ifft の実部=左、虚部=右
  for (let k = 1; k < half; k++) {
    const a = A[k];
    if (a === 0) continue;
    const pl = rnd() * TAU, pr = rnd() * TAU;
    const cl = a * Math.cos(pl), sl = a * Math.sin(pl), cr = a * Math.cos(pr), sR = a * Math.sin(pr);
    re[k] = cl - sR; im[k] = sl + cr;
    re[n - k] = cl + sR; im[n - k] = -sl + cr;
  }
  ifft(re, im);
  const L = new Float32Array(n), R = o.mono ? null : new Float32Array(n);
  let ss = 0;
  for (let i = 0; i < n; i++) { ss += re[i] * re[i] + (R ? im[i] * im[i] : 0); }
  const rms = Math.sqrt(ss / (n * (R ? 2 : 1))) || 1;
  const g = (o.rms || 0.2) / rms;
  for (let i = 0; i < n; i++) { L[i] = re[i] * g; if (R) R[i] = im[i] * g; }
  return R ? [L, R] : [L];
}

// 倍音列ヘルパ: 鋸歯 (1/h^p)
export function sawPartials(maxH, p = 1, odd = 0) {
  const out = [];
  for (let h = 1; h <= maxH; h++) {
    let a = 1 / Math.pow(h, p);
    if (odd && h % 2 === 0) a *= odd; // 偶数倍音を弱める (odd<1)
    out.push([h, a]);
  }
  return out;
}

// フォルマント (ローレンツ型共鳴の和)。fs: [[中心Hz, 帯域Hz, 利得], ...]
export function formantEnv(fs, floor = 0.015) {
  return (f) => {
    let s = floor;
    for (let i = 0; i < fs.length; i++) {
      const [fc, bw, g] = fs[i];
      const x = (f - fc) / (bw * 0.5);
      s += g / (1 + x * x);
    }
    return s;
  };
}
// 対数周波数上のなだらかな山 (胴鳴りなど)。peaks: [[中心Hz, 幅(オクターブ), dB], ...]
export function bodyEnv(peaks) {
  return (f) => {
    let db = 0;
    const lf = Math.log2(Math.max(f, 1));
    for (const [fc, w, d] of peaks) { const x = (lf - Math.log2(fc)) / w; db += d * Math.exp(-x * x); }
    return Math.pow(10, db / 20);
  };
}
// なだらかなローパス (次数 ord の Butterworth 振幅特性)
export const softLP = (fc, ord = 2) => (f) => 1 / Math.sqrt(1 + Math.pow(f / fc, 2 * ord));
export const softHP = (fc, ord = 1) => (f) => 1 / Math.sqrt(1 + Math.pow(fc / Math.max(f, 1), 2 * ord));

// ---- 双二次フィルタ (RBJ クックブック) ----
export function bq(type, f, q, sr, gainDb = 0) {
  const w = TAU * Math.min(f, sr * 0.49) / sr, cs = Math.cos(w), sn = Math.sin(w);
  const alpha = sn / (2 * q), A = Math.pow(10, gainDb / 40);
  let b0, b1, b2, a0, a1, a2;
  switch (type) {
    case "lp": b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; a0 = 1 + alpha; a1 = -2 * cs; a2 = 1 - alpha; break;
    case "hp": b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; a0 = 1 + alpha; a1 = -2 * cs; a2 = 1 - alpha; break;
    case "bp": b0 = alpha; b1 = 0; b2 = -alpha; a0 = 1 + alpha; a1 = -2 * cs; a2 = 1 - alpha; break;
    case "peak": b0 = 1 + alpha * A; b1 = -2 * cs; b2 = 1 - alpha * A; a0 = 1 + alpha / A; a1 = -2 * cs; a2 = 1 - alpha / A; break;
    case "ls": { const s = 2 * Math.sqrt(A) * alpha;
      b0 = A * ((A + 1) - (A - 1) * cs + s); b1 = 2 * A * ((A - 1) - (A + 1) * cs); b2 = A * ((A + 1) - (A - 1) * cs - s);
      a0 = (A + 1) + (A - 1) * cs + s; a1 = -2 * ((A - 1) + (A + 1) * cs); a2 = (A + 1) + (A - 1) * cs - s; break; }
    case "hs": { const s = 2 * Math.sqrt(A) * alpha;
      b0 = A * ((A + 1) + (A - 1) * cs + s); b1 = -2 * A * ((A - 1) + (A + 1) * cs); b2 = A * ((A + 1) + (A - 1) * cs - s);
      a0 = (A + 1) - (A - 1) * cs + s; a1 = 2 * ((A - 1) - (A + 1) * cs); a2 = (A + 1) - (A - 1) * cs - s; break; }
    default: throw new Error("bq type " + type);
  }
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}
// その場でフィルタ (転置直接形II)
export function filt(x, c, from = 0, to = x.length) {
  let z1 = 0, z2 = 0;
  const { b0, b1, b2, a1, a2 } = c;
  for (let i = from; i < to; i++) {
    const v = x[i], y = b0 * v + z1;
    z1 = b1 * v - a1 * y + z2;
    z2 = b2 * v - a2 * y;
    x[i] = y;
  }
  return x;
}
export const applyBq = (x, type, f, q, sr, db) => filt(x, bq(type, f, q, sr, db));

// 1次ローパス/ハイパス (その場)
export function lp1(x, fc, sr) {
  const a = Math.exp(-TAU * fc / sr);
  let y = 0;
  for (let i = 0; i < x.length; i++) { y = x[i] + a * (y - x[i]); x[i] = y; }
  return x;
}
export function hp1(x, fc, sr) {
  const a = Math.exp(-TAU * fc / sr);
  let y = 0, px = 0;
  for (let i = 0; i < x.length; i++) { const v = x[i]; y = a * (y + v - px); px = v; x[i] = y; }
  return x;
}
// 時変ローパス: fcAt(t秒) をブロックごとに評価 (音が暗くなっていく残響・打撃音に)
export function lpSweep(x, sr, fcAt, block = 64) {
  let y = 0, a = 0;
  for (let i = 0; i < x.length; i++) {
    if (i % block === 0) a = Math.exp(-TAU * Math.max(20, fcAt(i / sr)) / sr);
    y = x[i] + a * (y - x[i]); x[i] = y;
  }
  return x;
}
// 時変バンドパス (状態変数フィルタ)。fcAt(t), q
export function svfSweep(x, sr, fcAt, q = 1, mode = "bp", block = 32) {
  let lo = 0, bd = 0, f = 0;
  const damp = 1 / q;
  for (let i = 0; i < x.length; i++) {
    if (i % block === 0) f = 2 * Math.sin(Math.PI * Math.min(0.24, Math.max(10, fcAt(i / sr)) / sr));
    const v = x[i];
    lo += f * bd;
    const hi = v - lo - damp * bd;
    bd += f * hi;
    x[i] = mode === "bp" ? bd : mode === "lp" ? lo : hi;
  }
  return x;
}

// ---- 雑音 ----
export function white(len, rnd) {
  const x = new Float32Array(len);
  for (let i = 0; i < len; i++) x[i] = rnd() * 2 - 1;
  return x;
}
export function pink(len, rnd) { // Paul Kellet の近似
  const x = new Float32Array(len);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < len; i++) {
    const w = rnd() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
    x[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }
  return x;
}
export function brown(len, rnd) {
  const x = new Float32Array(len);
  let y = 0;
  for (let i = 0; i < len; i++) { y = (y + 0.02 * (rnd() * 2 - 1)) / 1.02; x[i] = y * 3.5; }
  return x;
}

// ---- 包絡・加工 ----
// 指数減衰 (t60 秒で -60dB)、attack 秒の立ち上がり
export function envExp(x, sr, t60, attack = 0.002, from = 0) {
  const k = -6.9078 / (t60 * sr);
  const na = Math.max(1, Math.round(attack * sr));
  for (let i = from; i < x.length; i++) {
    const n = i - from;
    x[i] *= Math.exp(k * n) * (n < na ? n / na : 1);
  }
  return x;
}
export function fadeEdges(x, sr, fin = 0.002, fout = 0.03) {
  const a = Math.round(fin * sr), b = Math.round(fout * sr), n = x.length;
  for (let i = 0; i < a && i < n; i++) x[i] *= i / a;
  for (let i = 0; i < b && i < n; i++) x[n - 1 - i] *= i / b;
  return x;
}
export function mixInto(dst, src, at = 0, gain = 1) {
  const n = Math.min(src.length, dst.length - at);
  for (let i = 0; i < n; i++) dst[at + i] += src[i] * gain;
  return dst;
}
export function peakNorm(x, peak = 0.9) {
  let m = 0;
  for (let i = 0; i < x.length; i++) { const a = Math.abs(x[i]); if (a > m) m = a; }
  if (m > 0) { const g = peak / m; for (let i = 0; i < x.length; i++) x[i] *= g; }
  return x;
}
export function softClip(x, drive = 1) {
  const k = Math.tanh(drive);
  for (let i = 0; i < x.length; i++) x[i] = Math.tanh(x[i] * drive) / k;
  return x;
}
export function dcBlock(x) {
  let y = 0, px = 0;
  for (let i = 0; i < x.length; i++) { const v = x[i]; y = v - px + 0.995 * y; px = v; x[i] = y; }
  return x;
}

// ---- 減衰正弦の束 (モード合成): 鐘・ティンパニ・金属片 ----
// modes: [[周波数Hz, 振幅, t60秒, 立ち上がり秒(任意), 位相(任意)], ...]
export function modal(sr, dur, modes, out) {
  const len = Math.round(dur * sr);
  const y = out || new Float32Array(len);
  for (const m of modes) {
    const [f, amp, t60, att = 0, ph = 0] = m;
    if (f <= 0 || f >= sr * 0.48 || amp === 0) continue;
    const r = Math.exp(-6.9078 / (t60 * sr)), w = TAU * f / sr;
    const c = r * Math.cos(w), s = r * Math.sin(w);
    let re = Math.cos(ph), im = Math.sin(ph);
    const na = att > 0 ? att * sr : 0;
    const nEnd = Math.min(len, Math.round(t60 * 1.2 * sr) + 1);
    for (let i = 0; i < nEnd; i++) {
      const g = na ? amp * (1 - Math.exp(-i / na)) : amp;
      y[i] += im * g;
      const nr = re * c - im * s; im = re * s + im * c; re = nr;
    }
  }
  return y;
}

// ---- Karplus-Strong 撥弦 (拡張版: 分数遅延・撥弦位置・明るさ・複弦) ----
//  f0, dur, t60(基音の減衰時間), bright(0-1), pick(撥弦位置0-0.5), soft(0-1 励振の柔らかさ)
//  courses: 複弦のデチューン (セント) 配列
export function pluck(o) {
  const { sr, f0, dur } = o;
  const len = Math.round(dur * sr);
  const out = new Float32Array(len);
  const rnd = rng(o.seed || 7);
  const courses = o.courses || [0];
  for (const cents of courses) {
    const f = f0 * Math.pow(2, cents / 1200);
    const P = sr / f;
    const S = 0.5 - 0.42 * (o.bright ?? 0.5); // ループ内ローパス係数 (0.5=最も暗い)
    let D = P - S;
    let N = Math.floor(D), frac = D - N;
    if (frac < 0.15) { N -= 1; frac += 1; }
    const C = (1 - frac) / (1 + frac);
    const w0 = TAU * f / sr;
    const hmag = Math.sqrt((1 - S) * (1 - S) + S * S + 2 * S * (1 - S) * Math.cos(w0));
    const g = Math.min(0.99995, Math.pow(10, -3 / ((o.t60 || 2) * f)) / hmag);
    const dl = new Float32Array(N);
    // 励振: 撥弦位置に頂点を持つ三角形 + 雑音 (soft で雑音を減らし丸くする)
    const pk = Math.max(1, Math.round(N * (o.pick ?? 0.15)));
    const soft = o.soft ?? 0.5;
    let lpState = 0;
    for (let i = 0; i < N; i++) {
      const tri = i < pk ? i / pk : (N - i) / (N - pk);
      const nz = rnd() * 2 - 1;
      lpState += (nz - lpState) * (1 - soft * 0.85);
      dl[i] = tri * (0.55 + 0.45 * soft) + lpState * (1 - soft * 0.7) * 0.8;
    }
    // 撥弦位置のコムフィルタ (倍音の欠け)
    let mean = 0;
    for (let i = 0; i < N; i++) mean += dl[i];
    mean /= N;
    for (let i = 0; i < N; i++) dl[i] -= mean;
    let idx = 0, apX = 0, apY = 0, prev = 0;
    const amp = 1 / courses.length;
    for (let n = 0; n < len; n++) {
      const v = dl[idx];
      out[n] += v * amp;
      const ap = C * v + apX - C * apY; apX = v; apY = ap;
      const lpv = (1 - S) * ap + S * prev; prev = ap;
      dl[idx] = g * lpv;
      idx++; if (idx >= N) idx = 0;
    }
  }
  dcBlock(out);
  return out;
}

// ---- 残響インパルス応答 (大聖堂) ----
// 初期反射 + 拡散する残響尾部。時間とともに高域が先に減衰し、暗い石造りの響きになる。
export function makeIR(sr, o = {}) {
  const len = Math.round((o.len || 4.2) * sr);
  const rt = o.rt60 || 3.6;
  const pre = Math.round((o.pre || 0.022) * sr);
  const chans = [];
  for (let c = 0; c < 2; c++) {
    const rnd = rng(1234 + c * 77);
    const x = new Float32Array(len);
    const k = -6.9078 / (rt * sr);
    const build = 0.07 * sr;
    for (let i = pre; i < len; i++) {
      const n = i - pre;
      const g = Math.exp(k * n) * (n < build ? Math.pow(n / build, 1.5) : 1);
      x[i] = (rnd() * 2 - 1) * g;
    }
    // 初期反射 (石壁・柱からの離散的な反射)
    const taps = o.taps || 14;
    for (let t = 0; t < taps; t++) {
      const at = pre + Math.round((0.004 + Math.pow(rnd(), 1.3) * 0.11) * sr);
      const a = (0.9 - t / taps * 0.6) * (rnd() < 0.5 ? -1 : 1) * 0.9;
      if (at < len) { x[at] += a; if (at + 1 < len) x[at + 1] += a * 0.5; }
    }
    // 高域ほど早く消える: カットオフが時間とともに下がる
    const hi = o.bright || 7500, lo = o.dark || 900, tau = o.darken || 1.1;
    lpSweep(x, sr, (t) => lo + (hi - lo) * Math.exp(-t / tau));
    hp1(x, o.hp || 110, sr);
    hp1(x, o.hp || 110, sr);
    chans.push(x);
  }
  // 両chのエネルギーを揃えて正規化
  let e = 0;
  for (const x of chans) for (let i = 0; i < x.length; i++) e += x[i] * x[i];
  const g = 1 / Math.sqrt(e / 2 || 1);
  for (const x of chans) for (let i = 0; i < x.length; i++) x[i] *= g;
  return chans;
}
