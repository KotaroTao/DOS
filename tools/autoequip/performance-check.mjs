// 共有袋を持つ人数で評価が増えず、計画中の再利用でも結果が変わらないことを確認する。
import assert from 'node:assert/strict';
import { planBestEquip } from '../../src/autoequip.js';
const bag = Array.from({length: 30}, (_, i) => ({slot: 'head', atk: i + 1}));
const dolls = Array.from({length: 6}, () => ({equip: {}, items: bag}));
let calls = 0;
const preview = (d, equip) => {
  calls++;
  const atk = Object.values(equip).reduce((sum, it) => sum + (it?.atk || 0), 0);
  return {atk, vit:0, agi:0, int:0, pie:0, luk:0, maxhp:100, maxmp:0};
};
const opts = {canEquip:()=>true, recalcPreview:preview, score:(d, delta)=>delta.atk};
const plan = planBestEquip(dolls, opts);
assert.equal(plan.moves.length, 6);
assert.deepEqual(plan.moves.map(m=>m.item.atk), [30,29,28,27,26,25]);
assert.equal(plan.gain, 165);
assert(calls < 6 * 30 * 3, `能力計算が多すぎる: ${calls}`);
assert(dolls.every(d=>d.items === bag && !d.equip.head));
assert.equal(bag.length, 30);
const sharedCalls = calls;
calls = 0;
const single = planBestEquip([dolls[0]], {...opts, pool:dolls, maxMoves:1});
assert.equal(single.moves[0].from, dolls[0]);
assert.equal(calls,31,'共有袋の候補を人数分再計算しない');
console.log(`共有袋・再評価: OK (6人・30品・6手の能力計算 ${sharedCalls}回)`);
