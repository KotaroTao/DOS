// 僧侶 (priest) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
export default {
  table: `
    1 DIOS 3 CURE 5 afterHeal/1 7 HOLYRAY 10 BLESS 15 selfPurify/1
    17 REGEN 20 DIOSALL 25 afterHeal/2 30 DIAL 35 chant/1 40 DIALALL
    45 purify/1 50 HOLYLIGHT 55 REVIVE 60 afterHeal/3 65 MADIOS 70 resistAilment/1
    75 sanctuary/1 80 RESURRECT 85 KIYOME 90 afterHeal/4 95 SHINYU 100 SEIBETSU
    105 chant/2 110 IYASHINAMI 115 scripture/1 120 REGENALL 125 resistAilment/2 130 SHINBATSU
    135 divineCounter/1 140 SEISUISHO 145 martyr/1 150 TENKEINOINORI 155 mercy/1 160 SEIMETSUKOU
    165 popePrayer/1 170 FUKUIN 175 holyCover/1 180 SEIKOURETSU 185 DAISEIKITOU 190 DAIFUKUIN
    195 bigBarrier/1 200 KAMIWAZA`,
  skills: {},
  perks: {},
};
