// 狂戦士 (berserker) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
export default {
  table: `
    1 KYOUGEKI 2 KAENGIRI 3 NERAIUCHI 5 counter/1 7 SUTEMI 10 HAISUI
    12 YAMIBA 15 fightSpirit/1 20 IATSU 22 KAENNAGI 25 extraHit/1 30 CHINOKAWAKI
    35 vitalEye/1 40 KIJINKUDAKI 45 fightSpirit/2 50 GOUZAN 55 SHINGANGEKI 57 GURENZAN
    60 counter/2 65 TAME 70 extraHit/2 75 endure/1 80 ZANTETSU 82 MEIJIN
    85 MIDARE 90 fightSpirit/3 95 KISHINKA 100 YOROIDACHI 105 counter/3 107 GOUKADAN
    110 SHURAZAN 115 extraHit/3 120 HADAN 125 vitalEye/2 130 DAISENPUU 135 asceticism/1
    140 MEIFUZAN 145 resistAilment/1 150 TENCHIZAN 155 fightSpirit/4 160 KIKOKURANBU 162 SHOUNETSURANBU
    165 endure/2 170 RANBU 175 zanshin/1 180 TOKOYAMI 185 extraHit/4 190 HAOUZAN
    195 ROKUREN 200 METSUKYAKU`,
  skills: {},
  perks: {},
};
