// オープニングの一枚絵 (6 幕) — 手続き的ドット絵 (pxpaint.js) で描く映画的な導入
//
// 各幕は奥行きの違う数枚の「層」(Plane) から成り、カメラがゆっくり動くと層ごとに
// ずれて見える (多層の視差)。静止部分は幕の開始時に一度だけ描き、毎フレームは
// 光の揺らぎ・粒子・目の明滅などだけを重ねる。人物はすべて写実の頭身で描く。
//
// SCENES[i] = { cap, title, lines[], build(W, H) → Shot }
//   Shot.draw(g, t, cam, prog) — t: 幕の経過 ms / cam: {x,y} (-1..1) / prog: 語りの進み (0..1)
import {
  Layer, Mask, worley, softCanvas, rc, mix, clamp, smooth, fbm, vnoise, h1, h2, rng, glowSprite, ramp, Palette, MASTER,
  R_NIGHT, R_BONE, R_SOUL, R_EMBER, R_BLOOD, R_DUSK, R_FOG, R_STEEL, R_SOULSTONE, R_WOOD,
} from "./pxpaint.js";
import { inArch, archApex, fall, cloakedBack, shadeCloaked, graveShape, gnarledTree, gibbet, fogStrip, drawCrow } from "./titleart.js";

// 動きを減らす設定 (prefers-reduced-motion) では稲妻などの明滅を止める
let REDUCED = false;
export function setReduced(v) { REDUCED = !!v; }

// ---------------------------------------------------------------------------
// 層: カメラの振れ幅 (mx,my) × 奥行き d の余白を持つ大きめの画布
class Plane {
  constructor(W, H, mx, my, d) {
    this.d = d;
    this.ox = Math.ceil(mx * d); this.oy = Math.ceil(my * d);
    this.w = W + this.ox * 2; this.h = H + this.oy * 2;
    this.L = new Layer(this.w, this.h);
    this.c = null;
  }
  bake(amp = 12, pal) { this.c = pal ? this.L.canvas(amp, pal) : this.L.canvas(amp); this.L = null; return this; }
  // カメラ位置での左上 (画面座標)
  at(cam) { return { x: Math.round(-this.ox - cam.x * this.ox), y: Math.round(-this.oy - cam.y * this.oy) }; }
}

class Shot {
  constructor(W, H, planes, fx) { this.W = W; this.H = H; this.planes = planes; this.fx = fx; }
  draw(g, t, cam, prog) {
    g.imageSmoothingEnabled = false;
    g.fillStyle = "#030206";
    g.fillRect(0, 0, this.W, this.H);
    for (const p of this.planes) {
      if (p.pre) p.pre(g, t, p.at(cam), prog);
      if (p.c) { const o = p.at(cam); g.drawImage(p.c, o.x, o.y); }
      if (p.post) p.post(g, t, p.at(cam), prog);
    }
    if (this.fx) this.fx(g, t, cam, prog);
  }
}

// 1px の光の粒 (十字のにじみ付き)
function mote(g, x, y, a, core, halo) {
  const xi = Math.round(x), yi = Math.round(y);
  g.globalAlpha = a * 0.35; g.fillStyle = halo;
  g.fillRect(xi - 1, yi, 3, 1); g.fillRect(xi, yi - 1, 1, 3);
  g.globalAlpha = a; g.fillStyle = core;
  g.fillRect(xi, yi, 1, 1);
  g.globalAlpha = 1;
}
function lit(g, spr, x, y, a) {
  g.globalCompositeOperation = "lighter";
  g.globalAlpha = clamp(a);
  g.drawImage(spr, Math.round(x - spr.width / 2), Math.round(y - spr.height / 2));
  g.globalAlpha = 1;
  g.globalCompositeOperation = "source-over";
}
const flick = (t, s = 0) => 0.78 + 0.12 * Math.sin(t * 0.013 + s) + 0.08 * Math.sin(t * 0.031 + s * 2) + (h1(Math.floor(t / 80), s | 0) - 0.5) * 0.1;

// 空 (縦の階調 + 光源の方向から照らされる雲)
function paintSky(L, w, h, { top = R_NIGHT, t0 = 0.02, t1 = 0.4, warm = R_BLOOD, warmK = 0.4, moon = null, cloudK = 1, seed = 11, k = 1, horizon = h } = {}) {
  L.shade(0, 0, w - 1, h - 1, (x, y) => {
    const t = clamp(y / horizon);
    let c = rc(top, t0 + t * t * (t1 - t0));
    c = mix(c, rc(warm, 0.3), smooth(0.55, 1, t) * warmK);
    let dm = 9;
    if (moon) {
      dm = Math.hypot(x - moon.x, y - moon.y) / moon.r;
      if (dm > 1) { const halo = Math.exp(-(dm - 1) * 1.1); c = mix(c, rc(moon.halo || R_DUSK, 0.3 + 0.5 * halo), clamp(halo * 0.8)); }
    }
    if (cloudK > 0) {
      const n1 = fbm(x * 0.016 / k, y * 0.05 / k, seed, 5);
      const n2 = fbm((x - (moon ? Math.sign(x - moon.x) * 3 : 0)) * 0.016 / k, (y + 2.5) * 0.05 / k, seed, 5);
      const band = smooth(0.1, 0.4, t) * (1 - smooth(0.9, 1, t));
      const dens = smooth(0.48, 0.66, n1) * band * cloudK;
      if (dens > 0.02) {
        const l = clamp((n1 - n2) * 9 + 0.3);
        const near = moon ? Math.exp(-Math.max(0, dm - 0.6) * 0.8) : 0.3;
        let cc = rc(R_NIGHT, 0.1 + 0.15 * l + 0.1 * t);
        cc = mix(cc, rc(moon && moon.lit ? moon.lit : R_DUSK, 0.3 + 0.5 * l), near * l * 0.9);
        c = mix(c, cc, clamp(dens * 1.4));
      }
    }
    return c;
  });
  if (moon) {
    const mm = new Mask(w, h).ellipse(moon.x, moon.y, moon.r, moon.r);
    L.paint(mm, (x, y) => {
      const dx = (x + 0.5 - moon.x) / moon.r, dy = (y + 0.5 - moon.y) / moon.r;
      const d = Math.hypot(dx, dy), limb = Math.sqrt(Math.max(0, 1 - d * d));
      const mare = fbm(dx * 2.2 + 5, dy * 2.2 + 5, 21, 4);
      let c = rc(moon.ramp || R_BONE, clamp(0.25 + 0.6 * limb - smooth(0.5, 0.62, mare) * 0.28 + (dx < 0 ? 0.05 : -0.05)));
      if (moon.blood) c = mix(c, rc(R_BLOOD, 0.6 + 0.3 * limb), moon.blood);
      const cl = smooth(0.52, 0.68, fbm(x * 0.02 / k, y * 0.09 / k, seed + 20, 4));
      if (cl > 0) c = mix(c, rc(R_NIGHT, 0.3), cl * 0.8);
      return c;
    });
  }
  const R = rng(seed * 7 + 1);
  for (let i = 0; i < (w * h) / 300; i++) {
    const x = Math.floor(R() * w), y = Math.floor(R() * h * 0.6), b = R();
    const cur = L.get(x, y);
    if (!cur || cur[0] + cur[1] + cur[2] > 70) continue;
    if (moon && Math.hypot(x - moon.x, y - moon.y) < moon.r * 1.5) continue;
    L.px(x, y, b < 0.1 ? rc(R_BONE, 0.85) : rc(R_FOG, 0.7));
  }
}

// 縦に並ぶ点光源の明かりを足し合わせる
function lights(x, y, list) {
  let out = null;
  for (const L of list) {
    const f = fall(x, y, L);
    if (f <= 0) continue;
    out = out || [0, 0, 0, 0];
    const c = rc(L.ramp, 0.3 + 0.5 * f);
    out[0] += c[0] * f * L.k; out[1] += c[1] * f * L.k; out[2] += c[2] * f * L.k; out[3] += f * L.k;
  }
  return out;
}
// 地色 c に光を混ぜる
function applyLights(c, x, y, list, face = 1) {
  const l = lights(x, y, list);
  if (!l) return c;
  const s = clamp(l[3] * face);
  return mix(c, [l[0] / Math.max(0.001, l[3]), l[1] / Math.max(0.001, l[3]), l[2] / Math.max(0.001, l[3])], clamp(s * 1.2));
}

// =====================================================================
// 幕 1「裂けた大地」— 血の月の下、大地を裂いて口を開けた百の迷宮
function scene1(W, H) {
  const k = Math.min(W / 260, H / 300);
  const wide = W / H > 1.4;
  const mx = 10 * k, my = 26 * k;
  const sky = new Plane(W, H, mx, my, 0.15), far = new Plane(W, H, mx, my, 0.4), midP = new Plane(W, H, mx, my, 0.7), near = new Plane(W, H, mx, my, 1);
  // --- 空: 低く垂れる血の月
  const hzS = Math.round(sky.h * 0.5);
  const moon = { x: sky.w * (wide ? 0.72 : 0.68), y: sky.h * 0.2, r: Math.round((wide ? 26 : 30) * k), blood: 0.55, halo: R_BLOOD, lit: R_BLOOD };
  paintSky(sky.L, sky.w, sky.h, { t1: 0.42, warm: R_BLOOD, warmK: 0.55, moon, seed: 31, k, horizon: hzS });
  sky.bake(18);
  // --- 遠景: 地平の稜線と、地表に点々と灯る迷宮の口
  const hz = Math.round(far.h * 0.5);
  const pits = [];
  {
    const L = far.L;
    L.shade(0, hz - 30 * k, far.w - 1, far.h - 1, (x, y) => {
      const ridge = hz - 4 * k - 12 * k * fbm(x * 0.02 / k, 1, 33, 4);
      if (y < ridge) return null;
      let c = rc(R_NIGHT, 0.2 - clamp((y - hz) / (far.h - hz)) * 0.08);
      if (y - ridge < 1.2) c = mix(c, rc(R_BLOOD, 0.5), 0.6);
      return c;
    });
    // 滅びた街の尖塔
    const R = rng(41);
    for (let i = 0; i < 7; i++) {
      const x = R() * far.w, hh = (6 + R() * 16) * k, w2 = Math.max(2, (2 + R() * 3) * k);
      const m = new Mask(far.w, far.h);
      m.rect(x - w2 / 2, hz - hh, w2, hh + 6 * k);
      m.poly([x - w2 / 2, hz - hh, x + w2 / 2, hz - hh, x, hz - hh - w2 * 2.2]);
      L.paint(m, (px, py) => (!m.at(px - 1, py) ? rc(R_BLOOD, 0.35) : rc(R_NIGHT, 0.16)));
    }
    // 地平の枯れ木と崩れた壁
    for (let i = 0; i < (wide ? 5 : 3); i++) {
      const m = new Mask(far.w, far.h), x = far.w * (0.1 + 0.8 * R());
      if (R() < 0.5) gnarledTree(m, x, hz + 4 * k, (14 + R() * 12) * k, R() < 0.5 ? 1 : -1, 12 * k, k, R, [], 3 * k);
      else { m.rect(x, hz - 9 * k, 12 * k, 12 * k); m.rect(x + 3 * k, hz - 14 * k, 3 * k, 6 * k); m.poly([x + 6 * k, hz - 9 * k, x + 12 * k, hz - 9 * k, x + 12 * k, hz - 4 * k]); }
      L.paint(m, (px, py) => (!m.at(px, py - 1) || !m.at(px - 1, py) ? rc(R_BLOOD, 0.3) : rc(R_NIGHT, 0.1)));
    }
    // 遠くの迷宮の口 (楕円の穴と、光の柱)
    const nP = wide ? 7 : 5;
    for (let i = 0; i < nP; i++) {
      const z = 0.04 + (i / nP) * 0.5 + R() * 0.08;
      const y = hz + 2 + z * (far.h - hz) * 0.55;
      const x = far.w * ((i * 0.618 + 0.2) % 1);
      if (Math.abs(x - far.w * 0.44) < 30 * k) continue;
      const rr = (3 + z * 16) * k;
      pits.push({ x, y, r: rr });
      const m = new Mask(far.w, far.h).ellipse(x, y, rr, rr * 0.32);
      L.paint(m, (px, py) => {
        const d = Math.hypot((px - x) / rr, (py - y) / (rr * 0.32));
        return mix(rc(R_SOUL, 0.85 - d * 0.6), rc(R_NIGHT, 0.05), py < y - rr * 0.1 ? 0.6 : 0);
      });
      L.shade(x - rr * 2, y - rr * 3, x + rr * 2, y, (px, py) => {
        const cur = L.get(px, py);
        if (!cur) return null;
        const f = fall(px, py, { x, y, r: rr * 2.4, sq: 0.8 });
        return f > 0.02 ? [...mix(cur, rc(R_SOULSTONE, 0.6), f * 0.8)] : null;
      });
    }
  }
  far.bake(10);
  // --- 中景: 起伏する荒野を「列ごとに光線を飛ばして」描く (手前の丘が奥を隠す)。
  //     その大地を、魂火に燃える裂け目が地平まで割っている
  const crack = [], midPits = [];
  {
    const L = midP.L, w = midP.w, h = midP.h;
    const hz2 = Math.round(h * 0.5);
    const f = w * 0.9, camH = 34;
    const cxW = (Z) => -6 + Math.sin(Z * 0.012) * 18 + (fbm(Z * 0.02, 3, 57, 3) - 0.5) * 30; // 裂け目の中心 (世界座標)
    const cwW = (Z) => 1.6 + 4.5 * fbm(Z * 0.06, 9, 58, 2) + (h2(Math.floor(Z / 5), 1, 59) < 0.3 ? 1.6 : 0);
    // 地表に口を開けた迷宮の穴 [画面上の横位置 (0-1), 奥行き Z, 半径]
    const pits = [[0.2, 150, 7], [0.82, 230, 10], [0.08, 330, 12], [0.66, 420, 13], [0.36, 560, 14]].map(([sx, Z, r]) => [(sx - 0.5) * (w / f) * Z, Z, r]);
    const terr = (X, Z) => {
      let t = (fbm(X * 0.012, Z * 0.012, 61, 4) - 0.45) * 34 + (vnoise(X * 0.05, Z * 0.05, 62) - 0.5) * 4;
      t -= Math.max(0, 1 - Math.abs(X - cxW(Z)) / (cwW(Z) + 10)) * 4; // 縁へ向かってわずかに落ちる
      return t;
    };
    const ybuf = new Int32Array(w).fill(h);
    const prevRift = new Uint8Array(w);
    for (let Z = 26; Z < 640; Z += 0.3 + Z * 0.008) {
      const fog = smooth(60, 600, Z);
      for (let x = 0; x < w; x++) {
        const X = ((x + 0.5 - w / 2) / f) * Z;
        const dc = Math.abs(X - cxW(Z)), cw = cwW(Z);
        let pit = 0;
        for (const [px, pz, pr] of pits) { const d = Math.hypot(X - px, (Z - pz) * 0.8) / pr; if (d < 1) pit = Math.max(pit, 1 - d); }
        const rift = dc < cw || pit > 0;
        const hgt = rift ? -70 : terr(X, Z);
        const y = Math.round(hz2 + ((camH - hgt) * f) / Z * 0.42);
        if (y < ybuf[x]) {
          for (let yy = Math.max(0, y); yy < ybuf[x] && yy < h; yy++) {
            const depthIn = yy - y; // その帯の上端からの距離 (稜線は上端)
            let c;
            if (rift) {
              // 裂け目の底: 魂火。手前ほど強い
              const core = rift && pit === 0 ? Math.pow(clamp(1 - dc / cw), 1.5) : pit;
              c = mix(rc(R_NIGHT, 0.03), rc(R_SOUL, 0.3 + 0.7 * core), clamp((0.25 + core * 0.9) * (1 - fog * 0.5)));
            } else if (prevRift[x]) {
              // 裂け目の向こう側の崖: 層理が走り、底に近いほど青緑に照らされる
              const span = Math.max(1, ybuf[x] - y);
              const down = depthIn / span;                       // 0 = 崖の上端 .. 1 = 底
              const strata = Math.sin(depthIn * 1.1 + vnoise(X * 0.3, Z * 0.3, 64) * 5) > 0.55;
              c = rc(R_NIGHT, (strata ? 0.11 : 0.05) + vnoise(x * 0.3, yy * 0.3, 65) * 0.03);
              c = mix(c, rc(R_SOUL, 0.3 + 0.45 * down), clamp(Math.pow(down, 1.6) * 0.95 * (1 - fog)));
              if (depthIn < 1) c = mix(c, rc(R_SOUL, 0.55), 0.7 * (1 - fog));
            } else {
              const behind = terr(X, Z + 2 + Z * 0.02);
              const slope = behind - hgt;
              let v = 0.1 + clamp(-slope * 0.03, -0.05, 0.08) + vnoise(X * 0.2, Z * 0.2, 63) * 0.04;
              c = rc(R_NIGHT, v);
              // 稜線 (向こうが下っている所) の上端だけが、背後の血の月に縁取られる
              if (depthIn < 1 && behind < hgt - 1.1) c = mix(c, rc(R_BLOOD, 0.45), 0.55 * (1 - fog * 0.4));
              // 裂け目と穴の縁は下から照らされる
              const nearR = clamp(1 - ((dc - cw) * f) / Z / (6 + 10 * (1 - fog)));
              if (nearR > 0) c = mix(c, rc(R_SOULSTONE, 0.3 + 0.4 * nearR), nearR * 0.7 * (1 - fog));
              if (pit === 0) for (const [px, pz, pr] of pits) { const d = Math.hypot(X - px, (Z - pz) * 0.8) / pr; if (d < 1.6) c = mix(c, rc(R_SOULSTONE, 0.5), (1.6 - d) * 0.5 * (1 - fog)); }
            }
            c = mix(c, mix(rc(R_NIGHT, 0.2), rc(R_BLOOD, 0.25), 0.35), fog * 0.8);
            L.px(x, yy, c);
          }
          ybuf[x] = y;
        }
        prevRift[x] = rift ? 1 : 0;
      }
      if (Math.abs(Math.round(Z) - Z) < 0.3 || crack.length === 0) {
        const xr = Math.round(w / 2 + (cxW(Z) * f) / Z), yr = Math.round(hz2 + ((camH + 70) * f) / Z * 0.42);
        if (yr < h) crack.push([Math.min(h - 1, yr - Math.round((camH * f) / Z * 0.42)), xr - (cwW(Z) * f) / Z, xr + (cwW(Z) * f) / Z]);
      }
    }
    for (const [px, pz, pr] of pits) midPits.push({ x: w / 2 + (px * f) / pz, y: hz2 + (camH * f) / pz * 0.42, r: (pr * f) / pz });
  }
  midP.bake(12);
  // --- 近景: 崖っぷちの岩と枯れ草、朽ちた道標
  {
    const L = near.L, w = near.w, h = near.h;
    const m = new Mask(w, h);
    for (let x = 0; x < w; x++) {
      const e = x / w;
      const hgt = (wide ? 26 : 38) * k * (0.5 + 0.5 * Math.cos(e * Math.PI * 2)) * (e < 0.5 ? 1 : 0.6) + 6 * k * fbm(x * 0.05, 0, 61, 3);
      for (let y = Math.round(h - hgt); y < h; y++) m._span(y, x, x, 1);
      if (h1(x, 63) < 0.35) { const gh = (3 + h1(x, 64) * 8) * k; m.line(x, h - hgt, x + (h1(x, 65) - 0.5) * 4, h - hgt - gh, 1); }
    }
    // 傾いた道標
    const px0 = w * 0.16, py0 = h - (wide ? 22 : 30) * k;
    m.line(px0, py0 + 10 * k, px0 + 6 * k, py0 - 46 * k, Math.max(2, 3.2 * k));
    m.line(px0 - 10 * k, py0 - 34 * k, px0 + 20 * k, py0 - 40 * k, Math.max(2, 4 * k));
    L.paint(m, (x, y) => {
      let c = rc(R_NIGHT, 0.03 + vnoise(x * 0.3, y * 0.3, 66) * 0.03);
      if (m.rim(x, y, 0.5, -1, 1) === 1) c = mix(c, rc(R_BLOOD, 0.45), 0.6);
      return c;
    });
  }
  near.bake(8);
  const motes = Array.from({ length: Math.round(40 * Math.max(1, W / 260)) }, (_, i) => i);
  const glowPit = glowSprite(10 * k, R_SOUL.slice(2), { pow: 1.6, levels: 5, core: 0.8 });
  const planes = [sky, far, midP, near];
  // 魂の光の柱 (遠くの迷宮から雲へ)
  const pillar = (() => {
    const pw = Math.max(7, Math.round(16 * k)), ph = Math.round(far.h * 0.62);
    const c = document.createElement("canvas"); c.width = pw; c.height = ph;
    const gg = c.getContext("2d"), img = gg.createImageData(pw, ph);
    for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
      const u = Math.abs(x - (pw - 1) / 2) / (pw / 2), v = y / ph;
      const t2 = Math.floor(Math.pow(1 - u, 1.8) * Math.pow(v, 1.6) * 6) / 6;
      if (t2 <= 0) continue;
      const col = rc(R_SOUL, 0.15 + 0.6 * t2), p = (y * pw + x) * 4;
      img.data[p] = col[0]; img.data[p + 1] = col[1]; img.data[p + 2] = col[2]; img.data[p + 3] = 255;
    }
    gg.putImageData(img, 0, 0);
    return c;
  })();
  far.post = (g, t, o) => {
    g.globalCompositeOperation = "lighter";
    for (const p of pits) {
      const sc = 0.3 + p.r / (12 * k);
      g.globalAlpha = clamp((0.55 + 0.2 * Math.sin(t * 0.0017 + p.x)) * Math.min(1, sc));
      const pw = Math.max(2, Math.round(pillar.width * Math.min(1, sc) * 0.7)), ph = Math.round(pillar.height * (0.55 + 0.45 * Math.min(1.2, sc)));
      g.drawImage(pillar, Math.round(p.x + o.x - pw / 2), Math.round(p.y + o.y - ph), pw, ph);
    }
    g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
    for (const p of pits) lit(g, glowPit, p.x + o.x, p.y + o.y - p.r * 0.5, 0.25 + 0.15 * Math.sin(t * 0.002 + p.x));
    // 遠くの光の柱から昇る魂
    for (let i = 0; i < pits.length * 3; i++) {
      const p = pits[i % pits.length];
      const u = ((t * 0.00008 * (1 + h1(i, 3)) + h1(i, 4)) % 1);
      mote(g, p.x + o.x + Math.sin(t * 0.001 + i) * 2, p.y + o.y - u * 40 * k, Math.sin(u * Math.PI) * 0.8, "#bdeec6", "#357a62");
    }
  };
  midP.post = (g, t, o) => {
    g.globalCompositeOperation = "lighter";
    for (const p of midPits) {
      const sc = clamp(p.r / (10 * k), 0.4, 1.6);
      g.globalAlpha = clamp(0.5 + 0.2 * Math.sin(t * 0.0017 + p.x));
      const pw = Math.max(3, Math.round(pillar.width * 0.8 * sc)), ph = Math.round(pillar.height * (0.7 + 0.5 * sc));
      g.drawImage(pillar, Math.round(p.x + o.x - pw / 2), Math.round(p.y + o.y - ph), pw, ph);
    }
    g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
    for (const p of midPits) lit(g, glowPit, p.x + o.x, p.y + o.y, 0.45);
    // 裂け目から湧き上がる魂の群れ
    for (const i of motes) {
      const row = crack[Math.floor(h1(i, 7) * crack.length * 0.95)];
      if (!row) continue;
      const [y0, el, er] = row;
      const u = ((t * 0.00006 * (1 + h1(i, 8) * 1.5) + h1(i, 9)) % 1);
      const x = el + (er - el) * (0.3 + 0.4 * h1(i, 10)) + Math.sin(t * 0.0013 + i) * 3 * k * u;
      const y = y0 - u * 90 * k;
      mote(g, x + o.x, y + o.y, Math.sin(u * Math.PI) * (0.6 + 0.4 * Math.sin(t * 0.005 + i)), i % 5 ? "#8ed6a6" : "#e9fff2", "#275f50");
    }
  };
  let bolt = null, nextBolt = 2600, flash = 0;
  const fx = (g, t) => {
    if (REDUCED) return;
    if (t > nextBolt) {
      nextBolt = t + 5200 + h1(Math.floor(t), 2) * 4000; flash = 1;
      const R = rng(Math.floor(t) + 9); const segs = [];
      let x = W * (0.15 + R() * 0.3), y = 0;
      while (y < H * 0.38) { const nx = x + (R() - 0.5) * 9 * k, ny = y + 2 + R() * 6 * k; segs.push([x, y, nx, ny]); x = nx; y = ny; }
      bolt = { segs, t };
    }
    if (flash > 0.02) {
      g.globalCompositeOperation = "lighter"; g.globalAlpha = flash * 0.18; g.fillStyle = "#8a3040"; g.fillRect(0, 0, W, H * 0.55);
      g.globalCompositeOperation = "source-over"; g.globalAlpha = 1; flash *= 0.86;
    }
    if (bolt && t - bolt.t < 220 && (t - bolt.t) % 110 < 70) {
      g.fillStyle = "#ffe0e0";
      for (const [x0, y0, x1, y1] of bolt.segs) { const n = Math.max(1, Math.ceil(Math.abs(y1 - y0))); for (let j = 0; j <= n; j++) g.fillRect(Math.round(x0 + (x1 - x0) * j / n), Math.round(y0 + (y1 - y0) * j / n), 1, 1); }
    }
  };
  // 稲妻は空と遠景の間に挟む
  sky.post = (g, t) => fx(g, t);
  return new Shot(W, H, planes, null);
}

// =====================================================================
// 幕 2「還らぬ者」— 深みへ降りる大階段。壁にもたれて息絶えた騎士、燃え残る松明、
// その胸から抜け出た魂が闇の底へ吸われてゆく。闇の奥には巨きな双眸。
// 剣を突き立てて跪いたまま息絶えた騎士 (横向き・右向き)。S = 立ち姿の身長、(x, y) = 膝をつく段の面
function knightKneel(m, x, y, S) {
  const P = (u, v) => [x + u * S, y - v * S];
  const lim = (a, b, t0, t1, val) => { const A = P(...a), B = P(...b); m.line(A[0], A[1], B[0], B[1], Math.max(1, t0 * S), val, Math.max(1, t1 * S)); };
  // 外套 (肩から背へ流れ、段に溜まる)
  m.poly([...P(-0.0, 0.6), ...P(-0.09, 0.52), ...P(-0.16, 0.3), ...P(-0.22, 0.08), ...P(-0.36, 0.0), ...P(-0.08, 0.0), ...P(-0.04, 0.25)], 1);
  // 奥の脚 (膝をつき、脛は段に寝かせる)
  lim([-0.02, 0.26], [-0.06, 0.035], 0.085, 0.06, 3);
  lim([-0.06, 0.035], [-0.27, 0.025], 0.055, 0.045, 3);
  m.ellipse(...P(-0.06, 0.04), 0.04 * S, 0.035 * S, 3);
  // 手前の脚 (膝を立てる)
  lim([-0.01, 0.25], [0.19, 0.27], 0.085, 0.07, 2);
  lim([0.19, 0.27], [0.185, 0.035], 0.062, 0.05, 2);
  m.ellipse(...P(0.195, 0.27), 0.042 * S, 0.04 * S, 2);
  m.poly([...P(0.16, 0.045), ...P(0.29, 0.03), ...P(0.29, 0.0), ...P(0.15, 0.0)], 2);
  // 胴 (前のめりに崩れる)
  m.poly([...P(-0.08, 0.27), ...P(0.07, 0.25), ...P(0.12, 0.42), ...P(0.1, 0.58), ...P(0.0, 0.62), ...P(-0.08, 0.56), ...P(-0.09, 0.4)], 4);
  // 剣: 段に突き立て、両手で柄を握る
  m.line(...P(0.31, 0.45), ...P(0.31, -0.02), Math.max(1, 0.026 * S), 8, Math.max(1, 0.012 * S));
  m.poly([...P(0.25, 0.375), ...P(0.37, 0.375), ...P(0.37, 0.355), ...P(0.25, 0.355)], 9);
  m.ellipse(...P(0.31, 0.47), 0.016 * S, 0.016 * S, 9);
  // 腕 (肩から柄へ)
  lim([0.04, 0.55], [0.13, 0.43], 0.06, 0.05, 5);
  lim([0.13, 0.43], [0.29, 0.415], 0.05, 0.045, 5);
  m.ellipse(...P(0.3, 0.415), 0.03 * S, 0.028 * S, 5);
  // 肩当て
  m.poly([...P(-0.04, 0.6), ...P(0.07, 0.62), ...P(0.11, 0.56), ...P(0.08, 0.5), ...P(-0.03, 0.51)], 6);
  // 兜 (うなだれ、面頬が下を向く)
  m.poly([...P(0.07, 0.6), ...P(0.12, 0.66), ...P(0.18, 0.66), ...P(0.22, 0.6), ...P(0.21, 0.53), ...P(0.15, 0.51), ...P(0.09, 0.54)], 7);
  m.line(...P(0.15, 0.59), ...P(0.215, 0.565), Math.max(1, 0.012 * S), 10); // 覗き穴
  m.line(...P(0.13, 0.665), ...P(0.07, 0.72), Math.max(1, 0.014 * S), 7, 1); // 兜の飾り (折れた羽根)
  return { chest: P(0.05, 0.45), hilt: P(0.31, 0.45) };
}

function scene2(W, H) {
  const k = Math.min(W / 260, H / 300);
  const wide = W / H > 1.4;
  const mx = 22 * k, my = 8 * k;
  const back = new Plane(W, H, mx, my, 0.3), midP = new Plane(W, H, mx, my, 0.7), near = new Plane(W, H, mx, my, 1);
  // 階段の形 (中景の座標): 左上から右下の闇へ
  const w = midP.w, h = midP.h;
  const st = { x0: -10, y0: h * (wide ? 0.5 : 0.52), x1: w * 0.98, y1: h * 0.98 };
  const stepW = Math.max(6, (wide ? 12 : 11) * k), stepH = Math.max(3, 6 * k);
  const stairY = (x) => {
    const n = Math.floor((x - st.x0) / stepW);
    return st.y0 + n * stepH;
  };
  const knightS = (wide ? 1.0 : 0.95) * Math.min(h * 0.6, 165 * k);
  const kx = w * (wide ? 0.3 : 0.3);
  const ky = stairY(kx);
  const torch = { x: kx + knightS * 0.5, y: 0 };
  torch.y = stairY(torch.x) - 2 * k;
  const lamps = [{ x: torch.x, y: torch.y - 8 * k, r: 84 * k, sq: 1.15, ramp: R_EMBER, k: 1.2 }];
  // 高窓から差す冷たい光の帯
  const shaft = { x0: w * 0.02, x1: w * 0.22, slope: 0.55 };
  const inShaft = (x, y) => { const xo = x - y * shaft.slope; return xo > shaft.x0 && xo < shaft.x1; };
  // 闇の大アーチ (右手、階段が呑まれてゆく先)
  const bigA = { cx: w * (wide ? 0.8 : 0.84), sy: h * 0.42, a: (wide ? 46 : 40) * k };
  // --- 奥: 闇へ続く大アーチ (双眸が潜む)
  const eyes = { x: bigA.cx - midP.ox + back.ox, y: bigA.sy - midP.oy + back.oy - 6 * k };
  {
    const L = back.L, bw = back.w, bh = back.h;
    L.shade(0, 0, bw - 1, bh - 1, (x, y) => {
      let c = rc(R_NIGHT, 0.05 + 0.04 * vnoise(x * 0.05, y * 0.05, 71));
      // 巨大な石積み
      const cs = Math.round(14 * k), row = Math.floor(y / cs);
      if (y % cs === 0 || (x + (row % 2) * cs) % (cs * 2) === 0) c = rc(R_NIGHT, 0.025);
      // 奥の闇 (底から赤くにじむ)
      const d = Math.hypot((x - eyes.x) / (60 * k), (y - eyes.y) / (70 * k));
      c = mix(c, rc(R_NIGHT, 0.0), smooth(1.4, 0.4, d));
      c = mix(c, rc(R_BLOOD, 0.22), Math.exp(-d * 2.4) * 0.5);
      return c;
    });
  }
  back.bake(8);
  // --- 中景: 壁のアーチ列、大階段、騎士、松明
  let kn;
  {
    const L = midP.L;
    // 背の壁 (アーチ列)
    L.shade(0, 0, w - 1, h - 1, (x, y) => {
      if (y > stairY(x)) return null;
      if (inArch(x + 0.5, y + 0.5, bigA.cx, bigA.sy, bigA.a)) return null; // 奥の闇が覗く
      let c = rc(R_NIGHT, 0.13 + 0.05 * vnoise(x * 0.3, y * 0.3, 73));
      const cs = Math.round(8 * k), row = Math.floor(y / cs);
      if (y % cs === 0 || (x + (row % 2) * cs) % (cs * 2) === 0) c = rc(R_NIGHT, 0.07);
      // 大アーチの迫石
      if (inArch(x + 0.5, y + 0.5, bigA.cx, bigA.sy, bigA.a + 7 * k)) {
        const ang = Math.atan2(y - bigA.sy, x - bigA.cx);
        c = rc(R_NIGHT, (Math.floor(ang * 9) % 2 ? 0.17 : 0.14) + vnoise(x * 0.4, y * 0.4, 72) * 0.05);
        if (inArch(x + 0.5, y + 0.5, bigA.cx, bigA.sy, bigA.a + 1.5)) c = mix(c, rc(R_BLOOD, 0.3), 0.5);
      }
      // 壁の小さな墓龕
      const nx = ((x % Math.round(48 * k)) + Math.round(48 * k)) % Math.round(48 * k);
      if (inArch(nx, y, 24 * k, h * 0.26, 7 * k) && y < h * 0.26 + 12 * k && x < bigA.cx - bigA.a - 20 * k) c = rc(R_NIGHT, 0.03);
      if (inShaft(x, y)) c = mix(c, rc(R_FOG, 0.35), 0.35 * (1 - y / h));
      return applyLights(c, x, y, lamps, 0.9);
    });
    // 柱 (騎士がもたれる)
    const pm = new Mask(w, h);
    const px0 = kx - 0.2 * knightS;
    pm.rect(px0 - 9 * k, 0, 18 * k, ky + 2);
    pm.rect(px0 - 12 * k, ky - 8 * k, 24 * k, 9 * k);
    L.paint(pm, (x, y) => {
      const u = (x - (px0 - 9 * k)) / (18 * k);
      let c = rc(R_NIGHT, 0.14 + Math.sin(u * Math.PI) * 0.06 + vnoise(x * 0.4, y * 0.4, 74) * 0.04);
      return applyLights(c, x, y, lamps, clamp(u * 1.4));
    });
    // 階段
    const sm = new Mask(w, h);
    for (let x = 0; x < w; x++) for (let y = Math.max(0, Math.floor(stairY(x))); y < h; y++) sm.m[y * w + x] = 1;
    sm.x0 = 0; sm.x1 = w - 1; sm.y0 = Math.floor(st.y0); sm.y1 = h - 1;
    L.paint(sm, (x, y) => {
      const top = y - stairY(x);
      const nose = top < 1.5;
      const riser = ((x - st.x0) % stepW) < 1.5;
      let c = rc(R_NIGHT, nose ? 0.24 : riser ? 0.06 : 0.11 + vnoise(x * 0.5, y * 0.5, 75) * 0.05);
      if (h2(x >> 1, y >> 1, 76) < 0.03) c = rc(R_NIGHT, 0.04);
      if (inShaft(x, y)) c = mix(c, rc(R_FOG, nose ? 0.7 : 0.35), nose ? 0.55 : 0.3);
      c = applyLights(c, x, y, lamps, nose ? 1.3 : riser ? 0.15 : 0.45);
      // 右下ほど闇に沈む
      c = mix(c, rc(R_NIGHT, 0.0), smooth(0.55, 1.0, x / w) * 0.85);
      return c;
    });
    // 騎士
    const km = new Mask(w, h);
    kn = knightKneel(km, kx, ky, knightS);
    L.paint(km, (x, y, v) => {
      if (v === 10) return rc(R_NIGHT, 0.0);
      // 光源 (松明) へ向く面ほど明るい。鋼は鈍く、外套は乾いた血の色
      const dx = torch.x - x, dy = (torch.y - 6 * k) - y, dl = Math.hypot(dx, dy) || 1;
      const r1 = km.rim(x, y, dx / dl, dy / dl, 3);
      const facing = r1 <= 3 ? (4 - r1) / 3 : 0;
      const seam = km.at(x - 1, y) !== v || km.at(x, y + 1) !== v; // 部位の継ぎ目は暗い線
      // 板金の段 (肢に沿った横縞)
      const band = (v === 2 || v === 3 || v === 5) && (Math.floor((x + y * 0.6) / Math.max(2, 3 * k)) % 3 === 0);
      const nn = km.nx(x, y, Math.max(3, Math.round(0.05 * knightS)), 1);
      const form = clamp(0.35 + nn * 0.65);
      let base = v === 6 || v === 7 ? 0.16 : v === 8 ? 0.34 : v === 9 ? 0.26 : 0.1;
      base += facing * 0.2 + form * 0.16 - (seam ? 0.08 : 0) - (band ? 0.04 : 0) + vnoise(x * 0.6, y * 0.6, 77) * 0.03;
      let c = v === 1 ? rc(R_BLOOD, 0.1 + facing * 0.18) : rc(R_STEEL, base);
      c = applyLights(c, x, y, lamps, 0.15 + facing * 0.8 + form * 0.5);
      // 背後 (闇の側) からの冷たい縁
      if (km.rim(x, y, -1, -0.4, 1) === 1 && v !== 1) c = mix(c, rc(R_SOULSTONE, 0.45), 0.4);
      if (inShaft(x, y) && km.rim(x, y, -0.5, -1, 1) === 1) c = mix(c, rc(R_FOG, 0.8), 0.6);
      return c;
    });
    // 松明 (段に転がる)
    const tm = new Mask(w, h);
    tm.line(torch.x - 10 * k, torch.y + 3 * k, torch.x + 1, torch.y, Math.max(1, 2.2 * k), 1);
    L.paint(tm, (x, y) => rc(R_WOOD, 0.35));
  }
  midP.bake(12);
  // --- 近景: 手前の柱の影と崩れた石
  {
    const L = near.L, nw = near.w, nh = near.h;
    const m = new Mask(nw, nh);
    m.rect(nw - (wide ? 30 : 22) * k, 0, 40 * k, nh);
    for (let i = 0; i < 6; i++) m.ellipse(nw * (0.05 + i * 0.07), nh - 2 * k, (4 + h1(i, 81) * 8) * k, (3 + h1(i, 82) * 4) * k);
    L.paint(m, (x, y) => {
      let c = rc(R_NIGHT, 0.025);
      if (m.rim(x, y, -1, 0, 1) === 1) c = rc(R_EMBER, 0.12);
      return c;
    });
  }
  near.bake(8);
  const fire = glowSprite(Math.round(34 * k), R_EMBER.slice(0, 8), { pow: 2.4, levels: 6, core: 0.7 });
  const eyeGlow = glowSprite(Math.round(9 * k), R_BLOOD.slice(2), { pow: 1.4, levels: 5, squash: 0.6 });
  midP.pre = null;
  back.post = (g, t, o) => {
    // 闇の奥の双眸: ゆっくり開いて、時々まばたく
    const open = clamp((t - 1200) / 2600) * (Math.floor(t / 4300) % 3 === 2 && (t % 4300) < 160 ? 0 : 1);
    if (open <= 0) return;
    for (const sd of [-1, 1]) {
      const ex = eyes.x + o.x + sd * 13 * k, ey = eyes.y + o.y;
      lit(g, eyeGlow, ex, ey, 0.6 * open);
      g.fillStyle = "#de7048";
      const ew = Math.round(5 * k), eh = Math.max(1, Math.round(1.6 * k * open));
      g.fillRect(Math.round(ex - ew / 2 - sd * k), Math.round(ey - eh / 2), ew, eh);
      g.fillStyle = "#fff3c4"; g.fillRect(Math.round(ex - sd * k), Math.round(ey), 1, 1);
    }
  };
  midP.post = (g, t, o, prog) => {
    const f = flick(t, 1);
    lit(g, fire, torch.x + o.x, torch.y + o.y - 4 * k, f * 0.55);
    // 炎
    for (let i = 0; i < 6; i++) {
      const u = ((t * 0.0016 + h1(i, 91)) % 1);
      g.fillStyle = u < 0.3 ? "#fff3c4" : u < 0.6 ? "#f4b04a" : "#c4641c";
      g.globalAlpha = 1 - u;
      g.fillRect(Math.round(torch.x + o.x + Math.sin(t * 0.01 + i) * 1.5 * k), Math.round(torch.y + o.y - 2 - u * 9 * k), 1, 1 + (u < 0.3 ? 1 : 0));
    }
    g.globalAlpha = 1;
    // 胸から抜け出し、闇の奥へ吸われてゆく魂の帯
    const [cx, cy] = kn.chest;
    const tx = bigA.cx, ty = bigA.sy + 4 * k;
    for (let i = 0; i < 90; i++) {
      const strand = i % 3;
      const u = ((t * 0.00011 * (1 + strand * 0.15) + i / 90) % 1);
      const sway = Math.sin(u * 7 + t * 0.0021 + strand * 2) * (3 + strand * 3) * k * Math.sin(u * Math.PI);
      const bx = cx + (tx - cx) * u + sway;
      const by = cy + (ty - cy) * u - Math.sin(u * Math.PI) * (26 + strand * 8) * k + Math.cos(u * 5 + strand) * 2 * k;
      const a = Math.sin(Math.min(1, u * 1.4) * Math.PI) * (0.95 - u * 0.4) * (strand === 0 ? 1 : 0.55);
      mote(g, bx + o.x, by + o.y, a, strand === 0 && i % 4 === 0 ? "#e9fff2" : "#8ed6a6", "#275f50");
    }
    // 光の帯の塵
    for (let i = 0; i < 24; i++) {
      const yy = ((h1(i, 95) * h + t * 0.004 * (1 + h1(i, 96))) % h);
      const xx = shaft.x0 + h1(i, 97) * (shaft.x1 - shaft.x0) + yy * shaft.slope;
      g.globalAlpha = 0.35 + 0.3 * Math.sin(t * 0.003 + i);
      g.fillStyle = "#958fa4";
      g.fillRect(Math.round(xx + o.x), Math.round(yy + o.y), 1, 1);
    }
    g.globalAlpha = 1;
  };
  return new Shot(W, H, [back, midP, near], null);
}

// =====================================================================
// 幕 3「人業」— 魂繰りの工房。糸で吊られた等身大の器 (麻布張りの関節人形) がいくつも並び、
// 手前の一体の胸に魂が封じられたとき、その眼が静かに灯る。
// 人業 = 麻布張りの関節人形。縫い目の走るのっぺりとした球の頭、丸い筒の手足、
// 継ぎ目ごとに鈍い真鍮の球関節。古び、煤けた麻の肌 (参考: 魂繰りの工房に転がる器)。
const R_LINEN = ramp(["#221d1a", "#332c27", "#463d35", "#5b5045", "#716455", "#887a67", "#9f917c", "#b5a891", "#c9bea6", "#dbd2bc"]);
const R_BRONZE = ramp(["#0e0a07", "#1d140d", "#2f2015", "#45301d", "#5e4226", "#7a5832", "#977246", "#b48f60"]);
// 人業の幕だけは麻と真鍮の色を足した色盤で焼く (共通の色盤だと麻の灰褐色が青い斑に崩れる)
const PAL_DOLL = new Palette([...MASTER, ...R_LINEN, ...R_BRONZE]);
// 吊られた人業 (正面)。H = 身長、(cx, feet) = 足先。
// 値: 1 麻の肌 / 2 真鍮の球関節 / 3 浅い目のくぼみ / 4 胸の魂受け / 5 縫い目 / 6 吊り糸 / 7 足裏・手先の切り口
function dollHanging(m, cx, feet, H, tilt = 0.03) {
  const P = (u, v) => [cx + u * H, feet - v * H];
  // 手足の筒: 両端を丸めて (樽のような) 筒にする
  const lim = (a, b, t0, t1 = t0, val = 1) => {
    const A = P(...a), B = P(...b);
    m.line(A[0], A[1], B[0], B[1], Math.max(1, t0 * H), val, Math.max(1, t1 * H));
    m.ellipse(A[0], A[1], Math.max(1, t0 * H / 2), Math.max(1, t0 * H * 0.22), val);
    m.ellipse(B[0], B[1], Math.max(1, t1 * H / 2), Math.max(1, t1 * H * 0.22), val);
  };
  const ball = (u, v, r) => m.ellipse(...P(u, v), Math.max(1, r * H), Math.max(1, r * H), 2);
  for (const sd of [-1, 1]) {
    // 脚: 腿・脛は丸い筒。足は平らな底の短い筒 (爪先を下へ垂らす)
    lim([sd * 0.052, 0.368], [sd * 0.052, 0.226], 0.078, 0.07);
    lim([sd * 0.052, 0.198], [sd * 0.05, 0.08], 0.068, 0.06);
    lim([sd * 0.05, 0.058], [sd * 0.05, 0.012], 0.072);
    m.rect(...P(sd * 0.05 - 0.034, 0.012), 0.068 * H, Math.max(1, 0.014 * H), 7);
    // 腕: 上腕・前腕の筒。手は丸く閉じた筒の先
    lim([sd * 0.142, 0.648], [sd * 0.146, 0.52], 0.058, 0.054);
    lim([sd * 0.146, 0.492], [sd * 0.144, 0.374], 0.054, 0.048);
    m.ellipse(...P(sd * 0.144, 0.33), 0.024 * H, 0.03 * H, 1); // 手: 丸く閉じた先
  }
  // 胴: 丸い胸の樽と、くびれの下の丸い腰 (一続きにせず、腰の球関節で分かれる)
  m.ellipse(...P(0, 0.622), 0.1 * H, 0.094 * H, 1);
  m.ellipse(...P(0, 0.6), 0.088 * H, 0.08 * H, 1);
  m.ellipse(...P(0, 0.44), 0.084 * H, 0.066 * H, 1);
  // 頭: 大きな球 (縫い目が走る)
  const hx = cx + tilt * H, hy = feet - 0.84 * H, hr = 0.112 * H;
  m.ellipse(hx, hy, hr, hr * 1.02, 1);
  // 縫い目: 頭を縦に巡る弧と、横へ回り込む弧
  const stitch = (pts) => { for (let i = 1; i < pts.length; i++) m.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], 1, 5); };
  const arc1 = [], arc2 = [];
  for (let i = 0; i <= 18; i++) {
    const q = i / 18, a = -Math.PI / 2 + q * Math.PI; // 頭頂 → 顎へ、右寄りに膨らむ子午線
    arc1.push([hx + hr * (0.08 + 0.42 * Math.cos(a)), hy + hr * 0.99 * Math.sin(a)]);
    const b2 = Math.PI * (1.08 + q * 0.42); // 頭頂を左へ回り込む短い縫い目
    arc2.push([hx + hr * 0.95 * Math.cos(b2), hy + hr * 0.95 * Math.sin(b2)]);
  }
  stitch(arc1); stitch(arc2);
  // 球関節: 首・肩・肘・手首・腰・股・膝・足首 (筒の継ぎ目から覗く鈍い真鍮)
  ball(0, 0.724, 0.022);
  ball(0, 0.517, 0.026);
  for (const sd of [-1, 1]) {
    ball(sd * 0.122, 0.666, 0.024);
    ball(sd * 0.146, 0.506, 0.019);
    ball(sd * 0.144, 0.362, 0.014);
    ball(sd * 0.052, 0.384, 0.022);
    ball(sd * 0.051, 0.212, 0.02);
    ball(sd * 0.05, 0.069, 0.016);
  }
  // 眼の位置 (のっぺりとした球の頭) と胸の魂受け
  const eyes = [];
  for (const sd of [-1, 1]) {
    eyes.push([hx + sd * 0.036 * H, hy + 0.012 * H]); // 眼は描かない (魂が宿ると光だけが灯る)
  }
  m.ellipse(cx, feet - 0.63 * H, 0.02 * H, 0.02 * H, 4);
  return {
    eyes, core: [cx, feet - 0.63 * H], head: [hx, hy - hr],
    shoulders: [P(-0.122, 0.69), P(0.122, 0.69)], hands: [P(-0.144, 0.31), P(0.144, 0.31)],
  };
}
// 吊り糸 (操り糸): 梁から頭と両の手首へ。値 6
function dollStrings(m, d, top, k) {
  for (const [ex, ey] of [d.head, ...d.hands]) m.line(ex, top, ex, ey, Math.max(1, 0.6 * k), 6);
}
function shadeDoll(L, m, cx, feet, H, { lamps, rimDir = [1, -0.6], rimRamp = R_FOG, dark = 0 }) {
  const w0 = Math.max(1, Math.round(0.004 * H)); // 麻の織り目の細かさ
  // 肌 (麻・縫い目・切り口) を一続きの面として左右の縁を測る擬似法線。球関節・糸・空白で区切る
  const isSkin = (xx, yy) => { const t = m.at(xx, yy); return t === 1 || t === 5 || t === 7; };
  const skinNx = (x, y, max) => {
    let dl = 0, dr = 0;
    while (dl < max && isSkin(x - dl - 1, y)) dl++;
    while (dr < max && isSkin(x + dr + 1, y)) dr++;
    return (dl - dr) / (dl + dr + 1);
  };
  L.paint(m, (x, y, v) => {
    if (v === 4) return rc(R_NIGHT, 0.04);
    if (dark > 0.5) {
      // 奥の器は影絵: 窓の側の縁だけが冷たく光る。糸はかすかに光る
      if (v === 6) return rc(R_FOG, 0.12);
      let c = rc(R_NIGHT, 0.03 + (v === 2 ? 0.012 : 0));
      if (m.rim(x, y, rimDir[0], rimDir[1], 2) <= 1) c = mix(c, rc(rimRamp, 0.4), 0.45);
      return c;
    }
    if (v === 6) { const c = rc(R_LINEN, 0.55); return lamps ? applyLights(c, x, y, lamps, 0.5) : c; }
    // 丸みの陰影 (主光 = 左下の蝋燭へ向く面ほど明るい)
    const n = v === 2 ? m.nx(x, y, Math.max(3, Math.round(0.04 * H)), 1) : skinNx(x, y, Math.max(3, Math.round(0.04 * H))); // 縫い目で陰影を途切れさせない
    const lam = clamp(0.18 - n * 0.82);
    let c;
    if (v === 2) {
      // 真鍮の球: 鈍い地に、光の側だけ小さな照り
      c = rc(R_BRONZE, 0.25 + lam * 0.6);
      if (m.rim(x, y, -0.8, -1, 1) === 1) c = mix(c, rc(R_BRONZE, 1), 0.45);
    } else {
      // 麻の肌: 織り目 (細かな格子の明暗) と、煤・手垢のむら
      const weave = ((Math.floor(x / w0) + Math.floor(y / w0)) & 1) ? 0.012 : -0.01;
      const grime = (vnoise(x * 0.1, y * 0.1, 101) - 0.5) * 0.08 + (vnoise(x * 0.45, y * 0.45, 102) - 0.5) * 0.03;
      c = rc(R_LINEN, 0.2 + lam * 0.62 + weave + grime);
      if (v === 3) c = mix(c, rc(R_LINEN, 0.12), 0.55);
      else if (v === 5) c = mix(c, rc(R_LINEN, 0.1), ((x + y) & 1) ? 0.4 : 0.2); // 縫い目 (目の詰んだ糸)
      else if (v === 7) c = rc(R_LINEN, 0.14 + lam * 0.2); // 筒の切り口
      // 筒の端 (球関節の際) は陰る
      const edge = m.at(x, y + 1) === 2 || m.at(x, y - 1) === 2 || m.at(x + 1, y) === 2 || m.at(x - 1, y) === 2;
      if (edge) c = mix(c, rc(R_NIGHT, 0.05), 0.4);
    }
    if (lamps) c = applyLights(c, x, y, lamps, 0.1 + lam * 0.9);
    if (m.rim(x, y, rimDir[0], rimDir[1], 1) === 1) c = mix(c, rc(rimRamp, 0.75), 0.45 - dark * 0.2);
    return c;
  });
}

function scene3(W, H) {
  const k = Math.min(W / 260, H / 300);
  const wide = W / H > 1.4;
  const mx = 26 * k, my = 6 * k;
  const back = new Plane(W, H, mx, my, 0.25), midP = new Plane(W, H, mx, my, 0.6), near = new Plane(W, H, mx, my, 1);
  const win = { x: back.w * (wide ? 0.66 : 0.7), y: back.h * 0.12, w: (wide ? 40 : 46) * k, h: back.h * 0.62 };
  // --- 奥: 高窓の月光と、棚の影
  {
    const L = back.L, bw = back.w, bh = back.h;
    L.shade(0, 0, bw - 1, bh - 1, (x, y) => {
      let c = rc(R_NIGHT, 0.09 + vnoise(x * 0.08, y * 0.08, 111) * 0.04);
      const cs = Math.round(9 * k), row = Math.floor(y / cs);
      if (y % cs === 0 || (x + (row % 2) * cs) % (cs * 2) === 0) c = rc(R_NIGHT, 0.05);
      // 窓 (尖頭、縦の桟と円窓の飾り)
      const inW = inArch(x + 0.5, y + 0.5, win.x, win.y + win.w * 0.9, win.w / 2) && y < win.y + win.h;
      if (inW) {
        const mull = Math.abs(x - win.x) < 1.2 * k || Math.abs(Math.abs(x - win.x) - win.w * 0.25) < 0.8 * k || (y - win.y) % Math.round(14 * k) < 1.2 * k;
        const glass = vnoise(x * 0.5, y * 0.2, 112) * 0.1;
        c = mull ? rc(R_NIGHT, 0.04) : mix(rc(R_FOG, 0.05 + glass), rc(R_FOG, 0.32 + glass), clamp(1 - (y - win.y) / win.h) * 0.9);
      }
      // 月光の帯 (窓から左下へ)
      const sx = x - win.x + (y - win.y) * 0.75;
      if (y > win.y && Math.abs(sx) < win.w * 0.55) c = mix(c, rc(R_FOG, 0.45), 0.28 * (1 - Math.abs(sx) / (win.w * 0.55)));
      // 棚 (左の壁) と並ぶ瓶・頭蓋
      const shelfX = bw * 0.08, sh2 = bw * 0.36;
      if (x > shelfX && x < sh2) {
        for (let i = 0; i < 3; i++) {
          const yy = bh * (0.3 + i * 0.18);
          if (y > yy && y < yy + 2 * k) c = rc(R_WOOD, 0.18);
          const item = Math.floor((x - shelfX) / (9 * k));
          const ih = (4 + h2(item, i, 113) * 6) * k;
          if (y < yy && y > yy - ih && ((x - shelfX) % (9 * k)) < 6 * k && h2(item, i, 114) < 0.7) {
            c = h2(item, i, 115) < 0.25 ? rc(R_BONE, 0.1) : rc(R_NIGHT, 0.13);
            if (h2(item, i, 116) < 0.15) c = rc(R_SOUL, 0.35); // 魂を封じた小瓶
          }
        }
      }
      return c;
    });
  }
  back.bake(10);
  // --- 中景: 奥に並ぶ人業の列 (影の中)
  const midDolls = [];
  {
    const L = midP.L, w = midP.w, h = midP.h;
    // 梁
    const bm = new Mask(w, h);
    bm.rect(0, h * 0.04, w, 6 * k);
    L.paint(bm, (x, y) => rc(R_WOOD, 0.12 + (y - h * 0.04 < 1.5 ? 0.08 : 0)));
    const xs = wide ? [0.12, 0.28, 0.46, 0.84, 0.97] : [0.1, 0.3, 0.86, 1.0];
    xs.forEach((fx, i) => {
      const Hd = (h * 0.55) * (0.85 + h1(i, 117) * 0.12);
      const cx = w * fx, feet = h * 0.08 + Hd * 1.12;
      const m = new Mask(w, h);
      const d = dollHanging(m, cx, feet, Hd, (h1(i, 118) - 0.5) * 0.06);
      dollStrings(m, d, h * 0.04 + 6 * k, k); // 梁から垂れる操り糸
      shadeDoll(L, m, cx, feet, Hd, { lamps: null, rimDir: [1, -0.8], dark: 0.85 });
      midDolls.push(d);
    });
  }
  midP.bake(10, PAL_DOLL);
  // --- 近景: 主役の人業、作業台、蝋燭、魂の瓶
  let hero;
  const cand = [];
  const jar = {};
  {
    const L = near.L, w = near.w, h = near.h;
    const Hd = Math.min(h * 0.74, 220 * k);
    const cx = w * (wide ? 0.6 : 0.62), feet = h * 0.06 + Hd * 1.08;
    const bench = { x0: w * (wide ? 0.12 : 0.02), x1: w * (wide ? 0.44 : 0.46), y: h * 0.8 };
    for (let i = 0; i < 3; i++) cand.push({ x: bench.x0 + (bench.x1 - bench.x0) * (0.15 + i * 0.22), y: bench.y - (6 + i * 3) * k });
    jar.x = bench.x0 + (bench.x1 - bench.x0) * 0.78; jar.y = bench.y - 11 * k;
    const lamps = [
      { x: cand[1].x, y: cand[1].y - 6 * k, r: 170 * k, sq: 0.9, ramp: R_EMBER, k: 1.0 },
      { x: jar.x, y: jar.y, r: 60 * k, sq: 1, ramp: R_SOUL, k: 0.8 },
    ];
    const m = new Mask(w, h);
    hero = dollHanging(m, cx, feet, Hd, 0.018);
    dollStrings(m, hero, 0, k); // 上から垂れる操り糸 (頭と両の手首)
    shadeDoll(L, m, cx, feet, Hd, { lamps, rimDir: [0.8, -1], rimRamp: R_FOG });
    // 作業台
    const tm = new Mask(w, h);
    tm.rect(bench.x0, bench.y, bench.x1 - bench.x0, 5 * k, 1);
    tm.rect(bench.x0 + 4 * k, bench.y + 5 * k, 5 * k, h, 2);
    tm.rect(bench.x1 - 9 * k, bench.y + 5 * k, 5 * k, h, 2);
    // 台の上: 蝋燭・瓶・のみ・転がった人業の腕
    cand.forEach((c0, i) => { tm.rect(c0.x - 1.5 * k, c0.y, 3 * k, bench.y - c0.y, 3); tm.rect(c0.x - 2.5 * k, bench.y - 1.5 * k, 5 * k, 1.5 * k, 3); });
    tm.ellipse(jar.x, jar.y, 6 * k, 8 * k, 4);
    tm.rect(jar.x - 4 * k, jar.y - 10 * k, 8 * k, 2.5 * k, 5);
    tm.line(bench.x0 + 6 * k, bench.y - 1.5 * k, bench.x0 + 26 * k, bench.y - 4 * k, Math.max(1, 2.6 * k), 6, Math.max(1, 2 * k)); // 外された人業の腕
    tm.ellipse(bench.x0 + 27 * k, bench.y - 4.2 * k, 2 * k, 2 * k, 7);
    tm.line(bench.x1 - 22 * k, bench.y - 1, bench.x1 - 10 * k, bench.y - 2.5 * k, 1, 7); // のみ
    L.paint(tm, (x, y, v) => {
      let c;
      if (v === 1) c = rc(R_WOOD, (y - bench.y < 1.5 ? 0.3 : 0.12) + vnoise(x * 0.3, y, 121) * 0.06);
      else if (v === 2) c = rc(R_WOOD, 0.06);
      else if (v === 3) c = rc(R_BONE, 0.55 + (x < cand[0].x ? 0 : 0.05));
      else if (v === 4) { const d = Math.hypot((x - jar.x) / (6 * k), (y - jar.y) / (8 * k)); return mix(rc(R_SOUL, 0.85 - d * 0.5), rc(R_SOULSTONE, 0.3), d > 0.82 ? 0.7 : 0); }
      else if (v === 5) c = rc(R_STEEL, 0.25);
      else if (v === 6) c = rc(R_LINEN, 0.5);
      else c = rc(R_STEEL, 0.3);
      return applyLights(c, x, y, lamps, 0.7);
    });
    // 手前の鎖 (ぼけた前景) — 太く暗い
    const fm = new Mask(w, h);
    const fx0 = w * (wide ? 0.06 : 0.9);
    for (let y = 0; y < h * 0.7; y++) { const link = Math.floor(y / (5 * k)) % 2; fm._span(y, Math.round(fx0 - (link ? 2 : 1) * k), Math.round(fx0 + (link ? 2 : 1) * k), 1); }
    fm.ellipse(fx0, h * 0.7 + 4 * k, 5 * k, 6 * k, 1);
    L.paint(fm, (x, y) => (fm.rim(x, y, -1, 0, 1) === 1 ? rc(R_EMBER, 0.2) : rc(R_NIGHT, 0.03)));
  }
  near.bake(10, PAL_DOLL);
  const candleG = glowSprite(Math.round(26 * k), R_EMBER.slice(0, 8), { pow: 2.4, levels: 6, core: 0.65 });
  const jarG = glowSprite(Math.round(18 * k), R_SOUL.slice(1, 10), { pow: 2, levels: 5, core: 0.8 });
  const eyeG = glowSprite(Math.max(3, Math.round(3.5 * k)), R_SOUL.slice(4), { pow: 1.6, levels: 4 });
  const coreG = glowSprite(Math.round(16 * k), R_SOUL.slice(2), { pow: 1.6, levels: 5 });
  near.post = (g, t, o, prog) => {
    cand.forEach((c0, i) => {
      const f = flick(t, i + 2);
      lit(g, candleG, c0.x + o.x, c0.y + o.y - 3 * k, f * 0.5);
      g.fillStyle = "#fff3c4"; g.fillRect(Math.round(c0.x + o.x), Math.round(c0.y + o.y - 2 * k - (f > 0.8 ? 1 : 0)), 1, Math.max(2, Math.round(2 * k)));
      g.fillStyle = "#f4b04a"; g.fillRect(Math.round(c0.x + o.x), Math.round(c0.y + o.y - 3.5 * k - (f > 0.8 ? 1 : 0)), 1, 1);
    });
    // 瓶の中で渦を巻く魂
    lit(g, jarG, jar.x + o.x, jar.y + o.y, 0.45 + 0.15 * Math.sin(t * 0.004));
    for (let i = 0; i < 6; i++) { const a = t * 0.003 + i * 1.05; mote(g, jar.x + o.x + Math.cos(a) * 3 * k, jar.y + o.y + Math.sin(a * 1.3) * 4 * k, 0.9, "#e9fff2", "#357a62"); }
    // 魂が封じられると、胸の灯と眼がともる
    const on = smooth(0.42, 0.62, prog);
    if (on > 0) {
      const [cx2, cy2] = hero.core;
      lit(g, coreG, cx2 + o.x, cy2 + o.y, on * (0.75 + 0.15 * Math.sin(t * 0.005)));
      // 瓶から胸へ流れ込む光
      if (on < 1) for (let i = 0; i < 20; i++) {
        const u = ((t * 0.0006 + i / 20) % 1);
        mote(g, jar.x + (cx2 - jar.x) * u + o.x, jar.y + (cy2 - jar.y) * u - Math.sin(u * Math.PI) * 30 * k + o.y, (1 - on) * Math.sin(u * Math.PI), "#bdeec6", "#275f50");
      }
      const eo = smooth(0.55, 0.75, prog);
      if (eo > 0) for (const [ex, ey] of hero.eyes) {
        lit(g, eyeG, ex + o.x, ey + o.y, eo * 0.6);
        g.globalAlpha = eo; g.fillStyle = "#e9fff2"; // のっぺりとした顔に、細い光の筋だけが灯る
        g.fillRect(Math.round(ex + o.x - 0.6 * k), Math.round(ey + o.y), Math.max(1, Math.round(1.2 * k)), 1);
        g.globalAlpha = 1;
      }
    }
  };
  return new Shot(W, H, [back, midP, near], null);
}

// =====================================================================
// 幕 4「王の勅命」— 謁見の間。紅い旗の列柱の奥、玉座に沈む老王。手前の机には封蝋の勅書。
// 玉座の老王 (正面・写実)。S = 立ち姿の身長、(cx, seat) = 座面の中央
function kingOnThrone(m, cx, seat, S) {
  const P = (u, v) => [cx + u * S, seat - v * S];
  // 玉座 (高い背もたれと尖塔)
  m.poly([...P(-0.27, -0.28), ...P(0.27, -0.28), ...P(0.27, 0.2), ...P(0.22, 0.2), ...P(0.22, 0.95), ...P(0.16, 1.02), ...P(0.12, 0.98), ...P(0.06, 1.12), ...P(0.0, 1.2), ...P(-0.06, 1.12), ...P(-0.12, 0.98), ...P(-0.16, 1.02), ...P(-0.22, 0.95), ...P(-0.22, 0.2), ...P(-0.27, 0.2)], 1);
  for (const sd of [-1, 1]) m.poly([...P(sd * 0.25, 1.0), ...P(sd * 0.28, 1.0), ...P(sd * 0.265, 1.12)], 1);
  // 外套 (肩から床へ広がる)
  m.poly([...P(-0.13, 0.47), ...P(0.13, 0.47), ...P(0.19, 0.3), ...P(0.22, 0.0), ...P(0.24, -0.28), ...P(-0.24, -0.28), ...P(-0.22, 0.0), ...P(-0.19, 0.3)], 2);
  // 膝の上の衣 (前へ張り出す)
  m.poly([...P(-0.15, 0.06), ...P(0.15, 0.06), ...P(0.16, -0.06), ...P(0.12, -0.28), ...P(-0.12, -0.28), ...P(-0.16, -0.06)], 3);
  // 毛皮の襟
  m.poly([...P(-0.15, 0.49), ...P(0.15, 0.49), ...P(0.12, 0.42), ...P(0.0, 0.38), ...P(-0.12, 0.42)], 4);
  // 頭・長い白髪・髭
  m.ellipse(...P(0, 0.565), 0.047 * S, 0.062 * S, 5);
  m.poly([...P(-0.055, 0.6), ...P(-0.07, 0.5), ...P(-0.075, 0.4), ...P(-0.045, 0.44), ...P(-0.04, 0.55)], 6);
  m.poly([...P(0.055, 0.6), ...P(0.07, 0.5), ...P(0.075, 0.4), ...P(0.045, 0.44), ...P(0.04, 0.55)], 6);
  m.poly([...P(-0.035, 0.53), ...P(0.035, 0.53), ...P(0.03, 0.42), ...P(0.012, 0.3), ...P(0.0, 0.27), ...P(-0.012, 0.3), ...P(-0.03, 0.42)], 6);
  // 冠 (尖った鉄の冠)
  m.poly([...P(-0.05, 0.6), ...P(0.05, 0.6), ...P(0.052, 0.635), ...P(0.045, 0.69), ...P(0.03, 0.65), ...P(0.015, 0.7), ...P(0.0, 0.66), ...P(-0.015, 0.7), ...P(-0.03, 0.65), ...P(-0.045, 0.69), ...P(-0.052, 0.635)], 7);
  // 肘掛けをつかむ骨ばった手
  for (const sd of [-1, 1]) {
    m.rect(cx + sd * 0.27 * S - (sd > 0 ? 0.08 * S : 0), seat - 0.2 * S, 0.08 * S, 0.03 * S, 1);
    m.ellipse(...P(sd * 0.215, 0.2), 0.026 * S, 0.02 * S, 8);
  }
  // 眼窩
  const eyes = [P(-0.018, 0.565), P(0.018, 0.565)];
  for (const [ex, ey] of eyes) m.ellipse(ex, ey, Math.max(1, 0.011 * S), Math.max(1, 0.007 * S), 9);
  return { eyes, head: P(0, 0.565) };
}

function scene4(W, H) {
  const k = Math.min(W / 260, H / 300);
  const wide = W / H > 1.4;
  const mx = 6 * k, my = 30 * k;
  const back = new Plane(W, H, mx, my, 0.25), midP = new Plane(W, H, mx, my, 0.6), near = new Plane(W, H, mx, my, 1);
  // 消失点 (玉座) は奥の層の中央やや上
  const vx = back.w / 2, vy = back.h * 0.46;
  const S = Math.min(back.h * 0.42, 120 * k) * (wide ? 0.95 : 1);
  const seat = vy + 0.1 * S;
  const winC = { x: vx, y: seat - 1.05 * S, w: 0.3 * S };
  let king;
  {
    const L = back.L, bw = back.w, bh = back.h;
    const cand = [{ x: vx - 0.5 * S, y: seat - 0.1 * S, r: 50 * k, sq: 1, ramp: R_EMBER, k: 0.8 }, { x: vx + 0.5 * S, y: seat - 0.1 * S, r: 50 * k, sq: 1, ramp: R_EMBER, k: 0.8 }];
    L.shade(0, 0, bw - 1, bh - 1, (x, y) => {
      let c = rc(R_NIGHT, 0.08 + vnoise(x * 0.06, y * 0.06, 131) * 0.04);
      // 背後の高窓 (血の色の硝子)
      if (inArch(x + 0.5, y + 0.5, winC.x, winC.y, winC.w) && y < seat - 0.3 * S) {
        const mull = Math.abs(x - winC.x) < 1.2 * k || Math.abs(Math.abs(x - winC.x) - winC.w * 0.5) < 0.9 * k || ((y - winC.y) % Math.round(12 * k)) < 1;
        const lead = vnoise(x * 0.4, y * 0.4, 132);
        c = mull ? rc(R_NIGHT, 0.05) : mix(rc(R_BLOOD, 0.22 + lead * 0.22), rc(R_EMBER, 0.4), clamp((seat - y) / (2.2 * S)) * 0.35);
      }
      // 壇 (三段)
      for (let i = 0; i < 3; i++) {
        const yy = seat + 0.28 * S + i * 0.06 * S, hw = 0.5 * S + i * 0.18 * S;
        if (y >= yy && y < yy + 0.06 * S && Math.abs(x - vx) < hw) c = rc(R_NIGHT, y - yy < 1.5 ? 0.22 : 0.12);
      }
      // 床: 遠近の市松と、玉座へ続く緋の絨毯
      const fy = seat + 0.46 * S;
      if (y > fy) {
        const z = (y - fy) / (bh - fy);
        const u = (x - vx) / (8 * k + z * 120 * k), vv = 10 / (z + 0.08);
        const chk = (Math.floor(u * 2) + Math.floor(vv)) % 2;
        c = rc(R_NIGHT, chk ? 0.1 : 0.15);
        if (Math.abs(x - vx) < (0.18 * S + z * 60 * k)) c = rc(R_BLOOD, 0.2 + 0.1 * z + (chk ? 0 : 0.03));
      }
      return applyLights(c, x, y, cand, 0.7);
    });
    const m = new Mask(bw, bh);
    king = kingOnThrone(m, vx, seat, S);
    L.paint(m, (x, y, v) => {
      if (v === 9) return rc(R_NIGHT, 0.0);
      const n = m.nx(x, y, Math.max(4, Math.round(0.08 * S)), 1);
      let c;
      if (v === 1) c = rc(R_NIGHT, 0.1 + vnoise(x * 0.3, y * 0.3, 133) * 0.05);
      else if (v === 2) c = rc(R_BLOOD, 0.12 + Math.sin((x - vx) * 0.5 / k + vnoise(x * 0.1, y * 0.05, 134) * 3) * 0.04);
      else if (v === 3) c = rc(R_BLOOD, 0.16);
      else if (v === 4) c = rc(R_BONE, 0.08 + vnoise(x, y, 135) * 0.1);
      else if (v === 5) c = rc(R_NIGHT, 0.2);
      else if (v === 6) c = rc(R_BONE, 0.2 + vnoise(x * 0.8, y * 0.3, 136) * 0.15);
      else if (v === 7) c = rc(R_STEEL, 0.25);
      else c = rc(R_BONE, 0.15);
      // 背後の窓の血の縁 / 左右の燭台
      if (m.rim(x, y, (winC.x - x) / (S * 0.5), -1, 1) === 1 || m.rim(x, y, 0, -1, 1) === 1) c = mix(c, rc(R_BLOOD, 0.7), 0.55);
      c = applyLights(c, x, y, cand, 0.2 + Math.abs(n) * 0.9);
      return c;
    });
  }
  back.bake(10);
  // --- 中景: 遠近の列柱と吊るされた紅い旗
  {
    const L = midP.L, w = midP.w, h = midP.h;
    const vx2 = vx - back.ox + midP.ox, vy2 = vy - back.oy + midP.oy;
    const cols = [];
    for (let i = 0; i < 3; i++) {
      const z = Math.pow(0.6, i); // 1 = 手前
      for (const sd of [-1, 1]) cols.push({ x: vx2 + sd * (wide ? 200 : 125) * k * z, z, sd });
    }
    cols.sort((a, b) => a.z - b.z);
    for (const c0 of cols) {
      const cw = 22 * k * c0.z, top = vy2 - 260 * k * c0.z, bot = vy2 + (wide ? 130 : 150) * k * c0.z;
      const m = new Mask(w, h);
      m.rect(c0.x - cw / 2, top, cw, bot - top, 1);
      m.rect(c0.x - cw * 0.7, bot - cw * 0.5, cw * 1.4, cw * 0.5, 2);
      m.rect(c0.x - cw * 0.7, vy2 - 120 * k * c0.z, cw * 1.4, cw * 0.35, 2);
      // 旗 (柱の内側に垂れる)
      const bx = c0.x - c0.sd * cw * 1.6, bw2 = cw * 1.5;
      m.poly([bx - bw2 / 2, vy2 - 110 * k * c0.z, bx + bw2 / 2, vy2 - 110 * k * c0.z, bx + bw2 / 2, vy2 + 10 * k * c0.z, bx, vy2 + 2 * k * c0.z, bx - bw2 / 2, vy2 + 10 * k * c0.z], 3);
      const fade = 1 - c0.z;
      L.paint(m, (x, y, v) => {
        const n = (x - c0.x) / (cw / 2);
        let c;
        if (v === 3) {
          c = rc(R_BLOOD, 0.22 + Math.sin((x - bx) / (cw * 0.3)) * 0.06 - fade * 0.1);
          if (Math.abs(x - bx) < cw * 0.18 && Math.abs(y - (vy2 - 70 * k * c0.z)) < cw * 0.25) c = rc(R_EMBER, 0.45 - fade * 0.2); // 金糸の紋
        } else c = rc(R_NIGHT, 0.1 + (v === 2 ? 0.06 : 0) + (-n * c0.sd) * 0.05);
        // 内側 (燭台の側) の照り返し
        if (m.rim(x, y, -c0.sd, 0, 1) === 1) c = mix(c, rc(R_EMBER, 0.35), 0.5 * c0.z);
        return mix(c, rc(R_NIGHT, 0.04), fade * 0.55);
      });
    }
  }
  midP.bake(10);
  // --- 近景: 封蝋の勅書と蝋燭
  const seal = {};
  const nc = {};
  {
    const L = near.L, w = near.w, h = near.h;
    const ty = h * (wide ? 0.82 : 0.8);
    nc.x = w * (wide ? 0.78 : 0.82); nc.y = ty - 26 * k;
    const lamps = [{ x: nc.x, y: nc.y - 4 * k, r: 130 * k, sq: 1, ramp: R_EMBER, k: 1.2 }];
    const m = new Mask(w, h);
    m.rect(0, ty, w, h - ty, 1); // 机
    const px0 = w * (wide ? 0.32 : 0.12), px1 = w * (wide ? 0.66 : 0.7);
    m.poly([px0, ty + 2 * k, px1, ty - 1 * k, px1 + 6 * k, ty + 16 * k, px0 + 4 * k, ty + 20 * k], 2); // 羊皮紙
    m.ellipse(px0 + 2 * k, ty + 11 * k, 4 * k, 10 * k, 3); m.ellipse(px1 + 3 * k, ty + 8 * k, 4 * k, 10 * k, 3); // 巻き
    seal.x = (px0 + px1) / 2 + 10 * k; seal.y = ty + 12 * k;
    m.ellipse(seal.x, seal.y, 7 * k, 5.5 * k, 4);
    m.line(seal.x - 3 * k, seal.y + 4 * k, seal.x - 7 * k, seal.y + 15 * k, Math.max(1, 2.5 * k), 5); // 封の紐
    m.line(seal.x + 2 * k, seal.y + 4 * k, seal.x + 4 * k, seal.y + 16 * k, Math.max(1, 2.5 * k), 5);
    m.rect(nc.x - 3 * k, nc.y, 6 * k, ty - nc.y, 6); // 蝋燭
    m.rect(nc.x - 7 * k, ty - 3 * k, 14 * k, 3 * k, 7);
    L.paint(m, (x, y, v) => {
      let c;
      if (v === 1) c = rc(R_WOOD, 0.1 + vnoise(x * 0.2, y * 0.8, 141) * 0.05 + (y - ty < 1.5 ? 0.08 : 0));
      else if (v === 2) {
        c = rc(R_BONE, 0.25 + vnoise(x * 0.3, y * 0.3, 142) * 0.15);
        // 文字の行 (読めない筆致)
        const line = (y - ty) % Math.round(4 * k);
        if (line < 1 && h2(Math.floor(x / (3 * k)), Math.floor((y - ty) / 4), 143) < 0.7 && x > px0 + 6 * k && x < px1 - 6 * k) c = rc(R_WOOD, 0.15);
      } else if (v === 3) c = rc(R_BONE, 0.15);
      else if (v === 4) { const d = Math.hypot((x - seal.x) / (7 * k), (y - seal.y) / (5.5 * k)); c = rc(R_BLOOD, 0.5 - d * 0.2 + (d < 0.5 && Math.abs(x - seal.x) < 1.5 * k ? 0.15 : 0)); }
      else if (v === 5) c = rc(R_BLOOD, 0.3);
      else if (v === 6) c = rc(R_BONE, 0.6);
      else c = rc(R_STEEL, 0.3);
      return applyLights(c, x, y, lamps, 0.8);
    });
  }
  near.bake(10);
  const flame = glowSprite(Math.round(30 * k), R_EMBER.slice(0, 8), { pow: 2.4, levels: 6, core: 0.7 });
  const kEye = glowSprite(Math.max(2, Math.round(3 * k)), R_BLOOD.slice(4), { pow: 1.2, levels: 3 });
  back.post = (g, t, o, prog) => {
    // 王の眼がわずかに光る (勅命の行で)
    const on = smooth(0.5, 0.9, prog) * (0.7 + 0.3 * Math.sin(t * 0.002));
    if (on > 0.05) for (const [ex, ey] of king.eyes) { lit(g, kEye, ex + o.x, ey + o.y, on); g.globalAlpha = on; g.fillStyle = "#eea064"; g.fillRect(Math.round(ex + o.x), Math.round(ey + o.y), 1, 1); g.globalAlpha = 1; }
  };
  near.post = (g, t, o) => {
    const f = flick(t, 4);
    lit(g, flame, nc.x + o.x, nc.y + o.y - 3 * k, f * 0.6);
    g.fillStyle = "#fff3c4"; g.fillRect(Math.round(nc.x + o.x), Math.round(nc.y + o.y - 3 * k - (f > 0.8 ? 1 : 0)), Math.max(1, Math.round(k)), Math.max(2, Math.round(3 * k)));
    // 煤と灰
    for (let i = 0; i < 10; i++) {
      const u = ((t * 0.0002 * (1 + h1(i, 151)) + h1(i, 152)) % 1);
      g.globalAlpha = (1 - u) * 0.5; g.fillStyle = "#62566d";
      g.fillRect(Math.round(nc.x + o.x + Math.sin(t * 0.002 + i) * 6 * k * u), Math.round(nc.y + o.y - 6 * k - u * 60 * k), 1, 1);
    }
    g.globalAlpha = 1;
  };
  return new Shot(W, H, [back, midP, near], null);
}

// =====================================================================
// 幕 5「辺境の街ロアダル」— 血の月の昇る丘の上の街。絞首台の脇の道を、魂繰りがひとり往く。
function scene5(W, H) {
  const k = Math.min(W / 260, H / 300);
  const wide = W / H > 1.4;
  const mx = 30 * k, my = 4 * k;
  const sky = new Plane(W, H, mx, my, 0.08), far = new Plane(W, H, mx, my, 0.3), midP = new Plane(W, H, mx, my, 0.62), near = new Plane(W, H, mx, my, 1);
  const hz = Math.round(sky.h * 0.58);
  const moon = { x: sky.w * 0.5, y: hz - 30 * k, r: Math.round(38 * k), blood: 0.75, halo: R_BLOOD, lit: R_BLOOD, ramp: R_BONE };
  paintSky(sky.L, sky.w, sky.h, { t1: 0.45, warm: R_BLOOD, warmK: 0.6, moon, seed: 51, k, horizon: hz });
  sky.bake(18);
  const windows = [];
  // --- 遠景: 丘の上の街 (城壁・塔・屋根・鐘楼)
  {
    const L = far.L, w = far.w, h = far.h;
    const hill = (x) => far.h * 0.6 - 26 * k * Math.exp(-(((x - w * 0.52) / (w * 0.28)) ** 2)) - 4 * k * fbm(x * 0.03, 0, 161, 3);
    const m = new Mask(w, h);
    for (let x = 0; x < w; x++) for (let y = Math.round(hill(x)); y < h; y++) m._span(y, x, x, 1);
    const R = rng(163);
    const cx = w * 0.52;
    // 城壁
    const wallY = (x) => hill(x) - 10 * k;
    for (let x = Math.round(cx - 70 * k); x < cx + 70 * k; x++) { const y0 = Math.round(wallY(x)); for (let y = y0; y < hill(x) + 2; y++) m._span(y, x, x, 2); if (Math.floor(x / (3 * k)) % 2) m._span(y0 - 2, x, x, 2), m._span(y0 - 1, x, x, 2); }
    // 家並み (尖った屋根)
    for (let i = 0; i < 16; i++) {
      const x = cx + (R() - 0.5) * 130 * k, hh = (8 + R() * 10) * k, ww = (6 + R() * 8) * k;
      const base = wallY(x) + 2;
      m.rect(x - ww / 2, base - hh, ww, hh, 3);
      m.poly([x - ww / 2 - 1, base - hh, x + ww / 2 + 1, base - hh, x, base - hh - ww * 0.8], 3);
      if (R() < 0.7) windows.push({ x: Math.round(x + (R() - 0.5) * ww * 0.5), y: Math.round(base - hh * (0.3 + R() * 0.4)), p: R() });
    }
    // 塔と鐘楼
    const tower = (x, hh, ww) => { const base = wallY(x) + 2; m.rect(x - ww / 2, base - hh, ww, hh, 4); m.poly([x - ww / 2 - 1.5 * k, base - hh, x + ww / 2 + 1.5 * k, base - hh, x, base - hh - ww * 2], 4); windows.push({ x: Math.round(x), y: Math.round(base - hh * 0.75), p: R(), bell: true }); };
    tower(cx - 62 * k, 26 * k, 9 * k); tower(cx + 64 * k, 22 * k, 8 * k); tower(cx + 8 * k, 46 * k, 10 * k);
    L.paint(m, (x, y, v) => {
      let c = rc(R_NIGHT, v === 1 ? 0.12 : 0.08);
      if (v === 1 && vnoise(x * 0.1, y * 0.3, 164) > 0.6) c = rc(R_NIGHT, 0.09);
      // 月 (正面、地平の低い位置) からの逆光: 縁が血の色
      if (m.rim(x, y, Math.sign(moon.x - far.ox + sky.ox - x) * 0.4, -1, 1) === 1) c = mix(c, rc(R_BLOOD, 0.5), 0.7);
      return c;
    });
  }
  far.bake(10);
  // --- 中景: 枯れ野と道、絞首台
  const crowsAt = [];
  {
    const L = midP.L, w = midP.w, h = midP.h;
    const gy = h * 0.62;
    const road = (y) => w * 0.5 + (y - gy) * 0.3 + Math.sin((y - gy) * 0.05) * 8 * k;
    const roadW = (y) => 3 * k + (y - gy) * 0.55;
    L.shade(0, gy, w - 1, h - 1, (x, y) => {
      const z = (y - gy) / (h - gy);
      let c = rc(R_NIGHT, 0.1 - z * 0.04 + fbm(x * 0.05, y * 0.2, 171, 3) * 0.06);
      if (Math.abs(x - road(y)) < roadW(y)) c = rc(R_NIGHT, 0.16 - z * 0.05 + vnoise(x * 0.3, y * 0.6, 172) * 0.05);
      c = mix(c, rc(R_BLOOD, 0.3), (1 - z) * 0.35);
      return c;
    });
    // 枯れ草
    const R = rng(173);
    for (let i = 0; i < w * 1.2; i++) {
      const x = R() * w, y = gy + Math.pow(R(), 0.7) * (h - gy);
      if (Math.abs(x - road(y)) < roadW(y) + 2) continue;
      const z = (y - gy) / (h - gy), hh = (1 + R() * 4) * k * (0.4 + z);
      for (let q = 0; q < hh; q++) L.px(x + (q > hh * 0.6 ? 1 : 0), y - q, q > hh - 1.5 ? rc(R_BLOOD, 0.35) : rc(R_NIGHT, 0.06));
    }
    // 絞首台 (道の脇)
    const m = new Mask(w, h);
    // 道の右手 (魂繰りと重ならない側) に立ち、腕木を道へ差し出す
    const gby = gy + 26 * k, gx2 = road(gby) + (wide ? 118 : 74) * k;
    m.rect(gx2 - 2 * k, gby - 62 * k, 4 * k, 62 * k);
    m.rect(gx2 - 32 * k, gby - 62 * k, 34 * k, 3.5 * k);
    m.line(gx2 - 2 * k, gby - 46 * k, gx2 - 16 * k, gby - 60 * k, Math.max(1, 2.5 * k));
    gibbet(m, Math.round(gx2 - 26 * k), Math.round(gby - 59 * k), Math.round(10 * k), k * 0.85);
    crowsAt.push({ x: gx2 - 12 * k, y: gby - 63 * k }, { x: gx2 + 1, y: gby - 63 * k });
    // 道標の杭
    for (let i = 0; i < 5; i++) { const yy = gy + (6 + i * i * 6) * k; const xx = road(yy) + roadW(yy) + 6 * k + i * 2 * k; m.rect(xx, yy - (5 + i * 3) * k, Math.max(1, (1 + i * 0.6) * k), (5 + i * 3) * k); }
    L.paint(m, (x, y) => (m.rim(x, y, 0.3, -1, 1) === 1 || m.rim(x, y, 1, 0, 1) === 1 ? mix(rc(R_NIGHT, 0.05), rc(R_BLOOD, 0.5), 0.6) : rc(R_NIGHT, 0.04)));
  }
  midP.bake(10);
  // --- 近景: 道を往く魂繰り (背中)
  const fig = {};
  {
    const L = near.L, w = near.w, h = near.h;
    fig.h = Math.min(h * 0.5, 150 * k); fig.x = w * (wide ? 0.42 : 0.44); fig.feet = h * 0.93;
    const m = new Mask(w, h);
    const r = cloakedBack(m, fig.x, fig.feet, fig.h, { wind: 1.3, seed: 9 });
    fig.lamp = r.lantern;
    const lightPt = { x: w * 0.5, y: h * 0.3, k: 1 };
    shadeCloaked(L, m, fig.x, fig.feet, fig.h, { light: lightPt, lamp: r.lantern, rimRamp: R_BLOOD, rimK: 1.1, moonRim: 0 });
    // 足もとの枯れ草と轍
    const gm = new Mask(w, h);
    for (let x = 0; x < w; x++) {
      const e = Math.abs(x / w - 0.5) * 2;
      const hh = (2 + e * 18) * k + 4 * k * fbm(x * 0.08, 0, 181, 2);
      for (let y = Math.round(h - hh); y < h; y++) gm._span(y, x, x, 1);
      if (h1(x, 182) < 0.4) gm.line(x, h - hh, x + (h1(x, 183) - 0.5) * 6, h - hh - (4 + h1(x, 184) * 12) * k, 1);
    }
    L.paint(gm, (x, y) => (gm.rim(x, y, 0, -1, 1) === 1 ? rc(R_BLOOD, 0.3) : rc(R_NIGHT, 0.03)));
  }
  near.bake(8);
  const lampG = glowSprite(Math.round(22 * k), R_EMBER.slice(0, 8), { pow: 2.4, levels: 6, core: 0.7 });
  far.post = (g, t, o) => {
    for (const wd of windows) {
      const on = 0.6 + 0.4 * Math.sin(t * 0.001 + wd.p * 20);
      g.globalAlpha = on; g.fillStyle = wd.bell ? "#e2892c" : "#c4641c";
      g.fillRect(wd.x + o.x, wd.y + o.y, 1, wd.bell ? 2 : 1);
    }
    g.globalAlpha = 1;
  };
  midP.post = (g, t, o) => {
    crowsAt.forEach((c, i) => drawCrow(g, c.x + o.x, c.y + o.y, Math.max(1, Math.round(k)), (Math.floor(t / 1700 + i) % 4 === 0) ? -2 : -1, "#050307"));
    // 遠くを渡る鴉
    for (let i = 0; i < 3; i++) {
      const u = ((t * 0.00005 + i * 0.3) % 1);
      drawCrow(g, -20 + u * (W + 40) + o.x * 0.5, H * (0.25 + i * 0.05) + Math.sin(t * 0.002 + i) * 3, 1, Math.floor(t / 120 + i) % 3, "#0a0811");
    }
  };
  near.post = (g, t, o) => {
    const f = flick(t, 7);
    lit(g, lampG, fig.lamp.x + o.x, fig.lamp.y + o.y, f * 0.6);
    g.fillStyle = "#fff3c4"; g.fillRect(Math.round(fig.lamp.x + o.x), Math.round(fig.lamp.y + o.y), 1, 1);
  };
  return new Shot(W, H, [sky, far, midP, near], null);
}

// =====================================================================
// 幕 6「骸の眠る場所」— 地下墓地の大階段。両の壁は頭蓋で埋め尽くされ、底で魂火が待つ。
// 手前の魂繰りが、ランタンを掲げて一段目に足をかける。
function scene6(W, H) {
  const k = Math.min(W / 260, H / 300);
  const wide = W / H > 1.4;
  const mx = 6 * k, my = 22 * k;
  const tun = new Plane(W, H, mx, my, 0.45), near = new Plane(W, H, mx, my, 1);
  // 坑道は「光線を飛ばす」ように画素ごとに奥行きを求めて描く (頭蓋の龕が遠近どおりに並ぶ)
  const vx = tun.w * (wide ? 0.56 : 0.55), vy = tun.h * 0.5;
  const lampW = { x: tun.w * (wide ? 0.33 : 0.3), y: tun.h * 0.74 };
  {
    const L = tun.L, w = tun.w, h = tun.h;
    const C = (wide ? 70 : 60) * k;          // 壁までの半幅 (画面上で z=1 のとき)
    const FL = C * 1.15, CE = C * 1.5;        // 床 / 天井の高さ
    L.shade(0, 0, w - 1, h - 1, (x, y) => {
      const dx = x + 0.5 - vx, dy = y + 0.5 - vy;
      const zW = C / Math.max(0.01, Math.abs(dx));            // 壁に当たる奥行き
      const zF = dy > 0 ? FL / dy : 1e9;                       // 床
      // 天井: 尖頭アーチ (左右から寄る)
      const zC = dy < 0 ? CE / (-dy + Math.abs(dx) * 0.55) : 1e9;
      const z = Math.min(zW, zF, zC);
      const fogK = clamp((z - 1) / 9);                          // 奥ほど闇 (底は魂火)
      let c;
      if (z === zW) {
        // 壁: 龕の格子 (奥行き方向 u, 高さ方向 v)
        const u = z * 2.4, v = dy * z / C;                      // v: -1.5(天井) .. 1.15(床)
        const cu = u % 1, cv = ((v + 3) * 3.0) % 1;
        const inN = cu > 0.12 && cu < 0.88 && cv > 0.14 && cv < 0.86 && v < 1.0 && v > -1.2;
        c = rc(R_NIGHT, 0.14 + vnoise(u * 3, v * 3, 191) * 0.06);
        if (inN) {
          // 龕の中の頭蓋 (遠近に沿って描かれる)
          const sx = (cu - 0.5) / 0.3, sy = (cv - 0.5) / 0.32;
          const skull = sx * sx + (sy + 0.1) * (sy + 0.1) < 0.7 || (Math.abs(sx) < 0.45 && sy > 0.25 && sy < 0.75);
          const eye = Math.hypot(Math.abs(sx) - 0.34, sy + 0.05) < 0.22;
          const nose = Math.abs(sx) < 0.08 && sy > 0.2 && sy < 0.38;
          const teeth = Math.abs(sx) < 0.4 && sy > 0.5 && sy < 0.75 && Math.floor((sx + 1) * 6) % 2 === 0;
          c = rc(R_NIGHT, 0.03);
          if (skull && !eye && !nose && !teeth) {
            const sh2 = clamp(0.5 - sx * 0.45 * Math.sign(dx) - sy * 0.25);
            c = rc(R_BONE, 0.02 + sh2 * 0.2 + h2(Math.floor(u), Math.floor(v * 3), 192) * 0.06);
          }
        }
        // 手前すぎる壁は闇に (巨大な頭蓋が並ばないように)
        c = mix(c, rc(R_NIGHT, 0.04), smooth(1.3, 0.6, z));
      } else if (z === zF) {
        // 床 = 下り階段 (踏み面と蹴上げ)
        const u = z * 2.2;
        const nose = (u % 1) < 0.16;
        c = rc(R_NIGHT, nose ? 0.22 : 0.09 + vnoise(x * 0.2, u * 4, 193) * 0.04);
        if (Math.abs(dx) / (C / z) > 0.92) c = rc(R_NIGHT, 0.05);
      } else {
        // 天井の肋材
        const u = z * 1.4;
        c = rc(R_NIGHT, (u % 1) < 0.12 ? 0.16 : 0.07);
      }
      // ランタン (手前・左下) の暖かい光: 近いほど強い
      const lampF = clamp(1.1 - z * 0.38) * Math.pow(clamp(1 - Math.hypot(x - lampW.x, (y - lampW.y) * 0.8) / (w * 0.7)), 1.6);
      c = mix(c, mix(c, rc(R_EMBER, 0.45), 0.55), lampF);
      // 奥: 闇、そして底の魂火
      c = mix(c, rc(R_NIGHT, 0.01), fogK * 0.85);
      const core = Math.exp(-Math.hypot(dx / (C * 0.18), dy / (C * 0.3)) * 1.4);
      c = mix(c, rc(R_SOUL, 0.2 + 0.7 * core), clamp(core * 1.2) * fogK);
      return c;
    });
  }
  tun.bake(12);
  // --- 近景: 背を向けた魂繰りと、手前のアーチの縁
  const fig = {};
  {
    const L = near.L, w = near.w, h = near.h;
    fig.h = Math.min(h * 0.62, 190 * k); fig.x = w * (wide ? 0.3 : 0.27); fig.feet = h + fig.h * 0.06;
    const m = new Mask(w, h);
    const r = cloakedBack(m, fig.x, fig.feet, fig.h, { wind: 0.4, seed: 5 });
    fig.lamp = r.lantern;
    const vxn = vx - tun.ox + near.ox, vyn = vy - tun.oy + near.oy;
    shadeCloaked(L, m, fig.x, fig.feet, fig.h, { light: { x: vxn, y: vyn, k: 0.9 }, lamp: r.lantern, rimK: 1.1, moonRim: 0 });
    // 手前のアーチ (額縁): 左右の柱と頂部
    const am = new Mask(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const inside = inArch(x + 0.5, y + 0.5, vxn, h * 0.45, w * (wide ? 0.42 : 0.46), 1.6);
      if (!inside) am.m[y * w + x] = 1;
    }
    am.x0 = 0; am.y0 = 0; am.x1 = w - 1; am.y1 = h - 1;
    L.paint(am, (x, y) => {
      let c = rc(R_NIGHT, 0.04 + vnoise(x * 0.2, y * 0.2, 195) * 0.03);
      if (am.rim(x, y, Math.sign(vxn - x), 0.3, 2) <= 2) c = mix(c, rc(R_EMBER, 0.3), 0.45 * clamp(1 - Math.hypot(x - fig.lamp.x, y - fig.lamp.y) / (w * 0.7)));
      return c;
    });
  }
  near.bake(8);
  const lampG = glowSprite(Math.round(36 * k), R_EMBER.slice(0, 8), { pow: 2.4, levels: 6, core: 0.75 });
  const deepG = glowSprite(Math.round(30 * k), R_SOUL.slice(2), { pow: 1.6, levels: 6, core: 0.9 });
  tun.post = (g, t, o) => {
    lit(g, deepG, vx + o.x, vy + o.y, 0.4 + 0.15 * Math.sin(t * 0.0018));
    // 底から昇ってくる魂
    for (let i = 0; i < 26; i++) {
      const u = ((t * 0.00007 * (1 + h1(i, 197)) + h1(i, 198)) % 1);
      const a = (h1(i, 199) - 0.5) * 2;
      mote(g, vx + o.x + a * u * 90 * k, vy + o.y + (h1(i, 200) - 0.6) * u * 80 * k, Math.sin(u * Math.PI) * 0.8, "#bdeec6", "#275f50");
    }
  };
  near.post = (g, t, o) => {
    const f = flick(t, 9);
    lit(g, lampG, fig.lamp.x + o.x, fig.lamp.y + o.y, f * 0.6);
    g.fillStyle = "#fff3c4"; g.fillRect(Math.round(fig.lamp.x + o.x), Math.round(fig.lamp.y + o.y), 1, 2);
  };
  return new Shot(W, H, [tun, near], null);
}

export const SCENES = [
  {
    cap: "壱", title: "裂けた大地",
    lines: [
      "ある夜、王国の大地が裂けた。",
      "地の底に口を開けたのは、百の迷宮。",
      "死者の魂を喰らい、夜ごと肥え太る——底なしの病巣である。",
    ],
    pan: { x: [-0.6, 0.4], y: [-1, 1] },
    build: scene1,
  },
  {
    cap: "弐", title: "還らぬ者",
    lines: [
      "幾千の生者が剣を取り、灯を掲げ、闇へと降りた。",
      "還った者は、ひとりもいない。",
      "深淵は鎧も祈りも素通りし——生きた魂から、順に喰らう。",
    ],
    pan: { x: [-1, 0.8], y: [0, 0.4] },
    build: scene2,
  },
  {
    cap: "参", title: "人業",
    lines: [
      "ゆえに人は、麻布と真鍮と祈りで、空の器をこしらえた——人業（ドール）。",
      "その胸に死者の魂を封じたとき、器は静かに目を開ける。",
      "人業は道具ではない。死者に与えられた、二度目の生だ。",
    ],
    pan: { x: [0.9, -0.7], y: [-0.4, 0.3] },
    build: scene3,
  },
  {
    cap: "肆", title: "王の勅命",
    lines: [
      "魂を繰り、人業を率いて深淵へ送る者。",
      "人はその業を畏れ、〈魂繰り〉と呼んだ。",
      "いま、老いた王の勅命が、ひとりの魂繰りを辺境へと召す。",
      "——すなわち、あなたを。",
    ],
    pan: { x: [0, 0], y: [1, -0.9] },
    build: scene4,
  },
  {
    cap: "伍", title: "辺境の街ロアダル",
    lines: [
      "王国の果て、辺境の街ロアダル。",
      "弔いの鐘は鳴りやまず、墓所の下では、骸が眠りを忘れている。",
    ],
    pan: { x: [-0.9, 0.9], y: [0, 0] },
    build: scene5,
  },
  {
    cap: "陸", title: "骸の眠る場所",
    lines: [
      "死者を眠りへ還し、喰われた魂をすくい上げよ。",
      "百の迷宮の底に、何が待つとしても。",
    ],
    pan: { x: [0.3, -0.2], y: [-1, 0.8] },
    build: scene6,
    last: true,
  },
];
