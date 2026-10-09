// 暗殺者 (shadow) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
export default {
  // ランクのパッシブ: 魂がランク2で目覚め、3・4・5で強まる (souls.js の JOB_PASSIVES)
  awaken: "shadowHissatsu",
  table: `
    1 YAMIUCHI 2 YAMIBA 3 SHADOW_YADOKU 5 shadowIchishi/1 7 SHIPPUUGIRI 10 KAGEWATARI 10 dynamicVision/1
    12 YOIYAMIUCHI 15 SHADOW_KUBIKARI 15 stealthStep/1 20 KAGENUI 22 KOKUEINAGI 25 shadowDokugou/1 30 SHADOW_SESASHI
    35 shadowYain/1 40 SHINOKOKUIN 40 dynamicVision/2 45 shadowYamiTokeru/1 50 SHADOW_KURASASORI 50 stealthStep/2 55 SHADOW_KAGEITO 57 MEIJIN
    60 shadowDokugou/2 65 SHADOW_SAKUYA 70 shadowIchishi/2 75 shadowShinoNioi/1 80 SHADOW_TODOME 85 SHADOW_NODOBUE
    90 shadowYain/2 95 SHADOW_KAGEHAMI 100 SHADOW_TSUJIGIRI 100 stealthStep/3 100 dynamicVision/3 105 shadowYamiTokeru/2 107 SHADOW_TAMANUI 110 SHADOW_KAGEBUNSHIN
    115 shadowYain/3 120 SHADOW_SHINIGAMI 125 shadowDokugou/3 130 SHADOW_KOKUSENPUU 135 shadowShinoNioi/2 140 SHADOW_OBOROZUKI
    145 shadowYamiTokeru/3 150 SHADOW_GUFUU 155 shadowIchishi/3 160 SHADOW_SOUSOU 162 SHADOW_SHINENTOBARI 165 resistAilment/1
    170 SHADOW_DOKUGIRI 175 shadowShinoNioi/3 180 SHADOW_KAGEROKUDOU 185 shadowDokugou/4 190 MEIDOU 195 SHADOW_MAGAKAZE
    200 SHADOW_MUEI`,
  skills: {
    // Lv15 の固有技: 弱った獲物の首を音もなく刈る
    SHADOW_KUBIKARI: { name: "刈り取りの刃", mp: 5, kind: "phys", power: 1.2, critBonus: 0.1, execute: 2, target: "enemy", desc: "弱った獲物の首を音もなく刈る（とどめ・会心UP）" },
    SHADOW_YADOKU:       { name: "夜毒の針", mp: 3, kind: "phys", power: 0.8, acc: 0.4, poison: { chance: 0.8, pct: 0.05 }, target: "enemy", desc: "狙い澄ました毒針で蝕む（毎ターン5%）" },
    SHADOW_SESASHI:      { name: "背刺し", mp: 5, kind: "phys", power: 1.25, critBonus: 0.45, pierce: 0.3, target: "enemy", desc: "背後から鎧の隙を刺す（会心・貫通）" },
    SHADOW_KURASASORI:   { name: "黒蠍の尾", mp: 12, kind: "phys", power: 1.5, poison: { chance: 0.9, pct: 0.1 }, para: 0.2, target: "enemy", desc: "猛毒（毎ターン10%）を打ち、痺れさせることも" },
    SHADOW_KAGEITO:      { name: "影糸縛り", mp: 5, kind: "phys", power: 0.5, acc: 0.6, para: 0.45, debuff: { agi: 0.85 }, target: "enemy", desc: "影の糸で縛り、麻痺させ足も奪う" },
    SHADOW_SAKUYA:       { name: "朔夜三閃", mp: 14, kind: "phys", power: 0.95, hits: 3, agiScale: 0.4, critBonus: 0.2, element: "dark", target: "enemy", desc: "新月の闇から三度斬る（闇）" },
    SHADOW_TODOME:       { name: "止めの影刃", mp: 16, kind: "phys", power: 2.6, critBonus: 0.2, execute: 2.5, instakill: { chance: 0.12 }, target: "enemy", desc: "弱った敵を仕留める。命を絶つことも" },
    SHADOW_NODOBUE:      { name: "喉笛三刺", mp: 14, kind: "phys", power: 0.9, hits: 3, critBonus: 0.25, seal: { chance: 0.4, turns: 2 }, target: "enemy", desc: "喉笛を三度刺し、特技を封じる" },
    SHADOW_KAGEHAMI:     { name: "影喰み", mp: 22, kind: "phys", power: 4.0, agiScale: 1.4, critBonus: 0.35, element: "dark", drain: 0.1, target: "enemy", desc: "影から跳び、命をすする一突き（闇）" },
    SHADOW_TSUJIGIRI:    { name: "影の辻斬り", mp: 10, kind: "phys", power: 0.9, critBonus: 0.2, element: "dark", target: "all-enemy", desc: "影から現れ敵陣を斬り抜ける（闇）" },
    SHADOW_TAMANUI:      { name: "魂縫い", mp: 20, kind: "phys", power: 4.6, element: "dark", mpDrain: 0.2, vuln: { dark: 0.8 }, target: "enemy", desc: "魔力を奪い、闇への守りを崩す（闇）" },
    SHADOW_KAGEBUNSHIN:  { name: "影分身", mp: 18, kind: "phys", power: 0.9, scatter: 4, agiScale: 0.3, target: "all-enemy", desc: "影の分身が四度、敵へ襲いかかる" },
    SHADOW_SHINIGAMI:    { name: "死神の囁き", mp: 28, kind: "phys", power: 4.3, critBonus: 0.3, sleepChance: 0.35, instakill: { chance: 0.3 }, target: "enemy", desc: "眠りを囁き命を刈る。即死させることも" },
    SHADOW_KOKUSENPUU:   { name: "黒旋風", mp: 24, kind: "phys", power: 0.8, hits: 5, agiScale: 0.3, critBonus: 0.2, element: "wind", debuff: { agi: 0.85 }, target: "enemy", desc: "黒い旋風が五度刻み、足を鈍らせる（風）" },
    SHADOW_OBOROZUKI:    { name: "朧月夜", mp: 28, kind: "phys", power: 2.0, agiScale: 0.5, critBonus: 0.2, sleepChance: 0.2, target: "all-enemy", desc: "朧月の影が敵陣を斬り、眠りへ誘う" },
    SHADOW_GUFUU:        { name: "颶風穿ち", mp: 21, kind: "phys", power: 1.3, hits: 4, agiScale: 0.3, critBonus: 0.1, pierce: 0.3, element: "wind", target: "enemy", desc: "颶風のごとく四度穿つ（風・貫通）" },
    SHADOW_SOUSOU:       { name: "葬送の一刺", mp: 32, kind: "phys", power: 7.0, critBonus: 1, execute: 1.8, target: "enemy", desc: "必ず急所を貫き、弱った敵を葬る" },
    SHADOW_SHINENTOBARI: { name: "深淵の帳", mp: 27, kind: "phys", power: 2.1, element: "dark", debuff: { hit: 0.8 }, target: "all-enemy", desc: "闇の帳で敵陣を斬り、狙いを奪う（闇）" },
    SHADOW_DOKUGIRI:     { name: "毒霧の舞", mp: 22, kind: "phys", power: 1.5, critBonus: 0.1, poison: { chance: 0.6, pct: 0.05 }, target: "all-enemy", desc: "毒霧の中を舞い、敵陣を蝕む（5%）" },
    SHADOW_KAGEROKUDOU:  { name: "影六道", mp: 30, kind: "phys", power: 0.65, hits: 6, agiScale: 0.3, critBonus: 0.4, element: "dark", mpDrain: 0.1, target: "enemy", desc: "六つの影が刺し、魔力を啜る（闇）" },
    SHADOW_MAGAKAZE:     { name: "禍風", mp: 27, kind: "phys", power: 2.1, critBonus: 0.2, element: "wind", debuff: { vit: 0.85 }, target: "all-enemy", desc: "禍々しい風が敵陣を裂き、守りを削ぐ（風）" },
    SHADOW_MUEI:         { name: "無影", mp: 40, kind: "phys", power: 9.0, agiScale: 1.8, critBonus: 0.6, instakill: { chance: 0.25 }, target: "enemy", desc: "影すら残さぬ究極の一刺。即死もある" },
  },
  perks: {
    // 気付かれる前の一刺し: 無傷の獲物ほど急所を突きやすい
    shadowIchishi: {
      label: "闇よりの一刺",
      lv: ["HP90%以上の敵への物理会心+15%", "HP90%以上の敵への物理会心+22%", "HP90%以上の敵への物理会心+30%"],
      fx: [{ t: "crit", v: [0.15, 0.22, 0.3], when: { tgtHigh: 0.9 } }],
    },
    // 刃に毒を仕込み、毒に侵された敵をさらに追い詰める
    shadowDokugou: {
      label: "毒の調合",
      lv: ["物理が当たると10%で毒 (毎ターン5%)。状態異常の敵への与ダメ+5%", "物理で15%の毒 (5%)。状態異常の敵への与ダメ+8%",
        "物理で20%の毒 (5%)。状態異常の敵への与ダメ+11%", "物理で25%の毒 (5%)。状態異常の敵への与ダメ+14%"],
      fx: [
        { t: "hit", chance: [0.1, 0.15, 0.2, 0.25], on: "phys", ail: "poison", pct: 0.05 },
        { t: "deal", v: [0.05, 0.08, 0.11, 0.14], when: { tgtAil: true } },
      ],
    },
    // 弱った獲物を嗅ぎ分け、仕留めるたびに冴えていく
    shadowShinoNioi: {
      label: "死の匂い",
      lv: ["HP30%以下の敵への与ダメ+12%。倒すとAGI×1.1 (2ターン)", "HP30%以下の敵への与ダメ+18%。倒すとAGI×1.12",
        "HP30%以下の敵への与ダメ+24%。倒すとAGI×1.15", "HP30%以下の敵への与ダメ+30%。倒すとAGI×1.2"],
      fx: [
        { t: "deal", v: [0.12, 0.18, 0.24, 0.3], when: { tgtLow: 0.3 } },
        { t: "kill", buff: { agi: [1.1, 1.12, 1.15, 1.2] }, dur: 2 },
      ],
    },
    // 闇に溶けて刃をやり過ごす。後衛の暗がりではなお見えにくい
    shadowYamiTokeru: {
      label: "闇に溶ける",
      lv: ["敵の物理を4%でかわす (後衛なら+4%)", "敵の物理を7%でかわす (後衛なら+6%)", "敵の物理を10%でかわす (後衛なら+8%)"],
      fx: [
        { t: "evade", v: [0.04, 0.07, 0.1] },
        { t: "evade", v: [0.04, 0.06, 0.08], when: { back: true } },
      ],
    },
    // 戦いの始まりに夜陰を広げ、敵の狙いを奪う
    shadowYain: {
      label: "夜陰の帳",
      lv: ["戦闘開始時、敵全体の命中×0.94 (3ターン)", "戦闘開始時、敵全体の命中×0.9 (3ターン)", "戦闘開始時、敵全体の命中×0.86 (3ターン)"],
      fx: [{ t: "start", foe: { hit: [0.94, 0.9, 0.86] }, dur: 3 }],
    },
  },
};
