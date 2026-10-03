// 死霊術師 (necromancer) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
export default {
  table: `
    1 BLIND 2 SHADOWBOLT 3 NOROI 5 soulEater/1 7 KATINO 10 DIOS
    15 afterMp/1 20 KUGUTSU 22 DARKMIST 25 chant/1 30 KAGENUI 32 DARKBLAST
    35 spellCrit/1 40 MEIKONGURAI 45 soulLure/1 50 DEATH 55 FUDOKU 60 afterMp/2
    65 REVIVE 70 sleepKill/1 72 DARKNESS 75 spellCrit/2 80 SEALALL 85 GRAVITY
    90 venomBlade/1 95 KOKUUHA 100 DOKUGIRI 105 resistAilment/1 110 MADALT 115 barrier/1
    117 MEIKOKU 120 DEATHALL 125 soulLure/2 130 METEOR 135 chant/2 140 GRAVIGA
    145 spellCrit/3 150 GOKUENRAN 155 scan/1 160 RESURRECT 165 resistAilment/2 170 TENPENCHII
    172 MEIANRAN 175 elemFloor/1 180 MEIFUNOMON 185 reflect/1 190 ZETTAIREIDO 195 HYOUGA
    200 KYOKUDAI`,
  skills: {},
  perks: {},
};
