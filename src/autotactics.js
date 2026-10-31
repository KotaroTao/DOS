// オート戦闘の作戦 (人業ごとの「命令」) と、手番ごとの一手の選び方。
// 操霊師が人業に授ける命令として 5 つの作戦を持ち、doll.tactic に保存する (既定は「機を見て戦え」)。
// オートで使う技は、戦闘の一覧に出していて「オート」を切っていない技だけ (souls.js autoSkills)。
//
// 選び方: 手番の者が取れる手 (通常攻撃 × 狙い / 使える技 × 狙い / 防御) をすべて並べ、
// 今の有効な与ダメと討伐、3ターンの支援の増分を評価し、癒し・蘇生・守り・状態異常を加え、消費MPを引く。
// 強化・弱体の攻撃への寄与は、段・持続・残りMP・射程・敵HPを反映した予測に含める。
// dmgK = 敵の脅威の合計 ÷ 隊の与ダメの合計 (与ダメ 1 で戦いが縮み、その間に受けずに済む傷)。
// ダメージの見積もりは combat.js の Battle.estPhys / estSpell (実際の式の平均。乱数も状態も触らない)。
// 作戦はこの重みと MP の値段を変える。game.js はここを呼んで chooseAction / chooseTarget するだけ。
// 攻めと攻めの支援は、今のターンの残り＋次の2ターンの隊の期待ダメージで比べる。
// (このファイルは game.js を import しない)

import { SPELLS, spellCost, skillPowerMul, healsHp, isMetal, spellCureKinds, breathHpK, manaGiftAmount, tauntGuard, stanceMulOf } from "./combat.js";
import { autoSkills } from "./souls.js";
import { STAGED, STAGE_MAX, STRONG_MIN, stageMul, stageOf } from "./buffstage.js";
import { forecastCandidates, AUTO_FORECAST_TURNS, scatterDamage } from "./autoforecast.js";

// 作戦。key はセーブに残る (変えない)
export const TACTICS = [
  { key: "all", name: "全力で討て", short: "全力", desc: "今の有効打と、強化・弱体で3ターンの攻めを増やす手を比べる。魔力を惜しまず、癒しは仲間が倒れかけた時だけ。" },
  { key: "bal", name: "機を見て戦え", short: "機を見る", desc: "今の有効打と、強化・弱体で続く3ターンの攻めを比べる。傷が深まれば癒し、守りも使う。魔力が減るほど控える。" },
  { key: "life", name: "命を繋げ", short: "命を繋ぐ", desc: "癒し・蘇生・治療と守りを先に立てる。攻めるのは隊が無事な時。" },
  { key: "save", name: "魔力を惜しめ", short: "魔力を惜しむ", desc: "通常攻撃を主にし、技は割に合う時と危うい時だけ。長く潜る時に。" },
  { key: "blade", name: "刃のみ振るえ", short: "刃のみ", desc: "技を使わず、通常攻撃で通る傷と敵を倒す機会を比べる。" },
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

// 図鑑の抵抗値が開放済みか。未開放の部分耐性は伏せ、完全無効だけを避ける。
let _resistKnown = null;
export function setResistKnown(fn) { _resistKnown = typeof fn === "function" ? fn : null; }
// 極「慧眼の」の持ち主が考える間 (decideAuto) は、明かしていない敵の抵抗値も見積もりに使う
let _seer = false;
const resistKnown = t => _seer || !!(_resistKnown && _resistKnown(t));
// 無効だけは未開示でも避ける。部分的な抵抗値・有利属性を先読みすることはしない。
const autoRate = (b, actor, t, base, kind) => b.estRate(actor, t, base, kind) <= 0 ? 0 : b.estRate(actor, t, base, kind, resistKnown(t));
function autoStatusChances(b, actor, sp, t) {
  const actual = b.spellStatusChances(actor, sp, t);
  if (resistKnown(t)) return actual;
  return b.spellStatusChances(actor, sp, t, false).map(r => actual.find(a => a.kind === r.kind)?.rate === 0 ? { ...r, rate: 0 } : r);
}
export const AUTO_LOW_DAMAGE = 2;
export const AUTO_STALL_ROUNDS = 3;
// 1手の合計期待値で見る。とどめ・金属への打撃・連撃/会心で削れる手は残す。
const lowDamage = (d, t) => d <= 0 || (!isMetal(t) && d <= AUTO_LOW_DAMAGE && d < t.hp * 0.1);
function autoDamage(known, actual, t) {
  return actual <= 0 || lowDamage(actual, t) ? actual : known;
}
const autoBasic = (b, a, t) => autoDamage(b.estBasic(a, t, { resistKnown: resistKnown(t) }), b.estBasic(a, t, { actual: true }), t);
const autoPhys = (b, a, t, opt) => autoDamage(b.estPhys(a, t, { ...opt, resistKnown: resistKnown(t) }), b.estPhys(a, t, { ...opt, actual: true }), t);
const autoSpell = (b, a, sp, t) => autoDamage(b.estSpell(a, sp, t, { resistKnown: resistKnown(t) }), b.estSpell(a, sp, t, { actual: true }), t);

// オート中だけの観測。セーブやクラウドの戦闘結果には混ぜない。
const autoProgress = new WeakMap();
export function resetAutoProgress(b) { if (b) autoProgress.delete(b); }
export function autoCombatStalled(b) {
  if (!b || b.result) return false;
  const foes = b.livingEnemies();
  const now = { round: b._roundNo, foes: foes.map(e => ({ uid: e.uid, hp: e.hp, maxhp: e.maxhp })) };
  const old = autoProgress.get(b);
  if (!old || now.round < old.round) { autoProgress.set(b, { ...now, weak: 0 }); return false; }
  if (now.round === old.round) return false;
  const killed = old.foes.some(e => !foes.some(t => t.uid === e.uid));
  const changed = foes.some(e => !old.foes.some(t => t.uid === e.uid));
  const loss = old.foes.reduce((n, e) => n + e.hp - (foes.find(t => t.uid === e.uid)?.hp || 0), 0);
  const limit = Math.min(b.livingParty().length * AUTO_LOW_DAMAGE, old.foes.reduce((n, e) => n + e.maxhp, 0) * 0.01);
  const weak = killed || changed || loss > limit ? 0 : old.weak + 1;
  autoProgress.set(b, { ...now, weak });
  if (weak < AUTO_STALL_ROUNDS) return false;
  // 有効な攻撃を選べるなら、数回のミスや会心待ちだけで止めない。
  if (b.livingParty().some(p => decideAuto(b, p)?.effectiveAttack)) {
    autoProgress.set(b, { ...now, weak: 0 }); return false;
  }
  return true;
}

// (dbg に配列を渡すと、比べた候補をすべて積む — 模擬戦での検証用)
// 手番の者 actor の一手を決める。{ action, spellKey?, target?, idle?, effectiveAttack? }。
// effectiveAttack は停滞判定用。有効な攻撃・即死を選ぶなら、ミスが続いても待つ。
// 何も通らない (届く敵がみな物理無効で、役に立つ技も無い) 時は idle: true の防御を返す (game.js が隊の全員分続いたらオートを止める)
export function decideAuto(b, actor, dbg = null) {
  if (!b || !actor || !actor.alive) return null;
  _seer = !!(actor.gearMisc && (actor.gearMisc.insight || actor._bkInsight));
  try { return decideAutoInner(b, actor, dbg); } finally { _seer = false; }
}
function decideAutoInner(b, actor, dbg) {
  const tac = tacticOf(actor).key;
  const ctx = makeCtx(b, actor);
  const cands = [];
  // 通常攻撃 (射程内の敵ごと)
  for (const t of b.attackableEnemies(actor)) {
    if (!t.alive) continue;
    const per = autoBasic(b, actor, t); // 連撃・二刀流の左手の一撃まで
    if (per <= 0) continue;
    const v = dmgValue(ctx, t, per) * (t.mind === "charm" ? CHARMED_TGT_MUL : 1);
    const c = { action: "attack", target: t, dmg: v, raw: per, lowDamage: lowDamage(per, t), score: 0, kills: 0 };
    finishEstimate(c, t, per);
    cands.push(c);
  }
  if (tac !== "blade") {
    for (const key of autoSkills(actor)) {
      const sp = SPELLS[key];
      if (!sp || NO_AUTO.has(sp.kind)) continue;
      if (actor.mp < b.costOf(actor, sp, key)) continue;
      for (const c of skillCands(b, ctx, actor, key, sp)) cands.push(c);
    }
  }
  const W = WEIGHTS[tac] || null;
  forecastCandidates(b, actor, cands, {
    basic: autoBasic, phys: autoPhys, spell: autoSpell, status: autoStatusChances, low: lowDamage,
    price: a => ctx.mpPrice(a, WEIGHTS[tacticOf(a).key]?.mpK || 0) / ctx.dmgK,
  });
  let best = null;
  for (const c of cands) {
    if (!W) c.score = c.dmg; // 今通る傷と討伐の値打ちは、未来の味方の攻撃で打ち消さない
    else {
      const cost = c.spellKey ? b.costOf(actor, SPELLS[c.spellKey], c.spellKey) : 0;
      const supportGain = c.supportGain3 > 0;
      // 全力でも、ほぼ削れない攻撃だけにMPを使わない。有効な追加効果は別に残す。
      if (cost > 0 && c.lowDamage && !(supportGain || c.death > 0 || c.poisonDamage > 0 || c.heal > 0 || c.stat > 0 || c.guard > 0 || c.edge > 0 || c.revive > 0)) { c.score = -Infinity; continue; }
      c.score = (c.dmg + (c.death || 0) + (c.poisonDamage || 0) + c.supportGain3 * ctx.dmgK) * W.dmg + (c.heal || 0) + (c.revive || 0) * W.revive + (c.guard || 0) * W.guard
        + (c.edge || 0) * W.edge + (c.stat || 0) * W.stat - (c.pen || 0) - cost * ctx.mpPrice(actor, W.mpK) - cost * 1e-3;
    }
    // 同点では確実なとどめを優先する。過剰ダメージで加点しない。
    c.score += Math.min(1, c.raw || 0) * 0.02 + c.kills * 0.05;
    c.score += (c.target && c.target.side === "enemy" ? ctx.threat(c.target) * 1e-6 : 0);
    if (!best || c.score > best.score) best = c;
  }
  // 攻めの準備で深手の癒しを後回しにしない。「命を繋げ」は蘇生も先に立てる。
  if (W) {
    const danger = ctx.allies.some(a => a.hp < a.maxhp * W.heal[0][0] || a.hp <= ctx.maxThreat * 1.2);
    let rescue = null, rescueValue = 0;
    for (const c of cands) {
      if (!(danger && c.heal > 0) && !(tac === "life" && c.revive > 0)) continue;
      const cost = c.spellKey ? b.costOf(actor, SPELLS[c.spellKey], c.spellKey) : 0;
      const value = (c.heal || 0) + (c.revive || 0) * W.revive - (c.pen || 0) - cost * ctx.mpPrice(actor, W.mpK);
      if (value > rescueValue) { rescue = c; rescueValue = value; }
    }
    if (rescue) { rescue.score = Math.max(rescue.score, rescueValue); best = rescue; }
  }
  if (dbg) dbg.push(...cands);
  if (best && best.score > 0.01) return { action: best.action, spellKey: best.spellKey || null, target: best.target || null, effectiveAttack: !!((best.raw > 0 && !best.lowDamage) || best.death > 0 || best.poisonDamage > 0 || best.supportGain3 > AUTO_LOW_DAMAGE) };
  return { action: "defend", idle: true };
}

// 同点の比較用に、期待ダメージで今倒せる数を数える。
// 乱撃は対象ごとの平均を確実なとどめとして数えない (敵が1体なら通常どおり)。
function finishEstimate(c, t, dmg, scattered = false, deathRate = 0) {
  if ((!scattered && dmg >= t.hp) || deathRate >= 1) c.kills++;
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
    // 敵1体が1手番で隊に与える傷の見積もり (眠り・麻痺・魅了・怯みは割り引く)
    threat: (e) => once("t" + e.uid, () => {
      if (!e.alive) return 0;
      let v = Math.max(1, b._eatk(e) - avgVit * 0.5);
      if (e.ability === "breath" || e.ability === "spell") v *= 1 + (e.abRate || 0.3) * Math.max(0, allies.length - 1) * 0.5 * (e.ability === "breath" ? breathHpK(e) : 1); // ブレスは残りHPで弱まる
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
      return reach.reduce((s, e) => s + autoBasic(b, a, e), 0) / reach.length;
    }),
  };
  ctx.ourDps = once("dps", () => allies.reduce((s, p) => s + ctx.basic(p), 0));
  // 戦いの残りの長さ (隊の手番の巡り数)。強化・弱体・状態異常の値打ちはこれで伸び縮みする
  ctx.rounds = Math.min(AUTO_FORECAST_TURNS, Math.max(0.5, foes.reduce((s, e) => s + e.hp, 0) / Math.max(1, ctx.ourDps)));
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
function dmgValue(ctx, t, dmg, scattered = false) {
  if (!(dmg > 0)) return 0;
  const eff = Math.min(dmg, t.hp);
  return eff * ctx.dmgK + (!scattered && dmg >= t.hp * 0.95 ? ctx.threat(t) * KILL_W : 0);
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
  const mk = (target) => ({ action: "spell", spellKey: key, target, dmg: 0, raw: 0, lowDamage: true, heal: 0, revive: 0, guard: 0, edge: 0, stat: 0, pen: 0, kills: 0 });
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
      let dSum = 0; // この手で与える傷の合計 (刃の癒しの見積もり)
      for (const t of tgts) {
        let d = 0;
        if (sp.kind === "phys") {
          const popt = { power: sp.power * skillPowerMul(actor, sp), critBonus: sp.critBonus, element: sp.element, intScale: sp.intScale, agiScale: sp.agiScale,
            vitScale: sp.vitScale, pieScale: sp.pieScale, acc: sp.acc, sureHit: sp.sureHit, pierce: sp.pierce, desperate: sp.desperate, execute: sp.execute, prey: sp.prey, skill: true };
          const per = autoPhys(b, actor, t, popt);
          d = sp.scatter ? scatterDamage(per, sp.scatter, tgts.length, t.hp) : per * (sp.hits || 1);
        } else if (sp.kind === "atk") d = autoSpell(b, actor, sp, t);
        c.raw += Math.min(d, t.hp);
        if (!lowDamage(d, t)) c.lowDamage = false;
        dSum += Math.min(d, t.hp);
        const v = dmgValue(ctx, t, d, !!sp.scatter && tgts.length > 1) * (t.mind === "charm" ? CHARMED_TGT_MUL : 1);
        // 即死: 主には効かない。当たれば残りのHPぶんの傷と同じ
        let deathRate = 0;
        if (sp.instakill && !t.boss && !isMetal(t) && d < t.hp && (!sp.instakill.races || sp.instakill.races.includes(t.mon && t.mon.race))) {
          const p = autoStatusChances(b, actor, sp, t).find(r => r.kind === "death")?.rate || 0;
          deathRate = p;
          c.death = (c.death || 0) + p * ((t.hp - d) * ctx.dmgK + ctx.threat(t) * KILL_W);
        }
        finishEstimate(c, t, d, !!sp.scatter && tgts.length > 1, deathRate);
        c.dmg += v;
        if (d < t.hp * 0.9) {
          c.stat += foeEffects(b, ctx, actor, sp, t);
          if (sp.poison && !t.ailment && !isMetal(t)) {
            const rate = autoStatusChances(b, actor, sp, t).find(r => r.kind === "poison")?.rate || 0;
            c.poisonDamage = (c.poisonDamage || 0) + rate * Math.min(t.hp - d, (t.boss ? Math.max(0.05, sp.poison.pct * 0.5) : sp.poison.pct) * t.maxhp * ctx.left(3)) * ctx.dmgK;
          }
        }
        if (sp.drain) c.heal += Math.min(d * sp.drain, actor.maxhp - actor.hp) * healUrg(ctx, actor, W);
      }
      if (sp.partyHeal) for (const a of ctx.allies) c.heal += Math.min(b.estPartyHeal(actor, sp.partyHeal), a.maxhp - a.hp) * healUrg(ctx, a, W);
      if (sp.bladeHeal) for (const a of ctx.allies) c.heal += Math.min(b.estBladeHeal(actor, sp, dSum, a), a.maxhp - a.hp) * healUrg(ctx, a, W);
      if (sp.debuffAll) for (const t of b.livingEnemies()) c.stat += statMods(b, ctx, sp.debuffAll, sp.dur, t);
      if (sp.kind === "sleep") for (const t of b.livingEnemies()) {
        if (t.asleep || isMetal(t)) continue;
        c.stat += autoRate(b, actor, t, 0.6, "sleep") * ctx.threat(t) * Math.min(2, ctx.rounds) * 0.5;
      }
      hpPen(c);
      // 無効の追加効果は0点。攻撃や他の効果に価値があれば、技の候補は残す。
      if (c.dmg > 0 || c.death > 0 || c.poisonDamage > 0 || c.stat > 0 || c.heal > 0 || sp.debuff || sp.vuln) out.push(c);
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
  if (!t.alive || isMetal(t) || (sp.kind === "phys" && t.physResist >= 100) || (sp.kind === "atk" && t.magResist >= 100)) return 0;
  const th = ctx.threat(t);
  const rates = autoStatusChances(b, actor, sp, t);
  const rate = (x, kind) => rates.find(r => r.kind === kind)?.rate || 0;
  let v = 0;
  if (sp.para && !t.ailment) v += rate(sp.para, "paralyze") * th * Math.min(2, ctx.rounds) * 0.6;
  if (sp.sleepChance && !t.asleep) v += rate(sp.sleepChance, "sleep") * th * Math.min(2, ctx.rounds) * 0.5;
  if (sp.charm && !t.mind) v += rate(sp.charm, "charm") * th * Math.min(2, ctx.rounds) * 1.2;
  if (sp.confuse && !t.mind) v += rate(sp.confuse, "confuse") * th * Math.min(2, ctx.rounds) * 0.8;
  if (sp.seal && (t.ability || t.role) && b._bm(t, "seal") >= 1) v += rate(sp.seal.chance, "seal") * th * 0.6 * ctx.left(sp.seal.turns || 3);
  if (sp.flinchChance && !t.boss && !t._flinch) v += rate(sp.flinchChance, "flinch") * th;
  if (sp.strip && (t.effects || []).some((e) => e.mult > 1)) v += th * 0.5 * Math.min(2, ctx.rounds);
  // 大技の予兆: 封じ・眠り・麻痺・魅了・混乱・怯み・打ち消しのどれかが通れば溜めた力が霧散する
  if (b._omenOf && b._omenOf(t)) {
    let keep = 1;
    if (sp.seal) keep *= 1 - rate(sp.seal.chance, "seal");
    if (sp.para && !t.ailment) keep *= 1 - rate(sp.para, "paralyze");
    if (sp.sleepChance && !t.asleep) keep *= 1 - rate(sp.sleepChance, "sleep");
    if (sp.charm && !t.mind) keep *= 1 - rate(sp.charm, "charm");
    if (sp.confuse && !t.mind) keep *= 1 - rate(sp.confuse, "confuse");
    if (sp.flinchChance && !t.boss) keep *= 1 - rate(sp.flinchChance, "flinch");
    if (sp.strip) keep = 0;
    v += (1 - keep) * th * 0.5; // threat は予兆で2倍にしてある。その上乗せ分を防ぐ
  }
  if (sp.debuff) v += statMods(b, ctx, sp.debuff, sp.dur, t);
  // 防御・素早さ・属性耐性の弱体による与ダメ増分は3ターンの予測で数える。
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
    const hp = sp.revivePct ? a.maxhp * sp.revivePct : Math.min(a.maxhp, b.estHeal(actor, sp, a));
    c.revive += hp * 0.5 + a.maxhp * 0.5 + ctx.basic(a) * ctx.dmgK * 2;
    return;
  }
  const n = ctx.left(sp.dur);
  if (healsHp(sp)) c.heal += Math.min(b.estHeal(actor, sp, a), a.maxhp - a.hp) * healUrg(ctx, a, W);
  if (sp.kind === "mana") {
    const gain = Math.min(manaGiftAmount(actor, sp, (sp.power + (actor.int || 0) * 0.25) * skillPowerMul(actor, sp)), (a.maxmp || 0) - a.mp);
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
    // 攻めに使う能力の強化は実際の見積もり式で3ターンの増分を計算する。
    if (k === "vit") c.guard += up * b._evit(a) * 0.5 * ctx.hitsOn(a) * n;
  }
  const wounded = ctx.allies.some((p) => p !== a && p.maxhp && p.hp < p.maxhp * 0.5);
  const sturdy = a.maxhp && a.hp > a.maxhp * 0.5;
  // 引き付けると硬くなる盾役 (tauntGuard) は、引き受けた分の傷そのものが減るので値打ちが上がる
  if (sp.taunt && b._bm(a, "taunt") <= 1 && sturdy && ctx.allies.length > 1) c.guard += ctx.threatSum * (wounded ? 0.4 : 0.15) * n * (1 + 2 * tauntGuard(a));
  // 受け止め: 渾身の一撃を溜めている敵がいれば、引き付けた者が必ずそれを受ける (隊の誰かに落ちる大技を硬い者が引き取る)
  if (sp.taunt && b._bm(a, "taunt") <= 1 && sturdy && ctx.allies.length > 1 && b._omenOf) for (const e of ctx.foes) {
    const om = b._omenOf(e);
    if (om && om.kind === "smash") c.guard += ctx.threat(e) * (0.5 + 2 * tauntGuard(a));
  }
  if (sp.shield && b._bm(a, "shield") <= 1 && sturdy && wounded) c.guard += ctx.maxThreat * n * 0.6;
  if (sp.stance === "counter" && b._bm(a, "ctr") <= 1) c.edge += ctx.hitsOn(a) * ctx.basic(a) * ctx.dmgK * 0.8 * stanceMulOf(sp) * n;
  const casters = ctx.foes.filter((e) => e.ability === "breath" || e.ability === "spell");
  if (casters.length) {
    const th = casters.reduce((s, e) => s + ctx.threat(e), 0);
    // 反射の陣: 呪文・ブレスの使い手がいる時、受けるたびに唱えた者の魔力 × 係数で返す見込み
    if (sp.reflect && b._bm(a, "rfl") <= 1) c.edge += casters.length * Math.max(actor.int || 0, actor.pie || 0) * sp.reflect * ctx.dmgK * 0.3 * n;
    if (sp.ward) for (const w in sp.ward) {
      if (b._bm(a, w === "breath" ? "wardB" : "wardS") > 1) continue;
      if (casters.some((e) => e.ability === w)) c.guard += sp.ward[w] * th / Math.max(1, ctx.allies.length) * n * 0.5;
    }
    if (sp.grantBarrier && !(a._barrierLeft > 0)) c.guard += th * 0.3 / Math.max(1, ctx.allies.length);
  }
  if (sp.grantEndure && !a._grantEndure && a.maxhp && a.hp < a.maxhp * 0.5) c.guard += a.maxhp * 0.3;
}
