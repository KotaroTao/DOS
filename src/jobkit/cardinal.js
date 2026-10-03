// 枢機卿 (cardinal) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
export default {
  table: `
    1 DIOS 3 CURE 5 afterHeal/1 7 HOLYRAY 10 PROTECT 15 selfPurify/1
    17 REGEN 20 DIOSALL 25 afterMp/1 30 DIAL 35 purify/1 40 DAISEIKITOU
    45 afterHeal/2 50 REVIVE 55 KIYOME 60 popePrayer/1 65 MADIOS 70 afterBoth/1
    75 sanctuary/1 80 REGENALL 85 RESURRECT 90 afterHeal/3 95 SHINYU 100 IYASHINAMI
    105 mercy/1 110 SEIBETSU 115 scripture/1 120 TENKEINOINORI 125 martyr/1 130 SHINBATSU
    135 resistAilment/1 140 FUKUIN 145 afterHeal/4 150 SEISUISHO 155 holyCover/1 160 SEIMETSUKOU
    165 resistAilment/2 170 DAIFUKUIN 175 divineCounter/1 180 SEIMETSUREKKOU 185 bigBarrier/1 190 SEIKOURETSU
    195 KYOUKOUNOSHUKUFUKU 200 KAMIWAZA`,
  skills: {},
  perks: {},
};
