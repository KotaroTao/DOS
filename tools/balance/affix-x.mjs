// 無限迷宮の追加の特性「極」(X01〜X35、2026-10-15 ユーザーの決定) の検査。
// 台帳 (部位ごとに6つ・旧い極は拾えない) と、戦闘・魂の処理で効果が実際に出るかを1つずつ確かめる。
//   node tools/balance/affix-x.mjs
import assert from "node:assert/strict";
import { Battle, SPELLS, spellCost } from "../../src/combat.js";
import { makeDoll, subPickCap, subPickCapFor, kindleSubIndex, setSharedSouls, makeSoulInstance, recalcDoll, SOUL_CLASSES, SOUL_KEYS, rankThresholds, soulLevelCap } from "../../src/souls.js";
import { decideAuto } from "../../src/autotactics.js";
import { MONSTERS } from "../../src/sprites.js";
import { DUNGEON_MONSTERS } from "../../src/dungeons/index.js";
import { AFX, afxDef, rollAffixes, applyAffixes } from "../../src/infaffix.js";
import { recalc, ITEMS, registerAffixes } from "../../src/items.js";
import { applyAffixes as aa, gearPerks } from "../../src/infaffix.js";
import { useMathRandom } from "../../src/rng.js";
import { CATALOG_ITEMS } from "../../src/catalog/index.js";
useMathRandom();
for (const k in CATALOG_ITEMS) if (!ITEMS[k]) ITEMS[k] = CATALOG_ITEMS[k];
registerAffixes(aa, gearPerks);
Object.assign(MONSTERS, DUNGEON_MONSTERS);
let seed = 777;
const fixed = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
Math.random = fixed;
const withRand = (v, fn) => { const r = Math.random; Math.random = typeof v === "function" ? v : () => v; try { return fn(); } finally { Math.random = r; } };

// ---- 台帳 ----
const xs = AFX.filter((d) => d.tier === "x");
for (const g of ["w", "body", "head", "hands", "feet", "acc"]) {
  assert.equal(xs.filter((d) => !d.retired && d.slots.includes(g)).length, 6, `部位 ${g} の極は6つ`);
}
for (const id of ["J02", "J10", "J11"]) assert.ok(afxDef(id).retired, `${id} は拾えない`);
for (let i = 1; i <= 35; i++) { const d = afxDef(`X${String(i).padStart(2, "0")}`); assert.ok(d && d.tier === "x" && d.text(1, 1).length > 8, `X${i} の説明`); }
// 深い階で何度振っても旧い極は付かない
{
  const tmpl = Object.values(ITEMS).find((it) => it.slot === "acc" && it.price > 0 && !it.cursed);
  let x = 0;
  for (let i = 0; i < 4000; i++) {
    const it = { ...tmpl, lv: 150 };
    const afx = rollAffixes(it, 300, () => (i % 7) / 7 + 0.0001 * (i % 11)) || [];
    for (const a of afx) { assert.ok(!afxDef(a.k).retired, `旧い極 ${a.k} が付いた`); if (afxDef(a.k).tier === "x") x++; }
  }
}
// 品に付けると afxMisc / afxFx になる
const itemWith = (slot, k) => {
  const tmpl = Object.values(ITEMS).find((it) => it.slot === slot && it.price > 0 && !it.cursed && !it.forJob && !it.cls);
  const it = applyAffixes({ ...JSON.parse(JSON.stringify(tmpl)), afx: [{ k, v: 1 }] });
  return it;
};
assert.ok(itemWith("head", "X12").afxMisc.steadMind);
assert.ok(itemWith("head", "X13").afxFx.some((f) => f.c.t === "deal" && f.c.when.tgtWeak));

const doll = (name = "検証") => Object.assign(makeDoll(name), { level: 40, jobLv: 40, atk: 100, vit: 60, agi: 100, int: 120, pie: 130, luk: 30, hp: 5000, maxhp: 5000, mp: 500, maxmp: 500, critBonus: 0 });
const foe = (o = {}) => ({ uid: Math.random(), name: "検証の敵", key: "bs_ghoul", mon: MONSTERS.bs_ghoul, side: "enemy", alive: true, hp: 100000, maxhp: 100000, atk: 80, vit: 20, agi: 20, int: 40, pie: 40, luk: 8, lv: 40, element: "none", spells: [], gold: 100, soul: 10, ...o });
const misc = (a, m) => { a.gearMisc = { ...(a.gearMisc || {}), ...m }; return a; };
const battle = (party, enemies, logs = []) => { const b = new Battle(party, enemies, (l) => logs.push(l)); return b; };
const hasLog = (logs, s) => logs.some((l) => String(l).includes(s));

// X01 連なる刃の
{
  const a = misc(doll(), { chain: true }), e1 = foe({ hp: 1 }), e2 = foe(), logs = [];
  const b = battle([a], [e1, e2], logs);
  const hp2 = e2.hp;
  withRand(0.5, () => b._exec({ actor: a, action: "attack", target: e1 }));
  assert.ok(!e1.alive && e2.hp < hp2 && hasLog(logs, "連なる刃"), "連なる刃: 倒すと別の敵へ一撃");
}
// X02 双魂の
{
  const a = doll(), t = foe({ physResist: 100, magResist: 0 });
  let b = battle([a], [t]);
  assert.ok(withRand(0.5, () => b._physical(a, t, { acc: 1 })).immune, "双魂なしは物理無効");
  misc(a, { twinSoul: true }); b = battle([a], [t]);
  const h = withRand(0.5, () => b._physical(a, t, { acc: 1 }));
  assert.ok(!h.immune && h.dmg > 0, "双魂: 低い方 (魔法0) で通る");
}
// X03 伝染の
{
  const a = misc(doll(), { contagion: true }), es = [foe(), foe(), foe()], logs = [];
  const b = battle([a], es, logs);
  withRand(0, () => b._inflict(a, es[1], { name: "痺れ", para: 0.6 }, []));
  assert.ok(es.every((e) => e.ailment === "paralyze") && hasLog(logs, "伝染"), "伝染: 両隣にも麻痺");
}
// X04 くさびの
{
  const a = misc(doll(), { wedge: true }), t = foe({ physResist: 50 });
  const b = battle([a], [t]);
  for (let i = 0; i < 5; i++) withRand(0.5, () => b._physical(a, t, { acc: 1 }));
  assert.equal(t._wedge, 30, "くさび: −30 で止まる");
  const s = foe({ physResist: 100 }); b.enemies.push(s);
  withRand(0.5, () => b._physical(a, s, { acc: 1 }));
  assert.ok(!s._wedge, "くさび: 抵抗値100には効かない");
  const boss = foe({ physResist: 60, boss: true }); b.enemies.push(boss);
  for (let i = 0; i < 4; i++) withRand(0.5, () => b._physical(a, boss, { acc: 1 }));
  assert.equal(boss._wedge, 20, "くさび: 主は −20 まで");
}
// X05 見届けの
{
  const a = misc(doll(), { witness: true }), t = foe(), u = foe();
  const b = battle([a], [t, u]);
  b.queue = [t, u];
  withRand(0, () => b._physical(a, t, { acc: 1, critBonus: 1 }));
  assert.equal(b.queue[b.queue.length - 1], t, "見届け: 会心でその敵の手番を最後へ");
}
// X06 剥がしの
{
  const a = misc(doll(), { peel: true }), t = foe();
  const b = battle([a], [t]);
  b._applyMod(t, "atk", 1.5, 3, "鼓舞");
  t.effects.push({ stat: "omen", mult: 1.01, turns: 3 });
  withRand(0.5, () => b._exec({ actor: a, action: "attack", target: t }));
  assert.ok(!t.effects.some((e) => e.stat === "atk") && t.effects.some((e) => e.stat === "omen"), "剥がし: 強化は消え、溜めは残る");
}
// 敵の一撃 (actor = 敵)
const bigFoe = (o) => foe({ atk: 9000, ...o });
// X07 金城の
{
  const p = misc(doll(), { fortress: 0.5 }), e = bigFoe();
  const b = battle([p], [e]);
  const h = withRand(0.99, () => b._physical(e, p, { acc: 1, power: 3 }));
  assert.ok(h.dmg <= 2500, `金城: 最大HPの50%まで (${h.dmg})`);
}
// X08 痛み分けの
{
  const p = misc(doll(), { split: 0.5 }), e = foe({ atk: 2000 });
  const b = battle([p], [e]);
  const hp0 = p.hp;
  const h = withRand(0.99, () => b._physical(e, p, { acc: 1 }));
  const later = p._splitQ.reduce((x, y) => x + y, 0);
  assert.ok(later > 0 && hp0 - p.hp === h.dmg, "痛み分け: 半分を後に回す");
  b.queue = []; withRand(0.99, () => b._startRound());
  assert.ok(p._splitQ.length === 1, "痛み分け: 次のターンの初めに受ける");
}
// X09 肩代わりの
{
  const p = doll("倒れかけ"), c = misc(doll("肩代わり"), { cover: true }), e = foe({ atk: 4000 });
  p.hp = 10;
  const b = battle([p, c], [e]);
  const h = withRand(0.99, () => b._physical(e, p, { acc: 1 }));
  assert.ok(p.alive && p.hp === 10 && h.target === c && c.hp < 5000, "肩代わり: 持ち主が代わりに受ける");
  p.hp = 10;
  const h2 = withRand(0.99, () => b._physical(e, p, { acc: 1 }));
  assert.ok(!p.alive, "肩代わり: 1戦闘に1度");
}
// X10 送り火の
{
  const p = misc(doll("送り火"), { sendoff: 0.2 }), q = doll("仲間");
  const b = battle([p, q], [foe()]);
  q.hp = 100; q.ailment = "poison";
  p.hp = 0; b._die(p);
  assert.ok(q.hp === 1100 && !q.ailment, "送り火: 20%回復・状態異常を1つ治す");
}
// X11 逆境の
{
  const p = misc(doll(), { adversity: true });
  const b = battle([p], [foe()]);
  p.hp = 2500; assert.equal(b._gearGuard(p, 1000, "phys"), 800, "逆境: HP50%以下で −20%");
  p.hp = 1000; assert.equal(b._gearGuard(p, 1000, "phys"), 600, "逆境: HP25%以下で −40%");
}
// X12 不動心の
{
  const p = doll();
  p.equip.head = itemWith("head", "X12");
  recalc(p);
  assert.ok(p.resists.charm === 100 && p.resists.confuse === 100 && p.resists.seal === 100, "不動心: 魅了・混乱・封印の抵抗値100");
  const e = foe({ ability: "dispel" }), logs = [];
  const b = battle([p], [e], logs);
  b._applyMod(p, "atk", 1.5, 3, "鼓舞");
  b._exec({ actor: e, action: "special", kind: "dispel", target: p });
  assert.ok(p.effects.some((x) => x.stat === "atk"), "不動心: 打ち消しで強化が剥がれない");
  assert.equal(b._applyMod(p, "seal", 0.5, 3, "封印"), 0, "不動心: 封印は効かない");
}
// X13 見抜きの (fx: 弱点で与ダメ+30%)
{
  const p = doll();
  p.equip.head = itemWith("head", "X13");
  recalc(p);
  const t = foe({ element: "earth" });
  const b = battle([p], [t]);
  assert.equal(b._perkSum(p, "deal", { tgt: t, el: "wind", on: ["phys"] }), 0.3, "見抜き: 弱点の属性で +30%");
  assert.equal(b._perkSum(p, "deal", { tgt: t, el: "fire", on: ["phys"] }), 0, "見抜き: 弱点でなければ 0");
}
// X14 冴えの
{
  const sp = Object.keys(SPELLS).find((k) => SPELLS[k].kind === "atk" && SPELLS[k].target === "enemy" && !SPELLS[k].gravity && !SPELLS[k].critBonus);
  const shot = (sae) => {
    const p = sae ? misc(doll(), { sae: true }) : doll(), t = foe();
    const b = battle([p], [t]);
    const res = { hits: [] };
    withRand(0.12, () => b._cast(p, { actor: p, spellKey: sp, target: t }, res));
    return res.hits[0];
  };
  assert.ok(!shot(false).crit && shot(true).crit, "冴え: 呪文の会心率 +15%");
}
// X15 記憶の
{
  const p = misc(doll(), { memory: true }), t = foe();
  const key = Object.keys(SPELLS).find((k) => SPELLS[k].kind === "atk" && SPELLS[k].target === "enemy" && SPELLS[k].mp >= 6 && !SPELLS[k].gravity);
  const heal = "DIAL";
  const b = battle([p], [t]);
  const full = spellCost(p, SPELLS[key]);
  b._exec({ actor: p, action: "spell", spellKey: key, target: t });
  assert.equal(b.costOf(p, SPELLS[key], key), Math.ceil(full / 2), "記憶: 同じ技は半分");
  const mp0 = p.mp; b._exec({ actor: p, action: "spell", spellKey: key, target: t });
  assert.equal(mp0 - p.mp, Math.ceil(full / 2), "記憶: 実際の消費も半分");
  b._exec({ actor: p, action: "spell", spellKey: heal, target: p });
  b._exec({ actor: p, action: "spell", spellKey: heal, target: p });
  assert.equal(b.costOf(p, SPELLS[heal], heal), spellCost(p, SPELLS[heal]), "記憶: 回復の技は半分にならない");
}
// X16 警鐘の
{
  const p = misc(doll(), { alarm: true }), q = doll();
  const b = new Battle([p, q], [foe(), foe()], () => {}, { opening: "ambush" });
  assert.ok(b.current === p || b.queue.includes(p), "警鐘: 奇襲の1ターン目に動ける");
  assert.ok(b.current !== q && !b.queue.includes(q), "警鐘: 持たない者は動けない");
}
// X18 早業の
{
  const p = misc(doll(), { quick: true });
  const herb = { ...ITEMS.herb }; p.items = [herb];
  const b = battle([p], [foe()]);
  p.hp = 100;
  b.pending = { actor: p, action: "item", item: herb, owner: p, target: p };
  b.commit();
  assert.equal(b.queue[0], p, "早業: 道具の後にもう一度");
  assert.ok(p._quickUsed, "早業: 1戦闘に1回");
}
// X19 投げ打ちの
{
  const bomb = { ...ITEMS.u_firebomb };
  const hurl = (thr) => {
    const p = thr ? misc(doll(), { throw: true }) : doll(), t = foe();
    p.items = [bomb];
    const b = new Battle([p], [t], () => {}, { foeLv: 100 });
    const res = { hits: [] };
    withRand(0.5, () => b._useItem(p, { actor: p, item: bomb, owner: p, target: t }, res));
    return res.hits[0].dmg;
  };
  const n = hurl(false), x = hurl(true);
  assert.ok(x > n * 8, `投げ打ち: 推奨Lv100で大きく伸びる (${n} → ${x})`);
}
// X20 連携の
{
  const p = doll("先"), q = doll("連携");
  q.equip.hands = itemWith("hands", "X20"); recalc(q);
  const t = foe();
  const b = battle([p, q], [t]);
  assert.equal(b._perkSum(q, "deal", { tgt: t, on: ["phys"] }), 0, "連携: 直前の味方がいなければ 0");
  withRand(0.5, () => b._exec({ actor: p, action: "attack", target: t }));
  assert.equal(b._perkSum(q, "deal", { tgt: t, on: ["phys"] }), 0.25, "連携: 同じ敵なら +25%");
  assert.equal(b._perkSum(q, "deal", { tgt: foe(), on: ["phys"] }), 0, "連携: 別の敵なら 0");
}
// X21 受け流しの
{
  const p = misc(doll(), { parryHold: true }), e = foe();
  const b = battle([p], [e]);
  b._exec({ actor: p, action: "defend" });
  assert.ok(withRand(0.99, () => b._physical(e, p, { acc: 1 })).miss, "受け流し: 1回かわす");
  assert.ok(!withRand(0.99, () => b._physical(e, p, { acc: 1 })).miss, "受け流し: 2回目は受ける");
}
// X22 慈しみの
{
  const p = misc(doll("癒し手"), { mercy: 0.5 }), q = doll("傷");
  q.hp = 1000;
  const b = battle([p, q], [foe()]);
  const res = { hits: [] };
  withRand(0.5, () => b._cast(p, { actor: p, spellKey: "MADIOS", target: p }, res));
  assert.ok(q.hp > 1000, "慈しみ: 余った癒しが隊へ");
}
// X23 かすめ取りの
{
  const p = misc(doll(), { pilfer: 0.1 }), t = foe({ gold: 200 });
  const b = battle([p], [t]);
  withRand(0.05, () => b._physical(p, t, { acc: 1 }));
  assert.ok(t._stolen && b.bonusGold === 120, "かすめ取り: 盗むと同じく6割");
}
// X24 踏み込みの
{
  const ps = [doll("1"), doll("2"), doll("3"), misc(doll("後列"), { stepIn: true })];
  const b = battle(ps, [foe()]);
  assert.equal(b._outRowMul(ps[3]), 1, "踏み込み: 後列の近い武器も半分にならない");
  ps[3].gearMisc = null;
  assert.equal(b._outRowMul(ps[3]), 0.5, "踏み込み: 持たなければ半分");
}
// X25 残影の
{
  const p = misc(doll(), { afterImage: 0.3 }), e = foe();
  const b = battle([p], [e]);
  withRand(0.0001, () => b._physical(e, p, {}));
  assert.ok(p._afterImg, "残影: かわすと構える");
  const t = foe();
  const h = withRand(0.5, () => b._physical(p, t, { acc: 1 }));
  assert.ok(!p._afterImg && h.dmg > 0, "残影: 次の物理で使う");
}
// X26 二度駆けの
{
  const p = misc(doll(), { dash: true }), e = foe();
  const b = battle([p], [e]);
  b.queue = [];
  withRand(0.01, () => b._startRound());
  assert.equal(b.queue.filter((x) => x === p).length, 2, "二度駆け: 2回動く");
  assert.equal(p._againRound, b._roundNo, "二度駆け: 時間跳躍とは重ならない");
}
// X27 地踏みの
{
  const p = misc(doll(), { steady: true });
  const b = battle([p], [foe()]);
  assert.equal(b._applyMod(p, "agi", 0.5, 3, "冷気"), 0, "地踏み: 弱体を受けない");
  assert.ok(b._applyMod(p, "atk", 1.5, 3, "鼓舞") > 0, "地踏み: 強化は受ける");
}
// X28 追い足の
{
  const mt = (chase) => {
    const p = chase ? misc(doll(), { chaser: true }) : doll();
    const e = foe({ metal: 1, name: "銀業" });
    const b = battle([p], [e]);
    b.current = e; b.phase = "enemy";
    withRand(0.2, () => b.enemyAct());
    return !e.alive;
  };
  assert.ok(mt(false) && !mt(true), "追い足: 逃げる率が半分");
}
// X30 宿り火の
{
  const d = doll();
  assert.equal(kindleSubIndex(d), -1);
  d.equip.acc = itemWith("acc", "X30");
  d.subs = [{ uid: -1, picks: [] }];
  assert.equal(kindleSubIndex(d), -1, "宿り火: サブ魂が無ければ増えない");
  const lo = makeSoulInstance("thief", 1, 30), hi = makeSoulInstance("mage", 12, 30);
  setSharedSouls([lo, hi]);
  d.subs = [{ uid: lo.uid, picks: [] }, { uid: hi.uid, picks: [] }];
  assert.equal(kindleSubIndex(d), 1, "宿り火: ランクの高い方のサブ魂");
  assert.equal(subPickCapFor(d, d.subs[1]), subPickCap(hi) + 1, "宿り火: 借りる数 +1");
  assert.equal(subPickCapFor(d, d.subs[0]), subPickCap(lo), "宿り火: もう一方は変わらない");
  d.equip.acc = null;
  assert.equal(subPickCapFor(d, d.subs[1]), subPickCap(hi), "宿り火: 外せば元に戻る");
  setSharedSouls([]);
}
// X17 慧眼の: オートの判断が例外なく回る (見積もりの窓口だけ変わる)
{
  const p = misc(doll(), { insight: true }), t = foe({ element: "earth" });
  const b = battle([p], [t]);
  b.current = p;
  assert.ok(decideAuto(b, p), "慧眼: オートが手を選ぶ");
}
// X31 時告げの
{
  const p = misc(doll(), { timeKeeper: true }), t = foe();
  const b = battle([p], [t]);
  b._actor = p; b._applyMod(t, "atk", 0.8, 3, "弱体"); b._actor = null;
  assert.equal(t.effects.find((e) => e.stat === "atk").turns, 4, "時告げ: 持続 +1");
}
// X32 縛り目の
{
  const p = Object.assign(misc(doll(), { binder: true }), { jobLv: 10 }), t = foe({ lv: 60 });
  const b = battle([p], [t]);
  assert.equal(Math.round(b._rate(p, t, 0.5) * 100), 50, "縛り目: Lv差で下がらない");
  assert.ok(b._rate(p, t, 0.5, "death") < 0.5, "縛り目: 即死は除く");
}
// X33 裏返しの
{
  const p = misc(doll(), { flip: true });
  const b = battle([p], [foe()]);
  b._applyMod(p, "vit", 0.5, 3, "弱体");
  assert.equal(b.stageOf(p, "vit"), 3, "裏返し: 底で +3段に");
  b._applyMod(p, "atk", 0.5, 3, "弱体");
  assert.equal(b.stageOf(p, "atk"), -3, "裏返し: 1戦闘に1度");
}
// ---- 乱戦: 極をすべて付けた隊 (36職を6人ずつ) で例外・非数値・無効な手が出ないか ----
{
  const ALL = { chain: true, twinSoul: true, contagion: true, wedge: true, witness: true, peel: true, fortress: 0.5, split: 0.5, cover: true, sendoff: 0.2,
    adversity: true, steadMind: true, sae: true, memory: true, alarm: true, insight: true, quick: true, throw: true, parryHold: true, mercy: 0.5, pilfer: 0.1,
    stepIn: true, afterImage: 0.3, dash: true, steady: true, chaser: true, kindle: true, timeKeeper: true, binder: true, flip: true, treasure: true, teller: true };
  const jobs = SOUL_KEYS.filter((k) => !SOUL_CLASSES[k].unique);
  let fights = 0;
  for (let g = 0; g < jobs.length; g += 6) {
    for (const opening of [null, "ambush", "preempt"]) {
      const souls = [], party = [];
      for (const job of jobs.slice(g, g + 6)) {
        const s = makeSoulInstance(job, rankThresholds(SOUL_CLASSES[job].rarity)[2], 80);
        s.capBonus = Math.max(0, 80 - soulLevelCap(job, s.count));
        souls.push(s);
      }
      setSharedSouls(souls);
      for (const s of souls) { const d = makeDoll(SOUL_CLASSES[s.clsKey].label); d.primary = s.uid; recalcDoll(d); d.hp = d.maxhp; d.mp = d.maxmp; d.gearMisc = { ...ALL }; party.push(d); }
      const foes = Array.from({ length: 5 }, (_, i) => foe({ name: "乱戦" + i, atk: party[0].atk * 2, vit: 30, hp: party[0].atk * 25, maxhp: party[0].atk * 25, lv: 80,
        ability: ["dispel", "sunder", "confuse", "breath", "spell"][i], abRate: 0.5, physResist: [0, 50, 100, 0, 75][i], magResist: [0, 0, 0, 100, 0][i], metal: i === 4 && g === 0 ? 1 : undefined }));
      const b = new Battle(party, foes, () => {}, { foeLv: 80, fleeK: 1 / 0.3, opening });
      let n = 0;
      while (!b.result && n++ < 800) {
        if (b.phase === "input") {
          const a = b.current, c = decideAuto(b, a);
          const r = b.chooseAction(c.action, c.spellKey);
          assert.ok(!r.invalid, `乱戦: 無効な手 ${a.jobKey} ${JSON.stringify(c.spellKey || c.action)}`);
          if (r.needTarget) b.chooseTarget(c.target);
          b.commit();
        } else if (b.phase === "enemy") b.enemyAct();
        else if (b.phase === "stunned") b.stunnedAct();
        else throw new Error("phase " + b.phase);
        for (const a of [...b.party, ...b.enemies]) assert.ok(Number.isFinite(a.hp) && Number.isFinite(a.mp ?? 0), `乱戦: 非数値 ${a.name}`);
        if (!b.result) b.advance();
      }
      fights++;
    }
  }
  setSharedSouls([]);
  console.log(`乱戦 ${fights}戦 (極をすべて付けた36職・通常/奇襲/先制): 例外なし`);
}
console.log("極35種: 台帳 (部位ごと6つ・旧い極は拾えない) と効果を確認 (浮き足の・宝呼びの・語り部の・慧眼の は game.js / autotactics.js)");
