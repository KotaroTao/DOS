// ===== 最適装備の計画 (純粋な計算・DOM なし) =====
// 担当: WP-B。
// planBestEquip(dolls, { pool, canEquip, slotKeyFor, recalcPreview, score })
//   dolls … 装備を整える人業 (1体 or 隊の全員)
//   pool  … 品を出してよい人業 (既定 = dolls)。隊・控えの全員の所持品を候補にする
//   候補から除くもの: 呪い・未鑑定・装備品でないもの・他人が装備中の品 (装備中の品は所持品に無いので候補にならない)
//   allow … (人業, 品) → false ならその人業には選ばない (例: 後衛に近接物理の武器を持たせない)
//   呪われた装備は外さない (その部位・両手武器⇄盾で押し出す場合も含む)。
//   両手武器を持てば盾を、盾を持てば両手武器を外して所持品へ戻す (items.js の equip() と同じ規則)。
//   所持枠 (8) を超える付け替えはしない。
//   人業をまたいで「点数の伸び (score) が最も大きい1手」を選んで仮に適用し、伸びが無くなるまで繰り返す (貪欲法)。
//   返り値: { moves: [{ doll, item, from, slotKey, displaced, gain }], undoSnapshot, gain }
//
// 実際の付け替えは applyPlan(plan) で、元に戻すのは restoreEquip(plan.undoSnapshot)。
// どちらも実体 (人業の equip / items) を書き換え、recalc で能力を再計算する。

import { SLOTS, MAX_ITEMS, canEquip as canEquipDefault, recalc as recalcDefault, attackPower, weaponRange } from "./items.js";

const EPS = 0.05;          // これ未満の伸びは「同じ」とみなす (同格の品を入れ替え続けない)
const EQUIP_SLOTS = new Set(["weapon", "shield", "body", "head", "hands", "feet", "acc"]);

// 品が収まる装備部位のキー (装飾品は2枠)
export function slotKeysFor(item) {
  if (!item || !EQUIP_SLOTS.has(item.slot)) return [];
  if (item.slot === "acc") return ["acc1", "acc2"];
  return [item.slot];
}

// 最適装備の候補になる品か (呪い・未鑑定・消耗品/収集品は除く)
export function isAutoCandidate(item) {
  return !!item && EQUIP_SLOTS.has(item.slot) && !item.unidentified && !item.cursed && !item.locked;
}

// 近接物理の武器 (射程が近距離。杖は呪文の補助なので除く)。後衛では与ダメが半減し、敵の前列にしか届かない
export function isMeleeWeapon(item) {
  return !!item && item.slot === "weapon" && item.cat !== "st" && weaponRange(item) === "near";
}

// 仮の装備で能力を計算する (実体は書き換えない)
export function previewStats(doll, equip, recalcFn = recalcDefault) {
  const fake = { base: doll.base, equip, hp: doll.hp, mp: doll.mp };
  recalcFn(fake);
  return {
    atk: fake.atk, vit: fake.vit, agi: fake.agi, int: fake.int, pie: fake.pie, luk: fake.luk,
    maxhp: fake.maxhp, maxmp: fake.maxmp, critBonus: fake.critBonus || 0,
    elemAtk: fake.elemAtk || null, elemDef: fake.elemDef || null, breathRes: fake.breathRes || 0,
    ailRes: fake.ailRes || null, onHit: fake.onHit || null, // 状態異常耐性・追加効果 (itemview の gearScore が数える)
    power: attackPower(fake), weapon: equip.weapon || null, shield: equip.shield || null, // 攻撃力 (参照能力 × 武器の係数) と武器・盾
  };
}

// 2つの能力の差 (itemview の equipPreviewDelta と同じ形)
export function statsDelta(from, to) {
  return {
    atk: to.atk - from.atk, vit: to.vit - from.vit, agi: to.agi - from.agi,
    int: to.int - from.int, pie: to.pie - from.pie, luk: to.luk - from.luk,
    hp: to.maxhp - from.maxhp, mp: to.maxmp - from.maxmp,
    crit: Math.round(((to.critBonus || 0) - (from.critBonus || 0)) * 100),
    elemAtk: { from: from.elemAtk, to: to.elemAtk },
    elemDef: { from: from.elemDef, to: to.elemDef },
    breathRes: Math.round(((to.breathRes || 0) - (from.breathRes || 0)) * 100), // ブレス耐性 (%)
    ailRes: { from: from.ailRes || null, to: to.ailRes || null },
    onHit: { from: from.onHit || null, to: to.onHit || null },
    power: (to.power || 0) - (from.power || 0), // 攻撃力の増減
    weapon: (from.weapon || null) !== (to.weapon || null), // 武器が替わるか (武器の良し悪しは攻撃力で決める)
    // 持ち方の付け替え (片手+盾 ⇄ 両手武器)。攻撃力と盾の能力を同じ物差しで比べる (itemview の gearScore)
    handSwap: (from.weapon || null) !== (to.weapon || null) && (from.shield || null) !== (to.shield || null),
  };
}

// 外れない品 = 呪いの品・ロックした品 (it.locked。売らない・最適装備や付け替えで押し出さない — プレイヤーが決める)
export function isPinned(it) { return !!it && (!!it.cursed || !!it.locked); }

// 部位 key に item を収めた仮の装備と、押し出される品。付けられなければ null
//   (呪いの品・ロックした品は押し出さない / 両手武器⇄盾の規則)
export function trialEquip(equip, item, key) {
  const cur = equip[key];
  if (isPinned(cur)) return null;
  const eq = { ...equip };
  const displaced = [];
  if (item.slot === "weapon" && item.twoHanded && eq.shield) {
    if (isPinned(eq.shield)) return null;
    displaced.push(eq.shield); eq.shield = null;
  }
  if (item.slot === "shield" && eq.weapon && eq.weapon.twoHanded) {
    if (isPinned(eq.weapon)) return null;
    displaced.push(eq.weapon); eq.weapon = null;
  }
  if (cur) displaced.push(cur);
  eq[key] = item;
  return { equip: eq, displaced };
}

// ---- 元に戻すための写し ----
export function snapshotEquip(dolls) {
  const seen = new Set();
  const out = [];
  for (const d of (dolls || [])) {
    if (!d || seen.has(d)) continue;
    seen.add(d);
    out.push({ doll: d, equip: { ...(d.equip || {}) }, items: [...(d.items || [])] });
  }
  return out;
}
// 写しへ戻す (装備の器・所持品の配列はそのまま使い、中身だけ戻す = 参照の同一性を保つ)
export function restoreEquip(snap, recalcFn = recalcDefault) {
  for (const s of (snap || [])) {
    const d = s.doll;
    if (!d.equip) d.equip = {};
    for (const k of new Set([...SLOTS, ...Object.keys(s.equip)])) d.equip[k] = s.equip[k] || null;
    if (!Array.isArray(d.items)) d.items = [];
    d.items.length = 0;
    for (const x of s.items) d.items.push(x);
    try { recalcFn(d); } catch (e) { /* 能力の再計算に失敗しても装備は戻す */ }
    if (d.hp > d.maxhp) d.hp = d.maxhp;
    if (d.mp > d.maxmp) d.mp = d.maxmp;
  }
}

// 装備と所持品の並びの「指紋」(元に戻せるか = 付け替えの後に誰も触っていないか、を確かめる)
const _ids = new WeakMap();
let _idSeq = 0;
function oid(o) {
  if (!o || typeof o !== "object") return "-";
  let v = _ids.get(o);
  if (!v) { v = ++_idSeq; _ids.set(o, v); }
  return v;
}
export function equipSignature(dolls) {
  return (dolls || []).map((d) => {
    const eq = SLOTS.map((k) => oid(d.equip && d.equip[k])).join(",");
    const it = (d.items || []).map(oid).join(",");
    return `${oid(d)}[${eq}|${it}]`;
  }).join(";");
}

// ---- 計画 ----
export function planBestEquip(dolls, opts = {}) {
  const targets = (dolls || []).filter(Boolean);
  const poolDolls = [...new Set([...(opts.pool || targets), ...targets])].filter(Boolean);
  const canEquip = opts.canEquip || canEquipDefault;
  const recalcFn = opts.recalc || recalcDefault;
  const recalcPreview = opts.recalcPreview || ((doll, equip) => previewStats(doll, equip, recalcFn));
  const score = opts.score || defaultScore;
  const allow = opts.allow || (() => true);
  const maxItems = opts.maxItems || MAX_ITEMS;
  const maxMoves = opts.maxMoves || Math.max(16, targets.length * 12);

  const undoSnapshot = snapshotEquip(poolDolls);
  // 仮の状態 (人業 → 装備・所持品の写し)
  const sim = new Map();
  for (const d of poolDolls) sim.set(d, { equip: { ...(d.equip || {}) }, items: [...(d.items || [])] });

  const moves = [];
  let total = 0;
  for (let n = 0; n < maxMoves; n++) {
    let best = null;
    for (const t of targets) {
      const st = sim.get(t);
      if (!st) continue;
      const baseStats = recalcPreview(t, st.equip);
      for (const owner of poolDolls) {
        const os = sim.get(owner);
        for (const item of os.items) {
          if (!isAutoCandidate(item)) continue;
          let ok = false;
          try { ok = canEquip(t, item); } catch (e) { ok = false; }
          if (!ok || !allow(t, item)) continue;
          for (const key of slotKeysFor(item)) {
            const tr = trialEquip(st.equip, item, key);
            if (!tr) continue;
            const bagAfter = st.items.length - (owner === t ? 1 : 0) + tr.displaced.length;
            if (bagAfter > maxItems) continue;
            const delta = statsDelta(baseStats, recalcPreview(t, tr.equip));
            const g = score(t, delta);
            if (g > EPS && (!best || g > best.gain + 1e-9)) {
              best = { doll: t, item, from: owner, slotKey: key, displaced: tr.displaced, gain: g, equip: tr.equip, delta };
            }
            // 両手武器から「片手武器 + 盾」への持ち替えは2手を1組で比べる (片手武器だけでは攻撃力が下がり、選ばれないため)
            if (item.slot === "weapon" && !item.twoHanded && st.equip.weapon && st.equip.weapon.twoHanded && !st.equip.shield) {
              for (const owner2 of poolDolls) {
                for (const sh of sim.get(owner2).items) {
                  if (sh === item || sh.slot !== "shield" || !isAutoCandidate(sh)) continue;
                  let ok2 = false;
                  try { ok2 = canEquip(t, sh); } catch (e) { ok2 = false; }
                  if (!ok2 || !allow(t, sh)) continue;
                  const tr2 = trialEquip(tr.equip, sh, "shield");
                  if (!tr2) continue;
                  const bag2 = bagAfter - (owner2 === t ? 1 : 0) + tr2.displaced.length;
                  if (bag2 > maxItems) continue;
                  const d2 = statsDelta(baseStats, recalcPreview(t, tr2.equip));
                  const g2 = score(t, d2);
                  if (g2 > EPS && (!best || g2 > best.gain + 1e-9)) {
                    best = { doll: t, item, from: owner, slotKey: key, displaced: tr.displaced, gain: g2, equip: tr.equip, delta: d2,
                      pair: { item: sh, from: owner2, displaced: tr2.displaced, equip: tr2.equip } };
                  }
                }
              }
            }
          }
        }
      }
    }
    if (!best) break;
    // 仮に適用する
    const os = sim.get(best.from);
    const i = os.items.indexOf(best.item);
    if (i >= 0) os.items.splice(i, 1);
    const ts = sim.get(best.doll);
    ts.equip = best.equip;
    for (const x of best.displaced) ts.items.push(x);
    if (best.pair) {
      // 1組の持ち替え: 片手武器 (盾の欄は空いたまま) → 盾、の2手として記録する (applyPlan は順に付け替える)
      const pr = best.pair;
      const os2 = sim.get(pr.from);
      const j = os2.items.indexOf(pr.item);
      if (j >= 0) os2.items.splice(j, 1);
      ts.equip = pr.equip;
      for (const x of pr.displaced) ts.items.push(x);
      moves.push({ doll: best.doll, item: best.item, from: best.from, slotKey: best.slotKey, displaced: best.displaced, gain: 0, delta: best.delta });
      moves.push({ doll: best.doll, item: pr.item, from: pr.from, slotKey: "shield", displaced: pr.displaced, gain: best.gain, delta: best.delta });
    } else {
      moves.push({ doll: best.doll, item: best.item, from: best.from, slotKey: best.slotKey, displaced: best.displaced, gain: best.gain, delta: best.delta });
    }
    total += best.gain;
  }
  return { moves, undoSnapshot, gain: Math.round(total * 10) / 10, final: sim };
}

// 計画を実体に適用する。途中で食い違えば (計画の後に誰かが触った) 写しへ戻して false
export function applyPlan(plan, { recalc: recalcFn = recalcDefault } = {}) {
  if (!plan || !plan.moves || !plan.moves.length) return false;
  const touched = new Set();
  for (const m of plan.moves) {
    const d = m.doll;
    const i = m.from.items.indexOf(m.item);
    const tr = i >= 0 ? trialEquip(d.equip, m.item, m.slotKey) : null;
    const same = tr && tr.displaced.length === m.displaced.length && tr.displaced.every((x, k) => x === m.displaced[k]);
    if (!same) { restoreEquip(plan.undoSnapshot, recalcFn); return false; }
    m.from.items.splice(i, 1);
    for (const k of SLOTS) d.equip[k] = tr.equip[k] || null;
    for (const x of tr.displaced) d.items.push(x);
    touched.add(d); touched.add(m.from);
  }
  for (const d of touched) recalcFn(d);
  return true;
}

// 既定の点数 (重みは素朴。game 側は itemview の gearScore を渡す)
function defaultScore(doll, delta) {
  const W = { atk: 1, vit: 1, agi: 0.8, int: 0.6, pie: 0.6, luk: 0.4, hp: 0.2, mp: 0.15 };
  let s = 0;
  for (const k in W) s += (k === "atk" && delta.power != null ? delta.power : (delta[k] || 0)) * W[k];
  if (delta.weapon) {
    if (delta.handSwap) s = s * 50 / W.atk; // 片手+盾 ⇄ 両手: 盾の能力も攻撃力に換算して比べる
    else s += (delta.power || 0) * 50; // 武器は攻撃力の高い順
  }
  return s + (delta.crit || 0) * 0.5;
}

export function install() {}
