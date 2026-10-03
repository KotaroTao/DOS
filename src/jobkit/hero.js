// 勇者 (hero) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
export default {
  table: `
    1 KYOUGEKI 2 SHIPPUUGIRI 3 DIOS 5 smite/1 7 YUUSHANOICHIGEKI 10 BLESS
    12 KOUJIN 15 cover/1 20 KOBU 22 REPPUU 25 afterHeal/1 30 RAIKOUKEN
    35 extraHit/1 37 RAITEI 40 SEIKEN 45 vitalEye/1 50 DIOSALL 55 NIOUDACHI
    57 FUUGA 60 fightSpirit/1 65 SEIGEKI 70 holyEdge/1 75 cover/2 80 KIYOME
    85 REVIVE 90 resistAilment/1 95 SHINBATSU 100 HADAN 105 extraHit/2 107 KAMIKAZE
    110 AMATSUKAZE 115 endure/1 120 TENKOUKEN 125 sanctuary/1 130 DIALALL 135 martyr/1
    140 TENCHIZAN 142 GOURAI 145 mercy/1 150 KISHIOU 155 resistAilment/2 160 SEIKOURETSU
    165 holyCover/1 170 HAOUZAN 175 fightSpirit/2 180 DAIFUKUIN 185 extraHit/3 190 RAIJINKEN
    195 KAMIWAZA 200 TENMEINOKEN`,
  skills: {},
  perks: {},
};
