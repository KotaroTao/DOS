// 魔闘士 (battlemage) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
// 魔闘士 = 拳と呪文を織り交ぜる剛の魔法 (土/火)。拳で魔力を巡らせ、怯ませ・焼き印を刻み、そこへ呪文を叩き込む
export default {
  table: `
    1 KYOUGEKI 2 KAENGIRI 3 HALITO 5 battlemageJunkan/1 7 NERAIUCHI 8 ISHITSUBUTE
    10 BAKUENKEN 12 IWAKUDAKI 15 battlemageKuzushi/1 20 BATTLEMAGE_GOUMA 22 KAENNAGI 25 battlemageGoutai/1
    30 MAHALITO 32 EARTHQUAKE 35 battlemageYakiin/1 40 HAMANOKEN 45 battlemageKuzushi/2 50 ELEMBREAK
    55 SAIKEN 57 BATTLEMAGE_KASHA 60 battlemageJunkan/2 65 BATTLEMAGE_GANKENDAN 70 battlemageKutsuu/1 75 resistAilment/1
    80 BATTLEMAGE_HAPPA 82 BATTLEMAGE_JINARI 85 BATTLEMAGE_ENDAN 90 battlemageGoutai/2 95 BATTLEMAGE_MACHIRASHI 100 MAJINKEN
    105 battlemageYakiin/2 110 BATTLEMAGE_DAICHIKEN 115 battlemageKuzushi/3 120 BATTLEMAGE_KONGOU 122 BATTLEMAGE_GANSAISHOU 125 reflect/1
    130 BATTLEMAGE_HIBASHIRA 135 battlemageYakiin/3 140 BATTLEMAGE_SHOUMA 145 battlemageKutsuu/2 150 BATTLEMAGE_GURENMASHOU 155 resistAilment/2
    160 BATTLEMAGE_INTETSU 165 battlemageYakiin/4 170 GANSAI 175 battlemageJunkan/3 180 BATTLEMAGE_BAKUENRANDA 185 battlemageKuzushi/4
    190 BATTLEMAGE_SHAKUNETSU 195 TOUSHINHAGEKI 200 BATTLEMAGE_TENPOU`,
  skills: {
    BATTLEMAGE_GOUMA: { name: "剛魔の構え", mp: 4, kind: "buff", buff: { int: 1.3, vit: 1.2 }, target: "self", tech: true, desc: "魔力を練り、身を岩のように固める" },
    BATTLEMAGE_KASHA: { name: "火車拳", mp: 11, kind: "phys", power: 1.2, hits: 2, intScale: 0.4, element: "fire", acc: 0.4, target: "enemy", desc: "炎の車輪のごとく二度打ち込む" },
    BATTLEMAGE_GANKENDAN: { name: "岩拳弾", mp: 8, kind: "atk", power: 28, element: "earth", debuff: { vit: 0.85 }, target: "enemy", desc: "岩の拳を撃ち出し、守りを砕く" },
    BATTLEMAGE_HAPPA: { name: "発破掌", mp: 16, kind: "phys", power: 2.4, intScale: 0.7, pierce: 0.6, acc: 0.8, target: "enemy", desc: "掌から魔力を炸裂させ、鎧の内を打つ" },
    BATTLEMAGE_JINARI: { name: "地鳴り踏み", mp: 12, kind: "phys", power: 1.0, element: "earth", acc: 0.5, debuff: { agi: 0.85 }, target: "all-enemy", desc: "大地を踏み鳴らし、敵陣の足を鈍らせる" },
    BATTLEMAGE_ENDAN: { name: "焔弾", mp: 11, kind: "atk", power: 34, element: "fire", flinchChance: 0.25, target: "enemy", desc: "拳大の焔の弾を撃ち、怯ませる" },
    BATTLEMAGE_MACHIRASHI: { name: "魔散らし", mp: 5, kind: "debuff", strip: true, seal: { chance: 0.3, turns: 2 }, target: "all-enemy", tech: true, desc: "気合で敵陣の強化を散らし、特技を封じる" },
    BATTLEMAGE_DAICHIKEN: { name: "大地の鉄拳", mp: 16, kind: "atk", power: 48, element: "earth", flinchChance: 0.3, target: "enemy", desc: "大地の巨拳で打ち据え、怯ませる" },
    BATTLEMAGE_KONGOU: { name: "金剛魔拳", mp: 24, kind: "phys", power: 4.2, intScale: 0.8, acc: 1, pierce: 0.4, target: "enemy", desc: "必中の魔拳。INTで伸び、鎧も徹る" },
    BATTLEMAGE_GANSAISHOU: { name: "巌砕掌", mp: 20, kind: "phys", power: 3.4, intScale: 0.6, element: "earth", acc: 0.7, strip: true, target: "enemy", desc: "巌をも砕く掌。強化を打ち消す" },
    BATTLEMAGE_HIBASHIRA: { name: "火柱陣", mp: 14, kind: "atk", power: 37, element: "fire", debuff: { agi: 0.9 }, target: "all-enemy", desc: "火柱で敵陣を囲み、足を止める" },
    BATTLEMAGE_SHOUMA: { name: "衝魔波", mp: 26, kind: "phys", power: 1.6, intScale: 0.6, acc: 0.8, flinchChance: 0.15, target: "all-enemy", desc: "拳から魔の衝撃波を放ち、敵陣を打つ" },
    BATTLEMAGE_GURENMASHOU: { name: "紅蓮魔掌", mp: 20, kind: "atk", power: 70, element: "fire", hpCost: 0.06, target: "enemy", desc: "己の身も焼く紅蓮の掌で一体を焼く" },
    BATTLEMAGE_INTETSU: { name: "隕鉄落とし", mp: 26, kind: "atk", power: 74, element: "earth", flinchChance: 0.2, target: "all-enemy", desc: "隕鉄を降らせ敵陣を打ち、怯ませる" },
    BATTLEMAGE_BAKUENRANDA: { name: "爆炎乱打", mp: 28, kind: "phys", power: 1.0, hits: 2, intScale: 0.4, element: "fire", acc: 0.6, target: "all-enemy", desc: "爆ぜる拳で敵陣を二度打ち抜く" },
    BATTLEMAGE_SHAKUNETSU: { name: "灼熱地獄", mp: 30, kind: "atk", power: 84, element: "fire", debuff: { vit: 0.85 }, target: "all-enemy", desc: "灼熱の地獄が敵陣の鎧を溶かす" },
    BATTLEMAGE_TENPOU: { name: "魔闘・天崩", mp: 44, kind: "atk", power: 130, flinchChance: 0.25, target: "all-enemy", desc: "天を崩す魔力の奔流。敵陣を怯ませる" },
  },
  perks: {
    // 拳を振るうたび、闘気が魔力となって巡る
    battlemageJunkan: {
      label: "闘気循環",
      lv: ["物理技を使った後、MP4%回復", "物理技を使った後、MP6%回復", "物理技を使った後、MP8%回復"],
      fx: [{ t: "cast", on: "phys", mp: [0.04, 0.06, 0.08] }],
    },
    // 怯み・異常で崩れた敵に呪文を叩き込む
    battlemageKuzushi: {
      label: "崩しの呪法",
      lv: ["攻撃呪文の消費MP-8%。状態異常・怯み中の敵への攻撃呪文+10%", "攻撃呪文の消費MP-10%。状態異常・怯み中の敵への攻撃呪文+15%",
        "攻撃呪文の消費MP-12%。状態異常・怯み中の敵への攻撃呪文+20%", "攻撃呪文の消費MP-15%。状態異常・怯み中の敵への攻撃呪文+25%"],
      fx: [
        { t: "cost", v: [0.08, 0.1, 0.12, 0.15], on: "atk" },
        { t: "deal", v: [0.1, 0.15, 0.2, 0.25], on: "spell", when: { tgtAil: true } },
      ],
    },
    // 魔力で身を岩と化す
    battlemageGoutai: {
      label: "剛魔の体",
      lv: ["戦闘開始時に魔障壁1回。防御+5%", "戦闘開始時に魔障壁2回。防御+10%"],
      fx: [
        { t: "start", barrier: [1, 2] },
        { t: "stat", mul: { vit: [0.05, 0.1] } },
      ],
    },
    // 拳で焼き印を刻み、炎の呪文の通り道にする
    battlemageYakiin: {
      label: "焼き印の拳",
      lv: ["物理が当たると10%で敵の火耐性×0.8", "物理が当たると14%で敵の火耐性×0.8",
        "物理が当たると18%で敵の火耐性×0.8", "物理が当たると22%で敵の火耐性×0.8"],
      fx: [{ t: "hit", chance: [0.1, 0.14, 0.18, 0.22], ail: "vuln", el: "fire", mul: 0.8 }],
    },
    // 打たれた痛みを魔力と闘志に変える
    battlemageKutsuu: {
      label: "苦痛の糧",
      lv: ["物理を受けると30%でMP4%回復・INT×1.1 (2ターン)", "物理を受けると40%でMP6%回復・INT×1.15 (2ターン)"],
      fx: [{ t: "hurt", chance: [0.3, 0.4], mp: [0.04, 0.06], buff: { int: [1.1, 1.15] }, dur: 2 }],
    },
  },
};
