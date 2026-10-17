import { lazyPhoto } from "./photoload.js";
// 奉納品61〜80番。読めない場合は共通の待機印を表示する。
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
const ids = new Set(COLLECTIBLE_PHOTOS);
export function collectiblePhoto(id) {
  if (!ids.has(id)) return null;
  if (!photos.has(id)) photos.set(id, lazyPhoto(new URL(`../art/collectibles/${id}.webp`, import.meta.url).href,
    { width: 384, height: 384,  }));
  return photos.get(id);
}
// 制作確認用。通常は表示時に取得する。
export async function loadCollectiblePhotos() {
  await Promise.all(COLLECTIBLE_PHOTOS.map(id => collectiblePhoto(id).photo.load()));
}
