// 地下墓地の描き下ろし石材。原画は docs/art/crypt、出荷物は二枚のWebP。
// 素材がまだ無い・読めない間は呼び出し側が従来の絵を使う。
import { makeRng } from "./crypt.js";

export const CRYPT_PAINT_SCALE = 3;
let textures = null, requested = false, loaded = 0;
export function cryptPainting() {
  if (!requested) {
    requested = true;
    textures = {};
    for (const [key, file] of [["atlas", "crypt-materials.webp"], ["floor", "crypt-floor.webp"]]) {
      const image = new Image();
      textures[key] = image; image.decoding = "async";
      image.onload = () => { if (image.naturalWidth === 1536 && image.naturalHeight === 1024) loaded++; };
      image.onerror = () => { /* 旧描画を維持し、次回の起動時に再取得する。 */ };
      image.src = new URL(`../art/dungeon/${file}`, import.meta.url).href;
    }
  }
  return loaded === 2 ? textures : null;
}

function surface(w, h) {
  const canvas = document.createElement("canvas");
  canvas.width = w * CRYPT_PAINT_SCALE; canvas.height = h * CRYPT_PAINT_SCALE;
  const ctx = canvas.getContext("2d");
  ctx.scale(CRYPT_PAINT_SCALE, CRYPT_PAINT_SCALE);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
  return { canvas, ctx };
}
function tile(ctx, image, col, row, x, y, w, h) {
  // パネルの境界にある隣の絵を補間で拾わないよう2px内側から読む。
  ctx.drawImage(image, col * 512 + 2, row * 512 + 2, 508, 508, x, y, w, h);
}

export function paintCryptMaterials(w, h, opt, textures) {
  const image = textures.atlas;
  const floor = surface(w, h), slabs = surface(w, h);
  const g = floor.ctx, s = slabs.ctx, rnd = makeRng(opt.seed ^ 0x53a61);
  const candles = [];
  // 床は一枚の原画から切り出す。反転やタイルの継ぎ目による対称模様を作らない。
  const ratio = w / h, sw = Math.min(1536, 1024 * ratio), sh = sw / ratio;
  const sx = (1536 - sw) * rnd(), sy = (1024 - sh) * rnd();
  g.drawImage(textures.floor, sx, sy, sw, sh, 0, 0, w, h);
  // 墓石と床を明度で分け、未踏の蓋と通路を小画面でも読み取れるようにする。
  g.fillStyle = "rgba(18,17,20,0.24)"; g.fillRect(0, 0, w, h);
  for (let cy = 0; cy < opt.rows; cy++) for (let cx = 0; cx < opt.cols; cx++) {
    const r = opt.rect(cx, cy), variant = Math.floor(rnd() * 3), shade = rnd() * 0.1;
    tile(s, image, variant, 0, r.x, r.y, r.w, r.h);
    s.fillStyle = `rgba(15,18,23,${shade})`; s.fillRect(r.x, r.y, r.w, r.h);
    // 特別階の色は薄く重ね、彫刻やひびの読みやすさを保つ。
    if (opt.accent || opt.elite) {
      const color = opt.accent || [120, 14, 10];
      s.fillStyle = `rgba(${color.join(",")},0.1)`; s.fillRect(r.x, r.y, r.w, r.h);
    }
    if (rnd() < 0.28) {
      const x = r.x + 5 + rnd() * Math.max(1, r.w - 14), y = r.y + r.h - 5;
      paintWax(g, x, y);
      candles.push({ x, y: y - 3.5, cx, cy });
    }
  }
  return { floor: floor.canvas, slabs: slabs.canvas, candles, scale: CRYPT_PAINT_SCALE, painting: image };
}

function paintWax(g, x, y) {
  g.save();
  g.fillStyle = "rgba(0,0,0,0.45)"; g.beginPath(); g.ellipse(x + 1, y + 1, 4, 1.7, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#534c40"; g.beginPath(); g.ellipse(x, y, 3.6, 1.4, 0, 0, Math.PI * 2); g.fill();
  const wax = g.createLinearGradient(x - 1, y, x + 1.4, y);
  wax.addColorStop(0, "#a79d81"); wax.addColorStop(0.4, "#e4d7ac"); wax.addColorStop(1, "#867755");
  g.fillStyle = wax; g.fillRect(x - 1, y - 3.5, 2, 3.5);
  g.fillStyle = "#e6d8b1"; g.beginPath(); g.ellipse(x, y - 3.5, 1, 0.4, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "#30251a"; g.lineWidth = 0.35; g.beginPath(); g.moveTo(x, y - 3.5); g.lineTo(x, y - 4.3); g.stroke();
  g.restore();
}

// 通行判定と同じ壁の座標を受け取り、原画の切石・細い面取り・落ち影で描く。
export function paintCryptMasonry(g, walls, posts, image, seed) {
  g.save(); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
  const block = (x, y, w, h, n) => {
    g.fillStyle = "rgba(0,0,0,0.45)"; g.fillRect(x + 0.7, y + 1.3, w, h);
    const sx = 1026 + n % 280, sy = 514 + (n * 7) % 280;
    g.drawImage(image, sx, sy, 160, 160, x, y, w, h);
    const light = g.createLinearGradient(x, y, x + w * 0.2, y + h);
    light.addColorStop(0, "rgba(228,215,183,0.18)"); light.addColorStop(0.4, "rgba(10,12,16,0.12)"); light.addColorStop(1, "rgba(4,6,10,0.55)");
    g.fillStyle = light; g.fillRect(x, y, w, h);
    g.lineWidth = 0.45; g.strokeStyle = "rgba(224,214,189,0.48)";
    g.beginPath(); g.moveTo(x + 0.3, y + h - 0.3); g.lineTo(x + 0.3, y + 0.3); g.lineTo(x + w - 0.3, y + 0.3); g.stroke();
  };
  for (const wall of walls) {
    const rnd = makeRng(seed ^ Math.imul(wall.x + 7, 92837111) ^ Math.imul(wall.y + 3, 689287499));
    const length = wall.horiz ? wall.w : wall.h;
    g.fillStyle = "#1d1c1b"; g.fillRect(wall.x - 0.3, wall.y - 0.3, wall.w + 0.6, wall.h + 0.6);
    for (let pos = 0; pos < length;) {
      const size = Math.min(length - pos, 9 + rnd() * 8), n = Math.floor(rnd() * 1000);
      if (wall.horiz) block(wall.x + pos, wall.y, Math.max(0.2, size - 0.5), wall.h, n);
      else block(wall.x, wall.y + pos, wall.w, Math.max(0.2, size - 0.5), n);
      pos += size;
    }
  }
  for (const p of posts) block(p.x - 3.8, p.y - 3.8, 7.6, 7.6, Math.abs(Math.floor(p.x * 7 + p.y * 11)));
  g.restore();
}
