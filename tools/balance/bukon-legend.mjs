// 従来の極の全件収録と、実物の武魂から戦闘・魂への接続を確認する。
import assert from 'node:assert/strict';
import { AFX, applyAffixes, gearPerks } from '../../src/infaffix.js';
import { BUKON, LEGENDARY_BUKON, bukonDef, bukonText, bukonItem, validBukon, stockAdd, attachBukon, detachBukon, recoverBukon, fusionPlan, bulkFuseBukon, rollBukon } from '../../src/bukon.js';
import { recalc, registerAffixes, SLOTS } from '../../src/items.js';
import { makeDoll, makeSoulInstance, setSharedSouls, kindleSubIndex, subPickCapFor, subPickCap } from '../../src/souls.js';
import { Battle } from '../../src/combat.js';
import { refSerialize, refDeserialize } from '../../src/savegraph.js';
registerAffixes(applyAffixes,gearPerks);
assert.equal(BUKON.length,125);
assert.equal(LEGENDARY_BUKON.length,39);
assert.deepEqual(LEGENDARY_BUKON.map(d=>d.id).sort(),AFX.filter(d=>d.tier==='x'&&!d.retired).map(d=>d.id).sort());
for(const old of LEGENDARY_BUKON){
 const d=bukonDef(old.id),soul={k:old.id,lv:1};
 assert.equal(d.rarity,4);assert.equal(d.max,1);assert(!validBukon({...soul,lv:2}));
 assert(bukonText(soul).includes(d.name),old.id+' 名前表示');
 let it={slot:'body',rar:'lr',price:123,bukon:[soul]},raw=JSON.stringify(it);
 const derived=bukonItem(it);assert.equal(JSON.stringify(it),raw,old.id+' 本体を変更しない');
 const expectedMisc=old.misc?.(old.r[0],25)||{};
 assert.deepEqual(derived.afxMisc,expectedMisc,old.id+' 探索・戦闘の印');
 const expectedFx=old.fx?.(old.r[0],25)||[];
 assert.deepEqual(derived.afxFx.map(x=>x.c),expectedFx,old.id+' パッシブ成分');
 const doll=makeDoll('激レア検査');doll.equip.body=it;recalc(doll);
 for(const [key,v] of Object.entries(expectedMisc))assert.equal(doll.gearMisc[key],v,old.id+'/'+key);
 assert.equal(doll.gearPerks?.length || 0,expectedFx.length,old.id+' 戦闘の特性');
 if(old.id==='J11')assert.equal(doll.eff.autoRevive,.1);
 const before={misc:doll.gearMisc,fx:doll.gearPerks,eff:doll.eff};
 doll.equip.acc1={...it,slot:'acc'};recalc(doll);
 assert.deepEqual({misc:doll.gearMisc,fx:doll.gearPerks,eff:doll.eff},before,old.id+' 複数部位で重複しない');
 doll.equip.body=null;recalc(doll);
 assert.deepEqual({misc:doll.gearMisc,fx:doll.gearPerks,eff:doll.eff},before,old.id+' 一方を外しても残る');
 doll.equip.acc1=null;recalc(doll);assert.equal(doll.gearMisc,null);assert.equal(doll.gearPerks,null);assert.equal(doll.eff,null);
 const g={};stockAdd(g,soul,3);assert.equal(fusionPlan(g,old.id,2),null);bulkFuseBukon(g,old.id,0);assert.equal(g.bukonStock[old.id+':1'],'3');
 assert(attachBukon(g,it={slot:'weapon',rar:'lr'},soul));
 assert(detachBukon(g,it,0));assert(attachBukon(g,it,soul));assert.equal(recoverBukon(g,it),1);assert.equal(g.bukonStock[old.id+':1'],'3');
 assert.deepEqual(refDeserialize(refSerialize(g)),g,old.id+' 保存');
 // 抽選の区間を指定し、R/SR/LRの全てでこの武魂を実際に引けることを確認。
 for(const [rar,r] of [['r',0],['sr',1],['lr',2]]){
  const weights=BUKON.map(x=>[100,30,6,1,.04][x.rarity]*(x.rarity?(1+r*.8)**x.rarity:1));
  const index=BUKON.indexOf(d),total=weights.reduce((a,b)=>a+b,0),pick=(weights.slice(0,index).reduce((a,b)=>a+b,0)+weights[index]/2)/total;
  assert.deepEqual(rollBukon({rar},100,()=>pick),soul,old.id+' '+rar+'ドロップ');
 }
}
// 複数の異なる最上位特性を、部位制限なく同じLRの枠内で併用できる。
const mixed=makeDoll('複合');mixed.equip.weapon={slot:'weapon',rar:'lr',bukon:['X07','X08','X30','J10','J11'].map(k=>({k,lv:1}))};recalc(mixed);
assert.equal(mixed.gearMisc.fortress,.5);assert.equal(mixed.gearMisc.split,.5);assert(mixed.gearMisc.firstTurn);assert.equal(mixed.eff.autoRevive,.1);
const native=bukonItem({eff:{autoRevive:.3},bukon:[{k:'J11',lv:1}]});assert.equal(native.eff.autoRevive,.3,'固有の強い蘇生を維持');
const main=makeSoulInstance('fighter',0,30),sub=makeSoulInstance('mage',0,30);setSharedSouls([main,sub]);mixed.subs=[{uid:sub.uid}];
assert.equal(kindleSubIndex(mixed),0,'集計前にも宿り火を認識');assert.equal(subPickCapFor(mixed,mixed.subs[0]),subPickCap(sub)+1);
const foe={uid:123,name:'検査の敵',side:'enemy',alive:true,hp:10000,maxhp:10000,atk:10,vit:0,agi:99999,int:10,pie:10,luk:0,lv:1,element:'none',spells:[]};
mixed.hp=mixed.maxhp;const battle=new Battle([mixed],[foe],()=>{});
assert.equal(battle.current,mixed,'一番手が武魂から発動');
assert.equal(battle._gearGuard(mixed,mixed.maxhp*10,'phys'),Math.ceil(mixed.maxhp*.5),'金城が発動');
assert.equal(battle._gearSplit(mixed,100),50);assert.deepEqual(mixed._splitQ,[25,25]);
mixed.hp=0;assert.equal(battle._die(mixed),false);assert.equal(mixed.hp,Math.max(1,Math.round(mixed.maxhp*.1)));mixed.hp=0;assert.equal(battle._die(mixed),true,'不屈は一戦闘一度');
const mirror=makeDoll('鏡鎧');mirror.equip.feet={bukon:[{k:'J20',lv:1}]};recalc(mirror);
const reflected={...foe},mb=new Battle([mirror],[reflected],()=>{});const beforeHp=reflected.hp;
mb._perkHurt(mirror,reflected,1,'spell');assert(reflected.hp<beforeHp,'鏡鎧が魔法を受けて実際に返す');
const steady=makeDoll('不動心');steady.equip.feet={bukon:[{k:'X12',lv:1}]};recalc(steady);assert.equal(steady.resists.charm,95);assert.equal(steady.resists.confuse,95);assert.equal(steady.resists.seal,95);
const order=makeDoll('号令');order.equip.feet={bukon:[{k:'J02',lv:1}]};recalc(order);const ob=new Battle([order],[{...foe}],()=>{});assert.equal(ob.stageOf(order,'atk'),1);
console.log('OK 激レア39種：全件収録・全R/SR/LR抽選・保存回収・重複なし・全成分の接続・固定Lv・金城/痛み分け/宿り火/一番手/不屈/号令の発動');
