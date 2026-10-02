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
import { LAYER1_ITEMS } from "./layer1.js";
import { applyRareBoost } from "../rarity.js";
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
import { RANK20_ITEMS } from "./ranks/r20.js";

// ===== 装備のレア度 (rarity.js) を出自から付ける =====
// ランク別標準装備: 各ランク・各部位 (武器はカテゴリ、防具は重量) に2種ずつあり、
//   隠しレベルの低い方=コモン / 高い方=アンコモン
// 来歴つきの一点物 = レア (能力を一段底上げ) / 職業専用装備・伝説装備 = スーパーレア / LR = レジェンドレア
// (層ごとの逸品 layer1.js は自前で sr/lr を持つ)。蒐集品・道具はレア度を持たない
const RANK_LISTS = [RANK1_ITEMS, RANK2_ITEMS, RANK3_ITEMS, RANK4_ITEMS, RANK5_ITEMS, RANK6_ITEMS, RANK7_ITEMS, RANK8_ITEMS, RANK9_ITEMS, RANK10_ITEMS,
  RANK11_ITEMS, RANK12_ITEMS, RANK13_ITEMS, RANK14_ITEMS, RANK15_ITEMS, RANK16_ITEMS, RANK17_ITEMS, RANK18_ITEMS, RANK19_ITEMS, RANK20_ITEMS];
for (const list of RANK_LISTS) {
  const groups = new Map();
  for (const it of list) {
    const key = `${it.slot}|${it.cat || it.weight || ""}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(it);
  }
  for (const g of groups.values()) {
    const sorted = [...g].sort((a, b) => a.lv - b.lv);
    sorted.forEach((it, i) => { it.rar = i < Math.ceil(sorted.length / 2) ? "c" : "uc"; });
  }
}
for (const list of [WEAPONS, SHIELDS, ARMORS, HEADS, FEET, HANDS, ACCS]) for (const it of list) { it.rar = "r"; applyRareBoost(it); }

// ===== ドロップ対象の厳選 (コモン〜レアは「少数精鋭」) =====
// 品数が多すぎると拾うたびに新しい名前ばかりで、特別な品との差が見えなくなる。
// コモン〜レアは帯ごとに出現対象を絞って何度も出会う「いつもの品」にし、スーパーレア以上の感動を際立たせる。
// 外した品も削除はしない (カタログ・図鑑・既存セーブにはそのまま残る)。noDrop を立ててドロップ表から外すだけ。
//   標準装備: 各ランク帯・各部位 (武器カテゴリ/防具の重量) につき1点。コモンかアンコモンかは帯ごとに交互
//   レア (一点物): 各ランク帯 RARE_PER_BAND 点 (id の安定ハッシュで決定的に選ぶ。部位が偏らないよう順番に拾う)
const RARE_PER_BAND = 4;
const stableHash = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
RANK_LISTS.forEach((list, bi) => {
  const groups = new Map();
  for (const it of list) {
    const key = `${it.slot}|${it.cat || it.weight || ""}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(it);
  }
  let gi = 0;
  for (const g of groups.values()) {
    const sorted = [...g].sort((a, b) => a.lv - b.lv);
    const wantUC = (bi + gi) % 2 === 1; // 帯と部位ごとにコモン/アンコモンを交互に残す
    const keep = sorted.find((it) => (it.rar === "uc") === wantUC) || sorted[0];
    for (const it of sorted) if (it !== keep) it.noDrop = true;
    gi++;
  }
});
{
  const byBand = new Map();
  for (const list of [WEAPONS, SHIELDS, ARMORS, HEADS, FEET, HANDS, ACCS]) for (const it of list) {
    const b = Math.max(1, Math.min(20, Math.ceil(it.lv / 10)));
    if (!byBand.has(b)) byBand.set(b, []);
    byBand.get(b).push(it);
  }
  for (const list of byBand.values()) {
    // 部位ごとにハッシュ順へ並べ、部位を巡回しながら RARE_PER_BAND 点だけ残す
    const bySlot = new Map();
    for (const it of list) { if (!bySlot.has(it.slot)) bySlot.set(it.slot, []); bySlot.get(it.slot).push(it); }
    for (const arr of bySlot.values()) arr.sort((a, b) => stableHash(a.id) - stableHash(b.id));
    const slots = [...bySlot.keys()].sort((a, b) => stableHash(a) - stableHash(b));
    const keep = new Set();
    for (let round = 0; keep.size < RARE_PER_BAND && round < 20; round++) {
      for (const sl of slots) {
        const arr = bySlot.get(sl);
        if (arr[round] && keep.size < RARE_PER_BAND) keep.add(arr[round]);
      }
    }
    for (const it of list) if (!keep.has(it)) it.noDrop = true;
  }
}
for (const list of [LEGENDS, EXCLUSIVES]) for (const it of list) it.rar = "sr";
for (const it of LR_ITEMS) it.rar = "lr";

// { id: item } に統合。ID重複は即エラー (セーブ/図鑑の参照を守る)
export const CATALOG_ITEMS = {};
for (const list of [WEAPONS, SHIELDS, ARMORS, HEADS, FEET, HANDS, ACCS, MISC, USABLES, LEGENDS, EXCLUSIVES, LR_ITEMS, LAYER1_ITEMS, RANK1_ITEMS, RANK2_ITEMS, RANK3_ITEMS, RANK4_ITEMS, RANK5_ITEMS, RANK6_ITEMS, RANK7_ITEMS, RANK8_ITEMS, RANK9_ITEMS, RANK10_ITEMS, RANK11_ITEMS, RANK12_ITEMS, RANK13_ITEMS, RANK14_ITEMS, RANK15_ITEMS, RANK16_ITEMS, RANK17_ITEMS, RANK18_ITEMS, RANK19_ITEMS, RANK20_ITEMS]) {
  for (const it of list) {
    if (CATALOG_ITEMS[it.id]) throw new Error("duplicate item id: " + it.id);
    CATALOG_ITEMS[it.id] = it;
  }
}
