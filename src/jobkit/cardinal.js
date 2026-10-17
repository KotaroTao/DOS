// 全職見直し: 蘇生と救命で、全滅の危機から隊を立て直す。ランクパッシブは維持。
// 枢機卿 (cardinal) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
// 持ち味: 教会の権威。秘跡・勅・破門で隊を祝し敵を裁き、蘇生の頂点 (列聖・天なる聖座) に立つ
import { UNHOLY } from "./common.js";

export default {
  // ランクのパッシブ: 魂がランク2で目覚め、3・4・5で強まる (souls.js の JOB_PASSIVES)
  awaken: "cardinalKiseki",
  table: `
    1 HOLYRAY 3 DIOS 5 cardinalShiboku/1 5 CURE 7 CUREALL 10 PROTECT
    10 RECOVER 12 CARDINAL_HAMONNOCHOKU 15 soulTutor/1 17 REGEN 17 RECOVERALL 18 CARDINAL_SEIYU
    20 DIOSALL 20 AWAKE 20 cardinalIshi/1 25 cardinalMeisou/1 25 AWAKEALL 25 REVIVE
    30 DIAL 35 cardinalKekkai/1 35 STONECURE 35 CARDINAL_SHOUROU 45 cardinalShiboku/2 45 STONECUREALL
    45 CARDINAL_SEIIBUTSU 50 soulTutor/2 55 DIALALL 60 cardinalMeisou/2 60 MADIOS 60 RESURRECT
    65 PURIFY 70 cardinalMeisou/3 75 cardinalIgen/1 75 CARDINAL_SHIEI 80 cardinalIshi/2 90 cardinalShiboku/3
    90 PURIFYALL 90 CARDINAL_BANKON 100 soulTutor/3 100 cardinalKekkai/2 105 MADIOSALL 105 CARDINAL_HAMON
    125 CARDINAL_TAIKAN 130 CARDINAL_SEIZANORAI 135 resistAilment/1 140 cardinalIshi/3 145 cardinalShiboku/4 150 CARDINAL_SEITOU
    155 cardinalIgen/2 160 CARDINAL_IKOU 165 resistAilment/2 165 cardinalKekkai/3 170 CARDINAL_SHUKUSEI 180 CARDINAL_TENJOU
    190 CARDINAL_KOUCHUU 195 KYOUKOUNOSHUKUFUKU 200 CARDINAL_SEIZA`,
  skills: {
    // 序盤の固有技: 破門を言い渡し、強化を剥いで特技を封じる
    CARDINAL_HAMONNOCHOKU: {name: "破門の勅書", mp: 5, kind: "debuff", strip: true, seal: {chance: 0.4, turns: 2}, target: "enemy", desc: "強化を剥ぎ、光への守りを緩める。40%で特技を2ターン封じる", dur: 3, vuln: {light: 0.85}},
    CARDINAL_SEIYU: {name: "聖油の秘跡", mp: 8, kind: "heal", healMul: 1.4, cure: ["poison", "paralyze"], target: "ally", desc: "一人の傷・毒・麻痺を治し、不屈を一度授けて救命する", dur: 3, grantEndure: true},
    CARDINAL_SHOUROU: { name: "鐘楼の福音", mp: 12, kind: "buff", regen: { pct: 0.06, turns: 4 }, purge: true, target: "all-ally", desc: "鐘の音が弱体を祓い、全員に癒しを残す" },
    CARDINAL_SEIIBUTSU: { name: "聖遺物の奇跡", mp: 8, kind: "heal", healMul: 2.1, cure: ["poison", "paralyze", "stone"], grantEndure: true, target: "ally", desc: "一人の深手と毒・猛毒・麻痺・石化を癒し、致死を一度耐える力を授ける" },
    CARDINAL_SHIEI: { name: "紫衣の大祷", mp: 22, kind: "heal", healMul: 1.7, buff: { int: 1.15 }, target: "all-ally", desc: "全員を大きく癒し、魔力を高める" },
    CARDINAL_HAMON: { name: "破門の宣告", mp: 16, kind: "debuff", debuff: { atk: 0.8, vit: 0.85 }, seal: { chance: 0.3, turns: 2 }, target: "all-enemy", desc: "敵全体を破門し、攻守と特技を奪う" },
    CARDINAL_TAIKAN: { name: "戴冠の祝福", mp: 19, kind: "heal", healMul: 1.4, buff: { atk: 1.2, agi: 1.1 }, target: "all-ally", desc: "全員を癒し、攻撃と素早さを上げる" },
    CARDINAL_SEIZANORAI: { name: "聖座の雷", mp: 22, kind: "atk", power: 58, element: "light", vuln: { all: 0.85 }, target: "enemy", desc: "裁きの雷が敵の属性の守りを崩す" },
    CARDINAL_BANKON: { name: "万魂の招来", mp: 75, kind: "heal", healMul: 1.3, revive: true, revivePct: 0.5, cure: true, target: "all-ally", desc: "倒れた者をHP50%で呼び、全員を清める" },
    CARDINAL_SEITOU: { name: "聖灯の行列", mp: 20, kind: "atk", power: 38, element: "light", debuff: { atk: 0.9 }, prey: { races: UNHOLY, mul: 1.4 }, target: "all-enemy", desc: "聖灯の列が敵を灼く。不浄の者に強い" },
    CARDINAL_IKOU: { name: "聖座の威光", mp: 20, kind: "atk", power: 44, element: "light", seal: { chance: 0.3, turns: 2 }, target: "all-enemy", desc: "威光で敵全体を灼き、特技を封じる" },
    CARDINAL_SHUKUSEI: { name: "祝聖の大祷", mp: 28, kind: "heal", healMul: 1.8, cure: true, purge: true, buff: { vit: 1.15 }, target: "all-ally", desc: "全員を癒し祓い、守りを固める" },
    CARDINAL_TENJOU: { name: "天上の裁光", mp: 30, kind: "atk", power: 62, element: "light", strip: true, target: "all-enemy", desc: "天上の光が敵全体の強化を剥ぐ" },
    CARDINAL_KOUCHUU: { name: "光柱の審き", mp: 28, kind: "atk", power: 80, element: "light", debuff: { vit: 0.8 }, target: "enemy", desc: "光の柱が一体を貫き、守りを砕く" },
    CARDINAL_SEIZA: { name: "天なる聖座", mp: 120, kind: "heal", healPct: 1, revive: true, revivePct: 0.8, cure: true, purge: true, regen: { pct: 0.05, turns: 3 }, target: "all-ally", desc: "全員を全快させ、倒れた者もHP80%で呼ぶ" },
  },
  perks: {
    cardinalShiboku: { label: "司牧の慈しみ", scope: "party", lv: ["戦闘勝利後、味方全員のHP3%回復", "戦闘勝利後、味方全員のHP5%回復", "戦闘勝利後、味方全員のHP8%回復", "戦闘勝利後、味方全員のHP12%回復"],
      fx: [{ t: "win", party: true, hp: [0.03, 0.05, 0.08, 0.12] }] },
    cardinalIgen: { label: "赦しの勅令", lv: ["味方が魅了・混乱で行動を強制される直前、その異常を解除して通常の行動を可能にする（隊で1戦闘1回）", "味方が魅了・混乱で行動を強制される直前、その異常を解除して通常の行動を可能にする（隊で1戦闘2回）"],
      fx: [{ t: "mindPardon", v: [1, 2], party: true }] },
    cardinalMeisou: {
      label: "紫衣の瞑想",
      lv: ["2ターン目から、倒れた味方がいる間、毎ターン最大MPの2%回復", "2ターン目から、倒れた味方がいる間、毎ターン最大MPの3%回復", "2ターン目から、倒れた味方がいる間、毎ターン最大MPの4%回復"],
      fx: [
        {t: "round", when: {allyDown: true}, mp: [0.02, 0.03, 0.04]},
      ],
    },
    cardinalKekkai: { label: "聖座の結界", scope: "party", lv: ["味方全員のブレスの被ダメージ−8%", "味方全員のブレスの被ダメージ−12%", "味方全員のブレスの被ダメージ−16%"],
      fx: [{ t: "take", on: "breath", aura: true, v: [0.08, 0.12, 0.16] }] },
    cardinalIshi: { label: "殉教者の遺志", lv: ["倒れた味方がいる間、INT・VIT+10%", "倒れた味方がいる間、INT・VIT+15%", "倒れた味方がいる間、INT・VIT+20%"],
      fx: [{ t: "stat", when: { allyDown: true }, mul: { int: [0.1, 0.15, 0.2], vit: [0.1, 0.15, 0.2] } }] },
  },
};
