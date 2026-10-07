import { monsterResists } from "../../src/resistance.js";
// 全36職の比較用。裸・同じ魂ランク・サブ魂なしで、攻撃指標と6人隊の模擬戦を測る。
// node tools/balance/run.mjs --out /tmp/balance.json [--sim] [--seeds 2] [--levels 20,40,80,120,200]
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { Battle, SPELLS, spellCost, setElemKnown } from '../../src/combat.js';
import { decideAuto, TACTICS, setResistKnown } from '../../src/autotactics.js';
import { SOUL_CLASSES, SOUL_KEYS, makeDoll, makeSoulInstance, setSharedSouls, recalcDoll, rankThresholds, soulLevelCap, JOB_GEAR } from '../../src/souls.js';
import { MONSTERS } from '../../src/sprites.js';
import { DUNGEON_MONSTERS } from '../../src/dungeons/index.js';
Object.assign(MONSTERS, DUNGEON_MONSTERS);
setElemKnown(null);
setResistKnown(() => true);
const args = process.argv.slice(2);
const arg = (key, fallback) => args.includes(key) ? args[args.indexOf(key) + 1] : fallback;
const levels = arg('--levels', '20,40,80,120,200').split(',').map(Number);
const seeds = Number(arg('--seeds', '2'));
const ranks = arg('--ranks', '2').split(',').map(Number);
assert(ranks.every(r=>Number.isInteger(r)&&r>=1&&r<=5),'魂ランクは1〜5');
let rng = 1;
const seed = (s) => { rng = s >>> 0; };
Math.random = () => { rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0; return rng / 4294967296; };
function doll(job, level, rank = 2) {
  const count = rankThresholds(SOUL_CLASSES[job].rarity)[rank - 1];
  const s = makeSoulInstance(job, count, level);
  // 残火で上限を延ばした条件。融合数を増やして比較条件を変えない。
  s.capBonus = Math.max(0, level - soulLevelCap(job, count));
  setSharedSouls([s]);
  const d = makeDoll(SOUL_CLASSES[job].label); d.primary = s.uid; recalcDoll(d);
  d.hp = d.maxhp; d.mp = d.maxmp;
  return d;
}
function enemies(level, scenario, reference) {
  const count = scenario === 'boss' ? 1 : 4;
  return Array.from({ length: count }, (_, i) => ({
    uid: 100000 + i, key: 'balance', name: '検証の敵' + i, side: 'enemy', alive: true,
    hp: Math.round(reference.atk * (scenario === 'boss' ? 100 : 12)),
    maxhp: Math.round(reference.atk * (scenario === 'boss' ? 100 : 12)),
    atk: Math.round(reference.atk * (scenario === 'boss' ? 4 : 2.5)), vit: Math.round(reference.atk * 0.7),
    agi: Math.max(6, Math.round(reference.agi * 0.3)), int: reference.int, pie: reference.pie, luk: 8,
    lv: level, element: 'none', physResist: scenario === 'armor' ? 75 : 0,
    magResist: scenario === 'magic' ? 75 : 0,
    resists: monsterResists({ rank: Math.min(10, Math.ceil(level / 20)), race: 'humanoid', boss: scenario === 'boss', elite: scenario === 'armor' }),
    boss: scenario === 'boss', elite: scenario === 'armor',
    ability: scenario === 'magic' ? 'spell' : null,
    mon: { race: 'humanoid', elite: scenario === 'armor', boss: scenario === 'boss' },
  }));
}
const scenarios = ['normal', 'armor', 'magic', 'boss'];
function audit(job, level, rank = 2) {
  const a = doll(job, level, rank), ref = doll('fighter', level, rank);
  const out = { job, label: SOUL_CLASSES[job].label, rarity: SOUL_CLASSES[job].rarity, level, rank,
    stats: { atk:a.atk, int:a.int, pie:a.pie, luk:a.luk, agi:a.agi, maxmp:a.maxmp, maxhp:a.maxhp }, scenarios:{} };
  for (const scenario of scenarios) {
    const t = enemies(level, scenario, ref)[0];
    const b = new Battle([a], [t], () => {}, { foeLv:level, fleeK: 1 / 0.3 });
    const basic = b.estPhys(a, t, {basic:true});
    const attacks = [];
    for (const key of a.spells) {
      const sp = SPELLS[key]; if (!sp || !['phys','atk'].includes(sp.kind)) continue;
      let damage = sp.kind === 'phys' ? b.estPhys(a,t,{...sp,skill:true}) * (sp.hits || sp.scatter || 1) : b.estSpell(a,sp,t);
      const cost = spellCost(a,sp);
      assert(Number.isFinite(damage), `${job}:${key}`);
      attacks.push({ key, name:sp.name, target:sp.target, damage, cost, efficiency:damage/Math.max(1,cost), basicRatio:damage/Math.max(1,basic), casts:Math.floor(a.maxmp/Math.max(1,cost)) });
    }
    attacks.sort((a,b)=>b.damage-a.damage);
    out.scenarios[scenario] = {basic, attacks};
  }
  return out;
}
function simulate(job, level, tactic, scenario, runSeed) {
  seed(runSeed);
  const reference = doll('fighter',level);
  const caster = SOUL_CLASSES[job].stat.atk < Math.max(SOUL_CLASSES[job].stat.int, SOUL_CLASSES[job].stat.pie);
  const jobs = caster ? ['fighter','knight','samurai',job,'priest','mage'] : [job,'knight','fighter','priest','mage','thief'];
  const party = jobs.map(k=>doll(k,level));
  const subject = party[caster ? 3 : 0];
  // 裸の比較でも遠隔職は正しい射程で戦わせる。ステータス補正は付けない。
  for (const d of party) {
    d.tactic = d===subject ? tactic : 'bal';
    const range = JOB_GEAR[d.jobKey]?.weapons?.includes('bw') ? 'long' : 'near';
    if (range==='long') d.equip.weapon={slot:'weapon',cat:'bw',range};
  }
  const foes = enemies(level,scenario,reference);
  const b = new Battle(party,foes,()=>{}, {foeLv:level,fleeK:1/0.3});
  let turns=0, damage=0, healing=0, spent=0; const choices={};
  b.advance();
  while (!b.result && turns++<600 && b._roundNo<=30) {
    let res;
    if (b.phase==='input') {
      const a=b.current; const c=decideAuto(b,a); const before=a.mp;
      const r=b.chooseAction(c.action,c.spellKey);
      assert(!r.invalid,`${job}:${level}:${tactic}:${scenario} invalid ${JSON.stringify(c)}`);
      if(r.needTarget) { assert(b.targetOptions().includes(c.target),`${job} target ${c.spellKey}`);b.chooseTarget(c.target); }
      res=b.commit();
      if(a===subject) {spent+=Math.max(0,before-a.mp);const key=c.spellKey||c.action;choices[key]=(choices[key]||0)+1;}
    } else if(b.phase==='enemy') res=b.enemyAct();
    else if(b.phase==='stunned') res=b.stunnedAct();
    else throw new Error('phase '+b.phase);
    if(res?.actor===subject) for(const h of res.hits||[]){if(h.target?.side==='enemy')damage+=h.dmg||0;healing+=h.heal||0;}
    for(const a of [...b.party,...b.enemies]) assert(Number.isFinite(a.hp)&&Number.isFinite(a.mp??0),`${job} 非数値`);
    if(!b.result)b.advance();
  }
  return {job,level,tactic,scenario,seed:runSeed,result:b.result||'timeout',rounds:b._roundNo,damage,healing,spent,hp:party.reduce((s,a)=>s+Math.max(0,a.hp),0)/party.reduce((s,a)=>s+a.maxhp,0),choices};
}
const audits=[];
for(const rank of ranks)for(const level of levels)for(const job of SOUL_KEYS)audits.push(audit(job,level,rank));
const sims=[];
if(args.includes('--sim'))for(const level of levels)for(const job of SOUL_KEYS)for(const tactic of TACTICS)for(const scenario of scenarios)for(let i=0;i<seeds;i++)sims.push(simulate(job,level,tactic.key,scenario,12345+i));
const data={conditions:'裸・サブ魂なし・魂ランク2・残火でLv上限を拡張。職業のレア度差と融合補正は残す。模擬戦の隊構成は物理/術職で異なるため、勝率だけで全職を順位付けしない。',audits,sims};
const output=arg('--out','/tmp/dos-balance.json');fs.writeFileSync(output,JSON.stringify(data));
console.log(`${audits.length}職業条件・${sims.length}模擬戦を確認 → ${output}`);
