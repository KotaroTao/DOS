// 賢者 (sage) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
// 持ち味: 水と風の叡智。攻めの呪文の余光で隊を癒し、癒しと守りを同じ手で編む。品の真贋を見抜く鑑定の目も持つ (鑑定Lv2)。
export default {
  table: `
    1 kantei/2 3 DIOS 5 sageJunkan/1 7 ICENEEDLE 10 CURE 15 sageChouwa/1
    20 MAHALITO 22 AQUAWAVE 25 sageIzumi/1 27 WINDSTORM 30 SAGE_CHIE 35 sageSuifuu/1
    40 SHINRANOSABAKI 45 sageJunkan/2 47 ICELANCE 50 DIOSALL 55 MAYOKE 60 sageJihi/1
    65 SAGE_SHINRI 70 sageChouwa/2 72 SAGE_SEIFUU 75 sageIzumi/2 80 SAGE_KAZEGAERI 85 SAGE_NAGI
    90 sageSuifuu/2 92 SAGE_JINRAI 95 SAGE_FUUU 100 SAGE_HAYATE 105 sageJunkan/3 110 SAGE_SUIKYOU
    115 resistAilment/1 120 SAGE_DAICHI 125 sageJihi/2 130 SAGE_KANRO 135 sageSuifuu/3 140 SAGE_EICHIEN
    142 SAGE_TENRAI 145 sageChouwa/3 150 SAGE_HANGON 155 sageIzumi/3 160 SAGE_REIHYOU 165 resistAilment/2
    170 SAGE_CHOUWA 175 sageJunkan/4 180 SAGE_HOMURA 185 sageJihi/3 190 SAGE_SHINEN 195 SAGE_SHINRA
    200 SAGE_SHUUKYOKU`,
  skills: {
    SAGE_CHIE:      { name: "叡智の授け", mp: 7, kind: "buff", buff: { int: 1.3 }, purge: true, target: "ally", desc: "味方のINTを高め、弱体を解く" },
    SAGE_SHINRI:    { name: "真理の暴き", mp: 9, kind: "debuff", vuln: { all: 0.8 }, strip: true, target: "enemy", desc: "強化を暴き崩し、全属性の守りを下げる" },
    SAGE_SEIFUU:    { name: "清風の渦", mp: 11, kind: "atk", power: 30, element: "wind", partyHeal: 8, target: "all-enemy", desc: "清風の渦が敵を裂き、味方を癒す" },
    SAGE_KAZEGAERI: { name: "風還りの息吹", mp: 9, kind: "heal", power: 0, revive: true, revivePct: 0.4, regen: { pct: 0.04, turns: 3 }, target: "ally", desc: "HP40%で蘇らせ、癒しの風を宿す" },
    SAGE_NAGI:      { name: "凪の詞", mp: 10, kind: "debuff", sleepChance: 0.4, target: "all-enemy", desc: "凪の詞で敵全体を眠りに誘う" },
    SAGE_JINRAI:    { name: "迅雷の理", mp: 9, kind: "atk", power: 30, element: "wind", debuff: { agi: 0.85 }, target: "enemy", desc: "迅き雷が撃ち抜き、足を鈍らせる" },
    SAGE_FUUU:      { name: "恵みの風雨", mp: 13, kind: "heal", power: 36, buff: { agi: 1.1 }, target: "all-ally", desc: "味方全員を癒し、素早さを上げる" },
    SAGE_HAYATE:    { name: "疾風の審判", mp: 16, kind: "atk", power: 42, element: "wind", debuff: { vit: 0.9 }, target: "all-enemy", desc: "疾風が敵全体を裂き、守りを剥ぐ" },
    SAGE_SUIKYOU:   { name: "水鏡の審判", mp: 21, kind: "atk", power: 50, element: "water", partyHeal: 14, target: "all-enemy", desc: "水鏡が敵を撃ち、映る光が味方を癒す" },
    SAGE_DAICHI:    { name: "大地の叡智", mp: 26, kind: "atk", power: 72, element: "earth", debuff: { atk: 0.9 }, target: "all-enemy", desc: "大地の理で敵全体を撃ち、力を削ぐ" },
    SAGE_KANRO:     { name: "甘露の大雨", mp: 22, kind: "heal", power: 62, purge: true, target: "all-ally", desc: "甘露の雨が味方全員を癒し、弱体を解く" },
    SAGE_EICHIEN:   { name: "叡智の炎", mp: 20, kind: "atk", power: 60, element: "fire", strip: true, target: "enemy", desc: "叡智の炎が強化ごと一体を焼く" },
    SAGE_TENRAI:    { name: "天籟の雷", mp: 24, kind: "atk", power: 70, element: "wind", confuse: 0.2, target: "enemy", desc: "天籟の雷が撃ち、心を乱す" },
    SAGE_HANGON:    { name: "反魂の叡智", mp: 16, kind: "heal", power: 0, revive: true, revivePct: 1, grantEndure: true, target: "ally", desc: "HP100%で蘇らせ、致死を一度耐えさせる" },
    SAGE_REIHYOU:   { name: "霊氷の理", mp: 26, kind: "atk", power: 82, element: "water", debuff: { agi: 0.8, atk: 0.9 }, target: "enemy", desc: "霊氷が身を縛り、力と足を奪う" },
    SAGE_CHOUWA:    { name: "大いなる調和", mp: 36, kind: "heal", power: 72, cure: true, grantBarrier: 1, target: "all-ally", desc: "味方全員を癒し、穢れを祓い魔障壁を張る" },
    SAGE_HOMURA:    { name: "焔の審判", mp: 30, kind: "atk", power: 84, element: "fire", para: 0.1, target: "all-enemy", desc: "審判の焔が戦場を焼き、痺れさせる" },
    SAGE_SHINEN:    { name: "叡智の深淵", mp: 30, kind: "atk", power: 88, element: "dark", seal: { chance: 0.5, turns: 3 }, target: "enemy", desc: "深淵の知で撃ち抜き、特技を封じる" },
    SAGE_SHINRA:    { name: "森羅の大理", mp: 36, kind: "atk", power: 100, vuln: { water: 0.8, wind: 0.8 }, target: "all-enemy", desc: "森羅の理で撃ち、水と風への守りを崩す" },
    SAGE_SHUUKYOKU: { name: "叡智の終極", mp: 46, kind: "atk", power: 128, partyHeal: 30, target: "all-enemy", desc: "極大の理が敵を滅し、余光が味方を癒す" },
  },
  perks: {
    sageJunkan: {
      label: "叡智の循環",
      lv: ["攻撃呪文の後、味方全員のHPを最大の1.5%回復", "攻撃呪文の後、味方全員のHPを最大の2.5%回復",
        "攻撃呪文の後、味方全員のHPを最大の3.5%回復", "攻撃呪文の後、味方全員のHPを最大の4.5%回復"],
      fx: [{ t: "cast", on: "atk", party: true, hp: [0.015, 0.025, 0.035, 0.045] }],
    },
    sageChouwa: {
      label: "調和の詠唱",
      lv: ["回復量+8%・回復の消費MP-5%", "回復量+14%・回復の消費MP-8%", "回復量+20%・回復の消費MP-12%"],
      fx: [
        { t: "heal", v: [0.08, 0.14, 0.2] },
        { t: "cost", on: "heal", v: [0.05, 0.08, 0.12] },
      ],
    },
    sageIzumi: {
      label: "叡智の泉",
      lv: ["2ラウンド目から毎ラウンド、味方全員のMPを最大の1%回復", "2ラウンド目から毎ラウンド、味方全員のMPを最大の1.5%回復",
        "2ラウンド目から毎ラウンド、味方全員のMPを最大の2%回復"],
      fx: [{ t: "round", party: true, mp: [0.01, 0.015, 0.02] }],
    },
    sageSuifuu: {
      label: "水風の加護",
      lv: ["敵の物理を4%でかわす。ブレス・呪文の被ダメージ-5%", "敵の物理を7%でかわす。ブレス・呪文の被ダメージ-9%",
        "敵の物理を10%でかわす。ブレス・呪文の被ダメージ-13%"],
      fx: [
        { t: "evade", v: [0.04, 0.07, 0.1] },
        { t: "take", on: "breath", v: [0.05, 0.09, 0.13] },
      ],
    },
    sageJihi: {
      label: "慈悲の残光",
      lv: ["戦闘勝利後、味方全員のHPを最大の3%回復", "戦闘勝利後、味方全員のHPを最大の5%回復", "戦闘勝利後、味方全員のHPを最大の7%回復"],
      fx: [{ t: "win", party: true, hp: [0.03, 0.05, 0.07] }],
    },
  },
};
