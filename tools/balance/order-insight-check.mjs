import assert from 'node:assert/strict';
import { ORDER_MILESTONES, ORDER_FEATURES, orderProgress, nextOrderMilestone, migrateOrder } from '../../src/order.js';
import { CHAPTERS, UNLOCKS } from '../../src/story.js';
let expected = { seats: 0, rate: 0 };
for (const m of ORDER_MILESTONES) {
  assert.deepEqual(orderProgress(m.insight - 1), expected);
  expected = { seats: m.seats || expected.seats, rate: m.rate || expected.rate };
  assert.deepEqual(orderProgress(m.insight), expected);
}
assert.deepEqual(expected, { seats: 16, rate: .20 });
assert.equal(nextOrderMilestone(10500), null);
assert.equal(Object.keys(ORDER_FEATURES).length, 20);
for (const [key, u] of Object.entries(UNLOCKS)) if (/^order/.test(key)) assert.ok(u.retired && !u.lines.length);
const state = { order: { picks: [42] }, tut: { midUnlockLegacy: { order3: true } }, world: { reported: {} } };
migrateOrder(state, CHAPTERS);
assert.equal(state.order.legacySeats, 3);
assert.deepEqual(state.order.picks, [42]);
// 一度移行した後のストーリー報告で増えない。
for (const c of CHAPTERS) for (const id of c.dungeons) state.world.reported[id] = true;
migrateOrder(state, CHAPTERS);
assert.equal(state.order.legacySeats, 3);
const old = { world: state.world, order: { picks: [42] } };
migrateOrder(old, CHAPTERS);
assert.equal(old.order.legacySeats, 6);
assert.equal(old.order.legacyRate, .20);
assert.deepEqual(orderProgress(0, old.order), { seats: 6, rate: .20 });
assert.equal(nextOrderMilestone(0, old.order).insight, 5500);
assert.deepEqual(orderProgress(10500, old.order), expected);
const restored = JSON.parse(JSON.stringify(old));
migrateOrder(restored, CHAPTERS);
assert.deepEqual(restored, old);
const fresh = { order: { picks: [], insightVersion: 1 }, world: state.world };
migrateOrder(fresh, CHAPTERS);
assert.deepEqual(orderProgress(0, fresh.order), { seats: 0, rate: 0 });
const seatedOld = { order: { picks: [1,2,3,4,5] }, world: { reported: { [CHAPTERS[0].finale]: true } } };
migrateOrder(seatedOld, CHAPTERS);
assert.equal(seatedOld.order.legacySeats, 5);
console.log('PASS: 全20境界、旧王命の無効化、旧記録の保護・再保存、新記録のストーリー非依存');
