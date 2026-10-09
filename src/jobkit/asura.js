// 修羅 (asura) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
// 修羅 = 止まらない連撃と殺気。六臂の多段斬り、殺気で敵を竦ませ (弱体)、戦いが長引くほど昂ぶる
export default {
  // ランクのパッシブ: 魂がランク2で目覚め、3・4・5で強まる (souls.js の JOB_PASSIVES)
  awaken: "asuraNitou",
  table: `
    1 KYOUGEKI 2 KAENGIRI 3 DOUBLE 5 asuraTakaburi/1 7 SHIPPUUGIRI 10 ASURA_KIKI
    12 ASURA_SOUGA 15 ASURA_SANKAZAN 15 asuraChishio/1 20 ASURA_SAKKI 22 KAENNAGI 25 asuraMe/1 30 SHURADOU 30 dynamicVision/1
    35 asuraTakaburi/2 40 ASHURAZAN 45 asuraSakki/1 50 ASURA_SANMEN 50 asuraChishio/2 55 ASURA_KOKYUU 57 GURENZAN
    60 asuraShisen/1 65 ASURA_KYUUSHO 70 asuraMe/2 75 asuraSogi/1 80 ASURA_SHIZAN 80 dynamicVision/2 82 FUUGA
    85 ASURA_ROPPI 90 asuraTakaburi/3 95 ASURA_SOU 100 ASURA_KEKKA 100 asuraChishio/3 105 asuraShisen/2 107 ASURA_KARIN
    110 ASURA_MUKEN 115 asuraSakki/2 120 ASURA_RASETSU 125 asuraSogi/2 130 ASURA_HYAKKI 135 asuraShisen/3
    140 ASURA_GOUFUU 145 resistAilment/1 150 ASURA_SETSUNA 155 asuraMe/3 160 ASURA_ABI 160 dynamicVision/3 162 ASURA_GOUKA
    165 asuraSakki/3 170 ASURA_SENPUU 175 asuraTakaburi/4 180 ASURA_RENGOKU 185 asuraSogi/3 190 ASURA_SHURAOU
    195 ASURA_KYOUHYOU 200 RINNE`,
  skills: {
    // Lv15 の固有技: 三面六臂のごとく炎刃を三度振るう
    ASURA_SANKAZAN: { name: "三火斬", mp: 6, kind: "phys", power: 0.7, hits: 3, acc: 0.4, element: "fire", target: "enemy", desc: "三面六臂のごとく炎の刃を三度振るう（火）" },
    ASURA_KIKI: { name: "鬼気斬り", mp: 6, kind: "phys", power: 1.4, acc: 0.3, debuff: { atk: 0.85 }, target: "enemy", desc: "鬼気をまとう斬撃。敵の力を削ぐ" },
    ASURA_SOUGA: { name: "双牙", mp: 5, kind: "phys", power: 0.85, hits: 2, critBonus: 0.35, target: "enemy", desc: "二本の牙のごとく急所を二度突く" },
    ASURA_SAKKI: { name: "殺気", mp: 6, kind: "debuff", debuff: { agi: 0.8 }, target: "all-enemy", tech: true, desc: "殺気で敵全体を竦ませ、素早さを下げる" },
    ASURA_SANMEN: { name: "三面斬り", mp: 10, kind: "phys", power: 0.95, hits: 3, acc: 0.3, critBonus: 0.15, target: "enemy", desc: "三面の修羅が三方から斬りつける" },
    ASURA_KOKYUU: { name: "修羅の呼吸", mp: 3, kind: "buff", charge: 1.6, buff: { agi: 1.25 }, target: "self", tech: true, desc: "息を整え次の物理を1.6倍、素早さも上げる" },
    ASURA_KYUUSHO: { name: "急所断ち", mp: 8, kind: "phys", power: 1.4, critBonus: 1, execute: 1.3, target: "enemy", desc: "必ず会心。弱った敵には更に深く" },
    ASURA_SHIZAN: { name: "屍山", mp: 16, kind: "phys", power: 1.0, hits: 3, execute: 2.2, target: "enemy", desc: "弱った敵を三度斬り刻む（とどめ）" },
    ASURA_ROPPI: { name: "六臂乱撃", mp: 16, kind: "phys", power: 0.8, hits: 4, acc: 0.4, critBonus: 0.2, target: "enemy", desc: "六本の腕で四度打ち込む" },
    ASURA_SOU: { name: "修羅の相", mp: 12, kind: "buff", buff: { atk: 1.4, agi: 1.3 }, debuffAll: { atk: 0.9 }, target: "self", tech: true, desc: "修羅の相を現し己を高め、敵を竦ませる" },
    ASURA_KEKKA: { name: "血河", mp: 20, kind: "phys", power: 2.4, hits: 2, desperate: true, acc: 0.7, target: "enemy", desc: "傷が深いほど重い二連の大斬" },
    ASURA_KARIN: { name: "火輪", mp: 20, kind: "phys", power: 1.8, hits: 3, element: "fire", acc: 0.6, target: "enemy", desc: "炎の輪のごとく三度斬り焼く" },
    ASURA_MUKEN: { name: "無間斬", mp: 14, kind: "phys", power: 0.95, hits: 3, agiScale: 0.35, critBonus: 0.2, flinchChance: 0.15, target: "enemy", desc: "途切れぬ三連斬。怯ませる" },
    ASURA_RASETSU: { name: "羅刹斬", mp: 24, kind: "phys", power: 5.0, acc: 1, debuff: { atk: 0.8 }, target: "enemy", desc: "必中の羅刹の一刀。敵の力を削ぐ" },
    ASURA_HYAKKI: { name: "百鬼夜行", mp: 25, kind: "phys", power: 0.75, scatter: 6, acc: 0.6, critBonus: 0.1, target: "all-enemy", desc: "百鬼のごとく敵陣を6度斬り巡る" },
    ASURA_GOUFUU: { name: "劫風", mp: 22, kind: "phys", power: 2.2, acc: 0.6, debuff: { agi: 0.85 }, target: "all-enemy", desc: "劫の風で敵全体を斬り、足を止める" },
    ASURA_SETSUNA: { name: "刹那", mp: 22, kind: "phys", power: 1.4, hits: 3, agiScale: 1.5, critBonus: 0.3, target: "enemy", desc: "刹那に三度。素早さで大きく伸びる" },
    ASURA_ABI: { name: "阿鼻叫喚", mp: 30, kind: "phys", power: 2.55, hits: 2, acc: 0.8, target: "all-enemy", desc: "敵陣を二度斬り巡る（命中UP）" },
    ASURA_GOUKA: { name: "劫火輪", mp: 28, kind: "phys", power: 2.4, element: "fire", acc: 0.6, critBonus: 0.15, target: "all-enemy", desc: "劫火の輪で敵陣を焼き斬る" },
    ASURA_SENPUU: { name: "旋風六臂", mp: 21, kind: "phys", power: 0.92, hits: 6, element: "wind", agiScale: 0.2, critBonus: 0.15, target: "enemy", desc: "旋風をまとう六本の腕で六度斬る" },
    ASURA_RENGOKU: { name: "煉獄連斬", mp: 30, kind: "phys", power: 0.58, hits: 7, agiScale: 0.3, critBonus: 0.4, execute: 1.3, target: "enemy", desc: "七連の乱斬。弱った敵に重い" },
    ASURA_SHURAOU: { name: "修羅王撃", mp: 32, kind: "phys", power: 8.5, acc: 1, critBonus: 0.3, target: "enemy", desc: "修羅王の必中の一撃。会心しやすい" },
    ASURA_KYOUHYOU: { name: "狂飆", mp: 27, kind: "phys", power: 1.15, hits: 2, element: "wind", critBonus: 0.2, target: "all-enemy", desc: "荒れ狂う嵐の刃が敵陣を二度刻む" },
  },
  perks: {
    // 戦いが長引くほど修羅の血が昂ぶる
    asuraTakaburi: {
      label: "修羅の昂ぶり",
      lv: ["3ラウンド目以降、攻撃力+8%・会心+4%", "3ラウンド目以降、攻撃力+12%・会心+6%",
        "3ラウンド目以降、攻撃力+16%・会心+8%", "3ラウンド目以降、攻撃力+20%・会心+10%"],
      fx: [
        { t: "stat", mul: { atk: [0.08, 0.12, 0.16, 0.2] }, when: { roundGE: 3 } },
        { t: "crit", v: [0.04, 0.06, 0.08, 0.1], when: { roundGE: 3 } },
      ],
    },
    // 死線の上でこそ刃が冴え、身のこなしも鋭くなる
    asuraShisen: {
      label: "死線",
      lv: ["HP30%以下の間、与ダメージ+15%・回避+4%", "HP30%以下の間、与ダメージ+22%・回避+6%",
        "HP30%以下の間、与ダメージ+30%・回避+8%", "HP30%以下の間、与ダメージ+40%・回避+10%"],
      fx: [
        { t: "deal", v: [0.15, 0.22, 0.3, 0.4], when: { selfLow: 0.3 } },
        { t: "evade", v: [0.04, 0.06, 0.08, 0.1], when: { selfLow: 0.3 } },
      ],
    },
    // 竦んだ敵の隙を見逃さない
    asuraMe: {
      label: "修羅の眼",
      lv: ["弱体中の敵への物理の会心率+8%", "弱体中の敵への物理の会心率+12%", "弱体中の敵への物理の会心率+16%"],
      fx: [{ t: "crit", v: [0.08, 0.12, 0.16], on: "phys", when: { tgtDebuffed: true } }],
    },
    // 開戦の殺気が敵の腕を鈍らせる
    asuraSakki: {
      label: "殺気の帳",
      lv: ["戦闘開始時、敵全体の攻撃力×0.92 (3ターン)", "戦闘開始時、敵全体の攻撃力×0.88 (3ターン)",
        "戦闘開始時、敵全体の攻撃力×0.84 (3ターン)"],
      fx: [{ t: "start", foe: { atk: [0.92, 0.88, 0.84] }, dur: 3 }],
    },
    // 連撃の一太刀ごとに鎧を削ぎ落とす
    asuraSogi: {
      label: "削ぎ斬り",
      lv: ["物理技が当たるたび10%で敵の防御×0.85 (3ターン)", "物理技が当たるたび14%で敵の防御×0.85 (3ターン)",
        "物理技が当たるたび18%で敵の防御×0.85 (3ターン)"],
      fx: [{ t: "hit", chance: [0.1, 0.14, 0.18], on: "skill", ail: "vit", mul: 0.85 }],
    },
  },
};
