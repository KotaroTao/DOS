// 全敵の個別体質・属性相性と、戦闘/図鑑への反映を検証する。
import assert from "node:assert/strict";
import { MONSTERS } from "../../src/sprites.js";
import { BESTIARY } from "../../src/dungeons/bestiary.js";
import { MONSTER_TEMPERAMENTS } from "../../src/dungeons/temperaments.js";
import { defMonster, normalizeAffinity, elemDmgMult, ELEMENTS } from "../../src/dungeons/schema.js";
import { AIL_RESIST_KINDS, MON_RESIST_WEAKABLE, resistTiers, monsterResists, resistLean } from "../../src/resistance.js";
import { spawnEliteEnemies, spawnMimic, spawnRanked, Battle } from "../../src/combat.js";
import { elemAffinity } from "../../src/ui/itemview.js";
import { makeDoll } from "../../src/souls.js";

Object.assign(MONSTERS, BESTIARY);
assert.deepEqual(Object.keys(MONSTER_TEMPERAMENTS).sort(), Object.keys(MONSTERS).sort(), "個別台帳と全敵のIDが一致する");
const profiles = new Set();
const actor = Object.assign(makeDoll("体質検証"), { level: 40 });
for (const [id, m] of Object.entries(MONSTERS)) {
  const profile = MONSTER_TEMPERAMENTS[id];
  assert.equal(Object.keys(m.resistTiers).length, AIL_RESIST_KINDS.length, id);
  assert.deepEqual(m.resistTiers, profile.resistTiers, id);
  assert.deepEqual(m.affinity, normalizeAffinity(profile.affinity, "none", id), id);
  assert.deepEqual(m.resists, monsterResists({ ...m, resists: m.resistOverrides || {} }), `基礎ランクの抵抗値: ${id}`);
  // 名前・説明・種族・能力が変わっても、明示した体質は勝手に変化しない。
  const altered = { ...m, id: "changed", name: "石の竜", desc: "眠る霊と腐った機械", race: "specter", haste: true, evasive: true, ability: "sleep", magResist: 100 };
  assert.deepEqual(resistTiers(m), resistTiers(altered), `推測から独立: ${id}`);
  const tiers = resistTiers(m);
  if (m.metal) {
    for (const k of AIL_RESIST_KINDS) assert.equal(tiers[k], "imm", id);
  } else {
    assert(MON_RESIST_WEAKABLE.some(k => tiers[k] === "weak"), `弱点: ${id}`);
    if (["bs_dustroach", "bs_littlecentipede", "bs_woodbee"].includes(id)) {
      assert.equal(m.rank, 1, `序章の三種: ${id}`);
      for (const k of AIL_RESIST_KINDS) assert.equal(m.resists[k], 0, `序章の三種は状態異常抵抗なし: ${id}`);
      assert.equal(tiers.sleep, "weak", `序章の三種は眠りが弱点: ${id}`);
    } else assert(MON_RESIST_WEAKABLE.some(k => ["strong", "imm"].includes(tiers[k])), `耐性: ${id}`);
  }
  assert(!["weak", "slight"].includes(tiers.death), id);
  assert(!["weak", "slight"].includes(tiers.stone), id);
  const [enemy] = spawnEliteEnemies(id);
  assert.deepEqual(enemy.affinity, m.affinity, `戦闘の属性相性: ${id}`);
  assert.deepEqual(enemy.resists, m.resists, `戦闘の抵抗値: ${id}`);
  assert.deepEqual(elemAffinity(enemy.element, enemy.affinity), m.affinity, `図鑑の相性: ${id}`);
  const battle = new Battle([actor], [enemy], () => {});
  for (const k of AIL_RESIST_KINDS) {
    assert(Math.abs(battle.estRate(actor, enemy, .5, k) - battle.estRate(actor, enemy, .5) * (1 - enemy.resists[k] / 100)) < 1e-12, `戦闘の成功率: ${id} ${k}`);
  }
  for (const el of Object.keys(ELEMENTS).filter(el => el !== "none")) {
    const expected = m.affinity.weak.includes(el) ? 1.5 : m.affinity.resist.includes(el) ? .5 : 1;
    assert.equal(elemDmgMult(el, 1, m.element, null, m.affinity), expected, `属性倍率: ${id} ${el}`);
  }
  profiles.add(JSON.stringify([tiers, m.affinity]));
}
assert.equal(MONSTERS.bs_direwolf.resists.sleep, 0);
assert(MONSTERS.bs_corruptstag.resists.sleep >= 60);
assert.equal(MONSTERS.bs_corruptstag.resists.flinch, 0);
assert.equal(MONSTERS.bs_siegeballista.resists.sleep, 100);
assert.equal(MONSTERS.bs_siegeballista.resists.paralyze, 0);
assert.equal(MONSTERS.bs_corpsemaggot.resists.sleep, 0);
assert(MONSTERS.bs_preservedbeast.resists.sleep === 100);
assert(MONSTERS.bs_forgehound.resists.sleep === 100);
assert(resistLean(MONSTERS.bs_corruptstag).strong.includes("sleep"));
assert(resistLean(MONSTERS.bs_siegeballista).weak.includes("paralyze"));
for (const master of [false, true]) {
  const [mimic] = spawnMimic(8, 1, master);
  assert.deepEqual(mimic.affinity, MONSTERS[mimic.key].affinity);
  assert(master ? mimic.resists.sleep >= 60 : mimic.resists.sleep < 20);
}
const [warden] = spawnRanked("bs_cagewarden", 10);
assert(warden.resists.paralyze >= 60 && warden.resists.sleep < 20);
const custom = defMonster({ id: "bs_corruptstag", artKey: "beast", resistTiers: { sleep: "weak" }, affinity: { weak: ["water"], resist: [] } });
assert.equal(custom.resistTiers.sleep, "weak");
assert.deepEqual(custom.affinity, { weak: ["water"], resist: [] });
console.log(`全${Object.keys(MONSTERS).length}敵の個別設定・${profiles.size}通りの体質/属性相性・戦闘/図鑑・全属性倍率・個体指定の上書きを確認`);
