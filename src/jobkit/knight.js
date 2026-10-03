// 騎士 (knight) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
export default {
  table: `
    1 SHIELDBASH 2 NERAIUCHI 3 taunt/1 5 CHOUHATSU 7 PROTECT 10 KOTE
    12 IWAKUDAKI 15 cover/1 20 NIOUDACHI 22 KOUJIN 25 counter/1 30 RYUURINJIN
    35 cover/2 40 JOUMON 45 bastion/1 50 SHINGANGEKI 55 IRONWALL 57 GANOTOSHI
    60 counter/2 65 SHIELDCHARGE 70 parry/1 75 endure/1 80 BOUJIN 82 SEIGEKI
    85 HANGEKI 90 resistAilment/1 95 SHUGOHOUKOU 100 JOUSAITSUKI 105 counter/3 107 YAMAKUZUSHI
    110 TEPPEKIJIN 115 cover/3 120 ZANTETSU 125 bastion/2 130 FURAKUNOTATE 135 parry/2
    140 BANRAI 145 bigBarrier/1 150 SHUGOKEKKAI 155 endure/2 160 JOUSAIKUZUSHI 162 DAICHIMEIDOU
    165 resistAilment/2 170 TESSAINAGI 175 bigBarrier/2 180 KISHIOU 185 holyCover/1 190 FUDOUJIN
    195 DAIGOUREI 200 FURAKUJOU`,
  skills: {},
  perks: {},
};
