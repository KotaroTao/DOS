// 灯守 (sera) の技・パッシブ。人業セラだけの専用職 (souls.js SOUL_CLASSES.sera、レア度 unique)。
// ほかの人業には宿せず、サブ魂としても貸さない。ランクは物語の節目で上がる (game.js seraRankTarget)。
// 持ち味: 師を庇って裂かれた人業の、仲間を守る灯 — 庇い立て・挑発・魔障壁・不屈で隊を守り、光と水の刃で打つ。
// 胸の魂火 (ランクのパッシブ) は戦いの初めに隊を障壁で包み、灯の加護 (Lv15) は生きている間ずっと隊の傷を浅くする
import { UNHOLY } from "./common.js";

export default {
  // ランクのパッシブ: 魂がランク2で目覚め、3・4・5で強まる (souls.js の JOB_PASSIVES)
  awaken: "seraMunebi",
  table: `
    1 SHIELDBASH 2 SERA_TOMOSHIBIUCHI 3 DIOS 5 seraIchido/1 7 SERA_KABAIDACHI 10 CURE 12 SERA_MIZUKAGAMI
    15 SERA_TOUROUOTOSHI 15 seraKago/1 17 SERA_YOTOMOSHI 20 CHOUHATSU 20 RECOVER 22 SERA_SAZANAMI
    25 DIOSALL 25 seraKotae/1 30 NIOUDACHI 35 DIAL 35 seraNegai/1 40 SERA_AKARINOTATE 45 seraIchido/2
    50 SERA_MUNEBIUCHI 50 seraKago/2 55 SERA_TOMOSHIBINOTOBARI 57 SERA_NAGAREBI 60 seraMichibiki/1
    60 SERA_TSUGIMENOTEATE 65 SERA_MIGAWARIBI 70 seraKotae/2 75 seraNegai/2 80 SERA_TOUROUNOJIN
    85 SERA_KAMINAMI 90 resistAilment/1 95 SERA_SEITOUGEKI 100 SERA_TAMASHIIMORI 100 seraKago/3
    105 seraIchido/3 107 SERA_ARASHIBI 110 SERA_SHIZUKUNOIYASHI 115 seraMichibiki/2 120 SERA_HIKARIGAESHI
    125 seraKotae/3 130 SERA_UNABARANOTATE 135 resistAilment/2 140 SERA_TOUKOURENGEKI 145 seraNegai/3
    150 SERA_MAMORIBINOJIN 155 seraMichibiki/3 160 SERA_SHINKAIOTOSHI 162 SERA_SEIRYUUZAN 170 SERA_TOMOSHIBINOTSUBASA
    175 seraTerasu/1 180 SERA_HOSHIZUKIYO 185 seraTerasu/2 190 SERA_KIENUHI 195 SERA_DAIKAISHOU
    200 SERA_SHINOTOMOSHIBI`,
  skills: {
    SERA_TOMOSHIBIUCHI: { name: "灯打ち", mp: 2, kind: "phys", power: 1.0, element: "light", target: "enemy", desc: "胸の灯を刃に移して打つ" },
    SERA_KABAIDACHI: { name: "庇い立ち", mp: 5, kind: "buff", shield: true, buff: { vit: 1.2 }, dur: 2, tech: true, target: "self", desc: "味方の前に立ち、単体攻撃を代わりに受ける" },
    SERA_MIZUKAGAMI: { name: "水鏡打ち", mp: 4, kind: "phys", power: 1.2, element: "water", debuff: { atk: 0.9 }, target: "enemy", desc: "水鏡のように受け流して打ち、敵の力を鈍らせる" },
    // Lv15 の固有技: 灯籠を落とすように盾を振り下ろし、盾の重み (VIT) で打つ
    SERA_TOUROUOTOSHI: { name: "灯籠落とし", mp: 5, kind: "phys", power: 1.0, vitScale: 0.8, element: "light", acc: 0.7, flinchChance: 0.3, target: "enemy", desc: "盾を灯籠のように振り下ろし、怯ませる（VITで伸びる）" },
    SERA_YOTOMOSHI: { name: "夜灯斬り", mp: 6, kind: "phys", power: 1.4, element: "light", acc: 0.8, drain: 0.2, target: "enemy", desc: "夜道を照らす灯のように斬り込み、与えた傷の一部で自分を癒す" },
    SERA_SAZANAMI: { name: "さざ波の盾", mp: 9, kind: "phys", power: 0.8, element: "water", debuff: { agi: 0.9 }, target: "all-enemy", desc: "盾で水面を払い、敵全体の足を鈍らせる" },
    // Lv40 の看板技: 灯の大盾で隊を包み、魔障壁を張る
    SERA_AKARINOTATE: { name: "灯の大盾", mp: 12, kind: "buff", buff: { vit: 1.2 }, grantBarrier: 1, dur: 3, tech: true, target: "all-ally", desc: "灯の大盾で隊を包み、守りを上げて魔障壁を張る" },
    SERA_MUNEBIUCHI: { name: "胸火の一撃", mp: 12, kind: "phys", power: 1.8, vitScale: 0.6, desperate: true, element: "light", acc: 0.8, target: "enemy", desc: "傷つくほど強く燃える胸の灯で打つ" },
    SERA_TOMOSHIBINOTOBARI: { name: "灯の帳", mp: 14, kind: "buff", ward: { breath: 0.35, spell: 0.35 }, dur: 3, tech: true, target: "all-ally", desc: "灯の帳で隊を包み、ブレスと全体呪文を和らげる" },
    SERA_NAGAREBI: { name: "流れ灯", mp: 12, kind: "phys", power: 0.95, hits: 2, element: "water", acc: 0.8, target: "enemy", desc: "灯籠流しのように、刃を二度流す" },
    // 回復は標準の物差し (ヒールの1.5倍・治療つき)
    SERA_TSUGIMENOTEATE: { name: "継ぎ目の手当て", mp: 5, kind: "heal", healMul: 1.5, cure: ["poison", "paralyze"], target: "ally", desc: "器の継ぎ目を締め直すように傷を癒し、毒と麻痺を治す" },
    SERA_MIGAWARIBI: { name: "身代わりの灯", mp: 14, kind: "buff", shield: true, stance: "counter", buff: { vit: 1.3 }, dur: 2, tech: true, target: "self", desc: "味方を庇い、受けた物理に必ず反撃する" },
    SERA_TOUROUNOJIN: { name: "灯籠の陣", mp: 18, kind: "buff", buff: { vit: 1.3 }, regen: { pct: 0.04, turns: 3 }, tech: true, target: "all-ally", desc: "灯籠を並べた陣で隊を守り、毎ターン癒す" },
    SERA_KAMINAMI: { name: "神波", mp: 22, kind: "phys", power: 1.3, element: "water", acc: 0.8, debuff: { agi: 0.85 }, target: "all-enemy", desc: "大水槽の水を呼び、敵全体を押し流す" },
    SERA_SEITOUGEKI: { name: "聖灯撃", mp: 18, kind: "phys", power: 2.4, vitScale: 0.8, element: "light", acc: 1, target: "enemy", desc: "灯を宿した必中の盾撃" },
    SERA_TAMASHIIMORI: { name: "魂守り", mp: 22, kind: "buff", buff: { vit: 1.2 }, grantEndure: true, dur: 3, tech: true, target: "all-ally", desc: "隊の魂を灯で結び、致死を一度だけ耐えさせる" },
    SERA_ARASHIBI: { name: "嵐灯", mp: 20, kind: "phys", power: 4.2, element: "light", acc: 0.7, flinchChance: 0.3, target: "enemy", desc: "嵐の夜の灯のように激しく打ち、怯ませる" },
    SERA_SHIZUKUNOIYASHI: { name: "雫の癒し", mp: 16, kind: "heal", healMul: 1.4, target: "all-ally", desc: "洗礼の水の雫で、隊の傷をまとめて癒す" },
    SERA_HIKARIGAESHI: { name: "光返し", mp: 20, kind: "buff", taunt: true, stance: "counter", ward: { spell: 0.3 }, buff: { vit: 1.3 }, dur: 2, tech: true, target: "self", desc: "敵を引き付け、物理に必ず反撃し、呪文を和らげる" },
    SERA_UNABARANOTATE: { name: "海原の盾", mp: 26, kind: "phys", power: 1.6, vitScale: 0.4, element: "water", acc: 0.8, debuff: { atk: 0.85 }, target: "all-enemy", desc: "海原のような大盾で敵陣を払い、力を削ぐ" },
    SERA_TOUKOURENGEKI: { name: "灯光連撃", mp: 25, kind: "phys", power: 2.0, hits: 3, element: "light", acc: 0.8, target: "enemy", desc: "灯の光を三度重ねて打つ" },
    SERA_MAMORIBINOJIN: { name: "守り火の陣", mp: 30, kind: "buff", buff: { vit: 1.3 }, grantBarrier: 2, dur: 4, tech: true, target: "all-ally", desc: "守り火で隊を包み、魔障壁を二重に張る（4ターン）" },
    SERA_SHINKAIOTOSHI: { name: "深海落とし", mp: 28, kind: "phys", power: 4.8, vitScale: 0.5, element: "water", acc: 0.8, debuff: { agi: 0.7 }, target: "enemy", desc: "深海の重みで押し潰し、足を奪う" },
    SERA_SEIRYUUZAN: { name: "聖流斬", mp: 30, kind: "phys", power: 1.8, element: "light", acc: 0.8, bladeHeal: 0.1, target: "all-enemy", desc: "光の流れで敵陣を斬り、与えた傷の一部で隊を癒す" },
    SERA_TOMOSHIBINOTSUBASA: { name: "灯の翼", mp: 30, kind: "buff", buff: { vit: 1.2 }, regen: { pct: 0.06, turns: 4 }, tech: true, target: "all-ally", desc: "灯の翼で隊を覆い、長く癒し続ける" },
    SERA_HOSHIZUKIYO: { name: "星月夜", mp: 30, kind: "phys", power: 5.8, element: "light", acc: 1, flinchChance: 0.3, target: "enemy", desc: "星と月の光を束ねた必中の一撃。怯ませる" },
    SERA_KIENUHI: { name: "消えぬ灯", mp: 30, kind: "buff", shield: true, taunt: true, grantEndure: true, regen: { pct: 0.05, turns: 3 }, buff: { vit: 1.4 }, dur: 3, tech: true, target: "self", desc: "敵を集めて庇い、致死を耐え、傷を癒し続ける" },
    SERA_DAIKAISHOU: { name: "大海嘯", mp: 32, kind: "phys", power: 2.2, vitScale: 0.5, element: "water", acc: 0.8, debuff: { agi: 0.85 }, target: "all-enemy", desc: "大海嘯で敵陣を呑み込む" },
    // Lv200: 師の灯 — 隊全体を癒し、障壁と守りで包む (標準の物差し: 全体回復ヒールの1.6倍 + 障壁・強化)
    SERA_SHINOTOMOSHIBI: { name: "師の灯", mp: 26, kind: "heal", healMul: 1.6, grantBarrier: 1, buff: { vit: 1.3 }, regen: { pct: 0.05, turns: 4 }, target: "all-ally", desc: "師の灯を掲げ、隊を癒して障壁と守りで包む" },
  },
  perks: {
    // ランクのパッシブ: 胸に移った師の魂火が、戦いの初めに隊を包む
    seraMunebi: {
      label: "胸の魂火",
      lv: ["戦闘開始時、味方全員に魔障壁 (1回)", "戦闘開始時、味方全員に魔障壁 (1回) とリジェネ (最大HPの2%)", "戦闘開始時、味方全員に魔障壁 (1回) とリジェネ (最大HPの3%)", "戦闘開始時、味方全員に魔障壁 (2回) とリジェネ (最大HPの4%)"],
      fx: [{ t: "start", party: true, barrier: [1, 1, 1, 2] }, { t: "start", chance: [0, 1, 1, 1], party: true, regen: [0, 0.02, 0.03, 0.04] }],
    },
    // Lv15 の目玉パッシブ: 生きている間、隊の傷をずっと浅くする
    seraKago: {
      label: "灯の加護",
      lv: ["自分が生きている間、味方全員の被ダメージ-6%", "自分が生きている間、味方全員の被ダメージ-9%", "自分が生きている間、味方全員の被ダメージ-12%"],
      fx: [{ t: "take", aura: true, v: [0.06, 0.09, 0.12] }],
    },
    seraIchido: {
      label: "一度で仕上げた器",
      lv: ["戦闘開始時50%で、致死を一度HP1で耐える", "戦闘開始時75%で、致死を一度HP1で耐える", "戦闘開始時、必ず致死を一度HP1で耐える"],
      fx: [{ t: "start", chance: [0.5, 0.75, 1], endure: true }],
    },
    seraKotae: {
      label: "灯は消えない",
      lv: ["物理を受けると30%でVIT×1.15 (2ターン)", "物理を受けると35%でVIT×1.2 (2ターン)", "物理を受けると40%でVIT×1.25 (2ターン)"],
      fx: [{ t: "hurt", chance: [0.3, 0.35, 0.4], buff: { vit: [1.15, 1.2, 1.25] }, dur: 2 }],
    },
    seraNegai: {
      label: "師への誓い",
      lv: ["味方が倒れると、STR・VIT×1.2 (3ターン)・HPを10%回復", "味方が倒れると、STR・VIT×1.25 (3ターン)・HPを15%回復", "味方が倒れると、STR・VIT×1.3 (3ターン)・HPを20%回復"],
      fx: [{ t: "fall", buff: { atk: [1.2, 1.25, 1.3], vit: [1.2, 1.25, 1.3] }, dur: 3, hp: [0.10, 0.15, 0.20] }],
    },
    seraMichibiki: {
      label: "灯のみちびき",
      lv: ["戦闘に勝つと、味方全員のHPを3%回復", "戦闘に勝つと、味方全員のHPを5%回復", "戦闘に勝つと、味方全員のHPを7%回復"],
      fx: [{ t: "win", party: true, hp: [0.03, 0.05, 0.07] }],
    },
    seraTerasu: {
      label: "闇を照らす灯",
      lv: ["自分が生きている間、味方全員の不死・幽鬼・悪魔への与ダメージ+10%", "自分が生きている間、味方全員の不死・幽鬼・悪魔への与ダメージ+15%"],
      fx: [{ t: "deal", aura: true, when: { race: UNHOLY }, v: [0.10, 0.15] }],
    },
  },
};
