// 棚に保存しない極の消失判定。node tools/balance/extreme-sale.mjs
import assert from 'node:assert/strict';
import { lostExtremeAffixes } from '../../src/infaffix.js';
const set=(...afx)=>({afx});
const x=(k='X30',v=1)=>({k,v});
const plain={k:'A03',v:30};
assert.deepEqual(lostExtremeAffixes([set(plain),set(x())],0),[x()]);
assert.deepEqual(lostExtremeAffixes([set(plain),set(x())],1),[]);
assert.deepEqual(lostExtremeAffixes([set(x()),set(plain)],1),[x()]);
assert.deepEqual(lostExtremeAffixes([set(x()),set(x())],0),[]);
assert.deepEqual(lostExtremeAffixes([set(x('J20',.4)),set(x('J20',.7))],1),[]);
assert.deepEqual(lostExtremeAffixes([set(x('J20',.4)),set(x('J20',.7))],0),[x('J20',.7)]);
assert.deepEqual(lostExtremeAffixes([set(x('J02')),set(x('J10')),set(x('J11'))],1),[x('J02'),x('J11')]);
assert.deepEqual(lostExtremeAffixes([set(x()),set(x()),set(plain)],2),[x()]);
assert.deepEqual(lostExtremeAffixes([set(plain),set({k:'J01',v:1})],0),[]);
assert.deepEqual(lostExtremeAffixes([set(plain)],4),[]);
console.log('売る品/棚の極、同じ特性の同値・上位値、複数品・複数極、重複、秘以下を確認');
