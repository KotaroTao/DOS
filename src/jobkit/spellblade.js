// 魔法剣士 (spellblade) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
// 魔法剣士 = 剣に属性を宿す魔法剣。INTで伸びる斬撃 (intScale)、属性の守りを裂き (vuln)、裂いた所へ呪文を撃ち込む
export default {
  // ランクのパッシブ: 魂がランク2で目覚め、3・4・5で強まる (souls.js の JOB_PASSIVES)
  awaken: "spellbladeMajin",
  table: `
    1 KYOUGEKI 2 MAKEN_FIRE 3 HALITO 4 MAKEN_EARTH 5 spellBlade/1 7 DOUBLE
    8 MAKEN_WIND 10 ICENEEDLE 12 MAKEN_WATER 15 SPELLBLADE_KENJURENKAN 15 spellbladeMikiwame/1 17 MAKEN_LIGHT 20 SHINGANGEKI
    22 MAKEN_DARK 25 spellbladeKyoumei/1 30 ELEMBREAK 35 spellbladeRenkan/1 40 MAENZAN 45 kenma/1
    50 SPELLBLADE_KASANE 50 spellbladeMikiwame/2 55 MAHALITO 57 GURENZAN 60 spellBlade/2 65 SPELLBLADE_RENSEI 70 spellbladeMagan/1
    75 spellbladeKyoumei/2 80 SPELLBLADE_YOROIDOOSHI 82 HYOUJIN 85 SPELLBLADE_FUUJIN 90 spellbladeMayoroi/1 95 MADALT
    100 SPELLBLADE_FUUMA 100 spellbladeMikiwame/3 105 twinArts/1 110 SPELLBLADE_HIEN 115 spellbladeEishou/1 120 SPELLBLADE_RAITEI 125 resistAilment/1
    130 SPELLBLADE_TENSHOU 135 spellbladeRenkan/2 140 SPELLBLADE_SOURYUU 145 spellbladeKyoumei/3 150 SPELLBLADE_KOKUU 155 spellbladeMagan/2
    160 ROKUDOU 165 spellbladeEishou/2 170 SPELLBLADE_ENTEI 175 spellbladeMayoroi/2 180 SPELLBLADE_KYOKKOU 185 spellbladeRenkan/3
    190 SPELLBLADE_HYOUGOKU 195 SPELLBLADE_BANSHOU 200 SPELLBLADE_KENKAI`,
  skills: {
    // Lv15 の固有技: 剣に術を重ね、全属性の守りを緩める
    SPELLBLADE_KENJURENKAN: { name: "剣呪連環", mp: 6, kind: "phys", power: 1.1, intScale: 0.4, vuln: { all: 0.9 }, target: "enemy", desc: "剣に術を重ねて斬り、全属性の守りを緩める（INTでも伸びる）" },
    SPELLBLADE_KASANE: { name: "魔刃重ね", mp: 10, kind: "phys", power: 1.6, intScale: 0.7, acc: 0.5, target: "enemy", desc: "魔力を重ねた刃で斬る（INTで伸びる）" },
    SPELLBLADE_RENSEI: { name: "剣気練成", mp: 4, kind: "buff", buff: { int: 1.25, atk: 1.15 }, target: "self", tech: true, desc: "剣気と魔力を同時に練り上げる" },
    SPELLBLADE_YOROIDOOSHI: { name: "魔刃・鎧通し", mp: 16, kind: "phys", power: 2.2, intScale: 0.7, pierce: 0.6, acc: 0.7, target: "enemy", desc: "魔力の刃を鎧の隙へ通す（防御無視）" },
    SPELLBLADE_FUUJIN: { name: "風刃陣", mp: 10, kind: "atk", power: 30, element: "wind", vuln: { wind: 0.85 }, target: "all-enemy", desc: "風の刃を撒き、風の守りを裂く" },
    SPELLBLADE_FUUMA: { name: "封魔剣", mp: 14, kind: "phys", power: 1.6, intScale: 0.6, acc: 0.7, seal: { chance: 0.6, turns: 2 }, target: "enemy", desc: "魔を封じる刃。特技を封じる" },
    SPELLBLADE_HIEN: { name: "緋焔", mp: 11, kind: "atk", power: 31, element: "fire", poison: { chance: 0.5, pct: 0.05 }, target: "enemy", desc: "緋の焔を放ち、焼けただれさせる" },
    SPELLBLADE_RAITEI: { name: "雷霆剣陣", mp: 16, kind: "atk", power: 42, element: "wind", para: 0.15, target: "all-enemy", desc: "雷の剣陣が敵陣を貫き、痺れさせる" },
    SPELLBLADE_TENSHOU: { name: "魔剣・天衝", mp: 24, kind: "phys", power: 3.4, intScale: 0.8, acc: 1, target: "enemy", desc: "天を衝く必中の魔剣" },
    SPELLBLADE_SOURYUU: { name: "蒼流穿", mp: 14, kind: "atk", power: 38, element: "water", vuln: { water: 0.8 }, target: "enemy", desc: "蒼き水の刃が貫き、水の守りを裂く" },
    SPELLBLADE_KOKUU: { name: "魔剣・虚空", mp: 28, kind: "phys", power: 3.8, intScale: 1.0, acc: 1, pierce: 0.5, target: "enemy", desc: "虚空を裂く魔剣。必中・防御を半ば無視" },
    SPELLBLADE_ENTEI: { name: "炎帝の業火", mp: 20, kind: "atk", power: 60, element: "fire", strip: true, target: "enemy", desc: "業火が敵の強化ごと焼き尽くす" },
    SPELLBLADE_KYOKKOU: { name: "魔剣・極光", mp: 32, kind: "phys", power: 4.6, intScale: 1.0, acc: 1, execute: 1.4, target: "enemy", desc: "極光の魔剣。必中、弱った敵に重い" },
    SPELLBLADE_HYOUGOKU: { name: "氷獄", mp: 26, kind: "atk", power: 85, element: "water", para: 0.2, debuff: { agi: 0.8 }, target: "enemy", desc: "氷の獄に閉ざし、凍えで足を止める" },
    SPELLBLADE_BANSHOU: { name: "魔剣・森羅万象", mp: 40, kind: "phys", power: 5.2, intScale: 1.0, acc: 1, pierce: 1, vuln: { all: 0.85 }, target: "enemy", desc: "必中・防御無視。全属性の守りを崩す" },
    SPELLBLADE_KENKAI: { name: "万魔剣界", mp: 44, kind: "atk", power: 135, debuff: { vit: 0.85 }, target: "all-enemy", desc: "無数の魔剣が降り注ぎ、鎧を穿つ" },
  },
  perks: {
    // Lv15 の目玉パッシブ: 敵の属性を見極め、弱みに刃と術を通す
    spellbladeMikiwame: {
      label: "属性の見極め",
      lv: ["属性の弱点を突いた与ダメージ+10%", "属性の弱点を突いた与ダメージ+20%", "属性の弱点を突いた与ダメージ+30%"],
      fx: [{ t: "deal", when: { tgtWeak: true }, v: [0.10, 0.20, 0.30] }],
    },
    // 斬撃に詠唱を乗せ、魔力を無駄にしない
    spellbladeEishou: {
      label: "刃の詠唱",
      lv: ["物理技を使った後、20%で消費MPが戻る", "物理技を使った後、28%で消費MPが戻る", "物理技を使った後、36%で消費MPが戻る"],
      fx: [{ t: "cast", on: "phys", chance: [0.2, 0.28, 0.36], refund: true }],
    },
    // 魔法剣で崩した敵へ、呪文が深く響く
    spellbladeKyoumei: {
      label: "魔剣の共鳴",
      lv: ["弱体中の敵への攻撃呪文の与ダメージ+10%", "弱体中の敵への攻撃呪文の与ダメージ+16%", "弱体中の敵への攻撃呪文の与ダメージ+22%"],
      fx: [{ t: "deal", v: [0.1, 0.16, 0.22], on: "spell", when: { tgtDebuffed: true } }],
    },
    // 通常の斬撃にも属性の綻びを刻む
    spellbladeRenkan: {
      label: "属性の連環",
      lv: ["通常攻撃が当たると10%で敵の全属性耐性×0.85", "通常攻撃が当たると15%で敵の全属性耐性×0.85",
        "通常攻撃が当たると20%で敵の全属性耐性×0.85"],
      fx: [{ t: "hit", chance: [0.1, 0.15, 0.2], on: "basic", ail: "vuln", el: "all", mul: 0.85 }],
    },
    // 魔力を鎧に変え、打たれた衝撃を魔力に戻す
    spellbladeMayoroi: {
      label: "魔力の鎧",
      lv: ["戦闘開始時に魔障壁1回。物理を受けるとMP2%回復", "戦闘開始時に魔障壁2回。物理を受けるとMP4%回復"],
      fx: [
        { t: "start", barrier: [1, 2] },
        { t: "hurt", mp: [0.02, 0.04] },
      ],
    },
    // 練り上げた剣気が急所を照らす
    spellbladeMagan: {
      label: "見極めの魔眼",
      lv: ["自分が強化中の間、物理の会心率+8%", "自分が強化中の間、物理の会心率+14%"],
      fx: [{ t: "crit", v: [0.08, 0.14], on: "phys", when: { buffed: true } }],
    },
  },
};
