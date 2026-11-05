// 再開直後の選択復元でWorkerを起動し、失敗を握り潰さず復旧へ渡す。
import assert from 'node:assert/strict';
import { CloudSaveClient } from '../../src/cloud-save.js';
import { refSerialize } from '../../src/savegraph.js';
let mode='local',created=0;
const snapshot=refSerialize({gold:101});
const local={snapshot,packet:{},forcedPackets:[]};
globalThis.Worker=class {
 constructor(){created++;}
 postMessage(message){queueMicrotask(()=>this.onmessage({data:{id:message.id,result:mode==='local'?local:null}}));}
};
const stopped=new Error('検証の停止');
for(const scenario of ['local','empty','network','mismatch']){
 mode=scenario;
 const memory=new Map(),storage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
 const command={type:'battle',operation:'commit',actor:1,action:'defend'};
 const choice=JSON.stringify({sessionId:'session',commandId:'selected',command});
 storage.setItem('dos-cloud-choice:test',choice);
 let preview=0,sent=0,failure;
 const client=new CloudSaveClient({protocol:1},{storage,retryDelays:[],onFailure:async error=>{
  failure=error;
  if(scenario==='mismatch')await client.archivePending({includeChoice:true});
  throw stopped;
 }});
 Object.assign(client,{auth:{user:{id:'test'}},sessionId:'session',revision:1,confirmed:refSerialize({gold:100}),commandMode:true,commandReplay:true,ledger:{id:'battle',seq:0}});
 client.claim=async()=>client.confirmed;
 client.request=async body=>{
  assert.equal(body.commandId,'selected');assert.deepEqual(body.command,body.op==='ledger-command'?{...command,forcedCount:0}:command);
  if(body.op==='ledger-preview'){
   preview++;
   if(scenario==='network')throw Object.assign(new Error('接続の検証'),{status:503});
   return scenario==='mismatch'?null:local;
  }
  assert.equal(body.op,'ledger-command');sent++;
  return {revision:2,seq:1};
 };
 if(['local','empty'].includes(scenario)){
  await client.recover();assert.equal(sent,1);assert.equal(preview,scenario==='local'?0:1);
  assert.equal(storage.getItem('dos-cloud-choice:test'),null);assert.deepEqual(client.confirmed,snapshot);
  if(scenario==='local')assert.equal(created,1,'再開時にWorkerを起動する');
 }else{
  await assert.rejects(client.recover(),e=>e===stopped);assert.equal(sent,0);
  if(scenario==='network'){assert.equal(failure.status,503);assert.equal(storage.getItem('dos-cloud-choice:test'),choice);}
  else{assert.equal(failure.message,'cloud_replay_mismatch');assert.equal(storage.getItem('dos-cloud-choice:test:recovery'),choice);}
 }
}
console.log('選択の復元: Worker初回起動・null時のサーバー代替・元の通信エラー・不一致時の退避復旧: OK');
