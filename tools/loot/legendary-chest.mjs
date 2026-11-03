// 伝説の宝箱の実処理と、全迷宮のLR候補を確認する。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { CATALOG_ITEMS } from '../../src/catalog/index.js';
import { ITEMS as BASE_ITEMS } from '../../src/items.js';
import { WORLD } from '../../src/dungeons/world.js';
import { LR_UNLOCK, LOOT_R_HEADROOM } from '../../src/equiplevel.js';
const source = readFileSync(new URL('../../src/game.js', import.meta.url), 'utf8');
function fn(name) {
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf('\n}', start) + 2;
  assert(start >= 0 && end > start);
  return source.slice(start, end);
}
let cfg, floor, roll = 0;
const ITEMS = { ...BASE_ITEMS, ...CATALOG_ITEMS };
let picked, ordinary = 0;
const context = vm.createContext({
  ITEMS, LR_UNLOCK, LOOT_R_HEADROOM,
  G: { get floor() { return floor; } },
  activeCfg: () => cfg, battleLayer: () => cfg.layer,
  random: () => (roll++ % 100) / 100,
  rand: n => roll++ % n, mutNum: () => 0,
  sfNum: (_key, fallback) => fallback, boardSink: () => ({}),
  pickLoot: () => { ordinary++; return 'herb'; },
  cloneItem: id => { assert(ITEMS[id], `品が存在する: ${id}`); return { ...ITEMS[id], id }; },
  markDungeonLoot: () => {},
  queuePickup: entry => { picked = entry.item; },
  autosave: () => {}, afterPickups: done => done(),
});
vm.runInContext(['lootBaseR', 'lootCapR', 'lootLvAt', 'lrPool', 'pickLR', 'chestContents'].map(fn).join('\n'), context);
let count = 0;
for (cfg of WORLD) {
  for (floor = 4; floor <= cfg.floors; floor++) {
    assert(vm.runInContext('lrPool().length', context) > 0, `${cfg.id} B${floor}F: LR候補あり`);
    for (let rank = 1; rank <= 5; rank++) {
      picked = null;
      context.rank = rank;
      vm.runInContext('chestContents({lootBonus:40}, () => {}, rank)', context);
      assert.equal(picked?.rar, 'lr', `${cfg.id} B${floor}F ランク${rank}`);
      assert(!['misc', 'use', 'mat'].includes(picked.slot));
      count++;
    }
  }
}
assert.equal(ordinary, 0, '伝説の宝箱は通常抽選を通らない');
cfg = WORLD.at(-1); floor = 4;
vm.runInContext('chestContents({}, () => {}, 1, 0, true)', context);
assert.equal(ordinary, 1, '通常の宝箱は従来の抽選を使う');
console.log(`OK: 全${WORLD.length}迷宮の4階以降×宝箱5ランク、${count}回すべてLR装備。通常宝箱の抽選も維持。`);
