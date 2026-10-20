// 3ターンの隊の攻めを、強化・弱体・手番・持続・MP込みで比べる回帰検査。
import assert from "node:assert/strict";
import { Battle, SPELLS, setElemKnown, setModSink } from "../../src/combat.js";
import { makeDoll } from "../../src/souls.js";
import { decideAuto, TACTICS } from "../../src/autotactics.js";
import { bindRngState, rngState } from "../../src/rng.js";
import { refSerialize } from "../../src/savegraph.js";

const specs = {
  PLAN_BUFF: { kind: "buff", target: "all-ally", buff: { atk: 1.5 }, dur: 3 },
  PLAN_SHORT: { kind: "buff", target: "all-ally", buff: { atk: 1.5 }, dur: 1 },
  PLAN_WEAK: { kind: "debuff", target: "enemy", debuff: { vit: 0.5 }, dur: 3 },
  PLAN_INT: { kind: "buff", target: "all-ally", buff: { int: 1.5 }, dur: 3 },
  PLAN_FIRE: { kind: "atk", target: "enemy", power: 40, element: "fire" },
  PLAN_VULN: { kind: "debuff", target: "enemy", vuln: { fire: 0.5 }, dur: 3 },
  PLAN_WRONG: { kind: "debuff", target: "enemy", vuln: { ice: 0.5 }, dur: 3 },
};
for (const [key, sp] of Object.entries(specs)) SPELLS[key] = { name: "検証の技", mp: 1, ...sp };
let uid = 10000;
const doll = (mods = {}) => Object.assign(makeDoll("検証の人業"), {
  level: 40, jobLv: 40, atk: 500, int: 10, pie: 10, vit: 50, agi: 100, luk: 8,
  hp: 1000, maxhp: 1000, mp: 1000, maxmp: 1000, soulMp: 0, spells: [], passiveMap: {}, tactic: "all", ...mods,
});
const foe = (mods = {}) => ({ uid: ++uid, key: "test", name: "検証の敵", side: "enemy", mon: { race: "humanoid" },
  lv: 40, hp: 100000, maxhp: 100000, atk: 100, vit: 300, agi: 10, alive: true, ...mods });
function setup(spells, options = {}) {
  const a = doll({ atk: 40, spells, ...options.actor });
  const allies = options.allies || [doll(), doll(), doll()];
  const b = new Battle([a, ...allies], options.enemies || [foe()], () => {});
  return { a, b, allies };
}
function pick({ a, b }) { const dbg = []; return { plan: decideAuto(b, a, dbg), dbg }; }
setElemKnown(() => false);
try {
  // 自分の一打より、続いて動く強い味方三人を強化する方が3ターンの傷が大きい。
  for (const tactic of ["all", "bal", "life", "save"]) {
    const x = setup(["PLAN_BUFF"], { actor: { tactic } });
    const { plan, dbg } = pick(x);
    assert.equal(plan.spellKey, "PLAN_BUFF", tactic);
    assert(plan.effectiveAttack, "有効な攻めを増やす準備だけで停滞扱いにしない");
    const buff = dbg.find(c => c.spellKey === "PLAN_BUFF"), hit = dbg.find(c => c.action === "attack");
    assert.equal(buff.raw, 0); assert(buff.score > hit.score);
  }
  // 刃のみは将来も通常攻撃だけ。選ばれていない技を隊の予測へ混ぜない。
  assert.equal(pick(setup(["PLAN_BUFF"], { actor: { tactic: "blade" } })).plan.action, "attack");
  {
    const x = setup(["PLAN_BUFF"]); x.a.autoOff = ["PLAN_BUFF"];
    assert.equal(pick(x).plan.action, "attack");
  }
  // 防御の高い相手には、弱体がその後の隊の打撃を増やす。
  assert.equal(pick(setup(["PLAN_WEAK"])).plan.spellKey, "PLAN_WEAK");
  // 呪文中心の隊では知力強化と、実際に使う属性の耐性ダウンを選べる。
  const casters = () => [doll({ atk: 1, int: 500, spells: ["PLAN_FIRE"] }), doll({ atk: 1, int: 500, spells: ["PLAN_FIRE"] })];
  assert.equal(pick(setup(["PLAN_INT"], { allies: casters() })).plan.spellKey, "PLAN_INT");
  assert.equal(pick(setup(["PLAN_VULN", "PLAN_WRONG"], { allies: casters() })).plan.spellKey, "PLAN_VULN");
  // 今のターンに味方がもう動き終えていれば、持続1の強化は次ターンに切れて役立たない。
  {
    const x = setup(["PLAN_SHORT", "PLAN_BUFF"]); x.b.current = x.a; x.b.queue = [];
    const { plan, dbg } = pick(x);
    assert.equal(plan.spellKey, "PLAN_BUFF");
    assert(dbg.find(c => c.spellKey === "PLAN_BUFF").supportGain3 > dbg.find(c => c.spellKey === "PLAN_SHORT").supportGain3);
  }
  // もう終わる戦いに強化を掛けず、段の上限へも無駄に重ねない。
  assert.equal(pick(setup(["PLAN_BUFF"], { enemies: [foe({ hp: 1 })] })).plan.action, "attack");
  {
    const x = setup(["PLAN_BUFF"]);
    for (const a of x.b.party) x.b._applyMod(a, "atk", 1.75, 99, "既存の強化");
    assert.equal(pick(x).plan.action, "attack");
  }
  assert.equal(pick(setup(["PLAN_BUFF"], { actor: { mp: 0 } })).plan.action, "attack");
  // 命を繋ぐ命令で、深手の癒し・蘇生まで攻めの準備に置き換えない。
  assert.equal(pick(setup(["DIOSALL", "PLAN_BUFF"], { actor: { tactic: "life", hp: 10 } })).plan.spellKey, "DIOSALL");
  {
    const dead = doll({ hp: 0, alive: false });
    const x = setup(["REVIVE"], { actor: { tactic: "life" }, allies: [dead] });
    assert.equal(pick(x).plan.spellKey, "REVIVE");
    assert.equal(pick(x).plan.target, dead);
  }
  {
    const x = setup([], { actor: { tactic: "blade" }, allies: [], enemies: [foe(), foe(), foe(), foe({ hp: 1 })] });
    assert.notEqual(pick(x).plan.target, x.b.enemies[3], "届かない敵へ狙いを飛ばさない");
  }
  // 後で倒せるという予測だけで、今とどめを刺して敵の手番を減らす価値を消さない。
  {
    const x = setup([], { actor: { tactic: "blade", atk: 100 }, allies: [], enemies: [foe({ hp: 40, vit: 0 }), foe({ vit: 0 })] });
    assert.equal(pick(x).plan.target, x.b.enemies[0]);
  }
  // 残りMPで強化後の攻撃を継続できない時、その支援を過大評価しない。
  {
    const rich = setup(["PLAN_INT"], { allies: casters() });
    const poor = setup(["PLAN_INT"], { allies: casters().map(a => Object.assign(a, { mp: 0 })) });
    assert(pick(rich).dbg.find(c => c.spellKey === "PLAN_INT").supportGain3 >
      pick(poor).dbg.find(c => c.spellKey === "PLAN_INT").supportGain3);
  }
  // 実戦のバフ通知・ログ・保存データ・乱数の位置に触れない。
  {
    const x = setup(["PLAN_BUFF", "PLAN_WEAK"]);
    bindRngState({ seed: 12345, pos: 0 });
    const before = JSON.stringify(refSerialize(x.b)), rng = JSON.stringify(rngState());
    let notices = 0; setModSink(() => notices++); x.b.log = () => notices++;
    for (let n = 0; n < 5; n++) pick(x);
    assert.equal(notices, 0); assert.equal(JSON.stringify(refSerialize(x.b)), before);
    assert.equal(JSON.stringify(rngState()), rng);
  }
  console.log("3ターンの物理/呪文の強化・防御/属性弱体、5作戦、短期決戦/上限/手番/持続/MP/オート除外、戦闘状態・通知・乱数の不変を確認");
} finally { for (const key of Object.keys(specs)) delete SPELLS[key]; setModSink(null); setElemKnown(null); }
