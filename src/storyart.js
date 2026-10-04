// ===== 物語の一枚絵 — 師を捜す物語の要所に出すドット絵 (src/story.js の art キー) =====
// pxpaint.js の絵筆 (形 = Mask、浮動小数の色 = Layer、最後にマスターパレットへ順序ディザで量子化) で、
// 画素ごとに「素材の色 × (環境光 + 点光源)」を塗る。光は 2D の点光源で、形の擬似法線 (Mask.nx) と
// 上下の向き (縁までの距離) で面の向きを決める。1枚 192×108 ドット (16:9)、描いた絵は使い回す (cache)。
//   lantern = 師のランタン (地下墓地) / sigil = 壁に刻まれた印 (回廊) / arm = 流れ着いた腕 (取水口・館)
//   abbot = 修道院長の記憶 / camp = 師の野営跡 (坑口) / candle = 館の燭台 (章の結び)
//   第二章: roll = 守備隊の当直簿・軍議の卓 / cell = 牢壁の名 / head = 独房の人業の頭 / banner = 焼けた軍旗 (大手門) / hole = 本丸の大穴
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

// ======================= 第二章「捨て砦」 =======================
// 7. 守備隊の当直簿 (詰所の机。矢狭間の月明かりと蝋燭、開いた帳面と鍵束)
function sceneRoll() {
  const W = ART_W, H = ART_H, L = new Layer(W, H);
  const CX = 162, CY = 44;
  const lights = [
    { x: CX, y: CY, r: 130, c: C_CANDLE, k: 1.25, p: 1.6 },
    { x: 46, y: 24, r: 90, c: C_MOON, k: 0.7, p: 1.3 },
  ];
  stoneRoom(L, lights, { floorY: 90, seed: 19, wallAlb: [86, 82, 92], amb: [0.05, 0.05, 0.08] });
  // 矢狭間 (細い縦の窓) と、そこから射す月の筋
  const slit = new Mask(W, H); slit.rect(44, 10, 5, 30); slit.ellipse(46.5, 10, 2.5, 2.5);
  L.paint(slit, (x, y) => [70 + y, 86 + y, 140 + y]);
  L.shade(30, 38, 110, 100, (x, y) => {
    const t = (y - 38) / 62, cx = 46 + t * 34, half = 3 + t * 16;
    const d = Math.abs(x + 0.5 - cx) / half;
    if (d >= 1) return null;
    L.add(x, y, [C_MOON[0] * 40, C_MOON[1] * 44, C_MOON[2] * 60], (1 - d) * (1 - t * 0.6));
    return null;
  });
  // 壁の槍立て (左奥): 3本の槍
  for (let i = 0; i < 3; i++) {
    const sp = new Mask(W, H); const x = 14 + i * 7;
    sp.rect(x, 22, 2, 66); sp.poly([x - 1, 22, x + 3, 22, x + 1, 13]);
    paintLit(L, sp, (xx, yy) => (yy < 23 ? [170, 176, 188] : ALB_WOOD), lights, { nxMax: 1, amb: [0.16, 0.16, 0.2] });
  }
  const rack = new Mask(W, H); rack.rect(10, 70, 26, 3); rack.rect(10, 40, 26, 2);
  paintLit(L, rack, () => ALB_WOOD, lights, { amb: [0.12, 0.12, 0.15] });
  // 机 (天板と脚)
  const desk = new Mask(W, H);
  desk.poly([62, 68, 186, 68, 190, 75, 58, 75]); desk.rect(64, 75, 5, 24); desk.rect(180, 75, 5, 24);
  paintLit(L, desk, (x, y) => {
    if (y < 70) return mix(ALB_WOOD, [180, 140, 90], 0.3);
    return mix(ALB_WOOD_D, ALB_WOOD, Math.sin(x * 0.7 + vnoise(x * 0.2, y, 3) * 6) * 0.25 + 0.4);
  }, lights, { ny: (x, y) => (y < 70 ? -1 : 0.3), amb: [0.06, 0.05, 0.08] });
  // 開いた当直簿 (机に寝かせた見開き: 奥の縁が狭い台形。左頁は古い茶色の字、右頁の下に新しい黒い字)
  const BL = 92, BM = 124, BR = 156, BT = 55, BB = 67;
  const xAt = (x0, y) => x0 + (BM - x0) * (BB - y) / (BB - BT) * 0.22; // 奥ほど内へ寄る
  const book = new Mask(W, H);
  book.poly([xAt(BL, BT), BT, BM, BT + 1, xAt(BR, BT), BT, BR, BB, BM, BB - 1, BL, BB]);
  paintLit(L, book, (x, y) => {
    if (x === BM) return [110, 90, 66];
    const left = x < BM;
    const inner = left ? x > xAt(BL, y) + 3 && x < BM - 3 : x > BM + 3 && x < xAt(BR, y) - 3;
    const ln = inner && (y % 2 === 0) && y > BT + 1 && y < BB - 1 && h2(x >> 1, y, 9) > 0.18;
    if (ln && !left && y >= BB - 5) return [26, 22, 30];  // 新しい墨の行
    if (ln) return [128, 90, 62];
    return mix(ALB_PAPER, [240, 226, 186], (y - BT) / (BB - BT) * 0.5);
  }, lights, { amb: [0.22, 0.21, 0.22] });
  const edge = new Mask(W, H); edge.rect(BL, 67, BR - BL + 1, 2);
  paintLit(L, edge, () => [190, 176, 140], lights, { amb: [0.1, 0.1, 0.1] });
  // 綴じ紐と、結ばれた鍵束 (机から垂れる)
  for (let i = 0; i < 10; i++) L.px(BM, 69 + i, [170, 140, 96]);
  const ring = new Mask(W, H);
  for (let a = 0; a < Math.PI * 2; a += 0.05) ring.rect(Math.round(BM + Math.cos(a) * 4), Math.round(83 + Math.sin(a) * 4), 1, 1);
  const keys = new Mask(W, H);
  for (const [x0, y0, x1, y1] of [[BM - 3, 86, BM - 8, 97], [BM + 1, 87, BM + 2, 99], [BM + 4, 86, BM + 9, 96]]) {
    keys.line(x0, y0, x1, y1, 1.6); keys.rect(x1 - 1, y1, 3, 2);
  }
  paintLit(L, ring, () => mix(ALB_RUST, ALB_IRON, 0.4), lights, { amb: [0.3, 0.22, 0.18] });
  paintLit(L, keys, (x, y) => mix(ALB_RUST, ALB_BRASS, vnoise(x, y, 3) * 0.6), lights, { amb: [0.3, 0.22, 0.18] });
  // 兜 (机の左端) と、蝋燭 (右)
  const helm = new Mask(W, H); helm.ellipse(78, 61, 9, 7); helm.rect(69, 61, 18, 6);
  paintLit(L, helm, (x, y) => (y === 64 && x > 72 && x < 84 ? [20, 18, 22] : mix(ALB_IRON, [130, 134, 146], 0.5)), lights, { ny: (x, y) => vNormal(helm, x, y, 4), amb: [0.12, 0.12, 0.15] });
  const cnd = new Mask(W, H); cnd.rect(CX - 1, CY + 8, 4, 16); cnd.ellipse(CX + 1, CY + 24, 5, 1.6);
  paintLit(L, cnd, (x, y) => (y > CY + 22 ? [150, 120, 80] : [236, 226, 200]), lights, { amb: [0.25, 0.25, 0.25] });
  const fl = new Mask(W, H); fl.poly([CX + 1, CY - 3, CX + 3.6, CY + 4, CX + 1, CY + 8, CX - 1.6, CY + 4]);
  L.paint(fl, (x, y) => (Math.abs(x - CX - 0.5) < 1 && y > CY + 3 ? [255, 250, 220] : rc(R_EMBER, clamp(0.98 - (CY + 8 - y) * 0.03))));
  glow(L, CX + 1, CY + 3, 26, C_CANDLE, 0.28, 2.4);
  motes(L, lights, 40, 23, C_CANDLE);
  vignette(L, 0.88);
  return L.canvas(12);
}

// 8. 牢壁に刻まれた名 (鉄格子の窓から月明かり。壁一面の刻み、いちばん下に師の印が淡く光る)
function sceneCell() {
  const W = ART_W, H = ART_H, L = new Layer(W, H);
  const SX = 132, SY = 80;
  const lights = [
    { x: 150, y: 4, r: 170, c: C_MOON, k: 1.5, p: 1.1 },
    { x: 40, y: 104, r: 90, c: C_CANDLE, k: 0.55, p: 1.5 },   // 手元の灯 (隊のランタン)
    { x: SX, y: SY, r: 36, c: C_SOUL, k: 0.7, p: 1.6 },
  ];
  // 壁 (近い。大きな粗い石)
  L.shade(0, 0, W - 1, 96, (x, y) => {
    const a = ashlar(x, y, 30, 15, 41);
    const n = (fbm(x * 0.15, y * 0.15, 5) - 0.5) * 0.4 + (a.id - 0.5) * 0.25;
    let alb = mix([110, 106, 116], [76, 72, 84], clamp(0.45 - n));
    if (a.joint) alb = [22, 20, 28];
    return lit(alb, lightAt(x, y, lights, a.left ? -0.5 : 0, a.top ? -0.6 : 0), [0.07, 0.07, 0.1]);
  });
  L.shade(0, 97, W - 1, H - 1, (x, y) => lit(mix([70, 64, 60], [104, 96, 80], vnoise(x * 0.5, y * 0.8, 4)), lightAt(x, y, lights, 0, -0.9), [0.05, 0.05, 0.07]));
  // 刻まれた名: 縦に並ぶ小さな字 (3×3 の刻み)。古い列ほど浅く、右の新しい列ほど深く白い
  const R = rng(91);
  for (let col = 0; col < 12; col++) {
    const x0 = 30 + col * 12 + (R() * 3 | 0), n = 4 + (R() * 5 | 0), y0 = 8 + (R() * 12 | 0);
    const depth = 0.3 + col / 12 * 0.7;
    const cut = (x, y) => {
      const c = L.get(x, y); if (!c) return;
      L.px(x, y, [c[0] * (1 - depth * 0.55), c[1] * (1 - depth * 0.55), c[2] * (1 - depth * 0.5)]);
      const c2 = L.get(x, y + 1); if (c2 && depth > 0.45) L.px(x, y + 1, [c2[0] + 40 * depth, c2[1] + 40 * depth, c2[2] + 46 * depth]); // 削れた縁
    };
    for (let k = 0; k < n; k++) {
      const y = y0 + k * 5;
      const g = (R() * 7) | 0; // 字の形 (横画・縦画・はね の組み合わせ)
      if (g & 1) { cut(x0, y); cut(x0 + 1, y); cut(x0 + 2, y); }
      if (g & 2) { cut(x0 + 1, y + 1); cut(x0 + 1, y + 2); }
      if (g & 4) { cut(x0, y + 2); cut(x0 + 2, y + 1); } else { cut(x0 + 2, y + 2); cut(x0, y + 1); }
    }
    // 肩書きの刻み (名の下の横線)
    for (let k = -1; k < 5; k++) cut(x0 + k, y0 + n * 5 + 1);
  }
  // いちばん下の深い刻みと、師の印 (魂火色に淡く光る溝)
  const gr = new Mask(W, H); sigilLines(gr, SX, SY, 0.62, 1.1);
  L.paint(gr, (x, y) => rc(R_SOUL, 0.66 + 0.2 * vnoise(x, y, 7)));
  glow(L, SX, SY, 20, C_SOUL, 0.22, 2);
  // 鉄格子の窓 (右上)
  const win = new Mask(W, H); win.rect(140, 0, 26, 12);
  L.paint(win, (x, y) => [90, 104, 150]);
  const bars = new Mask(W, H); for (let x = 142; x < 166; x += 5) bars.rect(x, 0, 2, 13); bars.rect(138, 11, 30, 2);
  paintLit(L, bars, () => [70, 72, 82], lights, { nxMax: 1, amb: [0.06, 0.06, 0.08] });
  // 窓から射す月の筋
  L.shade(120, 12, 191, 107, (x, y) => {
    const t = (y - 12) / 95, cx = 153 - t * 26, half = 13 + t * 18;
    const d = Math.abs(x + 0.5 - cx) / half;
    if (d >= 1) return null;
    L.add(x, y, [C_MOON[0] * 34, C_MOON[1] * 38, C_MOON[2] * 54], (1 - d) * (1 - t * 0.7));
    return null;
  });
  // 壁から垂れた鎖と枷 (左)
  const ch = new Mask(W, H);
  for (let y = 6; y < 70; y += 4) { if ((y / 4) % 2 < 1) ch.rect(16, y, 2, 4); else ch.rect(15, y + 1, 4, 2); }
  ch.ellipse(17, 74, 5, 4);
  const hole = new Mask(W, H); hole.ellipse(17, 74, 2.6, 2);
  paintLit(L, ch, (x, y) => (hole.at(x, y) ? null : mix([120, 124, 134], ALB_RUST, 0.4)), lights, { nxMax: 1, amb: [0.16, 0.15, 0.17] });
  // 床の藁と、割れた椀
  for (let i = 0; i < 70; i++) { const x = 30 + R() * 140, y = 98 + R() * 9; L.px(x, y, mix([170, 146, 80], [100, 84, 48], R())); L.px(x + 1, y + (R() < 0.5 ? 0 : 1), [140, 116, 64]); }
  const bowl = new Mask(W, H); bowl.ellipse(60, 101, 6, 3); bowl.rect(54, 98, 12, 3);
  paintLit(L, bowl, (x, y) => (y < 99 && x > 56 && x < 64 ? [30, 26, 24] : [150, 126, 96]), lights, { amb: [0.1, 0.1, 0.12] });
  motes(L, lights, 60, 31, [0.7, 0.75, 1.0]);
  vignette(L, 0.85);
  return L.canvas(12);
}

// 9. 独房の人業の頭 (藁の上の木彫りの頭。額の師の印と、閉じた瞼の隙間が魂火で光る)
function sceneHead() {
  const W = ART_W, H = ART_H, L = new Layer(W, H);
  const HX = 96, HY = 58;
  const lights = [
    { x: 62, y: 84, r: 110, c: C_CANDLE, k: 1.2, p: 1.25 },     // 手元のランタン (左下から)
    { x: HX + 2, y: HY, r: 34, c: C_SOUL, k: 0.5, p: 1.8 },
    { x: 140, y: -10, r: 120, c: C_MOON, k: 0.45, p: 1.3 },
  ];
  // 奥の壁と床 (暗い独房)
  stoneRoom(L, lights, { floorY: 76, seed: 53, wallAlb: [76, 72, 84], amb: [0.03, 0.03, 0.05] });
  // 藁の寝床
  const R = rng(57);
  const straw = new Mask(W, H); straw.ellipse(HX, 84, 50, 10);
  paintLit(L, straw, (x, y) => mix([180, 150, 80], [100, 80, 42], vnoise(x * 1.2, y * 2.4, 4)), lights, { ny: (x, y) => vNormal(straw, x, y, 4), amb: [0.05, 0.05, 0.06] });
  for (let i = 0; i < 90; i++) { const a = R() * Math.PI * 2, r = R(); const x = HX + Math.cos(a) * 54 * r, y = 84 + Math.sin(a) * 11 * r; const m = new Mask(W, H); m.line(x, y, x + (R() - 0.5) * 8, y + (R() - 0.5) * 2, 0.8); paintLit(L, m, () => [200, 170, 96], lights, { amb: [0.05, 0.05, 0.06] }); }
  // 長い髪 (黒い木彫り。頭頂から左右へ流れ、藁の上に広がる)
  const hair = new Mask(W, H);
  hair.ellipse(HX, HY - 3, 19, 17);
  hair.poly([HX - 16, HY - 2, HX - 9, HY + 12, HX - 22, HY + 26, HX - 42, HY + 28, HX - 30, HY + 18]);
  hair.poly([HX + 16, HY - 2, HX + 10, HY + 12, HX + 22, HY + 26, HX + 40, HY + 27, HX + 28, HY + 16]);
  paintLit(L, hair, (x, y) => {
    const g = Math.sin((x - HX) * 0.8 + (y - HY) * 0.25) * 0.5 + 0.5; // 彫りの筋
    return mix([54, 40, 36], [110, 84, 66], g * 0.8);
  }, lights, { ny: (x, y) => vNormal(hair, x, y, 5), amb: [0.05, 0.05, 0.06] });
  // 顔 (淡い木肌の楕円。前髪の下に、閉じた瞼と小さな口)
  const face = new Mask(W, H); face.ellipse(HX, HY + 3, 13, 15);
  const bang = new Mask(W, H); bang.ellipse(HX, HY - 11, 14, 5);
  paintLit(L, face, (x, y) => {
    if (bang.at(x, y)) return null;
    const lid = (cx) => y === HY + 2 + (Math.abs(x - cx) > 2 ? 1 : 0) && Math.abs(x - cx) < 4;
    if (lid(HX - 6) || lid(HX + 6)) return [60, 36, 28];
    if (y === HY + 11 && Math.abs(x - HX) < 2) return [120, 66, 56];
    return mix([236, 204, 160], [196, 156, 112], vnoise(x * 0.6, y * 0.6, 2) * 0.5);
  }, lights, { ny: (x, y) => vNormal(face, x, y, 6) * 0.4, nxMax: 3, amb: [0.16, 0.14, 0.14] });
  // 瞼の隙間から漏れる魂火
  for (const ex of [HX - 6, HX + 6]) for (let k = -2; k <= 2; k++) L.add(ex + k, HY + 3, [60, 220, 160], 0.35);
  // 額の印 (前髪の間に覗く小さな灯の手)
  const sg = new Mask(W, H); sigilMask(sg, HX, HY - 5, 0.2);
  L.paint(sg, () => rc(R_SOUL, 0.9));
  // 首の黒鉄の継ぎ目 (断ち切れて、木がささくれている)
  const neck = new Mask(W, H); neck.rect(HX - 5, HY + 15, 11, 4);
  paintLit(L, neck, (x, y) => (y === HY + 18 && h2(x, 1, 3) > 0.5 ? [190, 150, 100] : [70, 72, 82]), lights, { amb: [0.1, 0.1, 0.12] });
  glow(L, HX, HY - 6, 10, C_SOUL, 0.18, 2.2);
  // 手前の鉄格子 (暗い影)
  const bars = new Mask(W, H);
  for (const x of [6, 28, 160, 182]) bars.rect(x, 0, 5, H);
  bars.rect(0, 6, W, 3);
  L.paint(bars, (x, y) => [14 + (x % 5 === 1 ? 20 : 0), 12, 16]);
  motes(L, lights, 40, 59, C_CANDLE);
  vignette(L, 0.9);
  return L.canvas(12);
}

// 10. 焼けた軍旗 (雷雨の大手門。崩れた門の前に、雷に焼かれた旗竿。稲妻と雨と水たまり)
function sceneBanner() {
  const W = ART_W, H = ART_H, L = new Layer(W, H);
  const BX = 112;
  const lights = [
    { x: 150, y: 0, r: 200, c: [0.75, 0.8, 1.0], k: 1.15, p: 1.15 },   // 稲妻
    { x: 20, y: 96, r: 70, c: C_EMBER, k: 0.35, p: 1.5 },             // 燻る焚き火
  ];
  // 空 (嵐雲)
  L.shade(0, 0, W - 1, 60, (x, y) => {
    const n = fbm(x * 0.05, y * 0.09, 7);
    const l = lightAt(x, y, lights);
    const b = clamp(n * 0.9 + (l[2] - 0.4) * 0.35);
    return [20 + b * 70, 22 + b * 76, 34 + b * 100];
  });
  // 稲妻 (枝分かれ)
  const bolt = new Mask(W, H);
  let x = 150, y = 0;
  const R = rng(17);
  while (y < 40) { const nx = x + (R() - 0.55) * 10, ny = y + 4 + R() * 4; bolt.line(x, y, nx, ny, 1.4); if (R() < 0.3) bolt.line(nx, ny, nx + (R() - 0.5) * 18, ny + 8, 0.8); x = nx; y = ny; }
  L.paint(bolt, () => [235, 240, 255]);
  glow(L, 148, 22, 40, [0.7, 0.75, 1.0], 0.28, 2);
  // 崩れた門 (左右の塔と、折れたアーチ)
  const gate = new Mask(W, H);
  gate.rect(28, 20, 34, 70); gate.rect(146, 26, 36, 64);
  gate.poly([62, 34, 84, 26, 90, 32, 70, 42, 62, 44]); gate.poly([146, 36, 128, 30, 124, 36, 140, 44, 146, 46]);
  for (let i = 0; i < 5; i++) { gate.rect(28 + i * 7, 15, 4, 6); gate.rect(146 + i * 7, 21, 4, 6); } // 胸壁
  L.paint(gate, (xx, yy) => {
    const a = ashlar(xx, yy, 12, 6, 61);
    let alb = mix([80, 80, 90], [56, 56, 66], fbm(xx * 0.2, yy * 0.2, 3));
    if (a.joint) alb = [22, 22, 30];
    return lit(alb, lightAt(xx, yy, lights, xx < 96 ? 0.6 : -0.6, a.top ? -0.5 : 0), [0.05, 0.05, 0.08]);
  });
  // 地面 (濡れた石畳と水たまり)
  L.shade(0, 61, W - 1, H - 1, (xx, yy) => {
    if (gate.at(xx, yy)) return null;
    const w = worley(xx * 0.09, yy * 0.2, 13);
    const pud = fbm(xx * 0.06, yy * 0.15, 9) > 0.58;
    const l = lightAt(xx, yy, lights, 0, -0.9);
    if (pud) { const s = clamp(0.3 + Math.sin(xx * 0.5 + yy * 2) * 0.2) * (l[2] + 0.2); return [14 + s * 70, 16 + s * 80, 26 + s * 110]; }
    let alb = mix([70, 70, 80], [96, 96, 104], w[2] * 0.6);
    if (w[1] - w[0] < 0.08) alb = [20, 20, 28];
    return lit(alb, l, [0.05, 0.05, 0.08]);
  });
  // 旗竿 (炭のように黒い) と、焼け残った軍旗 (裂けて、端が焦げている)
  const pole = new Mask(W, H); pole.rect(BX, 14, 3, 84); pole.ellipse(BX + 1.5, 13, 2.5, 2.5);
  paintLit(L, pole, () => [40, 34, 32], lights, { nxMax: 1, amb: [0.05, 0.05, 0.06] });
  const flag = new Mask(W, H);
  for (let fx = 0; fx < 40; fx++) {
    const top = 18 + Math.sin(fx * 0.18) * 2.4, bot = 46 + Math.sin(fx * 0.18 + 0.6) * 2.4 - (fx > 26 ? (fx - 26) * 1.1 : 0);
    for (let fy = Math.round(top); fy < bot; fy++) if (!(fx > 30 && vnoise(fx * 0.6, fy * 0.6, 5) > 0.62)) flag.rect(BX + 3 + fx, fy, 1, 1);
  }
  paintLit(L, flag, (fx, fy) => {
    const dx = fx - BX - 3;
    const burn = clamp((dx - 20) / 18 + vnoise(fx * 0.4, fy * 0.4, 8) * 0.5 - 0.25);
    const fold = Math.sin(dx * 0.35) * 0.5 + 0.5;
    const cloth = mix([140, 40, 36], [96, 26, 26], fold);
    // 紋章 (塔を描いた白い印)
    const ex = dx - 10, ey = fy - 31;
    if (ex >= 0 && ex < 6 && ey >= -6 && ey < 6 && !(ex >= 2 && ex < 4 && ey < -3)) return mix([200, 190, 160], [40, 30, 30], burn);
    return mix(cloth, [30, 22, 20], burn);
  }, lights, { amb: [0.08, 0.07, 0.08] });
  // 燻る焚き火 (左下) と、崩れた槍
  glow(L, 20, 96, 14, C_EMBER, 0.5, 2.2);
  for (let i = 0; i < 4; i++) { const m = new Mask(W, H); m.line(60 + i * 9, 102 - i, 80 + i * 8, 90 - i * 2, 1.2); paintLit(L, m, () => [90, 84, 80], lights, { amb: [0.05, 0.05, 0.07] }); }
  // 雨 (斜めの細い筋)
  const R2 = rng(29);
  for (let i = 0; i < 260; i++) {
    const rx = R2() * (W + 30) - 10, ry = R2() * H, len = 3 + (R2() * 4 | 0);
    for (let k = 0; k < len; k++) { const px = Math.round(rx - k * 0.5), py = Math.round(ry + k); const c = L.get(px, py); if (c) L.px(px, py, [c[0] * 0.6 + 90, c[1] * 0.6 + 96, c[2] * 0.6 + 120]); }
  }
  vignette(L, 0.82);
  return L.canvas(12);
}

// 11. 本丸の大穴 (割れた石床の大穴へ、魂の流れが渦を巻いて落ちてゆく)
function sceneHole() {
  const W = ART_W, H = ART_H, L = new Layer(W, H);
  const PX = 96, PY = 76;
  const lights = [
    { x: PX, y: PY, r: 120, c: C_SOUL, k: 1.05, p: 1.6 },
    { x: 20, y: 10, r: 70, c: C_EMBER, k: 0.3, p: 1.4 },
  ];
  // 奥の壁と柱
  L.shade(0, 0, W - 1, 56, (x, y) => {
    const a = ashlar(x, y, 20, 10, 71);
    let alb = mix([72, 68, 82], [52, 48, 60], fbm(x * 0.12, y * 0.12, 6));
    if (a.joint) alb = [16, 14, 22];
    return lit(alb, lightAt(x, y, lights, 0, 0.4), [0.04, 0.04, 0.06]);
  });
  for (const cx of [26, 70, 122, 166]) {
    const col = new Mask(W, H); col.rect(cx - 5, 0, 10, 58); col.rect(cx - 7, 52, 14, 5);
    paintLit(L, col, (x, y) => mix([110, 104, 118], [76, 72, 86], vnoise(x, y * 0.3, cx)), lights, { amb: [0.05, 0.05, 0.07] });
  }
  // 床 (奥行きのある敷石) と、中央の楕円の大穴
  L.shade(0, 57, W - 1, H - 1, (x, y) => {
    const t = (y - 57) / (H - 57);
    const w = worley(x * 0.08 * (1.4 - t * 0.6), y * 0.2, 77);
    let alb = mix([78, 74, 86], [110, 104, 112], w[2] * 0.6);
    if (w[1] - w[0] < 0.07) alb = [18, 16, 24];
    return lit(alb, lightAt(x, y, lights, 0, -0.9), [0.04, 0.04, 0.06]);
  });
  const hole = new Mask(W, H); hole.ellipse(PX, PY, 44, 14);
  // 割れ目の縁をぎざぎざに
  for (let a = 0; a < Math.PI * 2; a += 0.12) { const r = 1 + vnoise(a * 3, 1, 4) * 0.25; hole.ellipse(PX + Math.cos(a) * 44 * r, PY + Math.sin(a) * 14 * r, 3, 2); }
  L.paint(hole, (x, y) => {
    // 底の見えない闇 (中ほどが最も暗く、縁の内壁だけが魂火を照り返す)
    const d = Math.hypot((x - PX) / 44, (y - PY) / 14);
    const v = 0.05 + 0.42 * smooth(0.35, 1.0, d);
    return rc(R_SOUL, v);
  });
  // 穴の縁の内壁 (手前側だけ見える)
  L.shade(PX - 46, PY - 2, PX + 46, PY + 18, (x, y) => {
    if (!hole.at(x, y) || hole.at(x, y - 3)) return null;
    return [40, 46, 52];
  });
  // 魂の流れ: 四方から穴へ渦を巻いて落ちる光の帯 (点の列)
  const R = rng(83);
  for (let s = 0; s < 9; s++) {
    let a = s / 9 * Math.PI * 2 + R(), r = 1.6;
    for (let k = 0; k < 120; k++) {
      const x = PX + Math.cos(a) * 44 * r, y = PY - 26 * Math.max(0, r - 1) + Math.sin(a) * 14 * r;
      const v = clamp(0.5 + Math.min(1, r) * 0.5) * clamp(r * 1.6);   // 穴の奥へ吸い込まれて消えてゆく
      if (k % 2 === 0) L.add(Math.round(x), Math.round(y), [C_SOUL[0] * 255, C_SOUL[1] * 255, C_SOUL[2] * 255], 0.35 * v);
      a += 0.06; r -= 0.013;
      if (r < 0.1) break;
    }
  }
  // 漂う魂 (小さな灯)
  for (let i = 0; i < 14; i++) { const x = PX + (R() - 0.5) * 140, y = 20 + R() * 60; glow(L, x, y, 3 + R() * 3, C_SOUL, 0.5, 1.6); }
  glow(L, PX, PY, 50, C_SOUL, 0.3, 2.2);
  // 縁に置かれた、師のランタンの燭台跡 (小さな人影の代わりに、灯の消えた鉤)
  const hook = new Mask(W, H); hook.rect(146, 70, 2, 12); hook.rect(146, 70, 7, 2); hook.rect(151, 70, 2, 5);
  paintLit(L, hook, () => ALB_IRON, lights, { amb: [0.1, 0.1, 0.12] });
  motes(L, lights, 60, 87);
  vignette(L, 0.9);
  return L.canvas(12);
}

const SCENES = { lantern: sceneLantern, sigil: sceneSigil, arm: sceneArm, abbot: sceneAbbot, camp: sceneCamp, candle: sceneCandle,
  roll: sceneRoll, cell: sceneCell, head: sceneHead, banner: sceneBanner, hole: sceneHole };
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
