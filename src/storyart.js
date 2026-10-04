// ===== 物語の一枚絵 — 師を捜す物語の要所に出すドット絵 (src/story.js の art キー) =====
// pxpaint.js の絵筆 (形 = Mask、浮動小数の色 = Layer、最後にマスターパレットへ順序ディザで量子化) で、
// 画素ごとに「素材の色 × (環境光 + 点光源)」を塗る。光は 2D の点光源で、形の擬似法線 (Mask.nx) と
// 上下の向き (縁までの距離) で面の向きを決める。1枚 192×108 ドット (16:9)、描いた絵は使い回す (cache)。
//   lantern = 師のランタン (地下墓地) / sigil = 壁に刻まれた印 (回廊) / arm = 流れ着いた腕 (取水口・館)
//   abbot = 修道院長の記憶 / camp = 師の野営跡 (坑口) / candle = 館の燭台 (章の結び)
// 画像ファイルは使わない。描き直すときは ux の確かめ用ページ (scratchpad) で拡大して目で見ること。
import { Mask, Layer, PAL, R_NIGHT, R_BONE, R_SOUL, R_EMBER, R_BLOOD, R_FOG, R_WOOD, R_STEEL, R_SOULSTONE, R_DUSK,
  rc, mix, clamp, smooth, fbm, vnoise, h2, worley, rng } from "./pxpaint.js";

export const ART_W = 192, ART_H = 108;

// ---- 光 ----
// 光源 { x, y, r (届く半径), c ([r,g,b] 0-1), k (強さ), p (減衰の鋭さ) }
const C_SOUL = [0.38, 1.0, 0.82], C_EMBER = [1.0, 0.62, 0.3], C_MOON = [0.55, 0.62, 0.9], C_CANDLE = [1.0, 0.78, 0.45];
function lightAt(x, y, lights, nx = 0, ny = 0) {
  let r = 0, g = 0, b = 0;
  for (const L of lights) {
    const dx = L.x - x, dy = L.y - y, d = Math.hypot(dx, dy);
    if (d >= L.r) continue;
    let f = Math.pow(1 - d / L.r, L.p || 1.6) * (L.k || 1);
    if (nx || ny) { const nd = d > 0.01 ? (nx * dx + ny * dy) / d : 1; f *= clamp((nd + 0.55) / 1.55); }
    r += L.c[0] * f; g += L.c[1] * f; b += L.c[2] * f;
  }
  return [r, g, b];
}
// 素材の色 (0-255) を光で照らす。amb = 環境光 [r,g,b]
function lit(alb, light, amb = [0.12, 0.1, 0.16]) {
  return [alb[0] * (amb[0] + light[0]), alb[1] * (amb[1] + light[1]), alb[2] * (amb[2] + light[2])];
}
// マスクの内側を、素材の色と面の向きで照らして塗る。albFn(x,y) → [r,g,b] / nyFn(x,y) → 上下の向き (-1 上向き .. 1 下向き)
function paintLit(L, m, albFn, lights, { amb, ny = null, nxMax = 8, emit = null } = {}) {
  L.paint(m, (x, y, v) => {
    const nx = m.nx(x, y, nxMax);
    const nyv = ny ? ny(x, y) : 0;
    const a = albFn(x, y, v);
    if (!a) return null;
    const c = lit(a, lightAt(x + 0.5, y + 0.5, lights, nx, nyv), amb);
    if (emit) { const e = emit(x, y); if (e) { c[0] += e[0]; c[1] += e[1]; c[2] += e[2]; } }
    return c;
  });
}
// 縁からの上下の向き: 上の縁に近いほど上を向く (-1)、下の縁に近いほど下を向く
function vNormal(m, x, y, max = 4) {
  let up = 0, dn = 0;
  while (up < max && m.at(x, y - up - 1)) up++;
  while (dn < max && m.at(x, y + dn + 1)) dn++;
  return (dn - up) / (max + 1) * -1;
}
// 光の加算 (既に塗った画素へ)。霧や光の玉に
function glow(L, cx, cy, r, col, k = 1, p = 2) {
  L.shade(cx - r, cy - r, cx + r, cy + r, (x, y) => {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r;
    if (d >= 1) return null;
    const f = Math.pow(1 - d, p) * k * 255;
    L.add(x, y, [col[0] * f, col[1] * f, col[2] * f]);
    return null;
  });
}
// 四隅を闇に沈める
function vignette(L, k = 0.85, pow = 2.2) {
  for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
    const i = y * L.w + x;
    if (L.a[i] <= 0) continue;
    const u = (x + 0.5) / L.w * 2 - 1, v = (y + 0.5) / L.h * 2 - 1;
    const d = Math.pow(Math.min(1, Math.hypot(u * 0.82, v * 1.0) / 1.25), pow) * k;
    const j = i * 3;
    L.c[j] *= 1 - d; L.c[j + 1] *= 1 - d; L.c[j + 2] *= 1 - d;
  }
}
// 石積みの壁: 目地 (暗い溝) と石ごとの色むら・ひび
function ashlar(x, y, bw = 22, bh = 11, seed = 1) {
  const row = Math.floor(y / bh), off = (h2(row, 0, seed) * bw) | 0;
  const col = Math.floor((x + off) / bw);
  const tu = (x + off) - col * bw, tv = y - row * bh;
  const joint = tu < 1 || tv < 1;
  const id = h2(col, row, seed + 3);
  const crack = vnoise(x * 0.5, y * 0.5, seed + col * 7) > 0.86 && fbm(x * 0.2, y * 0.2, seed) > 0.55;
  return { joint, id, crack, top: tv < 2, left: tu < 2 };
}
const ALB_STONE = [92, 86, 104], ALB_STONE_D = [66, 60, 78], ALB_BRASS = [196, 150, 72], ALB_IRON = [70, 74, 84],
  ALB_RUST = [150, 74, 40], ALB_WOOD = [150, 108, 66], ALB_WOOD_D = [104, 72, 46], ALB_BONE = [205, 190, 165],
  ALB_CLOTH = [96, 64, 70], ALB_PAPER = [214, 198, 160];

// ---- 共通の背景: 石の壁と床 ----
function stoneRoom(L, lights, { floorY = 82, seed = 1, wallAlb = ALB_STONE, amb = [0.08, 0.07, 0.12] } = {}) {
  L.shade(0, 0, L.w - 1, floorY - 1, (x, y) => {
    const a = ashlar(x, y, 24, 12, seed);
    const n = (fbm(x * 0.12, y * 0.12, seed) - 0.5) * 0.35 + (a.id - 0.5) * 0.22;
    let alb = mix(wallAlb, ALB_STONE_D, clamp(0.4 - n));
    if (a.joint) alb = [22, 18, 28];
    if (a.crack) alb = [30, 26, 36];
    const ny = a.top ? -0.6 : 0;
    const nx = a.left ? -0.5 : 0;
    return lit(alb, lightAt(x, y, lights, nx, ny), amb);
  });
  // 床: 奥へ暗くなる敷石
  L.shade(0, floorY, L.w - 1, L.h - 1, (x, y) => {
    const t = (y - floorY) / (L.h - floorY);
    const w = worley(x * 0.07 * (1.6 - t), y * 0.16, seed + 9);
    const edge = w[1] - w[0] < 0.08;
    let alb = mix(ALB_STONE_D, ALB_STONE, w[2] * 0.6);
    if (edge) alb = [24, 20, 30];
    return lit(alb, lightAt(x, y, lights, 0, -0.9), amb);
  });
}
// 舞う塵 (光の中だけに見える小さな点)
function motes(L, lights, n, seed, col = C_SOUL) {
  const R = rng(seed);
  for (let i = 0; i < n; i++) {
    const x = R() * L.w, y = R() * L.h;
    const l = lightAt(x, y, lights);
    const s = (l[0] + l[1] + l[2]) / 3;
    if (s < 0.25) continue;
    L.px(x, y, [col[0] * 255 * Math.min(1.2, s * 1.4), col[1] * 255 * Math.min(1.2, s * 1.4), col[2] * 255 * Math.min(1.2, s * 1.4)]);
  }
}

// ======================= 1. 師のランタン =======================
function sceneLantern() {
  const W = ART_W, H = ART_H, L = new Layer(W, H);
  const LX = 96, LY = 44;
  const lights = [
    { x: LX, y: LY, r: 110, c: C_SOUL, k: 1.05, p: 2.1 },
    { x: 16, y: 6, r: 80, c: C_MOON, k: 0.22, p: 1.4 },
  ];
  stoneRoom(L, lights, { floorY: 84, seed: 3, wallAlb: [80, 76, 92], amb: [0.05, 0.045, 0.08] });
  // 崩れた墓石 (台): 上の縁がぎざぎざ、右上が欠けている
  const top = (x) => 68 + Math.round(vnoise(x * 0.35, 1, 5) * 3) + (x > 124 ? Math.round((x - 124) * 0.8) : 0);
  const slab = new Mask(W, H);
  for (let x = 56; x <= 138; x++) slab.rect(x, top(x), 1, 92 - top(x));
  paintLit(L, slab, (x, y) => {
    const n = fbm(x * 0.2, y * 0.2, 11);
    if (y - top(x) < 3) return mix([150, 142, 150], [120, 112, 124], n);   // 上の面 (明るい)
    if (vnoise(x * 0.6, y * 0.6, 4) > 0.82) return [36, 32, 42];          // 欠け・ひび
    return mix([96, 90, 104], [70, 64, 80], n);
  }, lights, { ny: (x, y) => (y - top(x) < 3 ? -1 : -0.35), amb: [0.1, 0.1, 0.13] });
  // 墓石の正面に、爪で刻んだ文字 (魂火を受けて淡く光る短い線)
  const R0 = rng(77);
  for (let i = 0; i < 7; i++) {
    const x0 = 72 + i * 7, y0 = 79 + (R0() * 2 | 0);
    for (let k = 0; k < 4; k++) if (R0() < 0.8) L.px(x0 + (k > 1 && R0() < 0.5 ? 1 : 0), y0 + k, [120, 190, 175]);
    if (R0() < 0.6) L.px(x0 + 1, y0 + 1, [120, 190, 175]);
  }
  // ランタン (大きく): 台座・硝子の箱・笠・吊り輪
  const brass = new Mask(W, H);
  brass.rect(82, 64, 29, 4);                              // 台座
  brass.poly([84, 64, 109, 64, 106, 60, 87, 60]);
  brass.poly([84, 28, 109, 28, 104, 21, 89, 21]);         // 笠
  brass.rect(94, 17, 5, 4);                               // つまみ
  brass.rect(85, 28, 3, 32); brass.rect(105, 28, 3, 32);  // 枠の柱
  brass.rect(85, 43, 23, 2);                              // 帯
  for (let a = Math.PI; a <= Math.PI * 2.001; a += 0.04) brass.rect(Math.round(96.5 + Math.cos(a) * 8), Math.round(17 + Math.sin(a) * 7), 2, 2); // 吊り輪
  // 硝子の中 (魂火の色が満ちる)
  const glass = new Mask(W, H);
  glass.rect(88, 28, 17, 32);
  L.paint(glass, (x, y) => {
    const d = Math.hypot(x + 0.5 - LX, (y + 0.5 - LY) * 0.9) / 15;
    const c = rc(R_SOUL, clamp(0.78 - d * 0.62));
    const hl = (x === 89 || x === 90) && y > 30 && y < 56 && y % 7 !== 0 ? 0.28 : 0; // 硝子の映り込み
    return [c[0] + hl * 140, c[1] + hl * 150, c[2] + hl * 140];
  });
  // 魂火 (揺れる炎)
  const flame = new Mask(W, H);
  flame.poly([96, 30, 100.5, 41, 100, 49, 96.5, 52, 93, 49, 92.5, 41]);
  L.paint(flame, (x, y) => { const d = Math.abs(x + 0.5 - 96.5) / 4.5; const t = (y - 30) / 22; return rc(R_SOUL, clamp(1 - d * 0.32 - Math.abs(t - 0.62) * 0.3)); });
  for (const [x, y] of [[96, 43], [96, 44], [97, 44], [96, 45], [97, 45], [96, 46]]) L.px(x, y, [250, 255, 250]);
  // 真鍮: 魂火の照り返し (内側の縁) と、外の暗がり
  paintLit(L, brass, (x, y) => mix(ALB_BRASS, [110, 76, 34], vnoise(x * 0.8, y * 0.8, 21) * 0.55), [
    ...lights, { x: LX, y: LY, r: 22, c: [0.75, 1.0, 0.8], k: 1.3, p: 1 },
  ], { amb: [0.28, 0.2, 0.12] });
  // 床の骨 (左手前) と燃え尽きた蝋燭 (右)
  const bone = new Mask(W, H);
  bone.ellipse(30, 94, 6, 4.5); bone.rect(25, 98, 2, 2); bone.rect(33, 98, 2, 2); // 頭蓋
  bone.line(40, 99, 58, 95, 2); bone.ellipse(40, 99, 1.6, 1.6); bone.ellipse(58, 95, 1.6, 1.6);
  bone.line(10, 102, 24, 104, 1.6);
  paintLit(L, bone, (x, y) => ((x === 28 || x === 32) && y === 94 ? [20, 16, 20] : ALB_BONE), lights, { ny: (x, y) => vNormal(bone, x, y, 3), amb: [0.12, 0.11, 0.13] });
  const cnd = new Mask(W, H);
  cnd.rect(154, 86, 4, 8); cnd.rect(162, 90, 3, 5); cnd.ellipse(158, 94, 8, 1.5);
  paintLit(L, cnd, () => [200, 186, 160], lights, { amb: [0.12, 0.12, 0.14] });
  glow(L, LX, LY, 40, C_SOUL, 0.26, 2.4);
  motes(L, lights, 50, 9);
  vignette(L, 0.92);
  return L.canvas(12);
}

// ======================= 2. 壁に刻まれた印 =======================
// 師の印: 掌を上に向けた手と、その上の灯 (炎)。s = 大きさ
function sigilMask(m, cx, cy, s) {
  m.ellipse(cx, cy + 2 * s, 7 * s, 4.2 * s);                                  // 掌
  for (let i = 0; i < 4; i++) m.rect(cx - 6.5 * s + i * 3.4 * s, cy - 0.5 * s, 2.4 * s, 4 * s); // 指 (上向きに丸めた先)
  m.line(cx + 6.5 * s, cy + 2.5 * s, cx + 10 * s, cy - 0.5 * s, 2.3 * s);      // 親指
  m.rect(cx - 4 * s, cy + 5 * s, 8 * s, 6 * s);                              // 手首
  m.poly([cx, cy - 13 * s, cx + 3.6 * s, cy - 6 * s, cx + 2.6 * s, cy - 2.6 * s, cx, cy - 1.8 * s, cx - 2.6 * s, cy - 2.6 * s, cx - 3.6 * s, cy - 6 * s]); // 炎
}
// 大きく刻んだ師の印 (線画): 指先の揃った椀のような掌、手首、その上に灯る炎 (内に小さな火の舌)
function sigilLines(m, cx, cy, s, w = 1.6) {
  const arc = (x0, y0, rx, ry, a0, a1, th = w) => {
    let px = null, py = null;
    for (let a = a0; a <= a1 + 1e-6; a += 0.08) {
      const x = x0 + Math.cos(a) * rx, y = y0 + Math.sin(a) * ry;
      if (px != null) m.line(px, py, x, y, th);
      px = x; py = y;
    }
  };
  arc(cx, cy + 2 * s, 11 * s, 7 * s, 0, Math.PI);                      // 掌の椀 (下半分の弧)
  m.line(cx - 11 * s, cy + 2 * s, cx + 11 * s, cy + 2 * s, w);          // 椀の縁
  for (let i = 0; i < 4; i++) arc(cx - 8.25 * s + i * 5.5 * s, cy + 2 * s, 2.75 * s, 2.6 * s, Math.PI, Math.PI * 2); // 指先 (縁の上の4つの丸み)
  m.line(cx - 3.4 * s, cy + 8.6 * s, cx - 3.4 * s, cy + 14 * s, w);     // 手首
  m.line(cx + 3.4 * s, cy + 8.6 * s, cx + 3.4 * s, cy + 14 * s, w);
  // 炎: 雫の外形と内の舌
  const flame = (fy, fs) => {
    m.line(cx, fy - 9 * fs, cx + 4.2 * fs, fy - 2 * fs, w); m.line(cx + 4.2 * fs, fy - 2 * fs, cx + 3 * fs, fy + 1.6 * fs, w);
    m.line(cx + 3 * fs, fy + 1.6 * fs, cx, fy + 2.8 * fs, w); m.line(cx, fy + 2.8 * fs, cx - 3 * fs, fy + 1.6 * fs, w);
    m.line(cx - 3 * fs, fy + 1.6 * fs, cx - 4.2 * fs, fy - 2 * fs, w); m.line(cx - 4.2 * fs, fy - 2 * fs, cx, fy - 9 * fs, w);
  };
  flame(cy - 6 * s, s);
  m.line(cx, cy - 10.5 * s, cx + 1.3 * s, cy - 6.5 * s, w * 0.9); m.line(cx + 1.3 * s, cy - 6.5 * s, cx, cy - 4.6 * s, w * 0.9);
}
// 形の縁だけを残した線 (彫った溝)。w = 線の太さ
function outline(m, w = 1) {
  const o = new Mask(m.w, m.h);
  for (let y = m.y0; y <= m.y1; y++) for (let x = m.x0; x <= m.x1; x++) {
    if (!m.at(x, y)) continue;
    let edge = false;
    for (let d = 1; d <= w && !edge; d++) edge = !m.at(x - d, y) || !m.at(x + d, y) || !m.at(x, y - d) || !m.at(x, y + d);
    if (edge) o.rect(x, y, 1, 1);
  }
  return o;
}
function sceneSigil() {
  const W = ART_W, H = ART_H, L = new Layer(W, H);
  const SX = 100, SY = 30;
  const lights = [
    { x: 18, y: 26, r: 170, c: C_EMBER, k: 1.15, p: 1.5 },    // 左の松明
    { x: SX, y: SY, r: 70, c: C_SOUL, k: 0.55, p: 1.7 },      // 刻まれたばかりの印が、魂火の名残で淡く光る
    { x: 100, y: 100, r: 60, c: C_SOUL, k: 0.35, p: 1.5 },    // 格子の向こうの水明かり
  ];
  stoneRoom(L, lights, { floorY: 104, seed: 7, amb: [0.08, 0.07, 0.1] });
  // 松明 (左の壁)
  const tor = new Mask(W, H); tor.rect(17, 28, 3, 16); tor.poly([13, 28, 24, 28, 23, 25, 14, 25]);
  paintLit(L, tor, () => ALB_WOOD_D, lights, { amb: [0.2, 0.15, 0.1] });
  const tf = new Mask(W, H); tf.poly([18.5, 10, 23.5, 20, 22, 25, 15, 25, 13.5, 20]);
  L.paint(tf, (x, y) => rc(R_EMBER, clamp(0.97 - (25 - y) * 0.018 - Math.abs(x - 18.5) * 0.06)));
  glow(L, 18.5, 19, 34, C_EMBER, 0.45, 2.4);
  // 刻まれた印: 円の縁取りの中に、掌と灯。溝の底は魂火色に淡く光り、光の側の縁は削れて白い
  const disc = new Mask(W, H); disc.ellipse(SX, SY, 30, 25);
  const ring = outline(disc, 2);
  const groove = new Mask(W, H); sigilLines(groove, SX, SY + 1, 1.45, 1.7);
  const grooveAll = new Mask(W, H);
  for (const m of [ring, groove]) for (let y = m.y0; y <= m.y1; y++) for (let x = m.x0; x <= m.x1; x++) if (m.at(x, y)) grooveAll.rect(x, y, 1, 1);
  L.paint(grooveAll, (x, y) => {
    const lip = !grooveAll.at(x - 1, y) && !grooveAll.at(x, y - 1); // 光の側の縁
    const c = rc(R_SOUL, 0.62 + 0.18 * vnoise(x * 0.5, y * 0.5, 2));
    return lip ? [210, 228, 214] : c;
  });
  // 刻み屑 (印の下に落ちた白い粉)
  const R1 = rng(5);
  for (let i = 0; i < 26; i++) L.px(SX - 20 + R1() * 40, 57 + R1() * 3, [170, 166, 160]);
  glow(L, SX, SY, 30, C_SOUL, 0.18, 2);
  // 鉄格子のアーチ (下段) と、その向こうの闇と水
  const arch = new Mask(W, H);
  arch.rect(66, 74, 68, 34); arch.ellipse(100, 74, 34, 11);
  L.paint(arch, (x, y) => {
    const w = y > 94 ? 0.3 + 0.3 * Math.sin(x * 0.45 + y * 1.3) * Math.sin(x * 0.11) : 0;
    const d = clamp(1 - Math.hypot(x - 100, y - 100) / 42);
    return [6 + w * 40 * d, 10 + w * 140 * d + d * 16, 14 + w * 120 * d + d * 18];
  });
  const grate = new Mask(W, H);
  for (let x = 69; x < 132; x += 7) grate.rect(x, 62, 2, 46);
  grate.rect(64, 82, 72, 2); grate.rect(64, 98, 72, 2);
  for (let a = Math.PI; a <= Math.PI * 2; a += 0.01) grate.rect(Math.round(100 + Math.cos(a) * 35), Math.round(74 + Math.sin(a) * 12), 2, 2);
  const archClip = new Mask(W, H); archClip.rect(64, 74, 72, 34); archClip.ellipse(100, 74, 36, 13);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (grate.at(x, y) && !archClip.at(x, y)) grate.m[y * W + x] = 0;
  paintLit(L, grate, (x, y) => mix([96, 98, 108], ALB_RUST, clamp(fbm(x * 0.3, y * 0.3, 5) * 1.6 - 0.5)), lights, { nxMax: 2, amb: [0.14, 0.12, 0.12] });
  // 錠と、挿したままの錆びた鍵・紐で下がる札
  const lock = new Mask(W, H); lock.rect(110, 84, 9, 10); lock.ellipse(114.5, 84, 3, 3);
  paintLit(L, lock, () => [110, 112, 120], lights, { amb: [0.18, 0.16, 0.16] });
  const key = new Mask(W, H); key.rect(118, 88, 12, 3); key.ellipse(133, 89.5, 4, 4); key.rect(120, 91, 2, 3); key.rect(124, 91, 2, 2);
  paintLit(L, key, (x, y) => (Math.hypot(x + 0.5 - 133, y + 0.5 - 89.5) < 1.8 ? null : mix(ALB_RUST, ALB_BRASS, 0.5)), lights, { amb: [0.3, 0.2, 0.12] });
  for (let i = 0; i < 7; i++) L.px(134, 93 + i, [150, 126, 90]);
  const tag = new Mask(W, H); tag.poly([129, 100, 140, 100, 141, 108, 128, 108]);
  paintLit(L, tag, (x, y) => ((y === 103 && x > 130 && x < 139 && x % 2) || (y === 105 && x > 130 && x < 136) ? [70, 50, 44] : ALB_PAPER), lights, { amb: [0.35, 0.3, 0.28] });
  motes(L, lights, 50, 13, C_EMBER);
  vignette(L, 0.8);
  return L.canvas(12);
}

// ======================= 3. 流れ着いた腕 =======================
function sceneArm() {
  const W = ART_W, H = ART_H, L = new Layer(W, H);
  const lights = [
    { x: 70, y: -20, r: 170, c: [0.75, 0.8, 1.0], k: 1.25, p: 1.3 },  // 上の取水口から射す月明かり
    { x: 120, y: 60, r: 40, c: C_SOUL, k: 0.6, p: 1.6 },              // 手首の刻印の淡い光
  ];
  // 奥の水路の壁 (上)
  L.shade(0, 0, W - 1, 40, (x, y) => {
    const a = ashlar(x, y, 18, 9, 21);
    let alb = mix([70, 72, 84], [52, 60, 66], fbm(x * 0.1, y * 0.1, 3));
    if (a.joint) alb = [16, 18, 24];
    alb = mix(alb, [40, 70, 60], y > 28 ? clamp((y - 28) / 12) * 0.7 : 0); // 水際のぬめり
    return lit(alb, lightAt(x, y, lights), [0.05, 0.06, 0.09]);
  });
  // 黒い水 (下): 光の射す所だけ揺れる帯
  L.shade(0, 41, W - 1, H - 1, (x, y) => {
    const wv = Math.sin(x * 0.21 + y * 0.95) * 0.55 + Math.sin(x * 0.06 - y * 0.45) * 0.45;
    const l = lightAt(x, y, lights);
    const sheen = clamp(wv * 0.55 + 0.15) * (l[0] + l[1] + l[2]) / 3;
    return [5 + sheen * 70, 8 + sheen * 92, 13 + sheen * 120];
  });
  // 水中の格子
  const bar = new Mask(W, H);
  bar.rect(0, 70, W, 5);
  for (let x = 4; x < W; x += 18) bar.rect(x, 41, 4, 67);
  paintLit(L, bar, (x, y) => mix([92, 96, 106], ALB_RUST, clamp(fbm(x * 0.2, y * 0.3, 8) * 1.5 - 0.4)), lights, { nxMax: 2, ny: (x, y) => (y < 72 ? -0.8 : 0.4), amb: [0.06, 0.07, 0.1] });
  // 腕 (前腕): 肘 (左下) → 手首 (右上)。木の円筒・黒鉄の継ぎ目・彫り込んだ指
  const ax0 = 34, ay0 = 82, ax1 = 122, ay1 = 56;
  const dx = ax1 - ax0, dy = ay1 - ay0, ln = Math.hypot(dx, dy);
  const along = (x, y) => ((x - ax0) * dx + (y - ay0) * dy) / (ln * ln);
  const across = (x, y) => ((x - ax0) * -dy + (y - ay0) * dx) / ln;
  const arm = new Mask(W, H);
  arm.line(ax0, ay0, ax1, ay1, 15, 1, 11);
  arm.ellipse(ax0 - 2, ay0 + 1, 8.5, 8);                 // 肘の球関節
  arm.ellipse(134, 52, 10, 7);                            // 掌
  for (let i = 0; i < 4; i++) { arm.line(141, 47 + i * 3.2, 153, 44 + i * 4.6, 2.4); arm.ellipse(153.5, 44.2 + i * 4.6, 1.5, 1.5); } // 開いた指
  arm.line(130, 46, 138, 40, 3.2); arm.ellipse(138.5, 40, 1.9, 1.9); // 親指
  paintLit(L, arm, (x, y) => {
    const t = along(x, y);
    const grain = Math.sin(t * 110 + vnoise(x * 0.3, y * 0.3, 2) * 5) * 0.5 + 0.5;
    let a = mix([200, 156, 104], [150, 108, 70], grain * 0.45);
    a = mix(a, [96, 70, 50], clamp((across(x, y) + 1) / 9) * 0.55);   // 下側は濡れて暗い
    return a;
  }, lights, { ny: (x, y) => clamp(across(x, y) / 7, -1, 1), amb: [0.1, 0.1, 0.12] });
  // 黒鉄の継ぎ目 (肘・手首・指の節)
  const steel = new Mask(W, H);
  const band = (t, w) => { const cx = ax0 + dx * t, cy = ay0 + dy * t; steel.line(cx - dx / ln * w / 2, cy - dy / ln * w / 2, cx + dx / ln * w / 2, cy + dy / ln * w / 2, 17 - t * 5); };
  band(0.1, 3.5); band(0.97, 3.5);
  for (let i = 0; i < 4; i++) steel.rect(147, 45.6 + i * 3.9, 1.4, 2.4);
  paintLit(L, steel, (x, y) => (steel.at(x, y - 1) ? mix([84, 88, 100], [46, 48, 58], vnoise(x, y, 4) * 0.5) : [170, 176, 190]), lights, { nxMax: 2, ny: (x, y) => -0.5, amb: [0.14, 0.14, 0.17] });
  // 指と指の間の陰
  for (let i = 0; i < 3; i++) for (let x = 144; x <= 155; x++) { const y = Math.round(48.6 + i * 3.2 + (x - 141) * (1.4 * i - 1.6) / 12 + (x - 141) * 0.12); if (!arm.at(x, y)) continue; L.px(x, y, [34, 24, 20]); }
  // 手首の内側の刻印 (師の印を小さく、淡く光る)
  const sg = new Mask(W, H);
  sigilMask(sg, 113, 62, 0.42);
  L.paint(sg, () => [150, 240, 212]);
  glow(L, 113, 61, 14, C_SOUL, 0.3, 2);
  // 腕のまわりの波紋
  for (let a = 0; a < Math.PI * 2; a += 0.04) {
    const x = 78 + Math.cos(a) * 62, y = 72 + Math.sin(a) * 9;
    if (Math.sin(a * 7) > 0.3 && !arm.at(Math.round(x), Math.round(y))) L.add(Math.round(x), Math.round(y), [26, 40, 44]);
  }
  motes(L, lights, 40, 31, C_MOON);
  vignette(L, 0.85);
  return L.canvas(12);
}

// ======================= 4. 修道院長の記憶 =======================
// 記憶の色: 灰がかった青緑と、煤けた金。端ほど霞む
function sceneAbbot() {
  const W = ART_W, H = ART_H, L = new Layer(W, H);
  const lights = [
    { x: 96, y: 32, r: 120, c: C_CANDLE, k: 1.25, p: 1.5 },   // 祭壇の燭台
    { x: 127, y: 64, r: 56, c: C_EMBER, k: 1.1, p: 1.5 },     // 男のランタン
    { x: 170, y: 67, r: 38, c: C_SOUL, k: 1.0, p: 1.4 },      // 人業の抱く灯
  ];
  stoneRoom(L, lights, { floorY: 88, seed: 15, amb: [0.1, 0.1, 0.12] });
  // 尖頭アーチの窓 (奥・月の色)
  const win = new Mask(W, H); win.rect(88, 6, 16, 22); win.ellipse(96, 6, 8, 7);
  L.paint(win, (x, y) => ((x - 88) % 5 === 0 || y === 16 ? [20, 20, 26] : [26 + y * 0.8, 34 + y * 0.9, 52 + y * 0.8]));
  // 祭壇と燭台
  const alt = new Mask(W, H); alt.rect(72, 52, 48, 24); alt.rect(68, 50, 56, 3);
  paintLit(L, alt, (x, y) => (y < 53 ? [220, 210, 190] : (x - 72) % 12 === 0 ? [60, 54, 60] : [150, 140, 132]), lights, { ny: (x, y) => (y < 53 ? -1 : 0.3), amb: [0.1, 0.1, 0.12] });
  for (const [cx, hh] of [[80, 10], [96, 14], [112, 10]]) {
    const c = new Mask(W, H); c.rect(cx - 1, 50 - hh, 3, hh);
    paintLit(L, c, () => [230, 220, 196], lights, { amb: [0.3, 0.3, 0.3] });
    const f = new Mask(W, H); f.poly([cx + 0.5, 50 - hh - 7, cx + 2.2, 50 - hh - 2, cx + 0.5, 50 - hh, cx - 1.2, 50 - hh - 2]);
    L.paint(f, () => rc(R_EMBER, 0.94));
    glow(L, cx + 0.5, 50 - hh - 3, 14, C_CANDLE, 0.4, 2);
  }
  // 人の形を、光源に向いた縁 (rim) で浮かび上がらせて塗る
  const figure = (m, alb, rimCol) => {
    paintLit(L, m, alb, lights, { amb: [0.06, 0.06, 0.08] });
    for (let y = m.y0; y <= m.y1; y++) for (let x = m.x0; x <= m.x1; x++) {
      if (!m.at(x, y) || !(!m.at(x + 1, y) || !m.at(x - 1, y) || !m.at(x, y - 1))) continue;
      const l = lightAt(x, y, lights);
      const k = Math.min(1, (l[0] + l[1] + l[2]) / 2.2);
      L.add(x, y, [rimCol[0] * k, rimCol[1] * k, rimCol[2] * k]);
    }
  };
  // 修道院長 (左・頭巾の法衣、右を向く)
  const ab = new Mask(W, H);
  ab.poly([30, 104, 34, 64, 40, 48, 50, 42, 58, 46, 63, 58, 68, 104]);
  ab.ellipse(51, 48, 8, 8.5);
  figure(ab, (x, y) => (x > 54 && y > 45 && y < 53 ? [20, 16, 20] : mix([120, 98, 96], [86, 72, 78], fbm(x * 0.2, y * 0.15, 6))), [120, 100, 70]);
  // ランタンを提げた男 (右・旅装の外套と帽子、左を向く)
  const man = new Mask(W, H);
  man.poly([134, 104, 136, 66, 140, 56, 148, 52, 154, 56, 156, 66, 160, 104]);
  man.ellipse(147, 48, 5.5, 6.2);
  man.poly([139, 43, 155, 43, 152, 37, 142, 37]); man.rect(134, 42, 26, 2); // 帽子
  figure(man, (x, y) => mix([100, 96, 112], [68, 64, 80], fbm(x * 0.2, y * 0.2, 7)), [140, 110, 70]);
  const arm2 = new Mask(W, H); arm2.line(138, 60, 130, 64, 3);
  figure(arm2, () => [90, 86, 100], [140, 110, 70]);
  const lamp = new Mask(W, H); lamp.rect(124, 62, 7, 9); lamp.rect(126, 59, 3, 3);
  paintLit(L, lamp, () => ALB_BRASS, lights, { amb: [0.3, 0.22, 0.14] });
  for (const [x, y] of [[127, 65], [128, 65], [127, 66], [128, 67]]) L.px(x, y, rc(R_EMBER, 1));
  glow(L, 127.5, 66, 24, C_EMBER, 0.5, 2.2);
  // 灯を抱いて従う人業 (男の後ろ・ほっそりした木の器)
  const dl = new Mask(W, H);
  dl.poly([164, 104, 166, 74, 170, 66, 176, 66, 180, 74, 182, 104]);
  dl.ellipse(173, 59, 5, 5.5);
  figure(dl, (x, y) => (Math.abs(y - 78) < 1 || Math.abs(y - 90) < 1 ? [50, 50, 60] : [170, 130, 92]), [90, 200, 170]);
  for (const [x, y] of [[170, 69], [171, 69], [170, 68], [171, 70]]) L.px(x, y, rc(R_SOUL, 1));
  glow(L, 170.5, 69, 20, C_SOUL, 0.55, 2.2);
  // 記憶の色: 彩度を落として灰青緑に寄せ、端を霞ませる。ところどころ細い横筋 (記憶のちらつき)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; if (L.a[i] <= 0) continue;
    const j = i * 3, r = L.c[j], g = L.c[j + 1], b = L.c[j + 2];
    const lum = r * 0.3 + g * 0.55 + b * 0.15;
    let c = mix([lum * 0.95 + 6, lum + 10, lum * 1.02 + 14], [r, g, b], 0.5);
    const u = (x + 0.5) / W * 2 - 1, v = (y + 0.5) / H * 2 - 1;
    c = mix(c, [48, 56, 64], smooth(0.62, 1.2, Math.hypot(u * 0.9, v)) * 0.9);
    if ((y === 23 || y === 71) && vnoise(x * 0.04, y, 3) > 0.5) c = mix(c, [90, 104, 108], 0.25);
    L.c[j] = c[0]; L.c[j + 1] = c[1]; L.c[j + 2] = c[2];
  }
  motes(L, lights, 40, 41, [0.7, 0.9, 0.85]);
  return L.canvas(10);
}

// ======================= 5. 師の野営跡 =======================
function sceneCamp() {
  const W = ART_W, H = ART_H, L = new Layer(W, H);
  const CX = 122, CY = 68; // 木箱の上の蝋燭 (木箱の右端)
  const lights = [
    { x: CX, y: CY - 9, r: 150, c: C_CANDLE, k: 1.55, p: 1.5 },
    { x: 30, y: 30, r: 70, c: C_SOUL, k: 0.25, p: 1.4 },
  ];
  // 坑道の岩肌 (割れ目の多い面)
  L.shade(0, 0, W - 1, 84, (x, y) => {
    const w = worley(x * 0.17, y * 0.21, 31);
    const ridge = clamp((w[1] - w[0]) * 5);
    const alb = mix([84, 74, 74], [124, 112, 108], ridge * 0.5 + w[2] * 0.3 + fbm(x * 0.3, y * 0.3, 4) * 0.2);
    const ny = (w[0] - 0.35) * 1.2; // 岩の塊ごとの小さな起伏だけ (大きなむらは作らない)
    return lit(alb, lightAt(x, y, lights, 0, ny), [0.07, 0.065, 0.08]);
  });
  L.shade(0, 85, W - 1, H - 1, (x, y) => {
    const alb = mix([80, 70, 68], [130, 116, 108], vnoise(x * 0.6, y * 0.6, 8));
    return lit(alb, lightAt(x, y, lights, 0, -0.9), [0.06, 0.06, 0.08]);
  });
  // 坑木の枠 (柱2本と梁・方杖)
  const tim = new Mask(W, H);
  tim.rect(8, 6, 10, 96); tim.rect(174, 6, 10, 96); tim.rect(4, 3, 184, 9);
  tim.poly([18, 12, 34, 12, 18, 28]); tim.poly([174, 12, 158, 12, 174, 28]);
  paintLit(L, tim, (x, y) => {
    const g = Math.sin((y < 12 ? x : y) * 0.8 + vnoise(x * 0.2, y * 0.2, 3) * 5) * 0.5 + 0.5;
    return mix([150, 108, 70], [100, 70, 46], g * 0.5);
  }, lights, { amb: [0.06, 0.06, 0.08] });
  // 垂れる鎖 (右上)
  for (let k = 0; k < 3; k++) {
    const x0 = 148 + k * 7, len = 16 + k * 10;
    for (let y = 12; y < 12 + len; y += 3) {
      const m = new Mask(W, H); if ((y / 3) % 2 < 1) m.rect(x0, y, 2, 3); else m.rect(x0 - 1, y + 1, 4, 1.5);
      paintLit(L, m, () => [120, 122, 132], lights, { nxMax: 1, amb: [0.1, 0.1, 0.12] });
    }
  }
  // 冷えた焚き火の輪 (中央左): 石の輪・灰・燃えさしの薪
  const FX = 76, FY = 92;
  const ash = new Mask(W, H); ash.ellipse(FX, FY, 12, 3.4);
  L.paint(ash, (x, y) => lit(mix([90, 86, 86], [150, 144, 138], vnoise(x * 0.9, y * 0.9, 2)), lightAt(x, y, lights), [0.12, 0.12, 0.12]));
  for (const [x0, y0, x1, y1] of [[66, 90, 84, 94], [69, 95, 86, 89]]) { const m = new Mask(W, H); m.line(x0, y0, x1, y1, 2.2); paintLit(L, m, () => [56, 40, 34], lights, { amb: [0.06, 0.06, 0.06] }); }
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2, x = FX + Math.cos(a) * 15, y = FY + Math.sin(a) * 4.6;
    const m = new Mask(W, H); m.ellipse(x, y, 3.4, 2.6);
    paintLit(L, m, () => [150, 140, 140], lights, { ny: (xx, yy) => vNormal(m, xx, yy, 2), amb: [0.08, 0.08, 0.1] });
  }
  // 畳まれた寝袋 (左)
  const bed = new Mask(W, H); bed.ellipse(40, 94, 17, 6.5); bed.ellipse(25, 92, 5.5, 6.5);
  paintLit(L, bed, (x, y) => (Math.abs(x - 34) < 1 || Math.abs(x - 47) < 1 ? [80, 54, 50] : [150, 96, 90]), lights, { ny: (x, y) => vNormal(bed, x, y, 4), amb: [0.06, 0.06, 0.08] });
  // 木箱と、開いた手記・蝋燭
  const box = new Mask(W, H); box.rect(104, 72, 40, 22);
  paintLit(L, box, (x, y) => ((y - 72) % 6 === 0 || x === 104 || x === 143 ? [70, 48, 34] : [130, 94, 62]), lights, { amb: [0.06, 0.06, 0.08] });
  const book = new Mask(W, H); book.poly([104, 66, 123, 61, 124, 71, 104, 72]); book.poly([124, 61, 143, 66, 143, 72, 124, 71]);
  paintLit(L, book, (x, y) => {
    if (x === 123 || x === 124) return [130, 110, 86];
    const row = (y === 65 || y === 67 || y === 69);
    const ln = row && ((x > 107 && x < 121) || (x > 126 && x < 140)) && h2(x >> 2, y, 5) > 0.25;
    return ln ? [70, 58, 60] : [236, 222, 186];
  }, lights, { amb: [0.2, 0.2, 0.2] });
  const sg = new Mask(W, H); sigilMask(sg, 136, 67.5, 0.3); L.paint(sg, () => [110, 30, 30]);
  const cnd = new Mask(W, H); cnd.rect(CX - 1 + 18, CY - 7, 3, 7); cnd.ellipse(CX + 18.5, CY + 0.5, 3.2, 1);
  paintLit(L, cnd, () => [230, 220, 196], lights, { amb: [0.35, 0.35, 0.35] });
  const fl = new Mask(W, H); fl.poly([CX + 18.5, CY - 15, CX + 20.4, CY - 9, CX + 18.5, CY - 7, CX + 16.6, CY - 9]);
  L.paint(fl, (x, y) => rc(R_EMBER, clamp(0.99 - (CY - 7 - y) * 0.012)));
  glow(L, CX + 18.5, CY - 10, 36, C_CANDLE, 0.42, 2.4);
  motes(L, lights, 50, 51, C_EMBER);
  vignette(L, 0.82);
  return L.canvas(12);
}

// ======================= 6. 館の燭台 (章の結び) =======================
function sceneCandle() {
  const W = ART_W, H = ART_H, L = new Layer(W, H);
  const FX = 96, FY = 26;
  const lights = [
    { x: FX, y: FY, r: 150, c: C_CANDLE, k: 1.35, p: 1.6 },
    { x: FX, y: FY + 2, r: 46, c: C_SOUL, k: 0.5, p: 1.4 },
  ];
  // 館の壁: 板張り
  L.shade(0, 0, W - 1, H - 1, (x, y) => {
    const plank = (x % 16 === 0) ? 0.55 : 1;
    const g = Math.sin(y * 0.5 + vnoise(x * 0.1, y * 0.05, 4) * 6) * 0.5 + 0.5;
    const alb = mix([96, 70, 54], [128, 94, 70], g * 0.4).map((v) => v * plank);
    return lit(alb, lightAt(x, y, lights), [0.05, 0.045, 0.06]);
  });
  // 棚と、棚に腰かけて眠る人業たち (丸い頭・木の器)
  for (const sy of [44, 82]) {
    const sh = new Mask(W, H); sh.rect(0, sy, W, 4);
    paintLit(L, sh, () => [120, 84, 58], lights, { ny: () => -0.7, amb: [0.05, 0.05, 0.06] });
    for (let i = 0; i < 8; i++) {
      const dx = 12 + i * 24; if (Math.abs(dx - FX) < 22) continue;
      const d = new Mask(W, H);
      d.ellipse(dx, sy - 21, 4.6, 5);                                  // 頭
      d.poly([dx - 5, sy, dx - 4, sy - 15, dx + 4, sy - 15, dx + 5, sy]); // 胴
      d.line(dx - 4, sy - 13, dx - 7, sy - 3, 2); d.line(dx + 4, sy - 13, dx + 7, sy - 3, 2); // 垂れた腕
      d.rect(dx - 4, sy, 3, 6); d.rect(dx + 1, sy, 3, 6);              // 棚から下がる脚
      paintLit(L, d, (x, y) => (Math.abs(y - (sy - 16)) < 1 || Math.abs(y - (sy - 8)) < 1 ? [56, 56, 64] : [196, 156, 116]), lights, { amb: [0.05, 0.05, 0.06] });
    }
  }
  // 燭台 (中央・三本腕の真鍮。灯は真ん中のひとつだけ)
  const st = new Mask(W, H);
  st.rect(FX - 1, 34, 3, 62); st.poly([FX - 12, 104, FX + 13, 104, FX + 6, 95, FX - 5, 95]);
  st.ellipse(FX + 0.5, 50, 4, 2);
  for (const sx of [-1, 1]) {
    st.line(FX + 0.5, 50, FX + 0.5 + sx * 22, 50, 2);                  // 腕
    st.line(FX + 0.5 + sx * 22, 50, FX + 0.5 + sx * 22, 42, 2);        // 立ち上がり
    st.rect(FX + sx * 22 - 2, 40, 5, 2);                               // 受け皿
    st.rect(FX + sx * 22 - 1, 33, 3, 7);                               // 消えた蝋燭
  }
  st.rect(FX - 2, 30, 5, 4);
  paintLit(L, st, (x, y) => (y < 40 && Math.abs(x - FX) > 16 ? [200, 190, 170] : ALB_BRASS), lights, { amb: [0.1, 0.08, 0.06] });
  const cd = new Mask(W, H); cd.rect(FX - 1, FY + 3, 3, 4);
  paintLit(L, cd, () => [236, 226, 200], lights, { amb: [0.4, 0.4, 0.4] });
  const fl = new Mask(W, H); fl.poly([FX + 0.5, FY - 10, FX + 3.2, FY - 1, FX + 0.5, FY + 3, FX - 2.2, FY - 1]);
  L.paint(fl, (x, y) => {
    const core = Math.abs(x + 0.5 - (FX + 0.5)) < 1.2 && y > FY - 5;
    return core ? rc(R_SOUL, 0.98) : rc(R_EMBER, clamp(0.97 - (FY - y) * 0.018));
  });
  glow(L, FX + 0.5, FY - 2, 50, C_CANDLE, 0.36, 2.4);
  glow(L, FX + 0.5, FY - 1, 14, C_SOUL, 0.35, 2);
  motes(L, lights, 50, 61, C_CANDLE);
  vignette(L, 0.88);
  return L.canvas(12);
}

const SCENES = { lantern: sceneLantern, sigil: sceneSigil, arm: sceneArm, abbot: sceneAbbot, camp: sceneCamp, candle: sceneCandle };
const cache = {};
// 物語の一枚絵 (192×108 の canvas)。無ければ null
export function storyArt(key) {
  if (!key || !SCENES[key] || typeof document === "undefined") return null;
  if (!cache[key]) {
    try { cache[key] = SCENES[key](); } catch (e) { console.error(e); return null; }
  }
  // 同じ絵を複数の場面で使うので、表示ごとに写しを返す
  const c = document.createElement("canvas");
  c.width = ART_W; c.height = ART_H;
  c.getContext("2d").drawImage(cache[key], 0, 0);
  return c;
}
export const STORY_ART_KEYS = Object.keys(SCENES);
// 空いた時間に下ごしらえ (語りの最中に描いて引っかからないように)
export function prewarmStoryArt(keys = STORY_ART_KEYS) {
  const list = [...keys];
  const step = () => {
    const k = list.shift();
    if (!k) return;
    if (!cache[k]) { try { cache[k] = SCENES[k](); } catch (e) { /* 演出のみ */ } }
    if (list.length) (typeof requestIdleCallback === "function" ? requestIdleCallback(step, { timeout: 2000 }) : setTimeout(step, 200));
  };
  if (typeof document !== "undefined") (typeof requestIdleCallback === "function" ? requestIdleCallback(step, { timeout: 3000 }) : setTimeout(step, 800));
}
