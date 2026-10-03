// 隠修士 (hermit) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
export default {
  table: `
    1 DIOS 2 HERMIT_SEIFUU 3 CURE 5 afterHeal/1 7 GENWAKU 10 KASUMIGAKURE
    15 poisonFloor/1 17 HOLYLIGHT 20 REGEN 22 HERMIT_KAZEHAFURI 25 selfPurify/1 30 KATINO
    35 fleetFoot/1 37 HERMIT_RAIKOU 40 KASUMINOTOBARI 45 afterBoth/1 50 DIOSALL 55 KAGENUI
    60 vigilance/1 65 DIAL 70 afterHeal/2 72 HERMIT_TATSUMAKI 75 purify/1 80 REVIVE
    85 KIYOME 90 poisonFloor/2 95 REGENALL 100 MADIOS 105 vigilance/2 110 SAINTRAY
    115 afterBoth/2 120 DIALALL 125 resistAilment/1 130 BLINDALL 135 sanctuary/1 140 IYASHINAMI
    142 HERMIT_KAMINARI 145 afterHeal/3 150 DAISEIKITOU 155 scripture/1 160 RESURRECT 165 resistAilment/2
    170 SHINYU 172 HERMIT_RAIUN 175 mercy/1 180 DAIFUKUIN 185 martyr/1 190 SEIKOURETSU
    195 SEIMETSUKOU 200 FUKUIN`,
  skills: {
    // 隠修士は祈りの風を操る: 風の呪文は INT と PIE の高い方で伸びる (faith)
    HERMIT_SEIFUU:     { name: "清風の祈り", mp: 4, kind: "atk", power: 17, element: "wind", faith: true, target: "enemy", desc: "祈りを乗せた清らかな風の刃（PIEでも伸びる）" },
    HERMIT_KAZEHAFURI: { name: "風祝", mp: 6, kind: "atk", power: 20, element: "wind", faith: true, target: "all-enemy", desc: "風の神への祈りが敵全体を吹き払う（PIEでも伸びる）" },
    HERMIT_RAIKOU:     { name: "雷光の託宣", mp: 9, kind: "atk", power: 28, element: "wind", para: 0.25, faith: true, target: "enemy", desc: "託宣の雷光で撃ち、痺れさせる（PIEでも伸びる）" },
    HERMIT_TATSUMAKI:  { name: "天つ竜巻", mp: 10, kind: "atk", power: 34, element: "wind", faith: true, target: "all-enemy", desc: "天より降ろした竜巻が敵全体を巻き上げる（PIEでも伸びる）" },
    HERMIT_KAMINARI:   { name: "神鳴り", mp: 24, kind: "atk", power: 76, element: "wind", para: 0.3, faith: true, target: "enemy", desc: "神の怒りの雷で撃ち、痺れさせる（PIEでも伸びる）" },
    HERMIT_RAIUN:      { name: "雷雲の祈祷", mp: 22, kind: "atk", power: 64, element: "wind", para: 0.15, faith: true, target: "all-enemy", desc: "祈祷で呼んだ雷雲が戦場を打つ。痺れさせることがある（PIEでも伸びる）" },
  },
  perks: {},
};
