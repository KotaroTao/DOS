// 一撃の速度・物理/術の尺・音の有限性と実行経路を検査する。
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {SPELLS} from '../../src/skilldefs.js';
import {SKILL_FX_CATALOG} from '../../src/skill-fx-catalog.js';
import {skillFxDuration,enemySkillFxProfile,emitSkillFx} from '../../src/skill-fx.js';
import {naturalSkillName,SFX_DEFS} from '../../src/music/sfx.js';
import {rng} from '../../src/music/dsp.js';
let physical=0;
for(const [key,sp]of Object.entries(SPELLS)){
 const d=SKILL_FX_CATALOG[key],n=Math.max(sp.hits||1,sp.scatter||1);
 assert.equal(d.kind,sp.kind);assert.equal(d.hits,n);
 for(const options of [{},{auto:true},{fast:true}]){
  const speed=options.auto?.6:options.fast?.8:1,rank=Math.min(3,d.tier);
  assert.equal(skillFxDuration(d,1,options),Math.round((sp.kind==='phys'?n*85+60:[0,400,700,1200][rank])*speed),key);
 }
 if(sp.kind==='phys')physical++;
}
for(const family of ['slash','impact','pierce','ice','wave','firePillar','lightning','stone','heal','ward','doom','air'])for(const duration of [65,145,230,485,400,700,1200]){
 const name=naturalSkillName(family,3,duration),data=SFX_DEFS[name].gen(rng(123));
 assert.ok(name.startsWith('natural_'));
 assert.equal(data.ch[0].length,Math.round(32000*duration/1000));
 for(const ch of data.ch){assert.ok(ch.every(v=>Number.isFinite(v)&&Math.abs(v)<=.91));assert.ok(ch.some(v=>Math.abs(v)>.1));}
}
const source=await readFile(new URL('../../src/music/sfx.js',import.meta.url),'utf8');
const natural=source.slice(source.indexOf('export function naturalSkillName'),source.indexOf('const CACHE ='));
assert.ok(!/\b(modal|sweep)\s*\(|Math\.(sin|cos)\s*\(/.test(natural),'技の自然音に発振器を戻さない');
for(const file of ['skill-fx.js','skill-fx-materials.js']){
 const text=await readFile(new URL('../../src/'+file,import.meta.url),'utf8');
 assert.ok(!/\.(stroke|fill|arc|ellipse|lineTo|moveTo|rect|fillRect|strokeRect|bezierCurveTo|quadraticCurveTo)\s*\(/.test(text),file+'で図形を生成しない');
}
console.log(`全960技（物理${physical}）の尺・85msの打撃枠・自然音84条件・図形/発振器の禁止を確認`);

for(const element of ['fire','water','wind','earth','light','dark']){
 const profile=enemySkillFxProfile({side:'enemy',action:'breath',actor:{element}});assert.ok(profile);
 const effects=[];emitSkillFx(effects,null,{kind:'atk',target:'all-ally'},[{target:{uid:1,side:'party'},dmg:10}],()=>({x:100,y:100}),0,1,{design:profile});
 assert.equal(effects[0].type,'skillScene');assert.equal(effects[0].design.family,profile.family);
}

assert.equal(enemySkillFxProfile({side:'enemy',action:'spell',spellKey:'ZANKOU'}).hits,5);
