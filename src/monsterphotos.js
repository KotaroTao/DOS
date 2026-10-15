// 地下墓地・修道院・黒水の取水口・回廊・沈んだ礼拝堂の透過原画。通常敵・強敵・主・召喚先・ミミックで共用する。
// 能力値や文字グリッドは保ち、読めた原画だけを最初の描画前に登録する。
export const MONSTER_PHOTOS = {
  bs_bonebat: [448, 415],
  bs_carrioncrow: [418, 438],
  bs_corpsemaggot: [398, 415],
  bs_grasphand: [446, 368],
  bs_gravewisp: [355, 400],
  bs_bonepile: [464, 400],
  el_cryptlord: [463, 472],
  d01_skeleton: [359, 422],
  mimic: [443, 440],
  bs_mournshade: [338, 366],
  bs_spiritbat: [398, 361],
  el_palebutcher: [365, 378],
  // 黒水の取水口（通常敵9種と女王。召喚先は吸血大ヒル）。
  bs_bloatfly: [512, 435],
  bs_fogspecter: [403, 512],
  bs_giantleech: [488, 459],
  bs_ratking: [512, 451],
  bs_razorshrimp: [492, 512],
  bs_sewercrab: [512, 470],
  bs_mucusworm: [512, 477],
  bs_toxictoad: [512, 399],
  bs_drownedcorpse: [503, 512],
  el_bloatqueen: [512, 453],
  bs_zombie: [336, 363],
  bs_weepangel: [409, 406],
  bs_tombwarden: [369, 384],
  bs_shroudstrangler: [408, 391],
  bs_pettyrevenant: [379, 400],
  bs_sarcoguard: [315, 383],
  bs_ghoul: [397, 387],
  bs_skullswarm: [394, 403],
  d02_soldier: [372, 463],
  bs_bonechanter: [378, 399],
  bs_gravecaller: [408, 389],
  bs_cryptabbot: [434, 392],
  // 沈んだ礼拝堂（通常敵9種・強敵・主。召喚先は汚泥の塊）。
  bs_sludgeooze: [378, 330],
  bs_waterelemental: [296, 348],
  bs_sewerdredger: [358, 336],
  bs_brinewraith: [348, 356],
  bs_waterhag: [329, 345],
  bs_eelfiend: [351, 365],
  bs_anglerfiend: [348, 334],
  d03_sahagin: [418, 334],
  bs_abysstentacle: [330, 337],
  el_drownedpaladin: [363, 371],
  bs_sewerlord: [498, 372],
};

function loadImage(img, src, width, height) {
  return new Promise(resolve => {
    // 配信失敗・応答のない回線でも起動を止めず、既存のドット絵を使う。
    const timer = setTimeout(() => finish(false), 4000);
    const finish = ok => {
      clearTimeout(timer);
      img.onload = img.onerror = null;
      resolve(ok);
    };
    img.onload = () => finish(img.naturalWidth === width && img.naturalHeight === height);
    img.onerror = () => finish(false);
    img.src = src;
  });
}

export async function loadMonsterPhotos(monsters) {
  await Promise.all(Object.entries(MONSTER_PHOTOS).map(async ([id, [width, height]]) => {
    const mon = monsters[id];
    if (!mon || mon.photo || typeof Image === "undefined") return;
    const img = new Image();
    img.decoding = "async";
    const src = new URL(`../art/monsters/${id}.webp`, import.meta.url).href;
    if (!await loadImage(img, src, width, height)) return;
    const size = mon.elite ? 120 : 96;
    const k = size / Math.max(width, height);
    Object.assign(mon, {
      w: Math.round(width * k), h: Math.round(height * k),
      photo: { img, sx: 0, sy: 0, sw: width, sh: height },
    });
  }));
}
