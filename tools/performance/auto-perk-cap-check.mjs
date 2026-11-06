// 固定の武魂上限表を共用しても、合計・上限・加算順が変わらないことを確認する。
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Battle,SPELLS,setElemKnown} from '../../src/combat.js';
import {makeDoll} from '../../src/souls.js';
import {decideAuto,setResistKnown} from '../../src/autotactics.js';
import {refSerialize,refDeserialize} from '../../src/savegraph.js';
import {reseedRng,rngState} from '../../src/rng.js';
const root=new URL('../../src/',import.meta.url).href;
let source=readFileSync(new URL('../../src/combat.js',import.meta.url),'utf8');
if(process.argv.includes('--reference'))source=readFileSync(process.argv[process.argv.indexOf('--reference')+1],'utf8');
else {
 assert(source.includes('BUKON_SUM_CAP[type]'),'上限の参照が見つからない');
 source=source.replace('BUKON_SUM_CAP[type]','({deal:1,take:.8,crit:.8,heal:1})[type]');
}
const reference=await import('data:text/javascript;base64,'+Buffer.from(source.replaceAll('from "./','from "'+root)).toString('base64'));
reseedRng(42);setElemKnown(()=>true);reference.setElemKnown(()=>true);setResistKnown(()=>true);
const spells=['ZANKOU','DIOS','MAHALITO','GOKUENRAN','HYOUGA','TORNADO','RAIJIN','CHOUHATSU',...Object.entries(SPELLS).filter(([k,s])=>['buff','debuff','revive','cure','mana'].includes(s.kind)).slice(0,24).map(([k])=>k)];
const party=Array.from({length:6},(_,i)=>Object.assign(makeDoll('上限の検査'+i),{uid:100+i,level:100,jobLv:100,hp:10000,maxhp:10000,mp:10000,maxmp:10000,atk:150,int:200,pie:180,agi:100,vit:100,luk:30,spells:spells.slice(),tactic:'all'}));
const enemies=Array.from({length:3},(_,i)=>({uid:300+i,key:'test',side:'enemy',alive:true,mon:{race:'undead'},hp:10000,maxhp:10000,atk:100,vit:80,agi:70,lv:100,element:'fire'}));
const b=new Battle(party,enemies,()=>{}),types=['deal','take','crit','heal','critDamage','evade','unknown','toString','constructor'];
let cases=0,plans=0;
for(const value of [-1,0,.3,.8,1,2,Infinity,NaN])for(const alive of [false,true])for(const injured of [false,true]){
 party.forEach((p,i)=>{
  p.alive=i===0||alive;p.hp=injured?100:10000;
  p.gearPerks=types.flatMap(t=>[
   {c:{t,bukon:true,aura:true,v:value},lv:1},
   {c:{t,bukon:true,uncapped:true,aura:true,v:.03},lv:1},
   {c:{t,best:true,aura:true,v:.04,when:{selfLow:.5}},lv:1},
   {c:{t,v:.02},lv:1},
  ]);
 });
 const before=JSON.stringify(refSerialize(b)),rng=[...rngState()];
 const evaluate=()=>party.flatMap(a=>[...types,undefined,null,NaN,0].map(t=>b._perkSum(a,t,{tgt:enemies[0],el:'fire',on:['phys']})));
 Object.setPrototypeOf(b,reference.Battle.prototype);const expected=evaluate();
 Object.setPrototypeOf(b,Battle.prototype);assert.deepEqual(evaluate(),expected);
 assert.equal(JSON.stringify(refSerialize(b)),before);assert.deepEqual(rngState(),rng);cases++;
}
const components=()=>Array.from({length:40},(_,i)=>({c:{t:['cost','deal','take','crit','heal','evade'][i%6],v:.01,on:i%4===0?'spell':null},lv:1}));
party.forEach(p=>{p.hp=p.maxhp;p.alive=true;p.gearPerks=components();});
for(const tactic of ['all','bal','life','save','blade']){
 party[0].tactic=tactic;const before=JSON.stringify(refSerialize(b)),rng=[...rngState()],expected=[],actual=[];
 Object.setPrototypeOf(b,reference.Battle.prototype);const plan=decideAuto(b,party[0],expected);
 Object.setPrototypeOf(b,Battle.prototype);assert.deepEqual(decideAuto(b,party[0],actual),plan);assert.deepEqual(actual,expected);
 assert.equal(JSON.stringify(refSerialize(b)),before);assert.deepEqual(rngState(),rng);plans++;
}
party[0].tactic='all';
const states=equipment=>{
 const pair={before:refDeserialize(refSerialize(b)),after:refDeserialize(refSerialize(b))};
 Object.setPrototypeOf(pair.before,reference.Battle.prototype);Object.setPrototypeOf(pair.after,Battle.prototype);
 if(!equipment)for(const state of Object.values(pair))state.party.forEach(p=>p.gearPerks=null);
 return pair;
};
const timing={};
if(process.argv.includes('--bench'))for(const equipment of [false,true]){
 const pair=states(equipment),table={before:[],after:[]};
 // 別々の戦闘を使い、計測中にprototypeや計数用の関数を付け替えない。
 for(let i=0;i<64;i++)for(const label of i%2?['after','before']:['before','after']){
  const state=pair[label],start=performance.now();decideAuto(state,state.party[0]);if(i>=40)table[label].push(performance.now()-start);
 }
 for(const label of ['before','after']){const a=table[label].sort((x,y)=>x-y),mid=a.length/2;table[label]={medianMs:(a[mid-1]+a[mid])/2,totalMs:a.reduce((x,y)=>x+y,0)};}
 timing[equipment?'withEffects':'withoutEffects']=table;
}
const allocations={};
if(process.argv.includes('--alloc')){
 const {Session}=await import('node:inspector/promises'),session=new Session();session.connect();
 try {
  const pair=states(true);
  for(const label of ['before','after']){
   const state=pair[label];for(let i=0;i<40;i++)decideAuto(state,state.party[0]);
   await session.post('HeapProfiler.startSampling',{samplingInterval:1024,includeObjectsCollectedByMajorGC:true,includeObjectsCollectedByMinorGC:true});
   for(let i=0;i<100;i++)decideAuto(state,state.party[0]);
   const {profile}=await session.post('HeapProfiler.stopSampling');let total=0,perkSum=0;
   const walk=node=>{total+=node.selfSize;if(node.callFrame.functionName==='_perkSum')perkSum+=node.selfSize;for(const child of node.children)walk(child);};walk(profile.head);
   allocations[label]={sampledAllocatedBytes:total,perkSumBytes:perkSum};
  }
 }finally {session.disconnect();}
}
console.log(JSON.stringify({cases,plans,exactValues:true,exactCandidates:true,inputUnchanged:true,rngUnchanged:true,...(process.argv.includes('--bench')?{timing}:{}),...(process.argv.includes('--alloc')?{allocations}:{})}));
