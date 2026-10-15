// 迷宮の透過原画。通常敵・強敵・主・召喚先・共通の敵で共用する。
// 能力値や文字グリッドは保ち、読めた原画だけを最初の描画前に登録する。
export const MONSTER_PHOTOS = {
  // <<PICTUREBOOK_ART>>
  // 絵本の閲覧室（作成済みのうごめく魔導書・共通敵は既存原画を共用）。
  bs_bookworm: [439, 520],
  bs_papermimic: [455, 520],
  bs_familiarswarm: [381, 520],
  bs_glyphhound: [505, 520],
  bs_cursescroll: [267, 520],
  bs_eyetome: [425, 520],
  bs_wordwraith: [292, 520],
  bs_astralwraith: [297, 520],
  el_voidarchon: [290, 520],
  // <</PICTUREBOOK_ART>>
  // 根の這う縦穴（大蛾・古樹は作成済みの原画を共用）。
  bs_giantowl: [502, 379],
  bs_stranglevine: [473, 386],
  bs_sporezombie: [460, 384],
  bs_fungalhulk: [520, 389],
  bs_flytrap: [491, 416],
  bs_mossgolem: [500, 368],
  bs_stonegazer: [520, 380],
  bs_griffon: [499, 432],

  // 捨て砦の本丸の主（ほかの敵は作成済み原画を共用）。
  bs_fortlord: [506, 520],
  // 地の底の霧森（通常敵9種と召喚される大蛾。繭母は共通の強敵原画）。
  bs_dryadfey: [326, 380],
  bs_wisplure: [263, 337],
  bs_thornhound: [383, 317],
  bs_direboar: [349, 325],
  bs_chimera: [404, 341],
  bs_thunderbird: [352, 356],
  bs_fogpanther: [420, 277],
  bs_corruptstag: [301, 364],
  bs_satyrpiper: [312, 345],
  bs_giantmoth: [367, 350],
  // 雷雨の大手門（既存原画を除く通常敵5種）。
  bs_bloodorc: [520, 500],
  bs_thunderknight: [520, 460],
  bs_cultist: [468, 511],
  bs_stormgiant: [520, 508],
  bs_bonecolossus: [520, 457],
  // <<CLOSED_STACKS_ART>>
  // 閉架の書庫（主は禁書の巨像と共用）。
  bs_tomeguardian: [473, 439],
  bs_runegolem: [520, 403],
  bs_forbiddenspirit: [520, 376],
  bs_mindeater: [515, 433],
  bs_spellwraith: [520, 354],
  bs_cosmicwraith: [520, 388],
  bs_inkdragon: [520, 284],
  bs_elderlich: [438, 476],
  bs_arcanesentinel: [520, 473],
  bs_soulreaper: [520, 406],
  bs_inkhorror: [520, 316],
  bs_grimoirebeast: [520, 367],
  el_librarian: [520, 403],
  // <</CLOSED_STACKS_ART>>
  // 名のある強敵24体の透過原画。
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
  // 亡兵の守る外郭（通常敵9種・強敵と、未登録だった共通の敵4種）。
  bs_pikewall: [491, 496],
  bs_bannerwraith: [406, 520],
  bs_drumwraith: [284, 408],
  d03_sentinel: [495, 473],
  bs_darksamurai: [520, 398],
  bs_ironknight: [424, 466],
  bs_gravecaptain: [520, 457],
  bs_siegeballista: [520, 343],
  d04_revenant: [480, 520],
  master_mimic: [517, 520],
  bs_cagewarden: [447, 520],
  mt_gold: [492, 520],
  mt_king: [486, 520],
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
  // 石眠りの石切り場（固有7種。坑口の4種とミミックは共用）。
  d03_orc: [493, 434],
  bs_shieldogre: [512, 467],
  bs_stonegorgon: [396, 512],
  d03_mandrake: [480, 504],
  bs_orehulk: [512, 462],
  bs_deepgolem: [487, 482],
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
  bs_sewerlord: [498, 372],
  // 捨て砦の地下牢の未作成だった通常敵6体。
  d03_ghost: [429, 417],
  bs_banshee: [364, 411],
  bs_shadowmage: [390, 434],
  bs_dullahan: [410, 408],
  bs_bloodwraith: [448, 431],
  bs_vampire: [339, 444],
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
