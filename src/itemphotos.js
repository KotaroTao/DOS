// 固定制作番号に対応する透過原画。取得できない品は既存の絵へ戻す。
import { NUMBERED_ITEM_IDS } from "./itemnumbers.js";

export const ITEM_PHOTOS = Object.freeze([
  // 制作番号1401〜1500の追加原画。
  ...NUMBERED_ITEM_IDS.slice(1400, 1500),
  ...NUMBERED_ITEM_IDS.slice(1300, 1400),
  // 制作番号1101〜1200の追加原画。
  ...NUMBERED_ITEM_IDS.slice(1100, 1200),
  // 制作番号1901〜2000の追加原画。
  ...NUMBERED_ITEM_IDS.slice(1900, 2000),
  ...NUMBERED_ITEM_IDS.slice(0, 300),
  // 制作番号301〜400の追加原画。
  ...NUMBERED_ITEM_IDS.slice(300, 400),
  ...NUMBERED_ITEM_IDS.slice(400, 402),
  ...NUMBERED_ITEM_IDS.slice(500, 600),
  ...NUMBERED_ITEM_IDS.slice(700, 800),
  ...NUMBERED_ITEM_IDS.slice(800, 900),
  ...NUMBERED_ITEM_IDS.slice(900, 1000),
  // 制作番号1701〜1800の追加原画。
  ...NUMBERED_ITEM_IDS.slice(1700, 1800),
  ...NUMBERED_ITEM_IDS.slice(1200, 1300),

  // 制作番号2001〜2100の追加原画。
  ...NUMBERED_ITEM_IDS.slice(2000, 2100),

  // 制作番号601〜700の追加原画。
  ...NUMBERED_ITEM_IDS.slice(600, 700),
  // 制作番号2101〜2201の追加原画。
  ...NUMBERED_ITEM_IDS.slice(2100, 2201),
  // 制作番号1801〜1900の追加原画。
  ...NUMBERED_ITEM_IDS.slice(1800, 1900),
]);
const photos = new Map();
export function itemPhoto(id) { return photos.get(id) || null; }

export async function loadItemPhotos() {
  if (typeof Image === "undefined") return;
  await Promise.all(ITEM_PHOTOS.map(id => new Promise(resolve => {
    const img = new Image();
    const timer = setTimeout(() => finish(false), 4000);
    const finish = ok => {
      clearTimeout(timer);
      img.onload = img.onerror = null;
      if (ok) photos.set(id, { w: 24, h: 24,
        photo: { img, sx: 0, sy: 0, sw: 384, sh: 384 } });
      resolve();
    };
    img.decoding = "async";
    img.onload = () => finish(img.naturalWidth === 384 && img.naturalHeight === 384);
    img.onerror = () => finish(false);
    img.src = new URL(`../art/items/${id}.webp`, import.meta.url).href;
  })));
}
