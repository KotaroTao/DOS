// 後発技の用途と敵全体へのMP効率。node tools/balance/attack-skills.mjs
// 裸だけでなく標準装備でも比べ、命中・耐性・会心・防御の違いを値打ちに含める。
import assert from 'node:assert/strict';
import { Battle, SPELLS, spellCost, setElemKnown, skillPowerMul } from '../../src/combat.js';
import { setResistKnown } from '../../src/autotactics.js';
import { SOUL_CLASSES, SOUL_KEYS, JOB_SKILLS, makeDoll, makeSoulInstance, setSharedSouls, recalcDoll, rankThresholds, soulLevelCap } from '../../src/souls.js';
import { MONSTERS } from '../../src/sprites.js';
import { DUNGEON_MONSTERS } from '../../src/dungeons/index.js';
import { monsterResists } from '../../src/resistance.js';
import { reseedRng } from '../../src/rng.js';
import { CATALOG_ITEMS } from '../../src/catalog/index.js';
import { planBestEquip, applyPlan } from '../../src/autoequip.js';
import { gearScore } from '../../src/ui/itemview.js';
import { lootBand } from '../../src/dungeons/world.js';
Object.assign(MONSTERS, DUNGEON_MONSTERS);
setElemKnown(null);
setResistKnown(() => true);

// jobs.mjs と同じ、Lvに合う装備帯のコモン・アンコモンから最適装備を選ぶ。
const STD_GEAR = Object.values(CATALOG_ITEMS).filter(it => /_r\d+_/.test(it.id) && it.slot && !['misc', 'use'].includes(it.slot));
const gearCache = new Map();
function doll(job, level, rank = 2, geared = false) {
  const count = rankThresholds(SOUL_CLASSES[job].rarity)[rank - 1];
  const s = makeSoulInstance(job, count, level);
  s.capBonus = Math.max(0, level - soulLevelCap(job, count));
  setSharedSouls([s]);
  const a = makeDoll(SOUL_CLASSES[job].label);
  a.primary = s.uid;
  recalcDoll(a);
  if (geared) {
    const key = `${job}@${level}`;
    if (!gearCache.has(key)) {
      const [lo, hi] = lootBand(level, level);
      const ilv = Math.min(200, Math.round((lo + Math.min(hi, 200)) / 2));
      a.items = STD_GEAR.filter(it => it.lv <= ilv && it.lv > ilv - 15).map((it, i) => ({ ...it, uid: 900000 + i }));
      applyPlan(planBestEquip([a], { maxItems: 999, score: gearScore }));
      a.items = [];
      gearCache.set(key, { ...a.equip });
    }
    a.equip = { ...gearCache.get(key) };
    recalcDoll(a);
  }
  a.hp = a.maxhp;
  a.mp = a.maxmp;
  return a;
}
const RIDERS = ['debuff', 'poison', 'para', 'seal', 'instakill', 'strip', 'vuln', 'charm', 'confuse', 'sleepChance', 'flinchChance', 'drain', 'mpDrain', 'steal', 'plunder', 'execute', 'prey', 'bladeHeal', 'partyHeal', 'pierce', 'desperate', 'hpCost', 'debuffAll', 'gravity'];
const PROFILES = [
  { key: 'normal' },
  { key: 'soft', vit: 0 },
  { key: 'hard', vitMul: 3 }, // 武器を持った者にも防御差が現れる的
  { key: 'fast', agiMul: 3, passiveMap: { parry: 2 } },
  { key: 'phys75', physResist: 75 },
  { key: 'magic75', magResist: 75 },
  { key: 'crit', crit: 1 }, // 会心装備・強化が揃い、会心加算が上限へ届く場合
  { key: 'metal', metal: 1 },
];
const samples = new Map();
function sample(job, level, rank = 2, geared = false) {
  const key = `${job}/${level}/${rank}/${geared}`;
  if (samples.has(key)) return samples.get(key);
  reseedRng(12345); // 戦闘開始時のパッシブ抽選も同じ条件にする
  const a = doll(job, level, rank, geared), ref = doll('fighter', level);
  const learned = Object.fromEntries(JOB_SKILLS[job].filter(e => e.skill).map(e => [e.skill, e.lvl]));
  const rows = a.spells.map(k => ({ k, sp: SPELLS[k], lv: learned[k] }))
    .filter(x => ['phys', 'atk'].includes(x.sp?.kind) && !x.sp.gravity)
    .map(x => ({ ...x, cost: spellCost(a, x.sp), values: {} }));
  for (const p of PROFILES) {
    const t = { uid: 'target', key: 'balance', name: '検証の敵', side: 'enemy', alive: true, hp: 1e9, maxhp: 1e9,
      atk: ref.atk * 2.5, vit: Math.round(p.vit ?? (p.vitMul ? a.atk * p.vitMul : ref.atk * 0.7)),
      agi: ref.agi * (p.agiMul || 0.3), _partyScale: true, int: ref.int, pie: ref.pie, luk: 8, lv: level, element: 'none',
      physResist: p.physResist || 0, magResist: p.magResist || 0, metal: p.metal,
      passiveMap: p.passiveMap, resists: monsterResists({ rank: Math.min(10, Math.ceil(level / 20)), race: 'humanoid' }), mon: { race: 'humanoid' } };
    const crit = a.critBonus;
    if (p.crit) a.critBonus = p.crit;
    reseedRng(12345);
    const b = new Battle([a], [t, { ...t, uid: 'target2' }], () => {}, { foeLv: level, fleeK: 1 / 0.3 });
    for (const x of rows) {
      const sp = x.sp;
      let value = sp.kind === 'phys'
        ? b.estPhys(a, t, { ...sp, power: sp.power * skillPowerMul(a, sp), skill: true }) * (sp.hits || sp.scatter || 1)
        : b.estSpell(a, sp, t);
      // scatter は敵全体に回数分を分配する。敵の数をもう一度掛けない。
      if (sp.target === 'all-enemy' && !sp.scatter) value *= 2;
      assert(Number.isFinite(value) && value >= 0, `${key}/${p.key}/${x.k}: ダメージが不正`);
      x.values[p.key] = value;
    }
    a.critBonus = crit;
  }
  samples.set(key, rows);
  return rows;
}
function comparable(x, y) {
  return x.sp.target === y.sp.target && (x.sp.element || 'none') === (y.sp.element || 'none');
}
// 上限件数を緩めず、8条件すべてで安い先行技に負ける後発の純粋な技を0件にする。
for (const geared of [false, true]) for (const level of [40, 100, 200]) {
  const dominated = [];
  let worst = 0, worstJob = '';
  for (const job of SOUL_KEYS) {
    const rows = sample(job, level, 2, geared);
    for (const x of rows) if (!RIDERS.some(k => x.sp[k])) {
      const older = rows.find(y => y.lv < x.lv && y.cost <= x.cost && comparable(x, y)
        && PROFILES.every(p => y.values[p.key] >= x.values[p.key]));
      if (older) dominated.push(`${job}:${x.k} ← ${older.k}`);
    }
    const single = rows.filter(x => x.sp.target === 'enemy'), all = rows.filter(x => x.sp.target === 'all-enemy');
    if (single.length && all.length) {
      const ratio = Math.max(...all.map(x => x.values.normal / x.cost)) / Math.max(...single.map(x => x.values.normal / x.cost));
      if (ratio > worst) { worst = ratio; worstJob = job; }
    }
  }
  assert.equal(dominated.length, 0, `Lv${level}/${geared ? '標準装備' : '裸'}: ${dominated.join(', ')}`);
  if (level >= 100) assert(worst <= 1.3, `${worstJob}: 全体技のMP効率が単体の${worst.toFixed(2)}倍`);
  console.log(`Lv${level}/${geared ? '標準装備' : '裸'}: 8条件で先行技に負ける後発技0、全体MP効率 最大${worst.toFixed(2)}倍 (${worstJob})`);
}

// 単に「完全には負けない」だけでなく、用途に合う的で選ぶ理由を確認する。
// [職, 先行技, 後発技, 得意な条件, 最低の期待ダメージ比]
const ROLES = [
  ['fighter', 'GOUZAN', 'SANREN', 'normal', 1.15],
  ['hunter', 'TSURANUKI', 'RENSHA', 'normal', 1.15],
  ['monk', 'HOUKEN', 'HYAKURETSU', 'normal', 1.25],
  ['asura', 'ASHURAZAN', 'ASURA_ROPPI', 'normal', 1.25],
  ['dragonknight', 'DRAGONKNIGHT_KOURYUUGEKI', 'DRAGONKNIGHT_TENKUU', 'normal', 1.07],
  ['fighter', 'ZANTETSU', 'RANBU', 'normal', 1.1],
  ['thief', 'THIEF_SURINUKE', 'ASSASSINATE', 'normal', 1.09],
  ['samurai', 'KYOUGEKI', 'DOUBLE', 'normal', 1.03],
  ['samurai', 'KYOUGEKI', 'SAMURAI_SAYABASHIRI', 'normal', 1.05],
  ['samurai', 'SAMURAI_SAYABASHIRI', 'ISSEN', 'metal', 1.1],
  ['samurai', 'SAMURAI_UNYOU', 'SAMURAI_GEKKA', 'normal', 1.1],
  ['berserker', 'BERSERKER_BOUGYAKU', 'BERSERKER_YATSUZAKI', 'normal', 1.1],
  ['hunter', 'HUNTER_ITEYA', 'HUNTER_SAMIDARE', 'normal', 1.15],
  ['monk', 'MUSOUKEN', 'MONK_NEHAN', 'normal', 1.1],
  ['brigand', 'BRIGAND_HISAME', 'BRIGAND_SHIRANAMI', 'normal', 1.15],
  ['dragonknight', 'SHIELDBASH', 'TENSHOU', 'normal', 1.15],
  ['asura', 'DOUBLE', 'ASURA_SOUGA', 'normal', 1.1],
  ['samurai', 'SAMURAI_HAPPOU', 'SAMURAI_KOCHOU', 'normal', 1.2],
  ['thief', 'ASSASSINATE', 'SHIPPUTSUKI', 'normal', 1.09],
  ['thief', 'KAGEUCHI', 'RANBUTSUKI', 'normal', 1.1],
  ['thief', 'RANBUTSUKI', 'SHUNSATSU', 'phys75', 1.5],
  ['hunter', 'HUNTER_KEHAIYOMI', 'HUNTER_HAYATEYA', 'normal', 1.2],
  ['spellblade', 'DOUBLE', 'SPELLBLADE_KASANE', 'normal', 1.1],
  ['thief', 'SHUNSATSU', 'ZANKOU', 'normal', 1.1],
  ['thief', 'ZANKOU', 'MUGEN', 'normal', 1.1],
  ['samurai', 'ISSEN', 'TSUBAMEGAESHI', 'crit', 1.02],
  // 数値を維持する技も、得意な相手への用途を固定する。
  ['fighter', 'KYOUGEKI', 'SHINGANGEKI', 'fast', 1.1],
  ['berserker', 'BERSERKER_ABAREUCHI', 'SHINGANGEKI', 'fast', 1.02],
  ['battlemage', 'HALITO', 'BAKUENKEN', 'magic75', 2],
  ['battlemage', 'BATTLEMAGE_HIBASHIRA', 'BATTLEMAGE_BAKUENRANDA', 'magic75', 2],
  ['inquisitor', 'KAKEI', 'GURENZAN', 'magic75', 2],
  ['darkknight', 'ANKOKU', 'DARKBLAST', 'phys75', 1.3],
];
let checks = 0;
for (const [job, oldKey, newKey, profile, minRatio] of ROLES) {
  const learned = JOB_SKILLS[job].find(e => e.skill === newKey).lvl;
  let min = Infinity;
  for (const geared of [false, true]) for (const rank of [1, 2, 5]) for (const level of new Set([learned, Math.max(100, learned), 200])) {
    const rows = sample(job, level, rank, geared), x = rows.find(x => x.k === newKey), y = rows.find(x => x.k === oldKey);
    assert(x && y, `${job}/${level}: 比較する技を習得していない`);
    const ratio = x.values[profile] / y.values[profile];
    assert(ratio >= minRatio, `${job}/${level}/ランク${rank}/${geared ? '標準装備' : '裸'}/${profile}: ${newKey} ÷ ${oldKey} = ${ratio.toFixed(3)} < ${minRatio}`);
    min = Math.min(min, ratio);
    checks++;
  }
  console.log(`${SPELLS[newKey].name}: ${profile}で${SPELLS[oldKey].name}の最低${min.toFixed(2)}倍`);
}
console.log(`習得直後・Lv100/200、魂ランク1/2/5、裸/標準装備の用途比較 ${checks}条件を確認`);
