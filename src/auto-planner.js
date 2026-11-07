import { refSerialize } from './savegraph.js';
import { autoSkills } from './souls.js';
import { autoEstimateContext } from './combat.js';
let worker=null,serial=0,failed=false;
const pending=new Map();
function disableWorker(error){
 failed=true;worker?.terminate();worker=null;
 for(const task of pending.values()){clearTimeout(task.timer);task.reject(error);}pending.clear();
}
export function warmAutoPlanner(){
 if(worker||failed||typeof Worker==='undefined')return;
 try{
  worker=new Worker(new URL('./auto-worker.js',import.meta.url),{type:'module'});
  worker.onmessage=({data})=>{const task=pending.get(data.id);if(!task)return;pending.delete(data.id);clearTimeout(task.timer);data.error?task.reject(Error(data.error)):task.resolve(data.plan);};
  worker.onerror=()=>disableWorker(Error('作戦の計算を再開'));
 }catch{failed=true;}
}
export async function planAuto(b,actor,resistKnown,fallback){
 warmAutoPlanner();if(!worker){return (fallback)();}
 try{
 // 技の解放条件は端末側で評価してから、共有参照を保って複製する。
 const allowed=b.party.map(a=>autoSkills(a));
 // 作戦は所持品の使用・装備変更を選ばず、絵も参照しない。複製前に除外し、
 // 袋が大きくても、その中身の走査・Workerへの転送・復元を発生させない。
 const actors=new Set(b.party);
 const snapshot=refSerialize({battle:b,actor,allowed,context:{...autoEstimateContext(b.enemies),resist:b.enemies.filter(resistKnown).map(e=>e.uid)}},
  {omit:(object,key)=>key==='photo'||(key==='items'&&actors.has(object))});


 const id=++serial;
  const plan=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(Error('作戦の計算待ち'));},3000);pending.set(id,{resolve,reject,timer});(worker.postMessage({id,snapshot}));});

  if(plan?.targetUid!=null)plan.target=[...b.party,...b.enemies].find(e=>e.uid===plan.targetUid&&e.side===plan.targetSide);
  return plan;
 }catch(error){disableWorker(error);return (fallback)();}
}
