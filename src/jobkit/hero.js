// 勇者 (hero) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
// 持ち味: 仲間を鼓舞し何でもこなす希望の剣と雷の剣。強敵にこそ燃え、倒れた仲間の分まで立つ (風/光)
export default {
  // ランクのパッシブ: 魂がランク2で目覚め、3・4・5で強まる (souls.js の JOB_PASSIVES)
  awaken: "heroDensetsu",
  table: `
    1 KYOUGEKI 2 SHIPPUUGIRI 3 DIOS 5 heroKyoutekiFunki/1 7 YUUSHANOICHIGEKI 10 BLESS 10 CURE 12 KOUJIN
    15 HERO_CHIKAINOHATA 15 heroIji/1 20 KOBU 22 REPPUU 25 heroKibouHidamari/1 25 AWAKE 30 RAIKOUKEN
    30 DIOSALL 30 dynamicVision/1 35 heroYuushaSenaka/1 37 HERO_JINRAI 40 SEIKEN 40 DIAL 45 heroKyoutekiFunki/2 50 heroIji/2
    55 NIOUDACHI 57 FUUGA 60 heroOrenuKokoro/1 60 REVIVE 65 SEIGEKI 70 heroKyoutekiFunki/3
    75 heroKaisenGourei/1 80 HERO_YUUKITOMOSHIBI 80 dynamicVision/2 85 HERO_SAIKI 90 resistAilment/1 95 HERO_KIBOUSENKOU
    100 HERO_SHIPPUUTAIKEN 100 heroIji/3 105 heroYuushaSenaka/2 107 HERO_FUURAI 110 HERO_KIBOUSENPUU
    115 heroOrenuKokoro/2 120 HERO_KOUMYOU 125 heroKibouHidamari/2 130 HERO_GEKIREI 135 heroOrenuKokoro/3
    140 HERO_TENRAIDAN 142 HERO_HEKIREKI 145 heroKibouHidamari/3 150 HERO_HATAJIRUSHI 155 resistAilment/2
    160 HERO_AKATSUKI 160 dynamicVision/3 165 heroKaisenGourei/2 170 HERO_KIBOUICHITOU 175 heroKyoutekiFunki/4 180 HERO_DAIKAGO
    185 heroYuushaSenaka/3 190 RAIJINKEN 195 HERO_YOAKE 200 TENMEINOKEN`,
  skills: {
    // Lv15 の固有技: 誓いを掲げて隊を奮い立たせる
    HERO_CHIKAINOHATA: { name: "誓いの旗", mp: 7, kind: "buff", buff: { atk: 1.15, vit: 1.1 }, target: "all-ally", desc: "誓いを掲げて隊を奮い立たせ、味方全体のSTRと防御を上げる" },
    HERO_JINRAI: { name: "迅雷", mp: 9, kind: "atk", power: 26, element: "wind", para: 0.25, flinchChance: 0.15, target: "enemy", desc: "迅き雷で撃ち、痺れさせ怯ませる" },
    HERO_YUUKITOMOSHIBI: { name: "勇気の灯", mp: 10, kind: "buff", buff: { atk: 1.1 }, cure: ["sleep", "charm", "confuse"], target: "all-ally", desc: "味方全員の眠り・魅了・混乱を治し、勇気の加護を授ける" },
    HERO_SAIKI: { name: "再起の呼び声", mp: 40, kind: "heal", revive: true, revivePct: 0.4, grantEndure: true, target: "ally", desc: "倒れた仲間を呼び起こし (HP40%)、致死を一度耐えさせる" },
    HERO_KIBOUSENKOU: { name: "希望の閃光", mp: 22, kind: "atk", power: 60, element: "light", debuff: { hit: 0.85 }, target: "enemy", desc: "まばゆい希望の光で撃ち、目を眩ます" },
    HERO_SHIPPUUTAIKEN: { name: "疾風の大剣", mp: 24, kind: "phys", power: 5.4, element: "wind", agiScale: 0.3, acc: 1, target: "enemy", desc: "疾風をまとう必中の大剣。速さで伸びる" },
    HERO_FUURAI: { name: "風雷四連", mp: 21, kind: "phys", power: 1.3, hits: 4, element: "wind", acc: 0.8, para: 0.15, target: "enemy", desc: "風と雷の四連撃。痺れさせる" },
    HERO_KIBOUSENPUU: { name: "希望の旋風", mp: 22, kind: "phys", power: 2.2, element: "wind", acc: 0.7, debuff: { agi: 0.9 }, target: "all-enemy", desc: "旋風で敵全体を斬り、足を鈍らせる" },
    HERO_KOUMYOU: { name: "光明の剣", mp: 21, kind: "phys", power: 4.4, pieScale: 0.8, element: "light", acc: 1, bladeHeal: 0.02, healCap: 0.2, target: "enemy", desc: "必中の光剣で断ち、その光で味方を癒す" },
    HERO_GEKIREI: { name: "勇者の激励", mp: 18, kind: "heal", healMul: 1.3, buff: { agi: 1.15 }, target: "all-ally", desc: "味方全員を癒し、素早さを上げる" },
    HERO_TENRAIDAN: { name: "天雷断", mp: 28, kind: "phys", power: 7.0, element: "wind", acc: 1, para: 0.25, target: "enemy", desc: "天の雷を落とす必中の一刀。痺れさせる" },
    HERO_HEKIREKI: { name: "霹靂", mp: 24, kind: "atk", power: 72, element: "wind", vuln: { wind: 0.85 }, target: "enemy", desc: "霹靂が敵を穿ち、風に脆くする" },
    HERO_HATAJIRUSHI: { name: "勇者の旗印", mp: 21, kind: "heal", healMul: 1.2, buff: { atk: 1.2, vit: 1.2 }, regen: { pct: 0.04, turns: 3 }, target: "all-ally", desc: "旗印のもと全員を癒し、攻守と再生を授ける" },
    HERO_AKATSUKI: { name: "暁の光槍", mp: 28, kind: "atk", power: 80, element: "light", drain: 0.2, target: "enemy", desc: "暁の光で撃ち抜き、その光で己を癒す" },
    HERO_KIBOUICHITOU: { name: "希望の一刀", mp: 32, kind: "phys", power: 8.2, element: "light", acc: 1, critBonus: 0.2, target: "enemy", desc: "希望を託した必中の一刀。会心が出やすい" },
    HERO_DAIKAGO: { name: "大いなる加護", mp: 29, kind: "heal", healMul: 1.9, cure: true, purge: true, regen: { pct: 0.05, turns: 3 }, target: "all-ally", desc: "全員を癒し穢れを祓い、癒しの加護を宿す" },
    HERO_YOAKE: { name: "希望の夜明け", mp: 120, kind: "heal", healPct: 1, revive: true, revivePct: 0.5, cure: true, purge: true, buff: { atk: 1.15 }, target: "all-ally", desc: "夜明けが倒れた者を呼び戻し (HP50%)、全員を奮わせる" },
  },
  perks: {
    heroKyoutekiFunki: { label: "強敵への奮起", lv: ["主への与ダメ+5%・会心+6%", "主への与ダメ+8%・会心+9%", "主への与ダメ+11%・会心+12%", "主への与ダメ+14%・会心+15%"],
      fx: [{ t: "deal", v: [0.05, 0.08, 0.11, 0.14], when: { boss: true } }, { t: "crit", v: [0.06, 0.09, 0.12, 0.15], when: { boss: true } }] },
    heroKaisenGourei: { label: "開戦の号令", lv: ["戦闘開始時、味方全員のVIT×1.1 (3ターン)", "戦闘開始時、味方全員のVIT×1.15", "戦闘開始時、味方全員のVIT×1.2"],
      fx: [{ t: "start", party: true, buff: { vit: [1.1, 1.15, 1.2] }, dur: 3 }] },
    heroKibouHidamari: { label: "希望の陽だまり", lv: ["2ラウンド目から毎ラウンド味方全員のHP2%回復", "毎ラウンド味方全員のHP3%回復", "毎ラウンド味方全員のHP4%回復"],
      fx: [{ t: "round", party: true, hp: [0.02, 0.03, 0.04] }] },
    heroYuushaSenaka: { label: "勇者の背中", lv: ["生きている間、味方全員の与ダメ+3%", "味方全員の与ダメ+5%", "味方全員の与ダメ+7%"],
      fx: [{ t: "deal", v: [0.03, 0.05, 0.07], aura: true }] },
    heroOrenuKokoro: { label: "折れぬ心", lv: ["味方が倒れるとSTR×1.2・AGI×1.1 (3ターン)・HP10%回復", "味方が倒れるとSTR×1.25・AGI×1.15・HP15%回復", "味方が倒れるとSTR×1.3・AGI×1.2・HP20%回復"],
      fx: [{ t: "fall", buff: { atk: [1.2, 1.25, 1.3], agi: [1.1, 1.15, 1.2] }, dur: 3, hp: [0.1, 0.15, 0.2] }] },
  },
};
