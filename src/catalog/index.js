// アイテムカタログの集約窓口。
// 各カテゴリファイル (weapons/armor/gear/misc) を統合し、ID重複を検査する。
// アイテムを追加するときは各ファイルに追記するだけでよい (append-only)。
import { WEAPONS } from "./weapons.js";
import { WEAPONS2 } from "./weapons2.js";
import { SHIELDS, ARMORS } from "./armor.js";
import { SHIELDS2, ARMORS2 } from "./armor2.js";
import { HEADS, FEET, HANDS, ACCS } from "./gear.js";
import { HEADS2, FEET2 } from "./gear2.js";
import { HANDS2, ACCS2 } from "./gear3.js";
import { MISC, USABLES } from "./misc.js";
import { MISC2, USABLES2 } from "./misc2.js";
import { LEGENDS } from "./legends.js";
import { EXCLUSIVES } from "./exclusives.js";

// { id: item } に統合。ID重複は即エラー (セーブ/図鑑の参照を守る)
export const CATALOG_ITEMS = {};
for (const list of [WEAPONS, WEAPONS2, SHIELDS, SHIELDS2, ARMORS, ARMORS2, HEADS, HEADS2, FEET, FEET2, HANDS, HANDS2, ACCS, ACCS2, MISC, MISC2, USABLES, USABLES2, LEGENDS, EXCLUSIVES]) {
  for (const it of list) {
    if (CATALOG_ITEMS[it.id]) throw new Error("duplicate item id: " + it.id);
    CATALOG_ITEMS[it.id] = it;
  }
}
