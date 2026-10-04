// 狩人 (hunter) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
import { BEASTS } from "./common.js";

export default {
  // 覚醒のパッシブ: 魂がランク2に上がると目覚める (以前の Lv15 のパッシブ)
  awaken: "hunterKoei/1",
  table: `
    1 DOKUYA 2 SUIGETSU 3 ASHIDOME 5 hunterKemono/1 7 SOGEKI 10 YANOAME
    12 ABURA 15 HUNTER_NINOYA 15 senseEnemy/1 20 SHIBIREYA 22 HUNTER_KEHAIYOMI 25 hunterAshinerai/1 30 KEMONOGARI
    35 hunterKemono/2 40 KUBIKARI 45 hunterAshinerai/2 50 TSURANUKI 50 senseEnemy/2 55 HUNTER_HAYATEYA 57 FUUGA
    60 hunterKoei/2 65 HUNTER_KABURAYA 70 hunterKazeyomi/1 75 fleetFoot/1 80 HYOUJIN 82 RENSHA
    85 HUNTER_TORABASAMI 90 hunterAshinerai/3 95 SENNYA 100 HUNTER_ITEYA 100 senseEnemy/3 105 hunterKemono/3 110 HUNTER_TAKAOTOSHI
    115 hunterKoei/3 120 HUNTER_KAZEKIRI 125 vigilance/1 130 HUNTER_HIYA 135 hunterAshinerai/4 140 HUNTER_SHINZOU
    145 fleetFoot/2 150 HUNTER_SAMIDARE 155 vigilance/2 160 RYUUSEISHA 162 HUNTER_ARASHIYUZURU 165 resistAilment/1
    170 HUNTER_TOMEYA 175 hunterKemono/4 180 HUNTER_AMIUCHI 185 hunterKazeyomi/2 190 HUNTER_KARIGAMI 195 HUNTER_BAKUFU
    200 HUNTER_HOSHIOTOSHI`,
  skills: {
    // Lv15 (覚醒のパッシブが抜けた段): 間を置かず二の矢を継ぐ確実な連射
    HUNTER_NINOYA: { name: "二の矢", mp: 5, kind: "phys", power: 0.85, hits: 2, acc: 0.6, agiScale: 0.3, target: "enemy", desc: "間を置かずに二の矢を継ぎ、確実に射抜く（AGIで伸びる）" },
    // 迷宮で唱える術: 獣を追う勘で、この階の魔物の居場所を赤い気配として浮かび上がらせる
    HUNTER_KEHAIYOMI:    { name: "気配読み", mp: 4, kind: "field", sense: "enemy", target: "all-ally", desc: "この階の魔物の居場所が、墓石の下の赤い気配として浮かび上がる。何が潜むかまでは分からない（迷宮で唱える）" },
    HUNTER_HAYATEYA:     { name: "疾風の一矢", mp: 9, kind: "phys", power: 1.3, agiScale: 0.9, acc: 0.4, element: "wind", target: "enemy", desc: "風に乗せた速射（風・命中UP）" },
    HUNTER_KABURAYA:     { name: "鏑矢三連", mp: 14, kind: "phys", power: 0.95, hits: 3, agiScale: 0.35, flinchChance: 0.35, target: "enemy", desc: "鳴り響く三矢で射抜き、怯ませる" },
    HUNTER_TORABASAMI:   { name: "虎挟み", mp: 16, kind: "phys", power: 2.6, acc: 0.5, para: 0.35, debuff: { agi: 0.75 }, target: "enemy", desc: "鋼の罠で脚を噛み、痺れさせる" },
    HUNTER_ITEYA:        { name: "凍て矢", mp: 20, kind: "phys", power: 4.5, acc: 0.4, element: "water", vuln: { water: 0.8 }, target: "enemy", desc: "芯まで凍らせ、水への守りを崩す（水）" },
    HUNTER_TAKAOTOSHI:   { name: "鷹落とし", mp: 22, kind: "phys", power: 4.0, agiScale: 1.4, critBonus: 0.3, prey: { races: ["wing", "avian"], mul: 2 }, target: "enemy", desc: "飛ぶものを撃ち落とす速射（飛行に2倍）" },
    HUNTER_KAZEKIRI:     { name: "風切り四連", mp: 21, kind: "phys", power: 1.3, hits: 4, agiScale: 0.3, acc: 0.5, element: "wind", target: "enemy", desc: "風を切る四連射（風・命中UP）" },
    HUNTER_HIYA:         { name: "火矢の驟雨", mp: 28, kind: "phys", power: 2.0, agiScale: 0.5, element: "fire", target: "all-enemy", desc: "火矢の雨を降らせる。油壺と好相性（火）" },
    HUNTER_SHINZOU:      { name: "心臓射ち", mp: 28, kind: "phys", power: 4.8, critBonus: 0.4, acc: 0.5, instakill: { chance: 0.4, races: BEASTS }, target: "enemy", desc: "心臓を射抜く。獣なら即死させることも" },
    HUNTER_SAMIDARE:     { name: "五月雨撃ち", mp: 24, kind: "phys", power: 0.75, hits: 5, agiScale: 0.3, acc: 0.4, element: "water", target: "enemy", desc: "五月雨のごとく一体へ射掛ける（水）" },
    HUNTER_ARASHIYUZURU: { name: "嵐の弓弦", mp: 27, kind: "phys", power: 2.1, element: "wind", flinchChance: 0.2, target: "all-enemy", desc: "嵐を呼ぶ一射が敵陣を薙ぎ、怯ませる（風）" },
    HUNTER_TOMEYA:       { name: "止め矢", mp: 32, kind: "phys", power: 7.2, execute: 2.2, acc: 1, critBonus: 0.3, target: "enemy", desc: "手負いの獲物を逃さぬ必中の止め矢" },
    HUNTER_AMIUCHI:      { name: "網打ち", mp: 22, kind: "phys", power: 1.4, acc: 0.4, debuff: { agi: 0.7 }, target: "all-enemy", desc: "投網と矢で敵陣を絡め取り、足を奪う" },
    HUNTER_KARIGAMI:     { name: "狩神の六矢", mp: 30, kind: "phys", power: 0.7, hits: 6, agiScale: 0.3, critBonus: 0.25, prey: { races: BEASTS, mul: 1.3 }, target: "enemy", desc: "狩りの神に捧ぐ六連射（獣に強い）" },
    HUNTER_BAKUFU:       { name: "瀑布の矢", mp: 28, kind: "phys", power: 2.0, element: "water", debuff: { vit: 0.85 }, target: "all-enemy", desc: "滝のごとく矢を降らせ、守りを崩す（水）" },
    HUNTER_HOSHIOTOSHI:  { name: "天弓・星落とし", mp: 40, kind: "phys", power: 9.0, agiScale: 1.8, acc: 1, pierce: 0.6, critBonus: 0.4, target: "enemy", desc: "星をも射落とす必中の奥義（貫通）" },
  },
  perks: {
    // 獣の急所を知る狩人。仕留めた獲物で精をつける
    hunterKemono: {
      label: "獣狩りの心得",
      lv: ["獣・飛獣・虫・植物・水棲・爬虫への与ダメ+12%。敵を倒すとHP3%回復", "獣などへの与ダメ+18%。倒すとHP4%回復",
        "獣などへの与ダメ+24%。倒すとHP5%回復", "獣などへの与ダメ+30%。倒すとHP6%回復"],
      fx: [
        { t: "deal", v: [0.12, 0.18, 0.24, 0.3], when: { race: BEASTS } },
        { t: "kill", hp: [0.03, 0.04, 0.05, 0.06] },
      ],
    },
    // 逃がさぬよう、まず足を射る
    hunterAshinerai: {
      label: "足狙い",
      lv: ["物理が当たると12%で敵のAGI×0.85。通常攻撃の会心+3%", "物理で18%の足止め。通常攻撃の会心+5%",
        "物理で24%の足止め。通常攻撃の会心+7%", "物理で30%の足止め。通常攻撃の会心+9%"],
      fx: [
        { t: "hit", chance: [0.12, 0.18, 0.24, 0.3], on: "phys", ail: "agi", mul: 0.85 },
        { t: "crit", v: [0.03, 0.05, 0.07, 0.09], on: "basic" },
      ],
    },
    // 後ろから狙い澄ます射手 (後衛の物理は半減するのを補う)
    hunterKoei: {
      label: "後衛の射手",
      lv: ["後衛にいる時、与ダメ+15%・物理会心+4%", "後衛にいる時、与ダメ+25%・物理会心+7%", "後衛にいる時、与ダメ+35%・物理会心+10%"],
      fx: [
        { t: "deal", v: [0.15, 0.25, 0.35], when: { back: true } },
        { t: "crit", v: [0.04, 0.07, 0.1], when: { back: true } },
      ],
    },
    // 風の流れを読んで身をかわし、機を待つ
    hunterKazeyomi: {
      label: "風読み",
      lv: ["敵の物理を4%でかわす。2ラウンド目から毎ラウンド30%でAGI×1.15 (2ターン)", "敵の物理を7%でかわす。毎ラウンド45%でAGI×1.15"],
      fx: [
        { t: "evade", v: [0.04, 0.07] },
        { t: "round", chance: [0.3, 0.45], buff: { agi: [1.15, 1.15] }, dur: 2 },
      ],
    },
  },
};
