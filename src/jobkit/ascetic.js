// 修験者 (ascetic) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
export default {
  table: `
    1 KYOUGEKI 2 IWAKUDAKI 3 DIOS 5 asceticism/1 7 NERAIUCHI 8 ASCETIC_TSUBUTE
    10 TAME 12 ASCETIC_FUDOUBI 15 afterHeal/1 20 KUJI 22 CHIRETSU 25 fightSpirit/1
    30 SHINTOU 32 ASCETIC_YAMANARI 35 smite/1 40 SHASHINNOGYOU 45 endure/1 50 GOMA
    55 SHINGANGEKI 57 GANOTOSHI 60 extraHit/1 65 HAKKEI 70 afterHeal/2 75 counter/1
    80 KONGOUTAI 82 GURENZAN 85 DIAL 90 fightSpirit/2 95 HOUKEN 100 KISHINKA
    105 vitalEye/1 107 YAMAKUZUSHI 110 REGENALL 115 selfPurify/1 120 MUSOUKEN 125 resistAilment/1
    130 KIYOME 135 extraHit/2 140 HADAN 145 scripture/1 150 DAICHIMEIDOU 155 counter/2
    160 ASCETIC_KARURA 165 fightSpirit/3 170 TENMAKEN 175 resistAilment/2 180 IYASHINAMI 185 extraHit/3
    190 HAOUZAN 195 SHOUNETSURANBU 200 GONGENOROSHI`,
  skills: {
    // 修験者は行の験力で術を撃つ: 呪文は INT と PIE の高い方で伸びる (faith)
    ASCETIC_TSUBUTE:  { name: "験力の礫", mp: 3, kind: "atk", power: 12, element: "earth", faith: true, target: "enemy", desc: "念を込めた礫を打つ（PIEでも伸びる）" },
    ASCETIC_FUDOUBI:  { name: "不動の火焔", mp: 2, kind: "atk", power: 10, element: "fire", faith: true, target: "enemy", desc: "不動明王の火焔で焼く（PIEでも伸びる）" },
    ASCETIC_YAMANARI: { name: "山鳴りの法", mp: 7, kind: "atk", power: 22, element: "earth", faith: true, target: "all-enemy", desc: "霊山を鳴動させ敵全体を打つ（PIEでも伸びる）" },
    ASCETIC_KARURA:   { name: "迦楼羅炎", mp: 20, kind: "atk", power: 64, element: "fire", faith: true, target: "enemy", desc: "迦楼羅の吐く炎で一体を焼き尽くす（PIEでも伸びる）" },
  },
  perks: {},
};
