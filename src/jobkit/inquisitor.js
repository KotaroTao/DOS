// 審問官 (inquisitor) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
export default {
  table: `
    1 SHIELDBASH 2 KAENGIRI 3 DIOS 5 afterHeal/1 7 NERAIUCHI 10 SHINMON
    12 HALITO 15 taunt/1 20 KOTE 22 KAENNAGI 25 resistAilment/1 30 KAKEI
    32 MAHALITO 35 cover/1 40 DANZAINOTSUCHI 45 smite/1 50 JOUKA 55 DIOSALL
    57 GURENZAN 60 afterHeal/2 65 SHINGANGEKI 70 divineCounter/1 75 holyEdge/1 80 SAINTRAY
    85 IATSU 90 cover/2 95 SHINBATSU 100 ZANTETSU 105 resistAilment/2 107 GOUKADAN
    110 LAHALITO 115 sanctuary/1 120 HADAN 125 scripture/1 130 SEIKOURETSU 135 cover/3
    140 GOKUEN 145 martyr/1 150 TENCHIZAN 155 holyCover/1 160 SEIMETSUREKKOU 162 SHOUNETSURANBU
    165 bastion/1 170 HAOUZAN 175 bigBarrier/1 180 GOKUENRAN 185 purify/1 190 SAIGONOSHINPAN
    195 DAIFUKUIN 200 KAMIWAZA`,
  skills: {},
  perks: {},
};
