// 立て直しの旗・刃の引き継ぎ・赦しの勅令の実戦と中断セーブの検査。
import assert from 'node:assert/strict';
import { Battle, SPELLS, spellCost } from '../../src/combat.js';
import { makeDoll, jobLevelPassives, PASSIVES } from '../../src/souls.js';
import { refSerialize, refDeserialize } from '../../src/savegraph.js';
import { useMathRandom } from '../../src/rng.js';
useMathRandom(); Math.random=()=>.5;
const member=(passiveMap={})=>Object.assign(makeDoll('検証の人業'),{
  atk:1000,vit:30,agi:100,int:100,pie:100,luk:8,
  hp:10000,maxhp:10000,mp:10000,maxmp:10000,passiveMap,
});
let uid=100000;
const foe=(extra={})=>({uid:uid++,name:'検証の敵',side:'enemy',alive:true,
  hp:1e7,maxhp:1e7,atk:100,vit:0,agi:30,int:100,pie:30,luk:8,
  lv:40,element:'none',mon:{race:'humanoid'},spells:[],...extra});
for(const [job,key,name,levels] of [
  ['hero','heroKaisenGourei','立て直しの旗',[75,165]],
  ['asura','asuraSakki','刃の引き継ぎ',[45,115,165]],
  ['cardinal','cardinalIgen','赦しの勅令',[75,155]],
]) {
  assert.equal(PASSIVES[key].label,name);
  levels.forEach((level,i)=>{
    assert.equal(jobLevelPassives(job,level)[key],i+1);
    assert.equal(jobLevelPassives(job,level-1)[key]||0,i);
  });
}
// 旗: 最高Lvを隊で共有。主・強敵・神速も止める。本人・味方の残り手番は維持。
for(let lv=1;lv<=2;lv++) {
  const h=member({heroKaisenGourei:lv}), another=member({heroKaisenGourei:1}), victim=member(), es=[foe({boss:true,haste:true}),foe({mon:{elite:true}})], b=new Battle([h,another,victim],es,()=>{});
  for(let round=1;round<=lv;round++) {
    b._roundNo=round; victim.alive=true; victim.hp=0;
    b.queue=[es[0],h,es[1],es[0],another];
    assert(b._die(victim,es[0])); assert.deepEqual(b.queue,[h,another]); assert.equal(b._rallyStopUsed,round);
    b.current=es[0]; const hp=h.hp; assert.equal(b.enemyAct().action,'stunned'); assert.equal(h.hp,hp);
    // 同じターンに別の味方が倒れても二重消費しない。
    victim.alive=true; victim.hp=0; b._die(victim); assert.equal(b._rallyStopUsed,round);
  }
  b._roundNo++; victim.alive=true; victim.hp=0; b.queue=[es[0],h]; b._die(victim,es[0]); assert.deepEqual(b.queue,[es[0],h]);
  // 次のターンは敵も動く。
  b._startRound(); assert(b.queue.includes(es[0]));
}
{
  const h=member({heroKaisenGourei:2}), victim=member({endure:1}), b=new Battle([h,victim],[foe()],()=>{});
  victim.hp=0; assert(!b._die(victim)); assert.equal(b._rallyStopUsed,0);
  victim.passiveMap={riseAgain:1}; victim.hp=0; assert(!b._die(victim)); assert.equal(b._rallyStopUsed,0);
  // 勇者が自分だけの時は、自分の戦闘不能で発動しない。
  h.hp=0; b._die(h); assert.equal(b._rallyStopUsed,0);
}
{
  // ターン開始時の毒で仲間が倒れても、その後に作る行動順へ敵を入れない。
  const h=member({heroKaisenGourei:1}), victim=member(), b=new Battle([h,victim],[foe({haste:true})],()=>{});
  victim.hp=1; victim.ailment='poison'; b._holdAil(victim,'poison'); b._startRound();
  assert(!victim.alive); assert(b.queue.every(a=>a.side==='party'));
  const copy=Object.assign(Object.create(Battle.prototype),refDeserialize(refSerialize(b))); copy.log=()=>{};
  assert.equal(copy._rallyStopUsed,1); assert.equal(copy._enemyStopRound,b._roundNo); assert.equal(copy.queue[0],copy.party[0]);
  copy._startRound(); assert(copy.queue.some(a=>a.side==='enemy'));
}
// 敵の実際の攻撃で仲間が倒れた後も、残る味方の手番へ進める。
{
  const h=member({heroKaisenGourei:1}), victim=member(), e=foe(), b=new Battle([h,victim],[e],()=>{});
  victim.hp=1; b.queue=[e,h,e];
  const r=b._exec({actor:e,action:'attack',target:victim}); assert(r.hits[0].died);
  assert.deepEqual(b.queue,[h]); b.advance(); assert.equal(b.current,h); assert.equal(b.phase,'input');
}
// 引き継ぎ: 本物の三段技の残り2撃を引き継ぐ。レベルごとの威力と消費MP。
for(let lv=0;lv<=3;lv++) {
  const a=member(lv?{asuraSakki:lv}:{}), es=[foe({hp:1}),foe()], b=new Battle([a],es,()=>{});
  const before=a.mp, sp=SPELLS.ASURA_SANMEN;
  const r=b._exec({actor:a,action:'spell',spellKey:'ASURA_SANMEN',target:es[0]});
  assert.equal(r.hits.length,lv?3:1); assert.equal(before-a.mp,spellCost(a,sp));
  if(lv) {
    assert(r.hits.slice(1).every(h=>h.target===es[1]));
    const control=member(), target=foe(), c=new Battle([control],[target],()=>{});
    const expected=c._physical(control,target,{power:sp.power*[0,.5,.75,1][lv],critBonus:sp.critBonus,acc:sp.acc,skill:true}).dmg;
    assert.equal(r.hits[1].dmg,expected); assert.equal(r.hits[2].dmg,expected);
  }
}
{
  // さらに倒しても威力を50%→25%へ減衰させず、残りを次へ。射程外は対象にしない。
  const a=member({asuraSakki:1}), es=[foe({hp:1}),foe({hp:1}),foe()], b=new Battle([a],es,()=>{});
  b._randAlive=list=>list.find(e=>e.alive);
  const r=b._exec({actor:a,action:'spell',spellKey:'ASURA_SANMEN',target:es[0]});
  assert.equal(r.hits.length,3); assert.equal(new Set(r.hits.map(h=>h.target)).size,3); assert.equal(r.hits[1].dmg,r.hits[2].dmg);
  const c=new Battle([member({asuraSakki:3})],[foe({hp:1}),foe()],()=>{});
  c.attackableEnemies=()=>[]; const r2=c._exec({actor:c.party[0],action:'spell',spellKey:'ASURA_SANMEN',target:c.enemies[0]}); assert.equal(r2.hits.length,1);
}
{
  // 全段外れ・即死でない不屈・単発技・通常攻撃には、架空の残り段を足さない。
  const a=member({asuraSakki:3}), es=[foe({hp:1,endure:true}),foe()], b=new Battle([a],es,()=>{});
  const r=b._exec({actor:a,action:'spell',spellKey:'ASURA_SANMEN',target:es[0]}); assert.equal(r.hits[0].died,false); assert.equal(r.hits[1].target,es[0]);
  for(const cmd of [{action:'attack'},{action:'spell',spellKey:'KYOUGEKI'}]) {
    const c=new Battle([member({asuraSakki:3})],[foe({hp:1}),foe()],()=>{});
    const out=c._exec({actor:c.party[0],target:c.enemies[0],...cmd}); assert.equal(out.hits.length,1); assert.equal(c.enemies[1].hp,1e7);
  }
}
// 勅令: 強制行動になる手番だけ解除し、同じ手番に通常の入力ができる。最高Lvの共有回数。
for(let lv=1;lv<=2;lv++) {
  const c=member({cardinalIgen:lv}), lower=member({cardinalIgen:1}), a=member(), b=new Battle([c,lower,a],[foe()],()=>{});
  for(let n=0;n<lv;n++) {
    a.mind=n%2?'confuse':'charm'; b._holdAil(a,'mind'); b.queue=[a]; b.advance();
    assert.equal(b.phase,'input'); assert.equal(a.mind,null); assert.equal(b._mindPardonUsed,n+1);
    assert.equal(b._exec({actor:a,action:'defend'}).action,'defend'); assert(a._defending);
  }
  a.mind='charm'; b._holdAil(a,'mind'); b.queue=[a]; b.advance(); assert.equal(b.phase,'stunned'); assert.equal(a.mind,'charm');
  const copy=Object.assign(Object.create(Battle.prototype),refDeserialize(refSerialize(b))); copy.log=()=>{};
  assert.equal(copy._mindPardonUsed,lv);
  // 新しい戦闘では回数を戻す。
  const d=new Battle([c,lower,a],[foe()],()=>{}); assert.equal(d._mindPardonUsed,0);
}
{
  const c=member({cardinalIgen:2}), a=member(), e=foe(), b=new Battle([c,a],[e],()=>{});
  a.mind='charm'; a._ailN={mind:0}; Math.random=()=>0; assert.equal(b._mindCheck(a),'free'); assert.equal(b._mindPardonUsed,0);
  a.mind='confuse'; b._holdAil(a,'mind'); assert.equal(b._mindCheck(a),'free'); assert.equal(a.mind,'confuse'); assert.equal(b._mindPardonUsed,0);
  Math.random=()=>.5;
  // 敵の魅了・混乱は救わない。持ち主が倒れていれば救えない。
  e.mind='charm'; b._holdAil(e,'mind'); assert.equal(b._mindCheck(e),'auto'); assert.equal(b._mindPardonUsed,0);
  c.alive=false; a.mind='charm'; b._holdAil(a,'mind'); assert.equal(b._mindCheck(a),'auto');
  // 生存する本人も対象。
  c.alive=true; c.mind='charm'; b._holdAil(c,'mind'); assert.equal(b._mindCheck(c),'free'); assert.equal(c.mind,null);
}
console.log('立て直しの旗・刃の引き継ぎ・赦しの勅令: 全Lv・回数・主/神速・次ターン・多段威力・手番入力・保存復元 OK');
