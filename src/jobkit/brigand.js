// 義賊 (brigand) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
export default {
  // ランクのパッシブ: 魂がランク2で目覚め、3・4・5で強まる (souls.js の JOB_PASSIVES)
  awaken: "brigandGi",
  table: `
    1 KYOUGEKI 2 STEAL 3 SUIGETSU 5 goldLuck/1 7 BRIGAND_ZENITSUBUTE 10 BRIGAND_TEBIKI
    12 YAMIBA 15 BRIGAND_MINEUCHI 15 senseTreasure/1 20 ASHIBARAI 22 UZUSHIO 25 brigandGifun/1 30 BRIGAND_HAIKAGURA
    35 brigandUdekujiki/1 40 OIHAGI 45 brigandKabau/1 50 BRIGAND_KUJIKI 50 senseTreasure/2 55 BRIGAND_AIKUCHI 57 HYOUJIN
    60 goldLuck/2 65 BRIGAND_TACHIMAWARI 70 brigandUdekujiki/2 75 brigandHodokoshi/1 80 BRIGAND_HODOKOSHI 85 BRIGAND_MIZUZEME
    90 brigandGifun/2 95 BRIGAND_KAGEFUMI 100 BRIGAND_AKUDAIKAN 100 senseTreasure/3 105 brigandKabau/2 107 BRIGAND_HISAME 110 BRIGAND_JINGI
    115 brigandUdekujiki/3 120 BRIGAND_TSUKIYO 125 brigandGifun/3 130 BRIGAND_HANAMICHI 135 brigandHodokoshi/2 140 BRIGAND_SEIBAI
    145 brigandUdekujiki/4 150 BRIGAND_NAGESEN 155 brigandGifun/4 160 BRIGAND_SHIRANAMI 162 BRIGAND_DOTOU 165 resistAilment/1
    170 BRIGAND_TENCHUU 175 brigandKabau/3 180 BRIGAND_SENRYOU 185 brigandHodokoshi/3 190 TENKAGOMEN 195 BRIGAND_YATOU
    200 BRIGAND_HONKAI`,
  skills: {
    // Lv15 の固有技: 峰で打って怯ませ、懐から抜き取る
    BRIGAND_MINEUCHI: { name: "峰打ち", mp: 4, kind: "phys", power: 1.0, flinchChance: 0.3, steal: 0.5, target: "enemy", desc: "峰で打ち据えて怯ませ、懐から金品を抜き取る" },
    BRIGAND_ZENITSUBUTE: { name: "銭つぶて", mp: 3, kind: "phys", power: 0.55, acc: 0.8, flinchChance: 0.4, target: "enemy", desc: "銭を投げつけて怯ませる" },
    BRIGAND_TEBIKI:      { name: "義の手引き", mp: 3, kind: "buff", buff: { agi: 1.3 }, target: "ally", tech: true, desc: "仲間の手を引き、素早さを上げる" },
    BRIGAND_HAIKAGURA:   { name: "灰神楽", mp: 7, kind: "debuff", debuff: { hit: 0.8 }, target: "all-enemy", tech: true, desc: "灰を巻き上げ、敵全体の狙いを乱す" },
    BRIGAND_KUJIKI:      { name: "挫き打ち", mp: 5, kind: "phys", power: 1.3, critBonus: 0.25, debuff: { atk: 0.85 }, target: "enemy", desc: "強者の腕を打ち、STRを削ぐ" },
    BRIGAND_AIKUCHI:     { name: "闇匕首", mp: 3, kind: "phys", power: 0.9, element: "dark", poison: { chance: 0.65, pct: 0.05 }, target: "enemy", desc: "闇に紛れ毒の匕首を突き立てる（闇）" },
    BRIGAND_TACHIMAWARI: { name: "大立ち回り", mp: 10, kind: "phys", power: 0.85, flinchChance: 0.2, target: "all-enemy", desc: "敵陣を駆け抜け、怯ませる" },
    BRIGAND_HODOKOSHI:   { name: "施しの刃", mp: 9, kind: "phys", power: 1.15, agiScale: 0.8, bladeHeal: 0.07, healCap: 0.12, target: "enemy", desc: "斬った隙に薬を撒き、味方を癒す" },
    BRIGAND_MIZUZEME:    { name: "水責め", mp: 12, kind: "phys", power: 1.6, element: "water", seal: { chance: 0.5, turns: 2 }, target: "enemy", desc: "水に沈めて息を詰まらせ、特技を封じる（水）" },
    BRIGAND_KAGEFUMI:    { name: "影踏み三段", mp: 14, kind: "phys", power: 0.9, hits: 3, critBonus: 0.25, element: "dark", debuff: { agi: 0.85 }, target: "enemy", desc: "影を踏み三度斬り、足を縫い留める（闇）" },
    BRIGAND_AKUDAIKAN:   { name: "悪代官斬り", mp: 16, kind: "phys", power: 2.6, critBonus: 0.2, execute: 2.5, plunder: true, target: "enemy", desc: "弱った悪党を斬り捨て、金品を剥ぐ" },
    BRIGAND_HISAME:      { name: "氷雨の刃", mp: 20, kind: "phys", power: 4.5, element: "water", debuff: { hit: 0.85 }, target: "enemy", desc: "氷雨の刃で斬り、敵の視界を奪う（水）" },
    BRIGAND_JINGI:       { name: "仁義四連", mp: 18, kind: "phys", power: 0.8, hits: 4, agiScale: 0.3, drain: 0.12, target: "enemy", desc: "義理を通す四連撃。傷を少し癒す" },
    BRIGAND_TSUKIYO:     { name: "月夜の大仕事", mp: 22, kind: "phys", power: 4.0, agiScale: 1.3, critBonus: 0.3, element: "dark", steal: 0.7, target: "enemy", desc: "月夜に斬り込み、根こそぎ盗む（闇）" },
    BRIGAND_HANAMICHI:   { name: "義賊の花道", mp: 28, kind: "phys", power: 1.9, agiScale: 0.5, bladeHeal: 0.03, healCap: 0.15, target: "all-enemy", desc: "見得を切って敵陣を斬り、味方を癒す" },
    BRIGAND_SEIBAI:      { name: "成敗", mp: 28, kind: "phys", power: 4.6, critBonus: 0.4, instakill: { chance: 0.25 }, target: "enemy", desc: "悪を成敗する一撃。即死させることも" },
    BRIGAND_NAGESEN:     { name: "投げ銭乱舞", mp: 22, kind: "phys", power: 1.0, scatter: 5, critBonus: 0.2, target: "all-enemy", desc: "銭と刃を雨あられと敵陣に投げる" },
    BRIGAND_SHIRANAMI:   { name: "白浪五段", mp: 24, kind: "phys", power: 0.75, hits: 5, agiScale: 0.3, critBonus: 0.25, element: "water", target: "enemy", desc: "白浪のごとく打ち寄せる五連撃（水）" },
    BRIGAND_DOTOU:       { name: "怒濤の義挙", mp: 28, kind: "phys", power: 2.0, element: "water", steal: 0.4, target: "all-enemy", desc: "怒濤のごとく敵陣を呑み、金品をさらう（水）" },
    BRIGAND_TENCHUU:     { name: "天誅", mp: 32, kind: "phys", power: 7.2, critBonus: 0.4, execute: 2.2, element: "dark", target: "enemy", desc: "悪に下す闇の天誅。弱った敵に絶大（闇）" },
    BRIGAND_SENRYOU:     { name: "千両箱崩し", mp: 30, kind: "phys", power: 0.65, hits: 6, agiScale: 0.3, critBonus: 0.3, steal: 0.8, plunder: true, target: "enemy", desc: "六度斬りつけ、千両箱ごと奪い去る" },
    BRIGAND_YATOU:       { name: "夜盗の宴", mp: 27, kind: "phys", power: 2.1, element: "dark", debuff: { atk: 0.85 }, plunder: true, target: "all-enemy", desc: "闇夜に敵陣を荒らし力を削ぐ。倒せば金品も（闇）" },
    BRIGAND_HONKAI:      { name: "義賊の本懐", mp: 40, kind: "phys", power: 9.0, agiScale: 1.8, critBonus: 0.6, plunder: true, bladeHeal: 0.02, healCap: 0.25, target: "enemy", desc: "悪を討ち、奪った富で仲間を癒す奥義" },
  },
  perks: {
    // 仲間が倒されると義憤に燃える
    brigandGifun: {
      label: "義憤",
      lv: ["味方が倒れるとSTR×1.2 (3ターン)。倒れた味方がいる間、与ダメ+8%", "味方が倒れるとSTR×1.25。倒れた味方がいる間、与ダメ+12%",
        "味方が倒れるとSTR×1.3。倒れた味方がいる間、与ダメ+16%", "味方が倒れるとSTR×1.4。倒れた味方がいる間、与ダメ+20%"],
      fx: [
        { t: "fall", buff: { atk: [1.2, 1.25, 1.3, 1.4] }, dur: 3 },
        { t: "deal", v: [0.08, 0.12, 0.16, 0.2], when: { allyDown: true } },
      ],
    },
    // 奪った薬を仲間に分け与える
    brigandHodokoshi: {
      label: "義賊の施し",
      lv: ["物理技の後15%で味方全員のHP2%回復。勝利後、味方全員のHP3%回復", "物理技の後20%で味方全員のHP3%回復。勝利後、味方全員のHP4%回復",
        "物理技の後25%で味方全員のHP4%回復。勝利後、味方全員のHP5%回復"],
      fx: [
        { t: "cast", on: "phys", chance: [0.15, 0.2, 0.25], hp: [0.02, 0.03, 0.04], party: true },
        { t: "win", hp: [0.03, 0.04, 0.05], party: true },
      ],
    },
    // 後ろに控える弱き者を庇う
    brigandKabau: {
      label: "弱きを庇う",
      lv: ["持ち主が生きている間、後衛の味方が受ける物理・ブレスの被ダメ−5%", "後衛の味方の被ダメ−9%", "後衛の味方の被ダメ−13%"],
      fx: [{ t: "take", v: [0.05, 0.09, 0.13], when: { back: true }, aura: true }],
    },
    // 強者ほど容赦なく腕を挫く
    brigandUdekujiki: {
      label: "強きを挫く",
      lv: ["主への与ダメ+6%。通常攻撃が当たると10%で敵の攻撃×0.85", "主への与ダメ+10%。通常攻撃で15%の腕挫き",
        "主への与ダメ+14%。通常攻撃で20%の腕挫き", "主への与ダメ+18%。通常攻撃で25%の腕挫き"],
      fx: [
        { t: "deal", v: [0.06, 0.1, 0.14, 0.18], when: { boss: true } },
        { t: "hit", chance: [0.1, 0.15, 0.2, 0.25], on: "basic", ail: "atk", mul: 0.85 },
      ],
    },
  },
};
