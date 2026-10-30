// Workerが作った文字列形式の端末記録を、再起動時にも同じ内容で回収する。
import assert from 'node:assert/strict';
import {CloudSaveClient} from '../../src/cloud-save.js';
import {refSerialize,refDeserialize} from '../../src/savegraph.js';
const config={url:'https://test.invalid',anonKey:'test',protocol:1};
const auth={access_token:'test',expires_at:9999999999,user:{id:'recovery-test'}};
for(const compact of [false,true])for(const withPending of [false,true]){
 const memory=new Map(),storage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
 const item={id:'u_herb'},inventory=[item],party=[{uid:1,items:inventory,equip:{weapon:item}}];
 const graph=refSerialize({state:'town',gold:4321,party,souls:[],inventory},{compact});
 const raw=JSON.stringify(graph),sessionId='session',id='checkpoint';
 storage.setItem('dos-cloud-checkpoint:recovery-test',JSON.stringify({id,sessionId,snapshot:JSON.parse(raw)}));
 if(withPending)storage.setItem('dos-cloud-pending:recovery-test',JSON.stringify({sessionId,commandId:'old',revision:0,op:'save',snapshot:refSerialize({gold:100})}));
 let revision=0,server;const seen=[];
 const c=new CloudSaveClient(config,{storage,fetcher:async(url,init)=>{
  const body=JSON.parse(init.body);seen.push(body);
  assert(body.snapshot,'回収時にsnapshotRawの本文を落とさない');
  server=refDeserialize(body.snapshot);return Response.json({revision:++revision});
 }});
 c.auth=auth;c.sessionId=sessionId;
 await c.recover();assert.equal(server.gold,4321);
 assert.equal(server.party[0].items,server.inventory);assert.equal(server.party[0].equip.weapon,server.inventory[0]);
 assert.equal(seen.length,withPending?2:1);assert.equal(storage.getItem('dos-cloud-checkpoint:recovery-test'),null);
}
console.log('文字列の復旧記録: 新旧グラフ・旧要求からの順序・金貨/品/共有参照を維持 OK');

// 遅れて準備された古い保存で、終了直前の同期記録を上書きしない。
{
 const memory=new Map(),storage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
 const c=new CloudSaveClient(config,{storage});c.auth=auth;c.sessionId='session';
 let release;const old=new Promise(r=>release=r);
 c.request=async body=>({revision:body.revision+1});
 const saving=c.savePrepared(()=>old);
 const key='dos-cloud-checkpoint:recovery-test';
 const newest=JSON.stringify(refSerialize({gold:7654}));
 const id=c.checkpointNow(newest);
 release(JSON.stringify(refSerialize({gold:1})));await saving;
 assert.equal(JSON.parse(storage.getItem(key)).id,id);
 assert.equal(refDeserialize(JSON.parse(storage.getItem(key)).snapshot).gold,7654);
}
console.log('同期の終了記録: 遅れた準備と古い応答で消さない OK');
