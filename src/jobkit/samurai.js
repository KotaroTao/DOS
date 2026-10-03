// 侍 (samurai) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
export default {
  table: `
    1 KYOUGEKI 2 SUIGETSU 3 GONOSEN 5 iai/1 7 DOUBLE 10 KASUMEGIRI
    12 SHIPPUUGIRI 15 parry/1 20 ISSEN 22 UZUSHIO 25 vitalEye/1 30 MEIKYOU
    35 initiative/1 40 TSUBAMEGAESHI 45 extraHit/1 50 TSUJIKAZE 55 TATEWARI 57 HYOUJIN
    60 zanshin/1 65 ZETSUEI 70 parry/2 75 vitalEye/2 80 ZANTETSU 82 FUUGA
    85 SANREN 90 counter/1 95 KUBIHANE 100 KIKOKU 105 ambushCrit/1 107 TOUGADAN
    110 SHUNSATSU 115 extraHit/2 120 HADAN 125 counter/2 130 RANBU 135 fightSpirit/1
    140 AMATSUKAZE 145 sleepKill/1 150 TENCHIZAN 155 extraHit/3 160 KIKOKURANBU 162 DAIKAISHOU
    165 resistAilment/1 170 KAMIKAZE 175 fightSpirit/2 180 ROKUREN 185 extraHit/4 190 HAOUZAN
    195 MUGEN 200 METSUKYAKU`,
  skills: {},
  perks: {},
};
