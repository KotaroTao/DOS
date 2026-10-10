// 神殿騎士 (templar) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
// 持ち味: 封魔と結界の門番 — 特技を封じ、強化を剥ぎ、魔障壁を重ねて呪文とブレスを門の外に留める
import { UNHOLY } from "./common.js";

export default {
  // ランクのパッシブ: 魂がランク2で目覚め、3・4・5で強まる (souls.js の JOB_PASSIVES)
  awaken: "templarIkou",
  table: `
    1 SHIELDBASH 2 KOUJIN 3 DIOS 5 templarMonshu/1 7 CHOUHATSU 10 PROTECT 12 NERAIUCHI 15 TEMPLAR_MONKEKKAI
    15 templarShinsei/1 17 HOLYLIGHT 20 FUUMANOTATE 20 RECOVER 25 templarFuumakusabi/1 25 AWAKE 30 NIOUDACHI
    30 DIOSALL 35 templarKairitsu/1 40 SEIIKINOKANE 40 DIAL 45 templarMonkekkai/1 50 STONECURE
    50 templarShinsei/2 55 TEMPLAR_KUSARIUCHI 57 TEMPLAR_SEIINUCHI 30 templarMayoke/1
    65 TEMPLAR_MONZENNOHARAI 70 resistAilment/1 75 templarFuumakusabi/2 80 TEMPLAR_MISOGI
    82 TEMPLAR_HAKAINOISHIZUCHI 85 TEMPLAR_HAMANOKOUSA 90 templarMonkekkai/2 95 TEMPLAR_MONBANNOKAMAE
    100 TEMPLAR_HAMANOOOZUCHI 100 templarShinsei/3 105 templarFuumakusabi/3 110 TEMPLAR_SEIIKIKEKKAI
    115 templarMonshu/2 120 TEMPLAR_DANZAINOFUUIN 125 templarMonkekkai/3 130 TEMPLAR_OOTOBIRA
    135 resistAilment/2 140 TEMPLAR_SEIKANOHARAI 145 templarMonshu/3 150 TEMPLAR_SANJUUKEKKAI
    155 templarFuumakusabi/4 160 TEMPLAR_FUUMANOOOGANE 162 TEMPLAR_KOUSANAGI 165 templarMayoke/2
    170 TEMPLAR_SHUMONNOJIN 175 templarKairitsu/2 180 TEMPLAR_SEIDOUKISHI 185 templarMonkekkai/4
    190 TEMPLAR_SHINDENNOSHINPAN 195 TEMPLAR_SAIRINNOSEIMON 200 TEMPLAR_ZETTAIKEKKAI`,
  skills: {
    // Lv15 の固有技: 門に立ち塞がって敵を引き付け、魔障壁を張る
    TEMPLAR_MONKEKKAI: { name: "門の結界", mp: 5, kind: "buff", taunt: true, grantBarrier: 1, target: "self", desc: "門に立ち塞がって敵を引き付け、魔障壁を張る" },
    TEMPLAR_KUSARIUCHI: { name: "鎖打ち", mp: 7, kind: "phys", power: 1.3, acc: 0.8, seal: { chance: 0.35, turns: 2 }, target: "enemy", desc: "聖鎖を絡めて打ち、特技を封じる" },
    TEMPLAR_SEIINUCHI: { name: "聖印打ち", mp: 12, kind: "phys", power: 2.0, pieScale: 0.5, element: "light", acc: 0.6, mpDrain: 0.15, target: "enemy", desc: "聖印を刻んで打ち、魔力を吸い上げる" },
    TEMPLAR_MONZENNOHARAI: { name: "門前の祓い", mp: 7, kind: "buff", buff: { vit: 1.2 }, purge: true, target: "all-ally", desc: "味方全体の守りを固め、弱体を祓う" },
    TEMPLAR_MISOGI: { name: "禊の聖水", mp: 9, kind: "buff", cure: ["poison", "paralyze", "sleep"], purge: true, regen: { pct: 0.03, turns: 2 }, target: "all-ally", desc: "全員の毒・猛毒・麻痺・眠りと弱体を流し、わずかに癒し続ける" },
    TEMPLAR_HAKAINOISHIZUCHI: { name: "破戒の石槌", mp: 12, kind: "phys", power: 2.4, element: "earth", acc: 0.5, strip: true, target: "enemy", desc: "石槌で打ち、敵の強化を打ち砕く" },
    TEMPLAR_HAMANOKOUSA: { name: "破魔の光鎖", mp: 10, kind: "atk", power: 20, element: "light", seal: { chance: 0.25, turns: 2 }, target: "all-enemy", desc: "光の鎖が敵陣を縛り、特技を封じる" },
    TEMPLAR_MONBANNOKAMAE: { name: "門番の構え", mp: 6, kind: "buff", stance: "counter", grantBarrier: 1, dur: 2, tech: true, target: "self", desc: "門を背に構え、反撃の構えと魔障壁を得る" },
    TEMPLAR_HAMANOOOZUCHI: { name: "破魔の大槌", mp: 18, kind: "phys", power: 3.0, vitScale: 1.4, acc: 1, vuln: { all: 0.85 }, target: "enemy", desc: "必中の大槌で、あらゆる属性への守りを崩す" },
    TEMPLAR_SEIIKIKEKKAI: { name: "聖域結界", mp: 15, kind: "heal", healMul: 1, healCap: 0.5, grantBarrier: 1, target: "all-ally", desc: "聖域を張って味方全員を癒し、魔障壁を配る" },
    TEMPLAR_DANZAINOFUUIN: { name: "断罪の封印", mp: 23, kind: "atk", power: 56, element: "light", seal: { chance: 0.5, turns: 3 }, strip: true, target: "enemy", desc: "断罪の光で撃ち、特技と強化を封じ去る" },
    TEMPLAR_OOTOBIRA: { name: "聖堂の大扉", mp: 20, kind: "buff", buff: { vit: 1.55 }, cure: true, target: "all-ally", desc: "大扉を閉ざして味方全体を守り、異常を祓う" },
    TEMPLAR_SEIKANOHARAI: { name: "聖火の祓い", mp: 32, kind: "heal", healMul: 2.1, cure: true, purge: true, debuffAll: { atk: 0.9 }, target: "all-ally", desc: "聖火で味方を癒し祓い、敵の力を灼き削ぐ" },
    TEMPLAR_SANJUUKEKKAI: { name: "三重結界", mp: 24, kind: "buff", grantBarrier: 2, target: "all-ally", desc: "味方全体に魔障壁を2回分重ねて張る" },
    TEMPLAR_FUUMANOOOGANE: { name: "封魔の大鐘", mp: 30, kind: "debuff", seal: { chance: 0.5, turns: 3 }, strip: true, debuff: { atk: 0.85 }, target: "all-enemy", desc: "大鐘の音が敵陣の特技と強化を封じ、力を削ぐ" },
    TEMPLAR_KOUSANAGI: { name: "光鎖なぎ", mp: 28, kind: "phys", power: 2.0, vitScale: 0.3, element: "light", acc: 0.6, flinchChance: 0.2, target: "all-enemy", desc: "光の鎖で敵陣をなぎ、怯ませる" },
    TEMPLAR_SHUMONNOJIN: { name: "守門の陣", mp: 26, kind: "buff", shield: true, buff: { vit: 1.3 }, grantBarrier: 2, tech: true, target: "self", desc: "門となって仲間を庇い、魔障壁を重ねる" },
    TEMPLAR_SEIDOUKISHI: { name: "聖堂騎士の誓詞", mp: 30, kind: "buff", buff: { vit: 1.35, atk: 1.2 }, cure: true, target: "all-ally", desc: "誓詞が味方全体の攻守を高め、異常を祓う" },
    TEMPLAR_SHINDENNOSHINPAN: { name: "神殿の審判", mp: 32, kind: "atk", power: 62, element: "light", seal: { chance: 0.35, turns: 2 }, prey: { races: UNHOLY, mul: 1.3 }, target: "all-enemy", desc: "審判の光が敵全体を灼き、特技を封じる" },
    TEMPLAR_SAIRINNOSEIMON: { name: "再臨の聖門", mp: 75, kind: "heal", healMul: 2.5, revive: true, revivePct: 0.5, grantBarrier: 1, purge: true, target: "all-ally", desc: "聖門が倒れた者を呼び戻し、全員に魔障壁を張る" },
    TEMPLAR_ZETTAIKEKKAI: { name: "絶対結界", mp: 40, kind: "buff", grantBarrier: 3, buff: { vit: 1.4 }, purge: true, target: "all-ally", desc: "味方全体に魔障壁3回分と守りを授け、弱体を解く" },
  },
  perks: {
    // Lv15 の目玉パッシブ: 傷ひとつない門番は、神聖な防壁に守られる
    templarShinsei: {
      label: "神聖防壁",
      lv: ["HPが満タンの時、受けるダメージ-30%", "HPが満タンの時、受けるダメージ-50%", "HPが満タンの時、受けるダメージ-70%"],
      fx: [{ t: "take", when: { selfHigh: 1 }, v: [0.30, 0.50, 0.70] }],
    },
    templarMonshu: {
      label: "門守の誓約",
      lv: ["戦闘開始時、敵を自分に引き付ける (3ターン)。引き付けている間、受けるダメージ-20%・主・強敵への味方全員の与ダメージ+10% (盾役どうしでは一番強いものだけ)",
        "さらに物理を受けると25%でMPを最大の4%回復。引き付けている間、受けるダメージ-28%・主・強敵への味方全員の与ダメージ+14% (盾役どうしでは一番強いものだけ)",
        "さらに物理を受けると40%でMPを最大の6%回復。引き付けている間、受けるダメージ-36%・主・強敵への味方全員の与ダメージ+18% (盾役どうしでは一番強いものだけ)"],
      fx: [{ t: "start", taunt: true, dur: 3 }, { t: "hurt", chance: [0, 0.25, 0.4], mp: [0, 0.04, 0.06] },
        { t: "take", when: { taunting: true }, v: [0.20, 0.28, 0.36] },
        { t: "deal", aura: true, best: true, holder: { taunting: true }, when: { strong: true }, v: [0.10, 0.14, 0.18] }],
    },
    templarKairitsu: {
      label: "戒律の灯",
      lv: ["戦闘に勝つとMPを最大の1%回復。治療の技の後30%で消費MPが戻る", "戦闘に勝つとMPを最大の2%回復。治療の技の後40%で消費MPが戻る", "戦闘に勝つとMPを最大の2%回復。治療の技の後50%で消費MPが戻る"],
      fx: [{ t: "win", mp: [0.01, 0.02, 0.02] }, { t: "cast", on: "cure", chance: [0.3, 0.4, 0.5], refund: true }],
    },
    templarFuumakusabi: {
      label: "封魔のくさび",
      lv: ["物理が当たると8%で敵の特技を封じる (2ターン)", "物理が当たると12%で敵の特技を封じる (2ターン)", "物理が当たると16%で敵の特技を封じる (2ターン)", "物理が当たると20%で敵の特技を封じる (2ターン)"],
      fx: [{ t: "hit", chance: [0.08, 0.12, 0.16, 0.20], ail: "seal", turns: 2 }],
    },
    templarMonkekkai: {
      label: "門番の結界",
      lv: ["戦闘開始時、30%で味方全員に魔障壁1回", "戦闘開始時、50%で味方全員に魔障壁1回", "戦闘開始時、70%で味方全員に魔障壁1回", "戦闘開始時、必ず味方全員に魔障壁1回"],
      fx: [{ t: "start", party: true, chance: [0.3, 0.5, 0.7, 1], barrier: 1 }],
    },
    templarMayoke: {
      label: "魔除けの門",
      lv: ["味方全員のブレス・全体呪文の被ダメージ-8% (主・強敵のものは-18%。盾役どうしでは一番強いものだけ)", "味方全員のブレス・全体呪文の被ダメージ-14% (主・強敵のものは-28%。盾役どうしでは一番強いものだけ)"],
      fx: [{ t: "take", aura: true, best: true, on: "breath", v: [0.08, 0.14] },
        { t: "take", aura: true, best: true, on: "spell", v: [0.08, 0.14] },
        { t: "take", aura: true, best: true, when: { strong: true }, on: "breath", v: [0.18, 0.28] },
        { t: "take", aura: true, best: true, when: { strong: true }, on: "spell", v: [0.18, 0.28] }],
    },
  },
};
