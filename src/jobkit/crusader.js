// 聖戦士 (crusader) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
// 持ち味: 聖なる攻めの突撃と十字の剣。不浄を討ち、昂るほど鋭くなる (光/火)
import { UNHOLY } from "./common.js";
export default {
  table: `
    1 KYOUGEKI 2 KOUJIN 3 HOLYRAY 5 crusaderFujouUchi/1 7 NERAIUCHI 10 BLESS
    12 KAENGIRI 15 crusaderSeikaKate/1 20 CRUSADER_SEIINTSUKI 22 CRUSADER_JUUJISENKOU 25 crusaderFujouUchi/2 30 SEISEN
    35 crusaderTotsugekiIkioi/1 40 JUUJIZAN 45 crusaderSeinaruKouyou/1 50 JOUKA 55 SHINGANGEKI 57 SEIGEKI
    60 crusaderSeikaKate/2 65 CRUSADER_SEISHOU 70 crusaderJunkyoushin/1 75 crusaderJunkyoushin/2 80 CRUSADER_SEIENTOTSU 82 GURENZAN
    85 REVIVE 90 resistAilment/1 95 CRUSADER_JUUJIBARAI 100 CRUSADER_KOUCHUU 105 crusaderTotsugekiIkioi/2 107 CRUSADER_SHOKUZAI
    110 CRUSADER_SHAKUNETSU 115 crusaderFujouUchi/3 120 CRUSADER_SEISENTOTSU 125 crusaderJunkyoushin/3 130 CRUSADER_SEIENCHIKAI 135 crusaderSeikaKate/3
    140 CRUSADER_JUUJISABAKI 145 resistAilment/2 150 CRUSADER_DAITOTSUGEKI 155 crusaderSeinaruKouyou/2 160 CRUSADER_JOUMETSU 162 KOUBOURANBU
    165 crusaderJunkyoushin/4 170 CRUSADER_SEIRAKU 175 crusaderSeinaruKouyou/3 180 CRUSADER_GAIKA 185 crusaderTotsugekiIkioi/3 190 CRUSADER_TOTSUGEKIJIN
    195 CRUSADER_TENSHI 200 CRUSADER_SEIJUUJI`,
  skills: {
    CRUSADER_SEIINTSUKI: { name: "聖印突き", mp: 4, kind: "phys", power: 1.3, element: "light", acc: 0.6, prey: { races: UNHOLY, mul: 1.6 }, flinchChance: 0.2, target: "enemy", desc: "聖印の突きで怯ませる。不浄の者に強い" },
    CRUSADER_JUUJISENKOU: { name: "十字の閃光", mp: 9, kind: "phys", power: 0.8, element: "light", debuff: { hit: 0.9 }, target: "all-enemy", desc: "十字の閃光で敵全体を斬り、目を眩ます" },
    CRUSADER_SEISHOU: { name: "聖鐘の閃光", mp: 9, kind: "atk", power: 22, element: "light", seal: { chance: 0.35, turns: 2 }, target: "all-enemy", desc: "聖鐘の光で敵全体を撃ち、特技を封じる" },
    CRUSADER_SEIENTOTSU: { name: "聖炎の突撃", mp: 10, kind: "phys", power: 2.6, element: "fire", acc: 0.5, debuff: { vit: 0.85 }, target: "enemy", desc: "聖炎を纏って突撃し、守りを崩す" },
    CRUSADER_JUUJIBARAI: { name: "十字架の薙ぎ", mp: 18, kind: "phys", power: 1.8, element: "light", acc: 0.6, prey: { races: UNHOLY, mul: 1.3 }, target: "all-enemy", desc: "十字架の剣で敵全体を薙ぐ。不浄の者に強い" },
    CRUSADER_KOUCHUU: { name: "聖裁の光柱", mp: 22, kind: "atk", power: 62, element: "light", strip: true, target: "enemy", desc: "聖裁の光柱で撃ち、強化を打ち砕く" },
    CRUSADER_SHOKUZAI: { name: "贖罪の刃", mp: 21, kind: "phys", power: 4.4, pieScale: 0.8, element: "light", acc: 0.9, drain: 0.2, target: "enemy", desc: "信仰を込めた刃で斬り、命を取り戻す" },
    CRUSADER_SHAKUNETSU: { name: "灼熱の楔", mp: 16, kind: "phys", power: 3.5, element: "fire", acc: 0.8, pierce: 0.6, target: "enemy", desc: "灼熱の楔を打ち込む（防御を無視・命中UP）" },
    CRUSADER_SEISENTOTSU: { name: "聖戦の突撃", mp: 24, kind: "phys", power: 5.6, element: "light", acc: 1, debuff: { agi: 0.85 }, target: "enemy", desc: "必中の突撃で敵の足を止める" },
    CRUSADER_SEIENCHIKAI: { name: "聖炎の誓い", mp: 12, kind: "buff", buff: { atk: 1.45, agi: 1.15 }, regen: { pct: 0.05, turns: 3 }, target: "self", tech: true, desc: "聖炎を纏い攻めと速さを上げ、傷を癒し続ける" },
    CRUSADER_JUUJISABAKI: { name: "光十字の裁き", mp: 28, kind: "atk", power: 84, element: "light", debuff: { atk: 0.85 }, target: "enemy", desc: "光の十字架で撃ち抜き、力を削ぐ" },
    CRUSADER_DAITOTSUGEKI: { name: "聖騎の大突撃", mp: 28, kind: "phys", power: 6.8, element: "fire", acc: 1, pierce: 0.3, flinchChance: 0.35, target: "enemy", desc: "必中の大突撃で鎧を貫き、怯ませる" },
    CRUSADER_JOUMETSU: { name: "浄滅の聖光", mp: 30, kind: "atk", power: 66, element: "light", prey: { races: UNHOLY, mul: 1.4 }, flinchChance: 0.2, target: "all-enemy", desc: "敵全体を浄める聖光。不浄の者に強い" },
    CRUSADER_SEIRAKU: { name: "聖烙の大剣", mp: 32, kind: "phys", power: 8.4, element: "light", acc: 1, vuln: { light: 0.85 }, target: "enemy", desc: "必中の大剣で聖烙を刻み、光に脆くする" },
    CRUSADER_GAIKA: { name: "凱歌の祈り", mp: 36, kind: "heal", power: 68, cure: true, buff: { atk: 1.15 }, target: "all-ally", desc: "凱歌で味方全員を癒し、異常を治し攻めを高める" },
    CRUSADER_TOTSUGEKIJIN: { name: "聖炎の突撃陣", mp: 30, kind: "phys", power: 2.9, element: "fire", acc: 0.9, target: "all-enemy", desc: "聖炎の陣で敵全体に突撃する（命中UP）" },
    CRUSADER_TENSHI: { name: "天使降臨", mp: 44, kind: "heal", power: 200, revive: true, revivePct: 0.6, cure: true, buff: { vit: 1.15 }, target: "all-ally", desc: "天使が倒れた者を蘇らせ (HP60%)、全員を癒し守る" },
    CRUSADER_SEIJUUJI: { name: "聖十字・終焉", mp: 40, kind: "phys", power: 5.6, hits: 2, element: "light", acc: 1, pierce: 0.8, prey: { races: UNHOLY, mul: 1.3 }, target: "enemy", desc: "鎧を貫く必中の十字二連。不浄の者に強い" },
  },
  perks: {
    crusaderFujouUchi: { label: "不浄討ちの誓い", lv: ["不死・幽鬼・悪魔への与ダメ+20%・会心+5%", "不死・幽鬼・悪魔への与ダメ+30%・会心+10%", "不死・幽鬼・悪魔への与ダメ+40%・会心+15%"],
      fx: [{ t: "deal", v: [0.2, 0.3, 0.4], when: { race: UNHOLY } }, { t: "crit", v: [0.05, 0.1, 0.15], when: { race: UNHOLY } }] },
    crusaderSeikaKate: { label: "聖火の糧", lv: ["敵を倒すとHP4%回復", "敵を倒すとHP6%回復", "敵を倒すとHP8%回復"],
      fx: [{ t: "kill", hp: [0.04, 0.06, 0.08] }] },
    crusaderTotsugekiIkioi: { label: "突撃の勢い", lv: ["戦闘開始時、ATK×1.15・AGI×1.1 (2ターン)", "戦闘開始時、ATK×1.2・AGI×1.1 (2ターン)", "戦闘開始時、ATK×1.25・AGI×1.15 (2ターン)"],
      fx: [{ t: "start", buff: { atk: [1.15, 1.2, 1.25], agi: [1.1, 1.1, 1.15] }, dur: 2 }] },
    crusaderSeinaruKouyou: { label: "聖なる昂揚", lv: ["強化中、物理の会心+6%", "強化中、物理の会心+10%", "強化中、物理の会心+14%"],
      fx: [{ t: "crit", v: [0.06, 0.1, 0.14], when: { buffed: true } }] },
    crusaderJunkyoushin: { label: "昂る殉教心", lv: ["物理を受けると20%でATK×1.15 (2ターン)", "物理を受けると25%でATK×1.2", "物理を受けると30%でATK×1.25", "物理を受けると35%でATK×1.3"],
      fx: [{ t: "hurt", chance: [0.2, 0.25, 0.3, 0.35], buff: { atk: [1.15, 1.2, 1.25, 1.3] }, dur: 2 }] },
  },
};
