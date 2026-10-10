// 街の情景 (描き下ろしの原画版)
//
// 原画 (art/town/<鍵>.webp、townkeyart.js が台帳) を情景の比率 (16:10) に切り取って高精細に敷き、
// その上に明かりのゆらめきだけを重ねる。絵そのものは描き換えない。
// 明かりの種類 (tone): fire 炉・松明 / lamp 吊り灯 / candle 蝋燭 / crystal 祠の紅い魂 (ゆっくり脈打つ) / moon 月光 (ほぼ動かない)
// 原画が無い鍵・読めなかった鍵は、townart.js が従来のドット絵を出す。
import { TOWN_KEYART } from "./townkeyart.js";

export const PW = 1200, PH = 750; // 情景の canvas (townart の 120x75 の10倍。比率は同じ)

const REDUCED = (() => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } })();
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const fract = (v) => v - Math.floor(v);
const hash = (a, b = 0) => fract(Math.sin(a * 127.1 + b * 311.7) * 43758.5453);

const TONES = {
  fire: { rgb: "255,140,55", base: 0.42, amp: 0.3, speed: 1.3, step: 0.18 },
  lamp: { rgb: "255,170,80", base: 0.38, amp: 0.18, speed: 0.8, step: 0.1 },
  candle: { rgb: "255,195,120", base: 0.36, amp: 0.2, speed: 1.6, step: 0.12 },
  crystal: { rgb: "255,55,50", base: 0.4, amp: 0.3, speed: 0.35, step: 0 },
  soul: { rgb: "155,140,255", base: 0.28, amp: 0.15, speed: 0.35, step: 0 },
  soulgreen: { rgb: "155,255,216", base: 0.28, amp: 0.16, speed: 0.38, step: 0 },
  moon: { rgb: "150,175,255", base: 0.12, amp: 0.03, speed: 0.15, step: 0 },
};

export const hasPaintedVignette = (key) => !!TOWN_KEYART[key];

let panoramaFailed = false;
export const hasPaintedTownScene = () => !!TOWN_KEYART.panorama && !panoramaFailed;
export const paintedTownSpots = () => Object.fromEntries(Object.entries(TOWN_KEYART.panorama.spots).map(([k, p]) => [k, { x: p[0], y: p[1] }]));

// 読み込みは鍵ごとに一度だけ (成功した img / 失敗 = false)
const _img = new Map();
function loadArt(key) {
  if (_img.has(key)) return _img.get(key);
  const a = TOWN_KEYART[key];
  const p = new Promise((ok) => {
    const im = new Image();
    im.decoding = "async";
    im.onload = () => ok(im);
    im.onerror = () => ok(false);
    im.src = a.src;
  });
  _img.set(key, p);
  return p;
}

// 原画を 16:10 に切り取って焼いた土台 (鍵ごとに一度)
const _base = new Map();
function baseOf(key, im) {
  if (_base.has(key)) return _base.get(key);
  const a = TOWN_KEYART[key];
  const c = document.createElement("canvas");
  c.width = PW; c.height = PH;
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
  const s = Math.max(PW / im.naturalWidth, PH / im.naturalHeight);
  const iw = im.naturalWidth * s, ih = im.naturalHeight * s;
  const [fx, fy] = a.focus || [0.5, 0.5];
  const ox = clamp(PW / 2 - fx * iw, PW - iw, 0), oy = clamp(PH / 2 - fy * ih, PH - ih, 0);
  g.drawImage(im, ox, oy, iw, ih);
  const box = { c, s, ox, oy, iw, ih };
  _base.set(key, box);
  return box;
}

// 光の玉 (加算で重ねる)。色ごとに一枚
const _glow = new Map();
function glow(rgb) {
  if (_glow.has(rgb)) return _glow.get(rgb);
  const n = 128, c = document.createElement("canvas");
  c.width = c.height = n;
  const g = c.getContext("2d"), r = n / 2, gr = g.createRadialGradient(r, r, 0, r, r, r);
  gr.addColorStop(0, `rgba(${rgb},1)`);
  gr.addColorStop(0.2, `rgba(${rgb},0.5)`);
  gr.addColorStop(0.55, `rgba(${rgb},0.14)`);
  gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, n, n);
  _glow.set(rgb, c);
  return c;
}

// 明かりの強さ (0〜1)。なめらかな揺れ + 炎らしい小刻みの段
function level(T, t, seed) {
  const sm = Math.sin(t * 2.1 * T.speed + seed) * 0.5 + Math.sin(t * 5.3 * T.speed + seed * 2.7) * 0.3 + Math.sin(t * 0.7 * T.speed + seed * 1.3) * 0.2;
  const st = T.step ? (hash(Math.floor(t * 9 * T.speed), seed) - 0.5) * 2 * T.step : 0;
  return clamp(T.base + T.amp * sm + st, 0.05, 1);
}

// 情景の canvas を作る。living = townart の livingCanvas (毎フレームの描き直しの登録)。
// 原画が読めなければ fallback() (従来のドット絵の canvas) と差し替える
export function paintedVignette(key, living, fallback) {
  const a = TOWN_KEYART[key];
  const c = document.createElement("canvas");
  c.width = PW; c.height = PH;
  c.className = "tw-vig tw-vig-hd";
  const g = c.getContext && c.getContext("2d");
  if (!g) return c;
  let box = null;
  const lights = (a.lights || []).map((L, i) => ({ ...L, T: TONES[L.tone] || TONES.lamp, seed: i * 3.7 + key.length }));
  const draw = (ts) => {
    if (!box) return;
    const t = (REDUCED ? 3000 : ts) / 1000;
    g.globalCompositeOperation = "source-over";
    g.globalAlpha = 1;
    g.drawImage(box.c, 0, 0);
    g.globalCompositeOperation = "lighter";
    for (const L of lights) {
      const x = box.ox + L.at[0] * box.iw, y = box.oy + L.at[1] * box.ih;
      const r = (L.r || 0.06) * box.ih;
      const v = level(L.T, t, L.seed);
      const img = glow(L.T.rgb);
      g.globalAlpha = v * 0.55;
      g.drawImage(img, x - r * 2.4, y - r * 2.4, r * 4.8, r * 4.8);
      g.globalAlpha = v;
      g.drawImage(img, x - r * 0.7, y - r * 0.7, r * 1.4, r * 1.4);
    }
    g.globalCompositeOperation = "source-over";
    g.globalAlpha = 1;
  };
  loadArt(key).then((im) => {
    if (!im) { // 原画が読めない: ドット絵へ
      const fb = fallback && fallback();
      if (fb && c.parentNode) c.parentNode.replaceChild(fb, c);
      return;
    }
    box = baseOf(key, im);
    draw(typeof performance !== "undefined" ? performance.now() : 0);
  });
  return living(c, draw, 15);
}

// 雲・霧: 横に継ぎ目なくつながる、滑らかな多層ノイズの帯。原画の雲は動かさない。
function mistBand(seed) {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 96;
  const g = c.getContext("2d"), a = g.createImageData(c.width, c.height);
  const noise = (x, y, period) => {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const smooth = (n) => n * n * (3 - 2 * n);
    const v = (i, j) => hash(((i % period) + period) % period + seed * 19, j + seed * 7);
    const u = smooth(fx), t = smooth(fy);
    return (v(ix, iy) * (1 - u) + v(ix + 1, iy) * u) * (1 - t) + (v(ix, iy + 1) * (1 - u) + v(ix + 1, iy + 1) * u) * t;
  };
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    let n = 0, amp = 0.55;
    for (let o = 0; o < 4; o++) {
      const f = 2 ** o;
      n += noise(x / c.width * 6 * f, y / c.height * 2.5 * f, 6 * f) * amp;
      amp *= 0.5;
    }
    const i = (y * c.width + x) * 4, edge = Math.sin(Math.PI * y / (c.height - 1));
    a.data[i] = 148; a.data[i + 1] = 158; a.data[i + 2] = 198;
    a.data[i + 3] = Math.round(clamp((n - 0.42) * 4) * edge * edge * 255);
  }
  g.putImageData(a, 0, 0);
  return c;
}

// 広場の固定原画。240:170 の舞台と名所の座標はそのまま、canvasだけ表示解像度へ合わせる。
// 読み込みに失敗したら同じcanvasを従来のドット絵へ戻す (keep() の参照も保つ)。
export function paintedTownScene(living, fallback) {
  const a = TOWN_KEYART.panorama, c = document.createElement("canvas");
  c.width = 1200; c.height = 850;
  c.className = "town-scene town-scene-hd";
  c.setAttribute("role", "img"); c.setAttribute("aria-label", "辺境の街ロアダルの夜景");
  c.dataset.art = "loading";
  const g = c.getContext("2d");
  if (!g) { panoramaFailed = true; return fallback(c); }
  const motion = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
  let im = null, failed = false, lastTime = 0;
  let base = null;
  const lights = a.lights.map((L, i) => ({ ...L, T: TONES[L.tone], seed: 5 + i * 3.7 }));
  const bands = a.bands.map((b, i) => ({ ...b, img: mistBand(i + 41) }));
  const soulGlow = glow(TONES.soulgreen.rgb);
  const paint = (ts) => {
    if (failed || !im) return;
    lastTime = ts;
    // 設定が開いたまま変わっても、全演出 (鴉・雷を含む) を静止させる。
    const reduced = !!motion?.matches, t = reduced ? 0 : ts / 1000;
    const w = c.width, h = c.height;
    if (!base || base.width !== w || base.height !== h) {
      base = document.createElement("canvas"); base.width = w; base.height = h;
      const bg = base.getContext("2d");
      bg.imageSmoothingEnabled = true; bg.imageSmoothingQuality = "high";
      bg.drawImage(im, 0, 0, w, h);
    }
    g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
    g.drawImage(base, 0, 0);
    // 奥の雲と雷。空全体を白くせず、雲の奥だけ二度かすかに光る。
    const flashTime = t % 29;
    const flash = !reduced && ((flashTime > 20 && flashTime < 20.12) || (flashTime > 20.24 && flashTime < 20.34));
    for (const b of bands.filter((b) => b.kind === "cloud")) {
      const off = fract(t * b.speed + 0.37) * w;
      g.globalAlpha = b.alpha;
      g.drawImage(b.img, -off, b.y * h, w, b.h * h);
      g.drawImage(b.img, w - off, b.y * h, w, b.h * h);
    }
    if (flash) {
      const gr = g.createRadialGradient(w * 0.64, h * 0.36, 0, w * 0.64, h * 0.36, w * 0.18);
      gr.addColorStop(0, "rgba(170,184,255,0.13)"); gr.addColorStop(1, "rgba(170,184,255,0)");
      g.globalAlpha = 1; g.fillStyle = gr; g.fillRect(0, h * 0.20, w, h * 0.29);
    }
    g.globalCompositeOperation = "lighter";
    for (const L of lights) {
      const x = L.at[0] * w, y = L.at[1] * h, r = L.r * h;
      const raw = level(L.T, t, L.seed), img = glow(L.T.rgb);
      const flame = L.tone === "lamp" || L.tone === "candle";
      const v = flame ? clamp(L.T.base + (raw - L.T.base) * 3, 0.05, 1) : raw;
      // 原画の灯りが常に明るいため、灯芯にだけ影も重ねて明暗の差を出す。
      if (flame) {
        g.globalCompositeOperation = "multiply"; g.globalAlpha = (1 - v) * 0.7;
        g.drawImage(glow("0,0,0"), x - r, y - r, r * 2, r * 2);
        g.globalCompositeOperation = "lighter";
      }
      g.globalAlpha = v * 0.8;
      g.drawImage(img, x - r * 2, y - r * 2, r * 4, r * 4);
      g.globalAlpha = Math.min(1, v * 1.5);
      g.drawImage(img, x - r * 0.6, y - r * 0.6, r * 1.2, r * 1.2);
    }
    // 門から渦へ: 細い光の筋がうねりながら上昇する。原画の魂の柱の位置から外さない。
    const S = a.soul, [gx, gy] = S.gate, [vx, vy] = S.vortex;
    const cr = S.columnR * h;
    for (let strand = 0; strand < 5; strand++) {
      g.beginPath();
      for (let j = 0; j <= 48; j++) {
        const u = j / 48, y = (gy + (vy - gy) * u) * h;
        const sway = Math.sin(u * 14 - t * 2.8 + strand * 1.8) * cr * 0.85 * Math.sin(Math.PI * u);
        const x = (gx + (vx - gx) * u) * w + sway + (strand - 2) * cr * 0.23;
        if (!j) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.strokeStyle = "rgb(125,255,195)";
      // 太い霞の中に細い魂火を重ね、携帯の幅でも上昇が見えるようにする。
      g.lineWidth = cr * 0.5; g.globalAlpha = 0.08 + 0.04 * Math.sin(t * 1.3 + strand); g.stroke();
      g.lineWidth = Math.max(1, h * 0.0016); g.globalAlpha = 0.24 + 0.12 * Math.sin(t * 1.3 + strand); g.stroke();
    }
    // 上昇する魂の霞。点滅や粒の密集を避け、門の柱に沿った細い霞にする。
    for (let i = 0; i < 24; i++) {
      const u = fract(t * (0.10 + hash(i, 2) * 0.055) + hash(i, 9));
      const x = (gx + (vx - gx) * u) * w + Math.sin(u * 13 - t + i) * cr * 0.85;
      const y = (gy + (vy - gy) * u) * h, r = cr * (0.35 + hash(i, 4) * 0.6);
      g.globalAlpha = Math.sin(u * Math.PI) * 0.5;
      g.drawImage(soulGlow, x - r, y - r * 2.8, r * 2, r * 5.6);
    }
    // 雲間の魂の渦: 薄い光の弧だけを回し、背景の雲を回転させない。
    g.save(); g.translate(vx * w, vy * h); g.scale(1, 0.4);
    const vr = S.vortexR * h;
    for (let i = 0; i < 3; i++) {
      const angle = t * 0.35 + i * 2.1;
      g.beginPath(); g.arc(0, 0, vr * (0.3 + i * 0.22), angle, angle + 1.9);
      g.lineWidth = h * 0.0025; g.strokeStyle = "rgb(170,255,220)";
      g.globalAlpha = 0.24 + 0.1 * Math.sin(t * 1.1 + i); g.stroke();
    }
    g.restore(); g.globalCompositeOperation = "source-over";
    for (const b of bands.filter((b) => b.kind === "fog")) {
      const off = fract(t * b.speed + 0.37) * w;
      g.globalAlpha = b.alpha;
      g.drawImage(b.img, -off, b.y * h, w, b.h * h);
      g.drawImage(b.img, w - off, b.y * h, w, b.h * h);
    }
    // 時折、遠い鴉が空を横切る (動きを減らす設定では出さない)。
    const flight = t % 37;
    if (!reduced && flight > 9 && flight < 19) {
      for (let i = 0; i < 3; i++) {
        const x = ((flight - 9) / 10 * 1.16 - 0.08 - i * 0.025) * w;
        const y = (0.37 + i * 0.012 + Math.sin(t * 1.4 + i) * 0.004) * h;
        const r = h * 0.004, wing = Math.sin(t * 7 + i) * r;
        g.globalAlpha = 0.8; g.strokeStyle = "#080b16"; g.lineWidth = Math.max(0.7, h * 0.0012);
        g.beginPath(); g.moveTo(x - r * 2, y - wing);
        g.quadraticCurveTo(x - r, y - r, x, y); g.quadraticCurveTo(x + r, y - r, x + r * 2, y - wing); g.stroke();
      }
    }
    g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
  };
  const resize = () => {
    if (failed) return;
    const width = c.getBoundingClientRect().width;
    if (!width) return;
    const w = Math.min(2400, Math.max(240, Math.round(width * (globalThis.devicePixelRatio || 1))));
    const h = Math.round(w * 170 / 240);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; paint(lastTime); }
  };
  const observer = typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null;
  observer?.observe(c);
  loadArt("panorama").then((img) => {
    if (!img || !img.naturalWidth) {
      failed = panoramaFailed = true; observer?.disconnect();
      c.dataset.art = "pixel";
      fallback(c);
      c.dispatchEvent(new Event("townscenechange", { bubbles: true }));
      return;
    }
    im = img; c.dataset.art = "painted"; resize(); paint(lastTime);
  });
  return living(c, paint, 20, true);
}
