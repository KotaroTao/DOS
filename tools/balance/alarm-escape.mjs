// 警報は通常逃走だけを封じ、逃走の技と異変の制限を区別する。
import assert from 'node:assert/strict';
import { Battle } from '../../src/combat.js';
import { makeDoll } from '../../src/souls.js';
for (const noFlee of [false, true]) {
  const actor = makeDoll('検証の人業');
  Object.assign(actor, { alive:true, hp:100, maxhp:100, mp:100, maxmp:100 });
  const b = new Battle([actor], [], () => {}, { noRun:true, noFlee });
  assert.equal(b.fleeChance(actor), 0);
  assert.equal(b._execInner({ actor, action:'run' }).fledFail, true);
  assert.notEqual(b.result, 'flee');
  for (const spellKey of ['KEMURIDAMA','KAGEWATARI','KASUMIGAKURE']) {
    b.result = null;
    const res = b._execInner({ actor, action:'spell', spellKey, target:actor });
    assert.equal(!!res.fled, !noFlee, spellKey);
    assert.equal(!!res.fledFail, noFlee, spellKey);
  }
}
console.log('警報の通常逃走禁止・逃走技3種・退路封鎖の優先を確認');
