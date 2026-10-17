// 採用した6職の独自パッシブ: 習得段・確率境界・解除/復活・反応回数の実戦検査。
import assert from 'node:assert/strict';
import { Battle } from '../../src/combat.js';
import { makeDoll, jobLevelPassives, PASSIVES } from '../../src/souls.js';
import { useMathRandom } from '../../src/rng.js';
useMathRandom(); Math.random = () => .5;
const member = (pm = {}) => Object.assign(makeDoll('検証の人業'), {
  atk: 100, vit: 60, agi: 100, int: 100, pie: 100, luk: 8,
  hp: 10000, maxhp: 10000, mp: 1000, maxmp: 1000, passiveMap: pm,
});
let uid = 100000;
const foe = (extra = {}) => ({ uid: uid++, name: '検証の敵', side: 'enemy', alive: true,
  hp: 10000, maxhp: 10000, atk: 100, vit: 0, agi: 30, int: 100, pie: 30, luk: 8,
  lv: 40, element: 'none', mon: { race: 'humanoid' }, spells: [], ...extra });
for (const [job, key, name, levels] of [
  ['thief', 'thiefShikake', '空荷の手口', [75,155,165]],
  ['berserker', 'berserkerTakeri', '暴力の余波', [25,70,115]],
  ['hexer', 'hexerMaganoKizashi', '返らぬ呪い', [35,115]],
  ['crusader', 'crusaderTotsugekiIkioi', '終わりの聖火', [35,105,185]],
  ['warden', 'wardenGohoujin', '法陣の留め金', [25,60,115,185]],
  ['inquisitor', 'inquisitorShinmonNirami', '祝福への異議', [35,90,165]],
]) {
  assert.equal(PASSIVES[key].label, name);
  levels.forEach((level, i) => {
    assert.equal(jobLevelPassives(job, level)[key], i + 1);
    assert.equal(jobLevelPassives(job, level - 1)[key] || 0, i);
  });
}
// 空荷の手口: 実際の道具使用で確率の上下、他人の袋・本人だけ・効果を確かめる。
for (let lv = 1; lv <= 3; lv++) {
  const rate = [0,.2,.35,.5][lv];
  for (const [roll, saved] of [[rate - 1e-6,true],[rate + 1e-6,false]]) {
    const a = member({thiefShikake:lv}), owner = member(), b = new Battle([a,owner],[foe()],()=>{});
    const it = {name:'検証の薬',use:{heal:50}}; owner.items = [it]; a.hp -= 100;
    Math.random = () => roll;
    b._exec({actor:a,action:'item',owner,item:it,target:a});
    assert.equal(owner.items.length,saved?1:0); assert.equal(a.hp,a.maxhp-50);
  }
  const a = member({thiefShikake:lv}), user=member(), b=new Battle([a,user],[foe()],()=>{});
  const it={name:'検証の薬',use:{heal:50}}; user.items=[it];
  Math.random=()=>0; b._exec({actor:user,action:'item',item:it,target:user}); assert.equal(user.items.length,0);
}
Math.random = () => .5;
// 暴力の余波: 余剰の割合、1行動1回、再帰しない、耐性・不屈・即死・呪文。
for (let lv=1;lv<=3;lv++) {
  const a=member({berserkerTakeri:lv}), es=[foe({hp:1}),foe(),foe()], b=new Battle([a],es,()=>{});
  const r=b._exec({actor:a,action:'attack',target:es[0]});
  const h=r.hits[0], spill=r.hits.find(h=>h.proc==='暴力の余波');
  assert(h.died); assert(spill); assert.equal(spill.dmg,Math.round((h.dmg-1)*[0,.5,.75,1][lv]));
  assert.equal(es.filter(e=>e.hp<10000).length,2);
  // 同一行動番号ではもう一度処理しない。
  assert.equal(b._overflow(a,100),undefined);
}
{
  Math.random = () => .2;
  const a=member({berserkerTakeri:3}), es=[foe({hp:1}),foe({hp:1}),foe()], b=new Battle([a],es,()=>{});
  const r=b._exec({actor:a,action:'attack',target:es[0]}); assert.equal(r.hits.filter(h=>h.proc).length,1); assert.equal(es[2].hp,10000);
  const e=foe({hp:1,endure:true}), other=foe(), c=new Battle([member({berserkerTakeri:3})],[e,other],()=>{});
  c._exec({actor:c.party[0],action:'attack',target:e}); assert(e.alive); assert.equal(other.hp,10000);
}
{
  const a=member({berserkerTakeri:3}), es=[foe({hp:1}),foe()], b=new Battle([a],es,()=>{});
  b._exec({actor:a,action:'spell',spellKey:'HALITO',target:es[0]}); assert.equal(es[1].hp,10000);
  Math.random=()=>0; b._actor=a; es[1].hp=1; b._inflict(a,es[1],{instakill:{chance:1},name:'検証の即死'},[]); assert(!es[1].alive);
}
Math.random = () => .5;
// 返らぬ呪い: 自分の弱体だけ、敵ごとの回数、段数と残り時間、自然消滅、味方による解除。
for (let lv=1;lv<=2;lv++) {
  const a=member({hexerMaganoKizashi:lv}), ally=member(), es=[foe({boss:true}),foe()], b=new Battle([a,ally],es,()=>{});
  for (const e of es) {
    b._actor=a; b._applyStage(e,'vit',-2,4,'本人の呪い');
    b._actor=ally; b._applyStage(e,'atk',-1,3,'他人の弱体');
    const original={...e.effects.find(x=>x.stat==='vit')};
    for(let i=0;i<lv;i++) {
      b._exec({actor:e,action:'shake'});
      assert.deepEqual(e.effects,[original]);
    }
    b._exec({actor:e,action:'shake'}); assert.equal(e.effects.length,0);
  }
  // 同じ敵でも戦いをまたげば回数を戻す。
  const c=new Battle([a,ally],es,()=>{}); c._actor=a; c._applyStage(es[0],'vit',-1,2,'再度');
  c._exec({actor:es[0],action:'shake'}); assert.equal(c.stageOf(es[0],'vit'),-1);
  c._tickEffects(); c._tickEffects(); assert.equal(es[0].effects.length,0);
}
// 終わりの聖火: 種族を問わず本人が止める。無関係な討伐・不屈・他人の討伐では回数を使わない。
for (let lv=1;lv<=3;lv++) {
  const a=member({crusaderTotsugekiIkioi:lv}), ally=member(), es=Array.from({length:lv+1},()=>foe()), b=new Battle([a,ally],es,()=>{},{foeRise:.3});
  for(let i=0;i<es.length;i++) { es[i].hp=0; assert.equal(b._die(es[i],a),i<lv); }
  assert.equal(a._noReviveUsed,lv); assert(es[lv].alive);
  const other=foe(); b.enemies.push(other); other.hp=0; assert.equal(b._die(other,ally),false);
  const c=new Battle([a],[foe({autoRevive:.5})],()=>{}); c.enemies[0].hp=0; assert(c._die(c.enemies[0],a)); assert.equal(a._noReviveUsed,1);
}
{
  const a=member({crusaderTotsugekiIkioi:1}), e=foe({endure:true}), b=new Battle([a],[e],()=>{},{foeRise:.3});
  e.hp=0; assert(!b._die(e,a)); assert.equal(a._noReviveUsed,0);
  e.hp=0; assert(b._die(e,a)); assert.equal(a._noReviveUsed,1);
  const c=new Battle([a],[foe()],()=>{}); c.enemies[0].hp=0; c._die(c.enemies[0],a); assert.equal(a._noReviveUsed,0);
}
// 法陣の留め金: 隊の最高Lv、全体解除は1回、自然消滅は通す、強化なしでは回数を使わない。
for(let lv=1;lv<=4;lv++) {
  const ps=[member({wardenGohoujin:lv}),member({wardenGohoujin:1}),member()], e=foe(), b=new Battle(ps,[e],()=>{});
  b._exec({actor:e,action:'special',kind:'dispel'}); assert.equal(b._dispelLockUsed,0);
  for(const p of ps) b._applyStage(p,'atk',1,2,'加護');
  for(let i=0;i<lv;i++) { b._exec({actor:e,action:'special',kind:'dispel'}); assert(ps.every(p=>b.stageOf(p,'atk')===1)); assert.equal(b._dispelLockUsed,i+1); }
  b._exec({actor:e,action:'special',kind:'dispel'}); assert(ps.every(p=>!p.effects.length));
}
// 旧版の戦闘セーブに新しい隊カウンタが無くても、最初の1回を使える。
{
  const a=member({wardenGohoujin:1}), e=foe(), b=new Battle([a],[e],()=>{});
  delete b._dispelLockUsed; delete b._dispelLockSeq;
  b._applyStage(a,'atk',1,2,'加護'); b._exec({actor:e,action:'special',kind:'dispel'});
  assert.equal(b._dispelLockUsed,1); assert.equal(b.stageOf(a,'atk'),1);
}
// 反撃・物理の報復でも、余剰と復活阻止は実際にとどめを刺した本人のもの。
{
  const a=member({berserkerTakeri:3,crusaderTotsugekiIkioi:1}), es=[foe({hp:1}),foe()], b=new Battle([a],es,()=>{},{foeRise:.3});
  b._actor=es[0]; b._retaliate(a,es[0],'atk',1,'検証の報復',false);
  assert(!es[0].alive); assert(es[1].hp<10000); assert.equal(a._noReviveUsed,1);
}
// 祝福への異議: PIE倍率、回復役・再生・吸収、敵ごと毎ターン、満タンは除外、最高Lvだけ、抵抗と戦闘不能。
for(let lv=1;lv<=3;lv++) {
  const a=member({inquisitorShinmonNirami:lv}), other=member({inquisitorShinmonNirami:1}), es=[foe(),foe()], b=new Battle([a,other],es,()=>{});
  b._roundNo=2;
  for(const e of es) {
    e.hp=5000; const before=e.hp;
    const r1=b._exec({actor:es[0],action:'eheal',target:e});
    assert.equal(e.hp,before+r1.hits[0].heal-[0,50,80,120][lv]);
    const r2=b._exec({actor:es[0],action:'eheal',target:e}); assert.equal(e.hp,before+r1.hits[0].heal+r2.hits[0].heal-[0,50,80,120][lv]);
  }
  b._roundNo++; const e=es[0]; e.hp=5000; e.magResist=50;
  const r=b._exec({actor:e,action:'eheal',target:e}); assert.equal(r.hits.find(h=>h.proc).dmg,Math.round([0,50,80,120][lv]*.5));
  b._roundNo++; e.hp=e.maxhp; b._exec({actor:e,action:'eheal',target:e}); assert.equal(e._healJudgeRound,b._roundNo-1);
  a.alive=other.alive=false; b._roundNo++; e.hp=5000; const r3=b._exec({actor:e,action:'eheal',target:e}); assert.equal(e.hp,5000+r3.hits[0].heal);
}
{
  const a=member({inquisitorShinmonNirami:3}), e=foe({regen:.1}), b=new Battle([a],[e],()=>{});
  e.hp=5000; b._roundNo=1; b._startRound(); assert.equal(e.hp,5880);
  b._roundNo=4; e.lifesteal=.5; e.hp=5000;
  b._exec({actor:e,action:'attack',target:a}); assert.equal(e._healJudgeRound,4);
}
console.log('独自パッシブ6職: 習得段・本人/隊・確率境界・余剰・解除・復活・敵回復反応 OK');
