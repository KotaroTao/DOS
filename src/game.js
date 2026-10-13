import { insightTotals } from "./insight.js";
import { INF_BUY_CAP, infRecovery, infUseCount, infSupplyLeft, infSpendSupply } from "./infsupplies.js";
import { random, fxRandom, bindRngState, rngState } from "./rng.js";
import { refSerialize, refDeserialize, applySavePatch } from "./savegraph.js";
import { cloudEnabled, cloudReady, cloudBusy, connectCloud, cloudSave, cloudBattle, cloudFlush, cloudFatal } from "./cloud-save.js";
import { syncEnemyUids } from "./combat.js";
import { monsterResists } from "./resistance.js";
// メインゲーム: カードボード探索 ⇄ 戦闘 (モンスターメーカー風)
import { makeBoard, COLS, ROWS } from "./board.js";
import { MONSTERS, HERO, ICONS, drawSpriteFit } from "./sprites.js";
import { spawnCardEnemies, spawnBossEnemies, spawnEliteEnemies, spawnMimic, spawnRanked, spawnMetal, setEnemyLvTag, scaleFoeAgi, Battle, SPELLS, cloneItem, spellCost, soulPowerMul, healsHp, spellHealRaw, healOnTarget, setOnEnemyKilled, setEquipSwap, setModSink, setElemKnown, setPartyEvadeBonus, setPartyBreathBonus, setPartyHitBonus, partyBreathRes, perkVictory, cureAil, canSpellCure, cureBySpell, spellCureKinds, chishioState } from "./combat.js";
import { decideAuto, tacticOf, setResistKnown } from "./autotactics.js";
import { STAGED, effectStage, stageOf, stageMul, stageLabel, isBattleLong, ENEMY_STAT_LABEL } from "./buffstage.js";
import { initAudio, SFX, playBgm, toggleMute, isMuted, setVolumes } from "./audio.js";
import { spriteCanvas, crispCanvas, drawPhoto, photoReady, whenPhoto, setSpriteResolver } from "./sprites.js";
import { makeItemSpriteResolver } from "./itemart/index.js";
import {
  ITEMS, SLOTS, SLOT_LABEL, MAX_ITEMS, shareInventory, setBagSource, bagOwners, equip as equipItem, unequip as unequipItem, canEquip, canOffhand, slotKeyFor, lvToRank, RANGE_LABEL, HAND_LABEL, weaponRange, SHIELD_KIND_LABEL, shieldKind,
  registerEquipLevel, equipLevelOf, equipLvShort, equipFailMsg, registerAffixes,
  UNIDENT_SLOTS, itemName, applyForge, hasQuality, applyQuality, rollQuality, qualityMatters, itemAtQuality, QUALITY_MID, useWhere, useTarget, useHelps, useLines, useCureKinds, compareUse,
} from "./items.js";
import { equipLevelFor, LR_UNLOCK, LOOT_R_HEADROOM } from "./equiplevel.js";
import { rollAffixes, applyAffixes, gearPerks, affixPower, affixLines, AFX_TIERS } from "./infaffix.js";
import { EVENT_MAP, EV_FLOOR_RATE, EV_FLOOR_RATE_D1, EV_BOONS, permanentEventStats, eligibleEvents, pickEvent, onceKey, runEvent, eventFightWon } from "./events.js";
import { ITEM_RANK_NAME, ITEM_RANK_COLOR } from "./content.js";
import { pickTavernCrowd, TALK_MAP } from "./tavern.js";
import { FIXED_QUESTS, FIXED_BY_ID, FREE_CAP, QUEST_LV_NEAR, rollBoard, deliveryRewardRows, NPCS, npcOf, composeReport, bondGiftAt, npcBondLabel, TIP_RATE, hasBell, BELL_EVERY_MS, QUEST_REWARD_K, QUEST_RK, questRewardK, COMMON_KEY as QUEST_COMMON_KEY } from "./quests.js";
import { CHAPTERS, CHAPTER_END, TUT_INTRO, TUT_THREE_REPORT, TUT_FINALE, STORY_CELLS, storyCellAt, BOSS_MEMORIES, REPORTS, LATE_CLUES, IRENE_BEATS, MINE_PASS, msqReward, EPILOGUE, UNLOCKS, unlockSceneFor, REMATCH_MEMORIES } from "./story.js";
import { CATALOG_ITEMS } from "./catalog/index.js";
import { poolAt, powerAt } from "./dungeons/world.js";
import { NAMED_FOES, NAMED_IDS, TROPHY_OF, HUNT_ELITE_RATE, bountyId } from "./dungeons/named.js";
import { FLOOR_HAZ, hazSkin, hazPlaced, layerFloorHaz } from "./dungeons/floorhaz.js";
import { DUNGEONS, WORLD_IDS, worldIndexOf, worldById, gateFloors, isGateFloor, dungeonLevel, dungeonLevelRaw, strengthAt, wallOf, wallStepOf, lootBand, abyssLayer, ABYSS_LAYER_FLOORS, hazardsAt, levelBand, DUNGEON_MONSTERS, ELEMENTS, elementAffinity, elemDmgMult, ELITE_ORDER, LAYER_ELITES, LAYER_BOSS, LAYER_POOLS, monsterTraits, resistHpMul, isFloating, METAL_TIERS, unknownLabel, unknownTag } from "./dungeons/index.js";
import {
  INF_NAME, INF_REST_EVERY, INF_HAZ_FROM, INF_PARTY, INF_RULES, INF_RULE_MAP, INF_LV, infLevel, infGrowthMul, infEnemyMul, infRedCost, isRestFloor,
  rollInfRule, rollStartSouls, VESSEL_NAMES, mulberry32,
} from "./abyss.js";
import { INF_TITLES, INF_TITLE_MAP, INF_DEPTH_TITLES } from "./inftitles.js";
import {
  SOUL_CLASSES, SOUL_KEYS, makeDoll, jobSprite, dollSprite, jobBust, dollBust, dollLookKey, soulIcon,
  recalcDoll, setPermanentStatSource, isUniqueJob, soulLevelCap, soulLevelCapOf, emberCostOf, setSharedSouls, syncDollUids, MAX_SUBS, subPicks,
  soulByUid, makeSoulInstance, soulRankOf, soulLearnedSkills, soulLearnedPassives, soulLabel, subPickCap, jobStatsOf,
  awakenPerkOf, subPickCapOfRank, subStatRateOfRank, setOrderSource, orderStatRateOfRank, setSkillGate, skillUsable,
  PASSIVES,
  SOUL_RANKS, rollJobClass, rollGreatJobClass, SOUL_STAT_UP,
  soulRankFromCount, capForRarityRank, jobRankName, soulSeriesName, pLv,
  identifyChance, canIdentify,
  battleSkills, autoSkills,
} from "./souls.js";
import { showOpening } from "./opening.js";
import { kingCanvas, prewarmTown } from "./townart.js";
import { prewarmStoryArt } from "./storyart.js";
import { drawBattleBackdrop } from "./backdrops.js";
import { paintCryptFloor, paintCryptSlabs, paintCryptWalls, CATACOMB, genericMaterial, boardSeed, hexRgb } from "./crypt.js";
import { cryptPainting, paintCryptMaterials, paintCryptMasonry } from "./cryptpaint.js";
import { CORPSE_FAMILIES, CORPSE_STATES, corpseArtKey } from "./corpseart.js";
import { prewarmCryptActors, cryptPropKey, cryptPropBitmap, cryptWalkerBitmap, cryptPropSprite } from "./cryptactors.js";
import { normalizeName, storyText } from "./protagonist.js";
import { showTitle } from "./title.js";
import { RARITIES, rarityKey, rarityColor, rarityLabel, rollRarity, layerRarityUp } from "./rarity.js";
// ---- UI 基盤 (Phase 0)。新しい UI モジュールは game.js を import せず、ctx.js の UI/game/ops を通す ----
import { UI, ops, bindGame, registerUI } from "./ui/ctx.js";
import { el, svgIcon, btn, button as kitButton, longPress as attachLongPress, uiBlocked, sheetDepth, sheet, toast as kitToast, setToastEcho, confirm as kitConfirm, plainText, shake as kitShake } from "./ui/kit.js";
import { nav } from "./ui/nav.js";
import { installPhraseWrap, phrase, ZWSP } from "./ui/phrase.js";
import * as townshell from "./ui/townshell.js";
import { skillDescription, showSkillPopup,
  SPELL_KIND_COLOR, BUFF_NAME, tagRow, spellTagKinds, isEquippable, equipPreviewDelta, equipCompareEl, detailLines,
  equipClassText, equipPartyChips, gearScore, enemyReveal, enemyLabel, enemyUnknown, UNKNOWN_COLOR, setLogText,
} from "./ui/itemview.js";
import * as uiHub from "./ui/hub.js";
import * as uiPalace from "./ui/palace.js";
import * as uiFacilities from "./ui/facilities.js";
import * as uiSettings from "./ui/settings.js";
import * as uiJournal from "./ui/journal.js";
import { seedJournal, storyMediaUrls } from "./journal.js";
import { storyImage } from "./archive-stories.js";
import * as uiStory from "./ui/story.js";
import * as uiParty from "./ui/party.js";
import * as uiSoulPanel from "./ui/soulpanel.js";
import * as autoEquip from "./autoequip.js";
import * as uiShop from "./ui/shop.js";
import * as uiLoot from "./ui/loot.js";
import * as uiDeparture from "./ui/departure.js";
import * as uiDungeonHud from "./ui/dungeonhud.js";
import { walkerLook, normalizeLook, WALKER_LOOK_DEFAULT } from "./walkerart.js";
import * as uiResults from "./ui/results.js";
import * as uiAppraise from "./ui/appraise.js";
import * as uiTutorial from "./ui/tutorial.js";
import * as uiReforge from "./ui/reforge.js";
import * as uiInfinite from "./ui/infinite.js";
import * as uiDiscard from "./ui/discard.js";

// キャンバスに描く文字の書体 (画面の明朝と揃える)
const CANVAS_SERIF = '"Shippori Mincho B1", "Hiragino Mincho ProN", "Yu Mincho", "YuMincho", "Noto Serif JP", "Noto Serif CJK JP", serif';
// 視差・揺れを抑える設定 (OSの「視差効果を減らす」)。待機アニメなどを止める
const REDUCED_MOTION = (() => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } })();
import { pickTrap, CHEST_RANKS, rollChestRank } from "./traps.js";
import { refSoul, refGold, trainCost, lvPow, emberMul, partyAgi, LOCK_K, TRAP_K, lockPow } from "./levelcurve.js";
import { STABILITY_MAX, STABILITY_ENTRY_COST, STABILITY_RECOVERY_MS, recoverStability, stabilityWaitMs, stabilityRecoveryMs } from "./stability.js";
import { tlStability, tlStabilityTick, tlRedGain, tlOn, tlMeasure, tlWatchBattle, tlRunBegin, tlRunEnd, tlSnapshot, tlBattleBegin, tlHits, tlBattleEnd, tlLoot, tlLost, tlGain, tlTownGain, tlPlayTick, tlSoul, tlInfAttempt, tlInfFloor, tlInfSoul, tlInfEmbers, tlInfWipe } from "./telemetry.js";
import { repriceEquipment } from "./pricing.js";
import { spawnFx, drawBattleFx, weaponFxStyle, statusFxKind, skillProfile, ELEM_FX_COL, SIG_FX } from "./battlefx.js";
import "./battlefx-sig.js"; // 各職の看板技の専用演出を SIG_FX に登録する
import { enemyLvTag, fleeScaleOf } from "./enemylevel.js";

// ===== コンテンツの取り込み =====
// アイテム: 一点物の手作りカタログ (src/catalog/)。二つ名つきの量産品は廃止。
// モンスター: ダンジョン単位で手作りした図鑑 (src/dungeons/) を統合。
Object.assign(ITEMS, CATALOG_ITEMS);
// レア度の無い装備 (items.js の基本装備など) はコモン扱い。収集品・道具はレア度なし。
// 基本装備は商会の品揃え専用とし、迷宮のドロップ表からは外す (ドロップのコモンはランク別標準装備が担う)
for (const id in ITEMS) {
  const it = ITEMS[id];
  if (!it.rar && it.slot && it.slot !== "misc" && it.slot !== "use" && it.slot !== "mat") {
    it.rar = it.lr ? "lr" : "c";
    if (!CATALOG_ITEMS[id]) it.noDrop = true;
  }
}
// 装備の絵: どの装備もその品だけの絵で描く (SR・LR は手描き、ほかは部品の組み合わせ — src/itemart/)。
// 未鑑定の品はジャンルごとの伏せ絵 (剣の影 + ？ など) で描き、鑑定に成功して初めて本来の絵を見せる
const resolveItemSprite = makeItemSpriteResolver(ITEMS);
const paintedIcons = new Map(Object.keys(ICONS).filter(key => ["chest", "chestOpen", "stairs", "portal", "bossDoor", "trap", "event", "fountain", "fountainEmpty", "corpse", "corpseWarm", "corpseGreat", "wisp", "story", "ember", "gold", "poison", "guard", "start"].includes(key)).map(key => [ICONS[key], key]));
const corpseIcons = {};
for (const family of Object.keys(CORPSE_FAMILIES)) for (const state of CORPSE_STATES) {
  const key = family === "warrior" ? state : `${state}_${family}`;
  corpseIcons[key] = family === "warrior" ? ICONS[state] : { ...ICONS[state] };
  paintedIcons.set(corpseIcons[key], key);
}
function corpseIcon(cell) { return corpseIcons[corpseArtKey(cell)]; }
setSpriteResolver(spr => paintedIcons.has(spr) ? cryptPropSprite(paintedIcons.get(spr), spr) : resolveItemSprite(spr));
// 装備の値段は性能 (能力値・属性・耐性・効果) から付け直す (src/pricing.js)。
// 性能が同じ品は同じ値段、どこも同等以上の品は必ず高くなる
repriceEquipment(ITEMS);
Object.assign(MONSTERS, DUNGEON_MONSTERS);
setEnemyLvTag(enemyLvTag); // 戦闘中に呼ばれた手下の名乗りにも表示Lv を添える (combat.js)
// 名のある強敵 (dungeons/named.js): 名は噂で知れ渡っている → 最初から本当の名で呼ぶ (itemview.js revealSteps)
for (const id of NAMED_IDS) if (MONSTERS[id]) MONSTERS[id].named = true;
// 隠しレベル lv (1-50) と表示ランクの補完 (カタログ品は定義済み)
for (const id in ITEMS) {
  const it = ITEMS[id];
  if (it.lv == null) it.lv = 1;
  if (it.rank == null) it.rank = lvToRank(it.lv);
  // R1-20 (ドロップ窓の判定に使う隠しランク)。当面は lv から算出する暫定値で、
  // 別途用意するランク表 (各アイテムの r20) が来たら差し替える。
  if (it.r20 == null) it.r20 = Math.max(1, Math.min(20, Math.ceil(it.lv / 10)));
}
// 装備できるLv (メイン魂の Lv がこれに届かない装備は付けられない。src/equiplevel.js が迷宮の台帳から決める)
registerEquipLevel(equipLevelFor);
registerAffixes(applyAffixes, gearPerks); // 無限迷宮の追加の能力・特性 (src/infaffix.js)

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
  if (it && it.locked) e.appendChild(svgIcon("lock", "item-lk"));
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
  const r = random() * total;
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
// 収集品は「深度の上限なし」で出続け、何度でも同じ品が出る。深い迷宮ほど低ランクの収集品も拾える (D80 でも D20 帯の品が出る) よう、
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
  const rr = random() * total;
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
// レジェンドレアも同じ抽選で出る (重みはスーパーレアの1/3)。品は lrPool の深さの条件で選ぶ (pickLR)。収集品は一定割合で別枠から出る。
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
        const usable = G.party.some((m) => m.alive !== undefined && canEquip(m, ITEMS[id], { anyLv: true }));
        const ww = w * (fj ? (G.party.some((m) => m.clsKey === fj) ? 6 : 1) : 1) * (usable ? 3 : 1);
        total += ww; acc.push([id, total]);
      }
    }
    if (total) {
      const x = random() * total;
      for (const [id, t] of acc) if (x <= t) return id;
      return acc[acc.length - 1][0];
    }
  }
  return null;
}
// ===== 道具 (消耗品) のドロップ =====
// 戦利品・宝箱の USE_DROP_RATE は道具になる (強敵・ミミック・黒い宝箱などの上等な枠は装備のまま)。
// 品はランク窓 (中心R−3 〜 出現上限) から、中心に近いほど出やすく選ぶ。use.drop で品ごとの出やすさを絞る
const USE_DROP_RATE = 0.25;
let _useLootIds = null;
function useLootIds() {
  if (!_useLootIds) _useLootIds = Object.keys(ITEMS).filter((id) => ITEMS[id].slot === "use" && ITEMS[id].use && !ITEMS[id].noDrop).sort();
  return _useLootIds;
}
function pickUseItem(centerR, capR = lootCapR()) {
  let total = 0; const acc = [];
  for (const id of useLootIds()) {
    const it = ITEMS[id];
    const r = Math.max(1, Math.min(20, it.r20 || Math.ceil((it.lv || 1) / 10)));
    if (r > capR || r < centerR - 3) continue;
    const w = Math.max(1, 3 - Math.abs(r - centerR)) * (it.use.drop != null ? it.use.drop : 1);
    total += w; acc.push([id, total]);
  }
  if (!total) return null;
  const x = random() * total;
  for (const [id, t] of acc) if (x <= t) return id;
  return acc[acc.length - 1][0];
}
// 戦利品を1つ選ぶ (opts は dropCenterR と同じ補正)。返り値は item id
function pickLoot(opts = {}) {
  const centerR = dropCenterR(opts);
  if (random() < MISC_DROP_RATE) {
    const miscCap = Math.min(20, centerR + 2);
    const pool = miscLootIds().filter((id) => Math.max(1, Math.min(20, ITEMS[id].r20 || 1)) <= miscCap);
    if (pool.length) return pool[rand(pool.length)];
  }
  const plain = !opts.rare && !opts.elite && !opts.master && !opts.mimic && !opts.lvBonus;
  if (plain && !opts.noUse && random() < USE_DROP_RATE) {
    const uid = pickUseItem(centerR);
    if (uid) return uid;
  }
  // noLR: 迷宮のイベントが直接渡す品 (LR は宝箱・戦利品にだけ出す)
  const rar = rollRarity(rarityUp(opts), random, !!opts.noLR);
  if (rar === "lr") { const id = pickLR(); if (id) return id; } // 今の深さで出せるLRが無ければスーパーレアへ
  const order = ["c", "uc", "r", "sr"];
  const capR = lootCapR();
  let k = rar === "lr" ? order.length - 1 : order.indexOf(rar);
  for (; k >= 0; k--) {
    const id = pickOfRarity(order[k], centerR, capR);
    if (id) return id;
  }
  return pickItemByR(centerR, capR);
}

// ===== 実プレイ時間 =====
// 画面が見え、直近2分以内の操作または自動探索・自動戦闘が進行している時間を数える
let _lastInputAt = Date.now();
for (const ev of ["pointerdown", "keydown"]) document.addEventListener(ev, () => { _lastInputAt = Date.now(); }, { passive: true, capture: true });
setInterval(() => {
  refreshStability();
  const activeAuto = inDungeon() && (G.autoCombat || G.autoMove) && !G.prompt && !uiBlocked();
  if (titleActive || openingActive || document.visibilityState !== "visible" || (Date.now() - _lastInputAt > 120000 && !activeAuto)) return;
  tlStabilityTick(stabilityDolls(), 5000);
  G.stats.playMs = (G.stats.playMs || 0) + 5000; // 戦績: 総プレイ時間
  if (tlOn()) { tlPlayTick(inDungeon() ? tlWhere() : null, 5000); infTlPoint(); } // テスト記録: 迷宮/町の実プレイ時間
}, 5000);

// ===== レジェンドレアの品選び =====
// レア度の抽選で LR が出た時に、今の深さで出せるLRから1つ選ぶ。同じ品も何度でも出る (2026-10 ユーザーの指示)。
// 層の逸品 (layer つき = 第1〜5層) はその層に達していて、出現上限 (lootCapR) 以内の隠しLvなら候補。
// 職業専用LR・全職共通のLR防具 (tier5以上) は lootLv がティアの解禁値 (LR_UNLOCK) を超えてから
function lrPool() {
  const lv = lootLvAt();
  const capLv = lootCapR() * 10;
  const L = battleLayer();
  return Object.keys(ITEMS).filter((id) => {
    const it = ITEMS[id];
    if (it.rar !== "lr") return false;
    if (it.layer || it.lr < 5) return (it.layer || it.lr) <= L && (it.lv || 1) <= capLv;
    return lv >= (LR_UNLOCK[it.lr] || 40);
  });
}
// 候補はどれも同じ確率 (職・共通を問わず均等。2026-10 ユーザーの指示で編成の職による重みを廃止)
function pickLR() {
  const pool = lrPool();
  return pool.length ? pool[rand(pool.length)] : null;
}

// ===== 職業専用LR の解禁深度 =====
// LR (tier5以上 = 職業専用・全職共通の防具) は lootLv がティアの解禁値を超えてから LR の候補に入る。
// 層の逸品 (tier1-4) は lrPool の層・出現上限の条件で候補
// LR ティア → 解禁 lootLv は src/equiplevel.js の LR_UNLOCK (装備できるLv の表も同じ値で作る)
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
  if (random() < 0.05) c += 12; // まれな大当たり: ワンランク上の帯から出る
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

for (const m of Object.values(MONSTERS)) if (!m.resists) m.resists = monsterResists(m);

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
  apprenticeName: "",
  rng: rngState(), // 種つき乱数の状態 (src/rng.js。random() が書き換え続ける配列。セーブに入るので読み込み直しても同じ結果になる)
  state: "town",      // town | board | combat | over
  floor: 1,
  maxFloorReached: 1, // 到達した最深階 (表示用)
  dungeonIdx: 0,      // 現在選択中の迷宮
  unlockedDungeons: 1,// 解放済みの迷宮数 (王宮で勅命を受けると増える)
  board: null,
  px: 0, py: 0,
  gold: 0,            // 着任時は金貨を持たない
  soulPts: 0,         // Soul(魂): 敵/死体から得る。経験値の役割を兼ね、館で魂のレベルアップに使う
  redSoul: 0,         // Red Soul(赤い魂): プレミアム通貨 (空の人業購入・加護)
  embers: 0,          // 魂の残火: 死体から確定で得る。メイン魂のLv上限を1上げるのに使う
  dollsPurchased: 0,  // 空の人業を購入した回数 (価格の段階に使う)
  stabilityBriefed: false, // 魂の安定度の門衛説明を表示済みか
  dungeonBriefed: false, // 初回出撃時の警備兵の注意事項を表示済みか
  pendingDoll: null,  // (旧形式) 未生成の人業。現在は「空の人業」(isEmpty) として reserve に残る (ロード時に移行)
  inventory: [],      // 隊と控えで共有する持ち物 (最大50個、装備中の品は含めない)
  party: [],          // 迷宮に連れて行く人業 (最大6体)
  reserve: [],        // 酒場で待機中の人業
  // 魂は1体ごとに固有のインスタンス (本体は魂、人業は器)。同職でも個別に Lv/ランクを持つ。
  souls: [],          // 所持魂 一覧: [{ uid, clsKey, count(吸収数→ランク), level, exp }]
  shopStock: null,    // 商会の在庫 { itemId: 個数 } (初回 setupNewGame で初期化)
  run: null,          // 今回の出撃で得た戦利品 { gold, soulPts, items:[{owner,item}], souls:[] }
  town: { facility: null, sub: null, tab: "hub", page: null }, // 街UIの現在地 (tab: 下のタブ / page: タブの1段下 / facility・sub: 旧画面アダプタ用)
  lastRun: null,      // 直前の出撃のまとめ (帰還の報告カード用。名前・レア度・数・砕けた人業など素のデータ)
  quest: null,        // 酒場の依頼 (掲示板・受注中のフリークエスト・固定クエスト。questState() が整える)
  msq: null,          // 第0章の進み { n: 0, state: "active", granted } → 果たした後は { n: 1, state: "world" } (物語の進みは G.world)
  world: null,        // 迷宮の地図と物語の進み (worldState() が整える)
  ach: {},            // 受領済みの勲章 (実績) { id: true }
  fastAnim: true,     // 戦闘演出の倍速設定 (永続)。ON = 標準の速さ、OFF = その 1/2 の速さ
  animTempo: 2,       // 倍速の意味を改めた版 (2 = ON が旧来の標準)。この印の無い旧セーブは読み込み時に倍速 ON へ
  autoCombat: false,  // オート戦闘中 (セッション内のみ)
  tavernCrowd: null,  // 酒場に居合わせる者たち (帰還ごとに3〜5名を選び直す) [{type,icon,name,line,kind,id}]
  tavernHeard: null,  // 酒場で聞いた心得・言い伝え {話のid: 1} (「書き留めた話」。tavern.js TAVERN_TALKS の id)
  rumor: null,        // 酒場で表示中の噂 (次回出撃で現実化)
  activeRumor: null,  // 出撃時に確定した、この迷宮で適用する噂
  codex: { mon: {}, item: {}, job: {}, met: {}, fresh: { mon: {}, item: {}, job: {} } }, // 図鑑 (モンスター/アイテム/職業)。fresh = 新着 (まだ詳細を見ていない記録)。met = 遭遇した迷宮の主 (討つ前でも図鑑に名だけ出す)
  treasury: { donated: {}, claimed: {} }, // 王宮の宝物庫: donated={収集品id:true}, claimed={"ランク:しきい値":true}
  lrOwned: {},        // 一度でも手にしたLRのid (同じ品は何度でも出る。いまは「LRを手にしたことがあるか」にだけ使う)
  named: { seen: {}, trophy: {} }, // 名のある強敵: seen={id:{dungeon, floor}} 目撃 / trophy={id:true} 首級を手にした (全滅で失えば消す)
  insightNotified: null, // 見識の増加通知済みの合計。評価自体は図鑑から毎回計算する
  rusui: { picks: [] }, // 廃止済みの留守居の修練。旧セーブの席データだけ保持する
  order: { picks: [] }, // 控えの結社: 席に着けた魂のuid配列 (席数=orderSeats()。編成外の魂のみ有効。能力の一部を全員に足す)
  events: { seen: {}, picks: {}, once: {}, flags: {}, fresh: {} }, // 迷宮のイベント (src/events.js): 見聞録・一度きり・恒久の恵み
  irene: { greeted: false, visits: 0, seen: {}, last: null }, // 人業の館の主イレーヌ: 初訪問の挨拶済み・来館数・聞いた話 (src/ui/irene.js)
  journal: { read: {}, known: {} }, // ストーリー一覧: 読んだ物語・「物語が記された」を知らせた物語 (src/journal.js)
  tut: { done: {}, cur: null, step: 0, ev: {}, base: {} }, // 解放された要素の手ほどき: 済んだもの・最中のもの (src/ui/tutorial.js)
  story: 0,           // 王宮ストーリーの進行段階
  dragonSlain: false, // 竜を討ったか
  // 戦績。bossIds/elemKills は集合 ({key:true})、swiftBoss/masterMimicSlain は一度きりの達成フラグ
  stats: { runs: 0, deepest: 0, kills: 0, deaths: 0, soulsFound: 0, bossKills: 0,
    chests: 0, mimics: 0, trapsDisarmed: 0, trapsSprung: 0, fusions: 0, questsDone: 0, playMs: 0,
    elites: 0, metals: 0, swiftBoss: false, masterMimicSlain: false, bossIds: {}, elemKills: {} },
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
  partyFxV: null,     // 味方カードに重ねる戦闘の演出 (爪痕・属性・回復の光…。renderParty の .pc-fx)
  partyShow: null,    // 迷宮の掟の開幕の演出を待つ間、隊の札に見せる効く前の HP/MP/状態 (playTraitOpening)
  effShow: null,      // 強化・弱体の演出を待つ間、札に見せる掛かる前の効果 (Map 人業・敵 → effects の写し。shownEffects)
  modFeed: null,      // 強化・弱体が掛かった記録を集めている間の入れ物 (combat.js setModSink → beginModWatch)
  logHold: null,      // 強化・弱体の演出まで記録欄に出すのを待たせている行 (log → flushModLines)
  partyCall: null,    // 味方カードの肖像に出す使った技・発動した効果の名 (Map。renderParty の .pc-call)
  wallFlash: null,    // ブロックされた壁の赤フラッシュ { x, y, dir, t0 }
  statusOpen: false,  // ステータス画面表示中
  statusIdx: 0,       // ステータス画面で選択中のメンバー
  statusTab: "main",  // ステータス画面のタブ "main"(統合) | "soul"
  eliteFloor: false,  // 現在のフロアが強敵階か (3F以降、10%の確率で発生)
  specialFloor: null, // 現在のフロアの特別階id (SPECIAL_FLOORS 参照。2F以降に低確率で発生)
  mutator: null,      // 今回の出撃に適用中の「迷宮の異変」id (MUTATORS 参照。出撃時に任意で受諾)
  bossDown: false,    // この出撃で迷宮の主を討ったか (討つと帰還制限が解ける)
  portalFound: false, // この階で帰還魔法陣を発見したか (発見後はいつでも街へ戻れる)
  // 無限迷宮: 潜っている間の状態 (null = 通常迷宮)。abyss.js・docs/infinite-labyrinth.md
  abyss: null,        // { v:2, started, depth, seed, rule, guardFloor, picks:[職], home:{本編の隊・魂・通貨}, savedIdx }
  abyssRec: null,     // 記録: { v:2, bestDepth, runs, recent:[{depth, outcome, at}] }
};

const rand = (n) => Math.floor(random() * n);

// ハプティクス (対応端末のみ)。パターン: 数値 or [待ち,振動,待ち,振動...]
function buzz(p) {
  if (!PREFS.vibrate) return;
  if (navigator.vibrate) { try { navigator.vibrate(p); } catch {} }
}

// 端末ごとの好み (音量・振動)。セーブデータとは別に保存し、「はじめから」でも消えない
const PREFS_KEY = "dos-prefs";
const PREFS = (() => {
  const d = { bgm: 0.8, sfx: 1, vibrate: true, classicBattle: false, buffFx: true, walkSpeed: 2, walkerLook: { ...WALKER_LOOK_DEFAULT } };
  let p;
  try { p = { ...d, ...(JSON.parse(localStorage.getItem(PREFS_KEY)) || {}) }; } catch { p = { ...d }; }
  // 旧来の「移動 倍速」(fastWalk: ON = 2倍 / OFF = 1倍) を移動の速さ (1〜4倍) へ引き継ぐ
  if (typeof p.fastWalk === "boolean") { p.walkSpeed = p.fastWalk ? 2 : 1; delete p.fastWalk; }
  if (![1, 2, 3, 4].includes(p.walkSpeed)) p.walkSpeed = 2;
  p.walkerLook = normalizeLook(p.walkerLook);
  return p;
})();
function savePrefs() { try { localStorage.setItem(PREFS_KEY, JSON.stringify(PREFS)); } catch {} }
// 迷宮を歩く駒の装い (設定「操霊師の装い」・端末の好み PREFS.walkerLook)
function setWalkerLook(look) {
  PREFS.walkerLook = normalizeLook(look);
  uiDungeonHud.setWalkerArt(walkerLook(PREFS.walkerLook));
  savePrefs();
  if (G && G.state === "board" && G.board) drawBoardFrame();
}
uiDungeonHud.setWalkerArt(walkerLook(PREFS.walkerLook));
// 迷宮内の移動 (めくり・1歩のスライド・自動歩行の間) の時間。ms は2倍速の値。設定「移動の速さ」(PREFS.walkSpeed)
// 1倍 = ms × 2 / 2倍 = ms / 3倍 = ms × 2/3 / 4倍 = ms × 1/2
const walkMs = (ms) => Math.round(ms * 2 / (PREFS.walkSpeed || 2));
setVolumes(PREFS.bgm, PREFS.sfx);

// ---- 出撃中の戦利品トラッキング (全滅ペナルティ / Red Soul帰還で使う) ----
const inDungeon = () => G.state === "board" || G.state === "combat" || G.state === "over";
// 隊内で最も強い装備効果(eff)値を返す (LR装飾品の goldUp/soulUp 等。重複装備は加算せず最大値)
function partyEffMax(key) { let s = 0; if (G.party) for (const m of G.party) { if (m && m.eff && m.eff[key] > s) s = m.eff[key]; } return s; }
// 迷宮で得るゴールド (戦闘勝利・宝箱・床イベント) の共通入口。全体の獲得量を半分に抑える。
// 黄金の指輪 (LR装飾品) の goldUp があれば獲得量を割合で増やす。
// 戦闘中に「盗む」で得た金を持ち帰る (勝っても逃げても。そのままの額)
function takeStolenGold(b) {
  const g = Math.max(0, Math.round((b && b.bonusGold) || 0));
  if (!g) return 0;
  b.bonusGold = 0;
  G.gold += g; if (G.run && inDungeon()) G.run.gold += g;
  if (tlOn() && inDungeon()) tlGain(tlWhere(), "gold", g, (b.tl && b.tl.kind) === "m" ? "mt" : "b" + ((b.tl && b.tl.kind) || "n"));
  return g;
}
function runGainGold(g, src, pre, modifier = null) {
  const base = g * 0.5, sf = sfNum("goldMul", 1), mu = modifier ?? mutNum("goldMul", 1), eq = 1 + partyEffMax("goldUp");
  g = Math.round(g * 0.5 * sf * mu * eq); G.gold += g; if (G.run && inDungeon()) G.run.gold += g;
  if (tlOn() && inDungeon()) tlGain(tlWhere(), "gold", g, src, tlUplift(pre != null ? pre * 0.5 : base, base, sf, "goldMul", mu, eq));
  return g;
}
// 魂導の護符 (LR装飾品) の soulUp があれば ✦Soul の獲得量を割合で増やす。
// 極の出来事で授かった恒久の恵み (G.events.flags) の効き目。授かっていなければ dflt
setPermanentStatSource(() => permanentEventStats(G.events?.once)); // 極の永続強化は無限迷宮の仮の器にも乗せる (2026-10-11 ユーザーの指示)

function evBoon(k, field, dflt) { return G.events && G.events.flags && G.events.flags[k] ? EV_BOONS[k][field] : dflt; } // 旧仕様の極の恵み。無限迷宮でも効く (2026-10-11 ユーザーの指示)
// out を渡すと out.raw に「Lv差で減らす前の額」を入れる (戦闘の魂の経験値は魂ごとの Lv差で減らすため)
function runGainSoulPts(s, src, pre, modifier = null, out = null) {
  const base = s, sf = sfNum("soulMul", 1), mu = modifier ?? mutNum("soulMul", 1), eq = 1 + partyEffMax("soulUp") + evBoon("will", "soulMul", 0);
  const lm = inDungeon() ? partySoulLvMul() : 1;
  // 無限迷宮: 推奨Lv の表の傾きに合わせて育つ速さを上げる (abyss.js infGrowthMul — 戦闘で魂に入る経験値もここから)
  const gm = inDungeon() && abyssActive() ? infGrowthMul(G.floor) : 1;
  const raw = s * sf * mu * eq * gm;
  s = Math.round(raw * lm); G.soulPts += s; if (G.run && inDungeon()) G.run.soulPts += s;
  if (out) out.raw = Math.round(raw);
  if (tlOn() && inDungeon()) {
    const up = tlUplift(pre != null ? pre : base, base, sf, "soulMul", mu, eq);
    if (lm < 1) up.lvd = raw * (lm - 1); // Lv差で減った分 (負の数)
    tlGain(tlWhere(), "soul", s, src, up);
  }
  return s;
}
// ===== Lv差による ✦Soul の減り (2026-10 テスト記録: 魂融合・残火を集める周回や寄り道の迷宮で ✦ が余り、推奨Lv を大きく超えた) =====
// 魂の Lv が、いまの階の敵Lv (推奨Lv) + SOUL_LV_GRACE を超えた分、1Lv ごとに SOUL_LV_STEP ずつ減らす (下限 SOUL_LV_MIN)。
// 迷宮で得る ✦ (戦闘・出来事・死体・金属) は隊のLv (メイン魂の平均) で、戦闘で魂に直接入る経験値は魂それぞれの Lv で決める
// → Lv の低いサブ魂・控えから来た魂は満額のまま追いつく。町の ✦ (依頼・報告) は減らさない
const SOUL_LV_GRACE = 2, SOUL_LV_STEP = 0.10, SOUL_LV_MIN = 0.2;
function soulLvMul(lv, foeLv = foeLevelHere()) {
  const over = (lv || 1) - foeLv - SOUL_LV_GRACE;
  return over <= 0 ? 1 : Math.max(SOUL_LV_MIN, 1 - SOUL_LV_STEP * over);
}
// 掟の corpseFade (閉ざされた獄 w07・器の山 w27・疫病の塚 ws13。2026-10-11 ユーザーの指示: 魂と残火が集まりすぎる — 弱い敵の迷宮を楽に周回できた):
// 盤面の加工 prison で増える死体は、隊のLv (メイン魂の平均) が推奨Lv + CORPSE_FADE_GRACE を超えた1Lvごとに CORPSE_FADE_STEP ずつ出にくくなる (推奨Lv+9 で出ない)。
// cfg を渡すと出撃画面の見込み (その迷宮の1階の推奨Lv)、渡さなければいまの階。掟の無い迷宮は 1
const CORPSE_FADE_GRACE = 2, CORPSE_FADE_STEP = 0.15;
function corpseFadeShare(cfg = null) {
  const tr = cfg ? cfg.trait : dungeonTrait();
  if (!tr || !tr.corpseFade) return 1;
  const ds = (G.party || []).filter((d) => d && d.primary != null);
  if (!ds.length) return 1;
  const lv = ds.reduce((a, d) => a + (d.jobLv || 1), 0) / ds.length;
  const over = lv - (cfg ? cfg.lv : foeLevelHere()) - CORPSE_FADE_GRACE;
  return over <= 0 ? 1 : Math.max(0, 1 - CORPSE_FADE_STEP * over);
}
function partySoulLvMul() {
  const ds = (G.party || []).filter((d) => d && d.primary != null);
  if (!ds.length) return 1;
  return soulLvMul(ds.reduce((a, d) => a + (d.jobLv || 1), 0) / ds.length);
}
// テスト記録: 得た額のうち、倍率で増えた分の内訳 (順に掛けて、それぞれの倍率で増えた分)。
// pre = パッシブ (金運・魂寄せ・魂の聖別) を掛ける前の額 / base = 倍率を掛ける前の額 / mu = 異変・掟・出来事の効果・奈落を合わせた倍率
// 戦闘の戦果は倍率が通常敵の分だけに掛かる (battleModifierReward) ので、mu は全体の倍率 full より小さい。
// そのときは異変・掟の倍率も同じ割合 (対数の比) だけ効いたものとして分ける (主だけの戦い = 0 → 掟の上乗せも 0)
function tlUplift(pre, base, sf, key, mu, eq) {
  const md = mutDef(), tr = dungeonTrait();
  let mm = (md && md[key]) || 1, tm = (tr && tr.mods && tr.mods[key]) || 1;
  const full = mutNum(key, 1);
  if (mu !== full && full > 0 && mu > 0 && Math.abs(Math.log(full)) > 1e-9) {
    const share = Math.log(mu) / Math.log(full);
    mm = mm ** share; tm = tm ** share;
  }
  const om = mu / (mm * tm);
  const up = { psv: base - pre };
  let v = base;
  for (const [k, m] of [["sf", sf], ["mut", mm], ["trait", tm], ["oth", om], ["eq", eq]]) { up[k] = v * (m - 1); v *= m; }
  return up;
}
// テスト記録: 町で得た ✦ / 金貨 (src: q 依頼 / tip 心付け / bond なじみ / fq 頼み / r 王への報告 / a 勲章 / t 宝物庫 / sell 売却)
function tlTown(kind, n, src) { if (tlOn() && !inDungeon()) tlTownGain(kind, n, src); }
function runGainItem(owner, item) {
  infSupplyRecord("found", item?.id);
  if (item) item.isNew = true; // NEW 印 (品シートで見れば消える。セーブには追加の印として残る)
  // テスト記録: 迷宮で手に入れた品 (図鑑の記録は呼び出し側がこの後で行うので、ここで見れば新種かがわかる)
  if (item && tlOn() && inDungeon()) tlLoot(tlWhere(), item, !item.unidentified && !(G.codex && G.codex.item && G.codex.item[item.id]));
  owner.items.push(item);
  if (G.run && inDungeon()) G.run.items.push({ owner, item });
  if (item && item.rar === "lr") { if (!G.lrOwned) G.lrOwned = {}; G.lrOwned[item.id] = true; } // 手にしたLRの記録
  if (item && TROPHY_OF[item.id]) namedState().trophy[TROPHY_OF[item.id]] = true; // 名のある強敵の首級を手にした
}
// 魂の吸収を記録 (全滅没収で巻き戻すため {doll, clsKey} で覚える)
// 魂の入手を記録 (全滅没収で巻き戻すため)。kind: "awaken"(共有countへ) | "bag"(未覚醒)
function runTrackSoul(clsKey, kind) { if (G.run && inDungeon()) G.run.souls.push({ clsKey, kind }); }
// テスト記録: 職業の魂を1つ手に入れた (迷宮の中ならその迷宮の欄、町なら次に入る迷宮の「町」の欄へ)
function tlSoulGot(clsKey) { if (tlOn()) tlSoul(inDungeon() ? tlWhere() : null, (SOUL_CLASSES[clsKey] || {}).rarity); }
// 今回の出撃の記録 (D1): 戦利品に加え、倒した数・魂の成長・持ちきれず置いてきた品・到達階を数える。
// 旧セーブの G.run はこれらを持たないので、読む側は必ず || の既定値で受ける
function newRun() {
  return { gold: 0, soulPts: 0, items: [], souls: [], kills: 0, levels: [], lost: [], floors: 1, embers: 0, at: Date.now() };
}
function runCount(key, n = 1) {
  if (G.run && inDungeon()) G.run[key] = (G.run[key] || 0) + n;
  if (key === "embers" && inDungeon() && abyssActive()) tlInfEmbers(n); // テスト記録の無限迷宮の欄
}
function runLost(name) { if (G.run && inDungeon() && name) (G.run.lost || (G.run.lost = [])).push(name); if (name && tlOn() && inDungeon()) tlLost(tlWhere()); }
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
    dungeon: { idx: G.dungeonIdx, name: abyssActive() ? INF_NAME : (dn ? dn.name : ""), layer: dn ? dn.layer : 1 },
    abyss: G.abyss ? G.abyss.depth : null,
    floor: G.floor, floors: Math.max(r.floors || 1, G.floor || 1),
    gold: r.gold || 0, soulPts: r.soulPts || 0, kills: r.kills || 0, embers: r.embers || 0,
    // ref = 品の実体 (報告から図鑑を開く時、帰ってから鑑定した品はその正体を見せる)
    items: (r.items || []).map(({ owner, item }) => ({ id: item && item.id, name: itemName(item), rar: rarityKey(item), unid: !!(item && item.unidentified), owner: owner ? owner.name : "", ref: item || null })),
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
  // 魂の Lv・ランクが変わった時はここを通るので、職業図鑑の記録も合わせる
  // (保存の間引き・試遊でオートセーブが走らないと、覚えた技が図鑑に出なかった)
  codexSweepJobs();
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
  // 入手したアイテム/装備を現在の持ち主から除去 (出撃中に「渡す」/他メンバーが
  // 装備した品も追跡し、全員の所持品・装備を走査して取り上げる)
  for (const { item } of r.items) {
    if (item && TROPHY_OF[item.id]) delete namedState().trophy[TROPHY_OF[item.id]]; // 首級を失った → 次に倒した時にまた落とす
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
    if (d.isDoll && !d.alive && !d._dead) {
      G.stats.deaths++; d._dead = true; d.diedFloor = G.floor;
      // 初めて人業が砕けたら、街へ戻った時に館の手ほどき「砕けた魂の修復」を始める
      // (赤い魂で生還した・迷宮で蘇った時も。帰還の時に砕けた人業がいなくても説明する)。無限迷宮の仮の器は数えない
      if (G.tut && !(G.tut.done && G.tut.done.repairSoul) && !abyssActive()) G.tut.repairFell = true;
    }
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
function logHistory() { return _logHistory.map((x) => ({ text: x.msg, cls: "l-" + x.cls })); }
// 戦闘中の記録は、まだ名前を知らない敵 (討伐数0) の名を不確定名 (「蠢く粘塊？」など、dungeons/unknown.js) に伏せる。
// 不確定名は unknownTag の印で囲み、記録欄では .unk-name の色で正式な名と見分ける (setLogText)
// 個体名 (スライムA) を先に、種の名 (スライム) を後に置き換える (長い名から順なので、明かされた別の敵の名に含まれる種名は触らない)
// (置き換えた不確定名が別の敵の名を含んでも二重に化けないよう、いったん印に置き換えてから戻す)
// (戦闘の組み立て中 = Battle を作る前の名乗りや開幕の一撃は _maskEnemies を見る)
let _maskEnemies = null;
function maskUnknownEnemies(msg) {
  if (G.state !== "combat" || typeof msg !== "string") return msg;
  const list = _maskEnemies || (G.battle && G.battle.enemies);
  if (!list || !list.length) return msg;
  // 敵の名前には必ず表示Lv を添える (2026-10 ユーザーの指示: 主・強敵の Lv1 も。enemylevel.js)。
  // 討伐前の魔物は不確定名に置き換える。すでに「（LvN）」が付いた名前 (名乗り・呼び寄せ) はその Lv のまま重ねない
  const map = new Map();
  for (const e of list) {
    const tag = enemyLvTag(e), known = enemyReveal(e).name;
    if (e.name && !map.has(e.name)) map.set(e.name, [known ? e.name : unknownTag(enemyLabel(e)), tag]);
    const mn = e.mon && e.mon.name;
    if (mn && !map.has(mn)) map.set(mn, [known ? mn : unknownTag(unknownLabel(e.mon)), tag]);
  }
  const pairs = [...map].sort((x, y) => y[0].length - x[0].length);
  const outs = [];
  for (const [from, [to, tag]] of pairs) {
    const re = new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(（Lv\\d+）)?", "g");
    msg = msg.replace(re, (_, had) => { outs.push(to + (had || tag)); return `\u0001${outs.length - 1}\u0002`; });
  }
  return msg.replace(/\u0001(\d+)\u0002/g, (_, i) => outs[i]);
}
function log(msg, cls = "sys") {
  msg = maskUnknownEnemies(msg);
  // 強化・弱体の演出を待つ間は、その演出と同じ時に出す (playModReveal)
  if (G.logHold) { G.logHold.push({ msg, cls, seq: G.modFeed ? G.modFeed.length : 0 }); return; }
  writeLog(msg, cls);
}
function writeLog(msg, cls) {
  // 直前と同じ文が続いても「×N」にまとめず、そのまま1行ずつ出す
  _logHistory.push({ msg, cls });
  if (_logHistory.length > LOG_HISTORY_MAX) _logHistory.splice(0, _logHistory.length - LOG_HISTORY_MAX);
  const div = document.createElement("div");
  div.className = "l-" + cls;
  setLogText(div, msg);
  logEl.appendChild(div);
  while (logEl.children.length > 80) logEl.removeChild(logEl.firstChild);
  // 新しいメッセージが来たら最下部へ貼り付け直す。iOS Safari 等では appendChild 直後の
  // 再レイアウトが間に合わず最新メッセージまでスクロールしきれないことがあるため、次フレームでも実行する。
  _logPinned = true;
  scrollLogBottom();
  requestAnimationFrame(scrollLogBottom);
}
// 札 (題 + 行) を記録へ。題は【】で囲んで区切りにする
function logSheet(title, lines = [], cls = "sys") {
  if (!inDungeon()) return;
  if (title) logEcho(`【${plainText(title)}】`, cls);
  for (const ln of lines || []) if (typeof ln === "string" && ln) logEcho(ln, cls);
}
// 記録欄に書いていない知らせ (トースト・出来事や罠の札・発見の問い) を記録にも残す。記録欄は迷宮の中 (盤面・戦闘) にしか
// 無いので、写すのは迷宮の中だけ。log と showToast を並べて書く慣わしの箇所は noLog で止め、止め忘れても
// 直近の記録に同じ文があれば重ねない (文字と数字だけで比べる。記号・絵文字・句読点・区切りの違いは見ない)
const LOG_TONE = { bad: "dmg", good: "heal", gold: "win", info: "sys" };
const logKey = (s) => plainText(String(s == null ? "" : s)).replace(/[^\p{L}\p{N}]/gu, "");
function loggedRecently(text, n = 12) {
  const k = logKey(text);
  if (!k) return true;
  for (let i = _logHistory.length - 1, c = 0; i >= 0 && c < n; i--, c++) {
    const h = logKey(_logHistory[i].msg);
    if (h.includes(k) || (h.length >= 6 && k.includes(h))) return true;
  }
  return false;
}
// key: この語が直近の記録にあれば書かない (品の名など、言い回しの違う同じ知らせ)
function logEcho(text, cls = "sys", key = null) {
  if (!inDungeon() || !text) return;
  if (key && loggedRecently(key)) return;
  if (loggedRecently(text)) return;
  log(text, cls);
}
setToastEcho((text, o) => logEcho(text, LOG_TONE[o.tone || "gold"] || "sys", o.logKey || null));

// 現在の迷宮設定
function curDungeon() { return DUNGEONS[G.dungeonIdx] || DUNGEONS[0]; }

// ===== 迷宮の地図 (src/dungeons/world.js の台帳) と物語の進み (G.world) =====
// 迷宮は一本道ではない: 解放条件を満たした迷宮が地図に現れ、どれに潜るかは自由 (推奨Lvより遥かに強い迷宮にも入れる)。
// 物語は「どの迷宮で何を見つけたか」で進む (src/story.js)。王への報告は、迷宮を初めて踏破した時だけ。
// G.world = {
//   open: {id:1}        地図に現れた迷宮          cleared: {id:回数}   踏破した回数
//   reported: {id:1}    初踏破を王に報告した迷宮  report: id|null     王への報告待ち (手がかりが揃えば報告まで門は開かない)
//   found: {鍵:1}       見つけた物語マス          beats: {鍵:1}       語り終えた主の記憶・館の語り・章の結び
//   gates: {id:階}      到達した最深の帰還魔法陣の階 (次回はその次の階から潜れる)
//   fresh: {id:1}       地図に現れたばかり (出撃シートの「新」)      last: 最後に語られた物語のページ (聞き直し用)
// }
// CONTENT_LIMIT = 地図に載せている迷宮の数 (旧来の名を保つ)。章の最後の迷宮を報告すると、次章は「準備中」
const CONTENT_LIMIT = DUNGEONS.length;
function worldState() {
  if (!G.world || typeof G.world !== "object") G.world = {};
  const w = G.world;
  for (const k of ["open", "cleared", "reported", "found", "beats", "gates", "fresh"]) if (!w[k] || typeof w[k] !== "object") w[k] = {};
  if (w.report === undefined) w.report = null;
  // told = 報告の後に見つけた手がかり (LATE_CLUES) を王に伝えたか。この記録の無い旧セーブは、報告済みの迷宮の手がかりを
  // 伝えたことにする (報告の文で語られた分と見分けられない)。直前に拾った手がかり (w.last) だけは伝えられるよう残す
  if (!w.told || typeof w.told !== "object") {
    w.told = {};
    for (const key of Object.keys(LATE_CLUES)) {
      const just = w.last && w.last.kind === "cell" && w.last.key === key;
      if (w.found[key] && w.reported[STORY_CELLS[key].dungeon] && !just) w.told[key] = 1;
    }
  }
  // 別の迷宮を踏破しても報告待ちを失わない。旧セーブの未報告も踏破記録から拾う。
  if (!w.report) w.report = DUNGEONS.find((d) => !d.side && w.cleared[d.id] && !w.reported[d.id])?.id || null;
  // 手がかりの恵み (2026-10 に足した) の前に、館の働きが変わる手がかりを見つけていた旧セーブは、館で一度だけ知らせる
  if (w.boonsIntro === undefined) w.boonsIntro = Object.keys(STORY_CELLS).some((k) => w.found[k] && STORY_CELLS[k].boon && !["dungeon", "quest"].includes(STORY_CELLS[k].boon.kind)) ? 1 : 0;
  return w;
}
// 第0章 (人業の生成) を終えたか
const worldStarted = () => !!G.msq && G.msq.n >= 1;
function worldOpenId(id) { return !!worldState().open[id]; }
function worldOpenIdx(idx) { const d = DUNGEONS[idx]; return !!d && worldOpenId(d.id); }
function worldOpenCount() { return DUNGEONS.filter((d) => worldOpenId(d.id)).length; }
// 台帳の解放条件を満たしたか (world.js の unlock)
function worldUnlockMet(cfg) {
  const u = cfg.unlock || {}, w = worldState();
  if (u.prologue) return prologuePhase() === u.prologue || !!prologue()?.gifts?.fourth;
  if (prologueActive()) {
    const phase = prologuePhase();
    if (cfg.id === "w01") return ["crypt", "fifth", "corridorQuest", "corridor", "sixth", "appraise", "abbeyQuest"].includes(phase);
    if (cfg.id === "w02") return ["corridor", "sixth", "appraise", "abbeyQuest", "abbey"].includes(phase);
    if (cfg.id === "w03") return phase === "abbey";
    return false;
  }
  if (u.start) return worldStarted();
  if (u.reported) return !!w.reported[u.reported];
  if (u.story) return !!w.found[u.story];
  if (u.treasury) return !!treasuryState().claimed["m" + u.treasury];
  if (u.quest) return !!questState().fixed[u.quest]; // 酒場の固定クエストを受けた
  if (u.all) return u.all.every((id) => !!w.reported[id]); // 挙げた迷宮すべての踏破を報告した
  return false;
}
// 条件を満たした迷宮を地図に載せる。新たに現れた迷宮の設定を返す
function refreshWorldUnlocks() {
  const w = worldState(), added = [];
  for (const d of DUNGEONS) {
    if (w.open[d.id] || !worldUnlockMet(d)) continue;
    w.open[d.id] = 1; w.fresh[d.id] = 1;
    added.push(d);
  }
  G.unlockedDungeons = worldOpenCount(); // 旧来の「解放済みの数」(UI の「迷宮が1つでもあるか」の判定に使う)
  return added;
}
// 新たに地図に現れた迷宮を知らせる (トースト・記録)
function announceNewDungeons(list) {
  for (const d of list) {
    log(`新たな迷宮「${d.name}」が地図に記された。`, "win");
    showToast(`🗺 新たな迷宮「${d.name}」が地図に記された`, { noLog: true, tone: "info" });
  }
}
// いまの章 (章の迷宮のうち、まだ報告していない迷宮がある最初の章。すべて済んだら最後の章)
function currentChapter() {
  const w = worldState();
  return CHAPTERS.find((c) => c.dungeons.some((id) => !w.reported[id])) || CHAPTERS[CHAPTERS.length - 1];
}
// 公開している章の結びまで語り終えた (次章は準備中)
const contentSealed = () => { const c = CHAPTERS[CHAPTERS.length - 1]; return !!worldState().beats["ch" + c.no + "_end"]; };
// 物語の文の差し替えに渡す小さな窓 (story.js の lines(s))
function storyCtx() { const w = worldState(); return { open: (id) => !!w.open[id], found: (k) => !!w.found[k], cleared: (id) => !!w.cleared[id], reported: (id) => !!w.reported[id], beat: (k) => !!w.beats[k] }; }
const storyLines = (l) => (typeof l === "function" ? l(storyCtx()) : l) || [];

// ===== 無限迷宮 (docs/infinite-labyrinth.md) =====
// 入るたびに Lv1 から始まるローグライク。入口の「名もなき魂の欠片」を仮の器6体に宿して降りる。本編の人業・魂・通貨は
// 潜っている間 G.abyss.home に退け (G.party などを仮の器・無限迷宮の魂・0 の通貨に差し替える)、帰る時に戻す。
// こうすると戦闘・盤面・装備・魂の強化は本編と同じ道筋がそのまま仮の器に効き、本編の底上げ (結社・極の永続強化・
// 手がかりの恵み) だけを abyssActive() で切ればよい。
//  ・深さごとの推奨Lv は abyss.js INF_LV の表。顔ぶれ・強さの素はその Lv を受け持つ台帳の層 (world.js abyssLayer)。第二部の壁は乗せない
//  ・5の倍数の階 = 風だまり (回収人・灯番) → 主 → 「帰る / 続ける」。帰還魔法陣は無い。落ちる床・蝕む床は6階から
//  ・主と強敵は、その階の雑魚から選び、ランクを上げて組む (出来事の魔物と同じ spawnRanked)
//  ・5階ごとの区切りに、深さで段を分けた掟が1つ (abyss.js INF_RULES)。dungeonTrait() がそれを返す
const abyssActive = () => !!(G.abyss && G.abyss.started);
// 推奨Lv → それを受け持つ台帳の迷宮の階 (顔ぶれ・強さの素)。本筋と寄り道の迷宮の全階を推奨Lv の順に並べ、
// その Lv の前後 INF_SPOT_SPAN の階の顔ぶれを混ぜる (一つの層を丸ごと混ぜると、浅い階に層の終わりの魔物が出てしまう)。
// 格上の迷宮・敵がみな神速の迷宮は物差しにしない。台帳の一番深い Lv より先は、一番深い階の顔ぶれのまま推奨Lv だけ上がる
const INF_SPOT_SPAN = 1.5;
let _infSpots = null;
function infSpots() {
  if (_infSpots) return _infSpots;
  const out = [];
  for (const d of DUNGEONS) {
    if (!d || d.challenge || (d.trait && d.trait.allHaste) || !(d.bands && d.bands.length)) continue;
    for (let f = 1; f <= (d.floors || 1); f++) {
      const t = d.tune || {}, deep = f > (d.floors || 1) / 2;
      out.push({ d, f, lv: dungeonLevelRaw(d, f), pow: powerAt(d, f) * (t.enemyMul || 1) * (deep ? (t.deepMul || 1) : 1) });
    }
  }
  out.sort((a, b) => a.lv - b.lv);
  return (_infSpots = out);
}
const _infSpotCache = new Map();
function infSpotInfo(lv) {
  const key = Math.round(lv * 10);
  if (_infSpotCache.has(key)) return _infSpotCache.get(key);
  const S = infSpots();
  const top = S[S.length - 1].lv;
  const at = Math.min(lv, top);
  let near = S.filter((s) => Math.abs(s.lv - at) <= INF_SPOT_SPAN);
  if (!near.length) near = [S.reduce((a, b) => (Math.abs(b.lv - at) < Math.abs(a.lv - at) ? b : a))];
  const pool = [...new Set(near.flatMap((s) => poolAt(s.d, s.f)))].filter((k) => MONSTERS[k] && !MONSTERS[k].evOnly);
  const main = near.reduce((a, b) => (Math.abs(b.lv - at) < Math.abs(a.lv - at) ? b : a));
  const els = near.map((s) => s.d.element).filter(Boolean);
  const info = {
    pool, coef: near.reduce((a, s) => a + s.pow, 0) / near.length,
    layer: main.d.layer || 1, rank: Math.max(...near.map((s) => s.d.rank || 1)),
    element: els.length ? els.sort((a, b) => els.filter((x) => x === b).length - els.filter((x) => x === a).length)[0] : null,
  };
  _infSpotCache.set(key, info);
  return info;
}
function abyssLevel(d) { return infLevel(d); }
// 無限迷宮のあたたかい死体は本編の1.2倍 (2026-10-12 ユーザーの指示)。ほかのマス (敵・宝箱・風化した死体・泉・罠) の割合は
// 本編のまま、空いたまま残る行き止まりにあたたかい死体を足す (board.js warmExtra)。そのぶん何もない行き止まりが減る
const INF_WARM_MUL = 1.2;
function abyssCfg() {
  const d = G.abyss.depth;
  const lv = infLevel(d);
  const info = infSpotInfo(lv);
  const L = info.layer;
  const haz = d >= INF_HAZ_FROM && !isRestFloor(d); // 風だまりの階には落ちる床を置かない (主を飛ばさない)
  const lf = layerFloorHaz(L);
  const fh = { fall: lf.fall || "collapse", harm: lf.harm || "caltrop" }; // 墓所の層 (仕掛けの無い土地) は砦の石床
  const h = hazardsAt(lv);
  return {
    id: "abyss", name: INF_NAME, short: `無限${d}`,
    layer: L, rank: info.rank, element: info.element,
    lv, lvTo: lv, power: { 1: info.coef * infEnemyMul(d) }, wall: 1, // 推奨Lv と強さの素 (world.js strengthAt)。第二部の壁は乗せない
    floors: 1e9, boss: null, elites: [], gates: false, noPortal: true,
    pool: [...info.pool], deepPool: [...info.pool],
    floorHaz: fh,
    trapRate: h.trapRate, poisonRate: haz ? h.harmRate : 0, pitRate: haz ? h.fallRate : 0,
    warmChance: h.warmChance, warmExtra: INF_WARM_MUL - 1, // あたたかい死体を本編の +20% ぶん、空いた行き止まりに足す
    lootLv: lootBand(lv),
    _abyss: true,
  };
}
function activeCfg() { return abyssActive() ? abyssCfg() : curDungeon(); }
// いまの区切りの掟 (無ければ null)
function infRule() { return abyssActive() && G.abyss.rule ? INF_RULE_MAP[G.abyss.rule] || null : null; }
// 主の階で、主をまだ倒していない
function abyssBossPending() { return abyssActive() && isRestFloor(G.floor) && G.abyss.guardFloor !== G.floor; }
// 風だまりにいる (回収人・灯番に会える: 5の倍数の階の盤面の上)
function infAtRest() { return abyssActive() && isRestFloor(G.floor) && G.state === "board"; }
// 魂の強化・残火を使える所 (街か、無限迷宮の風だまり)
function soulWorkOk() { return G.state === "town" || infAtRest(); }

// 主・強敵に選ぶ雑魚 (その階の顔ぶれから。同じ階・同じ種なら何度引いても同じ1体)
function infFoeKey(salt = 0) {
  const pool = (activeCfg().pool || []).filter((k) => { const m = MONSTERS[k]; return m && !m.metal && !m.boss && !m.elite && !m.evOnly && !m.named; });
  if (!pool.length) return null;
  const r = mulberry32(((G.abyss.seed || 1) ^ Math.imul(G.floor || 1, 2654435761) ^ Math.imul(salt + 1, 40503)) >>> 0)();
  return pool[Math.floor(r * pool.length)];
}
// 主・強敵は、その階の雑魚を一段も二段も強く育てた個体 (「レベルを高くする」)。倍率は台帳の主と雑魚の比から:
// 台帳の主は同じ推奨Lv の雑魚の HP 3.3倍・攻撃 1.4倍 (推奨Lv 78 前後) 〜 HP 7〜15倍・攻撃 2倍 (推奨Lv 17〜24) と、浅いほど比が大きい。
// 仮の器は装備もサブ魂も無いので、浅い階は台帳より軽めにした。数値はテストプレイで直す (2026-10 の計測)
const clampN = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
function infStrongMul(boss, lv) {
  return boss
    ? { hp: clampN(5.5 - lv * 0.03, 3.5, 5.5), atk: clampN(1.7 - lv * 0.005, 1.4, 1.7), vit: 1.3, spoils: 4 }
    : { hp: clampN(3 - lv * 0.012, 2.2, 3), atk: clampN(1.35 - lv * 0.002, 1.2, 1.35), vit: 1.15, spoils: 2 };
}
function infStrongFoe(key, boss) {
  const k = infStrongMul(boss, levelHere().lv);
  const [e] = spawnEliteEnemies(key, enemyScale());
  e.name = e.mon.name;
  e.maxhp = e.hp = Math.max(1, Math.round(e.maxhp * k.hp));
  e.atk = Math.max(1, Math.round(e.atk * k.atk));
  e.vit = Math.round(e.vit * k.vit);
  e.agi = e.agi + 2;
  e.soul = Math.round(e.soul * k.spoils); e.gold = Math.round(e.gold * k.spoils);
  // 主・強敵の印: 溜め・払いのけ・弱体の下限・回避の上限・戦果・宝箱が本編の主・強敵と同じに効く。抵抗値も主・強敵の段
  if (boss) e.boss = true; else e.mon = { ...e.mon, elite: true };
  e._infStrong = boss ? "boss" : "elite";
  e.resists = monsterResists({ ...e.mon, boss, elite: !boss, rank: e.mon.rank, resists: e.mon.resistOverrides || {} });
  e.physResist = e.resists.physResist ?? e.physResist; e.magResist = e.resists.magResist ?? e.magResist;
  return [e];
}
function infEliteFoes(key) { return infStrongFoe(key, false); }
function infBossFoes(key) { return infStrongFoe(key, true); }
// 風だまりの主に挑む
function fightAbyssGuard(cell) {
  const key = infFoeKey(7);
  if (!key) return;
  log(`風だまりの奥から、${enemyReveal({ key, mon: MONSTERS[key] }).name ? MONSTERS[key].name : "何か"}が主の気配をまとって現れた！`, "dmg");
  startBattle(infBossFoes(key), cell);
}

// 風だまり (5の倍数の階の階段): 回収人・灯番に会い、主に挑む。主を討った後は「帰る / 続ける」(ui/infinite.js)
function openInfRest(cell = null) {
  if (!abyssActive() || G.state !== "board") return;
  if (!cell) cell = findRevealedStairs();
  setAutoMove(false);
  UI.openInfRest({
    floor: G.floor, guardDown: !abyssBossPending(),
    onBoss: () => fightAbyssGuard(cell),
    onReturn: () => infReturn(),
    onContinue: () => descend(),
    onClose: () => { if (cell) cell.stairsSeen = true; if (G.state === "board") renderBoard(); },
  });
}

// ---- 回収人 (商会の者): 品の買い取り (商会の棚へ回る)・回復の道具と風切りの羽 ----
// 売る品は本編の商会と同じ sellItem (売値・ロック・棚に積む)。並べる道具は、その階の落とし物の帯の上限までの回復の道具 (深いほど強い) と、いつもの風切りの羽・反魂香 (蘇生の道具。浅い階でも必ず並べ、値段は式のまま — 浅い階では貯めて買う重い買い物)
const INF_FEATHER = "u_float_feather";
const INF_ALWAYS = [INF_FEATHER, "u_soul_incense"];
const INF_RECOVERY = infRecovery;
function infSupplyRecord(kind, id, n = 1) {
  if (!abyssActive() || ITEMS[id]?.slot !== "use") return;
  const trk = infTrk(), supply = trk.supply || (trk.supply = { items: {} });
  supply[kind] = (supply[kind] || 0) + n;
  const row = supply.items[id] || (supply.items[id] = {});
  row[kind] = (row[kind] || 0) + n;
}
function infTlPoint(event = "point", extra = {}) {
  if (!abyssActive() || !tlOn()) return;
  const ab = G.abyss;
  if (!ab.telemetryId) ab.telemetryId = `${Date.now()}-${ab.seed}`;
  const sum = fn => G.party.reduce((n, d) => n + (fn(d) || 0), 0);
  const bag = G.inventory || [];
  tlInfAttempt({ id: ab.telemetryId, f: G.floor, test: !!ab.testRun,
    boons: permanentEventStats(G.events?.once),
    hp: Math.round(100 * sum(d => d.alive ? d.hp : 0) / Math.max(1, sum(d => d.maxhp))),
    mp: Math.round(100 * sum(d => d.alive ? d.mp : 0) / Math.max(1, sum(d => d.maxmp))),
    lv: Math.round(infPartyLv() * 10) / 10, dead: G.party.filter(d => !d.alive).length,
    held: infUseCount(bag), mpItems: bag.filter(it => it.use?.mp || it.use?.mpFull).length,
    reviveItems: bag.filter(it => it.use?.revive).length, left: infSupplyLeft(ab, G.floor),
    supply: JSON.parse(JSON.stringify(infTrk().supply || {})),
    party: G.party.map(d => ({ name: d.name, job: d.jobKey, lv: d.jobLv, tactic: d.tactic,
      stats: { hp: d.maxhp, mp: d.maxmp, atk: d.atk, vit: d.vit, agi: d.agi, int: d.int, pie: d.pie },
      borrowed: (d.subs || []).map(x => ({ uid: x.uid, picks: (Array.isArray(x.picks) ? x.picks : x.passive ? [{ passive: x.passive }] : x.skill ? [{ skill: x.skill }] : []).map(p => ({ ...p })) })),
      equip: Object.fromEntries(Object.entries(d.equip || {}).map(([k, it]) => [k, it?.id || null])),
      souls: [d.primary, ...(d.subs || []).map(x => x.uid)].filter(uid => uid != null).map(uid => { const x = soulByUid(uid); return { job: x?.clsKey, lv: x?.level, count: x?.count }; }) })), ...extra }, event);
}
function infReturn() {
  if (!tlOn()) { leaveDungeon({ outcome: "return" }); return; }
  showChoice("帰還の理由を記録する", [
    ...[["resources", "HP・MP・道具が足りない"], ["danger", "この先は戦力が足りない"], ["reward", "戦利品を確保したい"], ["personal", "時間などの都合で終える"], ["unknown", "理由を記録せず帰る"]].map(([reason, label]) => ({ label, fn: () => { G.abyss.returnReason = reason; leaveDungeon({ outcome: "return" }); } })),
    { label: "戻る", cancel: true, fn: () => openInfRest() },
  ], null, { banner: "テスト記録" });
}
function infSupplyStatus() { return { held: infUseCount(G.inventory), left: infSupplyLeft(G.abyss, G.floor), limit: INF_BUY_CAP }; }
function infBuyBlock(id) {
  if (INF_RECOVERY(ITEMS[id]?.use) && infSupplyLeft(G.abyss, G.floor) < 1) return "この階の回復・蘇生の補給は使い切った";
  if (G.inventory.length >= MAX_ITEMS) return "持ち物がいっぱいだ";
  return null;
}
function infTraderWares() {
  if (!abyssActive()) return [];
  const cap = Math.max(10, lootBand(infLevel(G.floor))[1]);
  const ids = Object.keys(ITEMS).filter((id) => { const it = ITEMS[id]; return it && it.slot === "use" && INF_RECOVERY(it.use) && (it.lv || 1) <= cap; });
  for (const id of INF_ALWAYS) if (ITEMS[id] && !ids.includes(id)) ids.push(id);
  return ids.sort((a, b) => compareUse(ITEMS[a], ITEMS[b]));
}
function infBuy(id, who) {
  if (!infAtRest() || !infTraderWares().includes(id)) return null;
  const block = infBuyBlock(id);
  if (block) { SFX.ng(); showToast(block, { tone: "bad" }); return null; }
  const price = buyPrice(ITEMS[id]);
  if (G.gold < price) { SFX.ng(); showToast("金貨が足りない", { tone: "bad" }); return null; }
  if (!who) who = G.party.find((m) => m.items.length < MAX_ITEMS) || null;
  if (!who || who.items.length >= MAX_ITEMS) { SFX.ng(); showToast("持ち物がいっぱいだ", { tone: "bad" }); return null; }
  const it = cloneItem(id, QUALITY_MID);
  if (!it) return null;
  if (INF_RECOVERY(ITEMS[id].use)) infSpendSupply(G.abyss, G.floor, 1);
  infSupplyRecord("bought", id);
  G.gold -= price;
  who.items.push(it);
  codexSeeItem(id, it);
  SFX.itemget(); buzz(10);
  log(`回収人から ${it.name} を買った (−💰${price}・${who.name})。`, "sys");
  infStats().trades++;
  updateTopbar(); renderParty(); autosave();
  return it;
}
// keep: 商会の棚の追加つきの品とぶつかる時、残す組 ("shelf" / "new" — 回収人の「売る」でその場で選ぶ。shopAfxClash)
function infSell(owner, it, keep = null, quiet = false) {
  if (!infAtRest() || !owner || !it) return false;
  const clash = shopAfxClash(it);
  const ok = sellItem(owner, it, sellPrice(it), clash ? keep : null, quiet);
  if (!quiet && ok && clash && keep) log(keep === "new" ? `商会の棚の ${clash.name} は、いま売った品の追加の能力に置き換わった (前の品は通常品として並ぶ)。` : `商会の棚の ${clash.name} は、前の追加の能力のまま (いま売った品は通常品として並ぶ)。`, "sys");
  if (ok) {
    infSupplyRecord("sold", it.id);
    const st = infStats(); st.trades++; st.sold++; if (st.sold >= 100) infTitleGrant("trader");
    const trk = infTrk(); if (!it.unidentified) trk.sold = (trk.sold || 0) + 1; // この出撃で回収人に売った品 (全滅しても商会の棚に残る)
  }
  return ok;
}
// 一括売却は売る前に棚の候補をまとめる。同じ品を複数売る場合も、全候補から1点だけ残す。
function infSellPlan() {
  if (!infAtRest()) return { list: [], conflicts: [], gold: 0 };
  const list = [];
  for (const doll of bagOwners(G.party)) for (const item of doll.items || []) {
    if (!item || item.locked || item.cursed || item.unidentified || item.slot === "use" || bulkSellBlocked(item)) continue;
    if (G.party.some((d) => opsEquippedBy(d, item))) continue;
    list.push({ doll, item, price: sellPrice(item) });
  }
  const by = new Map(), shelf = shopAfxState();
  for (const { item } of list) {
    if (!item.afx?.length || !ITEMS[item.id]) continue;
    if (!by.has(item.id)) by.set(item.id, shelf[item.id]?.length ? [{ afx: shelf[item.id], current: true }] : []);
    by.get(item.id).push({ afx: item.afx, item, current: false });
  }
  const conflicts = [...by].filter(([, sets]) => sets.length > 1).map(([id, sets]) => {
    const powers = sets.map((s) => affixPower(ITEMS[id], s.afx));
    return { id, name: ITEMS[id].name, best: powers.indexOf(Math.max(...powers)),
      sets: sets.map((s, i) => ({ ...s, afx: s.afx.map((a) => ({ ...a })), lines: affixLines(ITEMS[id], s.afx), power: Math.round(powers[i] * 10) / 10 })) };
  });
  // 比較相手がない品も含め、確認した時点の品質・追加の能力・棚を値として残す。
  // item は実体への参照なので、conflicts の比較だけでは後からの変更を見逃す。
  const snapshot = JSON.stringify(list.map(({ item }) => ({ id: item.id, q: item.q,
    afx: item.afx || [], shelf: shelf[item.id] || [] })));
  return { list, conflicts, snapshot, gold: list.reduce((n, x) => n + x.price, 0) };
}
function infSellAll(plan, choice = {}) {
  const now = infSellPlan();
  // 一覧を開いてから持ち物・値段・棚が変わったら、売らずに一覧を開き直してもらう。
  if (!plan?.list?.length || now.list.length !== plan.list.length || now.list.some((x, i) => x.item !== plan.list[i].item || x.price !== plan.list[i].price) ||
      now.snapshot !== plan.snapshot) return false;
  const keeps = new Map();
  for (const c of now.conflicts) {
    const index = choice[c.id] ?? c.best;
    if (!Number.isInteger(index) || index < 0 || index >= c.sets.length) return false;
    const pick = c.sets[index];
    keeps.set(c.id, pick.item || null);
  }
  for (const { doll, item } of now.list) {
    infSell(doll, item, keeps.has(item.id) && keeps.get(item.id) === item ? "new" : "shelf", true);
  }
  log(`回収人に ${now.list.length}点を一括売却した (+💰${now.gold})。商会の棚に並んだ ― 全滅しても残る。`, "win");
  SFX.select(); buzz(10);
  showToast(`${now.list.length}点を売却 💰+${now.gold}`, { noLog: true });
  renderTown();
  autosave(true);
  return true;
}
// ---- 灯番 (名もない人業): メイン魂・サブ魂の付け替え。砕けた器は付け替えられない。傷・状態異常はそのまま、HP・MP は今の値 (新しい最大値まで) ----
// サブ魂は器ごとに MAX_SUBS (2) まで (本編の解放に依らない。2026-10-12 ユーザーの指示)。一つの器に同じ職業の魂は一つだけ、
// 同じ魂を二つの器に宿すことはできない。ほかの器のサブ魂は、借りる技ごと交換する。
function infSoulHolder(d, uid) {
  for (const x of G.party || []) {
    if (x === d) continue;
    if (x.primary === uid || (x.subs || []).some((sb) => sb && sb.uid === uid)) return x;
  }
  return null;
}
// 付け替えた後の姿を見積もる (器はそのまま戻す)
function infPreviewWith(d, fn) {
  const keep = [d.primary, (d.subs || []).map((x) => x && { ...x, picks: Array.isArray(x.picks) ? x.picks.map((p) => ({ ...p })) : x.picks })];
  try { fn(); recalcDoll(d); return { maxhp: d.maxhp, maxmp: d.maxmp, hp: Math.min(d.hp, d.maxhp), mp: Math.min(d.mp, d.maxmp) }; }
  finally { [d.primary, d.subs] = keep; recalcDoll(d); }
}
function infSoulChangePreview(d, uid) {
  if (!d || !soulByUid(uid)) return null;
  return infPreviewWith(d, () => placeSoulInDoll(d, "primary", uid));
}
function infSoulChangeBlock(d, uid) {
  if (!infAtRest()) return "灯番は風だまりにいる";
  if (!d || !d.alive) return "砕けた器はメイン魂を付け替えられない";
  if (!soulByUid(uid)) return "その魂は無い";
  if (d.primary === uid) return "いま宿している魂";
  const holder = infSoulHolder(d, uid);
  if (holder) return `${holder.name}が宿している`;
  return null; // この器のサブ魂なら、メイン魂と入れ替える (placeSoulInDoll)
}
// HP・MP を今の値のまま (新しい最大値まで) にして、器の能力を付け直す
function infRefit(d, hp, mp) {
  recalcDoll(d);
  d.hp = Math.max(1, Math.min(hp, d.maxhp)); d.mp = Math.max(0, Math.min(mp, d.maxmp));
  for (const x of fixHandsAndShields()) recalcDoll(x); // 二刀流を借りていたサブ魂を外した: 左手の武器は袋へ
  refreshEquipLevels(); // Lv の低い魂へ替えた: 装備できるLv に届かない装備は袋へ
  d.hp = Math.max(1, Math.min(hp, d.maxhp)); d.mp = Math.max(0, Math.min(mp, d.maxmp));
}
function infSwapCount() { const st = infStats(); st.swaps++; if (st.swaps >= 10) infTitleGrant("keeper"); }
function infSwapSoul(d, uid) {
  const why = infSoulChangeBlock(d, uid);
  if (why) { SFX.ng(); showToast(why, { tone: "bad" }); return false; }
  const hp = d.hp, mp = d.mp, before = soulByUid(d.primary);
  placeSoulInDoll(d, "primary", uid); // この器のサブ魂を選んだら、元のメイン魂がその枠へ移る
  infRefit(d, hp, mp);
  const s = soulByUid(uid);
  SFX.levelup(); buzz([0, 20, 40, 20]);
  infSwapCount();
  log(`灯番が${d.name}の魂をつなぎ直した: ${before ? soulLabel(before) : "空"} → ${soulLabel(s)}。`, "win");
  updateTopbar(); renderParty(); autosave(true);
  return true;
}
// サブ魂の枠 si (0 / 1) に魂 uid を宿せないわけ (null = 宿せる)
function infSubBlock(d, si, uid) {
  if (!infAtRest()) return "灯番は風だまりにいる";
  if (!d || !d.alive) return "砕けた器はサブ魂を付け替えられない";
  if (!Number.isInteger(si) || si < 0 || si >= MAX_SUBS || si > (d.subs || []).length) return "その枠は使えない";
  const s = soulByUid(uid);
  if (!s) return "その魂は無い";
  if (((d.subs || [])[si] || {}).uid === uid) return "いま宿している魂";
  if (d.primary === uid) return "メイン魂として宿している";
  const holder = infSoulHolder(d, uid);
  if (holder) {
    if (holder.primary === uid) return `${holder.name}がメイン魂として宿している`;
    if (!holder.alive) return `${holder.name}の器は砕けている`;
    const before = soulByUid((d.subs || [])[si]?.uid);
    if (before && (soulByUid(holder.primary)?.clsKey === before.clsKey || (holder.subs || []).some((x) => x && x.uid !== uid && soulByUid(x.uid)?.clsKey === before.clsKey))) return `${holder.name}に同じ職業の魂がある`;
  }
  const oi = (d.subs || []).findIndex((x) => x && x.uid === uid);
  if (oi >= 0 && !(d.subs || [])[si]) return `サブ魂${oi + 1}に宿している`; // 空いた枠へ移しても並びは変わらない
  if (soulByUid(d.primary)?.clsKey === s.clsKey) return "メイン魂と同じ職業";
  if ((d.subs || []).some((x, i) => i !== si && x && x.uid !== uid && soulByUid(x.uid)?.clsKey === s.clsKey)) return "もう一つのサブ魂と同じ職業";
  return null; // もう一つのサブ魂の枠にある魂なら、枠どうしを入れ替える
}
function infSubPreview(d, si, uid) {
  if (!d) return null;
  if (uid == null) return infPreviewWith(d, () => { d.subs = (d.subs || []).filter((_, i) => i !== si); });
  if (!soulByUid(uid)) return null;
  const holder = infSoulHolder(d, uid);
  const sub = holder?.subs?.find((x) => x && x.uid === uid);
  return infPreviewWith(d, () => {
    if (sub) {
      d.subs = [...(d.subs || [])];
      d.subs[si] = { ...sub, picks: sub.picks?.map((p) => ({ ...p })) };
    } else placeSoulInDoll(d, "sub" + si, uid);
  });
}
// サブ魂を宿す (uid) / 外す (uid = null)
function infSetSub(d, si, uid) {
  if (uid == null) {
    if (!infAtRest() || !d || !d.alive) { SFX.ng(); showToast(d && !d.alive ? "砕けた器はサブ魂を付け替えられない" : "灯番は風だまりにいる", { tone: "bad" }); return false; }
    const cur = soulByUid(((d.subs || [])[si] || {}).uid);
    if (!cur) return false;
    const hp = d.hp, mp = d.mp;
    d.subs = (d.subs || []).filter((_, i) => i !== si);
    infRefit(d, hp, mp);
    SFX.select(); buzz(15);
    log(`灯番が${d.name}のサブ魂 ${soulLabel(cur)} を外した。`, "sys");
    updateTopbar(); renderParty(); autosave(true);
    return true;
  }
  const why = infSubBlock(d, si, uid);
  if (why) { SFX.ng(); showToast(why, { tone: "bad" }); return false; }
  const hp = d.hp, mp = d.mp, before = soulByUid(((d.subs || [])[si] || {}).uid);
  const holder = infSoulHolder(d, uid);
  if (holder) {
    const hi = holder.subs.findIndex((x) => x && x.uid === uid);
    const otherHp = holder.hp, otherMp = holder.mp;
    // 借用の選択済み印も含め、サブ魂の設定を丸ごと交換する。
    const outgoing = (d.subs || [])[si];
    d.subs = [...(d.subs || [])];
    d.subs[si] = holder.subs[hi];
    if (outgoing) holder.subs[hi] = outgoing;
    else holder.subs.splice(hi, 1);
    // 両者の借用を反映してから、二刀流などの装備条件を調べる。
    recalcDoll(d); recalcDoll(holder);
    infRefit(holder, otherHp, otherMp);
    log(`灯番が${holder.name}のサブ魂${hi + 1}を${d.name}と交換した。`, "sys");
  } else placeSoulInDoll(d, "sub" + si, uid);
  infRefit(d, hp, mp);
  const s = soulByUid(uid);
  SFX.levelup(); buzz([0, 20, 40, 20]);
  infSwapCount();
  log(`灯番が${d.name}のサブ魂${si + 1}をつなぎ直した: ${before ? soulLabel(before) : "空き"} → ${soulLabel(s)}。`, "win");
  updateTopbar(); renderParty(); autosave(true);
  return true;
}

// ===== 記録 =====
function abyssRecords() {
  if (!G.abyssRec || G.abyssRec.v !== 2) G.abyssRec = { v: 2, bestDepth: 0, runs: 0, recent: [] };
  return G.abyssRec;
}

// ===== 無限迷宮の称号と勲章の数え (docs/infinite-affixes.md 4・5章) =====
// G.stats.inf = 通しの数え (勲章 ACH_SERIES の inf* と称号)。G.abyss.trk = この出撃だけの数え (称号の「1回の出撃で」)
const INF_STAT_KEYS = ["deepest", "bosses", "runs", "homeRets", "soulsHome", "rareSouls", "rareAfx", "trades", "sold", "swaps", "clean"];
function infStats() {
  const s = G.stats.inf && typeof G.stats.inf === "object" ? G.stats.inf : (G.stats.inf = {});
  for (const k of INF_STAT_KEYS) if (typeof s[k] !== "number") s[k] = 0;
  if (!s.titles || typeof s.titles !== "object") s.titles = {};
  if (!s.jobs || typeof s.jobs !== "object") s.jobs = {};
  if (s.title && !INF_TITLE_MAP[s.title]) s.title = null;
  return s;
}
function infTrk() {
  const ab = G.abyss;
  if (!ab) return { sp: 0, at: 0, broke: false, rareAfx: 0, bossMax: 0 };
  if (!ab.trk) ab.trk = { sp: 0, at: 0, broke: false, rareAfx: 0, bossMax: 0 };
  return ab.trk;
}
// 称号を得る (一度きり)。得た時だけ知らせる
function infTitleGrant(key) {
  const s = infStats(), t = INF_TITLE_MAP[key];
  if (!t || s.titles[key]) return;
  s.titles[key] = Date.now();
  if (!s.title) s.title = key; // 初めての称号は付けておく (入口の「称号」で付け替えられる)
  log(`称号「${t.name}」を得た。(${t.cond})`, "win");
  setTimeout(() => showToast(`✦ 称号「${t.name}」を得た`, { noLog: true, tone: "gold" }), 400);
}
function infTitleName() { const s = infStats(); return s.title && INF_TITLE_MAP[s.title] ? INF_TITLE_MAP[s.title].name : ""; }
function setInfTitle(key) {
  const s = infStats();
  if (key && !s.titles[key]) return false;
  s.title = key || null;
  autosave(true);
  return true;
}
function infTitleList() { const s = infStats(); return INF_TITLES.map((t) => ({ ...t, got: !!s.titles[t.key], on: s.title === t.key })); }
// この出撃の数えで決まる称号を確かめる (階の到着・戦闘の後・魂/残火を拾った時)
function infCheckRun() {
  if (!abyssActive()) return;
  const trk = infTrk(), run = G.run || {};
  if (G.party.some((d) => !d.alive)) trk.broke = true;
  const f = G.abyss.depth || G.floor || 1;
  const s = infStats();
  s.deepest = Math.max(s.deepest, f);
  for (const [n, k] of INF_DEPTH_TITLES) if (f >= n) infTitleGrant(k);
  if (f >= 30 && G.abyss.allCommon) infTitleGrant("commons");
  if (f >= 50 && !trk.broke) infTitleGrant("undying");
  if ((run.souls || []).length >= 10) infTitleGrant("picker");
  if ((run.embers || 0) >= 20) infTitleGrant("embers");
}
// 戦闘の後 (勝った戦い): 技・通常攻撃の数えと、主を倒した時の称号
function infBattleTrack(b, guard) {
  if (!abyssActive() || !b) return;
  const trk = infTrk(), sh = b.show || {};
  trk.sp += sh.sp || 0; trk.at += sh.at || 0;
  if (guard) {
    const s = infStats(), alive = G.party.filter((d) => d.alive);
    s.bosses++;
    infTitleGrant("boss1");
    if (alive.length === 1) infTitleGrant("lone");
    if (alive.length && alive.every((d) => d.hp <= d.maxhp * 0.3)) infTitleGrant("brink");
    if (!G.party.some((d) => !d.alive)) s.clean++;
    if (G.floor >= 20 && !trk.sp) infTitleGrant("blade");
    if (G.floor >= 20 && !trk.at) infTitleGrant("prayer");
    trk.bossMax = Math.max(trk.bossMax || 0, G.floor);
  }
  infCheckRun();
}
// テスト記録の無限迷宮の欄 (docs/infinite-labyrinth.md 16-4): 階に着いた時の隊の様子
function infPartyLv() { const ps = (G.party || []).filter((d) => d.primary != null); return ps.length ? ps.reduce((a, d) => a + (d.jobLv || 1), 0) / ps.length : 1; }
function infTlArrive() {
  if (!abyssActive() || !tlOn()) return;
  if (G.floor === 1 || G.floor % 5 === 0) infTlPoint("floor");
  else infTlPoint();
  const trk = infTrk(), now = G.stats.playMs || 0;
  const alive = G.party.filter((d) => d.alive);
  const sum = (f) => G.party.reduce((a, d) => a + (f(d) || 0), 0);
  tlInfFloor({ f: G.floor, lv: infPartyLv(), rec: infLevel(G.floor), ms: trk.floorT != null ? now - trk.floorT : 0, n: trk.fb || 0,
    hp: sum((d) => d.maxhp) ? sum((d) => d.alive ? d.hp : 0) / sum((d) => d.maxhp) : 0, mp: sum((d) => d.maxmp) ? sum((d) => d.alive ? d.mp : 0) / sum((d) => d.maxmp) : 0,
    broke: G.party.length - alive.length, capped: (G.souls || []).filter((x) => x && (x.level || 1) >= soulLevelCapOf(x)).length, embers: G.embers || 0 });
  trk.floorT = now; trk.fb = 0;
}
// 品を拾った (無限迷宮の追加の能力): 秘・極の数え
function infAfxTrack(it) {
  if (!it || !it.afxTier) return;
  if (it.afxTier !== "r" && it.afxTier !== "x") return;
  const s = infStats(), trk = infTrk();
  s.rareAfx++; trk.rareAfx++;
  if (it.afxTier === "x") infTitleGrant("star");
  if (trk.rareAfx >= 5) infTitleGrant("hoard");
}

// ===== 本編を退ける / 戻す =====
// 潜っている間は、本編の隊・控え・魂・通貨を G.abyss.home に退ける (控えも退けるのは、
// 魂の付け替え・再計算で本編の人業が仮の器の魂を読まないため)。赤い魂・図鑑・在庫は本編のまま
const INF_HOME_KEYS = ["inventory", "party", "reserve", "souls", "gold", "soulPts", "embers"];
function infStashHome() {
  const h = {};
  for (const k of INF_HOME_KEYS) h[k] = G[k];
  return h;
}
function infRestoreHome(home) {
  if (!home) return;
  for (const k of INF_HOME_KEYS) if (home[k] !== undefined) G[k] = home[k];
  if (!Array.isArray(G.souls)) G.souls = [];
  setSharedSouls(G.souls);
  syncClueBoons();
  recalcAllDolls();
}
// 仮の器の名 = いまの隊の人業の名 (並びの順。隊が6人に満たなければ控えの順、それでも足りなければ「〜の器」)。
// 人業は魂のほんの一部を仮の器に移して降りる — 育った力は風に吹き返されるが、記憶は器に残る (2026-10-11 ユーザーの指示)。
// 本編の人業は街で待つので、同じ名が二つあっても矛盾しない
function infVesselNames() {
  const src = [...(G.party || []), ...(G.reserve || [])].filter((d) => d && d.name);
  const out = [];
  for (let i = 0; i < INF_PARTY; i++) {
    const d = src[i];
    out.push(d ? { name: d.name, from: d.uid } : { name: VESSEL_NAMES[i] || `器${i + 1}`, from: null });
  }
  return out;
}
// 仮の器を1体つくる (メイン魂 = 入口で選んだ魂の欠片。Lv1)。who = infVesselNames の1つ (名と元の人業)
function makeVessel(i, clsKey, who) {
  const d = makeDoll((who && who.name) || VESSEL_NAMES[i] || `器${i + 1}`);
  d.vessel = "inf";
  if (who && who.from != null) d.homeUid = who.from; // 記憶を移した元の人業
  const s = addSoulInstance(clsKey);
  s.first = true; // 最初に宿した欠片は持ち帰れない
  d.primary = s.uid;
  recalcDoll(d);
  d.hp = d.maxhp; d.mp = d.maxmp;
  codexJobSee(clsKey, 1, 1);
  return d;
}
// 迷宮の中で魂を拾った: 同じ職の魂を持っていれば自動で融合 (Lv上限が伸びる)、無ければ灯番で宿せる魂として加わる。
// 持ち帰りは「拾った数」(G.run.souls) で数える
function infGainSoul(clsKey) {
  const rar = (SOUL_CLASSES[clsKey] || {}).rarity;
  tlInfSoul(rar);
  if (rar === "epic" || rar === "legend") infStats().rareSouls++;
  if (rar === "legend") infTitleGrant("legend");
  const have = G.souls.find((s) => s && s.clsKey === clsKey);
  if (have) {
    have.count = (have.count || 1) + 1;
    const up = settleSoulExp(have);
    recalcAllDolls({ levelUp: up > 0 });
    return { fused: true, soul: have };
  }
  return { fused: false, soul: addSoulInstance(clsKey) };
}
// 帰る (outcome: return / saved) か全滅 (wipe) で、無限迷宮を閉じる。本編を戻し、持ち帰るものを本編へ渡す
function infCloseRun(outcome) {
  const ab = G.abyss;
  if (!ab) return null;
  const keep = outcome !== "wipe";
  const run = G.run || newRun();
  const depth = ab.depth || G.floor || 1;
  // 持ち帰る品: 仮の器の装備と袋の品すべて (手元には届かず商会の棚へ)
  const items = [];
  for (const d of G.party || []) {
    for (const it of d.items || []) if (it && it.id && !items.includes(it)) items.push(it);
    for (const k of Object.keys(d.equip || {})) { const it = d.equip[k]; if (it && it.id) items.push(it); }
  }
  const souls = (run.souls || []).map((x) => x && x.clsKey).filter((k) => k && SOUL_CLASSES[k]);
  const embers = Math.max(0, run.embers || 0);
  const vLv = infPartyLv(), vDead = (G.party || []).some((d) => !d.alive); // 仮の器の様子 (本編を戻す前に)
  infTlPoint("end", { outcome, reason: ab.returnReason || (outcome === "return" ? "unknown" : "wipe") });
  infRestoreHome(ab.home);
  if (ab.savedIdx != null) G.dungeonIdx = Math.min(DUNGEONS.length - 1, Math.max(0, ab.savedIdx));
  const got = { items: [], souls: [], embers: 0 };
  if (keep) {
    for (const it of items) { shopReceive(it); codexSeeItem(it.id, it); got.items.push({ id: it.id, name: itemName(it), rar: rarityKey(it), afx: !!(it.afx && it.afx.length) }); }
    for (const k of souls) { addSoulInstance(k); codexJobSee(k, 1, 1); tlSoulGot(k); got.souls.push(k); }
    if (embers) { G.embers = (G.embers || 0) + embers; got.embers = embers; }
    if (souls.length) recalcAllDolls();
  }
  // 勲章・称号の数え (帰る = 主の後に帰還を選んだ)
  const st = infStats(), trk = ab.trk || {};
  if (outcome !== "return") tlInfWipe({ f: depth, lv: vLv, rec: infLevel(depth), outcome });
  st.deepest = Math.max(st.deepest, depth);
  if (keep) st.soulsHome += souls.length;
  if (outcome === "return") {
    st.homeRets++;
    if (!trk.broke && !vDead && (trk.bossMax || 0) > 20) infTitleGrant("clean");
  }
  const rec = abyssRecords();
  const newDepth = depth > rec.bestDepth;
  rec.runs++;
  rec.bestDepth = Math.max(rec.bestDepth, depth);
  rec.recent.unshift({ depth, outcome, at: Date.now() });
  rec.recent = rec.recent.slice(0, 8);
  G.stats.abyssBest = Math.max(G.stats.abyssBest || 0, depth);
  G.abyss = null;
  return { depth, outcome, keep, newDepth, got, sold: trk.sold || 0, title: infTitleName(), lost: keep ? null : { items: items.length, souls: souls.length, embers } };
}
// 読み込み: 無限迷宮の途中なら、いったん本編の隊・魂・通貨を G へ戻して読み込みの手当てを掛け、済んだら仮の器へ戻す
function infSwapForLoad() {
  const ab = G.abyss;
  if (!ab || ab.v !== 2 || !ab.home) return null;
  const run = {};
  for (const k of INF_HOME_KEYS) { run[k] = G[k]; if (ab.home[k] !== undefined) G[k] = ab.home[k]; }
  return run;
}
function infSwapBackAfterLoad(run) {
  const ab = G.abyss;
  if (!ab || !ab.home) return;
  for (const k of INF_HOME_KEYS) { ab.home[k] = G[k]; G[k] = run[k]; }
  if (!Array.isArray(G.souls)) G.souls = [];
  G.souls = G.souls.filter((s) => s && SOUL_CLASSES[s.clsKey]);
  setSharedSouls(ab.home.souls || []); // 魂の通し番号を本編の魂の続きにもそろえる
  setSharedSouls(G.souls);
  syncDollUids([...(ab.home.party || []), ...(ab.home.reserve || []), ...(G.party || [])]);
  for (const d of G.party || []) {
    if (d.primary != null && !soulByUid(d.primary)) d.primary = null;
    d.subs = (Array.isArray(d.subs) ? d.subs : []).filter((x) => x && soulByUid(x.uid) && x.uid !== d.primary).slice(0, MAX_SUBS); // サブ魂は風だまりの灯番で宿す
    try { recalcDoll(d); } catch {}
  }
  syncClueBoons();
}
// 旧仕様の奈落の途中のセーブ: 読み込みで終わらせて街へ (本編の隊のまま潜っていたので、得たものはそのまま残す)
function endLegacyAbyss() {
  if (!G.abyss || G.abyss.v === 2) return;
  const idx = G.abyss.savedIdx;
  G.abyss = null;
  if (idx != null) G.dungeonIdx = Math.min(DUNGEONS.length - 1, Math.max(0, idx));
  if (inDungeon()) {
    G.state = "town"; G.battle = null; G.battleCell = null; G.board = null; G.run = null;
    for (const p of G.party || []) if (p && p.alive === false && p.hp <= 0) { p._dead = true; }
  }
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
// 迷宮ごとの決まった数 (盤面の絵の種)。旧来の難度 n は A1 で廃止した (強さ・報酬・落とし物は推奨Lv で決まる)
function dungeonSeed(cfg) {
  const id = (cfg && cfg.id) || "";
  let h = 7;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 997) + (abyssActive() ? G.abyss.depth : 0);
}
// 現在の迷宮の層テーマ (全100迷宮 = 20層)
function dungeonTheme(cfg = activeCfg()) {
  const L = (cfg && cfg.layer) || 1;
  return LAYER_VISUALS[Math.min(20, Math.max(1, L)) - 1];
}

// ===== 特別階 =====
// 階段を降りた時、一定確率で「特別な効果を持つ階」が出現する (1Fと強敵階には出ない)。
// 効果はその階に滞在する間だけ有効。board(b) は newFloor 直後の盤面加工フック。
const SPECIAL_FLOORS = [
  { id: "mighty", name: "強大な気配", icon: "corpseGreat", accent: "#ffcf4a", sym: "✟", minFloor: 3, rate: 0.01,
    lines: ["この階のどこかに「偉大なる死体」が眠っている。", "並の魂ではない。必ずや希少な魂が宿っているだろう。"],
    board: (b) => sfPlace(b, 1, (c) => { c.type = "corpse"; c.cleared = false; c.corpseWarm = true; c.corpseGreat = true; c.corpseClass = rollGreatCorpseClass(); }) },
  { id: "bounty", name: "豊穣の間", icon: "gold", accent: "#ffd84a", sym: "❂", minFloor: 2, rate: 0.05, goldMul: 2,
    lines: ["黄金の気が満ちている。", "この階で得る金貨が 2倍 になる。"] },
  { id: "soulTide", name: "魂の奔流", icon: "wisp", accent: "#7fd0ff", sym: "✧", minFloor: 2, rate: 0.03, soulMul: 1.5,
    lines: ["死者たちの声がざわめいている。", "この階で得る ✦Soul が 1.5倍 になる。"] },
  { id: "silence", name: "静寂の階", icon: "trap", accent: "#9be88a", sym: "∅", minFloor: 2, rate: 0.02, noTrap: true,
    lines: ["仕掛けという仕掛けが朽ち果てている。", "この階に罠も、足元の仕掛け (落ちる床・蝕む床) も無い。"],
    board: (b) => sfEachCell(b, (c) => { if (c.type === "trap" || c.type === "poison" || c.type === "pit") { c.type = "empty"; c.cleared = true; } }) },
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
    lines: ["無数の足音とうなり声…敵が異常に多い (出現マス +4)。", "この階の敵をすべて葬れば、迷宮の深さに応じた魂と財が手に入る。"],
    board: (b) => sfPlace(b, 4, (c) => { c.type = "monster"; c.monsterKey = pickFrom(sfMonsterPool()); c.cleared = false; }) },
  { id: "thiefInsight", name: "盗賊の洞察", icon: "chest", accent: "#6fae46", sym: "♠", minFloor: 2, rate: 0.02, sureChest: true, sureDisarm: true,
    lines: ["盗賊の勘が冴え渡る。敵は必ず宝を遺し、罠はことごとく見抜ける。", "敵が100%宝箱を落とし、宝箱の罠解除率が100%になる。"] },
  // からくり錠の宝物庫 (2026-10 ユーザーの指示): 罠の解除がはるかに難しく、解除を上げる備え (盗賊系の魂・盗賊の眼・AGI/LUK) が無いとまず外せない。
  //  そのかわり宝箱は必ず罠つき・2ランク上等・中身は必ず装備品で、装備の質も上がる (戦闘後の宝箱も同じ)
  { id: "lockworks", name: "からくり錠の宝物庫", icon: "chest", accent: "#c8a24a", sym: "♜", minFloor: 3, rate: 0.015,
    lockMul: 3, chestTrapRate: 1, chestRankUp: 2, chestLootLv: 15, chestNoGold: true,
    lines: ["からくり職人が錠を凝らした宝物庫の跡だ。宝箱はすべて罠つきで、解除は並の3倍難しい。", "そのかわり宝箱は上等で、中身は必ず質の良い装備品だ。"],
    board: (b) => sfPlace(b, 2, (c) => { c.type = "chest"; c.cleared = false; }) },
  { id: "miasma", name: "瘴気の階", icon: "poison", accent: "#8a2be2", sym: "☣", minFloor: 2, rate: 0.02, enemyMul: 1.25, soulMul: 2,
    lines: ["よどんだ瘴気が敵を昂らせている。敵が強い。", "だが得られる ✦Soul は 2倍 になる。"] },
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
    board: (b) => sfPlace(b, 4, (c) => { c.type = "corpse"; c.cleared = false; c.corpseClass = rollJobClass(); c.corpseWarm = random() < 0.5; }) },
  // 毒の沼の階は、沼の土地 (蝕む床が沼の迷宮・奈落の層) にだけ出る (floorhaz.js の bog)
  { id: "marsh", name: "毒の沼", icon: "poison", accent: "#5a8a2a", sym: "≈", minFloor: 2, rate: 0.02, goldMul: 1.5,
    cond: (cfg) => !!(hazPlaced(cfg, "harm") && hazPlaced(cfg, "harm").bog),
    lines: ["床のいたるところから毒がにじみ出している。", "足場は危険だが、沼には金品が沈んでいる。金貨 1.5倍。"],
    board: (b) => sfEachCell(b, (c) => { if (c.type === "empty" && sfOpenCount(c) >= 2 && random() < 0.30) { c.type = "poison"; c.cleared = false; } }) },
  { id: "tailwind", name: "追い風の階", icon: "stairs", accent: "#7fe0a8", sym: "≫", minFloor: 2, rate: 0.02, preempt100: true, noAmbush: true,
    lines: ["不思議と体が軽く、敵の動きがよく見える。", "常に先制し、奇襲を受けない。"] },
  { id: "elemSurge", name: "属性の奔流", icon: "wisp", accent: "#ff9a4a", sym: "✺", minFloor: 2, rate: 0.02, elemRandom: true,
    lines: ["六つの属性が荒れ狂い、渦を巻いている。", "この階の敵の属性は、戦うたびにでたらめに定まる。"] },
  { id: "mimicNest", name: "ミミックの巣", icon: "chest", accent: "#e07840", sym: "◈", minFloor: 3, rate: 0.015, mimicRate: 0.50,
    lines: ["不自然なほど宝箱が多い…罠の匂いがする。", "宝箱の半分はミミックだ。だが倒せば上質な宝箱を残す。"],
    board: (b) => sfPlace(b, 3, (c) => { c.type = "chest"; c.cleared = false; }) },
  { id: "healing", name: "癒しの霊気", icon: "fountain", accent: "#8af0c0", sym: "✚", minFloor: 2, rate: 0.02, victoryHeal: 0.10,
    lines: ["澄んだ霊気が満ち、傷を癒してくれる。", "戦闘に勝利するたび、味方全員のHPとMPが10%回復する。"] },
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
// 無限迷宮の50階ごとの節目は、抽選や出来事の強敵階指定より優先する。
function applyInfMightyFloor() {
  if (!abyssActive() || G.floor <= 0 || G.floor % 50 !== 0) return;
  G.eliteFloor = false;
  G.specialFloor = "mighty";
}
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
// 殲滅報酬: その階の推奨Lv の普通の戦い HORDE_BATTLES 戦ぶんの Soul とゴールドを授ける
const HORDE_BATTLES = 3;
function grantHordeReward() {
  G.board._hordeRewarded = true;
  const lv = levelHere().lv;
  const soul = Math.round(refSoul(lv) * HORDE_BATTLES), gold = Math.round(refGold(lv) * HORDE_BATTLES);
  G.gold += gold; G.soulPts += soul;
  if (G.run && inDungeon()) { G.run.gold += gold; G.run.soulPts += soul; }
  if (tlOn() && inDungeon()) { tlGain(tlWhere(), "gold", gold, "hd"); tlGain(tlWhere(), "soul", soul, "hd"); }
  updateTopbar();
  log(`この辺りの敵をすべて葬った！ 💰${gold} と ✦${soul} Soul を得た。`, "win");
  SFX.victory(); flashScreen("#d4504e");
  showEvent({
    banner: "✦ 殲滅 ✦", title: "この辺りの敵をすべて葬った",
    accent: "#d4504e", sprite: ICONS.poison, sparkle: true,
    lines: ["群れを狩り尽くした褒美だ。", `獲得 金貨 💰${gold}`, `回収した ✦Soul ✦${soul}`],
    onClose: () => renderBoard(), noLog: true,
  });
}

// ===== 迷宮の異変 (出撃単位のミューテーター) =====
// 出撃時に一定確率で迷宮全体に「異変」が起きている。受け入れて潜るか、避けて
// 普通に潜るかを選べる (リスクと引き換えに見返りが大きい)。効果は特別階と同じ
// キー (enemyMul/goldMul/soulMul/…) を使い、特別階の効果とは独立に重ね掛けされる。
const MUTATORS = [
  { id: "bloodTide", name: "血の満潮", sym: "🩸", accent: "#d4504e", enemyMul: 1.3, soulMul: 2,
    risk: "魔物どもが昂ぶり、強くなっている (敵の強さ 1.3倍)",
    gain: "得られる ✦Soul が 2倍 になる" },
  { id: "goldRush", name: "黄金熱", sym: "💰", accent: "#ffd84a", enemyMul: 1.25, goldMul: 2,
    risk: "財の気配に魔物が殺気立っている (敵の強さ 1.25倍)",
    gain: "得られる金貨が 2倍 になる" },
  { id: "sealedExit", name: "閉ざされた退路", sym: "⛓", accent: "#9aa0ac", noFlee: true, chestRankUp: 1,
    risk: "すべての戦闘から逃げられない",
    gain: "宝箱がすべて 1ランク上等になる" },
  { id: "hungryPack", name: "飢えた狩場", sym: "Ψ", accent: "#c08a4a", packMin: 3, soulMul: 1.3,
    risk: "敵が常に群れで現れる (3体以上)",
    gain: "得られる ✦Soul が 30% 増える" },
  { id: "nightHunt", name: "闇討ちの宴", sym: "🌘", accent: "#7a5ad0", ambushMul: 4, goldMul: 1.5, soulMul: 1.3,
    risk: "奇襲を受けやすくなる",
    gain: "金貨 1.5倍・✦Soul 1.3倍" },
  { id: "elemRage", name: "属性の暴走", sym: "✺", accent: "#ff9a4a", elemRandom: true, soulMul: 1.5,
    risk: "すべての敵の属性が狂い、でたらめに入れ替わる (火の魔物が水をまとうことも)",
    gain: "得られる ✦Soul が 1.5倍 になる" },
  { id: "mimicMarch", name: "ミミックの行進", sym: "◈", accent: "#e07840", mimicRate: 0.30, chestRankUp: 1,
    risk: "宝箱の3割はミミックだ",
    gain: "宝箱が 1ランク上等になり、ミミックは上質な宝箱を残す" },
  { id: "abyssalSurge", name: "深淵の脈動", sym: "☠", accent: "#8a2be2", enemyMul: 1.5, soulMul: 2, goldMul: 1.5, lootBonusLv: 8,
    risk: "迷宮中の敵が大幅に強くなっている (敵の強さ 1.5倍)",
    gain: "✦Soul 2倍・金貨 1.5倍・落ちている装備の質が上がる" },
];
// ===== 迷宮の掟 (world.js の trait) =====
// 迷宮ごとの決まりごと。効果は異変と同じキー (mods) で activeModifierDefs に加わり、盤面の加工 (board) は
// 階を作るたびに TRAIT_BOARD で行う。奈落・町では効かない
function dungeonTrait(cfg = null) {
  if (!cfg && inDungeon() && abyssActive()) return infRule(); // 無限迷宮: いまの区切りの掟 (abyss.js INF_RULES)
  if (!cfg) { if (!inDungeon() || abyssActive() || G.rematch) return null; cfg = curDungeon(); }
  return (cfg && cfg.trait) || null;
}
// 戦闘の開幕に効く掟 (迷宮の掟 — 1つの迷宮に1つだけ)。head = 開幕の演出で掲げる見出し
function openingRules() {
  const tr = dungeonTrait();
  return tr ? [{ ...tr, head: `${abyssActive() ? "風の掟" : "迷宮の掟"}「${tr.name}」` }] : [];
}
// 掟の開幕の効果を記録に書く一文 (say は文字列か、効果を2つ持つ掟では効果ごとの文)
function ruleSay(r, k) { return r.say && typeof r.say === "object" ? r.say[k] : r.say; }
// 魔封じ (掟の physOnly): この迷宮では物理技のほかの技 (呪文・回復・強化・弱体・迷宮の術) を使えない。道具は使える
function physOnlyHere() { const tr = dungeonTrait(); return !!(tr && tr.physOnly); }
setSkillGate((k) => !physOnlyHere() || !!(SPELLS[k] && SPELLS[k].kind === "phys"));
const TRAIT_BOARD = {
  // 根の縦穴 / 螺旋の吹き抜け: 通路に落ちる床 (その迷宮の floorHaz.fall) を2つ (最下階には無い)。遺品の宝箱をひとつ
  shaft: (b) => {
    const st = b.start ? b.cells[b.start.y][b.start.x] : null;
    if (G.floor < (curDungeon().floors || 1)) {
      const cand = [];
      sfEachCell(b, (c) => { if (c !== st && c.type === "empty" && sfOpenCount(c) >= 2) cand.push(c); });
      for (let i = 0; i < 2 && cand.length; i++) { const c = cand.splice(rand(cand.length), 1)[0]; c.type = "pit"; c.cleared = false; }
    }
    sfPlace(b, 1, (c) => { c.type = "chest"; c.cleared = false; });
  },
  // 閉ざされた獄: 獄死した囚人の骸を2つ (半分はまだ温かい)
  prison: (b) => {
    const share = corpseFadeShare(); // 掟の corpseFade: 隊のLv が推奨Lv を超えるほど増える死体が減る
    sfPlace(b, 2, (c) => { if (random() >= share) return; c.type = "corpse"; c.cleared = false; c.corpseClass = rollJobClass(); c.corpseWarm = random() < 0.5; });
  },
  // 沈んだ供物: 参道に捧げられた供物の宝箱を2つ (掟の mimicRate で3割はミミック)
  offering: (b) => sfPlace(b, 2, (c) => { c.type = "chest"; c.cleared = false; }),
  // 洗礼の水: まだ澄んだ洗礼の水 (癒しの泉) を2つ
  font: (b) => sfPlace(b, 2, (c) => { c.type = "fountain"; c.cleared = false; c.fountainKind = "pure"; }),
  // 雲間の泉 (雲上の庭): 泉を2つ。見た目は癒しの泉だが、3つに1つは雷雲の澱みで呪われている (飲むまでわからない — useVeiledFountain)
  cloudspring: (b) => sfPlace(b, 2, (c) => { c.type = "fountain"; c.cleared = false; c.fountainKind = "veiled"; }),
  // 噴き出す火: 通路の1割強が蝕む床 (この迷宮では灼けた床。浮遊で避けられる)
  vent: (b) => {
    const st = b.start ? b.cells[b.start.y][b.start.x] : null;
    sfEachCell(b, (c) => { if (c !== st && c.type === "empty" && sfOpenCount(c) >= 2 && random() < 0.12) { c.type = "poison"; c.cleared = false; } });
  },
  // 吹き上げる風 (奈落の氷棚): 通路に落ちる床 (氷の割れ目) を3つ (最下階には無い)
  ledge: (b) => {
    if (G.floor >= (curDungeon().floors || 1)) return;
    const st = b.start ? b.cells[b.start.y][b.start.x] : null;
    const cand = [];
    sfEachCell(b, (c) => { if (c !== st && c.type === "empty" && sfOpenCount(c) >= 2) cand.push(c); });
    for (let i = 0; i < 3 && cand.length; i++) { const c = cand.splice(rand(cand.length), 1)[0]; c.type = "pit"; c.cleared = false; }
  },
  // ぬかるむ岸 (腐れ水の岸): 通路の1割半が蝕む床 (毒の沼。浮遊で避けられる)
  bog: (b) => {
    const st = b.start ? b.cells[b.start.y][b.start.x] : null;
    sfEachCell(b, (c) => { if (c !== st && c.type === "empty" && sfOpenCount(c) >= 2 && random() < 0.15) { c.type = "poison"; c.cleared = false; } });
  },
  // 氷漬けの先人 (凍れる操霊師の間): 氷の柱の根元の骸を2つ (3割はまだあたたかい)
  icetomb: (b) => sfPlace(b, 2, (c) => { c.type = "corpse"; c.cleared = false; c.corpseClass = rollJobClass(); c.corpseWarm = random() < 0.3; }),
  // 迷い霧: 通路の1割強が蝕む床 (胞子の床) に。霧の奥 (行き止まり優先) に癒しの泉をひとつ
  mist: (b) => {
    const st = b.start ? b.cells[b.start.y][b.start.x] : null;
    sfEachCell(b, (c) => { if (c !== st && c.type === "empty" && sfOpenCount(c) >= 2 && random() < 0.12) { c.type = "poison"; c.cleared = false; } });
    const dead = [];
    sfEachCell(b, (c) => { if (c !== st && c.type === "empty" && sfOpenCount(c) === 1) dead.push(c); });
    const put = (c) => { c.type = "fountain"; c.cleared = false; c.fountainKind = "pure"; };
    if (dead.length) put(dead[rand(dead.length)]); else sfPlace(b, 1, put);
  },
};
// 適用中の異変の定義 (なければ null) / 効果値の取り出し
function mutDef() { return G.mutator ? MUTATORS.find((m) => m.id === G.mutator) || null : null; }

// 効果キーごとの合成方式: 倍率は積算 / 加算値は合算 / 確率系は最大 / 真偽は論理和。
// これにより「迷宮の異変」「迷宮の掟」「無限迷宮の風の掟」が同一フックでそのまま効く。
const MUT_AGG = {
  enemyMul: "mul", soulMul: "mul", goldMul: "mul",
  ambushMul: "amb", mimicRate: "max", chestTrapRate: "max", lockMul: "mul",
  lootBonusLv: "add", packMin: "max", chestRankUp: "add",
  noFlee: "or", elemAll: "or", elemRandom: "or", noTrap: "or", poisonUp: "or",
};
// この出撃で効いている全修飾子源 (迷宮の異変 + 迷宮の掟 (無限迷宮では風の掟) + 出来事の効果) を列挙
function activeModifierDefs() {
  const defs = [];
  const md = mutDef(); if (md) defs.push(md);
  // 迷宮の掟 (world.js の trait.mods): その迷宮に潜っている間ずっと効く
  const tr = dungeonTrait(); if (tr && tr.mods) defs.push(tr.mods);
  // 迷宮のイベントの効果 (この出撃 / この階)。迷宮の中でだけ効く
  if (inDungeon()) { // 無限迷宮でも、無限迷宮だけの出来事 (infevents.js) の効果が効く
    if (G.run && G.run.ev && Array.isArray(G.run.ev.mods)) defs.push(...G.run.ev.mods);
    if (G.board && G.board.ev && Array.isArray(G.board.ev.mods)) defs.push(...G.board.ev.mods);
  }
  return defs;
}
// 敵の属性がでたらめに定まるか (異変「属性の暴走」/ 特別な階「属性の奔流」)
function elemRandomHere() {
  const sp = specialDef();
  return !!((sp && sp.elemRandom) || mutNum("elemRandom", false));
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
    // 奇襲の倍率: 増やすもの (1以上) は一番強いものだけ、減らすもの (1未満) は掛け合わせる (以前は max で、半分・0 が効いていなかった)
    case "amb": return vals.filter((v) => v >= 1).reduce((a, b) => Math.max(a, b), 1) * vals.filter((v) => v < 1).reduce((a, b) => a * b, 1);
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
// この迷宮・この階の雑魚プール (board.js と同じ切り替え: 台帳の迷宮は5階ごとの帯、ほかは浅階/深階)
function sfMonsterPool() {
  return poolAt(activeCfg(), G.floor || 1);
}
// テーマ色の明度変換 (カード裏面の地色・枠色を accent から作る)
function shadeHex(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${Math.round(((n >> 16) & 255) * f)},${Math.round(((n >> 8) & 255) * f)},${Math.round((n & 255) * f)})`;
}
// 偉大なる死体の職業: レア30% / エピック50% / レジェンド20% (souls.js の共通定義を使う)
function rollGreatCorpseClass() { return rollGreatJobClass(); }

// ランクのパッシブの Lv (1-4 = ランク2-5) から、その段の値を引く (combat.js の _rk と同じ)
function rankVal(m, key, table) { const lv = pLv(m, key); return lv ? (table[Math.min(table.length, lv) - 1] || 0) : 0; }
// 隊で一番高い段の値 (重複不可)
function rankParty(key, table) { let v = 0; for (const p of G.party || []) if (p.alive) v = Math.max(v, rankVal(p, key, table)); return v; }
// 生存隊が持つ職業ランクパッシブの最高Lv (隊の全員効果の判定用。重複しない)
function partyPassiveLv(key) {
  let lv = 0;
  for (const p of G.party || []) if (p.alive) lv = Math.max(lv, pLv(p, key));
  return lv;
}

// 隊のパッシブ 踏破の地図 (cartography): 階の開始時に周囲 2/3/4 マス (マンハッタン距離) の
// カードを自動で表にする。踏破済みにはしないので、踏めば通常どおりイベントは起きる。
function revealByCartography() {
  const lv = partyPassiveLv("cartography");
  if (!lv || !G.board) return false;
  const rad = Math.min(3, lv) + 1;
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
function baseEnemyScale(special = false) {
  return strengthHere() * sfNum("enemyMul", 1) * (special ? 1 : mutNum("enemyMul", 1));
}
// その階の敵の強さ (手直し・特別な階・異変を除く) = 強さの素 power × 推奨Lv の伸び (world.js strengthAt)。奈落も同じ (abyssCfg)
function strengthHere() { return strengthAt(activeCfg(), G.floor || 1); }
// いまの階の推奨Lv (= 敵のLv。小数。world.js dungeonLevelRaw。奈落は abyssCfg の lv)
function levelHere() { return { lv: G.rematch ? G.rematch.lv : dungeonLevelRaw(activeCfg(), G.floor || 1) }; } // 宿敵の再戦は挑む Lv
// 「普通の1戦」の素の ✦Soul / 金貨 (出現表の平均 × その階の強さ × その階の群れの数の見込み。異変・手直しは含めない)。
// startBattle はこれと推奨Lv の基準 (levelcurve.js refSoul / refGold) の比で、どの敵の戦果も写す → どの階でも普通の1戦の平均が基準の値になる
function rawBattleUnit() {
  const cfg = activeCfg();
  const p = Math.min(0.62, 0.18 + (G.floor || 1) * 0.08);
  let cnt = 0;
  for (let i = 0; i < 6; i++) cnt += Math.pow(p, i); // spawnCardEnemies の群れの数の見込み (typicalBattleSpoils と同じ)
  const keys = sfMonsterPool().filter((k) => MONSTERS[k]);
  let g = 0, so = 0;
  for (const k of keys) { const m = MONSTERS[k], c = m.pack ? Math.max(3, cnt) : cnt; g += (m.gold || 0) * c; so += (m.soul || 0) * c; }
  const n = Math.max(1, keys.length);
  const sc = strengthHere();
  return { soul: Math.max(1, (so / n) * sc), gold: Math.max(1, (g / n) * sc) };
}
// 戦果の写しの比 [✦Soul, 金貨]: 普通の1戦がちょうど推奨Lv の基準 (refSoul / refGold) になるよう、どの敵の戦果にも掛ける
function battleRewardK() {
  const u = rawBattleUnit(), lv = levelHere().lv;
  return [refSoul(lv) / u.soul, refGold(lv) / u.gold];
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

// マスターミミック (ミミックの上位種) が出始める層。第1〜3層の宝箱は通常のミミックにしか化けない
const MASTER_MIMIC_LAYER = 4;
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
function soloScale() { return baseEnemyScale(true) * soloTune(); }
// 単体の強敵の印。これらは層相応のランク/固有の強さで組まれていて、雑魚の顔ぶれに合わせた倍率を
// 重ねると強くなりすぎるので soloScale で出す。startBattle はこの印 (_tuneK = 掛けた手直し) で戦果から打ち消す
function soloFoes(list) {
  const k = soloTune();
  for (const e of list) e._tuneK = k;
  return list;
}
// ===== 迷宮の掟「一騎打ち」(決闘の小円形場) =====
// 魔物の札の戦闘は1体だけ。その1体は強敵並み (最大HP ×DUEL_HP・攻撃 ×DUEL_ATK) で、戦果はその階の群れの数の見込みぶん持つ
// (rawBattleUnit と同じ見込み。startBattle の戦果の写しの前に掛けるので、1戦の戦果は普通の1戦と同じ)
const DUEL_HP = 2.6, DUEL_ATK = 1.25;
function duelFoes(key) {
  const e = spawnCardEnemies(key, G.floor, enemyScale(), {})[0];
  e.name = e.mon ? e.mon.name : e.name.replace(/[A-F]$/, "");
  e.maxhp = Math.round(e.maxhp * DUEL_HP); e.hp = e.maxhp;
  e.atk = Math.round(e.atk * DUEL_ATK);
  const p = Math.min(0.62, 0.18 + (G.floor || 1) * 0.08);
  let cnt = 0;
  for (let i = 0; i < 6; i++) cnt += Math.pow(p, i);
  if (e.mon && e.mon.pack) cnt = Math.max(3, cnt);
  e.soul = Math.round((e.soul || 0) * cnt); e.gold = Math.round((e.gold || 0) * cnt);
  e._duel = true;
  return [e];
}
// ===== 闘技場跡の迷宮の掟 (audience) — 観客の注文 (第九章) =====
// 戦闘の開幕にひとつ選び、応えて勝てばその戦闘の ✦Soul・金貨を AUDIENCE_MUL 倍にする (endBattle)。
// 判定は Battle.show (隊が使った技・会心・倒れた数) と、終わりのターン数・隊の HP。金属の魔物だけの戦いには出さない
const AUDIENCE_MUL = 1.5;
const AUDIENCE_ORDERS = {
  swift:  { label: "3ターン以内に勝て",        ok: (b) => b._roundNo <= 3 },
  nofall: { label: "誰も倒れずに勝て",          ok: (b) => !(b.show && b.show.dd) },
  blade:  { label: "技を使わずに勝て",          ok: (b) => !(b.show && b.show.sp), noBoss: true },
  crit:   { label: "会心の一撃を2度見せろ",     ok: (b) => !!(b.show && b.show.cr >= 2) },
  hale:   { label: "隊のHPを半分以上残して勝て", ok: (b) => { const ps = b.party.filter((p) => p.maxhp); return ps.reduce((a, p) => a + Math.max(0, p.alive ? p.hp : 0), 0) >= ps.reduce((a, p) => a + p.maxhp, 0) * 0.5; } },
};
function audienceOrderFor(enemies) {
  const tr = dungeonTrait();
  if (!tr || !tr.audience || !enemies.length || enemies.every((e) => e.metal)) return null;
  const boss = enemies.some((e) => e.boss);
  const keys = Object.keys(AUDIENCE_ORDERS).filter((k) => !(boss && AUDIENCE_ORDERS[k].noBoss));
  return keys[rand(keys.length)];
}
// 勝った時: 注文に応えたか (応えていれば ✦Soul・金貨の倍率、応えていなければ 1)。記録にも残す
function audienceJudge(b) {
  const k = b && b.audience, o = k && AUDIENCE_ORDERS[k];
  if (!o) return 1;
  if (o.ok(b)) { log(`観客が沸いた！ 注文「${o.label}」に応えた ― ✦Soul・金貨 ${AUDIENCE_MUL}倍。`, "win"); G.stats.audience = (G.stats.audience || 0) + 1; return AUDIENCE_MUL; }
  log(`注文「${o.label}」には応えられなかった。観客席から、ため息が漏れた。`, "sys");
  return 1;
}

// ===== 金属の魔物 (メタル系) =====
// 第3層から、階ごとに METAL_FLOOR_RATE の確率で盤面の魔物の札1枚が金属の魔物に入れ替わる (強敵の札は除く)。
// 段 (METAL_TIERS) の重みは層が深いほど上位種へ寄る (w = [第3〜5層, 第6〜8層, 第9層〜])。
// 上位種 (金業・銀業の王) は段の layer = 第4層から — 第3層は銀業だけ
const METAL_FLOOR_RATE = 0.07;
function metalKeys() { return Object.keys(MONSTERS).filter((k) => MONSTERS[k] && MONSTERS[k].metal); }
// 金属の魔物がその層に出るか (段ごとの最初の層 METAL_TIERS[段].layer から)
function metalInLayer(k, layer) {
  const T = MONSTERS[k] && MONSTERS[k].metal ? METAL_TIERS[MONSTERS[k].metal] : null;
  return !!T && (layer || 0) >= T.layer;
}
function pickMetalKey(layer) {
  const band = layer >= 9 ? 2 : layer >= 6 ? 1 : 0;
  const pool = metalKeys().map((k) => ({ k, T: METAL_TIERS[MONSTERS[k].metal] })).filter((o) => o.T && layer >= o.T.layer);
  const tot = pool.reduce((s, o) => s + o.T.w[band], 0);
  let r = random() * tot;
  for (const o of pool) { r -= o.T.w[band]; if (r < 0) return o.k; }
  return pool.length ? pool[0].k : null;
}
// 迷宮の掟 (銀の里) は出やすさ trait.metalRate と、1階に入れ替わる札の最大数 trait.metalMax を持つ
function placeMetal() {
  const tr = dungeonTrait();
  const quest = questState().fixed.fq_zakka;
  // 「銀の小人」を受けてから最初の1体を倒すまでは、金属の魔物が10倍出やすい。
  const boost = quest && quest.state === "active" && !(quest.progress > 0) ? 10 : 1;
  const rate = Math.min(1, ((tr && tr.metalRate) || METAL_FLOOR_RATE) * boost);
  if (battleLayer() < 3 || random() >= rate) return;
  const cells = [];
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const c = G.board.cells[y][x];
    if (c.type === "monster" && !c.cleared && !c.elite) cells.push(c);
  }
  const max = (tr && tr.metalMax) || 1;
  for (let i = 0; i < max && cells.length; i++) {
    if (i > 0 && random() >= 0.5) break; // 2枚目からは半々
    const key = pickMetalKey(battleLayer());
    if (!key) return;
    const c = cells.splice(rand(cells.length), 1)[0];
    c.monsterKey = key;
    c.metal = true;
  }
}
// この階で普通の戦闘1回に得る✦Soul・金貨の目安 (出現表の雑魚の平均 × 群れの期待数 × 強さ倍率。手直し前)
function typicalBattleSpoils(special = false) {
  const p = Math.min(0.62, 0.18 + (G.floor || 1) * 0.08);
  let n = 0;
  for (let i = 0; i < 6; i++) n += Math.pow(p, i); // spawnCardEnemies の群れの数の期待値
  const pool = sfMonsterPool().filter((k) => MONSTERS[k]);
  let soul = 0, gold = 0;
  for (const k of pool) { const m = MONSTERS[k], c = m.pack ? Math.max(3, n) : n; soul += (m.soul || 0) * c; gold += (m.gold || 0) * c; }
  const sc = baseEnemyScale(special), len = Math.max(1, pool.length);
  return { soul: soul / len * sc, gold: gold / len * sc };
}
// 金属の魔物の組み立ての基準 (combat.js spawnMetal): 体はその階の雑魚の最上位ランク、AGI は味方の規模 (基準AGI)、
// 戦果は1体ごとに「普通の戦闘1回分」× 段の倍率。群れは段の最大数まで (1体目の後は 35% ずつ)
function metalRef(key) {
  const T = METAL_TIERS[MONSTERS[key].metal];
  const sp = typicalBattleSpoils(true);
  let count = 1;
  while (count < T.max && random() < 0.35) count++;
  return {
    rank: mimicRef().rank, scale: baseEnemyScale(true), count,
    agi: partyAgi(levelHere().lv) * T.agiMul, // 基準の隊の AGI (推奨Lv で引く。levelcurve.js)
    soul: sp.soul * T.soulMul, gold: sp.gold * T.goldMul,
  };
}

// この迷宮に出る強敵のid。台帳の迷宮は cfg.elites、作り込み済みの層は層ごとの強敵 (LAYER_ELITES) を階ごとに順に出す。
// それ以外 (強敵の決まっていない層) は旧来の、層のランク帯の強敵を階ごとに順に出す
function eliteKey() {
  if (abyssActive()) return infFoeKey(3); // 無限迷宮: その階の雑魚から選んで強敵に仕立てる (infEliteFoes)
  const cfg = activeCfg();
  const L = cfg.layer || 1;
  const le = (cfg.elites && cfg.elites.length) ? cfg.elites : LAYER_ELITES[L];
  if (le && le.length) {
    const hunt = le.find((id) => namedHunted(id)); // 懸賞を受けている名のある強敵は、縄張りの強敵階に必ず出る
    return hunt || le[(G.floor || 0) % le.length];
  }
  const r = Math.min(10, Math.ceil(L / 2));
  return ELITE_ORDER[(r - 1) * 3 + ((G.floor || 0) % 3)];
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
  add("cur-gold", G.gold, "金貨");
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
    const openBook = () => {
      // 戦闘中も開ける (閉じるまで戦闘は止まる。帰還・隊の編成はできない)
      if (!inDungeon() || uiBlocked()) return;
      if (holdForAutoMove(openBook)) return; // オート移動中: いまの1歩を終えてから開く
      if (G.state === "board" ? (G.anim || G.walking) : (G.state !== "combat" || !G.battle)) return;
      SFX.select();
      UI.openDungeonMenu();
    };
    b.addEventListener("click", openBook);
    left.insertBefore(b, left.firstChild);
  }
  if (floorInfo && !floorInfo.dataset.tap) {
    floorInfo.dataset.tap = "1";
    floorInfo.setAttribute("role", "button");
    floorInfo.addEventListener("click", function tap() {
      if (holdForAutoMove(tap)) return;
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
  floorInfo.title = `${dn ? dn.name : ""} B${G.floor}F${floors ? ` (全${floors}階)` : ""}`;
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
  else row.appendChild(el("span", "fi-of", abyssActive() && isRestFloor(G.floor) ? "風だまり" : "無限"));
  if (G.eliteFloor) row.appendChild(el("span", "fi-tag fi-elite", "強敵"));
  else if (sp) { const t = el("span", "fi-tag", sp.name); t.style.color = sp.accent; t.style.borderColor = sp.accent; row.appendChild(t); }
  if (mu) { const t = el("span", "fi-tag fi-mut", "異変"); t.title = `異変「${mu.name}」`; row.appendChild(t); }
  if (abyssActive() && infRule()) { const r = infRule(); const t = el("span", "fi-tag fi-mut", "掟"); t.title = `風の掟「${r.name}」`; row.appendChild(t); }
  if (G.eliteFloor || sp || mu || infRule()) row.appendChild(el("span", "fi-more", "›"));
  floorInfo.appendChild(row);
  setTopbarCurrency();
  updateDescendBtn();
  updateReturnBtn();
}

// 保存済み盤面にも序章の出現制限を適用する。壁や発見済みの状態は残す。
function enforceDungeonRestrictions() {
  const cfg = activeCfg();
  if (!G.board || abyssActive()) return;
  if (cfg.noSpecial) { G.specialFloor = null; G.mutator = null; G.activeRumor = null; }
  for (const row of G.board.cells) for (const cell of row) {
    if ((cfg.noCorpses && cell.type === "corpse") || (cfg.noEvents && cell.type === "event") ||
      (cfg.noTraps && cell.type === "trap") || (cfg.noChests && cell.type === "chest")) {
      const { walls, revealed } = cell;
      for (const key of Object.keys(cell)) delete cell[key];
      Object.assign(cell, { walls, revealed, type: "empty", cleared: false });
    }
  }
}

function newFloor() {
  applyInfMightyFloor();
  // ダンジョンが自前で持つ出現プール (pool=浅階 / deepPool=深階) を使う
  const cfg = activeCfg();
  G.board = makeBoard(G.floor, cfg);
  G.px = G.board.start.x;
  G.py = G.board.start.y;
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
    namedSighted(ek);
  }
  if (!cfg.tutorial) placeMetal(); // 金属の魔物: 第3層から稀に魔物の札1枚と入れ替わる
  // 迷宮の掟「巨獣の宝」(trait.oneChest): 宝箱は1階に1つだけ (多ければ空き床に戻し、無ければ1つ置く)。特別な階の宝箱はこの後に足される
  { const tr1 = dungeonTrait();
    if (tr1 && tr1.oneChest) {
      const chests = [];
      sfEachCell(G.board, (c) => { if (c.type === "chest" && !c.cleared) chests.push(c); });
      if (!chests.length) sfPlace(G.board, 1, (c) => { c.type = "chest"; c.cleared = false; });
      else for (const c of chests.splice(1)) { c.type = "empty"; c.cleared = false; }
    } }
  // 特別階: 盤面への効果 (宝箱の追加・罠の消滅など) を適用
  const spf = specialDef();
  if (spf && spf.board) spf.board(G.board);
  // 迷宮の掟: 盤面の加工 (獄の骸・霧の胞子と泉・縦穴の根の穴)。静寂の階 (罠・足元の仕掛けなし) では胞子も穴も撒かない
  const trf = dungeonTrait();
  if (trf && trf.board && TRAIT_BOARD[trf.board] && !(spf && spf.noTrap && (trf.board === "mist" || trf.board === "shaft" || trf.board === "vent" || trf.board === "ledge" || trf.board === "bog"))) TRAIT_BOARD[trf.board](G.board);
  if (G.floor > G.stats.deepest) G.stats.deepest = G.floor;
  // 酒場の噂を盤面に反映 (出撃直後の階のみ)
  if (!cfg.noSpecial && G.activeRumor && G.activeRumor.floor === G.floor) applyRumorToBoard(G.board);
  storyNewFloor(); // 物語マス: 師の手がかり (決まった迷宮の決まった階に、見つけるまで毎回置く)
  enforceDungeonRestrictions();
  evNewFloor(); // 迷宮のイベント: 必須の手がかりの場所を確保してから配置する
  G.portalFound = false; // この階の帰還魔法陣はまだ発見していない
  revealByCartography();
  passiveSensePlan(); // 敵感知・財宝感知の札は階の始めに決める (描画の時に乱数を引かない — src/rng.js)
  if (G.run) G.run.floors = Math.max(G.run.floors || 1, G.floor);
  updateTopbar();
  log(`B${G.floor}F。伏せられた石札をめくり、下り階段を探せ。`, "sys");
  if (tlOn()) tlSnapshot("floor", tlWhere(), G.party);
}

// 同期処理の実HP/MP収支だけを観測する。町での補給は迷宮の回復に混ぜない。
function tlGameMeasure(source, fn) {
  return tlMeasure(tlOn() && inDungeon() ? tlWhere() : null, G.party, source, fn);
}

// 逃走判定の追跡の物差し (Battle.fleeK): 敵の AGI は味方よりずっと小さい規模なので、
// 「この迷宮・階の基準AGI (baseline.js) ÷ この迷宮の雑魚の標準AGI (出現表の素のAGIの中央値)」を掛けて揃える。
// 俊敏な敵・主・ミミック・鈍足/激昂は、標準からのずれとしてそのまま逃げにくさ/逃げやすさに効く
function fleeScale() {
  // 基準の隊の AGI (推奨Lv で引く) ÷ その迷宮の雑魚の素の AGI の中央値 (enemylevel.js — 図鑑の素早さも同じ式)
  return fleeScaleOf(activeCfg(), levelHere().lv);
}

// この迷宮・階の敵のLv (台帳の迷宮は world.js dungeonLevel。奈落は素体の難度 n の1階相当)
function foeLevelHere() {
  return Math.max(1, Math.round(levelHere().lv));
}
// テスト記録 (telemetry.js): いまの迷宮の欄 (台帳の迷宮は id、奈落は深度ごと)。lv は推奨Lv (基準AGI の算出に使う)
function tlWhere() {
  const cfg = activeCfg();
  const lv = levelHere().lv;
  if (abyssActive()) {
    const d = G.abyss.depth, sec = Math.ceil(d / INF_REST_EVERY);
    return { key: `I${sec}`, name: `${INF_NAME} B${(sec - 1) * INF_REST_EVERY + 1}〜${sec * INF_REST_EVERY}F`, lv, floor: G.floor, floors: 1 };
  }
  return { key: cfg.id || "?", name: cfg.name || "", lv, floor: G.floor, floors: cfg.floors || 1 };
}

// ---- ボード描画 ----
// 盤面と戦闘のキャンバスは論理座標 VW×VH で描く。VH は画面の縦の余りに合わせて伸縮し
// (縦長の端末ほどカードが縦長の墓石になる)、実画素は端末の画素密度ぶん (VSX/VSY 倍) 持つ。
// 床・墓石の原画を補間し、壁は2倍の解像度で合成する。光と粒子は表示先へ直接重ねる。
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
// 小さい画面では盤面の一部を拡大する。カメラは保存状態や探索の結果に触れない。
const boardCamera = { zoom: 1, x: 0, y: 0, overview: false, manual: false, board: null, px: -1, py: -1 };
function updateBoardCamera() {
  const c = boardCamera, width = view.clientWidth || VW;
  c.zoom = window.innerWidth <= 600 && !c.overview ? Math.max(1, 64 * VW / (width * Math.min(CARD_W, CARD_H))) : 1;
  if (c.board !== G.board || c.px !== G.px || c.py !== G.py) {
    c.manual = false; c.board = G.board; c.px = G.px; c.py = G.py;
  }
  if (!c.manual) {
    const [x, y] = heroPos();
    c.x = x - VW / c.zoom / 2; c.y = y - VH / c.zoom / 2;
  }
  clampBoardCamera();
}
function clampBoardCamera() {
  const c = boardCamera;
  c.x = Math.max(0, Math.min(VW - VW / c.zoom, c.x));
  c.y = Math.max(0, Math.min(VH - VH / c.zoom, c.y));
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
// 戦闘の記録欄は最低でも4行ほど読めるように (46 = 1〜2行では、何が起きたか読めなかった — 2026-10 ユーザーの指示)
const LOG_MIN_BOARD = 84, LOG_MIN_COMBAT = 94, MENU_RESERVE = 166;
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
  appEl.classList.toggle("board-camera-active", G.state === "board");
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
  else used += outerH(runbarEl) + outerH(ctrlEl) + outerH(document.getElementById("board-camera-tools")) + LOG_MIN_BOARD;
  // 縦の短い画面では戦場も縮め、記録と命令板の領域を確保する。
  const minVH = combat ? (G.battle?.enemies.length > 3 ? 280 : 180) : 240;
  const h = Math.max(cssW * (combat ? minVH / VW : 0.56), Math.min(cssW * (combat ? 0.98 : 1.32), appH - used));
  const vh = Math.max(minVH, Math.round((VW * h) / cssW));
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
if (typeof ResizeObserver !== "undefined" && appEl) {
  const observer = new ResizeObserver(() => requestAnimationFrame(refitAndRedraw));
  for (const id of ["app", "topbar", "party", "hint", "runbar"]) {
    const e = document.getElementById(id);
    if (e) observer.observe(e);
  }
}

// ダンジョンで歩く自分の駒: 頭巾つきの外套の人影 (色は設定「操霊師の装い」) (src/walkerart.js・前後左右の4方向)。最後に歩いた向きを向く (既定は正面)。
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
    if (abyssBossPending()) return { k: "boss", t: findRevealedStairs() ? "風だまりを見つけた ― 主が待つ" : "風だまり (主の待つ階段) を探せ" };
    if (isRestFloor(G.floor)) return { k: "goal", t: "主を討った ― 帰るか、さらに潜るか" };
    return { k: "down", t: findRevealedStairs() ? "階段を見つけた ― さらに深くへ" : "下り階段を探せ" };
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
    runbarEl.addEventListener("click", function tap() {
      if (holdForAutoMove(tap)) return;
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
  loot.title = "今回の出撃で得たもの";
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
        ? { key: "guard", label: "風だまりへ", sub: "回収人・灯番・主", kind: "danger", icon: "boss" }
        : isRestFloor(G.floor)
          ? { key: "rest", label: "風だまり", sub: "帰る・続ける", kind: "primary", icon: "star" }
          : { key: "down", label: `B${G.floor + 1}Fへ降りる`, sub: isRestFloor(G.floor + 1) ? "次は風だまりの階" : "さらに深くへ", kind: "primary", icon: "down" };
    } else {
      const dn = curDungeon();
      const atBottom = G.floor >= (dn.floors || 1);
      if (atBottom && G.bossDown) down = null; // 踏破済み: 最深部の階段は役目を終えた (下の「帰還」で凱旋)
      else if (atBottom && dn.boss) down = { key: "boss", label: "主の間へ", sub: "迷宮の主が待つ", kind: "danger", icon: "boss" };
      else if (atBottom) down = { key: "clear", label: "踏破する", sub: "最深部の階段", kind: "primary", icon: "star" };
      else {
        const next = G.floor + 1, last = dn.floors || 1;
        down = { key: "down", label: `B${next}Fへ降りる`, sub: next >= last ? (dn.boss ? "次は主の待つ最深部" : "次は最深部") : "", kind: "primary", icon: "down" };
      }
    }
  }
  const home = abyssActive()
    ? (G.bossDown ? { label: "帰る", sub: "主を討った", icon: "home" } : null)
    : (G.portalFound || G.bossDown) ? { label: "帰還", sub: G.bossDown && !G.portalFound ? "主を討った" : "帰還陣から", icon: "home" } : null;
  // 全員を回復 (隊の画面と同じ healAll)。手当ての要る者がいて、唱えられる時だけ光る
  const dead = G.party.filter((t) => !t.alive).length;
  const hurt = G.party.some((t) => t.alive && (t.hp < t.maxhp || t.ailment));
  const heal = { label: "全員を回復", sub: dead ? `倒れた者 ${dead}` : hurt ? "傷ついた者がいる" : "皆 無事", hot: healAllNeed() && (healAllCasters().length > 0 || healAllRevivers().length > 0) };
  // 迷宮で唱える技 (浮遊・気配読み・宝探し・道しるべ)。覚えた者が隊にいる時だけ、技ごとにボタンを出す
  const fields = knownFieldSkills().map((k) => {
    const sp = SPELLS[k], c = fieldCaster(k, true), on = fieldActive(sp);
    // tag = 札に詰めた時の短い名。浮遊は残りの階数を添える (「浮遊 残1」、ユーザーの指示)
    return { key: k, kind: sp.float ? "float" : sp.sense, label: sp.name, sub: on ? fieldStateText(sp) : `MP${c.cost}`, on, tag: on && sp.float ? `${sp.name} 残${floatLeft()}` : null };
  });
  const av = autoMoveAvoid();
  const auto = { on: !!G.autoMove, sub: av.foe && av.elite ? "敵を避ける" : av.elite ? "強敵を避ける" : av.foe ? "強敵に挑む" : "敵に挑む" };
  return { down, home, heal, fields, auto, idle: G.floor <= 1 && !(G.run && G.run.kills) ? "スワイプで進む ・ 光るカードをめくる" : "階段を見つけると、ここから降りられる" };
}
function dockDescend() {
  if (holdForAutoMove(dockDescend)) return;
  if (G.state !== "board" || G.anim || G.walking || uiBlocked()) return;
  const cell = findRevealedStairs();
  if (!cell) return;
  SFX.select();
  // 途中の階はそのまま降りる (確認なし)。主の間・踏破・無限迷宮の風だまりは決断のシートを挟む
  const dn = curDungeon();
  if (cell.gate && !abyssActive()) { askGate(cell); return; } // 帰還魔法陣の階: 帰るか進むかを選ぶ
  const plain = abyssActive() ? !isRestFloor(G.floor) : G.floor < (dn.floors || 1);
  if (plain) descend(); else askDescend(cell);
}
// ===== 迷宮で唱える技 (kind "field") =====
// float = 浮遊 (G.run.float: 浮いている残りの階数。この階を含む。落ちる床に落ちず、蝕む床のダメージも受けない)
// 浮遊で避けられるもの (迷宮の中ならその土地の名で「根の穴に落ちず、胞子の床も踏まない」)
function floatGuardText() {
  if (!inDungeon()) return "足元の穴に落ちず、害のある床も踏まない";
  const cfg = activeCfg();
  const f = hazPlaced(cfg, "fall"), h = cfg.poisonRate > 0 ? harmHaz() : null;
  if (f && h) return `${f.name}に落ちず、${h.name}も踏まない`;
  if (f) return `${f.name}に落ちない`;
  if (h) return `${h.name}を踏まない`;
  return "足元の穴に落ちず、害のある床も踏まない";
}
// sense = 探りの術 (G.board.fsense[enemy|chest|stairs]: この階だけ、まだめくっていない墓石の魔物 / 宝箱 / 階段の位置を示す。
//         stairs = 道しるべ はさらに階段の周囲8マスの墓石をめくる。階段そのものは伏せたまま ― めくれば、どこからでも降りられてしまうため)
function floatLeft() { return (inDungeon() && G.run && G.run.float) || 0; }
function fieldSense(kind) { return !!(inDungeon() && G.board && G.board.fsense && G.board.fsense[kind]); }
function fieldActive(sp) { return sp.float ? floatLeft() > 0 : sp.sense ? fieldSense(sp.sense) : false; }
function fieldStateText(sp) { return sp.float ? `残り${floatLeft()}階` : "この階"; }
function fieldCasters() { return G.party.filter((p) => p.alive && p.ailment !== "stone"); }
// 隊の誰かが覚えている迷宮の技 (技の定義順)
function knownFieldSkills() {
  const have = new Set();
  for (const p of fieldCasters()) for (const k of p.spells || []) if (SPELLS[k] && SPELLS[k].kind === "field" && skillUsable(k)) have.add(k);
  return Object.keys(SPELLS).filter((k) => have.has(k));
}
// 技 key を唱えられる者: 生きていて MP が足りる者のうち、MP の最も多い者 (any = MP を問わず覚えている者)
function fieldCaster(key, any = false) {
  const sp = SPELLS[key];
  if (!sp) return null;
  let best = null;
  for (const p of fieldCasters()) {
    if (!(p.spells || []).includes(key)) continue;
    const cost = spellCost(p, sp);
    if (!any && p.mp < cost) continue;
    if (!best || (p.mp >= cost) > (best.p.mp >= best.cost) || p.mp > best.p.mp) best = { p, sp, cost };
  }
  return best;
}
// まだめくっていない、片付いていない墓石のうち探りの術が示すもの
function senseTargets(kind) {
  const want = { enemy: "monster", chest: "chest", stairs: "stairs" }[kind];
  const out = [];
  for (const row of G.board.cells) for (const c of row) if (c.type === want && !c.revealed && !c.cleared) out.push(c);
  return out;
}
function dockField(key) {
  if (holdForAutoMove(() => dockField(key))) return;
  if (G.state !== "board" || G.anim || G.walking || uiBlocked()) return;
  castField(key);
}
// 道しるべ: 下り階段の周囲8マスの墓石をめくる (階段は伏せたまま。踏破済みにはしないので、踏めば通常どおり出来事は起きる)
function revealAroundStairs() {
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    if (G.board.cells[y][x].type !== "stairs") continue;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if ((!dx && !dy) || nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      G.board.cells[ny][nx].revealed = true;
    }
  }
}
function castField(...args) { return tlGameMeasure("camp", () => castFieldMeasured(...args)); }
// 押し間違えやすい探りの術 (道しるべ・宝探し) は唱える前に確かめる (MP 30% を使うため。ユーザーの指示 2026-10)
const FIELD_CONFIRM = new Set(["stairs", "chest"]);
function castFieldMeasured(key, confirmed = false, caster = null) {
  if (G.state !== "board" || !inDungeon()) return;
  const sp = SPELLS[key];
  if (!sp) return;
  if (!skillUsable(key)) { SFX.ng(); showToast("呪文を封じる霧が言葉を吸いこむ ― ここでは唱えられない", { tone: "bad" }); return; }
  if (fieldActive(sp)) {
    SFX.select();
    showToast(sp.float ? `浮遊中 ― 残り${floatLeft()}階 (${floatGuardText()})` : `${sp.name}の効果はこの階のあいだ続いている`, { tone: "info" });
    return;
  }
  if (sp.sense === "stairs" && findRevealedStairs()) { SFX.ng(); showToast("この階の階段はもう見つけている", { tone: "info" }); return; }
  // 選んだ者を確認画面の先まで保ち、実行時にも在隊・状態・MPを確かめる。
  const candidates = fieldCasters().filter((p) => (p.spells || []).includes(key))
    .map((p) => ({ p, sp, cost: spellCost(p, sp) })).filter((c) => c.p.mp >= c.cost);
  if (!caster && candidates.length > 1) {
    SFX.select();
    const opts = candidates.map((c) => ({
      label: `${c.p.name} ― 消費 MP${c.cost} (いま ${c.p.mp})`,
      fn: () => castField(key, false, c.p),
    }));
    opts.push({ label: "やめる", cancel: true, fn: () => {} });
    showChoice(`${sp.name} ― 誰が唱える？`, opts, null, { banner: "迷宮の技" });
    return;
  }
  const c = caster ? candidates.find((c) => c.p === caster) : candidates[0];
  if (caster && !c) { SFX.ng(); showToast(`${caster.name}はいま${sp.name}を唱えられない`, { tone: "info" }); return; }
  if (!c) { SFX.ng(); showToast(fieldCaster(key, true) ? `${sp.name}を唱える MP が足りない` : `${sp.name}を唱えられる者がいない`, { tone: "info" }); return; }
  if (!confirmed && FIELD_CONFIRM.has(sp.sense)) {
    SFX.select();
    showConfirm({
      title: `${sp.name}を唱える？`,
      lines: [
        sp.sense === "stairs" ? "この階の下り階段の在りかを示し、そのまわり8マスのカードをめくる。" : "この階の宝箱の在りかが、伏せたカードの青い光として浮かび上がる。",
        `${c.p.name}の MP を ${c.cost} 使う (いま ${c.p.mp})。効くのはこの階だけ。`,
      ],
      okLabel: "唱える",
      onOk: () => castField(key, true, c.p),
    });
    return;
  }
  c.p.mp -= c.cost;
  SFX.spell();
  if (sp.float) {
    G.run.float = sp.float;
    log(`${c.p.name}は${sp.name}を唱えた。隊の足が地を離れる ― ${sp.float}階のあいだ${floatGuardText()}。`, "win");
    showToast(`${sp.name} ― ${sp.float}階のあいだ宙に浮く`, { noLog: true, tone: "good" });
  } else if (sp.sense) {
    G.board.fsense = Object.assign({}, G.board.fsense, { [sp.sense]: true });
    if (sp.sense === "stairs") revealAroundStairs();
    const n = senseTargets(sp.sense).length;
    const what = { enemy: "魔物の気配", chest: "宝箱", stairs: "階段" }[sp.sense];
    const msg = sp.sense === "stairs" ? "下へ続く階段の在りかが淡く光り、そのまわりのカードがひとりでにめくれた。"
      : !n ? `この階には、まだ見ぬ${what}はないようだ。`
      : sp.sense === "enemy" ? `伏せたカードに、${n}つの赤い気配がぼんやりと浮かび上がった。` : `伏せたカードに、${n}つの青い光がぼんやりと灯った。`;
    log(`${c.p.name}は${sp.name}を唱えた。${msg}`, "win");
    showToast(`${sp.name} ― ${sp.sense === "stairs" ? "階段の在りかとそのまわりが開けた" : n ? `${what} ${n}` : `${what}なし`}`, { noLog: true, tone: "good" });
  }
  renderParty();
  renderBoard();
  autosave(true);
}
function dockHealAll() {
  if (holdForAutoMove(dockHealAll)) return;
  if (G.state !== "board" || G.anim || G.walking || uiBlocked()) return;
  healAll();
  renderDock();
}
function dockReturn() {
  if (holdForAutoMove(dockReturn)) return;
  if (G.state !== "board" || G.anim || G.walking || uiBlocked()) return;
  SFX.select();
  confirmReturnToTown();
}
function renderDock() {
  if (!hintEl) return;
  const spec = inDungeon() ? dockSpec() : null;
  hintEl.classList.toggle("hidden", G.state === "combat" || (G.state === "over" && !!G.battle));
  uiDungeonHud.renderDock(hintEl, spec, { descend: dockDescend, goHome: dockReturn, healAll: dockHealAll, field: dockField, auto: toggleAutoMove });
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
// scene: 踏破状況を反映した合成 (めくるたびに作り直し、静止中は再利用する)
const BV = { art: null, artKey: "", artCache: new Map(), scene: null, sctx: null, sceneKey: "", sceneHi: null, sceneHiKey: "",
  dark: null, dctx: null, darkBase: null, darkKey: "", parts: [], flipSeen: null };
function ensureBoardArt() {
  const b = G.board;
  const L = battleLayer();
  const sp = specialDef();
  const crypt = L === 1 && activeCfg().id !== "w00_forest";
  const painting = cryptPainting(activeCfg().id);
  prewarmCryptActors();
  const seed = boardSeed(b, dungeonSeed(activeCfg()) * 7919 + G.floor);
  const hz = harmHaz();
  const key = `${activeCfg().id}|${VW}x${VH}|${CARD_W}x${CARD_H}|${seed}|${L}|${G.eliteFloor ? "e" : ""}|${sp ? sp.id : ""}|${hz.name}|${painting ? "painted" : "raster"}`;
  if (BV.artKey === key && BV.art) return BV.art;
  let art = BV.artCache.get(key);
  if (!art) {
    const mat = crypt ? CATACOMB : genericMaterial(dungeonTheme());
    const opt = { seed, cols: COLS, rows: ROWS, rect: cellRect, cells: b.cells, mat, elite: !!G.eliteFloor, accent: crypt && sp ? hexRgb(sp.accent) : null, harmStain: hz.look.stain, harmFx: hz.look.fx };
    if (painting) art = { key, seed, mat, crypt, ...paintCryptMaterials(VW, VH, opt, painting) };
    else {
      const fl = paintCryptFloor(VW, VH, opt);
      const slabs = crypt ? paintCryptSlabs(VW, VH, opt) : paintOldCardBacks();
      art = { key, seed, floor: fl.canvas, candles: fl.candles, slabs, mat, crypt, scale: 1 };
    }
    BV.artCache.set(key, art);
    while (BV.artCache.size > 2) BV.artCache.delete(BV.artCache.keys().next().value);
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
  const cells = G.board.cells, sourceScale = art.scale, sceneScale = Math.max(2, sourceScale);
  let sig = BV.artKey + "|" + (G.flipAnim ? G.flipAnim.x + "," + G.flipAnim.y : "") + "|";
  for (const row of cells) for (const c of row) sig += c.revealed ? "1" : "0";
  if (sig === BV.sceneKey && BV.scene) return;
  BV.sceneKey = sig;
  if (!BV.scene || BV.scene.width !== VW * sceneScale || BV.scene.height !== VH * sceneScale) {
    BV.scene = document.createElement("canvas");
    BV.scene.width = VW * sceneScale; BV.scene.height = VH * sceneScale;
    BV.sctx = BV.scene.getContext("2d");
  }
  const g = BV.sctx;
  g.setTransform(sceneScale, 0, 0, sceneScale, 0, 0);
  g.globalCompositeOperation = "source-over"; g.globalAlpha = 1; g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = "high";
  // 1) 盤全体の床を闇に沈める (蓋の下と溝)
  g.drawImage(art.floor, 0, 0, VW, VH);
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
    g.drawImage(art.floor, x0 * sourceScale, y0 * sourceScale, (x1 - x0) * sourceScale, (y1 - y0) * sourceScale, x0, y0, x1 - x0, y1 - y0);
  }
  for (let j = 1; j < ROWS; j++) for (let i = 1; i < COLS; i++) {
    if (!rev(i - 1, j - 1) || !rev(i, j - 1) || !rev(i - 1, j) || !rev(i, j)) continue;
    const a = cells[j - 1][i - 1], d = cells[j][i];
    if (a.walls.e || a.walls.s || d.walls.n || d.walls.w) continue;
    const r = cellRect(i, j);
    g.drawImage(art.floor, (r.x - GAP) * sourceScale, (r.y - GAP) * sourceScale, GAP * sourceScale, GAP * sourceScale, r.x - GAP, r.y - GAP, GAP, GAP);
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
    g.drawImage(art.slabs, r.x * sourceScale, r.y * sourceScale, r.w * sourceScale, r.h * sourceScale, r.x, r.y, r.w, r.h);
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
  if (art.painting) paintCryptMasonry(g, walls, [...posts.values()], art.painting, art.seed, art.wallStyle);
  else paintCryptWalls(g, walls, [...posts.values()], art.mat, art.seed);
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
  g.imageSmoothingEnabled = !!BV.art.painting;
  g.imageSmoothingQuality = "high";
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
    if (isPortalCell(c)) out.push({ x: cx, y: cy, r: 46, a: 0.7, col: "90,220,235", ga: 0.18 + 0.1 * pulse, gr: 40 });
    else if (c.type === "story" && !c.cleared) out.push({ x: cx, y: cy, r: 40, a: 0.62, col: "120,235,200", ga: 0.16 + 0.1 * pulse, gr: 34 });
    else if (c.type === "fountain" && !c.cleared) out.push({ x: cx, y: cy, r: 36, a: 0.5, col: "100,170,255", ga: 0.12, gr: 30 });
    else if (c.type === "poison") out.push({ x: cx, y: cy + r.h * 0.05, r: 34, a: 0.4, col: harmHaz().look.glow, ga: 0.1 + 0.05 * pulse, gr: 30 });
    else if (c.type === "stairs") out.push({ x: cx, y: cy, r: 30, a: 0.4, col: "160,190,255", ga: 0.06, gr: 24 });
    else if (c.type === "corpse" && c.corpseWarm && !c.cleared) out.push({ x: cx + (x === G.px && y === G.py && !G.heroAnim ? r.w * 0.2 : 0), y: cy - 14, r: 26, a: 0.5, col: "127,208,255", ga: 0.16 + 0.06 * pulse, gr: 20 });
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
  updateBoardCamera();
  ensureBoardScene();
  vctx.setTransform(1, 0, 0, 1, 0, 0);
  vctx.globalCompositeOperation = "copy";
  vctx.globalAlpha = 1;
  // 拡大前の画面を引き伸ばさず、表示先の画素へ直接描く。
  // 床と墓石だけを補間し、枠・光・粒子は拡大後の座標で描く。
  const camera = boardCamera;
  viewTransform();
  vctx.scale(camera.zoom, camera.zoom);
  vctx.translate(-camera.x, -camera.y);
  vctx.imageSmoothingEnabled = camera.zoom > 1;
  vctx.imageSmoothingQuality = "high";
  if (camera.zoom > 1) vctx.drawImage(BV.scene, 0, 0, VW, VH);
  else vctx.drawImage(boardSceneHi(), 0, 0, VW, VH);
  vctx.globalCompositeOperation = "source-over";
  const [hx, hy] = heroPos();
  const lt = boardLight(hx - CARD_W * 0.18, hy, now);
  const srcs = boardLightSources(now);
  drawBoardDarkness(lt, srcs);
  drawBoardGlows(lt, srcs);
  drawBoardTerrainFx(now);
  drawCandleFlames(now);
  drawSenseGlows(now);
  drawBoardHighlights(now);
  drawBoardIcons(lt, now, hx, hy);
  drawFlipSlab(now);
  drawWallFlash(now);
  drawWalker(hx, hy, now);
  drawBoardParticles(lt, now);
  vctx.globalCompositeOperation = "source-over";
  vctx.globalAlpha = 1;
  viewTransform();
}

// 迷宮の台帳で置いている足元の仕掛け (出撃画面の「足元」)。{ fall, harm } = 定義 or null
function dungeonFloorHaz(cfg) { return { fall: hazPlaced(cfg, "fall"), harm: hazPlaced(cfg, "harm") }; }
// 足元の仕掛けの定義 (floorhaz.js)。マスの種類 (pit = 落ちる床 / poison = 蝕む床) と、いまの迷宮の土地で決まる
function cellHaz(c) { return hazSkin(activeCfg(), c && c.type === "pit" ? "fall" : "harm"); }
function fallHaz() { return hazSkin(activeCfg(), "fall"); }
function harmHaz() { return hazSkin(activeCfg(), "harm"); }

// 落ちる床: 土地ごとの穴 (丸い穴・地割れ・外れた格子・落とし戸)。縁の欠けと、底から昇る粒 (塵・火の粉・雪・泡・魂の光)
function drawPit(x, y, now) {
  const lk = fallHaz().look;
  const r = cellRect(x, y), cx = r.x + r.w / 2, cy = r.y + r.h * 0.56;
  const rx = r.w * 0.34, ry = r.h * 0.2;
  const t = REDUCED_MOTION ? 0 : now * 0.001;
  const seed = x * 31 + y * 7;
  vctx.save();
  const coreGrad = (x0, y0, x1, y1) => {
    const g = vctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, lk.core[2]); g.addColorStop(0.35, lk.core[1]); g.addColorStop(1, lk.core[0]);
    return g;
  };
  if (lk.shape === "crack") {
    // 地割れ: 斜めに走る細いぎざぎざの裂け目と、枝分かれする小さなひび
    const n = 10, top = [], bot = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n, px = cx - rx * 1.2 + rx * 2.4 * u;
      const mid = cy + (u - 0.5) * ry * 0.9 + (h01(i, seed) - 0.5) * ry * 0.5 + Math.sin(u * 5 + h01(1, seed) * 6) * ry * 0.15;
      const w = Math.sin(u * Math.PI) * ry * (0.22 + 0.22 * h01(i + 9, seed)) + 0.6;
      top.push([px, mid - w]); bot.push([px, mid + w]);
    }
    const poly = (pad) => { vctx.beginPath(); top.forEach(([px, py], i) => (i ? vctx.lineTo(px, py - pad) : vctx.moveTo(px - pad, py))); for (let i = bot.length - 1; i >= 0; i--) vctx.lineTo(bot[i][0] + (i === bot.length - 1 ? pad : 0), bot[i][1] + pad); vctx.closePath(); };
    vctx.fillStyle = lk.rim; poly(1.6); vctx.fill();
    vctx.fillStyle = coreGrad(cx, cy - ry, cx, cy + ry); poly(0); vctx.fill();
    // 枝のひび
    vctx.strokeStyle = lk.rim; vctx.lineWidth = 1;
    for (const i of [3, 7]) {
      const [sx, sy] = (h01(i, seed) > 0.5 ? top : bot)[i], dir = sy < cy ? -1 : 1;
      vctx.beginPath(); vctx.moveTo(sx, sy); vctx.lineTo(sx + (h01(i + 1, seed) - 0.5) * 8, sy + dir * (3 + h01(i + 2, seed) * 4)); vctx.stroke();
    }
    vctx.fillStyle = lk.chip;
    for (let i = 1; i < n; i++) if (h01(i + 5, seed) > 0.55) vctx.fillRect(Math.round(top[i][0]), Math.round(top[i][1] - 1), 1, 1);
  } else if (lk.shape === "grate" || lk.shape === "trapdoor" || lk.shape === "square") {
    // 外れた格子蓋 / 落とし戸 / 石組みの口: 四角い口。格子は一本が外れて傾き、落とし戸は板が手前へ倒れる
    const w = rx * 1.5, hh = ry * 1.7, x0 = cx - w / 2, y0 = cy - hh / 2;
    vctx.fillStyle = lk.rim; vctx.fillRect(Math.round(x0 - 3), Math.round(y0 - 3), Math.round(w + 6), Math.round(hh + 6));
    vctx.fillStyle = coreGrad(cx, y0, cx, y0 + hh); vctx.fillRect(Math.round(x0), Math.round(y0), Math.round(w), Math.round(hh));
    vctx.fillStyle = lk.chip;
    if (lk.shape === "grate") {
      for (let i = 1; i <= 3; i++) {
        const bx = Math.round(x0 + (w * i) / 4);
        if (i === 2) { vctx.save(); vctx.translate(bx, y0 + hh); vctx.rotate(-0.5); vctx.fillRect(0, -hh * 0.9, 2, hh * 0.9); vctx.restore(); }
        else vctx.fillRect(bx - 1, Math.round(y0), 2, Math.round(hh));
      }
    } else if (lk.shape === "trapdoor") {
      vctx.fillRect(Math.round(x0), Math.round(y0 + hh), Math.round(w), 3);
      vctx.fillStyle = lk.rim;
      for (let i = 1; i < 4; i++) vctx.fillRect(Math.round(x0 + (w * i) / 4), Math.round(y0 + hh), 1, 3);
    } else {
      // 石組み: 縁の切り石の目地と、奥の壁に見える一段下の石段
      for (let i = 0; i < 5; i++) vctx.fillRect(Math.round(x0 - 3 + ((w + 6) * i) / 5), Math.round(y0 - 3), 1, 3);
      vctx.fillRect(Math.round(x0), Math.round(y0 + hh * 0.3), Math.round(w * 0.45), 1);
      vctx.fillRect(Math.round(x0), Math.round(y0 + hh * 0.55), Math.round(w * 0.3), 1);
    }
  } else {
    // 丸い穴: 縁の石 (少し明るい輪) → 穴の闇 (奥へ行くほど黒い)
    vctx.fillStyle = lk.rim;
    vctx.beginPath(); vctx.ellipse(cx, cy, rx + 3, ry + 2.5, 0, 0, Math.PI * 2); vctx.fill();
    const g = vctx.createRadialGradient(cx, cy + ry * 0.2, 0, cx, cy, rx);
    g.addColorStop(0, lk.core[0]); g.addColorStop(0.7, lk.core[1]); g.addColorStop(1, lk.core[2]);
    vctx.fillStyle = g;
    vctx.beginPath(); vctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); vctx.fill();
    vctx.fillStyle = lk.chip;
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * (0.1 + 0.8 * (i / 6)), px = cx + Math.cos(a) * (rx + 1), py = cy + Math.sin(a) * (ry + 1);
      vctx.fillRect(Math.round(px - 1), Math.round(py - 1), 2 + (h01(i, x + y * 7) > 0.5 ? 1 : 0), 2);
    }
    // 縁の飾り (その土地の穴らしさ)
    if (lk.deco === "roots") {
      // 穴を渡る根: 縁から縁へ、たわんだ根を2本
      vctx.strokeStyle = lk.chip; vctx.lineWidth = 1.6;
      for (let k = 0; k < 2; k++) {
        const a0 = Math.PI * (0.85 + 0.3 * h01(k, seed)) + k * Math.PI, a1 = a0 + Math.PI * (0.7 + 0.2 * h01(k + 3, seed));
        const p0 = [cx + Math.cos(a0) * (rx + 2), cy + Math.sin(a0) * (ry + 2)], p1 = [cx + Math.cos(a1) * (rx + 2), cy + Math.sin(a1) * (ry + 2)];
        vctx.beginPath(); vctx.moveTo(p0[0], p0[1]); vctx.quadraticCurveTo(cx, cy + ry * 0.6, p1[0], p1[1]); vctx.stroke();
      }
    } else if (lk.deco === "timber") {
      // 坑木の枠: 穴の上下に渡した2本の丸太と、立てた杭
      vctx.fillStyle = lk.chip;
      vctx.fillRect(Math.round(cx - rx - 4), Math.round(cy - ry - 3), Math.round(rx * 2 + 8), 2);
      vctx.fillRect(Math.round(cx - rx - 4), Math.round(cy + ry + 1), Math.round(rx * 2 + 8), 2);
      vctx.fillStyle = lk.rim;
      vctx.fillRect(Math.round(cx - rx - 4), Math.round(cy - ry - 3), 2, Math.round(ry * 2 + 6));
      vctx.fillRect(Math.round(cx + rx + 2), Math.round(cy - ry - 3), 2, Math.round(ry * 2 + 6));
    } else if (lk.deco === "rubble") {
      // 崩れた石塊: 縁に転がる大きめの石
      for (let k = 0; k < 4; k++) {
        const a = Math.PI * 2 * h01(k, seed + 3), sz = 2 + Math.round(h01(k + 6, seed) * 2);
        const px = Math.round(cx + Math.cos(a) * (rx + 4)), py = Math.round(cy + Math.sin(a) * (ry + 3));
        vctx.fillStyle = lk.rim; vctx.fillRect(px, py + 1, sz + 1, sz);
        vctx.fillStyle = lk.chip; vctx.fillRect(px, py, sz, sz - 1);
      }
    } else if (lk.deco === "snow") {
      // 縁の雪: 奥側の縁に積もった白い帯
      vctx.strokeStyle = "#f4f8fc"; vctx.lineWidth = 2.5;
      vctx.beginPath(); vctx.ellipse(cx, cy, rx + 2, ry + 1.5, 0, Math.PI * 1.05, Math.PI * 1.95); vctx.stroke();
    }
  }
  // 底の照り (地割れの溶岩・氷の青)
  if (lk.glow) {
    vctx.save(); vctx.globalCompositeOperation = "lighter";
    const sh = 0.5 + 0.5 * Math.sin(t * 1.4 + x + y);
    const g = vctx.createRadialGradient(cx, cy, 0, cx, cy, rx * 1.2);
    g.addColorStop(0, `rgba(${lk.glow},${0.22 + 0.12 * sh})`); g.addColorStop(1, `rgba(${lk.glow},0)`);
    vctx.fillStyle = g; vctx.fillRect(cx - rx * 1.2, cy - rx * 1.2, rx * 2.4, rx * 2.4);
    vctx.restore();
  }
  // 水の口: ゆっくり広がる波紋
  if (lk.water) {
    const ph = (t * 0.35 + h01(3, seed)) % 1;
    vctx.globalAlpha = (1 - ph) * 0.45; vctx.strokeStyle = lk.mote; vctx.lineWidth = 0.8;
    vctx.beginPath(); vctx.ellipse(cx, cy, rx * 0.25 + rx * 0.6 * ph, ry * 0.25 + ry * 0.6 * ph, 0, 0, Math.PI * 2); vctx.stroke();
  }
  // 底から昇る粒
  for (let i = 0; i < 4; i++) {
    const ph = (t * (0.25 + h01(i, x * 5 + y) * 0.3) + h01(i, 11)) % 1;
    vctx.globalAlpha = (1 - ph) * (lk.glow ? 0.8 : 0.5);
    vctx.fillStyle = lk.mote;
    vctx.fillRect(Math.round(cx + (h01(i + 3, x + y) - 0.5) * rx * 1.2), Math.round(cy - ph * r.h * 0.3), 1, 1);
  }
  vctx.restore();
}
// 地形の動き (闇の上に描く = 闇の中でもぼうっと光る): 蝕む床の照りと、土地ごとの粒 (泡・火の粉・霜・火花・胞子・切っ先・魂の光)
function drawBoardTerrainFx(now) {
  const cells = G.board.cells;
  const lk = harmHaz().look;
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const c = cells[y][x];
    if (c.revealed && c.type === "pit") { drawPit(x, y, now); continue; }
    if (!c.revealed || c.type !== "poison") continue;
    const r = cellRect(x, y), cx = r.x + r.w / 2, cy = r.y + r.h * 0.55;
    const t = REDUCED_MOTION ? 0 : now * 0.001;
    // 床の照り (ゆっくり脈打つ)
    vctx.save();
    vctx.globalCompositeOperation = "lighter";
    const sh = 0.5 + 0.5 * Math.sin(t * 1.7 + x);
    const g = vctx.createRadialGradient(cx, cy, 0, cx, cy, r.w * 0.42);
    g.addColorStop(0, `rgba(${lk.glow},${0.12 + 0.08 * sh})`);
    g.addColorStop(1, `rgba(${lk.glow},0)`);
    vctx.fillStyle = g;
    vctx.save(); vctx.translate(cx, cy); vctx.scale(1, (r.h * 0.3) / (r.w * 0.42)); vctx.translate(-cx, -cy);
    vctx.fillRect(cx - r.w * 0.42, cy - r.w * 0.42, r.w * 0.84, r.w * 0.84);
    vctx.restore();
    vctx.restore();
    drawHarmMotes(lk, x, y, r, cx, cy, t);
    // 立ちのぼる靄
    if (lk.mist) for (let i = 0; i < 3; i++) {
      const ph = (t * 0.22 + i / 3) % 1;
      const mx = cx + Math.sin(t * 0.9 + i * 2.1) * r.w * 0.18, my = cy - ph * r.h * 0.5;
      const mg = vctx.createRadialGradient(mx, my, 0, mx, my, 9 + ph * 6);
      mg.addColorStop(0, `rgba(${lk.mist},${0.16 * Math.sin(ph * Math.PI)})`);
      mg.addColorStop(1, `rgba(${lk.mist},0)`);
      vctx.globalAlpha = 1;
      vctx.fillStyle = mg;
      vctx.fillRect(mx - 16, my - 16, 32, 32);
    }
    vctx.globalAlpha = 1;
  }
}
// 蝕む床の粒。どれも数粒〜十数粒の fillRect / 線で、毎フレーム軽く描く
function drawHarmMotes(lk, x, y, r, cx, cy, t) {
  const col = lk.fxCol, seed = x * 9 + y;
  const px = (i, k = 0.6) => cx + (h01(i, x + y * 8) - 0.5) * r.w * k;
  const py = (i, k = 0.4) => cy + (h01(i + 7, x * 3 + y) - 0.5) * r.h * k;
  switch (lk.fx) {
    case "bubble": // 弾ける泡
      for (let i = 0; i < 8; i++) {
        const ph = (t * (0.45 + h01(i, seed) * 0.6) + h01(i, 3)) % 1;
        const bx = px(i), by = py(i), rad = 0.8 + ph * 2.4;
        vctx.globalAlpha = (1 - ph) * 0.95;
        vctx.strokeStyle = col; vctx.lineWidth = 0.9;
        vctx.beginPath(); vctx.arc(bx, by - ph * 2, rad, 0, Math.PI * 2); vctx.stroke();
        vctx.fillStyle = "rgba(255,255,230,0.7)";
        vctx.fillRect(bx - rad * 0.4, by - ph * 2 - rad * 0.5, 0.8, 0.8);
      }
      break;
    case "ember": // 舞い上がる火の粉
      for (let i = 0; i < 9; i++) {
        const ph = (t * (0.5 + h01(i, seed) * 0.7) + h01(i, 5)) % 1;
        vctx.globalAlpha = (1 - ph) * (0.6 + 0.4 * Math.sin(t * 9 + i));
        vctx.fillStyle = col;
        vctx.fillRect(Math.round(px(i) + Math.sin(t * 2 + i) * 2), Math.round(py(i) - ph * r.h * 0.45), 1, ph < 0.3 ? 2 : 1);
      }
      break;
    case "frost": // 霜のきらめき (十字に光って消える)
      for (let i = 0; i < 6; i++) {
        const tw = Math.sin(t * (1.6 + h01(i, seed)) + i * 1.7);
        if (tw < 0.3) continue;
        const bx = Math.round(px(i, 0.7)), by = Math.round(py(i, 0.5)), k = tw > 0.85 ? 2 : 1;
        vctx.globalAlpha = tw; vctx.fillStyle = col;
        vctx.fillRect(bx - k, by, k * 2 + 1, 1); vctx.fillRect(bx, by - k, 1, k * 2 + 1);
      }
      break;
    case "spark": { // 床を走る火花 (ときどき、ぎざぎざの線が光る)
      const slot = Math.floor(t * 3 + h01(1, seed) * 7);
      if (h01(slot, seed) < 0.55) {
        vctx.save(); vctx.globalCompositeOperation = "lighter";
        vctx.globalAlpha = 0.9; vctx.strokeStyle = col; vctx.lineWidth = 1;
        vctx.beginPath();
        let ax = cx - r.w * 0.3, ay = py(slot);
        vctx.moveTo(ax, ay);
        for (let k = 1; k <= 5; k++) { ax += r.w * 0.12; ay = cy + (h01(slot * 7 + k, seed) - 0.5) * r.h * 0.35; vctx.lineTo(ax, ay); }
        vctx.stroke(); vctx.restore();
      }
      for (let i = 0; i < 4; i++) {
        const tw = Math.sin(t * 7 + i * 2.3 + seed);
        if (tw < 0.6) continue;
        vctx.globalAlpha = tw; vctx.fillStyle = col; vctx.fillRect(Math.round(px(i)), Math.round(py(i)), 1, 1);
      }
      break;
    }
    case "spore": // 漂う胞子 (ゆっくり昇りながら左右に揺れる)
      for (let i = 0; i < 10; i++) {
        const ph = (t * (0.12 + h01(i, seed) * 0.12) + h01(i, 9)) % 1;
        vctx.globalAlpha = Math.sin(ph * Math.PI) * 0.8;
        vctx.fillStyle = col;
        vctx.fillRect(Math.round(px(i, 0.8) + Math.sin(t * 1.3 + i) * 4), Math.round(py(i) - ph * r.h * 0.6), 1, 1);
      }
      break;
    case "glint": // 散らばった切っ先が光る (動かない)
      for (let i = 0; i < 9; i++) {
        const bx = Math.round(px(i, 0.75)), by = Math.round(py(i, 0.55));
        vctx.globalAlpha = 0.55; vctx.fillStyle = col; vctx.fillRect(bx, by, 1, 1);
        vctx.fillRect(bx + (h01(i, seed) > 0.5 ? 1 : -1), by + 1, 1, 1);
        const tw = Math.sin(t * (1.2 + h01(i + 2, seed)) + i * 2.2);
        if (tw > 0.9) { vctx.globalAlpha = (tw - 0.9) * 10; vctx.fillRect(bx - 1, by, 3, 1); vctx.fillRect(bx, by - 1, 1, 3); }
      }
      break;
    case "soul": // 根に吸われて昇る魂の光
      for (let i = 0; i < 5; i++) {
        const ph = (t * (0.18 + h01(i, seed) * 0.15) + h01(i, 4)) % 1;
        const bx = px(i, 0.7) + Math.sin(t + i) * 2, by = py(i) - ph * r.h * 0.55;
        vctx.globalAlpha = Math.sin(ph * Math.PI) * 0.7; vctx.fillStyle = col;
        vctx.fillRect(Math.round(bx), Math.round(by), 2, 2);
        vctx.globalAlpha *= 0.4; vctx.fillRect(Math.round(bx), Math.round(by + 2), 2, 3);
      }
      break;
  }
  vctx.globalAlpha = 1;
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

// 探りの術の光: 墓石の下から滲む、ぼんやりした光 (ゆっくり明滅し、芯が少し揺らぐ)
const SENSE_GLOW = { enemy: [255, 52, 40], chest: [70, 150, 255] };
function drawSenseGlow(r, rgb, now, x, y, k = 1) {
  const t = REDUCED_MOTION ? 0.5 : 0.5 + 0.5 * Math.sin(now * 0.0017 + x * 1.7 + y * 2.3);
  const dx = REDUCED_MOTION ? 0 : Math.sin(now * 0.0009 + y) * r.w * 0.06;
  const dy = REDUCED_MOTION ? 0 : Math.cos(now * 0.0011 + x) * r.h * 0.06;
  const cx = r.x + r.w / 2 + dx, cy = r.y + r.h / 2 + dy, rad = Math.max(r.w, r.h) * 0.62;
  const [cr, cg, cb] = rgb;
  const g = vctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
  g.addColorStop(0, `rgba(${cr},${cg},${cb},${(0.34 + 0.16 * t) * k})`);
  g.addColorStop(0.45, `rgba(${cr},${cg},${cb},${(0.16 + 0.08 * t) * k})`);
  g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
  vctx.save();
  vctx.globalCompositeOperation = "lighter";
  vctx.fillStyle = g;
  vctx.fillRect(r.x - r.w * 0.15, r.y - r.h * 0.15, r.w * 1.3, r.h * 1.3);
  vctx.restore();
}

// 気配読み (魔物 = ぼんやりした赤い光) / 宝探し (宝箱 = ぼんやりした青い光)。種類・強さは分からない。歩いている間も灯したまま
// 清めの歩み (聖騎士): まだめくっていないカードをめくるたび、全員の HP を 2/4/6 回復 (隊で一番高いLv)
function cleanseStepHeal(...args) { return tlGameMeasure("explore", () => cleanseStepHealMeasured(...args)); }
function cleanseStepHealMeasured() {
  const lv = Math.min(3, partyPassiveLv("cleanseStep"));
  if (!lv) return;
  const hp = [0, 2, 4, 6][lv];
  let any = false;
  for (const p of G.party) {
    if (!p.alive) continue;
    if (p.hp < p.maxhp) { p.hp = Math.min(p.maxhp, p.hp + hp); any = true; }
  }
  if (any) renderParty();
}
// 感知のパッシブ (この階で示す墓石を最初に決めて覚える。めくられたものは示さない):
//  敵感知 (senseEnemy) = 魔物を Lv 体 / 財宝感知 (senseTreasure) = 宝箱を Lv 個
function passiveSensePlan() {
  const b = G.board;
  if (b.psense) return b.psense;
  const pick = (type) => {
    const out = [];
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) { const c = b.cells[y][x]; if (c.type === type && !c.revealed && !c.cleared) out.push([x, y]); }
    for (let i = out.length - 1; i > 0; i--) { const j = rand(i + 1); [out[i], out[j]] = [out[j], out[i]]; }
    return out.slice(0, 3);
  };
  b.psense = { enemy: pick("monster"), chest: pick("chest") };
  return b.psense;
}
function drawSenseGlows(now) {
  if (G.state !== "board") return;
  const fsE = fieldSense("enemy"), fsC = fieldSense("chest");
  const psE = partyPassiveLv("senseEnemy"), psT = partyPassiveLv("senseTreasure");
  if ((psE || psT) && inDungeon()) {
    const plan = passiveSensePlan();
    const hidden = ([x, y]) => { const c = G.board.cells[y] && G.board.cells[y][x]; return c && !c.revealed && !c.cleared; };
    if (!fsE) for (const p of plan.enemy.slice(0, Math.min(3, psE))) if (hidden(p)) drawSenseGlow(cellRect(p[0], p[1]), SENSE_GLOW.enemy, now, p[0], p[1], 0.7);
    if (!fsC) for (const p of plan.chest.slice(0, Math.min(3, psT))) if (hidden(p)) drawSenseGlow(cellRect(p[0], p[1]), SENSE_GLOW.chest, now, p[0], p[1], 0.7);
  }
  if (!fsE && !fsC) return;
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const cell = G.board.cells[y][x];
    if (cell.revealed || cell.cleared) continue;
    if (fsE && cell.type === "monster") drawSenseGlow(cellRect(x, y), SENSE_GLOW.enemy, now, x, y);
    else if (fsC && cell.type === "chest") drawSenseGlow(cellRect(x, y), SENSE_GLOW.chest, now, x, y);
  }
}

// めくれる墓石の霊光 (隣接=脈打つ縁取り / 遠隔=淡い縁)
function drawBoardHighlights(now) {
  if (G.state !== "board" || G.anim || G.walking) return;
  const reach = getReachableCells();
  const pulse = REDUCED_MOTION ? 0.6 : 0.5 + 0.5 * Math.sin(now * 0.0042);
  const fsS = fieldSense("stairs"); // 道しるべ (この階だけ)
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
        // 角のくさび
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
    // 道しるべの印 (敵感知・財宝感知はぼんやりした光で示す ― drawSenseGlows)
    if (!cell.cleared) {
      let mark = null;
      if (cell.type === "stairs" && fsS) {                                       // 道しるべ: 階段の墓石を淡く縁取る
        mark = { text: "▼", color: "#8fd8ff" };
        vctx.save();
        vctx.strokeStyle = `rgba(143,216,255,${0.35 + 0.35 * pulse})`;
        vctx.lineWidth = 1.6;
        vctx.strokeRect(r.x + 1.5, r.y + 1.5, r.w - 3, r.h - 3);
        vctx.restore();
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
    cell.type === "fountain" ? (cell.cleared ? ICONS.fountainEmpty : ICONS.fountain) :
    cell.type === "corpse" ? corpseIcon(cell) :
    isPortalCell(cell) ? ICONS.portal :
    cell.type === "stairs" ? (bossDoorHere() ? ICONS.bossDoor : ICONS.stairs) :
    cell.type === "event" && !cell.cleared ? ICONS.event :
    cell.type === "story" && !cell.cleared ? (ICONS.story || ICONS.event) : null;
}
// 帰還魔法陣のマス (奈落の陣 / 台帳の迷宮で下り階段の代わりに立つ陣)
function isPortalCell(c) { return !!c && (c.type === "portal" || (c.type === "stairs" && !!c.gate)); }
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
    const light = 0.35 + 0.65 * Math.max(lightAt(lt, cx, r.y + r.h / 2), isPortalCell(cell) || cell.type === "story" ? 0.6 : 0);
    if (isPortalCell(cell)) {
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
      // 名前のまだわからない魔物は影の姿 (戦闘と同じ)
      const b = enemyUnknown({ key: cell.monsterKey, mon: icon }) ? monsterUnknownBitmap(icon) : monsterBitmap(icon);
      const bottom = r.y + r.h * 0.9;
      vctx.save();
      vctx.globalCompositeOperation = "lighter";
      const pulse = REDUCED_MOTION ? 0.5 : 0.5 + 0.5 * Math.sin(now * 0.0035 + x);
      const g = vctx.createRadialGradient(cx, bottom - r.h * 0.12, 0, cx, bottom - r.h * 0.12, r.w * 0.55);
      // 金属の魔物は血の気配の代わりに銀の照り返し
      g.addColorStop(0, cell.metal ? `rgba(170,190,220,${0.22 + 0.14 * pulse})` : `rgba(${cell.elite ? "220,30,20" : "150,20,14"},${0.22 + 0.12 * pulse})`);
      g.addColorStop(1, cell.metal ? "rgba(170,190,220,0)" : "rgba(150,20,14,0)");
      vctx.fillStyle = g; vctx.fillRect(r.x - 6, r.y, r.w + 12, r.h);
      vctx.restore();
      vctx.fillStyle = "rgba(0,0,0,0.5)";
      vctx.beginPath(); vctx.ellipse(cx, bottom - 1, r.w * 0.34, 3.4, 0, 0, Math.PI * 2); vctx.fill();
      drawBmpFit(b, cx, bottom, r.w * (here ? 0.62 : 0.94), r.h * (here ? 0.58 : 0.78), light);
      if (cell.metal && !REDUCED_MOTION) {
        // 金属の魔物: 銀肌にきらりと走る星のまたたき
        const tw = (now * 0.0011 + x * 0.37 + y * 0.21) % 1;
        if (tw < 0.35) {
          const a = Math.sin((tw / 0.35) * Math.PI), sx = cx - r.w * 0.16 + tw * r.w * 0.5, sy = r.y + r.h * 0.42;
          vctx.save();
          vctx.globalCompositeOperation = "lighter";
          vctx.fillStyle = `rgba(235,245,255,${0.9 * a})`;
          const L = 1 + 3.2 * a;
          vctx.fillRect(sx - L, sy - 0.5, L * 2, 1);
          vctx.fillRect(sx - 0.5, sy - L, 1, L * 2);
          vctx.restore();
        }
      }
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
    const painted = cryptPropBitmap(cryptPropKey(cell, bossDoorHere()));
    const b = painted || plainBitmap(icon);
    const size = Math.min(r.w * (here ? 0.62 : 0.86), r.h * (here ? 0.5 : 0.62));
    // 遺体は膝を曲げた座り姿。頭身は原画で保ち、左右の壁と同居する駒の余白を取る。
    const maxW = painted && cell.type === "corpse" ? r.w * (here ? 0.5 : 0.76) : painted ? r.w * (here ? 0.55 : 0.86) : size;
    const maxH = painted ? r.h * (here ? 0.5 : 0.68) : size;
    const fit = Math.min(maxW / b.w, maxH / b.h), iconW = b.w * fit, iconH = b.h * fit;
    const bottom = r.y + r.h / 2 + (painted ? iconH : size) / 2 + r.h * 0.04;
    vctx.fillStyle = "rgba(0,0,0,0.42)";
    vctx.beginPath(); vctx.ellipse(cx, bottom - size * 0.08, (painted ? iconW : size) * 0.42, 3, 0, 0, Math.PI * 2); vctx.fill();
    drawBmpFit(b, cx, bottom, maxW, maxH, light);
    // まだあたたかい死体 (魂未回収) には青い人魂
    if (cell.type === "corpse" && cell.corpseWarm && !cell.cleared) {
      const phase = now * 0.0017 + x * 1.9 + y * 0.7;
      const sway = REDUCED_MOTION ? 0 : Math.sin(phase) * size * 0.035;
      const bob = REDUCED_MOTION ? 0 : Math.sin(phase * 1.37) * size * 0.025;
      const breath = REDUCED_MOTION ? 1 : 1 + Math.sin(phase * 1.8) * 0.045;
      const wisp = cryptPropBitmap("wisp");
      // 元の大きさと高さを保ち、小さくゆらめかせる。
      vctx.save();
      vctx.translate(cx + sway, bottom - size * 0.62 + bob);
      vctx.rotate(REDUCED_MOTION ? 0 : Math.sin(phase * 0.83) * 0.085);
      vctx.scale(1 / breath, breath);
      drawBmpFit(wisp || plainBitmap(ICONS.wisp), 0, 0, size * 0.5, size * 0.5, 1, 0.92);
      vctx.restore();
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
      const side = i % 4, u = fxRandom();
      const px = side === 0 ? r.x + u * r.w : side === 1 ? r.x + r.w : side === 2 ? r.x + u * r.w : r.x;
      const py = side === 0 ? r.y : side === 1 ? r.y + u * r.h : side === 2 ? r.y + r.h : r.y + u * r.h;
      const a = Math.atan2(py - (r.y + r.h / 2), px - (r.x + r.w / 2));
      const sp = 0.012 + fxRandom() * 0.03;
      BV.parts.push({ x: px, y: py, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.006, t0: now, life: 500 + fxRandom() * 500, s: 0.8 + fxRandom() * 1.6 });
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
  vctx.imageSmoothingEnabled = !!BV.art.painting || boardCamera.zoom > 1;
  const sourceScale = BV.art.scale;
  const W = r.w * sc, H = r.h * sc;
  vctx.drawImage(BV.art.slabs, r.x * sourceScale, r.y * sourceScale, r.w * sourceScale, r.h * sourceScale, r.x + r.w / 2 - W / 2 + ox, r.y + r.h / 2 - H / 2 + oy, W, H);
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

// 浮遊中の駒: 地面から浮かせる高さ (論理座標)。ゆっくり上下に漂う。浮いていなければ 0
function walkerLift(now) {
  if (floatLeft() <= 0) return 0;
  return CARD_H * 0.1 + (REDUCED_MOTION ? 0 : Math.sin(now * 0.0025) * 2);
}
// 足元の影。浮いている時 (lift > 0) は小さく淡くし、地面に淡い風の輪を残す
function drawWalkerShadow(x, feet, rx, a, lift, now) {
  const f = lift > 0 ? Math.max(0.55, 0.78 - lift / (CARD_H * 0.6)) : 1;
  vctx.save();
  if (lift > 0) {
    const pulse = REDUCED_MOTION ? 0.5 : 0.5 + 0.5 * Math.sin(now * 0.004);
    vctx.strokeStyle = `rgba(170,215,255,${0.18 + 0.12 * pulse})`;
    vctx.lineWidth = 1;
    vctx.beginPath(); vctx.ellipse(x, feet - 1, rx[0] * (1.05 + 0.1 * pulse), 5 + pulse, 0, 0, Math.PI * 2); vctx.stroke();
  }
  vctx.fillStyle = `rgba(0,0,0,${a[0] * f})`;
  vctx.beginPath(); vctx.ellipse(x, feet - 1, rx[0] * f, 5 * f, 0, 0, Math.PI * 2); vctx.fill();
  vctx.fillStyle = `rgba(0,0,0,${a[1] * f})`;
  vctx.beginPath(); vctx.ellipse(x, feet - 1, rx[1] * f, 3 * f, 0, 0, Math.PI * 2); vctx.fill();
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
  const maxH = hi ? Math.min(CARD_H * 0.94, 110) : Math.min(CARD_W * 0.78, CARD_H * 0.66);
  const feet = hy + (hi ? CARD_H * 0.44 : CARD_H * 0.3);
  const lift = walkerLift(now); // 浮遊中は宙に浮く (影は地面に残す)
  drawWalkerShadow(x, feet, [CARD_W * 0.36, CARD_W * 0.22], [0.3, 0.55], lift, now);
  const box = drawBmpFit(b, x, feet + 1 - lift, hi ? CARD_W * 1.1 : maxH, maxH);
  drawHandLantern(x - box.W * (hi ? 0.36 : 0.42) - 2, box.y + box.H * (hi ? 0.5 : 0.56), now);
}
// 赤い頭巾の人影 (4方向)。端末の画素の格子に整数倍で置き、補間なしでくっきり描く。
// 高さは墓石の約8割。足元に影、手の角灯が光の輪の源。待機中は2コマでわずかに上下し、歩く時は小さく弾む
function drawHoodedWalker(wk, hx, hy, now) {
  const painted = cryptWalkerBitmap(G._facing, PREFS.walkerLook);
  if (painted) { drawPaintedWalker(painted, hx, hy, now); return; }
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
  // 待機の2コマ (約0.6秒ごとに1ドット) / 歩みの弾み。浮遊中は弾まず、宙をゆっくり漂う
  const lift = walkerLift(now);
  let bob = 0;
  if (lift > 0) bob = -Math.round(lift * VSY);
  else if (G.heroAnim) {
    const t = Math.min(1, (performance.now() - G.heroAnim.t0) / Math.max(1, G.heroAnim.dur));
    bob = REDUCED_MOTION ? 0 : -Math.round(Math.sin(t * Math.PI) * 1.5) * k;
  } else if (!REDUCED_MOTION) bob = (Math.floor(now / 620) % 2) ? -k : 0;
  // 影 (浮遊中も地面に残す)
  drawWalkerShadow(x, feet, [Math.max(CARD_W * 0.3, W * 0.42), Math.max(CARD_W * 0.18, W * 0.26)], [0.32, 0.55], lift, now);
  // 論理座標で置き、盤面のカメラ変換を保つ。
  const dx = Math.round(x * VSX - Wd / 2);
  const dy = Math.round((feet + 1) * VSY - Hd) + bob;
  vctx.save();
  vctx.imageSmoothingEnabled = boardCamera.zoom > 1;
  vctx.drawImage(b.c, dx / VSX, dy / VSY, Wd / VSX, Hd / VSY);
  vctx.restore();
  // 手に提げた角灯の灯り (絵に描かれた灯の位置に、揺らぐ光暈だけを重ねる。籠は絵のものを使う)
  const lp = walkerLampSpot(wk);
  drawLanternGlow((dx + (b.pad + lp.x + 0.5) * k) / VSX, (dy + (b.pad + lp.y + 0.5) * k) / VSY, now);
}
// 原画の人物も同じ足元・向き・浮遊状態に従い、カメラの論理座標で描く。
function drawPaintedWalker(b, hx, hy, now) {
  const cur = G.board.cells[G.py]?.[G.px], share = !G.heroAnim && cur && !!cellIcon(cur);
  const x = hx - (share ? CARD_W * 0.1 : 0), feet = hy + CARD_H * 0.42;
  const lift = walkerLift(now);
  let bob = 0;
  if (!REDUCED_MOTION && !lift) {
    bob = G.heroAnim ? -Math.sin(Math.min(1, (now - G.heroAnim.t0) / Math.max(1, G.heroAnim.dur)) * Math.PI) * 1.5 : Math.sin(now * 0.0025) * 0.35;
  }
  drawWalkerShadow(x, feet, [CARD_W * 0.23, CARD_W * 0.14], [0.25, 0.4], lift, now);
  // 小物との同居では位置だけを寄せ、空のマスと同じ大きさを保つ。
  const box = drawBmpFit(b, x, feet - lift + bob, CARD_W * 0.76, CARD_H * 0.98);
  drawLanternGlow(box.x + box.W * b.lamp[0], box.y + box.H * b.lamp[1], now);
}
// 駒の絵の中の灯 (下半分にある明るい黄の点の重心)。向きごとに一度だけ求める
const _lampSpot = new WeakMap();
function walkerLampSpot(wk) {
  let s = _lampSpot.get(wk);
  if (s) return s;
  const src = wk.lampRef || wk; // 縁取りを金以外にした装いは、金の絵で灯の位置を求める
  const rows = src.art || [];
  let sx = 0, sy = 0, n = 0;
  rows.forEach((r, y) => {
    if (y < rows.length * 0.45) return;
    for (let x = 0; x < r.length; x++) {
      const c = src.palette[r[x]];
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

// 塵: めくった蓋から舞う砂ほこりと、角灯の光の中を漂う微塵
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

// 層12「地底大空洞」のカード裏面: 天井のつらら石と地の石筍、岩肌の琥珀結晶、遥か下の残光と漂う塵
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

  // つらら石 (天井から下がる大小の岩)
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
  // よどんだ地
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

// 層7「灼熱の洞」のカード裏面: 煮え立つ溶岩だまり、赤熱したつらら石、爆ぜる泡と立ちのぼる火の粉
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

  // つらら石 (暗い岩。先端は溶岩の照り返しで赤熱)
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

  // 中央の墓石 (ターントップの墓標)
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
    cleanseStepHeal();
    G.flipAnim = { x: nx, y: ny, t0: performance.now(), dur: walkMs(240) };
    const ftick = () => {
      renderBoard();
      if (performance.now() - G.flipAnim.t0 >= G.flipAnim.dur) {
        G.flipAnim = null;
        if (floatLeft() <= 0) SFX.step(); // 浮遊中は足音を立てない
        slide();
      } else {
        requestAnimationFrame(ftick);
      }
    };
    requestAnimationFrame(ftick);
  } else {
    if (floatLeft() <= 0) SFX.step(); // 浮遊中は足音を立てない
    slide();
  }
}

// 壁を考慮した最短経路 (現在地 → tx,ty)。歩く順の {x,y} 配列を返す。
// 途中は「めくり済みのマス」だけを通り、未公開カードは勝手にめくらない。
// ただし目的地が未公開でも、めくり済み領域に隣接していれば最後の1歩としてめくれる。
// 自動で歩く道は、見えている落ちる床 (落とし穴) を通らない道を先に探す (浮いている時・他に道が無い時は通る)
function findPath(tx, ty) {
  if (floatLeft() <= 0) { const p = findPathInner(tx, ty, true); if (p.length) return p; }
  return findPathInner(tx, ty, false);
}
function findPathInner(tx, ty, avoidPit) {
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
      if (avoidPit && !isTarget && G.board.cells[ny][nx].type === "pit") continue;
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
  G._walkAbort = false; // 1歩ずつ歩いて落とし穴に落ちた時の印が残っていても、新しい道は捨てない
  walkRedirect = null;
  const next = () => {
    if (cloudBusy()) { setTimeout(next, 100); return; }
    // 落とし穴に落ちた: 経路は前の階のものなので、ここで歩みを止める
    if (G._walkAbort) { G._walkAbort = false; G.walking = false; walkRedirect = null; return; }
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

// ===== オート移動 =====
// ドックの「オート」で切り替える (セーブしない・街へ戻れば切れる)。ON の間は1歩ずつ行き先を決め直して歩き続ける:
//  ・まだめくっていない墓石のうち、歩いて最も近いものへ向かう (同じ近さなら今向いている方向を優先 ―
//    まっすぐ進み、壁に当たれば向きを変える)
//  ・見えている罠 (めくれた罠・落ちる床・蝕む床 ― 浮遊中・悪路渡りで無効にできる時を除く) は踏まない
//  ・設定「オート移動で避けるもの」(prefs.js autoMoveAvoid) で、4つそれぞれ避ける/避けないを選べる:
//      一般の敵 foe・強敵 elite = 見えている敵 (めくれた魔物の札・気配読み/敵感知の光)。避けるなら踏まない。
//        光だけの敵は強敵か分からないので一般の敵として扱う。金属の魔物は一般の敵
//      出来事 event = まだ訪ねていない表向きの出来事。避けないなら行き先にする
//      宝箱 chest = 表向きでまだ開けていない宝箱 (一度「開けない」を選んだ箱は除く)。避けないなら行き先にする。
//        避けるなら宝探し/財宝感知で光る伏せた宝箱にも向かわない
//      (避けると決めた出来事・宝箱も、ほかに道が無い時だけは通る)
//    札をタップすれば、どの設定でもそこへ寄り道できる
//  ・決断の要る札 (階段・帰還陣・開けなかった宝箱・泉・死体・出来事・物語) は、ほかに道が無い時だけ通る
//  ・戦闘が終わった・何かを選んだ (決断の問い・シートが開いた) ら、それが済んだところで切れる (autoMoveBreak)。
//    新たに深手 (HP3割未満) を負う・倒れる者が出た時も止まる
//  ・スワイプ・方向キーで歩けば手で動かしたものとして止まる
const AUTO_MOVE_HURT = 0.3;
let autoMoveTimer = null;
let autoMoveVia = null;   // 寄り道の行き先 (タップしたマス)。着くか戦闘が始まるまで覚えておき、選択で止まっても続きを歩く
let autoMoveHold = null;  // 1歩の終わりを待って行うドック・手帳などの操作
let autoMoveHurt = null;  // ON にした時点で深手・戦闘不能だった者 (uid) ― これ以外が深手になれば止まる
let autoMoveBreak = null; // 戦闘 ("battle")・選択 ("choice") が挟まった印 ― それが済めばオート移動を切る
let autoPlanStep = false; // いまの1歩がオート移動の決めた1歩か (寄り道・タップの歩みは含まない)
function autoMoveAvoid() { return uiDungeonHud.autoMoveAvoid(); }
function autoMoveWounded() {
  return new Set(G.party.filter((p) => !p.alive || p.hp < p.maxhp * AUTO_MOVE_HURT).map((p) => p.uid));
}
// 切り替え・止まったことの知らせ (トースト) は出さない (ユーザーの指示、2026-10)。ON/OFF はドックの札の灯りで分かる
function setAutoMove(on) {
  on = !!on && G.state === "board" && inDungeon();
  if (!!G.autoMove === on) return;
  G.autoMove = on;
  autoMoveVia = null;
  autoMoveHold = null;
  autoMoveBreak = null;
  if (autoMoveTimer !== null) { clearTimeout(autoMoveTimer); autoMoveTimer = null; }
  if (on) {
    autoMoveHurt = autoMoveWounded();
    autoMoveSchedule(0);
  }
  renderDock();
}
function toggleAutoMove() {
  if (G.state !== "board" || !inDungeon() || uiBlocked()) return;
  SFX.select(); buzz(10);
  setAutoMove(!G.autoMove);
}
function autoMoveSchedule(ms) {
  if (autoMoveTimer !== null) clearTimeout(autoMoveTimer);
  autoMoveTimer = setTimeout(autoMoveTick, ms);
}
// オート移動中にドックや手帳を押した: いまの1歩が終わってから行う (true = 預かった)
function holdForAutoMove(fn) {
  if (!G.autoMove || G.state !== "board" || uiBlocked() || !(G.anim || G.walking)) return false;
  autoMoveHold = fn;
  return true;
}
// オート移動中に盤面のマスをタップした: そこへ寄り道する (着いたら、また近くの墓石へ)
function autoMoveDetour(x, y) {
  autoMoveVia = { x, y };
  if (G.walking) walkRedirect = { x, y };
}
function autoMoveTick() {
  autoMoveTimer = null;
  if (!G.autoMove) return;
  if (!inDungeon() || (G.state !== "board" && G.state !== "combat")) { setAutoMove(false); return; } // 街へ帰った・全滅
  // 戦闘・選択 (シート・決断の問い) が挟まったら、それが済んだところでオート移動を切る (ユーザーの指示)
  if (G.state === "combat") autoMoveBreak = "battle";
  else if (uiBlocked() && !autoMoveBreak) autoMoveBreak = "choice";
  if (G.state !== "board" || G.anim || G.walking || uiBlocked()) { autoMoveSchedule(150); return; }
  if (autoMoveBreak) {
    setAutoMove(false);
    return;
  }
  if (autoMoveHold) { const fn = autoMoveHold; autoMoveHold = null; fn(); autoMoveSchedule(150); return; }
  // 新たに深手を負った・倒れた者がいる: 歩みを止めて手当てを促す
  const hurt = [...autoMoveWounded()].filter((u) => !autoMoveHurt.has(u));
  if (hurt.length) { setAutoMove(false); return; }
  autoMoveHurt = autoMoveWounded(); // 癒えた者は数え直す (また深手になれば止まる)
  if (autoMoveVia) {
    const t = autoMoveVia;
    const path = t.x === G.px && t.y === G.py ? [] : findPath(t.x, t.y);
    if (path.length) { autoWalk(path); autoMoveSchedule(150); return; }
    autoMoveVia = null; // 着いた・もう行けない
  }
  const step = autoMovePlan();
  if (!step) { setAutoMove(false); return; } // めくれる墓石が無い・敵や罠が道を塞いでいる
  autoPlanStep = true; // この1歩はオート移動が決めた (階段の素通りに使う)
  moveStep(step.x, step.y, () => { autoPlanStep = false; autoMoveSchedule(walkMs(110)); });
}
// 次の1歩を決める: 安全なめくり済みのマスを通って届く行き先 (伏せた墓石・挑む敵) のうち最も近いもの。
// 決断の要る札は、それを避けて届く行き先が無い時だけ通る
function autoMovePlan() {
  const b = G.board;
  if (!b) return null;
  const avoid = autoMoveAvoid();
  const floating = floatLeft() > 0;
  const poisonSafe = floating || partyPassiveLv("poisonFloor") >= 2;
  // 光で見えている、まだめくっていない魔物 (気配読み = すべて / 敵感知 = 選ばれた数だけ)
  const sensed = new Set();
  if (fieldSense("enemy")) {
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) { const c = b.cells[y][x]; if (c.type === "monster" && !c.revealed && !c.cleared) sensed.add(x + "," + y); }
  }
  const psE = partyPassiveLv("senseEnemy");
  if (psE && inDungeon()) for (const [x, y] of passiveSensePlan().enemy.slice(0, Math.min(3, psE))) sensed.add(x + "," + y);
  // 宝探し・財宝感知で光る、まだめくっていない宝箱 (宝箱を避ける時は向かわない)
  const sensedChest = new Set();
  if (avoid.chest) {
    if (fieldSense("chest")) {
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) { const c = b.cells[y][x]; if (c.type === "chest" && !c.revealed && !c.cleared) sensedChest.add(x + "," + y); }
    }
    const psT = partyPassiveLv("senseTreasure");
    if (psT && inDungeon()) for (const [x, y] of passiveSensePlan().chest.slice(0, Math.min(3, psT))) sensedChest.add(x + "," + y);
  }
  const isFoe = (c) => c.type === "monster" && !c.cleared;
  // 挑む敵: めくれた札は強敵かどうかが見える。光だけの敵は強敵か分からないので、一般の敵として扱う
  const fightable = (c) => (c.revealed && c.elite && !c.metal) ? !avoid.elite : !avoid.foe;
  const danger = (c) => c.revealed && (
    (c.type === "trap" && !c.cleared) || (c.type === "pit" && !floating) || (c.type === "poison" && !poisonSafe));
  // 一度「まだ探索する」を選んだ階段は、踏んでも問わないので普通の通り道として扱う
  const nuisance = (c) => c.revealed && ((c.type === "stairs" && !c.stairsSeen) || c.type === "portal" ||
    (!c.cleared && ["chest", "fountain", "corpse", "event", "story"].includes(c.type)));
  // 向いている方向を優先 (まっすぐ進み、壁に当たったら曲がる)。真後ろは最後
  const f = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[G._facing] || [0, 1];
  const order = Object.values(DIRS_G).sort((a, c) => rankDir(a) - rankDir(c));
  function rankDir(d) { return d[0] === f[0] && d[1] === f[1] ? 0 : d[0] === -f[0] && d[1] === -f[1] ? 2 : 1; }
  for (const passNuisance of [false, true]) {
    const key = (x, y) => x + "," + y;
    const first = new Map([[key(G.px, G.py), null]]);
    let frontier = [[G.px, G.py]];
    while (frontier.length) {
      const next = [];
      let found = null;
      for (const [x, y] of frontier) {
        const cell = b.cells[y][x];
        for (const d of order) {
          if (cell.walls[dirName(d)]) continue;
          const nx = x + d[0], ny = y + d[1];
          if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
          const k = key(nx, ny);
          if (first.has(k)) continue;
          const c = b.cells[ny][nx];
          const step = first.get(key(x, y)) || { x: nx, y: ny };
          first.set(k, step);
          const foe = isFoe(c) && (c.revealed || sensed.has(k));
          // 表向きでも未発見の手がかりは探索する。未訪問の出来事・開けていない宝箱は設定で避けなければ向かう。
          // 一度立ち去った出来事・「開けない」を選んだ宝箱・立ち去った死体は自動で問い直さない。
          // 死体 (あたたかい・偉大なる・風化) は宝箱と同じ設定に従う (ユーザーの指示、2026-10。起き上がって逃げた死体は除く)
          const unread = !c.cleared && (c.type === "story" ||
            (c.type === "event" && !c.evSeen && !avoid.event) ||
            (c.type === "chest" && !c.chestSeen && !avoid.chest) ||
            (c.type === "corpse" && !c.corpseSeen && !c._corpseRise && !avoid.chest));
          // 行き先: 挑む敵 / 伏せた墓石 (避ける宝箱の光を除く) / 未読の物語・出来事・宝箱 (見えている罠は避ける)
          if (!found && !danger(c) && (foe ? fightable(c) : c.revealed ? unread : !sensedChest.has(k))) found = step;
          if (found) continue;
          // 中継: めくり済みで、敵・罠でなく、(この回は) 決断の要る札でもないマス
          if (!c.revealed || isFoe(c) || danger(c)) continue;
          if (!passNuisance && nuisance(c)) continue;
          next.push([nx, ny]);
        }
        if (found) return found;
      }
      frontier = next;
    }
  }
  return null;
}
function dirName(d) { return d[0] === 1 ? "e" : d[0] === -1 ? "w" : d[1] === 1 ? "s" : "n"; }

// ===== 盤面の出来事 (§3.6 割り込みの方針) =====
// 決断 (宝箱・あたたかい死体・泉・黒い泉・階段・帰還陣) だけをシートで問い、
// 褒美・罠の解除・軽い痛手・風化した死体はトースト (札の明滅) で知らせて歩みを止めない。
// 札 (カード) で止めるのは、倒れた者が出た時・飛ばされた時・呼び寄せた時・戦闘が始まる時だけ。
function resolveCell(...args) { return tlGameMeasure("terrain", () => resolveCellMeasured(...args)); }
function resolveCellMeasured(cell) {
  switch (cell.type) {
    case "monster":
      if (!cell.cleared) {
        const mon = MONSTERS[cell.monsterKey];
        // 名前は討伐数で明かす (enemyReveal) — 戦闘前の名乗りでも、まだ知らない敵の名は出さない
        const name = enemyReveal({ key: cell.monsterKey, mon }).name ? mon.name : unknownTag(unknownLabel(mon));
        if (mon.metal) {
          // 金属の魔物: 倒せば莫大な✦Soul。ただしすぐ逃げる
          log(`✦ ${name} だ！ 逃がすな！`, "win");
          startBattle(spawnMetal(cell.monsterKey, metalRef(cell.monsterKey)), cell);
        } else if (cell.elite) {
          // 強敵は群れない: 規格外の1体が立ちはだかる
          log(`☠ 強敵 ${name} が立ちはだかる！`, "dmg");
          startBattle(abyssActive() ? infEliteFoes(cell.monsterKey) : soloFoes(spawnEliteEnemies(cell.monsterKey, soloScale())), cell);
        } else {
          const tr = dungeonTrait();
          if (tr && tr.duel) {
            // 迷宮の掟「一騎打ち」: 群れずに1体だけ。強敵並みに強く、戦果は群れの分だけ持つ
            log(`⚔ ${name}が、一騎打ちを挑んできた！`, "dmg");
            startBattle(duelFoes(cell.monsterKey), cell);
          } else {
            log("⚔ 石札の下から、魔物が這い出してきた！", "dmg");
            // 迷宮の異変 (飢えた狩場): 敵が常に群れで現れる
            startBattle(spawnCardEnemies(cell.monsterKey, G.floor, enemyScale(), { min: mutNum("packMin", 0) }), cell);
          }
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
      // 迷宮ランクに応じた罠を抽選し、隊で最も解除値 (AGI+LUK・盗賊系1.5倍) が高い者が解除を試みる
      const trap = pickTrap(activeCfg().rank || 1);
      const best = bestDisarmer();
      if (best && random() < disarmChance(best)) {
        SFX.chest();
        G.stats.trapsDisarmed++; // 戦績: 解除した罠 (勲章用)
        log(`床の罠「${trap.name}」を ${best.name}が見抜き、解除した！`, "sys");
        showToast(`床の罠「${trap.name}」― ${best.name}が見抜いて解除`, { noLog: true, tone: "good", icon: ICONS.trap });
        break;
      }
      presentTrap(applyTrap(trap, best), { proceed: () => renderBoard() }, boardSink());
      break;
    }
    case "pit": {
      // 落ちる床 (その土地の穴 — floorhaz.js): ダメージは無いが、1階下へ強制的に落とされる (最下階には無い)。浮遊していれば落ちない
      const hz = fallHaz();
      if (floatLeft() > 0) {
        log(`${hz.name}だ。だが隊は宙に浮いたまま、その上を渡った。`, "sys");
        showToast(`${hz.name} ― 浮遊で越えた`, { noLog: true, tone: "good", icon: ICONS.trap });
        break;
      }
      if (abyssActive() ? isRestFloor(G.floor) : G.floor >= (curDungeon().floors || 1)) break; // 念のため (最下階・無限迷宮の風だまりには置かない)
      SFX.trap(); buzz([0, 60, 40, 140]); shakeScreen(true); flashScreen("#050308");
      log(hz.line, "dmg");
      runCount("pits");
      G._walkAbort = true;            // 歩いている途中なら、前の階の経路をここで捨てる
      G.anim = { busy: true };        // 落ちきるまで操作を受けない
      setTimeout(() => { G.anim = null; if (G.state === "board" && inDungeon()) descend({ fall: true }); }, 420);
      break;
    }
    case "poison": {
      // 蝕む床 (その土地の床 — 毒の沼・灼けた床・凍てつく床…。floorhaz.js)。仕組みはどれも同じ
      const hz = harmHaz();
      // 浮遊: 床に足が触れない
      if (floatLeft() > 0) { log(`${hz.name}だ。宙に浮いたまま、触れずに渡った。`, "sys"); break; }
      // 踏むたびに隊の全員を蝕む。悪路渡り (隠修士のパッシブ poisonFloor) で半減/無効
      const resist = partyPassiveLv("poisonFloor");
      if (resist >= 2) {
        if (resist >= 3) { // Lv3: 無効化に加え、渡るたび隊の全員をHP2%回復
          let healed = false;
          for (const p of G.party) { if (!p.alive) continue; const h = Math.max(1, Math.ceil(p.maxhp * 0.02)); if (p.hp < p.maxhp) { p.hp = Math.min(p.maxhp, p.hp + h); healed = true; } }
          log(healed ? `${hz.name}を足さばきひとつで渡った。足の運びが冴え、隊の傷が癒えた。` : `${hz.name}を足さばきひとつで渡った。`, "sys");
          if (healed) renderParty();
        } else {
          log(`${hz.name}だ。だが足の置き場を見切り、無傷で渡った。`, "sys");
        }
        break;
      }
      SFX.trap(); buzz([0, 40, 30, 40]);
      flashScreen(hz.flash);
      // 床ダメージ率: 基本5% + 層に応じて微増 (層1=5% → 層20≈10.7%, 上限12%)。
      // 深層ほど足元の害が脅威であり続けるようにする。
      const layer = activeCfg().layer || 1;
      const pct = Math.min(0.12, 0.05 + (layer - 1) * 0.003);
      // 毒消しの書きつけ (手がかりの恵み miasma): 毒を含む床 (toxic) で受けるダメージが半分 (悪路渡り Lv1 とは重ねて掛かる)
      const ward = (hz.toxic && clueBoon("miasma")) || G.party.some((p) => p.alive && p.gearMisc && p.gearMisc.mudGuard); // 泥除けの (追加の特性) は書きつけと重ならない
      let anyDeath = false;
      const fallen = [], hurt = [];
      for (const p of G.party) {
        if (!p.alive) continue;
        let dmg = Math.max(1, Math.ceil(p.maxhp * pct));
        if (resist === 1) dmg = Math.max(1, Math.ceil(dmg * 0.5));
        if (ward) dmg = Math.max(1, Math.ceil(dmg * 0.5));
        p.hp = Math.max(0, p.hp - dmg);
        hurt.push(p);
        if (p.hp === 0) { p.alive = false; anyDeath = true; fallen.push(p.name); log(`${p.name}は${hz.die}`, "dmg"); }
      }
      const note = `${resist === 1 ? " (悪路渡りで半減)" : ""}${ward ? " (毒消しの心得で半減)" : ""}`;
      log(`${hz.name}だ！ 隊の全員が${hz.verb}${note}`, "dmg");
      flashPartyCards(hurt, "hit");
      if (!anyDeath) {
        // 軽い痛手はトーストと札の明滅だけ (歩みを止めない)
        showToast(`${hz.name} ― 隊の全員が${hz.verb}${note}`, { noLog: true, tone: "bad", icon: ICONS.poison });
        break;
      }
      // 倒れた者が出た時だけ札で知らせる
      showEvent({
        sprite: ICONS.poison, title: `${hz.name}！`, accent: hz.accent, banner: "⚠ 危険 ⚠",
        lines: [`隊の全員が${hz.verb}${note}…`, ...fallen.map((n) => `${n}は${hz.die}`)],
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
      if (!cell.fountainKind) cell.fountainKind = random() < 0.25 ? "dark" : "pure";
      if (cell.fountainKind === "dark") {
        showChoice("黒い泉が湧いている。底が見えない…", [
          { label: "飲む ― 大いなる恵み / 呪いの危険", danger: true, fn: () => useDarkFountain(cell) },
          { label: "近寄らない", fn: () => { log("黒い泉には触れなかった。", "sys"); renderBoard(); } },
        ], ICONS.fountain, { banner: "⚠ 黒い泉 ⚠", accent: "#8a2be2", logAs: true, lines: ["五分の賭けだ。恵みなら全快して ✦Soul を得る。呪いなら生気を吸われる。"] });
        break;
      }
      const veiled = cell.fountainKind === "veiled"; // 雲間の泉: 3つに1つは呪い (飲むまでわからない)
      // §7 M4: 皆が満ちている (HP/MP満タン・状態異常なし) なら問わない。泉はそのまま残り、後で使える
      const needs = G.party.some((p) => p.alive && (p.hp < p.maxhp || p.mp < p.maxmp || p.ailment));
      if (!needs) {
        log("癒しの泉だ。いまは皆満ちている。泉はそのまま残した。", "sys");
        showToast("癒しの泉 ― 皆満ちている (後で使える)", { noLog: true, tone: "info", icon: ICONS.fountain });
        break;
      }
      // 利用するか選べる。今使わなくても泉は残り、後から再訪して使える。
      showChoice("癒しの泉が湧いている。", [
        { label: veiled ? "泉を利用する ― 呪いの危険" : "泉を利用する", primary: !veiled, danger: veiled, fn: () => (veiled ? useVeiledFountain(cell) : useFountain(cell)) },
        { label: "今はやめておく", fn: () => { log("泉はそのままにした。後で使える。", "sys"); renderBoard(); } },
      ], ICONS.fountain, { banner: "✦ 癒しの泉 ✦", accent: "#5fb8d6", logAs: true, lines: veiled
        ? ["HPとMPが回復し、毒も癒える。一度きり。", `だがこの庭の泉は、${Math.round(1 / VEILED_CURSE)}つに1つが雷雲の澱みで呪われている。飲むまでわからない。`]
        : ["HPとMPが回復し、毒も癒える。一度きり。"] });
      break;
    }
    case "corpse": {
      if (cell.cleared) break;
      resolveCorpse(cell);
      break;
    }
    case "stairs":
      // 一度「まだ探索する」を選んだ階段は、オート移動が行き先へ向かう途中で踏んでも問い直さない
      if (cell.stairsSeen && autoPlanStep) break;
      if (cell.gate && !abyssActive()) askGate(cell);
      else askDescend(cell);
      break;
    case "story":
      if (cell.cleared) break;
      runStoryCell(cell);
      break;
    case "event":
      if (cell.cleared) break;
      runEvent(evApi, cell);
      break;
  }
}

// ===== 迷宮のイベント (出来事マス) — src/events.js の定義を盤面・戦闘・報酬へつなぐ =====
// 状態: G.events (見聞録・一度きり・恒久の恵み / 保存) ・ G.run.ev (この出撃) ・ G.board.ev (この階)
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
  // 推奨Lv の普通の1戦 (levelcurve.js refSoul / refGold)。戦闘の金貨は endBattle で ×2 → runGainGold で ×0.5 なので、金貨は ×2 の値
  const lv = levelHere().lv;
  return { gold: Math.max(6, refGold(lv) * 2), soul: Math.max(3, refSoul(lv)) };
}
const evJit = () => 0.85 + random() * 0.3;
// 出来事で得る ✦Soul の倍率 (2026-10-11 ユーザーの指示「イベントで入手できる soul が多すぎる」: 常の謎かけ1つで戦闘1回より多く入った)。
// 選択肢の ✦ (A.soul)・見聞録の初見・誓い/坑夫の頼みに掛ける。払う ✦ (soulCost)・金貨はそのまま。無限迷宮の出来事は無限迷宮の育ちの表で決めたので掛けない
const EV_SOUL_K = 0.5;
const evSoulK = () => (abyssActive() ? 1 : EV_SOUL_K);
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
// 写し身 (鏡の影): 人業の能力 (STR〜LUK)・武器の攻撃性能・会心・連撃・吸血・属性の攻防・抵抗値・MP・技までそのまま写す。
//  ratio は体 (最大HP) の割合だけ (2026-10 ユーザーの指示: 能力まで割っていたので、守りを差し引くと打撃がほとんど通らず弱すぎた)
function evShadow(p, ratio) {
  const e = spawnEliteEnemies(evPoolKey(), enemyScale())[0];
  const spr = evShadeSprite(p);
  e.key = "ev_shade";
  e.mon = { name: `${p.name}の影`, race: "specter", rank: 1, palette: spr.palette, art: spr.art, desc: "鏡に映った己の影。力も技も、写した者と変わらない。" };
  if (spr.photo) Object.assign(e.mon, { photo: spr.photo, w: spr.w, h: spr.h, shade: true });
  e.name = `${p.name}の影`;
  e.maxhp = e.hp = Math.max(1, Math.round((p.maxhp || 10) * ratio));
  e.maxmp = e.mp = Math.max(0, p.maxmp || 0);
  for (const k of ["atk", "vit", "agi", "int", "pie", "luk"]) e[k] = Math.max(k === "vit" ? 0 : 1, p[k] || 0);
  e.wScale = p.wScale ? { ...p.wScale } : null; // 武器の参照式 (攻撃力 = 写した能力 × 係数)
  e._partyScale = true; e._agiScaled = true; // AGI は味方の規模のまま (手番・回避・逃走とも写した者と同じ)
  const ef = p.eff || {};
  e.critBonus = p.critBonus || 0;
  e.multistrike = ef.multistrike || 0;
  e.lifesteal = ef.lifesteal || 0;
  e.guard = ef.guard || 0;
  e.elemAtk = p.elemAtk ? { ...p.elemAtk } : null;
  e.elemDef = p.elemDef ? { ...p.elemDef } : null;
  e.resists = { ...(p.resists || {}) };
  e.physResist = p.physResist || 0; e.magResist = p.magResist || 0;
  if (e.physResist >= 100 && e.magResist >= 100) e.magResist = e.resists.magResist = 75; // 両方の無効は倒せなくなるので魔法を通す
  e.soulMp = p.soulMp || 0; // 魂の格 (技の消費MPと威力)
  e.mimic = autoSkills(p).filter((k) => { const sp = SPELLS[k]; return sp && ((sp.kind === "phys" || sp.kind === "atk") && (sp.power || 0) > 0 && !sp.gravity || healsHp(sp)); });
  e.soul = Math.round((e.soul || 1) * 1.5);
  e.ability = null; e.magWeak = 1; e.regen = 0; e.evasive = false;
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
    if (sp.elite && abyssActive()) { const e = infEliteFoes(sp.key && MONSTERS[sp.key] ? sp.key : infFoeKey(3) || evPoolKey())[0]; if (sp.strong) evBoost(e, sp.strong); out.push(e); continue; } // 無限迷宮: その階の雑魚を育てた強敵
    if (sp.elite) { out.push(...soloFoes(spawnEliteEnemies(sp.key && MONSTERS[sp.key] ? sp.key : eliteKey(), soloScale() * (sp.strong || 1)))); continue; }
    // 出来事の魔物: その階の雑魚の最上位ランク + ranked の体で現れる (ミミックと同じ基準 mimicRef)
    if (sp.ranked && sp.key && MONSTERS[sp.key]) { const e = soloFoes(spawnRanked(sp.key, mimicRef().rank, sp.ranked, soloScale()))[0]; if (sp.name) e.name = sp.name; out.push(e); continue; }
    const key = sp.key && MONSTERS[sp.key] ? sp.key : (sp.undead ? undeadKeyForDungeon() : evPoolKey());
    if (sp.strong) { const e = evBoost(soloFoes(spawnEliteEnemies(key, soloScale()))[0], sp.strong); if (sp.name) e.name = sp.name; out.push(e); continue; }
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
  const on = inDungeon(); // 無限迷宮でも出来事の加護は効く (極の恵みは evBoon が外す)
  const inf = abyssActive();
  const rv = on ? evRun() : {};
  let dmg = 1;
  const prey = []; // 種族特効は出来事ごとに重ねる (この出撃の特効が、この階の別の特効で消えないように)
  if (on) for (const d of activeModifierDefs()) { if (d.dmgMul) dmg *= d.dmgMul; if (d.prey) prey.push(d.prey); }
  const permDmg = evBoon("temper", "dmgMul", 1), permCrit = evBoon("blackCat", "crit", 0); // 極の恵み (どの戦闘でも)
  for (const p of G.party) {
    p._evDmg = (on ? dmg * (rv.ruby && rv.ruby === p.uid ? 1.15 : 1) : 1) * permDmg;
    p._evPrey = on && prey.length ? prey : null;
    p._evCrit = (on ? (rv.crit || 0) : 0) + permCrit;
    p._evEDef = on ? (rv.edef || null) : null;
    p._evSave = !!(on && rv.saves && rv.saves[p.uid]);
  }
  if (!on) return;
  if (rv.startHeal > 0) {
    rv.startHeal--;
    for (const p of evAlive()) p.hp = Math.min(p.maxhp, p.hp + Math.ceil(p.maxhp * 0.10));
    log(inf ? "出来事で得た加護が、戦いの前に傷を癒した。" : "喪服の女の祝福が、戦いの前に傷を癒した。", "heal");
  }
  if (rv.bomb > 0) {
    rv.bomb--;
    for (const e of enemies) e.hp = Math.max(1, e.hp - Math.ceil(e.maxhp * (e.boss ? 0.12 : 0.30)));
    log("発破が炸裂した！ 敵全体が爆風に呑まれた。", "win");
    setTimeout(() => showToast("💥 発破が炸裂 ― 敵全体に痛打", { noLog: true, tone: "gold" }), 300);
  }
  const bw = G.events && G.events.flags && G.events.flags.bossWeak;
  if (isBoss && !inf && bw && bw[battleLayer()]) {
    for (const e of enemies) if (e.boss) { e.maxhp = Math.max(1, Math.round(e.maxhp * 0.9)); e.hp = Math.min(e.hp, e.maxhp); }
    log(battleLayer() === 1 ? "告解室で聞いた秘密が、主の守りの綻びを教えてくれる。(主の最大HP -10%)" : "迷宮で聞いた主の弱みが、守りの綻びを教えてくれる。(主の最大HP -10%)", "win");
  }
}
// 戦闘の後: 墓碑の加護の消費を記録し、紅玉に血を吸わせる
function evBattleEnd(won) {
  if (!inDungeon() || !G.run || !G.run.ev) return;
  const rv = G.run.ev;
  if (rv.saves) for (const p of G.party) if (rv.saves[p.uid] && !p._evSave) delete rv.saves[p.uid];
  if (won && rv.ruby) {
    const h = G.party.find((p) => p.uid === rv.ruby && p.alive);
    if (h) { h.hp = Math.max(1, h.hp - Math.ceil(h.maxhp * 0.05)); log(`紅玉が${h.name}の血を吸った。`, "dmg"); }
  }
}
// 階の情報 (手帳) に並べる、いま効いている出来事の効果
function eventFacts() {
  if (!inDungeon()) return [];
  const inf = abyssActive(); // 無限迷宮: 風の掟は手帳の別の行に出る。極の恵みは乗せない
  const out = [];
  const ic = ICONS.event;
  const fe = (G.board && G.board.ev) || {};
  const fl = (G.events && G.events.flags) || {};
  // 迷宮の掟 (この迷宮のあいだずっと)
  const tr = inf ? null : dungeonTrait();
  if (tr) out.push({ tone: "gold", icon: ICONS.portal, title: `迷宮の掟「${tr.name}」`, accent: tr.accent || "#c9a26a", lines: tr.lines });
  // 浮遊の術 (出来事ではないが、いまの階の性質として並べる)
  if (floatLeft() > 0) out.push({ tone: "gold", icon: ICONS.portal, title: "浮遊", accent: "#8fd0c8", lines: [`隊は宙に浮いている (この階を含めて残り${floatLeft()}階)。${floatGuardText()}。`] });
  // 足元の仕掛け (その土地の名で): 見えている落ちる床・蝕む床
  const pits = evCells((c) => c.type === "pit" && c.revealed).length;
  if (pits) { const hz = fallHaz(); out.push({ tone: "bad", icon: ICONS.trap, title: hz.name, accent: "#8a8070", lines: [`見えている${hz.name} ${pits}か所。踏むと1階下へ落ちる (傷は負わない。オート移動は避けて通る)。`] }); }
  const harms = evCells((c) => c.type === "poison" && c.revealed).length;
  if (harms) { const hz = harmHaz(); out.push({ tone: "bad", icon: ICONS.poison, title: hz.name, accent: hz.accent, lines: [`見えている${hz.name} ${harms}か所。踏むと隊の全員が${hz.verb.replace(/た$/, "る")} (浮遊・悪路渡りで避けられる)。`] }); }
  const perm = inf ? [] : Object.keys(EV_BOONS).filter((k) => fl[k] && (k !== "sewerMap" || battleLayer() === 2)).map((k) => EV_BOONS[k].text);
  for (const e of Object.values(EVENT_MAP)) if (e.statBonus && G.events.once[e.id]) perm.push(e.boon);
  if (perm.length) out.push({ tone: "gold", icon: ic, title: "極の恵み (恒久)", accent: "#ffcf4a", lines: perm });
  for (const m of fe.mods || []) out.push({ tone: m.enemyMul ? "bad" : "gold", icon: ic, title: `出来事「${m.name}」`, accent: "#c08aff", lines: [m.desc] });
  if (fe.oath && !fe.oath.done) out.push({ tone: "gold", icon: ic, title: "誓いの最中", accent: "#c08aff", lines: [`この階の魔物をすべて討て (残り ${evCells((c) => c.type === "monster" && !c.cleared).length}体)`, "果たさずに降りると、次の階の敵が手強くなる。"] });
  if (fe.miner && !fe.minerDone) out.push({ tone: "gold", icon: ICONS.corpse, title: "坑夫の頼み", accent: "#c08aff", lines: [`この階の亡骸をすべて調べよ (残り ${evCells((c) => c.type === "corpse" && !c.cleared).length}体)`] });
  const rv = (G.run && G.run.ev) || null;
  if (!rv) return out;
  for (const m of rv.mods || []) out.push({ tone: m.enemyMul ? "bad" : "gold", icon: ic, title: `出来事「${m.name}」`, accent: "#c08aff", lines: [m.desc] });
  const runLines = [];
  if (rv.preempt > 0) runLines.push(`${inf ? "出来事の備え" : "祈りのろうそく"} ― 次の戦闘は必ず先制 (${rv.preempt}回)`);
  if (rv.ambushNext > 0) runLines.push(`${inf ? "待ち伏せ" : "密輸人の待ち伏せ"} ― 次の戦闘は奇襲される`);
  if (rv.startHeal > 0) runLines.push(`${inf ? "加護" : "喪服の女の祝福"} ― 開戦時にHP10%回復 (残り${rv.startHeal}戦)`);
  if (rv.bomb > 0) runLines.push(`発破 ― 次の戦闘の開幕に敵全体へ痛打 (${rv.bomb}回)`);
  if (rv.crit) runLines.push(`${inf ? "冴え" : "会心の冴え"} ― 会心率 +${Math.round(rv.crit * 100)}%`);
  if (rv.edef) { const el = (ELEMENTS[rv.edef.el] || {}).label || rv.edef.el; runLines.push(`${el}の守り ― 全員に${el}の属防Lv${rv.edef.lv}`); }
  if (rv.ruby) { const h = G.party.find((p) => p.uid === rv.ruby); if (h) runLines.push(`呪われた紅玉 ― ${h.name}の与ダメ+15% (戦闘のたび血を吸われる)`); }
  if (rv.saves) { const n = G.party.filter((p) => rv.saves[p.uid]).map((p) => p.name); if (n.length) runLines.push(`名を刻んだ墓碑 ― ${n.join("・")}は一度だけ死を免れる`); }
  if (rv.noBeast) runLines.push("鼠の王の盟約 ― 獣の魔物が寄りつかない");
  if (rv.mapChest > 0) runLines.push("宝の地図 ― 次の階に印の付いた宝箱");
  if (rv.bounty) runLines.push(`密輸の証拠 ― 生きて帰れば報奨金 💰${rv.bounty}`);
  if (rv.forceElite) runLines.push("縦穴の底 ― 次の階は強敵階");
  if (runLines.length) out.push({ tone: "gold", icon: ic, title: "この出撃の出来事", accent: "#c08aff", lines: runLines });
  return out;
}

// 無限迷宮の階に出来事が置かれる確率 (無限迷宮だけの出来事 src/infevents.js)。0.6 の1.2倍 (2026-10-12 ユーザーの指示)。
// 出来事は空いた行き止まりに置くので、ほかのマスは減らない
const INF_EV_FLOOR_RATE = 0.6 * 1.2;
// 階が変わった時: 持ち越しの効果を適用し、出来事を1つ置く (確率)
function evNewFloor() {
  if (activeCfg().noEvents) return;
  if (!G.board) return;
  const inf = abyssActive(); // 無限迷宮には無限迷宮だけの出来事 (infevents.js) を置く
  G.board.ev = { mods: [] };
  const rv = evRun();
  if (Array.isArray(rv.nextFloorMods) && rv.nextFloorMods.length) { G.board.ev.mods.push(...rv.nextFloorMods); rv.nextFloorMods = []; }
  if (rv.mapChest > 0) { rv.mapChest--; if (evPlaceChest({ rankUp: 2, reveal: true, mark: true })) log("地図の×印 ― この階のどこかに宝箱が眠っている (印が見えている)。", "win"); }
  if (rv.noBeast) evPurgeBeasts();
  if (!inf && G.events.flags.sewerMap && battleLayer() === 2) evRevealStairs();
  const cfg = activeCfg();
  const lv = levelHere().lv, layer = battleLayer();
  const first = !inf && cfg.id === WORLD_IDS[0]; // 最初の迷宮 (入門)
  if (random() >= (first ? EV_FLOOR_RATE_D1 : inf ? INF_EV_FLOOR_RATE : EV_FLOOR_RATE)) return;
  const sx = G.board.start.x, sy = G.board.start.y;
  const ok = (c, x, y) => c.type === "empty" && !(x === sx && y === sy);
  let cand = [];
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) { const c = G.board.cells[y][x]; if (ok(c, x, y) && sfOpenCount(c) === 1) cand.push(c); }
  if (!cand.length) for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) { const c = G.board.cells[y][x]; if (ok(c, x, y) && Math.abs(x - sx) + Math.abs(y - sy) >= 3) cand.push(c); }
  if (!cand.length) return;
  const st = { dungeonId: cfg.id, layer, lv, first, abyss: inf, floor: G.floor, floors: inf ? 9999 : cfg.floors || 3, runEv: rv, onceDone: (e) => !!G.events.once[onceKey(e, layer)] };
  // 義賊のパッシブ 義の巡り合わせ (brigandMeguri): 極めて稀なる出来事の出る確率 Lv1 = 2倍 / Lv2 = 3倍 (隊で一番高い Lv)
  const meguri = partyPassiveLv("brigandMeguri");
  const e = pickEvent(eligibleEvents(st, evApi), { mythicMul: meguri ? Math.min(2, meguri) + 1 : 1 });
  if (!e) return;
  const cell = cand[rand(cand.length)];
  cell.type = "event"; cell.evId = e.id; cell.cleared = false;
  if (e.tier === "rare") rv.rareUsed = { ...(rv.rareUsed || {}), [e.id]: true };
  if (e.setup) e.setup(evApi, cell);
}
// ===== 物語マス (src/story.js STORY_CELLS) =====
// 決まった迷宮の決まった階に、見つけるまで毎回置く。最初から表を向いて淡く光る (見落とさないように)。
// 踏むと一枚絵つきの語り → 手がかりを記録し、条件 (story) の迷宮を地図に載せる
function storyNewFloor() {
  if (abyssActive() || !G.board) return;
  const cfg = curDungeon();
  const key = storyCellAt(cfg.id, G.floor);
  if (!key || worldState().found[key] || (STORY_CELLS[key].prologue && !prologueActive())) return;
  // 再開時にも呼ぶ。配置済みなら、盤面や乱数を変えずに残す。
  if (G.board.cells.flat().some((c) => c.type === "story" && c.storyKey === key && !c.cleared)) return;
  const sx = G.board.start.x, sy = G.board.start.y;
  const free = (c, x, y) => !(x === sx && y === sy) && !(x === G.px && y === G.py);
  const ok = (c, x, y) => c.type === "empty" && free(c, x, y);
  const pick = (pred) => { const out = []; for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) { const c = G.board.cells[y][x]; if (ok(c, x, y) && pred(c, x, y)) out.push(c); } return out; };
  // 遠い行き止まり → 遠いマス → どこでも
  let cand = pick((c, x, y) => sfOpenCount(c) === 1 && Math.abs(x - sx) + Math.abs(y - sy) >= 4);
  if (!cand.length) cand = pick((c, x, y) => Math.abs(x - sx) + Math.abs(y - sy) >= 3);
  if (!cand.length) cand = pick(() => true);
  // 古い盤面に空きが無くても、階段・帰還陣・出来事・強敵を残して手がかりを補う。
  if (!cand.length) {
    for (const types of [["trap", "poison", "pit"], ["monster"], ["corpse", "chest", "fountain"]]) {
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
        const c = G.board.cells[y][x];
        if (free(c, x, y) && types.includes(c.type) && !c.elite) cand.push(c);
      }
      if (cand.length) break;
    }
  }
  if (!cand.length) return;
  const cell = cand[rand(cand.length)];
  // 置き換えた札の固有データを残さない (壁はそのまま)。
  const walls = cell.walls;
  for (const prop of Object.keys(cell)) delete cell[prop];
  Object.assign(cell, { walls, type: "story", storyKey: key, cleared: false, revealed: true });
  log(`この階のどこかに、確かめるべきものがある。`, "win");
}
function runStoryCell(cell) {
  const key = cell.storyKey;
  const def = STORY_CELLS[key];
  if (!def) { cell.cleared = true; cell.type = "empty"; renderBoard(); return; }
  const w = worldState();
  SFX.itemget(); buzz([0, 30, 60, 30]);
  // 手がかりの恵み: 迷宮が開く手がかりは本文に「新たな迷宮」の行があるので、それ以外だけ最後に一行足す
  const boon = def.boon && def.boon.kind !== "dungeon" ? [`── 手がかりの恵み: ${def.boon.text}`] : [];
  UI.playStoryChain([{ title: def.title, lines: [...storyLines(def.lines), ...boon], art: def.art, photo: key === "w01_lantern" ? null : storyImage(key), who: "none", kicker: def.prologue ? "人業の発見" : "師の手がかり", btnLabel: "胸に刻む" }], () => {
    w.found[key] = 1;
    if (prologueActive() && key === "forest_doll") prologue().phase = "fourth";
    if (prologueActive() && key === "w02_broken_doll") prologue().phase = "sixth";
    w.last = { kind: "cell", key };
    cell.cleared = true; cell.type = "empty";
    syncClueBoons();
    log(`${def.toast || def.name}。`, "win");
    if (def.boon && def.boon.kind !== "dungeon") log(`手がかりの恵み: ${def.boon.text}`, "win");
    showToast(`✦ ${def.toast || def.name}`, { noLog: true, tone: "good" });
    announceNewDungeons(refreshWorldUnlocks());
    autosave(true);
    renderBoard();
  });
}
// ===== 手がかりの恵み (story.js STORY_CELLS の boon) =====
// 効き目は「その手がかりを見つけたか (world.found)」からそのつど引く。見つけた後に足した恵みも旧セーブに効く
function clueBoon(kind) {
  if (abyssActive()) return false; // 無限迷宮には手がかりの恵みを乗せない (docs/infinite-labyrinth.md 4章)
  const found = (G.world && G.world.found) || {};
  for (const k in STORY_CELLS) if (found[k] && STORY_CELLS[k].boon && STORY_CELLS[k].boon.kind === kind) return true;
  return false;
}
// 胸の扉の覚え書き (evade): 隊の全員の回避率 +1% (combat.js setPartyEvadeBonus)
const CLUE_EVADE = 0.01;
// 雷よけの書きつけ (breathWard): 隊の全員のブレス耐性 +5% (combat.js setPartyBreathBonus。装備のブレス耐性と合わせて上限 50%)
const CLUE_BREATH = 0.05;
// 暗がりの目 (eyes): 隊の全員の物理が外れる率 −2ポイント (combat.js setPartyHitBonus)
const CLUE_HIT = 0.02;
// セラの囁き (soulEcho): 迷宮で職業の魂を拾った時、この確率でもう一つ拾える (grantSoulQuiet)
const SOUL_ECHO_RATE = 0.05;
function syncClueBoons() {
  setPartyEvadeBonus(clueBoon("evade") ? CLUE_EVADE : 0);
  setPartyBreathBonus(clueBoon("breathWard") ? CLUE_BREATH : 0);
  setPartyHitBonus(clueBoon("eyes") ? CLUE_HIT : 0);
  restockElixirs();
}
function stabilityMinutes() { return Math.round(stabilityRecoveryMs() / 60000); }
// 霊薬の帳面 (elixir): 魂を使わない霊薬が、商会の棚にいつも並ぶ (街に戻るたびに棚を満たす)
const ELIXIR_STOCK = ["u_life_spring", "u_moonwell_water", "u_elixir"];
function restockElixirs() {
  if (!clueBoon("elixir") || !G.shopStock) return;
  for (const id of ELIXIR_STOCK) if (ITEMS[id]) G.shopStock[id] = Math.max(G.shopStock[id] || 0, 5);
}

// ===== セラ (師の作った人業) =====
// 腕・頭・胴・脚がそろい、館の語り「セラの目覚め」(IRENE_BEATS effect: seraJoin) を聞くと仲間になる。
// メイン魂はセラだけの専用職「灯守」(souls.js SOUL_CLASSES.sera) に固定 (外せない・付け替えられない)。サブ魂は自由。
// 肖像は灯守の絵に固定 (面影の写しも効かない)。器 (doll.vessel = "sera") も魂の安定度を消費する。
// 灯守のランク = 魂の count。物語の節目で上がる (seraRankTarget)。Lv は ✦Soul で上げる (ほかの魂と同じ)
function seraDoll() { return allDolls().find((d) => d && d.vessel === "sera") || null; }
function seraSoul() { return G.souls.find((s) => s && s.clsKey === "sera") || null; }
// セラまわりの差し口の制限 (soulSlotConflict から)
function seraSlotBlocked(d, soul, slotId) {
  if (isUniqueJob(soul.clsKey)) return !(d && d.vessel === "sera" && slotId === "primary");
  return !!(d && d.vessel === "sera" && slotId === "primary");
}
// 灯守のランクの目標: 目覚め 1 / 継ぎ目の締め直し (焼かれた人業の殻) 2 / 奈落を前にした館の語り 3 (第六章から先で 4・5)
const SERA_RANK_BEATS = ["irene_husks", "irene_abyss", "irene_crest"];
function seraRankTarget() {
  const b = worldState().beats;
  return Math.min(5, 1 + SERA_RANK_BEATS.filter((id) => b[id]).length);
}
// 灯守の魂を物語の進みに合わせる (読み込み時・館の語りの後)。上がったら true
function syncSeraSoul() {
  const d = seraDoll();
  if (!d) return false;
  let s = soulByUid(d.primary);
  // 旧版 (どの魂でも宿せた頃) のセラ: 灯守の魂へ宿し直し、前の魂は手元に戻す
  let moved = false;
  if (!s || s.clsKey !== "sera") {
    s = seraSoul() || addSoulInstance("sera", 1, seraStartLevel());
    d.primary = s.uid;
    moved = true;
  }
  const want = seraRankTarget();
  const up = (s.count || 1) < want;
  if (up) { s.count = want; settleSoulExp(s); } // ランクで伸びた上限まで、蓄積していた exp を注ぐ
  s.locked = true;
  if (up || moved) { recalcDoll(d); if (moved) { d.hp = d.maxhp; d.mp = d.maxmp; } }
  return up;
}
// 目覚めた時の灯守の Lv: 隊のメイン魂の平均 (ランク1の上限まで)
function seraStartLevel() {
  const lv = G.party.map((p) => soulByUid(p.primary)).filter(Boolean).map((x) => x.level || 1);
  const avg = lv.length ? Math.round(lv.reduce((a, b) => a + b, 0) / lv.length) : 1;
  return Math.max(1, Math.min(soulLevelCap("sera", 1), avg));
}
function seraJoin() {
  let d = seraDoll();
  if (!d) {
    d = makeDoll("セラ");
    d.vessel = "sera";
    const s = seraSoul() || addSoulInstance("sera", seraRankTarget(), seraStartLevel());
    s.locked = true;
    d.primary = s.uid;
    recalcDoll(d);
    d.hp = d.maxhp; d.mp = d.maxmp;
    if (G.party.length < 6) G.party.push(d);
    else { G.reserve.push(d); log("セラは控えで待機する。館で隊と入れ替えられる。", "sys"); }
    if (!G.codex.job) G.codex.job = {};
    codexSweepJobs();
    log(`人業「セラ」が目を覚ました。灯守 Lv${s.level}。師の作った器も、魂の安定度を消費する。`, "win");
    showToast("セラが仲間に加わった", { noLog: true, tone: "good" });
    SFX.itemget(); buzz([0, 30, 60, 30]);
  }
  syncSeraSoul();
  autosave(true);
  return d;
}
// 館の語りで灯守のランクが上がる (IRENE_BEATS effect: seraRank)
function seraRankUp() {
  const d = seraDoll();
  if (!d) return;
  const before = d.jobRank || 1;
  const s0 = soulByUid(d.primary);
  const fromCap = s0 ? soulLevelCapOf(s0) : 0;
  if (!syncSeraSoul()) return;
  recalcAllDolls({ levelUp: true });
  const s1 = soulByUid(d.primary);
  log(`セラの魂がランク${d.jobRank}になった (${d.cls})。`, "win");
  if ((d.jobRank || 1) > before) showRankUp({ clsKey: "sera", fromRank: before, toRank: d.jobRank, toCount: s1.count, fromCap, toCap: soulLevelCapOf(s1) });
}
// 赤い魂1つで回復する安定度
function stabilityPerRed() { return 1; }
// 館の語り (イレーヌ): 要る手がかりを見つけていて、まだ語っていないもの
//   beat = 先に語っておく語り (セラが目覚めてから、など)
function pendingIreneBeat() {
  if (prologueActive()) return null;
  // 試遊は選択した場面だけ。準備用の報告済み状態から別の語りを始めない。
  if (G.testPlay) return null;
  const w = worldState();
  return IRENE_BEATS.find((b) => !w.beats[b.id] && (!b.need || (Array.isArray(b.need) ? b.need : [b.need]).every((key) => w.found[key])) && (!b.after || w.reported[b.after]) && (!b.beat || w.beats[b.beat]) && (!b.flag || w[b.flag] === 1)) || null;
}
// 館に入った時に語る (party.js から)。語ったら true
function playIreneBeat(done) {
  const b = pendingIreneBeat();
  if (!b) return false;
  const w = worldState();
  UI.playStoryChain([{ title: b.title, lines: storyLines(b.lines), art: b.art, photo: storyImage(b.id), who: "irene", kicker: "人業の館", btnLabel: "うなずく" }], () => {
    w.beats[b.id] = 1;
    w.last = { kind: "irene", id: b.id };
    if (b.flag) w[b.flag] = 0;
    if (b.effect === "seraJoin") seraJoin();
    if (b.effect === "seraRank") seraRankUp();
    autosave(true);
    if (done) done();
    if (UI.queueStoryNotice) UI.queueStoryNotice(); // 語りで記された物語を知らせる
  });
  return true;
}

// 階段を降りる時: 果たしていない誓いは次の階で報いとなる
function evOnDescend() {
  const fe = G.board && G.board.ev;
  if (!fe || !fe.oath || fe.oath.done) return;
  const rv = evRun();
  rv.nextFloorMods = [...(rv.nextFloorMods || []), { src: "oath", name: "破られた誓い", desc: "敵の力 1.2倍 (この階)", enemyMul: 1.2 }];
  fe.oath.done = true;
  log("誓いを果たさずに降りた……石碑の呪いが後を追ってくる。(次の階の敵の力 1.2倍)", "dmg");
  showToast("誓いを破った ― 次の階の敵が手強い", { noLog: true, tone: "bad" });
}
// 誓い (石碑)・頼み (坑夫) の達成を確かめる (1歩ごと・戦闘の後)
function evProgress() {
  const fe = G.board && G.board.ev;
  if (!fe || abyssActive()) return;
  if (fe.oath && !fe.oath.done && !evCells((c) => c.type === "monster" && !c.cleared).length) {
    fe.oath.done = true;
    const stone = evCells((c) => c.type === "event" && c.evOath)[0];
    const u = evUnit();
    const s = runGainSoulPts(Math.round(u.soul * 4 * evSoulK() * evJit()), "ev");
    if (stone) { stone.type = "chest"; stone.cleared = false; stone.revealed = true; stone.cRank = Math.min(5, chestRankOf(null) + 2); delete stone.evOath; }
    SFX.victory(); flashScreen("#ffd84a"); updateTopbar();
    log(`誓いを果たした！ ✦${s} Soul を授かり、石碑は祝福の宝箱に変わった。`, "win");
    showToast(`誓いを果たした ― ✦${s} ・ 石碑が宝箱に`, { noLog: true, tone: "gold", icon: ICONS.chest });
    renderBoard();
  }
  if (fe.miner && !fe.minerDone && !evCells((c) => c.type === "corpse" && !c.cleared).length) {
    fe.minerDone = true;
    for (const c of evCells((c) => c.type === "event" && c.evQuest)) { c.cleared = true; delete c.evQuest; }
    const u = evUnit();
    const s = runGainSoulPts(Math.round(u.soul * 4 * evSoulK() * evJit()), "ev");
    G.embers = (G.embers || 0) + 1; runCount("embers", 1);
    SFX.victory(); updateTopbar();
    log(`坑夫の亡霊は仲間と共に眠りについた。✦${s} Soul と魂の残火を遺していった。`, "win");
    showToast(`坑夫の頼みを果たした ― ✦${s} ・ 魂の残火 ×1`, { noLog: true, tone: "gold", icon: ICONS.ember });
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
  if (tlOn()) { if (inDungeon()) tlGain(tlWhere(), "gold", pay, "ev"); else tlTownGain("gold", pay, "ev"); } // 帰還の時に払われる
  log(notes.join(" / "), "win");
  setTimeout(() => showToast(notes.join(" ・ "), { noLog: true, tone: "gold", icon: ICONS.gold }), 900);
}
// 魂の職を選ぶ (rarePlus: レア以上確定 / front: 前衛の職 / common: コモン / 既定: 死体と同じ抽選)
function evSoulClass(mode) {
  const keys = Object.keys(SOUL_CLASSES);
  const of = (rar, f) => keys.filter((k) => SOUL_CLASSES[k].rarity === rar && (!f || f(SOUL_CLASSES[k])));
  if (mode === "rarePlus") {
    const r = random();
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
  giveItemAsk(id, (got, lost) => {
    if (got) { UI.loot(got.item, got.who, { source: "chest" }, fin); return; }
    if (lost) { runLost(itemName(lost)); showToast(`持ちきれず置いてきた: ${itemName(lost)}`, { noLog: false, tone: "bad" }); }
    fin();
  });
}
function evPickMinRar(rar) {
  const order = ["c", "uc", "r", "sr"];
  const lo = Math.max(0, order.indexOf(rar));
  let k = Math.max(lo, order.indexOf(rollRarity(rarityUp({ rare: true }), random, true)));
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
  get lv() { return levelHere().lv; },
  runEv: () => evRun(),
  floorEv: () => evFloor(),
  flags: () => G.events.flags,
  recalcPermanent: () => recalcAllDolls({ levelUp: true }),
  // ---- 画面 ----
  // 選んだ手は記録に残す (「〜 ― 説明」の説明は省く。cancel の立ち去るは呼び出し側が「〜を後にした」と書く)
  choice: (title, opts, icon, o) => showChoice(title, opts.map((x) => (!x || x.cancel ? x : { ...x, fn: (...a) => { log(`▸ ${plainText(String(x.label)).split(" ― ")[0]}`, "sys"); return x.fn(...a); } })), icon, o),
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
      const s = runGainSoulPts(Math.max(1, Math.round(evUnit().soul * 0.5 * evSoulK())), "ev");
      updateTopbar();
      log(`見聞録に新たな出来事「${e.name}」を記した。(✦${s})`, "win");
      setTimeout(() => showToast(`見聞録に記した「${e.name}」 ✦${s}`, { noLog: true, tone: "gold", icon: ICONS.event }), 250);
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
    return { ok: random() < p, who: m, p };
  },
  checkDisarm() {
    const m = bestDisarmer();
    if (!m) return { ok: false, who: null, p: 0 };
    const p = disarmChance(m, 1);
    return { ok: random() < p, who: m, p };
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
  ail(m, kind) {
    if (!m || !m.alive || (m.eff && m.eff.ailmentImmune) || random() < ((m.resists && m.resists[kind]) || 0) / 100) return;
    // 眠り・魅了・混乱は戦闘の中だけの状態 (持ち越す ailment には入らない): 次の戦闘の開幕に掛かるよう覚えておく
    if (EV_BATTLE_AIL[kind]) {
      const rv = evRun(); rv.nextAil = { ...(rv.nextAil || {}), [m.uid]: kind };
      log(`${m.name}は、次の戦闘の始めに${EV_BATTLE_AIL[kind].text}に陥る。`, "dmg");
      return;
    }
    if (m.ailment) return;
    m.ailment = kind; renderParty();
  },
  ailAll(kind, ch) { for (const p of evAlive()) if (random() < ch) evApi.ail(p, kind); flashPartyCards(evAlive(), "hit"); },
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
  gold(u, from, { quiet = false } = {}) {
    const g = runGainGold(Math.round(evUnit().gold * u * evJit()), "ev");
    if (!quiet) SFX.itemget();
    updateTopbar();
    log(`${from}から 💰${g} を得た。`, "win");
    showToast(`${from}から 💰${g}`, { noLog: true, tone: "gold", icon: ICONS.gold });
    return g;
  },
  // opt.trade: 金貨・残火と量り替える取り引き (天秤など、選択肢に何倍と書いたもの) — EV_SOUL_K を掛けない
  soul(u, from, opt = {}) {
    const s = runGainSoulPts(Math.max(1, Math.round(evUnit().soul * u * (opt.trade ? 1 : evSoulK()) * evJit())), "ev");
    updateTopbar();
    log(`${from}から ✦${s} Soul を得た。`, "win");
    showToast(`${from}から ✦${s} Soul`, { noLog: true, tone: "gold", icon: ICONS.wisp });
    return s;
  },
  giveGoldRaw(n, from) { G.gold += n; if (G.run && inDungeon()) G.run.gold += n; if (tlOn() && inDungeon()) tlGain(tlWhere(), "gold", n, "ev"); updateTopbar(); log(`${from}で 💰${n} を得た。`, "win"); showToast(`${from} ― 💰${n}`, { noLog: true, tone: "gold", icon: ICONS.gold }); },
  giveSoulRaw(n, from) { G.soulPts += n; if (G.run && inDungeon()) G.run.soulPts += n; if (tlOn() && inDungeon()) tlGain(tlWhere(), "soul", n, "ev"); updateTopbar(); log(`${from}で ✦${n} Soul を得た。`, "win"); showToast(`${from} ― ✦${n}`, { noLog: true, tone: "gold", icon: ICONS.wisp }); },
  ember(n, from, quiet = false) {
    G.embers = (G.embers || 0) + n; runCount("embers", n); updateTopbar();
    log(`${from} ― 魂の残火を ${n}つ 得た。`, "win");
    if (!quiet) showToast(`${from} ― 魂の残火 ×${n}`, { noLog: true, tone: "gold", icon: ICONS.ember });
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
  itemNameOf: (id) => (ITEMS[id] && ITEMS[id].name) || id,
  // 行商人の品揃え: この深さで出る道具から n 品 (マスに覚えさせ、開き直しても変わらない)
  wares: (cell, n) => {
    if (!cell.evWares) {
      const out = [];
      for (let k = 0; k < 20 && out.length < n; k++) { const id = pickUseItem(dropCenterR({})); if (id && !out.includes(id)) out.push(id); }
      cell.evWares = out;
    }
    return cell.evWares.filter((id) => ITEMS[id]);
  },
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
    if (dest) { G.px = dest.x; G.py = dest.y; G.board.cells[dest.y][dest.x].revealed = true; renderBoard(); autosave(true); return; }
    G.px = sp.x; G.py = sp.y; renderBoard(); autosave(true);
    askDescend(st);
  },
  skipFloors(n) { descend({skip:n}); },
  // ---- 戦闘 ----
  poolKey: () => evPoolKey(),
  eliteKeyHere: () => eliteKey(),
  // 出来事の文に出す魔物の名 (まだ倒していない魔物は不確定名)
  monName: (k) => (MONSTERS[k] ? (enemyReveal({ key: k, mon: MONSTERS[k] }).name ? MONSTERS[k].name : unknownLabel(MONSTERS[k])) : "魔物"),
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
for (const key of ["healAll", "hurtAll", "hurtAllCur", "hurtOne", "mpAll", "revive"]) {
  const original = evApi[key];
  evApi[key] = (...args) => tlGameMeasure("event", () => original(...args));
}

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
function useFountain(...args) { return tlGameMeasure("fountain", () => useFountainMeasured(...args)); }
function useFountainMeasured(cell) {
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
  showToast(`癒しの泉 ― HP・MPが回復した${cured ? "・毒も浄化" : ""}`, { noLog: true, tone: "good", icon: ICONS.fountain });
  renderBoard();
}

// 黒い泉: 50% で全回復+Soulの恵み、50% で呪い (HP半減+毒)。一度きりの賭け
function useDarkFountain(...args) { return tlGameMeasure("darkFountain", () => useDarkFountainMeasured(...args)); }
function useDarkFountainMeasured(cell) {
  cell.cleared = true;
  if (random() < 0.5) {
    SFX.heal(); buzz([0, 30, 40, 30]); flashScreen("#5fb8d6");
    for (const p of G.party) if (p.alive) { p.hp = p.maxhp; p.mp = p.maxmp; p.ailment = null; }
    const bonus = runGainSoulPts(20 * (activeCfg().rank || 1), "ev");
    updateTopbar();
    log(`黒い泉は恵みをもたらした！ 全回復し、✦${bonus} Soul を得た。`, "win");
    flashPartyCards(G.party.filter((p) => p.alive), "heal");
    showToast(`深淵の恵み ― 全回復 ・ ✦${bonus}`, { noLog: true, tone: "good", icon: ICONS.fountain });
    renderBoard();
    return;
  }
  fountainCurse("黒い泉は呪いだった…！ 全員の生気が吸われた。", "深淵の呪い");
}
// 泉の呪い: 隊の全員の HP が半分 (HP1 は残る)・それぞれ 50% で毒 (黒い泉 / 雲間の泉)
function fountainCurse(line, title) {
  SFX.trap(); buzz([0, 80, 60, 80]); flashScreen("#a01030");
  let cursed = false;
  for (const p of G.party) {
    if (!p.alive) continue;
    p.hp = Math.max(1, Math.ceil(p.hp * 0.5));
    if (!p.ailment && random() < 0.5) { p.ailment = "poison"; cursed = true; }
  }
  log(line, "dmg");
  flashPartyCards(G.party.filter((p) => p.alive), "hit");
  showToast(`${title} ― 全員のHPが半減${cursed ? "・毒に侵された者も" : ""}`, { noLog: true, tone: "bad", icon: ICONS.fountain });
  renderBoard();
}
// 雲間の泉 (雲上の庭の掟): 見た目は癒しの泉。VEILED_CURSE (3つに1つ) で呪い、それ以外は癒しの泉と同じ
const VEILED_CURSE = 1 / 3;
function useVeiledFountain(...args) { return tlGameMeasure("fountain", () => useVeiledFountainMeasured(...args)); }
function useVeiledFountainMeasured(cell) {
  if (random() < VEILED_CURSE) { cell.cleared = true; fountainCurse("泉の水は雷雲の澱みで濁っていた…！ 全員の生気が吸われた。", "澱んだ泉"); return; }
  useFountainMeasured(cell);
}

// 死体: 「まだあたたかい死体」からのみ魂を回収できる (死体の職業に応じた魂)
function resolveCorpse(cell) {
  const clsKey = cell.corpseClass || "fighter";
  const clsLabel = SOUL_CLASSES[clsKey].label;
  // 偉大なる死体 (特別階「強大な気配」): 希少な職業の魂が必ず宿っている
  if (cell.corpseGreat) {
    showChoice(`偉大なる死体。尋常ならざる魂の気配がする。`, [
      { label: "魂を回収する", primary: true, fn: () => collectWarmCorpse(cell, clsKey, clsLabel) },
      { label: "立ち去る", fn: () => { cell.corpseSeen = true; log("偉大なる死体に手を触れず、立ち去った。", "sys"); renderBoard(); } }, // オート移動はもう向かわない
    ], corpseIcon(cell), { banner: "★ 偉大なる死体 ★", accent: "#ffcf4a", logAs: true, lines: ["まれに死体が目覚めて襲ってくる。勝てば魂は必ず手に入る。"] });
    return;
  }
  if (!cell.corpseWarm) {
    // 風化した死体: 調べても戦闘は起きない (損のない行為)。既定ではそのまま調べる (§7 M3。設定で問うようにできる)
    if (uiDungeonHud.getPref("autoCorpse") !== false) { investigateCorpse(cell, clsKey, clsLabel); return; }
    showChoice(`風化した死体が横たわっている。調べてみるか？`, [
      { label: "調べる", primary: true, fn: () => investigateCorpse(cell, clsKey, clsLabel) },
      { label: "立ち去る", fn: () => { cell.corpseSeen = true; log("死体には触れず、立ち去った。", "sys"); renderBoard(); } },
    ], corpseIcon(cell), { banner: "— 風化した死体 —", accent: "#8c866f", logAs: true });
    return;
  }
  // あたたかい死体: 回収するか立ち去るか選べる。立ち去れば死体は残る。
  // 宿る魂の職業は、回収するまで明かさない (札の色も職業色ではなく魂の青)
  showChoice(`まだあたたかい死体。魂が宿っている。`, [
    { label: "魂を回収する", primary: true, fn: () => collectWarmCorpse(cell, clsKey, clsLabel) },
    { label: "立ち去る", fn: () => { cell.corpseSeen = true; log("死体に手を触れず、立ち去った。", "sys"); renderBoard(); } },
  ], corpseIcon(cell), { banner: "✦ あたたかい死体 ✦", accent: "#7fd0ff", logAs: true, lines: ["まれに死体が起き上がる。勝てば魂は必ず手に入る。"] });
}

// あたたかい死体/偉大なる死体の回収: 80%で魂を直接入手、20%で死体が起き上がりアンデッド戦。
// 戦闘に勝てば魂を100%回収する (宝箱は出ない)。
// 一度起き上がった死体は cell._corpseRise を残すので、戦闘から逃げて再度調べても
// 必ずまた起き上がる (逃走→再調査で無償の魂入手を防ぐ)。
function collectWarmCorpse(cell, clsKey, clsLabel) {
  if (cell._corpseRise || random() < 0.20) {
    const great = !!cell.corpseGreat;
    const riseLine = great
      ? `偉大なる死体は目覚めて襲ってきた！`
      : `まだあたたかい死体は起き上がって襲ってきた！`;
    cell._corpseRise = true; // endBattle 側で「宝箱なし・魂回収」を分岐するための印
    log(riseLine, "dmg");
    SFX.die(); buzz([0, 40, 60, 40]);
    showEvent({
      sprite: corpseIcon(cell),
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

// 現在のダンジョンに出るアンデッド種のキー。
// ボス/強敵は除外する (死体から湧いた個体が boss フラグを持つと迷宮踏破扱いになってしまうため)
// 顔ぶれにアンデッドがいない迷宮 (霧の迷い森など) では、この層までの顔ぶれのアンデッドのうち
// この階の雑魚の最高ランクに一番近い (超えない) ものを使い、それも無ければこの階の雑魚にする。
// (以前は全魔物から引いていたので、霧の迷い森に第9層・ランク9の「沼の溺者」が群れで湧いていた)
function undeadKeyForDungeon() {
  const cfg = activeCfg();
  const isUndead = (k) => MONSTERS[k] && MONSTERS[k].race === "undead" && !MONSTERS[k].boss && !MONSTERS[k].elite && !MONSTERS[k].evOnly && !MONSTERS[k].metal;
  const local = [...(cfg.pool || []), ...(cfg.deepPool || [])].filter(isUndead);
  if (local.length) return local[rand(local.length)];
  const here = poolAt(cfg, G.floor || 1).filter((k) => MONSTERS[k]);
  const cap = Math.max(1, ...here.map((k) => MONSTERS[k].rank || 1));
  const near = [];
  for (let L = Math.min(20, battleLayer()); L >= 1; L--) {
    for (const k of LAYER_POOLS[L] || []) if (isUndead(k) && (MONSTERS[k].rank || 1) <= cap && !near.includes(k)) near.push(k);
  }
  if (near.length) {
    const top = Math.max(...near.map((k) => MONSTERS[k].rank || 1));
    const best = near.filter((k) => (MONSTERS[k].rank || 1) === top);
    return best[rand(best.length)];
  }
  return here.length ? here[rand(here.length)] : "d01_skeleton";
}

// 風化した死体を調べる: 魂20% / Soul30% / Gold30% / 装備20% (戦闘は起きない)。
// 「魂」= 装備できる魂オブジェクト / 「Soul」= ✦ ソウルポイント。
// 結果はトースト (魂のレア以上・SR/LR の品だけ祝祭の札) で知らせ、歩みは止めない
function investigateCorpse(cell, clsKey, clsLabel) {
  cell.cleared = true;
  const back = () => { if (G.state === "board") renderBoard(); };
  // 半分の確率で魂の残火も残っている (下の4つのどれとも別に)。魂なら同じ知らせにまとめ、ほかは知らせの末尾に添える
  const ember = random() < EMBER_COLD_RATE ? emberEcho(EMBER_COLD * emberMul(levelHere().lv)) : 0;
  let emberDone = false;
  const emberTail = () => {
    if (!ember || emberDone) return "";
    emberDone = true;
    G.embers = (G.embers || 0) + ember; runCount("embers", ember);
    log(`風化した死体に、魂の残火が ${ember}つ くすぶっていた。`, "win");
    return ` ・ 魂の残火 ×${ember}`;
  };

  // 懐に残された金品 (Gold) を渡す処理 (装備を渡せない時のフォールバックにも使う)
  const giveGold = () => {
    // 普通の1戦の金貨の半分ほど (evUnit の金貨は runGainGold で半分になる前の値)
    const g = runGainGold(Math.round(evUnit().gold * 0.5 * (0.7 + random() * 0.6)), "cp");
    SFX.itemget(); buzz([0, 30, 60, 30]);
    log(`風化した死体の懐から 💰${g} を見つけた。`, "win");
    const tail = emberTail();
    updateTopbar();
    showToast(`風化した死体の懐から 💰${g}${tail}`, { noLog: true, tone: "gold", icon: ICONS.gold });
    back();
  };

  const roll = random();

  // 20%: 職能の記憶を宿した「魂」
  if (roll < 0.20) {
    acquireSoul(clsKey, `風化した死体の残りかすに、まだ職能の記憶が宿っていた。`, back, ember);
    return;
  }

  // 30%: 亡骸に残る ✦ Soul (ソウルポイント) を集める
  if (roll < 0.50) {
    // 普通の1戦の ✦Soul の半分ほど
    const got = runGainSoulPts(Math.round(evUnit().soul * 0.5 * (0.7 + random() * 0.6)), "cp");
    SFX.itemget(); buzz([0, 30, 60, 30]);
    log(`風化した死体から ✦${got} Soul を集めた。`, "win");
    const tail = emberTail();
    updateTopbar();
    showToast(`風化した死体から ✦${got} Soul${tail}`, { noLog: true, tone: "gold", icon: ICONS.wisp });
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
    if (emberTail()) { updateTopbar(); showToast(`風化した死体に 魂の残火 ×${ember}`, { tone: "gold" }); }
    UI.loot(it, who, { source: "corpse" }, back);
    return;
  }
  giveGold();
}

// 魂の残火: まだあたたかい死体 = 必ず1個 / 偉大なる死体 = 必ず5個 / 風化した死体 = 50%で1個 (investigateCorpse)。
// どれも敵Lv で数が増える (levelcurve.js emberMul: Lv1〜50 ×1・51〜100 ×2 … Lv400 ×8)
const EMBER_WARM = 1, EMBER_GREAT = 5, EMBER_COLD = 1, EMBER_COLD_RATE = 0.5;
// 無限迷宮も本編と同じ数の残火を得る (2026-10-13 ユーザーの指示)。
function emberReward(great) {
  return emberEcho((great ? EMBER_GREAT : EMBER_WARM) * emberMul(levelHere().lv));
}
// 極光の書きつけ (手がかりの恵み emberEcho): 死体から魂の残火を拾った時、この確率で数が倍になる
const EMBER_ECHO_RATE = 0.10;
function emberEcho(n) {
  return n > 0 && inDungeon() && clueBoon("emberEcho") && random() < EMBER_ECHO_RATE ? n * 2 : n;
}
function collectSoul(cell, clsKey, clsLabel) {
  cell.cleared = true;
  acquireSoul(clsKey, cell.corpseGreat
    ? `偉大なる死体に宿っていた、強大な魂だ。`
    : `まだあたたかい死体に宿っていた魂だ。`, null, emberReward(cell.corpseGreat));
}

// レア度の表示名
const RARITY_LABEL = { common: "コモン", rare: "レア", epic: "エピック", legend: "レジェンド", unique: "固有" };

// 魂を受け取る (演出なし): 所持魂の一覧へ加え、戦績・図鑑・今回の記録に残す。死体の残火も同時に受け取る。
// 戦果シートのように一覧へまとめて見せる場面と、トースト/祝祭で知らせる acquireSoul の共通の芯
function grantSoulQuiet(clsKey, sourceLine = "", emberCount = 0) {
  const cls = SOUL_CLASSES[clsKey] || SOUL_CLASSES.fighter;
  // 無限迷宮: 同じ職の魂を持っていれば自動で融合し、無ければ灯番で宿せる魂として加わる。持ち帰りは拾った数 (G.run.souls)
  if (abyssActive() && inDungeon()) {
    G.stats.soulsFound++;
    const r = infGainSoul(clsKey);
    runTrackSoul(clsKey, "bag");
    tlSoulGot(clsKey);
    codexJobSee(clsKey, 1, 1);
    if (emberCount > 0) { G.embers = (G.embers || 0) + emberCount; runCount("embers", emberCount); }
    infCheckRun();
    updateTopbar();
    const how = r.fused ? `${cls.label}の魂と自動で融合した (${soulLabel(r.soul)} ・ Lv上限 ${soulLevelCapOf(r.soul)})` : "風だまりの灯番に頼めば宿せる";
    log(`${cls.label}の魂 を拾った。${how}。${emberCount > 0 ? ` 魂の残火 ×${emberCount}` : ""}`, "win");
    return { clsKey, label: cls.label, rarity: cls.rarity, rare: cls.rarity !== "common", glow: cls.glow || "#c9a227", line: [sourceLine, how].filter(Boolean).join(" ・ "), embers: emberCount, echo: false, inf: true, fused: r.fused };
  }
  G.stats.soulsFound++;
  questProgress("soul", null, 1);
  addSoulInstance(clsKey);
  runTrackSoul(clsKey, "bag");
  tlSoulGot(clsKey);
  codexJobSee(clsKey, 1, 1);
  if (emberCount > 0) { G.embers = (G.embers || 0) + emberCount; runCount("embers", emberCount); }
  // セラの囁き (手がかりの恵み soulEcho): 迷宮で拾った時、まれにもう一つ
  const echo = inDungeon() && clueBoon("soulEcho") && random() < SOUL_ECHO_RATE;
  if (echo) {
    G.stats.soulsFound++;
    questProgress("soul", null, 1);
    addSoulInstance(clsKey);
    runTrackSoul(clsKey, "bag");
    tlSoulGot(clsKey);
  }
  updateTopbar();
  log(`${cls.label}の魂 を${echo ? "2つ" : ""}持ち帰った。(所持魂 一覧に追加)${echo ? " セラの囁きが、もう一つの魂を呼び寄せた。" : ""}${emberCount > 0 ? ` 魂の残火 ×${emberCount}` : ""}`, "win");
  const line = echo ? [sourceLine, "セラの囁きが、もう一つの魂を呼び寄せた (×2)"].filter(Boolean).join(" ・ ") : sourceLine;
  return { clsKey, label: cls.label, rarity: cls.rarity, rare: cls.rarity !== "common", glow: cls.glow || "#c9a227", line, embers: emberCount, echo };
}

// 魂の祝祭の札 (迷宮で拾った魂はコモンも・街ではレア以上)。残火があれば同じ札にまとめる
function celebrateSoul(s, onClose) {
  const cls = SOUL_CLASSES[s.clsKey] || SOUL_CLASSES.fighter;
  const common = cls.rarity === "common";
  SFX.itemget(); buzz(common ? [0, 30, 60, 30] : [0, 40, 50, 40, 50, 150]);
  if (cls.rarity === "legend") { flashScreen("#ffcf4a"); SFX.victory(); }
  showEvent({
    sprite: soulIcon(s.clsKey),
    banner: common ? "✦ 魂を入手 ✦" : `★ ${RARITY_LABEL[cls.rarity] || "希少"}の魂を入手 ★`,
    title: `${cls.label}の魂`,
    lines: [s.line, s.inf ? "帰れば、＋1 の素材として本編の魂に加わる。" : "所持魂の一覧に加わった。", ...(s.embers > 0 ? [`魂の残火を ${s.embers}つ 手に入れた (魂のLv上限を上げる)`] : [])].filter(Boolean),
    accent: cls.glow || "#c9a227",
    sparkle: true,
    btnLabel: "受け取る",
    onClose, noLog: true, // 魂と残火は grantSoulQuiet が記録に書いた
  });
}

// 魂の入手処理: 拾った魂は1体の魂インスタンスとして自動で「所持魂 一覧」に追加される。
// 迷宮で拾った魂は格を問わず祝祭の札 (ポップアップ)。街ではコモンはトースト (歩みを止めない)、レア以上は祝祭の札。
// 死体の残火は同じ知らせにまとめる
function acquireSoul(clsKey, sourceLine, onClose, emberCount = 0) {
  const after = onClose || (() => { if (G.state === "board") renderBoard(); });
  const s = grantSoulQuiet(clsKey, sourceLine, emberCount);
  if (s.rare || G.state !== "town") { celebrateSoul(s, after); return; }
  SFX.itemget(); buzz([0, 30, 60, 30]);
  showToast(`${s.label}の魂を手に入れた${s.embers > 0 ? ` ・ 魂の残火 ×${s.embers}` : ""}`, { tone: "good", icon: soulIcon(clsKey) });
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
// logAs: 問いを記録にも残す (true = 題、文字列 = その文。宝箱・泉・死体・出来事などの発見)
function showChoice(title, options, icon, { banner = "✦ 発見 ✦", accent = "#c9a227", lines = [], onDismiss = null, logAs = null } = {}) {
  if (logAs) logEcho(logAs === true ? plainText(title) : logAs, /[⚠✗☠]/.test(banner || "") ? "dmg" : "sys");
  G.prompt = true;
  replacePrompt();
  const cancel = onDismiss ? null : options.find(isCancelOption);
  const acts = options.filter((o) => !isCancelOption(o) && !o.danger);
  const spec = (o) => ({
    label: o.label,
    kind: o.danger ? "danger" : isCancelOption(o) ? "ghost" : (o.primary || (acts.length === 1 && acts[0] === o)) ? "primary" : "secondary",
    onTap: () => { closePrompt(); tlGameMeasure("event", () => o.fn()); },
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
  // 枠外をタップ・戻る = 「まだ探索する」 (帰還魔法陣と同じ)。一度そう選んだ階段は、オート移動では素通りする
  // (cell.stairsSeen。階段をタップして歩いて来た時・ドックの「降りる」は従来どおり問う — ユーザーの指示、2026-10)
  const stay = () => { if (cell) cell.stairsSeen = true; renderBoard(); };
  // 無限迷宮: 最深部が無く、ひたすら深く潜る。5の倍数の階の階段は風だまり (回収人・灯番・主 → 帰る / 続ける)
  if (abyssActive()) {
    if (isRestFloor(G.floor)) { openInfRest(cell); return; }
    showChoice(
      `さらに深い闇へ続く階段だ。`,
      [
        { label: `B${G.floor + 1}F へ潜る`, primary: true, fn: () => descend() },
        { label: "まだ探索する", fn: stay },
      ],
      ICONS.stairs,
      { banner: `✦ ${INF_NAME} ✦`, accent: "#b08ac0", onDismiss: stay,
        lines: isRestFloor(G.floor + 1) ? ["次の階は風だまり。回収人と灯番が待ち、その奥に主が立つ。"] : [] }
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
        { label: "まだ探索する", fn: stay },
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
  else if (clearNoBoss) {
    label = "踏破する"; banner = "✦ 最深部 ✦"; accent = "#ffd84a";
    prompt = `「${dn.name}」の最深部に至った。`;
    lines = ["踏破して街へ凱旋する。"];
    const clue = reportMissingClue(dn.id);
    if (clue && clue.floor === G.floor) lines.push(`この階に「${clue.name}」が残っている。王への報告に必要だ。『まだ探索する』を選び、光る手がかりを探そう。`);
  }
  else { label = `B${G.floor + 1}F へ降りる`; banner = "✦ 下り階段 ✦"; prompt = `下り階段を見つけた。`; lines = [`B${G.floor + 1}Fへ。下の「降りる」からも、いつでも降りられる。`]; }
  showChoice(
    prompt,
    [
      { label, danger: boss, primary: !boss, fn: () => {
        if (boss) {
          log("迷宮の主が立ちはだかる！", "dmg");
          // 迷宮ごとの手直し (generator.js DUNGEON_TUNE): 主は雑魚の倍率ではなく bossMul、HP はさらに bossHpMul
          const tn = dn.tune || {};
          const foes = spawnBossEnemies(dn.boss, dn.bossScale * (tn.bossMul || 1) * baseEnemyScale(true), dn.bossRank);
          if ((tn.bossHpMul || 1) !== 1) for (const e of foes) e.maxhp = e.hp = Math.max(1, Math.round(e.maxhp * tn.bossHpMul));
          startBattle(foes, cell);
        }
        else if (clearNoBoss) clearDungeonNoBoss();
        else descend();
      } },
      { label: "まだ探索する", fn: stay },
    ],
    boss ? ICONS.bossDoor : ICONS.stairs,
    { banner, accent, lines, onDismiss: stay }
  );
}

// ボスのいない層途中の迷宮を踏破する (最深部到達で確定)。ボス撃破と同じ章進行・凱旋演出につなぐ。
function clearDungeonNoBoss() {
  const clue = reportMissingClue(curDungeon().id);
  if (prologueActive() && clue) { showToast(`先に「${clue.name}」を確かめよう`, { tone: "info" }); return; }
  const info = commitDungeonClear(false); // boss扱いしない (戦績の主撃破は加算しない)
  showDungeonClearedPopup(info);
}

// ===== 罠解除 (宝箱・罠マス共通) =====
// 解除値 = AGI + LUK。解除を得意とする職 (盗賊・義賊・暗殺者・魔盗賊・狩人) をメイン魂かサブ魂に宿していれば1.5倍のボーナス
const DISARM_JOBS = ["thief", "brigand", "shadow", "arcthief", "hunter"];
// この人業が「解除の得意職」を宿しているか (メイン魂・サブ魂のいずれか)。
// サブ魂でも得意職扱い (2026-10 ユーザーの指示: 盗賊系はエピック・レジェンドに無く、後半は解除役のためだけに1枠を潰していた)
function disarmExpert(m) {
  if (!m) return false;
  if (m.jobKey && DISARM_JOBS.includes(m.jobKey)) return true;
  return (m.subs || []).some((sub) => {
    const s = sub && soulByUid(sub.uid);
    return !!(s && DISARM_JOBS.includes(s.clsKey));
  });
}
function disarmPower(m) {
  let v = (m.agi || 0) + (m.luk || 0);
  if (disarmExpert(m)) v *= 1.5;
  return Math.round(v);
}

// 解除難度: その階の推奨Lv と宝箱ランクで決まる。
// 推奨Lv の隊の「AGI+LUK」に合わせ、得意職が ~75% (上限95%まで伸びる)、それ以外の職は ~50% になるよう調整している。
// cRank: 宝箱ランク (1-5)。床罠は1扱い
function disarmNeed(cRank = 1) {
  const c = 1 + ((cRank || 1) - 1) * 0.16;               // 宝箱ランク: 上等な箱ほどずる賢い錠前
  // 基準値: 得意職以外が推奨Lv の隊で約50%に収まる難度 (得意職は ×1.5 ボーナスで上回る)。推奨Lv の伸びで重くなる (levelcurve.js)
  // 特別階 (からくり錠の宝物庫): 解除がはるかに難しい (sfNum lockMul)
  // 迷宮の掟 (鍵束の間) も解除を難しくする (mutNum lockMul)
  return LOCK_K * lockPow(levelHere().lv) * c * sfNum("lockMul", 1) * mutNum("lockMul", 1);
}

function disarmChance(m, cRank = 1) {
  if ((specialDef() || {}).sureDisarm) return 1; // 盗賊の洞察: 罠解除率100%
  // 得意職は最大95%まで伸びるが、それ以外は上限55% (適正レベルで約50%、過剰育成でも頭打ち)
  const cap = disarmExpert(m) ? 0.95 : 0.55;
  // 隊のパッシブ 盗賊の眼 (trapEye): 解除率 +10/20/30% (上限を越えて足せるが、最大95%)
  const eye = [0, 0.10, 0.20, 0.30][Math.min(3, partyPassiveLv("trapEye"))] || 0;
  // 罠外しの装飾 (eff.disarmUp、catalog/lockpick.js): 本人の装備だけが効き、盗賊の眼と同じく頭打ちを越えて足す (最大95%)
  const gear = (m && m.eff && m.eff.disarmUp) || 0;
  return Math.min(0.95, Math.max(0.05, Math.min(cap, disarmPower(m) / disarmNeed(cRank))) + eye + gear);
}

// 宝箱ランク (1-5) を取得。セルに未設定ならその場で抽選して保存する
// (出現%表示と実際の判定がぶれないよう、同じ宝箱では固定)
function chestRankOf(cell) {
  if (cell && cell.cRank) return cell.cRank;
  const cfg = activeCfg();
  const floors = Math.max(1, cfg.floors || 3);
  const depth = floors > 1 ? Math.min(1, (G.floor - 1) / (floors - 1)) : 0;
  // 特別階 (商隊の遺品) / 迷宮の異変 (閉ざされた退路など): 宝箱ランクが上がる。
  // 抜け目なさ (盗賊のランク): 宝箱のランクが一段上がる確率 10/15/20/30%
  const nk = random() < rankParty("thiefNukeme", [0.10, 0.15, 0.20, 0.30]) ? 1 : 0;
  const r = Math.min(5, rollChestRank(depth, cfg.rank || 1) + sfNum("chestRankUp", 0) + mutNum("chestRankUp", 0) + nk);
  if (cell) cell.cRank = r;
  return r;
}

// 隊で最も罠解除が高い生存メンバー (罠マスの判定に使う)。
// 解除率で比べる (得意職の上限・罠外しの装飾も含む。解除値だけで比べると装飾を着けた者が選ばれなかった)
function bestDisarmer() {
  const alive = G.party.filter((p) => p.alive);
  let best = alive[0];
  for (const p of alive) if (disarmChance(p) > disarmChance(best) || (disarmChance(p) === disarmChance(best) && disarmPower(p) > disarmPower(best))) best = p;
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
    // logged = 同じ知らせを呼び出し側が記録に書いた (gold・lost も呼び出し側が書く)
    note(text, tone = "gold", icon = null, logged = false) { showToast(text, { tone, icon: icon || undefined, noLog: logged }); },
    gold(g, from = "宝箱") { showToast(`${from}から 💰${g}`, { tone: "gold", icon: ICONS.gold, noLog: true }); },
    loot(item, who, next) { UI.loot(item, who, { source: "chest" }, next); },
    lost(name) { showToast(`持ちきれず置いてきた: ${name}`, { tone: "bad", noLog: true }); },
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
  opts.push({ label: "開けない", cancel: true, fn: () => { if (cell) cell.chestSeen = true; renderBoard(); } }); // オート移動はもう向かわない
  showChoice(`${CHEST_RANKS[cRank]}宝箱`, opts, ICONS.chest, {
    banner: "✦ 宝箱 ✦", logAs: `${CHEST_RANKS[cRank]}宝箱を見つけた。`, lines: ["罠があるかもしれない。解除の上手い者が開けるほど安全だ。"],
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
    if (!legendary && random() < Math.max(sfNum("mimicRate", 0.03), mutNum("mimicRate", 0))) {
      // ミミック出現時、10%でマスターミミック (上位種なので第4層から。第1〜3層は通常のミミックだけ)。
      //  強さはこの階の敵が基準 (通常=+1ランク / マスター=+2ランク)。固有ドロップは無く、上質な宝箱を残す。
      const master = battleLayer() >= MASTER_MIMIC_LAYER && random() < 0.10;
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
    if (!legendary && random() < 0.10) {
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
  // 特別階 (からくり錠の宝物庫) は宝箱に必ず罠がある (chestTrapRate)
  // 迷宮の掟 (鍵束の間) も宝箱に必ず罠を仕掛ける (mutNum chestTrapRate)
  const trapProb = (cfg.trapRate === 0 || sfNum("noTrap", false)) ? 0 : Math.max(sfNum("chestTrapRate", 0.70), mutNum("chestTrapRate", 0));
  if (random() < trapProb) {
    const trap = pickTrap(cfg.rank || 1, random, excludeKinds);
    const who = opener || bestDisarmer();
    const chance = disarmChance(who, cRank);
    if (who && random() < chance) {
      SFX.chest();
      G.stats.trapsDisarmed++; // 戦績: 解除した罠 (勲章用)
      log(`宝箱の罠「${trap.name}」を ${who.name}が解除した！`, "sys");
      sink.note(`罠「${trap.name}」― ${who.name}が解除した`, "good", ICONS.trap, true);
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
// 罠ダメージの基準値。disarmNeed と同じく推奨Lv の伸びに比例させ、
// 深い迷宮ほど罠そのものが重くなる。実ダメージは罠ごとの mult を掛けた値
function trapBaseDmg() {
  // 本編の短い迷宮向けの階数加算を、無限迷宮の通算階数で増幅しない。
  // 深さによる成長は推奨Lv側に任せ、補給間隔の5階分までにする。
  const depth = abyssActive() ? Math.min(G.floor, INF_REST_EVERY) : G.floor;
  return (5 + depth * 3 + rand(6)) * TRAP_K * lockPow(levelHere().lv); // 推奨Lv の隊の HP の伸びに合わせる (levelcurve.js)
}

// 黄金喰い・魂喰らいで失う量: その階の推奨Lv の普通の1戦 (levelcurve.js refGold / refSoul) × 戦果の数 n、±15%
function trapLoss(ref, n) {
  return Math.max(1, Math.round(ref(levelHere().lv) * n * (0.85 + random() * 0.3)));
}

// 罠の効果を適用し、何が起きたかを返す (知らせ方は presentTrap が決める)。
// opener: 開けた者/先頭の解除役 (opener型の罠が狙う)。
// 返り値 kind: "teleport" (飛ばされる・中身を失う) | "alarm" (戦闘・中身を失う) | "harm" (痛手/吸収。fallen/wiped を伴う)
function applyTrap(...args) { return tlGameMeasure("trap", () => applyTrapMeasured(...args)); }
function applyTrapMeasured(trap, opener) {
  SFX.trap(); buzz([0, 60, 40, 60]);
  G.stats.trapsSprung++; // 戦績: 発動させてしまった罠 (勲章用)
  log(`罠だ！ 「${trap.name}」が発動した！`, "dmg");
  const alive = () => G.party.filter((p) => p.alive);

  // テレポーター: 同じ階の別の場所へ飛ばされる。宝箱の中身は失われる
  if (trap.kind === "teleport") return { kind: "teleport", trap, lines: [trap.flavor, "隊は見知らぬ場所へ飛ばされた！"] };

  // 警報: 怪物を呼び寄せ戦闘になる。宝箱の中身を検める暇はない
  if (trap.kind === "alarm") {
    const cfg = activeCfg();
    const pool = trap.horde ? poolAt(cfg, Math.max(G.floor, cfg.floors || 1)) : poolAt(cfg, G.floor);
    const key = pool[rand(pool.length)];
    return {
      kind: "alarm", trap, key, scale: enemyScale() * (trap.horde ? 1.25 : 1), opts: trap.horde ? { min: 4 } : null,
      lines: [trap.flavor, trap.horde ? "怪物の群れが雪崩れ込んでくる！" : "怪物が呼び寄せられた！"],
    };
  }

  // 残りはダメージ/吸収系: 効果を適用して結果をまとめる。
  const lines = [trap.flavor];
  const fallen = [], hurtList = [], brief = [];
  const hurt = (p, mult) => {
    const dmg = Math.max(1, Math.round(trapBaseDmg() * mult));
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
    const eqRes = p.resists ? (p.resists[ail] || 0) / 100 : (p.ailRes && p.ailRes[ail]) || 0;
    if (random() >= chance * (1 - eqRes)) return;
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
      if (trap.dieChance && random() < trap.dieChance) {
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
      lines.push("隊の魔力が吸い取られた…");
      brief.unshift("魔力を吸われた");
      break;
    }
    case "gold": {
      // 進行度に応じた量 (2026-10 ユーザーの指示: 所持金の割合だと貯めるほど痛かった)。
      // その階の推奨Lv の普通の1戦の金貨 (refGold) × trap.loss、±15% の揺らぎ。所持金より多くは失わない
      const loss = Math.min(G.gold, trapLoss(refGold, trap.loss || 9));
      G.gold = Math.max(0, G.gold - loss);
      updateTopbar();
      lines.push(`💰${loss} が溶かされた…`);
      brief.push(`💰-${loss}`);
      log(`💰${loss} を失った…`, "dmg");
      break;
    }
    case "soul": {
      // 金貨と同じく進行度に応じた量: 普通の1戦の ✦Soul (refSoul) × trap.loss
      const loss = Math.min(G.soulPts, trapLoss(refSoul, trap.loss || 6));
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
  // 罠の痛手・状態異常・奪われた物 (札・戦果シート・トーストのどこに出ても、記録には1行ずつ残す)
  for (const ln of res.lines || []) logEcho(ln, "dmg");
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
  sink.note(`${chest ? "解除失敗 ― " : ""}罠「${trap.name}」${res.brief ? " ― " + res.brief : ""}`, "bad", ICONS.trap, true);
  fin.proceed();
}

// 宝箱の中身 (ゴールド/装備品/収集品)。cRank: 宝箱ランク (1-5、高いほど豪華)
// lvBonus: ミミック撃破後の宝箱などのアイテムレベル底上げ。
// cell.lootBonus: 特別階 (伝説の眠る階) の「伝説の宝箱」— 中身は必ず装備品で +40レベル
// 宝箱の金貨 (runGainGold へ渡す半減前の値): 推奨Lv の普通の1戦の金貨 (refGold) × CHEST_GOLD_BATTLES × 宝箱ランク × 揺らぎ。
// 以前の式 (階 × 迷宮の格) は推奨Lv に付いていかず、第6層では1戦の2割ほどしかなかった。第一章 (第1層) は旧式の方が多いので下限に残す
const CHEST_GOLD_BATTLES = 1.2;
function chestGoldRaw(rankMul) {
  const old = (10 + (G.floor || 1) * 12 + rand(30)) * (1 + ((activeCfg().rank || 1) - 1) * 0.5);
  const byLv = refGold(levelHere().lv) * CHEST_GOLD_BATTLES * (0.8 + random() * 0.4);
  return Math.round(Math.max(old, byLv) * rankMul * 2);
}
function chestContents(cell, done, cRank = 1, lvBonus = 0, noGold = false, sink = boardSink()) {
  // 特別階 (からくり錠の宝物庫): 中身の装備の質が上がる (chestLootLv)・金貨にならない (chestNoGold)
  const lootUp = (lvBonus || 0) + ((cell && cell.lootBonus) || 0) + sfNum("chestLootLv", 0);
  const legendary = !!(cell && cell.lootBonus);
  if (sfNum("chestNoGold", false)) noGold = true;
  const rankMul = 1 + ((cRank || 1) - 1) * 0.3;
  const fin = done || (() => renderBoard());
  // 中身の抽選 (ダンジョンレベルに応じる): ゴールド50% / ゴールド以外のアイテム50%
  // 伝説の宝箱・ミミック宝箱はゴールドにならず、必ず装備品が出る
  if (!legendary && !noGold && random() < 0.5) {
    SFX.chest();
    const g = runGainGold(chestGoldRaw(rankMul), "ch");
    updateTopbar();
    log(`宝箱から 💰${g} を手に入れた！`, "win");
    sink.gold(g, "宝箱");
    fin();
    return;
  }
  // 宝: 装備/アイテム (迷宮のアイテムレベル帯から抽選。高ランクの宝箱は一段上の帯)
  const id = pickLoot({ chestRank: cRank, lvBonus: lootUp });
  giveItemAsk(id, (got, lost) => {
    if (got) {
      if (legendary) { flashScreen("#ffcf4a"); SFX.victory(); log(`✦ 伝説の宝箱から ${itemName(got.item)} を見つけた！`, "win"); }
      sink.loot(got.item, got.who, fin); // 演出 (トースト/祝祭) の後に fin
      return;
    }
    // 誰も持てない (§7 M8): 捨てずに置いていった品を今回の記録に残し、知らせる
    if (lost) {
      const nm = itemName(lost);
      runLost(nm);
      log(`${nm}を見つけたが、誰も持てない…`, "sys");
      sink.lost(nm);
    }
    SFX.chest();
    if (done) done();
  });
}

// 黒い宝箱: 開ければ一段上のレベル帯の装備が出るが、50%で呪いがふきだす。
// 「開けない」が常に選べる、純粋なリスクとリターンの賭け
function askCursedChest(done) {
  const openIt = () => {
    const giveLoot = () => {
      const id = pickLoot({ rare: true });
      giveItemAsk(id, (got, lost) => {
        if (got) { UI.loot(got.item, got.who, { source: "chest" }, done); return; }
        if (lost) {
          const nm = itemName(lost);
          runLost(nm);
          showToast(`持ちきれず置いてきた: ${nm}`, { tone: "bad" });
        }
        SFX.chest();
        done();
      });
    };
    if (random() < 0.5) {
      // 呪い: 全員ダメージ (死にはしない) + 毒か麻痺。その上で中身は手に入る
      SFX.trap(); buzz([0, 80, 60, 80]); flashScreen("#a01030");
      let cursed = false;
      for (const p of G.party) {
        if (!p.alive) continue;
        p.hp = Math.max(1, p.hp - Math.ceil(p.maxhp * 0.25));
        if (!p.ailment && random() < 0.4) { p.ailment = random() < 0.5 ? "poison" : "paralyze"; cursed = true; }
      }
      log("黒い宝箱から呪いがふきだした！", "dmg");
      flashPartyCards(G.party.filter((p) => p.alive), "hit");
      showToast(`呪いがふきだした ― 全員が生気を吸われた${cursed ? "・毒や麻痺も" : ""}`, { noLog: true, tone: "bad", icon: ICONS.trap });
    }
    giveLoot();
  };
  showChoice("黒い宝箱だ。禍々しい気配を放っている…", [
    { label: "開ける ― 上質な品 / 呪いの危険", danger: true, fn: openIt },
    { label: "立ち去る", fn: done },
  ], ICONS.chest, { banner: "⚠ 黒い宝箱 ⚠", accent: "#8a2be2", logAs: true, lines: ["一段上の品が眠る。半分の確率で呪いがふきだすが、中身は本物だ。"] });
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
    // 持ち物がいっぱい: 袋の品を1つ捨てて入れるか、置いていく (docs/infinite-labyrinth.md 18章)
    markDungeonLoot(d.item);
    askRoomFor(d.item, (owner) => {
      if (owner) { giveDropsFromChest(drops, i, done, sink); return; }
      log(`${itemName(d.item)}を見つけたが、誰も持てない…`, "sys");
      runLost(itemName(d.item));
      sink.lost(itemName(d.item));
      next();
    });
    return;
  }
  const ce = codexMonEntry(d.key);
  if (d.rare) ce.rare = true; else ce.normal = true;
  markDungeonLoot(d.item); // 未鑑定にしてから図鑑へ (先に記すと、まだ知らない品を「正体を知った」と数えてしまう)
  codexSeeItem(d.id, d.item);
  runGainItem(who, d.item);
  SFX.chest();
  // 「〜の落とした」は落とし主のいる品 (強敵・門番) だけ。ふつうの戦利品 (key "loot") は落とし主を言わない
  const from = d.key === "loot" ? "" : `${d.name}の落とした `;
  log(`宝箱から ${from}${itemName(d.item)} を手に入れた！`, logClassForItem(d.item, d.rare ? "win" : "sys"));
  sink.loot(d.item, who, next);
}


// 階段を降りる: 墨の帳 (約1.3秒・400ms 後はタップで飛ばせる) の暗転のうちに次の階へ。
// 強敵階・特別な階・奈落の変異の知らせは帳の中に2〜3行で添える (後から別の札は出さない)。
// 見落としても、見出しの迷宮名を押す「階の情報」でいつでも読み返せる
function descend(...args) { return tlGameMeasure("floor", () => descendMeasured(...args)); }
function descendMeasured({ fall = false, skip = 0 } = {}) {
  // 出来事で2階進む場合も、5階の区切りを越える前に支払う。
  if (stabilityApplies(activeCfg()) && Math.floor((G.floor + skip) / 5) > Math.floor((G.floor - 1) / 5)) {
    if (!stabilityReady(() => descend({fall, skip}))) return;
    if (!consumeEntryStability(activeCfg().id, "floor")) return;
  }
  evOnDescend(); // 迷宮のイベント: 誓いの破約など
  if (!fall) { SFX.stairs(); buzz([0, 20, 80, 20]); }
  G.floor += skip + 1;
  if (G.run) G.run.descended = true;
  // 浮遊: 階を移るたびに残りの階数を減らす (唱えた階を含めて float 階のあいだ続く)
  if (G.run && G.run.float > 0) {
    G.run.float--;
    if (G.run.float <= 0) { G.run.float = 0; log("浮遊の術が解け、隊の足が地に着いた。", "sys"); }
  }
  G.maxFloorReached = Math.max(G.maxFloorReached, G.floor);
  questProgress("floor", G.floor);
  // 無限迷宮: 深さを進め、5階ごとの区切りの始めに風の掟を引き直す (深いほど強い掟が混ざる)
  let newRule = null;
  if (abyssActive()) {
    G.abyss.depth = G.floor;
    infCheckRun();
    infTlArrive();
    G.bossDown = false; // 主を討った階を離れたら、次の主を討つまで帰れない
    if ((G.floor - 1) % INF_REST_EVERY === 0) {
      const rng = mulberry32(((G.abyss.seed || 1) ^ Math.imul(G.floor, 374761393)) >>> 0);
      G.abyss.rule = rollInfRule(rng, G.floor, G.abyss.rule);
      newRule = infRule();
    }
  }
  // 隊のパッシブ (階を移動するたび。どれも隊で一番高いLvの1人分だけ):
  //  束の間の休息 (fieldRegen) = 全員のHP 10/20/30% / 魔力の循環 (manaFlow) = 全員のMP 1/1.5/2%
  const frLv = partyPassiveLv("fieldRegen"), mfLv = partyPassiveLv("manaFlow");
  if (frLv || mfLv) {
    const hpPct = [0, 0.10, 0.20, 0.30][Math.min(3, frLv)] || 0, mpPct = [0, 0.01, 0.015, 0.02][Math.min(3, mfLv)] || 0;
    let healed = false, mana = false;
    for (const p of G.party) {
      if (!p.alive) continue;
      if (hpPct && p.hp < p.maxhp) { p.hp = Math.min(p.maxhp, p.hp + Math.ceil(p.maxhp * hpPct)); healed = true; }
      if (mpPct && p.mp < p.maxmp) { p.mp = Math.min(p.maxmp, p.mp + Math.ceil(p.maxmp * mpPct)); mana = true; }
    }
    if (healed) log("束の間の休息: 階を移る合間に、隊の傷が癒えた。", "win");
    if (mana) log("魔力の循環: 階を移る合間に、隊の魔力が満ちてきた。", "win");
  }
  // 追加の特性「灯の」「風読みの」(無限迷宮の装備): 階を降りると、その持ち主の HP・MP が少し戻る
  { let lit = false;
    for (const p of G.party) {
      const m = p.alive && p.gearMisc;
      if (!m) continue;
      if (m.descHp && p.hp < p.maxhp) { p.hp = Math.min(p.maxhp, p.hp + Math.ceil(p.maxhp * m.descHp)); lit = true; }
      if (m.descMp && p.mp < p.maxmp) { p.mp = Math.min(p.maxmp, p.mp + Math.ceil(p.maxmp * m.descMp)); lit = true; }
    }
    if (lit) log("装備の灯が、階を移る合間に傷と魔力を癒した。", "win"); }
  // 強敵階判定: 5階層以上の迷宮のみ、3F以降で10%の確率で発生
  // 迷宮の掟 (軍議の間) は強敵階が出やすい (trait.eliteRate)
  let eliteRate = (dungeonTrait() && dungeonTrait().eliteRate) || 0.10;
  // 名のある強敵の懸賞を受けていて、ここがその縄張りなら強敵階が出やすい (named.js HUNT_ELITE_RATE)
  if (!abyssActive() && (activeCfg().elites || []).some((id) => namedHunted(id))) eliteRate = Math.max(eliteRate, HUNT_ELITE_RATE);
  G.eliteFloor = !activeCfg().tutorial && (activeCfg().floors || 3) >= 5 && G.floor >= 3 && random() < eliteRate;
  // 特別階判定: 強敵階でなければ、各候補の出現条件 (階数) と出現率で抽選。
  // 第1の迷宮と1Fには特別な階は出現しない (ほかの迷宮の2F以降のみ)。
  G.specialFloor = null;
  // 迷宮の掟 (移ろう霧) は特別な階が出やすい (trait.specialRate 倍)
  const specialMul = (dungeonTrait() && dungeonTrait().specialRate) || 1;
  if (!activeCfg().noSpecial && activeCfg().id !== "w01" && !G.eliteFloor && G.floor >= 2) {
    const r = random();
    let acc = 0;
    for (const c of SPECIAL_FLOORS) {
      if (G.floor < c.minFloor) continue;
      if (c.cond && !c.cond(activeCfg())) continue;
      acc += c.rate * (specialMul || 1);
      if (r < acc) { G.specialFloor = c.id; break; }
    }
  }
  // 迷宮のイベント (奈落の縦穴): 降りた先は強敵階
  if (G.run && G.run.ev && G.run.ev.forceElite) { G.run.ev.forceElite = false; G.eliteFloor = true; G.specialFloor = null; }
  applyInfMightyFloor();
  const sp = specialDef();
  if (G.eliteFloor) {
    log("…強敵の気配がする。この階には通常では遭遇しない強大な存在が潜む。", "dmg");
  } else if (sp) {
    log(`…この階は何かが違う。「${sp.name}」だ。${sp.lines.join("")}`, "win");
  } else {
    log(fall ? "…落ちた先は、ひとつ下の階だった。" : "階段を降りていく…", "sys");
  }
  if (newRule) log(`風が変わった。風の掟「${newRule.name}」: ${newRule.lines.join("")}`, newRule.boon ? "win" : "dmg");
  // 帳に添える行 (2〜3行)
  let tone = "", sub = fall ? `— ${fallHaz().name}から落ちた —` : "— さらに深く潜る —", lines = [], color = null;
  if (G.eliteFloor) {
    tone = "elite"; sub = "— 禍々しき気配 —";
    const ek = MONSTERS[eliteKey()];
    // 名前は一度倒すまで不確定名 (階の情報・戦闘の名乗りと同じ enemyReveal)
    const ekName = ek ? (enemyReveal({ key: eliteKey(), mon: ek }).name ? ek.name : unknownTag(unknownLabel(ek))) : "";
    lines = ["この階には通常では遭遇しない強大な存在が潜む。", ek ? (ek.named ? `名のある強敵「${ek.name}」― ${namedState().trophy[eliteKey()] ? "討てば希少な戦利品" : "初めて討てば首級が手に入る"}` : `強敵「${ekName}」― 討てば希少な戦利品`) : "討てば希少な戦利品が得られる。"];
  } else if (sp) {
    tone = "special"; sub = `— ${sp.name} —`; color = sp.accent;
    lines = sp.lines.slice(0, 2);
  }
  if (newRule) {
    lines = lines.concat([`風の掟「${newRule.name}」`, newRule.lines[0]]).slice(-3);
    if (!tone) { tone = newRule.boon ? "special" : "elite"; color = newRule.accent; }
  }
  if (abyssActive() && isRestFloor(G.floor) && !tone) { sub = "— 風だまりの階 —"; lines = ["この階の階段の先に、回収人と灯番、そして主が待つ。"]; }
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
// 異変の強さ・戦果倍率は通常敵だけに適用する。出来事の特殊敵も除く。
function specialModifierEnemy(e) {
  return !!(e.boss || e.metal || e.isMimic || e.isMasterMimic || e.mon?.elite || e.mon?.named || e._tuneK != null);
}
// 混成の戦闘では、倒した通常敵の戦果にだけ異変の倍率を掛ける。
function battleModifierReward(b, key) {
  let total = 0, affected = 0;
  for (const e of b.enemies) {
    if (e.alive || e._fled) continue;
    const value = (key === "soul" ? e.soul ?? e.exp : e[key]) || 0;
    total += value;
    if (!specialModifierEnemy(e)) affected += value;
  }
  return total ? 1 + (mutNum(key + "Mul", 1) - 1) * affected / total : 1;
}
// 6属性 (無属性を除く) から1つを無作為に
function randomElement() {
  const els = Object.keys(ELEMENTS).filter((k) => k !== "none");
  return els[Math.floor(random() * els.length)];
}
function startBattle(...args) { return tlGameMeasure("battle", () => startBattleMeasured(...args)); }
function startBattleMeasured(enemies, cell) {
  // 迷宮の属性気配: 属性持ち迷宮では雑魚敵が迷宮属性を帯びやすい (主・強敵は固有属性のまま)
  const cfg = activeCfg();
  const spFloor = specialDef();
  const isElite = enemies.some((e) => e.mon && e.mon.elite);
  if (cfg.element) {
    const ch = (spFloor && spFloor.elemAll) || mutNum("elemAll", false) ? 1 : 0.5;
    for (const e of enemies) if (!e.boss && !(e.mon && e.mon.elite) && !e.metal && random() < ch) { e.element = cfg.element; e.affinity = elementAffinity(e.element); }
  }
  // 属性の暴走 (異変) / 属性の奔流 (特別な階): 主・強敵も含め、すべての敵の属性を6属性からでたらめに選び直す (召喚された仲間も同じ)
  if (elemRandomHere()) for (const e of enemies) if (!e.metal) { e._elemRandom = true; e.element = randomElement(); e.affinity = elementAffinity(e.element); }
  // 迷宮の異変 (血の満潮など): 敵の強さ倍率は HP/STR/VIT に加えて AGI にも掛ける
  // (enemyScale は HP/STR/VIT のみ。召喚で呼ばれた仲間も _agiMul を引き継ぐ)
  // 迷宮ごとの手直し (DUNGEON_TUNE) は強さだけ: 倍率で増減した戦果 (金貨・✦Soul) を元の曲線へ戻す
  const tn = inDungeon() && !abyssActive() ? activeCfg().tune : null;
  if (tn) {
    const tm = tuneMul();
    for (const e of enemies) {
      const k = e.boss ? (tn.bossMul || 1) : e._tuneK != null ? e._tuneK : tm;
      if (k !== 1) { e.soul = Math.round((e.soul || 0) / k); e.gold = Math.round((e.gold || 0) / k); }
    }
  }
  // 戦果は推奨Lv から (levelcurve.js): 出現表の雑魚との普通の1戦が refSoul / refGold になる比で、どの敵 (精鋭・主・ミミック・金属も) の戦果も写す。
  // 推奨Lv の伸びで増えた分もここで打ち消す。召喚された仲間は _rk を引き継ぐ (combat.js)
  if (inDungeon()) {
    const rk = battleRewardK();
    for (const e of enemies) {
      e.soul = Math.max(1, Math.round((e.soul || 0) * rk[0]));
      e.gold = Math.max(1, Math.round((e.gold || 0) * rk[1]));
      e._rk = rk;
    }
  }
  const mutEm = (mutDef() && mutDef().enemyMul) || 1;
  if (mutEm !== 1) for (const e of enemies) if (!specialModifierEnemy(e)) { e._agiMul = mutEm; e.agi = Math.max(1, Math.round(e.agi * mutEm)); }
  G.battleCell = cell;
  // 迷宮の掟の開幕の効果: 敵の再生 (foeRegen) / 隊の MP を奪う (mpDrain) / 隊の HP を焼く (hpDrain)
  const trB = dungeonTrait();
  const ruleOpens = openingRules();
  // 掟が開幕に隊へ及ぼしたもの: ログだけでは分かりにくいので、開幕の演出の後に隊の札の上で見せる (playTraitOpening)
  G.partyShow = null;
  const trOpen = ruleOpens.length ? traitOpenBegin() : null;
  for (const r of ruleOpens) if (r.foeRegen) for (const e of enemies) if (!e.metal) e.regen = Math.max(e.regen || 0, r.foeRegen);
  for (const r of ruleOpens) if (r.mpDrain) {
    let drained = 0;
    const hits = [];
    for (const p of G.party) if (p.alive && p.mp > 0) { const d = Math.min(p.mp, Math.ceil(p.maxmp * r.mpDrain)); traitOpenHold(p); drained += d; p.mp -= d; hits.push({ p, text: "MP-" + d, color: "#7fb8ff" }); }
    if (drained) { log(`${ruleSay(r, "mpDrain") || `${r.head}が隊の魔力を奪った`} (MP -${drained})。`, "dmg"); trOpen.steps.push({ kind: "mp", head: r.head, accent: r.accent, label: r.name, hits }); }
  }
  // HP1 より下にはならない
  for (const r of ruleOpens) if (r.hpDrain) {
    let burnt = 0;
    const hits = [];
    for (const p of G.party) if (p.alive && p.hp > 1) { const d = Math.min(p.hp - 1, Math.ceil(p.maxhp * r.hpDrain)); traitOpenHold(p); burnt += d; p.hp -= d; hits.push({ p, text: String(d), dmg: true }); }
    if (burnt) { log(`${ruleSay(r, "hpDrain") || `${r.head}が隊を焼いた`} (HP -${burnt})。`, "dmg"); trOpen.steps.push({ kind: "heat", head: r.head, accent: r.accent, label: r.name, hits }); }
  }
  // 迷宮の掟: 疾風の巣 (trait.allHaste) — 敵はみな神速 (ターンの頭に動き、後半にもう一度動く)。主と金属の魔物は除く
  if (trB && trB.allHaste) for (const e of enemies) if (!e.boss && !e.metal && !e.haste) { e.haste = true; e.agi += 8; }
  // 迷宮の主に遭遇した: 討つ前でも図鑑に名だけ載せる (遭遇するまでは「？？？」のまま)
  for (const e of enemies) if (e.boss && e.key && MONSTERS[e.key]) { if (!G.codex.met) G.codex.met = {}; G.codex.met[e.key] = 1; }
  G.state = "combat";
  _maskEnemies = enemies;

  combatMenu.classList.remove("hidden");
  // 同種の群れは「ゴブリン ×4」とまとめて告げる (個体名は A/B/C… 付き)
  const sameKind = enemies.length > 1 && enemies.every((e) => e.key === enemies[0].key);
  // 名前は討伐数1で明かす (それまでは不確定名「小さく蠢くもの？」など。迷宮の主は最初から名乗る — 伏せるのは log の maskUnknownEnemies)
  // 名前の後に表示Lv (その魔物が一番弱く出る所と比べた実際の強さ — enemylevel.js。状態異常に使う e.lv とは別)
  log(`${sameKind ? `${enemies[0].mon.name}${enemyLvTag(enemies[0])} ×${enemies.length}` : enemies.map((e) => e.name + enemyLvTag(e)).join("・")} が現れた！`, "dmg");
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
    // 極の恵み「霧渡りの目」は奇襲を半分に
    // 夜営の番 (nightWatch): 奇襲される確率 −50/75/100%
    const nw = 1 - ([0, 0.50, 0.75, 1][Math.min(3, partyPassiveLv("nightWatch"))] || 0);
    const amb = (spFloor && spFloor.noAmbush) ? 0 : 0.08 * mutNum("ambushMul", 1) * (vig >= 2 ? 0 : vig === 1 ? 0.5 : 1) * evBoon("mistEye", "ambush", 1) * nw;
    // 追い風の階 (preempt100) では必ず先制できる。
    // 先制の心得 (initiative) で +15/25/40%、周囲警戒Lv3 で挑戦時さらに +10%
    const ini = partyPassiveLv("initiative");
    // 忍び足 (stealthStep) +10/15/20%
    const iniBonus = (ini >= 3 ? 0.40 : ini >= 2 ? 0.25 : ini >= 1 ? 0.15 : 0)
      + ([0, 0.10, 0.15, 0.20][Math.min(3, partyPassiveLv("stealthStep"))] || 0);
    // 極の恵み「守備隊の敬礼」は先手 +8%
    const pre = (spFloor && spFloor.preempt100) ? 1 : 0.08 + iniBonus + (vig >= 3 ? 0.10 : 0) + evBoon("salute", "preempt", 0);
    const r = random();
    if (r < amb) opening = "ambush";
    else if (r < amb + pre) opening = "preempt";
    ambRate = amb;
    if (opening) openSrc = "rand";
  }
  // 迷宮のイベント: 出来事が決めた開幕 (寝首/奇襲) ・ 密輸人の待ち伏せ ・ 祈りの蝋燭
  // 出来事が選択肢の文で約束した開幕 (寝込みを襲う・見つかる) は強敵の戦いにも効かせる (主の戦いは除く)
  // 迷宮の掟: どの戦闘も必ず奇襲で始まる (trait.alwaysAmbush。周囲警戒・夜営の番・先制の恵みも効かない。主の戦いは除く)。
  // ただし出来事がその場で約束した開幕 (寝首をかく・見つかる) はそちらを守る。先制の備え (蝋燭など) はこの掟の下では使わずに取っておく
  const trA = dungeonTrait();
  const forceAmb = !!(trA && trA.alwaysAmbush && !isBoss);
  if (!isBoss && G._evOpening) { opening = G._evOpening; openSrc = "event"; }
  else if (!isBoss && !forceAmb) {
    const rv = G.run && G.run.ev && inDungeon() ? G.run.ev : null;
    const inf = abyssActive();
    if (rv && rv.ambushNext > 0 && !isElite) { rv.ambushNext--; opening = "ambush"; openSrc = "smuggler"; log(inf ? "待ち伏せていた魔物に襲われた！" : "密輸人どもが荷の仕返しに待ち伏せていた！", "dmg"); }
    else if (rv && rv.preempt > 0) { rv.preempt--; opening = "preempt"; openSrc = "candle"; log(inf ? "出来事で得た備えのおかげで、先制した。" : "祈りの蝋燭の灯が、闇を味方につけた。", "win"); } // 「次の戦闘は必ず先制」— 強敵の戦いにも効く
  }
  G._evOpening = null;
  if (forceAmb && openSrc !== "event") { opening = "ambush"; openSrc = "trait"; }
  if (abyssActive()) { const trk = infTrk(); trk.fb = (trk.fb || 0) + 1; } // テスト記録の無限迷宮の欄: 階ごとの戦闘数
  evBattleStart(enemies, isBoss);
  if (opening === "preempt") { log("先制した！", "win"); showToast("⚡ 先制攻撃！", { noLog: true }); }
  else if (opening === "ambush") {
    // 奇襲: 紅い閃光・揺れ・専用の効果音で知らせ、開幕の帯 (drawAmbushIntro) と1ターン目の札で敵の先手を示す
    log("奇襲された！ 敵が先に動く！", "dmg");
    showToast("⚠ 奇襲された！ 敵が先に動く", { noLog: true, tone: "bad" });
    SFX.ambush(); flashScreen("#9a0a06"); shakeScreen(true); buzz([0, 90, 50, 90, 50, 160]);
  }
  // ランク帯ごとの戦闘テーマ (ボス・強敵は専用曲)。図鑑への記録は「倒した時」に行う (endBattle)
  playBgm(battleBgm(isBoss || isElite));
  // 敵のLv = その迷宮・階の基準Lv (状態異常・即死の成功率はLv差で決まる — combat.js lvRate)
  const foeLv = foeLevelHere();
  for (const e of enemies) e.lv = foeLv;
  // 開幕のパッシブ・迷宮の掟の冷気で掛かる強化・弱体は、開幕の演出の後に1拍ずつ見せる (演出の設定が出す時だけ)
  const modW = beginModWatch(true);
  G.battle = new Battle(G.party, enemies, log, { opening, noFlee: mutNum("noFlee", false), orderFleet: partyPassiveLv("fleetFoot"), fleeK: fleeScale(), baseAgi: partyAgi(levelHere().lv), foeLv, fervor: !!(trB && trB.fervor), foeRise: (trB && trB.foeRise) || 0, soulFeast: (trB && trB.soulFeast) || 0 });
  tlWatchBattle(G.battle, tlWhere(), id => infSupplyRecord("used", id));
  // 迷宮の掟の開幕の効果: 寒さに身がすくむ (chill) — 隊の全員の AGI を段数ぶん下げる (3ターン)
  for (const r of ruleOpens) if (r.chill) {
    const hits = [];
    for (const p of G.battle.party) if (p.alive) { G.battle._applyMod(p, "agi", Math.pow(0.8, r.chill), 3, r.name); hits.push({ p, text: `AGI${"▼".repeat(r.chill)}`, color: "#ff8a8a", buff: true }); }
    log(`${ruleSay(r, "chill") || `${r.head}が隊の足を鈍らせる`} (隊の AGI ▼${r.chill})。`, "dmg");
    if (trOpen && hits.length && !modW) trOpen.steps.push({ kind: "chill", head: r.head, accent: r.accent, label: r.name, hits });
  }
  // 底なしの闇 (gloom) — 戦闘の開幕に、隊の全員の命中が下がる (物理が外れる率をこの分だけ足す。3ターン)
  for (const r of ruleOpens) if (r.gloom > 0) {
    const hits = [];
    for (const p of G.battle.party) if (p.alive) { G.battle._applyMod(p, "hit", 1 - r.gloom, 3, r.name); hits.push({ p, text: "命中▼", color: "#c8b898", buff: true }); }
    log(`${ruleSay(r, "gloom") || `${r.head}が隊の目をくらませる`} (隊の命中 ▼)。`, "dmg");
    if (trOpen && hits.length && !modW) trOpen.steps.push({ kind: "gloom", head: r.head, accent: r.accent, label: r.name, hits });
  }
  // 飢えた獣 (foeRally) — 戦闘の開幕に、敵全体の攻撃を段数だけ上げる (3ターン。主・金属の魔物は除く)
  for (const r of ruleOpens) if (r.foeRally > 0) {
    let n = 0;
    G.battle._quietMod = true;
    for (const e of G.battle.enemies) if (e.alive && !e.boss && !e.metal) n += G.battle._applyStage(e, "atk", r.foeRally, 3, r.name) > 0 ? 1 : 0;
    G.battle._quietMod = false;
    if (n) log(`${r.head} ― 飢えた魔物たちが牙をむく (敵の攻撃 ▲${r.foeRally})。`, "dmg");
  }
  const modReveal = modW ? endModWatch() : null;
  // よどんだ瘴気 (poisonStart) — 戦闘の開幕に、隊の一人ひとりがこの確率で毒に冒される (毒の耐性で防げる)
  for (const r of ruleOpens) if (r.poisonStart > 0) {
    const sick = [];
    for (const p of G.battle.party) {
      if (!p.alive || p.ailment) continue;
      if (random() < r.poisonStart * (1 - G.battle._ailRes(p, "poison"))) {
        traitOpenHold(p);
        p.ailment = "poison"; p._poisonPct = 0.05; G.battle._holdAil(p, "poison"); sick.push(p);
      }
    }
    if (sick.length) {
      log(`${ruleSay(r, "poisonStart") || r.head} ― ${sick.map((p) => p.name).join("・")}は毒に冒された。`, "dmg");
      if (trOpen) trOpen.steps.push({ kind: "poison", head: r.head, accent: r.accent, label: r.name, hits: sick.map((p) => ({ p, text: "毒", color: "#b4f06a" })) });
    }
  }
  // 落雷 (boltStart) — 戦闘の開幕に、隊の一人へ雷が落ちて最大HPのこの割合を焼く (ブレス耐性で和らぐ。HP1 は残る)
  for (const r of ruleOpens) if (r.boltStart > 0) {
    const live = G.battle.party.filter((p) => p.alive && p.hp > 1);
    if (live.length) {
      const p = live[rand(live.length)];
      const d = Math.min(p.hp - 1, Math.max(1, Math.ceil(p.maxhp * r.boltStart * (1 - partyBreathRes(p)))));
      traitOpenHold(p);
      p.hp -= d;
      log(`${ruleSay(r, "boltStart") || r.head} ― ${p.name}が焼かれた (HP -${d})。`, "dmg");
      if (trOpen) trOpen.steps.push({ kind: "bolt", head: r.head, accent: r.accent, label: r.name, hits: [{ p, text: String(d), dmg: true }] });
      else flashScreen("#d8e0ff");
    }
  }
  // ささやく湖面 (whisper 混乱) / 響く聖歌 (lull 眠り) / 帯電した手すり (jolt 麻痺) — 戦闘の開幕に、隊の一人がこの確率で掛かる (その抵抗で防げる)
  for (const r of ruleOpens) for (const o of RULE_ONE_AIL) if (r[o.key] > 0) {
    const live = G.battle.party.filter((p) => p.alive && o.free(p));
    if (!live.length) continue;
    const p = live[rand(live.length)];
    if (random() < r[o.key] * (1 - G.battle._ailRes(p, o.res))) {
      traitOpenHold(p);
      o.put(G.battle, p);
      log(`${ruleSay(r, o.key) || r.head} ― ${p.name}${o.hit}。`, "dmg");
      if (trOpen) trOpen.steps.push({ kind: o.key, head: r.head, accent: r.accent, label: r.name, hits: [{ p, text: o.text, color: o.color }] });
    } else log(`${ruleSay(r, o.key) || r.head} ― ${p.name}${o.miss}。`, "sys");
  }
  // 出来事で受けた眠り・魅了・混乱 (evApi.ail が覚えた分): この戦闘の開幕に掛かる
  const rvA = inDungeon() && G.run && G.run.ev && G.run.ev.nextAil;
  if (rvA) {
    delete G.run.ev.nextAil;
    for (const [uid, kind] of Object.entries(rvA)) {
      const p = G.battle.party.find((x) => x && String(x.uid) === uid && x.alive);
      const o = EV_BATTLE_AIL[kind];
      if (!p || !o || p.mind || p.asleep) continue;
      o.put(G.battle, p);
      log(`${p.name}${o.hit}。`, "dmg");
    }
  }
  // 封じの殻 (shell) — 戦闘の開幕に、主・金属の魔物を除く敵の全員に障壁 (打撃を1回だけ半ば防ぐ) を張る
  for (const r of ruleOpens) if (r.shell > 0) {
    let n = 0;
    for (const e of G.battle.enemies) if (e.alive && !e.boss && !e.metal) { e._barrierLeft = (e._barrierLeft || 0) + r.shell; n++; }
    if (n) log(`${r.head} ― 魔物たちが眠りの封じの殻をまとった (障壁)。`, "sys");
  }
  if (trB && trB.foeRise) log(`${trB.name} ― 倒れた魔物は、一度だけ起き上がってくる。`, "sys");
  if (trB && trB.fervor) log("観客の歓声が戦う者を煽る ― 2ターン目から、敵も味方も攻撃が上がっていく。", "sys");
  // 闘技場跡の迷宮の掟 (audience): 観客の注文をひとつ出す (応えて勝てば、この戦闘の ✦Soul・金貨 1.5倍 — endBattle)
  G.battle.audience = audienceOrderFor(enemies);
  if (G.battle.audience) {
    const o = AUDIENCE_ORDERS[G.battle.audience];
    log(`観客の注文 ―「${o.label}」(応えて勝てば ✦Soul・金貨 ${AUDIENCE_MUL}倍)`, "sys");
    setTimeout(() => showToast(`♛ 観客の注文:「${o.label}」`, { tone: "info", noLog: true }), 500);
  }
  if (physOnlyHere()) log("呪文を封じる霧が立ちこめている ― 物理技と道具のほかは使えない。", "sys");
  if (foeLv - partyLevel() >= 4) log(`格上の迷宮だ (推奨Lv${foeLv})。眠りや毒、即死の術はほとんど効かず、敵の術はよく効く。`, "sys");
  // テスト記録: 戦闘の種類 (主 / 金属の魔物 / 精鋭・ミミック・出来事の戦い / 通常) と開始時の様子。
  // 金属の魔物は素早さに依らない回避を持つので、精鋭等の命中に混ぜない
  if (tlOn() && inDungeon() && !G.rematch) {
    const kind = isBoss ? "b" : enemies.some((e) => e.metal) ? "m" : (isElite || enemies.some((e) => e.isMimic) || (cell && cell.evFight)) ? "e" : "n";
    G.battle.tl = tlBattleBegin({ where: tlWhere(), kind, opening, openSrc, ambRate, party: G.party, enemies });
  }
  _maskEnemies = null;
  G.fx = null;
  G.animating = false;
  G.enemyPos = {};
  if (G.partyFx) G.partyFx.clear();
  G.partyFxV = null;
  clearPartyCalls();
  autosave(true); // 戦闘開始を保存
  // 居合・開幕呪撃の演出を先に流してから手番処理へ (発動を視覚的に伝える)
  const opens = G.battle.openingResults || [];
  playBattleIntro(() => playTraitOpening(trOpen, () => playModReveal(modReveal, () => {
    if (opens.length) { renderCombat(); playOpeningStrikes(opens, 0, combatStep); }
    else combatStep(); // 素早い敵が先手なら自動で動く
  })));
}

// 出来事で掛かる、戦闘の中だけの異常 (evApi.ail → 次の戦闘の開幕に startBattleMeasured が掛ける)
const EV_BATTLE_AIL = {
  sleep: { text: "眠り", hit: "は眠りに落ちている", put: (b, p) => { p.asleep = true; b._holdAil(p, "sleep"); } },
  charm: { text: "魅了", hit: "は魅了されている", put: (b, p) => { p.mind = "charm"; b._holdAil(p, "mind"); } },
  confuse: { text: "混乱", hit: "は混乱している", put: (b, p) => { p.mind = "confuse"; b._holdAil(p, "mind"); } },
};
// 迷宮の掟の開幕に隊の一人へ掛かる異常 (startBattleMeasured)。free = まだ掛かっていない者 / put = 掛ける
const RULE_ONE_AIL = [
  { key: "whisper", res: "confuse", text: "混乱", color: "#c8a0ff", hit: "は惑わされ、混乱した", miss: "は耳をふさいで、惑わされなかった",
    free: (p) => !p.mind && !p.asleep, put: (b, p) => { p.mind = "confuse"; b._holdAil(p, "mind"); } },
  { key: "lull", res: "sleep", text: "眠り", color: "#a0c0ff", hit: "は歌に聞き入り、眠りに落ちた", miss: "は歌に引きこまれず、眠らなかった",
    free: (p) => !p.mind && !p.asleep, put: (b, p) => { p.asleep = true; b._holdAil(p, "sleep"); } },
  { key: "jolt", res: "paralyze", text: "麻痺", color: "#f0e080", hit: "はしびれて、動けなくなった", miss: "はしびれをこらえた",
    free: (p) => !p.ailment, put: (b, p) => { p.ailment = "paralyze"; b._holdAil(p, "para"); } },
];

// ===== 迷宮の掟の開幕の演出 (ユーザーの指示、2026-10: 戦闘開始時の傷・吸われた魔力・毒・冷気がログだけでは分からない) =====
// 掟の効果は startBattle の中で今までどおり同期で効かせ (テスト記録の出どころの分類もそのまま)、
// 隊の札にだけ効く前の HP/MP を見せておく (G.partyShow)。開幕の演出の後、効果ごとに隊の札の上で属性の演出・数字・
// 掟の名を出し、その瞬間に札の値を本当の値へ戻す。戦闘の進行・乱数には触れない
function traitOpenBegin() {
  G.partyShow = new Map();
  return { steps: [] };
}
function traitOpenHold(p) {
  if (G.partyShow && !G.partyShow.has(p)) G.partyShow.set(p, { hp: p.hp, mp: p.mp, ailment: p.ailment || null });
}
// 効果ごとの見せ方: 戦場の演出 (battlefx) ・札の膜 (.pc-fx) ・効果音
const TRAIT_OPEN_FX = {
  heat:   { fx: "fire",   card: "el-fire",  sfx: () => SFX.fire() },
  bolt:   { fx: "light",  card: "el-light", sfx: () => SFX.thunder(), flash: "#d8e0ff" },
  mp:     { fx: "earth",  card: "el-earth", sfx: () => SFX.spell() },
  chill:  { fx: "water",  card: "debuff",   sfx: () => SFX.spell() },
  poison: { fx: "poison", card: "status",   sfx: () => SFX.spell() },
  gloom:  { fx: "dark",   card: "debuff",   sfx: () => SFX.spell() },
  whisper: { fx: "dark",  card: "status",   sfx: () => SFX.spell() },
  lull:   { fx: "light",  card: "status",   sfx: () => SFX.spell() },
  jolt:   { fx: "light",  card: "status",   sfx: () => SFX.thunder(), flash: "#f0f0b0" },
};
function playTraitOpening(info, done) {
  const finish = () => { G.partyShow = null; renderParty(); done(); };
  if (!info || !info.steps.length || !G.battle) { finish(); return; }
  const b = G.battle;
  let i = 0;
  const next = () => {
    if (G.battle !== b) { G.partyShow = null; return; }
    if (i >= info.steps.length) { G.animating = false; finish(); return; }
    const step = info.steps[i++];
    if (REDUCED_MOTION) {
      for (const h of step.hits) { if (G.partyShow) G.partyShow.delete(h.p); setPartyCall(h.p, step.label, "proc", false); }
      next();
      return;
    }
    playTraitStep(info, step, i === 1 || info.steps[i - 2].head !== step.head, next);
  };
  next();
}
function playTraitStep(info, step, first, done) {
  const spd = spdMul();
  const look = TRAIT_OPEN_FX[step.kind] || TRAIT_OPEN_FX.heat;
  const t0 = performance.now();
  const WIND = 160 * spd;
  const TOTAL = WIND + (520 + Math.max(0, step.hits.length - 1) * 40) * spd;
  G.animating = true;
  G.fx = { lunge: null, slashes: [], skill: [], floats: [], screen: null, flash: {}, deaths: [] };
  G.partyFx = G.partyFx || new Map();
  G.partyFxV = new Map();
  partyEl.style.setProperty("--fxd", Math.max(0.2, Math.min(0.6, 0.4 * spd)).toFixed(2) + "s");
  // 掟の名を隊の札の上に掲げる (同じ掟の2つ目からは効果の名だけ)
  G.fx.floats.push({ x: VW / 2, y: VH - 92, text: first ? step.head : step.label, color: step.accent || "#ffd27a", t0, kind: "trait" });
  let impacted = false;
  const tick = () => {
    if (!G.fx || G.state !== "combat") { done(); return; }
    const now = performance.now(), t = now - t0;
    if (!impacted && t >= WIND) {
      impacted = true;
      look.sfx();
      let hurt = false;
      step.hits.forEach((h, k) => {
        // 隊の札は3枚ずつ2段: 後衛の数字は前衛の下に少しずらして重ならないようにする
        const p = h.p, back = G.party.length >= 4 && G.party.indexOf(p) >= 3;
        const x = partyFxX(p) + (back ? 22 : 0), at = now + k * 40 * spd, y = back ? VH - 18 : VH - 50;
        if (G.partyShow) G.partyShow.delete(p); // 札の値をここで本当の値へ
        spawnFx(G.fx.skill, look.fx, x, VH - 22, at, spd, { seed: k + 7, s: step.kind === "bolt" ? 1 : 0.75 }); // 落雷は天から降る光の柱
        G.partyFx.set(p, "hit");
        setPartyFxV(p, look.card);
        setPartyCall(p, step.label, "proc", false);
        if (h.dmg) { hurt = true; G.fx.floats.push({ x, y, text: h.text, color: "#ff6b6b", t0: at, kind: "pdmg" }); }
        else G.fx.floats.push({ x, y, text: h.text, color: h.color || "#fff", t0: at, kind: h.buff ? "buff" : "info" });
      });
      if (look.flash) flashScreen(look.flash);
      if (hurt) { G.fx.screen = { color: "#d4504e", t0: now }; buzz([0, 50, 50, 50]); shakeScreen(true); }
      else buzz(20);
      renderParty();
    }
    renderCombatCanvas();
    if (t >= TOTAL) {
      G.fx = null;
      G.partyFx.clear();
      if (G.partyFxV) G.partyFxV.clear();
      renderParty();
      done();
    } else requestAnimationFrame(tick);
  };
  renderParty();
  requestAnimationFrame(tick);
}

// ===== 強化・弱体の演出 (ユーザーの指示、2026-10: 技・パッシブ・迷宮の掟で掛かった強化・弱体を、記録・演出と同じ時に札へ出す) =====
// combat.js が掛かった強化・弱体を1つずつ知らせ (setModSink → G.modFeed)、game.js はその間の札を掛かる前の効果のまま見せる (G.effShow)。
//  ・戦闘の始まり (開幕のパッシブ・迷宮の掟の冷気) とターンの初め (毎ターンのパッシブ・激昂) = 掛けた技・パッシブ・掟ごとに1拍の演出
//    (playModReveal)。記録の行もその拍まで待たせる (G.logHold)
//  ・手番の行動 (技・道具・敵の特技・その中で発動したパッシブ) = 着弾の瞬間に札を出す。技に付かない発動 (倒した時・当てた時の
//    パッシブなど) には着弾の時に札の上へ文字と光を足す
// 演出を出すかは設定「強化・弱体の演出」(PREFS.buffFx)。出さない時は札も記録もすぐ出す (以前のまま)。判定・乱数には触れない
setModSink((ev) => { if (G.modFeed) G.modFeed.push(ev); });
function modFxOn() { return PREFS.buffFx !== false && !REDUCED_MOTION; }
// 札に見せる効果 (演出を待つ間は掛かる前の写し)
function shownEffects(a) { return (G.effShow && G.effShow.has(a)) ? G.effShow.get(a) : a.effects; }
// 記録を集め始める。lines = 記録欄の行も演出まで待たせる
function beginModWatch(lines) {
  if (!modFxOn()) return false;
  G.modFeed = [];
  if (lines && !G.logHold) G.logHold = [];
  return true;
}
// 集めた記録を拍 (掛けた技・パッシブ・掟ごと) に分け、札を掛かる前の効果に留める。何も無ければ待たせた行をそのまま出す
function endModWatch() {
  const feed = G.modFeed;
  G.modFeed = null;
  const lines = G.logHold || [];
  G.logHold = null;
  if (!feed) { for (const l of lines) writeLog(l.msg, l.cls); return null; }
  const steps = [];
  feed.forEach((ev, i) => {
    let st = steps[steps.length - 1];
    if (!st || st.src !== ev.src) steps.push(st = { src: ev.src, evs: [], end: 0 });
    st.evs.push(ev);
    st.end = i + 1;
  });
  if (!steps.length) { for (const l of lines) writeLog(l.msg, l.cls); return null; }
  // 発動の名 (combat.js _proc) も、その拍まで札に出さない
  const q = G.battle && G.battle.procs;
  if (q && q.length) {
    const keep = [];
    for (const pr of q) { const st = steps.find((x) => x.src === pr.label); if (st) (st.procs || (st.procs = [])).push(pr); else keep.push(pr); }
    q.splice(0, q.length, ...keep);
  }
  G.effShow = G.effShow || new Map();
  for (const ev of feed) if (!G.effShow.has(ev.t)) G.effShow.set(ev.t, ev.before);
  return { steps, lines };
}
// 待たせた行のうち、seq がこの拍の終わりまでのものを記録欄へ (mw なし = 待たせた行すべて)
function flushModLines(mw, end) {
  const held = mw ? mw.lines : G.logHold;
  if (!held || !held.length) return;
  const out = held.filter((l) => l.seq <= end);
  if (mw) mw.lines = held.filter((l) => l.seq > end);
  else G.logHold = null;
  for (const l of out) writeLog(l.msg, l.cls);
}
// 拍の中の対象ごとの動き: { t, mods: {能力: 倍率}, up, after }
function modTargets(evs) {
  const by = new Map();
  for (const ev of evs) {
    const o = by.get(ev.t) || { t: ev.t, d: {}, after: null };
    o.d[ev.stat] = (o.d[ev.stat] || 0) + ev.d;
    o.after = ev.after;
    by.set(ev.t, o);
  }
  return [...by.values()].map((o) => {
    const mods = {};
    let sum = 0;
    for (const k in o.d) {
      if (!o.d[k]) continue;
      mods[k] = STAGED.has(k) ? stageMul(Math.max(-3, Math.min(3, o.d[k]))) : o.d[k] > 0 ? 1.25 : 0.8;
      sum += Math.sign(o.d[k]);
    }
    return { t: o.t, mods, up: sum >= 0, after: o.after };
  }).filter((o) => Object.keys(o.mods).length);
}
// 対象の上に強化・弱体の光と文字を出す (now = 出す時刻。label = 掛けた技・パッシブ・掟の名、出す時だけ)
function spawnModFx(tg, now, spd, i, label) {
  const t = tg.t, mt = buffFloatText({ buff: tg.up, mods: tg.mods, target: t });
  if (t.side === "enemy") {
    const pos = G.enemyPos[t.uid];
    if (!pos || !t.alive) return;
    spawnFx(G.fx.skill, tg.up ? "rise" : "hex", pos.cx, pos.cy, now, spd, { seed: (t.uid || 1) * 17 + i, col: tg.up ? "#ffd84a" : null });
    G.fx.floats.push({ x: pos.cx, y: pos.cy - 34, text: mt.text, color: mt.color, t0: now, kind: "buff" });
    if (label) G.fx.floats.push({ x: pos.cx, y: pos.cy - 52, text: label, color: "#e7d3ff", t0: now + 40 * spd, small: true, kind: "label" });
  } else {
    if (!t.alive || !G.party.includes(t)) return;
    const back = G.party.length >= 4 && G.party.indexOf(t) >= 3;
    const x = partyFxX(t) + (back ? 22 : 0), y = back ? VH - 18 : VH - 50;
    spawnFx(G.fx.skill, tg.up ? "rise" : "hex", x, VH - 22, now, spd, { seed: i + 11, s: 0.7, col: tg.up ? "#ffd84a" : null });
    setPartyFxV(t, tg.up ? "buff" : "debuff");
    if (label) setPartyCall(t, label, "proc", false);
    G.fx.floats.push({ x, y, text: mt.text, color: mt.color, t0: now, kind: "buff" });
  }
}
// 戦闘の始まり・ターンの初めの強化・弱体を、掛けた技・パッシブ・掟ごとに1拍ずつ見せる
function playModReveal(mw, done) {
  if (!mw) { done(); return; }
  const b = G.battle;
  let i = 0;
  const finish = () => { flushModLines(mw, Infinity); G.effShow = null; renderParty(); };
  const next = () => {
    if (G.battle !== b || G.state !== "combat") { finish(); return; }
    if (i >= mw.steps.length) { finish(); done(); return; }
    playModStep(mw, mw.steps[i++], next);
  };
  next();
}
function playModStep(mw, step, done) {
  const spd = spdMul();
  const t0 = performance.now();
  const WIND = 90 * spd;
  const tgs = modTargets(step.evs);
  const TOTAL = WIND + (400 + Math.max(0, tgs.length - 1) * 30) * spd;
  G.animating = true;
  G.fx = { lunge: null, slashes: [], skill: [], floats: [], screen: null, flash: {}, deaths: [] };
  G.partyFx = G.partyFx || new Map();
  G.partyFxV = new Map();
  partyEl.style.setProperty("--fxd", Math.max(0.2, Math.min(0.5, 0.36 * spd)).toFixed(2) + "s");
  let impacted = false;
  const tick = () => {
    if (!G.fx || G.state !== "combat") { done(); return; }
    const now = performance.now(), t = now - t0;
    if (!impacted && t >= WIND) {
      impacted = true;
      flushModLines(mw, step.end);
      // 掛けた技・パッシブ・掟の名: 味方に掛かったものは隊の札の上、敵だけなら敵の列の上
      const foes = tgs.filter((g) => g.t.side === "enemy" && G.enemyPos[g.t.uid]);
      if (step.src) {
        if (foes.length === tgs.length) {
          const ys = foes.map((g) => G.enemyPos[g.t.uid].cy), xs = foes.map((g) => G.enemyPos[g.t.uid].cx);
          G.fx.floats.push({ x: (Math.min(...xs) + Math.max(...xs)) / 2, y: Math.max(28, Math.min(...ys) - 70), text: step.src, color: "#ffd27a", t0: now, kind: "trait" });
        } else G.fx.floats.push({ x: VW / 2, y: VH - 92, text: step.src, color: "#ffd27a", t0: now, kind: "trait" });
      }
      for (const pr of step.procs || []) if (G.party.includes(pr.who)) setPartyCall(pr.who, pr.label, "proc", false);
      tgs.forEach((g, k) => {
        G.effShow.set(g.t, g.after); // 札をこの拍の後の効果へ
        spawnModFx(g, now + k * 30 * spd, spd, k, g.t.side === "enemy" ? null : step.src);
      });
      if (tgs.some((g) => !g.up)) SFX.spell(); else SFX.heal();
      buzz(15);
      renderParty();
    }
    renderCombatCanvas();
    if (t >= TOTAL) {
      G.fx = null;
      G.partyFx.clear();
      if (G.partyFxV) G.partyFxV.clear();
      renderParty();
      done();
    } else requestAnimationFrame(tick);
  };
  renderParty();
  requestAnimationFrame(tick);
}
// 手番の行動: 行動の前の全員の効果を写しておき、着弾まで札をそのままにする (演出の設定に依らない — 一手の時間は変わらない)
function holdActionEffects() {
  G.effShow = new Map();
  for (const a of [...G.battle.party, ...G.battle.enemies]) G.effShow.set(a, (a.effects || []).map((e) => ({ ...e })));
  G.modFeed = modFxOn() ? [] : null;
}
function takeModFeed() { const f = G.modFeed; G.modFeed = null; return f; }
// 着弾の瞬間: 札を本当の効果へ。技の当たりに付かない強化・弱体 (倒した時・当てた時のパッシブなど) には光と文字を足す
function releaseActionEffects(res, feed) {
  G.effShow = null;
  if (!feed || !feed.length || !G.fx) return;
  const shown = new Set((res.hits || []).filter((h) => h && h.target && (h.buff || h.debuff || (h.mods && Object.keys(h.mods).length))).map((h) => h.target));
  const own = res.spellName || "";
  const spd = spdMul(), now = performance.now();
  const steps = [];
  for (const ev of feed) {
    if (shown.has(ev.t) || (own && ev.src === own)) continue;
    let st = steps[steps.length - 1];
    if (!st || st.src !== ev.src) steps.push(st = { src: ev.src, evs: [] });
    st.evs.push(ev);
  }
  let k = 0;
  for (const st of steps) for (const g of modTargets(st.evs)) spawnModFx(g, now + 60 * spd + k * 30 * spd, spd, k++, st.src);
}

// 戦闘開始時の自動攻撃 (死の宣告/居合/開幕呪撃) を1つずつ演出で見せる
function playOpeningStrikes(list, i, done) {
  if (i >= list.length) { done(); return; }
  const res = list[i];
  G.animating = true;
  if (res.opening === "senkoku") showToast(`☠ 死の宣告！ ${res.hits.length}体の魂を刈り取った`);
  else if (res.opening === "iai") showToast("⚡ 居合！");
  else if (res.opening === "openSpell") showToast("✦ 開幕呪撃！");
  animateResult(res, () => playOpeningStrikes(list, i + 1, done));
}

// 全体描画 (キャンバス + 隊 + メニュー)
function renderCombat() {
  if (!G.animating) drainPartyProcs(); // 戦闘の始まり・ターンの初めに発動した効果 (手番の外)
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
    dungeonId: activeCfg().id,
    boss: b.enemies.some((e) => e.boss),
    elite: b.enemies.some((e) => e.mon && e.mon.elite),
  });

  // 戦場の縦の伸び (縦長の戦場ほど魔物を大きく)
  const k = Math.max(0.92, Math.min(1.3, VH / 280));
  // 隊列: 4体以上は前衛(先頭3体)・後衛(4体目以降)の2列に分かれる。
  // 後衛を上、前衛を下の帯に置く。
  const frontRow = b.enemies.slice(0, 3);
  const backRow = b.enemies.slice(3);
  const rows = backRow.length
    ? [{ list: backRow, back: true }, { list: frontRow, back: false }]
    : [{ list: frontRow, back: false }];
  const intro = G.battleIntro && G.battleIntro.battle === b ? G.battleIntro : null;
  // 奇襲の1ターン目は、魔物の下に紅い縁と「敵が先に動く」の札を敷く (名札が重なれば名札を優先)
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
  for (const row of rows) {
    row.plates = row.list.map((e) => enemyPlateLayout(e, VW / row.list.length - 12));
    row.plateH = Math.max(...row.plates.map((p) => p.height));
  }
  const bandH = VH / rows.length;
  // 上端10 + 絵と名札の間7 + HPと札の間11 + 効果札12 + 下端6。
  // 名札だけでなくHPの下の効果札まで、各列の帯の内側に収める。
  const rowExtraH = 10 + 7 + 11 + 12 + 6;
  const sizeOf = (e, back, n) => {
    let sz = (e.boss ? 14 : (e.mon && e.mon.elite ? 1.15 : 1) * (back ? 8 : 9)) * k;
    if (e.mon && (e.mon.art || e.mon.photo)) {
      const bm = monsterBitmap(e.mon);
      const unit = Math.max(12, bm.w, bm.h) / 12;
      const slot = VW / n - 16;
      sz = Math.min(sz, (slot / (bm.w + bm.pad * 2)) * unit);
    }
    // 名札と効果の札を残し、背の高い魔物も戦場からはみ出させない。
    const row = rows.find((r) => r.back === back);
    const maxHalfH = Math.max(8, (bandH - row.plateH - rowExtraH) / 2);
    return Math.min(sz, sz * maxHalfH / monsterHalfH(e.mon, sz));
  };
  for (const row of rows) {
    const { plates, plateH } = row;
    // この列の名札の高さを揃える (いちばん背の高い魔物の足元の下)
    let foot = 0;
    for (const e of row.list) { const hh = monsterHalfH(e.mon, sizeOf(e, row.back, row.list.length)); foot = Math.max(foot, hh); }
    // 前後それぞれの帯に姿と名前を収め、名札が別の敵に隠れないようにする。
    const bandTop = rows.indexOf(row) * bandH;
    row.y = bandTop + 10 + (bandH - plateH - rowExtraH) / 2;
    const plateY = row.y + foot + 7;
    row.list.forEach((e, i) => {
      const baseX = (VW / row.list.length) * (i + 0.5);
      const baseY = row.y;
      const size = sizeOf(e, row.back, row.list.length);
      const hh = monsterHalfH(e.mon, size);
      G.enemyPos[e.uid] = { cx: baseX, cy: baseY, r: 70 * k, hh, size, plate: { x: baseX - plates[i].width / 2, y: plateY, w: plates[i].width, h: plates[i].height } };
      // 逃げ出した敵 (金属の魔物): 逃げる演出の間だけ、横へ駆け去る姿を描く
      const fleeFx = e._fled && fx && fx.fleeAway && fx.fleeAway.uid === e.uid ? fx.fleeAway : null;
      if (e._fled && !fleeFx) return;
      // 倒した敵: 撃破の演出 (drawEffects の崩れ落ち) が始まるまでは姿を残し、以後は描かない
      if (!e.alive && !fleeFx) {
        const d = fx && fx.deaths ? fx.deaths.find((x) => x.uid === e.uid) : null;
        // 開幕 (死の宣告・居合・開幕呪撃) に倒れた敵は、開幕の演出で崩れ落ちるまで姿を残す
        const pending = e._openDeath && !d && !_deadShown.has(e);
        if (!pending && (!fx || _deadShown.has(e) || (d && now >= d.t0))) { if (!fx || d) _deadShown.add(e); return; }
      }
      let ox = 0, oy = 0, alpha = 1;
      if (fleeFx) {
        const fp = Math.max(0, Math.min(1, (now - fleeFx.t0) / fleeFx.dur));
        ox = fp * fp * VW * 0.75 * (baseX < VW / 2 ? -1 : 1);
        oy = -Math.abs(Math.sin(fp * Math.PI * 3)) * 6 * k; // ちょこちょこ跳ねて去る
        alpha = 1 - fp * fp;
        if (alpha <= 0.01) return;
      }
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
          if (col > 0 && (e.mon.art || e.mon.photo)) drawMonsterBmp(vctx, enemyBitmap(e), baseX, baseY + rise, sz, alpha * col * col);
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
      if (e.mon && (e.mon.art || e.mon.photo)) drawMonsterBmp(vctx, enemyBitmap(e), baseX + ox, baseY + oy, size, alpha);
      // 被弾時の白い閃き (魔物の形に沿って)
      if (hf && now - hf.t0 >= 0 && now - hf.t0 < 170) {
        vctx.save();
        vctx.globalCompositeOperation = "lighter";
        drawMonsterBmp(vctx, monsterFlashBitmap(e.mon), baseX + ox, baseY + oy, size, 0.85 * (1 - (now - hf.t0) / 170));
        vctx.restore();
      }
      // 対象選択中: 頭上に降りるくさびと四隅のかぎ
      if (tappable && strongTarget) drawTargetBrackets(baseX, baseY, hh, size, now);
      // 名札 + 血の小瓶 (HP)
      // 名前・HP は討伐数で明かす (enemyReveal): 名前は1体倒すまで不確定名、HP の小瓶は5体倒すまで出さない (迷宮の主は名前が最初から、HP は1体で)
      if (fleeFx) return; // 逃げる姿には名札を付けない
      drawEnemyPlate(e, baseX, plateY, tappable && strongTarget, plates[i]);
      const hpY = plateY + plateH + 2;
      const showHp = enemyReveal(e).stats;
      if (showHp) drawEnemyHpVial(e, baseX, hpY, now, k);
      // 状態異常と強化・弱体の札は名前の下 (HP の小瓶があればその下)。
      const statY = showHp ? hpY + 9 : plateY + plateH + 3;
      drawEnemyBadges(e, baseX, statY);
    });
  }

  if (fx) drawEffects(fx, now);
  if (intro) drawBattleIntro(intro, now);
  renderTurnOrder();
}

// ===== 行動順の帯 (記録欄の上): 手番の者を先頭に、このターンでまだ動いていない者をアイコンで並べる =====
// 戦場を描くたびに呼ばれるので、並びが変わった時だけ作り直す
const turnOrderEl = document.getElementById("turn-order");
let _turnOrderKey = "";
const _turnIcons = new WeakMap(); // 敵の魔物 → { b: 元にした絵, c: アイコンの canvas }
const _turnPics = new WeakMap();  // 人業 → { key, c } (胸像)
const TURN_ICON_PX = 24;
function turnIconCanvas(a) {
  if (a.side === "party") {
    if (!a.isDoll || a.primary == null) return null;
    const key = dollLookKey(a);
    let ent = _turnPics.get(a);
    if (!ent || ent.key !== key) { ent = { key, c: crispCanvas(dollBust(a), TURN_ICON_PX) }; _turnPics.set(a, ent); }
    return ent.c;
  }
  const mon = a.mon;
  if (!mon || !(mon.art || mon.photo)) return null;
  const b = enemyBitmap(a); // 名前のわからない敵は影の姿
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
  const omenOf = (a) => a.side === "enemy" && (a.effects || []).some((e) => e.stat === "omen");
  const list = [b.current, ...b.queue.filter((a) => a && a.alive && a !== b.current)];
  const key = `${b._roundNo}|` + list.map((a) => `${a.side}${a.uid != null ? a.uid : a.name}${a.alive ? "" : "x"}${stunOf(a)}${omenOf(a) ? "!" : ""}${a.side === "enemy" ? enemyLabel(a) : ""}`).join(",");
  if (key === _turnOrderKey) return;
  _turnOrderKey = key;
  turnOrderEl.innerHTML = "";
  turnOrderEl.classList.remove("hidden");
  const used = new Set();
  list.forEach((a, i) => {
    const enemy = a.side === "enemy";
    const name = enemy ? enemyLabel(a) : a.name;
    const st = stunOf(a);
    const ic = el("div", `to-ic ${enemy ? "e" : "p"}${i === 0 ? " now" : ""}${!a.alive ? " dead" : ""}${st === "z" ? " stun" : st === "m" ? " mind" : ""}${a.boss ? " boss" : ""}${omenOf(a) ? " omen" : ""}`);
    ic.title = (i === 0 ? "手番: " : "") + name + (omenOf(a) ? " (大技の予兆)" : "");
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
    else ic.appendChild(el("span", "to-ch", (name || "？").slice(0, 1)));
    // 同種が並ぶ敵は A/B… の札を添えて見分ける
    if (enemy) {
      const m = /[A-Z]$/.exec(name || "");
      if (m) ic.appendChild(el("span", "to-tag", m[0]));
      if (omenOf(a)) ic.appendChild(el("span", "to-omen", "溜"));
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
// 対象選択中の印: 頭上のくさび (上下に揺れる) と、魔物を囲む四隅のかぎ
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
  // くさび (下向きの刃)
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

// 敵の名札: 両端の尖った黒鉄の札。主は金、強敵は紅の縁。属性 (明かされていれば) は札の右に印で添える
const ENEMY_SEAL = { poison: ["毒", "#8ee05a"], paralyze: ["痺", "#ffd84a"], stone: ["石", "#c9c4b8"] };
const MIND_SEAL = { charm: ["魅", "#ff8fc8"], confuse: ["乱", "#ffa860"] };
// 名前は戦場の高さでは縮めず、長いものは札の幅で折り返す。
function enemyPlateLayout(e, maxWidth) {
  vctx.save();
  vctx.font = `800 16px ${CANVAS_SERIF}`;
  const lines = [];
  let line = "";
  for (const part of phrase(enemyLabel(e)).split(ZWSP)) {
    if (line && vctx.measureText(line + part).width > maxWidth - 38) {
      lines.push(line); line = "";
    }
    // 一つの文節だけで幅を超える場合に限り、字ごとに折る。
    for (const ch of part) {
      if (line && vctx.measureText(line + ch).width > maxWidth - 38) {
        lines.push(line); line = "";
      }
      line += ch;
    }
  }
  if (line) lines.push(line);
  const width = Math.max(...lines.map((s) => vctx.measureText(s).width)) + 22;
  vctx.restore();
  return { lines, width, height: lines.length * 19 + 5 };
}
function drawEnemyPlate(e, x, y, hot, plate) {
  vctx.save();
  vctx.font = `800 16px ${CANVAS_SERIF}`;
  vctx.textAlign = "center"; vctx.textBaseline = "middle";
  const pw = plate.width, ph = plate.height, x0 = x - pw / 2, x1 = x + pw / 2;
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
  // 不確定名 (まだ名を知らない敵) は淡い藤色で、正式な名と見分ける
  vctx.fillStyle = enemyUnknown(e) ? UNKNOWN_COLOR : e.boss ? "#ffe0a0" : "#efe3cb";
  vctx.shadowColor = "#000"; vctx.shadowBlur = 0; vctx.shadowOffsetY = 1;
  plate.lines.forEach((line, i) => vctx.fillText(line, x, y + 12 + i * 19));
  vctx.shadowOffsetY = 0;
  // 右に添える印は属性だけ (図鑑で属性が明かされた敵 / 弱点看破)。状態異常は名前の下の札 (enemyAilSeals → drawEnemyBadges)
  if (e.element && e.element !== "none" && ELEMENTS[e.element] && enemyElemKnown(e)) {
    const el2 = ELEMENTS[e.element], sx = x1 + 9;
    vctx.font = `800 9px ${CANVAS_SERIF}`;
    vctx.fillStyle = "rgba(6,4,6,0.9)";
    vctx.beginPath(); vctx.arc(sx, y + ph / 2, 7, 0, Math.PI * 2); vctx.fill();
    vctx.strokeStyle = el2.color || "#ccc"; vctx.lineWidth = 1; vctx.stroke();
    vctx.fillStyle = el2.color || "#ccc";
    vctx.fillText(el2.label || "?", sx, y + ph / 2 + 0.5);
  }
  vctx.restore();
}
// 名前の下に並べる状態異常の印 (毒・麻痺・石化 / 眠り / 魅了・混乱 / 怯み): [字, 色]
function enemyAilSeals(e) {
  const seals = [];
  if (e.ailment) seals.push(ENEMY_SEAL[e.ailment] || ["呪", "#c080ff"]);
  if (e.asleep) seals.push(["眠", "#8fc8ff"]);
  if (e.mind && MIND_SEAL[e.mind]) seals.push(MIND_SEAL[e.mind]);
  if (e._flinch) seals.push(["怯", "#d0a0ff"]);
  return seals;
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
  const a = cl((t - 40) / 160) * cl((intro.dur - t) / Math.min(320, intro.dur * 0.3)); // 短い演出 (オート) でも帯が読める間を残す
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

// 奇襲の1ターン目 (敵だけが動く間): 戦場の縁を薄く紅く脈打たせ、上端に「奇襲 ― 敵が先に動く」の札を残す
function drawAmbushTag(now) {
  const W = VW, H = VH;
  const pulse = REDUCED_MOTION ? 1 : 0.55 + 0.45 * Math.abs(Math.sin(now * 0.004));
  vctx.save();
  const vg = vctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
  vg.addColorStop(0, "rgba(150,0,0,0)");
  vg.addColorStop(1, `rgba(160,10,6,${0.28 * pulse})`);
  vctx.fillStyle = vg;
  vctx.fillRect(0, 0, W, H);
  const label = "奇襲 ― 敵が先に動く";
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
  // 奇襲の帯を読めるだけ留める (下限も戦闘スピードの設定に従う: オート 600 / 倍速 ON 1000 / OFF 2000ms)
  if (ambush) dur = Math.max(dur, 1000 * introMul);
  G.battleIntro = { battle: b, t0: performance.now(), dur, ambush, boss: boss ? (enemyReveal(boss).name ? (boss.mon && boss.mon.name) || boss.name : unknownLabel(boss.mon)) : null };
  G.animating = true;
  combatMenu.innerHTML = "";
  if (G.autoCombat) renderAutoBanner();
  else if (ambush) {
    // 奇襲: 敵が一巡するまで命令板が出ないので、開幕の演出の間からオートを押せるようにする
    combatMenu.dataset.mode = "acting";
    const w = turnPlate("奇襲", "敵が先に動く", []);
    w.classList.add("who-foe");
    combatMenu.appendChild(w);
    appendAutoStart();
  }
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
  if (!photoReady(p)) { whenPhoto(mon, () => {}); return b; } // 写しを始めておく (焼けるまでは空)
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
// 名前のまだわからない魔物の姿 (ユーザーの指示、2026-10): 絵の形だけを闇色で塗り (上ほどわずかに明るい)、
// 外側の1ドットに不確定名の色の淡い縁を巡らせる。大きさ・余白は monsterBitmap と同じなので、
// 名が明かされて色の絵に替わっても位置はずれない
const _monUnk = new WeakMap();
function monsterUnknownBitmap(mon) {
  let s = _monUnk.get(mon);
  if (s) return s;
  const b = monsterBitmap(mon);
  const c = document.createElement("canvas");
  c.width = b.c.width; c.height = b.c.height;
  const g = c.getContext("2d");
  if (mon.photo) {
    // 原画版: 縁 (黒いハロー) ごと闇色で塗る
    g.drawImage(b.c, 0, 0);
    g.globalCompositeOperation = "source-in";
    g.fillStyle = "#0d0a14";
    g.fillRect(0, 0, c.width, c.height);
    s = { c, w: b.w, h: b.h, pad: b.pad };
    if (_monBmp.get(mon) === b) _monUnk.set(mon, s); // 読み込み待ちの空の写しは覚えない
    return s;
  }
  const rows = mon.art || [];
  const { w, h, pad } = b;
  const on = (x, y) => { const ch = rows[y] && rows[y][x]; return !!ch && ch !== "." && ch !== " " && !!mon.palette[ch]; };
  g.fillStyle = "rgba(185,172,217,0.55)"; // UNKNOWN_COLOR の淡い縁
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!on(x, y)) continue;
    g.fillRect(x + pad - 1, y + pad, 3, 1);
    g.fillRect(x + pad, y + pad - 1, 1, 3);
  }
  for (let y = 0; y < h; y++) {
    const t = h > 1 ? y / (h - 1) : 0;
    g.fillStyle = `rgb(${Math.round(30 - 22 * t)},${Math.round(23 - 17 * t)},${Math.round(42 - 30 * t)})`;
    for (let x = 0; x < w; x++) if (on(x, y)) g.fillRect(x + pad, y + pad, 1, 1);
  }
  s = { c, w, h, pad };
  _monUnk.set(mon, s);
  return s;
}
// 戦闘の敵1体の姿: 名前が明かされるまでは影 (monsterUnknownBitmap)
function enemyBitmap(e) {
  return enemyUnknown(e) ? monsterUnknownBitmap(e.mon) : monsterBitmap(e.mon);
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
  return (cfg && cfg.layer) || 1;
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
  atk: "攻", vit: "守", agi: "速", int: "知", pie: "信", hit: "眼", seal: "封", taunt: "挑", shield: "庇", ctr: "返", charge: "溜", omen: "溜", regen: "癒", wardB: "鱗", wardS: "帳",
  r_fire: "火", r_water: "水", r_wind: "風", r_earth: "土", r_light: "光", r_dark: "闇", r_all: "属",
};
// 強化/弱体が「かかった瞬間」に出すフロート文字と色 (敵味方共通)。
// mods があれば能力ごとに 攻▲/守▼ … を並べ (段の能力は段数ぶんの矢印)、無ければ汎用の 強化▲/弱体▼。
// note があればそれを出す (予兆・払いのけ・加護の剥奪など)
function buffFloatText(h) {
  const up = !!h.buff;
  if (h.note) return { text: h.note, color: up ? "#ffc35a" : "#ff9a8a" };
  const m = h.mods || {};
  const ks = Object.keys(m);
  // 向きは値で決める (捨て身の 守▼ のように強化の中に下がる能力もある)
  const arrows = (k) => { const n = STAGED.has(k) ? Math.abs(stageOf(m[k])) : 1; return (m[k] >= 1 ? "▲" : "▼").repeat(Math.max(1, n)); };
  const body = ks.length ? ks.map((k) => `${(h.target?.side === "enemy" && ENEMY_STAT_LABEL[k]) || BUFF_KANJI[k] || "◆"}${arrows(k)}`).join("・") : (up ? "強化▲" : "弱体▼");
  return { text: body, color: up ? "#7fe0a0" : "#ff9a8a" };
}
// 効果を (能力, 向き) ごとに集約する: 段の能力は今の段 (1本)、それ以外は数を段とみなす。予兆 (omen) は別扱い
function buffGroups(list) {
  const groups = new Map();
  for (const ef of list || []) {
    const st = STAGED.has(ef.stat) ? effectStage(ef) : 0;
    const up = STAGED.has(ef.stat) ? st > 0 : ef.mult > 1;
    const key = ef.stat + (up ? "+" : "-");
    const g = groups.get(key) || { stat: ef.stat, up, stages: 0, turns: Infinity, omen: ef.stat === "omen" };
    g.stages += STAGED.has(ef.stat) ? Math.abs(st) : 1;
    g.turns = Math.min(g.turns, ef.turns);
    groups.set(key, g);
  }
  return [...groups.values()].filter((g) => g.stages > 0);
}
// opt.ails = 状態異常の札 (名前の下に先頭から) / opt.buffs = 強化・弱体の札。既定はどちらも
function drawEnemyBadges(e, baseX, yTop, opt = {}) {
  if (!e.alive) return;
  const segs = [];
  if (opt.ails !== false) for (const [t, c] of enemyAilSeals(e)) segs.push({ text: t, ail: c });
  if (opt.buffs !== false) for (const g of buffGroups(shownEffects(e))) {
    // 予兆は「溜!」の琥珀色の札 (残りターンは出さない)
    if (g.omen) { segs.push({ text: "溜!", up: true, omen: true }); continue; }
    const arrow = (g.up ? "▲" : "▼").repeat(Math.min(3, g.stages));
    // 残りターンは出さない (敵を押した「敵の姿」で確かめる — 2026-10 ユーザーの指示)
    segs.push({ text: `${ENEMY_STAT_LABEL[g.stat] || BUFF_KANJI[g.stat] || "◆"}${arrow}`, up: g.up });
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
    vctx.fillStyle = s.ail ? "rgba(6,4,6,0.9)" : s.omen ? "rgba(120,72,10,0.92)" : s.up ? "rgba(36,84,40,0.88)" : "rgba(108,40,40,0.88)";
    vctx.beginPath();
    vctx.roundRect ? vctx.roundRect(x, yTop, w, h, 4) : vctx.rect(x, yTop, w, h);
    vctx.fill();
    vctx.strokeStyle = s.ail || (s.omen ? "#ffb43a" : s.up ? "#6fcf6f" : "#ff7a72");
    vctx.lineWidth = 1;
    vctx.stroke();
    vctx.fillStyle = s.ail || (s.omen ? "#ffe2a8" : s.up ? "#c8f0c8" : "#ffc9c5");
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
      if (d.unk && d.mon && (d.mon.art || d.mon.photo)) drawMonsterBmp(vctx, monsterUnknownBitmap(d.mon), d.x, d.y - lift, d.size, 1 - t * 0.5);
      else drawMonster(vctx, d.mon, d.x, d.y - lift, d.size, 1 - t * 0.5);
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
    vctx.rotate(-0.75 + (s.rot || 0));
    const R = 34 * (s.big ? 1.25 : 1);
    const a0 = -1.4, a1 = a0 + 2.6 * sweep;
    vctx.globalCompositeOperation = "lighter";
    vctx.globalAlpha = fade * 0.55;
    vctx.strokeStyle = s.el && ELEM_FX_COL[s.el] && s.el !== "none" ? ELEM_FX_COL[s.el][1] : s.crit ? "#ffb040" : "#ff5a3a";
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
  // 武器・属性・状態異常ごとの演出 (battlefx.js)
  drawBattleFx(vctx, fx.skill, now, VW, VH, REDUCED_MOTION);
  // 画面の縁が紅く脈打つ (味方被弾)
  if (fx.screen) {
    const t = (now - fx.screen.t0) / (fx.screen.dur || 300);
    if (t <= 1) {
      vctx.save();
      const g = vctx.createRadialGradient(VW / 2, VH / 2, Math.min(VW, VH) * 0.25, VW / 2, VH / 2, Math.max(VW, VH) * 0.72);
      const dark = fx.screen.color === "dark"; // 死の宣告: 紫黒の闇が縁から迫る
      g.addColorStop(0, dark ? "rgba(20,0,30,0)" : "rgba(160,0,0,0)");
      g.addColorStop(1, dark ? `rgba(24,0,40,${0.78 * (1 - t)})` : `rgba(170,8,4,${0.62 * (1 - t)})`);
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
// 浮かぶ文字: 種類ごとの書体と配色 (kind: dmg/crit/label/trait/pdmg/heal/buff/info)
const FLOAT_STYLE = {
  dmg:   { px: 32, top: "#ffffff", bot: "#d9c8ac", glow: null },
  crit:  { px: 42, top: "#fff6c8", bot: "#ff9a1c", glow: "rgba(255,150,40,0.85)" },
  label: { px: 14, top: "#ffd27a", bot: "#ff8a2a", glow: "rgba(255,120,30,0.6)", spacing: 2 },
  trait: { px: 19, top: "#fff1c8", bot: "#e8a040", glow: "rgba(255,170,60,0.7)", spacing: 2 }, // 迷宮の掟の名 (playTraitStep)
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
    const plate = pos.plate;
    if (plate && sx >= plate.x && sx <= plate.x + plate.w && sy >= plate.y && sy <= plate.y + plate.h) return e;
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
  item: '<path d="M9.5 3h5M10.5 3v5.2L5.6 17.6A2.2 2.2 0 0 0 7.5 21h9a2.2 2.2 0 0 0 1.9-3.4L13.5 8.2V3"/><path d="M7.4 14.5h9.2"/>',
  swap: '<path d="M3.5 8h14l-4-4M20.5 16h-14l4 4"/>',
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
function turnPlate(name, tail, chips = [], skill = "") {
  const w = el("div", "who");
  w.appendChild(el("i", "who-mark"));
  w.appendChild(el("b", "who-n", name));
  if (tail) w.appendChild(el("span", "who-t", tail));
  if (skill) { w.appendChild(el("b", "who-sk", skill)); w.classList.add("who-call"); }
  for (const c of chips) w.appendChild(el("span", "who-c", c));
  return w;
}
// 命令板の「使った技」の札 (ユーザーの指示、2026-10: オート戦闘でどの技を使ったか分からない)。
// 味方が技・呪文・道具を使った時は「〇〇の エクスプロージョン」を板に掲げ、オートの速さでも読めるよう
// PLATE_CALL_MS の間は次の手番の札・敵の攻勢で上書きしない (新しい技を使えば差し替える)
const PLATE_CALL_MS = 1600;
function setPlateCall(res) {
  const a = res && res.actor;
  if (a && a.side === "party" && res.action === "swap" && res.swap) { // 持ち替え: 命令板に「〇〇の［持ち替え］」
    G._plateCall = { actor: a, name: a.name, skill: "持ち替え", item: false, at: performance.now() };
    return true;
  }
  if (!a || a.side !== "party" || res.opening || res.action !== "spell" || !res.spellName) return false;
  G._plateCall = { actor: a, name: a.name, skill: res.spellName, item: !!res.item, at: performance.now() };
  return true;
}
function freshPlateCall() {
  const c = G._plateCall;
  return c && performance.now() - c.at < PLATE_CALL_MS ? c : null;
}
function callPlate(c, chips) {
  const w = turnPlate(c.name, "の", c.item ? ["道具", ...chips] : chips, c.skill);
  w.dataset.call = String(c.at); // 同じ札を作り直さない印 (作り直すと出だしの演出が繰り返し始まり、薄いまま止まって見える)
  return w;
}

// 演出の間の命令板: いま動いている者の札だけを掲げる (板の高さは CSS で保つ)
function renderActingPlate(actor) {
  combatMenu.innerHTML = "";
  combatMenu.dataset.mode = "acting";
  if (!actor) return;
  const foe = actor.side === "enemy";
  const call = !foe && freshPlateCall();
  if (call && call.actor === actor) { combatMenu.appendChild(callPlate(call, [])); return; }
  const b = G.battle;
  const ambushTurn = foe && b && b.opening === "ambush" && b._roundNo <= 1; // 奇襲で敵だけが動く1ターン目
  const w = turnPlate(foe ? enemyLabel(actor) : actor.name, foe ? "の攻勢" : "の行動", ambushTurn ? ["奇襲"] : []);
  if (foe) w.classList.add("who-foe");
  if (foe && enemyUnknown(actor)) w.classList.add("who-unk");
  combatMenu.appendChild(w);
  // 敵の手番の間もオートを始められる (奇襲で敵が先に一巡する間も、押した次の手番からオートの速さになる)
  if (foe) appendAutoStart();
}
// 演出の間の「オート」: 手番を待たずにオートへ切り替える。オートの速さ (spdMul) は次の手番から効く
function appendAutoStart() {
  if (G.autoCombat || !G.battle || G.battle.result) return;
  const keep = !!uiDungeonHud.getPref("autoKeep");
  combatMenu.appendChild(cmdBtn("auto", "オート", keep ? "継続" : "敵の手番から速める", () => {
    if (G.autoCombat || G.state !== "combat" || !G.battle || G.battle.result) return;
    G.autoCombat = true;
    SFX.select();
    if (G.animating) renderAutoBanner();
    else renderCombatMenu();
  }, "cmd-wide"));
}

// オート戦闘中の常設バナー: 演出中も表示し続け、いつでも解除できる。
// 「次の戦闘も続ける」(§7 M2) もここで切り替えられる (主・強敵・深手の時は自動で止まる)
function renderAutoBanner(actor) {
  const call = freshPlateCall();
  const plate = call ? callPlate(call, ["オート"])
    : actor ? turnPlate(actor.name, "の手番", ["オート", tacticOf(actor).short]) : turnPlate("オート戦闘中", "", []);
  const keep = !!uiDungeonHud.getPref("autoKeep");
  // 既にバナーが出ていれば手番の札だけ差し替える (ボタンを作り直すと押している最中のタップが消える)
  const cur = combatMenu.dataset.mode === "auto" ? combatMenu.querySelector(":scope > .cmd-autorow") : null;
  if (cur && combatMenu.firstElementChild && combatMenu.firstElementChild !== cur) {
    if (!(call && combatMenu.firstElementChild.dataset.call === plate.dataset.call)) combatMenu.firstElementChild.replaceWith(plate);
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
function physImmune(e, actor) { return !!(e && ((actor && actor.wMagic ? e.magResist : e.physResist) | 0) >= 100); }
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
  // 演出の合間 (一手の演出が終わり、次の手番の札が出るまで) は、いまの手番の札をそのまま残す。
  // 消すと、奇襲で敵が一巡する間の「オート」が敵の攻撃の演出中にしか押せなくなる
  if (G.animating && !G.autoCombat && combatMenu.dataset.mode === "acting") return;
  // オート中はバナーを作り直さず札だけ差し替える (renderAutoBanner)。解除ボタンへのタップを取りこぼさない
  if (!(G.autoCombat && (G.animating || b.phase === "input"))) {
    combatMenu.innerHTML = "";
    combatMenu.dataset.mode = "";
  }
  if (G.animating) { if (G.autoCombat) renderAutoBanner(); return; } // アニメーション中は解除のみ可
  if (b.phase === "input") {
    const actor = b.current;
    highlightActor(actor);
    // オート戦闘: 人業ごとの作戦 (autotactics.js) で一手を選び続ける (周回用)。解除ボタンか画面タップで解除
    if (G.autoCombat) {
      renderAutoBanner(actor);
      if (!G._autoTimer) {
        G._autoTimer = setTimeout(function autoTick() {
          if (combatHeld()) { G._autoTimer = setTimeout(autoTick, 150); return; } // 手帳などを開いている間は待つ
          G._autoTimer = null;
          const b2 = G.battle;
          if (!b2 || b2.phase !== "input" || !G.autoCombat || G.animating) return;
          // 人業ごとの作戦 (autotactics.js) で一手を決める。誰も何も通せない (物理無効の敵ばかりで、役に立つ技も無い)
          // 手番が隊の人数ぶん続いたら、殴り続けても終わらないのでオートを止めて手動に戻す
          const cur = b2.current;
          const plan = decideAuto(b2, cur);
          b2._autoIdle = plan.idle ? (b2._autoIdle || 0) + 1 : 0;
          if (plan.idle && b2._autoIdle > b2.livingParty().length) {
            b2._autoIdle = 0;
            stopAutoCombat();
            showToast(cur && cur.wMagic ? "攻撃が効かない敵がいる — 術で戦おう" : "物理が効かない敵がいる — 術で戦おう", { tone: "bad" });
            return;
          }
          const r = b2.chooseAction(plan.action, plan.spellKey);
          if (r && r.invalid) { b2.pending = null; b2.phase = "input"; b2.chooseAction("defend"); }
          else if (b2.phase === "target") {
            const opts = b2.targetOptions();
            const tgt = (plan.target && opts.includes(plan.target)) ? plan.target : opts[0];
            if (!tgt) { b2.cancelTarget(); b2.chooseAction("defend"); }
            else b2.chooseTarget(tgt);
          }
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
      const qe = qs && skillEdgeTags(actor, sp);
      if (qe) qs.appendChild(qe);
      attachLongPress(qb, () => { SFX.select(); showSkillPopup(quick); });
      main.appendChild(qb);
    }
    const mpTxt = actor.maxmp > 0 ? `MP ${actor.mp}/${actor.maxmp}` : "技なし";
    if (battleSkills(actor).length) main.appendChild(cmdBtn("skill", "技", mpTxt, () => showSpells(actor)));
    else if (actor.spells.length) main.appendChild(cmdBtn("skill", "技", "すべてオフ", () => showToast("技はすべて非表示 ― 隊の「能力」で表示を戻せる", { noLog: true, tone: "info" }), "muted"));
    else main.appendChild(cmdBtn("skill", "技", "使えない", () => log("技を使えない", "sys"), "muted"));
    combatMenu.appendChild(main);
    const sub = el("div", "cmd-sub");
    sub.appendChild(cmdBtn("defend", "防御", "", () => act("defend")));
    // 道具: 隊の誰かの袋にある、戦闘で使える品 (無頼の誓では使えない)
    if (itemsBanned()) sub.appendChild(cmdBtn("item", "道具", "封印", () => { SFX.ng(); showToast("無頼の誓により、道具は使えない", { tone: "bad" }); }, "muted"));
    else {
      const nItems = battleItemStacks().reduce((a, x) => a + x.n, 0);
      sub.appendChild(cmdBtn("item", "道具", nItems ? `${nItems}個` : "なし", () => { if (!nItems) { SFX.ng(); showToast("使える道具を持っていない", { tone: "info" }); return; } SFX.select(); showBattleItems(actor); }, nItems ? "" : "muted"));
    }
    // 持ち替え: 手番の者が自分の袋に武器・盾を入れている時だけ出す (1手番を使う)
    const swaps = swapWeapons(actor);
    if (swaps.length) {
      sub.classList.add("has-swap");
      sub.appendChild(cmdBtn("swap", "持ち替え", `${swaps.length}点`, () => { SFX.select(); showBattleSwap(actor); }));
    }
    // 逃走: 手番の者の AGI で決まる成功率を添える (退路を断たれていれば「不可」)
    sub.appendChild(cmdBtn("run", "逃走", b.noFlee ? "不可" : `${Math.round(b.fleeChance(actor) * 100)}%`, () => act("run")));
    // オート: 人業ごとの作戦 (隊の「能力」で選ぶ) に従って動く。長押しで隊の作戦をまとめて見る・変える
    const autoB = cmdBtn("auto", "オート", uiDungeonHud.getPref("autoKeep") ? "継続" : "長押しで作戦", () => { G.autoCombat = true; SFX.select(); renderCombatMenu(); });
    if (UI.openPartyTactics) attachLongPress(autoB, () => { SFX.select(); UI.openPartyTactics(G.party.filter((p) => p), { onDone: () => { if (G.state === "combat" && !G.autoCombat) renderCombatMenu(); } }); });
    sub.appendChild(autoB);
    sub.appendChild(cmdBtn("fast", "倍速", G.fastAnim ? "ON" : "OFF", () => { G.fastAnim = !G.fastAnim; autosave(); renderCombatMenu(); }, G.fastAnim ? "on" : ""));
    combatMenu.appendChild(sub);
  } else if (b.phase === "target") {
    combatMenu.dataset.mode = "target";
    const p = b.pending;
    const sp = p && p.spellKey ? SPELLS[p.spellKey] : null;
    const pit = p && p.action === "item" ? p.item : null;
    const allyPick = (sp && sp.target === "ally") || (pit && useTarget(pit) !== "enemy");
    combatMenu.appendChild(turnPlate(sp ? sp.name : pit ? pit.name : "対象を選択", sp || pit ? "の対象" : "", [allyPick ? "味方を直接タップでも可" : "敵を直接タップでも可"]));
    const opts = b.targetOptions();
    // 対象が多い時 (敵の群れなど) は2列に並べて縦に伸びすぎないようにする
    const list = el("div", "target-list" + (opts.length > 3 ? " cols2" : ""));
    for (const t of opts) {
      const tb = btn("", () => { if (t.side === "enemy") G._lastTargetUid = t.uid; b.chooseTarget(t); runCommitted(); });
      tb.className = "btn tgt " + (t.side === "enemy" ? "tgt-enemy" : "tgt-ally") + (t.alive ? "" : " tgt-down");
      // 敵の名前・HP は討伐数で明かす (名前は1体、HP は5体倒すまで伏せる)
      const isEn = t.side === "enemy";
      const showHp = !isEn || enemyReveal(t).stats;
      const nm = el("span", "tgt-n" + (isEn && enemyUnknown(t) ? " unk" : ""), (isEn && b.isBackRow(t) ? "【後】" : "") + (isEn ? enemyLabel(t) : t.name) + (!isEn && !t.alive ? " [気絶]" : ""));
      tb.appendChild(nm);
      const bar = el("span", "tgt-bar");
      const fill = el("i");
      fill.style.width = (showHp ? Math.max(0, Math.min(100, (t.hp / (t.maxhp || 1)) * 100)) : 0) + "%";
      bar.appendChild(fill);
      if (!showHp) bar.style.visibility = "hidden";
      tb.appendChild(bar);
      const hpEl = el("span", "tgt-hp", !showHp ? "HP ？" : isEn ? `HP ${t.hp}` : `HP ${t.hp}/${t.maxhp}`);
      // 属性を帯びた技なら、属性の明かされた敵に「弱点」「耐性」を添える
      const edge = isEn && sp ? skillEdgeOn(b.current, sp, t) : 0;
      if (edge) hpEl.prepend(el("span", "sp-edge " + (edge > 0 ? "good" : "bad"), edge > 0 ? "弱点" : "耐性"));
      tb.appendChild(hpEl);
      list.appendChild(tb);
    }
    combatMenu.appendChild(list);
    combatMenu.appendChild(cmdBtn("back", "戻る", "", () => { b.cancelTarget(); renderCombatMenu(); }, "cmd-wide cmd-backb"));
  }
}

// ---- 技の属性の有利・不利 (属性の明かされた敵だけを見る: enemyElemKnown) ----
// 技 (攻撃呪文・物理技) が打つ属性と、その強さ (combat.js の _cast / _physical と同じ: 技の属性 > 武器の属性攻撃)
function skillElem(actor, sp) {
  if (!sp || !(sp.kind === "atk" || sp.kind === "phys") || sp.gravity) return null;
  const ea = actor && actor.elemAtk;
  const aE = sp.element && sp.element !== "none" ? sp.element : sp.kind === "phys" && ea && ea.el ? ea.el : "none";
  if (aE === "none" || !ELEMENTS[aE]) return null;
  return { el: aE, lv: ea && ea.el === aE ? Math.max(1, ea.lv) : 1 };
}
// その敵に対して 1 = 有利 (弱点を突く) / -1 = 不利 (耐えられる) / 0 = 相性なし・属性が明かされていない
function skillEdgeOn(actor, sp, e) {
  const se = skillElem(actor, sp);
  if (!se || !e || !e.alive || !enemyElemKnown(e)) return 0;
  let m = elemDmgMult(se.el, se.lv, e.element || "none", null, e.affinity || (e.mon && e.mon.affinity));
  if (m < 1 && sp.kind === "atk" && pLv(actor, "elemFloor")) m = 1; // 森羅の理: 呪文の属性不利が出ない
  return m > 1 ? 1 : m < 1 ? -1 : 0;
}
// 技の一覧に添える「有利」「不利」の札 (届く敵のうち、属性の明かされた敵に1体でも当てはまれば)。無ければ null
function skillEdgeTags(actor, sp) {
  const b = G.battle;
  if (!b || !skillElem(actor, sp)) return null;
  const foes = sp.kind === "phys" && sp.target !== "all-enemy" ? b.attackableEnemies(actor) : b.livingEnemies();
  let good = 0, bad = 0;
  for (const e of foes) { const d = skillEdgeOn(actor, sp, e); if (d > 0) good++; else if (d < 0) bad++; }
  if (!good && !bad) return null;
  const r = el("span", "sp-edges");
  if (good) r.appendChild(el("span", "sp-edge good", "有利"));
  if (bad) r.appendChild(el("span", "sp-edge bad", "不利"));
  r.title = [good ? `弱点を突ける敵 ${good}体` : "", bad ? `属性で耐えられる敵 ${bad}体` : ""].filter(Boolean).join("・");
  return r;
}

function showSpells(actor) {
  combatMenu.innerHTML = "";
  combatMenu.dataset.mode = "spells";
  combatMenu.appendChild(turnPlate(actor.name, "の技", [`MP ${actor.mp}`, "長押しで詳細"]));
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
    const edge = skillEdgeTags(actor, sp);
    if (edge) { if (!tg) edge.classList.add("lead"); top.appendChild(edge); }
    top.appendChild(el("span", "sp-mp", `MP${cost}`));
    b.appendChild(top);
    b.appendChild(el("span", "sp-d", skillDescription(sp)));
    b.style.setProperty("--sp-col", SPELL_KIND_COLOR[sp.kind] || "#c9a24a");
    if (locked) b.classList.add("locked");
    // 長押しでスキル詳細を表示 (MP不足などで押せない技でも内容は確認できる)
    attachLongPress(b, () => { SFX.select(); showSkillPopup(key); });
    list.appendChild(b);
  }
  combatMenu.appendChild(list);
  combatMenu.appendChild(cmdBtn("back", "戻る", "", () => renderCombatMenu(), "cmd-wide cmd-backb"));
}
// ---- 戦闘中の道具 ----
function itemsBanned() { return false; } // 旧仕様の奈落の誓い「無頼の誓」は廃止 (呼び出し側のために残す)
// 戦闘で使える道具を品ごとにまとめる (隊の全員の袋から。倒れた者の袋も使える)。並びは効果順 (compareUse)
function battleItemStacks() {
  const map = new Map();
  for (const m of bagOwners(G.party)) {
    for (const it of (m.items || [])) {
      if (it.slot !== "use" || !it.use || useWhere(it) === "field") continue;
      const key = it.id || it.name;
      if (!map.has(key)) map.set(key, { key, it, n: 0, holders: [] });
      const x = map.get(key);
      x.n++;
      if (!x.holders.includes(m)) x.holders.push(m);
    }
  }
  return [...map.values()].sort((a, b) => compareUse(a.it, b.it));
}
// 手番の者が使う時は、まず自分の袋の品を、無ければ仲間の袋の品を使う
function itemSource(actor, key) {
  const own = (actor.items || []).find((it) => (it.id || it.name) === key && it.slot === "use");
  if (own) return { item: own, owner: actor };
  for (const m of G.party) {
    const it = (m.items || []).find((x) => (x.id || x.name) === key && x.slot === "use");
    if (it) return { item: it, owner: m };
  }
  return null;
}
function itemLocked(it) {
  const tk = useTarget(it);
  if (tk === "ally" || tk === "dead") return G.battle._itemTargets(it).length === 0;
  if (it.use && it.use.escape) return !!G.battle.noFlee;
  return false;
}
// ---- 武器・盾の持ち替え (2026-10 ユーザーの指示) ----
// 手番の者が自分の袋に入れている武器と盾だけ (ほかの人業の品は選べない)。未鑑定の品は装備できないので出さない。
// 盾も選べるので、両手武器から片手武器に戻した後に盾を付け直せる (2026-10-12 ユーザーの指示)
const swapSlotOf = (it) => (it && it.slot === "shield" ? "shield" : "weapon");
function swapWeapons(actor) {
  const bag = ((actor && actor.items) || []).filter((it) => it && !it.unidentified && (it.slot === "weapon" || it.slot === "shield"));
  return [...bag.filter((it) => it.slot === "weapon"), ...bag.filter((it) => it.slot === "shield")]; // 武器が先、盾は後ろ
}
// 持ち替えられない理由 (無ければ null)。判定は街の付け替え (equipAt) と同じ
function swapBlock(actor, it) {
  if (!canEquip(actor, it)) return equipFailMsg(actor, it);
  const key = swapSlotOf(it);
  const tr = autoEquip.trialEquip(actor.equip, it, key);
  if (!tr) {
    const pin = [actor.equip[key], key === "weapon" && it.twoHanded ? actor.equip.shield : null,
      key === "shield" && actor.equip.weapon && actor.equip.weapon.twoHanded ? actor.equip.weapon : null].find((x) => autoEquip.isPinned(x));
    return pin && !pin.cursed ? `${pin.name}はロック中` : "呪われた装備が外れない";
  }
  if (actor.items.length - 1 + tr.displaced.length > MAX_ITEMS) return "持ち物がいっぱいで外した品を入れられない";
  return null;
}
// 盾を付けた時に変わる能力 (大きい順に2つまで)
const SWAP_STAT_L = [["vit", "VIT"], ["agi", "AGI"], ["int", "INT"], ["pie", "PIE"], ["maxmp", "MP"]];
function showBattleSwap(actor) {
  combatMenu.innerHTML = "";
  combatMenu.dataset.mode = "spells";
  combatMenu.appendChild(turnPlate(actor.name, "の持ち替え", ["1ターン使う", "長押しで詳細"]));
  const now = autoEquip.previewStats(actor, actor.equip);
  const items = swapWeapons(actor);
  const list = el("div", "target-list" + (items.length > 4 ? " cols2" : ""));
  for (const it of items) {
    const key = swapSlotOf(it), cur = actor.equip[key];
    const why = swapBlock(actor, it);
    const tr = why ? null : autoEquip.trialEquip(actor.equip, it, key);
    const b = btn("", () => {
      if (why) { SFX.ng(); showToast(why, { tone: "info" }); return; }
      act("swap", null, { item: it });
    });
    b.className = "btn spell " + (key === "shield" ? "spell-buff" : "spell-phys") + " spell-item";
    const top = el("span", "sp-top");
    const ic = el("span", "sp-ic");
    ic.appendChild(spriteCanvas(it, 1));
    top.appendChild(ic);
    top.appendChild(el("span", "sp-n", itemName(it)));
    top.appendChild(el("span", "sp-mp", key === "shield" ? (SHIELD_KIND_LABEL[shieldKind(it)] || "盾") : HAND_LABEL[it.twoHanded ? 2 : 1]));
    b.appendChild(top);
    const parts = [];
    if (tr) {
      const after = autoEquip.previewStats(actor, tr.equip);
      const pw0 = Math.round(now.power || 0), pw1 = Math.round(after.power || 0);
      if (key === "weapon" || pw0 !== pw1) parts.push(`攻撃力 ${pw0}→${pw1}`);
      if (key === "shield") {
        const ch = SWAP_STAT_L.map(([k, l]) => ({ l, a: Math.round(now[k] || 0), z: Math.round(after[k] || 0) })).filter((x) => x.a !== x.z)
          .sort((x, y) => Math.abs(y.z - y.a) - Math.abs(x.z - x.a)).slice(0, 2);
        for (const x of ch) parts.push(`${x.l} ${x.a}→${x.z}`);
      }
    }
    if (key === "weapon") parts.push(`射程 ${RANGE_LABEL[weaponRange(it)]}`);
    const off = tr ? tr.displaced.filter((x) => x && x !== cur) : [];
    if (off.length) parts.push(key === "weapon" ? "盾が外れる" : "両手武器が外れる");
    if (why) parts.push(why);
    b.appendChild(el("span", "sp-d", parts.join("・")));
    b.style.setProperty("--sp-col", (key === "shield" ? SPELL_KIND_COLOR.buff : SPELL_KIND_COLOR.phys) || "#c9a24a");
    if (why) b.classList.add("locked");
    attachLongPress(b, () => { SFX.select(); UI.itemSheet(it, { context: "view" }); });
    list.appendChild(b);
  }
  combatMenu.appendChild(list);
  combatMenu.appendChild(cmdBtn("back", "戻る", "", () => renderCombatMenu(), "cmd-wide cmd-backb"));
}
function showBattleItems(actor) {
  combatMenu.innerHTML = "";
  combatMenu.dataset.mode = "spells";
  combatMenu.appendChild(turnPlate(actor.name, "の道具", ["隊の袋から使う", "長押しで詳細"]));
  const stacks = battleItemStacks();
  const list = el("div", "target-list" + (stacks.length > 4 ? " cols2" : ""));
  for (const x of stacks) {
    const it = x.it;
    const locked = itemLocked(it);
    const b = btn("", () => {
      if (locked) { SFX.ng(); showToast(it.use.escape ? "退路が閉ざされている" : "効果のある対象がいない", { tone: "info" }); return; }
      const src = itemSource(actor, x.key);
      if (!src) { SFX.ng(); renderCombatMenu(); return; }
      act("item", null, src);
    });
    const kind = it.use.bomb ? "atk" : it.use.hex ? "debuff" : it.use.buff ? "buff" : it.use.escape ? "escape" : it.use.revive || it.use.heal || it.use.full ? "heal" : it.use.mp || it.use.mpFull ? "mana" : "cure";
    b.className = "btn spell spell-" + kind + " spell-item";
    const top = el("span", "sp-top");
    const ic = el("span", "sp-ic");
    ic.appendChild(spriteCanvas(it, 1));
    top.appendChild(ic);
    top.appendChild(el("span", "sp-n", it.name));
    top.appendChild(el("span", "sp-mp", `×${x.n}`));
    b.appendChild(top);
    const holder = x.holders.includes(actor) ? "" : ` (${x.holders[0].name})`;
    b.appendChild(el("span", "sp-d", useLines(it, true).join("・") + holder));
    b.style.setProperty("--sp-col", SPELL_KIND_COLOR[kind] || "#c9a24a");
    if (locked) b.classList.add("locked");
    attachLongPress(b, () => { SFX.select(); UI.itemSheet(it, { context: "view" }); });
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
function combatHeld() { return G.state === "combat" && (cloudBusy() || sheetDepth() > 0 || !!G.settingsOpen || !!G.statusOpen); }
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
      holdActionEffects();
      if (cloudEnabled() && !testPlayActive) { resolveSavedBattle("stunned"); return; }
      const res = b.stunnedAct();
      res._modFeed = takeModFeed();
      b._acted = true; // 実行済み (演出中に閉じられても、再開時にやり直さず次の手番へ)
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
      holdActionEffects();
      if (cloudEnabled() && !testPlayActive) { resolveSavedBattle("enemy"); return; }
      const res = b.enemyAct();
      res._modFeed = takeModFeed();
      b._acted = true;
      animateResult(res, postResolve);
    }, 260 * spdMul());
  }
}

// 味方コマンド選択
function act(action, spellKey, extra) {
  const b = G.battle;
  const actor = b.current;
  const r = b.chooseAction(action, spellKey, extra);
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
  holdActionEffects();
  if (cloudEnabled() && !testPlayActive) { resolveSavedBattle("commit"); return; }
  const res = G.battle.commit();
  res._modFeed = takeModFeed();
  G.battle._acted = true;
  animateResult(res, postResolve);
}

// 確定した選択を保存し、サーバーに一手を実行させる。返答前は結果を描かない。
async function resolveSavedBattle(action) {
  _cloudResolving = true;
  try {
    await cloudFlush();
    const response = await cloudBattle(action);
    const packet = applySavePatch(G, refDeserialize(response.packet));
    G.rng = bindRngState(G.rng); setSharedSouls(G.souls);
    syncEnemyUids(G.battle.enemies);
    G.battle.log = log;
    _cloudResolving = false; _lastCloudSave = null;
    for (const l of packet.logs) log(l.msg, l.cls);
    packet.result._modFeed = packet.modFeed;
    animateResult(packet.result, postResolve);
  } catch (e) { cloudFatal(); }
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
  if (!cloudEnabled() || testPlayActive) b._acted = false;
  // ターンの初めのパッシブ・激昂などで掛かった強化・弱体は、1拍ずつ見せてから次の手番へ
  const watch = beginModWatch(true);
  if (cloudEnabled() && !testPlayActive) { advanceSavedBattle(watch); return; }
  b.advance();
  const mw = watch ? endModWatch() : null;
  playModReveal(mw, () => {
    autosave(true);
    setTimeout(combatStep, 150 * spdMul());
  });
}

async function advanceSavedBattle(watch) {
  _cloudResolving = true;
  try {
    const response = await cloudBattle("advance");
    const packet = applySavePatch(G, refDeserialize(response.packet));
    G.rng = bindRngState(G.rng); setSharedSouls(G.souls); G.battle.log = log;
    _cloudResolving = false; _lastCloudSave = null;
    for (const l of packet.logs) log(l.msg, l.cls);
    if (watch) G.modFeed = packet.modFeed;
    const mw = watch ? endModWatch() : null;
    playModReveal(mw, () => { autosave(true); setTimeout(combatStep, 150 * spdMul()); });
  } catch (e) { cloudFatal(); }
}

// 多段ヒットの時間差 (ms。spdMul で速度モードに追従)。applyImpact と共有
const HIT_STAGGER = 165;

// 結果オブジェクトを演出 (踏み込み → 着弾 → 余韻)
function animateResult(res, done) {
  if (G.battle && G.battle.tl) tlHits(G.battle.tl, res); // テスト記録: 与ダメ/被ダメ
  callPartyAction(res); // 札の肖像に使った技の名 (手番の初めから)
  if (setPlateCall(res)) { if (G.autoCombat) renderAutoBanner(); else renderActingPlate(res.actor); } // 命令板にも「誰の何の技か」
  // 眠り・行動不能で何もしなかった手番には、踏み込みや空振り音を出さない
  if ((res.action === "sleep" || res.action === "stunned") && !(res.hits || []).length) {
    G.effShow = null;
    renderParty();
    renderCombat();
    setTimeout(done, 200 * spdMul());
    return;
  }
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
  // 死の宣告 (開幕): 大鎌が振り下ろされ魂が抜けるまでを見せきる (戦闘に一度だけなので一手より長く取る)
  const hold = res.opening === "senkoku" ? 560 : 0;
  const TOTAL = WIND + (360 + hold + staggerSteps * HIT_STAGGER) * spdMul();
  G.fx = { lunge: res.side === "enemy" && res.action !== "eflee" ? { uid: res.actor.uid, p: 0 } : null,
           slashes: [], skill: [], floats: [], screen: null, flash: {}, deaths: [] };
  G.partyFx = G.partyFx || new Map();
  G.partyFxV = new Map();
  // 隊の札の演出の長さも一手の余韻に合わせる (テンポを落とさない)
  partyEl.style.setProperty("--fxd", Math.max(0.16, Math.min(0.5, 0.36 * spdMul())).toFixed(2) + "s");
  // 上級の技 (MP の重い技): 踏み込みの間に魔法陣が浮かび、着弾で消える (一手の時間は延ばさない)
  const prof = fxProfile(res);
  if (prof && prof.tier >= 3 && prof.kind !== "phys" && !SIG_FX[res.spellKey]) {
    const at = fxAnchor(res, prof);
    if (at) spawnFx(G.fx.skill, "circle", at.x, at.y, t0, spdMul(), { el: prof.el, spin: prof.spin, w: at.w, dur: WIND + 150 * spdMul() });
  }
  let impacted = false;
  const tick = () => {
    const t = performance.now() - t0;
    if (G.fx.lunge) G.fx.lunge.p = Math.sin(Math.min(1, t / WIND) * Math.PI);
    if (!impacted && t >= WIND) {
      impacted = true;
      applyImpact(res);
      if (res._modFeed !== undefined) releaseActionEffects(res, res._modFeed); // 強化・弱体の札は着弾と同時に
      drainPartyProcs(); // 発動した効果の名は着弾と同時に
      renderParty(); // HP反映 + 被弾フラッシュ
    }
    renderCombatCanvas();
    if (t >= TOTAL) {
      G.fx = null;
      G.partyFx.clear();
      if (G.partyFxV) G.partyFxV.clear();
      renderCombat();
      done();
    } else {
      requestAnimationFrame(tick);
    }
  };
  requestAnimationFrame(tick);
}

// 技の演出の設計図 (battlefx.skillProfile)。味方の技だけ (敵の特殊行動・道具・通常攻撃は持たない)
function fxProfile(res) {
  if (!res || res.side !== "party" || res.action !== "spell" || !res.spellKey) return null;
  return skillProfile(res.spellKey, SPELLS[res.spellKey]);
}
// 技の演出を置く所: 単体の敵 → その敵 / 全体の敵 → 敵の列の中央 / 味方 → 戦場の下端
function fxAnchor(res, prof) {
  const foes = (res.hits || []).filter((h) => h && h.target && h.target.side === "enemy").map((h) => G.enemyPos[h.target.uid]).filter(Boolean);
  if (prof.ally || !foes.length) return { x: VW / 2, y: VH - 30, w: prof.all ? VW * 0.9 : 0 };
  if (prof.all || foes.length > 1) {
    const xs = foes.map((p) => p.cx), ys = foes.map((p) => p.cy);
    return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: ys.reduce((a, b) => a + b, 0) / ys.length, w: Math.max(VW * 0.6, Math.max(...xs) - Math.min(...xs) + 120) };
  }
  return { x: foes[0].cx, y: foes[0].cy, w: 0 };
}

// 隊の札 (戦場の下) のおおよその横位置: 札は3枚ずつ並ぶ (3人以下は人数で割る)
function partyFxX(p) {
  const n = G.party.length, i = Math.max(0, G.party.indexOf(p));
  const cols = n >= 4 ? 3 : Math.max(1, n);
  const row = Math.floor(i / cols), inRow = n >= 4 ? Math.min(cols, n - row * cols) : cols;
  return VW * ((i % cols) + 0.5) / inRow;
}
// 隊の札に重ねる演出の種類 (renderParty が .pc-fx の印にする)
function setPartyFxV(p, v) {
  if (!G.partyFxV) G.partyFxV = new Map();
  G.partyFxV.set(p, v);
}

// 隊の札の肖像に「使った技・発動した効果」の名を出す (ユーザーの指示、2026-10)。
// 一手の時間 (TOTAL) は延ばさず、札の上でだけ読める長さ残す。同じ人の次の手番か時間切れで消える。
// 技・道具・防御 = 手番の初め / 発動した効果 (combat.js _proc の記録) = 着弾の瞬間に、同じ札へ最大3行まで重ねる
const PARTY_CALL_MS = 2400;
const PARTY_CALL_MAX = 3;
function setPartyCall(p, text, kind, fresh) {
  if (!p || !text) return;
  if (!G.partyCall) G.partyCall = new Map();
  const now = performance.now();
  let c = G.partyCall.get(p);
  if (fresh || !c) c = { lines: [] };
  else if (c.lines.some((l) => l.text === text)) return;
  c.lines.push({ text, kind });
  if (c.lines.length > PARTY_CALL_MAX) c.lines.splice(0, c.lines.length - PARTY_CALL_MAX);
  c.at = now;
  clearTimeout(c.timer);
  c.timer = setTimeout(() => {
    if (!G.partyCall || G.partyCall.get(p) !== c) return;
    G.partyCall.delete(p);
    if (G.state === "combat") renderParty();
  }, PARTY_CALL_MS);
  G.partyCall.set(p, c);
}
function clearPartyCalls() {
  G._plateCall = null;
  if (G.partyCall) for (const c of G.partyCall.values()) clearTimeout(c.timer);
  G.partyCall = null;
}
// 手番の者が使った技・道具・防御 (通常攻撃と開幕の自動攻撃は出さない — 開幕は効果の名で出る)
function callPartyAction(res) {
  const a = res && res.actor;
  if (!a || a.side !== "party" || res.opening) return;
  if (res.action === "spell" && res.spellName) {
    const sp = res.spellKey ? SPELLS[res.spellKey] : null;
    const kind = res.item ? "item" : sp && (sp.kind === "heal" || sp.kind === "cure" || sp.kind === "mana" || sp.revive) ? "heal" : "skill";
    setPartyCall(a, res.spellName, kind, true);
  } else if (res.action === "defend") setPartyCall(a, "防御", "guard", true);
  else if (res.action === "swap" && res.swap) setPartyCall(a, "持ち替え", "item", true);
  else if (G.partyCall && G.partyCall.has(a)) { clearTimeout(G.partyCall.get(a).timer); G.partyCall.delete(a); } // 前の手番の名は下げる
}
// combat.js が記録した発動した効果 (固有パッシブ・ランクのパッシブ・かばう・反撃…) を札へ移す
function drainPartyProcs() {
  const q = G.battle && G.battle.procs;
  if (!q || !q.length) return false;
  for (const { who, label } of q.splice(0)) if (G.party.includes(who)) setPartyCall(who, label, "proc", false);
  return true;
}

// 着弾の瞬間: 効果音・エフェクト生成・ダメージ表示
function applyImpact(res) {
  const fx = G.fx;
  const now = performance.now();
  if (res.action === "defend" || res.action === "swap") { SFX.select(); return; }
  if (res.action === "sleep" || res.action === "run" || res.action === "stunned") { SFX.miss(); return; }
  if (res.action === "eflee") {
    // 敵が逃げ出した (金属の魔物): 横へ駆け去る (描画は renderCombatCanvas の fleeFx)
    SFX.flee();
    fx.fleeAway = { uid: res.actor.uid, t0: now, dur: 340 * spdMul() };
    const pos = G.enemyPos[res.actor.uid];
    if (pos) fx.floats.push({ x: pos.cx, y: pos.cy - 34, text: "逃げ出した！", color: "#cfd8e6", t0: now, small: true, kind: "label" });
    return;
  }

  // 効果音 + 振動
  if (res.windup) {
    // 大技の予兆: 不穏な音と小さな揺れ (この手番は攻撃しない)
    SFX.ambush(); buzz([0, 30, 30, 30]);
  } else if (res.shake) {
    SFX.spell();
  } else if (res.action === "breath") {
    // ブレス (炎の効果音) / 敵の全体呪文 (呪文の効果音)
    if (res.espell) SFX.spell(); else SFX.fire();
    buzz([0, 50, 40, 80]); shakeScreen(true);
  } else if (res.opening === "senkoku") {
    // 死の宣告: 不穏な音・画面が闇に沈む (描画は下の reap)
    SFX.ambush(); buzz([0, 40, 60, 90]);
    fx.screen = { color: "dark", t0: now, dur: 760 * spdMul() };
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
  // 隊の複数人を打つ物理 (溜めた猛威など) は数字を各人の札の上に分けて出す
  const partyDmgN = res.hits.filter((x) => x.target && x.target.side !== "enemy" && x.dmg != null && !x.miss).length;
  // 多段ヒット (二段斬り等) は同じ対象・同座標に重なって1回に見えてしまうため、
  // 対象ごとにヒット順で時間差(stagger)と位置差(横ずらし)を付けて、回数分はっきり見せる
  const spd = spdMul();
  const stag = HIT_STAGGER * spd;
  const stackIdx = {};
  // 技ごとの組み立て: 描き分け (v)・角度 (rot)・回る向き (spin)・格 (scale)・付く効果の印 (riders)
  const prof = fxProfile(res);
  const pv0 = prof ? { v: prof.v, rot: prof.rot, spin: prof.spin, s: prof.scale * (prof.all ? 0.8 : 1) } : {};
  // 各職の看板技 (Lv40) は専用の演出に差し替える (battlefx-sig.js)
  const sig = prof ? SIG_FX[res.spellKey] || null : null;
  // 全体回復は対象全員が同じ中央下に重なって1人分にしか見えないため、
  // 回復対象ごとに横位置をずらし、わずかな時間差を付けて全員ぶんはっきり見せる
  const partyHeals = res.hits.filter((h) => h.target.side !== "enemy" && h.heal != null);
  let partyHealIdx = 0;
  // 味方への強化/弱体フロートも複数人ぶん横に散らす
  const partyModHits = res.hits.filter((h) => h.target.side !== "enemy" && (h.buff || h.debuff));
  let partyModIdx = 0;
  for (const h of res.hits) {
    // 吸血 (吸命の装飾品・吸血する魔物): 打った側に回復量を浮かべる (満タンでも素の値)
    if (h.lifesteal && h.stealer && !h.miss) {
      if (h.stealer.side === "enemy") {
        const sp0 = G.enemyPos[h.stealer.uid];
        if (sp0) fx.floats.push({ x: sp0.cx, y: sp0.cy - 22, text: "+" + h.lifesteal, color: "#7CFC7C", t0: now + 120, kind: "heal" });
      } else {
        G.partyFx.set(h.stealer, "heal");
        fx.floats.push({ x: VW / 2, y: VH - 44, text: "+" + h.lifesteal, color: "#7CFC7C", t0: now + 120, kind: "heal" });
      }
    }
    if (h.target.side === "enemy") {
      const pos = G.enemyPos[h.target.uid];
      if (!pos || h.miss) continue;
      const idx = (stackIdx[h.target.uid] = (stackIdx[h.target.uid] || 0) + 1) - 1; // 0,1,2…
      const ht0 = now + idx * stag;
      const dx = idx === 0 ? 0 : (idx % 2 ? 1 : -1) * (14 + 4 * idx); // 左右に振って重なり回避
      if (idx > 0) setTimeout(() => SFX.hit(), idx * stag); // 2撃目以降にも手応えの効果音
      const seed = (h.target.uid || 1) * 31 + idx;
      if (res.opening === "senkoku") {
        // 死の宣告: 敵ごとに少しずつ遅れて、大鎌が魂を刈り取る (崩れ落ちは鎌が抜けた後)
        const rt0 = now + res.hits.indexOf(h) * 140 * spd;
        spawnFx(fx.skill, "reap", pos.cx, pos.cy, rt0, spd, { seed, s: Math.max(0.8, Math.min(1.3, (pos.size || 9) / 9)) });
        fx.floats.push({ x: pos.cx, y: pos.cy - 58, text: "死の宣告", color: "#c9a0ff", t0: rt0, small: true, kind: "label" });
        fx.floats.push({ x: pos.cx, y: pos.cy - 10, text: "即死!", color: "#ff2a2a", t0: rt0 + 260 * spd, big: true, kind: "crit" });
        if (!fx.deaths.some((d) => d.uid === h.target.uid)) fx.deaths.push({ uid: h.target.uid, mon: h.target.mon, unk: enemyUnknown(h.target), x: pos.cx, y: pos.cy, size: pos.size || 9, t0: rt0 + 300 * spd });
        anyDeath = true;
        continue;
      } else if (res.action === "spell" && res.spellKind !== "heal" && res.spellKind !== "phys") {
        // 呪文: 攻撃は属性ごと (火柱・水しぶき・旋風・岩の牙・光の柱・闇の渦)、弱体・状態異常はその種類ごと
        const st = statusFxKind(h.status);
        const kind = res.spellKind === "atk" ? (ELEM_FX_COL[res.spellElement] ? res.spellElement : "none")
          : st || (res.spellKind === "sleep" ? "sleep" : h.buff && !h.debuff ? "rise" : "hex");
        if (sig && sig.mode === "hit") spawnFx(fx.skill, sig.type, pos.cx, pos.cy, ht0, spd, { seed, v: idx });
        else if (!(sig && sig.mode === "field")) spawnFx(fx.skill, kind, pos.cx, pos.cy, ht0, spd, { ...pv0, seed: seed + (prof ? prof.seed : 0), col: kind === "rise" ? "#ffd84a" : null });
        if (res.spellKind === "atk" && st) spawnFx(fx.skill, st, pos.cx, pos.cy, ht0 + 50 * spd, spd, { seed }); // 攻撃呪文の状態異常
      } else if (res.action === "attack" || res.spellKind === "phys") {
        // 物理: 味方は武器ごと (長剣=三日月 / 短剣=×字 / 刀=一閃 / 槍=突き / 斧・槌=衝撃 / 弓=矢 / 杖・素手=打撃)。
        // 属性の技・属性武器は刃がその色になり、属性の名残を小さく重ねる
        const mine = res.side === "party" && res.actor && res.actor.equip;
        const style = mine ? weaponFxStyle(res.actor.equip.weapon) : "slash";
        const el = res.spellKind === "phys" ? res.spellElement : mine && res.actor.elemAtk ? res.actor.elemAtk.el : null;
        const rot = prof ? prof.rot * (idx % 2 ? -1 : 1) : 0, big = !!h.crit || (prof && prof.tier >= 3);
        const flip = (idx % 2 === 1) !== (prof ? prof.spin < 0 : false);
        if (sig && sig.mode === "hit") spawnFx(fx.skill, sig.type, pos.cx, pos.cy, ht0, spd, { seed, v: idx, crit: !!h.crit });
        else if (style === "slash") {
          fx.slashes.push({ x: pos.cx + dx * 0.5, y: pos.cy, t0: ht0, crit: !!h.crit, big, flip, seed, el, rot });
          if (el && el !== "none" && ELEM_FX_COL[el]) spawnFx(fx.skill, el, pos.cx, pos.cy, ht0, spd, { seed, s: 0.55, trace: true });
        } else spawnFx(fx.skill, style, pos.cx + dx * 0.5, pos.cy, ht0, spd, { seed, crit: !!h.crit, flip, el, rot, s: prof ? prof.scale : 1 });
        // 上級の物理技: 残像の二の太刀 (逆向き・一回り大きく) を少し遅れて重ねる
        if (prof && prof.tier >= 3 && idx === 0 && !sig) {
          if (style === "slash") fx.slashes.push({ x: pos.cx, y: pos.cy, t0: ht0 + 70 * spd, crit: !!h.crit, big: true, flip: !flip, seed: seed + 5, el, rot: -rot });
          else spawnFx(fx.skill, style, pos.cx, pos.cy, ht0 + 70 * spd, spd, { seed: seed + 5, crit: !!h.crit, flip: !flip, el, rot: -rot, s: prof.scale * 1.15 });
        }
        if (h.crit) spawnFx(fx.skill, "crit", pos.cx + dx * 0.5, pos.cy, ht0, spd, { seed });
        const st = statusFxKind(h.status);
        if (st) spawnFx(fx.skill, st, pos.cx, pos.cy, ht0 + 50 * spd, spd, { seed }); // 武器の追加効果・技の状態異常
      }
      // 付く効果の印 (吸収・物理貫通・とどめ・怯み・耐性ダウン・強化打ち消し・封印・重力・盗み・即死)
      if (prof && !h.immune) {
        for (const r of prof.riders) {
          if (sig && !r.onDeath && !r.onFatal) continue; // 看板技は専用の演出が効果を描く (とどめ・即死の決まった印だけ重ねる)
          if (r.onDeath && !h.died) continue;
          if (r.onFatal && !h.fatal) continue;
          if (r.onSteal && h.stole == null) continue;
          spawnFx(fx.skill, r.type, pos.cx, pos.cy, ht0 + 40 * spd, spd, { seed, col: r.col, el: prof.el, rot: prof.rot, s: r.s || 1, tx: VW / 2 });
        }
      }
      if (!h.note && (idx === 0 || !fx.flash[h.target.uid])) fx.flash[h.target.uid] = { t0: ht0 };
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
      else if (h.heal != null) { // 敵の回復役による回復
        fx.floats.push({ x: pos.cx + dx, y: pos.cy - 10, text: "+" + h.heal, color: "#7CFC7C", t0: ht0, kind: "heal" });
        spawnFx(fx.skill, "rise", pos.cx, pos.cy, ht0, spd, { seed, col: "#7CFC7C" });
      }
      if (h.buff && res.action !== "spell") spawnFx(fx.skill, "rise", pos.cx, pos.cy, ht0, spd, { seed, col: "#ffd84a" }); // 雄叫びなど敵の強化
      // 敵にかかった強化/弱体も発動フロートで知らせる (ピル表示に加えて瞬間を可視化)
      if ((h.buff || h.debuff) && !(h.status && !Object.keys(h.mods || {}).length)) { const mt = buffFloatText(h); fx.floats.push({ x: pos.cx + dx, y: pos.cy - 34, text: mt.text, color: mt.color, t0: ht0, kind: "buff" }); }
      // 状態異常の付与 (麻痺・眠り・魅了・混乱…): 名札の上に浮かべて知らせる
      if (h.status) fx.floats.push({ x: pos.cx + dx, y: pos.cy - (h.buff || h.debuff ? 52 : 34), text: h.status, color: "#ff9ad0", t0: ht0 + 60, small: true, kind: "label" });
      if (h.died) {
        anyDeath = true;
        // 撃破: 魔物が白く焼けて灰に崩れる (描画は drawEffects)
        if (!fx.deaths.some((d) => d.uid === h.target.uid)) fx.deaths.push({ uid: h.target.uid, mon: h.target.mon, unk: enemyUnknown(h.target), x: pos.cx, y: pos.cy, size: pos.size || 9, t0: ht0 });
      }
    } else {
      // 味方が対象
      if (h.buff || h.debuff) {
        // 強化/弱体が味方にかかった: 緑(▲)/赤(▼)のフロートで発動を知らせる (敵のピル表示と同様に可視化)
        const mt = buffFloatText(h);
        G.partyFx.set(h.target, h.buff ? "heal" : "hit");
        setPartyFxV(h.target, h.buff ? "buff" : "debuff");
        const n = partyModHits.length, mi = partyModIdx++;
        const fx0 = n > 1 ? VW * (mi + 1) / (n + 1) : VW / 2;
        const fy0 = VH - 26 - (mi % 2) * 16;
        fx.floats.push({ x: fx0, y: fy0, text: mt.text, color: mt.color, t0: now + mi * stag, kind: "buff" });
      } else if (h.cured != null) {
        // 状態異常・弱体の治癒も知らせる
        if (h.cured) {
          G.partyFx.set(h.target, "heal");
          setPartyFxV(h.target, "cure");
          fx.floats.push({ x: VW / 2, y: VH - 26, text: "治癒✚", color: "#9be8ff", t0: now });
        }
      } else if (h.mpHeal != null) {
        // 魔力の譲渡
        G.partyFx.set(h.target, "heal");
        setPartyFxV(h.target, "mana");
        fx.floats.push({ x: VW / 2, y: VH - 26, text: "MP+" + h.mpHeal, color: "#7fb8ff", t0: now, kind: "heal" });
      } else if (h.heal != null) {
        G.partyFx.set(h.target, "heal");
        // 複数人を回復する時は横に散らし、順に弾ませて全員の回復を見せる
        const n = partyHeals.length;
        const i = partyHealIdx++;
        const fx0 = n > 1 ? VW * (i + 1) / (n + 1) : VW / 2;
        const fy0 = VH - 26 - (i % 2) * 16; // 重なり回避に上下も少しずらす
        fx.floats.push({ x: fx0, y: fy0, text: "+" + h.heal, color: "#7CFC7C", t0: now + i * stag, kind: "heal" });
        setPartyFxV(h.target, "heal");
        spawnFx(fx.skill, "rise", partyFxX(h.target), VH - 8, now + i * stag, spd, { seed: i + 3, s: 0.8 * (prof ? prof.scale : 1), col: "#7CFC7C" });
      } else if (h.steal) {
        // 窃盗: ゴールド/Soul の控除はここで行う (combat.js は G を知らない)
        partyHit = true;
        G.partyFx.set(h.target, "hit");
        setPartyFxV(h.target, "claw");
        if (h.steal === "goldSteal") {
          const s = res._persistedConsequences ? h.persistedSteal : Math.min(G.gold, h.stealAmt || 0);
          if (!res._persistedConsequences) {
            G.gold -= s;
            if (G.run) G.run.gold = Math.max(0, G.run.gold - s);
          }
          log(`${h.target.name}は 💰${s} を奪われた！`, "dmg");
          fx.floats.push({ x: VW / 2, y: VH - 26, text: `-💰${s}`, color: "#ffd84a", t0: now });
        } else {
          const s = res._persistedConsequences ? h.persistedSteal : Math.min(G.soulPts, h.stealAmt || 0);
          if (!res._persistedConsequences) {
            G.soulPts -= s;
            if (G.run) G.run.soulPts = Math.max(0, G.run.soulPts - s);
          }
          log(`${h.target.name}は ✦${s} Soul を吸い取られた！`, "dmg");
          fx.floats.push({ x: VW / 2, y: VH - 26, text: `-✦${s}`, color: "#b06bff", t0: now });
        }
        updateTopbar();
      } else if (h.stoned) {
        partyHit = true;
        G.partyFx.set(h.target, "hit");
        setPartyFxV(h.target, "stone");
        fx.floats.push({ x: VW / 2, y: VH - 26, text: "石化!", color: "#c9c4b8", t0: now });
      } else if (h.status && h.dmg == null) {
        // 眠り・魅了・混乱をかけられた (ダメージなし)
        partyHit = true;
        G.partyFx.set(h.target, "hit");
        setPartyFxV(h.target, "status");
        const n = res.hits.filter((x) => x.status && x.dmg == null).length, i = res.hits.filter((x) => x.status && x.dmg == null).indexOf(h);
        fx.floats.push({ x: n > 1 ? VW * (i + 1) / (n + 1) : VW / 2, y: VH - 26 - (i % 2) * 16, text: h.status, color: "#ff9ad0", t0: now + i * stag });
      } else if (!h.miss) {
        partyHit = true;
        G.partyFx.set(h.target, "hit");
        // 札の上の演出: ブレス・全体呪文は属性の色、打撃は爪痕 (会心は金)。打撃は戦場の下端にも爪痕を走らせる
        if (res.action === "breath") setPartyFxV(h.target, "el-" + (ELEM_FX_COL[res.actor.element] ? res.actor.element : "none"));
        else {
          setPartyFxV(h.target, h.crit ? "claw crit" : "claw");
          spawnFx(fx.skill, "pclaw", partyFxX(h.target), VH - 6, now, spd, { crit: !!h.crit });
        }
        fx.floats.push({ x: partyDmgN > 1 ? partyFxX(h.target) : VW / 2, y: VH - 26, text: String(h.dmg) + (h.fatal ? " 即死!" : ""), color: h.fatal ? "#ff2a2a" : "#ff6b6b", t0: now, kind: "pdmg" });
        if (h.died) anyDeath = true;
        // レベルドレイン: 宿しているメイン魂のレベルを永続的に1下げる
        if (!res._persistedConsequences && h.drain && h.target.isDoll && h.target.primary != null) {
          const s = soulByUid(h.target.primary);
          if (s && s.level > 1) {
            s.level--;
            recalcAllDolls();
            const lbl = SOUL_CLASSES[s.clsKey].label;
            log(`${h.target.name}の${lbl}の魂が喰われ、Lv${s.level} に堕ちた…！`, "dmg");
            setTimeout(() => showToast(`☠ レベルドレイン: ${lbl}の魂 Lv-1`, { noLog: true }), 300);
          }
        }
      }
    }
  }
  // 全体技: 戦場を覆う一枚を重ねる (攻撃呪文 = 属性の大技 / 物理 = 一文字のなぎ / 回復・強化 = 天の光 / 弱体 = 紫の大環)
  if (prof && prof.all && !sig && res.hits.some((h) => h && !h.miss)) {
    const at = fxAnchor(res, prof);
    const o = { el: prof.el, spin: prof.spin, rot: prof.rot, seed: prof.seed, w: at.w, s: prof.scale };
    if (prof.kind === "atk") spawnFx(fx.skill, "field", at.x, at.y, now, spd, o);
    else if (prof.kind === "phys") spawnFx(fx.skill, "fieldslash", at.x, at.y, now, spd, { ...o, crit: res.hits.some((h) => h.crit) });
    else if (prof.ally && (prof.kind === "heal" || prof.kind === "buff" || prof.kind === "cure"))
      spawnFx(fx.skill, "blessing", VW / 2, VH, now, spd, { ...o, col: prof.kind === "heal" ? "#7CFC7C" : prof.kind === "cure" ? "#9be8ff" : "#ffd84a" });
    else if (prof.kind === "debuff" && !prof.ally) spawnFx(fx.skill, "fieldhex", at.x, at.y, now, spd, o);
  }
  // 看板技の一枚もの: 敵の列 (field) / 隊の上 (party) / 回復した味方の位置 (ally)
  if (sig && sig.mode !== "hit" && res.hits.some((h) => h && !h.miss)) {
    const mates = [...new Set(res.hits.filter((h) => h && h.target && h.target.side !== "enemy" && !h.miss).map((h) => h.target))];
    if (sig.mode === "field") {
      const at = fxAnchor(res, prof);
      const pts = [...new Set(res.hits.filter((h) => h && !h.miss && h.target && h.target.side === "enemy").map((h) => h.target))]
        .map((t) => G.enemyPos[t.uid]).filter(Boolean).map((p) => ({ x: p.cx, y: p.cy }));
      spawnFx(fx.skill, sig.type, at.x, at.y, now, spd, { w: at.w, pts, seed: prof.seed });
    } else if (sig.mode === "party") {
      spawnFx(fx.skill, sig.type, VW / 2, VH, now, spd, { pts: mates.map((p) => ({ x: partyFxX(p), y: VH - 20 })), seed: prof.seed });
    } else for (const p of mates) spawnFx(fx.skill, sig.type, partyFxX(p), VH, now, spd, { seed: prof.seed });
  }
  // ブレス: 敵から隊へ属性の奔流が押し寄せる / 全体呪文: 隊の札の上で属性の呪文が弾ける
  if (res.action === "breath") {
    const el0 = res.fxEl || res.actor.element; // 写し身の呪文は呪文の属性で
    const el = ELEM_FX_COL[el0] ? el0 : "none";
    const sp0 = G.enemyPos[res.actor.uid];
    if (!res.espell && sp0) spawnFx(fx.skill, "breath", sp0.cx, sp0.cy, now, spd, { el, seed: res.actor.uid || 1 });
    else if (res.espell) {
      const seen = new Set();
      res.hits.forEach((h, i) => {
        if (!h.target || h.target.side === "enemy" || seen.has(h.target)) return;
        seen.add(h.target);
        spawnFx(fx.skill, el, partyFxX(h.target), VH - 22, now + i * 30 * spd, spd, { seed: i + 11, s: 0.7 });
      });
    }
  }
  if (partyHit) { fx.screen = { color: "#d4504e", t0: now }; buzz([0, 50, 50, 50]); shakeScreen(true); }
  if (anyDeath) setTimeout(() => SFX.die(), 200);
}

// 戦闘勝利時: 入手Soulの1/3を、生存している隊メンバーが宿す魂 (メイン魂・サブ魂はその1/3) に
// 経験値(soul.exp)として加算する。限界(soulTrainCost)に達した魂は自動でレベルアップし、
// キャラLv上昇/スキル習得を検出してポップアップ用のキューを返す。
// 戦闘でサブ魂に入る経験値の割合 (メイン魂の分に対して)
const SUB_EXP_RATE = 1 / 3;
// 留守居の修練 (第六章の結び = FEATURES.rusui。遠征の差し替え、2026-10 ユーザーの指示):
// 留守居の席に就けた控えの人業のメイン魂にも、隊のメイン魂が得る分の 10% が入る。席は第六章で1つ、先の章で増える (rusuiSeats)。
// 無限迷宮で得た分は入れない (rusuiSeated が無限迷宮の間は空)。
// 控えの魂それぞれの Lv で減らす (soulLvMul)。砕けた人業・魂の宿らない器は除く。レベルアップの画面は出さず、帰還の報告に載せる
const RUSUI_EXP_RATE = 0.10;
function distributeBattleSoulExp(...args) { return tlGameMeasure("growth", () => distributeBattleSoulExpMeasured(...args)); }
function distributeBattleSoulExpMeasured(soulGot) {
  const queue = [];
  const share = Math.floor((soulGot || 0) / 3);
  if (share <= 0) return queue;
  // 魂の薫陶 (soulTutor): その人業が宿す魂 (メイン・サブ) の得るEXP +10/20/30%
  const tutorMul = (m) => 1 + ([0, 0.10, 0.20, 0.30][Math.min(3, pLv(m, "soulTutor"))] || 0);
  // 経験値は「編成中に宿している魂」(メイン魂・サブ魂とも) ごとに1回ずつ入る。
  // 魂インスタンスごとに1回だけ加算する (旧セーブの重複装着でも二重加算しない)。
  // サブ魂が得る経験値はメイン魂の 1/3 (SUB_EXP_RATE)。どこかでメイン魂として宿していれば全量扱いにする。
  const worn = []; // {uid, sub}
  const seen = new Set();
  // まずメイン魂 (全量) を集める
  for (const m of G.party) {
    if (!m || !m.alive) continue;
    if (m.primary != null && !seen.has(m.primary)) { seen.add(m.primary); worn.push({ uid: m.primary, sub: false, mul: tutorMul(m) }); }
  }
  // 次にサブ魂 (1/3)。メイン魂として既に集めた魂は除く
  for (const m of G.party) {
    if (!m || !m.alive) continue;
    for (const s of (m.subs || [])) if (s && s.uid != null && !seen.has(s.uid)) { seen.add(s.uid); worn.push({ uid: s.uid, sub: true, mul: tutorMul(m) }); }
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
  const preSubSkills = new Map(); // サブ魂 uid → 加算前に覚えていた技 (サブ魂が覚えた技もレベルアップの画面に出す)
  for (const w of worn) if (w.sub) { const e = soulByUid(w.uid); if (e) { preSubLv.set(w.uid, e.level); preSubSkills.set(w.uid, soulLearnedSkills(e)); } }
  // 宿している魂すべてに Soul を加算してレベルアップ (上限超過分は exp に蓄積)。
  // サブ魂はメイン魂の 1/3 (share × SUB_EXP_RATE) を得る。
  for (const w of worn) {
    const e = soulByUid(w.uid);
    if (!e) continue;
    const gain = Math.floor((w.sub ? share * SUB_EXP_RATE : share) * (w.mul || 1) * soulLvMul(e.level));
    if (gain <= 0) continue;
    e.exp = (e.exp || 0) + gain;
    settleSoulExp(e); // Lv上限の魂は exp に蓄積し、上限が伸びた時に Lv へ注ぐ
  }
  recalcAllDolls({ levelUp: true });
  // メンバーごとに「レベルアップ(上昇ステータス付き)→新規スキル」をポップアップ用キューへ
  const STAT_LABEL = { maxhp: "HP", maxmp: "MP", atk: "STR", vit: "VIT", agi: "AGI", int: "INT", pie: "PIE", luk: "LUK" };
  for (const m of G.party) {
    if (!m || !m.alive) continue;
    const ps = m.primary != null ? soulByUid(m.primary) : null;
    const newLv = ps ? ps.level : 0;
    const oldLv = preLv.get(m) || 0;
    const before = preStat.get(m) || {};
    const deltas = [];
    for (const k of STAT_KEYS) { const d = (m[k] || 0) - (before[k] || 0); if (d > 0) deltas.push(`${STAT_LABEL[k]} +${d}`); }
    // レベルアップの祝祭用: 能力の before/after (hp/mp… の表示キー)
    const sk = (k) => (k === "maxhp" ? "hp" : k === "maxmp" ? "mp" : k);
    const statsFrom = {}, statsTo = {};
    for (const k of STAT_KEYS) { statsFrom[sk(k)] = before[k] || 0; statsTo[sk(k)] = m[k] || 0; }
    // 伸びた能力はその人の最初の行 (メイン魂 → なければ最初のサブ魂) にまとめて載せる
    let shown = false;
    if (newLv > oldLv) {
      queue.push({ kind: "level", member: m, uid: m.primary, fromLv: oldLv, toLv: newLv, deltas, statsFrom, statsTo });
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
      queue.push({ kind: "level", member: m, uid: sub.uid, fromLv: from, toLv: e.level, deltas: shown ? [] : deltas, sub: true, soulLabel: cls ? cls.label : e.clsKey, statsFrom, statsTo });
      shown = true;
    }
    const oldSp = preSpells.get(m) || new Set();
    const gained = (m.spells || []).filter((sk) => !oldSp.has(sk));
    // サブ魂そのものが覚えた技 (宿主の技には入らないが、街での強化と同じく新たな技として見せる)
    for (const sub of (m.subs || [])) {
      const e = sub && sub.uid != null && preSubSkills.has(sub.uid) ? soulByUid(sub.uid) : null;
      if (!e) continue;
      const old = preSubSkills.get(sub.uid);
      for (const sk of soulLearnedSkills(e)) if (!old.includes(sk) && !gained.includes(sk)) gained.push(sk);
    }
    for (const sk of gained) queue.push({ kind: "skill", member: m, skill: sk });
  }
  return queue;
}

// 戦闘の成長キュー (distributeBattleSoulExp) を、レベルアップの祝祭 (UI.celebrateLevelUp) に渡す1人1件の形へまとめる。
// { name, doll, uid (メイン魂), main: {from, to} | null, subs: [{uid, label, from, to}], statsFrom, statsTo, skills: [key] }
function levelUpEntries(progress) {
  const byMember = new Map();
  const entryOf = (m) => {
    if (!byMember.has(m)) byMember.set(m, { name: m.name, doll: m, uid: m.primary, main: null, subs: [], statsFrom: null, statsTo: null, skills: [] });
    return byMember.get(m);
  };
  for (const q of progress) {
    if (q.kind === "level") {
      const e = entryOf(q.member);
      if (q.sub) e.subs.push({ uid: q.uid, label: q.soulLabel || "", from: q.fromLv, to: q.toLv });
      else e.main = { from: q.fromLv, to: q.toLv };
      if (!e.statsFrom && q.statsFrom) { e.statsFrom = q.statsFrom; e.statsTo = q.statsTo; }
    } else if (q.kind === "skill") entryOf(q.member).skills.push(q.skill);
  }
  return [...byMember.values()].filter((e) => e.main || e.subs.length);
}

function endBattle(...args) { return tlGameMeasure("battle", () => endBattleMeasured(...args)); }
function endBattleMeasured() {
  const b = G.battle;
  G.effShow = null; G.modFeed = null; flushModLines(null, Infinity);
  if (b.tl) tlBattleEnd(b.tl, { result: b.result, rounds: b._roundNo, tally: b.tally, party: G.party });
  if (G.rematch) return endRematch(b); // 宿敵の再戦: 終われば隊を戻して街へ (迷宮の戦果・踏破・全滅の扱いには入らない)
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
    let { soul, gold } = b.rewards();
    // 観客の注文 (闘技場跡の迷宮の掟): 応えて勝てば、この戦闘の ✦Soul・金貨が増える
    { const am = audienceJudge(b); if (am !== 1) { soul = Math.round(soul * am); gold = Math.round(gold * am); } }
    const gl = partyPassiveLv("goldLuck"), sl = partyPassiveLv("soulLure");
    // テスト記録の出どころ: 金属の魔物 / 主 / 精鋭等 / 通常の戦闘 (戦闘の記録の種類と同じ分け方)
    const bsrc = b.enemies.some((e) => e.metal) ? "mt" : "b" + ((b.tl && b.tl.kind) || "n");
    const goldGot = runGainGold(Math.round(gold * 2 * (gl >= 3 ? 1.50 : gl >= 2 ? 1.30 : gl === 1 ? 1.15 : 1)), bsrc, gold * 2, battleModifierReward(b, "gold")) + takeStolenGold(b);
    const sb = rankParty("bishopSeibetsu", [0.05, 0.07, 0.10, 0.15]); // 魂の聖別 (司教のランク)
    const soulOut = {};
    const soulGot = runGainSoulPts(Math.round(soul * ((sl >= 3 ? 1.35 : sl >= 2 ? 1.20 : sl === 1 ? 1.10 : 1) + sb)), bsrc, soul, battleModifierReward(b, "soul"), soulOut);
    applyVictoryPassives();
    // 入手Soulの1/3を生存メンバーの魂 (サブ魂はその1/3) に加算 → レベルアップ/スキル習得を集計
    // (Lv差の減りは魂それぞれの Lv で掛け直すので、隊のLv で減らす前の額を渡す)
    const progress = distributeBattleSoulExp(soulOut.raw ?? soulGot);
    updateTopbar();
    log(`勝利！ 💰${goldGot} と ✦${soulGot} Soul を得た。`, "win");
    const fled = b.enemies.filter((e) => e._fled).length; // 逃げ去った金属の魔物 (戦果は倒した分だけ)
    if (fled) log(`${fled}体には逃げられた (逃げた分の戦果は無い)。`, "sys");
    SFX.victory();
    // 討伐クエストの進捗 + 戦績 + 図鑑記録 (倒した敵を集計)。
    // 戦利品はここでは抽選のみ。実物は勝利後の宝箱から取り出す
    let kills = 0;
    for (const e of b.enemies) {
      if (e.alive || e._fled) continue; // 逃げ去った金属の魔物は討伐に数えない
      kills++;
      questProgress("kill", e.key);
      G.stats.kills++;
      if (e.element && e.element !== "none") G.stats.elemKills[e.element] = true; // 戦績: 撃破した属性 (勲章用)
      if (e.isMimic) G.stats.mimics++;                       // 戦績: ミミック撃破数
      if (e.isMasterMimic) G.stats.masterMimicSlain = true;  // 戦績: マスターミミック討伐 (一度きり)
      if (e.mon && e.mon.elite) G.stats.elites = (G.stats.elites || 0) + 1; // 戦績: 精鋭撃破数
      if (e.metal) G.stats.metals = (G.stats.metals || 0) + 1;               // 戦績: 金属の魔物の撃破数
      codexKillNow(e); // 図鑑は倒したその瞬間に記録済み (取りこぼしの保険。二重には数えない)
    }
    runCount("kills", kills);
    // 層ボスを1ターンで討ち取ったか (勲章: 電光石火)
    if (b._roundNo <= 1 && b.enemies.some((e) => !e.alive && e.boss)) G.stats.swiftBoss = true;
    // 戦利品は勝利ごとに1品まで汎用抽選 (固有ドロップ廃止)。宝箱は1つだけ現れる
    let drop = rollGenericDrop();
    // 強敵討伐ボーナス: 高ランクアイテムの確定ドロップ
    const wasElite = b.enemies.some((e) => !e.alive && e.mon && e.mon.elite);
    if (wasElite) {
      const eid = pickLoot({ elite: true }); // 適正帯より2ランク上のアイテム
      if (ITEMS[eid]) drop = { key: "elite", name: "強敵", id: eid, item: cloneItem(eid), rare: true };
    }
    // 名のある強敵を初めて討った (首級をまだ手にしていない): 首級を宝箱に必ず入れる (固有ドロップ廃止の例外)
    const trophies = [];
    for (const e of b.enemies) {
      const nf = !e.alive && !e._fled && e.mon && e.mon.named ? NAMED_FOES[e.key] : null;
      if (nf && ITEMS[nf.trophy] && !namedState().trophy[e.key] && !trophies.some((t) => t.id === nf.trophy)) {
        trophies.push({ key: "trophy", name: "首級", id: nf.trophy, item: cloneItem(nf.trophy), rare: true });
        log(`名のある強敵「${e.name}」を討ち取った！`, "win");
      }
    }
    // 無限迷宮の主: boss フラグを持つが踏破ではない。撃破で適正帯より上等な戦利品を残す
    const wasGuard = abyssActive() && !corpse && b.enemies.some((e) => e.boss);
    if (wasGuard) {
      const gid = pickLoot({ elite: true });
      if (ITEMS[gid]) drop = { key: "guard", name: "門番", id: gid, item: cloneItem(gid), rare: true };
    }
    // soulClass を持つ敵 (人型・騎士など) はまれに魂を落とす (レアドロップ)。
    // 落とした魂はこの場で所持魂に加え (保存に乗せる)、戦果シートの一行で知らせる。レア以上はシートの後に祝う
    const souls = [];
    for (const e of b.enemies) {
      const sc = e.alive || e._fled ? null : (e.mon && e.mon.soulClass) || (MONSTERS[e.key] && MONSTERS[e.key].soulClass);
      if (!sc) continue;
      const soulChance = wasElite ? 0.40 : 0.08; // 強敵は魂ドロップ率が大幅上昇
      if (random() < soulChance) {
        const clsKey = rollJobClass();
        log(`${e.name}が ${SOUL_CLASSES[clsKey].label}の魂 を落とした！`, "win");
        souls.push(grantSoulQuiet(clsKey, `${e.name}が落とした魂だ。`));
      }
    }
    // 死体戦は宝箱を出さず、死体に残っていた魂を100%回収する (残火も同時に)
    if (corpse) {
      souls.push(grantSoulQuiet(corpse.clsKey, corpse.great ? "偉大なる魂を回収した。" : "死体に残っていた魂を回収した。", emberReward(corpse.great)));
    }
    if (abyssActive() && !corpse) infBattleTrack(b, wasGuard); // 無限迷宮の称号・勲章の数え
    // 無限迷宮の主: 撃破を記録する (この階から帰れる・先へ潜れる)
    if (wasGuard) {
      G.abyss.guardFloor = G.floor;
      G.bossDown = true;
      flashScreen("#d4504e"); buzz([0, 60, 50, 60, 50, 250]);
    }
    // 迷宮踏破は本物の主戦のみ。死体から湧いた個体 (corpse)・無限迷宮の主は踏破扱いにしない
    const wasBoss = !corpse && !abyssActive() && b.enemies.some((e) => e.boss);
    if (wasBoss) { flashScreen("#ffd84a"); buzz([0, 60, 50, 60, 50, 250]); } // 主討伐は特別な瞬間
    else if (wasElite) { flashScreen("#d4504e"); buzz([0, 80, 50, 80, 50, 300]); }
    // 出来事の戦闘: マスはイベント側が片付ける (連戦・報酬の続きがある)。勝った印だけ先に残す
    const evCell = G.battleCell && G.battleCell.type === "event" ? G.battleCell : null;
    if (evCell) { if (evCell.evFight) evCell.evFight.won = true; }
    else if (G.battleCell) G.battleCell.cleared = true;
    evBattleEnd(true);
    if (wasBoss && G.events && G.events.flags && G.events.flags.bossWeak) delete G.events.flags.bossWeak[battleLayer()];
    // 主討伐の確定処理 (踏破記録・初踏破なら王への報告待ち G.world.report・戦利品確定) は演出より先に行い、
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
      : wasGuard ? () => openInfRest()
      : (hordeRewardPending() ? () => grantHordeReward() : null);
    const hasChest = !activeCfg().noChests && !corpse && (trophies.length || !(evCell && evCell.evFight && evCell.evFight.noChest)) && (drop || trophies.length || wasElite || wasGuard || wasMimic || (specialDef() || {}).sureChest || random() < 0.5);
    const chest = hasChest
      ? battleChestSpec([...trophies, ...(drop ? [drop] : [])], wasMasterMimic ? 30 : wasMimic ? 15 : 0, wasMimic || wasMasterMimic, after ? ["alarm"] : null)
      : null;
    // 戦果シート (§3.3): 勝利・獲得・成長・魂・宝箱を1枚にまとめる (旧: 勝利・Lv・技・宝箱・罠・中身の札が1枚ずつ)
    const levels = progress.filter((q) => q.kind === "level").map((q) => ({ name: q.member.name, uid: q.member.uid, from: q.fromLv, to: q.toLv, deltas: q.deltas || [], sub: !!q.sub, soulLabel: q.soulLabel || "" }));
    const skills = progress.filter((q) => q.kind === "skill").map((q) => ({ name: q.member.name, key: q.skill, skill: SPELLS[q.skill] ? SPELLS[q.skill].name : q.skill, desc: SPELLS[q.skill] ? SPELLS[q.skill].desc : "" }));
    // 成長と覚えた技は戦果シートに出るだけだったので、記録にも残す
    for (const l of levels) log(`${l.name}${l.sub && l.soulLabel ? `のサブ魂「${l.soulLabel}の魂」` : ""}が Lv${l.from} → Lv${l.to} に上がった！`, "win");
    for (const k of skills) log(`${k.name}は「${k.skill}」を覚えた！`, "win");
    uiResults.openResults({
      kind: wasBoss ? "boss" : wasElite ? "elite" : wasGuard ? "guard" : corpse ? "corpse" : "win",
      gold: goldGot, soul: soulGot, kills, fled,
      levels, skills, souls, levelUps: levelUpEntries(progress),
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
    if (stolen) { log(`盗んだ 💰${stolen} を懐に逃げ延びた`, "win"); updateTopbar(); }
    evBattleEnd(false);
    if (G.prevPos) { G.px = G.prevPos.x; G.py = G.prevPos.y; }
    finishToBoard();
  } else if (b.result === "escaped") {
    // 敵に1体残らず逃げられた (金属の魔物): 戦果はなく、札は消える
    SFX.flee();
    log("逃げられてしまった…", "sys");
    const stolen = takeStolenGold(b);
    if (stolen) { log(`盗んだ 💰${stolen} だけは手元に残った`, "win"); updateTopbar(); }
    showToast("逃げられてしまった…", { noLog: true, tone: "info" });
    if (G.battleCell && G.battleCell.type === "monster") G.battleCell.cleared = true;
    evBattleEnd(false);
    finishToBoard();
  } else if (b.result === "lose") {
    gameOver();
  }
}
// 戦闘勝利後の常時効果: 戦闘後回復/魔力回路/法力の灯 (隊の全員の状態異常をすべて治す)/浄化/慈悲の祈り。MP回復は魂1つあたり5%まで。
// Lv付きは最高Lvのみ。教皇の祈り (popePrayer) は持ち主の戦闘後回復を隊の全員へ広げる
function applyVictoryPassives(...args) { return tlGameMeasure("victory", () => applyVictoryPassivesMeasured(...args)); }
function applyVictoryPassivesMeasured() {
  let pope = 0;
  for (const p of G.party) if (p.alive && pLv(p, "popePrayer")) pope = Math.max(pope, pLv(p, "afterHeal"));
  const HEAL_PCT = [0, 0.05, 0.10, 0.20, 0.30];
  let healed = false;
  for (const p of G.party) {
    if (!p.alive) continue;
    const hpct = HEAL_PCT[Math.max(pLv(p, "afterHeal"), pope)];
    const ml = pLv(p, "afterMp");
    // 職ごとの固有パッシブ (win) と、MP の共通パッシブ (魔力回路 1/2%)。MP は魂1つあたり4%まで (perkVictory)
    const pw = perkVictory(p, G.party, { afterMp: ml >= 2 ? 0.02 : ml === 1 ? 0.01 : 0 });
    const hpct2 = hpct + pw.hp;
    const mpct = pw.mp;
    if (hpct2 > 0 && p.hp < p.maxhp) { p.hp = Math.min(p.maxhp, p.hp + Math.ceil(p.maxhp * hpct2)); healed = true; }
    if (mpct > 0 && p.mp < p.maxmp) { p.mp = Math.min(p.maxmp, p.mp + Math.ceil(p.maxmp * mpct)); healed = true; }
  }
  if (healed) log("勝利の余韻が隊を癒した。", "heal");
  // 特別階 (癒しの霊気)・迷宮の掟 (癒しの樹液): 戦闘勝利のたび隊の全員のHP・MPが回復する
  const fh = Math.max(sfNum("victoryHeal", 0), (dungeonTrait() && dungeonTrait().victoryHeal) || 0);
  tlGameMeasure("victoryTerrain", () => {
  if (fh > 0) {
    let mist = false;
    for (const p of G.party) {
      if (!p.alive) continue;
      if (p.hp < p.maxhp) { p.hp = Math.min(p.maxhp, p.hp + Math.ceil(p.maxhp * fh)); mist = true; }
      if (p.mp < p.maxmp) { p.mp = Math.min(p.maxmp, p.mp + Math.ceil(p.maxmp * fh)); mist = true; }
    }
    if (mist) log(sfNum("victoryHeal", 0) > 0 ? "癒しの霊気が傷を塞ぎ、魔力を満たした。" : "樹液の香りが傷を塞ぎ、魔力を満たした。", "heal");
  }
  });
  // 法力の灯 (隊の全員): 生きている味方の状態異常をすべて治す (毒・麻痺・石化も。2026-10 ユーザーの指示)
  if (G.party.some((p) => p.alive && pLv(p, "afterBoth"))) {
    let lit = false;
    for (const p of G.party) if (p.alive && cureAil(p)) lit = true;
    if (lit) log("法力の灯が隊を照らし、穢れをすべて払った。", "heal");
  }
  // 浄化 (隊の全員) / 自浄 (自分): 毒・麻痺を治す (石化は対象外)
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
      setTimeout(() => showToast(`慈悲の祈り ― ${dead.name}が立ち上がった`, { noLog: true, tone: "good" }), 400);
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
  log(G.run && G.run.abandoned ? "迷宮を諦めた。人業はことごとく砕けた…" : "人業はことごとく砕けた…", "dmg");
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
  // 無限迷宮: 赤い魂 (全滅した階の数・上限100) を払えば拾った魂・品・残火を持ち帰れる。払わなければ何も持ち帰れない
  if (abyssActive()) {
    const cost = infRedCost(G.floor);
    let items = G.inventory.length;
    for (const d of G.party) { for (const k of Object.keys(d.equip || {})) if (d.equip[k]) items++; }
    UI.openInfWipe({
      abandoned: !!r.abandoned, floor: G.floor, cost, red: G.redSoul, canSave: G.redSoul >= cost,
      souls: (r.souls || []).length, items, embers: r.embers || 0, sold: (infTrk().sold || 0),
      onSave: () => {
        if (G.redSoul < cost) return;
        G.redSoul -= cost;
        SFX.levelup(); buzz([0, 30, 40, 30]);
        log(`赤い魂 ${cost} が、拾った魂と品を地上へ運んだ。`, "win");
        goTown({ outcome: "saved" });
      },
      onGiveUp: () => { log("拾った魂も品も、迷宮の底に残された…", "dmg"); goTown({ outcome: "wipe" }); },
    });
    return;
  }
  uiResults.openWipe({
    abandoned: !!r.abandoned, // 自ら迷宮を諦めた (全滅と同じ扱い)
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
      log(secured ? "砕けた人業は、連れ帰りを待つ。" : "今回得た金貨・アイテム・魂は失われた…（✦Soul は残った）", "dmg");
      goTown({ outcome: "wipe", run, forfeited });
    },
  });
}

// 迷宮を諦める (手帳から、2026-10 ユーザーの指示): 全滅と同じ扱い。
// 隊の全員が砕け、全滅の決断 (赤い魂で全てを守る / あきらめて救出を待つ) へ進む
function confirmAbandonDungeon() {
  if (G.state !== "board" || G.anim || G.walking || uiBlocked()) return;
  const secured = !!(G.run && G.run.secured);
  showConfirm({
    title: "迷宮を諦める？",
    lines: abyssActive() ? [
      "全滅と同じ扱いになる。仮の器はことごとく崩れる。",
      `赤い魂 ${infRedCost(G.floor)} を払わなければ、拾った魂・品・残火を何も持ち帰れない。`,
    ] : [
      "全滅と同じ扱いになる。隊の人業はことごとく砕け、連れ帰りを待つ。",
      secured ? "主を討った後なので、戦利品は失わない。" : `赤い魂 ${GUARDIAN_COST} を使わなければ、今回得た金貨・品・魂を失う。`,
      "✦Soul は失わない。",
    ],
    okLabel: "諦める",
    onOk: abandonDungeon,
  });
}
function abandonDungeon() {
  if (G.state !== "board") return;
  setAutoMove(false);
  if (!G.run) G.run = newRun();
  G.run.abandoned = true;
  for (const p of G.party) {
    p.alive = false; p.hp = 0;
    p.asleep = false; p.mind = null;
  }
  gameOver();
  autosave(true);
}

// 迷宮の主を撃破した瞬間の確定処理。演出 (showDungeonClearedPopup) とは分離し、
// 勝利確定と同時に保存されるため、演出中に中断されても踏破・章進行は失われない
function commitDungeonClear(countBoss = true) {
  const idx = G.dungeonIdx;
  if (countBoss) {
    G.stats.bossKills++;
    const bk = DUNGEONS[idx] && DUNGEONS[idx].boss;
    if (bk) G.stats.bossIds[bk] = true; // 戦績: 討伐した層ボスの種類 (勲章用)
  }
  const cfg = DUNGEONS[idx];
  G.dragonSlain = G.dragonSlain || (cfg.layer >= 20 && !!cfg.boss);
  // 初めての踏破は王への報告待ちにする (報告で褒美・物語・新たな迷宮・機能解放)。2度目からは記録だけ
  const w = worldState();
  const isStoryTarget = !!cfg && !w.cleared[cfg.id];
  if (cfg) w.cleared[cfg.id] = (w.cleared[cfg.id] || 0) + 1;
  // 依頼の迷宮 (side) は王への報告が無い (踏破は依頼人に報告する)
  if (isStoryTarget && !w.reported[cfg.id] && !cfg.side && !w.report) w.report = cfg.id;
  if (cfg) questProgress("clear", cfg.id);
  // クリア = 戦利品確定。記録 (帰還の報告に使う) は残し、全滅しても何も失わない印を付ける
  if (G.run) G.run.secured = true;
  G.bossDown = true; // 主を討ったので、どこからでも帰還できる
  if (tlOn()) tlSnapshot("clear", tlWhere(), G.party);
  return { idx, isStoryTarget };
}

// 踏破の凱旋 (確定処理は commitDungeonClear 済み): 「★ 迷宮踏破 ★」の祝祭 → 凱旋で闇に溶けて街へ
function showDungeonClearedPopup(info) {
  const dn = DUNGEONS[info.idx];
  if (playBossMemory(dn?.id, () => celebrateDungeonClear(info))) return;
  celebrateDungeonClear(info);
}
// 読み終えた時だけ記録する。中断した記憶は、再開時にも報告前にも読み直せる。
function playBossMemory(id, done) {
  const mem = BOSS_MEMORIES[id];
  const w = worldState();
  if (!mem || !w.cleared[id] || w.beats["mem_" + id]) return false;
  UI.playStoryChain([{ title: mem.title, lines: storyLines(mem.lines), art: mem.art, photo: storyImage("mem_" + id), who: "none", kicker: "魂の記憶", btnLabel: "胸に刻む" }], () => {
    w.beats["mem_" + id] = 1;
    autosave(true);
    if (done) done();
  });
  return true;
}
function celebrateDungeonClear({ idx, isStoryTarget }) {
  const dn = DUNGEONS[idx];
  SFX.victory(); buzz([0, 40, 50, 40, 50, 200]);
  flashScreen("#ffd84a");
  uiResults.celebrateClear({
    name: dn.name, layer: dn.layer, isStoryTarget, layerBoss: !!dn.boss,
    missingClue: reportMissingClue(dn.id),
    last: dn.layer >= 20 && !!dn.boss,
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
    `踏破 ${clearedDungeonCount()}迷宮 ・ 最深 B${G.stats.deepest}F ・ 討伐 ${G.stats.kills}体\n` +
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

// ---- 隊表示 ----
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
function partyCallKey(p, st) {
  const c = st === "combat" && G.partyCall && G.partyCall.get(p);
  return c ? Math.round(c.at) + ":" + c.lines.map((l) => l.text).join("/") : "";
}
function renderParty() {
  const fx = G.partyFx;
  const st = G.state;
  const upgrades = new Set(G.party.filter((d) => UI.hasBetterGear && UI.hasBetterGear(d)));
  // 迷宮の掟の開幕の演出を待つ間は、効く前の HP/MP/状態を札に見せる (playTraitOpening)
  const shown = (p) => (st === "combat" && G.partyShow && G.partyShow.get(p)) || p;
  const key = st + "|" + G.party.map((p) => [
    p.uid, p.name, p.cls, p.isDoll ? (p.jobLv || 1) : p.level, shown(p).hp, p.maxhp, shown(p).mp, p.maxmp, p.alive ? 1 : 0,
    shown(p).ailment || "", p.asleep && st === "combat" ? 1 : 0, st === "combat" ? (p.mind || "") : "", fx && fx.has(p) ? fx.get(p) : "", (G.partyFxV && G.partyFxV.get(p)) || "", buffBadges(p),
    partyCallKey(p, st), upgrades.has(p) ? 1 : 0,
    `${p.jobKey || ""}:${p.jobRank || 1}:${p.clsKey || ""}`,
  ].join(",")).join(";");
  if (key === _partyKey && partyEl.childElementCount === G.party.length) return;
  _partyKey = key;
  partyEl.innerHTML = "";
  partyEl.classList.toggle("n4", G.party.length >= 4);
  G.party.forEach((p, idx) => {
    const card = document.createElement("div");
    const sv = shown(p);
    let cls = "pc" + (p.alive ? "" : " dead");
    if (p.alive && sv.hp / p.maxhp <= 0.25) cls += " low"; // 瀕死警告
    if (fx && fx.has(p)) cls += " fx-" + fx.get(p); // fx-hit / fx-heal
    if (_pdrag && _pdrag.p === p) cls += " lifting";
    if (_pdrag && _pdrag.over === idx) cls += " drop-over";
    card.className = cls;
    card.dataset.idx = idx;
    // 盤面: タップ = 隊のシート (迷宮の型) / 長押し = 持ち上げて隊列を並べ替える (動かさず離せば覗く)
    // 戦闘: 長押し = その場で覗く
    if (G.state === "board") {
      card.style.cursor = "pointer";
      card.setAttribute("role", "button");
      attachPartyDrag(card, p);
      card.addEventListener("click", () => {
        if (G._swiped) { G._swiped = false; return; } // 札の上からフリックして歩いた直後の click は無視
        if (Date.now() < _pdragSwallowUntil) return; // 長押しで持ち上げた後の click は無視
        if (holdForAutoMove(() => { if (!uiBlocked()) UI.openParty(idx, { context: "dungeon" }); })) return;
        if (G.anim || G.walking || uiBlocked()) return;
        UI.openParty(idx, { context: "dungeon" });
      });
    }
    if (G.state === "combat") attachLongPress(card, () => { SFX.select(); buzz(10); uiDungeonHud.peekDoll(p, { idx, combat: true }); });
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
    if (upgrades.has(p)) por.appendChild(UI.gearUpgradeDot());
    por.appendChild(el("span", "pc-row " + (idx < 3 ? "front" : "back"), idx < 3 ? "前" : "後"));
    if (!p.alive) por.appendChild(el("span", "pc-seal dead", "死"));
    else if (sv.ailment) { const a = AIL_SEAL[sv.ailment] || ["呪", "poison"]; const s2 = el("span", "pc-seal " + a[1], a[0]); s2.title = AIL_NAME[sv.ailment] || ""; por.appendChild(s2); }
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
    card.appendChild(vial("hp", sv.hp, p.maxhp));
    card.appendChild(vial("mp", sv.mp, p.maxmp));
    const bb = buffBadges(p);
    if (bb) card.insertAdjacentHTML("beforeend", bb);
    // 戦闘の演出 (爪痕・属性の奔流・回復の光…): 札の上に一度だけ走る薄い膜
    const fv = G.partyFxV && G.partyFxV.get(p);
    if (fv) card.appendChild(el("span", "pc-fx " + fv.split(" ").map((c) => "v-" + c).join(" ")));
    // 使った技・発動した効果の名 (肖像の上から右へ)。札が作り直されても、出た時からの経過で続きから見せる
    const call = st === "combat" && G.partyCall && G.partyCall.get(p);
    if (call) {
      const box = el("div", "pc-call no-phrase");
      box.style.setProperty("--calld", PARTY_CALL_MS + "ms");
      box.style.animationDelay = -Math.round(performance.now() - call.at) + "ms";
      for (const l of call.lines) box.appendChild(el("span", "pc-cl k-" + l.kind, l.text));
      card.appendChild(box);
    }
    partyEl.appendChild(card);
  });
}

// 迷宮の中の隊列の並べ替え (ユーザーの指示、2026-10): 隊の札を長押しで持ち上げ、指を動かして別の札の上で離すと入れ替える。
// 動かさずに離せば、従来の長押しと同じく その場で覗く。歩くたびに renderParty() が札を作り直しても
// 指を取りこぼさないよう、持ち上げた後は作り直されない器 (#party) に指を捕まえ、window で受ける。
// 持ち上げ中は札の上のフリック移動 (swipe) を止める。並びは館と同じく 前から3人 = 前衛。
const PDRAG_MS = 400;
let _pdrag = null;            // { p, from, over, moved, sx, sy, pid, ghost }
let _pdragSwallowUntil = 0;   // 持ち上げた指を離した直後の click を捨てる
function attachPartyDrag(card, p) {
  card.addEventListener("contextmenu", (e) => e.preventDefault());
  card.addEventListener("pointerdown", (e) => {
    if (e.button || _pdrag) return;
    const sx = e.clientX, sy = e.clientY, pid = e.pointerId;
    let timer = setTimeout(() => { timer = null; liftPartyCard(p, sx, sy, pid); }, PDRAG_MS);
    const cancel = () => {
      if (timer) { clearTimeout(timer); timer = null; }
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", cancel, true);
      window.removeEventListener("pointercancel", cancel, true);
    };
    const move = (ev) => {
      if (ev.pointerId !== pid) return;
      if (!timer) { cancel(); return; }
      if (Math.abs(ev.clientX - sx) > 10 || Math.abs(ev.clientY - sy) > 10) cancel(); // 先に動いた指はフリック移動に任せる
    };
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerup", cancel, true);
    window.addEventListener("pointercancel", cancel, true);
  });
}
function partyCardAt(x, y) {
  const t = document.elementFromPoint(x, y);
  const c = t && t.closest ? t.closest("#party .pc") : null;
  return c && c.dataset.idx != null ? +c.dataset.idx : -1;
}
function markPartyDrag() {
  if (!_pdrag) return;
  for (const c of partyEl.children) {
    const i = +c.dataset.idx;
    c.classList.toggle("lifting", G.party[i] === _pdrag.p);
    c.classList.toggle("drop-over", i === _pdrag.over);
  }
}
function liftPartyCard(p, sx, sy, pid) {
  if (G.state !== "board" || uiBlocked() || !G.party.includes(p)) return;
  stopSwipe(); // 札の上のフリック移動を止める (持ち上げ中は歩かない)
  const ghost = el("div", "pt-ghost");
  if (p.isDoll && p.primary != null) ghost.appendChild(crispCanvas(dollBust(p), 42));
  document.body.appendChild(ghost);
  document.body.classList.add("pt-dragging");
  _pdrag = { p, over: -1, moved: false, sx, sy, pid, ghost };
  const place = (x, y) => { ghost.style.transform = `translate(${x - 24}px, ${y - 28}px)`; };
  place(sx, sy);
  try { partyEl.setPointerCapture(pid); } catch (err) { /* 非対応環境は素通し */ }
  SFX.select(); buzz(12);
  markPartyDrag();
  const move = (e) => {
    if (!_pdrag || e.pointerId !== pid) return;
    e.preventDefault();
    if (Math.abs(e.clientX - sx) > 6 || Math.abs(e.clientY - sy) > 6) _pdrag.moved = true;
    place(e.clientX, e.clientY);
    const j = partyCardAt(e.clientX, e.clientY);
    const over = j >= 0 && G.party[j] !== p ? j : -1;
    if (over !== _pdrag.over) { _pdrag.over = over; markPartyDrag(); if (over >= 0) buzz(6); }
  };
  const end = (e) => {
    if (!_pdrag || e.pointerId !== pid) return;
    window.removeEventListener("pointermove", move, true);
    window.removeEventListener("pointerup", end, true);
    window.removeEventListener("pointercancel", end, true);
    const { moved } = _pdrag;
    const j = e.type === "pointerup" ? partyCardAt(e.clientX, e.clientY) : -1;
    ghost.remove();
    document.body.classList.remove("pt-dragging");
    _pdrag = null;
    _pdragSwallowUntil = Date.now() + 400;
    markPartyClear();
    if (G.state !== "board" || uiBlocked()) return;
    const i = G.party.indexOf(p);
    if (i < 0) return;
    if (moved && j >= 0 && j !== i && G.party[j]) { swapPartyOrder(i, j); return; }
    if (!moved) uiDungeonHud.peekDoll(p, { idx: i, combat: false });
  };
  window.addEventListener("pointermove", move, true);
  window.addEventListener("pointerup", end, true);
  window.addEventListener("pointercancel", end, true);
}
function markPartyClear() {
  for (const c of partyEl.children) c.classList.remove("lifting", "drop-over");
}
function swapPartyOrder(i, j) {
  const a = G.party[i], b = G.party[j];
  G.party[i] = b; G.party[j] = a;
  SFX.select(); buzz(10);
  const rowName = (k) => (k < 3 ? "前衛" : "後衛");
  log(`隊列: ${a.name}(${rowName(j)}) ⇄ ${b.name}(${rowName(i)})`, "sys");
  _partyKey = "";
  renderParty();
  autosave(true);
}

// 隊カードの肖像。札の額は 24×24 ドットの胸像を ~42px で見せる寸法 (PORTRAIT_PX)。
// 人業ごとに描いた canvas を使い回す (職業/ランクが変わった時だけ描き直す)。
// ※ 肖像の絵はここ一か所で差し替えられる (いまは職業の全身像 dollSprite を額に収めている)
const PORTRAIT_PX = 40;
const _partyPics = new WeakMap();
function partyPortrait(p) {
  if (!p || !p.isDoll || p.primary == null) return null;
  const key = dollLookKey(p);
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
const BUFF_STAT_LABEL = { atk: "STR", vit: "VIT", agi: "AGI", pie: "PIE", ...BUFF_NAME };
function buffBadges(p) {
  if (G.state !== "combat") return "";
  // 戦闘中は札が無くても空の行を置く (戦場の高さは戦闘の始めに決まるので、強化・弱体が付いて札が伸びると記録欄が潰れる)
  if (!p.alive) return `<div class="buffs"></div>`;
  const blood = chishioState(p);
  const effs = shownEffects(p);
  if (!blood && (!effs || !effs.length)) return `<div class="buffs"></div>`;
  // (能力, 方向) ごとに集約: 段数 (STR〜PIE は −3〜+3 の段) と最短残ターンを出す
  let html = "";
  // たぎる血潮 (修羅): いまの段を「血▲▲3」で。数字は段数 (残りターンではない)
  if (blood) html += `<span class="bf up blood" title="たぎる血潮 ${blood.stacks}段・同じ敵への物理+${Math.round(blood.bonus * 100)}%${blood.max ? " (最大)" : ""}・別の敵に当てると0段">血${"▲".repeat(Math.min(3, blood.stacks))}<b>${blood.stacks}</b></span>`;
  for (const g of buffGroups(effs)) {
    const arrow = (g.up ? "▲" : "▼").repeat(Math.min(3, g.stages));
    const left = isBattleLong(g.turns) ? "戦闘の終わりまで" : `残り${g.turns}T`;
    const title = STAGED.has(g.stat) ? `${BUFF_STAT_LABEL[g.stat] || g.stat} ${stageLabel(g.up ? g.stages : -g.stages)}・${left}`
      : `${BUFF_STAT_LABEL[g.stat] || g.stat} ${g.up ? "強化" : "弱体"}・${left}`;
    // 残りターンは札に出さない (札を長押しした「人業の様子」で確かめる — 2026-10 ユーザーの指示)
    html += `<span class="bf ${g.up ? "up" : "dn"}" title="${title}">${BUFF_STAT_ICON[g.stat] || "◆"}${arrow}</span>`;
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
if (returnBtn) returnBtn.addEventListener("click", function tap() {
  if (holdForAutoMove(tap)) return;
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
  { key: "shop", name: "黒鉄商会", desc: "装備と道具の売買・鑑定" },
  { key: "inn", name: "宿屋「白狼」", desc: "傷を癒し、魂を休める" },
  { key: "palace", name: "王宮", desc: "勅命・書庫・宝物庫" },
  { key: "shrine", name: "赤い魂の祠", desc: "赤い魂を授かる" },
];

// 街の絵 (夜景・施設の情景) はアイドル時間に下ごしらえしておく (タイトル画面の間に描き溜め、初回の引っかかりを消す)
try { prewarmTown(FACILITIES.map((f) => f.key)); } catch (e) { /* 演出のみ */ }
try { prewarmStoryArt(); } catch (e) { /* 演出のみ */ }

// 施設の番人 (keeper) のひとこと。lines は帰還のたびに巡る (酒場・祠・宿・王宮の胸像のささやき、商会の番人の一言)
const FAC_SHELL = {
  tavern: { keeper: "barkeep", who: "酒場の主 グラム", lines: [
    "灯が消えぬうちは、ここは安全だ。…たぶんな。",
    "飲め。迷宮帰りの喉は、血の味しか覚えておらん。",
    "情報屋の噂に金貨はいらん。迷宮から戻ったら、また聞いていけ。"] },
  shop: { keeper: "merchant", who: "黒鉄商会 ヴォス", lines: [
    "黒鉄は嘘をつかん。値札もな。",
    "死人の剣でも、研げば生者の役に立つ。",
    "未鑑定の品か。正体を知るのは、金を払ってからだ。"] },
  inn: { keeper: "innkeeper", who: "宿の女主 イルザ", lines: [
    "眠りな。夢の底までは、迷宮も追ってこない。",
    "白狼の毛皮は温かいだろう。…あれを狩ったのは、あたしさ。",
    "扉のかんぬきは三重。それでも夜中に爪の音がしたら、起こしな。"] },
  // 本丸の主の記憶 (w09) の報告から宰相は玉座の間に姿を見せない (REPORTS.w09/w10「宰相の席は、今日も空いていた」)。
  // 大樹の報告 (w13) で一度だけ現れるが、王に退けられて闇へ消える — 札も出さない
  palace: { keeper: "minister", who: "宰相 モルデン", absent: () => !!worldState().reported.w09, lines: [
    "陛下は玉座でお待ちだ。…あまり長くは、お待ちになれぬ。",
    "勅命は果たされねばならぬ。たとえ、器が幾つ砕けようとも。"] },
  shrine: { keeper: "maiden", who: "祠守の巫女", lines: [
    "赤い魂は脈打つ。誰の心臓だったかは、問うてはならぬ。",
    "祈りなさい。この祠は、祈りの代わりに血を受け取ります。"] },
};

// 編成 + 控えの全人業
function allDolls() { shareInventory(G); return [...G.party, ...G.reserve]; }
setBagSource(() => G.inventory);

// 街を描き直す (名前と約225の呼び出し元はそのまま)。中身の描き替え・スクロール位置の保持・
// タブバーの点灯・遷移の演出は街シェル (townshell.refresh) が受け持つ
function renderTown() {
  // 迷宮の中 (無限迷宮の風だまりで魂を鍛えた・品を売った時など) は街を描かず、見出しと隊の札だけ描き直す
  if (inDungeon()) { updateTopbar(); renderParty(); autosave(); return; }
  const then = G.town && G.town.facility ? takeLegacyEntry() : null; // 旧来の入口は新しいタブ/ページへ付け替えてから描く
  renderRunbar(); // 街では隠す
  refreshOrderBonus(); // 編成・魂の付け替えで結社の席が変わっていれば、全員の能力を付け直す
  for (const d of fixHandsAndShields()) recalcDoll(d); // 二刀流を失った (サブ魂を外した・融合した) 人業の左手の武器は袋へ
  refreshEquipLevels(); // メイン魂の Lv が装備できるLv に届かない装備は袋へ
  autosave(); // 街での操作のたびに保存 (描画はアクション後に呼ばれる)
  updateTopbar();
  playBgm(sceneBgm()); // 施設ごとのBGM (同じ曲なら継続)
  townshell.refresh();
  if (UI.refreshPartySheet) UI.refreshPartySheet(); // 街の上に開いた人業のシート (顔アイコンから) も描き直す
  if (UI.refreshRunReport) UI.refreshRunReport(); // 開いている帰還の報告のシートも (鑑定・売却の後に用事のボタンが古いまま残らないよう)
  if (UI.queueStoryNotice) UI.queueStoryNotice(); // 新しく記された物語を、手の空いた時に知らせる
  syncStoryMedia(); // 進んだ章の物語の絵を、端末へ裏で集めてもらう
  if (UI.queueAfxConflicts && G.shopAfxPending && G.shopAfxPending.length) UI.queueAfxConflicts(); // 商会の棚で追加の組がぶつかった品を、手の空いた時にまとめて選ぶ
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
  abyss: { tab: "hub", then: () => openAbyssSetup() }, // 無限迷宮の入口は出撃シートの1ページ
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
  const tut = G.msq && G.msq.n === 0;
  if (tut) return G.msq.granted ? ["palace", "mansion"] : ["palace"];
  return featureUnlocked("tavern") ? null : FACILITIES.map((f) => f.key).filter((key) => key !== "tavern");
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

// 魂の安定度: 人業に保存する。旧セーブは満タンから開始する。
// 無限迷宮でも元の人業の安定度を使う。名のない器の分も保存して再入場で戻さない。
function infiniteStabilityDolls() {
  const home = G.abyss?.home;
  const dolls = home ? [...home.party, ...home.reserve] : allDolls();
  const names = home ? G.party.map(d => ({name:d.name, from:d.homeUid})) : infVesselNames();
  const slots = infStats().stability || (infStats().stability = []);
  return names.map((who, i) => dolls.find(d => d.uid === who.from) ||
    (slots[i] || (slots[i] = {uid:`inf-${i}`, name:who.name, alive:true})));
}
function stabilityDolls(infinite = abyssActive()) {
  return infinite ? infiniteStabilityDolls().filter((d,i) => !abyssActive() || G.party[i].alive) : G.party.filter(d=>d.alive);
}
function refreshStability(now = Date.now()) {
  const home = G.abyss?.home;
  const dolls = new Set([...allDolls(), ...(home ? [...home.party, ...home.reserve] : []), ...(G.stats.inf?.stability || []).filter(Boolean)]);
  const changes = [];
  for (const doll of dolls) {
    if (doll.vessel === "inf") continue;
    const amount = recoverStability(doll, now);
    if (amount) changes.push({ doll, amount });
  }
  if (abyssActive()) infiniteStabilityDolls().forEach((d,i) => {
    recoverStability(d, now);
    G.party[i].stability = d.stability; G.party[i].stabilityAt = d.stabilityAt;
  });
  tlStability("natural", changes, { state:G.state, partyUids:G.party.map(d=>d.uid) });
  if (changes.length) autosave(true);
  return changes;
}
function stabilityApplies(cfg = curDungeon()) { return abyssActive() || !cfg?.stabilityFree; }
function stabilityStatus(infinite = abyssActive()) {
  const dolls = stabilityDolls(infinite), now = Date.now();
  refreshStability(now);
  return dolls.map(d=>{ recoverStability(d, now); return { uid:d.uid, name:d.name, value:d.stability,
    after:Math.max(0,d.stability-STABILITY_ENTRY_COST), waitMs:stabilityWaitMs(d, now) }; });
}
function stabilityReady(retry, infinite = abyssActive()) {
  const low = stabilityStatus(infinite).filter(d=>d.value < STABILITY_ENTRY_COST);
  if (!low.length) return true;
  if (!retry) return false;
  const cost = low.reduce((n,d)=>n+STABILITY_ENTRY_COST-d.value,0);
  const options = [];
  if (G.redSoul >= cost) options.push({label:`赤い魂${cost}で不足分を購入して進む`, primary:true, fn:()=>{
    // 確認中の自然回復を差し引き、隊全員の不足分だけを一度に買う。
    const dolls = stabilityDolls(infinite);
    refreshStability();
    const changes = dolls.map(doll=>({doll,amount:Math.max(0,STABILITY_ENTRY_COST-doll.stability)})).filter(c=>c.amount);
    const pay = changes.reduce((n,c)=>n+c.amount,0);
    if (G.redSoul < pay) { stabilityReady(retry, infinite); return; }
    G.redSoul -= pay;
    for (const c of changes) c.doll.stability += c.amount;
    tlStability("red", changes, {redSpent:pay});
    autosave(true); retry();
  }});
  options.push({label:"回復を待つ", fn:()=>{ autosave(true); }});
  showChoice("魂の安定度が足りない", options, null, {banner:"魂の安定度", onDismiss:()=>{},
    lines:[...low.map(d=>`${d.name}: ${d.value}/30`), `不足分は合計${cost}。赤い魂1で安定度1を購入できます (所持${G.redSoul})。`,
      `4分で1回復します。全員が進めるまで約${Math.ceil(Math.max(...low.map(d=>d.waitMs))/60000)}分。回復後にもう一度進んでください。`]});
  return false;
}
function consumeEntryStability(where, kind = "entry", infinite = abyssActive()) {
  if (!infinite && worldById(where)?.stabilityFree) return true;
  const dolls = stabilityDolls(infinite);
  if (!dolls.length || !stabilityReady(null, infinite)) return false;
  const changes = dolls.map(doll => { doll.stability -= STABILITY_ENTRY_COST; return {doll,amount:STABILITY_ENTRY_COST}; });
  tlStability(kind, changes, { dungeon:where });
  refreshStability();
  return true;
}
// requested = 回復させたい安定度。赤い魂1つで stabilityPerRed() 回復する (端数は切り上げて払う)
function restoreStability(d, requested = 1) {
  if (G.state !== "town" || !allDolls().includes(d)) return {ok:false};
  refreshStability();
  const per = stabilityPerRed();
  const n = Math.min(STABILITY_MAX-d.stability, Math.max(0,Math.floor(requested)), Math.max(0,Math.floor(G.redSoul)) * per);
  if (!Number.isFinite(n) || n <= 0) return {ok:false};
  const cost = Math.ceil(n / per);
  d.stability += n; G.redSoul -= cost;
  if (d.stability === STABILITY_MAX) d.stabilityAt = Date.now();
  tlStability("red", [{doll:d,amount:n}], {redSpent:cost});
  SFX.heal(); autosave(true); renderTown();
  return {ok:true,n,cost};
}
function stabilityCost(n) { return Math.ceil(Math.max(0, n) / stabilityPerRed()); }
function grantRedSoul(n, source) {
  G.redSoul += n || 0; tlRedGain(n || 0, source);
}

// 人業を仕立てる費用 (最初の3体は無料、4体目以降に段階上昇)
function emptyDollCost() {
  if (prologueActive() && prologueDollGoal()) return 0;
  const n = G.dollsPurchased;
  return n < 3 ? 0 : n === 3 ? 30 : n === 4 ? 50 : 100;
}

// 所持魂の並び順: 職業順 → プラス値降順 → Lv降順
function soulSortCmp(a, b) {
  const ja = SOUL_CLASS_ORDER[a.clsKey] ?? 99, jb = SOUL_CLASS_ORDER[b.clsKey] ?? 99;
  if (ja !== jb) return ja - jb;
  const pa = Math.max(0, (a.count || 1) - 1), pb = Math.max(0, (b.count || 1) - 1);
  if (pa !== pb) return pb - pa;
  if ((b.level || 1) !== (a.level || 1)) return (b.level || 1) - (a.level || 1);
  return a.uid - b.uid;
}

// 一覧と融合先は職業ごとに1つ。既存セーブは宿している魂を優先し、育成値を失わない。
function soulRepresentatives() {
  const sorted = [...G.souls].sort((a, b) => Number(soulWorn(b.uid)) - Number(soulWorn(a.uid))
    || (b.count || 1) - (a.count || 1) || (b.level || 1) - (a.level || 1)
    || (b.capBonus || 0) - (a.capBonus || 0) || a.uid - b.uid);
  const seen = new Set();
  // セラの灯守 (固有の職) は代表にしない: 人業の仕立て・メイン魂の付け替え・融合・控えの結社の対象から外れる
  return sorted.filter((s) => { if (isUniqueJob(s.clsKey) || seen.has(s.clsKey)) return false; seen.add(s.clsKey); return true; });
}
// メイン魂の職業だけは隊に1つ。別個のサブ魂は同職でも宿せる。
function partySoulConflict(party = G.party) {
  const seen = new Set();
  for (const d of party) {
    const s = soulByUid(d.primary); if (!s) continue;
    if (seen.has(s.clsKey)) return s.clsKey;
    seen.add(s.clsKey);
  }
  return null;
}
// サブ魂の職業は仲間と重複できる。同じ人業のメイン・サブには同職を重ねない。
function soulSlotConflict(d, uid, slotId = "primary") {
  const soul = soulByUid(uid); if (!soul) return false;
  // セラ: メイン魂は灯守に固定。灯守の魂はセラのメイン魂にしか宿らない (サブ魂として貸さない)
  if (seraSlotBlocked(d, soul, slotId)) return true;
  // 同じ人業の別の差し口にある魂 = 入れ替え (メイン⇄サブ・サブ⇄サブ、ユーザーの指示 2026-10)。
  // 人業の中の職業の組は変わらないので、隊のメイン魂の重複だけを見る
  const from = ownSoulSlot(d, uid);
  if (from && from !== slotId) {
    const cur = slotSoul(d, slotId);
    if (from === "primary") {
      if (!cur) return true; // メイン魂を空のサブ魂の枠へは移せない (メイン魂が空になる)
      if (seraSlotBlocked(d, cur, "primary") || !soulRepresentatives().some((x) => x.uid === cur.uid)) return true;
      return partyMainClash(d, cur);
    }
    return slotId === "primary" ? partyMainClash(d, soul) : false;
  }
  if (soulByUid(d.primary)?.clsKey === soul.clsKey && slotId !== "primary") return true;
  if ((d.subs || []).some((x, i) => `sub${i}` !== slotId && soulByUid(x?.uid)?.clsKey === soul.clsKey)) return true;
  if (slotId !== "primary") return false;
  return partyMainClash(d, soul);
}
// d のメイン魂を soul にしたとき、隊の仲間のメイン魂と職業が重なるか
function partyMainClash(d, soul) {
  const dolls = G.party.includes(d) ? G.party : [d];
  // 他の人業から移してくる魂 (dd.primary === uid) は、移したあと dd に残らないので数えない
  return dolls.some((dd) => dd !== d && dd.primary !== soul.uid && soulByUid(dd.primary)?.clsKey === soul.clsKey);
}
// 魂 uid が d のどの差し口にあるか ("primary" / "subN" / null)
function ownSoulSlot(d, uid) {
  if (!d || uid == null) return null;
  if (d.primary === uid) return "primary";
  const i = (d.subs || []).findIndex((x) => x && x.uid === uid);
  return i >= 0 ? "sub" + i : null;
}
// 魂 uid を d (または写し) の slotId へ置く。同じ人業の別の差し口にあって、行き先に魂があれば入れ替える
// (実際の付け替え applyEquipSoul と、画面の見比べ soulpanel.js placeSoul で共通)
function placeSoulInDoll(f, slotId, uid) {
  const subs = [...(f.subs || [])];
  const from = ownSoulSlot(f, uid);
  const ti = slotId === "primary" ? -1 : +slotId.slice(3);
  const curUid = ti < 0 ? f.primary : (subs[ti] || {}).uid;
  if (from && from !== slotId && curUid != null) {
    if (from === "primary") { f.primary = curUid; subs[ti] = { uid, picks: [] }; }
    else {
      const fi = +from.slice(3);
      if (ti < 0) { f.primary = uid; subs[fi] = { uid: curUid, picks: [] }; }
      else { const x = subs[fi]; subs[fi] = subs[ti]; subs[ti] = x; } // サブ⇄サブは借りた技ごと入れ替える
    }
    f.subs = subs.filter(Boolean);
    return;
  }
  // 同じ人業の他の差し口からは外す (二重に宿さない)
  if (f.primary === uid) f.primary = null;
  const keep = subs.filter((x) => x && x.uid !== uid);
  if (ti < 0) f.primary = uid;
  else keep[ti] = { uid, picks: [] }; // 借用は recalcDoll が既定 (覚えている最後の技) で埋める
  f.subs = keep.filter(Boolean);
}
function blockSoulResonance(party = G.party) {
  const clsKey = partySoulConflict(party);
  if (!clsKey) return false;
  SFX.ng();
  showToast(`${SOUL_CLASSES[clsKey].label}の魂はすでに宿している。メイン魂の同じ職業は隊に1つだけ`, { tone: "bad" });
  return true;
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
function randomDollName() { return DOLL_NAMES[Math.floor(random() * DOLL_NAMES.length)]; }

// 魂と名前が決まったら、赤い魂を支払って人業を生成し、編成に加える。生まれた人業を返す
function finalizeBuyDoll(uid, name) {
  if (prologueActive() && !prologueCreateSouls().some(s => s.uid === uid)) return null;
  const cost = emptyDollCost();
  const s = soulByUid(uid);
  if (G.redSoul < cost) { log("赤い魂が足りない。", "sys"); SFX.ng(); showToast("赤い魂が足りない", { tone: "bad" }); return null; }
  if (!s || !soulRepresentatives().some((x) => x.uid === uid) || soulWorn(s.uid)) { log("その魂は宿せない。", "sys"); SFX.ng(); return null; }
  G.redSoul -= cost;
  G.dollsPurchased++;
  const d = makeDoll(name);
  d.primary = uid; // 選んだ魂をメイン魂として宿す
  recalcDoll(d);
  d.hp = d.maxhp; d.mp = d.maxmp;
  // 仕立てたばかりの人業はそのまま編成に加わる (満員なら控えへ)
  if (G.party.length < 6 && !partySoulConflict([...G.party, d])) G.party.push(d);
  else { G.reserve.push(d); log(`${d.name} は控えで待機する。`, "sys"); }
  SFX.itemget(); buzz([0, 30, 60, 30]);
  log(`人業「${d.name}」が生まれた！（${SOUL_CLASSES[s.clsKey].label}・🔴${cost}）`, "win");
  showToast(`人業「${d.name}」が目覚めた`, { tone: "good" });
  if (UI.tutorialEvent) UI.tutorialEvent("dollCreated");
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

// メイン魂を soul (魂の実体) に付け替えると装備できなくなる装備を列挙する ({key, item} の配列)。
// 職で扱えない品と、新しいメイン魂の Lv では装備できるLv に届かない品
function unequippableUnder(d, soul) {
  const bad = [];
  if (!soul || !soul.clsKey || !d.equip) return bad;
  const probe = { clsKey: soul.clsKey, jobLv: soul.level || 1 }; // canEquip は clsKey/align/jobLv のみ参照 (人業に align は無い)
  for (const slot of SLOTS) {
    const it = d.equip[slot];
    if (it && !canEquip(probe, it)) bad.push({ key: slot, item: it });
  }
  return bad;
}

// 魂の付け替えの前後で HP/MP の割合を保つ (満タンなら満タンのまま・付け替えを往復しても減らない)。
// 倒れている人業はそのまま
function hpMpRatio(d) {
  return { hp: d.maxhp > 0 ? d.hp / d.maxhp : 1, mp: d.maxmp > 0 ? d.mp / d.maxmp : 1 };
}
function keepHpMpRatio(d, r) {
  if (d.alive === false || d.hp <= 0) { d.hp = Math.min(Math.max(0, d.hp), d.maxhp); d.mp = Math.min(d.mp, d.maxmp); return; }
  d.hp = Math.max(1, Math.min(d.maxhp, Math.round(d.maxhp * r.hp)));
  d.mp = Math.max(0, Math.min(d.maxmp, Math.round(d.maxmp * r.mp)));
}

// 実際に魂を差し口へ宿す/外す処理 (装備の事前確認を通過した後に呼ぶ)
function applyEquipSoul(d, uid, s, slotId = "primary") {
  const before = jobSig(d);
  const vit = hpMpRatio(d);
  d.subs = d.subs || [];
  const si = slotId === "primary" ? -1 : +slotId.slice(3);
  if (slotId === "primary" && d.primary === uid) {
    d.primary = null; // 同じ魂をもう一度選ぶと外す
  } else if (si >= 0 && (d.subs[si] || {}).uid === uid) {
    d.subs.splice(si, 1);
    d.subs = d.subs.filter(Boolean);
  } else {
    placeSoulInDoll(d, slotId, uid); // 同じ人業の別の差し口にあれば入れ替え
  }
  recalcDoll(d);
  keepHpMpRatio(d, vit);
  SFX.select(); buzz(15);
  autosave(true);
  renderTown();
  announceJobChange(d, before);
}

// 差し口に魂を宿す/外す。同じ魂インスタンスは複数の人業に宿せない。
// done(applied) … 実際に宿した/外した (確認で取りやめなら false)
function equipSoulToSlot(d, uid, slotId = "primary", done = null) {
  const fin = (v) => { if (typeof done === "function") done(v); return v; };
  const s = soulByUid(uid);
  if (!s || G.state !== "town") return fin(false);
  const si = slotId === "primary" ? -1 : +slotId.slice(3);
  if (si < 0 && !featureUnlocked("soulChange")) return fin(false);
  if (si >= 0 && (!Number.isInteger(si) || si < 0 || si >= unlockedSubSlots())) return fin(false);
  // 別の差し口へ宿す (=付け替え) 場合のみ装備可否を判定する。外す操作は対象外
  const isNewEquip = !(slotId === "primary" && d.primary === uid) && !(si >= 0 && ((d.subs || [])[si] || {}).uid === uid);
  if (d && d.vessel === "sera" && si < 0) { SFX.ng(); showToast("セラのメイン魂は灯守のまま。サブ魂は自由に付け替えられる", { tone: "info" }); return fin(false); }
  if (isUniqueJob(s.clsKey)) { SFX.ng(); showToast("灯守の魂は、セラにしか宿らない", { tone: "bad" }); return fin(false); }
  if (isNewEquip && si < 0 && !soulRepresentatives().some((x) => x.uid === uid)) { SFX.ng(); showToast("同じ職業の余った魂は、人業の館で魂融合する", { tone: "bad" }); return fin(false); }
  if (isNewEquip && soulSlotConflict(d, uid, slotId)) { SFX.ng(); showToast("メイン魂の職業は隊で重複不可。同じ人業のメイン・サブにも同じ職業は宿せない", { tone: "bad" }); return fin(false); }
  // 同じuidの魂は、メイン・サブを問わず他の人業と共有しない。他の人業が宿している魂を選んだら、その人業から移す
  //   (ユーザーの指示、2026-10。画面側で「〜が宿している」と確認してから呼ぶ)。入れ替えられれば、こちらが外した魂をその人業へ渡す
  const take = isNewEquip ? soulTakePlan(d, uid, slotId) : null;

  // メイン魂の付け替えで、新しい職では装備できなくなる装備があれば事前に確認する
  // (メイン魂をサブ魂の枠と入れ替える時は、その枠の魂が新しいメイン魂)
  const newMain = slotId === "primary" ? s : ownSoulSlot(d, uid) === "primary" ? slotSoul(d, slotId) : null;
  if (isNewEquip && newMain && d.primary !== newMain.uid) {
    const bad = unequippableUnder(d, newMain);
    if (bad.length) {
      const free = MAX_ITEMS - d.items.length;
      const names = bad.map((b) => {
        const need = equipLevelOf(b.item);
        return `・${b.item.name}（${SLOT_LABEL[b.key] || b.key}${(newMain.level || 1) < need ? `・Lv${need}から` : ""}）`;
      });
      if (bad.length > free) {
        // 外した装備を持ち物に入れる空きが足りない → 付け替えを中止
        SFX.ng();
        showEvent({
          sprite: jobSprite(newMain.clsKey, Math.max(1, soulRankOf(newMain))),
          banner: "付け替えできない", title: "持ち物がいっぱい",
          lines: [`${soulLabel(newMain)} に付け替えると、次の装備が外れる。`, ...names,
            `しかし ${d.name} の持ち物に空きが ${free} 枠しかない。持ち物を減らしてから、もう一度。`],
          accent: "#d4504e", btnLabel: "とじる", noLog: true,
        });
        return fin(false);
      }
      kitConfirm({
        banner: "付け替え", title: `${soulLabel(newMain)} に付け替える？`,
        lines: ["新しい職・メイン魂の Lv では次の装備を扱えないため、外して持ち物に戻す。", ...names],
        okLabel: "付け替える", danger: false,
      }).then((ok) => {
        if (!ok) return fin(false);
        for (const b of bad) { d.equip[b.key] = null; d.items.push(b.item); }
        equipWithTake(d, uid, s, slotId, take);
        fin(true);
      });
      return false;
    }
  }
  equipWithTake(d, uid, s, slotId, take);
  return fin(true);
}
// 他の人業 (holder) が宿している魂を d の slotId へ移す計画。
//   返り値: null (誰も宿していない) / { holder, from: 差し口, give: 入れ替えで holder へ渡す魂 (渡せなければ null) }
function soulTakePlan(d, uid, slotId = "primary") {
  let holder = null, from = null;
  for (const dd of allDolls()) {
    if (dd === d) continue;
    if (dd.primary === uid) { holder = dd; from = "primary"; break; }
    const i = (dd.subs || []).findIndex((x) => x && x.uid === uid);
    if (i >= 0) { holder = dd; from = "sub" + i; break; }
  }
  if (!holder) return null;
  const curUid = slotId === "primary" ? d.primary : ((d.subs || [])[+slotId.slice(3)] || {}).uid;
  let give = null;
  if (curUid != null && curUid !== uid) {
    // 移したあとの姿で、外れる魂を holder の空いた差し口に宿せるか確かめる (確かめたら元に戻す)
    const keep = [d.primary, d.subs, holder.primary, holder.subs];
    try {
      takeOff(holder, uid);
      if (slotId === "primary") d.primary = uid;
      else { const subs = [...(d.subs || [])]; subs[+slotId.slice(3)] = { uid, picks: [] }; d.subs = subs; }
      const c = soulByUid(curUid);
      const ok = c && !soulSlotConflict(holder, curUid, from) && !soulWornByOther(curUid, holder)
        && (from !== "primary" || (soulRepresentatives().some((x) => x.uid === curUid) && !unequippableUnder(holder, c).length));
      if (ok) give = c;
    } finally {
      [d.primary, d.subs, holder.primary, holder.subs] = keep;
    }
  }
  return { holder, from, give };
}
// 人業から魂 uid を外す (メイン・サブとも)
function takeOff(dd, uid) {
  if (dd.primary === uid) dd.primary = null;
  dd.subs = (dd.subs || []).filter((x) => x && x.uid !== uid);
}
function equipWithTake(d, uid, s, slotId, take) {
  if (!take) { applyEquipSoul(d, uid, s, slotId); return; }
  const { holder, from, give } = take;
  const vit = hpMpRatio(holder);
  takeOff(holder, uid);
  applyEquipSoul(d, uid, s, slotId);
  if (give) {
    if (from === "primary") holder.primary = give.uid;
    else { holder.subs = holder.subs || []; holder.subs.splice(Math.min(+from.slice(3), holder.subs.length), 0, { uid: give.uid, picks: [] }); }
  }
  recalcDoll(holder);
  keepHpMpRatio(holder, vit);
  autosave(true);
  renderTown();
}

// サブ魂が借りる技/パッシブを選ぶ (src/ui/soulpanel.js のシート)
function openSubSkillPicker(d, subRef) { return uiSoulPanel.openSkillStep(d, subRef); }

// 魂融合: target に同職の余っている魂を融合させる候補。
// 融合先はどの魂でもよい (職業の代表に限らない — 2026-10 ユーザーの指示: 宿していない +10 へ、宿している +5 を融合したい)
function fuseTarget(targetUid) {
  const t = soulByUid(targetUid);
  return t && !isUniqueJob(t.clsKey) ? t : null;
}
function fuseCandidates(targetUid) {
  const t = fuseTarget(targetUid); if (!t) return [];
  return G.souls.filter((s) => s.uid !== t.uid && s.clsKey === t.clsKey && !soulWorn(s.uid) && !s.locked);
}
// サブ魂として宿している魂は、その人業から外して素材にできる (個別の融合だけ。まとめて融合には入れない)。
// メイン魂として宿している魂は外せない
function fuseSubTakeable(uid) {
  let sub = false;
  for (const d of allDolls()) {
    if (d.primary === uid) return false;
    if ((d.subs || []).some((x) => x && x.uid === uid)) sub = true;
  }
  return sub;
}
function fuseSubWorn(targetUid) {
  const t = fuseTarget(targetUid); if (!t) return [];
  return G.souls.filter((s) => s.uid !== t.uid && s.clsKey === t.clsKey && !s.locked && fuseSubTakeable(s.uid));
}
// 魂のロック: ロックした魂は魂融合の素材にできない (宿す・融合先にするのは自由)。魂融合した魂 (融合先) は自動でロックする
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
// onResultClose: 結果の札 (またはランクアップの祝祭) を閉じたときに呼ぶ (融合画面で続けて選ぶため)
function fuseSoul(targetUid, consumeUid, onResultClose = null, opts = {}) {
  return fuseSouls(targetUid, [consumeUid], onResultClose, opts);
}
// 一括融合: 全素材を検証してから合算し、結果は一度だけ表示する。
// opts.takeSub: サブ魂として宿している素材を、その人業から外して融合してよい (個別の融合で確かめた後)
function fuseSouls(targetUid, consumeUids, onResultClose = null, opts = {}) {
  const t = fuseTarget(targetUid);
  if (!Array.isArray(consumeUids) || !consumeUids.length || new Set(consumeUids).size !== consumeUids.length) { SFX.ng(); return null; }
  const materials = consumeUids.map((uid) => soulByUid(uid));
  const wornBlock = (c) => soulWorn(c.uid) && !(opts.takeSub && fuseSubTakeable(c.uid));
  if (G.state !== "town" || !featureUnlocked("fusion") || !t || materials.some((c) => !c || c.uid === targetUid || c.clsKey !== t.clsKey || wornBlock(c) || c.locked)) { SFX.ng(); return null; }
  const before = soulRankOf(t);
  const beforeLv = t.level;
  // 融合の前後で見比べる: 宿している人業がいればその能力 (メイン魂を優先)、いなければ魂そのものの能力
  const wearer = allDolls().find((d) => d.primary === t.uid) || allDolls().find((d) => (d.subs || []).some((x) => x && x.uid === t.uid)) || null;
  const statsNow = () => (wearer
    ? { hp: wearer.maxhp, mp: wearer.maxmp, atk: wearer.atk, vit: wearer.vit, agi: wearer.agi, int: wearer.int, pie: wearer.pie, luk: wearer.luk }
    : jobStatsOf(t.clsKey, t));
  const snap = () => ({ cap: soulLevelCapOf(t), count: t.count, stats: statsNow(), skills: soulLearnedSkills(t), passives: soulLearnedPassives(t), picks: subPickCap(t) });
  const was = snap();
  // 双方に蓄積していた総 Soul を合算する。新しい上限まではレベルに、超過分は exp に保持する。
  const total = materials.reduce((sum, c) => sum + soulTotalExp(c.level, c.exp), soulTotalExp(t.level, t.exp));
  t.count += materials.reduce((sum, c) => sum + c.count, 0);
  t.capBonus = materials.reduce((sum, c) => sum + (c.capBonus || 0), t.capBonus || 0);
  const newCap = soulLevelCapOf(t);
  const le = levelExpFromTotal(total, newCap);
  t.level = le.level; t.exp = le.exp;
  // 融合先は自動でロックする (育てた魂を、うっかり別の融合の素材にしないように。ロックは魂の一覧で外せる)
  t.locked = true; t.fuseLk = true;
  for (const c of materials) {
    const idx = G.souls.indexOf(c);
    if (idx >= 0) G.souls.splice(idx, 1);
    unequipSoulEverywhere(c.uid);
  }
  G.stats.fusions += materials.length; // 戦績: 魂の融合回数 (勲章用)
  recalcAllDolls({ levelUp: t.level > beforeLv });
  codexJobSee(t.clsKey, t.count, t.level, t.capBonus);
  const after = soulRankOf(t);
  const now = snap();
  // 融合の結果 (UI に渡す): 能力・Lv上限・魂数・新たに覚えた技/パッシブ・宿し技の枠
  const result = {
    clsKey: t.clsKey, fromRank: before, toRank: after, fromLv: beforeLv, toLv: t.level,
    fromCap: was.cap, toCap: now.cap, fromCount: was.count, toCount: now.count,
    statsFrom: was.stats, statsTo: now.stats, statsOf: wearer ? (wearer.primary === t.uid ? wearer.name : `${wearer.name} (サブ魂)`) : null,
    newSkills: now.skills.filter((k) => !was.skills.includes(k)),
    newPassives: Object.keys(now.passives).filter((k) => (now.passives[k] || 0) > (was.passives[k] || 0)).map((k) => ({ key: k, lv: now.passives[k] })),
    fromPicks: was.picks, toPicks: now.picks,
  };
  log(`魂融合で ${soulLabel(t)} になった。素材にならないようロックした。`, "win");
  if (t.level > beforeLv) log(`蓄積した ✦Soul が反映され、Lv${beforeLv} → Lv${t.level} に上昇した！`, "win");
  autosave(true);
  renderTown();
  // ランクが上がったときは、ファンファーレと昇格の祝祭カード (新しい称号・能力・Lv上限・覚えた技)
  if (after > before) {
    log(`⤴ ${jobRankName(t.clsKey, after)} に昇格！`, "win");
    showRankUp(result, onResultClose);
    return { rankUp: true, from: before, to: after };
  }
  // ランク据え置きの融合: 変わった能力・Lv上限などを結果の札で
  SFX.itemget(); buzz([0, 30, 50, 30]);
  result.statUp = Math.round((SOUL_STAT_UP[SOUL_CLASSES[t.clsKey].rarity] || 0.01) * 100 * (now.count - was.count));
  uiSoulPanel.showFuseResult(result, onResultClose);
  return { rankUp: false };
}

// 魂を1レベル上げるのに要する Soul (レベルが高いほど高い)
// 次レベルへ必要な ✦Soul (Lv → Lv+1) は levelcurve.js trainCost: 推奨Lv の迷宮の1戦の ✦Soul × 1Lv の目標分数ぶん
// (Lv1≈27 / Lv10≈181 / Lv30≈2164 / Lv50≈9729 / Lv100≈29714)。2026-10 までは 40 × 1.13^(Lv−1) で、Lv150 から先は事実上届かなかった
function soulTrainCost(level) { return trainCost(level || 1); }

// 魂に蓄積している総 Soul = 現レベルまでに消費した分 + 次レベルへの途中分(exp)。
// 融合時の合算や、上限突破後の一括レベルアップ計算に使う。
function soulTotalExp(level, exp) {
  let total = exp || 0;
  for (let i = 1; i < (level || 1); i++) total += soulTrainCost(i);
  return total;
}
// 総 Soul と Lv上限から、到達レベルと端数 exp を求める。
// 上限に達しても余剰 Soul は exp として保持し、融合・残火で上限が伸びたら一気に反映される。
function levelExpFromTotal(total, cap) {
  let level = 1, rem = Math.max(0, total);
  while (level < cap && rem >= soulTrainCost(level)) { rem -= soulTrainCost(level); level++; }
  return { level, exp: rem };
}
// 蓄積した exp を、いまの Lv上限まで Lv に注ぐ (戦闘の経験値・残火・セラのランク・読み込み時で共通)。
// 上限に届いた魂が戦闘で得た経験値は捨てずに exp に残り、上限が伸びたらここで反映される。上がった段数を返す
function settleSoulExp(e) {
  if (!e) return 0;
  const cap = soulLevelCapOf(e);
  let n = 0;
  e.exp = Math.max(0, e.exp || 0);
  while (e.level < cap && e.exp >= soulTrainCost(e.level)) { e.exp -= soulTrainCost(e.level); e.level++; n++; }
  return n;
}

// 魂インスタンスを ✦Soul で1段鍛える (その魂を宿す人業が伸びる)。
// 費用・上限は ops.trainTimes と同じ。結果はトースト1つ + その場の演出 (src/ui/soulpanel.js)
function trainSoul(uid) { return uiSoulPanel.train(uid, 1); }

// 魂の残火でメイン魂のLv上限を1上げる (上限は capBonus に蓄積される)。
// 要る残火は職業のレア度ごと (emberCostOf: コモン1・レア2・エピック3・レジェンド5)
// opt.by = "soul": 無限迷宮の風だまりの灯番だけ、✦Soul でも上げられる (2026-10 ユーザーの指示)。
//   費用 = いまの Lv から次の Lv へ上がるのに要る ✦ (raiseCapSoulCost)
function raiseSoulCap(uid, opt = {}) {
  const e = soulByUid(uid);
  if (!e) return;
  if (opt.by === "soul") {
    if (!infAtRest()) return false;
    const need = raiseCapSoulCost(e);
    if ((G.soulPts || 0) < need) { SFX.ng(); showToast(`✦Soul が足りない（✦${need} 要る）`, { tone: "bad" }); return false; }
    G.soulPts -= need;
  } else {
    const need = emberCostOf(e.clsKey);
    if ((G.embers || 0) < need) { log(`魂の残火が足りない。(${need}つ要る)`, "sys"); SFX.ng(); showToast(`魂の残火が足りない（${need}つ要る）`, { noLog: true, tone: "bad" }); return false; }
    G.embers -= need;
  }
  e.capBonus = (e.capBonus || 0) + 1;
  recalcAllDolls();
  updateTopbar();
  const cap = soulLevelCapOf(e);
  if (opt.by === "soul") {
    log(`✦Soul を注ぎ、${soulLabel(e)}のLv上限が ${cap} になった。`, "win");
    showToast(`✦ ${soulLabel(e)} ― Lv上限 ${cap}（✦${G.soulPts}）`, { noLog: true, tone: "gold" });
  } else {
    log(`魂の残火を${emberCostOf(e.clsKey)}つ捧げ、${soulLabel(e)}のLv上限が ${cap} になった。`, "win");
    showToast(`🔥 ${soulLabel(e)} ― Lv上限 ${cap}（残火 ${G.embers}）`, { noLog: true, tone: "gold" });
  }
  // 上限に届いてから蓄積していた経験値を、伸びた上限まで Lv に注ぐ (街では強化と同じ祝祭を出す)
  const lv0 = e.level;
  const ready = e.level < cap && (e.exp || 0) >= soulTrainCost(e.level);
  if (ready && soulWorkOk()) uiSoulPanel.train(uid, 0);
  else if (ready && settleSoulExp(e)) { recalcAllDolls({ levelUp: true }); log(`蓄積していた ✦Soul で ${soulLabel(e)}が Lv${lv0}→${e.level} に成長した！`, "win"); }
  if (e.level === lv0) { SFX.levelup(); buzz([0, 30, 50, 30]); }
  autosave(true);
  renderTown();
  return true;
}

// ✦Soul で Lv上限を1上げる費用 (無限迷宮の灯番): いまの Lv から次の Lv へ上がるのに要る ✦ と同じ
function raiseCapSoulCost(e) { return soulTrainCost((e && e.level) || 1); }
// 無限迷宮の風だまりの灯番なら、✦Soul でも Lv上限を上げられる
function capBySoulOk() { return infAtRest(); }

// ---- 酒場「沈まぬ灯」の依頼 (クエスト。定義と掲示板の生成は src/quests.js) ----
// G.quest = {
//   board:  [q]   掲示板に貼られたフリークエスト (受ける前)。迷宮から帰還するたびに貼り替わる
//   active: [q]   受けたフリークエスト (最大 FREE_CAP 件)。帰還しても残り、達成して報告するか放棄するまで枠を使う
//   fixed:  { id: { state:"active"|"done"|"claimed", progress } }  受けた固定クエスト (報告するまで FREE_CAP の枠を使う)
//   seen:   { id:1 }  酒場で一度見た固定クエスト (「新」の印を消す)
//   seq:    依頼の通し番号
//   bellAt: 帰還の鈴を最後に受け取った時の実プレイ時間 (G.stats.playMs)。ここから1時間で次の鈴の依頼が貼られる
// }
// 依頼の状態: offer (掲示板) → active (受注中) → done (達成・報告待ち) → 報告で消える (固定は claimed で残す)
// ===== 名のある強敵 (dungeons/named.js) =====
// G.named = { seen: {id: {dungeon, floor}}, trophy: {id: true} }。討伐数は図鑑 (G.codex.mon) を読む
function namedState() {
  if (!G.named || typeof G.named !== "object") G.named = {};
  const s = G.named;
  if (!s.seen || typeof s.seen !== "object") s.seen = {};
  if (!s.trophy || typeof s.trophy !== "object") s.trophy = {};
  return s;
}
const codexKills = (key) => { const e = G.codex && G.codex.mon ? G.codex.mon[key] : null; return !e ? 0 : e === true ? 1 : Math.max(0, Number(e.kills) || 0); };
// 懸賞を受けていて、まだ討っていない (受けている間は縄張りの強敵階に必ず出る・強敵階が出やすい)
function namedHunted(id) { const f = questState().fixed[bountyId(id)]; return !!(f && f.state === "active"); }
// 強敵階に降りた: 名のある強敵なら目撃を記録する (懸賞は縄張りの迷宮が地図に現れた時点で酒場に出ている)
function namedSighted(id) {
  if (!id || !MONSTERS[id] || !MONSTERS[id].named) return;
  const st = namedState();
  const first = !st.seen[id];
  st.seen[id] = { dungeon: abyssActive() ? "abyss" : (activeCfg() || {}).id || null, floor: G.floor };
  if (first) log(`名のある強敵「${MONSTERS[id].name}」を目撃した。${questState().fixed[bountyId(id)] ? "" : "酒場に懸賞が出ている。"}`, "dmg");
}
// 名のある強敵1体の記録 (出撃シート・図鑑)
function namedInfo(id) {
  const st = namedState();
  const f = questState().fixed[bountyId(id)];
  const seen = st.seen[id] || null;
  const homes = DUNGEONS.filter((d, i) => worldOpenIdx(i) && (d.elites || []).includes(id));
  return {
    id, name: MONSTERS[id] ? MONSTERS[id].name : id, layer: (NAMED_FOES[id] || {}).layer || 0,
    seen, seenAt: seen && seen.dungeon ? (seen.dungeon === "abyss" ? "無限迷宮" : (worldById(seen.dungeon) || {}).name || "") : "",
    kills: codexKills(id), trophy: !!st.trophy[id], trophyId: (NAMED_FOES[id] || {}).trophy || null,
    bounty: f ? f.state : null, posted: !f && !!FIXED_BY_ID[bountyId(id)] && fixedQuestAppears(FIXED_BY_ID[bountyId(id)]),
    homes: homes.map((d) => d.name),
  };
}
// その迷宮を縄張りにする名のある強敵 (出撃シートの迷宮の顔)
function namedHere(cfg) { return ((cfg && cfg.elites) || []).filter((id) => MONSTERS[id] && MONSTERS[id].named).map(namedInfo); }
// 図鑑に並べる名のある強敵 (地図に縄張りが現れた者だけ)
function namedList() { return NAMED_IDS.filter((id) => MONSTERS[id] && DUNGEONS.some((d, i) => worldOpenIdx(i) && (d.elites || []).includes(id))).map(namedInfo); }

function questState() {
  if (!G.quest || typeof G.quest !== "object") G.quest = {};
  const s = G.quest;
  if (!Array.isArray(s.board)) s.board = null;
  if (!Array.isArray(s.active)) s.active = [];
  if (!s.fixed || typeof s.fixed !== "object") s.fixed = {};
  if (!s.seen || typeof s.seen !== "object") s.seen = {};
  if (!s.npcs || typeof s.npcs !== "object") s.npcs = {}; // 掲示板の依頼人ごとの報告の回数 (なじみ)
  if (!(s.seq > 0)) s.seq = 1;
  for (const q of [...(s.board || []), ...s.active]) { fixQuestDungeonName(q); scaleOldQuestReward(q); }
  return s;
}
// 依頼の報酬の倍率 (quests.js QUEST_REWARD_K / questRewardK) を、前の決まりで貼られた・受けた依頼の金貨・✦Soul に合わせ直す (一度だけ)。
//   印なし = 倍率を入れる前 → 品・職業の魂を添える依頼だけ 1/5 に
//   rk 1 = どの依頼も 1/5 にしていた版 → 金貨・✦Soul だけの依頼は元に戻す
function scaleOldQuestReward(q) {
  if (!q || q.rk === QUEST_RK) return;
  const was = q.rk;
  q.rk = QUEST_RK;
  const r = q.reward;
  if (!r || typeof r !== "object") return;
  const k = questRewardK(r);
  const f = !was ? k : was === 1 && k === 1 ? 1 / QUEST_REWARD_K : 1;
  if (f === 1) return;
  if (r.gold) r.gold = Math.max(1, Math.round(r.gold * f));
  if (r.soulPts) r.soulPts = Math.max(1, Math.round(r.soulPts * f));
}
// 古いセーブの依頼は説明・手がかりに迷宮の略称 (「囁く回廊」) が残っている → 正式名 (「亡骸の囁く回廊」) に直す
function fixQuestDungeonName(q) {
  const cfg = q && q.dungeon ? worldById(q.dungeon) : null;
  if (!cfg || !cfg.short || cfg.short === cfg.name) return;
  const from = `「${cfg.short}」`, to = `「${cfg.name}」`;
  for (const k of ["desc", "note"]) if (typeof q[k] === "string" && q[k].includes(from)) q[k] = q[k].split(from).join(to);
}
// 依頼の戦果 (その迷宮・階の普通の戦闘1回分の金貨/✦Soul)。出来事の evUnit と同じ物差しを、街から任意の迷宮で測る
function questUnit(cfg, floor = 1) {
  // その迷宮・階の推奨Lv の普通の1戦 (levelcurve.js refSoul / refGold)
  const lv = dungeonLevelRaw(cfg, Math.max(1, floor));
  return { gold: Math.max(6, refGold(lv)), soul: Math.max(3, refSoul(lv)) };
}
// 掲示板の生成に渡す窓 (src/quests.js)
// 掲示板の依頼を貼る迷宮 (2026-10 ユーザーの指示): 地図にある迷宮のうち、推奨Lv の帯 (1階〜最下階) が隊のLv から
// QUEST_LV_NEAR (10) 以内で、完全踏破していないもの (地図に現れた順)。それより離れた迷宮には固定クエストのほかは貼らない
function questLvGap(cfg, pl = partyLevel()) {
  const [lo, hi] = levelBand(cfg);
  return pl < lo ? lo - pl : pl > hi ? pl - hi : 0;
}
function questDungeons() {
  const order = Object.keys(worldState().open);
  const pl = partyLevel();
  return DUNGEONS.filter((d) => !d.tutorial && worldOpenId(d.id) && questLvGap(d, pl) <= QUEST_LV_NEAR && !dungeonFullyCleared(d))
    .sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
}
// 完全踏破 = 踏破した上で、その迷宮の魔物をすべて発見し、固有クエスト (極めて稀なる出来事を含む) をすべて果たした
// (出撃シートの「★ 完全踏破」と同じ数え方 — ui/departure.js fullyCleared)
function dungeonFullyCleared(cfg) {
  if (!cfg || !worldState().cleared[cfg.id]) return false;
  const f = dungeonFacts(cfg);
  return !!f && f.monSeen >= f.monTotal && f.fqDone >= f.fqTotal;
}
function questCtx() {
  const s = questState();
  const dungeons = questDungeons();
  const avoid = new Set();
  const activeBy = {};
  let activeCommon = 0;
  for (const q of s.active) {
    // 似た内容の依頼は、受注中の依頼が達成するまで貼らない (達成して報告を待つ間は、また貼ってよい — 2026-10 ユーザーの指示)
    if (q.state === "active") {
      for (const k of (q.keys || [])) avoid.add("k:" + k);
      if (q.itemId) avoid.add("i:" + q.itemId);
      if (q.type === "floor" && q.dungeon) avoid.add("f:" + q.dungeon);
      if (q.type === "soul") avoid.add("s:" + (q.dungeon || QUEST_COMMON_KEY));
      if (q.type === "chest") avoid.add("c:" + (q.dungeon || QUEST_COMMON_KEY));
    }
    if (q.state !== "active" || q.type === "deliver") continue; // 達成した依頼は枠の数に入れない (同じ内容をまた貼れる)
    if (q.dungeon) activeBy[q.dungeon] = (activeBy[q.dungeon] || 0) + 1;
    else activeCommon++;
  }
  const pl = partyLevel();
  return {
    dungeons, activeBy, activeCommon,
    common: { unit: { gold: Math.max(6, refGold(pl)), soul: Math.max(3, refSoul(pl)) }, minLv: Math.max(1, pl - QUEST_LV_NEAR) },
    unit: questUnit, deliverIds: eligibleDeliveryItemIds(), itemName: (id) => (ITEMS[id] || {}).name || id,
    isMisc: (id) => (ITEMS[id] || {}).slot === "misc",
    rand, avoid, uid: () => "q" + (s.seq++), bell: bellDue(),
  };
}
// 帰還の鈴の頃合いか: 前回の鈴を受け取ってから実プレイ (G.stats.playMs) が BELL_EVERY_MS を超え、
// 鈴を礼にくれる依頼をまだ受けていない (受けて報告前の間は、新たな鈴の依頼は貼られない)
function bellDue() {
  const s = questState();
  if (s.active.some(hasBell)) return false;
  return (G.stats.playMs || 0) - (s.bellAt || 0) >= BELL_EVERY_MS;
}
// 掲示板を貼り替える (迷宮から帰還した時・初めて酒場が開いた時)
function rollQuestBoard() {
  const s = questState();
  s.board = rollBoard(questCtx());
  return s.board;
}
function ensureQuestBoard() { const s = questState(); if (!s.board) rollQuestBoard(); return s.board; }
// 固定クエストが酒場に現れる条件を満たしたか
function fixedQuestAppears(def) {
  const a = def.appear || {}, w = worldState();
  if (a.reported && !w.reported[a.reported]) return false;
  if (a.cleared && !w.cleared[a.cleared]) return false;
  if (a.open && !w.open[a.open]) return false;
  if (a.found && !w.found[a.found]) return false;
  if (a.seen && !namedState().seen[a.seen]) return false; // 名のある強敵を目撃した
  if (a.openAny && !a.openAny.some((id) => w.open[id])) return false; // どれか1つが地図にある (懸賞 = 縄張りの迷宮)
  if (a.claimed) { const f = questState().fixed[a.claimed]; if (!f || f.state !== "claimed") return false; } // 前の依頼を報告し終えた
  return true;
}
// 酒場で受けられる固定クエスト (現れていて、まだ受けていないもの)
function fixedQuestOffers() {
  const s = questState();
  return FIXED_QUESTS.filter((d) => !s.fixed[d.id] && fixedQuestAppears(d));
}
// 固定クエストを1件の依頼の形にまとめる (UI はフリーと同じ形で扱う)
function fixedQuestView(def) {
  const st = questState().fixed[def.id] || null;
  const g = def.goal || {};
  return {
    uid: def.id, fixed: true, def, type: g.type, keys: g.keys, dungeon: g.dungeon, homeDungeon: fixedQuestHome(def),
    goal: g.type === "clear" ? 1 : (g.n || 1), progress: st ? st.progress || 0 : 0,
    state: st ? st.state : "offer", name: def.name, text: (def.lines || []).join(""), desc: def.desc,
    giver: def.giver, reward: fixedQuestReward(def), fresh: !st && !questState().seen[def.id],
  };
}
// 迷宮の深部 (8割の階) の戦果 / 地図でいちばん深い迷宮のそれ
const questDeepUnit = (cfg) => questUnit(cfg, Math.max(1, Math.ceil((cfg.floors || 1) * 0.8)));
function questFrontUnit() {
  const open = DUNGEONS.filter((d) => worldOpenId(d.id));
  return questDeepUnit(open.length ? open.reduce((a, d) => ((d.lvTo || 0) > (a.lvTo || 0) ? d : a)) : DUNGEONS[0]);
}
// 固定クエストの報酬 (戦果の倍数を、物差しの迷宮の深部で金貨/✦Soul に直す)
function fixedQuestReward(def) {
  const r = def.reward || {};
  const u0 = questDeepUnit(worldById(def.ref) || DUNGEONS[0]);
  // 後回しにした依頼も見劣りしないよう、地図でいちばん深い迷宮の戦果の 7割 を下限にする
  const front = questFrontUnit();
  const u = { gold: Math.max(u0.gold, front.gold * 0.7), soul: Math.max(u0.soul, front.soul * 0.7) };
  const out = {};
  // 職業の魂・品を添える依頼は、金貨・✦Soul・赤い魂に QUEST_REWARD_K (2026-10 ユーザーの指示で 1/5) を掛ける。
  // 添えない依頼 (金貨・✦Soul だけ) は減らさない — ただし名のある強敵の懸賞は減らす。残火・魂の数はそのまま
  const k = questRewardK(r, def);
  // 端数は 10 (✦ は 5) に丸める。小さな額は丸めると 0 や倍近くになるので、刻みの5倍に満たなければ1の位まで
  const nice = (v, step) => (v >= step * 5 ? Math.round(v / step) * step : Math.max(1, Math.round(v)));
  if (r.gold) out.gold = nice(u.gold * r.gold * k, 10);
  if (r.soul) out.soulPts = nice(u.soul * r.soul * k, 5);
  if (r.red) out.red = Math.max(1, Math.round(r.red * k));
  if (r.embers) out.embers = r.embers;
  if (r.souls) out.souls = r.souls.map((x) => [...x]);
  return out;
}
// 受注の枠を使っている依頼の数 (フリー + 報告前の固定クエスト)。上限 FREE_CAP
function questSlotCount() {
  const s = questState();
  return s.active.length + Object.values(s.fixed).filter((f) => f && f.state !== "claimed").length;
}
// 受注中・報告待ちの依頼 (フリー + 固定) と、掲示板・依頼人の依頼
function questLists() {
  const s = questState();
  ensureQuestBoard();
  const fixedActive = FIXED_QUESTS.filter((d) => s.fixed[d.id] && s.fixed[d.id].state !== "claimed").map(fixedQuestView);
  return {
    active: [...fixedActive, ...s.active],
    offers: [...fixedQuestOffers().map(fixedQuestView), ...(s.board || [])],
    freeCount: questSlotCount(), cap: FREE_CAP,
  };
}
// 依頼を探す (uid = フリーの通し番号 / 固定の id)
function questByUid(uid) {
  const s = questState();
  if (FIXED_BY_ID[uid]) return fixedQuestView(FIXED_BY_ID[uid]);
  return s.active.find((q) => q.uid === uid) || (s.board || []).find((q) => q.uid === uid) || null;
}
// 出撃シートの添え書き: 受けている依頼がこの迷宮を指していれば「依頼の地」/ 依頼の迷宮なら「依頼の迷宮」
// その迷宮を対象にしている受注中の依頼の数 (討伐の出る迷宮・到達/踏破の迷宮)。出撃シートの「依頼」の印
function questHereCount(cfg) {
  return questsTargeting(cfg).length;
}
// その迷宮を対象にしている受注中の依頼 (固定 → フリーの順)。出撃シートの「受注中の依頼」の札と、名の横の「依頼」の印
function questsTargeting(cfg) {
  if (!cfg) return [];
  const s = questState();
  return [
    ...FIXED_QUESTS.filter((d) => s.fixed[d.id] && s.fixed[d.id].state === "active" && fixedQuestTargets(d, cfg)).map(fixedQuestView),
    // 共通の討伐 (迷宮を指さない) は、狙う魔物が出る迷宮すべてに数える
    ...s.active.filter((q) => q.state === "active" && (q.dungeon === cfg.id || (!q.dungeon && q.type === "kill" && questKillHere(q.keys, cfg)))),
  ];
}
// 依頼人の頼みがこの迷宮を指しているか: 到達/踏破はその迷宮、討伐は狙う魔物が出る迷宮 (出現表の帯・主。金属の魔物は第3層から)
function fixedQuestTargets(def, cfg) {
  const g = def.goal || {};
  if (g.dungeon) return g.dungeon === cfg.id;
  if (g.type !== "kill" || !g.keys) return false;
  return questKillHere(g.keys, cfg);
}
// 狙う魔物がその迷宮に出るか (出現表の帯・主。金属の魔物は段ごとの層から — 銀業は第3層・上位種は第4層)
function questKillHere(keys, cfg) {
  const roster = new Set([...(cfg.bands ? cfg.bands.flat() : [...(cfg.pool || []), ...(cfg.deepPool || [])]), ...(cfg.elites || []), cfg.boss].filter(Boolean));
  return (keys || []).some((k) => roster.has(k) || metalInLayer(k, cfg.layer));
}
// 階の情報 (迷宮の手帳) に並べる依頼: 受注中のうち、いま潜っている迷宮で進められるもの (+ 達成して報告待ちのもの)
//   討伐 = 狙う魔物がここに出る / 到達・踏破 = この迷宮 / 魂・宝箱 = 指す迷宮 (指さない古い依頼はどこでも) / 納品 = 迷宮では進まないので出さない
function questsHere() {
  const cfg = activeCfg();
  if (!cfg) return [];
  const here = G.abyss ? null : cfg.id;
  const fits = (q) => {
    if (q.type === "soul" || q.type === "chest") return q.dungeon ? !!here && q.dungeon === here : !q.minLv || foeLevelHere() >= q.minLv;
    if (q.type === "kill") return questKillHere(q.keys, cfg);
    if (q.type === "floor" || q.type === "clear") return !!here && q.dungeon === here;
    return false;
  };
  return questLists().active.filter((q) => (q.state === "active" || q.state === "done") && fits(q))
    .sort((a, b) => (a.state === "done") - (b.state === "done"));
}
// 出撃シートの添え書き: 酒場の依頼で開いた迷宮なら「依頼の迷宮」(受けた依頼の対象かどうかは名の横の印 questHereCount)
function questHereNote(cfg) {
  return cfg?.tutorial ? "イレーヌの依頼" : cfg && cfg.side ? (cfg.unlock && cfg.unlock.quest ? "依頼の迷宮" : "寄り道の迷宮") : null;
}
// 迷宮ごとの記録 (出撃シートの迷宮の顔): 図鑑に記録した魔物 / その迷宮の魔物 (雑魚・強敵・主) と、
// その迷宮の固定クエスト (依頼人の頼み) の報告済み / 総数。
// 固定クエストの「家」= 到達・踏破の迷宮 → 地図に開く迷宮 → 狙う魔物が最初に出る迷宮 (地図の並び)。魂・宝箱は家なし。
// 懸賞・討伐の家は、候補のうち地図に現れている迷宮を先に選ぶ (縄張りの一部だけが開いている時に、
// まだ地図にない迷宮の名で酒場に並ばないように)。どれも開いていなければ最初の候補
function fixedQuestHome(def) {
  const g = def.goal || {};
  const firstOpen = (ids) => ids.find((id) => worldOpenId(id)) || ids[0] || null;
  if (def.bounty) return firstOpen([...((def.appear && def.appear.openAny) || []), def.ref].filter(Boolean)); // 懸賞の家は縄張りの迷宮
  if (g.dungeon) return g.dungeon;
  if (def.opens && def.opens.length) return def.opens[0];
  if (g.type !== "kill" || !g.keys) return null;
  return firstOpen(DUNGEONS.filter((d) => {
    const roster = new Set(dungeonRoster(d));
    return g.keys.some((k) => roster.has(k) || metalInLayer(k, d.layer));
  }).map((d) => d.id));
}
// その迷宮専用の「極めて稀なる出来事」(events.js DUNGEON_GIFTS。w01・奈落には無い)。固有クエストに数える
function dungeonMythic(cfg) {
  if (!cfg || !cfg.id || cfg.noEvents) return null;
  return Object.values(EVENT_MAP).find((e) => e.tier === "mythic" && e.dungeonId === cfg.id) || null;
}
function dungeonFacts(cfg) {
  if (!cfg) return null;
  const roster = dungeonRoster(cfg);
  const mon = (G.codex && G.codex.mon) || {};
  const s = questState();
  const fq = FIXED_QUESTS.filter((d) => fixedQuestHome(d) === cfg.id);
  const my = dungeonMythic(cfg);
  const myGot = !!(my && G.events && G.events.once && G.events.once[my.id]);
  return {
    monSeen: roster.filter((k) => mon[k]).length, monTotal: roster.length,
    fqDone: fq.filter((d) => s.fixed[d.id] && s.fixed[d.id].state === "claimed").length + (myGot ? 1 : 0),
    fqTotal: fq.length + (my ? 1 : 0),
  };
}
// 出撃シートの「固有クエスト」の詳細: その迷宮を家とする固定クエストを、酒場に現れたものは依頼の形 (fixedQuestView) で、
// まだ現れていないものは名を伏せて、酒場に現れる条件 (appear のうち満たしていないもの) を添えて返す
function dungeonQuests(cfg) {
  if (!cfg) return [];
  const s = questState(), w = worldState();
  const dname = (id) => { const d = worldById(id); return d ? `「${d.name}」` : "ある迷宮"; };
  const hint = (def) => {
    const a = def.appear || {}, out = [];
    if (a.reported && !w.reported[a.reported]) out.push(`${dname(a.reported)}の踏破を王に報告`);
    if (a.cleared && !w.cleared[a.cleared]) out.push(`${dname(a.cleared)}を踏破`);
    if (a.open && !w.open[a.open]) out.push(`${dname(a.open)}が地図に現れる`);
    if (a.found && !w.found[a.found]) out.push("迷宮で手がかりを見つける");
    if (a.seen && !namedState().seen[a.seen]) out.push(`${MONSTERS[a.seen] ? `「${MONSTERS[a.seen].name}」` : "名のある強敵"}を目撃`);
    if (a.openAny && !a.openAny.some((id) => w.open[id])) out.push(`${a.openAny.map(dname).join("か")}が地図に現れる`);
    if (a.claimed) { const f = s.fixed[a.claimed]; if (!f || f.state !== "claimed") out.push(`依頼${FIXED_BY_ID[a.claimed] && fixedQuestAppears(FIXED_BY_ID[a.claimed]) ? `「${FIXED_BY_ID[a.claimed].name}」` : "人の頼み"}を報告`); }
    return out.length ? out.join(" ・ ") : "やがて現れる";
  };
  const list = FIXED_QUESTS.filter((d) => fixedQuestHome(d) === cfg.id).map((d) => {
    const shown = !!s.fixed[d.id] || fixedQuestAppears(d);
    return shown ? { id: d.id, shown: true, q: fixedQuestView(d) } : { id: d.id, shown: false, hint: hint(d) };
  });
  // その迷宮専用の「極めて稀なる出来事」も固有クエストの1件に数える。授かるまでは名も効き目も伏せる
  const my = dungeonMythic(cfg);
  if (my) {
    const got = !!(G.events && G.events.once && G.events.once[my.id]);
    list.push({ id: my.id, mythic: true, got, name: got ? my.name : null, boon: got ? my.boon : null });
  }
  return list;
}
// 報告できる依頼の数 (達成済み + 手持ちで納められる納品)。街の札・酒場の札の印
function questReadyCount() {
  if (!facilityOpenKey("tavern")) return 0;
  const s = questState();
  let n = s.active.filter((q) => q.state === "done" || (q.type === "deliver" && deliveryHolder(q.itemId))).length;
  n += Object.values(s.fixed).filter((f) => f && f.state === "done").length;
  return n;
}
function facilityOpenKey(key) {
  const a = tutorialAllowed();
  return !a || a.includes(key);
}

// 依頼を受ける。フリーと固定 (依頼人の頼み) を合わせて同時に FREE_CAP 件まで (固定は受けると地図に迷宮が現れるものもある)
function questCapRefused() {
  if (questSlotCount() < FREE_CAP) return false;
  SFX.ng();
  showToast(`受けられる依頼は ${FREE_CAP}件まで。達成して報告するか、放棄してから`, { tone: "bad" });
  return true;
}
function acceptQuest(uid) {
  if (!facilityOpenKey("tavern")) return false;
  const s = questState();
  const def = FIXED_BY_ID[uid];
  if (def) {
    if (s.fixed[uid] || !fixedQuestAppears(def)) return false;
    if (questCapRefused()) return false;
    s.fixed[uid] = { state: "active", progress: 0 };
    s.seen[uid] = 1;
    SFX.select();
    log(`依頼「${def.name}」を受けた。(${def.giver.name})`, "sys");
    const added = refreshWorldUnlocks();
    announceNewDungeons(added);
    autosave(true);
    renderTown();
    return true;
  }
  const i = (s.board || []).findIndex((q) => q.uid === uid);
  if (i < 0) return false;
  if (questCapRefused()) return false;
  const q = s.board.splice(i, 1)[0];
  q.state = "active"; q.progress = 0;
  s.active.push(q);
  SFX.select();
  log(`依頼「${q.name}」を受けた。`, "sys");
  autosave(true);
  renderTown();
  return true;
}
// 受けた依頼を放棄する (枠が1つ空く。進みは失われる)。
// 固定クエスト (依頼人の頼み) は達成前なら放棄でき、依頼人の依頼として酒場に戻る (開いた迷宮はそのまま)
function abandonQuest(uid) {
  const s = questState();
  const def = FIXED_BY_ID[uid];
  if (def) {
    const st = s.fixed[uid];
    if (!st || st.state !== "active") return false;
    delete s.fixed[uid];
    SFX.select();
    log(`依頼「${def.name}」を放棄した。(${def.giver.name})`, "sys");
    showToast(`依頼「${def.name}」を放棄した`, { noLog: true, tone: "info" });
    autosave(true);
    renderTown();
    return true;
  }
  const i = s.active.findIndex((q) => q.uid === uid);
  if (i < 0) return false;
  const q = s.active.splice(i, 1)[0];
  SFX.select();
  log(`依頼「${q.name}」を放棄した。`, "sys");
  showToast(`依頼「${q.name}」を放棄した`, { noLog: true, tone: "info" });
  autosave(true);
  renderTown();
  return true;
}
// 同じ処理で果たした依頼をまとめ、戦果・入手のシートを開いた後に最前面で知らせる。
const questDoneAlerts = [];
let questDoneAlertTimer = null;
function questDone(q) {
  const who = q.giver ? q.giver.name : (q.npc != null ? npcOf(q.npc).name : null);
  log(`依頼「${q.name}」を果たした！ — 酒場で${who ? who + "に" : ""}報告しよう`, "win");
  if (!inDungeon()) {
    showToast(`📜 依頼達成: ${q.name}` + (who ? ` ― ${who}が待っている` : ""), { noLog: true, tone: "good" });
    return;
  }
  setAutoMove(false);
  questDoneAlerts.push({ name: q.name, who });
  if (questDoneAlertTimer !== null) return;
  questDoneAlertTimer = setTimeout(() => {
    questDoneAlertTimer = null;
    const done = questDoneAlerts.splice(0);
    SFX.itemget();
    sheet.open({
      kind: "celebrate", banner: "✦ 依頼達成 ✦",
      title: done.length === 1 ? done[0].name : `${done.length}件の依頼を果たした`,
      lines: [
        ...(done.length > 1 ? done.map((x) => `「${x.name}」を果たした。`) : []),
        ...done.map((x) => x.who ? `${x.who}が酒場で待っている。` : null).filter(Boolean),
        "酒場「沈まぬ灯」に戻って報告しよう。",
      ],
      footer: [{ label: "確認", kind: "primary", size: "lg", onTap: (s) => s.close() }],
    });
  }, 0);
}

// 依頼の進みを加算する (迷宮・階を問わず、条件さえ満たせば進む)。
//   kill: key = 倒した魔物 / soul・chest: 数 (迷宮を指す依頼はその迷宮の中でだけ) / floor: key = 着いた階 (その迷宮の依頼だけ) /
//   clear: key = 踏破した迷宮の id
function questProgress(type, key, n = 1) {
  if (abyssActive()) return; // 無限迷宮は本編とは別の遊び: 酒場の依頼は進まない
  const s = questState();
  const here = G.abyss ? null : (DUNGEONS[G.dungeonIdx] || {}).id;
  const step = (goal, prog) => {
    if (goal.type !== type) return null;
    if (type === "kill" && !(goal.keys || []).includes(key)) return null;
    if (type === "floor") return goal.dungeon && goal.dungeon !== here ? null : Math.max(prog, key || 0);
    if (type === "clear") return goal.dungeon === key ? 1 : null;
    // 魂・宝箱: 迷宮を指す依頼 (フリークエスト) はその迷宮の中でだけ進む。指さない依頼 (固定・古いセーブの依頼) はどこでも
    if ((type === "soul" || type === "chest") && goal.dungeon && !(inDungeon() && goal.dungeon === here)) return null;
    // 共通の魂・宝箱の依頼 (minLv あり) は、推奨Lv がその下限以上の迷宮・奈落の中でだけ進む
    if ((type === "soul" || type === "chest") && goal.minLv && !(inDungeon() && foeLevelHere() >= goal.minLv)) return null;
    return prog + n;
  };
  for (const q of s.active) {
    if (q.state !== "active") continue;
    const v = step({ type: q.type, keys: q.keys, dungeon: q.dungeon, minLv: q.minLv }, q.progress || 0);
    if (v == null) continue;
    q.progress = Math.min(q.goal, v);
    if (q.progress >= q.goal) { q.state = "done"; questDone(q); }
  }
  for (const def of FIXED_QUESTS) {
    const st = s.fixed[def.id];
    if (!st || st.state !== "active") continue;
    const g = def.goal || {};
    const v = step(g, st.progress || 0);
    if (v == null) continue;
    const goal = g.type === "clear" ? 1 : (g.n || 1);
    st.progress = Math.min(goal, v);
    if (st.progress >= goal) { st.state = "done"; questDone(def); }
  }
}

// 報酬の魂を抽選して受け取る: [[魂のレア度, 体数]] → 職の鍵の配列
function grantRewardSouls(list) {
  const got = [];
  for (const [rar, cnt] of (list || [])) for (let k = 0; k < cnt; k++) { const ck = rollClassOfRarity(rar); addSoulInstance(ck); tlSoulGot(ck); got.push(ck); }
  if (got.length) recalcAllDolls();
  return got;
}
// 報酬の表示 (物語のページの「受け取るもの」)
function rewardRows(r, jobs = []) {
  const out = [];
  if (r.gold) out.push({ cur: "gold", n: r.gold });
  if (r.soulPts) out.push({ cur: "soul", n: r.soulPts });
  if (r.red) out.push({ cur: "red", n: r.red });
  if (r.embers) out.push({ cur: "ember", n: r.embers });
  for (const j of jobs) out.push({ job: j });
  for (const [id, n] of (r.items || [])) if (ITEMS[id]) out.push({ item: ITEMS[id], n });
  return out;
}
// 報酬の品 ([[id, 数]]) を隊 → 控えの袋の空きへ入れる。入らない分は数を返す
function rewardItemsRoom(r) {
  let need = 0;
  for (const [id, n] of (r.items || [])) if (ITEMS[id]) need += n;
  const room = Math.max(0, MAX_ITEMS - G.inventory.length);
  return room - need;
}
function grantRewardItems(r) {
  for (const [id, n] of (r.items || [])) {
    for (let k = 0; k < n; k++) {
      const it = cloneItem(id);
      const who = it && allDolls().find((d) => (d.items || []).length < MAX_ITEMS);
      if (!who) break;
      who.items.push(it);
      codexSeeItem(id, it);
    }
  }
}
// src = テスト記録の出どころ (tlTown)
function grantCurrencies(r, src) {
  G.gold += r.gold || 0;
  G.soulPts += r.soulPts || 0;
  tlTown("gold", r.gold || 0, src); tlTown("soul", r.soulPts || 0, src);
  grantRedSoul(r.red || 0, src || "reward");
  G.embers = (G.embers || 0) + (r.embers || 0);
}
// 達成した依頼を報告して報酬を受け取る
function claimQuest(uid) {
  if (!facilityOpenKey("tavern")) return false;
  const s = questState();
  const def = FIXED_BY_ID[uid];
  if (def) {
    const st = s.fixed[uid];
    if (!st || st.state !== "done") return false;
    const r = fixedQuestReward(def);
    st.state = "claimed";
    G.stats.questsDone = (G.stats.questsDone || 0) + 1;
    grantCurrencies(r, "fq");
    const jobs = grantRewardSouls(r.souls);
    autosave(true);
    SFX.itemget(); buzz([0, 30, 60, 30]);
    log(`依頼「${def.name}」を報告した。(${def.giver.name})`, "win");
    UI.playStoryChain([{ title: def.name, lines: def.done || [], reward: rewardRows(r, jobs), kicker: `依頼の報告 ― ${def.giver.name}`, place: "tavern", btnLabel: "受け取る",
      who: { name: def.giver.name, sub: `${def.giver.title} ・ 一度きりの依頼`, art: () => questMarkCanvas(fixedQuestView(def), jobs) } }], () => {
      updateTopbar(); renderTown();
      showToast(`📜 依頼「${def.name}」を果たした`, { tone: "gold" });
    });
    return true;
  }
  const i = s.active.findIndex((q) => q.uid === uid && q.state === "done");
  if (i < 0) return false;
  // 礼の品 (帰還の鈴) を受け取る袋の空きが無ければ、報告は待ってもらう
  if (rewardItemsRoom(s.active[i].reward || {}) < 0) {
    SFX.ng();
    showToast("持ち物がいっぱいで、礼の品を受け取れない。袋を空けてから報告しよう", { tone: "bad" });
    return false;
  }
  const q = s.active.splice(i, 1)[0];
  if (hasBell(q)) s.bellAt = G.stats.playMs || 0; // 次の鈴は、ここから実プレイ1時間後
  finishFreeQuest(q, q.reward || {});
  return true;
}
// フリークエストの報酬を渡して締める (納品も同じ道)。
// 依頼人が酒場で迎える一幕 (UI.playStoryChain) に、依頼の言葉・依頼人の礼・受け取るものを並べる。
// 同じ依頼人への報告を重ねるほど「なじみ」になり、礼の言葉が変わる。3・6・10回目 (以後5回ごと) は節目の品
// (quests.js BOND_GIFTS)、ときどき (TIP_RATE %) 心付けが上乗せされる
// テスト記録の出どころ: フリークエストの種類ごと
const Q_SRC = { kill: "qk", soul: "qs", chest: "qc", floor: "qf", deliver: "qd" };
function finishFreeQuest(q, r, extraJobs = [], title = null) {
  const s = questState();
  G.stats.questsDone = (G.stats.questsDone || 0) + 1;
  const ni = NPCS[q.npc] ? q.npc : 0;
  const npc = npcOf(ni);
  const count = (s.npcs[ni] || 0) + 1;
  s.npcs[ni] = count;
  const tip = rand(100) < TIP_RATE ? questTip(r) : null;
  const bond = bondGiftAt(count);
  grantCurrencies(r, Q_SRC[q.type] || "q");
  grantRewardItems(r);
  const jobs = [...extraJobs, ...grantRewardSouls(r.souls)];
  if (tip) grantCurrencies(tip, "tip");
  const bondJobs = bond ? grantRewardSouls(bond.gift.souls) : [];
  if (bond) grantCurrencies(bond.gift, "bond");
  const rows = [...rewardRows(r, jobs), ...rewardRows(tip || {}).map((x) => ({ ...x, tag: "心付け" })),
    ...(bond ? rewardRows(bond.gift, bondJobs).map((x) => ({ ...x, tag: "なじみの礼" })) : [])];
  updateTopbar();
  const parts = [];
  const gold = (r.gold || 0) + ((tip && tip.gold) || 0), soul = (r.soulPts || 0) + ((tip && tip.soulPts) || 0);
  if (gold) parts.push(`💰${gold}`);
  if (soul) parts.push(`✦${soul}`);
  const allJobs = [...jobs, ...bondJobs];
  const names = allJobs.map((k) => SOUL_CLASSES[k].label);
  log(`依頼「${q.name}」を${npc.name}に報告した。` + (parts.length ? ` ${parts.join(" ")}` : "") + (names.length ? ` 魂: ${names.join("・")}` : ""), "win");
  autosave(true);
  const rareJob = allJobs.find((k) => SOUL_CLASSES[k].rarity !== "common");
  SFX.itemget(); buzz(rareJob || bond ? [0, 40, 50, 40, 50, 150] : [0, 30, 60, 30]);
  if (allJobs.some((k) => SOUL_CLASSES[k].rarity === "legend")) { flashScreen("#ffcf4a"); SFX.victory(); }
  const lines = composeReport(q, count, { rand, tip: !!tip, bond });
  const bl = npcBondLabel(count);
  UI.playStoryChain([{
    title: title || q.name, lines, reward: rows, kicker: `依頼の報告 ― ${npc.name}`, place: "tavern", btnLabel: "受け取る",
    who: { name: npc.name, sub: npc.title + (bl ? ` ・ ${bl}` : ""), art: () => questMarkCanvas(q, jobs) },
  }], () => {
    updateTopbar(); renderTown();
    showToast(`📜 依頼「${q.name}」を果たした` + (bond ? ` ― ${npc.name}と${bl}に` : ""), { tone: "gold" });
  });
}
// 心付け: 報酬の金貨 (無ければ ✦Soul) の 3〜5割。納品 (魂だけの報酬) は地図の最深部の戦果 2〜4回分の金貨 × QUEST_REWARD_K
function questTip(r) {
  const k = 0.3 + rand(3) * 0.1;
  if (r.gold) return { gold: Math.max(1, Math.round(r.gold * k)) };
  if (r.soulPts) return { soulPts: Math.max(1, Math.round(r.soulPts * k)) };
  return { gold: Math.max(2, Math.round(questFrontUnit().gold * (2 + rand(3)) * QUEST_REWARD_K)) };
}
// 報告の一幕の肖像の枠に掲げる絵: 討伐 = 倒した魔物 / 納品 = 納めた品 / 魂 = 授かった魂 / 宝箱 / 到達 = 階段
function questMarkCanvas(q, jobs = []) {
  const spr = (q.type === "kill" && q.keys && MONSTERS[q.keys[0]]) || (q.type === "deliver" && ITEMS[q.itemId]) ||
    (q.type === "soul" && jobs[0] && soulIcon(jobs[0])) || (q.type === "chest" && ICONS.chest) || (q.type === "floor" && ICONS.stairs) || (q.type === "clear" && ICONS.bossDoor) ||
    (jobs[0] && soulIcon(jobs[0])) || ICONS.chest;
  return crispCanvas(spr, 96);
}

// ---- 酒場に居合わせる者たち: 帰還ごとに3〜5名を選び、各人が他愛もない話・心得・言い伝えを一つ語る (tavern.js) ----
// req を持つ話は、その機能・場所・物語が開くまで出さない (未解放の仕組みや先の章を匂わせない)。
function tavernHintAllowed(req) {
  if (!req) return true;
  const w = worldState();
  if (req.startsWith("rep:")) return !!w.reported[req.slice(4)];       // その迷宮を王に報告した後
  if (req.startsWith("found:")) return !!w.found[req.slice(6)];         // その手がかりを見つけた後
  if (req.startsWith("open:")) return worldOpenId(req.slice(5));        // その迷宮が地図に現れた後 (依頼の迷宮)
  if (req.startsWith("ch:")) return chaptersDone(w) >= Number(req.slice(3)); // 第n章を結んだ後
  if (req === "sub") return unlockedSubSlots() > 0;     // サブ魂
  if (req === "metal") return DUNGEONS.some((d) => d.layer >= 3 && worldOpenId(d.id)); // 金属の魔物 (第3層の景色の迷宮から出る)
  if (req === "metal2") return DUNGEONS.some((d) => d.layer >= 4 && worldOpenId(d.id)); // 金属の上位種 (金業・銀業の王は第4層から)
  if (req === "fort") return DUNGEONS.some((d) => d.layer >= 4 && worldOpenId(d.id));  // 捨て砦 (第4層の迷宮が地図に現れた後)
  if (req === "roots") return worldOpenId("w10");                                   // 魂脈の根 (大穴の下の縦穴が地図に現れた後)
  if (req === "undercity") return worldOpenId("w14");                               // 王都の地下 (水底の参道が地図に現れた後)
  if (req === "furnace") return worldOpenId("w18");                                 // 灼熱の洞 (火を噴く地割れが地図に現れた後)
  if (req === "frost") return worldOpenId("w22");                                   // 氷結回廊 (奈落の氷棚が地図に現れた後)
  if (req === "swamp") return worldOpenId("w26");                                   // 毒沼 (腐れ水の岸が地図に現れた後)
  if (req === "storm") return worldOpenId("w30");                                   // 嵐の尖塔 (風鳴りの螺旋が地図に現れた後)
  if (req === "arena") return worldOpenId("w34");                                   // 闘技場跡 (雲を渡る石橋が地図に現れた後)
  if (req === "cavern") return worldOpenId("w38");                                  // 地底大空洞 (灯籠の吹き溜まりが地図に現れた後)
  return featureUnlocked(req);                           // fusion / rumor / order / rusui
}
// 酒場の顔ぶれを選び直す (ダンジョン帰還時・初回入店時に呼ぶ)
function rollTavernCrowd() {
  G.tavernCrowd = pickTavernCrowd({ allowed: tavernHintAllowed, heard: G.tavernHeard || {} });
}
// 顔ぶれの話を聞いた (顔ぶれを開いた時)。心得・言い伝えは「書き留めた話」に残す
function markTavernHeard(crowd = G.tavernCrowd) {
  const h = G.tavernHeard || (G.tavernHeard = {});
  let added = 0;
  for (const m of crowd || []) {
    const t = m && m.id && TALK_MAP[m.id];
    if (t && t.k !== "chat" && !h[t.id]) { h[t.id] = 1; m.fresh = 1; added++; } // fresh = 初めて聞いた話 (次に顔ぶれが替わるまで「初耳」)
  }
  if (added) autosave();
  return added;
}
// 書き留めた話 (聞いた心得・言い伝え。台帳の並び順)
function tavernNotes() {
  const h = G.tavernHeard || {};
  return Object.keys(h).map((id) => TALK_MAP[id]).filter((t) => t && !t.retired); // 取りやめた仕組みの話 (retired) は出さない
}

// ---- 情報屋の噂: 地図にある迷宮の一つを読んだ予兆を生成する ----
// 読む迷宮は隊のLvに見合う (推奨Lvの帯に近い) 迷宮ほど選ばれやすい (rumorDungeon)。
// 盤面型 (harvest/treasure/special) はその迷宮に次に潜った時の開始階 (B1F) で現実になり (applyRumorToBoard)、
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

// 噂の迷宮を選ぶ: 地図にある迷宮 (奈落を除く) から、隊のLvと推奨Lvの帯 (1階〜最下階) の離れ具合で重みを付けて抽選。
// 帯の中なら重み1、帯から RUMOR_LV_HALF Lv 離れるごとに半分
const RUMOR_LV_HALF = 3;
function rumorDungeon() {
  const open = DUNGEONS.filter((d) => worldOpenId(d.id));
  if (!open.length) return curDungeon();
  const pl = partyLevel();
  const ws = open.map((d) => {
    const [lo, hi] = levelBand(d);
    const gap = pl < lo ? lo - pl : pl > hi ? pl - hi : 0;
    return Math.pow(0.5, gap / RUMOR_LV_HALF);
  });
  let r = random() * ws.reduce((a, w) => a + w, 0);
  for (let i = 0; i < open.length; i++) { if ((r -= ws[i]) < 0) return open[i]; }
  return open[open.length - 1];
}

function rollRumor() {
  const cfg = rumorDungeon();
  const layer = cfg.layer || 1;
  const speaker = RUMOR_SPEAKERS[rand(RUMOR_SPEAKERS.length)];
  const dn = cfg.name || "次の迷宮";

  // 出撃先に応じて成立する噂だけを [重み, 生成関数] で候補に積む
  const cands = [];
  // 豊穣の予兆: B1F にまだあたたかい死体。深層ほど数が増える
  // (いつも普通のあたたかい死体。偉大なる死体は特別な階「強大な気配」にだけ出る — 2026-10 ユーザーの指示)
  cands.push([30, () => ({ type: "harvest", clsKey: rollJobClass(), floor: 1, speaker,
    text: `「${dn}の入口あたりで、まだあたたかい死体を見た。魂が宿っているはずだ。」` })]);
  // 財宝の予兆: B1F に格の高い宝箱 (中身は装備品確定・層相応のレベル底上げ)
  cands.push([25, () => ({ type: "treasure", floor: 1, speaker,
    text: `「${dn}の奥で金属の輝きを見たという。${layer >= 10 ? "相当な業物が眠っているかもしれん。" : "上物の宝箱がひとつ余分にあるかもな。"}」` })]);
  // 特別階の予兆: 第1の迷宮を除き、B1F が好特別階になる
  if (!cfg.noSpecial && cfg.id !== "w01") cands.push([20, () => {
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
      const be = b.element && b.element !== "none" && ELEMENTS[b.element] ? `〈${ELEMENTS[b.element].label}〉をまとう` : "";
      const tr = monsterTraits(b)[0];
      const trTxt = tr ? `${tr.label}——${tr.desc}。` : "底知れぬ力を持つという。";
      return { type: "boss", floor: 1, speaker, info: true,
        text: `「${dn}の主は${be}「${b.name}」だ。${trTxt}心して挑め。」` };
    }]);
  }

  const total = cands.reduce((s, c) => s + c[0], 0);
  let r = random() * total;
  let pick = cands[0];
  for (const c of cands) { if ((r -= c[0]) < 0) { pick = c; break; } }
  return { ...pick[1](), dungeon: cfg.id, dungeonName: dn };
}
// 手元の噂がこの迷宮のものか (dungeon の無い旧セーブの噂は、どこに潜っても現実になる)
function rumorFor(cfg) { return !!G.rumor && (!G.rumor.dungeon || G.rumor.dungeon === (cfg && cfg.id)); }

// 盤面生成後に、予兆 (rumor) を反映する。威力は実際に潜る迷宮の層に合わせる
function applyRumorToBoard(board) {
  const r = G.activeRumor;
  if (!r) return;
  G.activeRumor = null;
  if (r.info) return; // 属性・主の予兆は備えを促すだけ。盤面は変えない
  if (activeCfg().noSpecial || (r.type === "special" && activeCfg().id === "w01")) return; // 別の迷宮で聞いた噂でも第1の迷宮には出さない
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
  const setCorpse = (cls) => { const c = pickCell(); if (c) { c.type = "corpse"; c.cleared = false; c.corpseWarm = true; c.corpseClass = cls; } };
  if (r.type === "harvest") {
    // 名指しの1体 + 層に応じた追加 (深層ほど多い)。どれも普通のあたたかい死体
    // (旧版で偉大なる死体として聞いた噂 (r.great) は、魂を普通の死体の抽選で引き直す)
    const extra = layer >= 14 ? 2 : layer >= 7 ? 1 : 0;
    setCorpse(r.great ? rollJobClass() : r.clsKey);
    for (let i = 0; i < extra; i++) setCorpse(rollJobClass());
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

// ---- 納品の依頼 (フリークエストの一種): 求められた品を納めると、その品のレア度 (c/uc/r/sr/lr) に応じて職業の魂を授かる ----
// 求める品は「地図にある迷宮で出うる品」(LOOT_IDS = exclusive/LR を除く通常ドロップ品)。報酬の表は src/quests.js DELIVERY_REWARDS
const deliveryRewardRowsOf = (it) => deliveryRewardRows(rarityKey(it));
// 報酬を1つ抽選: [rarity, 体数]
function rollDeliveryReward(it) {
  const rows = deliveryRewardRowsOf(it);
  let r = random();
  for (const [rarity, count, p] of rows) { if ((r -= p) < 0) return [rarity, count]; }
  const last = rows[rows.length - 1];
  return [last[0], last[1]];
}
// 指定レアリティの職業をランダムに選ぶ
function rollClassOfRarity(rarity) {
  const pool = SOUL_KEYS.filter((k) => SOUL_CLASSES[k].rarity === rarity);
  return pool.length ? pool[rand(pool.length)] : "fighter";
}
// 「今 到達している深さまでに出現しうる」品のid (LOOT_IDS = exclusive/LR を除く通常ドロップ品)。
// 最初から商会の棚に並ぶ品 (SHOP_INIT_STOCK) は買うだけで済むので求めない
function eligibleDeliveryItemIds() {
  // 地図にある迷宮のうち、いちばん深い落とし物の帯の上限 lv
  const open = DUNGEONS.filter((d) => worldOpenId(d.id));
  const cap = Math.max(1, ...(open.length ? open : [DUNGEONS[0]]).map((d) => (d.lootLv || [1, 1])[1]));
  return LOOT_IDS.filter((id) => (ITEMS[id].lv || 1) <= cap && !(id in SHOP_INIT_STOCK));
}
// 対象アイテムが手持ち (人業の所持品。装備中・未鑑定は除く) にあるか
function deliveryHolder(itemId) {
  return allDolls().find((d) => (d.items || []).some((it) => it.id === itemId && !it.unidentified)) || null;
}
// 納品の依頼の状態: 手持ち (holder) があればそのまま納品、無くても商会の棚にあれば買ってその場で納品できる
function deliveryStatus(q) {
  const it = q && ITEMS[q.itemId];
  if (!it) return null;
  const holder = deliveryHolder(q.itemId);
  const inShop = !!(G.shopStock && G.shopStock[q.itemId] > 0);
  const price = buyPrice(it);
  return { holder, inShop, price, canBuy: !holder && inShop && G.gold >= price };
}
// 納品を実行: 手持ちから1つ消費し、品の格に応じた魂を授かる。
// 受けた依頼のほか、掲示板の依頼もその場で納められる (受けてすぐ納めるので、受注の枠は使わない)。
// opts.buy = 手持ちが無い時、商会の棚から買ってそのまま納める (袋は経由しないので所持枠は要らない)
function deliverQuest(q, opts = {}) {
  if (!facilityOpenKey("tavern")) return false;
  const s = questState();
  if (!q || q.type !== "deliver") return;
  const from = s.active.includes(q) ? s.active : (s.board || []).includes(q) ? s.board : null;
  if (!from) return;
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
  from.splice(from.indexOf(q), 1);
  finishFreeQuest(q, {}, grantRewardSouls([[rarity, count]]), `「${it.name}」を納品`);
}

// 噂は無料。帰還時に更新し、酒場の出入り・時間経過では引き直さない。
function refreshRumor() {
  G.activeRumor = null;
  G.rumor = featureUnlocked("tavern") ? rollRumor() : null;
}
// 解放直後・旧セーブで噂が無い時だけ補う。描画からは次のマイクロタスクで呼ぶ。
function ensureRumor() {
  if (G.state !== "town" || !featureUnlocked("tavern") || G.rumor) return false;
  G.rumor = rollRumor();
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
// 受領した勲章の数は「やり込みの度合い」を表す指標なので、早いうちに枯れないよう、どの系統も段が尽きない:
//  ・回数の系統 (出撃・撃破・宝箱…) は手書きの段の先も、決まった刻み (more) で段が延々と続く
//  ・中身の数の系統 (迷宮・魔物・品・出来事・主…) も刻みで続き、迷宮や魔物が増えれば届く段が増える
//  ・「迷宮ごと・魔物ごと・職業ごと」の極め (N回踏破した迷宮の数 / N体倒した魔物の種類 / ランクNの職業の数) は
//    中身が増えるほど伸びしろが広がる
// 系統 (series) = 段の並び。勲章の間には系統ごとに「次の段」だけを1枠で出す。cond は毎回評価する純粋関数なので
// 追跡用の状態は不要 (G.ach は受領済みの段の ID だけを記録)。ID はセーブに残るため変更禁止:
// 手書きの段は旧来の ID、刻みで延びた段は `${系統}#${k}` (k = 手書きの最後の段から数えた番号)。
//
// 報酬の物差し: 迷宮の初踏破の報告 (msqReward) が 100〜350G・赤い魂 2〜10、第1章の迷宮をひと通り潜って得る金貨が 1万G ほど。
// 序盤の段は 30〜150G (赤い魂なし〜1)、第1章の終わり頃に届く段で 300G・赤い魂2〜3、その先の段で 500G〜・赤い魂 3〜15。
// 刻みで延びた段は、手書きの最後の段の報酬を k ごとに +30% (金貨・✦Soul)、赤い魂は +1 ずつ (上限 ACH_RED_CAP。最後の段がそれを越えていれば据え置き)。
const ACH_SERIES = [];
const ACH_GROW = 0.3;
const ACH_RED_CAP = 20;
const KANJI_D = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
// 1〜9999 を漢数字に (段の名前「〜・其の十二」用)
function kanjiNum(n) {
  n = Math.max(1, Math.floor(n));
  let s = "";
  for (const [u, c] of [[1000, "千"], [100, "百"], [10, "十"]]) {
    const d = Math.floor(n / u) % 10;
    if (d) s += (d > 1 ? KANJI_D[d] : "") + c;
  }
  return s + KANJI_D[n % 10];
}
// 系統の第 i 段 (0 始まり)。尽きた系統は null。段は作るたびに覚えておく
function achTier(s, i) {
  if (s.tiers[i]) return s.tiers[i];
  const rows = s.rows();
  let row;
  if (i < rows.length) row = { ...rows[i] };
  else {
    if (!s.more || !rows.length) return null;
    const last = rows[rows.length - 1], k = i - rows.length + 1;
    const prev = achTier(s, i - 1);
    const v = s.more(prev.v, k);
    if (v == null) return null;
    const grow = (n) => (n ? Math.round(n * (1 + ACH_GROW * k) / 10) * 10 : 0);
    row = { v, name: `${last.name}・其の${kanjiNum(k + 1)}`, id: `${s.key}#${k}`,
      gold: grow(last.gold), red: last.red ? Math.max(last.red, Math.min(ACH_RED_CAP, last.red + k)) : 0, soul: grow(last.soul) };
  }
  const reward = {};
  if (row.gold) reward.gold = row.gold;
  if (row.red) reward.redSoul = row.red;
  if (row.soul) reward.soulPts = row.soul;
  const v = row.v;
  const t = { id: row.id, name: row.name, desc: s.desc(v), v, reward, series: s.key,
    cond: () => s.value() >= v, secret: !!(s.secret && s.secret(v)) };
  // 中身の総数で決まる系統 (職業の数など) は、総数が変わった時に作り直せるよう覚えない
  if (!s.dynamic) s.tiers[i] = t;
  return t;
}
// 系統の次の段 (受領していない最初の段)。全段を受領した有限の系統は {done:true, tier:最後の段}
function achNext(s) {
  for (let i = 0; i < 100000; i++) {
    const t = achTier(s, i);
    if (!t) return { done: true, i: i - 1, tier: achTier(s, i - 1) };
    if (!G.ach[t.id]) return { done: false, i, tier: t };
  }
  return { done: true, i: 0, tier: achTier(s, 0) };
}
{
  // series(key, rows, desc, value, opt)
  //   rows  = [しきい値, 称号, gold, redSoul, soulPts, id?][] (gold以降は省略可。id 省略時は opt.id(v))
  //   value = いまの値 (数) を返す関数。段は value() >= しきい値 で達成
  //   opt.more(v, k) = 手書きの段の先のしきい値 (前の段のしきい値 v → 次)。無ければ有限の系統
  //   opt.id(v) = 手書きの段の ID / opt.secret(v) = 達成するまで伏せる段 / opt.dynamic = 段を覚えない
  //   opt.flag = 一度きりの達成 (いまの値を出さない)
  const series = (key, rows, desc, value, opt = {}) => {
    const idOf = opt.id || ((v) => `${key}${v}`);
    const norm = (r) => ({ v: r[0], name: r[1], gold: r[2] || 0, red: r[3] || 0, soul: r[4] || 0, id: r[5] || idOf(r[0]) });
    const fixed = typeof rows === "function" ? null : rows.map(norm);
    ACH_SERIES.push({ key, desc, value, more: opt.more || null, secret: opt.secret || null, dynamic: !!opt.dynamic,
      flag: !!opt.flag, tiers: [], rows: fixed ? () => fixed : () => rows().map(norm) });
  };
  // 一度きりの勲章 (段は1つ)
  const once = (id, name, desc, cond, gold, red, soul) =>
    series(id, [[1, name, gold, red, soul, id]], () => desc, () => (cond() ? 1 : 0), { flag: true });
  const step = (n) => (v) => v + n;       // 一定の刻みで続く
  const dbl = (v) => v * 2;               // 倍々で続く (貯蔵)
  const allSouls = () => (G.souls || []);
  const monSeen = () => Object.keys(G.codex.mon).filter((k) => MONSTERS[k]).length;
  const itemSeen = () => Object.keys(G.codex.item).filter((k) => ITEMS[k]).length;
  const itemSeenOf = (rar) => Object.keys(G.codex.item).filter((k) => ITEMS[k] && ITEMS[k].rar === rar).length;
  const hybSeen = () => Object.keys(G.codex.job).filter((k) => SOUL_CLASSES[k]).length;
  const JOB_TOTAL = () => Object.keys(SOUL_CLASSES).length; // 全職業数 (いまは36)
  // 職業ごとの最高ランク / 最高Lv (同じ職の魂が複数あれば高い方)
  const jobsAtRank = (r) => new Set(allSouls().filter((s) => soulRankFromCount(s.clsKey, s.count) >= r).map((s) => s.clsKey)).size;
  const jobsAtLv = (lv) => new Set(allSouls().filter((s) => (s.level || 1) >= lv).map((s) => s.clsKey)).size;
  // 職業の数の段: 指定の段のうち総数未満のもの + 総数ちょうど (最後の段は総数に合わせて動き、達成まで伏せる)
  // (最後の段の旧ID は総数が36の時だけ。職業が増えたら総数ごとの新しい段になる)
  const jobRows = (list, lastName, lastRw, lastId) => () => {
    const T = JOB_TOTAL();
    const last = [T, lastName, ...lastRw];
    while (last.length < 5) last.push(0);
    if (lastId && T === 36) last.push(lastId);
    return [...list.filter((r) => r[0] < T), last];
  };
  const jobOpt = (key) => ({ id: (v) => `${key}_${v}`, dynamic: true, secret: (v) => v >= JOB_TOTAL() });
  const monKilledAtLeast = (n) => Object.keys(G.codex.mon).filter((k) => MONSTERS[k] && (G.codex.mon[k].kills || 0) >= n).length;
  const dunClearedAtLeast = (n) => { const c = worldState().cleared; return DUNGEONS.filter((d) => (c[d.id] || 0) >= n).length; };
  const eventsSeen = () => Object.keys((G.events && G.events.seen) || {}).length;

  // 極の遭遇回数。既存の seen を使い、種類数とは別に累計する (同じマスの再表示は seen が抑止)。
  const mythicEncounters = () => Object.entries(G.events?.seen || {}).reduce((n, [id, count]) =>
    n + (EVENT_MAP[id]?.tier === "mythic" ? count : 0), 0);

  // ── 探索 ──
  // 出撃回数
  series("run", [
    [1, "初陣", 30], [10, "迷宮通い", 100], [25, "迷宮の住人", 150, 1], [50, "深淵の常連", 300, 2],
    [100, "百度参り", 600, 3], [200, "迷宮に魅入られた者", 1200, 5], [500, "帰らずの探索者", 3000, 10],
  ], (v) => `迷宮に ${v}回 潜る`, () => G.stats.runs, { more: step(250) });

  // 到達最深階 — 帰還の門 (5階ごと) に合わせた節目。20階より先は奈落か、これから増える深い迷宮で
  series("deep", [
    [5, "底知らず", 50], [10, "闇の淵", 150, 1], [15, "光の届かぬ場所", 250, 2],
    [20, "闇に溶ける者", 500, 3], [30, "奈落の踏破者", 1000, 5], [50, "底なき底", 2000, 10],
  ], (v) => `B${v}F に到達する`, () => G.stats.deepest, { more: step(25) });

  // 迷宮踏破 (旧ID互換のため id は dun{踏破数+1})。初踏破は王への報告でも報われるので、勲章は節目の上乗せ
  series("dun", [
    [1, "最初の踏破", 100], [5, "五つの迷宮", 300, 3], [10, "十の迷宮を越えて", 500, 5], [20, "異界の旅人", 800, 5],
    [30, "迷宮の覇者", 1200, 8], [40, "迷宮の地図屋", 1500, 8], [50, "五十の碑", 2000, 10],
    [60, "深層の覇者", 2500, 10], [70, "終わりの始まり", 3000, 12], [80, "終末の歩み", 3500, 12],
    [90, "冥府の門前", 4000, 15], [100, "百の迷宮を越えし者", 5000, 15],
  ], (v) => `迷宮を ${v} 踏破する`, () => clearedDungeonCount(), { id: (v) => `dun${v + 1}`, more: step(10) });

  // 迷宮ごとの極め — 同じ迷宮を何度も踏破する (迷宮が増えるほど伸びしろが広がる)
  series("dr3_", [
    [1, "通い慣れた道", 80], [3, "勝手知ったる迷宮", 200, 1], [5, "迷宮の古株", 400, 2], [10, "地図いらず", 800, 4],
  ], (v) => `3回以上 踏破した迷宮を ${v}つ にする`, () => dunClearedAtLeast(3), { more: step(5) });
  series("dr10_", [
    [1, "迷宮を極めし者", 300, 2], [3, "庭のごとく", 600, 3], [5, "迷宮の番人", 1000, 5], [10, "迷宮に棲む者", 2000, 8],
  ], (v) => `10回以上 踏破した迷宮を ${v}つ にする`, () => dunClearedAtLeast(10), { more: step(5) });

  // 宝箱開封
  series("chest", [
    [10, "宝箱漁り", 50], [50, "財宝の嗅覚", 150, 1], [200, "蔵荒らし", 400, 3], [500, "宝箱の王", 1000, 6],
  ], (v) => `宝箱を ${v}回 開ける`, () => G.stats.chests || 0, { more: step(500) });

  // 罠解除 — 盗賊の見せ場
  series("disarm", [
    [10, "罠外し", 60], [50, "罠師の目", 200, 1], [150, "罠殺し", 500, 3], [400, "全ての罠を見抜く者", 1200, 6],
  ], (v) => `罠を ${v}回 解除する`, () => G.stats.trapsDisarmed || 0, { more: step(400) });

  // 罠の被害 — 痛い目を見た数だけ語れる (踏むほど得をしないよう控えめに)
  series("trapped", [
    [10, "うっかり者", 50], [50, "痛みを知る者", 150], [150, "罠の常連", 300, 1],
  ], (v) => `罠を ${v}回 踏み抜く`, () => G.stats.trapsSprung || 0, { more: step(150) });

  // 出来事 (見聞録) — 迷宮の出来事に出会った種類 (出来事が増えるほど伸びる)
  series("ev", [
    [5, "噂を確かめる者", 60], [10, "見聞の徒", 150], [20, "迷宮の語り部", 300, 1], [30, "奇談の収集家", 500, 2],
    [50, "見聞録の主", 1000, 4],
  ], (v) => `迷宮の出来事に ${v}種 出会う`, eventsSeen, { more: step(10) });

  // ── 戦い ──
  // 撃破数
  series("kill", [
    [50, "首狩り", 50], [250, "戦場の影", 150, 1], [1000, "千の骸", 400, 3], [2500, "屍山血河", 800, 5],
    [5000, "千殺の操霊師", 1500, 8, 0, "kill5k"], [10000, "万骨の上に立つ者", 3000, 15],
  ], (v) => `敵を ${v}体 倒す`, () => G.stats.kills, { more: step(5000) });

  // 魔物ごとの極め — 同じ種類を何体も倒す (魔物が増えるほど伸びしろが広がる)
  series("mk10_", [
    [10, "狩りの手ほどき", 80], [25, "狩人の目", 200, 1], [50, "魔物狩りの名手", 400, 2], [100, "百種狩り", 800, 4],
    [150, "群れを散らす者", 1200, 5], [200, "異形を狩り尽くす者", 1600, 6],
  ], (v) => `10体以上 倒した魔物を ${v}種 にする`, () => monKilledAtLeast(10), { more: step(50) });
  series("mk100_", [
    [1, "宿敵", 150, 1], [5, "天敵", 400, 2], [10, "根絶やしの刃", 800, 4], [25, "種を絶つ者", 1500, 6], [50, "百鬼の天敵", 2500, 10],
  ], (v) => `100体以上 倒した魔物を ${v}種 にする`, () => monKilledAtLeast(100), { more: step(25) });

  // 主討伐 — 同じ主を何度討っても数える
  series("boss", [
    [1, "主殺し", 100, 1], [5, "玉座荒らし", 250, 2], [10, "玉座のさんだつ者", 400, 3],
    [20, "主喰らい", 800, 5], [50, "王なき迷宮", 1500, 8], [100, "玉座の墓守", 3000, 15],
  ], (v) => `迷宮の主を ${v}体 討つ`, () => G.stats.bossKills, { more: step(50) });

  // 主の種類 — 迷宮の主を種類で数える (主のいる迷宮が増えるほど伸びる)
  series("lboss", [
    [3, "主の覇者", 300, 3], [7, "幾多の主を討つ者", 700, 5], [13, "玉座の収集家", 1500, 8], [20, "深淵の玉座を統べる者", 3000, 15],
  ], (v) => `迷宮の主を ${v}種 討伐する`, () => Object.keys(G.stats.bossIds || {}).length, { more: step(5) });

  // 精鋭撃破
  series("elite", [
    [1, "強敵狩り", 100], [10, "猛者を退ける者", 300, 2], [30, "強敵殺し", 600, 3], [100, "強者の墓標", 1500, 6],
  ], (v) => `強敵を ${v}体 倒す`, () => G.stats.elites || 0, { more: step(100) });

  // 名のある強敵 — 討った種類 (層が増えるほど伸びる)。首級は持ち帰らなくても、討てば数える
  series("named", [
    [1, "賞金首を討つ者", 150, 1], [3, "名を刈る者", 400, 2], [6, "賞金稼ぎの鑑", 900, 4], [10, "名のある者の墓標", 2000, 8],
  ], (v) => `名のある強敵を ${v}種 討つ`, () => NAMED_IDS.filter((id) => codexKills(id) > 0).length, { more: step(5) });

  // 宿敵の再戦 (第九章の結びで開く) — 記憶に勝った回数 / 観客の注文 (第九章の迷宮の掟) に応えた回数
  series("rematch", [
    [1, "記憶の挑戦者", 200, 1], [5, "砂上の常連", 500, 2], [15, "闘技場の花形", 1200, 4], [30, "不敗の記憶", 2400, 8],
  ], (v) => `宿敵の再戦で ${v}回 勝つ`, () => G.stats.rematchWins || 0, { more: step(25) });
  series("audience", [
    [1, "観客の喝采", 100], [10, "見世物の名手", 400, 2], [30, "満場の喝采", 1000, 4],
  ], (v) => `観客の注文に ${v}回 応える`, () => G.stats.audience || 0, { more: step(30) });

  // 無限迷宮 (第八章の結びで開く。開くまでは伏せる) — docs/infinite-affixes.md 5章。数えは G.stats.inf (infStats)
  {
    const iv = (k) => () => infStats()[k] || 0;
    const io = { secret: () => !featureUnlocked("infinite"), dynamic: true }; // 開いた後に伏せを外すため段を覚えない
    series("infDeep", [
      [5, "風だまりへ", 60], [10, "淵の底へ", 120, 1], [20, "深みの旅人", 250, 1], [30, "深淵の探り手", 400, 2],
      [40, "底を目指す者", 600, 2], [50, "深淵の主", 900, 3],
    ], (v) => `${INF_NAME}の B${v}F に着く`, iv("deepest"), { ...io, more: step(10) });
    series("infBoss", [
      [1, "風だまりの勝者", 60], [5, "主狩りの器", 200, 1], [10, "主を退ける者", 400, 2], [25, "風の覇者", 800, 3], [50, "主殺しの器", 1500, 5],
    ], (v) => `${INF_NAME}の主を ${v}体 倒す`, iv("bosses"), { ...io, more: step(25) });
    series("infRun", [
      [1, "欠片の器", 30], [5, "器を継ぐ者", 100], [10, "繰り返す挑戦", 200, 1], [25, "飽くなき降下", 400, 2], [50, "風の常連", 800, 3],
    ], (v) => `${INF_NAME}へ ${v}回 出撃する`, iv("runs"), { ...io, more: step(50) });
    series("infHome", [
      [1, "生きて帰る", 80], [5, "引き際を知る者", 250, 1], [10, "帰還の名手", 500, 2], [25, "風を背に帰る者", 1000, 3],
    ], (v) => `主を倒した後に「帰る」を ${v}回 選ぶ`, iv("homeRets"), { ...io, more: step(25) });
    series("infSouls", [
      [10, "欠片拾い", 80], [50, "魂の運び手", 250, 1], [100, "魂の収穫者", 500, 2], [250, "魂の大河", 1000, 4],
    ], (v) => `${INF_NAME}から魂を ${v}個 持ち帰る`, iv("soulsHome"), { ...io, more: step(250) });
    series("infRare", [
      [1, "稀なる欠片", 100, 1], [5, "輝く魂を拾う者", 300, 2], [10, "英雄の魂を知る者", 600, 3], [25, "伝説を集める者", 1200, 5],
    ], (v) => `${INF_NAME}でエピック・レジェンドの魂を ${v}個 拾う`, iv("rareSouls"), { ...io, more: step(25) });
    series("infAfx", [
      [1, "秘宝の気配", 80], [5, "秘宝を拾う者", 250, 1], [10, "秘宝の目利き", 500, 2], [25, "秘宝の山", 1000, 3],
    ], (v) => `秘・極の特性の付いた品を ${v}点 拾う`, iv("rareAfx"), { ...io, more: step(25) });
    series("infTrade", [
      [10, "回収人の客", 60], [50, "回収人のなじみ", 200, 1], [100, "回収人の上客", 400, 2], [250, "回収人の相棒", 800, 3],
    ], (v) => `回収人と ${v}回 売り買いする`, iv("trades"), { ...io, more: step(250) });
    series("infJobs", [
      [3, "器の顔ぶれ", 60], [6, "多彩な器", 150, 1], [10, "器を選ぶ目", 300, 1], [15, "百職の器", 500, 2], [20, "器の名匠", 800, 3],
    ], (v) => `最初の魂に ${v}種の職を選ぶ`, () => Object.keys(infStats().jobs).filter((k) => SOUL_CLASSES[k]).length, { ...io, more: step(5) });
    series("infClean", [
      [1, "欠けぬ隊", 100, 1], [5, "誰も欠けずに", 300, 2], [10, "揃って勝つ隊", 600, 3], [25, "不落の器", 1200, 5],
    ], (v) => `誰も砕けずに${INF_NAME}の主を ${v}体 倒す`, iv("clean"), { ...io, more: step(25) });
  }

  // ミミック撃破
  series("mimic", [
    [1, "化け箱殺し", 80], [10, "擬態の天敵", 300, 2], [50, "ミミックの宿敵", 1000, 5],
  ], (v) => `ミミックを ${v}体 倒す`, () => G.stats.mimics || 0, { more: step(50) });

  // 金属の魔物 (銀業・金業・銀業の王) — 逃げ去ったものは数えない
  series("metal", [
    [1, "銀を砕く者", 150, 1], [10, "銀業狩り", 500, 3], [30, "白銀の狩人", 1000, 5], [100, "銀業の天敵", 2500, 10],
  ], (v) => `金属の魔物を ${v}体 倒す`, () => G.stats.metals || 0, { more: step(50) });

  // 喪失 — 敗北の数だけ強くなる (慰めの品。砕けるほど得をしないよう控えめに)
  series("death", [
    [1, "初めての喪失", 30], [10, "不屈の心", 100], [25, "砕けても なお", 200, 1],
    [50, "屍を越えて", 400, 2], [100, "喪失の果てに", 800, 3],
  ], (v) => `人業が ${v}体 砕ける`, () => G.stats.deaths, { more: step(100) });

  // ── 収集 ──
  // モンスター図鑑 — 迷宮ひとつで 6〜12種 に出会う
  series("mon", [
    [10, "魔物の観察者", 50], [30, "魔物の目利き", 150, 1], [60, "魔物学の徒", 300, 2],
    [100, "深淵の博物学者", 600, 4], [150, "異形の語り部", 1200, 6], [250, "百鬼を記す者", 2000, 10],
  ], (v) => `モンスター図鑑 ${v}種`, monSeen, { more: step(50) });

  // アイテム図鑑
  series("item", [
    [25, "目利き見習い", 80], [50, "収集家", 150, 1], [100, "蔵の主", 300, 2],
    [150, "宝物庫の主", 500, 3], [250, "伝説の収集家", 1000, 5], [350, "千の宝を知る者", 2000, 10],
  ], (v) => `アイテム図鑑 ${v}種`, itemSeen, { more: step(100) });

  // スーパーレア / レジェンドレアの図鑑 (LR はスーパーレアの1/3の割合で落ちる。いつまでも少しずつ届く)
  series("sr", [
    [3, "橙の輝き", 150, 1], [10, "名品の目利き", 400, 2], [25, "名品の収集家", 800, 4], [50, "百名品の主", 1500, 6],
  ], (v) => `スーパーレアの品を ${v}種 図鑑に記す`, () => itemSeenOf("sr"), { more: step(25) });
  series("lr", [
    [1, "伝説との出会い", 300, 3], [3, "伝説を携える者", 800, 5], [5, "伝説の担い手", 1500, 8], [10, "伝説を統べる者", 3000, 12],
  ], (v) => `レジェンドレアの品を ${v}種 図鑑に記す`, () => itemSeenOf("lr"), { more: step(5) });

  // 魂の回収
  series("soul", [
    [10, "魂集め", 80], [50, "魂の商人", 200, 1], [100, "千魂の器", 400, 2], [250, "魂の収集家", 800, 4],
    [500, "魂の大河", 1500, 8], [1000, "魂の海", 3000, 15],
  ], (v) => `魂を ${v}個 回収する`, () => G.stats.soulsFound, { more: step(500) });

  // 職業発現 — 最初の4体ぶんは始めから持っているので 6種から。最後の段は職業の総数 (達成まで伏せる)
  series("hyb", jobRows([
    [6, "職業の解放者", 100], [12, "職業の織り手", 250, 1], [18, "魂の錬金術師", 400, 2],
    [24, "異端の指導者", 700, 3], [30, "万職の祖", 1000, 5],
  ], "万魂の支配者", [2000, 10], "hyb36"), (v) => `${v}種の職業を発現させる`, hybSeen, { ...jobOpt("hyb"), id: (v) => `hyb${v}` });

  // ── 育成 ──
  // 魂のLv (キャラLv = 宿した魂のLv)。魂の残火で上限を上げれば 100 の先へも続く
  // 極めて稀なる出来事の遭遇 — 1/5/10/20、その先は10回ごと。
  series("evMythic", [
    [1, "初めての極の恵み", 60], [5, "五つの極の恵み", 150, 1],
    [10, "極の恵みを集める者", 300, 2], [20, "極の恵みの継ぎ手", 600, 3],
  ], (v) => `極めて稀なる出来事に ${v}回 遭遇する`, mythicEncounters, { more: step(10) });

  series("lv", [
    [10, "駆け出しの職人", 50, 0, 0, "jlv10"], [20, "熟練の域", 150, 1, 0, "jlv20"], [30, "達人の域", 300, 2, 0, "jlv30"],
    [40, "名人の域", 600, 3, 0, "jlv40"], [50, "神域", 1000, 5, 0, "jlv50"],
    [70, "限界の先へ", 1500, 6, 0, "slv70"], [100, "魂の深奥", 3000, 10, 0, "slv100"],
  ], (v) => `魂を Lv${v} まで育てる`, () => allSouls().reduce((m, s) => Math.max(m, s.level || 1), 0), { more: step(10) });

  // 職業ランク — ランクR以上に育てた職業の種類で数える (魂の所持数 → ランク。宿していない魂も数える)。
  // 段はランク2〜5で共通 (RANK_STEPS)、その先も5種ずつ続く (職業はこれからも増えるので、いまの職業数を越える段も置く)。
  // 旧 jrank3/4/5 (その段の人業を持つ) と await6 は同じ段階表の1段として ID を残す (消した await18/awakeAll/rank2j24 は受領済みとして残るだけ)
  const RANK_STEPS = [1, 2, 3, 4, 5, 6, 10, 15, 20, 25, 30, 35, 40, 45, 50];
  const OLD_RANK_ID = { "2:6": "await6", "3:1": "jrank3", "4:1": "jrank4", "5:1": "jrank5" };
  // rows = RANK_STEPS と同じ並びの [称号, gold, redSoul, soulPts]
  const rankSeries = (r, rows) => {
    if (rows.length !== RANK_STEPS.length) throw new Error(`rankSeries(${r}): 段の数が RANK_STEPS と合わない`);
    series(`rank${r}`, rows.map((row, i) => [RANK_STEPS[i], ...row]),
      (v) => `${v === 1 ? "ひとつの" : `${v}種の`}職業をランク${r}${r < 5 ? "以上" : ""}にする`,
      () => jobsAtRank(r), { id: (v) => OLD_RANK_ID[`${r}:${v}`] || `rank${r}j${v}`, more: step(5) });
  };
  rankSeries(2, [ // 覚醒
    ["目覚めの魂", 50], ["ふたつの覚醒", 80], ["三魂の覚醒", 120], ["四魂の覚醒", 150, 1], ["五魂の覚醒", 200, 1],
    ["六魂の覚醒", 300, 2], ["十魂の覚醒", 500, 3], ["十五魂の覚醒", 800, 4], ["二十魂の覚醒", 1000, 5, 200],
    ["二十五魂の覚醒", 1300, 6, 250], ["三十魂の覚醒", 1600, 7, 300], ["三十五魂の覚醒", 2000, 8, 400],
    ["四十魂の覚醒", 2500, 10, 500], ["四十五魂の覚醒", 3000, 12, 600], ["万魂覚醒の祖", 3500, 15, 700],
  ]);
  rankSeries(3, [
    ["位階を昇る者", 150, 1], ["ふたつの位階", 250, 1], ["三つの位階", 400, 2], ["四つの位階", 500, 2], ["五つの位階", 700, 3],
    ["六つの位階", 800, 3], ["十の位階", 1200, 5], ["十五の位階", 1800, 6], ["位階の殿堂", 2500, 8, 300],
    ["二十五の位階", 3000, 9, 350], ["三十の位階", 3500, 10, 400], ["三十五の位階", 4000, 12, 500],
    ["四十の位階", 5000, 14, 600], ["四十五の位階", 5500, 16, 700], ["位階の頂", 6000, 20, 800],
  ]);
  rankSeries(4, [
    ["高位の操霊師", 400, 3], ["高位の双璧", 700, 4], ["三柱の高位", 1000, 5], ["高位の四天", 1200, 5], ["高位の五柱", 1500, 6, 200],
    ["高位の六柱", 1700, 7, 200], ["高位の十傑", 3000, 10, 400], ["高位の十五柱", 4000, 12, 500], ["高位の二十柱", 5000, 14, 600],
    ["高位の二十五柱", 6000, 16, 700], ["高位の三十柱", 7000, 18, 800], ["高位の三十五柱", 8000, 20, 900],
    ["高位の四十柱", 9000, 22, 1000], ["高位の四十五柱", 10000, 25, 1100], ["高位の五十柱", 12000, 30, 1200],
  ]);
  rankSeries(5, [
    ["極みに至る者", 1000, 6], ["双極の操霊師", 1500, 8], ["三極の操霊師", 2000, 10, 200], ["四極の操霊師", 2500, 11, 300],
    ["五極の操霊師", 3000, 12, 400], ["六極の操霊師", 3500, 13, 450], ["十の極み", 5000, 20, 800], ["十五の極み", 7000, 24, 1000],
    ["二十の極み", 9000, 28, 1200], ["二十五の極み", 11000, 32, 1400], ["三十の極み", 13000, 36, 1600],
    ["三十五の極み", 15000, 40, 1800], ["四十の極み", 17000, 45, 2000], ["四十五の極み", 19000, 50, 2200], ["五十の極み", 22000, 60, 2500],
  ]);
  // Lv100 に届いた職業の数 (職業ランクと同じ段で、その先も5種ずつ続く)
  series("jl100", [
    [1, "百の頂", 1000, 5], [2, "ふたつの頂", 1500, 5], [3, "三つの頂", 2000, 6], [4, "四つの頂", 2500, 6], [5, "五つの頂", 3000, 7],
    [6, "六つの頂", 3500, 8], [10, "十の頂", 5000, 10], [15, "十五の頂", 7000, 12], [20, "二十の頂", 9000, 14],
    [25, "二十五の頂", 11000, 15], [30, "三十の頂", 13000, 16], [35, "三十五の頂", 15000, 17], [40, "四十の頂", 17000, 18],
    [45, "四十五の頂", 19000, 19], [50, "五十の頂", 22000, 20],
  ], (v) => (v === 1 ? "職業の魂を Lv100 まで育てる" : `${v}種の職業の魂を Lv100 まで育てる`), () => jobsAtLv(100),
  { id: (v) => `jl100_${v}`, more: step(5) });

  // 魂の融合
  series("fuse", [
    [1, "はじめての融合", 50], [10, "魂の鍛冶", 200, 1], [50, "融合の達人", 600, 3], [150, "魂を束ねる者", 1500, 6],
  ], (v) => `魂を ${v}回 融合する`, () => G.stats.fusions || 0, { more: step(100) });

  // 依頼の達成 — 酒場のクエスト (帰るたびに掲示板が貼り替わるので、数は伸びやすい)
  series("quest", [
    [5, "駆け出しの請負人", 80], [25, "酒場の常連", 250, 1], [75, "万能の請負人", 600, 3], [200, "伝説の請負人", 1500, 6],
  ], (v) => `依頼を ${v}件 達成する`, () => G.stats.questsDone || 0, { more: step(100) });

  // ── 蓄え ── (受領時にも所持数を再判定する。倍々で続く)
  series("gold", [
    [1000, "小金持ち", 0, 1], [5000, "商人の財布", 0, 2], [20000, "貴族の財", 0, 4], [100000, "王より富める者", 0, 10],
  ], (v) => `所持金 ${v}G を貯める`, () => G.gold, { more: dbl });
  series("sp", [[500, "魂の貯蔵庫", 50], [5000, "魂の泉", 300, 2]],
    (v) => `✦Soul を ${v} 貯める`, () => G.soulPts, { more: dbl });
  series("rs", [[100, "赤の収集者", 200], [500, "緋色の王", 1000]],
    (v) => `赤い魂を ${v} 集める`, () => G.redSoul, { more: dbl });

  // ── 一度きり ──
  once("party6", "六人の隊列", "人業 6体 で編成する", () => G.party.length >= 6, 200);
  once("swiftBoss", "電光石火", "迷宮の主を 1ターン で討ち取る", () => !!G.stats.swiftBoss, 500, 3, 100);
  once("masterMimic", "黄金を喰らう者", "マスターミミックを討ち取る", () => !!G.stats.masterMimicSlain, 600, 3, 150);
  once("allElements", "六属を統べる者", "火・水・風・土・光・闇 すべての属性の敵を倒す",
    () => ["fire", "water", "wind", "earth", "light", "dark"].every((el) => G.stats.elemKills && G.stats.elemKills[el]), 400, 2, 100);
}

// 勲位: 受領した勲章の数で決まる位 (やり込みの度合い)。決まった位の先も「・其の二」…と続く
const MEDAL_RANKS = [[0, "無位"], [10, "銅章"], [25, "銀章"], [50, "金章"], [80, "白金章"], [120, "紅玉章"], [170, "蒼玉章"],
  [230, "翠玉章"], [300, "金剛章"]];
const MEDAL_RANK_STEP = 100;
function medalRank(n = Object.keys(G.ach || {}).length) {
  const last = MEDAL_RANKS[MEDAL_RANKS.length - 1];
  if (n < last[0]) {
    let i = 0;
    while (i + 1 < MEDAL_RANKS.length && MEDAL_RANKS[i + 1][0] <= n) i++;
    return { name: MEDAL_RANKS[i][1], next: MEDAL_RANKS[i + 1][0] - n, count: n };
  }
  const k = Math.floor((n - last[0]) / MEDAL_RANK_STEP);
  return { name: k ? `${last[1]}・其の${kanjiNum(k + 1)}` : last[1], next: last[0] + (k + 1) * MEDAL_RANK_STEP - n, count: n };
}

function claimAchievement(a) {
  if (G.ach[a.id] || !a.cond()) return;
  G.ach[a.id] = true;
  let msg = [];
  if (a.reward.gold) { G.gold += a.reward.gold; tlTown("gold", a.reward.gold, "a"); msg.push(`💰${a.reward.gold}`); }
  if (a.reward.redSoul) { grantRedSoul(a.reward.redSoul, "achievement"); msg.push(`🔴${a.reward.redSoul}`); }
  if (a.reward.soulPts) { G.soulPts += a.reward.soulPts; tlTown("soul", a.reward.soulPts, "a"); msg.push(`✦${a.reward.soulPts}`); }
  SFX.levelup(); buzz([0, 30, 60, 30]);
  flashScreen("#c9a22744");
  log(`勲章「${a.name}」を授かった！ (${msg.join(" + ")})`, "win");
  showToast(`🏅 勲章「${a.name}」獲得！`, { noLog: true });
  updateTopbar();
  renderTown();
}

// 勲章の札: 系統ごとに受領していない次の段だけを1枠に出す。全段を受領し終えた有限の系統は
// 最後の段を「受領済」として残す。並びは「拝受できる → 未達成 → 受領済」(同順位は定義順)
function achievementCards() {
  const cards = ACH_SERIES.map((s) => {
    const n = achNext(s);
    const a = n.tier;
    const ready = !n.done && a.cond();
    return { a, tier: n.i + 1, total: s.more ? Infinity : s.rows().length, allDone: n.done, ready,
      now: s.flag || n.done ? null : s.value() };
  });
  const ord = (c) => (c.allDone ? 2 : c.ready ? 0 : 1);
  return cards.sort((x, y) => ord(x) - ord(y));
}

// ---- 王宮: メインストーリー「百の迷宮と、魂の王」 (師を捜す物語) ----
// 迷宮を初めて踏破する → 王宮で報告し報酬と物語 → 条件を満たした迷宮が地図に現れる。
// 物語テキスト/報酬は story.js (章ごとの迷宮・物語マス・主の記憶・報告・館の語り)。
// G.msq は第0章 (人業の生成) の進みだけを持つ。迷宮の初踏破の報告・物語の節は G.world (上の「迷宮の地図」)

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
  lines = lines.map(t => storyText(t, G));
  G.prompt = true;
  const wrap = el("div", "confirm-overlay story-overlay");
  const card = el("div", "ig-card story-card");
  // 肖像 + 見出し
  const head = el("div", "story-head");
  const pf = el("div", "story-portrait");
  pf.appendChild(kingCanvas());
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

// 迷宮の初踏破を王に報告する: 報酬を下賜し、(物語の手がかりで) 新たな迷宮を地図に記す。
// 報告した数が節目なら機能解放のページを挟み (手ほどきへ)、章の最後の迷宮なら章の結びを語る
function reportMainQuest() {
  const w = worldState();
  const id = w.report;
  const cfg = worldById(id);
  if (prologueActive() && id === "w02" && prologuePhase() !== "abbeyQuest") { UI.enterMansion?.(); return; }
  if (!cfg) { w.report = null; renderTown(); return; }
  if (playBossMemory(id, reportMainQuest)) return;
  const clue = reportMissingClue();
  if (clue) { showToast(`「${clue.name}」を見つけてから、王に報告せよ`, { tone: "info" }); return; }
  const dollReward = prologueActive() && id === "w01";
  const r = dollReward ? { gold: 0, soulPts: 0, redSoul: 0 } : msqReward(cfg.lv, !!cfg.boss);
  const rwText = dollReward ? "王宮の倉庫に眠っていた人業 ×1（館のイレーヌへ）" : [{ cur: "gold", n: r.gold }, { cur: "soul", n: r.soulPts }, ...(r.redSoul ? [{ cur: "red", n: r.redSoul }] : [])];
  const rep = REPORTS[id] || { title: cfg.name, lines: ["「果たしたか。…見たものを、すべて話せ。」"] };
  // この報告で地図に現れる迷宮 (解放条件 reported:id) を、王の言葉の結びに添える
  const opens = DUNGEONS.filter((d) => !(prologueActive() && id === "w01") && !w.open[d.id] && d.unlock && (d.unlock.reported === id || (d.unlock.all && d.unlock.all.includes(id) && d.unlock.all.every((x) => x === id || w.reported[x]))));
  const reportLines = id === "w01" && !prologue() ? [...storyLines(rep.lines).slice(0, 2), "「次は亡骸の囁く回廊を調べよ。オルドの足跡も、さらに下へ続いておろう。」"] : storyLines(rep.lines);
  const lines = [...reportLines, ...opens.map((d) => `── 新たな迷宮「${d.name}」が地図に記された。`)];
  const toasts = [];
  // この報告で開く機能 (報告の前後で比べる)
  const after = { ...w, reported: { ...w.reported, [id]: 1 } };
  const newly = FEATURE_KEYS.filter((k) => !featureMet(k, w) && featureMet(k, after));
  const pages = [{
    title: rep.title, lines, reward: rwText, kicker: `踏破の報告 ― ${cfg.name}`, photo: id === "w01" ? null : storyImage("report_" + id),
    leave: () => {
      if (w.reported[id]) return;
      G.gold += r.gold;
      G.soulPts += r.soulPts;
      tlTown("gold", r.gold, "r"); tlTown("soul", r.soulPts, "r");
      grantRedSoul(r.redSoul || 0, "report");
      w.reported[id] = 1;
      if (prologueActive() && id === "w01") prologue().phase = "fifth";
      if (prologueActive() && id === "w02") prologue().phase = "abbey";
      w.report = null;
      w.last = { kind: "report", id };
      for (const key of Object.keys(LATE_CLUES)) if (STORY_CELLS[key].dungeon === id && w.found[key]) w.told[key] = 1; // 報告の文で語った
      SFX.itemget(); buzz([0, 30, 60, 30]);
      log(`「${cfg.name}」の踏破を報告した。`, "win");
      updateTopbar();
      toasts.push({ text: dollReward ? "王宮の人業を受け取った。イレーヌのもとへ" : `受け取った 💰${r.gold} ✦${r.soulPts}` + (r.redSoul ? ` 🔴${r.redSoul}` : ""), opts: { tone: "gold" } });
      for (const d of refreshWorldUnlocks()) toasts.push({ text: `🗺 新たな迷宮「${d.name}」が地図に記された`, opts: { tone: "info" } });
      autosave(true);
    },
  }];
  // 機能の解放は、報告の直後に解放のページを挟む (同じ報告で2つ開くこともある)
  const scenes = newly.map(unlockSceneFor).filter(Boolean);
  for (const us of scenes) {
    pages.push({ title: us.title, lines: us.lines, kicker: "秘技の伝授",
      leave: () => { SFX.victory(); buzz([0, 40, 80, 40]); toasts.push({ text: "🔓 新たな技能を授かった", opts: { tone: "good" } }); } });
  }
  // 章の最後の迷宮: 章の結び
  const ch = CHAPTERS.find((c) => c.finale === id);
  const end = ch && CHAPTER_END[ch.no];
  if (end && !w.beats["ch" + ch.no + "_end"]) {
    pages.push({ title: end.title, lines: end.lines, kicker: "章の結び", who: "none", art: "candle", photo: storyImage("ch" + ch.no + "_end"), btnLabel: "物語を閉じる",
      leave: () => { w.beats["ch" + ch.no + "_end"] = 1; w.last = { kind: "chapter", no: ch.no }; flashScreen("#ffd84a"); autosave(true); } });
  }
  playMsqChain(pages, toasts, (scenes.length || prologueActive()) ? () => { if (UI.tutorialAfterReport) UI.tutorialAfterReport(); } : null);
}
// 旧来の入口 (次章の拝命)。迷宮は条件で地図に現れるので、拝命の手続きは無い
function acceptMainQuest() { renderTown(); }

// 章の結びの言葉 (公開している最後の章。次章は準備中)
function sealedLines() {
  const c = CHAPTERS[CHAPTERS.length - 1];
  return (CHAPTER_END[c.no] || { lines: [] }).lines;
}

// ---- 序章: 人業を3→4→5→6体と迎える。受領はmsqと共に保存する ----
const prologue = () => G.msq?.prologue || null;
const prologuePhase = () => prologue()?.phase || null;
const prologueActive = () => !!prologue() && prologuePhase() !== "done";
const PROLOGUE_JOBS = { fourth: "mage", fifth: "knight", sixth: "bishop" };
function prologueJob(phase = prologuePhase()) {
  // 更新前に授かった魂・育てた人業は変えず、不足している方の職を迎える。
  const gift = soulByUid(prologue()?.gifts?.[phase]);
  if (gift) return gift.clsKey;
  if (phase === "fifth" && allDolls().some(d => soulByUid(d.primary)?.clsKey === "knight") &&
      !allDolls().some(d => soulByUid(d.primary)?.clsKey === "mage")) return "mage";
  return PROLOGUE_JOBS[phase];
}
function prologueDollGoal() { return { three: 3, fourth: 4, fifth: 5, sixth: 6 }[prologuePhase()] || 0; }
function prologueCreateSouls() {
  const free = soulRepresentatives().filter(s => !soulWorn(s.uid));
  if (!prologueActive()) return free;
  const goal = prologueDollGoal();
  if (!goal || allDolls().length >= goal) return [];
  const jobs = prologuePhase() === "three" ? ["fighter", "priest", "thief"] : [prologueJob()];
  return free.filter(s => jobs.includes(s.clsKey));
}
function preparePrologueDoll() {
  const p = prologue(), phase = p?.phase, job = prologueJob(phase);
  if (!job || p.gifts?.[phase]) return;
  p.gifts ||= {};
  // 旧序章で下賜済みの未使用魂があれば引き継ぎ、重複して授けない。
  const soul = G.souls.find(s => s.clsKey === job && !soulWorn(s.uid)) || addSoulInstance(job);
  p.gifts[phase] = soul.uid;
  codexSweepJobs(); autosave(true);
}
function prologueAppraisalItem() { return prologue()?.staff || null; }
function preparePrologueAppraisal() {
  const p = prologue();
  if (!p || p.staff) return;
  // 物語の練習品は袋が満杯でも失わない。共有袋へ一度だけ預ける。
  p.staff = cloneItem("magicStaff", 50);
  p.staff.unidentified = true;
  G.party[0].items.push(p.staff);
  autosave(true);
}
function completePrologueTutorial(key) {
  const p = prologue();
  if (!p) return;
  const next = { createThree: ["three", "forest"], createFourth: ["fourth", "cryptQuest"],
    createFifth: ["fifth", "formation"], prologueFormation: ["formation", "corridorQuest"], createSixth: ["sixth", "appraise"], prologueAppraise: ["appraise", "abbeyQuest"] }[key];
  if (!next || p.phase !== next[0]) return;
  p.phase = next[1];
  G.msq.n = 1; G.msq.state = "world";
  announceNewDungeons(refreshWorldUnlocks());
  if (key === "createThree") G.dungeonIdx = worldIndexOf("w00_forest");
  autosave(true);
}
function prologueAudience() {
  const p = prologue(), phase = p?.phase;
  if (phase === "abbeyQuest") {
    if (!worldState().cleared.w02 || reportMissingClue("w02")) return departTo(worldIndexOf("w02"));
    return reportMainQuest();
  }
  if (!["cryptQuest", "corridorQuest"].includes(phase)) return;
  const crypt = phase === "cryptQuest";
  const lines = crypt ? TUT_FINALE : [
    "「五体の人業がそろったか。地下墓地の先、亡骸の囁く回廊を調べてほしい。」",
    "「オルドのランタンに残された言葉は、地下の水脈を指しておる。回廊の最深部まで進んでみよ。」",
  ];
  playMsqChain([{ title: crypt ? "地下墓地の調査" : "亡骸の囁く回廊へ", lines,
    reward: crypt ? [{ cur: "gold", n: 500 }] : null, kicker: "王の依頼",
    leave: () => {
      if (p.phase !== phase) return;
      p.phase = crypt ? "crypt" : "corridor";
      if (crypt) { G.gold += 500; tlTown("gold", 500, "r"); }
      announceNewDungeons(refreshWorldUnlocks());
      G.dungeonIdx = worldIndexOf(crypt ? "w01" : "w02");
      autosave(true);
    },
  }]);
}
function prologueObjective() {
  const phase = prologuePhase();
  if (!prologueActive() || !G.msq.granted) return null;
  if (phase === "abbeyQuest" && (!worldState().cleared.w02 || reportMissingClue("w02"))) return { key: "prologueReturn", text: "回廊に戻り、残る手がかりを調べて踏破する", act: "探索へ", kind: "gate", run: () => departTo(worldIndexOf("w02")) };
  const quest = { cryptQuest: "地下墓地の調査を王から受ける", corridorQuest: "亡骸の囁く回廊への依頼を受ける", abbeyQuest: "回廊の報告をし、修道院への依頼を受ける" }[phase];
  if (quest) return { key: "prologueQuest", text: quest, act: "王宮へ", kind: "palace", run: prologueAudience };
  const target = { forest: ["w00_forest", "三体で森の古屋へ行き、人業を連れ帰る"], crypt: ["w01", "四体で地下墓地の騒ぎの原因を調べる"], corridor: ["w02", "五体で亡骸の囁く回廊の最深部を調べる"], abbey: ["w03", "六体で朽ちた骸の修道院へ向かう"] }[phase];
  if (target && !reportPending()) return { key: "prologueDive", text: target[1], act: "出撃", kind: "gate", run: () => departTo(worldIndexOf(target[0])) };
  if (["three", "fourth", "fifth", "formation", "sixth", "appraise"].includes(phase)) return { key: "prologueMansion", text: "人業の館でイレーヌの手ほどきを受ける", act: "館へ", kind: "party", run: () => UI.enterMansion?.() };
  return null;
}
function tutDollCount() { return allDolls().filter(d => !d.isEmpty).length; }
function tutDollGoal() { return prologueDollGoal() || 3; }
function tutorialDollsReady() { return tutDollCount() >= tutDollGoal(); }
function grantTutorialGift() {
  const ms = G.msq;
  if (!ms || ms.granted) return;
  ms.granted = true; ms.stage = "three";
  ms.prologue = { phase: "three", gifts: {} };
  for (const job of ["fighter", "priest", "thief"]) addSoulInstance(job);
  codexSweepJobs(); SFX.itemget();
  log("戦士・僧侶・盗賊の魂を拝受した。", "win");
  autosave(true); renderTown();
}
function audienceTutorial() {
  UI.playStoryChain([{ title: "三つの魂", lines: TUT_INTRO, reward: [{ job: "fighter" }, { job: "priest" }, { job: "thief" }], photo: storyImage("arrival"), kicker: "着任の謁見" }], () => {
    landOnHub(); grantTutorialGift(); UI.tutorialAfterReport?.();
  });
}
// 旧来の王宮UI・再開の入口も、新しい依頼へつなぐ。
function reportTutorialQuest() { return prologueAudience(); }

// 機能解放: 章 (story.js CHAPTERS) と、その章で王に報告した本筋の迷宮の数で決める (節目の報告で王から授かる)。
//   第一章は入門なので4つ、第二章からは1章に1つ (docs/tasks.md U1)。report = その章で報告した数 / "finale" = 章の結びの迷宮。
//   報告の総数で決めないので、迷宮を回る順 (黒水の取水口を後回しにする等) に左右されない。
//   踏破しただけ (報告前) では開かない ― 解放のページ (story.js UNLOCKS) を見てから使えるようにする。
//   まだ無い章の分 (第四章のサブ魂2枠・第五章の奈落) は、その章が台帳に載るまで開かない
const FEATURES = {
  tavern: { chapter: 1, report: 4 },        // 第一章の本筋4か所の報告で、依頼と情報屋の噂が一緒に開く
  soulChange: { chapter: 1, dungeon: "w02" }, // 第二の迷宮の報告後に手ほどき
  fusion: { chapter: 1, report: 2 },          // 魂の融合
  sub1: { chapter: 1, report: 3 },            // サブ魂 1枠
  rumor: { chapter: 1, report: 4 },           // 情報屋の噂 (酒場の掲示板)
  order: { chapter: 1, report: "finale" },    // 控えの結社 (席1)
  order2: { chapter: 2, report: 2 },          // 結社の席2
  order3: { chapter: 3, report: 2 },          // 結社の席3
  sub2: { chapter: 4, report: "finale" },     // サブ魂 2枠
  forge: { chapter: 5, report: "finale" },    // 鍛え直し (商会で金貨を払い、装備の品質を引き直す — 2026-10 ユーザーの指示)
  // ── 第六章から (docs/unlocks.md の年表。ユーザーの了解済み)。章がまだ無いので開かない。仕組みはその章を作る時に足す ──
  insight: { chapter: 6, report: "finale" }, // 操霊師の見識
  rusui: { retired: true, chapter: 6, report: "finale" },      // 留守居の修練 (席1。席の控えのメイン魂にも、戦闘で魂に入る経験値の一部が入る — 遠征の差し替え)
  rusui2: { retired: true, chapter: 7, report: "finale" },     // 留守居の修練の席2
  rusui3: { retired: true, chapter: 10, report: "finale" },    // 留守居の修練の席3
  order4: { chapter: 8, report: "finale" },     // 結社の席4
  // 無限迷宮 (入るたびに Lv1 の仮の器で潜るローグライク — docs/infinite-labyrinth.md)。第八章の結び (2026-10-11 ユーザーの指示:
  //   第八章のあたりで Lv100・ランク3〜4 に届き、本編の育ちが単調になってくるので、第十章から前倒し)
  infinite: { chapter: 8, report: "finale" },
  rematch: { chapter: 9, report: "finale" },    // 宿敵の再戦 (名のある強敵・主の強化版)
  enchant: { chapter: 11, report: "finale" },   // 付呪
  order5: { chapter: 12, report: "finale" },    // 結社の席5
  rebirth: { chapter: 14, report: "finale" },   // 魂の転生
  mutPick: { chapter: 15, report: "finale" },   // 異変を選ぶ
  vow: { chapter: 16, report: "finale" },       // 誓約
  sub3: { chapter: 17, report: "finale" },      // サブ魂 3枠
};
const FEATURE_KEYS = Object.keys(FEATURES).filter((key) => key !== "rumor" && !FEATURES[key].retired); // 噂の解放案内は酒場に統合 (旧キーは互換用に残す)
const chapterLabel = (no) => `第${kanjiNum(no)}章`;
// その章で王に報告した本筋の迷宮の数
function chapterReports(ch, w = worldState()) { return ch.dungeons.filter((id) => w.reported[id]).length; }
// 結びの迷宮を報告した章の数 (イレーヌの親しさ・章ごとの台詞が読む)
function chaptersDone(w = worldState()) { return CHAPTERS.filter((c) => w.reported[c.finale]).length; }
// w (worldState の形) の報告の状態で、その機能が開いているか (報告の前後を比べるために w を渡せる)
function featureMet(key, w = worldState()) {
  const f = FEATURES[key === "rumor" ? "tavern" : key];
  const ch = f && CHAPTERS.find((c) => c.no === f.chapter);
  if (!ch || f.retired) return false; // 廃止済み、またはその章がまだ無い
  if (f.dungeon) return !!w.reported[f.dungeon];
  return f.report === "finale" ? !!w.reported[ch.finale] : chapterReports(ch, w) >= f.report;
}
function featureUnlocked(key) {
  if (FEATURES[key]?.retired) return false;
  if (G.testPlay && Array.isArray(G.testUnlock) && G.testUnlock.includes(key)) return true; // 試遊の開発用 (URL の testUnlock=rusui など)
  if (key === "soulChange") return featureMet(key) && !!G.tut?.done?.soulChange;
  return featureMet(key);
}
// まだ開いていない機能の条件の説明 (錠の札・案内文)
function featureNote(key) {
  const f = FEATURES[key];
  if (!f) return "";
  const ch = CHAPTERS.find((c) => c.no === f.chapter);
  const label = chapterLabel(f.chapter);
  if (!ch) return `${label}で開く (準備中)`;
  if (f.dungeon) return `「${worldById(f.dungeon).name}」を踏破し、王に報告すると開く`;
  if (f.report === "finale") {
    const fin = worldById(ch.finale);
    return `${label}の結び「${fin ? fin.name : ch.finale}」を王に報告すると開く`;
  }
  return `${label}の迷宮を${f.report}つ王に報告すると開く (いま ${Math.min(chapterReports(ch), f.report)}/${f.report})`;
}
// 解放済みのサブ魂 (宿し技) スロット数 (0/1/2)。MAX_SUBS が上限
function unlockedSubSlots() {
  return Math.min(MAX_SUBS, featureUnlocked("sub2") ? 2 : featureUnlocked("sub1") ? 1 : 0);
}
// 控えの結社の席数 (0〜5)
function orderSeats() {
  return ["order5", "order4", "order3", "order2", "order"].reduce((n, k, i) => n || (featureUnlocked(k) ? 5 - i : 0), 0);
}
// 結社の席に実際に着いている魂uid (編成外・席数上限でクリーン)。
// G.order.picks の順を尊重しつつ、無効になった指定 (編成入り/消失) は除外する。
function orderSeatedUids() {
  if (abyssActive() || !featureUnlocked("order")) return []; // 無限迷宮の仮の器には結社の分け前を乗せない
  const seats = orderSeats();
  if (seats <= 0) return [];
  const fielded = new Set();
  for (const dd of G.party) { if (dd.primary != null) fielded.add(dd.primary); for (const s of (dd.subs || [])) if (s) fielded.add(s.uid); }
  const picks = (G.order && Array.isArray(G.order.picks)) ? G.order.picks : [];
  const out = [];
  for (const uid of picks) {
    if (out.length >= seats) break;
    if (out.includes(uid) || fielded.has(uid)) continue;
    if (!soulByUid(uid)) continue;
    out.push(uid);
  }
  return out;
}
// 結社の席が変わったら (着席・編成の入れ替え・魂の付け替え・席数の解放) 全員を再計算して、
// 席の魂の能力の分け前 (souls.js orderStatBonus) を付け直す。変わっていなければ何もしない
let orderSig = null;
function refreshOrderBonus() {
  const sig = orderSeatedUids().map((u) => { const s = soulByUid(u); return s ? `${u}:${s.count}:${s.level}` : u; }).join(",");
  if (sig === orderSig) return;
  orderSig = sig;
  recalcAllDolls();
}
// 結社の席に魂を着ける/外す。空席が無ければ着席不可
function toggleOrderSeat(uid) {
  if (!featureUnlocked("order")) return;
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
  refreshOrderBonus();
  autosave(); renderTown();
}
// 旧UI・旧セーブ向けの互換窓口。留守居の修練は操霊師の見識へ置き換えた。
function rusuiSeats() {
  return 0; // 廃止済み。旧セーブの席データは保持するが、育成・画面には使わない
}
// 席に就いている控えの人業 (G.rusui.picks の順・控えにいて魂の宿る者だけ・席数まで)。無限迷宮の間は誰も就かない
function rusuiSeated() {
  if (abyssActive()) return [];
  const seats = rusuiSeats();
  if (seats <= 0) return [];
  const picks = (G.rusui && Array.isArray(G.rusui.picks)) ? G.rusui.picks : [];
  const out = [];
  for (const uid of picks) {
    if (out.length >= seats) break;
    const d = G.reserve.find((x) => x && x.uid === uid);
    if (d && d.primary != null && !out.includes(d)) out.push(d);
  }
  return out;
}
// 留守居の席に就ける/外す。席が1つで埋まっていれば入れ替え、2つ以上で埋まっていれば断る
function toggleRusuiSeat(d) {
  if (!featureUnlocked("rusui") || !d || !G.reserve.includes(d)) return false;
  if (d.primary == null) { SFX.ng(); showToast("魂の宿らない器は、留守居に就けられない", { tone: "bad", noLog: true }); return false; }
  if (!G.rusui || !Array.isArray(G.rusui.picks)) G.rusui = { picks: [] };
  const seated = rusuiSeated();
  if (seated.includes(d)) {
    G.rusui.picks = seated.filter((x) => x !== d).map((x) => x.uid);
    showToast(`${d.name} を留守居の席から外した`, { tone: "info", noLog: true });
  } else if (seated.length >= rusuiSeats()) {
    if (rusuiSeats() !== 1) { SFX.ng(); showToast(`留守居の席が空いていない (${seated.length}/${rusuiSeats()})。誰かを外してから就ける`, { tone: "bad", noLog: true }); return false; }
    G.rusui.picks = [d.uid];
    showToast(`留守居を ${seated[0].name} から ${d.name} に替えた`, { tone: "good", noLog: true });
  } else {
    G.rusui.picks = [...seated.map((x) => x.uid), d.uid];
    showToast(`${d.name} を留守居の席に就けた`, { tone: "good", noLog: true });
  }
  SFX.select();
  autosave(); renderTown();
  return true;
}
// 踏破した迷宮の数 (台帳の迷宮のうち、一度でも踏破したもの)
function clearedDungeonCount() {
  const w = worldState();
  return DUNGEONS.filter((d) => w.cleared[d.id]).length;
}
// 王に初踏破を報告した迷宮の数 (機能解放の基準)。踏破して報告を待つ間は、その迷宮をまだ数えない
function reportedDungeonCount() {
  const w = worldState();
  return DUNGEONS.filter((d) => w.reported[d.id]).length;
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
// 次に追う物語の目標: 物語の順 (章の迷宮の並び) で、地図にあってまだ踏破していない最初の迷宮。
// すべて踏破済みなら、まだ現れていない迷宮の手がかり (解放条件) を示す
function storyGoal() {
  const w = worldState();
  const ch = currentChapter();
  for (const id of ch.dungeons) {
    const d = worldById(id);
    if (!d || !w.open[id] || w.cleared[id]) continue;
    const [a, b] = levelBand(d);
    const cell = Object.keys(STORY_CELLS).find((k) => STORY_CELLS[k].dungeon === id && !w.found[k]);
    return { kind: "dive", d, text: `師の足跡を追い、「${d.name}」を踏破する`,
      sub: `推奨 Lv${a}${b > a ? `〜${b}` : ""} ・ 全${d.floors}階${d.boss ? " ・ 主が待つ" : ""}${cell ? " ・ 師の手がかりがある" : ""}` };
  }
  for (const id of ch.dungeons) {
    const d = worldById(id);
    if (!d || w.open[id]) continue;
    return { kind: "hint", d, text: d.hint || "新たな迷宮の手がかりを探す", sub: "まだ地図にない迷宮" };
  }
  return null;
}
function objectiveInfo() {
  const ms = G.msq;
  if (!ms) return null;
  const w = worldState();
  // 解放された要素の手ほどき (済ませるまで迷宮には入れない)。踏破の報告が先
  const tut = (prologueActive() || !w.report) ? tutorialPending() : null;
  if (tut) return { key: "tut", text: tut.text, sub: `手ほどき「${tut.name}」・ 済ませるまで迷宮の門は閉ざされる`, act: tut.started ? "続ける" : "手ほどき", kind: "party", run: () => UI.tutorialResume && UI.tutorialResume() };
  const po = prologueObjective();
  if (po) return po;
  if (ms.n === 0) {
    if (!ms.granted) return { key: "audience", text: "王宮で王に謁見する", sub: "着任の挨拶", act: "謁見する", kind: "palace", run: audienceTutorial };
    return { key: "makeDoll", text: "人業の館で三体に魂を宿す", act: "館へ", kind: "party", run: goMakeDoll };
  }
  const clue = reportMissingClue();
  if (clue) return { key: "clue", text: `「${clue.name}」を見つける`, sub: `「${worldById(clue.dungeon).name}」の${clue.floor}階 ・ 王への報告に必要`, act: "探しに戻る", kind: "gate", run: () => departTo(worldIndexOf(clue.dungeon)) };
  if (reportPending()) return { key: "report", text: `「${worldById(w.report).name}」の踏破を王に報告する`, sub: "見たものを王に話す", act: "王に報告する", kind: "palace", run: reportMainQuest };
  const late = lateClue();
  if (late) return { key: "late", text: `「${STORY_CELLS[late].name}」のことを王に伝える`, sub: `「${worldById(STORY_CELLS[late].dungeon).name}」で見つけた師の手がかり`, act: "王に伝える", kind: "palace", run: tellLateClue };
  const ib = pendingIreneBeat();
  if (ib) return { key: "irene", text: ib.need ? "持ち帰ったものを、館のイレーヌに見せる" : "館のイレーヌのもとへ立ち寄る", sub: ib.title, act: "館へ", kind: "party", run: () => (UI.enterMansion ? UI.enterMansion() : UI.shell && UI.shell.setTab("party")) };
  if (contentSealed()) return { key: "sealed", text: "迷宮で人業を鍛え、装備を集める", sub: `${CHAPTERS[CHAPTERS.length - 1].next}は準備中`, act: "出撃", kind: "gate", run: () => departTo(null) };
  const g = storyGoal();
  if (!g) return { key: "free", text: "迷宮で人業を鍛え、装備を集める", act: "出撃", kind: "gate", run: () => departTo(null) };
  if (g.kind === "hint") {
    const tre = g.d.unlock && g.d.unlock.treasury;
    if (tre) return { key: "hint", text: g.text, sub: `奉納 ${totalDonatedKinds()}/${tre}種`, act: "宝物庫へ", kind: "palace", run: () => UI.openPalace && UI.openPalace("treasury") };
    return { key: "hint", text: g.text, sub: g.sub, act: "出撃", kind: "gate", run: () => departTo(null) };
  }
  return { key: "dive", text: g.text, sub: g.sub, act: "出撃", kind: "gate", run: () => departTo(worldIndexOf(g.d.id)) };
}
// 旧来の形 { text, go() } (呼び出し元の互換)
function currentObjective() {
  const o = objectiveInfo();
  return o ? { text: o.text, go: o.run } : null;
}

// 王宮に用があるか (初踏破の報告 / 第0章の謁見・報告)
function palaceCallReady() {
  const ms = G.msq;
  if (!ms) return false;
  if (prologueActive()) return !ms.granted || ["cryptQuest", "corridorQuest", "abbeyQuest"].includes(prologuePhase()) || (prologuePhase() === "crypt" && reportPending());
  if (ms.n === 0) return !ms.granted || tutorialDollsReady();
  return reportPending() || !!lateClue();
}

// 王宮の勅命の札の中身: { kind, head, text, note, replay:bool }
function decreeInfo() {
  const ms = G.msq;
  if (!ms) return { kind: "none", head: "", text: "", replay: false };
  const po = prologueObjective();
  if (po) return { kind: "active", head: "序章", text: po.text, note: "", replay: false };
  if (ms.n === 0) {
    if (!ms.granted) return { kind: "ch0", head: "着任", text: "玉座の老王が、オルドの弟子の到着を待っている。", replay: false };
    return { kind: "ch0", head: "三つの魂", text: "イレーヌから三体の人業を受け取り、戦士・僧侶・盗賊の魂を宿せ。", replay: true };
  }
  const w = worldState();
  const ch = currentChapter();
  const head = `第${["", "一", "二", "三", "四", "五"][ch.no] || ch.no}章 「${ch.title}」`;
  const clue = reportMissingClue();
  if (clue) return { kind: "active", head, text: `「${worldById(w.report).name}」は踏破したが、「${clue.name}」がまだ見つかっていない。`, note: `${clue.floor}階で手がかりを見つけてから、王に報告せよ。`, replay: true };
  if (reportPending()) return { kind: "report", head, text: `「${worldById(w.report).name}」を踏破した。`, note: "王に報告し、見たものを話せ。", replay: true };
  const late = lateClue();
  if (late) return { kind: "report", head, text: `「${worldById(STORY_CELLS[late].dungeon).name}」で、「${STORY_CELLS[late].name}」を見つけた。`, note: "王に伝え、見たものを話せ。", replay: true };
  if (contentSealed()) return { kind: "sealed", head: `${head} ── 完`, text: `${ch.nextNote || "その先は、まだ封じられている"}。封が解けるまで、人業を鍛えておけ。`, note: `${ch.next}は準備中。これまでの迷宮には何度でも挑める。`, replay: true };
  const g = storyGoal();
  const done = ch.dungeons.filter((id) => w.reported[id]).length;
  return { kind: "active", head, text: g ? g.text + "。" : "師の足跡を追え。", note: `章の迷宮 ${done}/${ch.dungeons.length} を報告済み`, replay: true };
}
// 王の言葉を聞き直す (状態は変えない): 最後に語られた物語のページ
function replayDecree() {
  const ms = G.msq || {};
  if (!ms.n) return UI.playStoryChain([{ title: "勅命 「人業の生成」", lines: TUT_INTRO, photo: storyImage("arrival"), kicker: "着任の謁見" }]);
  const last = worldState().last || {};
  if (last.kind === "chapter" && CHAPTER_END[last.no]) return UI.playStoryChain([{ title: CHAPTER_END[last.no].title, lines: CHAPTER_END[last.no].lines, kicker: "章の結び", who: "none", art: "candle", photo: storyImage("ch" + last.no + "_end") }]);
  if (last.kind === "late" && LATE_CLUES[last.key]) return UI.playStoryChain([{ title: LATE_CLUES[last.key].title, lines: storyLines(LATE_CLUES[last.key].lines), art: STORY_CELLS[last.key].art, photo: storyImage(last.key), kicker: "手がかりの報告" }]);
  if (last.kind === "report" && REPORTS[last.id]) return UI.playStoryChain([{ title: REPORTS[last.id].title, lines: storyLines(REPORTS[last.id].lines), photo: storyImage("report_" + last.id), kicker: "踏破の報告" }]);
  return UI.playStoryChain([{ title: "勅命 「人業の生成」 完遂", lines: TUT_FINALE, photo: storyImage("departure"), kicker: "勅命の完遂" }]);
}

// 王の記録 (戦績) と、その共有
function palaceRecords() {
  const s = G.stats;
  const pm = Math.floor((s.playMs || 0) / 60000);
  return [
    ["出撃", `${s.runs}回`], ["最深", `B${s.deepest}F`], ["撃破", `${s.kills}体`], ["主討伐", `${s.bossKills}体`],
    ["回収した魂", `${s.soulsFound}`], ["砕けた人業", `${s.deaths}`], ["踏破", `${clearedDungeonCount()}迷宮`],
    ["総時間", `${Math.floor(pm / 60)}時間${String(pm % 60).padStart(2, "0")}分`],
  ];
}
function sharePalaceRecord() {
  SFX.select();
  const ms = G.msq || {};
  const ch = currentChapter();
  const head = ms.n >= 1 ? `師オルドを捜して、第${ch.no}章「${ch.title}」を探索中。` : "操霊師オルドの弟子として着任した。";
  shareProgress(head);
}

// ==== 王宮の宝物庫 (収集品の奉納) ====
// 収集品 (slot:"misc") を奉納すると、ランク帯ごとではなく「奉納した総種類数」の節目で褒賞が下賜される。
// 各節目の褒賞は一度だけ。褒賞の重さは、その種類数が集まる深さに合わせる (2026-10 見直し):
//   収集品は隠しLv 1〜200 に約5種ずつ (計108種。最後の100種の節目に8種の余裕)、拾えるのは迷宮の出現上限 +2 ランクまでなので、
//   N 種がそろうのはおよそ「隠しLv N×2 の品が落ちる深さ」(15種 ≈ 第一章 / 30種 ≈ 第二章 / 60種 ≈ 第五章 / 80種 ≈ 第八章)。
// 褒賞の種類:
//   reward:"minePass" = 坑口の通行証 (台帳の迷宮「鎖の垂れる坑口」が地図に現れる。world.js unlock treasury:3)
//   cls   = 決まった職の魂
//   soul  = 魂 (1 = 通常の抽選 / "legend" = レジェンドの職から1つ)
//   gear  = スーパーレア装備 1点 (いま踏破した最深の迷宮の出現上限から。隊の誰かが装備できる品)
//   embers = 魂の残火
//   lr + tier = 職業専用LR武器 (隊の職の品) / 全職共通のLR防具 を1点 (層の逸品は含めない)。
//               深さの解禁値 (LR_UNLOCK) に届く迷宮を踏破するまでは受け取れない (先に集めても待つだけで、失わない)
// 節目の ID ("m" + n) はセーブに残る。n を変えない・消さない (足すのは可)
const TREASURY_MILESTONES = [
  { n: 3, reward: "minePass" },
  { n: 5, cls: "bishop" },          // 司教の魂 (鑑定の技)
  { n: 10, cls: "samurai" },        // 侍の魂
  { n: 15, gear: 1 },
  { n: 20, soul: "legend" },
  { n: 25, gear: 1, embers: 3 },
  { n: 30, lr: "weapon", tier: 5 },
  { n: 40, lr: "armor", tier: 5 },
  { n: 50, soul: "legend", embers: 5 },
  { n: 60, lr: "weapon", tier: 10 },
  { n: 70, lr: "armor", tier: 10 },
  { n: 80, lr: "weapon", tier: 15 },
  { n: 90, lr: "armor", tier: 15 },
  { n: 100, lr: "weapon", tier: 20 },
];
// 防具とみなすスロット (LR防具褒賞の抽選対象。acc=装飾品は含めない)
const LR_ARMOR_SLOTS = ["body", "head", "feet", "hands", "shield"];
// 節目の褒賞ラベル (UI表示用)
function milestoneLabel(m) {
  if (m.reward === "minePass") return "坑口の通行証";
  if (m.cls) return ((SOUL_CLASSES[m.cls] || {}).label || m.cls) + "の魂";
  if (m.lr) return m.lr === "weapon" ? `LR${m.tier} 専用武器` : `LR${m.tier} 防具`;
  const parts = [];
  if (m.soul) parts.push(m.soul === "legend" ? "レジェンドの魂" : "魂");
  if (m.gear) parts.push("SR装備");
  if (m.embers) parts.push(`魂の残火×${m.embers}`);
  return parts.join("＋") || "装備";
}
// 宝物庫の褒賞の物差し = 踏破した最深の迷宮 (落とし物の帯の上端 = 隠しLv と、層)
function treasuryDepth() {
  const w = worldState();
  let lv = 0, layer = 1;
  for (const d of DUNGEONS) {
    if (!w.cleared[d.id]) continue;
    lv = Math.max(lv, (d.lootLv || [0, 0])[1] || 0);
    layer = Math.max(layer, d.layer || 1);
  }
  return { lv: lv || 5, layer };
}
// 節目に届いていても、まだ受け取れない理由 (LR の深さの解禁)。受け取れるなら null
function milestoneWait(m) {
  if (!m || !m.lr) return null;
  const need = LR_UNLOCK[m.tier] || 40;
  if (treasuryDepth().lv >= need) return null;
  // その深さの品が落ちる迷宮の推奨Lv (地図に無い迷宮の名は出さない)
  const d = DUNGEONS.filter((x) => !x.challenge && ((x.lootLv || [0, 0])[1] || 0) >= need).sort((a, b) => (a.lvTo || 0) - (b.lvTo || 0))[0];
  return d ? `推奨Lv${d.lvTo}ほどの迷宮を踏破すると受け取れる` : "さらに深い迷宮を踏破すると受け取れる";
}
// 節目 m の褒賞をいま受け取れるか
function milestoneReady(m, c = totalDonatedKinds()) {
  return c >= m.n && !treasuryState().claimed["m" + m.n] && !milestoneWait(m);
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
  for (const d of bagOwners(allDolls())) for (const it of (d.items || [])) if (it.slot === "misc") out.push({ doll: d, item: it });
  return out;
}

// どこかに受領可能な褒賞があるか (王宮ハブのバッジ判定にも使う)
function treasuryRewardReady() {
  const c = totalDonatedKinds();
  return TREASURY_MILESTONES.some((m) => milestoneReady(m, c));
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
  tlTown("gold", gold, "t");
  return { kind: "dup", gold };
}

// 褒賞の品を渡す人業 (品の持ち主の職 → 隊の生きている者 → 隊 → 控え。袋に空きのある者)
function treasuryReceiver(forJob) {
  const room = (d) => (d.items || []).length < MAX_ITEMS;
  return (forJob && G.party.find((m) => m.clsKey === forJob && room(m)))
    || G.party.find((p) => p.alive && room(p))
    || G.party.find((p) => !p.isEmpty && room(p))
    || allDolls().find((d) => !d.isEmpty && room(d));
}
// 重みつきの抽選 ([[id, 重み]])
function pickWeighted(list) {
  const total = list.reduce((a, [, w]) => a + w, 0);
  if (!total) return null;
  let x = random() * total;
  for (const [id, w] of list) { x -= w; if (x <= 0) return id; }
  return list[list.length - 1][0];
}
const usableByParty = (it) => G.party.some((m) => !m.isEmpty && canEquip(m, it, { anyLv: true }));
// 褒賞のスーパーレア装備を選ぶ: 踏破した最深の迷宮の出現上限 (基準R + LOOT_R_HEADROOM) から下へ、6点以上の候補がそろうまで広げる。
// 隊の誰かが装備できる品だけ (ほかの職の専用品は出さない)。上限に近いランクほど・隊の職の専用品ほど出やすい
function pickTreasurySR() {
  const dep = treasuryDepth();
  const capR = Math.min(20, Math.ceil(dep.lv / 10) + LOOT_R_HEADROOM);
  const idx = lootByRarity().sr;
  for (let span = 1; span <= 8; span++) {
    const list = [];
    for (let r = Math.max(1, capR - span); r <= capR; r++) {
      for (const id of idx[r]) {
        const it = ITEMS[id];
        if ((it.layer || 0) > dep.layer) continue; // 層の逸品はその層を踏破してから
        const fj = it.forJob;
        if (fj && !G.party.some((m) => m.clsKey === fj)) continue;
        if (!usableByParty(it)) continue;
        list.push([id, (fj ? 2 : 1) * Math.max(1, 3 - (capR - r))]);
      }
    }
    if (list.length >= 6 || span === 8) { const id = pickWeighted(list); if (id) return id; } // 顔ぶれが少なければ下へ広げる
  }
  return pickItemByLv(Math.min(200, dep.lv));
}
// 褒賞の装備を1点下賜する (所持枠が無ければ売値の金貨に換える)。完了後 onClose を呼ぶ
function grantTreasuryItem(onClose) {
  const id = pickTreasurySR();
  const it = ITEMS[id] ? cloneItem(id) : null;
  const who = it && treasuryReceiver(it.forJob);
  if (who) {
    runGainItem(who, it); codexSeeItem(id, it);
    log(`宝物庫の褒賞として ${itemName(it)} を賜った。(${who.name})`, "win");
    showItemGet(it, who, onClose);
    return;
  }
  // 渡せない: 売値の金貨にする
  const g = it ? Math.max(1, sellPrice(it)) : 100;
  G.gold += g; updateTopbar();
  tlTown("gold", g, "t");
  log(`所持枠が満杯のため、宝物庫の褒賞は 💰${g} に換えられた。`, "win");
  showEvent({
    sprite: ICONS.gold, title: "褒賞を換金した", accent: "#e8c24a", banner: "✦ 宝物庫の褒賞 ✦",
    lines: [`持ちきれぬため、褒賞は 💰${g} に換えられた。`], onClose: onClose,
  });
}

// 褒賞のLRを選ぶ: tier の職業専用武器か全職共通の防具。迷宮のLRドロップ (pickLR) と同じく、
// 編成の職で重みを付けず全職の品から均等に (2026-10 ユーザーの指示)。
// 層の逸品 (layer つき) は含めない。まだ手にしていない品 (G.lrOwned 外) を先に
function pickTreasuryLR(m) {
  if (!G.lrOwned) G.lrOwned = {};
  const all = exclIds().filter((id) => {
    const it = ITEMS[id];
    if (!it || it.rar !== "lr" || it.layer || it.lr !== m.tier) return false;
    return m.lr === "weapon" ? it.slot === "weapon" : LR_ARMOR_SLOTS.includes(it.slot);
  });
  const fresh = all.filter((id) => !G.lrOwned[id]);
  const pool = fresh.length ? fresh : all;
  return pool.length ? pool[rand(pool.length)] : null;
}
// 褒賞のLRを1点下賜する。LRは未鑑定で渡る (商会・鑑定の技で鑑定する)
function grantTreasuryLR(m, onClose) {
  const id = pickTreasuryLR(m);
  const it = id ? cloneItem(id) : null;
  const who = it && treasuryReceiver(it.forJob);
  if (!who) { grantTreasuryItem(onClose); return; } // 品が無い・所持枠が無ければ通常の褒賞へ
  it.unidentified = true;
  runGainItem(who, it); codexSeeItem(id, it);
  flashScreen("#ff5fae"); SFX.victory(); buzz([0, 60, 50, 60, 50, 60, 240]);
  const nm = itemName(it); // 未鑑定なら伏せ名
  log(`★ 宝物庫の褒賞として LR${it.lr} の品(未鑑定)「${nm}」を賜った。(${who.name})`, "win");
  setTimeout(() => showToast(`★ ${nm}`, { noLog: true }), 200);
  showItemGet(it, who, onClose);
}

// 褒賞を受領する。総種類数が節目 n に達していて、深さの条件も満たしていれば一度だけ。
function claimTreasury(n) {
  const ts = treasuryState();
  const m = TREASURY_MILESTONES.find((x) => x.n === n);
  if (!m || !milestoneReady(m)) {
    SFX.ng();
    const wait = milestoneWait(m);
    if (wait && totalDonatedKinds() >= n) showToast(wait, { noLog: true, tone: "bad" });
    return;
  }
  ts.claimed["m" + n] = true;
  const back = () => { autosave(); if (G.state === "town") renderTown(); };
  const reason = `収集品を ${n} 種 宝物庫に納めた褒賞だ。`;
  // 坑口の通行証: 品の代わりに、封じられた迷宮を地図に記す
  if (m.reward === "minePass") {
    UI.playStoryChain([{ title: MINE_PASS.title, kicker: `宝物庫の褒賞 ― 奉納 ${n} 種`, lines: MINE_PASS.lines, photo: storyImage("minePass"), reward: "坑口の通行証 (新たな迷宮)", btnLabel: "ありがたく賜る" }], () => {
      SFX.itemget(); buzz([0, 30, 60, 30]);
      announceNewDungeons(refreshWorldUnlocks());
      back();
    });
    return;
  }
  // 玉座の間で老王から褒賞を賜る場面を見せてから、品を渡す (品の演出・効果音は渡す側で鳴る)
  UI.playStoryChain([{
    title: `宝物庫の褒賞 ― 奉納 ${n} 種`, kicker: "褒賞の下賜", lines: treasuryRewardLines(m, n),
    reward: treasuryRewardRows(m), btnLabel: "ありがたく賜る",
  }], () => grantTreasuryReward(m, reason, back));
}

// 褒賞の場面の台詞 (褒賞の種類で王の言葉を変える)
function treasuryRewardLines(m, n) {
  const lines = ["宝物庫の番人が奉納の台帳を広げ、老王はその頁をゆっくりと繰った。",
    `「収集品を ${n} 種も納めてくれたか。迷宮の底から持ち帰られた品々は、どれも闇に呑まれたこの国の記憶だ。」`];
  if (m.lr) {
    lines.push("「これは王家の宝物庫の奥に、長く封じられてきた品だ。いまのそなたにこそ相応しかろう。」");
  } else if (m.cls || m.soul) {
    lines.push("「奉納の品に宿っていた魂が、ひとつ形を成した。そなたの隊に加えるがよい。」");
  } else {
    lines.push("「その働きに、王家はこれで報いよう。」");
  }
  if (m.embers) lines.push("「品の奥でくすぶっていた魂の火も、ともに持ってゆけ。」");
  lines.push("「受け取るがよい。そして、これからも失われたものを持ち帰ってくれ。」");
  return lines;
}
// 褒賞の「受け取るもの」(物語のページの欄)
function treasuryRewardRows(m) {
  if (m.cls) return [{ job: m.cls }];
  if (m.lr) return m.lr === "weapon" ? `LR${m.tier} の専用武器 1点 (未鑑定)` : `LR${m.tier} の防具 1点 (未鑑定)`;
  const parts = [];
  if (m.soul) parts.push(`${m.soul === "legend" ? "レジェンドの魂" : "魂"} 1つ`);
  if (m.gear) parts.push("スーパーレアの装備 1点");
  if (m.embers) parts.push(`魂の残火 ×${m.embers}`);
  return parts.join(" ・ ") || "装備 1点";
}
// 褒賞の品を渡す (場面を閉じた後): 残火 → 魂 → 装備 の順
function grantTreasuryReward(m, reason, back) {
  if (m.embers) {
    G.embers = (G.embers || 0) + m.embers; updateTopbar();
    log(`宝物庫の褒賞として 魂の残火 を ${m.embers}つ 賜った。`, "win");
  }
  const gear = (next) => (m.lr ? grantTreasuryLR(m, next) : m.gear ? grantTreasuryItem(next) : next());
  if (m.cls) acquireSoul(m.cls, reason, back); // 特定職の魂のみ
  else if (m.soul) acquireSoul(m.soul === "legend" ? rollClassOfRarity("legend") : rollJobClass(), reason, () => gear(back));
  else gear(back);
}

// 受領できる最初の褒賞を受け取る (街の「次にすべきこと」・宝物庫の褒賞の段)。無ければ false
function claimNextTreasury() {
  const c = totalDonatedKinds();
  const m = TREASURY_MILESTONES.find((x) => milestoneReady(x, c));
  if (!m) return false;
  claimTreasury(m.n);
  return true;
}

// ---- 図鑑 (王宮書庫) ----
// モンスター図鑑の記録単位: { kills, normal, rare, dungeons:{idx:true} }
// 記録されるのは「倒した時」のみ (迷宮の主だけは、遭遇した時に G.codex.met へ印を付け、図鑑に名だけ出す)。落としたドロップ(通常/レア)も実際に落として初めて開示。
function codexMonEntry(key) {
  let e = G.codex.mon[key];
  if (e == null) codexFresh().mon[key] = 1; // 初めての記録は新着
  if (!e || typeof e !== "object") {
    e = { kills: e === true ? 1 : 0, main: e === true ? 1 : 0, normal: false, rare: false, dungeons: {} };
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
  recordMonsterKill(e.key, abyssActive() ? null : G.dungeonIdx, G.floor);
}
setOnEnemyKilled(codexKillNow);
// 戦闘中の武器の持ち替え: 街の付け替えと同じ処理 (両手武器なら盾が外れる・呪い/ロックの品は外れない・外した品は自分の袋へ)
setEquipSwap((p, it) => equipAt(p, it, swapSlotOf(it))); // 武器は右手、盾は盾の欄
// 敵の属性が明かされているか: 図鑑で属性の項目が解放済み (enemyReveal の stats = 5体討伐・主は1体) か、
// 隊の誰かが弱点看破 (scan) を持つ。戦闘の名札の属性の印・技の有利/不利・オートの見積もり (combat.js) が共通で使う
function enemyElemKnown(e) { return !!e && (enemyReveal(e).stats || partyPassiveLv("scan") > 0); }
setElemKnown(enemyElemKnown);
setResistKnown(e => !!e && enemyReveal(e).lore);
// floors = { 迷宮idx: [討伐した最浅の階, 最深の階] } (後付け)。図鑑の「出現した迷宮」で、台帳の出現表に
// 載らない魔物 (呼び出された手下など) の出現階を示すのに使う
function recordMonsterKill(key, dungeonIdx, floor) {
  if (!key) return;
  const e = codexMonEntry(key);
  e.kills++;
  // 本編 (無限迷宮の外) で倒した数。図鑑の伝承は、本編で1体以上倒すまで伏せる (docs/infinite-labyrinth.md 7章)
  if (!abyssActive()) e.main = (e.main || 0) + 1;
  if (dungeonIdx == null) return;
  e.dungeons[dungeonIdx] = true;
  if (floor > 0) {
    if (!e.floors) e.floors = {};
    const r = e.floors[dungeonIdx];
    e.floors[dungeonIdx] = r ? [Math.min(r[0], floor), Math.max(r[1], floor)] : [floor, floor];
  }
}
// 勝利時の汎用戦利品抽選 (固有ドロップ廃止に伴う置換)。通常30% / レア4%。
// 中身は迷宮の lootLv 帯から引く (レアは一段深い帯)。実物は勝利後の宝箱から取り出す。
function rollGenericDrop() {
  const apLv = partyPassiveLv("appraise"); // 掘り出しの勘: ドロップ率 +15/25/40%
  const ap = apLv >= 3 ? 1.40 : apLv >= 2 ? 1.25 : apLv >= 1 ? 1.15 : 1;
  // 特別階 (盗賊の洞察): レアドロップ率が上がる
  if (random() < Math.max(sfNum("rareDropRate", 0.04 * ap), mutNum("rareDropRate", 0))) {
    const id = pickLoot({ rare: true });
    if (ITEMS[id]) { const it = cloneItem(id); if (it) return { key: "loot", name: "戦利品", id, item: it, rare: true }; }
  }
  if (random() < 0.30 * ap) {
    const id = pickLoot();
    if (ITEMS[id]) { const it = cloneItem(id); if (it) return { key: "loot", name: "戦利品", id, item: it, rare: false }; }
  }
  return null;
}
// it = 手に入れた品の実体 (あれば)。未鑑定の品はまだ図鑑に載せない (鑑定して正体を知ったとき revealIdentity が載せる)
function codexSeeItem(id, it) {
  if (!id || (it && it.unidentified)) return;
  if (!G.codex.item[id]) codexFresh().item[id] = 1; // 初めての記録は新着
  G.codex.item[id] = true;
  codexKnowItem(id);
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
  codexSeeItem(it.id, it); // 正体を知ったこの時に図鑑へ載せる
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
    for (const it of (d.items || [])) if (it && !out.includes(it)) out.push(it);
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

// 図鑑に積み重ねた見識。旧セーブも再集計するので、売却や魂融合では減らない。
function insightSummary() { return insightTotals(G, { monsters: MONSTERS, items: ITEMS, jobs: SOUL_CLASSES, events: EVENT_MAP }); }
function notifyInsight() {
  if (!featureUnlocked("insight")) return;
  const score = insightSummary();
  const previous = G.insightNotified;
  G.insightNotified = Math.max(Number(previous) || 0, score.total);
  if (previous != null && score.total > previous) showToast(`見識 ＋${score.total - previous}　操霊師の見識 ${score.total.toLocaleString("ja-JP")}`, { tone: "gold" });
}

// ---- 職業図鑑の記録 ----
// 魂を吸収した時点で「発見」とし、到達ランクと魂レベルの最高値を記録する。
// 図鑑はランク別に称号を列挙し、スキル表は到達Lvまでの技だけ内容を開示する。
function codexJobSee(clsKey, count, level, capBonus = 0) {
  if (!G.codex || !G.codex.job) return;
  const rank = soulRankFromCount(clsKey, count || 0);
  if (rank < 1) return;
  // 残火で伸ばした上限ぶんも含める (含めないと上限を越えて覚えた技が図鑑に出ない)
  const cap = soulLevelCap(clsKey, count || 0) + (capBonus || 0);
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
  for (const s of (G.souls || [])) codexJobSee(s.clsKey, s.count, s.level, s.capBonus);
}

// ---- 面影の写し (第三章の入口: 館の語り「彫られた顔」で解放) ----
// 人業の顔を、魂が覚えている姿 (職業図鑑で到達した職業×ランク) に写す。見た目だけで、無料・何度でも
const OMOKAGE_BEAT = "irene_omokage";
function omokageUnlocked() { return !!worldState().beats[OMOKAGE_BEAT]; }
// 写せる面影: {職業: 到達した最高ランク} (職業図鑑の記録。魂を融合・手放しても消えない)
function omokageRanks() {
  codexSweepJobs();
  const out = {};
  for (const k of SOUL_KEYS) {
    const e = G.codex && G.codex.job && G.codex.job[k];
    const r = e && typeof e === "object" ? (e.rank || 0) : 0;
    if (r > 0) out[k] = Math.min(5, r);
  }
  return out;
}
// face = {job, rank} / null (魂のままの姿へ戻す)。届いていない面影は写せない
function setDollFace(d, face) {
  if (!d || !omokageUnlocked()) return false;
  if (face) {
    const r = omokageRanks()[face.job] || 0;
    if (!SOUL_CLASSES[face.job] || !(face.rank >= 1 && face.rank <= r)) return false;
    d.face = { job: face.job, rank: Math.round(face.rank) };
  } else delete d.face;
  autosave(true);
  return true;
}

function showCodexItemDetail(id) { if (UI.codexItemSheet) UI.codexItemSheet(id); }
function showCodexMonDetail(key) { if (UI.codexMonSheet) UI.codexMonSheet(key); }

// ダンジョンに出現しうるモンスターのキー一覧 (pool + deepPool + boss、重複排除)
function dungeonRoster(dn) {
  const seen = new Set();
  const out = [];
  for (const k of [...(dn.pool || []), ...(dn.deepPool || []), ...(dn.elites || []), dn.boss]) {
    if (k && MONSTERS[k] && !seen.has(k)) { seen.add(k); out.push(k); }
  }
  return out;
}

// 特定のダンジョンに属さない魔物 (宝箱に潜む類・出来事にだけ現れる類) を集める「その他」タブの面々
const CODEX_OTHER = ["mimic", "master_mimic", "bs_cagewarden", "mt_silver", "mt_gold", "mt_king"];

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
const REPAIR_RARITY_MUL = { common: 1, rare: 2, epic: 3, legend: 4, unique: 3 };
function repairCostOf(d) {
  if (!d || d.alive || awaitingRescue(d)) return 0;
  const rank = Math.max(1, Math.min(5, d.jobRank || 1));
  const lv = Math.max(1, d.jobLv || 1);
  const cls = d.clsKey ? SOUL_CLASSES[d.clsKey] : null;
  const mul = REPAIR_RARITY_MUL[cls ? cls.rarity : "common"] || 1;
  const cost = REPAIR_RANK_GOLD[rank] * lv * mul;
  return clueBoon("repair") ? Math.ceil(cost * 0.9) : cost; // 継ぎ目の技 (流れ着いた腕): 10%オフ
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
  showToast(`${d.name} が連れ帰られた ― 館で修復を`, { noLog: true, tone: "info" });
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
  if (G.redSoul < 1) { log("赤い魂が足りない。", "sys"); SFX.ng(); showToast("赤い魂が足りない", { tone: "bad" }); return; }
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
function repairDoll(d, { batch = false } = {}) {
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
  if (!batch) { SFX.levelup(); buzz([0, 30, 40, 30]); }
  log(`${d.name} の砕けた魂を修復した。(💰${cost})`, "win");
  if (batch) return { ok: true, cost };
  showToast(`${d.name} が立ち上がった (💰${cost})`, { tone: "good" });
  updateTopbar();
  if (G.statusOpen) renderStatus();
  if (G.state === "town") renderTown();
  renderParty();
  return { ok: true, cost };
}

// 館に届いている砕けた人業を、隊・控えまとめて修復する。費用不足なら誰も修復しない。
function repairAllDolls() {
  if (G.state !== "town") return { ok: false, reason: "town" };
  const targets = allDolls().filter((d) => d.isDoll && !d.alive && !awaitingRescue(d));
  if (!targets.length) return { ok: false, reason: "dead" };
  const cost = targets.reduce((sum, d) => sum + repairCostOf(d), 0);
  if (G.gold < cost) { SFX.ng(); showToast(`金貨が足りない (💰${cost})`, { tone: "bad" }); return { ok: false, reason: "gold", cost }; }
  for (const d of targets) repairDoll(d, { batch: true });
  SFX.levelup(); buzz([0, 30, 40, 30]);
  showToast(`${targets.length}体全員が立ち上がった (💰${cost})`, { tone: "good" });
  updateTopbar();
  if (G.statusOpen) renderStatus();
  renderTown();
  renderParty();
  autosave(true);
  return { ok: true, cost, count: targets.length };
}

// ---- 赤い魂の祠: Red Soul の入手 (広告/課金) ----
let _adCooldownUntil = 0;
// 広告動画 (シミュレート): +🔴10・30秒のクールダウン
const AD_RED = 10;
function adCooldownLeft() { return Math.max(0, _adCooldownUntil - Date.now()); }
function watchShrineAd() {
  if (adCooldownLeft() > 0) return false;
  log("広告動画を視聴した…", "sys");
  grantRedSoul(AD_RED, "ad");
  _adCooldownUntil = Date.now() + 30000;
  SFX.itemget(); buzz([0, 30, 60, 30]);
  showToast(`🔴 赤い魂を ${AD_RED} 授かった`, { tone: "good" });
  renderTown();
  return true;
}
// 課金 (プレースホルダ): 実課金は未対応。デモとして付与
const RED_PACKS = [{ n: 100, label: "赤い魂 100" }, { n: 500, label: "赤い魂 500", tag: "お得" }, { n: 1200, label: "赤い魂 1200", tag: "特盛" }];
function buyRedPack(n) {
  grantRedSoul(n, "pack");
  SFX.itemget();
  log(`(デモ) 赤い魂を ${n} 入手した。`, "win");
  showToast(`🔴 赤い魂 +${n}`, { tone: "good" });
  renderTown();
}

// ---- 商会: 装備・道具の売買 ----
// 画面 (売る・鑑定 / 買う) は src/ui/shop.js が商会タブとして描く。ここには売買・鑑定の単体操作と値段だけを置く
// 商会の初期在庫 (個数つき)。ダンジョン産を売ると在庫に積まれ、買い直せる (ボルタック方式)
// 道具は薬草・毒消し草だけを置き、ほかの道具は売られて初めて棚に並ぶ。在庫は1品あたり SHOP_STOCK_MAX まで
const SHOP_STOCK_MAX = 999;
const SHOP_INIT_STOCK = {
  herb: 10, antidote: 10,
  dagger: 2, shortSword: 1, magicStaff: 1, warHammer: 1,
  woodShield: 1, leatherArmor: 1, robe: 1, cap: 2, leatherBoots: 2, leatherGloves: 2,
};
// 売られた品を棚に積む (上限 SHOP_STOCK_MAX。上限に達した品は引き取るが棚には増えない)
function shopStockAdd(id) {
  if (!id) return;
  G.shopStock[id] = Math.min(SHOP_STOCK_MAX, (G.shopStock[id] || 0) + 1);
}
// ---- 追加つきの品と商会の棚 (docs/infinite-labyrinth.md 17-1) ----
// 商会は1つの品 (id) につき、追加の能力・特性の組を1つだけ覚えておける (G.shopAfx[id])。棚では「追加つき1点 + 通常品 N 点」。
// すでに別の組を覚えている品が来たら、組は G.shopAfxPending に積み、街で一覧の画面からまとめて選ぶ (UI.openAfxConflicts)。
// 残さなかった組の品は通常品として在庫に入る (在庫の数は売った時点で数えてある)
function shopAfxState() {
  if (!G.shopAfx || typeof G.shopAfx !== "object") G.shopAfx = {};
  if (!Array.isArray(G.shopAfxPending)) G.shopAfxPending = [];
  return G.shopAfx;
}
// 商会の棚へ品を受け入れる (売った・回収人に売った・無限迷宮から持ち帰った)。
// keep = すでに棚に追加つきの1点がある時、どちらの組を残すかをその場で選んだ答え ("shelf" = 棚の組 / "new" = この品の組)。
// 無ければ組を G.shopAfxPending に積み、街でまとめて選ぶ
function shopReceive(it, keep = null) {
  if (!it || !it.id || it.unidentified) return;
  shopStockAdd(it.id);
  if (!Array.isArray(it.afx) || !it.afx.length) return;
  const st = shopAfxState();
  const afx = it.afx.map((a) => ({ ...a }));
  if (!st[it.id]?.length || keep === "new") st[it.id] = afx;
  else if (keep !== "shelf") G.shopAfxPending.push({ id: it.id, afx });
}
// 売ろうとしている品と、商会の棚の追加つきの1点がぶつかるか (同じ品に別の組)。ぶつかれば両方の組を返す (afxConflicts と同じ形)
function shopAfxClash(it) {
  if (!it || !it.id || it.unidentified || !Array.isArray(it.afx) || !it.afx.length || !ITEMS[it.id]) return null;
  const cur = shopAfxState()[it.id];
  if (!cur || !cur.length) return null;
  const tmpl = ITEMS[it.id];
  const sets = [cur, it.afx].map((a, i) => ({ afx: a, lines: affixLines(tmpl, a), power: Math.round(affixPower(tmpl, a) * 10) / 10, current: i === 0 }));
  return { id: it.id, name: tmpl.name, sets, best: sets[1].power > sets[0].power ? 1 : 0 };
}
// 棚の追加つきの品 (並品 50 で作った見本。買うとこれが届く)。無ければ null
function shopAfxItem(id) {
  const afx = shopAfxState()[id];
  if (!afx || !ITEMS[id] || (G.shopStock[id] || 0) <= 0) return null;
  const it = cloneItem(id, QUALITY_MID);
  if (!it) return null;
  it.afx = afx.map((a) => ({ ...a }));
  resyncItem(it);
  return it;
}
// 通常品の在庫 (追加つきの1点を除く)
function shopPlainStock(id) { return Math.max(0, (G.shopStock[id] || 0) - (shopAfxState()[id] ? 1 : 0)); }
// 追加つきの品を買う。買えば、その品の組は消える (残りはすべて通常品)
function buyAffixed(id, who) {
  const it = shopAfxItem(id);
  if (!it) { SFX.ng(); return null; }
  const price = buyPrice(it);
  if (G.gold < price) { log("お金が足りない。", "sys"); SFX.ng(); return null; }
  if (!who) who = G.party.find((m) => m.alive && m.items.length < MAX_ITEMS) || null;
  if (!who || who.items.length >= MAX_ITEMS) { SFX.ng(); showToast("持ち物がいっぱいだ", { tone: "bad" }); return null; }
  G.gold -= price;
  G.shopStock[id]--;
  delete G.shopAfx[id];
  who.items.push(it);
  codexSeeItem(id, it);
  SFX.itemget(); buzz(10);
  log(`${itemName(it)} を購入した (${who.name}・−💰${price})。`, "win");
  renderTown();
  return it;
}
// 組がぶつかった品の一覧 (id ごとに [いまの組, 新しい組…]。強い方を最初から選んでおく)
function afxConflicts() {
  shopAfxState();
  const by = new Map();
  for (const p of G.shopAfxPending) {
    if (!ITEMS[p.id]) continue;
    if (!by.has(p.id)) by.set(p.id, [G.shopAfx[p.id] || []]);
    by.get(p.id).push(p.afx);
  }
  return [...by.entries()].map(([id, sets]) => {
    const tmpl = ITEMS[id];
    const power = sets.map((a) => affixPower(tmpl, a));
    const best = power.indexOf(Math.max(...power));
    return { id, name: tmpl.name, sets: sets.map((a, i) => ({ afx: a, lines: affixLines(tmpl, a), power: Math.round(power[i] * 10) / 10, current: i === 0 })), best };
  });
}
// 選んだ組を残す: choice = { id: 残す組の番号 } (0 = いまの組)。ほかの組の品は通常品のまま在庫に残る
function resolveAfxConflicts(choice = {}) {
  for (const c of afxConflicts()) {
    const i = choice[c.id] != null ? choice[c.id] : c.best;
    const pick = c.sets[i];
    if (pick && pick.afx && pick.afx.length) G.shopAfx[c.id] = pick.afx.map((a) => ({ ...a }));
  }
  G.shopAfxPending = [];
  autosave(true);
  renderTown();
}
// 鑑定料と売値のレア度の倍率 (コモン・アンコモン・レア1 / スーパーレア1.5 / レジェンドレア4)。
// レア度を持たない道具・収集品は1。値段 price は性能だけで決まる (pricing.js) ので、レア度の差はここで付ける
const APPRAISE_MUL = { c: 1, uc: 1, r: 1, sr: 1.5, lr: 4 };
const rarPriceMul = (it) => APPRAISE_MUL[rarityKey(it)] || 1;
// 売値 = 鑑定料 = 値段の半分 × レア度の倍率。買値はその倍
// (鑑定してすぐ売っても差し引き0。未鑑定の品は売れないので、鑑定の技・金貨の使い方が稼ぎを左右する)
const sellPrice = (it) => Math.max(1, Math.round(Math.floor((it.price || 10) / 2) * rarPriceMul(it)));
// 店の買値・鑑定費の割引 (値切りのパッシブは廃止。いまは割引なし。呼び出し側のために残す)
function bargainMul() { return 1; }
const buyPrice = (it) => (it ? Math.max(1, Math.round(sellPrice(it) * 2 * bargainMul())) : 30);
// 鑑定料: 売値と同額 (LRは商会でのみ鑑定できる)。値切りで割引
const appraiseCost = (it) => (it ? Math.max(1, Math.round(sellPrice(it) * bargainMul())) : 1);

// 商会で鑑定する: 鑑定料を払い、必ず正体を明かす
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
    out.push("⚠ レジェンドレアです。めったに手に入らない至高の逸品です。本当に売りますか？");
  } else if (rarityKey(it) === "sr") {
    out.push("⚠ スーパーレアです。めったに手に入らない逸品です。本当に売りますか？");
  }
  return out;
}

// まとめて売るから外す品: 未奉納の収集品とレジェンドレア (2026-10 ユーザーの指示: SR はまとめて売るに含める。
// 一点ずつの「売る」では sellWarnings が SR にも警告を出す)
function bulkSellBlocked(it) {
  if (!it) return true;
  if (it.slot === "misc" && it.id && !treasuryState().donated[it.id]) return true;
  return rarityKey(it) === "lr";
}

function sellItem(owner, it, price, afxKeep = null, quiet = false) {
  const idx = owner.items.indexOf(it);
  if (idx < 0) return false;
  if (it.locked) { SFX.ng(); showToast(`${it.name}はロック中 ― 売るにはロックを外す`, { tone: "info" }); return false; }
  // 未鑑定品は正体不明のため二束三文 (0G) で引き取られ、商会にも並ばない
  if (it.unidentified) price = 0;
  owner.items.splice(idx, 1);
  G.gold += price;
  tlTown("gold", price, "sell");
  // 在庫に積む (ボルタック方式)。未鑑定品は並ばない
  if (it.id && !it.unidentified) shopReceive(it, afxKeep); // 追加つきの品は、その組を商会が覚える (17-1)
  codexSeeItem(it.id, it);
  if (quiet) return true;
  SFX.select(); buzz(10);
  const shown = itemName(it);
  // 無限迷宮の回収人に売った品は、その場で本編の商会の棚に並ぶ (この先で全滅しても消えない)
  const inInf = abyssActive();
  log(`${shown} を売った (+💰${price})。${it.unidentified ? "" : inInf ? "本編の商会の棚に並んだ ― 全滅しても残る。" : "商会に並んだ。"}`, "win");
  showToast(inInf && !it.unidentified ? `💰+${price} ${shown} を売却 ― 商会の棚へ (全滅しても残る)` : `💰+${price} ${shown} を売却`, { noLog: true });
  renderTown();
  return true;
}

// 棚の品を買う。who = 買った品を持たせる人業 (省略時は袋に空きのある最初の生きている隊員)。
// 値段・在庫・所持枠の判定は従来と同じ。買った品 (の写し) を返す。買えなければ null
function buyItem(id, price, who) {
  price = buyPrice(ITEMS[id]);
  if (G.gold < price) { log("お金が足りない。", "sys"); SFX.ng(); return null; }
  if (shopPlainStock(id) <= 0) { log("在庫切れだ。", "sys"); SFX.ng(); return null; } // 追加つきの1点は buyAffixed で
  if (!who) who = G.party.find((m) => m.alive && m.items.length < MAX_ITEMS) || null;
  if (!who || !who.alive) { log("取引する人業を選ぼう。", "sys"); SFX.ng(); return null; }
  if (who.items.length >= MAX_ITEMS) { log(`${who.name} の所持品がいっぱいだ。`, "sys"); SFX.ng(); return null; }
  const it = cloneItem(id, QUALITY_MID); // 商会の棚の品は並品 (品質50)。売った品も並品として棚に戻る
  if (!it) return null;
  G.gold -= price;
  G.shopStock[id]--;
  who.items.push(it);
  if (isEquippable(it) && UI.tutorialEvent) UI.tutorialEvent("equipmentBought");
  codexSeeItem(id);
  SFX.itemget(); buzz(10);
  log(`${it.name} を購入した (${who.name})。`, "win");
  renderTown();
  return it;
}

// ---- 鍛え直し (第五章の結びで開く。2026-10 ユーザーの指示) ----
// 商会で金貨を払い、装備品 (コモン〜LR) の品質 0〜100 を引き直す (items.js の「品質」)。
// 結果を見て「新しい品質にする / 元のまま」を選べる。金貨は引くたびにかかり、元のままを選んでも戻らない。
// 費用 = その品の買値 (売値の2倍。レア度の倍率込み — 深い品・LR ほど高い)。品質に依らず品の種類で決まる
const REFORGE_MIN_COST = 100;
function reforgeCost(it) { return Math.max(REFORGE_MIN_COST, buyPrice(it && it.afx ? it : (ITEMS[it && it.id] || it))); } // 追加つきの品は追加の分だけ高い
// 鍛え直せない理由 (無ければ null)。{ gold: false } で所持金を見ない (ボタンを出すかどうかの判定)
function reforgeBlock(owner, it, { gold = true } = {}) {
  if (!featureUnlocked("forge")) return featureNote("forge");
  if (!it || !hasQuality(it) || !ITEMS[it.id]) return "装備品だけを鍛え直せる";
  if (it.unidentified) return "未鑑定の品は鍛え直せない";
  if (!qualityMatters(it)) return "品質で変わる性能が無い品";
  if (G.state !== "town" && !infAtRest()) return "鍛え直しは街の商会か、無限迷宮の風だまりの回収人でだけ";
  if (G.state === "town" && !opsFacilityOpen("shop")) return "商会が開いていない";
  if (gold && G.gold < reforgeCost(it)) return "金貨が足りない";
  return null;
}
// 金貨を払って品質を1回引く。品はまだ変えない (選ぶのは setItemQuality)。{ ok, q, cost } を返す
function rollReforge(owner, it) {
  const why = reforgeBlock(owner, it);
  if (why) { SFX.ng(); showToast(why, { tone: "bad", noLog: true }); return { ok: false, reason: why }; }
  const cost = reforgeCost(it);
  G.gold -= cost;
  if (!G.stats) G.stats = {};
  G.stats.reforged = (G.stats.reforged || 0) + 1;
  const q = rollQuality();
  log(`${itemName(it)} を鍛え直した (−💰${cost}) ― 品質 ${it.q == null ? QUALITY_MID : it.q} → ${q}`, "sys");
  updateTopbar();
  autosave();
  return { ok: true, q, cost };
}
// 品の品質を q にする (鍛え直しの結果を選んだ時)。性能を目録から写し直し、持ち主の能力を計算し直す
function setItemQuality(owner, it, q) {
  if (!it || !hasQuality(it)) return false;
  it.q = Math.max(0, Math.min(100, Math.round(q)));
  resyncItem(it);
  const d = owner || allDolls().find((x) => (x.items || []).includes(it) || Object.values(x.equip || {}).includes(it));
  if (d) { recalcDoll(d); d.hp = Math.min(d.hp, d.maxhp); d.mp = Math.min(d.mp, d.maxmp); }
  autosave();
  renderStatus(); renderParty();
  return true;
}

// ---- 街 ⇄ 迷宮 の出入り ----
// 出撃は「出撃シート」(src/ui/departure.js) に集めた: 門の選択・隊の備え (その場で直す)・迷宮の異変・初回の注意。
// 旧来の入口 (広場の「迷宮へ潜る」・目標など) もこのシートを開く
function tryEnterDungeon() {
  if (worldOpenCount() < 1) { log("王の勅命を果たすまで、迷宮には入れない。", "sys"); showToast("王の勅命を果たすまで、迷宮の在処は明かされない", { tone: "info" }); return; }
  UI.openDeparture();
}
// 報告に必要な師の手がかり。踏破済みでも未発見なら、探しに戻れるようにする。
function reportMissingClue(id = worldState().report) {
  const w = worldState();
  const recovery = prologueActive() && ({ w00_forest: "forest_doll", w02: "w02_broken_doll" })[id];
  if (recovery && !w.found[recovery]) return STORY_CELLS[recovery];
  const key = REPORTS[id]?.need;
  return key && !w.found[key] ? STORY_CELLS[key] : null;
}
// 報告の後に見つけた師の手がかりで、まだ王に伝えていないもの (鍵 / null)
function lateClue() {
  if (G.testPlay) return null; // 試遊は選択した場面だけ
  const w = worldState();
  return Object.keys(LATE_CLUES).find((key) => w.found[key] && w.reported[STORY_CELLS[key].dungeon] && !w.told[key]) || null;
}
// 後から見つけた手がかりを王に伝える (報酬は無い。王の言葉だけ)
function tellLateClue() {
  const key = lateClue();
  if (!key) { renderTown(); return; }
  const w = worldState();
  const def = LATE_CLUES[key], cell = STORY_CELLS[key];
  playMsqChain([{ title: def.title, lines: storyLines(def.lines), art: cell.art, photo: storyImage(key), kicker: `手がかりの報告 ― ${worldById(cell.dungeon).name}`,
    leave: () => { w.told[key] = 1; w.last = { kind: "late", key }; autosave(true); } }]);
}
// 初踏破を報告できるか (必要な手がかりが揃うまでは再出撃できる)
function reportPending() {
  const w = worldState();
  return !!w.report && !!worldById(w.report) && !reportMissingClue();
}
// 迷宮へ向かおうとした時、報告が先なら引き止める (王宮へ案内するシート)。引き止めたら true
function blockForReport() {
  if (!reportPending()) return false;
  SFX.ng(); buzz([0, 30, 40, 30]);
  kitConfirm({
    banner: "勅 命", danger: false,
    title: "王に報告するのが先だ",
    lines: [`「${worldById(worldState().report).name}」の踏破を、まだ王に報告していない。`, "報告を済ませるまで、迷宮の門は開かれない。"],
    okLabel: "王に報告する", cancelLabel: "あとで",
  }).then((ok) => { if (ok && reportPending()) reportMainQuest(); });
  return true;
}
// 解放された要素の手ほどきが済んでいないか (src/ui/tutorial.js)。{ key, name, text } / null
function tutorialPending() { return UI.tutorialPending ? UI.tutorialPending() : null; }
// 迷宮へ向かおうとした時、手ほどきが先なら引き止める (手ほどきへ案内するシート)。引き止めたら true
function blockForTutorial() {
  const t = tutorialPending();
  if (!t || (t.key === "firstDive" && t.started)) return false;
  // 初回の出撃案内は、プレイヤーが迷宮を選んだ時だけ始める。
  if (t.key === "firstDive") { UI.tutorialResume?.(); return true; }
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
// 闇に溶けて (sceneTransition) その底で出撃する。潜れない時は理由を返す
// from = 潜り始める階 (1 か、到達した帰還魔法陣の次の階)
function departNow({ idx = G.dungeonIdx, accept = false, from = 1 } = {}) {
  if (G.state !== "town" || G.prompt) return { ok: false, reason: "state" };
  if (worldOpenCount() < 1) return { ok: false, reason: "locked" };
  if (blockForReport()) return { ok: false, reason: "report" };
  if (blockForTutorial()) return { ok: false, reason: "tutorial" };
  if (!worldOpenIdx(idx)) { showToast("その迷宮は、まだ地図に記されていない", { tone: "info" }); return { ok: false, reason: "sealed" }; }
  if (!G.party.some((p) => p.alive)) { log("動ける人業がいない。", "sys"); SFX.ng(); return { ok: false, reason: "party" }; }
  if (prologueActive()) {
    const expected = { forest: 3, crypt: 4, corridor: 5, abbeyQuest: 6, abbey: 6 }[prologuePhase()];
    if (!expected || G.party.length !== expected || G.party.some(d => !d.alive || d.primary == null)) { showToast("依頼に必要な人業をそろえ、手ほどきを終えてください", { tone: "info" }); return { ok:false, reason:"prologue" }; }
  }
  if (stabilityApplies(DUNGEONS[idx]) && !stabilityReady(() => departNow({idx, accept, from}))) return { ok:false, reason:"stability" };
  G.dungeonIdx = idx;
  const mut = townMutatorFor(idx);
  const mutId = accept && mut ? mut.id : null;
  G.dungeonBriefed = true; // 初回の注意は出撃前のポップアップで案内した
  G.prompt = true;
  const start = startFloorsOf(DUNGEONS[idx]).includes(from) ? from : 1;
  uiDungeonHud.sceneTransition(() => { G.prompt = false; enterDungeon(mutId, start); });
  return { ok: true };
}

// §7 M1 迷宮の異変: 街に戻るたび、出撃シートを初めて開いた時に迷宮ごとに一度だけ抽選する (D3以降・45%・同じ候補)。
// シートを開き直しても引き直さない (G._townMutator は街にいる間だけの一時記録。出撃・帰還で消える)
function townMutatorFor(idx) {
  if (DUNGEONS[idx]?.noSpecial || DUNGEONS[idx]?.id === "w01") return null; // 第1の迷宮には異変を出さない
  if (!G._townMutator) G._townMutator = {};
  if (!(idx in G._townMutator)) {
    let id = null;
    if (idx >= 2 && random() < 0.45) {
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
    res.items.push({ kind: "few", tone: "warn", text: `隊が ${G.party.length}体 だけ ・ 宿せる魂 ${free}`, fix: { act: "party", label: "仕立てる" } });
  }
  // 武器を持たない人業がいる (買える所持金がある時だけ)
  const bare = G.party.filter((d) => d.alive && d.primary != null && !(d.equip && d.equip.weapon));
  if (bare.length && G.gold >= 30) {
    lines.push(`■ ${bare.map((d) => d.name).join("・")} は丸腰だ。商会で武器と防具を整えておけ。`);
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

// 門をくぐる前の念押し: 砕けた魂・HP/MPの消耗・状態異常を知らせる。
// broken は隊の砕けた人業 (修復費用と連れ帰り待ちの状態付き)。
function departWoes() {
  const list = G.party.filter((d) => d.alive && (d.hp < d.maxhp || d.mp < d.maxmp || d.ailment))
    .map((d) => ({ name: d.name, hp: d.hp, maxhp: d.maxhp, mp: d.mp, maxmp: d.maxmp, ail: d.ailment ? (AIL_NAME[d.ailment] || d.ailment) : null }));
  const broken = G.party.filter((d) => d.isDoll && !d.alive)
    .map((d) => ({ uid: d.uid, name: d.name, cost: repairCostOf(d), rescuing: awaitingRescue(d) }));
  return { list, broken, innOpen: opsFacilityOpen("inn"), cost: innCost() };
}

// 名前の短い並び (3人以上は「Aほか2人」)
function namesShort(list) { return list.length > 2 ? `${list[0].name}ほか${list.length - 1}人` : list.map((d) => d.name).join("・"); }

// 初回出撃時の警備兵の注意 (出撃前にスクロールできるポップアップで表示)
const DUNGEON_BRIEFING = [
  "■ 街へ戻るには、迷宮を踏破するか「帰還魔法陣」を踏む必要があります。帰還魔法陣は5階・10階…と5階ごとに必ず出現します。",
  "■ 一度たどり着いた帰還魔法陣の階は、次回から探索の開始地点に選べます。",
  "■ 踏破前に全滅すると、今回の探索で得た金貨・品・魂を失います。✦Soulは残ります。必要な数の赤い魂を使えば、戦利品を守って帰還できます。",
];
// 出撃の実体。mutatorId を渡すと「迷宮の異変」を受け入れた状態で潜る
function enterDungeon(mutatorId, startFloor = 1) {
  if (G.state !== "town" || !consumeEntryStability(curDungeon().id)) return false;
  if (stabilityApplies()) G.stabilityBriefed = true;
  if (prologuePhase() === "abbey" && curDungeon().id === "w03") {
    prologue().phase = "done";
    refreshWorldUnlocks();
  }
  G.mutator = curDungeon().noSpecial || curDungeon().id === "w01" ? null : mutatorId || null;
  G.bossDown = false; // 帰還制限: 魔法陣を見つけるか主を討つまで帰れない
  SFX.stairs();
  sheet.closeAll();
  townEl.classList.add("hidden");
  G.town.facility = null; G.town.sub = null;
  // 迷宮は1階から。到達した帰還魔法陣の次の階 (6・11…) からも潜り始められる
  G.floor = Math.max(1, Math.min(curDungeon().floors || 1, startFloor | 0 || 1));
  G.maxFloorReached = Math.max(G.maxFloorReached || 0, G.floor);
  G.eliteFloor = false; // 潜り始めの階は強敵階・特別階にならない
  G.specialFloor = null;
  G.stats.runs++;
  // 今回の戦利品トラッキングを初期化 (帰還の報告は次の帰還で書き直す)
  G.run = newRun();
  G.run.startFloor = G.floor; // 潜り始めの階 (そこから降りずに何もせず戻ったら、帰還で酒場を貼り替えない)
  tlRunBegin(tlWhere(), G.party, { mutator:G.mutator, loadout:G.party.map(p=>({ name:p.name, tactic:p.tactic, equip:Object.fromEntries(Object.entries(p.equip || {}).map(([k, it])=>[k, it ? it.id : null])), passives:p.passiveMap,
    souls:[p.primary, ...(p.subs || []).map(x=>x.uid)].filter(x=>x!=null).map(uid=>{ const soul=soulByUid(uid); return soul ? { uid, clsKey:soul.clsKey, level:soul.level, count:soul.count } : { uid }; }) })) });
  G.lastRun = null;
  G._townMutator = null; G._departPre = false;
  G._lastTargetUid = null;
  // この迷宮の噂を持っていれば確定し、現実化させる (別の迷宮では適用せず、帰還時に更新する)。
  // ただし「特別な階」を呼び込む噂は1階で潜る時のためのもの: 帰還魔法陣から潜り始める時は適用しない
  // (潜り始めの階は特別な階にならない)
  if (rumorFor(curDungeon()) && !(G.floor > 1 && G.rumor.type === "special")) { G.activeRumor = { ...G.rumor, floor: G.floor }; G.rumor = null; }
  G.state = "board";
  playBgm(fieldBgm());
  if (descendBtn) { descendBtn.classList.add("hidden"); descendBtn.disabled = true; }
  newFloor();
  questProgress("floor", G.floor); // 帰還魔法陣から潜り始めても、その階に着いたと数える
  // 帰還魔法陣から潜り始めた: 陣の次の階の入口に降り立つ (陣の階は踏破済みなので飛ばす)
  if (G.floor > 1 && isGateFloor(curDungeon(), G.floor - 1)) log(`帰還魔法陣 B${G.floor - 1}F を抜けて、B${G.floor}F に降り立った。`, "sys");
  const mu = mutDef();
  if (mu) log(`異変「${mu.name}」の中を行く。${mu.gain}。`, "win");
  renderBoard();
  if (UI.tutorialEvent) UI.tutorialEvent("dungeonEntered");
  autosave(true);
}

// ===== 無限迷宮への出撃 =====
// picks = 仮の器6体それぞれに宿す魂の職 (入口の3択で選んだもの。ui/infinite.js)。魂の安定度は本編と同じように使う
function enterAbyss(picks, testRun = false) {
  if (G.state !== "town" || G.abyss) return false;
  const ok = Array.isArray(picks) && picks.length === INF_PARTY && picks.every((k) => SOUL_CLASSES[k] && !isUniqueJob(k)) && new Set(picks).size === picks.length;
  if (!ok) { SFX.ng(); return false; }
  if (!stabilityReady(() => enterAbyss(picks, testRun), true) || !consumeEntryStability("infinite", "entry", true)) return false;
  const seed = ((random() * 0x7fffffff) >>> 0) || 1;
  const names = infVesselNames(); // 本編の隊を退ける前に読む
  G.abyss = { v: 2, started: true, testRun, depth: 1, seed, rule: null, guardFloor: 0, picks: [...picks], home: infStashHome(), savedIdx: G.dungeonIdx,
    allCommon: picks.every((k) => SOUL_CLASSES[k].rarity === "common"), trk: { sp: 0, at: 0, broke: false, rareAfx: 0, bossMax: 0 } };
  { const st = infStats(); st.runs++; for (const k of picks) st.jobs[k] = 1; }
  // 本編を退け、仮の器と無限迷宮の魂・通貨に差し替える
  G.inventory = [];
  G.reserve = [];
  G.souls = []; setSharedSouls(G.souls);
  G.gold = 0; G.soulPts = 0; G.embers = 0;
  G.party = picks.map((k, i) => makeVessel(i, k, names[i]));
  refreshStability();
  syncClueBoons(); // 手がかりの恵みは乗せない (clueBoon が無限迷宮では効かない)
  G.mutator = null;
  G.bossDown = false;
  G.portalFound = false;
  SFX.stairs();
  sheet.closeAll();
  townEl.classList.add("hidden");
  G.town.facility = null; G.town.sub = null;
  G.floor = 1;
  G.eliteFloor = false;
  G.specialFloor = null;
  G.stats.runs++;
  G.run = newRun();
  tlRunBegin(tlWhere(), G.party, { mode: "infinite" });
  G.lastRun = null;
  G._townMutator = null; G._departPre = false;
  G.activeRumor = null; // 噂は地図の迷宮のもの。無限迷宮では現実にならない (帰還時に更新する)
  G.state = "board";
  playBgm(fieldBgm());
  if (descendBtn) { descendBtn.classList.add("hidden"); descendBtn.disabled = true; }
  newFloor();
  if (!testRun) { infTlPoint("start"); infTlArrive(); }
  log(`✺ 隊は魂のひとかけを仮の器に移し、名もなき魂の欠片を宿して「${INF_NAME}」へ降りていく。力は風に吹き返されても、記憶は器に残る。`, "win");
  renderBoard();
  autosave(true);
  return true;
}
// 試遊: 無限迷宮の f 階から、隊Lv lv (0 = その階の推奨Lv) で始める。最初の魂は入口の3択の1つ目を選んだのと同じ
function infTestStart(f, lv) {
  const picks = [], used = new Set();
  for (let i = 0; i < INF_PARTY; i++) { const k = rollStartSouls(used)[0]; picks.push(k); used.add(k); }
  if (!enterAbyss(picks, true)) return;
  const L = Math.max(1, lv || Math.round(infLevel(f)));
  for (const s of G.souls) {
    s.capBonus = Math.max(0, L - soulLevelCap(s.clsKey, s.count));
    s.level = L; s.exp = 0;
  }
  recalcAllDolls();
  for (const d of G.party) { d.hp = d.maxhp; d.mp = d.maxmp; }
  G.gold = Math.round(refGold(L) * 20);
  G.floor = Math.max(1, f); G.abyss.depth = G.floor;
  G.abyss.rule = G.floor > 5 ? rollInfRule(null, G.floor) : null;
  G.abyss.trk.floorT = G.stats.playMs || 0;
  newFloor();
  infTlPoint("start");
  log(`(試遊) ${INF_NAME} B${G.floor}F から、隊Lv${L}で始める。`, "sys");
  renderBoard(); updateTopbar(); renderParty();
  playBgm(fieldBgm());
}
// 出撃シートの「無限迷宮」から入口へ (魂の3択を済ませてから呼ぶ)
function departAbyss(picks) {
  if (G.state !== "town" || G.prompt || G.abyss) return;
  if (!featureUnlocked("infinite")) { SFX.ng(); return; }
  if (blockForReport() || blockForTutorial()) return;
  G.prompt = true;
  uiDungeonHud.sceneTransition(() => { G.prompt = false; enterAbyss(picks); });
}

// ===== 宿敵の再戦 (第九章の結び = FEATURES.rematch、docs/unlocks.md) =====
// 一度倒した名のある強敵と迷宮の主の「記憶」に、闘技場跡の砂の上で挑み直す。出撃画面の「闘技場跡 ― 宿敵の再戦」から。
//  ・相手の Lv = max(その強敵・主の縄張りの最下階の推奨Lv, 隊のLv)。強さは縄張りの最下階の出方 (強敵の soloScale / 主の bossMul) を
//    その Lv の伸び (lvPow) に写して REMATCH_MUL 倍し、生前に無かった特色を1つ足す (REMATCH_TRAITS から、魔物ごとに決まる)
//  ・記憶との手合わせなので、終われば隊の HP・MP・状態は挑む前に戻る (倒れても砕けない。負け・逃走でも失うものは無い)。
//    入る時に迷宮と同じだけ魂の安定度を使う
//  ・勝てば ✦Soul・金貨 (その Lv の普通の1戦 × REMATCH_SPOILS)。名のある強敵は首級を ＋1 (最大 ＋REMATCH_FORGE_MAX) に鍛え、
//    主は初めて勝った時に記憶のかけら (story.js REMATCH_MEMORIES) を語る。土地・迷宮の掟と異変は効かない
//  ・戦いの間だけ G.dungeonIdx / G.floor を縄張りの迷宮の最下階に付け替え (背景・属性・状態異常の Lv がそれを読む)、終われば戻す
const REMATCH_MUL = 1.15;
const REMATCH_SPOILS = { named: 4, boss: 6 };
const REMATCH_FORGE_MAX = 5;
const REMATCH_TRAITS = [
  { key: "haste", label: "神速", has: (m) => !!m.haste, apply: (e) => { e.haste = true; e.agi += 8; } },
  { key: "regen", label: "再生", has: (m) => (m.regen || 0) >= 0.05, apply: (e) => { e.regen = Math.max(e.regen || 0, 0.05); } },
  { key: "endure", label: "不屈", has: (m) => !!m.endure, apply: (e) => { e.endure = true; } },
  { key: "barrier", label: "障壁", has: (m) => (m.barrier || 0) >= 2, apply: (e) => { e._barrierLeft = Math.max(e._barrierLeft || 0, 2); } },
  { key: "multi", label: "連撃", has: (m) => (m.multistrike || 0) >= 2, apply: (e) => { e.multistrike = 2; } },
  { key: "lifesteal", label: "吸血", has: (m) => (m.lifesteal || 0) >= 0.3, apply: (e) => { e.lifesteal = Math.max(e.lifesteal || 0, 0.3); } },
];
// 魔物ごとに決まった1つ (id の hash で選び、もう持っている特色は飛ばす)
function rematchTrait(key) {
  const m = MONSTERS[key] || {};
  let h = 2166136261;
  for (const c of String(key)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; // FNV-1a (毎回同じ1つに決まる)
  const cand = REMATCH_TRAITS.filter((t) => !t.has(m));
  return cand.length ? cand[h % cand.length] : null;
}
// 挑める相手: 倒したことのある名のある強敵 (縄張りが地図にあるもの) と、討った迷宮の主
function rematchList() {
  if (!featureUnlocked("rematch")) return [];
  const out = [];
  const bossIds = G.stats.bossIds || {};
  const wins = G.stats.rematch || {};
  for (const id of NAMED_IDS) {
    if (!MONSTERS[id] || codexKills(id) <= 0) continue;
    const homeIdx = DUNGEONS.findIndex((d, i) => worldOpenIdx(i) && (d.elites || []).includes(id));
    if (homeIdx < 0) continue;
    const nf = NAMED_FOES[id], tr = nf && ITEMS[nf.trophy];
    const held = tr ? heldTrophy(nf.trophy) : null;
    out.push({ key: id, kind: "named", name: MONSTERS[id].name, homeIdx, home: DUNGEONS[homeIdx].name, layer: DUNGEONS[homeIdx].layer || 1, lv: rematchLevel(DUNGEONS[homeIdx]),
      trait: (rematchTrait(id) || {}).label || null, wins: wins[id] || 0, trophy: tr ? { name: tr.name, held: !!held, forge: held ? held.forge || 0 : 0 } : null });
  }
  const seen = new Set();
  DUNGEONS.forEach((d, i) => {
    if (!d.boss || seen.has(d.boss) || !bossIds[d.boss] || !worldOpenIdx(i)) return;
    seen.add(d.boss);
    out.push({ key: d.boss, kind: "boss", name: MONSTERS[d.boss].name, homeIdx: i, home: d.name, layer: d.layer || 1, lv: rematchLevel(d),
      trait: (rematchTrait(d.boss) || {}).label || null, wins: wins[d.boss] || 0, memory: !!REMATCH_MEMORIES[d.boss], heard: !!worldState().beats["rm_" + d.boss] });
  });
  return out.sort((a, b) => (b.lv - a.lv) || (a.kind === b.kind ? 0 : a.kind === "boss" ? -1 : 1));
}
// 手本の迷宮: 挑む Lv を最下階で越える最初の本筋の迷宮 (主なら主のいる迷宮)。どれも越えなければ最後の本筋の迷宮
function rematchRef(kind, lv) {
  const main = DUNGEONS.filter((d) => !d.side && !d.challenge && (kind !== "boss" || d.boss) && (kind === "boss" || (d.elites || []).length));
  return main.find((d) => dungeonLevel(d, d.floors || 1) >= lv) || main[main.length - 1];
}
function rematchLevel(home) { return Math.max(dungeonLevel(home, home.floors || 1), partyLevel()); }
// 手元 (隊・控えの装備と袋) にある首級 (同じ品が複数あれば ＋N の高い方)
function heldTrophy(id) {
  let best = null;
  for (const d of allDolls()) for (const it of [...Object.values(d.equip || {}), ...(d.items || [])]) {
    if (it && it.id === id && (!best || (it.forge || 0) > (best.forge || 0))) best = it;
  }
  return best;
}
// 出撃画面から: 確かめて、闇に溶けて闘技場跡へ
function departRematch(key) {
  if (G.state !== "town" || G.prompt) return;
  if (!featureUnlocked("rematch")) { SFX.ng(); return; }
  if (blockForReport() || blockForTutorial()) return;
  const t = rematchList().find((x) => x.key === key);
  if (!t) { SFX.ng(); return; }
  if (!G.party.some((p) => p.alive)) { log("動ける人業がいない。", "sys"); SFX.ng(); return; }
  if (!stabilityReady(() => departRematch(key))) return;
  G.prompt = true;
  uiDungeonHud.sceneTransition(() => { G.prompt = false; beginRematch(t); });
}
function beginRematch(t) {
  if (G.state !== "town" || !consumeEntryStability("rematch")) return false;
  G.stabilityBriefed = true;
  const home = DUNGEONS[t.homeIdx];
  const snap = G.party.map((p) => ({ p, hp: p.hp, mp: p.mp, alive: p.alive, ailment: p.ailment || null, pct: p._poisonPct || null }));
  G.rematch = { key: t.key, kind: t.kind, lv: t.lv, homeIdx: t.homeIdx, savedIdx: G.dungeonIdx, savedFloor: G.floor, snap };
  sheet.closeAll();
  townEl.classList.add("hidden");
  G.town.facility = null; G.town.sub = null;
  G.dungeonIdx = t.homeIdx;
  G.floor = home.floors || 1;
  G.eliteFloor = false; G.specialFloor = null; G.mutator = null;
  G.run = newRun(); G.run.rematch = true;
  G.state = "board"; // startBattle が戦闘へ切り替える (inDungeon で迷宮の中として戦果・Lv を読む)
  if (descendBtn) { descendBtn.classList.add("hidden"); descendBtn.disabled = true; }
  // 強さ: 挑む Lv に近い本筋の迷宮 (手本の迷宮) の最下階の主・強敵の出方を、挑む Lv の伸びに写す。
  // (縄張りの迷宮の出方のままだと、序盤の主・強敵はランクが低く、Lv を上げても体が小さすぎる)
  const ref = rematchRef(t.kind, t.lv);
  const refLv = dungeonLevelRaw(ref, ref.floors || 1);
  const atRef = strengthAt(ref, ref.floors || 1);
  const k = lvPow(t.lv) / lvPow(refLv) * REMATCH_MUL;
  const tn = ref.tune || {};
  let foes;
  if (t.kind === "boss") {
    foes = spawnBossEnemies(t.key, (ref.bossScale || 1) * (tn.bossMul || 1) * atRef * k, ref.bossRank);
    if ((tn.bossHpMul || 1) !== 1) for (const e of foes) e.maxhp = e.hp = Math.max(1, Math.round(e.maxhp * tn.bossHpMul));
  } else {
    // 名のある強敵: 体 (HP・攻撃・防御・素早さ) と抵抗の格は手本の迷宮の強敵から。特色と見た目はその強敵のまま
    const tpl = spawnEliteEnemies((ref.elites || [])[0] || t.key, atRef * (tn.soloMul || 1) * k)[0];
    foes = spawnEliteEnemies(t.key, 1);
    for (const e of foes) {
      e.maxhp = e.hp = Math.max(1, Math.round(tpl.maxhp * resistHpMul(e.mon, true) / Math.max(0.01, resistHpMul(tpl.mon, true))));
      e.atk = tpl.atk; e.vit = tpl.vit; e.agi = Math.max(e.agi, tpl.agi);
      e.resists = monsterResists({ ...e.mon, rank: Math.max(e.mon.rank || 1, tpl.mon.rank || 1), elite: true, resists: e.mon.resistOverrides || {} });
      e._tuneK = tn.soloMul || 1;
    }
  }
  const tr = rematchTrait(t.key);
  for (const e of foes) { e._rematch = true; if (tr) tr.apply(e); }
  log(`闘技場跡の砂の上に、${foes[0].name}の記憶が立ち上がる (Lv${t.lv}${tr ? `・${tr.label}` : ""})。`, "dmg");
  if (tr) setTimeout(() => showToast(`記憶の${foes[0].name}は「${tr.label}」を身につけている`, { tone: "bad", noLog: true }), 400);
  startBattle(foes, null);
  return true;
}
// 戦いの終わり (勝ち・負け・逃走のどれでも): 隊を挑む前に戻し、勝っていれば戦果を渡して街へ
function endRematch(b) {
  const rm = G.rematch;
  G.autoCombat = false;
  if (G._autoTimer) { clearTimeout(G._autoTimer); G._autoTimer = null; }
  renderCombat();
  const win = b.result === "win";
  const restore = () => {
    for (const s of rm.snap || []) {
      const p = s.p;
      p.hp = Math.min(s.hp, p.maxhp); p.mp = Math.min(s.mp, p.maxmp); p.alive = s.alive; p.ailment = s.ailment; p._poisonPct = s.pct;
      p._dead = !s.alive; p.asleep = false; p.mind = null; p._defending = false;
    }
  };
  const finish = () => {
    G.prompt = true;
    uiDungeonHud.sceneTransition(() => { G.prompt = false; finishRematch(); });
  };
  if (!win) {
    restore();
    SFX.flee();
    const msg = b.result === "lose" ? `${rm ? MONSTERS[rm.key].name : "記憶"}に敗れた。記憶との手合わせなので、隊は何も失わない。` : "砂の上から退いた。記憶は、また呼べば立ち上がる。";
    log(msg, "sys");
    G.battle = null; G.state = "board";
    combatMenu.classList.add("hidden");
    showEvent({ banner: "⚔ 宿敵の再戦 ⚔", title: b.result === "lose" ? "記憶に敗れた" : "試合を降りた", accent: "#c9a24a", lines: [msg], btnLabel: "街へ戻る", noLog: true, onClose: finish });
    return;
  }
  const lv = rm.lv;
  const mult = REMATCH_SPOILS[rm.kind] || 4;
  const soulOut = {};
  const goldGot = runGainGold(Math.round(refGold(lv) * mult) * 2, "rm");
  const soulGot = runGainSoulPts(Math.round(refSoul(lv) * mult), "rm", null, 1, soulOut);
  applyVictoryPassives();
  const progress = distributeBattleSoulExp(soulOut.raw ?? soulGot);
  restore();
  G.stats.rematch = G.stats.rematch || {};
  G.stats.rematch[rm.key] = (G.stats.rematch[rm.key] || 0) + 1;
  G.stats.rematchWins = (G.stats.rematchWins || 0) + 1;
  const name = MONSTERS[rm.key].name;
  log(`${name}の記憶を打ち破った！ 💰${goldGot} と ✦${soulGot} Soul を得た。`, "win");
  SFX.victory(); flashScreen("#ffd84a");
  // 名のある強敵: 首級を ＋1 に鍛える
  const notes = [];
  if (rm.kind === "named") {
    const nf = NAMED_FOES[rm.key], it = nf ? heldTrophy(nf.trophy) : null;
    if (!it) notes.push(`首級「${nf && ITEMS[nf.trophy] ? ITEMS[nf.trophy].name : "首級"}」が手元に無いので、鍛えられなかった。`);
    else if ((it.forge || 0) >= REMATCH_FORGE_MAX) notes.push(`首級「${ITEMS[it.id].name}」は、もう ＋${REMATCH_FORGE_MAX} まで鍛え上がっている。`);
    else {
      it.forge = (it.forge || 0) + 1;
      resyncItem(it);
      const d = allDolls().find((x) => (x.items || []).includes(it) || Object.values(x.equip || {}).includes(it));
      if (d) { recalcDoll(d); d.hp = Math.min(d.hp, d.maxhp); d.mp = Math.min(d.mp, d.maxmp); }
      notes.push(`記憶の打ち合いで、首級「${itemName(it)}」が鍛え上がった (＋${it.forge})。`);
      G.stats.trophyForged = (G.stats.trophyForged || 0) + 1;
    }
    for (const n of notes) log(n, "win");
  }
  const levels = progress.filter((q) => q.kind === "level").map((q) => ({ name: q.member.name, uid: q.member.uid, from: q.fromLv, to: q.toLv, deltas: q.deltas || [], sub: !!q.sub, soulLabel: q.soulLabel || "" }));
  const skills = progress.filter((q) => q.kind === "skill").map((q) => ({ name: q.member.name, key: q.skill, skill: SPELLS[q.skill] ? SPELLS[q.skill].name : q.skill, desc: SPELLS[q.skill] ? SPELLS[q.skill].desc : "" }));
  for (const l of levels) log(`${l.name}${l.sub && l.soulLabel ? `のサブ魂「${l.soulLabel}の魂」` : ""}が Lv${l.from} → Lv${l.to} に上がった！`, "win");
  for (const k of skills) log(`${k.name}は「${k.skill}」を覚えた！`, "win");
  G.battle = null; G.state = "board";
  combatMenu.classList.add("hidden");
  const mem = rm.kind === "boss" && REMATCH_MEMORIES[rm.key] && !worldState().beats["rm_" + rm.key] ? REMATCH_MEMORIES[rm.key] : null;
  uiResults.openResults({
    kind: "rematch", gold: goldGot, soul: soulGot, kills: 1, fled: 0,
    levels, skills, souls: [], levelUps: levelUpEntries(progress), chest: null,
    onDone: () => {
      const after = () => finish();
      if (notes.length) showToast(notes[notes.length - 1], { tone: "good", noLog: true });
      if (mem) {
        worldState().beats["rm_" + rm.key] = 1;
        UI.playStoryChain([{ title: mem.title, lines: storyLines(mem.lines), art: mem.art, who: "none", kicker: "記憶のかけら", btnLabel: "胸に刻む" }], after);
      } else after();
    },
  });
}
function finishRematch() {
  const rm = G.rematch;
  G.rematch = null;
  G.state = "town";
  G.battle = null; G.battleCell = null;
  if (rm) { G.dungeonIdx = rm.savedIdx; G.floor = rm.savedFloor || 1; }
  G.run = null;
  G.autoCombat = false;
  sheet.closeAll();
  combatMenu.classList.add("hidden");
  if (townBtn) townBtn.classList.add("hidden");
  if (descendBtn) { descendBtn.classList.add("hidden"); descendBtn.disabled = true; }
  updateTopbar();
  renderDock();
  renderTown();
  autosave(true);
}
// 読み込んだセーブが再戦の途中だった: 試合は無かったことにして、隊を挑む前に戻して街へ
function abortRematch() {
  const rm = G.rematch;
  if (rm) for (const s of rm.snap || []) { const p = s.p; if (!p) continue; p.hp = Math.min(s.hp, p.maxhp || s.hp); p.mp = Math.min(s.mp, p.maxmp || s.mp); p.alive = s.alive; p.ailment = s.ailment; p._poisonPct = s.pct; p._dead = !s.alive; }
  finishRematch();
}
// 無限迷宮の入口は出撃シートの1ページ。旧来の入口 (広場の「奈落」) もそこを開く
function openAbyssSetup() {
  if (!featureUnlocked("infinite")) { log(`${INF_NAME}はまだ開いていない。`, "sys"); SFX.ng(); return; }
  UI.openDeparture({ page: "abyss" });
}

// 街へ帰還 (戦利品は保持)。opts.outcome: return (帰還陣) | clear (踏破) | wipe (全滅・没収) | saved (赤い魂で生還)
// opts.run: 要約に使う出撃の記録 (全滅で没収した後でも、何を得て何を失ったかを残すため)
function returnToTown(opts = {}) {
  const runRef = opts.run !== undefined ? opts.run : G.run;
  const outcome = opts.outcome || (runRef && runRef.secured ? "clear" : "return");
  if (inDungeon()) tlRunEnd(tlWhere(), G.party, outcome);
  // 無限迷宮: 本編の隊・魂・通貨を戻し、持ち帰るもの (拾った魂・品・残火) を本編へ渡す。帰還の報告は無限迷宮の結果のシートが代わる
  const infSummary = G.abyss ? infCloseRun(outcome) : null;
  restockElixirs(); // 霊薬の帳面 (手がかりの恵み)
  if (!infSummary) evOnReturn(runRef, outcome); // 迷宮のイベント: 報奨金・紅玉の売却 (全滅以外)
  // 帰還の報告 (D2) は迷宮選択の巻き戻しより前に要約する (迷宮名・深さを正しく残す)
  const summary = infSummary ? null : runSummary(runRef, outcome, { forfeited: opts.forfeited || null });
  G.state = "town";
  G.battle = null; G.battleCell = null;
  G.eliteFloor = false;
  G.specialFloor = null;
  G.mutator = null; // 迷宮の異変は出撃単位 (帰還で解除)
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
  if (summary) summary.dead = G.party.filter((d) => d && d.isDoll && !d.alive).map((d) => ({ uid: d.uid, name: d.name }));
  G.lastRun = summary;
  // 酒場の顔ぶれと掲示板の依頼は帰還のたびに入れ替わる (受けた依頼は残る)。
  // ただし潜り始めの階から降りず、何も得ずに戻っただけ (帰還魔法陣で入ってすぐ出た) なら貼り替えない
  if (!idleRun(runRef)) {
    rollTavernCrowd();
    rollQuestBoard();
  }
  refreshRumor(); // 空戻り・全滅・無限迷宮も含め、帰還のたびに噂を更新する
  updateTopbar();
  log(infSummary ? (outcome === "wipe" ? `仮の器は${INF_NAME}の底で崩れた。` : `仮の器は崩れ、${INF_NAME}から街へ戻った。`) : outcome === "wipe" ? "砕けた人業を残し、街へ戻った。" : "街へ帰還した。", "sys");
  G.town.facility = null; G.town.sub = null; G.town.page = null; G.town.tab = "hub";
  renderDock();
  renderTown();
  autosave(true);
  const repairTutorial = infSummary ? false : (UI.tutorialAfterReturn?.() || false);
  if (infSummary) { if (UI.openInfSummary) setTimeout(() => UI.openInfSummary(infSummary), 300); }
  // 帰還の報告は街の広場 (WP-A) が夜景の右下に札 (.hb-rr、押すとシート) として置く。まだ置かれていなければ、シートで見せる
  else if (!repairTutorial) setTimeout(() => {
    if (G.state === "town" && G.lastRun && !G.lastRun.dismissed && !document.querySelector(".rr-card, .hb-rr") && !uiBlocked() && UI.openRunReport) UI.openRunReport();
  }, 450);
  // §7 M9 帰還時に宿で休む (設定で選んだ時だけ。宿賃は宿屋と同じ)
  if (!infSummary && !repairTutorial && outcome !== "wipe" && uiDungeonHud.getPref("autoRest")) {
    let c = null;
    try { c = ops.counts(); } catch (e) { c = null; }
    if (c && c.hurt > 0 && G.gold >= c.innCost) setTimeout(() => { if (G.state === "town") ops.restParty(); }, 600);
  }
}
// 潜り始めの階から降りず、戦わず、何も得ずに帰ってきた出撃か
function idleRun(r) {
  if (!r || r.startFloor == null || r.descended) return false;
  return !(r.kills || r.gold || r.soulPts || (r.items || []).length || (r.souls || []).length);
}
// 闇に溶けて街へ戻る (帰還陣・踏破の凱旋・全滅の決断の後)
function leaveDungeon(opts = {}) {
  G.prompt = true;
  uiDungeonHud.sceneTransition(() => { G.prompt = false; returnToTown(opts); });
}

// 帰還できるか (帰還陣を発見済み/その上に立っている/主を討った)
function canReturnNow() {
  const cell = G.board && G.board.cells[G.py] && G.board.cells[G.py][G.px];
  const onPortal = cell && (cell.type === "portal" || (cell.type === "stairs" && cell.gate));
  return !!(onPortal || G.bossDown || G.portalFound);
}
function confirmReturnToTown() {
  if (G.state !== "board" || G.anim || G.walking || uiBlocked()) return;
  // 帰還制限: 帰還魔法陣を発見済み (この階で踏んだ)、その上に立っている、または主を討っていれば帰れる
  if (!canReturnNow()) {
    SFX.ng(); buzz(20);
    showEvent({
      sprite: ICONS.portal, noLog: true, banner: "⚠ 帰還できない ⚠", title: "帰り道は閉ざされている",
      accent: "#7fd0ff",
      lines: abyssActive()
        ? [`${INF_NAME}に帰還魔法陣は無い。`, "5の倍数の階の風だまりで主を討てば、そこから帰れる。", "全滅すれば、赤い魂を払わない限り何も持ち帰れない。"]
        : ["迷宮は一度入ると容易には出られない。", "「帰還魔法陣」を見つけて踏むか、迷宮を踏破すれば帰還できる。", "魔法陣は5階・10階…と5階ごとに、必ず出現する。"],
      btnLabel: "心得た",
      onClose: () => renderBoard(),
    });
    return;
  }
  if (abyssActive()) { openInfRest(); return; } // 無限迷宮: 主を討った風だまりで「帰る / 続ける」を選ぶ
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
  ], ICONS.portal, { banner: "✦ 帰還魔法陣 ✦", accent: "#7fd0ff", logAs: true,
    lines: ["この陣を見つけたので、この階のどこからでも下の「帰還」で街へ戻れる。"],
    onDismiss: () => renderBoard() });
}

// ===== 帰還魔法陣の階 (台帳の迷宮: 5階・10階…・最下階を除く) =====
// 下り階段の代わりに立つ陣。踏むと「先へ進む / 街へ帰る」を選ぶ。到達した陣の階は記録され、
// 次に潜る時は出撃シートで陣の次の階から潜り始められる (G.world.gates[id] = 到達した最深の陣の階)
function noteGateReached(cfg, floor) {
  const w = worldState();
  if (!cfg || !cfg.id || (w.gates[cfg.id] || 0) >= floor) return false;
  w.gates[cfg.id] = floor;
  log(`帰還魔法陣 B${floor}F に到達した。次からは B${floor + 1}F から潜り始められる。`, "win");
  showToast(`✦ 帰還魔法陣 B${floor}F ― 次回は B${floor + 1}F から潜れる`, { noLog: true, tone: "good" });
  autosave(true);
  return true;
}
function askGate(cell, { arrival = false } = {}) {
  const cfg = curDungeon();
  noteGateReached(cfg, G.floor);
  G.portalFound = true;
  updateReturnBtn();
  const next = G.floor + 1;
  const bottom = next >= (cfg.floors || 1);
  showChoice(arrival ? `帰還魔法陣を抜けて、B${G.floor}F に降り立った。` : "帰還魔法陣が淡く輝いている。", [
    { label: `先へ進む ― B${next}F${bottom ? (cfg.boss ? " (主の間)" : " (最下階)") : ""}`, primary: true, fn: () => descend() },
    { label: "街へ帰還する ― 戦利品は持ち帰る", fn: () => leaveDungeon({ outcome: G.run && G.run.secured ? "clear" : "return" }) },
    { label: arrival ? "この階を探索する" : "まだ探索する", fn: () => { if (cell) cell.stairsSeen = true; renderBoard(); } },
  ], ICONS.portal, { banner: `✦ 帰還魔法陣 B${G.floor}F ✦`, accent: "#7fd0ff", logAs: true,
    lines: ["この階のどこからでも、下の「帰還」で街へ戻れる。", "陣に至った迷宮は、次回この次の階から潜り始められる。"],
    onDismiss: () => { if (cell) cell.stairsSeen = true; renderBoard(); } });
}
// 潜り始められる階 (1 と、到達した帰還魔法陣の次の階 — 陣の階は踏破済みなので飛ばす)
function startFloorsOf(cfg) {
  if (!cfg || !cfg.id) return [1];
  const reach = worldState().gates[cfg.id] || 0;
  return [1, ...gateFloors(cfg).filter((f) => f <= reach).map((f) => Math.min(f + 1, cfg.floors || f + 1))];
}
// 隊のLv (編成の魂Lvの平均。出撃シートの推奨Lvとの比べに使う)
function partyLevel() {
  const ds = (G.party || []).filter((d) => d && d.primary != null);
  if (!ds.length) return 1;
  return Math.round(ds.reduce((a, d) => a + (d.jobLv || 1), 0) / ds.length);
}
// まだ見つけていない師の手がかりがある迷宮か (出撃シートの印)
function storyCellPending(cfg) {
  const w = worldState();
  return !!cfg && Object.keys(STORY_CELLS).some((k) => STORY_CELLS[k].dungeon === cfg.id && !w.found[k]);
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
  return (p.spells || []).filter((k) => { const sp = SPELLS[k]; return sp && sp.target !== "self" && (sp.kind === "heal" || sp.kind === "cure" || sp.cure) && skillUsable(k); });
}

const spellCures = (sp) => sp.kind === "cure" || !!sp.cure;
const spellHeals = (sp) => healsHp(sp);
// 戦闘外の回復量の基準 (戦闘と同じ式 = combat.js spellHealRaw。実際はこれ + 0〜3割の揺らぎ)。
// 対象 t を渡すと頭打ち (healCap)・割合回復 (healPct) を含めた最低値。省略時は隊でいちばん最大HPの小さい者を基準にした最低値 (見積もり用)
function campHealPower(caster, sp, t = null) {
  if (!t) {
    const mins = G.party.filter((x) => x.maxhp > 0).map((x) => x.maxhp);
    t = { maxhp: mins.length ? Math.min(...mins) : 1 };
  }
  return healOnTarget(sp, t, spellHealRaw(caster, sp, caster.pie || 0));
}
// 生きている1体へ回復呪文の効果 (状態異常の治療・HP回復) を与える。何か起きたら true
// 戦闘外の回復で、最後に唱えた回復量 (満タンで上限に切られた分も含む素の値)。結果の表示に使う
const CAMP_HEAL = new WeakMap();
function campApplyAlive(...args) { return tlGameMeasure("camp", () => campApplyAliveMeasured(...args)); }
function campApplyAliveMeasured(caster, sp, t) {
  let did = false;
  if (canSpellCure(sp, t) && cureBySpell(sp, t)) { log(`${sp.name}！ ${t.name}の状態異常が治った`, "heal"); did = true; }
  if (spellHeals(sp)) {
    // 満タンの仲間にも回復量は見せる (HP は増えない・それだけでは「効果あり」にしない)
    const raw = spellHealRaw(caster, sp, caster.pie || 0);
    const heal = healOnTarget(sp, t, raw + rand(Math.ceil(raw * 0.3) + 1));
    CAMP_HEAL.set(t, heal);
    if (t.hp < t.maxhp) {
      t.hp = Math.min(t.maxhp, t.hp + heal);
      log(`${sp.name}！ ${t.name}のHPが ${heal} 回復`, "heal");
      did = true;
    }
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
function campRevive(...args) { return tlGameMeasure("camp", () => campReviveMeasured(...args)); }
function campReviveMeasured(caster, sp, t) {
  const heal = (sp.revivePct ? Math.round(t.maxhp * sp.revivePct) : Math.max(1, campHealPower(caster, sp, t)))
    + Math.round(t.maxhp * rankVal(caster, "priestInochi", [0.10, 0.20, 0.30, 0.50])); // 生命の灯 (僧侶のランク)
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
// 呪文の組み合わせ (唱える順の一覧) を決める。def = 各人のHPの不足, ail = 各人の状態異常の種類。
// 呪文ごとの見積もりは、唱えうる者の中で最も弱い回復量・最も重い MP (誰が唱えても足りる側)。
//  全体呪文で合計 h 以上を癒す最少MP (allDP) + 残りを1人ずつ単体呪文で埋める最少MP (oneDP) を、h ごとに比べて最小を取る。
//  状態異常は、該当する種類を治せる単体技または全員の異常を覆う全体技で治す。種類の異なる全体技の組み合わせは貪欲法で補う。
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
  // 単体: S0[d] = d を埋める最少MP、singleCures = 異常の種類ごとに治療を含める最少MP
  const S0 = new Array(D + 1).fill(Infinity), S0k = new Array(D + 1).fill(null);
  S0[0] = 0;
  for (let d = 1; d <= D; d++) for (const k of oneK) {
    if (!k.heals) continue;
    const v = k.cost + HEAL_CAST_EPS + S0[Math.max(0, d - k.pow)];
    if (v < S0[d]) { S0[d] = v; S0k[d] = k; }
  }
  const singleCures = new Map();
  for (const kind of new Set(ail.filter(Boolean))) {
    const cost = new Array(D + 1).fill(Infinity), keys = new Array(D + 1).fill(null);
    for (let d = 0; d <= D; d++) for (const k of oneK) {
      if (!spellCureKinds(k.sp).includes(kind)) continue;
      const v = k.cost + HEAL_CAST_EPS + S0[Math.max(0, d - k.pow)];
      if (v < cost[d]) { cost[d] = v; keys[d] = k; }
    }
    singleCures.set(kind, { cost, keys });
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
    if (!k.cures || ail.some(kind => kind && !spellCureKinds(k.sp).includes(kind))) continue;
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
        v += ail[i] && !cured ? singleCures.get(ail[i]).cost[d] : S0[d];
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
    if (ail[i] && !pick.cured) { const k = singleCures.get(ail[i]).keys[d]; steps.push({ k, t: i }); d = Math.max(0, d - k.pow); }
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
        const ts = a.all ? def.map((_, i) => i) : def.map((_, i) => i).filter((i) => (a.heals && def[i] > 0) || (a.cures && spellCureKinds(a.sp).includes(ail[i])));
        for (const t of (a.all ? [-1] : ts)) {
          let gain = 0;
          for (const i of (t < 0 ? ts : [t])) {
            if (a.heals) gain += Math.min(def[i], a.pow);
            if (a.cures && spellCureKinds(a.sp).includes(ail[i])) gain += 1000;
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
      if (pick.a.cures && spellCureKinds(pick.a.sp).includes(ail[i])) ail[i] = null;
    }
    mp[pick.ci] -= pick.a.cost;
    out.push(pick);
  }
  return done() ? out : null;
}
function healAll(...args) { return tlGameMeasure("camp", () => healAllMeasured(...args)); }
function healAllMeasured() {
  const fail = (msg, tone = "info") => { log(msg, "sys"); showToast(msg, { noLog: true, tone }); SFX.miss(); };
  if (!healAllNeed()) {
    if (G.party.some((t) => !t.alive)) return fail("倒れた仲間を蘇らせる呪文を使える者がいない");
    return fail("隊は皆、傷も穢れもない");
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
    const d = targets.map((t) => Math.max(0, t.maxhp - t.hp)), a = targets.map((t) => t.ailment || null);
    if (a.some(Boolean) && !casters.some((c) => c.acts.some((x) => x.cures))) return null;
    if (d.some((v) => v > 0) && !casters.some((c) => c.acts.some((x) => x.heals))) return null;
    const plan = planHealAllDP(d, a, casters);
    return (plan && assignHealCasters(plan.steps, casters)) || planHealAllGreedy(d, a, casters);
  };
  let steps = casters.length && healAllNeed() ? planFrom() : null;
  for (let guard = 0; steps && steps.length && guard < 300; guard++) {
    const { ci, a, t } = steps[0];
    const caster = casters[ci].p;
    const hit = targets.filter((x, i) => (t < 0 || t === i) && ((a.heals && x.hp < x.maxhp) || (a.cures && canSpellCure(a.sp, x))));
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
    const pick = bestOf(casters, (a) => {
      const n = ill.filter(t => canSpellCure(a.sp, t)).length;
      return n ? (a.all ? n : 1) / a.cost + a.pow * HEAL_CAST_EPS * 1e-3 : 0;
    });
    if (!pick) break;
    const t = pick.a.all ? null : ill.filter(x => canSpellCure(pick.a.sp, x)).sort((x, y) => x.hp / x.maxhp - y.hp / y.maxhp)[0];
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
    const canCure = casters.some((c) => c.acts.some((a) => targets.some(t => canSpellCure(a.sp, t)))), canHeal = casters.some((c) => c.acts.some((a) => a.heals));
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
  if (!sp || !skillUsable(spellKey)) { showToast("呪文を封じる霧が言葉を吸いこむ ― ここでは唱えられない", { tone: "bad" }); SFX.miss(); return; }
  const cost = spellCost(caster, sp);
  if (caster.mp < cost) { log("MPが足りない。", "sys"); showToast(`MPが足りない (MP ${caster.mp}/${cost})`, { noLog: true, tone: "bad" }); SFX.miss(); return; }
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
  const finish = () => { tlGameMeasure("camp", () => { caster.mp -= cost; }); SFX.heal(); buzz(15); renderStatus(); renderParty(); };
  // 1人ぶんの結果 (蘇生 / 満タン / 回復量)
  // 回復量は満タンでも素の値で見せる (戦闘中の「+N」と同じ)
  const healLineFor = (t, before, wasDead) => {
    if (wasDead && t.alive) return `${t.name}が蘇った (HP ${t.hp}/${t.maxhp})`;
    const raw = CAMP_HEAL.get(t);
    CAMP_HEAL.delete(t);
    if (raw == null) return null;
    return `${t.name} HP+${raw}${t.alive && t.hp >= t.maxhp ? "（満タン）" : ""}`;
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
    if (any) { finish(); showToast(`${sp.name} ― ${lines.length ? lines.join(" ・ ") : "隊を癒した"}`, { tone: "good" }); }
    else { log("効果のある対象がいない。", "sys"); showToast(noTargetMsg(), { noLog: true, tone: "info" }); SFX.miss(); }
    return;
  }

  // 単体: 効果のある対象だけを候補にする (HP満タンへの回復・状態異常なしへの治療は不可)
  const benefits = (t) => {
    if (!t.alive) return !!sp.revive;
    if (cures && canSpellCure(sp, t)) return true;
    if (heals && t.hp < t.maxhp) return true;
    return false;
  };
  const targets = G.party.filter(benefits);
  if (!targets.length) { log("効果のある対象がいない。", "sys"); showToast(noTargetMsg(), { noLog: true, tone: "info" }); SFX.miss(); return; }
  const castOn = (t) => {
    const before = t.hp, wasDead = !t.alive;
    if (applyTo(t)) {
      finish();
      showToast(`${sp.name} ― ${heals ? (healLineFor(t, before, wasDead) || `${t.name}は満タン`) : `${t.name}を癒した`}`, { tone: "good" });
    } else { log("効果のある対象ではなかった。", "sys"); showToast("効果がなかった", { noLog: true, tone: "info" }); }
  };
  uiParty.pickTarget({ banner: sp.name, accent: "#46c08f", title: "誰に唱える？",
    lines: [`消費 MP${cost}（${caster.name} MP ${caster.mp}/${caster.maxmp}）`], targets, onPick: castOn });
}

// 表示ヘルパ (soulStatText・属性/スキル/品の表示・equipPreviewDelta・equipCompareEl・detailLines など) は
// src/ui/itemview.js へ移設 (import 済み)

// 品の詳細 (窓口)。隊の操作 (装備・使う・渡す・鑑定、迷宮では捨てる) つきの品シートを開く
// (WP-C の UI.itemSheet があればそれに actions を渡し、無ければ隊の自前のシート)。p = 持ち主 (null 可)
function showItemDetailPopup(p, sel) {
  if (!sel || !sel.item) return null;
  return uiParty.openItem(sel.item, p, sel);
}

// 未鑑定品の詳細ポップアップ (旧来の .ig-choices) に「鑑定する」アクションを足す。
// 街でのみ、鑑定の心得がある者 (隊と控え) がいればその場で試せる。失敗済み (idHardFail) は商会送り。
// 新しい品シート (UI.itemSheet) は自前の「鑑定を試す / 鑑定する」を持つ。これは旧画面の互換用
function addIdentifyAction(acts, it, close) {
  const off = (label) => { const b = btn(label, () => {}); b.disabled = true; acts.appendChild(b); };
  if (it.idHardFail) return off("鑑定に失敗した品 (商会でのみ鑑定できる)");
  if (G.state !== "town") return off("鑑定は街でのみできる");
  const idmen = townAppraisers();
  if (!idmen.length) return off("鑑定できる者がいない");
  acts.appendChild(btn("鑑定を試す (技)", () => { close(); openIdentifyChooser(it); }));
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

// スキル鑑定を実行。成功で正体判明、失敗で idHardFail (以後は商会でのみ鑑定可)。成功なら true
// 鑑定は街でのみ (迷宮では何もしない)
// quiet: 音・トースト・描き直し・保存を呼び出し側 (鑑定を試みるの演出 src/ui/appraise.js) に任せる
function doIdentifySkill(m, it, { quiet = false } = {}) {
  if (!it || !it.unidentified || it.idHardFail) return false;
  if (G.state !== "town") return false;
  const ch = identifyChance(m, it);
  const practice = prologuePhase() === "appraise" && it === prologueAppraisalItem() && canIdentify(m);
  const ok = practice || random() < ch;
  if (ok) {
    const first = revealIdentity(it);
    if (practice) { prologue().appraised = true; autosave(true); }
    log(`${m.name}は ${it.name} を鑑定した！${first ? " (初ゲット！)" : ""}`, "win");
    if (!quiet) { SFX.itemget(); buzz(15); showToast(`${first ? "初ゲット！ " : ""}${it.name} と判明した (${m.name})`, { noLog: true, tone: "good" }); }
  } else {
    it.idHardFail = true;
    log(`${m.name}の鑑定は失敗した… この品は商会でしか鑑定できなくなった。`, "sys");
    if (!quiet) { SFX.ng(); buzz([0, 30, 40, 30]); showToast("鑑定に失敗した… もう商会でしか鑑定できない", { noLog: true, tone: "bad" }); }
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
  else { SFX.ng(); if (r.msg) showToast(r.msg, { noLog: true, tone: "bad" }); }
  renderStatus(); renderParty();
  return r;
}

// アイテムが指定スロットに装備可能か (種別の一致)。p を渡すと、二刀流の人業は片手武器を盾の欄 (左手) にも収められる
function itemFitsSlot(it, slotKey, p = null) {
  if (!it || it.slot === "use") return false;
  if (slotKey === "acc1" || slotKey === "acc2") return it.slot === "acc";
  if (slotKey === "shield" && it.slot === "weapon") return !!p && canOffhand(p, it);
  return it.slot === slotKey;
}

// p の slotKey に it を装備する (owner = it を袋に持っている人業。自分なら p)。
// 規則は items.js の equip() と同じ (職・未鑑定・両手武器⇄盾・呪いは外れない・共有の所持枠50) だが、
// 装飾品は「指定した枠」に付ける。stashTo を渡すと、外れた装備は p ではなくその人業の袋へ入る
// (p の袋が満杯の時の「持ち主と取り替える」)。成否 { ok, msg, displaced, full }
function equipAt(p, it, slotKey, owner = p, stashTo = null) {
  if (!it || !itemFitsSlot(it, slotKey, p)) return { ok: false, msg: "その部位には装備できない" };
  if (!canEquip(p, it)) return { ok: false, msg: equipFailMsg(p, it) };
  const tr = autoEquip.trialEquip(p.equip, it, slotKey);
  if (!tr) {
    const pin = [p.equip[slotKey], it.slot === "weapon" && it.twoHanded ? p.equip.shield : null, slotKey === "shield" && p.equip.weapon && p.equip.weapon.twoHanded ? p.equip.weapon : null]
      .find((x) => autoEquip.isPinned(x));
    return { ok: false, msg: pin && !pin.cursed ? `${pin.name}はロック中 ― ロックを外すと付け替えられる` : "呪われた装備が外れない" };
  }
  const bag = stashTo || p;
  const bagAfter = bag.items.length - (owner.items === bag.items ? 1 : 0) + tr.displaced.length;
  if (bagAfter > MAX_ITEMS) return { ok: false, full: true, msg: "隊の持ち物がいっぱいで、外した装備を入れられない" };
  const i = owner.items.indexOf(it);
  if (i < 0) return { ok: false, msg: "" };
  owner.items.splice(i, 1);
  for (const k of SLOTS) p.equip[k] = tr.equip[k] || null;
  for (const x of tr.displaced) bag.items.push(x);
  recalcDoll(p);
  p.hp = Math.min(p.hp, p.maxhp); p.mp = Math.min(p.mp, p.maxmp);
  return { ok: true, msg: `${p.name}は ${it.name} を装備した`, displaced: tr.displaced };
}

// 仲間 (wearer) が装備している品 it を外して、p の部位 slotKey に装備する (装備候補の「仲間が装備している品」から)。
// 外れた p の装備を仲間がその部位に付けられるなら付ける (装備の交換。autoequip.js swapBackFor)。付けられなければ
// p の袋へ入り、仲間の部位は空く。呪われた品・ロック中の品は動かさない (ロックは呼ぶ側で外してから)
function equipFromWearer(p, it, slotKey, wearer) {
  if (!p || !it || !wearer || p === wearer) return { ok: false, msg: "" };
  const wk = SLOTS.find((k) => wearer.equip && wearer.equip[k] === it);
  if (!wk) return { ok: false, msg: `${wearer.name}は ${it.name} を装備していない` };
  if (it.cursed) return { ok: false, msg: `${it.name}は呪われていて外せない` };
  if (it.locked) return { ok: false, msg: `${it.name}はロック中 ― ロックを外すと付け替えられる` };
  if (!itemFitsSlot(it, slotKey, p)) return { ok: false, msg: "その部位には装備できない" };
  if (!canEquip(p, it)) return { ok: false, msg: equipFailMsg(p, it) };
  const tr = autoEquip.trialEquip(p.equip, it, slotKey);
  if (!tr) {
    const pin = [p.equip[slotKey], it.slot === "weapon" && it.twoHanded ? p.equip.shield : null, slotKey === "shield" && p.equip.weapon && p.equip.weapon.twoHanded ? p.equip.weapon : null]
      .find((x) => autoEquip.isPinned(x));
    return { ok: false, msg: pin && !pin.cursed ? `${pin.name}はロック中 ― ロックを外すと付け替えられる` : "呪われた装備が外れない" };
  }
  // 外れるこちらの装備を仲間が付けられるなら、空いた部位へ付けて交換にする (付けられなければ仲間の部位は空き、こちらの袋へ)
  const back = autoEquip.swapBackFor(wearer, wk, tr.displaced, canEquip);
  const toBag = tr.displaced.filter((x) => x !== back);
  if (p.items.length + toBag.length > MAX_ITEMS) return { ok: false, full: true, msg: "隊の持ち物がいっぱいで、外した装備を入れられない" };
  wearer.equip[wk] = back || null;
  recalcDoll(wearer);
  wearer.hp = Math.min(wearer.hp, wearer.maxhp); wearer.mp = Math.min(wearer.mp, wearer.maxmp);
  for (const k of SLOTS) p.equip[k] = tr.equip[k] || null;
  for (const x of toBag) p.items.push(x);
  recalcDoll(p);
  p.hp = Math.min(p.hp, p.maxhp); p.mp = Math.min(p.mp, p.maxmp);
  const msg = back
    ? `${p.name}と${wearer.name}が装備を交換した (${p.name} ← ${it.name} / ${wearer.name} ← ${back.name})`
    : `${p.name}は ${wearer.name} の ${it.name} を譲り受けて装備した`;
  return { ok: true, msg, displaced: toBag, swapped: back || null };
}

// 装備候補 (窓口)。隊の「装備候補」シート (すべての袋から・伸びの順) を開く
function openEquipChooser(p, slotKey) { return uiParty.openCandidates(p, slotKey); }

// 候補(自分/他キャラの所持品)を p の slotKey に装備する
function equipFromAnywhere(p, slotKey, c) {
  const { it, owner } = c;
  const r = equipAt(p, it, slotKey, owner || p);
  if (r.msg) log(r.msg, r.ok ? "win" : "sys");
  if (r.ok && owner && owner.items !== p.items) log(`${owner.name} から ${it.name} を受け取り装備した。`, "win");
  if (r.ok) { SFX.select(); buzz(10); } else { SFX.ng(); if (r.msg) showToast(r.msg, { noLog: true, tone: "bad" }); }
  renderStatus(); renderParty();
  return r;
}
// 装備のロック (品ごと。it.locked はセーブに残り、目録の付け直し reflattenItemStats でも消えない)。
// ロックした品は売れない・捨てられない・外せない・最適装備や付け替えで押し出されない (autoequip.js isPinned)
function toggleItemLock(it) {
  if (!it || it.unidentified || !isEquippable(it)) return false;
  if (it.locked) delete it.locked; else it.locked = true;
  SFX.select(); buzz(8);
  showToast(it.locked ? `${it.name}をロックした ― 売却・付け替えの対象にならない` : `${it.name}のロックを外した`, { tone: "info" });
  autosave(true);
  renderStatus(); renderParty();
  return !!it.locked;
}
function doUnequip(p, key) {
  // 袋がいっぱい: 袋の品を1つ捨てて空けてから外す (docs/infinite-labyrinth.md 18章)
  const cur = p && p.equip && p.equip[key];
  if (cur && !cur.cursed && !cur.locked && p.items.length >= MAX_ITEMS && UI.openDiscard) {
    askRoomFor(cur, (who) => { if (who) doUnequip(p, key); }, [p], {
      title: `${itemName(cur)} を外すには、${p.name}の袋の品を1つ捨てる`, skipLabel: "やめる", incomingSub: "外す装備",
      lines: [`${p.name}の持ち物がいっぱいだ。袋の品を1つ捨てると、外した装備がその空きに入る。捨てた品は二度と戻らない。ロックした品は出ない。`] });
    return { ok: false, asked: true };
  }
  const r = unequipItem(p, key);
  if (r.msg) log(r.msg, r.ok ? "sys" : "dmg");
  if (r.ok) SFX.select();
  else { SFX.ng(); if (r.msg) showToast(r.msg, { noLog: true, tone: "bad" }); }
  renderStatus(); renderParty();
  return r;
}
// 道具を戦闘の外で使う (隊の画面・戦利品のシート)。p = 袋の持ち主。target = 使う相手 (省略時: 効く相手が1人ならその人、
// 複数なら選ばせる)。効き目は品で決まる (combat.js _useItem と同じ量)。戦闘でしか使えない品は使えない
function useItem(...args) { return tlGameMeasure("item", () => useItemMeasured(...args)); }
function useItemMeasured(p, index, target) {
  const it = p.items[index];
  if (!it || it.slot !== "use" || !it.use) return;
  const u = it.use;
  // 無頼の誓 (奈落の縛り): 道具 (消耗品) を一切使えない
  if (itemsBanned()) { SFX.ng(); log("無頼の誓により、道具は使えない。", "sys"); showToast("無頼の誓により、道具は使えない", { noLog: true, tone: "bad" }); return; }
  const where = useWhere(it);
  if (where === "battle") { SFX.ng(); showToast(`${it.name}は戦闘中にしか使えない`, { tone: "info" }); return; }
  if (u.float) {
    if (G.state !== "board" || !inDungeon()) { SFX.ng(); showToast(`${it.name}は迷宮を歩いている時にしか使えない`, { tone: "info" }); return; }
    if (floatLeft() >= u.float) { SFX.ng(); showToast(`もう浮いている ― 残り${floatLeft()}階`, { tone: "info" }); return; }
    p.items.splice(index, 1); infSupplyRecord("used", it.id);
    G.run.float = u.float;
    SFX.spell();
    log(`${p.name}は${it.name}を使った。隊の足が地を離れる ― ${u.float}階のあいだ${floatGuardText()}。`, "win");
    showToast(`${it.name} ― ${u.float}階のあいだ宙に浮く`, { noLog: true, tone: "good" });
    renderStatus(); renderParty(); renderBoard(); autosave(true);
    return;
  }
  if (u.recall) {
    // 帰還の鈴: 迷宮を歩いている時だけ。確かめてから鈴を鳴らし、戦利品を持って街へ戻る
    if (G.state !== "board" || !inDungeon() || G.anim || G.walking) { SFX.ng(); showToast(`${it.name}は迷宮を歩いている時にしか使えない`, { tone: "info" }); return; }
    // 迷宮の掟「閉ざされた門」(化石竜の墓所): 帰還の鈴は鳴らない
    if (abyssActive()) { SFX.ng(); showToast(`${INF_NAME}では${it.name}は鳴らない。風だまりの主を討てば帰れる`, { tone: "info" }); return; }
    { const tr = dungeonTrait(); if (tr && tr.sealedGate) { SFX.ng(); showToast(`${tr.name} ― ${it.name}は鳴らない。最下階まで進むしかない`, { tone: "info" }); return; } }
    showChoice(`${it.name}を鳴らし、街へ帰還する？`, [
      { label: "鳴らして帰還する ― 戦利品は持ち帰る", primary: true, fn: () => {
        const i = p.items.indexOf(it);
        if (i < 0) { renderBoard(); return; }
        p.items.splice(i, 1); infSupplyRecord("used", it.id);
        SFX.spell();
        log(`${p.name}は${it.name}を鳴らした。灯の下へ、隊が引き戻されていく…`, "win");
        leaveDungeon({ outcome: G.run && G.run.secured ? "clear" : "return" });
      } },
      { label: "やめておく", fn: () => renderBoard() },
    ], ICONS.portal, { banner: "✦ 帰還の鈴 ✦", accent: "#e8c070", lines: useLines(it), onDismiss: () => renderBoard() });
    return;
  }
  const tk = useTarget(it);
  const cands = G.party.filter((t) => useHelps(it, t));
  if (!cands.length) {
    const what = u.revive ? "倒れた仲間がいない" : "効果のある相手がいない";
    log(`${it.name}: ${what}`, "sys"); showToast(what, { noLog: true, tone: "info" });
    return;
  }
  if (tk !== "all-ally" && !target) {
    if (cands.length === 1) target = cands[0];
    else {
      // 相手を選ぶ (HP・MP・状態異常を添える)
      const opts = cands.map((t) => ({
        label: `${t.name}　${!t.alive ? "倒れている" : (u.mp || u.mpFull) && !(u.heal || u.full) ? `MP ${t.mp}/${t.maxmp}` : `HP ${t.hp}/${t.maxhp}`}${t.alive && t.ailment ? ` (${AIL_NAME[t.ailment] || t.ailment})` : ""}`,
        fn: () => { const i = p.items.indexOf(it); if (i >= 0) useItem(p, i, t); },
      }));
      opts.push({ label: "やめる", cancel: true, fn: () => {} });
      showChoice(`${it.name}を誰に使う？`, opts, null, { banner: "✦ 道具 ✦", lines: useLines(it, true) });
      return;
    }
  }
  if (target && !useHelps(it, target)) { SFX.ng(); showToast("効果がない", { tone: "info" }); return; }
  const targets = tk === "all-ally" ? cands : [target];
  p.items.splice(index, 1); infSupplyRecord("used", it.id);
  const kinds = useCureKinds(u);
  const notes = [];
  const alc = 1 + rankParty("hermitSenyaku", [0.20, 0.30, 0.40, 0.60]); // 仙薬 (隠修士のランク): 道具の回復量
  for (const t of targets) {
    if (u.revive) {
      t.alive = true; t.ailment = null; t.reviveAt = null; t._dead = false;
      t.hp = Math.max(1, Math.min(t.maxhp, Math.round(t.maxhp * u.revive)));
      notes.push(`${t.name} 蘇生`);
      log(`${p.name}は${it.name}を使った。${t.name}が蘇った (HP ${t.hp})`, "heal");
      continue;
    }
    const bits = [];
    if (u.heal || u.full) { const b = t.hp; t.hp = Math.min(t.maxhp, t.hp + (u.full ? t.maxhp : Math.round(u.heal * alc))); if (t.hp > b) bits.push(`HP+${t.hp - b}`); }
    if ((u.mp || u.mpFull) && (t.maxmp || 0) > 0) { const b = t.mp; t.mp = Math.min(t.maxmp, t.mp + (u.mpFull ? t.maxmp : Math.round(u.mp * alc))); if (t.mp > b) bits.push(`MP+${t.mp - b}`); }
    if (kinds.length && t.ailment && kinds.includes(t.ailment)) { bits.push(`${AIL_NAME[t.ailment] || "状態異常"}が治った`); t.ailment = null; }
    if (bits.length) { notes.push(`${t.name} ${bits.join(" ")}`); log(`${p.name}は${it.name}を使った。${t.name}: ${bits.join("・")}`, "heal"); }
  }
  SFX.heal(); buzz(10);
  showToast(`${it.name} ― ${notes.length > 2 ? `${notes.length}人に効いた` : notes.join(" / ")}`, { noLog: true, tone: "good" });
  renderStatus(); renderParty();
  autosave(true);
}
// 捨てる (迷宮の中だけ): 取り返しのつかない操作なので確認画面を挟む
function dropItem(p, index) {
  const it = p.items[index];
  if (!it || G.state === "town") return;
  if (it.locked) { SFX.ng(); showToast(`${it.name}はロック中 ― 捨てるにはロックを外す`, { tone: "info" }); return; }
  showConfirm({
    title: `${it.name} を捨てる？`,
    lines: ["捨てたアイテムは二度と戻らない。"],
    okLabel: "捨てる",
    onOk: () => {
      const i = p.items.indexOf(it);
      if (i >= 0) { p.items.splice(i, 1); infSupplyRecord("discarded", it.id); }
      log(`${it.name}を捨てた`, "sys");
      showToast(`${it.name}を捨てた`, { noLog: true, tone: "info" });
      renderStatus();
    },
  });
}

// 品を from の袋から to の袋へ移す (満杯なら移さない)
function moveItem(from, it, to) {
  if (!from || !to || from === to || from.items === to.items) return false;
  const i = from.items.indexOf(it);
  if (i < 0) return false;
  if (to.items.length >= MAX_ITEMS) { SFX.ng(); showToast(`${to.name}の持ち物はいっぱいだ`, { tone: "bad" }); return false; }
  from.items.splice(i, 1);
  to.items.push(it);
  log(`${it.name} を ${from.name} → ${to.name} に渡した`, "win");
  SFX.select();
  showToast(`${it.name} → ${to.name}`, { noLog: true, tone: "info" });
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
// 迷宮の掟「澄んだ水晶の光」(水晶の鉱脈 — trait.appraised) の迷宮では、はじめから鑑定済み
function markDungeonLoot(it) {
  const tr = dungeonTrait();
  if (it && UNIDENT_SLOTS.has(it.slot) && !(tr && tr.appraised) && !abyssActive()) it.unidentified = true; // 無限迷宮の品は鑑定済みで落ちる
  // 無限迷宮で拾った装備には、深さに応じた追加の能力・特性が付く (本編の迷宮で拾った品には付かない)
  if (it && abyssActive() && !it.afx && hasQuality(it)) { const afx = rollAffixes(it, G.floor); if (afx) { it.afx = afx; applyAffixes(it); infAfxTrack(it); } }
  return it;
}

// アイテムを入手 (空きのあるメンバーへ)。満杯なら拾えない。{item, who} を返す
// 持ち物がいっぱいの時 (docs/infinite-labyrinth.md 18章。本編・無限迷宮とも): 袋の品を1つ選んで捨てる画面 (ui/discard.js)。
// ロックした品は候補に出さない。dropFromBag = 選んだ品を捨てる / askRoomFor = 入れたい品のために空きを作り、空いた人業を cb へ (置いていけば null)
function dropFromBag(owner, it) {
  if (!owner || !it || it.locked) return false;
  const i = (owner.items || []).indexOf(it);
  if (i < 0) return false;
  owner.items.splice(i, 1); infSupplyRecord("discarded", it.id);
  log(`${itemName(it)}を捨てた`, "sys");
  renderParty(); updateTopbar(); autosave(true);
  return true;
}
function askRoomFor(it, cb, members = G.party, opts = {}) {
  const free = (members || []).find((m) => m.items.length < MAX_ITEMS);
  if (free) { cb(free); return; }
  if (!UI.openDiscard || !(members || []).some((m) => (m.items || []).some((x) => x && !x.locked))) { cb(null); return; }
  UI.openDiscard({ incoming: it, members, ...opts, onPick: (owner) => cb(owner), onSkip: () => cb(null) });
}
// 品を手に入れる (袋がいっぱいなら、捨てる品を選ぶ画面を挟む)。cb(got = {item, who} | null, lost = 置いていった品 | null)
function giveItemAsk(id, cb) {
  if (!ITEMS[id]) { cb(null, null); return; }
  if (G.party.some((m) => m.items.length < MAX_ITEMS)) { cb(giveItem(id), null); return; }
  const it = cloneItem(id);
  if (!it) { cb(null, null); return; }
  markDungeonLoot(it);
  askRoomFor(it, (who) => {
    if (!who || who.items.length >= MAX_ITEMS) { cb(null, it); return; }
    runGainItem(who, it);
    codexSeeItem(id, it);
    log(`${itemName(it)} を手に入れた！ (${who.name})`, logClassForItem(it));
    cb({ item: it, who }, null);
  });
}
function giveItem(id) {
  const it = cloneItem(id);
  if (!it) return null;
  markDungeonLoot(it);
  const who = G.party.find((m) => m.items.length < MAX_ITEMS);
  if (!who) {
    log(`${itemName(it)}を見つけたが、誰も持てない…`, "sys");
    showToast(`持ちきれず ${itemName(it)} を置いてきた`, { noLog: true, tone: "bad" });
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
//   コモン/アンコモン・道具 = 入手のトースト (収穫バーの数も増える)。onClose はすぐに呼ぶ
//   レア/スーパーレア/レジェンドレア・宝物庫にまだ無い収集品 = 祝祭カード (ファンファーレ・閃光・LRは光の柱と揺れ)。閉じてから onClose
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
function showEvent({ sprite, title, lines = [], accent = "#c9a227", btnLabel = "つぎへ", banner = "✦ イベント ✦", sparkle = false, onClose, noLog = false }) {
  // 札の中身は記録にも残す (直近に同じ文があれば重ねない)。noLog = 操作の案内など、出来事でない札
  if (!noLog) logSheet(title, lines, sparkle ? "win" : /[⚠✗☠]/.test(banner || "") ? "dmg" : "sys");
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
// info: fuseSoul の result (fromCap/toCap・能力・覚えた技まで入っている)
function showRankUp(info, onClose) {
  const { clsKey, toRank } = info;
  const cls = SOUL_CLASSES[clsKey] || SOUL_CLASSES.fighter;
  const accent = (SOUL_RANKS[toRank] && SOUL_RANKS[toRank].color) || cls.glow || "#ffcf4a";
  flashScreen(accent);
  SFX.rankup(); buzz([0, 60, 40, 60, 40, 70, 90, 220, 120, 320]);
  return uiSoulPanel.celebrateRankUp({
    ...info, accent, title: jobRankName(clsKey, toRank), hint: rankUnlockHint(toRank, clsKey),
  }, onClose);
}

// 各ランク到達で新たに得たもののヒント (行の配列)。ランクのパッシブはその名前と効果だけを書き、
// まだ開いていない仕組み (宿し魂・控えの結社) には触れない
function rankUnlockHint(rank, clsKey) {
  const head = { 2: "★ 覚醒", 3: "★ 上位の技 — 伸びたLv上限の先に、新たな技が見えてきた。", 4: "★ 真髄 — Lv上限が大きく伸びた。", 5: "★ 極致 — 魂は最高位に至り、Lvの天井が解き放たれた。" }[rank];
  if (!head) return null;
  const lines = [];
  // ランクのパッシブ: ランク2で目覚め、3・4・5で強まる (名前と効果だけ)
  const perk = awakenPerkOf(clsKey, rank);
  if (perk && rank === 2) lines.push(`${head} — パッシブ「${perk.name}」に目覚めた`, perk.desc);
  else if (perk) lines.push(head, `パッシブ「${perk.name}」に強まった`, perk.desc);
  else lines.push(head);
  if (isUniqueJob(clsKey)) return lines; // 灯守 (セラだけの魂) はサブ魂・結社に出さない
  if (featureUnlocked("sub1")) {
    const pc = subPickCapOfRank(rank), pp = subPickCapOfRank(rank - 1);
    if (pc > pp) lines.push(`宿し魂として、技・パッシブを${pc}つまで貸せるようになった。`);
    const sr = Math.round(subStatRateOfRank(rank) * 100), sp = Math.round(subStatRateOfRank(rank - 1) * 100);
    if (sr > sp) lines.push(`宿し先へ分ける能力が ${sp}% → ${sr}% に増えた。`);
  }
  if (featureUnlocked("order")) {
    const or = Math.round(orderStatRateOfRank(rank) * 100), op = Math.round(orderStatRateOfRank(rank - 1) * 100);
    if (or > op) lines.push(`控えの結社の席から全員へ分ける能力が ${op}% → ${or}% に増えた。`);
  }
  return lines;
}

// 毒のダメージ (盤面を1歩進むごと)
function tickPoison(...args) { return tlGameMeasure("poison", () => tickPoisonMeasured(...args)); }
function tickPoisonMeasured() {
  let any = false;
  for (const p of G.party) {
    if (!p.alive || p.ailment !== "poison") continue;
    any = true;
    // 通常の毒は戦闘外でも最大HPの5%を削る
    const dmg = Math.max(1, Math.ceil(p.maxhp * 0.05));
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
function revealBootScreen() {
  document.body.classList.remove("booting");
}
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

// 盤面のドラッグは見渡す操作。隊の札からのフリックは従来どおり歩く。
let boardPan = null, boardPanClick = false;
view.addEventListener("pointerdown", (e) => {
  boardPanClick = false;
  if (!e.isPrimary || e.button !== 0 || G.state !== "board" || uiBlocked() || boardCamera.zoom === 1) return;
  boardPan = { id: e.pointerId, x: e.clientX, y: e.clientY, cx: boardCamera.x, cy: boardCamera.y };
  view.setPointerCapture(e.pointerId);
});
view.addEventListener("pointermove", (e) => {
  if (!boardPan || boardPan.id !== e.pointerId) return;
  if (G.state !== "board" || uiBlocked()) { boardPan = null; return; }
  const dx = e.clientX - boardPan.x, dy = e.clientY - boardPan.y;
  if (!boardPanClick && Math.hypot(dx, dy) < 8) return;
  boardPanClick = true;
  const rect = view.getBoundingClientRect();
  boardCamera.manual = true;
  boardCamera.x = boardPan.cx - dx * VW / rect.width / boardCamera.zoom;
  boardCamera.y = boardPan.cy - dy * VH / rect.height / boardCamera.zoom;
  clampBoardCamera();
  drawBoardFrame();
});
for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) view.addEventListener(type, (e) => {
  if (boardPan && boardPan.id === e.pointerId) boardPan = null;
});
const boardOverviewBtn = document.getElementById("board-overview");
boardOverviewBtn.addEventListener("click", () => {
  boardCamera.overview = !boardCamera.overview;
  boardCamera.manual = false;
  boardOverviewBtn.textContent = boardCamera.overview ? "拡大" : "全体";
  boardOverviewBtn.setAttribute("aria-pressed", String(boardCamera.overview));
  document.getElementById("board-camera-hint").textContent = boardCamera.overview ? "全体を表示中" : "ドラッグで見渡す";
  drawBoardFrame();
});
document.getElementById("board-center").addEventListener("click", () => {
  boardCamera.overview = false; boardCamera.manual = false;
  boardOverviewBtn.textContent = "全体";
  boardOverviewBtn.setAttribute("aria-pressed", "false");
  document.getElementById("board-camera-hint").textContent = "ドラッグで見渡す";
  drawBoardFrame();
});

view.addEventListener("click", (e) => {
  if (boardPanClick) { boardPanClick = false; return; }
  if (G._swiped) { G._swiped = false; return; } // 直前のスワイプ由来の click は無視
  if (_enemyHold && _enemyHold.fired) { _enemyHold = null; return; } // 長押しで敵を覗いた直後
  _enemyHold = null;
  const rect = view.getBoundingClientRect();
  let sx = (e.clientX - rect.left) * (VW / rect.width);
  let sy = (e.clientY - rect.top) * (VH / rect.height);
  if (G.state === "board") {
    sx = sx / boardCamera.zoom + boardCamera.x;
    sy = sy / boardCamera.zoom + boardCamera.y;
  }
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
  // オート移動中: タップしたマスへ寄り道する (見えている敵の札なら挑む)。着いたら、また近くの墓石をめくっていく
  if (G.autoMove) {
    const hit = cellAt(sx, sy);
    if (!hit || (hit.x === G.px && hit.y === G.py)) return;
    if (!findPath(hit.x, hit.y).length) { SFX.miss(); log("そこへはまだ行けない。", "sys"); return; }
    SFX.select();
    autoMoveDetour(hit.x, hit.y);
    return;
  }
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
  if (e.target === view && G.state === "board" && window.innerWidth <= 600) return;
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
  if (G.autoMove && G.state === "board") setAutoMove(false);
  // 札の上から始めたフリックは、方向が決まった時点で指を #party (作り直されない器) に捕まえておく。
  // 歩くたびに renderParty() が札を作り直しても、指を離した pointerup を取りこぼさない (タップは札のまま)。
  if (swipe.party) { try { partyEl.setPointerCapture(e.pointerId); } catch (err) { /* 非対応環境は素通し */ } }
  SFX.select();
  swipeStep(mdx, mdy);
});

document.addEventListener("pointerup", () => { stopSwipe(); });
document.addEventListener("pointercancel", () => { stopSwipe(); });

// 文字入力中 (人業の名付けなど) のキーは近道に使わない。M で消音・WASD で歩くと、
// 名前に m を打っただけで BGM が消えてしまう。IME の変換中・修飾キー付き (⌘M など) も同様
function typingKey(e) {
  if (e.isComposing || e.keyCode === 229 || e.ctrlKey || e.metaKey || e.altKey) return true;
  const t = e.target;
  if (!t || !t.tagName) return false;
  if (t.isContentEditable || t.tagName === "TEXTAREA" || t.tagName === "SELECT") return true;
  return t.tagName === "INPUT" && !/^(button|submit|reset|checkbox|radio|range|color|file|image|hidden)$/i.test(t.type || "");
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); nav.back(); return; } // 戻る操作は nav に一本化 (§3.2)
  if (typingKey(e)) return;
  if (e.key === "m" || e.key === "M") { if (!e.repeat) updateMuteBtn(toggleMute()); return; }
  if (G.state !== "board" || uiBlocked()) return;
  if (G.autoMove && /^(Arrow(Up|Down|Left|Right)|[wasd])$/.test(e.key)) { setAutoMove(false); e.preventDefault(); return; }
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
const SAVE_KEY = "dos-save-v7"; // v7 = 迷宮の台帳 (選んで潜る迷宮・師を捜す物語)。v6 以前のセーブは孤立させる (消さずに残す)
// 保存する G のフィールド (アニメーション等の一時状態は除外)
const SAVE_FIELDS = [
  "apprenticeName",
  "rng",
  "shopAfx", "shopAfxPending",
  "state", "floor", "maxFloorReached", "dungeonIdx", "unlockedDungeons", "board", "px", "py", "eliteFloor", "specialFloor", "mutator", "bossDown", "portalFound", "abyss", "abyssRec",
  "gold", "soulPts", "redSoul", "embers", "dollsPurchased", "dungeonBriefed", "stabilityBriefed", "pendingDoll",
  "inventory", "party", "reserve", "souls", "shopStock", "run", "town",
  "quest", "msq", "ach", "fastAnim", "animTempo", "tavernCrowd", "tavernHeard", "rumor", "activeRumor", "codex", "treasury", "lrOwned", "named", "order", "rusui", "insightNotified", "irene", "journal", "tut", "events", "story", "world", "dragonSlain", "stats",
  "battle", "battleCell", "prevPos", "statusIdx", "statusTab", "rematch",
  "lastRun",
];

// 参照保持シリアライズ: 共有オブジェクト/循環参照を {$r:index} で表現し、
// ロード時に同一性 (魂が複数箇所から参照される等) を完全に復元する。関数は無視。
// テストモードはURLで明示し、通常セーブの読み書きを止める。
const testParams = new URLSearchParams(location.search);
const testDungeonIdx = DUNGEONS.findIndex((d) => d.id === testParams.get("testDungeon"));
const testScenes = [
  ...uiTutorial.testTutorials,
  { id: "opening", kind: "story", name: "オープニング" },
  ...Object.entries({ intro: TUT_INTRO, three: TUT_THREE_REPORT, finale: TUT_FINALE, epilogue: EPILOGUE }).map(([id, lines]) => ({
    id: "story:" + id, kind: "story", name: ({ intro: "着任の謁見", three: "三体の支度", finale: "地下墓地の調査依頼", epilogue: "結末" })[id], lines,
    photo: storyImage(({ intro: "arrival", three: "three", finale: "departure" })[id]),
  })),
  ...[["cell", "師の手がかり", STORY_CELLS], ["memory", "主の記憶", BOSS_MEMORIES], ["report", "踏破の報告", REPORTS], ["chapter", "章の結び", CHAPTER_END], ["unlock", "機能の解放", UNLOCKS]].flatMap(([group, label, defs]) =>
    Object.entries(defs).map(([id, def]) => ({ ...def, id: group + ":" + id, kind: "story", name: label + "・" + def.title, who: ["cell", "memory"].includes(group) ? "none" : "king",
      photo: storyImage(({ cell: id, memory: "mem_" + id, report: "report_" + id, chapter: "ch" + id + "_end" })[group]) }))),
  ...IRENE_BEATS.map((def) => ({ ...def, id: "irene:" + def.id, kind: "story", name: "館の語り・" + def.title, who: "irene", photo: storyImage(def.id) })),
  { ...MINE_PASS, id: "minePass", kind: "story", name: MINE_PASS.title, photo: storyImage("minePass") },
];
const testScene = testScenes.find((s) => s.id === testParams.get("testScene"));
// 無限迷宮の試遊 (docs/infinite-labyrinth.md 16-4): URL の testInf=階 (testInfLv=隊Lv、無ければその階の推奨Lv)
const testInfFloor = Math.max(0, Math.min(999, Math.floor(Number(testParams.get("testInf"))) || 0));
const testPlayActive = testDungeonIdx >= 0 || !!testScene || testInfFloor > 0;
let _lastSave = 0;
let _saveWarned = false;
let _resetting = false; // データ削除→リロードの間に autosave が書き戻すのを防ぐ
let _cloudResolving = false;
let _lastCloudSave = null;
function autosave(force = false) {
  if (_resetting) return;
  if (testPlayActive) { codexSweepJobs(); notifyInsight(); return; }
  if (cloudEnabled() && (!cloudReady() || _cloudResolving)) return;
  if (!G.party || (!cloudEnabled() && !G.party.length && !G.apprenticeName)) return;
  const now = Date.now();
  if (!cloudEnabled() && !force && now - _lastSave < 200) return;
  _lastSave = now;
  try {
    codexSweepJobs(); // 職業図鑑の発見状況を保存前に最新化
    notifyInsight();
    const snap = {};
    for (const k of SAVE_FIELDS) snap[k] = G[k];
    const data = refSerialize(snap);
    if (cloudEnabled()) {
      const raw = JSON.stringify(data);
      if (raw === _lastCloudSave) return cloudFlush();
      _lastCloudSave = raw;
      return cloudSave(data);
    }
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) {
    // localStorage が使えない (プライベートブラウズ等) と保存できない → 一度だけ警告
    if (!_saveWarned) {
      _saveWarned = true;
      log("⚠ セーブできません。プライベートブラウズを解除してください。", "dmg");
      try { showToast("⚠ セーブ不可: プライベートブラウズ?", { noLog: true }); } catch {}
    }
  }
}

function clearSave() { if (testPlayActive || cloudEnabled()) return; try { localStorage.removeItem(SAVE_KEY); } catch {} }

// 旧セーブの %型アイテム (.pct) をテンプレートのフラット値へ戻す。
// refSerialize の参照共有を壊さないよう、saved item オブジェクトを in-place で変更する。
// 所持品をカタログの最新定義に合わせ直す (レア度・能力値・絵・説明など、品そのものの性質)。
// 個体ごとの状態 (未鑑定・鑑定失敗の印など) は残す。旧セーブの装備も新しいレア度と絵になる
const ITEM_STAT_KEYS = ["atk", "vit", "agi", "int", "pie", "luk", "hp", "mp", "crit"];
const ITEM_TMPL_KEYS = ["name", "desc", "slot", "lv", "rank", "r20", "rar", "lr", "forJob", "exclusive", "classes", "cat",
  "twoHanded", "sk", "weight", "price", "art", "palette", "eAtk", "eDef", "aRes", "bRes", "resists", "onHit", "scale", "weaponProfile", "weaponRating", "magic", "mult", "eff", "align", "cursed", "hit", "dice", "swings"];
// 品1つを目録の値に写し直し、品質と＋N の段を掛け直す (読み込み・鍛え直しで品質を変えた時)
function resyncItem(it) {
  const tmpl = it && ITEMS[it.id];
  if (!tmpl) return;
  delete it.pct;
  for (const k of ITEM_STAT_KEYS) { if (tmpl[k] != null) it[k] = tmpl[k]; else delete it[k]; }
  for (const k of ITEM_TMPL_KEYS) { if (tmpl[k] !== undefined) it[k] = tmpl[k]; else delete it[k]; }
  if (hasQuality(it)) { if (it.q == null) it.q = QUALITY_MID; applyQuality(it); } else delete it.q; // 品質を入れる前の品は並品 (50)
  if (it.afx) applyAffixes(it); // 無限迷宮の追加の能力・特性は品質の後 (src/infaffix.js)
  if (it.forge) applyForge(it); // ＋N の段は品質の後に掛け直す
}
function reflattenItemStats() {
  const visited = new Set();
  function refresh(it) {
    if (!it || visited.has(it)) return;
    visited.add(it);
    resyncItem(it);
  }
  for (const m of [...(G.party || []), ...(G.reserve || [])]) {
    for (const it of (m.items || [])) refresh(it);
    for (const k of Object.keys(m.equip || {})) refresh(m.equip[k]);
  }
}

// 片手/両手と盾のジャンルを入れた後の旧セーブの整え直し:
//   両手武器になった武器と盾を同時に持っている / 職のジャンルに合わなくなった盾を持っている → 盾を外して袋へ
//   (自分の袋が満杯なら、隊・控えの空きのある人業の袋へ。誰も空いていなければ自分の袋に入れる)。呪いの盾はそのまま
//   二刀流 (修羅のランク・サブ魂) を失った人業の左手の武器も同じように袋へ戻す (魂の付け替え・融合の後も renderTown が呼ぶ)
function fixHandsAndShields(offhand = true) {
  const all = [...(G.party || []), ...(G.reserve || [])].filter((d) => d && d.equip);
  const moved = [];
  for (const d of all) {
    const sh = d.equip.shield;
    if (!sh || sh.cursed || (sh.slot === "weapon" && !offhand)) continue;
    const w = d.equip.weapon;
    const clash = w && w.twoHanded;
    const bad = sh.slot === "weapon" ? !canOffhand(d, sh) : (d.clsKey && !canEquip(d, sh, { anyLv: true }));
    if (!clash && !bad) continue;
    d.equip.shield = null;
    if (!Array.isArray(d.items)) d.items = [];
    const room = d.items.length < MAX_ITEMS ? d : all.find((x) => Array.isArray(x.items) && x.items.length < MAX_ITEMS);
    (room || d).items.push(sh);
    moved.push(d);
  }
  return moved; // 左手・盾を外した人業 (能力の再計算は呼び出し側)
}
// 装備できるLv (src/equiplevel.js) に届かない装備を袋へ戻す: メイン魂を Lv の低い魂へ替えた・装備できるLv を入れる前の旧セーブ。
// 呪いの品は外れない。魂の宿らない人業 (メイン魂を外しただけ) はそのまま (宿す時に見る)。
// 自分の袋が満杯なら隊・控えの空きのある袋へ (誰も空いていなければ自分の袋)。返り値 = [{ d, it }] (能力の再計算は呼び出し側)
function fixEquipLevels() {
  const all = [...(G.party || []), ...(G.reserve || [])].filter((d) => d && d.equip);
  const moved = [];
  for (const d of all) {
    if (d.primary == null) continue;
    for (const k of SLOTS) {
      const it = d.equip[k];
      if (!it || it.cursed || !equipLvShort(d, it)) continue;
      d.equip[k] = null;
      if (!Array.isArray(d.items)) d.items = [];
      const room = d.items.length < MAX_ITEMS ? d : all.find((x) => Array.isArray(x.items) && x.items.length < MAX_ITEMS);
      (room || d).items.push(it);
      moved.push({ d, it });
    }
  }
  return moved;
}
let _equipLvMoved = []; // 読み込みで外した装備 (街の描画で知らせる)
function refreshEquipLevels() {
  const moved = [..._equipLvMoved, ...fixEquipLevels()];
  _equipLvMoved = [];
  if (!moved.length) return;
  for (const d of new Set(moved.map((m) => m.d))) { try { recalcDoll(d); } catch {} }
  const names = moved.map((m) => `${m.d.name}の${m.it.name}（Lv${equipLevelOf(m.it)}から）`).join("・");
  showToast(`メイン魂の Lv が装備できるLv に届かない装備を袋へ戻した ― ${names}`, { tone: "info", ms: 4200 });
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
function loadGame(cloudSnapshot = null) {
  if (testPlayActive) return false;
  let raw;
  try { raw = cloudEnabled() ? (cloudSnapshot ? JSON.stringify(cloudSnapshot) : null) : localStorage.getItem(SAVE_KEY); } catch { return false; }
  if (!raw) return false;
  let snap;
  try { snap = refDeserialize(JSON.parse(raw)); } catch (e) { return false; }
  if (!snap || !Array.isArray(snap.party) || (!cloudEnabled() && !snap.party.length && !snap.msq?.granted && !normalizeName(snap.apprenticeName))) return false;
  for (const k of SAVE_FIELDS) if (k in snap) G[k] = snap[k];
  G.insightNotified = snap.insightNotified ?? null;
  G.apprenticeName = normalizeName(G.apprenticeName);
  G.inventory = Array.isArray(snap.inventory) ? snap.inventory : [];
  shareInventory(G);
  if (G.abyss && G.abyss.home) shareInventory(G.abyss.home);
  G.rng = bindRngState(snap.rng); // 乱数の位置を続きから (旧セーブには無い → 新しい種から)
  endLegacyAbyss(); // 旧仕様の奈落の途中のセーブは、読み込みで終わらせる (記録も消す)
  if (G.abyssRec && G.abyssRec.v !== 2) G.abyssRec = null;
  // 無限迷宮の途中: 下の読み込みの手当ては本編の隊・魂に掛ける。済んだら仮の器へ戻す (infSwapBackAfterLoad)
  const infRun = infSwapForLoad();
  // 戦闘演出の倍速を改めた: 旧来の標準の速さが「倍速 ON」、OFF はその 1/2。旧セーブは ON (= これまでの速さ) から始める
  if (!("animTempo" in snap)) { G.fastAnim = true; G.animTempo = 2; }
  if (!G.lrOwned || typeof G.lrOwned !== "object") G.lrOwned = {}; // LR入手済み記録
  delete G.lrClock; // 旧来の LR 時間抽選の時計 (廃止)
  namedState(); // 名のある強敵の記録 (旧セーブには無い)
  // 街UIの現在地 (後付け: tab/page)。旧 {facility, sub} はそれが属するタブへ写す
  G.town = townshell.migrateTown(G.town);
  if (G.lastRun === undefined) G.lastRun = null; // 帰還の報告 (後付け)
  if (!G.order || !Array.isArray(G.order.picks)) G.order = { picks: [] }; // 控えの結社の着席指定
  if (!G.rusui || !Array.isArray(G.rusui.picks)) G.rusui = { picks: [] }; // 留守居の修練の席 (後付け)
  if (!G.irene || typeof G.irene !== "object") G.irene = { greeted: false, visits: 0, seen: {}, last: null }; // 館の主イレーヌ (後付け: 既存の記録では次の来館で挨拶する)
  if (!G.irene.seen || typeof G.irene.seen !== "object") G.irene.seen = {};
  if (!G.tut || typeof G.tut !== "object") G.tut = { done: {}, cur: null, step: 0, ev: {}, base: {} }; // 手ほどき (後付け: 解放済みで未使用の要素は目標の札から手ほどきする)
  if (!("journal" in snap) || !G.journal || typeof G.journal !== "object") { G.journal = null; seedJournal(G); } // ストーリーの既読 (後付け: いま読める物語は既読にして、知らせを山積みにしない)
  if (!G.events || typeof G.events !== "object") G.events = {}; // 迷宮のイベント (後付け)
  for (const k of ["seen", "picks", "once", "flags", "fresh"]) if (!G.events[k] || typeof G.events[k] !== "object") G.events[k] = {};
  { // 旧セーブで取得済みの恵みだけを引き継ぐ。新しい極には旧効果を追加しない。
    const o = G.events.once, fl = G.events.flags;
    if (!fl.statGiftVersion) {
      if (Object.keys(o).some((k) => k.startsWith("c30:"))) { o.c30 = true; fl.will = true; }
      if (o.l1_10) fl.blackCat = true;
      if (o.l2_10) fl.sewerMap = true;
      if (o.l3_10) fl.temper = true;
      fl.statGiftVersion = 1;
    }
  }
  // 旧ステータス体系のセーブを六大ステ (STR/VIT/AGI/INT/PIE/LUK) へ移行
  // (battle の敵の mon はこの後 MONSTERS の生定義に差し替えられるため触れても無害)
  migrateLegacyStats(snap);
  reflattenItemStats();
  fixHandsAndShields(false); // 左手の武器 (二刀流) は魂の能力が出そろってから下で見る
  // 一時状態はリセット
  G.anim = null; G.flipAnim = null; G.heroAnim = null; G.walking = false; G.prompt = false;
  G.fx = null; G.animating = false; G.enemyPos = {}; G.partyFx = new Map(); G.partyFxV = null; G.partyShow = null; G.wallFlash = null; G.partyCall = null;
  G.effShow = null; G.modFeed = null; G.logHold = null;
  G.statusOpen = false; G.settingsOpen = false;
  // クラス/参照の再リンク (Battleのメソッド・敵のmon・派生値)
  if (G.battle) {
    Object.setPrototypeOf(G.battle, Battle.prototype);
    syncEnemyUids(G.battle.enemies);
    tlWatchBattle(G.battle, tlWhere(), id => infSupplyRecord("used", id));
    G.battle.log = log;
    if (G.battle.fleeK == null) G.battle.fleeK = fleeScale(); // 逃走の物差しを持たない古い戦闘
    for (const e of (G.battle.enemies || [])) scaleFoeAgi(e, G.battle.fleeK); // 敵の AGI を素の値のまま保存した古い戦闘
    if (G.battle.baseAgi == null) G.battle.baseAgi = partyAgi(levelHere().lv); // 強敵の回避の上限を持たない古い戦闘
    for (const e of (G.battle.enemies || [])) if (e.key && MONSTERS[e.key]) {
      e.mon = MONSTERS[e.key];
      if (!e.affinity) e.affinity = e.element && e.element !== e.mon.element ? elementAffinity(e.element) : e.mon.affinity;
      // 旧セーブの戦闘中の耐性ランクを抵抗値へ移す。
      if (!e.resists) {
        for (const k of ["physResist", "magResist"]) {
          const v = e[k] || 0;
          e[k] = v > 0 && v < 1 ? Math.round(v * 100) : [0, 50, 75, 100][v] ?? v;
        }
        e.resists = monsterResists({ ...e.mon, physResist: e.physResist, magResist: e.magResist, resists: e.mon.resistOverrides || {} });
      }
    }
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
  // 魂融合した魂は自動でロックする (後付け: 旧セーブの融合済み = 魂数2以上の魂にも一度だけ。外したロックは掛け直さない)
  for (const s of G.souls) if (s.count > 1 && !s.fuseLk) { s.locked = true; s.fuseLk = true; }
  setSharedSouls(G.souls); // recalcDoll が所持魂を uid で引けるようにする
  // 旧版で残火を捧げても Lv に注がれず残っていた exp を、いまの上限まで反映する
  for (const s of G.souls) settleSoulExp(s);
  orderSig = null;
  setOrderSource(() => { try { return orderSeatedUids(); } catch (e) { return []; } }); // 結社の席の魂の能力を全員に分ける
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
  for (const d of fixHandsAndShields()) { try { recalcDoll(d); } catch {} } // 二刀流を失った人業の左手の武器 (魂の能力が出そろってから)
  delete G.expedition; // 遠征 (取りやめ。2026-10) の旧セーブ: 出ていた人業は控えに残っている
  _equipLvMoved = fixEquipLevels(); // 装備できるLv に届かない装備 (旧セーブ)。知らせは街の描画で
  for (const d of new Set(_equipLvMoved.map((m) => m.d))) { try { recalcDoll(d); } catch {} }
  delete G.resonance; // 魂の共鳴は 2026-10 に取りやめ (旧セーブの記録は捨てる)
  if (!G.stats) G.stats = {};
  // 後付けの戦績フィールドを既存セーブにも補完する (勲章 cond が参照する)
  const _statDefaults = { runs: 0, deepest: 0, kills: 0, deaths: 0, soulsFound: 0, bossKills: 0,
    chests: 0, mimics: 0, trapsDisarmed: 0, trapsSprung: 0, fusions: 0, questsDone: 0, playMs: 0,
    elites: 0, metals: 0, swiftBoss: false, masterMimicSlain: false };
  for (const k in _statDefaults) if (G.stats[k] == null) G.stats[k] = _statDefaults[k];
  if (!G.stats.bossIds || typeof G.stats.bossIds !== "object") G.stats.bossIds = {};
  if (!G.stats.elemKills || typeof G.stats.elemKills !== "object") G.stats.elemKills = {};
  if (!G.ach) G.ach = {}; // 勲章 (後付け)
  questState(); // 酒場の依頼
  for (const q of [...(G.quest.board || []), ...(G.quest.active || [])]) {
    const cfg = worldById(q.dungeon);
    if (q.type !== "soul" || !cfg?.noCorpses || q.state === "done" || q.state === "claimed") continue;
    q.dungeon = "w03";
    q.desc = `「${worldById("w03").name}」で死体から魂を ${q.goal}つ 拾う`;
    q.note = "死体のある修道院で拾った魂を数える";
  }
  // メインストーリー: 第0章の途中か、師を捜す旅の途中 ({n:1, state:"world"})。迷宮の地図と物語の進みは G.world
  if (!G.msq) G.msq = { n: 0, state: "active", granted: false };
  if (G.msq.n === 0 && G.msq.granted && !G.msq.stage) G.msq.stage = G.souls.some((s) => s.clsKey === "mage") ? "fourth" : "three";
  if (G.msq.n >= 1) { G.msq.n = 1; G.msq.state = "world"; }
  if (G.msq.n === 0 && G.msq.granted && !G.msq.prologue) {
    const count = tutDollCount();
    if (count < 4) G.msq.prologue = { phase: "three", gifts: {} };
    G.tut ||= {}; G.tut.done ||= {};
    delete G.tut.done.createThree; delete G.tut.done.createFourth;
    G.tut.cur = null;
    if (count >= 4) { G.msq.n = 1; G.msq.state = "world"; } // 旧序章で四体が完成していれば巻き戻さない
  }
  refreshWorldUnlocks();
  if (!worldOpenIdx(G.dungeonIdx)) G.dungeonIdx = Math.max(0, DUNGEONS.findIndex((d) => worldOpenId(d.id)));
  G.autoCombat = false;   // オート戦闘は再開時に解除 (誤動作防止)
  // 図鑑の移行: 旧形式 (mon[key]=true) を {kills,normal,rare,dungeons} に変換
  if (!G.codex) G.codex = { mon: {}, item: {} };
  if (!G.codex.mon) G.codex.mon = {};
  if (!G.codex.item) G.codex.item = {};
  if (!G.codex.met || typeof G.codex.met !== "object") G.codex.met = {};
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
  // 手当て (一度だけ): 未鑑定のまま図鑑に載せていた品 (正体をまだ知らない品) を図鑑から外す。鑑定すれば載る
  if (!G.codex.unidFix) {
    const fresh = codexFresh().item;
    for (const id in G.codex.item) if (!itemKnown(id)) { delete G.codex.item[id]; delete fresh[id]; }
    G.codex.unidFix = 1;
  }
  for (const k in G.codex.mon) {
    const v = G.codex.mon[k];
    if (!v || typeof v !== "object") {
      G.codex.mon[k] = { kills: v === true ? 1 : 0, main: v === true ? 1 : 0, normal: false, rare: false, dungeons: {} };
    } else {
      if (!v.dungeons) v.dungeons = {};
      if (v.main == null) v.main = Math.max(0, Number(v.kills) || 0); // 本編で倒した数 (後付け: それまでの討伐はすべて本編)
    }
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
  syncClueBoons(); // 手がかりの恵み (回避率・霊薬の棚)
  syncSeraSoul(); // セラの灯守の魂 (旧版のセラの宿し直し・物語で上がるランク)
  if (infRun) infSwapBackAfterLoad(infRun);
  return true;
}

// 復元した状態に応じて画面を再構築 (やり直し不可の再開)
function resumeFromState() {
  refreshStability();
  if (G.rematch) { abortRematch(); return; } // 宿敵の再戦の途中で閉じた: 試合は無かったことにする
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
    else { enforceDungeonRestrictions(); storyNewFloor(); } // 旧セーブで未発見の手がかりが配置されていなかった階を修復
    renderBoard();
    // 会話・選択の途中で閉じた記録は、現在地の未完イベントから続ける。
    const cell = G.board.cells[G.py]?.[G.px];
    if (cell && !cell.cleared && (cell.type === "story" || cell.type === "event")) resolveCell(cell);
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
  G.animating = false; G.fx = null; G.partyFx = new Map(); G.partyFxV = null; G.partyShow = null; G.enemyPos = {};
  G.effShow = null; G.modFeed = null; flushModLines(null, Infinity);
  clearPartyCalls();
  if (b.procs) b.procs.length = 0; // 中断前の発動の印は出し直さない
  renderRunbar();
  renderParty();
  fitView();
  renderCombat();
  if (b.result) { setTimeout(endBattle, 200); return; }
  // 行動を実行し終え、その演出の途中で閉じられた (次の手番へ進む前に保存された) →
  // 同じ行動をやり直さず、次の手番へ進める。旧セーブでは「resolve なのに予約が空」がその印
  if (b._acted || (b.phase === "resolve" && !b.pending)) {
    if (cloudEnabled() && !testPlayActive) { advanceSavedBattle(false); return; }
    b._acted = false;
    b.advance();
    autosave(true);
    combatStep();
    return;
  }
  // resolve フェーズ = 行動が確定済み → そのまま実行 (取り消せない)
  if (b.phase === "resolve" && b.pending) { runCommitted(); return; }
  if (b.phase === "enemy" || b.phase === "stunned") { combatStep(); return; }
  // input / target = まだ選択中 → メニュー/対象選択を再表示 (renderCombat 済み)
}

// アプリが裏に回る/閉じられる瞬間に確実に保存
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") autosave(true); });
// 街の持ち替え・シート内の選択も、処理が終わった同じフレームで保存する。
for (const type of ["click", "change", "keydown", "pointerup", "touchend"]) {
  window.addEventListener(type, () => {
    if (cloudEnabled() && cloudReady() && !cloudBusy() && !titleActive) queueMicrotask(() => autosave(true));
  }, { capture: true });
}
window.addEventListener("pagehide", () => autosave(true));
window.addEventListener("beforeunload", () => autosave(true));

// 新規プレイの初期化: 人業ロスター・魂ストック・初期装備を整える
function setupNewGame() {
  // 金貨も赤い魂も持たずに着任する。まず王宮で三職の魂を拝受する。
  G.party = [];
  G.inventory = [];
  G.reserve = [];
  G.souls = [];       // 所持魂 一覧 (魂インスタンスの配列)
  setSharedSouls(G.souls);
  G.stabilityBriefed = false;
  G.redSoul = 0;
  G.gold = 0;
  G.unlockedDungeons = 0; // 第0章を果たすまで、迷宮の場所は明かされない
  G.world = {}; worldState();
  G.shopStock = { ...SHOP_INIT_STOCK };
  G.quest = null; questState();
  // 序章: 王から三職の魂 → イレーヌの依頼から三体ずつ段階的に仲間を迎える
  G.msq = { n: 0, state: "active", granted: false };
  codexSweepJobs();
}

// 進行度の前までを報告済みにし、推奨Lvの隊を用意する。通常の解放判定は共通。
function setupTestPlay() {
  setupNewGame();
  G.testPlay = true;
  G.msq = { n: 1, state: "world" };
  const earlyTutorial = testScene?.kind === "tutorial" && ["createThree", "createFourth", "createFifth", "createSixth", "prologueFormation", "prologueAppraise", "buyEquipment", "firstDive"].includes(testScene.id.slice(9));
  const idx = testScene || testInfFloor ? (earlyTutorial || testScene?.id === "opening" ? 0 : DUNGEONS.findLastIndex(d => !d.tutorial)) : testDungeonIdx;
  G.dungeonIdx = idx;
  const cfg = DUNGEONS[idx];
  const floor = Math.max(1, Math.min(cfg.floors, Math.floor(Number(testParams.get("testFloor"))) || 1));
  const w = worldState();
  for (const d of (cfg.tutorial ? [] : DUNGEONS.slice(0, idx))) {
    if (d.side) continue;
    w.open[d.id] = true; w.cleared[d.id] = 1; w.reported[d.id] = true;
    if (d.boss) { w.beats["mem_" + d.id] = true; G.stats.bossIds[d.boss] = true; }
  }
  for (const ch of CHAPTERS) if (w.reported[ch.finale]) w.beats["ch" + ch.no + "_end"] = true;
  if (w.reported.w09) w.beats[OMOKAGE_BEAT] = true; // 第三章からの試遊は面影の写しを使える
  // 地図の解放に要る手がかりを、ここまでの進行に応じて補う。
  for (const d of (cfg.tutorial ? [] : DUNGEONS.slice(0, idx + 1))) {
    if (d.unlock?.story) w.found[d.unlock.story] = true;
  }
  refreshWorldUnlocks();
  w.open[cfg.id] = true;
  w.gates[cfg.id] = floor;
  G.unlockedDungeons = worldOpenCount();
  G.irene.greeted = true;
  G.dungeonBriefed = true; G.stabilityBriefed = true;
  if (cfg.tutorial) { G.msq.granted = true; G.msq.prologue = { phase: "forest", gifts: {} }; G.stabilityBriefed = false; }
  const level = earlyTutorial ? 1 : dungeonLevel(cfg, floor);
  for (const [i, cls] of (cfg.tutorial ? ["fighter", "priest", "thief"] : ["fighter", "knight", "thief", "priest", "mage", "hunter"]).entries()) {
    const soul = addSoulInstance(cls, 1, level);
    soul.capBonus = Math.max(0, level - soulLevelCap(cls, soul.count));
    const doll = makeDoll(`試遊${i + 1}・${SOUL_CLASSES[cls].label}`);
    doll.primary = soul.uid; recalcDoll(doll);
    doll.hp = doll.maxhp; doll.mp = doll.maxmp;
    G.party.push(doll);
  }
  G.dollsPurchased = G.party.length;
  // 開発用: まだ章の無い機能を試す (URL の testUnlock=rusui,… / 機能の解放の場面「unlock:キー」)
  G.testUnlock = (testParams.get("testUnlock") || "").split(",").filter((k) => FEATURES[k]);
  if (testScene && testScene.id.startsWith("unlock:") && FEATURES[testScene.id.slice(7)]) G.testUnlock.push(testScene.id.slice(7));
  if (testInfFloor) G.testUnlock.push("infinite");
  // 留守居の修練を試せるよう、控えに3体 (隊と同じ Lv)
  if (featureUnlocked("rusui")) {
    for (const [i, cls] of ["samurai", "monk", "bishop"].entries()) {
      const soul = addSoulInstance(cls, 1, level);
      soul.capBonus = Math.max(0, level - soulLevelCap(cls, soul.count));
      const doll = makeDoll(`控え${i + 1}・${SOUL_CLASSES[cls].label}`);
      doll.primary = soul.uid; recalcDoll(doll);
      doll.hp = doll.maxhp; doll.mp = doll.maxmp;
      G.reserve.push(doll);
    }
    G.dollsPurchased += 3;
    G.rusui = { picks: G.reserve.slice(0, rusuiSeats()).map((d) => d.uid) }; // 席の数だけ就けておく
  }
  G.gold = Math.round(refGold(level) * 30); G.redSoul = 300;
  G.state = "town";
  if (testScene?.kind === "tutorial") {
    const key = testScene.id.slice("tutorial:".length);
    G.testTutorial = key;
    G.tut.done = Object.fromEntries(uiTutorial.testTutorials.filter((t) => t.id !== testScene.id).map((t) => [t.id.slice(9), true]));
    addSoulInstance("fighter"); addSoulInstance("priest"); addSoulInstance("thief"); addSoulInstance("mage");
    if (["createThree", "createFourth", "createFifth", "createSixth", "prologueFormation", "prologueAppraise"].includes(key)) {
      const count = { createThree: 0, createFourth: 3, createFifth: 4, createSixth: 5, prologueFormation: 5, prologueAppraise: 6 }[key];
      const phase = { createThree: "three", createFourth: "fourth", createFifth: "fifth", createSixth: "sixth", prologueFormation: "formation", prologueAppraise: "appraise" }[key];
      G.party = []; G.reserve = []; G.souls = []; setSharedSouls(G.souls); G.dollsPurchased = 0;
      G.msq = { n: count ? 1 : 0, state: "world", granted: true, prologue: { phase, gifts: {} } };
      for (const job of ["fighter", "priest", "thief", "mage", "knight", "bishop"].slice(0, Math.max(3, count))) {
        const soul = addSoulInstance(job);
        if (G.party.length < count) { const d = makeDoll(randomDollName()); d.primary = soul.uid; recalcDoll(d); d.hp = d.maxhp; d.mp = d.maxmp; G.party.push(d); G.dollsPurchased++; }
      }
    }
    if (key === "newJobParty") { addSoulInstance("monk"); G.tut.jobVisit = true; }
    if (key === "repairSoul") { G.party[0].alive = false; G.party[0].hp = 0; G.tut.repairPending = true; }
    if (key === "firstDive" || key === "buyEquipment") {
      G.party = G.party.filter((d) => ["fighter", "priest", "thief", "mage"].includes(soulByUid(d.primary)?.clsKey));
      G.dollsPurchased = G.party.length; G.gold = 500;
      G.dungeonIdx = 0; G.dungeonBriefed = false; G.stabilityBriefed = false;
    }
  }
  return floor;
}

// ==== OPS: 一括操作 (Phase 0 が所有。以後は凍結し、拡張は UI 経由) ====
// どれも既存の単体操作 (宿・商会の鑑定/売却・赤い魂の連れ帰り・勲章の拝受・奉納・魂の鍛錬) のループで、
// 価格・除外条件は単体と同一 (釣り合いは変えない)。結果のオブジェクトを返し、記録 (log) と
// トーストは1回にまとめ、街を描き直す。施設が閉ざされている間 (第0章) は動かない。
function opsFacilityOpen(key) { const a = tutorialAllowed(); return !a || a.includes(key); }
function opsEquippedBy(d, it) { for (const k in (d.equip || {})) if (d.equip[k] === it) return true; return false; }
// 売却候補: 呪い・未鑑定・装備中・LR・未奉納の収集品 (bulkSellBlocked) は除外 (商会の一括売却と同じ。SR は含める)。
// 消耗品 (薬草など) は設定「まとめて売るに道具を含める」(UI の好み sellUse) が入っている時だけ含める。
// { includeUse } を渡せばその値が優先
function opsJunkList({ includeUse = !!uiDungeonHud.getPref("sellUse") } = {}) {
  const out = [];
  for (const d of bagOwners(allDolls())) {
    for (const it of (d.items || [])) {
      if (!it || it.cursed || it.locked || it.unidentified || opsEquippedBy(d, it) || bulkSellBlocked(it)) continue;
      if (!includeUse && it.slot === "use") continue;
      out.push({ doll: d, item: it, price: sellPrice(it) });
    }
  }
  return out;
}
// 拝受できる勲章 (段階表は「次の段階」だけ。勲章の間と同じ判定)
function opsClaimableAchievements() {
  const out = [];
  for (const s of ACH_SERIES) {
    const n = achNext(s);
    if (!n.done && n.tier.cond()) out.push(n.tier);
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
    for (const d of bagOwners(dolls)) for (const it of (d.items || [])) if (it && it.unidentified) { unid++; unidCost += appraiseCost(it); }
    const junk = opsJunkList();
    const dead = dolls.filter((d) => d.isDoll && !d.alive);
    let repairCost = 0, hastenCost = 0, rescuing = 0, repairNow = 0;
    for (const d of dead) {
      if (awaitingRescue(d)) { rescuing++; hastenCost += hastenCostOf(d); }
      else { const c = repairCostOf(d); repairCost += c; if (c <= G.gold) repairNow++; }
    }
    let ach = 0, treasuryReady = false;
    try { ach = opsClaimableAchievements().length; } catch (e) { ach = 0; }
    try { treasuryReady = treasuryRewardReady(); } catch (e) { treasuryReady = false; }
    return {
      hurt: G.party.filter((p) => p.alive && (p.hp < p.maxhp || p.mp < p.maxmp)).length,
      dead: dead.length, rescuing, repairable: dead.length - rescuing,
      repairNow, // いま館で修復できる (連れ帰り済み・金貨が足りる) 砕けた人業の数 — 人業の館のタブの印
      unid, unidCost,
      junk: junk.length, junkGold: junk.reduce((a, j) => a + j.price, 0),
      ach,
      donatable: opsNewKindCount(),
      questReady: questReadyCount(),
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
    const need = G.party.filter((p) => p.alive && (p.hp < p.maxhp || p.mp < p.maxmp || p.ailment));
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
    for (const d of bagOwners(allDolls())) for (const it of (d.items || [])) if (it && it.unidentified) list.push(it);
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

  // まとめて売る (opsJunkList の品を売値 sellPrice で。売った品は商会の在庫に並ぶ = 単体の売却と同じ)
  sellJunkAll(opts) {
    if (G.state !== "town" || !opsFacilityOpen("shop")) return { ok: false, reason: "closed", n: 0, gold: 0 };
    let n = 0, gold = 0;
    for (const { doll, item, price } of opsJunkList(opts)) {
      const idx = doll.items.indexOf(item);
      if (idx < 0) continue;
      doll.items.splice(idx, 1);
      G.gold += price; gold += price;
      tlTown("gold", price, "sell");
      if (item.id) shopReceive(item);
      codexSeeItem(item.id, item);
      n++;
    }
    if (n) {
      SFX.select(); buzz(10);
      log(`まとめて売却: ${n}点を売った (+💰${gold})。商会に並んだ。`, "win");
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
      if (wait.length) { log("赤い魂が足りない。", "sys"); SFX.ng(); }
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
        if (a.reward.gold) { G.gold += a.reward.gold; gold += a.reward.gold; tlTown("gold", a.reward.gold, "a"); }
        if (a.reward.redSoul) { grantRedSoul(a.reward.redSoul, "achievement"); red += a.reward.redSoul; }
        if (a.reward.soulPts) { G.soulPts += a.reward.soulPts; soul += a.reward.soulPts; tlTown("soul", a.reward.soulPts, "a"); }
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
      log(`${itemName(it)} を宝物庫に奉納し、💰${r.gold} を受け取った。`, "win");
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
    if (gold) parts.push(`💰${gold} を受け取った`);
    log(`収集品 ${list.length} 点を宝物庫に奉納した。${parts.join("・")}。`, "win");
    showToast(`収集品 ${list.length}点を奉納した${gold ? ` (💰${gold})` : ""}`);
    renderTown();
    return { ok: true, n: list.length, kinds, gold, rewardReady: treasuryRewardReady() };
  },

  // 魂を n 段強化する (n = Infinity で上限まで)。1段ごとの費用・上限は trainSoul と同じ。
  // 結果に宿主の能力の伸び (deltas) と新たに覚えた技 (gainedSkills) を添える。迷宮の中では鍛えられない
  trainTimes(uid, n = 1) {
    const e = soulByUid(uid);
    if (!e || !soulWorkOk()) return { ok: false, levels: 0, spent: 0 };
    const wearer = allDolls().find((d) => d.primary === uid || (d.subs || []).some((x) => x && x.uid === uid)) || null;
    const KEYS = ["maxhp", "maxmp", "atk", "vit", "agi", "int", "pie", "luk"];
    const before = wearer ? Object.fromEntries(KEYS.map((k) => [k, wearer[k] || 0])) : null;
    const beforeSpells = new Set(wearer ? (wearer.spells || []) : []);
    const soulBefore = wearer ? null : jobStatsOf(e.clsKey, e); // 誰も宿していない魂は魂そのものの能力を見比べる
    const beforeSkills = soulLearnedSkills(e); // サブ魂は宿主の技に入らないので、魂そのものが覚えた技も見比べる
    const from = e.level;
    // 蓄積していた exp で上がる段は無料で先に上げる (旧来は1段上げると exp=0 で残りが消えていた)
    let spent = 0, levels = settleSoulExp(e);
    for (let i = 0; i < n; i++) {
      if (e.level >= soulLevelCapOf(e)) break;
      const cost = Math.max(1, soulTrainCost(e.level) - (e.exp || 0));
      if (G.soulPts < cost) break;
      G.soulPts -= cost; spent += cost;
      e.level++; e.exp = 0;
      levels++;
    }
    if (!levels) {
      log(e.level >= soulLevelCapOf(e) ? "これ以上レベルを上げられない。" : "✦Soul が足りない。", "sys");
      SFX.ng();
      return { ok: false, levels: 0, spent: 0, from, to: from };
    }
    recalcAllDolls({ levelUp: true });
    codexJobSee(e.clsKey, e.count, e.level, e.capBonus);
    log(`${soulLabel(e)}が Lv${from}→${e.level} に成長した！ ${spent ? `(✦${spent})` : "(蓄積していた ✦Soul)"}`, "win");
    // 能力の伸び: before/after は hp/mp/atk… の表示キーで (魂の区分の「強化の結果」に並べる)
    const sk = (k) => (k === "maxhp" ? "hp" : k === "maxmp" ? "mp" : k);
    const deltas = {}, statsBefore = {}, statsAfter = {};
    if (wearer && before) for (const k of KEYS) {
      statsBefore[sk(k)] = before[k]; statsAfter[sk(k)] = wearer[k] || 0;
      const d = (wearer[k] || 0) - before[k]; if (d) deltas[sk(k)] = d;
    }
    if (soulBefore) {
      const soulAfter = jobStatsOf(e.clsKey, e);
      for (const k of Object.keys(soulAfter)) {
        statsBefore[k] = soulBefore[k]; statsAfter[k] = soulAfter[k];
        const d = Math.round((soulAfter[k] - soulBefore[k]) * 10) / 10; if (d) deltas[k] = d;
      }
    }
    // 結果は UI (soulpanel.js の train → レベルアップの祝祭カード) が見せる
    // 新たに覚えた技: 宿主の技の増え + 魂そのものが覚えた技 (サブ魂の強化でも、戦闘後・メイン魂の強化と同じく技を見せる)
    const gainedSkills = [...new Set([...(wearer ? (wearer.spells || []).filter((k) => !beforeSpells.has(k)) : []), ...soulLearnedSkills(e).filter((k) => !beforeSkills.includes(k))])];
    renderTown();
    return { ok: true, uid, levels, spent, from, to: e.level, deltas, before: statsBefore, after: statsAfter, gainedSkills, wearer };
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
  if (G.state === "board") { if (holdForAutoMove(() => UI.openDungeonMenu())) return true; if (!G.anim && !G.walking) UI.openDungeonMenu(); return true; }
  if (G.state === "combat") { if (G.autoCombat) stopAutoCombat(); return true; }
  if (G.state === "over") return true;
  return false;
}

// ==== UI 基盤の結線 (init の冒頭で一度) ====
function wireUI() {
  bindGame({
    G, log, autosave, buzz, flashScreen, shakeScreen,
    renderTown, renderBoard, renderParty, renderRunbar, updateTopbar, renderStatus,
    allDolls, recalcAllDolls, inDungeon, curDungeon, activeCfg, clearedDungeonCount, reportedDungeonCount,
    sellPrice, buyPrice, appraiseCost, innCost, sellWarnings, bulkSellBlocked, bargainMul, shopStockAdd, shopReceive, shopAfxItem, shopPlainStock, buyAffixed, afxConflicts, resolveAfxConflicts, tlTown,
    itemRankName, itemRankColor, itemGradeText, itemNameEl, logClassForItem,
    showChoice, closePrompt, showEvent, showConfirm, showToast, showItemGet, closeItemGet, showItemDetailPopup, showStoryScene,
    openStatus, closeStatus, openSettings, closeSettings, tryEnterDungeon, enterDungeon, returnToTown, confirmReturnToTown,
    tutorialAllowed, palaceCallReady, currentObjective, featureUnlocked, RUSUI_EXP_RATE, rusuiSeats, rusuiSeated, toggleRusuiSeat, contentSealed, reportMainQuest, acceptMainQuest, reportPending, blockForReport, tutorialPending, blockForTutorial,
    insightSummary, worldState, worldOpenIdx, pendingIreneBeat, playIreneBeat, dungeonLevel, FEATURES, featureNote, chaptersDone, storyGoal, currentChapter, dungeonTrait, dungeonFloorHaz,
    trainSoul, raiseSoulCap, raiseCapSoulCost, capBySoulOk, soulTrainCost, soulByUid, codexSeeItem, treasuryState, heldCollectibles, donateCollectible,
    claimAchievement, claimTreasury, treasuryRewardReady, deliveryHolder, deliveryStatus, deliverQuest,
    repairDoll, repairAllDolls, repairCostOf, tryHastenRescue, reviveTimerEl, fmtRemain, awaitingRescue, hastenCostOf,
    doEquip, doUnequip, toggleItemLock, equipFromAnywhere, reforgeCost, reforgeBlock, rollReforge, setItemQuality, openEquipChooser, useItem, dropItem, dropFromBag, askRoomFor, transferItem,
    stopAutoCombat, sceneBgm, playBgm, SFX,
    ACH_SERIES, FACILITIES, FAC_SHELL, CONTENT_LIMIT, DUNGEONS, LAYER_VISUALS,
    isTitleActive: () => titleActive,
    isOpeningActive: () => openingActive,
    resetTownSelection: () => { altarSel = null; },
  });
  installPhraseWrap(); // 説明文は全画面で文節ごとに折り返す (ui/phrase.js)
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
  for (const m of [uiHub, uiPalace, uiFacilities, uiSettings, uiJournal, uiStory, uiParty, uiSoulPanel, autoEquip, uiShop, uiLoot, uiAppraise, uiDeparture, uiDungeonHud, uiResults, uiTutorial, uiReforge, uiInfinite, uiDiscard]) {
    try { m.install(); } catch (e) { console.error(e); }
  }
}

// ==== [WP-A] UI API ==== (街・王宮・物語・設定・タイトル: WP-A が所有)
// 街タブ・王宮タブ・酒場/祠のページ・宿のシート・設定のシート・物語の場面 (src/ui/hub.js ほか) が使う game.js の内部。
// 読み込み時に一度 bindGame で結ぶ (wireUI の bindGame と同じ窓口に足し込む。名前は重ねない)
function resetAllData() { if (cloudEnabled() && !testPlayActive) return; _resetting = true; clearSave(); location.reload(); }
bindGame({
  // いまの目標・勅命・物語
  STABILITY_MAX, STABILITY_ENTRY_COST, STABILITY_RECOVERY_MS, refreshStability, stabilityStatus, restoreStability,
  stabilityMinutes, stabilityPerRed, stabilityCost, clueBoon, seraDoll,
  objectiveInfo, decreeInfo, replayDecree, palaceRecords, sharePalaceRecord, departTo, goMakeDoll, audienceTutorial,
  landOnHub, legacyToPage, townBgm,
  // 勲章・宝物庫・図鑑
  achievementCards, medalRank, claimNextTreasury, TREASURY_MILESTONES, milestoneLabel, milestoneWait, totalDonatedKinds,
  codexMonEntry, dungeonRoster, CODEX_OTHER,
  // 酒場・祠・宿
  ensureRumor, rumorFor, rollTavernCrowd, markTavernHeard, tavernNotes,
  questState, questLists, questByUid, questsHere, ensureQuestBoard, rollQuestBoard, acceptQuest, abandonQuest, claimQuest, questReadyCount, FREE_CAP, questHereNote, questHereCount, questsTargeting,
  adCooldownLeft, watchShrineAd, RED_PACKS, buyRedPack, GUARDIAN_COST, RESCUE_SHORTEN_MS,
  // 設定 (端末の好み)
  PREFS, savePrefs, setWalkerLook, setVolumes, isMuted, toggleMute, ensureAudio, updateMuteBtn, resetAllData, confirmReset,
  // 他のパッケージも使える街の部品 (肖像・図鑑の詳細)
  showCodexMonDetail, showCodexItemDetail, showCodexJobDetail,
});
// ==== /WP-A ====

// ==== [WP-B] UI API ==== (隊・魂・最適装備: WP-B が所有)
// 隊 (src/ui/party.js)・魂 (src/ui/soulpanel.js) が使う game.js の内部を結ぶ (モジュールの読み込み時 = init より前)。
// 契約 (UI.openParty / autoEquip / betterGearCount / trainableList / equipItemTo / bestWearer) は各モジュールの install() が登録する
bindGame({
  equipAt, equipFromWearer, moveItem, campCast, campSpellsOf, healAll, healAllNeed, repairCostOf, repairCostAll, repairDoll, setReviveTimers, hastenCostOf, tryHastenRescue, awaitingRescue, RESCUE_SHORTEN_MS,
  prologuePhase, prologueActive, prologueJob, prologueCreateSouls, preparePrologueDoll, completePrologueTutorial, prologueAppraisalItem, preparePrologueAppraisal, prologueAudience, stabilityApplies,
  emptyDollCost, grantRedSoul, randomDollName, finalizeBuyDoll, soulRepresentatives, partySoulConflict, soulSlotConflict, soulTakePlan, placeSoulInDoll, ownSoulSlot, blockSoulResonance, soulSortCmp, soulRankOf, soulWorn, soulWornByOther,
  equipSoulToSlot, fuseCandidates, fuseSubWorn, fuseSoul, fuseSouls, toggleSoulLock, openFusePicker, openSubSkillPicker, slotSoul,
  unlockedSubSlots, orderSeats, orderSeatedUids, toggleOrderSeat, showCodexJobDetail, addSoulInstance, codexSweepJobs,
  canIdentify, identifyChance, openIdentifyChooser, doIdentifySkill, itemKnown, isFirstGet,
  showRankUp, announceJobChange, showNameInput,
  omokageUnlocked, omokageRanks, setDollFace,
});
// ==== /WP-B ====

// ==== [WP-C] UI API ==== (商会・品・入手: WP-C が所有)
// 商会 (src/ui/shop.js) と品シート・入手 (src/ui/loot.js) が使う単体操作を結ぶ。
// 値段・判定はすべて上の単体操作のまま (釣り合いは変えない)。モジュールの評価時に結び、init の bindGame で補われる
bindGame({
  sellItem, buyItem, shopIdentify, openIdentifyChooser, doIdentifySkill, addIdentifyAction,
  giveItem, markDungeonLoot, cloneItem, SHOP_INIT_STOCK,
});
// ==== /WP-C ====

// ==== [WP-D] UI API ==== (迷宮・出撃・帰還・戦果: WP-D が所有)
// 出撃シート・迷宮の HUD・戦果/帰還の報告 (src/ui/departure.js / dungeonhud.js / results.js) が使う game.js の内部。
// モジュールの評価時 (init より前) に結ぶ。init の wireUI が同じ game へ残りを足す
bindGame({
  // 出撃
  departNow, corpseFadeShare, departAbyss, infVesselNames, rematchList, departRematch, REMATCH_FORGE_MAX, townMutatorFor, preDiveIssues, departWoes, DUNGEON_BRIEFING, STORY_CELLS, startFloorsOf, worldOpenIdx, worldOpenId, worldUnlockMet, levelBand, wallOf, wallStepOf, partyLevel, storyCellPending, dungeonFacts, dungeonQuests, namedHere, namedList, namedInfo,
  abyssRecords, infStats, infTitleList, infTitleName, setInfTitle, emptyDollCost, infRule, infAtRest, soulWorkOk, infTraderWares, infSupplyStatus, infBuyBlock, infBuy, infSell, infSellPlan, infSellAll, shopAfxClash, infSwapSoul, infSoulChangeBlock, infSoulChangePreview, infSubBlock, infSubPreview, infSetSub, infLevel, infGrowthMul,
  // 迷宮の HUD
  specialDef, mutDef, eliteKey, dungeonObjective, abyssActive, abyssBossPending, findRevealedStairs, canReturnNow, confirmAbandonDungeon,
  dungeonTheme, eventFacts,
  renderDock, // 設定「オート移動と見えている敵」を変えた時、ドックの札の説明を描き直す
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
  if (ms.n >= 1) { const ch = currentChapter(); head = `第${ch.no}章「${ch.title}」 ― 師を捜す旅`; }
  const lines = [`踏破 ${clearedDungeonCount()} 迷宮 ・ 人業 ${allDolls().length}体`];
  if (G.state === "board" || G.state === "combat") {
    lines.push(abyssActive() ? `探索中 — ${INF_NAME} B${G.abyss.depth}F` : `探索中 — ${curDungeon().name} B${G.floor}F`);
  }
  lines.push(`💰${G.gold}　✦${G.soulPts}　🔴${G.redSoul}`);
  if (G.apprenticeName) lines.unshift(`操霊師 ${G.apprenticeName}`);
  const sprites = (G.party || []).filter((d) => d && d.primary != null).map((d) => dollBust(d));
  return { head, lines, sprites };
}

async function init() {
  // UI 基盤 (ctx の結線・戻る操作・街シェル・各パッケージ) を最初の描画より前に整える
  wireUI();
  // 早期にフックを公開 (起動失敗の誤検出/デバッグ用)
  window.__game = { G, edgeOpen, COLS, ROWS, autosave, loadGame, clearSave, renderTown, ACH_SERIES, achievementCards, medalRank, questProgress, pickLoot, showItemGet, startBattle, spawnCardEnemies, spawnBossEnemies, activeCfg,
    UI, ops, nav, townshell,
    // 罠の解除の検証用
    trap: { disarmChance, disarmNeed, bestDisarmer, sfNum },
    // 装備できるLv の検証用
    equipLv: { equipLevelOf, fixEquipLevels, unequippableUnder, equipAt, ITEMS, cloneItem },
    // 出来事・記録の検証用
    evApi, runEvent, logHistory,
    // 留守居の修練の検証用
    rusui: { distributeBattleSoulExp, RUSUI_EXP_RATE, soulByUid, rusuiSeats, rusuiSeated, toggleRusuiSeat },
    // オート移動の検証用
    autoMove: { setAutoMove, toggleAutoMove, autoMovePlan, cellRect, viewSize: () => ({ VW, VH }) },
    // 宿敵の再戦の検証用
    rematch: { rematchList, departRematch, endBattle },
    // 無限迷宮の検証用
    inf: { infStats, infTitleList, infTitleGrant, infCheckRun, doUnequip, giveItemAsk, giveItem, pickLoot, cloneItem, markDungeonLoot, shopAfxItem, buyAffixed, afxConflicts, resolveAfxConflicts, shopReceive, saveJSON: () => { const snap = {}; for (const k of SAVE_FIELDS) snap[k] = G[k]; return JSON.stringify(refSerialize(snap)); }, DUNGEONS, spawnBossEnemies, baseEnemyScale, soloScale, infBossFoes, infEliteFoes, infFoeKey, infSpotInfo, spawnCardEnemies, enemyScale, mimicRef, addSoulInstance, recalcAllDolls, enterAbyss, departAbyss, descend, openInfRest, fightAbyssGuard, abyssCfg, grantSoulQuiet, infSwapSoul, infSetSub, infSubBlock, infSubPreview, infBuy, infSell, infTraderWares, infSupplyStatus, infBuyBlock, infTlPoint, returnToTown, gameOver, leaveDungeon, abyssRecords, newFloor, renderBoard, finishToBoard },
    // 迷宮の掟の代償 (雲間の泉・開幕の眠り/麻痺・宝箱の罠) の検証用
    ruleCost: { TRAIT_BOARD, mutNum, useVeiledFountain, VEILED_CURSE, RULE_ONE_AIL, disarmNeed, dungeonTrait },
    // 第九章の掟 (一騎打ち・観客の注文) の検証用
    arenaRules: { duelFoes, audienceOrderFor, AUDIENCE_ORDERS },
    // 宝物庫の褒賞の検証用
    treasury: { TREASURY_MILESTONES, treasuryState, totalDonatedKinds, treasuryDepth, milestoneWait, milestoneReady, pickTreasurySR, pickTreasuryLR, claimTreasury, claimNextTreasury, treasuryRewardReady },
    // 酒場の依頼の検証用
    quest: { questState, questLists, rollQuestBoard, acceptQuest, claimQuest, deliverQuest, questProgress, questDungeons, dungeonFullyCleared, partyLevel },
    // 迷宮のイベント (出来事) の検証用
    ev: { evApi, runEvent, eventFightWon, EVENT_MAP, enterDungeon, newFloor, descend, resolveCell, renderBoard, endBattle, evNewFloor, evProgress, eventFacts, makeDoll, addSoulInstance, recalcDoll, evUnit },
    // 迷宮の台帳・物語の進みの検証用
    world: { prologuePhase, preparePrologueDoll, completePrologueTutorial, prologueAudience, preparePrologueAppraisal, audienceTutorial, clearDungeonNoBoss, reportMissingClue, worldState, refreshWorldUnlocks, reportMainQuest, lateClue, tellLateClue, reportTutorialQuest, grantTutorialGift, commitDungeonClear, showDungeonClearedPopup, askGate, departNow, storyGoal, objectiveInfo, decreeInfo,
      playIreneBeat, pendingIreneBeat, storyNewFloor, runStoryCell, resumeFromState, startFloorsOf, foeLevelHere, claimTreasury, partyLevel, leaveDungeon, DUNGEONS, finalizeBuyDoll, totalDonatedKinds, treasuryState,
      clueBoon, syncClueBoons, seraJoin, seraDoll, seraRankUp, syncSeraSoul, repairCostOf, restoreStability, stabilityStatus, revealByCartography } };

  if (testPlayActive) {
    const floor = setupTestPlay();
    titleActive = false; G.prompt = false;
    const banner = document.createElement("div");
    banner.className = "test-play-banner";
    banner.appendChild(document.createTextNode("テストプレイ中・保存なし "));
    const exit = document.createElement("button");
    exit.type = "button"; exit.textContent = "終了してホームへ";
    exit.addEventListener("click", () => {
      const url = new URL(location.href);
      for (const key of ["testDungeon", "testFloor", "testPlace", "testScene", "testUnlock", "testInf", "testInfLv"]) url.searchParams.delete(key);
      location.replace(url.href);
    });
    banner.appendChild(exit); document.body.appendChild(banner);
    resumeFromState();
    revealBootScreen();
    if (testScene?.kind === "tutorial") uiTutorial.startTestTutorial(G.testTutorial);
    else if (testScene?.id === "opening") startAfterTitle(false);
    else if (testScene) UI.playStoryChain([{ title: testScene.title || testScene.name, lines: storyLines(testScene.lines), art: testScene.art, photo: testScene.photo, who: testScene.who || "king" }], renderTown);
    else if (testInfFloor) { infTestStart(testInfFloor, Math.floor(Number(testParams.get("testInfLv"))) || 0); return; }
    else if (testParams.get("testPlace") !== "town") enterDungeon(null, floor);
    playBgm(sceneBgm());
    return;
  }
  let loaded = false;
  if (cloudEnabled()) {
    let localSave = null;
    try { localSave = localStorage.getItem(SAVE_KEY); } catch {}
    const snapshot = await connectCloud(localSave);
    loaded = loadGame(snapshot);
    if (snapshot && !loaded) throw new Error("クラウドの記録を読み込めません");
  } else {
    try { loaded = loadGame(); } catch (e) { loaded = false; }
  }
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
  const start = (name) => {
    if (started) return;
    if (!loaded) G.apprenticeName = normalizeName(name);
    started = true;
    titleActive = false;
    G.prompt = false;
    startAfterTitle(loaded);
  };
  // タイトルの「はじめから」(記録あり): 確認ののち記録を消して読み直し、タイトルを飛ばして序章から始める
  const newGameFromTitle = (name) => {
    _resetting = true;
    clearSave();
    try { sessionStorage.setItem("dos-newgame", "1"); sessionStorage.setItem("dos-newgame-name", normalizeName(name)); } catch (e) {}
    location.reload();
  };
  let freshStart = false, freshName = "";
  try { freshStart = sessionStorage.getItem("dos-newgame") === "1"; sessionStorage.removeItem("dos-newgame"); freshName = normalizeName(sessionStorage.getItem("dos-newgame-name")); sessionStorage.removeItem("dos-newgame-name"); } catch (e) {}
  if (freshStart && freshName && !loaded) start(freshName);
  else {
    try {
      showTitle({ hasSave: loaded, summary: loaded ? titleSummary() : null, onStart: start, onNewGame: loaded && !cloudEnabled() ? newGameFromTitle : null,
        testDungeons: DUNGEONS, testScenes, onTestPlay: ({ id, floor, place, scene, inf, infLv }) => {
          _resetting = true;
          const url = new URL(location.href);
          if (inf) { // 無限迷宮の試遊: ○階から、隊Lv○で
            for (const key of ["testDungeon", "testFloor", "testPlace", "testScene"]) url.searchParams.delete(key);
            url.searchParams.set("testInf", inf);
            if (infLv) url.searchParams.set("testInfLv", infLv); else url.searchParams.delete("testInfLv");
            location.assign(url.href);
            return;
          }
          url.searchParams.delete("testInf"); url.searchParams.delete("testInfLv");
          if (scene) url.searchParams.set("testScene", scene); else url.searchParams.delete("testScene");
          url.searchParams.set("testDungeon", id); url.searchParams.set("testFloor", floor); url.searchParams.set("testPlace", place);
          location.assign(url.href);
        } });
      revealBootScreen();
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

// 物語・由来の絵のうち、端末へ裏で集めておく分 (進めている章まで) を Service Worker へ伝える。
// 変わった時だけ送る。テストプレイの進み具合は伝えない (保存しない進行で絵を集めない)
let _storyMediaKey = null;
function syncStoryMedia() {
  if (testPlayActive || !("serviceWorker" in navigator)) return;
  const urls = storyMediaUrls(G, chaptersDone()), key = urls.join("|");
  if (key === _storyMediaKey) return;
  _storyMediaKey = key;
  navigator.serviceWorker.ready.then((reg) => {
    if (reg.active) reg.active.postMessage({ type: "story-media", urls });
  }).catch(() => {});
}

// タイトルを抜けた後の本編起動: 保存状態の復元描画 → (新規なら) オープニング
function startAfterTitle(loaded) {
  updateTopbar();
  // 復元描画に失敗してもセーブは絶対に消さない (データ保全優先)。
  // 失敗時は安全に街表示へフォールバックする。
  try {
    resumeFromState();
  } catch (e) {
    if (cloudEnabled() && !testPlayActive) { cloudFatal(); return; }
    try {
      G.state = "town"; G.town = { facility: null, sub: null, tab: "hub", page: null };
      G.statusOpen = false; G.settingsOpen = false; G.prompt = false; G.anim = null; G.walking = false;
      renderTown();
    } catch (e2) { /* これ以上は何もしない (セーブは温存) */ }
  }
  revealBootScreen();
  autosave(true);

  if (loaded) {
    playBgm(sceneBgm());
    // 勝利は確定済みだが、魂の記憶を読む途中で閉じた場合は再表示する。
    if (G.state === "board" && G.bossDown && !abyssActive()) {
      const dn = curDungeon();
      if (BOSS_MEMORIES[dn.id] && !worldState().beats["mem_" + dn.id]) {
        showDungeonClearedPopup({ idx: G.dungeonIdx, isStoryTarget: !worldState().reported[dn.id] });
      }
    } else if (G.state === "town") {
      const w = worldState();
      const id = Object.keys(BOSS_MEMORIES).find((id) => w.cleared[id] && !w.beats["mem_" + id]);
      if (id) playBossMemory(id, renderTown);
    }
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
init().catch((e) => { revealBootScreen(); console.error("ゲームの起動に失敗しました", e); if (cloudEnabled()) cloudFatal(); });
