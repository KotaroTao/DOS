// 変更前の予測と、全値・選択・入力不変を比較する。参照ソースは --reference で指定する。
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as combat from '../../src/combat.js';
import {makeDoll} from '../../src/souls.js';
import {decideAuto,setResistKnown} from '../../src/autotactics.js';
import {refSerialize} from '../../src/savegraph.js';
import {reseedRng,rngState} from '../../src/rng.js';
const root=new URL('../../src/',import.meta.url).href;
let source=readFileSync(new URL('../../src/combat.js',import.meta.url),'utf8');
if(process.argv.includes('--reference'))source=readFileSync(process.argv[process.argv.indexOf('--reference')+1],'utf8');
else {
 // 従来の差し替え用オブジェクトを比較用モジュールにだけ戻す。
 source=source.replace('const r = resistance ?? modeResistance(t, kind === "phys" ? "physResist" : "magResist");','const r = modeResistance(t, kind === "phys" ? "physResist" : "magResist");');
 source=source.replace('const correctionTarget = tgt.side === "enemy" ? tv : Object.create(tv,','const correctionTarget = Object.create(opt.actual ? tgt : elemMask(tgt, actor),');
 source=source.replace('const correctionTarget = t.side === "enemy" ? tv : Object.create(tv,','const correctionTarget = Object.create(opt.actual ? t : elemMask(t, actor),');
 source=source.replace('resistIgnore, false, tgt.side === "enemy" ? r : null)', 'resistIgnore)');
 source=source.replace(', t.side === "enemy" ? modeResistance(t, "magResist", r) : null)', ')');
}
const reference=await import('data:text/javascript;base64,'+Buffer.from(source.replaceAll('from "./','from "'+root)).toString('base64'));
reseedRng(42);setResistKnown(()=>true);
const {Battle,SPELLS}=combat;
let uid=100,cases=0,plans=0,bench;const allocations={before:0,after:0};
function allocated(fn){const original=Object.create;let count=0;Object.create=function(...args){count++;return original(...args);};try{return {value:fn(),count};}finally{Object.create=original;}}
for(const known of [false,true])for(const side of ['enemy','party'])for(const [resist,magResist] of [[0,0],[50,50],[80,80],[100,100],[80,20],[20,80]])for(const down of [0,15,60])for(const magic of [false,true]){
 for(const m of [combat,reference]){m.setElemKnown(()=>known);m.setPartyHitBonus(.02);m.setPartyEvadeBonus(.01);}
 const actor=Object.assign(makeDoll('予測の人業'),{uid:++uid,level:100,jobLv:100,hp:1000,maxhp:1000,mp:10000,maxmp:10000,atk:200,int:250,pie:180,agi:100,vit:100,luk:30,spells:['ZANKOU','MAHALITO','GOKUENRAN','CHOUHATSU','DIOS'],tactic:'all',wMagic:magic,attackElement:'fire',gearMisc:{bk_twinSoul:.4}});
 const target={uid:++uid,key:'test',side,alive:true,name:'予測の対象',mon:{race:'undead'},hp:10000,maxhp:10000,atk:100,vit:80,agi:70,lv:100,element:'water',physResist:resist,magResist,magWeak:1.3,_wedge:down,_bkPhysDown:down,_bkMagDown:down,elemDef:{fire:50},_evEDef:{fire:10},affinity:{weak:['fire'],resist:['water']},effects:[],buffs:{r_fire:.5}};
 const b=new Battle([actor],[target],()=>{});
 // コンストラクタの共通準備後に、敵→味方の予測経路も照合する。
 if(side==='party'){actor.side='enemy';target.side='party';}
 const before=JSON.stringify(refSerialize(b)),rng=[...rngState()];
 const estimate=()=>[b.estBasic(actor,target),b.estBasic(actor,target,{actual:true}),b.estPhys(actor,target,{resistKnown:false,skill:true,power:1.4}),b.estPhys(actor,target,{actual:true,skill:true,power:1.4}),b.estSpell(actor,SPELLS.MAHALITO,target),b.estSpell(actor,SPELLS.MAHALITO,target,{resistKnown:false}),b.estSpell(actor,SPELLS.MAHALITO,target,{actual:true})];
 Object.setPrototypeOf(b,reference.Battle.prototype);const old=allocated(estimate);
 Object.setPrototypeOf(b,Battle.prototype);const current=allocated(estimate);assert.deepEqual(current.value,old.value,[known,side,resist,magResist,down,magic].join('/'));
 if(side==='enemy'){allocations.before+=old.count;allocations.after+=current.count;}else assert.equal(current.count,old.count,'味方を対象にする従来経路を維持');
 assert.equal(JSON.stringify(refSerialize(b)),before);assert.deepEqual(rngState(),rng);
 if(side==='enemy'){
  const expected=[],actual=[];
  Object.setPrototypeOf(b,reference.Battle.prototype);const p=decideAuto(b,actor,expected);
  Object.setPrototypeOf(b,Battle.prototype);assert.deepEqual(decideAuto(b,actor,actual),p);assert.deepEqual(actual,expected);plans++;
 }
 if(known&&side==='enemy'&&resist===50&&down===15&&!magic)bench={b,actor,target};
 cases++;
}
assert(allocations.after<allocations.before,'一時オブジェクトの生成を減らせていない');
const timing={before:[],after:[]},planTiming={before:[],after:[]};
if(process.argv.includes('--bench')){
 combat.setElemKnown(()=>true);reference.setElemKnown(()=>true);
 for(let i=0;i<10;i++)for(const [label,proto] of i%2?[['after',Battle.prototype],['before',reference.Battle.prototype]]:[['before',reference.Battle.prototype],['after',Battle.prototype]]){
  Object.setPrototypeOf(bench.b,proto);const start=performance.now();for(let k=0;k<1000;k++){bench.b.estBasic(bench.actor,bench.target);bench.b.estSpell(bench.actor,SPELLS.MAHALITO,bench.target);}
  if(i>=4)timing[label].push(performance.now()-start);
 }
 const spells=['ZANKOU','DIOS','MAHALITO','GOKUENRAN','HYOUGA','TORNADO','RAIJIN','CHOUHATSU',...Object.entries(SPELLS).filter(([k,s])=>['buff','debuff','revive','cure','mana'].includes(s.kind)).slice(0,24).map(([k])=>k)];
 const party=Array.from({length:6},(_,i)=>Object.assign(makeDoll('計測'+i),{uid:100+i,level:100,jobLv:100,atk:100,int:200,pie:180,agi:100,vit:100,hp:10000,maxhp:10000,mp:10000,maxmp:10000,spells,tactic:'all'}));
 const enemies=Array.from({length:3},(_,i)=>({...bench.target,uid:300+i,effects:[],buffs:{}}));
 const battle=new Battle(party,enemies,()=>{}),expected=[],actual=[];
 Object.setPrototypeOf(battle,reference.Battle.prototype);decideAuto(battle,party[0],expected);
 Object.setPrototypeOf(battle,Battle.prototype);decideAuto(battle,party[0],actual);assert.deepEqual(actual,expected);
 for(let i=0;i<10;i++)for(const [label,proto] of i%2?[['after',Battle.prototype],['before',reference.Battle.prototype]]:[['before',reference.Battle.prototype],['after',Battle.prototype]]){
  Object.setPrototypeOf(battle,proto);const start=performance.now();decideAuto(battle,party[0]);if(i>=4)planTiming[label].push(performance.now()-start);
 }
 for(const table of [timing,planTiming])for(const label of ['before','after']){const a=table[label].sort((x,y)=>x-y);table[label]={medianMs:(a[2]+a[3])/2,totalMs:a.reduce((x,y)=>x+y,0)};}
}
console.log(JSON.stringify({cases,plans,exactEstimates:true,exactCandidates:true,inputUnchanged:true,rngUnchanged:true,allocations,...(process.argv.includes('--bench')?{timing,planTiming}:{})}));
