// 敵味方で共用する割合の式。付与力・命中力は1=100%、属性の値は100=100%。
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const procChance = (power, resistance = 0) => clamp(Math.max(0, power) * (1 - clamp(resistance, 0, 1)), 0, .95);
export const hitChance = (power, evade = 0, sure = false) => sure ? 1 : clamp(Math.max(0, power) * (1 - clamp(evade, 0, .8)), .2, .95);
export const elementalReduction = power => Math.min(.8, Math.max(0, power) / (100 + Math.max(0, power)));
export const permanentMultiplier = factors => Math.max(.1, factors.reduce((n, x) => n * x, 1));
export const ELEMENT_KEYS = ['fire', 'water', 'wind', 'earth', 'light', 'dark'];
// 既存の装備・出来事も読む。旧Lv1/2は属攻+50/100%、同属性の耐性力+100/200%へ。
export function elementValues(value, kind = 'attack') {
  if (!value) return {};
  if (value.values) return Object.fromEntries(ELEMENT_KEYS.filter(k => Number.isFinite(value.values[k])).map(k => [k, value.values[k]]));
  if (value.el && value.el !== 'none') return { [value.el]: Number(value.pct ?? ((value.lv || 1) * (kind === 'attack' ? 50 : 100))) };
  return Object.fromEntries(ELEMENT_KEYS.filter(k => Number.isFinite(value[k])).map(k => [k, value[k]]));
}
export function elementStat(values, kind = 'attack') {
  const keys = ELEMENT_KEYS.filter(k => values[k] > 0);
  if (!keys.length) return null;
  const el = keys.reduce((a, b) => values[a] >= values[b] ? a : b);
  return { el, pct: values[el], values: Object.fromEntries(keys.map(k => [k, values[k]])), kind };
}
export const elementAttack = (actor, element) => Math.max(0, 100 + (elementValues(actor?.elemAtk)[element] || 0));
export function elementResistance(element, defense, affinity, scale = 1) {
  const values = elementValues(defense, 'defense');
  const intrinsic = affinity?.resistance?.[element] ?? ((affinity?.resist || []).includes(element) ? 100 : 0);
  return Math.max(0, (values[element] || 0) + intrinsic) * Math.max(0, scale);
}
export const elementWeakness = (element, affinity) => affinity?.weakness?.[element] ?? ((affinity?.weak || []).includes(element) ? 1.5 : 1);
export function elementMultiplier(element, attack = 100, defense = null, affinity = null, scale = 1) {
  if (!element || element === 'none') return 1;
  const reduction=Math.min(.8,elementalReduction(elementResistance(element, defense, affinity, scale)) + Math.max(0,defense?.reductions?.[element]||0)*Math.max(0,scale));
  return Math.max(0, attack) / 100 * elementWeakness(element, affinity) * (1 - reduction);
}

// 会心の幸運加算を実戦と装備評価で共用する。
export const luckCritBonus = luk => .25 * (1 - Math.exp(-Math.max(0,(luk || 0)-8)/50));
