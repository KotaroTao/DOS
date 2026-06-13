// アイテムカタログの集約窓口。
// 各カテゴリファイル (weapons/armor/gear/misc) を統合し、ID重複を検査する。
// アイテムを追加するときは各ファイルに追記するだけでよい (append-only)。
import { WEAPONS } from "./weapons.js";
import { SHIELDS, ARMORS } from "./armor.js";
import { HEADS, FEET, HANDS, ACCS } from "./gear.js";
import { MISC, USABLES } from "./misc.js";
import { LEGENDS } from "./legends.js";
import { EXCLUSIVES } from "./exclusives.js";
import { LR_ITEMS } from "./lr.js";
// ランク別 標準装備 (R1-R20 を順次拡充。各ランクで全職が全部位2種以上を装備できる素体装備)
import { RANK1_ITEMS } from "./ranks/r01.js";
import { RANK2_ITEMS } from "./ranks/r02.js";
import { RANK3_ITEMS } from "./ranks/r03.js";
import { RANK4_ITEMS } from "./ranks/r04.js";
import { RANK5_ITEMS } from "./ranks/r05.js";
import { RANK6_ITEMS } from "./ranks/r06.js";
import { RANK7_ITEMS } from "./ranks/r07.js";
import { RANK8_ITEMS } from "./ranks/r08.js";
import { RANK9_ITEMS } from "./ranks/r09.js";
import { RANK10_ITEMS } from "./ranks/r10.js";
import { RANK11_ITEMS } from "./ranks/r11.js";
import { RANK12_ITEMS } from "./ranks/r12.js";
import { RANK13_ITEMS } from "./ranks/r13.js";
import { RANK14_ITEMS } from "./ranks/r14.js";
import { RANK15_ITEMS } from "./ranks/r15.js";
import { RANK16_ITEMS } from "./ranks/r16.js";
import { RANK17_ITEMS } from "./ranks/r17.js";
import { RANK18_ITEMS } from "./ranks/r18.js";
import { RANK19_ITEMS } from "./ranks/r19.js";

// { id: item } に統合。ID重複は即エラー (セーブ/図鑑の参照を守る)
export const CATALOG_ITEMS = {};
for (const list of [WEAPONS, SHIELDS, ARMORS, HEADS, FEET, HANDS, ACCS, MISC, USABLES, LEGENDS, EXCLUSIVES, LR_ITEMS, RANK1_ITEMS, RANK2_ITEMS, RANK3_ITEMS, RANK4_ITEMS, RANK5_ITEMS, RANK6_ITEMS, RANK7_ITEMS, RANK8_ITEMS, RANK9_ITEMS, RANK10_ITEMS, RANK11_ITEMS, RANK12_ITEMS, RANK13_ITEMS, RANK14_ITEMS, RANK15_ITEMS, RANK16_ITEMS, RANK17_ITEMS, RANK18_ITEMS, RANK19_ITEMS]) {
  for (const it of list) {
    if (CATALOG_ITEMS[it.id]) throw new Error("duplicate item id: " + it.id);
    CATALOG_ITEMS[it.id] = it;
  }
}
