// 転生の回数制限・全職業の能力・再育成・保存往復を確認する。
import assert from 'node:assert/strict';
import { SOUL_KEYS, SOUL_CLASSES, makeSoulInstance, rankThresholds, soulLevelCapOf, soulRankOf, jobStatsOf, rebirthSoul, rebirthCount, soulRebirthReason, soulLabel, soulLearnedSkills } from '../../src/souls.js';
for (const key of SOUL_KEYS) {
  const s = makeSoulInstance(key, rankThresholds(SOUL_CLASSES[key].rarity)[4], 1);
  s.capBonus = 3;
  assert.equal(soulRankOf(s), 5, key);
  const cap = soulLevelCapOf(s), count = s.count, uid = s.uid;
  const base = jobStatsOf(key, s);
  assert(soulRebirthReason(s));
  assert(!rebirthSoul(s));
  for (let n = 1; n <= 5; n++) {
    s.level = cap - 1;
    assert(!rebirthSoul(s));
    s.level = cap; s.exp = 1000000;
    assert(rebirthSoul(s), key);
    assert.equal(s.level, 1); assert.equal(s.exp, 0);
    assert.equal(s.rebirth, n); assert.equal(s.count, count); assert.equal(s.uid, uid);
    assert.equal(soulLevelCapOf(s), cap); assert.equal(soulRankOf(s), 5);
    assert.equal((soulLabel(s).match(/★/g) || []).length, n);
    assert.deepEqual(soulLearnedSkills(s), soulLearnedSkills({...s, rebirth:0}));
    const stats = jobStatsOf(key, s);
    const precise = jobStatsOf(key, {...s, rebirth:0});
    for (const stat of Object.keys(base)) assert(Math.abs(stats[stat] - precise[stat] * (1 + n * .05)) <= 1.2, `${key} ${stat}`);
    assert.deepEqual(jobStatsOf(key, JSON.parse(JSON.stringify(s))), stats);
  }
  s.level = cap;
  const before = JSON.stringify(s);
  assert(!rebirthSoul(s)); assert.equal(JSON.stringify(s), before);
}
const old = makeSoulInstance('fighter', 1, 1);
assert(!rebirthSoul(old));
assert.deepEqual(jobStatsOf('fighter',old), jobStatsOf('fighter',{...old,rebirth:0}));
for (const n of [-1,Infinity,NaN,'5',null]) assert.equal(rebirthCount({rebirth:n}),0);
assert.equal(rebirthCount({rebirth:10}),5);
console.log(`全${SOUL_KEYS.length}職業：転生5回・Lv上限・融合数/残火の保持・技の再習得・星・保存往復・旧セーブを確認`);
