// C/UCの半減、既存品、巻物の移植、端数の実効値を確認する。
import assert from 'node:assert/strict';
import { AFX, applyAffixes, affixRange, affixRateScale, affixPower, affixLines, pageFromAffix, pageValue, pageText } from '../../src/infaffix.js';
import { ITEMS, itemAtQuality, recalc, registerAffixes } from '../../src/items.js';
import { CATALOG_ITEMS } from '../../src/catalog/index.js';
import { makeDoll } from '../../src/souls.js';
import { specialLines, statLines } from '../../src/ui/itemview.js';
Object.assign(ITEMS, CATALOG_ITEMS); registerAffixes(applyAffixes);
const near = (a, b) => assert(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
const item = (rar, k, v) => applyAffixes({ slot: 'weapon', rar, lv: 100, price: 100, afx: [{ k, v }] });
const affected = AFX.filter(d => affixRateScale(d, { rar: 'c' }) === .5);
assert(affected.length > 70, '今回挙げた種類以外も含めて半減する');
for (const rar of ['c', 'uc']) {
  near(item(rar, 'J08', .06).eff.lifesteal, .03);
  near(item(rar, 'A09', .011).crit, .0055);
  near(item(rar, 'A10', .30).critDamage, .15);
  near(item(rar, 'C03', .061).mult.atk, .0305);
  near(item(rar, 'E12', .03).bRes, .015);
  near(item(rar, 'F02', .06).onHit.chance, .03);
  near(item(rar, 'J13', .07).eff.spellCostMul, .965);
  const hurt = item(rar, 'J05', .03).afxFx[0].c;
  near(hurt.mp, .015); near(hurt.chance, .25);
  const cond = item(rar, 'I01', .15).afxFx[0].c;
  near(cond.v, .075); near(cond.when.selfLow, .5);
  near(item(rar, 'E10', 5).resists.physResist, 5);
  near(item(rar, 'X08', 1).afxMisc.split, .5);
  near(item(rar, 'J06', .30).afxFx[0].c.ret.k, .30);
  near(affixPower({ rar, lv: 100 }, [{ k: 'J08', v: .06 }]), 1.8);
  assert(affixLines({ rar, lv: 100 }, [{ k: 'A09', v: .011 }])[0].includes('0.55%'));
  assert(statLines(item(rar, 'A09', .011)).includes('0.55%'));
  assert(specialLines(item(rar, 'J08', .03)).some(s => s.includes('1.5%')));
  const a = makeDoll('端数'); a.equip.body = item(rar, 'E12', .03); recalc(a); near(a.breathRes, .015);
}
for (const rar of ['r', 'sr', 'lr']) {
  near(item(rar, 'J08', .06).eff.lifesteal, .06);
  near(item(rar, 'C03', .06).mult.atk, .06);
}
// すべての対象について、抽選値は保持し、巻物の往復で二重半減・強化を起こさない。
for (const d of affected) for (const source of ['c', 'uc', 'r', 'sr', 'lr']) for (const target of ['c', 'uc', 'r', 'sr', 'lr']) {
  const src = { rar: source, lv: 100, name: '出所' }, dst = { rar: target, lv: 100, name: '移植先' };
  const v = affixRange(d, src)[0];
  const page = pageFromAffix(src, { k: d.id, v });
  const value = pageValue(page, dst);
  const expected = Math.min(v * affixRateScale(d, src), affixRange(d, dst)[1] * affixRateScale(d, dst));
  near(value * affixRateScale(d, dst), expected);
  const roundTrip = pageFromAffix(dst, { k: d.id, v: value });
  near(pageValue(roundTrip, src) * affixRateScale(d, src), expected);
  assert.equal(pageText(page, { ...dst, afx: [] }), d.text(expected, 25));
}
// 既存品を品質から再構築しても保存値と価格を保ち、効果だけを半減する。
const tmpl = Object.values(ITEMS).find(it => it.rar === 'c' && it.slot === 'weapon');
const legacy = { ...tmpl, q: 50, afx: [{ k: 'J08', v: .06 }] };
const first = itemAtQuality(legacy), second = itemAtQuality(structuredClone(first));
near(first.eff.lifesteal, .03); near(second.eff.lifesteal, .03);
assert.deepEqual(second.afx, legacy.afx); assert.equal(second.price, first.price);
console.log(`${affected.length}種のC/UC割合半減・既存品・表示/評価・全レア度間の巻物往復・端数・対象外の維持 OK`);
