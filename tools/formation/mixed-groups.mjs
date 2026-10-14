// 通常の混成群れを、全迷宮の出現表と固定した種で確かめる。
import assert from "node:assert/strict";
import { MONSTERS } from "../../src/sprites.js";
import { DUNGEON_MONSTERS, DUNGEONS } from "../../src/dungeons/index.js";
import { poolAt } from "../../src/dungeons/world.js";
import { spawnCardEnemies, spawnEliteEnemies, MAX_ENEMIES } from "../../src/combat.js";
import { reseedRng, rngState } from "../../src/rng.js";

Object.assign(MONSTERS, DUNGEON_MONSTERS);
const ordinary = (k) => {
  const m = MONSTERS[k];
  return m && !m.boss && !m.elite && !m.metal && !m.evOnly && !m.role;
};
function verify(foes, key, pool) {
  assert(foes.length >= 1 && foes.length <= MAX_ENEMIES);
  assert.equal(new Set(foes.map(e => e.uid)).size, foes.length);
  if (MONSTERS[key].pack) assert(foes.length >= 3);
  const role = MONSTERS[key].role && MONSTERS[key].escort;
  if (!role) assert.equal(foes[0].key, key, "札の魔物を先頭に残す");
  for (const e of foes) {
    assert(e.key === key || (role ? e.key === role : pool.includes(e.key) && ordinary(e.key)), "その階の通常の敵だけを混ぜる");
    const same = foes.filter(f => f.key === e.key);
    const suffix = same.length > 1 ? String.fromCharCode(65 + same.indexOf(e)) : "";
    assert.equal(e.name, MONSTERS[e.key].name + suffix, "同種だけにA/Bを付ける");
    const ref = spawnEliteEnemies(e.key, 1.7)[0];
    for (const k of ["hp", "maxhp", "atk", "vit", "agi", "gold", "soul"]) assert.equal(e[k], ref[k], `強さと戦果: ${k}`);
  }
  if (role) {
    assert(foes.length >= (MONSTERS[key].role === "guard" ? 3 : 4));
    assert.equal(foes.filter(e => e.key === key).length, 1);
    assert.equal(foes[MONSTERS[key].role === "guard" ? 0 : foes.length - 1].key, key, "役割持ちの隊列を維持する");
  }
}

reseedRng(20261014);
let checked = 0;
for (const cfg of DUNGEONS) for (let f = 1; f <= cfg.floors; f++) {
  const pool = poolAt(cfg, f);
  for (const key of pool) {
    verify(spawnCardEnemies(key, f, 1.7, { pool }), key, pool);
    checked++;
  }
}
const pool = poolAt(DUNGEONS[0], 1).filter(ordinary);
assert(pool.length >= 3);
const key = pool[0];
let multiple = 0, mixed = 0, largeMixed = 0, triples = 0;
for (let i = 0; i < 12000; i++) {
  const foes = spawnCardEnemies(key, 5, 1.7, { pool });
  const kinds = new Set(foes.map(e => e.key)).size;
  if (foes.length > 1) { multiple++; if (kinds > 1) mixed++; }
  if (foes.length >= 4 && kinds > 1) { largeMixed++; if (kinds === 3) triples++; }
}
assert(mixed / multiple > .72 && mixed / multiple < .78, "複数体の約75%が混成");
assert(triples / largeMixed > .45 && triples / largeMixed < .55, "大きな混成群れの約半数が3種類");

const excluded = Object.keys(MONSTERS).filter(k => !ordinary(k));
verify(spawnCardEnemies(key, 5, 1.7, { min: 6, pool: [key, key, "missing", ...excluded] }), key, [key]);
for (const k of Object.keys(MONSTERS).filter(k => MONSTERS[k].role && MONSTERS[k].escort)) {
  verify(spawnCardEnemies(k, 5, 1.7, { pool }), k, pool);
}
for (const options of [{}, { pool: [] }, { pool: [key] }, { pool: ["missing"] }, null]) {
  assert(spawnCardEnemies(key, 5, 1.7, options).every(e => e.key === key), "候補が無ければ従来の同種編成");
}
for (const min of [3, 6, 20]) {
  assert(spawnCardEnemies(key, 1, 1.7, { min, pool }).length >= Math.min(min, MAX_ENEMIES));
}
const snapshot = () => spawnCardEnemies(key, 5, 1.7, { min: 6, pool }).map(({ uid, ...e }) => e);
reseedRng(743);
const first = snapshot(), state = [...rngState()];
reseedRng(743);
assert.deepEqual(snapshot(), first, "同じ種なら同じ顔ぶれ・能力・名前");
assert.deepEqual(rngState(), state, "乱数位置も再現する");
console.log(`混成群れ: 全迷宮${checked}編成を確認。混成${(mixed / multiple * 100).toFixed(1)}%、大きな混成群れの3種類${(triples / largeMixed * 100).toFixed(1)}%。`);
