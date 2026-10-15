// 保存編成。人業は uid、装備は実物への参照を残す。成長や体調は保存しない。
import { SLOTS, MAX_ITEMS, canEquip, canOffhand, itemName, isFormationItem } from "./items.js";
import { recalcDoll, subPicks, subPickCap, soulLearnedSkills, soulLearnedPassives } from "./souls.js";

export const FORMATION_COUNT = 10;
const dollsOf = g => [...(g.party || []), ...(g.reserve || [])];
const copySubs = subs => (subs || []).map(s => s ? { uid: s.uid, picked: s.picked, picks: subPicks({ ...s, picks: s.picks?.map(p => ({ ...p })) }).map(p => ({ ...p })) } : null);
export function formationItems(presets) {
  return new Set((presets || []).flatMap(p => (p?.members || []).flatMap(m => Object.values(m.equip || {}).filter(Boolean))));
}
export function syncFormationItems(g) {
  g.formations = Array.from({ length: FORMATION_COUNT }, (_, i) => g.formations?.[i] || null);
  const home = g.abyss?.started ? g.abyss.home : g;
  if (!home) return;
  const worn = new Set(dollsOf(home).flatMap(d => Object.values(d.equip || {}).filter(Boolean)));
  const items = formationItems(g.formations);
  for (const it of new Set([...(home.inventory || []), ...worn, ...items])) {
    const names = g.formations.flatMap((p, i) => p && p.members.some(m => Object.values(m.equip || {}).includes(it)) ? [p.name || `編成${i + 1}`] : []);
    if (names.length) it.formationNames = names;
    else delete it.formationNames;
  }
  // 全滅や旧記録の移行でも、登録した実物は失わない。
  home.inventory ||= [];
  for (const it of items) if (!worn.has(it) && !home.inventory.includes(it)) home.inventory.push(it);
}
export function saveFormation(g, index, name = null, remove = false) {
  if (g.state !== "town" || g.abyss?.started || !Number.isInteger(index) || index < 0 || index >= FORMATION_COUNT) return { ok: false, msg: "街で編成を選んでください。" };
  const presets = Array.from({ length: FORMATION_COUNT }, (_, i) => g.formations?.[i] || null);
  const old = presets[index];
  const title = String(name ?? old?.name ?? `編成${index + 1}`).trim().slice(0, 24) || `編成${index + 1}`;
  presets[index] = remove ? null : { name: title, members: g.party.map(d => ({ uid: d.uid, primary: d.primary ?? null, subs: copySubs(d.subs).map(s => s ? { ...s, picked: true } : null), equip: Object.fromEntries(SLOTS.map(k => [k, d.equip?.[k] || null])) })) };
  const reserved = formationItems(presets);
  const used = (g.inventory || []).filter(it => !reserved.has(it)).length;
  if (used > MAX_ITEMS && used > (g.inventory || []).filter(it => !isFormationItem(it)).length) return { ok: false, msg: `持ち物袋にあと${used - MAX_ITEMS}枠の空きが必要です。` };
  g.formations = presets;
  syncFormationItems(g);
  return { ok: true, msg: remove ? "保存編成を削除した。" : `${title}に現在の編成を保存した。` };
}
export function renameFormation(g, index, name) {
  if (g.state !== "town" || g.abyss?.started || !g.formations?.[index]) return { ok: false, msg: "保存編成がありません。" };
  g.formations[index].name = String(name).trim().slice(0, 24) || `編成${index + 1}`;
  syncFormationItems(g);
  return { ok: true, msg: "編成の名前を変更した。" };
}

// 全員分の完成形を作り、検査が済むまで隊・魂・装備・袋を変更しない。
export function planFormation(g, index, { subSlots = 2, soulChange = true } = {}) {
  const fail = msg => ({ ok: false, msg });
  if (g.state !== "town" || g.abyss?.started) return fail("編成は街で適用してください。");
  const preset = g.formations?.[index];
  if (!preset?.members?.length || preset.members.length > 6) return fail("保存編成がありません。");
  const dolls = dollsOf(g), byUid = new Map(dolls.map(d => [d.uid, d]));
  const souls = new Map((g.souls || []).map(s => [s.uid, s]));
  const claimedSouls = new Set(), claimedGear = new Set(), members = new Map(), jobs = new Set();
  for (const m of preset.members) {
    const d = byUid.get(m.uid);
    if (!d || members.has(d)) return fail("保存した人業が見つからないか、重複しています。");
    if (m.primary !== d.primary && !soulChange) return fail("メイン魂の交換はまだ解放されていません。");
    const main = souls.get(m.primary);
    if (m.primary != null && !main) return fail(`${d.name}のメイン魂を所持していません。`);
    if (d.vessel === "sera" ? m.primary !== d.primary : main?.clsKey === "sera") return fail("セラのメイン魂は灯守に固定されています。");
    if (main && jobs.has(main.clsKey)) return fail("隊のメイン魂に同じ職業を重ねられません。");
    if (main) jobs.add(main.clsKey);
    const local = new Set(main ? [main.clsKey] : []);
    const subs = copySubs(m.subs);
    if (subs.some((s, i) => s && i >= subSlots)) return fail(`${d.name}のサブ魂の枠はまだ解放されていません。`);
    for (const sub of subs.filter(Boolean)) {
      const s = souls.get(sub.uid);
      if (!s) return fail(`${d.name}のサブ魂を所持していません。`);
      if (s.clsKey === "sera" || local.has(s.clsKey)) return fail(`${d.name}に同じ職業の魂は重ねられません。`);
      local.add(s.clsKey);
      const skills = soulLearnedSkills(s), passives = soulLearnedPassives(s);
      const keys = sub.picks.map(p => `${p.skill ? "s" : "p"}:${p.skill || p.passive}`);
      if (sub.picks.length > subPickCap(s) || new Set(keys).size !== keys.length || sub.picks.some(p => p.skill ? !skills.includes(p.skill) : !passives[p.passive])) return fail(`${d.name}の借りる技・パッシブを再現できません。`);
    }
    for (const uid of [m.primary, ...subs.filter(Boolean).map(s => s.uid)].filter(x => x != null)) {
      if (claimedSouls.has(uid)) return fail("同じ魂を複数の場所には宿せません。");
      claimedSouls.add(uid);
    }
    const equip = Object.fromEntries(SLOTS.map(k => [k, m.equip?.[k] || null]));
    for (const it of Object.values(equip).filter(Boolean)) {
      if (claimedGear.has(it)) return fail(`${itemName(it)}が重複しています。`);
      claimedGear.add(it);
    }
    members.set(d, { ...d, primary: m.primary, subs, equip });
  }
  const available = new Set([...(g.inventory || []), ...dolls.flatMap(d => Object.values(d.equip || {}).filter(Boolean))]);
  for (const it of claimedGear) if (!available.has(it)) return fail(`${itemName(it)}を所持していません。`);
  const probes = dolls.map(d => members.get(d) || { ...d,
    primary: claimedSouls.has(d.primary) ? null : d.primary,
    subs: copySubs(d.subs).map(s => s && !claimedSouls.has(s.uid) ? s : null),
    equip: Object.fromEntries(SLOTS.map(k => [k, claimedGear.has(d.equip?.[k]) ? null : d.equip?.[k] || null])),
  });
  for (let i = 0; i < dolls.length; i++) {
    const d = dolls[i], p = probes[i];
    recalcDoll(p);
    for (const k of SLOTS) {
      const it = p.equip[k], old = d.equip?.[k];
      if (old && old !== it && (old.locked || old.cursed)) return fail(`${d.name}の${itemName(old)}は${old.cursed ? "呪われていて" : "ロック中のため"}外せません。`);
      if (!it) continue;
      const fits = k.startsWith("acc") ? it.slot === "acc" : k === "shield" && it.slot === "weapon" ? canOffhand(p, it) : it.slot === k;
      const valid = p.primary != null && fits && canEquip(p, it) && !(k === "shield" && p.equip.weapon?.twoHanded);
      if (!valid) {
        if (members.has(d) || it.locked || it.cursed) return fail(`${d.name}は${itemName(it)}を装備できません。`);
        p.equip[k] = null;
      }
    }
  }
  const worn = new Set(probes.flatMap(p => Object.values(p.equip).filter(Boolean)));
  const bag = [...available].filter(it => !worn.has(it));
  const used = bag.filter(it => !isFormationItem(it)).length;
  if (used > MAX_ITEMS && used > (g.inventory || []).filter(it => !isFormationItem(it)).length) return fail(`持ち物袋にあと${used - MAX_ITEMS}枠の空きが必要です。`);
  return { ok: true, preset, dolls, probes, bag, party: preset.members.map(m => byUid.get(m.uid)) };
}
export function applyFormation(g, index, options) {
  const plan = planFormation(g, index, options);
  if (!plan.ok) return plan;
  for (let i = 0; i < plan.dolls.length; i++) {
    const d = plan.dolls[i], p = plan.probes[i];
    // 現在値を上限内に収めるだけ。体調・安定度・回復待ちは戻さない。
    d.primary = p.primary; d.subs = p.subs; d.equip = p.equip;
    recalcDoll(d);
    d.hp = Math.min(d.hp, d.maxhp); d.mp = Math.min(d.mp, d.maxmp);
  }
  g.inventory.splice(0, g.inventory.length, ...plan.bag);
  g.party = plan.party;
  g.reserve = plan.dolls.filter(d => !g.party.includes(d));
  syncFormationItems(g);
  return { ok: true, msg: `${plan.preset.name}を適用した。` };
}
