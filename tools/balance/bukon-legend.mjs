import assert from 'node:assert/strict';
import {BUKON,bukonItem} from '../../src/bukon.js';
import {recalc,registerAffixes} from '../../src/items.js';
import {applyAffixes,gearPerks} from '../../src/infaffix.js';
import {makeDoll} from '../../src/souls.js';
import {Battle} from '../../src/combat.js';
registerAffixes(applyAffixes,gearPerks);
const {reseedRng}=await import('../../src/rng.js');reseedRng(20261028);
const actor=(souls,slot='acc')=>{const p=makeDoll('検証');p.equip[slot==='acc'?'acc1':slot]={slot,rar:'lr',bukon:souls};recalc(p);return p;};
const enemy=()=>({id:999,name:'検証の敵',side:'enemy',alive:true,hp:1e8,maxhp:1e8,atk:10,vit:10,agi:10,int:10,pie:10,luk:1,lv:1,element:'none',spells:[],physResist:80,magResist:70});
for(const d of BUKON.filter(d=>d.kind==='special')){
 const p=actor([{k:d.id,lv:d.max}],d.slots[0]);const battle=new Battle([p],[enemy()],()=>{});assert(p.alive);assert(battle);
}
const p=actor([{k:'J11',lv:10}]);p.equip.acc2={slot:'acc',rar:'lr',bukon:[{k:'J11',lv:1}]};recalc(p);assert.equal(p.gearMisc.bk_reviveChance,.5);
const fight=new Battle([p],[enemy()],()=>{});let revived=0,dead=0;
for(let i=0;i<1000;i++){p.alive=true;p.hp=0;const result=fight._die(p,fight.enemies[0]);if(!result){revived++;assert.equal(p.hp,Math.max(1,Math.round(p.maxhp*.1)));}else dead++;}
assert(revived>350&&revived<650);assert(dead>350);
const mixed=actor([{k:'H01',lv:10},{k:'I12',lv:10}],'body');const mb=new Battle([mixed],[enemy()],()=>{});mixed.side='party';
// 存在しない種族条件が、成立した前列軽減を削らない。
assert.equal(mb._perkSum(mixed,'take',{tgt:{side:'enemy',race:'beast'},on:['phys']}),.5);
const a=actor([{k:'res_allElements',lv:10}],'body');a.equip.head={slot:'head',rar:'lr',bukon:[{k:'elem_def_fire',lv:10}]};recalc(a);const ab=new Battle([a],[enemy()],()=>{});
assert(Math.abs(ab._elementMul(ab.enemies[0],a,'fire')-.2)<1e-9);assert(Math.abs(ab._elementMul(ab.enemies[0],a,'water')-.5)<1e-9);
const weak=actor([{k:'X13',lv:10},{k:'G01',lv:10}],'weapon');const wb=new Battle([weak],[enemy()],()=>{});assert(weak.gearPerks.some(x=>x.c.v===3));
const def=actor([{k:'X04',lv:10},{k:'bukon_magDown',lv:10}],'weapon');const db=new Battle([def],[enemy()],()=>{});for(let i=0;i<5;i++)db._physical(def,db.enemies[0],{sureHit:true});assert.equal(db.enemies[0]._bkPhysDown,50);assert.equal(db.enemies[0]._bkMagDown,50);
console.log('特殊武魂：全件戦闘接続・繰返し復活50%/HP10%・最高Lv・条件集計・全属性耐性・耐性低下上限を確認');
// Lv10かつAGI条件達成では追加行動が必ず1回。次のターンも増殖しない。
{
 const x=actor([{k:'X26',lv:10}],'feet');x.agi=10000;const y=enemy();y.agi=1;const battle=new Battle([x],[y],()=>{});
 assert.equal(battle.queue.filter(a=>a===x).length+(battle.current===x?1:0),2);
}
// 金貨奪取100%でも同じ敵からは一度。分配回復は通常の回復窓口を再帰呼出ししない。
{
 const x=actor([{k:'X23',lv:10}],'hands'),y=enemy();y.gold=100;const battle=new Battle([x],[y],()=>{});
 battle._physical(x,y,{sureHit:true});const first=battle.bonusGold;assert.equal(first,60);battle._physical(x,y,{sureHit:true});assert.equal(battle.bonusGold,first);
}
// 現在の装備が反映された属防の表示。直軽減だけでも「—」にならない。
{
 const {elemStatShort,elemStatEq}=await import('../../src/ui/itemview.js');
 assert(elemStatShort(a.elemDef).includes('80%軽減'));assert(!elemStatEq(a.elemDef,null));
}
console.log('追加行動100%の一回制限・金貨奪取一回・実軽減表示を確認');
{
 const {spellCost}=await import('../../src/combat.js');const x=actor([{k:'I21',lv:10}],'head');x.equip.acc1={slot:'acc',rar:'lr',bukon:[{k:'I21',lv:10}]};recalc(x);x.soulMp=0;
 assert.equal(spellCost(x,{kind:'atk',mp:100}),30,'同系MP軽減は最大70%');
}
