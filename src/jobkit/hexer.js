// 呪術師 (hexer) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
export default {
  table: `
    1 BLIND 2 SHADOWBOLT 3 NOROI 5 venomBlade/1 7 MARK_WATER 10 KATINO
    12 AQUAWAVE 15 gokudoku/1 20 MIWAKU 22 DARKMIST 25 afterMp/1 30 KYOURAN
    32 DARKBLAST 35 chant/1 40 DOKUGIRI 45 spellCrit/1 50 KEISEI 55 FUDOKU
    60 venomBlade/2 62 ICELANCE 65 ELEMBREAK 70 flinch/1 72 DARKNESS 75 afterMp/2
    80 DEATH 85 SEALALL 90 spellCrit/2 95 BLINDALL 100 MADALT 105 resistAilment/1
    110 HYORETSU 115 scan/1 120 GRAVITY 122 MEIKOKU 125 barrier/1 130 HYOUGA
    135 chant/2 140 DEATHALL 145 spellCrit/3 150 KOKUUHA 155 soulEater/1 160 GRAVIGA
    165 resistAilment/2 170 ZETTAIREIDO 175 soulLure/1 180 MEIANRAN 185 elemFloor/1 190 TENPENCHII
    195 MAGATSU 200 KYOKUDAI`,
  skills: {},
  perks: {},
};
