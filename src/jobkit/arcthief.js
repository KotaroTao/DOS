// 魔盗賊 (arcthief) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
export default {
  table: `
    1 STEAL 2 MAKEN_DARK 3 HALITO 4 SHADOWBOLT 5 openSpell/1 7 KAGEWATARI
    10 KATINO 12 FUYUU 15 chant/1 20 SEAL 25 spellCrit/1 30 MAHALITO
    32 DARKBLAST 35 extraHit/1 40 MARYOKUGOUDATSU 45 initiative/1 50 GENWAKU 55 DISPEL
    57 ARCTHIEF_MAREIJIN 60 ambushCrit/1 65 BLINDALL 70 spellCrit/2 72 DARKNESS 75 vitalEye/1
    80 SEISAI 85 ARCTHIEF_MAGANTSUKI 90 afterMp/1 95 RAITEI 100 MADALT 105 parry/1
    110 SEALALL 115 extraHit/2 120 ARCTHIEF_KUBIGARI 122 MEIKOKU 125 chant/2 130 HYORETSU
    135 spellCrit/3 140 SHUNSATSU 145 vitalEye/2 150 RAIJIN 155 resistAilment/1 160 GOKUEN
    165 soulEater/1 170 ARCTHIEF_JUSATSUJIN 175 parry/2 180 METEOR 185 elemFloor/1 190 ARCTHIEF_MATOUOUGI
    195 GOKUENRAN 200 KYOKUDAI`,
  skills: {
    // 魔盗賊は INT で伸びる職: 暗殺の技を魔力の刃で放つ (INT でも威力が伸びる)。盗賊の暗殺技と同じ消費・効果の並び
    ARCTHIEF_MAREIJIN:   { name: "魔霊刃", mp: 10, kind: "phys", power: 1.7, intScale: 0.5, element: "dark", mpDrain: 0.2, target: "enemy", desc: "魔力を纏った冥い刃で斬り、魔力を奪う（INTでも伸びる）" },
    ARCTHIEF_MAGANTSUKI: { name: "魔眼突き", mp: 5, kind: "phys", power: 1.0, intScale: 0.5, critBonus: 0.5, target: "enemy", desc: "魔眼で急所を見抜いて突く。会心が出やすい（INTでも伸びる）" },
    ARCTHIEF_KUBIGARI:   { name: "魔刃・首狩り", mp: 16, kind: "phys", power: 2.0, intScale: 0.5, critBonus: 0.3, execute: 2.5, target: "enemy", desc: "魔刃で弱った敵の首を刈る（とどめ・INTでも伸びる）" },
    ARCTHIEF_JUSATSUJIN: { name: "呪殺刃", mp: 28, kind: "phys", power: 3.4, intScale: 0.5, critBonus: 0.5, instakill: { chance: 0.3 }, target: "enemy", desc: "呪いを刻む刃。仕留め損ねても即死を狙う（主には効かない・INTでも伸びる）" },
    ARCTHIEF_MATOUOUGI:  { name: "魔盗奥義・影喰み", mp: 32, kind: "phys", power: 5.4, intScale: 0.5, critBonus: 0.5, execute: 2, target: "enemy", desc: "影ごと魔力で喰らう奥義。弱った敵を確実に葬る（INTでも伸びる）" },
  },
  perks: {},
};
