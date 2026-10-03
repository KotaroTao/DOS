// 秘術師 (arcanist) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
export default {
  table: `
    1 SHADOWBOLT 2 HALITO 3 MARK_FIRE 5 afterMp/1 7 ICENEEDLE 10 GRAVITY
    15 spellCrit/1 20 DARKMIST 22 MAHALITO 25 chant/1 30 ELEMBREAK 35 scan/1
    40 KINJUKAICHOU 45 spellCrit/2 47 DARKBLAST 50 SEISHIN 55 DISPEL 60 afterMp/2
    65 MADALT 70 elemFloor/1 72 DARKNESS 75 barrier/1 80 SEISAI 85 MARYOKUBOUSOU
    90 chant/2 95 HYORETSU 100 ENBU 105 spellCrit/3 110 GRAVIGA 112 MEIKOKU
    115 resistAilment/1 120 RAIJIN 125 soulEater/1 130 KOKUUHA 135 reflect/1 140 HYOUGA
    145 afterBoth/1 150 GOKUEN 155 resistAilment/2 160 METEOR 165 afterBoth/2 170 ZETTAIREIDO
    172 MEIANRAN 175 bigBarrier/1 180 GOKUENRAN 185 barrier/2 190 KYOMU 195 TENPENCHII
    200 KYOKUDAI`,
  skills: {},
  perks: {},
};
