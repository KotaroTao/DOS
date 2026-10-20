// 現在の手番から3ターンの隊の与ダメを予測する。戦闘の複製だけを動かし、乱数・実行系・通知は使わない。
// 最初の一手を候補ごとに変え、以降は使える攻撃の期待値で継続する近似。未来の全行動を総当たりはしない。
import { SPELLS, soulPowerMul, isMetal } from "./combat.js";
import { autoSkills } from "./souls.js";
import { STAGED, STAGE_MAX, STRONG_MIN, effectStage, stageOf, stageMul } from "./buffstage.js";

export const AUTO_FORECAST_TURNS = 3;

function copyBattle(b) {
  const map = new Map();
  for (const a of [...b.party, ...b.enemies]) map.set(a, { ...a, buffs: { ...a.buffs }, effects: (a.effects || []).map(e => ({ ...e })) });
  const sim = Object.assign(Object.create(Object.getPrototypeOf(b)), b, {
    party: b.party.map(a => map.get(a)), enemies: b.enemies.map(a => map.get(a)), log: () => {},
  });
  return { sim, map };
}

// _applyMod の段・持続規則を読み取り用の複製へ反映する。実行系の通知フックを呼ばない。
function mod(b, source, t, stat, mult, duration) {
  if (!t?.alive || mult === 1 || (mult < 1 && isMetal(t))) return;
  let turns = Math.max(1, duration || 3);
  if (source.gearMisc?.timeKeeper && turns <= 49) turns++;
  if (STAGED.has(stat)) {
    const d = stageOf(mult);
    if (d < 0 && t.gearMisc?.steady) return;
    const strong = b._strongFoe(t);
    if (d < 0 && strong) turns = Math.max(2, turns - 1);
    const olds = t.effects.filter(e => e.stat === stat);
    const s0 = Math.max(-STAGE_MAX, Math.min(STAGE_MAX, olds.reduce((n, e) => n + effectStage(e), 0)));
    const t0 = olds.reduce((n, e) => Math.max(n, e.turns || 0), 0);
    let s1 = d > 0 ? Math.min(s0 + d, Math.max(STAGE_MAX, s0)) : Math.max(s0 + d, Math.min(strong ? STRONG_MIN : -STAGE_MAX, s0));
    const flipped = s1 <= -STAGE_MAX && s1 < s0 && t.gearMisc?.flip && !t._flipUsed;
    if (flipped) { s1 = STAGE_MAX; t._flipUsed = true; }
    t.effects = t.effects.filter(e => e.stat !== stat);
    if (s1) {
      const left = flipped ? Math.max(t0, turns) : Math.sign(s1) !== Math.sign(d) ? t0 : Math.sign(s0) === Math.sign(d) ? Math.max(t0, turns) : turns;
      t.effects.push({ stat, stage: s1, mult: stageMul(s1), turns: Math.max(1, left) });
    }
  } else {
    const same = t.effects.filter(e => e.stat === stat && (e.mult > 1) === (mult > 1));
    if (same.length >= 2) t.effects.splice(t.effects.indexOf(same[0]), 1);
    t.effects.push({ stat, mult, turns });
  }
  b._recalcBuffs(t);
}

// 乱撃は各対象への命中回数の分布で頭打ちを掛ける。平均ダメージだけで全滅させない。
function scatterDamage(per, count, targets, hp) {
  if (targets <= 1) return Math.min(hp, per * count);
  const p = 1 / targets;
  let probability = (1 - p) ** count, sum = 0;
  for (let hits = 1; hits <= count; hits++) {
    probability *= (count - hits + 1) / hits * p / (1 - p);
    sum += probability * Math.min(hp, per * hits);
  }
  return sum;
}

function damage(b, a, cmd, est) {
  const sp = cmd.spellKey ? SPELLS[cmd.spellKey] : null;
  const targets = cmd.target ? [cmd.target] : b.livingEnemies();
  return targets.filter(t => t.alive).map(t => {
    let d = 0;
    if (!sp) d = est.basic(b, a, t);
    else if (sp.kind === "phys") {
      const per = est.phys(b, a, t, { ...sp, power: sp.power * soulPowerMul(a, sp), skill: true });
      d = sp.scatter ? scatterDamage(per, sp.scatter, targets.length, t.hp) : per * (sp.hits || 1);
    } else if (sp.kind === "atk") d = est.spell(b, a, sp, t);
    d = Math.min(t.hp, Math.max(0, d));
    if (sp?.instakill && !t.boss && !isMetal(t) && (!sp.instakill.races || sp.instakill.races.includes(t.mon?.race))) {
      const rate = est.status(b, a, sp, t).find(r => r.kind === "death")?.rate || 0;
      d += (t.hp - d) * rate;
    }
    return { t, d };
  });
}

function attacks(b, a, profiles = null) {
  const out = b.attackableEnemies(a).map(target => ({ action: "attack", target }));
  if (a.tactic === "blade") return out;
  for (const key of autoSkills(a)) {
    if (profiles && !profiles.get(a.uid)?.has(key)) continue;
    const sp = SPELLS[key];
    if (!sp || !(sp.kind === "phys" || sp.kind === "atk" || sp.instakill) || a.mp < b.costOf(a, sp, key)) continue;
    if (sp.target !== "enemy" && sp.target !== "all-enemy") continue;
    const targets = sp.target === "all-enemy" || sp.scatter ? [null] : sp.kind === "phys" ? b.attackableEnemies(a) : b.livingEnemies();
    for (const target of targets) out.push({ action: "spell", spellKey: key, target });
  }
  return out;
}

// 続きの攻撃は物理/呪文×単体/全体ごとの上位2技と最安の技を残す。
// 最初の候補は全て比べるが、未来の分岐を広げ続けず端末の待ち時間を抑える。
function attackProfiles(b, est) {
  const profiles = new Map();
  for (const a of b.party) {
    const groups = new Map();
    for (const cmd of attacks(b, a)) {
      if (!cmd.spellKey) continue;
      const sp = SPELLS[cmd.spellKey], key = sp.kind + ":" + sp.target;
      const hits = damage(b, a, cmd, est);
      if (hits.every(h => est.low(h.d, h.t))) continue;
      const raw = hits.reduce((n, h) => n + h.d, 0), cost = b.costOf(a, sp, cmd.spellKey);
      const group = groups.get(key) || new Map();
      const row = { key: cmd.spellKey, value: raw - cost * est.price(a), cost };
      if (!group.has(row.key) || row.value > group.get(row.key).value) group.set(row.key, row);
      groups.set(key, group);
    }
    const keys = new Set();
    for (const group of groups.values()) {
      const rows = [...group.values()].sort((x, y) => y.value - x.value || x.cost - y.cost);
      for (const row of rows.slice(0, 2)) keys.add(row.key);
      rows.sort((x, y) => x.cost - y.cost || y.value - x.value);
      if (rows.length) keys.add(rows[0].key);
    }
    profiles.set(a.uid, keys);
  }
  return profiles;
}

function apply(b, a, cmd, est) {
  const sp = cmd.spellKey ? SPELLS[cmd.spellKey] : null;
  if (sp) a.mp -= b.costOf(a, sp, cmd.spellKey);
  let total = 0;
  if (!sp || sp.target === "enemy" || sp.target === "all-enemy") {
    for (const { t, d } of damage(b, a, cmd, est)) {
      total += d; t.hp = Math.max(0, t.hp - d);
      if (t.hp <= 1e-8) { t.hp = 0; t.alive = false; continue; }
      if (sp && !(sp.kind === "phys" && t.physResist >= 100) && !(sp.kind === "atk" && t.magResist >= 100)) {
        if (sp.kind !== "phys") for (const k in sp.debuff) mod(b, a, t, k, sp.debuff[k], sp.dur);
        for (const el in sp.vuln) mod(b, a, t, "r_" + el, sp.vuln[el], sp.dur);
        if (sp.strip) { t.effects = t.effects.filter(e => e.mult <= 1); b._recalcBuffs(t); }
      }
      if (d > 0) t.asleep = false;
    }
    if ((!sp || sp.kind === "phys") && a.effects.some(e => e.stat === "charge")) {
      a.effects = a.effects.filter(e => e.stat !== "charge"); b._recalcBuffs(a);
    }
  }
  if (sp) {
    const allies = sp.target === "all-ally" ? b.livingParty() : sp.target === "self" ? [a] : sp.target === "ally" ? [cmd.target || a] : [];
    for (const t of allies) {
      for (const k in sp.buff) mod(b, a, t, k, sp.buff[k], sp.dur);
      if (sp.charge) { t.effects = t.effects.filter(e => e.stat !== "charge"); mod(b, a, t, "charge", sp.charge, sp.dur); }
    }
    for (const t of b.livingEnemies()) for (const k in sp.debuffAll) mod(b, a, t, k, sp.debuffAll[k], sp.dur);
  }
  a._actedRound = b._roundNo;
  return total;
}

function rollout(b, actor, first, est) {
  const { sim, map } = copyBattle(b), a = map.get(actor);
  const command = { ...first, target: map.get(first.target) || null };
  let total = first.action === "defend" ? 0 : apply(sim, a, command, est);
  // 既に動いた味方へ、今のターンの行動をもう一度与えない。
  let order = b.current === actor ? b.queue.filter(p => p.side === "party" && p !== actor).map(p => map.get(p))
    : sim.party.filter(p => p !== a && p._actedRound !== b._roundNo);
  for (let round = 0; round < AUTO_FORECAST_TURNS; round++) {
    if (round) {
      sim._roundNo++;
      sim._tickEffects();
      for (const p of sim.party) p._actedRound = -1;
      order = sim.party.slice().sort((x, y) => y.agi * sim._bm(y, "agi") - x.agi * sim._bm(x, "agi"));
    }
    for (const p of order) {
      if (!p?.alive || p.asleep || p.ailment === "stone" || p.ailment === "paralyze" || p.mind === "charm") continue;
      if (!sim.livingEnemies().length) return total;
      let best = null, value = 0;
      for (const cmd of attacks(sim, p, est.profiles)) {
        const hits = damage(sim, p, cmd, est), raw = hits.reduce((s, h) => s + h.d, 0);
        // MPを使ってもほぼ削れない手は、続きの予測でも使わない。
        if (cmd.spellKey && hits.every(h => est.low(h.d, h.t))) continue;
        const cost = cmd.spellKey ? sim.costOf(p, SPELLS[cmd.spellKey], cmd.spellKey) : 0;
        const v = raw - cost * est.price(p);
        if (v > value + 1e-8) { best = cmd; value = v; }
      }
      if (best) total += apply(sim, p, best, est);
    }
  }
  return total;
}

export function forecastCandidates(b, actor, candidates, est) {
  est.profiles = attackProfiles(b, est);
  const baseline = rollout(b, actor, { action: "defend" }, est);
  for (const c of candidates) {
    c.damage3 = rollout(b, actor, c, est);
    c.damageGain3 = c.damage3 - baseline;
  }
}
