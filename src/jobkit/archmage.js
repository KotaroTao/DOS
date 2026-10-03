// 大魔導 (archmage) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
export default {
  table: `
    1 HALITO 3 SHADOWBOLT 4 ISHITSUBUTE 5 afterMp/1 7 ICENEEDLE 8 KAMAITACHI
    10 SEISHIN 15 chant/1 20 MAHALITO 22 EARTHQUAKE 25 spellCrit/1 30 ROCKBLAST
    35 scan/1 40 SHINENNOHADOU 45 spellCrit/2 47 DARKBLAST 50 MADALT 55 ELEMBREAK
    60 afterMp/2 62 LANDSLIDE 65 TILTOWAIT 70 elemFloor/1 75 chant/2 80 SEISAI
    85 GRAVITY 90 barrier/1 95 HYORETSU 100 ENBU 105 spellCrit/3 110 RAIJIN
    112 MEIKOKU 115 reflect/1 120 DAICHIWARI 125 resistAilment/1 130 HYOUGA 135 soulEater/1
    140 GOKUEN 145 afterBoth/1 150 RAIMEIRAN 155 barrier/2 160 METEOR 165 resistAilment/2
    170 ZETTAIREIDO 172 GANSAI 175 bigBarrier/1 177 MEIANRAN 180 GOKUENRAN 185 afterBoth/2
    190 KOKUUHA 195 TENPENCHII 200 KYOKUDAI`,
  skills: {},
  perks: {},
};
