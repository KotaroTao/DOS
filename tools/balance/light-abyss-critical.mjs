// 聖光の追撃4段階と、深淵の知・会心ダメージの物理/魔法共通適用を実測する。
import assert from 'node:assert/strict';
import {Battle, SPELLS, gearCritMul, physicalCritMul, perkVictory, setElemKnown} from '../../src/combat.js';
import {makeDoll} from '../../src/souls.js';
import {useMathRandom} from '../../src/rng.js';
useMathRandom();setElemKnown(null);Math.random=()=>0;
const actor=pm=>Object.assign(makeDoll('検証'),{level:40,atk:1000,vit:0,agi:100,int:1000,pie:100,luk:0,hp:100000,maxhp:100000,mp:100000,maxmp:100000,passiveMap:pm});
const foe=()=>({uid:900000,name:'検証敵',side:'enemy',alive:true,hp:1000000,maxhp:1000000,vit:0,agi:1,luk:0,lv:40,element:'none',mon:{race:'humanoid'},spells:[]});
const near=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);
for(const [i,k] of [.5,1,2,3].entries()){
 const a=actor({crusaderTsuigeki:i+1}),t=foe(),b=new Battle([a],[t],()=>{});
 for(let n=0;n<20;n++){const before=t.hp;b._rankOnHit(a,t,100,false);assert.equal(before-t.hp,1000*k,'命中時の追撃倍率');}
 Math.random=()=>.999;const hp=t.hp;b._rankOnHit(a,t,100,false);assert(t.hp<hp,'確率抽選なしで発動');Math.random=()=>0;
 const plain=actor({}),pt=foe(),pb=new Battle([plain],[pt],()=>{});pb._rankOnHit(plain,pt,100,false);assert.equal(pt.hp,pt.maxhp);
}
Math.random=()=>.5;
const key=Object.keys(SPELLS).find(k=>SPELLS[k].kind==='atk'&&SPELLS[k].target==='enemy'&&!SPELLS[k].gravity&&!SPELLS[k].hits&&!SPELLS[k].scatter&&!SPELLS[k].drain&&!SPELLS[k].execute&&!SPELLS[k].critBonus);
for(const [i,bonus] of [.5,1,2,3].entries()){
 const a=actor({arcanistShinen:i+1}),t=foe(),b=new Battle([a],[t],()=>{});
 near(b._spellCritChance(a,SPELLS[key]),[.05,.10,.15,.20][i]);near(physicalCritMul(a),1+bonus);near(b._spellCritMul(a),1.5*(1+bonus));
 // 確定会心の実ダメージにも両方の威力加算が効く。
 a.passiveMap={};const plain=b._physical(a,t,{acc:1,critBonus:1}).dmg;
 a.passiveMap={arcanistShinen:i+1};const dmg=b._physical(a,t,{acc:1,critBonus:1}).dmg;assert(Math.abs(dmg/plain-(1+bonus))<.01);
 const sp={...SPELLS[key],critBonus:1},sk='__critical_test';SPELLS[sk]=sp;
 a.passiveMap={};const raw=b._exec({actor:a,action:'spell',spellKey:sk,target:t}).hits.reduce((s,h)=>s+(h.dmg||0),0);
 a.passiveMap={arcanistShinen:i+1};const magic=b._exec({actor:a,action:'spell',spellKey:sk,target:t}).hits.reduce((s,h)=>s+(h.dmg||0),0);
 assert(raw>0&&Math.abs(magic/raw-(1+bonus))<.01);delete SPELLS[sk];
}
{
 const a=actor({arcanistShinen:4,spellCrit:3,samuraiIchibun:3}),t=foe(),b=new Battle([a],[t],()=>{});
 a.critDamageBonus=.5;a.spellCritDamageBonus=.7;
 near(gearCritMul(a),1.5);near(gearCritMul(a,true),2.2);
 near(b._physicalCritMul(a),1+.5+3+.3+.3);near(b._spellCritMul(a),1.5*(1+.5+.7+3+.3+.3));
 a.passiveMap={shadowIchishi:3};near(b._spellCritMul(a,{tgt:t,on:['spell']}),1.5*(2.2+.4));t.hp=t.maxhp*.8;near(b._spellCritMul(a,{tgt:t,on:['spell']}),1.5*2.2);
}
console.log('聖光の追撃: 4段階・必ず発動・未習得は不発、深淵の知: 4段階の率と物理/魔法の実ダメージ、装備/呪文会心/条件付きパッシブの共通加算 OK');

for (const [i, rate] of [.1,.2,.3].entries()) {
 const a=actor({templarKairitsu:i+1}),b=new Battle([a],[foe()],()=>{});
 near(perkVictory(a,[a]).mp,[.01,.02,.02][i]);
 a.maxmp=1000;a.mp=100;Math.random=()=>rate-1e-6;b._perkCast(a,{kind:'cure'},25);assert.equal(a.mp,125,'確率の直前で消費MPを返還');
 a.mp=100;Math.random=()=>rate;b._perkCast(a,{kind:'cure'},25);assert.equal(a.mp,100,'確率の境界以上では返還しない');
 Math.random=()=>0;b._perkCast(a,{kind:'heal'},25);assert.equal(a.mp,100,'治療以外は対象外');
}
console.log('戒律の灯: 勝利時MP1/2/2%、治療後の返還10/20/30%の境界・返還量・対象外を確認');
