// 付呪の同一特性の置換・枠制限・実効値の比較を確認する。
import assert from 'node:assert/strict';
import { AFX, applyAffixes, affixRange, afxBase, enchantAffixes, enchantBlock, enchantChange, pageFitsSlot, pageFromAffix, pageText } from '../../src/infaffix.js';
import { ITEMS, itemAtQuality, registerAffixes } from '../../src/items.js';
import { CATALOG_ITEMS } from '../../src/catalog/index.js';
Object.assign(ITEMS, CATALOG_ITEMS); registerAffixes(applyAffixes);

// 全種類で同じ特性がすでにあれば、満杯のコモンにも置換できる。
for (const d of AFX) {
  const tmpl = Object.values(ITEMS).find(it => it.price > 0 && pageFitsSlot({ k: d.id }, it));
  assert(tmpl, d.id);
  const v = d.kind === 'B' ? afxBase(tmpl) * affixRange(d, tmpl)[1] : affixRange(d, tmpl)[1];
  const it = { ...tmpl, rar: 'c', afx: [{ k: d.id, v }] };
  const page = pageFromAffix(it, it.afx[0]), before = structuredClone(it);
  assert.equal(enchantBlock(it, page, 'c', tmpl), null, d.id);
  const next = enchantAffixes(it, page);
  assert.equal(next.length, 1); assert.equal(next[0].k, d.id);
  assert.deepEqual(it, before, '比較中は実物を変更しない');
}
const tmpl = Object.values(ITEMS).find(it => it.slot === 'weapon' && it.price > 0 && !it.crit);
const item = afx => itemAtQuality({ ...tmpl, rar: 'lr', q: 50, afx });
const it = item([{ k: 'A09', v: .10 }, { k: 'K07', v: .10 }, { k: 'X01', v: 1 }, { k: 'X02', v: 1 }, { k: 'A03', v: 20 }]);
const stronger = { k: 'A09', v: .15, rar: 'lr' };
assert.equal(enchantBlock(it, stronger, 'lr'), null);
const next = enchantAffixes(it, stronger);
assert.deepEqual(next.map(a => a.k), it.afx.map(a => a.k), '極も順番も保持し、枠を増やさない');
assert.equal(next[1].v, .10);
assert.equal(enchantChange(it, stronger).lower, false);
assert.equal(pageText(stronger, it), item(next).afxText.find(a => a.k === 'A09').text, '会心は置換後の順序と上限で説明する');
assert(enchantChange(it, { ...stronger, v: .02 }).lower, '弱い会心には警告');
assert.equal(enchantBlock(it, { k: 'X03', v: 1 }, 'lr'), '書ける数 5つがいっぱい');
assert.equal(enchantBlock({ ...it, afx: it.afx.slice(2, 4) }, { k: 'X03', v: 1 }, 'lr'), '極は1つの品に1つまで');

const body = Object.values(ITEMS).find(it => it.slot === 'body' && it.price > 0);
const resist = itemAtQuality({ ...body, rar: 'c', q: 50, afx: [{ k: 'E01', v: 15 }] });
assert(enchantChange(resist, { k: 'E01', v: 5, rar: 'lr' }).lower, '抵抗値低下にも警告');
const deep = itemAtQuality({ ...tmpl, depth: 500, rar: 'lr', q: 50, afx: [{ k: 'A03', v: 1000 }] });
assert(enchantChange(deep, { k: 'A03', r: .15, depth: 0 }).lower, '浅い巻物で深度能力が下がる時にも警告');
const capped = applyAffixes({ ...tmpl, crit: .20, rar: 'lr', q: 50, afx: [{ k: 'A09', v: .10 }] });
assert.equal(enchantChange(capped, { k: 'A09', v: .05 }).lower, false, '実効値が同じなら低下の警告は不要');
console.log('全176種の満杯時の上書き・複数極/順序保持・会心上限・抵抗/深度の低下警告 OK');
