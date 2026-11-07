// 5秒以上の戦闘待ちだけを端末に残す。セーブ本文・名前・認証・通信本文は扱わない。
import { APP_VERSION } from './game-update.js';
const KEY='dos-action-wait-v1',LIMIT=8,THRESHOLD=5000;
const active=new Map(),recent=[];
let reader=null,timer=null,lastProgress=0,lastTick=0,maxLag=0,serial=0,incident=null,visibilityInstalled=false,lastCapture=0,history=null;
const clock=()=>performance.now();
const noop=()=>{};
function stored(){if(history)return history;try{const v=JSON.parse(localStorage.getItem(KEY)||'[]');history=Array.isArray(v)?v.slice(-LIMIT):[];}catch{history=[];}return history;}
function persist(value){history=value;try{localStorage.setItem(KEY,JSON.stringify(value));}catch{/* 保存領域が使えなくてもゲームは止めない。 */}}
function state(){try{return reader?.()||{};}catch{return {};}}
function remember(event){recent.push(event);if(recent.length>60)recent.shift();}
function capture(now,trigger='watchdog'){
  const s=state();
  if(now-lastProgress<THRESHOLD||!s.expected||s.paused||globalThis.document?.hidden)return;
  if(trigger==='watchdog'&&incident&&now-lastCapture<5000)return;
  lastCapture=now;maxLag=Math.max(maxLag,now-lastTick-500);
  const tasks=[...active.values()].map(v=>({stage:v.stage,elapsedMs:Math.round(now-v.start)}));
  if(!incident)incident={id:++serial,at:new Date().toISOString(),version:APP_VERSION,detected:{state:s,active:tasks}};
  Object.assign(incident,{trigger,waitMs:Math.round(now-lastProgress),maxTimerLagMs:Math.round(maxLag),state:s,
    active:tasks,recent:recent.slice(-40)});
  const all=stored();
  // 同じ待機中の記録を更新し、長い一度の待機で履歴を埋めない。
  const i=all.findIndex(v=>v.at===incident.at);if(i>=0)all[i]=incident;else all.push(incident);
  persist(all.slice(-LIMIT));
}
export function actionWaitEvent(stage,status='ok',value=0){
  if(typeof window==='undefined')return;
  remember({stage,status,value:Number.isFinite(value)?value:0,at:Math.round(clock())});
}
export function actionWaitSpan(stage){
  if(typeof window==='undefined')return noop;
  const id=++serial,start=clock();
  // 異常な呼び出し数でも診断自体の保持量を増やさない。
  if(active.size>=64)return noop;
  active.set(id,{stage,start});let done=false;
  return (status='ok')=>{
    if(done)return;done=true;
    const now=clock(),ms=Math.round(now-start);
    remember({stage,status,ms,at:Math.round(now)});
    // 主スレッドが塞がれ監視タイマーが動けなかった場合も拾う。
    if(timer&&ms>=THRESHOLD)capture(now,'completed-span');
    active.delete(id);
  };
}
export function actionWaitProgress(){
  const now=clock();
  if(timer&&now-lastProgress>=THRESHOLD)capture(now,'recovered');
  incident=null;
  lastProgress=lastTick=now;maxLag=0;
}
export function watchActionWait(read){
  reader=read;if(timer||typeof document==='undefined')return;
  lastProgress=lastTick=clock();
  timer=setInterval(()=>{
    const now=clock(),s=state();
    if(!s.combat){clearInterval(timer);timer=null;incident=null;return;}
    if(document.hidden||s.paused||!s.expected){lastProgress=lastTick=now;maxLag=0;incident=null;return;}
    maxLag=Math.max(maxLag,now-lastTick-500);lastTick=now;
    if(now-lastProgress>=THRESHOLD)capture(now);
  },500);
  // 背面中のタイマー抑制を戦闘の遅さと混同しない。
  if(!visibilityInstalled){visibilityInstalled=true;document.addEventListener('visibilitychange',()=>{
    lastProgress=lastTick=clock();maxLag=0;incident=null;
  });}
}
export function actionWaitReport(){
  const s=state();
  if(timer&&clock()-lastProgress>=THRESHOLD)capture(clock(),'export');
  return {format:1,version:APP_VERSION,uptimeMs:Math.round(clock()),device:{userAgent:globalThis.navigator?.userAgent||'',
    width:globalThis.innerWidth||0,height:globalThis.innerHeight||0,online:globalThis.navigator?.onLine!==false},
    current:s,records:stored()};
}
export function clearActionWait(){persist([]);incident=null;lastProgress=clock();recent.length=0;}
