// 竜騎士 (dragonknight) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
export default {
  table: `
    1 SHIELDBASH 2 SHIPPUUGIRI 3 NERAIUCHI 5 taunt/1 7 TENSHOU 10 CHOUHATSU
    12 KAENGIRI 15 barrier/1 20 RYUURIN 22 REPPUU 25 counter/1 30 RYUUKOU
    35 endure/1 40 RYUZETSU 45 fightSpirit/1 50 SHINGANGEKI 55 RYUUEN 57 FUUGA
    60 cover/1 65 NIOUDACHI 70 barrier/2 75 vitalEye/1 80 ZANTETSU 82 GURENZAN
    85 BOUJIN 90 resistAilment/1 95 YOROIDACHI 100 JOUSAITSUKI 105 counter/2 107 KAMIKAZE
    110 HADAN 115 endure/2 120 TENCHIZAN 125 bastion/1 130 BANRAI 135 fightSpirit/2
    140 RYUUJINKOURIN 145 resistAilment/2 150 FUDOUJIN 155 bigBarrier/1 160 DAISENPUU 162 TENRAN
    165 counter/3 170 HAOUZAN 175 holyCover/1 180 KIKOKURANBU 185 parry/1 190 SHOUNETSURANBU
    195 OUJOU 200 RYUUTEIGEKI`,
  skills: {},
  perks: {},
};
