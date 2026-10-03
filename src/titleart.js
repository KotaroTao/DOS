// タイトル画面の一枚絵 —「百の迷宮の門」
//
// 月下の大墓所。その奥に、地の底へ降りる大門が口を開け、喰われた魂の火 (青緑) が
// 階段を這い上がってくる。門の両脇には顔のない頭巾の巨像が剣を突き立てて立ち、
// 傾いだ墓標の列の手前に、ランタンを提げた魂繰りがひとり、背を向けて立つ。
//
// 光源は 3 つだけ: 門の魂火 (主光・下から)、背後の月 (縁の照り返し)、ランタンのおき火。
// 静止部分は層ごとに一度だけ描いてキャッシュし、毎フレームは光・霧・粒子・鴉だけを動かす。
import {
  Layer, Mask, worley, softCanvas, rc, mix, clamp, smooth, fbm, vnoise, h1, h2, rng, glowSprite,
  R_NIGHT, R_BONE, R_SOUL, R_EMBER, R_BLOOD, R_DUSK, R_FOG, R_STEEL, R_SOULSTONE,
} from "./pxpaint.js";

// ---------------------------------------------------------------------------
// 共有の形: 尖頭アーチ (r = 半径 / a = 半幅)。半径を 2.2a にして少し細身のランセットに
export function inArch(x, y, cx, sy, a, rr = 2.2) {
  if (Math.abs(x - cx) > a) return false;
  if (y >= sy) return true;
  const r = a * rr, off = r - a;
  const d1 = (x - (cx - off)) ** 2 + (y - sy) ** 2, d2 = (x - (cx + off)) ** 2 + (y - sy) ** 2;
  return d1 <= r * r && d2 <= r * r;
}
export const archApex = (a, rr = 2.2) => a * Math.sqrt(rr * rr - (rr - 1) * (rr - 1));

// 点光源の減衰
export const fall = (x, y, L) => {
  const d = Math.hypot((x - L.x) / L.r, ((y - L.y) / L.r) * (L.sq || 1));
  return d >= 1 ? 0 : (1 - d) * (1 - d);
};

// ---------------------------------------------------------------------------
// 人の形 (写実の頭身 ≒ 7.5 頭身)。座標は「足元=0 / 頭頂=1」の正規化値 (u: 横, v: 縦)
// 背を向けた外套の魂繰り。右手 (画面右) にランタンを提げ、外套の裾は風で左へ流れる。
export function cloakedBack(m, fx, feet, h, { wind = 1, lantern = true, sword = true, seed = 3 } = {}) {
  const P = (pts) => { const o = []; for (let i = 0; i < pts.length; i += 2) o.push(fx + pts[i] * h, feet - pts[i + 1] * h); return o; };
  // 外套 (肩から裾へ、ぼろぼろの裾)
  const hem = [];
  const hl = -0.2 - 0.05 * wind, hr = 0.165;
  const N = 14;
  for (let i = N; i >= 0; i--) {
    const t = i / N;
    const u = hl + (hr - hl) * t;
    const tear = (h2(i, 3, seed) < 0.45 ? 0.035 : 0) + h2(i, 5, seed) * 0.03;
    hem.push(u, 0.075 + tear * (i % 2 ? 1 : 0.4) + (1 - t) * 0.02 * wind);
  }
  const cloak = P([
    0.0, 0.875, 0.05, 0.86, 0.1, 0.835, 0.13, 0.81, 0.145, 0.77, 0.152, 0.7, 0.156, 0.6,
    0.158, 0.45, 0.162, 0.3, hr, 0.12,
    ...hem,
    hl, 0.1, -0.185 - 0.03 * wind, 0.3, -0.165 - 0.012 * wind, 0.5, -0.152, 0.66, -0.145, 0.77, -0.13, 0.81, -0.1, 0.835, -0.05, 0.86,
  ]);
  m.poly(cloak, 2);
  // 頭巾 (後ろへ尖る)
  m.poly(P([0.0, 1.0, 0.03, 0.995, 0.058, 0.975, 0.07, 0.94, 0.072, 0.9, 0.068, 0.865, 0.06, 0.835, 0.0, 0.8, -0.06, 0.835, -0.068, 0.865, -0.072, 0.9, -0.07, 0.94, -0.058, 0.975, -0.03, 0.995]), 3);
  // 脚 (裾の下にわずかに覗く長靴)
  m.poly(P([-0.075, 0.1, -0.03, 0.1, -0.028, 0.0, -0.085, 0.0, -0.088, 0.02]), 4);
  m.poly(P([0.03, 0.1, 0.075, 0.1, 0.08, 0.02, 0.085, 0.0, 0.03, 0.0]), 4);
  // 腰の長剣 (外套の下から鞘の先が斜めに覗く)
  if (sword) m.line(fx - 0.12 * h, feet - 0.3 * h, fx - 0.215 * h, feet - 0.06 * h, Math.max(1.2, 0.022 * h), 5, Math.max(1, 0.016 * h));
  // 右腕 (外套の合わせ目から出て、ランタンを体から離して提げる)
  if (lantern) {
    m.poly(P([0.12, 0.79, 0.16, 0.76, 0.2, 0.62, 0.215, 0.5, 0.19, 0.49, 0.175, 0.6, 0.14, 0.7, 0.115, 0.72]), 6);
    m.ellipse(fx + 0.203 * h, feet - 0.485 * h, 0.022 * h, 0.022 * h, 6); // 手
    // 吊り輪とランタン
    m.line(fx + 0.203 * h, feet - 0.47 * h, fx + 0.203 * h, feet - 0.435 * h, 1, 7);
    m.poly(P([0.18, 0.435, 0.226, 0.435, 0.232, 0.42, 0.174, 0.42]), 7); // 笠
    m.rect(fx + 0.178 * h, feet - 0.42 * h, 0.05 * h, 0.075 * h, 8);     // 火袋
    m.poly(P([0.172, 0.345, 0.234, 0.345, 0.226, 0.33, 0.18, 0.33]), 7); // 台
  }
  return { lantern: { x: fx + 0.203 * h, y: feet - 0.382 * h }, head: { x: fx, y: feet - 0.93 * h } };
}

// 背を向けた魂繰りを塗る。light = 背後の主光 (この方向の縁だけが細く光る) / lamp = 手元のランタン
export function shadeCloaked(Lr, m, fx, feet, h, { light, lamp, rimRamp = R_SOUL, rimK = 1, moonRim = 0.45, base0 = 0 } = {}) {
  const c35 = 0.8, s35 = 0.6;
  Lr.paint(m, (x, y, v) => {
    const u = (x + 0.5 - fx) / h, vv = (feet - y - 0.5) / h;
    if (v === 8) { // 火袋: 揺らめくおき火
      const t = (y - (feet - 0.42 * h)) / (0.075 * h);
      return rc(R_EMBER, 0.62 + 0.38 * (1 - Math.abs(t - 0.55) * 1.6) + (h2(x, y, 9) - 0.5) * 0.1);
    }
    // 衣の地色: ほぼ黒のすみれ。外套のひだは肩へ向けて集まる縦の起伏
    let base = 0.08 + base0;
    if (v === 2) {
      const w = 0.15 + (0.83 - vv) * 0.08;
      const f = Math.sin((u / w) * Math.PI * 3.2 + vnoise(u * 9, vv * 3, 4) * 2.2);
      base += f * 0.04 * clamp(1.15 - vv) + (vv < 0.2 ? -0.015 : 0) + (vv > 0.74 ? 0.02 : 0);
    } else if (v === 3) base = 0.07 + base0 + (vv > 0.95 ? 0.025 : 0);
    else if (v === 4) base = 0.05 + base0;
    else if (v === 5) base = 0.13 + base0;
    else if (v === 6) {
      base = 0.1 + base0;
      // 腕と外套の境目を暗い線で切り分ける
      if (m.at(x - 1, y) === 2 || m.at(x, y + 1) === 2 || m.at(x - 1, y + 1) === 2) base = 0.02;
    } else if (v === 7) base = 0.22;
    let c = rc(R_NIGHT, base);
    // 背後の主光: 光の方向に外が見える画素だけが縁取られる
    if (light) {
      let dx = light.x - x, dy = light.y - y;
      const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
      const d = m.rim(x, y, dx, dy, 2);
      let r = d === 1 ? 1 : d === 2 ? 0.4 : 0;
      if (m.rim(x, y, dx * c35 - dy * s35, dx * s35 + dy * c35, 1) === 1 || m.rim(x, y, dx * c35 + dy * s35, -dx * s35 + dy * c35, 1) === 1) r = Math.max(r, 0.55);
      const kk = r * rimK * (light.k || 1);
      if (kk > 0.05) c = mix(c, rc(rimRamp, 0.3 + 0.62 * clamp(kk)), clamp(kk));
    }
    if (moonRim && m.rim(x, y, 0, -1, 1) === 1) c = mix(c, rc(R_DUSK, 0.75), moonRim);
    // ランタンの照り返し
    if (lamp) {
      const d = Math.hypot(x - lamp.x, (y - lamp.y) * 0.8) / (0.36 * h);
      if (d < 1) {
        const kk = (1 - d) ** 2 * (x > lamp.x - 0.1 * h ? 1 : 0.35);
        const e = m.rim(x, y, Math.sign(lamp.x - x) || 1, Math.sign(lamp.y - y) * 0.5, 2) <= 2 ? 1.6 : 0.7;
        c = mix(c, rc(R_EMBER, 0.25 + 0.4 * kk), clamp(kk * e * 0.85));
      }
    }
    return c;
  });
}

// ---------------------------------------------------------------------------
// 顔のない頭巾の巨像 (正面)。剣の柄頭に両手を重ね、切っ先を台座に立てる
export function statueShape(m, cx, foot, h) {
  const P = (pts) => { const o = []; for (let i = 0; i < pts.length; i += 2) o.push(cx + pts[i] * h, foot - pts[i + 1] * h); return o; };
  // 衣 (肩から裾へわずかに広がる)
  m.poly(P([-0.075, 0.875, -0.13, 0.835, -0.152, 0.79, -0.158, 0.7, -0.162, 0.5, -0.17, 0.2, -0.185, 0.03, -0.17, 0.0, 0.17, 0.0, 0.185, 0.03, 0.17, 0.2, 0.162, 0.5, 0.158, 0.7, 0.152, 0.79, 0.13, 0.835, 0.075, 0.875]), 1);
  // 頭巾
  m.poly(P([0, 1.0, 0.035, 0.99, 0.062, 0.96, 0.075, 0.92, 0.078, 0.875, 0.09, 0.84, 0.0, 0.81, -0.09, 0.84, -0.078, 0.875, -0.075, 0.92, -0.062, 0.96, -0.035, 0.99]), 2);
  // 顔の闇
  m.poly(P([0, 0.958, 0.03, 0.945, 0.04, 0.91, 0.036, 0.872, 0.0, 0.85, -0.036, 0.872, -0.04, 0.91, -0.03, 0.945]), 3);
  // 袖 (肩から柄頭の手元へ)
  m.poly(P([-0.15, 0.79, -0.118, 0.8, -0.06, 0.66, -0.032, 0.6, -0.035, 0.555, -0.09, 0.58, -0.135, 0.64, -0.165, 0.7]), 4);
  m.poly(P([0.15, 0.79, 0.118, 0.8, 0.06, 0.66, 0.032, 0.6, 0.035, 0.555, 0.09, 0.58, 0.135, 0.64, 0.165, 0.7]), 4);
  // 剣: 柄頭・握り・鍔・刃
  m.ellipse(cx, foot - 0.61 * h, 0.016 * h, 0.014 * h, 5);
  m.rect(cx - 0.009 * h, foot - 0.6 * h, 0.018 * h, 0.075 * h, 5);
  m.ellipse(cx, foot - 0.575 * h, 0.04 * h, 0.022 * h, 6); // 重ねた手
  m.poly(P([-0.085, 0.53, -0.09, 0.515, 0.0, 0.508, 0.09, 0.515, 0.085, 0.53, 0.0, 0.523]), 5); // 鍔 (下へ反る)
  m.poly(P([-0.018, 0.508, 0.018, 0.508, 0.014, 0.05, 0.0, 0.0, -0.014, 0.05]), 7); // 刃
}

// ---------------------------------------------------------------------------
// 墓標の形 (種類 kind 0-4)。lean = 傾き (高さあたりの横ずれ)
export function graveShape(m, x, base, s, kind, lean, v = 1) {
  const sh = (px, py) => [x + px * s + lean * py * s, base - py * s];
  const P = (pts) => { const o = []; for (let i = 0; i < pts.length; i += 2) o.push(...sh(pts[i], pts[i + 1])); return o; };
  if (kind === 0) { // 丸頭の墓石
    const pts = [-3, 0, -3, 6];
    for (let i = 0; i <= 8; i++) { const a = Math.PI - (i / 8) * Math.PI; pts.push(Math.cos(a) * 3, 6 + Math.sin(a) * 3); }
    pts.push(3, 0);
    m.poly(P(pts), v);
  } else if (kind === 1) { // 十字
    m.poly(P([-0.8, 0, -0.8, 7, -3, 7, -3, 8.6, -0.8, 8.6, -0.8, 11, 0.8, 11, 0.8, 8.6, 3, 8.6, 3, 7, 0.8, 7, 0.8, 0]), v);
  } else if (kind === 2) { // 環の十字 (ケルト)
    m.poly(P([-0.9, 0, -0.9, 8, -3.4, 8, -3.4, 9.6, -0.9, 9.6, -0.9, 12.4, 0.9, 12.4, 0.9, 9.6, 3.4, 9.6, 3.4, 8, 0.9, 8, 0.9, 0]), v);
    const c = sh(0, 8.8);
    for (let a = 0; a < 24; a++) { const t = (a / 24) * Math.PI * 2; m.rect(c[0] + Math.cos(t) * 2.2 * s - 0.5, c[1] + Math.sin(t) * 2.2 * s - 0.5, Math.max(1, s * 0.6), Math.max(1, s * 0.6), v); }
  } else if (kind === 3) { // 尖頭の墓碑
    m.poly(P([-2.6, 0, -2.6, 7, 0, 10.5, 2.6, 7, 2.6, 0]), v);
  } else { // 欠けた石板
    m.poly(P([-3.2, 0, -3.2, 5.5, -1, 6.6, 0.4, 5.6, 1.6, 6.2, 3.2, 5, 3.2, 0]), v);
  }
}

// ねじれた枯れ木。dir = 枝を張り出す向き (1=右へ)、reach = 横への最大の張り出し
export function gnarledTree(m, x0, y0, h, dir, reach, k, R, perches, th0 = 15 * k) {
  const N = 12, pts = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    pts.push([x0 + dir * (Math.sin(t * 2.6) * 0.07 * h + t * t * 0.06 * h) + (R() - 0.5) * 2 * k, y0 - t * h]);
  }
  const th1 = th0 * 0.24;
  const thAt = (t) => th0 + (th1 - th0) * Math.pow(t, 0.8);
  for (let i = 0; i < N; i++) m.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], thAt(i / N), 1, thAt((i + 1) / N));
  m.poly([x0 - th0 * 1.3, y0 + 1, x0 + th0 * 1.4, y0 + 1, x0 + th0 * 0.45, y0 - th0 * 1.3, x0 - th0 * 0.45, y0 - th0 * 1.3]); // 根張り
  const limbs = [];
  const branch = (bx, by, ang, len, th, depth, rec) => {
    let cx = bx, cy = by, a = ang;
    const path = [[cx, cy]];
    for (let i = 0; i < 3; i++) {
      a += (R() - 0.5) * 0.75;
      a = Math.max(-Math.PI + 0.15, Math.min(-0.12, a)); // 下へは垂れない
      const nx = cx + Math.cos(a) * len / 3, ny = cy + Math.sin(a) * len / 3;
      if (Math.abs(nx - x0) > reach) break;
      m.line(cx, cy, nx, ny, Math.max(1, th * (1 - i / 6)), 1, Math.max(1, th * (1 - (i + 1) / 6)));
      cx = nx; cy = ny; path.push([cx, cy]);
    }
    if (rec) rec.push(path);
    if (depth <= 0 || th < 1.3) { if (R() < 0.55 && Math.abs(Math.cos(a)) > 0.3) perches.push({ x: cx, y: cy }); return; }
    for (let i = 0; i < 2; i++) branch(cx, cy, a + (i ? 1 : -1) * (0.3 + R() * 0.5), len * (0.5 + R() * 0.2), th * 0.58, depth - 1, null);
    if (R() < 0.4) branch(cx, cy, a, len * 0.4, th * 0.4, 0, null);
  };
  for (const [t, side, lk] of [[0.48, 1, 0.62], [0.6, -1, 0.3], [0.74, 1, 0.48], [0.88, -0.4, 0.34]]) {
    const p = pts[Math.round(t * N)];
    const rec = [];
    branch(p[0], p[1], -Math.PI / 2 + dir * side * (0.75 + R() * 0.35), reach * lk, thAt(t) * 0.62, 3, rec);
    limbs.push(rec[0]);
  }
  branch(pts[N][0], pts[N][1], -Math.PI / 2 + dir * 0.25, reach * 0.3, th1, 2, null);
  return { limbs };
}

// ---------------------------------------------------------------------------
// 吊るし籠 (ギベット) と中の骸。枝先から鎖で下がる
export function gibbet(m, x, y, len, s, v = 1) {
  for (let i = 0; i < len; i++) if (i % 3 !== 2) m.rect(x, y + i, 1, 1, v);
  const cy = y + len, hgt = 22 * s, w = 6.5 * s;
  // 籠の輪郭 (樽形) と縦の鉄格子
  for (let j = 0; j <= hgt; j++) {
    const t = j / hgt;
    const hw = w * (0.55 + 0.45 * Math.sin(Math.min(1, t * 1.15) * Math.PI * 0.95));
    if (j === 0 || j === Math.round(hgt) || j === Math.round(hgt * 0.5)) m.rect(x - hw, cy + j, hw * 2 + 1, 1, v);
    for (const f of [-1, -0.45, 0.1, 0.62, 1]) m.rect(Math.round(x + f * hw), cy + j, 1, 1, v);
  }
  m.poly([x - 2 * s, cy, x + 2 * s, cy, x + 0.5, cy - 3 * s], v);
  // 骸: 傾いだ頭蓋と、格子からはみ出す腕の骨
  m.ellipse(x - 1.2 * s, cy + 5 * s, 2.3 * s, 2.6 * s, v);
  m.line(x - 1 * s, cy + 7 * s, x + 0.5 * s, cy + 15 * s, Math.max(1, 2.4 * s), v, Math.max(1, 1.6 * s));
  m.line(x + 1 * s, cy + 9 * s, x + w + 3 * s, cy + 15 * s, 1, v);
  m.line(x + w + 3 * s, cy + 15 * s, x + w + 3.5 * s, cy + 21 * s, 1, v);
  m.line(x, cy + 15 * s, x - 2 * s, cy + hgt + 4 * s, 1, v);
  return { x, y: cy + hgt };
}

// 層の合間に一息つく (ロゴの入りの演出を止めないよう、描画を数フレームに分ける)
const tick = () => new Promise((r) => setTimeout(r, 0));

// 一枚絵を層ごとに描く。lay = { top, bot, ml } (ロゴの下端 / メニューの上端 / メニューの左端、どれも絵の座標)
export async function paintTitle(W, H, lay) {
  const portrait = H / W > 1.15;
  const top = lay.top, bot = lay.bot;
  // 主題 (門・巨像・魂繰り) の大きさ k と位置。縦長は門の下に人物、横長は人物を左手前へ
  let k, gb, gx = Math.round(W / 2);
  if (portrait) {
    k = Math.min(W / 250, (bot - top + 10) / 250);
    gb = Math.round(bot - 72 * k);
  } else {
    k = Math.min(W * 0.62 / 240, (bot - top + 8) / 192);
    gb = Math.round(bot - 14 * k);
  }
  k = Math.max(0.45, k);
  const aw = 25 * k;                       // 門の開口の半幅
  const sy = gb - 46 * k;                  // アーチの起拱線
  const apex = sy - archApex(aw);
  const hz = Math.round(gb - 22 * k);      // 墓所の奥の地平
  const soul = { x: gx, y: gb - 22 * k, r: 150 * k, sq: 1.15 };
  const soulLow = { x: gx, y: gb + 6 * k, r: 175 * k, sq: 0.8 }; // 巨像を下から煽る光
  const moon = { x: gx, y: Math.round(gb - 130 * k), r: Math.round((portrait ? 52 : 48) * k) };
  // 人物
  const fig = portrait
    ? { x: Math.round(gx - 4 * k), feet: Math.round(gb + 68 * k), h: Math.round(102 * k) }
    : (() => {
      // 横長: 左手前。ランタンがメニュー (ml = 左端) に隠れないよう大きさと位置を決める
      const ml = lay.ml != null ? lay.ml : W * 0.3;
      let h = Math.min(H * 0.52, 128 * k);
      let x = Math.max(W * 0.11, gx - 160 * k);
      if (x + 0.26 * h > ml - 3) { x = Math.max(0.12 * h, ml - 3 - 0.26 * h); }
      if (x + 0.26 * h > ml - 3) h = Math.max(H * 0.3, (ml - 3 - x) / 0.26);
      return { x: Math.round(x), feet: Math.round(H - 4), h: Math.round(h) };
    })();
  const lampPos = { x: fig.x + 0.203 * fig.h, y: fig.feet - 0.382 * fig.h };
  const lamp = { x: lampPos.x, y: lampPos.y, r: (portrait ? 64 : 84) * k, sq: 1.3 };
  const vp = { x: gx, y: gb - 30 * k }; // 門の奥の光の芯 (消失点)

  // =================== 空 ===================
  const sky = new Layer(W, H);
  const skyH = Math.min(H, gb + 4);
  sky.shade(0, 0, W - 1, skyH, (x, y) => {
    const t = y / skyH;
    let c = rc(R_NIGHT, 0.02 + t * t * 0.4);
    const dm = Math.hypot(x - moon.x, y - moon.y) / moon.r;
    if (dm > 1) {
      const halo = Math.exp(-(dm - 1) * 1.2);
      c = mix(c, rc(R_DUSK, 0.25 + 0.5 * halo), clamp(halo * 0.75));
      if (dm < 1.3) c = mix(c, rc(R_BONE, 0.06), smooth(1.3, 1.0, dm) * 0.5);
    }
    c = mix(c, rc(R_BLOOD, 0.2), smooth(0.72, 1.0, t) * 0.35); // 地平のかすかな血の色
    // 雲: 月の方向から照らされる起伏 (エンボス)
    const n1 = fbm(x * 0.016 / k, y * 0.05 / k, 11, 5);
    const n2 = fbm((x - Math.sign(x - moon.x) * 3) * 0.016 / k, (y + 2.5) * 0.05 / k, 11, 5);
    const band = smooth(0.22, 0.5, t) * (1 - smooth(0.9, 1.0, t)) + 0.4 * smooth(0.05, 0.16, t) * (1 - smooth(0.3, 0.42, t));
    const dens = smooth(0.47, 0.64, n1) * band;
    if (dens > 0.02) {
      const lit = clamp((n1 - n2) * 9 + 0.3);
      const nearMoon = Math.exp(-Math.max(0, dm - 0.6) * 0.85);
      let cc = rc(R_NIGHT, 0.1 + 0.16 * lit + 0.12 * t);
      cc = mix(cc, rc(R_BONE, 0.12 + 0.32 * lit), nearMoon * lit * 0.85);
      cc = mix(cc, rc(R_DUSK, 0.6), nearMoon * (1 - lit) * 0.4);
      c = mix(c, cc, clamp(dens * 1.4));
    }
    return c;
  });
  {
    const mm = new Mask(W, H).ellipse(moon.x, moon.y, moon.r, moon.r);
    sky.paint(mm, (x, y) => {
      const dx = (x + 0.5 - moon.x) / moon.r, dy = (y + 0.5 - moon.y) / moon.r;
      const d = Math.hypot(dx, dy);
      const limb = Math.sqrt(Math.max(0, 1 - d * d));
      const mare = fbm(dx * 2.2 + 5, dy * 2.2 + 5, 21, 4);
      const crater = vnoise(dx * 9, dy * 9, 23);
      const v = 0.22 + 0.55 * limb - smooth(0.5, 0.62, mare) * 0.26 - (crater > 0.8 ? 0.07 : 0) + (dx < 0 ? 0.05 : -0.05);
      let c = rc(R_BONE, clamp(v));
      c = mix(c, rc(R_BLOOD, 0.72), 0.2 + 0.28 * (1 - limb));
      const cl = fbm(x * 0.02 / k, y * 0.09 / k, 31, 4);
      const band = smooth(0.52, 0.66, cl);
      if (band > 0) c = mix(c, rc(R_NIGHT, 0.3), band * 0.85);
      return c;
    });
  }
  {
    const R = rng(77);
    for (let i = 0; i < (W * skyH) / 240; i++) {
      const x = Math.floor(R() * W), y = Math.floor(R() * skyH * 0.7);
      const b = R();
      if (Math.hypot(x - moon.x, y - moon.y) < moon.r * 1.6) continue;
      const cur = sky.get(x, y);
      if (!cur || cur[0] + cur[1] + cur[2] > 60) continue;
      sky.px(x, y, b < 0.1 ? rc(R_BONE, 0.9) : b < 0.4 ? rc(R_FOG, 0.8) : rc(R_NIGHT, 0.75));
    }
  }

  await tick();
  // =================== 遠景: 山並みと滅びた都の尖塔 ===================
  const far = new Layer(W, H);
  {
    const ridge = (x) => hz - 6 * k - (18 * k) * fbm(x * 0.012 / k, 0.5, 41, 4) - 10 * k * Math.abs(Math.sin(x * 0.006 / k + 1));
    far.shade(0, 0, W - 1, gb + 2, (x, y) => {
      const ry = ridge(x);
      if (y < ry) return null;
      let c = rc(R_NIGHT, 0.27 - clamp((y - ry) / 24) * 0.05);
      if (y - ry < 1.2) c = mix(c, rc(R_DUSK, 0.7), 0.6);
      return c;
    });
    const R = rng(91);
    const spire = (x, hh, w) => {
      const m = new Mask(W, H);
      m.rect(x - w / 2, hz - hh, w, hh + 8);
      m.poly([x - w / 2 - 0.5, hz - hh, x + w / 2 + 0.5, hz - hh, x, hz - hh - w * 2.4]);
      m.rect(x - 0.5, hz - hh - w * 2.4 - 3 * k, 1, 3 * k);
      far.paint(m, (px, py) => {
        let c = rc(R_NIGHT, 0.24);
        if (!m.at(px - 1, py) && px < moon.x) c = rc(R_DUSK, 0.6);
        if (!m.at(px + 1, py) && px > moon.x) c = rc(R_DUSK, 0.6);
        if (h2(px, py, 5) < 0.012 && py > hz - hh + 3) c = rc(R_EMBER, 0.35);
        return c;
      });
    };
    for (let i = 0; i < 9; i++) {
      const side = i % 2 ? 1 : -1;
      const x = gx + side * (70 * k + R() * Math.max(30, W / 2 - 60 * k));
      spire(x, (18 + R() * 30) * k, Math.max(2, Math.round((3 + R() * 3) * k)));
    }
  }

  await tick();
  // =================== 中景: 大門・崩れた外壁・巨像 ===================
  const mid = new Layer(W, H);
  {
    const wallTop = (x) => {
      const d = Math.abs(x - gx);
      const broken = vnoise(x * 0.08 / k, 3, 51);
      return gb - (50 * k) * (1 - smooth(70 * k, W * 0.75, d) * 0.45) + (broken > 0.62 ? (broken - 0.62) * 70 * k : 0) + ((Math.floor(x / (6 * k)) % 2) ? 0 : -2 * k);
    };
    const wm = new Mask(W, H);
    for (let x = 0; x < W; x++) wm._span(0, 0, -1, 0);
    for (let x = 0; x < W; x++) { const y0 = Math.max(0, Math.round(wallTop(x))); for (let y = y0; y <= gb; y++) wm.m[y * W + x] = 1; }
    wm.x0 = 0; wm.x1 = W - 1; wm.y0 = Math.max(0, Math.round(gb - 60 * k)); wm.y1 = gb;
    const cs = Math.max(3, Math.round(5 * k));
    mid.paint(wm, (x, y) => {
      const row = Math.floor((gb - y) / cs);
      const block = ((gb - y) % cs === 0) || ((x + (row % 2) * cs) % (cs * 2) === 0);
      const v = 0.2 + vnoise(x * 0.3, y * 0.3, 52) * 0.06 - (block ? 0.05 : 0) + (gb - y) / (60 * k) * 0.04;
      let c = rc(R_NIGHT, v);
      const s = fall(x, y, soul);
      if (s > 0) c = mix(c, rc(R_SOULSTONE, 0.2 + 0.45 * s), clamp(s * 1.3));
      if (!wm.at(x, y - 1)) c = mix(c, rc(R_DUSK, 0.6), 0.55);
      return c;
    });
    const R = rng(13);
    for (let i = 0; i < 10; i++) {
      const side = i % 2 ? 1 : -1;
      const x = gx + side * (66 * k + R() * (W / 2));
      const y = wallTop(x) + 1;
      const kind = R();
      if (x < 0 || x >= W) continue;
      const m = new Mask(W, H);
      if (kind < 0.5) graveShape(m, x, y, k * 0.9, 1, (R() - 0.5) * 0.3);
      else { // 嘆きの天使
        const hh = 20 * k;
        m.ellipse(x, y - hh * 0.92, hh * 0.06, hh * 0.075);
        m.poly([x - hh * 0.1, y - hh * 0.82, x + hh * 0.1, y - hh * 0.82, x + hh * 0.13, y, x - hh * 0.13, y]);
        m.poly([x - hh * 0.1, y - hh * 0.8, x - hh * 0.32, y - hh * 0.98, x - hh * 0.34, y - hh * 0.6, x - hh * 0.12, y - hh * 0.4]);
        m.poly([x + hh * 0.1, y - hh * 0.8, x + hh * 0.32, y - hh * 0.98, x + hh * 0.34, y - hh * 0.6, x + hh * 0.12, y - hh * 0.4]);
      }
      mid.paint(m, (px, py) => {
        let c = rc(R_NIGHT, 0.17);
        if (!m.at(px, py - 1) || (!m.at(px + Math.sign(moon.x - px), py))) c = rc(R_DUSK, 0.7);
        return c;
      });
    }
  }
  // 大門のファサード
  const gateM = new Mask(W, H);
  const fw = 58 * k, towerIn = 42 * k, gableTop = gb - 150 * k;
  {
    const m = gateM;
    m.rect(gx - fw, gb - 104 * k, fw * 2, 104 * k + 1, 1);
    m.poly([gx - 48 * k, gb - 100 * k, gx + 48 * k, gb - 100 * k, gx, gableTop], 2);
    m.rect(gx - 1.6 * k, gableTop - 16 * k, 3.2 * k, 17 * k, 2);
    m.rect(gx - 6 * k, gableTop - 12 * k, 12 * k, 3 * k, 2);
    for (const sd of [-1, 1]) {
      const x0 = gx + sd * towerIn, x1 = gx + sd * fw;
      const xa = Math.min(x0, x1), xb = Math.max(x0, x1);
      m.rect(xa, gb - 128 * k, xb - xa, 128 * k + 1, 3);
      m.poly([xa - 1.5 * k, gb - 128 * k, xb + 1.5 * k, gb - 128 * k, xb + 1.5 * k, gb - 132 * k, xa - 1.5 * k, gb - 132 * k], 3);
      m.poly([xa, gb - 132 * k, xb, gb - 132 * k, (xa + xb) / 2, gb - 172 * k], 3);
      for (const e of [xa - 2 * k, xb + 2 * k]) m.poly([e - 2 * k, gb - 124 * k, e + 2 * k, gb - 124 * k, e, gb - 144 * k], 3);
    }
  }
  const openM = new Mask(W, H);
  for (let y = Math.max(0, Math.floor(apex) - 1); y <= Math.min(H - 1, gb); y++) for (let x = Math.max(0, Math.floor(gx - aw) - 1); x <= Math.min(W - 1, gx + aw + 1); x++) {
    if (inArch(x + 0.5, y + 0.5, gx, sy, aw)) openM._span(y, x, x, 1);
  }
  const order = (x, y) => {
    if (inArch(x, y, gx, sy, aw)) return 0;
    for (let i = 1; i <= 3; i++) if (inArch(x, y, gx, sy, aw + i * 4 * k)) return i;
    return 9;
  };
  mid.paint(gateM, (x, y, v) => {
    const px = x + 0.5, py = y + 0.5;
    const o = order(px, py);
    if (o === 0) return null;
    const s = fall(px, py, soul);
    const n = vnoise(x * 0.35, y * 0.35, 61);
    let base = 0.21 + n * 0.06;
    const course = Math.max(3, Math.round(6 * k));
    const row = Math.floor((gb - y) / course);
    if ((gb - y) % course === 0 && o === 9) base -= 0.05;
    if (o === 9 && (x + (row % 2) * course) % (course * 2) === 0) base -= 0.04;
    let c = rc(R_NIGHT, base);
    let lit = s * 0.55;
    if (o >= 1 && o <= 3) {
      const inner = !inArch(px - Math.sign(px - gx) * 1.2, py + (py < sy ? 1.2 : 0), gx, sy, aw + (o - 1) * 4 * k) ? 0 : 1;
      base = 0.2 + (3 - o) * 0.03;
      c = rc(R_NIGHT, base + n * 0.04);
      lit = s * (0.8 + inner * 0.6);
      if (inArch(px, py, gx, sy, aw + (o - 1) * 4 * k + 1.2)) lit *= 1.6;
      if (py > sy) { const f = ((Math.abs(px - gx) - aw) % (4 * k)) / (4 * k); base += Math.sin(f * Math.PI) * 0.06; c = rc(R_NIGHT, base); }
      if (Math.abs(py - sy) < 2 * k) c = rc(R_NIGHT, 0.3);
    }
    if (v === 2 && o === 9) {
      const rx = px - gx, ry = py - (gb - 121 * k);
      const d = Math.hypot(rx, ry) / (13 * k);
      if (d < 1) {
        if (d > 0.82) { c = rc(R_NIGHT, 0.26); lit *= 1.3; }
        else {
          const sk = Math.hypot(rx / 6.4, (ry + 0.5 * k) / 7) / k;
          const jaw = Math.abs(rx) < 3.6 * k && ry > 3.5 * k && ry < 7.5 * k;
          const eye = Math.hypot(Math.abs(rx) - 2.4 * k, ry + 0.6 * k) < 1.6 * k;
          const nose = Math.abs(rx) < 0.8 * k && ry > 1.6 * k && ry < 3.4 * k;
          const crown = ry < -5.5 * k && ry > -10 * k && Math.abs(rx) < 6.5 * k && ((ry > -7.6 * k) || (Math.abs(rx) % (3.2 * k) < 1.3 * k));
          if ((sk < 1 || jaw || crown) && !eye && !nose) { c = crown ? rc(R_BONE, 0.08) : rc(R_NIGHT, 0.36 + (rx < 0 ? 0.06 : 0)); lit *= 1.5; }
          else if (eye) { c = rc(R_NIGHT, 0.0); lit = 0; }
          else c = rc(R_NIGHT, 0.06);
        }
      }
      if (!gateM.at(x, y - 1) || !gateM.at(x - 1, y - 1) || !gateM.at(x + 1, y - 1)) c = mix(c, rc(R_BONE, 0.1), 0.5);
    }
    if (v === 3) {
      const xt = Math.abs(px - gx);
      const f = (xt - towerIn) / (fw - towerIn);
      base = 0.18 + Math.sin(f * Math.PI * 3) * 0.035 + n * 0.05;
      c = rc(R_NIGHT, base);
      const wx = gx + Math.sign(px - gx) * (towerIn + fw) / 2;
      if (inArch(px, py, wx, gb - 98 * k, 2.6 * k) && py < gb - 80 * k) { c = rc(R_NIGHT, 0.02); lit *= 0.2; }
      if (inArch(px, py, wx, gb - 40 * k, 3 * k) && py < gb - 18 * k) { c = rc(R_NIGHT, 0.02); lit *= 0.3; }
      lit *= xt < towerIn + 3 * k ? 1.3 : 0.6;
    }
    if (lit > 0.02) c = mix(c, rc(R_SOULSTONE, 0.15 + 0.85 * clamp(lit)), clamp(lit * 1.25));
    if (gateM.rim(x, y, Math.sign(moon.x - px) * 0.5, -1, 1) === 1 && o === 9) c = mix(c, rc(R_DUSK, 0.85), 0.75);
    return c;
  });
  // 開口の内側: 地の底へ降りる階段と、底から昇る魂火
  {
    const N = 8;
    mid.paint(openM, (x, y) => {
      const px = x + 0.5, py = y + 0.5;
      const dxn = (px - vp.x) / aw;
      const core = Math.exp(-Math.hypot(dxn * 1.2, (py - vp.y) / (aw * 1.5)) * 2.4);
      let c = mix(rc(R_NIGHT, 0.03), rc(R_SOUL, 0.2 + 0.8 * core), clamp(core * 1.4));
      if (py > vp.y) {
        const dy = clamp((py - vp.y) / (gb - vp.y));   // 0 = 奥 / 1 = 敷居
        const hw = 0.22 + 0.78 * dy;                   // 坑道の半幅 (奥ほど狭い)
        if (Math.abs(dxn) < hw) {
          const sIdx = Math.pow(1 - dy, 0.7) * N;
          const fr = sIdx % 1;
          const nose = fr > 0.86;
          const glow = clamp(1 - dy * 1.05);
          c = nose ? rc(R_SOUL, clamp(0.3 + glow * 0.65)) : mix(rc(R_NIGHT, 0.04 + fr * 0.05), rc(R_SOUL, 0.28), glow * 0.75);
          if (Math.abs(dxn) > hw - 0.06) c = mix(c, rc(R_NIGHT, 0.02), 0.6);
        } else {
          c = mix(rc(R_NIGHT, 0.05), rc(R_SOULSTONE, 0.65), clamp((1 - dy) * 0.9 - (Math.abs(dxn) - hw) * 1.2));
        }
      } else {
        const up = (vp.y - py) / (vp.y - apex);
        c = mix(c, rc(R_NIGHT, 0.02), smooth(0.15, 0.8, up));
      }
      return c;
    });
  }
  // 巨像の台座と門前の段
  const sh = 128 * k, sFoot = gb - 14 * k;
  await tick();
  // 巨像 (左右)。内側 (門側) を下から魂火が照らす
  const eyes = [];
  for (const sd of [-1, 1]) {
    const cx = Math.round(gx + sd * 88 * k);
    const m = new Mask(W, H);
    statueShape(m, cx, sFoot, sh);
    eyes.push({ x: cx, y: sFoot - 0.905 * sh, s: sh });
    mid.paint(m, (x, y, v) => {
      const px = x + 0.5, py = y + 0.5;
      const u = (px - cx) / (0.17 * sh);
      const vv = (sFoot - py) / sh;
      if (v === 3) return rc(R_NIGHT, 0.0);
      const s = Math.max(fall(px, py, soulLow) * 2.3, fall(px, py, soul));
      const face = clamp(0.3 + 0.9 * (-sd) * clamp(u, -1, 1));
      let base, c;
      const nb = m.at(x - 1, y) !== v || m.at(x + 1, y) !== v || m.at(x, y + 1) !== v;
      if (v === 7) { // 刃: 鋼。中央の鎬が光る
        const e = (px - cx) / (0.016 * sh);
        const tip = smooth(0.0, 0.35, vv);
        c = rc(R_STEEL, (Math.abs(e) < 0.35 ? 0.26 : e * -sd > 0 ? 0.2 : 0.1) * (0.6 + 0.4 * tip));
        return mix(c, rc(R_SOUL, 0.45 + 0.4 * s), clamp(s * (e * -sd > 0.3 ? 1.0 : 0.3) * tip));
      }
      if (v === 1) {
        const fold = Math.sin(u * 7.5 + vnoise(u * 3, vv * 6, 82) * 2) * 0.035 * (1.25 - vv);
        base = 0.19 + fold - Math.abs(u) * 0.04;
      } else if (v === 2) base = 0.22 - (Math.abs(px - cx) < 0.05 * sh && vv < 0.96 ? 0.08 : 0);
      else if (v === 4) base = 0.25 + Math.sin(vv * 40) * 0.02 - (nb && (m.at(x - 1, y) === 1 || m.at(x + 1, y) === 1 || m.at(x, y + 1) === 1) ? 0.14 : 0);
      else if (v === 5) base = 0.32 + (!m.at(x, y - 1) ? 0.08 : 0);
      else if (v === 6) base = 0.28;
      c = rc(R_NIGHT, base);
      const rim = m.rim(x, y, -sd, 0.15, 2);
      const lit = s * face * (vv < 0.62 ? 1 : 0.75) * (rim <= 2 ? 1.5 : 1);
      if (lit > 0.02) c = mix(c, rc(R_SOULSTONE, 0.12 + 0.88 * clamp(lit)), clamp(lit * 1.3));
      if (m.rim(x, y, sd * 0.3, -1, 1) === 1 || m.rim(x, y, sd, -0.2, 1) === 1) c = mix(c, rc(R_DUSK, 0.8), 0.6);
      return c;
    });
  }

  await tick();
  // =================== 墓所の地面・参道・墓標 ===================
  const ground = new Layer(W, H);
  const pathHalf = (y) => (aw + 14 * k) + (y - gb) * (portrait ? 0.42 : 0.55);
  ground.shade(0, gb + 1, W - 1, H - 1, (x, y) => {
    const n = fbm(x * 0.05, y * 0.12, 101, 3);
    const zt = (y - hz) / Math.max(1, H - hz);
    let c = rc(R_NIGHT, 0.17 - zt * 0.1 + n * 0.07);
    const ph = pathHalf(y) + (vnoise(y * 0.15, 0, 105) - 0.5) * 6 * k;
    if (y > gb && Math.abs(x - gx) < ph) {
      // 遠近のついた石畳 (ウォロノイの石)
      const dz = y - hz + 6 * k;
      const U = (x - gx) / dz * 15, V = 420 * k / dz;
      const [f1, f2, id] = worley(U, V * 1.5, 107);
      const joint = f2 - f1 < 0.1;
      c = rc(R_NIGHT, joint ? 0.06 : 0.12 + id * 0.05 + n * 0.04);
      if (!joint && f2 - f1 < 0.18 && f1 < 0.5) c = rc(R_NIGHT, 0.16 + id * 0.04); // 石の角の照り
    }
    const s = fall(x, y, { x: gx, y: gb + 8 * k, r: 130 * k, sq: 2.3 });
    if (s > 0) c = mix(c, rc(R_SOUL, 0.1 + 0.42 * s), clamp(s * 1.25));
    const w = fall(x, y, { x: lamp.x, y: fig.feet, r: lamp.r, sq: 2.2 });
    if (w > 0) c = mix(c, rc(R_EMBER, 0.15 + 0.42 * w), clamp(w * 1.15));
    // 画面の下ほど闇へ沈む
    c = mix(c, rc(R_NIGHT, 0.01), smooth(0.55, 1.0, (y - gb) / (H - gb)) * 0.7);
    return c;
  });
  {
    // 門前の段 (3 段、手前へ広がる)。踏み面は魂火を受け、蹴上げは闇に沈む
    const m = new Mask(W, H);
    for (let i = 0; i < 3; i++) {
      const y0 = gb + i * 4 * k, hw = aw + 10 * k + i * 9 * k;
      m.rect(gx - hw, y0, hw * 2, 4 * k + 1, i + 1);
    }
    ground.paint(m, (x, y, v) => {
      const s = fall(x + 0.5, y + 0.5, soul);
      const tread = m.at(x, y - 1) !== v;
      const nose = tread || m.at(x, y - 2) !== v;
      let c = rc(R_NIGHT, nose ? 0.26 : 0.1);
      c = mix(c, rc(R_SOUL, nose ? 0.3 + 0.5 * s : 0.08 + 0.25 * s), clamp(s * (nose ? 1.7 : 0.9)));
      if (h2(x, y, 71) < 0.05) c = rc(R_NIGHT, 0.05);
      return c;
    });
  }
  {
    const m = new Mask(W, H);
    for (const sd of [-1, 1]) {
      const cx = gx + sd * 88 * k;
      m.rect(cx - 0.19 * sh, sFoot + 2 * k, 0.38 * sh, gb + 12 * k - sFoot, 5);
      m.rect(cx - 0.215 * sh, sFoot, 0.43 * sh, 3 * k, 6);
      m.rect(cx - 0.215 * sh, gb + 8 * k, 0.43 * sh, 5 * k, 6);
    }
    ground.paint(m, (x, y, v) => {
      const s = Math.max(fall(x + 0.5, y + 0.5, soul), fall(x + 0.5, y + 0.5, soulLow) * 0.8);
      if (v >= 5) {
        const cx = gx + Math.sign(x - gx) * 88 * k;
        const side = (x - cx) / (0.19 * sh) * -Math.sign(x - gx);
        let c = rc(R_NIGHT, (v === 6 ? 0.2 : 0.12) + vnoise(x * 0.4, y * 0.4, 81) * 0.05);
        if (v === 6 && !m.at(x, y - 1)) c = rc(R_NIGHT, 0.3);
        const lit = s * clamp(0.3 + side * 0.9);
        return mix(c, rc(R_SOULSTONE, 0.2 + 0.7 * lit), clamp(lit * 1.3));
      }
      return null;
    });
  }
  const graveL = new Layer(W, H);
  {
    const R = rng(portrait ? 2024 : 2025);
    const graves = [];
    const nG = Math.round((portrait ? 30 : 46) * Math.min(1.5, W / 300));
    for (let i = 0; i < nG * 6 && graves.length < nG; i++) {
      const z = Math.pow(R(), 1.3);
      const y = Math.round(gb + 2 + z * (H - gb - 8));
      const x = Math.round(R() * W);
      const s = (0.7 + 2.4 * (y - hz) / (H - hz)) * k;
      const kind = Math.floor(R() * 5), lean = (R() - 0.5) * 0.55;
      if (Math.abs(x - gx) < pathHalf(y) + 4 * s) continue;
      if (Math.abs(x - gx) < 88 * k + 0.25 * sh && y < gb + 16 * k) continue;
      if (Math.abs(x - fig.x) < 0.32 * fig.h && y > fig.feet - fig.h * 0.6 && y < fig.feet + 8) continue;
      if (graves.some((g2) => Math.abs(g2.x - x) < 5 * s && Math.abs(g2.y - y) < 3 * s)) continue;
      graves.push({ x, y, s, kind, lean });
    }
    graves.sort((a, b) => a.y - b.y);
    for (const gr of graves) {
      const m = new Mask(W, H);
      graveShape(m, gr.x, gr.y, gr.s, gr.kind, gr.lean);
      const toward = Math.sign(gx - gr.x);
      const fade = smooth(0.5, 1.0, (gr.y - gb) / (H - gb));
      graveL.paint(m, (x, y) => {
        // 霧を背にした黒い墓標。縁だけが門の魂火か月で光る
        let c = rc(R_NIGHT, 0.05 + vnoise(x * 0.6, y * 0.6, 111) * 0.04 + (x - gr.x) * toward * 0.004);
        const s = fall(x, y, soul) * 1.4;
        if (m.rim(x, y, toward * 0.6, -1, 1) === 1 || m.rim(x, y, toward, -0.25, 1) === 1) {
          c = s > 0.06 ? mix(c, rc(R_SOUL, 0.3 + 0.6 * s), clamp(0.35 + s * 1.5)) : mix(c, rc(R_DUSK, 0.8), 0.7);
        }
        const w = fall(x, y, lamp);
        if (w > 0.03) {
          const rimL = m.rim(x, y, Math.sign(lamp.x - x), Math.sign(lamp.y - y) * 0.6, 2);
          c = mix(c, rc(R_EMBER, 0.2 + 0.5 * w), clamp(w * (rimL === 1 ? 1.6 : rimL === 2 ? 0.7 : 0.25)));
        }
        return c;
      });
      for (let j = 0; j < 7 * gr.s; j++) {
        const gx2 = gr.x + (h1(j, gr.x) - 0.5) * 9 * gr.s, hh = 1 + h1(j, gr.y) * 2.6 * gr.s;
        for (let q = 0; q < hh; q++) graveL.px(gx2 + (q > hh * 0.6 ? (h1(j, 3) < 0.5 ? -1 : 1) : 0), gr.y - q, rc(R_NIGHT, 0.03));
      }
    }
  }

  await tick();
  // =================== 人物 ===================
  const figL = new Layer(W, H);
  {
    const m = new Mask(W, H);
    const r = cloakedBack(m, fig.x, fig.feet, fig.h, { wind: 1 });
    shadeCloaked(figL, m, fig.x, fig.feet, fig.h, {
      light: { x: vp.x, y: vp.y + (portrait ? 0 : -10 * k), k: 1 }, lamp: { x: r.lantern.x, y: r.lantern.y },
    });
  }

  await tick();
  // =================== 前景: 枯れ木と吊るし籠・傾いた大十字・闇の縁 ===================
  const fg = new Layer(W, H);
  const perches = [];
  {
    const m = new Mask(W, H);
    const R = rng(portrait ? 8 : 5);
    if (portrait) {
      // 縦長: 左手前に絞首台の柱。腕木の先から吊るし籠が下がり、鴉がとまる
      const px0 = Math.round(W * 0.1), ptop = Math.round(gb - 104 * k), pw = Math.max(4, Math.round(7 * k));
      m.poly([px0 - pw / 2 - 1, H, px0 + pw / 2 + 1, H, px0 + pw / 2, ptop, px0 - pw / 2, ptop]);
      const ax = px0 + 48 * k, ay = ptop + 6 * k;
      m.rect(px0 - pw / 2 - 2 * k, ay - 2 * k, ax - px0 + pw / 2 + 4 * k, Math.max(3, 5 * k));
      m.line(px0 + pw / 2, ay + 22 * k, px0 + 20 * k, ay + 2 * k, Math.max(2, 3.4 * k)); // 方杖
      m.rect(px0 - 1, ptop - 4 * k, 2, 4 * k);
      gibbet(m, Math.round(ax - 6 * k), Math.round(ay + 3 * k), Math.round(16 * k), k * 1.05);
      perches.push({ x: ax - 20 * k, y: ay - 2 * k }, { x: px0 + 2, y: ay - 2 * k });
      // 柱の根元の石積み
      m.poly([px0 - 13 * k, H, px0 + 15 * k, H, px0 + 9 * k, H - 9 * k, px0 - 8 * k, H - 11 * k]);
    } else {
      const tx = W * 0.045;
      const tr = gnarledTree(m, tx, H + 2, H * 0.72, 1, W * 0.3, k, R, perches, 15 * k);
      const limb = tr.limbs[2] || tr.limbs[0];
      if (limb && limb.length > 1) {
        const p = limb[Math.min(limb.length - 1, 2)];
        gibbet(m, Math.round(p[0]), Math.round(p[1] + 1), Math.round(12 * k), k * 0.9);
      }
    }
    // 右手前の大十字 (傾いで朽ちた)
    const cxx = portrait ? W * 0.9 : W * 0.9;
    graveShape(m, cxx, H + 2, (portrait ? 5.2 : 4.4) * k, 2, -0.16);
    // 画面下の土と草
    for (let x = 0; x < W; x++) {
      const e = Math.min(x, W - 1 - x) / (W / 2);
      const hgt = Math.round((1 - e) * (portrait ? 22 : 16) * k + 4 * k * fbm(x * 0.06, 0, 121, 3) + (h2(x, 1, 122) < 0.2 ? 3 * k : 0));
      for (let y = Math.max(0, H - hgt); y < H; y++) m._span(y, x, x, 1);
    }
    fg.paint(m, (x, y) => {
      let c = rc(R_NIGHT, 0.025 + vnoise(x * 0.3, y * 0.3, 131) * 0.03);
      if (m.rim(x, y, 0.4, -1, 1) === 1) c = rc(R_NIGHT, 0.15);
      if (m.rim(x, y, Math.sign(moon.x - x), -0.3, 1) === 1 && y < H * 0.7) c = mix(c, rc(R_DUSK, 0.55), 0.6);
      const w = fall(x, y, lamp);
      if (w > 0.05 && m.rim(x, y, Math.sign(lamp.x - x), Math.sign(lamp.y - y), 1) === 1) c = mix(c, rc(R_EMBER, 0.4), clamp(w * 2));
      return c;
    });
  }

  await tick();
  const L = {
    sky: sky.canvas(18), far: far.canvas(10), mid: mid.canvas(12), ground: ground.canvas(12), graves: graveL.canvas(8),
    fig: figL.canvas(6), fg: fg.canvas(8),
  };
  return {
    W, H, k, portrait, L,
    A: { gx, gb, aw, sy, apex, hz, moon, soul, vp, fig, lamp: lampPos, eyes, perches, fw, skyH },
  };
}

// ---------------------------------------------------------------------------
// 霧の帯 (横に無限ループ)。透明度は数段に量子化した「なめらかな」ドット霧
export function fogStrip(W, hgt, seed, k, col, dens = 1) {
  const L = new Layer(W, hgt);
  L.shade(0, 0, W - 1, hgt - 1, (x, y) => {
    const u = x / W; // 横方向は周期的に (端がつながるように 2 つのノイズを混ぜる)
    const n = fbm(x * 0.011 / k, y * 0.05 / k, seed, 4) * (1 - u) + fbm((x - W) * 0.011 / k, y * 0.05 / k, seed, 4) * u;
    const env = Math.sin((y / hgt) * Math.PI);
    const a = smooth(0.38, 0.75, n) * env * dens;
    if (a <= 0.03) return null;
    return [...rc(col, 0.3 + 0.5 * n), a];
  });
  return softCanvas(L, 6);
}

// 鴉。f = 0-2: 羽ばたき 3 コマ / -1: 止まり / -2: 止まって首を返す
export function drawCrow(g, x, y, s, f, col) {
  g.fillStyle = col;
  const X = Math.round(x), Y = Math.round(y);
  const r = (a, b, w, h) => g.fillRect(X + a * s, Y + b * s, w * s, h * s);
  if (f < 0) {
    r(-1, -3, 3, 3); r(0, -4, 2, 1); r(f === -1 ? 2 : -2, -4, 1, 1); r(-2, -1, 1, 2); r(-3, 0, 1, 1); r(0, 0, 1, 1);
    return;
  }
  r(-1, 0, 3, 1); r(1, -1, 1, 1); r(2, -1, 1, 1);
  if (f === 0) { r(-3, -2, 2, 1); r(-1, -1, 1, 1); r(-4, -3, 1, 1); r(0, -2, 1, 1); r(1, -3, 1, 1); }
  else if (f === 1) { r(-4, 0, 3, 1); r(0, 0, 3, 1); }
  else { r(-3, 1, 2, 1); r(-4, 2, 1, 1); r(0, 1, 1, 1); r(1, 2, 1, 1); }
  r(-2, 0, 1, 1); r(-3, 1, 1, 1);
}

// ---------------------------------------------------------------------------
// アニメーションする一枚絵。draw(g, t) を毎フレーム呼ぶ
export class TitleScene {
  // 描くのに時間がかかるので非同期で作る: await TitleScene.create(W, H, lay, reduced)
  static async create(W, H, lay, reduced = false) {
    return new TitleScene(await paintTitle(W, H, lay), reduced);
  }
  constructor(S, reduced = false) {
    this.reduced = reduced;
    const W = S.W, H = S.H;
    Object.assign(this, S);
    const k = S.k, A = S.A;
    this.fogFar = fogStrip(W, Math.round(30 * k), 141, k, R_FOG);
    this.fogNear = fogStrip(W, Math.round(56 * k), 151, k, R_FOG, 1.1);
    this.fogLow = fogStrip(W, Math.round(30 * k), 161, k, R_FOG, 0.9);
    this.glowGate = glowSprite(A.aw * 2.6, R_SOUL.slice(2), { pow: 1.8, squash: 1.3, core: 0.9 });
    this.glowLamp = glowSprite(Math.max(8, A.fig.h * 0.3), R_EMBER.slice(0, 8), { pow: 2.6, core: 0.75, levels: 6 });
    this.glowEye = glowSprite(Math.max(2, 3 * k), R_SOUL.slice(5), { pow: 1.2, core: 1 });
    // 鴉: 止まっているもの (目覚めで飛び立つ) と、時々横切るもの
    const R = rng(55);
    this.crows = A.perches.slice(0, 6).map((p, i) => ({ x: p.x, y: p.y - 1, vx: 0, vy: 0, fly: false, ph: R() * 6, delay: i * 90 + R() * 200 }));
    this.passing = [];
    this.nextPass = 3000;
    // 粒子
    this.motes = Array.from({ length: Math.round(28 + 26 * k) }, (_, i) => ({ seed: i, ph: h1(i, 201) }));
    this.ash = Array.from({ length: Math.round(W * H / 2600) }, (_, i) => ({ seed: i }));
    this.bolt = null; this.flash = 0; this.nextBolt = 6500; this.toll = 0; this.nextToll = 2500;
    this.shake = 0; this.awakeAt = -1;
  }
  wake(now) {
    this.awakeAt = now;
    this.toll = 1;
    this.shake = 1;
    this.flash = 0.6;
    for (const c of this.crows) { c.fly = true; c.t0 = now + c.delay; c.vx = (c.x < this.A.gx ? -1 : 1) * (0.04 + h1(c.x | 0, 3) * 0.03); c.vy = -(0.05 + h1(c.y | 0, 4) * 0.03); }
  }
  draw(g, now, dt) {
    const { W, H, L, A, k } = this;
    const t = this.reduced ? 0 : now;
    g.imageSmoothingEnabled = false;
    // 揺れ (目覚めの鐘)
    let ox = 0, oy = 0;
    if (this.shake > 0.01 && !this.reduced) {
      ox = Math.round((h1(Math.floor(now / 40), 1) - 0.5) * 4 * this.shake * k);
      oy = Math.round((h1(Math.floor(now / 40), 2) - 0.5) * 3 * this.shake * k);
      this.shake *= Math.pow(0.004, dt / 1000);
    }
    g.drawImage(L.sky, 0, 0);
    // 稲妻: 雲の奥で閃き、空だけが白く抜ける (手前の影は黒いまま)
    if (!this.reduced) {
      if (now > this.nextBolt) {
        this.nextBolt = now + 9000 + h1(Math.floor(now), 9) * 9000;
        this.flash = 1;
        const R = rng(Math.floor(now));
        // 雲の中から地平の向こうへ。主幹に 1〜2 本の枝
        const side = R() < 0.5 ? -1 : 1;
        const bx = A.gx + side * (A.moon.r * 1.5 + R() * Math.max(10, W / 2 - A.moon.r * 1.6));
        const y0 = A.skyH * (0.12 + R() * 0.12), y1 = A.hz - (16 + R() * 30) * k;
        const segs = [];
        const grow = (x, y, yEnd, w, depth) => {
          while (y < yEnd) {
            const ny = y + 2 + R() * 6 * k, nx = x + (R() - 0.5) * 8 * k + side * 0.6;
            segs.push([x, y, nx, ny, w]);
            if (depth > 0 && R() < 0.12) grow(nx, ny, ny + (12 + R() * 30) * k, 0, depth - 1);
            x = nx; y = ny;
          }
        };
        grow(bx, y0, y1, 1, 2);
        this.bolt = { segs, born: now };
      }
      if (this.flash > 0.01) {
        const f = this.flash * (0.6 + 0.4 * Math.sin(now * 0.09));
        g.globalCompositeOperation = "lighter";
        g.globalAlpha = clamp(f * 0.22);
        g.fillStyle = "#6a5a8a";
        g.fillRect(0, 0, W, A.skyH);
        g.globalCompositeOperation = "source-over";
        g.globalAlpha = 1;
        this.flash *= Math.pow(0.02, dt / 1000);
      }
      if (this.bolt && now - this.bolt.born < 300) {
        const e = now - this.bolt.born;
        if (e < 90 || (e > 150 && e < 260)) {
          for (const [x0, y0, x1, y1, w] of this.bolt.segs) {
            g.fillStyle = w ? "#efe9ff" : "#8f84b8";
            const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
            for (let j = 0; j <= n; j++) g.fillRect(Math.round(x0 + (x1 - x0) * j / n), Math.round(y0 + (y1 - y0) * j / n), 1, 1);
          }
        }
      }
    }
    g.drawImage(L.far, ox * 0.3 | 0, oy * 0.3 | 0);
    // 遠い霧
    const fy = Math.round(A.hz - 14 * k);
    const sx = ((t * 0.0035 * k) % W + W) % W | 0;
    g.globalAlpha = 0.55;
    g.drawImage(this.fogFar, -sx, fy); g.drawImage(this.fogFar, W - sx, fy);
    g.globalAlpha = 1;
    g.drawImage(L.mid, ox, oy);
    // 鐘の脈動: 門の奥の光が強まる
    if (!this.reduced && now > this.nextToll) { this.nextToll = now + 7000; this.toll = Math.max(this.toll, 0.55); }
    this.toll *= Math.pow(0.12, dt / 1000);
    const pulse = 0.55 + 0.18 * Math.sin(t * 0.0021) + 0.08 * Math.sin(t * 0.0057) + this.toll * 0.6;
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = clamp(pulse * 0.55);
    const gw = this.glowGate;
    g.drawImage(gw, Math.round(A.gx - gw.width / 2) + ox, Math.round(A.vp.y + 6 * k - gw.height / 2) + oy);
    // 巨像の眼: 鐘が鳴ると灯る
    const eyeOn = clamp((this.toll - 0.15) * 1.6) + 0.12;
    g.globalAlpha = eyeOn;
    for (const e of A.eyes) {
      const ge = this.glowEye;
      for (const sd of [-1, 1]) g.drawImage(ge, Math.round(e.x + sd * 0.016 * e.s - ge.width / 2) + ox, Math.round(e.y - ge.height / 2) + oy);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
    if (eyeOn > 0.25) {
      g.fillStyle = "#e9fff2";
      for (const e of A.eyes) for (const sd of [-1, 1]) g.fillRect(Math.round(e.x + sd * 0.016 * e.s) + ox, Math.round(e.y) + oy, 1, 1);
    }
    // 昇る魂 (門の奥から、揺らぎながら空へ)
    for (const p of this.motes) {
      const sp = 0.016 + h1(p.seed, 202) * 0.02;
      const u = ((t * sp * 0.001 + p.ph) % 1 + 1) % 1;
      const rise = A.vp.y - (A.apex - 90 * k);
      const x0 = A.gx + (h1(p.seed, 203) - 0.5) * A.aw * 1.4;
      const x = x0 + Math.sin(t * 0.0011 + p.seed) * 5 * k * u + (h1(p.seed, 204) - 0.5) * 70 * k * u * u;
      const y = A.vp.y + 10 * k - u * rise;
      const a = Math.sin(u * Math.PI) * (0.5 + 0.5 * Math.sin(t * 0.006 + p.seed * 3));
      if (a < 0.08) continue;
      const xi = Math.round(x) + ox, yi = Math.round(y) + oy;
      g.globalAlpha = a * 0.35;
      g.fillStyle = "#357a62";
      g.fillRect(xi - 1, yi, 3, 1); g.fillRect(xi, yi - 1, 1, 3);
      g.globalAlpha = a;
      g.fillStyle = p.seed % 4 === 0 ? "#e9fff2" : "#8ed6a6";
      g.fillRect(xi, yi, 1, 1);
      if (u > 0.2) { g.globalAlpha = a * 0.4; g.fillRect(xi, yi + 2, 1, 1); }
    }
    g.globalAlpha = 1;
    g.drawImage(L.ground, ox, oy);
    // 墓所の霧 (墓標はこの霧を背に黒く浮かぶ)
    const ny = Math.round(A.gb - 10 * k);
    const sx2 = ((-t * 0.006 * k) % W + W) % W | 0;
    g.globalAlpha = 0.75;
    g.drawImage(this.fogNear, -sx2, ny); g.drawImage(this.fogNear, W - sx2, ny);
    g.globalAlpha = 1;
    g.drawImage(L.graves, ox, oy);
    // 足元を這う薄い霧
    const ly = Math.round(A.fig.feet - 22 * k);
    const sx3 = ((t * 0.009 * k) % W + W) % W | 0;
    g.globalAlpha = 0.35;
    g.drawImage(this.fogLow, -sx3, ly); g.drawImage(this.fogLow, W - sx3, ly);
    g.globalAlpha = 1;
    g.drawImage(L.fig, ox, oy);
    // ランタンのおき火 (ゆらめき)
    const fl = 0.7 + 0.18 * Math.sin(t * 0.013) + 0.12 * Math.sin(t * 0.031 + 1) + (h1(Math.floor(t / 70), 5) - 0.5) * 0.12;
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = clamp(fl * 0.6);
    const gl = this.glowLamp;
    g.drawImage(gl, Math.round(A.lamp.x - gl.width / 2) + ox, Math.round(A.lamp.y - gl.height / 2) + oy);
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
    g.fillStyle = "#fff3c4";
    g.fillRect(Math.round(A.lamp.x) + ox, Math.round(A.lamp.y) + oy, 1, 1 + (fl > 0.75 ? 1 : 0));
    // 火の粉
    if (!this.reduced) for (let i = 0; i < 5; i++) {
      const u = ((t * 0.0004 * (1 + h1(i, 61)) + h1(i, 62)) % 1);
      const x = A.lamp.x + Math.sin(t * 0.004 + i * 2) * 3 * k * u + (h1(i, 63) - 0.5) * 6 * k * u;
      const y = A.lamp.y - u * 26 * k;
      g.globalAlpha = (1 - u) * 0.9;
      g.fillStyle = u < 0.4 ? "#fcd77e" : "#c4641c";
      g.fillRect(Math.round(x) + ox, Math.round(y) + oy, 1, 1);
    }
    g.globalAlpha = 1;
    g.drawImage(L.fg, ox, oy);
    // 鴉
    for (const c of this.crows) {
      let f = 1, x = c.x, y = c.y;
      if (c.fly && now > c.t0) {
        const e = now - c.t0;
        x = c.x + c.vx * e + Math.sin(e * 0.004) * 2;
        y = c.y + c.vy * e - e * e * 0.000004;
        f = Math.floor(e / 90) % 3;
        if (y < -10 || x < -10 || x > W + 10) continue;
      } else f = (Math.floor((t + c.ph * 1000) / 1600) % 5 === 0) ? -2 : -1;
      drawCrow(g, x + ox, y + oy, Math.max(1, Math.round(k * 0.9)), f, "#050307");
    }
    if (!this.reduced && now > this.nextPass) {
      this.nextPass = now + 7000 + h1(Math.floor(now), 3) * 8000;
      const dir = h1(Math.floor(now), 4) < 0.5 ? 1 : -1;
      this.passing.push({ x: dir > 0 ? -8 : W + 8, y: A.skyH * (0.25 + h1(Math.floor(now), 5) * 0.35), dir, born: now, n: 1 + Math.floor(h1(Math.floor(now), 6) * 3) });
    }
    this.passing = this.passing.filter((p) => {
      const e = now - p.born;
      const x = p.x + p.dir * e * 0.03 * k;
      if (x < -20 || x > W + 20) return false;
      for (let i = 0; i < p.n; i++) drawCrow(g, x - p.dir * i * 9 * k, p.y + Math.sin(e * 0.002 + i) * 3 + i * 4 * k, 1, Math.floor(e / 110 + i) % 3, "#07050b");
      return true;
    });
    // 灰が舞い落ちる
    if (!this.reduced) {
      g.fillStyle = "#62566d";
      for (const a of this.ash) {
        const sp = 0.006 + h1(a.seed, 71) * 0.01;
        const y = ((h1(a.seed, 72) * H + t * sp) % H);
        const x = (h1(a.seed, 73) * W + Math.sin(t * 0.0008 + a.seed) * 8 + t * 0.002) % W;
        g.globalAlpha = 0.35 + h1(a.seed, 74) * 0.4;
        g.fillRect(Math.round(x), Math.round(y), 1, 1);
      }
      g.globalAlpha = 1;
    }
  }
}

