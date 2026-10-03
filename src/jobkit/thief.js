// 盗賊 (thief) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
export default {
  table: `
    1 kantei/1 2 STEAL 3 POISONSTAB 5 ambushCrit/1 7 FUYUU 10 KEMURIDAMA
    12 SUNAKAKE 15 thiefKasume/1 20 KASUMEGIRI 22 SHIBIREBARI 25 thiefTsukekomi/1 30 ASSASSINATE
    35 thiefKasume/2 40 OBORO 45 thiefNigegoshi/1 50 TAKARASAGASHI 55 MAKIBISHI 57 FUUGA
    60 venomBlade/1 65 TSUJIKAZE 70 sleepKill/1 75 thiefShikake/1 80 ZETSUEI 85 SHIPPUTSUKI
    90 thiefKasume/3 95 ENGETSUJIN 100 MOUDOKUSASHI 105 thiefTsukekomi/2 107 KAMIKAZE 110 KAGEUCHI
    115 venomBlade/2 120 KUBIHANE 125 thiefNigegoshi/2 130 RANBUTSUKI 135 thiefKasume/4 140 SHUNSATSU
    145 thiefAsari/1 150 TSUMUJIKAZE 155 thiefShikake/2 160 ZANKOU 162 TENRAN 165 thiefShikake/3
    170 ANSATSU 175 thiefTsukekomi/3 180 SENKOUZAN 185 thiefNigegoshi/3 190 HISSATSU 195 MUGEN
    200 ZANSEI`,
  skills: {},
  perks: {
    // 小悪党の手癖: 殴りついでに敵の強化を掠め取る
    thiefKasume: {
      label: "掠め取り",
      lv: ["通常攻撃の与ダメ+5%、当たると12%で敵の強化を剥ぎ取る", "通常攻撃の与ダメ+9%、18%で強化を剥ぎ取る",
        "通常攻撃の与ダメ+13%、24%で強化を剥ぎ取る", "通常攻撃の与ダメ+17%、30%で強化を剥ぎ取る"],
      fx: [
        { t: "deal", v: [0.05, 0.09, 0.13, 0.17], on: "basic" },
        { t: "hit", chance: [0.12, 0.18, 0.24, 0.3], on: "basic", ail: "strip" },
      ],
    },
    // 砂かけ・痺れ針で弱らせた相手を嬲る
    thiefTsukekomi: {
      label: "弱みにつけ込む",
      lv: ["弱体中の敵への与ダメ+10%、状態異常の敵への会心+5%", "弱体中の敵への与ダメ+16%、状態異常の敵への会心+8%",
        "弱体中の敵への与ダメ+22%、状態異常の敵への会心+12%"],
      fx: [
        { t: "deal", v: [0.1, 0.16, 0.22], when: { tgtDebuffed: true } },
        { t: "crit", v: [0.05, 0.08, 0.12], when: { tgtAil: true } },
      ],
    },
    // 殴られたら逃げ腰で素早くなる
    thiefNigegoshi: {
      label: "逃げ腰の身軽さ",
      lv: ["敵の物理を5%でかわす。物理を受けると25%でAGI×1.15 (2ターン)", "敵の物理を8%でかわす。物理を受けると30%でAGI×1.15",
        "敵の物理を11%でかわす。物理を受けると35%でAGI×1.2"],
      fx: [
        { t: "evade", v: [0.05, 0.08, 0.11] },
        { t: "hurt", chance: [0.25, 0.3, 0.35], buff: { agi: [1.15, 1.15, 1.2] }, dur: 2 },
      ],
    },
    // あらかじめ通り道に罠を仕込んでおく
    thiefShikake: {
      label: "仕込み罠",
      lv: ["戦闘開始時、敵全体のAGI×0.9 (3ターン)", "戦闘開始時、敵全体のAGI×0.85 (3ターン)", "戦闘開始時、敵全体のAGI×0.8 (3ターン)"],
      fx: [{ t: "start", foe: { agi: [0.9, 0.85, 0.8] }, dur: 3 }],
    },
    // 倒した獲物の懐を漁って一息つく
    thiefAsari: {
      label: "獲物漁り",
      lv: ["敵を倒すとHP4%回復し、AGI×1.15 (2ターン)"],
      fx: [{ t: "kill", hp: [0.04], buff: { agi: [1.15] }, dur: 2 }],
    },
  },
};
