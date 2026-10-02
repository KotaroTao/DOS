// タイトル画面 — 起動のたびに最初に出る「顔」
//
// 夜空の下、地の底へ螺旋に降りてゆく巨大な迷宮の口。縁に立つ魂繰りの指先から
// 魂の糸が深淵へ垂れ、喰われた魂が鬼火となって昇ってくる。
// 演出はすべて Canvas のドット絵 (低解像度で描いて pixelated で拡大) + DOM のロゴ。
//
// 2段階: ①「画面をタップ」で目覚める (ここで音声が解禁され、タイトル曲が流れる)
//        ② 冒険を始める/続けるボタンとセーブ概要が現れる
// showTitle({ hasSave, summary, onStart }) — summary: { head, lines[], sprites[] }
import { spriteCanvas } from "./sprites.js";
import { SFX } from "./audio.js";

const REDUCED = (() => {
  try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
})();

// 決定的な擬似乱数 (毎回同じ星空・同じ岩肌)
function hash(i, s = 0) {
  let h = (i * 2654435761 + s * 40503 + 12345) >>> 0;
  h ^= h >>> 13; h = Math.imul(h, 1274126177) >>> 0; h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// ---- ドット絵プリミティブ ----
function fillEllipse(g, cx, cy, rx, ry, col) {
  g.fillStyle = col;
  const r = Math.ceil(ry);
  for (let y = -r; y <= r; y++) {
    const t = y / ry;
    if (t < -1 || t > 1) continue;
    const half = rx * Math.sqrt(1 - t * t);
    g.fillRect(Math.round(cx - half), Math.round(cy + y), Math.max(1, Math.round(half * 2)), 1);
  }
}
// 4x4 ベイヤー行列による順序ディザ。色リストの間を縦方向に滑らかにつなぐ (ドット絵の空と大地)
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
function hex(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
function ditherV(g, x, y, w, h, cols) {
  const pal = cols.map(hex);
  const img = g.getImageData(x, y, w, h);
  const d = img.data;
  const n = pal.length - 1;
  for (let yy = 0; yy < h; yy++) {
    const t = (yy / Math.max(1, h - 1)) * n;
    const i0 = Math.min(n - 1, Math.floor(t)), f = t - i0;
    for (let xx = 0; xx < w; xx++) {
      const c = pal[(BAYER[((yy & 3) << 2) | (xx & 3)] + 0.5) / 16 < f ? i0 + 1 : i0];
      const o = (yy * w + xx) * 4;
      d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
    }
  }
  g.putImageData(img, x, y);
}

// ---- 静止レイヤー (サイズごとに一度だけ描く) ----
function buildStatic(W, H) {
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d", { willReadFrequently: true });
  const hz = Math.round(H * 0.45);          // 地平線
  const pcx = Math.round(W / 2);            // 迷宮の口の中心
  const pcy = Math.round(H * 0.625);
  const prx = Math.round(W * 0.47);
  const pry = Math.round(prx * 0.36);

  // 夜空 (天頂の闇 → 地平の紫)
  ditherV(g, 0, 0, W, hz, ["#030208", "#07050f", "#0d0919", "#161026", "#211534", "#2e1b40"]);
  // 月 (右上の隅): 欠けた蒼白の月
  const mx = Math.round(W * 0.86), my = Math.round(H * 0.055), mr = Math.max(8, Math.round(W * 0.06));
  fillEllipse(g, mx, my, mr + 3, mr + 3, "#151024");
  fillEllipse(g, mx, my, mr + 1, mr + 1, "#231b38");
  fillEllipse(g, mx, my, mr, mr, "#cfc6b4");
  fillEllipse(g, mx - 1, my - 1, mr - 2, mr - 2, "#e6dfcc");
  fillEllipse(g, mx + Math.round(mr * 0.45), my - Math.round(mr * 0.2), mr * 0.85, mr * 0.95, "#060410"); // 欠け
  g.fillStyle = "#b3a993";
  g.fillRect(mx - Math.round(mr * 0.5), my + 1, 2, 2);
  g.fillRect(mx - Math.round(mr * 0.2), my + Math.round(mr * 0.45), 2, 1);

  // 遠景の山並み
  for (let x = 0; x < W; x++) {
    const h1 = Math.round(hz - 5 - 10 * Math.abs(Math.sin(x * 0.04 + 1.3)) - 4 * hash(x >> 2, 3));
    g.fillStyle = "#1a1128";
    g.fillRect(x, h1, 1, hz - h1 + 2);
  }
  // 滅びた王都の影: 尖塔・円蓋・崩れた城壁 (近代的な箱にならないよう、屋根を尖らせる)
  const ruin = "#0f0a19";
  g.fillStyle = ruin;
  for (let x = 0; x < W; x++) { // 崩れた城壁 (ぎざぎざの上端)
    const wh = 3 + Math.round(2 * hash(x >> 1, 12)) + ((x >> 3) % 3 === 0 ? 2 : 0);
    g.fillRect(x, hz - wh, 1, wh + 1);
  }
  const spire = (x, h, w) => { // 尖塔: 胴 + 三角屋根
    g.fillStyle = ruin;
    g.fillRect(x, hz - h, w, h);
    const roof = Math.round(w * 1.6);
    for (let k = 0; k < roof; k++) {
      const half = Math.max(0, Math.round((w / 2 + 1) * (1 - k / roof)));
      g.fillRect(Math.round(x + w / 2 - half), hz - h - k, half * 2, 1);
    }
    g.fillRect(Math.round(x + w / 2), hz - h - roof - 2, 1, 2);
    if (h > 12) { g.fillStyle = "#2a1a10"; g.fillRect(Math.round(x + w / 2), hz - h + 3, 1, 2); } // 割れた窓
  };
  const dome = (cx, h, r) => {
    g.fillStyle = ruin;
    g.fillRect(cx - r, hz - h, r * 2, h);
    fillEllipse(g, cx, hz - h, r, r * 0.8, ruin);
    g.fillRect(cx, hz - h - r - 2, 1, 3);
  };
  spire(Math.round(W * 0.06), 14, 4);
  spire(Math.round(W * 0.15), 9, 3);
  dome(Math.round(W * 0.30), 8, 6);
  spire(Math.round(W * 0.40), 20, 5);
  spire(Math.round(W * 0.47), 12, 3);
  spire(Math.round(W * 0.63), 16, 4);
  dome(Math.round(W * 0.74), 10, 7);
  spire(Math.round(W * 0.88), 11, 3);
  // 地平の霧
  g.fillStyle = "#24183a";
  g.fillRect(0, hz - 1, W, 1);

  // 大地 (地平線から下へ闇に沈む)
  ditherV(g, 0, hz, W, H - hz, ["#16101f", "#110c1a", "#0d0914", "#0b0811", "#0b0b12"]);
  // 地面のひび・石くれ
  for (let i = 0; i < 160; i++) {
    const x = Math.floor(hash(i, 21) * W);
    const y = hz + 3 + Math.floor(hash(i, 22) * (H - hz - 3));
    g.fillStyle = hash(i, 23) < 0.5 ? "#1c1528" : "#07050b";
    g.fillRect(x, y, 1 + (hash(i, 24) < 0.3 ? 1 : 0), 1);
  }

  // ---- 手前から穴へ続く石畳の参道 (遠近の台形) ----
  const pathTop = pcy + pry - 2, pathBot = H;
  for (let y = pathTop; y < pathBot; y++) {
    const u = (y - pathTop) / Math.max(1, pathBot - pathTop);
    const half = Math.round(W * (0.10 + 0.22 * u));
    g.fillStyle = (y - pathTop) % Math.max(3, Math.round(3 + u * 6)) === 0 ? "#0c0912" : "#18121f";
    g.fillRect(pcx - half, y, half * 2, 1);
    g.fillStyle = "#08060c";
    g.fillRect(pcx - half - 1, y, 1, 1);
    g.fillRect(pcx + half, y, 1, 1);
  }
  for (let i = 0; i < 26; i++) { // 石畳の目地と欠け
    const u = hash(i, 61);
    const y = Math.round(pathTop + u * (pathBot - pathTop));
    const half = W * (0.10 + 0.22 * u);
    const x = Math.round(pcx - half + hash(i, 62) * half * 2);
    g.fillStyle = hash(i, 63) < 0.5 ? "#0a0810" : "#241c2e";
    g.fillRect(x, y, 1, 1 + Math.round(u * 2));
  }

  // ---- 迷宮の口: 螺旋に降りる段々の大穴 ----
  fillEllipse(g, pcx, pcy + 3, prx + 4, pry + 3, "#05030a");
  fillEllipse(g, pcx, pcy, prx + 3, pry + 2, "#3a3046");
  fillEllipse(g, pcx, pcy - 1, prx + 1, pry, "#4c4060");
  // 段 (外 → 内)。内側ほど暗く、少しずつ下へずらして段々に見せる
  const ringCols = ["#30263e", "#281f34", "#20192b", "#191322", "#130e1a", "#0e0a14", "#0a0710", "#07050b"];
  const N = ringCols.length;
  for (let k = 0; k < N; k++) {
    const f = 1 - (k + 1) * 0.105;
    const rx = prx * f, ry = pry * f;
    const cy = pcy + k * pry * 0.09;
    fillEllipse(g, pcx, cy, rx + 0.5, ry + 0.5, "#05030a");   // 段の縁の影
    fillEllipse(g, pcx, cy + 1, rx, ry, ringCols[k]);
    // 段の縁の明るい線 (奥側=上半周だけ光を受ける)
    g.fillStyle = k < 3 ? "#4a3e5c" : "#2a2236";
    for (let j = 0; j < 40; j++) {
      const a = Math.PI + (j / 40) * Math.PI;
      g.fillRect(Math.round(pcx + Math.cos(a) * rx), Math.round(cy + 1 + Math.sin(a) * ry), 1, 1);
    }
    // 段の刻み (階段の踏み面)
    g.fillStyle = "#05030a";
    const steps = Math.round(20 - k * 1.8);
    for (let j = 0; j < steps; j++) {
      const a = (j / steps) * Math.PI * 2 + k * 0.4;
      const sx = Math.round(pcx + Math.cos(a) * rx * 0.97);
      const sy = Math.round(cy + 1 + Math.sin(a) * ry * 0.97);
      g.fillRect(sx, sy, 1, 2);
    }
  }
  // 縁石のブロック目地
  for (let j = 0; j < 56; j++) {
    const a = (j / 56) * Math.PI * 2;
    const sx = Math.round(pcx + Math.cos(a) * (prx + 2));
    const sy = Math.round(pcy + Math.sin(a) * (pry + 1));
    g.fillStyle = j % 2 ? "#221a2c" : "#5e5072";
    g.fillRect(sx, sy, 1, 1);
  }

  // ---- 迷宮の口を護る朽ちた石柱 (左右) ----
  const pillar = (x, top, bot, broken) => {
    const pw = Math.max(6, Math.round(W * 0.045));
    g.fillStyle = "#06040a"; g.fillRect(x - 1, top, pw + 2, bot - top + 1);
    g.fillStyle = "#2a2236"; g.fillRect(x, top, pw, bot - top);
    g.fillStyle = "#3e3450"; g.fillRect(x, top, 2, bot - top);
    g.fillStyle = "#1a1424"; g.fillRect(x + pw - 1, top, 1, bot - top);
    for (let y = top + 5; y < bot; y += 7) { g.fillStyle = "#1a1424"; g.fillRect(x, y, pw, 1); }
    g.fillStyle = "#6a3fa0"; g.fillRect(x + Math.floor(pw / 2), top + 9, 1, 3); // 刻まれたルーン
    g.fillRect(x + Math.floor(pw / 2) - 1, top + 10, 3, 1);
    g.fillStyle = "#3e3450"; g.fillRect(x - 2, bot - 2, pw + 4, 3);           // 台座
    if (broken) { g.fillStyle = "#0b0811"; g.fillRect(x + pw - 3, top, 3, 2); g.fillRect(x + pw - 1, top + 2, 1, 3); }
    else { g.fillStyle = "#3e3450"; g.fillRect(x - 1, top - 2, pw + 2, 2); g.fillRect(x - 2, top - 3, pw + 4, 1); }
  };
  pillar(Math.round(W * 0.035), Math.round(H * 0.47), Math.round(pcy + pry * 0.25), true);
  pillar(Math.round(W * 0.905), Math.round(H * 0.43), Math.round(pcy + pry * 0.2), false);

  // ---- 縁に立つ魂繰り (手前、深淵の光を背に影絵となる) ----
  const fx = Math.round(pcx - prx * 0.46), fy = Math.round(pcy + pry * 0.93);
  const P = 1; // 1ドット
  const fig = [ // 外套の魂繰り (幅11 x 高さ20)。# = 影 / g = 金の双眸 / r = 縁の照り返し
    "....###....",
    "...#####...",
    "..##g#g##..",
    "..#######..",
    "..#######.r",
    ".r#######rr",
    ".#########.",
    ".##########",
    ".#########.",
    "r##########",
    "###########",
    "###########",
    "r##########",
    "###########",
    "###########",
    "############",
    "############",
    "#############",
    "#############",
    ".###########.",
  ];
  const fw = 11, fh = fig.length;
  for (let y = 0; y < fh; y++) for (let x = 0; x < fig[y].length; x++) {
    const ch = fig[y][x];
    if (ch === ".") continue;
    g.fillStyle = ch === "g" ? "#ffd27a" : ch === "r" ? "#5a3a86" : "#040208";
    g.fillRect(fx - Math.floor(fw / 2) + x * P, fy - fh + y * P, P, P);
  }
  // 差し伸べた腕 (右)
  g.fillStyle = "#040208";
  g.fillRect(fx + 5, fy - 14, 4, 1);
  g.fillRect(fx + 8, fy - 15, 1, 1);

  // ---- 手前の岩 (画面下端の左右を締める) ----
  for (let x = 0; x < W; x++) {
    const edge = Math.min(x, W - 1 - x) / (W / 2); // 0=端 1=中央
    const rh = Math.round((1 - edge) * 22 + 3 * hash(x >> 1, 31) + 2 * Math.abs(Math.sin(x * 0.3)));
    g.fillStyle = "#07060b";
    g.fillRect(x, H - rh, 1, rh);
  }
  return { canvas: c, pcx, pcy, prx, pry, hz, mx, my, mr, hand: { x: fx + 9, y: fy - 15 } };
}

// ---- 毎フレームの動き (星の瞬き・深淵の脈動・昇る魂・魂の糸) ----
function drawFrame(g, st, W, H, now) {
  g.imageSmoothingEnabled = false;
  g.drawImage(st.canvas, 0, 0);
  const t = REDUCED ? 0 : now;
  // 星
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(hash(i, 1) * W);
    const y = Math.floor(hash(i, 2) * (st.hz - 10));
    if (Math.hypot(x - st.mx, y - st.my) < st.mr + 4) continue;
    const tw = 0.5 + 0.5 * Math.sin(t * 0.0018 * (0.6 + hash(i, 3)) + i * 1.7);
    if (tw < 0.25) continue;
    g.fillStyle = hash(i, 4) < 0.15 ? "#ffe9b0" : hash(i, 4) < 0.3 ? "#b9c8ff" : "#d8d2ea";
    g.globalAlpha = 0.35 + tw * 0.65;
    g.fillRect(x, y, 1, 1);
    if (hash(i, 5) < 0.08 && tw > 0.85) { // 大きな星は十字に光る
      g.globalAlpha = 0.4;
      g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3);
    }
  }
  g.globalAlpha = 1;
  // 深淵の脈動する光
  const pulse = 0.75 + 0.25 * Math.sin(t * 0.0016);
  const gr = g.createRadialGradient(st.pcx, st.pcy + st.pry * 0.6, 1, st.pcx, st.pcy + st.pry * 0.6, st.prx * 0.75);
  gr.addColorStop(0, `rgba(205,150,255,${0.7 * pulse})`);
  gr.addColorStop(0.35, `rgba(120,64,200,${0.32 * pulse})`);
  gr.addColorStop(1, "rgba(40,10,80,0)");
  g.fillStyle = gr;
  g.fillRect(st.pcx - st.prx, st.pcy - st.pry * 2, st.prx * 2, st.pry * 4);
  // 穴の底の核
  g.fillStyle = "#d6b8ff";
  g.globalAlpha = 0.5 + 0.4 * pulse;
  fillEllipse(g, st.pcx, st.pcy + st.pry * 0.66, 2.5, 1, "#e9dcff");
  g.globalAlpha = 1;
  // 魂の糸 (魂繰りの指先から深淵へ、わずかに揺れる)
  g.fillStyle = "#6fd6e8";
  for (let k = 0; k < 3; k++) {
    const ex = st.pcx - 8 + k * 8 + Math.sin(t * 0.001 + k) * 2;
    const ey = st.pcy + st.pry * 0.62;
    const steps = 60;
    for (let j = 0; j < steps; j++) {
      const u = j / steps;
      const x = st.hand.x + (ex - st.hand.x) * u;
      const y = st.hand.y + (ey - st.hand.y) * u + Math.sin(u * Math.PI) * (3 + k * 2) - Math.sin(u * Math.PI * 0.5) * 4;
      g.globalAlpha = (0.15 + 0.3 * Math.sin(u * Math.PI)) * (0.8 + 0.2 * Math.sin(t * 0.003 + k * 2 + u * 6));
      g.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
  }
  g.globalAlpha = 1;
  // 昇る魂 (鬼火)
  const rise = st.pcy + st.pry * 0.5 - H * 0.08;
  for (let i = 0; i < 16; i++) {
    const sp = 0.010 + hash(i, 41) * 0.012;
    const ph = hash(i, 42);
    const u = ((t * sp * 0.001 + ph) % 1 + 1) % 1;          // 0 = 底 → 1 = 天へ
    const y = st.pcy + st.pry * 0.5 - u * rise;
    const x = st.pcx + (hash(i, 43) - 0.5) * st.prx * 0.9 * (0.4 + u) + Math.sin(t * 0.0012 + i) * 3 * u;
    const a = Math.sin(u * Math.PI) * (u > 0.15 ? 1 : u / 0.15);
    if (a <= 0.02) continue;
    const xi = Math.round(x), yi = Math.round(y);
    g.globalAlpha = 0.22 * a;
    g.fillStyle = "#3aa6c4";
    g.fillRect(xi - 1, yi, 3, 1); g.fillRect(xi, yi - 1, 1, 3);   // 十字の淡い光
    g.globalAlpha = 0.12 * a;
    g.fillRect(xi, yi + 2, 1, 2);                                 // 尾を引く
    g.globalAlpha = 0.95 * a;
    g.fillStyle = i % 5 === 0 ? "#ffffff" : "#bff2fb";
    g.fillRect(xi, yi, 1, 1);
  }
  g.globalAlpha = 1;
  // 地を這う霧
  for (let i = 0; i < 6; i++) {
    const y = Math.round(st.hz + 6 + i * 5);
    const x = ((hash(i, 51) * W + t * 0.004 * (i % 2 ? 1 : -1) * (6 + i)) % (W + 60) + W + 60) % (W + 60) - 60;
    g.globalAlpha = 0.10;
    g.fillStyle = "#6a5a88";
    g.fillRect(Math.round(x), y, 50, 1);
    g.fillRect(Math.round(x) + 8, y + 1, 30, 1);
  }
  g.globalAlpha = 1;
}

function div(cls, text) {
  const e = document.createElement("div");
  e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

export function showTitle({ hasSave = false, summary = null, onStart } = {}) {
  const wrap = div("ttl-overlay");
  const cv = document.createElement("canvas");
  cv.className = "ttl-scene";
  wrap.appendChild(cv);
  const g = cv.getContext("2d");
  let st = null, W = 0, H = 0;
  const fit = () => {
    const vw = Math.max(1, wrap.clientWidth || innerWidth), vh = Math.max(1, wrap.clientHeight || innerHeight);
    W = 180;
    H = Math.max(220, Math.min(420, Math.round(W * vh / vw)));
    if (cv.width !== W || cv.height !== H || !st) {
      cv.width = W; cv.height = H;
      st = buildStatic(W, H);
    }
  };

  // ロゴ
  const ui = div("ttl-ui");
  const logo = div("ttl-logo");
  logo.appendChild(div("ttl-pre", "百の迷宮と"));
  logo.appendChild(div("ttl-main", "魂の王"));
  logo.appendChild(div("ttl-en", "HUNDRED LABYRINTHS · RISE OF THE SOUL KING"));
  ui.appendChild(logo);

  // 下段: 「画面をタップ」→ 目覚めたらメニュー
  const low = div("ttl-low");
  const tap = div("ttl-tap", "— 画面をタップ —");
  low.appendChild(tap);
  const menu = div("ttl-menu");
  if (hasSave && summary) {
    const sc = div("ttl-save");
    if (summary.head) sc.appendChild(div("ttl-save-h", summary.head));
    if (summary.sprites && summary.sprites.length) {
      const row = div("ttl-party");
      for (const sp of summary.sprites.slice(0, 6)) {
        const s = document.createElement("span");
        s.className = "ttl-pm";
        s.appendChild(spriteCanvas(sp, 3));
        row.appendChild(s);
      }
      sc.appendChild(row);
    }
    for (const ln of summary.lines || []) sc.appendChild(div("ttl-save-l", ln));
    menu.appendChild(sc);
  }
  const go = document.createElement("button");
  go.className = "btn primary ttl-go";
  go.textContent = hasSave ? "▶ 冒険をつづける" : "▶ 冒険をはじめる";
  menu.appendChild(go);
  menu.appendChild(div("ttl-note", hasSave ? "進行は自動で保存されています" : "ホーム画面に追加すると、オフラインでも遊べます"));
  low.appendChild(menu);
  ui.appendChild(low);
  wrap.appendChild(ui);

  let awake = false, closed = false, raf = 0, last = 0;
  const loop = (ts) => {
    if (closed) return;
    raf = requestAnimationFrame(loop);
    if (ts - last < 50) return; // 約20fps
    last = ts;
    fit();
    drawFrame(g, st, W, H, ts);
  };
  const close = () => {
    if (closed) return;
    closed = true;
    cancelAnimationFrame(raf);
    wrap.classList.add("ttl-out");
    setTimeout(() => wrap.remove(), 700);
    if (onStart) onStart();
  };
  const wake = () => {
    if (awake) return;
    awake = true;
    wrap.classList.add("ttl-awake");
    try { SFX.select(); } catch {}
  };
  go.addEventListener("click", (e) => { e.stopPropagation(); if (!awake) { wake(); return; } try { SFX.stairs(); } catch {} close(); });
  wrap.addEventListener("click", () => { if (!awake) wake(); });
  const onKey = (e) => {
    if (closed) { removeEventListener("keydown", onKey, true); return; }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault(); e.stopPropagation();
      if (!awake) wake(); else { try { SFX.stairs(); } catch {} close(); }
    } else e.stopPropagation(); // タイトル表示中はゲームへの入力を通さない
  };
  addEventListener("keydown", onKey, true);

  document.body.appendChild(wrap);
  fit();
  drawFrame(g, st, W, H, performance.now());
  raf = requestAnimationFrame(loop);
}
