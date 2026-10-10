// 全職の総合評価 (攻め・守り・回復・MPのもち・魂の重ねやすさ)。
// 同じだけ遊んだ時点 (同じLv) で、レア度ごとに見込める魂の数 (重ね数 → ランク・能力の伸び) を入れた人業を作り、
// 5人の基準の隊に1人加えて「休まずに戦い続けて何戦もつか」を測る。戦闘の合間には、迷宮の「全員を回復」と同じく
// 回復・蘇生・治療の術でMPを使って立て直し、勝利後のパッシブも入れる (攻めだけでなく守り・回復・MPのもちも点に出る)。
//
// node tools/balance/jobs.mjs [--levels 25,45,65,85,130,200] [--seeds 8] [--seed-base 12345] [--jobs a,b] [--soul-rate 16] [--mode effort|rank2]
//                            [--enemies real|synth] [--naked] [--k-from 基準.json] [--out file.json]
//   乱数のばらつきが大きいので、判断は --seed-base を変えた4回 (計32通り) の平均で行う (docs/combat-balance.md「全職の見直し」)
//   --mode effort (既定): 魂の数 = 1 + そのLvまでの遊んだ時間 × 魂の入手/時 × レア度の割合 ÷ そのレア度の職の数
//   --mode rank2: 全職を魂ランク2にそろえる (重ねやすさを無視した、魂1つの格の比較)
import fs from "node:fs";
import assert from "node:assert/strict";
import { spawnCardEnemies, spawnBossEnemies, spawnEliteEnemies, Battle, SPELLS, spellCost, setElemKnown, cureAil, ailing, perkVictory, healsHp, canSpellCure } from "../../src/combat.js";
import { decideAuto, setResistKnown } from "../../src/autotactics.js";
import { SOUL_CLASSES, SOUL_KEYS, makeDoll, makeSoulInstance, setSharedSouls, recalcDoll, rankThresholds, soulLevelCap, soulRankFromCount, JOB_GEAR } from "../../src/souls.js";
import { minutesToLevel, partyAgi } from "../../src/levelcurve.js";
import { MONSTERS } from "../../src/sprites.js";
import { DUNGEON_MONSTERS } from "../../src/dungeons/index.js";
import { monsterResists } from "../../src/resistance.js";
import { CATALOG_ITEMS } from "../../src/catalog/index.js";
import { planBestEquip, applyPlan } from "../../src/autoequip.js";
import { gearScore } from "../../src/ui/itemview.js";
import { lootBand, WORLD, strengthAt, poolAt } from "../../src/dungeons/world.js";
Object.assign(MONSTERS, DUNGEON_MONSTERS);
// game.js の読み込み時と同じ下ごしらえ: 種族の特殊能力 (RACE_ABILITY) と抵抗値
{
  const RACE_ABILITY = { amorph: "poison", plant: "poison", insect: "paralyze", reptile: "poison", undead: "drain", specter: "soulSteal", demon: "critical", dragon: "breath", humanoid: "goldSteal", giant: "critical" };
  for (const m of Object.values(MONSTERS)) {
    if (m.ability === undefined) {
      let ab = RACE_ABILITY[m.race] || null;
      if (m.race === "reptile" && (m.rank || 1) >= 6) ab = "stone";
      const minRank = (ab === "drain" || ab === "critical" || ab === "soulSteal" || ab === "stone") ? 4 : 2;
      if (ab && (m.rank || 1) < minRank) ab = null;
      if (m.boss && !ab) ab = m.race === "dragon" ? "breath" : (m.rank || 1) >= 5 ? "critical" : "paralyze";
      m.ability = ab;
    }
    if (!m.resists) m.resists = monsterResists(m);
  }
}
setElemKnown(null);
// 試しの調整: TUNE='{"hunter":{"atk":1.1}}' で能力の基礎値を倍率で変えて測る (ファイルは書き換えない)
if (process.env.TUNE) for (const [job, m] of Object.entries(JSON.parse(process.env.TUNE))) for (const [k, v] of Object.entries(m)) SOUL_CLASSES[job].stat[k] = Math.round(SOUL_CLASSES[job].stat[k] * v * 100) / 100;
setResistKnown(() => true);

const args = process.argv.slice(2);
const arg = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const LEVELS = arg("--levels", "25,45,65,85,130,200").split(",").map(Number);
const SEEDS = Number(arg("--seeds", "8"));
const SEED_BASE = Number(arg("--seed-base", "12345"));
const MODE = arg("--mode", "effort");
const SOUL_RATE = Number(arg("--soul-rate", "16")); // 職業の魂の入手/時 (死体・出来事・依頼の見込み。テスト記録の sl で直す)
const JOBS = arg("--jobs", null)?.split(",") || SOUL_KEYS.filter((k) => SOUL_CLASSES[k].rarity !== "unique");
const NAKED = args.includes("--naked"); // 装備なしで比べる
const GAUNTLET = 12;
const SYNTH = arg("--enemies", "real") === "synth"; // synth = 能力から作る合成の敵 (旧来) // 休まずに戦う数 (主の戦いを4戦ごとに挟む)

let rng = 1;
const seed = (s) => { rng = s >>> 0; };
Math.random = () => { rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0; return rng / 4294967296; };

// rollJobClass の割合 (70/20/9/1) をそのレア度の職の数で割った、1職あたりの魂の割合
const RARITY_SHARE = { common: 0.70, rare: 0.20, epic: 0.09, legend: 0.01 };
const poolSize = (r) => SOUL_KEYS.filter((k) => SOUL_CLASSES[k].rarity === r).length;
export function soulCountAt(job, level) {
  const r = SOUL_CLASSES[job].rarity;
  if (MODE === "rank2") return rankThresholds(r)[1];
  const drops = (minutesToLevel(level) / 60) * SOUL_RATE;
  return Math.max(1, Math.round(1 + (drops * RARITY_SHARE[r]) / poolSize(r)));
}
// 装備: その Lv の迷宮で落ちる帯 (lootBand) の中ほどまでの、ランク別標準装備 (コモン・アンコモン) から
// ゲームの「最適装備」(autoequip.js + itemview.js の gearScore = 職ごとの重み) で選ぶ。裸のままだと武器の分 (攻撃力が2〜3倍) だけ物理職が不利に出る
const STD_GEAR = Object.values(CATALOG_ITEMS).filter((it) => /_r\d+_/.test(it.id) && it.slot && it.slot !== "misc" && it.slot !== "use");
const GEAR_CACHE = new Map();
function gearFor(d, job, level) {
  const key = job + "@" + level;
  if (!GEAR_CACHE.has(key)) {
    const [lo, hi] = lootBand(level, level);
    const ilv = Math.min(200, Math.round((lo + Math.min(hi, 200)) / 2));
    d.items = STD_GEAR.filter((it) => it.lv <= ilv && it.lv > ilv - 15).map((it, i) => ({ ...it, uid: 900000 + i }));
    applyPlan(planBestEquip([d], { maxItems: 999, score: gearScore })); // 隊の「最適装備」と同じ物差し
    d.items = [];
    GEAR_CACHE.set(key, { ...d.equip });
    if (process.env.SHOW_GEAR) console.log(key, Object.values(d.equip).filter(Boolean).map((it) => it.name).join(" "));
  }
  return { ...GEAR_CACHE.get(key) };
}
function doll(job, level) {
  const count = soulCountAt(job, level);
  const s = makeSoulInstance(job, count, level);
  s.capBonus = Math.max(0, level - soulLevelCap(job, count)); // 残火で上限を延ばした条件
  setSharedSouls([s]);
  const d = makeDoll(SOUL_CLASSES[job].label); d.primary = s.uid; recalcDoll(d);
  if (!NAKED) { d.equip = gearFor(d, job, level); recalcDoll(d); }
  d.hp = d.maxhp; d.mp = d.maxmp; d.tactic = "bal";
  return d;
}
const isCaster = (job) => { const s = SOUL_CLASSES[job].stat; return s.atk < Math.max(s.int, s.pie); };

// 基準の隊 (5人)。職の重なりのない2組: A = コモンの整った隊 (盾・回復あり) / B = レアの攻めの隊 (盾も回復役もいない)。
// 測る職が入っている組では測らない (入れ替えると、入れ替えた職の値打ちを測ってしまう)。点は組ごとの中央値で割ってから平均する
const BASES = {
  A: { front: ["knight", "fighter", "thief"], back: ["priest", "mage"] },
  B: { front: ["samurai", "brigand", "berserker"], back: ["hunter", "hexer"] },
};
const inBase = (base, job) => BASES[base].front.includes(job) || BASES[base].back.includes(job);
// 隊列: 術者と弓 (後衛から届く) は後衛、ほかは前衛の先頭
const backRow = (d) => isCaster(d.jobKey) || (d.equip && d.equip.weapon && d.equip.weapon.cat === "bw");
function partyFor(base, subject, level) {
  const b = BASES[base];
  const subj = subject ? doll(subject, level) : null;
  const mates = [...b.front, ...b.back].map((k) => doll(k, level));
  const front = mates.filter((d) => !backRow(d)), back = mates.filter(backRow);
  if (subj) (backRow(subj) ? back : front).unshift(subj);
  // 前衛が3人に満たなければ後衛の先頭から、多ければ前衛の末尾から詰め替える (前衛 = 先頭の3人)
  while (front.length < 3 && back.length) front.push(back.pop());
  const party = [...front, ...back];
  return { party, subject: subj };
}
// 難しさを合わせる基準の職 (どちらの組にも入っていない)
const REF_JOB = "paladin";

// 敵: 基準の戦士の能力に合わせた合成の敵。物理の群れ (毒・眠り持ち)・呪文の群れ・硬い精鋭・ブレスの主
function enemies(level, kind, ref, k) {
  const spec = {
    pack:  { n: 4, hp: 12, atk: 2.5, abil: [null, "poison", null, "sleep"] },
    magic: { n: 4, hp: 10, atk: 2.3, abil: ["spell", null, "spell", "paralyze"], magResist: 50 },
    armor: { n: 3, hp: 16, atk: 2.7, abil: [null, "critical", null], physResist: 75, elite: true },
    boss:  { n: 1, hp: 90, atk: 3.6, abil: ["breath"], boss: true },
  }[kind];
  return Array.from({ length: spec.n }, (_, i) => {
    const hp = Math.round(ref.atk * spec.hp * k);
    const mon = { race: "humanoid", elite: !!spec.elite, boss: !!spec.boss };
    return {
      uid: 100000 + i, key: "balance", name: "検証の敵" + i, side: "enemy", alive: true, hp, maxhp: hp,
      atk: Math.round(ref.atk * spec.atk * k), vit: Math.round(ref.atk * 0.7), agi: Math.max(6, Math.round(ref.agi * 0.3)),
      int: Math.round(ref.atk * 0.9 * k), pie: ref.pie, luk: 8, lv: level, element: "none",
      physResist: spec.physResist || 0, magResist: spec.magResist || 0, ability: spec.abil[i % spec.abil.length],
      resists: monsterResists({ rank: Math.min(10, Math.ceil(level / 20)), race: "humanoid", boss: !!spec.boss, elite: !!spec.elite }),
      boss: !!spec.boss, elite: !!spec.elite, mon,
    };
  });
}
const KINDS = ["pack", "magic", "armor", "boss"];

// 本物の魔物: その Lv が推奨Lv に入る本筋の迷宮 (無ければ最後の迷宮を推奨Lv だけ延ばす) の、その階の出現表から。
// 強さは game.js と同じ = 強さの素 × 推奨Lv の伸び (strengthAt) × 迷宮の手直し (tune)。k は難しさ合わせの倍率
const MAIN = WORLD.filter((d) => !d.side && !d.challenge).sort((a, b) => a.lv - b.lv);
function siteAt(level) {
  let cfg = MAIN.find((d) => d.lv <= level && level <= d.lvTo) || MAIN.find((d) => d.lv >= level);
  if (!cfg) { const last = MAIN[MAIN.length - 1]; cfg = { ...last, lv: level, lvTo: level }; }
  const floor = cfg.lvTo > cfg.lv ? Math.max(1, Math.min(cfg.floors, Math.round(1 + (level - cfg.lv) / (cfg.lvTo - cfg.lv) * (cfg.floors - 1)))) : cfg.floors;
  const t = cfg.tune || {};
  const deep = floor > cfg.floors / 2;
  const base = strengthAt(cfg, floor);
  const pool = poolAt(cfg, floor).filter((k) => MONSTERS[k]);
  const spds = [...new Set([...(cfg.pool || []), ...(cfg.deepPool || [])])].map((k) => MONSTERS[k] && MONSTERS[k].spd).filter((v) => v > 0).sort((a, b) => a - b);
  const fleeK = partyAgi(level) / Math.max(1, spds[spds.length >> 1] || 6);
  return { cfg, floor, pool, fleeK, base, mob: base * (t.enemyMul || 1) * (deep ? (t.deepMul || 1) : 1), solo: base * (t.soloMul || 1), boss: base * (t.bossMul || 1), bossHpMul: t.bossHpMul || 1 };
}
function realFoes(level, kind, site, k) {
  let list;
  if (kind === "boss" && site.cfg.boss) {
    list = spawnBossEnemies(site.cfg.boss, site.boss * k, site.cfg.bossRank || 0);
    for (const e of list) { e.maxhp = e.hp = Math.round(e.hp * site.bossHpMul); }
  } else if (kind === "boss" || kind === "elite") {
    const el = site.cfg.elites || [];
    list = el.length ? spawnEliteEnemies(el[Math.floor(Math.random() * el.length)], site.solo * k) : spawnCardEnemies(site.pool[0], site.floor, site.mob * k, { min: 4 });
  } else list = spawnCardEnemies(site.pool[Math.floor(Math.random() * site.pool.length)], site.floor, site.mob * k);
  list.forEach((e, i) => { e.lv = level; e.uid = 100000 + i; });
  return list;
}

// 戦闘の合間の立て直し (迷宮の「全員を回復」を簡略化): 蘇生 → 治療 → HP の低い者から MP 効率のよい回復
function camp(b, party, stat) {
  const spellsOf = (p) => (p.alive && !ailing(p) ? (p.spells || []).map((k) => [k, SPELLS[k]]).filter(([, sp]) => sp && !sp.mpPct) : []);
  const cost = (p, sp) => spellCost(p, sp);
  for (const t of party.filter((x) => !x.alive)) {
    let best = null;
    for (const p of party) for (const [k, sp] of spellsOf(p)) {
      if (!sp.revive || cost(p, sp) > p.mp) continue;
      const c = cost(p, sp) / (sp.target === "all-ally" ? Math.max(1, party.filter((x) => !x.alive).length) : 1);
      if (!best || c < best.c) best = { p, sp, c: c, raw: cost(p, sp) };
    }
    if (!best) break;
    best.p.mp -= best.raw;
    const hit = best.sp.target === "all-ally" ? party.filter((x) => !x.alive) : [t];
    for (const x of hit) { x.alive = true; x.hp = Math.max(1, Math.round(x.maxhp * (best.sp.revivePct || 0.5))); }
    stat.campMp += best.raw;
  }
  for (const t of party.filter((x) => x.alive && x.ailment)) {
    for (const p of party) {
      const hit = spellsOf(p).find(([, sp]) => canSpellCure(sp, t) && cost(p, sp) <= p.mp);
      if (hit) { p.mp -= cost(p, hit[1]); cureAil(t); stat.campMp += cost(p, hit[1]); break; }
    }
  }
  for (let g = 0; g < 40; g++) {
    const hurt = party.filter((x) => x.alive && x.hp < x.maxhp * 0.85);
    if (!hurt.length) break;
    const t = hurt.sort((x, y) => x.hp / x.maxhp - y.hp / y.maxhp)[0];
    let best = null;
    for (const p of party) for (const [, sp] of spellsOf(p)) {
      if (!healsHp(sp) || sp.target === "enemy" || sp.target === "all-enemy" || cost(p, sp) > p.mp || (p.mp - cost(p, sp)) < p.maxmp * 0.25) continue;
      const tg = sp.target === "all-ally" ? party.filter((x) => x.alive) : sp.target === "self" ? [p] : [t];
      if (!tg.includes(t) && sp.target !== "all-ally") continue;
      const gain = tg.reduce((s, x) => s + Math.min(x.maxhp - x.hp, b.estHeal(p, sp, x)), 0);
      const v = gain / Math.max(1, cost(p, sp));
      if (gain > 0 && (!best || v > best.v)) best = { p, sp, tg, v };
    }
    if (!best) break;
    const c = cost(best.p, best.sp); best.p.mp -= c; stat.campMp += c;
    for (const x of best.tg) { const h = Math.min(x.maxhp - x.hp, Math.round(b.estHeal(best.p, best.sp, x))); x.hp += h; if (best.p === stat.who) stat.heal += h; }
  }
}
// 勝利後のパッシブ (game.js applyVictoryPassives の HP・MP の分)
function victory(party) {
  const HEAL_PCT = [0, 0.05, 0.10, 0.20, 0.30];
  const lv = (p, k) => (p.passiveMap && p.passiveMap[k]) || 0;
  let pope = 0;
  for (const p of party) if (p.alive && lv(p, "popePrayer")) pope = Math.max(pope, lv(p, "afterHeal"));
  for (const p of party) {
    if (!p.alive) continue;
    const ml = lv(p, "afterMp");
    const pw = perkVictory(p, party, { afterMp: ml >= 2 ? 0.02 : ml === 1 ? 0.01 : 0 });
    const hp = HEAL_PCT[Math.max(lv(p, "afterHeal"), pope)] + pw.hp;
    if (hp > 0) p.hp = Math.min(p.maxhp, p.hp + Math.ceil(p.maxhp * hp));
    if (pw.mp > 0) p.mp = Math.min(p.maxmp, p.mp + Math.ceil(p.maxmp * pw.mp));
  }
}

function fight(party, foes, level, stat, fleeK) {
  const b = new Battle(party, foes, () => {}, { foeLv: level, fleeK, baseAgi: partyAgi(level) });
  const hp0 = foes.reduce((s, e) => s + e.maxhp, 0);
  const subj = stat.who;
  let turns = 0;
  b.advance();
  while (!b.result && turns++ < 800 && b._roundNo <= 30) {
    let res;
    if (b.phase === "input") {
      const a = b.current, c = decideAuto(b, a), mp0 = a.mp;
      const r = b.chooseAction(c.action, c.spellKey);
      assert(!r.invalid, `invalid ${a.jobKey} ${JSON.stringify(c)}`);
      if (r.needTarget) b.chooseTarget(c.target);
      res = b.commit();
      if (a === subj) { stat.mp += Math.max(0, mp0 - a.mp); const key = c.spellKey || c.action; stat.choices[key] = (stat.choices[key] || 0) + 1; }
    } else if (b.phase === "enemy") res = b.enemyAct();
    else if (b.phase === "stunned") res = b.stunnedAct();
    else throw new Error("phase " + b.phase);
    for (const h of res?.hits || []) {
      if (res.actor === subj && h.target?.side === "enemy") stat.dmg += h.dmg || 0;
      if (res.actor === subj && h.target?.side === "party") stat.heal += h.heal || 0;
      if (h.target === subj && res.actor?.side === "enemy") stat.taken += h.dmg || 0;
    }
    if (!b.result) b.advance();
  }
  stat.rounds += b._roundNo;
  const left = foes.reduce((s, e) => s + (e.alive ? Math.max(0, e.hp) : 0), 0);
  // 戦闘中の強化・状態を持ち越さない (HP・MP・死亡・状態異常の毒/麻痺/石化は持ち越す)
  for (const p of party) { p.asleep = false; p.mind = null; }
  return { win: b.result === "win", part: 1 - left / hp0 };
}

// 難しさ: 基準の隊 (A + 戦士) が12戦のうち半ばまで進む強さに合わせる (Lvごとに一度だけ探す)
const KCACHE = {};
// 試しの調整では、基準の測定で決めた難しさ (k) をそのまま使う (基準の職を調整しても難しさが動かないように)
if (arg("--k-from", null)) Object.assign(KCACHE, JSON.parse(fs.readFileSync(arg("--k-from"), "utf8")).k || {});
function gauntlet(base, job, level, runSeed, k) {
  seed(runSeed);
  const { party, subject } = partyFor(base, job, level);
  const ref = doll("fighter", level);
  const site = SYNTH ? null : siteAt(level);
  const stat = { who: subject || {}, choices: {}, dmg: 0, heal: 0, taken: 0, mp: 0, campMp: 0, rounds: 0, deaths: 0, won: 0 };
  let score = 0;
  for (let i = 0; i < GAUNTLET; i++) {
    const kind = SYNTH ? ((i + 1) % 4 === 0 ? "boss" : KINDS[i % 3]) : (i === GAUNTLET - 1 ? "boss" : (i + 1) % 4 === 0 ? "elite" : "mob");
    const wasAlive = subject ? subject.alive : false;
    const foes = SYNTH ? enemies(level, kind, ref, k) : realFoes(level, kind, site, k);
    const r = fight(party, foes, level, stat, SYNTH ? 1 / 0.3 : site.fleeK);
    if (wasAlive && !subject.alive) stat.deaths++;
    if (!r.win) { score += r.part; break; }
    score += 1; stat.won++;
    victory(party);
    camp(new Battle(party, [], () => {}, {}), party, stat);
  }
  return { score, ...stat, who: undefined };
}
// 組ごとに合わせる (強い組が12戦を勝ち切ってしまうと差が出ない)
function difficulty(base, level) {
  const key = base + "@" + level;
  if (KCACHE[key]) return KCACHE[key];
  let lo = 0.2, hi = 60;
  for (let it = 0; it < 14; it++) {
    const mid = Math.sqrt(lo * hi);
    let s = 0;
    for (let i = 0; i < 4; i++) s += gauntlet(base, REF_JOB, level, 777 + i, mid).score;
    if (s / 4 > GAUNTLET * 0.5) lo = mid; else hi = mid;
  }
  return (KCACHE[key] = Math.sqrt(lo * hi));
}

if (process.env.PROBE) {
  for (const L of LEVELS) {
    const site = siteAt(L);
    const foes = realFoes(L, "mob", site, 1);
    const kn = doll("knight", L), ma = doll("mage", L), gu = doll("guardian", L);
    console.log(`Lv${L} ${site.cfg.id}F${site.floor} 敵`, foes.map((e) => `${e.name} atk${e.atk} vit${e.vit} hp${e.maxhp}`).join(" / "));
    for (const d of [kn, gu, ma]) console.log("  ", d.jobKey, "hp", d.maxhp, "vit", d.vit, "atk", d.atk, "power", d.power, "int", d.int);
  }
  process.exit(0);
}
const rows = [];
for (const level of LEVELS) {
  for (const job of JOBS) {
    const agg = { job, label: SOUL_CLASSES[job].label, rarity: SOUL_CLASSES[job].rarity, level, count: soulCountAt(job, level), rank: soulRankFromCount(job, soulCountAt(job, level)) };
    for (const base of Object.keys(BASES)) {
      if (inBase(base, job)) continue;
      const rs = [];
      for (let i = 0; i < SEEDS; i++) rs.push(gauntlet(base, job, level, SEED_BASE + i * 7919, difficulty(base, level)));
      const avg = (f) => rs.reduce((s, r) => s + f(r), 0) / rs.length;
      agg[base] = { choices: rs.reduce((m, r) => { for (const [k, v] of Object.entries(r.choices)) m[k] = (m[k] || 0) + v; return m; }, {}), score: avg((r) => r.score), dmg: avg((r) => r.dmg / Math.max(1, r.rounds)), heal: avg((r) => r.heal / Math.max(1, r.won + 1)), taken: avg((r) => r.taken / Math.max(1, r.rounds)), deaths: avg((r) => r.deaths) };
    }
    rows.push(agg);
  }
}
// 5人だけ (6人目なし) の戦数。貢献 = (6人目を入れた戦数 − 5人だけ) ÷ (中央値の職の戦数 − 5人だけ)
const EMPTY = {};
for (const L of LEVELS) for (const base of Object.keys(BASES)) {
  let s = 0;
  for (let i = 0; i < SEEDS; i++) s += gauntlet(base, null, L, SEED_BASE + i * 7919, difficulty(base, L)).score;
  EMPTY[base + "@" + L] = s / SEEDS;
}
// 組ごとの中央値で割って平均 (rel)
for (const L of LEVELS) for (const base of Object.keys(BASES)) {
  const v = rows.filter((r) => r.level === L && r[base]).map((r) => r[base].score).sort((a, b) => a - b);
  const med = v[v.length >> 1];
  const e0 = EMPTY[base + "@" + L];
  for (const r of rows.filter((r) => r.level === L && r[base])) { r[base].rel = r[base].score / med; r[base].con = (r[base].score - e0) / Math.max(0.05, med - e0); }
}
for (const r of rows) { const bs = Object.keys(BASES).filter((b) => r[b]); r.rel = bs.reduce((s, b) => s + r[b].rel, 0) / bs.length; r.con = bs.reduce((s, b) => s + r[b].con, 0) / bs.length; }
console.log("難しさ合わせの倍率 k (1 = ゲームの強さのまま):", Object.entries(KCACHE).map(([key, k]) => `${key} ${k.toFixed(2)}`).join(" "));
const out = arg("--out", null);
if (out) fs.writeFileSync(out, JSON.stringify({ mode: MODE, soulRate: SOUL_RATE, levels: LEVELS, k: KCACHE, empty: EMPTY, rows }));
const pad = (s, n) => String(s).padEnd(n, "　");
// 平均は Lv の重み付き (いまの物語は Lv100 手前まで。Lv130・200 は迷宮を延ばした仮の敵なので軽く)
const LV_W = (L) => (L <= 25 ? 0.5 : L <= 100 ? 1 : L <= 150 ? 0.5 : 0.25);
const TARGET = { common: 0.95, rare: 1.0, epic: 1.05, legend: 1.15 }; // 手に入りにくく重ねにくい魂ほど少し強い
console.log(`mode=${MODE} 魂/時=${SOUL_RATE} 休まず${GAUNTLET}戦 (A=コモンの整った隊 B=レアの攻めの隊)。値 = もった戦数の、組ごとの中央値との比`);
const avgOf = (job) => { let t = 0, w = 0; for (const L of LEVELS) { const r = rows.find((x) => x.job === job && x.level === L); t += r.rel * LV_W(L); w += LV_W(L); } return t / w; };
for (const job of JOBS) {
  const rs = LEVELS.map((L) => rows.find((r) => r.job === job && r.level === L));
  const a = avgOf(job);
  console.log(pad(rs[0].label, 6), rs[0].rarity.padEnd(7), `平均 ${a.toFixed(2)} (目標との差 ${(a - TARGET[rs[0].rarity] >= 0 ? "+" : "") + (a - TARGET[rs[0].rarity]).toFixed(2)})`, "|", rs.map((r) => `${r.rel.toFixed(2)}(R${r.rank}×${r.count})`).join(" "));
}
for (const r of Object.keys(TARGET)) {
  const v = JOBS.filter((j) => SOUL_CLASSES[j].rarity === r).map(avgOf);
  if (v.length) console.log(`${r}: 平均 ${(v.reduce((a, b) => a + b, 0) / v.length).toFixed(3)} (目標 ${TARGET[r]}) 幅 ${Math.min(...v).toFixed(2)}〜${Math.max(...v).toFixed(2)}`);
}
