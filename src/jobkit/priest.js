// 僧侶 (priest) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
// 持ち味: 素朴な癒しの基本。村の僧が枕元で祈るような、質素で粘り強い手当て (蘇生は身を削ってでも)
export default {
  // ランクのパッシブ: 魂がランク2で目覚め、3・4・5で強まる (souls.js の JOB_PASSIVES)
  awaken: "priestInochi",
  table: `
    1 DIOS 3 HOLYRAY 5 CURE 7 CUREALL 10 RECOVER 15 PRIEST_MAKURABE 15 fieldRegen/1 17 RECOVERALL 20 AWAKE
    25 DIOSALL 30 AWAKEALL 30 DIAL 35 chant/1 35 STONECURE 40 DIALALL 45 purify/1 45 STONECUREALL 50 REVIVE
    50 fieldRegen/2 60 afterHeal/3 60 MADIOS 65 PURIFY 70 resistAilment/1 75 priestShisso/1 80 PURIFYALL
    85 PRIEST_KEGAREOTOSHI 90 afterHeal/4 95 RESURRECT 100 SEIBETSU 100 fieldRegen/3 105 chant/2
    110 MADIOSALL 115 priestYoake/1 120 REGENALL 125 resistAilment/2 130 SHINBATSU 135 priestTeate/1
    140 SEISUISHO 145 priestMitori/1 150 TENKEINOINORI 155 priestShisso/2 160 SEIMETSUKOU 165 priestYoake/2
    170 FUKUIN 175 priestTeate/2 180 SEIKOURETSU 185 DAISEIKITOU 190 DAIFUKUIN 195 priestMitori/2
    200 KAMIWAZA`,
  skills: {
    // Lv15 の固有技: 傷と眠りを癒し、癒しの持続を残す
    PRIEST_MAKURABE: { name: "枕辺の祈り", mp: 5, kind: "heal", healMul: 0.9, healCap: 0.5, cure: ["sleep"], regen: { pct: 0.04, turns: 3 }, target: "ally", desc: "一人の傷を癒し、眠りを治して、しばらく癒しを残す" },
    PRIEST_GOKOU: { name: "後光", mp: 6, kind: "atk", power: 15, element: "light", debuff: { hit: 0.85 }, target: "all-enemy", desc: "後光で敵全体を灼き、目を眩ませる" },
    PRIEST_KEGAREOTOSHI: { name: "穢れ落とし", mp: 18, kind: "heal", healMul: 1, healCap: 0.5, cure: ["poison", "paralyze", "sleep"], purge: true, target: "all-ally", desc: "全員の毒・猛毒・麻痺・眠りと弱体を祓い、軽く癒す" },
  },
  perks: {
    priestShisso: { label: "質素な祈り", lv: ["回復の技・呪文の消費MP−10%", "回復の技・呪文の消費MP−18%"],
      fx: [{ t: "cost", on: "heal", v: [0.1, 0.18] }] },
    priestYoake: { label: "夜明けの祈り", scope: "party", lv: ["戦闘開始時、味方全員に毎ターン最大HP2%の癒し (3ターン)", "戦闘開始時、味方全員に毎ターン最大HP3.5%の癒し (3ターン)"],
      fx: [{ t: "start", party: true, regen: [0.02, 0.035], dur: 3 }] },
    priestTeate: { label: "手当ての心得", lv: ["回復の技・呪文の回復量+10%", "回復の技・呪文の回復量+20%"],
      fx: [{ t: "heal", v: [0.1, 0.2] }] },
    priestMitori: { label: "看取りの祈り", lv: ["倒れた味方がいる間、毎ラウンドMP3%回復", "倒れた味方がいる間、毎ラウンドMP5%回復"],
      fx: [{ t: "round", when: { allyDown: true }, mp: [0.03, 0.05] }] },
  },
};
