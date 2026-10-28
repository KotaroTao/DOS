// 2026-10-20 指定の確定首級24点。自動補正・旧品再構築後も固有効果を守る。
import assert from 'node:assert/strict';
import { ITEMS, itemAtQuality, registerAffixes } from '../../src/items.js';
import { CATALOG_ITEMS } from '../../src/catalog/index.js';
import { NAMED_FOES } from '../../src/dungeons/named.js';
import { applyNativeCritical } from '../../src/equipmentcrit.js';
import { applyAffixes } from '../../src/infaffix.js';
import { specialLines, statLines } from '../../src/ui/itemview.js';
Object.assign(ITEMS, CATALOG_ITEMS); registerAffixes(applyAffixes);
const near = (a, b) => assert(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
const expected = {
  w_nm_palebutcher: { onHit: { k: 'paralyze', chance: .2 } },
  r_nm_cryptlord: { eff: { soulUp: .1 }, eDef: {"el": "dark", "pct": 40, "values": {"dark": 40}, "kind": "defense"} },
  g_nm_bloatqueen: { eff: { lifesteal: .05 } },
  s_nm_drownedpaladin: { eff: { guard: .05 }, eDef: {"el": "water", "pct": 50, "values": {"water": 50}, "kind": "defense"} },
  w_nm_chainoverseer: { eff: { multistrike: 2 } },
  w_nm_crystalseer: { eff: { spellCostMul: .9 }, aRes: { stone: .4 }, eAtk: {"el": "wind", "pct": 25} },
  w_nm_warbanner: { eAtk: {"el": "fire", "pct": 35} },
  w_nm_headsman: { crit: .03, critDamage: .30 },
  s_nm_eldertreant: { eff: { regen: .03 }, bRes: .25, eDef: {"el": "earth", "pct": 80, "values": {"earth": 80}, "kind": "defense"} },
  a_nm_mistmother: { aRes: { paralyze: .30, sleep: .30 }, eDef: {"el": "water", "pct": 70, "values": {"water": 70, "wind": 40}, "kind": "defense"} },
  w_nm_heresiarch: { eff: { lifesteal: .05 }, eAtk: {"el": "light", "pct": 30} },
  h_nm_fallenidol: { crit: .03, eDef: {"el": "light", "pct": 50, "values": {"light": 50}, "kind": "defense"} },
  r_nm_cinderking: { eff: { regen: .03 }, bRes: .20, eDef: {"el": "fire", "pct": 60, "values": {"fire": 60}, "kind": "defense"} },
  a_nm_magmawyrm: { bRes: .30, eDef: {"el": "fire", "pct": 90, "values": {"fire": 90}, "kind": "defense"} },
  w_nm_frostsovereign: { onHit: { k: 'paralyze', chance: .2 }, eAtk: {"el": "earth", "pct": 30} },
  s_nm_glacialmaw: { eff: { guard: .05 }, bRes: .30, eDef: {"el": "water", "pct": 70, "values": {"water": 70}, "kind": "defense"} },
  r_nm_offeringslime: { eff: { goldUp: .1 }, aRes: { poison: .30 }, eDef: {"el": "dark", "pct": 60, "values": {"dark": 60}, "kind": "defense"} },
  w_nm_bogfrogking: { onHit: { k: 'paralyze', chance: .2 }, eAtk: {"el": "wind", "pct": 30} },
  w_nm_blizzardwitch: { eff: { spellCostMul: .9 }, aRes: { sleep: .30 }, magic: true, eAtk: {"el": "fire", "pct": 30} },
  w_nm_stareater: { eff: { lifesteal: .05 }, eAtk: {"el": "light", "pct": 30} },
  w_nm_ashshogun: { eff: { regen: .03 }, crit: .05 },
  a_nm_dragonslayer: { resists: { physResist: 15 }, bRes: .30 },
  h_nm_tunnelking: { eff: { soulUp: .1 }, aRes: { confuse: .30 } },
  s_nm_oremaw: { resists: { physResist: 15 }, aRes: { stone: .30 }, eDef: {"el": "earth", "pct": 100, "values": {"earth": 100}, "kind": "defense"} },
};
assert.equal(Object.keys(expected).length, 24);
for (const [id, fields] of Object.entries(expected)) {
  const it = ITEMS[id];
  assert(it?.trophy && NAMED_FOES[it.trophy]?.trophy === id, id + ' 入手元');
  assert(it.noDrop && it.rar === 'sr', id + ' 固定首級を維持');
  for (const value of [it, itemAtQuality({ ...structuredClone(it), q: 50 })])
    for (const [key, want] of Object.entries(fields)) assert.deepEqual(value[key], want, id + '/' + key);
}
for (const [id, old] of Object.entries({
  w_nm_headsman: { crit: .12, critDamage: .41 },
  h_nm_fallenidol: { crit: .089 },
  w_nm_ashshogun: { crit: .10, eff: { regen: .04 } },
  g_nm_bloatqueen: { eff: { lifesteal: .15 } },
  w_nm_crystalseer: { eff: { spellCostMul: .85 } },
})) {
  const legacy = { ...structuredClone(ITEMS[id]), ...old, q: 50 };
  delete legacy.nativeCriticalFixed;
  const updated = itemAtQuality(legacy);
  for (const [key, want] of Object.entries(expected[id])) assert.deepEqual(updated[key], want, id + ' 旧品');
  const before = structuredClone(updated); applyNativeCritical(updated);
  assert.deepEqual(updated, before, id + ' 自動補正で上書きしない');
}
const axe = ITEMS.w_nm_headsman;
const enchanted = itemAtQuality({ ...structuredClone(axe), q: 50, afx: [{ k: 'A09', v: .01 }] });
near(enchanted.crit, .04); near(enchanted.critDamage, .30);
assert(itemAtQuality(axe, 100).crit > .03, '品質補正は維持');
assert(statLines(axe).includes('会心 +3%'));
assert(statLines(axe).includes('会心ダメージ +30%'));
assert(specialLines(ITEMS.g_nm_bloatqueen).some(s => s.includes('5%')));
console.log('確定首級24点の指定効果・入手元・会心固定・旧品再構築・品質/付呪・表示 OK');
