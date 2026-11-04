import { SKILL_FX_ULTIMATES } from '../../src/skill-fx-ultimates.js';
import { CLEAVE_TOP, CLEAVE_COLORS } from '../../src/cleave-fx.js';
import assert from 'node:assert/strict';
import { SPELLS } from '../../src/skilldefs.js';
import { JOB_SIGNATURE, JOB_SKILLS } from '../../src/souls.js';
import { SKILL_FX_CATALOG } from '../../src/skill-fx-catalog.js';
import { SKILL_FX_SIGNATURES } from '../../src/skill-fx-signatures.js';
import { SKILL_FAMILIES, emitSkillFx, skillFxSound, skillFxDuration, physicalSkillFx, extendedSkillFx } from '../../src/skill-fx.js';
import { skillProfile, spawnFx, SIG_FX } from '../../src/battlefx.js';
import '../../src/battlefx-sig.js';
import { previewSkillFx } from '../../src/skill-fx-preview.js';
import { setFxQuality, fxLite, recordFxFrame, fxPerformance, resetFxPerformance, FX_LIMITS } from '../../src/skill-fx-budget.js';
import { rngState, reseedRng } from '../../src/rng.js';
import { SFX_DEFS } from '../../src/music/sfx.js';
import { rng } from '../../src/music/dsp.js';
assert.deepEqual(Object.keys(SKILL_FX_CATALOG).sort(),Object.keys(SPELLS).sort());
reseedRng(42);const before=[...rngState()];
for(const [key,sp]of Object.entries(SPELLS)){
 const d=SKILL_FX_CATALOG[key],p=skillProfile(key,sp),scene=previewSkillFx(key);
 assert.ok(SKILL_FAMILIES[d.family],key);assert.ok(Object.isFrozen(d));assert.ok(Number.isInteger(d.tier)&&d.tier>=1);
 assert.equal(p.family,d.family);assert.equal(p.all,['all-enemy','all-ally'].includes(sp.target));
 assert.equal(scene.length,1,key);assert.equal(scene[0].type,'skillScene');assert.ok(scene[0].pts.length>=1&&scene[0].pts.length<=6);
 assert.ok(Number.isFinite(scene[0].x)&&Number.isFinite(scene[0].y)&&scene[0].dur===skillFxDuration(scene[0].design),key);


 assert.equal(scene[0].all,p.all,key);
}
assert.deepEqual([...rngState()],before,'演出生成でゲーム用乱数を消費');
for(const key of new Set(Object.values(JOB_SIGNATURE)))assert.ok(SKILL_FX_SIGNATURES[key],key);
for(const [key,s]of Object.entries(SKILL_FX_SIGNATURES)){assert.ok(SPELLS[key],key);assert.equal(SIG_FX[key].type,s.type);}
const enemy={uid:1,side:'enemy'},ally={uid:2,side:'party'},locate=t=>({x:t.side==='enemy'?100:500,y:t.side==='enemy'?120:300});
let list=[];emitSkillFx(list,'MEIKONGURAI',SPELLS.MEIKONGURAI,[{target:enemy,dmg:10},{target:ally,heal:10}],locate,0);
assert.equal(list[0].x,100);assert.equal(list[0].y,120);assert.equal(list[0].pts.length,2);
list=[];emitSkillFx(list,'TATEWARI',SPELLS.TATEWARI,[{target:enemy,dmg:10},{target:enemy,status:'毒',debuff:{vit:.8}}],locate,0);
assert.equal(list[0].pts.length,1);assert.equal(list[0].pts[0].status,'poison');assert.equal(list[0].pts[0].weak,true);
for(const hits of [[{target:enemy,miss:true}],[{target:enemy,immune:true}],[]]){list=[];emitSkillFx(list,'DIOS',SPELLS.DIOS,hits,locate,0);assert.equal(list.length,0);}
list=[];for(let i=0;i<100;i++)spawnFx(list,'fire',10,10,0,1);assert.equal(list.length,FX_LIMITS.effects);
emitSkillFx(list,'DIOS',SPELLS.DIOS,[{target:ally,heal:1}],locate,0);assert.equal(list.length,FX_LIMITS.effects);assert.equal(list[0].type,'skillScene');
setFxQuality('auto');resetFxPerformance();for(let i=0;i<6;i++)recordFxFrame(6,1);assert.equal(fxLite(),true);
for(let i=0;i<1000;i++)recordFxFrame(1,1);assert.equal(fxPerformance().retainedSamples,240);
setFxQuality('high');assert.equal(fxLite(),false);assert.equal(fxLite(true),true);setFxQuality('low');assert.equal(fxLite(),true);
for(const name of ['skillRestore','skillWard','skillShade','skillFire','skillSpark','skillMagic']){
 const data=SFX_DEFS[name].gen(rng(123));assert.ok(data.ch[0].length<32000*.4);assert.ok(data.ch.every(ch=>ch.every(Number.isFinite)&&ch.some(x=>Math.abs(x)>.1)),name);
}
assert.equal(skillFxSound('firePillar'),'firePillar');
assert.equal(skillFxSound('fireball'),'fireball');
for(const [key,tier]of [['MAHALITO',1],['GOKUEN',2],['GOKUENRAN',3]])assert.equal(SKILL_FX_CATALOG[key].tier,tier);
for(const [key,dur]of [['MAHALITO',400],['GOKUEN',700],['GOKUENRAN',1200],['HALITO',400],['BATTLEMAGE_GURENMASHOU',700],['SPELLBLADE_ENTEI',1200],['TILTOWAIT',400],['TENPENCHII',700],['KYOKUDAI',1200]]){
 const d=SKILL_FX_CATALOG[key];assert.equal(skillFxDuration(d),dur);
 assert.equal(skillFxDuration(d,2,{auto:true}),dur);
 assert.equal(skillFxDuration(d,.1,{fast:true}),dur*.8);
 assert.equal(skillFxDuration(d,.1,{auto:true,fast:true}),dur*.8);
 for(const options of [{},{auto:true},{fast:true},{auto:true,fast:true}]){
  const effects=[];emitSkillFx(effects,key,SPELLS[key],[{target:enemy,dmg:10}],locate,0,.1,options);
  assert.equal(effects[0].dur,skillFxDuration(d,.1,options));
 }
 for(const hit of [{target:enemy,miss:true},{target:enemy,immune:true}]){
  const effects=[];emitSkillFx(effects,key,SPELLS[key],[hit],locate,0);
  assert.equal(effects.length,0,'不発の火柱には表示待ちを付けない');
 }
}
assert.equal(skillFxDuration({family:'cut',tier:3},.1),460);
const fireCounts=[0,0,0,0];
for(const design of Object.values(SKILL_FX_CATALOG))if(design.family==='firePillar')fireCounts[design.tier]++;
assert.deepEqual(fireCounts,[0,8,2,6]);
const fireTop=new Set(['GOKUENRAN','BATTLEMAGE_SHAKUNETSU','ARCANIST_GOUKASHO','INQUISITOR_JOUZAI','SAGE_HOMURA','ARCHMAGE_SHUUEN']);
assert.deepEqual(new Set(Object.entries(SKILL_FX_CATALOG).filter(([k,d])=>d.family==='firePillar'&&d.tier===3).map(([k])=>k)),fireTop);
for(const key of fireTop){
 const paths=Object.values(JOB_SKILLS).filter(rows=>rows.some(r=>r.skill===key));
 assert.ok(paths.length>0,key);
 for(const rows of paths){
  const entry=rows.find(r=>r.skill===key),top=Math.max(...rows.filter(r=>SKILL_FX_CATALOG[r.skill]?.family==='firePillar').map(r=>r.lvl));
  assert.ok(entry.lvl>=180 && entry.lvl===top,'最上位の火系統の技だけをランク3にする: '+key);
 }
}
assert.equal(skillFxSound('firePillar',2),'firePillar2');assert.equal(skillFxSound('firePillar',3),'firePillar3');
for(const [name,duration]of [['skillFirePillar',.68],['skillFirePillar2',.9],['skillFirePillar3',1.15]])for(let seed=1;seed<=3;seed++){
 const data=SFX_DEFS[name].gen(rng(seed));
 assert.equal(data.ch.length,2);assert.equal(data.ch[0].length,Math.round(32000*duration));
 for(const ch of data.ch){
  assert.ok(ch.every(Number.isFinite));assert.ok(ch.every(v=>Math.abs(v)<=.91),'火柱音のピーク');
  const energy=ch.slice(0,9600).reduce((n,v)=>n+v*v,0)/9600;
  const tail=ch.slice(-1600).reduce((n,v)=>n+v*v,0)/1600;
  assert.ok(energy>.004 && tail<energy*.05,'噴出と余韻の音量');
 }
}
for(const [family,counts,top]of [['fireball',[9,4,3],['SPELLBLADE_ENTEI','ARCTHIEF_NUSUMIBI','ASCETIC_KASHOUZANMAI']],['blast',[6,2,3],['KYOKUDAI','BATTLEMAGE_TENPOU','ARCHMAGE_BANSHOU']]]){
 const actual=[0,0,0];for(const d of Object.values(SKILL_FX_CATALOG))if(d.family===family)actual[d.tier-1]++;
 assert.deepEqual(actual,counts);assert.ok(actual[0]>actual[1]&&actual[0]>actual[2]);
 assert.deepEqual(new Set(Object.entries(SKILL_FX_CATALOG).filter(([k,d])=>d.family===family&&d.tier===3).map(([k])=>k)),new Set(top));
 for(const key of top)for(const rows of Object.values(JOB_SKILLS).filter(rows=>rows.some(r=>r.skill===key))){
  const lvl=rows.find(r=>r.skill===key).lvl,max=Math.max(...rows.filter(r=>SKILL_FX_CATALOG[r.skill]?.family===family).map(r=>r.lvl));
  assert.equal(lvl,max,key);assert.ok(lvl>=(family==='blast'?200:160),key);
 }
 for(let rank=1;rank<=3;rank++){
  const kind=family+(rank===1?'':rank),name=(family==='fireball'?'skillFireball':'skillBlast')+(rank===1?'':rank);
  assert.equal(skillFxSound(family,rank),kind);
  for(let seed=1;seed<=3;seed++)for(const ch of SFX_DEFS[name].gen(rng(seed)).ch){assert.ok(ch.every(Number.isFinite));assert.ok(ch.every(v=>Math.abs(v)<=.91));assert.ok(ch.some(v=>Math.abs(v)>.1));}
 }
}
const elementPolicy={
 ice:{counts:[8,3,6],top:['SPELLBLADE_HYOUGOKU','WARDEN_HYOUFUU','ARCANIST_TOUKON','SAGE_REIHYOU','ARCHMAGE_EIKYUU','ZETTAIREIDO'],min:160},
 wave:{counts:[8,3,2],top:['WARDEN_BAKUFU','NECROMANCER_MEIGA'],min:160},
 gale:{counts:[7,3,2],top:['HERMIT_TENGUKAZE','ARCTHIEF_NUSUMIARASHI'],min:150},
 lightning:{counts:[7,4,3],top:['RAIMEIRAN','ARCHMAGE_RAIGOU','HERO_HEKIREKI'],min:140},
 stone:{counts:[6,2,3],top:['GANSAI','ARCTHIEF_TOUTENSEKI','WARDEN_KANAME'],min:170},
 quake:{counts:[8,3,2],top:['METEOR','BATTLEMAGE_INTETSU'],min:160},
};
for(const [family,policy]of Object.entries(elementPolicy)){
 const rows=Object.entries(SKILL_FX_CATALOG).filter(([k,d])=>d.family===family),counts=[0,0,0];for(const [k,d]of rows)counts[d.tier-1]++;
 assert.deepEqual(counts,policy.counts);assert.ok(counts[0]>counts[1]&&counts[0]>counts[2]);
 assert.deepEqual(new Set(rows.filter(([k,d])=>d.tier===3).map(([k])=>k)),new Set(policy.top));
 for(const key of policy.top)for(const job of Object.values(JOB_SKILLS).filter(rows=>rows.some(r=>r.skill===key))){
  const lvl=job.find(r=>r.skill===key).lvl,top=Math.max(...job.filter(r=>SKILL_FX_CATALOG[r.skill]?.family===family).map(r=>r.lvl));
  assert.equal(lvl,top,key);assert.ok(lvl>=policy.min,key);
 }
 for(let rank=1;rank<=3;rank++){
  assert.equal(skillFxSound(family,rank),family+(rank===1?'':rank));
  for(const options of [{},{auto:true},{fast:true},{auto:true,fast:true}])assert.equal(skillFxDuration({family,tier:rank},.1,options),[0,400,700,1200][rank]*(options.fast?.8:1));
  const name='skill'+family[0].toUpperCase()+family.slice(1)+(rank===1?'':rank);
  for(let seed=1;seed<=3;seed++)for(const ch of SFX_DEFS[name].gen(rng(seed)).ch){assert.ok(ch.every(Number.isFinite));assert.ok(ch.every(v=>Math.abs(v)<=.91));assert.ok(ch.some(v=>Math.abs(v)>.1));}
 }
}
for(const [key,family]of [['ZETTAIREIDO','ice'],['ARCHMAGE_GOKKAN','ice'],['HERMIT_KAMINARI','lightning'],['HERO_HEKIREKI','lightning'],['ARCHMAGE_TENMEI','lightning'],['ASCETIC_TSUBUTE','stone'],['ROCKBLAST','stone']])assert.equal(SKILL_FX_CATALOG[key].family,family);
console.log(`${Object.keys(SPELLS).length}技 / ${new Set(Object.values(SKILL_FX_CATALOG).map(d=>d.family)).size}系統 / ${Object.keys(SKILL_FX_SIGNATURES).length}看板: 割当・全体/単体・不発・複合作用点・上限・軽量化・乱数不変・音声を確認`);
// 新しい7系統は各ランクを実際の技へ適用し、専用音と表示尺を持つ。
for(const family of ['radiance','void','arcane','heal','revive','purify','ward'])for(let rank=1;rank<=3;rank++){
 const entry=Object.entries(SKILL_FX_CATALOG).find(([,d])=>d.family===family&&d.tier===rank);
 assert.ok(entry,`${family}:${rank} の技がない`);
 const [key,d]=entry,kind=family+(rank===1?'':rank);
 assert.equal(skillFxSound(family,rank),kind);
 assert.equal(skillFxDuration(d),[0,400,700,1200][rank]);
 assert.equal(previewSkillFx(key)[0].dur,skillFxDuration(d));
 assert.equal(skillFxDuration(d,1,{auto:true}),skillFxDuration(d));
 const name='skill'+kind[0].toUpperCase()+kind.slice(1),data=SFX_DEFS[name].gen(rng(123));
 assert.ok(data.ch.every(ch=>ch.every(Number.isFinite)&&ch.some(x=>Math.abs(x)>.01)),name);
}

// 少数の系統は実在する習得段階だけを使い、弱体の最上位を明示する。
assert.equal(SKILL_FX_CATALOG.MANAGIFT.tier,2);
assert.equal(SKILL_FX_CATALOG.INQUISITOR_MANAZASHI.tier,3);
assert.deepEqual([...new Set(Object.values(SKILL_FX_CATALOG).filter(d=>d.family==='charge').map(d=>d.tier))].sort(),[1,2]);
for(const f of ['empower','weaken','dispel','seal','poison','illusion','sleep']){
 assert.deepEqual([...new Set(Object.values(SKILL_FX_CATALOG).filter(d=>d.family===f).map(d=>d.tier))].sort(),[1,2,3],f);
}

for(const rows of Object.values(JOB_SKILLS)){
 const top=rows.filter(r=>SKILL_FX_CATALOG[r.skill]?.family==='cleave').sort((a,b)=>b.lvl-a.lvl)[0];
 if(top)assert.ok(CLEAVE_TOP[top.skill],top.skill+' 最上位の専用軌跡なし');
}
assert.equal(new Set(Object.values(CLEAVE_TOP)).size,Object.keys(CLEAVE_TOP).length);
for(const [key,variant] of Object.entries(CLEAVE_TOP)){
 assert.equal(SKILL_FX_CATALOG[key].family,'cleave');assert.equal(SKILL_FX_CATALOG[key].tier,3);assert.equal(SKILL_FX_CATALOG[key].variant,variant);
}
for(const [key,sp] of Object.entries(SPELLS))if(SKILL_FX_CATALOG[key].family==='cleave'&&sp.element)assert.equal(previewSkillFx(key)[0].col,CLEAVE_COLORS[sp.element],key);

// 六系統は看板指定に左右されず、実際の習得段階の描画を選ぶ。
const utilityFamilies=new Set(['gravity','doom','drain','steal','escape','survey']);
for(const [key,design]of Object.entries(SKILL_FX_CATALOG))if(utilityFamilies.has(design.family)&&Math.max(SPELLS[key].hits||1,SPELLS[key].scatter||1)===1){
 const levels=Object.values(JOB_SKILLS).flat().filter(row=>row.skill===key).map(row=>row.lvl);
 const level=levels.length?Math.min(...levels):1;
 assert.equal(design.tier,level>=100?3:level>=30?2:1,key);
}
// 命中ごとの時間枠・対象・打数は画質によらず保持する。
for(const [key,sp] of Object.entries(SPELLS))if(Math.max(sp.hits||1,sp.scatter||1)>1){
 const e=previewSkillFx(key)[0];
 assert.equal(e.strikes.length,sp.scatter||(sp.hits*(['all-enemy','all-ally'].includes(sp.target)?6:1)),key);
 assert.equal(e.design.tier,Math.max(sp.hits||1,sp.scatter||1),key);
 assert.equal(e.dur,sp.kind==='phys'?Math.max(sp.hits||1,sp.scatter||1)*400+60:e.design.tier===2?700:1200,key);
}
for(const rows of Object.values(JOB_SKILLS)){
 const skills=rows.filter(r=>r.skill),top=Math.max(...skills.map(r=>r.lvl));
 for(const r of skills.filter(r=>r.lvl===top))assert.ok(SKILL_FX_SIGNATURES[r.skill]?.ultimate,r.skill);
}
const ultimates=Object.values(SKILL_FX_SIGNATURES).filter(s=>s.ultimate);
assert.equal(new Set(ultimates.map(s=>JSON.stringify([s.ultimate,s.tone]))).size,ultimates.length);
list=[];emitSkillFx(list,'RINNE',SPELLS.RINNE,[{target:enemy,dmg:10},{target:enemy,miss:true},{target:ally,dmg:12},{target:enemy,immune:true}],locate,0);
assert.deepEqual(list[0].strikes,[{...locate(enemy),slot:0},{...locate(ally),slot:0}]);

assert.ok(Object.values(SKILL_FX_CATALOG).filter(d=>d.family==='pierce').every(d=>d.tier>=1));
for(const [key,s]of Object.entries(SPELLS))if(s.element==='fire'&&SKILL_FX_CATALOG[key].family!=='cleave'&&['atk','phys'].includes(s.kind))assert.equal(previewSkillFx(key)[0].col,'#ff4938',key);
const shapes=new Set();
for(const [job,rows] of Object.entries(JOB_SKILLS)){
 const top=rows.filter(r=>r.skill).at(-1).skill;
 const u=SKILL_FX_ULTIMATES[top];assert.ok(u,job);
 const shape=JSON.stringify(u);assert.ok(!shapes.has(shape),top);shapes.add(shape);
 assert.deepEqual(previewSkillFx(top)[0].ultimate,u);
}
const ranks=new Set();
for(const [key,d] of Object.entries(SKILL_FX_CATALOG))if(d.family==='impact'){
 ranks.add(d.tier);assert.equal(skillFxDuration(d,1,{auto:true}),d.hits*400+60);
 for(const hit of [{target:enemy,miss:true},{target:enemy,immune:true}]){
  const fx=[];emitSkillFx(fx,key,SPELLS[key],[hit],locate,0);assert.equal(fx.length,0);
 }
}
assert.ok(ranks.has(1)&&ranks.has(5));
console.log(`${shapes.size}職業の最終技専用構図 / 重い打撃5ランクを確認`);


// すべての系統・高ランク・速度設定で尺は400/700/1200msに限定する。
for(const family of Object.keys(SKILL_FAMILIES))for(const tier of [1,2,3,4,5,10,100]){
 for(const options of [{},{auto:true},{fast:true},{auto:true,fast:true}]){
  const expected=physicalSkillFx({family,tier})?400+(options.fast?35:60):Math.round((tier===1?400:tier===2?700:1200)*(options.fast?.8:1));
  assert.equal(skillFxDuration({family,tier},.1,options),expected);
 }
}
for(const [name,def]of Object.entries(SFX_DEFS))if(name.startsWith('ranked')){
 const rank=Number(name.at(-1)),data=def.gen(rng(123));
 for(const ch of data.ch){
  assert.equal(ch.length,32000*[0,.4,.7,1.2][rank],name);
  assert.ok(ch.every(v=>Number.isFinite(v)&&Math.abs(v)<=.9),name);
  assert.ok(ch.some(v=>Math.abs(v)>.01),name);
 }
}
// 実際の戦闘結果を演出へ通し、成功・無効と受取人を確認する。
const {Battle}=await import('../../src/combat.js');
const {makeDoll}=await import('../../src/souls.js');
for(const [key,metal]of [['ICELANCE',false],['ICELANCE',true],['MARYOKUGOUDATSU',false],['MARYOKUGOUDATSU',true]]){
 const actor=Object.assign(makeDoll('検証'),{int:100,atk:100,mp:500,maxmp:1000});
 const foe={uid:999,key:'balance',name:'検証の敵',side:'enemy',alive:true,hp:100000,maxhp:100000,atk:1,vit:10,agi:1,int:10,pie:10,luk:8,lv:1,element:'none',metal};
 const b=new Battle([actor],[foe],()=>{}),res={hits:[]};b._cast(actor,{spellKey:key,target:foe},res);
 const effects=[];emitSkillFx(effects,key,SPELLS[key],res.hits,locate,0,1,{source:locate(actor)});
 if(metal){assert.ok(!effects.length||!effects[0].hasDrain);assert.ok(!effects.length||!effects[0].pts.some(p=>p.weak));}
 else if(key==='ICELANCE')assert.equal(effects[0].pts[0].weak,true);
 else {assert.equal(effects[0].hasMpDrain,true);assert.ok(effects[0].pts.some(p=>p.side==='party'&&p.mark==='mana'));}
}
console.log('全系統の尺・連撃ランク・上限・合成音の有限性と尺・実戦の弱体/MP吸収を確認');
