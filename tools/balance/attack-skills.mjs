// 攻撃の技の釣り合い (2026-10): 全36職を裸・魂ランク2で作り、敵2体を相手にした技ごとの与ダメとMP効率を比べる。
// - Lv100 / Lv200 で、敵全体の技のMP効率が単体の技の 1.3倍を超える職がない (全体技を撃つのが一番得にならない)
// - 後に覚える技が、前に覚える同種・同属性の技にどこでも負ける「純粋な技」(付く効果なし) の数が上限以下
// node tools/balance/attack-skills.mjs
import assert from 'node:assert/strict';
import { Battle, SPELLS, spellCost, setElemKnown, soulPowerMul } from '../../src/combat.js';
import { setResistKnown } from '../../src/autotactics.js';
import { SOUL_CLASSES, SOUL_KEYS, JOB_SKILLS, makeDoll, makeSoulInstance, setSharedSouls, recalcDoll, rankThresholds, soulLevelCap } from '../../src/souls.js';
import { MONSTERS } from '../../src/sprites.js';
import { DUNGEON_MONSTERS } from '../../src/dungeons/index.js';
import { monsterResists } from '../../src/resistance.js';
Object.assign(MONSTERS, DUNGEON_MONSTERS); setElemKnown(null); setResistKnown(() => true);
function doll(job, level, rank = 2) {
  const count = rankThresholds(SOUL_CLASSES[job].rarity)[rank - 1];
  const s = makeSoulInstance(job, count, level); s.capBonus = Math.max(0, level - soulLevelCap(job, count));
  setSharedSouls([s]); const d = makeDoll(SOUL_CLASSES[job].label); d.primary = s.uid; recalcDoll(d);
  d.hp = d.maxhp; d.mp = d.maxmp; return d;
}
const RIDERS = ['debuff', 'poison', 'para', 'seal', 'instakill', 'strip', 'vuln', 'charm', 'confuse', 'sleepChance', 'flinchChance', 'drain', 'mpDrain', 'steal', 'plunder', 'execute', 'prey', 'bladeHeal', 'partyHeal', 'pierce', 'desperate', 'hpCost', 'debuffAll', 'gravity'];
// 後発の純粋な技が前の技に負ける数の上限 (2026-10 の見直し後: Lv40 6 / Lv100 12 / Lv200 19。増えたら技を見直す)
const DOM_MAX = { 40: 6, 100: 12, 200: 19 };
const ALL_RATIO_MAX = 1.3;
for (const L of [40, 100, 200]) {
  const ref = doll('fighter', L);
  const foe = () => ({ uid: Math.random(), key: 'b', name: '敵', side: 'enemy', alive: true, hp: 1e9, maxhp: 1e9,
    atk: ref.atk * 2.5, vit: Math.round(ref.atk * 0.7), agi: 20, int: ref.int, pie: ref.pie, luk: 8, lv: L, element: 'none',
    physResist: 0, magResist: 0, resists: monsterResists({ rank: Math.min(10, Math.ceil(L / 20)), race: 'humanoid' }), mon: { race: 'humanoid' } });
  let dom = 0, worst = 0, worstJob = '';
  for (const job of SOUL_KEYS) {
    const a = doll(job, L), t = foe(), b = new Battle([a], [t, foe()], () => {}, { foeLv: L, fleeK: 1 / 0.3 });
    const lv = {}; for (const e of JOB_SKILLS[job]) if (e.skill) lv[e.skill] = e.lvl;
    const S = a.spells.map((k) => [k, SPELLS[k]]).filter(([, sp]) => sp && ['phys', 'atk'].includes(sp.kind) && !sp.gravity).map(([k, sp]) => {
      const one = sp.kind === 'phys' ? b.estPhys(a, t, { ...sp, power: sp.power * soulPowerMul(a, sp), skill: true }) * (sp.hits || sp.scatter || 1) : b.estSpell(a, sp, t);
      assert(Number.isFinite(one) && one >= 0, `${job}:${k}`);
      const all = sp.target === 'all-enemy';
      return { k, lv: lv[k], all, el: sp.element || 'none', acc: sp.acc || 0, pure: !RIDERS.some((f) => sp[f]), tot: one * (all ? 2 : 1), c: spellCost(a, sp) };
    });
    for (const x of S) if (x.pure && S.some((y) => y !== x && y.all === x.all && y.el === x.el && y.lv < x.lv && !(x.acc > y.acc + 0.3) && y.c <= x.c && y.tot >= x.tot)) dom++;
    const one = S.filter((r) => !r.all), all = S.filter((r) => r.all);
    if (one.length && all.length) {
      const q = Math.max(...all.map((r) => r.tot / r.c)) / Math.max(...one.map((r) => r.tot / r.c));
      if (q > worst) { worst = q; worstJob = job; }
    }
  }
  if (L >= 100) assert(worst <= ALL_RATIO_MAX, `Lv${L}: ${worstJob} の全体技のMP効率が単体の${worst.toFixed(2)}倍`);
  assert(dom <= DOM_MAX[L], `Lv${L}: 前の技に負ける後発の技が ${dom} (上限 ${DOM_MAX[L]})`);
  console.log(`Lv${L}: 全体技のMP効率は単体の最大${worst.toFixed(2)}倍 (${worstJob}) / 前の技に負ける後発の純粋な技 ${dom}`);
}
