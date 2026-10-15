// 魔物の図鑑と戦闘表示で共通の開示条件。
export const MON_REVEAL = { name: 1, stats: 5, lore: 10 };
export const BOSS_REVEAL = { name: 0, stats: 1, lore: 1 };
// その魔物 (図鑑の定義) の開示段階
// 名のある強敵 (dungeons/named.js) は名だけ最初から明かす (噂で知れ渡っている)。能力・伝承は倒して知る
export const NAMED_REVEAL = { name: 0, stats: 1, lore: 10 };
export const ELITE_REVEAL = { name: 1, stats: 1, lore: 10 };
export function revealSteps(m) { return m && m.boss ? BOSS_REVEAL : m && m.named ? NAMED_REVEAL : m && m.elite ? ELITE_REVEAL : MON_REVEAL; }
