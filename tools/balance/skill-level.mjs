// レベル成長と既存の魂の格・割合効果・実処理/見積もりの回帰確認。
import assert from 'node:assert/strict';
import { SPELLS, Battle, spellCost, skillBaseCost, skillLevelMul, skillPowerMul, soulPowerMul, soulCostAdd, spellHealRaw, healOnTarget } from '../../src/combat.js';
import { MONSTERS } from '../../src/sprites.js';
import { DUNGEON_MONSTERS } from '../../src/dungeons/index.js';
import { reseedRng } from '../../src/rng.js';
Object.assign(MONSTERS, DUNGEON_MONSTERS);
const actor = level => ({ side:'party', level, jobLv:level, soulMp:500, maxmp:100000, mp:100000, hp:100000, maxhp:100000, atk:200, int:200, pie:200, agi:100, vit:100, luk:0, alive:true, effects:[], passiveMap:{} });
for (const lv of [0,1,50,100,200,1000,10000]) {
  const a=actor(lv), factor=1+lv/100;
  assert.equal(skillLevelMul(a),factor);
  for (const [key,sp] of Object.entries(SPELLS)) {
    const snapshot=JSON.stringify(sp);
    if (sp.mpPct) {
      assert.equal(spellCost(a,sp),Math.max(sp.mpMin||1,Math.ceil(a.maxmp*sp.mpPct)),key);
      continue;
    }
    assert.equal(spellCost(a,sp),Math.max(1,Math.ceil((sp.mp||0)*(100+lv)/100+soulCostAdd(a,sp))),key);
    const grows=!sp.gravity&&!sp.healPct&&(sp.kind==='phys'||sp.kind==='atk'||sp.kind==='mana'||sp.kind==='heal'&&(sp.bodyHeal>0||sp.healMul>0||sp.power>0));
    assert(Math.abs(skillPowerMul(a,sp)-soulPowerMul(a,sp)*(grows?factor:1))<1e-10,key);
    assert.equal(JSON.stringify(sp),snapshot,key);
  }
}
const sp={...SPELLS.DIOS,healCap:null},lo=actor(0),hi=actor(100);
assert.equal(spellHealRaw(hi,sp,200),spellHealRaw(lo,sp,200)*2);
assert.equal(healOnTarget(SPELLS.DIOS,{maxhp:100},1e6),50,'既存の回復上限');
assert.equal(skillBaseCost(hi,{mp:3}),6);
assert.equal(spellCost({...hi,soulMp:0},{mp:3,kind:'buff'}),6);
assert.equal(spellCost({...hi,soulMp:0,passiveMap:{chant:2}},{mp:10,kind:'buff'}),14);
assert.equal(skillLevelMul({jobLv:100,level:500}),2,'メイン魂Lvを優先');
assert.equal(skillLevelMul({side:'enemy',lv:100}),2,'写し身のLv');
// 武魂と記憶の消費下限も成長後の基本消費を基準にする。
{
  const a=actor(100),sp={mp:10,kind:'atk',target:'enemy',power:10};
  a.soulMp=0;a.spellCostMul=.01;
  a.gearPerks=[{c:{bukon:true,t:'cost',v:[.7]},lv:1}];
  assert.equal(spellCost(a,sp),6,'武魂の下限は成長後の30%');
  a.gearMisc={bk_memory:.99};a._lastSkill='CHECK';
  const b=new Battle([a],[],()=>{});
  a._lastSkill='CHECK';
  assert.equal(b.costOf(a,sp,'CHECK'),6,'記憶の下限も成長後の30%');
}
// 同じ乱数・能力値なら物理技の実ダメージと見積もりの双方が伸び、実消費も一致する。
const run = level => {
  const a=actor(level),t={...actor(0),uid:123,key:'bs_ghoul',mon:MONSTERS.bs_ghoul,side:'enemy',physResist:0,magResist:0};
  const b=new Battle([a],[t],()=>{}),s={...SPELLS.KYOUGEKI,sureHit:true},key='LEVEL_CHECK';
  SPELLS[key]=s;
  try {
    reseedRng(8123);
    const before=a.mp,result=b._exec({actor:a,action:'spell',spellKey:key,target:t});
    assert.equal(before-a.mp,spellCost(a,s));
    return {dmg:result.hits.reduce((n,h)=>n+(h.dmg||0),0),est:b.estPhys(a,t,{...s,power:s.power*skillPowerMul(a,s),skill:true})};
  } finally { delete SPELLS[key]; }
};
const a=run(0),b=run(100);
assert(b.dmg>a.dmg*1.8);assert(b.est>a.est*1.8);
console.log(`全${Object.keys(SPELLS).length}技×7レベル: 消費・威力・固定効果・割合探索・軽減・回復上限・実消費/ダメージ・見積もりを確認`);
