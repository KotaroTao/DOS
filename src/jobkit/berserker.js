// 狂戦士 (berserker) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
// 狂戦士 = 捨て身と血。己の血を代償 (hpCost) に重い一撃、斬って啜る (drain)、傷が深いほど猛る
export default {
  // ランクのパッシブ: 魂がランク2で目覚め、3・4・5で強まる (souls.js の JOB_PASSIVES)
  awaken: "berserkerKyouhon",
  table: `
    1 KYOUGEKI 2 KAENGIRI 3 NERAIUCHI 5 berserkerMukui/1 7 SUTEMI 10 BERSERKER_CHIZOME
    12 YAMIBA 15 BERSERKER_ABAREUCHI 15 berserkerChinonioi/1 20 BERSERKER_HOUKOU 22 KAENNAGI 25 berserkerTakeri/1 30 CHINOKAWAKI
    35 berserkerFukade/1 40 KIJINKUDAKI 45 berserkerTeoi/1 50 BERSERKER_HONEKUDAKI 50 berserkerChinonioi/2 55 SHINGANGEKI 57 GURENZAN
    60 berserkerMukui/2 65 BERSERKER_KUIKOMI 70 berserkerTakeri/2 75 endure/1 80 BERSERKER_KURAISAKI 82 MEIJIN
    85 MIDARE 90 berserkerTeoi/2 95 BERSERKER_FUKKETSU 100 BERSERKER_TATAKIWARI 100 berserkerChinonioi/3 105 berserkerMukui/3 107 BERSERKER_KEKKEN
    110 SHURAZAN 115 berserkerTakeri/3 120 BERSERKER_BOUGYAKU 125 berserkerFukade/2 130 BERSERKER_CHIKAZAGURUMA 135 asceticism/1
    140 MEIFUZAN 145 resistAilment/1 150 BERSERKER_DANTOUDAI 155 berserkerTeoi/3 160 BERSERKER_KETSUEN 162 BERSERKER_ENGOKU
    165 endure/2 170 BERSERKER_METTAUCHI 175 berserkerChiniyou/1 180 TOKOYAMI 185 berserkerChiniyou/2 190 BERSERKER_KYOUOU
    195 BERSERKER_YATSUZAKI 200 BERSERKER_SENKETSU`,
  skills: {
    // Lv15 の固有技: 狂ったように三度打ち据える。傷が深いほど重い
    BERSERKER_ABAREUCHI: { name: "暴れ打ち", mp: 6, kind: "phys", power: 0.7, hits: 3, acc: 0.2, desperate: true, target: "enemy", desc: "狂ったように三度打ち据える。傷が深いほど重い" },
    BERSERKER_CHIZOME: { name: "血染めの斧", mp: 6, kind: "phys", power: 1.9, hpCost: 0.06, acc: 0.3, target: "enemy", desc: "己の血を代償に重く叩きつける" },
    BERSERKER_HOUKOU: { name: "血の咆哮", mp: 6, kind: "debuff", debuff: { vit: 0.85 }, flinchChance: 0.25, target: "all-enemy", tech: true, desc: "血走った咆哮で敵陣を竦ませ、守りを崩す" },
    BERSERKER_HONEKUDAKI: { name: "骨砕き", mp: 10, kind: "phys", power: 2.5, pierce: 0.2, acc: 0.4, flinchChance: 0.3, target: "enemy", desc: "骨ごと叩き砕き、怯ませる" },
    BERSERKER_KUIKOMI: { name: "狂気の食い縛り", mp: 3, kind: "buff", charge: 2.3, hpCost: 0.08, target: "self", tech: true, desc: "己の肉を噛み、次の物理を2.3倍にする" },
    BERSERKER_KURAISAKI: { name: "喰らい裂き", mp: 16, kind: "phys", power: 3.5, pierce: 0.4, acc: 0.7, drain: 0.25, target: "enemy", desc: "鎧ごと噛み裂き、血を啜る" },
    BERSERKER_FUKKETSU: { name: "沸血", mp: 12, kind: "buff", buff: { atk: 1.5 }, regen: { pct: 0.05, turns: 3 }, target: "self", tech: true, desc: "血を沸かせて攻撃力を上げ、傷を塞ぐ" },
    BERSERKER_TATAKIWARI: { name: "叩き割り", mp: 14, kind: "phys", power: 2.3, acc: 0.6, strip: true, debuff: { vit: 0.8 }, target: "enemy", desc: "強化ごと叩き割り、守りを崩す" },
    BERSERKER_KEKKEN: { name: "血焔斬", mp: 20, kind: "phys", power: 5.2, element: "fire", acc: 0.6, poison: { chance: 0.4, pct: 0.04 }, target: "enemy", desc: "血を燃やす焔の刃。焼けただれさせる" },
    BERSERKER_BOUGYAKU: { name: "暴虐の一撃", mp: 24, kind: "phys", power: 6.8, acc: 0.8, hpCost: 0.1, target: "enemy", desc: "身を削って放つ暴虐の一撃" },
    BERSERKER_CHIKAZAGURUMA: { name: "血風車", mp: 18, kind: "phys", power: 1.8, acc: 0.5, drain: 0.15, target: "all-enemy", desc: "斧を振り回して敵陣をなぎ、血を啜る" },
    BERSERKER_DANTOUDAI: { name: "断頭台", mp: 28, kind: "phys", power: 6.5, acc: 0.9, pierce: 0.3, execute: 1.6, target: "enemy", desc: "弱った敵の首を落とす断頭の一撃" },
    BERSERKER_KETSUEN: { name: "血宴", mp: 30, kind: "phys", power: 2.6, desperate: true, acc: 0.8, target: "all-enemy", desc: "傷が深いほど激しく敵陣を斬り乱す" },
    BERSERKER_ENGOKU: { name: "焔獄なぎ", mp: 28, kind: "phys", power: 2.4, element: "fire", acc: 0.6, debuff: { vit: 0.85 }, target: "all-enemy", desc: "焔で敵陣をなぎ、鎧を焼き脆くする" },
    BERSERKER_METTAUCHI: { name: "滅多打ち", mp: 16, kind: "phys", power: 0.72, hits: 5, acc: 0.4, flinchChance: 0.2, target: "enemy", desc: "身を顧みず五度叩きつけ、怯ませる" },
    BERSERKER_KYOUOU: { name: "狂王の鉄槌", mp: 32, kind: "phys", power: 7.5, acc: 1, desperate: true, target: "enemy", desc: "必中。傷が深いほど重い狂王の一撃" },
    BERSERKER_YATSUZAKI: { name: "八つ裂き", mp: 24, kind: "phys", power: 0.55, hits: 8, acc: 0.6, target: "enemy", desc: "八度切り裂く狂乱の連撃" },
    BERSERKER_SENKETSU: { name: "鮮血の終焉", mp: 40, kind: "phys", power: 11.5, acc: 1, pierce: 0.8, hpCost: 0.15, drain: 0.2, target: "enemy", desc: "血を捧げる必中の終撃。命を吸い返す" },
  },
  perks: {
    // Lv15 の目玉パッシブ: 血の匂いが常に体を昂らせる
    berserkerChinonioi: {
      label: "血の匂い",
      lv: ["戦闘中の攻撃力+10%", "戦闘中の攻撃力+20%", "戦闘中の攻撃力+30%"],
      fx: [{ t: "stat", mul: { atk: [0.10, 0.20, 0.30] } }],
    },
    // 斬られた痛みをそのまま相手に叩き返す
    berserkerMukui: {
      label: "血の報い",
      lv: ["物理を受けると25%で、受けたダメージの50%を返す", "物理を受けると30%で、受けたダメージの75%を返す",
        "物理を受けると35%で、受けたダメージの100%を返す"],
      fx: [{ t: "hurt", chance: [0.25, 0.3, 0.35], thorns: [0.5, 0.75, 1.0] }],
    },
    // 深手を負うほど獣じみて強くなる
    berserkerTeoi: {
      label: "手負いの獣",
      lv: ["HP40%以下の間、攻撃力+20%・会心+4%", "HP40%以下の間、攻撃力+30%・会心+8%",
        "HP40%以下の間、攻撃力+42%・会心+12%", "HP40%以下の間、攻撃力+55%・会心+16%"],
      fx: [
        { t: "stat", mul: { atk: [0.2, 0.3, 0.42, 0.55] }, when: { selfLow: 0.4 } },
        { t: "crit", v: [0.04, 0.08, 0.12, 0.16], when: { selfLow: 0.4 } },
      ],
    },
    // 開戦から守りを捨てて猛り狂う
    berserkerTakeri: {
      label: "猛り狂う",
      lv: ["戦闘開始時、攻撃力×1.15・防御×0.9 (3ターン)", "戦闘開始時、攻撃力×1.22・防御×0.9 (3ターン)",
        "戦闘開始時、攻撃力×1.3・防御×0.9 (3ターン)"],
      fx: [{ t: "start", buff: { atk: [1.15, 1.22, 1.3], vit: [0.9, 0.9, 0.9] }, dur: 3 }],
    },
    // 弱った獲物の傷口を抉る
    berserkerFukade: {
      label: "深手抉り",
      lv: ["HP50%以下の敵への物理の与ダメージ+12%", "HP50%以下の敵への物理の与ダメージ+20%"],
      fx: [{ t: "deal", v: [0.12, 0.2], on: "phys", when: { tgtLow: 0.5 } }],
    },
    // 返り血に酔い、傷が塞がる
    berserkerChiniyou: {
      label: "血に酔う",
      lv: ["敵を倒すとHP6%回復", "敵を倒すとHP10%回復"],
      fx: [{ t: "kill", hp: [0.06, 0.1] }],
    },
  },
};
