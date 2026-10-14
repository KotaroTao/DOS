// 第十章からの3倍強化を、全迷宮・全階と実際の敵の組み立てで確認する。
import assert from "node:assert/strict";
import { WORLD, wallAt, wallOf, wallStepOf, strengthAt, poolAt, PART2_LAYER } from "../../src/dungeons/world.js";
import { MONSTERS } from "../../src/sprites.js";
import { DUNGEON_MONSTERS } from "../../src/dungeons/index.js";
import { spawnEliteEnemies, spawnBossEnemies, spawnMimic, spawnRanked } from "../../src/combat.js";
Object.assign(MONSTERS, DUNGEON_MONSTERS);
const near = (a, b) => assert(Math.abs(a - b) < 1e-10 * Math.max(1, b), `${a} / ${b}`);
assert.equal(PART2_LAYER, 13);
for (let layer = 1; layer <= 25; layer++) {
  const oldWall = layer < 13 ? 1 : 2 * 1.4 ** (Math.min(20, layer) - 13);
  near(wallAt(layer), oldWall * (layer >= 12 ? 3 : 1));
}
assert.equal(wallStepOf({ layer: 11 }), 1);
assert.equal(wallStepOf({ layer: 12 }), 3);
assert.equal(wallStepOf({ layer: 13 }), 2);
assert.equal(wallStepOf({ layer: 14 }), 1.4);
assert.equal(wallStepOf({ layer: 12, wall: 1 }), 1);
assert.equal(wallOf(null), 1);
let floors = 0, foes = 0;
const checkSpawn = (spawn, oldScale, newScale, factor, label) => {
  const before = spawn(oldScale)[0], after = spawn(newScale)[0];
  for (const stat of ["maxhp", "hp", "atk", "vit"]) {
    assert(Math.abs(after[stat] - before[stat] * factor) <= (factor === 1 ? 0 : 2), `${label} ${stat}: ${before[stat]} → ${after[stat]}`);
  }
  assert.equal(after.agi, before.agi, `${label}: 素早さ`);
  foes++;
};
const eventKey = Object.keys(MONSTERS).find(k => MONSTERS[k].evOnly);
assert(eventKey);
for (const cfg of WORLD) for (let floor = 1; floor <= cfg.floors; floor++) {
  const factor = cfg.layer >= 12 ? 3 : 1;
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
console.log(`全${WORLD.length}迷宮・${floors}階・${foes}個体: 第九章以前は同じ、第十章以降は3倍、無限迷宮は倍率なし。第20層以降の上限と第二部の段も確認`);
