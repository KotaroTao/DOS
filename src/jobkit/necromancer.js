// 死霊術師 (necromancer) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
// 持ち味: 死者の力を借り、命と魂を吸い、即死で刈り取る (闇)。死に近い者ほど深く刺さる
const LIVING = ["humanoid", "giant", "beast", "avian"];
export default {
  // ランクのパッシブ: 魂がランク2で目覚め、3・4・5で強まる (souls.js の JOB_PASSIVES)
  awaken: "necroSenkoku",
  table: `
    1 NECROMANCER_MOUJANOTE 2 SHADOWBOLT 3 NECROMANCER_SHISOU 5 necromancerShikuirai/1 7 NECROMANCER_KOMORIUTA 10 NECROMANCER_SEIKISUI
    15 NECROMANCER_SHIREIMANEKI 15 necroLegion/1 20 KUGUTSU 22 NECROMANCER_ONRYOU 25 necromancerShishaSasayaki/1 30 NECROMANCER_HAKAMORI 32 DARKBLAST
    35 necromancerShinigamiMe/1 40 MEIKONGURAI 45 necromancerShikabaneKate/1 50 NECROMANCER_SHIMEI 50 necroLegion/2 55 NECROMANCER_SHIDOKU 60 necromancerShikuirai/2
    65 REVIVE 70 necromancerShinigamiMe/2 72 NECROMANCER_KOUSHIN 75 necromancerShishaSasayaki/2 80 NECROMANCER_KONBAKU 85 NECROMANCER_INOCHISOGI
    90 necromancerMeifuIzumi/1 95 NECROMANCER_SEIJANETAMI 100 NECROMANCER_KUSARESHOUKI 100 necroLegion/3 105 resistAilment/1 110 MADALT 115 necromancerShikabaneKate/2
    117 NECROMANCER_DOUKOKU 120 NECROMANCER_MANEKI 125 necromancerShinigamiMe/3 130 NECROMANCER_BOSHOHOURAKU 135 necromancerShikuirai/3 140 NECROMANCER_JUUATSU
    145 necromancerShishaSasayaki/3 150 NECROMANCER_KASOU 155 necromancerShinigamiMe/4 160 RESURRECT 165 resistAilment/2 170 NECROMANCER_YOMIGAERI
    172 NECROMANCER_TAMAGARI 175 necromancerMeifuIzumi/2 180 MEIFUNOMON 185 necromancerShikabaneKate/3 190 NECROMANCER_SANZU 195 NECROMANCER_MEIGA
    200 NECROMANCER_SOUSOU`,
  skills: {
    // Lv15 の固有技: 死霊を招いて撃ち、まれに魂を刈る
    NECROMANCER_SHIREIMANEKI: { name: "死霊招き", mp: 5, kind: "atk", power: 16, element: "dark", instakill: { chance: 0.08 }, target: "enemy", desc: "死霊を招いて撃つ。まれに魂を刈り取る（即死・主には効かない）" },
    // 死霊術師は PIE が低く癒しの祈りに向かない: 傷は敵から吸って塞ぐ
    NECROMANCER_SEIKISUI: { name: "生気吸い", mp: 3, kind: "atk", power: 12, element: "dark", drain: 0.5, target: "enemy", desc: "闇で敵の生気を吸い、己の傷を塞ぐ" },
    NECROMANCER_MOUJANOTE: { name: "亡者の手", mp: 3, kind: "debuff", debuff: { agi: 0.8, hit: 0.85 }, target: "enemy", desc: "地から亡者の手が伸び、足と狙いを鈍らせる" },
    NECROMANCER_SHISOU: { name: "死相の刻印", mp: 5, kind: "debuff", debuff: { vit: 0.75 }, vuln: { dark: 0.8 }, target: "enemy", desc: "死相を刻み、守りと闇への耐性を削ぐ" },
    NECROMANCER_KOMORIUTA: { name: "死者の子守唄", mp: 4, kind: "debuff", sleepChance: 0.5, debuff: { agi: 0.9 }, target: "all-enemy", desc: "死者の唄で敵全体を眠りに誘い、鈍らせる" },
    NECROMANCER_ONRYOU: { name: "怨霊の群れ", mp: 6, kind: "atk", power: 16, element: "dark", drain: 0.15, target: "all-enemy", desc: "怨霊が敵全体に群がり、命を吸い上げる" },
    NECROMANCER_HAKAMORI: { name: "墓守の鎖", mp: 8, kind: "debuff", debuff: { agi: 0.75, atk: 0.9 }, target: "all-enemy", desc: "墓守の鎖で敵全体を縛り、速さと力を奪う" },
    NECROMANCER_SHIMEI: { name: "死神の指名", mp: 10, kind: "debuff", instakill: { chance: 0.3 }, debuff: { vit: 0.8 }, target: "enemy", desc: "死神が名を呼び即死させる。逃れても守りが落ちる" },
    NECROMANCER_SHIDOKU: { name: "屍毒の接吻", mp: 8, kind: "debuff", poison: { chance: 0.85, pct: 0.1 }, debuff: { atk: 0.9 }, target: "enemy", desc: "屍の毒で猛毒にし、力を萎えさせる" },
    NECROMANCER_KOUSHIN: { name: "死霊の行進", mp: 12, kind: "atk", power: 32, element: "dark", flinchChance: 0.25, target: "all-enemy", desc: "死霊の群れが敵全体を踏みしだき、怯ませる" },
    NECROMANCER_KONBAKU: { name: "魂縛りの陣", mp: 10, kind: "debuff", seal: { chance: 0.5, turns: 3 }, strip: true, target: "all-enemy", desc: "魂を縛り、敵全体の特技と強化を奪う" },
    NECROMANCER_INOCHISOGI: { name: "命削ぎ", mp: 7, kind: "atk", gravity: 0.22, drain: 0.3, target: "enemy", desc: "今の命の22%を削ぎ取り、己に移す（主には弱い）" },
    NECROMANCER_SEIJANETAMI: { name: "生者への妬み", mp: 30, kind: "atk", power: 86, element: "dark", prey: { races: LIVING, mul: 1.3 }, target: "enemy", desc: "生ある者を妬む闇。亜人・巨人・獣・鳥人に強い" },
    NECROMANCER_KUSARESHOUKI: { name: "腐れ瘴気", mp: 10, kind: "atk", power: 12, poison: { chance: 0.6, pct: 0.05 }, debuff: { vit: 0.85 }, target: "all-enemy", desc: "腐臭の瘴気で敵全体を毒し、守りを腐らせる" },
    NECROMANCER_DOUKOKU: { name: "亡者の慟哭", mp: 21, kind: "atk", power: 60, element: "dark", confuse: 0.3, target: "enemy", desc: "亡者の慟哭で魂を裂き、正気を奪う（混乱）" },
    NECROMANCER_MANEKI: { name: "冥府の招き", mp: 24, kind: "debuff", instakill: { chance: 0.2 }, poison: { chance: 0.4, pct: 0.05 }, target: "all-enemy", desc: "敵全体を冥府に招く。拒んだ者は毒に蝕まれる" },
    NECROMANCER_BOSHOHOURAKU: { name: "墓所崩落", mp: 26, kind: "atk", power: 72, element: "earth", debuff: { agi: 0.85 }, target: "all-enemy", desc: "墓所を崩し、敵全体を瓦礫と骨に埋める" },
    NECROMANCER_JUUATSU: { name: "冥府の重圧", mp: 18, kind: "atk", gravity: 0.27, mpDrain: 0.1, target: "all-enemy", desc: "敵全体の今の命を27%削り、魔力を啜る（主には弱い）" },
    NECROMANCER_KASOU: { name: "火葬の炎", mp: 30, kind: "atk", power: 80, element: "fire", drain: 0.1, target: "all-enemy", desc: "火葬の炎で敵全体を焼き、燃える魂を吸う" },
    NECROMANCER_YOMIGAERI: { name: "黄泉返りの軍勢", mp: 36, kind: "atk", power: 98, debuff: { atk: 0.85 }, target: "all-enemy", desc: "黄泉の軍勢が敵全体を襲い、力を削ぐ" },
    NECROMANCER_TAMAGARI: { name: "魂狩りの鎌", mp: 28, kind: "atk", power: 72, element: "dark", mpDrain: 0.08, target: "all-enemy", desc: "見えざる鎌で敵全体の魂を刈り、魔力を奪う" },
    NECROMANCER_SANZU: { name: "三途の濁流", mp: 26, kind: "atk", power: 80, element: "water", drain: 0.3, target: "enemy", desc: "三途の濁流に沈め、命を引き上げる" },
    NECROMANCER_MEIGA: { name: "冥河の氾濫", mp: 20, kind: "atk", power: 50, element: "water", debuff: { hit: 0.85 }, target: "all-enemy", desc: "冥河の水が敵全体を呑み、目を曇らせる" },
    NECROMANCER_SOUSOU: { name: "終焉の葬送", mp: 44, kind: "atk", power: 124, element: "dark", instakill: { chance: 0.15 }, target: "all-enemy", desc: "万物を葬る闇。即死させることがある" },
  },
  perks: {
    necromancerShikuirai: { label: "屍喰らい", lv: ["敵を倒すとHP4%・MP4%回復", "敵を倒すとHP6%・MP6%回復", "敵を倒すとHP8%・MP8%回復"],
      fx: [{ t: "kill", hp: [0.04, 0.06, 0.08], mp: [0.04, 0.06, 0.08] }] },
    necromancerMeifuIzumi: { label: "冥府の泉", lv: ["2ラウンド目から毎ラウンド最大MPの2%回復", "毎ラウンド最大MPの3%回復", "毎ラウンド最大MPの4%回復"],
      fx: [{ t: "round", mp: [0.02, 0.03, 0.04] }] },
    necromancerShishaSasayaki: { label: "死者の囁き", lv: ["攻撃呪文の後15%で消費MPが戻る", "攻撃呪文の後22%で消費MPが戻る", "攻撃呪文の後30%で消費MPが戻る"],
      fx: [{ t: "cast", on: "atk", chance: [0.15, 0.22, 0.3], refund: true }] },
    necromancerShinigamiMe: { label: "死神の眼", lv: ["HP50%以下の敵への与ダメ+10%", "HP50%以下の敵への与ダメ+16%", "HP50%以下の敵への与ダメ+22%", "HP50%以下の敵への与ダメ+28%"],
      fx: [{ t: "deal", v: [0.1, 0.16, 0.22, 0.28], when: { tgtLow: 0.5 } }] },
    necromancerShikabaneKate: { label: "屍の糧", lv: ["味方が倒れるとINT×1.2 (3ターン)・HP10%回復", "味方が倒れるとINT×1.3・HP15%回復", "味方が倒れるとINT×1.4・HP20%回復"],
      fx: [{ t: "fall", buff: { int: [1.2, 1.3, 1.4] }, dur: 3, hp: [0.1, 0.15, 0.2] }] },
  },
};
