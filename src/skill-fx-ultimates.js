// 職業の最終習得技専用。形・本数・方向を明示し、技IDから見た目を推測しない。
const rows = [
 ['METSUKYAKU','cut',1,-.7], ['FURAKUJOU','ward',4,0],
 ['KAMIWAZA','bloom',8,0], ['KYOKUDAI','collapse',12,0],
 ['ZANSEI','cut',5,-.4], ['BISHOP_SHINPAN','fall',7,0],
 ['SAMURAI_MUKYUU','cut',2,0], ['BERSERKER_SENKETSU','fracture',9,.3],
 ['HUNTER_HOSHIOTOSHI','fall',9,.35], ['SHADOW_MUEI','cut',6,.9],
 ['PALADIN_SEIKENKOURIN','cross',4,0], ['GUARDIAN_EIGOUJOUSAI','ward',6,.2],
 ['SPELLBLADE_KENKAI','cross',7,.4], ['KONGOUMUSOU','pulse',5,0],
 ['HEXER_BANJU','seal',9,.3], ['HERMIT_FUKUIN','bloom',6,.4],
 ['BRIGAND_HONKAI','fracture',5,.7], ['ARCTHIEF_BANSHOU','collapse',7,.4],
 ['CRUSADER_SEIJUUJI','cross',2,0], ['BATTLEMAGE_TENPOU','fracture',12,0],
 ['DARKKNIGHT_KOKUTEN','collapse',6,.7], ['TEMPLAR_ZETTAIKEKKAI','ward',8,0],
 ['EXORCIST_KENSHOU','seal',4,0], ['WARDEN_BANSHOU','seal',12,.2],
 ['ARCANIST_SHUUENSHO','seal',6,0], ['INQUISITOR_SHAMEN','bloom',4,.7],
 ['ARCHBISHOP_SHUUSHOU','bloom',12,.3], ['GONGENOROSHI','pulse',8,.5],
 ['TENMEINOKEN','cross',3,.7], ['RINNE','pulse',6,.2],
 ['RYUUTEIGEKI','fracture',3,-.7], ['NECROMANCER_SOUSOU','collapse',8,0],
 ['SAGE_SHUUKYOKU','seal',8,.5], ['CARDINAL_SEIZA','ward',12,.3],
 ['ARCHMAGE_BANSHOU','collapse',16,.2], ['CHAPLAIN_SEIGOJOU','ward',5,.5],
 ['SERA_SHINOTOMOSHIBI','bloom',3,0],
];
export const SKILL_FX_ULTIMATES=Object.freeze(Object.fromEntries(rows.map(([key,motif,count,angle])=>[key,Object.freeze({motif,count,angle})])));
