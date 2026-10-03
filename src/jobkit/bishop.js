// 司教 (bishop) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
// 持ち味: 鑑定と聖水の祈祷師。水と光の祈りで不浄を祓い、聖水で隊を清め、倒れた者を呼び戻す (鑑定Lv2)。
import { UNHOLY } from "./common.js";

export default {
  table: `
    1 kantei/2 3 DIOS 4 HOLYRAY 5 bishopSeisui/1 7 ICENEEDLE 10 CURE
    15 afterBoth/1 20 SEAL 22 BISHOP_MICHISHIRUBE 25 bishopJouka/1 30 DIAL 35 bishopTobari/1
    40 MADIOS 45 bishopYoin/1 47 ICELANCE 50 BISHOP_SEISUI 55 BISHOP_SENREI 60 bishopSeisui/2
    65 BISHOP_SEIHYOU 70 bishopTobari/2 75 afterBoth/2 80 MANAGIFT 85 SAINTRAY 90 bishopJouka/2
    95 BISHOP_SEIHAI 100 BISHOP_SEISEN 105 bishopYoin/2 110 BISHOP_JIU 115 bishopSeisui/3 120 SEALALL
    125 bishopTobari/3 130 BISHOP_SHUKUFUKU 132 BISHOP_SEIRYUU 135 bishopJouka/3 140 BISHOP_HOSHI 145 resistAilment/1
    150 BISHOP_KANCHOU 155 elemFloor/1 160 BISHOP_SEIGAI 165 resistAilment/2 170 BISHOP_DANZAI 172 BISHOP_SEIHYOUKAN
    175 bishopYoin/3 180 BISHOP_SEIKA 185 sanctuary/1 190 SEIMETSUREKKOU 195 BISHOP_SEISOU 200 BISHOP_SHINPAN`,
  skills: {
    // 迷宮で唱える術: 祈りの導きで、この階の下り階段を示す
    BISHOP_MICHISHIRUBE: { name: "道しるべ", mp: 6, kind: "field", sense: "stairs", target: "all-ally", desc: "この階の下り階段の在りかを示し、その周囲8マスの墓石をめくる（迷宮で唱える）" },
    BISHOP_SEISUI:     { name: "聖水の雫", mp: 7, kind: "heal", power: 15, cure: true, target: "all-ally", desc: "聖水を撒き、味方全員を癒し穢れを祓う" },
    BISHOP_SENREI:     { name: "洗礼の聖水", mp: 6, kind: "debuff", strip: true, seal: { chance: 0.25, turns: 2 }, target: "all-enemy", desc: "聖水で強化を洗い流し、特技を封じる" },
    BISHOP_SEIHYOU:    { name: "聖氷の祈り", mp: 10, kind: "atk", power: 30, element: "water", prey: { races: UNHOLY, mul: 1.4 }, target: "all-enemy", desc: "聖別した氷雨。不浄の者に強い" },
    BISHOP_SEIHAI:     { name: "聖杯の祈り", mp: 13, kind: "heal", power: 36, buff: { vit: 1.15 }, target: "all-ally", desc: "味方全員を癒し、守りを授ける" },
    BISHOP_SEISEN:     { name: "聖泉の槍", mp: 14, kind: "atk", power: 36, element: "water", seal: { chance: 0.4, turns: 2 }, target: "enemy", desc: "聖泉の槍で撃ち、邪な力を封じる" },
    BISHOP_JIU:        { name: "聖水の慈雨", mp: 12, kind: "heal", power: 0, revive: true, revivePct: 0.25, target: "all-ally", desc: "倒れた者すべてをHP25%で呼び戻す" },
    BISHOP_SHUKUFUKU:  { name: "祝福の潮", mp: 22, kind: "heal", power: 60, regen: { pct: 0.03, turns: 3 }, target: "all-ally", desc: "祝福の潮が味方を癒し、癒しが続く" },
    BISHOP_SEIRYUU:    { name: "聖流の裁き", mp: 20, kind: "atk", power: 50, element: "water", debuff: { atk: 0.9 }, target: "all-enemy", desc: "聖なる奔流が邪な力を鎮める" },
    BISHOP_HOSHI:      { name: "星の聖別", mp: 22, kind: "atk", power: 56, vuln: { light: 0.85 }, target: "all-enemy", desc: "星明かりで敵全体を撃ち、光に弱らせる" },
    BISHOP_KANCHOU:    { name: "聖水灌頂", mp: 9, kind: "buff", buff: { vit: 1.1 }, cure: true, purge: true, target: "all-ally", desc: "聖水を注ぎ、穢れと弱体を祓い守る" },
    BISHOP_SEIGAI:     { name: "聖骸の祈り", mp: 14, kind: "heal", power: 0, revive: true, revivePct: 1, regen: { pct: 0.05, turns: 2 }, target: "ally", desc: "HP100%で蘇らせ、癒しの加護を宿す" },
    BISHOP_DANZAI:     { name: "聖印の断罪", mp: 22, kind: "atk", power: 62, element: "light", instakill: { chance: 0.2, races: UNHOLY }, target: "enemy", desc: "聖印の裁き。不浄の者を稀に消し去る" },
    BISHOP_SEIHYOUKAN: { name: "聖氷の棺", mp: 26, kind: "atk", power: 80, element: "water", sleepChance: 0.25, target: "enemy", desc: "聖氷の棺に封じ、眠らせる" },
    BISHOP_SEIKA:      { name: "天上の聖歌", mp: 36, kind: "heal", power: 72, cure: true, purge: true, buff: { vit: 1.15 }, target: "all-ally", desc: "味方全員を癒し、穢れを祓い守りを授ける" },
    BISHOP_SEISOU:     { name: "天の聖槍", mp: 28, kind: "atk", power: 86, element: "light", strip: true, target: "enemy", desc: "天より聖槍を降らせ、強化を貫く" },
    BISHOP_SHINPAN:    { name: "審判の日", mp: 44, kind: "atk", power: 126, prey: { races: UNHOLY, mul: 1.3 }, target: "all-enemy", desc: "審判の光が万象を討つ。不浄の者に強い" },
  },
  perks: {
    bishopSeisui: {
      label: "聖水の加護",
      lv: ["戦闘開始時、味方全員にリジェネ (毎ラウンド最大HPの2%・3ターン)", "戦闘開始時、味方全員にリジェネ (毎ラウンド最大HPの3%・3ターン)",
        "戦闘開始時、味方全員にリジェネ (毎ラウンド最大HPの4%・3ターン)"],
      fx: [{ t: "start", party: true, regen: [0.02, 0.03, 0.04], dur: 3 }],
    },
    bishopJouka: {
      label: "浄めの裁き",
      lv: ["不死・霊・悪魔への攻撃呪文の与ダメージ+10%", "不死・霊・悪魔への攻撃呪文の与ダメージ+18%", "不死・霊・悪魔への攻撃呪文の与ダメージ+25%"],
      fx: [{ t: "deal", on: "spell", when: { race: UNHOLY }, v: [0.1, 0.18, 0.25] }],
    },
    bishopTobari: {
      label: "聖水の帳",
      lv: ["味方全員のブレス・呪文の被ダメージ-5%", "味方全員のブレス・呪文の被ダメージ-8%", "味方全員のブレス・呪文の被ダメージ-12%"],
      fx: [{ t: "take", on: "breath", aura: true, v: [0.05, 0.08, 0.12] }],
    },
    bishopYoin: {
      label: "祈りの余韻",
      lv: ["戦闘勝利後、味方全員のMPを最大の2%回復", "戦闘勝利後、味方全員のMPを最大の3%回復", "戦闘勝利後、味方全員のMPを最大の5%回復"],
      fx: [{ t: "win", party: true, mp: [0.02, 0.03, 0.05] }],
    },
  },
};
