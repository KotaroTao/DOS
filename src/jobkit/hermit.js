// 隠修士 (hermit) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
export default {
  table: `
    1 DIOS 2 KAMAITACHI 3 CURE 5 afterHeal/1 7 GENWAKU 10 KASUMIGAKURE
    15 poisonFloor/1 17 HOLYLIGHT 20 REGEN 22 WINDSTORM 25 selfPurify/1 30 KATINO
    35 fleetFoot/1 37 RAITEI 40 KASUMINOTOBARI 45 afterBoth/1 50 DIOSALL 55 KAGENUI
    60 vigilance/1 65 DIAL 70 afterHeal/2 72 TORNADO 75 purify/1 80 REVIVE
    85 KIYOME 90 poisonFloor/2 95 REGENALL 100 MADIOS 105 vigilance/2 110 SAINTRAY
    115 afterBoth/2 120 DIALALL 125 resistAilment/1 130 BLINDALL 135 sanctuary/1 140 IYASHINAMI
    142 GOURAI 145 afterHeal/3 150 DAISEIKITOU 155 scripture/1 160 RESURRECT 165 resistAilment/2
    170 SHINYU 172 RAIMEIRAN 175 mercy/1 180 DAIFUKUIN 185 martyr/1 190 SEIKOURETSU
    195 SEIMETSUKOU 200 FUKUIN`,
  skills: {},
  perks: {},
};
