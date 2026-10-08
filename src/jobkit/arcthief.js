// 魔盗賊 (arcthief) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
export default {
  // ランクのパッシブ: 魂がランク2で目覚め、3・4・5で強まる (souls.js の JOB_PASSIVES)
  awaken: "arcthiefKaeshi",
  table: `
    1 STEAL 2 ARCTHIEF_KASUMEBA 3 HALITO 4 SHADOWBOLT 5 openSpell/1 7 ARCTHIEF_NUSUMIMI
    10 ARCTHIEF_YUMETORI 12 FUYUU 15 ARCTHIEF_KASUMEJUDAN 15 arcthiefGenei/1 20 SEAL 25 arcthiefSae/1 30 MAHALITO
    32 DARKBLAST 35 arcthiefSuritoru/1 40 MARYOKUGOUDATSU 45 arcthiefTeguse/1 50 ARCTHIEF_GENTOU 50 arcthiefGenei/2 55 DISPEL
    57 ARCTHIEF_MAREIJIN 60 arcthiefTeguse/2 65 ARCTHIEF_ENMAKU 70 arcthiefKarimono/1 72 ARCTHIEF_KAGEKUI 75 arcthiefSae/2
    80 ARCTHIEF_TOUSEI 85 ARCTHIEF_MASHU 90 arcthiefSuritoru/2 95 ARCTHIEF_KASUMERAI 100 MADALT 100 arcthiefGenei/3 105 arcthiefSurinuke/1
    110 ARCTHIEF_JUTSUAMI 115 arcthiefSuritoru/3 120 ARCTHIEF_MANAWA 122 ARCTHIEF_TAMANUKI 125 arcthiefKarimono/2 130 ARCTHIEF_NUSUMISHIMO
    135 arcthiefSae/3 140 ARCTHIEF_KAGENUKE 145 arcthiefTeguse/3 150 ARCTHIEF_NUSUMIARASHI 155 resistAilment/1 160 ARCTHIEF_NUSUMIBI
    165 arcthiefSuritoru/4 170 ARCTHIEF_TAMANUSUMI 175 arcthiefSurinuke/2 180 ARCTHIEF_TOUTENSEKI 185 arcthiefSae/4 190 ARCTHIEF_MAKUHIKI
    195 ARCTHIEF_DATSUENRAN 200 ARCTHIEF_BANSHOU`,
  skills: {
    // Lv15 の固有技: 闇の呪弾で撃ち、魔力をかすめ取る
    ARCTHIEF_KASUMEJUDAN: { name: "かすめ呪弾", mp: 5, kind: "atk", power: 16, element: "dark", mpDrain: 0.2, target: "enemy", desc: "闇の呪弾で撃ち、敵の魔力をかすめ取る" },
    // INT でも伸びる魔刃 (共通の冥刃は STR だけで伸び、INT型の魔盗賊に合わない)
    ARCTHIEF_MAREIJIN:   { name: "魔霊刃", mp: 10, kind: "phys", power: 1.7, intScale: 0.5, element: "dark", mpDrain: 0.2, target: "enemy", desc: "魔力をまとった冥い刃で斬り、魔力を奪う（INTでも伸びる）" },
    ARCTHIEF_KASUMEBA:     { name: "かすめ魔刃", mp: 4, kind: "phys", power: 1.1, intScale: 0.5, element: "dark", mpDrain: 0.2, target: "enemy", desc: "闇の刃で斬り、魔力をかすめ取る（闇）" },
    ARCTHIEF_NUSUMIMI:     { name: "盗み見", mp: 3, kind: "debuff", vuln: { all: 0.85 }, target: "enemy", desc: "術式を盗み見て、全属性の守りを崩す" },
    ARCTHIEF_YUMETORI:     { name: "夢盗り", mp: 3, kind: "debuff", sleepChance: 0.75, strip: true, target: "enemy", desc: "眠りに誘い、その隙に強化を盗む" },
    ARCTHIEF_GENTOU:       { name: "幻灯", mp: 4, kind: "debuff", confuse: 0.55, debuff: { hit: 0.85 }, target: "enemy", desc: "幻灯で惑わせ、混乱させ狙いも乱す" },
    ARCTHIEF_ENMAKU:       { name: "魔の煙幕", mp: 8, kind: "debuff", debuff: { agi: 0.8, hit: 0.9 }, target: "all-enemy", desc: "魔の煙幕で敵全体の足と狙いを乱す" },
    ARCTHIEF_KAGEKUI:      { name: "影喰い", mp: 12, kind: "atk", power: 33, element: "dark", mpDrain: 0.1, target: "all-enemy", desc: "影が敵陣を呑み、魔力を啜る（闇）" },
    ARCTHIEF_TOUSEI:       { name: "盗星", mp: 22, kind: "atk", power: 58, strip: true, target: "all-enemy", desc: "盗んだ星を降らせ、強化を剥ぐ" },
    ARCTHIEF_MASHU:        { name: "魔手の一刺し", mp: 5, kind: "phys", power: 1.2, intScale: 0.4, critBonus: 0.4, target: "enemy", desc: "魔力を込めた指先で急所を刺す" },
    ARCTHIEF_KASUMERAI:    { name: "かすめ雷", mp: 9, kind: "atk", power: 25, element: "wind", para: 0.2, debuff: { agi: 0.85 }, target: "enemy", desc: "かすめ取った雷で撃ち、痺れさせる（風）" },
    ARCTHIEF_JUTSUAMI:     { name: "術封じの網", mp: 11, kind: "debuff", seal: { chance: 0.5, turns: 3 }, strip: true, target: "all-enemy", desc: "術を絡め取る網で、強化と特技を奪う" },
    ARCTHIEF_MANAWA:       { name: "魔縄締め", mp: 16, kind: "phys", power: 2.6, intScale: 0.4, execute: 2.5, target: "enemy", desc: "魔の縄で弱った敵を締め上げる（とどめ）" },
    ARCTHIEF_TAMANUKI:     { name: "魂抜き", mp: 21, kind: "atk", power: 60, element: "dark", seal: { chance: 0.5, turns: 3 }, target: "enemy", desc: "魂をかすめ取り、特技を封じる（闇）" },
    ARCTHIEF_NUSUMISHIMO:  { name: "盗み霜", mp: 14, kind: "atk", power: 37, element: "water", sleepChance: 0.25, target: "enemy", desc: "盗んだ冷気で貫き、凍え眠らせる（水）" },
    ARCTHIEF_KAGENUKE:     { name: "影抜け", mp: 22, kind: "phys", power: 4.0, agiScale: 1.0, intScale: 0.6, critBonus: 0.3, element: "wind", target: "enemy", desc: "影を抜け、風の魔刃で刺す（風）" },
    ARCTHIEF_NUSUMIARASHI: { name: "盗み嵐", mp: 16, kind: "atk", power: 42, element: "wind", debuff: { hit: 0.85 }, target: "all-enemy", desc: "盗んだ嵐が敵陣を裂き、狙いを乱す（風）" },
    ARCTHIEF_NUSUMIBI:     { name: "盗み火", mp: 20, kind: "atk", power: 58, element: "fire", vuln: { fire: 0.8 }, target: "enemy", desc: "盗んだ業火で焼き、火への守りを崩す（火）" },
    ARCTHIEF_TAMANUSUMI:   { name: "魂盗み", mp: 28, kind: "phys", power: 3.0, intScale: 0.5, critBonus: 0.4, mpDrain: 0.2, instakill: { chance: 0.3 }, target: "enemy", desc: "命と魔力を盗み取る。即死させることも（INTでも伸びる）" },
    ARCTHIEF_TOUTENSEKI:   { name: "盗天の隕石", mp: 26, kind: "atk", power: 74, element: "earth", flinchChance: 0.25, target: "all-enemy", desc: "盗んだ天の石を降らせ、怯ませる（土）" },
    ARCTHIEF_MAKUHIKI:     { name: "怪盗の幕引き", mp: 32, kind: "phys", power: 7.0, intScale: 0.5, critBonus: 0.4, execute: 2, element: "dark", target: "enemy", desc: "魔を帯びた刃で弱った敵を葬る（闇）" },
    ARCTHIEF_DATSUENRAN:   { name: "奪焔嵐", mp: 30, kind: "atk", power: 84, element: "fire", debuff: { vit: 0.85 }, target: "all-enemy", desc: "奪った業火の嵐で敵陣の守りを焼く（火）" },
    ARCTHIEF_BANSHOU:      { name: "万象盗り", mp: 44, kind: "atk", power: 130, mpDrain: 0.1, strip: true, target: "all-enemy", desc: "万象の理を盗み、敵陣を消し去る" },
  },
  perks: {
    // Lv15 の目玉パッシブ: 幻を残して身を翻す
    arcthiefGenei: {
      label: "幻影歩法",
      lv: ["敵の物理を10%でかわす", "敵の物理を15%でかわす", "敵の物理を20%でかわす"],
      fx: [{ t: "evade", v: [0.10, 0.15, 0.20] }],
    },
    // 盗んだ術は懐が痛まない
    arcthiefKarimono: {
      label: "借り物の術",
      lv: ["攻撃呪文を唱えた後、15%で消費MPが戻る", "攻撃呪文を唱えた後、25%で消費MPが戻る", "攻撃呪文を唱えた後、35%で消費MPが戻る"],
      fx: [{ t: "cast", on: "atk", chance: [0.15, 0.25, 0.35], refund: true }],
    },
    // 討ち取った敵に残る魔力を、すかさず懐に入れる (ユーザーの指示、2026-10: 特技封じを外し、MP回復だけに)
    arcthiefSuritoru: {
      label: "討ち取りの魔力",
      lv: ["敵を倒すとMP3%回復", "敵を倒すとMP5%回復", "敵を倒すとMP7%回復", "敵を倒すとMP10%回復"],
      fx: [{ t: "kill", mp: [0.03, 0.05, 0.07, 0.10] }],
    },
    // 眠り・混乱で隙だらけの相手に盗んだ術を叩き込む
    arcthiefSae: {
      label: "盗術の冴え",
      lv: ["状態異常・怯み中の敵への攻撃呪文+12%", "状態異常・怯み中の敵への攻撃呪文+18%", "状態異常・怯み中の敵への攻撃呪文+24%", "状態異常・怯み中の敵への攻撃呪文+30%"],
      fx: [{ t: "deal", v: [0.12, 0.18, 0.24, 0.3], on: "spell", when: { tgtAil: true } }],
    },
    // 開戦と同時に手を伸ばす
    arcthiefTeguse: {
      label: "先手の手癖",
      lv: ["戦闘開始時、AGI×1.15 (2ターン) とMP4%回復", "戦闘開始時、AGI×1.2 (2ターン) とMP6%回復", "戦闘開始時、AGI×1.25 (2ターン) とMP8%回復"],
      fx: [{ t: "start", buff: { agi: [1.15, 1.2, 1.25] }, mp: [0.04, 0.06, 0.08], dur: 2 }],
    },
    // 刃をすり抜け、ついでに魔力をかすめる
    arcthiefSurinuke: {
      label: "すり抜け",
      lv: ["敵の物理を5%でかわす。物理を受けると30%でMP3%回復", "敵の物理を8%でかわす。物理を受けると30%でMP5%回復"],
      fx: [
        { t: "evade", v: [0.05, 0.08] },
        { t: "hurt", chance: 0.3, mp: [0.03, 0.05] },
      ],
    },
  },
};
