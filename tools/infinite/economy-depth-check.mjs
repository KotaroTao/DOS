// 進行別の深度と、育成倍率の異なるSoulを混ぜた場合の未使用残額の換算。
import assert from 'node:assert/strict';
import { infDepthLimitForChapter, syncInfSoulCarry, creditInfSoulCarry, infGrowthMul } from '../../src/abyss.js';
for (const [chapter, limit] of [[0,0],[7,0],[8,100],[9,100],[10,150],[11,150],[12,200],[13,200],[14,250],[15,250],[16,300],[17,300],[18,Infinity]]) {
  assert.equal(infDepthLimitForChapter(chapter), limit);
}
const ab = { soulCarry: { wallet: 0, base: 0 } };
creditInfSoulCarry(ab, 0, 1000, 100);
creditInfSoulCarry(ab, 1000, 2000, 400);
assert.equal(ab.soulCarry.base, 500);
// 半分を使えば、どの階の倍率を選んで支払ったことにするかに依存せず半分が残る。
assert.equal(syncInfSoulCarry(ab, 1500).base, 250);
assert.equal(syncInfSoulCarry(ab, 1550).base, 300); // 倍率なしの直接授与
const copy = JSON.parse(JSON.stringify(ab));
assert.equal(syncInfSoulCarry(copy, 1550).base, 300);
assert.equal(syncInfSoulCarry(copy, 0).base, 0);
const old = { depth: 200 };
const migrated = syncInfSoulCarry(old, 8000);
assert(migrated.legacy && migrated.base > 0);
for (let f = 1; f <= 300; f++) assert(migrated.base <= 8000 / infGrowthMul(f) + 1e-8);
console.log('OK: 全章の深度上限・混合倍率・支出・直接授与・保存復元・旧出撃の保守的換算');
