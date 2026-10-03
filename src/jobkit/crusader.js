// 聖戦士 (crusader) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
export default {
  table: `
    1 KYOUGEKI 2 KOUJIN 3 HOLYRAY 5 smite/1 7 NERAIUCHI 10 BLESS
    12 KAENGIRI 15 afterHeal/1 20 HAJA 22 KOURINZAN 25 holyEdge/1 30 SEISEN
    35 extraHit/1 40 JUUJIZAN 45 vitalEye/1 50 JOUKA 55 SHINGANGEKI 57 SEIGEKI
    60 afterHeal/2 65 SAINTRAY 70 fightSpirit/1 75 counter/1 80 GOUZAN 82 GURENZAN
    85 REVIVE 90 resistAilment/1 95 DAISENPUU 100 SHINBATSU 105 extraHit/2 107 TENKOUKEN
    110 ZANTETSU 115 sanctuary/1 120 HADAN 125 martyr/1 130 KISHINKA 135 scripture/1
    140 SEIKOURETSU 145 resistAilment/2 150 TENCHIZAN 155 holyCover/1 160 SEIMETSUREKKOU 162 KOUBOURANBU
    165 fightSpirit/2 170 HAOUZAN 175 divineCounter/1 180 DAIFUKUIN 185 extraHit/3 190 KIKOKURANBU
    195 KAMIWAZA 200 METSUKYAKU`,
  skills: {},
  perks: {},
};
