// 大司教 (archbishop) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
// 持ち味: 聖典と水の祈り。聖水・泉・潮で癒し、聖句の加護 (不屈・魔障壁・守り) で隊を護る
export default {
  // ランクのパッシブ: 魂がランク2で目覚め、3・4・5で強まる (souls.js の JOB_PASSIVES)
  awaken: "archbishopShukufuku",
  table: `
    1 HOLYRAY 3 DIOS 5 kantei/2 5 CURE 7 CUREALL 10 BLESS 10 RECOVER 12 ICENEEDLE
    15 ARCHBISHOP_MAMORISEIKU 15 riseAgain/1 17 REGEN 17 RECOVERALL 20 DIOSALL 20 AWAKE
    25 archbishopChinka/1 25 AWAKEALL 30 DIAL 35 archbishopMamori/1 35 STONECURE 40 SEIKUNOKAGO
    45 archbishopMinasoko/1 45 STONECUREALL 50 REVIVE 50 riseAgain/2 55 ARCHBISHOP_SENREI 55 DIALALL
    60 archbishopMamori/2 60 MADIOS 62 ARCHBISHOP_SEISUINOYARI 65 PURIFY 70 archbishopChinka/2
    75 archbishopSeiten/1 80 PURIFYALL 85 ARCHBISHOP_NORITO 90 archbishopMinasoko/2 90 RESURRECT
    95 ARCHBISHOP_FUKADE 100 ARCHBISHOP_MEGUMI 100 riseAgain/3 105 archbishopMamori/3
    110 ARCHBISHOP_SEITENNOMAMORI 115 resistAilment/1 115 MADIOSALL 120 ARCHBISHOP_MICHISHIO
    125 popePrayer/1 130 ARCHBISHOP_FUUJI 135 archbishopChinka/3 140 ARCHBISHOP_ROUSHOU
    145 archbishopMinasoko/3 150 ARCHBISHOP_SHOUKU 155 archbishopSeiten/2 160 ARCHBISHOP_DAISENREI
    165 resistAilment/2 170 ARCHBISHOP_KOURIN 175 archbishopChinka/4 180 ARCHBISHOP_TAIKAI
    185 archbishopMamori/4 190 ARCHBISHOP_SABAKI 195 ARCHBISHOP_BAKUFU 200 ARCHBISHOP_SHUUSHOU`,
  skills: {
    // Lv15 の固有技: 聖句を唱えて癒し、致死を一度耐える加護を授ける
    ARCHBISHOP_MAMORISEIKU: { name: "護りの聖句", mp: 4, kind: "heal", healMul: 1, healCap: 0.5, grantEndure: true, target: "ally", desc: "聖句を唱えて癒し、致死を一度だけ耐える加護を授ける" },
    ARCHBISHOP_SENREI: { name: "洗礼の儀", mp: 9, kind: "buff", buff: { vit: 1.1 }, cure: ["sleep", "charm", "confuse"], target: "ally", desc: "一人の眠り・魅了・混乱を治し、守りを固める" },
    ARCHBISHOP_SEISUINOYARI: { name: "聖水の槍", mp: 9, kind: "atk", power: 27, element: "water", debuff: { atk: 0.85 }, target: "enemy", desc: "聖水の槍で貫き、敵の力を削ぐ" },
    ARCHBISHOP_NORITO: { name: "泉の祝詞", mp: 19, kind: "heal", healMul: 1.4, cure: ["poison", "paralyze", "sleep"], target: "all-ally", desc: "全員を癒し、毒・猛毒・麻痺・眠りを治す" },
    ARCHBISHOP_FUKADE: { name: "深淵の湧水", mp: 7, kind: "heal", healMul: 2.2, purge: true, target: "ally", desc: "深手を塞ぎ、弱体も洗い流す" },
    ARCHBISHOP_MEGUMI: { name: "恵みの雨", mp: 12, kind: "buff", regen: { pct: 0.06, turns: 4 }, buff: { vit: 1.1 }, target: "all-ally", desc: "恵みの雨が全員を癒し続け、守りを固める" },
    ARCHBISHOP_SEITENNOMAMORI: { name: "聖典の守り", mp: 16, kind: "buff", buff: { vit: 1.25 }, grantBarrier: 1, target: "all-ally", desc: "全員の守りを上げ、魔障壁を授ける" },
    ARCHBISHOP_MICHISHIO: { name: "満ち潮の祈り", mp: 23, kind: "heal", healMul: 1.8, regen: { pct: 0.03, turns: 3 }, target: "all-ally", desc: "満ちる潮が全員を癒し、癒しを残す" },
    ARCHBISHOP_FUUJI: { name: "封じの聖句", mp: 22, kind: "atk", power: 58, element: "light", seal: { chance: 0.5, turns: 3 }, debuff: { atk: 0.9 }, target: "enemy", desc: "聖句の光が特技を封じ、力を削ぐ" },
    ARCHBISHOP_ROUSHOU: { name: "聖典の朗唱", mp: 20, kind: "heal", healMul: 1.5, buff: { vit: 1.15 }, debuffAll: { atk: 0.9 }, target: "all-ally", desc: "全員を癒し守り、敵の気勢を削ぐ" },
    ARCHBISHOP_SHOUKU: { name: "光の章句", mp: 28, kind: "atk", power: 80, element: "light", debuff: { hit: 0.85 }, target: "enemy", desc: "まばゆい章句が一体を撃ち、目を眩ます" },
    ARCHBISHOP_DAISENREI: { name: "大洗礼", mp: 83, kind: "heal", healMul: 1.3, revive: true, revivePct: 0.55, grantBarrier: 1, target: "all-ally", desc: "倒れた者をHP55%で呼び、魔障壁を授ける" },
    ARCHBISHOP_KOURIN: { name: "聖典の光輪", mp: 20, kind: "atk", power: 44, element: "light", flinchChance: 0.2, target: "all-enemy", desc: "光輪が敵全体を灼き、怯ませる" },
    ARCHBISHOP_TAIKAI: { name: "大海の祝福", mp: 29, kind: "heal", healMul: 1.9, cure: true, regen: { pct: 0.04, turns: 3 }, target: "all-ally", desc: "大海の恵みが全員を癒し清め続ける" },
    ARCHBISHOP_SABAKI: { name: "審きの聖句", mp: 30, kind: "atk", power: 62, element: "light", seal: { chance: 0.35, turns: 2 }, target: "all-enemy", desc: "審きの聖句が全敵を灼き、特技を封じる" },
    ARCHBISHOP_BAKUFU: { name: "聖水の瀑布", mp: 28, kind: "atk", power: 56, element: "light", vuln: { light: 0.75, water: 0.8 }, target: "all-enemy", desc: "聖水の瀑布が全敵の光と水の守りを崩す" },
    ARCHBISHOP_SHUUSHOU: { name: "聖典の終章", mp: 120, kind: "heal", healPct: 1, revive: true, revivePct: 0.7, cure: true, purge: true, grantBarrier: 1, target: "all-ally", desc: "全員を全快させ蘇らせ、魔障壁を授ける" },
  },
  perks: {
    // ランクのパッシブ: 大司教の祈りは、癒しをいっそう深くする
    archbishopShukufuku: {
      label: "大いなる祝福",
      lv: ["回復呪文の効果+20%", "回復呪文の効果+40%", "回復呪文の効果+60%", "回復呪文の効果+100%"],
      fx: [{ t: "heal", v: [0.20, 0.40, 0.60, 1.00] }],
    },
    archbishopMinasoko: { label: "水底の祈り", scope: "party", lv: ["2ラウンド目から毎ラウンド、味方全員のHP1%回復", "2ラウンド目から毎ラウンド、味方全員のHP1.5%回復", "2ラウンド目から毎ラウンド、味方全員のHP2%回復", "2ラウンド目から毎ラウンド、味方全員のHP2.5%回復"],
      fx: [{ t: "round", party: true, hp: [0.01, 0.015, 0.02, 0.025] }] },
    archbishopSeiten: { label: "聖典の護り", scope: "party", lv: ["戦闘開始時35%で、味方全員に魔障壁1回", "戦闘開始時55%で、味方全員に魔障壁1回", "戦闘開始時75%で、味方全員に魔障壁1回"],
      fx: [{ t: "start", chance: [0.35, 0.55, 0.75], party: true, barrier: 1 }] },
    archbishopChinka: { label: "鎮火の聖句", scope: "party", lv: ["火の敵への呪文ダメージ+12%・味方全員の火の敵からの被ダメージ−4%", "火の敵への呪文ダメージ+18%・味方全員の火の敵からの被ダメージ−6%", "火の敵への呪文ダメージ+24%・味方全員の火の敵からの被ダメージ−8%", "火の敵への呪文ダメージ+30%・味方全員の火の敵からの被ダメージ−10%"],
      fx: [{ t: "deal", on: "spell", when: { tgtElem: "fire" }, v: [0.12, 0.18, 0.24, 0.3] }, { t: "take", aura: true, when: { tgtElem: "fire" }, v: [0.04, 0.06, 0.08, 0.1] }] },
    archbishopMamori: { label: "傷を覆う祈り", scope: "party", lv: ["HP50%以下の味方の被ダメージ−5%", "HP50%以下の味方の被ダメージ−8%", "HP50%以下の味方の被ダメージ−11%", "HP50%以下の味方の被ダメージ−14%"],
      fx: [{ t: "take", aura: true, when: { selfLow: 0.5 }, v: [0.05, 0.08, 0.11, 0.14] }] },
  },
};
