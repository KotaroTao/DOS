// 修験者 (ascetic) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
// 持ち味: 山岳の荒行。滝行・火渡りで己を鍛え、身を削って打ち・癒し、護摩の炎と山の土で敵を焼き崩す (土・火)
export default {
  table: `
    1 KYOUGEKI 2 IWAKUDAKI 3 DIOS 5 asceticAragyou/1 7 NERAIUCHI 8 ISHITSUBUTE
    10 ASCETIC_TAKIGYOU 12 HALITO 15 asceticYoujou/1 20 KUJI 22 CHIRETSU 25 asceticAragyou/2
    30 ASCETIC_HIWATARI 32 EARTHQUAKE 35 asceticNyuubu/1 40 SHASHINNOGYOU 45 asceticDoukou/1 50 GOMA
    55 SHINGANGEKI 57 GANOTOSHI 60 asceticNyuubu/2 65 ASCETIC_SHAKUJOU 70 asceticYoujou/2 75 asceticMoeagari/1
    80 ASCETIC_SARASHIMI 82 ASCETIC_KAENSHAKUJOU 85 ASCETIC_YAMABUSHIGUSURI 90 asceticAragyou/3 95 ASCETIC_IWAOTOOSHI 100 ASCETIC_ZAOU
    105 asceticNyuubu/3 107 ASCETIC_REIHOU 110 ASCETIC_MIGAWARIGOMA 115 asceticYoujou/3 120 ASCETIC_SANKO 125 resistAilment/1
    130 ASCETIC_GOMANOKEMURI 135 asceticMoeagari/2 140 ASCETIC_NYUUBU 145 asceticDoukou/2 150 ASCETIC_YAMANARI 155 asceticMoeagari/3
    160 ASCETIC_KASHOUZANMAI 165 asceticAragyou/4 170 ASCETIC_SHAKUJOURANBU 175 resistAilment/2 180 ASCETIC_SHASHINKUYOU 185 asceticYoujou/4
    190 ASCETIC_SHASHINJOUBUTSU 195 ASCETIC_FUDOUKAEN 200 GONGENOROSHI`,
  skills: {
    ASCETIC_TAKIGYOU: { name: "滝行", mp: 3, kind: "buff", charge: 1.7, cure: true, target: "self", tech: true, desc: "滝に打たれて身を清め、次の一撃に力を溜める" },
    ASCETIC_HIWATARI: { name: "火渡りの行", mp: 6, kind: "heal", power: 24, cure: true, regen: { pct: 0.04, turns: 3 }, target: "self", tech: true, desc: "火の上を渡り、身を清め癒し続ける" },
    ASCETIC_SHAKUJOU: { name: "錫杖打ち", mp: 6, kind: "phys", power: 1.3, acc: 0.7, flinchChance: 0.3, target: "enemy", desc: "錫杖を鳴らして打ち、怯ませる" },
    ASCETIC_SARASHIMI: { name: "晒し身の行", mp: 8, kind: "buff", buff: { vit: 1.4 }, taunt: true, target: "self", tech: true, desc: "鍛えた身を晒し、守りを固めて敵を引き付ける" },
    ASCETIC_KAENSHAKUJOU: { name: "火炎錫杖", mp: 11, kind: "phys", power: 2.6, element: "fire", acc: 0.4, debuff: { atk: 0.85 }, target: "enemy", desc: "炎をまとう錫杖で打ち、力を削ぐ" },
    ASCETIC_YAMABUSHIGUSURI: { name: "山伏の薬", mp: 4, kind: "heal", power: 24, cure: true, target: "ally", desc: "山の薬草で傷と穢れを癒す" },
    ASCETIC_IWAOTOOSHI: { name: "巌通し", mp: 16, kind: "phys", power: 3.3, pierce: 1, acc: 0.85, flinchChance: 0.2, target: "enemy", desc: "巌をも通す拳。守りを無視し怯ませる" },
    ASCETIC_ZAOU: { name: "蔵王の憤怒", mp: 10, kind: "buff", buff: { atk: 1.75 }, hpCost: 0.1, target: "self", tech: true, desc: "身を削って蔵王権現の憤怒を宿す" },
    ASCETIC_REIHOU: { name: "霊峰崩し", mp: 20, kind: "phys", power: 4.4, element: "earth", acc: 0.7, debuff: { agi: 0.75 }, target: "enemy", desc: "霊峰をも崩す一撃。足を大きく鈍らす" },
    ASCETIC_MIGAWARIGOMA: { name: "身代わりの護摩", mp: 10, kind: "buff", regen: { pct: 0.07, turns: 4 }, buff: { atk: 1.1 }, hpCost: 0.1, target: "all-ally", desc: "身を焚べる護摩が全員を癒し続ける" },
    ASCETIC_SANKO: { name: "三鈷の一撃", mp: 24, kind: "phys", power: 6, acc: 1, seal: { chance: 0.5, turns: 3 }, target: "enemy", desc: "三鈷杵の必中の一撃。特技を封じる" },
    ASCETIC_GOMANOKEMURI: { name: "護摩の煙", mp: 9, kind: "cure", purge: true, debuffAll: { hit: 0.9 }, target: "all-ally", desc: "煙で全員の穢れを祓い、敵の目を燻す" },
    ASCETIC_NYUUBU: { name: "入峰の一撃", mp: 24, kind: "phys", power: 4.8, acc: 1, desperate: true, target: "enemy", desc: "必中の一撃。傷が深いほど重い" },
    ASCETIC_YAMANARI: { name: "山鳴り", mp: 28, kind: "phys", power: 2.1, element: "earth", acc: 0.6, debuff: { vit: 0.85 }, target: "all-enemy", desc: "山を鳴らす踏み込みで全敵の守りを崩す" },
    ASCETIC_KASHOUZANMAI: { name: "火生三昧", mp: 20, kind: "atk", power: 56, element: "fire", poison: { chance: 0.5, pct: 0.05 }, target: "enemy", desc: "不動の火炎で焼き、焼け爛れさせる" },
    ASCETIC_SHAKUJOURANBU: { name: "錫杖乱舞", mp: 26, kind: "phys", power: 2.3, acc: 0.8, strip: true, target: "all-enemy", desc: "錫杖の音が全敵を打ち、加護を祓う" },
    ASCETIC_SHASHINKUYOU: { name: "捨身供養", mp: 18, kind: "heal", power: 76, hpCost: 0.12, target: "all-ally", desc: "己の身を削り、全員を大きく癒す" },
    ASCETIC_SHASHINJOUBUTSU: { name: "捨身成仏", mp: 32, kind: "phys", power: 9.4, acc: 1, hpCost: 0.15, target: "enemy", desc: "身を削って放つ必中の大喝" },
    ASCETIC_FUDOUKAEN: { name: "不動火炎陣", mp: 28, kind: "phys", power: 2.3, element: "fire", acc: 0.7, partyHeal: 8, target: "all-enemy", desc: "不動の炎が全敵を焼き、仲間を癒す" },
  },
  perks: {
    asceticAragyou: { label: "荒行の誓い", lv: ["HP40%以下の時、与ダメージ+10%・会心+4%", "HP40%以下の時、与ダメージ+15%・会心+6%", "HP40%以下の時、与ダメージ+20%・会心+8%", "HP40%以下の時、与ダメージ+25%・会心+10%"],
      fx: [{ t: "deal", when: { selfLow: 0.4 }, v: [0.1, 0.15, 0.2, 0.25] }, { t: "crit", when: { selfLow: 0.4 }, v: [0.04, 0.06, 0.08, 0.1] }] },
    asceticYoujou: { label: "山伏の養生", lv: ["HP50%以下の間、毎ラウンドHP3%回復", "HP50%以下の間、毎ラウンドHP4%回復", "HP50%以下の間、毎ラウンドHP5%回復", "HP50%以下の間、毎ラウンドHP6%回復"],
      fx: [{ t: "round", when: { selfLow: 0.5 }, hp: [0.03, 0.04, 0.05, 0.06] }] },
    asceticNyuubu: { label: "入峰の気合", lv: ["戦闘開始時、溜め×1.3 (次の物理が強まる)", "戦闘開始時、溜め×1.45 (次の物理が強まる)", "戦闘開始時、溜め×1.6 (次の物理が強まる)"],
      fx: [{ t: "start", charge: [1.3, 1.45, 1.6] }] },
    asceticDoukou: { label: "同行の憤り", lv: ["味方が倒れると、HP10%回復・ATK×1.2 (3ターン)", "味方が倒れると、HP15%回復・ATK×1.3 (3ターン)"],
      fx: [{ t: "fall", hp: [0.1, 0.15], buff: { atk: [1.2, 1.3] } }] },
    asceticMoeagari: { label: "燃え上がる行者", lv: ["物理を受けた時30%で、ATK×1.1 (2ターン)", "物理を受けた時40%で、ATK×1.15 (2ターン)", "物理を受けた時50%で、ATK×1.2 (2ターン)"],
      fx: [{ t: "hurt", chance: [0.3, 0.4, 0.5], buff: { atk: [1.1, 1.15, 1.2] }, dur: 2 }] },
  },
};
