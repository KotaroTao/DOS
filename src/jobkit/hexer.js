// 呪術師 (hexer) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
// 持ち味: 毒と呪いで蝕み、魅了と混乱で崩す (闇/水)。弱った・呪われた敵ほど呪文が深く刺さる
export default {
  // ランクのパッシブ: 魂がランク2で目覚め、3・4・5で強まる (souls.js の JOB_PASSIVES)
  awaken: "hexerSae",
  table: `
    1 BLIND 2 SHADOWBOLT 3 NOROI 5 hexerShokuso/1 7 MARK_WATER 10 HEXER_MUMAKOU
    12 AQUAWAVE 15 HEXER_SHOKUJU 15 hexerGosun/1 20 MIWAKU 22 DARKMIST 25 hexerJusui/1 30 KYOURAN
    32 DARKBLAST 35 hexerMaganoKizashi/1 40 DOKUGIRI 45 hexerTatari/1 50 KEISEI 50 hexerGosun/2 55 FUDOKU
    60 hexerShokuso/2 62 ICELANCE 65 ELEMBREAK 70 flinch/1 72 DARKNESS 75 hexerJusui/2
    80 DEATH 85 HEXER_SHIKUGI 90 hexerTatari/2 95 BLINDALL 100 MADALT 100 hexerGosun/3 105 resistAilment/1
    110 HEXER_OBOREJU 115 hexerMaganoKizashi/2 120 GRAVITY 122 MEIKOKU 125 hexerJusoMamori/1 130 HEXER_KUROSHIO
    135 hexerJusui/3 140 DEATHALL 145 hexerTatari/3 150 HEXER_KODOKU 155 soulEater/1 160 GRAVIGA
    165 resistAilment/2 170 HEXER_HYOUKAN 175 soulLure/1 180 MEIANRAN 185 hexerJusoMamori/2 190 HEXER_HYAKKI
    195 MAGATSU 200 HEXER_BANJU`,
  skills: {
    // Lv15 の固有技: 呪いを吹き込み、毒と守りの綻びで蝕む
    HEXER_SHOKUJU: { name: "蝕みの呪い", mp: 4, kind: "debuff", poison: { chance: 0.8, pct: 0.05 }, debuff: { vit: 0.85 }, target: "enemy", desc: "呪いを吹き込み、毒で蝕んで守りを削ぐ（毎ターン5%）" },
    HEXER_MUMAKOU: { name: "夢魔の香", mp: 4, kind: "debuff", sleepChance: 0.45, poison: { chance: 0.3, pct: 0.05 }, target: "all-enemy", desc: "甘い香で敵全体を眠らせ、毒を回す" },
    HEXER_SHIKUGI: { name: "黙し釘の呪", mp: 11, kind: "debuff", seal: { chance: 0.5, turns: 3 }, vuln: { dark: 0.85 }, target: "all-enemy", desc: "呪い釘で敵全体の特技を封じ、闇に脆くする" },
    HEXER_OBOREJU: { name: "溺れ呪い", mp: 14, kind: "atk", power: 36, element: "water", confuse: 0.3, target: "enemy", desc: "水底の呪いで溺れさせ、正気を奪う（混乱）" },
    HEXER_KUROSHIO: { name: "黒潮の呪滴", mp: 20, kind: "atk", power: 50, element: "water", debuff: { atk: 0.88 }, target: "all-enemy", desc: "呪いの潮が敵全体を呑み、力を奪う" },
    HEXER_KODOKU: { name: "蠱毒の壺", mp: 30, kind: "atk", power: 88, element: "dark", poison: { chance: 0.7, pct: 0.1 }, target: "enemy", desc: "壺の蠱毒を浴びせ、猛毒で蝕む" },
    HEXER_HYOUKAN: { name: "氷棺の呪", mp: 26, kind: "atk", power: 82, element: "water", sleepChance: 0.35, target: "enemy", desc: "氷の棺に閉じ込め、凍える眠りに落とす" },
    HEXER_HYAKKI: { name: "百鬼の呪い", mp: 36, kind: "atk", power: 96, debuff: { atk: 0.85, vit: 0.85 }, target: "all-enemy", desc: "百の呪いが敵全体を蝕み、力と守りを削ぐ" },
    HEXER_BANJU: { name: "万呪の帳", mp: 44, kind: "atk", power: 122, poison: { chance: 0.5, pct: 0.05 }, confuse: 0.25, target: "all-enemy", desc: "万の呪いで敵全体を討ち、毒と狂気を撒く" },
  },
  perks: {
    hexerShokuso: { label: "蝕みの爪", lv: ["物理を当てると15%で毒 (毎ターン5%)", "物理を当てると30%で毒 (毎ターン5%)"],
      fx: [{ t: "hit", chance: [0.15, 0.3], ail: "poison", pct: 0.05 }] },
    hexerJusui: { label: "呪いの吸い口", lv: ["弱体・状態異常の技の後、最大MPの4%を吸う", "弱体・状態異常の技の後、最大MPの6%を吸う", "弱体・状態異常の技の後、最大MPの8%を吸う"],
      fx: [{ t: "cast", on: "debuff", mp: [0.04, 0.06, 0.08] }] },
    hexerMaganoKizashi: { label: "禍の前触れ", lv: ["戦闘開始時、敵全体の素早さ−10% (3ターン)", "戦闘開始時、敵全体の素早さ−15% (3ターン)"],
      fx: [{ t: "start", foe: { agi: [0.9, 0.85] }, dur: 3 }] },
    hexerTatari: { label: "弱り目のたたり", lv: ["弱体中の敵への攻撃呪文+12%", "弱体中の敵への攻撃呪文+20%", "弱体中の敵への攻撃呪文+28%"],
      fx: [{ t: "deal", on: "spell", v: [0.12, 0.2, 0.28], when: { tgtDebuffed: true } }] },
    hexerJusoMamori: { label: "呪いの守り", lv: ["ブレスの被ダメ−15%、浴びると最大MPの4%を得る", "ブレスの被ダメ−25%、浴びると最大MPの6%を得る"],
      fx: [{ t: "take", on: "breath", v: [0.15, 0.25] }, { t: "hurt", on: "breath", mp: [0.04, 0.06] }] },
  },
};
