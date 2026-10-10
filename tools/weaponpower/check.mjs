// 全武器の参照能力、戦闘・比較・品質・＋Nの段・旧セーブ更新を確認する。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { ITEMS, recalc, attackPower, applyForge, hasQuality, applyQuality, itemAtQuality, QUALITY_MID } from "../../src/items.js";
import { CATALOG_ITEMS } from "../../src/catalog/index.js";
import { WEAPON_PROFILES, prepareWeapon } from "../../src/weaponpower.js";
import { Battle, spawnRanked, SPELLS } from "../../src/combat.js";
import { previewStats, statsDelta, planBestEquip } from "../../src/autoequip.js";
import { statLines, specialLines, weaponPowerPreview, gearScore } from "../../src/ui/itemview.js";
import { equipPrice } from "../../src/pricing.js";
import { SOUL_CLASSES, makeDoll, makeSoulInstance, setSharedSouls, recalcDoll } from "../../src/souls.js";
import { decideAuto, TACTICS } from "../../src/autotactics.js";
import { MONSTERS } from "../../src/sprites.js";
import { DUNGEON_MONSTERS } from "../../src/dungeons/index.js";
Object.assign(MONSTERS, DUNGEON_MONSTERS);
Object.assign(ITEMS, CATALOG_ITEMS);
const weapons = Object.values(ITEMS).filter(it => it.slot === "weapon");
const base = { hp: 10000, mp: 10000, atk: 101, vit: 50, agi: 157, int: 211, pie: 263, luk: 20 };
const actor = weapon => { const a = { base, equip: { weapon }, hp: 10000, mp: 10000, alive: true, name: "検証" }; recalc(a); return a; };
const profiles = {};
for (const w of weapons) {
  assert(WEAPON_PROFILES[w.weaponProfile], w.id);
  assert(!w.atk, "武器の旧威力をSTRに加算しない: " + w.id);
  assert(Object.keys(w.scale).length >= 1 && Object.keys(w.scale).length <= 2, w.id);
  assert(Object.values(w.scale).every(v => Number.isFinite(v) && v > 0), w.id);
  const a = actor(w), power = attackPower(a);
  const b = new Battle([a], [], () => {});
  assert.equal(b._eatk(a), power, "表示と戦闘: " + w.id);
  assert.equal(previewStats(a, a.equip).power, power, "装備比較: " + w.id);
  const unreferenced = ["atk", "agi", "int", "pie"].find(k => !w.scale[k]);
  const changed = { ...a, [unreferenced]: a[unreferenced] + 1000 };
  assert.equal(attackPower(changed), power, "非参照能力を加算しない: " + w.id);
  for (const k of Object.keys(w.scale)) {
    a.buffs = { [k]: 1.5 };
    assert(b._eatk(a) > power, "参照能力の強化: " + w.id);
    a.buffs = { [k]: 0.5 };
    assert(b._eatk(a) < power, "参照能力の弱体: " + w.id);
  }
  assert(statLines(w).includes("参照"), w.id);
  assert(!specialLines(w).some(s => s.includes("攻撃力 =")), "特殊効果に計算式を入れない: " + w.id);
  assert.equal(weaponPowerPreview(w, a).power, power, "攻撃性能欄の最終値: " + w.id);
  if (w.price !== 0) assert(equipPrice(w) > 0, w.id);
  const forged = applyForge({ ...w, forge: 2 });
  assert(attackPower(actor(forged)) > power, "＋N の段: " + w.id);
  // 品質: 100 は並品より強く、0 は弱い (±20%)。目録の品は変えない
  const hi = itemAtQuality(w, 100), lo = itemAtQuality(w, 0);
  assert(attackPower(actor(hi)) >= power && attackPower(actor(lo)) <= power, "品質: " + w.id);
  assert(Object.values(hi.scale).every((v, i) => Math.abs(v - Object.values(w.scale)[i] * 1.2) < 0.001), "品質100 = 係数×1.2: " + w.id);
  const unchanged = JSON.stringify(w); prepareWeapon(w); assert.equal(JSON.stringify(w), unchanged);
  profiles[w.weaponProfile] = (profiles[w.weaponProfile] || 0) + 1;
}
assert.equal(attackPower(actor(null)), base.atk, "素手はSTR");
// 両手への持ち替えは盾の能力を外して算出し、表示のために装備実体を変えない。
const previewOwner = actor(ITEMS.shortSword);
previewOwner.equip.shield = { slot: "shield", int: 500, agi: 500 }; recalc(previewOwner);
const twoHanded = weapons.find(w => w.twoHanded && w.cat === "bw");
assert.equal(weaponPowerPreview(twoHanded, previewOwner).power, previewStats(previewOwner, { weapon: twoHanded }).power);
assert(previewOwner.equip.shield && previewOwner.equip.weapon === ITEMS.shortSword);
assert.equal(weaponPowerPreview({ ...twoHanded, unidentified: true }, previewOwner), null);
previewOwner.equip.shield.cursed = true;
assert.equal(weaponPowerPreview(twoHanded, previewOwner), null, "外せない盾がある時は装備後の値を表示しない");
for (const cat of ["ls", "dg", "kt", "ax", "mc", "sp", "bw", "st"]) assert(weapons.some(w => w.cat === cat));
for (const key of Object.keys(WEAPON_PROFILES)) assert(profiles[key], "未使用の参照タイプ: " + key);
// 同じ用途なら品質が高い武器ほど係数が高くなる（レベルによる逆転がない）。
for (const key of Object.keys(profiles)) {
  const list = weapons.filter(w => w.weaponProfile === key).sort((a, b) => a.weaponRating - b.weaponRating);
  for (let i = 1; i < list.length; i++) assert(Object.values(list[i].scale).reduce((a, b) => a + b, 0) + .002 >= Object.values(list[i - 1].scale).reduce((a, b) => a + b, 0));
}
// AGIが高い弓使いは、同じ品質でもSTR武器より弓を選ぶ。
const archer = actor(null); archer.base = { ...base, atk: 10, agi: 500 }; recalc(archer);
const bow = weapons.find(w => w.cat === "bw"), sword = ITEMS.shortSword;
assert(previewStats(archer, { weapon: bow }).power > previewStats(archer, { weapon: sword }).power);
assert(gearScore(archer, statsDelta(previewStats(archer, { weapon: sword }), previewStats(archer, { weapon: bow }))) > 0);
const plan = planBestEquip([{ ...archer, items: [bow, sword] }]);
assert(plan.moves.some(m => m.item === bow), "最適装備が弓を選ぶ");
// オートは弓使いへのSTR強化を攻撃力向上と見なさず、AGI強化を評価する。
SPELLS.CHECK_STR = { name: "検証STR", kind: "buff", mp: 0, buff: { atk: 1.5 }, dur: 3, target: "self" };
SPELLS.CHECK_AGI = { name: "検証AGI", kind: "buff", mp: 0, buff: { agi: 1.5 }, dur: 3, target: "self" };
archer.equip.weapon = bow; recalc(archer); archer.spells = ["CHECK_STR", "CHECK_AGI"]; archer.tactic = "all";
const buffBattle = new Battle([archer], spawnRanked("bs_ghoul", 8), () => {}), candidates = [];
decideAuto(buffBattle, archer, candidates);
assert.equal(candidates.find(c => c.spellKey === "CHECK_STR").edge, 0);
assert(candidates.find(c => c.spellKey === "CHECK_AGI").edge > 0);
delete SPELLS.CHECK_STR; delete SPELLS.CHECK_AGI;
// 実際のロード用関数を使い、古いSTR/scaleを消して新しい係数を復元する。
const source = readFileSync(new URL("../../src/game.js", import.meta.url), "utf8");
const refreshSource = source.slice(source.indexOf("const ITEM_STAT_KEYS ="), source.indexOf("// 片手/両手と盾のジャンルを入れた後"));
const template = ITEMS.w_shepherd_staff;
const legacy = { ...template, atk: 999, scale: { atk: .4 }, unidentified: true, forge: 2 };
const cursed = { ...ITEMS.cursedBlade, scale: { atk: .1 } };
const fine = { ...template, q: 100 }; applyQuality(fine);
const d = { items: [legacy, cursed, fine], equip: { weapon: legacy } };
const context = vm.createContext({ ITEMS, G: { party: [d], reserve: [] }, applyForge, hasQuality, applyQuality, QUALITY_MID });
vm.runInContext(refreshSource + "\nreflattenItemStats();", context);
assert(!legacy.atk); assert(legacy.scale.pie > template.scale.pie); assert(!legacy.scale.atk);
assert(legacy.unidentified && legacy.forge === 2);
assert(cursed.cursed && cursed.scale.agi, "呪いの武器も新参照へ更新");
assert.equal(d.items[0], d.equip.weapon, "所持品の共有参照を保つ");
assert.equal(legacy.q, QUALITY_MID, "品質を入れる前の品は並品 (50)");
assert.equal(fine.q, 100); assert(Math.abs(fine.scale.pie - template.scale.pie * 1.2) < 0.001, "読み込みで品質を一度だけ掛け直す");
vm.runInContext("reflattenItemStats();", context);
assert(Math.abs(fine.scale.pie - template.scale.pie * 1.2) < 0.001, "二度読み込んでも品質は重ならない");
// 全36職×5作戦で新武器を装備し、乱戦の判断と実行が成立することを確認。
let simulations = 0;
for (const job of Object.keys(SOUL_CLASSES)) for (const tactic of TACTICS) {
  const soul = makeSoulInstance(job, 10000, 80); setSharedSouls([soul]);
  const a = makeDoll("検証"); a.primary = soul.uid; a.tactic = tactic.key; recalcDoll(a);
  const w = weapons.find(w => w.forJob === job) || weapons.find(w => !w.classes && w.cat === "ls");
  a.equip.weapon = w; recalcDoll(a); a.hp = a.maxhp; a.mp = a.maxmp;
  const enemies = Array.from({ length: 3 }, () => spawnRanked("bs_ghoul", 8, 0, 1, 1)[0]);
  const b = new Battle([a], enemies, () => {});
  for (let turn = 0; turn < 5 && a.alive && enemies.some(e => e.alive); turn++) {
    const cmd = decideAuto(b, a); assert(cmd, job + ": " + tactic.key);
    const result = b._exec({ ...cmd, actor: a }); assert(!result.invalid, job);
    for (const hit of result.hits) if (hit.dmg != null) assert(Number.isFinite(hit.dmg), job);
    for (const e of enemies.filter(e => e.alive)) b._exec({ actor: e, action: "attack", target: a });
    assert(Number.isFinite(a.hp) && Number.isFinite(a.mp), job);
  }
  simulations++;
}
console.log(`全${weapons.length}武器: 参照・バフ・比較・品質・＋Nの段・旧セーブ更新 OK`);
console.log(profiles);
console.log(`${simulations}条件の模擬戦 OK`);
