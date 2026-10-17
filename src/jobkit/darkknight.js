// 全職見直し: HPを代償にINTを乗せた闇剣を振るい、魔法で返す。ランクパッシブは維持。
// 魔騎士 (darkknight) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
// 持ち味: 闇の剣と魔障壁。身を削る暗黒剣で斬り、手負いになるほど凶暴に (闇/火)
export default {
  // ランクのパッシブ: 魂がランク2で目覚め、3・4・5で強まる (souls.js の JOB_PASSIVES)
  awaken: "dkKeiyaku",
  table: `
    1 SHIELDBASH 2 YAMIBA 3 NERAIUCHI 5 darkknightYaminoShouheki/1 7 ANKOKU 10 SHADOWBOLT
    12 CHOUHATSU 12 DARKKNIGHT_CHIYAMI 15 dkEnchant/1 18 KYUUKETSU 20 darkknightKaeshiba/1 22 KOKUEINAGI
    25 YAMINOKOROMO 30 darkknightKurokiBanpei/1 32 DARKBLAST 35 DARKKNIGHT_MAKOKU 40 MAGUINOTACHI 45 darkknightYaminoShouheki/2
    45 DARKKNIGHT_KOKUSHOU 50 dkEnchant/2 55 JUBAKU 57 MEIJIN 60 darkknightShikobami/1 60 DARKKNIGHT_KETSURUI
    70 darkknightTeoiMashou/1 75 resistAilment/1 75 darkknightKaeshiba/2 75 DARKKNIGHT_KUROGANE 80 HANGEKI 90 DARKKNIGHT_GOKUENMAKEN
    90 darkknightKurokiBanpei/2 100 dkEnchant/3 105 DARKKNIGHT_NARAKUSOU 107 DARKKNIGHT_YAMIKURAI 115 darkknightTeoiMashou/2 125 DARKKNIGHT_SHUKUMEI
    125 darkknightShikobami/2 130 DARKKNIGHT_KUROJOUSAI 135 darkknightTeoiMashou/3 135 darkknightKaeshiba/3 140 DARKKNIGHT_MEIOUKUSARI 145 resistAilment/2
    150 DARKKNIGHT_GOUMADAN 150 darkknightKurokiBanpei/3 160 ANKOKUSHUUEN 162 DARKKNIGHT_KOKUUZUGIRI 165 darkknightYaminoShouheki/3 170 DARKKNIGHT_RENGOKU
    180 DARKKNIGHT_ZANSHU 185 darkknightTeoiMashou/4 190 DARKKNIGHT_TOKOYO 195 DARKKNIGHT_MAJUN 200 DARKKNIGHT_KOKUTEN`,
  skills: {
    // 序盤の固有技: 身を削って闇をまとい、斬った血で傷を塞ぐ
    DARKKNIGHT_CHIYAMI: {name: "血闇の剣", mp: 5, kind: "phys", power: 1.4, intScale: 0.5, element: "dark", hpCost: 0.06, drain: 0.15, target: "enemy", desc: "HP6%を代償にINTを乗せた闇剣を振るい、与えた傷の15%を吸収する", dur: 3},
    DARKKNIGHT_KOKUSHOU: { name: "黒瘴の威圧", mp: 6, kind: "debuff", debuff: { atk: 0.85, hit: 0.9 }, target: "all-enemy", tech: true, desc: "黒い瘴気をまとい、敵全体の力と狙いを鈍らせる" },
    DARKKNIGHT_MAKOKU: { name: "魔刻の黒剣", mp: 14, kind: "phys", power: 3.2, intScale: 0.5, element: "dark", acc: 0.21, hpCost: 0.06, target: "enemy", desc: "刃に魔術を刻み、身を削って闇の剛剣を振るう（命中率+21%）" },
    DARKKNIGHT_KETSURUI: { name: "血涙の闇波", mp: 12, kind: "atk", power: 42, element: "dark", hpCost: 0.06, target: "all-enemy", desc: "HPを代償に、闇の波で敵全体を呑む" },
    DARKKNIGHT_KUROGANE: { name: "黒鉄断ち", mp: 16, kind: "phys", power: 3.4, intScale: 0.4, element: "dark", acc: 0.18, pierce: 0.5, vuln: { dark: 0.85 }, target: "enemy", desc: "闇の刃で鎧ごと断ち、闇に脆くする（物理貫通50%）" },
    DARKKNIGHT_GOKUENMAKEN: { name: "獄炎の魔剣", mp: 20, kind: "phys", power: 6.2, intScale: 0.5, element: "fire", acc: 0.18, hpCost: 0.08, target: "enemy", desc: "身を焦がし、獄炎をまとう魔剣を振るう" },
    DARKKNIGHT_YAMIKURAI: { name: "闇喰らいの刃", mp: 20, kind: "phys", power: 4.8, intScale: 0.4, element: "dark", acc: 0.16, mpDrain: 0.2, strip: true, target: "enemy", desc: "敵の加護ごと魔力を喰らう闇の刃" },
    DARKKNIGHT_NARAKUSOU: { name: "奈落の黒槍", mp: 30, kind: "atk", power: 94, element: "dark", debuff: { vit: 0.85 }, target: "enemy", desc: "奈落の闇を槍と成して穿ち、守りを崩す" },
    DARKKNIGHT_SHUKUMEI: { name: "宿命の黒剣", mp: 24, kind: "phys", power: 5.0, intScale: 0.5, element: "dark", acc: 1, desperate: true, target: "enemy", desc: "手負いほど冴える必中の黒剣" },
    DARKKNIGHT_KUROJOUSAI: { name: "黒鉄の城塞", mp: 26, kind: "buff", buff: { vit: 1.3 }, taunt: true, stance: "counter", ctrMul: 1.7, grantBarrier: 2, target: "self", tech: true, desc: "敵を引き付け、魔障壁と反撃の構えで迎え撃つ（攻撃力×1.7）" },
    DARKKNIGHT_MEIOUKUSARI: { name: "冥王の呪鎖", mp: 21, kind: "atk", power: 60, element: "dark", seal: { chance: 0.5, turns: 3 }, target: "enemy", desc: "冥王の鎖で穿ち、特技を封じる" },
    DARKKNIGHT_GOUMADAN: { name: "業魔断", mp: 28, kind: "phys", power: 7.0, intScale: 0.5, element: "fire", acc: 0.23, pierce: 0.4, target: "enemy", desc: "業火の魔力で鎧ごと断つ（命中率+23%）（物理貫通40%）" },
    DARKKNIGHT_KOKUUZUGIRI: { name: "黒渦斬り", mp: 27, kind: "phys", power: 2.2, intScale: 0.4, element: "dark", acc: 0.16, drain: 0.15, target: "all-enemy", desc: "闇の渦で敵陣を斬り、血を啜る" },
    DARKKNIGHT_RENGOKU: { name: "煉獄の黒炎", mp: 30, kind: "atk", power: 86, element: "fire", debuff: { vit: 0.9 }, target: "all-enemy", desc: "黒い煉獄の炎で敵全体を焼き、守りを溶かす" },
    DARKKNIGHT_ZANSHU: { name: "斬首の黒刃", mp: 32, kind: "phys", power: 8.6, intScale: 0.5, element: "dark", acc: 1, drain: 0.2, target: "enemy", desc: "必中の黒き大斬撃。血を啜って傷を癒す" },
    DARKKNIGHT_TOKOYO: { name: "常夜の帳", mp: 28, kind: "atk", power: 72, element: "dark", debuff: { hit: 0.85 }, target: "all-enemy", desc: "明けぬ夜の帳で敵全体を呑み、目を奪う" },
    DARKKNIGHT_MAJUN: { name: "魔盾の三連撃", mp: 24, kind: "phys", power: 1.2, vitScale: 1, hits: 3, element: "dark", acc: 0.23, seal: { chance: 0.35, turns: 2 }, target: "enemy", desc: "闇の盾で三度打ち、特技を封じる" },
    DARKKNIGHT_KOKUTEN: { name: "終焉・黒天", mp: 40, kind: "phys", power: 12, intScale: 0.6, element: "dark", acc: 1, pierce: 0.6, hpCost: 0.2, target: "enemy", desc: "身の二割を捧げる必中の闇の極剣（物理貫通60%）" },
  },
  perks: {
    darkknightYaminoShouheki: { label: "闇の障壁", lv: ["戦闘開始時、魔障壁を1回分まとう (ブレス・呪文半減)", "戦闘開始時、魔障壁を2回分まとう", "戦闘開始時、魔障壁を3回分まとう"],
      fx: [{ t: "start", barrier: [1, 2, 3] }] },
    darkknightKurokiBanpei: { label: "黒き番兵", lv: ["戦闘開始時に敵を引き付け (2ターン)、物理の被ダメ−5%", "開幕に引き付け、物理の被ダメ−8%", "開幕に引き付け、物理の被ダメ−11%", "開幕に引き付け、物理の被ダメ−14%"],
      fx: [{ t: "start", taunt: true, dur: 2 }, { t: "take", on: "phys", v: [0.05, 0.08, 0.11, 0.14] }] },
    darkknightKaeshiba: {
      label: "恨みの返し刃",
      lv: ["物理を受けるたび、INT×0.3の魔法の一撃で返す", "物理を受けるたび、INT×0.45の魔法の一撃で返す", "物理を受けるたび、INT×0.6の魔法の一撃で返す"],
      fx: [
        {t: "hurt", ret: {stat: "int", k: [0.3, 0.45, 0.6], magic: true}},
      ],
    },
    darkknightShikobami: { label: "死拒みの闇", lv: ["戦闘開始時50%で不屈 (致死をHP1で耐える) を得る。敵を倒すとHP5%回復", "戦闘開始時に必ず不屈を得る。敵を倒すとHP8%回復"],
      fx: [{ t: "start", chance: [0.5, 1], endure: true }, { t: "kill", hp: [0.05, 0.08] }] },
    darkknightTeoiMashou: { label: "手負いの魔性", lv: ["HP50%以下の時、STR+12%", "HP50%以下の時、STR+18%", "HP50%以下の時、STR+24%", "HP50%以下の時、STR+30%"],
      fx: [{ t: "stat", mul: { atk: [0.12, 0.18, 0.24, 0.3] }, when: { selfLow: 0.5 } }] },
  },
};
