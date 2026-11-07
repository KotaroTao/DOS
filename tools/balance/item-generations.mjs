// 装備の世代 (docs/item-generations.md) の回帰検査。
//   node tools/balance/item-generations.mjs
// 深部の上限の値は書かない (上限の関数を呼んで値を得る)。
import assert from "node:assert/strict";
import { ITEMS, itemAtQuality, registerEquipLevel, registerAffixes, equipLevelOf, wearerGen, wearerItem, canEquip, recalc, SLOTS } from "../../src/items.js";
import { CATALOG_ITEMS } from "../../src/catalog/index.js";
import { repriceEquipment, equipPrice, equipScore } from "../../src/pricing.js";
import { equipLevelFor, equipLvTable } from "../../src/equiplevel.js";
import { applyAffixes, afxBase } from "../../src/infaffix.js";
import { genOf, genMul, genForCap, genForLegacyDepth, legacyDepthMul, standardPerfAt, STANDARD_PERF, GEN_STAT_KEYS } from "../../src/itemgen.js";
import { depthLimit } from "../../src/progression.js";
import { infLevel } from "../../src/abyss.js";
import { lootBand, WORLD } from "../../src/dungeons/world.js";
import { refGold, refSoul, trainCost, lvPow } from "../../src/levelcurve.js";

Object.assign(ITEMS, CATALOG_ITEMS);
repriceEquipment(ITEMS);
registerEquipLevel(equipLevelFor);
registerAffixes(applyAffixes);

const EQUIP = new Set(["weapon", "shield", "body", "head", "hands", "feet", "acc"]);
const ids = Object.keys(ITEMS).filter((id) => EQUIP.has(ITEMS[id].slot) && ITEMS[id].price > 0 && !ITEMS[id].cursed);
const at = (id, gen, q = 50) => itemAtQuality({ ...ITEMS[id], q }, q, gen);
const stats = (it) => GEN_STAT_KEYS.reduce((s, k) => s + Math.max(0, it[k] || 0), 0);
let checked = 0;

// 1. 同じ品の世代が上がれば、性能と値段と装備できるLv は必ず上がる (世代の境目を含む)
for (const id of ids) {
  let prev = null;
  for (const g of [1, 2, 3, 4, 7, 12]) {
    const it = at(id, g);
    assert.equal(genOf(it), g);
    const cur = { pts: it.equipPts, price: it.price, lv: equipLevelOf(it, g) };
    if (prev) {
      assert(cur.pts > prev.pts, `${id} 第${g}世代の性能が上がらない`);
      assert(cur.price > prev.price, `${id} 第${g}世代の値段が上がらない`);
      assert(cur.lv >= prev.lv, `${id} 第${g}世代の装備Lv が下がる`);
    }
    assert(Number.isSafeInteger(it.price) && it.price > 0, `${id} 値段`);
    prev = cur;
    checked++;
  }
  // 割合・確率・上限は変えない
  const a = at(id, 1), b = at(id, 5);
  for (const k of ["crit", "critDamage", "spellCrit", "spellCritDamage", "bRes"]) assert.equal(b[k], a[k], `${id} ${k} は世代で変わらない`);
  assert.deepEqual(b.mult || null, a.mult || null, `${id} mult`);
  assert.deepEqual(b.scale || null, a.scale || null, `${id} 武器の係数は目録のまま`);
  assert.deepEqual(b.eff || null, a.eff || null, `${id} eff`);
}

// 2. 第2世代の隠しLv1 ≒ 第1世代の隠しLv200 (標準品の物差し)
for (const slot of Object.keys(STANDARD_PERF)) {
  const r = standardPerfAt(slot, 201) / STANDARD_PERF[slot](200);
  assert(r > 1 && r < 1.02, `${slot}: 通しLv201 / 200 = ${r}`);
  assert(Math.abs(genMul({ slot, lv: 1 }, 2) * STANDARD_PERF[slot](1) / STANDARD_PERF[slot](200) - r) < 1e-9);
}

// 3. 抽選の世代: 第1世代の帯では常に 1。上限を越えない一番上の世代
for (let cap = 1; cap <= 22; cap++) for (let R = 1; R <= 20; R++) {
  const g = genForCap(R, cap);
  if (cap <= 20) assert.equal(g, 1);
  assert(20 * (g - 1) + R <= Math.max(cap, R));
}
assert.equal(genForCap(1, 21), 2); assert.equal(genForCap(2, 21), 1); assert.equal(genForCap(20, 39), 1); assert.equal(genForCap(20, 40), 2);

// 4. 装備する人の Lv: 出せる一番上の世代の性能。第1世代にも届かなければ装備できない
const tmpl = ITEMS[ids.find((id) => ITEMS[id].slot === "weapon" && (ITEMS[id].lv || 1) >= 150)];
const it4 = at(tmpl.id, 4);
const L1 = equipLevelOf(it4, 1), L2 = equipLevelOf(it4, 2), L4 = equipLevelOf(it4, 4);
assert(L1 < L2 && L2 < L4);
const fake = (jobLv) => ({ jobLv, base: { atk: 50, vit: 50, agi: 50, int: 50, pie: 50, luk: 50, hp: 500, mp: 50, crit: 0 }, equip: {}, clsKey: null, hp: 1, mp: 1 });
assert.equal(wearerGen(fake(L4), it4), 4);
assert.equal(wearerGen(fake(L4 - 1), it4), 3);
assert.equal(wearerGen(fake(L2), it4), 2);
assert.equal(wearerGen(fake(L1), it4), 1);
assert.equal(wearerGen(fake(L1 - 1), it4), 0);
assert.equal(canEquip(fake(L1 - 1), it4, { anyLv: false }), false, "第1世代にも届かなければ装備できない");
assert.equal(wearerGen({ base: {} }, it4), 4, "jobLv の無い見立ては本来の世代");
const weak = wearerItem(fake(L2), it4);
assert.equal(genOf(weak), 2);
assert.equal(weak.atk, at(tmpl.id, 2).atk);
assert.equal(wearerItem(fake(L4), it4), it4);
// recalc はその人の世代の性能で能力を出す
const m2 = fake(L2), m4 = fake(L4);
m2.equip.weapon = it4; m4.equip.weapon = it4; recalc(m2); recalc(m4);
const ref2 = fake(L4); ref2.equip.weapon = at(tmpl.id, 2); recalc(ref2);
assert.equal(m2.atk, ref2.atk, "Lv不足の人は下の世代の能力");
assert(m4.atk > m2.atk);

// 5. 装備できるLv の表: 第1世代は今の表のまま (R1〜20)
assert.deepEqual(equipLvTable().slice(1), [1, 1, 1, 10, 18, 22, 30, 37, 41, 49, 55, 62, 70, 75, 83, 89, 97, 100, 110, 114]);

// 6. 旧セーブの深度品は性能を下げずに世代へ移る
for (const id of ids.filter((_, i) => i % 13 === 0)) {
  for (const d of [150, 201, 260, 500, 1500]) {
    const g = genForLegacyDepth(ITEMS[id].slot, ITEMS[id].lv, d);
    const m = legacyDepthMul(d);
    if (d <= 200) { assert.equal(g, 1); continue; }
    assert(g >= 2);
    assert(genMul(ITEMS[id], g) >= m - 1e-9, `${id} B${d}F: 世代の倍率が旧来を下回る`);
    if (g > 2) assert(genMul(ITEMS[id], g - 1) < m, `${id} B${d}F: 一番低い世代ではない`);
  }
}

// 7. 追加特性の基準 B も世代で伸びる
assert(afxBase({ lv: 200, gen: 2 }) > afxBase({ lv: 200 }));
assert.equal(afxBase({ lv: 120, gen: 1 }), afxBase({ lv: 120 }));

// 8. 数値の桁: 解禁後の一番深い階でも安全な範囲 (値は出さない)
const deepest = depthLimit(() => true);
const before = depthLimit((k) => k !== "infiniteDeep");
assert(Number.isFinite(deepest) && deepest > before, "深部の上限は有限で、解禁前より深い");
const L = infLevel(deepest), top = lootBand(L)[1];
const gMax = Math.max(2, Math.ceil(top / 200) + 1);
for (const id of ids.filter((_, i) => i % 41 === 0)) {
  const it = at(id, gMax);
  for (const k of [...GEN_STAT_KEYS, "price", "equipPts"]) if (typeof it[k] === "number") assert(Number.isFinite(it[k]) && Math.abs(it[k]) < Number.MAX_SAFE_INTEGER, `${id} ${k}`);
  assert(Number.isSafeInteger(Math.round(it.price * 4 * 2)), `${id} 買値の桁`);
  assert(Number.isSafeInteger(equipLevelOf(it, gMax)), `${id} 装備Lv`);
}
for (const v of [refGold(L), refSoul(L), trainCost(L), lvPow(L)]) assert(Number.isFinite(v) && v < Number.MAX_SAFE_INTEGER);

// 9. 本編: 第1世代の帯の迷宮の上限は今まで通り。第2世代は台帳の深い迷宮から
const caps = WORLD.filter((d) => d.lootLv).map((d) => ({ id: d.id, cap: Math.ceil(d.lootLv[1] / 10) + 2 }));
assert(caps.some((c) => c.cap > 20), "本編でも第2世代が出る迷宮がある");
assert(caps.filter((c) => c.cap <= 20).length > caps.length / 2);

console.log(`装備の世代: ${ids.length}品 × 世代 ${checked}件 OK`);
