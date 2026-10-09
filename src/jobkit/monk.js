// 武僧 (monk) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
// 持ち味: 拳と祈りの両立。打つほどに功徳が仲間を癒し、数珠と経で敵の業を封じる (土・風の拳法)
export default {
  // ランクのパッシブ: 魂がランク2で目覚め、3・4・5で強まる (souls.js の JOB_PASSIVES)
  awaken: "monkKikou",
  table: `
    1 KYOUGEKI 2 IWAKUDAKI 3 DIOS 5 monkKudoku/1 7 NOUTEN 10 HAKKEI 10 CURE 12 FUYUU 15 MONK_KUDOKUSHOU
    15 monkMeisou/1 20 TENKETSU 20 dynamicVision/1 22 CHIRETSU 25 monkRenkan/1 30 SHINTOU 30 DIOSALL 35 monkFue/1
    40 KONGOURENDA 40 DIAL 45 monkKudoku/2 50 KONGOUTAI 50 monkMeisou/2 55 SHINGANGEKI 57 GANOTOSHI
    60 monkFue/2 60 dynamicVision/2 70 monkRenkan/2 75 monkJuzu/1 80 HOUKEN 82 FUUGA 85 MONK_SEKEN 90 monkRenkan/3
    95 MONK_MYOUOU 100 HYAKURETSU 100 monkMeisou/3 105 monkOuhou/1 107 MONK_CHIMYAKU 110 KIYOME
    115 monkFue/3 120 MUSOUKEN 125 monkJuzu/2 130 MONK_NENJU 130 dynamicVision/3 135 monkRenkan/4 140 TENMAKEN 145 monkKudoku/3
    150 MONK_SENPUUKYAKU 155 resistAilment/1 160 MONK_ROKKON 162 MONK_SHINKYAKU 165 scripture/1
    170 MONK_HOURIN 175 monkOuhou/2 180 MONK_GASSHOU 185 monkKudoku/4 190 MONK_KUDOKUNOHIKARI 195 MONK_NEHAN
    200 KONGOUMUSOU`,
  skills: {
    // Lv15 の固有技: 功徳を込めた掌打。打てば仲間が癒える
    MONK_KUDOKUSHOU: { name: "功徳掌", mp: 6, kind: "phys", power: 1.2, pierce: 0.3, bladeHeal: 0.15, healCap: 0.1, target: "enemy", desc: "功徳を込めた掌打。防御を一部抜き、味方全員を少し癒す" },
    MONK_SEKEN: { name: "施拳", mp: 10, kind: "phys", power: 1.3, hits: 2, acc: 0.4, bladeHeal: 0.09, healCap: 0.12, target: "enemy", desc: "二打ちの拳の余韻が仲間を癒す" },
    MONK_MYOUOU: { name: "明王の構え", mp: 12, kind: "buff", buff: { atk: 1.4 }, stance: "counter", target: "self", tech: true, desc: "明王の怒りを宿し、攻めつつ反撃に構える" },
    MONK_CHIMYAKU: { name: "地脈掌", mp: 20, kind: "phys", power: 4.4, element: "earth", acc: 0.6, drain: 0.15, target: "enemy", desc: "大地の気を通す掌打。生気を吸い上げる" },
    MONK_NENJU: { name: "念珠乱打", mp: 16, kind: "phys", power: 0.8, hits: 4, acc: 0.5, debuff: { atk: 0.85 }, target: "enemy", desc: "数珠を巻いた四連打で敵の力を封じる" },
    MONK_SENPUUKYAKU: { name: "旋風脚", mp: 21, kind: "phys", power: 0.9, hits: 2, agiScale: 0.2, element: "wind", acc: 0.5, target: "all-enemy", desc: "旋風の回し蹴りが敵全体を二度なぐ" },
    MONK_ROKKON: { name: "六根清浄拳", mp: 24, kind: "phys", power: 0.68, hits: 6, acc: 0.7, bladeHeal: 0.06, healCap: 0.15, target: "enemy", desc: "六根を清める六連拳。仲間も癒す" },
    MONK_SHINKYAKU: { name: "金剛震脚", mp: 28, kind: "phys", power: 2.1, element: "earth", acc: 0.6, debuff: { agi: 0.8 }, target: "all-enemy", desc: "震脚で大地を揺らし、敵全体の足を止める" },
    MONK_HOURIN: { name: "法輪掌", mp: 30, kind: "phys", power: 2.7, acc: 0.9, seal: { chance: 0.3, turns: 2 }, target: "all-enemy", desc: "法輪が敵陣を打ち、特技を封じる" },
    MONK_GASSHOU: { name: "合掌の祈り", mp: 19, kind: "heal", healMul: 1.4, buff: { atk: 1.1 }, target: "all-ally", desc: "全員を癒し、闘志を奮い立たせる" },
    MONK_KUDOKUNOHIKARI: { name: "功徳の光", mp: 23, kind: "heal", healMul: 1.8, cure: true, target: "all-ally", desc: "積んだ功徳が全員を癒し清める" },
    MONK_NEHAN: { name: "涅槃掌", mp: 30, kind: "phys", power: 3.4, pieScale: 0.5, critBonus: 0.3, acc: 0.8, target: "enemy", desc: "祈りを込めた掌。PIEが乗り会心が出やすい" },
  },
  perks: {
    // ランクのパッシブ: 練った気が、戦いの合間に傷を塞ぐ
    monkKikou: {
      label: "気功",
      lv: ["2ラウンド目から毎ラウンドの初めに、HPを最大の2%回復", "2ラウンド目から毎ラウンドの初めに、HPを最大の4%回復", "2ラウンド目から毎ラウンドの初めに、HPを最大の6%回復", "2ラウンド目から毎ラウンドの初めに、HPを最大の8%回復"],
      fx: [{ t: "round", hp: [0.02, 0.04, 0.06, 0.08] }],
    },
    // Lv15 の目玉パッシブ: 戦いの後の静かな瞑想
    monkMeisou: {
      label: "瞑想",
      lv: ["戦闘に勝つと、MPを最大の5%回復", "戦闘に勝つと、MPを最大の10%回復", "戦闘に勝つと、MPを最大の15%回復"],
      fx: [{ t: "win", mp: [0.05, 0.10, 0.15] }],
    },
    monkKudoku: { label: "功徳の拳", scope: "party", lv: ["物理技を使うと、味方全員のHP1%回復", "物理技を使うと、味方全員のHP1.5%回復", "物理技を使うと、味方全員のHP2%回復", "物理技を使うと、味方全員のHP2.5%回復"],
      fx: [{ t: "cast", on: "phys", party: true, hp: [0.01, 0.015, 0.02, 0.025] }] },
    monkJuzu: { label: "降魔の数珠", lv: ["物理が当たると10%で特技封じ (2ターン)", "物理が当たると15%で特技封じ (2ターン)", "物理が当たると20%で特技封じ (2ターン)"],
      fx: [{ t: "hit", chance: [0.1, 0.15, 0.2], ail: "seal", turns: 2 }] },
    monkRenkan: { label: "連環の拳", lv: ["敵を倒すとHP3%回復・STR×1.1 (3ターン)", "敵を倒すとHP4%回復・STR×1.15 (3ターン)", "敵を倒すとHP5%回復・STR×1.2 (3ターン)", "敵を倒すとHP6%回復・STR×1.25 (3ターン)"],
      fx: [{ t: "kill", hp: [0.03, 0.04, 0.05, 0.06], buff: { atk: [1.1, 1.15, 1.2, 1.25] } }] },
    monkFue: { label: "金剛不壊", lv: ["戦闘ごとに一度、致死をHP1で耐える", "戦闘ごとに一度致死を耐える・HP30%以下でSTR+10%", "戦闘ごとに一度致死を耐える・HP30%以下でSTR+20%"],
      fx: [{ t: "start", endure: true }, { t: "stat", when: { selfLow: 0.3 }, mul: { atk: [0, 0.1, 0.2] } }] },
    monkOuhou: { label: "応報の掌", lv: ["物理を受けた時20%で、受けた40%を打ち返す", "物理を受けた時30%で、受けた60%を打ち返す"],
      fx: [{ t: "hurt", chance: [0.2, 0.3], thorns: [0.4, 0.6] }] },
  },
};
