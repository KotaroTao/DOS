// 全37職の見直し: ランク固定・習得境界・旧借用・役割の実戦回帰。
// node tools/balance/job-overhaul.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JOBKIT } from '../../src/jobkit/index.js';
import { Battle, SPELLS, perkVictory, setElemKnown } from '../../src/combat.js';
import { SOUL_KEYS, SOUL_CLASSES, PASSIVES, JOB_PASSIVES, JOB_BASE_TRAITS, JOB_SKILLS,
  jobLevelPassives, makeDoll, makeSoulInstance, setSharedSouls, recalcDoll,
  soulLearnedSkills, soulLearnedPassives, rankThresholds } from '../../src/souls.js';
import { useMathRandom } from '../../src/rng.js';
const before = JSON.parse(fs.readFileSync(new URL('./fixtures/job-ranks-before-overhaul.json', import.meta.url)));
assert.equal(SOUL_KEYS.length, 37);
let boundaries = 0, borrowed = 0;
for (const job of SOUL_KEYS) {
  const old = before.jobs[job], kit = JOBKIT[job], table = JOB_SKILLS[job];
  assert.equal(kit.awaken, old.key, `${job}: ランクのキー`);
  assert.deepEqual(PASSIVES[old.key], old.definition, `${job}: ランクの説明・効果Lv`);
  assert.deepEqual(kit.perks[old.key] || null, old.fx || null, `${job}: ランクのfx`);
  assert.deepEqual(JOB_PASSIVES[job], old.ranks, `${job}: ランクの習得条件`);
  assert.deepEqual(JOB_BASE_TRAITS[job] || null, old.traits || null, `${job}: 基礎特性`);
  const keys = table.map(e => e.skill || `${e.passive}/${e.plv}`);
  assert.equal(new Set(keys).size, keys.length, `${job}: 習得の二重登録`);
  assert.deepEqual([...keys].sort(), [...old.entries].sort(), `${job}: 旧借用キーをすべて保持`);
  let last = 0;
  const levels = {};
  for (const e of table) {
    assert(Number.isInteger(e.lvl) && e.lvl >= last && e.lvl <= 200, `${job}: 習得Lvの順序`);
    last = e.lvl;
    if (e.skill) {
      assert(SPELLS[e.skill], `${job}: ${e.skill}`);
      assert(!soulLearnedSkills({ clsKey: job, level: e.lvl - 1 }).includes(e.skill) || e.lvl === 1);
      assert(soulLearnedSkills({ clsKey: job, level: e.lvl }).includes(e.skill));
    } else {
      assert.notEqual(e.passive, old.key, `${job}: ランク加護をLvで配らない`);
      assert(e.plv > (levels[e.passive] || 0) && PASSIVES[e.passive]?.lv[e.plv - 1]);
      assert.equal(jobLevelPassives(job, e.lvl)[e.passive], e.plv);
      if (e.lvl > 1) assert.equal(jobLevelPassives(job, e.lvl - 1)[e.passive] || 0, levels[e.passive] || 0);
      levels[e.passive] = e.plv;
    }
    boundaries++;
  }
  assert(table.some(e => e.lvl <= 12 && kit.skills[e.skill]), `${job}: 序盤に固有技を持つ`);
  // 借用を記録した旧セーブを復元。Lv200なら旧キーを失わず、再計算も冪等。
  if (job !== 'sera') {
    const soul = makeSoulInstance(job, rankThresholds(SOUL_CLASSES[job].rarity)[4], 200);
    const main = makeSoulInstance(job === 'fighter' ? 'mage' : 'fighter', 1, 200);
    setSharedSouls([main, soul]);
    for (const entry of table) {
      const pick = entry.skill ? { skill: entry.skill } : { passive: entry.passive };
      const doll = makeDoll('旧記録の借用');
      doll.primary = main.uid;
      doll.subs = [{ uid: soul.uid, picks: [pick], picked: true }];
      const restored = JSON.parse(JSON.stringify(doll));
      recalcDoll(restored);
      assert.deepEqual(restored.subs[0].picks, [pick]);
      if (entry.skill) assert(restored.spells.includes(entry.skill));
      else assert.equal(restored.passiveMap[entry.passive], soulLearnedPassives(soul)[entry.passive]);
      const snapshot = JSON.stringify([restored.spells, restored.passiveMap, restored.subInfo]);
      recalcDoll(restored);
      assert.equal(JSON.stringify([restored.spells, restored.passiveMap, restored.subInfo]), snapshot);
      borrowed++;
    }
    // 習得が後ろへ移った借用も削除せず、Lv到達時に自動で戻る。
    const later = table.find(e => e.skill && e.lvl > 100);
    soul.level = 1;
    const doll = makeDoll('育成中の借用'); doll.primary = main.uid;
    doll.subs = [{ uid: soul.uid, picks: [{ skill: later.skill }], picked: true }];
    recalcDoll(doll);
    assert.equal(doll.subInfo[0].picks.length, 0);
    assert.deepEqual(doll.subs[0].picks, [{ skill: later.skill }]);
    soul.level = 200; recalcDoll(doll);
    assert.deepEqual(doll.subInfo[0].picks, [{ skill: later.skill }]);
  }
}
setSharedSouls([]); setElemKnown(null);
useMathRandom(); Math.random = () => .1;
const member = (pm = {}) => Object.assign(makeDoll('検証の人業'), {
  level: 100, atk: 200, vit: 100, agi: 100, int: 200, pie: 150, luk: 8,
  hp: 1000, maxhp: 1000, mp: 1000, maxmp: 1000, passiveMap: pm, soulMp: 0,
});
let uid = 100000;
const foe = () => ({ uid: uid++, key: 'balance', name: '検証の敵', side: 'enemy', alive: true,
  hp: 1e6, maxhp: 1e6, atk: 100, vit: 20, agi: 30, int: 100, pie: 50, luk: 8,
  lv: 100, element: 'none', mon: { race: 'humanoid' }, spells: [] });
// 支援技の定義へ攻撃専用の項目を足しても実行されない。型だけ通る無効な追加を防ぐ。
for (const [key, sp] of Object.entries(SPELLS)) if (['buff', 'cure'].includes(sp.kind)) {
  for (const field of ['power', 'critBonus', 'seal', 'vuln']) assert(!sp[field], `${key}: ${sp.kind}で使われない${field}`);
}
{
  const a = member(), ally = member(), e = foe(), b = new Battle([a, ally], [e], () => {});
  ally.ailment = 'paralyze'; b._applyStage(ally, 'atk', -1, 3, '敵の弱体');
  b._exec({ actor: a, action: 'spell', spellKey: 'TEMPLAR_MONZENNOHARAI', target: a });
  assert.equal(ally.ailment, null); assert.equal(b.stageOf(ally, 'atk'), 0);
  assert.equal(b.stageOf(ally, 'vit'), 1);
  assert.equal(ally.effects.find(x => x.stat === 'vit').turns, 2);
  b._exec({ actor: a, action: 'spell', spellKey: 'ARCANIST_KETSUIN', target: a });
  assert.equal(a.hp, 900); assert.equal(b.stageOf(a, 'int'), 2); assert.equal(b.stageOf(a, 'agi'), -1);
  assert.equal(a.effects.find(x => x.stat === 'int').turns, 4);
}
// 魔騎士と狂戦士のやり返しは別の能力を参照し、必ず発動する。
for (const key of ['darkknightKaeshiba', 'berserkerMukui']) {
  const a = member({ [key]: 1 }), e = foe(), b = new Battle([a], [e], () => {});
  const hit = () => { const hp = e.hp; b._perkHurt(a, e, 10, 'phys'); return hp - e.hp; };
  const first = hit(); assert(first > 0);
  a[key === 'darkknightKaeshiba' ? 'int' : 'atk'] *= 2;
  assert(hit() > first, `${key}: 固有の参照能力で伸びる`);
}
// 低HPの味方を守る義賊の加護は、持ち主本人のHPを条件にしない。
{
  const a = member({ brigandKabau: 3 }), target = member(), e = foe();
  const b = new Battle([a, target], [e], () => {});
  target.hp = 500;
  assert.equal(b._perkSum(target, 'take', { tgt: e, on: ['phys'] }), .13);
  target.hp = 501;
  assert.equal(b._perkSum(target, 'take', { tgt: e, on: ['phys'] }), 0);
  target.hp = 100; a.alive = false;
  assert.equal(b._perkSum(target, 'take', { tgt: e, on: ['phys'] }), 0);
}
// 護法師の窮地の結界は戦闘開始時だけ。全快時には配らない。
for (const hp of [500, 501]) {
  const a = member({ wardenHouheki: 2 }), ally = member(); a.hp = hp;
  new Battle([a, ally], [foe()], () => {});
  assert.equal(ally._barrierLeft || 0, hp === 500 ? 2 : 0);
}
// 修験者・竜騎士・大魔導の段強化は、Lvが上がると持続が延びる。
for (const [key, kind, stat] of [['asceticMoeagari', 'phys', 'pie'], ['dragonknightIkari', 'breath', 'atk'], ['archmageMakaku', 'breath', 'int']]) {
  for (let lv = 1; lv <= 3; lv++) {
    const a = member({ [key]: lv }), e = foe(), b = new Battle([a], [e], () => {});
    b._perkHurt(a, e, 10, kind);
    const effect = a.effects.find(x => x.stat === stat);
    assert(effect, key); assert.equal(effect.turns, lv + 1, key);
    assert.equal(b.stageOf(a, stat), 1);
  }
}
// MPの泉はそれぞれ条件が異なる。回復は2ターン目から。
for (const [key, condition] of [['wardenSeihitsu', 'always'], ['necromancerMeifuIzumi', 'last'], ['cardinalMeisou', 'fallen']]) {
  const a = member({ [key]: 1 }), ally = member(), enemies = [foe(), foe()];
  const b = new Battle([a, ally], enemies, () => {}); a.mp = 0;
  b._roundNo = 2; b._perkRound();
  assert.equal(a.mp, condition === 'always' ? 20 : 0, key);
  if (condition === 'last') enemies[1].alive = false;
  if (condition === 'fallen') ally.alive = false;
  a.mp = 0; b._perkRound(); assert.equal(a.mp, 20, key);
}
// 賢者の回復後の自癒、灯守の治療後の隊回復は、戦後回復と重ならない。
for (const [key, sp, party] of [['sageJihi', SPELLS.DIOS, false], ['seraMichibiki', SPELLS.CURE, true]]) {
  const a = member({ [key]: 1 }), ally = member(), b = new Battle([a, ally], [foe()], () => {});
  a.hp = ally.hp = 100; b._perkCast(a, sp, 5);
  assert.equal(a.hp, party ? 110 : 130); assert.equal(ally.hp, party ? 110 : 100);
  assert.equal(perkVictory(a, [a, ally]).hp, 0);
}
// 終の赦免は生存者の救命、聖典の終章は蘇生。説明だけでなく実処理で分ける。
{
  const a = member(), dead = member(), b = new Battle([a, dead], [foe()], () => {});
  dead.alive = false; dead.hp = 0; a.hp = 100;
  b._exec({ actor: a, action: 'spell', spellKey: 'INQUISITOR_SHAMEN', target: a });
  assert.equal(a.hp, a.maxhp); assert(!dead.alive); assert.equal(dead.hp, 0);
  a.mp = 1000;
  b._exec({ actor: a, action: 'spell', spellKey: 'ARCHBISHOP_SHUUSHOU', target: a });
  assert(dead.alive); assert.equal(dead.hp, 700);
}
console.log(`全37職のランク完全維持・習得境界${boundaries}件・旧借用${borrowed}件・役割別の実処理 OK`);
