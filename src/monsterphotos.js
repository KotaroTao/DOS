// 地下墓地・黒水の取水口の透過原画。通常敵・強敵・召喚先・ミミックで共用する。
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
