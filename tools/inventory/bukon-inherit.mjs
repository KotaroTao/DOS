// 装備更新で武魂の数・レベル・保護を失わないことを確認する。
import assert from 'node:assert/strict';
import { inheritBukonPlan, inheritBukon } from '../../src/bukon.js';
const a={k:'flat_atk',lv:123,fusionUnlocked:true},b={k:'flat_hp',lv:99},c={k:'evade',lv:4};
const from={slot:'feet',rar:'lr',bukon:[a,b,c]},to={slot:'weapon',rar:'c',bukon:[{k:'flat_mp',lv:3}]};
const g={};
const plan=inheritBukonPlan(from,to);
assert.deepEqual(plan.moved,[a]);
assert.equal(from.bukon.length,3); // 確認画面では変更しない
assert.equal(to.bukon.length,1);
inheritBukon(g,from,to);
assert.deepEqual(from.bukon,[]);
assert.equal(to.bukon[0],a);
assert.equal(to.bukon[0].fusionUnlocked,true);
assert.deepEqual(g.bukonStock,{'flat_mp:3':'1','flat_hp:99':'1','evade:4':'1'});
assert.equal(g.bukonProtected['flat_hp:99'],true);
assert.equal(g.bukonProtected['evade:4'],true);
const same={slot:'weapon',rar:'lr',bukon:[a,b]};
inheritBukon(g,same,same);assert.deepEqual(same.bukon,[a,b]);
const fresh={slot:'weapon',rar:'lr',bukon:[]};
inheritBukon(g,same,fresh);assert.deepEqual(fresh.bukon,[a,b]);
assert.deepEqual(same.bukon,[]);
console.log('武魂引き継ぎ: 枠数・部位制限・既存武魂の回収・保護・同一品・参照の維持 OK');
