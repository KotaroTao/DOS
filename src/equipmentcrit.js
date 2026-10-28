// 装備本来の会心性能。レア度と品の用途で決まり、拾得時の乱数は使わない。
import { rarityKey } from "./rarity.js";
export const CRITICAL_KEYS = ["crit", "critDamage", "spellCrit", "spellCritDamage"];
export const ITEM_CRITICAL_CAP = { crit: 0.20, critDamage: 1, spellCrit: 0.20, spellCritDamage: 1 };
export const CRITICAL_BANDS = {
  c: { rate: [0.01, 0.02], damage: [0.05, 0.10] },
  uc: { rate: [0.02, 0.03], damage: [0.10, 0.15] },
  r: { rate: [0.03, 0.05], damage: [0.15, 0.25] },
  sr: { rate: [0.05, 0.07], damage: [0.25, 0.40] },
  lr: { rate: [0.07, 0.10], damage: [0.40, .60] },
};
export function clampItemCritical(it) {
  for (const k of CRITICAL_KEYS) if (typeof it[k] === "number") {
    it[k] = Math.round(Math.max(0, Math.min(ITEM_CRITICAL_CAP[k], it[k])) * 10000) / 10000;
  }
  return it;
}
// 物理・魔法の率か威力、1〜2項目。守り・回復・探索専用の品は用途を保つ。
export function criticalProfile(it) {
  if (it.slot === "weapon") {
    const refs = it.scale || {}, magic = refs.int || refs.pie;
    if (magic && (refs.atk || refs.agi)) return ["crit", "spellCrit"];
    if (magic) return [it.twoHanded ? "spellCritDamage" : "spellCrit"];
    return [(it.cat === "ax" || it.cat === "mc" || it.twoHanded && !["dg", "kt", "bw"].includes(it.cat)) ? "critDamage" : "crit"];
  }
  if (it.slot === "hands") return [it.weight === "cloth" ? "spellCritDamage" : it.weight === "heavy" ? "critDamage" : "crit"];
  if (it.slot === "head" || it.slot === "feet") {
    if (it.weight === "cloth") return ["spellCrit"];
    if (it.weight === "light") return ["crit"];
  }
  if (it.slot === "shield") {
    if (it.sk === "orb") return ["spellCrit"];
    if (it.sk === "tome") return ["spellCritDamage"];
    if (it.sk === "buckler") return ["crit"];
  }
  if (it.slot === "body") {
    if (it.weight === "cloth" && (it.int || 0) > (it.pie || 0)) return ["spellCritDamage"];
    if ((it.atk || 0) > 0) return ["critDamage"];
  }
  if (it.slot === "acc") {
    if (it.eff && Object.keys(it.eff).every(k => ["goldUp", "soulUp", "disarmUp", "autoRevive", "regen", "guard", "spellCostMul", "ailmentImmune"].includes(k))) return it.crit ? ["crit"] : [];
    const physical = (it.atk || 0) + (it.agi || 0) + (it.luk || 0) + 100 * ((it.mult?.atk || 0) + (it.mult?.agi || 0));
    const magical = (it.int || 0) + (it.pie || 0) + 100 * ((it.mult?.int || 0) + (it.mult?.pie || 0));
    if (magical > physical) return ["spellCrit"];
    if (physical > 0 || it.eff?.actFirst) return ["crit"];
    if (it.eff?.multistrike || it.eff?.lifesteal || it.eff?.counter) return ["critDamage"];
  }
  return it.crit ? ["crit"] : [];
}
export function applyNativeCritical(it) {
  if (!it || !["weapon", "body", "shield", "head", "hands", "feet", "acc"].includes(it.slot)) return it;
  // 固有の会心値を持つ品も、品質・追加特性・品1点の上限は通常どおり扱う。
  if (it.nativeCriticalFixed) return clampItemCritical(it);
  const band = CRITICAL_BANDS[rarityKey(it) || "c"];
  const progress = Math.max(0, Math.min(1, ((it.lv || 1) - 1) / 199));
  const profile = criticalProfile(it);
  for (const key of profile) {
    const [lo, hi] = band[key.endsWith("Damage") ? "damage" : "rate"];
    // 両方の会心率を持つ複合武器は同じ格の下限側に抑える。
    const v = lo + (hi - lo) * progress * (profile.length > 1 ? 0.5 : 1);
    const unit = key.endsWith("Damage") ? 20 : 100;
    it[key] = Math.max(it[key] || 0, Math.round(v * unit) / unit);
  }
  return clampItemCritical(it);
}
