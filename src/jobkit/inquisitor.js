// 審問官 (inquisitor) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
// 持ち味: 断罪の鉄槌と浄火。罪を封じ、弱った罪人の急所を打ち据える (火/光)
export default {
  // 覚醒のパッシブ: 魂がランク2に上がると目覚める (以前の Lv15 のパッシブ)
  awaken: "inquisitorShinmonNirami/1",
  table: `
    1 SHIELDBASH 2 KAENGIRI 3 DIOS 5 inquisitorKokkaiTomoshibi/1 7 NERAIUCHI 10 SHINMON
    12 INQUISITOR_SHOKUZAI 15 INQUISITOR_DANZAI 20 INQUISITOR_KASEUCHI 22 KAENNAGI 25 resistAilment/1 30 KAKEI
    32 INQUISITOR_HAMON 35 inquisitorShinmonNirami/2 40 DANZAINOTSUCHI 45 inquisitorIhanShirushi/1 50 INQUISITOR_YAKIIN 55 DIOSALL
    57 GURENZAN 60 inquisitorKokkaiTomoshibi/2 65 SHINGANGEKI 70 inquisitorZaininKyuusho/1 75 inquisitorIhanShirushi/2 80 INQUISITOR_IHANHAGI
    85 INQUISITOR_MANAZASHI 90 inquisitorShinmonNirami/3 95 INQUISITOR_SABAKIYARI 100 INQUISITOR_GOUMON 105 resistAilment/2 107 INQUISITOR_JOUKATSUCHI
    110 INQUISITOR_FUNKEI 115 inquisitorJoukaKokoroe/1 120 INQUISITOR_SHINPAN 125 inquisitorZaininKyuusho/2 130 INQUISITOR_KOKKAI 135 inquisitorIhanShirushi/3
    140 INQUISITOR_MAJOGARI 145 inquisitorJoukaKokoroe/2 150 INQUISITOR_HAKAI 155 inquisitorZaininKyuusho/3 160 INQUISITOR_ZAININRETSU 162 INQUISITOR_KAKEIBA
    165 inquisitorShinmonNirami/4 170 INQUISITOR_DANTOU 175 inquisitorJoukaKokoroe/3 180 INQUISITOR_JOUZAI 185 inquisitorKokkaiTomoshibi/3 190 SAIGONOSHINPAN
    195 INQUISITOR_YURUSHI 200 INQUISITOR_SHAMEN`,
  skills: {
    // Lv15 (覚醒のパッシブが抜けた段): 罪人を鉄槌で打つ。弱った者に重く、特技を封じる
    INQUISITOR_DANZAI: { name: "罪人打ち", mp: 5, kind: "phys", power: 1.3, acc: 0.5, execute: 1.6, seal: { chance: 0.3, turns: 2 }, target: "enemy", desc: "罪人を鉄槌で打ち据える。弱った敵に重く、特技を封じる" },
    // 信仰の火 (faith)。共通の炎の呪文は INT 依存で審問官 (PIE型) に合わないので置き換える
    INQUISITOR_SHOKUZAI: { name: "贖罪の火矢", mp: 2, kind: "atk", power: 10, element: "fire", faith: true, target: "enemy", desc: "罪を贖わせる火の矢（PIEでも伸びる）" },
    INQUISITOR_HAMON:    { name: "破門の炎", mp: 6, kind: "atk", power: 22, element: "fire", faith: true, target: "all-enemy", desc: "破門を告げる炎が敵全体を焼く（PIEでも伸びる）" },
    INQUISITOR_KASEUCHI: { name: "枷打ち", mp: 4, kind: "phys", power: 1.0, acc: 0.6, debuff: { agi: 0.8 }, target: "enemy", desc: "罪人の足に枷を打ち、素早さを奪う" },
    INQUISITOR_YAKIIN: { name: "罪の焼き印", mp: 8, kind: "phys", power: 1.5, element: "fire", acc: 0.6, seal: { chance: 0.4, turns: 2 }, target: "enemy", desc: "罪の焼き印を押し、特技を封じる" },
    INQUISITOR_IHANHAGI: { name: "異端剥ぎの光", mp: 9, kind: "atk", power: 21, element: "light", strip: true, vuln: { light: 0.9 }, target: "all-enemy", desc: "敵全体の加護を剥ぎ、光に晒す" },
    INQUISITOR_MANAZASHI: { name: "審問の眼差し", mp: 7, kind: "debuff", debuff: { atk: 0.85, agi: 0.9 }, target: "all-enemy", tech: true, desc: "冷たい眼差しで敵全体を竦ませ、力と速さを削ぐ" },
    INQUISITOR_SABAKIYARI: { name: "裁きの光槍", mp: 22, kind: "atk", power: 64, element: "light", debuff: { vit: 0.85 }, target: "enemy", desc: "罪を穿つ光の槍。守りを剥ぐ" },
    INQUISITOR_GOUMON: { name: "拷問の鉄鎚", mp: 16, kind: "phys", power: 3.4, acc: 0.8, pierce: 0.4, para: 0.25, target: "enemy", desc: "骨を砕く鉄鎚。鎧を通し、痺れさせる" },
    INQUISITOR_JOUKATSUCHI: { name: "浄火の大槌", mp: 20, kind: "phys", power: 5.2, element: "fire", acc: 0.7, vuln: { fire: 0.8 }, target: "enemy", desc: "浄火の槌で打ち据え、火に脆くする" },
    INQUISITOR_FUNKEI: { name: "焚刑", mp: 11, kind: "atk", power: 34, element: "fire", poison: { chance: 0.5, pct: 0.05 }, faith: true, target: "enemy", desc: "罪人を焼き、火傷 (毒) を負わせる（PIEでも伸びる）" },
    INQUISITOR_SHINPAN: { name: "審判の一撃", mp: 24, kind: "phys", power: 5.4, element: "light", acc: 1, seal: { chance: 0.4, turns: 3 }, target: "enemy", desc: "必中の審判。特技を封じる" },
    INQUISITOR_KOKKAI: { name: "告解の聖光", mp: 28, kind: "atk", power: 82, element: "light", partyHeal: 16, target: "enemy", desc: "罪を焼く聖光を放ち、その余光で味方を癒す" },
    INQUISITOR_MAJOGARI: { name: "魔女狩りの業火", mp: 20, kind: "atk", power: 58, element: "fire", prey: { races: ["humanoid", "demon"], mul: 1.3 }, faith: true, target: "enemy", desc: "異端を焼く業火。亜人と悪魔に強い（PIEでも伸びる）" },
    INQUISITOR_HAKAI: { name: "破戒の鉄槌", mp: 28, kind: "phys", power: 7.0, element: "light", acc: 1, pierce: 0.3, strip: true, target: "enemy", desc: "必中の鉄槌で強化を打ち砕く" },
    INQUISITOR_ZAININRETSU: { name: "断罪の光雨", mp: 30, kind: "atk", power: 68, element: "light", debuff: { atk: 0.9, agi: 0.9 }, target: "all-enemy", desc: "光の雨で敵全体を裁き、力と速さを削ぐ" },
    INQUISITOR_KAKEIBA: { name: "火刑場の薙ぎ", mp: 28, kind: "phys", power: 2.4, element: "fire", acc: 0.7, vuln: { fire: 0.9 }, target: "all-enemy", desc: "火刑場の炎で敵全体を薙ぎ、火に脆くする" },
    INQUISITOR_DANTOU: { name: "断頭の宣告", mp: 32, kind: "phys", power: 8.0, element: "light", acc: 1, execute: 1.8, target: "enemy", desc: "必中の断頭。弱った罪人には更に重い" },
    INQUISITOR_JOUZAI: { name: "浄罪の業火", mp: 30, kind: "atk", power: 82, element: "fire", seal: { chance: 0.3, turns: 2 }, faith: true, target: "all-enemy", desc: "業火で敵全体を焼き清め、特技を封じる（PIEでも伸びる）" },
    INQUISITOR_YURUSHI: { name: "赦しの秘蹟", mp: 36, kind: "heal", power: 70, cure: true, purge: true, grantBarrier: 1, target: "all-ally", desc: "全員を癒して穢れを祓い、魔障壁を授ける" },
    INQUISITOR_SHAMEN: { name: "終の赦免", mp: 44, kind: "heal", power: 999, revive: true, revivePct: 0.7, cure: true, purge: true, grantBarrier: 1, target: "all-ally", desc: "倒れた者を赦し蘇らせ (HP70%)、全員を守る" },
  },
  perks: {
    inquisitorKokkaiTomoshibi: { label: "告解の灯", lv: ["戦闘勝利後、味方全員のHP3%回復", "戦闘勝利後、味方全員のHP5%回復", "戦闘勝利後、味方全員のHP7%回復"],
      fx: [{ t: "win", hp: [0.03, 0.05, 0.07], party: true }] },
    inquisitorShinmonNirami: { label: "審問官の睨み", lv: ["戦闘開始時、敵を引き付け敵全体のATK−7% (3ターン)", "開幕に引き付け、敵全体のATK−10%", "開幕に引き付け、敵全体のATK−13%", "開幕に引き付け、敵全体のATK−16%"],
      fx: [{ t: "start", taunt: true, foe: { atk: [0.93, 0.9, 0.87, 0.84] }, dur: 3 }] },
    inquisitorIhanShirushi: { label: "異端審問の印", lv: ["物理を当てると12%で特技を封じる (2ターン)", "物理を当てると18%で特技を封じる", "物理を当てると24%で特技を封じる"],
      fx: [{ t: "hit", chance: [0.12, 0.18, 0.24], ail: "seal", turns: 2 }] },
    inquisitorZaininKyuusho: { label: "罪人の急所", lv: ["弱体中の敵への物理の会心+6%", "弱体中の敵への物理の会心+10%", "弱体中の敵への物理の会心+14%"],
      fx: [{ t: "crit", v: [0.06, 0.1, 0.14], when: { tgtDebuffed: true } }] },
    inquisitorJoukaKokoroe: { label: "浄火の心得", lv: ["火属性の攻撃の与ダメ+8%", "火属性の攻撃の与ダメ+14%", "火属性の攻撃の与ダメ+20%"],
      fx: [{ t: "deal", v: [0.08, 0.14, 0.2], when: { elem: "fire" } }] },
  },
};
