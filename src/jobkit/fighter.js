// 全職見直し: 命中と貫通で安定して物理技を当てる。ランクパッシブは維持。
// 戦士 (fighter) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
export default {
  // ランクのパッシブ: 魂がランク2で目覚め、3・4・5で強まる (souls.js の JOB_PASSIVES)
  awaken: "fighterGouken",
  table: `
    1 KYOUGEKI 2 NERAIUCHI 3 TATEWARI 5 extraHit/1 7 KAENGIRI 8 FIGHTER_FUMIKOMI
    10 WARCRY 12 IWAKUDAKI 15 toughBody/1 18 SHINGANGEKI 20 dynamicVision/1 22 NAGIHARAI
    25 vitalEye/1 25 TAME 30 fighterKachidoki/1 35 extraHit/2 35 GOUZAN 45 counter/1
    50 KIKOKU 50 toughBody/2 55 IATSU 57 GURENZAN 60 fightSpirit/1 60 dynamicVision/2
    65 HAISUI 65 fighterRekisen/1 70 counter/2 70 ZANTETSU 80 SANREN 82 GANOTOSHI
    90 vitalEye/2 100 YOROIDACHI 100 toughBody/3 105 DAISENPUU 105 counter/3 107 GOUKADAN
    110 KISHINKA 115 extraHit/3 120 HADAN 120 fighterRekisen/2 130 RANBU 130 dynamicVision/3
    135 fightSpirit/2 140 AMATSUKAZE 145 fighterFutou/1 150 TENCHIZAN 160 KIKOKURANBU 162 SHOUNETSURANBU
    165 fighterFutou/2 170 ROKUREN 175 resistAilment/1 180 YAMAKUZUSHI 185 extraHit/4 190 HAOUZAN
    195 fightSpirit/3 200 METSUKYAKU`,
  skills: {
    // 序盤の固有技: 大きく踏み込み、鎧の継ぎ目ごと叩き斬る (物理貫通25%)
    FIGHTER_FUMIKOMI: {name: "踏み込み斬り", mp: 5, kind: "phys", power: 1.35, acc: 0.18, pierce: 0.4, target: "enemy", desc: "鎧の継ぎ目を狙う一撃。命中率+18%・物理貫通40%", dur: 3},
  },
  perks: {
    // ランクのパッシブ: 鍛え抜いた剣技が、技の一撃を重くする
    fighterGouken: {
      label: "剛剣",
      lv: ["物理技の与ダメージ+5%", "物理技の与ダメージ+10%", "物理技の与ダメージ+15%", "物理技の与ダメージ+25%"],
      fx: [{ t: "deal", on: "skill", v: [0.05, 0.10, 0.15, 0.25] }],
    },
    // 敵を討つたびに鬨の声を上げ、傷を忘れて次の敵へ
    fighterKachidoki: {
      label: "勝利の雄たけび",
      lv: ["敵を倒すとHP6%回復・STR×1.15 (2ターン)"],
      fx: [{ t: "kill", hp: [0.06], buff: { atk: [1.15] }, dur: 2 }],
    },
    // 前衛の経験で被害と物理技の消耗を抑える
    fighterRekisen: {
      label: "歴戦の勘",
      lv: ["前衛で受ける物理の被ダメージ-6%。物理技の消費MP-5%", "前衛で受ける物理の被ダメージ-10%。物理技の消費MP-8%"],
      fx: [
        {t: "take", on: "phys", when: {front: true}, v: [0.06, 0.1]},
        {t: "cost", on: "phys", v: [0.05, 0.08]},
      ],
    },
    // 倒れても膝をつかず、死線で息を吹き返す
    fighterFutou: {
      label: "不撓不屈",
      lv: ["致死ダメージを1戦闘1回HP1で耐える。HP30%以下の間、毎ターンHP15%回復",
        "致死ダメージを1戦闘1回HP1で耐える。HP30%以下の間、毎ターンHP20%回復"],
      fx: [
        { t: "start", endure: true },
        { t: "round", hp: [0.15, 0.2], when: { selfLow: 0.3 } },
      ],
    },
  },
};
