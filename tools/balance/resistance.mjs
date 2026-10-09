// 抵抗値の境界・全敵の体質・装備集計・実際の付与を検証する。
import assert from 'node:assert/strict';
import { Battle } from '../../src/combat.js';
import { SOUL_KEYS, SOUL_CLASSES, makeSoulInstance, setSharedSouls, recalcDoll, rankThresholds, makeDoll, jobBaseTraitsOf, JOB_BASE_TRAITS } from '../../src/souls.js';
import { recalc } from '../../src/items.js';
import { MONSTERS } from '../../src/sprites.js';
import { DUNGEON_MONSTERS } from '../../src/dungeons/index.js';
import { RESIST_LABEL, zeroResists, monsterResists, resistTiers, resistLean, RACE_RESIST, MON_RESIST_WEAKABLE } from '../../src/resistance.js';
import { revealSteps } from '../../src/ui/itemview.js';
Object.assign(MONSTERS, DUNGEON_MONSTERS);
const a = Object.assign(makeDoll('抵抗検証'), { jobLv: 40, level: 40 });
const t = { name:'検証の敵', side:'enemy', lv:40, alive:true, hp:100, maxhp:100, resists:zeroResists(), effects:[] };
const b = new Battle([a], [t], () => {});
for (const k of Object.keys(RESIST_LABEL)) {
  for (const n of [0, 80, 100]) {
    t.resists[k] = n;
    if (k === 'physResist' || k === 'magResist') {
      t[k] = n;
      assert.equal(b._resistCut(t, 100, k).dmg, 100-n);
      assert.equal(b._resistCut(t, 100, k).immune, n===100);
    } else assert(Math.abs(b.estRate(a,t,.5,k) - .5*(1-n/100)) < 1e-12, k);
  }
}
const oldRandom = Math.random;
try {
  Math.random = () => 0;
  b._inflict(a,t,{poison:{chance:1,pct:.05},para:1,sleepChance:1,charm:1,confuse:1,seal:{chance:1},flinchChance:1,instakill:{chance:1}});
  assert(!t.ailment && !t.asleep && !t.mind && !t._flinch && t.hp===100 && !t.effects.length);
} finally { Math.random = oldRandom; }
for (const m of Object.values(DUNGEON_MONSTERS)) {
  for (const k in RESIST_LABEL) assert(Number.isInteger(m.resists[k]) && m.resists[k]>=0 && m.resists[k]<=100, `${m.id} ${k}`);
  assert.equal(revealSteps(m).lore, m.boss || m.elite || m.named ? 1 : 10);
}
assert.equal(DUNGEON_MONSTERS.bs_weepangel.resists.stone,100);
assert.equal(DUNGEON_MONSTERS.bs_mossgolem.resists.stone,100);
assert(monsterResists({rank:10, id:'x', race:'beast'}).flinch >= monsterResists({rank:1, id:'x', race:'beast'}).flinch);
assert(monsterResists({rank:10, id:'x', race:'beast'}).death > monsterResists({rank:1, id:'x', race:'beast'}).death);
assert(monsterResists({rank:4,boss:true,id:'x',race:'beast'}).poison > monsterResists({rank:4,id:'x',race:'beast'}).poison);
// 体質: 敵ごとに効きやすい異常と効きにくい異常がある (2026-10)
{
  const W = MON_RESIST_WEAKABLE, races = new Set(), seenWeak = new Set();
  let sameProfile = 0; const sig = new Map();
  for (const m of Object.values(DUNGEON_MONSTERS)) {
    if (m.metal) { for (const k of W) assert.equal(m.resists[k], 100, m.id); continue; }
    races.add(m.race);
    assert(RACE_RESIST[m.race], `種族の体質が無い: ${m.race}`);
    const t = resistTiers(m), lean = resistLean(m);
    const weak = W.filter(k => t[k] === 'weak');
    assert(weak.length >= 1, `効きやすい異常が無い: ${m.id}`);
    weak.forEach(k => seenWeak.add(k));
    assert(W.some(k => ['strong','imm'].includes(t[k])) || t.death === 'imm', `効きにくい異常が無い: ${m.id}`);
    for (const k of weak) {
      const v = m.resists[k];
      assert(v <= (m.boss ? 24 : m.elite ? 15 : 0), `${m.id} ${k}=${v}`);
      assert(v < 100);
    }
    if (m.ability && m.ability in t && m.ability !== 'stone') assert(['strong','imm'].includes(t[m.ability]), `自分の異常に強くない: ${m.id}`);
    if ((m.rank || 1) > 1) assert(lean.weak.length >= 1, `図鑑に効きやすい異常が出ない: ${m.id}`);
    const key = m.race + ':' + W.map(k => t[k]).join(',');
    sig.set(key, (sig.get(key) || 0) + 1);
  }
  for (const k of ['poison','paralyze','sleep','charm','confuse','seal','flinch']) assert(seenWeak.has(k), `どの敵の弱点にもならない異常: ${k}`);
  const th = DUNGEON_MONSTERS.bs_thornhound;
  assert.equal(th.resists.sleep, 0); assert(th.resists.confuse >= 60);
  assert(resistLean(th).weak.includes('sleep'));
  console.log(`体質: ${races.size}種族・体質の組み合わせ${sig.size}通り・7種の異常すべてがどこかの敵の弱点`);
}
for (const k in RESIST_LABEL) assert.equal(a.resists[k],0);
a.equip.acc1 = { aRes:{poison:.6}, resists:{magResist:80,stone:100,seal:50} };
a.equip.acc2 = { aRes:{poison:.6}, resists:{magResist:30,seal:50} };
recalc(a);
assert.equal(a.resists.poison,100); assert.equal(a.resists.magResist,100);
assert.equal(a.resists.stone,100); assert.equal(a.resists.seal,100);
assert.equal(b._resistCut(a,100,'magResist').dmg,0);
assert.equal(b.estRate(t,a,.5,'poison'),0);
assert.equal(b.estRate(t,a,.5,'stone'),0);
assert.equal(b.estRate(t,a,.5,'seal'),0);
a.equip.acc1 = a.equip.acc2 = null; recalc(a);
assert.deepEqual(a.resists,zeroResists());
console.log(`抵抗値0/80/100・全${Object.keys(DUNGEON_MONSTERS).length}敵・図鑑開放・装備集計・完全無効を確認`);

for (const job of SOUL_KEYS) for (const rank of [1,2,3,4,5]) {
  const soul = makeSoulInstance(job, rankThresholds(SOUL_CLASSES[job].rarity)[rank-1], 20);
  setSharedSouls([soul]);
  const d = makeDoll('職業抵抗検証'); d.primary = soul.uid; recalcDoll(d);
  const traits = jobBaseTraitsOf(job, rank);
  assert.equal(JOB_BASE_TRAITS[job].length, 2);
  assert.deepEqual(d.resists, traits.resists, `${job} ランク${rank}`);
  assert.equal(d.critBonus, traits.crit);
  for (const v of Object.values(d.resists)) assert(v === 0 || v === rank * 5);
  assert(traits.crit === 0 || Math.abs(traits.crit - rank * .05) < 1e-12);
  d.equip.acc1 = { crit: .03, resists: { physResist: 10 } };
  recalc(d); recalc(d);
  assert.equal(d.resists.physResist, traits.resists.physResist + 10);
  assert.equal(d.critBonus, traits.crit + .03);
  d.equip.acc1 = null; recalc(d);
  assert.deepEqual(d.resists, traits.resists);
  soul.level = 1000; soul.count = rankThresholds(SOUL_CLASSES[job].rarity)[rank] ? rankThresholds(SOUL_CLASSES[job].rarity)[rank] - 1 : 10000;
  recalcDoll(d);
  assert.deepEqual(d.resists, traits.resists);
  assert.equal(d.critBonus, traits.crit);
  d.primary = null; recalcDoll(d);
  assert.deepEqual(d.resists, zeroResists());
  assert.equal(d.critBonus, 0);
}
{
  const p = Object.assign(makeDoll('呪文抵抗検証'),{hp:1000,maxhp:1000,magResist:100});
  const enemy = {...t, atk:100, element:'fire', alive:true, hp:1000};
  const battle = new Battle([p],[enemy],()=>{});
  const hit = battle._exec({actor:enemy,action:'breath',kind:'spell'}).hits[0];
  assert.equal(hit.dmg,0); assert(hit.immune); assert.equal(p.hp,1000);
}
console.log('全職業・全5ランクの基礎特性・装備加算・倍率独立・主魂解除、敵の全体呪文への魔法抵抗100を確認');
