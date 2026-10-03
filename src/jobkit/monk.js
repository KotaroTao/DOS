// 武僧 (monk) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
export default {
  table: `
    1 KYOUGEKI 2 IWAKUDAKI 3 DIOS 5 afterHeal/1 7 NOUTEN 10 HAKKEI
    12 FUYUU 15 smite/1 20 TENKETSU 22 CHIRETSU 25 extraHit/1 30 SHINTOU
    35 endure/1 40 KONGOURENDA 45 afterHeal/2 50 KONGOUTAI 55 SHINGANGEKI 57 GANOTOSHI
    60 fightSpirit/1 65 DIOSALL 70 vitalEye/1 75 holyEdge/1 80 HOUKEN 82 FUUGA
    85 SANREN 90 extraHit/2 95 KISHINKA 100 HYAKURETSU 105 counter/1 107 YAMAKUZUSHI
    110 KIYOME 115 asceticism/1 120 MUSOUKEN 125 fightSpirit/2 130 RANBU 135 extraHit/3
    140 TENMAKEN 145 selfPurify/1 150 KAMIKAZE 155 resistAilment/1 160 ROKUREN 162 DAICHIMEIDOU
    165 scripture/1 170 KIKOKURANBU 175 counter/2 180 DIALALL 185 extraHit/4 190 IYASHINAMI
    195 MUGEN 200 KONGOUMUSOU`,
  skills: {},
  perks: {},
};
