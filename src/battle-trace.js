// 端末内だけの時系列。処理本文・対象・セーブ・通信内容は記録しない。
const LIMIT=256, SLOW_LIMIT=32, THRESHOLD=8;
let events=[], cursor=0, dropped=0, slowest=[], totals=Object.create(null);
let context={battle:false,auto:false,animating:false,hidden:false}, lastFrame=null;
const round=n=>Math.round(n*10)/10;
export function traceContext(battle,auto,animating,hidden=false){
 context={battle:!!battle,auto:!!auto,animating:!!animating,hidden:!!hidden};
 if(!battle||hidden)lastFrame=null;
}
export function traceDuration(name,start,kind='sync',detail=null,end=performance.now()){
 const ms=Math.max(0,end-start);
 const key=kind+':'+name;
 const total=totals[key]||(totals[key]={count:0,totalMs:0,maxMs:0});
 total.count++;total.totalMs+=ms;total.maxMs=Math.max(total.maxMs,ms);
 if(ms<THRESHOLD&&kind!=='mark')return;
 const event={name,kind,startMs:round(start),durationMs:round(ms),...context};
 if(detail)event.detail=detail;
 if(events.length<LIMIT)events.push(event);else{events[cursor]=event;cursor=(cursor+1)%LIMIT;dropped++;}
 if(kind!=='mark'&&(slowest.length<SLOW_LIMIT||ms>slowest[slowest.length-1].durationMs)){
  slowest.push(event);slowest.sort((a,b)=>b.durationMs-a.durationMs);slowest.length=Math.min(slowest.length,SLOW_LIMIT);
 }
}
export function traceSync(name,fn){const start=performance.now();try{return fn();}finally{traceDuration(name,start);}}
// async の経過時間はCPU時間ではない。通信・Worker・待機・描画の時間を含む。
export async function traceWait(name,fn){const start=performance.now();try{return await fn();}finally{traceDuration(name,start,'wait');}}
export function traceFrame(now){
 if(context.battle&&!context.hidden){if(lastFrame!==null&&now-lastFrame>34)traceDuration('frame-gap',lastFrame,'gap',null,now);lastFrame=now;}
 else lastFrame=null;
}
let visibilityEpoch=0;
globalThis.document?.addEventListener?.('visibilitychange',()=>{
 visibilityEpoch++;lastFrame=null;context={...context,hidden:!!document.hidden};
 traceDuration(document.hidden?'page-hidden':'page-visible',performance.now(),'mark');
});
// Long Tasks APIがないSafariでも、タイマーの遅延と上の処理区間を採れる。
let timer=null;
export function startBattleTrace(){
 if(timer!==null)return;
 let previous=performance.now(),epoch=visibilityEpoch;
 timer=setInterval(()=>{const now=performance.now();
  if(!globalThis.document?.hidden&&epoch===visibilityEpoch&&now-previous>150)traceDuration('event-loop-gap',previous,'gap',null,now);
  previous=now;epoch=visibilityEpoch;
 },100);
 timer.unref?.();
}
export function battleTrace(){
 const recent=events.length===LIMIT?[...events.slice(cursor),...events.slice(0,cursor)]:events.slice();
 return {clock:'performance.now (ms since navigation)',capturedAtMs:round(performance.now()),thresholdMs:THRESHOLD,limit:LIMIT,dropped,
  context:{...context},summary:Object.fromEntries(Object.entries(totals).map(([k,v])=>[k,{count:v.count,totalMs:round(v.totalMs),maxMs:round(v.maxMs)}])),
  recent:recent.sort((a,b)=>a.startMs-b.startMs),slowest:slowest.slice(),
  notes:'sync=主スレッドの処理区間（入れ子あり）、wait=非同期の経過時間、gap=呼出し間隔。GPU完了や音切れそのものは測定しない。再読込で消去。'};
}
