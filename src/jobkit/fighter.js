// 戦士 (fighter) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
export default {
  // 覚醒のパッシブ: 魂がランク2に上がると目覚める (以前の Lv15 のパッシブ)
  awaken: "fightSpirit/1",
  table: `
    1 KYOUGEKI 2 NERAIUCHI 3 TATEWARI 5 extraHit/1 7 KAENGIRI 10 WARCRY
    12 IWAKUDAKI 15 FIGHTER_FUMIKOMI 20 SHINGANGEKI 22 NAGIHARAI 25 vitalEye/1 30 HAISUI
    35 extraHit/2 40 KIKOKU 45 counter/1 50 GOUZAN 55 IATSU 57 GURENZAN
    60 fightSpirit/2 65 TAME 70 counter/2 75 fighterKachidoki/1 80 ZANTETSU 82 GANOTOSHI
    85 SANREN 90 vitalEye/2 95 DAISENPUU 100 YOROIDACHI 105 counter/3 107 GOUKADAN
    110 KISHINKA 115 extraHit/3 120 HADAN 125 fighterRekisen/1 130 RANBU 135 fightSpirit/3
    140 AMATSUKAZE 145 fighterFutou/1 150 TENCHIZAN 155 fighterRekisen/2 160 KIKOKURANBU 162 SHOUNETSURANBU
    165 fighterFutou/2 170 ROKUREN 175 resistAilment/1 180 YAMAKUZUSHI 185 extraHit/4 190 HAOUZAN
    195 fightSpirit/4 200 METSUKYAKU`,
  skills: {
    // Lv15 (覚醒のパッシブが抜けた段): 大きく踏み込み、鎧の継ぎ目ごと叩き斬る (防御を一部無視)
    FIGHTER_FUMIKOMI: { name: "踏み込み斬り", mp: 5, kind: "phys", power: 1.5, acc: 0.4, pierce: 0.25, target: "enemy", desc: "大きく踏み込み、鎧の継ぎ目ごと叩き斬る（防御を一部無視）" },
  },
  perks: {
    // 敵を討つたびに鬨の声を上げ、傷を忘れて次の敵へ
    fighterKachidoki: {
      label: "勝鬨",
      lv: ["敵を倒すとHP6%回復・攻撃力×1.15 (2ターン)"],
      fx: [{ t: "kill", hp: [0.06], buff: { atk: [1.15] }, dur: 2 }],
    },
    // 百戦の勘で打ち込みを外し、打たれれば闘志が燃える
    fighterRekisen: {
      label: "歴戦の勘",
      lv: ["敵の物理を7%でかわす。物理を受けると20%で攻撃力×1.15 (2ターン)",
        "敵の物理を11%でかわす。物理を受けると30%で攻撃力×1.2 (2ターン)"],
      fx: [
        { t: "evade", v: [0.07, 0.11] },
        { t: "hurt", chance: [0.2, 0.3], buff: { atk: [1.15, 1.2] }, dur: 2 },
      ],
    },
    // 倒れても膝をつかず、死線で息を吹き返す
    fighterFutou: {
      label: "不撓不屈",
      lv: ["致死ダメージを1戦闘1回HP1で耐える。HP30%以下の間、毎ラウンドHP3%回復",
        "致死ダメージを1戦闘1回HP1で耐える。HP30%以下の間、毎ラウンドHP5%回復"],
      fx: [
        { t: "start", endure: true },
        { t: "round", hp: [0.03, 0.05], when: { selfLow: 0.3 } },
      ],
    },
  },
};
