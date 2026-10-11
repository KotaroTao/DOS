// 装備できるLv (src/equiplevel.js) の検証: 表の形・どの迷宮でも拾った品を推奨Lv の隊が付けられる・判定と最適装備・表示の文。
// node tools/balance/equip-level.mjs
import assert from "node:assert/strict";
import { ITEMS, registerEquipLevel, equipLevelOf, canEquip, equipLvShort, equipFailMsg, equip } from "../../src/items.js";
import { CATALOG_ITEMS } from "../../src/catalog/index.js";
import { WORLD } from "../../src/dungeons/world.js";
import { equipLvTable, equipLevelFor, LR_UNLOCK, LOOT_R_HEADROOM } from "../../src/equiplevel.js";
import { makeDoll, makeSoulInstance, setSharedSouls, recalcDoll } from "../../src/souls.js";
import { planBestEquip } from "../../src/autoequip.js";

Object.assign(ITEMS, CATALOG_ITEMS);
for (const it of Object.values(ITEMS)) if (it.r20 == null) it.r20 = Math.max(1, Math.min(20, Math.ceil((it.lv || 1) / 10)));
registerEquipLevel(equipLevelFor);

// 1. 表: R1〜3 は Lv1、上のランクほど低くならない
const t = equipLvTable();
assert.equal(t.length, 21);
for (let R = 1; R <= 3; R++) assert.equal(t[R], 1, `R${R} は Lv1`);
for (let R = 2; R <= 20; R++) assert(t[R] >= t[R - 1], `R${R} が R${R - 1} より低い`);

// 2. どの迷宮でも、通常の抽選で落ちうる装備は、その迷宮の推奨Lv (1階) の隊が付けられる
const gear = Object.values(ITEMS).filter((it) => it.slot && !["use", "misc", "mat"].includes(it.slot));
let checked = 0;
for (const d of WORLD) {
  const cap = Math.min(20, Math.ceil(d.lootLv[1] / 10) + LOOT_R_HEADROOM);
  for (const it of gear) {
    const R = it.r20;
    let drops;
    if (it.rar === "lr" && !it.layer && (it.lr || 0) >= 5) drops = d.lootLv[1] >= (LR_UNLOCK[it.lr] || 40);
    else {
      const L = it.layer || (it.rar === "lr" && it.lr < 5 ? it.lr : 0);
      drops = R <= cap && (!L || L <= d.layer);
    }
    if (!drops) continue;
    checked++;
    assert(equipLevelFor(it) <= d.lv, `${d.id} (推奨Lv${d.lv}) で落ちる ${it.name} の装備できるLv ${equipLevelFor(it)}`);
  }
}
// その品が落ちる迷宮のうち一番低い推奨Lv に一致する (台帳で落ちる品)
for (const it of gear) {
  const lvs = WORLD.filter((d) => {
    const cap = Math.min(20, Math.ceil(d.lootLv[1] / 10) + LOOT_R_HEADROOM);
    if (it.rar === "lr" && !it.layer && (it.lr || 0) >= 5) return d.lootLv[1] >= (LR_UNLOCK[it.lr] || 40);
    const L = it.layer || (it.rar === "lr" && it.lr < 5 ? it.lr : 0);
    return it.r20 <= cap && (!L || L <= d.layer);
  }).map((d) => d.lv);
  if (lvs.length) assert.equal(equipLevelFor(it), Math.min(...lvs), `${it.name} の装備できるLv`);
}
// 装備でない品は Lv1
for (const it of Object.values(ITEMS).filter((x) => ["use", "misc"].includes(x.slot))) assert.equal(equipLevelOf(it), 1);

// 3. 判定: メイン魂の Lv が届けば付けられ、届かなければ付けられない (職の判定とは別)
const sword = gear.find((it) => it.slot === "weapon" && it.cat === "ls" && !it.classes && !it.forJob && !it.align && equipLevelFor(it) >= 40);
const need = equipLevelFor(sword);
const soul = makeSoulInstance("fighter", 50, need - 1);
soul.capBonus = 200;
setSharedSouls([soul]);
const doll = makeDoll("検証");
doll.primary = soul.uid;
recalcDoll(doll);
assert.equal(doll.jobLv, need - 1);
assert.equal(canEquip(doll, sword), false, "Lv が足りない");
assert.equal(canEquip(doll, sword, { anyLv: true }), true, "職は扱える");
assert.equal(equipLvShort(doll, sword), need);
assert(equipFailMsg(doll, sword).includes(`Lv${need}`), "知らせに必要な Lv");
doll.items.push(sword);
assert.equal(equip(doll, sword).ok, false, "equip も断る");
// 最適装備は届かない品を選ばない
const plan = planBestEquip([doll]);
assert(!plan.moves.some((m) => m.item === sword), "最適装備が Lv の足りない品を選んだ");
soul.level = need;
recalcDoll(doll);
assert.equal(canEquip(doll, sword), true, "Lv が届けば付けられる");
assert.equal(equipLvShort(doll, sword), 0);
// jobLv を持たない見立て用の仮の人業は Lv を問わない
assert.equal(canEquip({ clsKey: "fighter" }, sword), true);

console.log(`装備できるLv: R1〜20 = ${t.slice(1).join(" / ")} ・ 迷宮${WORLD.length}か所の落とし物 ${checked}件・判定・最適装備 OK`);
