// 討伐した強敵・主本人にだけ倍率を掛け、通常敵・金貨・逃走には影響しない。
import assert from 'node:assert/strict';
import { Battle, enemySoulRewardMul } from '../../src/combat.js';
const foe = (mon = {}, rest = {}) => ({mon, soul: 17, gold: 11, alive: false, ...rest});
const rewards = (...enemies) => Battle.prototype.rewards.call({enemies});
assert.deepEqual(rewards(foe()), {soul:17,gold:11});
assert.deepEqual(rewards(foe({elite:true})), {soul:34,gold:11});
assert.deepEqual(rewards(foe({named:true})), {soul:34,gold:11});
assert.deepEqual(rewards(foe({}, {boss:true})), {soul:51,gold:11});
assert.equal(enemySoulRewardMul(foe({boss:true,elite:true,named:true})), 3);
assert.deepEqual(rewards(foe(),foe({elite:true}),foe({}, {boss:true})), {soul:102,gold:33});
assert.deepEqual(rewards(foe({elite:true},{alive:true}),foe({boss:true},{_fled:true})), {soul:0,gold:0});
assert.deepEqual(rewards(foe({named:true},{soul:undefined,exp:19})), {soul:38,gold:11});
assert.deepEqual(rewards(foe({elite:true},{soul:0})), {soul:0,gold:11});
console.log('通常・強敵・名のある強敵・主・混成・生存/逃走・旧セーブ・金貨を確認');
