// 聖騎士 (paladin) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
export default {
  table: `
    1 SHIELDBASH 2 KOUJIN 3 DIOS 5 afterHeal/1 7 HAJA 10 NERAIUCHI
    12 IWAKUDAKI 15 cover/1 17 HOLYLIGHT 20 CHOUHATSU 22 KOURINZAN 25 taunt/1
    30 SEINOTATE 35 smite/1 40 SEIKOUZAN 45 cover/2 50 SHINGANGEKI 55 GUARDALL
    57 SEIGEKI 60 afterHeal/2 65 DIOSALL 70 holyEdge/1 75 martyr/1 80 BOUJIN
    85 SAINTRAY 90 resistAilment/1 95 SEIBETSU 100 JOUSAITSUKI 105 cover/3 107 TENKOUKEN
    110 TEPPEKIJIN 115 sanctuary/1 120 SHINBATSU 125 divineCounter/1 130 FURAKUNOTATE 135 resistAilment/2
    140 DAIFUKUIN 145 scripture/1 150 KISHIOU 155 holyCover/1 160 SEIKOURETSU 165 bastion/1
    170 FUDOUJIN 175 bigBarrier/1 180 DAIGOUREI 185 parry/1 190 SEIMETSUREKKOU 195 KAMIWAZA
    200 FURAKUJOU`,
  skills: {},
  perks: {},
};
