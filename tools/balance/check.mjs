// 共通戦闘計算の回帰確認。乱数を固定して実ダメージとオートの期待値も比較する。
import assert from 'node:assert/strict';
import { Battle, SPELLS, luckCritBonus, attackSpellPower, healingPower, setElemKnown, spellCost, soulCostAdd, soulPowerMul, soulTierRate, spellMpLabel, SOUL_POWER_K, healsHp, BLADE_HEAL_CAP } from '../../src/combat.js';
import { makeDoll } from '../../src/souls.js';
import { MONSTERS } from '../../src/sprites.js';
import { DUNGEON_MONSTERS } from '../../src/dungeons/index.js';
import { EVENTS } from '../../src/events.js';
Object.assign(MONSTERS,DUNGEON_MONSTERS);
let rng=54321;
Math.random=()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296;};
setElemKnown(null);
const actor=()=>Object.assign(makeDoll('検証の人業'),{level:40,atk:100,vit:60,agi:100,int:120,pie:130,luk:50,hp:1000000,maxhp:1000000,mp:100000,maxmp:100000,critBonus:0});
const foe=()=>({uid:100000,name:'検証の敵',key:'bs_ghoul',mon:MONSTERS.bs_ghoul,side:'enemy',alive:true,hp:1000000,maxhp:1000000,atk:80,vit:60,agi:30,int:40,pie:40,luk:8,lv:40,element:'none',spells:[]});
const close=(actual,expected,label,tolerance=.035)=>assert(Math.abs(actual-expected)<=Math.max(2,expected*tolerance),`${label}: 実測${actual} / 見積もり${expected}`);
// 同じ人業を次の戦闘でも使い、装備を渡した後に吸血が残らないことを確認する。
{
 const a=actor(),other=actor(),t=foe(),logs=[];
 a.equip.hands={eff:{lifesteal:.15,multistrike:2}};
 const {recalc}=await import('../../src/items.js');
 recalc(a);
 new Battle([a,other],[t],()=>{});
 assert.equal(a.lifesteal,.15);
 assert.equal(a.multistrike,2);
 other.equip.hands=a.equip.hands;a.equip.hands=null;
 recalc(a);recalc(other);
 const b=new Battle([a,other],[t],line=>logs.push(line));
 assert.equal(a.lifesteal,0);
 assert.equal(a.multistrike,0);
 assert.equal(other.lifesteal,.15);
 other.hp=1;
 const hit=b._physical(other,t,{acc:1});
 assert(hit.lifesteal>0);
 assert.equal(other.hp,Math.min(other.maxhp,1+hit.lifesteal));
 assert(logs.findIndex(s=>s.includes('ダメージ'))<logs.findIndex(s=>s.includes('HPを吸い取った')));
 logs.length=0;t.physResist=100;other.hp=1;
 assert(b._physical(other,t,{acc:1}).immune);
 assert.equal(other.hp,1);
 assert(!logs.some(s=>s.includes('吸い取った')));
 t.physResist=0;
 const random=Math.random;Math.random=()=>0;
 assert(b._physical(other,t,{}).miss);
 Math.random=random;
 assert.equal(other.hp,1);
 assert(!logs.some(s=>s.includes('吸い取った')));
}
assert.equal(luckCritBonus(8),0);
// HP/MPを吸う技も、ダメージの後に資源名と吸収量を表示する。
for(const [key,resource] of [['KYUUKETSU','HP'],['MAGUINOTACHI','MP'],['NECROMANCER_SEIKISUI','HP'],['MARYOKUGOUDATSU','MP']]){
 for(const immune of [false,true]){
  const a=actor(),t=foe(),logs=[];
  t.physResist=t.magResist=immune?100:0;
  const b=new Battle([a],[t],line=>logs.push(line));
  a.hp=1;a.mp=100;
  const random=Math.random;Math.random=()=>.5;
  const res=b._exec({actor:a,action:'spell',spellKey:key,target:t});
  Math.random=random;
  const absorption=logs.findIndex(s=>s.includes(`${resource}を吸い取った (${resource}+`));
  if(immune){assert.equal(absorption,-1);assert(!res.hits.some(h=>h.heal));}
  else {assert(res.hits.some(h=>h.dmg>0));assert(absorption>logs.findIndex(s=>s.includes('ダメージ')));}
 }
}
assert(luckCritBonus(30)>0 && luckCritBonus(100)>luckCritBonus(30));
assert(luckCritBonus(1000000)<=.25);
{
 const a=actor(),t=foe(),b=new Battle([a],[t],()=>{},{fleeK:10/3});
 assert.equal(b._evadeBase(t,a),.2);
 a.agi=200;assert.equal(b._evadeBase(t,a),0);
 a.agi=50;assert.equal(b._evadeBase(t,a),.4);
 assert.equal(b._evadeBase(a,t),0);
 t.physResist=75;
 assert.equal(b._resistCut(t,100,'physResist',0).dmg,25);
 assert.equal(b._resistCut(t,100,'physResist',.25).dmg,44);
 assert.equal(b._resistCut(t,100,'physResist',.5).dmg,63);
 assert.equal(b._resistCut(t,100,'physResist',1).dmg,100);
 t.physResist=100;assert(b._resistCut(t,100,'physResist',1).immune);
 t.physResist=75;assert.equal(b._resistCut(t,100,'physResist',.25).dmg,44);
}
const samples=12000;
function samplePhys(changes={},opt={}){
 const a=actor(),t=Object.assign(foe(),changes),b=new Battle([a],[t],()=>{},{fleeK:10/3});
 if(changes.actor)Object.assign(a,changes.actor);
 const expected=b.estPhys(a,t,opt);
 let sum=0;
 for(let i=0;i<samples;i++) {t.hp=t.maxhp;t.alive=true;t.asleep=changes.asleep||false;t._barrierLeft=0;const hit=b._physical(a,t,opt);sum+=hit.dmg||0;}
 close(sum/samples,expected,`物理 ${JSON.stringify(changes)} ${JSON.stringify(opt)}`);
 return sum/samples;
}
for(const r of [0,20,50,75,80,100])for(const pierce of [0,.25,1])samplePhys({physResist:r},{power:1.5,acc:.4,pierce,skill:true});
samplePhys({luk:8,actor:{luk:100000,critBonus:.5}},{power:1.5,skill:true});
samplePhys({physResist:75},{power:1.5,critBonus:1,acc:1,skill:true});
samplePhys({physResist:100},{power:1.5,critBonus:1,acc:1,skill:true});
samplePhys({metal:1},{power:1.5,critBonus:1,acc:1,skill:true});
samplePhys({magResist:75,actor:{wMagic:true}},{basic:true});
samplePhys({magResist:100,actor:{wMagic:true}},{basic:true});
samplePhys({physResist:75,asleep:true},{power:1.5,acc:1,skill:true});
{
 const a=actor(),t=foe();t.side='party';t.passiveMap={parry:2,samuraiShingan:2};a.side='enemy';
 const b=new Battle([t],[a],()=>{},{fleeK:10/3});let sum=0;
 for(let i=0;i<samples;i++){t.hp=t.maxhp;sum+=b._physical(a,t).dmg||0;}
 close(sum/samples,b.estPhys(a,t),'味方の見切り・回避');
}
assert.equal(attackSpellPower({power:10,target:'enemy'},100),60);
assert(attackSpellPower({power:100,target:'enemy'},200)-attackSpellPower({power:100,target:'enemy'},100)>attackSpellPower({power:10,target:'enemy'},200)-attackSpellPower({power:10,target:'enemy'},100));
assert(attackSpellPower({power:100,target:'enemy'},100)>attackSpellPower({power:100,target:'all-enemy'},100));
assert.equal(healingPower(14,100),64);
assert(healingPower(60,200)-healingPower(60,100)>healingPower(14,200)-healingPower(14,100));
// 虚重: 上限・現在HP・主補正と、上限の後に掛かる強化/耐性を実処理と見積もりで確認。
for(const c of [
 {hp:976,expected:225}, {hp:400,expected:120},
 {hp:2301,boss:true,expected:207}, {hp:3810,boss:true,expected:225},
 {hp:10000,intStage:2,expected:338}, {hp:10000,intStage:-1,expected:180},
 {hp:10000,perks:true,expected:270}, {hp:10000,magResist:50,expected:113},
 {hp:10000,guard:.5,expected:113}, {hp:10000,magResist:100,expected:0},
 {hp:10000,int:0,expected:1}, {hp:10000,int:151,expected:227},
]){
 const a=actor(),t=foe();Object.assign(a,{int:c.int??150,hp:146,maxhp:146,mp:160,maxmp:160,passiveMap:c.perks?{arcanistChikei:1,arcanistJushoku:1}:{}});
 const b=new Battle([a],[t],()=>{});
 Object.assign(t,{hp:c.hp,maxhp:c.hp,boss:!!c.boss,magResist:c.magResist||0,guard:c.guard||0});
 if(c.intStage)b._applyStage(a,'int',c.intStage,3,'検証');
 if(c.perks){a.hp=73;b._applyStage(t,'atk',-1,3,'検証');}
 const estimate=b.estSpell(a,SPELLS.ARCANIST_KOJUU,t);
 const res=b._exec({actor:a,action:'spell',spellKey:'ARCANIST_KOJUU',target:t});
 assert.equal(res.hits[0].dmg,c.expected,`虚重 ${JSON.stringify(c)}`);
 close(res.hits[0].dmg,estimate,'虚重の見積もり');
 assert.equal(a.mp,154);assert.equal(a.hp,c.perks?67:140);
}
// 重詠の2発目も残りHPと同じ上限で計算し、追加の代償を払わない。
{
 const a=actor(),t=foe();Object.assign(a,{int:150,hp:1,maxhp:146,mp:160,passiveMap:{archmageChoei:3}});
 const b=new Battle([a],[t],()=>{});t.hp=t.maxhp=800;
 const oldRandom=Math.random;Math.random=()=>0;
 const res=b._exec({actor:a,action:'spell',spellKey:'ARCANIST_KOJUU',target:t});Math.random=oldRandom;
 assert.deepEqual(res.hits.map(h=>h.dmg),[225,173]);assert.equal(a.hp,1);assert.equal(a.mp,154);
}
for(const key of ['HALITO','TILTOWAIT','KYOKUDAI','HOLYRAY','GRAVITY','ARCANIST_KOJUU']){
 if(!SPELLS[key])continue;
 for(const r of [0,20,50,75,80,100]){
  const a=actor(),t=foe();t.magResist=r;const b=new Battle([a],[t],()=>{});const sp=SPELLS[key];
  let sum=0;
  for(let i=0;i<samples;i++){t.hp=t.maxhp;t.alive=true;sum+=b._exec({actor:a,action:'spell',spellKey:key,target:t}).hits.reduce((s,h)=>s+(h.dmg||0),0);a.mp=a.maxmp;}
  t.hp=t.maxhp;t.alive=true;
  close(sum/samples,b.estSpell(a,sp,t),'攻撃呪文 '+key+' 耐性'+r);
 }
}
for(const key of ['DIOS','DIAL','MADIOS','DIOSALL','KNIGHT_JINCHUUTEATE']){
 const a=actor(),t=actor();const b=new Battle([a,t],[foe()],()=>{});let sum=0;
 for(let i=0;i<samples;i++){t.hp=1;a.mp=a.maxmp;b._exec({actor:a,action:'spell',spellKey:key,target:t});sum+=t.hp-1;}
 close(sum/samples,b.estHeal(a,SPELLS[key],t),'回復 '+key);
}
let count=0;
for(const [key,sp] of Object.entries(SPELLS)){
 const party=Array.from({length:6},actor);party[1].alive=false;party[1].hp=0;
 const enemies=Array.from({length:3},foe);const b=new Battle(party,enemies,()=>{});const a=party[0];
 const target=sp.target==='dead-ally'?party[1]:sp.target==='self'?a:sp.target?.includes('ally')?party[2]:enemies[0];
 const res=b._exec({actor:a,action:'spell',spellKey:key,target});
 for(const hit of res.hits)if(hit.dmg!=null)assert(Number.isFinite(hit.dmg),key);
 for(const x of [...b.party,...b.enemies])assert(Number.isFinite(x.hp)&&Number.isFinite(x.mp??0),key);
 count++;
}
console.log(`全${count}技を実行。会心・耐性・命中・攻撃/回復の見積もりを実測確認`);
// 魂の格: 消費MP = 技のMP + メイン魂のMP × 格の割合 (〜6:2% / 〜13:4% / 〜24:6% / 25〜:8%)。威力 × (1 + 0.8 × (1 − 基本 ÷ 消費))
{
 const kinds={phys:0,atk:0,heal:0};
 for(const [key,sp] of Object.entries(SPELLS)){
  const r=soulTierRate(sp);
  if(sp.mpPct||sp.gravity||!(sp.mp>0)||!['phys','atk','heal','mana'].includes(sp.kind)){assert.equal(r,0,key);continue;}
  assert.equal(r,sp.mp<=6?.02:sp.mp<=13?.04:sp.mp<=24?.06:.08,key);
  assert.equal(spellMpLabel(sp),`MP ${sp.mp}＋魂のMP×${Math.round(r*100)}%`,key);
  const a=actor();a.soulMp=500;
  const add=soulCostAdd(a,sp),mul=soulPowerMul(a,sp);
  assert.equal(add,Math.round(500*r),key);assert.equal(spellCost(a,sp),sp.mp+add,key);
  assert(mul>1&&mul<1+SOUL_POWER_K,key);assert(Math.abs(mul-(1+SOUL_POWER_K*(1-sp.mp/(sp.mp+add))))<1e-12,key);
  // 装備などで足した最大MPは消費に響かない
  a.maxmp+=999;assert.equal(spellCost(a,sp),sp.mp+add,key);
  if(sp.kind in kinds)kinds[sp.kind]++;
 }
 // 実際の威力にも乗る (攻撃呪文・回復・物理技)。見積もりも同じ倍率
 const pick=(kind)=>Object.keys(SPELLS).find(k=>{const sp=SPELLS[k];return sp.kind===kind&&sp.target==='enemy'&&!sp.gravity&&!sp.hits&&!sp.scatter&&!sp.execute&&!sp.prey&&!sp.instakill&&!sp.drain&&!sp.mpDrain&&!sp.critBonus&&!sp.element&&soulTierRate(sp);});
 for(const kind of ['atk','phys']){
  const key=pick(kind),sp=SPELLS[key];
  const run=(soulMp)=>{const a=actor(),t=foe();a.soulMp=soulMp;const b=new Battle([a],[t],()=>{});let sum=0;const n=3000;
   for(let i=0;i<n;i++){t.hp=t.maxhp;t.alive=true;a.mp=a.maxmp;sum+=b._exec({actor:a,action:'spell',spellKey:key,target:t}).hits.reduce((x,h)=>x+(h.target===t?(h.dmg||0):0),0);}
   return {avg:sum/n,est:kind==='atk'?b.estSpell(a,sp,t):b.estPhys(a,t,{...sp,power:sp.power*soulPowerMul(a,sp),skill:true}),a};};
  const lo=run(0),hi=run(800);
  close(Math.round(hi.avg),Math.round(hi.est),`魂の格 ${sp.name}`);
  assert(hi.avg>lo.avg*1.1,`魂の格で ${sp.name} の威力が上がる`);
 }
 { const key=Object.keys(SPELLS).find(k=>SPELLS[k].kind==='heal'&&SPELLS[k].target==='ally'&&!SPELLS[k].revivePct&&soulTierRate(SPELLS[k])),sp=SPELLS[key];
   const a=actor();a.soulMp=800;const b=new Battle([a],[foe()],()=>{});let sum=0;const n=3000;
   for(let i=0;i<n;i++){a.hp=1;a.mp=a.maxmp;sum+=b._exec({actor:a,action:'spell',spellKey:key,target:a}).hits.reduce((x,h)=>x+(h.heal||0),0);}
   close(Math.round(sum/n),Math.round(b.estHeal(a,sp)),`魂の格 ${sp.name}`); }
 // MP吸収はその技の消費MPまで
 { const key=Object.keys(SPELLS).find(k=>SPELLS[k].mpDrain&&SPELLS[k].kind==='phys'&&SPELLS[k].target==='enemy'),sp=SPELLS[key];
   const a=actor(),t=foe();a.atk=5000;a.soulMp=300;const b=new Battle([a],[t],()=>{});
   for(let i=0;i<50;i++){a.mp=1000;t.hp=t.maxhp;t.alive=true;b._exec({actor:a,action:'spell',spellKey:key,target:t});assert(a.mp<=1000,`${sp.name}: 吸収が消費を超えた (${a.mp})`);} }
 // 魔力循環は1回で最大MPの 2/3/4% まで
 for(const lv of [1,2,3]){ const a=actor(),t=foe();a.atk=5000;a.maxmp=1000;a.passiveMap={bmManaCycle:lv};const b=new Battle([a],[t],()=>{});
   for(let i=0;i<30;i++){a.mp=0;t.hp=t.maxhp;t.alive=true;b._exec({actor:a,action:'attack',target:t});assert(a.mp<=[0,20,30,40][lv],`魔力循環Lv${lv}: ${a.mp}`);} }
 console.log(`魂の格: 物理${kinds.phys}・攻撃呪文${kinds.atk}・回復${kinds.heal}技の消費/威力/表記、実測と見積もり、MP吸収・魔力循環の上限を確認`);
}
// 回復の作り直し (2026-10): ヒールの頭打ち・割合回復・体の手当て (使い手の最大HP)・刃の癒し (与ダメ)
{
 const heal=(caster,key,t)=>{const b=new Battle([caster,t],[foe()],()=>{});t.hp=1;caster.mp=caster.maxmp;b._exec({actor:caster,action:'spell',spellKey:key,target:t});return t.hp-1;};
 // ヒールは対象の最大HPの50%まで、ハイヒールはヒールの2.5倍
 {const a=actor(),t=actor();t.maxhp=100;assert.equal(heal(a,'DIOS',t),50,'ヒールの頭打ち');
  const lo=Object.assign(actor(),{pie:10}),t2=actor();const b=new Battle([lo,t2],[foe()],()=>{});
  close(Math.round(b.estHeal(lo,SPELLS.DIAL,t2)),Math.round(b.estHeal(lo,SPELLS.DIOS,Object.assign(actor(),{maxhp:1e9}))*2.5),'ハイヒール = ヒール×2.5',.06);}
 // 全快 (フルヒール・オールフルヒール) は揺らぎなく最大HPまで
 {const a=actor(),t=actor();t.maxhp=5000;assert.equal(heal(a,'MADIOS',t),4999,'フルヒール');}
 // 体の手当て: 使い手の最大HPで決まる (最大HPの小さい魔法職が借りても弱い)・対象の35%まで
 {const big=Object.assign(actor(),{maxhp:400,hp:400,pie:999}),small=Object.assign(actor(),{maxhp:100,hp:100,pie:999});
  const tA=Object.assign(actor(),{maxhp:1000}),tB=Object.assign(actor(),{maxhp:1000});
  const hb=heal(big,'KNIGHT_JINCHUUTEATE',tA),hs=heal(small,'KNIGHT_JINCHUUTEATE',tB);
  assert(hb>hs*3,`体の手当ては使い手の最大HPで伸びる (${hb} / ${hs})`);
  const tC=Object.assign(actor(),{maxhp:100});assert(heal(Object.assign(actor(),{maxhp:5000,hp:5000}),'KNIGHT_JINCHUUTEATE',tC)<=35,'手当ての頭打ち');}
 // 刃の癒し: 与えたダメージの割合を全員へ、1人あたり healCap まで。PIE は関係しない
 {const key=Object.keys(SPELLS).find(k=>SPELLS[k].bladeHeal&&SPELLS[k].target==='enemy'),sp=SPELLS[key];
  for(const pie of [10,9999]){const a=Object.assign(actor(),{pie}),m=Object.assign(actor(),{maxhp:100000}),t=foe();const b=new Battle([a,m],[t],()=>{});
   m.hp=1;const r=b._exec({actor:a,action:'spell',spellKey:key,target:t});const dealt=r.hits.reduce((x,h)=>x+(h.target===t?(h.dmg||0):0),0);
   assert.equal(m.hp-1,Math.max(1,Math.round(Math.min(dealt*sp.bladeHeal,100000*(sp.healCap||BLADE_HEAL_CAP)))),`刃の癒し ${sp.name} PIE${pie}`);}
  for(const [k,s2] of Object.entries(SPELLS)) assert(!(s2.kind==='phys'&&s2.partyHeal),`物理技 ${k} は bladeHeal で書く`);}
 // 威力999の書き方は残っていない
 for(const [k,s2] of Object.entries(SPELLS)) assert(!(s2.kind==='heal'&&s2.power>=999),`${k}: 全快は healPct で書く`);
 console.log('回復: ヒールの頭打ち・ハイヒール2.5倍・全快・体の手当て (使い手の最大HP)・刃の癒し (与ダメ) を確認');
}
// 出来事の全選択肢を、成功/失敗の乱数と傷・異常・死者がいる条件で確認する。
let choices=0;
for(const random of [.01,.99]){
 const oldRandom=Math.random;Math.random=()=>random;
 for(const e of EVENTS){
  const members=[actor(),actor()];members[0].hp=1;members[0].mp=0;members[0].ailment='poison';members[1].alive=false;members[1].hp=0;
  const noop=()=>{};
  const api={layer:e.layer||1,flags:()=>({}),embers:()=>10,aliveList:()=>members.filter(x=>x.alive),deadList:()=>members.filter(x=>!x.alive),randomAlive:()=>members[0],best:()=>members[0],appraiser:()=>members[0],monsterKeysLeft:()=>['bs_ghoul'],wares:()=>[],price:()=>10,goldCost:()=>10,soulCost:()=>10,innCost:()=>10,repairCost:()=>10,canPayGold:()=>true,canPaySoul:()=>true,payEmber:()=>true,countCells:()=>3,check:()=>random<.5,checkDisarm:()=>random<.5,seen:()=>false,picked:()=>false,runEv:()=>({mods:[]}),floorEv:()=>({mods:[]}),poolKey:()=> 'bs_ghoul',eliteKeyHere:()=> 'el_cryptlord',monName:()=> '検証の魔物',itemNameOf:()=> '検証の品',sense:()=>false,
   alarm:(...xs)=>{for(const x of xs)if(typeof x==='function')x();},choice:(...xs)=>{for(const x of xs)if(Array.isArray(x))for(const c of x)if(c?.fn)c.fn();}
  };
  const A=new Proxy(api,{get:(t,k)=>k in t?t[k]:noop});
  const cell={};e.intro(A,cell);if(e.cond)e.cond(A);
  if(e.gift)e.gift(A,cell);
  if(e.choices)for(const c of e.choices(A,cell).filter(Boolean)){assert.equal(typeof c.fn,'function',e.id);c.fn();choices++;}
 }
 Math.random=oldRandom;
}
console.log(`全${EVENTS.length}出来事・${choices}選択肢(乱数2条件)を確認`);
