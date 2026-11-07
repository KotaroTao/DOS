// 計算用Workerの停止を模擬し、未完了要求の退避と同じページ内での復帰を確認する。
import assert from 'node:assert/strict';
import {refSerialize,refDeserialize} from '../../src/savegraph.js';
const original={Worker:globalThis.Worker,setTimeout,clearTimeout,now:Date.now};
const timers=new Set();let now=1000;
globalThis.setTimeout=(fn,ms)=>{const t={fn,ms};timers.add(t);return t;};
globalThis.clearTimeout=t=>timers.delete(t);Date.now=()=>now;
const workers=[];let refuseWorker=false,attempts=0;
class WorkerStub {
  constructor(){attempts++;if(refuseWorker)throw Error('生成を一時拒否');this.serial=workers.length+1;this.reply=true;workers.push(this);}
  postMessage(message){this.last=message;if(this.reply)queueMicrotask(()=>this.answer(message));}
  answer(message=this.last){this.onmessage?.({data:{id:message.id,...(message.op
    ? {result:message.op==='encode'?JSON.stringify(refSerialize(message.value,{compact:message.compact})):{worker:this.serial}}
    : {plan:{action:'defend'}})}});}
  terminate(){this.terminated=true;}
}
globalThis.Worker=WorkerStub;
const expire=ms=>{const timer=[...timers].find(t=>t.ms===ms);assert(timer,`応答がないWorkerを${ms}msで待ち続けない`);timers.delete(timer);now+=ms;timer.fn();};
try{
  const codec=await import('../../src/save-codec.js?worker-recovery');
  assert.deepEqual(refDeserialize(JSON.parse(await codec.encodeCloudSave({gold:1234},true))),{gold:1234});
  const first=workers.at(-1);first.onerror({preventDefault(){}});assert(first.terminated);
  assert.equal(await codec.replayCloudCommandPrepared({}, {}, 'same-command'),null);
  now+=30001;
  assert.deepEqual(await codec.replayCloudCommandPrepared({}, {}, 'same-command'),{worker:2},'一度の失敗で遅い再計算へ固定しない');
  const stopped=workers.at(-1);stopped.reply=false;
  const stalled=codec.replayCloudCommandPrepared({}, {}, 'stalled');expire(10000);
  assert.equal(await stalled,null,'未完了の戦闘計算はサーバー再計算へ引き継ぐ');assert(stopped.terminated);
  now+=30001;
  const resumed=codec.replayCloudCommandPrepared({}, {}, 'resumed');
  const latest=workers.at(-1);stopped.onerror({preventDefault(){}});
  assert(!latest.terminated,'終了済みWorkerの遅いエラーで復帰後を止めない');
  assert.deepEqual(await resumed,{worker:3});
  console.log('保存・戦闘Worker: 一時エラー/無応答の退避・同一ページで再開・古い通知の無効化 OK');

  const planner=await import('../../src/auto-planner.js?worker-recovery');
  const actor={uid:1,spells:[]},battle={party:[actor],enemies:[]};let fallbackCount=0;
  const fallback=()=>{fallbackCount++;return {action:'attack'};};
  assert.equal((await planner.planAuto(battle,actor,()=>false,fallback)).action,'defend');
  const before=workers.at(-1);before.onerror();
  assert.equal((await planner.planAuto(battle,actor,()=>false,fallback)).action,'attack');
  now+=30001;
  assert.equal((await planner.planAuto(battle,actor,()=>false,fallback)).action,'defend','作戦Workerもリロードせずに復帰する');
  const slow=workers.at(-1);slow.reply=false;
  const waiting=planner.planAuto(battle,actor,()=>false,fallback);expire(3000);
  assert.equal((await waiting).action,'attack');assert(slow.terminated);
  now+=30001;
  const next=planner.planAuto(battle,actor,()=>false,fallback),current=workers.at(-1);
  slow.onerror();assert(!current.terminated);assert.equal((await next).action,'defend');
  assert.equal(fallbackCount,2);assert.equal(timers.size,0,'期限切れタイマーを残さない');
  console.log('作戦Worker: 時間切れの一手は代替処理・同一ページで再開・タイマー回収 OK');

  refuseWorker=true;
  const denied=await import('../../src/save-codec.js?creation-recovery');
  const deniedPlanner=await import('../../src/auto-planner.js?creation-recovery');
  const startAttempts=attempts;
  assert.deepEqual(refDeserialize(JSON.parse(await denied.encodeCloudSave({gold:42},true))),{gold:42});
  assert.equal((await deniedPlanner.planAuto(battle,actor,()=>false,fallback)).action,'attack');
  refuseWorker=false;
  assert.equal(await denied.replayCloudCommandPrepared({}, {}, 'same-command'),null);
  assert.equal((await deniedPlanner.planAuto(battle,actor,()=>false,fallback)).action,'attack');
  assert.equal(attempts,startAttempts+2,'生成拒否の直後に生成を連発しない');
  now+=30001;
  assert((await denied.replayCloudCommandPrepared({}, {}, 'same-command')).worker);
  assert.equal((await deniedPlanner.planAuto(battle,actor,()=>false,fallback)).action,'defend');
  assert.equal(timers.size,0);
  console.log('Worker生成拒否: 代替処理・再試行の間隔・同じページでの再生成 OK');
}finally{
  globalThis.Worker=original.Worker;globalThis.setTimeout=original.setTimeout;globalThis.clearTimeout=original.clearTimeout;Date.now=original.now;
}
