// 司教 (bishop) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
export default {
  table: `
    1 kantei/2 3 DIOS 4 HOLYRAY 5 afterMp/1 7 ICENEEDLE 10 CURE
    15 afterBoth/1 20 SEAL 22 AQUAWAVE 25 scan/1 30 DIAL 35 chant/1
    40 MADIOS 45 afterHeal/1 47 ICELANCE 50 DIOSALL 55 DISPEL 60 spellCrit/1
    65 MADALT 70 purify/1 75 afterBoth/2 80 MANAGIFT 85 SAINTRAY 90 afterMp/2
    95 DIALALL 100 HYORETSU 105 chant/2 110 REVIVE 115 spellCrit/2 120 SEALALL
    125 selfPurify/1 130 IYASHINAMI 132 HYOUGA 135 afterHeal/2 140 SEISAI 145 resistAilment/1
    150 KIYOME 155 elemFloor/1 160 RESURRECT 165 resistAilment/2 170 SHINBATSU 172 ZETTAIREIDO
    175 barrier/1 180 DAIFUKUIN 185 sanctuary/1 190 SEIMETSUREKKOU 195 SEIKOURETSU 200 KYOKUDAI`,
  skills: {},
  perks: {},
};
