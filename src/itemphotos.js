// 制作済みアイテムの透過原画。取得できない品は既存の絵へ戻す。
import { NUMBERED_ITEM_IDS } from "./itemnumbers.js";

export const ITEM_PHOTOS = Object.freeze([
  ...NUMBERED_ITEM_IDS.slice(900, 1000),
  ...NUMBERED_ITEM_IDS.slice(0, 200),
  ...NUMBERED_ITEM_IDS.slice(300, 400),
  ...NUMBERED_ITEM_IDS.slice(400, 402),
  ...NUMBERED_ITEM_IDS.slice(500, 600),
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
