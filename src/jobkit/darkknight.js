// 魔騎士 (darkknight) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
export default {
  table: `
    1 SHIELDBASH 2 YAMIBA 3 NERAIUCHI 5 barrier/1 7 ANKOKU 10 SHADOWBOLT
    12 CHOUHATSU 15 cover/1 20 KYUUKETSU 22 KOKUEINAGI 25 counter/1 30 YAMINOKOROMO
    32 DARKBLAST 35 taunt/1 40 MAGUINOTACHI 45 barrier/2 50 IATSU 55 JUBAKU
    57 MEIJIN 60 reflect/1 65 SHINGANGEKI 70 fightSpirit/1 75 resistAilment/1 80 HANGEKI
    85 DARKNESS 90 counter/2 95 ZANTETSU 100 GOUKADAN 105 bastion/1 107 MEIFUZAN
    110 KOKUUHA 115 soulEater/1 120 HADAN 125 endure/1 130 FUDOUJIN 135 fightSpirit/2
    140 MEIKOKU 145 resistAilment/2 150 TENCHIZAN 155 counter/3 160 ANKOKUSHUUEN 162 TOKOYAMI
    165 bigBarrier/1 170 GOKUENRAN 175 holyCover/1 180 HAOUZAN 185 endure/2 190 MEIANRAN
    195 BANRAI 200 METSUKYAKU`,
  skills: {},
  perks: {},
};
