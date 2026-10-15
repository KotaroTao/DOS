// 奉納品1〜20 (misc.js の登録順) の透過WebP。読めない時は元の固有ドット絵を使う。
export const MISC_PHOTO_IDS = [
  "m_rat_king_tooth",
  "m_chained_finger",
  "m_gaoler_bell",
  "m_bribe_copper",
  "m_unlisted_cell_key",
  "m_execution_shroud",
  "m_kobold_keepsake",
  "m_bat_night_eye",
  "m_rust_worm_iron",
  "m_imp_milk_horn",
  "m_tear_bottle",
  "m_unjudged_skull",
  "m_gaol_confession",
  "m_candle_amber",
  "m_harpy_pinion",
  "m_lost_realm_silver",
  "m_warhorse_neckbone",
  "m_silent_alarm",
  "m_wall_lizard_fang",
  "m_undying_ember",
];
const photos = new Map();
export function miscPhoto(spr) {
  if (!spr || spr.slot !== "misc" || spr.unidentified) return null;
  return photos.get(spr.id) || null;
}
export async function loadMiscPhotos() {
  if (typeof Image === "undefined") return;
  await Promise.all(MISC_PHOTO_IDS.map(id => new Promise(resolve => {
    if (photos.has(id)) { resolve(); return; }
    const img = new Image();
    const timer = setTimeout(() => finish(false), 4000);
    const finish = ok => {
      clearTimeout(timer);
      img.onload = img.onerror = null;
      if (ok) photos.set(id, { w: 24, h: 24, photo: {
        img, sx: 0, sy: 0, sw: img.naturalWidth, sh: img.naturalHeight,
      } });
      resolve();
    };
    img.onload = () => finish(img.naturalWidth > 0 && img.naturalHeight > 0);
    img.onerror = () => finish(false);
    img.decoding = "async";
    img.src = new URL(`../art/offerings/${id}.webp`, import.meta.url).href;
  })));
}
