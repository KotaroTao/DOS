// 属性の単一値参照・装備と出来事の合算を、従来の全属性表と照合する。
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as combat from '../../src/combat.js';
import {makeDoll} from '../../src/souls.js';
import {decideAuto,setResistKnown} from '../../src/autotactics.js';
import {refSerialize,refDeserialize} from '../../src/savegraph.js';
import {reseedRng,rngState} from '../../src/rng.js';
const root=new URL('../../src/',import.meta.url).href;
import * as rules from '../../src/combatrules.js';
let ruleSource=readFileSync(new URL('../../src/combatrules.js',import.meta.url),'utf8');
let source=readFileSync(new URL('../../src/combat.js',import.meta.url),'utf8');
if(process.argv.includes('--reference'))source=readFileSync(process.argv[process.argv.indexOf('--reference')+1],'utf8');
else {
 source=source.replace('hitChance, elementValue,','hitChance, elementValues, elementStat, elementValue,');
 source=source.replace(/function edefOf\(t, el\) \{[\s\S]*?\n\}/,`function edefOf(t) {
  const values = elementValues(t?.elemDef, "defense");
  for (const [k, v] of Object.entries(elementValues(t?._evEDef, "defense"))) values[k] = (values[k] || 0) + v;
  return {...(elementStat(values, "defense")||{}),reductions:t?.elemDef?.reductions};
}`);
}
if(process.argv.includes('--rules-reference'))ruleSource=readFileSync(process.argv[process.argv.indexOf('--rules-reference')+1],'utf8');
else {
 ruleSource=ruleSource.replace('elementValue(actor?.elemAtk, element)', 'elementValues(actor?.elemAtk)[element]');
 ruleSource=ruleSource.replace("export function elementResistance(element, defense, affinity, scale = 1) {", "export function elementResistance(element, defense, affinity, scale = 1) {\n  const values = elementValues(defense, 'defense');");
 ruleSource=ruleSource.replace("elementValue(defense, element, 'defense')", 'values[element]');
}
const ruleUrl='data:text/javascript;base64,'+Buffer.from(ruleSource).toString('base64');
const oldRules=await import(ruleUrl);
source=source.replace('"./combatrules.js"',JSON.stringify(ruleUrl));
const reference=await import('data:text/javascript;base64,'+Buffer.from(source.replaceAll('from "./','from "'+root)).toString('base64'));
const forms=[null,undefined,{}, {fire:0,water:50,wind:-20,light:Infinity}, {values:{fire:200,water:50,earth:NaN},el:'water',pct:500},
 {el:'fire',lv:1},{el:'fire',lv:2},{el:'fire',lv:0},{el:'fire',lv:-1},{el:'none',fire:60},{el:'fire',pct:0},{el:'water',pct:'25'},
 {el:'fire',pct:NaN},{el:'fire',pct:Infinity},{values:{},fire:100},{el:'fire',pct:false},{el:'wind',pct:-100},{el:'unknown',pct:100},{el:'light',pct:null,lv:2},{el:1,pct:40},
 {values:{fire:100,water:20},reductions:{fire:.1,water:.2}},{reductions:{fire:.6}},{values:{fire:-40,earth:50},reductions:{fire:.2}},Object.create({fire:50}),{fire:Number.MAX_VALUE},{el:'fire',pct:Number.MAX_VALUE}];
const elements=[...rules.ELEMENT_KEYS,'none','unknown','1'];
let scalarCases=0,mergedCases=0;
const tables={before:0,after:0};
function countTables(label,fn){const original=Object.fromEntries;Object.fromEntries=function(...args){tables[label]++;return original(...args);};try{return fn();}finally{Object.fromEntries=original;}}
for(const form of forms)for(const el of elements)for(const kind of ['attack','defense']){
 assert.equal(rules.elementValue(form,el,kind),oldRules.elementValues(form,kind)[el]);
 const affinity={resist:['fire'],weak:['water'],resistance:{wind:40},weakness:{earth:1.7}};
 const calculate=m=>[m.elementAttack({elemAtk:form},el),m.elementResistance(el,form,affinity,.7),m.elementDefenseReduction(el,form,affinity,1.3),m.elementMultiplier(el,150,form,affinity,.8)];
 assert.deepEqual(countTables('after',()=>calculate(rules)),countTables('before',()=>calculate(oldRules)));scalarCases++;
}
assert.equal(tables.after,0);if(!process.argv.includes('--rules-reference'))assert(tables.before>0);
reseedRng(42);setResistKnown(()=>true);
const {Battle,SPELLS}=combat;
let uid=100,cases=0,plans=0,bench;
for(const known of [false,true])for(const side of ['enemy','party'])for(const [resist,magResist] of [[0,0],[50,50],[80,80],[100,100],[80,20],[20,80]])for(const down of [0,15,60])for(const magic of [false,true]){
 for(const m of [combat,reference]){m.setElemKnown(()=>known);m.setPartyHitBonus(.02);m.setPartyEvadeBonus(.01);}
 const actor=Object.assign(makeDoll('予測の人業'),{uid:++uid,level:100,jobLv:100,hp:1000,maxhp:1000,mp:10000,maxmp:10000,atk:200,int:250,pie:180,agi:100,vit:100,luk:30,spells:['ZANKOU','MAHALITO','GOKUENRAN','CHOUHATSU','DIOS'],tactic:'all',wMagic:magic,attackElement:'fire',gearMisc:{bk_twinSoul:.4}});
 const target={uid:++uid,key:'test',side,alive:true,name:'予測の対象',mon:{race:'undead'},hp:10000,maxhp:10000,atk:100,vit:80,agi:70,lv:100,element:'water',physResist:resist,magResist,magWeak:1.3,_wedge:down,_bkPhysDown:down,_bkMagDown:down,elemDef:{fire:50},_evEDef:{fire:10},affinity:{weak:['fire'],resist:['water']},effects:[],buffs:{r_fire:.5}};
 const b=new Battle([actor],[target],()=>{});
 // コンストラクタの共通準備後に、敵→味方の予測経路も照合する。
 if(side==='party'){actor.side='enemy';target.side='party';}
 const before=JSON.stringify(refSerialize(b)),rng=[...rngState()];
 const estimate=()=>[b.estBasic(actor,target),b.estBasic(actor,target,{actual:true}),b.estPhys(actor,target,{resistKnown:false,skill:true,power:1.4}),b.estPhys(actor,target,{actual:true,skill:true,power:1.4}),b.estSpell(actor,SPELLS.MAHALITO,target),b.estSpell(actor,SPELLS.MAHALITO,target,{resistKnown:false}),b.estSpell(actor,SPELLS.MAHALITO,target,{actual:true})];
 Object.setPrototypeOf(b,reference.Battle.prototype);const old=estimate();
 Object.setPrototypeOf(b,Battle.prototype);const current=estimate();assert.deepEqual(current,old,[known,side,resist,magResist,down,magic].join('/'));
 assert.equal(JSON.stringify(refSerialize(b)),before);assert.deepEqual(rngState(),rng);
 if(side==='enemy'){
  const expected=[],actual=[];
  Object.setPrototypeOf(b,reference.Battle.prototype);const p=decideAuto(b,actor,expected);
  Object.setPrototypeOf(b,Battle.prototype);assert.deepEqual(decideAuto(b,actor,actual),p);assert.deepEqual(actual,expected);plans++;
 }
 if(known&&side==='enemy'&&resist===50&&down===15&&!magic)bench={b,actor,target};
 cases++;
}

for(const own of forms)for(const extra of forms)for(const el of elements){
 const actor=Object.assign(makeDoll('属性の検査'),{level:100,jobLv:100,hp:1000,maxhp:1000,mp:1000,maxmp:1000,atk:150,int:200,pie:180,agi:100,vit:100,alive:true,elemAtk:own});
 const target={uid:++uid,key:'test',side:'enemy',name:'属性の対象',mon:{race:'undead'},alive:true,hp:10000,maxhp:10000,atk:100,vit:50,agi:50,lv:100,elemDef:own,_evEDef:extra,affinity:{weak:['water'],resist:['fire']}};
 const b=new Battle([actor],[target],()=>{}),before=JSON.stringify(refSerialize(b)),rng=[...rngState()];
 const calculate=()=>[b._elementMul(actor,target,el),b._passiveCorrection(target,actor,el,'magic'),b.estSpell(actor,{kind:'atk',element:el,power:100},target,{actual:true})];
 Object.setPrototypeOf(b,reference.Battle.prototype);const expected=calculate();
 Object.setPrototypeOf(b,Battle.prototype);assert.deepEqual(calculate(),expected,'属性の合算 '+el);
 assert.equal(JSON.stringify(refSerialize(b)),before);assert.deepEqual(rngState(),rng);mergedCases++;
}
const timing={before:[],after:[]},planTiming={};
if(process.argv.includes('--bench')){
 combat.setElemKnown(()=>true);reference.setElemKnown(()=>true);
 const states=()=>{
  const pair={before:refDeserialize(refSerialize(bench.b)),after:refDeserialize(refSerialize(bench.b))};
  Object.setPrototypeOf(pair.before,reference.Battle.prototype);Object.setPrototypeOf(pair.after,Battle.prototype);
  return pair;
 };
 const estimates=states();
 // 別の戦闘を使い、計測中にprototypeを付け替えない。
 for(let i=0;i<16;i++)for(const label of i%2?['after','before']:['before','after']){
  const state=estimates[label],actor=state.party[0],target=state.enemies[0],start=performance.now();
  for(let k=0;k<1000;k++){state.estBasic(actor,target);state.estSpell(actor,SPELLS.MAHALITO,target);}
  if(i>=8)timing[label].push(performance.now()-start);
 }
 const spells=['ZANKOU','DIOS','MAHALITO','GOKUENRAN','HYOUGA','TORNADO','RAIJIN','CHOUHATSU',...Object.entries(SPELLS).filter(([k,s])=>['buff','debuff','revive','cure','mana'].includes(s.kind)).slice(0,24).map(([k])=>k)];
 const party=Array.from({length:6},(_,i)=>Object.assign(makeDoll('計測'+i),{uid:100+i,level:100,jobLv:100,atk:100,int:200,pie:180,agi:100,vit:100,hp:10000,maxhp:10000,mp:10000,maxmp:10000,spells,tactic:'all'}));
 const enemies=Array.from({length:3},(_,i)=>({...bench.target,uid:300+i,effects:[],buffs:{}}));
 const battle=new Battle(party,enemies,()=>{});
 for(const equipment of [false,true]){
  const table={before:[],after:[]},pair={before:refDeserialize(refSerialize(battle)),after:refDeserialize(refSerialize(battle))};
  Object.setPrototypeOf(pair.before,reference.Battle.prototype);Object.setPrototypeOf(pair.after,Battle.prototype);
  if(equipment)for(const state of Object.values(pair))state.party.forEach(p=>{p.gearPerks=Array.from({length:40},(_,i)=>({c:{t:['cost','deal','take','crit','heal','evade'][i%6],v:.01,on:i%4===0?'spell':null},lv:1}));});
  const expected=[],actual=[];
  decideAuto(pair.before,pair.before.party[0],expected);decideAuto(pair.after,pair.after.party[0],actual);
  assert.deepEqual(refSerialize(actual),refSerialize(expected));
  for(let i=0;i<24;i++)for(const label of i%2?['after','before']:['before','after']){
   const state=pair[label],start=performance.now();decideAuto(state,state.party[0]);if(i>=8)table[label].push(performance.now()-start);
  }
  planTiming[equipment?'withEffects':'withoutEffects']=table;
 }
 for(const table of [timing,...Object.values(planTiming)])for(const label of ['before','after']){
  const a=table[label].sort((x,y)=>x-y),mid=a.length/2;table[label]={medianMs:(a[mid-1]+a[mid])/2,totalMs:a.reduce((x,y)=>x+y,0)};
 }
}
console.log(JSON.stringify({cases,plans,exactEstimates:true,exactCandidates:true,inputUnchanged:true,rngUnchanged:true,scalarCases,mergedCases,tables,...(process.argv.includes('--bench')?{timing,planTiming}:{})}));
