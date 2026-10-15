// 地下墓地・回廊の透過原画。通常敵・強敵・取り巻き・ミミックで共用する。
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
  bs_ghoul: [323, 350],
  bs_pettyrevenant: [369, 371],
  bs_sarcoguard: [280, 368],
  bs_skullswarm: [313, 348],
  bs_spiritbat: [398, 361],
  bs_shroudstrangler: [356, 350],
  bs_tombwarden: [341, 375],
  bs_weepangel: [369, 358],
  el_palebutcher: [365, 378],
  bs_zombie: [384, 374],
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
