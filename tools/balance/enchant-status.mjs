// 付呪の状態異常の全組合せ・固有効果との併用・戦闘・旧品の再構築を確認。
import assert from 'node:assert/strict';
import { ITEMS, itemAtQuality, registerAffixes, recalc } from '../../src/items.js';
import { CATALOG_ITEMS } from '../../src/catalog/index.js';
import { applyAffixes, gearPerks, enchantBlock, enchantAffixes, affixRange, rollAffixes } from '../../src/infaffix.js';
import { onHitEffects, zeroResists } from '../../src/resistance.js';
import { makeDoll } from '../../src/souls.js';
import { Battle } from '../../src/combat.js';
import { useMathRandom } from '../../src/rng.js';
import { ailDetailLines, statLines, equipPreviewDelta } from '../../src/ui/itemview.js';
import { gearEffectOptions } from '../../src/ui/gearfilter.js';
Object.assign(ITEMS, CATALOG_ITEMS); registerAffixes(applyAffixes, gearPerks);
const tmpl = Object.values(ITEMS).find(it => it.slot === 'weapon' && it.rar === 'lr' && !it.onHit && !it.cursed);
const keys = ['F01', 'F02', 'F03', 'F04', 'F05', 'F06', 'F07'];
const page = k => ({ k, v: affixRange(k, { rar: 'lr' })[1], rar: 'lr' });
const fresh = (source = tmpl) => itemAtQuality({ ...source, q: 50, afx: [] });
const write = (it, k) => {
  assert.equal(enchantBlock(it, page(k), 'lr', ITEMS[it.id]), null, k);
  return itemAtQuality({ ...it, afx: enchantAffixes(it, page(k)) });
};
for (const a of keys) for (const b of keys) if (a !== b) {
  const it = write(write(fresh(), a), b);
  assert.deepEqual(it.afx.map(x => x.k), [a, b]);
}
let all = fresh();
for (const k of keys.slice(0, 5)) all = write(all, k);
assert.equal(onHitEffects(all.onHit).length, 5, '5種類を同じ武器へ');
assert.match(enchantBlock(all, page('F06'), 'lr'), /いっぱい/, '特性の総枠は維持');
assert.equal(write(all, 'F01').afx.length, 5, '満杯でも同じ特性を上書き');
const native = Object.values(ITEMS).find(it => it.slot === 'weapon' && it.onHit?.k === 'poison' && !it.cursed);
assert(native);
const mixed = write(write(fresh(native), 'F03'), 'F01');
const poison = onHitEffects(mixed.onHit).find(o => o.k === 'poison');
assert.equal(poison.chance, Math.max(native.onHit.chance, affixRange('F01', mixed)[1]), '固有効果と同じ異常は最大の率');
const rebuilt = itemAtQuality(structuredClone(all));
assert.deepEqual(rebuilt.onHit, all.onHit); assert.equal(rebuilt.price, all.price, '再構築で二重加算しない');
const erased = itemAtQuality({ ...all, afx: all.afx.filter(a => a.k !== 'F03') });
assert(!onHitEffects(erased.onHit).some(o => o.k === 'sleep'), '消した効果を持ち越さない');
for (const k of ['poison', 'paralyze', 'sleep', 'confuse', 'charm']) {
  assert(gearEffectOptions(all).some(o => o.key === `hit:${k}`), k + 'の絞り込み');
}
assert.equal(ailDetailLines(all).filter(s => s.startsWith('追加効果:')).length, 5);
assert(statLines(all).includes('毒付与') && statLines(all).includes('眠り付与'));
const actor = makeDoll('付呪の検査'); actor.equip.weapon = all; recalc(actor);
assert.equal(actor.onHit.length, 5);
assert.equal(equipPreviewDelta(makeDoll('比較'), all).onHit.to.length, 5, '装備比較にも全種類');

// 毒・眠り・封印・怯みは同じ一撃から付く。毒/麻痺、魅了/混乱の排他は維持。
useMathRandom(); const randomBefore = Math.random; Math.random = () => .001;
try {
  let weapon = fresh(); for (const k of ['F01', 'F03', 'F06', 'F07']) weapon = write(weapon, k);
  actor.equip.weapon = weapon; recalc(actor);
  Object.assign(actor, { atk: 100, agi: 100, hp: 10000, maxhp: 10000, mp: 1000, maxmp: 1000, passiveMap: {} });
  const enemy = { uid: 90001, name: '検査の敵', side: 'enemy', alive: true, hp: 1e8, maxhp: 1e8,
    atk: 10, vit: 0, agi: 1, int: 10, pie: 1, luk: 0, lv: 1, mon: { race: 'humanoid' }, resists: zeroResists(), spells: [] };
  const battle = new Battle([actor], [enemy], () => {});
  battle._physical(actor, enemy, { acc: 1 });
  assert.equal(enemy.ailment, 'poison'); assert(enemy.asleep); assert(enemy._flinch);
  assert(enemy.effects.some(e => e.stat === 'seal'), '封印も同時に付く');
  enemy.resists = Object.fromEntries(Object.keys(zeroResists()).map(k => [k, 100]));
  enemy.ailment = null; enemy.asleep = false; enemy._flinch = false; enemy.effects = [];
  battle._physical(actor, enemy, { acc: 1 });
  assert(!enemy.ailment && !enemy.asleep && !enemy._flinch && !enemy.effects.length, '無効の抵抗値は維持');
} finally { Math.random = randomBefore; }
// ドロップのF01〜05は従来どおり1種類まで。
for (let i = 0; i < 3000; i++) {
  const afx = rollAffixes({ slot: 'weapon', lv: 200, rar: 'lr', price: 100 }, 150);
  assert((afx || []).filter(a => keys.slice(0, 5).includes(a.k)).length <= 1);
}
console.log('状態異常7種の全42通り・5種同居・固有効果/上書き/消去・表示/比較/再構築・同一打撃の毒/眠り/封印/怯み・抵抗/抽選の維持 OK');
