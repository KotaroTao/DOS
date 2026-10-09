// 祓魔師 (exorcist) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
import { UNHOLY } from "./common.js";

export default {
  // ランクのパッシブ: 魂がランク2で目覚め、3・4・5で強まる (souls.js の JOB_PASSIVES)
  awaken: "exorcistJouka",
  table: `
    1 EXORCIST_HARAIBA 2 SUIGETSU 3 HOLYRAY 5 exorcistTaima/1 5 DIOS 7 KIYOMEMIZU 10 CURE 12 KOUJIN
    15 EXORCIST_HAMANOYA 15 exorcistTaisan/1 20 HARAI 20 AWAKE 22 UZUSHIO 25 exorcistSakibarai/1 25 AWAKEALL
    30 EXORCIST_KEGAREDACHI 30 DIOSALL 35 exorcistMisogi/1 40 HAJANOTACHI 40 DIAL 45 exorcistSeikon/1
    50 TAIMA 50 exorcistTaisan/2 50 STONECURE 55 EXORCIST_KOUU 57 HYOUJIN 60 exorcistMisogi/2
    65 EXORCIST_KIYOBARAI 70 exorcistSakibarai/2 75 exorcistHama/1 80 EXORCIST_SANKO 82 SEIGEKI
    90 exorcistTaima/2 95 EXORCIST_INDOU 100 EXORCIST_SEISA 100 exorcistTaisan/3 105 exorcistSeikon/2
    107 EXORCIST_REISUI 110 EXORCIST_KEKKAIFUDA 115 exorcistSakibarai/3 120 EXORCIST_HAMAYA
    125 exorcistMisogi/3 130 EXORCIST_SEISUINAGI 135 exorcistSeikon/3 140 EXORCIST_KOURIN 145 exorcistHama/2
    150 EXORCIST_JINRAI 155 resistAilment/1 160 EXORCIST_CHOUBUKU 162 EXORCIST_MISOGI 165 exorcistTaima/3
    170 TAIMAJIN 175 resistAilment/2 180 EXORCIST_ROKKON 185 exorcistSeikon/4 190 EXORCIST_OOHARAE
    195 EXORCIST_GOUMA 200 EXORCIST_KENSHOU`,
  skills: {
    // Lv15 の固有技: 破魔の矢。不浄の者に深く刺さる光の呪文
    EXORCIST_HAMANOYA: { name: "破魔矢", mp: 5, kind: "atk", power: 18, element: "light", prey: { races: UNHOLY, mul: 1.4 }, target: "enemy", desc: "破魔の矢を放つ。不浄の者に大きく効く（光）" },
    EXORCIST_HARAIBA:     { name: "祓い刃", mp: 4, kind: "phys", power: 1.1, pieScale: 0.3, element: "light", prey: { races: UNHOLY, mul: 1.8 }, target: "enemy", desc: "祈りを込めた刃。不浄の者に大ダメージ（光）" },
    EXORCIST_KEGAREDACHI: { name: "穢れ断ち", mp: 5, kind: "phys", power: 1.2, critBonus: 0.35, strip: true, target: "enemy", desc: "穢れごと強化を断ち切る（会心UP）" },
    EXORCIST_KOUU:        { name: "祓いの光雨", mp: 9, kind: "atk", power: 22, element: "light", debuff: { hit: 0.9 }, target: "all-enemy", desc: "光の雨が敵陣を打ち、目を眩ませる（光）" },
    EXORCIST_KIYOBARAI:   { name: "清め払い", mp: 10, kind: "phys", power: 0.9, pieScale: 0.15, critBonus: 0.1, element: "water", target: "all-enemy", desc: "清めの水をまとい敵陣を払う（水）" },
    EXORCIST_SANKO:       { name: "三鈷剣", mp: 14, kind: "phys", power: 0.9, hits: 3, agiScale: 0.35, critBonus: 0.2, element: "light", flinchChance: 0.2, target: "enemy", desc: "三鈷の聖剣で三度斬り、怯ませる（光）" },
    EXORCIST_INDOU:       { name: "引導", mp: 16, kind: "phys", power: 2.6, execute: 2.5, instakill: { chance: 0.3, races: UNHOLY }, target: "enemy", desc: "弱った魔に引導を渡す。不浄は即死も" },
    EXORCIST_SEISA:       { name: "聖鎖", mp: 22, kind: "atk", power: 60, element: "light", seal: { chance: 0.5, turns: 3 }, debuff: { agi: 0.85 }, target: "enemy", desc: "光の鎖で縛り、特技と足を封じる（光）" },
    EXORCIST_REISUI:      { name: "霊水断ち", mp: 20, kind: "phys", power: 4.3, element: "water", drain: 0.12, target: "enemy", desc: "霊水の刃で斬り、己の傷を清める（水）" },
    EXORCIST_KEKKAIFUDA:  { name: "結界札", mp: 10, kind: "debuff", seal: { chance: 0.5, turns: 3 }, vuln: { light: 0.9 }, target: "all-enemy", tech: true, desc: "結界の札で特技を封じ、光に弱くする" },
    EXORCIST_HAMAYA:      { name: "破魔の光矢", mp: 28, kind: "atk", power: 80, element: "light", prey: { races: UNHOLY, mul: 1.4 }, target: "enemy", desc: "破魔の光矢。不浄の者を射抜く（光）" },
    EXORCIST_SEISUINAGI:  { name: "聖水なぎ", mp: 28, kind: "phys", power: 2.0, agiScale: 0.5, element: "water", vuln: { light: 0.85 }, target: "all-enemy", desc: "聖水で敵陣をなぎ、光への守りを崩す（水）" },
    EXORCIST_KOURIN:      { name: "浄化の光輪", mp: 20, kind: "atk", power: 44, element: "light", partyHeal: 15, target: "all-enemy", desc: "光輪が敵陣を灼き、味方を癒す（光）" },
    EXORCIST_JINRAI:      { name: "迅雷祓い", mp: 22, kind: "phys", power: 4.2, agiScale: 1.3, pieScale: 0.3, critBonus: 0.3, element: "light", target: "enemy", desc: "疾く鋭い一閃。信仰で威力が増す（光）" },
    EXORCIST_CHOUBUKU:    { name: "調伏", mp: 32, kind: "phys", power: 7.0, critBonus: 0.3, execute: 2, prey: { races: UNHOLY, mul: 1.3 }, target: "enemy", desc: "魔を調伏する奥義。弱った敵と不浄に強い" },
    EXORCIST_MISOGI:      { name: "禊の大波", mp: 28, kind: "phys", power: 2.1, element: "water", strip: true, target: "all-enemy", desc: "禊の大波が敵陣の加護を洗い流す（水）" },
    EXORCIST_ROKKON:      { name: "六根清浄", mp: 30, kind: "phys", power: 0.65, hits: 6, agiScale: 0.3, critBonus: 0.35, element: "light", debuff: { atk: 0.85 }, target: "enemy", desc: "六連の聖斬で魔の力を削ぐ（光）" },
    EXORCIST_OOHARAE:     { name: "大祓", mp: 30, kind: "atk", power: 62, element: "light", prey: { races: UNHOLY, mul: 1.5 }, strip: true, target: "all-enemy", desc: "祝詞が敵陣を灼き加護を祓う。不浄に強い（光）" },
    EXORCIST_GOUMA:       { name: "降魔の陣太刀", mp: 28, kind: "phys", power: 2.1, acc: 0.5, element: "light", seal: { chance: 0.35, turns: 2 }, target: "all-enemy", desc: "降魔の太刀が敵陣を斬り、特技を封じる（光）" },
    EXORCIST_KENSHOU:     { name: "破邪顕正", mp: 40, kind: "phys", power: 9.0, agiScale: 1.8, pieScale: 0.5, critBonus: 0.5, element: "light", prey: { races: UNHOLY, mul: 1.3 }, target: "enemy", desc: "邪を破り正を顕す究極の一閃（光）" },
  },
  perks: {
    // Lv15 の目玉パッシブ: 悪霊退散
    exorcistTaisan: {
      label: "悪霊退散",
      lv: ["不死・霊・悪魔への与ダメージ+10%、受けるダメージ-10%", "不死・霊・悪魔への与ダメージ+20%、受けるダメージ-20%", "不死・霊・悪魔への与ダメージ+30%、受けるダメージ-30%"],
      fx: [
        { t: "deal", when: { race: UNHOLY }, v: [0.10, 0.20, 0.30] },
        { t: "take", when: { race: UNHOLY }, v: [0.10, 0.20, 0.30] },
      ],
    },
    // 不浄の者を祓うための修練
    exorcistTaima: {
      label: "退魔の心得",
      lv: ["不死・幽鬼・悪魔への与ダメ+25%", "不死・幽鬼・悪魔への与ダメ+32%", "不死・幽鬼・悪魔への与ダメ+40%"],
      fx: [{ t: "deal", v: [0.25, 0.32, 0.4], when: { race: UNHOLY } }],
    },
    // 魔の本性を見抜き、急所を突いて爪をいなす
    exorcistHama: {
      label: "破魔の眼",
      lv: ["不浄の者への物理会心+12%、不浄の者からの被ダメ−5%", "不浄の者への物理会心+18%、被ダメ−8%", "不浄の者への物理会心+24%、被ダメ−12%"],
      fx: [
        { t: "crit", v: [0.12, 0.18, 0.24], when: { race: UNHOLY } },
        { t: "take", v: [0.05, 0.08, 0.12], when: { race: UNHOLY } },
      ],
    },
    // 斬りつけた傷に聖痕を残し、光を通りやすくする
    exorcistSeikon: {
      label: "聖痕刻み",
      lv: ["物理が当たると12%で敵の光耐性ダウン (光の被ダメ×1.18)", "物理で17%の聖痕", "物理で22%の聖痕", "物理で27%の聖痕"],
      fx: [{ t: "hit", chance: [0.12, 0.17, 0.22, 0.27], on: "phys", ail: "vuln", el: "light", mul: 0.85 }],
    },
    // 戦いの前に結界を張っておく
    exorcistSakibarai: {
      label: "先祓いの結界",
      lv: ["戦闘開始時、40%で味方全員に魔障壁1回 (呪文・ブレスの被ダメ半減)", "戦闘開始時、60%で味方全員に魔障壁1回", "戦闘開始時、80%で味方全員に魔障壁1回"],
      fx: [{ t: "start", chance: [0.4, 0.6, 0.8], party: true, barrier: [1, 1, 1] }],
    },
    // 水の禊で身を清め、竜の息を和らげる
    exorcistMisogi: {
      label: "禊の加護",
      lv: ["ブレスの被ダメ−10%", "ブレスの被ダメ−15%", "ブレスの被ダメ−20%"],
      fx: [
        { t: "take", v: [0.1, 0.15, 0.2], on: "breath" },
      ],
    },
  },
};
