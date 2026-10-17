// 全職見直し: 単体回復と治療を少ないMPで続け、蘇生につなぐ。ランクパッシブは維持。
// 僧侶 (priest) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
// 持ち味: 素朴な癒しの基本。村の僧が枕元で祈るような、質素で粘り強い手当て (蘇生は身を削ってでも)
export default {
  // ランクのパッシブ: 魂がランク2で目覚め、3・4・5で強まる (souls.js の JOB_PASSIVES)
  awaken: "priestInochi",
  table: `
    1 DIOS 3 HOLYRAY 5 CURE 7 CUREALL 8 PRIEST_MAKURABE 10 RECOVER
    15 fieldRegen/1 17 RECOVERALL 18 DIOSALL 20 AWAKE 25 DIAL 25 priestShisso/1
    30 AWAKEALL 35 chant/1 35 STONECURE 40 REVIVE 45 DIALALL 45 purify/1
    45 STONECUREALL 45 priestTeate/1 50 fieldRegen/2 55 PURIFY 60 afterHeal/3 60 MADIOS
    65 PRIEST_KEGAREOTOSHI 65 priestShisso/2 70 resistAilment/1 80 PURIFYALL 90 afterHeal/4 90 RESURRECT
    90 priestYoake/1 100 SEIBETSU 100 fieldRegen/3 100 REGENALL 105 chant/2 115 priestTeate/2
    120 MADIOSALL 125 resistAilment/2 130 SHINBATSU 140 SEISUISHO 145 priestMitori/1 145 priestYoake/2
    150 TENKEINOINORI 160 SEIMETSUKOU 170 FUKUIN 180 SEIKOURETSU 185 DAISEIKITOU 190 DAIFUKUIN
    195 priestMitori/2 200 KAMIWAZA`,
  skills: {
    // 序盤の固有技: 傷と眠りを癒し、癒しの持続を残す
    PRIEST_MAKURABE: {name: "枕辺の祈り", mp: 4, kind: "heal", healMul: 1, healCap: 0.5, cure: ["sleep"], regen: {pct: 0.02, turns: 3}, target: "ally", desc: "一人の傷と眠りを癒す。小さな癒しが3ターン続く", dur: 3},
    PRIEST_GOKOU: { name: "後光", mp: 6, kind: "atk", power: 15, element: "light", debuff: { hit: 0.85 }, target: "all-enemy", desc: "後光で敵全体を灼き、目を眩ませる" },
    PRIEST_KEGAREOTOSHI: {name: "穢れ落とし", mp: 16, kind: "heal", healMul: 0.8, healCap: 0.5, cure: ["poison", "paralyze", "sleep", "confuse", "charm"], purge: true, target: "all-ally", desc: "味方全員の毒・麻痺・眠り・混乱・魅了と弱体を祓い、小さく癒す", dur: 3},
  },
  perks: {
    priestShisso: {
      label: "質素な祈り",
      lv: ["回復の消費MP-12%・治療の消費MP-15%", "回復の消費MP-20%・治療の消費MP-25%"],
      fx: [
        {t: "cost", on: "heal", v: [0.12, 0.2]},
        {t: "cost", on: "cure", v: [0.15, 0.25]},
      ],
    },
    priestYoake: { label: "夜明けの祈り", scope: "party", lv: ["戦闘開始時、味方全員に毎ターン最大HP2%の癒し (3ターン)", "戦闘開始時、味方全員に毎ターン最大HP3.5%の癒し (3ターン)"],
      fx: [{ t: "start", party: true, regen: [0.02, 0.035], dur: 3 }] },
    priestTeate: { label: "手当ての心得", lv: ["回復の技・呪文の回復量+10%", "回復の技・呪文の回復量+20%"],
      fx: [{ t: "heal", v: [0.1, 0.2] }] },
    priestMitori: { label: "看取りの祈り", lv: ["倒れた味方がいる間、毎ターンMP3%回復", "倒れた味方がいる間、毎ターンMP5%回復"],
      fx: [{ t: "round", when: { allyDown: true }, mp: [0.03, 0.05] }] },
  },
};
