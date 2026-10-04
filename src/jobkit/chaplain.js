// 護教官 (chaplain) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
// 持ち味: 味方を守る祈りの盾 — 身代わりに立ち、死を一度だけ退ける加護を配り、敵の狙いと牙を鈍らせる。光と静かな水
import { UNHOLY } from "./common.js";

export default {
  // ランクのパッシブ: 魂がランク2で目覚め、3・4・5で強まる (souls.js の JOB_PASSIVES)
  awaken: "chaplainSeitate",
  table: `
    1 SHIELDBASH 2 KOUJIN 3 CURE 5 chaplainJungo/1 7 CHOUHATSU 10 PROTECT
    12 SUIGETSU 15 CHAPLAIN_INORINOTATE 15 firstGuard/1 17 HOLYLIGHT 20 NIOUDACHI 25 chaplainNamida/1 30 GUARDALL
    35 chaplainZankyou/1 40 HOUSHOUHEKI 45 chaplainJungo/2 50 CHAPLAIN_INORINOTATEUCHI 50 firstGuard/2 55 CHAPLAIN_JOUSUI 57 CHAPLAIN_MABAYUKISEITSUI
    60 resistAilment/1 65 CHAPLAIN_MIGAWARI 70 chaplainSeiku/1 75 chaplainKouei/1 80 CHAPLAIN_MIZUKAGAMI 82 CHAPLAIN_NAGI
    85 CHAPLAIN_INORINOKOUHA 90 chaplainJungo/3 95 CHAPLAIN_SHUGONOSEIIN 100 CHAPLAIN_JUNREI 100 firstGuard/3 105 chaplainZankyou/2 107 CHAPLAIN_MAMORINOKOUKEN
    110 CHAPLAIN_MIZUGAKI 115 chaplainSeiku/2 120 CHAPLAIN_INORINOSABAKI 125 chaplainKouei/2 130 CHAPLAIN_RENTOU 135 resistAilment/2
    140 CHAPLAIN_INOCHIZUNA 145 chaplainJungo/4 150 CHAPLAIN_SEISUIKEKKAI 155 chaplainSeiku/3 160 CHAPLAIN_DAIKITOU 165 chaplainNamida/2
    170 CHAPLAIN_JUNKYOUSHA 175 chaplainZankyou/3 180 CHAPLAIN_SEIDAN 185 chaplainNamida/3 190 CHAPLAIN_SEIRYUUKOU 195 CHAPLAIN_YOMIGAERI
    200 CHAPLAIN_SEIGOJOU`,
  skills: {
    // Lv15 の固有技: 祈りの盾で味方を包む
    CHAPLAIN_INORINOTATE: { name: "祈りの盾", mp: 5, kind: "buff", buff: { vit: 1.25 }, grantBarrier: 1, target: "ally", desc: "祈りの盾で味方を包み、防御を上げて魔障壁を張る" },
    CHAPLAIN_INORINOTATEUCHI: { name: "祈りの盾打ち", mp: 6, kind: "phys", power: 1.3, vitScale: 0.3, acc: 0.9, flinchChance: 0.25, target: "enemy", desc: "祈りを込めた盾で打ち、怯ませる（命中UP）" },
    CHAPLAIN_JOUSUI: { name: "浄水の撒布", mp: 9, kind: "heal", power: 6, cure: true, purge: true, target: "all-ally", desc: "聖水を撒いて穢れと弱体を流し、少し癒す" },
    CHAPLAIN_MABAYUKISEITSUI: { name: "眩き聖槌", mp: 12, kind: "phys", power: 2.0, pieScale: 0.5, element: "light", acc: 0.6, debuff: { hit: 0.85 }, target: "enemy", desc: "眩い聖槌で打ち、敵の狙いを乱す" },
    CHAPLAIN_MIGAWARI: { name: "身代わりの祈り", mp: 6, kind: "buff", shield: true, buff: { vit: 1.2 }, dur: 2, tech: true, target: "self", desc: "祈りと共に、仲間への単体攻撃を代わりに受ける" },
    CHAPLAIN_MIZUKAGAMI: { name: "水鏡の帳", mp: 11, kind: "buff", buff: { vit: 1.3 }, debuffAll: { hit: 0.9 }, target: "all-ally", desc: "水鏡の帳で味方を守り、敵の狙いを乱す" },
    CHAPLAIN_NAGI: { name: "凪の一打", mp: 11, kind: "phys", power: 2.4, element: "water", acc: 0.5, sleepChance: 0.2, target: "enemy", desc: "静かな波の一打で、眠りに誘う" },
    CHAPLAIN_INORINOKOUHA: { name: "祈りの光波", mp: 10, kind: "atk", power: 20, element: "light", debuff: { atk: 0.9 }, target: "all-enemy", desc: "光波が敵全体を灼き、力を鈍らせる" },
    CHAPLAIN_SHUGONOSEIIN: { name: "守護の聖印", mp: 12, kind: "buff", buff: { vit: 1.5 }, regen: { pct: 0.06, turns: 3 }, cure: true, purge: true, target: "ally", desc: "一人を聖印で包み、守り癒し続ける" },
    CHAPLAIN_JUNREI: { name: "巡礼の鉄槌", mp: 18, kind: "phys", power: 2.8, vitScale: 1.3, pieScale: 0.4, acc: 1, target: "enemy", desc: "鎧と信仰の重みを乗せた必中の鉄槌" },
    CHAPLAIN_MAMORINOKOUKEN: { name: "護りの光剣", mp: 21, kind: "phys", power: 4.0, pieScale: 1.0, element: "light", acc: 1, debuff: { atk: 0.8 }, target: "enemy", desc: "必中の光剣で断ち、仲間を襲う力を挫く" },
    CHAPLAIN_MIZUGAKI: { name: "慈悲の水垣", mp: 16, kind: "heal", power: 16, buff: { vit: 1.2 }, cure: true, target: "all-ally", desc: "水垣で味方全員を癒し守り、状態異常を治す" },
    CHAPLAIN_INORINOSABAKI: { name: "祈りの裁き", mp: 22, kind: "atk", power: 58, element: "light", debuff: { hit: 0.8 }, target: "enemy", desc: "裁きの光で撃ち、目を眩ませる" },
    CHAPLAIN_RENTOU: { name: "盾の連祷", mp: 21, kind: "buff", buff: { vit: 1.45 }, regen: { pct: 0.04, turns: 3 }, target: "all-ally", desc: "連祷が味方全体を守り、癒しを宿す" },
    CHAPLAIN_INOCHIZUNA: { name: "命綱の祈り", mp: 28, kind: "heal", power: 120, grantEndure: true, cure: true, regen: { pct: 0.06, turns: 3 }, target: "ally", desc: "一人を大きく癒し、致死を一度だけ耐えさせる" },
    CHAPLAIN_SEISUIKEKKAI: { name: "聖水の結界", mp: 22, kind: "buff", grantBarrier: 1, regen: { pct: 0.03, turns: 3 }, cure: true, target: "all-ally", desc: "聖水の結界で魔障壁を張り、癒しを宿す" },
    CHAPLAIN_DAIKITOU: { name: "護教の大祈祷", mp: 30, kind: "heal", power: 30, buff: { vit: 1.35 }, regen: { pct: 0.04, turns: 3 }, target: "all-ally", desc: "味方全員を癒し、守りと癒しの加護を授ける" },
    CHAPLAIN_JUNKYOUSHA: { name: "殉教者の大盾", mp: 26, kind: "buff", shield: true, taunt: true, buff: { vit: 1.5 }, grantBarrier: 1, tech: true, target: "self", desc: "敵を引き付けて仲間を庇い、魔障壁を張る" },
    CHAPLAIN_SEIDAN: { name: "聖壇の守り", mp: 30, kind: "buff", buff: { vit: 1.5 }, debuffAll: { atk: 0.85 }, target: "all-ally", desc: "聖壇の加護で味方を守り、敵の力を挫く" },
    CHAPLAIN_SEIRYUUKOU: { name: "聖流光", mp: 30, kind: "atk", power: 66, element: "light", prey: { races: UNHOLY, mul: 1.3 }, debuff: { hit: 0.85 }, target: "all-enemy", desc: "光の奔流が敵全体を呑み、狙いを乱す" },
    CHAPLAIN_YOMIGAERI: { name: "蘇りの連祷", mp: 44, kind: "heal", power: 90, revive: true, revivePct: 0.5, cure: true, purge: true, regen: { pct: 0.05, turns: 3 }, target: "all-ally", desc: "倒れた者を呼び戻し、全員を癒し続ける" },
    CHAPLAIN_SEIGOJOU: { name: "聖護城", mp: 40, kind: "heal", power: 40, buff: { vit: 1.6 }, grantBarrier: 1, regen: { pct: 0.04, turns: 3 }, target: "all-ally", desc: "味方全体を癒し、守りと障壁と癒しで包む" },
  },
  perks: {
    // ランクのパッシブ: 祈りの盾が、隊のすべてを覆う
    chaplainSeitate: {
      label: "聖なる盾",
      lv: ["護教官が生きている間、味方全員の受けるダメージ-3%", "護教官が生きている間、味方全員の受けるダメージ-5%", "護教官が生きている間、味方全員の受けるダメージ-8%", "護教官が生きている間、味方全員の受けるダメージ-12%"],
      fx: [{ t: "take", aura: true, v: [0.03, 0.05, 0.08, 0.12] }],
    },
    chaplainJungo: {
      label: "殉護の祈り",
      lv: ["戦闘開始時、20%で味方全員に「致死をHP1で一度耐える」加護", "戦闘開始時、30%で味方全員に「致死をHP1で一度耐える」加護", "戦闘開始時、40%で味方全員に「致死をHP1で一度耐える」加護", "戦闘開始時、50%で味方全員に「致死をHP1で一度耐える」加護"],
      fx: [{ t: "start", party: true, chance: [0.2, 0.3, 0.4, 0.5], endure: true }],
    },
    chaplainKouei: {
      label: "後衛の守護",
      lv: ["後衛の味方全員の被ダメージ-6%", "後衛の味方全員の被ダメージ-10%", "後衛の味方全員の被ダメージ-14%"],
      fx: [{ t: "take", aura: true, when: { back: true }, v: [0.06, 0.10, 0.14] }],
    },
    chaplainNamida: {
      label: "涙の祈り",
      lv: ["味方が倒れるとHPを最大の10%回復・VIT×1.2 (3ターン)", "味方が倒れるとHPを最大の15%回復・VIT×1.3 (3ターン)", "味方が倒れるとHPを最大の20%回復・VIT×1.4 (3ターン)"],
      fx: [{ t: "fall", hp: [0.10, 0.15, 0.20], buff: { vit: [1.2, 1.3, 1.4] }, dur: 3 }],
    },
    chaplainZankyou: {
      label: "祈りの残響",
      lv: ["強化の技・祈りの後、25%で消費MPが戻る", "強化の技・祈りの後、35%で消費MPが戻る", "強化の技・祈りの後、45%で消費MPが戻る"],
      fx: [{ t: "cast", on: "buff", chance: [0.25, 0.35, 0.45], refund: true }],
    },
    chaplainSeiku: {
      label: "護教の聖句",
      lv: ["回復量+8%・不死/幽鬼/悪魔への与ダメージ+10%", "回復量+12%・不死/幽鬼/悪魔への与ダメージ+15%", "回復量+16%・不死/幽鬼/悪魔への与ダメージ+20%"],
      fx: [{ t: "heal", v: [0.08, 0.12, 0.16] }, { t: "deal", when: { race: UNHOLY }, v: [0.10, 0.15, 0.20] }],
    },
  },
};
