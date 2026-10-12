// 死体の外見分類。職業・魂の抽選には使わず、保存済みの職業から絵だけを選ぶ。
export const CORPSE_FAMILIES = {
  warrior: ["fighter", "berserker", "knight", "samurai", "guardian", "darkknight", "hero", "asura", "dragonknight"],
  clergy: ["priest", "bishop", "paladin", "crusader", "templar", "inquisitor", "archbishop", "cardinal", "chaplain"],
  rogue: ["thief", "brigand", "shadow", "hunter", "arcthief", "monk", "hermit", "ascetic", "exorcist"],
  mage: ["mage", "archmage", "spellblade", "battlemage", "hexer", "warden", "arcanist", "necromancer", "sage"],
};
const families = new Map(Object.entries(CORPSE_FAMILIES).flatMap(([family, jobs]) => jobs.map(job => [job, family])));
export const CORPSE_STATES = ["corpse", "corpseWarm", "corpseGreat"];
export function corpseArtKey(cell) {
  const family = families.get(cell?.corpseClass) || "warrior";
  const state = cell?.corpseGreat ? "corpseGreat" : cell?.corpseWarm ? "corpseWarm" : "corpse";
  return family === "warrior" ? state : `${state}_${family}`;
}
