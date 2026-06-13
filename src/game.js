// メインゲーム: カードボード探索 ⇄ 戦闘 (モンスターメーカー風)
import { makeBoard, COLS, ROWS } from "./board.js";
import { MONSTERS, HERO, ICONS, drawSprite, drawSpriteFit } from "./sprites.js";
import { spawnCardEnemies, spawnBossEnemies, spawnEliteEnemies, spawnMimic, Battle, SPELLS, cloneItem, spellCost } from "./combat.js";
import { initAudio, SFX, playBgm, toggleMute, isMuted } from "./audio.js";
import { spriteCanvas } from "./sprites.js";
import {
  ITEMS, SLOTS, SLOT_LABEL, SLOT_ICONS, MAX_ITEMS, recalc, equip as equipItem, unequip as unequipItem, canEquip, slotKeyFor,
  ITEM_CATS, WEAPON_CATS, WEAPON_CAT_LABEL, lvToRank, weaponRange, RANGE_LABEL,
  UNIDENT_SLOTS, itemName,
} from "./items.js";
import { RANK_NAME, RANK_COLOR, ITEM_RANK_NAME, ITEM_RANK_COLOR } from "./content.js";
import { dungeonSubQuests } from "./subquests.js";
import { TAVERN_SPEAKERS, TAVERN_HINTS } from "./tavern.js";
import { ACTS, actOf, msqOrderLines, msqReportLines, msqReward, EPILOGUE, unlockSceneFor } from "./story.js";
import { CATALOG_ITEMS } from "./catalog/index.js";
import { DUNGEONS, DUNGEON_MONSTERS, RACE_LABEL, ELEMENTS, ELITE_ORDER, monsterTraits, layerOf } from "./dungeons/index.js";
import {
  SOUL_CLASSES, SOUL_KEYS, makeDoll, soulSprite, jobSprite, dollSprite,
  recalcDoll, jobStatsOf, soulLevelCap, soulLevelCapOf, setSharedSouls, MAX_SUBS,
  soulByUid, makeSoulInstance, allSoulInstances, soulRankOf, soulLearnedSkills,
  ORDER_PERK, orderPassiveMap,
  PASSIVES, passiveName, passiveDesc,
  ATTR_KEYS, ATTR_LABEL, ATTR_NAME,
  SOUL_RANKS, rollJobClass, rollGreatJobClass, SOUL_STAT_UP,
  soulRankFromCount, nextRankThreshold, rankThresholds,
  jobLoreFor, jobRankCondText,
  jobSkillTable, jobRankName, soulSeriesName, jobPassiveTable, pLv, JOB_GEAR,
  IDENTIFY_JOBS, identifyChance, canIdentify,
} from "./souls.js";
import { showOpening } from "./opening.js";
import { pickTrap, CHEST_RANKS, rollChestRank } from "./traps.js";

// ===== コンテンツの取り込み =====
// アイテム: 一点物の手作りカタログ (src/catalog/)。二つ名つきの量産品は廃止。
// モンスター: ダンジョン単位で手作りした図鑑 (src/dungeons/) を統合。
Object.assign(ITEMS, CATALOG_ITEMS);
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

// アイテムの表示ランク名/枠色。LR (専用装備) は LR5/LR10… の専用表示にする
function itemRankName(it) { return it && it.lr ? `LR${it.lr}` : (it && it.rank ? ITEM_RANK_NAME[it.rank] : null); }
function itemRankColor(it) { return it && it.lr ? "#ff5fae" : (it && it.rank ? ITEM_RANK_COLOR[it.rank] : null); }

// ===== 出現テーブル (隠しレベル) =====
// 全アイテムは隠しレベル lv を持つ。迷宮ごとの lootLv 帯 (＋階の深さ) を中心に、
// レベルの近い品だけが出現する。中心より高レベルの品ほど出現率が急減するうえ、
// 全体補正でも高レベル品ほど稀になる (= 強い装備は深い迷宮でしか、稀にしか出ない)。
// exclusive: true のアイテムは専用抽選レイヤーで管理し、通常テーブルには含めない
const LOOT_IDS = Object.keys(ITEMS).filter((id) => ITEMS[id].slot !== "mat" && !ITEMS[id].exclusive).sort();
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
function itemsByR() {
  if (_itemsByR) return _itemsByR;
  _itemsByR = Array.from({ length: 21 }, () => []);
  for (const id of LOOT_IDS) _itemsByR[Math.max(1, Math.min(20, ITEMS[id].r20 || 1))].push(id);
  return _itemsByR;
}
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

// ===== 専用装備 統一ドロップ層 (LR・職業専用装備 x_ を一本化) =====
// 通常の出現テーブルとは独立。宝箱を開けた瞬間に flat 2% で1回だけ判定し、
// 当たれば通常の中身を差し替える (宝箱ランクや迷宮ランクには依存しない)。
// 旧 1/500 × 宝箱ランク の機構は廃止し、すべてこの 2% 機構に統一した。
const EXCL_RATE = 0.02;
const LR_UNLOCK = { 5: 40, 10: 90, 15: 140, 20: 190 }; // LR ティア → 解禁 lootLv
// その装備が出現し始める lootLv。LR はティア解禁値、職業専用装備(x_)は自レベル基準
function exclUnlockLv(it) {
  return it.lr ? (LR_UNLOCK[it.lr] || 40) : Math.max(40, (it.lv || 1) - 25);
}
let _exclIds = null;
function exclIds() {
  if (!_exclIds) _exclIds = Object.keys(ITEMS).filter((id) => ITEMS[id].exclusive);
  return _exclIds;
}
// 宝箱を開けた瞬間に1回だけ呼ぶ。ヒットすれば item id を返し、外れなら null。
// 現在の lootLv で解禁済みの専用装備から、パーティの職に合う品を強く優先して選ぶ。
function pickExclusive(lootLv) {
  if (Math.random() >= EXCL_RATE) return null;
  const pool = exclIds().filter((id) => (lootLv || 0) >= exclUnlockLv(ITEMS[id]));
  if (!pool.length) return null;
  let total = 0;
  const acc = [];
  for (const id of pool) {
    const fj = ITEMS[id].forJob;
    // 装飾品など forJob 無し=2、専用武器=パーティ発現職なら6・それ以外1
    const w = !fj ? 2 : (G.party.some((m) => m.clsKey === fj) ? 6 : 1);
    total += w;
    acc.push([id, total]);
  }
  const r = Math.random() * total;
  for (const [id, t] of acc) if (r <= t) return id;
  return acc[acc.length - 1][0];
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
const vctx = view.getContext("2d");
const logEl = document.getElementById("log");
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
  town: { facility: null, sub: null }, // 街UIの現在地 (sub: 館などのサブメニュー)
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
  codex: { mon: {}, item: {}, job: {} }, // 図鑑 (モンスター/アイテム/職業)
  treasury: { donated: {}, claimed: {} }, // 王宮の宝物庫: donated={蒐集品id:true}, claimed={"ランク:しきい値":true}
  story: 0,           // 王宮ストーリーの進行段階
  dragonSlain: false, // 竜を討ったか
  stats: { runs: 0, deepest: 0, kills: 0, deaths: 0, soulsFound: 0, bossKills: 0 }, // 戦績
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
};

const rand = (n) => Math.floor(Math.random() * n);

// ハプティクス (対応端末のみ)。パターン: 数値 or [待ち,振動,待ち,振動...]
function buzz(p) {
  if (navigator.vibrate) { try { navigator.vibrate(p); } catch {} }
}

// ---- 潜入中の戦利品トラッキング (全滅ペナルティ / Red Soul帰還で使う) ----
const inDungeon = () => G.state === "board" || G.state === "combat" || G.state === "over";
// 迷宮で得るゴールド (戦闘勝利・宝箱・床イベント) の共通入口。全体の獲得量を半分に抑える。
function runGainGold(g) { g = Math.round(g * 0.5 * sfNum("goldMul", 1) * mutNum("goldMul", 1)); G.gold += g; if (G.run && inDungeon()) G.run.gold += g; return g; }
function runGainSoulPts(s) { s = Math.round(s * sfNum("soulMul", 1) * mutNum("soulMul", 1)); G.soulPts += s; if (G.run && inDungeon()) G.run.soulPts += s; return s; }
function runGainItem(owner, item) { owner.items.push(item); if (G.run && inDungeon()) G.run.items.push({ owner, item }); }
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
  const div = document.createElement("div");
  div.className = "l-" + cls;
  div.textContent = msg;
  logEl.appendChild(div);
  while (logEl.children.length > 80) logEl.removeChild(logEl.firstChild);
  // 最新行を確実に最下部へ。iOS Safari 等では appendChild 直後の再レイアウトが
  // 間に合わず最新メッセージまでスクロールしきれないことがあるため、次フレームでも実行する。
  logEl.scrollTop = logEl.scrollHeight;
  requestAnimationFrame(() => { logEl.scrollTop = logEl.scrollHeight; });
}

// 現在の迷宮設定
function curDungeon() { return DUNGEONS[G.dungeonIdx] || DUNGEONS[0]; }

// 日付シード (日替わりクエスト・商店の無料受領の判定に使う)
function dailySeed() { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); }

function activeCfg() { return curDungeon(); }

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
  { name: "毒沼",       sym: "⚗", accent: "#a7b84a", bgm: "fieldSulfur",floorBase: "#12140d", floorTiles: ["#1a1c11", "#16180d", "#12140a"], glow: "rgba(170,195,75,0.06)" },  // 9
  { name: "嵐の尖塔",   sym: "⚡", accent: "#b6a4e0", bgm: "field8",     floorBase: "#10101a", floorTiles: ["#181826", "#14141f", "#101019"], glow: "rgba(180,160,235,0.06)" }, // 10
  { name: "闘技場跡",   sym: "✶", accent: "#c9a05a", bgm: "field3",     floorBase: "#16130d", floorTiles: ["#1f1a11", "#1a160d", "#15110a"], glow: "rgba(225,180,90,0.05)" },  // 11
  { name: "地底大空洞", sym: "◆", accent: "#8a7a5a", bgm: "field10",    floorBase: "#13110d", floorTiles: ["#1b1813", "#16140f", "#12100b"], glow: "rgba(200,180,140,0.05)" }, // 12
  { name: "魔導書庫",   sym: "✪", accent: "#9d7ad0", bgm: "fieldCrypt", floorBase: "#100e17", floorTiles: ["#181323", "#13101c", "#100d16"], glow: "rgba(160,120,225,0.06)" }, // 13
  { name: "屍蝋の回廊", sym: "‡", accent: "#b8a878", bgm: "fieldCrypt", floorBase: "#14120d", floorTiles: ["#1c1912", "#17140e", "#13100a"], glow: "rgba(210,190,130,0.05)" }, // 14
  { name: "溶鉄炉",     sym: "♨", accent: "#e07838", bgm: "field6",     floorBase: "#190e08", floorTiles: ["#23120a", "#1c0f08", "#160b06"], glow: "rgba(255,140,55,0.07)" },  // 15
  { name: "深淵の聖堂", sym: "✝", accent: "#e0d28a", bgm: "field9",     floorBase: "#14130c", floorTiles: ["#1d1b10", "#18160d", "#13110a"], glow: "rgba(240,225,150,0.06)" }, // 16
  { name: "凍てつく王墓", sym: "❅", accent: "#a8c8e0", bgm: "field7",   floorBase: "#0d1217", floorTiles: ["#141e26", "#10181f", "#0c1217"], glow: "rgba(180,215,245,0.06)" }, // 17
  { name: "冥府の門",   sym: "☖", accent: "#8c6aa8", bgm: "field9",     floorBase: "#100d14", floorTiles: ["#17121e", "#130f19", "#0f0c14"], glow: "rgba(150,110,190,0.06)" }, // 18
  { name: "竜の巣",     sym: "♦", accent: "#c8503a", bgm: "field10",    floorBase: "#170d0a", floorTiles: ["#21120c", "#1b0f0a", "#150b07"], glow: "rgba(235,90,60,0.06)" },   // 19
  { name: "終焉の玄室", sym: "✺", accent: "#b08ac0", bgm: "field10",    floorBase: "#0f0c13", floorTiles: ["#161019", "#120d15", "#0e0b11"], glow: "rgba(180,130,210,0.06)" }, // 20
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
  { id: "horde", name: "餓えた群れ", icon: "poison", accent: "#d4504e", sym: "Ψ", minFloor: 2, rate: 0.02,
    lines: ["無数の足音と唸り声…敵が異常に多い。", "群れを狩り尽くせば、魂も財も多く集まるだろう。"],
    board: (b) => sfPlace(b, 4, (c) => { c.type = "monster"; c.monsterKey = pickFrom(sfMonsterPool()); c.cleared = false; }) },
  { id: "thiefInsight", name: "盗賊の洞察", icon: "chest", accent: "#6fae46", sym: "♠", minFloor: 2, rate: 0.02, sureChest: true, sureDisarm: true,
    lines: ["盗賊の勘が冴え渡る。敵は必ず宝を遺し、罠はことごとく見抜ける。", "敵が100%宝箱を落とし、宝箱の罠解除率が100%になる。"] },
  { id: "miasma", name: "瘴気の階", icon: "poison", accent: "#8a2be2", sym: "☣", minFloor: 2, rate: 0.02, enemyMul: 1.25, soulMul: 2,
    lines: ["淀んだ瘴気が敵を昂らせている。敵が強い。", "だが得られる Soul は 2倍 になる。"] },
  { id: "caravan", name: "商隊の遺品", icon: "chest", accent: "#e0a060", sym: "❖", minFloor: 2, rate: 0.02, chestRankUp: 1,
    lines: ["全滅した商隊の荷が散らばっている。", "この階の宝箱は1ランク上等だ。"] },
  { id: "necropolis", name: "屍人の巣", icon: "corpse", accent: "#8c866f", sym: "✝", minFloor: 3, rate: 0.015,
    lines: ["おびただしい数の死体が横たわっている。", "魂を回収する好機だが、起き上がる者もいるだろう。"],
    board: (b) => sfPlace(b, 4, (c) => { c.type = "corpse"; c.cleared = false; c.corpseClass = rollJobClass(); c.corpseWarm = Math.random() < 0.5; }) },
  { id: "marsh", name: "毒の沼", icon: "poison", accent: "#5a8a2a", sym: "ஃ", minFloor: 2, rate: 0.02, goldMul: 1.5,
    lines: ["床のいたるところから毒が滲み出している。", "足場は危険だが、沼には金品が沈んでいる。ゴールド 1.5倍。"],
    board: (b) => sfEachCell(b, (c) => { if (c.type === "empty" && sfOpenCount(c) >= 2 && Math.random() < 0.30) { c.type = "poison"; c.cleared = false; } }) },
  { id: "tailwind", name: "追い風の階", icon: "stairs", accent: "#7fe0a8", sym: "≫", minFloor: 2, rate: 0.02, preempt100: true, noAmbush: true,
    lines: ["不思議と体が軽く、敵の動きがよく見える。", "常に先手を取り、奇襲を受けない。"] },
  { id: "elemSurge", name: "属性の奔流", icon: "wisp", accent: "#ff9a4a", sym: "✺", minFloor: 2, rate: 0.02, elemAll: true, cond: (cfg) => !!cfg.element,
    lines: ["迷宮の属性が荒れ狂っている。", "この階の敵はすべて迷宮の属性を帯びる。属性装備が鍵だ。"] },
  { id: "mimicNest", name: "ミミックの巣", icon: "chest", accent: "#e07840", sym: "‽", minFloor: 3, rate: 0.015, mimicRate: 0.50,
    lines: ["不自然なほど宝箱が多い…罠の匂いがする。", "宝箱の半分はミミックだ。だが倒せば上質な宝箱を残す。"],
    board: (b) => sfPlace(b, 3, (c) => { c.type = "chest"; c.cleared = false; }) },
  { id: "healing", name: "癒しの霊気", icon: "fountain", accent: "#8af0c0", sym: "✚", minFloor: 2, rate: 0.02, victoryHeal: 0.10,
    lines: ["澄んだ霊気が満ち、傷を癒してくれる。", "戦闘に勝利するたび、隊全体のHPが10%回復する。"] },
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
  { id: "hungryPack", name: "飢えた狩場", sym: "Ψ", accent: "#c08a4a", packMin: 3, rareDropRate: 0.15,
    risk: "敵が常に群れで現れる (3体以上)",
    gain: "敵のレアドロップ率が 15% になる" },
  { id: "nightHunt", name: "闇討ちの宴", sym: "🌘", accent: "#7a5ad0", ambushMul: 4, goldMul: 1.5, soulMul: 1.3,
    risk: "奇襲を受けやすくなる",
    gain: "ゴールド 1.5倍・Soul 1.3倍" },
  { id: "elemRage", name: "属性の暴走", sym: "✺", accent: "#ff9a4a", elemAll: true, soulMul: 1.5, cond: (cfg) => !!cfg.element,
    risk: "すべての敵が迷宮の属性を帯びる (属性装備がないと危険)",
    gain: "得られる Soul が 1.5倍 になる" },
  { id: "mimicMarch", name: "ミミックの行進", sym: "‽", accent: "#e07840", mimicRate: 0.30, chestRankUp: 1,
    risk: "宝箱の3割はミミックだ",
    gain: "宝箱が 1ランク上等になり、ミミックは上質な宝箱を残す" },
  { id: "abyssalSurge", name: "深淵の脈動", sym: "☠", accent: "#8a2be2", enemyMul: 1.5, soulMul: 2, goldMul: 1.5, lootBonusLv: 8,
    risk: "迷宮中の敵が大幅に強くなっている (敵の力 1.5倍)",
    gain: "Soul 2倍・ゴールド 1.5倍・落ちている装備の質が上がる" },
];
// 適用中の異変の定義 (なければ null) / 効果値の取り出し
function mutDef() { return G.mutator ? MUTATORS.find((m) => m.id === G.mutator) || null : null; }
function mutNum(key, dflt) { const m = mutDef(); return m && m[key] != null ? m[key] : dflt; }

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
  const om = orderPassiveMap(G.party || []);
  if (om[key]) lv = Math.max(lv, om[key]);
  return lv;
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

// ダンジョンのヘッダは街のヘッダ (.tw-head) と同じ構図: 中央タイトル + 右に通貨を縦並び
function setTopbarCurrency() {
  if (!topbarCur) return;
  topbarCur.innerHTML = "";
  topbarCur.appendChild(el("span", "tw-c-gold", `💰${G.gold}`));
  topbarCur.appendChild(el("span", "tw-c-soul", `✦${G.soulPts}`));
  topbarCur.appendChild(el("span", "tw-c-red", `🔴${G.redSoul}`));
  if (G.embers > 0) topbarCur.appendChild(el("span", "tw-c-ember", `🔥${G.embers}`));
}
function updateTopbar() {
  if (G.state === "town") {
    // 街では #topbar はオーバーレイ (#town-screen) に隠れる。タイトルだけ持たせておく
    floorInfo.textContent = "街";
    if (topbarCur) topbarCur.innerHTML = "";
    return;
  }
  const sp = specialDef();
  const dn = activeCfg();
  const mu = mutDef();
  const mark = (G.eliteFloor ? "☠" : sp ? "✨" : "") + (mu ? mu.sym : "");
  floorInfo.textContent = `${dn ? dn.name + " " : ""}B${G.floor}F${mark}`;
  setTopbarCurrency();
  updateDescendBtn();
  updateReturnBtn();
}

function newFloor() {
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
const CARD_W = 56, CARD_H = 50, GAP = 2;
const OX = Math.floor((480 - (COLS * CARD_W + (COLS - 1) * GAP)) / 2);
const OY = Math.floor((320 - (ROWS * CARD_H + (ROWS - 1) * GAP)) / 2);
const SPR = 3; // スプライト拡大率

function cellRect(x, y) {
  return { x: OX + x * (CARD_W + GAP), y: OY + y * (CARD_H + GAP), w: CARD_W, h: CARD_H };
}

// 石床のタイル模様 (決定的な乱数で毎回同じ見た目)。迷宮テーマに応じて色味を変える
function drawFloor() {
  const th = dungeonTheme();
  const base = th ? th.floorBase : "#121218";
  const tiles = th ? th.floorTiles : ["#17171f", "#15151c", "#131319"];
  const glow = th ? th.glow : "rgba(255,190,90,0.07)";
  vctx.fillStyle = base;
  vctx.fillRect(0, 0, view.width, view.height);
  const T = 24;
  for (let ty = 0; ty < view.height / T; ty++) {
    for (let tx = 0; tx < view.width / T; tx++) {
      const n = (tx * 7 + ty * 13) % 5;
      vctx.fillStyle = n === 0 ? tiles[0] : n === 1 ? tiles[1] : tiles[2];
      vctx.fillRect(tx * T, ty * T, T - 1, T - 1);
    }
  }
  // 中央が明るく周辺が暗いビネット (テーマに応じた灯りの色)
  const vg = vctx.createRadialGradient(view.width / 2, view.height / 2, 60, view.width / 2, view.height / 2, view.width * 0.62);
  vg.addColorStop(0, glow);
  vg.addColorStop(0.5, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.55)");
  vctx.fillStyle = vg;
  vctx.fillRect(0, 0, view.width, view.height);
  // 強敵階: 禍々しい血の霧のオーバーレイ
  if (G.eliteFloor) {
    const rg = vctx.createRadialGradient(view.width / 2, view.height / 2, 0, view.width / 2, view.height / 2, view.width * 0.9);
    rg.addColorStop(0, "rgba(100,0,0,0.08)");
    rg.addColorStop(1, "rgba(60,0,0,0.30)");
    vctx.fillStyle = rg;
    vctx.fillRect(0, 0, view.width, view.height);
  } else {
    // 特別階: その階のテーマ色のうっすらした霧
    const sp = specialDef();
    if (sp) {
      vctx.fillStyle = sp.accent + "16";
      vctx.fillRect(0, 0, view.width, view.height);
    }
  }
}

function renderBoard() {
  updateDescendBtn();
  updateReturnBtn();
  drawFloor();

  // 到達可能マスを事前計算 (静止中のみ)
  const reachable = (G.state === "board" && !G.anim && !G.walking)
    ? getReachableCells() : null;

  // 感知パッシブ: 未公開カードに敵 (敵感知) / 財宝 (財宝感知) の気配を浮かべる
  const senseE = partyPassiveLv("senseEnemy") > 0;
  const senseT = partyPassiveLv("senseTreasure") > 0;

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const cell = G.board.cells[y][x];
      const r = cellRect(x, y);
      let scaleX = 1;
      let showBack = !cell.revealed;
      if (G.flipAnim && G.flipAnim.x === x && G.flipAnim.y === y) {
        const t = Math.min(1, (performance.now() - G.flipAnim.t0) / G.flipAnim.dur);
        scaleX = Math.abs(Math.cos(t * Math.PI));
        showBack = t < 0.5;
      }
      drawCard(r, cell, scaleX, showBack);
      if (!cell.revealed && !cell.cleared) {
        const mark = senseE && cell.type === "monster" ? { text: "!", color: "#ff6b5e" }
          : senseT && cell.type === "chest" ? { text: "✦", color: "#ffd84a" } : null;
        if (mark) {
          vctx.save();
          vctx.shadowColor = mark.color;
          vctx.shadowBlur = 6;
          vctx.fillStyle = mark.color;
          vctx.font = "bold 11px monospace";
          vctx.textAlign = "center";
          const bob = Math.sin(performance.now() * 0.003 + x * 2 + y) * 1.5;
          vctx.fillText(mark.text, r.x + r.w - 9, r.y + 12 + bob);
          vctx.restore();
        }
      }
      // めくれる未公開カードのみハイライト: 隣接(1歩)は明るいグロー、遠隔は薄い枠
      // (めくり済みマスは移動可能でも枠を出さない)
      if (reachable && !cell.revealed && reachable.has(x + "," + y)) {
        vctx.save();
        if (isStep(x, y)) {
          vctx.shadowColor = "rgba(120,220,255,0.9)";
          vctx.shadowBlur = 8;
          vctx.strokeStyle = "rgba(150,230,255,0.95)";
          vctx.lineWidth = 2;
        } else {
          vctx.shadowColor = "rgba(80,160,255,0.4)";
          vctx.shadowBlur = 4;
          vctx.strokeStyle = "rgba(100,180,255,0.55)";
          vctx.lineWidth = 1.5;
        }
        vctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
        vctx.restore();
      }
    }
  }

  // 公開済みマスの壁をカード境界の上に重ね描き (隣カードの影に紛れないように)
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const cell = G.board.cells[y][x];
      if (!cell.revealed) continue;
      if (G.flipAnim && G.flipAnim.x === x && G.flipAnim.y === y) continue; // めくり中は描かない
      drawWallsOverlay(cell, cellRect(x, y));
    }
  }
  // 進めない方向へ移動を試みた時の赤い壁フラッシュ
  if (G.wallFlash) {
    const t = (performance.now() - G.wallFlash.t0) / 350;
    if (t <= 1) {
      drawWallBar(cellRect(G.wallFlash.x, G.wallFlash.y), G.wallFlash.dir, {
        flash: 1 - t,
      });
    } else {
      G.wallFlash = null;
    }
  }

  // プレイヤー (移動中は前マスから次マスへ補間してスライド)
  let hx, hy;
  if (G.heroAnim) {
    const a = G.heroAnim;
    let t = Math.min(1, (performance.now() - a.t0) / a.dur);
    t = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // ease-in-out
    const from = cellRect(a.fromX, a.fromY), to = cellRect(a.toX, a.toY);
    hx = (from.x + from.w / 2) + ((to.x + to.w / 2) - (from.x + from.w / 2)) * t;
    hy = (from.y + from.h / 2) + ((to.y + to.h / 2) - (from.y + from.h / 2)) * t;
  } else {
    const pr = cellRect(G.px, G.py);
    hx = pr.x + pr.w / 2;
    hy = pr.y + pr.h / 2;
  }
  // 足元の影
  vctx.save();
  vctx.fillStyle = "rgba(0,0,0,0.4)";
  vctx.beginPath();
  vctx.ellipse(hx, hy + 16, 12, 4, 0, 0, Math.PI * 2);
  vctx.fill();
  vctx.restore();
  drawSprite(vctx, HERO, hx, hy, SPR);

  renderParty();
}

// マスの辺の壁 (カード境界の上に重ね描き)。絶対座標で太く明るく描く
const WALL_T = 8;

// 指定セルの壁をすべて描く
function drawWallsOverlay(cell, r) {
  for (const d of ["n", "e", "s", "w"]) {
    if (cell.walls[d]) drawWallBar(r, d, {});
  }
}

// 1辺ぶんの壁バー。境界(隙間)の中央にまたがるように描く
function drawWallBar(r, dir, { flash = 0 } = {}) {
  const half = WALL_T / 2;
  let bx, by, bw, bh, horiz;
  if (dir === "n") { bx = r.x - 1; by = r.y - half; bw = r.w + 2; bh = WALL_T; horiz = true; }
  else if (dir === "s") { bx = r.x - 1; by = r.y + r.h - half; bw = r.w + 2; bh = WALL_T; horiz = true; }
  else if (dir === "w") { bx = r.x - half; by = r.y - 1; bw = WALL_T; bh = r.h + 2; horiz = false; }
  else { bx = r.x + r.w - half; by = r.y - 1; bw = WALL_T; bh = r.h + 2; horiz = false; }

  vctx.save();
  if (flash > 0) {
    // ブロックされた時の赤フラッシュ
    vctx.shadowColor = "rgba(255,70,60,0.9)";
    vctx.shadowBlur = 10 * flash;
    vctx.fillStyle = `rgba(255,90,80,${0.55 + 0.45 * flash})`;
    vctx.fillRect(bx, by, bw, bh);
    vctx.restore();
    return;
  }
  // 石壁: 明るめのグラデーションでカードの影と区別
  const g = horiz
    ? vctx.createLinearGradient(bx, by, bx, by + bh)
    : vctx.createLinearGradient(bx, by, bx + bw, by);
  g.addColorStop(0, "#a2a2b4");
  g.addColorStop(0.45, "#7c7c8e");
  g.addColorStop(1, "#54545f");
  vctx.fillStyle = g;
  vctx.fillRect(bx, by, bw, bh);
  // 石の継ぎ目
  vctx.fillStyle = "#3a3a46";
  if (horiz) {
    for (let i = 1; i < 4; i++) vctx.fillRect(bx + (bw * i) / 4 - 0.5, by + 1, 1, bh - 2);
  } else {
    for (let i = 1; i < 5; i++) vctx.fillRect(bx + 1, by + (bh * i) / 5 - 0.5, bw - 2, 1);
  }
  // 上面ハイライトと輪郭
  vctx.fillStyle = "rgba(255,255,255,0.3)";
  if (horiz) vctx.fillRect(bx, by, bw, 1.5); else vctx.fillRect(bx, by, 1.5, bh);
  vctx.strokeStyle = "#15151d";
  vctx.lineWidth = 1;
  vctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
  vctx.restore();
}

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

function drawCard(r, cell, scaleX, showBack) {
  // カードの落ち影 (フリップ中も足元に残す)
  vctx.save();
  vctx.fillStyle = "rgba(0,0,0,0.45)";
  vctx.fillRect(r.x + 2, r.y + 3, r.w - 2, r.h - 1);
  vctx.restore();

  vctx.save();
  vctx.translate(r.x + r.w / 2, r.y + r.h / 2);
  vctx.scale(Math.max(0.02, scaleX), 1);
  vctx.translate(-r.w / 2, -r.h / 2);

  if (showBack) {
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
  } else {
    // 表面 (探索済み): マス目を見せず、石床として連続的に塗る。
    // GAP ぶん外側まで塗って隣の開いたマスと繋がり、グリッド線を消す。
    const fg = vctx.createLinearGradient(0, 0, 0, r.h);
    fg.addColorStop(0, "#23222c");
    fg.addColorStop(1, "#191820");
    vctx.fillStyle = fg;
    vctx.fillRect(-GAP, -GAP, r.w + GAP * 2, r.h + GAP * 2);
    // ごく薄い石目 (決定的)
    vctx.fillStyle = "rgba(255,255,255,0.02)";
    vctx.fillRect(2, 2, r.w - 4, 2);

    const cx = r.w / 2, cy = r.h / 2;
    // 毒の床: 緑の毒だまりを描く (アイコンではなく地形として)
    if (cell.type === "poison") {
      vctx.save();
      vctx.fillStyle = "rgba(90,150,40,0.45)";
      vctx.beginPath();
      vctx.ellipse(cx, cy + 4, r.w * 0.36, r.h * 0.26, 0, 0, Math.PI * 2);
      vctx.fill();
      vctx.fillStyle = "rgba(150,220,70,0.5)";
      const t = performance.now() * 0.002;
      for (let i = 0; i < 3; i++) {
        const bx = cx + Math.sin(t + i * 2.1) * 10;
        const by = cy + 2 + Math.cos(t * 1.3 + i * 1.7) * 5;
        vctx.beginPath();
        vctx.arc(bx, by, 2 + (i % 2), 0, Math.PI * 2);
        vctx.fill();
      }
      vctx.fillStyle = "rgba(190,255,120,0.8)";
      vctx.font = "9px monospace";
      vctx.textAlign = "center";
      vctx.fillText("☠", cx, cy - 8);
      vctx.restore();
    }
    // アイコン選択。倒した敵は何も残さない / 宝箱は開封後に空箱 / 死体は常に表示
    const icon =
      cell.type === "monster" && !cell.cleared ? MONSTERS[cell.monsterKey] :
      cell.type === "chest" ? (cell.cleared ? ICONS.chestOpen : ICONS.chest) :
      cell.type === "trap" && !cell.cleared ? ICONS.trap :
      cell.type === "fountain" && !cell.cleared ? ICONS.fountain :
      cell.type === "corpse" ? ICONS.corpse :
      cell.type === "portal" ? ICONS.portal :
      cell.type === "stairs" ? ICONS.stairs : null;
    if (icon) {
      // アイコンの足元影
      vctx.fillStyle = "rgba(0,0,0,0.35)";
      vctx.beginPath();
      vctx.ellipse(cx, cy + 14, 13, 3.5, 0, 0, Math.PI * 2);
      vctx.fill();
      drawSpriteFit(vctx, icon, cx, cy, 3);
      // あたたかい死体 (魂未回収) には青い人魂を浮かべる
      if (cell.type === "corpse" && cell.corpseWarm && !cell.cleared) {
        const bob = Math.sin(performance.now() * 0.004 + cx) * 2;
        vctx.save();
        vctx.shadowColor = "rgba(127,208,255,0.9)";
        vctx.shadowBlur = 8;
        drawSprite(vctx, ICONS.wisp, cx + 7, cy - 12 + bob, 1.6);
        vctx.restore();
      }
    }
    // 強敵バッジ: 表に出た強敵モンスターカードに赤帯を描く
    if (cell.type === "monster" && !cell.cleared && cell.elite) {
      vctx.save();
      vctx.fillStyle = "rgba(150,10,10,0.88)";
      vctx.fillRect(0, 0, r.w, 11);
      vctx.strokeStyle = "#ff3030";
      vctx.lineWidth = 0.5;
      vctx.strokeRect(0, 0, r.w, 11);
      vctx.fillStyle = "#ffaaaa";
      vctx.font = "bold 7px monospace";
      vctx.textAlign = "center";
      vctx.textBaseline = "middle";
      vctx.fillText("★ 強 敵 ★", r.w / 2, 5.5);
      vctx.restore();
    }
    // 壁は renderBoard 側で境界上に重ね描きする
  }
  vctx.restore();
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
  if (G.state !== "board" || G.anim || G.walking || G.prompt || G.statusOpen || G.settingsOpen) return;
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
        log("毒の床だ。だが足音ひとつ立てず無傷で渡った。", "sys");
        break;
      }
      SFX.trap(); buzz([0, 40, 30, 40]);
      flashScreen("#5a8a2a");
      let anyDeath = false;
      const fallen = [];
      for (const p of G.party) {
        if (!p.alive) continue;
        let dmg = Math.max(1, Math.ceil(p.maxhp * 0.05));
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
  const id = pickItemByR(dropCenterR());
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
// ゴールド発見などと同じ中央オーバーレイカードに、イラスト+タイトル+選択肢を表示
function showChoice(title, options, icon, { banner = "✦ 発見 ✦", accent = "#c9a227", lines = [] } = {}) {
  G.prompt = true;
  itemGetEl.onclick = null; // 直前のポップアップが残した背景ハンドラを念のため消す
  itemGetEl.innerHTML = "";
  const card = el("div", "ig-card");
  card.style.borderColor = accent;
  card.style.boxShadow = `0 0 40px ${accent}55`;
  const bn = el("div", "ig-banner", banner);
  bn.style.color = accent;
  card.appendChild(bn);
  if (icon) {
    const art = el("div", "ig-art");
    art.appendChild(spriteCanvas(icon, 9));
    card.appendChild(art);
  }
  card.appendChild(el("div", "ig-name", title));
  for (const ln of lines) card.appendChild(el("div", "ig-desc", ln));
  const list = el("div", "ig-choices");
  for (const o of options) {
    const b = btn(o.label, () => { closePrompt(); o.fn(); });
    if (o.danger) b.classList.add("danger");
    list.appendChild(b);
  }
  card.appendChild(list);
  itemGetEl.appendChild(card);
  itemGetEl.classList.remove("hidden");
}

function closePrompt() {
  G.prompt = false;
  itemGetEl.classList.add("hidden");
  itemGetEl.innerHTML = "";
  itemGetEl.onclick = null; // 古い背景クリックハンドラを消す (次のポップアップへ漏れないように)
  autosave(true);
}

// 階段: 降りるか選ぶ。最深階の階段は、層末迷宮では層ボスへの扉、それ以外では踏破口。
function askDescend(cell) {
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
        if (boss) { log("迷宮の主が立ちはだかる！", "dmg"); startBattle(spawnBossEnemies(dn.boss, dn.bossScale * enemyScale()), cell); }
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
// 解除値 = AGI + LUK。盗賊系の職業は1.5倍のボーナス
function disarmPower(m) {
  let v = (m.agi || 0) + (m.luk || 0);
  if (m.jobKey && m.jobKey.split("+").includes("thief")) v *= 1.5;
  return Math.round(v);
}

// 解除難度: ダンジョンランクと宝箱ランクで決まる。
// 迷宮の魂レベル帯 (これも迷宮ランクの関数) から「適正パーティの AGI+LUK」を見積もり、
// 適正レベルの盗賊系で最大95% (上限)、それ以外で70〜80% になるよう調整している。
// cRank: 宝箱ランク (1-5)。床罠は1扱い
function disarmNeed(cRank = 1) {
  const cfg = activeCfg();
  const L = 2 + (cfg.soulLevelBonus || 0) * 2.4;        // 適正な魂レベルの目安 (強化込み)
  const f = 1 + (L - 1) * 0.12;                          // souls.js の lvlFactor と同式
  const q = 1 + ((cfg.rank || 1) - 1) * 0.14;            // ダンジョンランク: 深部は高ランク魂が前提
  const c = 1 + ((cRank || 1) - 1) * 0.16;               // 宝箱ランク: 上等な箱ほど狡猾な錠前
  return 17 * f * q * c;
}

function disarmChance(m, cRank = 1) {
  if ((specialDef() || {}).sureDisarm) return 1; // 盗賊の洞察: 罠解除率100%
  return Math.max(0.05, Math.min(0.95, disarmPower(m) / disarmNeed(cRank)));
}

// 宝箱ランク (1-5) を取得。セルに未設定ならその場で抽選して保存する
// (出現%表示と実際の判定がぶれないよう、同じ宝箱では固定)
function chestRankOf(cell) {
  if (cell && cell.cRank) return cell.cRank;
  const cfg = activeCfg();
  const floors = Math.max(1, cfg.floors || 3);
  const depth = floors > 1 ? Math.min(1, (G.floor - 1) / (floors - 1)) : 0;
  // 特別階 (商隊の遺品) / 迷宮の異変 (閉ざされた退路など): 宝箱ランクが上がる
  const r = Math.min(5, rollChestRank(depth, cfg.rank || 1) + sfNum("chestRankUp", 0) + mutNum("chestRankUp", 0));
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

  // 残りはダメージ/吸収系: 効果を適用して結果をまとめて表示する
  const lines = [trap.flavor];
  const fallen = [];
  const hurt = (p, mult) => {
    const dmg = Math.max(1, Math.round(trapBaseDmg() * mult));
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
    if (!ail || !p.alive || p.ailment || Math.random() >= chance) return;
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
  // ===== 専用装備 統一ジャックポット抽選 (flat 2%・通常の中身より先に判定) =====
  // LR (レジェンドレア) と職業専用装備(x_) を同じ 2% 機構で抽選する
  const exId = pickExclusive(Math.min(200, lootLvAt() + lootUp));
  if (exId && ITEMS[exId]) {
    const it = cloneItem(exId);
    const fj = it.forJob;
    // 専用武器は forJob 一致者を優先して渡す
    const who = (fj && G.party.find((m) => m.alive && m.clsKey === fj && m.items.length < MAX_ITEMS))
              || (fj && G.party.find((m) => m.clsKey === fj && m.items.length < MAX_ITEMS))
              || G.party.find((m) => m.alive && m.items.length < MAX_ITEMS)
              || G.party.find((m) => m.items.length < MAX_ITEMS);
    if (who) {
      runGainItem(who, it); codexSeeItem(exId);
      flashScreen(it.lr ? "#ff5fae" : (SOUL_CLASSES[it.forJob] ? SOUL_CLASSES[it.forJob].glow : "#ffcf4a"));
      SFX.victory(); buzz([0, 60, 50, 60, 50, 60, 240]);
      const mark = it.lr ? "★" : "✦";
      const label = it.lr ? `LR${it.lr} 専用装備` : "職業専用装備";
      log(`${mark} ${label}「${it.name}」を発見！ (${who.name})`, "win");
      setTimeout(() => showToast(`${mark} ${it.name}`), 200);
      showItemGet(it, who, done);
      return;
    }
  }
  // 中身の抽選 (ダンジョンレベルに応じる): ゴールド50% / ゴールド以外のアイテム50%
  // 伝説の宝箱・ミミック宝箱はゴールドにならず、必ず装備品が出る
  if (!legendary && !noGold && Math.random() < 0.5) {
    SFX.chest();
    const dRank = activeCfg().rank || 1;
    const g = runGainGold(Math.round((10 + G.floor * 12 + rand(30)) * (1 + (dRank - 1) * 0.5) * rankMul));
    updateTopbar();
    log(`宝箱から ${g} ゴールドを手に入れた！`, "win");
    showEvent({
      sprite: ICONS.gold, title: "ゴールド発見！", accent: "#e8c24a", banner: "✦ 宝箱の中身 ✦", sparkle: true,
      lines: [`${g} ゴールドを手に入れた！`], onClose: done || (() => renderBoard()),
    });
    return;
  }
  // 宝: 装備/アイテム (迷宮のアイテムレベル帯から抽選。高ランクの宝箱は一段上の帯)
  const got = giveItem(pickItemByR(dropCenterR({ chestRank: cRank, lvBonus: lootUp })));
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
      const got = giveItem(pickItemByR(dropCenterR({ rare: true })));
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
  if (!who) { log(`${d.item.name}を見つけたが、誰も持てない…`, "sys"); next(); return; }
  const ce = codexMonEntry(d.key);
  if (d.rare) ce.rare = true; else ce.normal = true;
  codexSeeItem(d.id);
  markDungeonLoot(d.item);
  runGainItem(who, d.item);
  SFX.chest();
  log(`宝箱から ${d.name}の落とした ${itemName(d.item)} を手に入れた！`, d.rare ? "win" : "sys");
  if (d.rare) setTimeout(() => showToast(`🌟レアドロップ ${itemName(d.item)}`), 500);
  showItemGet(d.item, who, next);
}


function descend() {
  SFX.stairs();
  buzz([0, 20, 80, 20]);
  G.floor++;
  G.maxFloorReached = Math.max(G.maxFloorReached, G.floor);
  questProgress("floor", G.floor);
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
          onClose: () => {},
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
          onClose: () => {},
        });
      } else {
        G.prompt = false;
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

// 軽量トースト通知 (レベルアップなどの祝福演出)
function showToast(text) {
  const t = el("div", "toast", text);
  document.body.appendChild(t);
  setTimeout(() => t.classList.add("show"), 20);
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 400); }, 2200);
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
    // 追い風の階 (preempt100) では必ず先手を取れる
    const pre = (spFloor && spFloor.preempt100) ? 1 : 0.08 + (partyPassiveLv("initiative") ? 0.15 : 0);
    const r = Math.random();
    if (r < amb) opening = "ambush";
    else if (r < amb + pre) opening = "preempt";
  }
  if (opening === "preempt") { log("先手を取った！", "win"); showToast("⚡ 先制攻撃！"); }
  else if (opening === "ambush") { log("奇襲された！", "dmg"); showToast("⚠ 奇襲された！"); buzz([0, 60, 40, 60]); }
  // ランク帯ごとの戦闘テーマ (ボス・強敵は専用曲)。図鑑への記録は「倒した時」に行う (endBattle)
  playBgm(battleBgm(isBoss || isElite));
  G.battle = new Battle(G.party, enemies, log, { opening, noFlee: mutNum("noFlee", false) });
  G.fx = null;
  G.animating = false;
  G.enemyPos = {};
  if (G.partyFx) G.partyFx.clear();
  autosave(true); // 戦闘開始を保存
  combatStep(); // 素早い敵が先手なら自動で動く
}

// 全体描画 (キャンバス + パーティ + メニュー)
function renderCombat() {
  renderCombatCanvas();
  renderParty();
  renderCombatMenu();
}

// キャンバスのみ (アニメーション毎フレーム用)
function renderCombatCanvas() {
  const b = G.battle;
  const fx = G.fx;
  const now = performance.now();
  // 背景: 闇 + 紫の奥光 + 石床
  vctx.fillStyle = "#06050a";
  vctx.fillRect(0, 0, view.width, view.height);
  const grad = vctx.createRadialGradient(view.width / 2, view.height * 0.36, 24, view.width / 2, view.height * 0.36, view.width * 0.72);
  grad.addColorStop(0, "#241733");
  grad.addColorStop(0.55, "#120c1c");
  grad.addColorStop(1, "#06050a");
  vctx.fillStyle = grad;
  vctx.fillRect(0, 0, view.width, view.height);
  // 地面のライン
  const floorY = view.height * 0.62;
  const fgr = vctx.createLinearGradient(0, floorY, 0, view.height);
  fgr.addColorStop(0, "rgba(110,80,140,0.16)");
  fgr.addColorStop(1, "rgba(0,0,0,0)");
  vctx.fillStyle = fgr;
  vctx.fillRect(0, floorY, view.width, view.height - floorY);

  // 味方スプライトは非表示。敵は画面全幅に左右対称で配置する (中央寄せ)
  const HERO_ZONE = 0; // 左の余白なし: 敵をキャンバス中央に揃える

  // 隊列: 4体以上は前衛(先頭3体)・後衛(4体目以降)の2列に分かれる。
  // 奥に立つ後衛から先に描き、前衛を手前に重ねて遠近を出す
  const frontRow = b.enemies.slice(0, 3);
  const backRow = b.enemies.slice(3);
  const rows = backRow.length
    ? [{ list: backRow, y: view.height * 0.30, back: true }, { list: frontRow, y: view.height * 0.49, back: false }]
    : [{ list: frontRow, y: view.height * 0.40, back: false }];
  // タップで狙える敵 = 攻撃が届く敵のみ (対象選択中は候補、入力中は手番キャラの武器射程)
  const targetable = new Set(
    G.animating ? []
    : b.phase === "target" ? b.targetOptions().filter((t) => t.side === "enemy")
    : b.phase === "input" && b.current && b.current.side === "party" ? b.attackableEnemies(b.current)
    : []);
  G.enemyPos = {};
  for (const row of rows) row.list.forEach((e, i) => {
    const baseX = HERO_ZONE + ((view.width - HERO_ZONE) / (row.list.length + 1)) * (i + 1);
    const baseY = row.y;
    G.enemyPos[e.uid] = { cx: baseX, cy: baseY };
    if (!e.alive) return; // 倒した敵は完全に消す (薄い残像を残さない)
    let ox = 0, oy = 0, alpha = 1;
    // 攻撃側の踏み込み (こちらへ前進)
    if (fx && fx.lunge && fx.lunge.uid === e.uid) oy = (fx.lunge.p || 0) * 22;
    // 被弾フラッシュ: 点滅 + 横揺れ
    const hf = fx && fx.flash && fx.flash[e.uid];
    if (hf) {
      const dt = now - hf.t0;
      if (dt < 260) {
        ox = Math.sin(dt * 0.07) * 4;
        if (Math.floor(dt / 55) % 2 === 0) alpha = 0.35;
      }
    }
    const size = e.boss ? 14 : row.back ? 8 : 9; // 後衛は奥にいるぶん少し小さい
    // 入力/ターゲット選択中: タップで攻撃できる敵に金のリングとマーカーを表示
    const tappable = e.alive && targetable.has(e);
    if (tappable) {
      const strong = b.phase === "target"; // 対象選択中はくっきり、入力中は控えめ
      vctx.save();
      vctx.globalAlpha = strong ? 1 : 0.5;
      vctx.strokeStyle = "#ffd84a";
      vctx.lineWidth = 2;
      vctx.setLineDash([6, 4]);
      vctx.lineDashOffset = -now * 0.02; // リングが回転して目立たせる
      vctx.beginPath();
      vctx.ellipse(baseX, baseY + size * 5.4, size * 3.8, size * 1.4, 0, 0, Math.PI * 2);
      vctx.stroke();
      vctx.setLineDash([]);
      if (strong) {
        vctx.fillStyle = "#ffd84a";
        vctx.font = "12px monospace";
        vctx.textAlign = "center";
        vctx.fillText("▼", baseX, row.back ? baseY - 82 : baseY - size * 6.2); // 後衛はプレートのさらに上
      }
      vctx.restore();
    }
    // 足元の影 (踏み込みに追従)
    vctx.save();
    vctx.globalAlpha = e.alive ? 0.45 : 0.15;
    vctx.fillStyle = "#000";
    vctx.beginPath();
    vctx.ellipse(baseX + ox, baseY + size * 5.4, size * 3.4, size * 1.1, 0, 0, Math.PI * 2);
    vctx.fill();
    vctx.restore();
    drawSpriteFit(vctx, e.mon, baseX + ox, baseY + oy, size, alpha);
    // 被弾時の白フラッシュ
    if (hf && now - hf.t0 < 200) {
      vctx.save();
      vctx.globalAlpha = 0.5 * (1 - (now - hf.t0) / 200);
      vctx.fillStyle = "#ffffff";
      vctx.beginPath();
      vctx.arc(baseX + ox, baseY + oy, size * 3.2, 0, Math.PI * 2);
      vctx.fill();
      vctx.restore();
    }
    // 名前プレート (ダークピル)。弱点看破 (scan) 持ちがいれば敵の属性を開示する
    const scanTag = partyPassiveLv("scan") && e.alive && e.element && e.element !== "none"
      ? `【${(ELEMENTS[e.element] || {}).label || ""}】` : "";
    const label = e.name + scanTag + (e.asleep ? " 💤" : "") + (e._flinch ? " 💫" : "");
    vctx.font = "10px monospace";
    vctx.textAlign = "center";
    const tw = vctx.measureText(label).width;
    vctx.fillStyle = "rgba(8,8,14,0.75)";
    vctx.strokeStyle = e.alive ? "rgba(160,140,180,0.4)" : "rgba(90,90,102,0.3)";
    vctx.lineWidth = 1;
    // 後衛のプレート/HPバーは頭上に出す (足元は前衛に隠れるため)
    const px = baseX - tw / 2 - 7, py2 = baseY + (row.back ? -76 : 70), pw = tw + 14, ph = 14;
    vctx.beginPath();
    vctx.roundRect ? vctx.roundRect(px, py2, pw, ph, 7) : vctx.rect(px, py2, pw, ph);
    vctx.fill();
    vctx.stroke();
    vctx.fillStyle = e.alive ? "#e7e3d4" : "#5a5a66";
    vctx.fillText(label, baseX, py2 + 10);
    // HPバー (グラデーション + 枠)
    const bw = 56, bh = 6, bx = baseX - bw / 2, by = baseY + (row.back ? -58 : 88);
    vctx.fillStyle = "#1b1b26";
    vctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
    const ratio = Math.max(0, e.hp / e.maxhp);
    const hg = vctx.createLinearGradient(bx, by, bx, by + bh);
    if (e.alive) {
      hg.addColorStop(0, ratio > 0.5 ? "#ff7a72" : "#ffb14a");
      hg.addColorStop(1, ratio > 0.5 ? "#c23a34" : "#c97a18");
    } else { hg.addColorStop(0, "#333"); hg.addColorStop(1, "#222"); }
    vctx.fillStyle = hg;
    vctx.fillRect(bx, by, bw * ratio, bh);
    vctx.strokeStyle = "rgba(0,0,0,0.6)";
    vctx.strokeRect(bx - 0.5, by - 0.5, bw + 1, bh + 1);
  });

  if (fx) drawEffects(fx, now);
}

// 攻撃/魔法/被弾エフェクトの描画
function drawEffects(fx, now) {
  // 斬撃 (白い斜線が走る)
  for (const s of fx.slashes) {
    const t = (now - s.t0) / 240;
    if (t < 0 || t > 1) continue; // t0 が未来 (多段の2撃目以降) のものはまだ描かない
    vctx.save();
    vctx.globalAlpha = 1 - t;
    vctx.strokeStyle = "#ffffff";
    vctx.lineWidth = 3;
    for (let k = 0; k < 3; k++) {
      const off = (k - 1) * 12;
      vctx.beginPath();
      vctx.moveTo(s.x - 26 + off, s.y - 26);
      vctx.lineTo(s.x + 26 + off, s.y + 26);
      vctx.stroke();
    }
    vctx.restore();
  }
  // 魔法 (色付きリングが広がる + 火花)
  for (const m of fx.magic) {
    const t = (now - m.t0) / 360;
    if (t < 0 || t > 1) continue;
    vctx.save();
    vctx.globalAlpha = 1 - t;
    vctx.strokeStyle = m.color;
    vctx.lineWidth = 4;
    vctx.beginPath();
    vctx.arc(m.x, m.y, 6 + t * 34, 0, Math.PI * 2);
    vctx.stroke();
    vctx.fillStyle = m.color;
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + t * 3;
      const r = 8 + t * 30;
      vctx.fillRect(m.x + Math.cos(a) * r - 2, m.y + Math.sin(a) * r - 2, 4, 4);
    }
    vctx.restore();
  }
  // 画面フラッシュ (味方被弾=赤)
  if (fx.screen) {
    const t = (now - fx.screen.t0) / 260;
    if (t <= 1) {
      vctx.save();
      vctx.globalAlpha = 0.4 * (1 - t);
      vctx.fillStyle = fx.screen.color;
      vctx.fillRect(0, 0, view.width, view.height);
      vctx.restore();
    }
  }
  // ダメージ数値 (浮き上がって消える)
  vctx.textAlign = "center";
  for (const f of fx.floats) {
    const t = (now - f.t0) / 700;
    if (t < 0 || t > 1) continue; // t0 が未来 (多段の2撃目以降) のものはまだ描かない
    vctx.save();
    vctx.globalAlpha = 1 - t;
    vctx.fillStyle = f.color;
    vctx.strokeStyle = "#000";
    vctx.lineWidth = 3;
    vctx.font = "bold 18px monospace";
    const yy = f.y - t * 26;
    vctx.strokeText(f.text, f.x, yy);
    vctx.fillText(f.text, f.x, yy);
    vctx.restore();
  }
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
  return bestD < 70 ? best : null;
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

// オート戦闘中の常設バナー: 演出中も表示し続け、いつでも解除できる
function renderAutoBanner(actor) {
  combatMenu.innerHTML = "";
  combatMenu.appendChild(el("div", "who", actor ? `▶ ${actor.name} (⚡オート戦闘中)` : "⚡ オート戦闘中"));
  combatMenu.appendChild(btn("⏹ オート解除 (画面タップでもOK)", stopAutoCombat));
}

function renderCombatMenu() {
  const b = G.battle;
  combatMenu.innerHTML = "";
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
    const rowTag = b.isBackRow(actor) ? "後衛" : "前衛";
    combatMenu.appendChild(el("div", "who", `▶ ${actor.name} のターン [${rowTag}・射程:${RANGE_LABEL[b.attackRange(actor)]}] ・ 敵タップで攻撃`));
    const row = el("div", "row");
    row.appendChild(btn("⚔ 攻撃", () => act("attack")));
    if (actor.spells.length) row.appendChild(btn("✦ スキル", () => showSpells(actor)));
    else row.appendChild(btn("✦ スキル", () => log("スキルを使えない", "sys")));
    row.appendChild(btn("🛡 防御", () => act("defend")));
    row.appendChild(btn("🏃 逃走", () => act("run")));
    combatMenu.appendChild(row);
    const row2 = el("div", "row");
    row2.appendChild(btn("⚡ オート", () => { G.autoCombat = true; renderCombatMenu(); }));
    row2.appendChild(btn(G.fastAnim ? "▶▶ 倍速:ON" : "▶ 倍速:OFF", () => { G.fastAnim = !G.fastAnim; autosave(); renderCombatMenu(); }));
    combatMenu.appendChild(row2);
  } else if (b.phase === "target") {
    combatMenu.appendChild(el("div", "who", "対象を選択 (敵を直接タップでもOK)"));
    const opts = b.targetOptions();
    // 対象が多い時 (敵の群れなど) は2列に並べて縦に伸びすぎないようにする
    const list = el("div", "target-list" + (opts.length > 3 ? " cols2" : ""));
    for (const t of opts) {
      const label = t.side === "enemy"
        ? `${b.isBackRow(t) ? "【後】" : ""}${t.name} (HP ${t.hp})`
        : `${t.name} (HP ${t.hp}/${t.maxhp})${t.alive ? "" : " [気絶]"}`;
      list.appendChild(btn(label, () => { b.chooseTarget(t); runCommitted(); }));
    }
    combatMenu.appendChild(list);
    combatMenu.appendChild(btn("← 戻る", () => { b.cancelTarget(); renderCombatMenu(); }));
  }
}

function showSpells(actor) {
  combatMenu.innerHTML = "";
  combatMenu.appendChild(el("div", "who", `${actor.name} のスキル (MP ${actor.mp})　長押しで詳細`));
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
    const b = btn(`${sp.name} (MP${cost}) - ${sp.desc}`, () => { if (locked) { SFX.ng(); return; } act("spell", key); });
    if (locked) { b.classList.add("locked"); b.style.opacity = "0.4"; }
    // 長押しでスキル詳細を表示 (MP不足などで押せない技でも内容は確認できる)
    attachLongPress(b, () => { SFX.select(); showSkillPopup(key); });
    list.appendChild(b);
  }
  combatMenu.appendChild(list);
  combatMenu.appendChild(btn("← 戻る", () => renderCombatMenu()));
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
    if (G.autoCombat) renderAutoBanner(); else combatMenu.innerHTML = "";
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
    if (G.autoCombat) renderAutoBanner(); else combatMenu.innerHTML = "";
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
  if (G.autoCombat) renderAutoBanner(); else combatMenu.innerHTML = "";
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
  const TOTAL = WIND + (360 + (maxStack - 1) * HIT_STAGGER) * spdMul();
  G.fx = { lunge: res.side === "enemy" ? { uid: res.actor.uid, p: 0 } : null,
           slashes: [], magic: [], floats: [], screen: null, flash: {} };
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
        fx.slashes.push({ x: pos.cx, y: pos.cy, t0: ht0 });
      }
      if (idx === 0 || !fx.flash[h.target.uid]) fx.flash[h.target.uid] = { t0: ht0 };
      if (h.dmg != null) fx.floats.push({ x: pos.cx + dx, y: pos.cy - 18, text: String(h.dmg) + (h.crit ? "!" : ""), color: h.crit ? "#ffd84a" : "#fff", t0: ht0 });
      else if (h.heal != null) fx.floats.push({ x: pos.cx + dx, y: pos.cy - 18, text: "+" + h.heal, color: "#7CFC7C", t0: ht0 }); // 敵の回復役による回復
      if (h.died) anyDeath = true;
    } else {
      // 味方が対象
      if (h.heal != null) {
        G.partyFx.set(h.target, "heal");
        fx.floats.push({ x: view.width / 2, y: view.height - 26, text: "+" + h.heal, color: "#7CFC7C", t0: now });
      } else if (h.steal) {
        // 窃盗: ゴールド/Soul の控除はここで行う (combat.js は G を知らない)
        partyHit = true;
        G.partyFx.set(h.target, "hit");
        if (h.steal === "goldSteal") {
          const s = Math.min(G.gold, h.stealAmt || 0);
          G.gold -= s;
          if (G.run) G.run.gold = Math.max(0, G.run.gold - s);
          log(`${h.target.name}は ${s} ゴールドを奪われた！`, "dmg");
          fx.floats.push({ x: view.width / 2, y: view.height - 26, text: `-💰${s}`, color: "#ffd84a", t0: now });
        } else {
          const s = Math.min(G.soulPts, h.stealAmt || 0);
          G.soulPts -= s;
          if (G.run) G.run.soulPts = Math.max(0, G.run.soulPts - s);
          log(`${h.target.name}は ✦${s} Soul を吸い取られた！`, "dmg");
          fx.floats.push({ x: view.width / 2, y: view.height - 26, text: `-✦${s}`, color: "#b06bff", t0: now });
        }
        updateTopbar();
      } else if (h.stoned) {
        partyHit = true;
        G.partyFx.set(h.target, "hit");
        fx.floats.push({ x: view.width / 2, y: view.height - 26, text: "石化!", color: "#c9c4b8", t0: now });
      } else if (!h.miss) {
        partyHit = true;
        G.partyFx.set(h.target, "hit");
        fx.floats.push({ x: view.width / 2, y: view.height - 26, text: String(h.dmg) + (h.fatal ? " 即死!" : ""), color: h.fatal ? "#ff2a2a" : "#ff6b6b", t0: now });
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
  const share = Math.floor((soulGot || 0) / 3);
  if (share <= 0) return queue;
  // 経験値は「編成中に宿している魂」(メイン魂・サブ魂とも) ごとに1回ずつ入る。
  // 同じ魂を複数人が宿すことはない (魂は1体ごとに個別) ので重複加算は起きない。
  const worn = [];
  const seen = new Set();
  for (const m of G.party) {
    if (!m || !m.alive) continue;
    const add = (uid) => { if (uid == null || seen.has(uid)) return; seen.add(uid); worn.push(uid); };
    if (m.primary != null) add(m.primary);
    for (const s of (m.subs || [])) if (s) add(s.uid);
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
  // 宿している魂すべてに Soul を加算してレベルアップ (上限超過分は exp に蓄積)
  for (const uid of worn) {
    const e = soulByUid(uid);
    if (!e) continue;
    const cap = soulLevelCapOf(e);
    e.exp = (e.exp || 0) + share;
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
    const goldGot = runGainGold(Math.round(gold * (gl >= 2 ? 1.30 : gl === 1 ? 1.15 : 1)));
    const soulGot = runGainSoulPts(Math.round(soul * (sl >= 2 ? 1.20 : sl === 1 ? 1.10 : 1)));
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
      recordMonsterKill(e.key, G.dungeonIdx); // 図鑑は「倒した時」に記録
    }
    // 戦利品は勝利ごとに1品まで汎用抽選 (固有ドロップ廃止)。宝箱は1つだけ現れる
    let drop = rollGenericDrop();
    // 強敵討伐ボーナス: 高ランクアイテムの確定ドロップ
    const wasElite = b.enemies.some((e) => !e.alive && e.mon && e.mon.elite);
    if (wasElite) {
      const eid = pickItemByR(dropCenterR({ elite: true })); // 適正帯より2ランク上のアイテム
      if (ITEMS[eid]) drop = { key: "elite", name: "強敵", id: eid, item: cloneItem(eid), rare: true };
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
    // 迷宮踏破は本物の主戦のみ。死体から湧いた個体 (corpse) は boss フラグを持っていても踏破扱いにしない
    const wasBoss = !corpse && b.enemies.some((e) => e.boss);
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
      const after = clearInfo ? () => showDungeonClearedPopup(clearInfo) : null;
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
  // 特別階 (癒しの霊気): 戦闘勝利のたび隊全体のHPが回復する
  const fh = sfNum("victoryHeal", 0);
  if (fh > 0) {
    let mist = false;
    for (const p of G.party) {
      if (!p.alive || p.hp >= p.maxhp) continue;
      p.hp = Math.min(p.maxhp, p.hp + Math.ceil(p.maxhp * fh));
      mist = true;
    }
    if (mist) log("癒しの霊気が傷を塞いだ。", "heal");
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
  if (countBoss) { G.stats.bossKills++; questProgress("boss", null, 1); }
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
  itemGetEl.appendChild(card);
  itemGetEl.classList.remove("hidden");
}

// ---- パーティ表示 ----
function highlightActor(actor) {
  [...partyEl.children].forEach((c, i) => {
    c.classList.toggle("active", G.party[i] === actor);
  });
}

function renderParty() {
  partyEl.innerHTML = "";
  const fx = G.partyFx;
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
    card.innerHTML = `
      <div class="name"><span class="rowtag ${idx < 3 ? "front" : "back"}">${idx < 3 ? "前" : "後"}</span>${p.name}${p.ailment ? ` <span class="ail">${AIL_ICON[p.ailment] || "☠"}</span>` : ""}</div>
      <div class="cls">${p.cls} Lv${p.isDoll ? (p.jobLv || 1) : p.level}</div>
      <div class="bar hp"><i style="width:${(p.hp / p.maxhp) * 100}%"></i></div>
      <div class="nums">HP ${p.hp}/${p.maxhp}</div>
      ${p.maxmp > 0 ? `<div class="bar mp"><i style="width:${(p.mp / p.maxmp) * 100}%"></i></div>
      <div class="nums">MP ${p.mp}/${p.maxmp}</div>` : ""}
      ${buffBadges(p)}
    `;
    partyEl.appendChild(card);
  });
}

// 戦闘中の発動効果バッジ: 能力ごとに 強化(▲)/弱体(▼) を段階数ぶん並べ、残りターンを添える。
const BUFF_STAT_ICON = { atk: "⚔", vit: "🛡", agi: "💨" };
const BUFF_STAT_LABEL = { atk: "ATK", vit: "VIT", agi: "AGI" };
function buffBadges(p) {
  if (G.state !== "battle" || !p.alive || !p.effects || !p.effects.length) return "";
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
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
function btn(label, onClick) {
  const b = document.createElement("button");
  b.className = "btn";
  b.textContent = label;
  b.addEventListener("click", onClick);
  return b;
}

// 長押し検出: ~450ms 押し続けたら onHold を呼び、その直後のクリックは抑制する。
// タッチ/マウス両対応。指が大きく動いたら(スクロール扱い)キャンセルする。
function attachLongPress(elm, onHold, ms = 450) {
  let timer = null, fired = false, sx = 0, sy = 0;
  const clear = () => { if (timer) { clearTimeout(timer); timer = null; } };
  const start = (x, y) => {
    fired = false; sx = x; sy = y;
    clear();
    timer = setTimeout(() => { fired = true; onHold(); }, ms);
  };
  const move = (x, y) => { if (timer && (Math.abs(x - sx) > 10 || Math.abs(y - sy) > 10)) clear(); };
  elm.addEventListener("pointerdown", (e) => start(e.clientX, e.clientY));
  elm.addEventListener("pointermove", (e) => move(e.clientX, e.clientY));
  elm.addEventListener("pointerup", clear);
  elm.addEventListener("pointercancel", clear);
  elm.addEventListener("pointerleave", clear);
  // 長押しが発火していたら通常クリック(スキル発動など)を握り潰す
  elm.addEventListener("click", (e) => { if (fired) { e.preventDefault(); e.stopPropagation(); fired = false; } }, true);
}

// ================= 街 (拠点) =================
const townEl = document.getElementById("town-screen");
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
  if (G.state !== "board" || G.anim || G.walking || G.prompt || G.statusOpen || G.settingsOpen) return;
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

const FACILITIES = [
  { key: "mansion", icon: "🏚", name: "人業の館", desc: "人業を仕立て、魂を宿す" },
  { key: "tavern", icon: "🍺", name: "酒場「沈まぬ灯」", desc: "編成とクエスト" },
  { key: "shop", icon: "🏪", name: "商店「黒鉄商会」", desc: "装備・道具の売買" },
  { key: "inn", icon: "🛏", name: "宿屋「白狼」", desc: "魂を休め、傷を癒す" },
  { key: "palace", icon: "👑", name: "王宮", desc: "勅命と図鑑の間" },
  { key: "shrine", icon: "🔴", name: "赤い魂の祠", desc: "Red Soul を授かる" },
];

// 編成 + 控えの全人業
function allDolls() { return [...G.party, ...G.reserve]; }

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
  const cur = el("div", "tw-cur");
  cur.appendChild(el("span", "tw-c-gold", `💰${G.gold}`));
  cur.appendChild(el("span", "tw-c-soul", `✦${G.soulPts}`));
  cur.appendChild(el("span", "tw-c-red", `🔴${G.redSoul}`));
  if (G.embers > 0) cur.appendChild(el("span", "tw-c-ember", `🔥${G.embers}`));
  head.appendChild(cur);
  return head;
}

function renderTown() {
  autosave(); // 街での操作のたびに保存 (描画はアクション後に呼ばれる)
  townEl.classList.remove("hidden");
  townEl.innerHTML = "";
  updateTopbar();
  townEl.classList.remove("shop-mode"); // 商店専用レイアウトを解除 (商店なら再付与)
  playBgm(sceneBgm()); // 施設ごとのBGM (同じ曲なら継続)
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
  renderTownHub();
}

let townBandOpen = null; // 迷宮選択で開いている層域 (null = 選択中の迷宮の層域)

function renderTownHub() {
  townEl.appendChild(townHeader("辺境の街 ロアダル", false));



  // 第0章 (人業の生成) の間は、王宮 (+下賜後は人業の館) 以外を閉ざす
  const tut = G.msq && G.msq.n === 0 && G.msq.state === "active";
  const tutAllowed = tut ? (G.msq.granted ? ["palace", "mansion"] : ["palace"]) : null;

  // 施設グリッド (受けられる勅命があれば王宮に印)
  const grid = el("div", "tw-grid");
  for (const fac of FACILITIES) {
    const locked = tutAllowed && !tutAllowed.includes(fac.key);
    const c = el("div", "tw-fac" + (locked ? " locked" : ""));
    c.appendChild(el("div", "tw-faci", locked ? "🔒" : fac.icon));
    c.appendChild(el("div", "tw-facn", fac.name));
    c.appendChild(el("div", "tw-facd", locked ? "王命を果たすまで閉ざされている" : fac.desc));
    if (fac.key === "palace" && palaceCallReady()) c.appendChild(el("div", "tw-facb", G.msq.state === "report" ? "❗ 踏破を報告" : "❗ 新たな勅命"));
    if (locked) c.style.opacity = "0.45";
    else c.addEventListener("click", () => { SFX.select(); G.town.facility = fac.key; renderTown(); });
    grid.appendChild(c);
  }
  townEl.appendChild(grid);

  // パーティ概要 (タップで個別ステータス画面)
  const roster = el("div", "tw-roster");
  roster.appendChild(el("div", "tw-h", `編成 (${G.party.length}/6) — タップでステータス`));
  const list = el("div", "tw-rlist");
  G.party.forEach((d, i) => {
    const chip = dollChip(d);
    chip.style.cursor = "pointer";
    chip.addEventListener("click", () => openStatus(i));
    list.appendChild(chip);
  });
  if (!G.party.length) list.appendChild(el("div", "tw-empty",
    tut ? "人業がいない。まずは王宮で王に謁見しよう。" : "人業がいない。館で仕立てよう。"));
  roster.appendChild(list);
  townEl.appendChild(roster);

  // 迷宮 (勅命第1章を拝命するまで、場所は明かされない)
  if (G.unlockedDungeons < 1) {
    townEl.appendChild(el("div", "tw-h", "迷宮"));
    townEl.appendChild(el("div", "tw-note", "王の勅命を受けるまで、迷宮の在処は明かされない。"));
  } else {
    // 迷宮の選択 — 10迷宮ごとの「層域」アコーディオン (数が増えても一覧が伸びすぎない)
    townEl.appendChild(el("div", "tw-h", "潜る迷宮を選ぶ"));
    townEl.appendChild(el("div", "tw-dunhelp", "★踏破済みの迷宮には何度でも再挑戦できる — 戦利品・魂・図鑑集めに。"));
    const clearedCnt = clearedDungeonCount();
    // 勅命の対象迷宮 (攻略中の章のみ ❗ を付ける)
    const targetIdx = G.msq && G.msq.state === "active" && G.msq.n >= 1 ? G.msq.n - 1 : -1;
    const openBand = (townBandOpen != null) ? townBandOpen : Math.floor(G.dungeonIdx / 10);
    const maxBand = Math.floor((G.unlockedDungeons - 1) / 10); // 解放済み迷宮が属する最後の層域
    for (let b = 0; b <= maxBand; b++) {
      const s = b * 10, e = Math.min(DUNGEONS.length, s + 10);
      // 出現済み (解放済み) の迷宮のみ表示する。未出現の迷宮は一切見せない (先を伏せる)
      const appeared = Math.max(0, Math.min(G.unlockedDungeons - s, e - s));
      if (appeared <= 0) continue;
      const det = el("details", "tw-band");
      if (b === openBand) det.open = true;
      const sum = el("summary", "tw-bandh");
      const clearedIn = Math.max(0, Math.min(clearedCnt - s, appeared));
      sum.textContent = `${clearedIn >= e - s ? "★ " : ""}第${b + 1}層域 — 迷宮 ${s + 1}〜${s + appeared} (踏破 ${clearedIn})`;
      det.appendChild(sum);
      det.addEventListener("toggle", () => {
        if (det.open) townBandOpen = b;
        else if (townBandOpen === b) townBandOpen = null;
      });
      const dlist = el("div", "tw-mlist");
      for (let i = s; i < s + appeared; i++) {
        const dn = DUNGEONS[i];
        const cleared = i < clearedCnt;
        const row = el("div", "tw-dungeon" + (i === G.dungeonIdx ? " sel" : "") + (cleared ? " cleared" : ""));
        const info = el("div", "tw-chipi");
        info.appendChild(el("div", "tw-chipn", `${i + 1}. ${dn.name}`));
        const elTag = dn.element && ELEMENTS[dn.element] ? ` ・${ELEMENTS[dn.element].label}の気配` : "";
        info.appendChild(el("div", "tw-chipc", `全${dn.floors}階 ・ 敵ランク${dn.rank}${elTag}`));
        row.appendChild(info);
        // 踏破状態バッジ (★踏破済=再挑戦可 / ❗勅命=攻略対象 / 未踏破)
        const st = el("div", "tw-dunst" + (cleared ? " done" : i === targetIdx ? " quest" : ""));
        st.textContent = cleared ? "★ 踏破済" : i === targetIdx ? "❗ 勅命" : "未踏破";
        row.appendChild(st);
        row.addEventListener("click", () => { G.dungeonIdx = i; SFX.select(); renderTown(); });
        dlist.appendChild(row);
      }
      det.appendChild(dlist);
      townEl.appendChild(det);
    }
  }

  // 迷宮へ (常に1階から) — スクロール位置に関わらず押せるよう画面下部に固定表示
  if (G.unlockedDungeons >= 1) {
    const divebar = el("div", "tw-divebar");
    const again = G.dungeonIdx < clearedDungeonCount(); // 踏破済みへの再挑戦
    const dive = btn(`${again ? "⚔" : "🕳"} 「${curDungeon().name}」へ${again ? "再挑戦" : "潜る"} (B1F)`, tryEnterDungeon);
    dive.className = "btn primary tw-dive";
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

// 人業の小カード (名前/職業/HP)
function dollChip(d) {
  const chip = el("div", "tw-chip" + (d.alive ? "" : " dead"));
  const dom = d.dominant;
  if (dom) {
    const s = el("span", "tw-chips");
    s.style.color = SOUL_CLASSES[dom.clsKey].glow;
    s.appendChild(spriteCanvas(dollSprite(d), 2));
    chip.appendChild(s);
  }
  const info = el("div", "tw-chipi");
  info.appendChild(el("div", "tw-chipn", d.name + (d.alive ? "" : " †")));
  info.appendChild(el("div", "tw-chipc", `${d.cls} Lv${d.jobLv || 1}`));
  chip.appendChild(info);
  chip.appendChild(el("div", "tw-chiphp",
    d.alive ? `HP ${d.hp}/${d.maxhp}` : `⏳${fmtRemain(Math.max(0, (d.reviveAt || Date.now()) - Date.now()))}`));
  return chip;
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
  const grid = el("div", "tw-grid");
  for (const m of MANSION_MENU) {
    // 第0章 (人業の生成) の間は「人業保管庫」のみ開放。残りはロック＆グレーアウト
    const locked = tutM && m.key !== "manage";
    const c = el("div", "tw-fac" + (locked ? " locked" : ""));
    c.appendChild(el("div", "tw-faci", locked ? "🔒" : m.icon));
    c.appendChild(el("div", "tw-facn", m.name));
    c.appendChild(el("div", "tw-facd", locked ? "人業を生み出すまで閉ざされている" : m.desc));
    if (locked) c.style.opacity = "0.45";
    else c.addEventListener("click", () => { SFX.select(); G.town.sub = m.key; altarSel = null; renderTown(); });
    grid.appendChild(c);
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
  row.appendChild(el("div", "tw-chiphp",
    d.primary == null ? "編成不可" :
    d.alive ? `HP ${d.hp}/${d.maxhp}` : `⏳${fmtRemain(Math.max(0, (d.reviveAt || Date.now()) - Date.now()))}`));
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
        const skName = subRef && subRef.skill && SPELLS[subRef.skill] ? SPELLS[subRef.skill].name : "技を選ぶ";
        const skl = el("div", "tw-parts2" + (subRef && subRef.skill ? "" : " dim"), `▶ ${skName}`);
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
    const nextAt = subSlots === 0 ? 10 : 20;
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
  if (!benched.length) {
    townEl.appendChild(el("div", "tw-note", "編成に出していない魂をランク2以上に育てると、職業に応じたパーティ全体の加護を授ける。"));
    return;
  }
  const om = orderPassiveMap(G.party);
  const box = el("div", "tw-soullist");
  for (const s of benched) {
    const cls = SOUL_CLASSES[s.clsKey];
    const perk = ORDER_PERK[s.clsKey];
    const rank = soulRankOf(s);
    if (!perk || !PASSIVES[perk]) continue;
    const lv = Math.min(PASSIVES[perk].lv.length, rank >= 4 ? 2 : 1);
    const r = el("div", "tw-soulrow");
    const o = el("span", "tw-chips"); o.style.color = cls.glow; o.appendChild(spriteCanvas(jobSprite(s.clsKey, rank), 2));
    r.appendChild(o);
    const info = el("div", "tw-chipi");
    info.appendChild(el("div", "tw-souln", `${jobRankName(s.clsKey, rank)}（R${rank}）`));
    info.appendChild(el("div", "tw-soulst", `${passiveName(perk, lv)}: ${passiveDesc(perk, lv)}`));
    r.appendChild(info);
    box.appendChild(r);
  }
  townEl.appendChild(box);
  if (Object.keys(om).length) townEl.appendChild(el("div", "tw-note", "結社の加護はパーティ全体に常時適用される。編成に出すと加護は止まる(本人として働く)。"));
}

function jobSig(d) { return d.jobKey ? `${d.jobKey}:${d.jobRank}` : "none"; }
function announceJobChange(d, before) {
  if (!d.jobKey || jobSig(d) === before) return;
  SFX.victory(); buzz([0, 30, 50, 30]);
  showCodexJobDetail(d.jobKey, d.jobRank, `${d.name} は ${d.cls} になった！`);
}

// 選択中スロットに魂を宿す/外す (メイン魂=転職、サブ魂=技の借用)。魂は1体ごとに固有
function equipSoulToSlot(d, uid) {
  const before = jobSig(d);
  const s = soulByUid(uid);
  if (!s) return;
  if (altarSlot === "primary" && d.primary === uid) {
    d.primary = null; // 同じ魂をタップで外す
  } else if (altarSlot !== "primary" && (d.subs[+altarSlot.slice(3)] || {}).uid === uid) {
    d.subs.splice(+altarSlot.slice(3), 1); // 同じ魂をタップで外す
    d.subs = d.subs.filter(Boolean);
  } else {
    if (soulWornByOther(uid, d)) { log("他の人業が宿している魂は宿せない。", "sys"); SFX.ng(); return; }
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

// サブ魂が使うスキルを選ぶポップアップ (その魂が覚えているスキルから1つ)
function openSubSkillPicker(d, subRef) {
  if (!subRef) return;
  const s = soulByUid(subRef.uid); if (!s) return;
  const learned = soulLearnedSkills(s);
  if (!learned.length) { log("この魂はまだスキルを覚えていない。", "sys"); SFX.ng(); return; }
  const opts = learned.map((sk) => ({
    label: `${SPELLS[sk] ? SPELLS[sk].name : sk}${subRef.skill === sk ? "（設定中）" : ""}`,
    fn: () => { subRef.skill = sk; recalcDoll(d); d.hp = Math.min(d.hp, d.maxhp); d.mp = Math.min(d.mp, d.maxmp); SFX.select(); renderTown(); },
  }));
  opts.push({ label: "やめる", fn: () => {} });
  showChoice(`${soulSeriesName(s.clsKey)}の魂 — 使うスキルを選ぶ`, opts,
    jobSprite(s.clsKey, Math.max(1, soulRankOf(s))),
    { banner: "✦ サブ魂のスキル ✦", accent: SOUL_CLASSES[s.clsKey].glow });
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
  recalcAllDolls();
  codexJobSee(t.clsKey, t.count, t.level);
  const after = soulRankOf(t);
  SFX.itemget(); buzz([0, 30, 50, 30]);
  log(`${SOUL_CLASSES[t.clsKey].label}の魂を吸収させた (魂数 ×${t.count})。`, "win");
  if (t.level > beforeLv) log(`蓄積した Soul が反映され、Lv${beforeLv} → Lv${t.level} に上昇した！`, "win");
  if (after > before) { SFX.victory(); showToast(`⤴ ${jobRankName(t.clsKey, after)} に昇格！`); }
  // 融合のポップアップ: 魂の輝きが増したことと、全能力の上昇率を伝える
  const pct = Math.round((SOUL_STAT_UP[SOUL_CLASSES[t.clsKey].rarity] || 0.01) * 100);
  const lines = [`全能力が基礎値の ${pct}% ずつ高まる（魂数 ${t.count}）`];
  if (t.level > beforeLv) lines.push(`蓄積した Soul が反映され Lv${beforeLv} → Lv${t.level}`);
  if (after > before) lines.push(`⤴ ランク${after}「${jobRankName(t.clsKey, after)}」に昇格！`);
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

// ---- 酒場の噂話: 次の潜入で必ず起きる「予兆」を生成し、盤面に反映 ----
const RUMOR_SPEAKERS = ["隻眼の傭兵", "酔った盗掘者", "巡礼の僧", "宿の女将", "傷だらけの斥候", "黒衣の占い師"];

function rollRumor() {
  // 噂は次の潜入の開始階 (B1F) で必ず現実になる (applyRumorToBoard)。
  // 文言もその階を指す (深い階を語ると、実際に起きる場所と食い違ってしまう)
  const floor = 1;
  const speaker = RUMOR_SPEAKERS[rand(RUMOR_SPEAKERS.length)];
  const roll = Math.random();
  // 2% で未発見の職業ヒント
  if (roll < 0.02) {
    const undiscovered = []; // 混成職は廃止 (ヒント噂は出さない)
    if (undiscovered.length) {
      const key = undiscovered[rand(undiscovered.length)];
      const [baseK, subK] = key.split("+");
      const bn = SOUL_CLASSES[baseK].label, sn = SOUL_CLASSES[subK].label;
      return { type: "hybridHint", hybridKey: key, floor, speaker,
        text: `「〈${bn}〉の魂を多く宿し、〈${sn}〉の魂を添えると……奇妙な力が宿るらしい。眉唾だがな。」` };
    }
  }
  if (roll < 0.45) {
    // あたたかい死体 (職業指定) の予兆
    const clsKey = rollJobClass();
    const cl = SOUL_CLASSES[clsKey].label;
    return { type: "warmCorpse", clsKey, floor, speaker,
      text: `「B${floor}Fで、まだあたたかい〈${cl}〉の死体を見た。魂が宿っているはずだ。」` };
  } else if (roll < 0.70) {
    return { type: "soulRich", floor, speaker,
      text: `「B${floor}Fは死者が多い。あたたかい死体がいくつも転がっているとか…。」` };
  } else if (roll < 0.90) {
    return { type: "treasure", floor, speaker,
      text: `「B${floor}Fの奥で金属の輝きを見たという話だ。宝箱がひとつ余分にあるかもな。」` };
  }
  return { type: "fountain", floor, speaker,
    text: `「B${floor}Fには癒しの泉が湧いているらしい。傷ついたら探すといい。」` };
}

// 盤面生成後に、予兆 (rumor) を反映する
function applyRumorToBoard(board) {
  const r = G.activeRumor;
  if (!r) return;
  G.activeRumor = null;
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
  if (r.type === "warmCorpse") setCorpse(r.clsKey);
  else if (r.type === "soulRich") { for (let i = 0; i < 3; i++) setCorpse(rollJobClass()); }
  else if (r.type === "treasure") { const c = pickCell(); if (c) { c.type = "chest"; c.cleared = false; } }
  else if (r.type === "fountain") {
    // 泉は1階層に最大1つ。既にあれば追加しない
    let hasFountain = false;
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (board.cells[y][x].type === "fountain") hasFountain = true;
    if (!hasFountain) { const c = pickCell(); if (c) { c.type = "fountain"; c.cleared = false; } }
  }
  log(`噂どおりだ… (${r.speaker}の話)`, "sys");
}

function renderTavern() {
  townEl.appendChild(townHeader("酒場「沈まぬ灯」"));
  townEl.appendChild(el("div", "tw-lead", "迷宮帰りの流れ者がたむろする。世界の噂や冒険のヒントを聞ける。(編成は人業の館)"));

  // --- 酒場の顔ぶれ: 帰還ごとに入れ替わる3〜5名。各人が世界の噂・冒険のヒントを語る ---
  if (!G.tavernCrowd || !G.tavernCrowd.length) rollTavernCrowd();
  townEl.appendChild(el("div", "tw-h", "今 酒場にいる者たち"));
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

  // 依頼と噂を扱えるのは「名の知れた魂繰り」(15迷宮踏破) から。それまでは情報を聞くだけの場。
  if (!featureUnlocked("rumor")) {
    const lockBox = el("div", "tw-rumor");
    lockBox.appendChild(el("div", "tw-rumors", "― まだ仕事の話はない ―"));
    lockBox.appendChild(el("div", "tw-rumort", `酒場が依頼や噂を回すのは、名の知れた魂繰りが現れてからだ。15 迷宮を踏破すれば、情報屋も腰を上げよう。（現在 ${clearedDungeonCount()} 踏破）`));
    townEl.appendChild(lockBox);
    return;
  }

  // --- 噂話 ---
  townEl.appendChild(el("div", "tw-h", "酒場の噂話"));
  if (G.rumor) {
    const rb = el("div", "tw-rumor");
    rb.appendChild(el("div", "tw-rumors", `― ${G.rumor.speaker} ―`));
    rb.appendChild(el("div", "tw-rumort", G.rumor.text));
    const noteText = G.rumor.type === "hybridHint"
      ? "これは迷宮で現実になる話ではないが……真偽はお前が確かめるしかない。"
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
      townEl.appendChild(el("div", "tw-note", "100ゴールドで噂話を一つ聞ける。迷宮に潜れば現実になるという…。"));
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

  // --- クエスト掲示板 (常設 + 日替わり) ---
  const questRow = (q) => {
    const row = el("div", "tw-quest" + (q.state === "done" ? " done" : ""));
    const info = el("div", "tw-chipi");
    info.appendChild(el("div", "tw-chipn", (q.daily ? "🌙 " : "📜 ") + q.name));
    info.appendChild(el("div", "tw-chipc", q.desc));
    const rw = [`💰${q.reward.gold}`];
    if (q.reward.soulPts) rw.push(`✦${q.reward.soulPts}`);
    if (q.reward.redSoul) rw.push(`🔴${q.reward.redSoul}`);
    if (q.reward.soul) rw.push(`${SOUL_CLASSES[q.reward.soul].label}の魂`);
    info.appendChild(el("div", "tw-chipc", "報酬: " + rw.join(" + ") +
      (q.state !== "avail" ? ` ・ 進捗 ${Math.min(q.progress, q.goal)}/${q.goal}` : "")));
    row.appendChild(info);
    if (q.state === "avail") {
      const b = btn("受注", () => { q.state = "active"; SFX.select(); log(`クエスト「${q.name}」を受注した。`, "sys"); renderTown(); });
      b.className = "tw-small";
      row.appendChild(b);
    } else if (q.state === "active") {
      row.appendChild(el("div", "tw-chiphp", "進行中"));
    } else if (q.state === "done") {
      const b = btn("報告する", () => claimQuest(q));
      b.className = "tw-small primary";
      row.appendChild(b);
    }
    return row;
  };

  // 日替わり依頼 (毎日3件。日付が変わると入れ替わる)
  ensureDailyQuests();
  townEl.appendChild(el("div", "tw-h", "今日の依頼 — 日替わり"));
  const dql = el("div", "tw-mlist");
  for (const q of G.dailyQuests.list) {
    if (q.state === "claimed") continue;
    dql.appendChild(questRow(q));
  }
  if (![...dql.children].length) dql.appendChild(el("div", "tw-empty", "今日の依頼はすべて果たした。また明日。"));
  townEl.appendChild(dql);

  townEl.appendChild(el("div", "tw-h", "依頼の掲示板"));
  const ql = el("div", "tw-mlist");
  for (const q of G.quests) {
    if (q.state === "claimed") continue;
    ql.appendChild(questRow(q));
  }
  if (![...ql.children].length) ql.appendChild(el("div", "tw-empty", "依頼はすべて果たされた。"));
  townEl.appendChild(ql);

  // --- 酒場の依頼人 (サブクエスト): 迷宮の階ごとに1件 ---
  // 一度表示した迷宮の依頼は、別の迷宮を選んでも酒場に残り続ける (発見済みを蓄積)。
  if (!G.subQuestSeen) G.subQuestSeen = [];
  if (!G.subQuestSeen.includes(G.dungeonIdx)) G.subQuestSeen.push(G.dungeonIdx);
  townEl.appendChild(el("div", "tw-h", "酒場の依頼人"));
  townEl.appendChild(el("div", "tw-note", "迷宮ごとに、事情を抱えた依頼人がいる。依頼はどの迷宮にいても条件を満たせば達成できる。一度顔を合わせた依頼人は別の迷宮を選んでも酒場に残り、果たした依頼は消える。"));
  const sql = el("div", "tw-mlist");
  // 選択中の迷宮を先頭に、発見済みの迷宮順で並べる
  const seenDuns = [...new Set(G.subQuestSeen)].filter((i) => DUNGEONS[i])
    .sort((a, b) => (a === G.dungeonIdx ? -1 : b === G.dungeonIdx ? 1 : a - b));
  let subAny = false;
  for (const di of seenDuns) {
    const defs = dungeonSubQuests(di).filter((def) => {
      const st = G.subQuests[def.id];
      return !(st && st.state === "claimed");
    });
    if (!defs.length) continue;
    // どの迷宮の依頼かを明示する見出し (現在選択中は印を付ける)
    const head = el("div", "tw-subh", `🗺 ${DUNGEONS[di].name}` + (di === G.dungeonIdx ? "（選択中）" : ""));
    sql.appendChild(head);
    for (const def of defs) {
      const st = G.subQuests[def.id];
      subAny = true;
      const row = el("div", "tw-quest" + (st && st.state === "done" ? " done" : ""));
      const info = el("div", "tw-chipi");
      info.appendChild(el("div", "tw-chipn", `🕯 「${def.name}」`));
      info.appendChild(el("div", "tw-chipc", `― ${def.npc.name} (${def.npc.title})`));
      info.appendChild(el("div", "tw-chipc", def.text));
      const rw = [`💰${def.reward.gold}`, `✦${def.reward.soulPts}`];
      if (def.reward.redSoul) rw.push(`🔴${def.reward.redSoul}`);
      info.appendChild(el("div", "tw-chipc", "報酬: " + rw.join(" + ") +
        (st ? ` ・ 進捗 ${Math.min(st.progress, def.goal)}/${def.goal}` : "")));
      row.appendChild(info);
      if (!st) {
        const b = btn("受ける", () => {
          G.subQuests[def.id] = { ...def, state: "active", progress: 0 };
          SFX.select();
          log(`${def.npc.name}の依頼「${def.name}」を受けた。`, "sys");
          renderTown();
        });
        b.className = "tw-small";
        row.appendChild(b);
      } else if (st.state === "active") {
        row.appendChild(el("div", "tw-chiphp", "進行中"));
      } else if (st.state === "done") {
        const b = btn("報告する", () => claimQuest(st));
        b.className = "tw-small primary";
        row.appendChild(b);
      }
      sql.appendChild(row);
    }
  }
  if (!subAny) sql.appendChild(el("div", "tw-empty", "依頼は、すべて果たされた。"));
  townEl.appendChild(sql);
}

function claimQuest(q) {
  q.state = "claimed";
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
  const push = (id, name, desc, cond, gold, redSoul, series) => {
    const reward = {};
    if (gold) reward.gold = gold;
    if (redSoul) reward.redSoul = redSoul;
    ACHIEVEMENTS.push({ id, name, desc, cond, reward, series: series || id });
  };
  // 段階表: rows = [しきい値, 称号, gold, redSoul][]
  // 同じ段階表の勲章は series で束ね、勲章の間では「次の段階」だけを1枠に表示する
  const tiers = (idOf, rows, descOf, condOf) =>
    rows.forEach(([v, name, gold, redSoul]) => push(idOf(v), name, descOf(v), () => condOf(v), gold, redSoul, idOf(rows[0][0])));
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

  // 一点物 (2)
  push("party6", "六人の隊列", "人業 6体 で編成する", () => G.party.length >= 6, 200);
  push("dragon", "竜殺しの伝説", "竜の玄室の主を討つ", () => G.dragonSlain, 5000, 50);
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
function showStoryScene(title, lines, rewardText, onClose, btnLabel = "御意") {
  G.prompt = true;
  const wrap = el("div", "confirm-overlay");
  const card = el("div", "ig-card story-card");
  card.style.borderColor = "#c9a227";
  card.style.boxShadow = "0 0 50px #c9a22755";
  const bn = el("div", "ig-banner", "👑 " + title + " 👑");
  bn.style.color = "#ffd84a";
  card.appendChild(bn);
  for (const t of lines) card.appendChild(el("div", "story-line", t));
  if (rewardText) card.appendChild(el("div", "story-reward", rewardText));
  const ok = btn(btnLabel, () => { wrap.remove(); G.prompt = false; if (onClose) onClose(); });
  ok.className = "btn primary ig-ok";
  card.appendChild(ok);
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

// 機能解放: ダンジョン踏破数に応じて段階的に解放される (序盤の節目で授かる)。
//   D5 踏破 → 魂融合 / D10 → サブ魂1枠 / D15 → 酒場の噂 / D20 → サブ魂2枠目
function featureUnlocked(key) {
  const c = clearedDungeonCount();
  if (key === "fusion") return c >= 5;
  if (key === "rumor") return c >= 15;
  return false;
}
// 解放済みのサブ魂 (宿し技) スロット数 (0/1/2)。MAX_SUBS が上限
function unlockedSubSlots() {
  const c = clearedDungeonCount();
  return Math.min(MAX_SUBS, c >= 20 ? 2 : c >= 10 ? 1 : 0);
}

// 踏破済みの迷宮数 (メインストーリー基準: 第n章攻略中 = n-1 踏破)
function clearedDungeonCount() {
  const ms = G.msq;
  if (!ms) return Math.max(0, (G.unlockedDungeons || 1) - 1);
  if (ms.state === "active") return Math.max(0, ms.n - 1); // 第0章 (チュートリアル) 中は 0
  return Math.min(DUNGEONS.length, ms.n); // report/offer/end は第n章を踏破済み
}

// 王宮に用があるか (踏破の報告 or 次章の拝命 / 第0章の謁見・報告)
function palaceCallReady() {
  const ms = G.msq;
  if (!ms) return false;
  if (ms.n === 0 && ms.state === "active") return !ms.granted || allDolls().filter((d) => !d.isEmpty).length >= 1;
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
  const row = el("div", "tw-grid");
  const dunBtn = el("div", "tw-fac");
  dunBtn.appendChild(el("div", "tw-faci", "🐉"));
  dunBtn.appendChild(el("div", "tw-facn", "モンスター図鑑"));
  dunBtn.appendChild(el("div", "tw-facd", `発見 ${Object.keys(G.codex.mon).filter((k) => MONSTERS[k]).length} 種`));
  dunBtn.addEventListener("click", () => { G.town.facility = "codexDungeon"; renderCodexDungeon(); });
  row.appendChild(dunBtn);
  const itemBtn = el("div", "tw-fac");
  itemBtn.appendChild(el("div", "tw-faci", "⚔"));
  itemBtn.appendChild(el("div", "tw-facn", "アイテム図鑑"));
  itemBtn.appendChild(el("div", "tw-facd", `発見 ${Object.keys(G.codex.item).length} 種`));
  itemBtn.addEventListener("click", () => { G.town.facility = "codexItem"; renderCodexItem(); });
  row.appendChild(itemBtn);
  const jobBtn = el("div", "tw-fac");
  jobBtn.appendChild(el("div", "tw-faci", "📜"));
  jobBtn.appendChild(el("div", "tw-facn", "職業図鑑"));
  jobBtn.appendChild(el("div", "tw-facd", `発現 ${Object.keys(G.codex.job).filter((k) => SOUL_CLASSES[k]).length} 種`));
  jobBtn.addEventListener("click", () => { G.town.facility = "codexJob"; renderCodexJob(); });
  row.appendChild(jobBtn);
  const claimable = ACHIEVEMENTS.filter((a) => !G.ach[a.id] && a.cond()).length;
  const achBtn = el("div", "tw-fac");
  achBtn.appendChild(el("div", "tw-faci", "🏅"));
  achBtn.appendChild(el("div", "tw-facn", "勲章の間"));
  achBtn.appendChild(el("div", "tw-facd", `受領 ${Object.keys(G.ach).length} / ${ACHIEVEMENTS.length}`));
  if (claimable) achBtn.appendChild(el("div", "tw-facb", `❗ 受領可 ${claimable}`));
  achBtn.addEventListener("click", () => { G.town.facility = "codexAch"; renderCodexAch(); });
  row.appendChild(achBtn);
  townEl.appendChild(row);

  // 宝物庫 (蒐集品の奉納)
  townEl.appendChild(el("div", "tw-h", "王宮宝物庫 — 蒐集品の奉納"));
  const ts = treasuryState();
  const kinds = Object.keys(ts.donated).filter((id) => ITEMS[id] && ITEMS[id].slot === "misc").length;
  const treBtn = el("div", "tw-fac");
  treBtn.appendChild(el("div", "tw-faci", "🏛"));
  treBtn.appendChild(el("div", "tw-facn", "宝物庫"));
  treBtn.appendChild(el("div", "tw-facd", `奉納 ${kinds} / 100 種 — 蒐集品を納め褒賞を得る`));
  if (treasuryRewardReady()) treBtn.appendChild(el("div", "tw-facb", "🎁 受領できる褒賞あり"));
  treBtn.addEventListener("click", () => { SFX.select(); G.town.facility = "treasury"; renderTown(); });
  townEl.appendChild(treBtn);

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
  townEl.appendChild(rec);
}

// ==== 王宮の宝物庫 (蒐集品の奉納) ====
// 蒐集品 (slot:"misc") を奉納すると、ランク帯ごとではなく「奉納した総種類数」の節目で褒賞が下賜される。
// 各しきい値に到達するごとに一度だけ褒賞を受領できる (装備、節目によっては魂も)。
// soul: 0=装備のみ / 1=魂(通常抽選)+装備 / 2=魂(偉大な抽選)+装備
const TREASURY_MILESTONES = [
  { n: 5, soul: 0 }, { n: 10, soul: 1 }, { n: 20, soul: 1 }, { n: 30, soul: 1 },
  { n: 40, soul: 2 }, { n: 50, soul: 1 }, { n: 60, soul: 2 }, { n: 70, soul: 1 },
  { n: 80, soul: 2 }, { n: 90, soul: 2 }, { n: 100, soul: 2 },
];

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
  if (m.soul) {
    const clsKey = m.soul >= 2 ? rollGreatJobClass() : rollJobClass();
    acquireSoul(clsKey, `蒐集品を ${n} 種 宝物庫に納めた褒賞だ。`,
      () => grantTreasuryItem(center, back));
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
      card.appendChild(el("div", "tw-facn", itemName(h.item)));
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
    const label = m.soul ? (m.soul >= 2 ? "魂(偉大)+装備" : "魂+装備") : "装備";
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
      if (got) { slot.appendChild(spriteCanvas(ITEMS[id], 3)); slot.title = ITEMS[id].name; }
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
  const ap = partyPassiveLv("appraise") ? 1.15 : 1; // 目利き: ドロップ率+15%
  // 特別階 (盗賊の洞察) / 迷宮の異変 (飢えた狩場): レアドロップ率が上がる (高い方を採用)
  if (Math.random() < Math.max(sfNum("rareDropRate", 0.04 * ap), mutNum("rareDropRate", 0))) {
    const id = pickItemByR(dropCenterR({ rare: true }));
    if (ITEMS[id]) { const it = cloneItem(id); if (it) return { key: "loot", name: "戦利品", id, item: it, rare: true }; }
  }
  if (Math.random() < 0.30 * ap) {
    const id = pickItemByR(dropCenterR());
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
  const lv = Math.min(rank * 10, level || 1);
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
    if (it.rank || it.lr) r.style.borderColor = itemRankColor(it);
    const ic = el("span", "tw-chips"); ic.appendChild(spriteCanvas(it, 2)); r.appendChild(ic);
    const info = el("div", "tw-chipi");
    info.appendChild(el("div", "tw-chipn", it.name));
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
  const ban = el("div", "ig-banner", it.lr ? `LR${it.lr} 専用装備` : (it.rank ? `${ITEM_RANK_NAME[it.rank]}級アイテム` : "アイテム"));
  if (rc) ban.style.color = rc;
  card.appendChild(ban);
  const art = el("div", "ig-art"); art.appendChild(spriteCanvas(it, 11)); card.appendChild(art);
  card.appendChild(el("div", "ig-name", it.name));
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

  // 職業スキル表: このランクで覚える技 (Lv ランク×10 まで) だけを載せ、
  // 実際に到達したLvの技だけ開示する
  const reached = (rec && typeof rec === "object" && rec.lv) || 0;
  const sbox = el("div", "cdx-drops");
  for (const e of jobSkillTable(key)) {
    if (e.lvl > rank * 10) continue;
    const sp = SPELLS[e.skill];
    const r = el("div", "cdx-drow");
    r.appendChild(el("span", "cdx-sklv", `Lv${e.lvl}`));
    if (reached >= e.lvl && sp) {
      r.appendChild(el("span", "cdx-dn", sp.name));
      r.appendChild(el("span", "cdx-skd", `${sp.desc} (MP${sp.mp})`));
      r.classList.add("cdx-sktap");
      r.addEventListener("click", () => showSkillPopup(e.skill));
    } else {
      r.appendChild(el("span", "cdx-dn dim", "？？？"));
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
    const price = it.price || 30;
    // 選択中キャラが装備できる品は色を変えて目立たせる
    const canEq = isEquippable(it) && who && who.alive && canEquip(who, it);
    const r = el("div", "tw-shoprow" + (canEq ? " equip-ok" : ""));
    if (it.rank || it.lr) r.style.borderColor = itemRankColor(it);
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
        if (it.unidentified) { cellEl.classList.add("shop-unid"); cellEl.appendChild(el("span", "shop-price", `🔍${sellPrice(it)}`)); }
        else cellEl.appendChild(el("span", "shop-price", `💰${sellPrice(it)}`));
        cellEl.title = itemName(it);
        cellEl.addEventListener("click", () => it.unidentified ? showAppraisePrompt(who, it) : showSellPrompt(who, it));
      }
      bag.appendChild(cellEl);
    }
    dock.appendChild(bag);
    // 一括鑑定 (左) ・ 一括売却 (右) を横並びで配置
    const unid = who.items.filter((it) => it.unidentified);
    const sellable = who.items.filter((it) => !it.cursed && !it.unidentified);
    if (unid.length > 0 || sellable.length > 0) {
      const actions = el("div", "shop-actions");
      actions.style.display = "flex";
      actions.style.gap = "8px";
      if (unid.length > 0) {
        const idTotal = unid.reduce((s, it) => s + sellPrice(it), 0);
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
        if (G.gold < sellPrice(unid[0])) idBtn.disabled = true; // 1点も鑑定できないなら無効
        actions.appendChild(idBtn);
      }
      if (sellable.length > 0) {
        const total = sellable.reduce((s, it) => s + sellPrice(it), 0);
        const bulkBtn = btn(`一括売却 (${sellable.length}点 / 💰${total})`, () => {
          showConfirm({
            title: "持ち物をまとめて売却しますか？",
            lines: [`${who.name}の売却可能な ${sellable.length}点 をすべて売ります。`,
              `合計 💰${total} を獲得します。`],
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
  const ban = el("div", "ig-banner", it.lr ? `LR${it.lr} 専用装備` : (it.rank ? `${ITEM_RANK_NAME[it.rank]}級アイテム` : "アイテム"));
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
  const cost = sellPrice(it); // 鑑定料 = 売却金額と同じ
  const wrap = el("div", "confirm-overlay");
  const card = el("div", "ig-card");
  card.style.borderColor = "#7fd0ff";
  card.style.boxShadow = "0 0 40px #7fd0ff55";
  card.appendChild(el("div", "ig-banner", "🔍 未鑑定の品"));
  const art = el("div", "ig-art"); art.appendChild(spriteCanvas(it, 9)); card.appendChild(art);
  card.appendChild(el("div", "ig-name", itemName(it)));
  for (const line of detailLines(it)) card.appendChild(el("div", "ig-stat", line));
  card.appendChild(el("div", "ig-who", `鑑定料 💰${cost}・正体不明のまま売っても 💰${cost}`));
  const list = el("div", "ig-choices");
  const idb = btn(`💰${cost} で鑑定する`, () => { wrap.remove(); shopIdentify(owner, it); });
  idb.classList.add("primary");
  if (G.gold < cost) idb.disabled = true;
  list.appendChild(idb);
  list.appendChild(makeDanger(`💰${cost} で売る (正体不明のまま)`, () => { wrap.remove(); sellItem(owner, it, sellPrice(it)); }));
  list.appendChild(btn("やめる", () => wrap.remove()));
  card.appendChild(list);
  wrap.appendChild(card);
  wrap.addEventListener("click", (e) => { if (e.target === wrap) wrap.remove(); });
  document.body.appendChild(wrap);
}

// 商店で鑑定する: 鑑定料を払い、必ず正体を明かす
function shopIdentify(owner, it) {
  const cost = sellPrice(it);
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
  const unid = owner.items.filter((it) => it.unidentified).sort((a, b) => sellPrice(a) - sellPrice(b));
  let n = 0, spent = 0;
  for (const it of unid) {
    const cost = sellPrice(it);
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

// 商店: アイテム情報を表示し、売却するか選ぶ (宝箱演出と同じカード)
function showSellPrompt(owner, it) {
  const price = sellPrice(it);
  const wrap = el("div", "confirm-overlay");
  const card = el("div", "ig-card");
  card.style.borderColor = "#c9a227";
  card.style.boxShadow = "0 0 40px #c9a22755";
  card.appendChild(el("div", "ig-banner", "🛒 売却の確認"));
  const art = el("div", "ig-art"); art.appendChild(spriteCanvas(it, 9)); card.appendChild(art);
  card.appendChild(el("div", "ig-name", itemName(it) + (it.cursed ? " 🔒" : "")));
  // 性能・説明
  for (const line of detailLines(it)) card.appendChild(el("div", "ig-stat", line));
  if (it.desc) card.appendChild(el("div", "ig-desc", it.desc));
  card.appendChild(el("div", "ig-who", `売値 💰${price} (在庫に並びます)`));
  const list = el("div", "ig-choices");
  const sell = btn(`💰${price} で売る`, () => { wrap.remove(); sellItem(owner, it, price); });
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
  owner.items.splice(idx, 1);
  G.gold += price;
  // 在庫に積む (ボルタック方式)
  if (it.id) G.shopStock[it.id] = (G.shopStock[it.id] || 0) + 1;
  codexSeeItem(it.id);
  SFX.select(); buzz(10);
  const shown = itemName(it);
  log(`${shown} を売った (+💰${price})。商店に並んだ。`, "win");
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
  if (!G.party.some((p) => p.alive)) { log("動ける人業がいない。", "sys"); return; }
  // チュートリアル後、初めて迷宮へ潜る際は警備兵が注意事項を説明する (1回のみ)
  if (!G.dungeonBriefed) {
    G.dungeonBriefed = true;
    autosave(true);
    showDungeonBriefing(() => tryEnterDungeon());
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
  G.state = "board";
  playBgm(fieldBgm());
  if (descendBtn) { descendBtn.classList.add("hidden"); descendBtn.disabled = true; }
  newFloor();
  const mu = mutDef();
  if (mu) log(`${mu.sym} 異変「${mu.name}」の中を行く。${mu.gain}。`, "win");
  renderBoard();
}

// 街へ無事帰還 (戦利品は保持)。keepRun=true で run を確定 (戦利品維持)
function returnToTown() {
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
}

function confirmReturnToTown() {
  if (G.state !== "board" || G.anim || G.walking || G.prompt || G.statusOpen || G.settingsOpen) return;
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
    lines: ["この陣の上からなら、いつでも街へ帰還できる。"] });
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
  idn.appendChild(el("div", "st-sub", (p.isDoll ? `人業 ・ ${p.cls} Lv${p.jobLv || 1}` : `${p.align} - ${p.race} - ${p.cls} Lv${p.level}`)
    + ` ・ ${G.statusIdx < 3 ? "前衛" : "後衛"} ・ 射程:${RANGE_LABEL[weaponRange(p.equip && p.equip.weapon)]}`));
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

  // 1. ステータスバー (HP/MP/状態/属性/呪文)
  const bar = el("div", "st-statbar");
  const ail = p.ailment === "poison" ? "毒" : (p.alive ? "正常" : "戦闘不能");
  const ailCls = (p.ailment || !p.alive) ? "st-bad" : "";
  const spellLine = p.spells && p.spells.length
    ? `<span class="st-bar-spells">呪文: ${p.spells.map((k) => SPELLS[k] ? SPELLS[k].name : k).join("・")}</span>`
    : "";
  bar.innerHTML = `<span>HP <b>${p.hp}/${p.maxhp}</b></span><span>MP <b>${p.mp}/${p.maxmp}</b></span><span class="${ailCls}">状態: <b>${ail}</b></span><span>属性攻 ${elemStatChip(p.elemAtk)}</span><span>属性防 ${elemStatChip(p.elemDef)}</span>${spellLine}`;
  statusEl.appendChild(bar);

  // 死亡中の帰還タイマー
  if (p.isDoll && !p.alive) {
    if (!p.reviveAt) setReviveTimers();
    const box = el("div", "st-revive");
    const remain = Math.max(0, (p.reviveAt || Date.now()) - Date.now());
    box.appendChild(el("div", "st-revt", `⏳ 帰還まで ${fmtRemain(remain)}`));
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
    row.appendChild(el("span", "st-ename", it ? itemName(it) + (it.cursed ? " 🔒" : "") : SLOT_LABEL[slot]));
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
      b.className = "tw-small";
      if (p.mp < cost) b.disabled = true;
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
  row.appendChild(el("span", "st-iname" + (it.unidentified ? " st-unid" : ""), itemName(it) + (it.unidentified ? " 🔍" : (it.cursed ? " 🔒" : ""))));
  row.addEventListener("click", () => { SFX.select(); showItemDetailPopup(p, { item: it, from: "bag", index: sel.index }); });
  return row;
}

// 戦闘外で回復系呪文を唱える。対象の味方を選び、HP回復/蘇生/状態異常治療を行う。
// バフは戦闘外では持続しないため適用しない (回復・治療部分のみ効果がある)。
function campCast(caster, spellKey) {
  const sp = SPELLS[spellKey];
  const cost = spellCost(caster, sp);
  if (caster.mp < cost) { log("MPが足りない。", "sys"); return; }
  const cures = sp.kind === "cure" || !!sp.cure;     // 毒・麻痺・石化を治す
  const heals = (sp.power || 0) > 0;                  // HP回復量を持つ
  const powerOf = () => (sp.power || 0) + Math.round((caster.pie || 0) * 0.5);

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

  // 全体呪文は対象選択なしで全員へ (効果がなければMPは消費しない)
  if (sp.target === "all-ally") {
    let any = false;
    for (const t of G.party) if (applyTo(t)) any = true;
    if (any) finish(); else log("効果のある対象がいない。", "sys");
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
  if (!targets.length) { log("効果のある対象がいない。", "sys"); return; }
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
      if (applyTo(t)) finish(); else log("効果のある対象ではなかった。", "sys");
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
    ? "（サブ魂なし — 館の祭壇で別の魂の技を1つ借り、ステの30%を得られる）"
    : "（宿し技スロットは未解放 — 迷宮を踏破すると開く）"));
  for (const sub of subs) {
    const se = sub ? soulByUid(sub.uid) : null;
    if (!se) continue;
    const cls = SOUL_CLASSES[se.clsKey]; if (!cls) continue;
    const rank = soulRankOf(se);
    const skName = sub.skill && SPELLS[sub.skill] ? SPELLS[sub.skill].name : "技未設定";
    const row = el("div", "st-soulrow2");
    const orb = el("span", "tw-chips"); orb.style.color = cls.glow; orb.appendChild(spriteCanvas(jobSprite(se.clsKey, Math.max(1, rank)), 2));
    row.appendChild(orb);
    const info = el("div", "st-soulinfo");
    const nm = el("div", "st-souln2", `${jobRankName(se.clsKey, rank)}　Lv${se.level}`); nm.style.color = cls.glow;
    info.appendChild(nm);
    info.appendChild(el("div", "st-soulstat", `技: ${skName}　ステ+30%`));
    row.appendChild(info);
    wrap.appendChild(row);
  }
  return wrap;
}

// 魂のステータス寄与を「HP+7 ATK+2.4 …」形式で列挙 (0は省略)
function soulStatText(st, sep = " ") {
  const keys = ["hp", "mp", "atk", "vit", "agi", "int", "pie", "luk"];
  const lbl = { hp: "HP", mp: "MP", atk: "ATK", vit: "VIT", agi: "AGI", int: "INT", pie: "PIE", luk: "LUK" };
  return keys.filter((k) => st[k]).map((k) => `${lbl[k]}+${st[k]}`).join(sep);
}

// ===== 属性攻撃/属性防御の表示ヘルパ =====
// 各属性の [強い相手, 弱い相手] (表示用)。光↔闇は相互有利で弱点なし
const ELEM_ADV = {
  fire: ["wind", "water"], wind: ["earth", "fire"], earth: ["water", "wind"], water: ["fire", "earth"],
  light: ["dark", null], dark: ["light", null],
};
function elemName(el) { return (ELEMENTS[el] || ELEMENTS.none).label; }
// "火属性攻撃 +1" のような短い表記 (Lv1=+1, Lv2(◎)=+2)。e = {el, lv}
function elemStatText(kind, e) {
  if (!e || !e.el) return null;
  return `${elemName(e.el)}属性${kind}+${Math.min(2, e.lv)}`;
}
// 相性のくわしい説明行 (複数行)。
// 防御: 「水属性防御 +1」「火属性から受けるダメージ -50%」(不利属性のダメージ増加は表示・適用しない)
// 攻撃: 「水属性攻撃 +1」「火属性に与えるダメージ +50%」「土属性に与えるダメージ -50%」
function elemDetailLines(kind, e) {
  if (!e || !e.el || !ELEM_ADV[e.el]) return [];
  const [adv, weak] = ELEM_ADV[e.el];
  const pct = e.lv >= 2 ? 100 : 50;
  const lines = [`${elemName(e.el)}属性${kind}　+${Math.min(2, e.lv)}`];
  if (kind === "攻撃") {
    lines.push(`${elemName(adv)}属性に与えるダメージ　+${pct}%`);
    if (weak) lines.push(`${elemName(weak)}属性に与えるダメージ　-${pct}%`);
  } else {
    lines.push(`${elemName(adv)}属性から受けるダメージ　-${pct}%`);
    // 不利属性からのダメージ増加は適用しない (軽減のみ)
  }
  return lines;
}
// ステータス画面用の色付きチップ ("火◯" / "—")
function elemStatChip(e) {
  if (!e || !e.el) return "<b>—</b>";
  const d = ELEMENTS[e.el] || ELEMENTS.none;
  return `<b style="color:${d.color}">${d.label}${e.lv >= 2 ? "◎" : "◯"}</b>`;
}

// ===== スキル詳細ポップアップ =====
const SPELL_KIND_LABEL = { atk: "攻撃呪文", heal: "回復呪文", phys: "物理技", buff: "支援", debuff: "弱体", sleep: "状態異常", cure: "治療" };
const SPELL_TARGET_LABEL = { enemy: "敵単体", "all-enemy": "敵全体", ally: "味方単体", "all-ally": "味方全体", self: "自分" };
const SPELL_KIND_COLOR = { atk: "#e0743f", heal: "#46c08f", phys: "#d8b04a", buff: "#5fa8e0", debuff: "#a06fd6", sleep: "#a06fd6", cure: "#46c08f" };

// スキルの効果をくわしい行に展開する
function skillDetailLines(sp) {
  const lines = [];
  lines.push(`種別: ${SPELL_KIND_LABEL[sp.kind] || sp.kind}　対象: ${SPELL_TARGET_LABEL[sp.target] || sp.target}`);
  if (sp.element && sp.element !== "none" && ELEMENTS[sp.element]) lines.push(`属性: ${ELEMENTS[sp.element].label}`);
  if (sp.kind === "atk") lines.push(`威力 ${sp.power}（術者のINTで伸びる）`);
  if (sp.kind === "heal" && sp.power) lines.push(`回復量 ${sp.power}（術者のPIEで伸びる）`);
  if (sp.revive) lines.push(sp.revivePct ? `戦闘不能をHP${Math.round(sp.revivePct * 100)}%で蘇生する` : "戦闘不能も蘇生できる");
  if (sp.kind === "phys") {
    lines.push(`威力 攻撃力の${sp.power}倍${sp.hits ? ` × ${sp.hits}回` : ""}`);
    if (sp.critBonus) lines.push(`会心率 +${Math.round(sp.critBonus * 100)}%`);
  }
  if (sp.kind === "atk" && sp.critBonus) lines.push(`呪文会心率 +${Math.round(sp.critBonus * 100)}%（会心は×1.5）`);
  const fx = (obj) => Object.entries(obj).map(([k, v]) => `${ATTR_LABEL[k] || k.toUpperCase()} ×${v}`).join("・");
  if (sp.buff) lines.push(`強化: ${fx(sp.buff)}`);
  if (sp.debuff) lines.push(`弱体: ${fx(sp.debuff)}`);
  // ---- 混成職ユニークスキルの固有効果 ----
  if (sp.hpCost) lines.push(`代償: 自分の最大HPの${Math.round(sp.hpCost * 100)}%を失う（HP1で踏みとどまる）`);
  if (sp.drain) lines.push(`与えたダメージの${Math.round(sp.drain * 100)}%だけ自分のHPを回復`);
  if (sp.mpDrain) lines.push(`与えたダメージの${Math.round(sp.mpDrain * 100)}%だけ自分のMPを回復`);
  if (sp.sleepChance) lines.push(`命中後 ${Math.round(sp.sleepChance * 100)}%で対象を眠らせる`);
  if (sp.flinchChance) lines.push(`命中後 ${Math.round(sp.flinchChance * 100)}%で対象を怯ませる（主には効かない）`);
  if (sp.ailment) lines.push(`${Math.round(sp.ailment.chance * 100)}%で対象を${sp.ailment.type === "poison" ? "毒" : "異常"}に侵す`);
  if (sp.plunder) lines.push("この技で倒した敵は、落とすゴールドが2倍になる");
  if (sp.partyHeal) lines.push(`攻撃の後、味方全体のHPを ${sp.partyHeal} 回復（術者のPIEで伸びる）`);
  if (sp.cure) lines.push("同時に状態異常も治す");
  if (sp.grantEndure) lines.push("対象に「致死ダメージをHP1で耐える」を付与（1戦闘1回）");
  if (sp.grantBarrier) lines.push(`味方全体に魔障壁${sp.grantBarrier}回分（ブレス・呪文の被ダメ半減）を付与`);
  if (sp.debuffAll) lines.push(`さらに敵全体を弱体: ${fx(sp.debuffAll)}`);
  // 強化/弱体の持続ターン数 (同方向は最大2段階まで重ねられる)
  if (sp.dur && (sp.buff || sp.debuff || sp.debuffAll)) lines.push(`効果は ${sp.dur} ターン持続（同じ能力は最大2段階）`);
  return lines;
}

// スキル名タップで開く詳細カード
function showSkillPopup(key) {
  const sp = SPELLS[key];
  if (!sp) return;
  const accent = SPELL_KIND_COLOR[sp.kind] || "#c9a227";
  const wrap = el("div", "confirm-overlay");
  const card = el("div", "ig-card confirm-card");
  card.style.borderColor = accent;
  const banner = el("div", "ig-banner", "✦ スキル ✦");
  banner.style.color = accent;
  card.appendChild(banner);
  card.appendChild(el("div", "ig-name", sp.name));
  card.appendChild(el("div", "sk-mp", `消費MP ${sp.mp}`));
  card.appendChild(el("div", "ig-desc", sp.desc));
  const box = el("div", "sk-lines");
  for (const ln of skillDetailLines(sp)) box.appendChild(el("div", "sk-line", ln));
  card.appendChild(box);
  const ok = btn("閉じる", () => wrap.remove());
  ok.className = "btn primary ig-ok";
  card.appendChild(ok);
  wrap.appendChild(card);
  wrap.addEventListener("click", (e) => { if (e.target === wrap) wrap.remove(); });
  document.body.appendChild(wrap);
}

// 習得スキルのタップ可能なチップ列
function skillChips(keys, label) {
  const row = el("div", "sk-chips");
  if (label) row.appendChild(el("span", "sk-chipl", label));
  for (const k of keys) {
    const sp = SPELLS[k];
    const c = el("span", "sk-chip", sp ? sp.name : k);
    if (sp) c.addEventListener("click", () => showSkillPopup(k));
    row.appendChild(c);
  }
  return row;
}

function statLines(it) {
  if (it && it.unidentified) return "未鑑定 — 鑑定が必要";
  const parts = [];
  const f = (label, v) => { if (v) parts.push(`${label} ${v > 0 ? "+" : ""}${v}`); };
  f("ATK", it.atk); f("VIT", it.vit); f("AGI", it.agi);
  f("INT", it.int); f("PIE", it.pie); f("LUK", it.luk);
  f("HP", it.hp); f("MP", it.mp);
  if (it.crit) parts.push(`会心 +${Math.round(it.crit * 100)}%`);
  const ea = elemStatText("攻撃", it.eAtk);
  const ed = elemStatText("防御", it.eDef);
  if (ea) parts.push(ea);
  if (ed) parts.push(ed);
  if (it.use && it.use.heal) parts.push(`HP +${it.use.heal}`);
  if (it.use && it.use.mp) parts.push(`MP +${it.use.mp}`);
  if (it.use && it.use.cure) parts.push(`毒を治す`);
  return parts.join("　");
}

// 装備品か (装備可能職業を表示する対象か)。use/misc/mat は対象外。
const EQUIPPABLE_SLOTS = new Set(["weapon", "shield", "body", "head", "hands", "feet", "acc"]);
function isEquippable(it) { return EQUIPPABLE_SLOTS.has(it.slot); }

// 候補 cand を p に装備した場合の最終ステータス増減 {atk,def,spd,hp,mp} を返す。
// items.js の recalc を仮の装備マップに流用するので、両手武器⇄盾の付け替え分も反映される。
function equipPreviewDelta(p, cand) {
  const key = slotKeyFor(cand, p);
  if (!key) return null;
  const eq = { ...p.equip };
  // equip() と同じ付け替え規則: 両手武器は盾を、盾は両手武器を外す
  if (cand.slot === "weapon" && cand.twoHanded) eq.shield = null;
  if (cand.slot === "shield" && eq.weapon && eq.weapon.twoHanded) eq.weapon = null;
  eq[key] = cand;
  const fake = { base: p.base, equip: eq, hp: p.hp, mp: p.mp };
  recalc(fake);
  return {
    atk: fake.atk - p.atk,
    vit: fake.vit - p.vit,
    agi: fake.agi - p.agi,
    int: fake.int - p.int,
    pie: fake.pie - p.pie,
    luk: fake.luk - p.luk,
    hp: fake.maxhp - p.maxhp,
    mp: fake.maxmp - p.maxmp,
  };
}

// 装備候補の「装備中と比べた増減」行 (増・緑/減・赤)。何かを付け替えるときだけ呼ぶ。
function equipCompareEl(p, cand) {
  const d = equipPreviewDelta(p, cand);
  const row = el("span", "eq-cd");
  row.appendChild(el("span", "eq-cd-lab", "装備すると"));
  let any = false;
  if (d) for (const [label, k] of [["ATK", "atk"], ["VIT", "vit"], ["AGI", "agi"], ["INT", "int"], ["PIE", "pie"], ["LUK", "luk"], ["HP", "hp"], ["MP", "mp"]]) {
    const v = d[k];
    if (!v) continue;
    any = true;
    row.appendChild(el("span", "eq-cd-seg " + (v > 0 ? "up" : "down"), `${label} ${v > 0 ? "▲+" + v : "▼" + v}`));
  }
  if (!any) row.appendChild(el("span", "eq-cd-same", "変化なし"));
  return row;
}

// 部位カテゴリ表記
const CAT_LABEL = { weapon: "武器", shield: "盾", body: "防具", head: "頭防具", hands: "小手", feet: "足防具", acc: "装飾品", use: "消耗品", misc: "蒐集品", mat: "貴重品" };
// アイテムの分類表記 (武器はサブカテゴリつき: 「武器（長剣）」)
function itemCatText(it) {
  if (it.slot === "weapon" && it.cat) return `武器（${WEAPON_CAT_LABEL[it.cat] || "その他"}）`;
  return CAT_LABEL[it.slot] || "";
}

// ウィザードリィ風の情報テキスト行
function detailLines(it) {
  if (it && it.unidentified) {
    return ["？ 未鑑定の品", "鑑定するまで正体も性能もわからない。", "商店 (有料) か、鑑定の心得がある仲間が必要だ。"];
  }
  const L = [];
  L.push(itemCatText(it));
  if (it.slot === "use") {
    if (it.use && it.use.heal) L.push(`HPを ${it.use.heal} 回復`);
    if (it.use && it.use.mp) L.push(`MPを ${it.use.mp} 回復`);
    if (it.use && it.use.cure) L.push("毒を治す");
  } else if (it.slot === "misc") {
    L.push("商店で売って金にする戦利品");
  } else if (it.slot === "mat") {
    L.push("用途は街で見つかるかもしれない");
  } else {
    // 射程は隊列システムで実際に使われるので表示する。旧 Wizardry 風の
    // 命中/ダイス/攻撃回数 は戦闘で使われないため表示しない
    if (it.slot === "weapon") L.push(`射程: ${RANGE_LABEL[weaponRange(it)]}`);
    // 六大ステ (ATK/VIT/AGI/INT/PIE/LUK) への補正
    const mod = [];
    const f = (label, v) => { if (v) mod.push(`${label}${v >= 0 ? "+" : ""}${v}`); };
    f("ATK", it.atk); f("VIT", it.vit); f("AGI", it.agi);
    f("INT", it.int); f("PIE", it.pie); f("LUK", it.luk);
    f("HP", it.hp); f("MP", it.mp);
    if (it.crit) mod.push(`会心+${Math.round(it.crit * 100)}%`);
    if (mod.length) L.push(mod.join(" / "));
  }
  // 属性攻撃/属性防御 (1行ずつのくわしい表記)
  for (const ln of elemDetailLines("攻撃", it.eAtk)) L.push(ln);
  for (const ln of elemDetailLines("防御", it.eDef)) L.push(ln);
  if (isEquippable(it)) L.push(equipClassText(it));
  if (it.align) L.push(`${it.align}属性。`);
  return L;
}

// 所持アイテムの詳細をポップアップ表示 (旧: 画面下のインライン情報パネル)
function showItemDetailPopup(p, sel) {
  if (!sel || !sel.item) return;
  const it = sel.item;
  const wrap = el("div", "confirm-overlay");
  const card = el("div", "ig-card cdx-detail");
  const rc = itemRankColor(it);
  if (rc) { card.style.borderColor = rc; card.style.boxShadow = `0 0 40px ${rc}66`; }
  const ban = el("div", "ig-banner", it.lr ? `LR${it.lr} 専用装備` : (it.rank ? `${ITEM_RANK_NAME[it.rank]}級アイテム` : "情報"));
  if (rc) ban.style.color = rc;
  card.appendChild(ban);
  const art = el("div", "ig-art"); art.appendChild(spriteCanvas(it, 11)); card.appendChild(art);
  card.appendChild(el("div", "ig-name", itemName(it) + (it.unidentified ? " 🔍" : (it.cursed ? " 🔒呪" : ""))));
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
    const ch = identifyChance(m.clsKey, m.jobLv || 1, it.lv || 1);
    const lbl = (IDENTIFY_JOBS[m.clsKey] || {}).label || "鑑定";
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
  const ch = identifyChance(m.clsKey, m.jobLv || 1, it.lv || 1);
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
  if (G.state === "status") renderStatus();
  renderParty();
  autosave(true);
}

function makeDanger(label, fn) { const b = btn(label, fn); b.classList.add("danger"); return b; }
function clsLabel(k) { return (SOUL_CLASSES[k] || {}).label || k; }

// 装備可能条件のバッジ表示 (36職対応)。装備制限は実際の対応職をそのまま表示する
// (未発見職を「？」で伏せる旧仕様は廃止。所持・装備画面で条件が読めないと不便なため)。
function equipClassText(it) {
  if (it.forJob) {
    const lbl = (SOUL_CLASSES[it.forJob] || {}).label || it.forJob;
    return `〈${lbl}〉専用`;
  }
  if (it.classes) {
    return "装備可: " + it.classes.map((k) => clsLabel(k)).join("・");
  }
  if (it.slot === "weapon") return `武器適性: ${WEAPON_CAT_LABEL[it.cat] || it.cat}`;
  if (it.slot === "shield") return "適性: 盾持ち職";
  const w = it.weight;
  if (w === "heavy") return "装備: 重装職";
  if (w === "cloth") return "装備: 布装職";
  if (w === "light") return "装備: 軽装以上";
  return "装備可: 全職";
}

// パーティメンバーの装備可否チップ (6人分 ○/×)
// 各メンバーの装備可否。頭文字だけだと同名頭文字を判別できないため、
// キャラアイコン + フルネーム + ○/× で示す。
function equipPartyChips(it) {
  const row = el("div", "eq-pchips");
  for (const m of G.party) {
    const ok = canEquip(m, it);
    const c = el("span", "eq-pchip " + (ok ? "ok" : "ng"));
    const ic = el("span", "eq-pchip-ic");
    ic.appendChild(spriteCanvas(m.isDoll ? dollSprite(m) : HERO, 2));
    c.appendChild(ic);
    c.appendChild(el("span", "eq-pchip-nm", m.name));
    c.appendChild(el("span", "eq-pchip-mk", ok ? "○" : "×"));
    row.appendChild(c);
  }
  return row;
}

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

// 確認ダイアログ (ステータス画面の上にも出せる軽量モーダル)
function showConfirm({ title, lines = [], okLabel = "実行する", onOk }) {
  const wrap = el("div", "confirm-overlay");
  const card = el("div", "ig-card confirm-card");
  card.style.borderColor = "#d4504e";
  card.style.boxShadow = "0 0 40px #d4504e55";
  const bn = el("div", "ig-banner", "⚠ 確認 ⚠");
  bn.style.color = "#d4504e";
  card.appendChild(bn);
  card.appendChild(el("div", "ig-name", title));
  for (const ln of lines) card.appendChild(el("div", "ig-desc", ln));
  const list = el("div", "ig-choices");
  const okBtn = btn(okLabel, () => { wrap.remove(); onOk(); });
  okBtn.classList.add("danger");
  list.appendChild(okBtn);
  list.appendChild(btn("やめる", () => wrap.remove()));
  card.appendChild(list);
  wrap.appendChild(card);
  wrap.addEventListener("click", (e) => { if (e.target === wrap) wrap.remove(); });
  document.body.appendChild(wrap);
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
  if (!who) { log(`${itemName(it)}を見つけたが、誰も持てない…`, "sys"); return null; }
  runGainItem(who, it);
  codexSeeItem(id);
  log(`${itemName(it)} を手に入れた！ (${who.name})`, "win");
  return { item: it, who };
}

// ---- アイテム入手演出 (イラスト込みの感動的な表示) ----
const itemGetEl = document.getElementById("item-get");

function showItemGet(item, who, onClose) {
  G.prompt = true; // 入力をブロック
  SFX.itemget();
  buzz([0, 30, 60, 30]);
  itemGetEl.onclick = null;
  itemGetEl.innerHTML = "";
  const card = el("div", "ig-card");
  const rc = itemRankColor(item);
  if (rc) { card.style.borderColor = rc; card.style.boxShadow = `0 0 40px ${rc}66`; }
  const unid = !!item.unidentified;
  const ban = el("div", "ig-banner", unid ? "✦ 未鑑定の品を発見！ ✦" : (item.lr ? `★ LR${item.lr} 専用装備発見！ ★` : (item.rank >= 11 ? `★ ${ITEM_RANK_NAME[item.rank]}級アイテム発見！ ★` : "✦ アイテム発見！ ✦")));
  if (rc && !unid) ban.style.color = rc;
  card.appendChild(ban);
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
  card.appendChild(el("div", "ig-name", itemName(item)));
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
// アイテム獲得演出と同じオーバーレイ/カードデザインで表示する
function showEvent({ sprite, title, lines = [], accent = "#c9a227", btnLabel = "つぎへ", banner = "✦ イベント ✦", sparkle = false, onClose }) {
  G.prompt = true;
  itemGetEl.onclick = null;
  itemGetEl.innerHTML = "";
  const card = el("div", "ig-card");
  card.style.borderColor = accent;
  card.style.boxShadow = `0 0 40px ${accent}55`;
  const bn = el("div", "ig-banner", banner);
  bn.style.color = accent;
  card.appendChild(bn);
  if (sprite) {
    const art = el("div", "ig-art");
    art.appendChild(spriteCanvas(sprite, 9));
    if (sparkle) {
      for (let i = 0; i < 6; i++) {
        const s = el("span", "ig-spark");
        s.style.setProperty("--a", (i * 60) + "deg");
        s.style.animationDelay = (i * 0.08) + "s";
        art.appendChild(s);
      }
    }
    card.appendChild(art);
  }
  const t = el("div", "ig-name", title);
  t.style.color = accent === "#c9a227" ? "#fff" : accent;
  card.appendChild(t);
  for (const ln of lines) card.appendChild(el("div", "ig-desc", ln));
  const ok = btn(btnLabel, () => closeItemGet(onClose));
  ok.className = "btn primary ig-ok";
  ok.style.borderColor = accent;
  ok.style.color = accent;
  card.appendChild(ok);
  itemGetEl.appendChild(card);
  itemGetEl.classList.remove("hidden");
}

// 毒のダメージ (盤面を1歩進むごと)
function tickPoison() {
  let any = false;
  for (const p of G.party) {
    if (!p.alive || p.ailment !== "poison") continue;
    any = true;
    p.hp = Math.max(0, p.hp - 1);
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
  const sx = (e.clientX - rect.left) * (view.width / rect.width);
  const sy = (e.clientY - rect.top) * (view.height / rect.height);
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
  if (G.state !== "board" || G.anim || G.walking || G.prompt || G.statusOpen || G.settingsOpen) return;
  const cx = Math.floor((sx - OX) / (CARD_W + GAP));
  const cy = Math.floor((sy - OY) / (CARD_H + GAP));
  if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) return;
  // セル内 (隙間クリックは無視)
  const r = cellRect(cx, cy);
  if (sx > r.x + r.w || sy > r.y + r.h) return;
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
  if (G.state !== "board" || G.prompt || G.statusOpen || G.settingsOpen) { stopSwipe(); return; }
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
const SWIPE_IGNORE = "button, a, [role=button], #status-screen, #town-screen, #item-get, .confirm-overlay";
document.addEventListener("pointerdown", (e) => {
  if (e.pointerType === "mouse") return;
  if (e.target.closest(SWIPE_IGNORE)) return;
  stopSwipe();
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
  if (e.key === "Escape" && G.settingsOpen) { closeSettings(); return; }
  if (e.key === "Escape" && G.statusOpen) { closeStatus(); return; }
  if (G.state !== "board" || G.prompt || G.statusOpen || G.settingsOpen) return;
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
  "state", "floor", "maxFloorReached", "dungeonIdx", "unlockedDungeons", "board", "px", "py", "eliteFloor", "specialFloor", "mutator", "bossDown", "portalFound",
  "gold", "soulPts", "redSoul", "embers", "dollsPurchased", "dungeonBriefed", "pendingDoll",
  "party", "reserve", "souls", "shopStock", "run", "town",
  "quests", "dailyQuests", "subQuests", "subQuestSeen", "msq", "ach", "fastAnim", "tavernCrowd", "rumor", "rumorCooldown", "activeRumor", "codex", "treasury", "story", "dragonSlain", "stats",
  "battle", "battleCell", "prevPos", "statusIdx", "statusTab",
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
function reflattenItemStats() {
  const visited = new Set();
  function flatten(it) {
    if (!it || visited.has(it)) return;
    visited.add(it);
    const tmpl = ITEMS[it.id];
    if (!tmpl) return;
    if (it.pct) {
      delete it.pct;
      for (const k of ["atk", "vit", "agi", "int", "pie", "luk", "hp", "mp"]) {
        if (tmpl[k] != null) it[k] = tmpl[k]; else delete it[k];
      }
    }
    if (tmpl.weight && !it.weight) it.weight = tmpl.weight;
  }
  for (const m of G.party) {
    for (const it of m.items) flatten(it);
    for (const k of Object.keys(m.equip)) flatten(m.equip[k]);
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
    // サブ魂を {uid, skill} 形式へ正規化し、実在する魂・メイン魂と別の魂だけ残す
    d.subs = d.subs
      .map((x) => (x && typeof x === "object") ? { uid: x.uid, skill: x.skill || null } : null)
      .filter((x) => x && soulByUid(x.uid) && x.uid !== d.primary)
      .slice(0, MAX_SUBS);
    try { recalcDoll(d); } catch {}
  }
  if (!G.stats) G.stats = { runs: 0, deepest: 0, kills: 0, deaths: 0, soulsFound: 0, bossKills: 0 };
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
  // 第0章「人業の生成」: 王宮で謁見 → 戦士・僧侶・盗賊・魔導士の魂×4+🔴100を受ける (granted) → 館の保管庫で人業を1体仕立て → 報告
  G.msq = { n: 0, state: "active", granted: false };
  codexSweepJobs();
  initQuests();
}

// ---- 起動 ----
function init() {
  // 早期にフックを公開 (起動失敗の誤検出/デバッグ用)
  window.__game = { G, edgeOpen, COLS, ROWS, autosave, loadGame, clearSave, renderTown, ACHIEVEMENTS, questProgress };

  let loaded = false;
  try { loaded = loadGame(); } catch (e) { loaded = false; }
  if (!loaded) {
    setupNewGame();
    G.state = "town";
    log("百の迷宮と 魂の王へようこそ。人業に魂を宿し、深淵へ挑め。", "sys");
  } else {
    log("冒険を再開する。", "sys");
    setTimeout(() => { try { showToast("💾 冒険を再開しました"); } catch {} }, 400);
  }
  updateTopbar();
  // 復元描画に失敗してもセーブは絶対に消さない (データ保全優先)。
  // 失敗時は安全に街表示へフォールバックする。
  try {
    resumeFromState();
  } catch (e) {
    try {
      G.state = "town"; G.town = { facility: null, sub: null };
      G.statusOpen = false; G.settingsOpen = false; G.prompt = false; G.anim = null; G.walking = false;
      if (statusEl) statusEl.classList.add("hidden");
      if (settingsEl) settingsEl.classList.add("hidden");
      renderTown();
    } catch (e2) { /* これ以上は何もしない (セーブは温存) */ }
  }
  autosave(true);

  // 初回起動 (新規ゲーム) のみ: オープニングを流してから街へ
  if (!loaded) {
    G.prompt = true;
    openingActive = true;
    playBgm("opening"); // 音声起動前なら初回タップ時に開始される
    try {
      showOpening(() => { G.prompt = false; openingActive = false; playBgm(sceneBgm()); });
    } catch (e) { G.prompt = false; openingActive = false; }
  }

  if ("serviceWorker" in navigator) {
    // 新しい SW が制御を奪った瞬間に1度だけ確実にリロード (古いJS混在を防ぐ)
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloaded) return; reloaded = true; location.reload();
    });
    navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then((reg) => {
      reg.addEventListener("updatefound", () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener("statechange", () => {
          if (sw.state === "activated" && navigator.serviceWorker.controller && !reloaded) {
            reloaded = true; location.reload();
          }
        });
      });
    }).catch(() => {});
  }
}
init();
