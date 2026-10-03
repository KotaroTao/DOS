// 魔法剣士 (spellblade) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
export default {
  table: `
    1 KYOUGEKI 2 MAKEN_FIRE 3 HALITO 4 MAKEN_EARTH 5 spellBlade/1 7 DOUBLE
    8 MAKEN_WIND 10 ICENEEDLE 12 MAKEN_WATER 15 chant/1 17 MAKEN_LIGHT 20 SHINGANGEKI
    22 MAKEN_DARK 25 spellCrit/1 30 ELEMBREAK 35 extraHit/1 40 MAENZAN 45 kenma/1
    50 GOUZAN 55 MAHALITO 57 GURENZAN 60 spellBlade/2 65 SEISHIN 70 vitalEye/1
    75 spellCrit/2 80 ZANTETSU 82 HYOUJIN 85 TORNADO 90 barrier/1 95 MADALT
    100 YOROIDACHI 105 twinArts/1 110 LAHALITO 115 fightSpirit/1 120 RAIJIN 125 resistAilment/1
    130 HADAN 135 extraHit/2 140 HYORETSU 145 spellCrit/3 150 TENCHIZAN 155 vitalEye/2
    160 ROKUDOU 165 fightSpirit/2 170 GOKUEN 175 barrier/2 180 HAOUZAN 185 elemFloor/1
    190 ZETTAIREIDO 195 METSUKYAKU 200 KYOKUDAI`,
  skills: {},
  perks: {},
};
