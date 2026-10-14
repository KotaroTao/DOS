// 第十章からの10倍強化を、全迷宮・全階と実際の敵の組み立てで確認する。
import assert from "node:assert/strict";
import { WORLD, wallAt, wallOf, wallStepOf, strengthAt, poolAt, PART2_LAYER, agiWallOf, strongHpWallOf, dungeonLevelRaw } from "../../src/dungeons/world.js";
import { MONSTERS } from "../../src/sprites.js";
import { DUNGEON_MONSTERS } from "../../src/dungeons/index.js";
import { spawnEliteEnemies, spawnBossEnemies, spawnMimic, spawnRanked, spawnMetal, scaleFoeAgi, scaleStrongFoeHp, Battle } from "../../src/combat.js";
import { fleeScaleOf, enemyBaseSample } from "../../src/enemylevel.js";
import { makeDoll } from "../../src/souls.js";
Object.assign(MONSTERS, DUNGEON_MONSTERS);
const near = (a, b) => assert(Math.abs(a - b) < 1e-10 * Math.max(1, b), `${a} / ${b}`);
assert.equal(PART2_LAYER, 13);
for (let layer = 1; layer <= 25; layer++) {
  const oldWall = layer < 13 ? 1 : 2 * 1.4 ** (Math.min(20, layer) - 13);
  near(wallAt(layer), oldWall * (layer >= 12 ? 10 : 1));
}
assert.equal(wallStepOf({ layer: 11 }), 1);
assert.equal(wallStepOf({ layer: 12 }), 10);
assert.equal(wallStepOf({ layer: 13 }), 2);
assert.equal(wallStepOf({ layer: 14 }), 1.4);
assert.equal(wallStepOf({ layer: 12, wall: 1 }), 1);
assert.equal(wallOf(null), 1);
assert.equal(agiWallOf(null), 1);
let floors = 0, foes = 0, agiWall = 1, strongHpWall = 1, fleeK = 1;
const checkSpawn = (spawn, oldScale, newScale, factor, label) => {
  const before = spawn(oldScale)[0], after = spawn(newScale)[0];
  for (const stat of ["maxhp", "hp", "atk", "vit"]) {
    assert(Math.abs(after[stat] - before[stat] * factor) <= (factor === 1 ? 0 : Math.ceil((factor + 1) / 2)), `${label} ${stat}: ${before[stat]} → ${after[stat]}`);
  }
  assert.equal(after.agi, before.agi, `${label}: 素早さ`);
  scaleFoeAgi(before, fleeK);
  scaleFoeAgi(after, fleeK, agiWall);
  near(after.agi, before.agi * agiWall);
  const hpFactor = after.boss || after.mon?.elite ? strongHpWall : 1;
  const oldHp = after.maxhp, oldAtk = after.atk, oldVit = after.vit, oldAgi = after.agi;
  scaleStrongFoeHp(after, strongHpWall);
  assert.equal(after.maxhp, oldHp * hpFactor);
  assert.equal(after.hp, oldHp * hpFactor);
  assert.equal(after.atk, oldAtk);
  assert.equal(after.vit, oldVit);
  assert.equal(after.agi, oldAgi);
  const saved = JSON.parse(JSON.stringify(after));
  scaleFoeAgi(saved, fleeK, agiWall);
  scaleStrongFoeHp(saved, strongHpWall);
  assert.equal(saved.maxhp, after.maxhp);
  assert.equal(saved.hp, after.hp);
  near(saved.agi, after.agi); // 保存・復元で重ねない
  foes++;
};
const eventKey = Object.keys(MONSTERS).find(k => MONSTERS[k].evOnly);
assert(eventKey);
for (const cfg of WORLD) for (let floor = 1; floor <= cfg.floors; floor++) {
  const factor = cfg.layer >= 12 ? 10 : 1;
  strongHpWall = strongHpWallOf(cfg);
  assert.equal(strongHpWall, cfg.layer >= 12 ? 10 : 1);
  assert.equal(strongHpWallOf({ ...cfg, wall: 1 }), 1);
  agiWall = agiWallOf(cfg);
  assert.equal(agiWall, cfg.layer >= 12 ? 3 : 1);
  assert.equal(agiWallOf({ ...cfg, wall: 1 }), 1);
  fleeK = fleeScaleOf(cfg, dungeonLevelRaw(cfg, floor));
  const oldWall = cfg.layer < 13 ? 1 : 2 * 1.4 ** (Math.min(20, cfg.layer) - 13);
  const oldScale = strengthAt({ ...cfg, wall: oldWall }, floor), newScale = strengthAt(cfg, floor);
  near(newScale, oldScale * factor);
  // 無限迷宮の wall:1 は、同じ顔ぶれとLvでも強化を受けない。
  near(strengthAt({ ...cfg, wall: 1 }, floor), oldScale / oldWall);
  const t = cfg.tune || {}, pool = poolAt(cfg, floor);
  const tune = (t.enemyMul || 1) * (floor > cfg.floors / 2 ? t.deepMul || 1 : 1);
  for (const key of pool) checkSpawn(s => spawnEliteEnemies(key, s * tune), oldScale, newScale, factor, cfg.id + ":" + key);
  for (const key of cfg.elites || []) checkSpawn(s => spawnEliteEnemies(key, s * (t.soloMul || 1)), oldScale, newScale, factor, key);
  if (floor === cfg.floors && cfg.boss) checkSpawn(s => spawnBossEnemies(cfg.boss, s * (cfg.bossScale || 1) * (t.bossMul || 1), cfg.bossRank), oldScale, newScale, factor, cfg.boss);
  const rank = Math.max(cfg.rank || 1, ...pool.map(k => MONSTERS[k].rank || 1));
  for (const master of [false, true]) checkSpawn(s => spawnMimic(rank, s * (t.soloMul || 1), master), oldScale, newScale, factor, "ミミック");
  checkSpawn(s => spawnRanked(eventKey, rank, 1, s * (t.soloMul || 1)), oldScale, newScale, factor, "出来事の魔物");
  floors++;
}
console.log(`全${WORLD.length}迷宮・${floors}階・${foes}個体: 第九章以前は同じ、第十章以降は10倍、無限迷宮は倍率なし。第20層以降の上限と第二部の段も確認`);

// 戦闘開始・召喚・金属の魔物・図鑑にも同じ素早さの壁が乗る。
const cfg = WORLD.find(c => c.layer === 12 && c.boss);
const callerKey = Object.keys(MONSTERS).find(k => MONSTERS[k].summonKey);
const caller = spawnEliteEnemies(callerKey, 1)[0];
const b = new Battle([makeDoll("検証の人業")], [caller], () => {}, { fleeK: 2, agiWall: agiWallOf(cfg) });
const expected = spawnEliteEnemies(caller.summonKey, 1)[0];
scaleFoeAgi(expected, 2, 3);
b._execInner({ actor: caller, action: "summon" });
assert.equal(b.enemies.length, 2);
near(b.enemies[1].agi, expected.agi);
const metalKey = Object.keys(MONSTERS).find(k => MONSTERS[k].metal);
const metal = spawnMetal(metalKey, { rank: 10, scale: 1, count: 1 })[0];
const oldAgi = metal.agi;
new Battle([], [metal], () => {}, { fleeK: 2, agiWall: 3 });
near(metal.agi, oldAgi * 3);
scaleFoeAgi(metal, 2, 3);
near(metal.agi, oldAgi * 3);
const boss = spawnBossEnemies(cfg.boss, strengthAt(cfg, cfg.floors) * (cfg.bossScale || 1) * (cfg.tune?.bossMul || 1), cfg.bossRank)[0];
scaleFoeAgi(boss, fleeScaleOf(cfg, dungeonLevelRaw(cfg, cfg.floors)), 3);
near(enemyBaseSample(cfg.boss).agi, boss.agi);
console.log("第十章以降の素早さ3倍・戦闘開始・召喚・金属・図鑑・保存復元を確認");

assert.equal(strongHpWallOf(null), 1);
const strong = spawnBossEnemies(cfg.boss, 1, cfg.bossRank)[0];
const baseHp = strong.maxhp;
strong.hp = Math.floor(baseHp / 2); // 古い戦闘は残りHPの割合を保つ
const remaining = strong.hp;
new Battle([], [strong], () => {}, { strongHpWall: strongHpWallOf(cfg) });
assert.equal(strong.maxhp, baseHp * 10);
assert.equal(strong.hp, remaining * 10);
scaleStrongFoeHp(strong, 10);
assert.equal(strong.hp, remaining * 10);
scaleStrongFoeHp(boss, 10);
near(enemyBaseSample(cfg.boss).hp, boss.maxhp);
// 呼ばれた通常の手下には追加HPを掛けず、強敵を呼んだ時は適用する。
b.strongHpWall = 10;
caller.summonKey = cfg.elites[0];
b._execInner({ actor: caller, action: "summon" });
const eliteHp = spawnEliteEnemies(cfg.elites[0], 1)[0].maxhp;
assert.equal(b.enemies.at(-1).maxhp, eliteHp * 10);
console.log("第十章以降の主・強敵だけHP追加10倍・他能力と通常敵の維持・図鑑・召喚・保存復元を確認");
