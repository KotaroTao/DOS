import { prepareWeapon } from "../weaponpower.js";
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
import { LAYER2_ITEMS } from "./layer2.js";
import { LAYER3_ITEMS } from "./layer3.js";
import { LAYER4_ITEMS } from "./layer4.js";
import { LAYER5_ITEMS } from "./layer5.js";
import { LAYER6_ITEMS } from "./layer6.js";
import { LAYER7_ITEMS } from "./layer7.js";
import { LAYER8_ITEMS } from "./layer8.js";
import { LAYER9_ITEMS } from "./layer9.js";
import { LAYER10_ITEMS } from "./layer10.js";
import { NAMED_ITEMS } from "./named.js";
import { LOCKPICK_ITEMS } from "./lockpick.js";
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
// ランク別標準装備: 各ランク・各部位 (武器はカテゴリ、盾はジャンル (大盾と円盾は一括り)、防具は重量) に2種ずつあり、
//   隠しレベルの低い方=コモン / 高い方=アンコモン
// 来歴つきの一点物 = レア (能力を一段底上げ) / 職業専用装備・伝説装備 = スーパーレア / LR = レジェンドレア
// (層ごとの逸品 layer1.js … layer10.js は自前で sr/lr と出現する層 layer を持つ)。収集品・道具はレア度を持たない
// 品の括り。武器はカテゴリ、盾はジャンル (大盾と円盾は「守りの盾」で一括り)、防具は重量
//   rarKey  … コモン/アンコモンの割り振り (ランクごと・この括りで lv の低い方がコモン)
//   lineKey … 「lv が上なら性能も上」とドロップ対象の厳選 (武器は片手と両手を別の系列にする — 両手は TWO_MUL 倍なので混ぜると比べられない)
const shieldGroup = (it) => (it.sk === "kite" || it.sk === "round" ? "guard" : it.sk || "guard");
const rarKey = (it) => `${it.slot}|${it.slot === "shield" ? shieldGroup(it) : it.cat || it.weight || ""}`;
const lineKey = (it) => `${it.slot}|${it.slot === "weapon" ? it.cat + (it.twoHanded ? "2" : "1") : it.slot === "shield" ? it.sk || "" : it.weight || ""}`;
const RANK_LISTS = [RANK1_ITEMS, RANK2_ITEMS, RANK3_ITEMS, RANK4_ITEMS, RANK5_ITEMS, RANK6_ITEMS, RANK7_ITEMS, RANK8_ITEMS, RANK9_ITEMS, RANK10_ITEMS,
  RANK11_ITEMS, RANK12_ITEMS, RANK13_ITEMS, RANK14_ITEMS, RANK15_ITEMS, RANK16_ITEMS, RANK17_ITEMS, RANK18_ITEMS, RANK19_ITEMS, RANK20_ITEMS];
for (const list of RANK_LISTS) {
  const groups = new Map();
  for (const it of list) {
    const key = rarKey(it);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(it);
  }
  for (const g of groups.values()) {
    const sorted = [...g].sort((a, b) => a.lv - b.lv);
    sorted.forEach((it, i) => { it.rar = i < Math.ceil(sorted.length / 2) ? "c" : "uc"; });
  }
}
for (const list of [WEAPONS, SHIELDS, ARMORS, HEADS, FEET, HANDS, ACCS]) for (const it of list) { it.rar = "r"; applyRareBoost(it); }

// ===== 状態異常耐性 (aRes) をランク別標準装備に持たせる =====
// 各ランクの「上の方」(アンコモン) の頭防具と護符だけに、ランクに応じた耐性を付ける (R1 11% → R20 30%)。
//   頭: 重装 (兜) = 混乱 / 軽装 (頭巾・笠) = 眠り / 布 (額環・帽子) = 魅了 — 頭を守る品は心も守る
//   装飾 (お守り・護符の系統) = 魅了と混乱
// 一点物・層の逸品は品ごとに書く (gear.js / layer*.js の aRes)。毒・麻痺・石化は一点物だけが持つ
RANK_LISTS.forEach((list, bi) => {
  const v = Math.round((0.10 + 0.01 * (bi + 1)) * 100) / 100;
  for (const it of list) {
    if (it.rar !== "uc" || it.aRes) continue;
    if (it.slot === "head") it.aRes = { [it.weight === "heavy" ? "confuse" : it.weight === "light" ? "sleep" : "charm"]: v };
    else if (it.slot === "acc") it.aRes = { charm: v, confuse: v };
  }
});
// ===== ブレス耐性 (bRes) をランク別標準装備に持たせる =====
// 各ランクのアンコモンの盾と胴防具に、ランクに応じたブレス耐性を付ける (盾 R1 11% → R20 30% / 胴はその6割)。
// 小盾・宝珠・聖典もアンコモンなら持つ。一点物は品ごとに書く (gear.js の竜鱗の品など)
RANK_LISTS.forEach((list, bi) => {
  const v = 0.10 + 0.01 * (bi + 1);
  for (const it of list) {
    if (it.rar !== "uc" || it.bRes) continue;
    if (it.slot === "shield") it.bRes = Math.round(v * 100) / 100;
    else if (it.slot === "body") it.bRes = Math.round(v * 0.6 * 100) / 100;
  }
});

// ===== ランク別標準装備は「lv が上なら必ず性能も上」にする =====
// 能力値は整数に丸めるので、低いランクでは lv の違う品が同じ性能になることがある
// (例: R1 の籠手 lv5/lv10 がどちらも ATK+2 で、コモンとアンコモンの差が無い)。
// 系列ごと (武器はカテゴリ×片手/両手、盾はジャンル、防具は重量) に lv 順に並べ、より低い lv の品をどこも上回っていない品は
// 主ステ (最も大きい能力) を +1 ずつ上げて差をつける。状態異常耐性を持つ品はそれで上回っているものとみなす
const RANK_STAT_KEYS = ["atk", "vit", "agi", "int", "pie", "luk", "hp", "mp"];
const RANK_STAT_W = { hp: 0.15, mp: 0.25 };
const notAbove = (u, c) => !(u.aRes && !c.aRes) && !(u.bRes && !c.bRes) && RANK_STAT_KEYS.every((k) => (u[k] || 0) <= (c[k] || 0));
{
  const groups = new Map();
  for (const list of RANK_LISTS) for (const it of list) {
    const key = lineKey(it);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(it);
  }
  for (const g of groups.values()) {
    g.sort((a, b) => a.lv - b.lv);
    g.forEach((u, i) => {
      const lower = g.slice(0, i).filter((c) => c.lv < u.lv);
      const main = RANK_STAT_KEYS.reduce((a, k) => ((u[k] || 0) * (RANK_STAT_W[k] || 1) > (u[a] || 0) * (RANK_STAT_W[a] || 1) ? k : a), "atk");
      while (lower.some((c) => notAbove(u, c))) u[main] = (u[main] || 0) + 1;
    });
  }
}

// ===== ドロップ対象の厳選 (コモン〜レアは「少数精鋭」) =====
// 品数が多すぎると拾うたびに新しい名前ばかりで、特別な品との差が見えなくなる。
// コモン〜レアは帯ごとに出現対象を絞って何度も出会う「いつもの品」にし、スーパーレア以上の感動を際立たせる。
// 外した品も削除はしない (カタログ・図鑑・既存セーブにはそのまま残る)。noDrop を立ててドロップ表から外すだけ。
//   標準装備: 各ランク帯・各部位 (武器カテゴリ×片手/両手 / 盾のジャンル / 防具の重量) につき1点。コモンかアンコモンかは帯ごとに交互
//   レア (一点物): 各ランク帯 RARE_PER_BAND 点 (id の安定ハッシュで決定的に選ぶ。部位が偏らないよう順番に拾う)
const RARE_PER_BAND = 4;
const stableHash = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
RANK_LISTS.forEach((list, bi) => {
  const groups = new Map();
  for (const it of list) {
    const key = it.slot === "shield" ? `shield|${shieldGroup(it)}` : lineKey(it);
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
// 能力補正 (scale) / 魔法属性 (magic) を持つ武器は数が少なく、戦い方を変える品なので必ずドロップ対象に残す
for (const list of [WEAPONS, ...RANK_LISTS]) for (const it of list) if (it.scale || it.magic) delete it.noDrop;
for (const list of [LEGENDS, EXCLUSIVES]) for (const it of list) it.rar = "sr";
for (const it of LR_ITEMS) it.rar = "lr";

// { id: item } に統合。ID重複は即エラー (セーブ/図鑑の参照を守る)
export const CATALOG_ITEMS = {};
for (const list of [WEAPONS, SHIELDS, ARMORS, HEADS, FEET, HANDS, ACCS, MISC, USABLES, LEGENDS, EXCLUSIVES, LR_ITEMS, LAYER1_ITEMS, LAYER2_ITEMS, LAYER3_ITEMS, LAYER4_ITEMS, LAYER5_ITEMS, LAYER6_ITEMS, LAYER7_ITEMS, LAYER8_ITEMS, LAYER9_ITEMS, LAYER10_ITEMS, NAMED_ITEMS, LOCKPICK_ITEMS, RANK1_ITEMS, RANK2_ITEMS, RANK3_ITEMS, RANK4_ITEMS, RANK5_ITEMS, RANK6_ITEMS, RANK7_ITEMS, RANK8_ITEMS, RANK9_ITEMS, RANK10_ITEMS, RANK11_ITEMS, RANK12_ITEMS, RANK13_ITEMS, RANK14_ITEMS, RANK15_ITEMS, RANK16_ITEMS, RANK17_ITEMS, RANK18_ITEMS, RANK19_ITEMS, RANK20_ITEMS]) {
  for (const it of list) {
    if (CATALOG_ITEMS[it.id]) throw new Error("duplicate item id: " + it.id);
    prepareWeapon(it);
    CATALOG_ITEMS[it.id] = it;
  }
}
