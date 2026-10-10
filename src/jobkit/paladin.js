// 聖騎士 (paladin) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
// 持ち味: 聖なる剣と癒しの両立 — 斬れば光が隊を癒し、癒せば剣に力が宿る。勝利と討伐が次の癒しになる
import { UNHOLY } from "./common.js";

export default {
  // ランクのパッシブ: 魂がランク2で目覚め、3・4・5で強まる (souls.js の JOB_PASSIVES)
  awaken: "paladinIyashi",
  table: `
    1 SHIELDBASH 2 KOUJIN 3 DIOS 5 paladinGaisen/1 7 HAJA 10 NERAIUCHI 10 CURE 12 IWAKUDAKI
    15 PALADIN_INORINOKEN 15 cleanseStep/1 17 HOLYLIGHT 20 CHOUHATSU 20 RECOVER 22 KOURINZAN
    25 paladinNanori/1 30 SEINOTATE 30 DIOSALL 35 smite/1 40 SEIKOUZAN 40 DIAL 45 paladinKoukan/1
    50 SHINGANGEKI 50 cleanseStep/2 55 GUARDALL 57 PALADIN_JIKOUZAN 60 paladinGaisen/2 60 REVIVE
    65 PALADIN_KENNOSHUKUTOU 70 holyEdge/1 75 martyr/1 80 PALADIN_HIKARINOJOUHEKI 85 PALADIN_JOUKOURIN
    90 resistAilment/1 95 PALADIN_SEIYAKUNOGI 100 PALADIN_SABAKINOSEIKEN 100 cleanseStep/3
    105 paladinKoukan/2 107 TENKOUKEN 110 PALADIN_GOKOUNOJIN 115 paladinNanori/2 120 PALADIN_SHOKUZAI
    125 divineCounter/1 130 PALADIN_SEIGONOTOBARI 135 resistAilment/2 140 PALADIN_SEIHAI
    145 paladinFukutsu/1 150 PALADIN_GAIKA 155 paladinSeikenkago/1 160 PALADIN_TENJOUSOU 165 paladinNanori/3
    170 PALADIN_JUNKYOUNOTATE 175 paladinFukutsu/2 180 PALADIN_SEIKISHIDAN 185 paladinSeikenkago/2
    190 PALADIN_REIMEI 195 PALADIN_SEIKIGAN 200 PALADIN_SEIKENKOURIN`,
  skills: {
    // Lv15 の固有技: 祈りを込めた一太刀。返す光が隊を癒す
    PALADIN_INORINOKEN: { name: "祈りの剣", mp: 6, kind: "phys", power: 1.2, element: "light", bladeHeal: 0.15, healCap: 0.1, target: "enemy", desc: "祈りを込めて斬り、返す光で味方全員を癒す" },
    PALADIN_JIKOUZAN: { name: "慈光斬", mp: 12, kind: "phys", power: 2.0, pieScale: 0.5, element: "light", acc: 0.6, bladeHeal: 0.11, healCap: 0.12, target: "enemy", desc: "祈りを込めて斬り、光の余韻が隊を癒す" },
    PALADIN_KENNOSHUKUTOU: { name: "剣の祝祷", mp: 15, kind: "heal", healMul: 1, healCap: 0.5, buff: { atk: 1.1 }, target: "all-ally", desc: "剣を掲げて祈り、味方全員を癒し攻撃を少し上げる" },
    PALADIN_HIKARINOJOUHEKI: { name: "光の城壁", mp: 10, kind: "buff", buff: { vit: 1.3 }, cure: ["charm", "confuse"], target: "all-ally", desc: "味方全員を光の壁で守り、魅了・混乱を治す" },
    PALADIN_JOUKOURIN: { name: "浄めの光輪", mp: 10, kind: "atk", power: 21, element: "light", partyHeal: 6, target: "all-enemy", desc: "光輪が敵全体を灼き、返す光が隊を癒す" },
    PALADIN_SEIYAKUNOGI: { name: "聖約の儀", mp: 16, kind: "buff", buff: { atk: 1.2 }, cure: ["poison", "paralyze", "sleep"], purge: true, target: "all-ally", desc: "味方全員の毒・猛毒・麻痺・眠りと弱体を祓い、STRを上げる" },
    PALADIN_SABAKINOSEIKEN: { name: "審きの聖剣", mp: 18, kind: "phys", power: 3.0, pieScale: 1.2, pierce: 0.4, acc: 1, drain: 0.15, target: "enemy", desc: "PIEを乗せた必中の聖剣。鎧を穿ち命を吸う" },
    PALADIN_GOKOUNOJIN: { name: "後光の陣", mp: 15, kind: "heal", healMul: 1, healCap: 0.5, regen: { pct: 0.04, turns: 3 }, target: "all-ally", desc: "後光で味方全員を癒し、しばらく癒し続ける" },
    PALADIN_SHOKUZAI: { name: "贖罪の光", mp: 22, kind: "atk", power: 60, element: "light", debuff: { atk: 0.8 }, target: "enemy", desc: "罪を灼く聖光。敵の力を挫く" },
    PALADIN_SEIGONOTOBARI: { name: "聖護の帳", mp: 20, kind: "buff", buff: { vit: 1.5 }, regen: { pct: 0.03, turns: 3 }, target: "all-ally", desc: "聖なる帳で味方全体を厚く守り、癒しを宿す" },
    PALADIN_SEIHAI: { name: "聖杯の恵み", mp: 32, kind: "heal", healMul: 2.1, buff: { atk: 1.15 }, cure: true, target: "all-ally", desc: "味方全員を大きく癒し、異常を祓い力を与える" },
    PALADIN_GAIKA: { name: "凱歌の聖剣", mp: 30, kind: "phys", power: 1.8, pieScale: 0.5, element: "light", acc: 0.7, bladeHeal: 0.05, healCap: 0.15, target: "all-enemy", desc: "凱歌と共に敵陣を斬り、隊を大きく癒す" },
    PALADIN_TENJOUSOU: { name: "天上の聖槍", mp: 28, kind: "atk", power: 80, element: "light", vuln: { light: 0.8 }, target: "enemy", desc: "聖槍が貫き、光への守りを崩す" },
    PALADIN_JUNKYOUNOTATE: { name: "殉教の盾", mp: 26, kind: "buff", shield: true, buff: { vit: 1.4 }, regen: { pct: 0.06, turns: 3 }, tech: true, target: "self", desc: "身を盾に仲間を庇い、聖なる癒しを身に宿す" },
    PALADIN_SEIKISHIDAN: { name: "聖騎士団の誓い", mp: 32, kind: "buff", buff: { atk: 1.25, vit: 1.35 }, grantBarrier: 1, target: "all-ally", desc: "味方全体の攻守を高め、魔障壁を張る" },
    PALADIN_REIMEI: { name: "黎明の聖光", mp: 32, kind: "atk", power: 66, element: "light", prey: { races: UNHOLY, mul: 1.4 }, strip: true, target: "all-enemy", desc: "夜明けの光が不浄を灼き、強化を消し去る" },
    PALADIN_SEIKIGAN: { name: "聖騎士の祈願", mp: 90, kind: "heal", healMul: 2.5, revive: true, revivePct: 0.6, cure: true, purge: true, buff: { atk: 1.2 }, target: "all-ally", desc: "倒れた者を呼び戻し、全員を癒し奮い立たせる" },
    PALADIN_SEIKENKOURIN: { name: "聖剣降臨", mp: 40, kind: "phys", power: 6.0, pieScale: 1.5, element: "light", acc: 1, bladeHeal: 0.02, healCap: 0.25, target: "enemy", desc: "天を裂く必中の聖剣。光が隊を大きく癒す" },
  },
  perks: {
    paladinGaisen: {
      label: "凱旋の祝祷",
      lv: ["戦闘に勝つと味方全員のHPを最大の3%回復", "戦闘に勝つと味方全員のHPを最大の6%回復"],
      fx: [{ t: "win", party: true, hp: [0.03, 0.06] }],
    },
    paladinKoukan: {
      label: "慈しみの光環",
      lv: ["2ラウンド目から毎ラウンド、味方全員のHPを最大の1.5%回復", "2ラウンド目から毎ラウンド、味方全員のHPを最大の2.5%回復", "2ラウンド目から毎ラウンド、味方全員のHPを最大の3.5%回復"],
      fx: [{ t: "round", party: true, hp: [0.015, 0.025, 0.035] }],
    },
    paladinNanori: {
      label: "白銀の名乗り",
      lv: ["戦闘開始時、敵を引き付け、自分にリジェネ (最大HPの4%・3ターン)。引き付けている間、受けるダメージ-18%・主・強敵への味方全員の与ダメージ+8% (盾役どうしでは一番強いものだけ)",
        "戦闘開始時、敵を引き付け、自分にリジェネ (最大HPの5%・3ターン)。引き付けている間、受けるダメージ-24%・主・強敵への味方全員の与ダメージ+11% (盾役どうしでは一番強いものだけ)",
        "戦闘開始時、敵を引き付け、自分にリジェネ (最大HPの6%・3ターン)。引き付けている間、受けるダメージ-30%・主・強敵への味方全員の与ダメージ+14% (盾役どうしでは一番強いものだけ)"],
      fx: [{ t: "start", taunt: true, regen: [0.04, 0.05, 0.06], dur: 3 },
        { t: "take", when: { taunting: true }, v: [0.18, 0.24, 0.30] },
        { t: "deal", aura: true, best: true, holder: { taunting: true }, when: { strong: true }, v: [0.08, 0.11, 0.14] }],
    },
    paladinFukutsu: {
      label: "不屈の聖光",
      lv: ["自分のHPが35%以下なら、毎ラウンド最大HPの8%回復", "自分のHPが35%以下なら、毎ラウンド最大HPの12%回復"],
      fx: [{ t: "round", when: { selfLow: 0.35 }, hp: [0.08, 0.12] }],
    },
    paladinSeikenkago: {
      label: "聖剣の加護",
      lv: ["敵を倒すとHPを最大の6%・MPを1.5%回復", "敵を倒すとHPを最大の9%・MPを2%回復"],
      fx: [{ t: "kill", hp: [0.06, 0.09], mp: [0.015, 0.02] }],
    },
  },
};
