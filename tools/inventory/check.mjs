// 隊の共通袋の移行・装備交換・最適装備の回帰確認。
import assert from 'node:assert/strict';
import { MAX_ITEMS, shareInventory, bagOwners, setBagSource, equip, unequip, sortedBag, registerEquipLevel, BAG_SORTS } from '../../src/items.js';
import { makeDoll } from '../../src/souls.js';
import { planBestEquip, applyPlan, restoreEquip } from '../../src/autoequip.js';

const a = { id: 'same', name: '古い品', q: 12, locked: true };
const b = { id: 'same', name: '古い品', q: 88, unidentified: true };
const state = { party: [{ items: [a] }, { items: [b] }], reserve: [{ items: [a] }] };
shareInventory(state);
assert.equal(MAX_ITEMS, 50);
assert.deepEqual(state.inventory, [a, b]);
assert.equal(bagOwners([...state.party, ...state.reserve]).length, 1);
shareInventory(state);
assert.equal(state.inventory.length, 2);
assert.equal(state.party[0].items, state.reserve[0].items);
assert.equal(state.inventory[0], a);
assert.equal(state.inventory[1].q, 88);

setBagSource(() => state.inventory);
const first = makeDoll('前衛'), second = makeDoll('後衛');
assert.equal(first.items, state.inventory);
assert.equal(second.items, state.inventory);
const blade = { id: 'blade', name: '剣', slot: 'weapon', cat: 'ls', atk: 10 };
const old = { id: 'old', name: '古い剣', slot: 'weapon', cat: 'ls', atk: 1 };
const shield = { id: 'shield', name: '盾', slot: 'shield' };
const great = { id: 'great', name: '両手剣', slot: 'weapon', cat: 'ls', atk: 20, twoHanded: true };
const fill = () => state.inventory.splice(0, state.inventory.length, ...Array.from({length: 49}, (_, i) => ({ id: `misc${i}`, slot: 'misc' })), blade);
fill(); second.equip.weapon = old;
assert.equal(equip(second, blade).ok, true);
assert.equal(state.inventory.length, 50);
assert.ok(first.items.includes(old));
assert.ok(!first.items.includes(blade));
assert.equal(unequip(second, 'weapon').ok, false);
state.inventory.pop();
assert.equal(unequip(second, 'weapon').ok, true);
assert.equal(state.inventory.length, 50);
fill();state.inventory[49] = great;second.equip.weapon = old;second.equip.shield = shield;
assert.equal(equip(second, great).ok, false);
assert.equal(second.equip.weapon, old);
assert.equal(second.equip.shield, shield);
assert.ok(state.inventory.includes(great));
state.inventory.splice(0, 1);
assert.equal(equip(second, great).ok, true);
assert.equal(state.inventory.length, 50);
assert.equal(second.equip.shield, null);
assert.ok(state.inventory.includes(old) && state.inventory.includes(shield));

// 計画の仮の袋も共有し、同じ品を複数の人業へ装備しない。
state.inventory.splice(0, state.inventory.length, blade);
first.equip = {};second.equip = {};
const opts = { canEquip: () => true, recalc: () => {}, recalcPreview: (_d, eq) => ({ atk: eq.weapon?.atk || 0 }), score: (_d, delta) => delta.atk || 0 };
const plan = planBestEquip([first, second], opts);
assert.equal(plan.moves.length, 1);
assert.equal(plan.final.get(first).items, plan.final.get(second).items);
assert.equal(state.inventory.length, 1);
assert.equal(applyPlan(plan, opts), true);
assert.equal(state.inventory.length, 0);
assert.equal([first, second].filter(d => d.equip.weapon === blade).length, 1);
restoreEquip(plan.undoSnapshot, opts.recalc);
assert.deepEqual(state.inventory, [blade]);
assert.equal(first.items, second.items);

const overflow = { party: [{ items: Array.from({length: 56}, (_, i) => ({ id: `legacy${i}` })) }] };
shareInventory(overflow);shareInventory(overflow);
assert.equal(overflow.inventory.length, 56);
const home = state.inventory;
const away = { party: [{ items: [] }, { items: [] }], reserve: [] };
shareInventory(away);
assert.notEqual(away.inventory, home);
console.log('共通袋: 旧セーブ移行・50枠・装備交換・両手武器・最適装備・復元・無限迷宮の分離 OK');

// 表示順を変えても共通袋の参照・品の品質・元の順は変わらない。
const low = { id: 'low', name: '品10', slot: 'weapon', rar: 'c', q: 30, need: 10 };
const high = { id: 'high', name: '品2', slot: 'body', rar: 'lr', q: 90, need: 100 };
const herb = { id: 'herb', name: '薬草', slot: 'use' };
const unknown1 = { id: 'hidden1', unidentified: true }, unknown2 = { id: 'hidden2', unidentified: true };
for (const it of [unknown1, unknown2]) for (const key of ['name', 'rar', 'slot', 'q', 'need']) {
  Object.defineProperty(it, key, { get() { throw new Error('未鑑定の正体を参照した'); } });
}
registerEquipLevel(it => it.need || 1);
const unsorted = [unknown1, low, high, herb, unknown2];
const original = unsorted.slice();
for (const { key } of BAG_SORTS) {
  const sorted = sortedBag(unsorted, key);
  assert.notEqual(sorted, unsorted);
  assert.deepEqual(unsorted, original);
  assert.equal(new Set(sorted).size, original.length);
  if (key !== 'bag') assert.deepEqual(sorted.slice(-2), [unknown1, unknown2]);
}
assert.deepEqual(sortedBag(unsorted, 'type').slice(0, 3), [herb, low, high]);
for (const key of ['rarity', 'quality', 'level']) assert.deepEqual(sortedBag(unsorted, key).slice(0, 3), [high, low, herb]);
assert.deepEqual(sortedBag([low, high], 'name'), [high, low]);
assert.deepEqual(sortedBag(unsorted, 'invalid'), original);
assert.deepEqual(sortedBag([], 'name'), []);
console.log('ソート: 全6種・数字入りの名前・未鑑定の正体を隠す・元の順と参照の保全 OK');
