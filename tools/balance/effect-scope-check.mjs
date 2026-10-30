import assert from 'node:assert/strict';
import {SPELLS} from '../../src/combat.js';
import {skillProfile,spawnFx} from '../../src/battlefx.js';
let singles=0,groups=0;
for(const [key,spell] of Object.entries(SPELLS)){
  const p=skillProfile(key,spell);
  assert.equal(p.all,['all-enemy','all-ally'].includes(spell.target),key);
  assert.equal(p.ally,['ally','all-ally','self'].includes(spell.target),key);
  if(p.all)groups++;else singles++;
}
assert.equal(skillProfile('DIOS',SPELLS.DIOS).all,false);
assert.equal(skillProfile('DIALALL',SPELLS.DIALALL).all,true);
for(const type of ['healmark','curemark','buffmark','debuffmark','fire','field']){
  const list=[];spawnFx(list,type,100,100,0,.85);
  assert(list[0].dur>=250 && list[0].dur<400,type);
}
console.log(`技の対象 ${singles}単体/自分・${groups}全体: 対象の完全一致、オートの効果時間 OK`);

const {Battle}=await import('../../src/combat.js');
const {makeDoll}=await import('../../src/souls.js');
const {reseedRng}=await import('../../src/rng.js');
reseedRng(17);
const actor=Object.assign(makeDoll('検証'),{atk:30,agi:1000});
const foe={uid:999,key:'bs_ghoul',side:'enemy',alive:true,hp:100000,maxhp:100000,atk:1,vit:10,agi:1,int:10,pie:10,luk:8,lv:1,element:'none'};
const battle=new Battle([actor],[foe],()=>{});
actor.wMagic=true;actor.oMagic=false;
assert.equal(battle._physical(actor,foe,{sureHit:true}).magic,true);
assert.equal(battle._physical(actor,foe,{sureHit:true,skill:true}).magic,false);
const left=battle._physical(actor,foe,{sureHit:true,offhand:true});
assert.equal(left.magic,false);assert.equal(left.offhand,true);
console.log('通常攻撃の魔法/物理技/左手の種別が演出へ正しく渡る OK');
