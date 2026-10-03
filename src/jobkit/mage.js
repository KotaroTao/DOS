// 魔導士 (mage) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
export default {
  table: `
    1 HALITO 3 ICENEEDLE 4 ISHITSUBUTE 5 afterMp/1 7 KAMAITACHI 8 SHADOWBOLT
    10 KATINO 15 chant/1 20 MAHALITO 22 AQUAWAVE 25 spellCrit/1 27 WINDSTORM
    30 ROCKBLAST 32 EARTHQUAKE 35 afterMp/2 40 TILTOWAIT 45 chant/2 50 MADALT
    55 SEISHIN 57 ELEMBREAK 60 spellCrit/2 65 LAHALITO 70 barrier/1 72 TORNADO
    75 scan/1 80 SEISAI 85 RAITEI 90 reflect/1 95 HYORETSU 100 ENBU
    105 barrier/2 110 RAIJIN 115 resistAilment/1 120 DAICHIWARI 125 elemFloor/1 130 HYOUGA
    135 spellCrit/3 140 GOKUEN 145 afterBoth/1 150 RAIMEIRAN 155 resistAilment/2 160 METEOR
    165 afterBoth/2 170 ZETTAIREIDO 175 bigBarrier/1 180 GOKUENRAN 185 soulEater/1 190 KOKUUHA
    195 TENPENCHII 200 KYOKUDAI`,
  skills: {},
  perks: {},
};
