// 奉納品61〜80番。読めない場合は既存の固有ドット絵を使う。
export const COLLECTIBLE_PHOTOS = [
  "m_widows_veil",
  "m_cursed_war_coin",
  "m_alchemist_residue",
  "m_chasm_echo_shell",
  "m_void_moth_dust",
  "m_fallen_rope_knot",
  "m_pale_lantern_glass",
  "m_abyss_salt",
  "m_drowned_lyre_string",
  "m_nixie_scale",
  "m_tidebound_compass",
  "m_pearl_diver_lung",
  "m_river_god_tear",
  "m_censer_ash",
  "m_choir_bone_flute",
  "m_reliquary_nail",
  "m_mourning_glass",
  "m_funeral_mask",
  "m_blackened_thurible",
  "m_knight_gorget",
];
const photos = new Map();
export function collectiblePhoto(id) { return photos.get(id) || null; }
export async function loadCollectiblePhotos() {
  if (typeof Image === "undefined") return;
  await Promise.all(COLLECTIBLE_PHOTOS.map(id => new Promise(resolve => {
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
    img.src = new URL(`../art/collectibles/${id}.webp`, import.meta.url).href;
  })));
}
