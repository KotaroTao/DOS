// 修験者 (ascetic) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
export default {
  table: `
    1 KYOUGEKI 2 IWAKUDAKI 3 DIOS 5 asceticism/1 7 NERAIUCHI 8 ISHITSUBUTE
    10 TAME 12 HALITO 15 afterHeal/1 20 KUJI 22 CHIRETSU 25 fightSpirit/1
    30 SHINTOU 32 EARTHQUAKE 35 smite/1 40 SHASHINNOGYOU 45 endure/1 50 GOMA
    55 SHINGANGEKI 57 GANOTOSHI 60 extraHit/1 65 HAKKEI 70 afterHeal/2 75 counter/1
    80 KONGOUTAI 82 GURENZAN 85 DIAL 90 fightSpirit/2 95 HOUKEN 100 KISHINKA
    105 vitalEye/1 107 YAMAKUZUSHI 110 REGENALL 115 selfPurify/1 120 MUSOUKEN 125 resistAilment/1
    130 KIYOME 135 extraHit/2 140 HADAN 145 scripture/1 150 DAICHIMEIDOU 155 counter/2
    160 GOKUEN 165 fightSpirit/3 170 TENMAKEN 175 resistAilment/2 180 IYASHINAMI 185 extraHit/3
    190 HAOUZAN 195 SHOUNETSURANBU 200 GONGENOROSHI`,
  skills: {},
  perks: {},
};
