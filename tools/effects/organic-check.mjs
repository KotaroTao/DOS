// 一撃の速度・物理/術の尺・音の有限性と実行経路を検査する。
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {SPELLS} from '../../src/skilldefs.js';
import {SKILL_FX_CATALOG} from '../../src/skill-fx-catalog.js';
import {skillFxDuration,enemySkillFxProfile,emitSkillFx,skillFxSound,beginSkillFxPresentation} from '../../src/skill-fx.js';
import {naturalSkillName,SFX_DEFS} from '../../src/music/sfx.js';
import {rng} from '../../src/music/dsp.js';
let physical=0;
for(const [key,sp]of Object.entries(SPELLS)){
 const d=SKILL_FX_CATALOG[key],n=Math.max(sp.hits||1,sp.scatter||1);
 assert.equal(d.kind,sp.kind);assert.equal(d.hits,n);
 for(const options of [{},{auto:true},{fast:true}]){
  const speed=options.auto?.6:options.fast?.8:1,rank=Math.min(3,d.tier);
  assert.equal(skillFxDuration(d,1,options),sp.kind==='phys'?n*85+(options.auto?20:options.fast?35:60):Math.round([0,400,700,1200][rank]*speed),key);
 }
 if(sp.kind==='phys')physical++;
}
for(const family of ['slash','impact','pierce','ice','wave','firePillar','lightning','stone','heal','revive','purify','mana','ward','doom','air'])for(const duration of [65,145,230,485,400,700,1200]){
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
console.log(`全960技（物理${physical}）の尺・85msの打撃枠・自然音105条件・図形/発振器の禁止を確認`);

for(const element of ['fire','water','wind','earth','light','dark']){
 const profile=enemySkillFxProfile({side:'enemy',action:'breath',actor:{element}});assert.ok(profile);
 const effects=[];emitSkillFx(effects,null,{kind:'atk',target:'all-ally'},[{target:{uid:1,side:'party'},dmg:10}],()=>({x:100,y:100}),0,1,{design:profile});
 assert.equal(effects[0].type,'skillScene');assert.equal(effects[0].design.family,profile.family);
}

assert.equal(enemySkillFxProfile({side:'enemy',action:'spell',spellKey:'ZANKOU'}).hits,5);

// 救命系が攻撃の水・氷へ再び混ざらず、互いにも異なる音になる。
const healing=new Set();
for(const [family,category]of [['heal','restore'],['revive','revive'],['purify','cleanse'],['mana','supply']]){
 const name=naturalSkillName(skillFxSound(family,3),3,700),def=SFX_DEFS[name];
 assert.equal(def.category,category);assert.ok(def.vol<SFX_DEFS[naturalSkillName('slash',3,700)].vol);
 const data=def.gen(rng(123)).ch[0];healing.add(Array.from(data.slice(1000,1020)).join(','));
 const energy=(a,b)=>data.slice(Math.floor(a*data.length),Math.floor(b*data.length)).reduce((s,v)=>s+v*v,0)/(b-a);
 assert.ok(energy(0,.02)<energy(.2,.6),'救命音の立ち上がりに衝突音を出さない');
}
assert.equal(healing.size,4);
// 回復のきらめきは高速時も1/2/3回。各まとまりの後半が減衰し、準備音と混ざらない。
for(const family of ['heal','revive','purify','mana'])for(const rank of [1,2,3,5])for(const speed of [1,.8,.6]){
 const count=Math.min(3,rank),ms=Math.round([0,400,700,1200][count]*speed);
 const name=naturalSkillName(family,rank,ms),data=SFX_DEFS[name].gen(rng(321)).ch[0];
 assert.equal(data.length,Math.round(32000*ms/1000));
 assert.equal(name,naturalSkillName(family,count,ms),'ランク3より増やさない');
 const rms=(a,b)=>{const part=data.slice(Math.floor(a*data.length),Math.floor(b*data.length));return Math.sqrt(part.reduce((s,v)=>s+v*v,0)/part.length);};
 for(let i=0;i<count;i++){
  const peak=rms((i+.08)/count,(i+.35)/count),tail=rms((i+.8)/count,(i+.98)/count);
  assert.ok(peak>.025 && peak>tail*3,`${family}/${rank}/${speed}の${i+1}回目が聞き分けられる`);
 }
 assert.notEqual(name,naturalSkillName(family,rank,ms,true),'準備音を別に保持');
}
console.log('救命4系統・ランク1/2/3/5・通常/高速/オートのきらめき48条件を確認');
const fx={skill:[{type:'skillScene',t0:10}],floats:[{t0:10},{t0:95},{t0:180}]};
beginSkillFxPresentation(fx,100);assert.deepEqual(fx.floats.map(e=>e.t0),[100,185,270]);
beginSkillFxPresentation(fx,200);assert.equal(fx.skill[0].t0,100,'開始時刻を二重にずらさない');
