// 街の「無限迷宮」の札の絵 (2026-10 ユーザーの指示: 酒場・宿屋・祠の下に無限迷宮のバナー)。
// 吹き上げる風の口を上からのぞきこむ、果ての無い縦穴。石の輪が奥へ奥へと沈み続け (降りても降りても底が無い)、
// 底からは青白い風が渦を巻いて昇り、魂の粒が吹き返されてくる。
// 低い解像度 (IW×IH) で描き、表示は pixelated で引き伸ばす (街の札と同じドットの手ざわり)。
// 演出だけ: 遊びの乱数 (rng.js) には触れない。
export const IW = 288, IH = 56;

// 石の段 (暗い → 明るい)・風の段 (淡い青緑)。町の夜景の門の魂光 (soulgreen) に色を合わせる
const STONE = [[7, 6, 12], [15, 12, 24], [26, 20, 40], [40, 31, 58], [57, 45, 78], [78, 63, 100], [104, 86, 124], [134, 114, 148]];
const WIND = [[28, 74, 78], [52, 122, 118], [96, 186, 168], [168, 238, 214], [232, 255, 246]];
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

const CX = IW * 0.27, CY = IH * 0.5, SQ = 1.7; // 口の中心 (左寄り。右に名を載せる) と、奥行きの楕円のつぶれ
const TAU = Math.PI * 2;
const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const fract = (v) => v - Math.floor(v);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
// 段へ量子化 (順序づけた網点で滑らかさを残す)
const pick = (ramp, v, d) => ramp[Math.min(ramp.length - 1, Math.max(0, Math.floor(v * (ramp.length - 1) + d)))];

// 魂の粒 (奥から手前へ昇ってくる)。位置は時刻から決める (状態を持たない)
const MOTES = Array.from({ length: 22 }, (_, i) => ({ a: hash(i, 7) * TAU, s: 0.05 + hash(i, 3) * 0.07, o: hash(i, 11), spin: 0.25 + hash(i, 5) * 0.5 }));

export function paintInfBanner(ctx, img, t) {
  const d = img.data, sec = t / 1000;
  const scroll = sec * 0.32;  // 石の輪が奥へ沈む速さ (降り続ける感じ)
  const swirl = sec * 0.22;   // 風の渦の回る速さ
  for (let y = 0; y < IH; y++) {
    for (let x = 0; x < IW; x++) {
      const dx = (x + 0.5 - CX) / IH, dy = (y + 0.5 - CY) / IH * SQ;
      const r = Math.sqrt(dx * dx + dy * dy) + 1e-4;
      const a = Math.atan2(dy, dx);
      const depth = -Math.log(r);           // 奥行き (対数: 輪が同じ間隔で果てしなく続く)
      const u = depth * 2.6 + scroll * 3;    // 段 (輪) の座標
      const ring = Math.floor(u);
      const segs = 16;
      const sv = (a / TAU + 0.5) * segs + (ring & 1) * 0.5 + ring * 0.13; // 石組みは段ごとにずらし、ゆるく螺旋に
      const seg = Math.floor(sv);
      const fu = fract(u), fs = fract(sv);
      const mortar = fu < 0.12 || fs < 0.06;
      // 石の明るさ: 左上からの明かり × 奥へ行くほど闇に沈む × 石ごとのむら。段の手前の縁を照らす
      const lit = 0.62 + 0.38 * Math.cos(a + 2.3);
      const fog = clamp01(1.05 - (depth + 1.1) * 0.24);
      let v = (0.55 + 0.45 * hash(ring, seg)) * lit * fog * (mortar ? 0.2 : 1);
      if (!mortar && fu > 0.78) v *= 1.3;
      // 底の光 (果てに青白い風の源) と、渦を巻いて昇る風の筋
      const core = clamp01((depth - 1.6) / 1.4);
      const band = fract(a / TAU * 3 - depth * 0.55 + swirl);
      const streak = Math.max(0, 1 - Math.abs(band - 0.5) * 11) * clamp01((depth + 0.6) / 1.6) * (0.6 + 0.4 * Math.sin(sec * 1.3 + a * 2));
      const g = Math.max(core * (0.9 + 0.1 * Math.sin(sec * 2)), streak * 0.62 * (1 - core * 0.5));
      const dth = BAYER[(y & 3) * 4 + (x & 3)];
      const c = g * (WIND.length - 1) + dth > 1.15 ? pick(WIND, g, dth - 0.5) : pick(STONE, clamp01(v), dth - 0.5);
      // 底から照り返す青白い光の暈 (石の色を風の色へ寄せる)
      const halo = clamp01((depth - 0.2) / 2.2) * 0.38 * (0.92 + 0.08 * Math.sin(sec * 2));
      const i = (y * IW + x) * 4;
      d[i] = c[0] + (52 - c[0]) * halo; d[i + 1] = c[1] + (150 - c[1]) * halo; d[i + 2] = c[2] + (140 - c[2]) * halo; d[i + 3] = 255;
    }
  }
  // 魂の粒: 奥 (深い z) から手前へ吹き返され、近づくほど明るく大きく
  for (const m of MOTES) {
    const p = fract(m.o + sec * m.s);           // 0 = 底 → 1 = 口
    const r = Math.exp(-3.4 * (1 - p)) * 1.2, a = m.a + sec * m.spin + p * 2;
    const x = Math.round(CX + Math.cos(a) * r * IH), y = Math.round(CY + Math.sin(a) * r * IH / SQ);
    const c = WIND[Math.min(WIND.length - 1, 1 + Math.floor(p * 4))];
    const k = p > 0.75 ? 2 : 1;
    for (let oy = 0; oy < k; oy++) for (let ox = 0; ox < k; ox++) {
      const px = x + ox, py = y + oy;
      if (px < 0 || py < 0 || px >= IW || py >= IH) continue;
      const i = (py * IW + px) * 4;
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2];
    }
  }
  ctx.putImageData(img, 0, 0);
}

// 札の canvas。表示中は約12fps で動かし、外れたら止まる。still = 動きを減らす設定なら1枚だけ
export function infBannerCanvas({ still = false } = {}) {
  const cv = document.createElement("canvas");
  cv.width = IW; cv.height = IH;
  const ctx = cv.getContext("2d");
  if (!ctx) return cv;
  const img = ctx.createImageData(IW, IH);
  const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
  const draw = (t) => { try { paintInfBanner(ctx, img, t); } catch (e) { /* 演出のみ */ } };
  draw(still ? 4000 : now());
  if (still || typeof requestAnimationFrame !== "function") return cv;
  let last = 0, seen = false;
  const born = now();
  const tick = (t) => {
    if (cv.isConnected) seen = true;
    else if (seen || now() - born > 5000) return; // 街を描き直して札が外れたら (置かれないまま5秒たっても) 止める
    if (!(typeof document !== "undefined" && document.hidden) && t - last > 80) { last = t; if (cv.isConnected) draw(t); }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return cv;
}
