import { isAutoCandidate } from './autoequip.js';
import { isFormationItem } from './items.js';
import { refSerialize } from './savegraph.js';

// 参照の置き換えやHP/MPの変化で無効化しない。袋の共有と空き枠は保持する。
export function gearHintKey(pool,targets){
 const bags=new Map();
 return JSON.stringify([pool.map(d=>{
  const bag=d.items||[];if(!bags.has(bag))bags.set(bag,bags.size);
  return [d.uid,bags.get(bag),d.equip];
 }),[...bags.keys()].map(b=>[b.filter(it=>it&&!isFormationItem(it)).length,b.filter(isAutoCandidate)]),
 targets.map(d=>[d.uid,d.alive,d.primary,d.base,d.equip,d.jobLv,d.level,d.jobKey,d.clsKey,d.align,d.dualWield,d.atk,d.vit,d.agi,d.int,d.pie,d.luk,d.maxhp,d.maxmp])],(key,value)=>{
  if(value&&typeof value==='object'&&!Array.isArray(value))return Object.fromEntries(Object.keys(value).sort().filter(k=>value[k]!=null&&typeof value[k]!=='function'&&k!=='photo').map(k=>[k,value[k]]));
  return value;
 });
}
export function createGearHints(source,changed){
 let worker=null,timer=null,job=null,sequence=0,lastKey='',disabled=false;
 let values=new Map(),slots=new Map();
 const keyOf=s=>gearHintKey(s.pool,s.targets)+JSON.stringify([s.slotTargets||[],s.slotTargets?.length?s.pool.map(d=>d.items):null]);
 function cancel(){if(job){worker?.terminate();worker=null;job=null;}}
 function run(){
  timer=null;const s=source();if(!s||s.paused){cancel();return;}if(disabled||job)return;
  const key=(keyOf(s));if(key===lastKey)return;
  try{
   if(!worker){
    worker=new Worker(new URL('./gear-hint-worker.js',import.meta.url),{type:'module'});
    worker.onmessage=({data})=>{
     if(!job||data.id!==job.id)return;
     const done=job;job=null;const now=source();
     if(data.error){fail();return;}
     if(!now||now.paused||keyOf(now)!==done.key){schedule();return;}
     values=new Map(data.values);slots=new Map(data.values.map(([uid,,detail])=>[uid,detail]));lastKey=done.key;changed();
    };
    worker.onerror=fail;
   }
   job={id:++sequence,key};
   (worker.postMessage({id:job.id,snapshot:refSerialize({pool:s.pool,targets:s.targets,slotTargets:s.slotTargets||[]},{omit:(o,k)=>k==='photo'})}));
  }catch{fail();}
 }
 function fail(){disabled=true;worker?.terminate();worker=null;job=null;}
 function schedule(){if(timer===null&&!disabled)timer=setTimeout(run,250);}
 return {
  read(d){schedule();return !!d?.alive&&!!values.get(d.uid);},
  slot(d,k){schedule();return slots.get(d.uid)?.[k]||{count:0,better:false,bestGain:0};},
  pause(){cancel();},
  seed(d,value){values.set(d.uid,!!value);slots.delete(d.uid);lastKey='';},
 };
}
