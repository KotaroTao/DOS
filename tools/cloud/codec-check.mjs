import assert from 'node:assert/strict';
import {refSerialize,refDeserialize} from '../../src/savegraph.js';
import {encodeCloudSave,cloneSaveData} from '../../src/save-codec.js';
const item={id:'test',locked:true},bag=[item];
const chest={state:'closed',drops:[{item}],open(){throw Error('操作を実行しない');}};
const root={inventory:bag,party:[{items:bag,equip:{weapon:item}}],pendingResults:{chest},callbacks:[()=>{},3]};
root.self=root;chest.owner=root.party[0];
const copy=cloneSaveData(root);
assert.deepEqual(refSerialize(copy),refSerialize(root));
assert.equal(copy.self,copy);assert.equal(copy.inventory,copy.party[0].items);
assert.equal(copy.pendingResults.chest.drops[0].item,copy.inventory[0]);
assert.equal(typeof root.pendingResults.chest.open,'function');
let attempts=0;
globalThis.Worker=class {
  postMessage(message){
    attempts++;
    const data=structuredClone(message);
    queueMicrotask(()=>this.onmessage({data:{id:data.id,result:JSON.stringify(refSerialize(data.value,{compact:data.compact}))}}));
  }
};
const raw=await encodeCloudSave(root,true),saved=refDeserialize(JSON.parse(raw));
assert.equal(attempts,2);assert.equal(saved.pendingResults.chest.open,undefined);
assert.equal(saved.inventory,saved.party[0].items);
assert.equal(saved.pendingResults.chest.drops[0].item,saved.inventory[0]);
assert.equal(saved.pendingResults.chest.state,'closed');
console.log('Worker保存: 宝箱の操作関数を除外・配列内関数/循環/個体/共有参照・元の操作関数保持 OK');
