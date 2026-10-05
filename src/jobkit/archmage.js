// 大魔導 (archmage) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
// 持ち味: 闇と土を極めた極大呪文の使い手。詠唱を重ねて INT を積み上げ、二重の烙印で守りを剥いでから大火力を叩き込む。
export default {
  // ランクのパッシブ: 魂がランク2で目覚め、3・4・5で強まる (souls.js の JOB_PASSIVES)
  awaken: "archmageShinen",
  table: `
    1 HALITO 3 SHADOWBOLT 4 ISHITSUBUTE 5 archmageJuushou/1 7 ICENEEDLE 8 KAMAITACHI
    10 ARCHMAGE_JUUEI 15 ARCHMAGE_KOKUYOU 15 archmageChoei/1 20 MAHALITO 22 EARTHQUAKE 25 archmageUtsuwa/1 30 ARCHMAGE_GANSOU
    35 archmageMasen/1 40 SHINENNOHADOU 45 archmageJuushou/2 47 DARKBLAST 50 MADALT 50 archmageChoei/2 55 ELEMBREAK
    60 archmageUtsuwa/2 62 ARCHMAGE_DOSEKIRYUU 65 ARCHMAGE_GOUKARIN 70 archmageMakaku/1 75 archmageMeido/1 80 ARCHMAGE_TENKYUU
    85 ARCHMAGE_NIJUUIN 90 archmageMasen/2 95 ARCHMAGE_SOUCHUU 100 ARCHMAGE_YOUGAN 100 archmageChoei/3 105 archmageJuushou/3 110 ARCHMAGE_TENMEI
    112 ARCHMAGE_MEIOU 115 archmageMakaku/2 120 ARCHMAGE_NARAKU 125 resistAilment/1 130 ARCHMAGE_GOKKAN 135 archmageUtsuwa/3
    140 ARCHMAGE_SHOUKON 145 archmageMeido/2 150 ARCHMAGE_RAIGOU 155 archmageMasen/3 160 ARCHMAGE_INTETSU 165 resistAilment/2
    170 ARCHMAGE_EIKYUU 172 ARCHMAGE_AGITO 175 archmageMakaku/3 177 ARCHMAGE_TOKOYAMI 180 ARCHMAGE_SHUUEN 185 archmageJuushou/4
    190 ARCHMAGE_SHINENKOU 195 ARCHMAGE_SOUSEI 200 ARCHMAGE_BANSHOU`,
  skills: {
    // Lv15 の固有技: 黒曜の槍で守りを砕く闇の呪文
    ARCHMAGE_KOKUYOU: { name: "黒曜の槍", mp: 5, kind: "atk", power: 20, element: "dark", debuff: { vit: 0.85 }, target: "enemy", desc: "黒曜の槍を撃ち込み、守りを砕く（闇）" },
    ARCHMAGE_JUUEI:      { name: "重詠の構え", mp: 4, kind: "buff", buff: { int: 1.5, agi: 0.8 }, target: "self", desc: "詠唱を重ねる構え。INT大幅上昇・素早さ低下" },
    ARCHMAGE_GANSOU:     { name: "岩葬の礫", mp: 8, kind: "atk", power: 28, element: "earth", debuff: { vit: 0.85 }, target: "enemy", desc: "墓石の礫で打ち据え、守りを砕く" },
    ARCHMAGE_DOSEKIRYUU: { name: "土石の奔流", mp: 12, kind: "atk", power: 32, element: "earth", debuff: { agi: 0.85 }, target: "all-enemy", desc: "土石流が敵全体を呑み、足を奪う" },
    ARCHMAGE_GOUKARIN:   { name: "劫火の大輪", mp: 16, kind: "atk", power: 44, element: "fire", critBonus: 0.15, target: "all-enemy", desc: "劫火の大輪が咲く。会心しやすい" },
    ARCHMAGE_TENKYUU:    { name: "天球崩落", mp: 22, kind: "atk", power: 58, vuln: { all: 0.9 }, target: "all-enemy", desc: "砕けた天球が降り、全属性の守りを綻ばす" },
    ARCHMAGE_NIJUUIN:    { name: "二重の烙印", mp: 6, kind: "debuff", vuln: { dark: 0.7, earth: 0.7 }, target: "enemy", desc: "闇と土への守りを深く焼き剥がす" },
    ARCHMAGE_SOUCHUU:    { name: "霜柱のくさび", mp: 14, kind: "atk", power: 36, element: "water", flinchChance: 0.35, target: "enemy", desc: "地より突き上がる霜柱。怯ませる" },
    ARCHMAGE_YOUGAN:     { name: "熔岩流", mp: 14, kind: "atk", power: 36, element: "fire", poison: { chance: 0.35, pct: 0.04 }, target: "all-enemy", desc: "熔岩が敵全体を焼き、爛れが蝕む（毒）" },
    ARCHMAGE_TENMEI:     { name: "天鳴の大槌", mp: 16, kind: "atk", power: 42, element: "wind", debuff: { hit: 0.85 }, target: "all-enemy", desc: "天を鳴らす雷槌。敵の狙いを乱す" },
    ARCHMAGE_MEIOU:      { name: "冥王の顎", mp: 21, kind: "atk", power: 62, element: "dark", mpDrain: 0.1, target: "enemy", desc: "冥王の顎が魂を噛み、魔力を奪う" },
    ARCHMAGE_NARAKU:     { name: "奈落穿ち", mp: 16, kind: "atk", power: 46, element: "earth", critBonus: 0.2, target: "enemy", desc: "大地の底まで穿つ。会心しやすい" },
    ARCHMAGE_GOKKAN:     { name: "極寒の帳", mp: 20, kind: "atk", power: 52, element: "water", para: 0.1, target: "all-enemy", desc: "凍てつく帳が敵全体を包み、痺れさせる" },
    ARCHMAGE_SHOUKON:    { name: "焼魂のくさび", mp: 20, kind: "atk", power: 58, element: "fire", vuln: { fire: 0.8 }, target: "enemy", desc: "魂に火のくさびを打ち、火への守りを焼く" },
    ARCHMAGE_RAIGOU:     { name: "雷轟の重奏", mp: 22, kind: "atk", power: 60, element: "wind", confuse: 0.15, target: "all-enemy", desc: "重なる雷鳴が頭蓋を揺らし、混乱させる" },
    ARCHMAGE_INTETSU:    { name: "隕鉄の審判", mp: 26, kind: "atk", power: 74, element: "earth", debuff: { vit: 0.85 }, target: "all-enemy", desc: "隕鉄の雨が敵全体の守りを砕く" },
    ARCHMAGE_EIKYUU:     { name: "永久凍土", mp: 26, kind: "atk", power: 84, element: "water", debuff: { agi: 0.75 }, target: "enemy", desc: "永久に凍る大地へ縫い留め、足を奪う" },
    ARCHMAGE_AGITO:      { name: "大地の顎", mp: 26, kind: "atk", power: 80, element: "earth", seal: { chance: 0.5, turns: 3 }, target: "enemy", desc: "裂けた大地が噛み砕き、特技を封じる" },
    ARCHMAGE_TOKOYAMI:   { name: "常闇の大渦", mp: 28, kind: "atk", power: 74, element: "dark", debuff: { atk: 0.88 }, target: "all-enemy", desc: "常闇の渦が敵全体を呑み、力を削ぐ" },
    ARCHMAGE_SHUUEN:     { name: "終焉の焔", mp: 30, kind: "atk", power: 84, element: "fire", flinchChance: 0.2, target: "all-enemy", desc: "終焉の焔が戦場を焼き、怯ませる" },
    ARCHMAGE_SHINENKOU:  { name: "深淵の口", mp: 30, kind: "atk", power: 92, element: "dark", instakill: { chance: 0.12 }, target: "enemy", desc: "深淵が口を開けて呑む。稀に即死" },
    ARCHMAGE_SOUSEI:     { name: "創世の崩落", mp: 36, kind: "atk", power: 100, strip: true, target: "all-enemy", desc: "創世の理を崩し、強化ごと敵を砕く（無属性）" },
    ARCHMAGE_BANSHOU:    { name: "万象崩壊", mp: 46, kind: "atk", power: 132, critBonus: 0.15, target: "all-enemy", desc: "重ねた詠唱で万象を砕く極大呪文（無属性）" },
  },
  perks: {
    archmageJuushou: {
      label: "重唱の昂り",
      lv: ["2ラウンド目から毎ラウンド、INT×1.04 (2段まで重なる)", "2ラウンド目から毎ラウンド、INT×1.07 (2段まで重なる)",
        "2ラウンド目から毎ラウンド、INT×1.10 (2段まで重なる)", "2ラウンド目から毎ラウンド、INT×1.12 (2段まで重なる)"],
      fx: [{ t: "round", buff: { int: [1.04, 1.07, 1.1, 1.12] }, dur: 2 }],
    },
    archmageMeido: {
      label: "闇と土の極意",
      lv: ["闇・土の攻撃呪文の与ダメージ+8%", "闇・土の攻撃呪文の与ダメージ+14%", "闇・土の攻撃呪文の与ダメージ+20%"],
      fx: [
        { t: "deal", on: "spell", when: { elem: "dark" }, v: [0.08, 0.14, 0.2] },
        { t: "deal", on: "spell", when: { elem: "earth" }, v: [0.08, 0.14, 0.2] },
      ],
    },
    archmageUtsuwa: {
      label: "極大の器",
      lv: ["MPが6割以上ある時、攻撃呪文の与ダメージ+10%", "MPが6割以上ある時、攻撃呪文の与ダメージ+16%", "MPが6割以上ある時、攻撃呪文の与ダメージ+22%"],
      fx: [{ t: "deal", on: "spell", when: { mpHigh: 0.6 }, v: [0.1, 0.16, 0.22] }],
    },
    archmageMasen: {
      label: "魔泉の目覚め",
      lv: ["戦闘開始時、MPを最大の5%回復", "戦闘開始時、MPを最大の8%回復", "戦闘開始時、MPを最大の12%回復"],
      fx: [{ t: "start", mp: [0.05, 0.08, 0.12] }],
    },
    archmageMakaku: {
      label: "魔殻の昂揚",
      lv: ["ブレス・呪文の被ダメージ-10%。受けるとINT×1.1 (2ターン)", "ブレス・呪文の被ダメージ-17%。受けるとINT×1.15 (2ターン)",
        "ブレス・呪文の被ダメージ-24%。受けるとINT×1.2 (2ターン)"],
      fx: [
        { t: "take", on: "breath", v: [0.1, 0.17, 0.24] },
        { t: "hurt", on: "breath", buff: { int: [1.1, 1.15, 1.2] }, dur: 2 },
      ],
    },
  },
};
