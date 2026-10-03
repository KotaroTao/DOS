// 義賊 (brigand) の技・パッシブ。table = 習得表 (「Lv 技キー」/「Lv パッシブキー/Lv」)。
// skills = この職の固有技 (skilldefs.js の SPELLS に合流) / perks = この職の固有パッシブ (souls.js の PASSIVES に合流、効果は fx)
export default {
  table: `
    1 KYOUGEKI 2 STEAL 3 SUIGETSU 5 goldLuck/1 7 SUNAKAKE 10 KEMURIDAMA
    12 YAMIBA 15 appraise/1 20 ASHIBARAI 22 UZUSHIO 25 ambushCrit/1 30 MAKIBISHI
    35 extraHit/1 40 OIHAGI 45 vitalEye/1 50 ASSASSINATE 55 POISONSTAB 57 HYOUJIN
    60 goldLuck/2 65 TSUJIKAZE 70 parry/1 75 soulLure/1 80 SHIPPUTSUKI 85 MOUDOKUSASHI
    90 extraHit/2 95 KAGEUCHI 100 KUBIHANE 105 vitalEye/2 107 TOUGADAN 110 RANBUTSUKI
    115 fleetFoot/1 120 SHUNSATSU 125 parry/2 130 SENKOUZAN 135 extraHit/3 140 ANSATSU
    145 vigilance/1 150 TSUMUJIKAZE 155 zanshin/1 160 ZANKOU 162 DAIKAISHOU 165 resistAilment/1
    170 HISSATSU 175 extraHit/4 180 MUGEN 185 vigilance/2 190 TENKAGOMEN 195 TOKOYAMI
    200 ZANSEI`,
  skills: {},
  perks: {},
};
