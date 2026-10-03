// 審問官 (inquisitor) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
export default {
  table: `
    1 SHIELDBASH 2 KAENGIRI 3 DIOS 5 afterHeal/1 7 NERAIUCHI 10 SHINMON
    12 INQUISITOR_SHOKUZAI 15 taunt/1 20 KOTE 22 KAENNAGI 25 resistAilment/1 30 KAKEI
    32 INQUISITOR_HAMON 35 cover/1 40 DANZAINOTSUCHI 45 smite/1 50 JOUKA 55 DIOSALL
    57 GURENZAN 60 afterHeal/2 65 SHINGANGEKI 70 divineCounter/1 75 holyEdge/1 80 SAINTRAY
    85 IATSU 90 cover/2 95 SHINBATSU 100 ZANTETSU 105 resistAilment/2 107 GOUKADAN
    110 INQUISITOR_ITANYAKI 115 sanctuary/1 120 HADAN 125 scripture/1 130 SEIKOURETSU 135 cover/3
    140 INQUISITOR_SHINKA 145 martyr/1 150 TENCHIZAN 155 holyCover/1 160 SEIMETSUREKKOU 162 SHOUNETSURANBU
    165 bastion/1 170 HAOUZAN 175 bigBarrier/1 180 INQUISITOR_GOUKASHINMON 185 purify/1 190 SAIGONOSHINPAN
    195 DAIFUKUIN 200 KAMIWAZA`,
  skills: {
    // 審問官は信仰の火で異端を焼く: 炎の呪文は INT と PIE の高い方で伸びる (faith)
    INQUISITOR_SHOKUZAI:     { name: "贖罪の火矢", mp: 2, kind: "atk", power: 10, element: "fire", faith: true, target: "enemy", desc: "罪を贖わせる火の矢（PIEでも伸びる）" },
    INQUISITOR_HAMON:        { name: "破門の炎", mp: 6, kind: "atk", power: 22, element: "fire", faith: true, target: "all-enemy", desc: "破門を告げる炎が敵全体を焼く（PIEでも伸びる）" },
    INQUISITOR_ITANYAKI:     { name: "異端焼き", mp: 11, kind: "atk", power: 36, element: "fire", faith: true, target: "enemy", desc: "異端の一体を灼熱で焼き尽くす（PIEでも伸びる）" },
    INQUISITOR_SHINKA:       { name: "神火の刑", mp: 20, kind: "atk", power: 64, element: "fire", faith: true, target: "enemy", desc: "神の火で一体を裁き焼く（PIEでも伸びる）" },
    INQUISITOR_GOUKASHINMON: { name: "業火審問", mp: 30, kind: "atk", power: 90, element: "fire", faith: true, target: "all-enemy", desc: "審問の業火が戦場を呑む（PIEでも伸びる）" },
  },
  perks: {},
};
