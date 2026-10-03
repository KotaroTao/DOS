// 護教官 (chaplain) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
export default {
  table: `
    1 SHIELDBASH 2 KOUJIN 3 CURE 5 cover/1 7 CHOUHATSU 10 PROTECT
    12 SUIGETSU 15 taunt/1 17 HOLYLIGHT 20 NIOUDACHI 25 barrier/1 30 GUARDALL
    35 afterHeal/1 40 HOUSHOUHEKI 45 cover/2 50 SHINGANGEKI 55 KIYOME 57 SEIGEKI
    60 resistAilment/1 65 HANGEKI 70 holyEdge/1 75 bastion/1 80 BOUJIN 82 HYOUJIN
    85 SAINTRAY 90 cover/3 95 SEIBETSU 100 JOUSAITSUKI 105 sanctuary/1 107 TENKOUKEN
    110 TEPPEKIJIN 115 martyr/1 120 SHINBATSU 125 divineCounter/1 130 FURAKUNOTATE 135 resistAilment/2
    140 DAIFUKUIN 145 holyCover/1 150 SHUGOKEKKAI 155 scripture/1 160 KISHIOU 165 bigBarrier/1
    170 FUDOUJIN 175 purify/1 180 DAIGOUREI 185 bigBarrier/2 190 SEIMETSUREKKOU 195 KAMIWAZA
    200 FURAKUJOU`,
  skills: {},
  perks: {},
};
