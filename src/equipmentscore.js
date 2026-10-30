import { weaponRange } from "./items.js";
// 最適装備用の戦闘効果の見積もり。特定の敵を想定せず、同じ条件で付け替え前後を比べる。
import { ELEMENT_KEYS, elementValues, elementDefenseReduction, hitChance, permanentMultiplier, procChance, luckCritBonus } from "./combatrules.js";
import { SPELLS } from "./skilldefs.js";
import { AIL_RESIST_KINDS } from "./resistance.js";
const cap = (v,n) => Math.min(n,Math.max(0,v || 0));
const value = (v,lv) => Array.isArray(v) ? v[Math.min(v.length,lv)-1] || 0 : v || 0;
const average = a => a.reduce((s,v)=>s+v,0) / Math.max(1,a.length);
// 条件なし/条件成立の2通りを平均。武魂の合計上限は成立した効果だけへ適用する。
const effect = (m,type,on) => average([false,true].map(active=>{
  let normal=0,best=0,bukon=0,uncapped=0;
  for(const {c,lv} of m.gearPerks || []) {
    if(c.t!==type || c.on && c.on!==on || (c.when || c.holder) && !active)continue;
    const v=value(c.v,lv);
    if(c.bukon){if(c.uncapped)uncapped+=v;else bukon+=v;}
    else if(c.best)best=Math.max(best,v);else normal+=v;
  }
  return normal+best+uncapped+Math.min(({deal:1,take:.8,crit:.8,heal:1})[type]??Infinity,bukon);
}));
export function equipmentCombatState(m, source=m) {
  const passive=source.passiveMap || {};
  const spellCrit=[0,.10,.18,.26][Math.min(3,passive.spellCrit || 0)] || 0;
  const arc=[0,.05,.08,.12,.20][Math.min(4,passive.arcanistShinen || 0)] || 0;
  const res={...m.resists};
  // 異常耐性・隠修士の守りは実戦と同じく加算して95%で止める。
  const ailBase=passive.resistAilment>=2 ? .6 : passive.resistAilment ? .3 : 0;
  const hardBase=passive.resistAilment>=2 ? .3 : 0;
  const hermit=[0,.1,.2,.3][Math.min(3,passive.hermitZokusei || 0)] || 0;
  for(const k of AIL_RESIST_KINDS) res[k]=m.eff?.ailmentImmune ? 95 : cap((res[k] || 0)+100*((['stone','death'].includes(k)?hardBase:ailBase)+hermit),95);
  const proc={};
  for(const o of m.onHit || []) proc[o.k]=(proc[o.k] || 0)+o.chance;
  for(const {c,lv} of m.gearPerks || []) if(c.t==='hit'&&c.ail) {
    const k=c.ail==='para'?'paralyze':c.ail;
    if(AIL_RESIST_KINDS.includes(k)) proc[k]=(proc[k] || 0)+(c.chance==null?1:value(c.chance,lv));
  }
  if (passive.venomBlade) proc.poison=(proc.poison || 0)+(passive.venomBlade>=2?.3:.15);
  const hex=[0,.05,.1,.15,.25][Math.min(4,passive.hexerSae || 0)] || 0;
  for (const k in proc) proc[k]=(proc[k]+hex)*(k!=="death"&&m.gearMisc?.binder?1.5:1);
  const spellElements={};
  for(const key of source.spells || []) {
    const sp=SPELLS[key];
    if(sp?.kind==='atk'&&!sp.gravity&&sp.element&&sp.element!=='none') spellElements[sp.element]=1;
  }
  const physicalCrit=cap(.06+luckCritBonus(m.luk)+(m.critBonus || 0)+effect(m,'crit','phys'),.8);
  return {
    // 隊列は採点時に現在の編成から決める。踏み込みは付け替え前後それぞれの装備を見る。
    backRowMul: weaponRange(m.equip?.weapon) !== "near" || m.gearMisc?.stepIn ? 1 : Math.min(1, .5 + (m.gearMisc?.bk_stepIn || 0)),
    primaryPower:m.primaryPower ?? m.power ?? m.atk ?? 0,
    hp:m.maxhp || 0, spellPower:Math.max(m.int || 0,m.pie || 0), power:m.fight ?? m.power ?? m.atk ?? 0,
    attackElement:m.attackElement || 'none',offAttackElement:m.offAttackElement || 'none',
    elements:elementValues(m.elemAtk),defense:elementValues(m.elemDef,'defense'),reductions:{...m.elemDef?.reductions},res,proc,spellElements,
    evade:cap(.1+(m.evadeBonus || 0)+(passive.parry>=2 ? .15 : passive.parry ? .1 : 0)+effect(m,'evade'),.8),
    guard:m.eff?.guard || 0,breath:m.breathRes || 0,physicalCrit,
    spellCrit:cap(spellCrit+arc+(m.spellCritBonus || 0)+(m.gearMisc?.sae ? .15 : 0),.8),
    critDamage:m.critDamageBonus || 0,spellCritDamage:m.spellCritDamageBonus || 0,
    physicalCritMul:1.85*(1+(m.critDamageBonus || 0))*(1+([0,.2,.3,.4,.5][Math.min(4,passive.shadowHissatsu || 0)] || 0))*([1,1.25,1.45][Math.min(2,passive.vitalEye || 0)] || 1),
    spellCritMul:1.5*(1+(m.spellCritDamageBonus || 0))*(m.gearMisc?.sae?1.3:1),
    take:{phys:effect(m,'take','phys'),magic:effect(m,'take','spell'),breath:effect(m,'take','breath')},
    deal:{phys:effect(m,'deal','phys'),magic:effect(m,'deal','spell')},
  };
}
export function equipmentIncoming(s) {
  if(!s) return 1;
  // 物理40%・呪文40%・ブレス20%、無属性を含む7属性を均等に想定。回数制の壁は別評価。
  return average(['none',...ELEMENT_KEYS].map(el => {
    const er=el==='none'?0:elementDefenseReduction(el,{values:s.defense,reductions:s.reductions});
    const mode=(key,on,breath=false)=>permanentMultiplier([1-cap(s.res[key]/100,.8),1-er,1-cap(s.guard,.9),Math.max(.2,1-(s.take[on] || 0)),breath?1-cap(s.breath,.5):1]);
    return .4*hitChance(1,s.evade ?? .1)/.9*mode('physResist','phys')+.4*mode('magResist','magic')+.2*mode('magResist','breath',true);
  }));
}
const procValue = s => Object.entries(s.proc).reduce((total,[k,power])=>total+average([0,.5,.8,.95].map(r=>procChance(power,r)))*(k==='poison'?.8:1),0);
const ailValue = s => AIL_RESIST_KINDS.reduce((v,k)=>v+cap(s.res[k]/100,.95),0);
export function equipmentPercentScore(from,to,{weaponShare=.5,hpWeight=.25,magicWeight=1}={}) {
  if(!from||!to)return {offense:0,points:0};
  const attribute=s=>{
    const main=1+(s.elements[s.attackElement] || 0)/100,off=1+(s.elements[s.offAttackElement] || 0)/100;
    return s.power>0?(main*s.primaryPower+off*Math.max(0,s.power-s.primaryPower))/s.power:main;
  };
  const phys=s=>attribute(s)*(1+s.physicalCrit*(s.physicalCritMul-1))*(1+(s.deal.phys || 0));
  const mag=s=>{
    const els=Object.keys(s.spellElements);
    if(!els.length)return 1;
    return average(els.map(k=>1+(s.elements[k] || 0)/100))*(1+s.spellCrit*(s.spellCritMul-1))*(1+(s.deal.magic || 0));
  };
  // 物理の割合効果は攻撃力へ換算し、武器の付け替えでも同じ重みで評価する。
  const offense=(to.power*(phys(to)-1)-from.power*(phys(from)-1))*weaponShare
    +Math.max(1,to.power)*(procValue(to)-procValue(from))*.2*weaponShare;
  const magic=(to.spellPower*(mag(to)-1)-from.spellPower*(mag(from)-1))*(1-weaponShare)*magicWeight;
  const defense=(to.hp*(1/equipmentIncoming(to)-1)-from.hp*(1/equipmentIncoming(from)-1))*.35*hpWeight;
  return {offense,points:magic+defense+(ailValue(to)-ailValue(from))*10};
}
