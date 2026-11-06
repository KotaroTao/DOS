// 二重計算を行う従来版と、全候補の採点・選択・入力不変を照合する。
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Battle,SPELLS,setElemKnown} from '../../src/combat.js';
import {makeDoll,setSkillGate} from '../../src/souls.js';
import {decideAuto,setResistKnown,TACTICS} from '../../src/autotactics.js';
import {refSerialize} from '../../src/savegraph.js';
import {rngState,reseedRng} from '../../src/rng.js';
const source=readFileSync(new URL('../../src/autotactics.js',import.meta.url),'utf8');
const start=source.indexOf('function autoEstimate('),end=source.indexOf('\n// オート中だけ',start);
assert(start>=0&&end>start);
// 従来の「既知情報と実値を常に両方計算」を比較用モジュールだけへ戻す。
const original=`function autoDamage(known,actual,t){return actual<=0||lowDamage(actual,t)?actual:known;}
const autoBasic=(b,a,t)=>autoDamage(b.estBasic(a,t,{resistKnown:resistKnown(t)}),b.estBasic(a,t,{actual:true}),t);
const autoPhys=(b,a,t,opt)=>autoDamage(b.estPhys(a,t,{...opt,resistKnown:resistKnown(t)}),b.estPhys(a,t,{...opt,actual:true}),t);
const autoSpell=(b,a,sp,t)=>autoDamage(b.estSpell(a,sp,t,{resistKnown:resistKnown(t)}),b.estSpell(a,sp,t,{actual:true}),t);
`;
const root=new URL('../../src/',import.meta.url).href;
const referenceSource=(source.slice(0,start)+original+source.slice(end)).replace(/function autoRate\(b, actor, t, base, kind\) \{[\s\S]*?\n\}/, 'const autoRate = (b, actor, t, base, kind) => b.estRate(actor, t, base, kind) <= 0 ? 0 : b.estRate(actor, t, base, kind, resistKnown(t));').replaceAll('from "./','from "'+root);
const reference=await import('data:text/javascript;base64,'+Buffer.from(referenceSource).toString('base64'));
const spells=['ZANKOU','DIOS','MAHALITO','GOKUENRAN','HYOUGA','TORNADO','RAIJIN','CHOUHATSU',...Object.entries(SPELLS).filter(([k,s])=>['buff','debuff','revive','cure','mana'].includes(s.kind)).slice(0,24).map(([k])=>k)];
reseedRng(42);
let cases=0,oldKnownCalls=0,newKnownCalls=0,bench;
for(const tactic of TACTICS)for(const element of [false,true])for(const resist of [false,true])for(const scenario of ['normal','injured','immune','metal','sealed','insight','magicWeapon']){
 setElemKnown(()=>element);setResistKnown(()=>resist);reference.setResistKnown(()=>resist);
 setSkillGate(k=>scenario!=='sealed'||SPELLS[k]?.kind==='phys');
 const party=Array.from({length:6},(_,i)=>Object.assign(makeDoll('検証'+i),{uid:100+i,level:100,jobLv:100,atk:100,int:200,pie:180,agi:100,vit:100,hp:10000,maxhp:10000,mp:10000,maxmp:10000,spells:spells.slice(),tactic:tactic.key,skillOrder:spells.slice().reverse()}));
 party[1].autoOff=['GOKUENRAN'];party[2].skillOff=['DIOS'];
 if(scenario==='injured'){party[1].hp=1;party[2].hp=0;party[2].alive=false;party[3].ailment='paralyze';party[4].mp=1;}
 if(scenario==='insight')party[0].gearMisc={insight:true,bk_twinSoul:.5};
 if(scenario==='magicWeapon'){party[0].wMagic=true;party[0].attackElement='fire';}
 const enemies=Array.from({length:scenario==='metal'?1:3},(_,i)=>({uid:300+i,side:'enemy',alive:true,key:'test',mon:{race:'undead'},hp:10000,maxhp:10000,atk:150,agi:30,vit:100,lv:100,element:'fire',affinity:{weak:['water'],resist:['fire'],absorb:scenario==='magicWeapon'&&i===2?['fire']:[]},magWeak:i===1?1.3:0,physResist:scenario==='immune'?100:i*25,magResist:scenario==='immune'?100:i*25}));
 if(scenario==='metal')Object.assign(enemies[0],{metal:1,hp:10,maxhp:10});
 const b=new Battle(party,enemies,()=>{}),actor=party[0],before=JSON.stringify(refSerialize(b)),rng=[...rngState()];
 let calls=0;const methods=new Map();
 for(const method of ['estPhys','estSpell','estRate']){const fn=b[method];methods.set(method,fn);b[method]=function(...args){calls++;return fn.apply(this,args);};}
 const expected=[],actual=[];
 const plan1=reference.decideAuto(b,actor,expected),oldCalls=calls;calls=0;
 const plan2=decideAuto(b,actor,actual),newCalls=calls;
 assert.deepEqual(actual,expected,[tactic.key,element,resist,scenario].join('/'));
 assert.deepEqual(plan2,plan1);
 assert.equal(JSON.stringify(refSerialize(b)),before,'入力を変更した');
 assert.deepEqual(rngState(),rng,'乱数を消費した');
 if(element&&resist){oldKnownCalls+=oldCalls;newKnownCalls+=newCalls;}
 for(const [method,fn] of methods)b[method]=fn;
 if(element&&resist&&scenario==='normal'&&tactic.key==='all')bench={b,actor};
 cases++;
}
setSkillGate(null);setElemKnown(null);setResistKnown(null);
assert(newKnownCalls<oldKnownCalls*.65,'既知の敵で二重計算が残った');
const timing={before:[],after:[]};
if(process.argv.includes('--bench')){
 setElemKnown(()=>true);setResistKnown(()=>true);reference.setResistKnown(()=>true);
 for(let i=0;i<10;i++)for(const [label,fn] of i%2?[['after',decideAuto],['before',reference.decideAuto]]:[['before',reference.decideAuto],['after',decideAuto]]){
  const start=performance.now();fn(bench.b,bench.actor);if(i>=4)timing[label].push(performance.now()-start);
 }
 for(const label of ['before','after']){const a=timing[label].sort((x,y)=>x-y);timing[label]={medianMs:(a[2]+a[3])/2,totalMs:a.reduce((x,y)=>x+y,0)};}
}
console.log(JSON.stringify({cases,exactCandidates:true,inputUnchanged:true,rngUnchanged:true,knownEstimateCalls:{before:oldKnownCalls,after:newKnownCalls},...(process.argv.includes('--bench')?{timing}:{} )}));
