// 狩人 (hunter) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
export default {
  table: `
    1 DOKUYA 2 SUIGETSU 3 ASHIDOME 5 ambushCrit/1 7 SOGEKI 10 YANOAME
    12 ABURA 15 vitalEye/1 20 SHIBIREYA 22 REPPUU 25 extraHit/1 30 KEMONOGARI
    35 initiative/1 40 KUBIKARI 45 extraHit/2 50 TSURANUKI 55 SHIPPUTSUKI 57 FUUGA
    60 vitalEye/2 65 ZETSUEI 70 parry/1 75 senseEnemy/1 80 HYOUJIN 82 RENSHA
    85 KUBIHANE 90 extraHit/3 95 SENNYA 100 TOUGADAN 105 sleepKill/1 110 SHUNSATSU
    115 parry/2 120 KAMIKAZE 125 vigilance/1 130 SENKOUZAN 135 extraHit/4 140 ANSATSU
    145 fleetFoot/1 150 ZANKOU 155 vigilance/2 160 RYUUSEISHA 162 TENRAN 165 resistAilment/1
    170 HISSATSU 175 zanshin/1 180 TSUMUJIKAZE 185 venomBlade/1 190 MUGEN 195 DAIKAISHOU
    200 ZANSEI`,
  skills: {},
  perks: {},
};
