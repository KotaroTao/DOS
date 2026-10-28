import { equipmentCombatState } from "./equipmentscore.js";
import { bukonText } from "./bukon.js";
// ===== 最適装備の計画 (純粋な計算・DOM なし) =====
// 担当: WP-B。
// planBestEquip(dolls, { pool, canEquip, slotKeyFor, recalcPreview, score })
//   dolls … 装備を整える人業 (1体 or 隊の全員)
//   pool  … 品を出してよい人業 (既定 = dolls)。隊・控えの全員の所持品を候補にする
//   候補から除くもの: 呪い・未鑑定・装備品でないもの・他人が装備中の品 (装備中の品は所持品に無いので候補にならない)
//   allow … (人業, 品) → false ならその人業には選ばない (例: 後衛に近接物理の武器を持たせない)
//   呪われた装備は外さない (その部位・両手武器⇄盾で押し出す場合も含む)。
//   両手武器を持てば盾を、盾を持てば両手武器を外して所持品へ戻す (items.js の equip() と同じ規則)。
//   共有の所持枠 (50) を超える付け替えはしない。
//   人業をまたいで「点数の伸び (score) が最も大きい1手」を選んで仮に適用し、伸びが無くなるまで繰り返す (貪欲法)。
//   返り値: { moves: [{ doll, item, from, slotKey, displaced, gain }], undoSnapshot, gain }
//
// 実際の付け替えは applyPlan(plan) で、元に戻すのは restoreEquip(plan.undoSnapshot)。
// 人業ごとに選んで適用するのは applyPlanSubset(plan, keep) (頼り合い = planDeps(plan) は一緒に入れ切りする)。
// どちらも実体 (人業の equip / items) を書き換え、recalc で能力を再計算する。

import { afxDef } from "./infaffix.js";
import { bagCount, isFormationItem, SLOTS, MAX_ITEMS, canEquip as canEquipDefault, recalc as recalcDefault, attackPower, weaponRange, canOffhand, fightPower, offhandPower } from "./items.js";

// 条件つき・探索用の追加特性は、能力値だけでは変化がわからないため説明も比較する。
export function equipmentTraitTexts(equip) {
  return [...new Set(Object.values(equip || {}))].filter(it => it && !it.unidentified).flatMap(it => [...(it.bukon || []).map(b=>`武魂 ${bukonText(b)}`), ...(it.afxText || []).filter(a => {
    const d = afxDef(a.k); return d && (d.fx || d.misc);
  }).map(a => `${a.name.replace(/の$/, "")}：${a.text}`)]);
}

const EPS = 0.05;          // これ未満の伸びは「同じ」とみなす (同格の品を入れ替え続けない)
const EQUIP_SLOTS = new Set(["weapon", "shield", "body", "head", "hands", "feet", "acc"]);

// 品が収まる装備部位のキー (装飾品は2枠)。doll を渡すと、二刀流の人業は片手武器を盾の欄 (左手) にも収められる
export function slotKeysFor(item, doll = null) {
  if (!item || !EQUIP_SLOTS.has(item.slot)) return [];
  if (item.slot === "acc") return ["acc1", "acc2"];
  if (doll && item.slot === "weapon" && !item.twoHanded && doll.dualWield > 0 && !item.unidentified && canOffhand(doll, item)) return ["weapon", "shield"];
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
  const fake = { base: doll.base, equip, hp: doll.hp, mp: doll.mp, dualWield: doll.dualWield || 0 };
  recalcFn(fake);
  return {
    combat: equipmentCombatState({...fake,primaryPower:attackPower(fake),power:fightPower(fake)},doll),
    atk: fake.atk, vit: fake.vit, agi: fake.agi, int: fake.int, pie: fake.pie, luk: fake.luk,
    maxhp: fake.maxhp, maxmp: fake.maxmp, critBonus: fake.critBonus || 0,
    critDamageBonus: fake.critDamageBonus || 0, spellCritBonus: fake.spellCritBonus || 0, spellCritDamageBonus: fake.spellCritDamageBonus || 0,
    elemAtk: fake.elemAtk || null, elemDef: fake.elemDef || null, breathRes: fake.breathRes || 0,
    ailRes: fake.ailRes || null, onHit: fake.onHit || null, // 状態異常耐性・追加効果 (itemview の gearScore が数える)
    power: attackPower(fake), weapon: equip.weapon || null, shield: equip.shield || null, // 攻撃力 (参照能力 × 武器の係数) と武器・盾
    offPower: offhandPower(fake), fight: fightPower(fake), // 二刀流: 左手の攻撃力 / 比べる物差しの攻撃力 (右手 + 左手の DUAL_VALUE_SHARE)
    physResist: fake.physResist || 0, magResist: fake.magResist || 0,
    traits: equipmentTraitTexts(equip),
    eff: fake.eff || null, // 戦闘効果 (連撃・吸血・守り…。itemview の gearScore が effScore で数える)
  };
}

// 2つの能力の差 (itemview の equipPreviewDelta と同じ形)
export function statsDelta(from, to) {
  return {
    // 戦闘効果の付け替え前後と、付け替え後の攻撃力・最大HP/MP (効果の値打ちはこの人業の強さで測る)
    combat: {from:from.combat,to:to.combat},
    eff: { from: from.eff || null, to: to.eff || null },
    traits: { from: from.traits || [], to: to.traits || [] },
    weaponMode: { from: from.weapon || null, to: to.weapon || null },
    offhandMode: { from: offW(from), to: offW(to) },
    abs: { power: fp(to), maxhp: to.maxhp || 0, maxmp: to.maxmp || 0 },
    atk: to.atk - from.atk, vit: to.vit - from.vit, agi: to.agi - from.agi,
    int: to.int - from.int, pie: to.pie - from.pie, luk: to.luk - from.luk,
    hp: to.maxhp - from.maxhp, mp: to.maxmp - from.maxmp,
    crit: Math.round(((to.critBonus || 0) - (from.critBonus || 0)) * 1000) / 10,
    critDamage: Math.round(((to.critDamageBonus || 0) - (from.critDamageBonus || 0)) * 1000) / 10,
    spellCrit: Math.round(((to.spellCritBonus || 0) - (from.spellCritBonus || 0)) * 1000) / 10,
    spellCritDamage: Math.round(((to.spellCritDamageBonus || 0) - (from.spellCritDamageBonus || 0)) * 1000) / 10,
    elemAtk: { from: from.elemAtk, to: to.elemAtk },
    elemDef: { from: from.elemDef, to: to.elemDef },
    physResist: (to.physResist || 0) - (from.physResist || 0),
    magResist: (to.magResist || 0) - (from.magResist || 0),
    breathRes: Math.round(((to.breathRes || 0) - (from.breathRes || 0)) * 100), // ブレス耐性 (%)
    ailRes: { from: from.ailRes || null, to: to.ailRes || null },
    onHit: { from: from.onHit || null, to: to.onHit || null },
    power: fp(to) - fp(from), // 攻撃力の増減 (二刀流なら左手も DUAL_VALUE_SHARE で数える)
    weapon: wpnChanged(from, to), // 武器 (右手・左手) が替わるか (武器の良し悪しは攻撃力で決める)
    // 持ち方の付け替え (片手+盾 ⇄ 両手武器 / 盾 ⇄ 左手の武器)。攻撃力と盾の能力を同じ物差しで比べる (itemview の gearScore)
    handSwap: wpnChanged(from, to) && (from.shield || null) !== (to.shield || null),
  };
}
const fp = (s) => (s.fight != null ? s.fight : (s.power || 0));
const offW = (s) => (s.shield && s.shield.slot === "weapon" ? s.shield : null);
function wpnChanged(from, to) {
  return (from.weapon || null) !== (to.weapon || null) || offW(from) !== offW(to);
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
  if (key === "shield" && eq.weapon && eq.weapon.twoHanded) {
    if (isPinned(eq.weapon)) return null;
    displaced.push(eq.weapon); eq.weapon = null;
  }
  if (cur) displaced.push(cur);
  eq[key] = item;
  return { equip: eq, displaced };
}

// 仲間 (wearer) の部位 wk から品を譲り受ける時の「装備の交換」: こちらから外れる品 (displaced) のうち、
// 空いた wk へ仲間がそのまま付けられる品を1つ返す (無ければ null = 仲間の部位は空き、外れた品はこちらの袋へ)。
// 仲間のほかの部位を押し出す品 (両手武器で盾が外れる等) は選ばない
export function swapBackFor(wearer, wk, displaced, canEquipFn = canEquipDefault) {
  if (!wearer || !wearer.equip || !wk) return null;
  const eq = { ...wearer.equip, [wk]: null };
  for (const x of (displaced || [])) {
    if (!x || x.unidentified || !EQUIP_SLOTS.has(x.slot)) continue;
    const fits = x.slot === "acc" ? wk.startsWith("acc")
      : (wk === "shield" && x.slot === "weapon") ? (!x.twoHanded && canOffhand(wearer, x))
      : x.slot === wk;
    if (!fits || !canEquipFn(wearer, x)) continue;
    const tr = trialEquip(eq, x, wk);
    if (tr && !tr.displaced.length) return x;
  }
  return null;
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
  const bags = new Map();
  for (const d of poolDolls) {
    if (!bags.has(d.items)) bags.set(d.items, [...(d.items || [])]);
    sim.set(d, { equip: { ...(d.equip || {}) }, items: bags.get(d.items) });
  }

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
          for (const key of slotKeysFor(item, t)) {
            const tr = trialEquip(st.equip, item, key);
            if (!tr) continue;
            const bagAfter = bagCount(st.items) - (os.items === st.items && !isFormationItem(item) ? 1 : 0) + bagCount(tr.displaced);
            if (bagAfter > maxItems) continue;
            const delta = statsDelta(baseStats, recalcPreview(t, tr.equip));
            const g = score(t, delta);
            if (g > EPS && (!best || g > best.gain + 1e-9)) {
              best = { doll: t, item, from: owner, slotKey: key, displaced: tr.displaced, gain: g, equip: tr.equip, delta };
            }
            // 両手武器から「片手武器 + 盾 (二刀流なら左手の武器)」への持ち替えは2手を1組で比べる (片手武器だけでは攻撃力が下がり、選ばれないため)
            if (key === "weapon" && item.slot === "weapon" && !item.twoHanded && st.equip.weapon && st.equip.weapon.twoHanded && !st.equip.shield) {
              for (const owner2 of poolDolls) {
                for (const sh of sim.get(owner2).items) {
                  // 盾の代わりに左手の片手武器も組める (二刀流)
                  if (sh === item || !isAutoCandidate(sh) || !(sh.slot === "shield" || slotKeysFor(sh, t).includes("shield"))) continue;
                  let ok2 = false;
                  try { ok2 = canEquip(t, sh); } catch (e) { ok2 = false; }
                  if (!ok2 || !allow(t, sh)) continue;
                  const tr2 = trialEquip(tr.equip, sh, "shield");
                  if (!tr2) continue;
                  const bag2 = bagAfter - (sim.get(owner2).items === st.items && !isFormationItem(sh) ? 1 : 0) + bagCount(tr2.displaced);
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

// 計画のうち、どの人業の付け替えがどの人業に頼っているか (人業 → 頼る人業の Set)。
// 人業 B が、A の付け替えで A の袋へ外れた品を拾って付けていれば、B は A に頼る (A を戻すと B の品が無くなる)
export function planDeps(plan) {
  const deps = new Map();
  const moves = (plan && plan.moves) || [];
  moves.forEach((m, i) => {
    if (!deps.has(m.doll)) deps.set(m.doll, new Set());
    for (let j = i - 1; j >= 0; j--) {
      const p = moves[j];
      if (p.doll.items === m.from.items && (p.displaced || []).includes(m.item)) {
        if (p.doll !== m.doll) deps.get(m.doll).add(p.doll);
        break;
      }
    }
  });
  return deps;
}
// 計画のうち、keep (人業の Set) の付け替えだけを実体に適用する (ほかの人業は計画の前のまま)。
// まず写しへ戻してから順に付け替える。品が見つからない・持ち物が上限を超えるなら、写しへ戻して false
export function applyPlanSubset(plan, keep, { recalc: recalcFn = recalcDefault, maxItems = MAX_ITEMS } = {}) {
  if (!plan || !plan.undoSnapshot) return false;
  restoreEquip(plan.undoSnapshot, recalcFn);
  const touched = new Set();
  for (const m of plan.moves || []) {
    if (!keep.has(m.doll)) continue;
    const d = m.doll;
    const i = m.from.items.indexOf(m.item);
    const tr = i >= 0 ? trialEquip(d.equip, m.item, m.slotKey) : null;
    if (!tr) { restoreEquip(plan.undoSnapshot, recalcFn); return false; }
    m.from.items.splice(i, 1);
    for (const k of SLOTS) d.equip[k] = tr.equip[k] || null;
    for (const x of tr.displaced) d.items.push(x);
    touched.add(d); touched.add(m.from);
  }
  if (plan.undoSnapshot.some((x) => bagCount(x.doll.items) > maxItems)) { restoreEquip(plan.undoSnapshot, recalcFn); return false; }
  for (const d of touched) recalcFn(d);
  return true;
}

// 最終案を部位単位の承認へ分ける。同じ品の受け渡しと両手の変更だけは一緒に扱う。
export function equipApprovalGroups(plan) {
  const groups = [];
  for (const s of plan.undoSnapshot) for (const k of SLOTS) {
    const to = plan.final.get(s.doll).equip[k] || null, from = s.equip[k] || null;
    if (from !== to) groups.push([{ doll: s.doll, k, from, to }]);
  }
  const linked = (a, b) => (a.from && a.from === b.to) || (a.to && a.to === b.from) ||
    (a.doll === b.doll && [a.k, b.k].every(k => k === "weapon" || k === "shield") &&
      [a.from, a.to, b.from, b.to].some(it => it?.twoHanded));
  for (let i = 0; i < groups.length; i++) for (let j = i + 1; j < groups.length;) {
    if (groups[i].some(a => groups[j].some(b => linked(a, b)))) {
      groups[i].push(...groups.splice(j, 1)[0]); j = i + 1;
    } else j++;
  }
  return groups;
}

// 承認した部位だけの完成形を写しで検証し、成功した時だけ実体へ反映する。
export function applyEquipApprovals(plan, keep, { recalc: recalcFn = recalcDefault, maxItems = MAX_ITEMS } = {}) {
  const bags = new Map(), equips = new Map();
  for (const s of plan.undoSnapshot) {
    if (!bags.has(s.doll.items)) bags.set(s.doll.items, [...s.items]);
    equips.set(s.doll, { ...s.equip });
  }
  const changes = [...keep].flat();
  for (const c of changes) {
    if (c.from) bags.get(c.doll.items).push(c.from);
    equips.get(c.doll)[c.k] = c.to;
  }
  for (const c of changes) if (c.to) {
    const bag = [...bags.values()].find(b => b.includes(c.to));
    if (!bag) return false;
    bag.splice(bag.indexOf(c.to), 1);
  }
  if ([...bags.values()].some(b => bagCount(b) > maxItems)) return false;
  for (const eq of equips.values()) if (eq.weapon?.twoHanded && eq.shield) return false;
  for (const [bag, items] of bags) bag.splice(0, bag.length, ...items);
  for (const [d, eq] of equips) {
    for (const k of SLOTS) d.equip[k] = eq[k] || null;
    recalcFn(d);
  }
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
  return s + ((delta.crit || 0) + (delta.spellCrit || 0)) * 0.5
    + ((delta.critDamage || 0) + (delta.spellCritDamage || 0)) * 0.1;
}

export function install() {}
