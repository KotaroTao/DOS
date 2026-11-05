import { traceDuration } from './battle-trace.js';
// 名前や所持品は残さず、呼出し番号と隊列位置（1始まり）で内訳を照合する。
let serial=0, recent=[], slowest=[];
const totals=Object.create(null), round=n=>Math.round(n*10)/10;
export function beginPartyRender(state){
 const start=performance.now(), id=++serial, stages=[], paths=[];
 return {
  measure(name,slot,fn){
   const at=performance.now();
   try{return fn();}finally{
    const end=performance.now(),duration=end-at,key=name+':'+(slot??'all');
    const t=totals[key]||(totals[key]={count:0,totalMs:0,maxMs:0});
    t.count++;t.totalMs+=duration;t.maxMs=Math.max(t.maxMs,duration);
    stages.push({name,slot,startMs:round(at),durationMs:round(duration)});
    traceDuration('party.'+name,at,'sync',{call:id,slot},end);
   }
  },
  path(slot,kind){paths.push({slot,kind});},
  finish(){
   const entry={call:id,state,startMs:round(start),durationMs:round(performance.now()-start),paths,stages};
   recent.push(entry);if(recent.length>4)recent.shift();
   slowest.push(entry);slowest.sort((a,b)=>b.durationMs-a.durationMs);slowest.length=Math.min(slowest.length,8);
  }
 };
}
export function partyRenderTrace(){return {
 calls:serial,summary:Object.fromEntries(Object.entries(totals).map(([k,t])=>[k,{count:t.count,totalMs:round(t.totalMs),maxMs:round(t.maxMs)}])),
 recent:recent.slice(),slowest:slowest.slice(),
 notes:'slotは隊列位置。card全体にはportrait/gearWatch/badges/domAttachが含まれるため加算しない。差分なしでもgearCheck/data/compareは実行する。配置の同期処理はtimelineのparty.fitView/party.refitAndRedrawに別記録。GPU完了・非同期画像復号・ブラウザ内部の描画合成は対象外。'
};}
