// 地下墓地・修道院の透過原画。通常敵・強敵・主・召喚先・ミミックで共用する。
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
