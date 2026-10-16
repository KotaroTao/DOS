// 極の配置・取得・永続強化を実際の出来事処理と人業再計算で確認する。
import assert from 'node:assert/strict';
import { WORLD } from '../../src/dungeons/world.js';
import { EVENTS, eligibleEvents, runEvent, permanentEventStats } from '../../src/events.js';
import { SOUL_KEYS, makeSoulInstance, setSharedSouls, makeDoll, recalcDoll, setPermanentStatSource } from '../../src/souls.js';
const mythics = EVENTS.filter(e => e.tier === 'mythic');
assert.equal(mythics.length, WORLD.filter(d => !d.tutorial).length - 1);
const counts = {};
for (const d of WORLD) {
  const expected = d.noEvents ? 0 : 1;
  for (const floor of [1, d.floors]) {
    const st = { dungeonId: d.id, layer: d.layer, lv: d.lv, first: d.id === 'w01', floor, floors: d.floors, runEv: {}, onceDone: () => false };
    const candidates = eligibleEvents(st).filter(e => e.tier === 'mythic');
    assert.equal(candidates.length, expected, `${d.id} B${floor}`);
    // 無限迷宮では専用の出来事と対応先の本編の出来事を一緒に抽選する。
    {
      const inf = eligibleEvents({ ...st, abyss: true, floors: 9999, sources: [st] });
      assert(inf.some(e => e.inf), `${d.id} 無限迷宮の専用出来事`);
      const own = mythics.find(e => e.dungeonId === d.id);
      if (own) assert(inf.includes(own), `${d.id} 無限迷宮で固有の極も候補`);
      assert(inf.every(e => e.inf || !e.dungeonId || e.dungeonId === d.id), `${d.id} 別迷宮の極を除外`);
    }
    assert.equal(eligibleEvents(st).filter(e => e.inf).length, 0);
    assert.equal(eligibleEvents({ ...st, onceDone: () => true }).filter(e => e.tier === 'mythic').length, 0);
  }
}
for (const e of mythics) {
  const stat = Object.keys(e.statBonus)[0];
  counts[stat] = (counts[stat] || 0) + 1;
}
assert.equal(Object.keys(counts).length, 9);
assert(Math.max(...Object.values(counts)) - Math.min(...Object.values(counts)) <= 1, "効果ごとの件数の差は1件まで"); // 均等 (差0) も可
let once = {};
const flags = {};
setPermanentStatSource(() => permanentEventStats(once));
const dolls = SOUL_KEYS.map(key => {
  const soul = makeSoulInstance(key, 1, 1);
  const doll = makeDoll(key); doll.primary = soul.uid;
  return { soul, doll };
});
setSharedSouls(dolls.map(x => x.soul));
const stats = d => ({hp:d.maxhp, mp:d.maxmp, atk:d.atk, vit:d.vit, agi:d.agi, int:d.int, pie:d.pie, luk:d.luk, crit:d.critBonus});
for (const {doll} of dolls) recalcDoll(doll);
const before = dolls.map(({doll}) => stats(doll));
const api = {
  layer: 1, flags: () => flags, sfx: () => {}, seen: () => {}, log: () => {},
  picked: e => { once[e.id] = true; },
  recalcPermanent: () => dolls.forEach(({doll}) => recalcDoll(doll)),
  icon: () => null, gift: (_name, _lines, _icon, _options, done) => done(),
  done: cell => { cell.cleared = true; },
};
for (const e of mythics) {
  const cell = {evId:e.id};
  runEvent(api, cell);
  assert(once[e.id]); assert(cell.cleared);
  const snapshot = dolls.map(({doll}) => stats(doll));
  runEvent(api, cell);
  assert.deepEqual(dolls.map(({doll}) => stats(doll)), snapshot);
}
const bonus = permanentEventStats(once);
for (let i = 0; i < dolls.length; i++) {
  const after = stats(dolls[i].doll);
  for (const key of Object.keys(bonus)) assert(Math.abs(after[key] - before[i][key] - bonus[key]) < 1e-9, `${SOUL_KEYS[i]} ${key}`);
}
// セーブのJSON往復・繰り返し再計算・新しい人業にも同じ値が適用される。
const final = dolls.map(({doll}) => stats(doll));
once = JSON.parse(JSON.stringify(once));
for (const {doll} of dolls) { recalcDoll(doll); recalcDoll(doll); }
assert.deepEqual(dolls.map(({doll}) => stats(doll)), final);
const future = makeDoll('新しい人業'); future.primary = dolls[0].soul.uid; recalcDoll(future);
assert.deepEqual(stats(future), final[0]);
const empty = makeDoll('空'); recalcDoll(empty); assert.equal(empty.maxhp, 1); assert.equal(empty.critBonus, 0);
console.log(`${mythics.length}迷宮固有の極・全${SOUL_KEYS.length}職業・取得/再取得/セーブ往復/新規人業を確認`, counts, bonus);
