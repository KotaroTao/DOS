// 会心・種族特効を使わない見積もりの短縮を、従来の計算と比較する。
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
 const event='const prey = actor._evPrey;\n  if (!prey) return m;\n  for (const pr of [].concat(prey))';
 const critical='if (critP !== 0 || actor.spellCritDamageBonus) dmg *= 1 + critP * (this._spellCritMul(actor) - 1);';
 assert(source.includes(event)&&source.includes(critical),'比較する見積もりが見つからない');
 source=source.replace(event,'for (const pr of [].concat(actor._evPrey || []))');
 source=source.replace(critical,'const critMul = this._spellCritMul(actor);\n    dmg *= 1 + critP * (critMul - 1);');
}
const reference=await import('data:text/javascript;base64,'+Buffer.from(source.replaceAll('from "./','from "'+root)).toString('base64'));
reseedRng(42);setElemKnown(()=>true);reference.setElemKnown(()=>true);setResistKnown(()=>true);
const actor=Object.assign(makeDoll('見積もりの検査'),{uid:100,level:100,jobLv:100,hp:1000,maxhp:1000,mp:10000,maxmp:10000,atk:150,int:200,pie:180,agi:100,vit:100,spells:['MAHALITO','ZANKOU','DIOS','CHOUHATSU'],tactic:'all'});
const target={uid:200,key:'test',side:'enemy',alive:true,mon:{race:'undead'},hp:10000,maxhp:10000,atk:100,vit:80,agi:70,lv:100};
const b=new Battle([actor],[target],()=>{});
const normal=SPELLS.MAHALITO,gravity=Object.values(SPELLS).find(s=>s.gravity);
assert(gravity,'重力の技が見つからない');
let cases=0,plans=0;
const effects=[null,[],{races:['undead'],mul:1.5},[{races:['undead'],mul:1.2},{races:['undead'],mul:.8},{races:['beast'],mul:2}],false,[null,{}, {races:['undead'],mul:0}]];
for(const passiveMap of [{},{spellCrit:3},{arcanistShinen:4},{spellCrit:1,arcanistShinen:2}])for(const chance of [0,.2,-.5,NaN])for(const bonus of [undefined,0,.4,Number.MAX_VALUE,Infinity,NaN,'0.3'])for(const prey of effects){
 actor.passiveMap=passiveMap;actor.spellCritBonus=chance;actor.spellCritDamageBonus=bonus;actor._evPrey=prey;actor._evDmg=1.1;
 const before=JSON.stringify(refSerialize(b)),rng=[...rngState()];
 const evaluate=()=>[b.estBasic(actor,target,{actual:true}),...[normal,{...normal,critBonus:1},gravity].map(sp=>b.estSpell(actor,sp,target,{actual:true}))];
 Object.setPrototypeOf(b,reference.Battle.prototype);const expected=evaluate();
 Object.setPrototypeOf(b,Battle.prototype);assert.deepEqual(evaluate(),expected);
 assert.equal(JSON.stringify(refSerialize(b)),before,'入力が変化');assert.deepEqual(rngState(),rng,'乱数が変化');cases++;
}
// 有限の実用値で作戦の全候補も比較する。使わない補正から非有限値を消す変更にはしない。
for(const tactic of ['all','bal','life','save','blade'])for(const bonus of [0,.4])for(const prey of effects){
 actor.tactic=tactic;actor.passiveMap={};actor.spellCritBonus=0;actor.spellCritDamageBonus=bonus;actor._evPrey=prey;
 const before=JSON.stringify(refSerialize(b)),rng=[...rngState()],expected=[],actual=[];
 Object.setPrototypeOf(b,reference.Battle.prototype);const plan=decideAuto(b,actor,expected);
 Object.setPrototypeOf(b,Battle.prototype);assert.deepEqual(decideAuto(b,actor,actual),plan);assert.deepEqual(actual,expected);
 assert.equal(JSON.stringify(refSerialize(b)),before);assert.deepEqual(rngState(),rng);plans++;
}
actor.passiveMap={};actor.spellCritBonus=0;actor.spellCritDamageBonus=0;actor._evPrey=null;
const count=proto=>{
 Object.setPrototypeOf(b,proto);const concat=Array.prototype.concat,crit=proto._spellCritMul;let arrays=0,multipliers=0;
 Array.prototype.concat=function(...args){arrays++;return concat.apply(this,args);};
 b._spellCritMul=function(...args){multipliers++;return crit.apply(this,args);};
 try {for(let i=0;i<1000;i++)b.estSpell(actor,normal,target,{actual:true});}
 finally {Array.prototype.concat=concat;delete b._spellCritMul;}
 return {arrays,multipliers};
};
const before=count(reference.Battle.prototype),after=count(Battle.prototype);
assert(before.arrays>0&&before.multipliers>0);assert.deepEqual(after,{arrays:0,multipliers:0});
const timing={};
if(process.argv.includes('--bench')){
 const spells=['ZANKOU','DIOS','MAHALITO','GOKUENRAN','HYOUGA','TORNADO','RAIJIN','CHOUHATSU',...Object.entries(SPELLS).filter(([k,sp])=>['buff','debuff','revive','cure','mana'].includes(sp.kind)).slice(0,24).map(([k])=>k)];
 const party=Array.from({length:6},(_,i)=>Object.assign(makeDoll('計測'+i),{uid:100+i,level:100,jobLv:100,hp:10000,maxhp:10000,mp:10000,maxmp:10000,atk:150,int:200,pie:180,agi:100,vit:100,luk:30,spells:spells.slice(),tactic:'all'}));
 const enemies=Array.from({length:3},(_,i)=>({uid:300+i,key:'test',side:'enemy',alive:true,mon:{race:'undead'},hp:10000,maxhp:10000,atk:100,vit:80,agi:70,lv:100,element:'fire'}));
 const battle=new Battle(party,enemies,()=>{});
 for(const equipment of [false,true]){
  const table={before:[],after:[]},states={before:refDeserialize(refSerialize(battle)),after:refDeserialize(refSerialize(battle))};
  Object.setPrototypeOf(states.before,reference.Battle.prototype);Object.setPrototypeOf(states.after,Battle.prototype);
  if(equipment)for(const state of Object.values(states))state.party.forEach(p=>{p.gearPerks=Array.from({length:40},(_,i)=>({c:{t:['cost','deal','take','crit','heal','evade'][i%6],v:.01,on:i%4===0?'spell':null},lv:1}));});
  // 十分に暖め、別々の戦闘を使う。計測中にprototypeや計数用の関数を付け替えない。
  for(let i=0;i<64;i++)for(const label of i%2?['after','before']:['before','after']){
   const state=states[label],start=performance.now();decideAuto(state,state.party[0]);if(i>=40)table[label].push(performance.now()-start);
  }
  for(const label of ['before','after']){const a=table[label].sort((x,y)=>x-y),mid=a.length/2;table[label]={medianMs:(a[mid-1]+a[mid])/2,totalMs:a.reduce((x,y)=>x+y,0)};}
  timing[equipment?'withEffects':'withoutEffects']=table;
 }
}
console.log(JSON.stringify({cases,plans,exactEstimates:true,exactCandidates:true,inputUnchanged:true,rngUnchanged:true,emptyBonusCalls:{before,after},...(process.argv.includes('--bench')?{timing}:{})}));
