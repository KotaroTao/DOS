// 種類ごとの成分参照を、従来の全件走査と比較する。条件付きの合計は保存しない。
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as combat from '../../src/combat.js';
import {makeDoll} from '../../src/souls.js';
import {decideAuto,setResistKnown} from '../../src/autotactics.js';
import {refSerialize,refDeserialize} from '../../src/savegraph.js';
import {reseedRng,rngState} from '../../src/rng.js';
const root=new URL('../../src/',import.meta.url).href;
let source=readFileSync(new URL('../../src/combat.js',import.meta.url),'utf8');
if(process.argv.includes('--reference'))source=readFileSync(process.argv[process.argv.indexOf('--reference')+1],'utf8');
else {
 assert(source.includes('for (const { c, lv } of perksByType(all, type)) {'),'比較する種類別ループが見つからない');
 assert(source.includes('if (!all.length) continue;'),'比較する空の成分列の経路が見つからない');
 assert(/  _perkValue\(a, type\) \{[\s\S]*?\n  \}/.test(source),'比較する最大値の経路が見つからない');
 source=source.replace('const all = perksOf(p);\n      if (!all.length) continue;\n      for (const { c, lv } of perksByType(all, type)) {\n        if (p !== a && !c.aura) continue;', 'for (const { c, lv } of perksOf(p)) {\n        if (c.t !== type || (p !== a && !c.aura)) continue;');
 source=source.replace(/  _perkValue\(a, type\) \{[\s\S]*?\n  \}/,`  _perkValue(a, type) {
    return Math.max(0, ...perksOf(a).filter(({ c }) => c.t === type).map(({ c, lv }) => lvv(c.v, lv) || 0));
  }`);
}
const reference=await import('data:text/javascript;base64,'+Buffer.from(source.replaceAll('from "./','from "'+root)).toString('base64'));
const {Battle,SPELLS}=combat;reseedRng(42);setResistKnown(()=>true);
for(const m of [combat,reference])m.setElemKnown(()=>true);
let reads=0;
const kinds=['deal','take','crit','critDamage','heal','evade','cost','curseLock','overflow','steal'];
const components=(member,n=40,tracked=true)=>Array.from({length:n},(_,i)=>{
 const type=kinds[i%kinds.length],c={v:[.01,.02,.03],aura:i%3===0,on:i%4===0?'spell':null,when:i%5===0?{selfLow:.5}:i%7===0?{tgtAil:true}:null,best:i%11===0,bukon:i%13===0,uncapped:i%17===0};
 if(tracked)Object.defineProperty(c,'t',{enumerable:true,get(){reads++;return type;}});else c.t=type;
 return {c,lv:(member+i)%3+1,label:'検査の効果',key:'test'+i};
});
const party=Array.from({length:6},(_,i)=>Object.assign(makeDoll('参照の検査'+i),{uid:100+i,level:100,jobLv:100,hp:10000,maxhp:10000,mp:10000,maxmp:10000,atk:150,int:200,pie:180,agi:100,vit:100,luk:30,spells:['ZANKOU','DIOS','MAHALITO','GOKUENRAN','HYOUGA','TORNADO','RAIJIN','CHOUHATSU',...Object.entries(SPELLS).filter(([k,s])=>['buff','debuff','revive','cure','mana'].includes(s.kind)).slice(0,24).map(([k])=>k)],tactic:'all'}));
const enemies=Array.from({length:3},(_,i)=>({uid:300+i,key:'test',side:'enemy',alive:true,name:'検査の敵',mon:{race:'undead'},hp:10000,maxhp:10000,atk:100,vit:80,agi:70,lv:100,element:'fire'}));
const b=new Battle(party,enemies,()=>{});
party.forEach((p,i)=>{p.gearPerks=components(i);});
let cases=0,plans=0;
const compare=()=>{
 const before=JSON.stringify(refSerialize(b)),rng=[...rngState()];
 const evaluate=()=>party.flatMap(a=>[...kinds,'unknown',undefined,null,NaN,0].flatMap(type=>[b._perkValue(a,type),...['phys','spell'].map(on=>b._perkSum(a,type,{tgt:enemies[0],el:'fire',on:[on]}))]));
 Object.setPrototypeOf(b,reference.Battle.prototype);const expected=evaluate();
 Object.setPrototypeOf(b,Battle.prototype);assert.deepEqual(evaluate(),expected);
 assert.equal(JSON.stringify(refSerialize(b)),before);assert.deepEqual(rngState(),rng);cases++;
};
compare();
for(const hp of [10000,3000,0])for(const ailment of [null,'poison'])for(const alive of [true,false]){
 party[0].hp=hp;party[2].alive=alive;enemies[0].ailment=ailment;compare();
 for(const tactic of ['all','bal','life','save','blade']){
  party[0].tactic=tactic;const before=JSON.stringify(refSerialize(b)),rng=[...rngState()],expected=[],actual=[];
  Object.setPrototypeOf(b,reference.Battle.prototype);const plan=decideAuto(b,party[0],expected);
  Object.setPrototypeOf(b,Battle.prototype);assert.deepEqual(decideAuto(b,party[0],actual),plan);assert.deepEqual(actual,expected);
  assert.equal(JSON.stringify(refSerialize(b)),before);assert.deepEqual(rngState(),rng);plans++;
 }
}
// 再計算・装備変更・値の更新・保存復元で古い結果を返さない。
party[0].passiveMap={exorcistJouka:4};compare();party[0].passiveMap={seraTerasu:2};compare();
party[0].gearPerks=components(1,20);compare();party[0].gearPerks[0].lv=3;party[0].gearPerks[0].c.v=[.02,.04,.06];compare();
party[0].gearPerks=null;compare();party[0].gearPerks=components(0);compare();
const restored=refDeserialize(refSerialize(b));
for(const [m,proto] of [[reference,reference.Battle.prototype],[combat,Battle.prototype]]){
 Object.setPrototypeOf(restored,proto);const expected=restored._perkSum(restored.party[0],'deal',{tgt:restored.enemies[0],on:['phys']});
 Object.setPrototypeOf(b,proto);assert.equal(b._perkSum(party[0],'deal',{tgt:enemies[0],on:['phys']}),expected);
}
// ウォームアップ後、無関係な成分の種類を読み直さないことを確認する。
const sample=()=>{for(let i=0;i<100;i++){b._perkSum(party[0],'crit',{tgt:enemies[0],on:['phys']});b._perkValue(party[0],'curseLock');}};
Object.setPrototypeOf(b,reference.Battle.prototype);sample();reads=0;sample();const beforeReads=reads;
Object.setPrototypeOf(b,Battle.prototype);sample();reads=0;sample();const afterReads=reads;
assert(beforeReads>0&&afterReads===0);
const timing={};
if(process.argv.includes('--bench'))for(const equipment of [false,true]){
 party.forEach((p,i)=>{p.hp=p.maxhp;p.alive=true;p.gearPerks=equipment?components(i,40,false):null;});party[0].tactic='all';
 const table={before:[],after:[]};
 const states={before:refDeserialize(refSerialize(b)),after:refDeserialize(refSerialize(b))};
 Object.setPrototypeOf(states.before,reference.Battle.prototype);Object.setPrototypeOf(states.after,Battle.prototype);
 for(let i=0;i<16;i++)for(const label of i%2?['after','before']:['before','after']){
  // 別々の戦闘を使い、計測中にprototypeを付け替えない。初回の分類コストも含める。
  const state=states[label];state.party.forEach((p,j)=>{p.gearPerks=equipment?components(j,40,false):null;});
  const start=performance.now();decideAuto(state,state.party[0]);if(i>=8)table[label].push(performance.now()-start);
 }
 for(const label of ['before','after']){const a=table[label].sort((x,y)=>x-y),mid=a.length/2;table[label]={medianMs:(a[mid-1]+a[mid])/2,totalMs:a.reduce((x,y)=>x+y,0)};}
 timing[equipment?'withEffects':'withoutEffects']=table;
}
console.log(JSON.stringify({cases,plans,exactValues:true,exactCandidates:true,inputUnchanged:true,rngUnchanged:true,typeReads:{before:beforeReads,after:afterReads},...(process.argv.includes('--bench')?{timing}:{})}));
