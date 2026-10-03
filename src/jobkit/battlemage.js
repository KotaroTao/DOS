// 魔闘士 (battlemage) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
export default {
  table: `
    1 KYOUGEKI 2 KAENGIRI 3 HALITO 5 spellBlade/1 7 NERAIUCHI 8 ISHITSUBUTE
    10 BAKUENKEN 12 IWAKUDAKI 15 chant/1 20 SEISHIN 22 KAENNAGI 25 barrier/1
    30 MAHALITO 32 EARTHQUAKE 35 extraHit/1 40 HAMANOKEN 45 spellCrit/1 50 ELEMBREAK
    55 SAIKEN 57 GURENZAN 60 spellBlade/2 65 ROCKBLAST 70 fightSpirit/1 75 resistAilment/1
    80 HOUKEN 82 GANOTOSHI 85 LAHALITO 90 barrier/2 95 DISPEL 100 MAJINKEN
    105 vitalEye/1 110 DAICHIWARI 115 spellCrit/2 120 MUSOUKEN 122 YAMAKUZUSHI 125 reflect/1
    130 ENBU 135 extraHit/2 140 TENMAKEN 145 fightSpirit/2 150 GOKUEN 155 resistAilment/2
    160 METEOR 165 vitalEye/2 170 GANSAI 175 elemFloor/1 180 SHOUNETSURANBU 185 spellCrit/3
    190 GOKUENRAN 195 TOUSHINHAGEKI 200 KYOKUDAI`,
  skills: {},
  perks: {},
};
