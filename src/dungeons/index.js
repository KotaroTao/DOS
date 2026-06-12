// ダンジョン・レジストリ: ゲーム本体へモンスター辞書と迷宮設定を供給する単一の窓口。
// ・迷宮は generator.js が番号 (1-100) から決定的に生成する (手書き設定は廃止)
// ・モンスターは bestiary.js がランク1-10で束ねる (旧 d01-d04 の個体は id を保ったまま吸収)
// ・モンスター追加 = bestiary.js に追記するだけ。該当ランクの迷宮に自動で出現する
import { BESTIARY, ELITE_POOLS as EP } from "./bestiary.js";
import { DUNGEONS as GENERATED } from "./generator.js";

export { MON_RACES, RACE_LABEL, ELEMENTS, elemMult, elemBeats, elemDmgMult } from "./schema.js";

// 全ダンジョン設定 (並び順 = ゲーム内の解放順)
export const DUNGEONS = GENERATED;

// 全モンスター辞書。sprites.js の MONSTERS に統合する
export const DUNGEON_MONSTERS = BESTIARY;

// 強敵階プール: tier (1/2/3) → [monsterKey, ...]
export const ELITE_POOLS = EP;
