// 職ごとの固有技・固有パッシブ (jobkit) で共有する定数。skilldefs.js もここから読む (循環 import を避けるため)
export const UNHOLY = ["undead", "specter", "demon"];
export const BEASTS = ["beast", "wing", "insect", "reptile", "plant", "aquatic"];
export const DRAGONS = ["dragon", "reptile", "wing"];
export const MACHINES = ["construct", "armored", "elemental"];
export const PREY_GROUPS = { UNHOLY, BEASTS, DRAGONS, MACHINES };

// 全体の毎ターン回復は共通の加護。旧キーは保存済みの借用・戦闘の互換用に残す。
export const PASSIVE_ALIASES = { paladinKoukan: "heroKibouHidamari", archbishopMinasoko: "heroKibouHidamari" };
export const canonicalPassiveKey = (key) => PASSIVE_ALIASES[key] || key;
export const HOPE_HIDAMARI = {
  label: "希望の陽だまり", scope: "party",
  lv: [4, 8, 12].map(pct => `2ターン目から毎ターン、味方全員のHPを最大の${pct}%回復（隊の生存者の最高Lvのみ・重複なし）`),
  fx: [{ t: "round", party: true, hp: [0.04, 0.08, 0.12] }],
};
