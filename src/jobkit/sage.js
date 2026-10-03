// 賢者 (sage) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
export default {
  table: `
    1 kantei/2 3 DIOS 5 afterMp/1 7 ICENEEDLE 10 CURE 15 scan/1
    20 MAHALITO 22 AQUAWAVE 25 chant/1 27 WINDSTORM 30 MANAGIFT 35 elemFloor/1
    40 SHINRANOSABAKI 45 spellCrit/1 47 ICELANCE 50 DIOSALL 55 DISPEL 60 afterHeal/1
    65 ELEMBREAK 70 afterMp/2 72 TORNADO 75 afterHeal/2 80 REVIVE 85 SEALALL
    90 chant/2 92 RAITEI 95 DIALALL 100 RAIJIN 105 spellCrit/2 110 HYOUGA
    115 resistAilment/1 120 METEOR 125 sanctuary/1 130 IYASHINAMI 135 barrier/1 140 GOKUEN
    142 GOURAI 145 spellCrit/3 150 RESURRECT 155 scripture/1 160 ZETTAIREIDO 165 resistAilment/2
    170 DAIFUKUIN 175 mercy/1 180 GOKUENRAN 185 bigBarrier/1 190 KOKUUHA 195 TENPENCHII
    200 KYOKUDAI`,
  skills: {},
  perks: {},
};
