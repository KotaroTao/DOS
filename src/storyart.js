// ===== 物語の一枚絵 — 師を捜す物語の要所に出すドット絵 (src/story.js の art キー) =====
// pxpaint.js の絵筆 (形 = Mask、浮動小数の色 = Layer、最後にマスターパレットへ順序ディザで量子化) で、
// 画素ごとに「素材の色 × (環境光 + 点光源)」を塗る。光は 2D の点光源で、形の擬似法線 (Mask.nx) と
// 上下の向き (縁までの距離) で面の向きを決める。1枚 192×108 ドット (16:9)、描いた絵は使い回す (cache)。
//   lantern = 師のランタン (地下墓地) / sigil = 壁に刻まれた印 (回廊) / arm = 流れ着いた腕 (取水口・館)
//   abbot = 修道院長の記憶 / camp = 師の野営跡 (坑口) / candle = 館の燭台 (章の結び)
//   第二章: roll = 守備隊の当直簿・軍議の卓 / cell = 牢壁の名 / head = 独房の人業の頭 / banner = 焼けた軍旗 (大手門) / hole = 本丸の大穴
//   第三章: rope = 根に結ばれた綱 (縦穴) / hut = ヴェルナーの小屋 / torso = 根に抱かれたセラの胴 / tree = 魂喰らいの大樹
//   第六章: coat = 師の外套 (奈落の氷棚) / frozen = 氷柱の中の十一人 / aurora = 極光の書きつけ / frostking = 凍王の記憶
//   第七章: splint = 師の添え木 (沼の岸) / crest = 一門の印の器 (器の捨て場) / reeds = 毒消しの書きつけ (葦原) / swamplord = よどみの主の記憶
//   第八章: stick = 焼け焦げた杖 (螺旋階段の踊り場) / bell = 一門の鐘 (鐘楼) / rod = 雷よけの書きつけ (回廊の手すり) / stormlord = 嵐の主の記憶
// 画像ファイルは使わない。描き直すときは ux の確かめ用ページ (scratchpad) で拡大して目で見ること。
import { Mask, Layer, PAL, Palette, ramp, R_NIGHT, R_BONE, R_SOUL, R_EMBER, R_BLOOD, R_FOG, R_WOOD, R_STEEL, R_SOULSTONE, R_DUSK,
  rc, mix, mulc, clamp, smooth, fbm, vnoise, h2, worley, rng } from "./pxpaint.js";

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
  // ランタンを提げた男 (右・旅装のマントと帽子、左を向く)
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
  // とじ紐と、結ばれた鍵束 (机から垂れる)
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
    { x: 20, y: 96, r: 70, c: C_EMBER, k: 0.35, p: 1.5 },             // くすぶる焚き火
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
  // くすぶる焚き火 (左下) と、崩れた槍
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

// ======================= 第三章「魂脈の根」 =======================
// 地の底の森の素材: 魂の灯で光る苔・根 (樹皮)・霧
const ALB_BARK = [104, 84, 64], ALB_BARK_D = [64, 50, 40], ALB_MOSS = [70, 110, 74];
// 太い根の帯 (曲線に沿って太さ w の帯を Mask に描く)
function rootBand(m, pts, w0, w1 = w0) {
  for (let i = 0; i < pts.length - 1; i++) {
    const t0 = i / (pts.length - 1), t1 = (i + 1) / (pts.length - 1);
    m.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], w0 + (w1 - w0) * t0, 1, w0 + (w1 - w0) * t1);
  }
}
// 樹皮の色 (縦の筋と節)
const barkAlb = (x, y, seed = 1) => {
  const g = Math.sin(x * 0.9 + fbm(x * 0.1, y * 0.2, seed) * 7) * 0.5 + 0.5;
  return mix(ALB_BARK_D, ALB_BARK, g * 0.7 + vnoise(x * 0.4, y * 0.4, seed + 3) * 0.3);
};

// 12. 根に結ばれた綱 (縦穴の壁を這う根と、下の闇へ垂れる綱。結び目に油紙の書きつけ)
function sceneRope() {
  const W = ART_W, H = ART_H, L = new Layer(W, H);
  const KX = 104, KY = 40;
  const lights = [
    { x: 60, y: -30, r: 210, c: C_MOON, k: 1.25, p: 1.15 },         // 大穴の上から射す光
    { x: KX + 10, y: KY + 20, r: 90, c: C_CANDLE, k: 1.3, p: 1.4 },   // 手元のランタン
    { x: 120, y: 120, r: 90, c: C_SOUL, k: 0.55, p: 1.4 },          // 底の森の灯
  ];
  // 縦穴の岩壁 (奥へ暗くなる)
  L.shade(0, 0, W - 1, H - 1, (x, y) => {
    const w = worley(x * 0.12, y * 0.09, 41);
    const ridge = clamp((w[1] - w[0]) * 4);
    const alb = mix([70, 64, 66], [104, 96, 92], ridge * 0.5 + w[2] * 0.3);
    return lit(alb, lightAt(x, y, lights, 0, (w[0] - 0.4)), [0.07, 0.07, 0.09]);
  });
  // 底の闇と霧 (下の方)
  L.shade(0, 70, W - 1, H - 1, (x, y) => {
    const t = (y - 70) / 38;
    const f = fbm(x * 0.05, y * 0.12, 9) * 0.6;
    L.add(x, y, [C_SOUL[0] * 50, C_SOUL[1] * 70, C_SOUL[2] * 70], clamp(t * f));
    return null;
  });
  // 壁を這う太い根 (3本)
  const roots = new Mask(W, H);
  rootBand(roots, [[-4, 18], [40, 26], [80, 34], [120, 36], [160, 30], [196, 24]], 9, 7);
  rootBand(roots, [[30, -4], [44, 30], [52, 60], [46, 90], [56, 112]], 7, 4);
  rootBand(roots, [[170, -4], [160, 30], [168, 64], [150, 112]], 6, 3);
  rootBand(roots, [[120, 36], [136, 60], [130, 84]], 4, 2);
  paintLit(L, roots, (x, y) => mulc(barkAlb(x, y, 5), 1.3), lights, { ny: (x, y) => vNormal(roots, x, y, 4), amb: [0.12, 0.11, 0.11] });
  // 根に張りつく光る苔
  const R = rng(44);
  for (let i = 0; i < 140; i++) { const x = R() * W, y = R() * H; if (roots.at(x | 0, y | 0) && !roots.at(x | 0, (y | 0) - 2)) L.px(x, y, mix([90, 200, 150], [60, 140, 110], R())); }
  // 綱: 根に巻いた結び目から、下の闇へ垂れる (少し揺れる)
  const rope = new Mask(W, H);
  rope.ellipse(KX, KY - 3, 5, 3); rope.ellipse(KX + 2, KY - 1, 4, 2.5);
  for (let y = KY; y < H; y++) { const x = KX + Math.sin((y - KY) * 0.07) * 3 + (y - KY) * 0.08; rope.rect(Math.round(x), y, 2, 1); }
  paintLit(L, rope, (x, y) => ((x + y) % 3 === 0 ? [150, 120, 80] : [196, 166, 116]), lights, { nxMax: 1, amb: [0.12, 0.1, 0.1] });
  // 鉄のくさび (根の脇の岩に打ち込んだもの)
  for (const [x, y] of [[92, 46], [116, 30]]) { const m = new Mask(W, H); m.poly([x, y, x + 8, y - 1, x + 8, y + 2, x, y + 2]); m.ellipse(x + 8, y + 0.5, 1.6, 2); paintLit(L, m, () => [120, 124, 134], lights, { amb: [0.14, 0.14, 0.16] }); }
  // 油紙の書きつけ (結び目に括られて揺れる)
  const note = new Mask(W, H); note.poly([KX + 6, KY + 2, KX + 18, KY + 4, KX + 16, KY + 14, KX + 5, KY + 12]);
  paintLit(L, note, (x, y) => ((y === KY + 7 || y === KY + 10) && x > KX + 7 && x < KX + 15 && x % 2 ? [70, 52, 40] : [226, 206, 158]), lights, { amb: [0.3, 0.28, 0.24] });
  glow(L, KX + 10, KY + 20, 22, C_CANDLE, 0.18, 2.2);
  motes(L, lights, 70, 47, C_SOUL);
  vignette(L, 0.85);
  return L.canvas(12);
}

// 13. ヴェルナーの小屋 (光る木々の下の石の小屋。窓から机の上の手記が見える)
function sceneHut() {
  const W = ART_W, H = ART_H, L = new Layer(W, H);
  const lights = [
    { x: 30, y: 30, r: 90, c: C_SOUL, k: 0.75, p: 1.4 },
    { x: 170, y: 24, r: 90, c: C_SOUL, k: 0.7, p: 1.4 },
    { x: 100, y: 62, r: 40, c: C_CANDLE, k: 0.8, p: 1.5 },   // 窓の内の燐火
  ];
  // 霧の森の奥 (暗い幹の列と霧)
  L.shade(0, 0, W - 1, H - 1, (x, y) => {
    const f = fbm(x * 0.03, y * 0.06, 13);
    const base = [14 + f * 16, 22 + f * 22, 22 + f * 22];
    const l = lightAt(x, y, lights);
    return [base[0] + l[0] * 40, base[1] + l[1] * 50, base[2] + l[2] * 46];
  });
  for (const [cx, w, sh] of [[12, 10, 0.5], [46, 7, 0.4], [150, 8, 0.45], [182, 12, 0.55], [128, 5, 0.3]]) {
    const t = new Mask(W, H); t.rect(cx - w / 2, 0, w, 96);
    paintLit(L, t, (x, y) => mulc(barkAlb(x, y, cx), sh + 0.3), lights, { amb: [0.04, 0.05, 0.05] });
  }
  // 地面 (苔と根)
  L.shade(0, 88, W - 1, H - 1, (x, y) => lit(mix(ALB_MOSS, [44, 60, 44], vnoise(x * 0.3, y * 0.5, 2)), lightAt(x, y, lights, 0, -0.9), [0.05, 0.06, 0.05]));
  // 光る木 (左右の灯の木: 枝先に魂の灯が実る)
  const R = rng(66);
  for (const [tx, ty] of [[30, 30], [170, 24]]) {
    for (let i = 0; i < 26; i++) { const a = R() * Math.PI * 2, r = 4 + R() * 18; glow(L, tx + Math.cos(a) * r, ty + Math.sin(a) * r * 0.6, 1.6 + R() * 1.6, C_SOUL, 0.7, 1.5); }
  }
  // 小屋: 石積みの壁、苔の屋根、窓と扉
  const hut = new Mask(W, H); hut.rect(66, 56, 66, 36);
  const roof = new Mask(W, H); roof.poly([58, 58, 99, 34, 140, 58, 136, 62, 99, 40, 62, 62]); roof.poly([62, 58, 99, 38, 136, 58]);
  paintLit(L, hut, (x, y) => { const a = ashlar(x, y, 10, 5, 77); return a.joint ? [30, 30, 34] : mix([110, 106, 100], [84, 80, 78], a.id); }, lights, { amb: [0.06, 0.06, 0.07] });
  paintLit(L, roof, (x, y) => mix(ALB_MOSS, [40, 64, 44], vnoise(x * 0.5, y * 0.5, 7)), lights, { ny: (x, y) => -0.6, amb: [0.06, 0.07, 0.06] });
  const win = new Mask(W, H); win.rect(92, 64, 14, 10);
  L.paint(win, (x, y) => mix([255, 210, 130], [180, 110, 50], (y - 64) / 10));
  // 窓の内: 机に突っ伏す骸の影と手記
  const sil = new Mask(W, H); sil.ellipse(97, 70, 3.2, 3); sil.rect(94, 72, 8, 2);
  L.paint(sil, () => [40, 24, 16]);
  const bars = new Mask(W, H); bars.rect(98, 64, 1, 10); bars.rect(92, 68, 14, 1);
  L.paint(bars, () => [50, 40, 32]);
  const door = new Mask(W, H); door.rect(112, 70, 12, 22);
  paintLit(L, door, (x, y) => (x === 115 || x === 120 ? ALB_WOOD_D : ALB_WOOD), lights, { amb: [0.05, 0.05, 0.06] });
  glow(L, 99, 69, 24, C_CANDLE, 0.25, 2.2);
  // 小屋に絡みつく根
  const vine = new Mask(W, H); rootBand(vine, [[60, 92], [70, 76], [64, 60], [74, 46]], 3, 1.5); rootBand(vine, [[140, 92], [132, 74], [138, 58]], 3, 1.5);
  paintLit(L, vine, (x, y) => barkAlb(x, y, 9), lights, { amb: [0.06, 0.06, 0.06] });
  // 霧の帯
  L.shade(0, 70, W - 1, 100, (x, y) => { const f = clamp(fbm(x * 0.04, y * 0.2, 31) * 1.4 - 0.5); L.add(x, y, [120, 150, 150], f * 0.25); return null; });
  motes(L, lights, 60, 71, C_SOUL);
  vignette(L, 0.85);
  return L.canvas(12);
}

// 14. 根に抱かれた胴 (樹液の苗床。光る根が人業の胴を抱え、胸の扉が開いて紙が覗く)
function sceneTorso() {
  const W = ART_W, H = ART_H, L = new Layer(W, H);
  const TX = 96, TY = 56;
  const lights = [
    { x: TX, y: TY - 30, r: 120, c: [0.75, 0.95, 0.55], k: 0.9, p: 1.4 },  // 樹液の光
    { x: TX, y: 100, r: 90, c: [0.7, 1.0, 0.45], k: 0.8, p: 1.3 },        // 樹液の溜まりの照り返し
    { x: 30, y: 100, r: 80, c: C_CANDLE, k: 0.6, p: 1.4 },               // 手元のランタン
  ];
  // 苗床の洞 (湿った土壁と、垂れる樹液の筋)
  L.shade(0, 0, W - 1, H - 1, (x, y) => {
    const n = fbm(x * 0.08, y * 0.08, 21);
    let alb = mix([60, 52, 40], [96, 84, 60], n);
    if (vnoise(x * 0.9, y * 0.05, 3) > 0.9 && y < 70) alb = mix(alb, [170, 200, 90], 0.35); // 樹液の筋
    return lit(alb, lightAt(x, y, lights), [0.04, 0.05, 0.04]);
  });
  // 樹液の溜まり (下)
  const pool = new Mask(W, H); pool.ellipse(TX, 98, 70, 10);
  L.paint(pool, (x, y) => { const w = Math.sin(x * 0.3 + y) * 0.5 + 0.5; return [120 + w * 60, 170 + w * 60, 50 + w * 30]; });
  // 胴を抱く根 (背後から腕のように回り込む)
  const back = new Mask(W, H);
  rootBand(back, [[20, 0], [40, 30], [70, 44], [TX, 46]], 8, 5);
  rootBand(back, [[180, 4], [160, 34], [130, 44], [TX + 8, 48]], 8, 5);
  rootBand(back, [[TX - 30, 104], [TX - 20, 80], [TX - 6, 70]], 6, 4);
  paintLit(L, back, (x, y) => barkAlb(x, y, 12), lights, { ny: (x, y) => vNormal(back, x, y, 4), amb: [0.05, 0.05, 0.05] });
  // 胴 (木の胸郭。黒鉄の継ぎ目、肩の継ぎ目、胸の小さな扉)
  const torso = new Mask(W, H);
  torso.poly([TX - 15, TY - 18, TX + 15, TY - 18, TX + 13, TY + 6, TX + 9, TY + 20, TX - 9, TY + 20, TX - 13, TY + 6]);
  torso.ellipse(TX - 16, TY - 16, 5, 4); torso.ellipse(TX + 16, TY - 16, 5, 4);
  paintLit(L, torso, (x, y) => {
    if (Math.abs(y - (TY + 2)) < 1 || Math.abs(y - (TY - 16)) < 0.8) return [56, 58, 66];                 // 継ぎ目
    if (x >= TX - 5 && x <= TX + 5 && y >= TY - 12 && y <= TY - 2) return x === TX - 5 || y === TY - 12 ? [60, 40, 28] : [30, 20, 16]; // 開いた扉の内
    return mix([226, 192, 148], [180, 140, 100], vnoise(x * 0.5, y * 0.5, 4) * 0.5);
  }, lights, { ny: (x, y) => vNormal(torso, x, y, 6) * 0.5, nxMax: 5, amb: [0.14, 0.13, 0.12] });
  // 首の継ぎ目 (頭のない首の切り口)
  const neck = new Mask(W, H); neck.rect(TX - 4, TY - 23, 8, 5);
  paintLit(L, neck, (x, y) => (y === TY - 23 ? [190, 150, 104] : [60, 62, 70]), lights, { amb: [0.2, 0.2, 0.2] });
  // 扉から覗く畳んだ紙と、扉の蓋 (横に開いている)
  const paper = new Mask(W, H); paper.rect(TX - 3, TY - 9, 6, 4);
  paintLit(L, paper, () => ALB_PAPER, lights, { amb: [0.4, 0.4, 0.35] });
  const lid = new Mask(W, H); lid.poly([TX + 6, TY - 12, TX + 11, TY - 13, TX + 11, TY - 3, TX + 6, TY - 2]);
  paintLit(L, lid, () => [200, 160, 116], lights, { amb: [0.12, 0.12, 0.1] });
  // 前から巻きつく細い根
  const front = new Mask(W, H);
  rootBand(front, [[TX - 22, TY + 4], [TX - 8, TY + 10], [TX + 10, TY + 8], [TX + 24, TY - 2]], 2.6, 1.6);
  rootBand(front, [[TX + 18, TY + 26], [TX + 6, TY + 16], [TX - 4, TY + 22]], 2.2, 1.4);
  paintLit(L, front, (x, y) => barkAlb(x, y, 14), lights, { amb: [0.06, 0.06, 0.05] });
  // 樹液の雫
  const R = rng(93);
  for (let i = 0; i < 18; i++) { const x = 20 + R() * 150, y = R() * 60; L.px(x, y, [200, 230, 120]); L.px(x, y + 1, [140, 170, 80]); }
  glow(L, TX, TY - 30, 40, [0.75, 0.95, 0.55], 0.14, 2);
  motes(L, lights, 50, 97, [0.8, 1.0, 0.6]);
  vignette(L, 0.86);
  return L.canvas(12);
}

// 15. 魂喰らいの大樹 (巨大な幹の根元。断たれた根と、虚ろな幹の内を上へ昇る魂の光)
function sceneTree() {
  const W = ART_W, H = ART_H, L = new Layer(W, H);
  const CX = 96;
  const lights = [
    { x: CX, y: 40, r: 110, c: C_SOUL, k: 1.0, p: 1.5 },     // 幹の虚の光
    { x: CX, y: 14, r: 50, c: C_SOUL, k: 0.9, p: 1.2 },
    { x: CX, y: 74, r: 60, c: C_SOUL, k: 0.9, p: 1.2 },
    { x: 150, y: -10, r: 160, c: C_MOON, k: 0.5, p: 1.2 },
    { x: 30, y: 100, r: 60, c: C_EMBER, k: 0.3, p: 1.5 },
  ];
  // 背景の闇と霧
  L.shade(0, 0, W - 1, H - 1, (x, y) => {
    const f = fbm(x * 0.04, y * 0.07, 3);
    const l = lightAt(x, y, lights);
    return [8 + f * 14 + l[0] * 30, 12 + f * 18 + l[1] * 40, 14 + f * 18 + l[2] * 40];
  });
  // 幹: 下ほど広がり、根に分かれる。中央に縦に裂けた虚
  const trunk = new Mask(W, H);
  for (let y = 0; y < 92; y++) { const t = y / 92; const hw = 22 + Math.pow(t, 3) * 50; trunk.rect(CX - hw, y, hw * 2, 1); }
  for (const [ex, ey, w] of [[-4, 104, 10], [30, 108, 9], [162, 108, 9], [196, 102, 10]]) rootBand(trunk, [[CX + (ex < CX ? -30 : 30), 84], [ex, ey]], 14, w);
  const hollow = new Mask(W, H);
  for (let y = 0; y < 84; y++) { const t = y / 84; const hw = 5 + Math.sin(t * Math.PI) * 6 + vnoise(1, y * 0.2, 5) * 2; hollow.rect(CX - hw + Math.sin(y * 0.08) * 2, y, hw * 2, 1); }
  paintLit(L, trunk, (x, y) => {
    if (hollow.at(x, y)) return null;
    return mulc(barkAlb(x, y * 0.6, 21), 1.25);
  }, lights, { ny: (x, y) => vNormal(trunk, x, y, 4) * 0.3, nxMax: 10, amb: [0.1, 0.1, 0.11] });
  // 虚の内: 下から上へ昇る魂の光の流れ
  L.paint(hollow, (x, y) => {
    const t = 1 - y / 84;
    const s = fbm(x * 0.3, y * 0.12 + t * 3, 8);
    return rc(R_SOUL, clamp(0.42 + s * 0.3 + t * 0.2));
  });
  const R = rng(15);
  for (let i = 0; i < 40; i++) { const y = R() * 84, x = CX + (R() - 0.5) * 10; glow(L, x, y, 1.5 + R() * 1.5, C_SOUL, 0.8, 1.4); }
  // 断ち切られた太い根 (右下。切り口が白く、樹液が滴る)
  const cut = new Mask(W, H); rootBand(cut, [[150, 96], [176, 88], [186, 84]], 12, 10);
  paintLit(L, cut, (x, y) => barkAlb(x, y, 31), lights, { amb: [0.06, 0.06, 0.06] });
  const face = new Mask(W, H); face.ellipse(188, 84, 4, 6);
  paintLit(L, face, (x, y) => (Math.hypot(x - 188, (y - 84) * 0.7) % 2 < 1 ? [220, 200, 150] : [190, 168, 120]), lights, { amb: [0.35, 0.35, 0.3] });
  for (let i = 0; i < 6; i++) L.px(186 + (i % 3), 91 + i, [170, 210, 110]);
  // 根元に落ちたランタンの鉤 (小さく) と、地面の苔
  L.shade(0, 98, W - 1, H - 1, (x, y) => { if (trunk.at(x, y)) return null; return lit(mix(ALB_MOSS, [40, 56, 40], vnoise(x * 0.4, y, 6)), lightAt(x, y, lights, 0, -0.9), [0.05, 0.06, 0.05]); });
  glow(L, CX, 50, 46, C_SOUL, 0.2, 2.2);
  motes(L, lights, 80, 19, C_SOUL);
  vignette(L, 0.88);
  return L.canvas(12);
}

// ======================= 第四章「王都の地下」 =======================
// 沈んだ旧都と大神殿。水の青白い光 (C_PALE) と、隊のランタンの温かい光
const C_PALE = [0.62, 0.9, 1.0];
const ALB_DOLL = [212, 170, 120], ALB_DOLL_D = [150, 108, 70], ALB_JOINT = [62, 64, 76];
// 光源に向いた縁を明るくする (人物・器を闇から浮かせる)
function rimLight(L, m, lights, col, k = 1) {
  for (let y = m.y0; y <= m.y1; y++) for (let x = m.x0; x <= m.x1; x++) {
    if (!m.at(x, y) || !m.edge(x, y)) continue;
    const l = lightAt(x, y, lights);
    const f = Math.min(1, (l[0] + l[1] + l[2]) / 2.2) * k;
    L.add(x, y, [col[0] * f, col[1] * f, col[2] * f]);
  }
}
// 記憶の色 (修道院長の記憶と同じ仕上げ): 彩度を落として灰青緑に寄せ、端を霞ませ、ところどころ細い横筋
function memoryTint(L, edge = [48, 56, 64], lines = [23, 71]) {
  const W = L.w, H = L.h;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; if (L.a[i] <= 0) continue;
    const j = i * 3, r = L.c[j], g = L.c[j + 1], b = L.c[j + 2];
    const lum = r * 0.3 + g * 0.55 + b * 0.15;
    let c = mix([lum * 0.95 + 6, lum + 10, lum * 1.02 + 14], [r, g, b], 0.5);
    const u = (x + 0.5) / W * 2 - 1, v = (y + 0.5) / H * 2 - 1;
    c = mix(c, edge, smooth(0.62, 1.2, Math.hypot(u * 0.9, v)) * 0.9);
    if (lines.includes(y) && vnoise(x * 0.04, y, 3) > 0.5) c = mix(c, [90, 104, 108], 0.25);
    L.c[j] = c[0]; L.c[j + 1] = c[1]; L.c[j + 2] = c[2];
  }
}
// 水面の映り込み: マスク m の形を、水際 by を軸に上下を返して暗く写す (行ごとに横へ揺らし、ところどころ途切れさせる)
function reflect(L, m, by, { k = 0.5, tint = [10, 26, 34], wob = 1.4, y1 = ART_H - 1 } = {}) {
  for (let y = Math.ceil(by); y <= y1; y++) {
    const d = y - by;
    if (Math.sin(y * 1.9 + d * 0.3) > 0.82) continue;                // 波の筋で途切れる
    const sh = Math.round(Math.sin(y * 0.9) * wob * Math.min(1, d / 6));
    for (let x = m.x0 - 3; x <= m.x1 + 3; x++) {
      const sx = x - sh, sy = Math.round(by - d);
      if (!m.at(sx, sy)) continue;
      const c = L.get(sx, sy); if (!c) continue;
      const f = k * (1 - Math.min(0.7, d / 60));
      L.px(x, y, [tint[0] + c[0] * f, tint[1] + c[1] * f, tint[2] + c[2] * f]);
    }
  }
}

// 石灯籠の形 (基礎・竿・中台・火袋・笠・宝珠)。(bx,by) = 基礎の下端の中央、s = 大きさ。win = 火袋の窓
function lanternShape(m, bx, by, s, win = null) {
  const P = (pts) => pts.map((v, i) => (i % 2 ? by - v * s : bx + v * s));
  m.poly(P([-7, 0, 7, 0, 6, 4, -6, 4]));
  m.poly(P([-2.6, 4, 2.6, 4, 2.2, 18, -2.2, 18]));
  m.poly(P([-6, 18, 6, 18, 7.5, 21, -7.5, 21]));
  m.poly(P([-4.5, 21, 4.5, 21, 4.5, 29, -4.5, 29]));
  m.poly(P([-13, 30.8, -11, 29, 11, 29, 13, 30.8, 9, 31.8, 3, 34.6, -3, 34.6, -9, 31.8]));
  m.poly(P([-1.6, 34.6, 1.6, 34.6, 1.9, 36.6, 0, 39, -1.9, 36.6]));
  if (win) win.poly(P([-2.6, 22.4, 2.6, 22.4, 2.6, 27.6, -2.6, 27.6]));
}

// 16. 奉納の灯籠 (水に沈んだ参道。灯籠の列のひとつにだけ青白い灯がともり、笠に師の印)
function sceneVotive() {
  const W = ART_W, H = ART_H, L = new Layer(W, H);
  const VX = 96, HZ = 44;                                     // 消失点・水平線
  const at = (side, z) => ({ s: 1.55 / z, x: VX + side * 58 / z, y: HZ + 48 / z });
  const lit0 = at(1, 1.05);                                    // 灯る灯籠
  const FX = lit0.x, FY = lit0.y - 25 * lit0.s;
  const lights = [
    { x: FX, y: FY, r: 130, c: C_PALE, k: 1.25, p: 1.55 },
    { x: 70, y: -70, r: 270, c: C_MOON, k: 0.75, p: 1.1 },
  ];
  // 奥: 沈んだ旧都の闇 (天井の闇から水平線の霞へ)
  L.shade(0, 0, W - 1, HZ, (x, y) => {
    const t = y / HZ, f = fbm(x * 0.04, y * 0.08, 5);
    const l = lightAt(x, y, lights);
    return [6 + t * 14 + f * 8 + l[0] * 16, 9 + t * 22 + f * 10 + l[1] * 24, 14 + t * 26 + f * 12 + l[2] * 28];
  });
  // 遠い旧都の影: 屋根と塔、正面に大神殿の門
  const city = new Mask(W, H);
  const R0 = rng(101);
  for (let x = 0; x < W; x += 6 + (R0() * 8 | 0)) { const h = 3 + R0() * 9; city.rect(x, HZ - h, 5 + (R0() * 6 | 0), h + 1); if (R0() < 0.3) city.poly([x, HZ - h, x + 3, HZ - h - 5, x + 6, HZ - h]); }
  city.rect(VX - 12, HZ - 20, 24, 21); city.poly([VX - 15, HZ - 20, VX, HZ - 28, VX + 15, HZ - 20]);
  L.paint(city, (x, y) => [12 + (HZ - y) * 0.2, 20 + (HZ - y) * 0.3, 26 + (HZ - y) * 0.3]);
  const gate = new Mask(W, H); gate.rect(VX - 4, HZ - 11, 8, 12); gate.ellipse(VX, HZ - 11, 4, 3);
  L.paint(gate, () => [4, 8, 12]);
  // 水: 奥ほど霞み、灯の照り返しが揺れる。水の下に参道の敷石が透ける
  L.shade(0, HZ + 1, W - 1, H - 1, (x, y) => {
    const t = (y - HZ) / (H - HZ), z = 48 / Math.max(1, y - HZ);
    const road = Math.abs(x - VX) < 50 / z + 4;
    let base = mix([16, 30, 36], [5, 12, 18], Math.min(1, t * 1.6));
    if (road) { const w = worley((x - VX) * z * 0.11, z * 1.2, 7); base = mix(base, w[1] - w[0] < 0.07 ? [4, 10, 14] : [24, 40, 42], 0.55 * (1 - t * 0.4)); }
    const l = lightAt(x, y, lights);
    const wv = Math.sin(x * 0.17 * (1 + t) + y * 1.25) * 0.5 + Math.sin(x * 0.05 - y * 0.7) * 0.5;
    const sheen = clamp(wv * 0.6 + 0.2) * (l[0] + l[1] + l[2]) / 3;
    return [base[0] + sheen * 60, base[1] + sheen * 96, base[2] + sheen * 112];
  });
  // 灯籠の列 (奥から手前へ塗る。手前ほど大きい)
  const list = [];
  for (const z of [8, 5.6, 4, 2.8, 2, 1.4, 1]) list.push({ side: -1, z });
  for (const z of [6.8, 4.8, 3.4, 2.4, 1.6, 1.05]) list.push({ side: 1, z });
  list.sort((a, b) => b.z - a.z);
  for (const { side, z } of list) {
    const p = at(side, z), m = new Mask(W, H), win = new Mask(W, H);
    lanternShape(m, p.x, p.y, p.s, win);
    const isLit = side === 1 && z === 1.05;
    paintLit(L, m, (x, y) => {
      const d = (p.y - y) / p.s;
      if (win.at(x, y)) return null;
      const moss = fbm(x * 0.3, y * 0.3, 9 + z);
      let a = mix([108, 112, 112], [70, 84, 80], moss * 0.8);
      if (d < 7) a = mix(a, [40, 60, 58], 0.6);                     // 水際のぬめり
      if (d > 29 && d < 31.2) a = mulc(a, 0.62);                    // 笠の裏の影
      return mulc(a, 0.8 + 0.3 / Math.sqrt(z));
    }, lights, { ny: (x, y) => { const d = (p.y - y) / p.s; return d > 31 ? -0.9 : d > 18 && d < 21 ? -0.7 : -0.15; }, nxMax: Math.max(2, 6 * p.s), amb: [0.16, 0.2, 0.24] });
    rimLight(L, m, [{ x: FX, y: FY, r: 90, c: C_PALE, k: 1, p: 1.3 }], [90, 150, 160], 0.45);
    if (isLit) {
      L.paint(win, (x, y) => rc(R_SOUL, clamp(0.97 - Math.abs(x + 0.5 - p.x) * 0.06)));
      const fl = new Mask(W, H); fl.poly([p.x, FY - 4, p.x + 2, FY + 1, p.x, FY + 3, p.x - 2, FY + 1]);
      L.paint(fl, () => [236, 255, 250]);
      // 笠の正面に刻まれた師の印 (灯を受けて淡く光る)
      const sg = new Mask(W, H); sigilMask(sg, p.x, p.y - 32.4 * p.s + 0.5, 0.27);
      L.paint(sg, () => rc(R_SOUL, 0.86));
    } else L.paint(win, () => [6, 10, 12]);
    reflect(L, m, p.y, { k: isLit ? 0.65 : 0.45, wob: 1 + 1 / z });
  }
  // 灯の照り返しの縦の筋 (水面)
  for (let y = Math.round(lit0.y) + 2; y < H; y++) {
    if (Math.sin(y * 2.3) < 0.1) continue;
    const hw = 1 + (y - lit0.y) * 0.08, sh = Math.sin(y * 0.8) * 1.5;
    for (let x = Math.round(FX - hw + sh); x <= FX + hw + sh; x++) L.add(x, y, [70, 150, 150], 0.5 * (1 - (y - lit0.y) / 40));
  }
  glow(L, FX, FY, 34, C_PALE, 0.3, 2.2);
  // 水面に浮かぶ供物の花びら (灯の近く)
  const R1 = rng(103);
  for (let i = 0; i < 24; i++) { const x = FX - 40 + R1() * 70, y = HZ + 20 + R1() * 40; if (lightAt(x, y, lights)[1] > 0.2) { L.px(x, y, [200, 220, 214]); L.px(x + 1, y, [140, 170, 170]); } }
  motes(L, lights, 50, 107, C_PALE);
  vignette(L, 0.86);
  return L.canvas(12);
}

// 17. 神殿の壁画 (水に沈んだ壁の戴冠の図。冠を受ける神官王と、脇に立つ若い神官 = モルデンと同じ顔)
function sceneMural() {
  const W = ART_W, H = ART_H, L = new Layer(W, H);
  const WL = 92;                                              // 水面
  const lights = [
    { x: 6, y: 100, r: 200, c: C_CANDLE, k: 1.2, p: 1.3 },    // 手元のランタン (左下から)
    { x: 150, y: 116, r: 130, c: C_PALE, k: 0.8, p: 1.3 },    // 水の照り返し
    { x: 132, y: 20, r: 40, c: C_CANDLE, k: 0.35, p: 1.4 },   // 若い神官の顔に当たる灯
  ];
  // 壁画の絵の具 (平らな色の面)。alb[i] に色を置き、最後に漆喰ごと照らす
  const alb = new Array(W * H).fill(null);
  const put = (m, fn) => { for (let y = m.y0; y <= m.y1; y++) for (let x = m.x0; x <= m.x1; x++) if (m.at(x, y)) { const c = fn(x, y); if (c) alb[y * W + x] = c; } };
  const M = () => new Mask(W, H);
  const FX0 = 20, FX1 = 172, FY0 = 8, FY1 = 82;
  // 地: 上は天の青緑、下は黄土の床。枠は赤茶の帯と金の細線
  put(M().rect(FX0, FY0, FX1 - FX0, FY1 - FY0), (x, y) => (y < 58 ? mix([58, 92, 96], [44, 72, 80], (y - FY0) / 50) : [168, 132, 86]));
  put(M().rect(FX0, 57, FX1 - FX0, 2), () => [120, 84, 56]);
  const R = rng(111);
  for (let i = 0; i < 26; i++) { const x = FX0 + 4 + R() * (FX1 - FX0 - 8), y = FY0 + 4 + R() * 40; put(M().rect(x, y, 1, 1), () => [214, 180, 96]); }
  // 光背のアーチと、天から降りる冠
  put(M().ellipse(92, 42, 26, 30), (x, y) => (Math.hypot(x - 92, (y - 42) * 0.86) > 23 ? [200, 160, 90] : [88, 118, 112]));
  for (let a = -2.4; a <= -0.7; a += 0.28) put(M().line(92, 14, 92 + Math.cos(a) * 18, 14 + Math.sin(a) * -1 + 0, 1), () => null);
  for (let k = -3; k <= 3; k++) put(M().line(92 + k * 2, 8, 92 + k * 5, 18, 1), () => [222, 196, 120]);
  const crown = M(); crown.rect(85, 19, 15, 4); for (let k = 0; k < 4; k++) crown.poly([85 + k * 4.6, 19, 87 + k * 4.6, 14, 89 + k * 4.6, 19]);
  put(crown, (x, y) => (y === 21 && x % 3 === 0 ? [150, 40, 40] : [226, 188, 84]));
  // 玉座と、坐す神官王 (白と金の法衣・光輪・白いひげ)
  put(M().rect(78, 30, 28, 34), () => [118, 70, 48]);
  put(M().rect(80, 32, 24, 30), () => [150, 92, 60]);
  const kb = M(); kb.poly([82, 70, 84, 40, 100, 40, 102, 70]); kb.rect(78, 62, 28, 8);
  put(kb, (x, y) => (Math.abs(x - 92) < 2 && y > 40 ? [196, 160, 76] : y > 62 && y < 64 ? [196, 160, 76] : [218, 206, 178]));
  put(M().ellipse(92, 32, 8, 8), (x, y) => (Math.hypot(x - 92, y - 32) > 6.5 ? [226, 190, 96] : null));
  put(M().ellipse(92, 32, 5, 6), (x, y) => (y > 34 ? [226, 222, 210] : [214, 176, 140]));
  put(M().rect(89, 31, 2, 1).rect(94, 31, 2, 1), () => [60, 40, 36]);
  for (const sx of [-1, 1]) put(M().line(92 + sx * 7, 44, 92 + sx * 9, 58, 3), () => [218, 206, 178]);
  // 左: ひざまずく信徒たち (小さく)
  for (const [x, y] of [[36, 70], [52, 72], [64, 68]]) {
    const f = M(); f.poly([x - 5, y, x - 4, y - 8, x + 3, y - 11, x + 6, y - 6, x + 5, y]); f.ellipse(x + 4, y - 13, 3, 3);
    put(f, (xx, yy) => (yy < y - 10 ? [196, 150, 112] : [108, 96, 140]));
  }
  // 右: 若い神官 (痩せた長身・白い顔・薄い笑み)。手に小さな苗木を抱く
  const MX = 132;
  const robe = M(); robe.poly([MX - 6, 80, MX - 5, 44, MX - 3, 30, MX + 3, 30, MX + 5, 44, MX + 7, 80]);
  put(robe, (x, y) => (Math.abs(x - MX) < 1.2 && y > 34 ? [40, 34, 60] : mix([92, 84, 128], [70, 62, 100], (y - 30) / 50)));
  put(M().rect(MX - 4, 30, 9, 3), () => [200, 190, 160]);                 // 白い襟
  const head = M(); head.ellipse(MX, 23, 4.2, 6);
  put(head, (x, y) => {
    if (y <= 18) return [36, 30, 30];                                       // 撫でつけた黒い髪
    if (y === 22 && (x === MX - 2 || x === MX + 2 || x === MX - 1 || x === MX + 1)) return x === MX - 2 || x === MX + 2 ? [40, 34, 34] : [120, 110, 110]; // 細めた目
    if (y === 26 && x >= MX - 2 && x <= MX + 2) return x === MX - 2 || x === MX + 2 ? [150, 70, 70] : [120, 50, 52]; // 薄い笑み (口角が上がる)
    if (y === 27 && x >= MX - 1 && x <= MX + 1) return [236, 232, 226];
    return [238, 234, 226];
  });
  L.px(MX - 2, 25, [150, 70, 70]); L.px(MX + 2, 25, [150, 70, 70]);
  const sap = M(); sap.rect(MX - 1, 38, 2, 8); sap.ellipse(MX - 3, 37, 2.4, 1.4); sap.ellipse(MX + 3, 36, 2.4, 1.4); sap.ellipse(MX, 34, 1.4, 2);
  put(sap, (x, y) => (y > 38 ? [110, 76, 50] : [96, 150, 84]));
  put(M().ellipse(MX - 4, 44, 2.2, 1.6).ellipse(MX + 4, 44, 2.2, 1.6), () => [236, 230, 220]); // 苗を抱える手
  // 右端: 柱の装飾帯
  put(M().rect(156, FY0, 12, FY1 - FY0), (x, y) => ((y + (x > 161 ? 4 : 0)) % 8 < 4 ? [160, 128, 80] : [70, 92, 96]));
  // 枠
  put(M().rect(FX0 - 3, FY0 - 3, FX1 - FX0 + 6, 3).rect(FX0 - 3, FY1, FX1 - FX0 + 6, 3).rect(FX0 - 3, FY0, 3, FY1 - FY0).rect(FX1, FY0, 3, FY1 - FY0), (x, y) => ((x + y) % 6 === 0 ? [214, 176, 96] : [130, 60, 44]));
  // 壁を照らして塗る: 漆喰の剥がれ・ひび・水の染み
  const crackM = M();
  const crack = (pts) => { for (let i = 0; i < pts.length - 1; i++) crackM.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 1); };
  crack([[60, 0], [64, 14], [58, 30], [66, 52], [62, 70]]); crack([[64, 14], [76, 20]]); crack([[110, 92], [114, 76], [106, 60], [112, 46]]);
  crack([[180, 10], [170, 30], [176, 50]]); crack([[20, 40], [32, 46], [30, 60]]);
  L.shade(0, 0, W - 1, WL - 1, (x, y) => {
    const peel = fbm(x * 0.05, y * 0.07, 17) + (y > 74 ? (y - 74) * 0.02 : 0) + (x < 18 || x > 174 ? 0.14 : 0) - 0.06;
    let a, ny = 0, nx = 0;
    if (peel > 0.66) {                                                       // 剥がれて覗く石積み
      const s = ashlar(x, y, 20, 10, 19);
      a = s.joint ? [20, 22, 26] : mix([84, 86, 92], [60, 64, 70], s.id);
      ny = s.top ? -0.5 : 0; nx = s.left ? -0.5 : 0;
    } else {
      const edge = peel > 0.62;                                              // 剥がれの縁 (欠けた漆喰の厚み)
      a = alb[y * W + x] || mix([176, 166, 144], [150, 140, 120], vnoise(x * 0.2, y * 0.2, 3));
      a = mulc(a, 0.82 + 0.18 * vnoise(x * 0.5, y * 0.5, 8));               // 退色のむら
      if (edge) { a = [214, 206, 186]; ny = -0.5; }
      if (crackM.at(x, y)) a = [34, 30, 30];
    }
    if (y > 70) a = mix(a, [60, 84, 70], clamp((y - 70) / 22) * 0.55);       // 水の染み (潮の跡)
    return lit(a, lightAt(x, y, lights, nx, ny), [0.06, 0.07, 0.09]);
  });
  // 水面と映り込み
  const all = new Mask(W, H); all.rect(0, 0, W, WL);
  L.shade(0, WL, W - 1, H - 1, (x, y) => { const l = lightAt(x, y, lights); const wv = clamp(Math.sin(x * 0.2 + y * 1.4) * 0.5 + 0.3); return [6 + wv * l[0] * 40, 12 + wv * l[1] * 60, 18 + wv * l[2] * 70]; });
  reflect(L, all, WL, { k: 0.35, tint: [6, 14, 20], wob: 2 });
  for (let x = 0; x < W; x++) if (Math.sin(x * 0.4) > 0.2) L.add(x, WL, [60, 90, 90], 0.6);
  glow(L, MX, 26, 14, C_CANDLE, 0.12, 2);
  motes(L, lights, 50, 113, C_CANDLE);
  vignette(L, 0.82);
  return L.canvas(12);
}

// 人業の木の脚 (付け根の球関節 → 腿 → 膝の球関節 → 脛 → 足首 → 足)。pts = [付け根, 膝, 足首, 爪先]
function dollLeg(m, joints, pts, w = 1) {
  const [h, k, a, t] = pts;
  m.line(h[0], h[1], k[0], k[1], 9 * w, 1, 7.4 * w);
  m.line(k[0], k[1], a[0], a[1], 7 * w, 1, 4.8 * w);
  m.line(a[0], a[1], t[0], t[1], 4.6 * w, 1, 3.4 * w);
  m.ellipse(t[0], t[1], 2.4 * w, 2.2 * w);
  joints.ellipse(h[0], h[1], 5.4 * w, 5.4 * w); joints.ellipse(k[0], k[1], 4.4 * w, 4.4 * w); joints.ellipse(a[0], a[1], 2.9 * w, 2.9 * w);
}

// 18. 水槽の底の脚 (水の引いた洗礼の大水槽の底。大樹の根の筋に絡まった人業の脚一対)
function sceneLegs() {
  const W = ART_W, H = ART_H, L = new Layer(W, H);
  const lights = [
    { x: 40, y: -40, r: 190, c: C_PALE, k: 0.8, p: 1.2 },      // 水槽の口から射す水明かり
    { x: 104, y: 20, r: 110, c: C_PALE, k: 1.0, p: 1.2 },      // 真上の割れ目からの光
    { x: 180, y: 112, r: 130, c: C_CANDLE, k: 1.1, p: 1.3 },   // 手元のランタン
    { x: 84, y: 56, r: 30, c: C_SOUL, k: 0.5, p: 1.6 },         // 腿の印
  ];
  const FY = 36;
  // 奥の壁: 洗礼の水槽のモザイク (青緑と白の小さな四角)。水の跡で上ほど色が残る
  L.shade(0, 0, W - 1, FY - 1, (x, y) => {
    const tx = Math.floor(x / 4), ty = Math.floor(y / 4), gap = x % 4 === 0 || y % 4 === 0;
    const id = h2(tx, ty, 5), band = (ty % 6 === 2) ? 1 : 0;
    let a = gap ? [30, 34, 36] : band ? mix([190, 170, 110], [150, 130, 80], id) : mix([70, 120, 120], [180, 190, 180], id > 0.75 ? 1 : id * 0.4);
    a = mix(a, [50, 56, 46], clamp((y - 12) / 24) * 0.6 + (fbm(x * 0.1, y * 0.2, 4) > 0.6 ? 0.3 : 0)); // 水の跡・ぬめり
    return lit(a, lightAt(x, y, lights, 0, 0.2), [0.1, 0.12, 0.14]);
  });
  // 壁の下の段 (縁石)
  L.shade(0, FY - 3, W - 1, FY, (x, y) => lit(y === FY - 3 ? [160, 156, 140] : [70, 72, 70], lightAt(x, y, lights, 0, y === FY - 3 ? -1 : 0.4), [0.06, 0.06, 0.08]));
  // 底: 濡れた敷石と水たまり
  L.shade(0, FY + 1, W - 1, H - 1, (x, y) => {
    const t = (y - FY) / (H - FY), w = worley(x * 0.06 / (0.5 + t), y * 0.12 / (0.5 + t * 0.6), 23);
    const pud = fbm(x * 0.03, y * 0.08, 29) > 0.56;
    const l = lightAt(x, y, lights, 0, -0.9);
    if (pud) { const s = clamp(0.35 + Math.sin(x * 0.4 + y * 1.6) * 0.2); return [8 + s * l[0] * 60, 14 + s * l[1] * 80, 18 + s * l[2] * 90]; }
    let a = mix([96, 98, 92], [130, 128, 116], w[2] * 0.6);
    if (w[1] - w[0] < 0.07) a = [26, 28, 28];
    return lit(a, l, [0.05, 0.06, 0.07]);
  });
  // 大樹の根の筋 (壁の継ぎ目から底を這う。細い根が枝分かれし、ところどころ魂の光が脈打つ)
  const roots = new Mask(W, H);
  rootBand(roots, [[-4, 30], [30, 44], [70, 58], [110, 66], [150, 78], [196, 84]], 6, 3);
  rootBand(roots, [[40, -2], [46, 26], [60, 50], [92, 76], [104, 108]], 5, 2.5);
  rootBand(roots, [[150, 20], [140, 40], [120, 54], [96, 58]], 3.5, 2);
  rootBand(roots, [[70, 58], [60, 80], [40, 100]], 3, 1.6);
  rootBand(roots, [[110, 66], [124, 90], [118, 108]], 2.6, 1.4);
  paintLit(L, roots, (x, y) => mulc(barkAlb(x, y, 41), 1.1), lights, { ny: (x, y) => vNormal(roots, x, y, 3), amb: [0.06, 0.06, 0.06] });
  // 脚 (腿に師の印)。根の上に横たわる
  const leg = new Mask(W, H), joints = new Mask(W, H);
  const LA = [[62, 50], [100, 58], [134, 50], [150, 54]], LB = [[66, 60], [100, 78], [136, 84], [154, 90]];
  dollLeg(leg, joints, LB, 1.4); dollLeg(leg, joints, LA, 1.3);
  paintLit(L, leg, (x, y) => {
    const g = Math.sin((x + y * 0.4) * 0.9 + vnoise(x * 0.3, y * 0.3, 2) * 5) * 0.5 + 0.5;
    return mix(ALB_DOLL, ALB_DOLL_D, g * 0.4 + (vnoise(x * 0.5, y * 0.5, 9) > 0.7 ? 0.3 : 0)); // 木目と水の染み
  }, lights, { ny: (x, y) => vNormal(leg, x, y, 5) * 0.6, nxMax: 4, amb: [0.2, 0.18, 0.18] });
  rimLight(L, leg, lights, [120, 110, 90], 0.5);
  paintLit(L, joints, (x, y) => (joints.at(x, y - 1) && joints.at(x - 1, y) ? mix([80, 84, 96], [44, 46, 56], vnoise(x, y, 4) * 0.6) : [176, 182, 196]), lights, { ny: (x, y) => vNormal(joints, x, y, 3), amb: [0.12, 0.12, 0.15] });
  const sg = new Mask(W, H); sigilMask(sg, 82, 55, 0.36);
  L.paint(sg, () => rc(R_SOUL, 0.9));
  glow(L, 82, 54, 14, C_SOUL, 0.3, 2);
  // 脚に絡みつく細い根 (手前を横切る)
  const vine = new Mask(W, H);
  rootBand(vine, [[56, 62], [76, 52], [90, 66], [112, 54], [120, 68]], 1.6, 1.1);
  rootBand(vine, [[96, 96], [106, 74], [118, 84], [128, 94], [142, 82], [160, 96]], 1.6, 1.1);
  rootBand(vine, [[132, 42], [136, 56], [142, 64], [140, 80]], 1.3, 1);
  paintLit(L, vine, (x, y) => barkAlb(x, y, 43), lights, { amb: [0.06, 0.06, 0.06] });
  for (let i = 0; i < 40; i++) { const R = rng(117 + i); const x = R() * W, y = R() * H; if (vine.at(x | 0, y | 0) || roots.at(x | 0, y | 0)) L.add(x, y, [40, 140, 110], 0.6); }
  motes(L, lights, 50, 119, C_PALE);
  vignette(L, 0.86);
  return L.canvas(12);
}

// 19. 神官王の記憶 (祭壇を突き破って昇る大樹の幹。その前の玉座に、半ば透けた神官王の亡霊)
function scenePriestKing() {
  const W = ART_W, H = ART_H, L = new Layer(W, H);
  const CX = 96;
  const lights = [
    { x: CX, y: -10, r: 150, c: C_PALE, k: 1.0, p: 1.2 },     // 水の上から射す光
    { x: CX, y: 64, r: 70, c: C_SOUL, k: 0.7, p: 1.4 },        // 亡霊の淡い光
    { x: CX, y: 22, r: 50, c: C_SOUL, k: 0.25, p: 1.3 },       // 幹の虚の光
    { x: 20, y: 30, r: 120, c: C_PALE, k: 0.5, p: 1.2 },
  ];
  // 大神殿の奥 (列柱と尖頭の窓)
  L.shade(0, 0, W - 1, H - 1, (x, y) => {
    const a = ashlar(x, y, 16, 8, 61);
    let alb = mix([74, 80, 88], [54, 58, 66], fbm(x * 0.1, y * 0.1, 3));
    if (a.joint) alb = [20, 22, 28];
    return lit(alb, lightAt(x, y, lights, 0, 0.3), [0.05, 0.06, 0.08]);
  });
  for (const cx of [14, 44, 148, 178]) {
    const col = new Mask(W, H); col.rect(cx - 6, 0, 12, 92); col.rect(cx - 8, 86, 16, 6); col.rect(cx - 8, 0, 16, 5);
    paintLit(L, col, (x, y) => ((x - cx + 6) % 4 === 0 ? [70, 74, 82] : [118, 120, 126]), lights, { nxMax: 6, amb: [0.06, 0.06, 0.08] });
  }
  // 床と、砕けた祭壇
  L.shade(0, 88, W - 1, H - 1, (x, y) => { const w = worley(x * 0.08, y * 0.2, 63); return lit(w[1] - w[0] < 0.07 ? [20, 22, 26] : mix([86, 90, 94], [116, 118, 120], w[2] * 0.5), lightAt(x, y, lights, 0, -0.9), [0.05, 0.06, 0.08]); });
  // 幹: 祭壇を割って上へ。根元は祭壇の石を押しのけて広がる
  const trunk = new Mask(W, H);
  for (let y = 0; y < 76; y++) { const t = y / 76; const hw = 15 + Math.pow(t, 2.4) * 22 + Math.sin(y * 0.3) * 1.2; trunk.rect(CX - hw, y, hw * 2, 1); }
  rootBand(trunk, [[CX - 30, 70], [CX - 52, 84], [CX - 70, 92]], 10, 4); rootBand(trunk, [[CX + 30, 70], [CX + 54, 82], [CX + 74, 90]], 10, 4);
  const hollow = new Mask(W, H);
  for (let y = 0; y < 44; y++) { const hw = 1.5 + Math.sin(y / 44 * Math.PI) * 2.5; hollow.rect(CX - hw + Math.sin(y * 0.1) * 2, y, hw * 2, 1); }
  paintLit(L, trunk, (x, y) => (hollow.at(x, y) ? null : mulc(barkAlb(x, y * 0.6, 65), 1.6)), lights, { nxMax: 12, amb: [0.16, 0.15, 0.15] });
  L.paint(hollow, (x, y) => rc(R_SOUL, clamp(0.3 + fbm(x * 0.3, y * 0.15, 8) * 0.3 + (1 - y / 60) * 0.12)));
  // 押しのけられ傾いた祭壇の石
  for (const [x, y, w, h, a] of [[CX - 46, 70, 22, 12, -0.25], [CX + 26, 68, 24, 12, 0.3], [CX - 26, 80, 14, 8, 0.15], [CX + 14, 82, 16, 7, -0.2]]) {
    const m = new Mask(W, H), c = Math.cos(a), s = Math.sin(a);
    const P = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].flatMap(([u, v]) => [x + u * c - v * s, y + u * s + v * c]);
    m.poly(P);
    paintLit(L, m, (xx, yy) => (vnoise(xx * 0.6, yy * 0.6, 7) > 0.8 ? [60, 60, 66] : [190, 186, 176]), lights, { ny: (xx, yy) => vNormal(m, xx, yy, 3), amb: [0.08, 0.08, 0.1] });
  }
  // 玉座 (幹の前・石の高い背もたれ)
  const th = new Mask(W, H); th.rect(CX - 16, 54, 32, 46); th.poly([CX - 16, 54, CX, 44, CX + 16, 54]); th.rect(CX - 20, 78, 40, 6); th.rect(CX - 22, 98, 44, 6);
  paintLit(L, th, (x, y) => (y > 77 && y < 79 ? [70, 66, 70] : Math.abs(x - CX) > 13 && y < 78 ? [104, 100, 104] : [140, 134, 132]), lights, { nxMax: 6, ny: (x, y) => vNormal(th, x, y, 3) * 0.6, amb: [0.08, 0.08, 0.1] });
  // 亡霊の神官王 (半ば透けて、玉座が透けて見える。肘掛けに腕を置いて坐る)
  const gh = new Mask(W, H);
  gh.poly([CX - 11, 64, CX + 11, 64, CX + 10, 78, CX + 13, 80, CX + 12, 88, CX + 9, 98, CX - 9, 98, CX - 12, 88, CX - 13, 80, CX - 10, 78]);
  gh.rect(CX - 3, 60, 6, 5);
  gh.ellipse(CX, 55, 5, 6);
  gh.line(CX - 10, 65, CX - 15, 77, 4, 1, 3); gh.line(CX - 15, 77, CX - 21, 79, 3); // 肘掛けに置いた腕
  gh.line(CX + 10, 65, CX + 15, 77, 4, 1, 3); gh.line(CX + 15, 77, CX + 21, 79, 3);
  L.paint(gh, (x, y) => {
    const e = gh.edge(x, y);
    const v = (e ? 0.75 : 0.32 + 0.18 * vnoise(x * 0.4, y * 0.25, 9)) * (y > 90 ? 1 - (y - 90) * 0.06 : 1);
    if (y >= 54 && y <= 56 && (x === CX - 3 || x === CX - 2 || x === CX + 2 || x === CX + 1)) return [6, 14, 16, 0.85]; // 落ちくぼんだ目
    if (Math.abs(x - CX) < 1 && y > 66 && y < 96) return [240, 228, 170, 0.6];                // 法衣の金の縁
    if (y > 58 && y < 66 && Math.abs(x - CX) < 4 - (y - 58) * 0.3) return [214, 240, 230, 0.6];               // 白いひげ
    return [180, 236, 224, v];
  });
  const cr = new Mask(W, H); cr.rect(CX - 5, 48, 10, 2); for (let k = 0; k < 4; k++) cr.poly([CX - 5 + k * 3, 48, CX - 3.5 + k * 3, 44, CX - 2 + k * 3, 48]);
  L.paint(cr, () => [240, 210, 120, 0.85]);
  glow(L, CX, 66, 26, C_SOUL, 0.3, 2);
  // 斜めに射す水の光の帯と、立ちのぼる泡
  L.shade(0, 0, W - 1, H - 1, (x, y) => { for (const [x0, w] of [[40, 8], [120, 12], [160, 6]]) { const cx = x0 + y * 0.3; if (Math.abs(x - cx) < w) L.add(x, y, [40, 70, 76], (1 - Math.abs(x - cx) / w) * (1 - y / H) * 0.6); } return null; });
  const R = rng(127);
  for (let i = 0; i < 26; i++) { const x = R() * W, y = R() * H; L.add(x, y, [120, 200, 200], 0.7); if (R() < 0.4) { L.add(x + 1, y - 1, [80, 140, 140], 0.6); } }
  memoryTint(L, [40, 54, 62], [19, 63]);
  motes(L, lights, 40, 131, C_PALE);
  return L.canvas(10);
}

// 人業の少女セラ (木彫りの長い黒髪・額に師の印・黒鉄の継ぎ目)。床に坐り、目を開けたところ
function drawSera(L, lights, X, Y) {
  // 髪 (頭の後ろから背へ流れる黒い木彫り)
  const hair = new Mask(L.w, L.h);
  hair.ellipse(X, Y - 2, 11, 11.5);
  hair.poly([X - 10, Y, X - 13, Y + 14, X - 12, Y + 30, X - 4, Y + 24, X - 6, Y + 8]);
  hair.poly([X + 10, Y, X + 13, Y + 14, X + 12, Y + 30, X + 4, Y + 24, X + 6, Y + 8]);
  paintLit(L, hair, (x, y) => mix([50, 38, 36], [108, 84, 66], (Math.sin((x - X) * 0.9 + (y - Y) * 0.2) * 0.5 + 0.5) * 0.8), lights, { ny: (x, y) => vNormal(hair, x, y, 4), amb: [0.06, 0.06, 0.07] });
  // 胴・腕・脚 (膝を立てて坐る)
  const body = new Mask(L.w, L.h);
  body.poly([X - 8, Y + 12, X + 8, Y + 12, X + 7, Y + 26, X + 6, Y + 34, X - 6, Y + 34, X - 7, Y + 26]);
  body.line(X - 5, Y + 34, X - 10, Y + 42, 6, 1, 5); body.line(X + 5, Y + 34, X + 10, Y + 42, 6, 1, 5);   // 腿 (手前へ)
  body.line(X - 10, Y + 42, X - 9, Y + 54, 5, 1, 3.6); body.line(X + 10, Y + 42, X + 9, Y + 54, 5, 1, 3.6); // 脛
  body.ellipse(X - 10, Y + 55, 3.4, 1.8); body.ellipse(X + 10, Y + 55, 3.4, 1.8);
  body.line(X - 8, Y + 14, X - 12, Y + 26, 3.4, 1, 3); body.line(X - 12, Y + 26, X - 10, Y + 38, 3, 1, 2.6);   // 腕 (膝に添える)
  body.line(X + 8, Y + 14, X + 12, Y + 26, 3.4, 1, 3); body.line(X + 12, Y + 26, X + 10, Y + 38, 3, 1, 2.6);
  paintLit(L, body, (x, y) => mix(ALB_DOLL, ALB_DOLL_D, vnoise(x * 0.5, y * 0.5, 4) * 0.5), lights, { ny: (x, y) => vNormal(body, x, y, 4) * 0.5, nxMax: 4, amb: [0.1, 0.1, 0.11] });
  const jn = new Mask(L.w, L.h);
  jn.rect(X - 3, Y + 9, 7, 3);                                                         // 首
  jn.rect(X - 7, Y + 25, 14, 2);                                                       // 腰
  for (const s of [-1, 1]) { jn.ellipse(X + s * 8.5, Y + 13.5, 2.6, 2.6); jn.ellipse(X + s * 12, Y + 26, 2, 2); jn.ellipse(X + s * 10, Y + 42, 3, 3); jn.ellipse(X + s * 9, Y + 53, 2, 1.6); }
  paintLit(L, jn, (x, y) => (jn.at(x, y - 1) ? [70, 72, 84] : [170, 176, 190]), lights, { amb: [0.12, 0.12, 0.15] });
  // 顔 (淡い木肌)。開いた目に魂の光
  const face = new Mask(L.w, L.h); face.ellipse(X, Y + 1, 7.6, 8.8);
  const bang = new Mask(L.w, L.h); bang.ellipse(X, Y - 7, 9, 3.6);
  paintLit(L, face, (x, y) => {
    if (bang.at(x, y)) return null;
    if ((x === X - 3 || x === X + 3) && (y === Y + 1 || y === Y + 2)) return [24, 20, 26];
    if ((x === X - 4 || x === X + 2) && y === Y + 1) return [40, 30, 34];
    if (y === Y + 6 && Math.abs(x - X) < 1) return [140, 80, 70];
    return mix([236, 206, 162], [200, 162, 118], vnoise(x * 0.6, y * 0.6, 2) * 0.4);
  }, lights, { ny: (x, y) => vNormal(face, x, y, 5) * 0.4, nxMax: 3, amb: [0.16, 0.14, 0.14] });
  for (const ex of [X - 3, X + 3]) { L.px(ex, Y + 1, [140, 255, 220]); L.add(ex + (ex < X ? -1 : 1), Y + 1, [40, 160, 120], 0.6); }
  const sg = new Mask(L.w, L.h); sigilMask(sg, X, Y - 4, 0.18);
  L.paint(sg, () => rc(R_SOUL, 0.92));
}

// 20. セラの目覚め (館の燭台の傍。組み直されたセラが目を開け、イレーヌが見守る。燭台の魂火がセラの胸へ移る)
function sceneSera() {
  const W = ART_W, H = ART_H, L = new Layer(W, H);
  const FX = 40, FY = 26, SX = 92, SY = 50;
  const lights = [
    { x: FX, y: FY, r: 150, c: C_CANDLE, k: 1.25, p: 1.6 },
    { x: SX, y: SY + 20, r: 80, c: C_SOUL, k: 0.7, p: 1.5 },
    { x: 66, y: 22, r: 50, c: C_SOUL, k: 0.5, p: 1.4 },
    { x: 186, y: 20, r: 110, c: C_CANDLE, k: 0.75, p: 1.4 },   // 右の壁の燭 (画面の外)
  ];
  // 館の壁 (板張り) と床
  L.shade(0, 0, W - 1, 99, (x, y) => {
    const plank = (x % 16 === 0) ? 0.55 : 1;
    const g = Math.sin(y * 0.5 + vnoise(x * 0.1, y * 0.05, 4) * 6) * 0.5 + 0.5;
    return lit(mix([96, 70, 54], [128, 94, 70], g * 0.4).map((v) => v * plank), lightAt(x, y, lights), [0.05, 0.045, 0.06]);
  });
  L.shade(0, 100, W - 1, H - 1, (x, y) => lit(((x + (y - 100) * 3) % 22 === 0) ? [60, 40, 30] : [120, 86, 60], lightAt(x, y, lights, 0, -0.9), [0.05, 0.045, 0.06]));
  // 燭台 (左・真鍮)
  const st = new Mask(W, H);
  st.rect(FX - 1, FY + 8, 3, 66); st.poly([FX - 11, 102, FX + 12, 102, FX + 6, 94, FX - 5, 94]); st.ellipse(FX + 0.5, FY + 24, 4, 2);
  for (const sx of [-1, 1]) { st.line(FX + 0.5, FY + 24, FX + 0.5 + sx * 14, FY + 24, 2); st.line(FX + 0.5 + sx * 14, FY + 24, FX + 0.5 + sx * 14, FY + 16, 2); st.rect(FX + sx * 14 - 2, FY + 14, 5, 2); st.rect(FX + sx * 14 - 1, FY + 8, 3, 6); }
  st.rect(FX - 2, FY + 4, 5, 4);
  paintLit(L, st, (x, y) => (y < FY + 14 && Math.abs(x - FX) > 9 ? [200, 190, 170] : ALB_BRASS), lights, { amb: [0.1, 0.08, 0.06] });
  const cd = new Mask(W, H); cd.rect(FX - 1, FY + 1, 3, 4);
  paintLit(L, cd, () => [236, 226, 200], lights, { amb: [0.4, 0.4, 0.4] });
  const fl = new Mask(W, H); fl.poly([FX + 0.5, FY - 10, FX + 3.2, FY - 2, FX + 0.5, FY + 2, FX - 2.2, FY - 2]);
  L.paint(fl, (x, y) => (Math.abs(x - FX) < 1.3 && y > FY - 6 ? rc(R_SOUL, 0.98) : rc(R_EMBER, clamp(0.97 - (FY - y) * 0.018))));
  glow(L, FX + 0.5, FY - 3, 44, C_CANDLE, 0.32, 2.4);
  // イレーヌ (右・長い黒紫の髪、白い顔、深い紫の衣。手を胸に、セラを見守る)
  const IX = 150, IY = 26;
  const ihair = new Mask(W, H);
  ihair.ellipse(IX + 1, IY, 10, 11);
  ihair.poly([IX - 8, IY + 2, IX - 10, IY + 30, IX - 6, IY + 56, IX + 4, IY + 50, IX + 2, IY + 10]);
  ihair.poly([IX + 8, IY, IX + 14, IY + 26, IX + 16, IY + 58, IX + 8, IY + 50, IX + 6, IY + 12]);
  const dress = new Mask(W, H);
  dress.poly([IX - 9, IY + 14, IX + 11, IY + 14, IX + 13, IY + 34, IX + 22, H, IX - 22, H, IX - 11, IY + 34]);
  paintLit(L, dress, (x, y) => {
    if (y < IY + 17 && Math.abs(x - IX - 1) < 6) return [210, 190, 200];                          // 白い胸元のレース
    if (y === IY + 17 || (y === IY + 34 && x > IX - 12 && x < IX + 14)) return [200, 160, 80];       // 金の縁
    const fold = Math.sin((x - IX) * 0.45 + (y - IY) * 0.04) * 0.5 + 0.5;
    return mix([82, 46, 92], [46, 26, 56], fold * 0.7);
  }, lights, { nxMax: 8, amb: [0.14, 0.12, 0.16] });
  paintLit(L, ihair, (x, y) => mix([44, 30, 56], [82, 60, 100], (Math.sin((x - IX) * 0.7 + y * 0.12) * 0.5 + 0.5) * 0.7), lights, { ny: (x, y) => vNormal(ihair, x, y, 4) * 0.5, amb: [0.12, 0.1, 0.14] });
  const iface = new Mask(W, H); iface.ellipse(IX - 1, IY + 2, 6.4, 7.6);
  const ibang = new Mask(W, H); ibang.poly([IX - 8, IY - 8, IX + 8, IY - 8, IX + 6, IY - 2, IX - 2, IY - 4, IX - 8, IY + 2]);
  paintLit(L, iface, (x, y) => {
    if (ibang.at(x, y)) return null;
    if ((x === IX - 4 || x === IX + 1) && y === IY + 2) return [120, 70, 150];                     // 紫の目 (伏し目)
    if ((x === IX - 5 || x === IX) && y === IY + 1) return [60, 40, 60];
    if (y === IY + 6 && (x === IX - 2 || x === IX - 1)) return [170, 90, 100];
    return mix([238, 220, 214], [210, 186, 186], vnoise(x * 0.5, y * 0.5, 7) * 0.4);
  }, lights, { ny: (x, y) => vNormal(iface, x, y, 4) * 0.4, nxMax: 3, amb: [0.2, 0.18, 0.2] });
  const hands = new Mask(W, H); hands.ellipse(IX - 2, IY + 22, 3, 2.4); hands.ellipse(IX + 2, IY + 23, 3, 2.2);
  paintLit(L, hands, () => [236, 218, 210], lights, { amb: [0.2, 0.18, 0.2] });
  const orn = new Mask(W, H); orn.rect(IX + 5, IY - 6, 3, 2); orn.rect(IX - 1, IY + 14, 2, 3);
  L.paint(orn, () => [230, 196, 110]);
  rimLight(L, ihair, lights, [80, 120, 110], 0.6);
  // セラ
  drawSera(L, lights, SX, SY);
  // 魂火の流れ: 燭台の灯から弧を描いてセラの胸へ
  const P0 = [FX + 0.5, FY - 4], P1 = [64, -6], P2 = [SX, SY + 19];
  for (let i = 0; i <= 60; i++) {
    const t = i / 60, u = 1 - t;
    const x = u * u * P0[0] + 2 * u * t * P1[0] + t * t * P2[0], y = u * u * P0[1] + 2 * u * t * P1[1] + t * t * P2[1];
    if (i % 2 === 0) glow(L, x, y, 2 + t * 0.8, C_SOUL, 0.5 + t * 0.15, 1.6);
    if (i % 7 === 3) glow(L, x + Math.sin(i) * 4, y + Math.cos(i) * 3, 1.4, C_SOUL, 0.5, 1.4);
  }
  glow(L, SX, SY + 19, 11, C_SOUL, 0.42, 2);
  glow(L, SX, SY + 19, 3.5, [0.8, 1, 0.95], 0.6, 1.5);
  motes(L, lights, 50, 137, C_SOUL);
  vignette(L, 0.86);
  return L.canvas(12);
}

// ======================= 第五章「灼熱の洞」 =======================
// 樹液を煮詰める火の洞。赤く脈打つ岩・火・灰。光は ember と血の色
const C_LAVA = [1.0, 0.42, 0.16];
// 赤く脈打つ岩肌 (割れ目の奥がおき火色に光る)
function lavaRock(L, lights, x0, y0, x1, y1, seed, { sx = 0.14, sy = 0.16, glowK = 1 } = {}) {
  L.shade(x0, y0, x1, y1, (x, y) => {
    const w = worley(x * sx, y * sy, seed);
    const ridge = w[1] - w[0];
    if (ridge < 0.06) { const v = clamp(0.5 + (1 - ridge / 0.06) * 0.4 * glowK - (h2(x >> 3, y >> 3, seed) > 0.6 ? 0.3 : 0)); return rc(R_EMBER, v * 0.75); }
    const alb = mix([70, 40, 34], [118, 76, 60], clamp(ridge * 2.4) * 0.5 + w[2] * 0.4);
    return lit(alb, lightAt(x, y, lights, 0, (w[0] - 0.35) * 1.2), [0.08, 0.04, 0.04]);
  });
}
// 落ちる火の粉・灰
function embers(L, n, seed, x0 = 0, x1 = ART_W, y0 = 0, y1 = ART_H, col = [255, 170, 80]) {
  const R = rng(seed);
  for (let i = 0; i < n; i++) { const x = x0 + R() * (x1 - x0), y = y0 + R() * (y1 - y0); L.px(x, y, col); if (R() < 0.3) L.add(x, y + 1, [col[0] * 0.4, col[1] * 0.3, col[2] * 0.2], 1); }
}

// 21. 師の折れた刃 (赤く脈打つ岩の洞。鉄の扉の隙間に、鋸のように研いだ刃が折れて突き立つ)
function sceneBlade() {
  const W = ART_W, H = ART_H, L = new Layer(W, H);
  const GX = 96;
  const lights = [
    { x: GX, y: 54, r: 150, c: C_LAVA, k: 1.3, p: 1.4 },       // 扉の隙間から漏れる火
    { x: 10, y: 100, r: 90, c: C_CANDLE, k: 0.45, p: 1.4 },     // 手元のランタン
  ];
  lavaRock(L, lights, 0, 0, W - 1, H - 1, 151);
  // 鉄の扉 (左右二枚。わずかに開いた隙間から火の色)
  const door = new Mask(W, H);
  door.rect(52, 6, GX - 53, 90); door.rect(GX + 2, 6, 140 - GX - 2, 90);
  door.ellipse(GX + 0.5, 8, 44, 10);
  const gap = new Mask(W, H); gap.rect(GX - 1, 0, 3, 96);
  L.paint(door, (x, y) => (gap.at(x, y) ? null : [1, 1, 1]));
  paintLit(L, door, (x, y) => {
    if (gap.at(x, y)) return null;
    const band = (y - 6) % 22 < 3, rivet = ((y - 6) % 22 === 1) && (x - 52) % 8 === 4;
    if (rivet) return [170, 150, 140];
    const a = mix([86, 80, 82], ALB_RUST, clamp(fbm(x * 0.2, y * 0.2, 7) * 1.6 - 0.55));
    return band ? mulc(a, 1.3) : mulc(a, 0.85);
  }, lights, { ny: (x, y) => (((y - 6) % 22) === 0 ? -0.8 : 0), nxMax: 3, amb: [0.08, 0.05, 0.05] });
  L.paint(gap, (x, y) => (y < 96 && door.at(x - 2, y) ? rc(R_EMBER, clamp(0.9 - Math.abs(x - GX) * 0.08 - Math.abs(y - 54) * 0.004)) : null));
  // 扉枠の岩
  const frame = new Mask(W, H); frame.rect(46, 0, 6, 98); frame.rect(140, 0, 6, 98);
  paintLit(L, frame, (x, y) => mix([80, 60, 54], [120, 92, 80], vnoise(x * 0.6, y * 0.3, 3)), lights, { nxMax: 3, amb: [0.08, 0.05, 0.05] });
  // 床と、隙間から伸びる光の楔
  L.shade(0, 96, W - 1, H - 1, (x, y) => {
    const t = (y - 96) / 12, hw = 2 + t * 16;
    const inL = Math.abs(x - GX - t * 6) < hw;
    const a = mix([70, 50, 44], [104, 80, 66], vnoise(x * 0.5, y * 0.8, 5));
    const c = lit(a, lightAt(x, y, lights, 0, -0.9), [0.06, 0.04, 0.04]);
    return inL ? mix(c, rc(R_EMBER, 0.7), (1 - Math.abs(x - GX - t * 6) / hw) * 0.6) : c;
  });
  glow(L, GX, 54, 30, C_LAVA, 0.35, 2);
  // 鋸の刃 (隙間に斜めに突き立ち、半ばで折れている)。柄は革巻き
  const ang = -0.62, bx = GX + 0.5, by = 58;
  const dx = Math.cos(ang), dy = Math.sin(ang);
  const blade = new Mask(W, H), teeth = new Mask(W, H);
  const pt = (s, o) => [bx + dx * s - dy * o, by + dy * s + dx * o];
  // 刃 (s: 柄の側 32 → 隙間 0。折れ口は隙間の中)
  blade.poly([...pt(-2, -3), ...pt(32, -3.2), ...pt(32, 3), ...pt(-2, 2)]);
  for (let s = 0; s < 32; s += 3) teeth.poly([...pt(s, -3), ...pt(s + 1.5, -5.6), ...pt(s + 3, -3)]);
  paintLit(L, blade, (x, y) => mix([200, 204, 214], [120, 124, 136], clamp(((x - bx) * -dy + (y - by) * dx) / 6 + 0.5)), lights, { amb: [0.2, 0.18, 0.2] });
  paintLit(L, teeth, () => [150, 150, 160], lights, { amb: [0.18, 0.16, 0.18] });
  const hilt = new Mask(W, H); const g0 = pt(32, -6), g1 = pt(32, 6.2); hilt.line(g0[0], g0[1], g1[0], g1[1], 2.6);
  const h0 = pt(33, 0), h1 = pt(48, 0); hilt.line(h0[0], h0[1], h1[0], h1[1], 4.2); const p1 = pt(50, 0); hilt.ellipse(p1[0], p1[1], 2.6, 2.6);
  paintLit(L, hilt, (x, y) => (Math.round(((x - bx) * dx + (y - by) * dy)) % 3 === 0 ? [60, 40, 30] : [120, 84, 54]), lights, { amb: [0.12, 0.1, 0.1] });
  // 折れた切っ先 (床に落ちている)
  const tip = new Mask(W, H); tip.poly([60, 101, 78, 98, 80, 100, 62, 103]);
  for (let s = 0; s < 4; s++) tip.poly([62 + s * 4, 100.6 - s * 0.6, 63.5 + s * 4, 98 - s * 0.6, 65 + s * 4, 100 - s * 0.6]);
  paintLit(L, tip, (x, y) => (y < 100 ? [210, 214, 222] : [120, 124, 136]), lights, { amb: [0.2, 0.18, 0.2] });
  embers(L, 40, 153, 40, 150, 0, 100);
  motes(L, lights, 50, 155, C_EMBER);
  vignette(L, 0.86);
  return L.canvas(12);
}

// 22. 焼かれた人業の殻 (灰の降る祭場。焼け焦げた人業の殻が積み上がる)
function sceneHusks() {
  const W = ART_W, H = ART_H, L = new Layer(W, H);
  const AX = 96, AY = 30;
  const lights = [
    { x: AX, y: AY, r: 150, c: C_LAVA, k: 1.15, p: 1.4 },       // 奥の火の祭壇
    { x: AX, y: 70, r: 70, c: C_EMBER, k: 0.5, p: 1.5 },          // 殻の内でくすぶる火
    { x: 100, y: 116, r: 60, c: C_EMBER, k: 0.7, p: 1.4 },        // 手前の燃えさし
  ];
  // 祭場の奥 (灰に霞む岩壁と、火を拝む石像の影)
  L.shade(0, 0, W - 1, H - 1, (x, y) => {
    const f = fbm(x * 0.05, y * 0.08, 159);
    const l = lightAt(x, y, lights);
    return [22 + f * 20 + l[0] * 60, 16 + f * 14 + l[1] * 34, 16 + f * 12 + l[2] * 22];
  });
  for (const [x, h] of [[24, 60], [168, 64]]) {
    const idol = new Mask(W, H); idol.rect(x - 7, 100 - h, 14, h); idol.ellipse(x, 100 - h, 8, 7); idol.rect(x - 11, 96, 22, 6);
    paintLit(L, idol, (xx, yy) => mix([70, 60, 56], [100, 88, 80], vnoise(xx * 0.4, yy * 0.2, x)), lights, { nxMax: 7, amb: [0.06, 0.05, 0.05] });
  }
  // 火の祭壇 (石の大鉢と炎)
  const bowl = new Mask(W, H); bowl.poly([AX - 22, AY + 6, AX + 22, AY + 6, AX + 14, AY + 16, AX - 14, AY + 16]); bowl.rect(AX - 4, AY + 16, 8, 30); bowl.rect(AX - 10, AY + 44, 20, 4);
  paintLit(L, bowl, () => [110, 90, 80], lights, { nxMax: 6, amb: [0.08, 0.06, 0.06] });
  const fire = new Mask(W, H);
  for (let x = AX - 20; x <= AX + 20; x++) { const t = Math.sqrt(1 - Math.abs(x - AX) / 21); const h = 3 + t * 12 + Math.max(0, Math.sin(x * 0.75 + 1)) * 12 * t + vnoise(x * 0.4, 1, 7) * 6 * t; fire.rect(x, AY + 6 - h, 1, h); }
  L.paint(fire, (x, y) => rc(R_EMBER, clamp(0.5 + (y - AY + 22) / 28 * 0.5 - Math.abs(x - AX) * 0.008)));
  glow(L, AX, AY - 4, 46, C_LAVA, 0.4, 2.2);
  // 灰の積もった地面
  L.shade(0, 96, W - 1, H - 1, (x, y) => lit(mix([96, 90, 88], [140, 132, 126], vnoise(x * 0.4, y, 3)), lightAt(x, y, lights, 0, -0.9), [0.06, 0.05, 0.05]));
  // 殻の山: 焼けた腕・脚・頭・胴を積む (奥から手前へ)
  const R = rng(163);
  const pile = new Mask(W, H);
  const parts = [];
  for (let i = 0; i < 70; i++) {
    const t = i / 70, cx = AX + (R() - 0.5) * (130 - t * 40) * (1 - t * 0.3), cy = 68 + R() * 36 - (1 - Math.abs(cx - AX) / 80) * 18 * (1 - t);
    parts.push({ k: R(), cx, cy, a: R() * Math.PI, len: 10 + R() * 16, w: 3 + R() * 3 });
  }
  parts.sort((a, b) => a.cy - b.cy);
  for (const p of parts) {
    const m = new Mask(W, H), jn = new Mask(W, H);
    if (p.k < 0.62) { const x1 = p.cx + Math.cos(p.a) * p.len / 2, y1 = p.cy + Math.sin(p.a) * p.len / 2 * 0.6, x0 = p.cx - Math.cos(p.a) * p.len / 2, y0 = p.cy - Math.sin(p.a) * p.len / 2 * 0.6; m.line(x0, y0, x1, y1, p.w, 1, p.w * 0.75); jn.ellipse(x0, y0, p.w * 0.6, p.w * 0.6); }
    else if (p.k < 0.84) { m.ellipse(p.cx, p.cy, 5.2, 5.8); }
    else { m.poly([p.cx - 7, p.cy - 6, p.cx + 7, p.cy - 6, p.cx + 6, p.cy + 7, p.cx - 6, p.cy + 7]); jn.rect(p.cx - 6, p.cy, 12, 1.4); }
    paintLit(L, m, (x, y) => {
      const n = vnoise(x * 0.7, y * 0.7, p.cx | 0);
      if (n > 0.86) return rc(R_EMBER, 0.62 + (n - 0.86) * 2);                   // 焼け目の奥でくすぶる火
      const ash = !m.at(x, y - 1) || !m.at(x, y - 2);
      return ash ? [120, 112, 106] : mix([30, 24, 22], [64, 46, 38], n);
    }, lights, { ny: (x, y) => vNormal(m, x, y, 3), nxMax: 3, amb: [0.08, 0.06, 0.06] });
    paintLit(L, jn, () => [60, 60, 66], lights, { amb: [0.1, 0.08, 0.08] });
    pile.ellipse(p.cx, p.cy, 1, 1);
    if (p.k >= 0.62 && p.k < 0.84 && p.cy > 80 && R() < 0.6) { L.px(p.cx - 2, p.cy, [8, 6, 6]); L.px(p.cx + 2, p.cy, [8, 6, 6]); L.px(p.cx - 2, p.cy + 1, [8, 6, 6]); L.px(p.cx + 2, p.cy + 1, [8, 6, 6]); } // 空ろな目
  }
  // 手前に転がる殻の頭 (空ろな目) と、指を開いた焼けた手
  const fh = new Mask(W, H); fh.ellipse(78, 94, 7, 7.6);
  const fa = new Mask(W, H); fa.line(98, 100, 116, 94, 4, 1, 3.2); fa.ellipse(119, 93, 3.4, 3);
  for (let k = 0; k < 4; k++) fa.line(120, 92, 124 + k * 0.6, 86 + k * 2.2, 1.4);
  for (const m of [fh, fa]) paintLit(L, m, (x, y) => (!m.at(x, y - 1) ? [140, 130, 122] : vnoise(x * 0.8, y * 0.8, 5) > 0.84 ? rc(R_EMBER, 0.7) : mix([36, 28, 26], [70, 52, 44], vnoise(x * 0.5, y * 0.5, 3))), lights, { ny: (x, y) => vNormal(m, x, y, 4), amb: [0.1, 0.08, 0.08] });
  for (const ex of [75, 76, 80, 81]) for (const ey of [93, 94]) L.px(ex, ey, [6, 4, 4]);
  const fj = new Mask(W, H); fj.rect(76, 101, 5, 2); fj.ellipse(98, 100, 2.6, 2.6);
  paintLit(L, fj, () => [70, 70, 78], lights, { amb: [0.12, 0.1, 0.1] });
  glow(L, AX, 80, 40, C_EMBER, 0.14, 2);
  // 降り続ける灰 (大小の灰色の粒) と、昇る火の粉
  const R2 = rng(167);
  for (let i = 0; i < 220; i++) { const x = R2() * W, y = R2() * H, c = 150 + R2() * 70; L.px(x, y, [c, c * 0.96, c * 0.92], 0.8); if (R2() < 0.25) L.px(x + 1, y, [c * 0.8, c * 0.78, c * 0.74], 0.7); }
  embers(L, 30, 169, 50, 140, 10, 90);
  vignette(L, 0.84);
  return L.canvas(12);
}

// 23. 霊薬の帳面 (釜の縁の作業台。金の杯と、開いた帳面。釜の火の照り返し)
function sceneCup() {
  const W = ART_W, H = ART_H, L = new Layer(W, H);
  const lights = [
    { x: 58, y: 80, r: 190, c: C_LAVA, k: 1.35, p: 1.3 },       // 釜の下の火の照り返し
    { x: 58, y: 24, r: 90, c: [1.0, 0.6, 0.3], k: 0.6, p: 1.4 },  // 煮えたぎる樹液
    { x: 176, y: 40, r: 100, c: C_CANDLE, k: 0.7, p: 1.4 },     // 作業台の蝋燭 (画面の外)
  ];
  // 奥: 火の洞の岩肌と、左奥の大釜 (黒鉄の胴。縁の内で樹液が煮え、縁の下から火が照らす)
  lavaRock(L, lights, 0, 0, W - 1, 70, 171, { sx: 0.1, sy: 0.12, glowK: 0.4 });
  const PX = 58, PY = 30;
  const pot = new Mask(W, H);
  for (let y = PY; y <= 70; y++) { const t = (y - PY) / 40; pot.rect(PX - 74 * Math.sqrt(Math.max(0, 1 - t * t * 0.55)), y, 148 * Math.sqrt(Math.max(0, 1 - t * t * 0.55)), 1); }
  paintLit(L, pot, (x, y) => {
    const band = (y - PY) % 10 === 4, riv = band && (x - PX) % 7 === 0;
    return riv ? [140, 126, 120] : band ? [80, 72, 72] : mix([60, 54, 58], [36, 32, 36], fbm(x * 0.12, y * 0.12, 5));
  }, lights, { nxMax: 16, ny: (x, y) => 0.4, amb: [0.08, 0.05, 0.05] });
  const prim = new Mask(W, H); prim.ellipse(PX, PY, 77, 7);
  const pin = new Mask(W, H); pin.ellipse(PX, PY, 71, 4.4);
  paintLit(L, prim, (x, y) => (pin.at(x, y) ? null : [120, 110, 108]), lights, { ny: () => -0.7, amb: [0.12, 0.08, 0.08] });
  L.paint(pin, (x, y) => { const b = fbm(x * 0.15, y * 0.6, 13); return b > 0.64 ? rc(R_SOUL, 0.55 + (b - 0.64)) : rc(R_EMBER, clamp(0.58 + b * 0.35)); });
  glow(L, PX, PY - 2, 70, [1.0, 0.6, 0.25], 0.22, 2);
  // 湯気 (縁から立ちのぼる)
  L.shade(0, 0, W - 1, PY, (x, y) => { const f = clamp(fbm(x * 0.05, y * 0.1 + x * 0.01, 173) * 1.6 - 0.65) * clamp(1 - Math.abs(x - PX) / 90); if (f > 0) L.add(x, y, [150, 120, 110], f * 0.45); return null; });
  // 作業台 (手前・板の天板)
  const top = 68;
  L.shade(0, top, W - 1, H - 1, (x, y) => {
    const t = (y - top) / (H - top);
    const plank = ((x - 96) / (0.6 + t * 0.4) + 400) % 26 < 1;
    const g = Math.sin(y * 0.9 + vnoise(x * 0.1, y * 0.3, 4) * 5) * 0.5 + 0.5;
    const a = plank ? [50, 34, 24] : mix(ALB_WOOD_D, ALB_WOOD, g * 0.5 + 0.2);
    return lit(a, lightAt(x, y, lights, 0, -0.95), [0.06, 0.045, 0.045]);
  });
  L.shade(0, top - 2, W - 1, top - 1, (x, y) => lit([170, 130, 90], lightAt(x, y, lights, 0, -1), [0.06, 0.05, 0.05]));
  // 開いた帳面 (左の頁は日付と量の列、右の頁に王の杯の印)
  const BL = 34, BM = 78, BR = 122, BT = 72, BB = 98;
  const book = new Mask(W, H); book.poly([BL + 4, BT, BM, BT + 2, BR - 4, BT, BR, BB, BM, BB - 2, BL, BB]);
  paintLit(L, book, (x, y) => {
    if (Math.abs(x - BM) < 1) return [120, 96, 70];
    const left = x < BM;
    const inner = left ? x > BL + 6 && x < BM - 4 : x > BM + 4 && x < BR - 6;
    if (inner && y % 3 === 0 && y > BT + 3 && y < BB - 3) {
      if (left) return (x - BL) % 14 < 8 && h2(x >> 1, y, 3) > 0.2 ? [80, 46, 40] : (x - BL) % 14 > 9 && (x - BL) % 14 < 13 ? [150, 40, 30] : null;
      if (h2(x >> 1, y, 5) > 0.3 && !(x > 94 && x < 108 && y > 78 && y < 92)) return [80, 46, 40];
    }
    return mix(ALB_PAPER, [236, 222, 186], (y - BT) / (BB - BT) * 0.5);
  }, lights, { amb: [0.22, 0.2, 0.2] });
  const seal = new Mask(W, H); seal.poly([96, 80, 106, 80, 103, 85, 99, 85]); seal.rect(100, 85, 2, 4); seal.rect(97, 89, 8, 1);
  L.paint(seal, () => [160, 120, 50]);                                        // 頁に描かれた杯の印
  const quill = new Mask(W, H); quill.line(116, 70, 132, 52, 1.2); quill.poly([128, 56, 136, 44, 133, 58]);
  paintLit(L, quill, (x, y) => (y < 60 ? [220, 210, 196] : [60, 40, 30]), lights, { amb: [0.2, 0.18, 0.18] });
  // 金の杯 (右。釜の火を受けて輝く)
  const CX = 154, CB = 100, K = 1.35;
  const cup = new Mask(W, H);
  const Q = (pts) => pts.map((v, i) => (i % 2 ? CB + v * K : CX + v * K));
  cup.poly(Q([-12, -32, 12, -32, 10, -24, 5, -19, -5, -19, -10, -24]));
  cup.poly(Q([-2, -19, 2, -19, 2, -7, -2, -7])); cup.ellipse(CX, CB - 13 * K, 4 * K, 2.2 * K); cup.poly(Q([-3, -7, 3, -7, 9, 0, -9, 0]));
  paintLit(L, cup, (x, y) => {
    if (Math.abs(y - (CB - 28 * K)) < 0.7 && Math.round(x - CX) % 5 === 0 && Math.abs(x - CX) < 12) return [170, 40, 50];   // 縁の紅玉
    return mix([240, 196, 96], [150, 104, 40], clamp((x - CX + 10) / 30));
  }, lights, { nxMax: 12, ny: (x, y) => (y > CB - 4 ? -0.6 : 0), amb: [0.2, 0.15, 0.08] });
  const liq = new Mask(W, H); liq.ellipse(CX, CB - 32 * K, 15.6, 2.6);
  L.paint(liq, (x, y) => (Math.abs(x - CX + 4) < 2.5 && y <= CB - 32 * K ? [210, 120, 80] : [100, 20, 28]));
  for (let k = 0; k < 6; k++) L.px(CX - 9 + (k > 2 ? 1 : 0), CB - 30 * K + k * 1.5, [255, 240, 190]); // 照り返し
  glow(L, CX - 6, CB - 26 * K, 18, C_EMBER, 0.25, 2);
  embers(L, 24, 177, 0, W, 0, 66);
  motes(L, lights, 40, 179, C_EMBER);
  vignette(L, 0.84);
  return L.canvas(12);
}

// 24. 業火の大釜 (底の見えない穴の上にかかる巨大な釜。その前に、痩せた長身の影 = モルデン)
function sceneCauldron() {
  const W = ART_W, H = ART_H, L = new Layer(W, H);
  const CX = 108, CY = 44;
  const lights = [
    { x: CX, y: CY + 34, r: 170, c: C_LAVA, k: 1.35, p: 1.35 },  // 釜の下の業火
    { x: CX, y: CY - 14, r: 70, c: [1.0, 0.7, 0.3], k: 0.6, p: 1.4 }, // 煮えたぎる樹液
  ];
  // 洞の奥 (赤く照らされた岩)
  lavaRock(L, lights, 0, 0, W - 1, H - 1, 181, { sx: 0.08, sy: 0.1, glowK: 0.6 });
  // 底の見えない穴 (縁だけが赤く光る)
  const pit = new Mask(W, H); pit.ellipse(CX, 92, 76, 14);
  L.paint(pit, (x, y) => { const d = Math.hypot((x - CX) / 76, (y - 92) / 14); return d > 0.86 ? rc(R_EMBER, 0.55 + (d - 0.86) * 2.5) : rc(R_BLOOD, clamp(0.25 * smooth(0.2, 0.86, d))); });
  // 穴から噴き上がる業火 (穴の奥の縁から炎の舌が立ち、釜の底を舐める)
  const fire = new Mask(W, H);
  for (let x = CX - 62; x <= CX + 62; x++) {
    const u = (x - CX) / 76, base = 92 - 14 * Math.sqrt(Math.max(0, 1 - u * u)) + 3;
    const t = Math.sqrt(Math.max(0, 1 - Math.abs(x - CX) / 63));
    const top = base - 8 - t * 24 - Math.max(0, Math.sin(x * 0.42)) * 16 * t - vnoise(x * 0.3, 3, 5) * 8 * t;
    fire.rect(x, top, 1, base - top);
  }
  L.paint(fire, (x, y) => rc(R_EMBER, clamp(0.42 + (y - 46) / 40 * 0.5 - Math.abs(x - CX) * 0.003)));
  // 吊り鎖 (天井の闇から)
  for (const [x0, x1] of [[CX - 64, CX - 40], [CX - 20, CX - 14], [CX + 20, CX + 14], [CX + 64, CX + 40]]) {
    for (let k = 0; k < 40; k++) {
      const t = k / 40, x = x0 + (x1 - x0) * t, y = -2 + t * (CY - 10);
      const m = new Mask(W, H); if (k % 2) m.rect(x - 0.5, y, 2, 3); else m.rect(x - 1.5, y + 1, 4, 1.5);
      paintLit(L, m, () => [110, 100, 100], lights, { nxMax: 1, amb: [0.08, 0.06, 0.06] });
    }
  }
  // 大釜 (黒鉄の胴と縁。中で樹液が煮え、魂の光が泡立つ)
  const pot = new Mask(W, H);
  for (let y = CY - 10; y <= CY + 32; y++) { const t = (y - CY + 10) / 42; const hw = 50 * Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(0, t - 0.2) / 0.8, 2))); pot.rect(CX - hw, y, hw * 2, 1); }
  paintLit(L, pot, (x, y) => {
    const band = (y - CY) % 12 === 0, riv = band && (x - CX) % 6 === 0;
    return riv ? [130, 120, 116] : band ? [74, 68, 70] : mix([56, 50, 54], [34, 30, 34], fbm(x * 0.12, y * 0.12, 9));
  }, lights, { nxMax: 16, ny: (x, y) => vNormal(pot, x, y, 10), amb: [0.06, 0.04, 0.04] });
  const rim = new Mask(W, H); rim.ellipse(CX, CY - 10, 53, 7);
  const inner = new Mask(W, H); inner.ellipse(CX, CY - 10, 47, 4.4);
  paintLit(L, rim, (x, y) => (inner.at(x, y) ? null : [96, 90, 92]), lights, { ny: () => -0.6, amb: [0.1, 0.06, 0.06] });
  L.paint(inner, (x, y) => {
    const b = fbm(x * 0.2, y * 0.6, 13);
    return b > 0.62 ? rc(R_SOUL, 0.6 + (b - 0.62) * 1.4) : rc(R_EMBER, clamp(0.62 + b * 0.35));
  });
  glow(L, CX, CY - 12, 50, [1.0, 0.6, 0.25], 0.3, 2);
  // 湯気 (魂の色を帯びて立ちのぼる)
  L.shade(CX - 50, 0, CX + 50, CY - 10, (x, y) => { const f = clamp(fbm(x * 0.06, y * 0.12, 187) * 1.7 - 0.7) * (1 - Math.abs(x - CX) / 50); if (f > 0) L.add(x, y, [90, 150, 130], f * 0.5); return null; });
  // 手前の岩棚と、モルデンの影 (痩せた長身・長い衣。釜の火を背に受け、縁だけが赤く光る)
  const ledge = new Mask(W, H); ledge.poly([0, 96, 30, 92, 62, 96, 70, H, 0, H]);
  paintLit(L, ledge, (x, y) => mix([40, 26, 24], [70, 46, 40], vnoise(x * 0.4, y * 0.4, 3)), lights, { ny: (x, y) => (y < 98 ? -1 : 0), amb: [0.04, 0.03, 0.03] });
  const MX = 34, MB = 94;
  const fig = new Mask(W, H);
  fig.poly([MX - 8, MB, MX - 6, MB - 30, MX - 5, MB - 44, MX - 3, MB - 52, MX + 4, MB - 52, MX + 6, MB - 44, MX + 7, MB - 30, MX + 10, MB]);
  fig.ellipse(MX + 1, MB - 57, 3.6, 5);
  fig.line(MX + 5, MB - 46, MX + 9, MB - 30, 2.4);                                   // 釜を指す細い腕 (下ろしている)
  L.paint(fig, () => [10, 6, 8]);
  rimLight(L, fig, lights, [255, 150, 70], 1.1);
  // 横顔の白い縁と、薄い笑み
  for (let y = MB - 60; y <= MB - 53; y++) L.px(MX + 4 + (y > MB - 57 ? 1 : 0), y, [236, 226, 214]);
  L.px(MX + 3, MB - 54, [200, 120, 110]);
  embers(L, 50, 189, 20, W, 10, 100);
  motes(L, lights, 50, 191, C_EMBER);
  vignette(L, 0.86);
  return L.canvas(12);
}

// ======================= 第六章「氷結回廊」 =======================
// 奈落の壁に張り出した氷の棚と、氷に閉じ込められた魂。共通のパレットには青が乏しいので、
// 氷の青 (R_ICE) と極光の紫 (R_AURORA) を足したパレット (ICE_PAL) で量子化する
const R_ICE = ramp(["#050912", "#081020", "#0c182e", "#11223e", "#172e50", "#1f3c64", "#294c78", "#355e8c", "#4472a0",
  "#5788b4", "#6ea0c6", "#88b8d6", "#a6cee4", "#c6e2f0", "#e6f4fa"]);
const R_AURORA = ramp(["#120a24", "#1e1038", "#2c1650", "#3c1e68", "#502882", "#683698", "#8248b0", "#9e62c6", "#bc84da"]);
export const ICE_PAL = new Palette([...PAL.cols, ...R_ICE, ...R_AURORA]);
const C_ICE = [0.55, 0.8, 1.0];
const ALB_COAT = [52, 46, 62], ALB_COAT_D = [30, 26, 38], ALB_EMBROID = [176, 136, 70];
// 切子の氷: worley の面ごとに向き (擬似法線) を変え、面の境を明るい稜線に。ところどころ気泡
function paintIce(L, m, lights, seed, { sx = 0.09, sy = 0.12, deep = [34, 64, 100], pale = [140, 190, 222], amb = [0.14, 0.18, 0.24], ridgeK = 0.6 } = {}) {
  L.paint(m, (x, y) => {
    const w = worley(x * sx, y * sy, seed), ridge = w[1] - w[0], id = w[2];
    const nx = Math.cos(id * 6.283) * 0.8, ny = Math.sin(id * 6.283) * 0.6 - 0.2;
    let alb = mix(deep, pale, clamp(id * 0.55 + fbm(x * 0.15, y * 0.15, seed) * 0.45));
    if (ridge < 0.05) alb = mix(alb, [220, 240, 252], ridgeK);
    if (vnoise(x * 0.8, y * 0.8, seed + 5) > 0.9) alb = mix(alb, [230, 246, 255], 0.5);
    return lit(alb, lightAt(x + 0.5, y + 0.5, lights, nx, ny), amb);
  });
}
// つらら (上端 (x,y) から下へ len 伸びる。左の面が明るい)
function icicle(m, x, y, len, w) { m.poly([x - w / 2, y, x + w / 2, y, x + w * 0.1, y + len * 0.7, x, y + len, x - w * 0.15, y + len * 0.6]); }
// 舞う雪: up = 下から吹き上げる (尾を下へ引く)
function snow(L, n, seed, { x0 = 0, x1 = ART_W, y0 = 0, y1 = ART_H, up = false, tail = 0, col = [226, 240, 250], a = 0.9 } = {}) {
  const R = rng(seed);
  for (let i = 0; i < n; i++) {
    const x = x0 + R() * (x1 - x0), y = y0 + R() * (y1 - y0), big = R() < 0.18;
    L.px(x, y, col, a);
    if (big) { L.px(x + 1, y, col, a * 0.7); L.px(x, y + 1, col, a * 0.5); }
    for (let k = 1; k <= tail; k++) L.px(x - k * 0.25, y + (up ? k : -k), col, a * 0.45 * (1 - k / (tail + 1)));
  }
}

// 25. 師の外套 (奈落の壁から張り出した氷の棚。半ば凍りついた旅の外套。下から雪が吹き上げ、上には大釜の底の穴)
function sceneCoat() {
  const W = ART_W, H = ART_H, L = new Layer(W, H);
  const lights = [
    { x: 20, y: 40, r: 120, c: C_CANDLE, k: 0.7, p: 1.5 },        // 手元のランタン (左の棚の上)
    { x: 108, y: -6, r: 60, c: C_LAVA, k: 0.5, p: 1.4 },           // 上の穴から漏れる大釜の火の名残
    { x: 120, y: 150, r: 190, c: C_ICE, k: 1.1, p: 1.1 },          // 下の闇で青白く光る氷
    { x: 170, y: 50, r: 90, c: C_ICE, k: 0.4, p: 1.2 },
  ];
  // 奥: 向かいの縦穴の壁 (闇に沈み、下ほど暗い)
  L.shade(0, 0, W - 1, H - 1, (x, y) => {
    const t = y / H, f = fbm(x * 0.04, y * 0.06, 201), w = worley(x * 0.05, y * 0.07, 203);
    const l = lightAt(x, y, lights);
    const k = (1 - t * 0.8) * (0.75 + w[2] * 0.3);
    return [5 + (8 + f * 8) * k + l[0] * 6, 9 + (14 + f * 10) * k + l[1] * 10, 18 + (26 + f * 12) * k + l[2] * 18];
  });
  // 向かいの壁を螺旋に下る氷の棚 (円筒の壁なので、中ほどが垂れる弧に見える)。棚の下に小さなつらら
  for (let k = 0; k < 6; k++) {
    for (let x = 0; x < W; x++) {
      const y = -14 + k * 20 + x * 0.05 + Math.sin(x / W * Math.PI) * 15;
      if (y < 0 || y >= H) continue;
      const v = vnoise(x * 0.15, k, 5); if (v < 0.3) continue;              // ところどころ途切れる
      const fade = clamp(1 - y / 100) * (0.3 + 0.5 * v);
      L.add(x, y, [44, 74, 100], fade); L.add(x, y + 1, [16, 28, 40], fade);
      if (h2(x, k, 7) > 0.78) for (let d = 2; d < 2 + h2(x, k, 9) * 4; d++) L.add(x, y + d, [30, 54, 74], fade * 0.6 * (1 - d / 6));
    }
  }
  // 上: 大釜の底の暗い穴 (縁だけが火の名残で鈍く赤い)
  const hole = new Mask(W, H); hole.ellipse(108, 1, 38, 9);
  L.paint(hole, (x, y) => { const d = Math.hypot((x - 108) / 38, (y - 1) / 9); return d > 0.78 ? rc(R_EMBER, 0.16 + (d - 0.78) * 1.5) : [10, 4, 6]; });
  glow(L, 108, 3, 30, C_LAVA, 0.12, 2);
  // 左: 手前の縦穴の壁 (岩を氷がおおう)
  const wall = new Mask(W, H);
  for (let y = 0; y < H; y++) { const e = 18 + Math.sin(y * 0.09) * 4 + vnoise(1, y * 0.2, 3) * 7; wall.rect(0, y, e, 1); }
  paintIce(L, wall, lights, 205, { deep: [22, 38, 70], pale: [90, 136, 184], sx: 0.12, sy: 0.08 });
  rimLight(L, wall, lights, [90, 150, 190], 0.5);
  // 氷の棚 (左の壁から右へ張り出す。上面は吹き寄せた雪、正面は切子の氷、下にはつらら)
  const topY = (x) => 60 + x * 0.04 + vnoise(x * 0.12, 1, 11) * 2;     // 奥の縁
  const frontY = (x) => 73 + Math.sin(x * 0.05) * 1.5;                  // 手前の縁
  const tipX = 166;
  const top = new Mask(W, H), face = new Mask(W, H), cic = new Mask(W, H);
  for (let x = 0; x <= tipX; x++) {
    const t = x > 134 ? (x - 134) / (tipX - 134) : 0;
    const y0 = topY(x) + t * 9, y1 = frontY(x) - t * 4;
    if (y1 <= y0) continue;
    top.rect(x, y0, 1, y1 - y0);
    const th = (10 - t * 7) + vnoise(x * 0.3, 2, 13) * 3;
    face.rect(x, y1, 1, th);
    if (h2(x, 3, 17) > 0.68) icicle(cic, x, y1 + th - 1, 4 + h2(x, 4, 19) * 16 * (1 - t), 2 + h2(x, 5, 21) * 2);
  }
  paintIce(L, face, lights, 207, { deep: [56, 96, 136], pale: [170, 212, 236], amb: [0.24, 0.3, 0.4] });
  paintIce(L, cic, lights, 209, { deep: [70, 110, 150], pale: [190, 226, 244], sx: 0.3, sy: 0.08, amb: [0.24, 0.3, 0.4] });
  paintLit(L, top, (x, y) => {
    const n = fbm(x * 0.12, y * 0.4, 23);
    const drift = Math.sin(x * 0.2 - y * 0.9 + n * 4) > 0.7;                // 風の吹き溜まりの筋
    return drift ? [236, 244, 252] : mix([168, 192, 214], [214, 228, 242], n);
  }, lights, { ny: () => -0.9, amb: [0.34, 0.4, 0.5] });
  for (let x = 0; x <= tipX; x++) { const y = Math.round(frontY(x) - (x > 134 ? (x - 134) / (tipX - 134) * 4 : 0)); if (top.at(x, y - 1)) L.add(x, y, [70, 80, 90], 0.8); } // 棚の縁の照り
  // 棚の上の、風に削られた氷の牙
  const spikes = new Mask(W, H);
  for (const [x, h, w] of [[26, 12, 5], [36, 7, 4], [48, 9, 4], [146, 10, 4], [156, 6, 3], [74, 8, 4]]) spikes.poly([x - w / 2, topY(x) + 7, x + w / 2, topY(x) + 7, x + 1, topY(x) + 7 - h]);
  paintIce(L, spikes, lights, 211, { deep: [80, 120, 156], pale: [200, 230, 244], sx: 0.4, sy: 0.15, amb: [0.26, 0.32, 0.42] });
  // 外套を掛けた太い氷の柱 (棚から突き立つ)
  const CX = 112, post = new Mask(W, H);
  post.poly([CX - 5, topY(CX) + 9, CX + 6, topY(CX) + 9, CX + 3, 30, CX + 1, 20, CX - 1, 26, CX - 3, 32]);
  paintIce(L, post, lights, 219, { deep: [80, 120, 156], pale: [200, 230, 244], sx: 0.3, sy: 0.1, amb: [0.26, 0.32, 0.42] });
  // 外套: 襟と肩を柱の先に掛け、両袖を垂らし、裾は吹き上げる風にあおられた形のまま凍る。裾の端は棚に凍りつく
  const coat = new Mask(W, H), sleeve = new Mask(W, H);
  coat.poly([CX - 6, 30, CX + 6, 30, CX + 14, 35, CX + 16, 46, CX + 19, 58, CX + 26, 62, CX + 22, 66, CX + 16, 67, CX + 8, 69, CX - 2, 69, CX - 10, 68, CX - 16, 66, CX - 15, 52, CX - 14, 37]);
  coat.ellipse(CX, 31, 7, 3.4);                                         // 柱の先に引っかかった襟と、背に垂れた頭巾
  sleeve.line(CX - 13, 36, CX - 19, 52, 5, 1, 4.4); sleeve.line(CX - 19, 52, CX - 18, 60, 4.4, 1, 3.6);   // 左袖 (垂れる)
  sleeve.line(CX + 13, 36, CX + 22, 44, 5, 1, 4.2); sleeve.line(CX + 22, 44, CX + 28, 40, 4.2, 1, 3.4);   // 右袖 (風にあおられて凍る)
  const fold = (x, y) => Math.sin((x - CX) * 0.9 + vnoise(x * 0.2, y * 0.15, 3) * 3) * 0.5 + 0.5;
  for (const m of [coat, sleeve]) paintLit(L, m, (x, y) => {
    const edgeTop = !m.at(x, y - 1) || (!m.at(x, y - 2) && h2(x, y, 25) > 0.4);
    if (edgeTop) return mix([170, 192, 212], [222, 234, 246], vnoise(x, y, 3));       // 積もった霜
    if (m === coat && (!m.at(x, y + 1) || !m.at(x, y + 2))) return h2(x, y, 29) > 0.3 ? ALB_EMBROID : ALB_COAT_D;   // 裾の控えめな金の刺しゅう
    if (m === coat && Math.abs(x - CX - 1) < 0.8 && y > 34) return h2(x, y, 37) > 0.4 ? ALB_EMBROID : ALB_COAT_D;   // 前立ての刺しゅう
    if (m === sleeve && (!m.at(x + 1, y) && !m.at(x, y + 1))) return ALB_EMBROID;      // 袖口
    if (h2(x, y, 27) > 0.975) return [150, 170, 190];                                    // 霜の粒
    return mix(ALB_COAT, ALB_COAT_D, fold(x, y) * 0.85);
  }, lights, { ny: (x, y) => vNormal(m, x, y, 3) * 0.4, nxMax: 6, amb: [0.16, 0.17, 0.22] });
  // 書きつけの紙の角 (ポケットから覗く)
  const note = new Mask(W, H); note.poly([CX + 4, 52, CX + 10, 50, CX + 11, 55, CX + 5, 56]);
  paintLit(L, note, (x, y) => (y === 53 && x > CX + 5 && x < CX + 10 ? [90, 70, 60] : ALB_PAPER), lights, { amb: [0.34, 0.34, 0.38] });
  // 裾を棚に縫いとめる透けた氷
  const encase = new Mask(W, H);
  encase.poly([CX - 20, 70, CX - 17, 62, CX - 6, 64, CX + 8, 63, CX + 22, 62, CX + 28, 66, CX + 22, 72, CX - 4, 72]);
  L.paint(encase, (x, y) => {
    const hi = (!encase.at(x - 1, y) || !encase.at(x, y - 1)) && h2(x, y, 35) > 0.3;
    return hi ? [210, 236, 250, 0.75] : [130, 180, 220, 0.35];
  });
  rimLight(L, coat, lights, [150, 190, 220], 0.4);
  // 吹き上げる雪 (下から上へ。尾を下へ引く) と、棚の上を流れる粉雪
  snow(L, 70, 213, { up: true, tail: 2, a: 0.6 });
  snow(L, 30, 215, { x0: 20, x1: 170, y0: 52, y1: 74, col: [240, 248, 255], a: 0.5 });
  motes(L, lights, 30, 217, [0.8, 0.9, 1.0]);
  vignette(L, 0.84);
  return L.canvas(12, ICE_PAL);
}

// 26. 氷柱の中の十一人 (青白い氷の回廊。両側に並ぶ氷柱に、操霊師の人影がひとりずつ閉じ込められている。一本だけ空)
// 人影: (cx, by) = 足もと、s = 大きさ、pose = 0 腕組み / 1 腕を下ろす / 2 片手を顔へ / 3 うなだれる
function frozenFigure(m, cx, by, s, pose, face = null) {
  const P = (pts) => pts.map((v, i) => (i % 2 ? by - v * s : cx + v * s));
  m.poly(P([-5.6, 0, -4.4, 14, -4.6, 28, -6, 37, -4, 40, -1.6, 41, 1.6, 41, 4, 40, 6, 37, 4.6, 28, 4.4, 14, 5.6, 0])); // 衣 (肩から裾へ)
  m.rect(cx - 1.2 * s, by - 44 * s, 2.4 * s, 4 * s);                                  // 首
  const hx = cx + (pose === 3 ? 1.2 * s : 0), hy = by - (pose === 3 ? 44 : 46.5) * s;
  m.ellipse(hx, hy, 3.2 * s, 3.9 * s);                                                  // 頭
  if (face) face.ellipse(hx + 0.5 * s, hy + 0.5 * s, 2.2 * s, 2.8 * s);
  const arm = (x0, y0, x1, y1) => m.line(cx + x0 * s, by - y0 * s, cx + x1 * s, by - y1 * s, 2.2 * s, 1, 1.8 * s);
  if (pose === 0) { arm(-6, 37, -5, 27); arm(6, 37, 5, 27); m.poly(P([-5.4, 29, 5.4, 26, 5.4, 23.6, -5.4, 26.6])); }   // 胸の前で腕を組む
  if (pose === 1 || pose === 3) { arm(-6, 37, -7.4, 20); arm(6, 37, 7.4, 20); }                                  // 腕を下ろす
  if (pose === 2) { arm(-6, 37, -7.4, 20); arm(6, 37, 7.6, 30); arm(7.6, 30, 4.4, 42); if (face) face.ellipse(cx + 4 * s, by - 43 * s, 1.4 * s, 1.6 * s); } // 片手を顔へ
}
function sceneFrozen() {
  const W = ART_W, H = ART_H, L = new Layer(W, H);
  const VX = 96, HZ = 46;
  const lights = [
    { x: VX, y: HZ - 6, r: 110, c: C_ICE, k: 1.0, p: 1.3 },       // 回廊の奥の青白い光
    { x: VX, y: 124, r: 110, c: [0.9, 0.8, 0.66], k: 0.45, p: 1.4 }, // 手元のランタン (下から)
    { x: 20, y: -10, r: 120, c: C_ICE, k: 0.5, p: 1.2 },
  ];
  // 奥の氷の壁と天井 (消失点ほど明るい)
  L.shade(0, 0, W - 1, HZ + 3, (x, y) => {
    const w = worley(x * 0.07, y * 0.1, 221), d = Math.hypot((x - VX) / 90, (y - HZ) / 50);
    const alb = mix([30, 56, 90], [120, 170, 206], clamp(w[2] * 0.4 + (1 - d) * 0.6));
    const c = lit(w[1] - w[0] < 0.04 ? mix(alb, [200, 230, 246], 0.5) : alb, lightAt(x, y, lights, Math.cos(w[2] * 6.28) * 0.6, 0), [0.12, 0.16, 0.24]);
    return mulc(c, 0.55 + 0.45 * clamp(1 - d));
  });
  // 床: 鏡のような氷。奥へすぼまる継ぎ目
  L.shade(0, HZ + 4, W - 1, H - 1, (x, y) => {
    const t = (y - HZ) / (H - HZ), z = 50 / Math.max(1, y - HZ);
    const seam = Math.abs(((x - VX) * z * 0.12) % 2) < 0.08 * (1 + t) || Math.abs((z * 1.4) % 2) < 0.06;
    const l = lightAt(x, y, lights, 0, -0.9);
    const a = seam ? [40, 70, 100] : mix([70, 110, 146], [36, 64, 96], t);
    return lit(a, l, [0.1, 0.14, 0.2]);
  });
  glow(L, VX, HZ - 4, 40, C_ICE, 0.35, 2.2);
  // 氷柱 (奥から手前へ)。右手前から二本目だけが空
  const list = [];
  const zs = [5.6, 4, 2.8, 2, 1.4, 1];
  zs.forEach((z, i) => { list.push({ s: -1, z, i: i * 2 }); list.push({ s: 1, z: z * 1.04, i: i * 2 + 1 }); });
  list.sort((a, b) => b.z - a.z);
  for (const { s: side, z, i } of list) {
    const cx = VX + side * 70 / z, by = HZ + 50 / z, h = 92 / z, hw = 10.5 / z;
    const empty = side === 1 && zs.indexOf(z / 1.04) === 4;
    const col = new Mask(W, H);
    for (let y = Math.floor(by - h); y <= by; y++) { const j = vnoise(1, y * 0.3 * z, i) * 1.4 / z; col.rect(cx - hw - j, y, hw * 2 + j * 2, 1); }
    col.ellipse(cx, by, hw * 1.5, 2.6 / z);
    const fig = new Mask(W, H), face = new Mask(W, H);
    frozenFigure(fig, cx, by - 2 / z, 1.02 / z, empty ? 1 : (i * 7 + 3) % 4, empty ? null : face);
    const fade = 0.55 + 0.45 / Math.sqrt(z);
    // 透ける氷の柱: 左の縁が明るく、縦の筋。中の人影は青く沈む
    L.paint(col, (x, y) => {
      const u = (x + 0.5 - (cx - hw)) / (hw * 2);
      const l = lightAt(x, y, lights, (u - 0.5) * -1.4, 0);
      let a = mix([90, 140, 182], [170, 212, 236], clamp(0.5 + (0.5 - u) * 0.7 + vnoise(x * 0.5 * z, y * 0.06 * z, i) * 0.3));
      if (fig.at(x, y)) {
        if (empty) a = fig.edge(x, y) ? [214, 238, 250] : mix(a, [40, 70, 104], 0.55);     // 人の形に抜けた空洞
        else if (face.at(x, y)) a = mix(a, [214, 226, 238], 0.7);                             // 青ざめた顔と手
        else a = mix(a, [16, 26, 50], 0.7);                                                    // 閉じ込められた人影
      }
      if (Math.abs(u - 0.28) < 0.06 || u < 0.06) a = mix(a, [230, 246, 255], 0.45);           // 縦のハイライト
      return mulc(lit(a, l, [0.22, 0.28, 0.36]), fade);
    });
    if (empty) {                                                                               // 空洞から走るひび
      const cr = new Mask(W, H), R = rng(229);
      for (let k = 0; k < 5; k++) { const a0 = R() * 6.28, x0 = cx + Math.cos(a0) * 3 / z, y0 = by - 24 / z + Math.sin(a0) * 12 / z; cr.line(x0, y0, x0 + Math.cos(a0) * 7 / z, y0 + Math.sin(a0) * 7 / z, 0.8); }
      L.paint(cr, () => [220, 240, 250]);
    }
    reflect(L, col, by + 2.6 / z, { k: 0.4, tint: [14, 26, 42], wob: 0.8 + 0.6 / z, y1: Math.min(H - 1, by + h * 0.5) });
  }
  // 天井のつらら (手前ほど長い)
  const cic = new Mask(W, H), R = rng(231);
  for (let i = 0; i < 70; i++) { const x = R() * W, near = Math.abs(x - VX) / VX; icicle(cic, x, -1, 3 + near * 14 + R() * 8 * near, 1.5 + near * 3); }
  paintIce(L, cic, lights, 233, { deep: [70, 110, 150], pale: [190, 226, 244], sx: 0.4, sy: 0.1 });
  snow(L, 50, 235, { col: [220, 238, 250], a: 0.55 });
  motes(L, lights, 40, 237, [0.8, 0.92, 1.0]);
  vignette(L, 0.84);
  return L.canvas(12, ICE_PAL);
}

// 27. 極光の書きつけ (氷窟の天井に揺らめく極光。光の中に魂の粒。手前の氷の床に、師の書きつけ)
function auroraAt(x, y) {
  let r = 0, g = 0, b = 0;
  for (const [y0, amp, fr, ph, k] of [[48, 9, 0.042, 0.4, 1.0], [30, 7, 0.058, 2.3, 0.8], [62, 5, 0.07, 4.1, 0.5]]) {
    const base = y0 + Math.sin(x * fr + ph) * amp + Math.sin(x * fr * 2.7 + ph * 1.7) * amp * 0.35;
    const d = base - y;
    if (d < -3) continue;
    const ray = 0.45 + 0.55 * Math.pow(vnoise(x * 0.42 + ph * 3, ph, 7), 1.5);
    const f = (d < 0 ? 1 + d / 3 : Math.exp(-d / 18)) * ray * k;
    const col = d < 4 ? mix([80, 255, 160], [60, 230, 200], d / 4) : d < 12 ? mix([60, 230, 200], [70, 140, 255], (d - 4) / 8) : mix([70, 140, 255], [150, 90, 230], clamp((d - 12) / 12));
    r += col[0] * f; g += col[1] * f; b += col[2] * f;
  }
  return [r, g, b];
}
function sceneAurora() {
  const W = ART_W, H = ART_H, L = new Layer(W, H);
  const FY = 76;                                                     // 床の奥の縁
  const lights = [
    { x: 96, y: 40, r: 170, c: [0.35, 1.0, 0.72], k: 0.8, p: 1.2 },   // 極光の緑
    { x: 34, y: 22, r: 120, c: [0.62, 0.42, 1.0], k: 0.55, p: 1.2 },  // 紫
    { x: 160, y: 28, r: 120, c: [0.38, 0.6, 1.0], k: 0.6, p: 1.2 },   // 青
  ];
  // 氷窟の天井 (切子の氷。奥に極光が透ける)
  const vault = new Mask(W, H); vault.rect(0, 0, W, FY);
  paintIce(L, vault, lights, 241, { deep: [10, 18, 34], pale: [46, 70, 100], sx: 0.06, sy: 0.09, amb: [0.08, 0.1, 0.16], ridgeK: 0.25 });
  L.shade(0, 0, W - 1, FY - 1, (x, y) => { const a = auroraAt(x, y); L.add(x, y, a, 0.85); return null; });
  // 両側の氷の壁 (天井から床へ落ちる太い柱。極光を背に暗い)
  const walls = new Mask(W, H);
  for (let y = 0; y < H; y++) { const t = y / H; walls.rect(0, y, 20 + t * t * 18 + vnoise(1, y * 0.15, 3) * 5, 1); const e = 24 + t * t * 16 + vnoise(2, y * 0.15, 5) * 5; walls.rect(W - e, y, e, 1); }
  paintIce(L, walls, lights, 243, { deep: [12, 20, 36], pale: [50, 76, 108], sx: 0.14, sy: 0.07 });
  rimLight(L, walls, lights, [40, 90, 90], 0.35);
  // 床: 極光を映す氷 (行ごとに揺らして、ところどころ途切れる)
  L.shade(0, FY, W - 1, H - 1, (x, y) => {
    if (walls.at(x, y)) return null;
    const d = y - FY, sy = FY - 1 - Math.round(d * 1.5), sh = Math.round(Math.sin(y * 1.3) * 1.5);
    const src = L.get(x - sh, Math.max(0, sy)) || [0, 0, 0];
    const w = worley(x * 0.06, y * 0.2, 247), seam = w[1] - w[0] < 0.05;
    const k = (Math.sin(y * 2.1) > 0.75 ? 0.15 : 0.5) * (1 - d / 50);
    return seam ? [60, 86, 110] : [14 + src[0] * k, 22 + src[1] * k, 34 + src[2] * k];
  });
  for (let x = 0; x < W; x++) if (!walls.at(x, FY)) L.add(x, FY, [60, 110, 120], 0.6);
  // 極光の中に浮かぶ魂の粒
  const R = rng(249);
  for (let i = 0; i < 70; i++) {
    const x = R() * W, y = R() * (FY - 6), a = auroraAt(x, y), s = (a[0] + a[1] + a[2]) / 3;
    if (s < 50 || walls.at(x | 0, y | 0)) continue;
    L.px(x, y, [230, 255, 244]); if (R() < 0.4) { L.add(x + 1, y, [80, 160, 140], 0.8); L.add(x - 1, y, [80, 160, 140], 0.8); L.add(x, y - 1, [80, 160, 140], 0.6); }
  }
  // 師の書きつけ (床に置かれ、隅を氷のかけらで押さえてある)
  const note = new Mask(W, H); note.poly([76, 87, 116, 84, 121, 100, 72, 103]);
  L.paint(note, (x, y) => {
    const l = lightAt(x, y, lights, 0, -0.9);
    const u = (x - 74) / 46, v = (y - 86) / 16;
    const ink = v > 0.14 && v < 0.86 && Math.round(y + u * 3) % 3 === 0 && u > 0.08 && u < 0.86 && h2(x >> 1, y, 251) > 0.25 && h2(x, y, 252) > 0.3;
    const a = ink ? [60, 44, 46] : mix(ALB_PAPER, [236, 228, 200], v * 0.4);
    return lit(a, l, [0.5, 0.5, 0.52]);
  });
  const shard = new Mask(W, H); shard.poly([112, 83, 118, 80, 122, 85, 117, 88]);
  paintIce(L, shard, lights, 253, { deep: [90, 140, 170], pale: [200, 236, 248], sx: 0.5, sy: 0.5 });
  const stub = new Mask(W, H); stub.line(124, 98, 134, 95, 1.6);
  L.paint(stub, () => [36, 32, 34]);
  glow(L, 96, 93, 26, [0.4, 1.0, 0.75], 0.1, 2);
  motes(L, lights, 40, 255, [0.6, 1.0, 0.85]);
  vignette(L, 0.82);
  return L.canvas(12, ICE_PAL);
}

// 28. 凍王の記憶 (氷の玉座に座る、氷の冠の老いた操霊師。その前に、脚を氷で固めた師オルドが背を向けて立つ)
function sceneFrostKing() {
  const W = ART_W, H = ART_H, L = new Layer(W, H);
  const KX = 130, KY = 32;                                            // 凍王の頭
  const lights = [
    { x: KX, y: -20, r: 150, c: C_ICE, k: 1.15, p: 1.2 },            // 上から射す冷たい光
    { x: KX, y: 22, r: 40, c: [0.8, 0.95, 1.0], k: 0.25, p: 1.4 },   // 氷の冠の照り
    { x: 0, y: 30, r: 120, c: C_ICE, k: 0.4, p: 1.2 },
  ];
  // 氷の広間の奥 (縦に流れる氷の壁。玉座の後ろほど明るい)
  L.shade(0, 0, W - 1, 84, (x, y) => {
    const s = vnoise(x * 0.35, y * 0.03, 261), w = worley(x * 0.12, y * 0.05, 263);
    const alb = mix([28, 46, 72], [86, 124, 160], s * 0.6 + w[2] * 0.3);
    const c = lit(w[1] - w[0] < 0.035 ? mix(alb, [170, 210, 236], 0.35) : alb, lightAt(x, y, lights, 0, 0.2), [0.12, 0.15, 0.2]);
    return c;
  });
  for (let x = 0; x < W; x++) { const top = 84 - 3 * vnoise(x * 0.2, 1, 7); for (let y = Math.floor(top); y < 86; y++) L.px(x, y, lit([60, 86, 112], lightAt(x, y, lights), [0.1, 0.12, 0.16])); }
  // 床 (磨かれた氷。玉座の光を映す)
  L.shade(0, 86, W - 1, H - 1, (x, y) => {
    const w = worley(x * 0.07, y * 0.24, 265);
    const ref = Math.abs(x - KX) < 22 - (y - 86) * 0.3 && Math.sin(y * 1.7) > -0.3;
    const a = w[1] - w[0] < 0.05 ? [40, 60, 84] : mix([90, 124, 156], [124, 160, 192], w[2] * 0.5);
    return lit(ref ? mix(a, [200, 230, 246], 0.3) : a, lightAt(x, y, lights, 0, -0.9), [0.1, 0.12, 0.16]);
  });
  // 玉座 (三段の氷の段の上。背は尖った氷の板、左右に肘掛け)
  const steps = new Mask(W, H);
  for (let k = 0; k < 3; k++) steps.rect(KX - 30 - k * 8, 70 + k * 6, 60 + k * 16, 6);
  paintIce(L, steps, lights, 267, { deep: [70, 104, 136], pale: [170, 206, 230], sx: 0.2, sy: 0.3, amb: [0.2, 0.24, 0.3] });
  for (let k = 0; k < 3; k++) for (let x = KX - 30 - k * 8; x < KX + 30 + k * 8; x++) L.add(x, 70 + k * 6, [70, 80, 90], 0.9);
  const back = new Mask(W, H);
  back.poly([KX - 18, 62, KX - 20, 22, KX - 15, 10, KX - 11, 16, KX - 6, 2, KX - 2, 12, KX + 2, 0, KX + 6, 12, KX + 11, 4, KX + 15, 14, KX + 20, 22, KX + 18, 62]);
  paintIce(L, back, lights, 269, { deep: [96, 136, 170], pale: [200, 232, 246], sx: 0.22, sy: 0.12, amb: [0.24, 0.28, 0.36] });
  const seat = new Mask(W, H); seat.rect(KX - 24, 54, 48, 16); seat.rect(KX - 27, 50, 8, 6); seat.rect(KX + 19, 50, 8, 6);
  paintIce(L, seat, lights, 271, { deep: [100, 146, 186], pale: [200, 232, 248], sx: 0.25, sy: 0.25, amb: [0.3, 0.36, 0.44] });
  // 凍王 (白いひげ・青灰の衣。肘掛けに手を置いて坐る)
  const robe = new Mask(W, H);
  robe.poly([KX - 8, 38, KX + 8, 38, KX + 11, 50, KX + 13, 60, KX + 12, 70, KX - 12, 70, KX - 13, 60, KX - 11, 50]);
  robe.line(KX - 8, 40, KX - 19, 50, 4.4, 1, 3.6); robe.line(KX + 8, 40, KX + 19, 50, 4.4, 1, 3.6);
  paintLit(L, robe, (x, y) => (Math.abs(x - KX) < 1 && y > 52 ? [200, 206, 220] : mix([96, 86, 112], [62, 54, 76], vnoise(x * 0.5, y * 0.3, 5) * 0.6 + (Math.sin(x * 1.1) * 0.5 + 0.5) * 0.4)), lights, { nxMax: 8, amb: [0.3, 0.3, 0.36] });
  rimLight(L, robe, lights, [200, 230, 250], 1.0);
  const hands = new Mask(W, H); hands.ellipse(KX - 21, 51, 2.2, 1.7); hands.ellipse(KX + 21, 51, 2.2, 1.7);
  paintLit(L, hands, () => [220, 212, 210], lights, { amb: [0.4, 0.4, 0.44] });
  for (const s of [-1, 1]) for (let f = 0; f < 4; f++) L.px(KX + s * (20 + f) - (s < 0 ? 1 : 0), 52.6, [140, 140, 152]);   // 肘掛けを掴む指 (四本の指先。親指は内側に隠れる)
  const head = new Mask(W, H); head.ellipse(KX, KY, 5, 6);
  paintLit(L, head, (x, y) => {
    if (y === KY - 1 && (x === KX - 2 || x === KX + 2)) return [26, 34, 50];          // 落ちくぼんだ目
    if (y === KY - 3 && Math.abs(x - KX) >= 1 && Math.abs(x - KX) <= 3) return [236, 236, 240]; // 白い眉
    return [220, 206, 198];
  }, lights, { nxMax: 4, amb: [0.36, 0.36, 0.4] });
  const beard = new Mask(W, H); beard.poly([KX - 5, KY + 2, KX + 5, KY + 2, KX + 4, KY + 12, KX, KY + 18, KX - 4, KY + 12]);
  paintLit(L, beard, (x, y) => mix([240, 244, 248], [176, 186, 198], ((x * 2 + y) % 4) / 4), lights, { amb: [0.3, 0.32, 0.36] });
  const crown = new Mask(W, H); crown.rect(KX - 6, KY - 6, 12, 2);
  for (let k = 0; k < 5; k++) crown.poly([KX - 6 + k * 2.6, KY - 5, KX - 4.8 + k * 2.6, KY - 12 - (k === 2 ? 4 : k % 2 ? 0 : 2), KX - 3.6 + k * 2.6, KY - 5]);
  L.paint(crown, (x, y) => (x < KX ? [226, 246, 255] : [150, 204, 232]));
  glow(L, KX, KY - 10, 12, [0.7, 0.92, 1.0], 0.15, 2);
  // 師オルド (手前左。背を向け、玉座へ横顔をのぞかせる。暗い外套に控えめな金の刺しゅう。両脚は氷で固めてある)
  const OX = 60, OB = 106;
  const cloak = new Mask(W, H);
  cloak.poly([OX - 16, OB - 16, OX - 13, OB - 42, OX - 10, OB - 54, OX - 5, OB - 58, OX + 6, OB - 58, OX + 11, OB - 52, OX + 14, OB - 42, OX + 17, OB - 18, OX + 13, OB - 15, OX + 4, OB - 17, OX - 6, OB - 15]);
  const legs = new Mask(W, H); legs.rect(OX - 7, OB - 18, 5, 15); legs.rect(OX + 3, OB - 18, 5, 15); legs.rect(OX - 9, OB - 3, 7, 3); legs.rect(OX + 3, OB - 3, 7, 3);
  paintLit(L, legs, () => [40, 34, 38], lights, { amb: [0.08, 0.08, 0.1] });
  paintLit(L, cloak, (x, y) => {
    if (!cloak.at(x, y + 1) || !cloak.at(x, y + 2)) return h2(x, y, 273) > 0.3 ? ALB_EMBROID : ALB_COAT_D;   // 裾の金の刺しゅう
    if (Math.abs(x - OX) < 0.8 && y > OB - 52) return ALB_COAT_D;                       // 背の縫い目
    return mix(ALB_COAT, ALB_COAT_D, (Math.sin(x * 0.7 + y * 0.1) * 0.5 + 0.5) * 0.7);
  }, lights, { nxMax: 8, ny: (x, y) => vNormal(cloak, x, y, 4) * 0.3, amb: [0.1, 0.1, 0.13] });
  const hair = new Mask(W, H); hair.ellipse(OX, OB - 63, 6, 6.6);
  paintLit(L, hair, () => [50, 42, 40], lights, { nxMax: 4, amb: [0.08, 0.08, 0.1] });
  const cheek = new Mask(W, H); cheek.poly([OX + 3, OB - 66, OX + 6, OB - 65, OX + 7.6, OB - 62, OX + 7, OB - 59, OX + 3, OB - 57]);   // 玉座へ向けた横顔の頬
  paintLit(L, cheek, (x, y) => (x >= OX + 7 && y === OB - 62 ? [180, 150, 136] : [214, 184, 164]), lights, { amb: [0.42, 0.4, 0.42] });
  // 脚を固めた氷 (脛を包む不揃いな氷のかけら。中の脚が透ける)
  const cast = new Mask(W, H);
  cast.poly([OX - 9, OB - 14, OX - 5, OB - 16, OX - 1, OB - 13, OX - 1, OB - 6, OX - 4, OB - 3, OX - 9, OB - 5]);
  cast.poly([OX + 2, OB - 13, OX + 6, OB - 16, OX + 10, OB - 14, OX + 10, OB - 5, OX + 6, OB - 3, OX + 2, OB - 6]);
  L.paint(cast, (x, y) => {
    const w = worley(x * 0.5, y * 0.4, 275), hi = !cast.at(x - 1, y) || !cast.at(x, y - 1);
    return hi || w[1] - w[0] < 0.08 ? [214, 238, 252, 0.9] : [130, 184, 220, 0.45];
  });
  rimLight(L, cloak, lights, [150, 206, 240], 0.7);
  // 師が杖にする折れた槍 (右手で突く)
  const staff = new Mask(W, H); staff.line(OX + 16, OB - 54, OX + 22, OB + 2, 1.6);
  paintLit(L, staff, () => [150, 124, 96], lights, { amb: [0.34, 0.3, 0.3] });
  const hand = new Mask(W, H); hand.ellipse(OX + 17, OB - 42, 2.2, 2.4);
  paintLit(L, hand, () => [206, 176, 156], lights, { amb: [0.42, 0.4, 0.42] });
  snow(L, 50, 277, { col: [220, 236, 248], a: 0.45 });
  memoryTint(L, [32, 44, 58], [27, 81]);
  motes(L, lights, 40, 279, [0.8, 0.92, 1.0]);
  return L.canvas(10, ICE_PAL);
}

// ======================= 第七章「毒沼」 =======================
// 奈落の底の毒の沼 (底まで落ちて腐った魂が、泥と毒の霧になる)。共通のパレットには濁った緑と枯れ葦の黄土が
// 乏しいので、沼の緑 (R_BOG)・枯れ葦 (R_REED)・濁り水の青緑 (R_MURK) を足したパレット (SWAMP_PAL) で量子化する
const R_BOG = ramp(["#050804", "#080d06", "#0c1309", "#111a0c", "#172310", "#1e2d14", "#273a18", "#30481c", "#3c5820",
  "#4a6a24", "#5c7e2a", "#729434", "#8cab42", "#a8c456", "#c8dc78", "#e6f0a8"]);
const R_REED = ramp(["#16120a", "#241c10", "#342816", "#46361e", "#5a4628", "#705834", "#8a6e44", "#a48a58", "#c0a670"]);
const R_MURK = ramp(["#0a1414", "#122020", "#1a2e2c", "#26403c", "#38564e", "#507066", "#6e8e82", "#94b0a2", "#b8ccc8", "#dce8e6"]);
export const SWAMP_PAL = new Palette([...PAL.cols, ...R_BOG, ...R_REED, ...R_MURK]);
const C_MIASMA = [0.62, 0.86, 0.3];                       // 毒の霧の淡い光
const C_FALL = [0.62, 0.82, 0.8];                         // 雪解けの滝の白い光
const ALB_MUD = [62, 54, 36], ALB_MUD_D = [34, 32, 22], ALB_REED = [150, 128, 80], ALB_REED_D = [92, 76, 46];
// 毒の霧: 横に流れる帯 (y の中心・厚み)。fbm でちぎれる
function miasma(L, y, hgt, col, a, seed, { sx = 0.03, x0 = 0, x1 = ART_W } = {}) {
  for (let yy = Math.floor(y - hgt / 2); yy < y + hgt / 2; yy++) {
    if (yy < 0 || yy >= L.h) continue;
    const p = 1 - Math.abs(yy + 0.5 - y) / (hgt / 2);
    for (let x = Math.max(0, x0 | 0); x < Math.min(L.w, x1); x++) {
      const k = a * p * p * clamp(fbm(x * sx, yy * 0.18, seed) * 1.6 - 0.35);
      if (k > 0.01) L.px(x, yy, col, Math.min(1, k));
    }
  }
}
// 葦の一本 (根元 (x,by) から高さ h。lean = 先端の横ずれ)。穂 (蒲の穂) と折れた葉を付ける
function reedStalk(L, lights, x, by, h, lean, seed, { amb = [0.1, 0.1, 0.08], k = 1, head = 0.35 } = {}) {
  const R = rng(seed);
  const at = (t) => [x + lean * t * t, by - h * t];
  for (let i = 0; i <= h; i++) {
    const t = i / h, [px, py] = at(t);
    const alb = mulc(mix(ALB_REED_D, ALB_REED, clamp(0.3 + t * 0.6 + (h2(px | 0, py | 0, seed) - 0.5) * 0.3)), k);
    L.px(px, py, lit(alb, lightAt(px, py, lights, lean > 0 ? -0.6 : 0.6, 0), amb));
    if (t < 0.25 && h > 26) L.px(px + 1, py, lit(mulc(ALB_REED_D, k * 0.8), lightAt(px, py, lights), amb));
  }
  // 折れて垂れた葉
  for (let n = 0; n < 2; n++) {
    if (R() > 0.7) continue;
    const t0 = 0.3 + R() * 0.5, [px, py] = at(t0), d = R() < 0.5 ? -1 : 1, len = 4 + R() * h * 0.25;
    for (let j = 0; j < len; j++) { const u = j / len; L.px(px + d * j * 0.8, py + u * u * len * 0.7, lit(mulc(ALB_REED_D, k * 0.9), lightAt(px, py, lights), amb)); }
  }
  if (R() < head) { const [px, py] = at(0.86); for (let j = 0; j < 5; j++) { L.px(px, py + j - 2, lit(mulc([96, 58, 34], k), lightAt(px, py, lights, -0.5, 0), amb)); L.px(px + 1, py + j - 2, lit(mulc([70, 42, 26], k), lightAt(px, py, lights), amb)); } }
}
// 沼の水面 (y0 から y1)。暗い緑の水に、浮き草の点と、ゆっくりとした波の筋。glowFn(x,y) = 光の映り込み
function bogWater(L, lights, y0, y1, seed, { glowFn = null } = {}) {
  L.shade(0, y0, L.w - 1, y1, (x, y) => {
    const t = (y - y0) / Math.max(1, y1 - y0);
    const n = fbm(x * 0.05 / (0.4 + t), y * 0.4, seed);
    let alb = mix([16, 26, 18], [30, 42, 28], n);
    if (Math.sin(y * 1.7 + vnoise(x * 0.04, y * 0.2, seed) * 5) > 0.86) alb = mix(alb, [70, 88, 60], 0.5);       // 波の筋
    if (vnoise(x * 0.3 * (1.5 - t), y * 0.9, seed + 3) > 0.8) alb = mix([60, 90, 30], [110, 140, 50], n);         // 浮き草
    const c = lit(alb, lightAt(x, y, lights, 0, -0.9), [0.12, 0.14, 0.1]);
    if (glowFn) { const g = glowFn(x, y); if (g) { c[0] += g[0]; c[1] += g[1]; c[2] += g[2]; } }
    return c;
  });
}
// 沼から昇る泡 (縁が明るい小さな輪)
function bubbles(L, n, seed, x0, x1, y0, y1, col = [170, 210, 110]) {
  const R = rng(seed);
  for (let i = 0; i < n; i++) {
    const x = x0 + R() * (x1 - x0), y = y0 + R() * (y1 - y0);
    if (R() < 0.5) { L.px(x, y, col, 0.8); L.add(x, y - 1, [40, 60, 20], 0.6); }
    else { L.px(x - 1, y, col, 0.7); L.px(x + 1, y, col, 0.7); L.px(x, y - 1, col, 0.9); L.px(x, y + 1, mulc(col, 0.6), 0.6); }
  }
}
// 灯を掌に載せた手 (一門の印)。(cx,cy) = 掌の中心、s = 大きさ (s=2 で幅およそ 20 ドット)。hand に掌と指、flame に灯
function crestMask(hand, flame, cx, cy, s) {
  const P = (pts) => pts.map((v, i) => (i % 2 ? cy + v * s : cx + v * s));
  hand.poly(P([-4.4, -0.4, 4.6, -0.4, 3.4, 1.8, 1.4, 3.0, -1.4, 3.0, -3.4, 1.8]));          // 上に向けて丸めた掌
  hand.poly(P([-1.3, 2.6, 1.3, 2.6, 1.1, 5.4, -1.1, 5.4]));                                   // 手首
  const fw = Math.max(1, 0.85 * s);
  for (const [x0, x1, y1] of [[1.2, 1.2, -3.2], [2.3, 2.7, -3.8], [3.4, 4.1, -3.4], [4.4, 5.4, -2.4]]) hand.line(cx + x0 * s, cy, cx + x1 * s, cy + y1 * s, fw); // 四本の指 (右で扇に開く)
  hand.line(cx - 3.8 * s, cy, cx - 5 * s, cy - 2.4 * s, Math.max(1, 1 * s));                 // 親指
  flame.poly(P([-2, -0.6, 0.2, -0.6, 0, -2.6, -0.9, -5.8, -1.8, -2.8]));                     // 掌に載せた灯
}

// 29. 師の添え木 (奈落の底の沼の岸。上の闇から雪解けの滝が落ちる。手前の泥に、溶けかけた氷の添え木のかけらと、
//     縄で束ねた人業の腕の木が二本。結び目に師の書きつけ。片脚を引きずる足跡が葦の奥 (谷のほう) へ続く)
function sceneSplint() {
  const W = ART_W, H = ART_H, L = new Layer(W, H);
  const FX = 58, SY = 60;                                              // 滝の位置・沼の奥の水際
  const lights = [
    { x: 34, y: 74, r: 130, c: C_CANDLE, k: 1.35, p: 1.4 },           // 手元のランタン (画面の外・左手前。かざして照らす)
    { x: FX, y: SY - 4, r: 90, c: C_FALL, k: 0.7, p: 1.3 },            // 滝の白い光
    { x: 150, y: 66, r: 70, c: C_MIASMA, k: 0.6, p: 1.4 },             // 奥の毒溜まりの光
    { x: 96, y: -20, r: 90, c: C_FALL, k: 0.3, p: 1.2 },
    { x: 194, y: 84, r: 100, c: C_MIASMA, k: 0.95, p: 1.3 },            // 右手前の葦の陰の毒溜まり
  ];
  // 奥: 奈落の底の岩壁 (霧に沈む。上ほど闇)
  L.shade(0, 0, W - 1, SY, (x, y) => {
    const t = y / SY, w = worley(x * 0.06, y * 0.05, 301), f = fbm(x * 0.05, y * 0.07, 303);
    const alb = mix([20, 26, 22], [44, 52, 40], w[2] * 0.5 + f * 0.5);
    const c = lit(w[1] - w[0] < 0.025 ? mulc(alb, 0.7) : alb, lightAt(x, y, lights, Math.cos(w[2] * 6.28) * 0.5, 0), [0.1, 0.12, 0.1]);
    return mulc(c, 0.35 + 0.65 * t);
  });
  // 雪解けの滝 (上の闇から落ちる。白い筋が下ほど広がり、水際で白いしぶき)
  const fall = new Mask(W, H);
  for (let y = 0; y <= SY; y++) { const t = y / SY, hw = 3 + t * 5 + Math.sin(y * 0.2) * 0.6; fall.rect(FX - hw + t * 2, y, hw * 2, 1); }
  // 滝の落ち口: はるか上の氷の棚の縁 (解けかけた氷の牙が垂れる)
  const lip = new Mask(W, H); lip.poly([FX - 16, 0, FX + 18, 0, FX + 14, 3, FX - 12, 4]);
  for (const [dx, len] of [[-12, 6], [-8, 10], [-4, 5], [9, 8], [13, 4]]) icicle(lip, FX + dx, 2, len, 2.2);
  L.paint(lip, (x, y) => lit(mix([90, 120, 120], [200, 220, 218], vnoise(x * 0.5, y, 5)), lightAt(x, y, lights), [0.2, 0.24, 0.24]));
  L.paint(fall, (x, y) => {
    const s = vnoise(x * 0.9, y * 0.08 - x * 0.1, 307);
    return lit(mix([120, 150, 150], [226, 238, 236], s), lightAt(x, y, lights), [0.3, 0.34, 0.34]);
  });
  glow(L, FX + 2, SY - 2, 26, C_FALL, 0.35, 2);
  // 遠くにもう一筋 (細い滝)
  const fall2 = new Mask(W, H); for (let y = 0; y <= SY - 2; y++) fall2.rect(166 + y * 0.04, y, 1.4 + y / SY, 1);
  L.paint(fall2, (x, y) => mix([50, 62, 60], [120, 140, 136], vnoise(x, y * 0.1, 309)));
  // 向こう岸の枯れ木と葦の影
  for (const [x, h, lean] of [[18, 34, -2], [104, 24, 3], [130, 40, -4], [182, 30, 2]]) {
    const t = new Mask(W, H); t.line(x, SY + 1, x + lean, SY - h, 2.6, 1, 1.2);
    t.line(x + lean * 0.6, SY - h * 0.6, x + lean * 0.6 + 8 * Math.sign(lean || 1), SY - h * 0.85, 1.4, 1, 1);
    t.line(x + lean * 0.4, SY - h * 0.45, x + lean * 0.4 - 6 * Math.sign(lean || 1), SY - h * 0.6, 1.2, 1, 1);
    L.paint(t, () => [18, 22, 16]);
  }
  for (let i = 0; i < 46; i++) { const x = h2(i, 1, 311) * W; if (Math.abs(x - FX) < 12) continue; const h = 4 + h2(i, 2, 311) * 9; for (let j = 0; j < h; j++) L.px(x + j * 0.1, SY - j, [26, 30, 20]); }
  // 沼 (奥の水際から手前の岸まで)。滝と毒溜まりが映る
  bogWater(L, lights, SY, 84, 313, {
    glowFn: (x, y) => {
      const r = Math.abs(x - FX - 3 + Math.sin(y * 1.3) * 1.5) < 5 - (y - SY) * 0.1 && Math.sin(y * 2.3) > -0.2 ? 60 * (1 - (y - SY) / 26) : 0;
      return r > 0 ? [r * 0.7, r * 0.85, r * 0.85] : null;
    },
  });
  // 奥の毒溜まり (自ら淡く光る)
  for (const [x, y, rx, ry] of [[150, 66, 16, 2.6], [176, 72, 10, 1.8]]) {
    const p = new Mask(W, H); p.ellipse(x, y, rx, ry);
    L.paint(p, (xx, yy) => rc(R_BOG, clamp(0.55 + (1 - Math.hypot((xx - x) / rx, (yy - y) / ry)) * 0.35 + vnoise(xx * 0.3, yy, 5) * 0.1)));
    glow(L, x, y - 1, rx * 1.6, C_MIASMA, 0.18, 2);
  }
  bubbles(L, 18, 315, 130, 190, 62, 80);
  // 手前の岸 (黒い泥。濡れて光り、ところどころ水が溜まる)
  const shoreY = (x) => 80 + Math.sin(x * 0.07) * 2 + vnoise(x * 0.1, 1, 317) * 3 - (x > 150 ? (x - 150) * 0.08 : 0);
  const mud = new Mask(W, H);
  for (let x = 0; x < W; x++) mud.rect(x, shoreY(x), 1, H);
  paintLit(L, mud, (x, y) => {
    const n = fbm(x * 0.09, y * 0.2, 319), wet = vnoise(x * 0.12, y * 0.3, 321) > 0.72;
    if (y - shoreY(x) < 1.2) return [70, 84, 56];                                        // 水際のぬめり
    return wet ? mix([24, 30, 24], [44, 52, 40], n) : mix(ALB_MUD_D, ALB_MUD, n);
  }, lights, { ny: () => -0.85, amb: [0.14, 0.14, 0.1] });
  // 足跡: 右足の靴跡と、引きずった左脚の筋。杖の穴が並び、葦の奥 (右) へ続く
  const prints = new Mask(W, H);
  for (let k = 0; k < 4; k++) {
    const x = 132 + k * 13, y = 100 - k * 4.6;
    prints.ellipse(x, y, 2.6 - k * 0.3, 1.2 - k * 0.12);
    prints.line(x - 7 - k, y + 2.6, x + 6, y + 1.2 - k * 0.1, 1.4 - k * 0.15);               // 引きずる脚の筋
    prints.ellipse(x + 5, y - 4.4, 0.8, 0.6);                                                 // 杖の穴
  }
  L.paint(prints, (x, y) => lit(prints.at(x, y - 1) ? [14, 14, 10] : [30, 32, 22], lightAt(x, y, lights), [0.1, 0.1, 0.08]));
  for (let y = 0; y < H; y++) for (let x = 120; x < W; x++) if (prints.at(x, y) && !prints.at(x, y + 1)) L.add(x, y + 1, [90, 104, 50], 1);   // 足跡の縁の照り (毒溜まりの光を受ける)
  // 溶けかけた氷の添え木 (凍王が固めた、脚の形に削られた氷。割れて散らばり、半ば溶けて水溜まりになっている)
  const pud = new Mask(W, H); pud.ellipse(52, 96, 26, 5);
  L.paint(pud, (x, y) => lit(mix([22, 34, 32], [44, 60, 56], vnoise(x * 0.2, y, 7)), lightAt(x, y, lights, 0, -0.9), [0.16, 0.2, 0.2]));
  for (let x = 28; x < 78; x++) if (Math.sin(x * 0.9) > 0.3) L.add(x, 93, [80, 70, 40], 0.4);   // 水溜まりの照り
  const ices = [];
  for (const [x, y, len, a, w] of [[38, 93, 20, -0.12, 4.4], [58, 98, 14, 0.18, 3.6], [70, 93, 9, -0.4, 3], [28, 99, 7, 0.3, 2.6]]) {
    const m = new Mask(W, H), c = Math.cos(a), sn = Math.sin(a);
    const P = (u, v) => [x + u * c - v * sn, y + u * sn + v * c];
    m.poly([...P(-len / 2, -w * 0.3), ...P(-len * 0.2, -w * 0.5), ...P(len / 2, -w * 0.4), ...P(len / 2 + 1, w * 0.2), ...P(len * 0.1, w * 0.5), ...P(-len / 2, w * 0.4)]);   // 脛を包んだ半円の筒の割れ
    ices.push(m);
  }
  for (const [i, m] of ices.entries()) L.paint(m, (x, y) => {
    const hi = !m.at(x, y - 1) || (!m.at(x - 1, y) && h2(x, y, 323 + i) > 0.3);
    const groove = m.at(x, y - 2) && m.at(x, y + 2) && h2(x, 0, 325 + i) > 0.55;           // 内側のくぼみ (脛の形)
    const c = lit(hi ? [228, 240, 236] : groove ? [96, 130, 126] : mix([120, 156, 150], [180, 206, 202], vnoise(x * 0.5, y * 0.5, 327 + i)), lightAt(x, y, lights), [0.36, 0.4, 0.4]);
    return [c[0], c[1], c[2], hi ? 0.95 : 0.72];
  });
  // 縄で束ねた人業の腕の木 (二本。肘の球関節と、指を開いた手)
  const arms = new Mask(W, H), jn = new Mask(W, H);
  for (const [dx, dy] of [[0, 0], [-3, 4.4]]) {
    const sx = 88 + dx, sy = 97 + dy, ex = 107 + dx, ey = 93.6 + dy, hx = 126 + dx, hy = 90.4 + dy;
    arms.line(sx, sy, ex, ey, 4.2, 1, 3.8); arms.line(ex, ey, hx - 2, hy + 0.3, 3.6, 1, 3);
    arms.ellipse(hx, hy, 2.6, 2.2);
    for (let f = 0; f < 4; f++) arms.line(hx + 1.6, hy - 1.6 + f * 1.1, hx + 5 - Math.abs(f - 1.4) * 0.6, hy - 2.2 + f * 1.5, 1);   // 四本の指
    arms.line(hx - 0.6, hy - 1.6, hx + 0.8, hy - 3.8, 1);                                                                           // 親指
    jn.ellipse(sx - 1, sy + 0.2, 2.2, 2.4); jn.ellipse(ex, ey, 2.2, 2.2);
  }
  paintLit(L, arms, (x, y) => mix(ALB_DOLL, ALB_DOLL_D, vnoise(x * 0.6, y * 0.6, 9) * 0.5 + (Math.sin(x * 0.7) * 0.5 + 0.5) * 0.2), lights, { ny: (x, y) => vNormal(arms, x, y, 3) * 0.6, nxMax: 3, amb: [0.26, 0.24, 0.22] });
  paintLit(L, jn, (x, y) => (jn.at(x, y - 1) ? [80, 84, 96] : [170, 176, 190]), lights, { amb: [0.24, 0.24, 0.28] });
  rimLight(L, arms, lights, [120, 100, 70], 0.4);
  const rope = new Mask(W, H);
  for (const rx of [96, 114]) { rope.line(rx, 91.6 - (rx - 96) * 0.17, rx - 1.4, 101.6 - (rx - 96) * 0.17, 1.6); rope.line(rx + 1.6, 91.4 - (rx - 96) * 0.17, rx + 0.2, 101.4 - (rx - 96) * 0.17, 1); }
  rope.ellipse(115, 91.4, 1.8, 1.4);                                                          // 結び目
  rope.line(115, 92, 119, 96, 1); rope.line(115, 92, 120, 88.6, 1);                           // 縄の端
  paintLit(L, rope, (x, y) => (h2(x, y, 331) > 0.5 ? [200, 180, 130] : [150, 130, 90]), lights, { amb: [0.3, 0.28, 0.24] });
  // 結び目にはさんだ書きつけ (折りたたんだ紙が一枚、斜めに立つ)
  const note = new Mask(W, H); note.poly([111, 91, 109, 81, 116, 79.6, 118, 90]);
  L.paint(note, (x, y) => {
    const v = (y - 80) / 11;
    const ink = (Math.round(y - x * 0.2) % 2 === 0) && v > 0.15 && v < 0.85 && x > 110 && x < 116 && h2(x, y, 333) > 0.3;
    const fold = Math.abs(y - 85.4 + (x - 113) * 0.15) < 0.5;                                  // 折り目
    return lit(ink ? [70, 56, 50] : fold ? [170, 156, 120] : ALB_PAPER, lightAt(x, y, lights), [0.4, 0.38, 0.34]);
  });
  // 手前の葦 (右の端。足跡はこの奥へ消える)
  for (let i = 0; i < 16; i++) reedStalk(L, lights, 170 + h2(i, 3, 335) * 24, 104 + h2(i, 4, 335) * 6, 40 + h2(i, 5, 335) * 34, -6 + h2(i, 6, 335) * 8, 337 + i, { amb: [0.16, 0.18, 0.12] });
  for (let i = 0; i < 6; i++) reedStalk(L, lights, h2(i, 7, 335) * 10, 108, 30 + h2(i, 8, 335) * 24, 2 + h2(i, 9, 335) * 5, 351 + i, { amb: [0.06, 0.06, 0.05] });
  miasma(L, 64, 12, [120, 150, 70], 0.22, 353);
  miasma(L, 82, 8, [110, 140, 70], 0.14, 355);
  motes(L, lights, 30, 357, [0.8, 0.95, 0.6]);
  vignette(L, 0.84);
  return L.canvas(12, SWAMP_PAL);
}

// 作りかけの人業 (坐りこんだ胴と、目鼻の無い球の頭)。(cx, by) = 腰の下、s = 大きさ、tilt = 体の傾き (右へ +)。
// opt: head (false = 頭が無い)、arm (0 両腕 / 1 左腕だけ / 2 腕なし)、crest (胸の印の大きさ。0 = 無し)、rot (苔と腐れ)
function castDoll(L, lights, cx, by, s, tilt, seed, { head = true, arm = 0, crest = 0.62, rot = 0.5, amb = [0.12, 0.12, 0.1], glint = false, door = true, lap = false } = {}) {
  const P = (u, v) => [cx + (u + v * tilt) * s, by - v * s];
  const pts = (list) => list.flatMap(([u, v]) => P(u, v));
  const body = new Mask(L.w, L.h), jn = new Mask(L.w, L.h), hd = new Mask(L.w, L.h);
  // 脚 (手前へ投げ出す)
  for (const sd of [-1, 1]) { const [x0, y0] = P(sd * 3, 1), [x1, y1] = P(sd * 5.6, -2.6); body.line(x0, y0, x1, y1, 4.4 * s, 1, 3.8 * s); body.ellipse(x1, y1 + 0.6 * s, 2.6 * s, 1.8 * s); }
  body.poly(pts([[-4.6, 0], [4.6, 0], [4, 6], [5.8, 11], [6.6, 16], [5.6, 17.4], [-5.6, 17.4], [-6.6, 16], [-5.8, 11], [-4, 6]]));   // 胴 (腰は細く、胸は広い)
  const arms = arm === 2 ? [] : arm === 1 ? [-1] : [-1, 1];
  for (const sd of arms) { const [x0, y0] = P(sd * 7.4, 15.2), [x1, y1] = P(sd * 8.2, 7.4), [x2, y2] = P(sd * 7.6, 1.2); body.line(x0, y0, x1, y1, 2.6 * s, 1, 2.2 * s); body.line(x1, y1, x2, y2, 2.2 * s, 1, 1.8 * s); body.ellipse(x2, y2 + 0.4 * s, 1.4 * s, 1.7 * s); }
  if (head) { const [hx, hy] = P(0, 23.2); hd.ellipse(hx, hy, 4.2 * s, 4.6 * s); }
  const [nx, ny] = P(0, 18.4); jn.rect(nx - 1.3 * s, ny - 1.2 * s, 2.6 * s, 2.6 * s);                     // 首の黒鉄の帯
  const [wx, wy] = P(0, 6); jn.rect(wx - 4.2 * s, wy - 0.6 * s, 8.4 * s, 1.3 * s);                         // 腰の帯
  for (const sd of [-1, 1]) { const [jx, jy] = P(sd * 6.6, 15.6), [kx, ky] = P(sd * 5.6, -2.6); jn.ellipse(jx, jy, 1.9 * s, 1.9 * s); jn.ellipse(kx - sd * 1.4 * s, ky - 0.8 * s, 1.5 * s, 1.5 * s); }
  const woodAlb = (x, y) => {
    const n = vnoise(x * 0.4 / s, y * 0.4 / s, seed), g = Math.sin((x - cx) * 0.9 / s + n * 2) * 0.5 + 0.5;    // 木目
    if (fbm(x * 0.15 / s, y * 0.15 / s, seed + 3) > 0.78 - rot * 0.15) return mix([54, 74, 38], [84, 104, 50], n);   // 苔と腐れ
    return mix(ALB_DOLL, ALB_DOLL_D, clamp(n * 0.5 + g * 0.2 + rot * 0.2));
  };
  for (const m of [body, hd]) paintLit(L, m, woodAlb, lights, { ny: (x, y) => vNormal(m, x, y, Math.max(2, 3 * s)) * 0.5, nxMax: Math.max(3, 5 * s), amb });
  paintLit(L, jn, (x, y) => (jn.at(x, y - 1) ? [58, 60, 70] : [140, 146, 160]), lights, { amb });
  // 胸の扉 (開いたまま。胸の中は空ろで、扉の内側に一門の印「灯を掌に載せた手」が彫られている)
  if (door) {
    const cav = new Mask(L.w, L.h), dr = new Mask(L.w, L.h);
    cav.poly(pts([[-3.4, 8.4], [3.4, 8.4], [3.6, 15], [-3.6, 15]]));
    dr.poly(pts([[3.6, 15.2], [10.6, 14], [10.4, 7], [3.4, 8.2]]));
    L.paint(cav, (x, y) => lit(cav.at(x, y - 1) ? [24, 18, 16] : [70, 56, 44], lightAt(x, y, lights), amb));
    paintLit(L, dr, (x, y) => (dr.edge(x, y) ? [70, 52, 38] : mix(ALB_DOLL, ALB_DOLL_D, vnoise(x * 0.5, y * 0.5, seed + 7) * 0.6)), lights, { amb: [amb[0] * 1.6, amb[1] * 1.6, amb[2] * 1.6] });
    const [hx2, hy2] = P(3.8, 13.6); L.px(hx2, hy2, [150, 156, 170]); const [hx3, hy3] = P(3.6, 9.4); L.px(hx3, hy3, [150, 156, 170]);   // 蝶番
  }
  if (crest > 0) {
    const [ccx, ccy] = door ? P(7.2, 10.6) : P(0.4, 11.4);
    if (glint) {                                                           // 遠くの器: 金の小さな照りだけ
      L.px(ccx, ccy, [210, 170, 90]); L.px(ccx, ccy - 1, [255, 220, 130]);
    } else {
      const hand = new Mask(L.w, L.h), flame = new Mask(L.w, L.h);
      crestMask(hand, flame, ccx - 0.4 * crest, ccy + 0.6 * crest, crest);
      L.paint(hand, (x, y) => lit(hand.at(x, y - 1) ? ALB_BRASS : [236, 200, 120], lightAt(x, y, lights), [0.42, 0.36, 0.28]));
      L.paint(flame, (x, y) => rc(R_EMBER, flame.at(x, y - 1) ? 0.82 : 0.95));
      glow(L, ccx - 1.2 * crest, ccy - 3 * crest, 6 * crest, C_CANDLE, 0.16, 2);
    }
  }
  // 膝に載せた師の札
  if (lap) { const nm = new Mask(L.w, L.h); nm.poly(pts([[-2.6, -1.6], [3, -1.2], [3.2, 1.4], [-2.4, 1.2]])); L.paint(nm, (x, y) => lit(h2(x, y, seed) > 0.75 ? [70, 56, 50] : ALB_PAPER, lightAt(x, y, lights), [0.5, 0.48, 0.44])); }
}

// 30. 一門の印の器 (沼のほとりの谷。作りかけの人業が山と積まれ、開いたままの胸の扉の内側に、どれも「灯を掌に載せた手」の印。
//     山の頂には一体だけ、きれいに座らされた器。その膝に師の札)
function sceneCrest() {
  const W = ART_W, H = ART_H, L = new Layer(W, H);
  const lights = [
    { x: 92, y: 66, r: 120, c: C_CANDLE, k: 1.05, p: 1.4 },          // 手元のランタン (手前。開いた胸の扉をかざして照らす)
    { x: 20, y: 40, r: 80, c: C_CANDLE, k: 0.35, p: 1.4 },
    { x: 108, y: 26, r: 120, c: C_MIASMA, k: 0.8, p: 1.3 },           // 山の向こうの沼の光
    { x: 186, y: 70, r: 70, c: C_MIASMA, k: 0.45, p: 1.4 },
  ];
  // 奥: 毒の霧に霞む谷の口 (空は無く、奈落の闇)
  L.shade(0, 0, W - 1, H - 1, (x, y) => {
    const f = fbm(x * 0.03, y * 0.08, 401), t = clamp(y / 46);
    return [6 + f * 10 + t * 24, 10 + f * 14 + t * 38, 6 + f * 8 + t * 16];
  });
  glow(L, 108, 38, 64, C_MIASMA, 0.32, 2);
  for (let i = 0; i < 7; i++) { const x = 62 + i * 15 + h2(i, 1, 403) * 6, h = 8 + h2(i, 2, 403) * 14; const t = new Mask(W, H); t.line(x, 46, x + 1, 46 - h, 1.6, 1, 1); t.line(x + 1, 46 - h * 0.6, x + 5, 46 - h * 0.8, 1); L.paint(t, () => [18, 28, 14]); }
  // 谷の両側の斜面 (黒い泥と岩。左右から迫る)
  const slope = new Mask(W, H);
  for (let y = 0; y < H; y++) {
    const l = 52 - y * 0.3 + Math.sin(y * 0.12) * 4 + vnoise(1, y * 0.1, 405) * 8;
    const r = 146 + y * 0.36 + Math.sin(y * 0.1 + 1) * 4 + vnoise(2, y * 0.1, 407) * 8;
    slope.rect(0, y, Math.max(0, l), 1); slope.rect(r, y, W - r, 1);
  }
  paintLit(L, slope, (x, y) => {
    const n = fbm(x * 0.1, y * 0.1, 411), streak = vnoise(x * 0.5, y * 0.04, 409);
    if (vnoise(x * 0.12, y * 0.12, 419) > 0.78) return mix([50, 52, 44], [74, 76, 64], n);
    return mix(ALB_MUD_D, ALB_MUD, clamp(n * 0.7 + streak * 0.4));
  }, lights, { nxMax: 10, amb: [0.06, 0.07, 0.05] });
  rimLight(L, slope, lights, [60, 84, 40], 0.5);
  // 山: 器の手足・頭・胴が絡みあって積もる (奥の光を背に、縁だけが緑に照る)
  const hill = (x) => 40 + Math.abs(x - 104) * 0.36 + vnoise(x * 0.12, 3, 413) * 5;
  const mound = new Mask(W, H); for (let x = 0; x < W; x++) mound.rect(x, hill(x), 1, H);
  L.paint(mound, (x, y) => lit(mix([30, 28, 20], [52, 46, 34], fbm(x * 0.2, y * 0.2, 415)), lightAt(x, y, lights), [0.1, 0.1, 0.08]));
  const R = rng(417), parts = [];
  for (let i = 0; i < 150; i++) { const cx = 20 + R() * 170, top = hill(cx); if (top > 100) continue; parts.push({ k: R(), cx, cy: top + 2 + R() * Math.min(40, 104 - top), a: R() * Math.PI, len: 7 + R() * 10, w: 2 + R() * 1.6 }); }
  parts.sort((a, b) => a.cy - b.cy);
  for (const p of parts) {
    const m = new Mask(W, H), jm = new Mask(W, H);
    if (p.k < 0.62) { const dx = Math.cos(p.a) * p.len / 2, dy = Math.sin(p.a) * p.len / 2 * 0.6; m.line(p.cx - dx, p.cy - dy, p.cx + dx, p.cy + dy, p.w, 1, p.w * 0.8); jm.ellipse(p.cx - dx, p.cy - dy, p.w * 0.55, p.w * 0.55); }
    else if (p.k < 0.84) m.ellipse(p.cx, p.cy, 3, 3.3);
    else { m.poly([p.cx - 4, p.cy - 5, p.cx + 4, p.cy - 5, p.cx + 3, p.cy + 5, p.cx - 3, p.cy + 5]); jm.rect(p.cx - 3.4, p.cy + 1, 6.8, 1); }
    const far = clamp(1 - (p.cy - 40) / 60);
    paintLit(L, m, (x, y) => {
      const n = vnoise(x * 0.6, y * 0.6, p.cx | 0);
      if (n > 0.82) return [52, 72, 36];
      return mulc(mix(ALB_DOLL, ALB_DOLL_D, n), 0.5 + 0.2 * (1 - far));
    }, lights, { ny: (x, y) => vNormal(m, x, y, 2), nxMax: 3, amb: [0.08, 0.09, 0.07] });
    paintLit(L, jm, () => [60, 62, 70], lights, { amb: [0.08, 0.08, 0.08] });
    if (p.k >= 0.84) { L.px(p.cx, p.cy - 1, [200, 160, 84]); L.px(p.cx, p.cy - 2, [240, 200, 110]); }   // 胴の小さな印の照り
  }
  // 山の上に坐らされた器の列 (どれも胸に同じ印)
  for (let i = 0; i < 9; i++) {
    const x = 50 + i * 13.5 + (i % 2) * 2, by = hill(x) + 13 + (i % 2) * 2;
    if (i === 4) continue;                                               // 頂は空けておく
    castDoll(L, lights, x, by, 0.5, ((i * 5) % 3 - 1) * 0.14, 421 + i, { head: i !== 2 && i !== 6, arm: (i * 2) % 3, glint: true, rot: 0.6, amb: [0.07, 0.08, 0.06] });
  }
  // 山の頂に、一体だけきれいに座らされた器 (顔は彫りかけ、胸は空ろ。膝に師の札)
  castDoll(L, lights, 104, hill(104) + 10, 0.76, 0, 441, { arm: 0, glint: true, rot: 0.1, lap: true, amb: [0.16, 0.17, 0.12] });
  glow(L, 104, hill(104) + 4, 12, [0.6, 0.7, 0.5], 0.12, 2);
  // 手前の器 (大きく。胸の印がはっきり見える)。右の器は片腕が無く、頭を垂れる
  castDoll(L, lights, 150, 104, 1.15, 0.22, 433, { arm: 1, crest: 0.7, rot: 0.55, amb: [0.1, 0.1, 0.08] });
  castDoll(L, lights, 60, 108, 2.1, -0.06, 431, { arm: 0, crest: 1.25, rot: 0.25, amb: [0.2, 0.18, 0.16] });
  // 落ちた頭 (手前の泥に)
  const fh = new Mask(W, H); fh.ellipse(112, 102, 5, 4.6);
  paintLit(L, fh, (x, y) => mix(ALB_DOLL, ALB_DOLL_D, vnoise(x * 0.5, y * 0.5, 5) * 0.8), lights, { ny: (x, y) => vNormal(fh, x, y, 3) * 0.6, amb: [0.1, 0.1, 0.08] });
  miasma(L, 44, 14, [120, 150, 70], 0.3, 435);
  miasma(L, 92, 10, [100, 130, 60], 0.12, 437);
  motes(L, lights, 30, 439, [0.85, 0.95, 0.6]);
  vignette(L, 0.82);
  return L.canvas(12, SWAMP_PAL);
}

// ガラスの小瓶 (栓つき)。(x, by) = 底の中央、h = 高さ。liquid = 中身の色 (null = 空)。broken = 首から上が割れて無い
function bottle(L, lights, x, by, h, w, liquid, seed, { tilt = 0, broken = false } = {}) {
  const m = new Mask(L.w, L.h), neck = new Mask(L.w, L.h), cork = new Mask(L.w, L.h);
  if (broken) m.poly([x - w / 2, by, x + w / 2, by, x + w / 2, by - h * 0.5, x + w * 0.2, by - h * 0.62, x, by - h * 0.44, x - w * 0.25, by - h * 0.66, x - w / 2, by - h * 0.48]);   // ぎざぎざの割れ口
  else {
    m.poly([x - w / 2, by, x + w / 2, by, x + w / 2 + tilt * 0.2, by - h * 0.62, x + 1 + tilt * 0.6, by - h * 0.78, x - 1 + tilt * 0.6, by - h * 0.78, x - w / 2 + tilt * 0.2, by - h * 0.62]);
    neck.rect(x - 1 + tilt * 0.8, by - h * 0.95, 2.4, h * 0.2);
    cork.rect(x - 1.2 + tilt, by - h - 1, 2.8, 2.2);
  }
  L.paint(m, (xx, yy) => {
    const u = (xx + 0.5 - (x - w / 2)) / w, lv = by - h * 0.42;
    if (liquid && yy > lv) return lit(mix(liquid, mulc(liquid, 0.55), u), lightAt(xx, yy, lights), [0.5, 0.5, 0.5]);
    if (u < 0.28 && u > 0.1) return [220, 236, 220, 0.85];                                // ガラスの照り
    if (m.edge(xx, yy)) return [120, 140, 120, 0.7];
    return [60, 80, 64, 0.35];
  });
  L.paint(neck, (xx, yy) => (xx < x ? [170, 196, 176, 0.8] : [80, 100, 84, 0.6]));
  paintLit(L, cork, () => [150, 112, 70], lights, { amb: [0.26, 0.22, 0.18] });
}

// 31. 毒消しの書きつけ (毒の霧の立つ葦原の奥。葦を刈り払った跡の岩の上に、石で押さえた師の書きつけ。葦の根の束と、
//     割れた小瓶がいくつか。こぼれた灯のしずくが淡く光る。焚き火の跡)
function sceneReeds() {
  const W = ART_W, H = ART_H, L = new Layer(W, H);
  const RX = 100, RY = 80;                                              // 岩の上面の中央
  const lights = [
    { x: 36, y: 56, r: 130, c: C_CANDLE, k: 1.15, p: 1.45 },          // 手元のランタン (左手前)
    { x: 110, y: 20, r: 170, c: C_MIASMA, k: 0.75, p: 1.2 },          // 霧そのものの淡い光
    { x: 128, y: 76, r: 40, c: [0.7, 1.0, 0.85], k: 0.45, p: 1.5 },   // 毒消しの瓶の淡い光
  ];
  const FOG = [132, 156, 82];
  // 奥: 毒の霧 (上ほど濃く、黄緑に光る)
  L.shade(0, 0, W - 1, H - 1, (x, y) => {
    const f = fbm(x * 0.025, y * 0.06, 501), t = y / H;
    return mix(mulc(FOG, 0.55 + f * 0.25), [30, 38, 22], clamp(t * 1.2));
  });
  // 葦の層 (奥ほど霧に溶ける)。3 層を奥から
  for (const [n, y0, y1, hMin, hMax, fogK, sd] of [[46, 44, 58, 14, 44, 0.72, 503], [34, 60, 74, 20, 56, 0.45, 505], [22, 72, 86, 26, 66, 0.22, 507]]) {
    const R = rng(sd);
    for (let i = 0; i < n; i++) {
      const x = R() * W, by = y0 + R() * (y1 - y0), h = hMin + R() * (hMax - hMin), lean = (R() - 0.5) * 8;
      if (Math.abs(x - RX) < 34 && by > 64) continue;                                   // 空き地
      const base = mix([40, 40, 24], FOG, fogK), col = (t) => mix(base, mulc(FOG, 1.05), fogK * t * 0.5);
      for (let j = 0; j <= h; j++) { const t = j / h; L.px(x + lean * t * t, by - j, col(t)); if (t < 0.3 && fogK < 0.5) L.px(x + 1 + lean * t * t, by - j, mulc(col(t), 0.8)); }
      for (let n2 = 0; n2 < 2; n2++) {                                                   // 葉 (斜めに出て先が垂れる)
        if (R() < 0.35) continue;
        const t0 = 0.25 + R() * 0.45, sx = x + lean * t0 * t0, sy = by - h * t0, d = R() < 0.5 ? -1 : 1, len = 6 + R() * 10;
        for (let j = 0; j < len; j++) { const u = j / len; L.px(sx + d * j * 0.7, sy - len * 0.5 * Math.sin(u * 2.4), col(t0 + 0.1)); }
      }
      if (R() < 0.4) for (let j = 0; j < 5; j++) { L.px(x + lean * 0.75, by - h * 0.86 + j, mix([70, 44, 28], FOG, fogK)); L.px(x + 1 + lean * 0.75, by - h * 0.86 + j, mix([50, 32, 20], FOG, fogK)); }
    }
    miasma(L, y0 - 6, 18, mulc(FOG, 1.1), 0.5 * (1 - fogK * 0.3), sd + 1);
  }
  // 地面 (ぬかるみ。空き地だけ少し乾く)
  L.shade(0, 84, W - 1, H - 1, (x, y) => lit(mix(ALB_MUD_D, ALB_MUD, fbm(x * 0.1, y * 0.25, 509)), lightAt(x, y, lights, 0, -0.9), [0.14, 0.16, 0.1]));
  // 刈り払った葦の切り株 (空き地のぐるり)
  { const R = rng(557); for (let i = 0; i < 70; i++) { const x = 40 + R() * 116, y = 86 + R() * 20; if (Math.abs(x - RX) < 38 && y < 100) continue; const h = 1 + (R() * 3 | 0); for (let j = 0; j < h; j++) L.px(x, y - j, lit(j === h - 1 ? ALB_REED : ALB_REED_D, lightAt(x, y, lights), [0.14, 0.16, 0.1])); } }
  // 平たい岩 (空き地のまんなか)
  const rock = new Mask(W, H);
  rock.poly([RX - 34, RY + 2, RX - 26, RY - 4, RX + 20, RY - 6, RX + 34, RY - 1, RX + 38, RY + 10, RX + 26, RY + 18, RX - 22, RY + 18, RX - 36, RY + 12]);
  paintLit(L, rock, (x, y) => {
    const top = y < RY + 3 - (x - RX) * 0.04;
    const n = vnoise(x * 0.3, y * 0.3, 511);
    if (n > 0.74) return mix([60, 80, 40], [84, 104, 50], n);                             // 苔
    return top ? mix([70, 74, 62], [92, 94, 80], n) : mix([44, 46, 40], [62, 64, 54], n);
  }, lights, { ny: (x, y) => (y < RY + 3 ? -0.9 : 0.4), nxMax: 8, amb: [0.16, 0.18, 0.12] });
  // 煮炊きの跡 (石を丸く並べた炉。灰と燃えさし)
  const ash = new Mask(W, H); ash.ellipse(46, 96, 11, 3.6);
  L.paint(ash, (x, y) => lit(mix([90, 88, 80], [130, 126, 114], vnoise(x * 0.5, y, 513)), lightAt(x, y, lights, 0, -0.9), [0.16, 0.16, 0.14]));
  for (let k = 0; k < 9; k++) { const a = k / 9 * 6.283, st = new Mask(W, H); st.ellipse(46 + Math.cos(a) * 12, 96 + Math.sin(a) * 4.2, 2.6, 1.8); paintLit(L, st, () => [96, 94, 84], lights, { ny: (x, y) => vNormal(st, x, y, 2), amb: [0.14, 0.14, 0.12] }); }
  for (const [x0, y0, x1, y1] of [[40, 95, 52, 97], [44, 98, 50, 94]]) { const st = new Mask(W, H); st.line(x0, y0, x1, y1, 1.4); L.paint(st, (x, y) => (h2(x, y, 515) > 0.6 ? rc(R_EMBER, 0.55) : [30, 24, 20])); }
  // 書きつけ (岩の上。四隅を小石で押さえる)
  const note = new Mask(W, H); note.poly([RX - 22, RY - 3, RX + 4, RY - 5, RX + 6, RY + 7, RX - 20, RY + 9]);
  L.paint(note, (x, y) => {
    const u = (x - RX + 22) / 28, v = (y - RY + 4) / 13;
    const ink = v > 0.15 && v < 0.9 && u > 0.08 && u < 0.62 && Math.round(y - u * 2) % 3 === 0 && h2(x >> 1, y, 517) > 0.3;
    const sketch = Math.hypot(x - (RX - 2), y - (RY + 2)) < 3 && Math.hypot(x - (RX - 2), y - (RY + 2)) > 1.8;   // 瓶の小さな図
    return lit(ink || sketch ? [52, 44, 40] : ALB_PAPER, lightAt(x, y, lights.slice(0, 1), 0, -0.9), [0.5, 0.48, 0.42]);   // 紙は霧の緑を拾いすぎないよう、ランタンの光だけで
  });
  for (let x = RX - 20; x <= RX + 6; x++) { const y = Math.round(RY + 9 - (x - RX + 20) * 0.08); if (!note.at(x, y + 1)) L.add(x, y + 1, [-30, -30, -26], 1); }   // 紙の下の影
  for (const [x, y] of [[RX - 21, RY - 2], [RX + 5, RY - 4], [RX + 5, RY + 6]]) { const st = new Mask(W, H); st.ellipse(x, y, 2, 1.5); paintLit(L, st, () => [86, 88, 78], lights, { ny: (xx, yy) => vNormal(st, xx, yy, 2), amb: [0.16, 0.16, 0.14] }); }
  const pin = new Mask(W, H); pin.ellipse(RX - 18, RY + 7, 3.4, 2.4);
  paintLit(L, pin, () => [100, 100, 92], lights, { ny: (xx, yy) => vNormal(pin, xx, yy, 2), amb: [0.16, 0.16, 0.14] });
  // 葦の根の束 (掘り出して紐で縛り、干したもの)
  const herb = new Mask(W, H);
  for (let k = 0; k < 7; k++) herb.line(RX + 10, RY - 2, RX + 20 + k * 0.6, RY - 9 + k * 1.6, 1.2);
  herb.ellipse(RX + 21, RY - 6, 3.6, 3.4);
  L.paint(herb, (x, y) => lit(h2(x, y, 519) > 0.45 ? [176, 168, 92] : [120, 140, 64], lightAt(x, y, lights), [0.42, 0.44, 0.34]));
  for (let y = RY - 4; y < RY + 1; y++) L.px(RX + 12, y, [190, 170, 120]);                 // 縛った紐
  // 割れた小瓶 (薬を煮つめては試した跡)。底にわずかに残った灯のしずくが、淡く光る
  bottle(L, lights, RX + 28, RY - 1, 13, 6, [150, 220, 170], 521, { broken: true });
  bottle(L, lights, RX + 20, RY + 1, 10, 5, null, 523, { broken: true });
  glow(L, RX + 28, RY - 2, 10, [0.6, 1.0, 0.75], 0.22, 2);
  const fb = new Mask(W, H); fb.poly([RX - 8, RY + 12, RX + 2, RY + 10, RX + 3, RY + 14, RX - 8, RY + 15]);   // 岩の下に転がった瓶
  L.paint(fb, (x, y) => (y < RY + 12 ? [200, 220, 200, 0.7] : [70, 90, 74, 0.5]));
  for (const [x, y] of [[RX + 6, RY + 13], [RX + 9, RY + 15], [RX + 4, RY + 16], [RX + 12, RY + 14]]) L.px(x, y, [210, 230, 220], 0.9);   // ガラスのかけら
  for (const [x, y] of [[RX + 32, RY], [RX + 34, RY + 1], [RX + 3, RY + 12]]) { L.px(x, y, [170, 250, 200]); glow(L, x, y, 4, [0.5, 1.0, 0.7], 0.25, 2); }   // こぼれた灯のしずく
  // 手前の葦 (左右の端。画面の外まで伸びる)
  for (let i = 0; i < 12; i++) reedStalk(L, lights, h2(i, 1, 525) * 26, 110, 70 + h2(i, 2, 525) * 40, 4 + h2(i, 3, 525) * 8, 527 + i, { amb: [0.1, 0.12, 0.08], k: 0.8 });
  for (let i = 0; i < 12; i++) reedStalk(L, lights, 168 + h2(i, 4, 525) * 26, 110, 70 + h2(i, 5, 525) * 40, -4 - h2(i, 6, 525) * 8, 541 + i, { amb: [0.12, 0.14, 0.08], k: 0.8 });
  miasma(L, 96, 14, mulc(FOG, 0.9), 0.24, 551);
  motes(L, lights, 50, 553, [0.85, 1.0, 0.6]);
  vignette(L, 0.82);
  return L.canvas(12, SWAMP_PAL);
}

// 32. よどみの主の記憶 (沼の島の古い工房。瘴気に冒された年老いた操霊師が作業台の前に座りこみ、そばに膝をつく若い人業の
//     腕をつかんで言いつける。人業の胸には古い灯。工房の奥の戸口の上に一門の印、その向こうに嵐の鳴る塔が上へ伸びる)
function sceneSwampLord() {
  const W = ART_W, H = ART_H, L = new Layer(W, H);
  const DX = 112, OX = 58, GY = 100;                                    // 人業・操霊師の位置・床
  const AX = 158, AT = 20, AW = 20;                                     // 奥の戸口 (中心・上端・半幅)
  const lights = [
    { x: 30, y: 52, r: 120, c: C_CANDLE, k: 1.1, p: 1.5 },            // 作業台の灯 (左)
    { x: DX - 1, y: 69, r: 60, c: C_SOUL, k: 0.75, p: 1.5 },           // 人業の胸の古い灯
    { x: AX, y: 20, r: 90, c: [0.6, 0.66, 0.9], k: 0.55, p: 1.3 },     // 戸口の向こうの嵐の光
    { x: 96, y: 118, r: 90, c: C_MIASMA, k: 0.55, p: 1.4 },            // 床を這う瘴気
    { x: 88, y: 30, r: 80, c: C_CANDLE, k: 0.85, p: 1.4 },             // 二人の上に吊るした灯
  ];
  // 工房の壁 (石積み) と、梁
  L.shade(0, 0, W - 1, GY, (x, y) => {
    const a = ashlar(x, y, 18, 9, 601);
    let alb = mix([84, 78, 70], [60, 56, 52], fbm(x * 0.1, y * 0.1, 603));
    if (a.joint) alb = [24, 22, 22];
    if (vnoise(x * 0.08, y * 0.2, 605) > 0.75 && y > 60) alb = mix(alb, [56, 74, 40], 0.5);   // 這い上がる湿った苔
    return lit(alb, lightAt(x, y, lights, a.left ? -0.5 : 0, a.top ? -0.6 : 0), [0.06, 0.06, 0.07]);
  });
  // 奥の大きな戸口 (尖った拱。外は嵐の夜と、上へ伸びる塔)
  const arch = new Mask(W, H);
  for (let y = AT; y <= GY - 6; y++) { const t = (y - AT) / 18, hw = y < AT + 18 ? AW * Math.sqrt(clamp(1 - (1 - t) * (1 - t))) : AW; arch.rect(AX - hw, y, hw * 2, 1); }
  L.paint(arch, (x, y) => {
    const f = fbm(x * 0.05, y * 0.08, 607);
    const c = fbm(x * 0.09 + y * 0.02, y * 0.12, 608);
    return [34 + f * 30 + c * 30, 40 + f * 32 + c * 30, 62 + f * 40 + c * 36];          // 嵐の雲 (稲光に照らされて青白い)
  });
  // 稲光 (雲の中を走る細い筋)
  const bolt = new Mask(W, H); { let x = AX + 14, y = AT + 2; for (let k = 0; k < 7; k++) { const nx = x + (h2(k, 1, 609) - 0.6) * 6, ny = y + 4; bolt.line(x, y, nx, ny, 1); x = nx; y = ny; } }
  L.paint(bolt, (x, y) => (arch.at(x, y) ? [200, 210, 240] : null));
  // 塔 (島の奥から上へ。上は戸口の外へ抜ける。小さな窓がところどころ光る)
  const tower = new Mask(W, H);
  for (let y = 0; y <= GY - 6; y++) { const hw = 4.5 + (y / GY) * 3.5; tower.rect(AX - 2 - hw, y, hw * 2, 1); }
  tower.poly([AX - 26, GY - 6, AX - 20, GY - 22, AX + 14, GY - 22, AX + 20, GY - 6]);    // 塔の裾の島の岩
  L.paint(tower, (x, y) => {
    if (!arch.at(x, y)) return null;
    const win = (Math.abs(x - (AX - 1)) < 1 && ((y + 4) % 15) < 2) || (Math.abs(x - (AX - 4)) < 0.8 && ((y + 11) % 19) < 2);
    if (win) return [220, 190, 120];
    const band = ((y + Math.round((x - AX) * 0.6)) % 9) === 0;                       // 螺旋の段
    const sh = clamp((x - AX + 9) / 16);
    return band ? [30, 30, 42] : [12 + sh * 16, 12 + sh * 16, 20 + sh * 22];
  });
  rimLight(L, tower, lights, [90, 100, 150], 0.3);
  // 戸口の縁石
  for (let y = AT - 2; y <= GY - 4; y++) for (let x = AX - AW - 3; x <= AX + AW + 3; x++) if (!arch.at(x, y) && (arch.at(x + 2, y) || arch.at(x - 2, y) || arch.at(x, y + 2))) L.px(x, y, lit([110, 102, 92], lightAt(x, y, lights), [0.1, 0.1, 0.12]));
  // 床 (板石。奥の戸口から、緑の瘴気が這いこむ)
  L.shade(0, GY, W - 1, H - 1, (x, y) => { const w = worley(x * 0.08, y * 0.25, 611); return lit(w[1] - w[0] < 0.06 ? [20, 20, 18] : mix([70, 66, 58], [92, 88, 76], w[2] * 0.6), lightAt(x, y, lights, 0, -0.9), [0.06, 0.06, 0.07]); });
  // 左: 作業台 (灯をともす台。作りかけの灯籠と、人業の腕と頭)
  const bench = new Mask(W, H); bench.rect(4, 62, 44, 4); bench.rect(8, 66, 3, GY - 66); bench.rect(41, 66, 3, GY - 66);
  paintLit(L, bench, (x, y) => (y === 62 ? ALB_WOOD : ALB_WOOD_D), lights, { amb: [0.1, 0.08, 0.08] });
  const lamp = new Mask(W, H), lampWin = new Mask(W, H);
  lanternShape(lamp, 30, 62, 0.42, lampWin);
  paintLit(L, lamp, () => [120, 112, 100], lights, { amb: [0.12, 0.1, 0.1] });
  L.paint(lampWin, () => rc(R_EMBER, 0.95));
  glow(L, 30, 51, 22, C_CANDLE, 0.35, 2);
  const parts = new Mask(W, H); parts.ellipse(14, 58.4, 3.6, 3.8); parts.line(17, 61, 24, 60, 2.6, 1, 2);
  paintLit(L, parts, () => ALB_DOLL, lights, { ny: (x, y) => vNormal(parts, x, y, 2), amb: [0.12, 0.1, 0.1] });
  // 壁の棚 (並んだ灯籠の型と、掛けた人業の手足)
  const shelf = new Mask(W, H); shelf.rect(4, 30, 54, 2); shelf.rect(64, 24, 40, 2);
  paintLit(L, shelf, () => ALB_WOOD, lights, { amb: [0.1, 0.08, 0.08] });
  for (let k = 0; k < 5; k++) { const m = new Mask(W, H); lanternShape(m, 10 + k * 10, 30, 0.22); paintLit(L, m, () => [90, 86, 80], lights, { amb: [0.08, 0.08, 0.08] }); }
  for (let k = 0; k < 4; k++) { const m = new Mask(W, H); m.line(70 + k * 9, 26, 69 + k * 9, 40 + (k % 2) * 4, 2.4, 1, 2); m.ellipse(69 + k * 9, 41 + (k % 2) * 4, 1.4, 1.6); paintLit(L, m, () => ALB_DOLL_D, lights, { amb: [0.08, 0.08, 0.08] }); }
  // 梁から吊るした灯 (二人の上)
  const LX = 88;
  const chain = new Mask(W, H); chain.line(LX, 0, LX, 24, 1); const hl = new Mask(W, H); hl.rect(LX - 3, 24, 7, 8); hl.poly([LX - 4, 24, LX + 5, 24, LX + 0.5, 20]);
  paintLit(L, chain, () => [70, 70, 76], lights, { amb: [0.1, 0.1, 0.1] }); paintLit(L, hl, () => [90, 80, 64], lights, { amb: [0.12, 0.1, 0.1] });
  L.paint((() => { const m = new Mask(W, H); m.rect(LX - 2, 26, 5, 5); return m; })(), () => rc(R_EMBER, 0.92));
  glow(L, LX, 28, 20, C_CANDLE, 0.3, 2);
  // 戸口の上の一門の印 (石に彫った「灯を掌に載せた手」)
  const ch = new Mask(W, H), cf = new Mask(W, H); crestMask(ch, cf, AX + 1, AT - 6.6, 0.9);
  L.paint(ch, (x, y) => lit(ch.at(x, y - 1) ? [150, 124, 80] : [200, 170, 110], lightAt(x, y, lights), [0.3, 0.28, 0.26]));
  L.paint(cf, () => [210, 170, 100]);
  // 年老いた操霊師 (作業台の脚にもたれて床に座りこむ。右を向き、顔はうつむき、白い髪とひげ。瘴気が胸まで入りこんでいる。
  //   上げた右手で、そばに膝をつく人業の腕をつかむ)
  const robe = new Mask(W, H), skin = new Mask(W, H), hair = new Mask(W, H);
  robe.poly([OX - 8, 94, OX + 6, 92, OX + 22, 94, OX + 28, 97, OX + 28, 101, OX - 9, 101]);               // 床へ投げ出した脚
  robe.poly([OX - 9, 95, OX + 6, 95, OX + 4, 74, OX + 1, 68, OX - 6, 67, OX - 10, 72]);                    // 胴 (後ろの作業台へもたれる)
  robe.line(OX + 1, 71, OX + 12, 79, 4.4, 1, 3.6); robe.line(OX + 12, 79, OX + 25, 72, 3.6, 1, 3);          // つかむ右腕 (袖)
  robe.line(OX - 4, 72, OX + 2, 86, 4, 1, 3.4);                                                            // 膝に落とした左腕
  skin.ellipse(OX + 3, 87.4, 2, 1.8);                                                                      // 力の抜けた左手
  skin.ellipse(OX + 27.4, 70.6, 2.4, 2.2);                                                                 // 人業の腕をつかむ右手
  skin.poly([OX + 1, 58, OX + 4.6, 58.6, OX + 6, 62, OX + 5.4, 63, OX + 5, 65.6, OX + 1.6, 66]);         // うつむいた横顔
  hair.ellipse(OX - 1, 60, 4.6, 5);                                                                        // 白い髪 (後ろ頭)
  hair.poly([OX - 5, 61, OX - 6.6, 69, OX - 2, 68, OX, 63]);                                              // 肩へ垂れる髪
  hair.poly([OX + 2, 64, OX + 6, 64.4, OX + 5, 70, OX + 2, 71]);                                          // ひげ
  for (const m of [robe]) paintLit(L, m, (x, y) => {
    if (!robe.at(x, y + 1) && y > 96) return h2(x, y, 617) > 0.3 ? ALB_EMBROID : [40, 34, 46];            // 裾の金の刺しゅう
    return mix([84, 74, 96], [50, 44, 60], (Math.sin(x * 0.8 + y * 0.3) * 0.5 + 0.5) * 0.6);
  }, lights, { nxMax: 7, ny: (x, y) => vNormal(robe, x, y, 3) * 0.4, amb: [0.14, 0.14, 0.16] });
  paintLit(L, skin, (x, y) => (x === OX + 4 && y === 61 ? [60, 50, 50] : [206, 184, 168]), lights, { nxMax: 3, amb: [0.34, 0.32, 0.32] });
  for (let k = 0; k < 4; k++) L.px(OX + 29 + (k % 2) * 0.6, 68.6 + k * 1.1, [180, 158, 140]);            // 腕に回した指
  paintLit(L, hair, (x, y) => mix([230, 230, 234], [150, 150, 160], clamp((y - 56) / 14 + h2(x, 0, 625) * 0.2)), lights, { nxMax: 3, amb: [0.24, 0.24, 0.26] });
  rimLight(L, robe, lights, [150, 160, 110], 0.5);
  // 若い人業 (操霊師のそばに片膝をつき、左を向く。若い男の顔・整えた黒髪。首と手首に黒鉄の継ぎ目。胸の奥に古い灯)
  const body = new Mask(W, H), dskin = new Mask(W, H), dhair = new Mask(W, H), jn = new Mask(W, H);
  body.poly([DX - 6, 84, DX + 6, 84, DX + 5, 70, DX + 3, 61, DX - 5, 60, DX - 7, 66]);                     // 胴 (少し前へかがむ)
  body.line(DX - 2, 82, DX - 10, 84, 5, 1, 4.4); body.line(DX - 10, 84, DX - 11, 98, 4.2, 1, 3.4);        // 立てた左膝
  body.ellipse(DX - 12, 99, 3.6, 1.6);
  body.line(DX + 2, 84, DX + 4, 98, 5, 1, 4.4); body.line(DX + 4, 98, DX + 15, 99, 3.6, 1, 2.8);          // 床についた右膝
  body.line(DX - 3, 63, DX - 12, 70, 3.6, 1, 3.2); body.line(DX - 12, 70, DX - 25, 70.6, 3, 1, 2.6);      // 操霊師へさしのべた左腕
  body.line(DX + 3, 63, DX + 5, 74, 3.4, 1, 3); body.line(DX + 5, 74, DX + 1, 80, 3, 1, 2.6);             // 右腕 (膝の上へ)
  dskin.poly([DX - 3, 50, DX - 7.2, 51.6, DX - 8.4, 54.2, DX - 7.2, 55, DX - 7.4, 57.6, DX - 4, 59, DX - 1, 57]);   // 横顔 (額・鼻・あご)
  dskin.ellipse(DX + 0.6, 80.4, 1.8, 1.8);
  dhair.ellipse(DX - 2, 51, 5, 4.4); dhair.rect(DX - 1, 51, 4, 6);                                         // 整えた黒髪 (後ろへ流す)
  jn.rect(DX - 4, 59, 3.4, 2.6); jn.rect(DX - 22, 69.4, 1.4, 2.6); jn.ellipse(DX - 10, 84, 2, 2); jn.ellipse(DX + 4, 98, 2, 1.6);
  paintLit(L, body, (x, y) => (Math.abs(x - DX + 1) < 0.8 && y > 62 && y < 82 ? [150, 130, 90] : mix([150, 140, 150], [112, 104, 118], vnoise(x * 0.5, y * 0.3, 613))), lights, { nxMax: 6, ny: (x, y) => vNormal(body, x, y, 3) * 0.4, amb: [0.34, 0.34, 0.36] });
  paintLit(L, dskin, (x, y) => (x === DX - 6 && y === 53 ? [30, 26, 30] : y === 57 && x <= DX - 6 ? [150, 104, 90] : mix([226, 200, 168], [196, 166, 130], vnoise(x * 0.5, y * 0.5, 615) * 0.5)), lights, { nxMax: 3, amb: [0.44, 0.4, 0.38] });
  paintLit(L, dhair, (x, y) => (dskin.at(x, y) ? null : [44, 36, 34]), lights, { nxMax: 4, amb: [0.12, 0.12, 0.13] });
  paintLit(L, jn, () => [80, 84, 96], lights, { amb: [0.16, 0.16, 0.2] });
  rimLight(L, body, lights, [120, 140, 170], 0.5);
  const heart = new Mask(W, H); heart.ellipse(DX - 1, 69, 2.4, 2.8);                                    // 胸の古い灯 (上衣を透かして光る)
  L.paint(heart, (x, y) => rc(R_SOUL, heart.edge(x, y) ? 0.72 : 0.95));
  glow(L, DX - 1, 69, 16, C_SOUL, 0.32, 2);
  const grip = new Mask(W, H); grip.ellipse(OX + 27.4, 70.6, 2.4, 2.2);                                // 人業の手首を握る手 (人業の腕の上に重ねる)
  paintLit(L, grip, () => [206, 184, 168], lights, { nxMax: 2, amb: [0.34, 0.32, 0.32] });
  for (let k = 0; k < 4; k++) L.px(OX + 29 + (k % 2) * 0.6, 68.6 + k * 1.1, [170, 146, 130]);          // 手首に回した指
  // 床を這う瘴気 (操霊師の足もとを冒す)
  miasma(L, GY + 4, 12, [130, 170, 70], 0.55, 619, { sx: 0.05 });
  miasma(L, GY - 6, 8, [120, 150, 70], 0.22, 621, { sx: 0.05, x0: 132 });
  memoryTint(L, [40, 50, 44], [27, 77]);
  motes(L, lights, 40, 623, [0.7, 1.0, 0.75]);
  return L.canvas(10, SWAMP_PAL);
}

// ======================= 第八章「嵐の尖塔」 =======================
// 沼の島の工房の奥から、奈落の縦穴をまっすぐ上へ伸びる塔。共通のパレットには雷雲の紫灰と稲妻の青白が乏しいので、
// 雷雲 (R_STORM)・稲妻 (R_BOLT) を足したパレット (STORM_PAL) で量子化する
const R_STORM = ramp(["#07060c", "#0c0a14", "#12101d", "#191627", "#201c31", "#28233c", "#312b48", "#3b3455", "#463e63",
  "#524972", "#605683", "#706595", "#8377a8", "#998fbc", "#b2a9d0"]);
const R_BOLT = ramp(["#161c3a", "#1f2a58", "#2a3a78", "#384e98", "#4a66b8", "#6282d2", "#82a0e6", "#a6bef4", "#cad8fc", "#eaf0ff"]);
export const STORM_PAL = new Palette([...PAL.cols, ...R_STORM, ...R_BOLT]);
const C_BOLT = [0.66, 0.74, 1.0];                          // 稲光の青白い光
const ALB_WET = [84, 84, 102], ALB_WET_D = [50, 50, 66];   // 雨に濡れた石
// 1 ドットずつ線を引く (細い稲妻・鎖・紐に。Mask.line だと斜めの 1 ドット線が途切れる)
function dotLine(m, x0, y0, x1, y1, w = 1) {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  for (let i = 0; i <= n; i++) { const t = i / n; m.rect(Math.round(x0 + (x1 - x0) * t - (w - 1) / 2), Math.round(y0 + (y1 - y0) * t - (w - 1) / 2), w, w); }
}
// 雷雲 (領域いっぱい)。下側の縁が明るい塊。flash(x,y) = 稲光の当たり (0-1)
function stormClouds(L, x0, y0, x1, y1, seed, { sx = 0.035, sy = 0.07, dark = [18, 16, 28], light = [110, 102, 140], flash = null, k = 1 } = {}) {
  L.shade(x0, y0, x1, y1, (x, y) => {
    const f = fbm(x * sx, y * sy, seed), g = fbm(x * sx * 2.4 + 3, y * sy * 2.4, seed + 5);
    let t = clamp(f * 1.35 - 0.3 + (g - 0.5) * 0.35);
    if (fbm(x * sx, (y - 2) * sy, seed) < f - 0.015) t = clamp(t + 0.14);          // 塊の下の縁が照る
    let c = mix(dark, light, t * t);
    if (flash) { const b = flash(x, y); if (b > 0) c = mix(c, [196, 206, 250], clamp(b * (0.25 + t))); }
    return mulc(c, k);
  });
}
// 稲妻 (上の点から下へジグザグ。枝分かれつき)。m に描き、通った点を返す
function boltMask(m, x, y, n, seed, { dx = 0, step = 4, jit = 6, branch = 3, w = 1 } = {}) {
  const R = rng(seed), pts = [[x, y]];
  for (let i = 0; i < n; i++) {
    const nx = x + dx + (R() - 0.5) * jit, ny = y + step * (0.7 + R() * 0.6);
    dotLine(m, x, y, nx, ny, i < n * 0.5 ? w : 1); x = nx; y = ny; pts.push([x, y]);
  }
  for (let b = 0; b < branch; b++) {
    let [bx, by] = pts[1 + ((R() * (pts.length - 3)) | 0)];
    const dir = R() < 0.5 ? -1 : 1, len = 2 + ((R() * 4) | 0);
    for (let i = 0; i < len; i++) { const nx = bx + dir * (2 + R() * 4), ny = by + 2 + R() * 3; dotLine(m, bx, by, nx, ny, 1); bx = nx; by = ny; }
  }
  return pts;
}
function paintBolt(L, m, { core = [240, 244, 255], edge = [150, 170, 245] } = {}) {
  L.paint(m, (x, y) => (m.at(x - 1, y) && m.at(x + 1, y) ? core : m.at(x, y - 1) && m.at(x, y + 1) ? core : edge));
  for (let y = m.y0; y <= m.y1; y++) for (let x = m.x0; x <= m.x1; x++) if (m.at(x, y)) for (const [dx, dy] of [[-1, 0], [1, 0]]) if (!m.at(x + dx, y + dy)) L.add(x + dx, y + dy, [60, 70, 140], 0.6);
}
// 斜めに降る雨 (短い筋)。inside(x,y) が偽の所には降らせない
function rain(L, n, seed, { x0 = 0, x1 = ART_W, y0 = 0, y1 = ART_H, slant = 0.35, len = 4, col = [150, 160, 210], a = 0.4, inside = null } = {}) {
  const R = rng(seed);
  for (let i = 0; i < n; i++) {
    const x = x0 + R() * (x1 - x0), y = y0 + R() * (y1 - y0), l = len * (0.6 + R() * 0.8);
    for (let k = 0; k < l; k++) { const px = x + k * slant, py = y + k; if (!inside || inside(px | 0, py | 0)) L.px(px, py, col, a * (0.5 + 0.5 * k / l)); }
  }
}
// 垂れた鎖 (端から端へ。輪を明暗交互の点で)
function chainSag(L, lights, x0, y0, x1, y1, sag, seed, { col = [92, 94, 108], amb = [0.12, 0.12, 0.15] } = {}) {
  const n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t + sag * 4 * t * (1 - t);
    const link = i % 3;
    if (link === 2) continue;
    L.px(x, y, lit(link ? mulc(col, 0.55) : col, lightAt(x, y, lights, 0, -0.5), amb));
    if (link === 0 && h2(i, 1, seed) > 0.5) L.px(x, y - 1, lit(mulc(col, 0.7), lightAt(x, y, lights), amb));
  }
}
// 焦げ跡の枝 (落雷の跡。中心から枝分かれして広がる黒い筋)
function scorch(L, cx, cy, seed, { n = 7, len = 16, sy = 0.45, a = 0.8 } = {}) {
  const R = rng(seed);
  const walk = (x, y, ang, l, depth) => {
    for (let i = 0; i < l; i++) {
      ang += (R() - 0.5) * 0.9; x += Math.cos(ang); y += Math.sin(ang) * sy;
      L.px(x, y, [10, 8, 10], a * (1 - i / (l + 4)));
      if (depth < 2 && R() < 0.12) walk(x, y, ang + (R() < 0.5 ? -0.8 : 0.8), l * 0.5, depth + 1);
    }
  };
  for (let k = 0; k < n; k++) walk(cx, cy, (k / n) * Math.PI * 2 + R() * 0.5, len * (0.6 + R() * 0.6), 0);
  const s = new Mask(L.w, L.h); s.ellipse(cx, cy, 5, 2.2);
  L.paint(s, (x, y) => [12, 10, 12, 0.7]);
}
// 焦げた木: worley の割れ目 (亀甲) と、黒い炭の面。keep(x,y) = 焦げずに残った所 (人業の木の色)
function charAlb(x, y, seed, keep = null) {
  if (keep && keep(x, y)) return mix(ALB_DOLL, ALB_DOLL_D, vnoise(x * 0.6, y * 0.6, seed) * 0.7);
  const w = worley(x * 0.55, y * 0.75, seed);
  if (w[1] - w[0] < 0.1) return [150, 88, 56];                       // 割れ目 (赤茶)
  return mix([22, 18, 22], [46, 40, 44], w[2] * 0.6 + (h2(x, y, seed) > 0.9 ? 0.6 : 0));
}

// 33. 焼け焦げた杖 (塔の中の螺旋階段の踊り場。向こうの壁を巡る階段が闇の上へ続き、手すりの鎖が上へ張られている。
//     踊り場の石に、雷に打たれて黒く焦げ、半ばで折れた木の杖。人業の腕の木を削った杖で、握りに肘の球関節と黒鉄の帯が残る。
//     そばに石で押さえた書きつけ。右の吹き抜けの底から風が吹き上げる)
function sceneStick() {
  const W = ART_W, H = ART_H, L = new Layer(W, H);
  const lights = [
    { x: 50, y: 76, r: 120, c: C_CANDLE, k: 1.6, p: 1.5 },            // 手元のランタン (手前。画面の外から照らす)
    { x: 10, y: 70, r: 70, c: C_CANDLE, k: 0.5, p: 1.4 },
    { x: 66, y: 44, r: 80, c: C_BOLT, k: 0.9, p: 1.3 },                // 狭間窓の稲光
    { x: 150, y: 20, r: 60, c: C_BOLT, k: 0.55, p: 1.3 },
    { x: 176, y: 140, r: 110, c: C_MIASMA, k: 0.8, p: 1.3 },          // 吹き抜けのはるか下 (沼の島) の淡い光
  ];
  // 狭間窓 (外は雷雲と稲妻)
  const sky = new Mask(W, H);
  for (const [wx, top, bot] of [[64, 34, 58], [152, 10, 32]]) { sky.rect(wx - 2.5, top + 3, 5, bot - top - 3); sky.poly([wx - 2.5, top + 3.5, wx, top - 1, wx + 2.5, top + 3.5]); }
  const bm = new Mask(W, H); boltMask(bm, 65, 34, 6, 713, { step: 4, jit: 3, branch: 1 });
  // 窓の外 (雲と稲妻) は別の層に描き、窓の中にだけ写す
  const keep = new Layer(W, H);
  stormClouds(keep, 0, 0, W - 1, 62, 711, { sx: 0.12, sy: 0.15, light: [150, 144, 190], flash: (x) => (Math.abs(x - 65) < 4 ? 0.8 : 0.3) });
  paintBolt(keep, bm);
  // 向こうの壁 (円筒の内側。左右の端ほど目地が詰まって暗い。上ほど闇)
  L.shade(0, 0, W - 1, H - 1, (x, y) => {
    if (sky.at(x, y)) return keep.get(x, y);
    const u = clamp((x - 100) / 120, -0.98, 0.98), xs = 100 + Math.asin(u) * 110;
    const a = ashlar(xs, y, 16, 8, 701);
    let alb = mix([78, 76, 94], [50, 48, 64], fbm(xs * 0.1, y * 0.12, 703));
    if (a.joint) alb = [20, 18, 28];
    else if (a.crack) alb = [30, 28, 38];
    // 窓の縁 (切り石の抱き)
    if (!sky.at(x, y) && (sky.at(x - 1, y) || sky.at(x + 1, y) || sky.at(x, y + 1) || sky.at(x - 2, y) || sky.at(x + 2, y))) alb = [104, 100, 120];
    const c = lit(alb, lightAt(x, y, lights, a.left ? -0.5 : 0, a.top ? -0.6 : 0), [0.06, 0.06, 0.09]);
    return mulc(c, (0.45 + 0.55 * (1 - u * u)) * (0.35 + 0.65 * clamp(y / 76)));
  });
  // 向こうの壁を巡る螺旋階段 (横から見た段の列。同じ向きに一巡りずつ上へ)。手すりの杭と鎖
  const flight = (base, seed, dim) => {
    const m = new Mask(W, H), sw = 7, sr = 2;
    for (let i = 0; i < 32; i++) {
      const x = -10 + i * sw, y = base - i * sr, yb = (xx) => base + 6 - (xx + 10) * sr / sw;
      m.poly([x, y, x + sw, y, x + sw, yb(x + sw), x, yb(x)]);
    }
    paintLit(L, m, (x, y) => (!m.at(x, y - 1) ? [150, 146, 164] : !m.at(x - 1, y) ? [104, 100, 120] : mix(ALB_WET, ALB_WET_D, fbm(x * 0.2, y * 0.3, seed))), lights, { nxMax: 2, amb: [0.07 * dim, 0.07 * dim, 0.1 * dim] });
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (m.at(x, y) && !m.at(x, y + 1)) L.px(x, y + 1, [8, 8, 12], 0.8);   // 段の下の影
    for (let i = 1; i < 32; i += 4) {
      const px = -10 + i * sw + 3, py = base - i * sr;
      const post = new Mask(W, H); post.rect(px, py - 7, 1, 7);
      paintLit(L, post, () => [70, 72, 86], lights, { amb: [0.08, 0.08, 0.1] });
      const qx = px + 4 * sw, qy = py - 4 * sr;
      chainSag(L, lights, px, py - 7, qx, qy - 7, 2.2, seed + i, { amb: [0.06 * dim, 0.06 * dim, 0.08 * dim] });
    }
  };
  flight(128, 715, 1); flight(88, 717, 1); flight(48, 719, 0.8); flight(8, 721, 0.6);
  // 吹き抜けの底 (右下。闇に沈み、はるか下から淡い光が上る)
  L.shade(110, 58, W - 1, H - 1, (x, y) => [6, 8, 10, clamp((y - 58) / 30) * 0.92]);
  glow(L, 172, 112, 46, [0.32, 0.46, 0.22], 0.35, 2);
  // 踊り場 (手前。石畳。右は吹き抜けへ落ちる縁)
  const land = new Mask(W, H); land.poly([-1, 72, 112, 76, 140, H + 1, -1, H + 1]);
  paintLit(L, land, (x, y) => {
    const w = worley(x * 0.06 * (1.8 - (y - 72) / 40), y * 0.18, 723);
    if (w[1] - w[0] < 0.06) return [24, 22, 30];
    if (!land.at(x, y - 1)) return [170, 166, 182];                                 // 縁の照り
    return mix([96, 94, 110], [138, 136, 150], w[2] * 0.6 + fbm(x * 0.2, y * 0.2, 725) * 0.3);
  }, lights, { ny: () => -0.9, nxMax: 1, amb: [0.07, 0.07, 0.1] });
  const side = new Mask(W, H); side.poly([112, 76, 116, 76, 144, H + 1, 140, H + 1]);   // 縁の切り口 (吹き抜け側)
  paintLit(L, side, (x, y) => mix([44, 42, 54], [30, 28, 40], vnoise(x, y * 0.3, 727)), lights, { amb: [0.05, 0.05, 0.08] });
  // 左: 手前の壁ぞいに上へ続く階段 (鉄の杭と鎖の手すり。画面の上へ抜ける)
  const tops = [];
  for (let i = 0; i < 9; i++) {
    const ty = 72 - (i + 1) * 10, xr = 36 - i * 4.4;
    const blk = new Mask(W, H); blk.rect(-1, ty, xr + 1, 10.5);
    paintLit(L, blk, (x, y) => (y - ty < 2 ? [150, 146, 160] : x > xr - 2 ? [96, 92, 110] : mix(ALB_WET, ALB_WET_D, fbm(x * 0.2, y * 0.25, 729 + i) * 0.8 + 0.2)), lights, { nxMax: 4, amb: [0.08, 0.08, 0.11] });
    for (let x = 0; x < xr; x++) L.px(x, ty + 10, [10, 10, 14], 0.6);
    if (i % 2 === 0) { const post = new Mask(W, H); post.rect(xr - 3, ty - 10, 1.6, 10); paintLit(L, post, () => [80, 82, 96], lights, { amb: [0.1, 0.1, 0.12] }); tops.push([xr - 2.2, ty - 10]); }
  }
  for (let i = 0; i + 1 < tops.length; i++) chainSag(L, lights, tops[i][0], tops[i][1], tops[i + 1][0], tops[i + 1][1], 2.6, 731 + i, { col: [120, 122, 138] });
  chainSag(L, lights, tops[tops.length - 1][0], tops[tops.length - 1][1], tops[tops.length - 1][0] - 10, -4, 1.5, 733, { col: [120, 122, 138] });
  { const p0 = new Mask(W, H); p0.rect(36, 59, 1.8, 13); paintLit(L, p0, () => [80, 82, 96], lights, { amb: [0.1, 0.1, 0.12] }); chainSag(L, lights, 37, 59, tops[0][0], tops[0][1], 2, 735, { col: [120, 122, 138] }); }
  // 落雷の焦げ跡 (杖が折れたところを中心に)
  scorch(L, 85, 87, 737, { n: 10, len: 22 });
  // 焼け焦げて折れた杖 (二つに。左の握りには肘の球関節と黒鉄の帯が焦げ残る)
  const SA = [[52, 91], [82, 82]], SB = [[88, 84], [124, 92]];
  const sa = new Mask(W, H), sb = new Mask(W, H);
  sa.line(SA[0][0], SA[0][1], SA[1][0], SA[1][1], 4.4, 1, 3.8);
  dotLine(sa, 82, 82, 86, 79.4); dotLine(sa, 82, 83.4, 85.4, 83); dotLine(sa, 81, 80.6, 83.4, 78.6);   // 折れ口のささくれ
  sb.line(SB[0][0], SB[0][1], SB[1][0], SB[1][1], 3.8, 1, 2.8);
  dotLine(sb, 88, 83.6, 85, 81.6); dotLine(sb, 88, 85.4, 85.4, 86); dotLine(sb, 89, 82.4, 87, 80.4);
  const knob = new Mask(W, H); knob.ellipse(48, 92.4, 4.8, 4.4);
  const band = new Mask(W, H); band.line(54, 89, 55, 94, 2.4);
  for (const [m, sd] of [[sa, 739], [sb, 741]]) paintLit(L, m, (x, y) => (!m.at(x, y - 1) ? (h2(x, y, sd) > 0.3 ? [200, 192, 204] : [120, 112, 124]) : charAlb(x, y, sd, m === sa ? (xx) => xx < 60 && h2(xx, y, 743) > 0.3 : null)), lights, { ny: (x, y) => vNormal(m, x, y, 2) * 1.2 - 0.3, nxMax: 2, amb: [0.42, 0.4, 0.42] });
  paintLit(L, knob, (x, y) => charAlb(x, y, 745, (xx, yy) => yy > 92 || xx < 46), lights, { ny: (x, y) => vNormal(knob, x, y, 3) * 1.1 - 0.2, amb: [0.4, 0.38, 0.4] });
  paintLit(L, band, () => [64, 66, 80], lights, { amb: [0.16, 0.16, 0.2] });
  for (const m of [sa, sb, knob]) rimLight(L, m, lights, [120, 130, 200], 0.6);
  for (const [x, y] of [[84, 80], [86, 82], [87, 84], [83, 83]]) glow(L, x, y, 3, [0.5, 0.6, 1.0], 0.25, 2);   // 折れ口に残る雷の名残
  // 石で押さえた書きつけ (風で端がめくれる)
  const note = new Mask(W, H); note.poly([58, 94, 74, 92.6, 75.4, 99.6, 59, 101]);
  L.paint(note, (x, y) => {
    const ink = (y % 2 === 0) && x > 61 && x < 72 && y > 94 && y < 100 && h2(x, y, 747) > 0.3;
    return lit(ink ? [60, 48, 46] : ALB_PAPER, lightAt(x, y, lights, 0, -0.9), [0.34, 0.32, 0.3]);
  });
  const flap = new Mask(W, H); flap.poly([71, 99.8, 75.4, 99.6, 77, 95.2]);              // めくれた角 (裏が明るい)
  L.paint(flap, (x, y) => lit([236, 224, 190], lightAt(x, y, lights), [0.4, 0.38, 0.36]));
  const st = new Mask(W, H); st.ellipse(61.4, 94.6, 4, 2.8);
  paintLit(L, st, () => [104, 102, 112], lights, { ny: (x, y) => vNormal(st, x, y, 2), amb: [0.12, 0.12, 0.14] });
  // 吹き上げる風 (吹き抜けから昇る塵と、細い筋)
  { const R = rng(749); for (let i = 0; i < 34; i++) { const x = 110 + R() * 86, y = 24 + R() * 84; if (land.at(x, y)) continue; const l = 3 + R() * 4, c = R() < 0.5 ? -1 : 1; for (let k = 0; k < l; k++) L.px(x + c * Math.sin(k * 0.6) * 1.4, y - k, [170, 184, 160], 0.12 + 0.3 * (k / l)); } }   // 吹き上がる塵の筋
  { const R = rng(755); for (let i = 0; i < 9; i++) { const x = 120 + R() * 70, y = 20 + R() * 70; if (land.at(x, y)) continue; L.px(x, y, [200, 190, 160]); L.px(x + 1, y - 1, [150, 140, 120]); } }   // 舞い上がる紙くず
  { const R = rng(751); for (let i = 0; i < 26; i++) { const x = R() * W, y = R() * 90; L.px(x, y, [190, 196, 210], 0.55); } }
  motes(L, lights, 30, 753, [0.9, 0.82, 0.6]);
  vignette(L, 0.84);
  return L.canvas(12, STORM_PAL);
}

// 34. 一門の鐘 (鐘楼。開いた拱の外は雷雲と雨。梁から吊られた大鐘を下から仰ぐと、口の中は空ろで、舌を吊る鉤だけが残る。
//     鐘の縁の帯に一門の印 (灯を掌に載せた手) の浮き彫り。外された舌は床に横たえられ、そばに師の札)
function sceneBell() {
  const W = ART_W, H = ART_H, L = new Layer(W, H);
  const BX = 96, BT = 12, BL = 70, GY = 88;                          // 鐘の中心・肩・口・床
  const lights = [
    { x: 30, y: 94, r: 150, c: C_CANDLE, k: 1.2, p: 1.5 },            // 手元のランタン (左手前)
    { x: 168, y: 26, r: 120, c: C_BOLT, k: 0.95, p: 1.2 },             // 右の拱の稲光
    { x: 24, y: 30, r: 90, c: C_BOLT, k: 0.45, p: 1.3 },
    { x: BX, y: 8, r: 50, c: C_BOLT, k: 0.4, p: 1.3 },
  ];
  // 奥の壁と三つの尖った拱 (外は雷雲)
  const arch = new Mask(W, H);
  for (const ax of [28, BX, 164]) for (let y = 6; y < GY - 4; y++) { const t = (y - 6) / 26, hw = 22 * (y < 32 ? Math.sqrt(clamp(1 - (1 - t) * (1 - t))) : 1); arch.rect(ax - hw, y, hw * 2, 1); }
  const bolt = new Mask(W, H); boltMask(bolt, 170, 6, 13, 801, { step: 5, jit: 7, branch: 3 });
  stormClouds(L, 0, 0, W - 1, GY, 803, { sx: 0.05, sy: 0.08, light: [140, 132, 180], flash: (x, y) => clamp(1 - Math.abs(x - 168) / 50) * 0.8 });
  L.paint(bolt, (x, y) => (arch.at(x, y) ? (bolt.at(x - 1, y) || bolt.at(x + 1, y) ? [240, 244, 255] : [190, 204, 250]) : null));
  rain(L, 160, 805, { y1: GY, slant: -0.35, len: 5, inside: (x, y) => arch.at(x, y) });
  L.shade(0, 0, W - 1, GY - 1, (x, y) => {
    if (arch.at(x, y)) return null;
    const a = ashlar(x, y, 18, 9, 807);
    let alb = mix([80, 78, 96], [54, 52, 68], fbm(x * 0.1, y * 0.12, 809));
    if (a.joint) alb = [20, 18, 28];
    const rim = arch.at(x + 2, y) || arch.at(x - 2, y) || arch.at(x, y + 2);
    if (rim) alb = [118, 114, 134];
    return lit(alb, lightAt(x, y, lights, a.left ? -0.5 : 0, a.top ? -0.6 : 0), [0.06, 0.06, 0.09]);
  });
  // 拱の敷居 (雨に濡れて光る)
  L.shade(0, GY - 4, W - 1, GY - 1, (x, y) => lit(y === GY - 4 ? [150, 150, 176] : [70, 70, 88], lightAt(x, y, lights, 0, -0.9), [0.08, 0.08, 0.12]));
  // 床 (板張り。奥へすぼまる板目。雨が吹きこんで濡れたところが稲光を映す)
  L.shade(0, GY, W - 1, H - 1, (x, y) => {
    const t = (y - GY) / (H - GY), u = (x - BX) / (0.6 + t * 1.4), plank = Math.abs((u * 0.12 + 50) % 1 - 0.5) > 0.46;
    let alb = mix([140, 104, 70], [176, 132, 88], fbm(u * 0.05, y * 0.6, 811) * 0.7);
    if (plank) alb = [30, 22, 18];
    const c = lit(alb, lightAt(x, y, lights, 0, -0.9), [0.08, 0.07, 0.09]);
    if (vnoise(x * 0.15, y * 0.5, 813) > 0.72 && t < 0.6) { c[0] += 18; c[1] += 22; c[2] += 40; }   // 濡れた板の照り
    return c;
  });
  // 梁と、鐘を吊る鉄の金具
  const beam = new Mask(W, H); beam.rect(0, 0, W, 6); beam.rect(BX - 34, 0, 6, 12); beam.rect(BX + 28, 0, 6, 12);
  paintLit(L, beam, (x, y) => (y === 5 ? [60, 42, 30] : mix(ALB_WOOD_D, [80, 56, 38], fbm(x * 0.1, y * 0.5, 815))), lights, { amb: [0.1, 0.08, 0.1] });
  const yoke = new Mask(W, H); yoke.rect(BX - 7, 5, 14, 3); yoke.rect(BX - 2, 7, 4, 6);
  paintLit(L, yoke, () => [70, 72, 86], lights, { amb: [0.12, 0.12, 0.15] });
  // 大鐘 (下から仰ぐ。口の楕円の中が空ろな内側)
  const MR = 40, MRY = 11;
  const hw = (y) => { const t = clamp((y - BT) / (BL - BT)); return 14 + 9 * smooth(0, 0.3, t) + 5 * t + 13 * Math.pow(t, 4); };
  const outer = new Mask(W, H), mouth = new Mask(W, H);
  outer.ellipse(BX, BT + 1, 14, 4);
  for (let y = BT; y <= BL; y++) outer.rect(BX - hw(y), y, hw(y) * 2, 1);
  mouth.ellipse(BX, BL, MR, MRY);
  const front = (x) => BL - MRY * Math.sqrt(clamp(1 - ((x - BX) / MR) ** 2));   // 口の手前の縁 (上の弧)
  const bronze = (x, y) => {
    const n = vnoise(x * 0.3, y * 0.3, 817), pat = vnoise(x * 0.5, y * 0.25, 819) > 0.72 && n > 0.5;
    const ridge = Math.abs(Math.sin(y * 0.9)) < 0.08;
    return pat ? mix([86, 120, 98], [110, 140, 112], n) : mix([156, 108, 56], [182, 134, 74], n * 0.6 + (ridge ? 0.4 : 0));   // 青錆の斑
  };
  paintLit(L, outer, (x, y) => (y >= front(x) ? null : bronze(x, y)), lights, { nxMax: 14, amb: [0.12, 0.11, 0.14] });
  // 胴の飾り帯 (二本の盛り上がった輪。口の弧に沿って曲がる)
  for (const [dy, k] of [[-24, 0.6], [-9, 1]]) for (let x = BX - MR; x <= BX + MR; x++) {
    const yy = front(x) + dy * (0.86 + 0.14 * k) + MRY * 0.15 * k;
    const ww = hw(yy); if (Math.abs(x - BX) > ww - 1) continue;
    L.add(x, yy, [70, 56, 30], 0.9); L.px(x, yy + 1, lit([60, 40, 22], lightAt(x, yy, lights), [0.1, 0.1, 0.12]));
  }
  // 口の内側 (空ろ。奥の内壁にだけ灯が届く。天井の真ん中に、舌を吊っていた鉤だけ)
  L.paint(mouth, (x, y) => {
    if (y < front(x) - 0.5) return null;
    const d = Math.hypot((x - BX) / MR, (y - BL) / MRY);
    const back = (y - BL) / MRY;                                           // 下ほど奥の内壁
    const alb = mix([26, 18, 14], [150, 104, 60], clamp(back * 0.7 + 0.3) * clamp(d * 1.6 - 0.25));
    return lit(alb, lightAt(x, y + 6, lights, 0, -0.5), [0.16, 0.14, 0.14]);
  });
  // 口の縁 (手前は厚く照り、奥の縁は細い線)
  for (let x = BX - MR; x <= BX + MR; x++) {
    const f = front(x), b = 2 * BL - f;
    for (let k = 0; k < 3; k++) L.px(x, f + k - 1, lit(k === 0 ? [220, 170, 100] : k === 1 ? [168, 120, 64] : [90, 60, 34], lightAt(x, f, lights, 0, -0.4), [0.16, 0.14, 0.14]));
    L.px(x, b, lit([150, 106, 60], lightAt(x, b, lights), [0.12, 0.11, 0.12]));
  }
  const hook = new Mask(W, H); hook.rect(BX - 1, BL - 5, 2, 5); hook.ellipse(BX, BL + 1.6, 3.4, 3); hook.ellipse(BX, BL + 1.6, 1.8, 1.5, 0);
  L.paint(hook, (x, y) => lit(hook.at(x, y - 1) ? [110, 112, 128] : [170, 172, 190], lightAt(x, y + 8, lights), [0.3, 0.3, 0.34]));
  for (let k = 0; k < 4; k++) L.px(BX + 3, BL + 3 + k, [70, 50, 36]);                          // ちぎれた革の吊り紐
  // 縁の帯の一門の印 (浮き彫り。磨かれて金に光る)
  const ch = new Mask(W, H), cf = new Mask(W, H); crestMask(ch, cf, BX + 0.5, BL - 17, 1.5);
  for (let y = ch.y0; y <= ch.y1 + 1; y++) for (let x = ch.x0 - 1; x <= ch.x1 + 1; x++) if (!ch.at(x, y) && !cf.at(x, y) && (ch.at(x - 1, y - 1) || cf.at(x - 1, y - 1))) L.px(x, y, [40, 26, 14], 0.8);   // 浮き彫りの影
  L.paint(ch, (x, y) => lit(!ch.at(x - 1, y) || !ch.at(x, y - 1) ? [255, 226, 150] : [186, 140, 70], lightAt(x, y, lights), [0.5, 0.44, 0.38]));
  L.paint(cf, (x, y) => lit(cf.at(x, y - 1) ? [255, 214, 128] : [196, 140, 64], lightAt(x, y, lights), [0.6, 0.52, 0.42]));
  for (const sx of [-26, 26]) { const h1m = new Mask(W, H), f1m = new Mask(W, H); crestMask(h1m, f1m, BX + sx, BL - 7 - Math.abs(sx) * 0.08, 0.6); L.paint(h1m, (x, y) => lit([176, 134, 70], lightAt(x, y, lights), [0.3, 0.26, 0.22])); L.paint(f1m, () => [214, 160, 80]); }
  const ov = new Mask(W, H); for (let y = outer.y0; y <= outer.y1; y++) for (let x = outer.x0; x <= outer.x1; x++) if (outer.at(x, y) && y < front(x)) ov.rect(x, y, 1, 1);
  rimLight(L, ov, lights, [140, 160, 230], 0.9);
  // 床に横たえた鐘の舌 (鉄の棒と玉。上の輪に師の札を結ぶ)
  const tongue = new Mask(W, H);
  tongue.line(124, 98, 158, 92, 3.6, 1, 4.6); tongue.ellipse(163, 91.4, 7, 6);
  const ring = new Mask(W, H); ring.ellipse(120.4, 98.8, 3.4, 3); ring.ellipse(120.4, 98.8, 1.6, 1.3, 0);
  paintLit(L, tongue, (x, y) => (!tongue.at(x, y - 1) ? [190, 192, 210] : mix([110, 112, 128], [70, 70, 86], vnoise(x * 0.4, y * 0.4, 821))), lights, { ny: (x, y) => vNormal(tongue, x, y, 3) * 0.8, nxMax: 4, amb: [0.3, 0.3, 0.34] });
  paintLit(L, ring, () => [150, 152, 170], lights, { amb: [0.3, 0.3, 0.34] });
  for (let x = 118; x < 174; x++) { const top = tongue.y0; for (let y = 90; y < 104; y++) if ((tongue.at(x, y) || ring.at(x, y)) && !tongue.at(x, y + 1) && !ring.at(x, y + 1)) { L.px(x, y + 1, [12, 10, 10], 0.7); break; } }
  rimLight(L, tongue, lights, [130, 150, 220], 0.6);
  const cord = new Mask(W, H); dotLine(cord, 117.6, 99.6, 112, 102.6);
  L.paint(cord, (x, y) => lit([190, 170, 120], lightAt(x, y, lights), [0.3, 0.28, 0.24]));
  const tag = new Mask(W, H); tag.poly([100, 101, 112, 99.6, 113.4, 106.4, 101.4, 107.8]);
  L.paint(tag, (x, y) => {
    const ink = (y % 2 === 1) && x > 102 && x < 111 && y > 101 && y < 107 && h2(x, y, 823) > 0.35;
    return lit(ink ? [56, 44, 42] : [232, 218, 180], lightAt(x, y, lights, 0, -0.9), [0.5, 0.48, 0.46]);
  });
  rain(L, 50, 825, { x0: 120, x1: W, y0: GY, y1: H, slant: -0.35, len: 3, a: 0.25 });
  motes(L, lights, 24, 827, [0.85, 0.9, 1.0]);
  vignette(L, 0.82);
  return L.canvas(12, STORM_PAL);
}

// 35. 雷よけの書きつけ (塔の外壁を巡る吹きさらしの回廊。手すりの杭に、鉄の棒を銅線で巻きつけた即席の避雷針。
//     打たれた鉄の手すりは黒く焦げて溶け、杭に結ばれた師の書きつけが風にはためく。外は雷雲と稲妻、横殴りの雨)
function sceneRod() {
  const W = ART_W, H = ART_H, L = new Layer(W, H);
  const PX = 150, RT = 50;                                              // 手前の杭・手すりの高さ
  const lights = [
    { x: 104, y: 26, r: 170, c: C_BOLT, k: 1.15, p: 1.2 },            // 稲光
    { x: 20, y: 86, r: 120, c: C_CANDLE, k: 1.1, p: 1.4 },              // 手元のランタン
    { x: 36, y: 52, r: 40, c: C_CANDLE, k: 0.6, p: 1.5 },              // 塔の戸口の灯
  ];
  const boltM = new Mask(W, H); boltMask(boltM, 106, -2, 12, 851, { dx: 0.3, step: 5, jit: 9, branch: 4, w: 2 });
  stormClouds(L, 0, 0, W - 1, H - 1, 853, { sx: 0.03, sy: 0.06, light: [128, 120, 166], flash: (x, y) => clamp(1 - Math.hypot(x - 106, (y - 26) * 0.7) / 110) });
  paintBolt(L, boltM);
  glow(L, 106, 24, 40, C_BOLT, 0.3, 2);
  // 遠くの稲妻 (細い)
  const far = new Mask(W, H); boltMask(far, 178, 0, 9, 855, { step: 4, jit: 5, branch: 2 });
  L.paint(far, () => [150, 160, 220]);
  // 塔の外壁 (左。円筒の側面。右の縁ほど暗い)
  const WX = 60;
  const wall = new Mask(W, H); wall.rect(-1, -1, WX + 1, H + 2);
  paintLit(L, wall, (x, y) => {
    const u = x / WX, xs = Math.asin(clamp(u * 1.7 - 0.7, -0.99, 0.99)) * 40;
    const a = ashlar(xs + 40, y, 14, 7, 857);
    let alb = mix(ALB_WET, ALB_WET_D, fbm(xs * 0.1, y * 0.12, 859));
    if (a.joint) alb = [22, 20, 30];
    if (vnoise(x * 0.4, y * 0.05, 861) > 0.7) alb = mix(alb, [120, 124, 150], 0.3);   // 雨の筋
    return mulc(alb, 1 - 0.55 * u * u);
  }, lights, { nxMax: 30, amb: [0.08, 0.08, 0.12] });
  // 戸口 (塔の中へ。奥に灯)
  const door = new Mask(W, H); door.rect(28, 42, 14, 24); door.ellipse(35, 42, 7, 5);
  L.paint(door, (x, y) => mix([40, 26, 16], [140, 96, 50], clamp(1 - Math.hypot(x - 35, y - 54) / 12)));
  for (let y = 36; y < 66; y++) for (let x = 25; x < 45; x++) if (!door.at(x, y) && (door.at(x + 2, y) || door.at(x - 2, y) || door.at(x, y + 2))) L.px(x, y, lit([110, 106, 124], lightAt(x, y, lights), [0.1, 0.1, 0.13]));
  // 回廊の床 (手前から左奥へ、塔の向こうへ回りこむ。濡れて稲光を映す)
  const edge = (y) => { const t = clamp((y - 58) / 50); return 66 + 84 * t * t * 0.6 + 84 * t * 0.4; };   // 外側の縁の x
  const floor = new Mask(W, H);
  for (let y = 60; y < H; y++) floor.rect(-1, y, edge(y) + 1, 1);
  paintLit(L, floor, (x, y) => {
    const t = (y - 60) / 48, w = worley(x * 0.08 / (0.4 + t), y * 0.2 / (0.4 + t), 863);
    if (w[1] - w[0] < 0.06) return [24, 24, 32];
    return mix([66, 66, 84], [100, 100, 118], w[2] * 0.6);
  }, lights, { ny: () => -0.9, nxMax: 1, amb: [0.1, 0.1, 0.14] });
  for (let y = 60; y < H; y++) for (let x = 0; x < edge(y); x++) {                 // 水溜まりに映る稲光
    const wet = vnoise(x * 0.08, y * 0.35, 865);
    if (wet > 0.6) L.add(x, y, [70, 80, 130], (wet - 0.6) * 2.2 * clamp(1 - Math.abs(x - 100) / 90));
  }
  const lip = new Mask(W, H); for (let y = 60; y < H; y++) lip.rect(edge(y), y, 2 + (y - 60) * 0.08, 1);
  paintLit(L, lip, () => [70, 70, 88], lights, { amb: [0.08, 0.08, 0.1] });
  // 手すり (外側の縁に沿って杭と鉄の横木。手前ほど大きく、いちばん手前が避雷針を結わえた太い杭)
  const rail = new Mask(W, H), scorched = new Mask(W, H);
  const ph = (y) => 4 + (y - 60) * 0.95;                                  // 杭の高さ
  const posts = [61, 63.4, 66.6, 71, 77, 85, 96].map((y) => [edge(y) - 1, y, ph(y), 1 + (y - 60) * 0.06]);
  posts.push([PX - 2, H + 4, H + 4 - RT, 5]);
  for (const [i, [x, y, h, w]] of posts.entries()) {
    rail.rect(x, y - h, w, h);
    if (i) { const [px, py, phh, pw] = posts[i - 1]; rail.line(px, py - phh, x, y - h, Math.max(1, pw * 0.9), 1, Math.max(1, w * 0.55)); rail.line(px, py - phh * 0.5, x, y - h * 0.5, Math.max(1, pw * 0.6), 1, Math.max(1, w * 0.4)); }
  }
  rail.rect(PX - 4, RT - 2, 8, 3);                                         // 杭の頭
  const [qx, qy, qh] = posts[posts.length - 2];
  scorched.line(qx + 6, qy - qh + (RT - qy + qh) * 0.25, PX, RT, 5, 1, 5);  // 打たれた横木 (杭に近いほど黒い)
  scorched.rect(PX - 4, RT - 3, 8, 22);
  paintLit(L, rail, (x, y) => {
    if (scorched.at(x, y)) return h2(x, y, 867) > 0.8 ? [150, 140, 150] : [30, 26, 30];   // 焦げて黒い (溶けた粒が光る)
    return mix([110, 112, 130], [70, 72, 88], vnoise(x * 0.4, y * 0.4, 869));
  }, lights, { nxMax: 3, ny: (x, y) => vNormal(rail, x, y, 2) * 0.6, amb: [0.14, 0.14, 0.18] });
  rimLight(L, rail, lights, [150, 170, 240], 1.0);
  // 溶けて垂れた鉄 (焦げた横木の下)
  for (const [x, l] of [[126, 3], [131, 5], [136, 2], [141, 4]]) { const y0 = qy - qh + (RT - qy + qh) * ((x - qx) / (PX - qx)) + 2; for (let k = 0; k < l; k++) L.px(x, y0 + k, k === l - 1 ? [170, 170, 190] : [40, 36, 40]); }
  // 即席の避雷針 (鉄の棒を杭に立て、銅線をぐるぐると巻いて、端を回廊の外へ垂らす)
  const rod = new Mask(W, H); rod.rect(PX - 1, 6, 2.4, RT + 22 - 6); rod.poly([PX - 1, 6, PX + 1.4, 6, PX + 0.2, 0]);
  paintLit(L, rod, (x, y) => (x < PX ? [190, 190, 210] : [90, 90, 108]), lights, { amb: [0.2, 0.2, 0.24] });
  glow(L, PX, 2, 7, C_BOLT, 0.3, 2);
  const coil = new Mask(W, H);
  for (let y = 24; y < RT + 20; y += 2.2) dotLine(coil, PX - 2.4, y + 1.4, PX + 2.8, y);                // 巻きつけた銅線 (斜めの輪)
  L.paint(coil, (x, y) => lit(coil.at(x, y - 1) ? [150, 74, 34] : [236, 150, 84], lightAt(x, y, lights), [0.5, 0.42, 0.38]));
  const wire = new Mask(W, H); { let x = PX + 3, y = RT + 20; for (let k = 0; k < 24; k++) { const nx = x + 1.5 + Math.sin(k * 0.5) * 0.7, ny = y + 1.6; dotLine(wire, x, y, nx, ny); x = nx; y = ny; } }
  L.paint(wire, (x, y) => lit([226, 140, 76], lightAt(x, y, lights), [0.5, 0.42, 0.38]));
  // 杭に結んだ師の書きつけ (紐で縛り、風にはためく)
  const cord = new Mask(W, H); dotLine(cord, PX - 3, 62, 138, 64); dotLine(cord, PX - 3, 64, 139, 64.6);
  L.paint(cord, (x, y) => lit([210, 190, 140], lightAt(x, y, lights), [0.4, 0.38, 0.34]));
  const note = new Mask(W, H); note.poly([138, 62, 124, 55, 118, 68, 127, 67, 136, 73]);
  L.paint(note, (x, y) => {
    const ink = (Math.round(y + (x - 124) * 0.35) % 3 === 0) && note.at(x - 1, y) && note.at(x + 1, y) && note.at(x, y - 1) && note.at(x, y + 1) && h2(x, y, 871) > 0.35;
    const fold = Math.abs(x - 129 - (y - 62) * 0.3) < 0.5;
    return lit(ink ? [64, 52, 50] : fold ? [180, 168, 138] : [236, 224, 188], lightAt(x, y, lights), [0.5, 0.48, 0.46]);
  });
  // 横殴りの雨と、手すりに当たるしぶき
  rain(L, 260, 873, { slant: -0.45, len: 6, a: 0.35, col: [160, 170, 220] });
  { const R = rng(875); for (let i = 0; i < 30; i++) { const t = R(), x = 96 + t * 52, y = 30 + t * 18 + R() * 4; L.px(x, y - 2, [200, 210, 250], 0.6); } }
  vignette(L, 0.8);
  return L.canvas(12, STORM_PAL);
}

// 魂縛りの像 (頭巾の石像。両腕を空へ掲げ、腕の先が鎖になって上へ伸びる)。(x, by) = 台座の下の中央、s = 大きさ。
// broken = 膝から上が砕けて無い (台座と脚の根と、散らばった石と、落ちた鎖だけ)。返り値 = 両腕の先 (鎖の根もと)
function soulStatue(L, lights, x, by, s, seed, { broken = false, amb = [0.14, 0.14, 0.17], fog = 0 } = {}) {
  const P = (pts) => pts.map((v, i) => (i % 2 ? by - v * s : x + v * s));
  const base = new Mask(L.w, L.h), body = new Mask(L.w, L.h), face = new Mask(L.w, L.h);
  base.poly(P([-6, 0, 6, 0, 5.4, 3.6, -5.4, 3.6]));
  if (broken) {
    body.poly(P([-3.6, 3.6, 3.6, 3.6, 3.2, 7, 2, 9.6, 0.6, 7.2, -1, 10.6, -2.2, 7.6, -3.4, 8.8]));   // 砕けた脚の根
  } else {
    body.poly(P([-5.2, 3.6, 5.2, 3.6, 4.4, 10, 3.6, 16, 4.4, 19, 3, 20.8, -3, 20.8, -4.4, 19, -3.6, 16, -4.4, 10]));   // 衣の胴 (裾が広がる)
    body.ellipse(x, by - 24 * s, 3 * s, 3.4 * s); body.poly(P([-2.6, 24.6, 2.6, 24.6, 0.4, 29.4]));                       // 頭巾
    body.line(x - 3.6 * s, by - 19.4 * s, x - 7.8 * s, by - 31 * s, 2.4 * s, 1, 1.8 * s);                                   // 掲げた両腕
    body.line(x + 3.6 * s, by - 19.4 * s, x + 7.8 * s, by - 31 * s, 2.4 * s, 1, 1.8 * s);
    face.ellipse(x, by - 23.4 * s, 1.5 * s, 1.9 * s);                                                                       // 頭巾の中の闇
  }
  const stone = (xx, yy) => mix([150, 148, 162], [92, 90, 106], vnoise(xx * 0.5, yy * 0.4, seed) * 0.7);
  paintLit(L, base, stone, lights, { ny: (xx, yy) => vNormal(base, xx, yy, 2), amb });
  paintLit(L, body, stone, lights, { nxMax: 6, amb });
  L.paint(face, () => [12, 12, 18]);
  rimLight(L, body, lights, [130, 230, 210], 0.9);
  if (fog) for (let yy = Math.min(body.y0, base.y0); yy <= base.y1; yy++) for (let xx = Math.min(body.x0, base.x0); xx <= Math.max(body.x1, base.x1); xx++) if (body.at(xx, yy) || base.at(xx, yy)) L.px(xx, yy, [36, 40, 56], fog);
  if (broken) {                                                                     // 散らばった石と、たるんで床に落ちた鎖
    const R = rng(seed);
    for (let k = 0; k < 7; k++) { const m = new Mask(L.w, L.h); m.ellipse(x + (R() - 0.3) * 18 * s, by + 1 + R() * 3 * s, 1 + R() * 1.6 * s, 0.8 + R() * s); paintLit(L, m, stone, lights, { ny: (xx, yy) => vNormal(m, xx, yy, 2), amb }); }
    chainSag(L, lights, x + 2 * s, by - 6 * s, x + 16 * s, by + 3 * s, 1.5, seed + 3, { col: [150, 152, 170], amb });
    return null;
  }
  return [[x - 7.8 * s, by - 31.4 * s], [x + 7.8 * s, by - 31.4 * s]];
}

// 36. 嵐の主の記憶 (塔の頂。火のともらない大きな灯台が立ち、割れた大レンズは暗い。そのまわりを魂縛りの像が輪になって囲み、
//     鎖の腕に縛られた魂の光が渦を巻いて昇り、雷雲になる。像のひとつは砕けている。遠くの雷雲の切れ間に、石橋と、
//     すり鉢状の石の観客席の影)
function sceneStormLord() {
  const W = ART_W, H = ART_H, L = new Layer(W, H);
  const CX = 84, VY = 14;                                              // 渦の中心 (灯台の真上)
  const lights = [
    { x: CX, y: VY + 4, r: 140, c: C_SOUL, k: 1.0, p: 1.2 },          // 縛られた魂の渦
    { x: 150, y: -10, r: 110, c: C_BOLT, k: 0.7, p: 1.2 },             // 雲の中の稲光
    { x: 176, y: 40, r: 50, c: [0.9, 0.8, 0.7], k: 0.35, p: 1.4 },     // 雲の切れ間の薄明かり
  ];
  // 渦を巻く雷雲 (対数螺旋の腕。中心へ近いほど縛られた魂の光を帯びる)
  L.shade(0, 0, W - 1, H - 1, (x, y) => {
    const dx = x - CX, dy = (y - VY) * 2.2, r = Math.hypot(dx, dy) + 0.01, a = Math.atan2(dy, dx);
    const arm = Math.sin(a * 3 - Math.log(r) * 4.2);                              // 三本の螺旋の腕
    const f = fbm(x * 0.04 + Math.cos(a) * 2, y * 0.08 + Math.sin(a) * 2, 901);
    const t = clamp(f * 0.9 + arm * 0.28 + 0.05);
    let c = mix([14, 14, 24], [104, 98, 136], t * t);
    const soul = clamp(1 - r / 90) * clamp(arm * 0.7 + 0.35);
    c = [c[0] + 30 * soul, c[1] + 120 * soul, c[2] + 100 * soul];
    return c;
  });
  glow(L, CX, VY, 20, [0.6, 1.0, 0.9], 0.45, 2);
  // 雲の切れ間 (右。薄明かりの空に、石橋の先の、すり鉢状の観客席の影)
  const gap = new Mask(W, H); gap.poly([136, 46, 148, 37, 166, 32, 184, 31, 193, 33, 193, 52, 176, 56, 150, 54]);
  L.paint(gap, (x, y) => mix([190, 150, 136], [96, 88, 118], clamp((y - 31) / 25 + fbm(x * 0.1, y * 0.2, 903) * 0.25)));
  for (let y = gap.y0; y <= gap.y1; y++) for (let x = gap.x0; x <= gap.x1; x++) if (gap.at(x, y) && (!gap.at(x, y - 2) || !gap.at(x, y + 2))) L.px(x, y, [66, 62, 90], 0.7);
  const SIL = [38, 34, 50];
  const arena = new Mask(W, H);
  arena.poly([164, 50, 166, 41, 192, 41, 194, 50]);                                   // 観客席の外壁 (低い円筒)
  arena.ellipse(179, 41, 14, 2.6);
  L.paint(arena, (x, y) => (y < 41 && (x - 179) ** 2 / 110 + (y - 41) ** 2 / 3 < 1 ? [24, 22, 34] : SIL));   // すり鉢の内側は暗い
  for (let x = 167; x < 192; x += 3) { L.px(x, 44, [96, 88, 110]); L.px(x, 45, [96, 88, 110]); L.px(x + 1, 47.6, [80, 74, 96]); }   // 外壁の拱の列
  for (const [y0, x0, x1] of [[39.6, 170, 189], [40.8, 167, 191]]) for (let x = x0; x < x1; x++) if (x % 2) L.px(x, y0, [70, 64, 88]);   // 段の筋
  // 塔の頂の床 (楕円の石床と胸壁)
  const plat = new Mask(W, H); plat.ellipse(CX + 6, 94, 124, 24);
  paintLit(L, plat, (x, y) => {
    const w = worley(x * 0.07, y * 0.2, 905);
    if (w[1] - w[0] < 0.05) return [26, 24, 34];
    return mix([70, 68, 84], [100, 98, 114], w[2] * 0.6);
  }, lights, { ny: () => -0.9, nxMax: 1, amb: [0.1, 0.1, 0.13] });
  for (let x = 0; x < W; x++) { const y = 94 - 24 * Math.sqrt(clamp(1 - ((x - CX - 6) / 124) ** 2)); for (let k = 0; k < 3; k++) L.px(x, y - k, lit(k === 2 ? [130, 128, 144] : [74, 72, 88], lightAt(x, y, lights), [0.12, 0.12, 0.15])); }
  // 石橋 (頂の縁から、雲を越えて観客席へ。奥ほど細い)
  const bridge = new Mask(W, H);
  bridge.poly([150, 72, 166, 51, 168, 51.4, 155, 74]);
  for (let k = 0; k < 5; k++) { const t = k / 5 + 0.15, bx = 150 + (t - 0.15) * 18, by = 72 - (t - 0.15) * 24, h = 6 - t * 4; bridge.rect(bx, by, Math.max(1, 2 - t), h); }   // 橋脚
  L.paint(bridge, (x, y) => (bridge.at(x, y - 1) ? SIL : [80, 76, 100]));
  // 像の輪 (奥の像から先に描く)
  const ring = [];
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i / 7) * Math.PI * 2 + 0.22;
    ring.push({ a, x: CX + Math.cos(a) * 70, y: 88 + Math.sin(a) * 14, back: Math.sin(a) < -0.2 });
  }
  ring.sort((p, q) => p.y - q.y);
  const breakP = ring.filter((p) => !p.back).sort((p, q) => q.x - p.x)[0];          // 師が壊した像 (手前の右)
  const arms = [];
  const drawStatue = (p, i) => {
    const s = 0.72 + (p.y - 74) / 28 * 0.62;
    const tips = soulStatue(L, lights, p.x, p.y, s, 907 + i, { broken: p === breakP, fog: p.back ? 0.3 : 0 });
    if (tips) for (const q of tips) arms.push([q[0], q[1], s, p.back]);
  };
  // 縛られた魂: 鎖の腕の先から、渦の中心へ巻きこまれて昇る光の筋 (根もとは張った鎖)
  const strand = (x0, y0, s, back) => {
    const cx0 = x0, cy0 = y0 - 10 * s;                                                // 張った鎖は真上へ
    for (let k = 0; k < 10 * s; k++) { const y = y0 - k; L.px(x0, y, (k | 0) % 2 ? [50, 52, 64] : lit([160, 162, 180], lightAt(x0, y, lights), [0.24, 0.24, 0.28])); if ((k | 0) % 2 === 0) L.px(x0 + 1, y, [70, 72, 86]); }
    x0 = cx0; y0 = cy0;
    const a0 = Math.atan2((y0 - VY) * 2.2, x0 - CX), r0 = Math.hypot(x0 - CX, (y0 - VY) * 2.2);
    let px = x0, py = y0;
    for (let i = 1; i <= 40; i++) {
      const t = i / 40, a = a0 - t * 1.3, r = r0 * (1 - t * 0.95);
      const nx = CX + Math.cos(a) * r, ny = VY + Math.sin(a) * r / 2.2;
      const n = Math.max(1, Math.ceil(Math.hypot(nx - px, ny - py)));
      for (let k = 0; k < n; k++) {
        const x = px + (nx - px) * k / n, y = py + (ny - py) * k / n, d = Math.hypot(x - x0, y - y0);
        if (h2(x | 0, y | 0, 919) < 0.35 + t * 0.4) L.px(x, y, [150, 255, 225], clamp(0.9 - t * 0.5) * (back ? 0.55 : 0.9) * (d < 3 ? 0.5 : 1));   // 途切れがちな光の筋
      }
      px = nx; py = ny;
    }
  };
  ring.filter((p) => p.back).forEach(drawStatue);
  for (const [x0, y0, s, back] of arms) if (back) strand(x0, y0, s, true);
  // 火のともらない灯台 (石の胴・鉄の灯室・割れた大レンズ・笠)
  const tw = new Mask(W, H); tw.poly([CX - 15, 92, CX - 11, 52, CX + 11, 52, CX + 15, 92]);
  paintLit(L, tw, (x, y) => {
    const a = ashlar(x, y, 8, 5, 909);
    return a.joint ? [30, 28, 38] : mix([110, 106, 122], [72, 70, 84], fbm(x * 0.2, y * 0.2, 911));
  }, lights, { nxMax: 12, amb: [0.1, 0.1, 0.13] });
  const gal = new Mask(W, H); gal.rect(CX - 16, 50, 32, 3);
  paintLit(L, gal, () => [84, 84, 100], lights, { amb: [0.12, 0.12, 0.15] });
  const lens = new Mask(W, H); lens.ellipse(CX, 40, 9.6, 10);
  L.paint(lens, (x, y) => {
    const d = Math.hypot((x - CX) / 9.6, (y - 40) / 10), ringD = Math.abs((d * 5) % 1 - 0.5) < 0.18;
    const crack = Math.abs((x - CX) - (y - 40) * 0.55 + 1) < 0.6 || (Math.abs((x - CX) + 3 + (y - 40) * 0.9) < 0.5 && y > 40);
    if (crack) return [6, 6, 10];
    const refl = clamp(1 - Math.hypot(x - CX + 3, y - 34) / 8);
    return [26 + refl * 60 + (ringD ? 22 : 0), 38 + refl * 110 + (ringD ? 30 : 0), 48 + refl * 100 + (ringD ? 34 : 0)];   // 暗い硝子に魂の光が映る
  });
  const frame = new Mask(W, H); frame.rect(CX - 11, 29, 1.6, 21); frame.rect(CX + 9.6, 29, 1.6, 21); frame.rect(CX - 0.6, 29, 1.2, 21);
  paintLit(L, frame, () => [54, 56, 68], lights, { amb: [0.1, 0.1, 0.13] });
  const cap = new Mask(W, H); cap.poly([CX - 13, 30, CX, 20, CX + 13, 30]); cap.rect(CX - 0.6, 15, 1.4, 6);
  paintLit(L, cap, () => [70, 72, 86], lights, { amb: [0.1, 0.1, 0.13] });
  rimLight(L, cap, lights, [120, 220, 200], 0.9);
  rimLight(L, tw, lights, [120, 220, 200], 0.7);
  ring.filter((p) => !p.back).forEach((p, i) => drawStatue(p, i + 10));
  for (const [x0, y0, s, back] of arms) if (!back) strand(x0, y0, s, false);
  { const R = rng(913); for (let i = 0; i < 80; i++) { const t = R(), a = R() * Math.PI * 2, r = 6 + t * 64; const x = CX + Math.cos(a) * r, y = VY + Math.sin(a) * r / 2.2; L.px(x, y, [170, 255, 230], 0.4 + R() * 0.5); } }
  // 雲の中を走る稲妻
  const bm = new Mask(W, H); boltMask(bm, 146, 0, 6, 915, { dx: 2, step: 3, jit: 6, branch: 2 });
  paintBolt(L, bm, { core: [230, 236, 255], edge: [140, 160, 230] });
  memoryTint(L, [34, 34, 50], [21, 77]);
  motes(L, lights, 40, 917, [0.7, 1.0, 0.9]);
  return L.canvas(10, STORM_PAL);
}

const SCENES = { lantern: sceneLantern, sigil: sceneSigil, arm: sceneArm, abbot: sceneAbbot, camp: sceneCamp, candle: sceneCandle,
  roll: sceneRoll, cell: sceneCell, head: sceneHead, banner: sceneBanner, hole: sceneHole,
  rope: sceneRope, hut: sceneHut, torso: sceneTorso, tree: sceneTree,
  votive: sceneVotive, mural: sceneMural, legs: sceneLegs, priestking: scenePriestKing, sera: sceneSera,
  blade: sceneBlade, husks: sceneHusks, cup: sceneCup, cauldron: sceneCauldron,
  coat: sceneCoat, frozen: sceneFrozen, aurora: sceneAurora, frostking: sceneFrostKing,
  splint: sceneSplint, crest: sceneCrest, reeds: sceneReeds, swamplord: sceneSwampLord,
  stick: sceneStick, bell: sceneBell, rod: sceneRod, stormlord: sceneStormLord };
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
