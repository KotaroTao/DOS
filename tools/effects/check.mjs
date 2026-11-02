import assert from 'node:assert/strict';
import { SPELLS } from '../../src/skilldefs.js';
import { JOB_SIGNATURE } from '../../src/souls.js';
import { SKILL_FX_CATALOG } from '../../src/skill-fx-catalog.js';
import { SKILL_FX_SIGNATURES } from '../../src/skill-fx-signatures.js';
import { SKILL_FAMILIES, emitSkillFx } from '../../src/skill-fx.js';
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
 assert.ok(Number.isFinite(scene[0].x)&&Number.isFinite(scene[0].y)&&scene[0].dur<=350,key);
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
console.log(`${Object.keys(SPELLS).length}技 / ${new Set(Object.values(SKILL_FX_CATALOG).map(d=>d.family)).size}系統 / ${Object.keys(SKILL_FX_SIGNATURES).length}看板: 割当・全体/単体・不発・複合作用点・上限・軽量化・乱数不変・音声を確認`);
