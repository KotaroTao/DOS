// 戦士 (fighter) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
export default {
  table: `
    1 KYOUGEKI 2 NERAIUCHI 3 TATEWARI 5 extraHit/1 7 KAENGIRI 10 WARCRY
    12 IWAKUDAKI 15 fightSpirit/1 20 SHINGANGEKI 22 NAGIHARAI 25 vitalEye/1 30 HAISUI
    35 extraHit/2 40 KIKOKU 45 counter/1 50 GOUZAN 55 IATSU 57 GURENZAN
    60 fightSpirit/2 65 TAME 70 counter/2 75 zanshin/1 80 ZANTETSU 82 GANOTOSHI
    85 SANREN 90 vitalEye/2 95 DAISENPUU 100 YOROIDACHI 105 counter/3 107 GOUKADAN
    110 KISHINKA 115 extraHit/3 120 HADAN 125 parry/1 130 RANBU 135 fightSpirit/3
    140 AMATSUKAZE 145 endure/1 150 TENCHIZAN 155 parry/2 160 KIKOKURANBU 162 SHOUNETSURANBU
    165 endure/2 170 ROKUREN 175 resistAilment/1 180 YAMAKUZUSHI 185 extraHit/4 190 HAOUZAN
    195 fightSpirit/4 200 METSUKYAKU`,
  skills: {},
  perks: {},
};
