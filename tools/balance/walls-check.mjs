// 敵の強さの段 (第三章から本筋の迷宮ごとに少しずつ強くなり、第十章の入口で10倍) を、全迷宮・全階と実際の敵の組み立てで確認する。
import assert from "node:assert/strict";
import { WORLD, wallAt, wallOf, wallStepOf, strengthAt, poolAt, PART2_LAYER, RAMP_FROM_LAYER, WALL_FROM_LAYER, RAMP_JUMP, STAT_SPLIT, agiWallOf, strongHpWallOf, statWallOf, dungeonLevelRaw, dungeonProgressOf, dungeonStatMul, dungeonAgiMul } from "../../src/dungeons/world.js";
import { MONSTERS } from "../../src/sprites.js";
import { DUNGEON_MONSTERS } from "../../src/dungeons/index.js";
import { spawnEliteEnemies, spawnBossEnemies, spawnMimic, spawnRanked, spawnMetal, scaleFoeAgi, scaleStrongFoeHp, scaleFoeStats, Battle } from "../../src/combat.js";
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
  // 第一部の寄り道は、推奨Lv が第二部の本筋を越えても第二部の段を受けない (ws21 は w41 の段)。第二部の寄り道は自分の層の本筋まで (ws24 は w45 の段)
  MAIN.forEach((d, j) => { if (d.lv <= cfg.lv && (cfg.layer >= 13 ? d.layer <= cfg.layer : d.layer < 13)) s = j; });
  return s;
};
assert.deepEqual(RAMP_JUMP, { id: "w14", stat: 2, boss: 2, elite: 1 }, "一段強くなるのは第四章の入口 (蘇生・HP1で踏みとどまる技を覚える頃)。主のHPも同じく。強敵のHPの追加は無し (2026-10-16)");
assert.deepEqual(STAT_SPLIT, { atk: 1 / 3, hp: 1.3 }, "能力ごとの段: 攻撃は軽く、HP は重く (VIT・HP が効くように)");
const JUMP = MAIN.findIndex(d => d.id === "w14");
assert.equal(JUMP, 4);
// 第一部の最後の本筋 (いまは w41)。その先は第二部の迷宮ごとの伸び
const P1END = MAIN.reduce((last, d, i) => (d.layer < 13 ? i : last), LEN);
assert.equal(MAIN[P1END].id, "w41");
const ramp = (s, base, after = 1, jump = 1, part2 = 1) => {
  const t = Math.min(s, LEN);
  return (base / jump) ** (t / LEN) * (t >= JUMP ? jump : 1) * after ** Math.max(0, Math.min(s, P1END) - LEN) * part2 ** Math.max(0, s - P1END);
};
// 第二部の層の段: 第13層 ×1.25、その先 ×1.2 (第13層の入口 ≈ w41 の1.33倍 ≈ 45倍)
const partWall = (layer) => layer < 13 ? 1 : 1.25 * 1.2 ** (Math.min(20, layer) - 13);

for (let layer = 1; layer <= 25; layer++) near(wallAt(layer), partWall(layer));
assert.equal(wallStepOf({ layer: 11 }), 1);
assert.equal(wallStepOf({ layer: 12 }), 1);
assert.equal(wallStepOf({ layer: 13 }), 1.25);
assert.equal(wallStepOf({ layer: 14 }), 1.2);
near(wallAt(13) * 10 * 1.5 ** 3 * 1.07, 45.140625); // 第13層の入口の見込み (w41 の次の本筋)
assert.equal(wallStepOf({ layer: 13, wall: 1 }), 1);
assert.equal(wallOf(null), 1);
assert.equal(agiWallOf(null), 1);
assert.deepEqual(strongHpWallOf(null), { boss: 1, elite: 1 });

// ---- 段の値 ----
for (const cfg of WORLD) {
  const s = stepOf(cfg);
  assert.equal(dungeonProgressOf(cfg), s, cfg.id);
  near(wallOf(cfg), partWall(cfg.layer) * ramp(s, 10, 1.5, 2, 1.07));
  near(agiWallOf(cfg), ramp(s, 3, 1.1, 1, 1.03));
  // 能力ごとの段: 攻撃は W^(1/3)、HP は W^1.3 (防御は W のまま)
  const W = wallOf(cfg), sw = statWallOf(cfg);
  if (W > 1) { near(sw.atk, W ** (1 / 3 - 1)); near(sw.hp, W ** 0.3); } else assert.deepEqual(sw, { atk: 1, hp: 1 }, cfg.id);
  assert.deepEqual(statWallOf({ ...cfg, wall: 1 }), { atk: 1, hp: 1 });
  const hp = strongHpWallOf(cfg);
  near(hp.boss, ramp(s, 5, 1, 2));
  assert.equal(hp.elite, 1, cfg.id); // 強敵のHPの追加は無し (雑魚と同じ体の段だけ)
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
near(strongHpWallOf(at("w13")).boss, 2.5 ** (3 / 28));
near(strongHpWallOf(at("w14")).boss, 2 * 2.5 ** (4 / 28));
assert.equal(strongHpWallOf(at("w14")).elite, 1);
near(wallOf(at("w38")), 10);
near(agiWallOf(at("w38")), 3);
assert.deepEqual(strongHpWallOf(at("w38")), { boss: 5, elite: 1 });
near(wallOf(at("w41")), 10 * 1.5 ** 3);
near(agiWallOf(at("w41")), 3 * 1.1 ** 3);
assert.deepEqual(strongHpWallOf(at("w41")), { boss: 5, elite: 1 });
for (const [id, main] of [["ws20", "w38"], ["ws22", "w39"], ["ws21", "w41"], ["ws23", "w42"], ["ws24", "w45"], ["ws25", "w48"], ["ws26", "w46"], ["ws27", "w47"], ["ws7", "w18"], ["ws13", "w35"], ["ws5", "w15"], ["ws4", "w10"], ["ws3", "w01"], ["ws6", "w01"]]) {
  assert.equal(dungeonProgressOf(at(id)), Math.max(0, MAIN.findIndex(d => d.id === main)), id);
}
for (let i = 1; i < MAIN.length; i++) {
  const r = dungeonStatMul(MAIN[i]) / dungeonStatMul(MAIN[i - 1]), a = dungeonAgiMul(MAIN[i]) / dungeonAgiMul(MAIN[i - 1]);
  const p2 = MAIN[i].layer >= 13; // 第二部の本筋は ×1.07 / ×1.03
  near(r, p2 ? 1.07 : i > LEN ? 1.5 : i === JUMP ? 2 * 5 ** (1 / LEN) : 5 ** (1 / LEN));
  near(a, p2 ? 1.03 : i <= LEN ? 3 ** (1 / LEN) : 1.1);
}
console.log(`段: 第三章 w10 から本筋${LEN}迷宮で第十章の入口 w38 に ×10 (1迷宮 ×${(5 ** (1 / LEN)).toFixed(4)}・第四章の入口 w14 で ×2・素早さ ×${(3 ** (1 / LEN)).toFixed(4)})、第十章の中は ×1.5 / ×1.1、第二部は ×1.07 / ×1.03 と層の段 ×1.25・×1.2。能力ごとに 攻撃 W^(1/3)・HP W^1.3・防御 W。寄り道は推奨Lvの届く本筋の段。無限迷宮は段なし`);

// ---- 実際の敵の組み立て (全迷宮・全階) ----
let floors = 0, foes = 0;
const checkSpawn = (spawn, oldScale, newScale, factor, agiWall, hpWall, statWall, fleeK, label) => {
  const before = spawn(oldScale)[0], after = spawn(newScale)[0];
  for (const stat of ["maxhp", "hp", "atk", "vit"]) {
    assert(Math.abs(after[stat] - before[stat] * factor) <= Math.ceil((factor + 1) / 2), `${label} ${stat}: ${before[stat]} → ${after[stat]} (×${factor})`);
  }
  assert.equal(after.agi, before.agi, `${label}: 素早さ`);
  scaleFoeAgi(before, fleeK);
  scaleFoeAgi(after, fleeK, agiWall);
  near(after.agi, before.agi * agiWall);
  // 能力ごとの段: 攻撃は ×statWall.atk、HP は ×statWall.hp (金属は HP を直さない)、防御はそのまま
  const h0 = after.maxhp, a0 = after.atk, v0 = after.vit;
  scaleFoeStats(after, statWall);
  assert.equal(after.atk, statWall.atk === 1 ? a0 : Math.max(1, Math.round(a0 * statWall.atk)), label);
  assert.equal(after.maxhp, statWall.hp === 1 || after.metal ? h0 : Math.max(1, Math.round(h0 * statWall.hp)), label);
  assert.equal(after.vit, v0, label);
  // 段のない個体と比べた最終の倍率: 攻撃 ≈ W^(1/3)、HP ≈ W^1.3 (丸めの分だけずれる)
  if (factor > 1 && before.atk >= 50) assert(Math.abs(after.atk / before.atk / factor ** (1 / 3) - 1) < 0.05, `${label} 攻撃の段`);
  if (factor > 1 && before.maxhp >= 50 && !after.metal) assert(Math.abs(after.maxhp / before.maxhp / factor ** 1.3 - 1) < 0.05, `${label} HPの段`);
  const k = after.boss ? hpWall.boss : after.mon?.elite ? hpWall.elite : 1;
  const oldHp = after.maxhp, oldAtk = after.atk, oldVit = after.vit, oldAgi = after.agi;
  scaleStrongFoeHp(after, hpWall);
  assert.equal(after.maxhp, Math.max(1, Math.round(oldHp * k)), label);
  assert.equal(after.atk, oldAtk);
  assert.equal(after.vit, oldVit);
  assert.equal(after.agi, oldAgi);
  const saved = JSON.parse(JSON.stringify(after));
  scaleFoeAgi(saved, fleeK, agiWall);
  scaleFoeStats(saved, statWall);
  scaleStrongFoeHp(saved, hpWall);
  assert.equal(saved.atk, after.atk);
  assert.equal(saved.maxhp, after.maxhp); // 保存・復元で重ねない
  near(saved.agi, after.agi);
  foes++;
};
const eventKey = Object.keys(MONSTERS).find(k => MONSTERS[k].evOnly);
assert(eventKey);
for (const cfg of WORLD) for (let floor = 1; floor <= cfg.floors; floor++) {
  const factor = wallOf(cfg), agiWall = agiWallOf(cfg), hpWall = strongHpWallOf(cfg), statWall = statWallOf(cfg);
  const fleeK = fleeScaleOf(cfg, dungeonLevelRaw(cfg, floor));
  const oldScale = strengthAt({ ...cfg, wall: 1 }, floor), newScale = strengthAt(cfg, floor);
  near(newScale, oldScale * factor);
  const t = cfg.tune || {}, pool = poolAt(cfg, floor);
  const tune = (t.enemyMul || 1) * (floor > cfg.floors / 2 ? t.deepMul || 1 : 1);
  const C = (spawn, label) => checkSpawn(spawn, oldScale, newScale, factor, agiWall, hpWall, statWall, fleeK, label);
  for (const key of pool) C(s => spawnEliteEnemies(key, s * tune), cfg.id + ":" + key);
  for (const key of cfg.elites || []) C(s => spawnEliteEnemies(key, s * (t.soloMul || 1)), key);
  if (floor === cfg.floors && cfg.boss) C(s => spawnBossEnemies(cfg.boss, s * (cfg.bossScale || 1) * (t.bossMul || 1), cfg.bossRank), cfg.boss);
  const rank = Math.max(cfg.rank || 1, ...pool.map(k => MONSTERS[k].rank || 1));
  for (const master of [false, true]) C(s => spawnMimic(rank, s * (t.soloMul || 1), master), "ミミック");
  C(s => spawnRanked(eventKey, rank, 1, s * (t.soloMul || 1)), "出来事の魔物");
  floors++;
}
console.log(`全${WORLD.length}迷宮・${floors}階・${foes}個体: 段のとおりの HP (W^1.3)・攻撃 (W^(1/3))・防御 (W)・素早さ、主だけHPの追加、保存・復元で重ねない`);

// ---- 戦闘開始・召喚・金属・図鑑 ----
const cfg = WORLD.find(c => c.layer === 12 && c.boss);
const callerKey = Object.keys(MONSTERS).find(k => MONSTERS[k].summonKey);
const caller = spawnEliteEnemies(callerKey, 1)[0];
const b = new Battle([makeDoll("検証の人業")], [caller], () => {}, { fleeK: 2, agiWall: agiWallOf(cfg), statWall: statWallOf(cfg), strongHpWall: strongHpWallOf(cfg) });
const expected = spawnEliteEnemies(caller.summonKey, 1)[0];
scaleFoeAgi(expected, 2, agiWallOf(cfg));
scaleFoeStats(expected, statWallOf(cfg));
b._execInner({ actor: caller, action: "summon" });
assert.equal(b.enemies.length, 2);
near(b.enemies[1].agi, expected.agi);
assert.equal(b.enemies[1].atk, expected.atk); // 呼ばれた手下も能力ごとの段
assert.equal(b.enemies[1].maxhp, expected.maxhp);
const metalKey = Object.keys(MONSTERS).find(k => MONSTERS[k].metal);
const metal = spawnMetal(metalKey, { rank: 10, scale: 1, count: 1 })[0];
const oldAgi = metal.agi;
const metalHp = metal.maxhp;
new Battle([], [metal], () => {}, { fleeK: 2, agiWall: 3, statWall: statWallOf(cfg) });
near(metal.agi, oldAgi * 3);
assert.equal(metal.maxhp, metalHp); // 金属の HP (会心で削る数) は直さない
scaleFoeAgi(metal, 2, 3);
near(metal.agi, oldAgi * 3);
const boss = spawnBossEnemies(cfg.boss, strengthAt(cfg, cfg.floors) * (cfg.bossScale || 1) * (cfg.tune?.bossMul || 1), cfg.bossRank)[0];
scaleFoeAgi(boss, fleeScaleOf(cfg, dungeonLevelRaw(cfg, cfg.floors)), agiWallOf(cfg));
near(enemyBaseSample(cfg.boss).agi, boss.agi);
scaleFoeStats(boss, statWallOf(cfg));
near(enemyBaseSample(cfg.boss).atk, boss.atk);
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
// 呼ばれた通常の手下にも、呼ばれた強敵にも追加HPは掛けない (強敵のHPの追加は無し)
caller.summonKey = cfg.elites[0];
b._execInner({ actor: caller, action: "summon" });
const eliteHp = scaleFoeStats(spawnEliteEnemies(cfg.elites[0], 1)[0], statWallOf(cfg)).maxhp;
assert.equal(b.enemies.at(-1).maxhp, eliteHp);
console.log("戦闘開始・召喚 (手下・強敵とも追加なし、能力ごとの段も)・金属 (HPは直さない)・図鑑・旧い保存の戦闘を確認");
