// 戦闘ログの短縮表記。相性・軽減・回復・状態異常の意味を保つ。
import assert from 'node:assert/strict';
import { Battle, SPELLS } from '../../src/combat.js';
import { makeDoll } from '../../src/souls.js';
import { ELEMENTS } from '../../src/dungeons/schema.js';
import { useMathRandom } from '../../src/rng.js';
useMathRandom();
Math.random = () => .5;
const setup = (element = 'fire', affinity = { weak: [], resist: [] }) => {
  const a = Object.assign(makeDoll('味方'), { side: 'party', alive: true, hp: 100000, maxhp: 100000, mp: 100000, maxmp: 100000, atk: 100, vit: 0, int: 100, pie: 100, agi: 50, luk: 8, element });
  const t = { uid: 100000, name: '敵', side: 'enemy', alive: true, hp: 100000, maxhp: 100000, atk: 100, int: 100, pie: 100, vit: 0, agi: 10, luk: 8, element, affinity, mon: { race: 'beast' }, spells: [] };
  const logs = [];
  const b = new Battle([a], [t], s => logs.push(s));
  return { a, t, b, logs };
};
const spellKey = element => Object.keys(SPELLS).find(k => SPELLS[k].kind === 'atk' && SPELLS[k].element === element && !SPELLS[k].gravity);
for (const element of Object.keys(ELEMENTS).filter(k => k !== 'none')) {
  for (const [affinity, suffix] of [[{ weak: [element], resist: [] }, '弱点×1.5'], [{ weak: [], resist: [element] }, '耐性×0.5'], [{ weak: [], resist: [] }, null]]) {
    for (const route of ['physical', 'spell', 'item', 'enemy-physical', 'enemy-breath', 'enemy-spell', ...(element === 'fire' ? ['dragon'] : [])]) {
      const { a, t, b, logs } = setup(element, affinity);
      if (route.startsWith('enemy-')) a.affinity = affinity;
      if (route === 'physical') b._physical(a, t, { acc: 1 });
      if (route === 'spell') b._exec({ actor: a, action: 'spell', spellKey: spellKey(element), target: t });
      if (route === 'item') {
        const item = { name: '攻撃道具', use: { bomb: { el: element, power: 100 }, target: 'enemy' } };
        a.items.push(item); b._exec({ actor: a, action: 'item', item, target: t });
      }
      if (route === 'enemy-physical') b._physical(t, a, { acc: 1 });
      if (route === 'enemy-breath') b._exec({ actor: t, action: 'breath', kind: 'breath' });
      if (route === 'enemy-spell') b._exec({ actor: t, action: 'mimic', spellKey: spellKey(element), target: a });
      if (route === 'dragon') { a.passiveMap = { dragonknightIbuki: 4 }; Math.random = () => 0; b._roundStartRank(); Math.random = () => .5; }
      assert(logs.some(s => /に\d+ダメージ/.test(s)), `${element}/${route}：ダメージ行`);
      if (suffix) assert(logs.some(s => s.includes(ELEMENTS[element].label + suffix)), `${element}/${route}：相性`);
      else assert(!logs.some(s => /(?:弱点|耐性)×/.test(s)), `${element}/${route}：等倍`);
      assert(!logs.some(s => /undefined|NaN|99ターン/.test(s)), `${element}/${route}：不正な表記`);
    }
  }
}
{
  const { a, t, b, logs } = setup('fire', { weak: ['fire'], resist: [] });
  t.metal = 1;
  assert.equal(b._physical(a, t, { acc: 1 }).dmg, 1);
  assert(!logs.some(s => s.includes('弱点')));
  logs.length = 0; t.metal = 0; t.physResist = 50;
  b._physical(a, t, { acc: 1, pierce: .5, critBonus: 1 });
  assert(logs.some(s => s.includes('会心・火弱点×1.5・物理軽減25%')));
  logs.length = 0; t.physResist = 100;
  assert(b._physical(a, t, { acc: 1 }).immune);
  assert(logs.some(s => s.includes('物理無効')));
  assert(!logs.some(s => /\d+ダメージ/.test(s)));
}
{
  const { a, t, b, logs } = setup();
  for (const [sp, word] of [[{ poison: { chance: 1 } }, '毒'], [{ para: 1 }, '麻痺'], [{ seal: { chance: 1 } }, '封印'], [{ charm: 1 }, '魅了'], [{ confuse: 1 }, '混乱']]) {
    const { a, t, b, logs } = setup();
    Math.random = () => 0;
    b._inflict(a, t, sp, []);
    Math.random = () => .5;
    assert(logs.some(s => s.includes(`敵に${word}`)), word);
  }
  logs.length = 0;
  a.hp = 1;
  const healKey = Object.keys(SPELLS).find(k => SPELLS[k].kind === 'heal' && SPELLS[k].target === 'all-ally' && !SPELLS[k].revive);
  b._exec({ actor: a, action: 'spell', spellKey: healKey });
  assert(logs.some(s => /味方のHP\+\d+/.test(s)));
  logs.length = 0;
  const buffKey = Object.keys(SPELLS).find(k => SPELLS[k].kind === 'buff' && SPELLS[k].buff);
  b._exec({ actor: a, action: 'spell', spellKey: buffKey, target: a });
  assert(logs.some(s => /(?:味方|隊)：.*(?:STR|VIT|AGI|INT).*(?:ターン|戦闘中)/.test(s)));
}
// 魔法耐性を無視した分も、ログの軽減率へ反映する。
for (const [lv, note] of [[2, '魔法軽減25%'], [4, null]]) {
  const { a, t, b, logs } = setup();
  a.passiveMap = { archmageShinen: lv }; t.magResist = 50;
  b._exec({ actor: a, action: 'spell', spellKey: spellKey('fire'), target: t });
  if (note) assert(logs.some(s => s.includes(note)));
  else assert(!logs.some(s => s.includes('魔法軽減')));
}
console.log('戦闘ログ：6属性×6経路・竜の息吹の弱点／耐性／等倍、会心・貫通後の軽減・無効・金属・状態異常・全体回復・強化を確認');
