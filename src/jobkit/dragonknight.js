// 竜騎士 (dragonknight) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
// 持ち味: 竜の跳躍と竜鱗 — 天から降る一撃、敵陣を薙ぐ竜の息 (風・火の全体物理)、ブレスを弾く鱗と、傷つくほど滾る竜の血
import { DRAGONS } from "./common.js";

export default {
  // 覚醒のパッシブ: 魂がランク2に上がると目覚める (以前の Lv15 のパッシブ)
  awaken: "dragonknightRyuurin/1",
  table: `
    1 SHIELDBASH 2 SHIPPUUGIRI 3 NERAIUCHI 5 dragonknightHishou/1 7 TENSHOU 10 CHOUHATSU
    12 KAENGIRI 15 DRAGONKNIGHT_RYUUSOUTSUKI 20 RYUURIN 22 REPPUU 25 dragonknightIkari/1 30 RYUUKOU
    35 dragonknightRyuuketsu/1 40 RYUZETSU 45 dragonknightRyuuketsu/2 50 RYUURINJIN 55 RYUUEN 57 FUUGA
    60 dragonknightHishou/2 65 NIOUDACHI 70 dragonknightRyuurin/2 75 dragonknightRyuugan/1 80 DRAGONKNIGHT_RYUUSOU 82 GURENZAN
    85 DRAGONKNIGHT_RYUUYOKU 90 resistAilment/1 95 DRAGONKNIGHT_RYUUGA 100 DRAGONKNIGHT_KOURYUUGEKI 105 dragonknightIkari/2 107 DRAGONKNIGHT_FUURYUU
    110 DRAGONKNIGHT_TENKUU 115 dragonknightRyuuketsu/3 120 DRAGONKNIGHT_RYUUKOTSU 125 dragonknightRyuugan/2 130 DRAGONKNIGHT_RYUUBI 135 dragonknightRyuuketsu/4
    140 RYUUJINKOURIN 145 resistAilment/2 150 DRAGONKNIGHT_GEKIRIN 155 dragonknightRyuurin/3 160 DRAGONKNIGHT_TATSUMAKI 162 DRAGONKNIGHT_ARASHIRYUU
    165 dragonknightIkari/3 170 DRAGONKNIGHT_RYUUOUDAN 175 dragonknightRyuugan/3 180 DRAGONKNIGHT_RYUUSEIRAKU 185 dragonknightHishou/3 190 DRAGONKNIGHT_GOUKA
    195 DRAGONKNIGHT_RYUURINJIN 200 RYUUTEIGEKI`,
  skills: {
    // Lv15 (覚醒のパッシブが抜けた段): 竜をも貫く槍の一突き
    DRAGONKNIGHT_RYUUSOUTSUKI: { name: "竜槍突き", mp: 5, kind: "phys", power: 1.4, acc: 0.6, pierce: 0.3, prey: { races: DRAGONS, mul: 1.3 }, target: "enemy", desc: "竜をも貫く槍の一突き。防御を一部抜き、竜に強い" },
    DRAGONKNIGHT_RYUUSOU: { name: "竜爪裂き", mp: 16, kind: "phys", power: 2.0, hits: 2, pierce: 0.4, acc: 0.7, target: "enemy", desc: "竜の爪のごとく二度裂く（防御を一部無視）" },
    DRAGONKNIGHT_RYUUYOKU: { name: "竜翼の庇い", mp: 10, kind: "buff", buff: { vit: 1.3, agi: 1.1 }, tech: true, target: "all-ally", desc: "竜の翼を広げ、味方全体の守りと身のこなしを上げる" },
    DRAGONKNIGHT_RYUUGA: { name: "竜牙穿ち", mp: 14, kind: "phys", power: 2.3, acc: 0.7, debuff: { vit: 0.8 }, flinchChance: 0.25, target: "enemy", desc: "竜の牙で鎧を穿ち、怯ませる" },
    DRAGONKNIGHT_KOURYUUGEKI: { name: "降竜撃", mp: 18, kind: "phys", power: 5.2, agiScale: 0.6, acc: 1, flinchChance: 0.3, target: "enemy", desc: "跳躍から降る必中の一撃。怯ませる（AGIで伸びる）" },
    DRAGONKNIGHT_FUURYUU: { name: "風竜の吐息", mp: 21, kind: "phys", power: 1.6, agiScale: 0.3, critBonus: 0.1, element: "wind", flinchChance: 0.15, target: "all-enemy", desc: "風竜の息吹が敵陣を切り裂く" },
    DRAGONKNIGHT_TENKUU: { name: "天空落とし", mp: 24, kind: "phys", power: 5.4, acc: 1, critBonus: 0.2, target: "enemy", desc: "天高く跳び、急降下で貫く（必中・会心UP）" },
    DRAGONKNIGHT_RYUUKOTSU: { name: "竜骨砕き", mp: 28, kind: "phys", power: 6.6, acc: 0.9, pierce: 0.4, debuff: { vit: 0.75 }, target: "enemy", desc: "竜骨をも砕く剛撃。守りを崩す" },
    DRAGONKNIGHT_RYUUBI: { name: "竜尾薙ぎ", mp: 24, kind: "phys", power: 1.5, vitScale: 0.5, acc: 0.8, flinchChance: 0.3, target: "all-enemy", desc: "竜の尾のごとく敵陣を薙ぎ払い、怯ませる" },
    DRAGONKNIGHT_GEKIRIN: { name: "逆鱗の構え", mp: 26, kind: "buff", taunt: true, stance: "counter", buff: { atk: 1.3, vit: 1.3 }, tech: true, target: "self", desc: "逆鱗を晒して敵を誘い、触れた者に必ず反撃する" },
    DRAGONKNIGHT_TATSUMAKI: { name: "竜巻き上げ", mp: 18, kind: "phys", power: 1.7, agiScale: 0.3, element: "wind", acc: 0.6, debuff: { agi: 0.85 }, target: "all-enemy", desc: "竜巻で敵陣を巻き上げ、足を奪う" },
    DRAGONKNIGHT_ARASHIRYUU: { name: "嵐竜の咆哮", mp: 27, kind: "phys", power: 2.0, element: "wind", acc: 0.6, flinchChance: 0.3, debuff: { atk: 0.9 }, target: "all-enemy", desc: "嵐を呼ぶ咆哮が敵陣を刻み、竦ませる" },
    DRAGONKNIGHT_RYUUOUDAN: { name: "竜王断", mp: 32, kind: "phys", power: 8.0, acc: 1, execute: 1.6, prey: { races: DRAGONS, mul: 1.3 }, target: "enemy", desc: "必中の大斬撃。弱った敵と竜に重い" },
    DRAGONKNIGHT_RYUUSEIRAKU: { name: "竜星落とし", mp: 30, kind: "phys", power: 1.8, scatter: 5, acc: 0.8, critBonus: 0.1, target: "all-enemy", desc: "跳躍から敵陣へ5度降り注ぐ" },
    DRAGONKNIGHT_GOUKA: { name: "劫火の竜息", mp: 28, kind: "phys", power: 2.4, element: "fire", acc: 0.7, vuln: { fire: 0.85 }, target: "all-enemy", desc: "劫火の息で敵陣を焼き、炎への守りを崩す" },
    DRAGONKNIGHT_RYUURINJIN: { name: "竜鱗の陣", mp: 20, kind: "buff", buff: { vit: 1.4 }, grantBarrier: 1, tech: true, target: "all-ally", desc: "竜鱗の加護を味方全体に分け与える" },
  },
  perks: {
    dragonknightHishou: {
      label: "飛竜の跳躍",
      lv: ["敵の物理を4%でかわす。1ラウンド目の与ダメージ+10%", "敵の物理を7%でかわす。1ラウンド目の与ダメージ+15%", "敵の物理を10%でかわす。1ラウンド目の与ダメージ+20%"],
      fx: [{ t: "evade", v: [0.04, 0.07, 0.10] }, { t: "deal", when: { round1: true }, v: [0.10, 0.15, 0.20] }],
    },
    dragonknightRyuurin: {
      label: "竜鱗の守り",
      lv: ["ブレスの被ダメージ-15%。ブレスを受けるとATK×1.1 (2ターン)", "ブレスの被ダメージ-25%。ブレスを受けるとATK×1.15 (2ターン)", "ブレスの被ダメージ-33%。ブレスを受けるとATK×1.2 (2ターン)"],
      fx: [{ t: "take", on: "breath", v: [0.15, 0.25, 0.33] }, { t: "hurt", on: "breath", buff: { atk: [1.1, 1.15, 1.2] }, dur: 2 }],
    },
    dragonknightIkari: {
      label: "竜の怒り",
      lv: ["物理を受けると20%でATK×1.15 (2ターン)", "物理を受けると27%でATK×1.2 (2ターン)", "物理を受けると35%でATK×1.25 (2ターン)"],
      fx: [{ t: "hurt", chance: [0.20, 0.27, 0.35], buff: { atk: [1.15, 1.2, 1.25] }, dur: 2 }],
    },
    dragonknightRyuuketsu: {
      label: "竜血の昂り",
      lv: ["HP40%以下でATK+12%。HP25%以下で被ダメージ-15%", "HP40%以下でATK+18%。HP25%以下で被ダメージ-20%", "HP40%以下でATK+25%。HP25%以下で被ダメージ-30%", "HP40%以下でATK+32%。HP25%以下で被ダメージ-40%"],
      fx: [{ t: "stat", when: { selfLow: 0.4 }, mul: { atk: [0.12, 0.18, 0.25, 0.32] } }, { t: "take", when: { selfLow: 0.25 }, v: [0.15, 0.20, 0.30, 0.40] }],
    },
    dragonknightRyuugan: {
      label: "竜眼",
      lv: ["物理の会心率+5%。物理が当たると8%で敵を怯ませる", "物理の会心率+8%。物理が当たると10%で敵を怯ませる", "物理の会心率+11%。物理が当たると12%で敵を怯ませる"],
      fx: [{ t: "crit", v: [0.05, 0.08, 0.11] }, { t: "hit", chance: [0.08, 0.10, 0.12], ail: "flinch" }],
    },
  },
};
