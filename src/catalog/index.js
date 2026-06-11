// アイテムカタログの集約窓口。
// 各カテゴリファイル (weapons/armor/gear/misc) を統合し、ID重複を検査する。
// アイテムを追加するときは各ファイルに追記するだけでよい (append-only)。
// TODO(カタログ執筆中): armor は執筆が終わり次第 import を戻す
import { WEAPONS } from "./weapons.js";
import { HEADS, FEET } from "./gear.js";
import { MISC, USABLES } from "./misc.js";

// { id: item } に統合。ID重複は即エラー (セーブ/図鑑の参照を守る)
export const CATALOG_ITEMS = {};
for (const list of [WEAPONS, HEADS, FEET, MISC, USABLES]) {
  for (const it of list) {
    if (CATALOG_ITEMS[it.id]) throw new Error("duplicate item id: " + it.id);
    CATALOG_ITEMS[it.id] = it;
  }
}
