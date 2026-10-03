// 守護騎士 (guardian) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
export default {
  table: `
    1 SHIELDBASH 2 NERAIUCHI 3 CHOUHATSU 5 taunt/1 7 IRONWALL 10 SUIGETSU
    12 IWAKUDAKI 15 counter/1 20 HANGEKI 22 CHIRETSU 25 bastion/1 30 NIOUDACHI
    35 cover/1 40 KOUBOUITTAI 45 endure/1 50 SHIELDCHARGE 55 GUARDALL 57 GANOTOSHI
    60 counter/2 65 SHINGANGEKI 70 parry/1 75 cover/2 80 BOUJIN 85 HYOUJIN
    90 bastion/2 95 SHUGOHOUKOU 100 JOUSAITSUKI 105 counter/3 107 YAMAKUZUSHI 110 OUJOU
    115 cover/3 120 ZANTETSU 125 parry/2 130 FURAKUNOTATE 135 resistAilment/1 140 BANRAI
    145 bigBarrier/1 150 SHUGOKEKKAI 155 endure/2 160 JOUSAIKUZUSHI 162 DAICHIMEIDOU 165 resistAilment/2
    170 TESSAINAGI 175 holyCover/1 180 FUDOUJIN 185 bigBarrier/2 190 DAIGOUREI 195 TENCHIZAN
    200 FURAKUJOU`,
  skills: {},
  perks: {},
};
