// ダンジョン・レジストリ: ゲーム本体へモンスター辞書と迷宮設定を供給する単一の窓口。
// ・迷宮は world.js の台帳 (手で組んだ迷宮)。奈落も台帳から層ごとに組む (world.js abyssLayer)
// ・モンスターは bestiary.js (層の顔ぶれ LAYER_POOLS・層の主 LAYER_BOSS・層の強敵 LAYER_ELITES)
import { BESTIARY, LAYER_ELITES as LE, LAYER_BOSS as LB } from "./bestiary.js";
import { WORLD } from "./world.js";

export { MON_RACES, RACE_LABEL, ELEMENTS, elemMult, elemBeats, elemDmgMult, resistRate, resistHpMul, RESIST_RATE, RESIST_TAG, METAL_TIERS, TRAITS, monsterTraitKeys, monsterTraits, isFloating } from "./schema.js";
export { unknownName, unknownLabel, unknownTag, UNKNOWN_MARK, UNK_OPEN, UNK_CLOSE } from "./unknown.js";

// 地図に並ぶ迷宮 (world.js の台帳。並び順 = 出撃シート・図鑑の並び)。G.dungeonIdx はこの添字
export const DUNGEONS = WORLD;
export { WORLD_IDS, worldIndexOf, worldById, gateFloors, isGateFloor, dungeonLevel, dungeonLevelRaw, powerAt, strengthAt, lootBand, levelBand, abyssLayer, ABYSS_LAYER_FLOORS, hazardsAt } from "./world.js";

// 全モンスター辞書。sprites.js の MONSTERS に統合する
export const DUNGEON_MONSTERS = BESTIARY;

// 層ごとの強敵 (層 → [id])
export const LAYER_ELITES = LE;

// 層ボス (20体)。奈落の門番もこれ
export const LAYER_BOSS = LB;
