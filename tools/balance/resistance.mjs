// 抵抗値の境界・全敵の体質・装備集計・実際の付与を検証する。
import assert from 'node:assert/strict';
import { Battle } from '../../src/combat.js';
import { SOUL_KEYS, SOUL_CLASSES, makeSoulInstance, setSharedSouls, recalcDoll, rankThresholds, makeDoll } from '../../src/souls.js';
import { recalc } from '../../src/items.js';
import { MONSTERS } from '../../src/sprites.js';
import { DUNGEON_MONSTERS } from '../../src/dungeons/index.js';
import { RESIST_LABEL, zeroResists, monsterResists } from '../../src/resistance.js';
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
assert(monsterResists({rank:10}).poison > monsterResists({rank:1}).poison);
assert(monsterResists({rank:4,boss:true}).poison > monsterResists({rank:4}).poison);
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
  assert.deepEqual(d.resists,zeroResists(), `${job} ランク${rank}`);
}
{
  const p = Object.assign(makeDoll('呪文抵抗検証'),{hp:1000,maxhp:1000,magResist:100});
  const enemy = {...t, atk:100, element:'fire', alive:true, hp:1000};
  const battle = new Battle([p],[enemy],()=>{});
  const hit = battle._exec({actor:enemy,action:'breath',kind:'spell'}).hits[0];
  assert.equal(hit.dmg,0); assert(hit.immune); assert.equal(p.hp,1000);
}
console.log('全職業・全5ランクの基礎抵抗0、敵の全体呪文への魔法抵抗100を確認');
