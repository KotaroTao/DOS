// 護法師 (warden) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
// 持ち味: 結界と封印の術者。土と水の守りで隊を囲い、敵の特技を封じ、封じた敵の牙を鈍らせる。
export default {
  // 覚醒のパッシブ: 魂がランク2に上がると目覚める (以前の Lv15 のパッシブ)
  awaken: "wardenSeihitsu/1",
  table: `
    1 PROTECT 2 ISHITSUBUTE 3 SEAL 5 wardenHouheki/1 7 WARDEN_FUUGAN 10 ICENEEDLE
    12 AQUAWAVE 15 WARDEN_SHIZUMEISHI 15 spellGuard/1 20 MAYOKE 22 EARTHQUAKE 25 wardenGohoujin/1 30 WARDEN_SEKIRUI
    35 wardenFuujite/1 40 KOUSHUNOHOUJIN 45 wardenHouheki/2 47 ICELANCE 50 WARDEN_FUUMAKEKKAI 50 spellGuard/2 55 WARDEN_CHINJUU
    60 wardenGohoujin/2 62 LANDSLIDE 65 MADALT 70 wardenJusogaeshi/1 75 resistAilment/1 80 WARDEN_MIZUKAGAMI
    85 ELEMBREAK 90 wardenSeihitsu/2 95 WARDEN_HAJA 100 WARDEN_SHIHOU 100 spellGuard/3 102 WARDEN_JIBAKU 105 wardenFuujite/2
    110 WARDEN_SUIROU 115 wardenGohoujin/3 120 WARDEN_FUDOU 125 wardenSeihitsu/3 130 WARDEN_TAIZAN 135 wardenJusogaeshi/2
    140 WARDEN_GANKAI 145 wardenHouheki/3 150 WARDEN_KONGOU 155 resistAilment/2 160 WARDEN_BAKUFU 165 wardenFuujite/3
    170 DAIKEKKAI 172 WARDEN_KANAME 175 wardenJusogaeshi/3 180 WARDEN_CHIMYAKU 185 wardenGohoujin/4 190 WARDEN_HYOUFUU
    195 WARDEN_SEISHIN 200 WARDEN_BANSHOU`,
  skills: {
    // Lv15 (覚醒のパッシブが抜けた段): 鎮め石を巡らせ、敵全体の特技と力を鎮める
    WARDEN_SHIZUMEISHI: { name: "鎮め石", mp: 6, kind: "debuff", seal: { chance: 0.35, turns: 2 }, debuff: { atk: 0.9 }, target: "all-enemy", desc: "鎮め石を巡らせ、敵全体の特技を封じて力を鈍らせる" },
    WARDEN_FUUGAN:      { name: "封眼の符", mp: 4, kind: "debuff", debuff: { hit: 0.75 }, seal: { chance: 0.3, turns: 2 }, target: "enemy", desc: "符で目を塞ぎ、狙いを乱し特技を封じる" },
    WARDEN_SEKIRUI:     { name: "石塁の礫", mp: 8, kind: "atk", power: 24, element: "earth", debuffAll: { atk: 0.9 }, target: "enemy", desc: "石塁の礫を撃ち、敵全体の勢いを削ぐ" },
    WARDEN_FUUMAKEKKAI: { name: "封魔結界", mp: 10, kind: "debuff", seal: { chance: 0.55, turns: 3 }, debuff: { agi: 0.9 }, target: "all-enemy", desc: "結界で敵全体の特技を封じ、足を鈍らせる" },
    WARDEN_CHINJUU:     { name: "鎮めの重石", mp: 7, kind: "atk", gravity: 0.2, seal: { chance: 0.5, turns: 2 }, target: "enemy", desc: "今のHPの20%を圧し、特技を鎮める" },
    WARDEN_MIZUKAGAMI:  { name: "水鏡の陣", mp: 11, kind: "buff", buff: { vit: 1.25 }, regen: { pct: 0.03, turns: 3 }, target: "all-ally", desc: "味方全体の守りを固め、傷を癒し続ける" },
    WARDEN_HAJA:        { name: "破邪の封鎖", mp: 6, kind: "debuff", strip: true, vuln: { earth: 0.85, water: 0.85 }, target: "all-enemy", desc: "強化を剥ぎ、土と水への守りを崩す" },
    WARDEN_SHIHOU:      { name: "四方結界", mp: 20, kind: "buff", buff: { vit: 1.2 }, grantBarrier: 1, cure: true, target: "all-ally", desc: "魔障壁を張り、守りを上げ穢れを祓う" },
    WARDEN_JIBAKU:      { name: "地縛の陣", mp: 16, kind: "atk", power: 44, element: "earth", para: 0.25, target: "enemy", desc: "地に縛り付けて撃ち、痺れさせる" },
    WARDEN_SUIROU:      { name: "水牢", mp: 14, kind: "atk", power: 34, element: "water", debuff: { atk: 0.85 }, target: "enemy", desc: "水の牢で締め上げ、力を奪う" },
    WARDEN_FUDOU:       { name: "不動の陣", mp: 16, kind: "buff", buff: { vit: 1.4 }, dur: 5, target: "all-ally", tech: true, desc: "味方全体の守りを長く固める (5ターン)" },
    WARDEN_TAIZAN:      { name: "泰山の重圧", mp: 18, kind: "atk", gravity: 0.25, debuff: { atk: 0.85 }, target: "all-enemy", desc: "敵全体の今のHPの25%を圧し、力を奪う" },
    WARDEN_GANKAI:      { name: "岩戒の陣", mp: 26, kind: "atk", power: 70, element: "earth", flinchChance: 0.3, target: "all-enemy", desc: "岩の戒めが敵全体を打ち、怯ませる" },
    WARDEN_KONGOU:      { name: "金剛の陣", mp: 20, kind: "buff", buff: { vit: 1.5 }, debuffAll: { agi: 0.85 }, target: "all-ally", tech: true, desc: "味方の守りを固め、敵全体の足を縛る" },
    WARDEN_BAKUFU:      { name: "瀑布落とし", mp: 20, kind: "atk", power: 50, element: "water", debuff: { agi: 0.85 }, target: "all-enemy", desc: "瀑布が敵全体を打ち据え、足を奪う" },
    WARDEN_KANAME:      { name: "要石落とし", mp: 26, kind: "atk", power: 80, element: "earth", debuff: { agi: 0.75 }, target: "enemy", desc: "要石で地に縫い留め、足を奪う" },
    WARDEN_CHIMYAKU:    { name: "地脈封鎖", mp: 36, kind: "atk", power: 96, seal: { chance: 0.4, turns: 3 }, target: "all-enemy", desc: "地脈を断って撃ち、特技を封じる（無属性）" },
    WARDEN_HYOUFUU:     { name: "氷封", mp: 26, kind: "atk", power: 78, element: "water", seal: { chance: 0.7, turns: 3 }, target: "enemy", desc: "氷に封じ込め、特技を深く封じる" },
    WARDEN_SEISHIN:     { name: "星辰の帳", mp: 22, kind: "atk", power: 56, debuff: { hit: 0.85 }, target: "all-enemy", desc: "星辰の帳が敵全体を撃ち、狙いを乱す" },
    WARDEN_BANSHOU:     { name: "万象封滅", mp: 44, kind: "atk", power: 128, debuff: { atk: 0.85, agi: 0.85 }, target: "all-enemy", desc: "万象を封じ、敵全体の力と足を縛る（無属性）" },
  },
  perks: {
    wardenHouheki: {
      label: "法壁の加護",
      lv: ["戦闘開始時、自分に魔障壁を1枚張る (ブレス・呪文の被ダメ半減)", "戦闘開始時、自分に魔障壁を2枚張る", "戦闘開始時、自分に魔障壁を3枚張る"],
      fx: [{ t: "start", barrier: [1, 2, 3] }],
    },
    wardenSeihitsu: {
      label: "静謐の循環",
      lv: ["2ラウンド目から毎ラウンド、MPを最大の2%回復", "2ラウンド目から毎ラウンド、MPを最大の3%回復", "2ラウンド目から毎ラウンド、MPを最大の4%回復"],
      fx: [{ t: "round", mp: [0.02, 0.03, 0.04] }],
    },
    wardenGohoujin: {
      label: "護法陣",
      lv: ["戦闘開始時、味方全員のVIT×1.06 (3ターン)", "戦闘開始時、味方全員のVIT×1.09 (3ターン)",
        "戦闘開始時、味方全員のVIT×1.12 (3ターン)", "戦闘開始時、味方全員のVIT×1.15 (3ターン)"],
      fx: [{ t: "start", party: true, buff: { vit: [1.06, 1.09, 1.12, 1.15] }, dur: 3 }],
    },
    wardenFuujite: {
      label: "封じ手の心得",
      lv: ["味方全員、弱体・封印中の敵から受けるダメージ-5%", "味方全員、弱体・封印中の敵から受けるダメージ-8%", "味方全員、弱体・封印中の敵から受けるダメージ-12%"],
      fx: [{ t: "take", when: { tgtDebuffed: true }, aura: true, v: [0.05, 0.08, 0.12] }],
    },
    wardenJusogaeshi: {
      label: "呪詛返し",
      lv: ["ブレス・呪文を受けた時、受けたダメージの25%を相手に返す", "ブレス・呪文を受けた時、受けたダメージの40%を相手に返す",
        "ブレス・呪文を受けた時、受けたダメージの55%を相手に返す"],
      fx: [{ t: "hurt", on: "breath", thorns: [0.25, 0.4, 0.55] }],
    },
  },
};
