// 二刀流 (修羅のランクのパッシブ) と時間跳躍 (賢者のランクのパッシブ) を、実際の装備・戦闘・最適装備で確かめる。
//   node tools/balance/dual-wield.mjs
import assert from "node:assert/strict";
import { ITEMS, recalc, equip, unequip, canOffhand, offhandPower, attackPower, fightPower, DUAL_WIELD_RATES, DUAL_SKILL_SHARE } from "../../src/items.js";
import { CATALOG_ITEMS } from "../../src/catalog/index.js";
import { Battle, SPELLS } from "../../src/combat.js";
import { planBestEquip, previewStats, slotKeysFor, trialEquip } from "../../src/autoequip.js";
import { makeDoll, makeSoulInstance, setSharedSouls, recalcDoll, soulRankFromCount, PASSIVES, JOB_PASSIVES } from "../../src/souls.js";
import { decideAuto } from "../../src/autotactics.js";

Object.assign(ITEMS, CATALOG_ITEMS);
const weapons = Object.values(ITEMS).filter((it) => it.slot === "weapon" && !it.unidentified && !it.classes && !it.forJob);
const one = (cat, skip = 0) => weapons.filter((w) => w.cat === cat && !w.twoHanded).sort((a, b) => a.lv - b.lv)[20 + skip];
const two = (cat) => weapons.find((w) => w.cat === cat && w.twoHanded);
const countFor = (key, rank) => { let c = 1; while (soulRankFromCount(key, c) < rank) c++; return c; };

// ---- 削除・差し替え ----
assert(!PASSIVES.asuraMugen && !PASSIVES.sageKiwami, "無限の闘争・叡智の極みは削除");
assert.equal(PASSIVES.asuraNitou.label, "二刀流");
assert.equal(PASSIVES.sageJikan.label, "時間跳躍");
assert.deepEqual(JOB_PASSIVES.asura.map((r) => r.grants), [1, 2, 3, 4].map((lv) => ({ asuraNitou: lv })), "修羅のランクのパッシブ = 二刀流");
assert.deepEqual(JOB_PASSIVES.sage.map((r) => r.grants), [1, 2, 3, 4].map((lv) => ({ sageJikan: lv })), "賢者のランクのパッシブ = 時間跳躍");

const souls = [];
const doll = (key, rank, { level = 60, sub = null } = {}) => {
  const s = makeSoulInstance(key, countFor(key, rank), level); souls.push(s);
  const d = makeDoll(key); d.primary = s.uid;
  if (sub) {
    const ss = makeSoulInstance(sub.key, countFor(sub.key, sub.rank), level); souls.push(ss);
    d.subs = [{ uid: ss.uid, picks: [{ passive: "asuraNitou" }], picked: true }];
  }
  setSharedSouls(souls);
  recalcDoll(d);
  d.hp = d.maxhp; d.mp = d.maxmp;
  return d;
};

// ---- ランクごとの割合 ----
for (const rank of [1, 2, 3, 4, 5]) {
  const d = doll("asura", rank);
  assert.equal(d.dualWield, DUAL_WIELD_RATES[rank - 1], "修羅 R" + rank);
}
assert.deepEqual(DUAL_WIELD_RATES.slice(1), [0.4, 0.6, 0.8, 1.0]);

// ---- 装備の規則 ----
const a = doll("asura", 3);
const ls = one("ls"), kt = one("kt"), ls2 = one("ls", 3), big = two("ax"), bow = two("bw");
assert(ls && kt && ls2 && big, "検証用の武器");
assert(canOffhand(a, kt) && !canOffhand(a, big) && !canOffhand(a, bow), "左手は片手武器だけ");
assert.deepEqual(slotKeysFor(kt, a), ["weapon", "shield"]);
assert.deepEqual(slotKeysFor(big, a), ["weapon"]);
const r1 = doll("asura", 1);
assert(!canOffhand(r1, kt), "R1 (二刀流なし) は左手に武器を持てない");
assert(!equip(r1, kt, "shield").ok);
a.items.push(ls, kt);
assert(equip(a, ls).ok);
const mainPow = attackPower(a);
assert.equal(a.offPower, 0);
assert(equip(a, kt, "shield").ok, "左手に装備");
assert.equal(a.equip.shield, kt);
assert.equal(attackPower(a), mainPow, "右手の攻撃力は左手で変わらない (能力補正の分を除く)");
const expectOff = Math.max(1, Math.round(Object.entries(kt.scale).reduce((s, [k, v]) => s + a[k] * v, 0) * 0.6));
assert.equal(a.offPower, expectOff, "左手の攻撃力 = 武器の攻撃力 × 60%");
assert.equal(offhandPower(a), a.offPower);
assert(fightPower(a) > attackPower(a));
// 両手武器を右手に持つと左手の武器は外れる
a.items.push(big);
assert(equip(a, big).ok);
assert.equal(a.equip.shield, null);
assert(a.items.includes(kt) && a.items.includes(ls));
assert.equal(a.offPower, 0);
// 両手武器を持ったまま左手に片手武器 → 両手武器が外れる
assert(equip(a, kt, "shield").ok);
assert.equal(a.equip.weapon, null);
assert(equip(a, ls).ok);
assert(trialEquip(a.equip, big, "weapon").displaced.includes(kt));
assert(unequip(a, "shield").ok && a.offPower === 0);
assert(equip(a, kt, "shield").ok);

// ---- 戦闘: 通常攻撃は右手 + 左手、技は左手の半分 ----
const foe = () => ({ uid: 900, key: "test", name: "検証の敵", mon: { rank: 4, race: "humanoid" }, side: "enemy", lv: 1, hp: 1e9, maxhp: 1e9, atk: 1, vit: 0, agi: 1, alive: true, resists: {} });
{
  const e = foe();
  const b = new Battle([a], [e], () => {});
  assert.equal(b._physAtk(a, { offhand: true }), b._offAtk(a));
  assert.equal(b._offAtk(a), a.offPower, "戦闘の左手の攻撃力 = 表示");
  assert.equal(b._physAtk(a, { skill: true }), b._eatk(a) + Math.round(a.offPower * DUAL_SKILL_SHARE), "物理技は左手の半分");
  assert.equal(b._physAtk(a, { basic: true }), b._eatk(a));
  let hits = 0, n = 0;
  for (let i = 0; i < 40; i++) {
    const res = b._exec({ actor: a, action: "attack", target: e });
    hits += res.hits.length; n++;
  }
  assert.equal(hits, n * 2, "通常攻撃は2回 (右手・左手)");
  const est = b.estBasic(a, e), estMain = b.estPhys(a, e, { basic: true }), estOff = b.estPhys(a, e, { basic: true, offhand: true });
  assert(Math.abs(est - (estMain + estOff)) < 1e-6 && estOff > 0, "オートの見積もりに左手を数える");
  const sk = Object.keys(SPELLS).find((k) => SPELLS[k].kind === "phys" && !SPELLS[k].hits && SPELLS[k].target === "enemy");
  const withOff = b.estPhys(a, e, { skill: true, power: SPELLS[sk].power });
  const save = a.dualRate; a.dualRate = 0;
  const noOff = b.estPhys(a, e, { skill: true, power: SPELLS[sk].power });
  a.dualRate = save;
  assert(withOff > noOff, "物理技の見積もりが左手で伸びる");
  // オートが例外なく手を選ぶ
  for (const t of ["all", "bal", "life", "save", "blade"]) { a.tactic = t; assert(decideAuto(b, a)); }
}
// R5 は左手の攻撃力100%
{
  const d5 = doll("asura", 5);
  d5.items.push(ls2, kt);
  equip(d5, ls2); equip(d5, kt, "shield");
  const raw = Math.round(Object.entries(kt.scale).reduce((s, [k, v]) => s + d5[k] * v, 0));
  assert.equal(d5.offPower, Math.max(1, raw), "R5 = 100%");
}

// ---- サブ魂で借りても効く (今どおり貸せる) ----
{
  const f = doll("fighter", 1, { sub: { key: "asura", rank: 4 } });
  assert.equal(f.dualWield, 0.8, "戦士がサブ魂 (修羅R4) から二刀流を借りる");
  const fw = weapons.filter((w) => w.cat === "ls" && !w.twoHanded).sort((x, y) => x.lv - y.lv)[10];
  assert(canOffhand(f, fw));
  // 二刀流を外せば左手には持てない
  f.subs = []; recalcDoll(f);
  assert.equal(f.dualWield, 0);
  assert(!canOffhand(f, fw));
}

// ---- 最適装備: 空いた左手に片手武器を入れる ----
{
  const d = doll("asura", 3);
  const w1 = one("kt", 5), w2 = one("kt", 4);
  d.items.push(w1, w2);
  equip(d, w1);
  const plan = planBestEquip([d]);
  assert(plan.moves.some((m) => m.slotKey === "shield" && m.item === w2), "最適装備が左手に武器を入れる");
  const ps = previewStats(d, { ...d.equip, shield: w2 });
  assert(ps.offPower > 0 && ps.fight > ps.power);
  // 両手武器 → 片手 + 左手の組も比べる
  const d2 = doll("asura", 5);
  const g = two("ax");
  d2.items.push(g, one("ax"), one("ax", 1));
  equip(d2, g);
  const p2 = planBestEquip([d2]);
  assert(p2.moves.some((m) => m.slotKey === "shield" && m.item.slot === "weapon"), "両手武器から片手 + 左手へ持ち替える組を比べる");
}

// ---- 時間跳躍 (賢者のランク): 手番の後にもう一度動く ----
{
  const s = doll("sage", 5);
  assert.equal(s.passiveMap.sageJikan, 4);
  const e = foe();
  const b = new Battle([s], [e], () => {});
  let again = 0;
  const orig = Math.random;
  Math.random = () => 0; // 必ず発動
  try {
    for (let i = 0; i < 3; i++) {
      b._roundNo = i + 1;
      b.pending = { actor: s, action: "attack", target: e };
      const before = b.queue.length;
      b.commit();
      if (b.queue[0] === s && b.queue.length === before + 1) again++;
      b.queue.shift();
    }
  } finally { Math.random = orig; }
  assert.equal(again, 3, "時間跳躍でもう一度動く (1ラウンド1回)");
}

console.log("二刀流 (R2〜R5 の割合・左手の装備規則・両手武器との持ち替え・通常攻撃2回・技は左手の半分・オートの見積もり・サブ魂・最適装備) と時間跳躍を確認");
