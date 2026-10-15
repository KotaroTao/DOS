// 奉納品41〜60の原画。台帳の並びは src/catalog/misc.js に従う。
export const MISC_PHOTOS = [
  "m_oath_rib", // 41 誓いのあばら骨
  "m_ash_woven_vestment", // 42 屍灰織りの祭服
  "m_ferrymans_fee", // 43 冥府の渡し賃
  "m_gold_seared_eye", // 44 黄金に焼かれた眼
  "m_challenger_blood", // 45 竜に挑んだ者の血
  "m_dragon_tear_stone", // 46 竜の涙石
  "m_hoard_flake_pouch", // 47 竜金のこぼれ袋
  "m_mourning_moon_orb", // 48 死者を送る月の玉
  "m_elder_horn_shard", // 49 古竜の砕け角
  "m_crown_fused_skull", // 50 王冠ごと溶けた頭の骨
  "m_rusted_shackle_pin", // 51 足かせの留め針
  "m_prisoners_dice", // 52 囚人の骨サイコロ
  "m_warden_signet", // 53 看守長の印
  "m_centipede_husk", // 54 地虫の抜け殻
  "m_phosphor_moss_jar", // 55 光りこけの小瓶
  "m_siege_arrowhead", // 56 攻城戦の矢じり
  "m_chatelaine_brooch", // 57 城守りの妻の飾り留め
  "m_mercenary_tag", // 58 傭兵の認識札
  "m_battlements_keystone", // 59 城壁を支えた石
  "m_gargoyle_chip", // 60 石像鬼の欠け爪
];
const photos = new Map();
export function miscPhoto(spr) {
  return spr && spr.slot === "misc" ? photos.get(spr.id) || null : null;
}
export async function loadMiscPhotos() {
  if (typeof Image === "undefined") return;
  await Promise.all(MISC_PHOTOS.map(id => new Promise(resolve => {
    const img = new Image();
    img.decoding = "async";
    const finish = ok => {
      clearTimeout(timer);
      img.onload = img.onerror = null;
      if (ok) photos.set(id, { w: 24, h: 24,
        photo: { img, sx: 0, sy: 0, sw: img.naturalWidth, sh: img.naturalHeight } });
      resolve();
    };
    // 通信が途切れても既存の固有ドット絵で起動する。
    const timer = setTimeout(() => finish(false), 4000);
    img.onload = () => finish(img.naturalWidth > 0 && img.naturalHeight > 0);
    img.onerror = () => finish(false);
    img.src = new URL(`../art/misc/${id}.webp`, import.meta.url).href;
  })));
}
