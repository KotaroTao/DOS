// Edge Function で実行する戦闘。ブラウザの戦闘と同じ式・乱数を使う。
import { Battle, syncEnemyUids, setOnEnemyKilled, setEquipSwap, setModSink, setElemKnown, setPartyEvadeBonus, setPartyBreathBonus, setPartyHitBonus, setEnemyLvTag } from "./combat.js";
import { bindRngState } from "./rng.js";
import { MONSTERS } from "./sprites.js";
import { DUNGEON_MONSTERS } from "./dungeons/index.js";
import { NAMED_IDS } from "./dungeons/named.js";
import { STORY_CELLS, CHAPTERS } from "./story.js";
import { bagCount, isFormationItem, ITEMS, SLOTS, MAX_ITEMS, canEquip, equipFailMsg, registerEquipLevel, registerAffixes } from "./items.js";
import { CATALOG_ITEMS } from "./catalog/index.js";
import { equipLevelFor } from "./equiplevel.js";
import { applyAffixes, gearPerks } from "./infaffix.js";
import { trialEquip } from "./autoequip.js";
import { recalcDoll, setSharedSouls, setPermanentStatSource, setOrderSource, setSkillGate, soulByUid, SOUL_CLASSES, pLv } from "./souls.js";
import { permanentEventStats } from "./events.js";
import { enemyLvTag } from "./enemylevel.js";

Object.assign(MONSTERS, DUNGEON_MONSTERS);
for (const id of NAMED_IDS) if (MONSTERS[id]) MONSTERS[id].named = true;
Object.assign(ITEMS, CATALOG_ITEMS);
registerEquipLevel(equipLevelFor);
registerAffixes(applyAffixes, gearPerks);

export function resolveCloudBattle(s, operation) {
  const b = s.battle;
  if (s.state !== "combat" || !b) throw new Error("戦闘の記録がありません");
  Object.setPrototypeOf(b, Battle.prototype);
  s.rng = bindRngState(s.rng);
  setSharedSouls(s.souls || []);
  setPermanentStatSource(() => permanentEventStats(s.events?.once));
  const infinite = !!s.abyss?.started;
  const seated = () => {
    if (infinite) return [];
    const met = (no, n) => {
      const ch = CHAPTERS.find((c) => c.no === no);
      return ch && (n ? ch.dungeons.filter((id) => s.world?.reported?.[id]).length >= n : !!s.world?.reported?.[ch.finale]);
    };
    const count = met(12) ? 5 : met(8) ? 4 : met(3, 2) ? 3 : met(2, 2) ? 2 : met(1) ? 1 : 0;
    const worn = new Set(s.party.flatMap((d) => [d.primary, ...(d.subs || []).map((sub) => sub.uid)]));
    return [...new Set(s.order?.picks || [])].filter((uid) => !worn.has(uid) && soulByUid(uid)).slice(0, count);
  };
  setOrderSource(seated);
  setSkillGate(null);
  const boon = (kind) => !infinite && Object.entries(STORY_CELLS).some(([k, v]) => s.world?.found?.[k] && v.boon?.kind === kind);
  setPartyEvadeBonus(boon("evade") ? 0.01 : 0);
  setPartyBreathBonus(boon("breathWard") ? 0.05 : 0);
  setPartyHitBonus(boon("eyes") ? 0.02 : 0);
  setEnemyLvTag(enemyLvTag);
  setElemKnown((e) => {
    const kills = s.codex?.mon?.[e.key]?.kills || 0;
    return String(e.key || "").startsWith("ev_") || kills >= (e.mon?.boss || e.mon?.elite || e.mon?.named ? 1 : 5)
      || s.party.some((p) => p.alive && pLv(p, "scan") > 0);
  });
  const logs = [], modFeed = [];
  b.log = (msg, cls) => logs.push({ msg, cls });
  setModSink((ev) => modFeed.push(ev));
  for (const e of b.enemies) if (MONSTERS[e.key]) e.mon = MONSTERS[e.key];
  syncEnemyUids(b.enemies);
  setOnEnemyKilled((e) => {
    if (e._codexKill || String(e.key || "").startsWith("ev_")) return;
    e._codexKill = true;
    const c = s.codex;
    if (!c.mon[e.key]) {
      c.mon[e.key] = { kills: 0, main: 0, normal: false, rare: false, dungeons: {} };
      c.fresh ||= {}; c.fresh.mon ||= {}; c.fresh.mon[e.key] = 1;
    }
    const entry = c.mon[e.key]; entry.kills++;
    if (!infinite) {
      entry.main = (entry.main || 0) + 1; entry.dungeons[s.dungeonIdx] = true;
      entry.floors ||= {};
      const r = entry.floors[s.dungeonIdx];
      entry.floors[s.dungeonIdx] = r ? [Math.min(r[0], s.floor), Math.max(r[1], s.floor)] : [s.floor, s.floor];
    }
  });
  setEquipSwap((p, it) => {
    if (!canEquip(p, it)) return { ok: false, msg: equipFailMsg(p, it) };
    const tr = trialEquip(p.equip, it, it.slot === "shield" ? "shield" : "weapon");
    if (!tr || bagCount(p.items) - (isFormationItem(it) ? 0 : 1) + bagCount(tr.displaced) > MAX_ITEMS) return { ok: false, msg: "装備を持ち替えられない" };
    const i = p.items.indexOf(it);
    if (i < 0) return { ok: false, msg: "品が見つからない" };
    p.items.splice(i, 1);
    for (const k of SLOTS) p.equip[k] = tr.equip[k] || null;
    p.items.push(...tr.displaced); recalcDoll(p);
    p.hp = Math.min(p.hp, p.maxhp); p.mp = Math.min(p.mp, p.maxmp);
    return { ok: true, msg: `${p.name}は ${it.name} を装備した`, displaced: tr.displaced };
  });
  let result = null;
  if (operation === "advance") {
    if (!b._acted || b.result) throw new Error("手番を進められません");
    b._acted = false; b.advance();
  } else {
    if (b._acted || b.result) throw new Error("この行動は実行済みです");
    if (operation === "commit" && b.phase === "resolve" && b.pending) result = b.commit();
    else if (operation === "enemy" && b.phase === "enemy") result = b.enemyAct();
    else if (operation === "stunned" && b.phase === "stunned") result = b.stunnedAct();
    else throw new Error("手番が一致しません");
    b._acted = true;
    // 窃盗とレベルドレインも演出の前に保存する。
    for (const h of result.hits || []) {
      if (h.target?.side === "enemy") continue;
      if (h.steal) {
        const key = h.steal === "goldSteal" ? "gold" : "soulPts";
        const n = Math.min(s[key], h.stealAmt || 0);
        s[key] -= n; if (s.run) s.run[key] = Math.max(0, s.run[key] - n);
        h.persistedSteal = n;
      }
      if (h.drain && h.target?.isDoll && h.target.primary != null) {
        const soul = soulByUid(h.target.primary);
        if (soul && soul.level > 1) {
          soul.level--;
          for (const d of [...s.party, ...s.reserve]) {
            recalcDoll(d); d.hp = Math.min(d.hp, d.maxhp); d.mp = Math.min(d.mp, d.maxmp);
          }
          logs.push({ msg: `${h.target.name}の${SOUL_CLASSES[soul.clsKey].label}の魂が喰われ、Lv${soul.level} に堕ちた…！`, cls: "dmg" });
        }
      }
    }
    result._persistedConsequences = true;
  }
  const patch = {};
  for (const k of ["battle", "party", "reserve", "souls", "rng", "codex", "gold", "soulPts", "run"]) patch[k] = s[k];
  return { snapshot: patch, result, logs, modFeed };
}
