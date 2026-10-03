// 暗殺者 (shadow) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
export default {
  table: `
    1 YAMIUCHI 2 YAMIBA 3 POISONSTAB 5 ambushCrit/1 7 SHIPPUUGIRI 10 KAGEWATARI
    12 YOIYAMIUCHI 15 sleepKill/1 20 KAGENUI 22 KOKUEINAGI 25 vitalEye/1 30 ASSASSINATE
    35 extraHit/1 40 SHINOKOKUIN 45 parry/1 50 MOUDOKUSASHI 55 SHIBIREBARI 57 MEIJIN
    60 venomBlade/1 65 ZETSUEI 70 initiative/1 75 vitalEye/2 80 KUBIHANE 85 KAGEUCHI
    90 extraHit/2 95 SHUNSATSU 100 TSUJIKAZE 105 parry/2 107 MEIFUZAN 110 RANBUTSUKI
    115 vigilance/1 120 ANSATSU 125 venomBlade/2 130 ZANKOU 135 extraHit/3 140 SENKOUZAN
    145 fleetFoot/1 150 KAMIKAZE 155 vigilance/2 160 HISSATSU 162 TOKOYAMI 165 resistAilment/1
    170 TSUMUJIKAZE 175 zanshin/1 180 MUGEN 185 extraHit/4 190 MEIDOU 195 TENRAN
    200 ZANSEI`,
  skills: {},
  perks: {},
};
