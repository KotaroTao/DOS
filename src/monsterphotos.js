// 迷宮の透過原画。通常敵・強敵・主・召喚先・共通の敵で共用する。
// 能力値や文字グリッドは保ち、読めた原画だけを最初の描画前に登録する。
export const MONSTER_PHOTOS = {
  mt_silver: [347, 520],
  el_chainoverseer: [520, 482],
  bs_tunneler: [520, 501],
  bs_troll: [520, 501],
  bs_timbermite: [464, 512],
  bs_steelspider: [502, 510],
  bs_rockworm: [500, 520],
  bs_minelord: [520, 387],
  bs_minebat: [520, 344],
  bs_koboldsapper: [463, 505],
  bs_gargoyle: [495, 520],
  bs_dustwraith: [489, 495],
  bs_crystalcrawler: [520, 502],
  bs_chainedconvict: [510, 501],
  bs_blastsprite: [493, 486],
  bs_bonebat: [448, 415],
  bs_carrioncrow: [418, 438],
  bs_corpsemaggot: [398, 415],
  bs_grasphand: [446, 368],
  bs_gravewisp: [355, 400],
  bs_bonepile: [464, 400],
  el_cryptlord: [463, 472],
  d01_skeleton: [359, 422],
  mimic: [443, 440],
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
