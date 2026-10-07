// 抵抗値は0〜100。装備・敵・画面で共通の種類を使う。
export const RESIST_LABEL = { physResist: "物理", magResist: "魔法", poison: "毒", paralyze: "麻痺", sleep: "眠り", charm: "魅了", confuse: "混乱", stone: "石化", seal: "封印", flinch: "怯み", death: "即死" };
export const AIL_RESIST_KINDS = Object.keys(RESIST_LABEL).filter(k => !["physResist", "magResist"].includes(k));
export const clampResist = v => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
export const zeroResists = () => Object.fromEntries(Object.keys(RESIST_LABEL).map(k => [k, 0]));
// 強さの基礎値に体質を重ねる。個別指定は最後に反映する。
export function monsterResists(m) {
  const r = zeroResists();
  const base = Math.min(60, Math.max(0, (m.rank || 1) - 1) * 6 + (m.boss ? 40 : m.elite ? 25 : 0));
  for (const k of AIL_RESIST_KINDS) r[k] = base;
  const raise = (keys, n) => keys.forEach(k => r[k] = Math.max(r[k], n));
  if (["undead", "specter"].includes(m.race)) raise(["poison", "sleep", "death"], 100);
  if (m.race === "specter") raise(["paralyze", "stone"], 100);
  if (["construct", "armored"].includes(m.race)) raise(["poison", "sleep", "charm", "death"], 100);
  if (m.race === "amorph") raise(["paralyze", "flinch"], 70);
  if (["demon", "dragon"].includes(m.race)) raise(["charm", "confuse", "seal"], Math.min(90, base + 25));
  if ((m.race === "construct" && /石|岩|鉱|墓像|石像/.test((m.name || "") + (m.desc || ""))) || /stonegolem|rockgolem|mossgolem|gargoyle/.test(m.id || "")) raise(["stone"], 100);
  if (m.boss) raise(["death", "flinch"], 100);
  if (m.ability && m.ability in r) raise([m.ability], Math.min(90, base + 30));
  r.physResist = m.physResist || 0; r.magResist = m.magResist || 0;
  if (m.metal) for (const k of AIL_RESIST_KINDS) r[k] = 100;
  if (m.metal) r.magResist = 100;
  for (const [k, v] of Object.entries(m.resists || {})) {
    if (!(k in r) || !Number.isInteger(v) || v < 0 || v > 100) throw new Error(`抵抗値が不正: ${m.id} ${k}`);
    r[k] = v;
  }
  return r;
}
