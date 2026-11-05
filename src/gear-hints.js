import { isAutoCandidate } from './autoequip.js';
import { isFormationItem } from './items.js';
import { refSerialize } from './savegraph.js';
import { traceSync } from './battle-trace.js';
export const gearHintStats={requests:0,completed:0,cancelled:0,failed:0};
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
 let values=new Map();
 function cancel(){if(job){gearHintStats.cancelled++;worker?.terminate();worker=null;job=null;}}
 function run(){
  timer=null;const s=source();if(!s||s.paused){cancel();return;}if(disabled||job)return;
  const key=traceSync('gearHints.key',()=>gearHintKey(s.pool,s.targets));if(key===lastKey)return;
  try{
   if(!worker){
    worker=new Worker(new URL('./gear-hint-worker.js',import.meta.url),{type:'module'});
    worker.onmessage=({data})=>{
     if(!job||data.id!==job.id)return;
     const done=job;job=null;const now=source();
     if(data.error){fail();return;}
     if(!now||now.paused||gearHintKey(now.pool,now.targets)!==done.key){gearHintStats.cancelled++;schedule();return;}
     values=new Map(data.values);lastKey=done.key;gearHintStats.completed++;changed();
    };
    worker.onerror=fail;
   }
   job={id:++sequence,key};gearHintStats.requests++;
   traceSync('gearHints.snapshot',()=>worker.postMessage({id:job.id,snapshot:refSerialize({pool:s.pool,targets:s.targets},{omit:(o,k)=>k==='photo'})}));
  }catch{fail();}
 }
 function fail(){gearHintStats.failed++;disabled=true;worker?.terminate();worker=null;job=null;}
 function schedule(){if(timer===null&&!disabled)timer=setTimeout(run,250);}
 return {
  read(d){schedule();return !!d?.alive&&!!values.get(d.uid);},
  pause(){cancel();},
  seed(d,value){values.set(d.uid,!!value);lastKey='';},
 };
}
