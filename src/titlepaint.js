// タイトル画面の一枚絵 (描き下ろしの原画版) — ドットではなく、画面の解像度のまま滑らかに描く
//
// 原画 (art/title/keyart-*.webp、titlekeyart.js が台帳) を画面いっぱいに敷き、その上に
// 光と霧と粒子だけを重ねて動かす。絵そのものは描き換えない:
//   ゆっくり寄るカメラ / 門の魂火の呼吸 / 門から立ちのぼる魂の粒 / ランタンのゆらぎと火の粉 / 地を這う霧
// 縦長の画面には縦の原画 (tall)、横長には横の原画 (wide) を選び、門 (gate) をロゴとメニューの間に置く。
// 原画が無い時は title.js が従来のドット絵 (titleart.js) を使う。
import { SFX } from "./audio.js";
import { TITLE_KEYART } from "./titlekeyart.js";

export const hasPaintedTitle = () => !!(TITLE_KEYART.wide || TITLE_KEYART.tall);

const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const fract = (v) => v - Math.floor(v);
const hash = (a, b = 0) => fract(Math.sin(a * 127.1 + b * 311.7) * 43758.5453);

// 縦横比の近い原画を選ぶ (切り取られる量が少ない方)
function pickArt(vw, vh) {
  const va = vw / vh;
  let best = null, bestCut = Infinity;
  for (const key of ["tall", "wide"]) {
    const a = TITLE_KEYART[key];
    if (!a) continue;
    const ia = a.w / a.h, cut = Math.max(va / ia, ia / va);
    if (cut < bestCut) { best = { key, ...a }; bestCut = cut; }
  }
  return best;
}

const loadImage = (src) => new Promise((ok, ng) => {
  const im = new Image();
  im.decoding = "async";
  im.onload = () => (im.decode ? im.decode().catch(() => {}) : Promise.resolve()).then(() => ok(im));
  im.onerror = () => ng(new Error("タイトルの原画を読めません: " + src));
  im.src = src;
});

// 色つきのやわらかい光の玉 (加算で重ねる)
function glow(size, rgb, core = 0.25) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d"), r = size / 2;
  const gr = g.createRadialGradient(r, r, 0, r, r, r);
  gr.addColorStop(0, `rgba(${rgb},1)`);
  gr.addColorStop(core, `rgba(${rgb},0.55)`);
  gr.addColorStop(0.6, `rgba(${rgb},0.12)`);
  gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  return c;
}

// 横に継ぎ目なくつながる霧の帯 (小さく作って滑らかに引き伸ばす)
function fogBand(seed, w = 256, h = 48, cloud = false) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d"), img = g.createImageData(w, h);
  const vn = (x, y, p) => { // 横方向に周期 p の値ノイズ
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const s = (t) => t * t * (3 - 2 * t);
    const v = (i, j) => hash(((i % p) + p) % p + seed * 17.3, j + seed * 3.1);
    const a = v(xi, yi), b = v(xi + 1, yi), cc = v(xi, yi + 1), d = v(xi + 1, yi + 1);
    return a + (b - a) * s(xf) + (cc - a) * s(yf) + (a - b - cc + d) * s(xf) * s(yf);
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let n = 0, amp = 0.55, f = 1;
    for (let o = 0; o < 4; o++) { n += vn((x / w) * 6 * f, (y / h) * 2.2 * f, 6 * f) * amp; amp *= 0.5; f *= 2; }
    const edge = Math.sin(Math.PI * (y / (h - 1))); // 上下の端は消える
    const a = clamp((n - (cloud ? 0.25 : 0.42)) * (cloud ? 3.3 : 2.2)) * edge * edge;
    const i = (y * w + x) * 4;
    const light = cloud ? Math.round(110 + n * 130) : 150;
    img.data[i] = light; img.data[i + 1] = cloud ? light + 8 : 160; img.data[i + 2] = cloud ? Math.min(255, light + 27) : 185; img.data[i + 3] = Math.round(a * 255);
  }
  g.putImageData(img, 0, 0);
  return c;
}

export class PaintedTitle {
  // 画面の大きさから原画を選んで読む: await PaintedTitle.create(vw, vh, reduced)
  static async create(vw, vh, reduced = false) {
    const art = pickArt(vw, vh);
    if (!art) throw new Error("タイトルの原画がありません");
    return new PaintedTitle(art, await loadImage(art.src), reduced);
  }
  constructor(art, img, reduced) {
    this.art = art; this.img = img; this.reduced = reduced;
    this.awakeAt = -1; this.flare = 0;
    this.soul = glow(128, "150,255,215", 0.18);
    this.soulCore = glow(48, "225,255,240", 0.3);
    this.moonGlow = glow(256, "135,168,230", 0.08);
    this.ember = glow(64, "255,180,90", 0.22);
    this.fogs = [fogBand(11), fogBand(23), fogBand(37)];
    this.clouds = [fogBand(53, 384, 96, true), fogBand(71, 384, 96, true)];
    this.weatherTime = 0;
    this.nextCrow = 3500 + Math.random() * 4000;
    this.nextStorm = 2800 + Math.random() * 1600;
    this.crows = [];
    this.storm = null;
    this.motes = Array.from({ length: 70 }, (_, i) => this.newMote(i, hash(i, 7) * 9000));
    this.sparks = Array.from({ length: 10 }, (_, i) => ({ seed: i, t0: -hash(i, 5) * 2600 }));
  }
  // 魂の粒: 門の口から生まれ、揺れながら上へ昇って消える (時間は ms、位置は原画の割合)
  newMote(i, age = 0, burst = false, salt = 0) {
    const a = this.art, [gx, gy] = a.gate, gr = a.gateR || 0.06;
    const r = (k) => hash(i, k + salt * 13.7 + (burst ? 50 : 0));
    return {
      burst, salt,
      x: gx + (r(1) - 0.5) * gr * 1.6,
      y: gy + (r(2) - 0.2) * gr * 1.2,
      life: 5000 + r(3) * 6000,
      age, rise: (0.012 + r(4) * 0.02) * (burst ? 2.2 : 1), // 1秒に原画の高さの何割
      sway: 0.004 + r(5) * 0.01, ph: r(6) * 6.28,
      size: 0.5 + r(8) ** 2 * 1.4, seed: i,
    };
  }
  // 画面の配置: vw×vh (CSS px)、band = ロゴの下端とメニューの上端 (CSS px)。門をその間に置く
  layout(vw, vh, dpr, band) {
    this.vw = vw; this.vh = vh; this.dpr = dpr;
    const a = this.art;
    const cover = Math.max(vw / a.w, vh / a.h);
    this.base = cover * 1.06; // カメラが寄り引きする余白
    const mid = band && band.bot > band.top + 40 ? (band.top + band.bot) / 2 : vh * 0.48;
    this.want = { x: vw / 2, y: mid };
  }
  // いまのカメラ (拡大率と原画の左上の位置)
  cam(now) {
    const a = this.art, t = this.reduced ? 0 : now / 1000;
    const z = 1 + 0.035 * (0.5 - 0.5 * Math.cos(t * 0.11)); // 約57秒で寄って戻る
    const s = this.base * z;
    const iw = a.w * s, ih = a.h * s;
    const fx = a.gate[0] * iw, fy = a.gate[1] * ih;
    const dx = Math.sin(t * 0.07) * 0.006 * iw;
    const ox = clamp(this.want.x - fx + dx, this.vw - iw, 0);
    const oy = clamp(this.want.y - fy, this.vh - ih, 0);
    return { s, iw, ih, ox, oy };
  }
  // 門の位置 (CSS px)。title.js の閃光・退場の拡大の中心に使う
  gatePoint() {
    const c = this.cam(0);
    return { x: c.ox + this.art.gate[0] * c.iw, y: c.oy + this.art.gate[1] * c.ih };
  }
  wake(now) {
    this.awakeAt = now;
    this.flare = 1;
    for (let i = 0; i < 36; i++) this.motes.push(this.newMote(i, 0, true, Math.floor(now)));
  }
  // 背景だけに重ねる空模様。非表示の間は時計も雷鳴も止める。
  drawWeather(g, c, dt) {
    if (document.hidden) { this.storm = null; return; }
    this.weatherTime += dt;
    const now = this.weatherTime, t = now / 1000;
    g.save();
    // 月明かりと雲は画面内の空に置く。原画の上端が切れても消えない。
    const skyH = Math.min(this.vh * 0.44, Math.max(this.vh * 0.3, c.oy + c.ih * 0.39));
    g.globalCompositeOperation = "screen";
    g.globalAlpha = 0.16 + Math.sin(t * 0.32) * 0.045;
    const moonX = c.ox + c.iw * (this.art.h > this.art.w ? 0.27 : 0.23);
    const moonY = c.oy + c.ih * 0.13;
    const radius = this.vw * 0.34;
    g.drawImage(this.moonGlow, moonX - radius, moonY - radius, radius * 2, radius * 2);
    g.beginPath(); g.rect(0, 0, this.vw, skyH); g.clip();
    for (let i = 0; i < this.clouds.length; i++) {
      const w = this.vw * (1.25 + i * 0.3), h = skyH * (0.72 + i * 0.08);
      const offset = (t * (15 + i * 11) * Math.max(0.7, this.vw / 950)) % w;
      g.globalAlpha = 0.48 + i * 0.08;
      for (let x = -w + (i ? -offset : offset); x < this.vw; x += w)
        g.drawImage(this.clouds[i], x, skyH * (i * 0.25 - 0.14), w, h);
    }
    g.restore(); g.save();
    if (now >= this.nextCrow) {
      const dir = Math.random() < 0.5 ? 1 : -1;
      const y = 0.12 + Math.random() * 0.22;
      this.crows = Array.from({ length: 1 + Math.floor(Math.random() * 3) }, (_, i) => ({
        born: now + i * 280, dir, y: y + i * 0.018, size: 5 + Math.random() * 5,
        duration: 6500 + Math.random() * 2200, phase: Math.random() * 6.28,
      }));
      this.nextCrow = now + 16000 + Math.random() * 18000;
    }
    g.globalCompositeOperation = "source-over";
    g.globalAlpha = 0.9;
    g.fillStyle = "#070b14";
    this.crows = this.crows.filter((bird) => {
      const age = now - bird.born, p = age / bird.duration;
      if (p > 1) return false;
      if (p < 0) return true;
      const size = bird.size * Math.max(0.65, this.vw / 950);
      const x = (bird.dir > 0 ? p : 1 - p) * (this.vw + 80) - 40;
      const y = c.oy + bird.y * c.ih + Math.sin(p * 8 + bird.phase) * 12;
      const wing = Math.sin(age / 1000 * 15 + bird.phase) * size * 0.85;
      g.save(); g.translate(x, y); g.scale(bird.dir, 1);
      g.beginPath();
      g.moveTo(-size * 1.8, -wing);
      g.quadraticCurveTo(-size * 0.7, -size * 0.5, 0, 0);
      g.quadraticCurveTo(size * 0.7, -size * 0.5, size * 1.8, -wing);
      g.lineTo(size * 0.7, 2); g.lineTo(2, 1);
      g.lineTo(0, 5); g.lineTo(-2, 1); g.lineTo(-size * 0.7, 2);
      g.closePath(); g.fill();
      g.beginPath(); g.ellipse(1, 0, 3, 1.8, 0, 0, Math.PI * 2); g.fill();
      g.restore();
      return true;
    });
    if (now >= this.nextStorm) {
      const side = Math.random() < 0.5 ? 0.12 : 0.82;
      this.storm = { born: now, delay: 700 + Math.random() * 900, sounded: false,
        points: Array.from({ length: 9 }, (_, i) => ({
          x: (side + i * 0.004 + (Math.random() - 0.5) * 0.05) * this.vw,
          y: this.vh * (0.035 + i * 0.042),
        })),
      };
      this.nextStorm = now + 12000 + Math.random() * 14000;
    }
    if (this.storm) {
      const storm = this.storm, age = now - storm.born;
      // 一度の長めの稲光。細い芯・青い光・枝分かれを重ねる。
      const light = Math.min(1, age / 45 + 0.15) * Math.exp(-age / 380);
      g.globalCompositeOperation = "screen";
      g.globalAlpha = light * 0.5;
      const sky = g.createLinearGradient(0, 0, 0, this.vh * 0.75);
      sky.addColorStop(0, "#bacde9"); sky.addColorStop(1, "rgba(100,130,175,0)");
      g.fillStyle = sky; g.fillRect(0, 0, this.vw, this.vh * 0.75);
      for (const [width, alpha, color] of [[9, 0.25, "#627fdf"], [3, 0.6, "#a4c6ff"], [1.2, 0.95, "#eff6ff"]]) {
        g.globalAlpha = light * alpha; g.strokeStyle = color; g.lineWidth = width;
        g.beginPath();
        storm.points.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y));
        g.stroke();
        for (const index of [3, 5]) {
          const p = storm.points[index], dir = index === 3 ? -1 : 1;
          g.beginPath(); g.moveTo(p.x, p.y);
          g.lineTo(p.x + dir * this.vw * 0.035, p.y + this.vh * 0.025);
          g.lineTo(p.x + dir * this.vw * 0.025, p.y + this.vh * 0.047);
          g.lineTo(p.x + dir * this.vw * 0.07, p.y + this.vh * 0.08);
          g.stroke();
        }
      }
      if (!storm.sounded && age >= storm.delay) { storm.sounded = true; SFX.thunder(); }
      if (age > 2200) this.storm = null;
    }
    g.restore();
  }
  draw(g, now, dt) {
    const a = this.art, d = this.dpr;
    const c = this.cam(now);
    g.setTransform(d, 0, 0, d, 0, 0);
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = "high";
    g.globalCompositeOperation = "source-over";
    g.globalAlpha = 1;
    g.drawImage(this.img, c.ox, c.oy, c.iw, c.ih);
    if (this.reduced) return;
    this.drawWeather(g, c, dt);
    const t = now / 1000;
    const P = (u, v) => [c.ox + u * c.iw, c.oy + v * c.ih];
    const [gx, gy] = P(a.gate[0], a.gate[1]);
    const gr = (a.gateR || 0.06) * c.ih;
    this.flare *= Math.pow(0.25, dt / 1000);

    g.globalCompositeOperation = "lighter";
    // 門の魂火の呼吸 (遠い心臓の鼓動のように二度打つ)
    const beat = Math.pow(Math.max(0, Math.sin(t * 1.3)), 6) * 0.6 + Math.pow(Math.max(0, Math.sin(t * 1.3 - 0.5)), 8) * 0.35;
    const breath = 0.16 + 0.07 * Math.sin(t * 0.6) + beat * 0.12 + this.flare * 0.55;
    g.globalAlpha = clamp(breath);
    g.drawImage(this.soul, gx - gr * 3, gy - gr * 2.6, gr * 6, gr * 5.2);
    g.globalAlpha = clamp(breath * 0.7);
    g.drawImage(this.soulCore, gx - gr * 0.9, gy - gr * 0.8, gr * 1.8, gr * 1.6);

    // 魂の粒
    const mScale = c.ih / 1000;
    this.motes = this.motes.filter((m) => {
      m.age += dt;
      if (m.age > m.life) { if (m.burst) return false; Object.assign(m, this.newMote(m.seed, 0, false, m.salt + 1)); }
      const k = m.age / m.life, sec = m.age / 1000;
      const u = m.x + Math.sin(sec * 0.9 + m.ph) * m.sway * (0.4 + k);
      const v = m.y - sec * m.rise;
      const [x, y] = P(u, v);
      const tw = 0.65 + 0.35 * Math.sin(t * 3.1 + m.ph * 5);
      const al = Math.sin(Math.PI * k) * tw * (m.burst ? 0.95 : 0.75);
      const sz = (10 + 16 * m.size) * mScale;
      g.globalAlpha = clamp(al * 0.55);
      g.drawImage(this.soul, x - sz, y - sz, sz * 2, sz * 2);
      g.globalAlpha = clamp(al);
      g.drawImage(this.soulCore, x - sz * 0.22, y - sz * 0.22, sz * 0.44, sz * 0.44);
      return true;
    });

    // 墓標のそばを漂う小さな魂火。門の奥へゆっくり流れる。
    for (let i = 0; i < 7; i++) {
      const phase = t * (0.16 + hash(i, 41) * 0.09) + i * 2.4;
      const [x, y] = P(0.16 + hash(i, 33) * 0.68 + Math.sin(phase) * 0.025,
        (a.fogY || 0.67) - 0.04 + Math.cos(phase * 0.7) * 0.025);
      const size = (9 + hash(i, 19) * 7) * mScale;
      g.globalAlpha = 0.25 + Math.sin(phase * 1.8) * 0.14;
      g.drawImage(this.soul, x - size, y - size, size * 2, size * 2);
      g.globalAlpha *= 1.8;
      g.drawImage(this.soulCore, x - size * 0.16, y - size * 0.16, size * 0.32, size * 0.32);
    }

    // ランタンのゆらぎと火の粉
    if (a.lamp) {
      const [lx, ly] = P(a.lamp[0], a.lamp[1]);
      const fl = 0.42 + 0.1 * Math.sin(t * 9.1) + 0.08 * Math.sin(t * 23.7 + 1) + 0.06 * Math.sin(t * 5.3);
      const lr = (a.lampR || 0.05) * c.ih;
      g.globalAlpha = clamp(fl * 0.55);
      g.drawImage(this.ember, lx - lr * 2.2, ly - lr * 2.2, lr * 4.4, lr * 4.4);
      g.globalAlpha = clamp(fl * 0.8);
      g.drawImage(this.ember, lx - lr * 0.5, ly - lr * 0.5, lr, lr);
      for (const s of this.sparks) {
        const age = (now - s.t0) % 2600, k = age / 2600, n = Math.floor((now - s.t0) / 2600);
        const sx = lx + (hash(s.seed, n) - 0.5) * lr * 0.8 + Math.sin(k * 6 + s.seed) * lr * 0.25;
        const sy = ly - k * lr * (2.5 + hash(s.seed, n + 9) * 2.5);
        const sz = (3 + hash(s.seed, n + 3) * 3) * mScale;
        g.globalAlpha = clamp((1 - k) * Math.min(1, k * 8) * 0.9);
        g.drawImage(this.ember, sx - sz, sy - sz, sz * 2, sz * 2);
      }
    }

    // 地を這う霧 (足元から地平へ、奥ほど遅い)
    g.globalCompositeOperation = "screen";
    const fogTop = a.fogY != null ? a.fogY : 0.62;
    for (let i = 0; i < this.fogs.length; i++) {
      const f = this.fogs[i];
      const w = c.iw * (1.3 + i * 0.25), h = c.ih * (0.16 + i * 0.05);
      const y = c.oy + c.ih * (fogTop + i * 0.09) - h / 2;
      const off = ((t * (17 + i * 14)) * mScale) % w;
      g.globalAlpha = 0.22 + i * 0.06;
      for (let x = c.ox - off - (i % 2 ? w * 0.4 : 0); x < this.vw; x += w) g.drawImage(f, x, y, w, h);
    }
    g.globalCompositeOperation = "source-over";
    g.globalAlpha = 1;
  }
}
