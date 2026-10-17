import { lazyPhoto } from "./photoload.js";
// 固定制作番号に対応する透過原画。取得できない品は共通の待機印を表示する。
import { NUMBERED_ITEM_IDS } from "./itemnumbers.js";

export const ITEM_PHOTOS = Object.freeze([
  // 制作番号1601〜1700の追加原画。
  ...NUMBERED_ITEM_IDS.slice(1600, 1700),
  // 制作番号1401〜1500の追加原画。
  ...NUMBERED_ITEM_IDS.slice(1400, 1500),
  ...NUMBERED_ITEM_IDS.slice(1300, 1400),
  // 制作番号1101〜1200の追加原画。
  ...NUMBERED_ITEM_IDS.slice(1100, 1200),
  // 制作番号1901〜2000の追加原画。
  ...NUMBERED_ITEM_IDS.slice(1900, 2000),
  ...NUMBERED_ITEM_IDS.slice(0, 300),
  // 制作番号1501〜1600の追加原画。
  ...NUMBERED_ITEM_IDS.slice(1500, 1600),
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
  ...NUMBERED_ITEM_IDS.slice(1000, 1100),
]);
const photos = new Map();
const ids = new Set(ITEM_PHOTOS);
export function itemPhoto(id) {
  if (!ids.has(id) || typeof Image === "undefined") return null;
  let sprite = photos.get(id);
  if (!sprite) {
    sprite = lazyPhoto(new URL(`../art/items/${id}.webp`, import.meta.url).href, { width: 384, height: 384 });
    photos.set(id, sprite);
  }
  sprite.photo.load();
  return sprite;
}

// 制作確認用の一括読み込み。通常の起動では呼ばない。
export async function loadItemPhotos() {
  await Promise.all(ITEM_PHOTOS.map(id => itemPhoto(id)?.photo.ready));
}
