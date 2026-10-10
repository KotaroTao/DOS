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
  moon: { rgb: "150,175,255", base: 0.12, amp: 0.03, speed: 0.15, step: 0 },
};

export const hasPaintedVignette = (key) => !!TOWN_KEYART[key];

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
