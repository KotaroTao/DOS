// メインゲーム: カードボード探索 ⇄ 戦闘 (モンスターメーカー風)
import { makeBoard, COLS, ROWS } from "./board.js";
import { MONSTERS, HERO, ICONS, drawSprite, drawSpriteFit } from "./sprites.js";
import { spawnCardEnemies, spawnBossEnemies, spawnEliteEnemies, spawnMimic, Battle, SPELLS, cloneItem, spellCost } from "./combat.js";
import { initAudio, SFX, playBgm, toggleMute, isMuted, setVolumes } from "./audio.js";
import { spriteCanvas } from "./sprites.js";
import {
  ITEMS, SLOTS, SLOT_LABEL, SLOT_ICONS, MAX_ITEMS, equip as equipItem, unequip as unequipItem, canEquip, slotKeyFor,
  ITEM_CATS, WEAPON_CATS, WEAPON_CAT_LABEL, lvToRank, weaponRange, RANGE_LABEL,
  UNIDENT_SLOTS, itemName,
} from "./items.js";
import { RANK_NAME, RANK_COLOR, ITEM_RANK_NAME, ITEM_RANK_COLOR } from "./content.js";
import { dungeonSubQuests } from "./subquests.js";
import { TAVERN_SPEAKERS, TAVERN_HINTS } from "./tavern.js";
import { ACTS, actOf, msqOrderLines, msqReportLines, msqReward, EPILOGUE, unlockSceneFor } from "./story.js";
import { CATALOG_ITEMS } from "./catalog/index.js";
import { DUNGEONS, DUNGEON_MONSTERS, RACE_LABEL, ELEMENTS, ELITE_ORDER, LAYER_BOSS, monsterTraits, layerOf } from "./dungeons/index.js";
import {
  ABYSS_MODS, ABYSS_MOD_MAP, ABYSS_MUTATIONS, ABYSS_MUT_MAP, ABYSS_BOSS_EVERY, ABYSS_MUT_EVERY,
  ABYSS_UNLOCK_DUNGEON, abyssScore, abyssScoreMul, rollAbyssMutation, weekSeedId, mulberry32,
} from "./abyss.js";
import {
  SOUL_CLASSES, SOUL_KEYS, makeDoll, soulSprite, jobSprite, dollSprite,
  recalcDoll, jobStatsOf, soulLevelCap, soulLevelCapOf, setSharedSouls, MAX_SUBS,
  soulByUid, makeSoulInstance, allSoulInstances, soulRankOf, soulLearnedSkills, soulLearnedPassives,
  ORDER_PERK, orderPassiveMap, orderPerkLv,
  PASSIVES, passiveName, passiveDesc,
  ATTR_KEYS, ATTR_LABEL, ATTR_NAME,
  SOUL_RANKS, rollJobClass, rollGreatJobClass, SOUL_STAT_UP,
  soulRankFromCount, nextRankThreshold, rankThresholds, capForRarityRank,
  jobLoreFor, jobRankCondText,
  jobSkillTable, jobRankName, soulSeriesName, jobPassiveTable, pLv, JOB_GEAR,
  identifyChance, canIdentify, identifyLabel,
} from "./souls.js";
import { showOpening } from "./opening.js";
import { KING_PORTRAIT, createTownScene, townSpots, vignetteCanvas, keeperCanvas, iconCanvas, prewarmTown } from "./townart.js";
import { drawBattleBackdrop } from "./backdrops.js";
import { paintCryptFloor, paintCryptSlabs, paintCryptWalls, CATACOMB, genericMaterial, boardSeed, hexRgb } from "./crypt.js";
import { showTitle } from "./title.js";
import { RARITIES, rarityKey, rarityColor, rarityLabel, rollRarity, layerRarityUp, lrIntervalH, lrLayerFactor, LR_HAZARD_K, LR_PITY_K } from "./rarity.js";
// ---- UI 基盤 (Phase 0)。新しい UI モジュールは game.js を import せず、ctx.js の UI/game/ops を通す ----
import { UI, ops, bindGame, registerUI } from "./ui/ctx.js";
import { el, btn, button as kitButton, longPress as attachLongPress, uiBlocked, sheet, toast as kitToast, confirm as kitConfirm, plainText, shake as kitShake } from "./ui/kit.js";
import { nav } from "./ui/nav.js";
import * as townshell from "./ui/townshell.js";
import {
  elemStatChip, showSkillPopup, skillChips,
  SPELL_KIND_COLOR, statLines, isEquippable, equipPreviewDelta, equipCompareEl, itemCatText, detailLines,
  equipClassText, equipPartyChips, gearScore,
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

// キャンバスに描く文字の書体 (画面の明朝と揃える)
const CANVAS_SERIF = '"Shippori Mincho B1", "Hiragino Mincho ProN", "Yu Mincho", "YuMincho", "Noto Serif JP", "Noto Serif CJK JP", serif';
// 視差・揺れを抑える設定 (OSの「視差効果を減らす」)。待機アニメなどを止める
const REDUCED_MOTION = (() => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } })();
import { pickTrap, CHEST_RANKS, rollChestRank } from "./traps.js";

// ===== コンテンツの取り込み =====
// アイテム: 一点物の手作りカタログ (src/catalog/)。二つ名つきの量産品は廃止。
// モンスター: ダンジョン単位で手作りした図鑑 (src/dungeons/) を統合。
Object.assign(ITEMS, CATALOG_ITEMS);
// レア度の無い装備 (items.js の基本装備など) はコモン扱い。蒐集品・道具はレア度なし。
// 基本装備は商店の品揃え専用とし、迷宮のドロップ表からは外す (ドロップのコモンはランク別標準装備が担う)
for (const id in ITEMS) {
  const it = ITEMS[id];
  if (!it.rar && it.slot && it.slot !== "misc" && it.slot !== "use" && it.slot !== "mat") {
    it.rar = it.lr ? "lr" : "c";
    if (!CATALOG_ITEMS[id]) it.noDrop = true;
  }
}
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

// アイテムの格の表示名/色。装備はレア度 (コモン〜レジェンドレア) を、蒐集品などは従来のランクを使う
function itemRankName(it) { return rarityLabel(it) || (it && it.rank ? ITEM_RANK_NAME[it.rank] : null); }
function itemRankColor(it) { return rarityColor(it) || (it && it.rank ? ITEM_RANK_COLOR[it.rank] : null); }
// カードの見出し (格): 装備はレア度、職業専用は「専用装備」を添える。蒐集品は従来のランク
function itemGradeText(it, fallback = "アイテム") {
  const rl = rarityLabel(it);
  if (rl) return it.forJob ? `${rl} ・ 専用装備` : rl;
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
// 仕様: 各迷宮には「基準ランク R = min(20, ダンジョン番号)」があり、
// アイテムはその ±2 (R-2〜R+2、1-20でクランプ) の範囲から出現する (例: D5 → R3-7)。
// 補正で中心を押し上げる: ミミック +1 / マスターミミック +2 / 特別階 +1 / 強敵 +2 /
// レア枠 +2 / 宝箱ランク(1-5) +0〜2 / 迷宮の異変。補正は重複加算する。
function lootBaseR() { return Math.max(1, Math.min(20, dungeonNumber(activeCfg()))); }

let _itemsByR = null;
let _miscLootIds = null;
function itemsByR() {
  if (_itemsByR) return _itemsByR;
  _itemsByR = Array.from({ length: 21 }, () => []);
  _miscLootIds = [];
  // 蒐集品 (slot:"misc") はランク窓に入れず別枠で全域から抽選する (下記 pickItemByR 参照)。
  for (const id of LOOT_IDS) {
    if (ITEMS[id].slot === "misc") { _miscLootIds.push(id); continue; }
    _itemsByR[Math.max(1, Math.min(20, ITEMS[id].r20 || 1))].push(id);
  }
  return _itemsByR;
}
function miscLootIds() { itemsByR(); return _miscLootIds; }
// 蒐集品は LR 装備と同様「深度の上限なし」で出続けるが、LR と違い一点ものではなく
// 何度でも同じ品が出る。深い迷宮ほど低ランクの蒐集品も拾える (D80 でも D20 帯の品が出る) よう、
// 自ランク以下の蒐集品をすべて対象にする (上限のみ中心+2 まで許容し、極端な先取りは抑える)。
const MISC_LOOT_WEIGHT = 0.5; // 装備のランク窓に対する蒐集品1点あたりの相対重み
// 中心ランク centerR の ±2 から1つ抽選 (中心ほど出やすい)。窓内が空なら最寄りへ広げる
function pickItemByR(centerR) {
  const idx = itemsByR();
  centerR = Math.max(1, Math.min(20, Math.round(centerR)));
  let total = 0; const acc = [];
  const gather = (lo, hi, weighted) => {
    for (let r = lo; r <= hi; r++) {
      const w = weighted ? Math.max(1, 3 - Math.abs(r - centerR)) : 1;
      for (const id of idx[r]) { total += w; acc.push([id, total]); }
    }
  };
  gather(Math.max(1, centerR - 2), Math.min(20, centerR + 2), true);
  for (let span = 3; span <= 20 && !total; span++) gather(Math.max(1, centerR - span), Math.min(20, centerR + span), false);
  // 蒐集品: 中心+2 以下の全ランク帯を一律の重みで対象に加える (下限なし=深層でも浅層の品が出る)
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
  return Math.max(1, Math.min(20, r));
}

// ===== レア度つきドロップ (コモン/アンコモン/レア/スーパーレア/レジェンドレア) =====
// 装備ドロップのたびに、まずレア度を抽選し (rarity.js rollRarity)、その格の品をランク窓 (中心R±2) から選ぶ。
// 窓にその格の品が無ければ窓を広げ、それでも無ければ一段下の格に落とす。
// レジェンドレアだけは実プレイ時間で抽選する (lrTimeRoll)。蒐集品は一定割合で別枠から出る。
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
function pickOfRarity(rar, centerR) {
  const idx = lootByRarity()[rar];
  if (!idx) return null;
  // コモン/アンコモンは窓を狭く (中心±1) して顔ぶれを絞る。レア以上は ±2
  const span0 = rar === "c" || rar === "uc" ? 1 : 2;
  for (let span = span0; span <= 6; span++) {
    let total = 0; const acc = [];
    for (let r = Math.max(1, centerR - span); r <= Math.min(20, centerR + span); r++) {
      const w = Math.max(1, 3 - Math.abs(r - centerR));
      for (const id of idx[r]) {
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
  const lrId = lrTimeRoll();
  if (lrId) return lrId;
  const order = ["c", "uc", "r", "sr"];
  let k = order.indexOf(rollRarity(rarityUp(opts)));
  for (; k >= 0; k--) {
    const id = pickOfRarity(order[k], centerR);
    if (id) return id;
  }
  return pickItemByR(centerR);
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
// 今の深さで出せるLR (1点もの: 入手済みは除く)。第1層の逸品 (tier1) は常に候補、
// 職業専用LR (tier5以上) は従来どおり lootLv の解禁値を超えてから
function lrPool() {
  const lv = lootLvAt();
  return Object.keys(ITEMS).filter((id) => {
    const it = ITEMS[id];
    if (it.rar !== "lr" || (G.lrOwned && G.lrOwned[id])) return false;
    return it.lr <= 1 || lv >= (LR_UNLOCK[it.lr] || 40);
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
// 第1層の逸品 (tier1) は常に候補。1点もの (G.lrOwned) は以後候補から外れる
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
const AIL_ICON = { poison: "☠", paralyze: "💫", stone: "🗿" };
const AIL_NAME = { poison: "毒", paralyze: "麻痺", stone: "石化" };

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
  pendingDoll: null,  // (旧形式) 未生成の人業。現在は「空の人形」(isEmpty) として reserve に残る (ロード時に移行)
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
  fastAnim: false,    // 戦闘演出の倍速設定 (永続)
  autoCombat: false,  // オート戦闘中 (セッション内のみ)
  tavernCrowd: null,  // 酒場に居合わせる者たち (帰還ごとに3〜5名を選び直す) [{type,icon,name,line}]
  rumor: null,        // 酒場で表示中の噂 (次回潜入で現実化)
  rumorCooldown: 0,   // 次の噂を聞けるUNIXタイムスタンプ(ms) — 30分クールダウン
  activeRumor: null,  // 潜入時に確定した、この迷宮で適用する噂
  deliveryQuests: null, // 酒場の納品依頼 [{itemId}] (最大3件。迷宮に潜るたびに入れ替わる)
  codex: { mon: {}, item: {}, job: {} }, // 図鑑 (モンスター/アイテム/職業)
  treasury: { donated: {}, claimed: {} }, // 王宮の宝物庫: donated={蒐集品id:true}, claimed={"ランク:しきい値":true}
  lrOwned: {},        // LR(専用装備)は1点もの: 一度入手したidは二度とドロップしない
  lrClock: { since: 0, pend: 0 }, // レジェンドレアの時間抽選 (最後のLRからの/前回抽選からの実プレイms)
  order: { picks: [] }, // 控えの結社: 席に着けた魂のuid配列 (席数=orderSeats()。編成外ランク2以上のみ有効)
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
  const d = { bgm: 0.8, sfx: 1, vibrate: true, classicBattle: false };
  try { return { ...d, ...(JSON.parse(localStorage.getItem(PREFS_KEY)) || {}) }; } catch { return d; }
})();
function savePrefs() { try { localStorage.setItem(PREFS_KEY, JSON.stringify(PREFS)); } catch {} }
setVolumes(PREFS.bgm, PREFS.sfx);

// ---- 潜入中の戦利品トラッキング (全滅ペナルティ / Red Soul帰還で使う) ----
const inDungeon = () => G.state === "board" || G.state === "combat" || G.state === "over";
// パーティ内で最も強い装備効果(eff)値を返す (LR装飾品の goldUp/soulUp 等。重複装備は加算せず最大値)
function partyEffMax(key) { let s = 0; if (G.party) for (const m of G.party) { if (m && m.eff && m.eff[key] > s) s = m.eff[key]; } return s; }
// 迷宮で得るゴールド (戦闘勝利・宝箱・床イベント) の共通入口。全体の獲得量を半分に抑える。
// 黄金の指輪 (LR装飾品) の goldUp があれば獲得量を割合で増やす。
function runGainGold(g) { g = Math.round(g * 0.5 * sfNum("goldMul", 1) * mutNum("goldMul", 1) * (1 + partyEffMax("goldUp"))); G.gold += g; if (G.run && inDungeon()) G.run.gold += g; return g; }
// 魂導の護符 (LR装飾品) の soulUp があれば ✦Soul の獲得量を割合で増やす。
function runGainSoulPts(s) { s = Math.round(s * sfNum("soulMul", 1) * mutNum("soulMul", 1) * (1 + partyEffMax("soulUp"))); G.soulPts += s; if (G.run && inDungeon()) G.run.soulPts += s; return s; }
function runGainItem(owner, item) {
  owner.items.push(item);
  if (G.run && inDungeon()) G.run.items.push({ owner, item });
  if (item && item.rar === "lr") { if (!G.lrOwned) G.lrOwned = {}; G.lrOwned[item.id] = true; } // LRは1点もの
}
// 魂の吸収を記録 (全滅没収で巻き戻すため {doll, clsKey} で覚える)
// 魂の入手を記録 (全滅没収で巻き戻すため)。kind: "awaken"(共有countへ) | "bag"(未覚醒)
function runTrackSoul(clsKey, kind) { if (G.run && inDungeon()) G.run.souls.push({ clsKey, kind }); }

// ===== 所持魂 (個別インスタンス) のヘルパー =====
// 魂を1体、所持魂一覧 (G.souls 配列) に加える
function addSoulInstance(clsKey, count = 1, level = 1) {
  const s = makeSoulInstance(clsKey, count, level);
  G.souls.push(s);
  return s;
}
// 全人業を再計算する (魂の Lv/ランク/装備変化を反映)
function recalcAllDolls() {
  for (const d of allDolls()) {
    recalcDoll(d);
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
    for (let i = G.souls.length - 1; i >= 0; i--) {
      const s = G.souls[i];
      if (s.clsKey === k && !soulWorn(s.uid)) { G.souls.splice(i, 1); break; }
    }
  }
  recalcAllDolls();
  G.run = null;
}

// 砕けた人業: 死亡を戦績に記録し、街への連れ帰りタイマーをセット
function imprintFallen() {
  for (const d of G.party) {
    if (d.isDoll && !d.alive && !d._dead) { G.stats.deaths++; d._dead = true; }
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

function log(msg, cls = "sys") {
  // 直前と同じ文 (壁にぶつかり続けた時など) は行を増やさず「×N」で数える
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
// 現在は第1層 (迷宮1-5) を作り込み中。第2層以降は「準備中」として閉じ、刷新が済んだ層から引き上げる。
// 既存セーブで先へ進んでいる場合も勅命の進行 (G.msq) は書き換えず、表示と潜入だけを止める
const CONTENT_LIMIT = 5;
const CONTENT_NEXT_LAYER = Math.floor(CONTENT_LIMIT / 5) + 1; // 準備中の層番号
const contentSealed = () => !!G.msq && (G.msq.state === "sealed" || G.msq.n > CONTENT_LIMIT);

// 日付シード (日替わりクエスト・商店の無料受領の判定に使う)
function dailySeed() { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); }

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
    board: (b) => sfEachCell(b, (c) => { if (c.type === "corpse" && !c.cleared) c.corpseWarm = true; }) },
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
    lines: ["床のいたるところから毒が滲み出している。", "足場は危険だが、沼には金品が沈んでいる。ゴールド 1.5倍。"],
    board: (b) => sfEachCell(b, (c) => { if (c.type === "empty" && sfOpenCount(c) >= 2 && Math.random() < 0.30) { c.type = "poison"; c.cleared = false; } }) },
  { id: "tailwind", name: "追い風の階", icon: "stairs", accent: "#7fe0a8", sym: "≫", minFloor: 2, rate: 0.02, preempt100: true, noAmbush: true,
    lines: ["不思議と体が軽く、敵の動きがよく見える。", "常に先手を取り、奇襲を受けない。"] },
  { id: "elemSurge", name: "属性の奔流", icon: "wisp", accent: "#ff9a4a", sym: "✺", minFloor: 2, rate: 0.02, elemAll: true, cond: (cfg) => !!cfg.element,
    lines: ["迷宮の属性が荒れ狂っている。", "この階の敵はすべて迷宮の属性を帯びる。属性装備が鍵だ。"] },
  { id: "mimicNest", name: "ミミックの巣", icon: "chest", accent: "#e07840", sym: "◈", minFloor: 3, rate: 0.015, mimicRate: 0.50,
    lines: ["不自然なほど宝箱が多い…罠の匂いがする。", "宝箱の半分はミミックだ。だが倒せば上質な宝箱を残す。"],
    board: (b) => sfPlace(b, 3, (c) => { c.type = "chest"; c.cleared = false; }) },
  { id: "healing", name: "癒しの霊気", icon: "fountain", accent: "#8af0c0", sym: "✚", minFloor: 2, rate: 0.02, victoryHeal: 0.10,
    lines: ["澄んだ霊気が満ち、傷を癒してくれる。", "戦闘に勝利するたび、隊全体のHPとMPが10%回復する。"] },
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
    risk: "魔物どもが昂ぶり、強くなっている (敵の力 1.3倍)",
    gain: "得られる Soul が 2倍 になる" },
  { id: "goldRush", name: "黄金熱", sym: "💰", accent: "#ffd84a", enemyMul: 1.25, goldMul: 2,
    risk: "財の気配に魔物が殺気立っている (敵の力 1.25倍)",
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
  { id: "elemRage", name: "属性の暴走", sym: "✺", accent: "#ff9a4a", elemAll: true, soulMul: 1.5, cond: (cfg) => !!cfg.element,
    risk: "すべての敵が迷宮の属性を帯びる (属性装備がないと危険)",
    gain: "得られる Soul が 1.5倍 になる" },
  { id: "mimicMarch", name: "ミミックの行進", sym: "◈", accent: "#e07840", mimicRate: 0.30, chestRankUp: 1,
    risk: "宝箱の3割はミミックだ",
    gain: "宝箱が 1ランク上等になり、ミミックは上質な宝箱を残す" },
  { id: "abyssalSurge", name: "深淵の脈動", sym: "☠", accent: "#8a2be2", enemyMul: 1.5, soulMul: 2, goldMul: 1.5, lootBonusLv: 8,
    risk: "迷宮中の敵が大幅に強くなっている (敵の力 1.5倍)",
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
  noFlee: "or", elemAll: "or", noTrap: "or", poisonUp: "or",
};
// この潜入で効いている全修飾子源 (迷宮の異変 + 奈落の誓約 + 奈落の変異) を列挙
function activeModifierDefs() {
  const defs = [];
  const md = mutDef(); if (md) defs.push(md);
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
function enemyScale() {
  const cfg = activeCfg();
  return (cfg.enemyScale || 1) * (1 + (G.floor - 1) * 0.06) * sfNum("enemyMul", 1) * mutNum("enemyMul", 1);
}

// ミミックの強さ参照: 現在地より ahead 先のダンジョン (末尾でクランプ) の rank と
// enemyScale を借りる。これで「D2 のミミックは D3 相当」になる。
// 階層補正・特別階補正は現在地のものを掛ける。
function mimicRef(ahead) {
  const ref = DUNGEONS[Math.min(DUNGEONS.length - 1, G.dungeonIdx + ahead)];
  const scale = (ref.enemyScale || 1) * (1 + (G.floor - 1) * 0.06) * sfNum("enemyMul", 1) * mutNum("enemyMul", 1);
  return { rank: ref.rank || 1, scale };
}

// この迷宮に出る強敵のid。各ランク帯 (10迷宮) を 1-3 / 4-6 / 7-10 の
// 3グループに区切り、グループごとに固有の強敵が決まっている (例: 迷宮1-3, 4-6, 7-10, 11-13, …)
function eliteKey() {
  const n = G.dungeonIdx + 1;
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
function updateTopbar() {
  const sb = document.getElementById("settings-btn");
  if (sb && !sb.querySelector("svg")) sb.innerHTML = TOPBAR_GEAR;
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
  if (mu) { const t = el("span", "fi-tag fi-mut", mu.sym); t.title = `異変「${mu.name}」`; row.appendChild(t); }
  floorInfo.appendChild(row);
  setTopbarCurrency();
  updateDescendBtn();
  updateReturnBtn();
}

function newFloor() {
  // 奈落: 強敵・ミミック参照 (eliteKey/mimicRef は G.dungeonIdx を見る) を素体迷宮に同期
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
  G.px = G.board.start.x;
  G.py = G.board.start.y;
  G.portalFound = false; // この階の帰還魔法陣はまだ発見していない
  updateTopbar();
  log(`地下 ${G.floor} 階。カードをめくって階段を探せ！`, "sys");
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
  if (combat) used += MENU_RESERVE + LOG_MIN_COMBAT;
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

// ダンジョンで歩くキャラのスプライト。生存している先頭メンバーの職業姿を表示
// (先頭が倒れていれば、生きているメンバーのうち最も上の者)。全滅時は先頭。
function walkerSprite() {
  const party = G.party || [];
  const lead = party.find((p) => p.alive) || party[0];
  if (!lead) return HERO;
  return lead.isDoll ? dollSprite(lead) : HERO;
}

// 画面下の操作ヒント: 場面 (探索/戦闘) に合わせて差し替える
const hintEl = document.getElementById("hint");
function setHint(t) { if (hintEl && hintEl.textContent !== t) hintEl.textContent = t; }

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
  if (G.portalFound) { const p = el("span", "rb-portal", "帰還陣"); p.title = "この階の帰還魔法陣を見つけた (左上のボタンで街へ戻れる)"; goal.appendChild(p); }
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
  runbarEl.appendChild(loot);
}

function renderBoard() {
  _boardActiveAt = performance.now();
  setHint("スワイプで移動 ・ タップで行き先を指定 ・ 青く光る墓石をめくる");
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
    else if (c.type === "chest" && !c.cleared) out.push({ x: cx, y: cy, r: 22, a: 0.3, col: "255,210,120", ga: 0.06 + 0.04 * pulse, gr: 18 });
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
        if (senseE >= 3) { const e2 = (MONSTERS[cell.monsterKey] || {}).element; const ec = (ELEMENTS[e2] || {}).color; if (ec) color = ec; }
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
function cellIcon(cell) {
  return cell.type === "monster" && !cell.cleared ? MONSTERS[cell.monsterKey] :
    cell.type === "chest" ? (cell.cleared ? ICONS.chestOpen : ICONS.chest) :
    cell.type === "trap" && !cell.cleared ? ICONS.trap :
    cell.type === "fountain" && !cell.cleared ? ICONS.fountain :
    cell.type === "corpse" ? ICONS.corpse :
    cell.type === "portal" ? ICONS.portal :
    cell.type === "stairs" ? ICONS.stairs : null;
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
    vctx.fillStyle = "#2a2418"; vctx.fillRect(nx - 2, sk - 1, 1.4, 1.6); vctx.fillRect(nx + 0.6, sk - 1, 1.4, 1.6); // 眼窩
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
  vctx.fillStyle = "#c9c0d8"; // 左頁
  vctx.beginPath();
  vctx.moveTo(cx - 0.5, by); vctx.lineTo(cx - 9, by + 1.5); vctx.lineTo(cx - 8, by + 6); vctx.lineTo(cx - 0.5, by + 4.5); vctx.closePath(); vctx.fill();
  vctx.fillStyle = "#bcb2cc"; // 右頁
  vctx.beginPath();
  vctx.moveTo(cx + 0.5, by); vctx.lineTo(cx + 9, by + 1.5); vctx.lineTo(cx + 8, by + 6); vctx.lineTo(cx + 0.5, by + 4.5); vctx.closePath(); vctx.fill();
  // 頁の文字行
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

// 層9「毒沼」のカード裏面: 沸き立つ毒の澱み、ねじれた枯れ木、漂う瘴気と垂れる毒の雫、毒の鬼火
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
  // 暗い澱み
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
  // 坑奥に滲む土気の残光
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

  // 蒼い月 (右上にぼうっと滲む)
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
    // 上辺の血滲み
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
  G.prevPos = { x: G.px, y: G.py };
  G.anim = { busy: true };

  // キャラが現在地から次マスへスライド → 中身を解決
  const slide = () => {
    G.heroAnim = { fromX: G.px, fromY: G.py, toX: nx, toY: ny, t0: performance.now(), dur: 150 };
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
    G.flipAnim = { x: nx, y: ny, t0: performance.now(), dur: 240 };
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
function autoWalk(path) {
  if (!path.length) return;
  G.walking = true;
  const next = () => {
    if (G.state !== "board" || G.prompt || !path.length) { G.walking = false; renderBoard(); return; }
    const { x, y } = path.shift();
    // 念のため隣接・開通を確認
    if (Math.abs(x - G.px) + Math.abs(y - G.py) !== 1 || !edgeOpen(x, y)) {
      G.walking = false; renderBoard(); return;
    }
    moveStep(x, y, () => {
      if (G.state !== "board" || G.prompt) { G.walking = false; return; } // 戦闘/選択で中断
      if (path.length) setTimeout(next, 110);
      else { G.walking = false; renderBoard(); }
    });
  };
  next();
}

function resolveCell(cell) {
  switch (cell.type) {
    case "monster":
      if (!cell.cleared) {
        const name = MONSTERS[cell.monsterKey].name;
        if (cell.elite) {
          // 強敵は群れない: 規格外の1体が立ちはだかる
          log(`☠ 強敵 ${name} が立ちはだかる！`, "dmg");
          startBattle(spawnEliteEnemies(cell.monsterKey, enemyScale()), cell);
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
        showEvent({
          sprite: ICONS.trap, title: "罠を解除！", accent: "#9be88a", banner: "✦ 罠解除 ✦", sparkle: true,
          lines: [`床に「${trap.name}」が仕掛けられていた。`, `${best.name}が見抜き、解除した！`],
          onClose: () => renderBoard(),
        });
        break;
      }
      springTrap(trap, best, { proceed: () => renderBoard() });
      break;
    }
    case "poison": {
      // 毒の床: 踏むたびに隊全体を蝕む。毒床耐性 (盗賊系) で半減/無効
      const resist = partyPassiveLv("poisonFloor");
      if (resist >= 2) {
        if (resist >= 3) { // Lv3: 無効化に加え、渡るたび隊全体をHP2%回復
          let healed = false;
          for (const p of G.party) { if (!p.alive) continue; const h = Math.max(1, Math.ceil(p.maxhp * 0.02)); if (p.hp < p.maxhp) { p.hp = Math.min(p.maxhp, p.hp + h); healed = true; } }
          log(healed ? "毒の床を浄化して渡った。澱みが力に変わり、隊の傷が癒えた。" : "毒の床を浄化して渡った。", "sys");
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
      const fallen = [];
      for (const p of G.party) {
        if (!p.alive) continue;
        let dmg = Math.max(1, Math.ceil(p.maxhp * pct));
        if (resist === 1) dmg = Math.max(1, Math.ceil(dmg * 0.5));
        p.hp = Math.max(0, p.hp - dmg);
        if (p.hp === 0) { p.alive = false; anyDeath = true; fallen.push(p.name); log(`${p.name}は毒に沈んだ…`, "dmg"); }
      }
      log(`毒の床だ！ 隊全体が蝕まれた${resist === 1 ? " (耐性で半減)" : ""}`, "dmg");
      renderParty();
      showEvent({
        sprite: ICONS.poison, title: "毒の床！", accent: "#5a8a2a", banner: "⚠ 危険 ⚠",
        lines: [`隊全体が蝕まれた${resist === 1 ? " (耐性で半減)" : ""}…`, ...fallen.map((n) => `${n}は毒に沈んだ…`)],
        onClose: () => {
          if (anyDeath) { SFX.die(); imprintFallen(); if (!G.party.some((p) => p.alive)) { gameOver(); return; } }
          renderBoard();
        },
      });
      break;
    }
    case "portal":
      // 帰還魔法陣: 何度でも使える。踏むたびに帰還するか選ぶ。
      // 発見後は設定アイコン右の帰還ボタンで、どこからでも街へ戻れる。
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
          { label: "💀 飲む (大いなる恵み / 呪いの危険)", danger: true, fn: () => useDarkFountain(cell) },
          { label: "✋ 近寄らない", fn: () => { log("黒い泉には触れなかった。", "sys"); renderBoard(); } },
        ], ICONS.fountain, { banner: "⚠ 黒い泉 ⚠", accent: "#8a2be2" });
        break;
      }
      // 利用するか選べる。今使わなくても泉は残り、後から再訪して使える。
      showChoice("癒しの泉が湧いている。利用する？", [
        { label: "💧 泉を利用する", fn: () => useFountain(cell) },
        { label: "✋ 今はやめておく", fn: () => { log("泉はそのままにした。後で使える。", "sys"); renderBoard(); } },
      ], ICONS.fountain, { banner: "✦ 癒しの泉 ✦", accent: "#5fb8d6" });
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
  }
}

// 泉を利用: HP/MP回復・毒浄化。利用したら消える。
function useFountain(cell) {
  cell.cleared = true;
  SFX.heal();
  let cured = false;
  for (const p of G.party) {
    if (!p.alive) continue;
    p.hp = Math.min(p.maxhp, p.hp + Math.ceil(p.maxhp * 0.4));
    p.mp = Math.min(p.maxmp, p.mp + Math.ceil(p.maxmp * 0.5));
    if (p.ailment) cured = true;
    p.ailment = null;
  }
  log("癒しの泉だ！ HPとMPが回復し、毒も癒えた。", "heal");
  showEvent({
    sprite: ICONS.fountain, title: "癒しの泉", accent: "#5fb8d6", banner: "✦ 恵み ✦", sparkle: true,
    lines: ["パーティのHPとMPが回復した！", ...(cured ? ["毒も浄化された。"] : [])],
    onClose: () => renderBoard(),
  });
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
    showEvent({
      sprite: ICONS.fountain, title: "深淵の恵み", accent: "#5fb8d6", banner: "✦ 大いなる恵み ✦", sparkle: true,
      lines: ["全員のHPとMPが完全に回復した！", `淀みから ✦${bonus} Soul をすくい上げた。`],
      onClose: () => renderBoard(),
    });
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
  showEvent({
    sprite: ICONS.fountain, title: "深淵の呪い", accent: "#a01030", banner: "⚠ 呪詛 ⚠",
    lines: ["全員のHPが半減した…", ...(cursed ? ["毒に侵された者もいる。"] : [])],
    onClose: () => renderBoard(),
  });
}

// 死体: 「まだあたたかい死体」からのみ魂を回収できる (死体の職業に応じた魂)
function resolveCorpse(cell) {
  const clsKey = cell.corpseClass || "fighter";
  const clsLabel = SOUL_CLASSES[clsKey].label;
  // 偉大なる死体 (特別階「強大な気配」): 希少な職業の魂が必ず宿っている
  if (cell.corpseGreat) {
    showChoice(`偉大なる死体。尋常ならざる魂の気配がする。`, [
      { label: "✦ 魂を回収する", fn: () => collectWarmCorpse(cell, clsKey, clsLabel) },
      { label: "🚶 立ち去る", fn: () => { log("偉大なる死体に手を触れず、立ち去った。", "sys"); renderBoard(); } },
    ], ICONS.corpseWarm, { banner: "★ 偉大なる死体 ★", accent: "#ffcf4a" });
    return;
  }
  if (!cell.corpseWarm) {
    // 風化した死体: 調べるか立ち去るかを選ぶ (宝箱と同じポップアップ)
    showChoice(`風化した死体が横たわっている。調べてみるか？`, [
      { label: "🔍 調べる", fn: () => investigateCorpse(cell, clsKey, clsLabel) },
      { label: "🚶 立ち去る", fn: () => { log("死体には触れず、立ち去った。", "sys"); renderBoard(); } },
    ], ICONS.corpse, { banner: "— 風化した死体 —", accent: "#8c866f" });
    return;
  }
  // あたたかい死体: 回収するか立ち去るか選べる。立ち去れば死体は残る。
  showChoice(`まだあたたかい死体。魂が宿っている。`, [
    { label: "✦ 魂を回収する", fn: () => collectWarmCorpse(cell, clsKey, clsLabel) },
    { label: "🚶 立ち去る", fn: () => { log("死体に手を触れず、立ち去った。", "sys"); renderBoard(); } },
  ], ICONS.corpseWarm, { banner: "✦ あたたかい死体 ✦", accent: SOUL_CLASSES[clsKey].glow });
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
      accent: great ? "#ffcf4a" : "#d4504e",
      btnLabel: "応戦する",
      onClose: () => startBattle(spawnCardEnemies(undeadKeyForDungeon(), G.floor, enemyScale(), { min: mutNum("packMin", 0) }), cell),
    });
    return;
  }
  collectSoul(cell, clsKey, clsLabel);
}

// 死体戦に勝利した後、死体に残っていた魂を100%回収する (endBattle から呼ばれる)
function recoverCorpseSoul(corpse, after) {
  const clsKey = corpse.clsKey || "fighter";
  acquireSoul(clsKey, corpse.great
    ? `偉大なる魂を回収した。`
    : `死体に残っていた魂を回収した。`, after || (() => renderBoard()), emberReward(corpse.great));
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
function investigateCorpse(cell, clsKey, clsLabel) {
  cell.cleared = true;
  const dn = activeCfg();

  // 懐に残された金品 (Gold) を渡す処理 (装備を渡せない時のフォールバックにも使う)
  const giveGold = () => {
    const g = runGainGold(Math.round((18 + G.floor * 9) * (0.7 + Math.random() * 0.6)));
    SFX.itemget(); buzz([0, 30, 60, 30]);
    log(`風化した死体の懐から ${g} ゴールドを見つけた。`, "win");
    updateTopbar();
    showEvent({
      sprite: ICONS.gold, banner: "💰 金品を発見 💰", title: `${g} ゴールド`,
      accent: "#ffd84a", sparkle: true,
      lines: [`風化した死体の懐に遺されていた金品だ。`],
      onClose: () => renderBoard(),
    });
  };

  const roll = Math.random();

  // 20%: 職能の記憶を宿した「魂」
  if (roll < 0.20) {
    acquireSoul(clsKey, `風化した死体の残りかすに、まだ職能の記憶が宿っていた。`);
    return;
  }

  // 30%: 亡骸に残る ✦ Soul (ソウルポイント) を集める
  if (roll < 0.50) {
    const got = runGainSoulPts(Math.round((20 + G.floor * 8 + (dn.rank || 1) * 6) * (0.7 + Math.random() * 0.6)));
    SFX.itemget(); buzz([0, 30, 60, 30]);
    log(`風化した死体から ✦${got} Soul を集めた。`, "win");
    updateTopbar();
    showEvent({
      sprite: ICONS.wisp, banner: "✦ Soul を回収 ✦", title: `✦ ${got} Soul`,
      accent: "#7fd0ff", sparkle: true,
      lines: [`風化した亡骸に残っていた魂の残響を集めた。`],
      onClose: () => renderBoard(),
    });
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
    codexSeeItem(id);
    log(`風化した死体の傍らに ${itemName(it)} が遺されていた。`, "win");
    showItemGet(it, who, () => renderBoard());
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

// 魂の入手処理: 拾った魂は1体の魂インスタンスとして自動で「所持魂 一覧」に追加される。
// (魂袋は廃止。同職でも個別に Lv/ランクを持つ魂として貯まる)
function acquireSoul(clsKey, sourceLine, onClose, emberCount = 0) {
  const cls = SOUL_CLASSES[clsKey] || SOUL_CLASSES.fighter;
  const rare = cls.rarity !== "common";
  G.stats.soulsFound++;
  questProgress("soul", null, 1);
  SFX.itemget(); buzz(rare ? [0, 40, 50, 40, 50, 150] : [0, 30, 60, 30]);
  if (cls.rarity === "legend") { flashScreen("#ffcf4a"); SFX.victory(); }
  const after = onClose || (() => { if (G.state === "board") renderBoard(); });
  // 死体からは魂とは別に「魂の残火」が確定で手に入る。魂のポップアップの後に続けて知らせる
  const done = emberCount > 0 ? () => grantEmbers(emberCount, after) : after;
  addSoulInstance(clsKey);
  runTrackSoul(clsKey, "bag");
  codexJobSee(clsKey, 1, 1);
  log(`${cls.label}の魂 を持ち帰った。(所持魂 一覧に追加)`, "win");
  // 宝箱と同じイラスト付きポップアップで入手を知らせる
  showEvent({
    sprite: jobSprite(clsKey, 1),
    banner: rare ? `★ ${RARITY_LABEL[cls.rarity]}の魂を入手！ ★` : "✦ 魂を入手！ ✦",
    title: `${cls.label}の魂`,
    lines: sourceLine ? [sourceLine, "所持魂 一覧に追加した。"] : ["所持魂 一覧に追加した。"],
    accent: cls.glow || "#c9a227",
    sparkle: rare,
    btnLabel: "受け取る",
    onClose: done,
  });
}

// 魂の残火を手に入れる: 死体回収時に魂のポップアップに続けて表示する。
// 魂の残火は祭壇でメイン魂のLv上限を1上げるのに使う消費アイテム。
function grantEmbers(n, onClose) {
  n = Math.max(1, n | 0);
  G.embers = (G.embers || 0) + n;
  updateTopbar();
  SFX.itemget(); buzz([0, 30, 50, 30]);
  showEvent({
    sprite: ICONS.ember,
    banner: "🔥 魂の残火 🔥",
    title: n > 1 ? `魂の残火を ${n}つ 手に入れた` : "魂の残火を1つ手に入れた",
    lines: ["祭壇でメイン魂のLv上限を 1 上げるのに使える。"],
    accent: "#ff9a3a",
    sparkle: n > 1,
    btnLabel: "受け取る",
    onClose: onClose || (() => { if (G.state === "board") renderBoard(); }),
  });
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
  // 奈落: 最深部の概念がなく、ひたすら深く潜る。10階ごとに門番が立ちはだかる。
  if (abyssActive()) {
    if (abyssBossPending()) {
      showChoice(
        `深部から圧倒的な気配が漏れている。奈落の門番 (B${G.floor}F) に挑む？`,
        [
          { label: "⚔ 門番に挑む", danger: true, fn: () => fightAbyssGuard(cell) },
          { label: "✋ まだ準備する", fn: () => { renderBoard(); } },
        ],
        ICONS.stairs,
        { banner: "⚠ 奈落の門番 ⚠", accent: "#d4504e" }
      );
      return;
    }
    showChoice(
      `さらに深い闇へ続く階段だ。B${G.floor + 1}F へ降りる？`,
      [
        { label: "▼ さらに潜る", fn: () => descend() },
        { label: "✋ まだ探索する", fn: () => { renderBoard(); } },
      ],
      ICONS.stairs,
      { banner: "✦ 奈落 ✦", accent: "#b08ac0" }
    );
    return;
  }
  const dn = curDungeon();
  const atBottom = G.floor >= dn.floors;
  const boss = atBottom && !!dn.boss;        // 層末迷宮のみ最深部にボスがいる
  const clearNoBoss = atBottom && !dn.boss;  // 層途中の迷宮は最深部到達で踏破
  let label, banner, accent, prompt;
  if (boss) { label = "⚔ 主に挑む"; banner = "⚠ 迷宮の主 ⚠"; accent = "#d4504e"; prompt = `この奥に「${dn.name}」の主が待つ。挑む？`; }
  else if (clearNoBoss) { label = "★ 踏破する"; banner = "✦ 最深部 ✦"; accent = "#ffd84a"; prompt = `「${dn.name}」の最深部に至った。踏破して街へ凱旋する？`; }
  else { label = "▼ 降りる"; banner = "✦ 発見 ✦"; prompt = `下り階段を見つけた。地下 ${G.floor + 1} 階へ降りる？`; }
  showChoice(
    prompt,
    [
      { label, danger: boss, fn: () => {
        if (boss) { log("迷宮の主が立ちはだかる！", "dmg"); startBattle(spawnBossEnemies(dn.boss, dn.bossScale * enemyScale(), dn.bossRank), cell); }
        else if (clearNoBoss) clearDungeonNoBoss();
        else descend();
      } },
      { label: "✋ まだ探索する", fn: () => { renderBoard(); } },
    ],
    ICONS.stairs,
    { banner, accent }
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

// 宝箱: 開ける人業を1人選ぶ。70%で罠が仕掛けられており、選んだ者の解除値で判定する。
// 宝箱にはランク (1-5) があり、高ランクほど中身が豪華だが解除難度が上がる
function askOpenChest(cell) {
  const cRank = chestRankOf(cell);
  const opts = G.party.filter((p) => p.alive).map((p) => ({
    label: `🔓 ${p.name} (解除 ${Math.round(disarmChance(p, cRank) * 100)}%)`,
    fn: () => openChest(cell, p),
  }));
  opts.push({ label: "✋ 開けない", fn: () => { renderBoard(); } });
  showChoice(`${CHEST_RANKS[cRank]}宝箱が現れた！ 罠があるかもしれない。誰が開ける？`, opts, ICONS.chest);
}

function openChest(cell, opener) {
  if (cell) cell.cleared = true;
  G.stats.chests++; // 戦績: 開けた宝箱の数 (勲章用)
  questProgress("chest", null, 1); // 盤面の宝箱を開けた (サブクエスト用)
  rollChest(cell, true, () => { if (G.state === "board") renderBoard(); }, opener);
}

// 宝箱の中身を解決。allowDanger=falseなら罠/ミミックなし (戦闘後の宝箱。罠フェーズは battleChest 側)。
// opener: 開けると選ばれた人業 (罠解除判定に使う)。done は安全終了時のコールバック。
// cRankIn: 宝箱ランクの引き継ぎ (戦闘後の宝箱はセルがないため明示的に渡す)
function rollChest(cell, allowDanger, done, opener, cRankIn, lvBonus, noGold = false) {
  const cRank = cRankIn || (allowDanger ? chestRankOf(cell) : 1);
  if (allowDanger) {
    // 伝説の宝箱 (cell.lootBonus) はミミック/黒い宝箱に化けない
    const legendary = !!(cell && cell.lootBonus);
    // ミミック率: 一律3% (特別階「ミミックの巣」/異変「ミミックの行進」では高い方を採用)
    if (!legendary && Math.random() < Math.max(sfNum("mimicRate", 0.03), mutNum("mimicRate", 0))) {
      // ミミック出現時、10%でマスターミミック。強さは先のダンジョンを参照
      //  (通常=1つ先 / マスター=2つ先)。固有ドロップは無く、上質な宝箱を残す。
      const master = Math.random() < 0.10;
      const ref = mimicRef(master ? 2 : 1);
      SFX.trap(); buzz([0, 60, 40, 60]);
      log(master ? "宝箱はマスターミミックだった！" : "宝箱はミミックだった！", "dmg");
      showEvent({
        sprite: master ? MONSTERS.master_mimic : MONSTERS.mimic,
        title: master ? "マスターミミックだ！" : "ミミックだ！",
        accent: master ? "#ffd34d" : "#d4504e", banner: master ? "⚠ 危険 ⚠⚠" : "⚠ 危険 ⚠",
        lines: master ? ["金色に輝く宝箱が牙を剥いた！", "強敵だ。倒せば極上の宝が手に入る。"] : ["宝箱は怪物だった！", "戦闘になる！"],
        btnLabel: "戦う",
        onClose: () => startBattle(spawnMimic(ref.rank, ref.scale, master), cell),
      });
      return;
    }
    // 黒い宝箱: 一段上のレベル帯の品が眠るが、開けると呪いの危険を伴う (任意の賭け)
    if (!legendary && Math.random() < 0.10) {
      askCursedChest(done);
      return;
    }
    // 罠フェーズ: 70%で罠。解除/発動/罠なしの演出を経て中身へ
    chestTrapPhase(opener, () => chestContents(cell, done, cRank, lvBonus, noGold), cRank, done);
    return;
  }
  chestContents(cell, done, cRank, lvBonus, noGold);
}

// 罠フェーズ (盤面・戦闘後の宝箱共通): cfg.trapRate (デフォルト0.70) の確率で罠が仕掛けられている。
// activeCfg().trapRate を参照することで「静寂の刻」等の日替わり修飾が宝箱にも適用される。
// 迷宮ランクに応じた罠を抽選し、開けた者が解除を試みる (難度はダンジョンランク×宝箱ランク)。
// 成功または罠なしならその旨を告げてから contents() へ進む。
// abort: テレポーター/警報で中身を失った時の終了処理 (省略時は盤面へ)。
// excludeKinds: 出現させない罠の型 (踏破演出など、戦闘で続きが途切れる場面で使う)
function chestTrapPhase(opener, contents, cRank = 1, abort, excludeKinds) {
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
      showEvent({
        sprite: ICONS.trap, title: "罠解除！", accent: "#9be88a", banner: "✦ 罠解除 ✦", sparkle: true,
        lines: [`宝箱には「${trap.name}」が仕掛けられていた。`, `${who.name}が見抜き、解除した！`],
        onClose: contents,
      });
      return;
    }
    // 解除失敗: 罠が発動。生き残れば中身は手に入る (テレポーター/警報は中身を失う)
    if (who) log(`${who.name}は罠「${trap.name}」の解除に失敗した！`, "dmg");
    springTrap(trap, who, { chest: true, proceed: contents, abort });
    return;
  }
  SFX.chest();
  log("宝箱に罠はなかった。", "sys");
  showEvent({
    sprite: ICONS.chest, title: "罠はない", accent: "#9be88a", banner: "✦ 安全 ✦",
    lines: ["宝箱に罠は仕掛けられていなかった。"],
    onClose: contents,
  });
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

// 罠を発動させる。opener: 開けた者/先頭の解除役 (opener型の罠が狙う)。
// fin.proceed: 生存時の続き (宝箱なら中身の取得、床罠なら盤面へ戻る)。
// fin.abort: テレポーター/警報で中身を失った時の終了処理 (省略時は盤面へ)。
// fin.chest: 宝箱の罠かどうか (演出の文言に使う)
function springTrap(trap, opener, fin) {
  SFX.trap(); buzz([0, 60, 40, 60]);
  G.stats.trapsSprung++; // 戦績: 発動させてしまった罠 (勲章用)
  log(`罠だ！ 「${trap.name}」が発動した！`, "dmg");
  const alive = () => G.party.filter((p) => p.alive);

  // テレポーター: 同じ階の別の場所へ飛ばされる。宝箱の中身は失われる
  if (trap.kind === "teleport") {
    showEvent({
      sprite: ICONS.trap, title: `${trap.name}！`, accent: "#8a2be2", banner: "⚠ 危険 ⚠",
      lines: [trap.flavor, "隊は見知らぬ場所へ飛ばされた！", ...(fin.chest ? ["宝箱は闇の彼方に消えた…"] : [])],
      onClose: () => {
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
        if (fin.abort) fin.abort(); else renderBoard();
      },
    });
    return;
  }

  // 警報: 怪物を呼び寄せ戦闘になる。宝箱の中身を検める暇はない
  if (trap.kind === "alarm") {
    const cfg = activeCfg();
    const deep = G.floor > (cfg.floors || 3) / 2;
    const pool = ((trap.horde || deep) ? cfg.deepPool : cfg.pool) || cfg.pool || ["cm_slime"];
    const key = pool[rand(pool.length)];
    showEvent({
      sprite: ICONS.trap, title: `${trap.name}！`, accent: "#d4504e", banner: "⚠ 危険 ⚠",
      lines: [trap.flavor, trap.horde ? "怪物の群れが雪崩れ込んでくる！" : "怪物が呼び寄せられた！", ...(fin.chest ? ["宝箱を検める暇はない！"] : [])],
      btnLabel: "戦う",
      onClose: () => startBattle(spawnCardEnemies(key, G.floor, enemyScale() * (trap.horde ? 1.25 : 1), trap.horde ? { min: 4 } : null), null),
    });
    return;
  }

  // 残りはダメージ/吸収系: 効果を適用して結果をまとめて表示する。
  // 控えの結社 罠師の目 (trapEye)=罠ダメ軽減 / 加護の祈り (wardField)=状態異常付与率を抑える
  const teLv = partyPassiveLv("trapEye");
  const trapDmgMul = teLv >= 3 ? 0.5 : teLv >= 2 ? 0.65 : teLv >= 1 ? 0.8 : 1;
  const wfLv = partyPassiveLv("wardField");
  const ailMul = wfLv >= 3 ? 0.3 : wfLv >= 2 ? 0.5 : wfLv >= 1 ? 0.7 : 1;
  const lines = [trap.flavor];
  const fallen = [];
  const hurt = (p, mult) => {
    const dmg = Math.max(1, Math.round(trapBaseDmg() * mult * trapDmgMul));
    p.hp = Math.max(0, p.hp - dmg);
    lines.push(`${p.name}に ${dmg} ダメージ！`);
    if (p.hp === 0) {
      p.alive = false; fallen.push(p);
      lines.push(`${p.name}は倒れた…`);
      log(`${p.name}は倒れた…`, "dmg");
    }
    return p.alive;
  };
  const afflict = (p, ail, chance) => {
    if (!ail || !p.alive || p.ailment || Math.random() >= chance * ailMul) return;
    p.ailment = ail;
    lines.push(`${p.name}は${AIL_NAME[ail]}に侵された！`);
  };
  switch (trap.kind) {
    case "opener":
    case "one": {
      const pool = alive();
      if (!pool.length) break;
      const t = (trap.kind === "opener" && opener && opener.alive) ? opener : pool[rand(pool.length)];
      if (trap.dieChance && Math.random() < trap.dieChance) {
        t.hp = 0; t.alive = false; fallen.push(t);
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
      break;
    }
    case "gold": {
      const loss = Math.min(G.gold, Math.round(G.gold * 0.15) + 10);
      G.gold = Math.max(0, G.gold - loss);
      updateTopbar();
      lines.push(`${loss} ゴールドが溶かされた…`);
      log(`${loss} ゴールドを失った…`, "dmg");
      break;
    }
    case "soul": {
      const loss = Math.min(G.soulPts, Math.round(G.soulPts * 0.10) + 5);
      G.soulPts = Math.max(0, G.soulPts - loss);
      updateTopbar();
      lines.push(`✦${loss} Soul を吸い取られた…`);
      log(`✦${loss} Soul を失った…`, "dmg");
      break;
    }
  }
  const wiped = !G.party.some((p) => p.alive);
  const failBanner = fin.chest ? "✗ 罠解除失敗 ✗" : "⚠ 危険 ⚠";
  const failTitle  = fin.chest ? `解除失敗！「${trap.name}」発動` : `${trap.name}！`;
  showEvent({
    sprite: ICONS.trap, title: failTitle, lines, accent: "#d4504e", banner: failBanner,
    onClose: () => {
      if (wiped) { gameOver(); return; }
      if (fallen.length) SFX.die();
      imprintFallen();
      fin.proceed(); // 痛手は負ったが、先へ進める (宝箱なら中身は手に入る)
    },
  });
}

// 宝箱の中身 (ゴールド/装備品/蒐集品)。cRank: 宝箱ランク (1-5、高いほど豪華)
// lvBonus: ミミック撃破後の宝箱などのアイテムレベル底上げ。
// cell.lootBonus: 特別階 (伝説の眠る階) の「伝説の宝箱」— 中身は必ず装備品で +40レベル
function chestContents(cell, done, cRank = 1, lvBonus = 0, noGold = false) {
  const lootUp = (lvBonus || 0) + ((cell && cell.lootBonus) || 0);
  const legendary = !!(cell && cell.lootBonus);
  const rankMul = 1 + ((cRank || 1) - 1) * 0.3;
  // 中身の抽選 (ダンジョンレベルに応じる): ゴールド50% / ゴールド以外のアイテム50%
  // 伝説の宝箱・ミミック宝箱はゴールドにならず、必ず装備品が出る
  if (!legendary && !noGold && Math.random() < 0.5) {
    SFX.chest();
    const dRank = activeCfg().rank || 1;
    const g = runGainGold(Math.round((10 + G.floor * 12 + rand(30)) * (1 + (dRank - 1) * 0.5) * rankMul * 2));
    updateTopbar();
    log(`宝箱から ${g} ゴールドを手に入れた！`, "win");
    showEvent({
      sprite: ICONS.gold, title: "ゴールド発見！", accent: "#e8c24a", banner: "✦ 宝箱の中身 ✦", sparkle: true,
      lines: [`${g} ゴールドを手に入れた！`], onClose: done || (() => renderBoard()),
    });
    return;
  }
  // 宝: 装備/アイテム (迷宮のアイテムレベル帯から抽選。高ランクの宝箱は一段上の帯)
  const got = giveItem(pickLoot({ chestRank: cRank, lvBonus: lootUp }));
  if (got) {
    if (legendary) { flashScreen("#ffcf4a"); SFX.victory(); log(`✦ 伝説の宝箱から ${got.item.name} を見つけた！`, "win"); }
    showItemGet(got.item, got.who, done); return; // 演出後に done
  }
  SFX.chest();
  if (done) done();
}

// 黒い宝箱: 開ければ一段上のレベル帯の装備が出るが、50%で呪いがふきだす。
// 「開けない」が常に選べる、純粋なリスクとリターンの賭け
function askCursedChest(done) {
  const openIt = () => {
    const giveLoot = () => {
      const got = giveItem(pickLoot({ rare: true }));
      if (got) { showItemGet(got.item, got.who, done); return; }
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
      showEvent({
        sprite: ICONS.trap, title: "呪い！", accent: "#a01030", banner: "⚠ 呪詛 ⚠",
        lines: ["全員が生気を吸われた…", ...(cursed ? ["毒や麻痺に侵された者もいる。"] : []), "だが、中身は本物だ。"],
        onClose: giveLoot,
      });
      return;
    }
    giveLoot();
  };
  showChoice("黒い宝箱だ。禍々しい気配を放っている…", [
    { label: "🖤 開ける (上質な品 / 呪いの危険)", danger: true, fn: openIt },
    { label: "✋ 立ち去る", fn: done },
  ], ICONS.chest, { banner: "⚠ 黒い宝箱 ⚠", accent: "#8a2be2" });
}

// 戦闘勝利後の宝箱 (出現判定は endBattle 側)。ミミックはいないが罠は70%で仕掛けられており、
// 開ける者を選んでその者の解除値で判定する (盤面の宝箱と同じ罠フェーズを通る)。
// 敵がアイテムを落としていれば中身はそれ。なければダンジョンレベル準拠の抽選。
// after: 終了後に呼ぶ (ボス撃破時は踏破演出へつなぐ)。lvBonus: ミミック撃破宝箱などの中身底上げ
function battleChest(drops, after, lvBonus = 0, noGold = false) {
  const done = () => { if (after) after(); else if (G.state === "board") renderBoard(); };
  const cRank = chestRankOf(null);
  const contents = () => {
    if (drops && drops.length) giveDropsFromChest(drops, 0, done);
    else rollChest(null, false, done, null, cRank, lvBonus, noGold);
  };
  // 踏破演出など続きの処理 (after) がある時は、戦闘へ突入する警報系の罠を出さない
  // (戦闘を挟むと after が呼ばれなくなるため)
  const exclude = after ? ["alarm"] : null;
  const opts = G.party.filter((p) => p.alive).map((p) => ({
    label: `🔓 ${p.name} (解除 ${Math.round(disarmChance(p, cRank) * 100)}%)`,
    fn: () => chestTrapPhase(p, contents, cRank, done, exclude),
  }));
  opts.push({ label: "✋ 開けない", fn: done });
  showChoice(`${CHEST_RANKS[cRank]}宝箱が現れた！ 罠があるかもしれない。誰が開ける？`, opts, ICONS.chest, { banner: "⚔ 勝利 ⚔" });
}

// 宝箱から敵のドロップ品を順に取り出す。図鑑への開示も実際に手にした時に行う
function giveDropsFromChest(drops, i, done) {
  if (i >= drops.length) { done(); return; }
  const d = drops[i];
  const next = () => giveDropsFromChest(drops, i + 1, done);
  const who = G.party.find((p) => p.alive && p.items.length < MAX_ITEMS)
    || G.party.find((p) => p.items.length < MAX_ITEMS);
  if (!who) { log(`${itemName(d.item)}を見つけたが、誰も持てない…`, "sys"); refundLR(d.item); next(); return; }
  const ce = codexMonEntry(d.key);
  if (d.rare) ce.rare = true; else ce.normal = true;
  codexSeeItem(d.id);
  markDungeonLoot(d.item);
  runGainItem(who, d.item);
  SFX.chest();
  log(`宝箱から ${d.name}の落とした ${itemName(d.item)} を手に入れた！`, logClassForItem(d.item, d.rare ? "win" : "sys"));
  showItemGet(d.item, who, next);
}


function descend() {
  SFX.stairs();
  buzz([0, 20, 80, 20]);
  G.floor++;
  G.maxFloorReached = Math.max(G.maxFloorReached, G.floor);
  questProgress("floor", G.floor);
  // 奈落: 深度を進め、節目で変異を積む (呪縛の誓は進行が速い)
  if (G.abyss) {
    G.abyss.depth = G.floor;
    const every = G.abyss.mods.includes("cursed") ? 2 : ABYSS_MUT_EVERY;
    if (G.floor % every === 0) G.abyss._pendingMut = addAbyssMutation();
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
    if (healed) log("結社の戦間回復: 階を降りる道すがら、隊の傷が癒えていく。", "win");
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
  const sp = specialDef();
  if (G.eliteFloor) {
    log("…強敵の気配がする。", "dmg");
  } else if (sp) {
    log(`…この階は何かが違う。「${sp.name}」だ。`, "win");
  } else {
    log("階段を降りていく…", "sys");
  }
  // 暗転 → 階数タイトル → 明転 の演出
  G.prompt = true;
  const ov = el("div", G.eliteFloor ? "floor-trans floor-trans-elite" : "floor-trans");
  ov.appendChild(el("div", "ft-floor", `B${G.floor}F`));
  const sub = el("div", "ft-sub", G.eliteFloor ? "— 禍々しき気配 —" : sp ? `— ${sp.name} —` : "— さらに深く潜る —");
  if (sp) sub.style.color = sp.accent;
  ov.appendChild(sub);
  document.body.appendChild(ov);
  setTimeout(() => {
    newFloor();
    renderBoard();
    autosave(true); // 新フロアを保存
  }, 600); // 完全に暗転したタイミングで盤面を切替
  setTimeout(() => {
    ov.classList.add("out");
    setTimeout(() => {
      ov.remove();
      // フロア突入演出の後始末: 奈落で変異が積まれていれば最後に告知する
      const finishFloorIntro = () => {
        if (G.abyss && G.abyss._pendingMut) {
          const m = G.abyss._pendingMut; G.abyss._pendingMut = null;
          showAbyssMutationPopup(m);
        } else { G.prompt = false; }
      };
      if (G.eliteFloor) {
        // 強敵階警告ポップアップ (この迷宮グループ固有の強敵を見せる)
        showEvent({
          sprite: MONSTERS[eliteKey()],
          banner: "⚠ 警告 ⚠",
          title: "強敵の気配がする…",
          accent: "#d4504e",
          lines: [
            "この階には通常では遭遇しない強大な存在が潜んでいる。",
            "撃破すれば希少な戦利品を得られるだろう。",
          ],
          btnLabel: "覚悟する",
          onClose: finishFloorIntro,
        });
      } else if (sp) {
        // 特別階の告知ポップアップ (効果の説明)
        showEvent({
          sprite: ICONS[sp.icon] || ICONS.stairs,
          banner: "✦ 特別な階 ✦",
          title: sp.name,
          accent: sp.accent,
          sparkle: true,
          lines: sp.lines,
          btnLabel: "進む",
          onClose: finishFloorIntro,
        });
      } else {
        finishFloorIntro();
      }
    }, 500);
  }, 1500);
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
function startBattle(enemies, cell) {
  // 迷宮の属性気配: 属性持ち迷宮では雑魚敵が迷宮属性を帯びやすい (主・強敵は固有属性のまま)
  const cfg = activeCfg();
  const spFloor = specialDef();
  const isElite = enemies.some((e) => e.mon && e.mon.elite);
  if (cfg.element) {
    const ch = (spFloor && spFloor.elemAll) || mutNum("elemAll", false) ? 1 : 0.5;
    for (const e of enemies) if (!e.boss && !(e.mon && e.mon.elite) && Math.random() < ch) e.element = cfg.element;
  }
  G.battleCell = cell;
  G.state = "combat";

  combatMenu.classList.remove("hidden");
  // 同種の群れは「ゴブリン ×4」とまとめて告げる (個体名は A/B/C… 付き)
  const sameKind = enemies.length > 1 && enemies.every((e) => e.key === enemies[0].key);
  log(`${sameKind ? `${enemies[0].mon.name} ×${enemies.length}` : enemies.map((e) => e.name).join("・")} が現れた！`, "dmg");
  // 先制・奇襲の判定 (ボス戦・強敵戦では発生しない)。
  // 周囲警戒 (vigilance) が奇襲を抑え、先制の心得 (initiative) が先制を伸ばす
  const isBoss = enemies.some((e) => e.boss);
  let opening = null;
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
  }
  if (opening === "preempt") { log("先手を取った！", "win"); showToast("⚡ 先制攻撃！"); }
  else if (opening === "ambush") { log("奇襲された！", "dmg"); showToast("⚠ 奇襲された！"); buzz([0, 60, 40, 60]); }
  // ランク帯ごとの戦闘テーマ (ボス・強敵は専用曲)。図鑑への記録は「倒した時」に行う (endBattle)
  playBgm(battleBgm(isBoss || isElite));
  G.battle = new Battle(G.party, enemies, log, { opening, noFlee: mutNum("noFlee", false), orderFleet: partyPassiveLv("fleetFoot") });
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
    if (e.mon && e.mon.art) {
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
      // 待機中の呼吸: 敵ごとに位相をずらしてゆっくり上下する (被弾・踏み込み中は止める)
      if (!hf && !lunging && !REDUCED_MOTION) {
        oy += Math.round(Math.sin(now * 0.0024 + (e.uid || i) * 1.7) * 1.6);
      }
      const feetY = baseY + hh;
      // 戦闘開始の演出: 闇の奥から1体ずつ這い出る。まず黒い影だけが浮かび、遅れて色 (正体) が滲み出す
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
      // 対象選択中: 頭上に降りる楔と四隅の鉤
      if (tappable && strongTarget) drawTargetBrackets(baseX, baseY, hh, size, now);
      // 名札 + 血の小瓶 (HP)
      drawEnemyPlate(e, baseX, plateY, tappable && strongTarget, k);
      const hpY = plateY + 17;
      drawEnemyHpVial(e, baseX, hpY, now, k);
      // バフ/デバフ表示 (味方カードの buffBadges に相当): 前衛はHPバーの下、後衛はプレートの上
      drawEnemyBadges(e, baseX, row.back ? plateY - 15 : hpY + 9);
    });
  }

  if (fx) drawEffects(fx, now);
  if (intro) drawBattleIntro(intro, now);
}

const _deadShown = new WeakSet(); // 撃破の演出を見せ終えた敵
// 魔物を size で描いた時の見かけの半分の高さ
function monsterHalfH(mon, size) {
  if (!mon || !mon.art) return size * 6;
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
// 対象選択中の印: 頭上の楔 (上下に揺れる) と、魔物を囲む四隅の鉤
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
function drawEnemyPlate(e, x, y, hot, k) {
  vctx.save();
  vctx.font = `800 ${Math.round(11 * Math.min(k, 1.1))}px ${CANVAS_SERIF}`;
  vctx.textAlign = "center"; vctx.textBaseline = "middle";
  const label = e.name;
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

// 戦闘開始の演出を流してから done (手番処理) へ。演出中は入力を受けない
function playBattleIntro(done) {
  const b = G.battle;
  const boss = b.enemies.find((e) => e.boss);
  // 戦場の寸法をここで決めて、戦闘の間は固定する (盤面より横長の戦場へ)
  renderRunbar();
  renderParty();
  fitView();
  if (REDUCED_MOTION) { done(); return; }
  const dur = (boss ? 1900 : 640 + b.enemies.length * 90) * (G.fastAnim ? 0.6 : 1);
  G.battleIntro = { battle: b, t0: performance.now(), dur, boss: boss ? (boss.mon && boss.mon.name) || boss.name : null };
  G.animating = true;
  combatMenu.innerHTML = "";
  setHint("敵をタップで攻撃 ・ スキルは長押しで詳細 ・ オートで自動戦闘");
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
  _monSil.set(mon, s);
  return s;
}
// drawSpriteFit と同じ見かけの大きさ (12グリッド換算の size) で魔物を描く
function drawMonster(ctx, mon, cx, cy, size, alpha = 1) {
  if (!mon || !mon.art) return;
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
  if (ts - _combatAnimLast < 50) return;
  _combatAnimLast = ts;
  renderCombatCanvas();
}
requestAnimationFrame(combatAnimLoop);

// 敵にかかっている強化(▲)/弱体(▼)を名前プレート付近に小さなピルで描く。
// 能力(攻/守/速)ごとに集約し、段階ぶんの矢印と最短残ターンを添える。
const BUFF_KANJI = { atk: "攻", vit: "守", agi: "速" };
// 強化/弱体が「かかった瞬間」に出すフロート文字と色 (敵味方共通)。
// mods があれば能力ごとに 攻▲/守▼ … を並べ、無ければ汎用の 強化▲/弱体▼。
function buffFloatText(h) {
  const up = !!h.buff;
  const m = h.mods || {};
  const ks = Object.keys(m);
  const body = ks.length ? ks.map((k) => `${BUFF_KANJI[k] || "◆"}${up ? "▲" : "▼"}`).join("") : (up ? "強化▲" : "弱体▼");
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

// オート戦闘の解除 (解除ボタン / 戦闘画面タップの共通処理)
function stopAutoCombat() {
  if (!G.autoCombat) return;
  G.autoCombat = false;
  if (G._autoTimer) { clearTimeout(G._autoTimer); G._autoTimer = null; }
  showToast("⏹ オート戦闘を解除した");
  if (G.animating) combatMenu.innerHTML = ""; // 演出が終わると通常メニューに戻る
  else renderCombatMenu();
}

// ===== 戦闘のコマンド板 =====
// 鉄と石の重い札。主の一手 (攻撃) を大きく、ほかは下段に並べる。文字は textContent で入れる (名前の混入対策)
const CMD_SVG = {
  attack: '<path d="M20.5 3.5 20 8 10.2 17.8 6.2 13.8 16 4Z"/><path d="m5 13 6 6M7.6 16.4 3.5 20.5"/>',
  skill: '<path d="M12 2.5 13.9 10.1 21.5 12l-7.6 1.9L12 21.5l-1.9-7.6L2.5 12l7.6-1.9Z"/><circle cx="12" cy="12" r="2.2"/>',
  defend: '<path d="M12 2.8 19.5 5.6v6.1c0 4.7-3.1 8-7.5 9.5-4.4-1.5-7.5-4.8-7.5-9.5V5.6Z"/><path d="M12 6v12"/>',
  run: '<path d="M14 3.5h5.5v17H14"/><path d="M3.5 12h10M9.5 7.5l4.5 4.5-4.5 4.5"/>',
  auto: '<path d="M13.5 2.5 5 13.5h6l-1 8 8.5-11h-6Z"/>',
  fast: '<path d="M3.5 6v12l7.5-6Zm9 0v12l7.5-6Z"/>',
  back: '<path d="M15 4.5 7.5 12l7.5 7.5"/>',
  stop: '<path d="M7 7h10v10H7Z"/>',
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
  const w = turnPlate(actor.name, foe ? "の攻勢" : "の行動", []);
  if (foe) w.classList.add("who-foe");
  combatMenu.appendChild(w);
}

// オート戦闘中の常設バナー: 演出中も表示し続け、いつでも解除できる
function renderAutoBanner(actor) {
  combatMenu.innerHTML = "";
  combatMenu.dataset.mode = "auto";
  combatMenu.appendChild(actor ? turnPlate(actor.name, "の手番", ["オート"]) : turnPlate("オート戦闘中", "", []));
  combatMenu.appendChild(cmdBtn("stop", "オート解除", "画面のタップでも解除", stopAutoCombat, "cmd-wide"));
}

function renderCombatMenu() {
  const b = G.battle;
  setHint("敵をタップで攻撃 ・ スキルは長押しで詳細 ・ オートで自動戦闘");
  combatMenu.innerHTML = "";
  combatMenu.dataset.mode = "";
  if (G.animating) { if (G.autoCombat) renderAutoBanner(); return; } // アニメーション中は解除のみ可
  if (b.phase === "input") {
    const actor = b.current;
    highlightActor(actor);
    // オート戦闘: 全員が手近な敵を通常攻撃し続ける (周回用)。解除ボタンか画面タップで解除
    if (G.autoCombat) {
      renderAutoBanner(actor);
      if (!G._autoTimer) {
        G._autoTimer = setTimeout(() => {
          G._autoTimer = null;
          const b2 = G.battle;
          if (!b2 || b2.phase !== "input" || !G.autoCombat || G.animating) return;
          b2.chooseAction("attack");
          const tgt = b2.targetOptions()[0];
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
    const main = el("div", "cmd-main");
    main.appendChild(cmdBtn("attack", "攻撃", "敵をタップでも", () => act("attack"), "primary"));
    const mpTxt = actor.maxmp > 0 ? `MP ${actor.mp}/${actor.maxmp}` : "技なし";
    if (actor.spells.length) main.appendChild(cmdBtn("skill", "スキル", mpTxt, () => showSpells(actor)));
    else main.appendChild(cmdBtn("skill", "スキル", "使えない", () => log("スキルを使えない", "sys"), "muted"));
    combatMenu.appendChild(main);
    const sub = el("div", "cmd-sub");
    sub.appendChild(cmdBtn("defend", "防御", "", () => act("defend")));
    sub.appendChild(cmdBtn("run", "逃走", "", () => act("run")));
    sub.appendChild(cmdBtn("auto", "オート", "", () => { G.autoCombat = true; renderCombatMenu(); }));
    sub.appendChild(cmdBtn("fast", "倍速", G.fastAnim ? "ON" : "OFF", () => { G.fastAnim = !G.fastAnim; autosave(); renderCombatMenu(); }, G.fastAnim ? "on" : ""));
    combatMenu.appendChild(sub);
  } else if (b.phase === "target") {
    combatMenu.dataset.mode = "target";
    combatMenu.appendChild(turnPlate("対象を選択", "", ["敵を直接タップでも可"]));
    const opts = b.targetOptions();
    // 対象が多い時 (敵の群れなど) は2列に並べて縦に伸びすぎないようにする
    const list = el("div", "target-list" + (opts.length > 3 ? " cols2" : ""));
    for (const t of opts) {
      const tb = btn("", () => { b.chooseTarget(t); runCommitted(); });
      tb.className = "btn tgt " + (t.side === "enemy" ? "tgt-enemy" : "tgt-ally") + (t.alive ? "" : " tgt-down");
      const nm = el("span", "tgt-n", (t.side === "enemy" && b.isBackRow(t) ? "【後】" : "") + t.name + (t.side !== "enemy" && !t.alive ? " [気絶]" : ""));
      tb.appendChild(nm);
      const bar = el("span", "tgt-bar");
      const fill = el("i");
      fill.style.width = Math.max(0, Math.min(100, (t.hp / (t.maxhp || 1)) * 100)) + "%";
      bar.appendChild(fill);
      tb.appendChild(bar);
      tb.appendChild(el("span", "tgt-hp", t.side === "enemy" ? `HP ${t.hp}` : `HP ${t.hp}/${t.maxhp}`));
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
  // 呪文が多い職 (魔導士・賢者など最大11個) は2列に並べて縦に伸びすぎないようにする
  const list = el("div", "target-list" + (actor.spells.length > 4 ? " cols2" : ""));
  for (const key of actor.spells) {
    const sp = SPELLS[key];
    const cost = spellCost(actor, sp); // 省詠唱 (chant) 持ちは消費が軽い
    // 使えない技も長押しで詳細を見られるよう、native disabled ではなく soft-lock にする
    // (disabled だと pointer イベントが飛ばず長押しを拾えない)
    let locked = false;
    if (actor.mp < cost) locked = true; // MP不足は押せない
    // 単体味方呪文で効果のある対象がいない (満タンへの回復・状態異常なしへの治療) は押せない
    else if (sp.target === "ally" && G.battle._allyTargets(sp).length === 0) locked = true;
    const b = btn("", () => { if (locked) { SFX.ng(); return; } act("spell", key); });
    b.className = "btn spell spell-" + (sp.kind || "atk");
    const top = el("span", "sp-top");
    top.appendChild(el("span", "sp-n", sp.name));
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
// 戦闘テンポ: 倍速設定 (fastAnim) かオート中は演出時間を短縮する
function spdMul() { return (G.fastAnim || G.autoCombat) ? 0.45 : 1; }

function combatStep() {
  const b = G.battle;
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
  const r = G.battle.chooseAction(action, spellKey);
  if (r && r.invalid) { renderCombatMenu(); return; }
  if (G.battle.phase === "target") { autosave(); renderCombatMenu(); return; }
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
  if (b.result) { G.animating = false; setTimeout(endBattle, 300); return; }
  b.advance();
  autosave(true);
  setTimeout(combatStep, 150 * spdMul());
}

// 多段ヒットの時間差 (ms。spdMul で速度モードに追従)。applyImpact と共有
const HIT_STAGGER = 165;

// 結果オブジェクトを演出 (踏み込み → 着弾 → 余韻)
function animateResult(res, done) {
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
      if (h.dmg != null) {
        fx.floats.push({ x: pos.cx + dx, y: pos.cy - 10, text: String(h.dmg), color: h.crit ? "#ffd84a" : "#fff", t0: ht0, big: !!h.crit, kind: h.crit ? "crit" : "dmg" });
        if (h.crit) fx.floats.push({ x: pos.cx + dx, y: pos.cy - 40, text: "会心の一撃", color: "#ffb02e", t0: ht0, small: true, kind: "label" });
      }
      else if (h.heal != null) fx.floats.push({ x: pos.cx + dx, y: pos.cy - 10, text: "+" + h.heal, color: "#7CFC7C", t0: ht0, kind: "heal" }); // 敵の回復役による回復
      // 敵にかかった強化/弱体も発動フロートで知らせる (ピル表示に加えて瞬間を可視化)
      if (h.buff || h.debuff) { const mt = buffFloatText(h); fx.floats.push({ x: pos.cx + dx, y: pos.cy - 34, text: mt.text, color: mt.color, t0: ht0, kind: "buff" }); }
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
      } else if (h.cured) {
        // 状態異常の治癒も知らせる
        G.partyFx.set(h.target, "heal");
        fx.floats.push({ x: VW / 2, y: VH - 26, text: "治癒✚", color: "#9be8ff", t0: now });
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

// 戦闘勝利時: 入手Soulの1/5を、生存しているパーティメンバー全員の全部位の魂に
// 経験値(soul.exp)として加算する。閾値(soulTrainCost)に達した魂は自動でレベルアップし、
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
  for (const m of G.party) {
    if (!m || !m.alive) continue;
    preStat.set(m, snap(m));
    preSpells.set(m, new Set(m.spells || []));
    const ps = m.primary != null ? soulByUid(m.primary) : null;
    preLv.set(m, ps ? ps.level : 0);
  }
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
  recalcAllDolls();
  // メンバーごとに「レベルアップ(上昇ステータス付き)→新規スキル」をポップアップ用キューへ
  const STAT_LABEL = { maxhp: "HP", maxmp: "MP", atk: "ATK", vit: "VIT", agi: "AGI", int: "INT", pie: "PIE", luk: "LUK" };
  for (const m of G.party) {
    if (!m || !m.alive) continue;
    const ps = m.primary != null ? soulByUid(m.primary) : null;
    const newLv = ps ? ps.level : 0;
    const oldLv = preLv.get(m) || 0;
    if (newLv > oldLv) {
      const before = preStat.get(m) || {};
      const deltas = [];
      for (const k of STAT_KEYS) { const d = (m[k] || 0) - (before[k] || 0); if (d > 0) deltas.push(`${STAT_LABEL[k]} +${d}`); }
      queue.push({ kind: "level", member: m, toLv: newLv, deltas });
    }
    const oldSp = preSpells.get(m) || new Set();
    for (const sk of (m.spells || [])) if (!oldSp.has(sk)) queue.push({ kind: "skill", member: m, skill: sk });
  }
  return queue;
}

// レベルアップ/スキル習得ポップアップをキュー順に1つずつ表示し、最後に done を呼ぶ
function runProgressPopups(queue, done) {
  if (!queue || !queue.length) { if (done) done(); return; }
  const ev = queue.shift();
  const next = () => runProgressPopups(queue, done);
  if (ev.kind === "souldrop") {
    // 敵が落とした魂: 誰が吸収するかを選ぶ
    acquireSoul(ev.clsKey, `${ev.from || "敵"}が落とした魂だ。`, next);
    return;
  }
  if (ev.kind === "level") {
    SFX.levelup();
    const lines = [ev.member.cls];
    // 上昇ステータスは必要に応じて折り返して表示 (1行に固定せず自然改行)
    lines.push(ev.deltas && ev.deltas.length ? ev.deltas.join("  ") : "ステータスはそのまま");
    showEvent({
      banner: "⤴ レベルアップ ⤴",
      title: `${ev.member.name} は Lv${ev.toLv} に上がった！`,
      accent: "#ffd84a", sparkle: true,
      lines,
      btnLabel: "つぎへ", onClose: next,
    });
  } else {
    const sp = SPELLS[ev.skill];
    SFX.heal();
    showEvent({
      banner: "✦ スキル習得 ✦",
      title: `${ev.member.name} は「${sp ? sp.name : ev.skill}」を覚えた！`,
      accent: "#5fa8e0", sparkle: true,
      lines: sp ? [sp.desc] : [],
      btnLabel: "つぎへ", onClose: next,
    });
  }
}

function endBattle() {
  const b = G.battle;
  // オート戦闘は戦闘ごとに解除 (次の戦闘に持ち越さない)
  G.autoCombat = false;
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
    const goldGot = runGainGold(Math.round(gold * 2 * (gl >= 3 ? 1.50 : gl >= 2 ? 1.30 : gl === 1 ? 1.15 : 1)));
    const soulGot = runGainSoulPts(Math.round(soul * (sl >= 3 ? 1.35 : sl >= 2 ? 1.20 : sl === 1 ? 1.10 : 1)));
    applyVictoryPassives();
    // 入手Soulの1/5を生存メンバー全員の全部位の魂に加算 → レベルアップ/スキル習得を集計
    const progressQueue = distributeBattleSoulExp(soulGot);
    updateTopbar();
    log(`勝利！ ${goldGot} ゴールド と ✦${soulGot} Soul を得た。`, "win");
    SFX.victory();
    // 討伐クエストの進捗 + 戦績 + 図鑑記録 (倒した敵を集計)。
    // 戦利品はここでは抽選のみ。実物は勝利後の宝箱から取り出す
    for (const e of b.enemies) {
      if (e.alive) continue;
      questProgress("kill", e.key);
      G.stats.kills++;
      if (e.element && e.element !== "none") G.stats.elemKills[e.element] = true; // 戦績: 撃破した属性 (勲章用)
      if (e.isMimic) G.stats.mimics++;                       // 戦績: ミミック撃破数
      if (e.isMasterMimic) G.stats.masterMimicSlain = true;  // 戦績: マスターミミック討伐 (一度きり)
      recordMonsterKill(e.key, G.dungeonIdx); // 図鑑は「倒した時」に記録
    }
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
    // soulClass を持つ敵 (人型・騎士など) はまれに魂を落とす (レアドロップ)
    for (const e of b.enemies) {
      const sc = e.alive ? null : (e.mon && e.mon.soulClass) || (MONSTERS[e.key] && MONSTERS[e.key].soulClass);
      if (!sc) continue;
      const soulChance = wasElite ? 0.40 : 0.08; // 強敵は魂ドロップ率が大幅上昇
      if (Math.random() < soulChance) {
        // 落とした魂は勝利演出の後に「誰が吸収するか」を選ぶ (progressQueue に積む)
        const clsKey = rollJobClass();
        log(`${e.name}が ${SOUL_CLASSES[clsKey].label}の魂 を落とした！`, "win");
        progressQueue.push({ kind: "souldrop", clsKey, from: e.name });
      }
    }
    // 奈落の門番: 撃破を記録して先へ進めるようにする
    if (wasGuard) {
      G.abyss.guardFloor = G.floor; // この階の門番は撃破済み → 階段で潜れる
      flashScreen("#d4504e"); buzz([0, 60, 50, 60, 50, 250]);
      setTimeout(() => showToast("⚔ 奈落の門番を打ち倒した！"), 400);
    }
    // 迷宮踏破は本物の主戦のみ。死体から湧いた個体 (corpse)・奈落の門番は踏破扱いにしない
    const wasBoss = !corpse && !abyssActive() && b.enemies.some((e) => e.boss);
    if (wasBoss) { flashScreen("#ffd84a"); buzz([0, 60, 50, 60, 50, 250]); } // 主討伐は特別な瞬間
    else if (wasElite) { flashScreen("#d4504e"); buzz([0, 80, 50, 80, 50, 300]); setTimeout(() => showToast("☠ 強敵討伐！"), 400); }
    if (G.battleCell) G.battleCell.cleared = true;
    // 主討伐の確定処理 (踏破記録・章進行・戦利品確定) は演出より先に行い、
    // 直後の finishToBoard の保存に乗せる。演出中に中断されても踏破は失われない
    const clearInfo = wasBoss ? commitDungeonClear() : null;
    finishToBoard();
    // 勝利の余韻: まず勝利ポップアップ(Gold/Soul)を表示し、閉じてから宝箱を出す。
    // 宝箱はドロップ品があれば必ず、なければ50%で出現。強敵・ミミックは宝箱確定。
    // ミミックが残す宝箱は中身が上質 (アイテムレベル+15)。マスターミミックは+30。
    const wasMimic = b.enemies.some((e) => e.isMimic);
    const wasMasterMimic = b.enemies.some((e) => e.isMasterMimic);
    const afterVictory = () => {
      // 主討伐の踏破演出 → なければ「餓えた群れ」殲滅報酬。どちらも無ければ何もしない
      const after = clearInfo
        ? () => showDungeonClearedPopup(clearInfo)
        : (hordeRewardPending() ? () => grantHordeReward() : null);
      // 死体戦は宝箱を出さず、死体に残っていた魂を100%回収する
      if (corpse) {
        setTimeout(() => recoverCorpseSoul(corpse, after), 200);
        return;
      }
      // 盗賊の洞察 (sureChest) の階では敵が必ず宝箱を落とす
      if (drop || wasElite || wasMimic || (specialDef() || {}).sureChest || Math.random() < 0.5) {
        setTimeout(() => battleChest(drop ? [drop] : [], after, wasMasterMimic ? 30 : wasMimic ? 15 : 0, wasMimic || wasMasterMimic), 200);
        return;
      }
      if (after) after();
    };
    showEvent({
      banner: wasElite ? "☠ 強敵討伐 ☠" : "⚔ 勝利 ⚔",
      title: wasElite ? "強敵を討ち倒した！" : "戦いに勝利した！",
      accent: wasElite ? "#d4504e" : "#ffd84a",
      sparkle: true,
      lines: [`獲得 ゴールド 💰${goldGot}`, `回収した Soul ✦${soulGot}`],
      // 勝利ポップアップを閉じたら、レベルアップ/スキル習得を順番に表示してから宝箱へ
      btnLabel: "つぎへ", onClose: () => runProgressPopups(progressQueue, afterVictory),
    });
    return;
  } else if (b.result === "flee") {
    // 逃走: 元のマスへ戻る (カードは表のまま)
    SFX.flee();
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
    const mpct = (ml >= 2 ? 0.10 : ml === 1 ? 0.05 : 0) + (bl >= 2 ? 0.08 : bl === 1 ? 0.03 : 0);
    if (hpct > 0 && p.hp < p.maxhp) { p.hp = Math.min(p.maxhp, p.hp + Math.ceil(p.maxhp * hpct)); healed = true; }
    if (mpct > 0 && p.mp < p.maxmp) { p.mp = Math.min(p.maxmp, p.mp + Math.ceil(p.maxmp * mpct)); healed = true; }
  }
  if (healed) log("勝利の余韻が隊を癒した。", "heal");
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
  if (G.party.some((p) => p.alive && pLv(p, "mercy")) && G.run && !G.run.mercyUsed) {
    const dead = G.party.find((p) => !p.alive);
    if (dead) {
      G.run.mercyUsed = true;
      dead.alive = true;
      dead.hp = Math.max(1, Math.ceil(dead.maxhp * 0.10));
      dead.ailment = null;
      dead.reviveAt = null;
      dead._dead = false;
      log(`慈悲の祈り！ ${dead.name}が立ち上がった`, "win");
      setTimeout(() => showToast(`🕊 慈悲の祈り: ${dead.name} 蘇生`), 400);
    }
  }
}

function finishToBoard() {
  imprintFallen(); // 戦闘で砕けた人業の魂に記憶を刻む
  for (const p of G.party) p._defending = false;
  G.battle = null;
  G.battleCell = null;
  G.state = "board";
  combatMenu.classList.add("hidden");

  playBgm(fieldBgm());
  renderBoard();
  autosave(true);
}

const GUARDIAN_COST = 20; // 全滅時、戦利品を守って帰還するための Red Soul
function gameOver() {
  G.state = "over";
  playBgm(null);
  SFX.gameover();
  buzz([0, 90, 70, 90, 70, 250]);
  log("人業はことごとく砕けた…", "dmg");
  imprintFallen(); // 記憶を刻み、連れ帰りタイマーを開始

  combatMenu.classList.add("hidden");
  const r = G.run || { gold: 0, soulPts: 0, items: [], souls: [] };

  // 街へ戻る (死亡人業は連れ帰りを待つ)
  const goTown = () => { if (townBtn) townBtn.classList.add("hidden"); if (descendBtn) { descendBtn.classList.add("hidden"); descendBtn.disabled = true; } combatMenu.classList.add("hidden"); returnToTown(); };

  const opts = [];
  // 赤い魂を使う: 何も失わず街へ即時帰還。全キャラHP1で復活する
  if (G.redSoul >= GUARDIAN_COST) {
    opts.push({ label: `🔴 赤い魂 ×${GUARDIAN_COST} を使う（全て守り全員HP1で生還）`, fn: () => {
      G.redSoul -= GUARDIAN_COST;
      G.run = null; // 戦利品を確定 (没収しない)
      reviveAllAtHp1(); // 全キャラHP1で復活
      SFX.levelup(); buzz([0, 30, 40, 30]);
      log("赤い魂が戦利品と人業を守った。一同HP1で生還する。", "win");
      goTown();
    } });
  }
  // あきらめる: ゴールド・アイテム・魂を失う (✦Soul は残る)、人業は救出を待つ
  opts.push({ label: "🏚 あきらめる（💰・装備・魂を失い救出を待つ）", danger: true, fn: () => {
    forfeitRun();
    log("今回得たゴールド・アイテム・魂は失われた…（✦Soul は残った）", "dmg");
    goTown();
  } });

  // 失うものをリスト表示 (✦Soul は失わないことを明記)
  const lossLines = [
    "全滅した。このまま諦めると、今回の探索で得た以下を失う:",
    `　💰 ${r.gold} ゴールド`,
    `　🎁 アイテム ${r.items.length} 個`,
    `　👻 魂 ${r.souls.length} 体`,
    `（✦${r.soulPts} Soul は失わない）`,
    G.redSoul >= GUARDIAN_COST
      ? `🔴 赤い魂 ${GUARDIAN_COST} を使えば、何も失わず全員HP1で生還できる。`
      : `※ 赤い魂 ${GUARDIAN_COST} があれば全て守れた（所持 ${G.redSoul}）。`,
  ];
  showChoice("人業はことごとく砕けた…", opts, ICONS.corpse, { banner: "💀 全滅 💀", accent: "#d4504e", lines: lossLines });
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
  G.run = null; // クリア = 戦利品確定
  G.bossDown = true; // 主を討ったので、どこからでも帰還できる
  return { idx, isStoryTarget };
}

// 踏破の凱旋演出 (確定処理は commitDungeonClear 済み)
function showDungeonClearedPopup({ idx, isStoryTarget }) {
  const dn = DUNGEONS[idx];
  const lines = [`「${dn.name}」を踏破した！`];
  if (isStoryTarget) lines.push("勅命を果たした。王宮へ戻り、王に報告せよ。");
  else if (idx >= DUNGEONS.length - 1) lines.push("すべての迷宮を制覇した。あなたは伝説となった。");
  else lines.push("さらなる深淵が、まだそなたを待っている。");

  G.prompt = true;
  SFX.victory(); buzz([0, 40, 50, 40, 50, 200]);
  itemGetEl.innerHTML = "";
  const card = el("div", "ig-card");
  card.style.borderColor = "#ffd84a";
  card.style.boxShadow = "0 0 50px #ffd84a55";
  card.appendChild(el("div", "ig-banner", "★ 迷宮踏破 ★"));
  card.appendChild(el("div", "ig-name", dn.name));
  for (const ln of lines) card.appendChild(el("div", "ig-desc", ln));
  const ok = btn("街へ凱旋する", () => {
    itemGetEl.classList.add("hidden"); itemGetEl.innerHTML = "";
    G.prompt = false;
    if (townBtn) townBtn.classList.add("hidden");
    if (descendBtn) { descendBtn.classList.add("hidden"); descendBtn.disabled = true; }
    returnToTown();
  });
  ok.className = "btn primary ig-ok";
  card.appendChild(ok);
  // 層の主を討った時 (層末の迷宮) は戦果を共有できる
  if (dn.boss) {
    const sh = btn("📣 戦果をシェア", (e) => { if (e) e.stopPropagation(); shareProgress(`第${dn.layer}層の主を討ち、「${dn.name}」を踏破した！`); });
    sh.className = "btn ig-ok share-btn";
    card.appendChild(sh);
  }
  itemGetEl.appendChild(card);
  itemGetEl.classList.remove("hidden");
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
let _partyKey = "";
function renderParty() {
  const fx = G.partyFx;
  const st = G.state;
  const key = st + "|" + G.party.map((p) => [
    p.uid, p.name, p.cls, p.isDoll ? (p.jobLv || 1) : p.level, p.hp, p.maxhp, p.mp, p.maxmp, p.alive ? 1 : 0,
    p.ailment || "", p.asleep && st === "combat" ? 1 : 0, fx && fx.has(p) ? fx.get(p) : "", buffBadges(p),
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
    if (G.state === "board") {
      card.style.cursor = "pointer";
      card.addEventListener("click", () => openStatus(idx));
    }
    // 肖像の額 (隊列の印・状態の印を重ねる)
    const por = el("div", "pc-por");
    const pic = partyPortrait(p);
    if (pic) por.appendChild(pic);
    por.appendChild(el("span", "pc-row " + (idx < 3 ? "front" : "back"), idx < 3 ? "前" : "後"));
    if (!p.alive) por.appendChild(el("span", "pc-seal dead", "斃"));
    else if (p.ailment) { const a = AIL_SEAL[p.ailment] || ["呪", "poison"]; const s2 = el("span", "pc-seal " + a[1], a[0]); s2.title = AIL_NAME[p.ailment] || ""; por.appendChild(s2); }
    else if (p.asleep && G.state === "combat") por.appendChild(el("span", "pc-seal sleep", "眠"));
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
    const c = spriteCanvas(dollSprite(p), PORTRAIT_PX / 12);
    c.className = "spr pc-pic";
    ent = { key, c };
    _partyPics.set(p, ent);
  }
  return ent.c;
}

// 戦闘中の発動効果バッジ: 能力ごとに 強化(▲)/弱体(▼) を段階数ぶん並べ、残りターンを添える。
const BUFF_STAT_ICON = { atk: "⚔", vit: "🛡", agi: "💨" };
const BUFF_STAT_LABEL = { atk: "ATK", vit: "VIT", agi: "AGI" };
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

// 施設の表構え: 上部の情景 (art)・帯に切り出す位置 (pos)・番人 (keeper) のひとこと。lines は帰還のたびに巡る
const FAC_SHELL = {
  mansion: { art: "mansion", pos: "50% 40%", keeper: "binder", who: "人形師 オルドー", lines: [
    "器は空のままでは歩けぬ。魂を注げば、肉より従順に動くとも。",
    "壊れた器は直せる。だが、宿っていた魂の記憶までは戻らん。",
    "糸を引くのは儂ではない。魂のほうよ。器は、ただ応えるだけだ。"] },
  altar: { art: "altar", pos: "50% 40%", keeper: "binder", who: "人形師 オルドー", lines: [
    "魂は付け替えられる。…痛むのは、器のほうではないがな。",
    "注いだ ✦Soul は魂に刻まれる。器を替えても、失われはせん。"] },
  party: { art: "party", pos: "50% 45%", keeper: "binder", who: "人形師 オルドー", lines: [
    "連れてゆく器を選べ。戻らぬ器のぶんまで、な。",
    "前に立つ者ほど狙われる。盾を持たせる器を、よく選ぶことだ。"] },
  manage: { art: "manage", pos: "50% 55%", keeper: "binder", who: "人形師 オルドー", lines: [
    "新しい器が要るか。赤い魂で払え。名は、後からでも刻める。",
    "名を持たぬ器は、迷宮の闇に溶けやすい。…名を与えてやれ。"] },
  tavern: { art: "tavern", pos: "50% 45%", keeper: "barkeep", who: "酒場の主 グラム", lines: [
    "灯が消えぬうちは、ここは安全だ。…たぶんな。",
    "飲め。迷宮帰りの喉は、血の味しか覚えておらん。",
    "噂は金で買える。命は買えん。その差を忘れるな。"] },
  shop: { art: "shop", pos: "50% 45%", keeper: "merchant", who: "黒鉄商会 ヴォス", compact: true, lines: [
    "黒鉄は嘘をつかん。値札もな。",
    "死人の剣でも、研げば生者の役に立つ。",
    "未鑑定の品か。正体を知るのは、金を払ってからだ。"] },
  inn: { art: "inn", pos: "50% 62%", keeper: "innkeeper", who: "宿の女主 イルザ", lines: [
    "眠りな。夢の底までは、迷宮も追ってこない。",
    "白狼の毛皮は温かいだろう。…あれを狩ったのは、あたしさ。",
    "扉の閂は三重。それでも夜中に爪の音がしたら、起こしな。"] },
  palace: { art: "palace", pos: "50% 35%", keeper: "minister", who: "宰相 モルデン", lines: [
    "陛下は玉座でお待ちだ。…あまり長くは、お待ちになれぬ。",
    "勅命は果たされねばならぬ。たとえ、器が幾つ砕けようとも。"] },
  treasury: { art: "treasury", pos: "50% 58%", keeper: "minister", who: "宰相 モルデン", lines: [
    "納めよ。迷宮の拾い物にも、王の目は値を付ける。",
    "宝物庫の鍵は三つ。ひとつは陛下、ひとつは余、最後のひとつは…失われた。"] },
  codexAch: { art: "codexAch", pos: "50% 45%", compact: true },
  codexItem: { art: "codexItem", pos: "50% 78%", compact: true },
  codexDungeon: { art: "codexMon", pos: "50% 55%", compact: true },
  codexMon: { art: "codexMon", pos: "50% 55%", compact: true },
  codexJob: { art: "codexJob", pos: "50% 45%", compact: true },
  shrine: { art: "shrine", pos: "50% 36%", keeper: "maiden", who: "祠守の巫女", lines: [
    "赤い魂は脈打つ。誰の心臓だったかは、問うてはならぬ。",
    "祈りなさい。この祠は、祈りの代わりに血を受け取ります。"] },
  abyss: { art: "abyss", pos: "50% 58%", compact: true },
};
// いま開いている画面の表構えの鍵 (館の中はサブ画面ごと)
function shellKey() {
  const f = G.town.facility;
  if (f === "mansion") return G.town.sub || "mansion";
  return f;
}

// 編成 + 控えの全人業
function allDolls() { return [...G.party, ...G.reserve]; }

// 所持通貨 (金貨 / ✦Soul / 赤い魂 / 魂の残火)
function currencyEl() {
  const cur = el("div", "tw-cur");
  cur.appendChild(el("span", "tw-c-gold", `💰${G.gold}`));
  cur.appendChild(el("span", "tw-c-soul", `✦${G.soulPts}`));
  cur.appendChild(el("span", "tw-c-red", `🔴${G.redSoul}`));
  if (G.embers > 0) cur.appendChild(el("span", "tw-c-ember", `🔥${G.embers}`));
  return cur;
}

// 施設画面の見出し。表構え (FAC_SHELL) があれば、情景の帯に見出しを重ね、番人のひとことを添える
function townHeader(title, backTo = "hub") {
  const head = el("div", "tw-head");
  if (backTo) {
    const back = btn(backTo === "hub" ? "← 広場へ" : "← 戻る", () => {
      G.town.facility = backTo === "hub" ? null : backTo;
      G.town.sub = null; // サブメニュー (館の中など) を抜ける
      altarSel = null;
      renderTown();
    });
    back.className = "tw-back";
    head.appendChild(back);
  } else {
    const sg = btn("⚙", () => { SFX.select(); if (G.settingsOpen) closeSettings(); else openSettings(); });
    sg.className = "tw-back";
    sg.title = "設定";
    head.appendChild(sg);
  }
  head.appendChild(el("div", "tw-title", title));
  head.appendChild(currencyEl());
  const shell = backTo ? FAC_SHELL[shellKey()] : null;
  if (!shell) return head;
  const wrap = el("div", "tw-shell" + (shell.compact ? " compact" : "") + (shell.keeper ? " has-keeper" : ""));
  const banner = el("div", "tw-banner");
  try { const art = vignetteCanvas(shell.art); if (art) { if (shell.pos) art.style.objectPosition = shell.pos; banner.appendChild(art); } } catch (e) { /* 演出のみ */ }
  banner.appendChild(head);
  wrap.appendChild(banner);
  if (shell.keeper) {
    const k = el("div", "tw-keeper");
    const port = el("div", "tw-kport");
    try { const bust = keeperCanvas(shell.keeper); if (bust) port.appendChild(bust); } catch (e) { /* 演出のみ */ }
    k.appendChild(port);
    const say = el("div", "tw-ksay");
    say.appendChild(el("div", "tw-kwho", shell.who));
    const ls = shell.lines;
    say.appendChild(el("div", "tw-kline", `「${ls[((G.stats && G.stats.runs) || 0) % ls.length]}」`));
    k.appendChild(say);
    wrap.appendChild(k);
  }
  return wrap;
}

// 街を描き直す (名前と約225の呼び出し元はそのまま)。中身の描き替え・スクロール位置の保持・
// タブバーの点灯・遷移の演出は街シェル (townshell.refresh) が受け持ち、旧画面は renderTownLegacy が描く
function renderTown() {
  renderRunbar(); // 街では隠す
  autosave(); // 街での操作のたびに保存 (描画はアクション後に呼ばれる)
  updateTopbar();
  playBgm(sceneBgm()); // 施設ごとのBGM (同じ曲なら継続)
  townshell.refresh();
}

// 旧画面アダプタ: G.town.facility (と sub) に応じて旧来の施設画面を街シェルの中身へ描く
function renderTownLegacy() {
  const f = G.town.facility;
  if (f === "mansion") return renderMansion();
  if (f === "altar") return renderAltar();
  if (f === "tavern") return renderTavern();
  if (f === "inn") return renderInn();
  if (f === "shop") return renderShop();
  if (f === "palace") return renderPalace();
  if (f === "shrine") return renderShrine();
  if (f === "codexMon") return renderCodexDungeon(); // 旧モンスター図鑑は廃止 (旧セーブ互換)
  if (f === "codexItem") return renderCodexItem();
  if (f === "codexDungeon") return renderCodexDungeon();
  if (f === "codexJob") return renderCodexJob();
  if (f === "codexAch") return renderCodexAch();
  if (f === "treasury") return renderTreasury();
  if (f === "abyss") return renderAbyss();
  renderTownHub();
}

// 施設の札: 情景の絵 (townart.js) に名前と一言を重ねる。locked なら鎖をかけて閉ざす
function facPlate(art, name, desc, { locked = false, badge = null, onClick = null, lockDesc = "王命を果たすまで開かない", wide = false } = {}) {
  const c = el("div", "tw-plate" + (locked ? " locked" : "") + (wide ? " wide" : ""));
  const a = el("div", "tw-plate-art");
  try { const v = vignetteCanvas(art); if (v) a.appendChild(v); } catch (e) { /* 演出のみ */ }
  if (locked) { try { const lk = iconCanvas("lock"); if (lk) { lk.classList.add("tw-plate-lock"); a.appendChild(lk); } } catch (e) { /* 演出のみ */ } }
  c.appendChild(a);
  const cap = el("div", "tw-plate-cap");
  cap.appendChild(el("div", "tw-plate-name", name));
  cap.appendChild(el("div", "tw-plate-desc", locked ? lockDesc : desc));
  c.appendChild(cap);
  if (badge && !locked) c.appendChild(el("div", "tw-plate-badge", badge));
  if (locked) c.setAttribute("aria-disabled", "true");
  else if (onClick) {
    c.setAttribute("role", "button");
    c.tabIndex = 0;
    c.addEventListener("click", onClick);
    c.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } });
  }
  return c;
}

let townBandOpen = null; // 迷宮選択で開いている層 (null = 選択中の迷宮の層)

// 編成の肖像 (24x24 ドット想定・48px 表示)。肖像の絵の差し替えはこの一か所で行う
function rosterPortrait(d) {
  const c = spriteCanvas(dollSprite(d), 4);
  c.classList.add("tw-portrait");
  return c;
}

// 第0章 (人業の生成) の間に開いている施設 (null = 制限なし)
function tutorialAllowed() {
  const tut = G.msq && G.msq.n === 0 && G.msq.state === "active";
  return tut ? (G.msq.granted ? ["palace", "mansion"] : ["palace"]) : null;
}

// 層の気配 (戦闘背景を縮めた帯)。層ごとに一度だけ描いて data URL を覚えておく
const _layerMood = new Map();
function layerMoodUrl(layer) {
  if (_layerMood.has(layer)) return _layerMood.get(layer);
  let url = "";
  try {
    const c = document.createElement("canvas");
    c.width = 240; c.height = 160;
    drawBattleBackdrop(c.getContext("2d"), 240, 160, layer, 0);
    url = c.toDataURL();
  } catch (e) { url = ""; }
  _layerMood.set(layer, url);
  return url;
}

// 迷宮の門の見出しへ滑らかに移る
function scrollToGates() {
  requestAnimationFrame(() => { const g = townEl.querySelector(".tw-gates"); if (g) g.scrollIntoView({ block: "start", behavior: REDUCED_MOTION ? "auto" : "smooth" }); });
}

function renderTownHub() {
  const allowed = tutorialAllowed();
  const isOpen = (k) => !allowed || allowed.includes(k);
  const lockedToast = () => { SFX.ng(); showToast("王命を果たすまで閉ざされている"); };
  const enter = (k) => { if (!isOpen(k)) return lockedToast(); SFX.select(); G.town.facility = k; G.town.sub = null; renderTown(); };

  // ── 夜景 (動くパノラマ) に表題・設定・通貨・名所の札を重ねる ──
  const hero = el("div", "tw-hero");
  const art = el("div", "tw-hero-art");
  try { const sc = townshell.keep("townScene", createTownScene); if (sc) art.appendChild(sc); } catch (e) { /* 演出のみ: 失敗しても街は使える */ }
  hero.appendChild(art);
  const bar = el("div", "tw-hero-bar");
  const sg = btn("⚙", () => { SFX.select(); if (G.settingsOpen) closeSettings(); else openSettings(); });
  sg.className = "tw-back tw-gear";
  sg.title = "設定";
  sg.setAttribute("aria-label", "設定");
  bar.appendChild(sg);
  bar.appendChild(currencyEl());
  hero.appendChild(bar);
  let spots = {};
  try { spots = townSpots(); } catch (e) { spots = {}; }
  const SPOT_LABEL = { palace: "王宮", mansion: "人業の館", tavern: "酒場", shrine: "祠", crypt: "迷宮の口" };
  for (const k of Object.keys(SPOT_LABEL)) {
    const p = spots[k];
    if (!p) continue;
    if (k === "crypt" && G.unlockedDungeons < 1) continue;
    const open = k === "crypt" || isOpen(k);
    const s = el("button", "tw-spot tw-spot-" + k + (open ? "" : " locked"));
    s.style.left = (p.x * 100).toFixed(2) + "%";
    s.style.top = (p.y * 100).toFixed(2) + "%";
    s.appendChild(el("span", "tw-spot-l", SPOT_LABEL[k]));
    if (k === "palace" && palaceCallReady()) s.classList.add("call");
    s.addEventListener("click", () => { if (k === "crypt") { SFX.select(); scrollToGates(); } else enter(k); });
    hero.appendChild(s);
  }
  const ttl = el("div", "tw-hero-title");
  ttl.appendChild(el("div", "tw-hero-kick", "辺境の街"));
  ttl.appendChild(el("div", "tw-hero-name", "ロアダル"));
  ttl.appendChild(el("div", "tw-hero-sub", "百の迷宮の淵に、最後の灯がともる"));
  hero.appendChild(ttl);
  townEl.appendChild(hero);

  // ── いまの目標 (封蝋の勅書)。タップでその場所へ ──
  const goal = currentObjective();
  if (goal) {
    const g = el("div", "tw-goal");
    g.setAttribute("role", "button");
    g.tabIndex = 0;
    const seal = el("div", "tw-goal-seal");
    seal.appendChild(el("span", null, "命"));
    g.appendChild(seal);
    const tx = el("div", "tw-goal-tx");
    tx.appendChild(el("div", "tw-goal-k", "いまの目標"));
    tx.appendChild(el("div", "tw-goal-t", goal.text));
    g.appendChild(tx);
    g.appendChild(el("span", "tw-goal-go", "›"));
    g.addEventListener("click", () => { SFX.select(); goal.go(); });
    townEl.appendChild(g);
  }

  // ── 街の施設 (情景の札) ──
  townEl.appendChild(el("div", "tw-h", "街の施設"));
  const grid = el("div", "tw-plates");
  for (const fac of FACILITIES) {
    const locked = !isOpen(fac.key);
    const badge = fac.key === "palace" && palaceCallReady() ? (G.msq.state === "report" ? "踏破を報告" : "新たな勅命") : null;
    grid.appendChild(facPlate(fac.key, fac.name, fac.desc, { locked, badge, onClick: () => enter(fac.key) }));
  }
  townEl.appendChild(grid);

  // ── 編成 (肖像の札。タップで個別ステータス) ──
  const rh = el("div", "tw-h tw-h-link");
  rh.appendChild(el("span", "tw-h-t", `編成 ${G.party.length}/6`));
  if (isOpen("mansion") && allDolls().some((d) => !d.isEmpty)) {
    const go = el("button", "tw-h-go", "隊列を組む ›");
    go.addEventListener("click", () => { if (!isOpen("mansion")) return lockedToast(); SFX.select(); G.town.facility = "mansion"; G.town.sub = "party"; renderTown(); });
    rh.appendChild(go);
  }
  townEl.appendChild(rh);
  const party = el("div", "tw-party");
  if (!G.party.length) {
    party.appendChild(el("div", "tw-empty",
      allowed && !G.msq.granted ? "人業がいない。まずは王宮で王に謁見しよう。" : "人業がいない。館の保管庫で仕立てよう。"));
  } else {
    G.party.forEach((d, i) => {
      const c = el("div", "tw-pcard" + (d.alive ? "" : " dead") + (i >= 3 ? " back" : ""));
      c.setAttribute("role", "button");
      c.tabIndex = 0;
      const port = el("div", "tw-pport");
      if (d.dominant && SOUL_CLASSES[d.dominant.clsKey]) port.style.setProperty("--glow", SOUL_CLASSES[d.dominant.clsKey].glow);
      port.appendChild(rosterPortrait(d));
      port.appendChild(el("span", "tw-prow", i < 3 ? "前衛" : "後衛"));
      c.appendChild(port);
      c.appendChild(el("div", "tw-pname", d.name + (d.alive ? "" : " †")));
      c.appendChild(el("div", "tw-pcls", `${d.cls} Lv${d.jobLv || 1}`));
      if (d.alive) {
        const hp = el("div", "tw-php");
        const fill = el("i");
        const r = Math.max(0, Math.min(1, d.hp / Math.max(1, d.maxhp)));
        fill.style.width = (r * 100).toFixed(1) + "%";
        if (r < 0.34) hp.classList.add("low");
        hp.appendChild(fill);
        c.appendChild(hp);
        c.appendChild(el("div", "tw-phpn", `HP ${d.hp}/${d.maxhp}`));
      } else {
        c.appendChild(reviveTimerEl("div", "tw-phpn revive", "帰還 ⏳", d));
      }
      c.addEventListener("click", () => openStatus(i));
      party.appendChild(c);
    });
    // 空席 (隊列を組む画面へ)
    const slots = Math.min(6, Math.ceil(G.party.length / 3) * 3);
    for (let i = G.party.length; i < slots; i++) {
      const v = el("div", "tw-pcard vacant" + (i >= 3 ? " back" : ""));
      v.appendChild(el("div", "tw-pport"));
      v.appendChild(el("div", "tw-pname", "空席"));
      v.appendChild(el("div", "tw-pcls", "控えから加える"));
      if (isOpen("mansion")) v.addEventListener("click", () => { SFX.select(); G.town.facility = "mansion"; G.town.sub = "party"; renderTown(); });
      party.appendChild(v);
    }
  }
  townEl.appendChild(party);

  // ── 迷宮の門 (勅命第1章を拝命するまで、場所は明かされない) ──
  const gates = el("div", "tw-gates");
  gates.appendChild(el("div", "tw-h", "迷宮の門"));
  if (G.unlockedDungeons < 1) {
    gates.appendChild(el("div", "tw-note", "王の勅命を受けるまで、迷宮の在処は明かされない。"));
  } else {
    gates.appendChild(el("div", "tw-dunhelp", "踏破した門は何度でもくぐれる — 戦利品・魂・図鑑集めに。"));
    const clearedCnt = clearedDungeonCount();
    // 勅命の対象迷宮 (攻略中の章のみ印を付ける)
    const targetIdx = G.msq && G.msq.state === "active" && G.msq.n >= 1 ? G.msq.n - 1 : -1;
    const PER_LAYER = 5; // 1層 = 5迷宮
    // 公開範囲 (CONTENT_LIMIT) より先は準備中: 既存セーブで解放済みでも一覧には出さない
    const openDungeons = Math.min(G.unlockedDungeons, CONTENT_LIMIT);
    if (G.dungeonIdx >= openDungeons) G.dungeonIdx = openDungeons - 1;
    const openBand = (townBandOpen != null) ? townBandOpen : Math.floor(G.dungeonIdx / PER_LAYER);
    const maxBand = Math.floor((openDungeons - 1) / PER_LAYER); // 解放済み迷宮が属する最後の層
    for (let b = 0; b <= maxBand; b++) {
      const s = b * PER_LAYER, e = Math.min(DUNGEONS.length, s + PER_LAYER);
      // 出現済み (解放済み) の迷宮のみ表示する。未出現の迷宮は一切見せない (先を伏せる)
      const appeared = Math.max(0, Math.min(openDungeons - s, e - s));
      if (appeared <= 0) continue;
      const det = el("details", "tw-band tw-layer");
      if (b === openBand) det.open = true;
      const sum = el("summary", "tw-bandh tw-layerh");
      const mood = layerMoodUrl(b + 1);
      if (mood) sum.style.setProperty("--mood", `url(${mood})`);
      const clearedIn = Math.max(0, Math.min(clearedCnt - s, appeared));
      const lv = LAYER_VISUALS[b]; // 層テーマ (第b+1層)
      const ht = el("span", "tw-layer-t");
      ht.appendChild(el("span", "tw-layer-n", `第${b + 1}層`));
      ht.appendChild(el("span", "tw-layer-name", lv ? lv.name : ""));
      sum.appendChild(ht);
      sum.appendChild(el("span", "tw-layer-p" + (clearedIn >= e - s ? " done" : ""), `踏破 ${clearedIn}/${e - s}`));
      det.appendChild(sum);
      det.addEventListener("toggle", () => {
        if (det.open) townBandOpen = b;
        else if (townBandOpen === b) townBandOpen = null;
      });
      const dlist = el("div", "tw-mlist tw-gatelist");
      for (let i = s; i < s + appeared; i++) {
        const dn = DUNGEONS[i];
        const cleared = i < clearedCnt;
        const sel = i === G.dungeonIdx;
        const row = el("div", "tw-gate" + (sel ? " sel" : "") + (cleared ? " cleared" : "") + (i === targetIdx ? " quest" : ""));
        row.setAttribute("role", "button");
        row.tabIndex = 0;
        row.setAttribute("aria-pressed", sel ? "true" : "false");
        const gi = el("div", "tw-gate-ic");
        try { const ic = iconCanvas(sel ? "gateOpen" : cleared ? "gateDone" : "gate"); if (ic) gi.appendChild(ic); } catch (e) { /* 演出のみ */ }
        gi.appendChild(el("span", "tw-gate-no", String(i + 1)));
        row.appendChild(gi);
        const info = el("div", "tw-gate-i");
        info.appendChild(el("div", "tw-gate-n", dn.name));
        const elTag = dn.element && ELEMENTS[dn.element] ? ` ・ ${ELEMENTS[dn.element].label}の気配` : "";
        const boss = (i + 1) % 5 === 0 ? " ・ 層の主が待つ" : "";
        info.appendChild(el("div", "tw-gate-c", `全${dn.floors}階${elTag}${boss}`));
        row.appendChild(info);
        // 踏破状態の印 (★踏破済=再挑戦可 / 勅命=攻略対象 / 未踏破)
        const st = el("div", "tw-dunst" + (cleared ? " done" : i === targetIdx ? " quest" : ""));
        st.textContent = cleared ? "★ 踏破" : i === targetIdx ? "勅命" : "未踏破";
        row.appendChild(st);
        row.addEventListener("click", () => { G.dungeonIdx = i; SFX.select(); renderTown(); });
        dlist.appendChild(row);
      }
      det.appendChild(dlist);
      gates.appendChild(det);
    }
    // 公開範囲の最後まで来たら、次の層を「準備中」として見せる (鎖で封じられた大門)
    if (G.unlockedDungeons >= CONTENT_LIMIT && CONTENT_LIMIT < DUNGEONS.length) {
      const nl = LAYER_VISUALS[CONTENT_NEXT_LAYER - 1];
      const sealed = el("div", "tw-gate tw-gate-sealed");
      const gi = el("div", "tw-gate-ic");
      try { const ic = iconCanvas("gateSealed"); if (ic) gi.appendChild(ic); } catch (e) { /* 演出のみ */ }
      sealed.appendChild(gi);
      const info = el("div", "tw-gate-i");
      info.appendChild(el("div", "tw-gate-n", `第${CONTENT_NEXT_LAYER}層 — ${nl ? nl.name : ""}`));
      info.appendChild(el("div", "tw-gate-c", "大門は鎖で封じられている"));
      sealed.appendChild(info);
      sealed.appendChild(el("div", "tw-dunst sealed", "準備中"));
      gates.appendChild(sealed);
    }
  }
  // 無限迷宮「奈落」: D50 踏破で解放されるエンドコンテンツ。いつでも挑戦できる
  if (featureUnlocked("infinite")) {
    const rec = abyssRecords();
    const row = el("div", "tw-gate tw-gate-abyss");
    row.setAttribute("role", "button");
    row.tabIndex = 0;
    const gi = el("div", "tw-gate-ic");
    try { const ic = iconCanvas("abyss"); if (ic) gi.appendChild(ic); } catch (e) { /* 演出のみ */ }
    row.appendChild(gi);
    const ai = el("div", "tw-gate-i");
    ai.appendChild(el("div", "tw-gate-n", "無限迷宮「奈落」"));
    ai.appendChild(el("div", "tw-gate-c", rec.bestDepth ? `最深 B${rec.bestDepth}F ・ 最高 ${rec.bestScore.toLocaleString()}点` : "どこまでも潜れる。深さに果てはない。"));
    row.appendChild(ai);
    row.appendChild(el("div", "tw-dunst", "挑戦"));
    row.addEventListener("click", () => { SFX.select(); openAbyssSetup(); });
    gates.appendChild(el("div", "tw-h", "果てなき深淵"));
    gates.appendChild(row);
  }
  townEl.appendChild(gates);

  // 迷宮へ (常に1階から) — スクロール位置に関わらず押せるよう画面下部に固定表示
  if (G.unlockedDungeons >= 1) {
    const divebar = el("div", "tw-divebar");
    const again = G.dungeonIdx < clearedDungeonCount(); // 踏破済みへの再挑戦
    const dn = curDungeon();
    const dive = el("button", "btn primary tw-dive");
    dive.setAttribute("aria-label", `「${dn.name}」へ${again ? "再挑戦" : "潜る"} (B1F)`);
    try { const ic = iconCanvas("dive"); if (ic) { ic.classList.add("tw-dive-ic"); dive.appendChild(ic); } } catch (e) { /* 演出のみ */ }
    const tx = el("span", "tw-dive-tx");
    tx.appendChild(el("span", "tw-dive-k", again ? "ふたたび門をくぐる" : "迷宮へ潜る"));
    tx.appendChild(el("span", "tw-dive-n", `「${dn.name}」 B1F`));
    dive.appendChild(tx);
    dive.appendChild(el("span", "tw-dive-go", "›"));
    dive.addEventListener("click", tryEnterDungeon);
    divebar.appendChild(dive);
    townEl.appendChild(divebar);
  }
}

// セーブを消して最初からやり直す。autosave (visibilitychange/pagehide 含む) が
// リロード前に書き戻さないよう _resetting で保存を止めてから消す。
function confirmReset() {
  showChoice("全データを削除して最初から始めますか？", [
    { label: "やめておく", fn: () => {} },
    { label: "削除する", danger: true, fn: () => {
      showChoice("本当に？ 人業・魂・図鑑・進行度がすべて失われます。", [
        { label: "やめておく", fn: () => {} },
        { label: "すべて削除して はじめから", danger: true, fn: () => {
          _resetting = true;
          clearSave();
          location.reload();
        } },
      ], null, { banner: "⚠ 最終確認 ⚠", accent: "#e4554f" });
    } },
  ], null, { banner: "⚠ 警告 ⚠", accent: "#e4554f" });
}

// ---- 人業の館: メニュー (魂の祭壇 / 魂合成 / 魂融合 / 魂分解 / パーティ編成 / 人業保管庫) ----
const MANSION_MENU = [
  { key: "altar", icon: "⛓", name: "魂の祭壇", desc: "宿す魂の付け替えと強化" },
  { key: "party", icon: "🛡", name: "パーティ編成", desc: "迷宮へ連れて行く6体を選ぶ" },
  { key: "manage", icon: "🏚", name: "人業保管庫", desc: "魂を宿して人業を仕立てる・名前変更" },
];

function renderMansion() {
  const sub = G.town.sub;
  if (sub === "party") return renderMansionParty();
  if (sub === "altar") return renderAltar();
  if (sub === "manage") return renderMansionManage();

  townEl.appendChild(townHeader("人業の館"));
  townEl.appendChild(el("div", "tw-lead", "人型の器「人業（Doll）」を仕立て、魂を宿して鍛える訓練所。宿す魂は祭壇で付け替えられる。"));
  const tutM = G.msq && G.msq.n === 0 && G.msq.state === "active";
  const grid = el("div", "tw-plates");
  for (const m of MANSION_MENU) {
    // 第0章 (人業の生成) の間は「人業保管庫」のみ開放。残りはロック＆グレーアウト
    const locked = tutM && m.key !== "manage";
    grid.appendChild(facPlate(m.key, m.name, m.desc, {
      locked, lockDesc: "人業を生むまで開かない", wide: m.key === "manage",
      onClick: () => { SFX.select(); G.town.sub = m.key; altarSel = null; renderTown(); },
    }));
  }
  townEl.appendChild(grid);
}

// 館サブ: パーティ編成 (編成 ⇄ 控え の入れ替え + ▲▼で隊列の並び替え)
function renderMansionParty() {
  townEl.appendChild(townHeader("パーティ編成", "mansion"));
  townEl.appendChild(el("div", "tw-lead", "迷宮へ連れて行く人業は最大6体。上の3人が前衛、4人目からは後衛。タップで編成⇄控え、▲▼で並び替え。"));

  townEl.appendChild(el("div", "tw-h", `編成 (${G.party.length}/6) — タップで控えへ`));
  const pl = el("div", "tw-mlist");
  if (!G.party.length) pl.appendChild(el("div", "tw-empty", "誰もいない。控えから加えよう。"));
  G.party.forEach((d, i) => {
    // 前衛/後衛の区切り見出し
    if (i === 0) pl.appendChild(el("div", "tw-rowdiv front", "⚔ 前衛 — 狙われやすい (重み3倍)"));
    if (i === 3) pl.appendChild(el("div", "tw-rowdiv back", "🛡 後衛 — 狙われにくく物理被ダメ半減・ただし物理与ダメも半減"));
    const row = rosterRow(d, () => {
      G.party.splice(G.party.indexOf(d), 1); G.reserve.push(d); SFX.select(); renderTown();
    });
    // ▲▼: 隣と入れ替えて隊列 (前衛/後衛) を編集する
    const mv = el("span", "tw-move");
    const mkMove = (txt, j) => {
      const b = el("button", "tw-moveb", txt);
      b.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const t = G.party[j]; G.party[j] = d; G.party[i] = t;
        SFX.select(); autosave(); renderTown();
      });
      return b;
    };
    if (i > 0) mv.appendChild(mkMove("▲", i - 1));
    if (i < G.party.length - 1) mv.appendChild(mkMove("▼", i + 1));
    row.appendChild(mv);
    pl.appendChild(row);
  });
  townEl.appendChild(pl);

  townEl.appendChild(el("div", "tw-h", `控え (${G.reserve.length}) — タップで編成へ`));
  const rl = el("div", "tw-mlist");
  if (!G.reserve.length) rl.appendChild(el("div", "tw-empty", "控えはいない。"));
  G.reserve.forEach((d) => rl.appendChild(rosterRow(d, () => {
    if (d.primary == null) { log("メイン魂を宿していない人業は編成できない。", "sys"); SFX.ng(); return; }
    if (G.party.length >= 6) { log("編成は満員だ (6体まで)。", "sys"); return; }
    G.reserve.splice(G.reserve.indexOf(d), 1); G.party.push(d); SFX.select(); renderTown();
  })));
  townEl.appendChild(rl);
}

// 編成行 (タップでトグル)
function rosterRow(d, onClick) {
  const row = el("div", "tw-mrow" + (d.alive ? "" : " dead"));
  const s = el("span", "tw-chips");
  if (d.dominant) { s.style.color = SOUL_CLASSES[d.dominant.clsKey].glow; s.appendChild(spriteCanvas(dollSprite(d), 2)); }
  row.appendChild(s);
  const info = el("div", "tw-chipi");
  info.appendChild(el("div", "tw-chipn", d.name + (d.alive ? "" : " †")));
  info.appendChild(el("div", "tw-chipc", d.primary == null ? "空の人業 ・ メイン魂なし" : `${d.cls} 魂Lv${d.jobLv || 1}`));
  row.appendChild(info);
  row.appendChild(
    d.primary == null ? el("div", "tw-chiphp", "編成不可") :
    d.alive ? el("div", "tw-chiphp", `HP ${d.hp}/${d.maxhp}`) :
    reviveTimerEl("div", "tw-chiphp", "⏳", d));
  row.addEventListener("click", onClick);
  return row;
}

// 魂の成長で職業スキルが新たに解放されたら、お知らせポップアップを出す。
// before = 強化前の習得スキル一覧 (recalcDoll 済みの owner.spells と比較する)
function notifyNewSkills(d, before) {
  if (!before) return;
  const gained = (d.spells || []).filter((k) => !before.includes(k));
  if (gained.length) showSkillUnlockPopup(d, gained);
}

// 新スキル習得のお知らせカード: 使えるようになった技の名前と説明を一覧する
function showSkillUnlockPopup(d, keys, onClose) {
  const accent = "#ffcf4a";
  const wrap = el("div", "confirm-overlay");
  const card = el("div", "ig-card cdx-detail");
  card.style.borderColor = accent;
  card.style.boxShadow = `0 0 40px ${accent}55`;
  const ban = el("div", "ig-banner", "✦ 新スキル習得 ✦");
  ban.style.color = accent;
  card.appendChild(ban);
  const art = el("div", "ig-art");
  art.appendChild(spriteCanvas(dollSprite(d), 9));
  card.appendChild(art);
  card.appendChild(el("div", "ig-name", d.name));
  card.appendChild(el("div", "cdx-elem", `${d.cls} キャラLv${d.jobLv || 1}`));
  card.appendChild(el("div", "ig-desc", "魂の成長により、新たな技に目覚めた！"));
  const box = el("div", "cdx-drops");
  for (const k of keys) {
    const sp = SPELLS[k];
    if (!sp) continue;
    const r = el("div", "cdx-drow cdx-sktap");
    r.appendChild(el("span", "cdx-dn", sp.name));
    r.appendChild(el("span", "cdx-skd", `${sp.desc} (MP${sp.mp})`));
    r.addEventListener("click", () => showSkillPopup(k));
    box.appendChild(r);
  }
  card.appendChild(box);
  card.appendChild(el("div", "cdx-dun dim", "・技名をタップすると詳しい効果を確認できる"));
  const close = () => { wrap.remove(); if (onClose) onClose(); };
  const ok = btn("閉じる", close);
  ok.className = "btn primary ig-ok";
  card.appendChild(ok);
  wrap.appendChild(card);
  wrap.addEventListener("click", (e) => { if (e.target === wrap) close(); });
  document.body.appendChild(wrap);
}

// 館サブ: 人業の作成・管理 (購入・解体)
function renderMansionManage() {
  townEl.appendChild(townHeader("人業保管庫", "mansion"));
  townEl.appendChild(el("div", "tw-lead", "赤い魂で器を買い、宿す魂をひとつ選んで人業を仕立てる。名を与えれば編成に加えられる。"));

  const list = el("div", "tw-mlist");
  allDolls().forEach((d) => {
    const inParty = G.party.includes(d);
    const row = el("div", "tw-mrow" + (d.alive ? "" : " dead"));
    const s = el("span", "tw-chips");
    if (d.dominant) { s.style.color = SOUL_CLASSES[d.dominant.clsKey].glow; s.appendChild(spriteCanvas(dollSprite(d), 2)); }
    row.appendChild(s);
    const info = el("div", "tw-chipi");
    info.appendChild(el("div", "tw-chipn", d.name + (d.alive ? "" : " †") + (d.isEmpty ? "（未生成）" : inParty ? "" : " (控え)")));
    info.appendChild(el("div", "tw-chipc", d.primary == null
      ? "空の人業 — 祭壇でメイン魂を宿すと人業として生成できる"
      : `${d.cls} 魂Lv${d.jobLv || 1}${(d.subs || []).length ? ` ・ サブ${d.subs.length}` : ""}`));
    row.appendChild(info);
    const ren = btn("名前を変える", () => showRenameInput(d));
    ren.className = "tw-small";
    row.appendChild(ren);
    list.appendChild(row);
  });
  townEl.appendChild(list);

  const cost = emptyDollCost();
  const add = btn(`＋ 人業を仕立てる ${cost ? `(🔴${cost})` : "(無料)"}`, () => buyDoll());
  add.className = "btn tw-add";
  if (G.redSoul < cost) add.disabled = true;
  townEl.appendChild(add);
  townEl.appendChild(el("div", "tw-note",
    "宿す魂をひとつ選んで器を買い、名を与えると人業が生まれる。"));
  townEl.appendChild(el("div", "tw-note",
    `費用: 最初の3体まで無料 / 4体目 🔴30 / 5体目 🔴50 / 6体目以降 🔴100　（所持上限 100体）`));
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

// 人業保管庫: 宿す魂を選び (必須)、赤い魂で人業を仕立てる
function buyDoll() {
  const cost = emptyDollCost();
  if (G.redSoul < cost) { log("Red Soul が足りない。", "sys"); SFX.ng(); return; }
  if (allDolls().length >= 100) { log("これ以上は仕立てられない (100体まで)。", "sys"); SFX.ng(); return; }
  // 宿せる魂 = まだどの人業も宿していない魂。選ばないと購入できない
  const free = G.souls.filter((s) => !soulWorn(s.uid)).sort(soulSortCmp);
  if (!free.length) {
    log("宿せる魂がない。先に魂を集めよう。", "sys"); SFX.ng();
    showToast("魂を持っていない");
    return;
  }
  const options = free.map((s) => {
    const rank = soulRankOf(s);
    return { label: `${soulSeriesName(s.clsKey)}の魂 Lv${s.level}`, fn: () => askDollName(s.uid) };
  });
  options.push({ label: "やめる", fn: () => {} });
  showChoice("どの魂を宿す？", options, ICONS.wisp,
    { banner: "✦ 人業を仕立てる ✦", lines: [cost ? `赤い魂 🔴${cost} で器を買い、選んだ魂を宿す` : "無料で器を買い、選んだ魂を宿す"] });
}

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

// 宿す魂を選んだあと: 名を与えて人業を生成する
function askDollName(uid) {
  const s = soulByUid(uid); if (!s) return;
  const cost = emptyDollCost();
  showNameInput({
    title: "人業に名を与える",
    desc: `${soulSeriesName(s.clsKey)}の魂を宿す器に、名を与えよ。名はあとから変更できる。`,
    placeholder: "人業の名前",
    defaultValue: randomDollName(),
    confirmLabel: cost ? `生成する (🔴${cost})` : "生成する (無料)",
    onConfirm: (name) => finalizeBuyDoll(uid, name),
    cancelLabel: "やめる",
    randomName: randomDollName,
  });
}

// 魂と名前が決まったら、赤い魂を支払って人業を生成し、編成に加える
function finalizeBuyDoll(uid, name) {
  const cost = emptyDollCost();
  const s = soulByUid(uid);
  if (G.redSoul < cost) { log("Red Soul が足りない。", "sys"); SFX.ng(); return; }
  if (!s || soulWorn(s.uid)) { log("その魂は宿せない。", "sys"); SFX.ng(); return; }
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
  showToast(`✦ 人業「${d.name}」誕生`);
  autosave(true);
  renderTown();
}

function confirmDisband(d) {
  const lines = ["吸収した魂と育成状態は失われる。", "装備していた品も失われる。"];
  showConfirm({
    title: `${d.name} を解体する？`,
    lines,
    okLabel: "🔨 解体する",
    onOk: () => {
      const pi = G.party.indexOf(d);
      if (pi >= 0) G.party.splice(pi, 1);
      const ri = G.reserve.indexOf(d);
      if (ri >= 0) G.reserve.splice(ri, 1);
      log(`${d.name} を解体した。`, "sys");
      renderTown();
    },
  });
}

// 名前入力モーダル (confirm-overlayと同じレイヤ)
function showNameInput({ title, desc, placeholder, defaultValue = "", confirmLabel = "決定", onConfirm, cancelLabel = null, onCancel = null, randomName = null }) {
  const wrap = el("div", "confirm-overlay");
  const card = el("div", "ig-card confirm-card");
  card.style.borderColor = "#c9a227";
  card.style.boxShadow = "0 0 40px #c9a22755";
  const bn = el("div", "ig-banner", "✦ 人業生成 ✦");
  bn.style.color = "#c9a227";
  card.appendChild(bn);
  card.appendChild(el("div", "ig-name", title));
  if (desc) card.appendChild(el("div", "ig-desc", desc));
  const inp = document.createElement("input");
  inp.type = "text";
  inp.className = "name-input";
  inp.placeholder = placeholder || "名前を入力";
  inp.value = defaultValue;
  inp.maxLength = 12;
  card.appendChild(inp);
  if (randomName) {
    const rnd = btn("🎲 ランダムな名前", () => { inp.value = randomName(); inp.focus(); });
    rnd.className = "tw-small";
    card.appendChild(rnd);
  }
  const list = el("div", "ig-choices");
  const okBtn = btn(confirmLabel, () => {
    const name = inp.value.trim();
    if (!name) { inp.focus(); return; }
    wrap.remove();
    onConfirm(name);
  });
  okBtn.classList.add("primary");
  list.appendChild(okBtn);
  if (cancelLabel) {
    const cancelBtn = btn(cancelLabel, () => { wrap.remove(); if (onCancel) onCancel(); });
    list.appendChild(cancelBtn);
  }
  card.appendChild(list);
  wrap.appendChild(card);
  document.body.appendChild(wrap);
  setTimeout(() => inp.focus(), 80);
}

// 名前変更ダイアログ
function showRenameInput(d) {
  showNameInput({
    title: "名前を変える",
    desc: null,
    placeholder: "新しい名前",
    defaultValue: d.name,
    confirmLabel: "変更する",
    onConfirm: (name) => {
      d.name = name;
      SFX.select();
      log(`人業の名前を「${name}」に変えた。`, "sys");
      autosave(true);
      renderTown();
    },
  });
}

// 魂吸収済みの空の人形→人業生成ポップアップ
function showGenerateDollPopup(d) {
  showNameInput({
    title: "人業を生成しますか？",
    desc: "魂が器に馴染み、人業が目覚めようとしている。名前を与えよ。",
    placeholder: "人業の名前",
    defaultValue: "",
    confirmLabel: "生成する",
    onConfirm: (name) => {
      d.name = name;
      d.isEmpty = false;
      const ri = G.reserve.indexOf(d);
      if (ri >= 0) G.reserve.splice(ri, 1);
      if (G.party.length < 6) G.party.push(d);
      else { G.reserve.push(d); log(`${d.name} は酒場で待機する。`, "sys"); }
      SFX.itemget(); buzz([0, 30, 60, 30]);
      log(`人業「${d.name}」が生まれた！`, "win");
      showToast(`✦ 人業「${d.name}」誕生`);
      autosave(true);
      renderTown();
    },
  });
}

// 職業 (clsKey) の表示順 = SOUL_CLASSES の定義順
const SOUL_CLASS_ORDER = Object.fromEntries(Object.keys(SOUL_CLASSES).map((k, i) => [k, i]));
// 祭壇の操作モード: "primary"(メイン魂) | "sub0"/"sub1"(サブ魂スロット)
let altarSlot = "primary";

// 祭壇スロットが指す魂インスタンス (なければ null)
function slotSoul(d, slotId) {
  if (slotId === "primary") return d.primary != null ? soulByUid(d.primary) : null;
  const sub = d.subs[+slotId.slice(3)];
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

// ---- 魂の祭壇: メイン魂を宿す/付け替え・サブ魂・✦Soulで魂を強化・控えの結社 ----
function renderAltar() {
  const dolls = allDolls();
  if (!altarSel || !dolls.includes(altarSel.doll)) altarSel = { doll: dolls[0] || null };
  if (!dolls.length) { townEl.appendChild(townHeader("魂の祭壇", "mansion")); townEl.appendChild(el("div", "tw-empty", "人業がいない。")); return; }
  const d = altarSel.doll;
  d.subs = d.subs || [];

  townEl.appendChild(townHeader("魂の祭壇", "mansion"));
  townEl.appendChild(el("div", "tw-lead", "本体は魂、人業は器。メイン魂が職業を決め、サブ魂スロットには別の魂が覚えた技を1つ借りられる。"));

  // 人業セレクタ
  const sel = el("div", "tw-dolltabs");
  dolls.forEach((dd) => {
    const label = dd.primary == null ? `${dd.name}（空の人業）` : dd.name;
    const t = btn(label, () => { altarSel = { doll: dd }; renderTown(); });
    t.className = "tw-dolltab" + (dd === d ? " active" : "") + (dd.primary == null ? " pending" : "");
    sel.appendChild(t);
  });
  townEl.appendChild(sel);

  // 空の人業: メイン魂を宿せば生成できる (旧セーブ互換)
  if (d.isEmpty) {
    if (d.primary != null) {
      const gen = btn("✦ 人業を生成する (名前を与える)", () => showGenerateDollPopup(d));
      gen.className = "btn primary tw-add";
      townEl.appendChild(gen);
    } else {
      townEl.appendChild(el("div", "tw-note", "空の人業 — メイン魂を宿すと人業として生成できる。下の「所持魂 一覧」から魂を選ぼう。"));
    }
  }

  // サマリ
  const pe = d.primary != null ? soulByUid(d.primary) : null;
  const sum = el("div", "tw-summary");
  sum.style.borderColor = pe ? SOUL_CLASSES[pe.clsKey].color : "#34344a";
  if (d.jobKey) {
    sum.style.cursor = "pointer"; sum.title = "職業図鑑を表示";
    sum.addEventListener("click", () => showCodexJobDetail(d.jobKey, d.jobRank));
  }
  sum.appendChild(el("div", "tw-sumc", d.cls));
  sum.appendChild(el("div", "tw-sumt", pe
    ? `ランク${d.jobRank} ・ 魂Lv${pe.level} ・ ${soulSeriesName(pe.clsKey)}の魂`
    : "メイン魂が宿っていない"));
  sum.appendChild(el("div", "tw-sumst",
    `HP${d.maxhp} MP${d.maxmp} ATK${d.atk} VIT${d.vit} AGI${d.agi} INT${d.int} PIE${d.pie} LUK${d.luk}`));
  if (d.spells.length) { const sk = skillChips(d.spells, "習得:"); sk.classList.add("tw-sumsk"); sum.appendChild(sk); }
  if (d.passives.length) sum.appendChild(el("div", "tw-sumsk", d.passives.join(" / ")));
  if (d.jobKey) sum.appendChild(el("div", "tw-sumhint", "▶ 職業図鑑"));
  townEl.appendChild(sum);

  // スロット (メイン魂 + サブ魂×MAX_SUBS)。タップで対象スロットを切替。サブ魂はスキル名も表示
  const slots = el("div", "tw-parts");
  const mkSlot = (id, label, inst, isSub, subRef) => {
    const slot = el("div", "tw-part" + (altarSlot === id ? " sel" : ""));
    slot.appendChild(el("div", "tw-partl", label));
    const orb = el("div", "tw-partorb");
    if (inst) {
      const rank = soulRankOf(inst);
      orb.style.color = SOUL_CLASSES[inst.clsKey].glow;
      orb.appendChild(spriteCanvas(jobSprite(inst.clsKey, Math.max(1, rank)), 3));
      slot.appendChild(orb);
      // キャラアイコン下の職業名 = 魂のランクに応じた称号 (見習い戦士 → 戦士 など)
      slot.appendChild(el("div", "tw-parts2", jobRankName(inst.clsKey, rank)));
      if (isSub) {
        const set = subRef && (subRef.passive || subRef.skill);
        const skName = subRef && subRef.passive ? passiveName(subRef.passive, soulLearnedPassives(inst)[subRef.passive] || 1)
          : (subRef && subRef.skill && SPELLS[subRef.skill] ? SPELLS[subRef.skill].name : "技を選ぶ");
        const skl = el("div", "tw-parts2" + (set ? "" : " dim"), `▶ ${skName}`);
        skl.style.cursor = "pointer";
        skl.addEventListener("click", (ev) => { ev.stopPropagation(); openSubSkillPicker(d, subRef); });
        slot.appendChild(skl);
      }
    } else {
      orb.appendChild(el("div", "tw-partempty", "空"));
      slot.appendChild(orb);
      slot.appendChild(el("div", "tw-parts2", "—"));
    }
    slot.addEventListener("click", () => { altarSlot = id; renderTown(); });
    slots.appendChild(slot);
  };
  mkSlot("primary", "メイン魂", pe, false, null);
  const subSlots = unlockedSubSlots();
  for (let i = 0; i < subSlots; i++) { const sub = d.subs[i] || null; mkSlot("sub" + i, `サブ魂${i + 1}`, sub ? soulByUid(sub.uid) : null, true, sub); }
  townEl.appendChild(slots);
  // 未解放のサブ魂枠は迷宮の踏破で開く (選択中スロットも開放済みに戻す)
  if (subSlots < MAX_SUBS) {
    const c = clearedDungeonCount();
    const nextAt = subSlots === 0 ? 10 : 40;
    townEl.appendChild(el("div", "tw-note",
      `宿し技スロット（サブ魂）はあと ${MAX_SUBS - subSlots} 枠、迷宮の踏破で開く。次の枠は ${nextAt} 迷宮の踏破で解放（現在 ${c} 踏破）。`));
    if (altarSlot !== "primary" && (+altarSlot.slice(3)) >= subSlots) altarSlot = "primary";
  }

  // 魂を強化 (選択中スロットのメイン魂/サブ魂に ✦Soul を注いでレベルを上げる)
  const selSoul = slotSoul(d, altarSlot);
  if (selSoul) {
    const cap = soulLevelCapOf(selSoul);
    const rank = soulRankOf(selSoul);
    townEl.appendChild(el("div", "tw-h", `魂を強化（${soulSeriesName(selSoul.clsKey)}の魂）`));
    const tb = el("div", "tw-trainbox");
    if (selSoul.level >= cap) {
      const nx = nextRankThreshold(selSoul.clsKey, selSoul.count);
      tb.appendChild(el("div", "tw-trainn", `Lv${selSoul.level}（上限）`));
      tb.appendChild(el("div", "tw-note", nx
        ? `同じ${SOUL_CLASSES[selSoul.clsKey].label}の魂をあと ${nx.next - selSoul.count} 体 吸収させてランク${rank + 1}になると上限が伸びる。`
        : "最高ランク。これ以上は上限が伸びない。"));
      if (selSoul.exp > 0) tb.appendChild(el("div", "tw-note", `蓄積 Soul ✦${selSoul.exp}（ランクUPで一気にLvへ反映される）`));
    } else {
      const need = Math.max(1, soulTrainCost(selSoul.level) - (selSoul.exp || 0));
      tb.appendChild(el("div", "tw-trainn", `Lv${selSoul.level} → Lv${selSoul.level + 1}`));
      tb.appendChild(el("div", "tw-note", `次のLvまで 必要Soul ${need}（所持 ✦${G.soulPts}）`));
      const b = btn(`✦ Soul ${need} で鍛える`, () => trainSoul(selSoul.uid));
      b.className = "tw-small primary";
      if (G.soulPts < need) b.disabled = true;
      tb.appendChild(b);
    }
    townEl.appendChild(tb);
  }

  // 魂のLv上限を上げる (メイン魂に「魂の残火」を捧げて上限を1伸ばす)
  if (altarSlot === "primary" && selSoul) {
    townEl.appendChild(el("div", "tw-h", "魂のLv上限を上げる"));
    const eb = el("div", "tw-trainbox");
    const baseCap = soulLevelCap(selSoul.clsKey, selSoul.count);
    const bonus = selSoul.capBonus || 0;
    eb.appendChild(el("div", "tw-trainn", `Lv上限 ${baseCap + bonus}` + (bonus ? `（+${bonus}）` : "")));
    eb.appendChild(el("div", "tw-note", `魂の残火を1つ捧げると、${soulSeriesName(selSoul.clsKey)}の魂のLv上限が +1 される。`));
    eb.appendChild(el("div", "tw-note", `所持: 🔥魂の残火 ${G.embers || 0}`));
    const b = btn("🔥 魂の残火 1 で上限+1", () => raiseSoulCap(selSoul.uid));
    b.className = "tw-small primary";
    if ((G.embers || 0) < 1) b.disabled = true;
    eb.appendChild(b);
    townEl.appendChild(eb);
  }

  // 所持魂 一覧: すべての魂インスタンス (職業→ランク→Lv順)。選択中スロットへ宿す
  const slotLabel = altarSlot === "primary" ? "メイン魂" : `サブ魂${(+altarSlot.slice(3)) + 1}`;
  townEl.appendChild(el("div", "tw-h", `所持魂 一覧 — ${slotLabel}スロットに宿す魂を選ぶ`));
  const list = el("div", "tw-soullist");
  const souls = [...G.souls].sort(soulSortCmp);
  if (!souls.length) list.appendChild(el("div", "tw-empty", "魂を持っていない。迷宮で集めよう。"));
  for (const s of souls) {
    const cls = SOUL_CLASSES[s.clsKey]; if (!cls) continue;
    const rank = soulRankOf(s);
    const cap = soulLevelCapOf(s);
    const isMain = d.primary === s.uid;
    const asSub = (d.subs || []).some((x) => x && x.uid === s.uid);
    const byOther = soulWornByOther(s.uid, d);
    const tag = isMain ? "（メイン魂）" : asSub ? "（サブ魂）" : byOther ? "（別の人業）" : "";
    const r = el("div", "tw-soulrow" + (cls.rarity !== "common" ? " rare" : "") + (byOther ? " dim" : ""));
    if (isMain || asSub) r.style.borderColor = cls.glow;
    const o = el("span", "tw-chips"); o.style.color = cls.glow; o.appendChild(spriteCanvas(jobSprite(s.clsKey, Math.max(1, rank)), 2));
    r.appendChild(o);
    const info = el("div", "tw-chipi");
    const nm = el("div", "tw-souln", `${soulSeriesName(s.clsKey)}の魂${tag}`);
    nm.style.color = cls.glow;
    info.appendChild(nm);
    const nx = nextRankThreshold(s.clsKey, s.count);
    info.appendChild(el("div", "tw-soulst",
      `Lv${s.level}/${cap}　ランク${rank}` + (nx ? `　（次ランクまで${nx.next - s.count}の魂が必要）` : "　（最高ランク）")));
    r.appendChild(info);
    // 吸収 (融合): 同職の余っている魂を取り込んでランクを上げる (D5 踏破で解放)
    const cands = featureUnlocked("fusion") ? fuseCandidates(s.uid) : [];
    if (cands.length) {
      const fb = btn(`吸収(${cands.length})`, (ev) => { ev.stopPropagation(); openFusePicker(s.uid); });
      fb.className = "tw-small";
      r.appendChild(fb);
    }
    r.addEventListener("click", () => equipSoulToSlot(d, s.uid));
    list.appendChild(r);
  }
  townEl.appendChild(list);

  // 控えの結社 (編成外の魂が供給するパーティ加護)
  renderOrderSection();
}

// 控えの結社の表示。編成に出していないランク2以上の魂がパーティ加護を供給する
function renderOrderSection() {
  const fielded = new Set();
  for (const dd of G.party) { if (dd.primary != null) fielded.add(dd.primary); for (const s of (dd.subs || [])) if (s) fielded.add(s.uid); }
  const benched = G.souls.filter((s) => !fielded.has(s.uid) && soulRankOf(s) >= 2).sort(soulSortCmp);
  townEl.appendChild(el("div", "tw-h", "控えの結社 — 編成外の魂の加護"));
  if (!featureUnlocked("order")) {
    townEl.appendChild(el("div", "tw-note",
      `控えの結社はまだ開かれていない。20 迷宮を踏破すれば、王が席を授ける。（現在 ${clearedDungeonCount()} 踏破）`));
    return;
  }
  const seats = orderSeats();
  const seated = orderSeatedUids();
  const seatedSet = new Set(seated);
  const full = seated.length >= seats;
  const nextSeatAt = seats >= 3 ? null : seats >= 2 ? 45 : seats >= 1 ? 30 : 20;
  townEl.appendChild(el("div", "tw-note",
    `結社の席: ${seated.length} / ${seats} 使用中${nextSeatAt ? `（次の席は ${nextSeatAt} 迷宮の踏破で開く）` : "（最大）"}`));
  if (!benched.length) {
    townEl.appendChild(el("div", "tw-note", "編成に出していない魂をランク2以上に育てると、席に着けて職業に応じたパーティ全体の加護を授けられる。"));
    return;
  }
  townEl.appendChild(el("div", "tw-note", "席に着けた魂だけが加護を送る。空席が許す数まで選んで着席させよ。編成に出すと加護は止まる(本人として働く)。同じ加護は最も高いLvだけが効く。"));
  // 実際に発動している加護 (着席魂を集約。同一加護は最大Lv) と、その提供元の魂
  const activeMap = orderPassiveMap(G.party, seated);
  const perkOf = (s) => ORDER_PERK[s.clsKey] || "";
  const perkLvOf = (s) => { const p = perkOf(s); return p && PASSIVES[p] ? Math.min(PASSIVES[p].lv.length, orderPerkLv(soulRankOf(s))) : 0; };
  const provider = {}; // perk -> 実際に加護を提供している魂uid (先着の最大Lv)
  for (const uid of seated) {
    const s = soulByUid(uid); if (!s) continue;
    const p = perkOf(s);
    if (p && perkLvOf(s) === activeMap[p] && provider[p] == null) provider[p] = uid;
  }
  if (seated.length) {
    const parts = Object.entries(activeMap).map(([p, lv]) => passiveName(p, lv));
    townEl.appendChild(el("div", "tw-note", `▸ 発動中の加護: ${parts.length ? parts.join("・") : "なし"}`));
  }
  // 着席優先 → 加護別グループ → ランク降順 (同じ加護が隣り合い、重複を見つけやすい)
  const sorted = benched.slice().sort((a, b) =>
    (seatedSet.has(b.uid) ? 1 : 0) - (seatedSet.has(a.uid) ? 1 : 0) ||
    perkOf(a).localeCompare(perkOf(b)) ||
    soulRankOf(b) - soulRankOf(a) || soulSortCmp(a, b));
  const box = el("div", "tw-soullist");
  for (const s of sorted) {
    const cls = SOUL_CLASSES[s.clsKey];
    const perk = ORDER_PERK[s.clsKey];
    const rank = soulRankOf(s);
    if (!perk || !PASSIVES[perk]) continue;
    const lv = Math.min(PASSIVES[perk].lv.length, orderPerkLv(rank));
    const isSeated = seatedSet.has(s.uid);
    const redundant = isSeated && provider[perk] !== s.uid; // 上位/先着が着席中で、この席は無駄
    const r = el("div", "tw-soulrow");
    if (isSeated) { r.style.borderLeft = `3px solid ${redundant ? "#7a7a7a" : cls.glow}`; r.style.paddingLeft = "5px"; if (redundant) r.style.opacity = "0.7"; }
    const o = el("span", "tw-chips"); o.style.color = cls.glow; o.appendChild(spriteCanvas(jobSprite(s.clsKey, rank), 2));
    r.appendChild(o);
    const info = el("div", "tw-chipi");
    info.appendChild(el("div", "tw-souln", `${jobRankName(s.clsKey, rank)}（R${rank}）${isSeated ? (redundant ? " ・ 着席中(重複)" : " ・ 着席中") : ""}`));
    info.appendChild(el("div", "tw-soulst", `${passiveName(perk, lv)}: ${passiveDesc(perk, lv)}`));
    if (redundant) info.appendChild(el("div", "tw-soulst", "※ 同じ加護をより高い席が供給中。外して別の加護に回せる。"));
    r.appendChild(info);
    const b = btn(isSeated ? "外す" : "着席", () => toggleOrderSeat(s.uid));
    b.className = "tw-small" + (isSeated ? "" : " primary");
    if (!isSeated && full) { b.disabled = true; b.className = "tw-small"; }
    r.appendChild(b);
    box.appendChild(r);
  }
  townEl.appendChild(box);
}

function jobSig(d) { return d.jobKey ? `${d.jobKey}:${d.jobRank}` : "none"; }
function announceJobChange(d, before) {
  if (!d.jobKey || jobSig(d) === before) return;
  SFX.victory(); buzz([0, 30, 50, 30]);
  showCodexJobDetail(d.jobKey, d.jobRank, `${d.name} は ${d.cls} になった！`);
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

// 実際に魂をスロットへ宿す/外す処理 (装備の事前確認を通過した後に呼ぶ)
function applyEquipSoul(d, uid, s) {
  const before = jobSig(d);
  if (altarSlot === "primary" && d.primary === uid) {
    d.primary = null; // 同じ魂をタップで外す
  } else if (altarSlot !== "primary" && (d.subs[+altarSlot.slice(3)] || {}).uid === uid) {
    d.subs.splice(+altarSlot.slice(3), 1); // 同じ魂をタップで外す
    d.subs = d.subs.filter(Boolean);
  } else {
    // 同じ人業の他スロットからは外す (二重装備しない)
    if (d.primary === uid) d.primary = null;
    d.subs = (d.subs || []).filter((x) => x && x.uid !== uid);
    if (altarSlot === "primary") {
      d.primary = uid;
    } else {
      const learned = soulLearnedSkills(s);
      d.subs[+altarSlot.slice(3)] = { uid, skill: learned.length ? learned[learned.length - 1] : null };
      d.subs = d.subs.filter(Boolean);
    }
  }
  recalcDoll(d);
  d.hp = Math.min(d.hp, d.maxhp); d.mp = Math.min(d.mp, d.maxmp);
  SFX.select(); buzz(15);
  renderTown();
  announceJobChange(d, before);
}

// 選択中スロットに魂を宿す/外す (メイン魂=転職、サブ魂=技の借用)。魂は1体ごとに固有
function equipSoulToSlot(d, uid) {
  const s = soulByUid(uid);
  if (!s) return;
  // 別スロットへ宿す (=付け替え) 場合のみ装備可否を判定する。タップで外す操作は対象外
  const isNewEquip = !(altarSlot === "primary" && d.primary === uid)
    && !(altarSlot !== "primary" && (d.subs[+altarSlot.slice(3)] || {}).uid === uid);
  if (isNewEquip && soulWornByOther(uid, d)) { log("他の人業が宿している魂は宿せない。", "sys"); SFX.ng(); return; }

  // メイン魂の付け替えで、新しい職では装備できなくなる装備があれば事前に確認する
  if (isNewEquip && altarSlot === "primary" && d.primary !== uid) {
    const bad = unequippableUnder(d, s.clsKey);
    if (bad.length) {
      const free = MAX_ITEMS - d.items.length;
      const names = bad.map((b) => `・${b.item.name}（${SLOT_LABEL[b.key] || b.key}）`);
      if (bad.length > free) {
        // 外した装備を持ち物に入れる空きが足りない → 付け替えを中止
        showEvent({
          sprite: jobSprite(s.clsKey, Math.max(1, soulRankOf(s))),
          banner: "⚠ 付け替えできない ⚠",
          title: "持ち物がいっぱいです",
          lines: [
            `${soulSeriesName(s.clsKey)}の魂 に付け替えると、次の装備が外れます。`,
            ...names,
            `しかし ${d.name} の持ち物に空きが ${free} 枠しかありません。`,
            "持ち物を減らしてから、もう一度付け替えてください。",
          ],
          accent: "#d4504e",
          btnLabel: "とじる",
          onClose: () => renderTown(),
        });
        SFX.ng();
        return;
      }
      showConfirm({
        title: `${soulSeriesName(s.clsKey)}の魂 に付け替えますか？`,
        lines: [
          "新しい職では次の装備を扱えないため、外して持ち物に戻します。",
          ...names,
        ],
        okLabel: "付け替える",
        onOk: () => {
          // 装備できない装備を外して持ち物へ戻す
          for (const b of bad) { d.equip[b.key] = null; d.items.push(b.item); }
          applyEquipSoul(d, uid, s);
        },
      });
      return;
    }
  }

  applyEquipSoul(d, uid, s);
}

// サブ魂が借りる技/パッシブを選ぶポップアップ (その魂が覚えているスキル・パッシブから1つ)
function openSubSkillPicker(d, subRef) {
  if (!subRef) return;
  const s = soulByUid(subRef.uid); if (!s) return;
  const learned = soulLearnedSkills(s);
  const passives = soulLearnedPassives(s);
  const pkeys = Object.keys(passives);
  if (!learned.length && !pkeys.length) { log("この魂はまだ技もパッシブも覚えていない。", "sys"); SFX.ng(); return; }
  const apply = () => { recalcDoll(d); d.hp = Math.min(d.hp, d.maxhp); d.mp = Math.min(d.mp, d.maxmp); SFX.select(); renderTown(); };
  const opts = [];
  // 技 (アクティブスキル)
  for (const sk of learned) opts.push({
    label: `⚔ ${SPELLS[sk] ? SPELLS[sk].name : sk}${(subRef.skill === sk && !subRef.passive) ? "（設定中）" : ""}`,
    fn: () => { subRef.skill = sk; subRef.passive = null; apply(); },
  });
  // パッシブ
  for (const pk of pkeys) opts.push({
    label: `◆ ${passiveName(pk, passives[pk])}${subRef.passive === pk ? "（設定中）" : ""}`,
    fn: () => { subRef.passive = pk; subRef.skill = null; apply(); },
  });
  opts.push({ label: "やめる", fn: () => {} });
  showChoice(`${soulSeriesName(s.clsKey)}の魂 — 宿す技・パッシブを選ぶ`, opts,
    jobSprite(s.clsKey, Math.max(1, soulRankOf(s))),
    { banner: "✦ サブ魂の宿し技 ✦", accent: SOUL_CLASSES[s.clsKey].glow });
}

// 融合: target に同職の余っている魂を吸収させる候補
function fuseCandidates(targetUid) {
  const t = soulByUid(targetUid); if (!t) return [];
  return G.souls.filter((s) => s.uid !== t.uid && s.clsKey === t.clsKey && !soulWorn(s.uid));
}
// 吸収する魂を選ぶポップアップ
function openFusePicker(targetUid) {
  const t = soulByUid(targetUid); if (!t) return;
  if (!featureUnlocked("fusion")) { log("魂の融合はまだ授かっていない。", "sys"); SFX.ng(); return; }
  const cands = fuseCandidates(targetUid).sort(soulSortCmp);
  if (!cands.length) { log("吸収できる同職の魂がない。", "sys"); SFX.ng(); return; }
  const opts = cands.map((c) => ({
    label: `${soulSeriesName(c.clsKey)}の魂 Lv${c.level}（魂数${c.count}）`,
    // すでに融合済み (魂数2以上) の魂を素材にする場合は、誤って消費しないよう警告する
    fn: () => {
      if (c.count > 1) {
        showConfirm({
          title: "融合済みの魂を素材にしますか？",
          lines: [
            `この ${soulSeriesName(c.clsKey)}の魂 は ${c.count} 体ぶんを融合した魂です。`,
            "素材にすると、この魂とその魂数・蓄積した Soul はすべて失われます。",
          ],
          okLabel: "素材にする",
          onOk: () => fuseSoul(targetUid, c.uid),
        });
      } else {
        fuseSoul(targetUid, c.uid);
      }
    },
  }));
  opts.push({ label: "やめる", fn: () => {} });
  showChoice(`${soulSeriesName(t.clsKey)}の魂に吸収させる魂を選ぶ`, opts,
    jobSprite(t.clsKey, Math.max(1, soulRankOf(t))),
    { banner: "✦ 魂の吸収 ✦", accent: SOUL_CLASSES[t.clsKey].glow, lines: ["吸収した魂は失われ、魂数がランクに加算される。"] });
}
// 実際の融合: consume を消し、その魂数を target に加える
function fuseSoul(targetUid, consumeUid) {
  const t = soulByUid(targetUid), c = soulByUid(consumeUid);
  if (!t || !c || c.clsKey !== t.clsKey || soulWorn(c.uid)) { SFX.ng(); return; }
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
  recalcAllDolls();
  codexJobSee(t.clsKey, t.count, t.level);
  const after = soulRankOf(t);
  SFX.itemget(); buzz([0, 30, 50, 30]);
  log(`${SOUL_CLASSES[t.clsKey].label}の魂を吸収させた (魂数 ×${t.count})。`, "win");
  if (t.level > beforeLv) log(`蓄積した Soul が反映され、Lv${beforeLv} → Lv${t.level} に上昇した！`, "win");
  // ランクが上がったときは、昇格の感動を最大化する専用ポップアップを見せる。
  if (after > before) {
    log(`⤴ ${jobRankName(t.clsKey, after)} に昇格！`, "win");
    showRankUp(
      { clsKey: t.clsKey, fromRank: before, toRank: after, fromLv: beforeLv, toLv: t.level, count: t.count },
      () => renderTown()
    );
    return;
  }
  // ランク据え置きの融合: 魂の輝きが増したことと、全能力の上昇率を伝える
  const pct = Math.round((SOUL_STAT_UP[SOUL_CLASSES[t.clsKey].rarity] || 0.01) * 100);
  const lines = [`全能力が基礎値の ${pct}% ずつ高まる（魂数 ${t.count}）`];
  if (t.level > beforeLv) lines.push(`蓄積した Soul が反映され Lv${beforeLv} → Lv${t.level}`);
  showEvent({
    sprite: jobSprite(t.clsKey, after),
    banner: "✦ 魂の融合 ✦",
    title: `${soulSeriesName(t.clsKey)}の魂の輝きが増した`,
    lines,
    accent: SOUL_CLASSES[t.clsKey].glow,
    sparkle: true,
    btnLabel: "受け取る",
    onClose: () => renderTown(),
  });
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

// 魂インスタンスを ✦Soul でレベルアップ (その魂を宿す人業が伸びる)
function trainSoul(uid) {
  const e = soulByUid(uid);
  if (!e) return;
  const cap = soulLevelCapOf(e);
  if (e.level >= cap) { log("これ以上レベルを上げられない。", "sys"); SFX.ng(); return; }
  const cost = Math.max(1, soulTrainCost(e.level) - (e.exp || 0));
  if (G.soulPts < cost) { log("Soul が足りない。", "sys"); SFX.ng(); return; }
  const wearer = allDolls().find((d) => d.primary === uid || (d.subs || []).some((s) => s && s.uid === uid));
  const STAT_KEYS = ["maxhp", "maxmp", "atk", "vit", "agi", "int", "pie", "luk"];
  const STAT_LABEL = { maxhp: "HP", maxmp: "MP", atk: "ATK", vit: "VIT", agi: "AGI", int: "INT", pie: "PIE", luk: "LUK" };
  const beforeStat = wearer ? Object.fromEntries(STAT_KEYS.map((k) => [k, wearer[k] || 0])) : null;
  const beforeSpells = new Set(wearer ? (wearer.spells || []) : []);
  G.soulPts -= cost;
  e.level++; e.exp = 0;
  recalcAllDolls();
  codexJobSee(e.clsKey, e.count, e.level);
  SFX.levelup(); buzz([0, 30, 40, 30]);
  log(`${soulSeriesName(e.clsKey)}の魂が Lv${e.level} に成長した！ (✦${cost})`, "win");
  // 魂のレベルアップを宿主の上昇ステータス・習得スキルとともにポップアップ表示
  const deltas = [];
  if (wearer && beforeStat) for (const k of STAT_KEYS) { const d = (wearer[k] || 0) - beforeStat[k]; if (d > 0) deltas.push(`${STAT_LABEL[k]} +${d}`); }
  const gainedSkills = wearer ? (wearer.spells || []).filter((k) => !beforeSpells.has(k)) : [];
  const lines = [`${wearer ? wearer.name + " の" : ""}全能力が高まった`];
  lines.push(deltas.length ? deltas.join("  ") : "ステータスはそのまま");
  // スキル習得はレベルアップのポップアップには載せず、閉じた後に別カードで知らせる
  const afterLevel = () => {
    if (wearer && gainedSkills.length) showSkillUnlockPopup(wearer, gainedSkills, () => renderTown());
    else renderTown();
  };
  showEvent({
    sprite: wearer ? dollSprite(wearer) : jobSprite(e.clsKey, soulRankOf(e)),
    banner: "⤴ 魂レベルアップ ⤴",
    title: `${soulSeriesName(e.clsKey)}の魂が Lv${e.level} になった！`,
    lines,
    accent: SOUL_CLASSES[e.clsKey].glow,
    sparkle: true,
    btnLabel: "受け取る",
    onClose: afterLevel,
  });
}

// 魂の残火でメイン魂のLv上限を1上げる (上限は capBonus に蓄積される)
function raiseSoulCap(uid) {
  const e = soulByUid(uid);
  if (!e) return;
  if ((G.embers || 0) < 1) { log("魂の残火が足りない。", "sys"); SFX.ng(); return; }
  G.embers -= 1;
  e.capBonus = (e.capBonus || 0) + 1;
  recalcAllDolls();
  updateTopbar();
  const cap = soulLevelCapOf(e);
  SFX.levelup(); buzz([0, 30, 50, 30]);
  log(`魂の残火を捧げ、${soulSeriesName(e.clsKey)}の魂のLv上限が ${cap} になった。`, "win");
  showEvent({
    sprite: ICONS.ember,
    banner: "🔥 魂のLv上限上昇 🔥",
    title: `${soulSeriesName(e.clsKey)}の魂のLv上限が +1`,
    lines: [`Lv上限が ${cap} になった。`, `残り 🔥魂の残火 ${G.embers}`],
    accent: "#ff9a3a",
    sparkle: true,
    btnLabel: "受け取る",
    onClose: () => renderTown(),
  });
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

// ---- 日替わりクエスト ----
// dailySeed から決定的に3件生成する。日付が変わると未消化でも入れ替わる。
// 報酬は現在の到達ランク帯に応じてスケールする
function seededRand(seed) {
  let s = seed >>> 0;
  return () => {
    s = Math.imul(s ^ (s >>> 15), 2246822519) >>> 0;
    s = Math.imul(s ^ (s >>> 13), 3266489917) >>> 0;
    return ((s ^= s >>> 16) >>> 0) / 4294967296;
  };
}
function genDailyQuests() {
  const seed = dailySeed();
  const rnd = seededRand(seed * 2654435761 + 7);
  const band = Math.max(1, Math.ceil((G.unlockedDungeons || 1) / 10)); // 到達ランク帯 (1-10)
  // 討伐対象: 解放済みランク帯に実際に出現する種族から選ぶ
  const races = [...new Set(Object.values(MONSTERS).filter((m) => (m.rank || 1) <= band && !m.boss && m.race).map((m) => m.race))];
  const race = races[Math.floor(rnd() * races.length)] || "beast";
  const kg = 3 + Math.floor(rnd() * 3);
  const sg = 2 + Math.floor(rnd() * 2);
  const list = [
    { id: `dq_kill_${seed}`, name: `${RACE_LABEL[race] || race}狩り`, desc: `${RACE_LABEL[race] || race}を ${kg}体 倒す`, type: "kill", race, goal: kg,
      reward: { gold: (60 + Math.floor(rnd() * 40)) * band, soulPts: 25 * band }, daily: true, state: "avail", progress: 0 },
    { id: `dq_soul_${seed}`, name: "魂の供給", desc: `魂を ${sg}個 回収する`, type: "soul", goal: sg,
      reward: { gold: 80 * band, soulPts: 40 * band }, daily: true, state: "avail", progress: 0 },
    { id: `dq_boss_${seed}`, name: "主討ち", desc: "いずれかの迷宮の主を 1体 討つ", type: "boss", goal: 1,
      reward: { gold: 150 * band, redSoul: 5 }, daily: true, state: "avail", progress: 0 },
  ];
  return { seed, list };
}
function ensureDailyQuests() {
  if (!G.dailyQuests || G.dailyQuests.seed !== dailySeed() || !Array.isArray(G.dailyQuests.list)) G.dailyQuests = genDailyQuests();
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
    const cl = SOUL_CLASSES[clsKey].label;
    return { type: "harvest", clsKey, great, floor: 1, speaker,
      text: `「${dn}の入口あたりで、まだあたたかい〈${cl}〉の死体を見た。${great ? "並の魂ではないぞ。" : "魂が宿っているはずだ。"}」` };
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

// ---- 酒場の納品依頼: 求められた品を納めると、その品の格 (R1-20) に応じて職業の魂を授かる ----
// 対象は「今 到達している深さまでに出現しうる品」からランダム3件。LR/専用装備は除外
// (LOOT_IDS が exclusive を弾く)。常時最大3件で、迷宮に潜るたびに入れ替わる (rollDeliveryQuests)。
const DELIVERY_BANDS = [
  // max(R20) : [ [rarity, 体数, 確率], … ] (確率は合計1.0)
  { max: 5,  rows: [["common", 2, 0.70], ["rare", 1, 0.20], ["epic", 1, 0.09], ["legend", 1, 0.01]] },
  { max: 10, rows: [["common", 3, 0.60], ["rare", 2, 0.25], ["epic", 1, 0.13], ["legend", 1, 0.02]] },
  { max: 15, rows: [["common", 4, 0.45], ["rare", 2, 0.30], ["epic", 1, 0.20], ["legend", 1, 0.05]] },
  { max: 20, rows: [["common", 5, 0.40], ["rare", 3, 0.30], ["epic", 2, 0.20], ["legend", 1, 0.10]] },
];
function deliveryBand(r20) { return DELIVERY_BANDS.find((b) => r20 <= b.max) || DELIVERY_BANDS[DELIVERY_BANDS.length - 1]; }
// 報酬を1つ抽選: [rarity, 体数]
function rollDeliveryReward(r20) {
  let r = Math.random();
  for (const [rarity, count, p] of deliveryBand(r20).rows) { if ((r -= p) < 0) return [rarity, count]; }
  const last = deliveryBand(r20).rows[deliveryBand(r20).rows.length - 1];
  return [last[0], last[1]];
}
// 報酬テーブルの表示文
function deliveryRewardDesc(r20) {
  return deliveryBand(r20).rows.map(([rar, c, p]) => `${RARITY_LABEL[rar]}魂×${c} (${Math.round(p * 100)}%)`).join(" / ");
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
// 納品を実行: 手持ちから1つ消費し、品の格に応じた魂を授かる
function deliverQuest(q) {
  const it = ITEMS[q.itemId];
  if (!it) return;
  const holder = deliveryHolder(q.itemId);
  if (!holder) { log("納品できる品が手元にない。", "sys"); SFX.ng(); return; }
  const i = holder.items.findIndex((x) => x.id === q.itemId && !x.unidentified);
  if (i < 0) { log("納品できる品が手元にない。", "sys"); SFX.ng(); return; }
  holder.items.splice(i, 1);
  recalcDoll(holder); holder.hp = Math.min(holder.hp, holder.maxhp); holder.mp = Math.min(holder.mp, holder.maxmp);
  const [rarity, count] = rollDeliveryReward(it.r20 || 1);
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
    sprite: jobSprite(got[0], 1),
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

function renderTavern() {
  townEl.appendChild(townHeader("酒場「沈まぬ灯」"));
  townEl.appendChild(el("div", "tw-lead", "迷宮帰りの流れ者がたむろする。世界の噂や冒険のヒントを聞ける。(編成は人業の館)"));

  // ===== 1) 酒場の噂話 (最上段) =====
  // 噂を扱えるのは「名の知れた魂繰り」(15迷宮踏破) から。未解放でも見出しと案内は出す。
  townEl.appendChild(el("div", "tw-h", "酒場の噂話"));
  if (!featureUnlocked("rumor")) {
    const lockBox = el("div", "tw-rumor");
    lockBox.appendChild(el("div", "tw-rumors", "― まだ噂は回ってこない ―"));
    lockBox.appendChild(el("div", "tw-rumort", `情報屋が噂を回すのは、名の知れた魂繰りが現れてからだ。15 迷宮を踏破すれば、腰を上げよう。（現在 ${clearedDungeonCount()} 踏破）`));
    townEl.appendChild(lockBox);
  } else if (G.rumor) {
    const rb = el("div", "tw-rumor");
    rb.appendChild(el("div", "tw-rumors", `― ${G.rumor.speaker} ―`));
    rb.appendChild(el("div", "tw-rumort", G.rumor.text));
    const noteText = G.rumor.info
      ? "これは盤面に現れる話ではない。だが備えあれば憂いなし、だ。"
      : "この噂は、次に潜る迷宮で現実になる。";
    rb.appendChild(el("div", "tw-note", noteText));
    townEl.appendChild(rb);
  } else {
    const now = Date.now();
    const coolLeft = (G.rumorCooldown || 0) - now;
    if (coolLeft > 0) {
      const mins = Math.ceil(coolLeft / 60000);
      const coolBox = el("div", "tw-rumor");
      coolBox.appendChild(el("div", "tw-rumors", "― しばらく待て ―"));
      coolBox.appendChild(el("div", "tw-rumort", `情報屋はまだ動いていない。あと約 ${mins} 分後に話せる。`));
      townEl.appendChild(coolBox);
    } else {
      townEl.appendChild(el("div", "tw-note", `100ゴールドで噂話を一つ聞ける。情報屋は今 選んでいる迷宮（${curDungeon().name}）を読む。盤面の予兆は次の潜入で現実になり、属性や主の噂は備えの助けになる。`));
      const listenBtn = btn("🍺 噂を聞く (💰100)", () => {
        if (G.gold < 100) { log("ゴールドが足りない。", "bad"); SFX.ng(); return; }
        G.gold -= 100;
        G.rumor = rollRumor();
        G.rumorCooldown = Date.now() + 30 * 60 * 1000;
        SFX.select();
        autosave(true);
        renderTown();
      });
      listenBtn.className = "btn tw-add";
      townEl.appendChild(listenBtn);
    }
  }

  // ===== 2) 納品依頼 (中段): 求められた品を納めると、品の格に応じた職業の魂が手に入る =====
  ensureDeliveryQuests();
  townEl.appendChild(el("div", "tw-h", "納品依頼"));
  townEl.appendChild(el("div", "tw-note", "求められた品を納めれば、その品の格に応じて職業の魂を授かる。対象は今 到達している深さまでに出回る品。依頼は迷宮に潜るたびに入れ替わる。"));
  const dl = el("div", "tw-mlist");
  for (const q of G.deliveryQuests) {
    const it = ITEMS[q.itemId];
    if (!it) continue;
    const r20 = it.r20 || 1;
    const holder = deliveryHolder(q.itemId);
    const inShop = (G.shopStock && G.shopStock[q.itemId] > 0);
    const row = el("div", "tw-quest" + (holder ? " done" : ""));
    const info = el("div", "tw-chipi");
    const rn = itemRankName(it);
    info.appendChild(el("div", "tw-chipn", `📦 「${it.name}」を納品`));
    info.appendChild(el("div", "tw-chipc", `${SLOT_LABEL[it.slot] || it.slot || ""}${rn ? " ・ " + rn : ""} ・ アイテムR${r20}`));
    info.appendChild(el("div", "tw-chipc", "報酬: " + deliveryRewardDesc(r20)));
    // 手持ち / 商店に対象があるかを示す
    if (holder) info.appendChild(el("div", "tw-chiphp", `🎒 手持ちにあり（${holder.name}）`));
    else if (inShop) info.appendChild(el("div", "tw-chipc", "🏪 商店に並んでいる"));
    else info.appendChild(el("div", "tw-chipc", "― まだ手元にない ―"));
    row.appendChild(info);
    if (holder) {
      const b = btn("納品する", () => deliverQuest(q));
      b.className = "tw-small primary";
      row.appendChild(b);
    }
    dl.appendChild(row);
  }
  if (!G.deliveryQuests.length) dl.appendChild(el("div", "tw-empty", "今は納品依頼がない。迷宮に潜れば新たな品が求められる。"));
  townEl.appendChild(dl);

  // ===== 3) 情報提供: 酒場の顔ぶれ (最下段) =====
  // 帰還ごとに入れ替わる3〜5名。各人が世界の噂・冒険のヒントを語る
  if (!G.tavernCrowd || !G.tavernCrowd.length) rollTavernCrowd();
  townEl.appendChild(el("div", "tw-h", "情報提供 — 今 酒場にいる者たち"));
  const crowd = el("div", "tw-mlist");
  for (const m of (G.tavernCrowd || [])) {
    const row = el("div", "tw-quest");
    const info = el("div", "tw-chipi");
    info.appendChild(el("div", "tw-chipn", `${m.icon || "🍺"} ${m.name}`));
    info.appendChild(el("div", "tw-chipc", `― ${m.type}`));
    info.appendChild(el("div", "tw-rumort", m.line));
    row.appendChild(info);
    crowd.appendChild(row);
  }
  townEl.appendChild(crowd);
  townEl.appendChild(el("div", "tw-note", "顔ぶれは迷宮から帰還するたびに入れ替わる。"));
}

function claimQuest(q) {
  q.state = "claimed";
  G.stats.questsDone++; // 戦績: 達成した依頼の数 (勲章用)
  G.gold += q.reward.gold;
  let msg = `報酬 💰${q.reward.gold}`;
  if (q.reward.soulPts) { G.soulPts += q.reward.soulPts; msg += ` ✦${q.reward.soulPts}`; }
  if (q.reward.redSoul) { G.redSoul += q.reward.redSoul; msg += ` 🔴${q.reward.redSoul}`; }
  if (q.reward.soul) {
    msg += ` と ${SOUL_CLASSES[q.reward.soul].label}の魂`;
    setTimeout(() => acquireSoul(q.reward.soul, "依頼の報酬として授かった魂だ。", () => renderTown()), 400);
  }
  SFX.itemget(); buzz([0, 30, 60, 30]);
  log(`「${q.name}」を報告した。${msg} を受け取った！`, "win");
  showToast(`✅ ${q.name} — ${msg}`);
  updateTopbar();
  renderTown();
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
    [5000, "千殺の魂繰り", 5000, 40], [10000, "万骨の上に立つ者", 10000, 80],
  ], (v) => `敵を ${v}体 倒す`, (v) => G.stats.kills >= v);

  // 主討伐 (7)
  tiers((v) => `boss${v}`, [
    [1, "主殺し", 100], [5, "玉座荒らし", 300, 5], [10, "玉座のさんだつ者", 500, 10], [20, "主喰らい", 1000, 15],
    [30, "深淵の死神", 1500, 25], [50, "王なき迷宮", 3000, 40], [100, "全ての主をほふる者", 8000, 80],
  ], (v) => `迷宮の主を ${v}体 討つ`, (v) => G.stats.bossKills >= v);

  // 到達最深階 (11)
  tiers((v) => `deep${v}`, [
    [2, "一歩 下へ", 50], [3, "地の底へ", 100], [4, "暗闇に慣れた者", 150], [5, "底知らず", 300],
    [6, "深層の旅人", 400, 5], [7, "闇の淵", 500, 5], [8, "奈落のふち", 700, 10], [9, "静寂の領域", 900, 10],
    [10, "奈落の踏破者", 1000, 15], [11, "光の届かぬ場所", 1500, 20], [12, "最深への到達者", 2500, 30],
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
    [90, "冥府の門前", 6000, 45], [95, "残り五つ", 7000, 50], [99, "全踏破まで あと一つ", 8000, 60],
  ], (v) => `迷宮を ${v} 踏破する`, (v) => G.unlockedDungeons >= v + 1);

  // モンスター図鑑 (5)
  tiers((v) => `mon${v}`, [
    [10, "魔物の観察者", 150], [30, "魔物の目利き", 400], [60, "魔物学の徒", 700, 10],
    [100, "深淵の博物学者", 1500, 15], [150, "全てを見た者", 3000, 30],
  ], (v) => `モンスター図鑑 ${v}種`, (v) => monSeen() >= v);

  // アイテム図鑑 (7)
  tiers((v) => `item${v}`, [
    [10, "目利き見習い", 150], [25, "道具屋の常連", 300], [50, "収集家", 400], [100, "蔵の主", 800, 10],
    [150, "宝物庫の主", 1500, 15], [250, "伝説の収集家", 3000, 30], [350, "全てを手にした者", 8000, 60],
  ], (v) => `アイテム図鑑 ${v}種`, (v) => itemSeen() >= v);

  // 職業発現 (8)
  tiers((v) => `hyb${v}`, [
    [1, "最初の職業発現", 100], [3, "魂の探求者", 200], [6, "職業の解放者", 300], [12, "職業の織り手", 600, 10],
    [18, "魂の錬金術師", 1000, 15], [24, "異端の指導者", 1500, 20], [30, "万職の祖", 2000, 30], [36, "全職業の支配者", 3000, 50],
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
  tiers((v) => `jrank${v}`, [[3, "位階を昇る者", 300, 5], [4, "高位の魂繰り", 800, 10], [5, "極みに至る者", 2000, 30]],
    (v) => `職業ランク ${v} の人業を持つ`, (v) => allDolls().some((d) => (d.jobRank || 0) >= v));
  tiers((v) => `jlv${v}`, [
    [10, "駆け出しの職人", 150], [20, "熟練の域", 400, 5], [30, "達人の域", 800, 10],
    [40, "名人の域", 1500, 20], [50, "神域", 3000, 40],
  ], (v) => `キャラLv ${v} に到達する`, (v) => allDolls().some((d) => (d.jobLv || 0) >= v));
  tiers((v) => `slv${v}`, [
    [20, "魂を磨く者", 200], [50, "魂を鍛える者", 800, 10], [70, "限界の先へ", 1500, 20], [100, "魂の極致", 3000, 40],
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

  // 層ボス制覇 (4) — 種類で数える (1迷宮1種・最大20)
  const bossKinds = () => Object.keys(G.stats.bossIds || {}).length;
  tiers((v) => `lboss${v}`, [
    [3, "層の覇者", 300, 5], [7, "幾多の主を屠る者", 1000, 10], [13, "玉座の収集家", 2500, 20], [20, "二十層の支配者", 6000, 50],
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
  push("awakeAll", "全魂覚醒の祖", `全${JOB_TOTAL}職をランク2以上に覚醒させる`,
    () => awakenedJobs() >= JOB_TOTAL, 8000, 80, null, 1000);
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

// 踏破報告: 報酬を下賜し、次章の謁見が可能になる。第100章ならエピローグへ
function reportMainQuest() {
  const ms = G.msq;
  const n = ms.n;
  const r = msqReward(n);
  const rwText = `下賜: 💰${r.gold} + ✦${r.soulPts}` + (r.redSoul ? ` + 🔴${r.redSoul}` : "");
  showStoryScene(`第${actOf(n)}層 「${ACTS[actOf(n) - 1].title}」`, msqReportLines(n), rwText, () => {
    G.gold += r.gold;
    G.soulPts += r.soulPts;
    G.redSoul += r.redSoul || 0;
    SFX.itemget(); buzz([0, 30, 60, 30]);
    log(`「${DUNGEONS[n - 1].name}」の踏破を報告した。`, "win");
    updateTopbar();
    if (n >= 100) {
      G.msq = { n: 101, state: "end" };
      flashScreen("#ffd84a");
      setTimeout(() => showStoryScene("終章 — 最後の魂繰り", EPILOGUE, null, () => renderTown(), "物語を閉じる"), 400);
      return;
    }
    autosave(true);
    // 解放の節目 (D5/10/15/20) は、報告の直後に機能解放のシーンを挟む
    const us = unlockSceneFor(n);
    if (us) {
      showStoryScene(us.title, us.lines, null, () => {
        SFX.victory(); buzz([0, 40, 80, 40]);
        showToast("🔓 新たな技能を授かった");
        acceptMainQuest();
      });
    } else {
      acceptMainQuest(); // 踏破報告と同時に次の勅命を自動拝命
    }
  });
}

// 次章の勅命を拝命: 新たな迷宮が地図に現れる
function acceptMainQuest() {
  const ms = G.msq;
  // 公開範囲の先は準備中: 勅命は進めず、王が封の解けるのを待てと告げる
  if (ms.n + 1 > CONTENT_LIMIT) {
    ms.state = "sealed";
    autosave(true);
    showStoryScene(`第${CONTENT_NEXT_LAYER}層 — 封印の向こう`, SEALED_LINES, null, () => { renderTown(); });
    return;
  }
  ms.n += 1;
  ms.state = "active";
  G.unlockedDungeons = Math.max(G.unlockedDungeons, ms.n);
  G.dungeonIdx = ms.n - 1;  // 新しい迷宮を選択しておく
  townBandOpen = null;      // 迷宮選択は新迷宮の層域を開いた状態に戻す
  const dn = DUNGEONS[ms.n - 1];
  showStoryScene(`第${actOf(ms.n)}層 「${ACTS[actOf(ms.n) - 1].title}」`, msqOrderLines(ms.n), null, () => {
    SFX.itemget(); buzz([0, 30, 60, 30]);
    log(`新たな勅命を拝命した。「${dn.name}」が地図に記された。`, "win");
    showToast(`🗺 新たな迷宮「${dn.short}」出現`);
    autosave(true);
    renderTown();
  });
}

// 公開範囲の先 (準備中) を告げる王の言葉
const SEALED_LINES = [
  "「墓域の主を討ち、第一の層を鎮めたか。…見事であった、魂繰りよ。」",
  "「だが、次なる層へ続く大門の封は、いまだ固く閉ざされておる。宮廷の術師どもが解呪を急いでおるところだ。」",
  "「封が解けるまで、墓域で人業を鍛え、魂を集め、装備を整えておけ。深淵は、備えのない者から喰らう。」",
  `── 第${CONTENT_NEXT_LAYER}層以降は現在制作中です。墓域の迷宮には何度でも挑めます。`,
];

// ---- 第0章「人業の生成」(チュートリアル勅命) ----
const TUT_INTRO = [
  "「よくぞ参った、新しき魂繰りよ。…生身のまま、よくぞ辺境まで辿り着いた。」",
  "「だが言うておく。生身で迷宮に入ってはならぬ。深淵は、生きた魂から順に喰らう。」",
  "「ゆえに死者の魂を器に宿した『人業』を遣わすのだ。まずは其の一体を、おのれの手で生み出すがよい。」",
  "「戦士・僧侶・盗賊・魔導士の魂を、そして赤い魂を百、くれてやろう。」",
  "「人業の館の保管庫へゆけ。赤い魂で器を買い、宿す魂を選び、名を与えよ。」",
  "「それがそなたの最初の勅命である。人業を一体生み出したら、戻って報告せよ。」",
];
const TUT_FINALE = [
  "「…ほう。良い面構えの人業ではないか。初仕事にしては上出来よ。」",
  "「覚えておけ、魂繰り。人業は道具ではない。死者に与えられた、二度目の生だ。」",
  "「粗末に扱えば、魂は器の中で錆びる。労り、鍛え、共に深淵を渡れ。」",
  "「これでそなたも一人前。次は、まことの勅命を授けよう。」",
];

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
  showToast("👑 4つの魂と赤い魂を拝受した");
  autosave(true);
  renderTown();
}

// 第0章の報告: 報酬を下賜し、第1章の謁見 (offer) へ繋ぐ
function reportTutorialQuest() {
  showStoryScene("勅命「人業の生成」完遂", TUT_FINALE, "下賜: 💰100 + ✦30", () => {
    G.gold += 100;
    G.soulPts += 30;
    SFX.itemget(); buzz([0, 30, 60, 30]);
    log("最初の勅命「人業の生成」を果たした。", "win");
    autosave(true);
    acceptMainQuest(); // チュートリアル完了後も自動で第1章を拝命
  });
}

// 機能解放: ダンジョン踏破数に応じて段階的に解放される (層末の節目で授かる)。
//   D5→魂融合 / D10→サブ魂1枠 / D15→酒場の噂・依頼 / D20→控えの結社(席1) /
//   D25→納品+1 / D30→結社席+1 / D35→納品+1 / D40→サブ魂2枠目 / D45→結社席+1 / D50→無限迷宮
function featureUnlocked(key) {
  const c = clearedDungeonCount();
  if (key === "fusion") return c >= 5;
  if (key === "rumor") return c >= 15;
  if (key === "order") return c >= 20;
  if (key === "infinite") return c >= 50 && CONTENT_LIMIT >= 50; // 奈落は第10層の公開まで閉じる
  return false;
}
// 解放済みのサブ魂 (宿し技) スロット数 (0/1/2)。MAX_SUBS が上限。2枠目は D40 で解放
function unlockedSubSlots() {
  const c = clearedDungeonCount();
  return Math.min(MAX_SUBS, c >= 40 ? 2 : c >= 10 ? 1 : 0);
}
// 控えの結社の席数 (0/1/2/3)。D20 で席1、D30 で席2、D45 で席3
function orderSeats() {
  const c = clearedDungeonCount();
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
  const c = clearedDungeonCount();
  return c >= 35 ? 3 : c >= 25 ? 2 : 1;
}

// 踏破済みの迷宮数 (メインストーリー基準: 第n章攻略中 = n-1 踏破)
function clearedDungeonCount() {
  const ms = G.msq;
  if (!ms) return Math.max(0, (G.unlockedDungeons || 1) - 1);
  if (ms.state === "active") return Math.max(0, ms.n - 1); // 第0章 (チュートリアル) 中は 0
  return Math.min(DUNGEONS.length, ms.n); // report/offer/end は第n章を踏破済み
}

// 王宮に用があるか (踏破の報告 or 次章の拝命 / 第0章の謁見・報告)
// 街の広場に掲げる「いまの目標」: { text, go() }。物語を閉じた後は出さない
function currentObjective() {
  const ms = G.msq;
  if (!ms || ms.state === "end" || ms.n > 100) return null;
  const goPalace = () => { G.town.facility = "palace"; G.town.sub = null; renderTown(); };
  if (contentSealed()) return { text: `墓域で人業を鍛え、装備を集める（第${CONTENT_NEXT_LAYER}層は準備中）`, go: () => { requestAnimationFrame(() => { const d = townEl.querySelector(".tw-dive"); if (d) d.scrollIntoView({ block: "nearest", behavior: "smooth" }); }); } };
  if (ms.n === 0 && ms.state === "active") {
    if (!ms.granted) return { text: "王宮で王に謁見する", go: goPalace };
    if (!allDolls().some((d) => !d.isEmpty)) return { text: "人業の館の保管庫で、人業を仕立てる", go: () => { G.town.facility = "mansion"; G.town.sub = "manage"; renderTown(); } };
    return { text: "王宮へ戻り、勅命の完遂を報告する", go: goPalace };
  }
  if (ms.state === "report") return { text: `王宮へ戻り、「${DUNGEONS[ms.n - 1].name}」の踏破を報告する`, go: goPalace };
  if (ms.state === "offer") return { text: "王宮で新たな勅命を受ける", go: goPalace };
  if (ms.state === "active" && ms.n >= 1 && DUNGEONS[ms.n - 1]) {
    return { text: `「${DUNGEONS[ms.n - 1].name}」を踏破する`, go: () => { G.dungeonIdx = ms.n - 1; townBandOpen = null; renderTown(); requestAnimationFrame(() => { const d = townEl.querySelector(".tw-dive"); if (d) d.scrollIntoView({ block: "nearest", behavior: "smooth" }); }); } };
  }
  return null;
}

function palaceCallReady() {
  const ms = G.msq;
  if (!ms) return false;
  if (ms.n === 0 && ms.state === "active") return !ms.granted || allDolls().filter((d) => !d.isEmpty).length >= 1;
  if (ms.n > CONTENT_LIMIT) return false; // 公開範囲の先の勅命は準備中
  return ms.state === "report" || ms.state === "offer";
}

function renderPalace() {
  townEl.appendChild(townHeader("王宮"));
  townEl.appendChild(el("div", "tw-lead", "玉座の間。王の勅命を聞き、書庫で迷宮の記録を紐解ける。"));

  // メインストーリー (勅命ループ)
  townEl.appendChild(el("div", "tw-h", "玉座の間 — 勅命"));
  const ms = G.msq;
  if (!ms || ms.state === "end" || ms.n > 100) {
    townEl.appendChild(el("div", "tw-note", "「百の迷宮は解き放たれた。…余の葬列には、来ずともよいぞ。」"));
  } else if (contentSealed()) {
    const box = el("div", "tw-rumor tw-sealed");
    box.appendChild(el("div", "tw-rumors", `第${CONTENT_NEXT_LAYER}層 — 封印の向こう (準備中)`));
    box.appendChild(el("div", "tw-rumort", "次なる層へ続く大門の封は、いまだ固く閉ざされている。"));
    box.appendChild(el("div", "tw-note", "封が解けるまで、墓域の迷宮で人業を鍛え、装備を集めよう。"));
    townEl.appendChild(box);
    const re = btn("👑 王の言葉を聞き直す", () => showStoryScene(`第${CONTENT_NEXT_LAYER}層 — 封印の向こう`, SEALED_LINES, null, null));
    re.className = "btn tw-add";
    townEl.appendChild(re);
  } else if (ms.n === 0 && ms.state === "active") {
    // 第0章「人業の生成」
    if (!ms.granted) {
      townEl.appendChild(el("div", "tw-note", "玉座の老王が、新しき魂繰りの到着を待っている。"));
      const b = btn("👑 謁見する — 着任の挨拶", () =>
        showStoryScene("勅命 「人業の生成」", TUT_INTRO, "下賜: 戦士・僧侶・盗賊・魔導士の魂 + 🔴100", () => grantTutorialGift()));
      b.className = "btn tw-add tw-msq";
      townEl.appendChild(b);
    } else if (allDolls().filter((d) => !d.isEmpty).length >= 1) {
      const b = btn("👑 報告する — 「人業の生成」完遂", () => reportTutorialQuest());
      b.className = "btn tw-add tw-msq";
      townEl.appendChild(b);
    } else {
      const box = el("div", "tw-rumor");
      box.appendChild(el("div", "tw-rumors", "勅命 「人業の生成」"));
      box.appendChild(el("div", "tw-rumort", "人業の館の保管庫で器を買い (最初の3体は無料)、いずれかの魂を宿して人業を一体つくれ。"));
      box.appendChild(el("div", "tw-note", "人業が立ち上がったら、王宮へ戻り報告せよ。"));
      townEl.appendChild(box);
      const re = btn("👑 勅命を聞き直す", () => showStoryScene("勅命 「人業の生成」", TUT_INTRO, null, null));
      re.className = "btn tw-add";
      townEl.appendChild(re);
    }
  } else if (ms.state === "active") {
    const tdn = DUNGEONS[ms.n - 1];
    const box = el("div", "tw-rumor");
    box.appendChild(el("div", "tw-rumors", `第${actOf(ms.n)}層 「${ACTS[actOf(ms.n) - 1].title}」`));
    box.appendChild(el("div", "tw-rumort", `勅命: 「${tdn.name}」を踏破${ms.n % 5 === 0 ? "し、その主を討て。" : "せよ。"}`));
    box.appendChild(el("div", "tw-note", "果たしたら王宮へ戻り、報告せよ。"));
    townEl.appendChild(box);
    const re = btn("👑 勅命を聞き直す", () => showStoryScene(`第${actOf(ms.n)}層 「${ACTS[actOf(ms.n) - 1].title}」`, msqOrderLines(ms.n), null, null));
    re.className = "btn tw-add";
    townEl.appendChild(re);
  } else if (ms.state === "report") {
    const b = btn(`👑 報告する — 「${DUNGEONS[ms.n - 1].name}」踏破`, () => reportMainQuest());
    b.className = "btn tw-add tw-msq";
    townEl.appendChild(b);
  } else if (ms.state === "offer") {
    const b = btn(`👑 謁見する — 新たな勅命 (第${actOf(ms.n + 1)}層)`, () => acceptMainQuest());
    b.className = "btn tw-add tw-msq";
    townEl.appendChild(b);
  }

  // 図鑑 (モンスター図鑑・アイテム図鑑・職業図鑑・勲章の間 を2列で並べる)
  townEl.appendChild(el("div", "tw-h", "王宮書庫 — 図鑑"));
  const row = el("div", "tw-plates");
  const goCodex = (f, fn) => () => { SFX.select(); G.town.facility = f; townEl.scrollTop = 0; fn(); };
  row.appendChild(facPlate("codexMon", "モンスター図鑑", `発見 ${Object.keys(G.codex.mon).filter((k) => MONSTERS[k]).length} 種`, { onClick: goCodex("codexDungeon", renderCodexDungeon) }));
  row.appendChild(facPlate("codexItem", "アイテム図鑑", `発見 ${Object.keys(G.codex.item).length} 種`, { onClick: goCodex("codexItem", renderCodexItem) }));
  row.appendChild(facPlate("codexJob", "職業図鑑", `発現 ${Object.keys(G.codex.job).filter((k) => SOUL_CLASSES[k]).length} 種`, { onClick: goCodex("codexJob", renderCodexJob) }));
  const claimable = ACHIEVEMENTS.filter((a) => !G.ach[a.id] && a.cond()).length;
  row.appendChild(facPlate("codexAch", "勲章の間", `受領 ${Object.keys(G.ach).length} / ${ACHIEVEMENTS.length}`, { badge: claimable ? `受領可 ${claimable}` : null, onClick: goCodex("codexAch", renderCodexAch) }));
  townEl.appendChild(row);

  // 宝物庫 (蒐集品の奉納)
  townEl.appendChild(el("div", "tw-h", "王宮宝物庫 — 蒐集品の奉納"));
  const ts = treasuryState();
  const kinds = Object.keys(ts.donated).filter((id) => ITEMS[id] && ITEMS[id].slot === "misc").length;
  const tre = el("div", "tw-plates");
  tre.appendChild(facPlate("treasury", "宝物庫", `奉納 ${kinds} / 100 種 — 蒐集品を納め褒賞を得る`, {
    wide: true, badge: treasuryRewardReady() ? "受領できる褒賞あり" : null,
    onClick: () => { SFX.select(); G.town.facility = "treasury"; renderTown(); },
  }));
  townEl.appendChild(tre);

  // 戦績 (ローカル記録)
  townEl.appendChild(el("div", "tw-h", "王の記録 — 戦績"));
  const s = G.stats;
  const rec = el("div", "tw-records");
  const recRow = (label, val) => { const r = el("div", "tw-recrow"); r.appendChild(el("span", "tw-recl", label)); r.appendChild(el("span", "tw-recv", String(val))); rec.appendChild(r); };
  recRow("潜入回数", s.runs);
  recRow("到達最深階", `B${s.deepest}F`);
  recRow("撃破した敵", s.kills);
  recRow("倒した迷宮の主", s.bossKills);
  recRow("回収した魂", s.soulsFound);
  recRow("砕けた人業", s.deaths);
  recRow("踏破した迷宮", clearedDungeonCount());
  const pm = Math.floor((s.playMs || 0) / 60000);
  recRow("総プレイ時間", `${Math.floor(pm / 60)}時間${String(pm % 60).padStart(2, "0")}分`);
  townEl.appendChild(rec);
  const sh = btn("📣 戦績をシェア", () => {
    SFX.select();
    const ms = G.msq || {};
    const head = ms.state === "end" || ms.n > 100 ? "百の迷宮のすべてを制し、物語を閉じた。"
      : ms.n >= 1 ? `第${actOf(ms.n)}層「${ACTS[actOf(ms.n) - 1].title}」を探索中。` : "魂繰りとして着任した。";
    shareProgress(head);
  });
  sh.className = "btn tw-add share-btn";
  townEl.appendChild(sh);
}

// ==== 王宮の宝物庫 (蒐集品の奉納) ====
// 蒐集品 (slot:"misc") を奉納すると、ランク帯ごとではなく「奉納した総種類数」の節目で褒賞が下賜される。
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

// 蒐集品 → ランク帯 (1-10)。lv1-20=R1 … lv181-200=R10
function collectibleRank(it) { return Math.min(10, Math.max(1, Math.ceil((it.lv || 1) / 20))); }

// ランク帯ごとの蒐集品id一覧 (ITEMS から一度だけ構築してメモ化)
let _collByRank = null;
function collectiblesByRank() {
  if (_collByRank) return _collByRank;
  _collByRank = {};
  for (let r = 1; r <= 10; r++) _collByRank[r] = [];
  for (const id in ITEMS) { const it = ITEMS[id]; if (it.slot === "misc") _collByRank[collectibleRank(it)].push(id); }
  for (let r = 1; r <= 10; r++) _collByRank[r].sort((a, b) => (ITEMS[a].lv - ITEMS[b].lv) || a.localeCompare(b));
  return _collByRank;
}

// 宝物庫の状態 (旧セーブには無いので遅延初期化)
function treasuryState() {
  if (!G.treasury || typeof G.treasury !== "object") G.treasury = { donated: {}, claimed: {} };
  if (!G.treasury.donated) G.treasury.donated = {};
  if (!G.treasury.claimed) G.treasury.claimed = {};
  return G.treasury;
}
function donatedCountRank(r) { const ts = treasuryState(); return collectiblesByRank()[r].filter((id) => ts.donated[id]).length; }
// 奉納した蒐集品の総種類数 (ランク帯を問わない)
function totalDonatedKinds() {
  const ts = treasuryState();
  return Object.keys(ts.donated).filter((id) => ITEMS[id] && ITEMS[id].slot === "misc").length;
}

// 手持ち (編成+控え) の蒐集品 [{doll, item}]
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

// 蒐集品を1点奉納する (台帳に種類を記録し、その品は消費される)
function donateCollectible(doll, it) {
  const ts = treasuryState();
  const idx = doll.items.indexOf(it);
  if (idx < 0) return false;
  doll.items.splice(idx, 1);
  if (it.id) { ts.donated[it.id] = true; codexSeeItem(it.id); }
  return true;
}

// 褒賞の装備を1点下賜する (所持枠が無ければゴールドに換える)。完了後 onClose を呼ぶ
function grantTreasuryItem(center, onClose) {
  const id = pickItemByLv(Math.min(200, Math.max(1, Math.round(center))));
  const who = G.party.find((p) => p.alive && p.items.length < MAX_ITEMS)
    || G.party.find((p) => p.items.length < MAX_ITEMS)
    || allDolls().find((d) => !d.isEmpty && d.items.length < MAX_ITEMS);
  if (who && ITEMS[id]) {
    const it = cloneItem(id);
    runGainItem(who, it); codexSeeItem(id);
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
  runGainItem(who, it); codexSeeItem(id);
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
  const back = () => { autosave(); if (G.town.facility === "treasury") renderTreasury(); };
  const center = Math.min(200, Math.max(1, n * 2)); // 節目が深いほど高位の装備
  const reason = `蒐集品を ${n} 種 宝物庫に納めた褒賞だ。`;
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

function renderTreasury() {
  townEl.innerHTML = "";
  townEl.appendChild(townHeader("宝物庫", "palace"));
  townEl.appendChild(el("div", "tw-lead", "王宮の宝物庫。迷宮で拾った蒐集品をここに奉納すると、納めた総種類数の節目ごとに褒賞——装備や魂——が下賜される。"));
  const ts = treasuryState();
  const byRank = collectiblesByRank();
  const totalKinds = Object.keys(ts.donated).filter((id) => ITEMS[id] && ITEMS[id].slot === "misc").length;
  townEl.appendChild(el("div", "tw-note", `奉納済み ${totalKinds} / 100 種`));

  // ---- 手持ちの未奉納蒐集品を奉納する ----
  townEl.appendChild(el("div", "tw-h", "手持ちの蒐集品 — 奉納する"));
  const held = heldCollectibles().filter((h) => !ts.donated[h.item.id]);
  const seen = new Set();
  const newKinds = [];
  for (const h of held) { if (seen.has(h.item.id)) continue; seen.add(h.item.id); newKinds.push(h); }
  if (!newKinds.length) {
    townEl.appendChild(el("div", "tw-empty", held.length
      ? "手持ちはすべて奉納済みの種類だ (重複は商店で売れる)。"
      : "奉納できる蒐集品を持っていない。迷宮で集めよう。"));
  } else {
    const wrap = el("div", "tw-rlist");
    for (const h of newKinds) {
      const card = el("div", "tw-fac");
      const art = el("div", "tw-faci"); art.appendChild(spriteCanvas(h.item, 4)); card.appendChild(art);
      card.appendChild(itemNameEl("div", "tw-facn", h.item));
      card.appendChild(el("div", "tw-facd", `R${collectibleRank(h.item)}・所持: ${h.doll.name}`));
      card.addEventListener("click", () => { donateCollectible(h.doll, h.item); SFX.itemget(); autosave(); renderTreasury(); });
      wrap.appendChild(card);
    }
    townEl.appendChild(wrap);
    const all = btn(`✦ 新種をまとめて奉納 (${newKinds.length}種)`, () => {
      for (const h of newKinds) donateCollectible(h.doll, h.item);
      SFX.itemget(); autosave(); renderTreasury();
    });
    all.className = "btn tw-add";
    townEl.appendChild(all);
  }

  // ---- 褒賞 (奉納した総種類数の節目) ----
  townEl.appendChild(el("div", "tw-h", "褒賞 — 奉納した総種類数の節目"));
  const mbox = el("div", "tw-rumor");
  mbox.appendChild(el("div", "tw-rumors", `総奉納 ${totalKinds} / 100 種`));
  for (const m of TREASURY_MILESTONES) {
    const key = "m" + m.n;
    const label = milestoneLabel(m);
    if (ts.claimed[key]) {
      mbox.appendChild(el("div", "tw-note", `${m.n}種 — ${label} — 受領済`));
    } else if (totalKinds >= m.n) {
      const b = btn(`🎁 褒賞を受け取る (${m.n}種達成 — ${label})`, () => claimTreasury(m.n));
      b.className = "btn tw-add tw-msq";
      mbox.appendChild(b);
    } else {
      mbox.appendChild(el("div", "tw-note", `${m.n}種 — ${label} — あと ${m.n - totalKinds} 種`));
    }
  }
  townEl.appendChild(mbox);

  // ---- 奉納台帳 (ランク帯ごと・閲覧用) ----
  townEl.appendChild(el("div", "tw-h", "奉納台帳 — ランク帯ごと (各10種)"));
  for (let r = 1; r <= 10; r++) {
    const ids = byRank[r];
    const cnt = ids.filter((id) => ts.donated[id]).length;
    const box = el("div", "tw-rumor");
    box.appendChild(el("div", "tw-rumors", `R${r}  —  ${cnt} / 10 種`));
    const slots = el("div", "tw-tslots");
    for (const id of ids) {
      const got = !!ts.donated[id];
      const slot = el("div", "tw-tslot" + (got ? " got" : ""));
      if (got) {
        slot.appendChild(spriteCanvas(ITEMS[id], 3)); slot.title = ITEMS[id].name + " (タップで詳細)";
        slot.style.cursor = "pointer";
        slot.addEventListener("click", () => { SFX.select(); showItemDetailPopup(null, { item: ITEMS[id], from: "treasury" }); });
      }
      else { slot.appendChild(el("div", "tw-tlock", "？")); slot.title = "未奉納"; }
      slots.appendChild(slot);
    }
    box.appendChild(slots);
    townEl.appendChild(box);
  }
}

// ---- 勲章の間 (実績一覧) ----
// 段階表 (series) の勲章は1枠に集約し、受領済みの次の段階だけを表示する。
// 全段階を受領し終えた series は最終段階を「受領済」として残す。
function renderCodexAch() {
  townEl.innerHTML = "";
  townEl.appendChild(townHeader("勲章の間", "palace"));
  // 定義順を保ったまま series ごとに束ねる
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
  const claimable = cards.filter((c) => c.ready).length;
  townEl.appendChild(el("div", "tw-note",
    `受領した勲章 ${Object.keys(G.ach).length} / ${ACHIEVEMENTS.length}${claimable ? ` ・ 受領可 ${claimable}` : ""}`));
  // 「受領可 → 未達成 → 全段階受領済」の順 (同順位は定義順)
  const ord = (c) => (c.allDone ? 2 : c.ready ? 0 : 1);
  cards.sort((x, y) => ord(x) - ord(y));
  const grid = el("div", "cdx-grid");
  for (const c of cards) {
    const card = el("div", "cdx-card ach-card" + (c.ready ? " ready" : c.allDone ? " done" : ""));
    card.appendChild(el("div", "ach-icon", c.allDone ? "🏅" : c.ready ? "✨" : "🔘"));
    card.appendChild(el("div", "cdx-name", c.a.name));
    card.appendChild(el("div", "cdx-stat ach-desc", c.a.desc));
    if (c.total > 1) card.appendChild(el("div", "cdx-stat", `段階 ${c.tier} / ${c.total}`));
    if (c.allDone) {
      card.appendChild(el("div", "cdx-stat ach-got", "受領済"));
    } else {
      const rw = [];
      if (c.a.reward.gold) rw.push(`💰${c.a.reward.gold}`);
      if (c.a.reward.redSoul) rw.push(`🔴${c.a.reward.redSoul}`);
      card.appendChild(el("div", "cdx-stat", "下賜: " + rw.join(" + ")));
    }
    if (c.ready) {
      const b = btn("拝受する", () => claimAchievement(c.a));
      b.className = "tw-small primary ach-claim";
      card.appendChild(b);
    }
    grid.appendChild(card);
  }
  townEl.appendChild(grid);
}

// ---- 図鑑 (王宮書庫) ----
// モンスター図鑑の記録単位: { kills, normal, rare, dungeons:{idx:true} }
// 記録されるのは「倒した時」のみ。落としたドロップ(通常/レア)も実際に落として初めて開示。
function codexMonEntry(key) {
  let e = G.codex.mon[key];
  if (!e || typeof e !== "object") {
    e = { kills: e === true ? 1 : 0, normal: false, rare: false, dungeons: {} };
    G.codex.mon[key] = e;
  }
  if (!e.dungeons) e.dungeons = {};
  return e;
}
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
function codexSeeItem(id) { if (id) G.codex.item[id] = true; }

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
}
// 所持魂一覧を走査して職業図鑑を更新する (オートセーブのたびに全走査)
function codexSweepJobs() {
  if (!G.codex || !G.codex.job) return;
  for (const s of (G.souls || [])) codexJobSee(s.clsKey, s.count, s.level);
}

let codexItemTab = "weapon"; // アイテム図鑑の選択中タブ (分類)
let codexWeaponCat = "all";  // 武器タブのサブカテゴリ (長剣/短剣/弓/杖…)

function renderCodexItem() {
  townEl.innerHTML = "";
  townEl.appendChild(townHeader("アイテム図鑑", "palace"));
  const seenIds = Object.keys(G.codex.item).filter((id) => ITEMS[id]);
  townEl.appendChild(el("div", "tw-note", `発見済み ${seenIds.length} 種`));

  // 分類タブ (商店と同じ区分 + 蒐集品)
  const tabDefs = ITEM_CATS;
  const tabs = el("div", "tw-dolltabs shop-tabs cdx-tabs");
  for (const t of tabDefs) {
    const b = btn(t.label, () => { codexItemTab = t.key; renderCodexItem(); });
    b.className = "tw-dolltab" + (codexItemTab === t.key ? " active" : "");
    tabs.appendChild(b);
  }
  townEl.appendChild(tabs);

  const def = tabDefs.find((t) => t.key === codexItemTab) || tabDefs[0];
  const slotSet = new Set(def.slots || []);
  let ids = seenIds.filter((id) => slotSet.has(ITEMS[id].slot));

  // 武器はさらにサブカテゴリ (長剣/短剣/弓/杖…) で絞り込める
  if (def.key === "weapon") {
    const subs = el("div", "tw-dolltabs shop-tabs cdx-tabs");
    for (const c of [{ key: "all", label: "すべて" }, ...WEAPON_CATS]) {
      const b = btn(c.label, () => { codexWeaponCat = c.key; renderCodexItem(); });
      b.className = "tw-dolltab" + (codexWeaponCat === c.key ? " active" : "");
      subs.appendChild(b);
    }
    townEl.appendChild(subs);
    if (codexWeaponCat !== "all") ids = ids.filter((id) => ITEMS[id].cat === codexWeaponCat);
  }
  // 商店と同じリスト表示 (アイコン + 名前 + 説明)。タップで詳細ポップアップ
  const list = el("div", "shop-stock");
  for (const id of ids) {
    const it = ITEMS[id];
    const r = el("div", "tw-shoprow");
    if (itemRankColor(it)) r.style.borderColor = itemRankColor(it);
    const ic = el("span", "tw-chips"); ic.appendChild(spriteCanvas(it, 2)); r.appendChild(ic);
    const info = el("div", "tw-chipi");
    info.appendChild(itemNameEl("div", "tw-chipn", it));
    info.appendChild(el("div", "tw-chipc", it.desc || ""));
    r.appendChild(info);
    r.style.cursor = "pointer";
    r.addEventListener("click", () => { SFX.select(); showCodexItemDetail(id); });
    list.appendChild(r);
  }
  if (!ids.length) list.appendChild(el("div", "tw-empty", "この区分の品はまだ手にしていない。"));
  townEl.appendChild(list);
}

// 図鑑: アイテム詳細を宝箱出現時と同じ大きさでメイン画面に表示
function showCodexItemDetail(id) {
  const it = ITEMS[id];
  if (!it) return;
  const wrap = el("div", "confirm-overlay");
  const card = el("div", "ig-card cdx-detail");
  const rc = itemRankColor(it);
  if (rc) { card.style.borderColor = rc; card.style.boxShadow = `0 0 40px ${rc}66`; }
  const ban = el("div", "ig-banner", itemGradeText(it, "アイテム"));
  if (rc) ban.style.color = rc;
  card.appendChild(ban);
  const art = el("div", "ig-art"); art.appendChild(spriteCanvas(it, 11)); card.appendChild(art);
  card.appendChild(itemNameEl("div", "ig-name", it));
  card.appendChild(el("div", "cdx-elem", itemCatText(it)));
  const st = statLines(it);
  if (st) card.appendChild(el("div", "ig-stat", st));
  card.appendChild(el("div", "ig-desc", it.desc || ""));
  const ok = btn("閉じる", () => wrap.remove());
  ok.className = "btn primary ig-ok";
  card.appendChild(ok);
  wrap.appendChild(card);
  wrap.addEventListener("click", (e) => { if (e.target === wrap) wrap.remove(); });
  document.body.appendChild(wrap);
}

// 図鑑: モンスター詳細 (説明・討伐数・ステータス・ドロップ・出現ダンジョン)
function showCodexMonDetail(key) {
  const m = MONSTERS[key];
  if (!m) return;
  const e = codexMonEntry(key);
  const wrap = el("div", "confirm-overlay");
  const card = el("div", "ig-card cdx-detail");
  const rc = m.rank ? RANK_COLOR[m.rank] : null;
  if (rc) { card.style.borderColor = rc; card.style.boxShadow = `0 0 40px ${rc}66`; }
  const elm = ELEMENTS[m.element] || ELEMENTS.none;
  const isOther = CODEX_OTHER.includes(key);
  const ban = el("div", "ig-banner", isOther ? "その他" : `${RACE_LABEL[m.race] || "魔物"}${m.rank ? "・" + RANK_NAME[m.rank] + "級" : ""}`);
  if (rc) ban.style.color = rc;
  card.appendChild(ban);
  const art = el("div", "ig-art"); art.appendChild(spriteCanvas(m, 9)); card.appendChild(art);
  card.appendChild(el("div", "ig-name", m.name));
  const elBadge = el("div", "cdx-elem", `属性: ${elm.label}`);
  elBadge.style.color = elm.color;
  card.appendChild(elBadge);
  card.appendChild(el("div", "ig-desc", m.desc || ""));

  const info = el("div", "cdx-info");
  info.appendChild(el("div", "cdx-kills", `討伐数 ${e.kills || 0}`));
  info.appendChild(el("div", "cdx-stat", `HP${m.maxhp}  ATK${m.atk}  VIT${m.def}  AGI${m.spd}  ✦${m.soul}  💰${m.gold}`));
  card.appendChild(info);

  // 特徴・スキル: その敵が戦闘で見せる挙動 (固有ドロップに代わって掲載)
  const traitBox = el("div", "cdx-drops");
  traitBox.appendChild(el("div", "cdx-h", "特徴・スキル"));
  const traits = monsterTraits(m);
  if (traits.length) {
    for (const t of traits) {
      const r = el("div", "cdx-trow");
      r.appendChild(el("span", "cdx-tlabel", t.label));
      r.appendChild(el("span", "cdx-tdesc", t.desc));
      traitBox.appendChild(r);
    }
  } else {
    traitBox.appendChild(el("div", "cdx-dun dim", "・特筆すべき特徴はない"));
  }
  card.appendChild(traitBox);

  // 出現ダンジョン (倒したダンジョンのみ記載)
  const dunBox = el("div", "cdx-drops");
  dunBox.appendChild(el("div", "cdx-h", "出現したダンジョン"));
  const idxs = Object.keys(e.dungeons || {}).map(Number).filter((i) => DUNGEONS[i]);
  if (idxs.length) {
    for (const i of idxs) dunBox.appendChild(el("div", "cdx-dun", `・${DUNGEONS[i].name}`));
  } else {
    dunBox.appendChild(el("div", "cdx-dun dim", "・記録なし"));
  }
  card.appendChild(dunBox);

  const ok = btn("閉じる", () => wrap.remove());
  ok.className = "btn primary ig-ok";
  card.appendChild(ok);
  wrap.appendChild(card);
  wrap.addEventListener("click", (ev) => { if (ev.target === wrap) wrap.remove(); });
  document.body.appendChild(wrap);
}

// ダンジョンに出現しうるモンスターのキー一覧 (pool + deepPool + boss、重複排除)
function dungeonRoster(dn) {
  const seen = new Set();
  const out = [];
  for (const k of [...(dn.pool || []), ...(dn.deepPool || []), dn.boss]) {
    if (k && MONSTERS[k] && !seen.has(k)) { seen.add(k); out.push(k); }
  }
  return out;
}

// 特定のダンジョンに属さない魔物 (宝箱に潜む類) を集める「その他」タブの面々
const CODEX_OTHER = ["mimic", "master_mimic"];

let codexDungeonIdx = 0; // モンスター図鑑の選択中ダンジョン (-1 は「その他」タブ)
function renderCodexDungeon() {
  townEl.innerHTML = "";
  townEl.appendChild(townHeader("モンスター図鑑", "palace"));
  // 解放済みのダンジョンのみ閲覧可能
  const unlocked = Math.max(1, G.unlockedDungeons || 1);
  if (codexDungeonIdx >= unlocked) codexDungeonIdx = 0;

  // ダンジョン選択タブ (未解放のダンジョンは一切表示しない) + 末尾に「その他」
  const tabs = el("div", "tw-dolltabs shop-tabs cdx-tabs");
  for (let i = 0; i < unlocked && i < DUNGEONS.length; i++) {
    const b = btn(DUNGEONS[i].short, () => { codexDungeonIdx = i; renderCodexDungeon(); });
    b.className = "tw-dolltab" + (codexDungeonIdx === i ? " active" : "");
    tabs.appendChild(b);
  }
  const ob = btn("その他", () => { codexDungeonIdx = -1; renderCodexDungeon(); });
  ob.className = "tw-dolltab" + (codexDungeonIdx === -1 ? " active" : "");
  tabs.appendChild(ob);
  townEl.appendChild(tabs);

  const isOther = codexDungeonIdx === -1;
  const dn = isOther ? null : DUNGEONS[codexDungeonIdx];
  townEl.appendChild(el("div", "tw-note", isOther
    ? "その他 — 宝箱に潜む魔物 (未討伐は ？？？)"
    : `${dn.name} — 出現する魔物 (未討伐は ？？？)`));

  const roster = isOther ? CODEX_OTHER.filter((k) => MONSTERS[k]) : dungeonRoster(dn);
  const grid = el("div", "cdx-grid");
  for (const key of roster) {
    const m = MONSTERS[key];
    const killed = !!G.codex.mon[key];
    const c = el("div", "cdx-card" + (killed ? "" : " unknown"));
    if (killed && m.rank) c.style.borderColor = RANK_COLOR[m.rank];
    const art = el("div", "cdx-art");
    if (killed) art.appendChild(spriteCanvas(m, 3));
    else art.appendChild(el("div", "cdx-q", "？"));
    c.appendChild(art);
    c.appendChild(el("div", "cdx-name", killed ? m.name + (m.boss ? "（主）" : "") : "？？？"));
    if (killed) {
      c.addEventListener("click", () => { SFX.select(); showCodexMonDetail(key); });
    }
    grid.appendChild(c);
  }
  if (!roster.length) grid.appendChild(el("div", "tw-empty", "記録なし。"));
  townEl.appendChild(grid);
}

// ---- 職業図鑑 ----
// 人業に発現したことのある職業のみ表示。未発見は一切載せない。
function jobRow(name, sprite, color, onClick) {
  const r = el("div", "tw-soulrow");
  const o = el("span", "tw-chips");
  o.appendChild(spriteCanvas(sprite, 2));
  r.appendChild(o);
  const info = el("div", "tw-chipi");
  const nm = el("div", "tw-souln", name);
  nm.style.color = color;
  info.appendChild(nm);
  r.appendChild(info);
  r.addEventListener("click", () => { SFX.select(); onClick(); });
  return r;
}

function renderCodexJob() {
  townEl.innerHTML = "";
  townEl.appendChild(townHeader("職業図鑑", "palace"));
  const baseKn = Object.keys(SOUL_CLASSES).filter((k) => G.codex.job[k]);
  const hyKn = []; // 混成職は廃止
  if (!baseKn.length && !hyKn.length) {
    townEl.appendChild(el("div", "tw-empty", "まだ職業を見つけていない。迷宮で魂を吸収すると職業が記される。"));
    return;
  }
  townEl.appendChild(el("div", "tw-note", "人業に発現した職業が、到達した位階 (ランク) ごとに記される。"));
  // 到達した職業ランク (魂の品質で決まる位階)。各ランクの称号を別個の項として列挙する
  const attained = (k) => Math.max(1, (G.codex.job[k] && G.codex.job[k].rank) || 1);
  for (let r = 1; r <= 5; r++) {
    const bs = baseKn.filter((k) => attained(k) >= r);
    const hy = hyKn.filter((k) => attained(k) >= r);
    if (!bs.length && !hy.length) continue;
    townEl.appendChild(el("div", "tw-h", `ランク${r}`));
    const list = el("div", "cdx-sklist");
    for (const k of bs) list.appendChild(jobRow(jobRankName(k, r), jobSprite(k, r), SOUL_CLASSES[k].glow, () => showCodexJobDetail(k, r)));
    for (const k of hy) {
      const bk = k.split("+")[0];
      list.appendChild(jobRow(jobRankName(k, r), jobSprite(bk, r), SOUL_CLASSES[bk].glow, () => showCodexJobDetail(k, r)));
    }
    townEl.appendChild(list);
  }
  townEl.appendChild(el("div", "tw-note", "魂の組み合わせ次第で、いまだ知られぬ職業が眠っているという……"));
}

// 職業図鑑: 詳細カード (解説/活用/発現条件/パッシブ/スキル表)。
// rank = 図鑑で選んだ位階。称号・発現条件・パッシブ・スキルはこのランク視点で表示する。
// heading を渡すと、最上部に「○○は●●になった！」等の見出しを大きく表示する
// (職業発現/変化の演出から呼ぶ。職業図鑑からは未指定)。
function showCodexJobDetail(key, rank, heading) {
  const isHybrid = false; // 混成職は廃止
  const baseK = isHybrid ? key.split("+")[0] : key;
  if (!SOUL_CLASSES[baseK]) return;
  const rec = G.codex.job[key];
  rank = Math.max(1, Math.min(5, rank || (rec && rec.rank) || 1));
  const color = SOUL_CLASSES[baseK].glow;
  const wrap = el("div", "confirm-overlay");
  const card = el("div", "ig-card cdx-detail");
  card.style.borderColor = color;
  card.style.boxShadow = `0 0 40px ${color}44`;
  if (heading) {
    const hd = el("div", "ig-name", heading);
    hd.style.color = color;
    card.appendChild(hd);
  }
  const ban = el("div", "ig-banner", `ランク${rank}`);
  ban.style.color = color;
  card.appendChild(ban);
  const art = el("div", "ig-art");
  art.appendChild(spriteCanvas(jobSprite(baseK, rank), 9));
  card.appendChild(art);

  const line = (name, desc) => {
    const r = el("div", "cdx-drow");
    r.appendChild(el("span", "cdx-dn", name));
    if (desc) r.appendChild(el("span", "cdx-skd", desc));
    return r;
  };

  card.appendChild(el("div", "ig-name", jobRankName(key, rank)));
  if (false) {
    // 混成職は廃止
  } else {
    const lore = jobLoreFor(key, rank);
    card.appendChild(el("div", "cdx-elem", `${SOUL_CLASSES[key].label}系`));
    if (lore.desc) card.appendChild(el("div", "ig-desc", lore.desc));
    if (lore.tips) card.appendChild(el("div", "ig-desc cdx-tips", "活用: " + lore.tips));
  }

  // 発現の条件 (この位階に到達するための魂の組み合わせと品質)
  const cbox = el("div", "cdx-drops");
  cbox.appendChild(el("div", "cdx-h", "発現の条件"));
  cbox.appendChild(el("div", "cdx-dun", `・${jobRankCondText(key, rank)}`));
  const upPct = Math.round((SOUL_STAT_UP[SOUL_CLASSES[key].rarity] || 0.01) * 100);
  cbox.appendChild(el("div", "cdx-dun dim", `・魂を1つ吸収するごと、全能力 基礎値×${upPct}% UP`));
  card.appendChild(cbox);

  // 装備適性 (基本職のみ)
  if (!isHybrid && JOB_GEAR[key]) {
    const gbox = el("div", "cdx-drops");
    gbox.appendChild(el("div", "cdx-h", "装備適性"));
    const g = JOB_GEAR[key];
    if (g.weapons) gbox.appendChild(el("div", "cdx-dun", `・武器: ${g.weapons.map(w => WEAPON_CAT_LABEL[w] || w).join("・")}`));
    const armorLabel = g.armor === "heavy" ? "重装可" : g.armor === "light" ? "軽装まで" : "布装のみ";
    gbox.appendChild(el("div", "cdx-dun", `・防具: ${armorLabel}`));
    gbox.appendChild(el("div", "cdx-dun", `・盾: ${g.shield ? "装備可" : "不可"}`));
    card.appendChild(gbox);
  }

  // パッシブ: この位階で有効な効果。上位ランクは下位を内包するため、
  // ランク2〜rank の表を高い方から畳み込み、上位に呑まれた同系統の下位Lvは省く
  const pbox = el("div", "cdx-drops");
  pbox.appendChild(el("div", "cdx-h", "パッシブ"));
  const pTbl = jobPassiveTable(key);
  const claimed = {};
  const actives = [];
  for (let r = Math.min(rank, 5); r >= 2; r--) {
    const e = pTbl[r - 2];
    if (!e || !Object.entries(e.grants).some(([k, lv]) => lv > (claimed[k] || 0))) continue;
    for (const k in e.grants) claimed[k] = Math.max(claimed[k] || 0, e.grants[k]);
    actives.unshift(e);
  }
  for (const e of actives) pbox.appendChild(line(e.name, e.desc));
  if (!actives.length) pbox.appendChild(el("div", "cdx-dun dim", "・なし (ランク2以上で発現)"));
  card.appendChild(pbox);

  // 職業スキル表: このランクのLv上限まで覚える技・パッシブを載せ、
  // 実際に到達したLvのものだけ開示する (新仕様: ランク×10ゲート撤廃)
  const reached = (rec && typeof rec === "object" && rec.lv) || 0;
  // このランクに到達した時点の魂数を起点に、吸収式のLv上限を求める (到達済みLvが上回ればそちらを優先)
  const capCount = (rankThresholds(SOUL_CLASSES[key].rarity)[rank - 1]) || 1;
  const lvCap = Math.max(soulLevelCap(key, capCount), reached);
  const sbox = el("div", "cdx-drops");
  for (const e of jobSkillTable(key)) {
    if (e.lvl > lvCap) continue;
    const r = el("div", "cdx-drow");
    r.appendChild(el("span", "cdx-sklv", `Lv${e.lvl}`));
    if (e.passive) {
      // レベル表に織り込まれたパッシブ
      if (reached >= e.lvl) {
        r.appendChild(el("span", "cdx-dn", passiveName(e.passive, e.plv || 1)));
        r.appendChild(el("span", "cdx-skd", `[パッシブ] ${passiveDesc(e.passive, e.plv || 1)}`));
      } else {
        r.appendChild(el("span", "cdx-dn dim", "？？？"));
      }
    } else {
      const sp = SPELLS[e.skill];
      if (reached >= e.lvl && sp) {
        r.appendChild(el("span", "cdx-dn", sp.name));
        r.appendChild(el("span", "cdx-skd", `${sp.desc} (MP${sp.mp})`));
        r.classList.add("cdx-sktap");
        r.addEventListener("click", () => showSkillPopup(e.skill));
      } else {
        r.appendChild(el("span", "cdx-dn dim", "？？？"));
      }
    }
    sbox.appendChild(r);
  }
  card.appendChild(sbox);

  const ok = btn("閉じる", () => wrap.remove());
  ok.className = "btn primary ig-ok";
  card.appendChild(ok);
  wrap.appendChild(card);
  wrap.addEventListener("click", (e) => { if (e.target === wrap) wrap.remove(); });
  document.body.appendChild(wrap);
}

// ---- 宿屋: 全回復 ----
function innCost() { return G.party.length * 12 + G.maxFloorReached * 6; }
function renderInn() {
  townEl.appendChild(townHeader("宿屋「白狼」"));
  townEl.appendChild(el("div", "tw-lead", "一晩の休息で、生きた人業のHP・MPが全快する。"));
  const cost = innCost();
  const need = G.party.filter((p) => p.alive && (p.hp < p.maxhp || p.mp < p.maxmp));
  const info = el("div", "tw-innbox");
  info.appendChild(el("div", "tw-innc", `宿賃 💰${cost}`));
  info.appendChild(el("div", "tw-note", need.length ? `${need.length}体が休息を必要としている` : "全員すこぶる元気だ"));
  townEl.appendChild(info);
  const rest = btn(`🛏 泊まる (💰${cost})`, () => {
    if (G.gold < cost) { log("お金が足りない。", "sys"); return; }
    G.gold -= cost;
    for (const p of G.party) { if (p.alive) { p.hp = p.maxhp; p.mp = p.maxmp; p.ailment = null; } }
    SFX.heal(); buzz(20);
    log("ぐっすり眠った。HPとMPが全快した。", "heal");
    renderTown();
  });
  rest.className = "btn primary";
  if (G.gold < cost || !need.length) rest.disabled = true;
  townEl.appendChild(rest);
}

// ---- 帰還システム: 死亡した人業は他の冒険者が街へ連れ帰る (時間経過 or Red Soul短縮) ----
// 連れ帰り時間: 死亡した階層が深いほど長い。
//   1〜5階=5分 / 6〜10階=10分 / … 5階ごとに+5分、最大120分
function rescueDurationMs(floor) {
  const minutes = Math.min(120, Math.ceil((floor || 1) / 5) * 5);
  return minutes * 60 * 1000;
}

// 死亡を検知して連れ帰りタイマーをセット (imprintFallen から呼ばれる)
function setReviveTimers() {
  const now = Date.now();
  for (const d of allDolls()) {
    if (d.isDoll && !d.alive && !d.reviveAt) {
      d.diedFloor = G.floor;
      d.reviveAt = now + rescueDurationMs(G.floor);
    }
  }
}

// 残り時間の表示 "1:23:45" / "23:45"
function fmtRemain(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const mm = String(m).padStart(2, "0"), ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

// 帰還タイマーの「生きた」表示要素を作る。class js-revt + dataset を持ち、
// 下の 1秒ごとのティッカーが残り時間をリアルタイムに描き替える (全画面再描画はしない)。
function reviveTimerEl(tag, cls, prefix, d) {
  const at = (d.reviveAt || Date.now());
  const node = el(tag, cls, prefix + fmtRemain(Math.max(0, at - Date.now())));
  node.classList.add("js-revt");
  node.dataset.reviveAt = String(at);
  node.dataset.prefix = prefix;
  return node;
}

// 帰還タイマーを1秒ごとに更新 (DOMのテキストだけ書き替え、秒数が1秒ずつ減る)
setInterval(() => {
  const now = Date.now();
  for (const node of document.querySelectorAll(".js-revt")) {
    const at = Number(node.dataset.reviveAt) || now;
    node.textContent = (node.dataset.prefix || "") + fmtRemain(Math.max(0, at - now));
  }
}, 1000);

// 砕けた人業をすべてHP1で生還させる (生存者がいる帰還・赤い魂帰還で使う)
function reviveAllAtHp1() {
  for (const d of allDolls()) {
    if (d.isDoll && !d.alive) {
      d.alive = true;
      d.hp = 1;
      d.ailment = null;
      d.reviveAt = null;
      d._dead = false;
      log(`${d.name} はHP1で生還した。`, "win");
    }
  }
}

// 復活実行 (連れ帰り完了)
function reviveDoll(d, byRedSoul = false) {
  d.alive = true;
  d.hp = Math.max(1, Math.floor(d.maxhp * 0.5));
  d.ailment = null;
  d.reviveAt = null;
  d._dead = false;
  SFX.levelup(); buzz([0, 30, 40, 30]);
  log(`${d.name} が街に連れ戻された。${byRedSoul ? "(赤い魂の力)" : ""}`, "win");
  showToast(`✨ ${d.name} が帰還した`);
}

// Red Soul で連れ帰り時間を 20分短縮 (1消費)。残り20分以下なら即帰還
const RESCUE_SHORTEN_MS = 20 * 60 * 1000;
function tryHastenRescue(d) {
  if (G.redSoul < 1) { log("Red Soul が足りない。", "sys"); return; }
  G.redSoul -= 1;
  d.reviveAt -= RESCUE_SHORTEN_MS;
  if (d.reviveAt <= Date.now()) reviveDoll(d, true);
  else { SFX.select(); buzz(15); log(`${d.name} の帰還を早めた。`, "sys"); }
  if (G.statusOpen) renderStatus();
  if (G.state === "town") renderTown();
  renderParty();
}

// 連れ帰りタイマーの監視 (5秒ごと)。満了した人業を自動帰還させる
setInterval(() => {
  const now = Date.now();
  let revived = false;
  for (const d of allDolls()) {
    if (d.isDoll && !d.alive && d.reviveAt && now >= d.reviveAt) { reviveDoll(d); revived = true; }
  }
  if (revived) {
    if (G.statusOpen) renderStatus();
    if (G.state === "town") renderTown();
    renderParty();
  }
}, 5000);

// ---- 赤い魂の祠: Red Soul の入手 (広告/課金) ----
let _adCooldownUntil = 0;
function renderShrine() {
  townEl.appendChild(townHeader("赤い魂の祠"));
  townEl.appendChild(el("div", "tw-lead", "赤く脈打つ魂「Red Soul」を授かる祠。空の人業を買い、絶望の淵で加護をもたらす。"));

  const box = el("div", "tw-innbox");
  box.appendChild(el("div", "tw-innc red", `🔴 ${G.redSoul}`));
  box.appendChild(el("div", "tw-note", "所持 Red Soul"));
  townEl.appendChild(box);

  // 広告動画 (シミュレート): クールダウン付き
  const now = Date.now();
  const onCd = now < _adCooldownUntil;
  const ad = btn(onCd ? `広告は準備中… (${Math.ceil((_adCooldownUntil - now) / 1000)}s)` : "🎬 広告動画を見る (+🔴10)", () => {
    if (Date.now() < _adCooldownUntil) return;
    log("広告動画を視聴した…", "sys");
    G.redSoul += 10;
    _adCooldownUntil = Date.now() + 30000; // 30秒クールダウン
    SFX.itemget(); buzz([0, 30, 60, 30]);
    showToast("🔴 Red Soul を 10 授かった");
    renderTown();
  });
  ad.className = "btn primary tw-add";
  if (onCd) ad.disabled = true;
  townEl.appendChild(ad);

  // 課金 (プレースホルダ)
  const packs = [{ n: 100, label: "🔴100" }, { n: 500, label: "🔴500 (お得)" }, { n: 1200, label: "🔴1200 (特盛)" }];
  townEl.appendChild(el("div", "tw-h", "Red Soul を購入"));
  const buy = el("div", "tw-mlist");
  for (const p of packs) {
    const row = el("div", "tw-mrow");
    row.appendChild(el("div", "tw-chipn", p.label));
    const b = btn("購入", () => {
      // 実課金は未対応。デモとして付与
      G.redSoul += p.n;
      SFX.itemget();
      log(`(デモ) Red Soul を ${p.n} 入手した。`, "win");
      showToast(`🔴 Red Soul +${p.n}`);
      renderTown();
    });
    b.className = "tw-small";
    row.appendChild(b);
    buy.appendChild(row);
  }
  townEl.appendChild(buy);
  townEl.appendChild(el("div", "tw-note", "※ 課金は本デモでは無償付与されます。"));

  townEl.appendChild(el("div", "tw-h", "Red Soul の使い道"));
  townEl.appendChild(el("div", "tw-lead",
    `・空の人業の購入 (人業の館)\n・死亡人業の帰還を早める (🔴1)\n・全滅時、🔴${GUARDIAN_COST} で戦利品を守って帰還`));
}

// ---- 商店: 装備・道具の売買 ----
// 商店の初期在庫 (個数つき)。ダンジョン産を売ると在庫に積まれ、買い直せる (ボルタック方式)
const SHOP_INIT_STOCK = {
  herb: 5, antidote: 5, manaDrop: 3,
  dagger: 2, shortSword: 1, magicStaff: 1, warHammer: 1,
  woodShield: 1, leatherArmor: 1, robe: 1, cap: 2, leatherBoots: 2, leatherGloves: 2,
};
// 商店タブ: アイテム分類 (items.js の ITEM_CATS) ごとに切り替え
const SHOP_TABS = ITEM_CATS;
let shopTab = "weapon";
let shopWeaponCat = "all"; // 商店の武器タブのサブカテゴリ (長剣/短剣/…)
let shopMember = 0; // 取引する編成メンバーの index
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

// 商店: 上=在庫 (内部スクロール) / 下=取引相手の選択と所持品。
// ページ全体は縦スクロールさせず、在庫リストだけが内部でスクロールする。
function renderShop() {
  townEl.classList.add("shop-mode");
  townEl.appendChild(townHeader("黒鉄商会"));

  if (shopMember >= G.party.length) shopMember = 0;
  const who = G.party[shopMember] || null;

  // カテゴリタブ (売却は下の所持品タップで行う)
  const tabs = el("div", "tw-dolltabs shop-tabs");
  for (const t of SHOP_TABS) {
    const b = btn(t.label, () => { shopTab = t.key; renderTown(); });
    b.className = "tw-dolltab" + (shopTab === t.key ? " active" : "");
    tabs.appendChild(b);
  }
  townEl.appendChild(tabs);

  // 武器タブは図鑑と同じくサブカテゴリ (長剣/短剣/…) で絞り込める
  const tabDef = SHOP_TABS.find((t) => t.key === shopTab) || SHOP_TABS[0];
  if (tabDef.key === "weapon") {
    const subs = el("div", "tw-dolltabs shop-tabs");
    for (const c of [{ key: "all", label: "すべて" }, ...WEAPON_CATS]) {
      const b = btn(c.label, () => { shopWeaponCat = c.key; renderTown(); });
      b.className = "tw-dolltab" + (shopWeaponCat === c.key ? " active" : "");
      subs.appendChild(b);
    }
    townEl.appendChild(subs);
  }

  // 在庫 (内部スクロール領域)。カテゴリ順 → 売却額の安い順に並べる
  const stock = el("div", "shop-stock");
  // 並び順キー: 武器はサブカテゴリ (WEAPON_CATS) 順、その他はアイテム分類 (ITEM_CATS) 順
  const catOrder = (it) => {
    if (it.cat) { const i = WEAPON_CATS.findIndex((c) => c.key === it.cat); return i < 0 ? 99 : i; }
    const i = ITEM_CATS.findIndex((c) => c.slots.includes(it.slot)); return i < 0 ? 99 : i;
  };
  const ids = Object.keys(G.shopStock).filter((id) => {
    const it = ITEMS[id];
    if (!it || !tabDef.slots.includes(it.slot)) return false;
    if (tabDef.key === "weapon" && shopWeaponCat !== "all" && it.cat !== shopWeaponCat) return false;
    return G.shopStock[id] > 0;
  }).sort((a, b) => {
    const ia = ITEMS[a], ib = ITEMS[b];
    return catOrder(ia) - catOrder(ib) || sellPrice(ia) - sellPrice(ib) || ia.name.localeCompare(ib.name);
  });
  let any = false;
  for (const id of ids) {
    const it = ITEMS[id];
    const count = G.shopStock[id];
    any = true;
    const price = buyPrice(it);
    // 選択中キャラが装備できる品は色を変えて目立たせる
    const canEq = isEquippable(it) && who && who.alive && canEquip(who, it);
    const r = el("div", "tw-shoprow" + (canEq ? " equip-ok" : ""));
    if (itemRankColor(it)) r.style.borderColor = itemRankColor(it);
    const ic = el("span", "tw-chips"); ic.appendChild(spriteCanvas(it, 2)); r.appendChild(ic);
    const info = el("div", "tw-chipi");
    const nm = el("div", "tw-chipn", `${it.name} 在庫 : ${count}`);
    if (canEq) nm.appendChild(el("span", "shop-eqmark", "✓装備可"));
    info.appendChild(nm);
    info.appendChild(el("div", "tw-chipc", it.desc || ""));
    r.appendChild(info);
    // アイテム部をタップで詳細ポップアップ (購入もそこから)
    info.style.cursor = "pointer";
    info.addEventListener("click", () => { SFX.select(); showShopItemDetail(id, price); });
    const b = btn(`💰${price}`, () => buyItem(id, price));
    b.className = "tw-small";
    if (G.gold < price || !who || !who.alive || who.items.length >= MAX_ITEMS) b.disabled = true;
    r.appendChild(b);
    stock.appendChild(r);
  }
  if (!any) stock.appendChild(el("div", "tw-empty", "この種類の在庫は売り切れだ。"));
  townEl.appendChild(stock);

  // ---- 下部: 取引相手の選択 + 所持品 (タップで売却) ----
  const dock = el("div", "shop-dock");
  // メンバー選択チップ (横並び)
  const mrow = el("div", "shop-members");
  G.party.forEach((m, i) => {
    const chip = el("div", "shop-member" + (i === shopMember ? " sel" : "") + (m.alive ? "" : " dead"));
    if (m.dominant) {
      const o = el("span", "tw-chips");
      o.style.color = SOUL_CLASSES[m.dominant.clsKey].glow;
      o.appendChild(spriteCanvas(dollSprite(m), 2));
      chip.appendChild(o);
    }
    chip.appendChild(el("span", "shop-mname", m.name));
    chip.addEventListener("click", () => { shopMember = i; SFX.select(); renderTown(); });
    mrow.appendChild(chip);
  });
  dock.appendChild(mrow);

  // 選択中メンバーの所持品グリッド (8枠固定)。タップで売る
  if (who) {
    dock.appendChild(el("div", "shop-bagh", `${who.name} の所持品 (${who.items.length}/${MAX_ITEMS}) — タップで詳細`));
    const bag = el("div", "shop-bag");
    for (let i = 0; i < MAX_ITEMS; i++) {
      const it = who.items[i];
      const cellEl = el("div", "shop-slot" + (it ? "" : " empty"));
      if (it) {
        cellEl.appendChild(spriteCanvas(it, 2));
        if (it.unidentified) { cellEl.classList.add("shop-unid"); cellEl.appendChild(el("span", "shop-price", `🔍${appraiseCost(it)}`)); }
        else cellEl.appendChild(el("span", "shop-price", `💰${sellPrice(it)}`));
        cellEl.title = itemName(it);
        cellEl.addEventListener("click", () => it.unidentified ? showAppraisePrompt(who, it) : showSellPrompt(who, it));
      }
      bag.appendChild(cellEl);
    }
    dock.appendChild(bag);
    // 一括鑑定 (左) ・ 一括売却 (右) を横並びで配置
    const unid = who.items.filter((it) => it.unidentified);
    // 一括売却の対象から、スーパーレア・レジェンドレアと未奉納の蒐集品は外す (誤って手放さないように)
    const sellable = who.items.filter((it) => !it.cursed && !it.unidentified && !sellWarnings(it).length);
    if (unid.length > 0 || sellable.length > 0) {
      const actions = el("div", "shop-actions");
      actions.style.display = "flex";
      actions.style.gap = "8px";
      if (unid.length > 0) {
        const idTotal = unid.reduce((s, it) => s + appraiseCost(it), 0);
        const idBtn = btn(`一括鑑定 (${unid.length}点 / 💰${idTotal})`, () => {
          showConfirm({
            title: "未鑑定品をまとめて鑑定しますか？",
            lines: [`${who.name}の未鑑定品 ${unid.length}点を、安い順に所持金が続く限り鑑定します。`,
              `最大で 💰${idTotal} を支払います（所持金 💰${G.gold}）。`],
            okLabel: "鑑定する",
            onOk: () => bulkIdentify(who),
          });
        });
        idBtn.className = "btn tw-add";
        idBtn.style.flex = "1";
        if (G.gold < appraiseCost(unid[0])) idBtn.disabled = true; // 1点も鑑定できないなら無効
        actions.appendChild(idBtn);
      }
      if (sellable.length > 0) {
        const total = sellable.reduce((s, it) => s + sellPrice(it), 0);
        const bulkBtn = btn(`一括売却 (${sellable.length}点 / 💰${total})`, () => {
          showConfirm({
            title: "持ち物をまとめて売却しますか？",
            lines: [`${who.name}の売却可能な ${sellable.length}点 をすべて売ります。`,
              `合計 💰${total} を獲得します。`,
              "※ スーパーレア・レジェンドレアと未奉納の蒐集品は含みません（売るなら個別に）。"],
            okLabel: "売却する",
            onOk: () => { for (const it of sellable) sellItem(who, it, sellPrice(it)); },
          });
        });
        bulkBtn.className = "btn tw-add";
        bulkBtn.style.flex = "1";
        actions.appendChild(bulkBtn);
      }
      dock.appendChild(actions);
    }
  } else {
    dock.appendChild(el("div", "tw-empty", "編成に人業がいない。"));
  }
  townEl.appendChild(dock);
}

// 商店: 在庫アイテムの詳細をポップアップ表示し、その場で購入もできる
function showShopItemDetail(id, price) {
  const it = ITEMS[id];
  if (!it) return;
  const who = G.party[shopMember] || null;
  const wrap = el("div", "confirm-overlay");
  const card = el("div", "ig-card cdx-detail");
  const rc = itemRankColor(it);
  if (rc) { card.style.borderColor = rc; card.style.boxShadow = `0 0 40px ${rc}66`; }
  const ban = el("div", "ig-banner", itemGradeText(it, "アイテム"));
  if (rc) ban.style.color = rc;
  card.appendChild(ban);
  const art = el("div", "ig-art"); art.appendChild(spriteCanvas(it, 11)); card.appendChild(art);
  card.appendChild(el("div", "ig-name", it.name + (it.cursed ? " 🔒" : "")));
  for (const line of detailLines(it)) card.appendChild(el("div", "ig-stat", line));
  // 選択中キャラが装備した場合のステータス増減 (装備可能な品のみ)
  if (who && isEquippable(it)) {
    if (canEquip(who, it)) card.appendChild(equipCompareEl(who, it));
    else card.appendChild(el("div", "ig-stat dim", `${who.name} は装備できない`));
  }
  if (it.desc) card.appendChild(el("div", "ig-desc", it.desc));
  const count = G.shopStock[id] || 0;
  card.appendChild(el("div", "ig-who", `在庫 ${count}・買値 💰${price}`));
  const list = el("div", "ig-choices");
  const buy = btn(`💰${price} で買う`, () => { wrap.remove(); buyItem(id, price); });
  buy.classList.add("primary");
  if (G.gold < price || !who || !who.alive || who.items.length >= MAX_ITEMS || count <= 0) buy.disabled = true;
  list.appendChild(buy);
  list.appendChild(btn("閉じる", () => wrap.remove()));
  card.appendChild(list);
  wrap.appendChild(card);
  wrap.addEventListener("click", (e) => { if (e.target === wrap) wrap.remove(); });
  document.body.appendChild(wrap);
}

// 商店: 未鑑定品の鑑定/売却を選ぶ。鑑定料は売値と同額で、必ず成功する (商店の確実さ)。
function showAppraisePrompt(owner, it) {
  const cost = appraiseCost(it); // 鑑定料 (LRは同帯の約20倍)
  const wrap = el("div", "confirm-overlay");
  const card = el("div", "ig-card");
  card.style.borderColor = "#7fd0ff";
  card.style.boxShadow = "0 0 40px #7fd0ff55";
  card.appendChild(el("div", "ig-banner", "🔍 未鑑定の品"));
  const art = el("div", "ig-art"); art.appendChild(spriteCanvas(it, 9)); card.appendChild(art);
  card.appendChild(itemNameEl("div", "ig-name", it));
  for (const line of detailLines(it)) card.appendChild(el("div", "ig-stat", line));
  const warn = el("div", "ig-stat", "⚠ 未鑑定のアイテムです。正体不明のまま売ると 💰0 で引き取られ、商店にも並びません。先に鑑定するのがおすすめです。");
  warn.style.color = "#ff8fc4";
  warn.style.fontWeight = "bold";
  card.appendChild(warn);
  card.appendChild(el("div", "ig-who", `鑑定料 💰${cost}・正体不明のまま売っても 💰0 (商店に並ばない)`));
  const list = el("div", "ig-choices");
  const idb = btn(`💰${cost} で鑑定する`, () => { wrap.remove(); shopIdentify(owner, it); });
  idb.classList.add("primary");
  if (G.gold < cost) idb.disabled = true;
  list.appendChild(idb);
  list.appendChild(makeDanger(`💰0 で売る (正体不明のまま)`, () => { wrap.remove(); sellItem(owner, it, 0); }));
  list.appendChild(btn("やめる", () => wrap.remove()));
  card.appendChild(list);
  wrap.appendChild(card);
  wrap.addEventListener("click", (e) => { if (e.target === wrap) wrap.remove(); });
  document.body.appendChild(wrap);
}

// 商店で鑑定する: 鑑定料を払い、必ず正体を明かす
function shopIdentify(owner, it) {
  const cost = appraiseCost(it);
  if (G.gold < cost) { log("お金が足りない。", "sys"); return; }
  G.gold -= cost;
  it.unidentified = false;
  it.idHardFail = false;
  SFX.itemget(); buzz(15);
  log(`鑑定料 💰${cost} を払った。${it.name} と判明した！`, "win");
  showToast(`🔍 ${it.name}`);
  renderTown();
}

// 商店で一括鑑定: 所持品の未鑑定品を、所持金が続く限り安い順に鑑定する
function bulkIdentify(owner) {
  const unid = owner.items.filter((it) => it.unidentified).sort((a, b) => appraiseCost(a) - appraiseCost(b));
  let n = 0, spent = 0;
  for (const it of unid) {
    const cost = appraiseCost(it);
    if (G.gold < cost) break;
    G.gold -= cost; spent += cost;
    it.unidentified = false; it.idHardFail = false;
    n++;
  }
  if (n > 0) {
    SFX.itemget(); buzz(15);
    log(`一括鑑定: ${n}点を鑑定した (💰${spent})。`, "win");
    showToast(`🔍 ${n}点を鑑定`);
  } else { log("お金が足りない。", "sys"); SFX.ng(); }
  renderTown();
}

// 売却時に注意を促すべき品か判定し、警告文を返す (未奉納蒐集品 / LR専用装備)
function sellWarnings(it) {
  const out = [];
  if (it.slot === "misc" && it.id && !treasuryState().donated[it.id]) {
    out.push("⚠ まだ宝物庫に奉納していない蒐集品です。売ると奉納できなくなり、図鑑の褒賞を取り逃します。");
  }
  if (rarityKey(it) === "lr") {
    out.push("⚠ レジェンドレアです。二度と手に入らない1点ものです。本当に売りますか？");
  } else if (rarityKey(it) === "sr") {
    out.push("⚠ スーパーレアです。めったに手に入らない逸品です。本当に売りますか？");
  }
  return out;
}

// 商店: アイテム情報を表示し、売却するか選ぶ (宝箱演出と同じカード)
function showSellPrompt(owner, it) {
  const price = sellPrice(it);
  const warns = sellWarnings(it);
  const wrap = el("div", "confirm-overlay");
  const card = el("div", "ig-card");
  card.style.borderColor = warns.length ? "#ff5fae" : "#c9a227";
  card.style.boxShadow = `0 0 40px ${warns.length ? "#ff5fae55" : "#c9a22755"}`;
  card.appendChild(el("div", "ig-banner", warns.length ? "⚠ 売却の確認" : "🛒 売却の確認"));
  const art = el("div", "ig-art"); art.appendChild(spriteCanvas(it, 9)); card.appendChild(art);
  card.appendChild(itemNameEl("div", "ig-name", it, it.cursed ? " 🔒" : ""));
  // 性能・説明
  for (const line of detailLines(it)) card.appendChild(el("div", "ig-stat", line));
  if (it.desc) card.appendChild(el("div", "ig-desc", it.desc));
  // 注意喚起 (未奉納蒐集品 / LR専用装備)
  for (const w of warns) {
    const wl = el("div", "ig-stat", w);
    wl.style.color = "#ff8fc4";
    wl.style.fontWeight = "bold";
    card.appendChild(wl);
  }
  card.appendChild(el("div", "ig-who", `売値 💰${price} (在庫に並びます)`));
  const list = el("div", "ig-choices");
  const sell = btn(warns.length ? `⚠ 💰${price} で売る` : `💰${price} で売る`, () => { wrap.remove(); sellItem(owner, it, price); });
  sell.classList.add("danger");
  list.appendChild(sell);
  list.appendChild(btn("やめる", () => wrap.remove()));
  card.appendChild(list);
  wrap.appendChild(card);
  wrap.addEventListener("click", (e) => { if (e.target === wrap) wrap.remove(); });
  document.body.appendChild(wrap);
}

function sellItem(owner, it, price) {
  const idx = owner.items.indexOf(it);
  if (idx < 0) return;
  // 未鑑定品は正体不明のため二束三文 (0G) で引き取られ、商店にも並ばない
  if (it.unidentified) price = 0;
  owner.items.splice(idx, 1);
  G.gold += price;
  // 在庫に積む (ボルタック方式)。未鑑定品は並ばない
  if (it.id && !it.unidentified) G.shopStock[it.id] = (G.shopStock[it.id] || 0) + 1;
  codexSeeItem(it.id);
  SFX.select(); buzz(10);
  const shown = itemName(it);
  log(`${shown} を売った (+💰${price})。${it.unidentified ? "" : "商店に並んだ。"}`, "win");
  showToast(`💰+${price} ${shown} を売却`);
  renderTown();
}

function buyItem(id, price) {
  if (G.gold < price) { log("お金が足りない。", "sys"); return; }
  if ((G.shopStock[id] || 0) <= 0) { log("在庫切れだ。", "sys"); return; }
  const who = G.party[shopMember];
  if (!who || !who.alive) { log("取引する人業を選ぼう。", "sys"); return; }
  if (who.items.length >= MAX_ITEMS) { log(`${who.name} の所持品がいっぱいだ。`, "sys"); return; }
  const it = cloneItem(id);
  if (!it) return;
  G.gold -= price;
  G.shopStock[id]--;
  who.items.push(it);
  codexSeeItem(id);
  SFX.itemget(); buzz(10);
  log(`${it.name} を購入した (${who.name})。`, "win");
  renderTown();
}

// ---- 街 ⇄ 迷宮 の出入り ----
function tryEnterDungeon() {
  if (G.unlockedDungeons < 1) { log("王の勅命を受けるまで、迷宮には入れない。", "sys"); return; }
  if (G.dungeonIdx >= CONTENT_LIMIT) { G.dungeonIdx = Math.min(CONTENT_LIMIT, G.unlockedDungeons) - 1; renderTown(); showToast("🔒 その先は準備中だ"); return; }
  if (!G.party.some((p) => p.alive)) { log("動ける人業がいない。", "sys"); return; }
  // チュートリアル後、初めて迷宮へ潜る際は警備兵が注意事項を説明する (1回のみ)
  if (!G.dungeonBriefed) {
    G.dungeonBriefed = true;
    autosave(true);
    showDungeonBriefing(() => tryEnterDungeon());
    return;
  }
  // 出立前の点検: 少人数・丸腰・手負いのまま潜ろうとしていれば、警備兵が直し方を示す
  // (序盤は1体・素手だと浅階の群れにも押し切られる)。「このまま潜る」を選べば以後このセッションでは出さない
  const chk = !_diveCheckShown ? preDiveIssues() : null;
  if (chk && chk.lines.length) {
    _diveCheckShown = true;
    const opts = [];
    if (chk.dolls) opts.push({ label: "＋ 保管庫で人業を仕立てる", fn: () => { G.town.facility = "mansion"; G.town.sub = "manage"; renderTown(); } });
    if (chk.gear) opts.push({ label: "⚒ 商店で武具を整える", fn: () => { G.town.facility = "shop"; G.town.sub = null; renderTown(); } });
    if (chk.rest) opts.push({ label: "☾ 宿屋で傷を癒す", fn: () => { G.town.facility = "inn"; G.town.sub = null; renderTown(); } });
    opts.push({ label: "▼ このまま潜る", danger: true, fn: () => tryEnterDungeon() });
    SFX.select();
    showChoice("出立前の点検", opts, ICONS.guard, {
      banner: "⚔ 警備兵の助言 ⚔", accent: "#7fd0ff",
      lines: ["「待て、魂繰り。その備えで行く気か？」", ...chk.lines],
    });
    return;
  }
  // 迷宮の異変: D3以降、一定確率で発生。受け入れるか避けるかを選んでから潜る
  if (G.dungeonIdx >= 2 && Math.random() < 0.45) {
    const cfg = curDungeon();
    const pool = MUTATORS.filter((m) => !m.cond || m.cond(cfg));
    const cand = pool[rand(pool.length)];
    if (cand) {
      SFX.trap(); buzz([0, 30, 40, 30]);
      showChoice(`${cand.sym}「${cand.name}」`, [
        { label: `${cand.sym} 異変ごと潜る`, danger: true, fn: () => enterDungeon(cand.id) },
        { label: "▼ 異変が鎮まるのを待って潜る", fn: () => enterDungeon(null) },
      ], ICONS.stairs, {
        banner: "⚠ 迷宮の異変 ⚠", accent: cand.accent,
        lines: [`${cfg.name}の様子がおかしい…`, `⚠ ${cand.risk}`, `✨ ${cand.gain}`],
      });
      return;
    }
  }
  enterDungeon(null);
}

// 出立前の点検項目: { lines[], dolls, gear, rest }。直せるものだけを挙げる
let _diveCheckShown = false;
function preDiveIssues() {
  const lines = [];
  const res = { lines, dolls: false, gear: false, rest: false };
  // 仲間が少ない (宿せる魂と器の余裕がある時だけ)
  const free = G.souls.filter((s) => !soulWorn(s.uid)).length;
  if (G.party.length < 3 && free > 0 && allDolls().length < 100 && G.redSoul >= emptyDollCost()) {
    const cost = emptyDollCost();
    lines.push(`■ 編成が ${G.party.length}体 だけだ。魔物は群れで来る。宿せる魂が ${free}個 ある (次の器 ${cost ? `🔴${cost}` : "無料"})。`);
    res.dolls = true;
  }
  // 武器を持たない人業がいる (買える所持金がある時だけ)
  const bare = G.party.filter((d) => d.alive && d.primary != null && !(d.equip && d.equip.weapon));
  if (bare.length && G.gold >= 30) {
    lines.push(`■ ${bare.map((d) => d.name).join("・")} は丸腰だ。商店で武器と防具を整えておけ。`);
    res.gear = true;
  }
  // 手負いの人業がいる
  const hurt = G.party.filter((d) => d.alive && d.hp < d.maxhp * 0.5);
  if (hurt.length) {
    lines.push(`■ ${hurt.map((d) => d.name).join("・")} が深手を負ったままだ。宿屋で休んでいけ。`);
    res.rest = true;
  }
  return res;
}

// 初回潜入時、警備兵が迷宮の鉄則を説く (注意事項のポップアップ)
function showDungeonBriefing(onClose) {
  showEvent({
    sprite: ICONS.guard,
    banner: "⚔ 警備兵の忠告 ⚔",
    title: "迷宮へ入る前に",
    lines: [
      "「待て、魂繰り。初めて潜るなら、これだけは胸に刻んでおけ。」",
      "■ 一度迷宮に入ったら、迷宮の主（ボス）を倒すか「帰還魔法陣」を見つけるまで街へは戻れない。",
      "■ 全滅すれば、その探索で得たゴールド・アイテム・魂はすべて失う。（蓄積した ✦Soul だけは残る）",
      "「…赤い魂があれば、全滅しても何もかも失わずに帰る道はある。励めよ。」",
    ],
    accent: "#7fd0ff",
    btnLabel: "心得た",
    onClose,
  });
}

// 潜入の実体。mutatorId を渡すと「迷宮の異変」を受け入れた状態で潜る
function enterDungeon(mutatorId) {
  G.mutator = mutatorId || null;
  G.bossDown = false; // 帰還制限: 魔法陣を見つけるか主を討つまで帰れない
  SFX.stairs();
  townEl.classList.add("hidden");
  G.town.facility = null; G.town.sub = null;
  G.floor = 1; // 迷宮は常に1階から (街に戻ると入り直し)
  G.eliteFloor = false; // 1Fは強敵階・特別階にならない
  G.specialFloor = null;
  G.stats.runs++;
  // 今回の戦利品トラッキングを初期化
  G.run = { gold: 0, soulPts: 0, items: [], souls: [] };
  // 表示中の噂を確定し、この迷宮で現実化させる
  if (G.rumor) { G.activeRumor = { ...G.rumor, floor: G.floor }; G.rumor = null; }
  // 納品依頼は迷宮に潜るたびに入れ替わる
  G.deliveryQuests = rollDeliveryQuests();
  G.state = "board";
  playBgm(fieldBgm());
  if (descendBtn) { descendBtn.classList.add("hidden"); descendBtn.disabled = true; }
  newFloor();
  const mu = mutDef();
  if (mu) log(`${mu.sym} 異変「${mu.name}」の中を行く。${mu.gain}。`, "win");
  renderBoard();
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
  townEl.classList.add("hidden");
  G.town.facility = null; G.town.sub = null;
  G.floor = 1;
  G.dungeonIdx = abyssBaseN(1) - 1;
  G.eliteFloor = false;
  G.specialFloor = null;
  G.stats.runs++;
  G.run = { gold: 0, soulPts: 0, items: [], souls: [] };
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
}

// 潜入前の支度画面: 誓約の選択・モード (通常/今週) ・記録の閲覧
let abyssSetupMods = [];   // 選択中の誓約
let abyssSetupWeekly = false;
function openAbyssSetup() {
  if (!featureUnlocked("infinite")) { log("無限迷宮はまだ解放されていない。", "sys"); SFX.ng(); return; }
  G.town.facility = "abyss";
  abyssSetupMods = [];
  abyssSetupWeekly = false;
  renderTown();
}
function renderAbyss() {
  townEl.appendChild(townHeader("無限迷宮「奈落」", "hub"));
  const rec = abyssRecords();
  // 記録パネル
  const recBox = el("div", "tw-roster");
  recBox.appendChild(el("div", "tw-h", "そなたの記録 (この端末に保存)"));
  const stats = el("div", "tw-note");
  stats.innerHTML = `最深到達 <b style="color:#b08ac0">B${rec.bestDepth}F</b> ／ 最高スコア <b style="color:#ffd84a">${rec.bestScore.toLocaleString()}</b> ／ 挑戦 ${rec.runs} 回`;
  recBox.appendChild(stats);
  const wk = weekSeedId();
  const wkBest = rec.weekly[wk] || 0;
  recBox.appendChild(el("div", "tw-note", `今週の挑戦 (シード #${wk}) 自己最深: ${wkBest ? "B" + wkBest + "F" : "未挑戦"}`));
  townEl.appendChild(recBox);

  // モード選択
  const modeWrap = el("div", "tw-roster");
  modeWrap.appendChild(el("div", "tw-h", "挑戦モード"));
  const modeRow = el("div", "tw-rlist");
  const mkMode = (label, on, fn) => { const b = btn(label, fn); b.className = "btn" + (on ? " primary" : ""); return b; };
  modeRow.appendChild(mkMode("🕳 通常 (毎回ランダム)", !abyssSetupWeekly, () => { abyssSetupWeekly = false; renderTown(); }));
  modeRow.appendChild(mkMode("📅 今週の挑戦 (固定シード)", abyssSetupWeekly, () => { abyssSetupWeekly = true; renderTown(); }));
  modeWrap.appendChild(modeRow);
  modeWrap.appendChild(el("div", "tw-note", abyssSetupWeekly
    ? "今週は全プレイヤーが同じ変異列に挑む。同条件での実力比べだ。"
    : "潜るたびに変異が変わる。気軽に最深を更新しにいける。"));
  townEl.appendChild(modeWrap);

  // 誓約 (縛り)
  const oathWrap = el("div", "tw-roster");
  const curMul = abyssScoreMul(abyssSetupMods);
  oathWrap.appendChild(el("div", "tw-h", `誓約 (任意) — スコア倍率 ×${curMul.toFixed(2)}`));
  oathWrap.appendChild(el("div", "tw-note", "誓約を背負うほど過酷になるが、スコアが大きく伸びる。複数選択できる。"));
  for (const m of ABYSS_MODS) {
    const on = abyssSetupMods.includes(m.id);
    const row = el("div", "tw-dungeon" + (on ? " sel" : ""));
    const info = el("div", "tw-chipi");
    info.appendChild(el("div", "tw-chipn", `${on ? "✔ " : ""}${m.sym} ${m.name} ×${m.scoreMul}`));
    info.appendChild(el("div", "tw-chipc", m.desc));
    row.appendChild(info);
    row.addEventListener("click", () => {
      SFX.select();
      if (on) abyssSetupMods = abyssSetupMods.filter((x) => x !== m.id);
      else abyssSetupMods.push(m.id);
      renderTown();
    });
    oathWrap.appendChild(row);
  }
  townEl.appendChild(oathWrap);

  // 直近のラン
  if (rec.recent.length) {
    const recentWrap = el("div", "tw-roster");
    recentWrap.appendChild(el("div", "tw-h", "直近の挑戦"));
    for (const r of rec.recent) {
      const line = el("div", "tw-note");
      const md = r.mods.length ? ` ・誓約${r.mods.length}` : "";
      line.textContent = `${r.weekly ? "📅" : "🕳"} B${r.depth}F ・ ${r.score.toLocaleString()}点${md} ・ ${r.reason === "wipe" ? "全滅" : "撤退"}`;
      recentWrap.appendChild(line);
    }
    townEl.appendChild(recentWrap);
  }

  // 潜入ボタン (画面下部に固定)
  const divebar = el("div", "tw-divebar");
  const dive = btn(`✺ 奈落へ降りる (スコア ×${curMul.toFixed(2)})`, () => enterAbyss(abyssSetupMods, abyssSetupWeekly));
  dive.className = "btn primary tw-dive";
  divebar.appendChild(dive);
  townEl.appendChild(divebar);
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

// 街へ無事帰還 (戦利品は保持)。keepRun=true で run を確定 (戦利品維持)
function returnToTown() {
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
  combatMenu.classList.add("hidden");
  if (townBtn) townBtn.classList.add("hidden");
  if (descendBtn) { descendBtn.classList.add("hidden"); descendBtn.disabled = true; }
  G.maxFloorReached = Math.max(G.maxFloorReached, G.floor);
  G.run = null; // 無事帰還 = 戦利品は確定 (BGMは renderTown が施設に応じて切替)
  // 生存者が1名でもいれば、砕けた人業は仲間に担がれてHP1で生還する。
  // (全滅時はここに来る前に G.party の生存者ゼロ → 救出待ちのまま帰還する)
  if (G.party.some((p) => p.alive)) reviveAllAtHp1();
  rollTavernCrowd(); // 酒場の顔ぶれは帰還のたびに入れ替わる
  updateTopbar();
  log("街へ帰還した。", "sys");
  G.town.facility = null; G.town.sub = null;
  renderTown();
  if (abyssSummary) showAbyssSummary(abyssSummary);
}

function confirmReturnToTown() {
  if (G.state !== "board" || G.anim || G.walking || uiBlocked()) return;
  // 帰還制限: 帰還魔法陣を発見済み (この階で踏んだ)、その上に立っている、または主を討っていれば帰れる
  const cell = G.board && G.board.cells[G.py] && G.board.cells[G.py][G.px];
  const onPortal = cell && cell.type === "portal";
  if (!onPortal && !G.bossDown && !G.portalFound) {
    SFX.ng(); buzz(20);
    showEvent({
      sprite: ICONS.portal, banner: "⚠ 帰還できない ⚠", title: "帰り道は閉ざされている",
      accent: "#7fd0ff",
      lines: ["迷宮は一度入ると容易には出られない。", "「帰還魔法陣」を見つけて踏むか、迷宮の主を討てば帰還できる。", "魔法陣は5の倍数の階には必ずある。"],
      onClose: () => renderBoard(),
    });
    return;
  }
  showConfirm({
    title: "街へ帰還する？",
    lines: ["今いる階の探索は中断される。", "集めた魂・お金・アイテムは持ち帰れる。"],
    okLabel: "🏚 帰還する",
    onOk: returnToTown,
  });
}

// 帰還魔法陣を踏んだ時の選択 (何度でも使える)
function askPortalReturn() {
  showChoice("帰還魔法陣が淡く輝いている。", [
    { label: "🏚 街へ帰還する（戦利品は持ち帰る）", fn: () => returnToTown() },
    { label: "✋ まだ潜る", fn: () => renderBoard() },
  ], ICONS.portal, { banner: "✦ 帰還魔法陣 ✦", accent: "#7fd0ff",
    lines: ["この陣の上からなら、いつでも街へ帰還できる。"],
    onDismiss: () => renderBoard() });
}

// ---- 個別ステータス / 装備画面 ----
const statusEl = document.getElementById("status-screen");
const statusBtn = document.getElementById("status-btn");
let stSel = null; // 詳細表示中のアイテム { item, from:"equip"|"bag", key }

function openStatus(idx = 0) {
  if (G.state !== "board" && G.state !== "town") return;
  if (G.anim || G.walking || G.prompt) return;
  if (G.settingsOpen) closeSettings();
  G.statusOpen = true;
  G.statusIdx = idx;
  G.statusTab = "main"; // 初期表示は統合画面 (ステータス/装備/所持品)
  stSel = null;
  statusEl.classList.remove("hidden");
  renderStatus();
}
function closeStatus() {
  G.statusOpen = false;
  stSel = null;
  statusEl.classList.add("hidden");
}

function statName(p) {
  return p.alive ? p.name : `${p.name}†`;
}

// 六大ステータスの詳しい説明 (ステータス画面でタップ時に表示)
const ATTR_DESC = {
  atk: "物理攻撃のダメージを決める力。武器による通常攻撃や物理スキルの威力が上がる。",
  vit: "受ける物理ダメージを軽減する頑強さ。高いほど打たれ強くなる。",
  agi: "行動の速さ。高いほど戦闘で先に動け、敵の攻撃を回避しやすくなる。",
  int: "攻撃呪文の威力を決める知力。火球など攻撃魔法のダメージが上がる。",
  pie: "回復呪文の効果を決める信仰心。HPを回復する魔法の回復量が上がる。",
  luk: "会心（クリティカル）の発生率を左右する幸運。高いほど大ダメージが出やすい。",
};

// 能力値の説明ポップアップ
function showStatInfo(k, p) {
  const wrap = el("div", "confirm-overlay");
  const card = el("div", "ig-card cdx-detail");
  card.appendChild(el("div", "ig-banner", ATTR_LABEL[k]));
  card.appendChild(el("div", "ig-name", ATTR_NAME[k]));
  if (p) card.appendChild(el("div", "ig-stat", `${p.name} の ${ATTR_LABEL[k]}: ${Math.round(p[k] || 0)}`));
  card.appendChild(el("div", "ig-desc", ATTR_DESC[k] || ""));
  const ok = btn("閉じる", () => wrap.remove());
  ok.className = "btn primary ig-ok";
  card.appendChild(ok);
  wrap.appendChild(card);
  wrap.addEventListener("click", (e) => { if (e.target === wrap) wrap.remove(); });
  document.body.appendChild(wrap);
}

// キャラ詳細ポップアップ (ステータスバーのタップで開く)
// HP/MP・状態・属性・能力値・習得スキルを1枚にまとめて表示する
function showCharDetailPopup(p) {
  const wrap = el("div", "confirm-overlay");
  const card = el("div", "ig-card cdx-detail st-detail");
  wrap.addEventListener("click", (e) => { if (e.target === wrap) wrap.remove(); });

  // ヘッダ: 肖像 + 名前 + 職業/レベル
  const head = el("div", "st-detail-head");
  const port = el("div", "st-port small");
  port.appendChild(spriteCanvas(p.isDoll ? dollSprite(p) : HERO, 4));
  head.appendChild(port);
  const idn = el("div", "st-idn");
  idn.appendChild(el("div", "st-name", p.name + (p.alive ? "" : " †")));
  idn.appendChild(el("div", "st-sub", p.isDoll ? `人業 ・ ${p.cls} Lv${p.jobLv || 1}` : `${p.align} - ${p.race} - ${p.cls} Lv${p.level}`));
  head.appendChild(idn);
  card.appendChild(head);

  // HP/MP・状態・属性
  const ail = p.ailment === "poison" ? "毒" : (p.alive ? "正常" : "戦闘不能");
  const ailCls = (p.ailment || !p.alive) ? "st-bad" : "";
  const bar = el("div", "st-statbar");
  bar.innerHTML = `<span>HP <b>${p.hp}/${p.maxhp}</b></span><span>MP <b>${p.mp}/${p.maxmp}</b></span><span class="${ailCls}">状態: <b>${ail}</b></span><span>属性攻 ${elemStatChip(p.elemAtk)}</span><span>属性防 ${elemStatChip(p.elemDef)}</span>`;
  card.appendChild(bar);

  // 能力値 (6列)。タップで各能力の説明を表示
  const ab = el("div", "st-attrs6");
  for (const k of ATTR_KEYS) {
    const cell = el("div", "st-attr6 st-attr-tap");
    cell.appendChild(el("span", "st-attrk", ATTR_LABEL[k]));
    cell.appendChild(el("span", "st-attrv", String(Math.round(p[k] || 0))));
    cell.title = ATTR_NAME[k];
    cell.addEventListener("click", () => { SFX.select(); showStatInfo(k, p); });
    ab.appendChild(cell);
  }
  card.appendChild(ab);

  // 習得スキル (タップで各スキルの詳細を表示)
  if (p.spells && p.spells.length) {
    card.appendChild(el("div", "st-h2", "習得スキル — タップで詳細"));
    card.appendChild(skillChips(p.spells));
  }

  const ok = btn("閉じる", () => wrap.remove());
  ok.className = "btn primary ig-ok";
  card.appendChild(ok);
  wrap.appendChild(card);
  document.body.appendChild(wrap);
}

function renderStatus() {
  autosave(); // 装備変更・呪文使用などのたびに保存
  const p = G.party[G.statusIdx];
  statusEl.innerHTML = "";

  // ===== ヘッダ: 肖像 + 名前 + 属性-種族-職業 + 前後/閉じる =====
  const head = el("div", "st-head");
  const port = el("div", "st-port small");
  port.appendChild(spriteCanvas(p.isDoll ? dollSprite(p) : HERO, 4));
  head.appendChild(port);
  const idn = el("div", "st-idn");
  idn.appendChild(el("div", "st-name", p.name + (p.alive ? "" : " †")));
  // 区切りごとに折り返さない塊にする (「射/程」のような泣き別れを防ぐ)
  const sub = el("div", "st-sub");
  const segs = (p.isDoll ? ["人業", `${p.cls} Lv${p.jobLv || 1}`] : [`${p.align} - ${p.race} - ${p.cls} Lv${p.level}`])
    .concat([G.statusIdx < 3 ? "前衛" : "後衛", `射程:${RANGE_LABEL[weaponRange(p.equip && p.equip.weapon)]}`]);
  segs.forEach((t, i) => { if (i) sub.appendChild(document.createTextNode(" ・ ")); sub.appendChild(el("span", "st-seg", t)); });
  idn.appendChild(sub);
  head.appendChild(idn);
  const nav = el("div", "st-nav");
  const prev = btn("◀", () => { G.statusIdx = (G.statusIdx + G.party.length - 1) % G.party.length; stSel = null; renderStatus(); }); prev.className = "st-navb";
  const next = btn("▶", () => { G.statusIdx = (G.statusIdx + 1) % G.party.length; stSel = null; renderStatus(); }); next.className = "st-navb";
  const close = btn("✕", closeStatus); close.className = "st-navb";
  nav.appendChild(prev); nav.appendChild(next); nav.appendChild(close);
  head.appendChild(nav);
  statusEl.appendChild(head);

  // タブ: ステータス(統合) / 魂 (人業キャラのみ)
  if (p.isDoll) {
    const tabs = el("div", "st-tabbar");
    const tMain = btn("ステータス", () => { G.statusTab = "main"; stSel = null; renderStatus(); });
    tMain.className = "st-tab2" + (G.statusTab !== "soul" ? " active" : "");
    tabs.appendChild(tMain);
    const tSoul = btn("魂", () => { G.statusTab = "soul"; renderStatus(); });
    tSoul.className = "st-tab2" + (G.statusTab === "soul" ? " active" : "");
    tabs.appendChild(tSoul);
    statusEl.appendChild(tabs);
    if (G.statusTab === "soul") { statusEl.appendChild(renderSoulTab(p)); return; }
  }

  // ===== コンパクト1画面レイアウト =====

  // 1. ステータスバー (HP/MP/状態/属性/スキル)。タップでキャラ詳細ポップアップを表示
  const bar = el("div", "st-statbar st-statbar-tap");
  const ail = p.ailment === "poison" ? "毒" : (p.alive ? "正常" : "戦闘不能");
  const ailCls = (p.ailment || !p.alive) ? "st-bad" : "";
  const spellLine = p.spells && p.spells.length
    ? `<span class="st-bar-spells">スキル: ${p.spells.map((k) => SPELLS[k] ? SPELLS[k].name : k).join("・")}</span>`
    : "";
  bar.innerHTML = `<span>HP <b>${p.hp}/${p.maxhp}</b></span><span>MP <b>${p.mp}/${p.maxmp}</b></span><span class="${ailCls}">状態: <b>${ail}</b></span><span>属性攻 ${elemStatChip(p.elemAtk)}</span><span>属性防 ${elemStatChip(p.elemDef)}</span>${spellLine}`;
  bar.addEventListener("click", () => { SFX.select(); if (p.jobKey) showCodexJobDetail(p.jobKey, p.jobRank); else showCharDetailPopup(p); });
  statusEl.appendChild(bar);

  // 死亡中の帰還タイマー
  if (p.isDoll && !p.alive) {
    if (!p.reviveAt) setReviveTimers();
    const box = el("div", "st-revive");
    box.appendChild(reviveTimerEl("div", "st-revt", "⏳ 帰還まで ", p));
    box.appendChild(el("div", "tw-note", "他の冒険者が捜索・救出している…"));
    const b = btn(`🔴1 で帰還を早める`, () => tryHastenRescue(p));
    b.className = "btn primary";
    if (G.redSoul < 1) b.disabled = true;
    box.appendChild(b);
    statusEl.appendChild(box);
  }

  // 2. 能力値 (6列1行)。タップで各能力の説明をポップアップ表示
  const ab = el("div", "st-attrs6");
  for (const k of ATTR_KEYS) {
    const cell = el("div", "st-attr6 st-attr-tap");
    cell.appendChild(el("span", "st-attrk", ATTR_LABEL[k]));
    cell.appendChild(el("span", "st-attrv", String(Math.round(p[k] || 0))));
    cell.title = ATTR_NAME[k];
    cell.addEventListener("click", () => { SFX.select(); showStatInfo(k, p); });
    ab.appendChild(cell);
  }
  statusEl.appendChild(ab);

  // 3. 装備 + 所持品 (2カラム横並び)
  const grid = el("div", "st-bottom-grid");

  // 左列: 装備 (タップで変更)
  const eqCol = el("div", "st-col");
  eqCol.appendChild(el("div", "st-h", "装備 — タップで変更"));
  const eqList = el("div", "st-eqlist");
  for (const slot of SLOTS) {
    const it = p.equip[slot];
    const row = el("div", "st-eqrow" + (it ? "" : " empty"));
    const si = el("span", "st-sicon"); si.appendChild(spriteCanvas(SLOT_ICONS[slot] || SLOT_ICONS.weapon, 2)); row.appendChild(si);
    const ii = el("span", "st-iicon"); if (it) ii.appendChild(spriteCanvas(it, 2)); row.appendChild(ii);
    row.appendChild(it ? itemNameEl("span", "st-ename", it, it.cursed ? " 🔒" : "") : el("span", "st-ename", SLOT_LABEL[slot]));
    row.addEventListener("click", () => openEquipChooser(p, slot));
    eqList.appendChild(row);
  }
  eqCol.appendChild(eqList);
  grid.appendChild(eqCol);

  // 右列: 所持品
  const invCol = el("div", "st-col");
  invCol.appendChild(el("div", "st-h", `所持 ${p.items.length}/${MAX_ITEMS}`));
  const invList = el("div", "st-invlist");
  p.items.forEach((it, i) => invList.appendChild(invRow(p, it, { from: "bag", index: i })));
  if (!invList.children.length) invList.appendChild(el("div", "st-empty", "(なし)"));
  invCol.appendChild(invList);
  grid.appendChild(invCol);

  statusEl.appendChild(grid);

  // 野営呪文 (ある場合のみ)。戦闘外で意味があるのは HP回復/蘇生/状態異常治療の呪文。
  // バフ系は戦闘外では効果が持続しないため除外する。消費MPは省詠唱(chant)込みで表示。
  const campSpells = (p.spells || []).filter((k) => {
    const sp = SPELLS[k];
    return sp && (sp.kind === "heal" || sp.kind === "cure" || sp.cure);
  });
  if (p.isDoll && p.alive && campSpells.length) {
    statusEl.appendChild(el("div", "st-h2", "呪文 (野営)"));
    const sl = el("div", "st-camp");
    for (const k of campSpells) {
      const sp = SPELLS[k];
      const cost = spellCost(p, sp);
      const b = btn(`${sp.name} (MP${cost})`, () => campCast(p, k));
      // MP不足でも disabled にはせず押せるようにする (campCast がトーストで理由を出す)。
      // disabled にすると .tw-small は減光スタイルが効かず「押せるのに無反応」に見えるため。
      b.className = "tw-small" + (p.mp < cost ? " dim" : "");
      sl.appendChild(b);
    }
    statusEl.appendChild(sl);
    statusEl.appendChild(el("div", "tw-note", "回復・蘇生・状態異常の治療を、対象を選んで使える。"));
  }
}

// 所持品リストの1行 (タップで詳細ポップアップ)
function invRow(p, it, sel) {
  const row = el("div", "st-invrow");
  const ic = el("span", "st-iicon"); ic.appendChild(spriteCanvas(it, 2)); row.appendChild(ic);
  const unidMark = it.unidentified ? (it.idHardFail ? " 🔍✕" : " 🔍") : (it.cursed ? " 🔒" : "");
  row.appendChild(itemNameEl("span", "st-iname" + (it.unidentified ? (it.idHardFail ? " st-unid st-idfail" : " st-unid") : ""), it, unidMark));
  row.addEventListener("click", () => { SFX.select(); showItemDetailPopup(p, { item: it, from: "bag", index: sel.index }); });
  return row;
}

// 戦闘外で回復系呪文を唱える。対象の味方を選び、HP回復/蘇生/状態異常治療を行う。
// バフは戦闘外では持続しないため適用しない (回復・治療部分のみ効果がある)。
function campCast(caster, spellKey) {
  const sp = SPELLS[spellKey];
  const cost = spellCost(caster, sp);
  // 失敗理由はステータス画面の裏のログに出しても見えないため、トーストでも知らせる。
  if (caster.mp < cost) { log("MPが足りない。", "sys"); showToast(`MPが足りない (MP ${caster.mp}/${cost})`); SFX.miss(); return; }
  const cures = sp.kind === "cure" || !!sp.cure;     // 毒・麻痺・石化を治す
  const heals = (sp.power || 0) > 0;                  // HP回復量を持つ
  const powerOf = () => (sp.power || 0) + Math.round((caster.pie || 0) * 0.5);
  // 対象がいないときに「なぜ唱えられないか」を明示するアラート文言
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
      const heal = sp.revivePct ? Math.round(t.maxhp * sp.revivePct) : Math.max(1, powerOf());
      t.alive = true; t.ailment = null; t.reviveAt = null; t._dead = false;
      t.hp = Math.max(1, Math.min(t.maxhp, heal));
      log(`${sp.name}！ ${t.name}が蘇った (HP ${t.hp})`, "heal");
      return true;
    }
    let did = false;
    if (cures && t.ailment) { t.ailment = null; log(`${sp.name}！ ${t.name}の状態異常が治った`, "heal"); did = true; }
    if (heals && t.hp < t.maxhp) {
      const p = powerOf();
      const heal = p + rand(Math.ceil(p * 0.3) + 1);
      t.hp = Math.min(t.maxhp, t.hp + heal);
      log(`${sp.name}！ ${t.name}のHPが ${heal} 回復`, "heal");
      did = true;
    }
    return did;
  };
  const finish = () => { caster.mp -= cost; SFX.heal(); buzz(15); renderStatus(); renderParty(); };

  // 回復結果を1人ぶんの行に整形 (回復系呪文でのみ使う)。
  // ・蘇生: 「●●が蘇った (HP n/max)」
  // ・満タン (元から満タン / 回復で満タンになった): 「●●は満タンだ」
  // ・部分回復: 「●●のHPがn回復した」
  const healLineFor = (t, before, wasDead) => {
    if (wasDead && t.alive) return `${t.name}が蘇った (HP ${t.hp}/${t.maxhp})`;
    if (t.alive && t.hp >= t.maxhp) return `${t.name}は満タンだ`;
    const got = t.hp - before;
    if (got > 0) return `${t.name}のHPが${got}回復した`;
    return null;
  };
  // 回復結果ポップアップ (複数名ぶんを1枚に列挙)。閉じてもステータス画面に留まる。
  const showHealResult = (lines) => showEvent({
    sprite: ICONS.fountain, banner: "✦ 回復 ✦", accent: "#46c08f",
    title: sp.name, lines, btnLabel: "閉じる",
    onClose: () => { if (G.statusOpen) renderStatus(); },
  });

  // 全体呪文は対象選択なしで全員へ (効果がなければMPは消費しない)
  if (sp.target === "all-ally") {
    let any = false;
    const lines = [];
    for (const t of G.party) {
      if (!t.alive && !sp.revive) continue;
      const before = t.hp, wasDead = !t.alive;
      if (applyTo(t)) any = true;
      if (heals) { const ln = healLineFor(t, before, wasDead); if (ln) lines.push(ln); }
    }
    if (any) {
      finish();
      if (heals && lines.length) showHealResult(lines);
      else showToast(`${sp.name}！ 隊を癒した`);
    } else { log("効果のある対象がいない。", "sys"); showToast(noTargetMsg()); SFX.miss(); }
    return;
  }

  // 単体: 効果のある対象だけを候補にする (HP満タンへの回復・状態異常なしへの治療は不可)
  const benefits = (t) => {
    if (!t.alive) return !!sp.revive;            // 死者は蘇生のみ
    if (cures && t.ailment) return true;         // 状態異常を治す
    if (heals && t.hp < t.maxhp) return true;    // HPを回復する
    return false;
  };
  const targets = G.party.filter(benefits);
  if (!targets.length) { log("効果のある対象がいない。", "sys"); showToast(noTargetMsg()); SFX.miss(); return; }
  const wrap = el("div", "confirm-overlay");
  const card = el("div", "ig-card confirm-card");
  card.style.borderColor = "#46c08f";
  card.appendChild(el("div", "ig-banner", `✦ ${sp.name} ✦`));
  card.appendChild(el("div", "ig-name", "誰に唱える？"));
  const list = el("div", "ig-choices");
  const ailLabel = { poison: "毒", paralyze: "麻痺", stone: "石化" };
  for (const t of targets) {
    const ail = t.ailment ? ` [${ailLabel[t.ailment] || t.ailment}]` : "";
    const label = `${t.name} (HP ${t.hp}/${t.maxhp})${ail}${t.alive ? "" : " †"}`;
    const b = btn(label, () => {
      wrap.remove();
      const before = t.hp, wasDead = !t.alive;
      if (applyTo(t)) {
        finish();
        if (heals) showHealResult([healLineFor(t, before, wasDead) || `${t.name}は満タンだ`]);
        else showToast(`${sp.name}！ ${t.name}に`);
      }
      else { log("効果のある対象ではなかった。", "sys"); showToast("効果がなかった"); }
    });
    list.appendChild(b);
  }
  list.appendChild(btn("やめる", () => wrap.remove()));
  card.appendChild(list);
  wrap.appendChild(card);
  wrap.addEventListener("click", (e) => { if (e.target === wrap) wrap.remove(); });
  document.body.appendChild(wrap);
}

// 魂タブ (メイン魂の成長 + サブ魂スロットを表示)
function renderSoulTab(p) {
  const wrap = el("div", "st-soultab");
  const head = el("div", "st-soulsum");
  const pe = p.primary != null ? soulByUid(p.primary) : null;
  head.style.borderColor = pe ? SOUL_CLASSES[pe.clsKey].color : "#34344a";
  head.appendChild(el("div", "st-soulc", p.cls));
  head.appendChild(el("div", "st-soultt",
    pe ? `ランク${p.jobRank} ・ 魂Lv${pe.level} ・ ${soulSeriesName(pe.clsKey)}の魂` : "メイン魂が宿っていない"));
  if (p.jobKey) {
    head.style.cursor = "pointer";
    head.title = "職業図鑑を表示";
    head.appendChild(el("div", "tw-sumhint", "▶ 職業図鑑"));
    head.addEventListener("click", () => showCodexJobDetail(p.jobKey, p.jobRank));
  }
  wrap.appendChild(head);

  // メイン魂の成長 (魂レベルと次のランクへの進捗)
  if (pe) {
    const cap = soulLevelCapOf(pe);
    const row = el("div", "st-soulrow2");
    row.style.borderColor = SOUL_CLASSES[pe.clsKey].glow;
    const orb = el("span", "tw-chips");
    orb.style.color = SOUL_CLASSES[pe.clsKey].glow;
    orb.appendChild(spriteCanvas(jobSprite(pe.clsKey, Math.max(1, p.jobRank)), 2));
    row.appendChild(orb);
    const info = el("div", "st-soulinfo");
    info.appendChild(el("div", "st-souln2", `メイン魂 ${jobRankName(pe.clsKey, p.jobRank)}　Lv${pe.level} / ${cap}`));
    if (pe.level >= cap) {
      info.appendChild(el("div", "st-soulstat", "Lv上限 — ランクアップで上限が伸びる"));
      if (pe.exp > 0) info.appendChild(el("div", "st-soulstat", `蓄積 Soul ✦${pe.exp}（ランクUPでLvに反映）`));
    } else {
      const need = soulTrainCost(pe.level);
      const have = Math.max(0, Math.min(need, pe.exp || 0));
      const bar = el("div", "st-soulbar");
      const fill = el("i");
      fill.style.width = `${Math.round((need ? have / need : 0) * 100)}%`;
      bar.appendChild(fill);
      info.appendChild(bar);
      info.appendChild(el("div", "st-soulstat", `次のLvまで Soul ${have} / ${need}`));
    }
    const nx = nextRankThreshold(pe.clsKey, pe.count);
    if (nx) info.appendChild(el("div", "st-soulstat", `ランク${p.jobRank + 1}まで 魂 ${pe.count - nx.prev} / ${nx.next - nx.prev}`));
    row.appendChild(info);
    wrap.appendChild(row);
  }

  // サブ魂スロット
  wrap.appendChild(el("div", "st-soulpart", "サブ魂"));
  const subs = (p.subs || []);
  if (!subs.length) wrap.appendChild(el("div", "st-soulinfo dim", unlockedSubSlots() > 0
    ? "（サブ魂なし — 館の祭壇で別の魂の技かパッシブを1つ借り、ステの30%を得られる）"
    : "（宿し技スロットは未解放 — 迷宮を踏破すると開く）"));
  for (const sub of subs) {
    const se = sub ? soulByUid(sub.uid) : null;
    if (!se) continue;
    const cls = SOUL_CLASSES[se.clsKey]; if (!cls) continue;
    const rank = soulRankOf(se);
    const borrow = sub.passive
      ? `パッシブ: ${passiveName(sub.passive, soulLearnedPassives(se)[sub.passive] || 1)}`
      : `技: ${sub.skill && SPELLS[sub.skill] ? SPELLS[sub.skill].name : "未設定"}`;
    const row = el("div", "st-soulrow2");
    const orb = el("span", "tw-chips"); orb.style.color = cls.glow; orb.appendChild(spriteCanvas(jobSprite(se.clsKey, Math.max(1, rank)), 2));
    row.appendChild(orb);
    const info = el("div", "st-soulinfo");
    const nm = el("div", "st-souln2", `${jobRankName(se.clsKey, rank)}　Lv${se.level}`); nm.style.color = cls.glow;
    info.appendChild(nm);
    info.appendChild(el("div", "st-soulstat", `${borrow}　ステ+30%`));
    row.appendChild(info);
    wrap.appendChild(row);
  }
  return wrap;
}

// 表示ヘルパ (soulStatText・属性/スキル/品の表示・equipPreviewDelta・equipCompareEl・detailLines など) は
// src/ui/itemview.js へ移設 (import 済み)

// 所持アイテムの詳細をポップアップ表示 (旧: 画面下のインライン情報パネル)
function showItemDetailPopup(p, sel) {
  if (!sel || !sel.item) return;
  const it = sel.item;
  const wrap = el("div", "confirm-overlay");
  const card = el("div", "ig-card cdx-detail");
  const rc = itemRankColor(it);
  if (rc) { card.style.borderColor = rc; card.style.boxShadow = `0 0 40px ${rc}66`; }
  const ban = el("div", "ig-banner", itemGradeText(it, "情報"));
  if (rc) ban.style.color = rc;
  card.appendChild(ban);
  const art = el("div", "ig-art"); art.appendChild(spriteCanvas(it, 11)); card.appendChild(art);
  card.appendChild(itemNameEl("div", "ig-name", it, it.unidentified ? (it.idHardFail ? " 🔍✕" : " 🔍") : (it.cursed ? " 🔒呪" : "")));
  for (const line of detailLines(it)) card.appendChild(el("div", "ig-stat", line));
  if (isEquippable(it) && !it.unidentified && G.party.length > 1) card.appendChild(equipPartyChips(it));
  if (it.desc && !it.unidentified) card.appendChild(el("div", "ig-desc", it.desc));

  const acts = el("div", "ig-choices");
  const close = () => wrap.remove();
  if (sel.from === "bag") {
    if (it.unidentified) {
      // 未鑑定品: 鑑定の心得がある仲間がいれば、その場で鑑定を試みられる (商店なら確実・有料)
      addIdentifyAction(acts, it, close);
    } else if (it.slot === "use") {
      acts.appendChild(btn("使う", () => { close(); useItem(p, sel.index); }));
    } else if (it.slot === "mat" || it.slot === "misc") {
      // 貴重品/戦利品: 装備も使用もできない (売却・譲渡のみ)
    } else {
      const can = canEquip(p, it);
      const b = btn(can ? "装備する" : "装備不可", () => { if (can) { close(); doEquip(p, it); } });
      if (!can) b.disabled = true;
      acts.appendChild(b);
    }
    acts.appendChild(makeDanger("捨てる", () => { close(); dropItem(p, sel.index); }));
    // 他のメンバーへ渡す (生存者が2人以上いるときのみ)
    if (G.party.filter((m) => m.alive).length > 1) {
      acts.appendChild(btn("渡す", () => { close(); transferItem(p, sel.index); }));
    }
  }
  acts.appendChild(btn("閉じる", close));
  card.appendChild(acts);
  wrap.appendChild(card);
  wrap.addEventListener("click", (e) => { if (e.target === wrap) wrap.remove(); });
  document.body.appendChild(wrap);
}

// 未鑑定品の詳細ポップアップに「鑑定する」アクションを足す。
// 鑑定済みの心得がある仲間がいればその場で試せる。失敗済み (idHardFail) は商店送り。
function addIdentifyAction(acts, it, close) {
  // レジェンドレアは味方スキルでは鑑定できない。商店でのみ
  if (it.lr) {
    const b = btn("🔒 レジェンドレアは商店でのみ鑑定可", () => {});
    b.disabled = true;
    acts.appendChild(b);
    return;
  }
  if (it.idHardFail) {
    const b = btn("🔒 鑑定失敗済み (商店でのみ鑑定可)", () => {});
    b.disabled = true;
    acts.appendChild(b);
    return;
  }
  const idmen = G.party.filter((m) => m.alive && canIdentify(m));
  if (!idmen.length) {
    const b = btn("鑑定できる仲間がいない", () => {});
    b.disabled = true;
    acts.appendChild(b);
    return;
  }
  acts.appendChild(btn("🔍 鑑定する (スキル)", () => { close(); openIdentifyChooser(it); }));
}

// 鑑定できる仲間を一覧表示し、誰が鑑定を試みるかを選ぶ (成功率つき)
function openIdentifyChooser(it) {
  const idmen = G.party.filter((m) => m.alive && canIdentify(m));
  if (!idmen.length) { log("鑑定できる仲間がいない。", "sys"); return; }
  const wrap = el("div", "confirm-overlay");
  const card = el("div", "ig-card confirm-card");
  card.style.borderColor = "#7fd0ff";
  card.appendChild(el("div", "ig-banner", "🔍 鑑定"));
  card.appendChild(el("div", "ig-name", "誰が鑑定する？"));
  card.appendChild(el("div", "ig-stat dim", "失敗するとこの品はスキルで鑑定できなくなる (商店なら確実)"));
  const list = el("div", "ig-choices");
  for (const m of idmen) {
    const ch = identifyChance(m, it.lv || 1);
    const lbl = identifyLabel(m);
    const b = btn(`${m.name} (${m.cls}) ${lbl} 成功 ${Math.round(ch * 100)}%`, () => {
      wrap.remove();
      doIdentifySkill(m, it);
    });
    list.appendChild(b);
  }
  list.appendChild(btn("やめる", () => wrap.remove()));
  card.appendChild(list);
  wrap.appendChild(card);
  wrap.addEventListener("click", (e) => { if (e.target === wrap) wrap.remove(); });
  document.body.appendChild(wrap);
}

// スキル鑑定を実行。成功で正体判明、失敗で idHardFail (以後は商店でのみ鑑定可)
function doIdentifySkill(m, it) {
  const ch = identifyChance(m, it.lv || 1);
  if (Math.random() < ch) {
    it.unidentified = false;
    SFX.itemget(); buzz(15);
    log(`${m.name}は ${it.name} を鑑定した！`, "win");
    showToast(`🔍 ${it.name} と判明！`);
  } else {
    it.idHardFail = true;
    SFX.ng(); buzz([0, 30, 40, 30]);
    log(`${m.name}の鑑定は失敗した… この品は商店でしか鑑定できなくなった。`, "sys");
    showToast("🔍 鑑定失敗…");
  }
  if (G.statusOpen) renderStatus(); // ステータス画面はオーバーレイ (G.state は board/town のまま) なので statusOpen で判定
  renderParty();
  autosave(true);
}

function makeDanger(label, fn) { const b = btn(label, fn); b.classList.add("danger"); return b; }
// equipClassText / equipPartyChips は src/ui/itemview.js へ移設 (import 済み)

function doEquip(p, it) {
  const r = equipItem(p, it);
  if (r.msg) log(r.msg, r.ok ? "win" : "sys");
  if (r.ok) SFX.select();
  stSel = null;
  renderStatus(); renderParty();
}

// アイテムが指定スロットに装備可能か (種別の一致)
function itemFitsSlot(it, slotKey) {
  if (!it || it.slot === "use") return false;
  if (slotKey === "acc1" || slotKey === "acc2") return it.slot === "acc";
  return it.slot === slotKey;
}

// 装備候補一覧 (この人業の所持品 + 他の人業の所持品/装備品) を表示して付け替える
function openEquipChooser(p, slotKey) {
  const cur = p.equip[slotKey];
  const wrap = el("div", "confirm-overlay");
  const card = el("div", "ig-card confirm-card eqchooser");
  card.style.borderColor = "#6b8cff";
  card.appendChild(el("div", "ig-banner", `${SLOT_LABEL[slotKey]} に装備`));

  const list = el("div", "ig-choices eq-cand");

  // 現在装備中 → 外す (候補と同じく詳細情報も表示)
  if (cur) {
    const un = btn("", () => {
      if (cur.cursed) return;
      wrap.remove();
      const r = unequipItem(p, slotKey);
      if (r.msg) log(r.msg, "sys");
      SFX.select(); renderStatus(); renderParty();
    });
    un.className = "btn eq-cand-btn eq-cur";
    un.textContent = "";
    const ic = el("span", "eq-ci"); ic.appendChild(spriteCanvas(cur, 2)); un.appendChild(ic);
    const tx = el("span", "eq-ct");
    tx.appendChild(el("span", "eq-cn", (cur.cursed ? "🔒 " : "装備中 ") + cur.name + (cur.cursed ? "（呪・外せない）" : "（タップで外す）")));
    const st = statLines(cur);
    if (st) tx.appendChild(el("span", "eq-cs", st));
    if (cur.slot !== "use") tx.appendChild(el("span", "eq-ccls", equipClassText(cur)));
    if (cur.desc) tx.appendChild(el("span", "eq-cdesc", cur.desc));
    un.appendChild(tx);
    if (cur.cursed) un.disabled = true;
    list.appendChild(un);
  }

  // 候補収集: 自分の所持品 → 他キャラの所持品 (他キャラが装備中の品は除外)
  const cands = [];
  for (const it of p.items) if (itemFitsSlot(it, slotKey) && canEquip(p, it)) cands.push({ it, owner: p });
  for (const d of allDolls()) {
    if (d === p) continue;
    for (const it of d.items) if (itemFitsSlot(it, slotKey) && canEquip(p, it)) cands.push({ it, owner: d });
  }

  if (!cands.length) list.appendChild(el("div", "tw-empty", "装備できる品がない。"));
  for (const c of cands) {
    const isOther = c.owner !== p;
    const label = c.it.name + (isOther ? `（${c.owner.name}）` : "");
    const b = btn("", () => { wrap.remove(); equipFromAnywhere(p, slotKey, c); });
    b.className = "btn eq-cand-btn";
    b.textContent = "";
    const ic = el("span", "eq-ci"); ic.appendChild(spriteCanvas(c.it, 2)); b.appendChild(ic);
    const tx = el("span", "eq-ct");
    tx.appendChild(el("span", "eq-cn", label));
    const st = statLines(c.it);
    if (st) tx.appendChild(el("span", "eq-cs", st));
    // 装備可能職業 (未発見職は伏せる) と説明文
    if (c.it.slot !== "use") tx.appendChild(el("span", "eq-ccls", equipClassText(c.it)));
    if (c.it.desc) tx.appendChild(el("span", "eq-cdesc", c.it.desc));
    // 現在との増減 (空きスロットへの装備でも常に表示する)
    tx.appendChild(equipCompareEl(p, c.it));
    b.appendChild(tx);
    list.appendChild(b);
  }
  card.appendChild(list);
  list.appendChild(btn("やめる", () => wrap.remove()));
  wrap.appendChild(card);
  wrap.addEventListener("click", (e) => { if (e.target === wrap) wrap.remove(); });
  document.body.appendChild(wrap);
}

// 候補(自分/他キャラの所持品/装備品)を p の slotKey に装備する
function equipFromAnywhere(p, slotKey, c) {
  const { it, owner } = c;
  if (owner !== p) {
    // 他キャラの所持品から取り上げ、いったん p の所持品へ
    const i = owner.items.indexOf(it);
    if (i >= 0) owner.items.splice(i, 1);
    p.items.push(it);
  }
  const r = equipItem(p, it);
  if (r.msg) log(r.msg, r.ok ? "win" : "sys");
  if (!r.ok && owner !== p) {
    // 失敗時は取り上げた品を戻す
    const i = p.items.indexOf(it); if (i >= 0) p.items.splice(i, 1);
    owner.items.push(it);
  } else if (r.ok && owner !== p) {
    log(`${owner.name} から ${it.name} を受け取り装備した。`, "win");
  }
  SFX.select(); buzz(10);
  stSel = null;
  renderStatus(); renderParty();
}
function doUnequip(p, key) {
  const r = unequipItem(p, key);
  if (r.msg) log(r.msg, r.ok ? "sys" : "dmg");
  if (r.ok) SFX.select();
  stSel = null;
  renderStatus(); renderParty();
}
function useItem(p, index) {
  const it = p.items[index];
  if (!it || it.slot !== "use") return;
  // 無頼の誓 (奈落の縛り): 道具 (消耗品) を一切使えない
  if (G.abyss && G.abyss.mods.includes("noItems")) { SFX.ng(); log("無頼の誓により、道具は使えない。", "sys"); return; }
  let used = false;
  if (it.use.heal) {
    if (p.hp >= p.maxhp) { log(`${p.name}のHPは満タンだ`, "sys"); }
    else { p.hp = Math.min(p.maxhp, p.hp + it.use.heal); log(`${p.name}は${it.name}を使った。HP回復！`, "heal"); SFX.heal(); used = true; }
  } else if (it.use.mp) {
    if (p.mp >= p.maxmp) { log(`${p.name}のMPは満タンだ`, "sys"); }
    else { p.mp = Math.min(p.maxmp, p.mp + it.use.mp); log(`${p.name}は${it.name}を使った。MP回復！`, "heal"); SFX.heal(); used = true; }
  } else if (it.use.cure) {
    if (p.ailment === it.use.cure) { p.ailment = null; log(`${p.name}の毒が治った`, "heal"); SFX.heal(); used = true; }
    else { log(`効果がなかった`, "sys"); }
  }
  if (used) { p.items.splice(index, 1); stSel = null; }
  renderStatus(); renderParty();
}
// 捨てる: 取り返しのつかない操作なので確認画面を挟む
function dropItem(p, index) {
  const it = p.items[index];
  if (!it) return;
  showConfirm({
    title: `${it.name} を捨てる？`,
    lines: ["捨てたアイテムは二度と戻らない。"],
    okLabel: "🗑 捨てる",
    onOk: () => {
      p.items.splice(index, 1);
      log(`${it.name}を捨てた`, "sys");
      stSel = null;
      renderStatus();
    },
  });
}

// 他のメンバーへアイテムを渡す。渡し先を選ぶモーダルを出す
function transferItem(p, index) {
  const it = p.items[index];
  if (!it) return;
  const wrap = el("div", "confirm-overlay");
  const card = el("div", "ig-card confirm-card");
  card.style.borderColor = "#5fb8d6";
  card.style.boxShadow = "0 0 40px #5fb8d655";
  const bn = el("div", "ig-banner", "🎁 渡す");
  bn.style.color = "#5fb8d6";
  card.appendChild(bn);
  card.appendChild(el("div", "ig-name", `${it.name} を誰に渡す？`));
  const list = el("div", "ig-choices");
  // 自分以外の生存メンバーを並べる。満杯の相手は選べない
  G.party.forEach((m) => {
    if (m === p || !m.alive) return;
    const full = m.items.length >= MAX_ITEMS;
    const label = `${m.name} (持ち ${m.items.length}/${MAX_ITEMS})` + (full ? " 満杯" : "");
    const b = btn(label, () => {
      wrap.remove();
      p.items.splice(index, 1);
      m.items.push(it);
      log(`${it.name} を ${p.name} → ${m.name} に渡した`, "win");
      SFX.select();
      stSel = null;
      renderStatus(); renderParty();
    });
    if (full) b.disabled = true;
    list.appendChild(b);
  });
  list.appendChild(btn("やめる", () => wrap.remove()));
  card.appendChild(list);
  wrap.appendChild(card);
  wrap.addEventListener("click", (e) => { if (e.target === wrap) wrap.remove(); });
  document.body.appendChild(wrap);
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
  if (!who) { log(`${itemName(it)}を見つけたが、誰も持てない…`, "sys"); refundLR(it); return null; }
  runGainItem(who, it);
  codexSeeItem(id);
  log(`${itemName(it)} を手に入れた！ (${who.name})`, logClassForItem(it));
  return { item: it, who };
}

// ---- アイテム入手演出 (イラスト込みの感動的な表示) ----
const itemGetEl = document.getElementById("item-get");

// レア度ごとの入手演出: 見出し・効果音・振動・画面の閃光
const RARITY_FANFARE = {
  c: { banner: "✦ アイテム発見 ✦" },
  uc: { banner: "✦ アンコモン発見 ✦" },
  r: { banner: "✦ レアアイテム発見！ ✦", buzz: [0, 40, 50, 40] },
  sr: { banner: "★ スーパーレア発見！ ★", flash: "#ff9a2e", buzz: [0, 60, 50, 60, 50, 120], big: true },
  lr: { banner: "★★ レジェンドレア ★★", flash: "#ff3b3b", buzz: [0, 80, 60, 80, 60, 80, 300], big: true, legend: true },
};
function showItemGet(item, who, onClose) {
  G.prompt = true; // 入力をブロック
  const rk = rarityKey(item);
  const fan = RARITY_FANFARE[rk] || null;
  if (fan && fan.big) { SFX.victory(); setTimeout(() => SFX.itemget(), 380); } else SFX.itemget();
  buzz((fan && fan.buzz) || [0, 30, 60, 30]);
  if (fan && fan.flash) flashScreen(fan.flash);
  if (fan && fan.legend) { try { shakeScreen(true); } catch {} }
  itemGetEl.onclick = null;
  itemGetEl.innerHTML = "";
  const card = el("div", "ig-card" + (rk ? " rar-" + rk : ""));
  const rc = itemRankColor(item);
  if (rc) { card.style.borderColor = rc; card.style.boxShadow = `0 0 40px ${rc}66`; }
  const unid = !!item.unidentified;
  const bannerText = fan ? fan.banner : (unid ? "✦ 未鑑定の品を発見！ ✦" : "✦ アイテム発見！ ✦");
  const ban = el("div", "ig-banner", bannerText);
  if (rc) ban.style.color = rc;
  card.appendChild(ban);
  if (fan && fan.legend) card.appendChild(el("div", "ig-beam")); // レジェンドレア: 天から差す光の柱
  const art = el("div", "ig-art");
  art.appendChild(spriteCanvas(item, 11)); // 大きめのイラスト
  // きらめき
  for (let i = 0; i < 6; i++) {
    const s = el("span", "ig-spark");
    s.style.setProperty("--a", (i * 60) + "deg");
    s.style.animationDelay = (i * 0.08) + "s";
    art.appendChild(s);
  }
  card.appendChild(art);
  card.appendChild(itemNameEl("div", "ig-name", item));
  if (rk) card.appendChild(el("div", "ig-rarity rar-" + rk, RARITIES[rk].label + (unid ? " ・ 未鑑定" : "")));
  const stat = statLines(item);
  if (stat) card.appendChild(el("div", "ig-stat", stat));
  // 装備可否は現在の編成 (人業) 単位で ○/× 表示。1人のみの時は条件バッジにフォールバック
  // 未鑑定品は正体不明なので装備可否は出さない
  if (isEquippable(item) && !unid) {
    if (G.party.length > 1) card.appendChild(equipPartyChips(item));
    else card.appendChild(el("div", "ig-class", equipClassText(item)));
  }
  card.appendChild(el("div", "ig-desc", unid ? "なんだかよくわからない品だ。鑑定すれば正体がわかるだろう。" : (item.desc || "")));
  card.appendChild(el("div", "ig-who", `${who.name} が手に入れた`));
  const ok = btn("受け取る", () => closeItemGet(onClose));
  ok.className = "btn primary ig-ok";
  card.appendChild(ok);
  itemGetEl.appendChild(card);
  // 選択肢のないポップアップは、カード外 (背景) をタップしても閉じられるようにする
  itemGetEl.onclick = (e) => { if (e.target === itemGetEl) closeItemGet(onClose); };
  itemGetEl.classList.remove("hidden");
}

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

// ---- ランクアップ専用の祝祭ポップアップ ----
// 昇格の感動を最大化するため、汎用イベントより派手に: 画面フラッシュ + 勝利ファンファーレ、
// 回転する光条と大量の火花、ランクN→N+1 の大きな昇格表示、新たに得た称号 (ランク名)、
// 進化したスプライト、そして解放されたもの (Lv上限・節目の特典) を一望させる。
function showRankUp({ clsKey, fromRank, toRank, fromLv, toLv, count }, onClose) {
  const cls = SOUL_CLASSES[clsKey] || SOUL_CLASSES.fighter;
  const accent = (SOUL_RANKS[toRank] && SOUL_RANKS[toRank].color) || cls.glow || "#ffcf4a";
  const fromCap = capForRarityRank(cls.rarity, fromRank);
  const toCap = capForRarityRank(cls.rarity, toRank);
  // 演出: ランク色のフラッシュ + 勝利ファンファーレ + 強い触覚フィードバック
  flashScreen(accent);
  SFX.victory(); buzz([0, 60, 40, 60, 40, 70, 90, 220]);

  G.prompt = true;
  itemGetEl.onclick = null;
  itemGetEl.innerHTML = "";
  const card = el("div", "ig-card ru-card");
  card.style.borderColor = accent;
  card.style.setProperty("--accent", accent);
  card.style.boxShadow = `0 0 60px ${accent}88`;

  card.appendChild(el("div", "ru-title", "✦ RANK UP ✦"));
  card.appendChild(el("div", "ru-sub", `${cls.label}の魂が 昇格した！`));

  // 回転する光条 + 進化したスプライト + 火花
  const art = el("div", "ig-art ru-art");
  const rays = el("div", "ru-rays");
  rays.style.background = `repeating-conic-gradient(from 0deg, ${accent}55 0deg 8deg, transparent 8deg 26deg)`;
  art.appendChild(rays);
  art.appendChild(spriteCanvas(jobSprite(clsKey, toRank), 11));
  for (let i = 0; i < 10; i++) {
    const s = el("span", "ig-spark");
    s.style.setProperty("--a", (i * 36) + "deg");
    s.style.animationDelay = (i * 0.06) + "s";
    s.style.background = accent;
    art.appendChild(s);
  }
  card.appendChild(art);

  // ランク表記: fromRank ➜ toRank (新ランクをランク色で強調)
  const row = el("div", "ru-rankrow");
  row.appendChild(el("span", "ru-rk", `ランク${fromRank}`));
  row.appendChild(el("span", "ru-arrow", "➜"));
  const to = el("span", "ru-rk ru-new", `ランク${toRank}`);
  to.style.color = accent; to.style.textShadow = `0 0 16px ${accent}`;
  row.appendChild(to);
  card.appendChild(row);

  // 新たに得た称号 (ランク名)
  const jn = el("div", "ru-jobname", `「${jobRankName(clsKey, toRank)}」`);
  jn.style.color = accent;
  card.appendChild(jn);

  // 解放されたもの
  const perks = el("div", "ru-perks");
  perks.appendChild(ruPerk("Lv上限", `${fromCap} → ${toCap}`, accent));
  if (toLv > fromLv) perks.appendChild(ruPerk("魂レベル", `Lv${fromLv} → Lv${toLv}`, accent));
  const hint = rankUnlockHint(toRank);
  if (hint) { const h = el("div", "ru-unlock", hint); h.style.borderColor = accent + "66"; perks.appendChild(h); }
  card.appendChild(perks);

  const ok = btn("受け取る", () => closeItemGet(onClose));
  ok.className = "btn primary ig-ok";
  ok.style.borderColor = accent; ok.style.color = accent;
  card.appendChild(ok);

  itemGetEl.appendChild(card);
  itemGetEl.onclick = (e) => { if (e.target === itemGetEl) closeItemGet(onClose); };
  itemGetEl.classList.remove("hidden");
}

// ランクアップ特典の1行 (ラベル + 値)
function ruPerk(label, val, accent) {
  const d = el("div", "ru-perk");
  d.appendChild(el("span", "ru-pl", label));
  const v = el("span", "ru-pv", val); v.style.color = accent;
  d.appendChild(v);
  return d;
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
if (descendBtn) descendBtn.addEventListener("click", () => {
  if (G.state !== "board" || G.anim || G.walking || G.prompt) return;
  const cell = findRevealedStairs();
  if (cell) askDescend(cell);
});

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
  if (G.state === "town") return FACILITY_BGM[G.town.facility] || "town";
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
view.addEventListener("click", (e) => {
  if (G._swiped) { G._swiped = false; return; } // 直前のスワイプ由来の click は無視
  const rect = view.getBoundingClientRect();
  const sx = (e.clientX - rect.left) * (VW / rect.width);
  const sy = (e.clientY - rect.top) * (VH / rect.height);
  // 戦闘中にオート戦闘なら、画面のどこをタップしても解除 (演出中もOK)
  if (G.state === "combat" && G.autoCombat) { buzz(10); stopAutoCombat(); return; }
  // 戦闘中: 敵スプライトを直接タップ
  if (G.state === "combat" && G.battle && !G.animating) {
    const b = G.battle;
    const enemy = nearestEnemyAt(sx, sy);
    // ターゲット選択フェーズ: タップで対象決定 (武器の射程が届く敵のみ)
    if (b.phase === "target" && enemy) {
      const opts = b.targetOptions();
      if (b.pending && b.pending.action !== "attack" && opts.every((t) => t.side !== "enemy")) return;
      if (!opts.includes(enemy)) { log(`${enemy.name}までは届かない！ (射程: ${RANGE_LABEL[b.attackRange((b.pending && b.pending.actor) || b.current)]})`, "sys"); SFX.ng(); return; }
      SFX.select(); buzz(10); b.chooseTarget(enemy); runCommitted();
      return;
    }
    // 入力フェーズ: どこをタップしても通常攻撃。敵の上なら対象指定、
    // 何もないところなら最寄り/先頭の敵を自動で狙う (いずれも射程内のみ)。
    if (b.phase === "input") {
      const reach = b.attackableEnemies(b.current);
      if (enemy && !reach.includes(enemy)) { log(`${enemy.name}までは届かない！ (射程: ${RANGE_LABEL[b.attackRange(b.current)]})`, "sys"); SFX.ng(); return; }
      const tgt = enemy || nearestEnemyAt(sx, sy, reach) || reach[0];
      if (!tgt) return;
      const r = b.chooseAction("attack");
      if (r && r.invalid) { renderCombatMenu(); return; }
      SFX.select(); buzz(10); b.chooseTarget(tgt); runCommitted();
      return;
    }
    return;
  }
  if (G.state !== "board" || G.anim || G.walking || uiBlocked()) return;
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
const SWIPE_IGNORE = "button, a, [role=button], #party, #status-screen, #town-screen, #town-shell, #ui-layer, #item-get, .confirm-overlay";
document.addEventListener("pointerdown", (e) => {
  if (e.pointerType === "mouse") return;
  // どこを触っても、まず進行中のスワイプ連続移動ループを止める。
  // (メンバーカード等 SWIPE_IGNORE をタップした際にループが走り続けると、
  //  移動に伴う renderParty() でカードDOMが作り直されてタップ(openStatus)が失われる)
  stopSwipe();
  if (e.target.closest(SWIPE_IGNORE)) return;
  swipe = { x: e.clientX, y: e.clientY, dir: null };
});

document.addEventListener("pointermove", (e) => {
  if (!swipe || swipe.dir) return;
  const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN) return;
  const mdx = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : -1) : 0;
  const mdy = mdx === 0 ? (dy > 0 ? 1 : -1) : 0;
  swipe.dir = { dx: mdx, dy: mdy };
  G._swiped = true;
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

// ================= 設定画面 (⚙) =================
const settingsEl = document.getElementById("settings-screen");
const settingsBtn = document.getElementById("settings-btn");

function openSettings() {
  if (G.state !== "board" && G.state !== "town") return;
  if (G.anim || G.walking || G.prompt) return;
  if (G.statusOpen) closeStatus();
  G.settingsOpen = true;
  settingsEl.classList.remove("hidden");
  renderSettings();
}
function closeSettings() {
  G.settingsOpen = false;
  settingsEl.classList.add("hidden");
}

// 設定の1行 (名前 + 説明 + 右端の操作ボタン)
function settingRow(name, desc, button, danger = false) {
  const row = el("div", "set-row" + (danger ? " danger" : ""));
  const info = el("div", "set-rowi");
  info.appendChild(el("div", "set-rown", name));
  info.appendChild(el("div", "set-rowd", desc));
  row.appendChild(info);
  row.appendChild(button);
  return row;
}

function renderSettings() {
  if (!settingsEl) return;
  settingsEl.innerHTML = "";
  const head = el("div", "set-head");
  head.appendChild(el("div", "set-title", "⚙ 設定"));
  const close = btn("✕ 閉じる", () => { SFX.select(); closeSettings(); });
  close.className = "tw-small set-close";
  head.appendChild(close);
  settingsEl.appendChild(head);

  // サウンド (ミュートはトップバーの🔊/Mキーと共通)
  const snd = btn(isMuted() ? "🔇 OFF" : "🔊 ON", () => { ensureAudio(); updateMuteBtn(toggleMute()); }); // updateMuteBtn が設定画面も再描画する
  snd.className = "tw-small set-toggle" + (isMuted() ? "" : " on");
  settingsEl.appendChild(settingRow("サウンド", "効果音とBGMのオン/オフ (Mキー)", snd));

  // 音量 (BGM / 効果音): 0〜100% を5段で切り替える
  const VOL_STEPS = [0, 0.25, 0.5, 0.8, 1];
  const volRow = (label, desc, key) => {
    const box = el("div", "set-vol");
    for (const v of VOL_STEPS) {
      const b = btn(v === 0 ? "切" : `${Math.round(v * 100)}`, () => {
        ensureAudio();
        PREFS[key] = v; savePrefs(); setVolumes(PREFS.bgm, PREFS.sfx);
        if (key === "sfx") SFX.select();
        renderSettings();
      });
      b.className = "tw-small set-volb" + (Math.abs((PREFS[key] ?? 1) - v) < 0.01 ? " on" : "");
      box.appendChild(b);
    }
    return settingRow(label, desc, box);
  };
  settingsEl.appendChild(volRow("BGM 音量", "街・迷宮・戦闘の曲の大きさ", "bgm"));
  settingsEl.appendChild(volRow("効果音 音量", "攻撃・宝箱・決定音などの大きさ", "sfx"));

  // 振動 (対応端末のみ)
  const vib = btn(PREFS.vibrate ? "📳 ON" : "OFF", () => { PREFS.vibrate = !PREFS.vibrate; savePrefs(); SFX.select(); if (PREFS.vibrate) buzz([0, 30]); renderSettings(); });
  vib.className = "tw-small set-toggle" + (PREFS.vibrate ? " on" : "");
  settingsEl.appendChild(settingRow("振動", "被弾・宝箱などで端末を震わせる (対応端末のみ)", vib));

  // 戦闘の背景: 層ごとの情景 / 原作風の漆黒の窓
  const bg = btn(PREFS.classicBattle ? "漆黒" : "情景", () => { PREFS.classicBattle = !PREFS.classicBattle; savePrefs(); SFX.select(); renderSettings(); });
  bg.className = "tw-small set-toggle" + (PREFS.classicBattle ? " on" : "");
  settingsEl.appendChild(settingRow("戦闘の背景", "情景 = 層ごとの戦場を描く / 漆黒 = 黒地に白枠の窓 (原作風)", bg));

  // 戦闘演出の倍速 (戦闘メニューの倍速ボタンと共通の設定)
  const spd = btn(G.fastAnim ? "▶▶ ON" : "▶ OFF", () => { SFX.select(); G.fastAnim = !G.fastAnim; autosave(); renderSettings(); });
  spd.className = "tw-small set-toggle" + (G.fastAnim ? " on" : "");
  settingsEl.appendChild(settingRow("戦闘演出 倍速", "戦闘のアニメーションを速める", spd));

  // データ削除 (はじめから) — 二重確認は confirmReset 側
  settingsEl.appendChild(el("div", "set-h", "データ"));
  const reset = btn("🗑 削除", confirmReset);
  reset.className = "tw-small danger";
  settingsEl.appendChild(settingRow("はじめから (全データ削除)", "人業・魂・図鑑・進行度がすべて失われる", reset, true));
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
  "quests", "dailyQuests", "subQuests", "subQuestSeen", "msq", "ach", "fastAnim", "tavernCrowd", "rumor", "rumorCooldown", "activeRumor", "deliveryQuests", "codex", "treasury", "lrOwned", "lrClock", "order", "story", "dragonSlain", "stats",
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
  "twoHanded", "weight", "price", "art", "palette", "eAtk", "eDef", "mult", "eff", "align", "cursed", "hit", "dice", "swings"];
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
  if (!G.lrOwned || typeof G.lrOwned !== "object") G.lrOwned = {}; // LR入手済み記録 (1点もの)
  // 街UIの現在地 (後付け: tab/page)。旧 {facility, sub} はそれが属するタブへ写す
  G.town = townshell.migrateTown(G.town);
  if (G.lastRun === undefined) G.lastRun = null; // 帰還の報告 (後付け)
  if (!G.order || !Array.isArray(G.order.picks)) G.order = { picks: [] }; // 控えの結社の着席指定
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
    for (const e of (G.battle.enemies || [])) if (e.key && MONSTERS[e.key]) e.mon = MONSTERS[e.key];
  }
  // 旧形式: 未生成の pendingDoll は「空の人形」として控えへ移す (生成前でも消えない)
  if (G.pendingDoll) {
    const pd = G.pendingDoll;
    pd.isEmpty = true;
    if (!pd.name || pd.name === "（未生成）") pd.name = "空の人形";
    G.reserve.push(pd);
    G.pendingDoll = null;
  }
  // 所持魂 (v5): 配列に整え、無効な職業を除き、人業のメイン魂/サブ魂を実在する魂に整える
  if (!Array.isArray(G.souls)) G.souls = [];
  G.souls = G.souls.filter((s) => s && SOUL_CLASSES[s.clsKey]);
  setSharedSouls(G.souls); // recalcDoll が所持魂を uid で引けるようにする
  for (const d of [...(G.party || []), ...(G.reserve || [])]) {
    if (!Array.isArray(d.subs)) d.subs = [];
    if (d.primary != null && !soulByUid(d.primary)) d.primary = null;
    // サブ魂を {uid, skill, passive} 形式へ正規化し、実在する魂・メイン魂と別の魂だけ残す
    // (passive を落とすと、宿しているパッシブ設定がロード時に失われ既定スキルへ戻ってしまう)
    d.subs = d.subs
      .map((x) => (x && typeof x === "object") ? { uid: x.uid, skill: x.skill || null, passive: x.passive || null } : null)
      .filter((x) => x && soulByUid(x.uid) && x.uid !== d.primary)
      .slice(0, MAX_SUBS);
    try { recalcDoll(d); } catch {}
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
  G.autoCombat = false;   // オート戦闘は再開時に解除 (誤動作防止)
  // 図鑑の移行: 旧形式 (mon[key]=true) を {kills,normal,rare,dungeons} に変換
  if (!G.codex) G.codex = { mon: {}, item: {} };
  if (!G.codex.mon) G.codex.mon = {};
  if (!G.codex.item) G.codex.item = {};
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
  // 第0章「人業の生成」: 王宮で謁見 → 戦士・僧侶・盗賊・魔導士の魂×4+🔴100を受ける (granted) → 館の保管庫で人業を1体仕立て → 報告
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
// 売却候補: 呪い・未鑑定・装備中・SR/LR・未奉納の蒐集品 (sellWarnings) は除外 (商店の一括売却と同じ)。
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
// まだ奉納していない種類の蒐集品 (同じ種類は1点だけ)
function opsDonatableList() {
  const ts = treasuryState();
  const seen = new Set();
  const out = [];
  for (const h of heldCollectibles()) {
    if (ts.donated[h.item.id] || seen.has(h.item.id)) continue;
    seen.add(h.item.id);
    out.push(h);
  }
  return out;
}
// いま ✦Soul で1段以上鍛えられる、編成の人業のメイン魂
function opsTrainableList() {
  const out = [];
  for (const d of G.party) {
    if (!d || d.primary == null) continue;
    const e = soulByUid(d.primary);
    if (!e) continue;
    const cap = soulLevelCapOf(e);
    const cost = Math.max(1, soulTrainCost(e.level) - (e.exp || 0));
    if (e.level < cap && G.soulPts >= cost) out.push({ doll: d, uid: e.uid, cost, level: e.level, cap });
  }
  return out;
}
const OPS = {
  // バッジ・提案・帰還の報告で使う数 (状態は変えない)
  counts() {
    const dolls = allDolls();
    let unid = 0, unidCost = 0;
    for (const d of dolls) for (const it of (d.items || [])) if (it && it.unidentified) { unid++; unidCost += appraiseCost(it); }
    const junk = opsJunkList();
    const dead = dolls.filter((d) => d.isDoll && !d.alive);
    let hastenCost = 0;
    const now = Date.now();
    for (const d of dead) if (d.reviveAt) hastenCost += Math.max(1, Math.ceil((d.reviveAt - now) / RESCUE_SHORTEN_MS));
    let ach = 0, treasuryReady = false;
    try { ach = opsClaimableAchievements().length; } catch (e) { ach = 0; }
    try { treasuryReady = treasuryRewardReady(); } catch (e) { treasuryReady = false; }
    return {
      hurt: G.party.filter((p) => p.alive && (p.hp < p.maxhp || p.mp < p.maxmp)).length,
      dead: dead.length,
      unid, unidCost,
      junk: junk.length, junkGold: junk.reduce((a, j) => a + j.price, 0),
      ach,
      donatable: opsDonatableList().length,
      deliverable: (G.deliveryQuests || []).filter((q) => q && deliveryHolder(q.itemId)).length,
      trainable: opsTrainableList().length,
      innCost: innCost(), hastenCost, treasuryReady,
    };
  },
  junkList: opsJunkList,
  trainableList: opsTrainableList,
  claimableAchievements: opsClaimableAchievements,
  donatableList: opsDonatableList,

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
      it.unidentified = false; it.idHardFail = false;
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
      codexSeeItem(item.id);
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

  // 今すぐ連れ帰る (赤い魂1つで20分短縮を、残りの少ない者から順に所持の続く限り。押す回数ぶんと同じ値段)
  hastenAll() {
    const dead = allDolls().filter((d) => d.isDoll && !d.alive && d.reviveAt).sort((a, b) => a.reviveAt - b.reviveAt);
    let spent = 0, revived = 0;
    for (const d of dead) {
      while (!d.alive && G.redSoul >= 1) {
        G.redSoul -= 1; spent++;
        d.reviveAt -= RESCUE_SHORTEN_MS;
        if (d.reviveAt <= Date.now()) { reviveDoll(d, true); revived++; }
      }
    }
    if (!spent) {
      if (dead.length) { log("Red Soul が足りない。", "sys"); SFX.ng(); }
      return { ok: false, spent: 0, revived: 0 };
    }
    SFX.select(); buzz(15);
    if (revived < dead.length) log(`赤い魂を ${spent} 捧げ、帰還を早めた。`, "sys");
    if (G.statusOpen) renderStatus();
    if (G.state === "town") renderTown();
    renderParty();
    return { ok: true, spent, revived, left: dead.length - revived };
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

  // 新種をまとめて奉納 (宝物庫の「新種をまとめて奉納」と同じ)
  donateAllNew() {
    const list = opsDonatableList();
    if (!list.length) return { ok: false, n: 0 };
    for (const h of list) donateCollectible(h.doll, h.item);
    SFX.itemget(); autosave();
    log(`蒐集品 ${list.length} 種を宝物庫に奉納した。`, "win");
    showToast(`${list.length}種を奉納した`);
    renderTown();
    return { ok: true, n: list.length, rewardReady: treasuryRewardReady() };
  },

  // 魂を n 段鍛える (n = Infinity で上限まで)。1段ごとの費用・上限は trainSoul と同じ。
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
    recalcAllDolls();
    codexJobSee(e.clsKey, e.count, e.level);
    SFX.levelup(); buzz([0, 30, 40, 30]);
    log(`${soulSeriesName(e.clsKey)}の魂が Lv${from}→${e.level} に成長した！ (✦${spent})`, "win");
    const deltas = {};
    if (wearer && before) for (const k of KEYS) { const d = (wearer[k] || 0) - before[k]; if (d) deltas[k === "maxhp" ? "hp" : k === "maxmp" ? "mp" : k] = d; }
    const gainedSkills = wearer ? (wearer.spells || []).filter((k) => !beforeSpells.has(k)) : [];
    showToast(`${soulSeriesName(e.clsKey)}の魂 Lv${e.level} (✦${spent})`, { tone: "good" });
    renderTown();
    return { ok: true, levels, spent, from, to: e.level, deltas, gainedSkills, wearer };
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
    renderTown, renderTownLegacy, renderBoard, renderParty, renderRunbar, updateTopbar, renderStatus,
    allDolls, recalcAllDolls, inDungeon, curDungeon, activeCfg, dungeonNumber, clearedDungeonCount,
    sellPrice, buyPrice, appraiseCost, innCost, sellWarnings, bargainMul,
    itemRankName, itemRankColor, itemGradeText, itemNameEl, logClassForItem,
    showChoice, closePrompt, showEvent, showConfirm, showToast, showItemGet, closeItemGet, showItemDetailPopup, showStoryScene,
    openStatus, closeStatus, openSettings, closeSettings, tryEnterDungeon, enterDungeon, returnToTown, confirmReturnToTown,
    tutorialAllowed, palaceCallReady, currentObjective, featureUnlocked, contentSealed, reportMainQuest, acceptMainQuest,
    trainSoul, raiseSoulCap, soulTrainCost, soulByUid, codexSeeItem, treasuryState, heldCollectibles, donateCollectible,
    claimAchievement, claimTreasury, treasuryRewardReady, deliveryHolder, deliverQuest,
    tryHastenRescue, reviveDoll, reviveTimerEl, fmtRemain,
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
  for (const m of [uiHub, uiPalace, uiFacilities, uiSettings, uiStory, uiParty, uiSoulPanel, autoEquip, uiShop, uiLoot, uiDeparture, uiDungeonHud, uiResults]) {
    try { m.install(); } catch (e) { console.error(e); }
  }
}

// ==== [WP-A] UI API ==== (街・王宮・物語・設定・タイトル: WP-A が所有)
// ==== /WP-A ====

// ==== [WP-B] UI API ==== (隊・魂・最適装備: WP-B が所有)
// ==== /WP-B ====

// ==== [WP-C] UI API ==== (商会・品・入手: WP-C が所有)
// ==== /WP-C ====

// ==== [WP-D] UI API ==== (迷宮・出撃・帰還・戦果: WP-D が所有)
// ==== /WP-D ====

// ---- 起動 ----
// タイトル画面のセーブ概要 (つづきから): 進行中の章・踏破数・編成の顔ぶれ
function titleSummary() {
  const ms = G.msq || {};
  let head = "着任したばかりの魂繰り";
  if (ms.state === "end" || ms.n > 100) head = "✦ 物語を閉じた魂繰り ✦";
  else if (ms.n >= 1) head = `第${actOf(ms.n)}層「${ACTS[actOf(ms.n) - 1].title}」`;
  const lines = [`踏破 ${clearedDungeonCount()} / 100 迷宮 ・ 人業 ${allDolls().length}体`];
  if (G.state === "board" || G.state === "combat") {
    lines.push(abyssActive() ? `探索中 — 奈落 B${G.abyss.depth}F` : `探索中 — ${curDungeon().name} B${G.floor}F`);
  }
  lines.push(`💰${G.gold}　✦${G.soulPts}　🔴${G.redSoul}`);
  const sprites = (G.party || []).filter((d) => d && d.primary != null).map((d) => dollSprite(d));
  return { head, lines, sprites };
}

function init() {
  // UI 基盤 (ctx の結線・戻る操作・街シェル・各パッケージ) を最初の描画より前に整える
  wireUI();
  // 早期にフックを公開 (起動失敗の誤検出/デバッグ用)
  window.__game = { G, edgeOpen, COLS, ROWS, autosave, loadGame, clearSave, renderTown, ACHIEVEMENTS, questProgress, pickLoot, showItemGet, startBattle, spawnCardEnemies, spawnBossEnemies, activeCfg,
    UI, ops, nav, townshell };

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
      if (statusEl) statusEl.classList.add("hidden");
      if (settingsEl) settingsEl.classList.add("hidden");
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
