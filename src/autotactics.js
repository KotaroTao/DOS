// オート戦闘の作戦 (人業ごとの「命令」) と、手番ごとの一手の選び方。
// 操霊師が人業に授ける命令として 5 つの作戦を持ち、doll.tactic に保存する (既定は「機を見て戦え」)。
// オートで使う技は、戦闘の一覧に出していて「オート」を切っていない技だけ (souls.js autoSkills)。
//
// 選び方: 手番の者が取れる手 (通常攻撃 × 狙い / 使える技 × 狙い / 防御) をすべて並べ、
// それぞれの「値打ち」を「隊が受けずに済む傷 (HP)」に換算して比べる。値打ち = 与ダメ (敵の残りHPで頭打ち) × dmgK
// + 倒した敵の脅威 + 癒し (傷の深さで重み) + 蘇生 + 治療 + 強化・弱体・状態異常 (戦いの残りの長さで重み) − 消費MP の値段。
// dmgK = 敵の脅威の合計 ÷ 隊の与ダメの合計 (与ダメ 1 で戦いが縮み、その間に受けずに済む傷)。
// ダメージの見積もりは combat.js の Battle.estPhys / estSpell (実際の式の平均。乱数も状態も触らない)。
// 作戦はこの重みと MP の値段を変える。game.js はここを呼んで chooseAction / chooseTarget するだけ。
// (このファイルは game.js を import しない)

import { SPELLS, spellCost, soulPowerMul, isMetal, spellCureKinds } from "./combat.js";
import { autoSkills } from "./souls.js";
import { STAGED, STAGE_MAX, STRONG_MIN, stageMul, stageOf } from "./buffstage.js";

// 作戦。key はセーブに残る (変えない)
export const TACTICS = [
  { key: "all", name: "全力で討て", short: "全力", desc: "与える傷が最も大きい手を選ぶ。魔力を惜しまず、癒しは仲間が倒れかけた時だけ。" },
  { key: "bal", name: "機を見て戦え", short: "機を見る", desc: "攻めを主に、傷が深まれば癒し、守りや弱体も機を見て使う。魔力が減るほど控える。" },
  { key: "life", name: "命を繋げ", short: "命を繋ぐ", desc: "癒し・蘇生・治療と守りを先に立てる。攻めるのは隊が無事な時。" },
  { key: "save", name: "魔力を惜しめ", short: "魔力を惜しむ", desc: "通常攻撃を主にし、技は割に合う時と危うい時だけ。長く潜る時に。" },
  { key: "blade", name: "刃のみ振るえ", short: "刃のみ", desc: "技を使わず、通常攻撃だけで戦う。" },
];
export const DEFAULT_TACTIC = "bal";
const TACTIC_BY_KEY = Object.fromEntries(TACTICS.map((t) => [t.key, t]));
export function tacticOf(d) { return (d && TACTIC_BY_KEY[d.tactic]) || TACTIC_BY_KEY[DEFAULT_TACTIC]; }
export function setTactic(d, key) { if (d && TACTIC_BY_KEY[key]) d.tactic = key; }

// 作戦ごとの重み。heal = 傷の深さ (HP割合) ごとの癒しの重み [[この割合未満, 重み], …] (どれにも当たらなければ 0)。
// guard = 守りの支援 (防御強化・挑発・庇い・治療…) / edge = 攻めの支援 (攻撃強化・溜め・耐性ダウン) / stat = 敵への状態異常・弱体。
// mpK = 消費MP 1 の値段 (手番の者の通常攻撃の期待ダメージに対する割合。MPが減るほど上がる)
const WEIGHTS = {
  all: { dmg: 1, heal: [[0.25, 1.2]], revive: 0.6, guard: 0, edge: 0, stat: 0, mpK: 0 },
  bal: { dmg: 1, heal: [[0.3, 1.6], [0.55, 1.0], [0.8, 0.35]], revive: 1, guard: 1, edge: 1, stat: 1, mpK: 0.06 },
  life: { dmg: 0.7, heal: [[0.3, 2.4], [0.6, 1.6], [0.85, 0.9], [1, 0.15]], revive: 1.8, guard: 1.5, edge: 0.6, stat: 1.1, mpK: 0.05 },
  save: { dmg: 1, heal: [[0.3, 1.4], [0.5, 0.6]], revive: 1, guard: 0.4, edge: 0.4, stat: 0.4, mpK: 0.35 },
};
const KILL_W = 1.5;          // 倒した敵の脅威 (1手番ぶんの与ダメ) の何手番ぶんを値打ちに足すか
const CHARMED_TGT_MUL = 0.3; // 魅了した敵は殴ると正気に戻りやすいので後回し
const NO_AUTO = new Set(["field", "escape"]);

// 図鑑の抵抗値が開放済みか。未登録・未開放なら隠れた抵抗値を判断に使わない。
let _resistKnown = null;
export function setResistKnown(fn) { _resistKnown = typeof fn === "function" ? fn : null; }
const resistKnown = t => !!(_resistKnown && _resistKnown(t));
export const AUTO_AIL_RESIST_LIMIT = 50; // 成功率を半分以上削る異常技は控える
const autoRate = (b, actor, t, base, kind) => b.estRate(actor, t, base, resistKnown(t) ? kind : undefined);
const autoAilRes = (b, t, kind) => resistKnown(t) ? b._ailRes(t, kind) : 0;
function skillAilments(sp) {
  const kinds = [];
  if (sp.poison) kinds.push("poison");
  if (sp.para) kinds.push("paralyze");
  if (sp.sleepChance || sp.kind === "sleep") kinds.push("sleep");
  if (sp.charm) kinds.push("charm");
  if (sp.confuse) kinds.push("confuse");
  if (sp.seal) kinds.push("seal");
  if (sp.flinchChance) kinds.push("flinch");
  if (sp.instakill) kinds.push("death");
  return kinds;
}
// 複合技は最小の抵抗値を採用。全体技は効きやすい敵が1体でもいれば候補に残す。
function ailSkillBlocked(b, sp, targets) {
  const kinds = skillAilments(sp);
  return kinds.length > 0 && targets.length > 0 && targets.every(t =>
    resistKnown(t) && Math.min(...kinds.map(k =>
      (["stone", "death"].includes(k) ? b._hardRes(t, k) : b._ailRes(t, k)) * 100
    )) >= AUTO_AIL_RESIST_LIMIT);
}

// (dbg に配列を渡すと、比べた候補をすべて積む — 模擬戦での検証用)
// 手番の者 actor の一手を決める。{ action: "attack"|"spell"|"defend", spellKey?, target?, idle? }。
// 何も通らない (届く敵がみな物理無効で、役に立つ技も無い) 時は idle: true の防御を返す (game.js が隊の全員分続いたらオートを止める)
export function decideAuto(b, actor, dbg = null) {
  if (!b || !actor || !actor.alive) return null;
  const tac = tacticOf(actor).key;
  const ctx = makeCtx(b, actor);
  const cands = [];
  // 通常攻撃 (射程内の敵ごと)
  for (const t of b.attackableEnemies(actor)) {
    if (!t.alive) continue;
    const per = b.estPhys(actor, t, { basic: true }) * ctx.strikes(actor);
    if (per <= 0) continue;
    const v = dmgValue(ctx, t, per) * (t.mind === "charm" ? CHARMED_TGT_MUL : 1);
    cands.push({ action: "attack", target: t, dmg: v, raw: per, score: 0 });
  }
  if (tac !== "blade") {
    for (const key of autoSkills(actor)) {
      const sp = SPELLS[key];
      if (!sp || NO_AUTO.has(sp.kind)) continue;
      if (actor.mp < spellCost(actor, sp)) continue;
      for (const c of skillCands(b, ctx, actor, key, sp)) cands.push(c);
    }
  }
  const W = WEIGHTS[tac] || null;
  let best = null;
  for (const c of cands) {
    if (!W) c.score = c.raw || 0; // 刃のみ: 通常攻撃の与ダメだけで比べる
    else {
      const cost = c.spellKey ? spellCost(actor, SPELLS[c.spellKey]) : 0;
      c.score = (c.dmg || 0) * W.dmg + (c.heal || 0) + (c.revive || 0) * W.revive + (c.guard || 0) * W.guard
        + (c.edge || 0) * W.edge + (c.stat || 0) * W.stat - (c.pen || 0) - cost * ctx.mpPrice(actor, W.mpK) - cost * 1e-3;
    }
    c.score += (c.target && c.target.side === "enemy" ? ctx.threat(c.target) * 1e-3 : 0); // 同点なら脅威の大きい敵
    if (!best || c.score > best.score) best = c;
  }
  if (dbg) dbg.push(...cands);
  if (best && best.score > 0.01) return { action: best.action, spellKey: best.spellKey || null, target: best.target || null };
  return { action: "defend", idle: true };
}

// ---- 見積もりの共通の器 (1手番の判断のあいだだけ使う覚え書き) ----
function makeCtx(b, actor) {
  const foes = b.livingEnemies();
  const allies = b.livingParty();
  const memo = new Map();
  const once = (k, f) => { if (!memo.has(k)) memo.set(k, f()); return memo.get(k); };
  const avgVit = allies.length ? allies.reduce((a, p) => a + b._evit(p), 0) / allies.length : 0;
  const ctx = {
    b, actor, foes, allies,
    strikes: (a) => (a.multistrike > 1 ? Math.min(4, a.multistrike) : 1),
    // 敵1体が1手番で隊に与える傷の見積もり (眠り・麻痺・魅了・怯みは割り引く)
    threat: (e) => once("t" + e.uid, () => {
      if (!e.alive) return 0;
      let v = Math.max(1, b._eatk(e) - avgVit * 0.5);
      if (e.ability === "breath" || e.ability === "spell") v *= 1 + (e.abRate || 0.3) * Math.max(0, allies.length - 1) * 0.5;
      if (e.haste) v *= 2;
      if (e.mind === "charm") v *= 0.2; else if (e.mind === "confuse") v *= 0.5;
      if (e.asleep) v *= 0.3;
      if (e.ailment === "paralyze") v *= 0.5;
      if (e._flinch) v *= 0.5;
      if (b._omenOf && b._omenOf(e)) v *= 2; // 大技の予兆 (溜め): 次の手番に重い一撃が来る
      return v;
    }),
    // 味方 a の通常攻撃の期待ダメージ (届く敵の平均)
    basic: (a) => once("b" + (a.uid != null ? a.uid : a.name), () => {
      const reach = b.attackableEnemies(a).filter((e) => e.alive);
      if (!reach.length) return 0;
      return reach.reduce((s, e) => s + b.estPhys(a, e, { basic: true }), 0) / reach.length * ctx.strikes(a);
    }),
  };
  ctx.ourDps = once("dps", () => allies.reduce((s, p) => s + ctx.basic(p), 0));
  // 戦いの残りの長さ (隊の手番の巡り数)。強化・弱体・状態異常の値打ちはこれで伸び縮みする
  ctx.rounds = Math.min(5, Math.max(0.5, foes.reduce((s, e) => s + e.hp, 0) / Math.max(1, ctx.ourDps)));
  ctx.left = (dur) => Math.min(ctx.rounds, dur || 3);
  ctx.maxThreat = foes.reduce((m, e) => Math.max(m, ctx.threat(e)), 0);
  ctx.threatSum = foes.reduce((s, e) => s + ctx.threat(e), 0);
  // 与ダメ → 受けずに済む傷 の換算
  ctx.dmgK = Math.min(3, Math.max(0.02, ctx.threatSum / Math.max(1, ctx.ourDps)));
  // 味方 a が1巡りに受ける傷の見積もり (前衛は狙われやすく、挑発は引き付ける — _pickPartyTarget の重み)
  const wOf = (p) => (b.isBackRow(p) ? 1 : 3) * Math.max(1, Math.round(b._bm(p, "taunt")));
  const wSum = allies.reduce((s, p) => s + wOf(p), 0) || 1;
  ctx.incoming = (a) => (a.alive ? ctx.threatSum * wOf(a) / wSum : 0);
  ctx.hitsOn = (a) => (a.alive ? foes.length * wOf(a) / wSum : 0);
  // MP 1 の値段 (HP 換算): 手番の者の通常攻撃 (術者は隊の平均の半分を下限) × 係数 × 残りMPの乏しさ × dmgK
  ctx.mpPrice = (a, k) => {
    if (!k) return 0;
    const avg = allies.length ? ctx.ourDps / allies.length : 0;
    const ref = Math.max(1, ctx.basic(a), avg * 0.5);
    const frac = a.maxmp ? a.mp / a.maxmp : 1;
    return ref * k * ctx.dmgK / Math.max(0.25, frac);
  };
  return ctx;
}

// 敵 t へ見積もり dmg の傷を負わせる値打ち (HP 換算): 残りHPで頭打ち + 倒せるなら脅威を足す
function dmgValue(ctx, t, dmg) {
  if (!(dmg > 0)) return 0;
  const eff = Math.min(dmg, t.hp);
  return eff * ctx.dmgK + (dmg >= t.hp * 0.95 ? ctx.threat(t) * KILL_W : 0);
}

// 癒しの重み (傷の深さ)。いまの敵の一撃で倒れうる者は深手と見なす
function healUrg(ctx, a, W) {
  if (!W || !a.maxhp) return 0;
  let frac = a.hp / a.maxhp;
  if (a.hp <= ctx.maxThreat * 1.2) frac = Math.min(frac, 0.2);
  for (const [lim, w] of W.heal) if (frac < lim) return w;
  return 0;
}

// 状態異常・弱体を抱えた味方を治す値打ち
function ailValue(ctx, a, sp) {
  const kinds = spellCureKinds(sp);
  if (!a.alive) return 0;
  const hit = (ctx.basic(a) + 1) * ctx.dmgK; // その者が動けない1手番に失う与ダメ
  let v = 0;
  if (a.ailment === "stone" && kinds.includes("stone")) v += a.maxhp * 0.6 + hit * 3;
  else if (a.ailment === "paralyze" && kinds.includes("paralyze")) v += hit * 2 + a.maxhp * 0.1;
  else if (a.ailment === "poison" && kinds.includes("poison")) v += a.maxhp * 0.1 * (ctx.left(3) + 1);
  if (a.asleep && kinds.includes("sleep")) v += hit * 1.2;
  if (a.mind === "charm" && kinds.includes("charm")) v += hit * 2.5; else if (a.mind === "confuse" && kinds.includes("confuse")) v += hit * 1.5;
  return v;
}
const debuffed = (a) => (a.effects || []).some((e) => e.mult < 1);
// 能力 stat に倍率 mult の強化・弱体を掛けた時、実効の倍率がどれだけ動くか (強化は +、弱体は −)。
// ATK・VIT・AGI・INT・PIE は段 (buffstage.js: ±3段で止まり、主・精鋭は −2段まで) なので重ねがけも段で見る。
// それ以外 (命中など) は同じ向きが既に掛かっていれば重ねない
function modGain(b, t, stat, mult) {
  if (!mult || mult === 1) return 0;
  if (STAGED.has(stat) && b.stageOf) {
    const s0 = b.stageOf(t, stat), d = stageOf(mult);
    const lo = b._strongFoe && b._strongFoe(t) ? STRONG_MIN : -STAGE_MAX;
    const s1 = Math.max(Math.min(lo, s0), Math.min(Math.max(STAGE_MAX, s0), s0 + d));
    return stageMul(s1) - stageMul(s0);
  }
  const cur = b._bm(t, stat);
  if (mult > 1) return mult > cur ? mult - Math.max(1, cur) : 0;
  return cur < 1 ? 0 : mult - 1;
}

// 技 key の候補 (狙いごと) を値打ちの成分つきで返す
function skillCands(b, ctx, actor, key, sp) {
  const W = WEIGHTS[tacticOf(actor).key];
  const out = [];
  const mk = (target) => ({ action: "spell", spellKey: key, target, dmg: 0, heal: 0, revive: 0, guard: 0, edge: 0, stat: 0, pen: 0 });
  // 捨身 (hpCost): 削る身の分を差し引く。深手に落ちるなら重く
  const hpPen = (c) => {
    if (!sp.hpCost) return;
    const cost = (actor.maxhp || 1) * sp.hpCost * (1 - b._rk(actor, "dkKeiyaku", [0.20, 0.35, 0.50, 1]));
    c.pen += cost * 0.5 * ((actor.hp - cost) < actor.maxhp * 0.3 ? 4 : 1);
  };
  const isFoeT = sp.target === "enemy" || sp.target === "all-enemy";
  if (sp.kind === "phys" || sp.kind === "atk" || (sp.kind === "debuff") || sp.kind === "sleep") {
    if (!isFoeT && sp.kind !== "sleep") return out;
    const groups = sp.kind === "sleep" || sp.target === "all-enemy" || sp.scatter ? [null]
      : (sp.kind === "phys" ? b.attackableEnemies(actor) : b.livingEnemies()).filter((e) => e.alive);
    for (const g of groups) {
      const c = mk(g);
      const tgts = g ? [g] : b.livingEnemies();
      if (ailSkillBlocked(b, sp, tgts)) continue;
      for (const t of tgts) {
        let d = 0;
        if (sp.kind === "phys") {
          const popt = { power: sp.power * soulPowerMul(actor, sp), critBonus: sp.critBonus, element: sp.element, intScale: sp.intScale, agiScale: sp.agiScale,
            vitScale: sp.vitScale, pieScale: sp.pieScale, acc: sp.acc, pierce: sp.pierce, desperate: sp.desperate, execute: sp.execute, prey: sp.prey, skill: true };
          const per = b.estPhys(actor, t, popt);
          d = sp.scatter ? per * sp.scatter / tgts.length : per * (sp.hits || 1);
        } else if (sp.kind === "atk") d = b.estSpell(actor, sp, t);
        let v = dmgValue(ctx, t, d) * (t.mind === "charm" ? CHARMED_TGT_MUL : 1);
        // 即死: 主には効かない。当たれば残りのHPぶんの傷と同じ
        if (sp.instakill && !t.boss && !isMetal(t) && d < t.hp && (!sp.instakill.races || sp.instakill.races.includes(t.mon && t.mon.race))) {
          const p = autoRate(b, actor, t, sp.instakill.chance, "death");
          v += p * ((t.hp - d) * ctx.dmgK + ctx.threat(t) * KILL_W);
        }
        c.dmg += v;
        if (d < t.hp * 0.9) c.stat += foeEffects(b, ctx, actor, sp, t);
        if (sp.drain) c.heal += Math.min(d * sp.drain, actor.maxhp - actor.hp) * healUrg(ctx, actor, W);
      }
      if (sp.partyHeal) for (const a of ctx.allies) c.heal += Math.min(b.estPartyHeal(actor, sp.partyHeal), a.maxhp - a.hp) * healUrg(ctx, a, W);
      if (sp.debuffAll) for (const t of b.livingEnemies()) c.stat += statMods(b, ctx, sp.debuffAll, sp.dur, t);
      if (sp.kind === "sleep") for (const t of b.livingEnemies()) {
        if (t.asleep || isMetal(t)) continue;
        c.stat += autoRate(b, actor, t, 0.6, "sleep") * ctx.threat(t) * Math.min(2, ctx.rounds) * 0.5;
      }
      hpPen(c);
      out.push(c);
    }
    return out;
  }
  // 味方への術 (回復・治療・強化・MP譲渡)
  let targets;
  if (sp.target === "self") targets = [actor];
  else if (sp.target === "all-ally") targets = null;
  else targets = b._allyTargets(sp);
  const groups = targets ? targets : [null];
  for (const g of groups) {
    const c = mk(g);
    const list = g ? [g] : (sp.revive ? b.party : ctx.allies);
    for (const a of list) allyEffects(b, ctx, actor, sp, a, c, W);
    hpPen(c);
    out.push(c);
  }
  return out;
}

// 敵 t に付く状態異常・弱体の値打ち (_inflict と同じ条件・確率)
function foeEffects(b, ctx, actor, sp, t) {
  if (!t.alive || isMetal(t)) return 0;
  const th = ctx.threat(t);
  const rate = (x, kind) => autoRate(b, actor, t, x, kind);
  let v = 0;
  if (sp.poison && !t.ailment) v += rate(sp.poison.chance, "poison") * Math.min(t.hp, (t.boss ? Math.max(0.05, sp.poison.pct * 0.5) : sp.poison.pct) * t.maxhp * ctx.left(3)) * ctx.dmgK;
  if (sp.para && !t.ailment) v += rate(sp.para, "paralyze") * th * Math.min(2, ctx.rounds) * 0.6;
  if (sp.sleepChance && !t.asleep) v += rate(sp.sleepChance, "sleep") * th * Math.min(2, ctx.rounds) * 0.5;
  if (sp.charm && !t.mind) v += rate(sp.charm, "charm") * th * Math.min(2, ctx.rounds) * 1.2;
  if (sp.confuse && !t.mind) v += rate(sp.confuse, "confuse") * th * Math.min(2, ctx.rounds) * 0.8;
  if (sp.seal && (t.ability || t.role) && b._bm(t, "seal") >= 1) v += rate(sp.seal.chance, "seal") * th * 0.6 * ctx.left(sp.seal.turns || 3);
  if (sp.flinchChance && !t.boss && !t._flinch) v += sp.flinchChance * (1 - autoAilRes(b, t, "flinch")) * th;
  if (sp.strip && (t.effects || []).some((e) => e.mult > 1)) v += th * 0.5 * Math.min(2, ctx.rounds);
  // 大技の予兆: 封じ・眠り・麻痺・魅了・混乱・怯み・打ち消しのどれかが通れば溜めた力が霧散する
  if (b._omenOf && b._omenOf(t)) {
    let keep = 1;
    if (sp.seal) keep *= 1 - rate(sp.seal.chance, "seal");
    if (sp.para && !t.ailment) keep *= 1 - rate(sp.para, "paralyze");
    if (sp.sleepChance && !t.asleep) keep *= 1 - rate(sp.sleepChance, "sleep");
    if (sp.charm && !t.mind) keep *= 1 - rate(sp.charm, "charm");
    if (sp.confuse && !t.mind) keep *= 1 - rate(sp.confuse, "confuse");
    if (sp.flinchChance && !t.boss) keep *= 1 - sp.flinchChance * (1 - autoAilRes(b, t, "flinch"));
    if (sp.strip) keep = 0;
    v += (1 - keep) * th * 0.5; // threat は予兆で2倍にしてある。その上乗せ分を防ぐ
  }
  if (sp.debuff) v += statMods(b, ctx, sp.debuff, sp.dur, t);
  if (sp.vuln) for (const el in sp.vuln) {
    if (b._bm(t, "r_" + el) < 1) continue;
    v += (1 / sp.vuln[el] - 1) * ctx.ourDps * ctx.dmgK * 0.25 * (el === "all" ? 1 : 0.4) * ctx.left(sp.dur);
  }
  return v;
}
// 敵の能力を下げる弱体 ({atk|vit|agi|hit|int: 倍率}) の値打ち。段の底まで下がっていれば値打ちは無い
function statMods(b, ctx, mods, dur, t) {
  if (!t.alive || isMetal(t)) return 0;
  const th = ctx.threat(t), n = ctx.left(dur);
  let v = 0;
  for (const k in mods) {
    if (!(mods[k] < 1)) continue;
    const down = -modGain(b, t, k, mods[k]); // 実効の倍率が下がる幅
    if (!(down > 0)) continue;
    if (k === "atk") v += down * th * n;
    else if (k === "vit") v += down * b._evit(t) * 0.5 * ctx.allies.filter((p) => b.estPhys(p, t, { basic: true }) > 0).length * n * 0.6 * ctx.dmgK;
    else if (k === "agi") v += down * th * 0.3 * n;
    else if (k === "hit") v += down * th * n;
    else if (k === "int" && (t.ability === "spell" || t.ability === "breath")) v += down * th * 0.5 * n;
  }
  return v;
}

// 味方 a への術の値打ちを c の成分に足す
function allyEffects(b, ctx, actor, sp, a, c, W) {
  if (!a) return;
  // 蘇生
  if (!a.alive) {
    if (!sp.revive) return;
    const hp = sp.revivePct ? a.maxhp * sp.revivePct : Math.min(a.maxhp, b.estHeal(actor, sp));
    c.revive += hp * 0.5 + a.maxhp * 0.5 + ctx.basic(a) * ctx.dmgK * 2;
    return;
  }
  const n = ctx.left(sp.dur);
  if (sp.kind === "heal" && (sp.power || 0) > 0) c.heal += Math.min(b.estHeal(actor, sp), a.maxhp - a.hp) * healUrg(ctx, a, W);
  if (sp.kind === "mana") {
    const gain = Math.min((sp.power + (actor.int || 0) * 0.25) * soulPowerMul(actor, sp), (a.maxmp || 0) - a.mp);
    if (a !== actor && gain > 0) c.edge += gain * ctx.mpPrice(a, (W && W.mpK) || 0.06) * 0.8;
  }
  if (sp.kind === "cure" || sp.cure) c.guard += ailValue(ctx, a, sp);
  if (sp.purge && debuffed(a)) c.guard += ctx.basic(a) * ctx.dmgK + a.maxhp * 0.05;
  if (sp.regen && b._bm(a, "regen") <= 1) {
    const amt = Math.min(a.maxhp - a.hp + ctx.incoming(a) * sp.regen.turns, sp.regen.pct * a.maxhp * Math.min(ctx.rounds, sp.regen.turns));
    c.guard += amt * 0.6;
  }
  if (sp.buff) for (const k in sp.buff) {
    const up = sp.buff[k] > 1 ? modGain(b, a, k, sp.buff[k]) : 0; // 段で重ねた時に実効の倍率が上がる幅
    if (!(up > 0)) continue;
    // 武器が参照しない能力を上げても通常攻撃の威力は増えない。
    const coefficient = a.wScale ? (a.wScale[k] || 0) : (k === "atk" ? 1 : 0);
    if (coefficient) c.edge += up * (a[k] || 0) * coefficient / Math.max(1, b._eatk(a)) * ctx.basic(a) * ctx.dmgK * n * 0.7;
    if (k === "vit") c.guard += up * b._evit(a) * 0.5 * ctx.hitsOn(a) * n;
    else if (k === "agi") c.edge += up * ctx.basic(a) * ctx.dmgK * 0.2 * n;
    else if (k === "int" && (a.spells || []).some((s) => SPELLS[s] && SPELLS[s].kind === "atk")) c.edge += up * (a.int || 0) * 0.5 * ctx.dmgK * n;
  }
  const wounded = ctx.allies.some((p) => p !== a && p.maxhp && p.hp < p.maxhp * 0.5);
  const sturdy = a.maxhp && a.hp > a.maxhp * 0.5;
  if (sp.taunt && b._bm(a, "taunt") <= 1 && sturdy && ctx.allies.length > 1) c.guard += ctx.threatSum * (wounded ? 0.4 : 0.15) * n;
  if (sp.shield && b._bm(a, "shield") <= 1 && sturdy && wounded) c.guard += ctx.maxThreat * n * 0.6;
  if (sp.stance === "counter" && b._bm(a, "ctr") <= 1) c.edge += ctx.hitsOn(a) * ctx.basic(a) * ctx.dmgK * 0.8 * n;
  if (sp.charge && !(a.effects || []).some((e) => e.stat === "charge") && ctx.rounds > 1) c.edge += (sp.charge - 1) * ctx.basic(a) * ctx.dmgK * 0.8;
  const casters = ctx.foes.filter((e) => e.ability === "breath" || e.ability === "spell");
  if (casters.length) {
    const th = casters.reduce((s, e) => s + ctx.threat(e), 0);
    if (sp.ward) for (const w in sp.ward) {
      if (b._bm(a, w === "breath" ? "wardB" : "wardS") > 1) continue;
      if (casters.some((e) => e.ability === w)) c.guard += sp.ward[w] * th / Math.max(1, ctx.allies.length) * n * 0.5;
    }
    if (sp.grantBarrier && !(a._barrierLeft > 0)) c.guard += th * 0.3 / Math.max(1, ctx.allies.length);
  }
  if (sp.grantEndure && !a._grantEndure && a.maxhp && a.hp < a.maxhp * 0.5) c.guard += a.maxhp * 0.3;
}
