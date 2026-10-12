// 迷宮ごとの描き下ろし素材。各迷宮に蓋・壁材と床のWebP。
// 素材がまだ無い・読めない間は呼び出し側が従来の絵を使う。
import { makeRng, paintFloorHazards } from "./crypt.js";

export const CRYPT_PAINT_SCALE = 3;
const PAINTINGS = { w01: "crypt", w02: "w02", w03: "w03", w04: "w04", w05: "w05", w06: "w06", w07: "w07", w08: "w08", w09: "w09", w10: "w10", w11: "w11", w22: "w22", w23: "w23", w24: "w24", w25: "w25", w26: "w26" };
const paintings = new Map();
export function cryptPainting(id = "w01") {
  if (!Object.hasOwn(PAINTINGS, id)) return null;
  if (!paintings.has(id)) {
    // 下段の床を拾わないよう、原画ごとの蓋の実際の境界を使う。
    const state = { textures: { slabHeight: ({ w05: 496, w07: 504, w09: 496 })[id] || 512, wallStyle: id === "w10" ? "root" : id === "w11" ? "moss" : "stone" }, loaded: 0 };
    paintings.set(id, state);
    for (const [key, suffix] of [["atlas", "materials"], ["floor", "floor"]]) {
      const image = new Image();
      state.textures[key] = image; image.decoding = "async";
      image.onload = () => { if (image.naturalWidth === 1536 && image.naturalHeight === 1024) state.loaded++; };
      image.onerror = () => { /* 旧描画を維持し、次回の起動時に再取得する。 */ };
      image.src = new URL(`../art/dungeon/${PAINTINGS[id]}-${suffix}.webp`, import.meta.url).href;
    }
  }
  const state = paintings.get(id);
  return state.loaded === 2 ? state.textures : null;
}

function surface(w, h) {
  const canvas = document.createElement("canvas");
  canvas.width = w * CRYPT_PAINT_SCALE; canvas.height = h * CRYPT_PAINT_SCALE;
  const ctx = canvas.getContext("2d");
  ctx.scale(CRYPT_PAINT_SCALE, CRYPT_PAINT_SCALE);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
  return { canvas, ctx };
}
function tile(ctx, image, col, row, x, y, w, h, sourceHeight = 512) {
  // パネルの境界にある隣の絵を補間で拾わないよう2px内側から読む。
  ctx.drawImage(image, col * 512 + 2, row * 512 + 2, 508, sourceHeight - 4, x, y, w, h);
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
  paintFloorHazards(g, opt);
  for (let cy = 0; cy < opt.rows; cy++) for (let cx = 0; cx < opt.cols; cx++) {
    const r = opt.rect(cx, cy), variant = Math.floor(rnd() * 3), shade = rnd() * 0.1;
    tile(s, image, variant, 0, r.x, r.y, r.w, r.h, textures.slabHeight);
    s.fillStyle = `rgba(15,18,23,${shade})`; s.fillRect(r.x, r.y, r.w, r.h);
    // 特別階の色は薄く重ね、彫刻やひびの読みやすさを保つ。
    if (opt.accent || opt.elite) {
      const color = opt.accent || [120, 14, 10];
      s.fillStyle = `rgba(${color.join(",")},0.1)`; s.fillRect(r.x, r.y, r.w, r.h);
    }
    if (rnd() < 0.28 && opt.mat.props !== false) {
      const x = r.x + 5 + rnd() * Math.max(1, r.w - 14), y = r.y + r.h - 5;
      paintWax(g, x, y);
      candles.push({ x, y: y - 3.5, cx, cy });
    }
  }
  return { floor: floor.canvas, slabs: slabs.canvas, candles, scale: CRYPT_PAINT_SCALE, painting: image, wallStyle: textures.wallStyle };
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
export function paintCryptMasonry(g, walls, posts, image, seed, style = "stone") {
  g.save(); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
  const organic = style === "root" || style === "moss";
  const tint = style === "root" ? "rgba(198,168,117,0.22)" : style === "moss" ? "rgba(168,190,155,0.22)" : "rgba(177,197,211,0.48)";
  const edge = style === "root" ? "rgba(235,207,158,0.75)" : style === "moss" ? "rgba(209,228,198,0.75)" : "rgba(221,239,250,0.85)";
  const block = (x, y, w, h, n) => {
    g.fillStyle = "rgba(0,0,0,0.72)"; g.fillRect(x - 1, y + 1.8, w + 2, h + 1.4);
    const sx = 1026 + n % 280, sy = 514 + (n * 7) % 280;
    g.drawImage(image, sx, sy, 160, 160, x, y, w, h);
    // 床の暖かい暗色から、壁の冷たい明色と黒い側面を分離する。
    g.fillStyle = tint; g.fillRect(x, y, w, h);
    const light = g.createLinearGradient(x, y, x + w * 0.2, y + h);
    light.addColorStop(0, "rgba(226,239,246,0.42)"); light.addColorStop(0.4, "rgba(80,104,124,0.08)"); light.addColorStop(1, "rgba(4,9,17,0.72)");
    g.fillStyle = light; g.fillRect(x, y, w, h);
    g.lineWidth = 0.7; g.strokeStyle = edge;
    g.beginPath(); g.moveTo(x + 0.3, y + h - 0.3); g.lineTo(x + 0.3, y + 0.3); g.lineTo(x + w - 0.3, y + 0.3); g.stroke();
  };
  for (const wall of walls) {
    const rnd = makeRng(seed ^ Math.imul(wall.x + 7, 92837111) ^ Math.imul(wall.y + 3, 689287499));
    const length = wall.horiz ? wall.w : wall.h;
    g.fillStyle = "#1d1c1b"; g.fillRect(wall.x - 0.8, wall.y - 0.8, wall.w + 1.6, wall.h + 1.6);
    // 根の壁は切石の目地を入れず、連続した樹皮の原画を使う。
    if (organic) { block(wall.x, wall.y, wall.w, wall.h, Math.floor(rnd() * 1000)); continue; }
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
