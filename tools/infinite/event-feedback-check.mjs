// 全出来事・全選択肢の成功/失敗と戦闘後報酬を通し、演出と進行の抜けを調べる。
import assert from 'node:assert/strict';
import { INF_EVENTS } from '../../src/infevents.js';
import { useMathRandom } from '../../src/rng.js';
import { SFX } from '../../src/audio.js';
useMathRandom();
let count = 0;
for (const roll of [0, 0.999]) {
  Math.random = () => roll;
  for (const event of INF_EVENTS) for (let i = 0; i < event.opts.length; i++) {
    const calls = [], run = { mods: [] }, floor = { mods: [] };
    const party = [{ uid: 'a', name: '器', hp: 50, maxhp: 100, mp: 10, maxmp: 100, ailment: 'poison' }];
    const cell = {};
    let finished = false, fight = null;
    const native = (kind, next) => { calls.push(kind); if (next) next(); };
    const A = {
      aliveList: () => party, deadList: () => [{}], randomAlive: () => party[0],
      canPayGold: () => true, canPaySoul: () => true, embers: () => 100,
      goldCost: x => x, soulCost: x => x,
      payGold() {}, paySoul() {}, payEmber() {}, hurtAll() {}, hurtOne() {}, mpAll() {}, healAll() {}, revive() {},
      ailAll(kind) { if (!roll) party[0].ailment = kind; },
      runEv: () => run, floorEv: () => floor, check: () => ({ ok: !roll, who: party[0] }),
      gold(u, from, opt) { if (!opt?.quiet) calls.push('goldSound'); }, soul() {}, ember() {},
      log() {}, toast() {}, revealStairs() {}, revealWhere() {},
      sfx(k) { assert.equal(typeof SFX[k], 'function', k); calls.push('sound:' + k); },
      flash(c) { assert.match(c, /^#[0-9a-f]{6}$/i); calls.push('flash'); },
      item: (o, from, next) => native('item', next), itemMinRar: (o, from, next) => native('item', next),
      soulDrop: (o, from, next) => native('soul', next), chestHere: (c, o, next) => native('chest', next),
      fight(c, specs, tag) { fight = { tag }; native('fight'); },
      done(c, next) { finished = true; next?.(); },
    };
    const choices = event.choices(A, cell);
    assert.equal(choices.length, event.opts.length, event.id);
    choices[i].fn();
    const label = `${event.id}/${i}/${roll}`;
    assert(calls.length > 0, '無演出: ' + label);
    assert(calls.filter(x => x.startsWith('sound:')).length <= 1, '音の重複: ' + label);
    assert(!calls.includes('goldSound'), '金貨の音の重複: ' + label);
    if (event.id === 'inf_u19') {
      assert(calls.includes('sound:' + (i === 0 && roll ? 'trap' : 'itemget')), label);
      assert.equal(floor.mods.length, i === 0 && roll ? 1 : 0);
    }
    if (fight) { calls.length = 0; event.onWin(A, cell, fight, () => { finished = true; }); assert(calls.length, '勝利後の無演出: ' + label); }
    assert(finished || calls.includes('chest'), '進行が止まった: ' + label);
    count++;
  }
}
console.log(`${INF_EVENTS.length}出来事・${count}選択/分岐と戦闘後報酬: 演出・音の重複・進行 OK`);
