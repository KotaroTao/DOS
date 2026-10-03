// 秘術師 (arcanist) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
// 持ち味: 禁じられた闇の秘術。己の血 (HP) を代償に威力を買い、重力で圧し潰し、呪いで蝕んだ敵を仕留める。
export default {
  table: `
    1 SHADOWBOLT 2 HALITO 3 MARK_FIRE 5 arcanistChikei/1 7 ICENEEDLE 10 ARCANIST_KOJUU
    15 arcanistChoushuu/1 20 ARCANIST_KOKUMU 22 MAHALITO 25 arcanistJushoku/1 30 ELEMBREAK 35 arcanistTsuuren/1
    40 KINJUKAICHOU 45 arcanistChikei/2 47 DARKBLAST 50 ARCANIST_KETSUIN 55 MAYOKE 60 arcanistSeiyaku/1
    65 MADALT 70 arcanistTsuuren/2 72 ARCANIST_YAMITOBARI 75 arcanistJushoku/2 80 ARCANIST_KINSEI 85 MARYOKUBOUSOU
    90 arcanistChoushuu/2 95 ARCANIST_HYOUJU 100 ARCANIST_JUEN 105 arcanistChikei/3 110 ARCANIST_JUUATSU 112 ARCANIST_KONSAKI
    115 resistAilment/1 120 ARCANIST_JURAI 125 arcanistTsuuren/3 130 ARCANIST_KYOKOU 135 arcanistSeiyaku/2 140 ARCANIST_KINIKI
    145 arcanistJushoku/3 150 ARCANIST_KENKA 155 resistAilment/2 160 ARCANIST_RAKUSEI 165 arcanistChoushuu/3 170 ARCANIST_TOUKON
    172 ARCANIST_MEIJU 175 arcanistChikei/4 180 ARCANIST_GOUKASHO 185 arcanistSeiyaku/3 190 KYOMU 195 ARCANIST_KAIKAI
    200 ARCANIST_SHUUENSHO`,
  skills: {
    ARCANIST_KOJUU:      { name: "虚重の秘法", mp: 6, kind: "atk", gravity: 0.3, hpCost: 0.04, target: "enemy", desc: "身を削り、敵の今のHPの30%を潰す" },
    ARCANIST_KOKUMU:     { name: "魔喰いの黒霧", mp: 6, kind: "atk", power: 16, element: "dark", mpDrain: 0.1, target: "all-enemy", desc: "黒い霧が敵全体を撃ち、魔力を啜る" },
    ARCANIST_KETSUIN:    { name: "血の契約", mp: 3, kind: "buff", buff: { int: 1.6 }, hpCost: 0.1, target: "self", desc: "血を捧げ、自分のINTを大きく高める" },
    ARCANIST_YAMITOBARI: { name: "闇蝕の帳", mp: 12, kind: "atk", power: 34, element: "dark", vuln: { dark: 0.85 }, target: "all-enemy", desc: "闇の帳が敵全体を蝕み、闇に弱らせる" },
    ARCANIST_KINSEI:     { name: "禁星の招来", mp: 22, kind: "atk", power: 60, flinchChance: 0.25, target: "all-enemy", desc: "禁じられた星を呼び、敵を怯ませる（無属性）" },
    ARCANIST_HYOUJU:     { name: "氷呪の棘", mp: 14, kind: "atk", power: 34, element: "water", confuse: 0.25, target: "enemy", desc: "呪いの氷棘が刺さり、心を惑わす" },
    ARCANIST_JUEN:       { name: "呪印の炎", mp: 14, kind: "atk", power: 34, element: "fire", vuln: { fire: 0.85 }, target: "all-enemy", desc: "呪印の炎が敵全体の火への守りを崩す" },
    ARCANIST_JUUATSU:    { name: "重圧の禁域", mp: 18, kind: "atk", gravity: 0.27, debuff: { agi: 0.85 }, target: "all-enemy", desc: "敵全体の今のHPの27%を潰し、鈍らせる" },
    ARCANIST_KONSAKI:    { name: "魂裂きの禁呪", mp: 21, kind: "atk", power: 62, element: "dark", drain: 0.15, target: "enemy", desc: "魂を裂き、その命を己に注ぐ" },
    ARCANIST_JURAI:      { name: "呪雷の残響", mp: 16, kind: "atk", power: 42, element: "wind", sleepChance: 0.15, target: "all-enemy", desc: "呪いの雷が意識を刈り、眠らせる" },
    ARCANIST_KYOKOU:     { name: "虚ろの孔", mp: 30, kind: "atk", power: 90, element: "dark", vuln: { all: 0.85 }, target: "enemy", desc: "虚ろの孔を穿ち、全属性の守りを崩す" },
    ARCANIST_KINIKI:     { name: "凍える禁域", mp: 20, kind: "atk", power: 50, element: "water", seal: { chance: 0.3, turns: 2 }, target: "all-enemy", desc: "凍てつく禁域が敵全体の特技を封じる" },
    ARCANIST_KENKA:      { name: "献火の劫炎", mp: 20, kind: "atk", power: 74, element: "fire", hpCost: 0.08, target: "enemy", desc: "己の血を薪にくべ、一体を焼き尽くす" },
    ARCANIST_RAKUSEI:    { name: "禁忌の落星", mp: 26, kind: "atk", power: 74, element: "earth", mpDrain: 0.05, target: "all-enemy", desc: "落星の欠片が敵全体の魔力を奪う" },
    ARCANIST_TOUKON:     { name: "凍魂の呪縛", mp: 26, kind: "atk", power: 82, element: "water", instakill: { chance: 0.15 }, target: "enemy", desc: "魂ごと凍らせる。稀に即死" },
    ARCANIST_MEIJU:      { name: "冥呪の嵐", mp: 28, kind: "atk", power: 72, element: "dark", poison: { chance: 0.4, pct: 0.05 }, target: "all-enemy", desc: "冥い呪いの嵐が敵全体を蝕む（毒）" },
    ARCANIST_GOUKASHO:   { name: "業火の禁書", mp: 30, kind: "atk", power: 82, element: "fire", strip: true, target: "all-enemy", desc: "禁書の業火が強化ごと敵全体を焼く" },
    ARCANIST_KAIKAI:     { name: "禁呪・界壊", mp: 36, kind: "atk", gravity: 0.35, hpCost: 0.1, target: "all-enemy", desc: "身を裂き、敵全体の今のHPの35%を潰す" },
    ARCANIST_SHUUENSHO:  { name: "禁呪・終焉の書", mp: 44, kind: "atk", power: 160, hpCost: 0.15, target: "all-enemy", desc: "命を燃やして綴る終焉の禁呪（無属性）" },
  },
  perks: {
    arcanistChikei: {
      label: "血の触媒",
      lv: ["HP50%以下の時、攻撃呪文の与ダメージ+12%", "HP50%以下の時、攻撃呪文の与ダメージ+20%",
        "HP50%以下の時、攻撃呪文の与ダメージ+28%", "HP50%以下の時、攻撃呪文の与ダメージ+34%"],
      fx: [{ t: "deal", on: "spell", when: { selfLow: 0.5 }, v: [0.12, 0.2, 0.28, 0.34] }],
    },
    arcanistChoushuu: {
      label: "魂の徴収",
      lv: ["敵を倒すとMPを最大の4%・HPを3%回復", "敵を倒すとMPを最大の7%・HPを5%回復", "敵を倒すとMPを最大の10%・HPを7%回復"],
      fx: [{ t: "kill", mp: [0.04, 0.07, 0.1], hp: [0.03, 0.05, 0.07] }],
    },
    arcanistJushoku: {
      label: "呪蝕の理",
      lv: ["弱体中の敵への攻撃呪文の与ダメージ+8%", "弱体中の敵への攻撃呪文の与ダメージ+14%", "弱体中の敵への攻撃呪文の与ダメージ+20%"],
      fx: [{ t: "deal", on: "spell", when: { tgtDebuffed: true }, v: [0.08, 0.14, 0.2] }],
    },
    arcanistTsuuren: {
      label: "痛みの錬成",
      lv: ["敵の攻撃・ブレスを受けるたび、MPを最大の3%回復", "敵の攻撃・ブレスを受けるたび、MPを最大の5%回復", "敵の攻撃・ブレスを受けるたび、MPを最大の7%回復"],
      fx: [
        { t: "hurt", mp: [0.03, 0.05, 0.07] },
        { t: "hurt", on: "breath", mp: [0.03, 0.05, 0.07] },
      ],
    },
    arcanistSeiyaku: {
      label: "冥き誓約",
      lv: ["味方が倒れた時、INT×1.2 (3ターン)・HPを最大の5%回復", "味方が倒れた時、INT×1.3 (3ターン)・HPを最大の8%回復",
        "味方が倒れた時、INT×1.4 (3ターン)・HPを最大の12%回復"],
      fx: [{ t: "fall", buff: { int: [1.2, 1.3, 1.4] }, dur: 3, hp: [0.05, 0.08, 0.12] }],
    },
  },
};
