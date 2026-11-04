import { refSerialize, refDeserialize } from './savegraph.js';
import { autoSkills } from './souls.js';
import { Battle, autoEstimateContext } from './combat.js';
let worker=null,serial=0,failed=false;
const pending=new Map();
let prepared = null;
function disableWorker(error){
 failed=true;worker?.terminate();worker=null;
 for(const task of pending.values()){clearTimeout(task.timer);task.reject(error);}pending.clear();
}
export const autoPlannerStats={worker:0,fallback:0,lastError:null,prefetched:0,reused:0,discarded:0};
export function warmAutoPlanner(){
 if(worker||failed||typeof Worker==='undefined')return;
 try{
  worker=new Worker(new URL('./auto-worker.js',import.meta.url),{type:'module'});
  worker.onmessage=({data})=>{const task=pending.get(data.id);if(!task)return;pending.delete(data.id);clearTimeout(task.timer);data.error?task.reject(Error(data.error)):task.resolve(data.plan);};
  worker.onerror=()=>disableWorker(Error('作戦の計算を再開'));
 }catch{failed=true;}
}
// プロパティの挿入順に依存せず、共有参照を含む入力全体を比較する。
// 絵の読込状態と安定度の回復時計は作戦に使わず変化するため、写しからも除く。
function inputOf(b, actor, resistKnown) {
 const root={battle:b,actor,allowed:b.party.map(a=>autoSkills(a)),context:{...autoEstimateContext(b.enemies),resist:b.enemies.filter(resistKnown).map(e=>e.uid)}};
 const seen=new Map();
 function copy(value){
  if(value==null||typeof value!=='object')return value;
  if(seen.has(value))return seen.get(value);
  const out=Array.isArray(value)?[]:{};seen.set(value,out);
  for(const key of Object.keys(value).sort())if(key!=='photo'&&key!=='stabilityAt'&&typeof value[key]!=='function')out[key]=copy(value[key]);
  return out;
 }
 const snapshot=refSerialize(copy(root));
 return {snapshot,key:JSON.stringify(snapshot)};
}
function requestPlan(snapshot){
 const id=++serial;
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{pending.delete(id);reject(Error('作戦の計算待ち'));},3000);
  pending.set(id,{resolve,reject,timer});worker.postMessage({id,snapshot});
 }).then(plan=>{autoPlannerStats.worker++;return plan;});
}
function liveTarget(b,plan){
 if(!plan)return plan;
 return {...plan,target:plan.targetUid==null?undefined:[...b.party,...b.enemies].find(e=>e.uid===plan.targetUid&&e.side===plan.targetSide)};
}
export function discardAutoPlan(){
 if(prepared)autoPlannerStats.discarded++;
 prepared=null;
}
// 先読み失敗時は演出中の主スレッドで再計算しない。実際の手番で通常経路へ戻す。
export function prefetchAuto(b,actor,resistKnown,owner=b){
 discardAutoPlan();warmAutoPlanner();
 if(!worker||b.phase!=='input'||b.result)return;
 const {snapshot,key}=inputOf(b,actor,resistKnown);
 const task={owner,key,promise:requestPlan(snapshot).catch(error=>{
  disableWorker(error);autoPlannerStats.lastError=String(error);return null;
 })};
 prepared=task;autoPlannerStats.prefetched++;
}
// ローカルは、乱数・ターン更新・敵行動を伴わない次の味方の手番だけ準備する。
export function previewAutoBattle(b){
 if(b.result)return null;
 const next=b.queue.find(a=>a?.alive&&!(a.side==='enemy'&&b._enemyStopRound===b._roundNo));
 if(!next||next.side!=='party'||next.asleep||next.mind||['paralyze','stone'].includes(next.ailment))return null;
 const copy=refDeserialize(refSerialize(b));Object.setPrototypeOf(copy,Battle.prototype);
 copy._acted=false;copy.advance();return copy;
}
export async function planAuto(b,actor,resistKnown,fallback){
 warmAutoPlanner();if(!worker){discardAutoPlan();autoPlannerStats.fallback++;return fallback();}
 try{
  const {snapshot,key}=inputOf(b,actor,resistKnown),cached=prepared;
  prepared=null;
  let plan;
  if(cached?.owner===b&&cached.key===key){
   plan=await cached.promise;
   if(plan)autoPlannerStats.reused++;
  }else if(cached)autoPlannerStats.discarded++;
  if(!plan){
   if(!worker){autoPlannerStats.fallback++;return fallback();}
   plan=await requestPlan(snapshot);
  }
  return liveTarget(b,plan);
 }catch(error){disableWorker(error);autoPlannerStats.fallback++;autoPlannerStats.lastError=String(error);return fallback();}
}
