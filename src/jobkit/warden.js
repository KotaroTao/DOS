// 護法師 (warden) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
export default {
  table: `
    1 PROTECT 2 ISHITSUBUTE 3 SEAL 5 barrier/1 7 BLIND 10 ICENEEDLE
    12 AQUAWAVE 15 afterMp/1 20 GUARDALL 22 EARTHQUAKE 25 chant/1 30 ROCKBLAST
    35 scan/1 40 KOUSHUNOHOUJIN 45 barrier/2 47 ICELANCE 50 SEALALL 55 GRAVITY
    60 bigBarrier/1 62 LANDSLIDE 65 MADALT 70 spellCrit/1 75 resistAilment/1 80 BOUJIN
    85 ELEMBREAK 90 reflect/1 95 DISPEL 100 SHUGOKEKKAI 102 DAICHIWARI 105 chant/2
    110 HYORETSU 115 bastion/1 120 OUJOU 125 afterMp/2 130 GRAVIGA 135 spellCrit/2
    140 METEOR 145 bigBarrier/2 150 FURAKUNOTATE 155 resistAilment/2 160 HYOUGA 165 sanctuary/1
    170 DAIKEKKAI 172 GANSAI 175 holyCover/1 180 TENPENCHII 185 elemFloor/1 190 ZETTAIREIDO
    195 SEISAI 200 KYOKUDAI`,
  skills: {},
  perks: {},
};
