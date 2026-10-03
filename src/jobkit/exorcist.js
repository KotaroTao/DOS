// 祓魔師 (exorcist) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
export default {
  table: `
    1 HAJA 2 SUIGETSU 3 HOLYRAY 5 smite/1 7 KIYOMEMIZU 10 CURE
    12 KOUJIN 15 holyEdge/1 20 HARAI 22 UZUSHIO 25 ambushCrit/1 30 ASSASSINATE
    35 vitalEye/1 40 HAJANOTACHI 45 extraHit/1 50 TAIMA 55 SAINTRAY 57 HYOUJIN
    60 purify/1 65 TSUJIKAZE 70 initiative/1 75 parry/1 80 ZETSUEI 82 SEIGEKI
    85 KIYOME 90 vitalEye/2 95 KUBIHANE 100 SHINBATSU 105 extraHit/2 107 TOUGADAN
    110 SEALALL 115 sleepKill/1 120 SEIKOURETSU 125 parry/2 130 SENKOUZAN 135 extraHit/3
    140 SEIMETSUKOU 145 selfPurify/1 150 SHUNSATSU 155 resistAilment/1 160 HISSATSU 162 DAIKAISHOU
    165 zanshin/1 170 TAIMAJIN 175 resistAilment/2 180 MUGEN 185 extraHit/4 190 SEIMETSUREKKOU
    195 KOUBOURANBU 200 ZANSEI`,
  skills: {},
  perks: {},
};
