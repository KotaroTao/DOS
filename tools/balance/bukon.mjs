import assert from 'node:assert/strict';
import * as b from '../../src/bukon.js';
import {elementMultiplier} from '../../src/combatrules.js';
const active=b.BUKON.filter(d=>!d.retired);
assert.equal(active.length,138);assert.equal(new Set(active.map(d=>d.id)).size,138);
for(const d of active){for(const lv of [1,d.max||1000]){
 const soul={k:d.id,lv};assert(b.validBukon(soul));assert(b.bukonText(soul).includes(d.name));
 for(const slot of ['weapon','shield','body','head','hands','feet','acc']){
  const it={slot,rar:'lr',bukon:[soul]},before=JSON.stringify(it),out=b.bukonItem(it);assert.equal(JSON.stringify(it),before);
  assert(out);assert.equal(b.bukonFits(it,soul),d.slots.includes(slot));
 }
}if(d.max)assert(!b.validBukon({k:d.id,lv:d.max+1}));}
assert.equal(b.bukonExact({k:'flat_hp',lv:1200}),12000n);
assert.equal(b.bukonExact({k:'flat_mp',lv:10}),50n);
assert.equal(b.bukonExact({k:'flat_atk',lv:10}),10n);
assert.equal(b.bukonItem({slot:'weapon',bukon:[{k:'G01',lv:10}]}).afxFx[0].c.v,3);
for(const k of ['I02','I21','I23','F01','res_physResist'])assert(b.bukonText({k,lv:10}).includes('50'));
const g={gold:10000};b.stockAdd(g,{k:'flat_hp',lv:2},2);b.stockAdd(g,{k:'flat_hp',lv:1},3);
const plan=b.fusionPlan(g,'flat_hp',3);assert.deepEqual(plan.consume.map(x=>[x.lv,x.count]),[[2,'2'],[1,'3']]);assert.equal(plan.cost,110n);
assert(b.fuseBukon(g,'flat_hp',3));assert.equal(g.gold,9890);assert.equal(g.bukonStock['flat_hp:3'],'1');
const poor={gold:99};b.stockAdd(poor,{k:'flat_hp',lv:1},3);const before=JSON.stringify(poor);assert(!b.fuseBukon(poor,'flat_hp',2));assert.equal(JSON.stringify(poor),before);
assert.equal(b.fusionGold('crit',10),25600n);assert.equal(b.fusionGold('flat_hp',10),215n);
const bulk={gold:10000};b.stockAdd(bulk,{k:'flat_hp',lv:1},9);assert.equal(b.bulkFusionPlan(bulk,'flat_hp',0).cost,410n);assert(b.bulkFuseBukon(bulk,'flat_hp',0));assert.equal(bulk.gold,9590);assert.equal(bulk.bukonStock['flat_hp:3'],'1');
const protectedStock={gold:10000,bukonProtected:{'crit:1':true}};b.stockAdd(protectedStock,{k:'crit',lv:1},30);assert.equal(b.fusionPlan(protectedStock,'crit',2),null);
const migration={bukonStock:{'X14:1':'2','X32:1':'3'}},it={slot:'body',bukon:[{k:'F01',lv:3}]};assert(b.migrateBukon(migration,[it]));assert.equal(it.bukon.length,0);assert.equal(migration.bukonStock['F01:3'],'1');assert.equal(migration.bukonStock['spellCrit:1'],'2');assert(!b.migrateBukon(migration,[it]));
const all=b.bukonItem({slot:'body',bukon:[{k:'res_allElements',lv:10},{k:'elem_def_fire',lv:10}]});assert.equal(all.bukonElementDef.fire,1);assert.equal(all.bukonElementDef.water,.5);
assert.equal(elementMultiplier('fire',100,{reductions:all.bukonElementDef}),.19999999999999996);
const counts=Array(5).fill(0);for(let i=0;i<10000;i++){let n=0;const soul=b.rollBukon({slot:'weapon',rar:'lr'},100,()=>n++===0?(i+.5)/10000:.999);assert(soul);counts[b.bukonDef(soul.k).rarity]++;}assert.deepEqual(counts,[8000,1250,500,200,50]);
console.log('武魂138種：成長・部位・抽選比率・異Lv素材・金貨・保護・旧セーブ移行を確認');
