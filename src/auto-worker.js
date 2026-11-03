// 作戦の予測だけを別スレッドで行う。戦闘の確定や乱数は触らない。
import { Battle, setElemKnown, setPartyHitBonus, setPartyEvadeBonus, setPartyBreathBonus, setPartyAilBonus } from './combat.js';
import { decideAuto, setResistKnown } from './autotactics.js';
import { refDeserialize } from './savegraph.js';
self.onmessage=({data})=>{
 try{
  const {battle:b,actor,context,allowed}=refDeserialize(data.snapshot);
  Object.setPrototypeOf(b,Battle.prototype);
  b.party.forEach((a,i)=>{a.spells=allowed[i];a.skillOrder=null;a.skillOff=null;a.autoOff=null;});
  setElemKnown(e=>context.element.includes(e.uid));setResistKnown(e=>context.resist.includes(e.uid));
  setPartyHitBonus(context.hit);setPartyEvadeBonus(context.evade);setPartyBreathBonus(context.breath);setPartyAilBonus(context.ail);
  const plan=decideAuto(b,actor);
  self.postMessage({id:data.id,plan:plan&&{...plan,target:undefined,targetSide:plan.target?.side,targetUid:plan.target?.uid}});
 }catch(error){self.postMessage({id:data.id,error:String(error)});}
};
