// 大司教 (archbishop) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
export default {
  table: `
    1 DIOS 3 CURE 5 afterHeal/1 7 HOLYRAY 10 BLESS 12 ICENEEDLE
    15 selfPurify/1 17 REGEN 20 DIOSALL 25 afterMp/1 30 DIAL 35 purify/1
    40 SEIKUNOKAGO 45 afterHeal/2 50 REVIVE 55 KIYOME 60 afterBoth/1 62 ICELANCE
    65 MADIOS 70 sanctuary/1 75 scripture/1 80 RESURRECT 85 DIALALL 90 afterHeal/3
    95 SHINYU 100 REGENALL 105 mercy/1 110 SEIBETSU 115 resistAilment/1 120 IYASHINAMI
    125 popePrayer/1 130 SHINBATSU 135 martyr/1 140 TENKEINOINORI 145 afterHeal/4 150 SEIKOURETSU
    155 holyCover/1 160 FUKUIN 165 resistAilment/2 170 SEIMETSUKOU 175 bigBarrier/1 180 DAIFUKUIN
    185 divineCounter/1 190 SEIMETSUREKKOU 195 SEISUISHO 200 KAMIWAZA`,
  skills: {},
  perks: {},
};
