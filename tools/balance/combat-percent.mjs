// 合意した数値の境界、敵味方・実戦・予測・装備への接続を確認する。
import assert from 'node:assert/strict';
import { procChance, hitChance, elementalReduction, elementMultiplier, elementResistance } from '../../src/combatrules.js';
import { Battle, SPELLS } from '../../src/combat.js';
import { makeDoll } from '../../src/souls.js';
import { recalc, registerAffixes } from '../../src/items.js';
import { applyAffixes, gearPerks } from '../../src/infaffix.js';
import { monsterResists } from '../../src/resistance.js';
import { useMathRandom } from '../../src/rng.js';
import { refSerialize, refDeserialize } from '../../src/savegraph.js';
registerAffixes(applyAffixes, gearPerks); useMathRandom();
const near=(a,b,msg='')=>assert(Math.abs(a-b)<1e-9,`${msg}: ${a} != ${b}`);
const doll=()=>Object.assign(makeDoll('割合検査'),{side:'party',alive:true,jobLv:1,atk:1000,vit:0,agi:100,int:1000,pie:1000,luk:8,hp:1e8,maxhp:1e8,mp:1e8,maxmp:1e8,spells:[]});
const foe=()=>({name:'検査の敵',side:'enemy',key:'percent_test',uid:999,alive:true,lv:1e6,hp:1e8,maxhp:1e8,atk:1000,vit:0,agi:100,int:1000,pie:1000,luk:8,element:'none',affinity:{weak:[],resist:[]},resists:{},effects:[],spells:[]});
near(procChance(.8,.5),.4);near(procChance(3,.95),.15);near(procChance(3,1),0);near(procChance(3,0),.95);near(procChance(.001,0),.001);near(procChance(0,0),0);
const hitTable=[[.95,.8,.5,.2],[.95,.95,.75,.3],[.95,.95,.95,.4],[.95,.95,.95,.6]];
[1,1.5,2,3].forEach((power,i)=>[0,.2,.5,.8].forEach((evade,j)=>near(hitChance(power,evade),hitTable[i][j])));
near(hitChance(3,.8),.6);near(hitChance(3,.8,true),1);
[0,100,200,400,10000].forEach((power,i)=>near(elementalReduction(power),[0,.5,2/3,.8,.8][i]));
near(elementMultiplier('fire',150,{el:'fire',pct:200}),.5);
near(elementMultiplier('fire',150,{el:'water',pct:200}),1.5);
near(elementMultiplier('fire',100,null,null),1);
near(elementMultiplier('none',300,{el:'fire',pct:400}),1);
near(elementMultiplier('fire',300,{el:'fire',pct:400}),.6);
near(elementResistance('fire',{el:'fire',pct:800},null,.5),400);
{
 const a=doll(),t=foe(),b=new Battle([a],[t],()=>{});
 for(const [attacker,target] of [[a,t],[t,a]]){
  target.resists={poison:50};
  near(b._rate(attacker,target,.8,'poison'),.4);
  attacker.jobLv=attacker.lv=1e9;target.jobLv=target.lv=1;
  near(b._rate(attacker,target,.8,'poison'),.4);
  target.resists.poison=95;near(b._rate(attacker,target,3,'poison'),.15);
  attacker.gearMisc={binder:true};near(b._rate(attacker,target,2,'poison'),attacker.side==='party'?.15:.1);attacker.gearMisc=null;
 }
 const low=monsterResists({id:'fixed',race:'beast',rank:1});
 assert.deepEqual(monsterResists({id:'fixed',race:'beast',rank:100000}),low,'耐性をLvで自動増加させない');
 t.resists={};a.agi=t.agi=100;b._foeAgiBase=(e,agi)=>agi;b._bm=()=>1;
 near(b._evadeBase(t,a),.1);a.agi=200;near(b._evadeBase(t,a),0);a.agi=50;near(b._evadeBase(t,a),.2);
 b._evadeBase=()=>0;t.evadeBonus=.8;t.passiveMap={parry:2};
 near(b._missP(t,a),.8);near(b._missP(t,a,{acc:2}),.4);near(b._missP(t,a,{sureHit:true}),0);
}
{
 const a=makeDoll('装備検査');
 a.equip.weapon={slot:'weapon',eAtk:{el:'fire',lv:1},onHit:{k:'paralyze',chance:.4}};
 a.equip.body={slot:'body',eAtk:{el:'fire',pct:50},eDef:{el:'fire',pct:200},onHit:{k:'paralyze',chance:.4}};
 a.equip.acc1={slot:'acc',eAtk:{el:'water',pct:200},eDef:{el:'water',pct:400}};
 recalc(a);assert.equal(a.elemAtk.values.fire,100);assert.equal(a.elemAtk.values.water,200);
 assert.equal(a.elemDef.values.fire,200);assert.equal(a.elemDef.values.water,400);assert.equal(a.onHit[0].chance,.8);
 assert.equal(a.attackElement,'fire');a.equip.weapon=null;recalc(a);assert.equal(a.attackElement,'none');
 const restored=refDeserialize(refSerialize({a})).a;recalc(restored);assert.deepEqual(restored.elemDef,a.elemDef);
}
const oldRandom=Math.random;Math.random=()=>.5;
try {
 // 5連撃に装備と技の麻痺が重なっても、加算後に一回だけ判定。
 const a=doll(),t=foe(),b=new Battle([a],[t],()=>{});
 a.onHit=[{k:'paralyze',chance:.8}];t.resists.paralyze=50;
 SPELLS.PERCENT_TEST={kind:'phys',name:'割合の五連撃',mp:0,power:.1,hits:5,sureHit:true,para:.2,target:'enemy'};
 near(b.spellStatusChances(a,SPELLS.PERCENT_TEST,t)[0].rate,.5,'装備と技の付与力を表示にも加算');
 let rolls=0,power=0;const rate=b._rate.bind(b);
 b._rate=(actor,target,base,kind,...rest)=>{if(kind==='paralyze'){rolls++;power=base;}return rate(actor,target,base,kind,...rest);};
 const result=b._exec({actor:a,action:'spell',spellKey:'PERCENT_TEST',target:t});
 assert.equal(result.hits.filter(h=>h.dmg).length,5);assert.equal(rolls,1);near(power,1);assert(!t.ailment,'成功率50%、乱数50%では付かない');
 a.gearPerks=[0,1].map(i=>({c:{t:'hit',ail:'para',chance:.4},lv:1,label:'同名の武魂',key:'gear'+i}));
 rolls=0;power=0;
 near(b.spellStatusChances(a,SPELLS.PERCENT_TEST,t)[0].rate,.9,'同名の別装備も合算');rolls=0;
 b._exec({actor:a,action:'spell',spellKey:'PERCENT_TEST',target:t});assert.equal(rolls,1);near(power,1.8);
 delete SPELLS.PERCENT_TEST;
 // 主の異常の種類を交互にしても、一手番の回復猶予を越えられない。
 const boss=foe();boss.boss=true;const bb=new Battle([doll()],[boss],()=>{});const p=bb.party[0];
 bb._inflict(p,boss,{sleepChance:3});assert(boss.asleep);bb.current=boss;bb.enemyAct();
 assert(!boss.asleep);assert(boss._ccRecovery);
 for(const k of ['paralyze','sleep','charm','confuse','flinch'])near(bb._rate(p,boss,3,k),0,k);
 bb.current=boss;bb.enemyAct();assert(!boss._ccRecovery);near(bb._rate(p,boss,.8,'sleep'),.8);
 // 80%物理＋80%属性は恒常90%軽減。防御はその後に半減。
 const damage=(kind,protectedGear=false,defending=false)=>{
  const p=doll(),e=foe();e.element='fire';
  const battle=new Battle([p],[e],()=>{});p._defending=defending;
  if(protectedGear){p.physResist=p.magResist=80;p.elemDef=protectedGear==='direct'?{kind:'defense',reductions:{fire:.8}}:{el:'fire',pct:400};}
  if(kind==='phys')return battle._physical(e,p,{sureHit:true}).dmg;
  return battle._exec({actor:e,action:'breath',kind:'spell'}).hits.find(h=>h.target===p).dmg;
 };
 for(const kind of ['phys','magic'])for(const form of [true,'direct']){
  const baseline=damage(kind),reduced=damage(kind,form),guarded=damage(kind,form,true);
  assert(Math.abs(reduced-baseline*.1)<=2,`${kind} 常時90%: ${baseline} -> ${reduced}`);
  assert(Math.abs(guarded-reduced*.5)<=2,`${kind} 防御は別: ${reduced} -> ${guarded}`);
 }
 // 無効・吸収は耐性力とは別の特性。吸収された攻撃の状態異常は付かない。
 for(const disposition of ['immune','absorb']){
  const p=doll(),e=foe(),battle=new Battle([p],[e],()=>{});p.attackElement='fire';p.onHit=[{k:'poison',chance:3,pct:.05}];e.hp=e.maxhp/2;e.affinity[disposition]=['fire'];
  const before=e.hp,res=battle._exec({actor:p,action:'attack',target:e});
  assert(!e.ailment);assert.equal(battle.estPhys(p,e,{actual:true}),0);
  if(disposition==='immune')assert.equal(e.hp,before);else assert(e.hp>before);
  assert(res.hits.some(h=>disposition==='immune'?h.immune:h.absorbed));
 }
 // 実ダメージとオート予測の耐性・属性・貫通を同条件で多数比較。
 let seed=42;Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
 for(const [resist,wedge,twinSoul] of [[0,0,false],[50,0,false],[80,0,false],[95,10,false],[80,0,true]]){
  const p=doll(),e=foe();p.attackElement='fire';p.elemAtk={el:'fire',pct:200};e.elemDef={el:'fire',pct:400};e.physResist=resist;e._wedge=wedge;e.magResist=20;p.gearMisc={twinSoul};
  const battle=new Battle([p],[e],()=>{});const opt={sureHit:true,actual:true,power:1,pierce:.2};
  const expected=battle.estPhys(p,e,opt);let total=0;
  for(let i=0;i<4000;i++){e.hp=e.maxhp;e.alive=true;total+=battle._physical(p,e,opt).dmg;}
  assert(Math.abs(total/4000-expected)/expected<.035,`実測と予測 ${resist}: ${total/4000}/${expected}`);
 }
} finally {Math.random=oldRandom;}
console.log('OK 割合戦闘：付与力300%・Lv差なし・両側耐性・命中表・属性加算/弱体・混合保存・連撃一回判定・主の回復猶予・恒常90%/防御別・実測と予測');
