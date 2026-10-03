// 守護騎士 (guardian) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
// 持ち味: 動かぬ城壁と反撃 — 根を張って耐え、受けた傷と盾の重み (VIT・背水) で打ち返す。大地と水の守り
export default {
  table: `
    1 SHIELDBASH 2 NERAIUCHI 3 CHOUHATSU 5 guardianNone/1 7 GUARDIAN_NEHARI 10 SUIGETSU
    12 IWAKUDAKI 15 guardianHoufuku/1 20 HANGEKI 22 CHIRETSU 25 guardianTatenochikai/1 30 NIOUDACHI
    35 guardianToride/1 40 KOUBOUITTAI 45 guardianNone/2 50 GUARDIAN_KORAEGAESHI 55 RYUURINJIN 57 GUARDIAN_GANBANGAESHI
    60 guardianHoufuku/2 65 GUARDIAN_SUKIUGACHI 70 guardianUtaregatame/1 75 guardianToride/2 80 GUARDIAN_SEKIHEKI 85 GUARDIAN_SOUJUN
    90 guardianTatenochikai/2 95 GUARDIAN_GAJOU 100 GUARDIAN_OMOTATE 105 guardianHoufuku/3 107 GUARDIAN_JIBANSHIZUME 110 OUJOU
    115 guardianToride/3 120 GUARDIAN_JUUGAITOOSHI 125 guardianUtaregatame/2 130 GUARDIAN_SENNENJOUHEKI 135 resistAilment/1 140 GUARDIAN_MIDARETATE
    145 bigBarrier/1 150 GUARDIAN_UZUSHIO 155 guardianNone/3 160 GUARDIAN_DAIBANJAKU 162 GUARDIAN_JIJIKUYURASHI 165 resistAilment/2
    170 GUARDIAN_TAKANAMI 175 holyCover/1 180 GUARDIAN_KINJOUTEPPEKI 185 bigBarrier/2 190 GUARDIAN_ROUJOU 195 GUARDIAN_TENCHIGAESHI
    200 GUARDIAN_EIGOUJOUSAI`,
  skills: {
    GUARDIAN_NEHARI: { name: "根張りの構え", mp: 5, kind: "buff", buff: { vit: 1.7, agi: 0.8 }, dur: 4, tech: true, target: "self", desc: "根を張って動かず、防御を大きく上げる（素早さ↓）" },
    GUARDIAN_KORAEGAESHI: { name: "堪え返し", mp: 10, kind: "phys", power: 1.5, vitScale: 0.8, desperate: true, acc: 0.7, flinchChance: 0.2, target: "enemy", desc: "耐えた傷の分だけ重い盾撃。怯ませる" },
    GUARDIAN_GANBANGAESHI: { name: "岩盤返し", mp: 12, kind: "phys", power: 1.9, vitScale: 0.4, element: "earth", acc: 0.5, debuff: { agi: 0.8 }, target: "enemy", desc: "岩盤をめくり上げて打ち、足を止める" },
    GUARDIAN_SUKIUGACHI: { name: "隙穿ち", mp: 7, kind: "phys", power: 1.4, acc: 0.9, strip: true, target: "enemy", desc: "盾越しに隙を読んで突き、強化を剥ぐ" },
    GUARDIAN_SEKIHEKI: { name: "石壁の陣", mp: 11, kind: "buff", buff: { vit: 1.25 }, debuffAll: { atk: 0.92 }, tech: true, target: "all-ally", desc: "石壁を築いて味方を守り、敵の勢いを殺ぐ" },
    GUARDIAN_SOUJUN: { name: "霜盾打ち", mp: 11, kind: "phys", power: 2.0, vitScale: 0.4, element: "water", debuff: { atk: 0.85 }, target: "enemy", desc: "凍てつく盾で打ち、敵の腕を鈍らせる" },
    GUARDIAN_GAJOU: { name: "牙城の名乗り", mp: 11, kind: "buff", taunt: true, buff: { vit: 1.3 }, grantBarrier: 1, tech: true, target: "self", desc: "名乗りで敵を集め、身に魔障壁を張る" },
    GUARDIAN_OMOTATE: { name: "重盾落とし", mp: 18, kind: "phys", power: 2.2, vitScale: 2.2, acc: 1, flinchChance: 0.3, target: "enemy", desc: "盾の重みを落とす必中の一撃。怯ませる" },
    GUARDIAN_JIBANSHIZUME: { name: "地盤沈め", mp: 20, kind: "phys", power: 4.4, element: "earth", acc: 0.7, debuff: { agi: 0.7 }, flinchChance: 0.25, target: "enemy", desc: "大地ごと沈め、足を奪い怯ませる" },
    GUARDIAN_JUUGAITOOSHI: { name: "重鎧通し", mp: 16, kind: "phys", power: 2.6, vitScale: 0.5, pierce: 0.8, acc: 0.8, target: "enemy", desc: "鎧の継ぎ目を圧し通す（防御をほぼ無視）" },
    GUARDIAN_SENNENJOUHEKI: { name: "千年城壁", mp: 20, kind: "buff", buff: { vit: 1.5 }, dur: 5, tech: true, target: "all-ally", desc: "崩れぬ城壁で味方全体を長く守る（5ターン）" },
    GUARDIAN_MIDARETATE: { name: "乱れ盾", mp: 24, kind: "phys", power: 1.0, vitScale: 0.8, scatter: 4, acc: 0.8, flinchChance: 0.25, target: "all-enemy", desc: "盾撃を敵陣へ4度ばらまき、怯ませる" },
    GUARDIAN_UZUSHIO: { name: "渦潮の守り", mp: 22, kind: "buff", grantBarrier: 1, debuffAll: { agi: 0.85 }, tech: true, target: "all-ally", desc: "渦潮で味方に魔障壁を張り、敵の足を奪う" },
    GUARDIAN_DAIBANJAKU: { name: "大磐石", mp: 28, kind: "phys", power: 4.0, vitScale: 2.0, desperate: true, acc: 1, target: "enemy", desc: "傷を負うほど重くなる必中の大盾撃" },
    GUARDIAN_JIJIKUYURASHI: { name: "地軸揺らし", mp: 28, kind: "phys", power: 1.7, vitScale: 0.4, element: "earth", acc: 0.6, debuff: { vit: 0.85 }, target: "all-enemy", desc: "大地を揺さぶり、敵全体の守りを崩す" },
    GUARDIAN_TAKANAMI: { name: "高波の盾", mp: 22, kind: "phys", power: 1.5, vitScale: 0.7, element: "water", acc: 0.7, debuff: { agi: 0.85 }, flinchChance: 0.2, target: "all-enemy", desc: "大盾で高波を起こし、敵陣を押し流す" },
    GUARDIAN_KINJOUTEPPEKI: { name: "金城鉄壁", mp: 26, kind: "buff", shield: true, stance: "counter", buff: { vit: 1.35 }, regen: { pct: 0.05, turns: 3 }, tech: true, target: "self", desc: "仲間を庇って必ず反撃し、傷を癒し続ける" },
    GUARDIAN_ROUJOU: { name: "籠城の大号令", mp: 30, kind: "buff", buff: { vit: 1.4 }, regen: { pct: 0.05, turns: 4 }, tech: true, target: "all-ally", desc: "味方全体を守り固め、毎ターン癒す" },
    GUARDIAN_TENCHIGAESHI: { name: "天地返し", mp: 28, kind: "phys", power: 5.6, vitScale: 0.3, acc: 1, debuff: { atk: 0.75 }, flinchChance: 0.3, target: "enemy", desc: "天地を返す必中の盾撃。力を挫き怯ませる" },
    GUARDIAN_EIGOUJOUSAI: { name: "永劫城塞", mp: 40, kind: "heal", power: 30, buff: { vit: 1.7 }, regen: { pct: 0.05, turns: 4 }, grantBarrier: 1, target: "all-ally", desc: "味方全体を癒し、城塞と障壁で守り続ける" },
  },
  perks: {
    guardianNone: {
      label: "不動の根",
      lv: ["戦闘開始時、敵を自分に引き付ける (2ターン)", "さらに戦闘ごとに一度、致死をHP1で耐える", "さらに戦闘開始時、VIT×1.2 (3ターン)"],
      fx: [{ t: "start", taunt: true }, { t: "start", chance: [0, 1, 1], endure: true, buff: { vit: [1, 1, 1.2] }, dur: 3 }],
    },
    guardianHoufuku: {
      label: "報復の楯",
      lv: ["物理を受けると25%で、受けた傷の100%を相手に返す", "物理を受けると30%で、受けた傷の140%を相手に返す", "物理を受けると35%で、受けた傷の180%を相手に返す"],
      fx: [{ t: "hurt", chance: [0.25, 0.30, 0.35], thorns: [1.0, 1.4, 1.8] }],
    },
    guardianTatenochikai: {
      label: "楯の誓い",
      lv: ["防御中の被ダメージ-15%", "防御中の被ダメージ-25%"],
      fx: [{ t: "take", when: { defending: true }, v: [0.15, 0.25] }],
    },
    guardianToride: {
      label: "最後の砦",
      lv: ["HP30%以下の味方全員の被ダメージ-12%", "HP30%以下の味方全員の被ダメージ-20%", "HP30%以下の味方全員の被ダメージ-28%"],
      fx: [{ t: "take", aura: true, when: { selfLow: 0.3 }, v: [0.12, 0.20, 0.28] }],
    },
    guardianUtaregatame: {
      label: "打たれ固め",
      lv: ["物理を受けると30%でVIT×1.2 (2ターン)", "物理を受けると40%でVIT×1.25 (2ターン)"],
      fx: [{ t: "hurt", chance: [0.3, 0.4], buff: { vit: [1.2, 1.25] }, dur: 2 }],
    },
  },
};
