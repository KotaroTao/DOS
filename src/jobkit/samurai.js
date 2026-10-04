// 侍 (samurai) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
// 侍 = 居合と見切り・一太刀。抜き打ち (AGI・会心)、鎬の受け、介錯 (とどめ)、乱れ斬り (scatter)
export default {
  // 覚醒のパッシブ: 魂がランク2に上がると目覚める (以前の Lv15 のパッシブ)
  awaken: "samuraiShingan/1",
  table: `
    1 KYOUGEKI 2 SUIGETSU 3 GONOSEN 5 iai/1 7 DOUBLE 10 SAMURAI_SAYABASHIRI
    12 SHIPPUUGIRI 15 SAMURAI_ZANGETSUGAESHI 15 samuraiHomare/1 20 ISSEN 22 UZUSHIO 25 samuraiNukimi/1 30 MEIKYOU
    35 initiative/1 40 TSUBAMEGAESHI 45 samuraiChiburi/1 50 SAMURAI_OBOROZUKI 50 samuraiHomare/2 55 SAMURAI_SHINOGI 57 HYOUJIN
    60 zanshin/1 65 SAMURAI_RYUUSUI 70 samuraiShingan/2 75 samuraiNukimi/2 80 SAMURAI_ITTOU 82 FUUGA
    85 SAMURAI_SAMIDARE 90 samuraiMinegaeshi/1 95 SAMURAI_KAISHAKU 100 SAMURAI_ZANGETSU 100 samuraiHomare/3 105 samuraiIkkiuchi/1 107 TOUGADAN
    110 SAMURAI_SHIDEN 115 samuraiChiburi/2 120 SAMURAI_MUNEN 125 samuraiMinegaeshi/2 130 SAMURAI_HANAFUBUKI 135 samuraiIkkiuchi/2
    140 SAMURAI_GUFUU 145 samuraiShingan/3 150 SAMURAI_UNYOU 155 samuraiChiburi/3 160 SAMURAI_HAPPOU 162 DAIKAISHOU
    165 resistAilment/1 170 SAMURAI_NOWAKI 175 samuraiIkkiuchi/3 180 SAMURAI_RIKKA 185 samuraiNukimi/3 190 SAMURAI_GEKKA
    195 SAMURAI_KOCHOU 200 SAMURAI_MUKYUU`,
  skills: {
    // Lv15 (覚醒のパッシブが抜けた段): 月を描く返し刃。会心と足止めを兼ねる
    SAMURAI_ZANGETSUGAESHI: { name: "月返し", mp: 5, kind: "phys", power: 1.2, critBonus: 0.25, agiScale: 0.3, debuff: { agi: 0.85 }, target: "enemy", desc: "月を描く返し刃。会心しやすく、敵の足を鈍らせる" },
    SAMURAI_SAYABASHIRI: { name: "鞘走り", mp: 4, kind: "phys", power: 0.95, agiScale: 0.45, critBonus: 0.15, target: "enemy", desc: "鞘走る抜き打ち。素早さで伸び会心しやすい" },
    SAMURAI_OBOROZUKI: { name: "朧月", mp: 10, kind: "phys", power: 0.85, agiScale: 0.25, debuff: { agi: 0.85 }, target: "all-enemy", desc: "朧の弧を描く抜刀で敵陣の足を鈍らせる" },
    SAMURAI_SHINOGI: { name: "鎬削り", mp: 4, kind: "phys", power: 1.15, acc: 0.4, debuff: { hit: 0.8 }, target: "enemy", desc: "鎬で刃を受け流し、敵の狙いを乱す" },
    SAMURAI_RYUUSUI: { name: "流水三段", mp: 14, kind: "phys", power: 0.95, hits: 3, agiScale: 0.4, acc: 0.3, critBonus: 0.15, target: "enemy", desc: "流れる水のごとく三度斬る（命中UP）" },
    SAMURAI_ITTOU: { name: "一刀両断", mp: 16, kind: "phys", power: 3.6, pierce: 0.5, acc: 0.6, critBonus: 0.2, target: "enemy", desc: "抜き打ちの一刀で鎧ごと両断する" },
    SAMURAI_SAMIDARE: { name: "五月雨斬り", mp: 10, kind: "phys", power: 0.75, scatter: 4, acc: 0.4, target: "all-enemy", desc: "五月雨のごとく、敵へ4度斬りかかる" },
    SAMURAI_KAISHAKU: { name: "介錯", mp: 16, kind: "phys", power: 2.8, execute: 2.8, acc: 0.6, target: "enemy", desc: "弱った敵を介錯する（とどめ・命中UP）" },
    SAMURAI_ZANGETSU: { name: "残月", mp: 13, kind: "phys", power: 2.6, acc: 0.9, seal: { chance: 0.5, turns: 2 }, target: "enemy", desc: "残る月光の一太刀。特技を封じる" },
    SAMURAI_SHIDEN: { name: "紫電一閃", mp: 22, kind: "phys", power: 4.2, agiScale: 1.5, critBonus: 0.5, target: "enemy", desc: "紫電の抜刀。素早さで大きく伸びる" },
    SAMURAI_MUNEN: { name: "無念無想", mp: 24, kind: "phys", power: 5.6, acc: 1, pierce: 0.2, target: "enemy", desc: "無心の一刀は外れず、鎧も徹る" },
    SAMURAI_HANAFUBUKI: { name: "花吹雪", mp: 16, kind: "phys", power: 0.8, hits: 4, acc: 0.5, debuff: { agi: 0.8 }, target: "enemy", desc: "花吹雪の四連斬。素早さを奪う" },
    SAMURAI_GUFUU: { name: "颶風抜刀", mp: 22, kind: "phys", power: 2.0, agiScale: 0.3, acc: 0.6, target: "all-enemy", desc: "颶風の抜刀で敵全体を斬り抜ける" },
    SAMURAI_UNYOU: { name: "雲耀", mp: 28, kind: "phys", power: 7.0, acc: 1, pierce: 0.4, critBonus: 0.15, target: "enemy", desc: "稲妻より速い必中の振り下ろし" },
    SAMURAI_HAPPOU: { name: "八方斬り", mp: 30, kind: "phys", power: 2.8, acc: 0.9, flinchChance: 0.2, target: "all-enemy", desc: "八方の敵を斬り伏せ、怯ませる" },
    SAMURAI_NOWAKI: { name: "野分斬り", mp: 21, kind: "phys", power: 1.3, hits: 4, agiScale: 0.35, critBonus: 0.1, element: "wind", vuln: { wind: 0.85 }, target: "enemy", desc: "野分の風の四連斬。風の守りを裂く" },
    SAMURAI_RIKKA: { name: "六花", mp: 24, kind: "phys", power: 0.7, hits: 6, acc: 0.6, vuln: { water: 0.85 }, target: "enemy", desc: "凍てつく六閃。水の守りを裂く" },
    SAMURAI_GEKKA: { name: "月下一閃", mp: 32, kind: "phys", power: 7.0, acc: 1, critBonus: 0.4, target: "enemy", desc: "月下の必中の抜刀。会心しやすい" },
    SAMURAI_KOCHOU: { name: "胡蝶の夢", mp: 30, kind: "phys", power: 0.6, scatter: 7, agiScale: 0.3, critBonus: 0.4, target: "all-enemy", desc: "夢幻の七閃が敵陣を舞う" },
    SAMURAI_MUKYUU: { name: "一閃無窮", mp: 40, kind: "phys", power: 9.5, acc: 1, pierce: 1, critBonus: 0.3, target: "enemy", desc: "必中・防御無視の終の抜刀" },
  },
  perks: {
    // Lv15 の目玉パッシブ: 強敵との一騎打ちに燃える
    samuraiHomare: {
      label: "一騎の誉れ",
      lv: ["精鋭・主のいる戦闘で与ダメージ+10%", "精鋭・主のいる戦闘で与ダメージ+15%", "精鋭・主のいる戦闘で与ダメージ+20%"],
      fx: [{ t: "deal", when: { eliteFight: true }, v: [0.10, 0.15, 0.20] }],
    },
    // 心眼で太刀筋を読み、刃をかわす
    samuraiShingan: {
      label: "心眼の見切り",
      lv: ["敵の物理を6%でかわす", "敵の物理を10%でかわす", "敵の物理を14%でかわす"],
      fx: [{ t: "evade", v: [0.06, 0.1, 0.14] }],
    },
    // 鞘から抜いた最初の刃が最も鋭い
    samuraiNukimi: {
      label: "抜き身の心得",
      lv: ["1ラウンド目の物理の会心率+15%", "1ラウンド目の物理の会心率+22%", "1ラウンド目の物理の会心率+30%"],
      fx: [{ t: "crit", v: [0.15, 0.22, 0.3], on: "phys", when: { round1: true } }],
    },
    // 敵を斬り捨てるたび、血を振って刃と気息を整える
    samuraiChiburi: {
      label: "血振り",
      lv: ["敵を倒すとMP3%回復・素早さ×1.1 (2ターン)", "敵を倒すとMP5%回復・素早さ×1.15 (2ターン)",
        "敵を倒すとMP7%回復・素早さ×1.2 (2ターン)"],
      fx: [{ t: "kill", mp: [0.03, 0.05, 0.07], buff: { agi: [1.1, 1.15, 1.2] }, dur: 2 }],
    },
    // 峰を返して打ち、敵の出足を挫く
    samuraiMinegaeshi: {
      label: "峰返し",
      lv: ["通常攻撃が当たると10%で敵を怯ませる", "通常攻撃が当たると15%で敵を怯ませる"],
      fx: [{ t: "hit", chance: [0.1, 0.15], on: "basic", ail: "flinch" }],
    },
    // 残る一体との差し向かいで真価を出す
    samuraiIkkiuchi: {
      label: "一騎討ち",
      lv: ["敵が残り1体の時、物理の与ダメージ+12%・回避+4%", "敵が残り1体の時、物理の与ダメージ+18%・回避+6%",
        "敵が残り1体の時、物理の与ダメージ+25%・回避+8%"],
      fx: [
        { t: "deal", v: [0.12, 0.18, 0.25], on: "phys", when: { lastFoe: true } },
        { t: "evade", v: [0.04, 0.06, 0.08], when: { lastFoe: true } },
      ],
    },
  },
};
