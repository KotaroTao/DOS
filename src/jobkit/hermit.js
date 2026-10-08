// 隠修士 (hermit) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
// 持ち味: 霞と風の隠者。霞で敵の目と足を奪い、風で裂き、山の湧水と秘薬で癒し続ける。打たれれば風のように身を翻す
export default {
  // ランクのパッシブ: 魂がランク2で目覚め、3・4・5で強まる (souls.js の JOB_PASSIVES)
  awaken: "hermitSenyaku",
  table: `
    1 HERMIT_SEIFUU 3 DIOS 5 hermitYoujou/1 7 GENWAKU 10 KASUMIGAKURE 10 CURE 15 HERMIT_YAMANOYUUSUI
    15 hermitZokusei/1 17 HOLYLIGHT 20 REGEN 20 RECOVER 22 HERMIT_KAZEHAFURI 25 hermitMinokonashi/1
    30 HERMIT_NEMURIGASUMI 30 DIOSALL 30 AWAKE 35 hermitNigemizu/1 37 HERMIT_YAMAOROSHI 40 KASUMINOTOBARI
    40 DIAL 45 hermitYoujou/2 50 STONECURE 50 hermitZokusei/2 55 HERMIT_KIRIGOME 60 hermitIori/1 60 REVIVE
    60 DIALALL 70 hermitYoujou/3 72 HERMIT_KOGARASHI 75 hermitMinokonashi/2 80 MADIOS 85 HERMIT_YAKUSOUARAI
    90 poisonFloor/1 95 HERMIT_ASATSUYU 100 PURIFY 100 hermitZokusei/3 105 hermitIori/2 110 HERMIT_KOMOREBI
    115 hermitYoujou/4 120 HERMIT_KUNPUU 125 resistAilment/1 130 HERMIT_SHINKIROU 135 hermitNigemizu/2
    140 HERMIT_YUUSUI 142 HERMIT_KAMINARI 145 hermitMinokonashi/3 150 HERMIT_MIYAMA 155 hermitIori/3
    160 HERMIT_KANKON 165 resistAilment/2 170 HERMIT_HIYAKU 172 HERMIT_TENGUKAZE 175 mercy/1
    180 HERMIT_OOHARAE 185 hermitNigemizu/3 190 HERMIT_GYOUKOU 195 HERMIT_SEISOU 200 HERMIT_FUKUIN`,
  skills: {
    HERMIT_YAKUSOUARAI: { name: "薬草の清流", mp: 10, kind: "cure", cure: ["poison", "paralyze", "stone"], target: "all-ally", desc: "味方全員の毒・猛毒・麻痺・石化を治す" },
    // Lv15 の固有技: 山の湧水を分け与え、隊を癒し続ける
    HERMIT_YAMANOYUUSUI: { name: "山の湧水", mp: 13, kind: "heal", healMul: 0.8, healCap: 0.5, regen: { pct: 0.02, turns: 3 }, target: "all-ally", desc: "山の湧水を分け与え、味方全員を癒して、癒しを続かせる" },
    // 祈りの風 (INT と PIE の高い方で伸びる faith)。共通の風の呪文は INT 依存で隠修士 (PIE型) に合わないので置き換える
    HERMIT_SEIFUU:     { name: "清風の祈り", mp: 4, kind: "atk", power: 17, element: "wind", faith: true, target: "enemy", desc: "祈りを乗せた清らかな風の刃（PIEでも伸びる）" },
    HERMIT_KAZEHAFURI: { name: "風祝", mp: 6, kind: "atk", power: 20, element: "wind", faith: true, target: "all-enemy", desc: "風の神への祈りが敵全体を吹き払う（PIEでも伸びる）" },
    HERMIT_KAMINARI:   { name: "神鳴り", mp: 24, kind: "atk", power: 76, element: "wind", para: 0.3, faith: true, target: "enemy", desc: "神の怒りの雷で撃ち、痺れさせる（PIEでも伸びる）" },
    HERMIT_NEMURIGASUMI: { name: "眠り霞", mp: 4, kind: "debuff", sleepChance: 0.5, debuff: { agi: 0.9 }, target: "all-enemy", desc: "眠りを誘う霞で敵全体を包む" },
    HERMIT_YAMAOROSHI: { name: "山颪", mp: 9, kind: "atk", power: 25, element: "wind", flinchChance: 0.25, faith: true, target: "enemy", desc: "吹き下ろす山風で打ち、怯ませる（PIEでも伸びる）" },
    HERMIT_KIRIGOME: { name: "霧籠め", mp: 8, kind: "debuff", debuff: { agi: 0.75, hit: 0.9 }, target: "all-enemy", desc: "濃霧に籠め、敵全体の足と狙いを鈍らす" },
    HERMIT_KOGARASHI: { name: "木枯らし", mp: 12, kind: "atk", power: 30, element: "wind", debuff: { atk: 0.9 }, faith: true, target: "all-enemy", desc: "凍てつく風が敵全体の力を奪う（PIEでも伸びる）" },
    HERMIT_ASATSUYU: { name: "朝露の恵み", mp: 12, kind: "buff", regen: { pct: 0.06, turns: 4 }, cure: ["poison", "paralyze", "sleep"], target: "all-ally", desc: "全員の毒・猛毒・麻痺・眠りを洗い流し、癒しを残す" },
    HERMIT_KOMOREBI: { name: "木漏れ日", mp: 9, kind: "atk", power: 21, element: "light", sleepChance: 0.15, target: "all-enemy", desc: "まどろむ光で敵全体を灼き、眠らせる" },
    HERMIT_KUNPUU: { name: "薫風の癒し", mp: 19, kind: "heal", healMul: 1.4, buff: { agi: 1.1 }, target: "all-ally", desc: "薫る風が全員を癒し、身を軽くする" },
    HERMIT_SHINKIROU: { name: "蜃気楼", mp: 8, kind: "debuff", debuff: { hit: 0.8 }, charm: 0.2, target: "all-enemy", desc: "幻の像で狙いを外させ、惑わせる" },
    HERMIT_YUUSUI: { name: "仙境の湧水", mp: 24, kind: "heal", healMul: 1.9, cure: true, target: "all-ally", desc: "仙境の水が全員を大きく癒し清める" },
    HERMIT_MIYAMA: { name: "深山の祈り", mp: 21, kind: "heal", healMul: 1.2, purge: true, regen: { pct: 0.05, turns: 3 }, target: "all-ally", desc: "全員を癒し、弱体を解いて癒しを残す" },
    HERMIT_KANKON: { name: "還魂の風", mp: 60, kind: "heal", revive: true, revivePct: 0.75, debuffAll: { agi: 0.85 }, target: "ally", desc: "風が魂を還す(75%)。敵の足も鈍る" },
    HERMIT_HIYAKU: { name: "仙人の秘薬", mp: 7, kind: "heal", healMul: 2.2, regen: { pct: 0.04, turns: 3 }, target: "ally", desc: "秘薬で深手を塞ぎ、癒し続ける" },
    HERMIT_TENGUKAZE: { name: "天狗風", mp: 22, kind: "atk", power: 58, element: "wind", confuse: 0.15, faith: true, target: "all-enemy", desc: "天狗の風が吹き荒れ、敵を惑わす（PIEでも伸びる）" },
    HERMIT_OOHARAE: { name: "霞の大祓", mp: 30, kind: "heal", healMul: 2, cure: true, purge: true, debuffAll: { hit: 0.85 }, target: "all-ally", desc: "全員を癒し祓い、霞で敵の目を覆う" },
    HERMIT_GYOUKOU: { name: "暁光一閃", mp: 28, kind: "atk", power: 82, element: "light", strip: true, target: "enemy", desc: "暁の光が一体を貫き、強化を剥ぐ" },
    HERMIT_SEISOU: { name: "星霜の光", mp: 22, kind: "atk", power: 52, element: "light", debuff: { hit: 0.85 }, target: "all-enemy", desc: "星の光が全敵を灼き、目を眩ます" },
    HERMIT_FUKUIN: { name: "仙境の福音", mp: 75, kind: "heal", healMul: 1.4, revive: true, revivePct: 0.5, buff: { agi: 1.15 }, target: "all-ally", desc: "倒れた者をHP50%で呼び、全員を軽くする" },
  },
  perks: {
    hermitYoujou: { label: "草庵の養生", lv: ["2ラウンド目から毎ラウンドHP2%・MP1%回復", "2ラウンド目から毎ラウンドHP3%・MP1.5%回復", "2ラウンド目から毎ラウンドHP4%・MP2%回復", "2ラウンド目から毎ラウンドHP5%・MP2.5%回復"],
      fx: [{ t: "round", hp: [0.02, 0.03, 0.04, 0.05], mp: [0.01, 0.015, 0.02, 0.025] }] },
    hermitMinokonashi: { label: "霞の身ごなし", lv: ["敵の物理を4%でかわす", "敵の物理を7%でかわす", "敵の物理を10%でかわす"],
      fx: [{ t: "evade", v: [0.04, 0.07, 0.1] }] },
    hermitNigemizu: { label: "逃げ水", lv: ["物理を受けた時30%で、AGI×1.15 (2ターン)", "物理を受けた時40%で、AGI×1.2 (2ターン)", "物理を受けた時50%で、AGI×1.25 (2ターン)"],
      fx: [{ t: "hurt", chance: [0.3, 0.4, 0.5], buff: { agi: [1.15, 1.2, 1.25] }, dur: 2 }] },
    hermitIori: { label: "霞の庵", scope: "party", lv: ["戦闘開始時、味方全員のAGI×1.08 (3ターン)", "戦闘開始時、味方全員のAGI×1.12 (3ターン)", "戦闘開始時、味方全員のAGI×1.15 (3ターン)"],
      fx: [{ t: "start", party: true, buff: { agi: [1.08, 1.12, 1.15] }, dur: 3 }] },
  },
};
