// 表示Lvの基準を全種確認。--reference <変更前のenemylevel.js> で数値と所要時間も比較する。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MONSTERS } from '../../src/sprites.js';
import { DUNGEON_MONSTERS } from '../../src/dungeons/index.js';
import { rngState } from '../../src/rng.js';
import * as current from '../../src/enemylevel.js';
Object.assign(MONSTERS, DUNGEON_MONSTERS);
const before = [...rngState()], keys = Object.keys(MONSTERS);
let reference;
if (process.argv[2] === '--reference') {
  const root = new URL('../../src/', import.meta.url).href;
  const source = readFileSync(process.argv[3], 'utf8').replaceAll('from "./', 'from "' + root);
  reference = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
}
function run(module) {
  const start = performance.now();
  module.enemyBaseSample('bs_bonepile');
  const firstMs = performance.now() - start;
  const samples = Object.fromEntries(keys.map(k => [k, {sample:module.enemyBaseSample(k),strength:module.enemyBaseStrength(k)}]));
  return {firstMs,totalMs:performance.now()-start,samples};
}
const old = reference && run(reference), now = run(current);
if (old) assert.deepEqual(now.samples, old.samples, '変更前と基準の個体が異なる');
for (const k of keys) {
  const {sample, strength} = now.samples[k];
  assert.equal(sample !== null, strength > 0, k);
  if (sample) {
    assert(sample.hp > 0 && sample.atk > 0 && sample.agi > 0, k);
    const e = {key:k,maxhp:sample.hp,atk:sample.atk};
    assert.equal(current.enemyDisplayLevel(e), 1, k);
    assert.deepEqual(current.enemyBaseSample(k), sample, k);
  }
}
assert.equal(current.enemyBaseSample('__unknown'), null);
assert.deepEqual(rngState(), before, '表示Lvの準備が乱数を消費');
console.log(JSON.stringify({species:keys.length,allMatch:!!old,before:old&&{firstMs:old.firstMs,totalMs:old.totalMs},after:{firstMs:now.firstMs,totalMs:now.totalMs},rngUnchanged:true}));
