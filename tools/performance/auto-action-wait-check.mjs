// 端末内の待機診断が、待機理由・主スレッド停止・再読込を区別し、保存を汚さない。
import assert from 'node:assert/strict';
const old={window:globalThis.window,document:globalThis.document,localStorage:globalThis.localStorage,performance:globalThis.performance,setInterval,clearInterval,Date};
let now=0,throwStorage=false;const intervals=new Set(),listeners=new Map(),disk=new Map([['dos-save-v7','keep'],['dos-cloud-auth','keep']]);
globalThis.window={};globalThis.performance={now:()=>now};
globalThis.document={hidden:false,addEventListener:(type,fn)=>listeners.set(type,fn)};
globalThis.localStorage={getItem:k=>disk.get(k)||null,setItem:(k,v)=>{if(throwStorage)throw Error('容量不足');disk.set(k,v);}};
globalThis.setInterval=fn=>{intervals.add(fn);return fn;};globalThis.clearInterval=fn=>intervals.delete(fn);
globalThis.Date=class extends old.Date {constructor(...args){super(...(args.length?args:[1700000000000+now]));}};
const step=(ms=500)=>{now+=ms;for(const fn of [...intervals])fn();};
try{
  const d=await import('../../src/action-wait.js?check');
  let state={combat:true,expected:true,paused:false,cloudBusy:true,phase:'input'};
  d.watchActionWait(()=>state);d.watchActionWait(()=>state);assert.equal(intervals.size,1);
  const request=d.actionWaitSpan('http.ledger-command');
  for(let i=0;i<9;i++)step();assert.equal(d.actionWaitReport().records.length,0);
  step();let report=d.actionWaitReport();assert.equal(report.records.length,1);assert.equal(report.records[0].waitMs,5000);
  assert.equal(report.records[0].active[0].stage,'http.ledger-command');assert.equal(report.records[0].maxTimerLagMs,0);
  request();d.actionWaitProgress();assert.equal(d.actionWaitReport().records[0].trigger,'recovered');
  assert.equal(d.actionWaitReport().records[0].detected.active[0].stage,'http.ledger-command','復帰後も検出時の待機理由を残す');
  // 手帳・手動入力・背面は意図的な停止として検出しない。
  state.paused=true;for(let i=0;i<20;i++)step();state.paused=false;
  state.expected=false;for(let i=0;i<20;i++)step();state.expected=true;
  document.hidden=true;listeners.get('visibilitychange')();now+=60000;document.hidden=false;listeners.get('visibilitychange')();step();
  assert.equal(d.actionWaitReport().records.length,1);
  // 監視タイマーが実行できなくても、同期処理の終了時に遅れを捕捉する。
  const sync=d.actionWaitSpan('auto.snapshot');now+=6000;sync();
  report=d.actionWaitReport();assert.equal(report.records.length,2);assert(report.records.at(-1).maxTimerLagMs>=5500);
  assert(report.records.at(-1).recent.some(v=>v.stage==='auto.snapshot'&&v.ms===6000));d.actionWaitProgress();
  // 背景保存自体が長くても、行動が進んでいれば記録しない。
  const background=d.actionWaitSpan('codec.encode');step(6000);d.actionWaitProgress();const before=d.actionWaitReport().records.length;
  background();assert.equal(d.actionWaitReport().records.length,before);
  for(let i=0;i<12;i++){for(let j=0;j<10;j++)step();d.actionWaitProgress();}
  assert.equal(d.actionWaitReport().records.length,8);
  const reloaded=await import('../../src/action-wait.js?reload');assert.equal(reloaded.actionWaitReport().records.length,8);
  for(let i=0;i<10000;i++)d.actionWaitEvent('auto.tick');step(6000);
  assert(d.actionWaitReport().records.every(v=>v.recent.length<=40));
  assert.equal(disk.get('dos-save-v7'),'keep');assert.equal(disk.get('dos-cloud-auth'),'keep');
  throwStorage=true;d.clearActionWait();for(let i=0;i<10;i++)step();assert.equal(d.actionWaitReport().records.length,1,'端末保存失敗でもメモリ内の診断を取り出す');
  state.combat=false;step();assert.equal(intervals.size,0);
  console.log('行動待ち診断: 5秒境界・処理名・同期停止・意図的停止の除外・8件上限・再読込・保存失敗・本編保存保全 OK');
}finally{for(const [k,v] of Object.entries(old))globalThis[k]=v;}
