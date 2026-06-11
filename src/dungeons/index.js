// ダンジョン・レジストリ: 各ダンジョン・モジュールを集約する単一の窓口。
// 新ダンジョン追加 = ここに import を1行足すだけ (IDは名前空間化済みなので衝突しない)。
import { COMMON_MONSTERS } from "./common.js";
import * as d01 from "./d01.js";
import * as d02 from "./d02.js";
import * as d03 from "./d03.js";
import * as d04 from "./d04.js";

export { MON_RACES, RACE_LABEL } from "./schema.js";

// 登録順がそのままゲーム内の解放順になる
const MODULES = [d01, d02, d03, d04];

// 全ダンジョン設定 (board.js の旧 DUNGEONS 配列を置き換える)
export const DUNGEONS = MODULES.map((m) => m.dungeon);

// 全モンスター辞書 (共通 + 各ダンジョン固有)。sprites.js の MONSTERS に統合する
export const DUNGEON_MONSTERS = (() => {
  const out = { ...COMMON_MONSTERS };
  for (const m of MODULES) {
    for (const id in m.monsters) {
      if (out[id]) throw new Error("duplicate monster id across dungeons: " + id);
      out[id] = m.monsters[id];
    }
  }
  return out;
})();
