import { lazyPhoto } from "./photoload.js";
// 迷宮の透過原画。通常敵・強敵・主・召喚先・共通の敵で共用する。
// 能力値や文字グリッドは保ち、原画の取得は表示に必要になってから始める。
export const MONSTER_PHOTOS = {
  // <<CHAPTER14_ART>>
  // 第十四章「深淵の聖堂」。共通の敵は作成済み原画を共用。
  bs_falseseraph: [520, 421],
  bs_censerfiend: [520, 352],
  bs_lightidol: [360, 506],
  bs_choirofthelost: [520, 472],
  bs_flagellant: [520, 355],
  bs_radiantwraith: [458, 520],
  bs_crusaderghost: [520, 337],
  bs_saintbeast: [520, 326],
  bs_blindingorb: [520, 364],
  bs_martyrwraith: [348, 520],
  bs_holygolem: [520, 420],
  bs_confessor: [520, 448],
  bs_lightlance: [520, 466],
  bs_wingedjudge: [520, 466],
  bs_pyreofsouls: [502, 520],
  bs_cathedralguard: [520, 434],
  bs_hymncaster: [512, 520],
  bs_lightmoth: [482, 520],
  bs_seraphwraith: [520, 431],
  el_sorrowsaint: [471, 520],
  el_huntsmanwraith: [487, 520],
  bs_highpontiff: [441, 520],
  // <</CHAPTER14_ART>>
  // <<CHAPTER13_ART>>
  // 第十三章「溶鉄炉」。共通の敵は作成済み原画を共用。
  bs_moltensmith: [520, 484],
  bs_forgegolem: [520, 405],
  bs_slagbeast: [520, 380],
  bs_anvilhorror: [520, 349],
  bs_soulingot: [520, 301],
  bs_moltenwraith: [520, 399],
  bs_forgehound: [520, 353],
  bs_ironmaiden: [508, 520],
  bs_bellowsfiend: [520, 359],
  bs_quenchserpent: [520, 380],
  bs_smithghost: [520, 482],
  bs_moltencore: [520, 430],
  bs_dollhusk: [520, 393],
  bs_flamehammer: [520, 448],
  bs_cruciblehorror: [520, 355],
  bs_sparkswarm: [520, 487],
  bs_forgewyrm: [520, 293],
  bs_moltenknight: [520, 489],
  bs_cindergeist: [520, 417],
  bs_emberfly: [520, 346],
  el_geargod: [520, 304],
  el_moltengiant: [520, 350],
  bs_forgemaster: [520, 272],
  // <</CHAPTER13_ART>>
  // <<CHAPTER12_ART>>
  // 第十二章「王家の廟」。共通の敵は作成済み原画を共用。
  bs_wickmummy: [520, 403],
  bs_embalmer: [520, 497],
  bs_graveroyalguard: [494, 520],
  bs_waxhorror: [520, 337],
  bs_mournfulchancellor: [520, 471],
  bs_candlewraith: [505, 520],
  bs_preservedbeast: [520, 272],
  bs_tombpriest: [520, 367],
  bs_sarcophagusguard: [520, 379],
  bs_wailingnoble: [520, 479],
  bs_coffincrawler: [520, 272],
  bs_mummylord: [520, 416],
  bs_deathmask: [479, 455],
  bs_corpsewax: [520, 388],
  bs_funeralwraith: [520, 357],
  bs_boneprince: [520, 454],
  bs_crypthound: [520, 340],
  bs_shroudkeeper: [502, 520],
  bs_doomknight: [520, 329],
  bs_voidknight: [520, 311],
  el_lanternreaper: [520, 360],
  el_soulflayer: [381, 520],
  bs_cryptking: [520, 449],
  // <</CHAPTER12_ART>>
  // <<CHAPTER10_ART>>
  // 第十章・地底大空洞（作成済み26体は既存原画を共用）。
  bs_echowraith: [520, 493],
  bs_stalactiteghost: [333, 520],
  bs_moldern: [250, 520],
  // <</CHAPTER10_ART>>
  // <<TOXIC_SWAMP_ART>>
  // 第7章「毒沼」（作成済みの通常敵・強敵・共通敵は既存原画を共用）。
  bs_plaguerat: [520, 334],
  bs_rotooze: [520, 344],
  bs_bogdrowned: [520, 311],
  bs_leechswarm: [520, 342],
  bs_marshlurker: [520, 350],
  bs_blightmoth: [520, 337],
  bs_sludgehydra: [520, 374],
  bs_gasfiend: [520, 445],
  bs_plaguebeast: [520, 318],
  bs_discardeddoll: [387, 520],
  bs_fungalcorpse: [392, 520],
  bs_miasmawraith: [471, 520],
  bs_venomspider: [520, 362],
  bs_necromancer: [511, 520],
  bs_toxicgolem: [520, 459],
  bs_plaguewraith: [520, 498],
  bs_corpseflower: [494, 520],
  bs_swamphag: [520, 475],
  bs_pestilenceknight: [520, 475],
  bs_plaguelich: [520, 485],
  bs_swamplord: [520, 268],
  // <</TOXIC_SWAMP_ART>>
  // 第8章「嵐の尖塔」（通常敵・主。作成済みの強敵・共通敵は既存原画を共用）。
  bs_galewisp: [477, 444],
  bs_ravenswarm: [495, 496],
  bs_windscythe: [500, 434],
  bs_galehound: [520, 277],
  bs_windwraith: [490, 432],
  bs_thunderbeast: [500, 457],
  bs_cyclonecore: [415, 520],
  bs_zephyrfiend: [489, 513],
  bs_lightninggolem: [520, 458],
  bs_boltarcher: [505, 507],
  bs_soulanchor: [469, 520],
  bs_stormelemental: [492, 520],
  bs_stormcaller: [520, 504],
  bs_harpyqueen: [520, 497],
  bs_cloudgiant: [469, 520],
  bs_thunderroc: [513, 520],
  bs_tempestserpent: [481, 509],
  bs_galeknight: [471, 501],
  bs_stormhag: [474, 491],
  bs_skydrake: [520, 324],
  bs_stormlord: [520, 458],
  // <<ARENA_ART>>
  // 第九章・闘技場跡（本筋4・寄り道2。強敵と共通敵は作成済み原画を共用）。
  bs_championwraith: [478, 444],
  bs_netfighter: [520, 502],
  bs_arenabeast: [448, 504],
  bs_spectreaudience: [515, 447],
  bs_chainedogre: [520, 447],
  bs_bladedancer: [422, 519],
  bs_executioner: [469, 520],
  bs_beastmaster: [520, 486],
  bs_mirrorduelist: [462, 483],
  bs_crowdroar: [489, 457],
  bs_sandlurker: [520, 325],
  bs_gladiatorlich: [453, 482],
  bs_spikedgolem: [478, 520],
  bs_hookmaster: [520, 417],
  bs_bloodpriest: [367, 520],
  bs_warbeasthound: [520, 284],
  bs_championofash: [389, 488],
  bs_impaler: [520, 466],
  bs_ghostgladiator: [520, 462],
  bs_chaingang: [520, 364],
  bs_arenalord: [520, 506],
  // <</ARENA_ART>>
  // <<FROST_CORRIDOR_ART>>
  // 第六章・氷結回廊（強敵2種は作成済み原画を共用）。
  bs_frostwolf: [515, 456],
  bs_winterbat: [520, 390],
  bs_icewraith: [450, 469],
  bs_blizzardspirit: [460, 513],
  bs_iceserpent: [470, 499],
  bs_glacialcrab: [514, 490],
  bs_snowstalker: [474, 503],
  bs_rimecrawler: [520, 388],
  bs_frozenexplorer: [451, 470],
  bs_snowmantis: [520, 456],
  bs_aurorawisp: [374, 485],
  bs_iciclehorror: [465, 505],
  bs_frostknight: [520, 408],
  bs_frostlich: [482, 445],
  bs_frostmaiden: [487, 488],
  bs_icegolem: [520, 463],
  bs_frozenangel: [439, 508],
  bs_frostwyrm: [478, 502],
  bs_rimegiant: [451, 520],
  bs_frostfiend: [520, 449],
  bs_glaciallord: [520, 489],
  // <</FROST_CORRIDOR_ART>>
  // <<SUNKEN_TEMPLE_ART>>
  // 沈める大神殿（作成済みの敵・召喚先は既存原画を共用）。
  bs_divinegolem: [281,520],
  bs_fallenangel: [306,520],
  bs_templelord: [303,520],
  // <</SUNKEN_TEMPLE_ART>>
  // <<INFERNO_CAULDRON_ART>>
  // 業火の大釜（作成済みの通常敵・強敵・共通敵は既存原画を共用）。
  bs_doombringer: [520, 429],
  bs_infernolord: [430, 520],
  // <</INFERNO_CAULDRON_ART>>
  // <<CAVERN_LAIR_ART>>
  // 大空洞の主の寝床（作成済みの敵・召喚先・共通敵は既存原画を共用）。
  bs_cavetroll: [434, 520],
  bs_blindhorror: [520, 332],
  bs_cavernlord: [520, 365],
  bs_gloomstalker: [520, 354],
  // <</CAVERN_LAIR_ART>>
  // <<BAPTISM_ART>>
  // 洗礼の大水槽（作成済みの通常敵・強敵・共通敵は既存原画を共用）。
  bs_irongolem: [520, 401],
  bs_voidwalker: [322, 520],
  bs_shadowdragon: [516, 520],
  // <</BAPTISM_ART>>
  // <<CAULDRON_ART>>
  // 魂を煮る釜場（作成済みの通常敵・強敵・共通敵は既存原画を共用）。
  bs_furnacefiend: [520, 359],
  bs_obsidianguard: [443, 520],
  bs_basaltdrake: [520, 381],
  bs_infernaltyrant: [378, 520],
  // <</CAULDRON_ART>>
  // <<ASH_ALTAR_ART>>
  // 灰の降る祭場（作成済みの通常敵・強敵・共通敵は既存原画を共用）。
  bs_demon: [447, 520],
  bs_pyrelich: [268, 520],
  bs_brimstonegolem: [336, 520],
  bs_shadowogre: [412, 520],
  bs_darkliege: [383, 520],
  bs_flamedrake: [359, 520],
  // <</ASH_ALTAR_ART>>
  // <<DROWNED_HYMN_ART>>
  // 溺れた聖歌の回廊（作成済みの敵・召喚先は既存原画を共用）。
  d04_grudge: [520, 445],
  bs_idolguardian: [459, 491],
  bs_shadowseraph: [486, 477],
  bs_dreadlich: [448, 520],
  bs_crystalgolem: [501, 520],
  // <</DROWNED_HYMN_ART>>
  // <<FOSSIL_TOMB_ART>>
  // 化石竜の墓所（作成済みの通常敵・強敵・共通敵は既存原画を共用）。
  bs_fossildragon: [520, 357],
  bs_primalbeast: [520, 367],
  bs_primalserpent: [520, 339],
  bs_cavebehemoth: [520, 335],
  bs_earthshaker: [520, 404],
  bs_abysshorror: [520, 361],
  // <</FOSSIL_TOMB_ART>>
  // <<SUNKEN_PATH_ART>>
  // 水底の参道（作成済みの異端大司教・共通敵は既存原画を共用）。
  bs_kelpdrowned: [520, 445],
  bs_abyssjelly: [471, 520],
  bs_fonthorror: [520, 502],
  bs_drownedpriest: [474, 520],
  bs_naga: [497, 520],
  bs_choirwraith: [520, 509],
  bs_tidecaller: [520, 496],
  bs_sunkenbell: [490, 520],
  bs_soulharvester: [520, 492],
  // <</SUNKEN_PATH_ART>>
  // 火を噴く地割れ（残り火の王は作成済み原画を共用）。
  bs_magmaslime: [426, 407],
  bs_emberswarm: [425, 387],
  bs_ashghoul: [397, 393],
  bs_cinderwraith: [426, 425],
  bs_lavamaw: [425, 418],
  bs_sulfurfiend: [412, 425],
  bs_lavagolem: [395, 399],
  bs_magmaray: [425, 425],
  bs_hellhound: [389, 425],
  // 銀業の隠れ里の未作成だった黄金の守り像。他12体は既存絵を共用。
  bs_goldgolem: [363, 443],
  // 水晶の鉱脈（作成済みの鉱脈喰らいは既存絵を使う）。
  bs_crystalspider: [405, 373],
  bs_crystaldrake: [404, 375],
  bs_glowspore: [405, 396],
  bs_deepworm: [403, 396],
  bs_obsidianbeast: [405, 400],
  bs_cavefisher: [398, 385],
  bs_rocktitan: [405, 396],
  bs_caveguardian: [384, 405],
  bs_mawofthedeep: [405, 409],
  // 魂喰らいの大樹の主（通常敵・強敵・召喚先は作成済み原画を共用）。
  bs_forestlord: [520, 520],
  // 獄吏の詰所の主（通常敵・強敵・召喚先は作成済み原画を共用）。
  bs_ironcagewarden: [520, 381],
  // <<GRAND_LIBRARY_ART>>
  // 大書庫の主（通常敵・強敵・召喚先は作成済み原画を共用）。
  bs_archivist: [520, 414],
  // <</GRAND_LIBRARY_ART>>
  // 樹液の苗床（ほかの通常敵・強敵・召喚先は作成済み原画を共用）。
  bs_misttreant: [520, 419],
  bs_willowwitch: [413, 520],
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

// 台帳への登録だけでは通信しない。描画が必要になった魔物の原画だけ取得する。
export function registerMonsterPhotos(monsters) {
  for (const [id, [width, height]] of Object.entries(MONSTER_PHOTOS)) {
    const mon = monsters[id];
    if (!mon || mon.photo) continue;
    const size = mon.elite ? 120 : 96, k = size / Math.max(width, height);
    const sprite = lazyPhoto(new URL(`../art/monsters/${id}.webp`, import.meta.url).href,
      { w: Math.round(width * k), h: Math.round(height * k), width, height });
    Object.assign(mon, sprite);
  }
}

// サーバーや保存記録の魔物には、端末だけが持つ画像の取得口を結び直す。
export function restoreMonsterPhotos(enemies, monsters) {
  for (const enemy of enemies || []) {
    const sprite = monsters[enemy.key];
    if (sprite?.photo && enemy.mon) Object.assign(enemy.mon,
      { photo: sprite.photo, w: sprite.w, h: sprite.h });
  }
}

// 制作確認用の一括読み込み。通常の起動では登録だけを行う。
export async function loadMonsterPhotos(monsters) {
  registerMonsterPhotos(monsters);
  await Promise.all(Object.keys(MONSTER_PHOTOS).map(id => monsters[id]?.photo?.load?.()));
}
