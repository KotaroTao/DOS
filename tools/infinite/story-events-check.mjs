// 無限迷宮での本編・専用の共通抽選と、対応する迷宮の条件を確認する。
import assert from 'node:assert/strict';
import { WORLD } from '../../src/dungeons/world.js';
import { EVENTS, eligibleEvents, onceKey, pickEvent } from '../../src/events.js';
import { useMathRandom } from '../../src/rng.js';
useMathRandom();
const state = (sources, extra = {}) => ({ abyss: true, dungeonId: 'abyss', layer: 1, lv: 999,
  floor: 100, floors: 9999, runEv: {}, onceDone: () => false, sources, ...extra });
const source = (d, floor = d.floors) => ({ dungeonId: d.id, layer: d.layer, floor, floors: d.floors });
for (const d of WORLD) {
  const st = state([source(d)]), list = eligibleEvents(st);
  assert(list.some(e => e.inf), d.id + ': 専用の出来事を維持');
  const mythic = EVENTS.find(e => e.tier === 'mythic' && e.dungeonId === d.id);
  if (mythic) {
    assert(list.includes(mythic), d.id + ': 固有の極も候補');
    const once = JSON.parse(JSON.stringify({ [onceKey(mythic, d.layer)]: true }));
    assert(!eligibleEvents({...st, onceDone: e => !!once[onceKey(e, d.layer)]}).includes(mythic), d.id + ': 取得済みの極は除外');
  }
  assert(list.every(e => e.inf || !e.dungeonId || e.dungeonId === d.id), d.id + ': 別迷宮の極は出ない');
  assert(list.every(e => e.inf || !e.layer || e.layer === d.layer), d.id + ': 別層は出ない');
  const early = eligibleEvents(state([source(d, 1)]));
  assert(early.every(e => e.inf || !e.deep), d.id + ': 本編の深部条件を維持');
  assert(early.every(e => e.inf || !e.minFloor || e.minFloor <= 1), d.id + ': 本編の最低階を維持');
}
const d = WORLD.find(d => d.id === 'w42');
const banned = EVENTS.filter(e => e.notIn?.includes(d.id));
assert(banned.length);
assert(banned.every(e => !eligibleEvents(state([source(d)])).includes(e)), '先の章の真相を除外');
const all = state(WORLD.map(d => source(d)));
const pool = eligibleEvents(all);
assert.equal(new Set(pool).size, pool.length, '対応階が複数あっても候補は重複しない');
const secret = pool.find(e => e.inf && e.tier === 'rare');
assert(secret);
assert(!eligibleEvents({...all, runEv: {rareUsed: {[secret.id]: true}}}).includes(secret), '専用の秘の出撃内制限');
assert(eligibleEvents({...all, abyss:false, dungeonId:'w03', layer:1}).every(e => !e.inf), '本編に専用の出来事は出ない');
const random = Math.random;
Math.random = () => 0.999999;
assert.equal(pickEvent(pool).tier, 'mythic', '極を実際に抽選できる');
Math.random = random;
console.log('全迷宮の固有の極・取得済み除外・層/階/除外先・候補の重複防止・専用の秘・極の抽選 OK');
