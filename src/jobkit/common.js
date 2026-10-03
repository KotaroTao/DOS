// 職ごとの固有技・固有パッシブ (jobkit) で共有する定数。skilldefs.js もここから読む (循環 import を避けるため)
export const UNHOLY = ["undead", "specter", "demon"];
export const BEASTS = ["beast", "wing", "insect", "reptile", "plant", "aquatic"];
export const DRAGONS = ["dragon", "reptile", "wing"];
export const MACHINES = ["construct", "armored", "elemental"];
export const PREY_GROUPS = { UNHOLY, BEASTS, DRAGONS, MACHINES };
