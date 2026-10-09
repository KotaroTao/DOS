// 魔導士 (mage) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
// 持ち味: 火・水・風・土・闇の五属性の基本呪文を一通り修める術者。属性を巡らせて撃ち続け、群れをなぐ。
export default {
  // ランクのパッシブ: 魂がランク2で目覚め、3・4・5で強まる (souls.js の JOB_PASSIVES)
  awaken: "mageKensan",
  table: `
    1 HALITO 3 ICENEEDLE 4 ISHITSUBUTE 5 afterMp/1 7 KAMAITACHI 8 SHADOWBOLT
    10 KATINO 15 MAGE_HYOUMU 15 manaFlow/1 20 MAHALITO 22 AQUAWAVE 25 spellCrit/1 27 WINDSTORM
    30 ROCKBLAST 32 EARTHQUAKE 35 afterMp/2 40 TILTOWAIT 45 mageMeguri/1 50 MADALT 50 manaFlow/2
    55 SEISHIN 57 MAGE_GOGYOUKUZUSHI 60 spellCrit/2 65 LAHALITO 70 barrier/1 72 TORNADO
    75 scan/1 80 SEISAI 85 RAITEI 90 mageMasokurai/1 95 HYORETSU 100 ENBU 100 manaFlow/3
    105 barrier/2 110 RAIJIN 115 resistAilment/1 120 DAICHIWARI 125 mageRansen/1 130 HYOUGA
    135 spellCrit/3 140 GOKUEN 145 mageOkibi/1 150 RAIMEIRAN 155 resistAilment/2 160 METEOR
    165 mageMeguri/2 170 ZETTAIREIDO 175 mageMasokurai/2 180 GOKUENRAN 185 mageOkibi/2 190 KOKUUHA
    195 TENPENCHII 200 KYOKUDAI`,
  skills: {
    // Lv15 の固有技: 凍える霧で群れを撃ち、足を鈍らせる (水の全体・浅い版)
    MAGE_HYOUMU: { name: "氷霧", mp: 5, kind: "atk", power: 14, element: "water", debuff: { agi: 0.85 }, target: "all-enemy", desc: "凍える霧が敵全体を撃ち、動きを鈍らせる" },
    // 五行の乱れで敵全体を撃ち、全属性への守りをわずかに緩める (属性崩しの全体・浅い版)
    MAGE_GOGYOUKUZUSHI: { name: "五行崩し", mp: 9, kind: "atk", power: 14, vuln: { all: 0.88 }, target: "all-enemy", desc: "五行の乱れで敵全体を撃ち、全属性の守りを緩める" },
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
      lv: ["攻撃呪文の後、15%で消費MPが戻る", "攻撃呪文の後、25%で消費MPが戻る", "攻撃呪文の後、32%で消費MPが戻る"],
      fx: [{ t: "cast", on: "atk", chance: [0.15, 0.25, 0.32], refund: true }],
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
