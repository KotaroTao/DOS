import assert from 'node:assert/strict';
import * as b from '../../src/bukon.js';
import { ITEMS, SLOTS, recalc, itemAtQuality } from '../../src/items.js';
import { CATALOG_ITEMS } from '../../src/catalog/index.js';
import { makeDoll } from '../../src/souls.js';
import { Battle } from '../../src/combat.js';
import { refSerialize, refDeserialize } from '../../src/savegraph.js';
Object.assign(ITEMS,CATALOG_ITEMS);
const g={};
b.stockAdd(g,{k:'flat_hp',lv:3},2);b.stockAdd(g,{k:'flat_hp',lv:2},3);
const plan=b.fusionPlan(g,'flat_hp',4);assert.equal(plan.consume.length,2);
assert(b.fuseBukon(g,'flat_hp',4));assert.equal(b.stockRows(g).length,1);assert.equal(b.bukonExact(b.stockRows(g)[0]),80n);
const old=JSON.stringify(g);assert(!b.fuseBukon(g,'flat_hp',5));assert.equal(JSON.stringify(g),old);
const mixed={};b.stockAdd(mixed,{k:'flat_hp',lv:1},100);b.stockAdd(mixed,{k:'flat_hp',lv:2},1);mixed.bukonProtected={'flat_hp:2':true};
assert(b.bulkFuseBukon(mixed,'flat_hp',1));assert.equal(mixed.bukonStock['flat_hp:2'],'34'); // protected Lv2 receives carry, never consumed
assert.equal(mixed.bukonStock['flat_hp:1'],'1');
const huge={};b.stockAdd(huge,{k:'flat_hp',lv:1},3n**80n);b.bulkFuseBukon(huge,'flat_hp',0);assert.deepEqual(b.stockRows(huge).map(x=>[x.lv,x.count]),[[81,'1']]);
assert.equal(b.bukonExact({k:'flat_hp',lv:1200}),10n*2n**1199n);
assert(Number.isFinite(b.bukonItem({bukon:[{k:'flat_hp',lv:1000}]}).hp));
assert.deepEqual(refDeserialize(refSerialize(huge)),huge);
for(const [rar,slots] of Object.entries(b.BUKON_SLOTS)){
 const it={slot:'body',rar};const state={};
 for(const d of b.BUKON.slice(0,slots)){const soul={k:d.id,lv:1};b.stockAdd(state,soul);assert(b.attachBukon(state,it,soul));}
 assert.equal(it.bukon.length,slots);assert(b.attachBlock(it,it.bukon[0]));
 assert(b.detachBukon(state,it,0));assert.equal(b.recoverBukon(state,it),slots-1);assert(!it.bukon);
}
for(const [k,max] of [['res_physResist',4],['res_magResist',4],['res_poison',7],['crit',7],['evade',7],['pct_hp',9]]) {
 assert(b.validBukon({k,lv:max}));assert(!b.validBukon({k,lv:max+1}));assert(!b.fusionPlan({},k,max+1));
}
const it=itemAtQuality({...Object.values(ITEMS).find(x=>x.slot==='body'&&x.rar==='lr'),bukon:[{k:'flat_hp',lv:4},{k:'pct_hp',lv:9}]},50);
const price=it.price,serial=JSON.stringify(it);const view=b.bukonItem(it);assert.equal(it.price,price);assert.equal(JSON.stringify(it),serial);assert.equal(view.hp,(it.hp || 0)+80);assert.equal(view.mult.hp,(it.mult?.hp || 0)+2.56);
const doll=makeDoll('武魂検査');const base=doll.base.hp;
for(const slot of SLOTS)doll.equip[slot]={slot:slot.startsWith('acc')?'acc':slot,rar:'lr',resists:{physResist:40,poison:40},bukon:[{k:'flat_hp',lv:1},{k:'pct_hp',lv:9},{k:'res_physResist',lv:4},{k:'res_poison',lv:7},{k:'crit',lv:7}]};
recalc(doll);assert.equal(doll.maxhp,Math.round((base+80)*(1+8*2.56)));assert.equal(doll.physResist,80);assert.equal(doll.resists.poison,95);assert.equal(doll.critBonus,.8);assert.equal(doll.critPower,5.12);
const battle=new Battle([doll],[],()=>{});assert.equal(battle._resistCut(doll,1000,'physResist').dmg,200);assert.equal(battle._ailRes(doll,'poison'),.95);assert.equal(battle.peekStats(doll).crit,.8);
doll.evadeBonus=.8; doll.passiveMap={parry:2};
const foe={side:'enemy',agi:1,luk:1};
const miss=battle._missP(doll,foe),parry=battle._parryP(doll);
assert(Math.abs(miss-.8)<1e-9,'見切り込みの回避80%');
for(const slot of SLOTS)doll.equip[slot]=null;recalc(doll);assert.equal(doll.maxhp,base);assert.equal(doll.physResist,0);
for(const d of b.BUKON){const soul={k:d.id,lv:d.max || 10};assert(b.bukonText(soul));const v=b.bukonItem({slot:'body',bukon:[soul]});assert(v);}
for(const rar of ['c','uc'])assert.equal(b.rollBukon({rar}),null);
for(const rar of ['r','sr','lr'])for(let i=0;i<300;i++)assert(b.validBukon(b.rollBukon({rar},12)));
console.log('OK 武魂：混合合成・BigInt・一括・保護・全レア枠・回収・価格不変・割合加算・耐性上限・全効果・ドロップ');

let seed=12345;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
const distribution={};
for(const rar of ['r','sr','lr']){let sum=0,ultra=0;for(let i=0;i<30000;i++){const soul=b.rollBukon({rar},12,rnd);sum+=soul.lv;if(b.bukonDef(soul.k).rarity===4)ultra++;}distribution[rar]={mean:sum/30000,ultra};}
assert(distribution.lr.mean>distribution.sr.mean && distribution.sr.mean>distribution.r.mean);
assert(distribution.lr.ultra>distribution.sr.ultra && distribution.sr.ultra>distribution.r.ultra);
console.log('OK 9万ドロップ：SR・LRほど高レベルと激レアが出やすい',JSON.stringify(distribution));
