// 全迷宮で共用する人物と小物。透過原画を保持し、ゲーム側の状態に応じて差分を選ぶ。
import { normalizeLook, WALKER_CLOAKS, WALKER_TRIMS } from "./walkerart.js";

const sheets = new Map();
const assets = { a: ["props-a", 1536, 1024], b: ["props-b", 1536, 1024], c: ["props-c", 1536, 1024], d: ["props-d", 1536, 1024], seated: ["corpses-seated", 1536, 1024], walker: ["walker", 1254, 1254] };
function sheet(key) {
  if (!sheets.has(key)) {
    const [name, w, h] = assets[key], image = new Image(), state = { image, ready: false };
    state.done = new Promise(resolve => { state.finish = resolve; });
    sheets.set(key, state); image.decoding = "async";
    image.onload = () => { state.ready = image.naturalWidth === w && image.naturalHeight === h; state.finish(state.ready); };
    image.onerror = () => { state.finish(false); }; // この素材だけ旧描画を使う。
    image.src = new URL(`../art/dungeon/crypt-${name}.webp`, import.meta.url).href;
  }
  const state = sheets.get(key);
  return state.ready ? state.image : null;
}
export function prewarmCryptActors() { for (const key of Object.keys(assets)) sheet(key); }

// 原画の各物体を余白ごと切り出す。隣の物体を拾わないよう、格子より実際の輪郭を優先する。
export const CRYPT_PROP_FRAMES = {
  chest: ["a", 24, 116, 487, 360], chestOpen: ["a", 538, 36, 462, 450],
  stairs: ["a", 1028, 60, 501, 450], fountain: ["a", 37, 529, 452, 473],
  corpse: ["seated", 8, 180, 526, 745],
  corpseWarm: ["seated", 484, 180, 504, 742], corpseGreat: ["seated", 990, 174, 544, 778],
  fountainEmpty: ["c", 119, 499, 502, 503], portal: ["a", 1037, 548, 486, 439],
  trap: ["b", 70, 149, 399, 275], event: ["b", 619, 17, 302, 480],
  bossDoor: ["b", 75, 509, 370, 478], wisp: ["b", 600, 524, 340, 483],
  story: ["b", 1176, 533, 233, 447],
  ember: ["d", 80, 8, 360, 486], gold: ["d", 573, 153, 418, 311],
  poison: ["d", 1046, 72, 463, 380], guard: ["d", 122, 480, 311, 525],
  start: ["d", 607, 487, 353, 515],
};
export function cryptPropKey(cell, bossDoor = false) {
  if (!cell || !cell.revealed) return null;
  if (cell.type === "portal" || (cell.type === "stairs" && cell.gate)) return "portal";
  if (cell.type === "stairs") return bossDoor ? "bossDoor" : "stairs";
  if (cell.type === "chest") return cell.cleared ? "chestOpen" : "chest";
  if (cell.type === "corpse") return cell.corpseGreat ? "corpseGreat" : cell.corpseWarm ? "corpseWarm" : "corpse";
  if (cell.type === "fountain") return cell.cleared ? "fountainEmpty" : "fountain";
  if (["trap", "event", "story"].includes(cell.type) && !cell.cleared) return cell.type;
  return null;
}
function crop(image, x, y, w, h) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  c.getContext("2d").drawImage(image, x, y, w, h, 0, 0, w, h);
  return { c, w, h, pad: 0 };
}
const props = new Map();
export function cryptPropBitmap(key) {
  const frame = CRYPT_PROP_FRAMES[key];
  if (!frame) return null;
  const image = sheet(frame[0]);
  if (!image) return null;
  if (!props.has(key)) {
    const b = crop(image, ...frame.slice(1));
    // 隣の遺体の手だけを除き、外へ投げ出した腕は各原画に残す。
    if (key === "corpse") b.c.getContext("2d").clearRect(476, 0, 50, 550);
    if (key === "corpseWarm") b.c.getContext("2d").clearRect(0, 550, 50, 100);
    // 隣の区画へ飛び出した槍先・残火の先端を切り出しから除く。
    if (key === "ember") b.c.getContext("2d").clearRect(0, 472, 110, 14);
    if (key === "guard") b.c.getContext("2d").clearRect(78, 0, b.w - 78, 30);
    if (key === "story") {
      // 師の角灯は青緑の魂火。真鍮の籠を残し、窓の炎の部分だけを色替えする。
      const g = b.c.getContext("2d"), pixels = g.getImageData(0, 0, b.w, b.h), d = pixels.data;
      for (let y = Math.floor(b.h * 0.47); y < b.h * 0.86; y++) for (let x = Math.floor(b.w * 0.22); x < b.w * 0.8; x++) {
        const i = (y * b.w + x) * 4, r = d[i], green = d[i + 1], blue = d[i + 2];
        if (d[i + 3] && r > 135 && green > 60 && r > blue * 1.35) {
          d[i] = blue * 0.65 + green * 0.35; d[i + 1] = r * 0.98; d[i + 2] = r * 0.8;
        }
      }
      g.putImageData(pixels, 0, 0);
    }
    props.set(key, b);
  }
  return props.get(key);
}

// 灯の位置は切り出した絵に対する比率。色替えの対象から角灯を除くためにも使う。
const walkerFrames = {
  down: { rect: [157, 8, 385, 612], lamp: [0.12, 0.65] },
  up: { rect: [718, 8, 404, 612], lamp: [0.89, 0.65] },
  left: { rect: [157, 625, 369, 614], lamp: [0.12, 0.57] },
  right: { rect: [737, 625, 363, 614], lamp: [0.88, 0.59] },
};
const baseWalkers = new Map(), looks = new Map();
const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
function paletteColor(ramp, value) {
  const pos = Math.max(0, Math.min(5, 5 - value * 5)), i = Math.min(4, Math.floor(pos)), t = pos - i;
  return ramp[i].map((v, k) => v + (ramp[i + 1][k] - v) * t);
}
function coloredWalker(base, look, lamp) {
  if (look.cloak === "night" && look.trim === "gold") return base;
  const out = crop(base.c, 0, 0, base.w, base.h), ctx = out.c.getContext("2d");
  const pixels = ctx.getImageData(0, 0, out.w, out.h), d = pixels.data;
  const cloak = WALKER_CLOAKS.find(o => o.key === look.cloak).ramp.map(rgb);
  const trim = WALKER_TRIMS.find(o => o.key === look.trim).ramp.map(rgb);
  for (let y = 0; y < out.h; y++) for (let x = 0; x < out.w; x++) {
    const i = (y * out.w + x) * 4;
    if (!d[i + 3]) continue;
    const r = d[i], g = d[i + 1], b = d[i + 2], hi = Math.max(r, g, b), lo = Math.min(r, g, b);
    if (hi < 18) continue; // 顔の闇を保つ。
    if (Math.abs(x / out.w - lamp[0]) < 0.16 && Math.abs(y / out.h - lamp[1]) < 0.15) continue;
    const sat = (hi - lo) / hi;
    let color = null, amount = 1;
    if (look.cloak !== "night" && y < out.h * 0.87 && sat < 0.23) {
      color = paletteColor(cloak, Math.min(1, (r + g + b) / 3 / 170));
      amount = Math.min(1, (0.23 - sat) / 0.09);
    } else if (look.trim !== "gold" && y < out.h * 0.87 && r > g * 1.08 && g > b * 1.25 && g / r > 0.76 && hi > 75) {
      color = paletteColor(trim, hi / 255);
      // 暗い刺繍の陰影を保つ。革は暗い赤茶なのでこの色域から外れる。
      color = color.map(v => v * Math.min(1, hi / 160));
    }
    if (color) for (let k = 0; k < 3; k++) d[i + k] += (color[k] - d[i + k]) * amount;
  }
  ctx.putImageData(pixels, 0, 0);
  return out;
}
export function cryptWalkerBitmap(direction, value) {
  const image = sheet("walker");
  if (!image) return null;
  const dir = walkerFrames[direction] ? direction : "down", frame = walkerFrames[dir], look = normalizeLook(value);
  const key = `${look.cloak}/${look.trim}`;
  if (!looks.has(key)) {
    looks.set(key, new Map());
    while (looks.size > 3) looks.delete(looks.keys().next().value);
  }
  const frames = looks.get(key);
  if (!frames.has(dir)) {
    if (!baseWalkers.has(dir)) baseWalkers.set(dir, crop(image, ...frame.rect));
    frames.set(dir, { ...coloredWalker(baseWalkers.get(dir), look, frame.lamp), lamp: frame.lamp });
  }
  return frames.get(dir);
}

// ポップアップも盤面と同じ切り出し・色を使う。読み込み完了時に既存のphoto描画が更新する。
const propSprites = new Map();
export function cryptPropSprite(key, fallback) {
  const frame = CRYPT_PROP_FRAMES[key];
  if (!frame) return null;
  if (propSprites.has(key)) return propSprites.get(key);
  sheet(frame[0]);
  const w = frame[3], h = frame[4], k = 12 / Math.max(w, h), img = new Image();
  const spr = { w: w * k, h: h * k, photo: { img, sx: 0, sy: 0, sw: w, sh: h } };
  propSprites.set(key, spr);
  sheets.get(frame[0]).done.then(() => {
    const b = cryptPropBitmap(key);
    if (b) { img.src = b.c.toDataURL(); return; }
    // 取得失敗でも空のポップアップにしない。旧アイコンを同じ枠へ収める。
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const g = c.getContext("2d"), rows = fallback.art, fh = rows.length, fw = Math.max(...rows.map(r => r.length));
    const scale = Math.min(w / fw, h / fh), ox = (w - fw * scale) / 2, oy = (h - fh * scale) / 2;
    for (let y = 0; y < fh; y++) for (let x = 0; x < rows[y].length; x++) {
      const color = fallback.palette[rows[y][x]];
      if (color) { g.fillStyle = color; g.fillRect(ox + x * scale, oy + y * scale, scale, scale); }
    }
    img.src = c.toDataURL();
  });
  return spr;
}
