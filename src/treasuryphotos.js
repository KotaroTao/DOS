// 奉納品81〜108番。読めない場合は既存の固有ドット絵を使う。
export const TREASURY_PHOTOS = [
  "m_petrified_heart", // 81 石化した心臓
  "m_grave_lantern_oil", // 82 墓守の灯油壺
  "m_ossified_wreath", // 83 石になった供え花
  "m_revenant_chain", // 84 よみがえり封じの鎖
  "m_tomb_seal_wax", // 85 墓の封じろう
  "m_wyrm_eye_jelly", // 86 竜の目の透明な玉
  "m_dragon_sinew", // 87 竜のすじ
  "m_molten_scale", // 88 溶け残りの竜のうろこ
  "m_drake_gizzard_stone", // 89 竜の胃石
  "m_wyrm_whisker", // 90 古竜のひげ
  "m_dragonfire_cinder", // 91 竜火のおき火
  "m_serpent_crown_shard", // 92 蛇王の冠のかけら
  "m_elder_heartscale", // 93 古竜の心臓を守るうろこ
  "m_world_root_splinter", // 94 世界樹の木片
  "m_star_iron_ingot", // 95 落ちた星の鉄の塊
  "m_sovereign_signet", // 96 滅んだ国の王の印
  "m_phoenix_down", // 97 不死鳥の綿羽
  "m_abyssal_pearl_core", // 98 深い闇の真珠の芯
  "m_godslayer_fang", // 99 神殺しの牙
  "m_first_flame_ember", // 100 最初の火の残り火
  "m_monk_prayer_beads", // 101 修道士の木のじゅず
  "m_banner_tassel", // 102 焼け残った軍旗の房
  "m_moss_offering_dish", // 103 水草のからんだ供え皿
  "m_unmelting_frost", // 104 溶けない霜の結晶
  "m_lightning_fossil", // 105 稲妻の化石
  "m_arena_seat_tally", // 106 古い観客席の木札
  "m_millennium_cocoon", // 107 千年眠るガのまゆ
  "m_still_hourglass", // 108 時を刻まぬ砂時計
];
const photos = new Map();
export function treasuryPhoto(id) { return photos.get(id) || null; }
export async function loadTreasuryPhotos() {
  if (typeof Image === "undefined") return;
  await Promise.all(TREASURY_PHOTOS.map(id => new Promise(resolve => {
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
    img.src = new URL(`../art/treasury/${id}.webp`, import.meta.url).href;
  })));
}
