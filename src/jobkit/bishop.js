// 全職見直し: 鑑定・見破り・清めで探索と戦闘をつなぐ。ランクパッシブは維持。
// 司教 (bishop) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
// 持ち味: 鑑定と聖水の祈祷師。水と光の祈りで不浄を祓い、聖水で隊を清め、倒れた者を呼び戻す (鑑定Lv2 → Lv50 で Lv3 → Lv100 で Lv4。
// 2026-10 ユーザーの指示で「目利き」を鑑定に統一し、Lv15 の目玉は品の真贋を見抜く眼で敵の守りの綻びを見破る「見破りの眼」にした)。
import { UNHOLY } from "./common.js";

export default {
  // ランクのパッシブ: 魂がランク2で目覚め、3・4・5で強まる (souls.js の JOB_PASSIVES)
  awaken: "bishopSeibetsu",
  table: `
    1 kantei/2 3 DIOS 4 HOLYRAY 5 bishopSeisui/1 7 ICENEEDLE 10 CURE
    12 BISHOP_SEISUIMAKI 15 bishopMiyaburi/1 18 SEAL 20 RECOVER 22 BISHOP_MICHISHIRUBE 25 bishopJouka/1
    25 DIOSALL 25 bishopYoin/1 30 AWAKE 35 bishopTobari/1 35 BISHOP_SENREI 40 DIAL
    45 STONECURE 47 ICELANCE 50 kantei/3 50 bishopMiyaburi/2 50 DIALALL 55 REVIVE
    60 bishopSeisui/2 60 afterBoth/1 65 BISHOP_SEIHYOU 65 bishopYoin/2 70 bishopTobari/2 75 MANAGIFT
    80 MADIOS 85 SAINTRAY 90 bishopJouka/2 95 BISHOP_SEIHAI 95 BISHOP_SEISEN 100 kantei/4
    100 bishopMiyaburi/3 100 PURIFY 110 BISHOP_JIU 115 bishopSeisui/3 120 SEALALL 125 bishopTobari/3
    130 BISHOP_SHUKUFUKU 132 BISHOP_SEIRYUU 135 bishopJouka/3 135 bishopYoin/3 140 BISHOP_HOSHI 145 resistAilment/1
    150 BISHOP_KANCHOU 155 elemFloor/1 160 BISHOP_SEIGAI 165 resistAilment/2 170 BISHOP_DANZAI 172 BISHOP_SEIHYOUKAN
    180 BISHOP_SEIKA 185 sanctuary/1 190 SEIMETSUREKKOU 195 BISHOP_SEISOU 200 BISHOP_SHINPAN`,
  skills: {
    // 序盤の固有技: 聖水を撒いて群れを清める祈りの呪文
    BISHOP_SEISUIMAKI: {name: "聖水撒き", mp: 6, kind: "atk", power: 12, element: "water", faith: true, prey: {races: ["undead", "specter", "demon"], mul: 1.3}, target: "all-enemy", desc: "聖水で敵全体の強化を祓う。不浄の者に強い水の呪文（PIEでも伸びる）", dur: 3, strip: true},
    // 迷宮で唱える術: 祈りの導きで、この階の下り階段を示す
    BISHOP_MICHISHIRUBE: { name: "道しるべ", mpPct: 0.3, mp: 6, kind: "field", sense: "stairs", target: "all-ally", desc: "この階の下り階段の在りかを示し、その周囲8マスのカードをめくる（迷宮で唱える。効くのはこの階だけ）" },
    BISHOP_SENREI:     { name: "洗礼の聖水", mp: 6, kind: "debuff", strip: true, seal: { chance: 0.25, turns: 2 }, target: "all-enemy", desc: "聖水で強化を洗い流し、特技を封じる" },
    BISHOP_SEIHYOU:    { name: "聖氷の祈り", mp: 13, kind: "atk", power: 30, element: "water", prey: { races: UNHOLY, mul: 1.4 }, target: "all-enemy", desc: "聖別した氷雨。不浄の者に強い" },
    BISHOP_SEIHAI:     { name: "聖杯の祈り", mp: 20, kind: "heal", healMul: 1.5, buff: { vit: 1.15 }, target: "all-ally", desc: "味方全員を癒し、守りを授ける" },
    BISHOP_SEISEN:     { name: "聖泉の槍", mp: 14, kind: "atk", power: 36, element: "water", seal: { chance: 0.4, turns: 2 }, target: "enemy", desc: "聖泉の槍で撃ち、邪な力を封じる" },
    BISHOP_JIU:        { name: "聖水の慈雨", mp: 25, kind: "heal", revive: true, revivePct: 0.25, target: "all-ally", desc: "倒れた者すべてをHP25%で呼び戻す" },
    BISHOP_SHUKUFUKU:  { name: "祝福の潮", mp: 24, kind: "heal", healMul: 1.9, regen: { pct: 0.03, turns: 3 }, target: "all-ally", desc: "祝福の潮が味方を癒し、癒しが続く" },
    BISHOP_SEIRYUU:    { name: "聖流の裁き", mp: 20, kind: "atk", power: 50, element: "water", debuff: { atk: 0.9 }, target: "all-enemy", desc: "聖なる奔流が邪な力を鎮める" },
    BISHOP_HOSHI:      { name: "星の聖別", mp: 23, kind: "atk", power: 56, vuln: { light: 0.85 }, target: "all-enemy", desc: "星明かりで敵全体を撃ち、光に弱らせる" },
    BISHOP_KANCHOU:    {name: "聖水灌頂", mp: 12, kind: "buff", buff: {vit: 1.25}, cure: true, purge: true, target: "all-ally", desc: "聖水で味方全員を清め、弱体を祓う。VITを1段上げ、魔障壁1回を授ける", dur: 3, grantBarrier: 1},
    BISHOP_SEIGAI:     { name: "聖骸の祈り", mp: 100, kind: "heal", revive: true, revivePct: 1, regen: { pct: 0.05, turns: 2 }, target: "ally", desc: "HP100%で蘇らせ、癒しの加護を宿す" },
    BISHOP_DANZAI:     { name: "聖印の断罪", mp: 22, kind: "atk", power: 62, element: "light", instakill: { chance: 0.2, races: UNHOLY }, target: "enemy", desc: "聖印の裁き。不浄の者を稀に消し去る" },
    BISHOP_SEIHYOUKAN: { name: "聖氷の棺", mp: 26, kind: "atk", power: 80, element: "water", sleepChance: 0.25, target: "enemy", desc: "聖氷の棺に封じ、眠らせる" },
    BISHOP_SEIKA:      { name: "天上の聖歌", mp: 32, kind: "heal", healMul: 2.1, cure: true, purge: true, buff: { vit: 1.15 }, target: "all-ally", desc: "味方全員を癒し、穢れを祓い守りを授ける" },
    BISHOP_SEISOU:     { name: "天の聖槍", mp: 28, kind: "atk", power: 86, element: "light", strip: true, target: "enemy", desc: "天より聖槍を降らせ、強化を貫く" },
    BISHOP_SHINPAN:    { name: "審判の日", mp: 59, kind: "atk", power: 126, prey: { races: UNHOLY, mul: 1.3 }, target: "all-enemy", desc: "審判の光が万象を討つ。不浄の者に強い" },
  },
  perks: {
    // Lv15 の目玉 (Lv50・Lv100 で伸びる): 品の真贋を見抜く眼が、魔物の守りの綻びも見破る。段は1段のまま、続くターンが伸びる
    bishopMiyaburi: {
      label: "見破りの眼",
      lv: ["戦闘開始時、敵全体のVIT −1段 (2ターン)", "戦闘開始時、敵全体のVIT −1段 (3ターン)", "戦闘開始時、敵全体のVIT −1段 (4ターン)"],
      fx: [{ t: "start", foe: { vit: 0.8 }, dur: [2, 3, 4] }],
    },
    bishopSeisui: {
      label: "聖水の加護",
      lv: ["戦闘開始時、味方全員にリジェネ (毎ターン最大HPの2%・3ターン)", "戦闘開始時、味方全員にリジェネ (毎ターン最大HPの3%・3ターン)",
        "戦闘開始時、味方全員にリジェネ (毎ターン最大HPの4%・3ターン)"],
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
      lv: ["戦闘勝利後、味方全員のMPを最大の1%回復", "戦闘勝利後、味方全員のMPを最大の1.5%回復", "戦闘勝利後、味方全員のMPを最大の2%回復"],
      fx: [{ t: "win", party: true, mp: [0.01, 0.015, 0.02] }],
    },
  },
};
