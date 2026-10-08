// 僧侶 (priest) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
// 持ち味: 素朴な癒しの基本。村の僧が枕元で祈るような、質素で粘り強い手当て (蘇生は身を削ってでも)
export default {
  // ランクのパッシブ: 魂がランク2で目覚め、3・4・5で強まる (souls.js の JOB_PASSIVES)
  awaken: "priestInochi",
  table: `
    1 DIOS 3 CURE 5 HOLYRAY 7 PRIEST_SHIBIREBARAI 10 PRIEST_MEZAMESASOI 15 PRIEST_MAKURABE 15 fieldRegen/1
    17 PRIEST_MAYOIBARAI 20 PRIEST_SHOUSHIN 25 REVIVE 30 PRIEST_ISHIHODOKI 35 chant/1 40 DIALALL
    45 purify/1 50 PRIEST_MIYOGI 50 fieldRegen/2 55 PRIEST_MEZAME 60 afterHeal/3 65 PRIEST_TEATE 70 resistAilment/1
    75 priestShisso/1 80 PRIEST_SHINMYOU 85 PRIEST_KEGAREOTOSHI 90 afterHeal/4 95 SHINYU 100 SEIBETSU 100 fieldRegen/3
    105 chant/2 110 IYASHINAMI 115 priestYoake/1 120 REGENALL 125 resistAilment/2 130 SHINBATSU
    135 priestTeate/1 140 SEISUISHO 145 priestMitori/1 150 TENKEINOINORI 155 priestShisso/2 160 SEIMETSUKOU
    165 priestYoake/2 170 FUKUIN 175 priestTeate/2 180 SEIKOURETSU 185 DAISEIKITOU 190 DAIFUKUIN
    195 priestMitori/2 200 KAMIWAZA`,
  skills: {
    PRIEST_SHIBIREBARAI: { name: "しびれ祓い", mp: 3, kind: "cure", cure: ["paralyze"], target: "ally", desc: "味方一人の麻痺を治す" },
    PRIEST_MEZAMESASOI: { name: "目覚めの呼び声", mp: 3, kind: "cure", cure: ["sleep"], target: "ally", desc: "味方一人の眠りを治す" },
    PRIEST_MAYOIBARAI: { name: "迷い祓い", mp: 3, kind: "cure", cure: ["charm"], target: "ally", desc: "味方一人の魅了を治す" },
    PRIEST_SHOUSHIN: { name: "正心の祈り", mp: 3, kind: "cure", cure: ["confuse"], target: "ally", desc: "味方一人の混乱を治す" },
    PRIEST_ISHIHODOKI: { name: "石ほどきの祈り", mp: 5, kind: "cure", cure: ["stone"], target: "ally", desc: "味方一人の石化を治す" },
    PRIEST_MIYOGI: { name: "身清めの祈り", mp: 6, kind: "cure", cure: ["poison", "paralyze", "stone"], target: "ally", desc: "味方一人の毒・猛毒・麻痺・石化を治す" },
    // Lv15 の固有技: 傷と眠りを癒し、癒しの持続を残す
    PRIEST_MAKURABE: { name: "枕辺の祈り", mp: 4, kind: "heal", power: 10, cure: ["sleep"], regen: { pct: 0.04, turns: 3 }, target: "ally", desc: "一人の傷を癒し、眠りを治して、しばらく癒しを残す" },
    PRIEST_GOKOU: { name: "後光", mp: 6, kind: "atk", power: 15, element: "light", debuff: { hit: 0.85 }, target: "all-enemy", desc: "後光で敵全体を灼き、目を眩ませる" },
    PRIEST_MEZAME: { name: "目覚めの祈り", mp: 8, kind: "heal", power: 0, revive: true, revivePct: 0.4, regen: { pct: 0.05, turns: 3 }, target: "ally", desc: "倒れた者をHP40%で起こし、癒しを残す" },
    PRIEST_TEATE: { name: "手当ての祈り", mp: 8, kind: "heal", power: 50, revive: true, cure: ["poison", "paralyze", "sleep"], target: "ally", desc: "一人の傷と毒・猛毒・麻痺・眠りを癒す。倒れた者も起こす" },
    PRIEST_SHINMYOU: { name: "身命の祈り", mp: 10, kind: "heal", power: 0, revive: true, revivePct: 1, hpCost: 0.15, target: "ally", desc: "己の命を削り、倒れた者を完全に呼び戻す" },
    PRIEST_KEGAREOTOSHI: { name: "穢れ落とし", mp: 9, kind: "heal", power: 10, cure: ["poison", "paralyze", "sleep"], purge: true, target: "all-ally", desc: "全員の毒・猛毒・麻痺・眠りと弱体を祓い、軽く癒す" },
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
