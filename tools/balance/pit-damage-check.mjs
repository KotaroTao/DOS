// 落ちる床の実際の分岐を動かし、境界HP・死亡・浮遊・階移動を検査する。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const source = readFileSync(new URL('../../src/game.js', import.meta.url), 'utf8');
const branch = source.slice(source.indexOf('    case "pit": {', source.indexOf('function resolveCellMeasured')), source.indexOf('    case "poison": {', source.indexOf('function resolveCellMeasured')));
function check(party, { float = 0, bottom = false } = {}) {
  const state = { descended: 0, wiped: 0, imprinted: 0, event: null };
  const noop = () => {};
  const ctx = {
    G: { party: structuredClone(party), state: 'board', floor: bottom ? 5 : 1 },
    fallHaz: () => ({name:'古い竪坑',line:'落ちた'}), floatLeft: () => float,
    abyssActive: () => false, curDungeon: () => ({floors:5}), inDungeon: () => true,
    SFX: {trap:noop,die:noop}, ICONS: {trap:{}}, buzz:noop, shakeScreen:noop,
    flashScreen:noop, log:noop, showToast:noop, runCount:noop, flashPartyCards:noop,
    renderParty:noop, setTimeout:fn => { state.timer = fn; },
    descend:opts => { assert.equal(opts.fall,true); state.descended++; },
    gameOver:() => state.wiped++, imprintFallen:() => state.imprinted++,
    showEvent:event => { state.event = event; },
  };
  runInNewContext(`switch ('pit') { ${branch} }`, ctx);
  state.timer?.();
  state.event?.onClose();
  return { ...state, party:ctx.G.party };
}
const doll = (hp,maxhp=100,alive=true) => ({name:'旅人',hp,maxhp,alive});
for (const [hp,remaining,alive] of [[100,80,true],[21,1,true],[20,0,false],[19,0,false]]) {
  const r=check([doll(hp)]);
  assert.equal(r.party[0].hp,remaining); assert.equal(r.party[0].alive,alive);
  assert.equal(r.descended,alive?1:0); assert.equal(r.wiped,alive?0:1);
  assert.equal(r.imprinted,alive?0:1);
}
const rounded=check([doll(101,101),doll(1,1),doll(0,100,false)]);
assert.equal(rounded.party[0].hp,80); assert.equal(rounded.party[1].alive,false);
assert.equal(rounded.party[2].hp,0); assert.equal(rounded.descended,1);
assert.equal(rounded.imprinted,1); assert.ok(rounded.event);
for (const opts of [{float:1},{bottom:true}]) {
  const r=check([doll(19)],opts);
  assert.equal(r.party[0].hp,19); assert.equal(r.party[0].alive,true);
  assert.equal(r.descended,0); assert.equal(r.wiped,0);
}
console.log('落下: 最大HP20%・端数切り上げ・20%境界で死亡・混在隊・全滅・浮遊・最下階: OK');
