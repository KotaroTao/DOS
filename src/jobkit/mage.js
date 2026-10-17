// 全職見直し: 五属性を使い分け、敵の群れをまとめて崩す。ランクパッシブは維持。
// 魔導士 (mage) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
// 持ち味: 火・水・風・土・闇の五属性の基本呪文を一通り修める術者。属性を巡らせて撃ち続け、群れをなぐ。
export default {
  // ランクのパッシブ: 魂がランク2で目覚め、3・4・5で強まる (souls.js の JOB_PASSIVES)
  awaken: "mageKensan",
  table: `
    1 HALITO 3 ICENEEDLE 4 ISHITSUBUTE 5 afterMp/1 7 KAMAITACHI 8 SHADOWBOLT
    10 KATINO 12 MAGE_HYOUMU 15 manaFlow/1 18 MAHALITO 22 AQUAWAVE 25 spellCrit/1
    25 WINDSTORM 25 mageRansen/1 28 EARTHQUAKE 30 ROCKBLAST 35 afterMp/2 35 MAGE_GOGYOUKUZUSHI
    40 TILTOWAIT 50 MADALT 50 manaFlow/2 55 SEISHIN 55 LAHALITO 60 spellCrit/2
    65 mageMeguri/1 65 TORNADO 70 barrier/1 75 scan/1 75 RAITEI 75 mageMasokurai/1
    80 SEISAI 90 HYORETSU 100 manaFlow/3 105 ENBU 105 barrier/2 110 RAIJIN
    115 resistAilment/1 120 DAICHIWARI 130 HYOUGA 130 mageMeguri/2 135 spellCrit/3 135 mageMasokurai/2
    140 GOKUEN 145 mageOkibi/1 150 RAIMEIRAN 155 resistAilment/2 160 METEOR 170 ZETTAIREIDO
    180 GOKUENRAN 185 mageOkibi/2 190 KOKUUHA 195 TENPENCHII 200 KYOKUDAI`,
  skills: {
    // 序盤の固有技: 凍える霧で群れを撃ち、足を鈍らせる (水の全体・浅い版)
    MAGE_HYOUMU: {name: "氷霧", mp: 6, kind: "atk", power: 12, element: "water", debuff: {agi: 0.8}, target: "all-enemy", desc: "敵全体を水の霧で撃ち、素早さを1段下げる", dur: 3},
    // 五行の乱れで敵全体を撃ち、全属性への守りをわずかに緩める (属性崩しの全体・浅い版)
    MAGE_GOGYOUKUZUSHI: {name: "五行崩し", mp: 10, kind: "atk", power: 12, vuln: {all: 0.85}, target: "all-enemy", desc: "敵全体を無属性で撃ち、五属性を通すため全属性の守りを緩める", dur: 3},
  },
  perks: {
    // ランクのパッシブ: 研鑽を重ねた術式が、呪文そのものを強める
    mageKensan: {
      label: "魔導の研鑽",
      lv: ["攻撃呪文の与ダメージ+5%", "攻撃呪文の与ダメージ+10%", "攻撃呪文の与ダメージ+15%", "攻撃呪文の与ダメージ+25%"],
      fx: [{ t: "deal", on: "spell", v: [0.05, 0.10, 0.15, 0.25] }],
    },
    mageMeguri: {
      label: "五行の巡り",
      lv: ["属性の弱点を突いた攻撃呪文の与ダメージ+10%", "属性の弱点を突いた攻撃呪文の与ダメージ+18%", "属性の弱点を突いた攻撃呪文の与ダメージ+25%"],
      fx: [
        {t: "deal", on: "spell", when: {tgtWeak: true}, v: [0.1, 0.18, 0.25]},
      ],
    },
    mageMasokurai: {
      label: "魔素喰らい",
      lv: ["ブレス・呪文の被ダメージ-10%。受けるとMPを最大の3%回復", "ブレス・呪文の被ダメージ-20%。受けるとMPを最大の5%回復"],
      fx: [
        { t: "take", on: "breath", v: [0.1, 0.2] },
        { t: "hurt", on: "breath", mp: [0.03, 0.05] },
      ],
    },
    mageRansen: {
      label: "乱戦の詠唱",
      lv: ["敵が3体以上いる時、攻撃呪文の与ダメージ+15%"],
      fx: [{ t: "deal", on: "spell", when: { crowd: 3 }, v: [0.15] }],
    },
    mageOkibi: {
      label: "熾火の残心",
      lv: ["敵を倒すとMPを最大の1.5%回復。戦闘勝利後、HPを最大の4%回復", "敵を倒すとMPを最大の2%回復。戦闘勝利後、HPを最大の8%回復"],
      fx: [
        { t: "kill", mp: [0.015, 0.02] },
        { t: "win", hp: [0.04, 0.08] },
      ],
    },
  },
};
