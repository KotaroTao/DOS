// メインゲーム: カードボード探索 ⇄ 戦闘 (モンスターメーカー風)
import { makeBoard, COLS, ROWS } from "./board.js";
import { MONSTERS, HERO, ICONS, drawSpriteFit } from "./sprites.js";
import { spawnCardEnemies, spawnBossEnemies, spawnEliteEnemies, spawnMimic, spawnRanked, Battle, SPELLS, cloneItem, spellCost, setOnEnemyKilled, perkVictory } from "./combat.js";
import { initAudio, SFX, playBgm, toggleMute, isMuted, setVolumes } from "./audio.js";
import { spriteCanvas, crispCanvas, drawPhoto } from "./sprites.js";
import {
  ITEMS, SLOTS, SLOT_LABEL, MAX_ITEMS, equip as equipItem, unequip as unequipItem, canEquip, slotKeyFor, lvToRank, RANGE_LABEL,
  UNIDENT_SLOTS, itemName, applyForge,
} from "./items.js";
import { EVENT_MAP, EV_FLOOR_RATE, EV_FLOOR_RATE_D1, EV_BOONS, eligibleEvents, pickEvent, onceKey, runEvent, eventFightWon } from "./events.js";
import { ITEM_RANK_NAME, ITEM_RANK_COLOR } from "./content.js";
import { TAVERN_SPEAKERS, TAVERN_HINTS } from "./tavern.js";
import { ACTS, actOf, msqOrderLines, msqReportLines, msqReward, EPILOGUE, unlockSceneFor, sealLines, unsealLines } from "./story.js";
import { CATALOG_ITEMS } from "./catalog/index.js";
import { DUNGEONS, DUNGEON_MONSTERS, ELEMENTS, ELITE_ORDER, LAYER_ELITES, LAYER_BOSS, monsterTraits, layerOf, isFloating } from "./dungeons/index.js";
import {
  ABYSS_MODS, ABYSS_MOD_MAP, ABYSS_MUT_MAP, ABYSS_BOSS_EVERY, ABYSS_MUT_EVERY, abyssScore, abyssScoreMul, rollAbyssMutation, weekSeedId, mulberry32,
} from "./abyss.js";
import {
  SOUL_CLASSES, SOUL_KEYS, makeDoll, jobSprite, dollSprite, jobBust, dollBust, soulIcon,
  recalcDoll, soulLevelCap, soulLevelCapOf, emberCostOf, setSharedSouls, syncDollUids, MAX_SUBS, subPicks,
  soulByUid, makeSoulInstance, soulRankOf, soulLearnedSkills,
  ORDER_PERK, orderPassiveMap,
  PASSIVES,
  SOUL_RANKS, rollJobClass, rollGreatJobClass, SOUL_STAT_UP,
  soulRankFromCount, capForRarityRank, jobRankName, soulSeriesName, pLv,
  identifyChance, canIdentify,
  battleSkills,
} from "./souls.js";
import { showOpening } from "./opening.js";
import { KING_PORTRAIT, prewarmTown } from "./townart.js";
import { drawBattleBackdrop } from "./backdrops.js";
import { paintCryptFloor, paintCryptSlabs, paintCryptWalls, CATACOMB, genericMaterial, boardSeed, hexRgb } from "./crypt.js";
import { showTitle } from "./title.js";
import { RARITIES, rarityKey, rarityColor, rarityLabel, rollRarity, layerRarityUp, lrIntervalH, lrLayerFactor, LR_HAZARD_K, LR_PITY_K } from "./rarity.js";
// ---- UI 基盤 (Phase 0)。新しい UI モジュールは game.js を import せず、ctx.js の UI/game/ops を通す ----
import { UI, ops, bindGame, registerUI } from "./ui/ctx.js";
import { el, btn, button as kitButton, longPress as attachLongPress, uiBlocked, sheetDepth, sheet, toast as kitToast, confirm as kitConfirm, plainText, shake as kitShake } from "./ui/kit.js";
import { nav } from "./ui/nav.js";
import * as townshell from "./ui/townshell.js";
import { showSkillPopup,
  SPELL_KIND_COLOR, BUFF_NAME, tagRow, spellTagKinds, isEquippable, equipPreviewDelta, equipCompareEl, detailLines,
  equipClassText, equipPartyChips, gearScore, enemyReveal, enemyLabel,
} from "./ui/itemview.js";
import * as uiHub from "./ui/hub.js";
import * as uiPalace from "./ui/palace.js";
import * as uiFacilities from "./ui/facilities.js";
import * as uiSettings from "./ui/settings.js";
import * as uiStory from "./ui/story.js";
import * as uiParty from "./ui/party.js";
import * as uiSoulPanel from "./ui/soulpanel.js";
import * as autoEquip from "./autoequip.js";
import * as uiShop from "./ui/shop.js";
import * as uiLoot from "./ui/loot.js";
import * as uiDeparture from "./ui/departure.js";
import * as uiDungeonHud from "./ui/dungeonhud.js";
import * as uiResults from "./ui/results.js";
import * as uiAppraise from "./ui/appraise.js";
import * as uiTutorial from "./ui/tutorial.js";

// キャンバスに描く文字の書体 (画面の明朝と揃える)
const CANVAS_SERIF = '"Shippori Mincho B1", "Hiragino Mincho ProN", "Yu Mincho", "YuMincho", "Noto Serif JP", "Noto Serif CJK JP", serif';
// 視差・揺れを抑える設定 (OSの「視差効果を減らす」)。待機アニメなどを止める
const REDUCED_MOTION = (() => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } })();
import { pickTrap, CHEST_RANKS, rollChestRank } from "./traps.js";
import { tlOn, tlSnapshot, tlBattleBegin, tlHits, tlBattleEnd } from "./telemetry.js";
import { baselineAgi, progressX } from "./baseline.js";
import { repriceEquipment } from "./pricing.js";

// ===== コンテンツの取り込み =====
// アイテム: 一点物の手作りカタログ (src/catalog/)。二つ名つきの量産品は廃止。
// モンスター: ダンジョン単位で手作りした図鑑 (src/dungeons/) を統合。
Object.assign(ITEMS, CATALOG_ITEMS);
// レア度の無い装備 (items.js の基本装備など) はコモン扱い。収集品・道具はレア度なし。
// 基本装備は商店の品揃え専用とし、迷宮のドロップ表からは外す (ドロップのコモンはランク別標準装備が担う)
for (const id in ITEMS) {
  const it = ITEMS[id];
  if (!it.rar && it.slot && it.slot !== "misc" && it.slot !== "use" && it.slot !== "mat") {
    it.rar = it.lr ? "lr" : "c";
    if (!CATALOG_ITEMS[id]) it.noDrop = true;
  }
}
// 装備の値段は性能 (能力値・属性・耐性・効果) から付け直す (src/pricing.js)。
// 性能が同じ品は同じ値段、どこも同等以上の品は必ず高くなる
repriceEquipment(ITEMS);
Object.assign(MONSTERS, DUNGEON_MONSTERS);
// 隠しレベル lv (1-50) と表示ランクの補完 (カタログ品は定義済み)
for (const id in ITEMS) {
  const it = ITEMS[id];
  if (it.lv == null) it.lv = 1;
  if (it.rank == null) it.rank = lvToRank(it.lv);
  // R1-20 (ドロップ窓の判定に使う隠しランク)。当面は lv から算出する暫定値で、
  // 別途用意するランク表 (各アイテムの r20) が来たら差し替える。
  if (it.r20 == null) it.r20 = Math.max(1, Math.min(20, Math.ceil(it.lv / 10)));
}

// アイテムの格の表示名/色。装備はレア度 (コモン〜レジェンドレア) を、収集品などは従来のランクを使う
// 収集品 (slot:"misc") にはランクが無い (格も色も付けない)
const isCollectible = (it) => !!(it && it.slot === "misc");
function itemRankName(it) { return rarityLabel(it) || (it && it.rank && !isCollectible(it) ? ITEM_RANK_NAME[it.rank] : null); }
function itemRankColor(it) { return rarityColor(it) || (it && it.rank && !isCollectible(it) ? ITEM_RANK_COLOR[it.rank] : null); }
// カードの見出し (格): 装備はレア度、職業専用は「専用装備」を添える。収集品はただ「収集品」
function itemGradeText(it, fallback = "アイテム") {
  const rl = rarityLabel(it);
  if (rl) return it.forJob ? `${rl} ・ 専用装備` : rl;
  if (isCollectible(it)) return "収集品";
  return it && it.rank ? `${ITEM_RANK_NAME[it.rank]}級アイテム` : fallback;
}
// ログの色: レア以上はレア度の色で記録する
function logClassForItem(it, dflt = "win") {
  const k = rarityKey(it);
  return k === "r" || k === "sr" || k === "lr" ? "rar-" + k : dflt;
}
// アイテム名の表示要素: レア度の色で名前を塗る (未鑑定でも色だけは見える)
function itemNameEl(tag, cls, it, suffix = "") {
  const e = el(tag, cls, itemName(it) + suffix);
  const k = rarityKey(it);
  if (k) { e.style.color = RARITIES[k].color; e.classList.add("rar-" + k); }
  return e;
}

// ===== 出現テーブル (隠しレベル) =====
// 全アイテムは隠しレベル lv を持つ。迷宮ごとの lootLv 帯 (＋階の深さ) を中心に、
// レベルの近い品だけが出現する。中心より高レベルの品ほど出現率が急減するうえ、
// 全体補正でも高レベル品ほど稀になる (= 強い装備は深い迷宮でしか、稀にしか出ない)。
// exclusive: true のアイテムは専用抽選レイヤーで管理し、通常テーブルには含めない
// noDrop: ドロップ表から外した品 (コモン〜レアの厳選。catalog/index.js)。カタログ・図鑑には残る
const LOOT_IDS = Object.keys(ITEMS).filter((id) => ITEMS[id].slot !== "mat" && !ITEMS[id].exclusive && !ITEMS[id].noDrop).sort();
function lootWeight(lv, center) {
  const d = lv - center;
  if (d > 8 || d < -16) return 0;                       // 出現窓: 中心+8 〜 中心-16
  return Math.exp(-(d * d) / 20) * Math.pow(0.97, Math.max(0, lv - 1));
}
// 中心レベル center 付近のアイテムを重み抽選で1つ選ぶ
function pickItemByLv(center) {
  let total = 0;
  const acc = [];
  for (const id of LOOT_IDS) {
    const w = lootWeight(ITEMS[id].lv, center);
    if (w <= 0) continue;
    total += w;
    acc.push([id, total]);
  }
  if (!total) return "herb";
  const r = Math.random() * total;
  for (const [id, t] of acc) if (r <= t) return id;
  return acc[acc.length - 1][0];
}
// ===== R1-20 ランク窓による出現テーブル =====
// 仕様: 各迷宮には「基準ランク R = ceil(lootLv上限 / 10)」があり (= 層番号。D1-5 → R1, D6-10 → R2 … D96-100 → R20)、
// アイテムはその ±2 (R-2〜R+2、1-20でクランプ) の範囲から出現する (例: 第1層 → R1-3 = 隠しLv1-30)。
// 敵の強さ (monStats のランク) は層ごとに上がるので、装備の格も層に合わせる。
// (以前は R = 迷宮番号で、第1層の D5 から R3-7 (隠しLv21-70) が出て、層の敵を大きく追い越していた)
// 補正で中心を押し上げる: ミミック +1 / マスターミミック +2 / 特別階 +1 / 強敵 +2 /
// レア枠 +2 / 宝箱ランク(1-5) +0〜2 / 迷宮の異変。補正は重複加算するが、中心も窓も出現上限 (lootCapR) で頭打ち。
// 追加迷宮・無限迷宮 (奈落) も cfg.lootLv を持たせるだけで同じ基準に乗る。
function lootBaseR() {
  const band = activeCfg().lootLv || [1, 10];
  return Math.max(1, Math.min(20, Math.ceil(band[1] / 10)));
}
// 出現上限: どんな補正を重ねても、装備は「基準R + LOOT_R_HEADROOM」を超えない。
// 補正 (強敵・宝箱ランク・ミミック・特別階…) は上限の内側で上位の品を出やすくするだけで、
// 層の敵を一足飛びに追い越す装備は出さない (第1層なら最大 R3 = 隠しLv30)
const LOOT_R_HEADROOM = 2;
function lootCapR() { return Math.min(20, lootBaseR() + LOOT_R_HEADROOM); }

let _itemsByR = null;
let _miscLootIds = null;
function itemsByR() {
  if (_itemsByR) return _itemsByR;
  _itemsByR = Array.from({ length: 21 }, () => []);
  _miscLootIds = [];
  // 収集品 (slot:"misc") はランク窓に入れず別枠で全域から抽選する (下記 pickItemByR 参照)。
  for (const id of LOOT_IDS) {
    if (ITEMS[id].slot === "misc") { _miscLootIds.push(id); continue; }
    _itemsByR[Math.max(1, Math.min(20, ITEMS[id].r20 || 1))].push(id);
  }
  return _itemsByR;
}
function miscLootIds() { itemsByR(); return _miscLootIds; }
// 収集品は LR 装備と同様「深度の上限なし」で出続けるが、LR と違い一点ものではなく
// 何度でも同じ品が出る。深い迷宮ほど低ランクの収集品も拾える (D80 でも D20 帯の品が出る) よう、
// 自ランク以下の収集品をすべて対象にする (上限のみ中心+2 まで許容し、極端な先取りは抑える)。
const MISC_LOOT_WEIGHT = 0.5; // 装備のランク窓に対する収集品1点あたりの相対重み
// 中心ランク centerR の ±2 から1つ抽選 (中心ほど出やすい)。窓内が空なら最寄りへ広げる
function pickItemByR(centerR, capR = 20) {
  const idx = itemsByR();
  centerR = Math.max(1, Math.min(20, Math.round(centerR)));
  capR = Math.max(centerR, Math.min(20, capR));
  let total = 0; const acc = [];
  const gather = (lo, hi, weighted) => {
    for (let r = lo; r <= hi; r++) {
      const w = weighted ? Math.max(1, 3 - Math.abs(r - centerR)) : 1;
      for (const id of idx[r]) { total += w; acc.push([id, total]); }
    }
  };
  gather(Math.max(1, centerR - 2), Math.min(capR, centerR + 2), true);
  for (let span = 3; span <= 20 && !total; span++) gather(Math.max(1, centerR - span), Math.min(capR, centerR + span), false);
  // 収集品: 中心+2 以下の全ランク帯を一律の重みで対象に加える (下限なし=深層でも浅層の品が出る)
  const miscCap = Math.min(20, centerR + 2);
  for (const id of miscLootIds()) {
    if (Math.max(1, Math.min(20, ITEMS[id].r20 || 1)) > miscCap) continue;
    total += MISC_LOOT_WEIGHT; acc.push([id, total]);
  }
  if (!total) return "herb";
  const rr = Math.random() * total;
  for (const [id, t] of acc) if (rr <= t) return id;
  return acc[acc.length - 1][0];
}
// 各種補正込みで中心ランクを算出する
function dropCenterR(opts = {}) {
  let r = lootBaseR();
  if (specialDef()) r += 1;                                  // 特別階: 良い宝物 R+1
  if (opts.master) r += 2; else if (opts.mimic) r += 1;      // ミミック / マスターミミック
  if (opts.elite) r += 2;                                    // 強敵討伐
  if (opts.rare) r += 2;                                     // レアドロップ枠 (黒い宝箱・レア戦利品)
  if (opts.chestRank) r += Math.floor(((opts.chestRank || 1) - 1) / 2); // 宝箱ランク 1-5 → +0〜2
  if (opts.lvBonus) r += Math.round(opts.lvBonus / 15);      // ミミック宝箱の底上げ (15→+1, 30→+2)
  r += Math.round(mutNum("lootBonusLv", 0) / 8);             // 迷宮の異変 (深淵の脈動)
  return Math.max(1, Math.min(lootCapR(), r));               // 補正を重ねても出現上限を超えない
}

// ===== レア度つきドロップ (コモン/アンコモン/レア/スーパーレア/レジェンドレア) =====
// 装備ドロップのたびに、まずレア度を抽選し (rarity.js rollRarity)、その格の品をランク窓 (中心R±2) から選ぶ。
// 窓にその格の品が無ければ窓を広げ、それでも無ければ一段下の格に落とす。
// レジェンドレアだけは実プレイ時間で抽選する (lrTimeRoll)。収集品は一定割合で別枠から出る。
const MISC_DROP_RATE = 0.08;
let _byRar = null;
function lootByRarity() {
  if (_byRar) return _byRar;
  _byRar = {};
  for (const k of ["c", "uc", "r", "sr"]) _byRar[k] = Array.from({ length: 21 }, () => []);
  for (const id of Object.keys(ITEMS)) {
    const it = ITEMS[id];
    if (!it.rar || it.rar === "lr" || it.noDrop || it.slot === "misc" || it.slot === "use" || it.slot === "mat") continue;
    // 職業専用装備 (x_) は exclusive だがスーパーレアとして窓に入れる。それ以外の exclusive は除外
    if (it.exclusive && it.rar !== "sr") continue;
    _byRar[it.rar][Math.max(1, Math.min(20, it.r20 || 1))].push(id);
  }
  return _byRar;
}
// 格上げ度: 宝箱ランク・強敵・ミミック・黒い宝箱・特別階・異変で上位の格が出やすくなる
function rarityUp(opts = {}) {
  let up = 0;
  if (opts.chestRank) up += (opts.chestRank - 1) * 0.5;
  if (opts.elite) up += 2;
  if (opts.rare) up += 2;
  if (opts.master) up += 3; else if (opts.mimic) up += 1.5;
  if (opts.lvBonus) up += opts.lvBonus / 15;
  if (specialDef()) up += 0.5;
  if (mutNum("lootBonusLv", 0) > 0) up += 1;
  up += layerRarityUp(battleLayer()); // 深い層ほど高レアが出やすい
  return up;
}
function pickOfRarity(rar, centerR, capR = 20) {
  const idx = lootByRarity()[rar];
  if (!idx) return null;
  // コモン/アンコモンは窓を狭く (中心±1) して顔ぶれを絞る。レア以上は ±2
  const span0 = rar === "c" || rar === "uc" ? 1 : 2;
  const L = battleLayer(); // 層の逸品 (layer つき) は、その層に達するまで出さない
  for (let span = span0; span <= 6; span++) {
    let total = 0; const acc = [];
    for (let r = Math.max(1, centerR - span); r <= Math.min(capR, centerR + span); r++) {
      const w = Math.max(1, 3 - Math.abs(r - centerR));
      for (const id of idx[r]) {
        if ((ITEMS[id].layer || 0) > L) continue;
        const fj = ITEMS[id].forJob; // 職業専用装備は編成にいる職を強く優先
        // 編成の誰かが装備できる品を出やすくする (使えない新品ばかり拾わないように)
        const usable = G.party.some((m) => m.alive !== undefined && canEquip(m, ITEMS[id]));
        const ww = w * (fj ? (G.party.some((m) => m.clsKey === fj) ? 6 : 1) : 1) * (usable ? 3 : 1);
        total += ww; acc.push([id, total]);
      }
    }
    if (total) {
      const x = Math.random() * total;
      for (const [id, t] of acc) if (x <= t) return id;
      return acc[acc.length - 1][0];
    }
  }
  return null;
}
// 戦利品を1つ選ぶ (opts は dropCenterR と同じ補正)。返り値は item id
function pickLoot(opts = {}) {
  const centerR = dropCenterR(opts);
  if (Math.random() < MISC_DROP_RATE) {
    const miscCap = Math.min(20, centerR + 2);
    const pool = miscLootIds().filter((id) => Math.max(1, Math.min(20, ITEMS[id].r20 || 1)) <= miscCap);
    if (pool.length) return pool[rand(pool.length)];
  }
  const lrId = opts.noLR ? null : lrTimeRoll(); // noLR: 迷宮のイベントが直接渡す品 (LR の時間抽選は宝箱・戦利品にだけ使う)
  if (lrId) return lrId;
  const order = ["c", "uc", "r", "sr"];
  const capR = lootCapR();
  let k = order.indexOf(rollRarity(rarityUp(opts)));
  for (; k >= 0; k--) {
    const id = pickOfRarity(order[k], centerR, capR);
    if (id) return id;
  }
  return pickItemByR(centerR, capR);
}

// ===== レジェンドレアの時間抽選 =====
// 実際に遊んでいる時間 (画面が見えていて、直近2分以内に操作がある時間) を数え、
// 装備ドロップのたびに「前回の抽選からの経過時間」ぶんの確率でLRを出す (時間に対するポアソン過程)。
// 平均間隔は潜っている深さで縮み (rarity.js lrIntervalH: 迷宮15まで5h → 迷宮33で4h → 迷宮50以降3h)、天井で必ず出る。
// 時計の進み方は層で変わり、第1層ではほぼ止まる (lrLayerFactor) — 第1層ではほぼ出ない。
const HOUR_MS = 3600 * 1000;
let _lastInputAt = Date.now();
for (const ev of ["pointerdown", "keydown"]) document.addEventListener(ev, () => { _lastInputAt = Date.now(); }, { passive: true, capture: true });
function lrClock() {
  if (!G.lrClock || typeof G.lrClock !== "object") G.lrClock = { since: 0, pend: 0 };
  return G.lrClock;
}
setInterval(() => {
  if (document.visibilityState !== "visible" || Date.now() - _lastInputAt > 120000) return;
  G.stats.playMs = (G.stats.playMs || 0) + 5000; // 戦績: 総プレイ時間
  const f = lrLayerFactor(battleLayer());
  const c = lrClock();
  c.since += 5000 * f; c.pend += 5000 * f;
}, 5000);
// 今の深さで出せるLR (1点もの: 入手済みは除く)。層の逸品 (tier1-4 = 第1〜4層) はその層に達していて、
// 出現上限 (lootCapR) 以内の隠しLvなら候補。職業専用LR (tier5以上) は従来どおり lootLv の解禁値を超えてから
function lrPool() {
  const lv = lootLvAt();
  const capLv = lootCapR() * 10;
  const L = battleLayer();
  return Object.keys(ITEMS).filter((id) => {
    const it = ITEMS[id];
    if (it.rar !== "lr" || (G.lrOwned && G.lrOwned[id])) return false;
    if (it.lr < 5) return (it.layer || it.lr) <= L && (it.lv || 1) <= capLv;
    return lv >= (LR_UNLOCK[it.lr] || 40);
  });
}
function lrIntervalMs() { return lrIntervalH(dungeonNumber(activeCfg())) * HOUR_MS; }
function lrTimeRoll() {
  const c = lrClock();
  const m = lrIntervalMs();
  const p = 1 - Math.exp(-c.pend / (m * LR_HAZARD_K));
  c.pend = 0;
  if (c.since < m * LR_PITY_K && Math.random() >= p) return null;
  const pool = lrPool();
  if (!pool.length) return null;
  let total = 0; const acc = [];
  for (const id of pool) {
    const fj = ITEMS[id].forJob;
    const w = !fj ? 3 : (G.party.some((m) => m.clsKey === fj) ? 6 : 1);
    total += w; acc.push([id, total]);
  }
  const x = Math.random() * total;
  const id = (acc.find(([, t]) => x <= t) || acc[acc.length - 1])[0];
  c.since = 0;
  return id;
}
// 持ちきれずにLRを取り逃した時は、時計を天井に戻して次の装備ドロップで出し直す
function refundLR(it) {
  if (it && it.rar === "lr") lrClock().since = lrIntervalMs() * LR_PITY_K;
}

// ===== 職業専用LR の解禁深度 =====
// LR (tier5以上 = 職業専用) は lootLv がティアの解禁値を超えてから時間抽選の候補に入る。
// 層の逸品 (tier1-4) は lrPool の層・出現上限の条件で候補。1点もの (G.lrOwned) は以後候補から外れる
const LR_UNLOCK = { 5: 40, 10: 90, 15: 140, 20: 190 }; // LR ティア → 解禁 lootLv
let _exclIds = null;
function exclIds() {
  if (!_exclIds) _exclIds = Object.keys(ITEMS).filter((id) => ITEMS[id].exclusive);
  return _exclIds;
}

// 現在の迷宮+階のアイテムレベル (中心値)。迷宮の lootLv 帯を階の深さで補間
function lootLvAt() {
  const cfg = activeCfg();
  const band = cfg.lootLv || [1, 8];
  const floors = Math.max(1, cfg.floors || 3);
  const t = floors > 1 ? Math.min(1, (G.floor - 1) / (floors - 1)) : 0;
  let c = band[0] + (band[1] - band[0]) * t;
  if (Math.random() < 0.05) c += 12; // まれな大当たり: ワンランク上の帯から出る
  c += mutNum("lootBonusLv", 0); // 迷宮の異変 (深淵の脈動): 装備の質が上がる
  return Math.min(200, c);
}

// ===== モンスターの戦利品 =====
// 固有ドロップ (モンスターごとの専用ドロップ表) は廃止。戦利品は勝利後の宝箱から
// 迷宮の lootLv 帯に応じて汎用抽選される (rollGenericDrop)。図鑑にはドロップではなく
// その敵の特徴・スキル (TRAITS) を掲載する。

// ===== モンスターの特殊能力 =====
// 種族とランクから決定的に付与する。戦闘中、一定確率で通常攻撃の代わりに使う。
// 低ランク帯には付けない (序盤の理不尽を避ける)。即死・ドレイン系は深層のみ。
const RACE_ABILITY = {
  amorph: "poison", plant: "poison", insect: "paralyze", reptile: "poison",
  undead: "drain", specter: "soulSteal", demon: "critical", dragon: "breath",
  humanoid: "goldSteal", giant: "critical",
};
for (const k in MONSTERS) {
  const m = MONSTERS[k];
  if (m.ability !== undefined) continue;
  let ab = RACE_ABILITY[m.race] || null;
  if (m.race === "reptile" && (m.rank || 1) >= 6) ab = "stone"; // 深層の爬虫は石化の凝視を持つ
  const minRank = (ab === "drain" || ab === "critical" || ab === "soulSteal" || ab === "stone") ? 4 : 2;
  if (ab && (m.rank || 1) < minRank) ab = null;
  // 迷宮の主は必ず何かしらの特殊能力を持つ
  if (m.boss && !ab) ab = m.race === "dragon" ? "breath" : (m.rank || 1) >= 5 ? "critical" : "paralyze";
  m.ability = ab;
}

// 状態異常の表示定義
const AIL_NAME = { poison: "毒", paralyze: "麻痺", stone: "石化", sleep: "眠り", charm: "魅了", confuse: "混乱" };

const view = document.getElementById("view");
// 盤面/戦闘のキャンバス。第1層以外の旧裏面を静的な層へ焼く間だけ、描画先を差し替える (paintOldCardBacks)
let vctx = view.getContext("2d");
const logEl = document.getElementById("log");
// ログは最新行を常に最下部へ。ただしユーザーが履歴を読もうと上へスクロールしている
// 間は追従しない。戦闘開始でコマンドメニューが出るなどしてログ欄の高さが後から
// 変わると最新行が下端で見切れるため、リサイズにも追従して貼り付け直す。
let _logPinned = true;
function scrollLogBottom() { logEl.scrollTop = logEl.scrollHeight; }
function isLogAtBottom() {
  return logEl.scrollHeight - logEl.scrollTop - logEl.clientHeight < 24;
}
logEl.addEventListener("scroll", () => { _logPinned = isLogAtBottom(); }, { passive: true });
if (typeof ResizeObserver !== "undefined") {
  new ResizeObserver(() => { if (_logPinned) scrollLogBottom(); }).observe(logEl);
}
// 記録欄をタップすると、これまでの記録 (履歴) をシートで読める
logEl.addEventListener("click", () => {
  if (uiBlocked()) return;
  SFX.select();
  uiDungeonHud.openLog();
});
const partyEl = document.getElementById("party");
const combatMenu = document.getElementById("combat-menu");
const floorInfo = document.getElementById("floor-info");
const topbarCur = document.getElementById("topbar-cur");

const G = {
  state: "town",      // town | board | combat | over
  floor: 1,
  maxFloorReached: 1, // 到達した最深階 (表示用)
  dungeonIdx: 0,      // 現在選択中の迷宮
  unlockedDungeons: 1,// 解放済みの迷宮数 (王宮で勅命を受けると増える)
  board: null,
  px: 0, py: 0,
  gold: 200,          // 初期所持金 (宿屋・商店用)
  soulPts: 0,         // Soul(魂): 敵/死体から得る。経験値の役割を兼ね、館で魂のレベルアップに使う
  redSoul: 100,       // Red Soul(赤い魂): プレミアム通貨 (空の人業購入・加護)
  embers: 0,          // 魂の残火: 死体から確定で得る。メイン魂のLv上限を1上げるのに使う
  dollsPurchased: 0,  // 空の人業を購入した回数 (価格の段階に使う)
  dungeonBriefed: false, // 初回潜入時の警備兵の注意事項を表示済みか
  pendingDoll: null,  // (旧形式) 未生成の人業。現在は「空の人業」(isEmpty) として reserve に残る (ロード時に移行)
  party: [],          // 迷宮に連れて行く人業 (最大6体)
  reserve: [],        // 酒場で待機中の人業
  // 魂は1体ごとに固有のインスタンス (本体は魂、人業は器)。同職でも個別に Lv/ランクを持つ。
  souls: [],          // 所持魂 一覧: [{ uid, clsKey, count(吸収数→ランク), level, exp }]
  shopStock: null,    // 商店の在庫 { itemId: 個数 } (初回 setupNewGame で初期化)
  run: null,          // 今回の潜入で得た戦利品 { gold, soulPts, items:[{owner,item}], souls:[] }
  town: { facility: null, sub: null, tab: "hub", page: null }, // 街UIの現在地 (tab: 下のタブ / page: タブの1段下 / facility・sub: 旧画面アダプタ用)
  lastRun: null,      // 直前の潜入のまとめ (帰還の報告カード用。名前・レア度・数・砕けた人業など素のデータ)
  quests: [],         // 受注可能/進行中のクエスト
  dailyQuests: null,  // 日替わりクエスト { seed, list:[] } (日付が変わると再生成)
  subQuests: {},      // 受注済みサブクエスト { id: {…def, state, progress} } (定義は決定的に再生成可能)
  subQuestSeen: [],   // 酒場で一度表示した迷宮index (別の迷宮を選んでも依頼を残す)
  msq: null,          // メインストーリー { n: 章=迷宮番号(1-100), state: "active"|"report"|"offer"|"end" }
  ach: {},            // 受領済みの勲章 (実績) { id: true }
  fastAnim: true,     // 戦闘演出の倍速設定 (永続)。ON = 標準の速さ、OFF = その 1/2 の速さ
  animTempo: 2,       // 倍速の意味を改めた版 (2 = ON が旧来の標準)。この印の無い旧セーブは読み込み時に倍速 ON へ
  autoCombat: false,  // オート戦闘中 (セッション内のみ)
  tavernCrowd: null,  // 酒場に居合わせる者たち (帰還ごとに3〜5名を選び直す) [{type,icon,name,line}]
  rumor: null,        // 酒場で表示中の噂 (次回潜入で現実化)
  rumorCooldown: 0,   // 次の噂を聞けるUNIXタイムスタンプ(ms) — 30分クールダウン
  activeRumor: null,  // 潜入時に確定した、この迷宮で適用する噂
  deliveryQuests: null, // 酒場の納品依頼 [{itemId}] (最大3件。迷宮に潜るたびに入れ替わる)
  codex: { mon: {}, item: {}, job: {}, fresh: { mon: {}, item: {}, job: {} } }, // 図鑑 (モンスター/アイテム/職業)。fresh = 新着 (まだ詳細を見ていない記録)
  treasury: { donated: {}, claimed: {} }, // 王宮の宝物庫: donated={収集品id:true}, claimed={"ランク:しきい値":true}
  lrOwned: {},        // LR(専用装備)は1点もの: 一度入手したidは二度とドロップしない
  lrClock: { since: 0, pend: 0 }, // レジェンドレアの時間抽選 (最後のLRからの/前回抽選からの実プレイms)
  order: { picks: [] }, // 控えの結社: 席に着けた魂のuid配列 (席数=orderSeats()。編成外ランク2以上のみ有効)
  events: { seen: {}, picks: {}, once: {}, flags: {}, fresh: {} }, // 迷宮のイベント (src/events.js): 見聞録・一度きり・恒久の恵み
  irene: { greeted: false, visits: 0, seen: {}, last: null }, // 人業の館の主イレーヌ: 初訪問の挨拶済み・来館数・聞いた話 (src/ui/irene.js)
  tut: { done: {}, cur: null, step: 0, ev: {}, base: {} }, // 解放された要素の手ほどき: 済んだもの・最中のもの (src/ui/tutorial.js)
  story: 0,           // 王宮ストーリーの進行段階
  dragonSlain: false, // 竜を討ったか
  // 戦績。bossIds/elemKills は集合 ({key:true})、swiftBoss/masterMimicSlain は一度きりの達成フラグ
  stats: { runs: 0, deepest: 0, kills: 0, deaths: 0, soulsFound: 0, bossKills: 0,
    chests: 0, mimics: 0, trapsDisarmed: 0, trapsSprung: 0, fusions: 0, questsDone: 0, playMs: 0,
    swiftBoss: false, masterMimicSlain: false, bossIds: {}, elemKills: {} },
  battle: null,
  battleCell: null,   // 戦闘中のモンスターカード
  prevPos: null,      // 逃走時の戻り先
  anim: null,         // アニメーション中フラグ (入力ブロック用)
  flipAnim: null,     // カードめくり演出 { x, y, t0, dur }
  heroAnim: null,     // キャラのスライド { fromX, fromY, toX, toY, t0, dur }
  walking: false,     // 経路自動移動中
  prompt: false,      // 選択肢プロンプト表示中
  fx: null,           // 戦闘エフェクト
  animating: false,   // 戦闘アニメーション中
  enemyPos: {},       // 敵の画面座標 (エフェクト配置用)
  partyFx: null,      // 味方カードの被弾/回復フラッシュ (Map)
  wallFlash: null,    // ブロックされた壁の赤フラッシュ { x, y, dir, t0 }
  statusOpen: false,  // ステータス画面表示中
  statusIdx: 0,       // ステータス画面で選択中のメンバー
  statusTab: "main",  // ステータス画面のタブ "main"(統合) | "soul"
  eliteFloor: false,  // 現在のフロアが強敵階か (3F以降、10%の確率で発生)
  specialFloor: null, // 現在のフロアの特別階id (SPECIAL_FLOORS 参照。2F以降に低確率で発生)
  mutator: null,      // 今回の潜入に適用中の「迷宮の異変」id (MUTATORS 参照。潜入時に任意で受諾)
  bossDown: false,    // この潜入で迷宮の主を討ったか (討つと帰還制限が解ける)
  portalFound: false, // この階で帰還魔法陣を発見したか (発見後はいつでも街へ戻れる)
  // 無限迷宮「奈落」: 潜入中のランの状態 (null = 通常迷宮)。abyss.js 参照
  abyss: null,        // { depth, mods:[id], weekly, seed, mutations:[id], guardFloor, started }
  abyssRec: null,     // 記録 (端末ローカル): { bestDepth, bestScore, runs, weekly:{[seed]:depth}, recent:[] }
};

const rand = (n) => Math.floor(Math.random() * n);

// ハプティクス (対応端末のみ)。パターン: 数値 or [待ち,振動,待ち,振動...]
function buzz(p) {
  if (!PREFS.vibrate) return;
  if (navigator.vibrate) { try { navigator.vibrate(p); } catch {} }
}

// 端末ごとの好み (音量・振動)。セーブデータとは別に保存し、「はじめから」でも消えない
const PREFS_KEY = "dos-prefs";
const PREFS = (() => {
  const d = { bgm: 0.8, sfx: 1, vibrate: true, classicBattle: false, fastWalk: true };
  try { return { ...d, ...(JSON.parse(localStorage.getItem(PREFS_KEY)) || {}) }; } catch { return d; }
})();
function savePrefs() { try { localStorage.setItem(PREFS_KEY, JSON.stringify(PREFS)); } catch {} }
// 迷宮内の移動 (めくり・1歩のスライド・自動歩行の間) の時間。ms は倍速の値、設定「移動 倍速」を切ると倍の時間 (速さ 1/2)
const walkMs = (ms) => (PREFS.fastWalk ? ms : ms * 2);
setVolumes(PREFS.bgm, PREFS.sfx);

// ---- 潜入中の戦利品トラッキング (全滅ペナルティ / Red Soul帰還で使う) ----
const inDungeon = () => G.state === "board" || G.state === "combat" || G.state === "over";
// パーティ内で最も強い装備効果(eff)値を返す (LR装飾品の goldUp/soulUp 等。重複装備は加算せず最大値)
function partyEffMax(key) { let s = 0; if (G.party) for (const m of G.party) { if (m && m.eff && m.eff[key] > s) s = m.eff[key]; } return s; }
// 迷宮で得るゴールド (戦闘勝利・宝箱・床イベント) の共通入口。全体の獲得量を半分に抑える。
// 黄金の指輪 (LR装飾品) の goldUp があれば獲得量を割合で増やす。
// 戦闘中に「盗む」で得た金を持ち帰る (勝っても逃げても。そのままの額)
function takeStolenGold(b) {
  const g = Math.max(0, Math.round((b && b.bonusGold) || 0));
  if (!g) return 0;
  b.bonusGold = 0;
  G.gold += g; if (G.run && inDungeon()) G.run.gold += g;
  return g;
}
function runGainGold(g) { g = Math.round(g * 0.5 * sfNum("goldMul", 1) * mutNum("goldMul", 1) * (1 + partyEffMax("goldUp"))); G.gold += g; if (G.run && inDungeon()) G.run.gold += g; return g; }
// 魂導の護符 (LR装飾品) の soulUp があれば ✦Soul の獲得量を割合で増やす。
// 極の出来事で授かった恒久の恵み (G.events.flags) の効き目。授かっていなければ dflt
function evBoon(k, field, dflt) { return G.events && G.events.flags && G.events.flags[k] ? EV_BOONS[k][field] : dflt; }
function runGainSoulPts(s) { s = Math.round(s * sfNum("soulMul", 1) * mutNum("soulMul", 1) * (1 + partyEffMax("soulUp") + evBoon("will", "soulMul", 0))); G.soulPts += s; if (G.run && inDungeon()) G.run.soulPts += s; return s; }
function runGainItem(owner, item) {
  if (item) item.isNew = true; // NEW 印 (品シートで見れば消える。セーブには追加の印として残る)
  owner.items.push(item);
  if (G.run && inDungeon()) G.run.items.push({ owner, item });
  if (item && item.rar === "lr") { if (!G.lrOwned) G.lrOwned = {}; G.lrOwned[item.id] = true; } // LRは1点もの
}
// 魂の吸収を記録 (全滅没収で巻き戻すため {doll, clsKey} で覚える)
// 魂の入手を記録 (全滅没収で巻き戻すため)。kind: "awaken"(共有countへ) | "bag"(未覚醒)
function runTrackSoul(clsKey, kind) { if (G.run && inDungeon()) G.run.souls.push({ clsKey, kind }); }
// 今回の潜入の記録 (D1): 戦利品に加え、倒した数・魂の成長・持ちきれず置いてきた品・到達階を数える。
// 旧セーブの G.run はこれらを持たないので、読む側は必ず || の既定値で受ける
function newRun() {
  return { gold: 0, soulPts: 0, items: [], souls: [], kills: 0, levels: [], lost: [], floors: 1, embers: 0, at: Date.now() };
}
function runCount(key, n = 1) { if (G.run && inDungeon()) G.run[key] = (G.run[key] || 0) + n; }
function runLost(name) { if (G.run && inDungeon() && name) (G.run.lost || (G.run.lost = [])).push(name); }
// 魂の成長 (Lv a→b) を人業ごとに1行へまとめる
function runLevel(d, from, to) {
  if (!G.run || !d) return;
  const L = G.run.levels || (G.run.levels = []);
  const ex = L.find((x) => x.uid === d.uid);
  if (ex) ex.to = to; else L.push({ uid: d.uid, name: d.name, from, to });
}
// 帰還の報告 (D2): 素のデータだけの要約 (名前・レア度・数・砕けた人業)。outcome: return|clear|wipe|saved
function runSummary(r, outcome, extra = {}) {
  r = r || {};
  const dn = curDungeon();
  return {
    v: 1, at: Date.now(), outcome,
    dungeon: { idx: G.dungeonIdx, name: abyssActive() ? "無限迷宮 奈落" : (dn ? dn.name : ""), layer: dn ? dn.layer : 1 },
    abyss: G.abyss ? G.abyss.depth : null,
    floor: G.floor, floors: Math.max(r.floors || 1, G.floor || 1),
    gold: r.gold || 0, soulPts: r.soulPts || 0, kills: r.kills || 0, embers: r.embers || 0,
    items: (r.items || []).map(({ owner, item }) => ({ id: item && item.id, name: itemName(item), rar: rarityKey(item), unid: !!(item && item.unidentified), owner: owner ? owner.name : "" })),
    souls: (r.souls || []).map((s) => { const c = SOUL_CLASSES[s.clsKey]; return { clsKey: s.clsKey, label: c ? c.label : s.clsKey, rarity: c ? c.rarity : "common" }; }),
    levels: (r.levels || []).map((x) => ({ name: x.name, from: x.from, to: x.to })),
    lost: [...(r.lost || [])],
    dead: G.party.filter((d) => d && d.isDoll && !d.alive).map((d) => ({ uid: d.uid, name: d.name })),
    forfeited: null,
    dismissed: false,
    ...extra,
  };
}

// ===== 所持魂 (個別インスタンス) のヘルパー =====
// 魂を1体、所持魂一覧 (G.souls 配列) に加える
function addSoulInstance(clsKey, count = 1, level = 1) {
  const s = makeSoulInstance(clsKey, count, level);
  G.souls.push(s);
  return s;
}
// 全人業を再計算する (魂の Lv/ランク/装備変化を反映)
// levelUp = true: 魂のレベルアップ後の再計算。最大HP/MPが増えた分を、いまのHP/MPにも足す
// (倒れている人業はそのまま)
function recalcAllDolls({ levelUp = false } = {}) {
  for (const d of allDolls()) {
    const mh = d.maxhp || 0, mm = d.maxmp || 0;
    recalcDoll(d);
    if (levelUp && d.alive !== false && d.hp > 0) {
      if (d.maxhp > mh) d.hp += d.maxhp - mh;
      if (d.maxmp > mm) d.mp += d.maxmp - mm;
    }
    d.hp = Math.min(d.hp, d.maxhp); d.mp = Math.min(d.mp, d.maxmp);
  }
}
// その魂 (uid) を誰かが宿しているか
function soulWorn(uid) {
  for (const d of allDolls()) {
    if (d.primary === uid) return true;
    for (const s of (d.subs || [])) if (s && s.uid === uid) return true;
  }
  return false;
}
// 魂を宿している人業からその魂を外す (融合で消費した/失われた時)
function unequipSoulEverywhere(uid) {
  for (const d of allDolls()) {
    let touched = false;
    if (d.primary === uid) { d.primary = null; touched = true; }
    const before = (d.subs || []).length;
    d.subs = (d.subs || []).filter((s) => s && s.uid !== uid);
    if (d.subs.length !== before) touched = true;
    if (touched) { recalcDoll(d); d.hp = Math.min(d.hp, d.maxhp); d.mp = Math.min(d.mp, d.maxmp); }
  }
}

// 全滅して Red Soul を使わなかった場合: 今回得たゴールド・アイテム・魂を失う。
// ただし蓄積した ✦Soul (soulPts) は残る (経験値の役割を担うため没収しない)。
function forfeitRun() {
  const r = G.run;
  if (!r) return;
  if (r.secured) { G.run = null; return; } // 主を討った時点で戦利品は確定済み (失うものはない)
  G.gold = Math.max(0, G.gold - r.gold);
  // 入手したアイテム/装備を現在の持ち主から除去 (潜入中に「渡す」/他メンバーが
  // 装備した品も追跡し、全員の所持品・装備を走査して取り上げる)
  for (const { item } of r.items) {
    let gone = false;
    for (const d of allDolls()) {
      const bi = d.items.indexOf(item);
      if (bi >= 0) { d.items.splice(bi, 1); gone = true; break; }
      for (const slot of SLOTS) {
        if (d.equip[slot] === item) { d.equip[slot] = null; recalcDoll(d); gone = true; break; }
      }
      if (gone) break;
    }
  }
  // 入手した魂を巻き戻す (今回拾った魂インスタンスを職業ごとに1体ずつ取り消す)
  for (const rec of r.souls) {
    const k = rec && rec.clsKey;
    if (!k) continue;
    // ロックしていない魂から先に取り消す (ロックした魂はできるだけ残す)
    let gone = false;
    for (const pass of [false, true]) {
      for (let i = G.souls.length - 1; i >= 0 && !gone; i--) {
        const s = G.souls[i];
        if (s.clsKey === k && !soulWorn(s.uid) && !!s.locked === pass) { G.souls.splice(i, 1); gone = true; }
      }
      if (gone) break;
    }
  }
  recalcAllDolls();
  G.run = null;
}

// 砕けた人業: 死亡を戦績に記録する (修復は人業の館で金貨を払う)
function imprintFallen() {
  for (const d of G.party) {
    if (d.isDoll && !d.alive && !d._dead) { G.stats.deaths++; d._dead = true; d.diedFloor = G.floor; }
  }
  setReviveTimers();
}

// 画面シェイク (被弾・クリティカルなどの衝撃表現)
function shakeScreen(strong = false) {
  view.classList.remove("shake", "shake-strong");
  void view.offsetWidth; // リフロー挟んでアニメ再発火
  view.classList.add(strong ? "shake-strong" : "shake");
  setTimeout(() => view.classList.remove("shake", "shake-strong"), 380);
}

// 記録の履歴 (記録欄をタップして読む全文)。欄に残す行 (80) より長く覚えておく
const LOG_HISTORY_MAX = 300;
const _logHistory = [];
function logHistory() { return _logHistory.map((x) => ({ text: x.n > 1 ? `${x.msg} ×${x.n}` : x.msg, cls: "l-" + x.cls })); }
// 戦闘中の記録は、まだ名前を知らない敵 (討伐数0) の名を「？？？」に伏せる。
// 個体名 (スライムA) を先に、種の名 (スライム) を後に置き換える。明かされた別の敵の名に含まれる種名は触らない
// (戦闘の組み立て中 = Battle を作る前の名乗りや開幕の一撃は _maskEnemies を見る)
let _maskEnemies = null;
function maskUnknownEnemies(msg) {
  if (G.state !== "combat" || typeof msg !== "string") return msg;
  const list = _maskEnemies || (G.battle && G.battle.enemies);
  if (!list || !list.length) return msg;
  const known = [], pairs = [];
  for (const e of list) {
    if (enemyReveal(e).name) { known.push(e.name); continue; }
    pairs.push([e.name, enemyLabel(e)]);
    if (e.mon && e.mon.name) pairs.push([e.mon.name, "？？？"]);
  }
  if (!pairs.length) return msg;
  pairs.sort((x, y) => y[0].length - x[0].length);
  for (const [from, to] of pairs) {
    if (!from || from === to || known.some((n) => n.includes(from))) continue;
    msg = msg.split(from).join(to);
  }
  return msg;
}
function log(msg, cls = "sys") {
  msg = maskUnknownEnemies(msg);
  // 直前と同じ文 (壁にぶつかり続けた時など) は行を増やさず「×N」で数える
  const lastH = _logHistory[_logHistory.length - 1];
  if (lastH && lastH.msg === msg && lastH.cls === cls) lastH.n++;
  else {
    _logHistory.push({ msg, cls, n: 1 });
    if (_logHistory.length > LOG_HISTORY_MAX) _logHistory.splice(0, _logHistory.length - LOG_HISTORY_MAX);
  }
  const last = logEl.lastElementChild;
  if (last && last._msg === msg && last.className === "l-" + cls) {
    last._n = (last._n || 1) + 1;
    last.textContent = `${msg} ×${last._n}`;
    _logPinned = true;
    scrollLogBottom();
    return;
  }
  const div = document.createElement("div");
  div.className = "l-" + cls;
  div.textContent = msg;
  div._msg = msg;
  logEl.appendChild(div);
  while (logEl.children.length > 80) logEl.removeChild(logEl.firstChild);
  // 新しいメッセージが来たら最下部へ貼り付け直す。iOS Safari 等では appendChild 直後の
  // 再レイアウトが間に合わず最新メッセージまでスクロールしきれないことがあるため、次フレームでも実行する。
  _logPinned = true;
  scrollLogBottom();
  requestAnimationFrame(scrollLogBottom);
}

// 現在の迷宮設定
function curDungeon() { return DUNGEONS[G.dungeonIdx] || DUNGEONS[0]; }

// ===== 公開範囲 (作り込み済みの層だけを遊べるようにする) =====
// 現在は第1層 (迷宮1-5)・第2層 (迷宮6-10)・第3層 (迷宮11-15) まで公開。第4層以降は「準備中」として閉じ、刷新が済んだ層から引き上げる。
// 既存セーブで先へ進んでいる場合も勅命の進行 (G.msq) は書き換えず、表示と潜入だけを止める。
// 引き上げる時は CONTENT_LIMIT を上げ、story.js の SEAL_LINES (新しい果ての層) / UNSEAL_LINES (新しく開く層) を足す。
// 封印の告知を受けていたセーブは読み込み時に「次の勅命待ち」へ戻り、王が封の解けたことを告げてから拝命する
const CONTENT_LIMIT = 15;
const CONTENT_NEXT_LAYER = Math.floor(CONTENT_LIMIT / 5) + 1; // 準備中の層番号
const contentSealed = () => !!G.msq && (G.msq.state === "sealed" || G.msq.n > CONTENT_LIMIT);

// ===== 無限迷宮「奈落」 =====
// 奈落は実在の100迷宮を「素体」として循環参照し (themed なロスターを再利用)、
// 深度に応じて enemyScale / lootLv / rank を連続的に底上げした合成 cfg を返す。
const abyssActive = () => !!(G.abyss && G.abyss.started);
// 深度 d (1..∞) → 素体にする迷宮番号 (1-100)。深いほど深層の迷宮を引き、100超で巡回する
function abyssBaseN(d) {
  const n = Math.min(100, 10 + Math.floor((d - 1) * 1.6)); // d1≒D10 → d56でD100到達
  return ((n - 1) % 100) + 1;
}
function abyssCfg() {
  const d = G.abyss.depth;
  const base = DUNGEONS[abyssBaseN(d) - 1];
  const rank = Math.min(10, Math.ceil(d / 4)); // d40 で rank10 に達し、以降は据え置き (火力は enemyScale が伸ばす)
  return {
    ...base,
    id: base.id,                 // 層テーマ・dungeonNumber が参照するので素体のidを保つ
    name: `無限迷宮 奈落 B${d}F`,
    short: `奈落${d}`,
    rank,
    floors: 1e9,                 // 最深部で自動踏破しない (askDescend が奈落専用に分岐する)
    boss: null,                  // 門番は askDescend 側で生成 (踏破=帰還にしない)
    // 浅階/深階を区別せず両方のロスターを混ぜる (floors が巨大なので board.js は常に pool を引く)
    pool: [...new Set([...(base.pool || []), ...(base.deepPool || [])])],
    deepPool: [...new Set([...(base.deepPool || []), ...(base.pool || [])])],
    enemyScale: Math.round((0.85 + (d - 1) * 0.075) * 100) / 100, // 連続的・青天井の難易度の壁
    trapRate: Math.min(0.28, 0.06 + d * 0.0015 + (mutNum("poisonUp", false) ? 0.05 : 0)),
    poisonRate: Math.min(0.14, 0.03 + d * 0.0008 + (mutNum("poisonUp", false) ? 0.05 : 0)),
    warmChance: 0.45,
    soulLevelBonus: Math.floor((Math.sqrt(d) - 1) * 1.8),
    rankBonus: Math.round(1.25 * Math.log2(1 + d / 2) * 100) / 100,
    lootLv: [Math.min(200, Math.round(18 + d * 1.8)), Math.min(200, Math.round(18 + d * 2.5))],
    _abyss: true,
  };
}
function activeCfg() { return abyssActive() ? abyssCfg() : curDungeon(); }

// 変異の抽選乱数。週替りは (シード×深度×既得数) で決定的にし、全員同じ変異列になる
function abyssRng() {
  if (!G.abyss || !G.abyss.weekly) return Math.random;
  const s = (G.abyss.seed ^ Math.imul(G.abyss.depth, 2654435761) ^ Math.imul(G.abyss.mutations.length + 1, 40503)) >>> 0;
  return mulberry32(s);
}
// 新たな変異を1つ宿す。返り値は変異定義 (告知用)。
function addAbyssMutation() {
  if (!G.abyss) return null;
  const id = rollAbyssMutation(abyssRng(), G.abyss.mutations);
  if (!id) return null;
  G.abyss.mutations.push(id);
  return ABYSS_MUT_MAP[id];
}
// 変異の告知ポップアップ (呪い=赤系/恵み=金水系)。閉じると探索へ戻る
function showAbyssMutationPopup(m) {
  if (!m) { G.prompt = false; return; }
  SFX.trap(); buzz([0, 30, 40, 30]);
  showEvent({
    sprite: ICONS.portal,
    banner: m.kind === "boon" ? "✦ 奈落の恵み ✦" : "⚠ 奈落の変異 ⚠",
    title: `${m.sym}「${m.name}」`,
    accent: m.accent,
    sparkle: m.kind === "boon",
    lines: [m.kind === "boon" ? "深淵がわずかな恵みを差し出した。" : "深淵が牙を剥く。潜るほど、迷宮は手強くなる。", m.desc],
    btnLabel: "受け入れる",
    onClose: () => {},
  });
}

// 奈落の門番 (10階ごと)。層ボスをローテーションで使い、深度相応に強化する
function abyssGuardKey(depth) {
  const i = Math.floor(depth / ABYSS_BOSS_EVERY) - 1; // 10F→0, 20F→1, …
  return LAYER_BOSS[((i % LAYER_BOSS.length) + LAYER_BOSS.length) % LAYER_BOSS.length];
}
function abyssGuardRank(depth) { return Math.min(10, 3 + Math.floor(depth / ABYSS_BOSS_EVERY)); }
// この階が門番階か (撃破済みでなければ true)
function abyssBossPending() {
  return abyssActive() && G.floor % ABYSS_BOSS_EVERY === 0 && G.abyss.guardFloor !== G.floor;
}

// ===== 記録 (端末ローカル) =====
function abyssRecords() {
  if (!G.abyssRec) G.abyssRec = { bestDepth: 0, bestScore: 0, runs: 0, weekly: {}, recent: [] };
  return G.abyssRec;
}
// ランの確定 (撤退 or 全滅 or あきらめ)。reason: "return"|"wipe"
function finalizeAbyss(reason) {
  if (!G.abyss) return;
  const rec = abyssRecords();
  const depth = G.abyss.depth;
  const score = abyssScore(depth, G.abyss.mods);
  rec.runs++;
  rec.bestDepth = Math.max(rec.bestDepth, depth);
  rec.bestScore = Math.max(rec.bestScore, score);
  if (G.abyss.weekly) rec.weekly[G.abyss.seed] = Math.max(rec.weekly[G.abyss.seed] || 0, depth);
  rec.recent.unshift({ depth, score, mods: [...G.abyss.mods], weekly: G.abyss.weekly, reason, at: Date.now() });
  rec.recent = rec.recent.slice(0, 8);
  G.stats.abyssBest = Math.max(G.stats.abyssBest || 0, depth);
  G.abyss = null;
}

// 奈落の門番に挑む (10階ごと)。撃破は踏破=帰還にせず、先へ進めるようにする
function fightAbyssGuard(cell) {
  const depth = G.abyss.depth;
  const key = abyssGuardKey(depth);
  log("奈落の門番が立ちはだかる！", "dmg");
  startBattle(spawnBossEnemies(key, enemyScale() * 1.05, abyssGuardRank(depth)), cell);
}

// ===== 迷宮テーマ (20層) =====
// 100迷宮 = 20層 × 5迷宮。層ごとにカード裏面の意匠・床の色味・探索BGMを束ねる。
// bgm は当面は既存トラックを流用 (専用曲は層ごとのPRで差し替える)。
const LAYER_VISUALS = [
  { name: "墓地",       sym: "†", accent: "#c7bfa6", bgm: "layer1", back: drawBackGraveyard, floorBase: "#14130f", floorTiles: ["#1b1812", "#17150f", "#13110c"], glow: "rgba(232,210,150,0.06)" }, // 1
  { name: "地下水路",   sym: "≈", accent: "#5fa0b8", bgm: "layer2", back: drawBackWaterway, floorBase: "#0d1417", floorTiles: ["#121d22", "#0f181c", "#0c1216"], glow: "rgba(110,200,220,0.06)" }, // 2
  { name: "廃坑",       sym: "⛏", accent: "#c9923f", bgm: "layer3", back: drawBackMine, floorBase: "#15110c", floorTiles: ["#1d1610", "#18130d", "#14100a"], glow: "rgba(222,150,70,0.06)" },  // 3
  { name: "捨て砦",     sym: "⚔", accent: "#9aa0ac", bgm: "layer4", back: drawBackFort, floorBase: "#121316", floorTiles: ["#191b20", "#15171b", "#111316"], glow: "rgba(200,210,230,0.05)" }, // 4
  { name: "霧の森",     sym: "♣", accent: "#7faa5a", bgm: "layer5", back: drawBackForest, floorBase: "#0f140d", floorTiles: ["#161d12", "#12180e", "#0e130a"], glow: "rgba(150,200,120,0.06)" }, // 5
  { name: "沈没神殿",   sym: "⛪", accent: "#6fb0c8", bgm: "layer6", back: drawBackTemple, floorBase: "#0d1316", floorTiles: ["#121c20", "#0f171b", "#0c1215"], glow: "rgba(120,200,225,0.06)" }, // 6
  { name: "灼熱の洞",   sym: "▲", accent: "#d4682e", bgm: "layer7", back: drawBackLava, floorBase: "#190f0a", floorTiles: ["#22130c", "#1c0f0a", "#160c07"], glow: "rgba(255,130,50,0.07)" },  // 7
  { name: "氷結回廊",   sym: "❄", accent: "#9fd0e6", bgm: "layer8", back: drawBackIce, floorBase: "#0e1417", floorTiles: ["#152027", "#111a20", "#0d1418"], glow: "rgba(170,220,245,0.06)" }, // 8
  { name: "毒沼",       sym: "⚗", accent: "#a7b84a", bgm: "layer9", back: drawBackSwamp, floorBase: "#12140d", floorTiles: ["#1a1c11", "#16180d", "#12140a"], glow: "rgba(170,195,75,0.06)" },  // 9
  { name: "嵐の尖塔",   sym: "⚡", accent: "#b6a4e0", bgm: "layer10", back: drawBackSpire, floorBase: "#10101a", floorTiles: ["#181826", "#14141f", "#101019"], glow: "rgba(180,160,235,0.06)" }, // 10
  { name: "闘技場跡",   sym: "✶", accent: "#c9a05a", bgm: "layer11", back: drawBackArena, floorBase: "#16130d", floorTiles: ["#1f1a11", "#1a160d", "#15110a"], glow: "rgba(225,180,90,0.05)" },  // 11
  { name: "地底大空洞", sym: "◆", accent: "#8a7a5a", bgm: "layer12", back: drawBackCavern, floorBase: "#13110d", floorTiles: ["#1b1813", "#16140f", "#12100b"], glow: "rgba(200,180,140,0.05)" }, // 12
  { name: "魔導書庫",   sym: "✪", accent: "#9d7ad0", bgm: "layer13", back: drawBackLibrary, floorBase: "#100e17", floorTiles: ["#181323", "#13101c", "#100d16"], glow: "rgba(160,120,225,0.06)" }, // 13
  { name: "屍蝋の回廊", sym: "‡", accent: "#b8a878", bgm: "layer14", back: drawBackOssuary, floorBase: "#14120d", floorTiles: ["#1c1912", "#17140e", "#13100a"], glow: "rgba(210,190,130,0.05)" }, // 14
  { name: "溶鉄炉",     sym: "♨", accent: "#e07838", bgm: "layer15", back: drawBackForge, floorBase: "#190e08", floorTiles: ["#23120a", "#1c0f08", "#160b06"], glow: "rgba(255,140,55,0.07)" },  // 15
  { name: "深淵の聖堂", sym: "✝", accent: "#e0d28a", bgm: "layer16", back: drawBackCathedral, floorBase: "#14130c", floorTiles: ["#1d1b10", "#18160d", "#13110a"], glow: "rgba(240,225,150,0.06)" }, // 16
  { name: "凍てつく王墓", sym: "❅", accent: "#a8c8e0", bgm: "layer17", back: drawBackTomb, floorBase: "#0d1217", floorTiles: ["#141e26", "#10181f", "#0c1217"], glow: "rgba(180,215,245,0.06)" }, // 17
  { name: "冥府の門",   sym: "☖", accent: "#8c6aa8", bgm: "layer18", back: drawBackHadesGate, floorBase: "#100d14", floorTiles: ["#17121e", "#130f19", "#0f0c14"], glow: "rgba(150,110,190,0.06)" }, // 18
  { name: "竜の巣",     sym: "♦", accent: "#c8503a", bgm: "layer19", back: drawBackDragonNest, floorBase: "#170d0a", floorTiles: ["#21120c", "#1b0f0a", "#150b07"], glow: "rgba(235,90,60,0.06)" },   // 19
  { name: "終焉の玄室", sym: "✺", accent: "#b08ac0", bgm: "layer20", back: drawBackThrone, floorBase: "#0f0c13", floorTiles: ["#161019", "#120d15", "#0e0b11"], glow: "rgba(180,130,210,0.06)" }, // 20
];
// 迷宮番号 (1-100)。cfg.id = "g001" から取り出す
function dungeonNumber(cfg) { return cfg && cfg.id ? parseInt(cfg.id.slice(1), 10) : (G.dungeonIdx + 1); }
// 現在の迷宮の層テーマ (全100迷宮 = 20層)
function dungeonTheme(cfg = activeCfg()) {
  const L = cfg && cfg.layer ? cfg.layer : layerOf(dungeonNumber(cfg));
  return LAYER_VISUALS[Math.min(20, Math.max(1, L)) - 1];
}

// ===== 特別階 =====
// 階段を降りた時、一定確率で「特別な効果を持つ階」が出現する (1Fと強敵階には出ない)。
// 効果はその階に滞在する間だけ有効。board(b) は newFloor 直後の盤面加工フック。
const SPECIAL_FLOORS = [
  { id: "mighty", name: "強大な気配", icon: "corpseWarm", accent: "#ffcf4a", sym: "✟", minFloor: 3, rate: 0.01,
    lines: ["この階のどこかに「偉大なる死体」が眠っている。", "並の魂ではない。必ずや希少な魂が宿っているだろう。"],
    board: (b) => sfPlace(b, 1, (c) => { c.type = "corpse"; c.cleared = false; c.corpseWarm = true; c.corpseGreat = true; c.corpseClass = rollGreatCorpseClass(); }) },
  { id: "bounty", name: "豊穣の間", icon: "gold", accent: "#ffd84a", sym: "❂", minFloor: 2, rate: 0.05, goldMul: 2,
    lines: ["黄金の気が満ちている。", "この階で得るゴールドが 2倍 になる。"] },
  { id: "soulTide", name: "魂の奔流", icon: "wisp", accent: "#7fd0ff", sym: "✧", minFloor: 2, rate: 0.03, soulMul: 1.5,
    lines: ["死者たちの声がざわめいている。", "この階で得る Soul が 1.5倍 になる。"] },
  { id: "silence", name: "静寂の階", icon: "trap", accent: "#9be88a", sym: "∅", minFloor: 2, rate: 0.02, noTrap: true,
    lines: ["仕掛けという仕掛けが朽ち果てている。", "この階に罠と毒の床は存在しない。"],
    board: (b) => sfEachCell(b, (c) => { if (c.type === "trap" || c.type === "poison") { c.type = "empty"; c.cleared = true; } }) },
  { id: "moonlight", name: "月明かりの階", icon: "corpseWarm", accent: "#aef0ff", sym: "☾", minFloor: 2, rate: 0.02,
    lines: ["蒼い光が差し込み、死者の温もりが消えない。", "この階の死体はすべて「あたたかい死体」だ。"],
    board: (b) => {
      let n = 0;
      sfEachCell(b, (c) => { if (c.type === "corpse" && !c.cleared) { c.corpseWarm = true; n++; } });
      // 死体が1つも無い階でも、必ず1つは「あたたかい死体」を置く (行き止まりを優先)
      if (!n) {
        const dead = [];
        sfEachCell(b, (c) => { if (c.type === "empty" && sfOpenCount(c) === 1) dead.push(c); });
        const put = (c) => { c.type = "corpse"; c.cleared = false; c.corpseWarm = true; c.corpseClass = rollJobClass(); };
        if (dead.length) put(dead[rand(dead.length)]);
        else sfPlace(b, 1, put);
      }
    } },
  { id: "vault", name: "黄金の蔵", icon: "chest", accent: "#e8c47a", sym: "▣", minFloor: 2, rate: 0.02,
    lines: ["ここは何者かの貯蔵庫だったようだ。", "宝箱が多く眠っている。"],
    board: (b) => sfPlace(b, 3, (c) => { c.type = "chest"; c.cleared = false; }) },
  { id: "springs", name: "霊泉の階", icon: "fountain", accent: "#5fb8d6", sym: "♨", minFloor: 2, rate: 0.02,
    lines: ["岩の隙間から清らかな水音が聞こえる。", "癒しの泉が複数湧いている。"],
    board: (b) => sfPlace(b, 2, (c) => { c.type = "fountain"; c.cleared = false; c.fountainKind = "pure"; }) },
  { id: "clairvoyance", name: "千里眼の刻", icon: "start", accent: "#c08aff", sym: "◉", minFloor: 2, rate: 0.015,
    lines: ["不思議な力が視界を開いていく。", "この階のすべてのカードが最初から見えている。"],
    board: (b) => sfEachCell(b, (c) => { c.revealed = true; }) },
  { id: "horde", name: "餓えた群れ", icon: "poison", accent: "#d4504e", sym: "Ψ", minFloor: 2, rate: 0.02, hordeReward: true,
    lines: ["無数の足音と唸り声…敵が異常に多い (出現マス +4)。", "この階の敵をすべて葬れば、迷宮の深さに応じた魂と財が手に入る。"],
    board: (b) => sfPlace(b, 4, (c) => { c.type = "monster"; c.monsterKey = pickFrom(sfMonsterPool()); c.cleared = false; }) },
  { id: "thiefInsight", name: "盗賊の洞察", icon: "chest", accent: "#6fae46", sym: "♠", minFloor: 2, rate: 0.02, sureChest: true, sureDisarm: true,
    lines: ["盗賊の勘が冴え渡る。敵は必ず宝を遺し、罠はことごとく見抜ける。", "敵が100%宝箱を落とし、宝箱の罠解除率が100%になる。"] },
  { id: "miasma", name: "瘴気の階", icon: "poison", accent: "#8a2be2", sym: "☣", minFloor: 2, rate: 0.02, enemyMul: 1.25, soulMul: 2,
    lines: ["淀んだ瘴気が敵を昂らせている。敵が強い。", "だが得られる Soul は 2倍 になる。"] },
  { id: "caravan", name: "商隊の遺品", icon: "chest", accent: "#e0a060", sym: "❖", minFloor: 2, rate: 0.02, chestRankUp: 1,
    lines: ["全滅した商隊の荷が散らばっている。", "この階には宝箱が必ず2つ以上あり、いずれも1ランク上等だ。"],
    board: (b) => {
      // 既存の宝箱が2つ未満なら、合計2つになるよう追加する
      let chests = 0;
      sfEachCell(b, (c) => { if (c.type === "chest" && !c.cleared) chests++; });
      if (chests < 2) sfPlace(b, 2 - chests, (c) => { c.type = "chest"; c.cleared = false; });
    } },
  { id: "necropolis", name: "屍人の巣", icon: "corpse", accent: "#8c866f", sym: "✝", minFloor: 3, rate: 0.015,
    lines: ["おびただしい数の死体が横たわっている。", "魂を回収する好機だが、起き上がる者もいるだろう。"],
    board: (b) => sfPlace(b, 4, (c) => { c.type = "corpse"; c.cleared = false; c.corpseClass = rollJobClass(); c.corpseWarm = Math.random() < 0.5; }) },
  { id: "marsh", name: "毒の沼", icon: "poison", accent: "#5a8a2a", sym: "≈", minFloor: 2, rate: 0.02, goldMul: 1.5,
    lines: ["床のいたるところから毒がにじみ出している。", "足場は危険だが、沼には金品が沈んでいる。ゴールド 1.5倍。"],
    board: (b) => sfEachCell(b, (c) => { if (c.type === "empty" && sfOpenCount(c) >= 2 && Math.random() < 0.30) { c.type = "poison"; c.cleared = false; } }) },
  { id: "tailwind", name: "追い風の階", icon: "stairs", accent: "#7fe0a8", sym: "≫", minFloor: 2, rate: 0.02, preempt100: true, noAmbush: true,
    lines: ["不思議と体が軽く、敵の動きがよく見える。", "常に先手を取り、奇襲を受けない。"] },
  { id: "elemSurge", name: "属性の奔流", icon: "wisp", accent: "#ff9a4a", sym: "✺", minFloor: 2, rate: 0.02, elemAll: true, cond: (cfg) => !!cfg.element,
    lines: ["迷宮の属性が荒れ狂っている。", "この階の敵はすべて迷宮の属性を帯びる。属性装備が鍵だ。"] },
  { id: "mimicNest", name: "ミミックの巣", icon: "chest", accent: "#e07840", sym: "◈", minFloor: 3, rate: 0.015, mimicRate: 0.50,
    lines: ["不自然なほど宝箱が多い…罠の匂いがする。", "宝箱の半分はミミックだ。だが倒せば上質な宝箱を残す。"],
    board: (b) => sfPlace(b, 3, (c) => { c.type = "chest"; c.cleared = false; }) },
  { id: "healing", name: "癒しの霊気", icon: "fountain", accent: "#8af0c0", sym: "✚", minFloor: 2, rate: 0.02, victoryHeal: 0.10,
    lines: ["澄んだ霊気が満ち、傷を癒してくれる。", "戦闘に勝利するたび、パーティ全体のHPとMPが10%回復する。"] },
  { id: "legend", name: "伝説の眠る階", icon: "chest", accent: "#ffe080", sym: "★", minFloor: 4, rate: 0.01,
    lines: ["遥か昔の英雄の遺品が、この階のどこかに眠っている。", "ひとつの宝箱にだけ、格別の装備が入っている。"],
    board: (b) => {
      // 既存の宝箱から1つ選んで「伝説の宝箱」(+40レベル) にする。なければ1つ追加する
      const chests = [];
      sfEachCell(b, (c) => { if (c.type === "chest" && !c.cleared) chests.push(c); });
      if (chests.length) pickFrom(chests).lootBonus = 40;
      else sfPlace(b, 1, (c) => { c.type = "chest"; c.cleared = false; c.lootBonus = 40; });
    } },
];

// 現在の階の特別階定義 (なければ null)
function specialDef() { return G.specialFloor ? SPECIAL_FLOORS.find((s) => s.id === G.specialFloor) || null : null; }
// 特別階の効果値の取り出し (効果なしなら既定値)
function sfNum(key, dflt) { const sp = specialDef(); return sp && sp[key] != null ? sp[key] : dflt; }

// 餓えた群れ: この階の敵 (モンスターマス) をすべて倒したか。未受領のときだけ true
function hordeRewardPending() {
  const sp = specialDef();
  if (!sp || !sp.hordeReward || !G.board || G.board._hordeRewarded) return false;
  let any = false, allCleared = true;
  sfEachCell(G.board, (c) => { if (c.type === "monster") { any = true; if (!c.cleared) allCleared = false; } });
  return any && allCleared;
}
// 殲滅報酬: 迷宮の深さ (n) に応じて Soul n×50・ゴールド n×100 を授ける
function grantHordeReward() {
  G.board._hordeRewarded = true;
  const n = dungeonNumber(activeCfg());
  const soul = n * 50, gold = n * 100;
  G.gold += gold; G.soulPts += soul;
  if (G.run && inDungeon()) { G.run.gold += gold; G.run.soulPts += soul; }
  updateTopbar();
  log(`この辺りの敵をすべて葬った！ 💰${gold} と ✦${soul} Soul を得た。`, "win");
  SFX.victory(); flashScreen("#d4504e");
  showEvent({
    banner: "✦ 殲滅 ✦", title: "この辺りの敵をすべて葬った",
    accent: "#d4504e", sprite: ICONS.poison, sparkle: true,
    lines: ["群れを狩り尽くした褒美だ。", `獲得 ゴールド 💰${gold}`, `回収した Soul ✦${soul}`],
    onClose: () => renderBoard(),
  });
}

// ===== 迷宮の異変 (潜入単位のミューテーター) =====
// 潜入時に一定確率で迷宮全体に「異変」が起きている。受け入れて潜るか、避けて
// 普通に潜るかを選べる (リスクと引き換えに見返りが大きい)。効果は特別階と同じ
// キー (enemyMul/goldMul/soulMul/…) を使い、特別階の効果とは独立に重ね掛けされる。
const MUTATORS = [
  { id: "bloodTide", name: "血の満潮", sym: "🩸", accent: "#d4504e", enemyMul: 1.3, soulMul: 2,
    risk: "魔物どもが昂ぶり、強くなっている (敵の強さ 1.3倍)",
    gain: "得られる Soul が 2倍 になる" },
  { id: "goldRush", name: "黄金熱", sym: "💰", accent: "#ffd84a", enemyMul: 1.25, goldMul: 2,
    risk: "財の気配に魔物が殺気立っている (敵の強さ 1.25倍)",
    gain: "得られるゴールドが 2倍 になる" },
  { id: "sealedExit", name: "閉ざされた退路", sym: "⛓", accent: "#9aa0ac", noFlee: true, chestRankUp: 1,
    risk: "すべての戦闘から逃げられない",
    gain: "宝箱がすべて 1ランク上等になる" },
  { id: "hungryPack", name: "飢えた狩場", sym: "Ψ", accent: "#c08a4a", packMin: 3, soulMul: 1.3,
    risk: "敵が常に群れで現れる (3体以上)",
    gain: "得られる Soul が 30% 増える" },
  { id: "nightHunt", name: "闇討ちの宴", sym: "🌘", accent: "#7a5ad0", ambushMul: 4, goldMul: 1.5, soulMul: 1.3,
    risk: "奇襲を受けやすくなる",
    gain: "ゴールド 1.5倍・Soul 1.3倍" },
  { id: "elemRage", name: "属性の暴走", sym: "✺", accent: "#ff9a4a", elemRandom: true, soulMul: 1.5,
    risk: "すべての敵の属性が狂い、でたらめに入れ替わる (火の魔物が水を纏うことも)",
    gain: "得られる Soul が 1.5倍 になる" },
  { id: "mimicMarch", name: "ミミックの行進", sym: "◈", accent: "#e07840", mimicRate: 0.30, chestRankUp: 1,
    risk: "宝箱の3割はミミックだ",
    gain: "宝箱が 1ランク上等になり、ミミックは上質な宝箱を残す" },
  { id: "abyssalSurge", name: "深淵の脈動", sym: "☠", accent: "#8a2be2", enemyMul: 1.5, soulMul: 2, goldMul: 1.5, lootBonusLv: 8,
    risk: "迷宮中の敵が大幅に強くなっている (敵の強さ 1.5倍)",
    gain: "Soul 2倍・ゴールド 1.5倍・落ちている装備の質が上がる" },
];
// 適用中の異変の定義 (なければ null) / 効果値の取り出し
function mutDef() { return G.mutator ? MUTATORS.find((m) => m.id === G.mutator) || null : null; }

// 効果キーごとの合成方式: 倍率は積算 / 加算値は合算 / 確率系は最大 / 真偽は論理和。
// これにより「迷宮の異変」「奈落の変異 (積み重ね)」「奈落の誓約」が同一フックでそのまま効く。
const MUT_AGG = {
  enemyMul: "mul", soulMul: "mul", goldMul: "mul",
  ambushMul: "max", mimicRate: "max",
  lootBonusLv: "add", packMin: "max", chestRankUp: "add",
  noFlee: "or", elemAll: "or", elemRandom: "or", noTrap: "or", poisonUp: "or",
};
// この潜入で効いている全修飾子源 (迷宮の異変 + 奈落の誓約 + 奈落の変異) を列挙
function activeModifierDefs() {
  const defs = [];
  const md = mutDef(); if (md) defs.push(md);
  // 迷宮のイベントの効果 (この潜入 / この階)。迷宮の中でだけ効く
  if (inDungeon() && !abyssActive()) {
    if (G.run && G.run.ev && Array.isArray(G.run.ev.mods)) defs.push(...G.run.ev.mods);
    if (G.board && G.board.ev && Array.isArray(G.board.ev.mods)) defs.push(...G.board.ev.mods);
  }
  if (G.abyss) {
    for (const id of G.abyss.mods || []) { const m = ABYSS_MOD_MAP[id]; if (m) defs.push(m); }
    for (const id of G.abyss.mutations || []) { const m = ABYSS_MUT_MAP[id]; if (m) defs.push(m); }
  }
  return defs;
}
function mutNum(key, dflt) {
  const vals = [];
  for (const d of activeModifierDefs()) if (d[key] != null) vals.push(d[key]);
  if (!vals.length) return dflt;
  switch (MUT_AGG[key]) {
    case "mul": return vals.reduce((a, b) => a * b, 1);
    case "add": return vals.reduce((a, b) => a + b, 0);
    case "max": return vals.reduce((a, b) => Math.max(a, b), typeof dflt === "number" ? dflt : 0);
    case "or": return vals.some(Boolean);
    default: return vals[vals.length - 1]; // 既定: 最後 (= 単一異変の従来挙動)
  }
}

const pickFrom = (arr) => arr[rand(arr.length)];
function sfEachCell(b, fn) { for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) fn(b.cells[y][x]); }
function sfOpenCount(c) { return ["n", "e", "s", "w"].filter((d) => !c.walls[d]).length; }
// 空きマスから n 個選んでイベントに変換する
function sfPlace(b, n, fn) {
  const cand = [];
  sfEachCell(b, (c) => { if (c.type === "empty") cand.push(c); });
  for (let i = 0; i < n && cand.length; i++) fn(cand.splice(rand(cand.length), 1)[0]);
}
// この迷宮・この階の雑魚プール (board.js と同じ浅階/深階の切り替え)
function sfMonsterPool() {
  const cfg = activeCfg();
  const deep = G.floor > (cfg.floors || 3) / 2;
  return (deep ? cfg.deepPool : cfg.pool) || cfg.pool || ["cm_slime"];
}
// テーマ色の明度変換 (カード裏面の地色・枠色を accent から作る)
function shadeHex(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${Math.round(((n >> 16) & 255) * f)},${Math.round(((n >> 8) & 255) * f)},${Math.round((n & 255) * f)})`;
}
// 偉大なる死体の職業: レア30% / エピック50% / レジェンド20% (souls.js の共通定義を使う)
function rollGreatCorpseClass() { return rollGreatJobClass(); }

// 生存パーティが持つ職業ランクパッシブの最高Lv (隊全体効果の判定用。重複しない)。
// 控えの結社 (編成外の魂が供給するパーティ範囲パッシブ) も合算する。
function partyPassiveLv(key) {
  let lv = 0;
  for (const p of G.party || []) if (p.alive) lv = Math.max(lv, pLv(p, key));
  if (featureUnlocked("order")) {
    const om = orderPassiveMap(G.party || [], orderSeatedUids());
    if (om[key]) lv = Math.max(lv, om[key]);
  }
  return lv;
}

// 控えの結社 踏破の地図 (cartography): 着地ごとに周囲 N マス (マンハッタン距離) の
// カードを自動で表にする。踏破済みにはしないので、踏めば通常どおりイベントは起きる。
function revealByCartography() {
  const rad = partyPassiveLv("cartography");
  if (!rad) return false;
  let any = false;
  for (let dy = -rad; dy <= rad; dy++) {
    for (let dx = -rad; dx <= rad; dx++) {
      if (Math.abs(dx) + Math.abs(dy) > rad) continue;
      const x = G.px + dx, y = G.py + dy;
      if (x < 0 || y < 0 || x >= COLS || y >= ROWS) continue;
      const c = G.board.cells[y][x];
      if (c && !c.revealed) { c.revealed = true; any = true; }
    }
  }
  return any;
}

// 迷宮内の階に応じた敵の強さ倍率 (迷宮ベース × 階で微増 × 特別階 × 迷宮の異変)
function enemyScale() { return baseEnemyScale() * tuneMul(); }
// 手直し (DUNGEON_TUNE) を除いた強さ: 迷宮の素の倍率 × 階 × 特別階/異変。主はこれに bossMul を掛ける
function baseEnemyScale() {
  const cfg = activeCfg();
  return (cfg.enemyScale || 1) * (1 + (G.floor - 1) * 0.06) * sfNum("enemyMul", 1) * mutNum("enemyMul", 1);
}
// 迷宮ごとの手直し (generator.js DUNGEON_TUNE) のうち、いまの階の雑魚に掛かる倍率。奈落では掛けない
// (手直しは出現表の雑魚の強さ合わせ。ランクの曲線から組む単体の強敵・ミミック・出来事の魔物には掛けず、
//  それらには別の soloMul だけを掛ける → soloScale / soloFoes)
function tuneMul() {
  if (abyssActive()) return 1;
  const cfg = activeCfg();
  const t = cfg.tune;
  if (!t) return 1;
  const deep = G.floor > (cfg.floors || 3) / 2; // board.js の深階プールと同じ切り替え
  return (t.enemyMul || 1) * (deep ? (t.deepMul || 1) : 1);
}

// ミミックの強さの基準: この階に出る雑魚の最上位ランクと、雑魚と同じ強さ補正。
// (ランクの上乗せ — 通常 +1 / マスター +2 — は combat.js の spawnMimic が行う)
// 出来事の魔物 (檻番の獄卒など、spawnRanked) も同じ基準で「この階より何ランク上」を組む。
function mimicRef() {
  const cfg = activeCfg();
  const ranks = sfMonsterPool().map((k) => (MONSTERS[k] && MONSTERS[k].rank) || 0);
  return { rank: Math.max(1, cfg.rank || 1, ...ranks), scale: soloScale() };
}
// 単体の強敵 (強敵・ミミック・出来事の魔物) の手直し: 雑魚の enemyMul/deepMul ではなく soloMul だけ。奈落では掛けない
function soloTune() {
  if (abyssActive()) return 1;
  const t = activeCfg().tune;
  return (t && t.soloMul) || 1;
}
function soloScale() { return baseEnemyScale() * soloTune(); }
// 単体の強敵の印。これらは層相応のランク/固有の強さで組まれていて、雑魚の顔ぶれに合わせた倍率を
// 重ねると強くなりすぎるので soloScale で出す。startBattle はこの印 (_tuneK = 掛けた手直し) で戦果から打ち消す
function soloFoes(list) {
  const k = soloTune();
  for (const e of list) e._tuneK = k;
  return list;
}

// この迷宮に出る強敵のid。作り込み済みの層は層ごとの強敵 (LAYER_ELITES) を階ごとに順に出す。
// それ以外は旧来どおり、各ランク帯 (10迷宮) を 1-3 / 4-6 / 7-10 の
// 3グループに区切り、グループごとに固有の強敵が決まっている (例: 迷宮1-3, 4-6, 7-10, 11-13, …)
function eliteKey() {
  const n = G.dungeonIdx + 1;
  const le = LAYER_ELITES[layerOf(n)];
  if (le && le.length) return le[(G.floor || 0) % le.length];
  const r = Math.min(10, Math.ceil(n / 10));
  const pos = ((n - 1) % 10) + 1;
  const g = pos <= 3 ? 0 : pos <= 6 ? 1 : 2;
  return ELITE_ORDER[(r - 1) * 3 + g];
}

// ===== 迷宮の見出し (#topbar) =====
// 左: 設定・帰還陣・下り階段 / 中央: 迷宮名と「B1F ◆◇◇」の深さ (主の階は髑髏) / 右: 所持の通貨
const TOPBAR_GEAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8Zm8.2 4.6-1.7.9a6.9 6.9 0 0 1-.6 1.5l.6 1.8-1.7 1.7-1.8-.6c-.5.3-1 .5-1.5.6l-.9 1.7h-2.4l-.9-1.7a6.9 6.9 0 0 1-1.5-.6l-1.8.6-1.7-1.7.6-1.8a6.9 6.9 0 0 1-.6-1.5l-1.7-.9v-2.4l1.7-.9c.1-.5.3-1 .6-1.5l-.6-1.8 1.7-1.7 1.8.6c.5-.3 1-.5 1.5-.6l.9-1.7h2.4l.9 1.7c.5.1 1 .3 1.5.6l1.8-.6 1.7 1.7-.6 1.8c.3.5.5 1 .6 1.5l1.7.9Z"/></svg>';
function setTopbarCurrency() {
  if (!topbarCur) return;
  const key = `${G.gold}|${G.soulPts}|${G.redSoul}|${G.embers}`;
  if (topbarCur._k === key && topbarCur.childElementCount) return;
  topbarCur._k = key;
  topbarCur.innerHTML = "";
  const add = (cls, v, title) => { const sp = el("span", "cur " + cls, String(v)); sp.title = title; topbarCur.appendChild(sp); };
  add("cur-gold", G.gold, "ゴールド");
  add("cur-soul", G.soulPts, "✦Soul");
  add("cur-red", G.redSoul, "赤い魂");
  if (G.embers > 0) add("cur-ember", G.embers, "魂の残火");
}
// 見出しの左は「手帳」(迷宮の一時停止シート: 階の情報・記録・帰還・設定)。旧 ⚙/帰還陣/階段の小さな印は
// 画面下の行動ドックへ移したので隠す (dungeon.css)。迷宮名と深さの札は押すと「階の情報」
function ensureTopbarHud() {
  const left = document.querySelector("#topbar .topbar-left");
  if (left && !document.getElementById("dg-book")) {
    const b = el("button", "dg-book");
    b.id = "dg-book";
    b.type = "button";
    b.setAttribute("aria-label", "手帳 (階の情報・記録・帰還・設定)");
    b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4.5h10.5a3 3 0 0 1 3 3v12H8a3 3 0 0 1-3-3Z"/><path d="M5 16.5a3 3 0 0 1 3-3h10.5"/><path d="M9 8h6M9 10.6h4"/></svg>';
    b.appendChild(el("span", "dg-book-l", "手帳"));
    b.addEventListener("click", () => {
      // 戦闘中も開ける (閉じるまで戦闘は止まる。帰還・隊の編成はできない)
      if (!inDungeon() || uiBlocked()) return;
      if (G.state === "board" ? (G.anim || G.walking) : (G.state !== "combat" || !G.battle)) return;
      SFX.select();
      UI.openDungeonMenu();
    });
    left.insertBefore(b, left.firstChild);
  }
  if (floorInfo && !floorInfo.dataset.tap) {
    floorInfo.dataset.tap = "1";
    floorInfo.setAttribute("role", "button");
    floorInfo.addEventListener("click", () => {
      if (G.state !== "board" || G.anim || G.walking || uiBlocked()) return;
      SFX.select();
      uiDungeonHud.openFloorInfo();
    });
  }
}
function updateTopbar() {
  const sb = document.getElementById("settings-btn");
  if (sb && !sb.querySelector("svg")) sb.innerHTML = TOPBAR_GEAR;
  ensureTopbarHud();
  if (G.state === "town") {
    // 街では #topbar はオーバーレイ (#town-screen) に隠れる。タイトルだけ持たせておく
    floorInfo.textContent = "街";
    if (topbarCur) { topbarCur.innerHTML = ""; topbarCur._k = ""; }
    return;
  }
  const sp = specialDef();
  const dn = activeCfg();
  const mu = mutDef();
  const floors = abyssActive() ? 0 : ((dn && dn.floors) || 1);
  const boss = !abyssActive() && !!curDungeon().boss;
  floorInfo.innerHTML = "";
  floorInfo.title = `${dn ? dn.name : ""} 地下${G.floor}階${floors ? ` (全${floors}階)` : ""}`;
  floorInfo.appendChild(el("div", "fi-name", dn ? dn.name : ""));
  const row = el("div", "fi-row");
  row.appendChild(el("span", "fi-depth", `B${G.floor}F`));
  if (floors && floors <= 12) {
    const pips = el("span", "fi-pips");
    for (let i = 1; i <= floors; i++) {
      pips.appendChild(el("i", (i < G.floor ? "done" : i === G.floor ? "now" : "") + (i === floors && boss ? " boss" : "")));
    }
    row.appendChild(pips);
  } else if (floors) row.appendChild(el("span", "fi-of", `/ ${floors}`));
  else row.appendChild(el("span", "fi-of", "奈落"));
  if (G.eliteFloor) row.appendChild(el("span", "fi-tag fi-elite", "強敵"));
  else if (sp) { const t = el("span", "fi-tag", sp.name); t.style.color = sp.accent; t.style.borderColor = sp.accent; row.appendChild(t); }
  if (mu) { const t = el("span", "fi-tag fi-mut", "異変"); t.title = `異変「${mu.name}」`; row.appendChild(t); }
  if (G.eliteFloor || sp || mu || (G.abyss && G.abyss.mutations && G.abyss.mutations.length)) row.appendChild(el("span", "fi-more", "›"));
  floorInfo.appendChild(row);
  setTopbarCurrency();
  updateDescendBtn();
  updateReturnBtn();
}

function newFloor() {
  // 奈落: 強敵参照 (eliteKey は G.dungeonIdx を見る) を素体迷宮に同期
  if (abyssActive()) G.dungeonIdx = abyssBaseN(G.abyss.depth) - 1;
  // ダンジョンが自前で持つ出現プール (pool=浅階 / deepPool=深階) を使う
  const cfg = activeCfg();
  G.board = makeBoard(G.floor, cfg);
  // 強敵階: モンスターカードのうち1枚だけをこの迷宮グループ固有の強敵に置き換える
  // (強敵は各階に1体のみ)。モンスターカードが無ければ任意の空マスを強敵にする。
  if (G.eliteFloor) {
    const ek = eliteKey();
    const monsterCells = [];
    for (let ey = 0; ey < ROWS; ey++) {
      for (let ex = 0; ex < COLS; ex++) {
        const ecell = G.board.cells[ey][ex];
        if (ecell.type === "monster") monsterCells.push(ecell);
      }
    }
    let target = monsterCells.length ? monsterCells[rand(monsterCells.length)] : null;
    if (!target) {
      const empties = [];
      sfEachCell(G.board, (c) => { if (c.type === "empty") empties.push(c); });
      if (empties.length) { target = empties[rand(empties.length)]; target.type = "monster"; }
    }
    if (target) {
      target.monsterKey = ek;
      target.elite = true;
      target.cleared = false;
    }
  }
  // 特別階: 盤面への効果 (宝箱の追加・罠の消滅など) を適用
  const spf = specialDef();
  if (spf && spf.board) spf.board(G.board);
  if (G.floor > G.stats.deepest) G.stats.deepest = G.floor;
  // 酒場の噂を盤面に反映 (潜入直後の階のみ)
  if (G.activeRumor && G.activeRumor.floor === G.floor) applyRumorToBoard(G.board);
  evNewFloor(); // 迷宮のイベント: 出来事の配置・持ち越しの効果
  G.px = G.board.start.x;
  G.py = G.board.start.y;
  G.portalFound = false; // この階の帰還魔法陣はまだ発見していない
  if (G.run) G.run.floors = Math.max(G.run.floors || 1, G.floor);
  updateTopbar();
  log(`地下 ${G.floor} 階。カードをめくって階段を探せ！`, "sys");
  if (tlOn()) tlSnapshot("floor", tlWhere(), G.party);
}

// 逃走判定の追跡の物差し (Battle.fleeK): 敵の AGI は味方よりずっと小さい規模なので、
// 「この迷宮・階の基準AGI (baseline.js) ÷ この迷宮の雑魚の標準AGI (出現表の素のAGIの中央値)」を掛けて揃える。
// 俊敏な敵・主・ミミック・鈍足/激昂は、標準からのずれとしてそのまま逃げにくさ/逃げやすさに効く
function fleeScale() {
  const cfg = activeCfg();
  const n = abyssActive() ? abyssBaseN(G.abyss.depth) : dungeonNumber(cfg);
  const x = progressX(n, G.floor || 1, cfg.floors || 1);
  const spds = [...new Set([...(cfg.pool || []), ...(cfg.deepPool || [])])]
    .map((k) => MONSTERS[k] && MONSTERS[k].spd).filter((v) => v > 0).sort((a, b) => a - b);
  const typical = spds.length ? spds[Math.floor(spds.length / 2)] : 4 + Math.round((cfg.rank || 1) * 0.9);
  return baselineAgi(x) / Math.max(1, typical);
}

// テスト記録 (telemetry.js): いまの迷宮の欄 (奈落は深度ごと)。n は進行度 (基準AGI) の算出に使う
function tlWhere() {
  const cfg = activeCfg();
  if (abyssActive()) {
    const d = G.abyss.depth;
    return { key: `A${d}`, name: `奈落 深度${d}`, n: abyssBaseN(d), floor: G.floor, floors: cfg.floors || 1 };
  }
  const n = dungeonNumber(cfg);
  return { key: `D${n}`, name: cfg.name || "", n, floor: G.floor, floors: cfg.floors || 1 };
}

// ---- ボード描画 ----
// 盤面と戦闘のキャンバスは論理座標 VW×VH で描く。VH は画面の縦の余りに合わせて伸縮し
// (縦長の端末ほどカードが縦長の墓石になる)、実画素は端末の画素密度ぶん (VSX/VSY 倍) 持つ。
// 床・墓石・壁は論理解像度で一度だけ焼いたドット絵を補間なしで拡大し、光と粒子だけを毎フレーム重ねる。
const VW = 480;
let VH = 320, VSX = 1, VSY = 1;
const GAP = 4;                     // 墓石と墓石の間の溝 (壁はこの溝の上に立つ)
const BOARD_MX = 6, BOARD_MY = 6;  // 盤面の外周の余白
let CARD_W = 55, CARD_H = 50, OX = 6, OY = 6;
function layoutBoard() {
  CARD_W = Math.floor((VW - BOARD_MX * 2 - GAP * (COLS - 1)) / COLS);
  CARD_H = Math.floor((VH - BOARD_MY * 2 - GAP * (ROWS - 1)) / ROWS);
  OX = Math.round((VW - (COLS * CARD_W + (COLS - 1) * GAP)) / 2);
  OY = Math.round((VH - (ROWS * CARD_H + (ROWS - 1) * GAP)) / 2);
}
layoutBoard();
function cellRect(x, y) {
  return { x: OX + x * (CARD_W + GAP), y: OY + y * (CARD_H + GAP), w: CARD_W, h: CARD_H };
}
// キャンバス座標 → マス (溝の上は null)
function cellAt(sx, sy) {
  const cx = Math.floor((sx - OX) / (CARD_W + GAP)), cy = Math.floor((sy - OY) / (CARD_H + GAP));
  if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) return null;
  const r = cellRect(cx, cy);
  if (sx > r.x + r.w + 1 || sy > r.y + r.h + 1) return null;
  return { x: cx, y: cy };
}
// 論理座標で描くための変換 (各描画の頭で呼ぶ)
function viewTransform(ctx = vctx) { ctx.setTransform(VSX, 0, 0, VSY, 0, 0); }
const h01 = (a, b = 0) => { let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

// ===== キャンバスの寸法合わせ =====
// 探索中: 上下の帯 (見出し・収穫・隊・記録の最低限) を除いた縦の余りを盤面に回す (縦横比 0.56〜1.24)。
// 戦闘中: コマンド板の高さを見込んで戦場を決め、戦闘の間は固定する (メニューの出し入れで揺れないように)。
const appEl = document.getElementById("app");
const screenEl = document.getElementById("screen");
const topbarEl = document.getElementById("topbar");
const LOG_MIN_BOARD = 84, LOG_MIN_COMBAT = 46, MENU_RESERVE = 166;
const TURN_ORDER_H = 31; // 戦闘の行動順の帯 (#turn-order) の高さ + 下の余白。記録欄を削らず戦場の側で詰める
let _fitKey = "";
function outerH(e) {
  if (!e || e.classList.contains("hidden")) return 0;
  const cs = getComputedStyle(e);
  if (cs.display === "none") return 0;
  return e.offsetHeight + (parseFloat(cs.marginTop) || 0) + (parseFloat(cs.marginBottom) || 0);
}
function fitView(force = false) {
  if (!appEl || !screenEl) return false;
  const combat = G.state === "combat" || (G.state === "over" && !!G.battle);
  appEl.classList.toggle("in-combat", combat);
  const cssW = view.clientWidth || Math.round(view.getBoundingClientRect().width);
  if (!cssW) return false;
  const csA = getComputedStyle(appEl), csS = getComputedStyle(screenEl);
  const hudEl = document.getElementById("hud"), ctrlEl = document.getElementById("controls");
  const csH = hudEl ? getComputedStyle(hudEl) : null;
  const appH = appEl.clientHeight - (parseFloat(csA.paddingTop) || 0) - (parseFloat(csA.paddingBottom) || 0);
  let used = (parseFloat(csS.paddingTop) || 0) + (parseFloat(csS.paddingBottom) || 0)
    + outerH(topbarEl) + outerH(partyEl) + outerH(hintEl)
    + (csH ? (parseFloat(csH.paddingTop) || 0) + (parseFloat(csH.paddingBottom) || 0) : 0);
  if (combat) used += MENU_RESERVE + LOG_MIN_COMBAT + TURN_ORDER_H;
  else used += outerH(runbarEl) + outerH(ctrlEl) + LOG_MIN_BOARD;
  const h = Math.max(cssW * 0.56, Math.min(cssW * (combat ? 0.98 : 1.32), appH - used));
  const vh = Math.max(240, Math.round((VW * h) / cssW));
  const cssH = (vh * cssW) / VW;
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const S = Math.max(1, Math.min(2, (cssW * dpr) / VW));
  const bw = Math.round(VW * S), bh = Math.round(vh * S);
  const key = `${bw}x${bh}|${cssH.toFixed(1)}`;
  if (key === _fitKey && !force) return false;
  _fitKey = key;
  VH = vh;
  if (view.width !== bw) view.width = bw;
  if (view.height !== bh) view.height = bh;
  view.style.height = cssH.toFixed(2) + "px";
  VSX = bw / VW; VSY = bh / VH;
  layoutBoard();
  return true;
}
// 画面の回転・窓の伸縮に追従 (盤面/戦場を描き直す)
function refitAndRedraw() {
  if (!fitView()) return;
  if (G.state === "board" && G.board) drawBoardFrame();
  else if (G.state === "combat" && G.battle) renderCombatCanvas();
}
window.addEventListener("resize", () => requestAnimationFrame(refitAndRedraw));
if (typeof ResizeObserver !== "undefined" && appEl) new ResizeObserver(() => requestAnimationFrame(refitAndRedraw)).observe(appEl);

// ダンジョンで歩く自分の駒: 赤い頭巾の人影 (src/walkerart.js・前後左右の4方向)。最後に歩いた向きを向く (既定は正面)。
// 絵がまだ読めない時は従来どおり、生存している先頭メンバーの職業姿 (全滅時は先頭)
function walkerSprite() {
  const W = uiDungeonHud.walkerArt();
  if (W) return W[G._facing || "down"] || W.down || W.up;
  const party = G.party || [];
  const lead = party.find((p) => p.alive) || party[0];
  if (!lead) return HERO;
  return lead.isDoll ? dollSprite(lead) : HERO;
}

// 画面下の行動ドック (旧: 操作ヒント)。renderDock が中身を作る
const hintEl = document.getElementById("hint");

// ===== 今回の収穫と目的 (盤面の下の帯。迷宮の探索中のみ) =====
const runbarEl = document.getElementById("runbar");
let _runbarKey = "";
// 記録欄の背後に、いまいる層の景色を薄く敷く (欄の実寸で描いて画像化。設定「戦闘の背景: 漆黒」では敷かない)
const _logScene = new Map();
let _logSceneKey = "";
function updateLogScene() {
  const el = document.getElementById("log");
  if (!el) return;
  const layer = inDungeon() && G.state !== "over" && !PREFS.classicBattle ? battleLayer() : 0;
  const q = (v) => Math.max(128, Math.round(v / 16) * 16);
  const w = layer ? q(el.clientWidth) : 0, h = layer ? q(el.clientHeight) : 0;
  const key = layer ? `${layer}|${w}x${h}` : "";
  if (key === _logSceneKey) return;
  _logSceneKey = key;
  if (!layer) { el.classList.remove("has-scene"); el.style.removeProperty("--log-scene"); return; }
  let url = _logScene.get(key);
  if (!url) {
    try {
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      drawBattleBackdrop(c.getContext("2d"), w, h, layer, 0);
      url = c.toDataURL();
      _logScene.set(key, url);
      if (_logScene.size > 8) _logScene.delete(_logScene.keys().next().value);
    } catch (e) { url = ""; }
  }
  if (!url) { el.classList.remove("has-scene"); return; }
  el.style.setProperty("--log-scene", `url(${url})`);
  el.classList.add("has-scene");
}

// この階で為すべきこと (盤面の下に常に掲げる)
function dungeonObjective() {
  if (abyssActive()) {
    if (abyssBossPending()) return { k: "boss", t: "門番が待つ ― 階段の先へ" };
    return { k: "down", t: findRevealedStairs() ? "階段を見つけた ― さらに深淵へ" : "下り階段を探せ" };
  }
  const dn = curDungeon();
  const atBottom = G.floor >= (dn.floors || 1);
  const found = !!findRevealedStairs();
  if (atBottom && dn.boss) return { k: "boss", t: found ? "主の間への階段を見つけた" : "最深部 ― 主の間への階段を探せ" };
  if (atBottom) return { k: "goal", t: found ? "最深部の階段を見つけた ― 踏破せよ" : "最深部 ― 最奥の階段を探せ" };
  return { k: "down", t: found ? "下り階段を見つけた" : "下り階段を探せ" };
}

function renderRunbar() {
  updateLogScene();
  if (!runbarEl) return;
  const show = inDungeon() && G.state === "board";
  runbarEl.classList.toggle("hidden", !show);
  if (!show) return;
  // 帯を押すと「今回の収穫」(得た品・魂・成長の一覧)
  if (!runbarEl.dataset.tap) {
    runbarEl.dataset.tap = "1";
    runbarEl.setAttribute("role", "button");
    runbarEl.setAttribute("aria-label", "今回の収穫を見る");
    runbarEl.addEventListener("click", () => {
      if (G.state !== "board" || G.anim || G.walking || uiBlocked()) return;
      SFX.select();
      uiDungeonHud.openRunLoot();
    });
  }
  const run = G.run || { gold: 0, soulPts: 0, items: [] };
  const cnt = { c: 0, uc: 0, r: 0, sr: 0, lr: 0 };
  for (const x of run.items || []) { const k = rarityKey(x.item); if (k) cnt[k]++; }
  const obj = dungeonObjective();
  const key = `${obj.k}|${obj.t}|${run.gold}|${run.soulPts}|${Object.values(cnt).join(",")}|${G.portalFound ? 1 : 0}`;
  if (key === _runbarKey) return;
  _runbarKey = key;
  runbarEl.innerHTML = "";
  const goal = el("div", "rb-goal rb-goal-" + obj.k);
  goal.appendChild(el("i", "rb-goal-ic"));
  goal.appendChild(el("span", "rb-goal-t", obj.t));
  if (G.portalFound) { const p = el("span", "rb-portal", "帰還陣"); p.title = "この階の帰還魔法陣を見つけた (下の「帰還」で街へ戻れる)"; goal.appendChild(p); }
  runbarEl.appendChild(goal);
  const loot = el("div", "rb-loot");
  loot.title = "今回の潜入で得たもの";
  loot.appendChild(el("span", "rb-gold" + (run.gold ? "" : " zero"), String(run.gold || 0)));
  loot.appendChild(el("span", "rb-soul" + (run.soulPts ? "" : " zero"), String(run.soulPts || 0)));
  const gems = el("span", "rb-gems");
  for (const k of ["c", "uc", "r", "sr", "lr"]) {
    const sp = el("span", "rb-rar rar-" + k + (cnt[k] ? "" : " zero"), cnt[k] ? String(cnt[k]) : "");
    sp.title = `${RARITIES[k].label} ×${cnt[k]}`;
    gems.appendChild(sp);
  }
  loot.appendChild(gems);
  loot.appendChild(el("span", "rb-chev", "›"));
  runbarEl.appendChild(loot);
}

// ===== 行動ドック (#hint を置き換える。画面下の 52px) =====
// その場で取れる行動だけを大きく出す: 階段を見つけたら「▼ B3Fへ降りる」(主の階は挑む/踏破)、
// 帰還陣を見つけたか主を討ったら「⌂ 帰還」。何も無い時は操作の手引きを薄く出す。戦闘中は命令板が代わる
function dockSpec() {
  if (G.state !== "board" || !G.board) return null;
  const st = findRevealedStairs();
  let down = null;
  if (st) {
    if (abyssActive()) {
      down = abyssBossPending()
        ? { key: "guard", label: "門番に挑む", sub: `B${G.floor}F の門番`, kind: "danger", icon: "boss" }
        : { key: "down", label: `B${G.floor + 1}Fへ降りる`, sub: "さらに深淵へ", kind: "primary", icon: "down" };
    } else {
      const dn = curDungeon();
      const atBottom = G.floor >= (dn.floors || 1);
      if (atBottom && G.bossDown) down = null; // 踏破済み: 最深部の階段は役目を終えた (下の「帰還」で凱旋)
      else if (atBottom && dn.boss) down = { key: "boss", label: "主の間へ", sub: "迷宮の主が待つ", kind: "danger", icon: "boss" };
      else if (atBottom) down = { key: "clear", label: "踏破する", sub: "最深部の階段", kind: "primary", icon: "star" };
      else {
        const next = G.floor + 1, last = dn.floors || 1;
        down = { key: "down", label: `B${next}Fへ降りる`, sub: next >= last ? (dn.boss ? "次は主の待つ最深部" : "次は最深部") : `残り ${last - G.floor}階`, kind: "primary", icon: "down" };
      }
    }
  }
  const home = (G.portalFound || G.bossDown) ? { label: "帰還", sub: G.bossDown && !G.portalFound ? "主を討った" : "帰還陣から", icon: "home" } : null;
  // 全員を回復 (隊の画面と同じ healAll)。手当ての要る者がいて、唱えられる時だけ光る
  const dead = G.party.filter((t) => !t.alive).length;
  const hurt = G.party.some((t) => t.alive && (t.hp < t.maxhp || t.ailment));
  const heal = { label: "全員を回復", sub: dead ? `倒れた者 ${dead}` : hurt ? "傷ついた者がいる" : "皆 無事", hot: healAllNeed() && (healAllCasters().length > 0 || healAllRevivers().length > 0) };
  return { down, home, heal, idle: G.floor <= 1 && !(G.run && G.run.kills) ? "スワイプで進む ・ 光る墓石をめくる" : "階段を見つけると、ここから降りられる" };
}
function dockDescend() {
  if (G.state !== "board" || G.anim || G.walking || uiBlocked()) return;
  const cell = findRevealedStairs();
  if (!cell) return;
  SFX.select();
  // 途中の階はそのまま降りる (確認なし)。主の間・踏破・奈落の門番は決断のシートを挟む
  const dn = curDungeon();
  const plain = abyssActive() ? !abyssBossPending() : G.floor < (dn.floors || 1);
  if (plain) descend(); else askDescend(cell);
}
function dockHealAll() {
  if (G.state !== "board" || G.anim || G.walking || uiBlocked()) return;
  healAll();
  renderDock();
}
function dockReturn() {
  if (G.state !== "board" || G.anim || G.walking || uiBlocked()) return;
  SFX.select();
  confirmReturnToTown();
}
function renderDock() {
  if (!hintEl) return;
  const spec = inDungeon() ? dockSpec() : null;
  hintEl.classList.toggle("hidden", G.state === "combat" || (G.state === "over" && !!G.battle));
  uiDungeonHud.renderDock(hintEl, spec, { descend: dockDescend, goHome: dockReturn, healAll: dockHealAll });
}

function renderBoard() {
  _boardActiveAt = performance.now();
  renderDock();
  renderRunbar();
  updateDescendBtn();
  updateReturnBtn();
  renderParty();
  fitView();
  drawBoardFrame();
}

// ===== 盤面の静的な層 (床・墓石・壁) =====
// art: 床と墓石の絵 (盤面+寸法+層+階の性質ごと。戦闘で寸法が変わっても戻った時に焼き直さないよう数枚保持)
// scene: 踏破状況を反映した合成 (めくるたびに作り直す。論理解像度なので軽い)
const BV = { art: null, artKey: "", artCache: new Map(), scene: null, sctx: null, sceneKey: "", sceneHi: null, sceneHiKey: "",
  dark: null, dctx: null, darkBase: null, darkKey: "", parts: [], flipSeen: null };
function ensureBoardArt() {
  const b = G.board;
  const L = battleLayer();
  const sp = specialDef();
  const crypt = L === 1;
  const seed = boardSeed(b, dungeonNumber(activeCfg()) * 7919 + G.floor);
  const key = `${VW}x${VH}|${CARD_W}x${CARD_H}|${seed}|${L}|${G.eliteFloor ? "e" : ""}|${sp ? sp.id : ""}`;
  if (BV.artKey === key && BV.art) return BV.art;
  let art = BV.artCache.get(key);
  if (!art) {
    const mat = crypt ? CATACOMB : genericMaterial(dungeonTheme());
    const opt = { seed, cols: COLS, rows: ROWS, rect: cellRect, cells: b.cells, mat, elite: !!G.eliteFloor, accent: crypt && sp ? hexRgb(sp.accent) : null };
    const fl = paintCryptFloor(VW, VH, opt);
    const slabs = crypt ? paintCryptSlabs(VW, VH, opt) : paintOldCardBacks();
    art = { key, seed, floor: fl.canvas, candles: fl.candles, slabs, mat, crypt };
    BV.artCache.set(key, art);
    while (BV.artCache.size > 3) BV.artCache.delete(BV.artCache.keys().next().value);
  }
  BV.art = art; BV.artKey = key; BV.sceneKey = "";
  return art;
}
// 第1層以外: 層ごとの旧来の裏面 (イラストカード) を論理解像度の画像に焼く
function paintOldCardBacks() {
  const c = document.createElement("canvas");
  c.width = VW; c.height = VH;
  const g = c.getContext("2d");
  const main = vctx;
  vctx = g;
  try {
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const r = cellRect(x, y);
      g.save();
      g.translate(r.x, r.y);
      g.beginPath(); g.rect(0, 0, r.w, r.h); g.clip();
      drawOldCardBack(r);
      g.restore();
    }
  } finally { vctx = main; }
  return c;
}
function ensureBoardScene() {
  const art = ensureBoardArt();
  const cells = G.board.cells;
  let sig = BV.artKey + "|" + (G.flipAnim ? G.flipAnim.x + "," + G.flipAnim.y : "") + "|";
  for (const row of cells) for (const c of row) sig += c.revealed ? "1" : "0";
  if (sig === BV.sceneKey && BV.scene) return;
  BV.sceneKey = sig;
  if (!BV.scene || BV.scene.width !== VW || BV.scene.height !== VH) {
    BV.scene = document.createElement("canvas");
    BV.scene.width = VW; BV.scene.height = VH;
    BV.sctx = BV.scene.getContext("2d");
  }
  const g = BV.sctx;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = "source-over"; g.globalAlpha = 1; g.imageSmoothingEnabled = false;
  // 1) 盤全体の床を闇に沈める (蓋の下と溝)
  g.drawImage(art.floor, 0, 0);
  g.fillStyle = G.eliteFloor ? "rgba(10,2,3,0.78)" : "rgba(4,3,5,0.78)";
  g.fillRect(0, 0, VW, VH);
  const rev = (x, y) => x >= 0 && y >= 0 && x < COLS && y < ROWS && cells[y][x].revealed;
  const half = GAP / 2;
  // 2) 踏破したマスの床 (壁のない境は隣の床とつなげる)
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    if (!rev(x, y)) continue;
    const c = cells[y][x], r = cellRect(x, y);
    const x0 = r.x - (!c.walls.w && rev(x - 1, y) ? half : 0), x1 = r.x + r.w + (!c.walls.e && rev(x + 1, y) ? half : 0);
    const y0 = r.y - (!c.walls.n && rev(x, y - 1) ? half : 0), y1 = r.y + r.h + (!c.walls.s && rev(x, y + 1) ? half : 0);
    g.drawImage(art.floor, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
  }
  for (let j = 1; j < ROWS; j++) for (let i = 1; i < COLS; i++) {
    if (!rev(i - 1, j - 1) || !rev(i, j - 1) || !rev(i - 1, j) || !rev(i, j)) continue;
    const a = cells[j - 1][i - 1], d = cells[j][i];
    if (a.walls.e || a.walls.s || d.walls.n || d.walls.w) continue;
    const r = cellRect(i, j);
    g.drawImage(art.floor, r.x - GAP, r.y - GAP, GAP, GAP, r.x - GAP, r.y - GAP, GAP, GAP);
  }
  // 3) 墓石の蓋 (落ち影 → 本体)
  g.fillStyle = "rgba(0,0,0,0.55)";
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    if (rev(x, y)) continue;
    const r = cellRect(x, y);
    g.fillRect(r.x + 1, r.y + 2, r.w, r.h);
  }
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    if (rev(x, y)) continue;
    const r = cellRect(x, y);
    g.drawImage(art.slabs, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
  }
  // 4) 踏破したマスの石壁 (共有する辺は一度だけ) と交点の柱頭
  const walls = [], posts = new Map(), seen = new Set();
  const post = (px, py) => posts.set(px + "," + py, { x: px, y: py });
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    if (!rev(x, y)) continue;
    const c = cells[y][x], r = cellRect(x, y);
    const L = r.x - half, R = r.x + r.w + half, T = r.y - half, B = r.y + r.h + half;
    if (c.walls.n && !seen.has(`h${x},${y}`)) { seen.add(`h${x},${y}`); walls.push({ x: L, y: T - 3, w: R - L, h: 6, horiz: true }); post(L, T); post(R, T); }
    if (c.walls.s && !seen.has(`h${x},${y + 1}`)) { seen.add(`h${x},${y + 1}`); walls.push({ x: L, y: B - 3, w: R - L, h: 6, horiz: true }); post(L, B); post(R, B); }
    if (c.walls.w && !seen.has(`v${x},${y}`)) { seen.add(`v${x},${y}`); walls.push({ x: L - 3, y: T, w: 6, h: B - T, horiz: false }); post(L, T); post(L, B); }
    if (c.walls.e && !seen.has(`v${x + 1},${y}`)) { seen.add(`v${x + 1},${y}`); walls.push({ x: R - 3, y: T, w: 6, h: B - T, horiz: false }); post(R, T); post(R, B); }
  }
  paintCryptWalls(g, walls, [...posts.values()], art.mat, art.seed);
  BV.sceneHiKey = "";
}
// 合成済みの盤面を実画素の寸法へ拡大した写し (毎フレームは等倍で貼るだけにする)
function boardSceneHi() {
  const key = BV.sceneKey + "|" + view.width + "x" + view.height;
  if (BV.sceneHiKey === key && BV.sceneHi) return BV.sceneHi;
  if (!BV.sceneHi || BV.sceneHi.width !== view.width || BV.sceneHi.height !== view.height) {
    BV.sceneHi = document.createElement("canvas");
    BV.sceneHi.width = view.width; BV.sceneHi.height = view.height;
  }
  const g = BV.sceneHi.getContext("2d");
  g.imageSmoothingEnabled = false;
  g.drawImage(BV.scene, 0, 0, view.width, view.height);
  BV.sceneHiKey = key;
  return BV.sceneHi;
}

// ===== 光と闇 =====
// 角灯の光の輪 (手番の駒が持つ)。闇は低解像度で作って拡大する (ぼけた縁 = 自然な減衰)
function boardLight(hx, hy, now) {
  const fl = REDUCED_MOTION ? 1 : 1 + 0.03 * Math.sin(now * 0.0091) + 0.02 * Math.sin(now * 0.0233 + 1.3) + 0.012 * Math.sin(now * 0.061);
  const r1 = Math.max(CARD_W * 2.25, (CARD_H + GAP) * 1.5) * fl;
  return { x: hx, y: hy - CARD_H * 0.12, r1, fl };
}
// 点 (x,y) が角灯にどれだけ照らされているか (0..1)
function lightAt(lt, x, y) {
  const d = Math.hypot(x - lt.x, y - lt.y) / lt.r1;
  if (d >= 1) return 0;
  return d < 0.3 ? 1 : 1 - Math.pow((d - 0.3) / 0.7, 1.4);
}
function boardLightSources(now) {
  const out = [];
  const art = BV.art, cells = G.board.cells;
  for (const c of art.candles) {
    if (!cells[c.cy][c.cx].revealed) continue;
    const f = REDUCED_MOTION ? 1 : 0.86 + 0.14 * Math.sin(now * 0.013 + c.x * 1.7) * Math.sin(now * 0.0071 + c.y);
    out.push({ x: c.x, y: c.y - 2, r: 30 * f, a: 0.72 * f, col: "255,150,64", ga: 0.16 * f, gr: 20 });
  }
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const c = cells[y][x];
    if (!c.revealed) continue;
    const r = cellRect(x, y), cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    const pulse = REDUCED_MOTION ? 0.5 : 0.5 + 0.5 * Math.sin(now * 0.003 + x + y);
    if (c.type === "portal") out.push({ x: cx, y: cy, r: 46, a: 0.7, col: "90,220,235", ga: 0.18 + 0.1 * pulse, gr: 40 });
    else if (c.type === "fountain" && !c.cleared) out.push({ x: cx, y: cy, r: 36, a: 0.5, col: "100,170,255", ga: 0.12, gr: 30 });
    else if (c.type === "poison") out.push({ x: cx, y: cy + r.h * 0.05, r: 34, a: 0.4, col: "120,210,60", ga: 0.1 + 0.05 * pulse, gr: 30 });
    else if (c.type === "stairs") out.push({ x: cx, y: cy, r: 30, a: 0.4, col: "160,190,255", ga: 0.06, gr: 24 });
    else if (c.type === "corpse" && c.corpseWarm && !c.cleared) out.push({ x: cx + 7, y: cy - 14, r: 26, a: 0.5, col: "127,208,255", ga: 0.16 + 0.06 * pulse, gr: 20 });
    else if (c.type === "chest" && !c.cleared) out.push({ x: cx, y: cy, r: c.evMark ? 34 : 22, a: c.evMark ? 0.55 : 0.3, col: "255,210,120", ga: (c.evMark ? 0.14 : 0.06) + 0.04 * pulse, gr: 18 });
    else if (c.type === "event" && !c.cleared) out.push({ x: cx, y: cy, r: 34, a: 0.5, col: "170,120,255", ga: 0.12 + 0.08 * pulse, gr: 28 });
  }
  return out;
}
function drawBoardDarkness(lt, srcs) {
  const q = 4, dw = Math.ceil(VW / q), dh = Math.ceil(VH / q);
  if (!BV.dark || BV.dark.width !== dw || BV.dark.height !== dh) {
    BV.dark = document.createElement("canvas"); BV.dark.width = dw; BV.dark.height = dh;
    BV.dctx = BV.dark.getContext("2d");
    BV.darkKey = "";
  }
  const dk = `${dw}x${dh}|${G.eliteFloor ? 1 : 0}|${specialDef() ? specialDef().id : ""}`;
  if (BV.darkKey !== dk) {
    BV.darkKey = dk;
    const b = document.createElement("canvas"); b.width = dw; b.height = dh;
    const bg = b.getContext("2d");
    const col = G.eliteFloor ? "16,2,4" : "5,4,9";
    const vg = bg.createRadialGradient(dw / 2, dh / 2, Math.min(dw, dh) * 0.2, dw / 2, dh / 2, Math.max(dw, dh) * 0.72);
    vg.addColorStop(0, `rgba(${col},0.54)`);
    vg.addColorStop(1, `rgba(${col},0.8)`);
    bg.fillStyle = vg; bg.fillRect(0, 0, dw, dh);
    BV.darkBase = b;
  }
  const d = BV.dctx;
  d.globalCompositeOperation = "copy";
  d.drawImage(BV.darkBase, 0, 0);
  d.globalCompositeOperation = "destination-out";
  const hole = (x, y, r, a, inner = 0.3) => {
    const g = d.createRadialGradient(x / q, y / q, 0, x / q, y / q, r / q);
    g.addColorStop(0, `rgba(0,0,0,${a})`);
    g.addColorStop(inner, `rgba(0,0,0,${a * 0.92})`);
    g.addColorStop(0.65, `rgba(0,0,0,${a * 0.42})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    d.fillStyle = g;
    d.fillRect((x - r) / q, (y - r) / q, (r * 2) / q, (r * 2) / q);
  };
  hole(lt.x, lt.y, lt.r1, 1, 0.32);
  for (const s of srcs) hole(s.x, s.y, s.r, s.a, 0.15);
  d.globalCompositeOperation = "source-over";
  vctx.imageSmoothingEnabled = true;
  vctx.drawImage(BV.dark, 0, 0, dw * q, dh * q);
}
// 灯の色を足す (加算)。角灯は暖色、魔法陣は青緑、毒は病んだ緑…
function drawBoardGlows(lt, srcs) {
  vctx.save();
  vctx.globalCompositeOperation = "lighter";
  const glow = (x, y, r, col, a) => {
    const g = vctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${col},${a})`);
    g.addColorStop(1, `rgba(${col},0)`);
    vctx.fillStyle = g;
    vctx.fillRect(x - r, y - r, r * 2, r * 2);
  };
  glow(lt.x, lt.y, lt.r1 * 0.8, G.eliteFloor ? "255,90,60" : "255,150,70", 0.15 * lt.fl);
  for (const s of srcs) glow(s.x, s.y, s.gr, s.col, s.ga);
  vctx.restore();
}

// ===== 盤面の1フレーム =====
// 駒の位置 (移動中は前マスから次マスへ補間)
function heroPos() {
  if (G.heroAnim) {
    const a = G.heroAnim;
    let t = Math.min(1, (performance.now() - a.t0) / a.dur);
    t = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const from = cellRect(a.fromX, a.fromY), to = cellRect(a.toX, a.toY);
    return [(from.x + from.w / 2) + ((to.x + to.w / 2) - (from.x + from.w / 2)) * t,
      (from.y + from.h / 2) + ((to.y + to.h / 2) - (from.y + from.h / 2)) * t];
  }
  const pr = cellRect(G.px, G.py);
  return [pr.x + pr.w / 2, pr.y + pr.h / 2];
}
function drawBoardFrame() {
  if (!G.board) return;
  const now = performance.now();
  ensureBoardScene();
  vctx.setTransform(1, 0, 0, 1, 0, 0);
  vctx.globalCompositeOperation = "copy";
  vctx.globalAlpha = 1;
  vctx.drawImage(boardSceneHi(), 0, 0);
  vctx.globalCompositeOperation = "source-over";
  viewTransform();
  vctx.imageSmoothingEnabled = false;
  const [hx, hy] = heroPos();
  const lt = boardLight(hx - CARD_W * 0.18, hy, now);
  const srcs = boardLightSources(now);
  drawBoardDarkness(lt, srcs);
  drawBoardGlows(lt, srcs);
  drawBoardTerrainFx(now);
  drawCandleFlames(now);
  drawBoardHighlights(now);
  drawBoardIcons(lt, now, hx, hy);
  drawFlipSlab(now);
  drawWallFlash(now);
  drawWalker(hx, hy, now);
  drawBoardParticles(lt, now);
  vctx.globalCompositeOperation = "source-over";
  vctx.globalAlpha = 1;
}

// 地形の動き (闇の上に描く = 闇の中でもぼうっと光る): 毒の汚泥の照り・泡・瘴気
function drawBoardTerrainFx(now) {
  const cells = G.board.cells;
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const c = cells[y][x];
    if (!c.revealed || c.type !== "poison") continue;
    const r = cellRect(x, y), cx = r.x + r.w / 2, cy = r.y + r.h * 0.55;
    const t = REDUCED_MOTION ? 0 : now * 0.001;
    // 汚泥の照り (ゆっくり脈打つ)
    vctx.save();
    vctx.globalCompositeOperation = "lighter";
    const sh = 0.5 + 0.5 * Math.sin(t * 1.7 + x);
    const g = vctx.createRadialGradient(cx, cy, 0, cx, cy, r.w * 0.42);
    g.addColorStop(0, `rgba(120,200,40,${0.12 + 0.08 * sh})`);
    g.addColorStop(1, "rgba(120,200,40,0)");
    vctx.fillStyle = g;
    vctx.save(); vctx.translate(cx, cy); vctx.scale(1, (r.h * 0.3) / (r.w * 0.42)); vctx.translate(-cx, -cy);
    vctx.fillRect(cx - r.w * 0.42, cy - r.w * 0.42, r.w * 0.84, r.w * 0.84);
    vctx.restore();
    vctx.restore();
    // 弾ける泡
    for (let i = 0; i < 8; i++) {
      const ph = (t * (0.45 + h01(i, x * 9 + y) * 0.6) + h01(i, 3)) % 1;
      const bx = cx + (h01(i, x + y * 8) - 0.5) * r.w * 0.6, by = cy + (h01(i + 7, x * 3 + y) - 0.5) * r.h * 0.4;
      const rad = 0.8 + ph * 2.4;
      vctx.globalAlpha = (1 - ph) * 0.95;
      vctx.strokeStyle = "#c8f070";
      vctx.lineWidth = 0.9;
      vctx.beginPath(); vctx.arc(bx, by - ph * 2, rad, 0, Math.PI * 2); vctx.stroke();
      vctx.fillStyle = "rgba(230,255,170,0.8)";
      vctx.fillRect(bx - rad * 0.4, by - ph * 2 - rad * 0.5, 0.8, 0.8);
    }
    // 立ちのぼる瘴気
    for (let i = 0; i < 3; i++) {
      const ph = (t * 0.22 + i / 3) % 1;
      const mx = cx + Math.sin(t * 0.9 + i * 2.1) * r.w * 0.18, my = cy - ph * r.h * 0.5;
      const mg = vctx.createRadialGradient(mx, my, 0, mx, my, 9 + ph * 6);
      mg.addColorStop(0, `rgba(110,170,50,${0.16 * Math.sin(ph * Math.PI)})`);
      mg.addColorStop(1, "rgba(110,170,50,0)");
      vctx.globalAlpha = 1;
      vctx.fillStyle = mg;
      vctx.fillRect(mx - 16, my - 16, 32, 32);
    }
    vctx.globalAlpha = 1;
  }
}

// 蝋燭の炎 (踏破したマスのみ)
function drawCandleFlames(now) {
  const cells = G.board.cells;
  for (const c of BV.art.candles) {
    if (!cells[c.cy][c.cx].revealed) continue;
    const f = REDUCED_MOTION ? 0 : Math.sin(now * 0.017 + c.x * 3.1) * 0.5 + Math.sin(now * 0.041 + c.y) * 0.3;
    const h = 3.2 + f * 0.8, sway = REDUCED_MOTION ? 0 : Math.sin(now * 0.007 + c.x) * 0.5;
    vctx.fillStyle = "rgba(255,140,40,0.85)";
    vctx.beginPath();
    vctx.ellipse(c.x + sway * 0.5, c.y - h * 0.45, 1.25, h * 0.6, 0, 0, Math.PI * 2);
    vctx.fill();
    vctx.fillStyle = "rgba(255,236,170,0.95)";
    vctx.beginPath();
    vctx.ellipse(c.x + sway * 0.3, c.y - h * 0.3, 0.6, h * 0.32, 0, 0, Math.PI * 2);
    vctx.fill();
  }
}

// めくれる墓石の霊光 (隣接=脈打つ縁取り / 遠隔=淡い縁)
function drawBoardHighlights(now) {
  if (G.state !== "board" || G.anim || G.walking) return;
  const reach = getReachableCells();
  const pulse = REDUCED_MOTION ? 0.6 : 0.5 + 0.5 * Math.sin(now * 0.0042);
  const senseE = partyPassiveLv("senseEnemy"), senseT = partyPassiveLv("senseTreasure");
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const cell = G.board.cells[y][x];
    if (cell.revealed) continue;
    const r = cellRect(x, y);
    if (reach.has(x + "," + y)) {
      vctx.save();
      if (isStep(x, y)) {
        vctx.fillStyle = `rgba(150,200,255,${0.05 + 0.05 * pulse})`;
        vctx.fillRect(r.x, r.y, r.w, r.h);
        vctx.strokeStyle = `rgba(110,170,255,${0.16 + 0.12 * pulse})`;
        vctx.lineWidth = 5;
        vctx.strokeRect(r.x - 0.5, r.y - 0.5, r.w + 1, r.h + 1);
        vctx.strokeStyle = `rgba(185,225,255,${0.7 + 0.3 * pulse})`;
        vctx.lineWidth = 1.4;
        vctx.strokeRect(r.x + 0.7, r.y + 0.7, r.w - 1.4, r.h - 1.4);
        // 角の楔
        vctx.fillStyle = `rgba(225,242,255,${0.75 + 0.25 * pulse})`;
        const k = 5;
        for (const [px, py, sx, sy] of [[r.x, r.y, 1, 1], [r.x + r.w, r.y, -1, 1], [r.x, r.y + r.h, 1, -1], [r.x + r.w, r.y + r.h, -1, -1]]) {
          vctx.beginPath(); vctx.moveTo(px, py); vctx.lineTo(px + k * sx, py); vctx.lineTo(px, py + k * sy); vctx.closePath(); vctx.fill();
        }
      } else {
        vctx.strokeStyle = "rgba(120,170,235,0.42)";
        vctx.lineWidth = 1;
        vctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
      }
      vctx.restore();
    }
    // 感知パッシブ: 敵感知 (!) / 財宝感知 (✦) の気配。Lv2: 強敵を強調・帰還陣も / Lv3: 属性色・罠も
    if (!cell.cleared) {
      let mark = null;
      if (senseE && cell.type === "monster") {
        const strong = senseE >= 2 && cell.elite;
        let color = strong ? "#ff3b30" : "#ff7a52";
        // 属性の暴走中は戦うまで属性が定まらないので色を付けない
        if (senseE >= 3 && !mutNum("elemRandom", false)) { const e2 = (MONSTERS[cell.monsterKey] || {}).element; const ec = (ELEMENTS[e2] || {}).color; if (ec) color = ec; }
        mark = { text: strong ? "‼" : "!", color };
      } else if (senseT) {
        if (cell.type === "chest") mark = { text: "✦", color: "#ffd84a" };
        else if (senseT >= 2 && cell.type === "portal") mark = { text: "◎", color: "#6fe0d0" };
        else if (senseT >= 3 && cell.type === "trap") mark = { text: "▲", color: "#ff7a5e" };
      }
      if (mark) {
        const bob = REDUCED_MOTION ? 0 : Math.sin(now * 0.003 + x * 2 + y) * 1.2;
        const mx = r.x + r.w - 9, my = r.y + 10 + bob;
        vctx.save();
        vctx.fillStyle = "rgba(6,4,6,0.82)";
        vctx.beginPath(); vctx.arc(mx, my, 6.5, 0, Math.PI * 2); vctx.fill();
        vctx.strokeStyle = mark.color; vctx.globalAlpha = 0.85; vctx.lineWidth = 1;
        vctx.stroke();
        vctx.globalAlpha = 1;
        vctx.shadowColor = mark.color; vctx.shadowBlur = 6;
        vctx.fillStyle = mark.color;
        vctx.font = `800 9px ${CANVAS_SERIF}`;
        vctx.textAlign = "center"; vctx.textBaseline = "middle";
        vctx.fillText(mark.text, mx, my + 0.5);
        vctx.restore();
      }
    }
  }
}

// ===== マスの中身 (魔物・宝箱・罠・泉・死体・魔法陣・階段) =====
// アイコンは闇の上に描き、角灯から遠いほど暗い写しへ寄せる (遠くの物も形は読める)
const _plainBmp = new WeakMap();
function plainBitmap(spr) {
  let b = _plainBmp.get(spr);
  if (b) return b;
  const rows = spr.art || [];
  const h = rows.length, w = rows.reduce((m, r) => Math.max(m, r.length), 0);
  const c = document.createElement("canvas");
  c.width = Math.max(1, w); c.height = Math.max(1, h);
  const g = c.getContext("2d");
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ch = rows[y][x];
    if (!ch || ch === "." || ch === " ") continue;
    const col = spr.palette[ch];
    if (!col) continue;
    g.fillStyle = col;
    g.fillRect(x, y, 1, 1);
  }
  b = { c, w, h, pad: 0 };
  _plainBmp.set(spr, b);
  return b;
}
const _dimBmp = new WeakMap();
function dimBitmap(b) {
  let d = _dimBmp.get(b.c);
  if (d) return d;
  const c = document.createElement("canvas");
  c.width = b.c.width; c.height = b.c.height;
  const g = c.getContext("2d");
  g.drawImage(b.c, 0, 0);
  g.globalCompositeOperation = "source-atop";
  g.fillStyle = "rgba(4,3,8,0.62)";
  g.fillRect(0, 0, c.width, c.height);
  d = { c, w: b.w, h: b.h, pad: b.pad };
  _dimBmp.set(b.c, d);
  return d;
}
// ビットマップを箱 (maxW×maxH) に収めて、足元 (bottom) を基準に描く。light<1 なら暗い写しと混ぜる
function drawBmpFit(b, cx, bottom, maxW, maxH, light = 1, alpha = 1) {
  const dot = Math.min(maxW / (b.w + b.pad * 2), maxH / (b.h + b.pad * 2));
  const W = (b.w + b.pad * 2) * dot, H = (b.h + b.pad * 2) * dot;
  const x = cx - W / 2, y = bottom - H;
  vctx.save();
  vctx.imageSmoothingEnabled = dot * VSX < 1.6;
  if (vctx.imageSmoothingEnabled) vctx.imageSmoothingQuality = "high";
  if (light < 0.98) {
    vctx.globalAlpha = alpha;
    vctx.drawImage(dimBitmap(b).c, x, y, W, H);
    vctx.globalAlpha = alpha * Math.max(0, light);
  } else vctx.globalAlpha = alpha;
  if (vctx.globalAlpha > 0.01) vctx.drawImage(b.c, x, y, W, H);
  vctx.restore();
  return { x, y, W, H };
}
// 主の待つ最深部の階段は、主の間の扉として描く
function bossDoorHere() {
  const dn = G.board && curDungeon();
  return !!(dn && dn.boss && G.floor >= dn.floors);
}
function cellIcon(cell) {
  return cell.type === "monster" && !cell.cleared ? MONSTERS[cell.monsterKey] :
    cell.type === "chest" ? (cell.cleared ? ICONS.chestOpen : ICONS.chest) :
    cell.type === "trap" && !cell.cleared ? ICONS.trap :
    cell.type === "fountain" && !cell.cleared ? ICONS.fountain :
    cell.type === "corpse" ? ICONS.corpse :
    cell.type === "portal" ? ICONS.portal :
    cell.type === "stairs" ? (bossDoorHere() ? ICONS.bossDoor : ICONS.stairs) :
    cell.type === "event" && !cell.cleared ? ICONS.event : null;
}
function drawBoardIcons(lt, now, hx, hy) {
  const cells = G.board.cells;
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const cell = cells[y][x];
    if (!cell.revealed) continue;
    if (G.flipAnim && G.flipAnim.x === x && G.flipAnim.y === y && now - G.flipAnim.t0 < G.flipAnim.dur * 0.45) continue;
    const icon = cellIcon(cell);
    if (!icon) continue;
    const r = cellRect(x, y);
    // 駒と同じマスなら、中身を右奥へ寄せて駒と重ならないようにする
    const here = x === G.px && y === G.py && !G.heroAnim;
    let cx = r.x + r.w / 2 + (here ? r.w * 0.2 : 0);
    const light = 0.35 + 0.65 * Math.max(lightAt(lt, cx, r.y + r.h / 2), cell.type === "portal" ? 0.6 : 0);
    if (cell.type === "portal") {
      // 床に刻まれた魔法陣 (ゆっくり回る青緑の環)
      const cy = r.y + r.h * 0.62, rx = r.w * 0.4, ry = Math.min(r.h * 0.16, rx * 0.45);
      const rot = REDUCED_MOTION ? 0 : now * 0.0006;
      vctx.save();
      vctx.strokeStyle = "rgba(110,235,240,0.7)"; vctx.lineWidth = 1;
      vctx.beginPath(); vctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); vctx.stroke();
      vctx.strokeStyle = "rgba(110,235,240,0.35)";
      vctx.beginPath(); vctx.ellipse(cx, cy, rx * 0.72, ry * 0.72, 0, 0, Math.PI * 2); vctx.stroke();
      vctx.fillStyle = "rgba(170,250,250,0.85)";
      for (let i = 0; i < 8; i++) {
        const a = rot + (i / 8) * Math.PI * 2;
        vctx.fillRect(cx + Math.cos(a) * rx * 0.86 - 0.7, cy + Math.sin(a) * ry * 0.86 - 0.7, 1.4, 1.4);
      }
      vctx.restore();
    }
    if (cell.type === "monster") {
      // 魔物: 足元に血の気配。強敵は紅い瘴気をまとい「強敵」の札を掲げる
      const b = monsterBitmap(icon);
      const bottom = r.y + r.h * 0.9;
      vctx.save();
      vctx.globalCompositeOperation = "lighter";
      const pulse = REDUCED_MOTION ? 0.5 : 0.5 + 0.5 * Math.sin(now * 0.0035 + x);
      const g = vctx.createRadialGradient(cx, bottom - r.h * 0.12, 0, cx, bottom - r.h * 0.12, r.w * 0.55);
      g.addColorStop(0, `rgba(${cell.elite ? "220,30,20" : "150,20,14"},${0.22 + 0.12 * pulse})`);
      g.addColorStop(1, "rgba(150,20,14,0)");
      vctx.fillStyle = g; vctx.fillRect(r.x - 6, r.y, r.w + 12, r.h);
      vctx.restore();
      vctx.fillStyle = "rgba(0,0,0,0.5)";
      vctx.beginPath(); vctx.ellipse(cx, bottom - 1, r.w * 0.34, 3.4, 0, 0, Math.PI * 2); vctx.fill();
      drawBmpFit(b, cx, bottom, r.w * (here ? 0.62 : 0.94), r.h * (here ? 0.58 : 0.78), light);
      if (cell.elite) {
        vctx.save();
        vctx.fillStyle = "rgba(70,4,4,0.92)";
        vctx.fillRect(r.x + 3, r.y + 3, r.w - 6, 11);
        vctx.strokeStyle = "rgba(255,90,70,0.85)"; vctx.lineWidth = 0.8;
        vctx.strokeRect(r.x + 3.5, r.y + 3.5, r.w - 7, 10);
        vctx.fillStyle = "#ffc9b8";
        vctx.font = `800 8px ${CANVAS_SERIF}`;
        vctx.textAlign = "center"; vctx.textBaseline = "middle";
        vctx.fillText("強 敵", r.x + r.w / 2, r.y + 8.5);
        vctx.restore();
      }
      continue;
    }
    const b = plainBitmap(icon);
    const size = Math.min(r.w * (here ? 0.62 : 0.86), r.h * (here ? 0.5 : 0.62));
    const bottom = r.y + r.h / 2 + size / 2 + r.h * 0.04;
    vctx.fillStyle = "rgba(0,0,0,0.42)";
    vctx.beginPath(); vctx.ellipse(cx, bottom - size * 0.08, size * 0.42, 3, 0, 0, Math.PI * 2); vctx.fill();
    drawBmpFit(b, cx, bottom, size, size, light);
    // まだあたたかい死体 (魂未回収) には青い人魂
    if (cell.type === "corpse" && cell.corpseWarm && !cell.cleared) {
      const bob = REDUCED_MOTION ? 0 : Math.sin(now * 0.004 + cx) * 2;
      drawBmpFit(plainBitmap(ICONS.wisp), cx + size * 0.22, bottom - size * 0.62 + bob, size * 0.5, size * 0.5, 1, 0.92);
    }
    // 宝箱のきらめき
    if (cell.type === "chest" && !cell.cleared && !REDUCED_MOTION) {
      const ph = (now * 0.0011 + x * 0.37 + y * 0.21) % 1;
      if (ph < 0.22) {
        const k = Math.sin((ph / 0.22) * Math.PI);
        const sx = cx - size * 0.18 + h01(Math.floor(now * 0.0011 + x), y) * size * 0.36, sy = bottom - size * 0.55;
        vctx.save();
        vctx.globalCompositeOperation = "lighter";
        vctx.strokeStyle = `rgba(255,236,170,${0.9 * k})`;
        vctx.lineWidth = 0.8;
        vctx.beginPath();
        vctx.moveTo(sx - 3.5 * k, sy); vctx.lineTo(sx + 3.5 * k, sy);
        vctx.moveTo(sx, sy - 3.5 * k); vctx.lineTo(sx, sy + 3.5 * k);
        vctx.stroke();
        vctx.restore();
      }
    }
  }
}

// めくった墓石の蓋: 進む向きへずらしながら持ち上げ、薄れて消える (+ 舞い上がる塵)
function drawFlipSlab(now) {
  const f = G.flipAnim;
  if (!f || !BV.art) return;
  const r = cellRect(f.x, f.y);
  if (BV.flipSeen !== f) {
    BV.flipSeen = f;
    for (let i = 0; i < 22; i++) {
      const side = i % 4, u = Math.random();
      const px = side === 0 ? r.x + u * r.w : side === 1 ? r.x + r.w : side === 2 ? r.x + u * r.w : r.x;
      const py = side === 0 ? r.y : side === 1 ? r.y + u * r.h : side === 2 ? r.y + r.h : r.y + u * r.h;
      const a = Math.atan2(py - (r.y + r.h / 2), px - (r.x + r.w / 2));
      const sp = 0.012 + Math.random() * 0.03;
      BV.parts.push({ x: px, y: py, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.006, t0: now, life: 500 + Math.random() * 500, s: 0.8 + Math.random() * 1.6 });
    }
  }
  const t = Math.min(1, (now - f.t0) / f.dur);
  if (t >= 1) return;
  const dx = Math.sign(f.x - G.px), dy = Math.sign(f.y - G.py);
  const e = t * t * (3 - 2 * t);
  const lift = Math.sin(t * Math.PI);
  const ox = dx * e * r.w * 0.55, oy = dy * e * r.h * 0.4 - lift * 4;
  const sc = 1 + lift * 0.07;
  const a = 1 - Math.pow(t, 1.7);
  vctx.save();
  vctx.globalAlpha = 0.5 * a;
  vctx.fillStyle = "#000";
  vctx.fillRect(r.x + ox + 2 + lift * 5, r.y + oy + 4 + lift * 7, r.w, r.h);
  vctx.globalAlpha = a;
  vctx.imageSmoothingEnabled = false;
  const W = r.w * sc, H = r.h * sc;
  vctx.drawImage(BV.art.slabs, r.x, r.y, r.w, r.h, r.x + r.w / 2 - W / 2 + ox, r.y + r.h / 2 - H / 2 + oy, W, H);
  vctx.restore();
}

// 進めない方向へ動こうとした時の紅い閃き (塞いでいる壁)
function drawWallFlash(now) {
  const wf = G.wallFlash;
  if (!wf) return;
  const t = (now - wf.t0) / 350;
  if (t > 1) { G.wallFlash = null; return; }
  const r = cellRect(wf.x, wf.y), half = GAP / 2;
  let bx, by, bw, bh;
  if (wf.dir === "n") { bx = r.x - half; by = r.y - half - 3; bw = r.w + GAP; bh = 6; }
  else if (wf.dir === "s") { bx = r.x - half; by = r.y + r.h + half - 3; bw = r.w + GAP; bh = 6; }
  else if (wf.dir === "w") { bx = r.x - half - 3; by = r.y - half; bw = 6; bh = r.h + GAP; }
  else { bx = r.x + r.w + half - 3; by = r.y - half; bw = 6; bh = r.h + GAP; }
  const k = 1 - t;
  vctx.save();
  vctx.shadowColor = "rgba(255,40,30,0.95)";
  vctx.shadowBlur = 12 * k;
  vctx.fillStyle = `rgba(255,70,50,${0.45 + 0.5 * k})`;
  vctx.fillRect(bx, by, bw, bh);
  vctx.restore();
}

// 手番の駒 (先頭の人業の全身像)。足元に影、背に角灯の照り返し
function drawWalker(hx, hy, now) {
  const wk = walkerSprite();
  if (uiDungeonHud.walkerArt()) { drawHoodedWalker(wk, hx, hy, now); return; }
  const b = monsterBitmap(wk);
  const hi = (wk.art || []).length > 24;
  const cur = G.board.cells[G.py] && G.board.cells[G.py][G.px];
  const share = !G.heroAnim && cur && !!cellIcon(cur); // 中身のあるマスでは左手前へ寄る
  const x = hx - (share ? CARD_W * 0.2 : 0);
  const maxH = hi ? Math.min(CARD_H * (share ? 0.86 : 0.94), 110) : Math.min(CARD_W * 0.78, CARD_H * 0.66);
  const feet = hy + (hi ? CARD_H * 0.44 : CARD_H * 0.3);
  // 影
  vctx.save();
  vctx.fillStyle = "rgba(0,0,0,0.3)";
  vctx.beginPath(); vctx.ellipse(x, feet - 1, CARD_W * 0.36, 5, 0, 0, Math.PI * 2); vctx.fill();
  vctx.fillStyle = "rgba(0,0,0,0.55)";
  vctx.beginPath(); vctx.ellipse(x, feet - 1, CARD_W * 0.22, 3, 0, 0, Math.PI * 2); vctx.fill();
  vctx.restore();
  const box = drawBmpFit(b, x, feet + 1, hi ? CARD_W * 1.1 : maxH, maxH);
  drawHandLantern(x - box.W * (hi ? 0.36 : 0.42) - 2, box.y + box.H * (hi ? 0.5 : 0.56), now);
}
// 赤い頭巾の人影 (4方向)。端末の画素の格子に整数倍で置き、補間なしでくっきり描く。
// 高さは墓石の約8割。足元に影、手の角灯が光の輪の源。待機中は2コマでわずかに上下し、歩く時は小さく弾む
function drawHoodedWalker(wk, hx, hy, now) {
  const b = monsterBitmap(wk);
  const cur = G.board.cells[G.py] && G.board.cells[G.py][G.px];
  const share = !G.heroAnim && cur && !!cellIcon(cur); // 中身のあるマスでは左手前へ寄る
  const x = hx - (share ? CARD_W * 0.2 : 0);
  const rows = b.h + b.pad * 2, cols = b.w + b.pad * 2;
  // 整数の拡大率 (端末の画素単位)。墓石の高さの 72〜88% に収まる整数倍を選ぶ
  const want = CARD_H * 0.8 * VSY / rows;
  const kMax = Math.max(1, Math.floor(CARD_H * 0.9 * VSY / rows));
  const k = Math.max(1, Math.min(kMax, Math.round(want)));
  const Wd = cols * k, Hd = rows * k;              // 端末の画素での寸法
  const W = Wd / VSX, H = Hd / VSY;                // 論理座標での寸法
  const feet = hy + CARD_H * 0.42;
  // 待機の2コマ (約0.6秒ごとに1ドット) / 歩みの弾み
  let bob = 0;
  if (G.heroAnim) {
    const t = Math.min(1, (performance.now() - G.heroAnim.t0) / Math.max(1, G.heroAnim.dur));
    bob = REDUCED_MOTION ? 0 : -Math.round(Math.sin(t * Math.PI) * 1.5) * k;
  } else if (!REDUCED_MOTION) bob = (Math.floor(now / 620) % 2) ? -k : 0;
  // 影
  vctx.save();
  vctx.fillStyle = "rgba(0,0,0,0.32)";
  vctx.beginPath(); vctx.ellipse(x, feet - 1, Math.max(CARD_W * 0.3, W * 0.42), 5, 0, 0, Math.PI * 2); vctx.fill();
  vctx.fillStyle = "rgba(0,0,0,0.55)";
  vctx.beginPath(); vctx.ellipse(x, feet - 1, Math.max(CARD_W * 0.18, W * 0.26), 3, 0, 0, Math.PI * 2); vctx.fill();
  vctx.restore();
  // 端末の画素の格子へ吸着させて、整数倍・補間なしで描く
  const dx = Math.round(x * VSX - Wd / 2);
  const dy = Math.round((feet + 1) * VSY - Hd) + bob;
  vctx.save();
  vctx.setTransform(1, 0, 0, 1, 0, 0);
  vctx.imageSmoothingEnabled = false;
  vctx.drawImage(b.c, dx, dy, Wd, Hd);
  vctx.restore();
  viewTransform();
  // 手に提げた角灯の灯り (絵に描かれた灯の位置に、揺らぐ光暈だけを重ねる。籠は絵のものを使う)
  const lp = walkerLampSpot(wk);
  drawLanternGlow((dx + (b.pad + lp.x + 0.5) * k) / VSX, (dy + (b.pad + lp.y + 0.5) * k) / VSY, now);
}
// 駒の絵の中の灯 (下半分にある明るい黄の点の重心)。向きごとに一度だけ求める
const _lampSpot = new WeakMap();
function walkerLampSpot(wk) {
  let s = _lampSpot.get(wk);
  if (s) return s;
  const rows = wk.art || [];
  let sx = 0, sy = 0, n = 0;
  rows.forEach((r, y) => {
    if (y < rows.length * 0.45) return;
    for (let x = 0; x < r.length; x++) {
      const c = wk.palette[r[x]];
      if (!c || c[0] !== "#") continue;
      const v = parseInt(c.slice(1), 16), R = v >> 16, Gc = (v >> 8) & 255, B = v & 255;
      if (R > 220 && Gc > 170 && B < 160) { sx += x; sy += y; n++; }
    }
  });
  s = n ? { x: sx / n, y: sy / n } : { x: 3, y: rows.length * 0.6 };
  _lampSpot.set(wk, s);
  return s;
}
// 角灯の光暈だけ (揺らぎ付き)
function drawLanternGlow(x, y, now) {
  const fl = REDUCED_MOTION ? 1 : 0.85 + 0.15 * Math.sin(now * 0.019) * Math.sin(now * 0.007 + 1);
  vctx.save();
  vctx.globalCompositeOperation = "lighter";
  const g = vctx.createRadialGradient(x, y, 0, x, y, 15);
  g.addColorStop(0, `rgba(255,190,90,${0.5 * fl})`);
  g.addColorStop(1, "rgba(255,150,60,0)");
  vctx.fillStyle = g;
  vctx.fillRect(x - 15, y - 15, 30, 30);
  vctx.restore();
}
// 手提げの角灯 (光の輪の源): 鉄の籠と煤けた硝子、ゆるく揺れる
function drawHandLantern(x, y, now) {
  const sw = REDUCED_MOTION ? 0 : Math.sin(now * 0.0021) * 0.12;
  const fl = REDUCED_MOTION ? 1 : 0.85 + 0.15 * Math.sin(now * 0.019) * Math.sin(now * 0.007 + 1);
  vctx.save();
  vctx.translate(x, y);
  vctx.rotate(sw);
  // 吊り鎖
  vctx.fillStyle = "#2a2622";
  vctx.fillRect(-0.5, -6, 1, 4);
  // 光暈
  vctx.save();
  vctx.globalCompositeOperation = "lighter";
  const g = vctx.createRadialGradient(0, 3, 0, 0, 3, 14);
  g.addColorStop(0, `rgba(255,190,90,${0.55 * fl})`);
  g.addColorStop(1, "rgba(255,150,60,0)");
  vctx.fillStyle = g;
  vctx.fillRect(-14, -11, 28, 28);
  vctx.restore();
  // 籠
  vctx.fillStyle = "#0d0b0a";
  vctx.fillRect(-3.5, -2.5, 7, 10);
  vctx.fillStyle = `rgba(255,${Math.round(190 + 40 * fl)},120,1)`;
  vctx.fillRect(-2.5, -1, 5, 7);
  vctx.fillStyle = "#fff4cc";
  vctx.fillRect(-0.8, 1 + (1 - fl) * 2, 1.6, 3);
  vctx.fillStyle = "#3a332c";
  vctx.fillRect(-3.5, -2.5, 7, 1.5);
  vctx.fillRect(-3.5, 6, 7, 1.5);
  vctx.fillRect(-0.4, -1, 0.8, 7);
  vctx.restore();
}

// 塵: めくった蓋から舞う砂埃と、角灯の光の中を漂う微塵
function drawBoardParticles(lt, now) {
  if (BV.parts.length) {
    vctx.save();
    BV.parts = BV.parts.filter((p) => now - p.t0 < p.life);
    for (const p of BV.parts) {
      const t = now - p.t0, k = 1 - t / p.life;
      const x = p.x + p.vx * t, y = p.y + p.vy * t + 0.00001 * t * t;
      vctx.globalAlpha = 0.55 * k;
      vctx.fillStyle = "#b8a88a";
      vctx.fillRect(x, y, p.s, p.s);
    }
    vctx.restore();
  }
  if (REDUCED_MOTION) return;
  vctx.save();
  vctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 46; i++) {
    const sp = 0.4 + h01(i, 1) * 0.9;
    const x = h01(i, 2) * VW + Math.sin(now * 0.00035 * sp + i * 2.3) * 12;
    const y = (((h01(i, 3) * VH - now * 0.0065 * sp) % VH) + VH) % VH;
    const l = lightAt(lt, x, y);
    if (l <= 0.02) continue;
    const tw = 0.55 + 0.45 * Math.sin(now * 0.0031 + i * 1.7);
    vctx.globalAlpha = l * tw * 0.5;
    vctx.fillStyle = "#ffd9a0";
    const s = 0.7 + h01(i, 4) * 0.9;
    vctx.fillRect(x, y, s, s);
  }
  // 床を這う靄: ふだんは冷たい灰、強敵階は紅、特別階はその色 (柔らかな楕円の絵を一度だけ作って流す)
  const sp = specialDef();
  const col = G.eliteFloor ? "200,20,20" : sp ? (() => { const c = hexRgb(sp.accent); return `${c[0]},${c[1]},${c[2]}`; })() : "150,160,178";
  const a = G.eliteFloor ? 0.09 : sp ? 0.06 : 0.045;
  const mist = mistSprite(col, a);
  vctx.globalCompositeOperation = "source-over";
  vctx.globalAlpha = 1;
  vctx.imageSmoothingEnabled = true;
  for (let i = 0; i < 6; i++) {
    const w = 160 + h01(i, 5) * 120, span = VW + w * 2;
    const x = ((h01(i, 6) * span + now * 0.006 * (0.5 + h01(i, 7))) % span) - w;
    const y = VH * (0.12 + 0.15 * i);
    vctx.drawImage(mist, x - w / 2, y - w * 0.175, w, w * 0.35);
  }
  vctx.restore();
}
const _mist = new Map();
function mistSprite(col, a) {
  const key = col + "|" + a;
  let c = _mist.get(key);
  if (c) return c;
  c = document.createElement("canvas");
  c.width = 128; c.height = 48;
  const g = c.getContext("2d");
  g.translate(64, 24); g.scale(1, 48 / 128);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, 64);
  gr.addColorStop(0, `rgba(${col},${a})`);
  gr.addColorStop(1, `rgba(${col},0)`);
  g.fillStyle = gr;
  g.fillRect(-64, -64, 128, 128);
  _mist.set(key, c);
  return c;
}

// 盤面の常時アニメーション: 灯の揺らぎ・微塵・霊光を毎フレーム動かす (重い層はキャッシュ済み)。
// 移動/めくり/壁の閃きの間はそれぞれの tick が描くので、ここでは描かない。背面タブでは rAF ごと止まる
// 操作の直後 (1.5秒) は毎フレーム描き、静止が続けば灯の揺らぎだけ約30fpsに間引く (電池と余力のため)。
// 1フレームの描画が重い端末でも同じく間引く
let _boardIdleCost = 0, _boardIdleSkip = false, _boardActiveAt = 0;
function boardAnimLoop(ts) {
  requestAnimationFrame(boardAnimLoop);
  if (G.state !== "board" || !G.board) return;
  if (G.anim || G.flipAnim || G.heroAnim || G.wallFlash) return; // 他の tick に任せる
  if (uiBlocked()) return;        // オーバーレイ表示中は不要
  if (_boardIdleCost > 9 || ts - _boardActiveAt > 1500) { _boardIdleSkip = !_boardIdleSkip; if (_boardIdleSkip) return; }
  const t0 = performance.now();
  drawBoardFrame();
  _boardIdleCost = _boardIdleCost * 0.9 + (performance.now() - t0) * 0.1;
}
requestAnimationFrame(boardAnimLoop);

// テーマ色のカード裏面 (特別階・迷宮テーマで共用): 地のグラデ + 二重枠 + 中央紋章 + コーナードット
function drawThemedBack(r, accent, sym) {
  const bg = vctx.createLinearGradient(0, 0, r.w, r.h);
  bg.addColorStop(0, shadeHex(accent, 0.24));
  bg.addColorStop(0.5, shadeHex(accent, 0.14));
  bg.addColorStop(1, shadeHex(accent, 0.09));
  vctx.fillStyle = bg;
  vctx.fillRect(0, 0, r.w, r.h);
  vctx.strokeStyle = shadeHex(accent, 0.78);
  vctx.lineWidth = 2;
  vctx.strokeRect(1.5, 1.5, r.w - 3, r.h - 3);
  vctx.strokeStyle = shadeHex(accent, 0.42);
  vctx.lineWidth = 1;
  vctx.strokeRect(4.5, 4.5, r.w - 9, r.h - 9);
  const cx = r.w / 2, cy = r.h / 2;
  vctx.fillStyle = accent;
  vctx.font = "bold 16px monospace";
  vctx.textAlign = "center";
  vctx.textBaseline = "middle";
  vctx.fillText(sym || "✦", cx, cy + 1);
  vctx.fillStyle = shadeHex(accent, 0.6);
  for (const [dx, dy] of [[7, 7], [r.w - 7, 7], [7, r.h - 7], [r.w - 7, r.h - 7]]) {
    vctx.beginPath(); vctx.arc(dx, dy, 1.6, 0, Math.PI * 2); vctx.fill();
  }
  vctx.fillStyle = "rgba(255,255,255,0.08)";
  vctx.fillRect(2, 2, r.w - 4, 3);
}

// 層20「終焉の玄室」のカード裏面: 頭上に渦巻く終焉の裂け目、虚無の玉座、紫の篝火、漂う虚無の塵
function drawBackThrone(r, accent, sym) {
  const W = r.w, H = r.h, t = performance.now();
  // 終焉の地 (虚無の紫闇)
  const bg = vctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#110a16");
  bg.addColorStop(0.5, "#0e0813");
  bg.addColorStop(1, "#0b0610");
  vctx.fillStyle = bg;
  vctx.fillRect(0, 0, W, H);

  // 頭上の終焉の裂け目 (脈打つ紫の渦)
  const rx = W / 2, ry = 12, pulse = 0.75 + 0.25 * Math.sin(t * 0.002);
  const rift = vctx.createRadialGradient(rx, ry, 1, rx, ry, 16);
  rift.addColorStop(0, `rgba(190,120,235,${0.5 * pulse})`);
  rift.addColorStop(0.5, `rgba(120,60,170,${0.25 * pulse})`);
  rift.addColorStop(1, "rgba(120,60,170,0)");
  vctx.fillStyle = rift;
  vctx.fillRect(rx - 16, ry - 14, 32, 28);
  // 渦の螺旋 (ゆっくり回転)
  vctx.save();
  vctx.translate(rx, ry); vctx.rotate(t * 0.0004);
  vctx.strokeStyle = "rgba(210,160,250,0.4)"; vctx.lineWidth = 0.8;
  vctx.beginPath();
  for (let a = 0; a < Math.PI * 4; a += 0.3) {
    const rr = a * 0.9, px = Math.cos(a) * rr, py = Math.sin(a) * rr * 0.7;
    if (a === 0) vctx.moveTo(px, py); else vctx.lineTo(px, py);
  }
  vctx.stroke();
  vctx.restore();

  // 玉座の壇 (階段状)
  vctx.fillStyle = "#1a1422"; vctx.fillRect(W / 2 - 16, H - 6, 32, 6);
  vctx.fillStyle = "#221a2c"; vctx.fillRect(W / 2 - 12, H - 11, 24, 5);
  vctx.fillStyle = "#281e34"; vctx.fillRect(W / 2 - 9, H - 15, 18, 4);

  // 玉座 (高い背もたれと棘)
  const tx = W / 2, seatY = H - 15, backTop = 22;
  const th = vctx.createLinearGradient(tx - 8, 0, tx + 8, 0);
  th.addColorStop(0, "#1c1526"); th.addColorStop(0.5, "#332542"); th.addColorStop(1, "#160f1e");
  vctx.fillStyle = th;
  vctx.fillRect(tx - 7, backTop, 14, seatY - backTop);
  // 棘
  vctx.beginPath();
  vctx.moveTo(tx - 7, backTop); vctx.lineTo(tx - 5, backTop - 6); vctx.lineTo(tx - 3, backTop);
  vctx.moveTo(tx - 2, backTop); vctx.lineTo(tx, backTop - 9); vctx.lineTo(tx + 2, backTop);
  vctx.moveTo(tx + 3, backTop); vctx.lineTo(tx + 5, backTop - 6); vctx.lineTo(tx + 7, backTop);
  vctx.closePath();
  vctx.fill();
  // 肘掛け
  vctx.fillRect(tx - 10, seatY - 6, 3, 7);
  vctx.fillRect(tx + 7, seatY - 6, 3, 7);
  // 縁の紫光
  vctx.fillStyle = "rgba(180,130,225,0.3)";
  vctx.fillRect(tx - 7, backTop, 1.2, seatY - backTop);
  // 座面に渦巻く虚無の光
  const seatGlow = vctx.createRadialGradient(tx, seatY - 3, 1, tx, seatY - 3, 7);
  seatGlow.addColorStop(0, `rgba(200,150,255,${0.45 * pulse})`);
  seatGlow.addColorStop(1, "rgba(200,150,255,0)");
  vctx.fillStyle = seatGlow;
  vctx.fillRect(tx - 8, seatY - 9, 16, 10);

  // 左右の篝火 (紫の焔が揺らめく)
  for (const bx of [10, W - 10]) {
    const flick = 0.7 + 0.3 * Math.sin(t * 0.011 + bx);
    vctx.fillStyle = "#2a2233"; vctx.fillRect(bx - 3, H - 14, 6, 3);
    vctx.fillStyle = "#1c1626"; vctx.fillRect(bx - 1.2, H - 26, 2.4, 12);
    const fh = 7 + flick * 3, sway = Math.sin(t * 0.018 + bx) * 1;
    vctx.save();
    vctx.shadowColor = "rgba(180,110,240,0.9)"; vctx.shadowBlur = 6 * flick;
    const fg = vctx.createLinearGradient(bx, H - 14 - fh, bx, H - 14);
    fg.addColorStop(0, "rgba(225,180,255,0.95)");
    fg.addColorStop(1, "rgba(140,70,200,0.6)");
    vctx.fillStyle = fg;
    vctx.beginPath();
    vctx.moveTo(bx, H - 14 - fh);
    vctx.quadraticCurveTo(bx + 2.5 + sway, H - 14 - fh * 0.4, bx, H - 14);
    vctx.quadraticCurveTo(bx - 2.5 + sway, H - 14 - fh * 0.4, bx, H - 14 - fh);
    vctx.closePath();
    vctx.fill();
    vctx.restore();
  }

  // 虚無の塵 (紫の粒が漂い昇る)
  for (let i = 0; i < 6; i++) {
    const px = (i * 39 + Math.sin(t * 0.0008 + i) * 6 + 7) % W;
    const py = (H - 6) - ((t * 0.009 + i * 36) % (H - 10));
    const al = 0.3 + 0.35 * Math.sin(t * 0.0028 + i * 1.4);
    vctx.fillStyle = `rgba(190,140,235,${Math.max(0, al) * 0.55})`;
    vctx.fillRect(px, py, 1, 1);
  }

  // 枠とコーナードット (テーマ共通の体裁を踏襲)
  vctx.strokeStyle = shadeHex(accent, 0.7);
  vctx.lineWidth = 2;
  vctx.strokeRect(1.5, 1.5, W - 3, H - 3);
  vctx.strokeStyle = shadeHex(accent, 0.36);
  vctx.lineWidth = 1;
  vctx.strokeRect(4.5, 4.5, W - 9, H - 9);
  vctx.fillStyle = shadeHex(accent, 0.6);
  for (const [dx, dy] of [[7, 7], [W - 7, 7], [7, H - 7], [W - 7, H - 7]]) {
    vctx.beginPath(); vctx.arc(dx, dy, 1.6, 0, Math.PI * 2); vctx.fill();
  }
  vctx.fillStyle = "rgba(255,255,255,0.05)";
  vctx.fillRect(2, 2, W - 4, 3);
}

// 層19「竜の巣」のカード裏面: 闇から覗く脈打つ古竜の眼、積み上がる財宝の山、立ちのぼる火の粉
function drawBackDragonNest(r, accent, sym) {
  const W = r.w, H = r.h, t = performance.now();
  // 竜窟の地 (熱い闇)
  const bg = vctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#1c0c08");
  bg.addColorStop(0.5, "#220e07");
  bg.addColorStop(1, "#2c1408");
  vctx.fillStyle = bg;
  vctx.fillRect(0, 0, W, H);

  // 竜の鱗の暗がり (上方を覆う暗い塊)
  vctx.fillStyle = "#1a0a07";
  for (const [cx, cy, rr] of [[10, 6, 10], [28, 3, 12], [46, 6, 10], [W - 2, 10, 9]]) {
    vctx.beginPath(); vctx.arc(cx, cy, rr, 0, Math.PI * 2); vctx.fill();
  }

  // 竜の眼 (上中央。脈打つ橙の輝きと縦のスリット瞳孔)
  const ex = W / 2, ey = 20, pulse = 0.8 + 0.2 * Math.sin(t * 0.0025);
  const eg = vctx.createRadialGradient(ex, ey, 1, ex, ey, 18);
  eg.addColorStop(0, `rgba(255,170,50,${0.5 * pulse})`);
  eg.addColorStop(1, "rgba(255,120,30,0)");
  vctx.fillStyle = eg;
  vctx.fillRect(ex - 18, ey - 14, 36, 28);
  const eye = vctx.createRadialGradient(ex, ey, 1, ex, ey, 11);
  eye.addColorStop(0, "#ffe07a"); eye.addColorStop(0.5, "#f0901e"); eye.addColorStop(1, "#9c3a08");
  vctx.fillStyle = eye;
  vctx.beginPath();
  vctx.moveTo(ex - 12, ey); vctx.quadraticCurveTo(ex, ey - 7, ex + 12, ey); vctx.quadraticCurveTo(ex, ey + 7, ex - 12, ey); vctx.closePath();
  vctx.fill();
  // 瞳孔 (縦のスリット)
  vctx.fillStyle = "#140805";
  vctx.beginPath();
  vctx.moveTo(ex, ey - 6); vctx.quadraticCurveTo(ex + 2, ey, ex, ey + 6); vctx.quadraticCurveTo(ex - 2, ey, ex, ey - 6); vctx.closePath();
  vctx.fill();
  vctx.fillStyle = "rgba(255,245,210,0.85)"; vctx.fillRect(ex + 2, ey - 3, 1.4, 1.4);
  // 上瞼の鱗 (眼に被さる暗い隆起)
  vctx.fillStyle = "#2a0f08";
  vctx.beginPath();
  vctx.moveTo(ex - 13, ey - 1); vctx.quadraticCurveTo(ex, ey - 9, ex + 13, ey - 1);
  vctx.lineTo(ex + 13, ey - 4); vctx.quadraticCurveTo(ex, ey - 12, ex - 13, ey - 4); vctx.closePath();
  vctx.fill();

  // 財宝の山 (下部に積もる金貨)
  const hoardY = H - 13;
  const hoard = vctx.createLinearGradient(0, hoardY, 0, H);
  hoard.addColorStop(0, "#d8a838"); hoard.addColorStop(1, "#6e4a12");
  vctx.fillStyle = hoard;
  vctx.beginPath();
  vctx.moveTo(0, H); vctx.lineTo(0, hoardY + 4);
  vctx.quadraticCurveTo(W * 0.25, hoardY - 3, W * 0.5, hoardY + 1);
  vctx.quadraticCurveTo(W * 0.75, hoardY + 4, W, hoardY - 2);
  vctx.lineTo(W, H); vctx.closePath();
  vctx.fill();
  vctx.fillStyle = "#b8862a";
  for (let i = 0; i < 14; i++) {
    const gx = (i * 37 + 5) % W, gy = hoardY + 2 + ((i * 13) % 9);
    vctx.fillRect(gx, gy, 2, 1.4);
  }
  // 金貨の輝き (明滅)
  for (let i = 0; i < 5; i++) {
    const tw = Math.sin(t * 0.005 + i * 1.7);
    if (tw > 0.5) {
      const gx = (i * 53 + 12) % W, gy = hoardY + 3 + ((i * 17) % 8);
      vctx.fillStyle = `rgba(255,240,180,${(tw - 0.5) * 1.8})`;
      vctx.fillRect(gx, gy - 0.5, 1.4, 1.4);
      vctx.fillRect(gx - 0.5, gy, 2.4, 0.5);
    }
  }

  // 立ちのぼる火の粉
  for (let i = 0; i < 5; i++) {
    const px = (i * 43 + Math.sin(t * 0.001 + i) * 5 + 8) % W;
    const py = hoardY - ((t * 0.014 + i * 40) % (hoardY - 6));
    const al = Math.max(0, 1 - (hoardY - py) / (hoardY - 6));
    vctx.fillStyle = `rgba(255,${140 + Math.floor(70 * al)},40,${al * 0.7})`;
    vctx.fillRect(px, py, 1, 1);
  }

  // 枠とコーナードット (テーマ共通の体裁を踏襲)
  vctx.strokeStyle = shadeHex(accent, 0.7);
  vctx.lineWidth = 2;
  vctx.strokeRect(1.5, 1.5, W - 3, H - 3);
  vctx.strokeStyle = shadeHex(accent, 0.36);
  vctx.lineWidth = 1;
  vctx.strokeRect(4.5, 4.5, W - 9, H - 9);
  vctx.fillStyle = shadeHex(accent, 0.6);
  for (const [dx, dy] of [[7, 7], [W - 7, 7], [7, H - 7], [W - 7, H - 7]]) {
    vctx.beginPath(); vctx.arc(dx, dy, 1.6, 0, Math.PI * 2); vctx.fill();
  }
  vctx.fillStyle = "rgba(255,255,255,0.05)";
  vctx.fillRect(2, 2, W - 4, 3);
}

// 層18「冥府の門」のカード裏面: 死者の国へ続く巨大な門扉、隙間から漏れる冥府の光、昇る亡者の魂
function drawBackHadesGate(r, accent, sym) {
  const W = r.w, H = r.h, t = performance.now();
  const bg = vctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#140d1a");
  bg.addColorStop(0.5, "#110b16");
  bg.addColorStop(1, "#0d0810");
  vctx.fillStyle = bg;
  vctx.fillRect(0, 0, W, H);

  const ax0 = 11, ax1 = W - 11, aSpring = 18, aApex = 8, cxm = W / 2, gap = 2.2;
  const archPath = () => {
    vctx.beginPath();
    vctx.moveTo(ax0, H); vctx.lineTo(ax0, aSpring);
    vctx.quadraticCurveTo(ax0, aApex, cxm, aApex);
    vctx.quadraticCurveTo(ax1, aApex, ax1, aSpring);
    vctx.lineTo(ax1, H); vctx.closePath();
  };

  // 開口部 (クリップ内): 冥府の光 → 門扉 → 隙間の煌めき
  vctx.save();
  archPath(); vctx.clip();
  const glow = vctx.createLinearGradient(0, aApex, 0, H);
  glow.addColorStop(0, "rgba(180,120,240,0.5)");
  glow.addColorStop(1, "rgba(120,70,180,0.2)");
  vctx.fillStyle = glow;
  vctx.fillRect(ax0, aApex, ax1 - ax0, H);
  const door = (x0, x1) => {
    const g = vctx.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, "#221b2c"); g.addColorStop(0.5, "#352b44"); g.addColorStop(1, "#1a1424");
    return g;
  };
  vctx.fillStyle = door(ax0, cxm - gap); vctx.fillRect(ax0, aApex, (cxm - gap) - ax0, H - aApex);
  vctx.fillStyle = door(cxm + gap, ax1); vctx.fillRect(cxm + gap, aApex, ax1 - (cxm + gap), H - aApex);
  // 扉の板目
  vctx.strokeStyle = "rgba(10,6,16,0.6)"; vctx.lineWidth = 0.7;
  for (const px of [ax0 + 5, ax0 + 10, cxm + 6, ax1 - 5]) {
    vctx.beginPath(); vctx.moveTo(px, aApex + 2); vctx.lineTo(px, H); vctx.stroke();
  }
  // 鋲
  vctx.fillStyle = "#4a3d5e";
  for (let y = 14; y < H - 4; y += 9) {
    for (const px of [ax0 + 3, cxm - gap - 3, cxm + gap + 3, ax1 - 3]) vctx.fillRect(px - 0.8, y, 1.6, 1.6);
  }
  // 隙間のまばゆい縁
  vctx.fillStyle = "rgba(220,180,255,0.6)";
  vctx.fillRect(cxm - gap - 0.6, aApex, 0.6, H);
  vctx.fillRect(cxm + gap, aApex, 0.6, H);
  vctx.restore();

  // 石の門枠 (太いアーチ)
  vctx.save();
  vctx.lineJoin = "round";
  vctx.strokeStyle = "#3a3146"; vctx.lineWidth = 4;
  vctx.beginPath();
  vctx.moveTo(ax0, H); vctx.lineTo(ax0, aSpring);
  vctx.quadraticCurveTo(ax0, aApex, cxm, aApex);
  vctx.quadraticCurveTo(ax1, aApex, ax1, aSpring);
  vctx.lineTo(ax1, H); vctx.stroke();
  vctx.strokeStyle = "rgba(150,120,190,0.25)"; vctx.lineWidth = 1;
  vctx.beginPath();
  vctx.moveTo(ax0 + 2, H); vctx.lineTo(ax0 + 2, aSpring);
  vctx.quadraticCurveTo(ax0 + 2, aApex + 2, cxm, aApex + 2);
  vctx.quadraticCurveTo(ax1 - 2, aApex + 2, ax1 - 2, aSpring);
  vctx.lineTo(ax1 - 2, H); vctx.stroke();
  vctx.restore();

  // 要石の髑髏
  const kx = cxm, ky = aApex - 1;
  vctx.fillStyle = "#cfc7d8";
  vctx.beginPath(); vctx.arc(kx, ky, 3, Math.PI, 0); vctx.lineTo(kx + 2, ky + 2.5); vctx.lineTo(kx - 2, ky + 2.5); vctx.closePath(); vctx.fill();
  vctx.fillStyle = "#1a1420"; vctx.fillRect(kx - 1.8, ky - 1, 1.3, 1.4); vctx.fillRect(kx + 0.5, ky - 1, 1.3, 1.4);

  // 亡者の魂 (紫の鬼火が隙間付近を昇る)
  for (let i = 0; i < 5; i++) {
    const ph = ((t * 0.0007) + i * 0.21) % 1;
    const wx = cxm + Math.sin(ph * 7 + i * 2) * 7, wy = (H - 4) - ph * (H - 12), al = (1 - ph) * 0.7;
    vctx.save();
    vctx.shadowColor = "rgba(180,120,250,0.9)"; vctx.shadowBlur = 4;
    vctx.fillStyle = `rgba(200,150,255,${al})`;
    vctx.beginPath(); vctx.arc(wx, wy, 1.3, 0, Math.PI * 2); vctx.fill();
    vctx.restore();
  }

  // 枠とコーナードット (テーマ共通の体裁を踏襲)
  vctx.strokeStyle = shadeHex(accent, 0.7);
  vctx.lineWidth = 2;
  vctx.strokeRect(1.5, 1.5, W - 3, H - 3);
  vctx.strokeStyle = shadeHex(accent, 0.36);
  vctx.lineWidth = 1;
  vctx.strokeRect(4.5, 4.5, W - 9, H - 9);
  vctx.fillStyle = shadeHex(accent, 0.6);
  for (const [dx, dy] of [[7, 7], [W - 7, 7], [7, H - 7], [W - 7, H - 7]]) {
    vctx.beginPath(); vctx.arc(dx, dy, 1.6, 0, Math.PI * 2); vctx.fill();
  }
  vctx.fillStyle = "rgba(255,255,255,0.05)";
  vctx.fillRect(2, 2, W - 4, 3);
}

// 層17「凍てつく王墓」のカード裏面: 氷に覆われた石棺と横臥像、載る凍てついた王冠、舞い落ちる霜
function drawBackTomb(r, accent, sym) {
  const W = r.w, H = r.h, t = performance.now();
  // 凍てつく王墓の地
  const bg = vctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#16222c");
  bg.addColorStop(0.5, "#121d26");
  bg.addColorStop(1, "#0d161d");
  vctx.fillStyle = bg;
  vctx.fillRect(0, 0, W, H);

  // 背後の冷たい光輪
  const halo = vctx.createRadialGradient(W / 2, 24, 2, W / 2, 24, 26);
  halo.addColorStop(0, "rgba(150,195,225,0.16)");
  halo.addColorStop(1, "rgba(150,195,225,0)");
  vctx.fillStyle = halo;
  vctx.fillRect(0, 0, W, H);

  // 左右の氷の柱
  for (const cx of [7, W - 7]) {
    const g = vctx.createLinearGradient(cx - 3, 0, cx + 3, 0);
    g.addColorStop(0, "#2a3a44"); g.addColorStop(0.4, "#54707e"); g.addColorStop(1, "#1f2c34");
    vctx.fillStyle = g;
    vctx.fillRect(cx - 3, 6, 6, H - 6);
    vctx.fillStyle = "#5e7c8a";
    vctx.fillRect(cx - 4, 6, 8, 2.5);
    vctx.fillStyle = "rgba(220,238,248,0.25)";
    vctx.fillRect(cx - 2.5, 7, 1, H - 8);
  }

  // 石棺 (中央の台座と棺)
  const sx = W / 2, baseY = H - 8, topY = 26;
  vctx.fillStyle = "#33454f"; vctx.fillRect(sx - 15, baseY, 30, 5);
  vctx.fillStyle = "#283740"; vctx.fillRect(sx - 17, baseY + 4, 34, 3);
  const sg = vctx.createLinearGradient(sx - 13, 0, sx + 13, 0);
  sg.addColorStop(0, "#3a4e58"); sg.addColorStop(0.5, "#5a7480"); sg.addColorStop(1, "#2e3e47");
  vctx.fillStyle = sg;
  vctx.beginPath();
  vctx.moveTo(sx - 12, baseY); vctx.lineTo(sx - 13, topY + 5); vctx.lineTo(sx + 13, topY + 5); vctx.lineTo(sx + 12, baseY); vctx.closePath();
  vctx.fill();
  // 蓋
  vctx.fillStyle = "#6b8794";
  vctx.beginPath();
  vctx.moveTo(sx - 14, topY + 5); vctx.lineTo(sx - 11, topY); vctx.lineTo(sx + 11, topY); vctx.lineTo(sx + 14, topY + 5); vctx.closePath();
  vctx.fill();
  // 横臥像 (簡略な起伏)
  vctx.fillStyle = "rgba(40,55,62,0.6)";
  vctx.beginPath(); vctx.ellipse(sx - 7, topY + 2.5, 2, 1.4, 0, 0, Math.PI * 2); vctx.fill();
  vctx.fillRect(sx - 4, topY + 1.5, 9, 2.4);
  // 蓋の十字
  vctx.strokeStyle = "rgba(30,45,52,0.7)"; vctx.lineWidth = 0.8;
  vctx.beginPath();
  vctx.moveTo(sx + 7, topY + 1); vctx.lineTo(sx + 7, topY + 4.5);
  vctx.moveTo(sx + 5.5, topY + 2.3); vctx.lineTo(sx + 8.5, topY + 2.3); vctx.stroke();
  // 石棺を覆う氷のシート
  vctx.fillStyle = "rgba(170,210,235,0.14)";
  vctx.beginPath();
  vctx.moveTo(sx - 13, baseY); vctx.lineTo(sx - 14, topY); vctx.lineTo(sx + 14, topY); vctx.lineTo(sx + 13, baseY); vctx.closePath();
  vctx.fill();
  vctx.fillStyle = "rgba(225,242,250,0.35)";
  vctx.fillRect(sx - 13, topY, 3, baseY - topY);

  // 凍てついた王冠 (蓋の上に載る)
  const cy = topY - 2;
  vctx.fillStyle = "#c9a23e";
  vctx.beginPath();
  vctx.moveTo(sx - 6, cy); vctx.lineTo(sx - 6, cy - 2);
  vctx.lineTo(sx - 3, cy - 0.5); vctx.lineTo(sx - 1.5, cy - 3.5); vctx.lineTo(sx, cy - 0.5);
  vctx.lineTo(sx + 1.5, cy - 3.5); vctx.lineTo(sx + 3, cy - 0.5); vctx.lineTo(sx + 6, cy - 2);
  vctx.lineTo(sx + 6, cy); vctx.closePath();
  vctx.fill();
  vctx.fillStyle = "#e8c869"; vctx.fillRect(sx - 6, cy, 12, 1.4);
  vctx.fillStyle = "#8fd0e0"; vctx.fillRect(sx - 0.8, cy - 1, 1.6, 1.6); // 宝玉
  vctx.fillStyle = "rgba(225,242,250,0.5)"; vctx.fillRect(sx - 6, cy - 2, 12, 0.8); // 霜の被り
  // きらめき
  const tw = Math.sin(t * 0.004);
  if (tw > 0.4) {
    vctx.strokeStyle = `rgba(240,250,255,${(tw - 0.4) * 1.5})`;
    vctx.lineWidth = 0.7;
    vctx.beginPath();
    vctx.moveTo(sx + 4, cy - 3); vctx.lineTo(sx + 6, cy - 1);
    vctx.moveTo(sx + 5, cy - 3); vctx.lineTo(sx + 5, cy - 1); vctx.stroke();
  }

  // 舞い落ちる霜
  for (let i = 0; i < 6; i++) {
    const px = (i * 43 + Math.sin(t * 0.0009 + i) * 4 + 6) % W;
    const py = ((t * 0.01 + i * 36) % (H - 4)) + 2;
    const al = 0.3 + 0.3 * Math.sin(t * 0.0025 + i * 1.3);
    vctx.fillStyle = `rgba(220,238,248,${Math.max(0.15, al) * 0.6})`;
    vctx.fillRect(px, py, 1, 1);
  }

  // 枠とコーナードット (テーマ共通の体裁を踏襲)
  vctx.strokeStyle = shadeHex(accent, 0.7);
  vctx.lineWidth = 2;
  vctx.strokeRect(1.5, 1.5, W - 3, H - 3);
  vctx.strokeStyle = shadeHex(accent, 0.36);
  vctx.lineWidth = 1;
  vctx.strokeRect(4.5, 4.5, W - 9, H - 9);
  vctx.fillStyle = shadeHex(accent, 0.6);
  for (const [dx, dy] of [[7, 7], [W - 7, 7], [7, H - 7], [W - 7, H - 7]]) {
    vctx.beginPath(); vctx.arc(dx, dy, 1.6, 0, Math.PI * 2); vctx.fill();
  }
  vctx.fillStyle = "rgba(255,255,255,0.05)";
  vctx.fillRect(2, 2, W - 4, 3);
}

// 層16「深淵の聖堂」のカード裏面: 尖頭アーチのステンドグラス窓、降り注ぐ光条、祭壇と舞う光の塵
function drawBackCathedral(r, accent, sym) {
  const W = r.w, H = r.h, t = performance.now();
  // 聖堂の地 (深い影に金の光)
  const bg = vctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#16140d");
  bg.addColorStop(0.5, "#131109");
  bg.addColorStop(1, "#0e0c07");
  vctx.fillStyle = bg;
  vctx.fillRect(0, 0, W, H);

  const wx = W / 2, wTop = 8, wBot = H - 14, ww = 9;

  // 側廊の円柱 (左右、暗い) とアーチの起こし
  for (const cx of [8, W - 8]) {
    const g = vctx.createLinearGradient(cx - 3, 0, cx + 3, 0);
    g.addColorStop(0, "#241f14"); g.addColorStop(0.5, "#3a3220"); g.addColorStop(1, "#1c1810");
    vctx.fillStyle = g;
    vctx.fillRect(cx - 3, 6, 6, H - 6);
    vctx.fillStyle = "#4a4028";
    vctx.fillRect(cx - 4, 6, 8, 2.5);
    vctx.strokeStyle = "#3a3220"; vctx.lineWidth = 2;
    vctx.beginPath(); vctx.moveTo(cx, 8); vctx.quadraticCurveTo(cx, 4, wx, 5); vctx.stroke();
  }

  // 窓の光輪
  const halo = vctx.createRadialGradient(wx, (wTop + wBot) / 2, 2, wx, (wTop + wBot) / 2, 22);
  halo.addColorStop(0, "rgba(240,210,120,0.5)");
  halo.addColorStop(1, "rgba(240,210,120,0)");
  vctx.fillStyle = halo;
  vctx.fillRect(wx - 22, wTop - 4, 44, wBot - wTop + 24);

  // 尖頭アーチの窓 (金色のステンドグラス)
  const winPath = () => {
    vctx.beginPath();
    vctx.moveTo(wx - ww, wBot); vctx.lineTo(wx - ww, wTop + 6);
    vctx.lineTo(wx, wTop); vctx.lineTo(wx + ww, wTop + 6); vctx.lineTo(wx + ww, wBot); vctx.closePath();
  };
  const glass = vctx.createLinearGradient(0, wTop, 0, wBot);
  glass.addColorStop(0, "#ffe9a8"); glass.addColorStop(0.5, "#e8b24e"); glass.addColorStop(1, "#b9742a");
  vctx.fillStyle = glass; winPath(); vctx.fill();
  // ステンドの色片
  vctx.fillStyle = "rgba(180,80,60,0.5)"; vctx.fillRect(wx - ww + 1, wTop + 10, ww - 1, 4);
  vctx.fillStyle = "rgba(70,110,170,0.5)"; vctx.fillRect(wx + 1, wTop + 16, ww - 1, 5);
  vctx.fillStyle = "rgba(80,150,90,0.4)"; vctx.fillRect(wx - ww + 1, wBot - 8, ww - 1, 4);
  // 窓枠 (マリオン)
  vctx.save();
  winPath(); vctx.clip();
  vctx.strokeStyle = "rgba(40,28,12,0.8)"; vctx.lineWidth = 1;
  vctx.beginPath(); vctx.moveTo(wx, wTop); vctx.lineTo(wx, wBot); vctx.stroke();
  for (let y = wTop + 8; y < wBot; y += 7) { vctx.beginPath(); vctx.moveTo(wx - ww, y); vctx.lineTo(wx + ww, y); vctx.stroke(); }
  vctx.restore();
  vctx.strokeStyle = "#5a4a28"; vctx.lineWidth = 1.4; winPath(); vctx.stroke();

  // 降り注ぐ光条 (窓から下方へ)
  vctx.save();
  vctx.globalCompositeOperation = "lighter";
  const shimmer = 0.04 + 0.02 * Math.sin(t * 0.0015);
  for (let i = -1; i <= 1; i++) {
    vctx.fillStyle = `rgba(245,215,130,${shimmer})`;
    vctx.beginPath();
    vctx.moveTo(wx + i * 4, wBot - 4); vctx.lineTo(wx + i * 4 + 3, wBot - 4);
    vctx.lineTo(wx + i * 9 + 6, H); vctx.lineTo(wx + i * 9 - 2, H); vctx.closePath(); vctx.fill();
  }
  vctx.restore();

  // 祭壇 (下中央の暗い台と小さな十字の光)
  vctx.fillStyle = "#2a2417"; vctx.fillRect(wx - 7, H - 9, 14, 6);
  vctx.fillStyle = "#1f1a10"; vctx.fillRect(wx - 9, H - 4, 18, 3);
  vctx.save();
  vctx.shadowColor = "rgba(255,225,140,0.9)"; vctx.shadowBlur = 4;
  vctx.fillStyle = "rgba(255,235,170,0.9)";
  vctx.fillRect(wx - 0.7, H - 12, 1.4, 5);
  vctx.fillRect(wx - 2.5, H - 10.5, 5, 1.4);
  vctx.restore();

  // 光の塵 (光条の中を舞う)
  for (let i = 0; i < 5; i++) {
    const px = wx + Math.sin(t * 0.0008 + i * 1.5) * 8 + (i - 2) * 2;
    const py = wBot + ((t * 0.01 + i * 30) % (H - wBot - 2));
    const al = 0.3 + 0.3 * Math.sin(t * 0.003 + i);
    vctx.fillStyle = `rgba(250,225,150,${Math.max(0, al) * 0.5})`;
    vctx.fillRect(px, py, 1, 1);
  }

  // 枠とコーナードット (テーマ共通の体裁を踏襲)
  vctx.strokeStyle = shadeHex(accent, 0.7);
  vctx.lineWidth = 2;
  vctx.strokeRect(1.5, 1.5, W - 3, H - 3);
  vctx.strokeStyle = shadeHex(accent, 0.36);
  vctx.lineWidth = 1;
  vctx.strokeRect(4.5, 4.5, W - 9, H - 9);
  vctx.fillStyle = shadeHex(accent, 0.6);
  for (const [dx, dy] of [[7, 7], [W - 7, 7], [7, H - 7], [W - 7, H - 7]]) {
    vctx.beginPath(); vctx.arc(dx, dy, 1.6, 0, Math.PI * 2); vctx.fill();
  }
  vctx.fillStyle = "rgba(255,255,255,0.05)";
  vctx.fillRect(2, 2, W - 4, 3);
}

// 層15「溶鉄炉」のカード裏面: 灼熱する溶鉱炉の炉口、溶けた鉄の樋、鉄床を打って散る火花
function drawBackForge(r, accent, sym) {
  const W = r.w, H = r.h, t = performance.now();
  // 工房の闇 (熱気の橙)
  const bg = vctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#190e07");
  bg.addColorStop(0.55, "#1f0f07");
  bg.addColorStop(1, "#281307");
  vctx.fillStyle = bg;
  vctx.fillRect(0, 0, W, H);

  // 溶鉱炉 (右奥の煉瓦の炉)
  const fTop = 10, fBot = H - 12;
  vctx.fillStyle = "#3a2013";
  vctx.beginPath();
  vctx.moveTo(30, fBot); vctx.lineTo(30, fTop + 5);
  vctx.quadraticCurveTo(30, fTop, 35, fTop);
  vctx.lineTo(W - 3, fTop); vctx.lineTo(W - 3, fBot); vctx.closePath();
  vctx.fill();
  // 煉瓦の目地
  vctx.strokeStyle = "rgba(0,0,0,0.35)";
  vctx.lineWidth = 0.6;
  for (let y = fTop + 5; y < fBot; y += 5) { vctx.beginPath(); vctx.moveTo(30, y); vctx.lineTo(W - 3, y); vctx.stroke(); }
  for (let x = 34; x < W - 3; x += 7) { vctx.beginPath(); vctx.moveTo(x, fTop); vctx.lineTo(x, fBot); vctx.stroke(); }
  // 炉口の灼熱グロー (アーチ)
  const mx = 43, my = (fTop + fBot) / 2 + 2;
  const fglow = vctx.createRadialGradient(mx, my, 1, mx, my, 13);
  fglow.addColorStop(0, "rgba(255,220,120,0.95)");
  fglow.addColorStop(0.4, "rgba(255,140,40,0.7)");
  fglow.addColorStop(1, "rgba(255,90,20,0)");
  vctx.fillStyle = fglow;
  vctx.beginPath();
  vctx.moveTo(mx - 7, my + 8); vctx.lineTo(mx - 7, my - 2);
  vctx.arc(mx, my - 2, 7, Math.PI, 0);
  vctx.lineTo(mx + 7, my + 8); vctx.closePath();
  vctx.fill();

  // 溶けた鉄の樋 (手前を流れる)
  const channelY = H - 9;
  const ch = vctx.createLinearGradient(0, channelY, 0, H - 4);
  ch.addColorStop(0, "#ffd24a"); ch.addColorStop(0.5, "#ff7e1e"); ch.addColorStop(1, "#b53a06");
  vctx.fillStyle = ch;
  vctx.fillRect(4, channelY, W - 8, 5);
  vctx.fillStyle = "#2a1810"; // 樋の縁
  vctx.fillRect(4, channelY - 1.5, W - 8, 1.5);
  vctx.fillRect(4, H - 4, W - 8, 1.5);
  vctx.fillStyle = "rgba(255,240,180,0.5)"; // 流れる明部
  for (let i = 0; i < 4; i++) {
    const lx = ((i * 18 + t * 0.04) % (W - 10)) + 5;
    vctx.fillRect(lx, channelY + 1, 5, 1.5);
  }

  // 金床 (手前左) と灼けた鉄塊
  const ax = 15, ay = H - 16;
  vctx.fillStyle = "#2c2c33"; // 台座
  vctx.fillRect(ax - 4, ay + 4, 8, 6);
  vctx.fillStyle = "#3c3c44"; // 金床
  vctx.fillRect(ax - 6, ay, 12, 4);
  vctx.fillRect(ax - 2, ay + 4, 4, 2);
  vctx.beginPath(); vctx.moveTo(ax + 6, ay); vctx.lineTo(ax + 11, ay + 1.5); vctx.lineTo(ax + 6, ay + 3); vctx.closePath(); vctx.fill();
  vctx.fillStyle = "rgba(180,185,200,0.3)";
  vctx.fillRect(ax - 6, ay, 12, 1);
  vctx.fillStyle = "rgba(255,150,40,0.9)"; // 灼けた鉄塊
  vctx.fillRect(ax - 2, ay - 1.5, 5, 2);

  // 火花 (鉄を打つ飛沫が放射状に散り、重力で落ちる)
  const burst = (t % 900) / 900;
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (i - 5) * 0.28, sp = burst * 16;
    const sx2 = ax + 1 + Math.cos(ang) * sp;
    const sy2 = ay - 1 + Math.sin(ang) * sp + burst * burst * 8;
    vctx.fillStyle = `rgba(255,${200 - Math.floor(burst * 120)},90,${1 - burst})`;
    vctx.fillRect(sx2, sy2, 1, 1);
  }

  // 枠とコーナードット (テーマ共通の体裁を踏襲)
  vctx.strokeStyle = shadeHex(accent, 0.7);
  vctx.lineWidth = 2;
  vctx.strokeRect(1.5, 1.5, W - 3, H - 3);
  vctx.strokeStyle = shadeHex(accent, 0.36);
  vctx.lineWidth = 1;
  vctx.strokeRect(4.5, 4.5, W - 9, H - 9);
  vctx.fillStyle = shadeHex(accent, 0.6);
  for (const [dx, dy] of [[7, 7], [W - 7, 7], [7, H - 7], [W - 7, H - 7]]) {
    vctx.beginPath(); vctx.arc(dx, dy, 1.6, 0, Math.PI * 2); vctx.fill();
  }
  vctx.fillStyle = "rgba(255,255,255,0.05)";
  vctx.fillRect(2, 2, W - 4, 3);
}

// 層14「屍蝋の回廊」のカード裏面: 壁龕に並ぶ屍蝋の頭蓋、滴る蝋のろうそくと揺らぐ炎
function drawBackOssuary(r, accent, sym) {
  const W = r.w, H = r.h, t = performance.now();
  // 屍蝋の地 (蝋のような淡褐)
  const bg = vctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#1b170f");
  bg.addColorStop(0.55, "#16120b");
  bg.addColorStop(1, "#110e08");
  vctx.fillStyle = bg;
  vctx.fillRect(0, 0, W, H);

  // ろうそくの灯の揺らぎ (暖色グロー)
  const flick = 0.7 + 0.3 * Math.sin(t * 0.012) + 0.1 * Math.sin(t * 0.031);
  const warm = vctx.createRadialGradient(12, H - 16, 2, 12, H - 16, 30);
  warm.addColorStop(0, `rgba(230,180,90,${0.12 * flick})`);
  warm.addColorStop(1, "rgba(230,180,90,0)");
  vctx.fillStyle = warm;
  vctx.fillRect(0, H - 40, 42, 40);

  // 壁龕 (アーチ型の窪みに屍蝋の頭蓋)
  for (const [nx, ny] of [[16, 15], [30, 13], [44, 15]]) {
    vctx.fillStyle = "#0c0a06"; // 窪みの闇
    vctx.beginPath();
    vctx.moveTo(nx - 6, ny + 9); vctx.lineTo(nx - 6, ny);
    vctx.arc(nx, ny, 6, Math.PI, 0);
    vctx.lineTo(nx + 6, ny + 9); vctx.closePath();
    vctx.fill();
    vctx.strokeStyle = "#5a4d30"; vctx.lineWidth = 1; vctx.stroke(); // 蝋の縁
    const sk = ny + 3; // 頭蓋
    vctx.fillStyle = "#cfc4a0";
    vctx.beginPath(); vctx.arc(nx, sk, 3.2, Math.PI, 0); vctx.lineTo(nx + 2.4, sk + 3); vctx.lineTo(nx - 2.4, sk + 3); vctx.closePath(); vctx.fill();
    vctx.fillStyle = "#b8ad8a"; vctx.fillRect(nx - 2.4, sk + 3, 4.8, 2); // 顎
    vctx.fillStyle = "#2a2418"; vctx.fillRect(nx - 2, sk - 1, 1.4, 1.6); vctx.fillRect(nx + 0.6, sk - 1, 1.4, 1.6); // 目の穴
  }

  // 滴る蝋の雫 (右の壁龕から周期的に落下)
  const ph = (t % 2000) / 2000, dx = 44;
  if (ph < 0.7) {
    const dy = 24 + (H - 10 - 24) * (ph / 0.7);
    vctx.fillStyle = "rgba(210,198,150,0.8)";
    vctx.fillRect(dx - 0.5, dy, 1.4, 3);
  }

  // 床のろうそく (蝋が滴る。左手前)
  const cxC = 12, cBase = H - 7;
  vctx.fillStyle = "#d8cba0"; // 蝋だまり
  vctx.beginPath(); vctx.ellipse(cxC, cBase + 2, 7, 2.5, 0, 0, Math.PI * 2); vctx.fill();
  const cg = vctx.createLinearGradient(cxC - 3, 0, cxC + 3, 0); // 蝋柱
  cg.addColorStop(0, "#b3a880"); cg.addColorStop(0.5, "#e0d6ad"); cg.addColorStop(1, "#9b9070");
  vctx.fillStyle = cg;
  vctx.fillRect(cxC - 3, cBase - 12, 6, 14);
  vctx.fillStyle = "#cabf95"; // 垂れる蝋
  vctx.fillRect(cxC + 2, cBase - 9, 1.6, 7);
  vctx.fillRect(cxC - 3, cBase - 6, 1.4, 5);
  vctx.fillStyle = "#3a2e18"; // 芯
  vctx.fillRect(cxC - 0.5, cBase - 15, 1, 3);
  // 炎 (揺らめく)
  const fh = 4 + flick * 1.5, sway = Math.sin(t * 0.02) * 0.8;
  vctx.save();
  vctx.shadowColor = "rgba(255,180,70,0.9)";
  vctx.shadowBlur = 6 * flick;
  const fg = vctx.createLinearGradient(cxC, cBase - 15 - fh, cxC, cBase - 15);
  fg.addColorStop(0, "rgba(255,235,160,0.95)");
  fg.addColorStop(1, "rgba(230,120,30,0.7)");
  vctx.fillStyle = fg;
  vctx.beginPath();
  vctx.moveTo(cxC, cBase - 15 - fh);
  vctx.quadraticCurveTo(cxC + 2 + sway, cBase - 15 - fh * 0.4, cxC, cBase - 15);
  vctx.quadraticCurveTo(cxC - 2 + sway, cBase - 15 - fh * 0.4, cxC, cBase - 15 - fh);
  vctx.closePath();
  vctx.fill();
  vctx.restore();

  // 枠とコーナードット (テーマ共通の体裁を踏襲)
  vctx.strokeStyle = shadeHex(accent, 0.7);
  vctx.lineWidth = 2;
  vctx.strokeRect(1.5, 1.5, W - 3, H - 3);
  vctx.strokeStyle = shadeHex(accent, 0.36);
  vctx.lineWidth = 1;
  vctx.strokeRect(4.5, 4.5, W - 9, H - 9);
  vctx.fillStyle = shadeHex(accent, 0.6);
  for (const [ddx, ddy] of [[7, 7], [W - 7, 7], [7, H - 7], [W - 7, H - 7]]) {
    vctx.beginPath(); vctx.arc(ddx, ddy, 1.6, 0, Math.PI * 2); vctx.fill();
  }
  vctx.fillStyle = "rgba(255,255,255,0.05)";
  vctx.fillRect(2, 2, W - 4, 3);
}

// 層13「魔導書庫」のカード裏面: 両壁の書架、中央に浮かぶ光る魔導書、立ちのぼる魔法文字
function drawBackLibrary(r, accent, sym) {
  const W = r.w, H = r.h, t = performance.now();
  // 書庫の闇
  const bg = vctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#15101f");
  bg.addColorStop(0.5, "#110d1a");
  bg.addColorStop(1, "#0d0a14");
  vctx.fillStyle = bg;
  vctx.fillRect(0, 0, W, H);

  // 書架 (左右の壁。棚板と背表紙)
  const spineCols = ["#3a2a4a", "#4a2a2a", "#2a3a4a", "#3a3a22", "#442a3a", "#2a4438"];
  const shelf = (x0, x1) => {
    vctx.fillStyle = "#1b1322";
    vctx.fillRect(x0, 4, x1 - x0, H - 8);
    for (let sy = 8; sy < H - 8; sy += 11) {
      vctx.fillStyle = "#0e0a14"; // 棚板
      vctx.fillRect(x0, sy + 9, x1 - x0, 1.5);
      let bx = x0 + 1, k = (x0 * 7 + sy * 13) >>> 0; // 擬似乱数シード
      while (bx < x1 - 1) {
        k = (k * 1103515245 + 12345) >>> 0;
        const bw = 1.4 + (k % 3) * 0.7;
        const h = 7 + ((k >> 4) % 3);
        vctx.fillStyle = spineCols[(k >> 8) % spineCols.length];
        vctx.fillRect(bx, sy + 9 - h, bw, h);
        vctx.fillStyle = "rgba(255,255,255,0.06)";
        vctx.fillRect(bx, sy + 9 - h, 0.5, h);
        bx += bw + 0.6;
      }
    }
  };
  shelf(2, 17);
  shelf(W - 17, W - 2);

  // 中央の魔法の光輪
  const cx = W / 2, cy = H / 2 + 2;
  const halo = vctx.createRadialGradient(cx, cy, 2, cx, cy, 18);
  halo.addColorStop(0, "rgba(160,110,225,0.3)");
  halo.addColorStop(1, "rgba(160,110,225,0)");
  vctx.fillStyle = halo;
  vctx.fillRect(cx - 18, cy - 18, 36, 36);

  // 浮遊する開いた魔導書
  const by = cy - 3 + Math.sin(t * 0.002) * 1.5;
  vctx.fillStyle = "#2a2038"; // 表紙 (V字に開く)
  vctx.beginPath();
  vctx.moveTo(cx, by - 1); vctx.lineTo(cx - 10, by + 1); vctx.lineTo(cx - 9, by + 7); vctx.lineTo(cx, by + 5); vctx.closePath(); vctx.fill();
  vctx.beginPath();
  vctx.moveTo(cx, by - 1); vctx.lineTo(cx + 10, by + 1); vctx.lineTo(cx + 9, by + 7); vctx.lineTo(cx, by + 5); vctx.closePath(); vctx.fill();
  vctx.fillStyle = "#c9c0d8"; // 左ページ
  vctx.beginPath();
  vctx.moveTo(cx - 0.5, by); vctx.lineTo(cx - 9, by + 1.5); vctx.lineTo(cx - 8, by + 6); vctx.lineTo(cx - 0.5, by + 4.5); vctx.closePath(); vctx.fill();
  vctx.fillStyle = "#bcb2cc"; // 右ページ
  vctx.beginPath();
  vctx.moveTo(cx + 0.5, by); vctx.lineTo(cx + 9, by + 1.5); vctx.lineTo(cx + 8, by + 6); vctx.lineTo(cx + 0.5, by + 4.5); vctx.closePath(); vctx.fill();
  // ページの文字行
  vctx.strokeStyle = "rgba(80,60,110,0.5)";
  vctx.lineWidth = 0.4;
  for (let i = 0; i < 3; i++) {
    vctx.beginPath(); vctx.moveTo(cx - 7, by + 2 + i * 1.4); vctx.lineTo(cx - 2, by + 1.4 + i * 1.4); vctx.stroke();
    vctx.beginPath(); vctx.moveTo(cx + 2, by + 1.4 + i * 1.4); vctx.lineTo(cx + 7, by + 2 + i * 1.4); vctx.stroke();
  }
  // 中央に光る印
  vctx.save();
  vctx.shadowColor = "rgba(180,130,255,0.9)";
  vctx.shadowBlur = 5;
  vctx.fillStyle = "rgba(205,175,255,0.9)";
  vctx.font = "bold 7px monospace";
  vctx.textAlign = "center";
  vctx.textBaseline = "middle";
  vctx.fillText("✶", cx, by + 2.5);
  vctx.restore();

  // 立ちのぼる魔法文字 (符が浮かんで消える)
  const runes = ["✦", "†", "◇", "∴", "✕"];
  vctx.font = "6px monospace";
  vctx.textAlign = "center";
  vctx.textBaseline = "middle";
  for (let i = 0; i < 4; i++) {
    const ph = ((t * 0.0006) + i * 0.25) % 1;
    const ry = by - ph * 22, rx = cx + Math.sin(ph * 6 + i) * 5, al = (1 - ph) * 0.7;
    vctx.fillStyle = `rgba(190,150,240,${al})`;
    vctx.fillText(runes[i % runes.length], rx, ry);
  }

  // 枠とコーナードット (テーマ共通の体裁を踏襲)
  vctx.strokeStyle = shadeHex(accent, 0.7);
  vctx.lineWidth = 2;
  vctx.strokeRect(1.5, 1.5, W - 3, H - 3);
  vctx.strokeStyle = shadeHex(accent, 0.36);
  vctx.lineWidth = 1;
  vctx.strokeRect(4.5, 4.5, W - 9, H - 9);
  vctx.fillStyle = shadeHex(accent, 0.6);
  for (const [dx, dy] of [[7, 7], [W - 7, 7], [7, H - 7], [W - 7, H - 7]]) {
    vctx.beginPath(); vctx.arc(dx, dy, 1.6, 0, Math.PI * 2); vctx.fill();
  }
  vctx.fillStyle = "rgba(255,255,255,0.05)";
  vctx.fillRect(2, 2, W - 4, 3);
}

// 層12「地底大空洞」のカード裏面: 天井の鍾乳石と地の石筍、岩肌の琥珀結晶、遥か下の残光と漂う塵
function drawBackCavern(r, accent, sym) {
  const W = r.w, H = r.h, t = performance.now();
  // 岩窟の地
  const bg = vctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#18140d");
  bg.addColorStop(0.5, "#13110b");
  bg.addColorStop(1, "#0e0c07");
  vctx.fillStyle = bg;
  vctx.fillRect(0, 0, W, H);

  // 遥か下の空洞の残光
  const glow = vctx.createRadialGradient(W / 2, H - 6, 2, W / 2, H - 6, 24);
  glow.addColorStop(0, "rgba(190,150,80,0.16)");
  glow.addColorStop(1, "rgba(190,150,80,0)");
  vctx.fillStyle = glow;
  vctx.fillRect(0, H - 26, W, 26);

  // 鍾乳石 (天井から下がる大小の岩)
  for (const [sx, sl, sw] of [[7, 12, 4], [17, 8, 3], [27, 16, 5], [37, 9, 3], [47, 13, 4], [W - 4, 7, 3]]) {
    const g = vctx.createLinearGradient(sx, 0, sx, sl);
    g.addColorStop(0, "#2a2317"); g.addColorStop(1, "#15110b");
    vctx.fillStyle = g;
    vctx.beginPath(); vctx.moveTo(sx - sw, 0); vctx.lineTo(sx + sw, 0); vctx.lineTo(sx, sl); vctx.closePath(); vctx.fill();
    vctx.fillStyle = "rgba(180,160,110,0.12)";
    vctx.fillRect(sx - sw + 0.5, 0, 1, sl * 0.6);
  }

  // 石筍 (地面から立ち上がる岩)
  for (const [sx, sl, sw] of [[10, 10, 4], [22, 7, 3], [33, 12, 5], [44, 8, 3]]) {
    const g = vctx.createLinearGradient(sx, H - sl, sx, H);
    g.addColorStop(0, "#241e14"); g.addColorStop(1, "#312815");
    vctx.fillStyle = g;
    vctx.beginPath(); vctx.moveTo(sx - sw, H); vctx.lineTo(sx + sw, H); vctx.lineTo(sx, H - sl); vctx.closePath(); vctx.fill();
    vctx.fillStyle = "rgba(200,160,90,0.10)";
    vctx.fillRect(sx - sw + 0.5, H - sl, 1, sl * 0.6);
  }

  // 岩肌に埋もれた結晶 (琥珀色に明滅)
  for (const [cx, cy, ci] of [[6, 28, 0], [50, 24, 1.3], [30, 33, 2.4], [16, 38, 3.1]]) {
    const tw = 0.5 + 0.5 * Math.sin(t * 0.0035 + ci);
    vctx.save();
    vctx.shadowColor = "rgba(220,180,90,0.8)";
    vctx.shadowBlur = 3 + tw * 3;
    vctx.fillStyle = `rgba(225,190,110,${0.4 + 0.4 * tw})`;
    vctx.beginPath();
    vctx.moveTo(cx, cy - 2.5); vctx.lineTo(cx + 1.6, cy); vctx.lineTo(cx, cy + 2.5); vctx.lineTo(cx - 1.6, cy); vctx.closePath();
    vctx.fill();
    vctx.restore();
  }

  // 漂う塵 (淡い光の粒)
  for (let i = 0; i < 5; i++) {
    const px = (i * 47 + t * 0.004) % W;
    const py = 18 + ((i * 53 + t * 0.008) % (H - 22));
    const al = 0.25 + 0.35 * Math.sin(t * 0.0025 + i * 1.7);
    vctx.fillStyle = `rgba(210,185,130,${Math.max(0, al) * 0.4})`;
    vctx.fillRect(px, py, 1, 1);
  }

  // 枠とコーナードット (テーマ共通の体裁を踏襲)
  vctx.strokeStyle = shadeHex(accent, 0.7);
  vctx.lineWidth = 2;
  vctx.strokeRect(1.5, 1.5, W - 3, H - 3);
  vctx.strokeStyle = shadeHex(accent, 0.36);
  vctx.lineWidth = 1;
  vctx.strokeRect(4.5, 4.5, W - 9, H - 9);
  vctx.fillStyle = shadeHex(accent, 0.6);
  for (const [dx, dy] of [[7, 7], [W - 7, 7], [7, H - 7], [W - 7, H - 7]]) {
    vctx.beginPath(); vctx.arc(dx, dy, 1.6, 0, Math.PI * 2); vctx.fill();
  }
  vctx.fillStyle = "rgba(255,255,255,0.05)";
  vctx.fillRect(2, 2, W - 4, 3);
}

// 層11「闘技場跡」のカード裏面: 崩れた観客席のアーケード、折れた円柱、砂上に転がる闘士の兜、舞う砂塵
function drawBackArena(r, accent, sym) {
  const W = r.w, H = r.h, t = performance.now();
  // 砂と石の地
  const bg = vctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#1f1810");
  bg.addColorStop(0.55, "#2a2012");
  bg.addColorStop(1, "#352a14");
  vctx.fillStyle = bg;
  vctx.fillRect(0, 0, W, H);

  // 上方から差す金色の光
  vctx.save();
  vctx.globalCompositeOperation = "lighter";
  vctx.fillStyle = "rgba(220,180,90,0.05)";
  vctx.beginPath(); vctx.moveTo(18, 0); vctx.lineTo(30, 0); vctx.lineTo(40, H); vctx.lineTo(20, H); vctx.closePath(); vctx.fill();
  vctx.restore();

  // 観客席のアーケード (上部に並ぶアーチ。3つ目は崩落)
  const arT = 9, arB = 22;
  vctx.fillStyle = "#3a3020";
  vctx.fillRect(2, arT - 3, W - 4, 3);
  const cols = [3, 12, 21, 30, 39, 48, W - 3];
  for (let i = 0; i < cols.length - 1; i++) {
    const x0 = cols[i], x1 = cols[i + 1], mid = (x0 + x1) / 2, aw = (x1 - x0) / 2 - 1;
    vctx.fillStyle = "#473a24";
    vctx.fillRect(x0 - 1.2, arT, 2.4, arB - arT);
    if (i !== 2) {
      vctx.fillStyle = "#120d07";
      vctx.beginPath();
      vctx.moveTo(mid - aw, arB); vctx.lineTo(mid - aw, arT + 4);
      vctx.arc(mid, arT + 4, aw, Math.PI, 0);
      vctx.lineTo(mid + aw, arB); vctx.closePath(); vctx.fill();
    } else {
      vctx.fillStyle = "#2e2616";
      vctx.fillRect(x0, arT + 3, x1 - x0, arB - arT - 3);
    }
  }
  vctx.fillStyle = "#473a24";
  vctx.fillRect(cols[cols.length - 1] - 1.2, arT, 2.4, arB - arT);
  vctx.fillStyle = "rgba(220,185,110,0.18)";
  vctx.fillRect(2, arT - 3, W - 4, 1);

  // 折れた円柱 (砂上に立つ。1本は傾く)
  const col = (cx, h, tilt) => {
    vctx.save();
    vctx.translate(cx, H); vctx.rotate(tilt);
    const g = vctx.createLinearGradient(-3, 0, 3, 0);
    g.addColorStop(0, "#5a4a2c"); g.addColorStop(0.5, "#7a6438"); g.addColorStop(1, "#473a22");
    vctx.fillStyle = g;
    vctx.fillRect(-2.5, -h, 5, h);
    vctx.fillStyle = "#6a572f";
    vctx.fillRect(-3.5, -h, 7, 2);
    vctx.strokeStyle = "rgba(40,30,12,0.5)"; vctx.lineWidth = 0.5;
    vctx.beginPath(); vctx.moveTo(0, -h + 2); vctx.lineTo(0, -2); vctx.stroke();
    vctx.restore();
  };
  col(9, 16, 0);
  col(46, 12, 0.12);

  // 闘士の兜 (砂上に転がる。鶏冠つき)
  const hx = W / 2, hy = H - 7;
  vctx.fillStyle = "rgba(0,0,0,0.3)"; // 兜の影
  vctx.beginPath(); vctx.ellipse(hx, hy + 4, 9, 2, 0, 0, Math.PI * 2); vctx.fill();
  vctx.fillStyle = "#8a3b2a"; // 鶏冠 (クレスト)
  vctx.beginPath();
  vctx.moveTo(hx - 1, hy - 9); vctx.quadraticCurveTo(hx, hy - 15, hx + 4, hy - 9);
  vctx.lineTo(hx + 1, hy - 8); vctx.lineTo(hx - 1, hy - 8); vctx.closePath(); vctx.fill();
  const helm = vctx.createLinearGradient(hx - 7, 0, hx + 7, 0);
  helm.addColorStop(0, "#7e8590"); helm.addColorStop(0.45, "#aab0ba"); helm.addColorStop(1, "#5e636d");
  vctx.fillStyle = helm;
  vctx.beginPath();
  vctx.arc(hx, hy - 2, 7, Math.PI, 0); vctx.lineTo(hx + 7, hy + 2); vctx.lineTo(hx - 7, hy + 2); vctx.closePath(); vctx.fill();
  vctx.fillStyle = "#15171a"; // 面の闇 (アイスリット)
  vctx.fillRect(hx - 5, hy - 1, 10, 3);
  vctx.fillStyle = "#6b7079"; // 鼻当て
  vctx.fillRect(hx - 1, hy - 3, 2, 5);
  vctx.fillStyle = "rgba(255,255,255,0.25)"; // ハイライト
  vctx.fillRect(hx - 5, hy - 6, 1.4, 4);

  // 砂塵 (金色の塵が漂う)
  for (let i = 0; i < 6; i++) {
    const px = (i * 41 + t * 0.006) % W;
    const py = 26 + ((i * 60 + t * 0.01) % (H - 28));
    const al = 0.3 + 0.4 * Math.sin(t * 0.002 + i * 1.6);
    vctx.fillStyle = `rgba(225,195,110,${Math.max(0, al) * 0.5})`;
    vctx.fillRect(px, py, 1, 1);
  }

  // 枠とコーナードット (テーマ共通の体裁を踏襲)
  vctx.strokeStyle = shadeHex(accent, 0.7);
  vctx.lineWidth = 2;
  vctx.strokeRect(1.5, 1.5, W - 3, H - 3);
  vctx.strokeStyle = shadeHex(accent, 0.36);
  vctx.lineWidth = 1;
  vctx.strokeRect(4.5, 4.5, W - 9, H - 9);
  vctx.fillStyle = shadeHex(accent, 0.6);
  for (const [dx, dy] of [[7, 7], [W - 7, 7], [7, H - 7], [W - 7, H - 7]]) {
    vctx.beginPath(); vctx.arc(dx, dy, 1.6, 0, Math.PI * 2); vctx.fill();
  }
  vctx.fillStyle = "rgba(255,255,255,0.05)";
  vctx.fillRect(2, 2, W - 4, 3);
}

// 層10「嵐の尖塔」のカード裏面: 嵐空にそびえる尖塔、閃く稲妻と雷雲、吹きつける雨
function drawBackSpire(r, accent, sym) {
  const W = r.w, H = r.h, t = performance.now();
  // 嵐空の地
  const bg = vctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#181426");
  bg.addColorStop(0.5, "#14121f");
  bg.addColorStop(1, "#0e0c16");
  vctx.fillStyle = bg;
  vctx.fillRect(0, 0, W, H);

  // 稲妻のフラッシュ判定 (周期的に二度光る)
  const lp = t % 2600;
  const flash = lp < 140 ? (1 - lp / 140) : (lp > 200 && lp < 300 ? (1 - (lp - 200) / 100) * 0.6 : 0);

  // 雷雲 (上辺の暗い塊。フラッシュで縁が光る)
  for (const [cx, cy, rr] of [[10, 5, 9], [26, 3, 10], [44, 5, 9], [W - 2, 7, 8]]) {
    vctx.fillStyle = `rgb(${Math.round(33 + flash * 120)},${Math.round(28 + flash * 110)},${Math.round(48 + flash * 120)})`;
    vctx.beginPath(); vctx.arc(cx, cy, rr, 0, Math.PI * 2); vctx.fill();
  }

  // 尖塔 (中央にそびえる暗い塔)
  const tx = W / 2;
  const body = vctx.createLinearGradient(tx - 7, 0, tx + 7, 0);
  body.addColorStop(0, "#1a1726"); body.addColorStop(0.5, "#2a2540"); body.addColorStop(1, "#15121f");
  vctx.fillStyle = body;
  vctx.beginPath();
  vctx.moveTo(tx - 5, H); vctx.lineTo(tx - 4, 16); vctx.lineTo(tx + 4, 16); vctx.lineTo(tx + 5, H); vctx.closePath();
  vctx.fill();
  // 尖った屋根
  vctx.fillStyle = "#221d34";
  vctx.beginPath(); vctx.moveTo(tx - 6, 16); vctx.lineTo(tx, 6); vctx.lineTo(tx + 6, 16); vctx.closePath(); vctx.fill();
  // 塔の縁ハイライト (フラッシュで青白く)
  vctx.fillStyle = `rgba(180,165,225,${0.15 + flash * 0.5})`;
  vctx.fillRect(tx - 4, 16, 1.2, H - 16);
  // 窓 (淡い灯)
  vctx.fillStyle = "rgba(190,170,230,0.4)";
  vctx.fillRect(tx - 1.2, 24, 2.4, 3);
  vctx.fillRect(tx - 1.2, 34, 2.4, 3);

  // 稲妻 (フラッシュ時に折れ線の閃光)
  if (flash > 0.25) {
    vctx.save();
    vctx.strokeStyle = `rgba(225,220,255,${flash})`;
    vctx.shadowColor = "rgba(180,160,255,0.9)";
    vctx.shadowBlur = 8;
    vctx.lineWidth = 1.4;
    vctx.beginPath();
    vctx.moveTo(38, 2); vctx.lineTo(34, 12); vctx.lineTo(40, 18); vctx.lineTo(33, 30); vctx.lineTo(37, 38);
    vctx.stroke();
    vctx.restore();
  }

  // 吹きつける雨 (斜めの線が流れる)
  vctx.strokeStyle = "rgba(170,185,225,0.18)";
  vctx.lineWidth = 0.8;
  for (let i = 0; i < 14; i++) {
    const seed = i * 53;
    const x0 = (seed + t * 0.16) % (W + 20) - 10;
    const y0 = (seed * 1.7 + t * 0.5) % (H + 12) - 6;
    vctx.beginPath(); vctx.moveTo(x0, y0); vctx.lineTo(x0 - 3, y0 + 6); vctx.stroke();
  }

  // 全体の閃光 (淡く)
  if (flash > 0) {
    vctx.fillStyle = `rgba(190,175,235,${flash * 0.12})`;
    vctx.fillRect(0, 0, W, H);
  }

  // 枠とコーナードット (テーマ共通の体裁を踏襲)
  vctx.strokeStyle = shadeHex(accent, 0.7);
  vctx.lineWidth = 2;
  vctx.strokeRect(1.5, 1.5, W - 3, H - 3);
  vctx.strokeStyle = shadeHex(accent, 0.36);
  vctx.lineWidth = 1;
  vctx.strokeRect(4.5, 4.5, W - 9, H - 9);
  vctx.fillStyle = shadeHex(accent, 0.6);
  for (const [dx, dy] of [[7, 7], [W - 7, 7], [7, H - 7], [W - 7, H - 7]]) {
    vctx.beginPath(); vctx.arc(dx, dy, 1.6, 0, Math.PI * 2); vctx.fill();
  }
  vctx.fillStyle = "rgba(255,255,255,0.05)";
  vctx.fillRect(2, 2, W - 4, 3);
}

// 層9「毒沼」のカード裏面: 沸き立つ毒のよどみ、ねじれた枯れ木、漂う瘴気と垂れる毒の雫、毒の鬼火
function drawBackSwamp(r, accent, sym) {
  const W = r.w, H = r.h, t = performance.now();
  // 淀んだ地
  const bg = vctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#1a1d10");
  bg.addColorStop(0.55, "#15170c");
  bg.addColorStop(1, "#101309");
  vctx.fillStyle = bg;
  vctx.fillRect(0, 0, W, H);

  // 漂う瘴気 (緑がかった靄)
  for (let i = 0; i < 3; i++) {
    const fy = 14 + i * 9;
    const off = Math.sin(t * 0.0007 + i * 1.4) * 7;
    vctx.fillStyle = `rgba(150,175,70,${0.07 - i * 0.015})`;
    vctx.beginPath(); vctx.ellipse(W / 2 + off, fy, W * 0.55, 4, 0, 0, Math.PI * 2); vctx.fill();
  }

  // 枯れ木 (ねじれた裸の幹と枝)
  vctx.strokeStyle = "#1d1810";
  vctx.lineCap = "round";
  vctx.lineWidth = 3;
  vctx.beginPath(); vctx.moveTo(13, H - 14); vctx.lineTo(12, 18); vctx.stroke();
  vctx.lineWidth = 1.6;
  vctx.beginPath();
  vctx.moveTo(12, 24); vctx.lineTo(5, 17);
  vctx.moveTo(12, 28); vctx.lineTo(19, 20);
  vctx.moveTo(12, 20); vctx.lineTo(17, 12);
  vctx.stroke();
  vctx.lineWidth = 1;
  vctx.beginPath(); vctx.moveTo(5, 17); vctx.lineTo(3, 12); vctx.moveTo(19, 20); vctx.lineTo(22, 16); vctx.stroke();
  // 右の細い枯れ木
  vctx.strokeStyle = "#191509";
  vctx.lineWidth = 2;
  vctx.beginPath(); vctx.moveTo(44, H - 13); vctx.lineTo(45, 20); vctx.stroke();
  vctx.lineWidth = 1.2;
  vctx.beginPath(); vctx.moveTo(45, 24); vctx.lineTo(50, 18); vctx.moveTo(45, 27); vctx.lineTo(40, 22); vctx.stroke();

  // 毒沼 (下部の毒々しい水面)
  const poolY = H - 13;
  const pool = vctx.createLinearGradient(0, poolY, 0, H);
  pool.addColorStop(0, "#7d9a2c");
  pool.addColorStop(0.5, "#566c1a");
  pool.addColorStop(1, "#33420f");
  vctx.fillStyle = pool;
  vctx.beginPath();
  vctx.moveTo(0, poolY + 2);
  for (let x = 0; x <= W; x += 8) {
    vctx.lineTo(x, poolY + 2 + Math.sin(t * 0.0016 + x * 0.25) * 1.1);
  }
  vctx.lineTo(W, H); vctx.lineTo(0, H); vctx.closePath();
  vctx.fill();
  // 沼上の淡い燐光
  const glow = vctx.createLinearGradient(0, poolY - 8, 0, poolY + 2);
  glow.addColorStop(0, "rgba(160,200,60,0)");
  glow.addColorStop(1, "rgba(160,200,60,0.18)");
  vctx.fillStyle = glow;
  vctx.fillRect(0, poolY - 8, W, 10);
  // 暗いよどみ
  vctx.strokeStyle = "rgba(30,40,10,0.5)";
  vctx.lineWidth = 1;
  for (let i = 0; i < 2; i++) {
    const yy = poolY + 5 + i * 3;
    vctx.beginPath(); vctx.moveTo(2, yy); vctx.lineTo(W - 2, yy + Math.sin(t * 0.0016 + i) * 1); vctx.stroke();
  }

  // 沸き立つ毒泡 (膨らんで弾ける)
  for (let i = 0; i < 4; i++) {
    const ph = ((t * 0.0008) + i * 0.28) % 1;
    if (ph >= 0.85) continue;
    const bx = 7 + i * 14, by = poolY + 4 + (i % 2) * 3, rr = 0.5 + ph * 3;
    vctx.fillStyle = `rgba(${150 + Math.floor(40 * (1 - ph))},200,70,${0.55 * (1 - ph)})`;
    vctx.beginPath(); vctx.arc(bx, by, rr, 0, Math.PI * 2); vctx.fill();
  }

  // 垂れる毒の雫 (枝先から周期的に落下 → 着水で波紋)
  const ph = (t % 1700) / 1700, dx = 17;
  if (ph < 0.6) {
    const dy = 12 + (poolY - 2 - 12) * (ph / 0.6);
    vctx.fillStyle = "rgba(180,215,90,0.85)";
    vctx.fillRect(dx - 0.5, dy, 1.5, 3);
  } else {
    const rp = (ph - 0.6) / 0.4;
    vctx.strokeStyle = `rgba(170,210,80,${0.5 * (1 - rp)})`;
    vctx.lineWidth = 1;
    vctx.beginPath(); vctx.ellipse(dx, poolY + 1, 2 + rp * 8, 1 + rp * 2, 0, 0, Math.PI * 2); vctx.stroke();
  }

  // 毒の鬼火 (ふわりと浮かぶ燐光)
  const wy = poolY - 9 + Math.sin(t * 0.002) * 3, wx = 38;
  vctx.save();
  vctx.shadowColor = "rgba(160,210,70,0.9)";
  vctx.shadowBlur = 6;
  vctx.fillStyle = "rgba(190,225,110,0.8)";
  vctx.beginPath(); vctx.arc(wx, wy, 2, 0, Math.PI * 2); vctx.fill();
  vctx.restore();

  // 枠とコーナードット (テーマ共通の体裁を踏襲)
  vctx.strokeStyle = shadeHex(accent, 0.7);
  vctx.lineWidth = 2;
  vctx.strokeRect(1.5, 1.5, W - 3, H - 3);
  vctx.strokeStyle = shadeHex(accent, 0.36);
  vctx.lineWidth = 1;
  vctx.strokeRect(4.5, 4.5, W - 9, H - 9);
  vctx.fillStyle = shadeHex(accent, 0.6);
  for (const [dx2, dy2] of [[7, 7], [W - 7, 7], [7, H - 7], [W - 7, H - 7]]) {
    vctx.beginPath(); vctx.arc(dx2, dy2, 1.6, 0, Math.PI * 2); vctx.fill();
  }
  vctx.fillStyle = "rgba(255,255,255,0.05)";
  vctx.fillRect(2, 2, W - 4, 3);
}

// 層8「氷結回廊」のカード裏面: 奥へ続く氷の回廊、垂れるつらら、舞い落ちる雪と氷晶のきらめき
function drawBackIce(r, accent, sym) {
  const W = r.w, H = r.h, t = performance.now();
  // 凍てつく地
  const bg = vctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#1b2832");
  bg.addColorStop(0.5, "#16222a");
  bg.addColorStop(1, "#0f1a20");
  vctx.fillStyle = bg;
  vctx.fillRect(0, 0, W, H);

  // 奥へ続く氷の回廊 (収束する遠近線)
  const vx = W / 2, vy = 24;
  vctx.strokeStyle = "rgba(150,200,225,0.18)";
  vctx.lineWidth = 1;
  for (const [cx, cy] of [[3, 3], [W - 3, 3], [3, H - 3], [W - 3, H - 3]]) {
    vctx.beginPath(); vctx.moveTo(cx, cy); vctx.lineTo(vx, vy); vctx.stroke();
  }
  // 奥の氷扉 (淡い光)
  const door = vctx.createRadialGradient(vx, vy, 1, vx, vy, 12);
  door.addColorStop(0, "rgba(190,225,240,0.22)");
  door.addColorStop(1, "rgba(190,225,240,0)");
  vctx.fillStyle = door;
  vctx.fillRect(vx - 12, vy - 12, 24, 24);
  vctx.fillStyle = "rgba(180,215,235,0.15)";
  vctx.fillRect(vx - 5, vy - 7, 10, 14);

  // つらら (上から垂れる氷柱)
  for (const [ix, il] of [[8, 11], [18, 7], [30, 13], [40, 8], [W - 7, 10]]) {
    const g = vctx.createLinearGradient(ix, 0, ix, il);
    g.addColorStop(0, "rgba(160,205,225,0.85)");
    g.addColorStop(1, "rgba(220,240,250,0.4)");
    vctx.fillStyle = g;
    vctx.beginPath(); vctx.moveTo(ix - 2.2, 0); vctx.lineTo(ix + 2.2, 0); vctx.lineTo(ix, il); vctx.closePath(); vctx.fill();
    vctx.fillStyle = "rgba(255,255,255,0.5)";
    vctx.fillRect(ix - 0.6, 0, 0.8, il * 0.7);
  }

  // 下隅の霜 (白い結晶のパッチ)
  vctx.fillStyle = "rgba(210,235,245,0.25)";
  for (const [fx, fy] of [[5, H - 4], [W - 6, H - 5], [14, H - 3]]) {
    for (let k = 0; k < 5; k++) {
      const a = k * 1.25;
      vctx.fillRect(fx + Math.cos(a) * 3, fy + Math.sin(a) * 2, 1, 1);
    }
    vctx.fillRect(fx - 1, fy - 1, 2, 2);
  }

  // 舞い落ちる雪 (ゆらぎながら降る)
  for (let i = 0; i < 7; i++) {
    const px = (i * 31 + Math.sin(t * 0.001 + i) * 5 + 5) % W;
    const py = ((t * 0.012 + i * 30) % (H - 4)) + 2;
    const al = 0.4 + 0.4 * Math.sin(t * 0.003 + i * 1.5);
    vctx.fillStyle = `rgba(225,242,250,${Math.max(0.2, al) * 0.7})`;
    vctx.fillRect(px, py, 1.2, 1.2);
  }

  // きらめき (四光の星が明滅)
  for (const [gx, gy, gi] of [[16, 30, 0], [42, 22, 1.7]]) {
    const s = 0.4 + 0.6 * Math.sin(t * 0.004 + gi);
    if (s > 0.5) {
      vctx.strokeStyle = `rgba(235,248,255,${(s - 0.5) * 1.6})`;
      vctx.lineWidth = 0.8;
      vctx.beginPath();
      vctx.moveTo(gx - 3, gy); vctx.lineTo(gx + 3, gy);
      vctx.moveTo(gx, gy - 3); vctx.lineTo(gx, gy + 3);
      vctx.stroke();
    }
  }

  // 枠とコーナードット (テーマ共通の体裁を踏襲)
  vctx.strokeStyle = shadeHex(accent, 0.7);
  vctx.lineWidth = 2;
  vctx.strokeRect(1.5, 1.5, W - 3, H - 3);
  vctx.strokeStyle = shadeHex(accent, 0.36);
  vctx.lineWidth = 1;
  vctx.strokeRect(4.5, 4.5, W - 9, H - 9);
  vctx.fillStyle = shadeHex(accent, 0.6);
  for (const [dx, dy] of [[7, 7], [W - 7, 7], [7, H - 7], [W - 7, H - 7]]) {
    vctx.beginPath(); vctx.arc(dx, dy, 1.6, 0, Math.PI * 2); vctx.fill();
  }
  vctx.fillStyle = "rgba(255,255,255,0.05)";
  vctx.fillRect(2, 2, W - 4, 3);
}

// 層7「灼熱の洞」のカード裏面: 煮え立つ溶岩だまり、赤熱した鍾乳石、爆ぜる泡と立ちのぼる火の粉
function drawBackLava(r, accent, sym) {
  const W = r.w, H = r.h, t = performance.now();
  // 火山岩の地
  const bg = vctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#190d07");
  bg.addColorStop(0.55, "#291208");
  bg.addColorStop(1, "#4a1c08");
  vctx.fillStyle = bg;
  vctx.fillRect(0, 0, W, H);

  // 岩肌の灼けた亀裂 (橙に光る)
  vctx.strokeStyle = "rgba(230,110,30,0.5)";
  vctx.lineWidth = 1;
  vctx.beginPath(); vctx.moveTo(5, 12); vctx.lineTo(9, 20); vctx.lineTo(6, 27); vctx.stroke();
  vctx.beginPath(); vctx.moveTo(W - 6, 15); vctx.lineTo(W - 10, 23); vctx.lineTo(W - 7, 30); vctx.stroke();

  // 鍾乳石 (暗い岩。先端は溶岩の照り返しで赤熱)
  for (const [sx, sl] of [[10, 9], [24, 13], [40, 8], [W - 6, 11]]) {
    vctx.fillStyle = "#1c0f08";
    vctx.beginPath();
    vctx.moveTo(sx - 3, 0); vctx.lineTo(sx + 3, 0); vctx.lineTo(sx, sl); vctx.closePath(); vctx.fill();
    vctx.fillStyle = "rgba(255,120,40,0.5)";
    vctx.beginPath();
    vctx.moveTo(sx - 1.2, sl - 3); vctx.lineTo(sx + 1.2, sl - 3); vctx.lineTo(sx, sl); vctx.closePath(); vctx.fill();
  }

  // 溶岩だまりの上に立ちのぼる熱気の光
  const lavaY = H - 15;
  const halo = vctx.createRadialGradient(W / 2, lavaY, 2, W / 2, lavaY, 26);
  halo.addColorStop(0, "rgba(255,140,40,0.28)");
  halo.addColorStop(1, "rgba(255,140,40,0)");
  vctx.fillStyle = halo;
  vctx.fillRect(0, lavaY - 22, W, 30);

  // 溶岩だまり (波打つ表面)
  const lava = vctx.createLinearGradient(0, lavaY, 0, H);
  lava.addColorStop(0, "#ffb02a");
  lava.addColorStop(0.4, "#f2731a");
  lava.addColorStop(1, "#9c2e06");
  vctx.fillStyle = lava;
  vctx.beginPath();
  vctx.moveTo(0, lavaY + 2);
  for (let x = 0; x <= W; x += 8) {
    vctx.lineTo(x, lavaY + 2 + Math.sin(t * 0.002 + x * 0.3) * 1.2);
  }
  vctx.lineTo(W, H); vctx.lineTo(0, H); vctx.closePath();
  vctx.fill();
  // 溶岩表面の暗い殻
  vctx.strokeStyle = "rgba(40,10,0,0.5)";
  vctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    const yy = lavaY + 5 + i * 3;
    vctx.beginPath(); vctx.moveTo(2, yy + Math.sin(t * 0.002 + i) * 1); vctx.lineTo(W - 2, yy); vctx.stroke();
  }

  // 泡 (溶岩面で膨らんで弾ける)
  for (let i = 0; i < 4; i++) {
    const ph = ((t * 0.0009) + i * 0.27) % 1;
    if (ph >= 0.8) continue;
    const bx = 8 + i * 14, by = lavaY + 4 + (i % 2) * 3, rr = 0.5 + ph * 3;
    vctx.fillStyle = `rgba(255,${180 + Math.floor(50 * (1 - ph))},80,${0.6 * (1 - ph)})`;
    vctx.beginPath(); vctx.arc(bx, by, rr, 0, Math.PI * 2); vctx.fill();
  }

  // 立ちのぼる火の粉 (溶岩面で明るく、上るほど消える)
  for (let i = 0; i < 6; i++) {
    const px = (i * 39 + Math.sin(t * 0.001 + i) * 6 + 7) % W;
    const py = (H - 8) - ((t * 0.02 + i * 33) % (H - 10));
    const al = Math.max(0, 1 - (H - 8 - py) / (H - 10));
    vctx.fillStyle = `rgba(255,${140 + Math.floor(80 * al)},40,${al * 0.8})`;
    vctx.fillRect(px, py, 1.2, 1.2);
  }

  // 枠とコーナードット (テーマ共通の体裁を踏襲)
  vctx.strokeStyle = shadeHex(accent, 0.7);
  vctx.lineWidth = 2;
  vctx.strokeRect(1.5, 1.5, W - 3, H - 3);
  vctx.strokeStyle = shadeHex(accent, 0.36);
  vctx.lineWidth = 1;
  vctx.strokeRect(4.5, 4.5, W - 9, H - 9);
  vctx.fillStyle = shadeHex(accent, 0.6);
  for (const [dx, dy] of [[7, 7], [W - 7, 7], [7, H - 7], [W - 7, H - 7]]) {
    vctx.beginPath(); vctx.arc(dx, dy, 1.6, 0, Math.PI * 2); vctx.fill();
  }
  vctx.fillStyle = "rgba(255,255,255,0.05)";
  vctx.fillRect(2, 2, W - 4, 3);
}

// 層6「沈没神殿」のカード裏面: 水底に沈む列柱と破風、差し込む光条と立ちのぼる気泡
function drawBackTemple(r, accent, sym) {
  const W = r.w, H = r.h, t = performance.now();
  // 水底の地 (上から光が差す)
  const bg = vctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#16333b");
  bg.addColorStop(0.5, "#0e2228");
  bg.addColorStop(1, "#081317");
  vctx.fillStyle = bg;
  vctx.fillRect(0, 0, W, H);

  // 水面から差す光条 (淡い斜めの帯がゆらめく)
  vctx.save();
  vctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 3; i++) {
    const x0 = 8 + i * 18 + Math.sin(t * 0.0006 + i) * 3;
    vctx.fillStyle = "rgba(120,200,220,0.05)";
    vctx.beginPath();
    vctx.moveTo(x0, 0); vctx.lineTo(x0 + 5, 0);
    vctx.lineTo(x0 + 13, H); vctx.lineTo(x0 + 6, H);
    vctx.closePath();
    vctx.fill();
  }
  vctx.restore();

  const cxc = W / 2;
  const stone = (y0, y1) => {
    const g = vctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, "#5a7a82"); g.addColorStop(1, "#33505a");
    return g;
  };
  // 神殿の破風 (ペディメント) と楣
  const pedTop = 8, pedBot = 18, pedW = 20;
  vctx.fillStyle = stone(pedTop, pedBot);
  vctx.beginPath();
  vctx.moveTo(cxc - pedW, pedBot); vctx.lineTo(cxc, pedTop); vctx.lineTo(cxc + pedW, pedBot);
  vctx.closePath();
  vctx.fill();
  vctx.strokeStyle = "rgba(20,40,45,0.7)"; vctx.lineWidth = 1; vctx.stroke();
  vctx.fillStyle = stone(pedBot, pedBot + 4);
  vctx.fillRect(cxc - pedW + 1, pedBot, pedW * 2 - 2, 4);

  // 円柱 3本 (縦溝つき)
  const colY0 = pedBot + 4, colY1 = H - 7, colHW = 2.6;
  for (const cxp of [cxc - 13, cxc, cxc + 13]) {
    const g = vctx.createLinearGradient(cxp - colHW, 0, cxp + colHW, 0);
    g.addColorStop(0, "#3f5a62"); g.addColorStop(0.4, "#62828a"); g.addColorStop(1, "#2e474f");
    vctx.fillStyle = g;
    vctx.fillRect(cxp - colHW, colY0, colHW * 2, colY1 - colY0);
    vctx.fillStyle = "#557078"; // 柱頭・柱礎
    vctx.fillRect(cxp - colHW - 1, colY0, colHW * 2 + 2, 2);
    vctx.fillRect(cxp - colHW - 1, colY1 - 2, colHW * 2 + 2, 2);
    vctx.strokeStyle = "rgba(20,40,45,0.5)"; vctx.lineWidth = 0.5;
    vctx.beginPath(); vctx.moveTo(cxp, colY0 + 2); vctx.lineTo(cxp, colY1 - 2); vctx.stroke();
  }
  // 折れた円柱の残骸 (右下に倒れる)
  vctx.fillStyle = "#3a565e";
  vctx.fillRect(cxc + 8, H - 6, 10, 3);

  // 水底の堆積 (下辺の暗い泥)
  vctx.fillStyle = "rgba(8,18,20,0.7)";
  vctx.beginPath();
  vctx.moveTo(0, H - 5); vctx.quadraticCurveTo(W / 2, H - 8, W, H - 5);
  vctx.lineTo(W, H); vctx.lineTo(0, H); vctx.closePath();
  vctx.fill();

  // 立ちのぼる気泡
  for (let i = 0; i < 5; i++) {
    const bx = (i * 47 + 11) % W;
    const by = (H - 4) - ((t * 0.018 + i * 55) % (H - 6));
    const rr = 0.8 + (i % 3) * 0.5;
    vctx.fillStyle = `rgba(180,225,235,${0.18 + 0.12 * Math.sin(t * 0.004 + i)})`;
    vctx.beginPath(); vctx.arc(bx, by, rr, 0, Math.PI * 2); vctx.fill();
  }

  // 枠とコーナードット (テーマ共通の体裁を踏襲)
  vctx.strokeStyle = shadeHex(accent, 0.7);
  vctx.lineWidth = 2;
  vctx.strokeRect(1.5, 1.5, W - 3, H - 3);
  vctx.strokeStyle = shadeHex(accent, 0.36);
  vctx.lineWidth = 1;
  vctx.strokeRect(4.5, 4.5, W - 9, H - 9);
  vctx.fillStyle = shadeHex(accent, 0.6);
  for (const [dx, dy] of [[7, 7], [W - 7, 7], [7, H - 7], [W - 7, H - 7]]) {
    vctx.beginPath(); vctx.arc(dx, dy, 1.6, 0, Math.PI * 2); vctx.fill();
  }
  vctx.fillStyle = "rgba(255,255,255,0.05)";
  vctx.fillRect(2, 2, W - 4, 3);
}

// 層5「霧の森」のカード裏面: 樹冠から差す薄明、暗い木立と林床の小径、流れる霧と舞う胞子
function drawBackForest(r, accent, sym) {
  const W = r.w, H = r.h, t = performance.now();
  // 霧緑の地 (梢から差す薄明)
  const bg = vctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#17211a");
  bg.addColorStop(0.5, "#111811");
  bg.addColorStop(1, "#0b110b");
  vctx.fillStyle = bg;
  vctx.fillRect(0, 0, W, H);

  // 林床の小径 (中央奥へ細くなる薄明)
  vctx.fillStyle = "rgba(120,140,90,0.08)";
  vctx.beginPath();
  vctx.moveTo(W / 2 - 2, 20); vctx.lineTo(W / 2 + 2, 20);
  vctx.lineTo(W / 2 + 9, H - 2); vctx.lineTo(W / 2 - 9, H - 2);
  vctx.closePath();
  vctx.fill();

  // 樹冠 (上辺の暗い茂み)
  vctx.fillStyle = "#0e160e";
  for (const [cx, cy, rr] of [[8, 4, 9], [20, 2, 8], [34, 5, 9], [48, 2, 9], [W - 3, 6, 8]]) {
    vctx.beginPath(); vctx.arc(cx, cy, rr, 0, Math.PI * 2); vctx.fill();
  }

  // 木の幹 (先細りの暗い樹皮)
  const trunk = (bx, topY, topW, botW) => {
    const g = vctx.createLinearGradient(bx - botW, 0, bx + botW, 0);
    g.addColorStop(0, "#15130d"); g.addColorStop(0.5, "#241f15"); g.addColorStop(1, "#100e09");
    vctx.fillStyle = g;
    vctx.beginPath();
    vctx.moveTo(bx - topW, topY); vctx.lineTo(bx + topW, topY);
    vctx.lineTo(bx + botW, H); vctx.lineTo(bx - botW, H);
    vctx.closePath();
    vctx.fill();
  };
  trunk(14, 6, 2, 4);
  trunk(42, 4, 2.5, 5);
  // 後景の細い幹
  vctx.fillStyle = "#181610";
  vctx.fillRect(W / 2 - 1.2, 10, 2.4, H - 10);
  // 枝
  vctx.strokeStyle = "#1c1810";
  vctx.lineWidth = 1.4;
  vctx.beginPath(); vctx.moveTo(14, 14); vctx.lineTo(7, 8); vctx.stroke();
  vctx.beginPath(); vctx.moveTo(42, 12); vctx.lineTo(50, 7); vctx.stroke();
  vctx.beginPath(); vctx.moveTo(42, 18); vctx.lineTo(36, 13); vctx.stroke();

  // 漂う霧 (淡い帯がゆっくり流れる)
  for (let i = 0; i < 4; i++) {
    const fy = 18 + i * 8;
    const off = Math.sin(t * 0.0008 + i * 1.5) * 8;
    vctx.fillStyle = `rgba(180,200,180,${0.10 - i * 0.012})`;
    vctx.beginPath();
    vctx.ellipse(W / 2 + off, fy, W * 0.55, 3.5, 0, 0, Math.PI * 2);
    vctx.fill();
  }

  // 漂う胞子 (淡緑の光点がふわりと舞い上がる)
  for (let i = 0; i < 5; i++) {
    const px = (i * 53 + t * 0.01) % W;
    const py = (H - 6) - ((t * 0.012 + i * 40) % (H - 12));
    const al = 0.3 + 0.4 * Math.sin(t * 0.003 + i * 2);
    vctx.fillStyle = `rgba(170,220,140,${Math.max(0, al) * 0.6})`;
    vctx.fillRect(px, py, 1.3, 1.3);
  }

  // 枠とコーナードット (テーマ共通の体裁を踏襲)
  vctx.strokeStyle = shadeHex(accent, 0.7);
  vctx.lineWidth = 2;
  vctx.strokeRect(1.5, 1.5, W - 3, H - 3);
  vctx.strokeStyle = shadeHex(accent, 0.36);
  vctx.lineWidth = 1;
  vctx.strokeRect(4.5, 4.5, W - 9, H - 9);
  vctx.fillStyle = shadeHex(accent, 0.6);
  for (const [dx, dy] of [[7, 7], [W - 7, 7], [7, H - 7], [W - 7, H - 7]]) {
    vctx.beginPath(); vctx.arc(dx, dy, 1.6, 0, Math.PI * 2); vctx.fill();
  }
  vctx.fillStyle = "rgba(255,255,255,0.05)";
  vctx.fillRect(2, 2, W - 4, 3);
}

// 層4「捨て砦」のカード裏面: 朽ちた胸壁と城門、はためく破れ軍旗、地に突き立つ慰霊の剣
function drawBackFort(r, accent, sym) {
  const W = r.w, H = r.h, t = performance.now();
  // 冷たい石の地
  const bg = vctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#1a1c21");
  bg.addColorStop(0.6, "#141519");
  bg.addColorStop(1, "#0e0f13");
  vctx.fillStyle = bg;
  vctx.fillRect(0, 0, W, H);

  // 朽ちた城壁
  const wallTop = 22, wallBot = 36;
  vctx.fillStyle = "#262a31";
  vctx.fillRect(2, wallTop, W - 4, wallBot - wallTop);
  // 胸壁 (メルロン。一部は崩れ落ちて欠ける)
  const merlons = [1, 1, 0, 1, 1, 0, 1, 1];
  const mw = (W - 4) / merlons.length;
  for (let i = 0; i < merlons.length; i++) {
    if (!merlons[i]) continue;
    vctx.fillStyle = "#2b2f37";
    vctx.fillRect(2 + i * mw + 1, wallTop - 5, mw - 2, 6);
  }
  // 石目
  vctx.strokeStyle = "rgba(0,0,0,0.35)";
  vctx.lineWidth = 0.7;
  vctx.beginPath(); vctx.moveTo(2, wallTop + 5); vctx.lineTo(W - 2, wallTop + 5); vctx.stroke();
  vctx.beginPath(); vctx.moveTo(2, wallTop + 10); vctx.lineTo(W - 2, wallTop + 10); vctx.stroke();
  for (let i = 1; i < 6; i++) {
    const x = 2 + i * ((W - 4) / 6);
    vctx.beginPath();
    vctx.moveTo(x, i % 2 ? wallTop : wallTop + 5);
    vctx.lineTo(x, i % 2 ? wallTop + 5 : wallTop + 10);
    vctx.stroke();
  }
  vctx.fillStyle = "rgba(170,180,195,0.12)"; // 壁上辺の冷光
  vctx.fillRect(2, wallTop, W - 4, 1);
  // 城門 (暗い入口)
  vctx.fillStyle = "#070809";
  vctx.beginPath();
  vctx.moveTo(W / 2 - 5, wallBot);
  vctx.lineTo(W / 2 - 5, wallTop + 6);
  vctx.arc(W / 2, wallTop + 6, 5, Math.PI, 0);
  vctx.lineTo(W / 2 + 5, wallBot);
  vctx.closePath();
  vctx.fill();

  // 破れた軍旗 (左の旗竿から垂れ、風にはためく)
  const poleX = 12, poleTop = 8, poleBot = wallTop + 2;
  vctx.strokeStyle = "#3a3d44";
  vctx.lineWidth = 1.4;
  vctx.beginPath(); vctx.moveTo(poleX, poleTop); vctx.lineTo(poleX, poleBot); vctx.stroke();
  const sway = Math.sin(t * 0.003) * 2;
  vctx.fillStyle = "#6b3434"; // 色褪せた深紅
  vctx.beginPath();
  vctx.moveTo(poleX, poleTop + 1);
  vctx.lineTo(poleX + 13 + sway, poleTop + 3);
  vctx.lineTo(poleX + 10 + sway, poleTop + 7);
  vctx.lineTo(poleX + 13 + sway, poleTop + 11);
  vctx.lineTo(poleX + 9 + sway * 0.5, poleTop + 10);
  vctx.lineTo(poleX, poleTop + 9);
  vctx.closePath();
  vctx.fill();
  vctx.fillStyle = "rgba(0,0,0,0.2)";
  vctx.fillRect(poleX, poleTop + 5, Math.max(0, 9 + sway * 0.5), 1);

  // 地に突き立つ慰霊の剣 (中央手前)
  const sx = W / 2;
  const blade = vctx.createLinearGradient(sx - 1.5, 0, sx + 1.5, 0);
  blade.addColorStop(0, "#8c93a0"); blade.addColorStop(0.5, "#c2c8d2"); blade.addColorStop(1, "#5b606b");
  vctx.fillStyle = blade;
  vctx.beginPath();
  vctx.moveTo(sx - 1.5, wallBot + 2);
  vctx.lineTo(sx + 1.5, wallBot + 2);
  vctx.lineTo(sx + 1.2, H - 6);
  vctx.lineTo(sx, H - 4);
  vctx.lineTo(sx - 1.2, H - 6);
  vctx.closePath();
  vctx.fill();
  vctx.fillStyle = "#7a6a3a"; // 鍔
  vctx.fillRect(sx - 5, wallBot + 1, 10, 2);
  vctx.fillStyle = "#4a3a22"; // 柄
  vctx.fillRect(sx - 1.2, wallBot - 4, 2.4, 5);
  vctx.fillStyle = "#8a7a44"; // 柄頭
  vctx.fillRect(sx - 1.6, wallBot - 6, 3.2, 2);

  // 瓦礫 (剣の根元)
  vctx.fillStyle = "#2a2d33";
  vctx.beginPath(); vctx.ellipse(sx, H - 4, 9, 2.6, 0, 0, Math.PI * 2); vctx.fill();
  vctx.fillStyle = "#23262b";
  vctx.fillRect(sx - 12, H - 5, 4, 3);
  vctx.fillRect(sx + 8, H - 4, 5, 2.5);

  // 枠とコーナードット (テーマ共通の体裁を踏襲)
  vctx.strokeStyle = shadeHex(accent, 0.7);
  vctx.lineWidth = 2;
  vctx.strokeRect(1.5, 1.5, W - 3, H - 3);
  vctx.strokeStyle = shadeHex(accent, 0.36);
  vctx.lineWidth = 1;
  vctx.strokeRect(4.5, 4.5, W - 9, H - 9);
  vctx.fillStyle = shadeHex(accent, 0.6);
  for (const [dx, dy] of [[7, 7], [W - 7, 7], [7, H - 7], [W - 7, H - 7]]) {
    vctx.beginPath(); vctx.arc(dx, dy, 1.6, 0, Math.PI * 2); vctx.fill();
  }
  vctx.fillStyle = "rgba(255,255,255,0.05)";
  vctx.fillRect(2, 2, W - 4, 3);
}

// 層3「廃坑」のカード裏面: 坑木の支保工が組まれた坑道口、鉱脈の煌めきとトロッコ軌道
function drawBackMine(r, accent, sym) {
  const W = r.w, H = r.h, t = performance.now();
  // 岩肌の地
  const bg = vctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#1b140d");
  bg.addColorStop(0.6, "#150f09");
  bg.addColorStop(1, "#0f0a06");
  vctx.fillStyle = bg;
  vctx.fillRect(0, 0, W, H);
  // 岩の割れ目
  vctx.strokeStyle = "rgba(0,0,0,0.3)";
  vctx.lineWidth = 1;
  vctx.beginPath(); vctx.moveTo(6, 8); vctx.lineTo(11, 17); vctx.lineTo(8, 24); vctx.stroke();
  vctx.beginPath(); vctx.moveTo(W - 7, 11); vctx.lineTo(W - 12, 19); vctx.stroke();

  const tx = W / 2, ow = 12, openTop = 15, openBot = H - 12;
  // 坑道の闇
  vctx.fillStyle = "#070504";
  vctx.beginPath();
  vctx.moveTo(tx - ow, openBot);
  vctx.lineTo(tx - ow, openTop + 4);
  vctx.quadraticCurveTo(tx - ow, openTop, tx - ow + 4, openTop);
  vctx.lineTo(tx + ow - 4, openTop);
  vctx.quadraticCurveTo(tx + ow, openTop, tx + ow, openTop + 4);
  vctx.lineTo(tx + ow, openBot);
  vctx.closePath();
  vctx.fill();
  // 坑奥ににじむ土気の残光
  const gl = vctx.createRadialGradient(tx, openBot - 4, 1, tx, openBot - 4, 14);
  gl.addColorStop(0, "rgba(150,100,40,0.18)");
  gl.addColorStop(1, "rgba(150,100,40,0)");
  vctx.fillStyle = gl;
  vctx.fillRect(tx - 14, openBot - 18, 28, 18);

  // 坑木の支保工 (左右の柱 + 梁)
  const woodG = (x0, x1) => {
    const g = vctx.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, "#6b4a26"); g.addColorStop(0.5, "#8a6233"); g.addColorStop(1, "#523619");
    return g;
  };
  vctx.fillStyle = woodG(tx - ow - 6, tx - ow); // 左柱
  vctx.fillRect(tx - ow - 6, openTop - 2, 6, openBot - openTop + 2);
  vctx.fillStyle = woodG(tx + ow, tx + ow + 6); // 右柱
  vctx.fillRect(tx + ow, openTop - 2, 6, openBot - openTop + 2);
  vctx.fillStyle = woodG(tx - ow - 7, tx + ow + 7); // 梁
  vctx.fillRect(tx - ow - 7, openTop - 7, ow * 2 + 14, 6);
  // 木目と継ぎ目
  vctx.strokeStyle = "rgba(40,24,8,0.6)";
  vctx.lineWidth = 0.7;
  for (const px of [tx - ow - 3, tx + ow + 3]) {
    vctx.beginPath(); vctx.moveTo(px, openTop); vctx.lineTo(px, openBot); vctx.stroke();
  }
  vctx.beginPath(); vctx.moveTo(tx - ow - 6, openTop - 4); vctx.lineTo(tx + ow + 6, openTop - 4); vctx.stroke();
  // 梁の上辺ハイライト
  vctx.fillStyle = "rgba(220,180,110,0.2)";
  vctx.fillRect(tx - ow - 7, openTop - 7, ow * 2 + 14, 1.2);

  // 鉱脈の煌めき (金鉱の粒が明滅)
  const veins = [[10, 30], [W - 11, 33], [12, 41], [W - 13, 22]];
  for (let i = 0; i < veins.length; i++) {
    const [vx, vy] = veins[i];
    const tw = 0.5 + 0.5 * Math.sin(t * 0.004 + i * 1.9);
    vctx.fillStyle = `rgba(230,180,80,${0.3 + 0.5 * tw})`;
    vctx.fillRect(vx, vy, 1.4, 1.4);
  }

  // トロッコの軌道 (坑奥から手前へ末広がり) と枕木
  vctx.strokeStyle = "rgba(125,115,105,0.5)";
  vctx.lineWidth = 1;
  vctx.beginPath(); vctx.moveTo(tx - 3, openBot - 2); vctx.lineTo(tx - 7, H - 3); vctx.stroke();
  vctx.beginPath(); vctx.moveTo(tx + 3, openBot - 2); vctx.lineTo(tx + 7, H - 3); vctx.stroke();
  vctx.strokeStyle = "rgba(80,60,38,0.7)";
  vctx.lineWidth = 1.4;
  for (const [yy, hw] of [[openBot + 2, 4], [H - 4, 6]]) {
    vctx.beginPath(); vctx.moveTo(tx - hw, yy); vctx.lineTo(tx + hw, yy); vctx.stroke();
  }

  // 枠とコーナードット (テーマ共通の体裁を踏襲)
  vctx.strokeStyle = shadeHex(accent, 0.7);
  vctx.lineWidth = 2;
  vctx.strokeRect(1.5, 1.5, W - 3, H - 3);
  vctx.strokeStyle = shadeHex(accent, 0.36);
  vctx.lineWidth = 1;
  vctx.strokeRect(4.5, 4.5, W - 9, H - 9);
  vctx.fillStyle = shadeHex(accent, 0.6);
  for (const [dx, dy] of [[7, 7], [W - 7, 7], [7, H - 7], [W - 7, H - 7]]) {
    vctx.beginPath(); vctx.arc(dx, dy, 1.6, 0, Math.PI * 2); vctx.fill();
  }
  vctx.fillStyle = "rgba(255,255,255,0.05)";
  vctx.fillRect(2, 2, W - 4, 3);
}

// 層2「地下水路」のカード裏面: 石組みのアーチ水門、滴る雫が暗い水面に波紋を広げる
function drawBackWaterway(r, accent, sym) {
  const W = r.w, H = r.h, t = performance.now();
  // 石壁の地
  const bg = vctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#121b1f");
  bg.addColorStop(0.55, "#0e161a");
  bg.addColorStop(1, "#0a1014");
  vctx.fillStyle = bg;
  vctx.fillRect(0, 0, W, H);
  // 石積みの目地 (背景にうっすら)
  vctx.strokeStyle = "rgba(0,0,0,0.25)";
  vctx.lineWidth = 1;
  for (let y = 11; y < H - 16; y += 7) {
    vctx.beginPath(); vctx.moveTo(2, y + 0.5); vctx.lineTo(W - 2, y + 0.5); vctx.stroke();
  }

  const tx = W / 2, aw = 13, springY = H - 16, apexY = 14;
  // トンネル奥 (闇に沈む水路の口)
  vctx.save();
  vctx.beginPath();
  vctx.moveTo(tx - aw, springY);
  vctx.lineTo(tx - aw, apexY);
  vctx.arc(tx, apexY, aw, Math.PI, 0);
  vctx.lineTo(tx + aw, springY);
  vctx.closePath();
  vctx.clip();
  const depth = vctx.createRadialGradient(tx, springY, 2, tx, apexY, 30);
  depth.addColorStop(0, "#0a181c");
  depth.addColorStop(1, "#03070a");
  vctx.fillStyle = depth;
  vctx.fillRect(tx - aw, apexY - aw, aw * 2, springY - apexY + aw);
  vctx.restore();

  // アーチの石組み (迫石)
  vctx.save();
  vctx.lineCap = "round";
  vctx.strokeStyle = "#3a4750";
  vctx.lineWidth = 5;
  vctx.beginPath();
  vctx.moveTo(tx - aw, springY);
  vctx.lineTo(tx - aw, apexY);
  vctx.arc(tx, apexY, aw, Math.PI, 0);
  vctx.lineTo(tx + aw, springY);
  vctx.stroke();
  // アーチ上辺の月光ハイライト
  vctx.strokeStyle = "rgba(150,180,190,0.25)";
  vctx.lineWidth = 1.5;
  vctx.beginPath(); vctx.arc(tx, apexY, aw + 1.5, Math.PI, 0); vctx.stroke();
  vctx.restore();
  // 迫石の放射状の目地
  vctx.strokeStyle = "rgba(10,16,18,0.7)";
  vctx.lineWidth = 1;
  for (let k = 0; k <= 4; k++) {
    const a = Math.PI + (Math.PI * k) / 4;
    const ix = tx + Math.cos(a) * (aw - 3), iy = apexY + Math.sin(a) * (aw - 3);
    const ox = tx + Math.cos(a) * (aw + 3), oy = apexY + Math.sin(a) * (aw + 3);
    vctx.beginPath(); vctx.moveTo(ix, iy); vctx.lineTo(ox, oy); vctx.stroke();
  }
  // 要石
  vctx.fillStyle = "#4a5862";
  vctx.fillRect(tx - 2.5, apexY - aw - 2.5, 5, 5);

  // 水路 (下部の暗い水面)
  const waterY = H - 13;
  const wg = vctx.createLinearGradient(0, waterY, 0, H);
  wg.addColorStop(0, "#0e2a30");
  wg.addColorStop(1, "#07161a");
  vctx.fillStyle = wg;
  vctx.fillRect(0, waterY, W, H - waterY);
  // 水面のゆらめき (反射) と中央の門の映り込み
  for (let i = 0; i < 3; i++) {
    const ry = waterY + 2 + i * 3;
    const off = Math.sin(t * 0.0015 + i * 1.3) * 6;
    vctx.fillStyle = `rgba(120,200,215,${0.16 - i * 0.04})`;
    vctx.fillRect(0, ry, W, 1);
    vctx.fillStyle = `rgba(90,170,190,${0.12 - i * 0.03})`;
    vctx.fillRect(tx - 6 + off * 0.3, ry, 12, 1);
  }
  vctx.fillStyle = "rgba(150,210,225,0.4)";
  vctx.fillRect(0, waterY, W, 1);

  // 滴り落ちる雫 (アーチ頂点から周期的に落下 → 着水で波紋)
  const ph = (t % 1600) / 1600, dripX = tx + 0.5;
  const startY = apexY + 2, endY = waterY - 1;
  if (ph < 0.6) {
    const dy = startY + (endY - startY) * (ph / 0.6);
    vctx.fillStyle = "rgba(170,225,235,0.85)";
    vctx.fillRect(dripX - 0.5, dy, 1.5, 3);
  } else {
    const rp = (ph - 0.6) / 0.4;
    vctx.strokeStyle = `rgba(160,220,235,${0.5 * (1 - rp)})`;
    vctx.lineWidth = 1;
    vctx.beginPath();
    vctx.ellipse(dripX, waterY + 1, 2 + rp * 9, 1 + rp * 2, 0, 0, Math.PI * 2);
    vctx.stroke();
  }

  // 枠とコーナードット (テーマ共通の体裁を踏襲)
  vctx.strokeStyle = shadeHex(accent, 0.7);
  vctx.lineWidth = 2;
  vctx.strokeRect(1.5, 1.5, W - 3, H - 3);
  vctx.strokeStyle = shadeHex(accent, 0.36);
  vctx.lineWidth = 1;
  vctx.strokeRect(4.5, 4.5, W - 9, H - 9);
  vctx.fillStyle = shadeHex(accent, 0.6);
  for (const [dx, dy] of [[7, 7], [W - 7, 7], [7, H - 7], [W - 7, H - 7]]) {
    vctx.beginPath(); vctx.arc(dx, dy, 1.6, 0, Math.PI * 2); vctx.fill();
  }
  vctx.fillStyle = "rgba(255,255,255,0.05)";
  vctx.fillRect(2, 2, W - 4, 3);
}

// 層1「墓地」のカード裏面: 蒼い月の下、霧に沈む墓石と十字の彫り込み
function drawBackGraveyard(r, accent, sym) {
  const W = r.w, H = r.h;
  // 夜気の地: 上は蒼い夜、下は墓土
  const bg = vctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#1a1b24");
  bg.addColorStop(0.55, "#16140f");
  bg.addColorStop(1, "#100e0a");
  vctx.fillStyle = bg;
  vctx.fillRect(0, 0, W, H);

  // 蒼い月 (右上にぼうっとにじむ)
  const mx = W - 14, my = 13;
  const mg = vctx.createRadialGradient(mx, my, 1, mx, my, 12);
  mg.addColorStop(0, "rgba(205,222,236,0.5)");
  mg.addColorStop(0.5, "rgba(150,180,210,0.16)");
  mg.addColorStop(1, "rgba(150,180,210,0)");
  vctx.fillStyle = mg;
  vctx.fillRect(mx - 12, my - 12, 24, 24);
  vctx.fillStyle = "rgba(220,230,240,0.66)";
  vctx.beginPath(); vctx.arc(mx, my, 4.6, 0, Math.PI * 2); vctx.fill();
  vctx.fillStyle = "rgba(22,20,15,0.5)"; // 月の翳り
  vctx.beginPath(); vctx.arc(mx + 2.3, my - 1.4, 3.9, 0, Math.PI * 2); vctx.fill();

  // 奥に傾いた古い墓標 (シルエット)
  vctx.save();
  vctx.translate(13, 31); vctx.rotate(-0.13);
  vctx.fillStyle = "#222229";
  vctx.fillRect(-3.5, -9, 7, 17);
  vctx.beginPath(); vctx.arc(0, -9, 3.5, Math.PI, 0); vctx.fill();
  vctx.restore();

  // 地面の盛り土
  const gy = H - 11;
  vctx.fillStyle = "#1c1812";
  vctx.beginPath();
  vctx.moveTo(0, gy + 3);
  vctx.quadraticCurveTo(W / 2, gy - 4, W, gy + 3);
  vctx.lineTo(W, H); vctx.lineTo(0, H); vctx.closePath();
  vctx.fill();

  // 中央の墓石 (ラウンドトップの墓標)
  const tx = W / 2, baseY = gy + 2, topY = 15, tw = 8.5;
  const stone = vctx.createLinearGradient(tx - tw, 0, tx + tw, 0);
  stone.addColorStop(0, "#696974");
  stone.addColorStop(0.5, "#8b8b96");
  stone.addColorStop(1, "#53535d");
  vctx.fillStyle = stone;
  vctx.beginPath();
  vctx.moveTo(tx - tw, baseY);
  vctx.lineTo(tx - tw, topY);
  vctx.arc(tx, topY, tw, Math.PI, 0);
  vctx.lineTo(tx + tw, baseY);
  vctx.closePath();
  vctx.fill();
  vctx.strokeStyle = "#36363e"; vctx.lineWidth = 1; vctx.stroke();
  vctx.fillStyle = "rgba(255,255,255,0.12)"; // 左の月光
  vctx.fillRect(tx - tw + 1, topY, 1.5, baseY - topY);
  vctx.fillStyle = "rgba(0,0,0,0.22)";      // 右の影
  vctx.fillRect(tx + tw - 2, topY, 1.5, baseY - topY);
  // 十字の彫り込み
  vctx.fillStyle = "#3a3a42";
  vctx.fillRect(tx - 1, topY + 1, 2, 11);
  vctx.fillRect(tx - 4, topY + 4, 8, 2);

  // 立ちこめる霧 (下部で淡くたゆたう)
  const t = performance.now() * 0.0012;
  for (let i = 0; i < 3; i++) {
    const fy = H - 5 - i * 3;
    vctx.fillStyle = `rgba(190,200,206,${0.11 - i * 0.025})`;
    const off = Math.sin(t + i * 1.7) * 5;
    vctx.beginPath();
    vctx.ellipse(W / 2 + off, fy, W * 0.5, 3, 0, 0, Math.PI * 2);
    vctx.fill();
  }

  // 枠とコーナードット (テーマ共通の体裁を踏襲)
  vctx.strokeStyle = shadeHex(accent, 0.7);
  vctx.lineWidth = 2;
  vctx.strokeRect(1.5, 1.5, W - 3, H - 3);
  vctx.strokeStyle = shadeHex(accent, 0.36);
  vctx.lineWidth = 1;
  vctx.strokeRect(4.5, 4.5, W - 9, H - 9);
  vctx.fillStyle = shadeHex(accent, 0.6);
  for (const [dx, dy] of [[7, 7], [W - 7, 7], [7, H - 7], [W - 7, H - 7]]) {
    vctx.beginPath(); vctx.arc(dx, dy, 1.6, 0, Math.PI * 2); vctx.fill();
  }
  vctx.fillStyle = "rgba(255,255,255,0.06)";
  vctx.fillRect(2, 2, W - 4, 3);
}

// 第1層以外の層の裏面 (旧来の層別イラストカード)。盤面の静的な層へ焼く時だけ使う (vctx を差し替えて呼ぶ)
function drawOldCardBack(r) {
  if (G.eliteFloor) {
    // 強敵階カード裏面: 血の黒紅 + 骸骨紋
    const bg = vctx.createLinearGradient(0, 0, r.w, r.h);
    bg.addColorStop(0, "#280808");
    bg.addColorStop(0.5, "#180505");
    bg.addColorStop(1, "#100303");
    vctx.fillStyle = bg;
    vctx.fillRect(0, 0, r.w, r.h);
    // 外枠 (血の赤)
    vctx.strokeStyle = "#882020";
    vctx.lineWidth = 2;
    vctx.strokeRect(1.5, 1.5, r.w - 3, r.h - 3);
    vctx.strokeStyle = "#551010";
    vctx.lineWidth = 1;
    vctx.strokeRect(4.5, 4.5, r.w - 9, r.h - 9);
    // 中央の骸骨シンボル
    const cx = r.w / 2, cy = r.h / 2;
    vctx.fillStyle = "#cc2020";
    vctx.font = "bold 16px monospace";
    vctx.textAlign = "center";
    vctx.textBaseline = "middle";
    vctx.fillText("☠", cx, cy + 1);
    // コーナードット (血の色)
    vctx.fillStyle = "#882020";
    for (const [dx, dy] of [[7, 7], [r.w - 7, 7], [7, r.h - 7], [r.w - 7, r.h - 7]]) {
      vctx.beginPath(); vctx.arc(dx, dy, 1.6, 0, Math.PI * 2); vctx.fill();
    }
    // 上辺の血にじみ
    vctx.fillStyle = "rgba(200,0,0,0.10)";
    vctx.fillRect(2, 2, r.w - 4, 3);
  } else if (specialDef()) {
    // 特別階カード裏面: 階ごとのテーマ色の地 + 固有の紋章
    const sp = specialDef();
    drawThemedBack(r, sp.accent, sp.sym);
  } else if (dungeonTheme()) {
    // 迷宮テーマのカード裏面 (層ごと): 層固有のイラストがあれば使う
    const th = dungeonTheme();
    if (th.back) th.back(r, th.accent, th.sym);
    else drawThemedBack(r, th.accent, th.sym);
  } else {
    // 通常カード裏面 (D21以降): 深紅の布地 + 金の縁飾り + ダイヤ紋
    const bg = vctx.createLinearGradient(0, 0, r.w, r.h);
    bg.addColorStop(0, "#7a5616");
    bg.addColorStop(0.5, "#5e420f");
    bg.addColorStop(1, "#46300a");
    vctx.fillStyle = bg;
    vctx.fillRect(0, 0, r.w, r.h);
    // 外枠 (二重)
    vctx.strokeStyle = "#e3bd45";
    vctx.lineWidth = 2;
    vctx.strokeRect(1.5, 1.5, r.w - 3, r.h - 3);
    vctx.strokeStyle = "#8a6a18";
    vctx.lineWidth = 1;
    vctx.strokeRect(4.5, 4.5, r.w - 9, r.h - 9);
    // 中央のダイヤ紋
    const cx = r.w / 2, cy = r.h / 2;
    vctx.strokeStyle = "#caa22e";
    vctx.beginPath();
    vctx.moveTo(cx, cy - 11); vctx.lineTo(cx + 9, cy); vctx.lineTo(cx, cy + 11); vctx.lineTo(cx - 9, cy); vctx.closePath();
    vctx.stroke();
    // コーナードット
    vctx.fillStyle = "#caa22e";
    for (const [dx, dy] of [[7, 7], [r.w - 7, 7], [7, r.h - 7], [r.w - 7, r.h - 7]]) {
      vctx.beginPath(); vctx.arc(dx, dy, 1.6, 0, Math.PI * 2); vctx.fill();
    }
    // 「?」
    vctx.fillStyle = "#f0d069";
    vctx.font = "bold 15px monospace";
    vctx.textAlign = "center";
    vctx.textBaseline = "middle";
    vctx.fillText("?", cx, cy + 1);
    // 上辺ハイライト
    vctx.fillStyle = "rgba(255,235,170,0.18)";
    vctx.fillRect(2, 2, r.w - 4, 3);
  }
}

// ---- 移動とカードめくり ----
// 現在地から (x,y) への辺が壁で塞がれていないか
function edgeOpen(x, y) {
  const dx = x - G.px, dy = y - G.py;
  const cur = G.board.cells[G.py][G.px];
  if (dx === 1) return !cur.walls.e;
  if (dx === -1) return !cur.walls.w;
  if (dy === 1) return !cur.walls.s;
  if (dy === -1) return !cur.walls.n;
  return false;
}

// (x,y) が移動先候補か: 隣接していて辺に壁がない
function isStep(x, y) {
  if (Math.abs(x - G.px) + Math.abs(y - G.py) !== 1) return false;
  return edgeOpen(x, y);
}

const DIRS_G = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };

// 自動移動で到達できるすべてのマスのキー集合を返す
// (公開済みマスを中間路として、未公開マスは最終1歩だけ許可)
function getReachableCells() {
  const key = (x, y) => x + "," + y;
  const reachable = new Set();
  const seen = new Set([key(G.px, G.py)]);
  const q = [[G.px, G.py]];
  while (q.length) {
    const [x, y] = q.shift();
    for (const d in DIRS_G) {
      if (G.board.cells[y][x].walls[d]) continue;
      const nx = x + DIRS_G[d][0], ny = y + DIRS_G[d][1];
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      if (seen.has(key(nx, ny))) continue;
      seen.add(key(nx, ny));
      reachable.add(key(nx, ny));
      if (G.board.cells[ny][nx].revealed) q.push([nx, ny]);
    }
  }
  return reachable;
}

function tryMove(dx, dy) {
  moveTo(G.px + dx, G.py + dy);
}

// 単発移動 (方向キー/ボタン/隣接クリック)。ガード後に1歩進む
function moveTo(nx, ny) {
  if (G.state !== "board" || G.anim || G.walking || uiBlocked()) return;
  if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) return;
  if (Math.abs(nx - G.px) + Math.abs(ny - G.py) !== 1) return;
  // 辺が壁で塞がれている: 進めない (壁の通り抜けは不可)。連続表示は抑制
  if (!edgeOpen(nx, ny)) {
    SFX.miss();
    const now = performance.now();
    if (now - (G._lastWallLog || 0) > 700) { log("壁があって進めない。", "sys"); G._lastWallLog = now; }
    // ブロックした壁を赤くフラッシュして視覚的に知らせる
    const dir = nx > G.px ? "e" : nx < G.px ? "w" : ny > G.py ? "s" : "n";
    G.wallFlash = { x: G.px, y: G.py, dir, t0: now };
    const tick = () => {
      if (!G.wallFlash) return;
      renderBoard();
      if (G.wallFlash) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return;
  }
  moveStep(nx, ny);
}

// 隣接マスへ1歩進む実体。未公開ならめくり→スライド、完了後に onDone
function moveStep(nx, ny, onDone) {
  const cell = G.board.cells[ny][nx];
  G._facing = nx > G.px ? "right" : nx < G.px ? "left" : ny < G.py ? "up" : "down"; // 駒は歩く向きを向く
  G.prevPos = { x: G.px, y: G.py };
  G.anim = { busy: true };

  // キャラが現在地から次マスへスライド → 中身を解決
  const slide = () => {
    G.heroAnim = { fromX: G.px, fromY: G.py, toX: nx, toY: ny, t0: performance.now(), dur: walkMs(150) };
    const tick = () => {
      renderBoard();
      if (performance.now() - G.heroAnim.t0 >= G.heroAnim.dur) {
        G.heroAnim = null;
        G.anim = null;
        G.px = nx; G.py = ny;
        revealByCartography();
        renderBoard();
        resolveCell(cell);
        // 毒は1歩ごとに蝕む (戦闘/選択へ移っていなければ)
        if (G.state === "board" && !G.prompt) tickPoison();
        if (G.state === "board" && !G.prompt) evProgress(); // 誓い・頼みの達成
        autosave(true); // 1歩進むたびに保存 (やり直し不可)
        if (onDone) onDone();
      } else {
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
  };

  if (!cell.revealed) {
    SFX.flip();
    buzz(12);
    cell.revealed = true; // めくり途中に表面を見せる
    G.flipAnim = { x: nx, y: ny, t0: performance.now(), dur: walkMs(240) };
    const ftick = () => {
      renderBoard();
      if (performance.now() - G.flipAnim.t0 >= G.flipAnim.dur) {
        G.flipAnim = null;
        SFX.step();
        slide();
      } else {
        requestAnimationFrame(ftick);
      }
    };
    requestAnimationFrame(ftick);
  } else {
    SFX.step();
    slide();
  }
}

// 壁を考慮した最短経路 (現在地 → tx,ty)。歩く順の {x,y} 配列を返す。
// 途中は「めくり済みのマス」だけを通り、未公開カードは勝手にめくらない。
// ただし目的地が未公開でも、めくり済み領域に隣接していれば最後の1歩としてめくれる。
function findPath(tx, ty) {
  if (tx === G.px && ty === G.py) return [];
  const key = (x, y) => x + "," + y;
  const prev = new Map();
  const seen = new Set([key(G.px, G.py)]);
  const q = [[G.px, G.py]];
  while (q.length) {
    const [x, y] = q.shift();
    for (const d in DIRS_G) {
      if (G.board.cells[y][x].walls[d]) continue;
      const nx = x + DIRS_G[d][0], ny = y + DIRS_G[d][1];
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      const isTarget = nx === tx && ny === ty;
      // 中間マスはめくり済みのみ。目的地のみ未公開カード(最後の1歩)を許可
      if (!G.board.cells[ny][nx].revealed && !isTarget) continue;
      if (seen.has(key(nx, ny))) continue;
      seen.add(key(nx, ny));
      prev.set(key(nx, ny), [x, y]);
      if (isTarget) {
        const path = [];
        let cx = nx, cy = ny;
        while (cx !== G.px || cy !== G.py) {
          path.push({ x: cx, y: cy });
          [cx, cy] = prev.get(key(cx, cy));
        }
        return path.reverse();
      }
      q.push([nx, ny]);
    }
  }
  return []; // 連結保証されているので通常到達する
}

// 経路に沿って1歩ずつ自動で歩く。戦闘や階段で中断
// 歩いている途中で別のマスをタップすると walkRedirect に行き先が入り、次の1歩の区切りで経路を引き直す
let walkRedirect = null;
function autoWalk(path) {
  if (!path.length) return;
  G.walking = true;
  walkRedirect = null;
  const next = () => {
    if (walkRedirect) { const t = walkRedirect; walkRedirect = null; path = findPath(t.x, t.y); }
    if (G.state !== "board" || G.prompt || !path.length) { G.walking = false; walkRedirect = null; renderBoard(); return; }
    const { x, y } = path.shift();
    // 念のため隣接・開通を確認
    if (Math.abs(x - G.px) + Math.abs(y - G.py) !== 1 || !edgeOpen(x, y)) {
      G.walking = false; renderBoard(); return;
    }
    moveStep(x, y, () => {
      if (G.state !== "board" || G.prompt) { G.walking = false; walkRedirect = null; return; } // 戦闘/選択で中断
      if (path.length || walkRedirect) setTimeout(next, walkMs(110));
      else { G.walking = false; renderBoard(); }
    });
  };
  next();
}

// ===== 盤面の出来事 (§3.6 割り込みの方針) =====
// 決断 (宝箱・あたたかい死体・泉・黒い泉・階段・帰還陣) だけをシートで問い、
// 褒美・罠の解除・軽い痛手・風化した死体はトースト (札の明滅) で知らせて歩みを止めない。
// 札 (カード) で止めるのは、倒れた者が出た時・飛ばされた時・呼び寄せた時・戦闘が始まる時だけ。
function resolveCell(cell) {
  switch (cell.type) {
    case "monster":
      if (!cell.cleared) {
        const name = MONSTERS[cell.monsterKey].name;
        if (cell.elite) {
          // 強敵は群れない: 規格外の1体が立ちはだかる
          log(`☠ 強敵 ${name} が立ちはだかる！`, "dmg");
          startBattle(soloFoes(spawnEliteEnemies(cell.monsterKey, soloScale())), cell);
        } else {
          log(`⚔ ${name} のカードだ！`, "dmg");
          // 迷宮の異変 (飢えた狩場): 敵が常に群れで現れる
          startBattle(spawnCardEnemies(cell.monsterKey, G.floor, enemyScale(), { min: mutNum("packMin", 0) }), cell);
        }
      }
      break;
    case "chest": {
      if (cell.cleared) break;
      askOpenChest(cell);
      break;
    }
    case "trap": {
      if (cell.cleared) break;
      cell.cleared = true;
      // 迷宮ランクに応じた罠を抽選し、パーティで最も解除値 (AGI+LUK・盗賊系1.5倍) が高い者が解除を試みる
      const trap = pickTrap(activeCfg().rank || 1);
      const best = bestDisarmer();
      if (best && Math.random() < disarmChance(best)) {
        SFX.chest();
        G.stats.trapsDisarmed++; // 戦績: 解除した罠 (勲章用)
        log(`床の罠「${trap.name}」を ${best.name}が見抜き、解除した！`, "sys");
        showToast(`床の罠「${trap.name}」― ${best.name}が見抜いて解除`, { tone: "good", icon: ICONS.trap });
        break;
      }
      presentTrap(applyTrap(trap, best), { proceed: () => renderBoard() }, boardSink());
      break;
    }
    case "poison": {
      // 毒の床: 踏むたびに隊全体を蝕む。毒床耐性 (盗賊系) で半減/無効
      const resist = partyPassiveLv("poisonFloor");
      if (resist >= 2) {
        if (resist >= 3) { // Lv3: 無効化に加え、渡るたび隊全体をHP2%回復
          let healed = false;
          for (const p of G.party) { if (!p.alive) continue; const h = Math.max(1, Math.ceil(p.maxhp * 0.02)); if (p.hp < p.maxhp) { p.hp = Math.min(p.maxhp, p.hp + h); healed = true; } }
          log(healed ? "毒の床を浄化して渡った。よどみが力に変わり、パーティの傷が癒えた。" : "毒の床を浄化して渡った。", "sys");
          if (healed) renderParty();
        } else {
          log("毒の床だ。だが足音ひとつ立てず無傷で渡った。", "sys");
        }
        break;
      }
      SFX.trap(); buzz([0, 40, 30, 40]);
      flashScreen("#5a8a2a");
      // 床ダメージ率: 基本5% + 層に応じて微増 (層1=5% → 層20≈10.7%, 上限12%)。
      // 深層ほど毒沼が脅威であり続けるようにする。
      const layer = activeCfg().layer || layerOf(dungeonNumber(activeCfg()));
      const pct = Math.min(0.12, 0.05 + (layer - 1) * 0.003);
      let anyDeath = false;
      const fallen = [], hurt = [];
      for (const p of G.party) {
        if (!p.alive) continue;
        let dmg = Math.max(1, Math.ceil(p.maxhp * pct));
        if (resist === 1) dmg = Math.max(1, Math.ceil(dmg * 0.5));
        p.hp = Math.max(0, p.hp - dmg);
        hurt.push(p);
        if (p.hp === 0) { p.alive = false; anyDeath = true; fallen.push(p.name); log(`${p.name}は毒に沈んだ…`, "dmg"); }
      }
      log(`毒の床だ！ パーティ全体が蝕まれた${resist === 1 ? " (耐性で半減)" : ""}`, "dmg");
      flashPartyCards(hurt, "hit");
      if (!anyDeath) {
        // 軽い痛手はトーストと札の明滅だけ (歩みを止めない)
        showToast(`毒の床 ― パーティ全体が蝕まれた${resist === 1 ? " (耐性で半減)" : ""}`, { tone: "bad", icon: ICONS.poison });
        break;
      }
      // 倒れた者が出た時だけ札で知らせる
      showEvent({
        sprite: ICONS.poison, title: "毒の床！", accent: "#5a8a2a", banner: "⚠ 危険 ⚠",
        lines: [`パーティ全体が蝕まれた${resist === 1 ? " (耐性で半減)" : ""}…`, ...fallen.map((n) => `${n}は毒に沈んだ…`)],
        btnLabel: "進む",
        onClose: () => {
          SFX.die(); imprintFallen(); if (!G.party.some((p) => p.alive)) { gameOver(); return; }
          renderBoard();
        },
      });
      break;
    }
    case "portal":
      // 帰還魔法陣: 何度でも使える。踏むたびに帰還するか選ぶ。
      // 発見後は下の行動ドックの「帰還」で、どこからでも街へ戻れる。
      G.portalFound = true;
      updateReturnBtn();
      askPortalReturn();
      break;
    case "fountain": {
      if (cell.cleared) break;
      // 泉の正体は最初に踏んだ時に決まる: 25% で「黒い泉」(賭け) になる
      if (!cell.fountainKind) cell.fountainKind = Math.random() < 0.25 ? "dark" : "pure";
      if (cell.fountainKind === "dark") {
        showChoice("黒い泉が湧いている。底が見えない…", [
          { label: "飲む ― 大いなる恵み / 呪いの危険", danger: true, fn: () => useDarkFountain(cell) },
          { label: "近寄らない", fn: () => { log("黒い泉には触れなかった。", "sys"); renderBoard(); } },
        ], ICONS.fountain, { banner: "⚠ 黒い泉 ⚠", accent: "#8a2be2", lines: ["五分の賭けだ。恵みなら全快して Soul を得る。呪いなら生気を吸われる。"] });
        break;
      }
      // §7 M4: 皆が満ちている (HP/MP満タン・状態異常なし) なら問わない。泉はそのまま残り、後で使える
      const needs = G.party.some((p) => p.alive && (p.hp < p.maxhp || p.mp < p.maxmp || p.ailment));
      if (!needs) {
        log("癒しの泉だ。いまは皆満ちている。泉はそのまま残した。", "sys");
        showToast("癒しの泉 ― 皆満ちている (後で使える)", { tone: "info", icon: ICONS.fountain });
        break;
      }
      // 利用するか選べる。今使わなくても泉は残り、後から再訪して使える。
      showChoice("癒しの泉が湧いている。", [
        { label: "泉を利用する", primary: true, fn: () => useFountain(cell) },
        { label: "今はやめておく", fn: () => { log("泉はそのままにした。後で使える。", "sys"); renderBoard(); } },
      ], ICONS.fountain, { banner: "✦ 癒しの泉 ✦", accent: "#5fb8d6", lines: ["HPとMPが回復し、毒も癒える。一度きり。"] });
      break;
    }
    case "corpse": {
      if (cell.cleared) break;
      resolveCorpse(cell);
      break;
    }
    case "stairs":
      askDescend(cell);
      break;
    case "event":
      if (cell.cleared) break;
      runEvent(evApi, cell);
      break;
  }
}

// ===== 迷宮のイベント (出来事マス) — src/events.js の定義を盤面・戦闘・報酬へつなぐ =====
// 状態: G.events (見聞録・一度きり・恒久の恵み / 保存) ・ G.run.ev (この潜入) ・ G.board.ev (この階)
function evRun() {
  if (!G.run) G.run = newRun();
  if (!G.run.ev || typeof G.run.ev !== "object") G.run.ev = { mods: [] };
  if (!Array.isArray(G.run.ev.mods)) G.run.ev.mods = [];
  return G.run.ev;
}
function evFloor() {
  if (!G.board) return { mods: [] };
  if (!G.board.ev || typeof G.board.ev !== "object") G.board.ev = { mods: [] };
  if (!Array.isArray(G.board.ev.mods)) G.board.ev.mods = [];
  return G.board.ev;
}
// 「戦果1」= この迷宮・この階の通常戦闘1回で得る gold (半減前の素の値) / ✦Soul の目安
function evUnit() {
  const cfg = activeCfg();
  const keys = [...(cfg.pool || []), ...(cfg.deepPool || [])].filter((k) => MONSTERS[k]);
  let g = 0, so = 0;
  for (const k of keys) { g += MONSTERS[k].gold || 0; so += MONSTERS[k].soul || 0; }
  const n = Math.max(1, keys.length);
  const sc = (cfg.enemyScale || 1) * (1 + (G.floor - 1) * 0.06);
  const per = 1.9; // 1戦の平均の敵数
  // 戦闘の金貨は endBattle で ×2 → runGainGold で ×0.5。素の値は「1体の金貨×数×2」
  return { gold: Math.max(6, (g / n) * sc * per * 2), soul: Math.max(3, (so / n) * sc * per) };
}
const evJit = () => 0.85 + Math.random() * 0.3;
function evAlive() { return G.party.filter((p) => p.alive); }
function evPoolKey() {
  const rv = evRun();
  let pool = sfMonsterPool().filter((k) => MONSTERS[k] && !MONSTERS[k].boss && !MONSTERS[k].elite);
  if (rv.noBeast) { const nb = pool.filter((k) => MONSTERS[k].race !== "beast"); if (nb.length) pool = nb; }
  return pool.length ? pool[rand(pool.length)] : "cm_slime";
}
function evCells(fn) { const out = []; if (G.board) sfEachCell(G.board, (c) => { if (fn(c)) out.push(c); }); return out; }
function evCellPos(cell) {
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (G.board.cells[y][x] === cell) return { x, y };
  return null;
}
function evRevealStairs() {
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const c = G.board.cells[y][x];
    if (c.type !== "stairs") continue;
    c.revealed = true;
    for (const d in DIRS_G) {
      if (c.walls[d]) continue;
      const nx = x + DIRS_G[d][0], ny = y + DIRS_G[d][1];
      if (nx >= 0 && ny >= 0 && nx < COLS && ny < ROWS) G.board.cells[ny][nx].revealed = true;
    }
  }
}
// 空きマスに宝箱を置く (rankUp: 宝箱ランクの上乗せ / reveal: 最初から見える / mark: 地図の×印)
function evPlaceChest({ rankUp = 0, reveal = false, mark = false } = {}) {
  const cand = evCells((c) => c.type === "empty" && !(G.board.start && G.board.cells[G.board.start.y][G.board.start.x] === c) && !(G.board.cells[G.py] && G.board.cells[G.py][G.px] === c));
  if (!cand.length) return null;
  const c = cand[rand(cand.length)];
  c.type = "chest"; c.cleared = false;
  c.cRank = Math.min(5, chestRankOf(null) + rankUp);
  if (reveal) c.revealed = true;
  if (mark) c.evMark = true;
  return c;
}
function evPurgeBeasts() {
  let n = 0;
  for (const c of evCells((c) => c.type === "monster" && !c.cleared && !c.elite && MONSTERS[c.monsterKey] && MONSTERS[c.monsterKey].race === "beast")) {
    const k = evPoolKey();
    if (MONSTERS[k] && MONSTERS[k].race !== "beast") c.monsterKey = k;
    else { c.type = "empty"; c.cleared = true; delete c.monsterKey; }
    n++;
  }
  return n;
}
// 自分の隊の影 (鏡の間): 人業の絵を闇色に沈め、能力を ratio 倍で写す
const _shadeSpr = new Map();
function evShadeSprite(p) {
  const key = (p.clsKey || "fighter") + ":" + (p.rank || 2);
  if (_shadeSpr.has(key)) return _shadeSpr.get(key);
  let spr = null;
  try { spr = jobSprite(p.clsKey || "fighter", 2); } catch (e) { spr = null; }
  // 原画版の絵は、魔物の絵に焼く時 (monsterBitmap) に闇色へ沈める
  if (spr && spr.photo) { const out = { photo: spr.photo, w: spr.w, h: spr.h, shade: true }; _shadeSpr.set(key, out); return out; }
  if (!spr || !spr.art) spr = HERO;
  const dark = (hex) => {
    if (typeof hex !== "string" || !/^#[0-9a-f]{6}$/i.test(hex)) return hex;
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const l = (r * 0.3 + g * 0.59 + b * 0.11) / 255;
    const mix = (base, k) => Math.round(base * 0.35 + k * l * 0.65);
    return "#" + [mix(40, 150), mix(16, 90), mix(70, 220)].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("");
  };
  const palette = {};
  for (const k in spr.palette) palette[k] = dark(spr.palette[k]);
  const out = { ...spr, palette, art: spr.art };
  _shadeSpr.set(key, out);
  return out;
}
function evShadow(p, ratio) {
  const e = spawnEliteEnemies(evPoolKey(), enemyScale())[0];
  const spr = evShadeSprite(p);
  e.key = "ev_shade";
  e.mon = { name: `${p.name}の影`, race: "specter", rank: 1, palette: spr.palette, art: spr.art, desc: "鏡に映った己の影。" };
  if (spr.photo) Object.assign(e.mon, { photo: spr.photo, w: spr.w, h: spr.h, shade: true });
  e.name = `${p.name}の影`;
  e.maxhp = e.hp = Math.max(1, Math.round((p.maxhp || 10) * ratio));
  e.atk = Math.max(1, Math.round(Math.max(p.atk || 1, p.int || 0) * ratio));
  e.vit = Math.round((p.vit || 0) * ratio);
  e.agi = Math.max(1, Math.round((p.agi || 1) * ratio));
  e.soul = Math.round((e.soul || 1) * 1.5);
  e.ability = null; e.physResist = 0; e.magResist = 0; e.magWeak = 1; e.regen = 0; e.evasive = false;
  e.role = null; e.summonKey = null; e.element = "dark";
  return e;
}
// 強化個体 (封印の魔物・看守・大鰐など): HP と力を底上げし、報酬も相応に
function evBoost(e, s) {
  e.maxhp = e.hp = Math.max(1, Math.round(e.maxhp * s));
  e.atk = Math.max(1, Math.round(e.atk * (1 + (s - 1) * 0.35)));
  e.vit = Math.round(e.vit * (1 + (s - 1) * 0.2));
  e.soul = Math.round(e.soul * s); e.gold = Math.round(e.gold * s);
  return e;
}
// 出来事の戦闘の敵を組み立てる (cell.evFight.specs から。逃げて戻った時も同じ顔ぶれを作り直す)
function evBuildFoes(specs) {
  const scale = enemyScale();
  const out = [];
  for (const sp of specs || []) {
    if (sp.shadows) { for (const p of evAlive()) out.push(evShadow(p, sp.shadows)); continue; }
    // 強敵・出来事の魔物は雑魚の手直しではなく soloMul で (soloFoes)
    if (sp.elite) { out.push(...soloFoes(spawnEliteEnemies(sp.key && MONSTERS[sp.key] ? sp.key : eliteKey(), soloScale() * (sp.strong || 1)))); continue; }
    // 出来事の魔物: その階の雑魚の最上位ランク + ranked の体で現れる (ミミックと同じ基準 mimicRef)
    if (sp.ranked && sp.key && MONSTERS[sp.key]) { const e = soloFoes(spawnRanked(sp.key, mimicRef().rank, sp.ranked, soloScale()))[0]; if (sp.name) e.name = sp.name; out.push(e); continue; }
    const key = sp.key && MONSTERS[sp.key] ? sp.key : (sp.undead ? undeadKeyForDungeon() : evPoolKey());
    if (sp.strong) { const e = evBoost(spawnEliteEnemies(key, scale)[0], sp.strong); if (sp.name) e.name = sp.name; out.push(e); continue; }
    if (sp.single) { out.push(spawnEliteEnemies(key, scale)[0]); continue; }
    out.push(...spawnCardEnemies(key, G.floor, scale, { min: Math.max(sp.min || 0, mutNum("packMin", 0)) }));
  }
  const list = out.slice(0, 6);
  // 単体で並べた同種は A/B/C… で呼び分ける (群れは spawnCardEnemies が済ませている)
  const byKey = {};
  for (const e of list) if (!/[A-F]$/.test(e.name)) (byKey[e.name] = byKey[e.name] || []).push(e);
  for (const k in byKey) if (byKey[k].length > 1) byKey[k].forEach((e, i) => { e.name += String.fromCharCode(65 + i); });
  return list.length ? list : spawnCardEnemies(evPoolKey(), G.floor, scale);
}
function evStartFight(cell) {
  const f = cell.evFight;
  if (!f) { renderBoard(); return; }
  G._evOpening = f.opening || null;
  startBattle(evBuildFoes(f.specs), cell);
}
// 戦闘の開始時: イベントの加護を人業へ展開し、開幕の効果 (回復・発破・層主の弱体) を掛ける
function evBattleStart(enemies, isBoss) {
  const on = inDungeon() && !abyssActive();
  const rv = on ? evRun() : {};
  let dmg = 1, prey = null;
  if (on) for (const d of activeModifierDefs()) { if (d.dmgMul) dmg *= d.dmgMul; if (d.prey) prey = d.prey; }
  const permDmg = evBoon("temper", "dmgMul", 1), permCrit = evBoon("blackCat", "crit", 0); // 極の恵み (どの戦闘でも)
  for (const p of G.party) {
    p._evDmg = (on ? dmg * (rv.ruby && rv.ruby === p.uid ? 1.15 : 1) : 1) * permDmg;
    p._evPrey = on ? prey : null;
    p._evCrit = (on ? (rv.crit || 0) : 0) + permCrit;
    p._evEDef = on ? (rv.edef || null) : null;
    p._evSave = !!(on && rv.saves && rv.saves[p.uid]);
  }
  if (!on) return;
  if (rv.startHeal > 0) {
    rv.startHeal--;
    for (const p of evAlive()) p.hp = Math.min(p.maxhp, p.hp + Math.ceil(p.maxhp * 0.10));
    log("喪服の女の祝福が、戦いの前に傷を癒した。", "heal");
  }
  if (rv.bomb > 0) {
    rv.bomb--;
    for (const e of enemies) e.hp = Math.max(1, e.hp - Math.ceil(e.maxhp * (e.boss ? 0.12 : 0.30)));
    log("発破が炸裂した！ 敵全体が爆風に呑まれた。", "win");
    setTimeout(() => showToast("💥 発破が炸裂 ― 敵全体に痛打", { tone: "gold" }), 300);
  }
  const bw = G.events && G.events.flags && G.events.flags.bossWeak;
  if (isBoss && bw && bw[battleLayer()]) {
    for (const e of enemies) if (e.boss) { e.maxhp = Math.max(1, Math.round(e.maxhp * 0.9)); e.hp = Math.min(e.hp, e.maxhp); }
    log("告解室で聞いた秘密が、主の守りの綻びを教えてくれる。(主の最大HP -10%)", "win");
  }
}
// 戦闘の後: 墓碑の加護の消費を記録し、紅玉に血を吸わせる
function evBattleEnd(won) {
  if (!inDungeon() || abyssActive() || !G.run || !G.run.ev) return;
  const rv = G.run.ev;
  if (rv.saves) for (const p of G.party) if (rv.saves[p.uid] && !p._evSave) delete rv.saves[p.uid];
  if (won && rv.ruby) {
    const h = G.party.find((p) => p.uid === rv.ruby && p.alive);
    if (h) { h.hp = Math.max(1, h.hp - Math.ceil(h.maxhp * 0.05)); log(`紅玉が${h.name}の血を吸った。`, "dmg"); }
  }
}
// 階の情報 (手帳) に並べる、いま効いている出来事の効果
function eventFacts() {
  if (!inDungeon() || abyssActive()) return [];
  const out = [];
  const ic = ICONS.event;
  const fe = (G.board && G.board.ev) || {};
  const fl = (G.events && G.events.flags) || {};
  const perm = Object.keys(EV_BOONS).filter((k) => fl[k] && (k !== "sewerMap" || battleLayer() === 2)).map((k) => EV_BOONS[k].text);
  if (perm.length) out.push({ tone: "gold", icon: ic, title: "極の恵み (恒久)", accent: "#ffcf4a", lines: perm });
  for (const m of fe.mods || []) out.push({ tone: m.enemyMul ? "bad" : "gold", icon: ic, title: `出来事「${m.name}」`, accent: "#c08aff", lines: [m.desc] });
  if (fe.oath && !fe.oath.done) out.push({ tone: "gold", icon: ic, title: "誓いの最中", accent: "#c08aff", lines: [`この階の魔物をすべて討て (残り ${evCells((c) => c.type === "monster" && !c.cleared).length}体)`, "果たさずに降りると、次の階の敵が手強くなる。"] });
  if (fe.miner && !fe.minerDone) out.push({ tone: "gold", icon: ICONS.corpse, title: "坑夫の頼み", accent: "#c08aff", lines: [`この階の亡骸をすべて調べよ (残り ${evCells((c) => c.type === "corpse" && !c.cleared).length}体)`] });
  const rv = (G.run && G.run.ev) || null;
  if (!rv) return out;
  for (const m of rv.mods || []) out.push({ tone: m.enemyMul ? "bad" : "gold", icon: ic, title: `出来事「${m.name}」`, accent: "#c08aff", lines: [m.desc] });
  const runLines = [];
  if (rv.preempt > 0) runLines.push(`祈りの蝋燭 ― 次の戦闘は必ず先制 (${rv.preempt}回)`);
  if (rv.ambushNext > 0) runLines.push("密輸人の待ち伏せ ― 次の戦闘は奇襲される");
  if (rv.startHeal > 0) runLines.push(`喪服の女の祝福 ― 開戦時にHP10%回復 (残り${rv.startHeal}戦)`);
  if (rv.bomb > 0) runLines.push(`発破 ― 次の戦闘の開幕に敵全体へ痛打 (${rv.bomb}回)`);
  if (rv.crit) runLines.push(`黒猫の幸運 ― 会心率 +${Math.round(rv.crit * 100)}%`);
  if (rv.edef) runLines.push(`土の護り ― 全員に${(ELEMENTS[rv.edef.el] || {}).label || rv.edef.el}の属性防御Lv${rv.edef.lv}`);
  if (rv.ruby) { const h = G.party.find((p) => p.uid === rv.ruby); if (h) runLines.push(`呪われた紅玉 ― ${h.name}の与ダメ+15% (戦闘のたび血を吸われる)`); }
  if (rv.saves) { const n = G.party.filter((p) => rv.saves[p.uid]).map((p) => p.name); if (n.length) runLines.push(`名を刻んだ墓碑 ― ${n.join("・")}は一度だけ死を免れる`); }
  if (rv.noBeast) runLines.push("鼠の王の盟約 ― 獣の魔物が寄りつかない");
  if (rv.mapChest > 0) runLines.push("宝の地図 ― 次の階に印の付いた宝箱");
  if (rv.bounty) runLines.push(`密輸の証拠 ― 生きて帰れば報奨金 💰${rv.bounty}`);
  if (rv.forceElite) runLines.push("縦穴の底 ― 次の階は強敵階");
  if (runLines.length) out.push({ tone: "gold", icon: ic, title: "この潜入の出来事", accent: "#c08aff", lines: runLines });
  return out;
}

// 階が変わった時: 持ち越しの効果を適用し、出来事を1つ置く (確率)
function evNewFloor() {
  if (abyssActive() || !G.board) return;
  G.board.ev = { mods: [] };
  const rv = evRun();
  if (Array.isArray(rv.nextFloorMods) && rv.nextFloorMods.length) { G.board.ev.mods.push(...rv.nextFloorMods); rv.nextFloorMods = []; }
  if (rv.mapChest > 0) { rv.mapChest--; if (evPlaceChest({ rankUp: 2, reveal: true, mark: true })) log("地図の×印 ― この階のどこかに宝箱が眠っている (印が見えている)。", "win"); }
  if (rv.noBeast) evPurgeBeasts();
  if (G.events.flags.sewerMap && battleLayer() === 2) evRevealStairs();
  const cfg = activeCfg();
  const dn = dungeonNumber(cfg), layer = battleLayer();
  if (Math.random() >= (dn <= 1 ? EV_FLOOR_RATE_D1 : EV_FLOOR_RATE)) return;
  const sx = G.board.start.x, sy = G.board.start.y;
  const ok = (c, x, y) => c.type === "empty" && !(x === sx && y === sy);
  let cand = [];
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) { const c = G.board.cells[y][x]; if (ok(c, x, y) && sfOpenCount(c) === 1) cand.push(c); }
  if (!cand.length) for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) { const c = G.board.cells[y][x]; if (ok(c, x, y) && Math.abs(x - sx) + Math.abs(y - sy) >= 3) cand.push(c); }
  if (!cand.length) return;
  const st = { layer, dn, floor: G.floor, floors: cfg.floors || 3, runEv: rv, onceDone: (e) => !!G.events.once[onceKey(e, layer)] };
  const e = pickEvent(eligibleEvents(st, evApi));
  if (!e) return;
  const cell = cand[rand(cand.length)];
  cell.type = "event"; cell.evId = e.id; cell.cleared = false;
  if (e.tier === "rare") rv.rareUsed = { ...(rv.rareUsed || {}), [e.id]: true };
  if (e.setup) e.setup(evApi, cell);
}
// 階段を降りる時: 果たしていない誓いは次の階で報いとなる
function evOnDescend() {
  const fe = G.board && G.board.ev;
  if (!fe || !fe.oath || fe.oath.done) return;
  const rv = evRun();
  rv.nextFloorMods = [...(rv.nextFloorMods || []), { src: "oath", name: "破られた誓い", desc: "敵の力 1.2倍 (この階)", enemyMul: 1.2 }];
  fe.oath.done = true;
  log("誓いを果たさずに降りた……石碑の呪いが後を追ってくる。(次の階の敵の力 1.2倍)", "dmg");
  showToast("誓いを破った ― 次の階の敵が手強い", { tone: "bad" });
}
// 誓い (石碑)・頼み (坑夫) の達成を確かめる (1歩ごと・戦闘の後)
function evProgress() {
  const fe = G.board && G.board.ev;
  if (!fe || abyssActive()) return;
  if (fe.oath && !fe.oath.done && !evCells((c) => c.type === "monster" && !c.cleared).length) {
    fe.oath.done = true;
    const stone = evCells((c) => c.type === "event" && c.evOath)[0];
    const u = evUnit();
    const s = runGainSoulPts(Math.round(u.soul * 4 * evJit()));
    if (stone) { stone.type = "chest"; stone.cleared = false; stone.revealed = true; stone.cRank = Math.min(5, chestRankOf(null) + 2); delete stone.evOath; }
    SFX.victory(); flashScreen("#ffd84a"); updateTopbar();
    log(`誓いを果たした！ ✦${s} Soul を授かり、石碑は祝福の宝箱に変わった。`, "win");
    showToast(`誓いを果たした ― ✦${s} ・ 石碑が宝箱に`, { tone: "gold", icon: ICONS.chest });
    renderBoard();
  }
  if (fe.miner && !fe.minerDone && !evCells((c) => c.type === "corpse" && !c.cleared).length) {
    fe.minerDone = true;
    for (const c of evCells((c) => c.type === "event" && c.evQuest)) { c.cleared = true; delete c.evQuest; }
    const u = evUnit();
    const s = runGainSoulPts(Math.round(u.soul * 4 * evJit()));
    G.embers = (G.embers || 0) + 1; runCount("embers", 1);
    SFX.victory(); updateTopbar();
    log(`坑夫の亡霊は仲間と共に眠りについた。✦${s} Soul と魂の残火を遺していった。`, "win");
    showToast(`坑夫の頼みを果たした ― ✦${s} ・ 残火 ×1`, { tone: "gold", icon: ICONS.ember });
    renderBoard();
  }
}
// 帰還の時 (全滅以外): 密輸の報奨金・紅玉の売却を精算する
function evOnReturn(runRef, outcome) {
  const rv = runRef && runRef.ev;
  if (!rv || outcome === "wipe") return;
  let pay = 0; const notes = [];
  if (rv.bounty) { pay += rv.bounty; notes.push(`密輸の報奨金 💰${rv.bounty}`); rv.bounty = 0; }
  if (rv.ruby && rv.rubyGold) { pay += rv.rubyGold; notes.push(`紅玉の売却 💰${rv.rubyGold}`); rv.ruby = null; rv.rubyGold = 0; }
  if (!pay) return;
  G.gold += pay; runRef.gold = (runRef.gold || 0) + pay;
  log(notes.join(" / "), "win");
  setTimeout(() => showToast(notes.join(" ・ "), { tone: "gold", icon: ICONS.gold }), 900);
}
// 魂の職を選ぶ (rarePlus: レア以上確定 / front: 前衛の職 / common: コモン / 既定: 死体と同じ抽選)
function evSoulClass(mode) {
  const keys = Object.keys(SOUL_CLASSES);
  const of = (rar, f) => keys.filter((k) => SOUL_CLASSES[k].rarity === rar && (!f || f(SOUL_CLASSES[k])));
  if (mode === "rarePlus") {
    const r = Math.random();
    const pool = of(r < 0.02 ? "legend" : r < 0.20 ? "epic" : "rare");
    return pool[rand(pool.length)];
  }
  if (mode === "common") { const pool = of("common"); return pool[rand(pool.length)]; }
  if (mode === "front") {
    const rar = (SOUL_CLASSES[rollJobClass()] || {}).rarity || "common";
    const front = (c) => c.stat && (c.stat.atk || 0) + (c.stat.vit || 0) >= 3.6;
    const pool = of(rar, front);
    return pool.length ? pool[rand(pool.length)] : rollJobClass();
  }
  return rollJobClass();
}
// 品を渡して演出する (誰も持てなければ知らせて次へ)
function evGive(id, next) {
  const fin = next || (() => { if (G.state === "board") renderBoard(); });
  const got = id && ITEMS[id] ? giveItem(id) : null;
  if (got) { UI.loot(got.item, got.who, { source: "chest" }, fin); return; }
  if (id && ITEMS[id] && !G.party.some((m) => m.items.length < MAX_ITEMS)) runLost(itemName(markDungeonLoot({ ...ITEMS[id] })));
  fin();
}
function evPickMinRar(rar) {
  const order = ["c", "uc", "r", "sr"];
  const lo = Math.max(0, order.indexOf(rar));
  let k = Math.max(lo, order.indexOf(rollRarity(rarityUp({ rare: true }))));
  const centerR = dropCenterR({}), capR = lootCapR();
  for (; k >= lo; k--) { const id = pickOfRarity(order[k], centerR, capR); if (id) return id; }
  return pickLoot({ rare: true, noLR: true });
}
function evPickCollectible() {
  const cap = Math.min(20, lootBaseR() + 1);
  const pool = miscLootIds().filter((id) => Math.max(1, Math.min(20, ITEMS[id].r20 || 1)) <= cap);
  return pool.length ? pool[rand(pool.length)] : null;
}
function evOpenChestAt(cell) {
  const pos = evCellPos(cell);
  if (G.state !== "board" || !pos || pos.x !== G.px || pos.y !== G.py || cell.type !== "chest" || cell.cleared) { if (G.state === "board") renderBoard(); return; }
  if (G.prompt || uiBlocked()) { renderBoard(); return; }
  askOpenChest(cell);
}

// events.js へ渡す操作の窓口 (A)。events.js は game.js を import しないので、必要な操作はここに集める
const evApi = {
  get layer() { return battleLayer(); },
  get dn() { return dungeonNumber(activeCfg()); },
  runEv: () => evRun(),
  floorEv: () => evFloor(),
  flags: () => G.events.flags,
  // ---- 画面 ----
  choice: (title, opts, icon, o) => showChoice(title, opts, icon, o),
  icon: (e) => (e.icon && e.icon.startsWith("mon:") ? MONSTERS[e.icon.slice(4)] : ICONS[e.icon]) || ICONS.event,
  toast: (text, tone = "info", icon = null) => showToast(text, { tone, icon: icon ? (ICONS[icon] || undefined) : undefined }),
  log: (t, c = "sys") => log(t, c),
  sfx: (k) => { try { if (SFX[k]) SFX[k](); } catch (e) { /* 音は任意 */ } },
  flash: (c) => flashScreen(c),
  refresh: () => { renderParty(); updateTopbar(); },
  back: () => { if (G.state === "board") renderBoard(); autosave(true); },
  done(cell, next) {
    if (cell) cell.cleared = true;
    updateTopbar(); renderParty();
    if (next) next(); else if (G.state === "board") renderBoard();
    autosave(true);
  },
  reopen(cell) { if (G.state === "board" && !G.prompt && !uiBlocked() && !cell.cleared) runEvent(evApi, cell); else if (G.state === "board") renderBoard(); },
  alarm(title, lines, icon, then) {
    SFX.trap(); buzz([0, 60, 40, 60]);
    showEvent({ sprite: ICONS[icon] || ICONS.trap, banner: "⚠ 危険 ⚠", title, lines, accent: "#d4504e", btnLabel: "応戦する", onClose: then });
  },
  // 極の出来事: 授かった恵みを見せる (閉じるだけ。選択肢は無い)
  gift(title, lines, icon, { banner, accent }, next) {
    SFX.victory(); buzz([0, 40, 30, 60]);
    showEvent({ sprite: icon, banner, title, lines, accent, sparkle: true, btnLabel: "閉じる", onClose: next });
  },
  story(title, lines, next) {
    SFX.itemget();
    showEvent({ sprite: ICONS.event, banner: "✦ 見聞 ✦", title, lines, accent: "#c08aff", btnLabel: "閉じる", onClose: next });
  },
  seen(e, cell) {
    if (cell.evSeen) return;
    cell.evSeen = true;
    const first = !G.events.seen[e.id];
    G.events.seen[e.id] = (G.events.seen[e.id] || 0) + 1;
    if (first) {
      G.events.fresh[e.id] = true;
      const s = runGainSoulPts(Math.max(1, Math.round(evUnit().soul * 0.5)));
      updateTopbar();
      log(`見聞録に新たな出来事「${e.name}」を記した。(✦${s})`, "win");
      setTimeout(() => showToast(`見聞録に記した「${e.name}」 ✦${s}`, { tone: "gold", icon: ICONS.event }), 250);
    }
  },
  picked(e, label) {
    const pk = G.events.picks[e.id] || (G.events.picks[e.id] = {});
    const k = plainText(label).split(" ― ")[0].slice(0, 24);
    pk[k] = (pk[k] || 0) + 1;
    if (e.once) G.events.once[onceKey(e, battleLayer())] = true;
  },
  // ---- 隊 ----
  aliveList: () => evAlive(),
  deadList: () => G.party.filter((p) => !p.alive),
  // 倒れた者を起こす (full = HP・MP全快 / それ以外は HP1)
  revive(m, full) {
    if (!m || m.alive) return;
    m.alive = true; m._dead = false; m.ailment = null; m.reviveAt = null; m.diedFloor = null;
    m.hp = full ? m.maxhp : 1;
    if (full) m.mp = m.maxmp;
    log(`${m.name}が蘇った (HP ${m.hp})`, "heal");
    flashPartyCards([m], "heal"); renderParty();
  },
  innCost: () => innCost(),
  repairCost: (m) => Math.max(1, repairCostOf(m)),
  randomAlive: () => { const a = evAlive(); return a.length ? a[rand(a.length)] : null; },
  best(stat) { let b = null; for (const p of evAlive()) if (!b || (p[stat] || 0) > (b[stat] || 0)) b = p; return b; },
  check(stat, who = null) {
    const m = who || evApi.best(stat);
    if (!m) return { ok: false, who: null, p: 0 };
    const need = disarmNeed(1) * 0.5;
    const p = Math.max(0.15, Math.min(0.92, 0.55 * (m[stat] || 0) / need));
    return { ok: Math.random() < p, who: m, p };
  },
  checkDisarm() {
    const m = bestDisarmer();
    if (!m) return { ok: false, who: null, p: 0 };
    const p = disarmChance(m, 1);
    return { ok: Math.random() < p, who: m, p };
  },
  sense: () => partyPassiveLv("senseEnemy") > 0,
  appraiser: () => G.party.find((m) => m.alive && canIdentify(m)) || null,
  healAll(hp, mp, cure) {
    const list = evAlive();
    for (const p of list) {
      if (hp) p.hp = Math.min(p.maxhp, p.hp + Math.ceil(p.maxhp * hp));
      if (mp) p.mp = Math.min(p.maxmp, p.mp + Math.ceil(p.maxmp * mp));
      if (cure) p.ailment = null;
    }
    flashPartyCards(list, "heal"); updateTopbar();
  },
  hurtAll(pct) { const l = evAlive(); for (const p of l) p.hp = Math.max(1, p.hp - Math.ceil(p.maxhp * pct)); flashPartyCards(l, "hit"); buzz([0, 40, 30, 40]); },
  hurtAllCur(pct) { const l = evAlive(); for (const p of l) p.hp = Math.max(1, p.hp - Math.ceil(p.hp * pct)); flashPartyCards(l, "hit"); },
  hurtOne(m, pct) { if (!m || !m.alive) return; m.hp = Math.max(1, m.hp - Math.ceil(m.maxhp * pct)); flashPartyCards([m], "hit"); },
  mpAll(pct) { for (const p of evAlive()) p.mp = Math.max(0, p.mp - Math.ceil(p.maxmp * pct)); renderParty(); },
  ail(m, kind) { if (!m || !m.alive || m.ailment || (m.eff && m.eff.ailmentImmune)) return; m.ailment = kind; renderParty(); },
  ailAll(kind, ch) { for (const p of evAlive()) if (Math.random() < ch) evApi.ail(p, kind); flashPartyCards(evAlive(), "hit"); },
  cureAll() { for (const p of evAlive()) p.ailment = null; renderParty(); },
  // ---- 通貨 ----
  goldCost: (u) => Math.max(1, Math.round(evUnit().gold * u * 0.5)),
  soulCost: (u) => Math.max(1, Math.round(evUnit().soul * u)),
  canPayGold: (n) => G.gold >= n,
  canPaySoul: (n) => G.soulPts >= n,
  payGold(n) { G.gold = Math.max(0, G.gold - n); if (G.run && inDungeon()) G.run.gold = Math.max(0, (G.run.gold || 0) - n); updateTopbar(); },
  paySoul(n) { G.soulPts = Math.max(0, G.soulPts - n); if (G.run && inDungeon()) G.run.soulPts = Math.max(0, (G.run.soulPts || 0) - n); updateTopbar(); },
  embers: () => G.embers || 0,
  payEmber(n) { G.embers = Math.max(0, (G.embers || 0) - n); updateTopbar(); },
  gold(u, from) {
    const g = runGainGold(Math.round(evUnit().gold * u * evJit()));
    SFX.itemget(); updateTopbar();
    log(`${from}から ${g} ゴールドを得た。`, "win");
    showToast(`${from}から 💰${g}`, { tone: "gold", icon: ICONS.gold });
    return g;
  },
  soul(u, from) {
    const s = runGainSoulPts(Math.round(evUnit().soul * u * evJit()));
    updateTopbar();
    log(`${from}から ✦${s} Soul を得た。`, "win");
    showToast(`${from}から ✦${s} Soul`, { tone: "gold", icon: ICONS.wisp });
    return s;
  },
  giveGoldRaw(n, from) { G.gold += n; if (G.run && inDungeon()) G.run.gold += n; updateTopbar(); log(`${from}で 💰${n} を得た。`, "win"); showToast(`${from} ― 💰${n}`, { tone: "gold", icon: ICONS.gold }); },
  giveSoulRaw(n, from) { G.soulPts += n; if (G.run && inDungeon()) G.run.soulPts += n; updateTopbar(); log(`${from}で ✦${n} Soul を得た。`, "win"); showToast(`${from} ― ✦${n}`, { tone: "gold", icon: ICONS.wisp }); },
  ember(n, from, quiet = false) {
    G.embers = (G.embers || 0) + n; runCount("embers", n); updateTopbar();
    log(`${from} ― 魂の残火を ${n}つ 得た。`, "win");
    if (!quiet) showToast(`${from} ― 魂の残火 ×${n}`, { tone: "gold", icon: ICONS.ember });
  },
  // ---- 品・魂 ----
  item: (opts, from, next) => { log(`${from}で品を見つけた。`, "win"); evGive(pickLoot({ ...(opts || {}), noLR: true }), next); },
  itemMinRar: (rar, from, next) => { log(`${from}で品を受け取った。`, "win"); evGive(evPickMinRar(rar), next); },
  giveItemId: (id, next) => evGive(id, next),
  collectible(from, next) {
    const id = evPickCollectible();
    if (!id) { evApi.gold(1, from); if (next) next(); return; }
    log(`${from}で収集品を見つけた。`, "win");
    evGive(id, next);
  },
  price: (id) => (ITEMS[id] && ITEMS[id].price) || 20,
  soulDrop: (mode, line, next) => acquireSoul(evSoulClass(mode), line, next),
  // ---- 盤面 ----
  countCells: (fn) => evCells(fn).length,
  revealStairs() { evRevealStairs(); renderBoard(); },
  revealWhere(fn, limit = Infinity) {
    let n = 0;
    for (const c of evCells((c) => fn(c) && !c.revealed)) { if (n >= limit) break; c.revealed = true; n++; }
    renderBoard();
    return n;
  },
  removeMonsters(n) {
    const list = evCells((c) => c.type === "monster" && !c.cleared && !c.elite);
    let k = 0;
    while (k < n && list.length) { const c = list.splice(rand(list.length), 1)[0]; c.type = "empty"; c.cleared = true; delete c.monsterKey; k++; }
    return k;
  },
  reviveMonsters() { const l = evCells((c) => c.type === "monster" && c.cleared && !c.elite && c.monsterKey); for (const c of l) c.cleared = false; renderBoard(); return l.length; },
  monsterKeysLeft: () => evCells((c) => c.type === "monster" && !c.cleared && !c.elite && MONSTERS[c.monsterKey]).map((c) => c.monsterKey),
  clearMonsters() { const l = evCells((c) => c.type === "monster" && !c.cleared && !c.elite); for (const c of l) c.cleared = true; return l.length; },
  clearPoison() { const l = evCells((c) => c.type === "poison"); for (const c of l) { c.type = "empty"; c.cleared = true; } return l.length; },
  floodHalf() {
    const right = G.px < COLS / 2;
    let n = 0;
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      if (right ? x < Math.ceil(COLS / 2) : x >= Math.floor(COLS / 2)) continue;
      const c = G.board.cells[y][x];
      if (x === G.px && y === G.py) continue;
      if (["trap", "poison", "chest", "corpse", "fountain"].includes(c.type) || (c.type === "monster" && !c.elite)) {
        if (c.cleared && c.type !== "poison") continue;
        c.type = "empty"; c.cleared = true; delete c.monsterKey; n++;
      }
    }
    renderBoard();
    return n;
  },
  warmCorpse() {
    let best = null, bd = 1e9;
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const c = G.board.cells[y][x];
      if (c.type !== "corpse" || c.cleared) continue;
      const d = Math.abs(x - G.px) + Math.abs(y - G.py);
      if (d < bd) { bd = d; best = c; }
    }
    if (!best) {
      const cand = evCells((c) => c.type === "empty");
      if (!cand.length) return false;
      best = cand[rand(cand.length)];
      best.type = "corpse"; best.cleared = false; best.corpseClass = rollJobClass();
    }
    best.corpseWarm = true; best.revealed = true;
    renderBoard();
    return true;
  },
  purgeBeasts: () => evPurgeBeasts(),
  placeChest: (o) => { const c = evPlaceChest(o); renderBoard(); return c; },
  chestHere(cell, { rankUp = 0, cRank = 0, lootBonus = 0 } = {}, next = null, noOpen = false) {
    cell.type = "chest"; cell.cleared = false; cell.revealed = true;
    cell.cRank = cRank || Math.min(5, chestRankOf(null) + rankUp);
    if (lootBonus) cell.lootBonus = lootBonus;
    delete cell.evFight;
    if (noOpen) return;
    if (next) { next(); setTimeout(() => evOpenChestAt(cell), 60); }
    else evOpenChestAt(cell);
  },
  openChestAt: (cell) => evOpenChestAt(cell),
  trap(next) {
    const trap = pickTrap(activeCfg().rank || 1);
    const best = bestDisarmer();
    presentTrap(applyTrap(trap, best), { proceed: next || (() => renderBoard()) }, boardSink());
  },
  warpToStairs() {
    let sp = null;
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (G.board.cells[y][x].type === "stairs") sp = { x, y };
    if (!sp) { renderBoard(); return; }
    const st = G.board.cells[sp.y][sp.x];
    st.revealed = true;
    let dest = null;
    for (const d in DIRS_G) {
      if (st.walls[d]) continue;
      const nx = sp.x + DIRS_G[d][0], ny = sp.y + DIRS_G[d][1];
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      const c = G.board.cells[ny][nx];
      if (c.type === "empty" || c.cleared || c.type === "start") { dest = { x: nx, y: ny }; break; }
    }
    if (dest) { G.px = dest.x; G.py = dest.y; G.board.cells[dest.y][dest.x].revealed = true; revealByCartography(); renderBoard(); autosave(true); return; }
    G.px = sp.x; G.py = sp.y; revealByCartography(); renderBoard(); autosave(true);
    askDescend(st);
  },
  skipFloors(n) { G.floor += n; descend(); },
  // ---- 戦闘 ----
  poolKey: () => evPoolKey(),
  eliteKeyHere: () => eliteKey(),
  monName: (k) => (MONSTERS[k] && MONSTERS[k].name) || "魔物",
  fight(cell, specs, tag, o = {}) {
    // 敵の種類はここで確定させる (逃げて戻った時の再戦も同じ顔ぶれにする)
    const fixed = (specs || []).map((sp) => sp.shadows || (sp.key && MONSTERS[sp.key]) ? { ...sp }
      : { ...sp, key: sp.elite ? eliteKey() : sp.undead ? undeadKeyForDungeon() : evPoolKey() });
    cell.evFight = { tag, specs: fixed, noChest: o.noChest !== false, opening: o.opening || null };
    evStartFight(cell);
  },
  refight: (cell) => evStartFight(cell),
};

// 隊の札を一瞬だけ光らせる (被弾 = 赤 / 回復 = 緑)。盤面でも戦闘と同じ明滅を使う
function flashPartyCards(list, kind = "hit") {
  if (!list || !list.length) return;
  if (!G.partyFx) G.partyFx = new Map();
  for (const p of list) G.partyFx.set(p, kind);
  renderParty();
  setTimeout(() => {
    if (G.state !== "board" || !G.partyFx) return;
    for (const p of list) G.partyFx.delete(p);
    renderParty();
  }, 460);
}

// 泉を利用: HP/MP回復・毒浄化。利用したら消える。
function useFountain(cell) {
  cell.cleared = true;
  SFX.heal();
  let cured = false;
  const healed = [];
  for (const p of G.party) {
    if (!p.alive) continue;
    p.hp = Math.min(p.maxhp, p.hp + Math.ceil(p.maxhp * 0.4));
    p.mp = Math.min(p.maxmp, p.mp + Math.ceil(p.maxmp * 0.5));
    if (p.ailment) cured = true;
    p.ailment = null;
    healed.push(p);
  }
  log("癒しの泉だ！ HPとMPが回復し、毒も癒えた。", "heal");
  flashPartyCards(healed, "heal");
  showToast(`癒しの泉 ― HP・MPが回復した${cured ? "・毒も浄化" : ""}`, { tone: "good", icon: ICONS.fountain });
  renderBoard();
}

// 黒い泉: 50% で全回復+Soulの恵み、50% で呪い (HP半減+毒)。一度きりの賭け
function useDarkFountain(cell) {
  cell.cleared = true;
  if (Math.random() < 0.5) {
    SFX.heal(); buzz([0, 30, 40, 30]); flashScreen("#5fb8d6");
    for (const p of G.party) if (p.alive) { p.hp = p.maxhp; p.mp = p.maxmp; p.ailment = null; }
    const bonus = runGainSoulPts(20 * (activeCfg().rank || 1));
    updateTopbar();
    log(`黒い泉は恵みをもたらした！ 全回復し、✦${bonus} Soul を得た。`, "win");
    flashPartyCards(G.party.filter((p) => p.alive), "heal");
    showToast(`深淵の恵み ― 全回復 ・ ✦${bonus}`, { tone: "good", icon: ICONS.fountain });
    renderBoard();
    return;
  }
  SFX.trap(); buzz([0, 80, 60, 80]); flashScreen("#a01030");
  let cursed = false;
  for (const p of G.party) {
    if (!p.alive) continue;
    p.hp = Math.max(1, Math.ceil(p.hp * 0.5));
    if (!p.ailment && Math.random() < 0.5) { p.ailment = "poison"; cursed = true; }
  }
  log("黒い泉は呪いだった…！ 全員の生気が吸われた。", "dmg");
  flashPartyCards(G.party.filter((p) => p.alive), "hit");
  showToast(`深淵の呪い ― 全員のHPが半減${cursed ? "・毒に侵された者も" : ""}`, { tone: "bad", icon: ICONS.fountain });
  renderBoard();
}

// 死体: 「まだあたたかい死体」からのみ魂を回収できる (死体の職業に応じた魂)
function resolveCorpse(cell) {
  const clsKey = cell.corpseClass || "fighter";
  const clsLabel = SOUL_CLASSES[clsKey].label;
  // 偉大なる死体 (特別階「強大な気配」): 希少な職業の魂が必ず宿っている
  if (cell.corpseGreat) {
    showChoice(`偉大なる死体。尋常ならざる魂の気配がする。`, [
      { label: "魂を回収する", primary: true, fn: () => collectWarmCorpse(cell, clsKey, clsLabel) },
      { label: "立ち去る", fn: () => { log("偉大なる死体に手を触れず、立ち去った。", "sys"); renderBoard(); } },
    ], ICONS.corpseWarm, { banner: "★ 偉大なる死体 ★", accent: "#ffcf4a", lines: ["まれに死体が目覚めて襲ってくる。勝てば魂は必ず手に入る。"] });
    return;
  }
  if (!cell.corpseWarm) {
    // 風化した死体: 調べても戦闘は起きない (損のない行為)。既定ではそのまま調べる (§7 M3。設定で問うようにできる)
    if (uiDungeonHud.getPref("autoCorpse") !== false) { investigateCorpse(cell, clsKey, clsLabel); return; }
    showChoice(`風化した死体が横たわっている。調べてみるか？`, [
      { label: "調べる", primary: true, fn: () => investigateCorpse(cell, clsKey, clsLabel) },
      { label: "立ち去る", fn: () => { log("死体には触れず、立ち去った。", "sys"); renderBoard(); } },
    ], ICONS.corpse, { banner: "— 風化した死体 —", accent: "#8c866f" });
    return;
  }
  // あたたかい死体: 回収するか立ち去るか選べる。立ち去れば死体は残る。
  // 宿る魂の職業は、回収するまで明かさない (札の色も職業色ではなく魂の青)
  showChoice(`まだあたたかい死体。魂が宿っている。`, [
    { label: "魂を回収する", primary: true, fn: () => collectWarmCorpse(cell, clsKey, clsLabel) },
    { label: "立ち去る", fn: () => { log("死体に手を触れず、立ち去った。", "sys"); renderBoard(); } },
  ], ICONS.corpseWarm, { banner: "✦ あたたかい死体 ✦", accent: "#7fd0ff", lines: ["まれに死体が起き上がる。勝てば魂は必ず手に入る。"] });
}

// あたたかい死体/偉大なる死体の回収: 80%で魂を直接入手、20%で死体が起き上がりアンデッド戦。
// 戦闘に勝てば魂を100%回収する (宝箱は出ない)。
// 一度起き上がった死体は cell._corpseRise を残すので、戦闘から逃げて再度調べても
// 必ずまた起き上がる (逃走→再調査で無償の魂入手を防ぐ)。
function collectWarmCorpse(cell, clsKey, clsLabel) {
  if (cell._corpseRise || Math.random() < 0.20) {
    const great = !!cell.corpseGreat;
    const riseLine = great
      ? `偉大なる死体は目覚めて襲ってきた！`
      : `まだあたたかい死体は起き上がって襲ってきた！`;
    cell._corpseRise = true; // endBattle 側で「宝箱なし・魂回収」を分岐するための印
    log(riseLine, "dmg");
    SFX.die(); buzz([0, 40, 60, 40]);
    showEvent({
      sprite: ICONS.corpseWarm,
      banner: great ? "★ 死体が目覚めた ★" : "☠ 死体が起き上がった ☠",
      title: riseLine,
      lines: ["打ち倒せば、宿っていた魂は必ず手に入る。"],
      accent: great ? "#ffcf4a" : "#d4504e",
      btnLabel: "応戦する",
      onClose: () => startBattle(spawnCardEnemies(undeadKeyForDungeon(), G.floor, enemyScale(), { min: mutNum("packMin", 0) }), cell),
    });
    return;
  }
  collectSoul(cell, clsKey, clsLabel);
}

// 現在のダンジョンに出るアンデッド種のキー (なければ全体から、最終的に地下牢の骸)。
// ボス/強敵は除外する (死体から湧いた個体が boss フラグを持つと迷宮踏破扱いになってしまうため)
function undeadKeyForDungeon() {
  const cfg = activeCfg();
  const local = [...(cfg.pool || []), ...(cfg.deepPool || [])]
    .filter((k) => MONSTERS[k] && MONSTERS[k].race === "undead" && !MONSTERS[k].boss && !MONSTERS[k].elite);
  if (local.length) return local[rand(local.length)];
  const all = Object.keys(MONSTERS).filter((k) => MONSTERS[k].race === "undead" && !MONSTERS[k].boss && !MONSTERS[k].elite);
  return all.length ? all[rand(all.length)] : "d01_skeleton";
}

// 風化した死体を調べる: 魂20% / Soul30% / Gold30% / 装備20% (戦闘は起きない)。
// 「魂」= 装備できる魂オブジェクト / 「Soul」= ✦ ソウルポイント。
// 結果はトースト (魂のレア以上・SR/LR の品だけ祝祭の札) で知らせ、歩みは止めない
function investigateCorpse(cell, clsKey, clsLabel) {
  cell.cleared = true;
  const dn = activeCfg();
  const back = () => { if (G.state === "board") renderBoard(); };

  // 懐に残された金品 (Gold) を渡す処理 (装備を渡せない時のフォールバックにも使う)
  const giveGold = () => {
    const g = runGainGold(Math.round((18 + G.floor * 9) * (0.7 + Math.random() * 0.6)));
    SFX.itemget(); buzz([0, 30, 60, 30]);
    log(`風化した死体の懐から ${g} ゴールドを見つけた。`, "win");
    updateTopbar();
    showToast(`風化した死体の懐から 💰${g}`, { tone: "gold", icon: ICONS.gold });
    back();
  };

  const roll = Math.random();

  // 20%: 職能の記憶を宿した「魂」
  if (roll < 0.20) {
    acquireSoul(clsKey, `風化した死体の残りかすに、まだ職能の記憶が宿っていた。`, back);
    return;
  }

  // 30%: 亡骸に残る ✦ Soul (ソウルポイント) を集める
  if (roll < 0.50) {
    const got = runGainSoulPts(Math.round((20 + G.floor * 8 + (dn.rank || 1) * 6) * (0.7 + Math.random() * 0.6)));
    SFX.itemget(); buzz([0, 30, 60, 30]);
    log(`風化した死体から ✦${got} Soul を集めた。`, "win");
    updateTopbar();
    showToast(`風化した死体から ✦${got} Soul`, { tone: "gold", icon: ICONS.wisp });
    back();
    return;
  }

  // 30%: 懐に残された金品
  if (roll < 0.80) { giveGold(); return; }

  // 20%: 傍らに遺された装備品 (渡せなければ金品にフォールバック)
  const id = pickLoot();
  const who = G.party.find((p) => p.alive && p.items.length < MAX_ITEMS)
    || G.party.find((p) => p.items.length < MAX_ITEMS);
  if (who && ITEMS[id]) {
    const it = cloneItem(id);
    markDungeonLoot(it);
    runGainItem(who, it);
    codexSeeItem(id, it);
    log(`風化した死体の傍らに ${itemName(it)} が遺されていた。`, "win");
    UI.loot(it, who, { source: "corpse" }, back);
    return;
  }
  giveGold();
}

// 魂の残火: まだあたたかい死体=50%で1個 / 偉大なる死体=100%で5個
const EMBER_WARM = 1, EMBER_GREAT = 5, EMBER_WARM_RATE = 0.5;
function emberReward(great) {
  if (great) return EMBER_GREAT;                              // 偉大なる死体: 確定
  return Math.random() < EMBER_WARM_RATE ? EMBER_WARM : 0;    // あたたかい死体: 50%
}
function collectSoul(cell, clsKey, clsLabel) {
  cell.cleared = true;
  acquireSoul(clsKey, cell.corpseGreat
    ? `偉大なる死体に宿っていた、強大な魂だ。`
    : `まだあたたかい死体に宿っていた魂だ。`, null, emberReward(cell.corpseGreat));
}

// レア度の表示名
const RARITY_LABEL = { common: "コモン", rare: "レア", epic: "エピック", legend: "レジェンド" };

// 魂を受け取る (演出なし): 所持魂の一覧へ加え、戦績・図鑑・今回の記録に残す。死体の残火も同時に受け取る。
// 戦果シートのように一覧へまとめて見せる場面と、トースト/祝祭で知らせる acquireSoul の共通の芯
function grantSoulQuiet(clsKey, sourceLine = "", emberCount = 0) {
  const cls = SOUL_CLASSES[clsKey] || SOUL_CLASSES.fighter;
  G.stats.soulsFound++;
  questProgress("soul", null, 1);
  addSoulInstance(clsKey);
  runTrackSoul(clsKey, "bag");
  codexJobSee(clsKey, 1, 1);
  if (emberCount > 0) { G.embers = (G.embers || 0) + emberCount; runCount("embers", emberCount); }
  updateTopbar();
  log(`${cls.label}の魂 を持ち帰った。(所持魂 一覧に追加)${emberCount > 0 ? ` 魂の残火 ×${emberCount}` : ""}`, "win");
  return { clsKey, label: cls.label, rarity: cls.rarity, rare: cls.rarity !== "common", glow: cls.glow || "#c9a227", line: sourceLine, embers: emberCount };
}

// 魂の祝祭の札 (レア以上)。残火があれば同じ札にまとめる
function celebrateSoul(s, onClose) {
  const cls = SOUL_CLASSES[s.clsKey] || SOUL_CLASSES.fighter;
  SFX.itemget(); buzz([0, 40, 50, 40, 50, 150]);
  if (cls.rarity === "legend") { flashScreen("#ffcf4a"); SFX.victory(); }
  showEvent({
    sprite: soulIcon(s.clsKey),
    banner: `★ ${RARITY_LABEL[cls.rarity] || "希少"}の魂を入手 ★`,
    title: `${cls.label}の魂`,
    lines: [s.line, "所持魂の一覧に加わった。", ...(s.embers > 0 ? [`魂の残火を ${s.embers}つ 手に入れた (魂のLv上限を上げる)`] : [])].filter(Boolean),
    accent: cls.glow || "#c9a227",
    sparkle: true,
    btnLabel: "受け取る",
    onClose,
  });
}

// 魂の入手処理: 拾った魂は1体の魂インスタンスとして自動で「所持魂 一覧」に追加される。
// コモンの魂はトースト (歩みを止めない)、レア以上は祝祭の札。死体の残火は同じ知らせにまとめる
function acquireSoul(clsKey, sourceLine, onClose, emberCount = 0) {
  const after = onClose || (() => { if (G.state === "board") renderBoard(); });
  const s = grantSoulQuiet(clsKey, sourceLine, emberCount);
  if (s.rare) { celebrateSoul(s, after); return; }
  SFX.itemget(); buzz([0, 30, 60, 30]);
  showToast(`${s.label}の魂を手に入れた${s.embers > 0 ? ` ・ 残火 ${s.embers}` : ""}`, { tone: "good", icon: soulIcon(clsKey) });
  after();
}

// ---- 選択肢プロンプト ----
// キットの「決断」シート (下から昇る) に、イラスト+タイトル+選択肢を表示する。G.prompt で盤面の入力を止める。
// 旧 #item-get と同じく「プロンプト」は1枠: 新しい選択肢/出来事は前のものを置き換える (前の onClose は呼ばない)。
// 戻る操作: onDismiss があればそれ / 無ければ取り消しの選択肢 (やめる・開けない・まだ…) / どちらも無い強制の決断は揺れるだけ。
let promptSheet = null;
const CANCEL_RE = /^(やめ|開けない|まだ|立ち去|近寄らない|今はやめ|戻る|閉じる|とじる|いいえ|キャンセル|見送|放って)/;
function isCancelOption(o) { return !!(o && (o.cancel || CANCEL_RE.test(plainText(o.label)))); }
// 旧来の #item-get (showItemGet 等) が出ていたら片付ける (旧実装の「1枠を上書き」と同じ)
function clearItemGetSlot() {
  if (!itemGetEl || itemGetEl.classList.contains("hidden")) return;
  itemGetEl.classList.add("hidden");
  itemGetEl.innerHTML = "";
  itemGetEl.onclick = null;
}
function replacePrompt() {
  if (promptSheet) { const old = promptSheet; promptSheet = null; old.close("replace", { silent: true }); }
  clearItemGetSlot();
}
function showChoice(title, options, icon, { banner = "✦ 発見 ✦", accent = "#c9a227", lines = [], onDismiss = null } = {}) {
  G.prompt = true;
  replacePrompt();
  const cancel = onDismiss ? null : options.find(isCancelOption);
  const acts = options.filter((o) => !isCancelOption(o) && !o.danger);
  const spec = (o) => ({
    label: o.label,
    kind: o.danger ? "danger" : isCancelOption(o) ? "ghost" : (o.primary || (acts.length === 1 && acts[0] === o)) ? "primary" : "secondary",
    onTap: () => { closePrompt(); o.fn(); },
  });
  // 選択肢が多い (魂の一覧など) ときは本文側に並べてスクロールさせる
  const many = options.length > 4;
  let list = null;
  if (many) {
    list = el("div", "ui-choice-list");
    for (const o of options) list.appendChild(kitButton(spec(o)));
  }
  let h = null;
  const dismiss = () => {
    if (onDismiss) { closePrompt(); onDismiss(); }
    else if (cancel) { closePrompt(); cancel.fn(); }
    else if (h) kitShake(h.el);
  };
  h = sheet.open({
    kind: "choice", banner, accent, art: icon || null, title, lines,
    body: list || undefined,
    footer: many ? [] : options.map(spec),
    dismissible: false,
    onBack: dismiss,
    onBackdrop: () => { if (onDismiss) { closePrompt(); onDismiss(); } else kitShake(h.el); },
  });
  promptSheet = h;
}

function closePrompt() {
  G.prompt = false;
  if (promptSheet) { const h = promptSheet; promptSheet = null; h.close("close", { silent: true }); }
  autosave(true);
}

// 階段: 降りるか選ぶ。最深階の階段は、層末迷宮では層ボスへの扉、それ以外では踏破口。
function askDescend(cell) {
  const stay = () => renderBoard(); // 枠外をタップ・戻る = 「まだ探索する」 (帰還魔法陣と同じ)
  // 奈落: 最深部の概念がなく、ひたすら深く潜る。10階ごとに門番が立ちはだかる。
  if (abyssActive()) {
    if (abyssBossPending()) {
      showChoice(
        `深部から圧倒的な気配が漏れている。奈落の門番 (B${G.floor}F) に挑む？`,
        [
          { label: "門番に挑む", danger: true, fn: () => fightAbyssGuard(cell) },
          { label: "まだ準備する", cancel: true, fn: () => { renderBoard(); } },
        ],
        ICONS.stairs,
        { banner: "⚠ 奈落の門番 ⚠", accent: "#d4504e", onDismiss: stay }
      );
      return;
    }
    showChoice(
      `さらに深い闇へ続く階段だ。`,
      [
        { label: `B${G.floor + 1}F へ潜る`, primary: true, fn: () => descend() },
        { label: "まだ探索する", fn: () => { renderBoard(); } },
      ],
      ICONS.stairs,
      { banner: "✦ 奈落 ✦", accent: "#b08ac0", onDismiss: stay }
    );
    return;
  }
  const dn = curDungeon();
  const atBottom = G.floor >= dn.floors;
  // 踏破後に「まだ探索する」を選んで最深部の階段へ戻った: 主戦・踏破を繰り返さず、凱旋を促す
  if (atBottom && G.bossDown) {
    showChoice(
      `「${dn.name}」は踏破済みだ。`,
      [
        { label: "街へ凱旋する", primary: true, fn: () => leaveDungeon({ outcome: "clear" }) },
        { label: "まだ探索する", fn: () => { renderBoard(); } },
      ],
      ICONS.stairs,
      { banner: "★ 踏破済み ★", accent: "#ffd84a", lines: ["下の「帰還」からも、いつでも凱旋できる。"], onDismiss: stay }
    );
    return;
  }
  const boss = atBottom && !!dn.boss;        // 層末迷宮のみ最深部にボスがいる
  const clearNoBoss = atBottom && !dn.boss;  // 層途中の迷宮は最深部到達で踏破
  let label, banner, accent, prompt, lines = [];
  if (boss) { label = "主に挑む"; banner = "⚠ 迷宮の主 ⚠"; accent = "#d4504e"; prompt = `この奥に「${dn.name}」の主が待つ。`; lines = ["勝てば迷宮を踏破し、街へ凱旋できる。"]; }
  else if (clearNoBoss) { label = "踏破する"; banner = "✦ 最深部 ✦"; accent = "#ffd84a"; prompt = `「${dn.name}」の最深部に至った。`; lines = ["踏破して街へ凱旋する。"]; }
  else { label = `B${G.floor + 1}F へ降りる`; banner = "✦ 下り階段 ✦"; prompt = `下り階段を見つけた。`; lines = [`地下 ${G.floor + 1} 階へ。下の「降りる」からも、いつでも降りられる。`]; }
  showChoice(
    prompt,
    [
      { label, danger: boss, primary: !boss, fn: () => {
        if (boss) {
          log("迷宮の主が立ちはだかる！", "dmg");
          // 迷宮ごとの手直し (generator.js DUNGEON_TUNE): 主は雑魚の倍率ではなく bossMul、HP はさらに bossHpMul
          const tn = dn.tune || {};
          const foes = spawnBossEnemies(dn.boss, dn.bossScale * (tn.bossMul || 1) * baseEnemyScale(), dn.bossRank);
          if ((tn.bossHpMul || 1) !== 1) for (const e of foes) e.maxhp = e.hp = Math.max(1, Math.round(e.maxhp * tn.bossHpMul));
          startBattle(foes, cell);
        }
        else if (clearNoBoss) clearDungeonNoBoss();
        else descend();
      } },
      { label: "まだ探索する", fn: () => { renderBoard(); } },
    ],
    boss ? ICONS.bossDoor : ICONS.stairs,
    { banner, accent, lines, onDismiss: stay }
  );
}

// ボスのいない層途中の迷宮を踏破する (最深部到達で確定)。ボス撃破と同じ章進行・凱旋演出につなぐ。
function clearDungeonNoBoss() {
  const info = commitDungeonClear(false); // boss扱いしない (戦績の主撃破は加算しない)
  showDungeonClearedPopup(info);
}

// ===== 罠解除 (宝箱・罠マス共通) =====
// 解除値 = AGI + LUK。解除を得意とする職 (盗賊・義賊・暗殺者・魔盗賊・狩人) は1.5倍のボーナス
const DISARM_JOBS = ["thief", "brigand", "shadow", "arcthief", "hunter"];
// この人業が「解除の得意職」を宿しているか (メイン魂・宿し魂のいずれか)
function disarmExpert(m) {
  if (!m.jobKey) return false;
  return m.jobKey.split("+").some((k) => DISARM_JOBS.includes(k));
}
function disarmPower(m) {
  let v = (m.agi || 0) + (m.luk || 0);
  if (disarmExpert(m)) v *= 1.5;
  return Math.round(v);
}

// 解除難度: ダンジョンランクと宝箱ランクで決まる。
// 迷宮の魂レベル帯 (これも迷宮ランクの関数) から「適正パーティの AGI+LUK」を見積もり、
// 適正レベルでは 得意職が ~75% (上限95%まで伸びる)、それ以外の職は ~50% になるよう調整している。
// cRank: 宝箱ランク (1-5)。床罠は1扱い
function disarmNeed(cRank = 1) {
  const cfg = activeCfg();
  const L = 2 + (cfg.soulLevelBonus || 0) * 2.4;        // 適正な魂レベルの目安 (強化込み)
  const f = 1 + (L - 1) * 0.12;                          // souls.js の lvlFactor と同式
  const q = 1 + ((cfg.rank || 1) - 1) * 0.14;            // ダンジョンランク: 深部は高ランク魂が前提
  const c = 1 + ((cRank || 1) - 1) * 0.16;               // 宝箱ランク: 上等な箱ほど狡猾な錠前
  // 基準値: 得意職以外が適正レベルで約50%に収まる難度 (得意職は ×1.5 ボーナスで上回る)
  return 34 * f * q * c;
}

function disarmChance(m, cRank = 1) {
  if ((specialDef() || {}).sureDisarm) return 1; // 盗賊の洞察: 罠解除率100%
  // 得意職は最大95%まで伸びるが、それ以外は上限55% (適正レベルで約50%、過剰育成でも頭打ち)
  const cap = disarmExpert(m) ? 0.95 : 0.55;
  const teLv = partyPassiveLv("trapEye"); // 控えの結社 罠師の目: 解除力 +10/20/30%
  return Math.max(0.05, Math.min(cap, disarmPower(m) / disarmNeed(cRank) * (1 + 0.10 * teLv)));
}

// 宝箱ランク (1-5) を取得。セルに未設定ならその場で抽選して保存する
// (出現%表示と実際の判定がぶれないよう、同じ宝箱では固定)
function chestRankOf(cell) {
  if (cell && cell.cRank) return cell.cRank;
  const cfg = activeCfg();
  const floors = Math.max(1, cfg.floors || 3);
  const depth = floors > 1 ? Math.min(1, (G.floor - 1) / (floors - 1)) : 0;
  // 特別階 (商隊の遺品) / 迷宮の異変 (閉ざされた退路など): 宝箱ランクが上がる。
  // 控えの結社 宝物庫 (vault): Lvに応じた確率で宝箱ランク+1
  const vLv = partyPassiveLv("vault");
  const vaultBump = (vLv && Math.random() < (vLv >= 3 ? 0.50 : vLv >= 2 ? 0.30 : 0.15)) ? 1 : 0;
  const r = Math.min(5, rollChestRank(depth, cfg.rank || 1) + sfNum("chestRankUp", 0) + mutNum("chestRankUp", 0) + vaultBump);
  if (cell) cell.cRank = r;
  return r;
}

// パーティで最も罠解除が高い生存メンバー (罠マスの判定に使う)
function bestDisarmer() {
  const alive = G.party.filter((p) => p.alive);
  let best = alive[0];
  for (const p of alive) if (disarmPower(p) > disarmPower(best)) best = p;
  return best;
}
// この宝箱を開けるのに最も向いた者 (解除率が最も高い生存者。得意職の上限差も含めて比べる)
function bestChestOpener(cRank) {
  const alive = G.party.filter((p) => p.alive);
  let best = alive[0] || null;
  for (const p of alive) if (disarmChance(p, cRank) > disarmChance(best, cRank)) best = p;
  return best;
}

// ---- 結果の出し先 (sink) ----
// 宝箱・罠の結果をどこに出すか。盤面 = トースト (品は UI.loot)、戦果シート = シートの行 (results.js が作る)。
// 札で止める出来事 (飛ばされた・呼び寄せた・倒れた) の前には interrupt() で出し先を片付ける
function boardSink() {
  return {
    mode: "board",
    note(text, tone = "gold", icon = null) { showToast(text, { tone, icon: icon || undefined }); },
    gold(g, from = "宝箱") { showToast(`${from}から 💰${g}`, { tone: "gold", icon: ICONS.gold }); },
    loot(item, who, next) { UI.loot(item, who, { source: "chest" }, next); },
    lost(name) { showToast(`持ちきれず置いてきた: ${name}`, { tone: "bad" }); },
    interrupt() {},
  };
}

// 宝箱: 最も解除に向いた者が開けるのを既定とし、1タップで開ける (§7 M5)。
// 他の者に任せる・開けないも選べる。設定「宝箱は最良の解除役で開ける」なら問わずに開ける。
// 宝箱にはランク (1-5) があり、高ランクほど中身が豪華だが解除難度が上がる
function askOpenChest(cell) {
  const cRank = chestRankOf(cell);
  const best = bestChestOpener(cRank);
  if (!best) { renderBoard(); return; }
  if (uiDungeonHud.getPref("chestAuto")) { openChest(cell, best); return; }
  const pct = (p) => Math.round(disarmChance(p, cRank) * 100);
  const others = G.party.filter((p) => p.alive && p !== best);
  const opts = [{ label: `開ける ― ${best.name} (解除 ${pct(best)}%)`, primary: true, fn: () => openChest(cell, best) }];
  if (others.length) opts.push({ label: "他の者が開ける", fn: () => askOtherOpener(cell, cRank, others) });
  opts.push({ label: "開けない", cancel: true, fn: () => { renderBoard(); } });
  showChoice(`${CHEST_RANKS[cRank]}宝箱`, opts, ICONS.chest, {
    banner: "✦ 宝箱 ✦", lines: ["罠があるかもしれない。解除の上手い者が開けるほど安全だ。"],
  });
}
function askOtherOpener(cell, cRank, others) {
  const opts = others.map((p) => ({ label: `${p.name} が開ける (解除 ${Math.round(disarmChance(p, cRank) * 100)}%)`, fn: () => openChest(cell, p) }));
  opts.push({ label: "戻る", cancel: true, fn: () => askOpenChest(cell) });
  showChoice(`${CHEST_RANKS[cRank]}宝箱 ― 誰が開ける？`, opts, ICONS.chest, { banner: "✦ 宝箱 ✦" });
}

function openChest(cell, opener) {
  if (cell) cell.cleared = true;
  G.stats.chests++; // 戦績: 開けた宝箱の数 (勲章用)
  questProgress("chest", null, 1); // 盤面の宝箱を開けた (サブクエスト用)
  rollChest(cell, true, () => { if (G.state === "board") renderBoard(); }, opener);
}

// 宝箱の中身を解決。allowDanger=falseなら罠/ミミックなし (戦闘後の宝箱。罠フェーズは戦果シート側)。
// opener: 開けると選ばれた人業 (罠解除判定に使う)。done は安全終了時のコールバック。
// cRankIn: 宝箱ランクの引き継ぎ (戦闘後の宝箱はセルがないため明示的に渡す)。sink: 結果の出し先
function rollChest(cell, allowDanger, done, opener, cRankIn, lvBonus, noGold = false, sink = boardSink()) {
  const cRank = cRankIn || (allowDanger ? chestRankOf(cell) : 1);
  if (allowDanger) {
    // 伝説の宝箱 (cell.lootBonus) はミミック/黒い宝箱に化けない
    const legendary = !!(cell && cell.lootBonus);
    // ミミック率: 一律3% (特別階「ミミックの巣」/異変「ミミックの行進」では高い方を採用)
    if (!legendary && Math.random() < Math.max(sfNum("mimicRate", 0.03), mutNum("mimicRate", 0))) {
      // ミミック出現時、10%でマスターミミック。強さはこの階の敵が基準
      //  (通常=+1ランク / マスター=+2ランク)。固有ドロップは無く、上質な宝箱を残す。
      const master = Math.random() < 0.10;
      const ref = mimicRef();
      SFX.trap(); buzz([0, 60, 40, 60]);
      log(master ? "宝箱はマスターミミックだった！" : "宝箱はミミックだった！", "dmg");
      sink.interrupt();
      showEvent({
        sprite: master ? MONSTERS.master_mimic : MONSTERS.mimic,
        title: master ? "マスターミミックだ！" : "ミミックだ！",
        accent: master ? "#ffd34d" : "#d4504e", banner: master ? "⚠ 危険 ⚠⚠" : "⚠ 危険 ⚠",
        lines: master ? ["金色に輝く宝箱が牙を剥いた！", "強敵だ。倒せば極上の宝が手に入る。"] : ["宝箱は怪物だった！", "倒せば上質な宝箱を残す。"],
        btnLabel: "戦う",
        onClose: () => startBattle(soloFoes(spawnMimic(ref.rank, ref.scale, master)), cell),
      });
      return;
    }
    // 黒い宝箱: 一段上のレベル帯の品が眠るが、開けると呪いの危険を伴う (任意の賭け)
    if (!legendary && Math.random() < 0.10) {
      sink.interrupt();
      askCursedChest(done);
      return;
    }
    // 罠フェーズ: 70%で罠。解除/発動/罠なしを知らせて中身へ
    chestTrapPhase(opener, () => chestContents(cell, done, cRank, lvBonus, noGold, sink), cRank, done, null, sink);
    return;
  }
  chestContents(cell, done, cRank, lvBonus, noGold, sink);
}

// 罠フェーズ (盤面・戦闘後の宝箱共通): cfg.trapRate (デフォルト0.70) の確率で罠が仕掛けられている。
// activeCfg().trapRate を参照することで「静寂の刻」等の日替わり修飾が宝箱にも適用される。
// 迷宮ランクに応じた罠を抽選し、開けた者が解除を試みる (難度はダンジョンランク×宝箱ランク)。
// 解除・罠なしは出し先に一行で知らせて contents() へ進む (札で止めない)。
// abort: テレポーター/警報で中身を失った時の終了処理 (省略時は盤面へ)。
// excludeKinds: 出現させない罠の型 (踏破演出など、戦闘で続きが途切れる場面で使う)
function chestTrapPhase(opener, contents, cRank = 1, abort, excludeKinds, sink = boardSink()) {
  const cfg = activeCfg();
  // cfg.trapRate === 0 は「罠なし」修飾 (静寂の刻など)。特別階「静寂の階」(noTrap) も同様に、
  // 床の罠だけでなく宝箱の罠も出さない。
  const trapProb = (cfg.trapRate === 0 || sfNum("noTrap", false)) ? 0 : 0.70;
  if (Math.random() < trapProb) {
    const trap = pickTrap(cfg.rank || 1, Math.random, excludeKinds);
    const who = opener || bestDisarmer();
    const chance = disarmChance(who, cRank);
    if (who && Math.random() < chance) {
      SFX.chest();
      G.stats.trapsDisarmed++; // 戦績: 解除した罠 (勲章用)
      log(`宝箱の罠「${trap.name}」を ${who.name}が解除した！`, "sys");
      sink.note(`罠「${trap.name}」― ${who.name}が解除した`, "good", ICONS.trap);
      contents();
      return;
    }
    // 解除失敗: 罠が発動。生き残れば中身は手に入る (テレポーター/警報は中身を失う)
    if (who) log(`${who.name}は罠「${trap.name}」の解除に失敗した！`, "dmg");
    presentTrap(applyTrap(trap, who), { chest: true, proceed: contents, abort }, sink);
    return;
  }
  SFX.chest();
  log("宝箱に罠はなかった。", "sys");
  if (sink.mode !== "board") sink.note("罠はなかった", "info");
  contents();
}

// ===== 罠の発動 (床罠・宝箱罠共通) =====
// 罠ダメージの基準値。disarmNeed と同じく迷宮の魂レベル帯×ランクに比例させ、
// 深い迷宮ほど罠そのものが重くなる。実ダメージは罠ごとの mult を掛けた値
function trapBaseDmg() {
  const cfg = activeCfg();
  const L = 2 + (cfg.soulLevelBonus || 0) * 2.4;
  const f = 1 + (L - 1) * 0.12;
  const q = 1 + ((cfg.rank || 1) - 1) * 0.12;
  return (5 + G.floor * 3 + rand(6)) * f * q;
}

// 罠の効果を適用し、何が起きたかを返す (知らせ方は presentTrap が決める)。
// opener: 開けた者/先頭の解除役 (opener型の罠が狙う)。
// 返り値 kind: "teleport" (飛ばされる・中身を失う) | "alarm" (戦闘・中身を失う) | "harm" (痛手/吸収。fallen/wiped を伴う)
function applyTrap(trap, opener) {
  SFX.trap(); buzz([0, 60, 40, 60]);
  G.stats.trapsSprung++; // 戦績: 発動させてしまった罠 (勲章用)
  log(`罠だ！ 「${trap.name}」が発動した！`, "dmg");
  const alive = () => G.party.filter((p) => p.alive);

  // テレポーター: 同じ階の別の場所へ飛ばされる。宝箱の中身は失われる
  if (trap.kind === "teleport") return { kind: "teleport", trap, lines: [trap.flavor, "パーティは見知らぬ場所へ飛ばされた！"] };

  // 警報: 怪物を呼び寄せ戦闘になる。宝箱の中身を検める暇はない
  if (trap.kind === "alarm") {
    const cfg = activeCfg();
    const deep = G.floor > (cfg.floors || 3) / 2;
    const pool = ((trap.horde || deep) ? cfg.deepPool : cfg.pool) || cfg.pool || ["cm_slime"];
    const key = pool[rand(pool.length)];
    return {
      kind: "alarm", trap, key, scale: enemyScale() * (trap.horde ? 1.25 : 1), opts: trap.horde ? { min: 4 } : null,
      lines: [trap.flavor, trap.horde ? "怪物の群れが雪崩れ込んでくる！" : "怪物が呼び寄せられた！"],
    };
  }

  // 残りはダメージ/吸収系: 効果を適用して結果をまとめる。
  // 控えの結社 罠師の目 (trapEye)=罠ダメ軽減 / 加護の祈り (wardField)=状態異常付与率を抑える
  const teLv = partyPassiveLv("trapEye");
  const trapDmgMul = teLv >= 3 ? 0.5 : teLv >= 2 ? 0.65 : teLv >= 1 ? 0.8 : 1;
  const wfLv = partyPassiveLv("wardField");
  const ailMul = wfLv >= 3 ? 0.3 : wfLv >= 2 ? 0.5 : wfLv >= 1 ? 0.7 : 1;
  const lines = [trap.flavor];
  const fallen = [], hurtList = [], brief = [];
  const hurt = (p, mult) => {
    const dmg = Math.max(1, Math.round(trapBaseDmg() * mult * trapDmgMul));
    p.hp = Math.max(0, p.hp - dmg);
    lines.push(`${p.name}に ${dmg} ダメージ！`);
    brief.push(`${p.name} -${dmg}`);
    if (!hurtList.includes(p)) hurtList.push(p);
    if (p.hp === 0) {
      p.alive = false; fallen.push(p);
      lines.push(`${p.name}は倒れた…`);
      log(`${p.name}は倒れた…`, "dmg");
    }
    return p.alive;
  };
  const afflict = (p, ail, chance) => {
    // 装備の状態異常耐性 (ailRes) と解呪の宝珠 (ailmentImmune) も罠に効く
    if (!ail || !p.alive || p.ailment || (p.eff && p.eff.ailmentImmune)) return;
    const eqRes = (p.ailRes && p.ailRes[ail]) || 0;
    if (Math.random() >= chance * ailMul * (1 - eqRes)) return;
    p.ailment = ail;
    lines.push(`${p.name}は${AIL_NAME[ail]}に侵された！`);
    brief.push(`${p.name} ${AIL_NAME[ail]}`);
  };
  switch (trap.kind) {
    case "opener":
    case "one": {
      const pool = alive();
      if (!pool.length) break;
      const t = (trap.kind === "opener" && opener && opener.alive) ? opener : pool[rand(pool.length)];
      if (trap.dieChance && Math.random() < trap.dieChance) {
        t.hp = 0; t.alive = false; fallen.push(t); hurtList.push(t);
        lines.push(`${t.name}は罠の直撃を受け、倒れた…`);
        log(`${t.name}は倒れた…`, "dmg");
      } else if (hurt(t, trap.mult)) {
        afflict(t, trap.ail, trap.ailChance || 1);
      }
      break;
    }
    case "multi": {
      for (let i = 0; i < (trap.hits || 2); i++) {
        const pool = alive();
        if (!pool.length) break;
        const t = pool[rand(pool.length)];
        if (hurt(t, trap.mult)) afflict(t, trap.ail, trap.ailChance || 1);
      }
      break;
    }
    case "party": {
      for (const p of alive()) if (hurt(p, trap.mult)) afflict(p, trap.ail, trap.ailChance || 1);
      break;
    }
    case "pct": {
      for (const p of alive()) {
        const dmg = Math.max(1, Math.ceil(p.maxhp * trap.pct));
        p.hp = Math.max(0, p.hp - dmg);
        lines.push(`${p.name}は生気を ${dmg} 吸われた！`);
        brief.push(`${p.name} -${dmg}`);
        hurtList.push(p);
        if (p.hp === 0) { p.alive = false; fallen.push(p); lines.push(`${p.name}は倒れた…`); log(`${p.name}は倒れた…`, "dmg"); }
      }
      break;
    }
    case "mp": {
      for (const p of alive()) {
        p.mp = Math.max(0, p.mp - Math.ceil(p.maxmp * 0.4));
        hurt(p, trap.mult || 0.25);
      }
      lines.push("パーティの魔力が吸い取られた…");
      brief.unshift("魔力を吸われた");
      break;
    }
    case "gold": {
      const loss = Math.min(G.gold, Math.round(G.gold * 0.15) + 10);
      G.gold = Math.max(0, G.gold - loss);
      updateTopbar();
      lines.push(`${loss} ゴールドが溶かされた…`);
      brief.push(`💰-${loss}`);
      log(`${loss} ゴールドを失った…`, "dmg");
      break;
    }
    case "soul": {
      const loss = Math.min(G.soulPts, Math.round(G.soulPts * 0.10) + 5);
      G.soulPts = Math.max(0, G.soulPts - loss);
      updateTopbar();
      lines.push(`✦${loss} Soul を吸い取られた…`);
      brief.push(`✦-${loss}`);
      log(`✦${loss} Soul を失った…`, "dmg");
      break;
    }
  }
  return { kind: "harm", trap, lines, fallen, hurt: hurtList, wiped: !G.party.some((p) => p.alive), brief: brief.slice(0, 3).join(" ・ ") };
}

// テレポーター: 同じ階の、踏破済みの別の場所へ飛ばされる
function teleportParty() {
  const spots = [];
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const c = G.board.cells[y][x];
    if (c.cleared && c.type !== "stairs" && !(x === G.px && y === G.py)) spots.push({ x, y });
  }
  if (spots.length) {
    const s = spots[rand(spots.length)];
    G.px = s.x; G.py = s.y;
    G.board.cells[s.y][s.x].revealed = true;
  }
  flashScreen("#8a2be2");
  SFX.stairs();
}

// 罠の結果を知らせる (§3.6): 軽い痛手・吸収はトースト (札が赤く明滅) で知らせてそのまま続ける。
// 札で止めるのは、飛ばされた・呼び寄せた (戦闘)・倒れた者が出た・全滅 の時だけ。
// fin.proceed: 生存時の続き (宝箱なら中身の取得、床罠なら盤面へ戻る) / fin.abort: 中身を失った時の終わり
function presentTrap(res, fin, sink = boardSink()) {
  const chest = !!fin.chest;
  const trap = res.trap;
  if (res.kind === "teleport") {
    sink.interrupt();
    showEvent({
      sprite: ICONS.trap, title: `${trap.name}！`, accent: "#8a2be2", banner: chest ? "✗ 罠解除失敗 ✗" : "⚠ 罠 ⚠",
      lines: [...res.lines, ...(chest ? ["宝箱は闇の彼方に消えた…"] : [])],
      btnLabel: "進む",
      onClose: () => { teleportParty(); if (fin.abort) fin.abort(); else renderBoard(); },
    });
    return;
  }
  if (res.kind === "alarm") {
    sink.interrupt();
    showEvent({
      sprite: ICONS.trap, title: `${trap.name}！`, accent: "#d4504e", banner: chest ? "✗ 罠解除失敗 ✗" : "⚠ 罠 ⚠",
      lines: [...res.lines, ...(chest ? ["宝箱を検める暇はない！"] : [])],
      btnLabel: "戦う",
      onClose: () => startBattle(spawnCardEnemies(res.key, G.floor, res.scale, res.opts), null),
    });
    return;
  }
  flashPartyCards(res.hurt, "hit");
  if (res.wiped || res.fallen.length) {
    sink.interrupt();
    showEvent({
      sprite: ICONS.trap, title: chest ? `解除失敗！「${trap.name}」発動` : `${trap.name}！`, lines: res.lines, accent: "#d4504e",
      banner: chest ? "✗ 罠解除失敗 ✗" : "⚠ 危険 ⚠", btnLabel: res.wiped ? "…" : "進む",
      onClose: () => {
        if (res.wiped) { gameOver(); return; }
        SFX.die();
        imprintFallen();
        fin.proceed(); // 痛手は負ったが、先へ進める (宝箱なら中身は手に入る)
      },
    });
    return;
  }
  imprintFallen();
  sink.note(`${chest ? "解除失敗 ― " : ""}罠「${trap.name}」${res.brief ? " ― " + res.brief : ""}`, "bad", ICONS.trap);
  fin.proceed();
}

// 宝箱の中身 (ゴールド/装備品/収集品)。cRank: 宝箱ランク (1-5、高いほど豪華)
// lvBonus: ミミック撃破後の宝箱などのアイテムレベル底上げ。
// cell.lootBonus: 特別階 (伝説の眠る階) の「伝説の宝箱」— 中身は必ず装備品で +40レベル
function chestContents(cell, done, cRank = 1, lvBonus = 0, noGold = false, sink = boardSink()) {
  const lootUp = (lvBonus || 0) + ((cell && cell.lootBonus) || 0);
  const legendary = !!(cell && cell.lootBonus);
  const rankMul = 1 + ((cRank || 1) - 1) * 0.3;
  const fin = done || (() => renderBoard());
  // 中身の抽選 (ダンジョンレベルに応じる): ゴールド50% / ゴールド以外のアイテム50%
  // 伝説の宝箱・ミミック宝箱はゴールドにならず、必ず装備品が出る
  if (!legendary && !noGold && Math.random() < 0.5) {
    SFX.chest();
    const dRank = activeCfg().rank || 1;
    const g = runGainGold(Math.round((10 + G.floor * 12 + rand(30)) * (1 + (dRank - 1) * 0.5) * rankMul * 2));
    updateTopbar();
    log(`宝箱から ${g} ゴールドを手に入れた！`, "win");
    sink.gold(g, "宝箱");
    fin();
    return;
  }
  // 宝: 装備/アイテム (迷宮のアイテムレベル帯から抽選。高ランクの宝箱は一段上の帯)
  const id = pickLoot({ chestRank: cRank, lvBonus: lootUp });
  const got = giveItem(id);
  if (got) {
    if (legendary) { flashScreen("#ffcf4a"); SFX.victory(); log(`✦ 伝説の宝箱から ${got.item.name} を見つけた！`, "win"); }
    sink.loot(got.item, got.who, fin); // 演出 (トースト/祝祭) の後に fin
    return;
  }
  // 誰も持てない (§7 M8): 置いてきた品を今回の記録に残し、知らせる
  if (ITEMS[id] && !G.party.some((m) => m.items.length < MAX_ITEMS)) {
    const nm = itemName(markDungeonLoot({ ...ITEMS[id] }));
    runLost(nm);
    sink.lost(nm);
  }
  SFX.chest();
  if (done) done();
}

// 黒い宝箱: 開ければ一段上のレベル帯の装備が出るが、50%で呪いがふきだす。
// 「開けない」が常に選べる、純粋なリスクとリターンの賭け
function askCursedChest(done) {
  const openIt = () => {
    const giveLoot = () => {
      const id = pickLoot({ rare: true });
      const got = giveItem(id);
      if (got) { UI.loot(got.item, got.who, { source: "chest" }, done); return; }
      if (ITEMS[id] && !G.party.some((m) => m.items.length < MAX_ITEMS)) {
        const nm = itemName(markDungeonLoot({ ...ITEMS[id] }));
        runLost(nm);
        showToast(`持ちきれず置いてきた: ${nm}`, { tone: "bad" });
      }
      SFX.chest();
      done();
    };
    if (Math.random() < 0.5) {
      // 呪い: 全員ダメージ (死にはしない) + 毒か麻痺。その上で中身は手に入る
      SFX.trap(); buzz([0, 80, 60, 80]); flashScreen("#a01030");
      let cursed = false;
      for (const p of G.party) {
        if (!p.alive) continue;
        p.hp = Math.max(1, p.hp - Math.ceil(p.maxhp * 0.25));
        if (!p.ailment && Math.random() < 0.4) { p.ailment = Math.random() < 0.5 ? "poison" : "paralyze"; cursed = true; }
      }
      log("黒い宝箱から呪いがふきだした！", "dmg");
      flashPartyCards(G.party.filter((p) => p.alive), "hit");
      showToast(`呪いがふきだした ― 全員が生気を吸われた${cursed ? "・毒や麻痺も" : ""}`, { tone: "bad", icon: ICONS.trap });
    }
    giveLoot();
  };
  showChoice("黒い宝箱だ。禍々しい気配を放っている…", [
    { label: "開ける ― 上質な品 / 呪いの危険", danger: true, fn: openIt },
    { label: "立ち去る", fn: done },
  ], ICONS.chest, { banner: "⚠ 黒い宝箱 ⚠", accent: "#8a2be2", lines: ["一段上の品が眠る。半分の確率で呪いがふきだすが、中身は本物だ。"] });
}

// 戦闘勝利後の宝箱 (出現判定は endBattle 側)。ミミックはいないが罠は70%で仕掛けられており、
// 開ける者の解除値で判定する (盤面の宝箱と同じ罠フェーズを通る)。戦果シートに載せる宝箱の定義を返す。
// 敵がアイテムを落としていれば中身はそれ。なければダンジョンレベル準拠の抽選。
// exclude: 出さない罠 (踏破演出など続きがある時は戦闘になる警報を出さない)。lvBonus: ミミック撃破宝箱などの中身底上げ
function battleChestSpec(drops, lvBonus = 0, noGold = false, exclude = null) {
  const cRank = chestRankOf(null);
  const alive = G.party.filter((p) => p.alive);
  const openers = alive
    .map((p) => ({ uid: p.uid, name: p.name, pct: Math.round(disarmChance(p, cRank) * 100) }))
    .sort((a, b) => b.pct - a.pct);
  return {
    cRank, name: `${CHEST_RANKS[cRank]}宝箱`, openers,
    // 開ける: sink = 戦果シートの出し先 / done = 宝箱の処理が済んだ (シートが閉じられていても呼ぶ)
    open(uid, sink, done) {
      const p = alive.find((x) => x.uid === uid && x.alive) || bestDisarmer();
      const contents = () => {
        if (drops && drops.length) giveDropsFromChest(drops, 0, done, sink);
        else rollChest(null, false, done, null, cRank, lvBonus, noGold, sink);
      };
      chestTrapPhase(p, contents, cRank, done, exclude, sink);
    },
  };
}
// 宝箱から敵のドロップ品を順に取り出す。図鑑への開示も実際に手にした時に行う
function giveDropsFromChest(drops, i, done, sink = boardSink()) {
  if (i >= drops.length) { done(); return; }
  const d = drops[i];
  const next = () => giveDropsFromChest(drops, i + 1, done, sink);
  const who = G.party.find((p) => p.alive && p.items.length < MAX_ITEMS)
    || G.party.find((p) => p.items.length < MAX_ITEMS);
  if (!who) {
    log(`${itemName(d.item)}を見つけたが、誰も持てない…`, "sys");
    refundLR(d.item);
    runLost(itemName(d.item));
    sink.lost(itemName(d.item));
    next();
    return;
  }
  const ce = codexMonEntry(d.key);
  if (d.rare) ce.rare = true; else ce.normal = true;
  markDungeonLoot(d.item); // 未鑑定にしてから図鑑へ (先に記すと、まだ知らない品を「正体を知った」と数えてしまう)
  codexSeeItem(d.id, d.item);
  runGainItem(who, d.item);
  SFX.chest();
  log(`宝箱から ${d.name}の落とした ${itemName(d.item)} を手に入れた！`, logClassForItem(d.item, d.rare ? "win" : "sys"));
  sink.loot(d.item, who, next);
}


// 階段を降りる: 墨の帳 (約1.3秒・400ms 後はタップで飛ばせる) の暗転のうちに次の階へ。
// 強敵階・特別な階・奈落の変異の知らせは帳の中に2〜3行で添える (後から別の札は出さない)。
// 見落としても、見出しの迷宮名を押す「階の情報」でいつでも読み返せる
function descend() {
  evOnDescend(); // 迷宮のイベント: 誓いの破約など
  SFX.stairs();
  buzz([0, 20, 80, 20]);
  G.floor++;
  G.maxFloorReached = Math.max(G.maxFloorReached, G.floor);
  questProgress("floor", G.floor);
  // 奈落: 深度を進め、節目で変異を積む (呪縛の誓は進行が速い)
  let newMut = null;
  if (G.abyss) {
    G.abyss.depth = G.floor;
    const every = G.abyss.mods.includes("cursed") ? 2 : ABYSS_MUT_EVERY;
    if (G.floor % every === 0) newMut = addAbyssMutation();
    G.abyss._pendingMut = null;
  }
  // 控えの結社 戦間回復 (fieldRegen): 階を降りるたび隊全体のHP/MPを少し回復
  const frLv = partyPassiveLv("fieldRegen");
  if (frLv) {
    const pct = frLv >= 3 ? 0.06 : frLv >= 2 ? 0.04 : 0.02;
    let healed = false;
    for (const p of G.party) {
      if (!p.alive) continue;
      if (p.hp < p.maxhp) { p.hp = Math.min(p.maxhp, p.hp + Math.ceil(p.maxhp * pct)); healed = true; }
      if (p.mp < p.maxmp) { p.mp = Math.min(p.maxmp, p.mp + Math.ceil(p.maxmp * pct)); healed = true; }
    }
    if (healed) log("結社の戦間回復: 階を降りる道すがら、パーティの傷が癒えていく。", "win");
  }
  // 強敵階判定: 5階層以上の迷宮のみ、3F以降で10%の確率で発生
  G.eliteFloor = (activeCfg().floors || 3) >= 5 && G.floor >= 3 && Math.random() < 0.10;
  // 特別階判定: 強敵階でなければ、各候補の出現条件 (階数) と出現率で抽選。
  // 1F には特別な階は出現しない (2F以降のみ)。
  G.specialFloor = null;
  if (!G.eliteFloor && G.floor >= 2) {
    const r = Math.random();
    let acc = 0;
    for (const c of SPECIAL_FLOORS) {
      if (G.floor < c.minFloor) continue;
      if (c.cond && !c.cond(activeCfg())) continue;
      acc += c.rate;
      if (r < acc) { G.specialFloor = c.id; break; }
    }
  }
  // 迷宮のイベント (奈落の縦穴): 降りた先は強敵階
  if (G.run && G.run.ev && G.run.ev.forceElite) { G.run.ev.forceElite = false; G.eliteFloor = true; G.specialFloor = null; }
  const sp = specialDef();
  if (G.eliteFloor) {
    log("…強敵の気配がする。この階には通常では遭遇しない強大な存在が潜む。", "dmg");
  } else if (sp) {
    log(`…この階は何かが違う。「${sp.name}」だ。${sp.lines.join("")}`, "win");
  } else {
    log("階段を降りていく…", "sys");
  }
  if (newMut) log(`${newMut.kind === "boon" ? "奈落の恵み" : "奈落の変異"}「${newMut.name}」: ${newMut.desc}`, newMut.kind === "boon" ? "win" : "dmg");
  // 帳に添える行 (2〜3行)
  let tone = "", sub = "— さらに深く潜る —", lines = [], color = null;
  if (G.eliteFloor) {
    tone = "elite"; sub = "— 禍々しき気配 —";
    const ek = MONSTERS[eliteKey()];
    lines = ["この階には通常では遭遇しない強大な存在が潜む。", ek ? `強敵「${ek.name}」― 討てば希少な戦利品` : "討てば希少な戦利品が得られる。"];
  } else if (sp) {
    tone = "special"; sub = `— ${sp.name} —`; color = sp.accent;
    lines = sp.lines.slice(0, 2);
  }
  if (newMut) {
    lines = lines.concat([`${newMut.kind === "boon" ? "奈落の恵み" : "奈落の変異"}「${newMut.name}」`, newMut.desc]).slice(-3);
    if (!tone) { tone = newMut.kind === "boon" ? "special" : "elite"; color = newMut.accent; }
  }
  uiDungeonHud.floorTransition({
    floor: G.floor, tone, sub, color, lines,
    // 帳が完全に下りた瞬間に盤面を切り替える
    onSwap: () => {
      newFloor();
      renderBoard();
      autosave(true); // 新フロアを保存
    },
    onDone: () => { if (G.state === "board") renderBoard(); },
  });
}
// 画面全体のフラッシュ演出 (ボス撃破/伝説の魂/呪いなどの「特別な瞬間」用)
function flashScreen(color) {
  const f = el("div", "screen-flash");
  f.style.background = color;
  document.body.appendChild(f);
  setTimeout(() => f.classList.add("out"), 30);
  setTimeout(() => f.remove(), 700);
}

// 軽量トースト通知 (レベルアップなどの祝福演出)。キットのトースト (最大3つ・2.2秒)。
// opts: { tone, icon, rarity, action:{label, fn}, ms } (省略可)
function showToast(text, opts) {
  return kitToast(text, opts);
}

// ---- 戦闘 ----
// 6属性 (無属性を除く) から1つを無作為に
function randomElement() {
  const els = Object.keys(ELEMENTS).filter((k) => k !== "none");
  return els[Math.floor(Math.random() * els.length)];
}
function startBattle(enemies, cell) {
  // 迷宮の属性気配: 属性持ち迷宮では雑魚敵が迷宮属性を帯びやすい (主・強敵は固有属性のまま)
  const cfg = activeCfg();
  const spFloor = specialDef();
  const isElite = enemies.some((e) => e.mon && e.mon.elite);
  if (cfg.element) {
    const ch = (spFloor && spFloor.elemAll) || mutNum("elemAll", false) ? 1 : 0.5;
    for (const e of enemies) if (!e.boss && !(e.mon && e.mon.elite) && Math.random() < ch) e.element = cfg.element;
  }
  // 属性の暴走 (異変): 主・強敵も含め、すべての敵の属性を6属性からでたらめに選び直す (召喚された仲間も同じ)
  if (mutNum("elemRandom", false)) for (const e of enemies) { e._elemRandom = true; e.element = randomElement(); }
  // 迷宮の異変 (血の満潮など): 敵の強さ倍率は HP/ATK/VIT に加えて AGI にも掛ける
  // (enemyScale は HP/ATK/VIT のみ。召喚で呼ばれた仲間も _agiMul を引き継ぐ)
  // 迷宮ごとの手直し (DUNGEON_TUNE) は強さだけ: 倍率で増減した戦果 (金貨・✦Soul) を元の曲線へ戻す
  const tn = inDungeon() && !abyssActive() ? activeCfg().tune : null;
  if (tn) {
    const tm = tuneMul();
    for (const e of enemies) {
      const k = e.boss ? (tn.bossMul || 1) : e._tuneK != null ? e._tuneK : tm;
      if (k !== 1) { e.soul = Math.round((e.soul || 0) / k); e.gold = Math.round((e.gold || 0) / k); }
    }
  }
  const mutEm = (mutDef() && mutDef().enemyMul) || 1;
  if (mutEm !== 1) for (const e of enemies) { e._agiMul = mutEm; e.agi = Math.max(1, Math.round(e.agi * mutEm)); }
  G.battleCell = cell;
  G.state = "combat";
  _maskEnemies = enemies;

  combatMenu.classList.remove("hidden");
  // 同種の群れは「ゴブリン ×4」とまとめて告げる (個体名は A/B/C… 付き)
  const sameKind = enemies.length > 1 && enemies.every((e) => e.key === enemies[0].key);
  // 名前は討伐数1で明かす (それまでは「？？？」。迷宮の主は最初から名乗る)
  log(`${sameKind ? `${enemyReveal(enemies[0]).name ? enemies[0].mon.name : "？？？"} ×${enemies.length}` : enemies.map(enemyLabel).join("・")} が現れた！`, "dmg");
  // 先制・奇襲の判定 (ボス戦・強敵戦では発生しない)。
  // 周囲警戒 (vigilance) が奇襲を抑え、先制の心得 (initiative) が先制を伸ばす
  const isBoss = enemies.some((e) => e.boss);
  // オート継続 (§7 M2): 前の戦闘から持ち越したオートは、主・強敵の戦いと深手 (HP3割未満) の者がいる時は止める
  if (G.autoCombat && (isBoss || isElite || G.party.some((p) => p.alive && p.hp < p.maxhp * 0.3))) {
    G.autoCombat = false;
    const why = isBoss || isElite ? "手強い相手だ" : "深手の者がいる";
    setTimeout(() => showToast(`${why} ― オートを止めた`, { tone: "info" }), 350);
  }
  let opening = null;
  let openSrc = null, ambRate = 0; // テスト記録: 開幕の出どころ (rand/event/smuggler/candle) と、抽選の奇襲率
  if (!isBoss && !isElite) {
    const vig = partyPassiveLv("vigilance");
    // 迷宮の異変 (闇討ちの宴): 奇襲率が跳ね上がる (周囲警戒は引き続き有効)
    const amb = (spFloor && spFloor.noAmbush) ? 0 : 0.08 * mutNum("ambushMul", 1) * (vig >= 2 ? 0 : vig === 1 ? 0.5 : 1);
    // 追い風の階 (preempt100) では必ず先手を取れる。
    // 先制の心得 (initiative) で +15/25/40%、周囲警戒Lv3 で挑戦時さらに +10%
    const ini = partyPassiveLv("initiative");
    const iniBonus = ini >= 3 ? 0.40 : ini >= 2 ? 0.25 : ini >= 1 ? 0.15 : 0;
    const pre = (spFloor && spFloor.preempt100) ? 1 : 0.08 + iniBonus + (vig >= 3 ? 0.10 : 0);
    const r = Math.random();
    if (r < amb) opening = "ambush";
    else if (r < amb + pre) opening = "preempt";
    ambRate = amb;
    if (opening) openSrc = "rand";
  }
  // 迷宮のイベント: 出来事が決めた開幕 (寝首/奇襲) ・ 密輸人の待ち伏せ ・ 祈りの蝋燭
  if (!isBoss && !isElite) {
    const rv = G.run && G.run.ev && inDungeon() && !abyssActive() ? G.run.ev : null;
    if (G._evOpening) { opening = G._evOpening; openSrc = "event"; }
    else if (rv && rv.ambushNext > 0) { rv.ambushNext--; opening = "ambush"; openSrc = "smuggler"; log("密輸人どもが荷の仕返しに待ち伏せていた！", "dmg"); }
    else if (rv && rv.preempt > 0) { rv.preempt--; opening = "preempt"; openSrc = "candle"; log("祈りの蝋燭の灯が、闇を味方につけた。", "win"); }
  } else if (G._evOpening && isElite) opening = null;
  G._evOpening = null;
  evBattleStart(enemies, isBoss);
  if (opening === "preempt") { log("先手を取った！", "win"); showToast("⚡ 先制攻撃！"); }
  else if (opening === "ambush") {
    // 奇襲: 紅い閃光・揺れ・専用の効果音で知らせ、開幕の帯 (drawAmbushIntro) と1ターン目の札で敵の先手を示す
    log("奇襲された！ 敵が先に動く！", "dmg");
    showToast("⚠ 奇襲された！ 敵の先手", { tone: "bad" });
    SFX.ambush(); flashScreen("#9a0a06"); shakeScreen(true); buzz([0, 90, 50, 90, 50, 160]);
  }
  // ランク帯ごとの戦闘テーマ (ボス・強敵は専用曲)。図鑑への記録は「倒した時」に行う (endBattle)
  playBgm(battleBgm(isBoss || isElite));
  G.battle = new Battle(G.party, enemies, log, { opening, noFlee: mutNum("noFlee", false), orderFleet: partyPassiveLv("fleetFoot"), fleeK: fleeScale() });
  // テスト記録: 戦闘の種類 (主 / 精鋭・ミミック・出来事の戦い / 通常) と開始時の様子
  if (tlOn() && inDungeon()) {
    const kind = isBoss ? "b" : (isElite || enemies.some((e) => e.isMimic) || (cell && cell.evFight)) ? "e" : "n";
    G.battle.tl = tlBattleBegin({ where: tlWhere(), kind, opening, openSrc, ambRate, party: G.party, enemies });
  }
  _maskEnemies = null;
  G.fx = null;
  G.animating = false;
  G.enemyPos = {};
  if (G.partyFx) G.partyFx.clear();
  autosave(true); // 戦闘開始を保存
  // 居合・開幕呪撃の演出を先に流してから手番処理へ (発動を視覚的に伝える)
  const opens = G.battle.openingResults || [];
  playBattleIntro(() => {
    if (opens.length) { renderCombat(); playOpeningStrikes(opens, 0, combatStep); }
    else combatStep(); // 素早い敵が先手なら自動で動く
  });
}

// 戦闘開始時の自動攻撃 (居合/開幕呪撃) を1つずつ斬撃エフェクトで見せる
function playOpeningStrikes(list, i, done) {
  if (i >= list.length) { done(); return; }
  const res = list[i];
  G.animating = true;
  if (res.opening === "iai") showToast("⚡ 居合！");
  else if (res.opening === "openSpell") showToast("✦ 開幕呪撃！");
  animateResult(res, () => playOpeningStrikes(list, i + 1, done));
}

// 全体描画 (キャンバス + パーティ + メニュー)
function renderCombat() {
  renderDock(); // 戦闘中は行動ドックを隠し、命令板に場所を譲る
  renderRunbar();
  renderCombatCanvas();
  renderParty();
  renderCombatMenu();
}

// キャンバスのみ (アニメーション毎フレーム用)
function renderCombatCanvas() {
  const b = G.battle;
  viewTransform();
  vctx.globalCompositeOperation = "source-over";
  vctx.globalAlpha = 1;
  const fx = G.fx;
  const now = performance.now();
  // 背景: 層ごとの戦場 (墓地・水路・廃坑…)。ボス/強敵戦は禍々しい光を重ねる。
  // 設定「戦闘の背景: 漆黒」では原作風に、黒地に白枠の窓で魔物だけを見せる
  if (PREFS.classicBattle) drawClassicWindow(vctx, VW, VH);
  else drawBattleBackdrop(vctx, VW, VH, battleLayer(), now, {
    boss: b.enemies.some((e) => e.boss),
    elite: b.enemies.some((e) => e.mon && e.mon.elite),
  });

  // 戦場の縦の伸び (縦長の戦場ほど魔物を大きく)
  const k = Math.max(0.92, Math.min(1.3, VH / 330));
  // 隊列: 4体以上は前衛(先頭3体)・後衛(4体目以降)の2列に分かれる。
  // 奥に立つ後衛から先に描き、前衛を手前に重ねて遠近を出す
  const frontRow = b.enemies.slice(0, 3);
  const backRow = b.enemies.slice(3);
  const rows = backRow.length
    ? [{ list: backRow, y: VH * 0.31, back: true }, { list: frontRow, y: VH * 0.5, back: false }]
    : [{ list: frontRow, y: VH * 0.41, back: false }];
  const intro = G.battleIntro && G.battleIntro.battle === b ? G.battleIntro : null;
  // 奇襲の1ターン目は、魔物の下に紅い縁と「敵の先手」の札を敷く (名札が重なれば名札を優先)
  if (!intro && b.opening === "ambush" && b._roundNo <= 1 && !b.result) drawAmbushTag(now);
  // タップで狙える敵 = 攻撃が届く敵のみ (対象選択中は候補、入力中は手番キャラの武器射程)
  const targetable = new Set(
    G.animating ? []
    : b.phase === "target" ? b.targetOptions().filter((t) => t.side === "enemy")
    : b.phase === "input" && b.current && b.current.side === "party" ? b.attackableEnemies(b.current)
    : []);
  const strongTarget = b.phase === "target";
  G.enemyPos = {};
  // 魔物の大きさ: 主は戦場を圧し、強敵は一回り大きく、後衛は奥で小さく。横に並ぶ数ぶんの幅に収める
  const sizeOf = (e, back, n) => {
    let sz = (e.boss ? 14 : (e.mon && e.mon.elite ? 1.15 : 1) * (back ? 8 : 9)) * k;
    if (e.mon && (e.mon.art || e.mon.photo)) {
      const bm = monsterBitmap(e.mon);
      const unit = Math.max(12, bm.w, bm.h) / 12;
      const slot = (VW / (n + 1)) * (n > 1 ? 1.12 : 1.6);
      sz = Math.min(sz, (slot / (bm.w + bm.pad * 2)) * unit);
    }
    return sz;
  };
  for (const row of rows) {
    // この列の名札の高さを揃える (いちばん背の高い魔物の足元の下)
    let foot = 0, head = 0;
    for (const e of row.list) { const hh = monsterHalfH(e.mon, sizeOf(e, row.back, row.list.length)); foot = Math.max(foot, hh); head = Math.max(head, hh); }
    const plateY = row.back ? row.y - head - 30 : row.y + foot + 7;
    row.list.forEach((e, i) => {
      const baseX = (VW / (row.list.length + 1)) * (i + 1);
      const baseY = row.y;
      const size = sizeOf(e, row.back, row.list.length);
      const hh = monsterHalfH(e.mon, size);
      G.enemyPos[e.uid] = { cx: baseX, cy: baseY, r: 70 * k, hh, size };
      // 倒した敵: 撃破の演出 (drawEffects の崩れ落ち) が始まるまでは姿を残し、以後は描かない
      if (!e.alive) {
        const d = fx && fx.deaths ? fx.deaths.find((x) => x.uid === e.uid) : null;
        if (!fx || _deadShown.has(e) || (d && now >= d.t0)) { if (!fx || d) _deadShown.add(e); return; }
      }
      let ox = 0, oy = 0, alpha = 1;
      // 攻撃側の踏み込み (こちらへ前進)
      const lunging = fx && fx.lunge && fx.lunge.uid === e.uid;
      if (lunging) oy = (fx.lunge.p || 0) * 22 * k;
      // 被弾フラッシュ: 点滅 + 横揺れ
      const hf = fx && fx.flash && fx.flash[e.uid];
      if (hf) {
        const dt = now - hf.t0;
        if (dt >= 0 && dt < 260) {
          ox = Math.sin(dt * 0.07) * 4;
          if (Math.floor(dt / 55) % 2 === 0) alpha = 0.4;
        }
      }
      // 待機中の浮遊: 宙に浮く魔物 (飛獣・鳥人・幽鬼・精霊・羽虫…) だけ、位相をずらしてゆっくり上下する
      // (地に足の着いた者は揺らさない。被弾・踏み込み中は止める)
      if (!hf && !lunging && !REDUCED_MOTION && isFloating(e.mon, e.key)) {
        oy += Math.round(Math.sin(now * 0.0024 + (e.uid || i) * 1.7) * 1.6);
      }
      const feetY = baseY + hh;
      // 戦闘開始の演出: 闇の奥から1体ずつ這い出る。まず黒い影だけが浮かび、遅れて色 (正体) がにじみ出す
      // (現れきるまで名札やHPは出さない。迷宮の主はひときわ長く闇に留まる)
      if (intro) {
        const kk = b.enemies.indexOf(e);
        const span = e.boss ? 1000 : 460;
        const p = Math.max(0, Math.min(1, (now - intro.t0 - 140 - kk * 90) / span));
        if (p < 1) {
          const ease = 1 - Math.pow(1 - p, 3);
          const rise = (1 - ease) * 12, sz = size * (0.94 + 0.06 * ease);
          vctx.save();
          vctx.globalAlpha = 0.45 * ease;
          vctx.fillStyle = "#000";
          vctx.beginPath();
          vctx.ellipse(baseX, feetY - 2, size * 3.4 * (0.5 + 0.5 * ease), size * 0.9, 0, 0, Math.PI * 2);
          vctx.fill();
          vctx.restore();
          const sil = Math.min(1, p / 0.4), col = Math.max(0, Math.min(1, (p - 0.38) / 0.62));
          if (col < 1) drawMonsterBmp(vctx, monsterSilhouette(e.mon), baseX, baseY + rise, sz, alpha * sil);
          if (col > 0) drawMonster(vctx, e.mon, baseX, baseY + rise, sz, alpha * col * col);
          return;
        }
      }
      const tappable = targetable.has(e);
      // 足元の照準環 (狙える敵)。対象選択中は鮮やかに回り、入力中は控えめに灯す
      if (tappable) drawTargetRing(baseX, feetY - 2, size, now, strongTarget);
      // 行動中の敵: 足元に紅い気配
      if (lunging) {
        vctx.save();
        vctx.globalCompositeOperation = "lighter";
        const g = vctx.createRadialGradient(baseX, feetY, 0, baseX, feetY, size * 4.2);
        g.addColorStop(0, `rgba(255,40,20,${0.35 * (fx.lunge.p || 0)})`);
        g.addColorStop(1, "rgba(255,40,20,0)");
        vctx.fillStyle = g;
        vctx.fillRect(baseX - size * 4.2, feetY - size * 4.2, size * 8.4, size * 8.4);
        vctx.restore();
      }
      // 足元の影 (踏み込みに追従)
      vctx.save();
      vctx.globalAlpha = 0.5;
      vctx.fillStyle = "#000";
      vctx.beginPath();
      vctx.ellipse(baseX + ox, feetY - 1 + oy * 0.3, size * 3.3, size * 0.95, 0, 0, Math.PI * 2);
      vctx.fill();
      vctx.restore();
      drawMonster(vctx, e.mon, baseX + ox, baseY + oy, size, alpha);
      // 被弾時の白い閃き (魔物の形に沿って)
      if (hf && now - hf.t0 >= 0 && now - hf.t0 < 170) {
        vctx.save();
        vctx.globalCompositeOperation = "lighter";
        drawMonsterBmp(vctx, monsterFlashBitmap(e.mon), baseX + ox, baseY + oy, size, 0.85 * (1 - (now - hf.t0) / 170));
        vctx.restore();
      }
      // 対象選択中: 頭上に降りる楔と四隅のかぎ
      if (tappable && strongTarget) drawTargetBrackets(baseX, baseY, hh, size, now);
      // 名札 + 血の小瓶 (HP)
      // 名前・HP は討伐数で明かす (enemyReveal): 名前は1体倒すまで「？？？」、HP の小瓶は5体倒すまで出さない (迷宮の主は名前が最初から、HP は1体で)
      drawEnemyPlate(e, baseX, plateY, tappable && strongTarget, k);
      const hpY = plateY + 17;
      if (enemyReveal(e).stats) drawEnemyHpVial(e, baseX, hpY, now, k);
      // バフ/デバフ表示 (味方カードの buffBadges に相当): 前衛はHPバーの下、後衛はプレートの上
      drawEnemyBadges(e, baseX, row.back ? plateY - 15 : hpY + 9);
    });
  }

  if (fx) drawEffects(fx, now);
  if (intro) drawBattleIntro(intro, now);
  renderTurnOrder();
}

// ===== 行動順の帯 (記録欄の上): 手番の者を先頭に、このラウンドでまだ動いていない者をアイコンで並べる =====
// 戦場を描くたびに呼ばれるので、並びが変わった時だけ作り直す
const turnOrderEl = document.getElementById("turn-order");
let _turnOrderKey = "";
const _turnIcons = new WeakMap(); // 敵の魔物 → { b: 元にした絵, c: アイコンの canvas }
const _turnPics = new WeakMap();  // 人業 → { key, c } (胸像)
const TURN_ICON_PX = 24;
function turnIconCanvas(a) {
  if (a.side === "party") {
    if (!a.isDoll || a.primary == null) return null;
    const key = `${a.jobKey || ""}:${a.jobRank || 1}:${a.clsKey || ""}`;
    let ent = _turnPics.get(a);
    if (!ent || ent.key !== key) { ent = { key, c: crispCanvas(dollBust(a), TURN_ICON_PX) }; _turnPics.set(a, ent); }
    return ent.c;
  }
  const mon = a.mon;
  if (!mon || !(mon.art || mon.photo)) return null;
  const b = monsterBitmap(mon);
  let ent = _turnIcons.get(mon);
  // 原画版の魔物は絵が読めた時にビットマップが差し替わるので、その時に描き直す
  if (!ent || ent.b !== b) {
    const dpr = Math.min(3, Math.max(1, Math.round(window.devicePixelRatio || 1)));
    const px = TURN_ICON_PX * dpr;
    const c = document.createElement("canvas");
    c.width = px; c.height = px;
    c.style.width = c.style.height = TURN_ICON_PX + "px";
    const g = c.getContext("2d");
    if (g) {
      const W = b.c.width, H = b.c.height, k = Math.min(px / W, px / H);
      g.imageSmoothingEnabled = k < 1;
      if (k < 1) g.imageSmoothingQuality = "high";
      g.drawImage(b.c, Math.round((px - W * k) / 2), Math.round((px - H * k) / 2), Math.round(W * k), Math.round(H * k));
    }
    ent = { b, c };
    _turnIcons.set(mon, ent);
  }
  return ent.c;
}
function renderTurnOrder() {
  if (!turnOrderEl) return;
  const b = G.battle;
  const on = G.state === "combat" && b && !b.result && b.current && b.phase !== "done";
  if (!on) {
    if (_turnOrderKey) { _turnOrderKey = ""; turnOrderEl.classList.add("hidden"); turnOrderEl.innerHTML = ""; }
    return;
  }
  const stunOf = (a) => (a.asleep || a.ailment === "paralyze" || a.ailment === "stone" ? "z" : a.mind ? "m" : "");
  const list = [b.current, ...b.queue.filter((a) => a && a.alive && a !== b.current)];
  const key = `${b._roundNo}|` + list.map((a) => `${a.side}${a.uid != null ? a.uid : a.name}${a.alive ? "" : "x"}${stunOf(a)}${a.side === "enemy" ? enemyLabel(a) : ""}`).join(",");
  if (key === _turnOrderKey) return;
  _turnOrderKey = key;
  turnOrderEl.innerHTML = "";
  turnOrderEl.classList.remove("hidden");
  const used = new Set();
  list.forEach((a, i) => {
    const enemy = a.side === "enemy";
    const name = enemy ? enemyLabel(a) : a.name;
    const st = stunOf(a);
    const ic = el("div", `to-ic ${enemy ? "e" : "p"}${i === 0 ? " now" : ""}${!a.alive ? " dead" : ""}${st === "z" ? " stun" : st === "m" ? " mind" : ""}${a.boss ? " boss" : ""}`);
    ic.title = (i === 0 ? "手番: " : "") + name;
    let c = turnIconCanvas(a);
    // 同じ魔物が並ぶと同じ canvas を2か所に置けないので、2体目以降は写しを作る
    if (c && used.has(c)) {
      const cp = document.createElement("canvas");
      cp.width = c.width; cp.height = c.height;
      cp.style.width = c.style.width; cp.style.height = c.style.height;
      const g = cp.getContext("2d");
      if (g) g.drawImage(c, 0, 0);
      c = cp;
    }
    if (c) { used.add(c); c.classList.add("to-pic"); ic.appendChild(c); }
    else ic.appendChild(el("span", "to-ch", (name || "？").replace(/^？？？/, "？").slice(0, 1)));
    // 同種が並ぶ敵は A/B… の札を添えて見分ける
    if (enemy) {
      const m = /[A-Z]$/.exec(name || "");
      if (m) ic.appendChild(el("span", "to-tag", m[0]));
    }
    turnOrderEl.appendChild(ic);
    if (i === 0 && list.length > 1) turnOrderEl.appendChild(el("span", "to-sep", "›"));
  });
}

const _deadShown = new WeakSet(); // 撃破の演出を見せ終えた敵
// 魔物を size で描いた時の見かけの半分の高さ
function monsterHalfH(mon, size) {
  if (!mon || !(mon.art || mon.photo)) return size * 6;
  const bm = monsterBitmap(mon);
  const dot = size / (Math.max(12, bm.w, bm.h) / 12);
  return ((bm.h + bm.pad * 2) * dot) / 2;
}
// 魔物の白い写し (被弾の閃き用)
const _monFlash = new WeakMap();
function monsterFlashBitmap(mon) {
  let s = _monFlash.get(mon);
  if (s) return s;
  const bm = monsterBitmap(mon);
  const c = document.createElement("canvas");
  c.width = bm.c.width; c.height = bm.c.height;
  const g = c.getContext("2d");
  g.drawImage(bm.c, 0, 0);
  g.globalCompositeOperation = "source-in";
  g.fillStyle = "#fff4e8";
  g.fillRect(0, 0, c.width, c.height);
  s = { c, w: bm.w, h: bm.h, pad: bm.pad };
  _monFlash.set(mon, s);
  return s;
}

// 照準の環: 足元に刻まれる回転する呪環 (金と血の色)
function drawTargetRing(x, y, size, now, strong) {
  const rx = size * 3.7, ry = size * 1.2;
  const rot = REDUCED_MOTION ? 0 : now * (strong ? 0.0016 : 0.0007);
  const pulse = REDUCED_MOTION ? 0.7 : 0.6 + 0.4 * Math.sin(now * 0.006);
  vctx.save();
  vctx.globalAlpha = strong ? 0.95 : 0.42;
  if (strong) {
    vctx.globalCompositeOperation = "lighter";
    const g = vctx.createRadialGradient(x, y, 0, x, y, rx);
    g.addColorStop(0, `rgba(255,120,60,${0.16 * pulse})`);
    g.addColorStop(1, "rgba(255,120,60,0)");
    vctx.fillStyle = g;
    vctx.save(); vctx.translate(x, y); vctx.scale(1, ry / rx); vctx.translate(-x, -y);
    vctx.fillRect(x - rx, y - rx, rx * 2, rx * 2);
    vctx.restore();
    vctx.globalCompositeOperation = "source-over";
  }
  vctx.strokeStyle = strong ? "#f3c86a" : "#c9a24a";
  vctx.lineWidth = strong ? 1.4 : 1;
  vctx.beginPath(); vctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); vctx.stroke();
  vctx.strokeStyle = strong ? "rgba(220,60,40,0.85)" : "rgba(180,50,40,0.6)";
  vctx.lineWidth = 1;
  vctx.beginPath(); vctx.ellipse(x, y, rx * 0.8, ry * 0.8, 0, 0, Math.PI * 2); vctx.stroke();
  // 環に刻まれた目盛り (回る)
  vctx.fillStyle = strong ? "#ffe2a0" : "#c9a24a";
  const n = 12;
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2;
    const px = x + Math.cos(a) * rx * 0.9, py = y + Math.sin(a) * ry * 0.9;
    vctx.fillRect(px - 1, py - 0.6, 2, 1.2);
  }
  vctx.restore();
}
// 対象選択中の印: 頭上の楔 (上下に揺れる) と、魔物を囲む四隅のかぎ
function drawTargetBrackets(x, cy, hh, size, now) {
  const bob = REDUCED_MOTION ? 0 : Math.sin(now * 0.008) * 2.5;
  const w = size * 3.6, top = cy - hh - 4, bot = cy + hh + 2;
  vctx.save();
  vctx.strokeStyle = "rgba(255,214,140,0.9)";
  vctx.lineWidth = 1.5;
  const L = 7;
  for (const [px, py, sx, sy] of [[x - w, top, 1, 1], [x + w, top, -1, 1], [x - w, bot, 1, -1], [x + w, bot, -1, -1]]) {
    vctx.beginPath(); vctx.moveTo(px, py + L * sy); vctx.lineTo(px, py); vctx.lineTo(px + L * sx, py); vctx.stroke();
  }
  // 楔 (下向きの刃)
  const ty = top - 10 + bob;
  vctx.fillStyle = "#ffd88a";
  vctx.strokeStyle = "#3a1408";
  vctx.lineWidth = 1;
  vctx.beginPath(); vctx.moveTo(x - 6, ty - 6); vctx.lineTo(x + 6, ty - 6); vctx.lineTo(x, ty + 3); vctx.closePath();
  vctx.fill(); vctx.stroke();
  vctx.fillStyle = "#fff6d8";
  vctx.fillRect(x - 3, ty - 5, 3, 1);
  vctx.restore();
}

// 敵の名札: 両端の尖った黒鉄の札。主は金、強敵は紅の縁。状態異常・属性 (看破) は札の右に印で添える
const ENEMY_SEAL = { poison: ["毒", "#8ee05a"], paralyze: ["痺", "#ffd84a"], stone: ["石", "#c9c4b8"] };
const MIND_SEAL = { charm: ["魅", "#ff8fc8"], confuse: ["乱", "#ffa860"] };
function drawEnemyPlate(e, x, y, hot, k) {
  vctx.save();
  vctx.font = `800 ${Math.round(11 * Math.min(k, 1.1))}px ${CANVAS_SERIF}`;
  vctx.textAlign = "center"; vctx.textBaseline = "middle";
  const label = enemyLabel(e);
  const tw = vctx.measureText(label).width;
  const pw = tw + 22, ph = 15, x0 = x - pw / 2, x1 = x + pw / 2;
  vctx.beginPath();
  vctx.moveTo(x0 + 6, y); vctx.lineTo(x1 - 6, y); vctx.lineTo(x1, y + ph / 2); vctx.lineTo(x1 - 6, y + ph); vctx.lineTo(x0 + 6, y + ph); vctx.lineTo(x0, y + ph / 2); vctx.closePath();
  const g = vctx.createLinearGradient(0, y, 0, y + ph);
  g.addColorStop(0, "rgba(34,22,24,0.94)"); g.addColorStop(1, "rgba(8,5,7,0.94)");
  vctx.fillStyle = g;
  vctx.fill();
  const edge = e.boss ? "#d9b25a" : e.mon && e.mon.elite ? "#ff5a40" : hot ? "#f3c86a" : "rgba(170,60,44,0.95)";
  if (e.boss || (e.mon && e.mon.elite)) { vctx.shadowColor = e.boss ? "rgba(255,200,100,0.6)" : "rgba(255,50,30,0.7)"; vctx.shadowBlur = 6; }
  vctx.strokeStyle = edge; vctx.lineWidth = 1;
  vctx.stroke();
  vctx.shadowBlur = 0;
  // 内側の細い罫
  vctx.strokeStyle = "rgba(255,230,190,0.08)";
  vctx.beginPath(); vctx.moveTo(x0 + 7, y + 2.5); vctx.lineTo(x1 - 7, y + 2.5); vctx.stroke();
  vctx.fillStyle = e.boss ? "#ffe0a0" : "#efe3cb";
  vctx.shadowColor = "#000"; vctx.shadowBlur = 0; vctx.shadowOffsetY = 1;
  vctx.fillText(label, x, y + ph / 2 + 0.5);
  vctx.shadowOffsetY = 0;
  // 右に添える印 (属性看破 / 状態異常 / 眠り / 怯み)
  const seals = [];
  if (partyPassiveLv("scan") && e.element && e.element !== "none") { const el2 = ELEMENTS[e.element] || {}; seals.push([el2.label || "?", el2.color || "#ccc"]); }
  if (e.ailment) seals.push(ENEMY_SEAL[e.ailment] || ["呪", "#c080ff"]);
  if (e.asleep) seals.push(["眠", "#8fc8ff"]);
  if (e.mind && MIND_SEAL[e.mind]) seals.push(MIND_SEAL[e.mind]);
  if (e._flinch) seals.push(["怯", "#d0a0ff"]);
  let sx = x1 + 9;
  vctx.font = `800 9px ${CANVAS_SERIF}`;
  for (const [t, c] of seals) {
    vctx.fillStyle = "rgba(6,4,6,0.9)";
    vctx.beginPath(); vctx.arc(sx, y + ph / 2, 7, 0, Math.PI * 2); vctx.fill();
    vctx.strokeStyle = c; vctx.lineWidth = 1; vctx.stroke();
    vctx.fillStyle = c;
    vctx.fillText(t, sx, y + ph / 2 + 0.5);
    sx += 16;
  }
  vctx.restore();
}
// 敵の HP: 硝子の小瓶に満ちた血。削られた分は淡い紅の名残として遅れて消える
const _hpLag = new WeakMap();
function drawEnemyHpVial(e, x, y, now, k) {
  const ratio = Math.max(0, Math.min(1, e.hp / (e.maxhp || 1)));
  let lag = _hpLag.get(e);
  if (!lag) { lag = { shown: ratio, from: ratio, t0: 0 }; _hpLag.set(e, lag); }
  if (ratio < lag.shown - 0.001) { lag.from = Math.max(lag.from, lag.shown); lag.t0 = now; lag.shown = ratio; }
  else if (ratio > lag.shown) { lag.shown = ratio; lag.from = ratio; }
  const lt = Math.min(1, Math.max(0, (now - lag.t0 - 220) / 520));
  const ghost = lag.from + (ratio - lag.from) * (lt * lt);
  if (lt >= 1) lag.from = ratio;
  const bw = Math.round((e.boss ? 120 : 64) * Math.min(k, 1.15)), bh = e.boss ? 7 : 6, bx = x - bw / 2;
  vctx.save();
  // 硝子の枠
  vctx.fillStyle = "#040203";
  vctx.beginPath(); vctx.roundRect ? vctx.roundRect(bx - 2, y - 2, bw + 4, bh + 4, 4) : vctx.rect(bx - 2, y - 2, bw + 4, bh + 4); vctx.fill();
  vctx.strokeStyle = e.boss ? "rgba(217,178,90,0.75)" : "rgba(150,110,80,0.5)"; vctx.lineWidth = 1;
  vctx.stroke();
  vctx.fillStyle = "#1a0b0d";
  vctx.fillRect(bx, y, bw, bh);
  // 名残 (削られた直後の淡い紅)
  if (ghost > ratio + 0.002) {
    vctx.fillStyle = "rgba(255,190,160,0.75)";
    vctx.fillRect(bx + bw * ratio, y, bw * (ghost - ratio), bh);
  }
  if (ratio > 0) {
    const hg = vctx.createLinearGradient(0, y, 0, y + bh);
    const low = ratio <= 0.3;
    hg.addColorStop(0, low ? "#ffb070" : "#ff7a62");
    hg.addColorStop(0.45, low ? "#c9541c" : "#c0241a");
    hg.addColorStop(1, low ? "#5a1c06" : "#4a0604");
    vctx.fillStyle = hg;
    vctx.fillRect(bx, y, bw * ratio, bh);
    vctx.fillStyle = "rgba(255,225,205,0.45)";
    vctx.fillRect(bx + 1, y + 1, Math.max(0, bw * ratio - 2), 1);
  }
  // 目盛り (主は4分割)
  if (e.boss) { vctx.fillStyle = "rgba(0,0,0,0.6)"; for (let i = 1; i < 4; i++) vctx.fillRect(bx + (bw * i) / 4, y, 1, bh); }
  vctx.restore();
}

// 戦闘開始の演出: 暗転から明け、迷宮の主なら名乗りの帯を掲げる
function drawBattleIntro(intro, now) {
  const t = now - intro.t0;
  const W = VW, H = VH;
  if (t < 240) {
    vctx.save();
    vctx.globalAlpha = 1 - t / 240;
    vctx.fillStyle = "#000";
    vctx.fillRect(0, 0, W, H);
    vctx.restore();
  }
  if (intro.ambush) { drawAmbushIntro(intro, t); return; }
  if (!intro.boss) return;
  const a = Math.min(1, Math.max(0, (t - 120) / 240)) * Math.min(1, Math.max(0, (intro.dur - t) / 340));
  if (a <= 0) return;
  const p = Math.min(1, Math.max(0, (t - 120) / 520));
  const ease = 1 - Math.pow(1 - p, 3);
  // 紅い縁の脈動 (戦場全体)
  vctx.save();
  const vg = vctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
  vg.addColorStop(0, "rgba(120,0,0,0)");
  vg.addColorStop(1, `rgba(120,6,4,${0.45 * a})`);
  vctx.fillStyle = vg;
  vctx.fillRect(0, 0, W, H);
  // 帯
  const bh = 58, by = H * 0.74 - bh / 2;
  vctx.globalAlpha = a;
  const g = vctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, "rgba(6,2,4,0)");
  g.addColorStop(0.16, "rgba(14,4,6,0.92)");
  g.addColorStop(0.84, "rgba(14,4,6,0.92)");
  g.addColorStop(1, "rgba(6,2,4,0)");
  vctx.fillStyle = g;
  vctx.fillRect(0, by, W, bh);
  // 金の罫 (中央から左右へ伸びる) と菱の飾り
  const lw = W * 0.36 * ease;
  vctx.fillStyle = "#c9a24a";
  vctx.fillRect(W / 2 - lw, by + 3, lw * 2, 1);
  vctx.fillRect(W / 2 - lw, by + bh - 4, lw * 2, 1);
  vctx.fillStyle = "rgba(160,20,14,0.9)";
  vctx.fillRect(W / 2 - lw * 0.9, by + 5, lw * 1.8, 1);
  vctx.fillRect(W / 2 - lw * 0.9, by + bh - 6, lw * 1.8, 1);
  for (const sx of [-1, 1]) {
    const dx = W / 2 + sx * (lw + 4), dy = by + bh / 2;
    vctx.fillStyle = "#c9a24a";
    vctx.beginPath(); vctx.moveTo(dx, dy - 5); vctx.lineTo(dx + 5, dy); vctx.lineTo(dx, dy + 5); vctx.lineTo(dx - 5, dy); vctx.closePath(); vctx.fill();
  }
  vctx.textAlign = "center";
  vctx.textBaseline = "alphabetic";
  vctx.font = `800 10px ${CANVAS_SERIF}`;
  if ("letterSpacing" in vctx) vctx.letterSpacing = "6px";
  vctx.fillStyle = "#e0503c";
  vctx.shadowColor = "rgba(255,40,20,0.8)"; vctx.shadowBlur = 8;
  vctx.fillText("迷 宮 の 主", W / 2, by + 18);
  if ("letterSpacing" in vctx) vctx.letterSpacing = "3px";
  const sc = 1.12 - 0.12 * ease;
  vctx.save();
  vctx.translate(W / 2, by + 44);
  vctx.scale(sc, sc);
  vctx.font = `800 24px ${CANVAS_SERIF}`;
  vctx.shadowBlur = 0;
  vctx.lineJoin = "round";
  vctx.lineWidth = 5;
  vctx.strokeStyle = "#000";
  vctx.strokeText(intro.boss, 0, 0);
  const tg = vctx.createLinearGradient(0, -20, 0, 2);
  tg.addColorStop(0, "#fff2c4"); tg.addColorStop(0.55, "#e8b85a"); tg.addColorStop(1, "#8a5a1c");
  vctx.fillStyle = tg;
  vctx.shadowColor = "rgba(255,170,60,0.55)"; vctx.shadowBlur = 12;
  vctx.fillText(intro.boss, 0, 0);
  vctx.restore();
  vctx.restore();
}

// 奇襲の開幕: 紅い縁が脈打ち、「奇 襲」の帯を叩きつける
function drawAmbushIntro(intro, t) {
  const W = VW, H = VH;
  const cl = (v) => Math.max(0, Math.min(1, v));
  const a = cl((t - 40) / 160) * cl((intro.dur - t) / 320);
  if (a <= 0) return;
  vctx.save();
  // 紅い縁 (心拍のように脈打つ)
  const beat = 0.65 + 0.35 * Math.abs(Math.sin(t * 0.0068));
  const vg = vctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.22, W / 2, H / 2, Math.max(W, H) * 0.72);
  vg.addColorStop(0, "rgba(150,0,0,0)");
  vg.addColorStop(1, `rgba(170,10,6,${0.6 * a * beat})`);
  vctx.fillStyle = vg;
  vctx.fillRect(0, 0, W, H);
  // 帯
  const bh = 60, by = H * 0.74 - bh / 2;
  vctx.globalAlpha = a;
  const g = vctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, "rgba(20,2,2,0)");
  g.addColorStop(0.16, "rgba(34,4,4,0.93)");
  g.addColorStop(0.84, "rgba(34,4,4,0.93)");
  g.addColorStop(1, "rgba(20,2,2,0)");
  vctx.fillStyle = g;
  vctx.fillRect(0, by, W, bh);
  // 紅い罫 (中央から左右へ伸びる)
  const ease = 1 - Math.pow(1 - cl((t - 40) / 300), 3);
  const lw = W * 0.38 * ease;
  vctx.fillStyle = "#e0503c";
  vctx.fillRect(W / 2 - lw, by + 3, lw * 2, 1);
  vctx.fillRect(W / 2 - lw, by + bh - 4, lw * 2, 1);
  // 文字: 小さな前書き + 叩きつけるように縮む「奇 襲」
  vctx.textAlign = "center";
  vctx.textBaseline = "alphabetic";
  vctx.font = `800 10px ${CANVAS_SERIF}`;
  if ("letterSpacing" in vctx) vctx.letterSpacing = "4px";
  vctx.fillStyle = "#ffb4a4";
  vctx.shadowColor = "rgba(255,40,20,0.8)"; vctx.shadowBlur = 8;
  vctx.fillText("背後を取られた", W / 2, by + 17);
  if ("letterSpacing" in vctx) vctx.letterSpacing = "2px";
  const slam = 1 - Math.pow(1 - cl((t - 60) / 220), 3);
  const sc = 1.45 - 0.45 * slam;
  vctx.save();
  vctx.translate(W / 2, by + 51);
  vctx.scale(sc, sc);
  vctx.globalAlpha = a * (0.3 + 0.7 * slam);
  vctx.font = `800 30px ${CANVAS_SERIF}`;
  vctx.shadowBlur = 0;
  vctx.lineJoin = "round";
  vctx.lineWidth = 5;
  vctx.strokeStyle = "#000";
  vctx.strokeText("奇 襲", 0, 0);
  const tg = vctx.createLinearGradient(0, -22, 0, 2);
  tg.addColorStop(0, "#fff4ec"); tg.addColorStop(0.5, "#ff8a6a"); tg.addColorStop(1, "#d0301c");
  vctx.fillStyle = tg;
  vctx.shadowColor = "rgba(255,50,30,0.7)"; vctx.shadowBlur = 14;
  vctx.fillText("奇 襲", 0, 0);
  vctx.restore();
  vctx.restore();
}

// 奇襲の1ターン目 (敵だけが動く間): 戦場の縁を薄く紅く脈打たせ、上端に「奇襲 ― 敵の先手」の札を残す
function drawAmbushTag(now) {
  const W = VW, H = VH;
  const pulse = REDUCED_MOTION ? 1 : 0.55 + 0.45 * Math.abs(Math.sin(now * 0.004));
  vctx.save();
  const vg = vctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
  vg.addColorStop(0, "rgba(150,0,0,0)");
  vg.addColorStop(1, `rgba(160,10,6,${0.28 * pulse})`);
  vctx.fillStyle = vg;
  vctx.fillRect(0, 0, W, H);
  const label = "奇襲 ― 敵の先手";
  vctx.font = `800 11px ${CANVAS_SERIF}`;
  if ("letterSpacing" in vctx) vctx.letterSpacing = "1px";
  const pw = Math.ceil(vctx.measureText(label).width) + 22, ph = 19;
  const px = Math.round((W - pw) / 2), py = 5;
  vctx.fillStyle = "rgba(34,4,4,0.86)";
  vctx.fillRect(px, py, pw, ph);
  vctx.strokeStyle = `rgba(228,85,79,${0.5 + 0.5 * pulse})`;
  vctx.lineWidth = 1;
  vctx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);
  vctx.textAlign = "center";
  vctx.textBaseline = "middle";
  vctx.fillStyle = "#ffc4b8";
  vctx.shadowColor = "rgba(255,40,20,0.7)"; vctx.shadowBlur = 6;
  vctx.fillText(label, W / 2, py + ph / 2 + 1);
  vctx.restore();
}

// 戦闘開始の演出を流してから done (手番処理) へ。演出中は入力を受けない
function playBattleIntro(done) {
  const b = G.battle;
  const boss = b.enemies.find((e) => e.boss);
  // 戦場の寸法をここで決めて、戦闘の間は固定する (盤面より横長の戦場へ)。行動ドックは命令板に場所を譲る
  renderDock();
  renderRunbar();
  renderParty();
  fitView();
  if (REDUCED_MOTION) { done(); return; }
  // 開幕の演出: オート中は短く、倍速 ON は標準、OFF はその 1/2 の速さ
  const introMul = G.autoCombat ? 0.6 : G.fastAnim ? 1 : 2;
  const ambush = b.opening === "ambush";
  let dur = (boss ? 1900 : 640 + b.enemies.length * 90) * introMul;
  if (ambush) dur = Math.max(dur, G.autoCombat ? 1150 : 1500); // 奇襲の帯を読めるだけ留める
  G.battleIntro = { battle: b, t0: performance.now(), dur, ambush, boss: boss ? (enemyReveal(boss).name ? (boss.mon && boss.mon.name) || boss.name : "？？？") : null };
  G.animating = true;
  combatMenu.innerHTML = "";
  if (G.autoCombat) renderAutoBanner();
  renderParty();
  const tick = () => {
    if (!G.battleIntro || G.battle !== b) return;
    renderCombatCanvas();
    if (performance.now() - G.battleIntro.t0 >= dur) {
      G.battleIntro = null;
      G.animating = false;
      done();
    } else requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ===== 魔物の描画 (ビットマップ化 + 黒い縁) =====
// 高精細の魔物絵 (64ドット級) を毎フレーム1ドットずつ描くと重いので、1ドット=1pxの画像に一度だけ焼き、
// 以後は拡大転写する。焼く時に「黒い縁 (ハロー)」を1ドット巡らせ、色の濃い戦闘背景からも輪郭が浮くようにする
// (ファミコン版風の縁取りなしの絵は、本来の黒地と同じ見え方になる)
const _monBmp = new WeakMap();
function monsterBitmap(mon) {
  let b = _monBmp.get(mon);
  if (b) return b;
  if (mon.photo) return photoMonsterBitmap(mon);
  const rows = mon.art || [];
  const h = rows.length, w = rows.reduce((m, r) => Math.max(m, r.length), 0);
  const pad = 1;
  const c = document.createElement("canvas");
  c.width = w + pad * 2; c.height = h + pad * 2;
  const g = c.getContext("2d");
  const col = (x, y) => { const ch = rows[y] && rows[y][x]; return ch && ch !== "." && ch !== " " ? mon.palette[ch] : null; };
  g.fillStyle = "rgba(0,0,0,0.88)";
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!col(x, y)) continue;
    g.fillRect(x + pad - 1, y + pad, 3, 1);
    g.fillRect(x + pad, y + pad - 1, 1, 3);
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const cc = col(x, y);
    if (!cc) continue;
    g.fillStyle = cc;
    g.fillRect(x + pad, y + pad, 1, 1);
  }
  b = { c, w, h, pad };
  _monBmp.set(mon, b);
  return b;
}
// 原画版の絵 (鏡の間の影など) を魔物として焼く: 1ドット = 原画の R px のまま、黒い縁を1ドット巡らせる。
// shade なら闇色に沈める。読み込み前は空の写しを返し (毎フレーム描き直すので読み込み後に現れる)、焼けてから覚える
function photoMonsterBitmap(mon) {
  const p = mon.photo, w = mon.w, h = mon.h, pad = 1;
  const R = Math.max(1, Math.round(p.sw / w));
  const c = document.createElement("canvas");
  c.width = (w + pad * 2) * R; c.height = (h + pad * 2) * R;
  const b = { c, w, h, pad };
  if (!(p.img && p.img.complete && p.img.naturalWidth > 0)) return b;
  const body = document.createElement("canvas");
  body.width = w * R; body.height = h * R;
  const bg = body.getContext("2d");
  drawPhoto(bg, mon, 0, 0, body.width, body.height);
  if (mon.shade) {
    // evShadeSprite の dark() と同じ写像: 明るさを保ったまま紫がかった闇色へ
    const id = bg.getImageData(0, 0, body.width, body.height), d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue;
      const l = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) / 255;
      d[i] = Math.round(40 * 0.35 + 150 * l * 0.65);
      d[i + 1] = Math.round(16 * 0.35 + 90 * l * 0.65);
      d[i + 2] = Math.round(70 * 0.35 + 220 * l * 0.65);
    }
    bg.putImageData(id, 0, 0);
  }
  // 黒い縁: 絵の影を上下左右へ1ドットずつずらして敷く
  const sil = document.createElement("canvas");
  sil.width = body.width; sil.height = body.height;
  const sg = sil.getContext("2d");
  sg.drawImage(body, 0, 0);
  sg.globalCompositeOperation = "source-in";
  sg.fillStyle = "rgba(0,0,0,0.88)";
  sg.fillRect(0, 0, sil.width, sil.height);
  const g = c.getContext("2d");
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) g.drawImage(sil, (pad + dx) * R, (pad + dy) * R);
  g.drawImage(body, pad * R, pad * R);
  _monBmp.set(mon, b);
  return b;
}
// 魔物の黒い影 (登場演出用): ビットマップを闇色で塗りつぶした写し
const _monSil = new WeakMap();
function monsterSilhouette(mon) {
  let s = _monSil.get(mon);
  if (s) return s;
  const b = monsterBitmap(mon);
  const c = document.createElement("canvas");
  c.width = b.c.width; c.height = b.c.height;
  const g = c.getContext("2d");
  g.drawImage(b.c, 0, 0);
  g.globalCompositeOperation = "source-in";
  g.fillStyle = "#050307";
  g.fillRect(0, 0, c.width, c.height);
  s = { c, w: b.w, h: b.h, pad: b.pad };
  if (_monBmp.get(mon) === b) _monSil.set(mon, s); // 原画版の読み込み待ち (空の写し) は覚えない
  return s;
}
// drawSpriteFit と同じ見かけの大きさ (12グリッド換算の size) で魔物を描く
function drawMonster(ctx, mon, cx, cy, size, alpha = 1) {
  if (!mon || !(mon.art || mon.photo)) return;
  drawMonsterBmp(ctx, monsterBitmap(mon), cx, cy, size, alpha);
}
function drawMonsterBmp(ctx, b, cx, cy, size, alpha = 1) {
  if (!b) return;
  const dot = size / (Math.max(12, b.w, b.h) / 12);
  const W = (b.w + b.pad * 2) * dot, H = (b.h + b.pad * 2) * dot;
  ctx.save();
  ctx.globalAlpha = alpha;
  // 1ドット未満に縮める時だけ滑らかに補間する (最近傍だとドットが間引かれてちらつく)
  ctx.imageSmoothingEnabled = dot < 1;
  if (dot < 1) ctx.imageSmoothingQuality = "high";
  ctx.drawImage(b.c, Math.round(cx - W / 2), Math.round(cy - H / 2), Math.round(W), Math.round(H));
  ctx.restore();
}

// 原作風の戦闘窓: 漆黒の地に、角を丸めた白い二重枠
function drawClassicWindow(ctx, w, h) {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.strokeStyle = "#e8e8e8";
  ctx.lineWidth = 3;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(8, 8, w - 16, h - 16, 10); else ctx.rect(8, 8, w - 16, h - 16);
  ctx.stroke();
  ctx.strokeStyle = "rgba(232,232,232,0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(14, 14, w - 28, h - 28, 6); else ctx.rect(14, 14, w - 28, h - 28);
  ctx.stroke();
  ctx.restore();
}

// 戦闘背景に使う層 (1-20)。奈落は素体迷宮の層を引き継ぐ (盤面のテーマと揃える)
function battleLayer() {
  const cfg = activeCfg();
  return cfg && cfg.layer ? cfg.layer : layerOf(dungeonNumber(cfg));
}

// 戦闘の常時アニメーション: 行動入力を待つ間も背景の粒子・敵の呼吸・照準リングを動かす。
// 演出中 (G.animating) は各 tick が描くので触らない。約20fpsに間引き、背面タブでは止まる
let _combatAnimLast = 0;
function combatAnimLoop(ts) {
  requestAnimationFrame(combatAnimLoop);
  if (G.state !== "combat" || !G.battle || G.animating || G.fx) return;
  if (uiBlocked()) return;
  // 戦闘中に手帳・設定を開いていたら、閉じた時に命令板を描き直す (倍速などの表示を合わせる)
  if (G._cmdStale) { G._cmdStale = false; renderCombatMenu(); }
  if (ts - _combatAnimLast < 50) return;
  _combatAnimLast = ts;
  renderCombatCanvas();
}
requestAnimationFrame(combatAnimLoop);

// 敵にかかっている強化(▲)/弱体(▼)を名前プレート付近に小さなピルで描く。
// 能力(攻/守/速)ごとに集約し、段階ぶんの矢印と最短残ターンを添える。
const BUFF_KANJI = {
  atk: "攻", vit: "守", agi: "速", int: "知", hit: "眼", seal: "封", taunt: "挑", shield: "庇", ctr: "返", charge: "溜", regen: "癒",
  r_fire: "火", r_water: "水", r_wind: "風", r_earth: "土", r_light: "光", r_dark: "闇", r_all: "属",
};
// 強化/弱体が「かかった瞬間」に出すフロート文字と色 (敵味方共通)。
// mods があれば能力ごとに 攻▲/守▼ … を並べ、無ければ汎用の 強化▲/弱体▼。
function buffFloatText(h) {
  const up = !!h.buff;
  const m = h.mods || {};
  const ks = Object.keys(m);
  // 向きは値で決める (捨て身の 守▼ のように強化の中に下がる能力もある)
  const body = ks.length ? ks.map((k) => `${BUFF_KANJI[k] || "◆"}${m[k] >= 1 ? "▲" : "▼"}`).join("") : (up ? "強化▲" : "弱体▼");
  return { text: body, color: up ? "#7fe0a0" : "#ff9a8a" };
}
function drawEnemyBadges(e, baseX, yTop) {
  if (!e.alive || !e.effects || !e.effects.length) return;
  const groups = new Map();
  for (const ef of e.effects) {
    const up = ef.mult > 1;
    const key = ef.stat + (up ? "+" : "-");
    const g = groups.get(key) || { stat: ef.stat, up, stages: 0, turns: Infinity };
    g.stages++; g.turns = Math.min(g.turns, ef.turns);
    groups.set(key, g);
  }
  const segs = [];
  for (const g of groups.values()) {
    const arrow = (g.up ? "▲" : "▼").repeat(Math.min(2, g.stages));
    segs.push({ text: `${BUFF_KANJI[g.stat] || "◆"}${arrow}${g.turns}`, up: g.up });
  }
  if (!segs.length) return;
  vctx.save();
  vctx.font = `800 9px ${CANVAS_SERIF}`;
  vctx.textAlign = "left";
  vctx.textBaseline = "middle";
  const pad = 3, gap = 3, h = 12;
  const widths = segs.map((s) => vctx.measureText(s.text).width + pad * 2);
  const total = widths.reduce((a, b) => a + b, 0) + gap * (segs.length - 1);
  let x = baseX - total / 2;
  const cy = yTop + h / 2;
  segs.forEach((s, i) => {
    const w = widths[i];
    vctx.fillStyle = s.up ? "rgba(36,84,40,0.88)" : "rgba(108,40,40,0.88)";
    vctx.beginPath();
    vctx.roundRect ? vctx.roundRect(x, yTop, w, h, 4) : vctx.rect(x, yTop, w, h);
    vctx.fill();
    vctx.strokeStyle = s.up ? "#6fcf6f" : "#ff7a72";
    vctx.lineWidth = 1;
    vctx.stroke();
    vctx.fillStyle = s.up ? "#c8f0c8" : "#ffc9c5";
    vctx.fillText(s.text, x + pad, cy + 0.5);
    x += w + gap;
  });
  vctx.restore();
}

// 攻撃/魔法/被弾エフェクトの描画
// 斬撃 = 三日月の閃光と血の飛沫 / 魔法 = 属性色の閃光と環 / 撃破 = 魔物が白く焼けて灰と残り火に崩れる
// 数字 = 重い明朝の数字 (会心は金で大きく、味方の被弾は紅)
function drawEffects(fx, now) {
  const spd = spdMul();
  // 撃破: 白く焼け、上へ崩れながら灰となって消える
  for (const d of fx.deaths || []) {
    const dur = 360 * spd;
    const t = (now - d.t0) / dur;
    if (t < 0 || t > 1) continue;
    const bm = monsterBitmap(d.mon);
    vctx.save();
    const lift = t * 10;
    if (t < 0.35) {
      drawMonster(vctx, d.mon, d.x, d.y - lift, d.size, 1 - t * 0.5);
      vctx.globalCompositeOperation = "lighter";
      drawMonsterBmp(vctx, monsterFlashBitmap(d.mon), d.x, d.y - lift, d.size, 0.9 * (1 - t / 0.35));
    } else {
      drawMonsterBmp(vctx, monsterSilhouette(d.mon), d.x, d.y - lift, d.size * (1 + (t - 0.35) * 0.08), 0.85 * (1 - (t - 0.35) / 0.65));
    }
    vctx.restore();
    // 灰と残り火
    const dot = d.size / (Math.max(12, bm.w, bm.h) / 12);
    const hw = (bm.w * dot) / 2, hh = (bm.h * dot) / 2;
    vctx.save();
    for (let i = 0; i < 26; i++) {
      const px = d.x + (h01(i, d.uid) - 0.5) * hw * 1.8, py0 = d.y + (h01(i + 40, d.uid) - 0.5) * hh * 1.8;
      const py = py0 - t * (20 + h01(i, 9) * 34);
      const ember = i % 3 === 0;
      vctx.globalAlpha = (1 - t) * (ember ? 0.95 : 0.6);
      vctx.fillStyle = ember ? (i % 2 ? "#ff7a3a" : "#ffc070") : "#4a4044";
      const s = ember ? 1.6 : 2.2;
      vctx.fillRect(px + Math.sin(t * 6 + i) * 3, py, s, s);
    }
    vctx.restore();
  }
  // 斬撃: 三日月の閃光が走り、紅い飛沫が散る
  for (const s of fx.slashes) {
    const t = (now - s.t0) / (240 * Math.max(0.6, spd));
    if (t < 0 || t > 1) continue; // t0 が未来 (多段の2撃目以降) のものはまだ描かない
    const sweep = Math.min(1, t / 0.45);
    const fade = t < 0.45 ? 1 : 1 - (t - 0.45) / 0.55;
    const dir = s.flip ? -1 : 1;
    vctx.save();
    vctx.translate(s.x, s.y);
    vctx.scale(dir, 1);
    vctx.rotate(-0.75);
    const R = 34 * (s.big ? 1.25 : 1);
    const a0 = -1.4, a1 = a0 + 2.6 * sweep;
    vctx.globalCompositeOperation = "lighter";
    vctx.globalAlpha = fade * 0.55;
    vctx.strokeStyle = s.crit ? "#ffb040" : "#ff5a3a";
    vctx.lineWidth = 9;
    vctx.lineCap = "round";
    vctx.beginPath(); vctx.arc(0, 0, R, a0, a1); vctx.stroke();
    vctx.globalAlpha = fade;
    vctx.strokeStyle = "#fff6ea";
    vctx.lineWidth = 3;
    vctx.beginPath(); vctx.arc(0, 0, R, a0 + 0.15 * sweep, a1); vctx.stroke();
    vctx.lineWidth = 1;
    vctx.beginPath(); vctx.arc(0, 0, R - 7, a0 + 0.5 * sweep, a1 - 0.1); vctx.stroke();
    vctx.restore();
    // 血の飛沫
    vctx.save();
    for (let i = 0; i < 9; i++) {
      const a = -0.6 + (h01(i, s.seed || 1) - 0.5) * 2.4 + (s.flip ? Math.PI : 0);
      const sp = 22 + h01(i + 9, s.seed || 1) * 30;
      const px = s.x + Math.cos(a) * sp * t, py = s.y + Math.sin(a) * sp * t + 30 * t * t;
      vctx.globalAlpha = Math.max(0, 1 - t * 1.1);
      vctx.fillStyle = i % 3 ? "#8a0e0a" : "#d0281a";
      const sz = 2.4 - t * 1.2;
      vctx.fillRect(px, py, sz, sz);
    }
    vctx.restore();
  }
  // 魔法: 属性色の閃光 → 広がる環 → 火花
  for (const m of fx.magic) {
    const t = (now - m.t0) / 380;
    if (t < 0 || t > 1) continue;
    vctx.save();
    vctx.globalCompositeOperation = "lighter";
    const flash = Math.max(0, 1 - t * 2.2);
    if (flash > 0) {
      const g = vctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, 46);
      g.addColorStop(0, `rgba(255,255,255,${0.75 * flash})`);
      g.addColorStop(0.35, hexA(m.color, 0.55 * flash));
      g.addColorStop(1, hexA(m.color, 0));
      vctx.fillStyle = g;
      vctx.fillRect(m.x - 46, m.y - 46, 92, 92);
    }
    vctx.globalAlpha = 1 - t;
    vctx.strokeStyle = m.color;
    vctx.lineWidth = 3.5 * (1 - t) + 0.5;
    vctx.beginPath(); vctx.arc(m.x, m.y, 6 + t * 40, 0, Math.PI * 2); vctx.stroke();
    vctx.strokeStyle = "rgba(255,255,255,0.8)";
    vctx.lineWidth = 1;
    vctx.beginPath(); vctx.arc(m.x, m.y, 4 + t * 28, 0, Math.PI * 2); vctx.stroke();
    vctx.fillStyle = m.color;
    for (let kk = 0; kk < 10; kk++) {
      const a = (kk / 10) * Math.PI * 2 + t * 2.6;
      const r = 8 + t * 36;
      vctx.fillRect(m.x + Math.cos(a) * r - 1.5, m.y + Math.sin(a) * r - 1.5, 3, 3);
    }
    vctx.restore();
  }
  // 画面の縁が紅く脈打つ (味方被弾)
  if (fx.screen) {
    const t = (now - fx.screen.t0) / 300;
    if (t <= 1) {
      vctx.save();
      const g = vctx.createRadialGradient(VW / 2, VH / 2, Math.min(VW, VH) * 0.25, VW / 2, VH / 2, Math.max(VW, VH) * 0.72);
      g.addColorStop(0, "rgba(160,0,0,0)");
      g.addColorStop(1, `rgba(170,8,4,${0.62 * (1 - t)})`);
      vctx.fillStyle = g;
      vctx.fillRect(0, 0, VW, VH);
      vctx.restore();
    }
  }
  // ダメージ数値 (弾んで現れ、少し留まって昇りながら消える)
  for (const f of fx.floats) {
    const t = (now - f.t0) / 760;
    if (t < 0 || t > 1) continue; // t0 が未来 (多段の2撃目以降) のものはまだ描かない
    drawFloatText(f, t);
  }
}
function hexA(hex, a) {
  if (!hex || hex[0] !== "#") return `rgba(255,255,255,${a})`;
  const n = parseInt(hex.slice(1, 7), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
// 浮かぶ文字: 種類ごとの書体と配色 (kind: dmg/crit/label/pdmg/heal/buff/info)
const FLOAT_STYLE = {
  dmg:   { px: 32, top: "#ffffff", bot: "#d9c8ac", glow: null },
  crit:  { px: 42, top: "#fff6c8", bot: "#ff9a1c", glow: "rgba(255,150,40,0.85)" },
  label: { px: 14, top: "#ffd27a", bot: "#ff8a2a", glow: "rgba(255,120,30,0.6)", spacing: 2 },
  pdmg:  { px: 32, top: "#ffb4a4", bot: "#d0281a", glow: "rgba(200,20,10,0.7)" },
  heal:  { px: 28, top: "#e4ffe0", bot: "#3cc060", glow: "rgba(80,220,120,0.6)" },
  buff:  { px: 16, top: null, bot: null, glow: null },
  info:  { px: 18, top: null, bot: null, glow: null },
};
function drawFloatText(f, t) {
  const kind = f.kind || (f.big ? "crit" : f.small ? "label" : f.color === "#fff" ? "dmg" : f.color === "#7CFC7C" ? "heal" : "info");
  const st = FLOAT_STYLE[kind] || FLOAT_STYLE.info;
  vctx.save();
  vctx.globalAlpha = t < 0.72 ? 1 : 1 - (t - 0.72) / 0.28;
  const pop = t < 0.1 ? 1 + (kind === "crit" ? 0.85 : 0.45) * (1 - t / 0.1) : 1;
  const px = Math.round(st.px * pop);
  vctx.font = `800 ${px}px ${CANVAS_SERIF}`;
  vctx.textAlign = "center";
  vctx.textBaseline = "alphabetic";
  if (st.spacing && "letterSpacing" in vctx) vctx.letterSpacing = st.spacing + "px";
  const yy = f.y - Math.sin(Math.min(1, t * 1.5) * Math.PI / 2) * 24;
  // 黒い縁取り + 下への落ち影
  vctx.lineJoin = "round";
  vctx.strokeStyle = "rgba(0,0,0,0.9)";
  vctx.lineWidth = kind === "crit" ? 5 : 4;
  vctx.strokeText(f.text, f.x + 1, yy + 2);
  vctx.strokeText(f.text, f.x, yy);
  if (st.glow) { vctx.shadowColor = st.glow; vctx.shadowBlur = kind === "crit" ? 14 : 8; }
  if (st.top) {
    const g = vctx.createLinearGradient(0, yy - px * 0.85, 0, yy);
    g.addColorStop(0, st.top); g.addColorStop(1, st.bot);
    vctx.fillStyle = g;
  } else vctx.fillStyle = f.color || "#fff";
  vctx.fillText(f.text, f.x, yy);
  vctx.restore();
}

// キャンバス座標(sx,sy)に最も近い生存中の敵を返す (一定距離以内のみ)。allowed があればその集合に限る
function nearestEnemyAt(sx, sy, allowed = null) {
  const b = G.battle;
  if (!b) return null;
  let best = null, bestD = 1e9;
  for (const e of b.enemies) {
    if (!e.alive || (allowed && !allowed.includes(e))) continue;
    const pos = G.enemyPos[e.uid];
    if (!pos) continue;
    const d = Math.hypot(sx - pos.cx, sy - pos.cy);
    if (d < bestD) { bestD = d; best = e; }
  }
  return best && bestD < ((G.enemyPos[best.uid] && G.enemyPos[best.uid].r) || 70) ? best : null;
}

// オート解除は指が触れた瞬間 (pointerdown) に効かせる。オート中は手番ごとに命令板が描き直されるので、
// click (押して離す) を待つと、その間に解除ボタンが差し替わってタップが消えてしまう。
// 解除した直後の click は、いま出たばかりの手動メニュー (攻撃など) に落ちないよう一度だけ握り潰す
let _swallowClickUntil = 0;
document.addEventListener("pointerdown", () => { _swallowClickUntil = 0; }, true);
document.addEventListener("click", (e) => {
  if (performance.now() >= _swallowClickUntil) return;
  _swallowClickUntil = 0;
  e.preventDefault(); e.stopPropagation();
}, true);
function stopAutoByTouch() {
  if (!G.autoCombat) return false;
  buzz(10);
  stopAutoCombat();
  _swallowClickUntil = performance.now() + 800;
  return true;
}
// 命令板のどこに触れても解除 (「次も続ける」の切り替えだけは除く)
combatMenu.addEventListener("pointerdown", (e) => {
  if (G.state !== "combat" || !G.autoCombat || combatMenu.dataset.mode !== "auto") return;
  if (e.button > 0 || e.target.closest(".cmd-keep")) return;
  stopAutoByTouch();
});

// オート戦闘の解除 (解除ボタン / 戦闘画面タップの共通処理)
function stopAutoCombat() {
  if (!G.autoCombat) return;
  G.autoCombat = false;
  if (G._autoTimer) { clearTimeout(G._autoTimer); G._autoTimer = null; }
  showToast("オート戦闘を解除した", { tone: "info" });
  if (G.animating) renderActingPlate(null); // 演出が終わると通常メニューに戻る
  else renderCombatMenu();
}

// ===== 戦闘のコマンド板 =====
// 鉄と石の重い札。主の一手 (攻撃) を大きく、ほかは下段に並べる。文字は textContent で入れる (名前の混入対策)
const CMD_SVG = {
  attack: '<path d="M20.5 3.5 20 8 10.2 17.8 6.2 13.8 16 4Z"/><path d="m5 13 6 6M7.6 16.4 3.5 20.5"/>',
  skill: '<path d="M12 2.5 13.9 10.1 21.5 12l-7.6 1.9L12 21.5l-1.9-7.6L2.5 12l7.6-1.9Z"/><circle cx="12" cy="12" r="2.2"/>',
  quick: '<path d="M12 3.2 14 9.4h6.4l-5.2 3.8 2 6.2L12 15.6l-5.2 3.8 2-6.2-5.2-3.8H10Z"/>',
  defend: '<path d="M12 2.8 19.5 5.6v6.1c0 4.7-3.1 8-7.5 9.5-4.4-1.5-7.5-4.8-7.5-9.5V5.6Z"/><path d="M12 6v12"/>',
  run: '<path d="M14 3.5h5.5v17H14"/><path d="M3.5 12h10M9.5 7.5l4.5 4.5-4.5 4.5"/>',
  auto: '<path d="M13.5 2.5 5 13.5h6l-1 8 8.5-11h-6Z"/>',
  fast: '<path d="M3.5 6v12l7.5-6Zm9 0v12l7.5-6Z"/>',
  back: '<path d="M15 4.5 7.5 12l7.5 7.5"/>',
  stop: '<path d="M7 7h10v10H7Z"/>',
  keep: '<path d="M4 12a8 8 0 0 1 13.7-5.6M20 12a8 8 0 0 1-13.7 5.6"/><path d="M17.8 2.8v3.8H14M6.2 21.2v-3.8H10"/>',
};
function cmdIcon(kind) {
  const ns = "http://www.w3.org/2000/svg";
  const sv = document.createElementNS(ns, "svg");
  sv.setAttribute("viewBox", "0 0 24 24");
  sv.setAttribute("aria-hidden", "true");
  sv.setAttribute("class", "cmd-ic");
  sv.innerHTML = CMD_SVG[kind] || "";
  return sv;
}
function cmdBtn(kind, label, sub, onClick, extra = "") {
  const b = btn("", onClick);
  b.className = "btn cmd cmd-" + kind + (extra ? " " + extra : "");
  b.appendChild(cmdIcon(kind));
  const t = el("span", "cmd-t");
  t.appendChild(el("span", "cmd-l", label));
  if (sub) t.appendChild(el("span", "cmd-s", sub));
  b.appendChild(t);
  b.setAttribute("aria-label", label + (sub ? " " + sub : ""));
  return b;
}
// 手番の札: 「名 の手番」+ 隊列と射程の印
function turnPlate(name, tail, chips = []) {
  const w = el("div", "who");
  w.appendChild(el("i", "who-mark"));
  w.appendChild(el("b", "who-n", name));
  if (tail) w.appendChild(el("span", "who-t", tail));
  for (const c of chips) w.appendChild(el("span", "who-c", c));
  return w;
}

// 演出の間の命令板: いま動いている者の札だけを掲げる (板の高さは CSS で保つ)
function renderActingPlate(actor) {
  combatMenu.innerHTML = "";
  combatMenu.dataset.mode = "acting";
  if (!actor) return;
  const foe = actor.side === "enemy";
  const b = G.battle;
  const ambushTurn = foe && b && b.opening === "ambush" && b._roundNo <= 1; // 奇襲で敵だけが動く1ターン目
  const w = turnPlate(foe ? enemyLabel(actor) : actor.name, foe ? "の攻勢" : "の行動", ambushTurn ? ["奇襲"] : []);
  if (foe) w.classList.add("who-foe");
  combatMenu.appendChild(w);
}

// オート戦闘中の常設バナー: 演出中も表示し続け、いつでも解除できる。
// 「次の戦闘も続ける」(§7 M2) もここで切り替えられる (主・強敵・深手の時は自動で止まる)
function renderAutoBanner(actor) {
  const plate = actor ? turnPlate(actor.name, "の手番", ["オート"]) : turnPlate("オート戦闘中", "", []);
  const keep = !!uiDungeonHud.getPref("autoKeep");
  // 既にバナーが出ていれば手番の札だけ差し替える (ボタンを作り直すと押している最中のタップが消える)
  const cur = combatMenu.dataset.mode === "auto" ? combatMenu.querySelector(":scope > .cmd-autorow") : null;
  if (cur && combatMenu.firstElementChild && combatMenu.firstElementChild !== cur) {
    combatMenu.firstElementChild.replaceWith(plate);
    const kb = cur.querySelector(".cmd-keep");
    if (kb) {
      kb.classList.toggle("on", keep);
      const sub = kb.querySelector(".cmd-s");
      if (sub) sub.textContent = keep ? "ON" : "OFF";
      kb.setAttribute("aria-label", "次も続ける " + (keep ? "ON" : "OFF"));
    }
    return;
  }
  combatMenu.innerHTML = "";
  combatMenu.dataset.mode = "auto";
  combatMenu.appendChild(plate);
  const row = el("div", "cmd-autorow");
  row.appendChild(cmdBtn("stop", "オート解除", "画面のタップでも解除", stopAutoCombat, "cmd-wide"));
  row.appendChild(cmdBtn("keep", "次も続ける", keep ? "ON" : "OFF", () => {
    uiDungeonHud.setPref("autoKeep", !uiDungeonHud.getPref("autoKeep"));
    SFX.select();
    showToast(uiDungeonHud.getPref("autoKeep") ? "オートを次の戦闘も続ける (主・強敵・深手で止まる)" : "オートはこの戦闘だけ", { tone: "info" });
    if (G.autoCombat) renderAutoBanner(G.battle && G.battle.phase === "input" ? G.battle.current : null);
  }, "cmd-keep" + (keep ? " on" : "")));
  combatMenu.appendChild(row);
}

// 攻撃の既定の狙い (§3.4): 直前に隊が狙った敵がまだ射程内ならそれ (集中して倒す)、なければ最も手前の敵。
// 画面の何もない所をタップした時と同じ「射程内の最寄り」
// 物理無効 (物理耐性3) の敵は、ほかに狙える敵がいる限り既定の狙いから外す。
// 魔法属性の武器 (actor.wMagic) を持つ者の通常攻撃は魔法耐性で判定するので、魔法無効 (魔法耐性3) の敵を外す
function physImmune(e, actor) { return !!(e && ((actor && actor.wMagic ? e.magResist : e.physResist) | 0) >= 3); }
function defaultAttackTarget(actor) {
  const b = G.battle;
  if (!b || !actor) return null;
  const all = b.attackableEnemies(actor).filter((e) => e.alive);
  if (!all.length) return null;
  const hittable = all.filter((e) => !physImmune(e, actor));
  const reach = hittable.length ? hittable : all;
  const last = G._lastTargetUid != null ? reach.find((e) => e.uid === G._lastTargetUid) : null;
  return last || reach[0];
}
// 攻撃を1タップで確定する (対象を選ばせない)
function attackNow(target) {
  const b = G.battle;
  if (!b || b.phase !== "input" || G.animating) return;
  const tgt = target || defaultAttackTarget(b.current);
  if (!tgt) return;
  const r = b.chooseAction("attack");
  if (r && r.invalid) { renderCombatMenu(); return; }
  SFX.select(); buzz(10);
  G._lastTargetUid = tgt.uid;
  b.chooseTarget(tgt);
  runCommitted();
}
// この人業が最後に使ったスキル (端末に覚える)。いま使える技でなければ null
function lastSkillOf(actor) {
  if (!actor || !actor.spells || !actor.spells.length) return null;
  const k = uiDungeonHud.remember("lastSkill", String(actor.uid));
  return k && battleSkills(actor).includes(k) && SPELLS[k] ? k : null; // 戦闘で出さない (オフの) 技は出さない
}
// 攻撃の右に常に出す早出しの技: 最後に使った技 (戦闘をまたいで人業ごとに覚える)。
// まだ使っていなければ、戦闘に出す技の先頭 (隊の「能力」で並べた順)
function quickSkillOf(actor) {
  const k = lastSkillOf(actor);
  if (k) return k;
  const list = actor ? battleSkills(actor).filter((s) => SPELLS[s]) : [];
  return list[0] || null;
}
function skillLocked(actor, key) {
  const sp = SPELLS[key];
  if (!sp) return true;
  if (actor.mp < spellCost(actor, sp)) return true;
  return sp.target === "ally" && G.battle._allyTargets(sp).length === 0;
}

function renderCombatMenu() {
  const b = G.battle;
  // オート中はバナーを作り直さず札だけ差し替える (renderAutoBanner)。解除ボタンへのタップを取りこぼさない
  if (!(G.autoCombat && (G.animating || b.phase === "input"))) {
    combatMenu.innerHTML = "";
    combatMenu.dataset.mode = "";
  }
  if (G.animating) { if (G.autoCombat) renderAutoBanner(); return; } // アニメーション中は解除のみ可
  if (b.phase === "input") {
    const actor = b.current;
    highlightActor(actor);
    // オート戦闘: 全員が手近な敵を通常攻撃し続ける (周回用)。解除ボタンか画面タップで解除
    if (G.autoCombat) {
      renderAutoBanner(actor);
      if (!G._autoTimer) {
        G._autoTimer = setTimeout(function autoTick() {
          if (combatHeld()) { G._autoTimer = setTimeout(autoTick, 150); return; } // 手帳などを開いている間は待つ
          G._autoTimer = null;
          const b2 = G.battle;
          if (!b2 || b2.phase !== "input" || !G.autoCombat || G.animating) return;
          // 射程内が物理無効の敵ばかりなら、殴り続けても終わらないのでオートを止めて手動に戻す
          const reach = b2.attackableEnemies(b2.current).filter((e) => e.alive);
          if (reach.length && reach.every((e) => physImmune(e, b2.current))) {
            stopAutoCombat();
            showToast(b2.current && b2.current.wMagic ? "攻撃が効かない敵がいる — 術で戦おう" : "物理が効かない敵がいる — 術で戦おう", { tone: "bad" });
            return;
          }
          b2.chooseAction("attack");
          const opts = b2.targetOptions();
          // 魅了した敵は殴ると正気に戻りやすいので後回し (仲間を襲わせておく)
          const cur = b2.current;
          const tgt = opts.find((e) => !physImmune(e, cur) && e.mind !== "charm") || opts.find((e) => !physImmune(e, cur)) || opts[0];
          if (!tgt) { b2.cancelTarget(); return; }
          b2.chooseTarget(tgt);
          runCommitted();
        }, 200 * spdMul());
      }
      return;
    }
    combatMenu.dataset.mode = "input";
    const rowTag = b.isBackRow(actor) ? "後衛" : "前衛";
    combatMenu.appendChild(turnPlate(actor.name, "の手番", [rowTag, "射程 " + RANGE_LABEL[b.attackRange(actor)]]));
    // 主の段: 攻撃 (狙いを添えて1タップで確定) ・ 最後に使った技 (未使用なら先頭の技) ・ スキル一覧
    const tgt = defaultAttackTarget(actor);
    const quick = quickSkillOf(actor);
    const main = el("div", "cmd-main" + (quick ? " has-quick" : ""));
    main.appendChild(cmdBtn("attack", "攻撃", tgt ? `→ ${enemyLabel(tgt)}` : "敵をタップでも", () => attackNow(), "primary"));
    if (quick) {
      const sp = SPELLS[quick];
      const locked = skillLocked(actor, quick);
      const qb = cmdBtn("quick", sp.name, `MP ${spellCost(actor, sp)}`, () => { if (locked) { SFX.ng(); showToast(actor.mp < spellCost(actor, sp) ? "MPが足りない" : "効果のある対象がいない", { tone: "info" }); return; } act("spell", quick); }, "cmd-quick" + (locked ? " locked" : ""));
      qb.style.setProperty("--sp-col", SPELL_KIND_COLOR[sp.kind] || "#c9a24a");
      const qs = qb.querySelector(".cmd-s"), qt = tagRow(spellTagKinds(sp, actor), "sp-tags");
      if (qs && qt) qs.appendChild(qt);
      attachLongPress(qb, () => { SFX.select(); showSkillPopup(quick); });
      main.appendChild(qb);
    }
    const mpTxt = actor.maxmp > 0 ? `MP ${actor.mp}/${actor.maxmp}` : "技なし";
    if (battleSkills(actor).length) main.appendChild(cmdBtn("skill", "スキル", mpTxt, () => showSpells(actor)));
    else if (actor.spells.length) main.appendChild(cmdBtn("skill", "スキル", "すべてオフ", () => showToast("技はすべて非表示 ― 隊の「能力」で表示を戻せる", { tone: "info" }), "muted"));
    else main.appendChild(cmdBtn("skill", "スキル", "使えない", () => log("スキルを使えない", "sys"), "muted"));
    combatMenu.appendChild(main);
    const sub = el("div", "cmd-sub");
    sub.appendChild(cmdBtn("defend", "防御", "", () => act("defend")));
    // 逃走: 手番の者の AGI で決まる成功率を添える (退路を断たれていれば「不可」)
    sub.appendChild(cmdBtn("run", "逃走", b.noFlee ? "不可" : `${Math.round(b.fleeChance(actor) * 100)}%`, () => act("run")));
    sub.appendChild(cmdBtn("auto", "オート", uiDungeonHud.getPref("autoKeep") ? "継続" : "", () => { G.autoCombat = true; SFX.select(); renderCombatMenu(); }));
    sub.appendChild(cmdBtn("fast", "倍速", G.fastAnim ? "ON" : "OFF", () => { G.fastAnim = !G.fastAnim; autosave(); renderCombatMenu(); }, G.fastAnim ? "on" : ""));
    combatMenu.appendChild(sub);
  } else if (b.phase === "target") {
    combatMenu.dataset.mode = "target";
    const p = b.pending;
    const sp = p && p.spellKey ? SPELLS[p.spellKey] : null;
    combatMenu.appendChild(turnPlate(sp ? sp.name : "対象を選択", sp ? "の対象" : "", [sp && sp.target === "ally" ? "パーティの札をタップでも可" : "敵を直接タップでも可"]));
    const opts = b.targetOptions();
    // 対象が多い時 (敵の群れなど) は2列に並べて縦に伸びすぎないようにする
    const list = el("div", "target-list" + (opts.length > 3 ? " cols2" : ""));
    for (const t of opts) {
      const tb = btn("", () => { if (t.side === "enemy") G._lastTargetUid = t.uid; b.chooseTarget(t); runCommitted(); });
      tb.className = "btn tgt " + (t.side === "enemy" ? "tgt-enemy" : "tgt-ally") + (t.alive ? "" : " tgt-down");
      // 敵の名前・HP は討伐数で明かす (名前は1体、HP は5体倒すまで伏せる)
      const isEn = t.side === "enemy";
      const showHp = !isEn || enemyReveal(t).stats;
      const nm = el("span", "tgt-n", (isEn && b.isBackRow(t) ? "【後】" : "") + (isEn ? enemyLabel(t) : t.name) + (!isEn && !t.alive ? " [気絶]" : ""));
      tb.appendChild(nm);
      const bar = el("span", "tgt-bar");
      const fill = el("i");
      fill.style.width = (showHp ? Math.max(0, Math.min(100, (t.hp / (t.maxhp || 1)) * 100)) : 0) + "%";
      bar.appendChild(fill);
      if (!showHp) bar.style.visibility = "hidden";
      tb.appendChild(bar);
      tb.appendChild(el("span", "tgt-hp", !showHp ? "HP ？" : isEn ? `HP ${t.hp}` : `HP ${t.hp}/${t.maxhp}`));
      list.appendChild(tb);
    }
    combatMenu.appendChild(list);
    combatMenu.appendChild(cmdBtn("back", "戻る", "", () => { b.cancelTarget(); renderCombatMenu(); }, "cmd-wide cmd-backb"));
  }
}

function showSpells(actor) {
  combatMenu.innerHTML = "";
  combatMenu.dataset.mode = "spells";
  combatMenu.appendChild(turnPlate(actor.name, "のスキル", [`MP ${actor.mp}`, "長押しで詳細"]));
  // 並べた順に、オフにした技を除いて出す (隊の「能力」画面で整理)。
  // 呪文が多い職は2列に並べて縦に伸びすぎないようにする
  const skills = battleSkills(actor);
  const list = el("div", "target-list" + (skills.length > 4 ? " cols2" : ""));
  const quick = lastSkillOf(actor);
  for (const key of skills) {
    const sp = SPELLS[key];
    const cost = spellCost(actor, sp); // 省詠唱 (chant) 持ちは消費が軽い
    // 使えない技も長押しで詳細を見られるよう、native disabled ではなく soft-lock にする
    // (disabled だと pointer イベントが飛ばず長押しを拾えない)
    const locked = skillLocked(actor, key);
    const b = btn("", () => { if (locked) { SFX.ng(); return; } act("spell", key); });
    b.className = "btn spell spell-" + (sp.kind || "atk") + (key === quick ? " last" : "");
    const top = el("span", "sp-top");
    top.appendChild(el("span", "sp-n", sp.name));
    const tg = tagRow(spellTagKinds(sp, actor), "sp-tags");
    if (tg) top.appendChild(tg);
    top.appendChild(el("span", "sp-mp", `MP${cost}`));
    b.appendChild(top);
    b.appendChild(el("span", "sp-d", sp.desc));
    b.style.setProperty("--sp-col", SPELL_KIND_COLOR[sp.kind] || "#c9a24a");
    if (locked) b.classList.add("locked");
    // 長押しでスキル詳細を表示 (MP不足などで押せない技でも内容は確認できる)
    attachLongPress(b, () => { SFX.select(); showSkillPopup(key); });
    list.appendChild(b);
  }
  combatMenu.appendChild(list);
  combatMenu.appendChild(cmdBtn("back", "戻る", "", () => renderCombatMenu(), "cmd-wide cmd-backb"));
}
// ---- 戦闘ループ駆動 (1手ずつ・演出付き) ----
// 戦闘テンポ (演出時間の倍率): 倍速 ON = 標準 (1) / OFF = その 1/2 の速さ (2)。オート中は倍速の設定によらず短縮する
function spdMul() { return G.autoCombat ? 0.45 : G.fastAnim ? 1 : 2; }
// 戦闘の一時停止: 戦闘中にシート (手帳・設定・覗き見など) が開いている間は次の一手へ進まない。
// いま演じている一手は最後まで見せ、その次の手番で閉じるのを待つ
function combatHeld() { return G.state === "combat" && (sheetDepth() > 0 || !!G.settingsOpen || !!G.statusOpen); }
function whenCombatFree(fn) {
  if (combatHeld()) { setTimeout(() => whenCombatFree(fn), 150); return; }
  fn();
}

function combatStep() {
  const b = G.battle;
  if (!b) return;
  if (combatHeld()) { setTimeout(combatStep, 150); return; }
  if (b.result) { endBattle(); return; }
  if (b.phase === "input") { G.animating = false; renderCombat(); return; }
  if (b.phase === "stunned") {
    // 行動不能の味方 (睡眠/麻痺/石化) の手番を自動消化
    G.animating = true;
    if (G.autoCombat) renderAutoBanner(); else renderActingPlate(b.current);
    renderCombatCanvas();
    autosave(true);
    setTimeout(() => {
      const res = b.stunnedAct();
      animateResult(res, postResolve);
    }, 200 * spdMul());
    return;
  }
  if (b.phase === "enemy") {
    G.animating = true;
    if (G.autoCombat) renderAutoBanner(); else renderActingPlate(b.current);
    renderCombatCanvas();
    autosave(true); // 敵の手番を確定 (やり直し不可)
    // 一瞬の間を置いてから敵が動く (ドラクエ風)
    setTimeout(() => {
      const res = b.enemyAct();
      animateResult(res, postResolve);
    }, 260 * spdMul());
  }
}

// 味方コマンド選択
function act(action, spellKey) {
  const b = G.battle;
  const actor = b.current;
  const r = b.chooseAction(action, spellKey);
  if (r && r.invalid) { renderCombatMenu(); return; }
  // 最後に使った技を人業ごとに覚える (次の手番の早出しボタン)
  if (action === "spell" && spellKey && actor && actor.uid != null) uiDungeonHud.remember("lastSkill", String(actor.uid), spellKey);
  if (b.phase === "target") {
    // 対象が1つしかなければ選ばせない (§3.4)
    const opts = b.targetOptions();
    if (opts.length === 1) {
      if (opts[0].side === "enemy") G._lastTargetUid = opts[0].uid;
      b.chooseTarget(opts[0]);
      runCommitted();
      return;
    }
    autosave(); renderCombatMenu(); return;
  }
  runCommitted();
}

// 予約済みの味方行動を実行 → 演出 → 次の手番
function runCommitted() {
  autosave(true); // 行動確定の瞬間に保存。以降この選択はやり直せない
  G.animating = true;
  if (G.autoCombat) renderAutoBanner(); else renderActingPlate((G.battle.pending && G.battle.pending.actor) || G.battle.current);
  const res = G.battle.commit();
  animateResult(res, postResolve);
}

// 行動の結果を演出し、終わったら次へ
function postResolve() {
  const b = G.battle;
  // ボスの発狂を派手に知らせる
  if (b._enrageFx) {
    b._enrageFx = false;
    shakeScreen(true); buzz([0, 60, 50, 60]);
    showToast("⚠ 敵が怒り狂っている！");
  }
  if (b.result) { G.animating = false; setTimeout(() => whenCombatFree(endBattle), 300); return; }
  b.advance();
  autosave(true);
  setTimeout(combatStep, 150 * spdMul());
}

// 多段ヒットの時間差 (ms。spdMul で速度モードに追従)。applyImpact と共有
const HIT_STAGGER = 165;

// 結果オブジェクトを演出 (踏み込み → 着弾 → 余韻)
function animateResult(res, done) {
  if (G.battle && G.battle.tl) tlHits(G.battle.tl, res); // テスト記録: 与ダメ/被ダメ
  const t0 = performance.now();
  const WIND = (res.side === "enemy" ? 170 : 90) * spdMul();
  // 同一対象への最大ヒット数を数え、多段なら余韻を延ばして全ヒットを見せきる
  const stack = {};
  let maxStack = 1;
  for (const h of (res.hits || [])) {
    if (h.miss || !h.target) continue;
    const id = h.target.uid != null ? h.target.uid : h.target;
    stack[id] = (stack[id] || 0) + 1;
    if (stack[id] > maxStack) maxStack = stack[id];
  }
  // 全体回復は対象人数ぶん時間差で弾ませるため、最後の表示まで尺を確保する
  const partyHealN = (res.hits || []).filter((h) => h && h.target && h.target.side !== "enemy" && h.heal != null).length;
  const staggerSteps = Math.max(maxStack - 1, partyHealN - 1);
  const TOTAL = WIND + (360 + staggerSteps * HIT_STAGGER) * spdMul();
  G.fx = { lunge: res.side === "enemy" ? { uid: res.actor.uid, p: 0 } : null,
           slashes: [], magic: [], floats: [], screen: null, flash: {}, deaths: [] };
  G.partyFx = G.partyFx || new Map();
  let impacted = false;
  const tick = () => {
    const t = performance.now() - t0;
    if (G.fx.lunge) G.fx.lunge.p = Math.sin(Math.min(1, t / WIND) * Math.PI);
    if (!impacted && t >= WIND) {
      impacted = true;
      applyImpact(res);
      renderParty(); // HP反映 + 被弾フラッシュ
    }
    renderCombatCanvas();
    if (t >= TOTAL) {
      G.fx = null;
      G.partyFx.clear();
      renderCombat();
      done();
    } else {
      requestAnimationFrame(tick);
    }
  };
  requestAnimationFrame(tick);
}

function magicColor(res) {
  if (res.spellElement === "fire") return "#ff8a3c"; // 炎系
  if (res.spellKind === "sleep") return "#9ad1ff";
  return "#b06bff";
}

// 着弾の瞬間: 効果音・エフェクト生成・ダメージ表示
function applyImpact(res) {
  const fx = G.fx;
  const now = performance.now();
  if (res.action === "defend") { SFX.select(); return; }
  if (res.action === "sleep" || res.action === "run" || res.action === "stunned") { SFX.miss(); return; }

  // 効果音 + 振動
  if (res.action === "breath") {
    SFX.fire(); buzz([0, 50, 40, 80]); shakeScreen(true);
  } else if (res.action === "spell" && res.spellKind !== "phys") {
    if (res.spellKind === "heal" || res.spellKind === "cure" || res.spellKind === "buff") SFX.heal();
    else if (res.spellElement === "fire") SFX.fire();
    else SFX.spell();
    buzz(20);
  } else {
    const anyHit = res.hits.some((h) => !h.miss);
    if (!anyHit) {
      // 回避された場合は風切り音、それ以外は通常の空振り
      if (res.hits.some((h) => h.evaded)) SFX.evade();
      else SFX.miss();
    }
    else if (res.hits.some((h) => h.crit)) { SFX.crit(); buzz([0, 30, 40, 60]); shakeScreen(true); }
    else { SFX.hit(); buzz(25); }
  }

  let partyHit = false, anyDeath = false;
  // 多段ヒット (二段斬り等) は同じ対象・同座標に重なって1回に見えてしまうため、
  // 対象ごとにヒット順で時間差(stagger)と位置差(横ずらし)を付けて、回数分はっきり見せる
  const stag = HIT_STAGGER * spdMul();
  const stackIdx = {};
  // 全体回復は対象全員が同じ中央下に重なって1人分にしか見えないため、
  // 回復対象ごとに横位置をずらし、わずかな時間差を付けて全員ぶんはっきり見せる
  const partyHeals = res.hits.filter((h) => h.target.side !== "enemy" && h.heal != null);
  let partyHealIdx = 0;
  // 味方への強化/弱体フロートも複数人ぶん横に散らす
  const partyModHits = res.hits.filter((h) => h.target.side !== "enemy" && (h.buff || h.debuff));
  let partyModIdx = 0;
  for (const h of res.hits) {
    if (h.target.side === "enemy") {
      const pos = G.enemyPos[h.target.uid];
      if (!pos || h.miss) continue;
      const idx = (stackIdx[h.target.uid] = (stackIdx[h.target.uid] || 0) + 1) - 1; // 0,1,2…
      const ht0 = now + idx * stag;
      const dx = idx === 0 ? 0 : (idx % 2 ? 1 : -1) * (14 + 4 * idx); // 左右に振って重なり回避
      if (idx > 0) setTimeout(() => SFX.hit(), idx * stag); // 2撃目以降にも手応えの効果音
      if (res.action === "spell" && res.spellKind !== "heal" && res.spellKind !== "phys") {
        fx.magic.push({ x: pos.cx, y: pos.cy, t0: ht0, color: magicColor(res) });
      } else if (res.action === "attack" || res.spellKind === "phys") {
        fx.slashes.push({ x: pos.cx + dx * 0.5, y: pos.cy, t0: ht0, crit: !!h.crit, big: !!h.crit, flip: idx % 2 === 1, seed: (h.target.uid || 1) * 31 + idx });
      }
      if (idx === 0 || !fx.flash[h.target.uid]) fx.flash[h.target.uid] = { t0: ht0 };
      if (h.stole != null) {
        // 盗む: 奪った金額を浮かべる
        fx.floats.push({ x: pos.cx + dx, y: pos.cy - 34, text: `💰+${h.stole}`, color: "#ffd84a", t0: ht0, kind: "label" });
      } else if (h.fatal) {
        fx.floats.push({ x: pos.cx + dx, y: pos.cy - 10, text: "即死!", color: "#ff2a2a", t0: ht0, big: true, kind: "crit" });
      } else if (h.immune) {
        // 耐性3 (物理無効/魔法無効) に弾かれた: 数字の代わりに「無効」と浮かべる
        fx.floats.push({ x: pos.cx + dx, y: pos.cy - 10, text: "無効", color: "#9aa3b5", t0: ht0, kind: "dmg" });
      } else if (h.dmg != null) {
        fx.floats.push({ x: pos.cx + dx, y: pos.cy - 10, text: String(h.dmg), color: h.crit ? "#ffd84a" : "#fff", t0: ht0, big: !!h.crit, kind: h.crit ? "crit" : "dmg" });
        if (h.crit) fx.floats.push({ x: pos.cx + dx, y: pos.cy - 40, text: "会心の一撃", color: "#ffb02e", t0: ht0, small: true, kind: "label" });
      }
      else if (h.heal != null) fx.floats.push({ x: pos.cx + dx, y: pos.cy - 10, text: "+" + h.heal, color: "#7CFC7C", t0: ht0, kind: "heal" }); // 敵の回復役による回復
      // 敵にかかった強化/弱体も発動フロートで知らせる (ピル表示に加えて瞬間を可視化)
      if ((h.buff || h.debuff) && !(h.status && !Object.keys(h.mods || {}).length)) { const mt = buffFloatText(h); fx.floats.push({ x: pos.cx + dx, y: pos.cy - 34, text: mt.text, color: mt.color, t0: ht0, kind: "buff" }); }
      // 状態異常の付与 (麻痺・眠り・魅了・混乱…): 名札の上に浮かべて知らせる
      if (h.status) fx.floats.push({ x: pos.cx + dx, y: pos.cy - (h.buff || h.debuff ? 52 : 34), text: h.status, color: "#ff9ad0", t0: ht0 + 60, small: true, kind: "label" });
      if (h.died) {
        anyDeath = true;
        // 撃破: 魔物が白く焼けて灰に崩れる (描画は drawEffects)
        if (!fx.deaths.some((d) => d.uid === h.target.uid)) fx.deaths.push({ uid: h.target.uid, mon: h.target.mon, x: pos.cx, y: pos.cy, size: pos.size || 9, t0: ht0 });
      }
    } else {
      // 味方が対象
      if (h.buff || h.debuff) {
        // 強化/弱体が味方にかかった: 緑(▲)/赤(▼)のフロートで発動を知らせる (敵のピル表示と同様に可視化)
        const mt = buffFloatText(h);
        G.partyFx.set(h.target, h.buff ? "heal" : "hit");
        const n = partyModHits.length, mi = partyModIdx++;
        const fx0 = n > 1 ? VW * (mi + 1) / (n + 1) : VW / 2;
        const fy0 = VH - 26 - (mi % 2) * 16;
        fx.floats.push({ x: fx0, y: fy0, text: mt.text, color: mt.color, t0: now + mi * stag, kind: "buff" });
      } else if (h.cured != null) {
        // 状態異常・弱体の治癒も知らせる
        if (h.cured) {
          G.partyFx.set(h.target, "heal");
          fx.floats.push({ x: VW / 2, y: VH - 26, text: "治癒✚", color: "#9be8ff", t0: now });
        }
      } else if (h.mpHeal != null) {
        // 魔力の譲渡
        G.partyFx.set(h.target, "heal");
        fx.floats.push({ x: VW / 2, y: VH - 26, text: "MP+" + h.mpHeal, color: "#7fb8ff", t0: now, kind: "heal" });
      } else if (h.heal != null) {
        G.partyFx.set(h.target, "heal");
        // 複数人を回復する時は横に散らし、順に弾ませて全員の回復を見せる
        const n = partyHeals.length;
        const i = partyHealIdx++;
        const fx0 = n > 1 ? VW * (i + 1) / (n + 1) : VW / 2;
        const fy0 = VH - 26 - (i % 2) * 16; // 重なり回避に上下も少しずらす
        fx.floats.push({ x: fx0, y: fy0, text: "+" + h.heal, color: "#7CFC7C", t0: now + i * stag, kind: "heal" });
      } else if (h.steal) {
        // 窃盗: ゴールド/Soul の控除はここで行う (combat.js は G を知らない)
        partyHit = true;
        G.partyFx.set(h.target, "hit");
        if (h.steal === "goldSteal") {
          const s = Math.min(G.gold, h.stealAmt || 0);
          G.gold -= s;
          if (G.run) G.run.gold = Math.max(0, G.run.gold - s);
          log(`${h.target.name}は ${s} ゴールドを奪われた！`, "dmg");
          fx.floats.push({ x: VW / 2, y: VH - 26, text: `-💰${s}`, color: "#ffd84a", t0: now });
        } else {
          const s = Math.min(G.soulPts, h.stealAmt || 0);
          G.soulPts -= s;
          if (G.run) G.run.soulPts = Math.max(0, G.run.soulPts - s);
          log(`${h.target.name}は ✦${s} Soul を吸い取られた！`, "dmg");
          fx.floats.push({ x: VW / 2, y: VH - 26, text: `-✦${s}`, color: "#b06bff", t0: now });
        }
        updateTopbar();
      } else if (h.stoned) {
        partyHit = true;
        G.partyFx.set(h.target, "hit");
        fx.floats.push({ x: VW / 2, y: VH - 26, text: "石化!", color: "#c9c4b8", t0: now });
      } else if (h.status && h.dmg == null) {
        // 眠り・魅了・混乱をかけられた (ダメージなし)
        partyHit = true;
        G.partyFx.set(h.target, "hit");
        const n = res.hits.filter((x) => x.status && x.dmg == null).length, i = res.hits.filter((x) => x.status && x.dmg == null).indexOf(h);
        fx.floats.push({ x: n > 1 ? VW * (i + 1) / (n + 1) : VW / 2, y: VH - 26 - (i % 2) * 16, text: h.status, color: "#ff9ad0", t0: now + i * stag });
      } else if (!h.miss) {
        partyHit = true;
        G.partyFx.set(h.target, "hit");
        fx.floats.push({ x: VW / 2, y: VH - 26, text: String(h.dmg) + (h.fatal ? " 即死!" : ""), color: h.fatal ? "#ff2a2a" : "#ff6b6b", t0: now, kind: "pdmg" });
        if (h.died) anyDeath = true;
        // レベルドレイン: 宿しているメイン魂のレベルを永続的に1下げる
        if (h.drain && h.target.isDoll && h.target.primary != null) {
          const s = soulByUid(h.target.primary);
          if (s && s.level > 1) {
            s.level--;
            recalcAllDolls();
            const lbl = SOUL_CLASSES[s.clsKey].label;
            log(`${h.target.name}の${lbl}の魂が喰われ、Lv${s.level} に堕ちた…！`, "dmg");
            setTimeout(() => showToast(`☠ レベルドレイン: ${lbl}の魂 Lv-1`), 300);
          }
        }
      }
    }
  }
  if (partyHit) { fx.screen = { color: "#d4504e", t0: now }; buzz([0, 50, 50, 50]); shakeScreen(true); }
  if (anyDeath) setTimeout(() => SFX.die(), 200);
}

// 戦闘勝利時: 入手Soulの1/3を、生存しているパーティメンバーが宿す魂 (メイン魂・サブ魂は半分) に
// 経験値(soul.exp)として加算する。限界(soulTrainCost)に達した魂は自動でレベルアップし、
// キャラLv上昇/スキル習得を検出してポップアップ用のキューを返す。
function distributeBattleSoulExp(soulGot) {
  const queue = [];
  // 控えの結社 魂の薫陶 (soulTutor): 戦闘後に魂へ入るEXPを底上げ
  const stLv = partyPassiveLv("soulTutor");
  const stMul = stLv >= 3 ? 1.35 : stLv >= 2 ? 1.20 : stLv >= 1 ? 1.10 : 1;
  const share = Math.floor((soulGot || 0) * stMul / 3);
  if (share <= 0) return queue;
  // 経験値は「編成中に宿している魂」(メイン魂・サブ魂とも) ごとに1回ずつ入る。
  // 同じ魂を複数人が宿すことはない (魂は1体ごとに個別) ので重複加算は起きない。
  // サブ魂が得る経験値はメイン魂の 1/2。どこかでメイン魂として宿していれば全量扱いにする。
  const worn = []; // {uid, sub}
  const seen = new Set();
  // まずメイン魂 (全量) を集める
  for (const m of G.party) {
    if (!m || !m.alive) continue;
    if (m.primary != null && !seen.has(m.primary)) { seen.add(m.primary); worn.push({ uid: m.primary, sub: false }); }
  }
  // 次にサブ魂 (1/2)。メイン魂として既に集めた魂は除く
  for (const m of G.party) {
    if (!m || !m.alive) continue;
    for (const s of (m.subs || [])) if (s && s.uid != null && !seen.has(s.uid)) { seen.add(s.uid); worn.push({ uid: s.uid, sub: true }); }
  }
  // レベルアップ前の各メンバーのステータス・スキル・メイン魂Lvを記録 (上昇量の算出用)
  const STAT_KEYS = ["maxhp", "maxmp", "atk", "vit", "agi", "int", "pie", "luk"];
  const snap = (m) => { const o = {}; for (const k of STAT_KEYS) o[k] = m[k] || 0; return o; };
  const preStat = new Map(), preLv = new Map(), preSpells = new Map();
  const preSubLv = new Map(); // サブ魂 uid → 加算前の Lv (サブ魂のレベルアップもお知らせに出す)
  for (const m of G.party) {
    if (!m || !m.alive) continue;
    preStat.set(m, snap(m));
    preSpells.set(m, new Set(m.spells || []));
    const ps = m.primary != null ? soulByUid(m.primary) : null;
    preLv.set(m, ps ? ps.level : 0);
  }
  for (const w of worn) if (w.sub) { const e = soulByUid(w.uid); if (e) preSubLv.set(w.uid, e.level); }
  // 宿している魂すべてに Soul を加算してレベルアップ (上限超過分は exp に蓄積)。
  // サブ魂はメイン魂の半分 (share の 1/2) を得る。
  for (const w of worn) {
    const e = soulByUid(w.uid);
    if (!e) continue;
    const gain = w.sub ? Math.floor(share / 2) : share;
    if (gain <= 0) continue;
    const cap = soulLevelCapOf(e);
    e.exp = (e.exp || 0) + gain;
    while (e.level < cap && e.exp >= soulTrainCost(e.level)) { e.exp -= soulTrainCost(e.level); e.level++; }
  }
  recalcAllDolls({ levelUp: true });
  // メンバーごとに「レベルアップ(上昇ステータス付き)→新規スキル」をポップアップ用キューへ
  const STAT_LABEL = { maxhp: "HP", maxmp: "MP", atk: "ATK", vit: "VIT", agi: "AGI", int: "INT", pie: "PIE", luk: "LUK" };
  for (const m of G.party) {
    if (!m || !m.alive) continue;
    const ps = m.primary != null ? soulByUid(m.primary) : null;
    const newLv = ps ? ps.level : 0;
    const oldLv = preLv.get(m) || 0;
    const before = preStat.get(m) || {};
    const deltas = [];
    for (const k of STAT_KEYS) { const d = (m[k] || 0) - (before[k] || 0); if (d > 0) deltas.push(`${STAT_LABEL[k]} +${d}`); }
    // 伸びた能力はその人の最初の行 (メイン魂 → なければ最初のサブ魂) にまとめて載せる
    let shown = false;
    if (newLv > oldLv) {
      queue.push({ kind: "level", member: m, fromLv: oldLv, toLv: newLv, deltas });
      shown = true;
      runLevel(m, oldLv, newLv); // 今回の記録 (帰還の報告)
    }
    // サブ魂のレベルアップ (どの職の魂かを添えて、サブ魂だとわかるようにする)
    for (const sub of (m.subs || [])) {
      if (!sub || sub.uid == null || !preSubLv.has(sub.uid)) continue;
      const e = soulByUid(sub.uid);
      const from = preSubLv.get(sub.uid);
      if (!e || e.level <= from) continue;
      const cls = SOUL_CLASSES[e.clsKey];
      queue.push({ kind: "level", member: m, fromLv: from, toLv: e.level, deltas: shown ? [] : deltas, sub: true, soulLabel: cls ? cls.label : e.clsKey });
      shown = true;
    }
    const oldSp = preSpells.get(m) || new Set();
    for (const sk of (m.spells || [])) if (!oldSp.has(sk)) queue.push({ kind: "skill", member: m, skill: sk });
  }
  return queue;
}

function endBattle() {
  const b = G.battle;
  if (b.tl) tlBattleEnd(b.tl, { result: b.result, rounds: b._roundNo, tally: b.tally, party: G.party });
  // オートは戦闘ごとに解除。ただし設定「オートを次の戦闘も続ける」(§7 M2) なら勝利の後も持ち越す
  if (!(b.result === "win" && G.autoCombat && uiDungeonHud.getPref("autoKeep"))) G.autoCombat = false;
  if (G._autoTimer) { clearTimeout(G._autoTimer); G._autoTimer = null; }
  renderCombat();
  if (b.result === "win") {
    // 死体戦 (まだあたたかい/偉大なる死体が起き上がった戦闘): 宝箱なし・魂を100%回収する
    const corpse = (G.battleCell && G.battleCell._corpseRise)
      ? { clsKey: G.battleCell.corpseClass || "fighter", great: !!G.battleCell.corpseGreat }
      : null;
    // 倒した敵から Soul(魂) を回収する。Soul が経験値の役割を兼ね、館での魂の強化に使う
    // 金運 (goldLuck) / 魂寄せ (soulLure) は戦闘報酬を底上げする (隊内最高Lvのみ)
    const { soul, gold } = b.rewards();
    const gl = partyPassiveLv("goldLuck"), sl = partyPassiveLv("soulLure");
    const goldGot = runGainGold(Math.round(gold * 2 * (gl >= 3 ? 1.50 : gl >= 2 ? 1.30 : gl === 1 ? 1.15 : 1))) + takeStolenGold(b);
    const soulGot = runGainSoulPts(Math.round(soul * (sl >= 3 ? 1.35 : sl >= 2 ? 1.20 : sl === 1 ? 1.10 : 1)));
    applyVictoryPassives();
    // 入手Soulの1/3を生存メンバーの魂 (サブ魂は半分) に加算 → レベルアップ/スキル習得を集計
    const progress = distributeBattleSoulExp(soulGot);
    updateTopbar();
    log(`勝利！ ${goldGot} ゴールド と ✦${soulGot} Soul を得た。`, "win");
    SFX.victory();
    // 討伐クエストの進捗 + 戦績 + 図鑑記録 (倒した敵を集計)。
    // 戦利品はここでは抽選のみ。実物は勝利後の宝箱から取り出す
    let kills = 0;
    for (const e of b.enemies) {
      if (e.alive) continue;
      kills++;
      questProgress("kill", e.key);
      G.stats.kills++;
      if (e.element && e.element !== "none") G.stats.elemKills[e.element] = true; // 戦績: 撃破した属性 (勲章用)
      if (e.isMimic) G.stats.mimics++;                       // 戦績: ミミック撃破数
      if (e.isMasterMimic) G.stats.masterMimicSlain = true;  // 戦績: マスターミミック討伐 (一度きり)
      codexKillNow(e); // 図鑑は倒したその瞬間に記録済み (取りこぼしの保険。二重には数えない)
    }
    runCount("kills", kills);
    // 層ボスを1ラウンドで討ち取ったか (勲章: 電光石火)
    if (b._roundNo <= 1 && b.enemies.some((e) => !e.alive && e.boss)) G.stats.swiftBoss = true;
    // 戦利品は勝利ごとに1品まで汎用抽選 (固有ドロップ廃止)。宝箱は1つだけ現れる
    let drop = rollGenericDrop();
    // 強敵討伐ボーナス: 高ランクアイテムの確定ドロップ
    const wasElite = b.enemies.some((e) => !e.alive && e.mon && e.mon.elite);
    if (wasElite) {
      const eid = pickLoot({ elite: true }); // 適正帯より2ランク上のアイテム
      if (ITEMS[eid]) drop = { key: "elite", name: "強敵", id: eid, item: cloneItem(eid), rare: true };
    }
    // 奈落の門番: boss フラグを持つが踏破=帰還ではない。撃破で適正帯より上等な戦利品を残す
    const wasGuard = abyssActive() && !corpse && b.enemies.some((e) => e.boss);
    if (wasGuard) {
      const gid = pickLoot({ elite: true });
      if (ITEMS[gid]) drop = { key: "guard", name: "門番", id: gid, item: cloneItem(gid), rare: true };
    }
    // soulClass を持つ敵 (人型・騎士など) はまれに魂を落とす (レアドロップ)。
    // 落とした魂はこの場で所持魂に加え (保存に乗せる)、戦果シートの一行で知らせる。レア以上はシートの後に祝う
    const souls = [];
    for (const e of b.enemies) {
      const sc = e.alive ? null : (e.mon && e.mon.soulClass) || (MONSTERS[e.key] && MONSTERS[e.key].soulClass);
      if (!sc) continue;
      const soulChance = wasElite ? 0.40 : 0.08; // 強敵は魂ドロップ率が大幅上昇
      if (Math.random() < soulChance) {
        const clsKey = rollJobClass();
        log(`${e.name}が ${SOUL_CLASSES[clsKey].label}の魂 を落とした！`, "win");
        souls.push(grantSoulQuiet(clsKey, `${e.name}が落とした魂だ。`));
      }
    }
    // 死体戦は宝箱を出さず、死体に残っていた魂を100%回収する (残火も同時に)
    if (corpse) {
      souls.push(grantSoulQuiet(corpse.clsKey, corpse.great ? "偉大なる魂を回収した。" : "死体に残っていた魂を回収した。", emberReward(corpse.great)));
    }
    // 奈落の門番: 撃破を記録して先へ進めるようにする
    if (wasGuard) {
      G.abyss.guardFloor = G.floor; // この階の門番は撃破済み → 階段で潜れる
      flashScreen("#d4504e"); buzz([0, 60, 50, 60, 50, 250]);
    }
    // 迷宮踏破は本物の主戦のみ。死体から湧いた個体 (corpse)・奈落の門番は踏破扱いにしない
    const wasBoss = !corpse && !abyssActive() && b.enemies.some((e) => e.boss);
    if (wasBoss) { flashScreen("#ffd84a"); buzz([0, 60, 50, 60, 50, 250]); } // 主討伐は特別な瞬間
    else if (wasElite) { flashScreen("#d4504e"); buzz([0, 80, 50, 80, 50, 300]); }
    // 出来事の戦闘: マスはイベント側が片付ける (連戦・報酬の続きがある)。勝った印だけ先に残す
    const evCell = G.battleCell && G.battleCell.type === "event" ? G.battleCell : null;
    if (evCell) { if (evCell.evFight) evCell.evFight.won = true; }
    else if (G.battleCell) G.battleCell.cleared = true;
    evBattleEnd(true);
    if (wasBoss && G.events && G.events.flags && G.events.flags.bossWeak) delete G.events.flags.bossWeak[battleLayer()];
    // 主討伐の確定処理 (踏破記録・章進行 msq.state="report"・戦利品確定) は演出より先に行い、
    // 直後の finishToBoard の保存に乗せる。演出中に中断されても踏破は失われない
    const clearInfo = wasBoss ? commitDungeonClear() : null;
    finishToBoard();
    // 宝箱はドロップ品があれば必ず、なければ50%で出現。強敵・ミミックは宝箱確定。
    // ミミックが残す宝箱は中身が上質 (アイテムレベル+15)。マスターミミックは+30。死体戦は宝箱なし
    const wasMimic = b.enemies.some((e) => e.isMimic);
    const wasMasterMimic = b.enemies.some((e) => e.isMasterMimic);
    // 戦果の後に続くもの: 主討伐の踏破の祝祭 → なければ「餓えた群れ」殲滅報酬
    const after = clearInfo
      ? () => showDungeonClearedPopup(clearInfo)
      : (hordeRewardPending() ? () => grantHordeReward() : null);
    const hasChest = !corpse && !(evCell && evCell.evFight && evCell.evFight.noChest) && (drop || wasElite || wasMimic || (specialDef() || {}).sureChest || Math.random() < 0.5);
    const chest = hasChest
      ? battleChestSpec(drop ? [drop] : [], wasMasterMimic ? 30 : wasMimic ? 15 : 0, wasMimic || wasMasterMimic, after ? ["alarm"] : null)
      : null;
    // 戦果シート (§3.3): 勝利・獲得・成長・魂・宝箱を1枚にまとめる (旧: 勝利・Lv・技・宝箱・罠・中身の札が1枚ずつ)
    const levels = progress.filter((q) => q.kind === "level").map((q) => ({ name: q.member.name, uid: q.member.uid, from: q.fromLv, to: q.toLv, deltas: q.deltas || [], sub: !!q.sub, soulLabel: q.soulLabel || "" }));
    const skills = progress.filter((q) => q.kind === "skill").map((q) => ({ name: q.member.name, key: q.skill, skill: SPELLS[q.skill] ? SPELLS[q.skill].name : q.skill, desc: SPELLS[q.skill] ? SPELLS[q.skill].desc : "" }));
    uiResults.openResults({
      kind: wasBoss ? "boss" : wasElite ? "elite" : wasGuard ? "guard" : corpse ? "corpse" : "win",
      gold: goldGot, soul: soulGot, kills,
      levels, skills, souls,
      chest,
      onDone: () => {
        const fin = () => { if (after) after(); else if (G.state === "board") { renderBoard(); evProgress(); } };
        if (evCell && G.state === "board") eventFightWon(evApi, evCell, fin); else fin();
      },
    });
    return;
  } else if (b.result === "flee") {
    // 逃走: 元のマスへ戻る (カードは表のまま)。盗んだ金は持ち帰る
    SFX.flee();
    const stolen = takeStolenGold(b);
    if (stolen) { log(`盗んだ ${stolen} ゴールドを懐に逃げ延びた`, "win"); updateTopbar(); }
    evBattleEnd(false);
    if (G.prevPos) { G.px = G.prevPos.x; G.py = G.prevPos.y; }
    finishToBoard();
  } else if (b.result === "lose") {
    gameOver();
  }
}
// 戦闘勝利後の常時効果: 戦闘後回復/魔力回路/法力の灯/浄化/慈悲の祈り。
// Lv付きは最高Lvのみ。教皇の祈り (popePrayer) は持ち主の戦闘後回復を隊全体へ広げる
function applyVictoryPassives() {
  let pope = 0;
  for (const p of G.party) if (p.alive && pLv(p, "popePrayer")) pope = Math.max(pope, pLv(p, "afterHeal"));
  const HEAL_PCT = [0, 0.05, 0.10, 0.20, 0.30];
  let healed = false;
  for (const p of G.party) {
    if (!p.alive) continue;
    const bl = pLv(p, "afterBoth");
    const hpct = HEAL_PCT[Math.max(pLv(p, "afterHeal"), pope)] + (bl >= 2 ? 0.08 : bl === 1 ? 0.03 : 0);
    const ml = pLv(p, "afterMp");
    const pw = perkVictory(p, G.party); // 職ごとの固有パッシブ (win)
    const hpct2 = hpct + pw.hp;
    const mpct = (ml >= 2 ? 0.10 : ml === 1 ? 0.05 : 0) + (bl >= 2 ? 0.08 : bl === 1 ? 0.03 : 0) + pw.mp;
    if (hpct2 > 0 && p.hp < p.maxhp) { p.hp = Math.min(p.maxhp, p.hp + Math.ceil(p.maxhp * hpct2)); healed = true; }
    if (mpct > 0 && p.mp < p.maxmp) { p.mp = Math.min(p.maxmp, p.mp + Math.ceil(p.maxmp * mpct)); healed = true; }
  }
  if (healed) log("勝利の余韻がパーティを癒した。", "heal");
  // 特別階 (癒しの霊気): 戦闘勝利のたび隊全体のHP・MPが回復する
  const fh = sfNum("victoryHeal", 0);
  if (fh > 0) {
    let mist = false;
    for (const p of G.party) {
      if (!p.alive) continue;
      if (p.hp < p.maxhp) { p.hp = Math.min(p.maxhp, p.hp + Math.ceil(p.maxhp * fh)); mist = true; }
      if (p.mp < p.maxmp) { p.mp = Math.min(p.maxmp, p.mp + Math.ceil(p.maxmp * fh)); mist = true; }
    }
    if (mist) log("癒しの霊気が傷を塞ぎ、魔力を満たした。", "heal");
  }
  // 浄化 (隊全体) / 自浄 (自分): 毒・麻痺を治す (石化は対象外)
  const hasPurify = G.party.some((p) => p.alive && pLv(p, "purify"));
  let cured = false;
  for (const p of G.party) {
    if (!p.alive || (p.ailment !== "poison" && p.ailment !== "paralyze")) continue;
    if (hasPurify || pLv(p, "selfPurify")) { p.ailment = null; cured = true; }
  }
  if (cured) log("浄化の祈りが穢れを払った。", "heal");
  // 慈悲の祈り: 倒れた味方1人をHP10%で蘇生 (1探索1回)
  if (G.party.some((p) => p.alive && pLv(p, "mercy")) && G.run && !G.run.secured && !G.run.mercyUsed) {
    const dead = G.party.find((p) => !p.alive);
    if (dead) {
      G.run.mercyUsed = true;
      dead.alive = true;
      dead.hp = Math.max(1, Math.ceil(dead.maxhp * 0.10));
      dead.ailment = null;
      dead.reviveAt = null;
      dead._dead = false;
      log(`慈悲の祈り！ ${dead.name}が立ち上がった`, "win");
      setTimeout(() => showToast(`慈悲の祈り ― ${dead.name}が立ち上がった`, { tone: "good" }), 400);
    }
  }
}

function finishToBoard() {
  imprintFallen(); // 戦闘で砕けた人業の魂に記憶を刻む
  // 眠り・魅了・混乱は戦闘の中だけの状態
  for (const p of G.party) { p._defending = false; p.asleep = false; p.mind = null; }
  G.battle = null;
  G.battleCell = null;
  G.state = "board";
  combatMenu.classList.add("hidden");

  playBgm(fieldBgm());
  renderBoard();
  autosave(true);
}

const GUARDIAN_COST = 20; // 全滅時、戦利品を守って帰還するための Red Soul
// 全滅: 決断のシート (赤い魂で全てを守る / あきらめる)。戻る操作では閉じない。
// 選んだら闇に溶けて街へ戻り、帰還の報告 (全滅版) に失ったもの・連れ帰りの時を残す
function gameOver() {
  G.state = "over";
  playBgm(null);
  SFX.gameover();
  buzz([0, 90, 70, 90, 70, 250]);
  log("人業はことごとく砕けた…", "dmg");
  imprintFallen(); // 記憶を刻む (器は迷宮に残り、街へ戻ってから連れ帰りの時を数える)
  G.autoCombat = false;
  if (G._autoTimer) { clearTimeout(G._autoTimer); G._autoTimer = null; }

  combatMenu.classList.add("hidden");
  renderDock();
  const r = G.run || newRun();
  const secured = !!r.secured; // 主を討った後の全滅は失うものがない (戦利品は確定済み)

  // 街へ戻る (砕けた人業は連れ帰りを待ち、届いたら館で修復する)
  const goTown = (opts) => {
    if (townBtn) townBtn.classList.add("hidden");
    if (descendBtn) { descendBtn.classList.add("hidden"); descendBtn.disabled = true; }
    combatMenu.classList.add("hidden");
    leaveDungeon(opts);
  };
  uiResults.openWipe({
    gold: secured ? 0 : (r.gold || 0),
    items: secured ? 0 : (r.items || []).length,
    souls: secured ? 0 : (r.souls || []).length,
    soulPts: r.soulPts || 0,
    secured, cost: GUARDIAN_COST, red: G.redSoul,
    canSave: G.redSoul >= GUARDIAN_COST,
    party: G.party.map((d) => ({ name: d.name, uid: d.uid })),
    // 赤い魂を使う: 何も失わず街へ即時帰還。全キャラHP1で復活する
    onSave: () => {
      if (G.redSoul < GUARDIAN_COST) return;
      G.redSoul -= GUARDIAN_COST;
      const run = G.run;
      G.run = null; // 戦利品を確定 (没収しない)
      reviveAllAtHp1(); // 全キャラHP1で復活
      SFX.levelup(); buzz([0, 30, 40, 30]);
      log("赤い魂が戦利品と人業を守った。一同HP1で生還する。", "win");
      goTown({ outcome: "saved", run });
    },
    // あきらめる: ゴールド・アイテム・魂を失う (✦Soul は残る)、人業は連れ帰りを待つ
    onGiveUp: () => {
      const run = G.run;
      const forfeited = secured ? null : { gold: r.gold || 0, items: (r.items || []).map(({ item }) => itemName(item)), souls: (r.souls || []).map((s) => (SOUL_CLASSES[s.clsKey] || {}).label || s.clsKey) };
      forfeitRun();
      log(secured ? "砕けた人業は、連れ帰りを待つ。" : "今回得たゴールド・アイテム・魂は失われた…（✦Soul は残った）", "dmg");
      goTown({ outcome: "wipe", run, forfeited });
    },
  });
}

// 迷宮の主を撃破した瞬間の確定処理。演出 (showDungeonClearedPopup) とは分離し、
// 勝利確定と同時に保存されるため、演出中に中断されても踏破・章進行は失われない
function commitDungeonClear(countBoss = true) {
  const idx = G.dungeonIdx;
  if (countBoss) {
    G.stats.bossKills++; questProgress("boss", null, 1);
    const bk = DUNGEONS[idx] && DUNGEONS[idx].boss;
    if (bk) G.stats.bossIds[bk] = true; // 戦績: 討伐した層ボスの種類 (勲章用)
  }
  G.dragonSlain = G.dragonSlain || idx === DUNGEONS.length - 1;
  // 新迷宮の解放は王宮の勅命ループが担う: 勅命対象を踏破 → 王宮で報告 → 次章拝命で解放
  const isStoryTarget = G.msq && G.msq.state === "active" && idx + 1 === G.msq.n;
  if (isStoryTarget) G.msq.state = "report";
  // クリア = 戦利品確定。記録 (帰還の報告に使う) は残し、全滅しても何も失わない印を付ける
  if (G.run) G.run.secured = true;
  G.bossDown = true; // 主を討ったので、どこからでも帰還できる
  if (tlOn()) tlSnapshot("clear", tlWhere(), G.party);
  return { idx, isStoryTarget };
}

// 踏破の凱旋 (確定処理は commitDungeonClear 済み): 「★ 迷宮踏破 ★」の祝祭 → 凱旋で闇に溶けて街へ
function showDungeonClearedPopup({ idx, isStoryTarget }) {
  const dn = DUNGEONS[idx];
  SFX.victory(); buzz([0, 40, 50, 40, 50, 200]);
  flashScreen("#ffd84a");
  uiResults.celebrateClear({
    name: dn.name, layer: dn.layer, isStoryTarget, layerBoss: !!dn.boss,
    last: idx >= DUNGEONS.length - 1,
    onStay: () => {
      log("迷宮は踏破した。下の「帰還」から、いつでも街へ凱旋できる。", "win");
      if (G.state === "board") renderBoard();
    },
    onGo: () => {
      if (townBtn) townBtn.classList.add("hidden");
      if (descendBtn) { descendBtn.classList.add("hidden"); descendBtn.disabled = true; }
      leaveDungeon({ outcome: "clear" });
    },
  });
}
// 戦績の共有: Web Share API (スマホの共有シート) → 無ければクリップボードへ写す
const GAME_URL = "https://kotarotao.github.io/DOS/";
function shareProgress(headline) {
  const text = `${headline}\n` +
    `踏破 ${clearedDungeonCount()}/100迷宮 ・ 最深 B${G.stats.deepest}F ・ 討伐 ${G.stats.kills}体\n` +
    `#百の迷宮と魂の王`;
  const data = { title: "百の迷宮と 魂の王", text, url: GAME_URL };
  try {
    if (navigator.share) { navigator.share(data).catch(() => {}); return; }
  } catch {}
  const full = `${text}\n${GAME_URL}`;
  const done = () => showToast("📋 戦績をコピーした");
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(full).then(done, () => showToast("共有できなかった")); return; }
  } catch {}
  showToast("共有できなかった");
}

// ---- パーティ表示 ----
// 隊の札: 肖像 (隊列の印・状態異常の印) + 名と職 + 血の小瓶 (HP) と魂の小瓶 (MP)。
// 盤面は毎フレーム描き直すが、札は中身が変わった時だけ作り直す (タップの取りこぼしとアニメの再始動を防ぐ)
function highlightActor(actor) {
  [...partyEl.children].forEach((c, i) => {
    c.classList.toggle("active", G.party[i] === actor);
  });
}

const AIL_SEAL = { poison: ["毒", "poison"], paralyze: ["痺", "paralyze"], stone: ["石", "stone"] };
const PARTY_MIND_SEAL = { charm: ["魅", "charm"], confuse: ["乱", "confuse"] };
let _partyKey = "";
function renderParty() {
  const fx = G.partyFx;
  const st = G.state;
  const key = st + "|" + G.party.map((p) => [
    p.uid, p.name, p.cls, p.isDoll ? (p.jobLv || 1) : p.level, p.hp, p.maxhp, p.mp, p.maxmp, p.alive ? 1 : 0,
    p.ailment || "", p.asleep && st === "combat" ? 1 : 0, st === "combat" ? (p.mind || "") : "", fx && fx.has(p) ? fx.get(p) : "", buffBadges(p),
    `${p.jobKey || ""}:${p.jobRank || 1}:${p.clsKey || ""}`,
  ].join(",")).join(";");
  if (key === _partyKey && partyEl.childElementCount === G.party.length) return;
  _partyKey = key;
  partyEl.innerHTML = "";
  partyEl.classList.toggle("n4", G.party.length >= 4);
  G.party.forEach((p, idx) => {
    const card = document.createElement("div");
    let cls = "pc" + (p.alive ? "" : " dead");
    if (p.alive && p.hp / p.maxhp <= 0.25) cls += " low"; // 瀕死警告
    if (fx && fx.has(p)) cls += " fx-" + fx.get(p); // fx-hit / fx-heal
    card.className = cls;
    // 盤面: タップ = 隊のシート (迷宮の型) / 長押し = その場で覗く (戦闘中も)
    if (G.state === "board") {
      card.style.cursor = "pointer";
      card.setAttribute("role", "button");
      card.addEventListener("click", () => {
        if (G._swiped) { G._swiped = false; return; } // 札の上からフリックして歩いた直後の click は無視
        if (G.anim || G.walking || uiBlocked()) return;
        UI.openParty(idx, { context: "dungeon" });
      });
    }
    if (G.state === "board" || G.state === "combat") attachLongPress(card, () => { SFX.select(); buzz(10); uiDungeonHud.peekDoll(p, { idx, combat: G.state === "combat" }); });
    // 戦闘: 味方を対象に選ぶ場面では、隊の札をタップしても選べる (回復・支援の対象)
    if (G.state === "combat") card.addEventListener("click", () => {
      const b = G.battle;
      if (!b || b.phase !== "target" || G.animating || uiBlocked()) return;
      if (!b.targetOptions().includes(p)) { SFX.ng(); return; }
      SFX.select(); buzz(10);
      b.chooseTarget(p);
      runCommitted();
    });
    // 肖像の額 (隊列の印・状態の印を重ねる)
    const por = el("div", "pc-por");
    const pic = partyPortrait(p);
    if (pic) por.appendChild(pic);
    por.appendChild(el("span", "pc-row " + (idx < 3 ? "front" : "back"), idx < 3 ? "前" : "後"));
    if (!p.alive) por.appendChild(el("span", "pc-seal dead", "死"));
    else if (p.ailment) { const a = AIL_SEAL[p.ailment] || ["呪", "poison"]; const s2 = el("span", "pc-seal " + a[1], a[0]); s2.title = AIL_NAME[p.ailment] || ""; por.appendChild(s2); }
    else if (p.asleep && G.state === "combat") por.appendChild(el("span", "pc-seal sleep", "眠"));
    else if (p.mind && G.state === "combat" && PARTY_MIND_SEAL[p.mind]) { const m = PARTY_MIND_SEAL[p.mind]; const s3 = el("span", "pc-seal " + m[1], m[0]); s3.title = AIL_NAME[p.mind] || ""; por.appendChild(s3); }
    card.appendChild(por);
    const nm = el("div", "name");
    nm.appendChild(el("span", "pc-n", p.name));
    nm.appendChild(el("b", "pc-lv", `Lv${p.isDoll ? (p.jobLv || 1) : p.level}`));
    card.appendChild(nm);
    card.appendChild(el("div", "cls", p.cls));
    const vial = (kind, v, m) => {
      const d = el("div", "pc-vial " + kind + (m > 0 ? "" : " none"));
      const fill = el("i");
      fill.style.width = (m > 0 ? Math.max(0, Math.min(100, (v / m) * 100)) : 0) + "%";
      d.appendChild(fill);
      const n = el("span", "pc-num", m > 0 ? String(v) : "—");
      if (m > 0) n.appendChild(el("small", null, "/" + m));
      d.appendChild(n);
      return d;
    };
    card.appendChild(vial("hp", p.hp, p.maxhp));
    card.appendChild(vial("mp", p.mp, p.maxmp));
    const bb = buffBadges(p);
    if (bb) card.insertAdjacentHTML("beforeend", bb);
    partyEl.appendChild(card);
  });
}

// パーティカードの肖像。札の額は 24×24 ドットの胸像を ~42px で見せる寸法 (PORTRAIT_PX)。
// 人業ごとに描いた canvas を使い回す (職業/ランクが変わった時だけ描き直す)。
// ※ 肖像の絵はここ一か所で差し替えられる (いまは職業の全身像 dollSprite を額に収めている)
const PORTRAIT_PX = 40;
const _partyPics = new WeakMap();
function partyPortrait(p) {
  if (!p || !p.isDoll || p.primary == null) return null;
  const key = `${p.jobKey || ""}:${p.jobRank || 1}:${p.clsKey || ""}`;
  let ent = _partyPics.get(p);
  if (!ent || ent.key !== key) {
    const c = crispCanvas(dollBust(p), PORTRAIT_PX); // 顔を中心に切り出した胸像
    c.className = "spr pc-pic";
    ent = { key, c };
    _partyPics.set(p, ent);
  }
  return ent.c;
}

// 戦闘中の発動効果バッジ: 能力ごとに 強化(▲)/弱体(▼) を段階数ぶん並べ、残りターンを添える。
const BUFF_STAT_ICON = BUFF_KANJI; // 絵文字は使わず、敵のピルと同じ漢字の印
const BUFF_STAT_LABEL = { atk: "ATK", vit: "VIT", agi: "AGI", ...BUFF_NAME };
function buffBadges(p) {
  if (G.state !== "combat" || !p.alive || !p.effects || !p.effects.length) return "";
  // (能力, 方向) ごとに集約: 段階数(最大2)と最短残ターンを出す
  const groups = new Map();
  for (const ef of p.effects) {
    const up = ef.mult > 1;
    const key = ef.stat + (up ? "+" : "-");
    const g = groups.get(key) || { stat: ef.stat, up, stages: 0, turns: Infinity };
    g.stages++; g.turns = Math.min(g.turns, ef.turns);
    groups.set(key, g);
  }
  let html = "";
  for (const g of groups.values()) {
    const arrow = (g.up ? "▲" : "▼").repeat(Math.min(2, g.stages));
    const title = `${BUFF_STAT_LABEL[g.stat] || g.stat} ${g.up ? "強化" : "弱体"}${g.stages}段階・残り${g.turns}T`;
    html += `<span class="bf ${g.up ? "up" : "dn"}" title="${title}">${BUFF_STAT_ICON[g.stat] || "◆"}${arrow}<b>${g.turns}</b></span>`;
  }
  return `<div class="buffs">${html}</div>`;
}

// ---- DOM ヘルパ ----
// el / btn / attachLongPress (= kit の longPress) は src/ui/kit.js へ移設 (import 済み)

// ================= 街 (拠点) =================
// 街の中身の根。街シェル (src/ui/townshell.js) の中身 = #town-screen を指す
let townEl = townshell.contentRoot();
const townBtn = document.getElementById("town-btn");
const descendBtn = document.getElementById("descend-btn");
const returnBtn = document.getElementById("return-btn");

// 帰還魔法陣ボタン: この階で帰還魔法陣を発見したら設定アイコンの右に出す。
// 押せばどこにいても街へ帰還できる (魔法陣まで歩いて戻る必要がない)。
function updateReturnBtn() {
  if (!returnBtn) return;
  // アイコンは MAP の帰還魔法陣と同じスプライト (ICONS.portal)
  if (!returnBtn.dataset.iconReady) {
    returnBtn.appendChild(spriteCanvas(ICONS.portal, 2));
    returnBtn.dataset.iconReady = "1";
  }
  const show = G.state === "board" && !!G.portalFound;
  returnBtn.classList.toggle("hidden", !show);
}
if (returnBtn) returnBtn.addEventListener("click", () => {
  if (G.state !== "board" || G.anim || G.walking || uiBlocked()) return;
  SFX.select();
  confirmReturnToTown();
});

// 下り階段ボタン: 最初は完全非表示。下り階段を見つけたら設定アイコンの右に出す。
// アイコンは MAP の下り階段と同じスプライト (ICONS.stairs)。
function updateDescendBtn() {
  if (!descendBtn) return;
  if (!descendBtn.dataset.iconReady) {
    descendBtn.appendChild(spriteCanvas(ICONS.stairs, 2));
    descendBtn.dataset.iconReady = "1";
  }
  const stairCell = (G.state === "board" && G.board) ? findRevealedStairs() : null;
  descendBtn.classList.toggle("hidden", !stairCell);
  descendBtn.disabled = !stairCell;
}

function findRevealedStairs() {
  if (!G.board) return null;
  for (let y = 0; y < G.board.cells.length; y++) {
    for (let x = 0; x < G.board.cells[y].length; x++) {
      const c = G.board.cells[y][x];
      if (c.type === "stairs" && c.revealed) return c;
    }
  }
  return null;
}

let altarSel = null; // 訓練所で選択中 { doll, part }

// 街の施設 (広場の札・夜景の名所)。art = townart.js の情景
const FACILITIES = [
  { key: "mansion", name: "人業の館", desc: "器を仕立て、魂を宿す" },
  { key: "tavern", name: "酒場「沈まぬ灯」", desc: "噂話と納品の依頼" },
  { key: "shop", name: "商店「黒鉄商会」", desc: "装備と道具の売買・鑑定" },
  { key: "inn", name: "宿屋「白狼」", desc: "傷を癒し、魂を休める" },
  { key: "palace", name: "王宮", desc: "勅命・書庫・宝物庫" },
  { key: "shrine", name: "赤い魂の祠", desc: "Red Soul を授かる" },
];

// 街の絵 (夜景・施設の情景) はアイドル時間に下ごしらえしておく (タイトル画面の間に描き溜め、初回の引っかかりを消す)
try { prewarmTown(FACILITIES.map((f) => f.key)); } catch (e) { /* 演出のみ */ }

// 施設の番人 (keeper) のひとこと。lines は帰還のたびに巡る (酒場・祠・宿・王宮の胸像のささやき、商会の番人の一言)
const FAC_SHELL = {
  tavern: { keeper: "barkeep", who: "酒場の主 グラム", lines: [
    "灯が消えぬうちは、ここは安全だ。…たぶんな。",
    "飲め。迷宮帰りの喉は、血の味しか覚えておらん。",
    "噂は金で買える。命は買えん。その差を忘れるな。"] },
  shop: { keeper: "merchant", who: "黒鉄商会 ヴォス", lines: [
    "黒鉄は嘘をつかん。値札もな。",
    "死人の剣でも、研げば生者の役に立つ。",
    "未鑑定の品か。正体を知るのは、金を払ってからだ。"] },
  inn: { keeper: "innkeeper", who: "宿の女主 イルザ", lines: [
    "眠りな。夢の底までは、迷宮も追ってこない。",
    "白狼の毛皮は温かいだろう。…あれを狩ったのは、あたしさ。",
    "扉のかんぬきは三重。それでも夜中に爪の音がしたら、起こしな。"] },
  palace: { keeper: "minister", who: "宰相 モルデン", lines: [
    "陛下は玉座でお待ちだ。…あまり長くは、お待ちになれぬ。",
    "勅命は果たされねばならぬ。たとえ、器が幾つ砕けようとも。"] },
  shrine: { keeper: "maiden", who: "祠守の巫女", lines: [
    "赤い魂は脈打つ。誰の心臓だったかは、問うてはならぬ。",
    "祈りなさい。この祠は、祈りの代わりに血を受け取ります。"] },
};

// 編成 + 控えの全人業
function allDolls() { return [...G.party, ...G.reserve]; }

// 街を描き直す (名前と約225の呼び出し元はそのまま)。中身の描き替え・スクロール位置の保持・
// タブバーの点灯・遷移の演出は街シェル (townshell.refresh) が受け持つ
function renderTown() {
  const then = G.town && G.town.facility ? takeLegacyEntry() : null; // 旧来の入口は新しいタブ/ページへ付け替えてから描く
  renderRunbar(); // 街では隠す
  autosave(); // 街での操作のたびに保存 (描画はアクション後に呼ばれる)
  updateTopbar();
  playBgm(sceneBgm()); // 施設ごとのBGM (同じ曲なら継続)
  townshell.refresh();
  if (then) queueMicrotask(() => { if (G.state === "town") then(); });
}

// 旧来の入口 (G.town.facility / sub): 旧セーブの街の現在地や古い呼び出し口から来たら、新しいタブ/ページへ付け替える。
//   tab/page = 行き先 / intent = 隊タブに渡す区分・シート / then = 描いた後に開く (王宮の区分・宿のシート・奈落の支度)
const LEGACY_ENTRY = {
  mansion: { tab: "party" }, party: { tab: "party" },
  manage: { tab: "party", intent: { reserve: true } }, altar: { tab: "party", intent: { seg: "soul" } },
  shop: { tab: "shop" },
  palace: { tab: "palace", then: () => UI.openPalace && UI.openPalace("decree") },
  treasury: { tab: "palace", then: () => UI.openPalace && UI.openPalace("treasury") },
  codexAch: { tab: "palace", then: () => UI.openPalace && UI.openPalace("ach") },
  codexItem: { tab: "palace", then: () => UI.openPalace && UI.openPalace("codex:item") },
  codexMon: { tab: "palace", then: () => UI.openPalace && UI.openPalace("codex:mon") }, // 旧モンスター図鑑は廃止 (旧セーブ互換)
  codexDungeon: { tab: "palace", then: () => UI.openPalace && UI.openPalace("codex:mon") },
  codexJob: { tab: "palace", then: () => UI.openPalace && UI.openPalace("codex:job") },
  tavern: { tab: "hub", page: "tavern" }, shrine: { tab: "hub", page: "shrine" },
  inn: { tab: "hub", then: () => UI.openInn && UI.openInn() },
  abyss: { tab: "hub", then: () => openAbyssSetup() }, // 奈落の支度は出撃シートの1ページ
};
function takeLegacyEntry() {
  const t = G.town;
  const e = LEGACY_ENTRY[t.facility === "mansion" && t.sub ? t.sub : t.facility] || { tab: "hub" };
  t.facility = null; t.sub = null;
  t.tab = e.tab; t.page = e.page || null;
  if (e.intent) uiParty.queueIntent(e.intent);
  return e.then || null;
}

let townBandOpen = null; // 迷宮選択で開いている層 (null = 選択中の迷宮の層)

// 第0章 (人業の生成) の間に開いている施設 (null = 制限なし)
function tutorialAllowed() {
  const tut = G.msq && G.msq.n === 0 && G.msq.state === "active";
  return tut ? (G.msq.granted ? ["palace", "mansion"] : ["palace"]) : null;
}

// セーブを消して最初からやり直す。autosave (visibilitychange/pagehide 含む) が
// リロード前に書き戻さないよう _resetting で保存を止めてから消す。決断は二段 (どちらも既定は「やめる」)
function confirmReset() {
  if (UI.confirmReset) return UI.confirmReset(); // 設定のシート (src/ui/settings.js): 「やめておく」に手が掛かる並び
  kitConfirm({
    banner: "警告", title: "全データを削除して、最初から始めますか？",
    lines: ["人業・魂・図鑑・進行度がすべて失われる。"],
    okLabel: "削除へ進む", cancelLabel: "やめておく",
  }).then((ok) => {
    if (!ok) return;
    kitConfirm({
      banner: "最終確認", title: "本当に、すべてを消しますか？",
      lines: ["消した記録は二度と戻らない。", "(音量などの端末の設定は残る)"],
      okLabel: "すべて削除して はじめから", cancelLabel: "やめておく",
    }).then((ok2) => {
      if (!ok2) return;
      _resetting = true;
      clearSave();
      location.reload();
    });
  });
}

// 人業を仕立てる費用 (最初の3体は無料、4体目以降に段階上昇)
function emptyDollCost() {
  const n = G.dollsPurchased;
  return n < 3 ? 0 : n === 3 ? 30 : n === 4 ? 50 : 100;
}

// 所持魂の並び順: 職業順 → ランク昇順 → Lv降順
function soulSortCmp(a, b) {
  const ja = SOUL_CLASS_ORDER[a.clsKey] ?? 99, jb = SOUL_CLASS_ORDER[b.clsKey] ?? 99;
  if (ja !== jb) return ja - jb;
  const ra = soulRankOf(a), rb = soulRankOf(b);
  if (ra !== rb) return ra - rb;
  if ((b.level || 1) !== (a.level || 1)) return (b.level || 1) - (a.level || 1);
  return a.uid - b.uid;
}

// 人業を仕立てる: 宿す魂を選ぶ (必須) → 名を与える。隊タブの控えシートから (src/ui/party.js)
function buyDoll() { uiParty.openCreateDoll(); }

// 人業の名前候補 (ランダム生成に使う)。厳選した基本名に加え、
// 語幹×語尾の合成名を足して候補を約10倍に増やしている (重複は Set で除去)。
const DOLL_NAME_BASE = [
  "アレク", "ルナ", "セシル", "ガロ", "ミラ", "フェン", "リーゼ", "オーウェン", "ノア", "ヴェル",
  "ティナ", "ザイン", "リオ", "クレア", "バルト", "エルザ", "グレン", "ソフィア", "ダリオ", "ニケ",
  "レヴィ", "アイナ", "クロウ", "フィオ", "ジーク", "メイ", "ロラン", "ユーリ", "セラ", "ヴァン",
  "リコ", "オルガ", "カイ", "ネル", "テオ", "シエル", "ガイ", "リン", "アッシュ", "ノクト",
];
const NAME_STEM = [
  "アル", "ベル", "セル", "ガル", "ミル", "フェル", "リー", "オル", "ノー", "ヴェル",
  "ティ", "ザイ", "リオ", "クレ", "バル", "エル", "グレ", "ソル", "ダル", "ニー",
  "レイ", "アイ", "クロ", "フィ", "ジー", "メル", "ロー", "ユー", "セレ", "ヴァル",
];
const NAME_SUFFIX = [
  "ヴィン", "フレッド", "ベルト", "ナ", "リス", "ウス", "ド", "リア", "ゼル", "モン", "トス", "シア",
];
const DOLL_NAMES = (() => {
  const set = new Set(DOLL_NAME_BASE);
  for (const a of NAME_STEM) for (const b of NAME_SUFFIX) set.add(a + b);
  return [...set];
})();
function randomDollName() { return DOLL_NAMES[Math.floor(Math.random() * DOLL_NAMES.length)]; }

// 魂と名前が決まったら、赤い魂を支払って人業を生成し、編成に加える。生まれた人業を返す
function finalizeBuyDoll(uid, name) {
  const cost = emptyDollCost();
  const s = soulByUid(uid);
  if (G.redSoul < cost) { log("Red Soul が足りない。", "sys"); SFX.ng(); showToast("赤い魂が足りない", { tone: "bad" }); return null; }
  if (!s || soulWorn(s.uid)) { log("その魂は宿せない。", "sys"); SFX.ng(); return null; }
  G.redSoul -= cost;
  G.dollsPurchased++;
  const d = makeDoll(name);
  d.primary = uid; // 選んだ魂をメイン魂として宿す
  recalcDoll(d);
  d.hp = d.maxhp; d.mp = d.maxmp;
  // 仕立てたばかりの人業はそのまま編成に加わる (満員なら控えへ)
  if (G.party.length < 6) G.party.push(d);
  else { G.reserve.push(d); log(`${d.name} は控えで待機する。`, "sys"); }
  SFX.itemget(); buzz([0, 30, 60, 30]);
  log(`人業「${d.name}」が生まれた！（${SOUL_CLASSES[s.clsKey].label}・🔴${cost}）`, "win");
  showToast(`人業「${d.name}」が目覚めた`, { tone: "good" });
  autosave(true);
  renderTown();
  return d;
}

// 名前入力 (キットの決断シート)。旧来の呼び出し口と同じ引数
function showNameInput({ title, desc, placeholder, defaultValue = "", confirmLabel = "決定", onConfirm, cancelLabel = null, onCancel = null, randomName = null }) {
  void placeholder; void cancelLabel;
  return uiParty.nameSheet({ banner: "名を与える", title, desc, value: defaultValue, okLabel: confirmLabel, random: randomName, onOk: onConfirm, onCancel });
}

// 職業 (clsKey) の表示順 = SOUL_CLASSES の定義順
const SOUL_CLASS_ORDER = Object.fromEntries(Object.keys(SOUL_CLASSES).map((k, i) => [k, i]));

// 魂の差し口が指す魂インスタンス (なければ null)。slotId: "primary" | "sub0" | "sub1"
function slotSoul(d, slotId) {
  if (slotId === "primary") return d.primary != null ? soulByUid(d.primary) : null;
  const sub = (d.subs || [])[+slotId.slice(3)];
  return sub ? soulByUid(sub.uid) : null;
}
// ある魂を「自分以外の人業」が宿しているか (魂は1体ごとに固有 = 同時装備は不可)
function soulWornByOther(uid, self) {
  for (const dd of allDolls()) {
    if (dd === self) continue;
    if (dd.primary === uid) return true;
    for (const s of (dd.subs || [])) if (s && s.uid === uid) return true;
  }
  return false;
}

function jobSig(d) { return d.jobKey ? `${d.jobKey}:${d.jobRank}` : "none"; }
// 転職 (職業・職業ランクが変わった): 祝祭カード (職業を見る ›)
function announceJobChange(d, before) {
  if (!d.jobKey || jobSig(d) === before) return;
  SFX.victory(); buzz([0, 30, 50, 30]);
  uiSoulPanel.celebrateJob(d);
}

// メイン魂を newCls に付け替えると装備できなくなる装備を列挙する ({key, item} の配列)
function unequippableUnder(d, newCls) {
  const bad = [];
  if (!newCls || !d.equip) return bad;
  const probe = { clsKey: newCls }; // canEquip は clsKey/align のみ参照 (人業に align は無い)
  for (const slot of SLOTS) {
    const it = d.equip[slot];
    if (it && !canEquip(probe, it)) bad.push({ key: slot, item: it });
  }
  return bad;
}

// 実際に魂を差し口へ宿す/外す処理 (装備の事前確認を通過した後に呼ぶ)
function applyEquipSoul(d, uid, s, slotId = "primary") {
  const before = jobSig(d);
  d.subs = d.subs || [];
  const si = slotId === "primary" ? -1 : +slotId.slice(3);
  if (slotId === "primary" && d.primary === uid) {
    d.primary = null; // 同じ魂をもう一度選ぶと外す
  } else if (si >= 0 && (d.subs[si] || {}).uid === uid) {
    d.subs.splice(si, 1);
    d.subs = d.subs.filter(Boolean);
  } else {
    // 同じ人業の他の差し口からは外す (二重に宿さない)
    if (d.primary === uid) d.primary = null;
    d.subs = d.subs.filter((x) => x && x.uid !== uid);
    if (slotId === "primary") {
      d.primary = uid;
    } else {
      d.subs[si] = { uid, picks: [] }; // 借用は recalcDoll が既定 (覚えている最後の技) で埋める
      d.subs = d.subs.filter(Boolean);
    }
  }
  recalcDoll(d);
  d.hp = Math.min(d.hp, d.maxhp); d.mp = Math.min(d.mp, d.maxmp);
  SFX.select(); buzz(15);
  autosave(true);
  renderTown();
  announceJobChange(d, before);
}

// ある魂を「自分以外の人業」がサブ魂として宿しているなら {doll, index} を返す
function subWearerOf(uid, self) {
  for (const dd of allDolls()) {
    if (dd === self) continue;
    const j = (dd.subs || []).findIndex((x) => x && x.uid === uid);
    if (j >= 0) return { doll: dd, index: j };
  }
  return null;
}
// 他の人業のサブ魂を、d のサブ魂の差し口 si へ付け替える。
// d がその差し口に魂を宿していれば、その魂は相手の同じ差し口へ移る (交換)。借りている技はそれぞれの魂について行く
function takeSubSoul(d, uid, si) {
  const w = subWearerOf(uid, d);
  if (!w) return false;
  const other = w.doll;
  d.subs = d.subs || [];
  const taken = other.subs[w.index];
  const mine = d.subs[si] || null;
  if (mine) other.subs[w.index] = mine;
  else other.subs.splice(w.index, 1);
  other.subs = other.subs.filter(Boolean);
  d.subs[si] = taken;
  d.subs = d.subs.filter(Boolean);
  for (const dd of [d, other]) { recalcDoll(dd); dd.hp = Math.min(dd.hp, dd.maxhp); dd.mp = Math.min(dd.mp, dd.maxmp); }
  SFX.select(); buzz(15);
  autosave(true);
  renderTown();
  return true;
}

// 差し口 (slotId) に魂を宿す/外す (メイン魂=転職、サブ魂=技の借用)。魂は1体ごとに固有。
// done(applied) … 実際に宿した/外した (確認で取りやめなら false)
// opts.take … サブ魂の差し口で、他の人業のサブ魂を付け替える (確認は呼び出し側で済ませる)。宿していた魂とは交換になる
function equipSoulToSlot(d, uid, slotId = "primary", done = null, opts = {}) {
  const fin = (v) => { if (typeof done === "function") done(v); return v; };
  const s = soulByUid(uid);
  if (!s || G.state !== "town") return fin(false);
  const si = slotId === "primary" ? -1 : +slotId.slice(3);
  // 別の差し口へ宿す (=付け替え) 場合のみ装備可否を判定する。外す操作は対象外
  const isNewEquip = !(slotId === "primary" && d.primary === uid) && !(si >= 0 && ((d.subs || [])[si] || {}).uid === uid);
  // メイン魂に宿している魂 (自分のものも含む) はサブ魂にできない
  if (isNewEquip && si >= 0 && allDolls().some((dd) => dd.primary === uid)) { SFX.ng(); showToast("メイン魂に宿している魂は、サブ魂にできない", { tone: "bad" }); return fin(false); }
  if (isNewEquip && si >= 0 && opts.take && subWearerOf(uid, d)) return fin(takeSubSoul(d, uid, si));
  if (isNewEquip && soulWornByOther(uid, d)) { log("他の人業が宿している魂は宿せない。", "sys"); SFX.ng(); showToast("他の人業が宿している魂だ", { tone: "bad" }); return fin(false); }

  // メイン魂の付け替えで、新しい職では装備できなくなる装備があれば事前に確認する
  if (isNewEquip && slotId === "primary" && d.primary !== uid) {
    const bad = unequippableUnder(d, s.clsKey);
    if (bad.length) {
      const free = MAX_ITEMS - d.items.length;
      const names = bad.map((b) => `・${b.item.name}（${SLOT_LABEL[b.key] || b.key}）`);
      if (bad.length > free) {
        // 外した装備を持ち物に入れる空きが足りない → 付け替えを中止
        SFX.ng();
        showEvent({
          sprite: jobSprite(s.clsKey, Math.max(1, soulRankOf(s))),
          banner: "付け替えできない", title: "持ち物がいっぱい",
          lines: [`${soulSeriesName(s.clsKey)}の魂 に付け替えると、次の装備が外れる。`, ...names,
            `しかし ${d.name} の持ち物に空きが ${free} 枠しかない。持ち物を減らしてから、もう一度。`],
          accent: "#d4504e", btnLabel: "とじる",
        });
        return fin(false);
      }
      kitConfirm({
        banner: "付け替え", title: `${soulSeriesName(s.clsKey)}の魂 に付け替える？`,
        lines: ["新しい職では次の装備を扱えないため、外して持ち物に戻す。", ...names],
        okLabel: "付け替える", danger: false,
      }).then((ok) => {
        if (!ok) return fin(false);
        for (const b of bad) { d.equip[b.key] = null; d.items.push(b.item); }
        applyEquipSoul(d, uid, s, slotId);
        fin(true);
      });
      return false;
    }
  }
  applyEquipSoul(d, uid, s, slotId);
  return fin(true);
}

// サブ魂が借りる技/パッシブを選ぶ (src/ui/soulpanel.js のシート)
function openSubSkillPicker(d, subRef) { return uiSoulPanel.openSkillStep(d, subRef); }

// 魂融合: target に同職の余っている魂を融合させる候補
function fuseCandidates(targetUid) {
  const t = soulByUid(targetUid); if (!t) return [];
  return G.souls.filter((s) => s.uid !== t.uid && s.clsKey === t.clsKey && !soulWorn(s.uid) && !s.locked);
}
// 魂のロック: ロックした魂は魂融合の素材にできない (宿す・融合先にするのは自由)
function toggleSoulLock(uid) {
  const s = soulByUid(uid); if (!s) return null;
  s.locked = !s.locked;
  if (!s.locked) delete s.locked;
  autosave(true);
  renderTown();
  return !!s.locked;
}
// 融合させる魂を選ぶ (src/ui/soulpanel.js のシート)
function openFusePicker(targetUid) { return uiSoulPanel.openFusePicker(targetUid); }
// 実際の融合: consume を消し、その魂数を target に加える。
// ランクが上がれば祝祭カード (showRankUp)、据え置きならトーストで知らせる
function fuseSoul(targetUid, consumeUid) {
  const t = soulByUid(targetUid), c = soulByUid(consumeUid);
  if (!t || !c || c.clsKey !== t.clsKey || soulWorn(c.uid) || c.locked) { SFX.ng(); return null; }
  const before = soulRankOf(t);
  const beforeLv = t.level;
  // 双方に蓄積していた総 Soul を合算する。新しい上限まではレベルに、超過分は exp に保持する。
  const total = soulTotalExp(t.level, t.exp) + soulTotalExp(c.level, c.exp);
  t.count += c.count;
  const newCap = soulLevelCapOf(t);
  const le = levelExpFromTotal(total, newCap);
  t.level = le.level; t.exp = le.exp;
  const idx = G.souls.indexOf(c);
  if (idx >= 0) G.souls.splice(idx, 1);
  unequipSoulEverywhere(c.uid);
  G.stats.fusions++; // 戦績: 魂の融合回数 (勲章用)
  recalcAllDolls({ levelUp: t.level > beforeLv });
  codexJobSee(t.clsKey, t.count, t.level);
  const after = soulRankOf(t);
  SFX.itemget(); buzz([0, 30, 50, 30]);
  log(`${SOUL_CLASSES[t.clsKey].label}の魂を魂融合させた (魂数 ×${t.count})。`, "win");
  if (t.level > beforeLv) log(`蓄積した Soul が反映され、Lv${beforeLv} → Lv${t.level} に上昇した！`, "win");
  autosave(true);
  renderTown();
  // ランクが上がったときは、昇格の祝祭カード (新しい称号・伸びた上限を見せる)
  if (after > before) {
    log(`⤴ ${jobRankName(t.clsKey, after)} に昇格！`, "win");
    showRankUp({ clsKey: t.clsKey, fromRank: before, toRank: after, fromLv: beforeLv, toLv: t.level, count: t.count }, null);
    return { rankUp: true, from: before, to: after };
  }
  // ランク据え置きの融合: 魂の輝きが増したことと、全能力の上昇率をトーストで
  const pct = Math.round((SOUL_STAT_UP[SOUL_CLASSES[t.clsKey].rarity] || 0.01) * 100);
  showToast(`${soulSeriesName(t.clsKey)}の魂の輝きが増した ― 全能力 +${pct}%（魂数 ${t.count}）${t.level > beforeLv ? ` ・ Lv${beforeLv}→${t.level}` : ""}`, { tone: "good" });
  return { rankUp: false };
}

// 魂を1レベル上げるのに要する Soul (レベルが高いほど高い)
// 次レベルへ必要な ✦Soul。レベルが上がるほど指数的に増え、レベリングのペースを抑える。
// 基準 20 × 1.13^(level-1) → Lv1≈20 / Lv10≈60 / Lv20≈204 / Lv30≈692 / Lv50≈7980。
function soulTrainCost(level) { return Math.max(1, Math.round(20 * Math.pow(1.13, (level || 1) - 1))); }

// 魂に蓄積している総 Soul = 現レベルまでに消費した分 + 次レベルへの途中分(exp)。
// 融合時の合算や、上限突破後の一括レベルアップ計算に使う。
function soulTotalExp(level, exp) {
  let total = exp || 0;
  for (let i = 1; i < (level || 1); i++) total += soulTrainCost(i);
  return total;
}
// 総 Soul と Lv上限から、到達レベルと端数 exp を求める。
// 上限に達しても余剰 Soul は exp として保持し、ランクUPで上限が伸びたら一気に反映される。
function levelExpFromTotal(total, cap) {
  let level = 1, rem = Math.max(0, total);
  while (level < cap && rem >= soulTrainCost(level)) { rem -= soulTrainCost(level); level++; }
  return { level, exp: rem };
}

// 魂インスタンスを ✦Soul で1段鍛える (その魂を宿す人業が伸びる)。
// 費用・上限は ops.trainTimes と同じ。結果はトースト1つ + その場の演出 (src/ui/soulpanel.js)
function trainSoul(uid) { return uiSoulPanel.train(uid, 1); }

// 魂の残火でメイン魂のLv上限を1上げる (上限は capBonus に蓄積される)。
// 要る残火は職業のレア度ごと (emberCostOf: コモン1・レア2・エピック3・レジェンド5)
function raiseSoulCap(uid) {
  const e = soulByUid(uid);
  if (!e) return;
  const need = emberCostOf(e.clsKey);
  if ((G.embers || 0) < need) { log(`魂の残火が足りない。(${need}つ要る)`, "sys"); SFX.ng(); showToast(`魂の残火が足りない（${need}つ要る）`, { tone: "bad" }); return; }
  G.embers -= need;
  e.capBonus = (e.capBonus || 0) + 1;
  recalcAllDolls();
  updateTopbar();
  const cap = soulLevelCapOf(e);
  SFX.levelup(); buzz([0, 30, 50, 30]);
  log(`魂の残火を${need}つ捧げ、${soulSeriesName(e.clsKey)}の魂のLv上限が ${cap} になった。`, "win");
  showToast(`🔥 ${soulSeriesName(e.clsKey)}の魂 ― Lv上限 ${cap}（残火 ${G.embers}）`, { tone: "gold" });
  autosave(true);
  renderTown();
}

// ---- 酒場「沈まぬ灯」: パーティ編成 + クエスト ----
// kill クエストは種族(race)で判定する (ダンジョン毎にモンスターIDが異なるため)
const QUEST_DEFS = [
  { id: "q_slime", name: "ぬめる脅威", desc: "不定形の魔物を 3体 倒す", type: "kill", race: "amorph", goal: 3, reward: { gold: 80 } },
  { id: "q_bat", name: "夜翼の駆除", desc: "飛獣を 3体 倒す", type: "kill", race: "wing", goal: 3, reward: { gold: 100 } },
  { id: "q_souls", name: "魂の回収者", desc: "死体から魂を 3個 回収する", type: "soul", goal: 3, reward: { gold: 150 } },
  { id: "q_b2", name: "深淵への一歩", desc: "地下2階に到達する", type: "floor", goal: 2, reward: { gold: 150, soul: "priest" } },
  { id: "q_skel", name: "骸の掃除", desc: "不死者を 2体 倒す", type: "kill", race: "undead", goal: 2, reward: { gold: 180, soul: "knight" } },
  { id: "q_dragon", name: "竜殺し", desc: "竜を討つ", type: "kill", race: "dragon", goal: 1, reward: { gold: 1000 } },
];

function initQuests() {
  G.quests = QUEST_DEFS.map((q) => ({ ...q, state: "avail", progress: 0 }));
}

// 進行中クエストへ進捗を加算。達成したら通知
function questProgress(type, key, n = 1) {
  const all = [...G.quests, ...((G.dailyQuests && G.dailyQuests.list) || []), ...Object.values(G.subQuests || {})];
  for (const q of all) {
    if (q.state !== "active" || q.type !== type) continue;
    // サブクエストも迷宮・階を問わず、条件さえ満たせば進む (場所の縛りなし)
    // kill: q.race 指定なら倒した敵の種族で判定 / それ以外は従来のキー一致
    if (q.type === "kill") {
      if (q.race) { const m = MONSTERS[key]; if (!m || m.race !== q.race) continue; }
      else if (q.key !== key) continue;
    }
    if (q.type === "floor") { q.progress = Math.max(q.progress, key); }
    else q.progress += n;
    if (q.progress >= q.goal && q.state === "active") {
      q.state = "done";
      log(`クエスト達成！「${q.name}」— 酒場で報告しよう`, "win");
      showToast(`📜 クエスト達成: ${q.name}`);
    }
  }
}

// ---- 酒場に居合わせる者たち: 帰還ごとに3〜5名を選び、各人が世界の噂・冒険のヒントを語る ----
// req を持つヒントは、その機能が解放されるまで出さない (未解放システムを匂わせない)。
function tavernHintAllowed(req) {
  if (!req) return true;
  if (req === "sub") return unlockedSubSlots() > 0;     // 宿し技 (D10)
  return featureUnlocked(req);                           // fusion(D5) / rumor(D15)
}
// 酒場の顔ぶれを選び直す (ダンジョン帰還時・初回入店時に呼ぶ)
function rollTavernCrowd() {
  const count = 3 + rand(3); // 3〜5名
  const speakers = [...TAVERN_SPEAKERS].sort(() => Math.random() - 0.5);
  const hints = TAVERN_HINTS.filter((h) => tavernHintAllowed(h.req)).sort(() => Math.random() - 0.5);
  const crowd = [];
  for (let i = 0; i < count && i < speakers.length; i++) {
    const sp = speakers[i];
    const line = hints[i % hints.length];
    crowd.push({ type: sp.type, icon: sp.icon, name: sp.names[rand(sp.names.length)], line: line ? line.t : "「……」" });
  }
  G.tavernCrowd = crowd;
}

// ---- 酒場の噂話: 「選択中の潜入先」を読んだ予兆を生成する ----
// 盤面型 (harvest/treasure/special) は次の潜入の開始階 (B1F) で現実になり (applyRumorToBoard)、
// その威力は実際に潜る迷宮の層 (layer) に合わせてスケールする。
// 情報型 (element/boss, info:true) は備えを促すだけで盤面は変えない。
const RUMOR_SPEAKERS = ["隻眼の傭兵", "酔った盗掘者", "巡礼の僧", "宿の女将", "傷だらけの斥候", "黒衣の占い師"];
// 層属性に有利を取る攻撃属性 (敵の弱点 = こちらが厚くすべき備え)
const ELEM_COUNTER = { fire: "water", water: "earth", earth: "wind", wind: "fire", dark: "light", light: "dark" };
// 特別階の予兆で「ピン留め」できる好特別階 (深層では伝説も加わる)
function pickRumorSpecial(layer) {
  const pool = [
    { id: "bounty",   omen: "黄金の気配が満ちる「豊穣の間」が口を開けているらしい" },
    { id: "soulTide", omen: "魂の奔流が渦巻いていると聞く" },
    { id: "vault",    omen: "宝箱がいくつも転がる「黄金の蔵」があるという" },
    { id: "springs",  omen: "癒しの霊泉が湧いているそうだ" },
    { id: "healing",  omen: "癒しの霊気が満ちているらしい" },
  ];
  if (layer >= 12) pool.push({ id: "legend", omen: "伝説の眠る気配がある" });
  return pool[rand(pool.length)];
}

function rollRumor() {
  const cfg = curDungeon();
  const layer = cfg.layer || layerOf(dungeonNumber(cfg));
  const speaker = RUMOR_SPEAKERS[rand(RUMOR_SPEAKERS.length)];
  const dn = cfg.name || "次の迷宮";

  // 潜入先に応じて成立する噂だけを [重み, 生成関数] で候補に積む
  const cands = [];
  // 豊穣の予兆: B1F に温かい死体。深層ほど数も魂の格も上がる
  cands.push([30, () => {
    const great = layer >= 8;
    const clsKey = great ? rollGreatCorpseClass() : rollJobClass();
    return { type: "harvest", clsKey, great, floor: 1, speaker,
      text: `「${dn}の入口あたりで、まだあたたかい死体を見た。${great ? "並の魂ではないぞ。" : "魂が宿っているはずだ。"}」` };
  }]);
  // 財宝の予兆: B1F に格の高い宝箱 (中身は装備品確定・層相応のレベル底上げ)
  cands.push([25, () => ({ type: "treasure", floor: 1, speaker,
    text: `「${dn}の奥で金属の輝きを見たという。${layer >= 10 ? "相当な業物が眠っているかもしれん。" : "上物の宝箱がひとつ余分にあるかもな。"}」` })]);
  // 特別階の予兆: B1F が好特別階になる
  cands.push([20, () => {
    const sp = pickRumorSpecial(layer);
    return { type: "special", special: sp.id, floor: 1, speaker,
      text: `「${dn}の最初の階に、${sp.omen}。見過ごすなよ。」` };
  }]);
  // 属性の予兆 (情報): 層属性と備えるべき属性
  if (cfg.element && cfg.element !== "none" && ELEMENTS[cfg.element]) {
    cands.push([15, () => {
      const el = ELEMENTS[cfg.element].label;
      const ce = ELEM_COUNTER[cfg.element];
      const adv = ce && ELEMENTS[ce] ? `〈${ELEMENTS[ce].label}〉の備えを厚くしておけ。` : "属性の備えを見直せ。";
      return { type: "element", floor: 1, speaker, info: true,
        text: `「${dn}は〈${el}〉の気が満ちている。${adv}」` };
    }]);
  }
  // 主の予兆 (情報): 層末ボスの正体と弱点
  if (cfg.boss && MONSTERS[cfg.boss]) {
    cands.push([12, () => {
      const b = MONSTERS[cfg.boss];
      const be = b.element && b.element !== "none" && ELEMENTS[b.element] ? `〈${ELEMENTS[b.element].label}〉を纏う` : "";
      const tr = monsterTraits(b)[0];
      const trTxt = tr ? `${tr.label}——${tr.desc}。` : "底知れぬ力を持つという。";
      return { type: "boss", floor: 1, speaker, info: true,
        text: `「${dn}の主は${be}「${b.name}」だ。${trTxt}心して挑め。」` };
    }]);
  }

  const total = cands.reduce((s, c) => s + c[0], 0);
  let r = Math.random() * total;
  for (const c of cands) { if ((r -= c[0]) < 0) return c[1](); }
  return cands[0][1]();
}

// 盤面生成後に、予兆 (rumor) を反映する。威力は実際に潜る迷宮の層に合わせる
function applyRumorToBoard(board) {
  const r = G.activeRumor;
  if (!r) return;
  G.activeRumor = null;
  if (r.info) return; // 属性・主の予兆は備えを促すだけ。盤面は変えない
  const layer = activeCfg().layer || 1;
  // 行き止まり (開いた辺が1つ) のマスを候補にする
  const deadends = [];
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const c = board.cells[y][x];
    if (c.type === "start" || c.type === "stairs") continue;
    let open = 0; for (const d of ["n", "e", "s", "w"]) if (!c.walls[d]) open++;
    if (open === 1) deadends.push(c);
  }
  const pickCell = () => deadends.length ? deadends.splice(rand(deadends.length), 1)[0] : null;
  const setCorpse = (cls, great) => { const c = pickCell(); if (c) { c.type = "corpse"; c.cleared = false; c.corpseWarm = true; c.corpseClass = cls; if (great) c.corpseGreat = true; } };
  if (r.type === "harvest") {
    // 名指しの1体 + 層に応じた追加 (深層ほど多く、上位レアの魂が宿る)
    const extra = layer >= 14 ? 2 : layer >= 7 ? 1 : 0;
    setCorpse(r.clsKey, r.great);
    for (let i = 0; i < extra; i++) {
      const great = layer >= 8;
      setCorpse(great ? rollGreatCorpseClass() : rollJobClass(), great);
    }
  } else if (r.type === "treasure") {
    // 中身が必ず装備品の「特別な宝箱」。層に比例した装備レベル底上げ (上限+40)
    const c = pickCell();
    if (c) { c.type = "chest"; c.cleared = false; c.lootBonus = Math.min(40, layer * 2); }
  } else if (r.type === "special") {
    // B1F を指定の好特別階にピン留めする (本来1Fには出ない特別階を噂で呼び込む)
    const def = SPECIAL_FLOORS.find((s) => s.id === r.special);
    if (def) {
      G.specialFloor = def.id;
      if (def.board) def.board(board);
      log(`噂どおりだ… この階は「${def.name}」だ。(${r.speaker}の話)`, "win");
      return;
    }
  }
  log(`噂どおりだ… (${r.speaker}の話)`, "sys");
}

// ---- 酒場の納品依頼: 求められた品を納めると、その品のレア度 (c/uc/r/sr/lr) に応じて職業の魂を授かる ----
// 対象は「今 到達している深さまでに出現しうる品」からランダム3件。LR/専用装備は除外
// (LOOT_IDS が exclusive を弾く)。常時最大3件で、迷宮に潜るたびに入れ替わる (rollDeliveryQuests)。
const DELIVERY_REWARDS = {
  // レア度 : [ [魂のレア度, 体数, 確率], … ] (確率は合計1.0)
  c:  [["common", 2, 0.70], ["rare", 1, 0.20], ["epic", 1, 0.09], ["legend", 1, 0.01]],
  uc: [["common", 3, 0.60], ["rare", 2, 0.25], ["epic", 1, 0.13], ["legend", 1, 0.02]],
  r:  [["common", 4, 0.45], ["rare", 2, 0.30], ["epic", 1, 0.20], ["legend", 1, 0.05]],
  sr: [["common", 5, 0.40], ["rare", 3, 0.30], ["epic", 2, 0.20], ["legend", 1, 0.10]],
  lr: [["rare", 5, 0.40], ["epic", 3, 0.40], ["legend", 1, 0.20]],
};
function deliveryRewardRows(it) { return DELIVERY_REWARDS[rarityKey(it)] || DELIVERY_REWARDS.c; }
// 報酬を1つ抽選: [rarity, 体数]
function rollDeliveryReward(it) {
  const rows = deliveryRewardRows(it);
  let r = Math.random();
  for (const [rarity, count, p] of rows) { if ((r -= p) < 0) return [rarity, count]; }
  const last = rows[rows.length - 1];
  return [last[0], last[1]];
}
// 報酬テーブルの表示文
function deliveryRewardDesc(it) {
  return deliveryRewardRows(it).map(([rar, c, p]) => `${RARITY_LABEL[rar]}魂×${c} (${Math.round(p * 100)}%)`).join(" / ");
}
// 指定レアリティの職業をランダムに選ぶ
function rollClassOfRarity(rarity) {
  const pool = SOUL_KEYS.filter((k) => SOUL_CLASSES[k].rarity === rarity);
  return pool.length ? pool[rand(pool.length)] : "fighter";
}
// 「今 到達している深さまでに出現しうる」品のid (LOOT_IDS = exclusive/LR を除く通常ドロップ品)
function eligibleDeliveryItemIds() {
  const idx = Math.min(DUNGEONS.length - 1, Math.max(0, (G.unlockedDungeons || 1) - 1));
  const cap = (DUNGEONS[idx].lootLv || [1, 1])[1]; // 到達済み最深ダンジョンのドロップ帯上限 lv
  return LOOT_IDS.filter((id) => (ITEMS[id].lv || 1) <= cap);
}
// 納品依頼を引き直す (重複なし)。同時件数は解放段階に応じて 1→2→3
function rollDeliveryQuests() {
  const pool = eligibleDeliveryItemIds();
  const cap = deliveryQuestCap();
  const out = [], used = new Set();
  for (let i = 0; i < cap && pool.length; i++) {
    let id, tries = 0;
    do { id = pool[rand(pool.length)]; tries++; } while (used.has(id) && tries < 24);
    if (used.has(id)) break;
    used.add(id); out.push({ itemId: id });
  }
  return out;
}
function ensureDeliveryQuests() { if (!Array.isArray(G.deliveryQuests)) G.deliveryQuests = rollDeliveryQuests(); }
// 対象アイテムが手持ち (人業の所持品。装備中・未鑑定は除く) にあるか
function deliveryHolder(itemId) {
  return allDolls().find((d) => (d.items || []).some((it) => it.id === itemId && !it.unidentified)) || null;
}
// 納品依頼の状態: 手持ち (holder) があればそのまま納品、無くても商会の棚にあれば買ってその場で納品できる
function deliveryStatus(q) {
  const it = q && ITEMS[q.itemId];
  if (!it) return null;
  const holder = deliveryHolder(q.itemId);
  const inShop = !!(G.shopStock && G.shopStock[q.itemId] > 0);
  const price = buyPrice(it);
  return { holder, inShop, price, canBuy: !holder && inShop && G.gold >= price };
}
// 納品を実行: 手持ちから1つ消費し、品の格に応じた魂を授かる。
// opts.buy = 手持ちが無い時、商会の棚から買ってそのまま納める (袋は経由しないので所持枠は要らない)
function deliverQuest(q, opts = {}) {
  const it = ITEMS[q.itemId];
  if (!it) return;
  const holder = deliveryHolder(q.itemId);
  if (holder) {
    const i = holder.items.findIndex((x) => x.id === q.itemId && !x.unidentified);
    if (i < 0) { log("納品できる品が手元にない。", "sys"); SFX.ng(); return; }
    holder.items.splice(i, 1);
    recalcDoll(holder); holder.hp = Math.min(holder.hp, holder.maxhp); holder.mp = Math.min(holder.mp, holder.maxmp);
  } else if (opts.buy) {
    const price = buyPrice(it);
    if ((G.shopStock[q.itemId] || 0) <= 0) { log("商会の棚に品がない。", "sys"); SFX.ng(); return; }
    if (G.gold < price) { log("お金が足りない。", "sys"); SFX.ng(); return; }
    G.gold -= price;
    G.shopStock[q.itemId]--;
    codexSeeItem(q.itemId);
    log(`${it.name} を商会で買い求めた (💰${price})。`, "sys");
  } else { log("納品できる品が手元にない。", "sys"); SFX.ng(); return; }
  const [rarity, count] = rollDeliveryReward(it);
  const got = [];
  for (let k = 0; k < count; k++) { const ck = rollClassOfRarity(rarity); addSoulInstance(ck); got.push(ck); }
  recalcAllDolls();
  // 納めた依頼は消える (次に潜るまで補充されない)
  G.deliveryQuests = (G.deliveryQuests || []).filter((x) => x !== q);
  const names = got.map((k) => SOUL_CLASSES[k].label);
  const rare = rarity !== "common";
  SFX.itemget(); buzz(rare ? [0, 40, 50, 40, 50, 150] : [0, 30, 60, 30]);
  if (rarity === "legend") { flashScreen("#ffcf4a"); SFX.victory(); }
  log(`${itemName(it)} を納品し、${RARITY_LABEL[rarity]}の魂を ${count} 体授かった。(${names.join("・")})`, "win");
  showEvent({
    sprite: soulIcon(got[0]),
    banner: rare ? `★ ${RARITY_LABEL[rarity]}の魂 ×${count} ★` : `✦ 魂 ×${count} ✦`,
    title: `「${it.name}」を納品`,
    lines: [`${RARITY_LABEL[rarity]}の魂を ${count} 体 授かった。`, `${names.join("・")} の魂`, "所持魂 一覧に追加した。"],
    accent: (SOUL_CLASSES[got[0]] || {}).glow || "#c9a227",
    sparkle: rare,
    btnLabel: "受け取る",
    onClose: () => { updateTopbar(); renderTown(); },
  });
  autosave(true);
}

// 噂話を一つ買う (💰100・30分に一度)。情報屋は今選んでいる迷宮を読む (rollRumor)
const RUMOR_PRICE = 100;
const RUMOR_COOLDOWN_MS = 30 * 60 * 1000;
// 噂の値段。手ほどき「酒場の噂話」の最中の一度は情報屋のおごり (無料)
function rumorPrice() { return UI.tutorialFree && UI.tutorialFree("rumor") ? 0 : RUMOR_PRICE; }
function listenRumor() {
  if (!featureUnlocked("rumor") || G.rumor) return false;
  if ((G.rumorCooldown || 0) > Date.now()) return false;
  const price = rumorPrice();
  if (G.gold < price) { log("ゴールドが足りない。", "bad"); SFX.ng(); return false; }
  G.gold -= price;
  G.rumor = rollRumor();
  G.rumorCooldown = Date.now() + RUMOR_COOLDOWN_MS;
  SFX.select();
  autosave(true);
  renderTown();
  return true;
}

// 旧来の施設 (G.town.facility) を新しいタブ/ページへ付け替える。描画の最中なので、描き終えてから移る
function legacyToPage(page, { tab = "hub", seg = null, after = null } = {}) {
  queueMicrotask(() => {
    const t = G.town;
    if (!t || G.state !== "town") return;
    t.facility = null; t.sub = null;
    t.tab = tab;
    t.page = page || null;
    if (seg && UI.openPalace) { UI.openPalace(seg); }
    else renderTown();
    if (after) after();
  });
}

// ---- 実績 (勲章) ----
// 戦績・図鑑・職業発見・育成に紐づく称号 (100種以上)。達成すると王宮で報酬を受け取れる。
// 「カテゴリ × 段階表」から一括登録する。cond は毎回評価する純粋関数なので
// 追跡用の状態は不要 (G.ach は受領済みのみ記録)。ID はセーブに残るため変更禁止。
const ACHIEVEMENTS = [];
{
  const push = (id, name, desc, cond, gold, redSoul, series, soulPts) => {
    const reward = {};
    if (gold) reward.gold = gold;
    if (redSoul) reward.redSoul = redSoul;
    if (soulPts) reward.soulPts = soulPts;
    ACHIEVEMENTS.push({ id, name, desc, cond, reward, series: series || id });
  };
  // 段階表: rows = [しきい値, 称号, gold, redSoul, soulPts][] (gold以降は省略可)
  // 同じ段階表の勲章は series で束ね、勲章の間では「次の段階」だけを1枠に表示する
  const tiers = (idOf, rows, descOf, condOf) =>
    rows.forEach(([v, name, gold, redSoul, soulPts]) => push(idOf(v), name, descOf(v), () => condOf(v), gold, redSoul, idOf(rows[0][0]), soulPts));
  const allDolls = () => [...(G.party || []), ...(G.reserve || [])];
  const allSouls = () => (G.souls || []);
  const monSeen = () => Object.keys(G.codex.mon).filter((k) => MONSTERS[k]).length;
  const itemSeen = () => Object.keys(G.codex.item).filter((k) => ITEMS[k]).length;
  const hybSeen = () => Object.keys(G.codex.job).filter((k) => SOUL_CLASSES[k]).length;

  // 潜入回数 (8)
  tiers((v) => `run${v}`, [
    [1, "初陣", 50], [5, "駆け出しの探索者", 100], [10, "迷宮通い", 200, 5], [25, "迷宮の住人", 400, 5],
    [50, "深淵の常連", 800, 15], [100, "百度参り", 1500, 20], [200, "迷宮に魅入られた者", 3000, 30], [500, "帰らずの探索者", 8000, 50],
  ], (v) => `迷宮に ${v}回 潜る`, (v) => G.stats.runs >= v);

  // 撃破数 (9)
  tiers((v) => (v === 5000 ? "kill5k" : `kill${v}`), [
    [10, "血振るい", 80], [50, "首狩り", 150], [100, "百人斬り", 300, 5], [250, "戦場の影", 500, 5],
    [500, "百戦錬磨", 600, 10], [1000, "千の骸", 1500, 15], [2500, "屍山血河", 3000, 25],
    [5000, "千殺の操霊師", 5000, 40], [10000, "万骨の上に立つ者", 10000, 80],
  ], (v) => `敵を ${v}体 倒す`, (v) => G.stats.kills >= v);

  // 主討伐 (7)
  tiers((v) => `boss${v}`, [
    [1, "主殺し", 100], [5, "玉座荒らし", 300, 5], [10, "玉座のさんだつ者", 500, 10], [20, "主喰らい", 1000, 15],
    [30, "深淵の死神", 1500, 25], [50, "王なき迷宮", 3000, 40], [100, "玉座の墓守", 8000, 80],
  ], (v) => `迷宮の主を ${v}体 討つ`, (v) => G.stats.bossKills >= v);

  // 到達最深階 (11)
  tiers((v) => `deep${v}`, [
    [2, "一歩 下へ", 50], [3, "地の底へ", 100], [4, "暗闇に慣れた者", 150], [5, "底知らず", 300],
    [6, "深層の旅人", 400, 5], [7, "闇の淵", 500, 5], [8, "奈落のふち", 700, 10], [9, "静寂の領域", 900, 10],
    [10, "奈落の踏破者", 1000, 15], [11, "光の届かぬ場所", 1500, 20], [12, "闇に溶ける者", 2500, 30],
  ], (v) => `地下 ${v}階 に到達する`, (v) => G.stats.deepest >= v);

  // 魂の回収 (8)
  tiers((v) => `soul${v}`, [
    [5, "魂拾い", 100], [10, "魂集め", 200], [25, "魂の籠", 350, 5], [50, "魂の商人", 600, 10],
    [100, "千魂の器", 1000, 15], [250, "魂の収集家", 2000, 20], [500, "魂の大河", 4000, 35], [1000, "魂の海", 8000, 60],
  ], (v) => `魂を ${v}個 回収する`, (v) => G.stats.soulsFound >= v);

  // 喪失 (5) — 敗北の数だけ強くなる
  tiers((v) => `death${v}`, [
    [1, "初めての喪失", 50], [10, "不屈の心", 0, 20], [25, "砕けても なお", 500, 25],
    [50, "屍を越えて", 1000, 35], [100, "喪失の果てに", 2000, 50],
  ], (v) => `人業が ${v}体 砕ける`, (v) => G.stats.deaths >= v);

  // 迷宮踏破 (13)。旧ID互換のため id は dun{踏破数+1}
  tiers((v) => `dun${v + 1}`, [
    [1, "最初の踏破", 100], [5, "五つの迷宮", 300, 5], [10, "第二の門", 500, 10], [20, "異界の旅人", 800, 10],
    [30, "中層の覇者", 1500, 20], [40, "迷宮の地図屋", 2000, 20], [50, "折り返しの碑", 2500, 25],
    [60, "深層の覇者", 3000, 30], [70, "終わりの始まり", 4000, 35], [80, "終末の歩み", 5000, 40],
    [90, "冥府の門前", 6000, 45], [95, "冥府の深奥", 7000, 50], [99, "終焉を望む者", 8000, 60],
  ], (v) => `迷宮を ${v} 踏破する`, (v) => G.unlockedDungeons >= v + 1);

  // モンスター図鑑 (5)
  tiers((v) => `mon${v}`, [
    [10, "魔物の観察者", 150], [30, "魔物の目利き", 400], [60, "魔物学の徒", 700, 10],
    [100, "深淵の博物学者", 1500, 15], [150, "異形の語り部", 3000, 30],
  ], (v) => `モンスター図鑑 ${v}種`, (v) => monSeen() >= v);

  // アイテム図鑑 (7)
  tiers((v) => `item${v}`, [
    [10, "目利き見習い", 150], [25, "道具屋の常連", 300], [50, "収集家", 400], [100, "蔵の主", 800, 10],
    [150, "宝物庫の主", 1500, 15], [250, "伝説の収集家", 3000, 30], [350, "千の宝を知る者", 8000, 60],
  ], (v) => `アイテム図鑑 ${v}種`, (v) => itemSeen() >= v);

  // 職業発現 (8)
  tiers((v) => `hyb${v}`, [
    [1, "最初の職業発現", 100], [3, "魂の探求者", 200], [6, "職業の解放者", 300], [12, "職業の織り手", 600, 10],
    [18, "魂の錬金術師", 1000, 15], [24, "異端の指導者", 1500, 20], [30, "万職の祖", 2000, 30], [36, "万魂の支配者", 3000, 50],
  ], (v) => `${v}種の職業を発現させる`, (v) => hybSeen() >= v);

  // 蓄財 (4) — 受領時にも所持金を再判定する
  tiers((v) => `gold${v}`, [
    [1000, "小金持ち", 0, 5], [5000, "商人の財布", 0, 10], [20000, "貴族の財", 0, 20], [100000, "王より富める者", 0, 50],
  ], (v) => `所持金 ${v}G を貯める`, (v) => G.gold >= v);

  // Soul・赤い魂の貯蔵 (4)
  tiers((v) => `sp${v}`, [[500, "魂の貯蔵庫", 100], [5000, "魂の泉", 1000, 15]],
    (v) => `✦Soul を ${v} 貯める`, (v) => G.soulPts >= v);
  tiers((v) => `rs${v}`, [[100, "赤の収集者", 500], [500, "緋色の王", 3000]],
    (v) => `赤い魂を ${v} 集める`, (v) => G.redSoul >= v);

  // 育成: 職業ランク / キャラLv / 魂レベル / 魂ランク (14)
  tiers((v) => `jrank${v}`, [[3, "位階を昇る者", 300, 5], [4, "高位の操霊師", 800, 10], [5, "極みに至る者", 2000, 30]],
    (v) => `職業ランク ${v} の人業を持つ`, (v) => allDolls().some((d) => (d.jobRank || 0) >= v));
  tiers((v) => `jlv${v}`, [
    [10, "駆け出しの職人", 150], [20, "熟練の域", 400, 5], [30, "達人の域", 800, 10],
    [40, "名人の域", 1500, 20], [50, "神域", 3000, 40],
  ], (v) => `キャラLv ${v} に到達する`, (v) => allDolls().some((d) => (d.jobLv || 0) >= v));
  tiers((v) => `slv${v}`, [
    [20, "魂を磨く者", 200], [50, "魂を鍛える者", 800, 10], [70, "限界の先へ", 1500, 20], [100, "魂の深奥", 3000, 40],
  ], (v) => `Lv${v} の魂を育てる`, (v) => allSouls().some((s) => (s.level || 1) >= v));
  tiers((v) => `srank${v}`, [[2, "偉大なる魂", 300, 5], [4, "伝説とのめぐり合い", 1000, 20]],
    (v) => `${v === 4 ? "ランク5" : "ランク2以上"}の職業に到達する`, (v) => allSouls().some((s) => soulRankFromCount(s.clsKey, s.count) >= v + 1));

  // ── 探索の所作 (A: これまで未計測だった行動を勲章化) ──
  // 宝箱開封 (4)
  tiers((v) => `chest${v}`, [
    [10, "宝箱漁り", 100], [50, "財宝の嗅覚", 300, 5], [200, "蔵荒らし", 800, 10], [500, "宝箱の王", 2000, 20],
  ], (v) => `宝箱を ${v}回 開ける`, (v) => (G.stats.chests || 0) >= v);

  // 罠解除 (4) — 盗賊の見せ場
  tiers((v) => `disarm${v}`, [
    [10, "罠外し", 120], [50, "罠師の目", 350, 5], [150, "罠殺し", 900, 10], [400, "全ての罠を見抜く者", 2500, 25],
  ], (v) => `罠を ${v}回 解除する`, (v) => (G.stats.trapsDisarmed || 0) >= v);

  // 罠の被害 (3) — 痛い目を見た数だけ語れる
  tiers((v) => `trapped${v}`, [
    [10, "うっかり者", 0, 5], [50, "痛みを知る者", 0, 15], [150, "罠の常連", 0, 30],
  ], (v) => `罠を ${v}回 踏み抜く`, (v) => (G.stats.trapsSprung || 0) >= v);

  // 魂の融合 (4)
  tiers((v) => `fuse${v}`, [
    [1, "はじめての融合", 150], [10, "魂の鍛冶", 400, 5], [50, "融合の達人", 1200, 15], [150, "魂を束ねる者", 3000, 30],
  ], (v) => `魂を ${v}回 融合する`, (v) => (G.stats.fusions || 0) >= v);

  // 依頼の達成 (4) — 酒場のクエスト
  tiers((v) => `quest${v}`, [
    [5, "駆け出しの請負人", 150], [25, "酒場の常連", 400, 5], [75, "万能の請負人", 1200, 15], [200, "伝説の請負人", 3000, 30],
  ], (v) => `依頼を ${v}件 達成する`, (v) => (G.stats.questsDone || 0) >= v);

  // ミミック撃破 (3)
  tiers((v) => `mimic${v}`, [
    [1, "化け箱殺し", 150], [10, "擬態の天敵", 500, 10], [50, "ミミックの宿敵", 2000, 25],
  ], (v) => `ミミックを ${v}体 倒す`, (v) => (G.stats.mimics || 0) >= v);

  // 層ボス制覇 (4) — 種類で数える (1層1種)
  const bossKinds = () => Object.keys(G.stats.bossIds || {}).length;
  tiers((v) => `lboss${v}`, [
    [3, "層の覇者", 300, 5], [7, "幾多の主を討つ者", 1000, 10], [13, "玉座の収集家", 2500, 20], [20, "深淵の玉座を統べる者", 6000, 50],
  ], (v) => `層ボスを ${v}種 討伐する`, (v) => bossKinds() >= v);

  // ── 一点物・チャレンジ (B) ──
  push("party6", "六人の隊列", "人業 6体 で編成する", () => G.party.length >= 6, 200);
  push("dragon", "竜殺しの伝説", "竜の玄室の主を討つ", () => G.dragonSlain, 5000, 50);
  push("swiftBoss", "電光石火", "層ボスを 1ラウンド で討ち取る",
    () => !!G.stats.swiftBoss, 2000, 20, null, 500);
  push("masterMimic", "黄金を喰らう者", "マスターミミックを討ち取る",
    () => !!G.stats.masterMimicSlain, 2500, 25, null, 500);
  push("allElements", "六属を統べる者", "火・水・風・土・光・闇 すべての属性の敵を倒す",
    () => ["fire", "water", "wind", "earth", "light", "dark"].every((el) => G.stats.elemKills && G.stats.elemKills[el]),
    1500, 15, null, 400);

  // ── コンプリート (C) ── 達成可能な収集の最終目標
  const JOB_TOTAL = Object.keys(SOUL_CLASSES).length; // 全職業数 (=36)
  const awakenedJobs = () => new Set(allSouls().filter((s) => soulRankFromCount(s.clsKey, s.count) >= 2).map((s) => s.clsKey)).size;
  push("await6", "六魂の覚醒", "6種の職業をランク2以上に覚醒させる",
    () => awakenedJobs() >= 6, 600, 5);
  push("await18", "十八魂の覚醒", "18種の職業をランク2以上に覚醒させる",
    () => awakenedJobs() >= 18, 2000, 20, null, 300);
  push("awakeAll", "万魂覚醒の祖", "すべての職業をランク2以上に覚醒させる",
    () => awakenedJobs() >= JOB_TOTAL, 8000, 80, null, 1000);

  // ── 秘された勲章 ── 迷宮・職業・層ボスの総数に届く段は、達成するまで名も条件も伏せる
  // (勲章から「どこまで先があるか」を数えられないように)
  for (const id of ["dun96", "dun100", "hyb36", "lboss20", "awakeAll"]) {
    const a = ACHIEVEMENTS.find((x) => x.id === id);
    if (a) a.secret = true;
  }
}

function claimAchievement(a) {
  if (G.ach[a.id] || !a.cond()) return;
  G.ach[a.id] = true;
  let msg = [];
  if (a.reward.gold) { G.gold += a.reward.gold; msg.push(`💰${a.reward.gold}`); }
  if (a.reward.redSoul) { G.redSoul += a.reward.redSoul; msg.push(`🔴${a.reward.redSoul}`); }
  if (a.reward.soulPts) { G.soulPts += a.reward.soulPts; msg.push(`✦${a.reward.soulPts}`); }
  SFX.levelup(); buzz([0, 30, 60, 30]);
  flashScreen("#c9a22744");
  log(`勲章「${a.name}」を授かった！ (${msg.join(" + ")})`, "win");
  showToast(`🏅 勲章「${a.name}」獲得！`);
  updateTopbar();
  renderTown();
}

// 勲章の札: 段階表 (series) を1枠に束ね、受領済みの次の段階だけを出す。全段階を受領し終えた series は
// 最終段階を「受領済」として残す。並びは「拝受できる → 未達成 → 受領済」(同順位は定義順)
function achievementCards() {
  const groups = [];
  const byKey = {};
  for (const a of ACHIEVEMENTS) {
    let g = byKey[a.series];
    if (!g) { g = []; byKey[a.series] = g; groups.push(g); }
    g.push(a);
  }
  const cards = groups.map((g) => {
    const idx = g.findIndex((a) => !G.ach[a.id]);
    const allDone = idx < 0;
    const a = allDone ? g[g.length - 1] : g[idx];
    return { a, tier: allDone ? g.length : idx + 1, total: g.length, allDone, ready: !allDone && a.cond() };
  });
  const ord = (c) => (c.allDone ? 2 : c.ready ? 0 : 1);
  return cards.sort((x, y) => ord(x) - ord(y));
}

// ---- 王宮: メインストーリー「百の迷宮と、魂の王」 ----
// 勅命を受ける → 対象迷宮が出現 → 踏破 → 王宮で報告し報酬 → 次の勅命、のループ。
// 物語テキスト/報酬は story.js (20層構成・1層=5迷宮。層の最初でオープニング、層末でエンディング)。
// G.msq = { n: 迷宮番号 (1-100), state: "active"(攻略中) | "report"(報告可) | "offer"(次の勅命待ち) | "end" }

// 勅命シーン: 金縁のカードで台詞を流す
// 王の語り (勅命・報告・解放・終章)。玉座の老王の肖像を掲げ、台詞を1行ずつ浮かび上がらせる。
// カードのどこかをタップすると残りを一度に表示し、全行が出そろってから「御意」で閉じる。
// 行の種類で書式を変える: 「…」= 王の台詞 / 宰相… = 宰相の台詞 / ── = 勅命の要旨 / それ以外 = 地の文
function storyLineKind(t) {
  if (/^宰相/.test(t)) return "minister";
  if (/^──/.test(t)) return "decree";
  if (/^「/.test(t)) return "king";
  return "narr";
}
function showStoryScene(title, lines, rewardText, onClose, btnLabel = "御意") {
  // 物語の場面 (src/ui/story.js) があればそちらで語る。以下は場面が無い時の旧来のカード
  if (UI.playStoryChain && UI.playStoryChain.scene) return UI.playStoryChain([{ title, lines, reward: rewardText, btnLabel }], onClose);
  G.prompt = true;
  const wrap = el("div", "confirm-overlay story-overlay");
  const card = el("div", "ig-card story-card");
  // 肖像 + 見出し
  const head = el("div", "story-head");
  const pf = el("div", "story-portrait");
  pf.appendChild(spriteCanvas(KING_PORTRAIT, 7, 12)); // 28x28 → 84px (3px/ドット)
  pf.appendChild(el("div", "story-who", "老王"));
  head.appendChild(pf);
  const ht = el("div", "story-htxt");
  ht.appendChild(el("div", "story-kicker", "✦ 玉座の間 ✦"));
  ht.appendChild(el("div", "story-title", title));
  head.appendChild(ht);
  card.appendChild(head);
  const body = el("div", "story-body");
  // 行ごとの出現タイミング: 文字数に応じて間を取り、長い台詞ほど読む時間を残す
  let delay = 0.25;
  for (const t of lines) {
    const ln = el("div", "story-line k-" + storyLineKind(t), t);
    ln.style.animationDelay = delay.toFixed(2) + "s";
    delay += Math.min(1.6, 0.45 + t.length * 0.022);
    body.appendChild(ln);
  }
  card.appendChild(body);
  if (rewardText) {
    const rw = el("div", "story-reward", rewardText);
    rw.style.animationDelay = delay.toFixed(2) + "s";
    delay += 0.3;
    card.appendChild(rw);
  }
  const close = () => { wrap.remove(); G.prompt = false; if (onClose) onClose(); };
  const ok = btn(btnLabel, (e) => { if (e) e.stopPropagation(); close(); });
  ok.className = "btn primary ig-ok story-ok";
  ok.style.animationDelay = delay.toFixed(2) + "s";
  card.appendChild(ok);
  const tip = el("div", "story-tip", "タップで全文を表示");
  card.appendChild(tip);
  // 途中タップ = 残りを一気に表示 (演出を待たせない)
  let revealed = false;
  const revealAll = () => { if (revealed) return; revealed = true; card.classList.add("revealed"); };
  const timer = setTimeout(revealAll, REDUCED_MOTION ? 0 : (delay + 0.4) * 1000);
  card.addEventListener("click", (e) => {
    if (e.target === ok) return;
    if (!revealed) { clearTimeout(timer); revealAll(); try { SFX.select(); } catch {} }
  });
  wrap.appendChild(card);
  document.body.appendChild(wrap);
}

// ==== 勅命の語り: 報告 → (解放) → 勅命 を1つの連なった場面で語る (UI.playStoryChain) ====
// 状態の変わる順は従来と同じ: 報告のページを閉じる時に下賜 → (解放のページ) → 勅命のページを開く時に拝命 → 閉じる時に記録。
// 下賜・解放・新たな迷宮の知らせは語りを閉じた後にトーストでまとめて届け、街 (広場) に降り立つ。
function landOnHub() {
  if (G.state !== "town" || !G.town) return;
  const t = G.town;
  t.page = null; t.facility = null; t.sub = null; t.tab = "hub";
  altarSel = null;
}
function playMsqChain(pages, toasts = [], after = null) {
  UI.playStoryChain(pages, () => {
    landOnHub();
    if (after) after();
    renderTown();
    toasts.forEach((t, i) => setTimeout(() => showToast(t.text, t.opts), 160 + i * 320));
  });
}

// 次章の勅命のページ (拝命の状態変化はページを開く時)。公開範囲の先なら「封印の向こう」のページ
function acceptPages(toasts) {
  const ms = G.msq;
  if (ms.n + 1 > CONTENT_LIMIT) {
    return [{ title: `第${CONTENT_NEXT_LAYER}層 — 封印の向こう`, lines: sealedLines(), enter: () => { ms.state = "sealed"; delete ms.unsealed; autosave(true); } }];
  }
  const n = ms.n + 1;
  const dn = DUNGEONS[n - 1];
  // 公開範囲が広がって封が解けた: 勅命の前に、王が封の解けたことを告げる
  const unseal = ms.unsealed ? [{ title: `第${actOf(n)}層 — 封印の解かれた門`, lines: unsealLines(actOf(n)), kicker: "封印の解呪",
    leave: () => { delete ms.unsealed; } }] : [];
  return [...unseal, {
    title: `第${actOf(n)}層 「${ACTS[actOf(n) - 1].title}」`, lines: msqOrderLines(n), kicker: "勅命",
    enter: () => {
      ms.n = n;
      ms.state = "active";
      G.unlockedDungeons = Math.max(G.unlockedDungeons, ms.n);
      G.dungeonIdx = ms.n - 1;  // 新しい迷宮を選択しておく
      townBandOpen = null;      // 迷宮選択は新迷宮の層域を開いた状態に戻す
    },
    leave: () => {
      SFX.itemget(); buzz([0, 30, 60, 30]);
      log(`新たな勅命を拝命した。「${dn.name}」が地図に記された。`, "win");
      toasts.push({ text: `🗺 新たな迷宮「${dn.short}」出現`, opts: { tone: "info" } });
      autosave(true);
    },
  }];
}

// 踏破報告: 報酬を下賜し、(解放の節目なら機能解放のページを挟んで) 次章の勅命を自動で拝命する。第100章ならエピローグへ
function reportMainQuest() {
  const ms = G.msq;
  const n = ms.n;
  const r = msqReward(n);
  const rwText = [{ cur: "gold", n: r.gold }, { cur: "soul", n: r.soulPts }, ...(r.redSoul ? [{ cur: "red", n: r.redSoul }] : [])];
  const toasts = [];
  const pages = [{
    title: `第${actOf(n)}層 「${ACTS[actOf(n) - 1].title}」`, lines: msqReportLines(n), reward: rwText, kicker: "踏破の報告",
    leave: () => {
      G.gold += r.gold;
      G.soulPts += r.soulPts;
      G.redSoul += r.redSoul || 0;
      SFX.itemget(); buzz([0, 30, 60, 30]);
      log(`「${DUNGEONS[n - 1].name}」の踏破を報告した。`, "win");
      updateTopbar();
      toasts.push({ text: `受け取った 💰${r.gold} ✦${r.soulPts}` + (r.redSoul ? ` 🔴${r.redSoul}` : ""), opts: { tone: "gold" } });
      if (n < 100) autosave(true);
    },
  }];
  if (n >= 100) {
    pages.push({ title: "終章 — 最後の操霊師", lines: EPILOGUE, btnLabel: "物語を閉じる", kicker: "終章",
      enter: () => { G.msq = { n: 101, state: "end" }; flashScreen("#ffd84a"); } });
    playMsqChain(pages, toasts);
    return;
  }
  // 解放の節目 (D5/10/15/20) は、報告の直後に機能解放のページを挟む
  const us = unlockSceneFor(n);
  if (us) {
    pages.push({ title: us.title, lines: us.lines, kicker: "秘技の伝授",
      leave: () => { SFX.victory(); buzz([0, 40, 80, 40]); toasts.push({ text: "🔓 新たな技能を授かった", opts: { tone: "good" } }); } });
  }
  pages.push(...acceptPages(toasts)); // 踏破報告と同時に次の勅命を自動拝命
  // 解放の節目なら、語りを閉じた後にその要素の手ほどきを始める (済むまで迷宮には入れない)
  playMsqChain(pages, toasts, us ? () => { if (UI.tutorialAfterReport) UI.tutorialAfterReport(); } : null);
}

// 次章の勅命を拝命: 新たな迷宮が地図に現れる (公開範囲の先なら封印を告げる)
function acceptMainQuest() {
  const toasts = [];
  playMsqChain(acceptPages(toasts), toasts);
}

// 公開範囲の先 (準備中) を告げる王の言葉 (果ての層ごとの台詞は story.js SEAL_LINES)
function sealedLines() {
  return [...sealLines(CONTENT_NEXT_LAYER - 1), `── 第${CONTENT_NEXT_LAYER}層以降は現在制作中です。これまでの迷宮には何度でも挑めます。`];
}

// ---- 第0章「人業の生成」(チュートリアル勅命) ----
const TUT_INTRO = [
  "「よくぞ参った、新しき操霊師（ソウルマンサー）よ。…生身のまま、よくぞ辺境まで辿り着いた。」",
  "「だが言うておく。生身で迷宮に入ってはならぬ。深淵は、生きた魂から順に喰らう。」",
  "「ゆえに死者の魂を器に宿した『人業（ドール）』を遣わすのだ。迷宮は一体では渡れぬ。まずは四体、おのれの手で生み出すがよい。」",
  "「戦士・僧侶・盗賊・魔導士の魂を、そして赤い魂を百、くれてやろう。」",
  "「人業の館へゆけ。赤い魂で器を買い、四つの魂をひとつずつ宿し、名を与えよ。」",
  "「それがそなたの最初の勅命である。人業を四体揃えたら、戻って報告せよ。」",
];
const TUT_FINALE = [
  "「…ほう。四体揃って、良い面構えの人業たちではないか。初仕事にしては上出来よ。」",
  "「覚えておけ、操霊師。人業は道具ではない。死者に与えられた、二度目の生だ。」",
  "「粗末に扱えば、魂は器の中で錆びる。労り、鍛え、共に深淵を渡れ。」",
  "「これでそなたも一人前。次は、まことの勅命を授けよう。」",
];

// 第0章で仕立てる人業の数 (下賜する魂の数と同じ)。魂が足りない古いセーブでは魂の数まで
const TUT_DOLLS = 4;
function tutDollCount() { return allDolls().filter((d) => !d.isEmpty).length; }
function tutDollGoal() { return Math.max(1, Math.min(TUT_DOLLS, (G.souls || []).length)); }

// 着任の謁見: 戦士/僧侶/盗賊/魔導士の魂×4 + 赤い魂100 を下賜する (人業は館の保管庫で自分の手で仕立てる)
function grantTutorialGift() {
  const ms = G.msq;
  if (!ms || ms.granted) return;
  ms.granted = true;
  // 初期に持つ魂は戦士・僧侶・盗賊・魔導士の4つ。所持魂 一覧に追加する
  addSoulInstance("fighter");
  addSoulInstance("priest");
  addSoulInstance("thief");
  addSoulInstance("mage");
  G.redSoul += 100;
  codexSweepJobs();
  SFX.itemget(); buzz([0, 30, 60, 30]);
  log("戦士・僧侶・盗賊・魔導士の魂 ×4 ・ 🔴100 を拝受した。", "win");
  showToast("👑 戦士・僧侶・盗賊・魔導士の魂と 🔴100 を受け取った");
  autosave(true);
  renderTown();
}

// 着任の謁見の語り → 閉じたら下賜 (grantTutorialGift) して街へ降り立つ
function audienceTutorial() {
  UI.playStoryChain([{ title: "勅命 「人業の生成」", lines: TUT_INTRO, reward: [{ job: "fighter" }, { job: "priest" }, { job: "thief" }, { job: "mage" }, { cur: "red", n: 100 }], kicker: "着任の謁見" }], () => {
    landOnHub();
    grantTutorialGift();
  });
}

// 第0章の報告: 報酬を下賜し、そのまま第1章の勅命を拝命する (1つの連なった語り)
function reportTutorialQuest() {
  const toasts = [];
  const pages = [{
    title: "勅命「人業の生成」完遂", lines: TUT_FINALE, reward: [{ cur: "gold", n: 100 }, { cur: "soul", n: 30 }], kicker: "勅命の完遂",
    leave: () => {
      G.gold += 100;
      G.soulPts += 30;
      SFX.itemget(); buzz([0, 30, 60, 30]);
      log("最初の勅命「人業の生成」を果たした。", "win");
      toasts.push({ text: "受け取った 💰100 ✦30", opts: { tone: "gold" } });
      autosave(true);
    },
  }];
  pages.push(...acceptPages(toasts)); // チュートリアル完了後も自動で第1章を拝命
  playMsqChain(pages, toasts);
}

// 機能解放: 王に報告した踏破数に応じて段階的に解放される (層末の節目の報告で王から授かる)。
//   踏破しただけ (報告前) では開かない ― 解放のページ (UNLOCKS) を見てから使えるようにする
//   D5→魂融合 / D10→サブ魂1枠 / D15→酒場の噂・依頼 / D20→控えの結社(席1) /
//   D25→納品+1 / D30→結社席+1 / D35→納品+1 / D40→サブ魂2枠目 / D45→結社席+1 / D50→無限迷宮
function featureUnlocked(key) {
  const c = reportedDungeonCount();
  if (key === "fusion") return c >= 5;
  if (key === "rumor") return c >= 15;
  if (key === "order") return c >= 20;
  if (key === "infinite") return c >= 50 && CONTENT_LIMIT >= 50; // 奈落は第10層の公開まで閉じる
  return false;
}
// 解放済みのサブ魂 (宿し技) スロット数 (0/1/2)。MAX_SUBS が上限。2枠目は D40 で解放
function unlockedSubSlots() {
  const c = reportedDungeonCount();
  return Math.min(MAX_SUBS, c >= 40 ? 2 : c >= 10 ? 1 : 0);
}
// 控えの結社の席数 (0/1/2/3)。D20 で席1、D30 で席2、D45 で席3
function orderSeats() {
  const c = reportedDungeonCount();
  return c >= 45 ? 3 : c >= 30 ? 2 : c >= 20 ? 1 : 0;
}
// 結社の席に実際に着いている魂uid (編成外・ランク2以上・有効な加護持ち・席数上限でクリーン)。
// G.order.picks の順を尊重しつつ、無効になった指定 (編成入り/ランク低下/消失) は除外する。
function orderSeatedUids() {
  if (!featureUnlocked("order")) return [];
  const seats = orderSeats();
  if (seats <= 0) return [];
  const fielded = new Set();
  for (const dd of G.party) { if (dd.primary != null) fielded.add(dd.primary); for (const s of (dd.subs || [])) if (s) fielded.add(s.uid); }
  const picks = (G.order && Array.isArray(G.order.picks)) ? G.order.picks : [];
  const out = [];
  for (const uid of picks) {
    if (out.length >= seats) break;
    if (out.includes(uid) || fielded.has(uid)) continue;
    const s = soulByUid(uid);
    if (!s || soulRankOf(s) < 2) continue;
    const perk = ORDER_PERK[s.clsKey];
    if (!perk || !PASSIVES[perk]) continue;
    out.push(uid);
  }
  return out;
}
// 結社の席に魂を着ける/外す。空席が無ければ着席不可
function toggleOrderSeat(uid) {
  if (!G.order || !Array.isArray(G.order.picks)) G.order = { picks: [] };
  const picks = G.order.picks;
  const i = picks.indexOf(uid);
  if (i >= 0) { picks.splice(i, 1); SFX.select(); }
  else {
    if (orderSeatedUids().length >= orderSeats()) { log("結社の席が空いていない。誰かを外してから着席させよ。", "sys"); SFX.ng(); return; }
    picks.push(uid); SFX.select();
  }
  // 消失した魂のuidを掃除しておく
  G.order.picks = picks.filter((u) => soulByUid(u));
  autosave(); renderTown();
}
// 同時に受けられる納品依頼の件数。D15(酒場解放)=1 / D25=2 / D35=3
function deliveryQuestCap() {
  const c = reportedDungeonCount();
  return c >= 35 ? 3 : c >= 25 ? 2 : 1;
}

// 踏破済みの迷宮数 (メインストーリー基準: 第n章攻略中 = n-1 踏破)
function clearedDungeonCount() {
  const ms = G.msq;
  if (!ms) return Math.max(0, (G.unlockedDungeons || 1) - 1);
  if (ms.state === "active") return Math.max(0, ms.n - 1); // 第0章 (チュートリアル) 中は 0
  return Math.min(DUNGEONS.length, ms.n); // report/offer/end は第n章を踏破済み
}
// 王に報告済みの迷宮数 (機能解放の基準)。踏破して報告を待つ間 (report) は、その迷宮をまだ数えない
function reportedDungeonCount() {
  const ms = G.msq;
  if (ms && ms.state === "report") return Math.max(0, ms.n - 1);
  return clearedDungeonCount();
}

// ==== いまの目標 (街の勅書・王宮の勅命の札) ====
// その場で果たせる操作を添える: 謁見する / 仕立てる / 王に報告する / 拝命する / 出撃。物語を閉じた後は出さない
//   { key, text, sub, act, kind:"palace"|"party"|"gate", run() }
function departTo(idx) {
  if (idx != null && idx >= 0) { G.dungeonIdx = idx; townBandOpen = null; }
  if (UI.shell && UI.shell.openGate) UI.shell.openGate();
  else tryEnterDungeon();
}
// 第0章: 人業を仕立てる場所 (隊の「宿す魂をえらぶ」シート。無ければ旧来の館の保管庫)
function goMakeDoll() {
  // 人業の館へ入ってから仕立てる (初めてなら館の主イレーヌの挨拶の後)
  if (UI.enterMansion) return UI.enterMansion({ create: true });
  if (UI.openCreateDoll) return UI.openCreateDoll();
  // 隊 (WP-B) の「宿す魂をえらぶ」シートを街のまま直接ひらく (1タップ)
  if (typeof buyDoll === "function") return buyDoll();
  G.town.page = null; G.town.facility = "mansion"; G.town.sub = "manage";
  renderTown();
}
function objectiveInfo() {
  const ms = G.msq;
  if (!ms || ms.state === "end" || ms.n > 100) return null;
  // 解放された要素の手ほどき (済ませるまで迷宮には入れない)。踏破の報告が先
  const tut = ms.state !== "report" ? tutorialPending() : null;
  if (tut) return { key: "tut", text: tut.text, sub: `手ほどき「${tut.name}」・ 済ませるまで迷宮の門は閉ざされる`, act: tut.started ? "続ける" : "手ほどき", kind: "party", run: () => UI.tutorialResume && UI.tutorialResume() };
  if (contentSealed()) return { key: "sealed", text: "踏破した迷宮で人業を鍛え、装備を集める", sub: `第${CONTENT_NEXT_LAYER}層は準備中`, act: "出撃", kind: "gate", run: () => departTo(null) };
  if (ms.n === 0 && ms.state === "active") {
    if (!ms.granted) return { key: "audience", text: "王宮で王に謁見する", sub: "着任の挨拶", act: "謁見する", kind: "palace", run: audienceTutorial };
    const made = tutDollCount();
    if (made < tutDollGoal()) return { key: "makeDoll", text: "人業を4体、仕立てる", sub: made ? `いま ${made}/4体 ・ ${emptyDollCost() ? `次の器は赤い魂${emptyDollCost()}` : "残る魂を器に宿す (最初の3体は無料)"}` : "器を仕立て、魂をひとつずつ宿す (最初の3体は無料)", act: "仕立てる", kind: "party", run: goMakeDoll };
    return { key: "reportTut", text: "勅命「人業の生成」の完遂を報告する", act: "王に報告する", kind: "palace", run: reportTutorialQuest };
  }
  if (ms.state === "report") return { key: "report", text: `「${DUNGEONS[ms.n - 1].name}」の踏破を報告する`, act: "王に報告する", kind: "palace", run: reportMainQuest };
  if (ms.state === "offer") return { key: "offer", text: "新たな勅命を受ける", act: "拝命する", kind: "palace", run: acceptMainQuest };
  if (ms.state === "active" && ms.n >= 1 && DUNGEONS[ms.n - 1]) {
    return { key: "dive", text: `「${DUNGEONS[ms.n - 1].name}」を踏破する`, sub: ms.n % 5 === 0 ? "その主を討て" : null, act: "出撃", kind: "gate", run: () => departTo(ms.n - 1) };
  }
  return null;
}
// 旧来の形 { text, go() } (呼び出し元の互換)
function currentObjective() {
  const o = objectiveInfo();
  return o ? { text: o.text, go: o.run } : null;
}

// 王宮に用があるか (踏破の報告 or 次章の拝命 / 第0章の謁見・報告)
function palaceCallReady() {
  const ms = G.msq;
  if (!ms) return false;
  if (ms.n === 0 && ms.state === "active") return !ms.granted || tutDollCount() >= tutDollGoal();
  if (ms.n > CONTENT_LIMIT) return false; // 公開範囲の先の勅命は準備中
  return ms.state === "report" || ms.state === "offer";
}

// 王宮の勅命の札の中身: { kind, head, text, note, replay:bool }
function decreeInfo() {
  const ms = G.msq;
  if (!ms || ms.state === "end" || ms.n > 100) return { kind: "end", head: "物語は閉じられた", text: "「百の迷宮は解き放たれた。…余の葬列には、来ずともよいぞ。」", replay: true };
  if (contentSealed()) return { kind: "sealed", head: `第${CONTENT_NEXT_LAYER}層 — 封印の向こう (準備中)`, text: "次なる層へ続く大門の封は、いまだ固く閉ざされている。", note: "封が解けるまで、踏破した迷宮で人業を鍛え、装備を集めよう。", replay: true };
  if (ms.n === 0 && ms.state === "active") {
    if (!ms.granted) return { kind: "ch0", head: "着任", text: "玉座の老王が、新しき操霊師の到着を待っている。", replay: false };
    const made = tutDollCount(), goal = tutDollGoal();
    return { kind: "ch0", head: "勅命 「人業の生成」", text: "人業の館で器を仕立て (最初の3体は無料)、戦士・僧侶・盗賊・魔導士の魂をひとつずつ宿して人業を四体つくれ。", note: made >= goal ? "四体の人業が揃った。王に報告せよ。" : `四体が揃ったら、王に報告せよ。(いま ${made}/4体)`, replay: true };
  }
  const n = ms.state === "offer" ? Math.min(100, ms.n + 1) : ms.n;
  const head = `第${actOf(n)}層 「${ACTS[actOf(n) - 1].title}」`;
  if (ms.state === "report") return { kind: "report", head, text: `「${DUNGEONS[ms.n - 1].name}」を踏破した。`, note: "王に報告し、褒美を受け取れ。", replay: true };
  if (ms.state === "offer") return { kind: "offer", head, text: "新たな勅命が下されようとしている。", replay: false };
  const tdn = DUNGEONS[ms.n - 1];
  return { kind: "active", head, text: `「${tdn.name}」を踏破${ms.n % 5 === 0 ? "し、その主を討て。" : "せよ。"}`, note: "果たしたら王に報告せよ。", replay: true };
}
// 王の言葉を聞き直す (状態は変えない)
function replayDecree() {
  const ms = G.msq || {};
  if (!ms || ms.state === "end" || ms.n > 100) return UI.playStoryChain([{ title: "終章 — 最後の操霊師", lines: EPILOGUE, kicker: "終章" }]);
  if (contentSealed()) return UI.playStoryChain([{ title: `第${CONTENT_NEXT_LAYER}層 — 封印の向こう`, lines: sealedLines() }]);
  if (ms.n === 0) return UI.playStoryChain([{ title: "勅命 「人業の生成」", lines: TUT_INTRO, kicker: "着任の謁見" }]);
  return UI.playStoryChain([{ title: `第${actOf(ms.n)}層 「${ACTS[actOf(ms.n) - 1].title}」`, lines: msqOrderLines(ms.n), kicker: "勅命" }]);
}

// 王の記録 (戦績) と、その共有
function palaceRecords() {
  const s = G.stats;
  const pm = Math.floor((s.playMs || 0) / 60000);
  return [
    ["潜入", `${s.runs}回`], ["最深", `B${s.deepest}F`], ["撃破", `${s.kills}体`], ["主討伐", `${s.bossKills}体`],
    ["回収した魂", `${s.soulsFound}`], ["砕けた人業", `${s.deaths}`], ["踏破", `${clearedDungeonCount()}迷宮`],
    ["総時間", `${Math.floor(pm / 60)}時間${String(pm % 60).padStart(2, "0")}分`],
  ];
}
function sharePalaceRecord() {
  SFX.select();
  const ms = G.msq || {};
  const head = ms.state === "end" || ms.n > 100 ? "百の迷宮のすべてを制し、物語を閉じた。"
    : ms.n >= 1 ? `第${actOf(ms.n)}層「${ACTS[actOf(ms.n) - 1].title}」を探索中。` : "操霊師として着任した。";
  shareProgress(head);
}

// ==== 王宮の宝物庫 (収集品の奉納) ====
// 収集品 (slot:"misc") を奉納すると、ランク帯ごとではなく「奉納した総種類数」の節目で褒賞が下賜される。
// 各しきい値に到達するごとに一度だけ褒賞を受領できる (装備、節目によっては魂も)。
// soul: 0=装備のみ / 1=魂(通常抽選)+装備 / 2=魂(偉大な抽選)+装備
// 報酬の種別: cls=特定職の魂のみ / reward:"lrArmor"=未入手LR防具1点 / reward:"lrWeapon5"=未入手LR5武器1点
//             soul=従来の「魂(+装備)」(soul:1=通常魂 / soul:2=偉大な魂 + 節目相応の装備)
// ※25種以降は未定のため、従来の魂+装備をプレースホルダとして残してある。
const TREASURY_MILESTONES = [
  { n: 5, cls: "bishop" },   // 司教の魂
  { n: 10, cls: "samurai" },   // 侍の魂
  { n: 15, reward: "lrArmor" }, // LR防具1つ (未入手のもの)
  { n: 20, reward: "lrWeapon5" }, // LR5武器1つ (未入手のもの)
  { n: 30, soul: 1 },
  { n: 40, soul: 2 }, { n: 50, soul: 1 }, { n: 60, soul: 2 }, { n: 70, soul: 1 },
  { n: 80, soul: 2 }, { n: 90, soul: 2 }, { n: 100, soul: 2 },
];
// 防具とみなすスロット (LR防具褒賞の抽選対象。acc=装飾品は含めない)
const LR_ARMOR_SLOTS = ["body", "head", "feet", "hands", "shield"];
// 節目の褒賞ラベル (UI表示用)
function milestoneLabel(m) {
  if (m.cls) return ((SOUL_CLASSES[m.cls] || {}).label || m.cls) + "の魂";
  if (m.reward === "lrArmor") return "LR防具";
  if (m.reward === "lrWeapon5") return "LR5武器";
  return m.soul ? (m.soul >= 2 ? "魂(偉大)+装備" : "魂+装備") : "装備";
}

// 宝物庫の状態 (旧セーブには無いので遅延初期化)
function treasuryState() {
  if (!G.treasury || typeof G.treasury !== "object") G.treasury = { donated: {}, claimed: {} };
  if (!G.treasury.donated) G.treasury.donated = {};
  if (!G.treasury.claimed) G.treasury.claimed = {};
  if (!G.treasury.fresh) G.treasury.fresh = {}; // 奉納したばかりで、まだ台帳で見ていない種類 (台帳の札の「新」)
  return G.treasury;
}
// 奉納した収集品の総種類数 (ランク帯を問わない)
function totalDonatedKinds() {
  const ts = treasuryState();
  return Object.keys(ts.donated).filter((id) => ITEMS[id] && ITEMS[id].slot === "misc").length;
}

// 手持ち (編成+控え) の収集品 [{doll, item}]
function heldCollectibles() {
  const out = [];
  for (const d of allDolls()) for (const it of (d.items || [])) if (it.slot === "misc") out.push({ doll: d, item: it });
  return out;
}

// どこかに受領可能な褒賞があるか (王宮ハブのバッジ判定にも使う)
function treasuryRewardReady() {
  const ts = treasuryState();
  const c = totalDonatedKinds();
  for (const m of TREASURY_MILESTONES) if (c >= m.n && !ts.claimed["m" + m.n]) return true;
  return false;
}

// 収集品を1点奉納する (その品は消費される)。初めての種類は台帳に記し、
// すでに奉納済みの種類は売却と同じ金貨を宝物庫から受け取る。戻り値 = {kind:"new"|"dup", gold} / 失敗は null
function donateCollectible(doll, it) {
  const ts = treasuryState();
  const idx = doll.items.indexOf(it);
  if (idx < 0) return null;
  doll.items.splice(idx, 1);
  if (it.id && !ts.donated[it.id]) { ts.donated[it.id] = true; ts.fresh[it.id] = true; codexSeeItem(it.id); return { kind: "new", gold: 0 }; }
  const gold = sellPrice(it);
  G.gold += gold;
  return { kind: "dup", gold };
}

// 褒賞の装備を1点下賜する (所持枠が無ければゴールドに換える)。完了後 onClose を呼ぶ
function grantTreasuryItem(center, onClose) {
  const id = pickItemByLv(Math.min(200, Math.max(1, Math.round(center))));
  const who = G.party.find((p) => p.alive && p.items.length < MAX_ITEMS)
    || G.party.find((p) => p.items.length < MAX_ITEMS)
    || allDolls().find((d) => !d.isEmpty && d.items.length < MAX_ITEMS);
  if (who && ITEMS[id]) {
    const it = cloneItem(id);
    runGainItem(who, it); codexSeeItem(id, it);
    log(`宝物庫の褒賞として ${itemName(it)} を賜った。(${who.name})`, "win");
    showItemGet(it, who, onClose);
    return;
  }
  // 渡せない: 売値相当のゴールドにフォールバック
  const it = ITEMS[id] ? cloneItem(id) : null;
  const g = it ? Math.max(1, Math.floor((it.price || 50))) : 100;
  G.gold += g; updateTopbar();
  log(`所持枠が満杯のため、宝物庫の褒賞は ${g} ゴールドに換えられた。`, "win");
  showEvent({
    sprite: ICONS.gold, title: "褒賞を換金した", accent: "#e8c24a", banner: "✦ 宝物庫の褒賞 ✦",
    lines: [`持ちきれぬため、褒賞は ${g} ゴールドに換えられた。`], onClose: onClose,
  });
}

// 褒賞のLR(専用装備)を1点下賜する。filter で武器/防具などを絞り、未入手(G.lrOwned外)から抽選する。
// LRは未鑑定で渡る (商店でのみ鑑定可)。全部入手済みなら通常の装備褒賞にフォールバック。
function grantLR(filter, center, onClose) {
  if (!G.lrOwned) G.lrOwned = {};
  const pool = exclIds().filter((id) => {
    const it = ITEMS[id];
    return it && it.lr && !G.lrOwned[id] && filter(it);
  });
  if (!pool.length) { grantTreasuryItem(center, onClose); return; } // 既に全種入手済み
  const id = pool[rand(pool.length)];
  const it = cloneItem(id);
  it.unidentified = true; // LRは未鑑定で手に入る
  const fj = it.forJob;
  const who = (fj && G.party.find((m) => m.alive && m.clsKey === fj && m.items.length < MAX_ITEMS))
    || (fj && G.party.find((m) => m.clsKey === fj && m.items.length < MAX_ITEMS))
    || G.party.find((m) => m.alive && m.items.length < MAX_ITEMS)
    || G.party.find((m) => m.items.length < MAX_ITEMS)
    || allDolls().find((d) => !d.isEmpty && d.items.length < MAX_ITEMS);
  if (!who) { grantTreasuryItem(center, onClose); return; } // 所持枠が無ければ通常褒賞へ
  runGainItem(who, it); codexSeeItem(id, it);
  G.lrOwned[id] = true; // 1点もの: 以後ドロップしない
  flashScreen("#ff5fae"); SFX.victory(); buzz([0, 60, 50, 60, 50, 60, 240]);
  const nm = itemName(it); // 未鑑定なら伏せ名
  log(`★ 宝物庫の褒賞として LR${it.lr} 専用装備(未鑑定)「${nm}」を賜った。(${who.name})`, "win");
  setTimeout(() => showToast(`★ ${nm}`), 200);
  showItemGet(it, who, onClose);
}

// 褒賞を受領する。総種類数が節目 n に達していれば一度だけ。
function claimTreasury(n) {
  const ts = treasuryState();
  const m = TREASURY_MILESTONES.find((x) => x.n === n);
  if (!m) { SFX.ng(); return; }
  const key = "m" + n;
  if (ts.claimed[key] || totalDonatedKinds() < n) { SFX.ng(); return; }
  ts.claimed[key] = true;
  const back = () => { autosave(); if (G.state === "town") renderTown(); };
  const center = Math.min(200, Math.max(1, n * 2)); // 節目が深いほど高位の装備
  const reason = `収集品を ${n} 種 宝物庫に納めた褒賞だ。`;
  if (m.cls) {
    acquireSoul(m.cls, reason, back); // 特定職の魂のみ
  } else if (m.reward === "lrArmor") {
    grantLR((it) => LR_ARMOR_SLOTS.includes(it.slot), center, back);
  } else if (m.reward === "lrWeapon5") {
    grantLR((it) => it.slot === "weapon" && it.lr === 5, center, back);
  } else if (m.soul) {
    const clsKey = m.soul >= 2 ? rollGreatJobClass() : rollJobClass();
    acquireSoul(clsKey, reason, () => grantTreasuryItem(center, back));
  } else {
    grantTreasuryItem(center, back);
  }
}

// 受領できる最初の褒賞を受け取る (街の「次にすべきこと」・宝物庫の褒賞の段)。無ければ false
function claimNextTreasury() {
  const ts = treasuryState();
  const c = totalDonatedKinds();
  const m = TREASURY_MILESTONES.find((x) => c >= x.n && !ts.claimed["m" + x.n]);
  if (!m) return false;
  claimTreasury(m.n);
  return true;
}

// ---- 図鑑 (王宮書庫) ----
// モンスター図鑑の記録単位: { kills, normal, rare, dungeons:{idx:true} }
// 記録されるのは「倒した時」のみ。落としたドロップ(通常/レア)も実際に落として初めて開示。
function codexMonEntry(key) {
  let e = G.codex.mon[key];
  if (e == null) codexFresh().mon[key] = 1; // 初めての記録は新着
  if (!e || typeof e !== "object") {
    e = { kills: e === true ? 1 : 0, normal: false, rare: false, dungeons: {} };
    G.codex.mon[key] = e;
  }
  if (!e.dungeons) e.dungeons = {};
  return e;
}
// 敵 1体の討伐を図鑑に記録する (combat.js の setOnEnemyKilled から、倒したその瞬間に呼ばれる)。
// 個体ごとに一度だけ。出来事の影 (ev_*) は載せない
function codexKillNow(e) {
  if (!e || e._codexKill || String(e.key || "").startsWith("ev_")) return;
  e._codexKill = true;
  recordMonsterKill(e.key, G.dungeonIdx);
}
setOnEnemyKilled(codexKillNow);
function recordMonsterKill(key, dungeonIdx) {
  if (!key) return;
  const e = codexMonEntry(key);
  e.kills++;
  if (dungeonIdx != null) e.dungeons[dungeonIdx] = true;
}
// 勝利時の汎用戦利品抽選 (固有ドロップ廃止に伴う置換)。通常30% / レア4%。
// 中身は迷宮の lootLv 帯から引く (レアは一段深い帯)。実物は勝利後の宝箱から取り出す。
function rollGenericDrop() {
  const apLv = partyPassiveLv("appraise"); // 目利き: ドロップ率 +15/25/40%
  const ap = apLv >= 3 ? 1.40 : apLv >= 2 ? 1.25 : apLv >= 1 ? 1.15 : 1;
  // 特別階 (盗賊の洞察): レアドロップ率が上がる
  if (Math.random() < Math.max(sfNum("rareDropRate", 0.04 * ap), mutNum("rareDropRate", 0))) {
    const id = pickLoot({ rare: true });
    if (ITEMS[id]) { const it = cloneItem(id); if (it) return { key: "loot", name: "戦利品", id, item: it, rare: true }; }
  }
  if (Math.random() < 0.30 * ap) {
    const id = pickLoot();
    if (ITEMS[id]) { const it = cloneItem(id); if (it) return { key: "loot", name: "戦利品", id, item: it, rare: false }; }
  }
  return null;
}
// it = 手に入れた品の実体 (あれば)。未鑑定の品は図鑑には載るが「正体を知った品」には数えない
function codexSeeItem(id, it) {
  if (!id) return;
  if (!G.codex.item[id]) codexFresh().item[id] = 1; // 初めての記録は新着
  G.codex.item[id] = true;
  if (!it || !it.unidentified) codexKnowItem(id);
}
// 正体を知った品 (G.codex.known)。鑑定で初めて正体を知った品に「初ゲット！」を出すための記録。
// 初めて知ったなら true
function codexKnowItem(id) {
  if (!id) return false;
  const k = G.codex.known || (G.codex.known = {});
  if (k[id]) return false;
  k[id] = true;
  return true;
}
// 鑑定して正体を明かす (商会・鑑定の心得・出来事の共通)。正体を初めて知った品なら「初ゲット！」の印をつけて true。
// 印はこの起動の間だけ (セーブしない)。UI は isFirstGet(it) で読む
const firstGets = new WeakSet();
function revealIdentity(it) {
  if (!it) return false;
  const first = !!it.id && !itemKnown(it.id); // 明かす前に聞く (明かした後は自分自身が「知っている品」になる)
  it.unidentified = false;
  it.idHardFail = false;
  codexKnowItem(it.id);
  if (first) firstGets.add(it);
  return first;
}
function isFirstGet(it) { return !!it && typeof it === "object" && firstGets.has(it); }
// その品の正体を既に知っているか (記録に無くても、正体の知れた同じ品を持っていれば知っている)
function itemKnown(id) {
  if (!id) return false;
  if (G.codex.known && G.codex.known[id]) return true;
  return heldItems().some((it) => it.id === id && !it.unidentified);
}
// 全人業 (隊と控え) の持ち物と装備
function heldItems() {
  const out = [];
  for (const d of [...(G.party || []), ...(G.reserve || [])]) {
    if (!d) continue;
    for (const it of (d.items || [])) if (it) out.push(it);
    for (const it of Object.values(d.equip || {})) if (it) out.push(it);
  }
  return out;
}
// 図鑑の新着: { mon:{key:1}, item:{id:1}, job:{"職:ランク":1} }。王宮の図鑑で詳細を開くと消える (src/ui/palace.js)
function codexFresh() {
  const c = G.codex;
  if (!c.fresh || typeof c.fresh !== "object") c.fresh = {};
  for (const k of ["mon", "item", "job"]) if (!c.fresh[k] || typeof c.fresh[k] !== "object") c.fresh[k] = {};
  return c.fresh;
}

// ---- 職業図鑑の記録 ----
// 魂を吸収した時点で「発見」とし、到達ランクと魂レベルの最高値を記録する。
// 図鑑はランク別に称号を列挙し、スキル表は到達Lvまでの技だけ内容を開示する。
function codexJobSee(clsKey, count, level) {
  if (!G.codex || !G.codex.job) return;
  const rank = soulRankFromCount(clsKey, count || 0);
  if (rank < 1) return;
  const cap = soulLevelCap(clsKey, count || 0);
  const lv = Math.min(cap, level || 1);
  const e = G.codex.job[clsKey];
  const prevLv = e && typeof e === "object" ? (e.lv || 0) : 0;
  const prevRank = e && typeof e === "object" ? (e.rank || 0) : 0;
  G.codex.job[clsKey] = { lv: Math.max(prevLv, lv), rank: Math.max(prevRank, rank) };
  for (let r = prevRank + 1; r <= rank; r++) codexFresh().job[clsKey + ":" + r] = 1; // 新しく到達した位階の札は新着
}
// 所持魂一覧を走査して職業図鑑を更新する (オートセーブのたびに全走査)
function codexSweepJobs() {
  if (!G.codex || !G.codex.job) return;
  for (const s of (G.souls || [])) codexJobSee(s.clsKey, s.count, s.level);
}

function showCodexItemDetail(id) { if (UI.codexItemSheet) UI.codexItemSheet(id); }
function showCodexMonDetail(key) { if (UI.codexMonSheet) UI.codexMonSheet(key); }

// ダンジョンに出現しうるモンスターのキー一覧 (pool + deepPool + boss、重複排除)
function dungeonRoster(dn) {
  const seen = new Set();
  const out = [];
  for (const k of [...(dn.pool || []), ...(dn.deepPool || []), dn.boss]) {
    if (k && MONSTERS[k] && !seen.has(k)) { seen.add(k); out.push(k); }
  }
  return out;
}

// 特定のダンジョンに属さない魔物 (宝箱に潜む類・出来事にだけ現れる類) を集める「その他」タブの面々
const CODEX_OTHER = ["mimic", "master_mimic", "bs_cagewarden"];

// 職業図鑑: 詳細のシート (解説/活用/発現条件/装備適性/パッシブ/スキル表)。rank = 図鑑で選んだ位階。
// heading を渡すと最上部に「○○は●●になった！」等の見出しを大きく出す (職業の発現・変化の演出から呼ぶ)
function showCodexJobDetail(key, rank, heading) { if (UI.codexJobSheet) UI.codexJobSheet(key, rank, heading); }

// ---- 宿屋: 全回復 ----
function innCost() { return G.party.length * 12 + G.maxFloorReached * 6; }

// ---- 砕けた魂の修復: 砕けた人業は街へ戻っても自然には戻らない ----
// 人業の館 (隊) で砕けた人業を選び、金貨を払って修復するとHP/MP満タンで立ち上がる。
// (全滅で迷宮に残された器は、まず連れ帰りを待つ ― 下の「連れ帰り」)
// 費用 = ランク (1:10 / 2:20 / 3:40 / 4:80 / 5:160) × 魂レベル × レア度 (コモン1 / レア2 / エピック3 / レジェンド4)
const REPAIR_RANK_GOLD = [10, 10, 20, 40, 80, 160]; // [0] は魂の宿らぬ器の保険 (ランク1扱い)
const REPAIR_RARITY_MUL = { common: 1, rare: 2, epic: 3, legend: 4 };
function repairCostOf(d) {
  if (!d || d.alive || awaitingRescue(d)) return 0;
  const rank = Math.max(1, Math.min(5, d.jobRank || 1));
  const lv = Math.max(1, d.jobLv || 1);
  const cls = d.clsKey ? SOUL_CLASSES[d.clsKey] : null;
  const mul = REPAIR_RARITY_MUL[cls ? cls.rarity : "common"] || 1;
  return REPAIR_RANK_GOLD[rank] * lv * mul;
}
function repairCostAll() {
  return allDolls().reduce((a, d) => a + (d.isDoll && !d.alive ? repairCostOf(d) : 0), 0);
}

// ---- 連れ帰り (全滅の時だけ): 迷宮に残された器は、ほかの冒険者が時を経て街へ運ぶ ----
// 連れ帰りを待つ間 (d.reviveAt あり) は館で修復できない。届いても砕けたままで、修復は金貨で行う。
// 連れ帰り時間: 砕けた階層が深いほど長い。1〜5階=5分 / 6〜10階=10分 / … 5階ごとに+5分、最大120分
function rescueDurationMs(floor) {
  const minutes = Math.min(120, Math.ceil((floor || 1) / 5) * 5);
  return minutes * 60 * 1000;
}

// 迷宮を探索中の隊にいる人業か (連れ帰りの時は、街へ戻るまで数えない)
function awayInDungeon(d) {
  return G.state !== "town" && G.party.includes(d);
}
// 迷宮から連れ帰られるのを待っている人業か (館で修復できない)
function awaitingRescue(d) {
  return !!(d && d.isDoll && !d.alive && d.reviveAt);
}

// 全滅して街へ戻った時に、砕けた人業の連れ帰りタイマーを動かし始める (器は全滅した階に残る)
function startRescueTimers(dolls) {
  const now = Date.now();
  for (const d of dolls) {
    if (!d || !d.isDoll || d.alive || d.reviveAt) continue;
    const floor = G.floor || d.diedFloor || 1;
    d.diedFloor = floor;
    d.reviveAt = now + rescueDurationMs(floor);
  }
}
// 生き返った人業に残った連れ帰りの印を消す (呪文で蘇った時など)
function setReviveTimers() {
  for (const d of allDolls()) {
    if (d.isDoll && d.alive) { d.reviveAt = null; d.diedFloor = null; }
  }
}

// 残り時間の表示 "1:23:45" / "23:45"
function fmtRemain(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const mm = String(m).padStart(2, "0"), ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

// 連れ帰りタイマーの「生きた」表示要素を作る。class js-revt + dataset を持ち、
// 下の 1秒ごとのティッカーが残り時間をリアルタイムに描き替える (全画面再描画はしない)。
function reviveTimerEl(tag, cls, prefix, d) {
  const at = (d.reviveAt || Date.now());
  const node = el(tag, cls, prefix + fmtRemain(Math.max(0, at - Date.now())));
  node.classList.add("js-revt");
  node.dataset.reviveAt = String(at);
  node.dataset.prefix = prefix;
  return node;
}

// 連れ帰りタイマーを1秒ごとに更新 (DOMのテキストだけ書き替え、秒数が1秒ずつ減る)
setInterval(() => {
  const now = Date.now();
  for (const node of document.querySelectorAll(".js-revt")) {
    const at = Number(node.dataset.reviveAt) || now;
    node.textContent = (node.dataset.prefix || "") + fmtRemain(Math.max(0, at - now));
  }
}, 1000);

// 連れ帰り完了: 器が街へ届く (砕けたまま。館で修復を待つ)
function rescueArrive(d, byRedSoul = false) {
  d.reviveAt = null; d.diedFloor = null;
  SFX.select(); buzz([0, 30, 40, 30]);
  log(`${d.name} が街へ連れ帰られた。${byRedSoul ? "(赤い魂の力)" : ""} 人業の館で修復できる。`, "sys");
  showToast(`${d.name} が連れ帰られた ― 館で修復を`, { tone: "info" });
}

// Red Soul で連れ帰り時間を 20分短縮 (1消費)。残り20分以下なら即帰還
const RESCUE_SHORTEN_MS = 20 * 60 * 1000;
// いますぐ連れ帰るのに要る赤い魂の数 (20分ごとに1。押す回数ぶんと同じ値段)
function hastenCostOf(d) {
  if (!awaitingRescue(d)) return 0;
  return Math.max(1, Math.ceil((d.reviveAt - Date.now()) / RESCUE_SHORTEN_MS));
}
function tryHastenRescue(d) {
  if (!awaitingRescue(d)) return;
  if (G.redSoul < 1) { log("Red Soul が足りない。", "sys"); SFX.ng(); showToast("赤い魂が足りない", { tone: "bad" }); return; }
  G.redSoul -= 1;
  d.reviveAt -= RESCUE_SHORTEN_MS;
  if (d.reviveAt <= Date.now()) rescueArrive(d, true);
  else { SFX.select(); buzz(15); log(`${d.name} の連れ帰りを早めた。`, "sys"); }
  updateTopbar();
  if (G.statusOpen) renderStatus();
  if (G.state === "town") renderTown();
  renderParty();
}

// 連れ帰りタイマーの監視 (5秒ごと)。満了した器を街へ届ける
setInterval(() => {
  const now = Date.now();
  let arrived = false;
  for (const d of allDolls()) {
    if (awaitingRescue(d) && now >= d.reviveAt && !awayInDungeon(d)) { rescueArrive(d); arrived = true; }
  }
  if (arrived) {
    if (G.statusOpen) renderStatus();
    if (G.state === "town") renderTown();
    renderParty();
  }
}, 5000);

// 全滅時に赤い魂で全てを守った時だけ、砕けた人業をHP1で生還させる (自然には戻らない)
function reviveAllAtHp1() {
  for (const d of allDolls()) {
    if (d.isDoll && !d.alive) {
      d.alive = true;
      d.hp = 1;
      d.ailment = null;
      d.reviveAt = null; d.diedFloor = null;
      d._dead = false;
      log(`${d.name} はHP1で生還した。`, "win");
    }
  }
}

// 砕けた魂を修復する (街の中のみ・金貨を払う)。HP/MP満タンで立ち上がる
function repairDoll(d) {
  if (!d || !d.isDoll || d.alive) return { ok: false, reason: "dead" };
  if (awaitingRescue(d)) { showToast(`${d.name} はまだ迷宮から連れ帰られていない`, { tone: "bad" }); SFX.ng(); return { ok: false, reason: "rescue" }; }
  if (G.state !== "town") { showToast("修復は街の人業の館でしかできない", { tone: "bad" }); SFX.ng(); return { ok: false, reason: "town" }; }
  const cost = repairCostOf(d);
  if (G.gold < cost) { log("金貨が足りない。", "sys"); SFX.ng(); showToast(`金貨が足りない (💰${cost})`, { tone: "bad" }); return { ok: false, reason: "gold", cost }; }
  G.gold -= cost;
  d.alive = true;
  d.hp = d.maxhp;
  d.mp = d.maxmp;
  d.ailment = null;
  d.reviveAt = null; d.diedFloor = null;
  d._dead = false;
  SFX.levelup(); buzz([0, 30, 40, 30]);
  log(`${d.name} の砕けた魂を修復した。(💰${cost})`, "win");
  showToast(`${d.name} が立ち上がった (💰${cost})`, { tone: "good" });
  updateTopbar();
  if (G.statusOpen) renderStatus();
  if (G.state === "town") renderTown();
  renderParty();
  return { ok: true, cost };
}

// ---- 赤い魂の祠: Red Soul の入手 (広告/課金) ----
let _adCooldownUntil = 0;
// 広告動画 (シミュレート): +🔴10・30秒のクールダウン
const AD_RED = 10;
function adCooldownLeft() { return Math.max(0, _adCooldownUntil - Date.now()); }
function watchShrineAd() {
  if (adCooldownLeft() > 0) return false;
  log("広告動画を視聴した…", "sys");
  G.redSoul += AD_RED;
  _adCooldownUntil = Date.now() + 30000;
  SFX.itemget(); buzz([0, 30, 60, 30]);
  showToast(`🔴 Red Soul を ${AD_RED} 授かった`, { tone: "good" });
  renderTown();
  return true;
}
// 課金 (プレースホルダ): 実課金は未対応。デモとして付与
const RED_PACKS = [{ n: 100, label: "赤い魂 100" }, { n: 500, label: "赤い魂 500", tag: "お得" }, { n: 1200, label: "赤い魂 1200", tag: "特盛" }];
function buyRedPack(n) {
  G.redSoul += n;
  SFX.itemget();
  log(`(デモ) Red Soul を ${n} 入手した。`, "win");
  showToast(`🔴 Red Soul +${n}`, { tone: "good" });
  renderTown();
}

// ---- 商店: 装備・道具の売買 ----
// 画面 (売る・鑑定 / 買う) は src/ui/shop.js が商会タブとして描く。ここには売買・鑑定の単体操作と値段だけを置く
// 商店の初期在庫 (個数つき)。ダンジョン産を売ると在庫に積まれ、買い直せる (ボルタック方式)
const SHOP_INIT_STOCK = {
  herb: 5, antidote: 5, manaDrop: 3,
  dagger: 2, shortSword: 1, magicStaff: 1, warHammer: 1,
  woodShield: 1, leatherArmor: 1, robe: 1, cap: 2, leatherBoots: 2, leatherGloves: 2,
};
const sellPrice = (it) => Math.max(1, Math.floor((it.price || 10) / 2));
// 控えの結社 値切り (bargain): 店の買値・鑑定費を -8/15/25% 割引
function bargainMul() { const lv = partyPassiveLv("bargain"); return lv >= 3 ? 0.75 : lv >= 2 ? 0.85 : lv >= 1 ? 0.92 : 1; }
const buyPrice = (it) => Math.max(1, Math.round((it && it.price || 30) * bargainMul()));
// 鑑定料: 売値 × レア度の倍率 (コモン0.5 / アンコモン0.75 / レア1 / スーパーレア1.5 / レジェンドレア4)。
// 深層の職業専用LR (tier5以上) は従来どおり約20倍。LRは商店でのみ鑑定できる。値切りで割引
const APPRAISE_MUL = { c: 0.5, uc: 0.75, r: 1, sr: 1.5, lr: 4 };
const appraiseCost = (it) => {
  if (!it) return 1;
  const mul = it.lr >= 5 ? 20 : (APPRAISE_MUL[rarityKey(it)] || 1);
  return Math.max(1, Math.round(sellPrice(it) * mul * bargainMul()));
};

// 商店で鑑定する: 鑑定料を払い、必ず正体を明かす
function shopIdentify(owner, it) {
  const cost = appraiseCost(it);
  if (G.gold < cost) { log("お金が足りない。", "sys"); SFX.ng(); return false; }
  G.gold -= cost;
  const first = revealIdentity(it);
  SFX.itemget(); buzz(15);
  log(`鑑定料 💰${cost} を払った。${it.name} と判明した！${first ? " (初ゲット！)" : ""}`, "win");
  showToast(`${first ? "初ゲット！ " : ""}${it.name} と判明した (💰${cost})`, first ? { tone: "good" } : undefined);
  renderTown();
  return true;
}

// 売却時に注意を促すべき品か判定し、警告文を返す (未奉納収集品 / LR専用装備)
function sellWarnings(it) {
  const out = [];
  if (it.slot === "misc" && it.id && !treasuryState().donated[it.id]) {
    out.push("⚠ まだ宝物庫に奉納していない収集品です。売ると奉納できなくなり、図鑑の褒賞を取り逃します。");
  }
  if (rarityKey(it) === "lr") {
    out.push("⚠ レジェンドレアです。二度と手に入らない1点ものです。本当に売りますか？");
  } else if (rarityKey(it) === "sr") {
    out.push("⚠ スーパーレアです。めったに手に入らない逸品です。本当に売りますか？");
  }
  return out;
}

function sellItem(owner, it, price) {
  const idx = owner.items.indexOf(it);
  if (idx < 0) return false;
  // 未鑑定品は正体不明のため二束三文 (0G) で引き取られ、商店にも並ばない
  if (it.unidentified) price = 0;
  owner.items.splice(idx, 1);
  G.gold += price;
  // 在庫に積む (ボルタック方式)。未鑑定品は並ばない
  if (it.id && !it.unidentified) G.shopStock[it.id] = (G.shopStock[it.id] || 0) + 1;
  codexSeeItem(it.id, it);
  SFX.select(); buzz(10);
  const shown = itemName(it);
  log(`${shown} を売った (+💰${price})。${it.unidentified ? "" : "商店に並んだ。"}`, "win");
  showToast(`💰+${price} ${shown} を売却`);
  renderTown();
  return true;
}

// 棚の品を買う。who = 買った品を持たせる人業 (省略時は袋に空きのある最初の生きている隊員)。
// 値段・在庫・所持枠の判定は従来と同じ。買った品 (の写し) を返す。買えなければ null
function buyItem(id, price, who) {
  price = buyPrice(ITEMS[id]);
  if (G.gold < price) { log("お金が足りない。", "sys"); SFX.ng(); return null; }
  if ((G.shopStock[id] || 0) <= 0) { log("在庫切れだ。", "sys"); SFX.ng(); return null; }
  if (!who) who = G.party.find((m) => m.alive && m.items.length < MAX_ITEMS) || null;
  if (!who || !who.alive) { log("取引する人業を選ぼう。", "sys"); SFX.ng(); return null; }
  if (who.items.length >= MAX_ITEMS) { log(`${who.name} の所持品がいっぱいだ。`, "sys"); SFX.ng(); return null; }
  const it = cloneItem(id);
  if (!it) return null;
  G.gold -= price;
  G.shopStock[id]--;
  who.items.push(it);
  codexSeeItem(id);
  SFX.itemget(); buzz(10);
  log(`${it.name} を購入した (${who.name})。`, "win");
  renderTown();
  return it;
}

// ---- 街 ⇄ 迷宮 の出入り ----
// 出撃は「出撃シート」(src/ui/departure.js) に集めた: 門の選択・隊の備え (その場で直す)・迷宮の異変・初回の注意。
// 旧来の入口 (広場の「迷宮へ潜る」・目標など) もこのシートを開く
function tryEnterDungeon() {
  if (G.unlockedDungeons < 1) { log("王の勅命を受けるまで、迷宮には入れない。", "sys"); showToast("王の勅命を受けるまで、迷宮の在処は明かされない", { tone: "info" }); return; }
  UI.openDeparture();
}
// 踏破の報告が済んでいないか (済むまで迷宮には入れない)。公開範囲の先 (準備中) の報告は対象外
function reportPending() {
  return !!G.msq && G.msq.state === "report" && !contentSealed() && !!DUNGEONS[G.msq.n - 1];
}
// 迷宮へ向かおうとした時、報告が先なら引き止める (王宮へ案内するシート)。引き止めたら true
function blockForReport() {
  if (!reportPending()) return false;
  SFX.ng(); buzz([0, 30, 40, 30]);
  kitConfirm({
    banner: "勅 命", danger: false,
    title: "王に報告するのが先だ",
    lines: [`「${DUNGEONS[G.msq.n - 1].name}」の踏破を、まだ王に報告していない。`, "報告を済ませるまで、迷宮の門は開かれない。"],
    okLabel: "王に報告する", cancelLabel: "あとで",
  }).then((ok) => { if (ok && reportPending()) reportMainQuest(); });
  return true;
}
// 解放された要素の手ほどきが済んでいないか (src/ui/tutorial.js)。{ key, name, text } / null
function tutorialPending() { return UI.tutorialPending ? UI.tutorialPending() : null; }
// 迷宮へ向かおうとした時、手ほどきが先なら引き止める (手ほどきへ案内するシート)。引き止めたら true
function blockForTutorial() {
  const t = tutorialPending();
  if (!t) return false;
  SFX.ng(); buzz([0, 30, 40, 30]);
  kitConfirm({
    banner: "手ほどき", danger: false,
    title: "手ほどきを終えるのが先だ",
    lines: [`新たに授かった「${t.name}」の手ほどきが、まだ済んでいない。`, "手ほどきを終えるまで、迷宮の門は開かれない。"],
    okLabel: t.started ? "手ほどきを続ける" : "手ほどきを始める", cancelLabel: "あとで",
  }).then((ok) => { if (ok && UI.tutorialResume) UI.tutorialResume(); });
  return true;
}

// 門をくぐる (出撃シートの決め手)。idx = 迷宮の番号 (0始まり) / accept = 迷宮の異変ごと潜るか。
// 闇に溶けて (sceneTransition) その底で潜入する。潜れない時は理由を返す
function departNow({ idx = G.dungeonIdx, accept = false } = {}) {
  if (G.state !== "town") return { ok: false, reason: "state" };
  if (G.unlockedDungeons < 1) return { ok: false, reason: "locked" };
  if (blockForReport()) return { ok: false, reason: "report" };
  if (blockForTutorial()) return { ok: false, reason: "tutorial" };
  const open = Math.min(G.unlockedDungeons, CONTENT_LIMIT);
  if (idx < 0 || idx >= open) { showToast("その先は準備中だ", { tone: "info" }); return { ok: false, reason: "sealed" }; }
  if (!G.party.some((p) => p.alive)) { log("動ける人業がいない。", "sys"); SFX.ng(); return { ok: false, reason: "party" }; }
  G.dungeonIdx = idx;
  const mut = townMutatorFor(idx);
  const mutId = accept && mut ? mut.id : null;
  G.dungeonBriefed = true; // 初回の注意は出撃シートの中で済ませた
  G.prompt = true;
  uiDungeonHud.sceneTransition(() => { G.prompt = false; enterDungeon(mutId); });
  return { ok: true };
}

// §7 M1 迷宮の異変: 街に戻るたび、出撃シートを初めて開いた時に迷宮ごとに一度だけ抽選する (D3以降・45%・同じ候補)。
// シートを開き直しても引き直さない (G._townMutator は街にいる間だけの一時記録。潜入・帰還で消える)
function townMutatorFor(idx) {
  if (!G._townMutator) G._townMutator = {};
  if (!(idx in G._townMutator)) {
    let id = null;
    if (idx >= 2 && Math.random() < 0.45) {
      const cfg = DUNGEONS[idx];
      const pool = MUTATORS.filter((m) => !m.cond || m.cond(cfg));
      const cand = pool[rand(pool.length)];
      if (cand) id = cand.id;
    }
    G._townMutator[idx] = id;
  }
  const id = G._townMutator[idx];
  const m = id ? MUTATORS.find((x) => x.id === id) : null;
  return m ? { id: m.id, name: m.name, accent: m.accent, risk: m.risk, gain: m.gain } : null;
}

// 出立前の点検項目 (出撃シートの「隊の備え」)。直せるものには直し方を添える
function preDiveIssues() {
  const lines = [];
  const res = { lines, dolls: false, gear: false, rest: false, items: [] };
  // 砕けた人業 (全滅で残された器は連れ帰りを待ち、街にある器は館で修復する)
  const dead = G.party.filter((d) => d.isDoll && !d.alive);
  if (dead.length) {
    const wait = dead.filter(awaitingRescue), here = dead.filter((d) => !awaitingRescue(d));
    if (here.length) {
      const cost = here.reduce((a, d) => a + repairCostOf(d), 0);
      res.items.push({ kind: "dead", tone: "bad", text: `${namesShort(here)} は砕けたまま`, fix: { act: "repair", label: "館で修復", cost: { kind: "gold", n: cost }, uid: here[0].uid } });
    }
    if (wait.length) {
      const cost = wait.reduce((a, d) => a + hastenCostOf(d), 0);
      res.items.push({ kind: "rescue", tone: "bad", text: `${namesShort(wait)} は連れ帰りを待っている`, fix: { act: "hasten", label: "今すぐ連れ帰る", cost: { kind: "red", n: cost }, ok: G.redSoul >= 1 } });
    }
  }
  // 仲間が少ない (宿せる魂と器の余裕がある時だけ)
  const free = G.souls.filter((s) => !soulWorn(s.uid)).length;
  if (G.party.length < 3 && free > 0 && allDolls().length < 100 && G.redSoul >= emptyDollCost()) {
    const cost = emptyDollCost();
    lines.push(`■ 編成が ${G.party.length}体 だけだ。魔物は群れで来る。宿せる魂が ${free}個 ある (次の器 ${cost ? `🔴${cost}` : "無料"})。`);
    res.dolls = true;
    res.items.push({ kind: "few", tone: "warn", text: `パーティが ${G.party.length}体 だけ ・ 宿せる魂 ${free}`, fix: { act: "party", label: "仕立てる" } });
  }
  // 武器を持たない人業がいる (買える所持金がある時だけ)
  const bare = G.party.filter((d) => d.alive && d.primary != null && !(d.equip && d.equip.weapon));
  if (bare.length && G.gold >= 30) {
    lines.push(`■ ${bare.map((d) => d.name).join("・")} は丸腰だ。商店で武器と防具を整えておけ。`);
    res.gear = true;
    let better = 0;
    try { better = UI.betterGearCount ? UI.betterGearCount() || 0 : 0; } catch (e) { better = 0; }
    res.items.push({ kind: "bare", tone: "warn", text: `${namesShort(bare)} は丸腰`, fix: better > 0 ? { act: "equip", label: "最適装備" } : { act: "shop", label: "商会へ" } });
  }
  // 手負いの人業がいる (深手 = HP半分未満は警告、それ以外の減りは静かに知らせる)
  const hurt = G.party.filter((d) => d.alive && d.hp < d.maxhp * 0.5);
  const tired = G.party.filter((d) => d.alive && (d.hp < d.maxhp || d.mp < d.maxmp));
  const innOpen = (() => { const a = tutorialAllowed(); return !a || a.includes("inn"); })();
  if (hurt.length) {
    lines.push(`■ ${hurt.map((d) => d.name).join("・")} が深手を負ったままだ。宿屋で休んでいけ。`);
    res.rest = true;
    res.items.push({ kind: "hurt", tone: "bad", text: `${namesShort(hurt)} が深手`, fix: innOpen ? { act: "rest", label: "宿で休む", cost: { kind: "gold", n: innCost() }, ok: G.gold >= innCost() } : null });
  } else if (tired.length && innOpen) {
    res.items.push({ kind: "tired", tone: "dim", text: "HP・MPが減っている者がいる", fix: { act: "rest", label: "宿で休む", cost: { kind: "gold", n: innCost() }, ok: G.gold >= innCost() } });
  }
  return res;
}

// 名前の短い並び (3人以上は「Aほか2人」)
function namesShort(list) { return list.length > 2 ? `${list[0].name}ほか${list.length - 1}人` : list.map((d) => d.name).join("・"); }

// 初回潜入時の警備兵の注意 (出撃シートの中に短い注記として出す。札は使わない)
const DUNGEON_BRIEFING = [
  "■ 主を倒すか「帰還魔法陣」を見つけるまで、街へは戻れない。",
  "■ 全滅すれば今回の収穫 (金・品・魂) を失う。✦Soul だけは残る。赤い魂があれば何も失わずに帰れる。",
];
// 潜入の実体。mutatorId を渡すと「迷宮の異変」を受け入れた状態で潜る
function enterDungeon(mutatorId) {
  G.mutator = mutatorId || null;
  G.bossDown = false; // 帰還制限: 魔法陣を見つけるか主を討つまで帰れない
  SFX.stairs();
  sheet.closeAll();
  townEl.classList.add("hidden");
  G.town.facility = null; G.town.sub = null;
  G.floor = 1; // 迷宮は常に1階から (街に戻ると入り直し)
  G.eliteFloor = false; // 1Fは強敵階・特別階にならない
  G.specialFloor = null;
  G.stats.runs++;
  // 今回の戦利品トラッキングを初期化 (帰還の報告は次の帰還で書き直す)
  G.run = newRun();
  G.lastRun = null;
  G._townMutator = null; G._departPre = false;
  G._lastTargetUid = null;
  // 表示中の噂を確定し、この迷宮で現実化させる
  if (G.rumor) { G.activeRumor = { ...G.rumor, floor: G.floor }; G.rumor = null; }
  // 納品依頼は迷宮に潜るたびに入れ替わる
  G.deliveryQuests = rollDeliveryQuests();
  G.state = "board";
  playBgm(fieldBgm());
  if (descendBtn) { descendBtn.classList.add("hidden"); descendBtn.disabled = true; }
  newFloor();
  const mu = mutDef();
  if (mu) log(`異変「${mu.name}」の中を行く。${mu.gain}。`, "win");
  renderBoard();
  autosave(true);
}

// ===== 無限迷宮「奈落」への潜入 =====
function enterAbyss(mods, weekly) {
  if (!G.party.some((p) => p.alive)) { log("動ける人業がいない。", "sys"); SFX.ng(); return; }
  const seed = weekly ? weekSeedId() : ((Math.random() * 0x7fffffff) >>> 0);
  // savedIdx: 帰還後に通常迷宮の選択を元に戻すため控える (G.abyss に持たせ、保存に乗せる)
  G.abyss = { depth: 1, mods: [...(mods || [])], weekly: !!weekly, seed, mutations: [], guardFloor: 0, started: true, savedIdx: G.dungeonIdx };
  // 呪縛の誓: 潜入時から変異が2つ宿る
  if (G.abyss.mods.includes("cursed")) { addAbyssMutation(); addAbyssMutation(); }
  G.mutator = null;
  G.bossDown = false;
  G.portalFound = false;
  SFX.stairs();
  sheet.closeAll();
  townEl.classList.add("hidden");
  G.town.facility = null; G.town.sub = null;
  G.floor = 1;
  G.dungeonIdx = abyssBaseN(1) - 1;
  G.eliteFloor = false;
  G.specialFloor = null;
  G.stats.runs++;
  G.run = newRun();
  G.lastRun = null;
  G._townMutator = null; G._departPre = false;
  G.rumor = null; G.activeRumor = null; // 奈落では街の噂は持ち込まない
  G.deliveryQuests = rollDeliveryQuests();
  G.state = "board";
  playBgm(fieldBgm());
  if (descendBtn) { descendBtn.classList.add("hidden"); descendBtn.disabled = true; }
  newFloor();
  const tag = G.abyss.mods.length ? `${G.abyss.mods.length}つの誓約を背負い、` : "";
  log(`✺ ${tag}無限迷宮「奈落」へ降りていく。果てまで潜れ。`, "win");
  if (G.abyss.mutations.length) showAbyssMutationPopup(ABYSS_MUT_MAP[G.abyss.mutations[G.abyss.mutations.length - 1]]);
  renderBoard();
  autosave(true);
}
// 出撃シートの「奈落の支度」から降りる (闇に溶けて潜る)
function departAbyss(mods, weekly) {
  if (G.state !== "town") return;
  if (!featureUnlocked("infinite")) { SFX.ng(); return; }
  if (blockForReport() || blockForTutorial()) return;
  if (!G.party.some((p) => p.alive)) { log("動ける人業がいない。", "sys"); SFX.ng(); return; }
  G.prompt = true;
  uiDungeonHud.sceneTransition(() => { G.prompt = false; enterAbyss(mods, weekly); });
}

// 奈落の支度は出撃シートの1ページ (誓約・モード・記録)。旧来の入口 (広場の「奈落」) もそこを開く
function openAbyssSetup() {
  if (!featureUnlocked("infinite")) { log("無限迷宮はまだ解放されていない。", "sys"); SFX.ng(); return; }
  UI.openDeparture({ page: "abyss" });
}
// 帰還時の奈落リザルト
function showAbyssSummary({ depth, score, weekly, mods, newDepth, newScore }) {
  const lines = [
    `到達深度 B${depth}F`,
    `スコア ${score.toLocaleString()} (誓約 ×${abyssScoreMul(mods).toFixed(2)})`,
  ];
  if (newDepth) lines.push("★ 最深到達を更新した！");
  if (newScore && !newDepth) lines.push("★ 最高スコアを更新した！");
  if (weekly) lines.push("今週の挑戦の記録に刻まれた。");
  showEvent({
    sprite: ICONS.portal,
    banner: "✺ 奈落の記録 ✺",
    title: "深淵からの帰還",
    accent: "#b08ac0",
    sparkle: newDepth || newScore,
    lines,
    btnLabel: "称える",
    onClose: () => renderTown(),
  });
}

// 街へ帰還 (戦利品は保持)。opts.outcome: return (帰還陣) | clear (踏破) | wipe (全滅・没収) | saved (赤い魂で生還)
// opts.run: 要約に使う潜入の記録 (全滅で没収した後でも、何を得て何を失ったかを残すため)
function returnToTown(opts = {}) {
  const runRef = opts.run !== undefined ? opts.run : G.run;
  const outcome = opts.outcome || (runRef && runRef.secured ? "clear" : "return");
  evOnReturn(runRef, outcome); // 迷宮のイベント: 報奨金・紅玉の売却 (全滅以外)
  // 帰還の報告 (D2) は奈落の確定や迷宮選択の巻き戻しより前に要約する (迷宮名・深さを正しく残す)
  const summary = runSummary(runRef, outcome, { forfeited: opts.forfeited || null });
  // 奈落のランは帰還で確定する。記録更新を判定するため、確定前に控えておく
  let abyssSummary = null;
  if (G.abyss) {
    const rec = abyssRecords();
    const depth = G.abyss.depth, score = abyssScore(depth, G.abyss.mods);
    const newDepth = depth > rec.bestDepth, newScore = score > rec.bestScore;
    const reason = G.party.some((p) => p.alive) ? "return" : "wipe";
    const savedIdx = G.abyss.savedIdx;
    abyssSummary = { depth, score, weekly: G.abyss.weekly, mods: [...G.abyss.mods], newDepth, newScore, reason };
    finalizeAbyss(reason);
    // 奈落中は素体迷宮へ付け替えていた選択を元に戻す
    if (savedIdx != null) G.dungeonIdx = Math.min(DUNGEONS.length - 1, Math.max(0, savedIdx));
  }
  G.state = "town";
  G.battle = null; G.battleCell = null;
  G.eliteFloor = false;
  G.specialFloor = null;
  G.mutator = null; // 迷宮の異変は潜入単位 (帰還で解除)
  G.autoCombat = false;
  G._townMutator = null; G._departPre = false;
  if (G._autoTimer) { clearTimeout(G._autoTimer); G._autoTimer = null; }
  sheet.closeAll();
  G.prompt = false;
  combatMenu.classList.add("hidden");
  if (townBtn) townBtn.classList.add("hidden");
  if (descendBtn) { descendBtn.classList.add("hidden"); descendBtn.disabled = true; }
  G.maxFloorReached = Math.max(G.maxFloorReached, G.floor);
  G.run = null; // 無事帰還 = 戦利品は確定 (BGMは renderTown が施設に応じて切替)
  // 砕けた人業は街へ戻っても自然には戻らない (人業の館で金貨を払って修復する)。
  // 全滅で戻った時だけ、器は迷宮に残され、ほかの冒険者が時を経て連れ帰る (ここから時を数え始める)
  setReviveTimers();
  if (!G.party.some((p) => p.alive)) startRescueTimers(G.party);
  summary.dead = G.party.filter((d) => d && d.isDoll && !d.alive).map((d) => ({ uid: d.uid, name: d.name }));
  G.lastRun = summary;
  rollTavernCrowd(); // 酒場の顔ぶれは帰還のたびに入れ替わる
  updateTopbar();
  log(outcome === "wipe" ? "砕けた人業を残し、街へ戻った。" : "街へ帰還した。", "sys");
  G.town.facility = null; G.town.sub = null; G.town.page = null; G.town.tab = "hub";
  renderDock();
  renderTown();
  autosave(true);
  if (abyssSummary) showAbyssSummary(abyssSummary);
  // 帰還の報告は街の広場 (WP-A) が UI.renderRunReport で札として置く。まだ置かれていなければ、シートで見せる
  else setTimeout(() => {
    if (G.state === "town" && G.lastRun && !G.lastRun.dismissed && !document.querySelector(".rr-card") && !uiBlocked() && UI.openRunReport) UI.openRunReport();
  }, 450);
  // §7 M9 帰還時に宿で休む (設定で選んだ時だけ。宿賃は宿屋と同じ)
  if (outcome !== "wipe" && uiDungeonHud.getPref("autoRest")) {
    let c = null;
    try { c = ops.counts(); } catch (e) { c = null; }
    if (c && c.hurt > 0 && G.gold >= c.innCost) setTimeout(() => { if (G.state === "town") ops.restParty(); }, 600);
  }
}
// 闇に溶けて街へ戻る (帰還陣・踏破の凱旋・全滅の決断の後)
function leaveDungeon(opts = {}) {
  G.prompt = true;
  uiDungeonHud.sceneTransition(() => { G.prompt = false; returnToTown(opts); });
}

// 帰還できるか (帰還陣を発見済み/その上に立っている/主を討った)
function canReturnNow() {
  const cell = G.board && G.board.cells[G.py] && G.board.cells[G.py][G.px];
  const onPortal = cell && cell.type === "portal";
  return !!(onPortal || G.bossDown || G.portalFound);
}
function confirmReturnToTown() {
  if (G.state !== "board" || G.anim || G.walking || uiBlocked()) return;
  // 帰還制限: 帰還魔法陣を発見済み (この階で踏んだ)、その上に立っている、または主を討っていれば帰れる
  if (!canReturnNow()) {
    SFX.ng(); buzz(20);
    showEvent({
      sprite: ICONS.portal, banner: "⚠ 帰還できない ⚠", title: "帰り道は閉ざされている",
      accent: "#7fd0ff",
      lines: ["迷宮は一度入ると容易には出られない。", "「帰還魔法陣」を見つけて踏むか、迷宮の主を討てば帰還できる。", "魔法陣は5の倍数の階には必ずある。"],
      btnLabel: "心得た",
      onClose: () => renderBoard(),
    });
    return;
  }
  showConfirm({
    title: "街へ帰還する？",
    lines: ["今いる階の探索は中断される。", "集めた魂・お金・アイテムは持ち帰れる。"],
    okLabel: "帰還する",
    onOk: () => leaveDungeon({ outcome: G.run && G.run.secured ? "clear" : "return" }),
  });
}

// 帰還魔法陣を踏んだ時の選択 (何度でも使える)
function askPortalReturn() {
  showChoice("帰還魔法陣が淡く輝いている。", [
    { label: "街へ帰還する ― 戦利品は持ち帰る", primary: true, fn: () => leaveDungeon({ outcome: G.run && G.run.secured ? "clear" : "return" }) },
    { label: "まだ潜る", fn: () => renderBoard() },
  ], ICONS.portal, { banner: "✦ 帰還魔法陣 ✦", accent: "#7fd0ff",
    lines: ["この陣を見つけたので、この階のどこからでも下の「帰還」で街へ戻れる。"],
    onDismiss: () => renderBoard() });
}

// ---- 個別ステータス (旧) → 隊 (src/ui/party.js) ----
// 旧 #status-screen は廃止。街では隊タブを、迷宮では隊のシート (全高) を開く。
// openStatus / closeStatus / renderStatus は多くの呼び出し元のための窓口 (名前と意味は旧来のまま)。
const statusBtn = document.getElementById("status-btn");

function openStatus(idx = 0, opts = {}) {
  if (G.state !== "board" && G.state !== "town") return;
  if (G.anim || G.walking || G.prompt) return;
  if (G.settingsOpen) closeSettings();
  G.statusIdx = idx;
  UI.openParty(idx, { context: G.state === "town" ? "town" : "dungeon", ...opts });
}
function closeStatus() {
  uiParty.closeSheet();
}
// 隊の表示を描き直す (迷宮のシート / 街の隊タブ)。装備変更・呪文のたびに保存
function renderStatus() {
  autosave();
  uiParty.refresh();
}

// 戦闘外で回復系呪文を唱える呪文 (HP回復・蘇生・状態異常の治療)。バフは戦闘外では持続しないため除く
function campSpellsOf(p) {
  return (p.spells || []).filter((k) => { const sp = SPELLS[k]; return sp && sp.target !== "self" && (sp.kind === "heal" || sp.kind === "cure" || sp.cure); });
}

const spellCures = (sp) => sp.kind === "cure" || !!sp.cure;
const spellHeals = (sp) => (sp.power || 0) > 0;
// 戦闘外の回復量の基準 (実際はこれ + 0〜3割の揺らぎ。見積もりはこの最低値で行う)
function campHealPower(caster, sp) { return (sp.power || 0) + Math.round((caster.pie || 0) * 0.5); }
// 生きている1体へ回復呪文の効果 (状態異常の治療・HP回復) を与える。何か起きたら true
function campApplyAlive(caster, sp, t) {
  let did = false;
  if (spellCures(sp) && t.ailment) { t.ailment = null; log(`${sp.name}！ ${t.name}の状態異常が治った`, "heal"); did = true; }
  if (spellHeals(sp) && t.hp < t.maxhp) {
    const p = campHealPower(caster, sp);
    const heal = p + rand(Math.ceil(p * 0.3) + 1);
    t.hp = Math.min(t.maxhp, t.hp + heal);
    log(`${sp.name}！ ${t.name}のHPが ${heal} 回復`, "heal");
    did = true;
  }
  return did;
}

// ---- 全員を回復 (隊の画面の「全員を回復」) ----
// 倒れた・傷ついた・状態異常の仲間が全回復するまで回復呪文を唱える。
//  - 倒れた仲間は、蘇生の呪文を唱えられる者がいれば真っ先に起こす (1人あたりの MP が最も軽い呪文から)
//  - 生きている仲間の全回復は、総消費 MP が最も少なくなる組み合わせを選ぶ (planHealAllDP)。
//    回復量は最低値で見積もる = 実際は必ず足りる。1回唱えるごとに実際の回復量で見積もり直し、揺らぎで多く癒えた分は節約する
//  - 1回ごとに、その呪文を唱えられる者のうち「いま MP の最も多い者」が唱える
//  - 全回復に MP が足りなければ、回復できるところまで回復する。優先は 死亡 > 状態異常 > HP
//    (蘇生 → 状態異常の治療 → 1MP あたりの回復量が大きい呪文から HP を癒す)
function healAllNeed() {
  if (G.party.some((t) => t.alive && (t.hp < t.maxhp || t.ailment))) return true;
  return G.party.some((t) => !t.alive) && healAllRevivers().length > 0;
}
// 倒れた者を起こせる呪文を持つ術者 (生きている者) と、その呪文
function healAllRevivers() {
  const out = [];
  for (const p of G.party) {
    if (!p.alive) continue;
    const acts = [];
    for (const key of campSpellsOf(p)) {
      const sp = SPELLS[key];
      if (sp.revive) acts.push({ key, sp, cost: spellCost(p, sp), all: sp.target === "all-ally" });
    }
    if (acts.length) out.push({ p, acts });
  }
  return out;
}
// 倒れた1体を呪文で起こす (campCast と同じ蘇生量)
function campRevive(caster, sp, t) {
  const heal = sp.revivePct ? Math.round(t.maxhp * sp.revivePct) : Math.max(1, campHealPower(caster, sp));
  t.alive = true; t.ailment = null; t.reviveAt = null; t._dead = false;
  t.hp = Math.max(1, Math.min(t.maxhp, heal));
  log(`${sp.name}！ ${t.name}が蘇った (HP ${t.hp})`, "heal");
}
// 回復・治療に使える呪文を持つ術者 (生きている者) と、その呪文 (実効MP・最低回復量)
function healAllCasters() {
  const out = [];
  for (const p of G.party) {
    if (!p.alive) continue;
    const acts = [];
    for (const key of campSpellsOf(p)) {
      const sp = SPELLS[key];
      const heals = spellHeals(sp), cures = spellCures(sp);
      if (!heals && !cures) continue;  // 蘇生だけの呪文 (リバイブ等) は生きている者に効かない
      acts.push({ key, sp, cost: spellCost(p, sp), pow: heals ? campHealPower(p, sp) : 0, heals, cures, all: sp.target === "all-ally" });
    }
    if (acts.length) out.push({ p, acts });
  }
  return out;
}
// 呪文の組み合わせ (唱える順の一覧) を決める。def = 各人のHPの不足, ail = 各人の状態異常の有無。
// 呪文ごとの見積もりは、唱えうる者の中で最も弱い回復量・最も重い MP (誰が唱えても足りる側)。
//  全体呪文で合計 h 以上を癒す最少MP (allDP) + 残りを1人ずつ単体呪文で埋める最少MP (oneDP) を、h ごとに比べて最小を取る。
//  状態異常は「治療つきの全体呪文を1回以上」か「その人へ治療つきの単体呪文を1回以上」で治す
const HEAL_CAST_EPS = 1e-3; // 同じ MP なら唱える回数の少ない組み合わせを選ぶための僅かな重み
function planHealAllDP(def, ail, casters) {
  const kinds = new Map();
  for (const c of casters) for (const a of c.acts) {
    const k = kinds.get(a.key);
    if (!k) kinds.set(a.key, { key: a.key, sp: a.sp, cost: a.cost, pow: a.pow, heals: a.heals, cures: a.cures, all: a.all });
    else { k.cost = Math.max(k.cost, a.cost); k.pow = Math.min(k.pow, a.pow); }
  }
  const allK = [...kinds.values()].filter((k) => k.all), oneK = [...kinds.values()].filter((k) => !k.all);
  const D = Math.max(0, ...def);
  // 単体: S0[d] = d を埋める最少MP、S1[d] = 治療つきの呪文を1回以上含めて d を埋める最少MP
  const S0 = new Array(D + 1).fill(Infinity), S0k = new Array(D + 1).fill(null);
  S0[0] = 0;
  for (let d = 1; d <= D; d++) for (const k of oneK) {
    if (!k.heals) continue;
    const v = k.cost + HEAL_CAST_EPS + S0[Math.max(0, d - k.pow)];
    if (v < S0[d]) { S0[d] = v; S0k[d] = k; }
  }
  const S1 = new Array(D + 1).fill(Infinity), S1k = new Array(D + 1).fill(null);
  for (let d = 0; d <= D; d++) for (const k of oneK) {
    if (!k.cures) continue;
    const v = k.cost + HEAL_CAST_EPS + S0[Math.max(0, d - k.pow)];
    if (v < S1[d]) { S1[d] = v; S1k[d] = k; }
  }
  // 全体: A0[h] = 合計 h 以上を癒す最少MP、A1[h] = 治療つきの全体呪文を1回以上含めて
  const A0 = new Array(D + 1).fill(Infinity), A0k = new Array(D + 1).fill(null);
  A0[0] = 0;
  for (let h = 1; h <= D; h++) for (const k of allK) {
    if (!k.heals) continue;
    const v = k.cost + HEAL_CAST_EPS + A0[Math.max(0, h - k.pow)];
    if (v < A0[h]) { A0[h] = v; A0k[h] = k; }
  }
  const A1 = new Array(D + 1).fill(Infinity), A1k = new Array(D + 1).fill(null);
  for (let h = 0; h <= D; h++) for (const k of allK) {
    if (!k.cures) continue;
    const v = k.cost + HEAL_CAST_EPS + A0[Math.max(0, h - k.pow)];
    if (v < A1[h]) { A1[h] = v; A1k[h] = k; }
  }
  let best = Infinity, pick = null;
  for (let h = 0; h <= D; h++) {
    for (const cured of [false, true]) {
      const base = cured ? A1[h] : A0[h];
      if (!(base < best)) continue;
      let v = base;
      for (let i = 0; i < def.length && v < best; i++) {
        const d = Math.max(0, def[i] - h);
        v += ail[i] && !cured ? S1[d] : S0[d];
      }
      if (v < best) { best = v; pick = { h, cured }; }
    }
  }
  if (!pick) return null;
  // 組み合わせを並べる: 全体呪文 (治療つきを先に) → 1人ずつの単体呪文
  const steps = [];
  const takeAll = (h) => { while (h > 0) { const k = A0k[h]; steps.push({ k, t: -1 }); h = Math.max(0, h - k.pow); } };
  if (pick.cured) { const k = A1k[pick.h]; steps.push({ k, t: -1 }); takeAll(Math.max(0, pick.h - k.pow)); }
  else takeAll(pick.h);
  for (let i = 0; i < def.length; i++) {
    let d = Math.max(0, def[i] - pick.h);
    if (ail[i] && !pick.cured) { const k = S1k[d]; steps.push({ k, t: i }); d = Math.max(0, d - k.pow); }
    while (d > 0) { const k = S0k[d]; steps.push({ k, t: i }); d = Math.max(0, d - k.pow); }
  }
  return { cost: best, steps };
}
// 手順の各回を「その呪文を唱えられる者のうち MP の最も多い者」へ割り振る。MP が尽きて割り振れなければ null
function assignHealCasters(steps, casters) {
  const mp = casters.map((c) => c.p.mp);
  const out = [];
  for (const s of steps) {
    let bi = -1, ba = null;
    casters.forEach((c, i) => {
      const a = c.acts.find((x) => x.key === s.k.key);
      if (a && a.cost <= mp[i] && (bi < 0 || mp[i] > mp[bi])) { bi = i; ba = a; }
    });
    if (bi < 0) return null;
    mp[bi] -= ba.cost;
    out.push({ ci: bi, a: ba, t: s.t });
  }
  return out;
}
// 保険: 1MP あたりの効き目が最も大きい手を、MP の多い術者から貪欲に選ぶ (上の割り振りで MP が尽きた時)
function planHealAllGreedy(def0, ail0, casters) {
  const def = def0.slice(), ail = ail0.slice(), mp = casters.map((c) => c.p.mp);
  const out = [];
  const done = () => def.every((d) => d <= 0) && !ail.some(Boolean);
  while (!done() && out.length < 300) {
    let pick = null, val = 0;
    const order = casters.map((_, i) => i).sort((a, b) => mp[b] - mp[a]);
    for (const ci of order) {
      for (const a of casters[ci].acts) {
        if (a.cost > mp[ci]) continue;
        const ts = a.all ? def.map((_, i) => i) : def.map((_, i) => i).filter((i) => (a.heals && def[i] > 0) || (a.cures && ail[i]));
        for (const t of (a.all ? [-1] : ts)) {
          let gain = 0;
          for (const i of (t < 0 ? ts : [t])) {
            if (a.heals) gain += Math.min(def[i], a.pow);
            if (a.cures && ail[i]) gain += 1000;
          }
          const v = gain / a.cost;
          if (v > val) { val = v; pick = { ci, a, t }; }
        }
      }
      if (pick) break; // MP の多い者が唱えられるなら、その者が唱える
    }
    if (!pick) return null;
    for (let i = 0; i < def.length; i++) {
      if (pick.t >= 0 && pick.t !== i) continue;
      if (pick.a.heals) def[i] = Math.max(0, def[i] - pick.a.pow);
      if (pick.a.cures) ail[i] = false;
    }
    mp[pick.ci] -= pick.a.cost;
    out.push(pick);
  }
  return done() ? out : null;
}
function healAll() {
  const fail = (msg, tone = "info") => { log(msg, "sys"); showToast(msg, { tone }); SFX.miss(); };
  if (!healAllNeed()) {
    if (G.party.some((t) => !t.alive)) return fail("倒れた仲間を蘇らせる呪文を使える者がいない");
    return fail("パーティは皆、傷も穢れもない");
  }
  if (!healAllCasters().length && !healAllRevivers().length) return fail("回復魔法を使える者がいない");
  const used = new Map(); // 術者 → { 呪文名 → 回数 }
  let total = 0;
  // 1回唱える (all = 全体呪文は生死を問わず効く者全員へ、そうでなければ t の1人へ)
  const cast = (caster, sp, cost, t) => {
    log(`${caster.name}は${sp.name}を唱えた`, "sys");
    const hit = t ? [t] : G.party.filter((x) => x.alive || sp.revive);
    for (const x of hit) {
      if (!x.alive) campRevive(caster, sp, x);
      else campApplyAlive(caster, sp, x);
    }
    caster.mp -= cost;
    total += cost;
    if (!used.has(caster)) used.set(caster, new Map());
    const m = used.get(caster);
    m.set(sp.name, (m.get(sp.name) || 0) + 1);
  };
  // その手を唱えられる者のうち、いま MP の最も多い者 (同じ呪文でも人により実効 MP が違う)
  const bestOf = (list, ok) => {
    let pick = null;
    for (const c of list) for (const a of c.acts) {
      if (a.cost > c.p.mp || !ok(a)) continue;
      const v = ok(a);
      if (!pick || v > pick.v || (v === pick.v && c.p.mp > pick.c.p.mp)) pick = { c, a, v };
    }
    return pick;
  };

  // 1) 死亡: 起こせる人数あたりの MP が最も軽い蘇生呪文から (同じなら蘇生後の HP が多い方)
  for (let guard = 0; guard < 50; guard++) {
    const dead = G.party.filter((t) => !t.alive);
    if (!dead.length) break;
    const pick = bestOf(healAllRevivers(), (a) => (a.all ? dead.length : 1) / a.cost + (a.sp.revivePct || 0) * HEAL_CAST_EPS);
    if (!pick) break;
    // 単体は回復呪文の使い手を先に (起きればその者も唱える側に回る)、次に HP の大きい者
    const healer = (x) => (campSpellsOf(x).length ? 1 : 0);
    const t = pick.a.all ? null : dead.slice().sort((x, y) => healer(y) - healer(x) || (y.maxhp || 0) - (x.maxhp || 0))[0];
    cast(pick.c.p, pick.a.sp, pick.a.cost, t);
  }

  // 2) 生きている者の全回復: 総消費 MP の最も少ない組み合わせ (足りれば、ここで全員が全快する)
  const casters = healAllCasters(); // 蘇った術者も唱える側に入る
  const targets = G.party.filter((t) => t.alive);
  const planFrom = () => {
    const d = targets.map((t) => Math.max(0, t.maxhp - t.hp)), a = targets.map((t) => !!t.ailment);
    if (a.some(Boolean) && !casters.some((c) => c.acts.some((x) => x.cures))) return null;
    if (d.some((v) => v > 0) && !casters.some((c) => c.acts.some((x) => x.heals))) return null;
    const plan = planHealAllDP(d, a, casters);
    return (plan && assignHealCasters(plan.steps, casters)) || planHealAllGreedy(d, a, casters);
  };
  let steps = casters.length && healAllNeed() ? planFrom() : null;
  for (let guard = 0; steps && steps.length && guard < 300; guard++) {
    const { ci, a, t } = steps[0];
    const caster = casters[ci].p;
    const hit = targets.filter((x, i) => (t < 0 || t === i) && ((a.heals && x.hp < x.maxhp) || (a.cures && x.ailment)));
    if (!hit.length || caster.mp < a.cost) break;
    cast(caster, a.sp, a.cost, t < 0 ? null : targets[t]);
    if (!targets.some((x) => x.hp < x.maxhp || x.ailment)) break;
    steps = planFrom();
  }

  // 3) 全快に MP が足りない: 回復できるところまで。状態異常の治療 → HP
  //  治療: 治せる人数あたりの MP が最も軽い呪文から (同じなら回復量の多い方)
  for (let guard = 0; guard < 100; guard++) {
    const ill = targets.filter((x) => x.alive && x.ailment);
    if (!ill.length) break;
    const pick = bestOf(casters, (a) => a.cures && ((a.all ? ill.length : 1) / a.cost + a.pow * HEAL_CAST_EPS * 1e-3));
    if (!pick) break;
    const t = pick.a.all ? null : ill.slice().sort((x, y) => x.hp / x.maxhp - y.hp / y.maxhp)[0];
    cast(pick.c.p, pick.a.sp, pick.a.cost, t);
  }
  //  HP: 1MP あたりの見込み回復量 (最低値・満タンを超える分は数えない) が最も大きい手から。単体は最も深手の者へ
  for (let guard = 0; guard < 300; guard++) {
    const hurt = targets.filter((x) => x.alive && x.hp < x.maxhp);
    if (!hurt.length) break;
    let pick = null;
    for (const c of casters) for (const a of c.acts) {
      if (!a.heals || a.cost > c.p.mp) continue;
      let gain, t = null;
      if (a.all) gain = hurt.reduce((n, x) => n + Math.min(x.maxhp - x.hp, a.pow), 0);
      else {
        t = hurt.slice().sort((x, y) => Math.min(y.maxhp - y.hp, a.pow) - Math.min(x.maxhp - x.hp, a.pow) || x.hp / x.maxhp - y.hp / y.maxhp)[0];
        gain = Math.min(t.maxhp - t.hp, a.pow);
      }
      if (gain <= 0) continue;
      const v = gain / a.cost;
      if (!pick || v > pick.v || (v === pick.v && (gain > pick.gain || (gain === pick.gain && c.p.mp > pick.c.p.mp)))) pick = { c, a, t, v, gain };
    }
    if (!pick) break;
    cast(pick.c.p, pick.a.sp, pick.a.cost, pick.t);
  }

  if (!total) {
    const ill = targets.some((x) => x.ailment), hurt = targets.some((x) => x.hp < x.maxhp);
    const canCure = casters.some((c) => c.acts.some((a) => a.cures)), canHeal = casters.some((c) => c.acts.some((a) => a.heals));
    if (ill && !canCure && !(hurt && canHeal)) return fail("状態異常を治す呪文を使える者がいない");
    if (hurt && !canHeal && !(ill && canCure)) return fail("傷を癒す呪文を使える者がいない");
    return fail("MPが足りない！", "bad");
  }
  SFX.heal(); buzz(15); renderStatus(); renderParty();
  const parts = [];
  for (const [p, m] of used) parts.push(`${p.name} ${[...m].map(([k, c]) => c > 1 ? `${k}×${c}` : k).join("・")}`);
  const dead = G.party.filter((t) => !t.alive).length;
  const ill = G.party.filter((t) => t.alive && t.ailment).length;
  const hurt = G.party.filter((t) => t.alive && t.hp < t.maxhp).length;
  if (dead || ill || hurt) {
    const left = [dead && `倒れたまま${dead}`, ill && `状態異常${ill}`, hurt && `手負い${hurt}`].filter(Boolean).join("・");
    showToast(`回復できるところまで回復した (消費MP ${total} / 残り ${left}) ― ${parts.join(" / ")}`, { tone: "bad" });
  } else showToast(`全員を回復した (消費MP ${total}) ― ${parts.join(" / ")}`, { tone: "good" });
}

// 戦闘外で回復系呪文を唱える。対象の味方を選び (1人ならそのまま)、HP回復/蘇生/状態異常治療を行う。
// 結果はトーストで知らせ、隊の画面に留まる。効果のある対象がいなければ MP は減らない
function campCast(caster, spellKey) {
  const sp = SPELLS[spellKey];
  const cost = spellCost(caster, sp);
  if (caster.mp < cost) { log("MPが足りない。", "sys"); showToast(`MPが足りない (MP ${caster.mp}/${cost})`, { tone: "bad" }); SFX.miss(); return; }
  const cures = spellCures(sp);     // 毒・麻痺・石化を治す
  const heals = spellHeals(sp);     // HP回復量を持つ
  const noTargetMsg = () => {
    if (heals && cures) return `${sp.name}: 傷つき・状態異常の仲間がいない`;
    if (cures) return `${sp.name}: 状態異常の仲間がいない`;
    if (sp.revive && !heals) return `${sp.name}: 倒れた仲間がいない`;
    return `${sp.name}: 傷ついた仲間がいない`;
  };
  // 1体へ効果を適用。何か起きたら true
  const applyTo = (t) => {
    if (!t.alive) {
      if (!sp.revive) return false;
      campRevive(caster, sp, t);
      return true;
    }
    return campApplyAlive(caster, sp, t);
  };
  const finish = () => { caster.mp -= cost; SFX.heal(); buzz(15); renderStatus(); renderParty(); };
  // 1人ぶんの結果 (蘇生 / 満タン / 回復量)
  const healLineFor = (t, before, wasDead) => {
    if (wasDead && t.alive) return `${t.name}が蘇った (HP ${t.hp}/${t.maxhp})`;
    if (t.alive && t.hp >= t.maxhp) return `${t.name}は満タン`;
    const got = t.hp - before;
    return got > 0 ? `${t.name} HP+${got}` : null;
  };

  // 全体呪文は対象選択なしで全員へ
  if (sp.target === "all-ally") {
    let any = false;
    const lines = [];
    for (const t of G.party) {
      if (!t.alive && !sp.revive) continue;
      const before = t.hp, wasDead = !t.alive;
      if (applyTo(t)) any = true;
      if (heals) { const ln = healLineFor(t, before, wasDead); if (ln) lines.push(ln); }
    }
    if (any) { finish(); showToast(`${sp.name} ― ${lines.length ? lines.slice(0, 3).join(" ・ ") : "パーティを癒した"}`, { tone: "good" }); }
    else { log("効果のある対象がいない。", "sys"); showToast(noTargetMsg(), { tone: "info" }); SFX.miss(); }
    return;
  }

  // 単体: 効果のある対象だけを候補にする (HP満タンへの回復・状態異常なしへの治療は不可)
  const benefits = (t) => {
    if (!t.alive) return !!sp.revive;
    if (cures && t.ailment) return true;
    if (heals && t.hp < t.maxhp) return true;
    return false;
  };
  const targets = G.party.filter(benefits);
  if (!targets.length) { log("効果のある対象がいない。", "sys"); showToast(noTargetMsg(), { tone: "info" }); SFX.miss(); return; }
  const castOn = (t) => {
    const before = t.hp, wasDead = !t.alive;
    if (applyTo(t)) {
      finish();
      showToast(`${sp.name} ― ${heals ? (healLineFor(t, before, wasDead) || `${t.name}は満タン`) : `${t.name}を癒した`}`, { tone: "good" });
    } else { log("効果のある対象ではなかった。", "sys"); showToast("効果がなかった", { tone: "info" }); }
  };
  uiParty.pickTarget({ banner: sp.name, accent: "#46c08f", title: "誰に唱える？",
    lines: [`消費 MP${cost}（${caster.name} MP ${caster.mp}/${caster.maxmp}）`], targets, onPick: castOn });
}

// 表示ヘルパ (soulStatText・属性/スキル/品の表示・equipPreviewDelta・equipCompareEl・detailLines など) は
// src/ui/itemview.js へ移設 (import 済み)

// 品の詳細 (窓口)。隊の操作 (装備・使う・渡す・捨てる・鑑定) つきの品シートを開く
// (WP-C の UI.itemSheet があればそれに actions を渡し、無ければ隊の自前のシート)。p = 持ち主 (null 可)
function showItemDetailPopup(p, sel) {
  if (!sel || !sel.item) return null;
  return uiParty.openItem(sel.item, p, sel);
}

// 未鑑定品の詳細ポップアップ (旧来の .ig-choices) に「鑑定する」アクションを足す。
// 街でのみ、鑑定の心得がある者 (隊と控え) がいればその場で試せる。失敗済み (idHardFail) とレジェンドレアは商会送り。
// 新しい品シート (UI.itemSheet) は自前の「鑑定を試す / 鑑定する」を持つ。これは旧画面の互換用
function addIdentifyAction(acts, it, close) {
  const off = (label) => { const b = btn(label, () => {}); b.disabled = true; acts.appendChild(b); };
  if (it.lr) return off("レジェンドレアは商会でのみ鑑定できる");
  if (it.idHardFail) return off("鑑定に失敗した品 (商会でのみ鑑定できる)");
  if (G.state !== "town") return off("鑑定は街でのみできる");
  const idmen = townAppraisers();
  if (!idmen.length) return off("鑑定できる者がいない");
  acts.appendChild(btn("鑑定を試す (スキル)", () => { close(); openIdentifyChooser(it); }));
}

// 鑑定できる仲間を選ぶ (成功率つき)。キットのシート (src/ui/loot.js の UI.identifyChooser) で出す。
// 街で商会が開いていれば、確実な商会の鑑定も先頭に並ぶ
function openIdentifyChooser(it, onDone) {
  if (UI.identifyChooser) return UI.identifyChooser(it, { onDone });
  const idmen = townAppraisers();
  if (!idmen.length) { log(G.state === "town" ? "鑑定できる者がいない。" : "鑑定は街でのみできる。", "sys"); return null; }
  return doIdentifySkill(idmen[0], it);
}

// 鑑定の心得のある者 (鑑定は街でのみ。隊と控えの生きている全員から)
function townAppraisers() {
  if (G.state !== "town") return [];
  return allDolls().filter((m) => m && !m.isEmpty && m.alive && canIdentify(m));
}

// スキル鑑定を実行。成功で正体判明、失敗で idHardFail (以後は商店でのみ鑑定可)。成功なら true
// 鑑定は街でのみ (迷宮では何もしない)
// quiet: 音・トースト・描き直し・保存を呼び出し側 (鑑定を試みるの演出 src/ui/appraise.js) に任せる
function doIdentifySkill(m, it, { quiet = false } = {}) {
  if (!it || !it.unidentified || it.lr || it.idHardFail) return false;
  if (G.state !== "town") return false;
  const ch = identifyChance(m, it.lv || 1);
  const ok = Math.random() < ch;
  if (ok) {
    const first = revealIdentity(it);
    log(`${m.name}は ${it.name} を鑑定した！${first ? " (初ゲット！)" : ""}`, "win");
    if (!quiet) { SFX.itemget(); buzz(15); showToast(`${first ? "初ゲット！ " : ""}${it.name} と判明した (${m.name})`, { tone: "good" }); }
  } else {
    it.idHardFail = true;
    log(`${m.name}の鑑定は失敗した… この品は商店でしか鑑定できなくなった。`, "sys");
    if (!quiet) { SFX.ng(); buzz([0, 30, 40, 30]); showToast("鑑定に失敗した… もう商会でしか鑑定できない", { tone: "bad" }); }
  }
  if (quiet) return ok;
  if (G.statusOpen) renderStatus(); // ステータス画面はオーバーレイ (G.state は board/town のまま) なので statusOpen で判定
  if (G.state === "town") renderTown();
  else renderParty();
  autosave(true);
  return ok;
}

// equipClassText / equipPartyChips は src/ui/itemview.js へ移設 (import 済み)

function doEquip(p, it) {
  const r = equipItem(p, it);
  if (r.msg) log(r.msg, r.ok ? "win" : "sys");
  if (r.ok) SFX.select();
  else { SFX.ng(); if (r.msg) showToast(r.msg, { tone: "bad" }); }
  renderStatus(); renderParty();
  return r;
}

// アイテムが指定スロットに装備可能か (種別の一致)
function itemFitsSlot(it, slotKey) {
  if (!it || it.slot === "use") return false;
  if (slotKey === "acc1" || slotKey === "acc2") return it.slot === "acc";
  return it.slot === slotKey;
}

// p の slotKey に it を装備する (owner = it を袋に持っている人業。自分なら p)。
// 規則は items.js の equip() と同じ (職・未鑑定・両手武器⇄盾・呪いは外れない・所持枠8) だが、
// 装飾品は「指定した枠」に付ける。stashTo を渡すと、外れた装備は p ではなくその人業の袋へ入る
// (p の袋が満杯の時の「持ち主と取り替える」)。成否 { ok, msg, displaced, full }
function equipAt(p, it, slotKey, owner = p, stashTo = null) {
  if (!it || !itemFitsSlot(it, slotKey)) return { ok: false, msg: "その部位には装備できない" };
  if (!canEquip(p, it)) return { ok: false, msg: it.unidentified ? "未鑑定の品は装備できない" : `${p.cls}は${it.name}を装備できない` };
  const tr = autoEquip.trialEquip(p.equip, it, slotKey);
  if (!tr) return { ok: false, msg: "呪われた装備が外れない" };
  const bag = stashTo || p;
  const bagAfter = bag.items.length - (owner === bag ? 1 : 0) + tr.displaced.length;
  if (bagAfter > MAX_ITEMS) return { ok: false, full: true, msg: `${bag.name}の持ち物がいっぱいで、外した装備を入れられない` };
  const i = owner.items.indexOf(it);
  if (i < 0) return { ok: false, msg: "" };
  owner.items.splice(i, 1);
  for (const k of SLOTS) p.equip[k] = tr.equip[k] || null;
  for (const x of tr.displaced) bag.items.push(x);
  recalcDoll(p);
  p.hp = Math.min(p.hp, p.maxhp); p.mp = Math.min(p.mp, p.maxmp);
  return { ok: true, msg: `${p.name}は ${it.name} を装備した`, displaced: tr.displaced };
}

// 装備候補 (窓口)。隊の「装備候補」シート (すべての袋から・伸びの順) を開く
function openEquipChooser(p, slotKey) { return uiParty.openCandidates(p, slotKey); }

// 候補(自分/他キャラの所持品)を p の slotKey に装備する
function equipFromAnywhere(p, slotKey, c) {
  const { it, owner } = c;
  const r = equipAt(p, it, slotKey, owner || p);
  if (r.msg) log(r.msg, r.ok ? "win" : "sys");
  if (r.ok && owner && owner !== p) log(`${owner.name} から ${it.name} を受け取り装備した。`, "win");
  if (r.ok) { SFX.select(); buzz(10); } else { SFX.ng(); if (r.msg) showToast(r.msg, { tone: "bad" }); }
  renderStatus(); renderParty();
  return r;
}
function doUnequip(p, key) {
  const r = unequipItem(p, key);
  if (r.msg) log(r.msg, r.ok ? "sys" : "dmg");
  if (r.ok) SFX.select();
  else { SFX.ng(); if (r.msg) showToast(r.msg, { tone: "bad" }); }
  renderStatus(); renderParty();
  return r;
}
function useItem(p, index) {
  const it = p.items[index];
  if (!it || it.slot !== "use") return;
  // 無頼の誓 (奈落の縛り): 道具 (消耗品) を一切使えない
  if (G.abyss && G.abyss.mods.includes("noItems")) { SFX.ng(); log("無頼の誓により、道具は使えない。", "sys"); showToast("無頼の誓により、道具は使えない", { tone: "bad" }); return; }
  let used = false;
  if (it.use.heal) {
    if (p.hp >= p.maxhp) { log(`${p.name}のHPは満タンだ`, "sys"); showToast(`${p.name}のHPは満タンだ`, { tone: "info" }); }
    else { const b = p.hp; p.hp = Math.min(p.maxhp, p.hp + it.use.heal); log(`${p.name}は${it.name}を使った。HP回復！`, "heal"); SFX.heal(); used = true; showToast(`${it.name} ― ${p.name} HP+${p.hp - b}`, { tone: "good" }); }
  } else if (it.use.mp) {
    if (p.mp >= p.maxmp) { log(`${p.name}のMPは満タンだ`, "sys"); showToast(`${p.name}のMPは満タンだ`, { tone: "info" }); }
    else { const b = p.mp; p.mp = Math.min(p.maxmp, p.mp + it.use.mp); log(`${p.name}は${it.name}を使った。MP回復！`, "heal"); SFX.heal(); used = true; showToast(`${it.name} ― ${p.name} MP+${p.mp - b}`, { tone: "good" }); }
  } else if (it.use.cure) {
    if (p.ailment === it.use.cure) { p.ailment = null; log(`${p.name}の毒が治った`, "heal"); SFX.heal(); used = true; showToast(`${p.name}の毒が治った`, { tone: "good" }); }
    else { log(`効果がなかった`, "sys"); showToast("効果がなかった", { tone: "info" }); }
  }
  if (used) p.items.splice(index, 1);
  renderStatus(); renderParty();
}
// 捨てる: 取り返しのつかない操作なので確認画面を挟む
function dropItem(p, index) {
  const it = p.items[index];
  if (!it) return;
  showConfirm({
    title: `${it.name} を捨てる？`,
    lines: ["捨てたアイテムは二度と戻らない。"],
    okLabel: "捨てる",
    onOk: () => {
      const i = p.items.indexOf(it);
      if (i >= 0) p.items.splice(i, 1);
      log(`${it.name}を捨てた`, "sys");
      showToast(`${it.name}を捨てた`, { tone: "info" });
      renderStatus();
    },
  });
}

// 品を from の袋から to の袋へ移す (満杯なら移さない)
function moveItem(from, it, to) {
  if (!from || !to || from === to) return false;
  const i = from.items.indexOf(it);
  if (i < 0) return false;
  if (to.items.length >= MAX_ITEMS) { SFX.ng(); showToast(`${to.name}の持ち物はいっぱいだ`, { tone: "bad" }); return false; }
  from.items.splice(i, 1);
  to.items.push(it);
  log(`${it.name} を ${from.name} → ${to.name} に渡した`, "win");
  SFX.select();
  showToast(`${it.name} → ${to.name}`, { tone: "info" });
  renderStatus(); renderParty();
  return true;
}
// 他のメンバーへアイテムを渡す (渡す相手を選ぶシート。街では控えにも渡せる)
function transferItem(p, index) {
  const it = p.items[index];
  if (!it) return;
  uiParty.openTransfer(p, it);
}

// 確認ダイアログ (ステータス画面の上にも出せる)。キットの決断シート: 実行 (赤) / やめる。戻る = やめる
function showConfirm({ title, lines = [], okLabel = "実行する", onOk }) {
  let h = null;
  const cancel = () => { if (h) h.close("cancel", { silent: true }); };
  h = sheet.open({
    kind: "choice", banner: "確認", accent: "#d4504e", title, lines, className: "ui-confirm",
    footer: [
      { label: okLabel, kind: "danger", size: "lg", onTap: () => { h.close("ok", { silent: true }); onOk(); } },
      { label: "やめる", kind: "ghost", onTap: cancel },
    ],
    onBack: cancel, onBackdrop: cancel,
  });
  return h;
}

// ダンジョンで拾った装備は未鑑定 (鑑定するまで装備不可) で手に入る。
// 消耗品・戦利品・貴重品 (use/misc/mat) は鑑定済みでそのまま使える。
function markDungeonLoot(it) {
  if (it && UNIDENT_SLOTS.has(it.slot)) it.unidentified = true;
  return it;
}

// アイテムを入手 (空きのあるメンバーへ)。満杯なら拾えない。{item, who} を返す
function giveItem(id) {
  const it = cloneItem(id);
  if (!it) return null;
  markDungeonLoot(it);
  const who = G.party.find((m) => m.items.length < MAX_ITEMS);
  if (!who) {
    log(`${itemName(it)}を見つけたが、誰も持てない…`, "sys");
    showToast(`持ちきれず ${itemName(it)} を置いてきた`, { tone: "bad" });
    refundLR(it);
    return null;
  }
  runGainItem(who, it);
  codexSeeItem(id, it);
  log(`${itemName(it)} を手に入れた！ (${who.name})`, logClassForItem(it));
  return { item: it, who };
}

// ---- アイテム入手の演出 ----
// 旧 #item-get (ランクアップの祝祭・踏破の凱旋などが今も使う1枠)
const itemGetEl = document.getElementById("item-get");

// 入手の割り込み方針 (§3.6) は src/ui/loot.js の UI.loot が受け持つ:
//   コモン/アンコモン/レア・道具・収集品 = 入手のトースト (収穫バーの数も増える)。onClose はすぐに呼ぶ
//   スーパーレア/レジェンドレア = 祝祭カード (ファンファーレ・閃光・LRは光の柱と揺れ)。閉じてから onClose
// 旧来どおり「プロンプトは1枠」: 出ている決断/知らせは置き換える (前の onClose は呼ばない)
let _itemGetDepth = 0; // トーストは続きをその場で呼ぶので入れ子になる。異常な深さ (UI 未登録で互いに呼び合う等) を断つ
function showItemGet(item, who, onClose) {
  replacePrompt();
  if (UI.loot && _itemGetDepth < 24) {
    _itemGetDepth++;
    try { return UI.loot(item, who, { source: "legacy" }, onClose); } finally { _itemGetDepth--; }
  }
  // UI が未登録の環境 (検証用のスタブなど): 何も出さずに先へ進む
  G.prompt = false;
  if (onClose) onClose(); else if (G.state === "board") renderBoard();
  autosave(true);
  return null;
}

// 旧 #item-get を閉じる (ランクアップの祝祭などが使う)。G.prompt を解き、onClose (無ければ盤面) → 保存
function closeItemGet(onClose) {
  itemGetEl.classList.add("hidden");
  itemGetEl.innerHTML = "";
  itemGetEl.onclick = null; // 古い背景クリックハンドラが次のポップアップへ漏れないように
  G.prompt = false;
  if (onClose) onClose();
  else renderBoard();
  autosave(true);
}

// ---- 汎用イベント表示 (宝箱の中身・罠・泉など) ----
// キットのシートで表示する (sparkle = 褒美は中央の祝祭カード、それ以外は下から昇る知らせ)。
// 閉じ方 (ボタン・背景・戻る) はどれも同じ: G.prompt を解き、onClose (無ければ盤面の再描画) → 保存
function showEvent({ sprite, title, lines = [], accent = "#c9a227", btnLabel = "つぎへ", banner = "✦ イベント ✦", sparkle = false, onClose }) {
  G.prompt = true;
  replacePrompt();
  let h = null, done = false;
  const finish = () => {
    if (done) return;
    done = true;
    if (promptSheet === h) promptSheet = null;
    h.close("ok", { silent: true });
    G.prompt = false;
    if (onClose) onClose();
    else renderBoard();
    autosave(true);
  };
  h = sheet.open({
    kind: sparkle ? "celebrate" : "info", banner, accent, art: sprite || null, sparkle, title,
    titleColor: accent === "#c9a227" ? null : accent, lines,
    footer: [{ label: btnLabel, kind: "primary", size: "lg", onTap: finish }],
    onBack: finish, onBackdrop: finish,
  });
  promptSheet = h;
}

// ---- ランクアップの祝祭 (キットの祝祭カード。描画は src/ui/soulpanel.js) ----
// 昇格の感動を最大化するため: ランク色のフラッシュ + 勝利ファンファーレ + 強い触覚、
// 回転する光条と火花に包まれた進化した姿、ランクN→N+1 の大きな昇格表示、新たな称号、解放されたもの。
function showRankUp({ clsKey, fromRank, toRank, fromLv, toLv, count }, onClose) {
  const cls = SOUL_CLASSES[clsKey] || SOUL_CLASSES.fighter;
  const accent = (SOUL_RANKS[toRank] && SOUL_RANKS[toRank].color) || cls.glow || "#ffcf4a";
  const fromCap = capForRarityRank(cls.rarity, fromRank);
  const toCap = capForRarityRank(cls.rarity, toRank);
  flashScreen(accent);
  SFX.victory(); buzz([0, 60, 40, 60, 40, 70, 90, 220]);
  return uiSoulPanel.celebrateRankUp({
    clsKey, fromRank, toRank, fromLv, toLv, count, accent, fromCap, toCap,
    title: jobRankName(clsKey, toRank), hint: rankUnlockHint(toRank),
  }, onClose);
}

// 各ランク到達で新たに開ける道のヒント (節目を強調)
function rankUnlockHint(rank) {
  if (rank === 2) return "★ 覚醒 — 控えの結社パッシブが芽吹き、宿し技として他の人業に貸せるようになった。";
  if (rank === 3) return "★ 上位の技 — 伸びたLv上限の先に、新たなスキル・パッシブが見えてきた。";
  if (rank === 4) return "★ 真髄 — 宿し先へランク2パッシブまで託せるようになった。";
  if (rank === 5) return "★ 極致 — 魂は最高位に至り、Lvの天井が解き放たれた。";
  return null;
}

// 毒のダメージ (盤面を1歩進むごと)
function tickPoison() {
  let any = false;
  for (const p of G.party) {
    if (!p.alive || p.ailment !== "poison") continue;
    any = true;
    // 毒状態の継続ダメージは最大HPの2% (高レベルでも脅威として機能するよう%化)
    const dmg = Math.max(1, Math.ceil(p.maxhp * 0.02));
    p.hp = Math.max(0, p.hp - dmg);
    if (p.hp === 0) { p.alive = false; SFX.die(); log(`${p.name}は毒に倒れた…`, "dmg"); }
  }
  imprintFallen();
  if (any && !G.party.some((p) => p.alive)) { gameOver(); return true; }
  return false;
}

if (statusBtn) statusBtn.addEventListener("click", () => { if (G.statusOpen) closeStatus(); else openStatus(G.statusIdx || 0); });
if (townBtn) townBtn.addEventListener("click", confirmReturnToTown);
// 旧来の見出しの階段印 (いまは隠してある)。押されたら行動ドックの「降りる」と同じ
if (descendBtn) descendBtn.addEventListener("click", () => dockDescend());

// ---- 入力 ----
// 最初のユーザー操作で音声を起動 (ブラウザの自動再生制限対策)
let audioReady = false;
// 街の施設ごとのBGMテーマ (未指定の施設は広場のテーマ)
const FACILITY_BGM = {
  mansion: "mansion", altar: "mansion",
  tavern: "tavern",
  shop: "shop",
  inn: "inn",
  palace: "palace", codexMon: "palace", codexItem: "palace", codexDungeon: "palace", codexJob: "palace", treasury: "palace", // 図鑑・宝物庫は王宮の間
  shrine: "shrine",
};
// 街シェルのタブ・ページごとのBGM (旧来の施設が立っていればそちらが優先)
const TAB_BGM = { party: "mansion", shop: "shop", palace: "palace" };
const PAGE_BGM = { tavern: "tavern", shrine: "shrine", abyss: "town" };
function townBgm() {
  const t = G.town || {};
  return FACILITY_BGM[t.facility] || PAGE_BGM[t.page] || TAB_BGM[t.tab] || "town";
}
let openingActive = false; // オープニング演出中は専用テーマ
let titleActive = false;   // タイトル画面の表示中は専用テーマ
// 探索BGM: 層 (1-20) ごとのテーマ曲
function fieldBgm() {
  return dungeonTheme().bgm;
}
// 戦闘BGM: ランク帯で激しさが3段階。深層 (ランク9-10) のボスは終末のテーマ
function battleBgm(isBoss) {
  const r = activeCfg().rank || 1;
  if (isBoss) return r >= 9 ? "boss2" : "boss";
  return r >= 7 ? "battle3" : r >= 4 ? "battle2" : "battle";
}
// 現在のシーンに合ったBGM名
function sceneBgm() {
  if (titleActive) return "title";
  if (openingActive) return "opening";
  if (G.state === "town") return townBgm();
  if (G.state === "combat") return battleBgm(G.battle && G.battle.enemies.some((e) => e.boss || (e.mon && e.mon.elite)));
  if (G.state === "board") return fieldBgm();
  return null; // over などは無音 (ジングルのみ)
}
function ensureAudio() {
  if (audioReady) return;
  audioReady = true;
  initAudio();
  playBgm(sceneBgm());
}
document.addEventListener("pointerdown", ensureAudio, { once: true });

// ---- ズーム禁止 (ゲーム画面の拡大縮小を防ぐ) ----
// iOS Safari のピンチズーム
document.addEventListener("gesturestart", (e) => e.preventDefault());
document.addEventListener("gesturechange", (e) => e.preventDefault());
// PC の Ctrl+ホイール / Ctrl+± ズーム
document.addEventListener("wheel", (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
// ダブルタップズーム (touch-action で大半は防げるが保険)
document.addEventListener("dblclick", (e) => e.preventDefault());

// movePad は削除済み。方向キー / スワイプで代替。

// タイルクリックで移動: 隣接なら1歩、離れていれば経路探索して自動で歩く
// 戦闘中、敵を長押し = その敵の特徴・スキル (図鑑の一枚)。長押しの後のクリックは攻撃にしない
let _enemyHold = null;
view.addEventListener("pointerdown", (e) => {
  if (G.state !== "combat" || !G.battle) return;
  // オート中は戦闘画面に触れた瞬間に解除 (演出中もOK)
  if (G.autoCombat && !(e.button > 0)) { stopAutoByTouch(); return; }
  const rect = view.getBoundingClientRect();
  const sx = (e.clientX - rect.left) * (VW / rect.width);
  const sy = (e.clientY - rect.top) * (VH / rect.height);
  if (_enemyHold) clearTimeout(_enemyHold.t);
  const h = { x: e.clientX, y: e.clientY, fired: false };
  h.t = setTimeout(() => {
    const enemy = G.state === "combat" && G.battle ? nearestEnemyAt(sx, sy) : null;
    if (!enemy || uiBlocked()) return;
    h.fired = true;
    SFX.select(); buzz(12);
    uiDungeonHud.peekEnemy(enemy);
  }, 450);
  _enemyHold = h;
});
view.addEventListener("pointermove", (e) => { if (_enemyHold && !_enemyHold.fired && Math.hypot(e.clientX - _enemyHold.x, e.clientY - _enemyHold.y) > 10) { clearTimeout(_enemyHold.t); _enemyHold = null; } });
for (const ev of ["pointerup", "pointercancel", "pointerleave"]) view.addEventListener(ev, () => { if (_enemyHold && !_enemyHold.fired) { clearTimeout(_enemyHold.t); _enemyHold = null; } });
view.addEventListener("contextmenu", (e) => { if (G.state === "combat") e.preventDefault(); });

view.addEventListener("click", (e) => {
  if (G._swiped) { G._swiped = false; return; } // 直前のスワイプ由来の click は無視
  if (_enemyHold && _enemyHold.fired) { _enemyHold = null; return; } // 長押しで敵を覗いた直後
  _enemyHold = null;
  const rect = view.getBoundingClientRect();
  const sx = (e.clientX - rect.left) * (VW / rect.width);
  const sy = (e.clientY - rect.top) * (VH / rect.height);
  // 戦闘中にオート戦闘なら、画面のどこをタップしても解除 (演出中もOK)
  if (G.state === "combat" && G.autoCombat) { buzz(10); stopAutoCombat(); return; }
  // 戦闘中: 敵スプライトを直接タップ
  if (G.state === "combat" && G.battle && !G.animating && !uiBlocked()) {
    const b = G.battle;
    const enemy = nearestEnemyAt(sx, sy);
    // ターゲット選択フェーズ: タップで対象決定 (武器の射程が届く敵のみ)
    if (b.phase === "target" && enemy) {
      const opts = b.targetOptions();
      if (b.pending && b.pending.action !== "attack" && opts.every((t) => t.side !== "enemy")) return;
      if (!opts.includes(enemy)) { log(`${enemy.name}までは届かない！ (射程: ${RANGE_LABEL[b.attackRange((b.pending && b.pending.actor) || b.current)]})`, "sys"); SFX.ng(); return; }
      SFX.select(); buzz(10); G._lastTargetUid = enemy.uid; b.chooseTarget(enemy); runCommitted();
      return;
    }
    // 入力フェーズ: どこをタップしても通常攻撃。敵の上なら対象指定、
    // 何もないところなら最寄り/先頭の敵を自動で狙う (いずれも射程内のみ)。
    if (b.phase === "input") {
      const reach = b.attackableEnemies(b.current);
      if (enemy && !reach.includes(enemy)) { log(`${enemy.name}までは届かない！ (射程: ${RANGE_LABEL[b.attackRange(b.current)]})`, "sys"); SFX.ng(); return; }
      const tgt = enemy || nearestEnemyAt(sx, sy, reach) || defaultAttackTarget(b.current);
      if (!tgt) return;
      attackNow(tgt);
      return;
    }
    return;
  }
  if (G.state !== "board" || uiBlocked()) return;
  // 自動移動中: 別のマスをタップしたら行き先を変更 (いま歩いている1歩を終えてから新しい経路へ)
  if (G.walking) {
    const hit = cellAt(sx, sy);
    if (!hit) return;
    if (!(hit.x === G.px && hit.y === G.py) && !findPath(hit.x, hit.y).length) { SFX.miss(); log("そこへはまだ行けない。", "sys"); return; }
    SFX.select();
    walkRedirect = { x: hit.x, y: hit.y };
    return;
  }
  if (G.anim) return;
  // セル内 (溝のクリックは無視)
  const hit = cellAt(sx, sy);
  if (!hit) return;
  const cx = hit.x, cy = hit.y;
  if (cx === G.px && cy === G.py) return;
  const dist = Math.abs(cx - G.px) + Math.abs(cy - G.py);
  // 隣接かつ辺が開いていれば1歩で移動
  if (dist === 1 && edgeOpen(cx, cy)) { SFX.select(); moveTo(cx, cy); return; }
  // 離れたマス、または壁ごしの隣接マス: 迂回ルートを探索して自動移動
  const path = findPath(cx, cy);
  if (path.length) { SFX.select(); autoWalk(path); return; }
  // 到達ルートなし: フィードバック (隣接なら壁の赤フラッシュ)
  if (dist === 1) { moveTo(cx, cy); return; }
  SFX.miss();
  log("そこへはまだ行けない。", "sys");
});

// スワイプ連続移動: 指を押さえたまま方向を決めると、壁にぶつかるか指を離すまで進み続ける。
// 短いタップは従来のタイルクリックとして扱う。
const SWIPE_MIN = 28;
let swipe = null;          // { x, y, dir } ― dir 確定後は非 null
let swipeTimer = null;     // 連続移動ループのタイマー ID

function stopSwipe() {
  swipe = null;
  if (swipeTimer !== null) { clearTimeout(swipeTimer); swipeTimer = null; }
}

// 指を離さずに方向が確定した後、1歩ずつ連続移動するループ
function swipeStep(dx, dy) {
  if (!swipe) return; // 指が離れた
  if (G.state !== "board" || uiBlocked()) { stopSwipe(); return; }
  if (G.anim || G.walking) {
    // アニメーション完了待ち。50ms ごとに再チェック
    swipeTimer = setTimeout(() => swipeStep(dx, dy), 50);
    return;
  }
  const nx = G.px + dx, ny = G.py + dy;
  if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS || !edgeOpen(nx, ny)) {
    // 壁 or 端 → 赤フラッシュ出して終了
    tryMove(dx, dy);
    stopSwipe();
    return;
  }
  tryMove(dx, dy);
  swipeTimer = setTimeout(() => swipeStep(dx, dy), 50);
}

// スワイプは画面全体で受け付ける。ボタン/モーダル/ステータス画面は除外。
// 盤面では隊の札 (#party) の上からもフリックで歩ける (タップ = 隊のシート、長押し = 覗く はそのまま)。
const SWIPE_IGNORE = "button, a, [role=button], #party, #town-screen, #town-shell, #ui-layer, #item-get, .confirm-overlay";
document.addEventListener("pointerdown", (e) => {
  G._swiped = false; // 新しい指の動きごとに、前のスワイプの「click 無視」印を消す
  if (e.pointerType === "mouse") return;
  // どこを触っても、まず進行中のスワイプ連続移動ループを止める。
  // (メンバーカード等 SWIPE_IGNORE をタップした際にループが走り続けると、
  //  移動に伴う renderParty() でカードDOMが作り直されてタップ(openStatus)が失われる)
  stopSwipe();
  const onParty = G.state === "board" && !uiBlocked() && e.target.closest("#party");
  if (!onParty && e.target.closest(SWIPE_IGNORE)) return;
  swipe = { x: e.clientX, y: e.clientY, dir: null, party: !!onParty };
});

document.addEventListener("pointermove", (e) => {
  if (!swipe || swipe.dir) return;
  const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN) return;
  const mdx = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : -1) : 0;
  const mdy = mdx === 0 ? (dy > 0 ? 1 : -1) : 0;
  swipe.dir = { dx: mdx, dy: mdy };
  G._swiped = true;
  // 札の上から始めたフリックは、方向が決まった時点で指を #party (作り直されない器) に捕まえておく。
  // 歩くたびに renderParty() が札を作り直しても、指を離した pointerup を取りこぼさない (タップは札のまま)。
  if (swipe.party) { try { partyEl.setPointerCapture(e.pointerId); } catch (err) { /* 非対応環境は素通し */ } }
  SFX.select();
  swipeStep(mdx, mdy);
});

document.addEventListener("pointerup", () => { stopSwipe(); });
document.addEventListener("pointercancel", () => { stopSwipe(); });

document.addEventListener("keydown", (e) => {
  if (e.key === "m" || e.key === "M") { updateMuteBtn(toggleMute()); return; }
  if (e.key === "Escape") { e.preventDefault(); nav.back(); return; } // 戻る操作は nav に一本化 (§3.2)
  if (G.state !== "board" || uiBlocked()) return;
  switch (e.key) {
    case "ArrowUp": case "w": tryMove(0, -1); break;
    case "ArrowDown": case "s": tryMove(0, 1); break;
    case "ArrowLeft": case "a": tryMove(-1, 0); break;
    case "ArrowRight": case "d": tryMove(1, 0); break;
    default: return;
  }
  e.preventDefault();
});

// ミュートボタン
const muteBtn = document.getElementById("mute-btn");
function updateMuteBtn(m) { if (muteBtn) muteBtn.textContent = m ? "🔇" : "🔊"; if (G.settingsOpen) renderSettings(); }
if (muteBtn) {
  muteBtn.addEventListener("click", () => { ensureAudio(); updateMuteBtn(toggleMute()); });
}

// ================= 設定 (⚙) — キットのシート (src/ui/settings.js が組み立てる) =================
// 音量は端末の好み (PREFS = dos-prefs)、自動化の好みは UI の好み (prefs.js = dos-ui)。どちらもセーブとは別。
// G.settingsOpen は「シートが開いている」の意味で保つ (盤面の入力止め・戻る操作の判定に使われる)
const settingsBtn = document.getElementById("settings-btn");
let settingsSheet = null;

function openSettings() {
  if (G.state !== "board" && G.state !== "town") return;
  if (G.anim || G.walking || G.prompt) return;
  if (G.statusOpen) closeStatus();
  if (settingsSheet) return;
  if (!UI.settingsSheet) return;
  G.settingsOpen = true;
  settingsSheet = UI.settingsSheet({ onClose: () => { G.settingsOpen = false; settingsSheet = null; } });
  if (!settingsSheet) G.settingsOpen = false;
}
function closeSettings() {
  G.settingsOpen = false;
  if (settingsSheet) { const h = settingsSheet; settingsSheet = null; h.close("close"); }
}
// 開いている設定のシートを描き直す (ミュートの切り替え・Mキーなど)
function renderSettings() {
  if (settingsSheet && settingsSheet.refresh) settingsSheet.refresh();
}

if (settingsBtn) settingsBtn.addEventListener("click", () => {
  SFX.select();
  if (G.settingsOpen) closeSettings();
  else openSettings();
});

// ================= オートセーブ (ウィザードリィ3風: 常時保存・やり直し不可) =================
// 一度選択した行動は取り消せない。タスクキルされても直前の状態 (戦闘なら確定済みの
// 行動が実行される直前) から再開する。
// v2: 全コンテンツ再編 (隠しレベル1-200 / 迷宮100 / 魂cap拡張)。v1セーブとは互換しない
const SAVE_KEY = "dos-save-v6"; // v6 = 100迷宮を20層×5迷宮へ再構成 (旧セーブは孤立させる)
// 保存する G のフィールド (アニメーション等の一時状態は除外)
const SAVE_FIELDS = [
  "state", "floor", "maxFloorReached", "dungeonIdx", "unlockedDungeons", "board", "px", "py", "eliteFloor", "specialFloor", "mutator", "bossDown", "portalFound", "abyss", "abyssRec",
  "gold", "soulPts", "redSoul", "embers", "dollsPurchased", "dungeonBriefed", "pendingDoll",
  "party", "reserve", "souls", "shopStock", "run", "town",
  "quests", "dailyQuests", "subQuests", "subQuestSeen", "msq", "ach", "fastAnim", "animTempo", "tavernCrowd", "rumor", "rumorCooldown", "activeRumor", "deliveryQuests", "codex", "treasury", "lrOwned", "lrClock", "order", "irene", "tut", "events", "story", "dragonSlain", "stats",
  "battle", "battleCell", "prevPos", "statusIdx", "statusTab",
  "lastRun",
];

// 参照保持シリアライズ: 共有オブジェクト/循環参照を {$r:index} で表現し、
// ロード時に同一性 (魂が複数箇所から参照される等) を完全に復元する。関数は無視。
function refSerialize(root) {
  const heap = [];
  const map = new Map();
  function enc(v) {
    if (v === null || v === undefined) return null;
    const t = typeof v;
    if (t === "number" || t === "string" || t === "boolean") return v;
    if (t !== "object") return null; // 関数など
    if (map.has(v)) return { $r: map.get(v) };
    const idx = heap.length;
    map.set(v, idx);
    if (Array.isArray(v)) {
      const arr = []; heap.push({ a: arr });
      for (const x of v) arr.push(enc(x));
    } else {
      const obj = {}; heap.push({ o: obj });
      for (const k in v) {
        if (!Object.prototype.hasOwnProperty.call(v, k)) continue;
        if (typeof v[k] === "function") continue;
        obj[k] = enc(v[k]);
      }
    }
    return { $r: idx };
  }
  return { root: enc(root), heap };
}

function refDeserialize(data) {
  const heap = data.heap || [];
  const objs = heap.map((n) => (n.a ? [] : {}));
  const dec = (v) => (v !== null && typeof v === "object" && "$r" in v) ? objs[v.$r] : v;
  heap.forEach((n, i) => {
    if (n.a) for (const x of n.a) objs[i].push(dec(x));
    else for (const k in n.o) objs[i][k] = dec(n.o[k]);
  });
  return dec(data.root);
}

let _lastSave = 0;
let _saveWarned = false;
let _resetting = false; // データ削除→リロードの間に autosave が書き戻すのを防ぐ
function autosave(force = false) {
  if (_resetting) return;
  if (!G.party || !G.party.length) return;
  const now = Date.now();
  if (!force && now - _lastSave < 200) return;
  _lastSave = now;
  try {
    codexSweepJobs(); // 職業図鑑の発見状況を保存前に最新化
    const snap = {};
    for (const k of SAVE_FIELDS) snap[k] = G[k];
    localStorage.setItem(SAVE_KEY, JSON.stringify(refSerialize(snap)));
  } catch (e) {
    // localStorage が使えない (プライベートブラウズ等) と保存できない → 一度だけ警告
    if (!_saveWarned) {
      _saveWarned = true;
      log("⚠ セーブできません。プライベートブラウズを解除してください。", "dmg");
      try { showToast("⚠ セーブ不可: プライベートブラウズ?"); } catch {}
    }
  }
}

function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch {} }

// 旧セーブの %型アイテム (.pct) をテンプレートのフラット値へ戻す。
// refSerialize の参照共有を壊さないよう、saved item オブジェクトを in-place で変更する。
// 所持品をカタログの最新定義に合わせ直す (レア度・能力値・絵・説明など、品そのものの性質)。
// 個体ごとの状態 (未鑑定・鑑定失敗の印など) は残す。旧セーブの装備も新しいレア度と絵になる
const ITEM_STAT_KEYS = ["atk", "vit", "agi", "int", "pie", "luk", "hp", "mp", "crit"];
const ITEM_TMPL_KEYS = ["name", "desc", "slot", "lv", "rank", "r20", "rar", "lr", "forJob", "exclusive", "classes", "cat",
  "twoHanded", "weight", "price", "art", "palette", "eAtk", "eDef", "aRes", "onHit", "scale", "magic", "mult", "eff", "align", "cursed", "hit", "dice", "swings"];
function reflattenItemStats() {
  const visited = new Set();
  function refresh(it) {
    if (!it || visited.has(it)) return;
    visited.add(it);
    const tmpl = ITEMS[it.id];
    if (!tmpl) return;
    delete it.pct;
    for (const k of ITEM_STAT_KEYS) { if (tmpl[k] != null) it[k] = tmpl[k]; else delete it[k]; }
    for (const k of ITEM_TMPL_KEYS) { if (tmpl[k] !== undefined) it[k] = tmpl[k]; else delete it[k]; }
    if (it.forge) applyForge(it); // 鍛え直し (地の底の鍛冶場) は目録の値に掛け直す
  }
  for (const m of [...(G.party || []), ...(G.reserve || [])]) {
    for (const it of (m.items || [])) refresh(it);
    for (const k of Object.keys(m.equip || {})) refresh(m.equip[k]);
  }
}

// 旧ステータス体系 (こうげき/ぼうぎょ/すばやさ/AC) のセーブを六大ステへ移行する。
// 装備品 (slot を持つ) と戦闘アクター (side を持つ) の def→vit / spd→agi を付け替え、
// AC と旧表示用能力値 (attrs: STR/IQ…) を破棄する。人業の base は後段の recalcDoll が再計算する。
function migrateLegacyStats(root) {
  const ren = (o, from, to) => {
    if (!o || typeof o !== "object") return;
    if (o[to] == null && o[from] != null) o[to] = o[from];
    delete o[from];
  };
  const seen = new Set();
  const walk = (v) => {
    if (!v || typeof v !== "object" || seen.has(v)) return;
    seen.add(v);
    if (Array.isArray(v)) { for (const x of v) walk(x); return; }
    const isItem = typeof v.slot === "string";
    const isActor = v.side === "party" || v.side === "enemy";
    if (isItem || isActor) {
      ren(v, "def", "vit");
      ren(v, "spd", "agi");
      delete v.ac;
    }
    if (isActor) {
      ren(v.base, "def", "vit");
      ren(v.base, "spd", "agi");
      ren(v.buffs, "def", "vit");
      ren(v.buffs, "spd", "agi");
      delete v.attrs;
    }
    for (const k in v) walk(v[k]);
  };
  walk(root);
}

// 保存データを読み込み、G を復元する。成功なら true
function loadGame() {
  let raw;
  try { raw = localStorage.getItem(SAVE_KEY); } catch { return false; }
  if (!raw) return false;
  let snap;
  try { snap = refDeserialize(JSON.parse(raw)); } catch (e) { return false; }
  if (!snap || !snap.party || !snap.party.length) return false;
  for (const k of SAVE_FIELDS) if (k in snap) G[k] = snap[k];
  // 戦闘演出の倍速を改めた: 旧来の標準の速さが「倍速 ON」、OFF はその 1/2。旧セーブは ON (= これまでの速さ) から始める
  if (!("animTempo" in snap)) { G.fastAnim = true; G.animTempo = 2; }
  if (!G.lrOwned || typeof G.lrOwned !== "object") G.lrOwned = {}; // LR入手済み記録 (1点もの)
  // 街UIの現在地 (後付け: tab/page)。旧 {facility, sub} はそれが属するタブへ写す
  G.town = townshell.migrateTown(G.town);
  if (G.lastRun === undefined) G.lastRun = null; // 帰還の報告 (後付け)
  if (!G.order || !Array.isArray(G.order.picks)) G.order = { picks: [] }; // 控えの結社の着席指定
  if (!G.irene || typeof G.irene !== "object") G.irene = { greeted: false, visits: 0, seen: {}, last: null }; // 館の主イレーヌ (後付け: 既存の記録では次の来館で挨拶する)
  if (!G.irene.seen || typeof G.irene.seen !== "object") G.irene.seen = {};
  if (!G.tut || typeof G.tut !== "object") G.tut = { done: {}, cur: null, step: 0, ev: {}, base: {} }; // 手ほどき (後付け: 解放済みで未使用の要素は目標の札から手ほどきする)
  if (!G.events || typeof G.events !== "object") G.events = {}; // 迷宮のイベント (後付け)
  for (const k of ["seen", "picks", "once", "flags", "fresh"]) if (!G.events[k] || typeof G.events[k] !== "object") G.events[k] = {};
  { // 極の出来事は「選択肢なし・恒久の恵み・セーブで一度きり」に改めた。旧仕様で出会った者にも同じ恵みを授ける
    const o = G.events.once, fl = G.events.flags;
    if (Object.keys(o).some((k) => k.startsWith("c30:"))) { o.c30 = true; fl.will = true; }
    if (o.l1_10) fl.blackCat = true;
    if (o.l2_10) fl.sewerMap = true;
    if (o.l3_10) fl.temper = true;
  }
  // 旧ステータス体系のセーブを六大ステ (ATK/VIT/AGI/INT/PIE/LUK) へ移行
  // (battle の敵の mon はこの後 MONSTERS の生定義に差し替えられるため触れても無害)
  migrateLegacyStats(snap);
  reflattenItemStats();
  // 一時状態はリセット
  G.anim = null; G.flipAnim = null; G.heroAnim = null; G.walking = false; G.prompt = false;
  G.fx = null; G.animating = false; G.enemyPos = {}; G.partyFx = new Map(); G.wallFlash = null;
  G.statusOpen = false; G.settingsOpen = false;
  // クラス/参照の再リンク (Battleのメソッド・敵のmon・派生値)
  if (G.battle) {
    Object.setPrototypeOf(G.battle, Battle.prototype);
    G.battle.log = log;
    if (G.battle.fleeK == null) G.battle.fleeK = fleeScale(); // 逃走の物差しを持たない古い戦闘
    for (const e of (G.battle.enemies || [])) if (e.key && MONSTERS[e.key]) e.mon = MONSTERS[e.key];
  }
  // 旧形式: 未生成の pendingDoll は「空の人業」として控えへ移す (生成前でも消えない)
  if (G.pendingDoll) {
    const pd = G.pendingDoll;
    pd.isEmpty = true;
    if (!pd.name || pd.name === "（未生成）") pd.name = "空の人業";
    G.reserve.push(pd);
    G.pendingDoll = null;
  }
  // この世界の器は「人業」と呼ぶ。旧版で「空の人形」と名付けられた控えを改める
  for (const d of (G.reserve || [])) if (d && d.name === "空の人形") d.name = "空の人業";
  // 所持魂 (v5): 配列に整え、無効な職業を除き、人業のメイン魂/サブ魂を実在する魂に整える
  if (!Array.isArray(G.souls)) G.souls = [];
  G.souls = G.souls.filter((s) => s && SOUL_CLASSES[s.clsKey]);
  setSharedSouls(G.souls); // recalcDoll が所持魂を uid で引けるようにする
  syncDollUids([...(G.party || []), ...(G.reserve || [])]); // 人業の通し番号を続きから (重なりも直す)
  for (const d of [...(G.party || []), ...(G.reserve || [])]) {
    if (!Array.isArray(d.subs)) d.subs = [];
    if (d.primary != null && !soulByUid(d.primary)) d.primary = null;
    // サブ魂を {uid, picks, picked} 形式へ正規化し、実在する魂・メイン魂と別の魂だけ残す
    // (旧形式 {skill, passive} は subPicks が picks へ移し替える。passive も落とさず引き継ぐ)
    d.subs = d.subs
      .map((x) => {
        if (!x || typeof x !== "object") return null;
        const sub = { uid: x.uid, picks: Array.isArray(x.picks) ? x.picks.slice() : undefined, skill: x.skill || null, passive: x.passive || null };
        if (Array.isArray(sub.picks)) { delete sub.skill; delete sub.passive; }
        subPicks(sub);
        if (x.picked) sub.picked = true;
        return sub;
      })
      .filter((x) => x && soulByUid(x.uid) && x.uid !== d.primary)
      .slice(0, MAX_SUBS);
    try { recalcDoll(d); } catch {}
    // 旧版の回復で小数になったHP/MPを整数に戻す (四捨五入)
    if (typeof d.hp === "number") d.hp = Math.round(d.hp);
    if (typeof d.mp === "number") d.mp = Math.round(d.mp);
  }
  if (!G.stats) G.stats = {};
  // 後付けの戦績フィールドを既存セーブにも補完する (勲章 cond が参照する)
  const _statDefaults = { runs: 0, deepest: 0, kills: 0, deaths: 0, soulsFound: 0, bossKills: 0,
    chests: 0, mimics: 0, trapsDisarmed: 0, trapsSprung: 0, fusions: 0, questsDone: 0, playMs: 0,
    swiftBoss: false, masterMimicSlain: false };
  for (const k in _statDefaults) if (G.stats[k] == null) G.stats[k] = _statDefaults[k];
  if (!G.stats.bossIds || typeof G.stats.bossIds !== "object") G.stats.bossIds = {};
  if (!G.stats.elemKills || typeof G.stats.elemKills !== "object") G.stats.elemKills = {};
  if (!G.ach) G.ach = {}; // 勲章 (後付け)
  if (!G.subQuests) G.subQuests = {}; // サブクエスト (後付け)
  if (!Array.isArray(G.subQuestSeen)) G.subQuestSeen = []; // 表示済みの迷宮 (後付け)
  // メインストーリー (後付け): 解放済みの最前線の迷宮を現在章とみなす。
  // 既に最後の迷宮まで終えたセーブは、第100章の報告から再開できる
  if (!G.msq) {
    const n = Math.min(100, Math.max(1, G.unlockedDungeons || 1));
    G.msq = (G.dragonSlain && n >= 100) ? { n: 100, state: "report" } : { n, state: "active" };
  }
  // 公開範囲が広がった: 封印の告知を受けていたセーブは「次の勅命待ち」に戻し、王が封の解けたことを告げる
  if (G.msq.state === "sealed" && G.msq.n < CONTENT_LIMIT) { G.msq.state = "offer"; G.msq.unsealed = true; }
  G.autoCombat = false;   // オート戦闘は再開時に解除 (誤動作防止)
  // 図鑑の移行: 旧形式 (mon[key]=true) を {kills,normal,rare,dungeons} に変換
  if (!G.codex) G.codex = { mon: {}, item: {} };
  if (!G.codex.mon) G.codex.mon = {};
  if (!G.codex.item) G.codex.item = {};
  // 正体を知った品 (後付け): 図鑑の記録から復元し、未鑑定でしか持っていない品は「まだ知らない」とする
  if (!G.codex.known || typeof G.codex.known !== "object") {
    const known = {};
    for (const id in G.codex.item) known[id] = true;
    const held = heldItems();
    for (const it of held) if (it.unidentified && it.id && !held.some((x) => x.id === it.id && !x.unidentified)) delete known[it.id];
    G.codex.known = known;
  }
  // 手当て (一度だけ): 宝箱から取り出した敵の落とし物を、未鑑定のまま「正体を知った品」と記していた。
  // 未鑑定でしか持っていない品は「まだ知らない」に戻す (鑑定すれば初ゲット！が出る)
  if (!G.codex.knownFix) {
    const held = heldItems();
    for (const it of held) if (it.unidentified && it.id && !held.some((x) => x.id === it.id && !x.unidentified)) delete G.codex.known[it.id];
    G.codex.knownFix = 1;
  }
  for (const k in G.codex.mon) {
    const v = G.codex.mon[k];
    if (!v || typeof v !== "object") {
      G.codex.mon[k] = { kills: v === true ? 1 : 0, normal: false, rare: false, dungeons: {} };
    } else if (!v.dungeons) { v.dungeons = {}; }
  }
  // 職業図鑑 (後付け): 旧形式 (true) を {lv} へ移行し、現在の人業から復元する。
  // rank 未記録の旧セーブは到達Lvから推定する (到達Lvはランク×10でキャップ済み)
  if (!G.codex.job) G.codex.job = {};
  for (const k in G.codex.job) {
    if (typeof G.codex.job[k] !== "object") G.codex.job[k] = { lv: 0 };
    const e = G.codex.job[k];
    if (!e.rank) e.rank = Math.max(1, Math.min(5, Math.ceil((e.lv || 0) / 10)));
  }
  codexFresh(); // 新着の記録 (後付け。旧セーブは新着なしで始まる)
  delete G.codex.soul; // 魂図鑑は廃止 (スキルが職業帰属になったため)
  codexSweepJobs();
  return true;
}

// 復元した状態に応じて画面を再構築 (やり直し不可の再開)
function resumeFromState() {
  if (!G.state || G.state === "town") {
    G.state = "town";
    if (townBtn) townBtn.classList.add("hidden");
    if (descendBtn) { descendBtn.classList.add("hidden"); descendBtn.disabled = true; }
    renderTown();
    return;
  }
  if (G.state === "board") {
    if (descendBtn) descendBtn.classList.add("hidden");
    if (!G.board) newFloor();
    renderBoard();
    return;
  }
  if (G.state === "combat") {
    if (descendBtn) descendBtn.classList.add("hidden");
    combatMenu.classList.remove("hidden");
    resumeCombat();
    return;
  }
  if (G.state === "over") {
    gameOver(); // 全滅画面を再表示 (選択は未確定なので再度迫る)
    return;
  }
}

// 戦闘の再開: 確定済み (やり直し不可) の行動があれば即実行する
function resumeCombat() {
  const b = G.battle;
  if (!b) { finishToBoard(); return; }
  G.animating = false; G.fx = null; G.partyFx = new Map(); G.enemyPos = {};
  renderRunbar();
  renderParty();
  fitView();
  renderCombat();
  if (b.result) { setTimeout(endBattle, 200); return; }
  // resolve フェーズ = 行動が確定済み → そのまま実行 (取り消せない)
  if (b.phase === "resolve" && b.pending) { runCommitted(); return; }
  if (b.phase === "enemy" || b.phase === "stunned") { combatStep(); return; }
  // input / target = まだ選択中 → メニュー/対象選択を再表示 (renderCombat 済み)
}

// アプリが裏に回る/閉じられる瞬間に確実に保存
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") autosave(true); });
window.addEventListener("pagehide", () => autosave(true));
window.addEventListener("beforeunload", () => autosave(true));

// 新規プレイの初期化: 人業ロスター・魂ストック・初期装備を整える
function setupNewGame() {
  // 何も持たずに着任する。人業も魂も赤い魂も、まず王宮で拝受する (第0章)
  G.party = [];
  G.reserve = [];
  G.souls = [];       // 所持魂 一覧 (魂インスタンスの配列)
  setSharedSouls(G.souls);
  G.redSoul = 0;
  G.unlockedDungeons = 0; // 勅命 (第1章) を受けるまで、迷宮の場所は明かされない
  G.shopStock = { ...SHOP_INIT_STOCK };
  G.deliveryQuests = rollDeliveryQuests();
  // 第0章「人業の生成」: 王宮で謁見 → 戦士・僧侶・盗賊・魔導士の魂×4+🔴100を受ける (granted) → 館の保管庫で人業を4体仕立て → 報告
  G.msq = { n: 0, state: "active", granted: false };
  codexSweepJobs();
  initQuests();
}

// ==== OPS: 一括操作 (Phase 0 が所有。以後は凍結し、拡張は UI 経由) ====
// どれも既存の単体操作 (宿・商店の鑑定/売却・赤い魂の連れ帰り・勲章の拝受・奉納・魂の鍛錬) のループで、
// 価格・除外条件は単体と同一 (釣り合いは変えない)。結果のオブジェクトを返し、記録 (log) と
// トーストは1回にまとめ、街を描き直す。施設が閉ざされている間 (第0章) は動かない。
function opsFacilityOpen(key) { const a = tutorialAllowed(); return !a || a.includes(key); }
function opsEquippedBy(d, it) { for (const k in (d.equip || {})) if (d.equip[k] === it) return true; return false; }
// 売却候補: 呪い・未鑑定・装備中・SR/LR・未奉納の収集品 (sellWarnings) は除外 (商店の一括売却と同じ)。
// 消耗品 (薬草など) は既定で除外する。{ includeUse: true } で商店の一括売却と全く同じ集合になる
function opsJunkList({ includeUse = false } = {}) {
  const out = [];
  for (const d of allDolls()) {
    for (const it of (d.items || [])) {
      if (!it || it.cursed || it.unidentified || opsEquippedBy(d, it) || sellWarnings(it).length) continue;
      if (!includeUse && it.slot === "use") continue;
      out.push({ doll: d, item: it, price: sellPrice(it) });
    }
  }
  return out;
}
// 拝受できる勲章 (段階表は「次の段階」だけ。勲章の間と同じ判定)
function opsClaimableAchievements() {
  const seen = new Set();
  const out = [];
  for (const a of ACHIEVEMENTS) {
    if (seen.has(a.series) || G.ach[a.id]) continue;
    seen.add(a.series);
    if (a.cond()) out.push(a);
  }
  return out;
}
// 奉納できる収集品 = 手持ちの収集品すべて [{doll, item, dup, gold}]。
// 初めての種類 (同じ種類は最初の1点) が dup:false で台帳に記され、奉納済みの種類と2点目以降は dup:true (売却額の金貨に換わる)。
// 並びは初めての種類が先
function opsDonatableList() {
  const ts = treasuryState();
  const seen = new Set();
  const fresh = [], dups = [];
  for (const h of heldCollectibles()) {
    const dup = !!ts.donated[h.item.id] || seen.has(h.item.id);
    seen.add(h.item.id);
    (dup ? dups : fresh).push({ ...h, dup, gold: dup ? sellPrice(h.item) : 0 });
  }
  return fresh.concat(dups);
}
// まだ奉納していない種類の数 (宝物庫・王宮の印と街の提案はこれだけで立てる)
const opsNewKindCount = () => opsDonatableList().filter((h) => !h.dup).length;
// いま ✦Soul で1段以上鍛えられる、編成の人業のメイン魂
// 並びはレベルの低い順 (同じなら安い順)。lowest = 上限に届いていない隊の魂のうち最も低いLvか
// (街の「魂を鍛える」はこれだけを勧め、隊のレベルを揃えていく)
function opsTrainableList() {
  const out = [];
  let floor = Infinity;
  for (const d of G.party) {
    if (!d || d.primary == null) continue;
    const e = soulByUid(d.primary);
    if (!e) continue;
    const cap = soulLevelCapOf(e);
    if (e.level < cap) floor = Math.min(floor, e.level);
    const cost = Math.max(1, soulTrainCost(e.level) - (e.exp || 0));
    if (e.level < cap && G.soulPts >= cost) out.push({ doll: d, uid: e.uid, cost, level: e.level, cap });
  }
  for (const x of out) x.lowest = x.level === floor;
  return out.sort((a, b) => a.level - b.level || a.cost - b.cost);
}
const OPS = {
  // バッジ・提案・帰還の報告で使う数 (状態は変えない)
  counts() {
    const dolls = allDolls();
    let unid = 0, unidCost = 0;
    for (const d of dolls) for (const it of (d.items || [])) if (it && it.unidentified) { unid++; unidCost += appraiseCost(it); }
    const junk = opsJunkList();
    const dead = dolls.filter((d) => d.isDoll && !d.alive);
    let repairCost = 0, hastenCost = 0, rescuing = 0;
    for (const d of dead) {
      if (awaitingRescue(d)) { rescuing++; hastenCost += hastenCostOf(d); }
      else repairCost += repairCostOf(d);
    }
    let ach = 0, treasuryReady = false;
    try { ach = opsClaimableAchievements().length; } catch (e) { ach = 0; }
    try { treasuryReady = treasuryRewardReady(); } catch (e) { treasuryReady = false; }
    return {
      hurt: G.party.filter((p) => p.alive && (p.hp < p.maxhp || p.mp < p.maxmp)).length,
      dead: dead.length, rescuing, repairable: dead.length - rescuing,
      unid, unidCost,
      junk: junk.length, junkGold: junk.reduce((a, j) => a + j.price, 0),
      ach,
      donatable: opsNewKindCount(),
      deliverable: (G.deliveryQuests || []).filter((q) => q && deliveryHolder(q.itemId)).length,
      trainable: opsTrainableList().length,
      innCost: innCost(), repairCost, hastenCost, treasuryReady,
    };
  },
  junkList: opsJunkList,
  trainableList: opsTrainableList,
  claimableAchievements: opsClaimableAchievements,
  donatableList: opsDonatableList,
  newKindCount: opsNewKindCount,

  // 宿で休む (宿屋の「泊まる」と同じ: 宿賃 innCost・生きている者のHP/MP全快と状態異常の回復)
  restParty() {
    if (G.state !== "town" || !opsFacilityOpen("inn")) return { ok: false, reason: "closed" };
    const cost = innCost();
    const need = G.party.filter((p) => p.alive && (p.hp < p.maxhp || p.mp < p.maxmp));
    if (!need.length) return { ok: false, reason: "none", cost };
    if (G.gold < cost) { log("お金が足りない。", "sys"); SFX.ng(); return { ok: false, reason: "gold", cost }; }
    G.gold -= cost;
    for (const p of G.party) { if (p.alive) { p.hp = p.maxhp; p.mp = p.maxmp; p.ailment = null; } }
    SFX.heal(); buzz(20);
    log("ぐっすり眠った。HPとMPが全快した。", "heal");
    showToast(`宿で休んだ — HP・MP全快 (💰${cost})`, { tone: "good" });
    renderTown();
    return { ok: true, cost, n: need.length };
  },

  // まとめて鑑定 (隊と控えの全員の未鑑定品を、安い順に所持金が続く限り。鑑定料 appraiseCost は単体と同じ)
  identifyAll() {
    if (G.state !== "town" || !opsFacilityOpen("shop")) return { ok: false, reason: "closed", n: 0, spent: 0 };
    const list = [];
    for (const d of allDolls()) for (const it of (d.items || [])) if (it && it.unidentified) list.push(it);
    list.sort((a, b) => appraiseCost(a) - appraiseCost(b));
    let n = 0, spent = 0;
    for (const it of list) {
      const cost = appraiseCost(it);
      if (G.gold < cost) break;
      G.gold -= cost; spent += cost;
      revealIdentity(it);
      n++;
    }
    if (n > 0) {
      SFX.itemget(); buzz(15);
      log(`まとめて鑑定: ${n}点を鑑定した (💰${spent})。`, "win");
      showToast(`${n}点を鑑定した (💰${spent})`);
    } else if (list.length) { log("お金が足りない。", "sys"); SFX.ng(); }
    renderTown();
    return { ok: n > 0, n, spent, left: list.length - n };
  },

  // まとめて売る (opsJunkList の品を売値 sellPrice で。売った品は商店の在庫に並ぶ = 単体の売却と同じ)
  sellJunkAll(opts) {
    if (G.state !== "town" || !opsFacilityOpen("shop")) return { ok: false, reason: "closed", n: 0, gold: 0 };
    let n = 0, gold = 0;
    for (const { doll, item, price } of opsJunkList(opts)) {
      const idx = doll.items.indexOf(item);
      if (idx < 0) continue;
      doll.items.splice(idx, 1);
      G.gold += price; gold += price;
      if (item.id) G.shopStock[item.id] = (G.shopStock[item.id] || 0) + 1;
      codexSeeItem(item.id, item);
      n++;
    }
    if (n) {
      SFX.select(); buzz(10);
      log(`まとめて売却: ${n}点を売った (+💰${gold})。商店に並んだ。`, "win");
      showToast(`${n}点を売却 (+💰${gold})`);
    }
    renderTown();
    return { ok: n > 0, n, gold };
  },

  // 今すぐ連れ帰る (全滅で残された器。赤い魂1つで20分短縮を、残りの少ない者から順に所持の続く限り。押す回数ぶんと同じ値段)
  hastenAll() {
    const wait = allDolls().filter(awaitingRescue).sort((a, b) => a.reviveAt - b.reviveAt);
    let spent = 0, arrived = 0;
    for (const d of wait) {
      while (awaitingRescue(d) && G.redSoul >= 1) {
        G.redSoul -= 1; spent++;
        d.reviveAt -= RESCUE_SHORTEN_MS;
        if (d.reviveAt <= Date.now()) { rescueArrive(d, true); arrived++; }
      }
    }
    if (!spent) {
      if (wait.length) { log("Red Soul が足りない。", "sys"); SFX.ng(); }
      return { ok: false, spent: 0, arrived: 0 };
    }
    SFX.select(); buzz(15);
    if (arrived < wait.length) log(`赤い魂を ${spent} 捧げ、連れ帰りを早めた。`, "sys");
    updateTopbar();
    if (G.statusOpen) renderStatus();
    if (G.state === "town") renderTown();
    renderParty();
    return { ok: true, spent, arrived, left: wait.length - arrived };
  },

  // まとめて拝受 (勲章の間で1つずつ拝受するのと同じ報酬。段階表は次の段階が達成済みなら続けて)
  claimAllAchievements() {
    let n = 0, gold = 0, red = 0, soul = 0;
    for (let guard = 0; guard < 1000; guard++) {
      const ready = opsClaimableAchievements();
      if (!ready.length) break;
      for (const a of ready) {
        if (G.ach[a.id] || !a.cond()) continue;
        G.ach[a.id] = true;
        if (a.reward.gold) { G.gold += a.reward.gold; gold += a.reward.gold; }
        if (a.reward.redSoul) { G.redSoul += a.reward.redSoul; red += a.reward.redSoul; }
        if (a.reward.soulPts) { G.soulPts += a.reward.soulPts; soul += a.reward.soulPts; }
        log(`勲章「${a.name}」を授かった！`, "win");
        n++;
      }
    }
    if (!n) return { ok: false, n: 0 };
    const msg = [gold ? `💰${gold}` : "", red ? `🔴${red}` : "", soul ? `✦${soul}` : ""].filter(Boolean).join(" ");
    SFX.levelup(); buzz([0, 30, 60, 30]);
    flashScreen("#c9a22744");
    showToast(`勲章 ${n} を拝受 ${msg}`);
    updateTopbar();
    renderTown();
    return { ok: true, n, gold, redSoul: red, soulPts: soul };
  },

  // 収集品を1点奉納 (宝物庫から開いた品シートの「奉納」)
  // 奉納済みの種類なら売却と同じ金貨を受け取る
  donateOne(doll, it) {
    if (!doll || !it || it.slot !== "misc") return { ok: false };
    const r = donateCollectible(doll, it);
    if (!r) return { ok: false };
    SFX.itemget();
    if (r.gold) updateTopbar();
    autosave();
    if (r.gold) {
      log(`${itemName(it)} を宝物庫に奉納し、${r.gold} ゴールドを受け取った。`, "win");
      showToast(`${itemName(it)} を奉納した (💰${r.gold})`);
    } else {
      log(`${itemName(it)} を宝物庫に奉納した。`, "win");
      showToast(`${itemName(it)} を奉納した`);
    }
    renderTown();
    return { ok: true, gold: r.gold, rewardReady: treasuryRewardReady() };
  },

  // 未奉納の収集品をまとめて奉納 (宝物庫の「収集品を奉納」→ 詳細のシートの「奉納する」)
  // 奉納済みの種類・重なった品は売却と同じ金貨に換わる
  donateAllNew() {
    const list = opsDonatableList();
    if (!list.length) return { ok: false, n: 0 };
    let kinds = 0, gold = 0;
    for (const h of list) {
      const r = donateCollectible(h.doll, h.item);
      if (!r) continue;
      if (r.kind === "new") kinds++;
      gold += r.gold;
    }
    SFX.itemget();
    if (gold) updateTopbar();
    autosave();
    const parts = [];
    if (kinds) parts.push(`新たに ${kinds} 種を台帳に記した`);
    if (gold) parts.push(`${gold} ゴールドを受け取った`);
    log(`収集品 ${list.length} 点を宝物庫に奉納した。${parts.join("・")}。`, "win");
    showToast(`収集品 ${list.length}点を奉納した${gold ? ` (💰${gold})` : ""}`);
    renderTown();
    return { ok: true, n: list.length, kinds, gold, rewardReady: treasuryRewardReady() };
  },

  // 魂を n 段強化する (n = Infinity で上限まで)。1段ごとの費用・上限は trainSoul と同じ。
  // 結果に宿主の能力の伸び (deltas) と新たに覚えた技 (gainedSkills) を添える。迷宮の中では鍛えられない
  trainTimes(uid, n = 1) {
    const e = soulByUid(uid);
    if (!e || G.state !== "town") return { ok: false, levels: 0, spent: 0 };
    const wearer = allDolls().find((d) => d.primary === uid || (d.subs || []).some((x) => x && x.uid === uid)) || null;
    const KEYS = ["maxhp", "maxmp", "atk", "vit", "agi", "int", "pie", "luk"];
    const before = wearer ? Object.fromEntries(KEYS.map((k) => [k, wearer[k] || 0])) : null;
    const beforeSpells = new Set(wearer ? (wearer.spells || []) : []);
    const from = e.level;
    let spent = 0, levels = 0;
    for (let i = 0; i < n; i++) {
      if (e.level >= soulLevelCapOf(e)) break;
      const cost = Math.max(1, soulTrainCost(e.level) - (e.exp || 0));
      if (G.soulPts < cost) break;
      G.soulPts -= cost; spent += cost;
      e.level++; e.exp = 0;
      levels++;
    }
    if (!levels) {
      log(e.level >= soulLevelCapOf(e) ? "これ以上レベルを上げられない。" : "Soul が足りない。", "sys");
      SFX.ng();
      return { ok: false, levels: 0, spent: 0, from, to: from };
    }
    recalcAllDolls({ levelUp: true });
    codexJobSee(e.clsKey, e.count, e.level);
    SFX.levelup(); buzz([0, 30, 40, 30]);
    log(`${soulSeriesName(e.clsKey)}の魂が Lv${from}→${e.level} に成長した！ (✦${spent})`, "win");
    // 能力の伸び: before/after は hp/mp/atk… の表示キーで (魂の区分の「強化の結果」に並べる)
    const sk = (k) => (k === "maxhp" ? "hp" : k === "maxmp" ? "mp" : k);
    const deltas = {}, statsBefore = {}, statsAfter = {};
    if (wearer && before) for (const k of KEYS) {
      statsBefore[sk(k)] = before[k]; statsAfter[sk(k)] = wearer[k] || 0;
      const d = (wearer[k] || 0) - before[k]; if (d) deltas[sk(k)] = d;
    }
    const gainedSkills = wearer ? (wearer.spells || []).filter((k) => !beforeSpells.has(k)) : [];
    const STAT_N = { hp: "HP", mp: "MP", atk: "ATK", vit: "VIT", agi: "AGI", int: "INT", pie: "PIE", luk: "LUK" };
    const grow = Object.entries(deltas).filter(([, v]) => v > 0).map(([k, v]) => `${STAT_N[k] || k}+${v}`).join(" ");
    showToast(`${soulSeriesName(e.clsKey)}の魂を強化 Lv${from}→${e.level}${grow ? ` ― ${grow}` : ""}`, { tone: "good" });
    renderTown();
    return { ok: true, levels, spent, from, to: e.level, deltas, before: statsBefore, after: statsAfter, gainedSkills, wearer };
  },
};
Object.assign(ops, OPS);

// ==== UI 契約のスタブ (Phase 0)。各パッケージの install() が本物に差し替える ====
// どれも「いまの画面のまま動く」最小の実装。呼び出し側は差し替えの有無を気にせず使える
function registerPhase0Stubs() {
  registerUI({
    // ---- キット ----
    toast: kitToast, sheet, confirm: kitConfirm,
    // ---- WP-A: 街・王宮・物語・設定 ----
    openSettings: () => openSettings(),
    playStoryChain: (pages, done) => {
      const list = (pages || []).filter(Boolean);
      const next = (i) => {
        if (i >= list.length) { if (done) done(); return; }
        const p = list[i];
        showStoryScene(p.title || "", p.lines || [], p.reward || null, () => next(i + 1), p.btnLabel || "御意");
      };
      next(0);
    },
    registerSuggestion: (fn) => { if (typeof fn === "function") (UI._suggestions || (UI._suggestions = [])).push(fn); },
    // ---- WP-B: 隊 ----
    openParty: (idx = 0) => openStatus(idx),
    autoEquip: () => ({ ok: false, moves: 0 }),
    betterGearCount: () => 0,
    trainableList: () => opsTrainableList(),
    equipItemTo: (doll, item) => {
      const owner = allDolls().find((d) => (d.items || []).includes(item));
      const key = slotKeyFor(item, doll);
      if (!owner || !key || !canEquip(doll, item) || !G.party.length) return { ok: false };
      equipFromAnywhere(doll, key, { it: item, owner });
      return { ok: true };
    },
    bestWearer: (item) => {
      if (!item || item.unidentified || !isEquippable(item)) return null;
      let best = null, bestScore = 0;
      for (const d of G.party) {
        if (!d || !d.alive || !canEquip(d, item)) continue;
        const sc = gearScore(d, equipPreviewDelta(d, item));
        if (sc > bestScore) { best = d; bestScore = sc; }
      }
      return best;
    },
    // ---- WP-C: 商会・品 ----
    loot: (item, who, opts, next) => showItemGet(item, who, next),
    itemSheet: (item, { owner = null, context = "bag" } = {}) => showItemDetailPopup(owner, { item, from: context }),
    unidCount: () => OPS.counts().unid,
    junkList: (opts) => opsJunkList(opts),
    // ---- WP-D: 迷宮・出撃・帰還 ----
    openDeparture: () => tryEnterDungeon(),
    renderRunReport: () => null,
    openDungeonMenu: () => openSettings(),
  });
}

// ==== 戻る操作 (nav) の旧画面アダプタ ====
// nav.back() はまず開いているシートを閉じる。無ければここ (prio 10) → 街シェル (60) → 迷宮 (70) の順。
// 旧来の確認カード (.confirm-overlay) は背景タップ = 閉じる、を再現する。物語の語りは「全文を出す → 御意」
function closeLegacyOverlay(top) {
  if (top.classList.contains("story-overlay")) {
    const card = top.querySelector(".story-card");
    if (card && !card.classList.contains("revealed")) card.click();
    else { const ok = top.querySelector(".story-ok"); if (ok) ok.click(); }
    return;
  }
  top.dispatchEvent(new MouseEvent("click", { bubbles: true })); // 背景タップ
  if (!top.isConnected) return;
  const cancel = [...top.querySelectorAll("button")].find((b) => /^(やめ|閉じる|とじる|戻る)/.test(plainText(b.textContent)));
  if (cancel) cancel.click();
  else kitShake(top.querySelector(".ig-card") || top);
}
function legacyBack() {
  if (titleActive || openingActive) return "root";
  const ovs = document.querySelectorAll(".confirm-overlay");
  const top = ovs[ovs.length - 1];
  if (top) { closeLegacyOverlay(top); return true; }
  if (itemGetEl && !itemGetEl.classList.contains("hidden")) {
    if (typeof itemGetEl.onclick === "function") itemGetEl.click(); // 選択肢の無いカードは背景タップで閉じる
    else kitShake(itemGetEl.querySelector(".ig-card") || itemGetEl); // 踏破の凱旋など、ボタンで進める
    return true;
  }
  if (G.settingsOpen) { closeSettings(); return true; }
  if (G.statusOpen) { closeStatus(); return true; }
  if (G.prompt) return true; // 演出の最中 (階の暗転など) は何もしない
  return false;
}
// 迷宮: 盤面 = 手帳 (Phase 0 は設定) / 戦闘 = オートを止めるだけ / 全滅 = 何もしない (決断を迫る)
function dungeonBack() {
  if (G.state === "board") { if (!G.anim && !G.walking) UI.openDungeonMenu(); return true; }
  if (G.state === "combat") { if (G.autoCombat) stopAutoCombat(); return true; }
  if (G.state === "over") return true;
  return false;
}

// ==== UI 基盤の結線 (init の冒頭で一度) ====
function wireUI() {
  bindGame({
    G, log, autosave, buzz, flashScreen, shakeScreen,
    renderTown, renderBoard, renderParty, renderRunbar, updateTopbar, renderStatus,
    allDolls, recalcAllDolls, inDungeon, curDungeon, activeCfg, dungeonNumber, clearedDungeonCount, reportedDungeonCount,
    sellPrice, buyPrice, appraiseCost, innCost, sellWarnings, bargainMul,
    itemRankName, itemRankColor, itemGradeText, itemNameEl, logClassForItem,
    showChoice, closePrompt, showEvent, showConfirm, showToast, showItemGet, closeItemGet, showItemDetailPopup, showStoryScene,
    openStatus, closeStatus, openSettings, closeSettings, tryEnterDungeon, enterDungeon, returnToTown, confirmReturnToTown,
    tutorialAllowed, palaceCallReady, currentObjective, featureUnlocked, contentSealed, reportMainQuest, acceptMainQuest, reportPending, blockForReport, tutorialPending, blockForTutorial,
    trainSoul, raiseSoulCap, soulTrainCost, soulByUid, codexSeeItem, treasuryState, heldCollectibles, donateCollectible,
    claimAchievement, claimTreasury, treasuryRewardReady, deliveryHolder, deliveryStatus, deliverQuest,
    repairDoll, repairCostOf, tryHastenRescue, reviveTimerEl, fmtRemain, awaitingRescue, hastenCostOf,
    doEquip, doUnequip, equipFromAnywhere, openEquipChooser, useItem, dropItem, transferItem,
    stopAutoCombat, sceneBgm, playBgm, SFX,
    ACHIEVEMENTS, FACILITIES, FAC_SHELL, CONTENT_LIMIT, DUNGEONS, LAYER_VISUALS,
    isTitleActive: () => titleActive,
    isOpeningActive: () => openingActive,
    resetTownSelection: () => { altarSel = null; },
  });
  nav.init();
  nav.handle(legacyBack, 10);
  nav.handle(dungeonBack, 70);
  registerPhase0Stubs();
  townshell.install();
  // 旧 #item-get (showItemGet 等) が開いたら、キットのプロンプトは置き換えられたものとして閉じる (旧実装の1枠と同じ)
  if (typeof MutationObserver === "function" && itemGetEl) {
    new MutationObserver(() => {
      if (!itemGetEl.classList.contains("hidden") && promptSheet) { const h = promptSheet; promptSheet = null; h.close("replace", { silent: true }); }
    }).observe(itemGetEl, { attributes: true, attributeFilter: ["class"] });
  }
  // 各パッケージの UI を登録 (スタブを差し替える)。A→B→C→D の順
  for (const m of [uiHub, uiPalace, uiFacilities, uiSettings, uiStory, uiParty, uiSoulPanel, autoEquip, uiShop, uiLoot, uiAppraise, uiDeparture, uiDungeonHud, uiResults, uiTutorial]) {
    try { m.install(); } catch (e) { console.error(e); }
  }
}

// ==== [WP-A] UI API ==== (街・王宮・物語・設定・タイトル: WP-A が所有)
// 街タブ・王宮タブ・酒場/祠のページ・宿のシート・設定のシート・物語の場面 (src/ui/hub.js ほか) が使う game.js の内部。
// 読み込み時に一度 bindGame で結ぶ (wireUI の bindGame と同じ窓口に足し込む。名前は重ねない)
function resetAllData() { _resetting = true; clearSave(); location.reload(); }
bindGame({
  // いまの目標・勅命・物語
  objectiveInfo, decreeInfo, replayDecree, palaceRecords, sharePalaceRecord, departTo, goMakeDoll, audienceTutorial,
  landOnHub, legacyToPage, townBgm,
  // 勲章・宝物庫・図鑑
  achievementCards, claimNextTreasury, TREASURY_MILESTONES, milestoneLabel, totalDonatedKinds,
  codexMonEntry, dungeonRoster, CODEX_OTHER,
  // 酒場・祠・宿
  listenRumor, RUMOR_PRICE, rumorPrice, ensureDeliveryQuests, deliveryRewardDesc, rollTavernCrowd,
  adCooldownLeft, watchShrineAd, RED_PACKS, buyRedPack, GUARDIAN_COST, RESCUE_SHORTEN_MS,
  // 設定 (端末の好み)
  PREFS, savePrefs, setVolumes, isMuted, toggleMute, ensureAudio, updateMuteBtn, resetAllData, confirmReset,
  // 他のパッケージも使える街の部品 (肖像・図鑑の詳細)
  showCodexMonDetail, showCodexItemDetail, showCodexJobDetail,
});
// ==== /WP-A ====

// ==== [WP-B] UI API ==== (隊・魂・最適装備: WP-B が所有)
// 隊 (src/ui/party.js)・魂 (src/ui/soulpanel.js) が使う game.js の内部を結ぶ (モジュールの読み込み時 = init より前)。
// 契約 (UI.openParty / autoEquip / betterGearCount / trainableList / equipItemTo / bestWearer) は各モジュールの install() が登録する
bindGame({
  equipAt, moveItem, campCast, campSpellsOf, healAll, healAllNeed, repairCostOf, repairCostAll, repairDoll, setReviveTimers, hastenCostOf, tryHastenRescue, awaitingRescue, RESCUE_SHORTEN_MS,
  emptyDollCost, randomDollName, finalizeBuyDoll, soulSortCmp, soulRankOf, soulWorn, soulWornByOther,
  equipSoulToSlot, fuseCandidates, fuseSoul, toggleSoulLock, openFusePicker, openSubSkillPicker, slotSoul,
  unlockedSubSlots, orderSeats, orderSeatedUids, toggleOrderSeat, showCodexJobDetail, addSoulInstance, codexSweepJobs,
  canIdentify, identifyChance, openIdentifyChooser, doIdentifySkill, itemKnown, isFirstGet,
  showRankUp, announceJobChange, showNameInput,
});
// ==== /WP-B ====

// ==== [WP-C] UI API ==== (商会・品・入手: WP-C が所有)
// 商会 (src/ui/shop.js) と品シート・入手 (src/ui/loot.js) が使う単体操作を結ぶ。
// 値段・判定はすべて上の単体操作のまま (釣り合いは変えない)。モジュールの評価時に結び、init の bindGame で補われる
bindGame({
  sellItem, buyItem, shopIdentify, openIdentifyChooser, doIdentifySkill, addIdentifyAction,
  giveItem, markDungeonLoot, refundLR, cloneItem, SHOP_INIT_STOCK,
});
// ==== /WP-C ====

// ==== [WP-D] UI API ==== (迷宮・出撃・帰還・戦果: WP-D が所有)
// 出撃シート・迷宮の HUD・戦果/帰還の報告 (src/ui/departure.js / dungeonhud.js / results.js) が使う game.js の内部。
// モジュールの評価時 (init より前) に結ぶ。init の wireUI が同じ game へ残りを足す
bindGame({
  // 出撃
  departNow, departAbyss, townMutatorFor, preDiveIssues, DUNGEON_BRIEFING, CONTENT_NEXT_LAYER,
  abyssRecords, ABYSS_MODS, abyssScoreMul, weekSeedId, emptyDollCost,
  // 迷宮の HUD
  specialDef, mutDef, eliteKey, dungeonObjective, abyssActive, abyssBossPending, findRevealedStairs, canReturnNow,
  ABYSS_MUT_MAP, dungeonTheme, eventFacts,
  // 戦果・帰還の報告
  celebrateSoul, leaveDungeon,
  // 記録の履歴 (記録欄のタップ / 手帳の「記録を読む」)
  logHistory,
});
// ==== /WP-D ====

// ---- 起動 ----
// タイトル画面のセーブ概要 (つづきから): 進行中の章・踏破数・編成の顔ぶれ
function titleSummary() {
  const ms = G.msq || {};
  let head = "着任したばかりの操霊師";
  if (ms.state === "end" || ms.n > 100) head = "✦ 物語を閉じた操霊師 ✦";
  else if (ms.n >= 1) head = `第${actOf(ms.n)}層「${ACTS[actOf(ms.n) - 1].title}」`;
  const lines = [`踏破 ${clearedDungeonCount()} / 100 迷宮 ・ 人業 ${allDolls().length}体`];
  if (G.state === "board" || G.state === "combat") {
    lines.push(abyssActive() ? `探索中 — 奈落 B${G.abyss.depth}F` : `探索中 — ${curDungeon().name} B${G.floor}F`);
  }
  lines.push(`💰${G.gold}　✦${G.soulPts}　🔴${G.redSoul}`);
  const sprites = (G.party || []).filter((d) => d && d.primary != null).map((d) => dollBust(d));
  return { head, lines, sprites };
}

function init() {
  // UI 基盤 (ctx の結線・戻る操作・街シェル・各パッケージ) を最初の描画より前に整える
  wireUI();
  // 早期にフックを公開 (起動失敗の誤検出/デバッグ用)
  window.__game = { G, edgeOpen, COLS, ROWS, autosave, loadGame, clearSave, renderTown, ACHIEVEMENTS, questProgress, pickLoot, showItemGet, startBattle, spawnCardEnemies, spawnBossEnemies, activeCfg,
    UI, ops, nav, townshell,
    // 迷宮のイベント (出来事) の検証用
    ev: { evApi, runEvent, eventFightWon, EVENT_MAP, enterDungeon, newFloor, descend, resolveCell, renderBoard, endBattle, evNewFloor, evProgress, eventFacts, makeDoll, addSoulInstance, recalcDoll, evUnit } };

  let loaded = false;
  try { loaded = loadGame(); } catch (e) { loaded = false; }
  if (!loaded) {
    setupNewGame();
    G.state = "town";
    log("百の迷宮と 魂の王へようこそ。人業に魂を宿し、深淵へ挑め。", "sys");
  } else {
    log("冒険を再開する。", "sys");
  }

  // まずタイトル画面。タップで目覚め (ここで音声が解禁されタイトル曲が流れる)、
  // 「冒険をはじめる/つづける」で本編へ。再開処理 (戦闘の自動進行など) はタイトルを閉じてから行う
  titleActive = true;
  G.prompt = true;
  playBgm("title"); // 音声起動前なら初回タップ時に開始される
  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    titleActive = false;
    G.prompt = false;
    startAfterTitle(loaded);
  };
  // タイトルの「はじめから」(記録あり): 確認ののち記録を消して読み直し、タイトルを飛ばして序章から始める
  const newGameFromTitle = () => {
    _resetting = true;
    clearSave();
    try { sessionStorage.setItem("dos-newgame", "1"); } catch (e) {}
    location.reload();
  };
  let freshStart = false;
  try { freshStart = sessionStorage.getItem("dos-newgame") === "1"; sessionStorage.removeItem("dos-newgame"); } catch (e) {}
  if (freshStart && !loaded) start();
  else {
    try {
      showTitle({ hasSave: loaded, summary: loaded ? titleSummary() : null, onStart: start, onNewGame: loaded ? newGameFromTitle : null });
    } catch (e) { start(); }
  }

  if ("serviceWorker" in navigator) {
    // 新しい SW が制御を奪った瞬間に1度だけ確実にリロード (古いJS混在を防ぐ)。
    // 初回インストール (それまで SW の制御下になかった) の claim では読み直さない
    // (同じ版を読み込み済みのため不要。オープニング途中で画面が飛ぶのを防ぐ)
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!hadController || reloaded) return; reloaded = true; location.reload();
    });
    navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then((reg) => {
      reg.addEventListener("updatefound", () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener("statechange", () => {
          if (sw.state === "activated" && hadController && navigator.serviceWorker.controller && !reloaded) {
            reloaded = true; location.reload();
          }
        });
      });
    }).catch(() => {});
  }
}

// タイトルを抜けた後の本編起動: 保存状態の復元描画 → (新規なら) オープニング
function startAfterTitle(loaded) {
  updateTopbar();
  // 復元描画に失敗してもセーブは絶対に消さない (データ保全優先)。
  // 失敗時は安全に街表示へフォールバックする。
  try {
    resumeFromState();
  } catch (e) {
    try {
      G.state = "town"; G.town = { facility: null, sub: null, tab: "hub", page: null };
      G.statusOpen = false; G.settingsOpen = false; G.prompt = false; G.anim = null; G.walking = false;
      renderTown();
    } catch (e2) { /* これ以上は何もしない (セーブは温存) */ }
  }
  autosave(true);

  if (loaded) {
    playBgm(sceneBgm());
    setTimeout(() => { try { showToast("💾 冒険を再開しました"); } catch {} }, 400);
    return;
  }
  // 新規ゲーム: オープニングを流してから街へ
  G.prompt = true;
  openingActive = true;
  playBgm("opening");
  try {
    showOpening(() => { G.prompt = false; openingActive = false; playBgm(sceneBgm()); });
  } catch (e) { G.prompt = false; openingActive = false; playBgm(sceneBgm()); }
}
init();
