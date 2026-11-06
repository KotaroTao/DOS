// 断念/再戦中断のルールと、閉鎖応答の再送後に古い途中保存を戻さないこと。
import assert from 'node:assert/strict';
import {cancelCloudBattle} from '../../src/cloud-battle.js';
import {CloudSaveClient} from '../../src/cloud-save.js';
import {refSerialize,refDeserialize} from '../../src/savegraph.js';
const p={uid:1,alive:true,hp:5,maxhp:100,mp:3,maxmp:50,asleep:true,mind:'confuse'};
const normal={state:'combat',battle:{},party:[p],redSoul:100,gold:1234,run:{gold:50}};
cancelCloudBattle(normal,'abandon');assert.equal(normal.state,'over');assert.equal(normal.run.abandoned,true);
assert.equal(p.hp,0);assert.equal(p.alive,false);assert.equal(normal.redSoul,100);assert.equal(normal.gold,1234);assert.equal(normal.battle,null);
const actor={alive:true,hp:1,maxhp:100,mp:1,maxmp:50};
const rematch={state:'combat',battle:{},party:[actor],rematch:{savedIdx:9,savedFloor:3,snap:[{p:actor,hp:80,mp:40,alive:true,ailment:null,pct:0}]}};
cancelCloudBattle(rematch,'rematch');assert.equal(rematch.state,'town');assert.equal(actor.hp,80);assert.equal(actor.mp,40);assert.equal(rematch.dungeonIdx,9);assert.equal(rematch.rematch,null);
assert.throws(()=>cancelCloudBattle({state:'town'},'abandon'),e=>e.status===409);
assert.throws(()=>cancelCloudBattle({state:'combat',battle:{},rematch:{}},'abandon'),e=>e.status===400);
for(const op of ['ledger-cancel','ledger-finish']){
 const disk=new Map(),storage={getItem:k=>disk.get(k)||null,setItem:(k,v)=>disk.set(k,v),removeItem:k=>disk.delete(k)};
 const c=new CloudSaveClient({protocol:1},{storage});c.auth={user:{id:'closing'}};c.sessionId='session';c.revision=2;c.commandMode=true;
 c.confirmed=refSerialize({state:'over',gold:1234});
 storage.setItem('dos-cloud-pending:closing',JSON.stringify({op,sessionId:'session',commandId:'same-id',revision:1}));
 storage.setItem('dos-cloud-checkpoint:closing',JSON.stringify({id:'old',sessionId:'session',snapshot:refSerialize({state:'combat',gold:1})}));
 storage.setItem('dos-cloud-choice:closing',JSON.stringify({sessionId:'session',command:{operation:'enemy'}}));
 let calls=0;c.request=async body=>{calls++;assert.equal(body.op,op);assert.equal(body.commandId,'same-id');return {revision:2};};
 await c.recover();assert.equal(calls,1);assert.equal(refDeserialize(c.confirmed).gold,1234);
 for(const name of ['pending','choice','checkpoint'])assert.equal(storage.getItem('dos-cloud-'+name+':closing'),null);
}
console.log('断念/再戦中断: サーバー確定状態・費用未請求・入力制限・閉鎖応答喪失後の旧記録再適用防止: OK');
