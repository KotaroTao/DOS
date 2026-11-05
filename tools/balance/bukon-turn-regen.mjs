// 指定された20段階の割合を、装備集計と実際のターン開始処理で検証する。
import assert from 'node:assert/strict';
import {BUKON,bukonDef,bukonItem,bukonName,bukonDescription,rollBukon,stockAdd,applySnapshotFusion,validBukon} from '../../src/bukon.js';
import {makeDoll} from '../../src/souls.js';
import {recalc} from '../../src/items.js';
import {Battle} from '../../src/combat.js';
import {reseedRng} from '../../src/rng.js';
import {refSerialize,refDeserialize} from '../../src/savegraph.js';
reseedRng(31415);
const mp=[1,1.5,2,2.5,3,3.5,4,4.5,5,6], hp=[5,7.5,10,12.5,15,17.5,20,22.5,25,30];
const gear=(slot,bukon,eff={})=>({slot,rar:'lr',bukon,eff});
const foe=()=>({uid:999,name:'検証の敵',side:'enemy',alive:true,hp:1e9,maxhp:1e9,atk:1,vit:1,agi:1,int:1,pie:1,luk:1,lv:1,element:'none',spells:[]});
function actor(lv){
 const p=makeDoll('回復する人業');p.equip={body:gear('body',[{k:'turn_hp_regen',lv}]),head:gear('head',[{k:'turn_mp_regen',lv}])};recalc(p);
 Object.assign(p,{hp:1,maxhp:1000000,mp:0,maxmp:10000,agi:1000000});return p;
}
for(let lv=1;lv<=10;lv++){
 for(const [k,values,stat] of [['turn_mp_regen',mp,'mpRegen'],['turn_hp_regen',hp,'regen']]){
  const d=bukonDef(k),b={k,lv};assert.equal(d.rarity,3);assert.equal(d.max,10);assert(!validBukon({k,lv:11}));
  assert(bukonName(b).includes(`${values[lv-1]}%`));assert(bukonDescription(b).includes(`${values[lv-1]}%`));
  for(const slot of d.slots)assert.equal(bukonItem(gear(slot,[b])).eff[stat],values[lv-1]/100);
  const pool=BUKON.filter(x=>!x.retired&&x.rarity===3&&x.slots.includes('body'));
  const rolls=[.98,(pool.indexOf(d)+.5)/pool.length,.99];
  assert.equal(rollBukon({slot:'body',rar:'sr'},0,()=>rolls.shift()).k,k,'橙の抽選対象');
 }
 const p=actor(lv),b=new Battle([p],[foe()],()=>{});
 assert.equal(b._roundNo,1);assert.equal(p.hp,1,'初回ターンはHPを回復しない');assert.equal(p.mp,0,'初回ターンはMPを回復しない');
 b._startRound();assert.equal(p.hp,1+10000*hp[lv-1]);assert.equal(p.mp,100*mp[lv-1]);
 assert.equal(b.performanceReport().members[0].healing,10000*hp[lv-1],'HPだけを本人の回復量として集計');
 p.hp=p.maxhp-2;p.mp=p.maxmp-1;b._startRound();assert.equal(p.hp,p.maxhp);assert.equal(p.mp,p.maxmp);
 assert.equal(b.performanceReport().members[0].healing,10000*hp[lv-1]+2,'過剰回復を除外');
}
{
 const p=actor(10);p.equip.acc1=gear('acc',[{k:'turn_mp_regen',lv:1},{k:'turn_hp_regen',lv:1}],{regen:.1});recalc(p);
 assert.equal(p.eff.mpRegen,.06);assert.equal(p.eff.regen,.3,'弱い武魂や再生装備を加算しない');
 p.equip.acc1.eff.regen=.4;recalc(p);assert.equal(p.eff.regen,.4,'既存装備の方が強ければそちらを使う');
 const b=new Battle([p],[foe()],()=>{});p.equip={};recalc(p);b._gearFields(p);assert.equal(p.regen,0);assert.equal(p.mpRegen,0);
}
{
 const p=actor(1),other=makeDoll('生きている人業'),b=new Battle([p,other],[foe()],()=>{});
 p.alive=false;p.hp=0;p.mp=0;b._startRound();assert.equal(p.hp,0);assert.equal(p.mp,0,'戦闘不能者は回復しない');
 p.alive=true;p.hp=1;p.ailment='poison';b._naturalRecover=()=>false;b._startRound();assert.equal(p.alive,false);assert.equal(p.mp,0,'毒で倒れた後は発動しない');
}
{
 const p=actor(1),b=new Battle([p],[foe()],()=>{});p.maxhp=11;p.maxmp=1;p.hp=1;p.mp=0;b._startRound();assert.equal(p.hp,2);assert.equal(p.mp,1,'小さな回復も最低1');
 p.maxmp=0;p.mp=0;b._startRound();assert.equal(p.mp,0,'最大MP0では回復しない');
}
{
 const p=actor(9),b=new Battle([p],[foe()],()=>{}),copy=refDeserialize(refSerialize(b));Object.setPrototypeOf(copy,Battle.prototype);copy.log=()=>{};
 copy._startRound();assert.equal(copy.party[0].hp,250001);assert.equal(copy.party[0].mp,500,'保存・復帰後も同じ割合');
}
for(const k of ['turn_hp_regen','turn_mp_regen']){
 const g={gold:100000,bukonStock:{}};stockAdd(g,{k,lv:9},3);assert(applySnapshotFusion(g,[],{k,lv:9}));assert.equal(g.bukonStock[`${k}:10`],'1');
 assert.equal(applySnapshotFusion(g,[],{k,lv:10}),false,'Lv10より上には合成しない');
}
console.log('橙のHP/MP毎ターン回復: 全20段階・全装備部位・抽選・Lv10合成・初回/上限/端数/死者/毒/重複/装備解除/保存復帰/回復集計 OK');
