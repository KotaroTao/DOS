// 破魔の祝詞: 種族・ランク・生死・重複と、実ダメージ/オート見積もりの回帰確認。
import assert from 'node:assert/strict';
import { Battle, SPELLS, setElemKnown } from '../../src/combat.js';
import { makeDoll, passivesUpTo, PASSIVES } from '../../src/souls.js';
import { useMathRandom } from '../../src/rng.js';
useMathRandom();
Math.random = () => .5;
setElemKnown(null);
const member = (passiveMap = {}) => Object.assign(makeDoll('祝詞の検証'), {
  level: 40, jobLv: 40, atk: 1000, vit: 60, agi: 100, int: 1000, pie: 100,
  luk: 8, hp: 100000, maxhp: 100000, mp: 100000, maxmp: 100000,
  passiveMap, critBonus: 0,
});
const foe = (race) => ({
  uid: 100000, name: '検証の敵', side: 'enemy', alive: true,
  hp: 1e8, maxhp: 1e8, atk: 20, vit: 30, agi: 30, int: 30, pie: 30,
  luk: 8, lv: 40, element: 'none', mon: { race }, spells: [],
});
assert.equal(PASSIVES.exorcistJouka.label, '破魔の祝詞');
for (let rank = 1; rank <= 5; rank++) {
  const pm = JSON.parse(JSON.stringify(passivesUpTo('exorcist', rank)));
  assert.equal(pm.exorcistJouka || 0, Math.max(0, rank - 1));
  const bonus = [0, 0, .10, .15, .20, .25][rank];
  for (const race of ['undead', 'specter', 'demon', 'humanoid', 'dragon']) {
    const a = member(), holder = member(pm), t = foe(race);
    const b = new Battle([a, holder], [t], () => {});
    const expected = ['undead', 'specter', 'demon'].includes(race) ? bonus : 0;
    for (const on of [['basic', 'phys'], ['skill', 'phys'], ['spell']]) {
      assert.equal(b._perkSum(a, 'deal', { tgt: t, on }), expected);
      assert.equal(b._perkSum(holder, 'deal', { tgt: t, on }), expected);
    }
    assert.equal(b._perkSum(a, 'take', { tgt: t }), 0);
    holder.alive = false;
    assert.equal(b._perkSum(a, 'deal', { tgt: t }), 0);
    holder.alive = true;
    assert.equal(b._perkSum(a, 'deal', { tgt: t }), expected);
  }
}
// 同じ祝詞は最高Lvだけ。灯守の灯とは加算し、生存者が減ると即座に計算し直す。
{
  const a = member(), lo = member({ exorcistJouka: 1 }), hi = member({ exorcistJouka: 4 });
  const light = member({ seraTerasu: 2 }), t = foe('demon');
  const b = new Battle([a, lo, hi, light], [t], () => {});
  const sum = () => b._perkSum(a, 'deal', { tgt: t });
  assert.equal(sum(), .40);
  hi.alive = false; assert.equal(sum(), .25);
  light.alive = false; assert.equal(sum(), .10);
  lo.alive = false; assert.equal(sum(), 0);
}
// 通常攻撃・物理技・攻撃呪文で実ダメージと見積もりの両方が増える。
for (const key of [null, 'EXORCIST_HARAIBA', 'HOLYRAY']) {
  const measure = (withBlessing) => {
    const a = member(), holder = member(withBlessing ? { exorcistJouka: 4 } : {});
    const light = member(withBlessing ? { seraTerasu: 2 } : {}), t = foe('undead');
    const b = new Battle([a, holder, light], [t], () => {});
    const sp = key ? SPELLS[key] : null;
    assert(!key || sp, key);
    const estimate = sp?.kind === 'atk' ? b.estSpell(a, sp, t)
      : b.estPhys(a, t, sp ? { ...sp, skill: true } : {});
    const before = t.hp;
    b._exec({ actor: a, action: key ? 'spell' : 'attack', spellKey: key, target: t });
    return { estimate, damage: before - t.hp };
  };
  const base = measure(false), boosted = measure(true);
  for (const k of ['estimate', 'damage']) {
    assert(base[k] > 0, `${key}/${k}`);
    assert(Math.abs(boosted[k] - base[k] * 1.4) < 3, `${key}/${k}: ${base[k]} → ${boosted[k]}`);
  }
}
console.log('破魔の祝詞: ランク1〜5・対象3種族/対象外・全員/本人・死亡/復帰・最高Lv・灯との加算40%・実ダメージ/見積もり OK');
