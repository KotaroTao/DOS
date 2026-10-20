// オートが傷を散らさず敵の数を減らすことと、回復・魔力・射程の維持を確認する。
import assert from "node:assert/strict";
import { Battle, SPELLS, setElemKnown } from "../../src/combat.js";
import { decideAuto, TACTICS } from "../../src/autotactics.js";
import { makeDoll } from "../../src/souls.js";
import { zeroResists } from "../../src/resistance.js";
import { bindRngState, rngState } from "../../src/rng.js";
import { refSerialize } from "../../src/savegraph.js";

const added = {
  AUTO_FINISH_ALL: { name: "検証の全体術", mp: 1, kind: "atk", target: "all-enemy", power: 40 },
  AUTO_FINISH_HIT: { name: "検証の一撃", mp: 1, kind: "atk", target: "enemy", power: 100 },
  AUTO_FINISH_SCATTER: { name: "検証の乱撃", mp: 1, kind: "phys", target: "all-enemy", power: 3, scatter: 6 },
  AUTO_FINISH_DEATH: { name: "検証の即死", mp: 1, kind: "debuff", target: "enemy", instakill: { chance: 0.5 } },
};
Object.assign(SPELLS, added);
let uid = 100000;
const actor = (mods = {}) => Object.assign(makeDoll("検証の人業"), {
  level: 40, jobLv: 40, atk: 100, int: 100, pie: 100, vit: 50, agi: 100, luk: 8,
  hp: 1000, maxhp: 1000, mp: 1000, maxmp: 1000, soulMp: 0, spells: [], passiveMap: {}, ...mods,
});
const foe = (mods = {}) => ({
  uid: ++uid, key: "bs_review", name: "検証の敵", side: "enemy", mon: { race: "humanoid" },
  lv: 40, hp: 10000, maxhp: 10000, atk: 100, vit: 50, agi: 30, luk: 8,
  alive: true, resists: zeroResists(), element: "none", ...mods,
});
const setup = (mods = {}, enemies = [foe({ atk: 20 }), foe({ atk: 1000 })], allies = []) => {
  const a = actor(mods), b = new Battle([a, ...allies], enemies, () => {});
  return { a, b, enemies };
};
const pick = ({ a, b }) => { const dbg = []; return { plan: decideAuto(b, a, dbg), dbg }; };
const hp = (e, value) => { e.hp = Math.max(1, Math.ceil(value)); };
setElemKnown(null);
try {
  for (const { key: tactic } of TACTICS) {
    // 脅威の大きい丈夫な敵を削るより、小さな敵をまず倒す。「刃のみ」も対象。
    let x = setup({ tactic });
    hp(x.enemies[0], x.b.estBasic(x.a, x.enemies[0]) * 0.3);
    assert.equal(pick(x).plan.target, x.enemies[0], `${tactic}: とどめを優先`);
    x.enemies[0].hp = 0; x.enemies[0].alive = false;
    assert.equal(pick(x).plan.target, x.enemies[1], `${tactic}: 討伐後は生きた敵へ向き直る`);
    // まだ倒せなくても、二手で倒せる敵へ攻めを寄せる。
    x = setup({ tactic });
    hp(x.enemies[0], x.b.estBasic(x.a, x.enemies[0]) * 1.2);
    assert.equal(pick(x).plan.target, x.enemies[0], `${tactic}: 少ない手数を優先`);
  }
  // 全体攻撃の合計ダメージが大きくても、一体も倒せなければ単体のとどめを選ぶ。
  {
    const x = setup({ tactic: "all", spells: ["AUTO_FINISH_ALL", "AUTO_FINISH_HIT"] }, Array.from({ length: 5 }, () => foe()));
    const [small] = x.enemies;
    const wide = x.b.estSpell(x.a, SPELLS.AUTO_FINISH_ALL, small);
    const hit = x.b.estSpell(x.a, SPELLS.AUTO_FINISH_HIT, small);
    assert(hit > wide);
    hp(small, (wide + hit) / 2);
    const { plan, dbg } = pick(x);
    assert.equal(plan.spellKey, "AUTO_FINISH_HIT");
    assert.equal(plan.target, small);
    assert(dbg.find(c => c.spellKey === "AUTO_FINISH_ALL").raw > small.hp);
  }
  // 二体を倒せる全体攻撃は、一体だけを倒す大技より先に選ぶ。
  {
    const x = setup({ tactic: "all", spells: ["AUTO_FINISH_ALL", "AUTO_FINISH_HIT"] }, [foe(), foe(), foe()]);
    for (const e of x.enemies.slice(0, 2)) hp(e, x.b.estSpell(x.a, SPELLS.AUTO_FINISH_ALL, e) * 0.5);
    assert.equal(pick(x).plan.spellKey, "AUTO_FINISH_ALL");
  }
  // 残りHPの95%を削るだけの手を、とどめに数えない。
  {
    const x = setup({ tactic: "blade" });
    hp(x.enemies[0], x.b.estBasic(x.a, x.enemies[0]) * 0.3);
    hp(x.enemies[1], x.b.estBasic(x.a, x.enemies[1]) / 0.96);
    assert.equal(pick(x).plan.target, x.enemies[0]);
  }
  // 乱撃の対象別平均だけでは、複数の敵を確実に倒す手として扱わない。
  {
    const x = setup({ tactic: "all", spells: ["AUTO_FINISH_SCATTER"] });
    for (const e of x.enemies) hp(e, x.b.estBasic(x.a, e) * 0.3);
    assert.equal(pick(x).plan.action, "attack");
  }
  // 深手の癒しと蘇生は、とどめ候補があっても維持する。
  {
    const x = setup({ tactic: "life", spells: ["DIOSALL"], hp: 10 }, [foe({ atk: 20 }), foe({ atk: 100 })]);
    x.enemies[0].hp = 1;
    assert.equal(pick(x).plan.spellKey, "DIOSALL");
    const dead = actor({ hp: 0, alive: false });
    const y = setup({ tactic: "life", spells: ["REVIVE"] }, [foe({ hp: 1 }), foe()], [dead]);
    assert.equal(pick(y).plan.spellKey, "REVIVE");
    assert.equal(pick(y).plan.target, dead);
  }
  // 確率頼みの即死よりも、傷で倒せる敵を先に減らす。
  {
    const x = setup({ tactic: "all", spells: ["AUTO_FINISH_DEATH"] });
    x.enemies[0].hp = 1;
    assert.equal(pick(x).plan.action, "attack");
    assert.equal(pick(x).plan.target, x.enemies[0]);
  }
  // 同じ敵を倒すなら、魔力を使わない通常攻撃を残す。MP不足の技も使わない。
  for (const mp of [0, 1000]) {
    const x = setup({ tactic: "save", spells: ["AUTO_FINISH_HIT"], mp });
    x.enemies[0].hp = 1;
    assert.equal(pick(x).plan.action, "attack");
  }
  // 近接武器の届かない後衛へ、とどめのために狙いを飛ばさない。
  {
    const x = setup({ tactic: "blade" }, [foe(), foe(), foe(), foe({ hp: 1 })]);
    assert(!x.b.attackableEnemies(x.a).includes(x.enemies[3]));
    assert.notEqual(pick(x).plan.target, x.enemies[3]);
  }
  // 判断は戦闘状態と乱数位置を一切変えない。
  {
    const x = setup({ tactic: "bal", spells: Object.keys(added) });
    bindRngState({ seed: 12345, pos: 0 });
    const before = JSON.stringify(refSerialize(x.b)), rng = JSON.stringify(rngState());
    for (let i = 0; i < 10; i++) pick(x);
    assert.equal(JSON.stringify(refSerialize(x.b)), before);
    assert.equal(JSON.stringify(rngState()), rng);
  }
  console.log("5作戦のとどめ・集中攻撃、単体/全体/乱撃、95%境界、癒し/蘇生、MP節約/不足、射程、状態と乱数の不変を確認");
} finally {
  for (const key of Object.keys(added)) delete SPELLS[key];
}
