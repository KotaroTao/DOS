// 神殿騎士 (templar) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
export default {
  table: `
    1 SHIELDBASH 2 KOUJIN 3 CURE 5 taunt/1 7 CHOUHATSU 10 PROTECT
    12 NERAIUCHI 15 afterHeal/1 17 HOLYLIGHT 20 FUUMANOTATE 25 cover/1 30 NIOUDACHI
    35 selfPurify/1 40 SEIIKINOKANE 45 cover/2 50 DIOSALL 55 SHINGANGEKI 57 SEIGEKI
    60 sanctuary/1 65 GUARDALL 70 resistAilment/1 75 holyEdge/1 80 KIYOME 82 GANOTOSHI
    85 SAINTRAY 90 cover/3 95 HANGEKI 100 JOUSAITSUKI 105 divineCounter/1 110 TEPPEKIJIN
    115 martyr/1 120 SHINBATSU 125 bastion/1 130 FURAKUNOTATE 135 resistAilment/2 140 DAIFUKUIN
    145 scripture/1 150 SHUGOKEKKAI 155 holyCover/1 160 KISHIOU 162 KOUBOURANBU 165 bigBarrier/1
    170 FUDOUJIN 175 purify/1 180 DAIGOUREI 185 bigBarrier/2 190 SEIMETSUREKKOU 195 KAMIWAZA
    200 FURAKUJOU`,
  skills: {},
  perks: {},
};
