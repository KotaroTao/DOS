// 敵の強さの段 (第三章から本筋の迷宮ごとに少しずつ強くなり、第十章の入口で10倍) を、全迷宮・全階と実際の敵の組み立てで確認する。
import assert from "node:assert/strict";
import { WORLD, wallAt, wallOf, wallStepOf, strengthAt, poolAt, PART2_LAYER, RAMP_FROM_LAYER, WALL_FROM_LAYER, RAMP_JUMP, agiWallOf, strongHpWallOf, dungeonLevelRaw, dungeonProgressOf, dungeonStatMul, dungeonAgiMul } from "../../src/dungeons/world.js";
import { MONSTERS } from "../../src/sprites.js";
import { DUNGEON_MONSTERS } from "../../src/dungeons/index.js";
import { spawnEliteEnemies, spawnBossEnemies, spawnMimic, spawnRanked, spawnMetal, scaleFoeAgi, scaleStrongFoeHp, Battle } from "../../src/combat.js";
import { fleeScaleOf, enemyBaseSample } from "../../src/enemylevel.js";
import { makeDoll } from "../../src/souls.js";
Object.assign(MONSTERS, DUNGEON_MONSTERS);
const near = (a, b) => assert(Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(b)), `${a} / ${b}`);

// ---- 期待値をこのファイルの中で組み直す (world.js の実装をなぞらない) ----
assert.equal(PART2_LAYER, 13);
assert.equal(RAMP_FROM_LAYER, 5);
assert.equal(WALL_FROM_LAYER, 12);
const MAIN = WORLD.filter(d => !d.side && d.layer >= 5).sort((a, b) => a.layer - b.layer || a.lv - b.lv);
const LEN = MAIN.findIndex(d => d.layer >= 12);
assert.equal(MAIN[0].id, "w10", "段の始まりは第三章の最初の本筋");
assert.equal(MAIN[LEN].id, "w38", "第十章の入口は w38");
assert.equal(LEN, 28);
const stepOf = (cfg) => {
  const i = MAIN.findIndex(d => d.id === cfg.id);
  if (i >= 0) return i;
  if (!cfg.side) return 0;
  let s = 0;
  MAIN.forEach((d, j) => { if (d.lv <= cfg.lv) s = j; });
  return s;
};
assert.deepEqual(RAMP_JUMP, { id: "w14", stat: 2 }, "一段強くなるのは第四章の入口 (蘇生・HP1で踏みとどまる技を覚える頃)");
const JUMP = MAIN.findIndex(d => d.id === "w14");
assert.equal(JUMP, 4);
const ramp = (s, base, after = 1, jump = 1) => {
  const t = Math.min(s, LEN);
  return (base / jump) ** (t / LEN) * (t >= JUMP ? jump : 1) * after ** Math.max(0, s - LEN);
};
const partWall = (layer) => layer < 13 ? 1 : 2 * 1.4 ** (Math.min(20, layer) - 13);

for (let layer = 1; layer <= 25; layer++) near(wallAt(layer), partWall(layer));
assert.equal(wallStepOf({ layer: 11 }), 1);
assert.equal(wallStepOf({ layer: 12 }), 1);
assert.equal(wallStepOf({ layer: 13 }), 2);
assert.equal(wallStepOf({ layer: 14 }), 1.4);
assert.equal(wallStepOf({ layer: 13, wall: 1 }), 1);
assert.equal(wallOf(null), 1);
assert.equal(agiWallOf(null), 1);
assert.deepEqual(strongHpWallOf(null), { boss: 1, elite: 1 });

// ---- 段の値 ----
for (const cfg of WORLD) {
  const s = stepOf(cfg);
  assert.equal(dungeonProgressOf(cfg), s, cfg.id);
  near(wallOf(cfg), partWall(cfg.layer) * ramp(s, 10, 1.5, 2));
  near(agiWallOf(cfg), ramp(s, 3, 1.1));
  const hp = strongHpWallOf(cfg);
  near(hp.boss, ramp(s, 5));
  near(hp.elite, ramp(s, 3));
  // 無限迷宮 (wall:1) は段を受けない
  assert.equal(dungeonProgressOf({ ...cfg, wall: 1 }), 0);
  assert.equal(agiWallOf({ ...cfg, wall: 1 }), 1);
  assert.deepEqual(strongHpWallOf({ ...cfg, wall: 1 }), { boss: 1, elite: 1 });
  // 第一章・第二章の本筋 (と、それより前の推奨Lvの寄り道) は従来のまま
  if (cfg.layer < 5 && !cfg.side) assert.equal(wallOf(cfg), 1, cfg.id);
  if (cfg.side && cfg.lv < MAIN[0].lv) assert.equal(wallOf(cfg), 1, cfg.id);
}
const at = (id) => WORLD.find(d => d.id === id);
assert.equal(wallOf(at("w09")), 1);
assert.equal(wallOf(at("w10")), 1);
near(wallOf(at("w13")), 5 ** (3 / 28));
near(wallOf(at("w14")), 2 * 5 ** (4 / 28));
near(wallOf(at("w38")), 10);
near(agiWallOf(at("w38")), 3);
assert.deepEqual(strongHpWallOf(at("w38")), { boss: 5, elite: 3 });
near(wallOf(at("w41")), 10 * 1.5 ** 3);
near(agiWallOf(at("w41")), 3 * 1.1 ** 3);
assert.deepEqual(strongHpWallOf(at("w41")), { boss: 5, elite: 3 });
for (const [id, main] of [["ws20", "w38"], ["ws22", "w39"], ["ws21", "w41"], ["ws7", "w18"], ["ws13", "w35"], ["ws5", "w15"], ["ws4", "w10"], ["ws3", "w01"], ["ws6", "w01"]]) {
  assert.equal(dungeonProgressOf(at(id)), Math.max(0, MAIN.findIndex(d => d.id === main)), id);
}
for (let i = 1; i < MAIN.length; i++) {
  const r = dungeonStatMul(MAIN[i]) / dungeonStatMul(MAIN[i - 1]), a = dungeonAgiMul(MAIN[i]) / dungeonAgiMul(MAIN[i - 1]);
  near(r, i > LEN ? 1.5 : i === JUMP ? 2 * 5 ** (1 / LEN) : 5 ** (1 / LEN));
  near(a, i <= LEN ? 3 ** (1 / LEN) : 1.1);
}
console.log(`段: 第三章 w10 から本筋${LEN}迷宮で第十章の入口 w38 に ×10 (1迷宮 ×${(5 ** (1 / LEN)).toFixed(4)}・第四章の入口 w14 で ×2・素早さ ×${(3 ** (1 / LEN)).toFixed(4)})、以降 ×1.5 / ×1.1。寄り道は推奨Lvの届く本筋の段。無限迷宮は段なし`);

// ---- 実際の敵の組み立て (全迷宮・全階) ----
let floors = 0, foes = 0;
const checkSpawn = (spawn, oldScale, newScale, factor, agiWall, hpWall, fleeK, label) => {
  const before = spawn(oldScale)[0], after = spawn(newScale)[0];
  for (const stat of ["maxhp", "hp", "atk", "vit"]) {
    assert(Math.abs(after[stat] - before[stat] * factor) <= Math.ceil((factor + 1) / 2), `${label} ${stat}: ${before[stat]} → ${after[stat]} (×${factor})`);
  }
  assert.equal(after.agi, before.agi, `${label}: 素早さ`);
  scaleFoeAgi(before, fleeK);
  scaleFoeAgi(after, fleeK, agiWall);
  near(after.agi, before.agi * agiWall);
  const k = after.boss ? hpWall.boss : after.mon?.elite ? hpWall.elite : 1;
  const oldHp = after.maxhp, oldAtk = after.atk, oldVit = after.vit, oldAgi = after.agi;
  scaleStrongFoeHp(after, hpWall);
  assert.equal(after.maxhp, Math.max(1, Math.round(oldHp * k)), label);
  assert.equal(after.atk, oldAtk);
  assert.equal(after.vit, oldVit);
  assert.equal(after.agi, oldAgi);
  const saved = JSON.parse(JSON.stringify(after));
  scaleFoeAgi(saved, fleeK, agiWall);
  scaleStrongFoeHp(saved, hpWall);
  assert.equal(saved.maxhp, after.maxhp); // 保存・復元で重ねない
  near(saved.agi, after.agi);
  foes++;
};
const eventKey = Object.keys(MONSTERS).find(k => MONSTERS[k].evOnly);
assert(eventKey);
for (const cfg of WORLD) for (let floor = 1; floor <= cfg.floors; floor++) {
  const factor = wallOf(cfg), agiWall = agiWallOf(cfg), hpWall = strongHpWallOf(cfg);
  const fleeK = fleeScaleOf(cfg, dungeonLevelRaw(cfg, floor));
  const oldScale = strengthAt({ ...cfg, wall: 1 }, floor), newScale = strengthAt(cfg, floor);
  near(newScale, oldScale * factor);
  const t = cfg.tune || {}, pool = poolAt(cfg, floor);
  const tune = (t.enemyMul || 1) * (floor > cfg.floors / 2 ? t.deepMul || 1 : 1);
  const C = (spawn, label) => checkSpawn(spawn, oldScale, newScale, factor, agiWall, hpWall, fleeK, label);
  for (const key of pool) C(s => spawnEliteEnemies(key, s * tune), cfg.id + ":" + key);
  for (const key of cfg.elites || []) C(s => spawnEliteEnemies(key, s * (t.soloMul || 1)), key);
  if (floor === cfg.floors && cfg.boss) C(s => spawnBossEnemies(cfg.boss, s * (cfg.bossScale || 1) * (t.bossMul || 1), cfg.bossRank), cfg.boss);
  const rank = Math.max(cfg.rank || 1, ...pool.map(k => MONSTERS[k].rank || 1));
  for (const master of [false, true]) C(s => spawnMimic(rank, s * (t.soloMul || 1), master), "ミミック");
  C(s => spawnRanked(eventKey, rank, 1, s * (t.soloMul || 1)), "出来事の魔物");
  floors++;
}
console.log(`全${WORLD.length}迷宮・${floors}階・${foes}個体: 段のとおりの HP・攻撃・防御・素早さ、主・強敵だけHPの追加、保存・復元で重ねない`);

// ---- 戦闘開始・召喚・金属・図鑑 ----
const cfg = WORLD.find(c => c.layer === 12 && c.boss);
const callerKey = Object.keys(MONSTERS).find(k => MONSTERS[k].summonKey);
const caller = spawnEliteEnemies(callerKey, 1)[0];
const b = new Battle([makeDoll("検証の人業")], [caller], () => {}, { fleeK: 2, agiWall: agiWallOf(cfg), strongHpWall: strongHpWallOf(cfg) });
const expected = spawnEliteEnemies(caller.summonKey, 1)[0];
scaleFoeAgi(expected, 2, agiWallOf(cfg));
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
scaleFoeAgi(boss, fleeScaleOf(cfg, dungeonLevelRaw(cfg, cfg.floors)), agiWallOf(cfg));
near(enemyBaseSample(cfg.boss).agi, boss.agi);
scaleStrongFoeHp(boss, strongHpWallOf(cfg));
near(enemyBaseSample(cfg.boss).hp, boss.maxhp);
// 主のHPは ×5、旧い保存の戦闘 (数1つ) もそのまま読め、二重に掛けない
const strong = spawnBossEnemies(cfg.boss, 1, cfg.bossRank)[0];
const baseHp = strong.maxhp;
new Battle([], [strong], () => {}, { strongHpWall: strongHpWallOf(cfg) });
assert.equal(strong.maxhp, baseHp * 5);
scaleStrongFoeHp(strong, 10);
assert.equal(strong.maxhp, baseHp * 5);
const legacy = spawnBossEnemies(cfg.boss, 1, cfg.bossRank)[0];
scaleStrongFoeHp(legacy, 10);
assert.equal(legacy.maxhp, baseHp * 10);
// 呼ばれた通常の手下には追加HPを掛けず、強敵を呼んだ時は ×3
caller.summonKey = cfg.elites[0];
b._execInner({ actor: caller, action: "summon" });
const eliteHp = spawnEliteEnemies(cfg.elites[0], 1)[0].maxhp;
assert.equal(b.enemies.at(-1).maxhp, eliteHp * 3);
console.log("戦闘開始・召喚 (手下は追加なし・強敵は×3)・金属・図鑑・旧い保存の戦闘を確認");
