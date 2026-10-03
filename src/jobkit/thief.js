// 盗賊 (thief) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
export default {
  table: `
    1 kantei/1 2 STEAL 3 POISONSTAB 5 ambushCrit/1 7 SHIPPUUGIRI 10 KEMURIDAMA
    12 SUNAKAKE 15 extraHit/1 20 KASUMEGIRI 22 SHIBIREBARI 25 vitalEye/1 30 ASSASSINATE
    35 extraHit/2 40 OBORO 45 parry/1 50 MEIJIN 55 MAKIBISHI 57 FUUGA
    60 venomBlade/1 65 TSUJIKAZE 70 sleepKill/1 75 initiative/1 80 ZETSUEI 85 SHIPPUTSUKI
    90 extraHit/3 95 ENGETSUJIN 100 MOUDOKUSASHI 105 vitalEye/2 107 KAMIKAZE 110 KAGEUCHI
    115 venomBlade/2 120 KUBIHANE 125 parry/2 130 RANBUTSUKI 135 extraHit/4 140 SHUNSATSU
    145 zanshin/1 150 TSUMUJIKAZE 155 vigilance/1 160 ZANKOU 162 TENRAN 165 vigilance/2
    170 ANSATSU 175 senseEnemy/1 180 SENKOUZAN 185 fleetFoot/1 190 HISSATSU 195 MUGEN
    200 ZANSEI`,
  skills: {},
  perks: {},
};
