// 迷宮の透過原画。通常敵・強敵・主・召喚先・共通の敵で共用する。
// 能力値や文字グリッドは保ち、読めた原画だけを最初の描画前に登録する。
export const MONSTER_PHOTOS = {
  // 名のある強敵24体。森の小屋の3体と図鑑の記述に合わせた透過原画。
  el_palebutcher: [573, 475],
  el_cryptlord: [473, 493],
  el_bloatqueen: [513, 477],
  el_drownedpaladin: [548, 532],
  el_chainoverseer: [527, 510],
  el_crystalseer: [460, 528],
  el_warbanner: [528, 520],
  el_headsman: [512, 520],
  el_eldertreant: [510, 520],
  el_mistmother: [548, 520],
  el_heresiarch: [492, 520],
  el_fallenidol: [520, 520],
  el_cinderking: [520, 520],
  el_magmawyrm: [520, 520],
  el_frostsovereign: [520, 520],
  el_glacialmaw: [520, 520],
  el_offeringslime: [520, 520],
  el_bogfrogking: [520, 520],
  el_blizzardwitch: [528, 516],
  el_stareater: [518, 520],
  el_ashshogun: [501, 511],
  el_dragonslayer: [501, 504],
  el_tunnelking: [524, 505],
  el_oremaw: [519, 506],
  mt_silver: [347, 520],
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
  d01_skeleton: [359, 422],
  mimic: [443, 440],
  bs_mournshade: [338, 366],
  bs_spiritbat: [398, 361],
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
