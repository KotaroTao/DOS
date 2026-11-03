import assert from 'node:assert/strict';
import { SPELLS } from '../../src/skilldefs.js';
import { JOB_SIGNATURE, JOB_SKILLS } from '../../src/souls.js';
import { SKILL_FX_CATALOG } from '../../src/skill-fx-catalog.js';
import { SKILL_FX_SIGNATURES } from '../../src/skill-fx-signatures.js';
import { SKILL_FAMILIES, emitSkillFx, skillFxSound, skillFxDuration } from '../../src/skill-fx.js';
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
 assert.ok(SKILL_FAMILIES[d.family],key);assert.ok(Object.isFrozen(d));assert.ok(d.tier>=1&&d.tier<=3);
 assert.equal(p.family,d.family);assert.equal(p.all,['all-enemy','all-ally'].includes(sp.target));
 assert.equal(scene.length,1,key);assert.equal(scene[0].type,'skillScene');assert.ok(scene[0].pts.length>=1&&scene[0].pts.length<=6);
 assert.ok(Number.isFinite(scene[0].x)&&Number.isFinite(scene[0].y)&&scene[0].dur===(['firePillar','fireball','blast'].includes(d.family)?[0,400,700,1200][d.tier]:300),key);
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
 assert.equal(skillFxDuration(d,2,{auto:true}),dur*.6);
 assert.equal(skillFxDuration(d,.1,{fast:true}),dur*.8);
 assert.equal(skillFxDuration(d,.1,{auto:true,fast:true}),dur*.6);
 for(const options of [{},{auto:true},{fast:true}]){
  const effects=[];emitSkillFx(effects,key,SPELLS[key],[{target:enemy,dmg:10}],locate,0,.1,options);
  assert.equal(effects[0].dur,skillFxDuration(d,.1,options));
 }
 for(const hit of [{target:enemy,miss:true},{target:enemy,immune:true}]){
  const effects=[];emitSkillFx(effects,key,SPELLS[key],[hit],locate,0);
  assert.equal(effects.length,0,'不発の火柱には表示待ちを付けない');
 }
}
assert.equal(skillFxDuration({family:'ice',tier:3},.1),220);
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
console.log(`${Object.keys(SPELLS).length}技 / ${new Set(Object.values(SKILL_FX_CATALOG).map(d=>d.family)).size}系統 / ${Object.keys(SKILL_FX_SIGNATURES).length}看板: 割当・全体/単体・不発・複合作用点・上限・軽量化・乱数不変・音声を確認`);
