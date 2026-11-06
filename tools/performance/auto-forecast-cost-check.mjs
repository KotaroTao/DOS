// 先読みのMP費用を毎回読み直す従来版と、全候補・選択・入力を照合する。
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Battle,SPELLS,setElemKnown} from '../../src/combat.js';
import {makeDoll,setSkillGate} from '../../src/souls.js';
import {decideAuto,setResistKnown,TACTICS} from '../../src/autotactics.js';
import {refSerialize,refDeserialize} from '../../src/savegraph.js';
import {rngState,reseedRng} from '../../src/rng.js';
const root=new URL('../../src/',import.meta.url).href;
let forecast=readFileSync(new URL('../../src/autoforecast.js',import.meta.url),'utf8');
if(process.argv.includes('--reference'))forecast=readFileSync(process.argv[process.argv.indexOf('--reference')+1],'utf8');
else {
 // 現行コードから、この変更で除いた重複計算だけを比較用モジュールへ戻す。
 const changes=[
  ['if (!sp || !(sp.kind === "phys" || sp.kind === "atk" || sp.instakill)) continue;\n    // この手番の候補を比べ、選んだ手を適用するまでだけ共用する。\n    const cost = b.costOf(a, sp, key);\n    if (a.mp < cost) continue;', 'if (!sp || !(sp.kind === "phys" || sp.kind === "atk" || sp.instakill) || a.mp < b.costOf(a, sp, key)) continue;'],
  [', target, mpCost: cost }', ', target }'],
  ['support = true, mpCost = null)', 'support = true)'],
  ['mpCost ?? b.costOf(a, sp, cmd.spellKey)', 'b.costOf(a, sp, cmd.spellKey)'],
  ['      let price;\n', ''],
  ['const cost = cmd.spellKey ? cmd.mpCost : 0;\n        if (price === undefined) price = est.price(p);\n        const v = raw - cost * price;', 'const cost = cmd.spellKey ? sim.costOf(p, SPELLS[cmd.spellKey], cmd.spellKey) : 0;\n        const v = raw - cost * est.price(p);'],
  ['apply(sim, p, best, est, true, best.mpCost)', 'apply(sim, p, best, est)'],
 ];
 for(const [after,before] of changes){assert(forecast.includes(after),'比較箇所が見つからない: '+after);forecast=forecast.replace(after,before);}
}
const url='data:text/javascript;base64,'+Buffer.from(forecast.replaceAll('from "./','from "'+root)).toString('base64');
const source=readFileSync(new URL('../../src/autotactics.js',import.meta.url),'utf8').replace('from "./autoforecast.js"','from "'+url+'"').replaceAll('from "./','from "'+root);
const reference=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const spells=['ZANKOU','DIOS','MAHALITO','GOKUENRAN','HYOUGA','TORNADO','RAIJIN','CHOUHATSU',...Object.entries(SPELLS).filter(([k,s])=>['buff','debuff','revive','cure','mana'].includes(s.kind)).slice(0,24).map(([k])=>k)];
reseedRng(42);
let cases=0,oldCostCalls=0,newCostCalls=0,bench;
for(const tactic of TACTICS)for(const element of [false,true])for(const resist of [false,true])for(const scenario of ['normal','injured','immune','metal','sealed','insight','magicWeapon','lowMp','minCost','memory','costPerks','mpCondition','tick']){
 setElemKnown(()=>element);setResistKnown(()=>resist);reference.setResistKnown(()=>resist);
 setSkillGate(k=>scenario!=='sealed'||SPELLS[k]?.kind==='phys');
 const party=Array.from({length:6},(_,i)=>Object.assign(makeDoll('検証'+i),{uid:100+i,level:100,jobLv:100,atk:100,int:200,pie:180,agi:100,vit:100,hp:10000,maxhp:10000,mp:10000,maxmp:10000,spells:spells.slice(),tactic:tactic.key,skillOrder:spells.slice().reverse()}));
 party[1].autoOff=['GOKUENRAN'];party[2].skillOff=['DIOS'];
 if(scenario==='injured'){party[1].hp=1;party[2].hp=0;party[2].alive=false;party[3].ailment='paralyze';party[4].mp=1;}
 if(scenario==='insight')party[0].gearMisc={insight:true,bk_twinSoul:.5};
 if(scenario==='magicWeapon'){party[0].wMagic=true;party[0].attackElement='fire';}
 if(scenario==='lowMp')party.forEach((p,i)=>{p.mp=i*3;});
 if(scenario==='minCost')party.forEach(p=>{p.spellCostMul=.001;});
 if(scenario==='memory')party.forEach(p=>{p.gearMisc={memory:true,bk_memory:.5};});
 if(scenario==='costPerks')party.forEach(p=>{p.gearPerks=[{c:{t:'cost',v:.2},lv:1},{c:{t:'cost',v:.1,aura:true},lv:1}];});
 if(scenario==='mpCondition')party.forEach(p=>{p.mp=70;p.maxmp=100;p.gearPerks=[{c:{t:'deal',v:.4,when:{mpHigh:.5}},lv:1}];});
 const enemies=Array.from({length:scenario==='metal'?1:3},(_,i)=>({uid:300+i,side:'enemy',alive:true,key:'test',mon:{race:'undead'},hp:10000,maxhp:10000,atk:150,agi:30,vit:100,lv:100,element:'fire',affinity:{weak:['water'],resist:['fire'],absorb:scenario==='magicWeapon'&&i===2?['fire']:[]},magWeak:i===1?1.3:0,physResist:scenario==='immune'?100:i*25,magResist:scenario==='immune'?100:i*25}));
 if(scenario==='metal')Object.assign(enemies[0],{metal:1,hp:10,maxhp:10});
 const b=new Battle(party,enemies,()=>{}),actor=party[0];
 if(scenario==='memory')party.forEach(p=>{p._lastSkill='MAHALITO';});
 if(scenario==='tick')party.forEach(p=>{p.effects=[{stat:'int',mult:1.5,turns:1}];b._recalcBuffs(p);});
 const before=JSON.stringify(refSerialize(b)),rng=[...rngState()];
 let calls=0;const methods=new Map();
 for(const method of ['costOf']){const fn=b[method];methods.set(method,fn);b[method]=function(...args){calls++;return fn.apply(this,args);};}
 const expected=[],actual=[];
 const plan1=reference.decideAuto(b,actor,expected),oldCalls=calls;calls=0;
 const plan2=decideAuto(b,actor,actual),newCalls=calls;
 assert.deepEqual(actual,expected,[tactic.key,element,resist,scenario].join('/'));
 assert.deepEqual(plan2,plan1);
 assert.equal(JSON.stringify(refSerialize(b)),before,'入力を変更した');
 assert.deepEqual(rngState(),rng,'乱数を消費した');
 if(element&&resist){oldCostCalls+=oldCalls;newCostCalls+=newCalls;}
 for(const [method,fn] of methods)b[method]=fn;
 if(element&&resist&&scenario==='normal'&&tactic.key==='all')bench={b,actor};
 cases++;
}
setSkillGate(null);setElemKnown(null);setResistKnown(null);
assert(newCostCalls<oldCostCalls*.7,'先読みの消費MPの重複計算が残った');
const timing={};
if(process.argv.includes('--bench')){
 setElemKnown(()=>true);setResistKnown(()=>true);reference.setResistKnown(()=>true);
 for(const equipment of [false,true]){
 const table={before:[],after:[]};
 const states={before:refDeserialize(refSerialize(bench.b)),after:refDeserialize(refSerialize(bench.b))};
 for(const state of Object.values(states)){
  Object.setPrototypeOf(state,Battle.prototype);
  if(equipment)state.party.forEach(p=>{p.gearPerks=Array.from({length:40},(_,i)=>({c:{t:i%5===0?'cost':['deal','take','crit','heal'][i%4],v:.01},lv:1}));});
 }
 for(let i=0;i<16;i++)for(const label of i%2?['after','before']:['before','after']){
  const state=states[label],fn=label==='before'?reference.decideAuto:decideAuto;
  const start=performance.now();fn(state,state.party[0]);if(i>=8)table[label].push(performance.now()-start);
 }
 for(const label of ['before','after']){const a=table[label].sort((x,y)=>x-y),mid=a.length/2;table[label]={medianMs:(a[mid-1]+a[mid])/2,totalMs:a.reduce((x,y)=>x+y,0)};}
 timing[equipment?'withEffects':'withoutEffects']=table;
 }
}
console.log(JSON.stringify({cases,exactCandidates:true,inputUnchanged:true,rngUnchanged:true,costCalls:{before:oldCostCalls,after:newCostCalls},...(process.argv.includes('--bench')?{timing}:{} )}));
