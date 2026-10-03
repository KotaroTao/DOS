// 修羅 (asura) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
export default {
  table: `
    1 KYOUGEKI 2 KAENGIRI 3 DOUBLE 5 extraHit/1 7 SHIPPUUGIRI 10 HAISUI
    12 ASSASSINATE 15 fightSpirit/1 20 IATSU 22 KAENNAGI 25 vitalEye/1 30 SHURADOU
    35 extraHit/2 40 ASHURAZAN 45 counter/1 50 SANREN 55 TAME 57 GURENZAN
    60 fightSpirit/2 65 ISSEN 70 vitalEye/2 75 zanshin/1 80 KUBIHANE 82 FUUGA
    85 RANBU 90 extraHit/3 95 KISHINKA 100 SHURAZAN 105 fightSpirit/3 107 GOUKADAN
    110 ZETSUEI 115 ambushCrit/1 120 HADAN 125 counter/2 130 ROKUREN 135 asceticism/1
    140 AMATSUKAZE 145 resistAilment/1 150 SHUNSATSU 155 fightSpirit/4 160 KIKOKURANBU 162 SHOUNETSURANBU
    165 counter/3 170 KAMIKAZE 175 extraHit/4 180 MUGEN 185 endure/1 190 HAOUZAN
    195 TENRAN 200 RINNE`,
  skills: {},
  perks: {},
};
