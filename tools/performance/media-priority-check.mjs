// 裏の取得が表示用を塞がず、表示用へ昇格できることを確認する。
import assert from 'node:assert/strict';
import { scheduleImage, prioritizeImage } from '../../src/mediaready.js';
const started = [], finishes = new Map();
function task(name, priority) {
  return scheduleImage(() => new Promise(resolve => { started.push(name); finishes.set(name, resolve); }), priority);
}
const flush = () => new Promise(resolve => setImmediate(resolve));
task('先読み1', 0); task('先読み2', 0);
task('先読み3', 0);
assert.equal(started.length, 2, '先読みだけで表示用の枠を使い切った');
for (let i = 1; i <= 5; i++) task('表示' + i, 1);
assert.equal(started.length, 6, '全体の同時取得数が6件ではない');
finishes.get('先読み1')(); await flush();
assert.equal(started.at(-1), '表示5', '先読みが表示用より先に始まった');
finishes.get('表示1')(); await flush();
assert(started.includes('先読み3'), '先読みの空き枠を再利用しなかった');
// 先読みの枠が埋まっていても、表示用に変われば空き枠を使える。
const next = task('先読み4', 0);
finishes.get('表示2')(); await flush();
assert(!started.includes('先読み4'), '先読みが2件の上限を超えた');
prioritizeImage(next, 1); await flush();
assert(started.includes('先読み4'));
for (const [name, done] of finishes) done(); await flush();
for (const [name, done] of finishes) done(); await flush();
console.log('取得全体6件・先読み2件・表示用の優先・待ち行列の昇格: OK');
