// 魔盗賊 (arcthief) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
export default {
  table: `
    1 STEAL 2 MAKEN_DARK 3 HALITO 4 SHADOWBOLT 5 openSpell/1 7 KAGEWATARI
    10 KATINO 12 SHIPPUUGIRI 15 chant/1 20 SEAL 25 spellCrit/1 30 MAHALITO
    32 DARKBLAST 35 extraHit/1 40 MARYOKUGOUDATSU 45 initiative/1 50 GENWAKU 55 DISPEL
    57 MEIJIN 60 ambushCrit/1 65 BLINDALL 70 spellCrit/2 72 DARKNESS 75 vitalEye/1
    80 SEISAI 85 ASSASSINATE 90 afterMp/1 95 RAITEI 100 MADALT 105 parry/1
    110 SEALALL 115 extraHit/2 120 KUBIHANE 122 MEIKOKU 125 chant/2 130 HYORETSU
    135 spellCrit/3 140 SHUNSATSU 145 vitalEye/2 150 RAIJIN 155 resistAilment/1 160 GOKUEN
    165 soulEater/1 170 ANSATSU 175 parry/2 180 METEOR 185 elemFloor/1 190 HISSATSU
    195 GOKUENRAN 200 KYOKUDAI`,
  skills: {},
  perks: {},
};
