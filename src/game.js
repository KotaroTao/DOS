// メインゲーム: カードボード探索 ⇄ 戦闘 (モンスターメーカー風)
import { makeBoard, COLS, ROWS } from "./board.js";
import { MONSTERS, HERO, ICONS, drawSprite } from "./sprites.js";
import { spawnCardEnemies, spawnBossEnemies, spawnEliteEnemies, spawnMimic, Battle, SPELLS, cloneItem, spellCost } from "./combat.js";
import { initAudio, SFX, playBgm, toggleMute, isMuted } from "./audio.js";
import { spriteCanvas } from "./sprites.js";
import {
  ITEMS, SLOTS, SLOT_LABEL, SLOT_ICONS, MAX_ITEMS, recalc, equip as equipItem, unequip as unequipItem, canEquip, slotKeyFor,
  ITEM_CATS, WEAPON_CATS, WEAPON_CAT_LABEL, lvToRank, weaponRange, RANGE_LABEL,
} from "./items.js";
import { RANK_NAME, RANK_COLOR } from "./content.js";
import { dungeonSubQuests } from "./subquests.js";
import { ACTS, actOf, msqOrderLines, msqReportLines, msqReward, EPILOGUE } from "./story.js";
import { CATALOG_ITEMS } from "./catalog/index.js";
import { DUNGEONS, DUNGEON_MONSTERS, RACE_LABEL, ELEMENTS, ELITE_ORDER } from "./dungeons/index.js";
import {
  PARTS, PART_LABEL, SOUL_CLASSES, makeSoul, makeDoll, soulName, soulSprite,
  dollSouls, dominantClass, recalcDoll, sealSoul,
  ATTR_KEYS, ATTR_LABEL, ATTR_NAME,
  SOUL_RANKS, rollSoulRank, rollJobClass, soulStats, soulHardCap, ensureSoul,
  jobRankOf, PART_SKILLS, HYBRIDS, findHybrid, JOB_LORE, jobRankCondText,
  jobSkillTable, charLevelOf, jobRankName, jobPassiveTable, pLv,
  RARITY_SYNTH_COST, FUSION_STAT_BONUS, FIVE_PART_BONUS, fuseSouls, JOB_GEAR,
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
}

// ===== 出現テーブル (隠しレベル) =====
// 全アイテムは隠しレベル lv を持つ。迷宮ごとの lootLv 帯 (＋階の深さ) を中心に、
// レベルの近い品だけが出現する。中心より高レベルの品ほど出現率が急減するうえ、
// 全体補正でも高レベル品ほど稀になる (= 強い装備は深い迷宮でしか、稀にしか出ない)。
const LOOT_IDS = Object.keys(ITEMS).filter((id) => ITEMS[id].slot !== "mat").sort();
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
// 現在の迷宮+階のアイテムレベル (中心値)。迷宮の lootLv 帯を階の深さで補間
function lootLvAt() {
  const cfg = activeCfg();
  const band = cfg.lootLv || [1, 8];
  const floors = Math.max(1, cfg.floors || 3);
  const t = floors > 1 ? Math.min(1, (G.floor - 1) / (floors - 1)) : 0;
  let c = band[0] + (band[1] - band[0]) * t;
  if (Math.random() < 0.05) c += 12; // まれな大当たり: ワンランク上の帯から出る
  return Math.min(200, c);
}

// ===== モンスターの戦利品テーブル =====
// 各モンスターに「通常ドロップ」「レアドロップ」を決定的に割り当てる。
// モンスターのランク → アイテムレベル帯に対応させる (レアは一段深い帯から)。
// 図鑑では実際に落とすまで ？？？ で伏せられる。
function _hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function _dropPoolAt(centerLv) {
  for (let win = 6; win <= 50; win += 6) {
    const ids = LOOT_IDS.filter((id) => Math.abs(ITEMS[id].lv - centerLv) <= win);
    if (ids.length) return ids;
  }
  return ["herb"];
}
for (const k in MONSTERS) {
  const m = MONSTERS[k];
  if (m.dropNormal && m.dropRare) continue;
  const h = _hashStr(String(m.key || k));
  // ランク (1-10) → アイテムレベル帯。rank*19 ≒ そのランクの迷宮の lootLv 中心
  const lvC = Math.max(2, Math.min(192, (m.rank || 1) * 19));
  const np = _dropPoolAt(lvC);
  const rp = _dropPoolAt(Math.min(198, lvC + 14));
  m.dropNormal = m.dropNormal || np[h % np.length];
  m.dropRare = m.dropRare || rp[(h >> 5) % rp.length];
}

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
  dollsPurchased: 0,  // 空の人業を購入した回数 (価格の段階に使う)
  pendingDoll: null,  // (旧形式) 未生成の人業。現在は「空の人形」(isEmpty) として reserve に残る (ロード時に移行)
  party: [],          // 迷宮に連れて行く人業 (最大6体)
  reserve: [],        // 酒場で待機中の人業
  souls: [],          // 未封印の魂ストック
  shopStock: null,    // 商店の在庫 { itemId: 個数 } (初回 setupNewGame で初期化)
  lastEmptyClaim: 0,  // 「空の魂」を商店で無料受領した日付シード
  run: null,          // 今回の潜入で得た戦利品 { gold, soulPts, items:[{owner,item}], souls:[] }
  town: { facility: null, sub: null }, // 街UIの現在地 (sub: 館などのサブメニュー)
  quests: [],         // 受注可能/進行中のクエスト
  dailyQuests: null,  // 日替わりクエスト { seed, list:[] } (日付が変わると再生成)
  subQuests: {},      // 受注済みサブクエスト { id: {…def, state, progress} } (定義は決定的に再生成可能)
  msq: null,          // メインストーリー { n: 章=迷宮番号(1-100), state: "active"|"report"|"offer"|"end" }
  ach: {},            // 受領済みの勲章 (実績) { id: true }
  fastAnim: false,    // 戦闘演出の倍速設定 (永続)
  autoCombat: false,  // オート戦闘中 (セッション内のみ)
  rumor: null,        // 酒場で表示中の噂 (次回潜入で現実化)
  rumorCooldown: 0,   // 次の噂を聞けるUNIXタイムスタンプ(ms) — 30分クールダウン
  activeRumor: null,  // 潜入時に確定した、この迷宮で適用する噂
  codex: { mon: {}, item: {}, job: {} }, // 図鑑 (モンスター/アイテム/職業)
  story: 0,           // 王宮ストーリーの進行段階
  dragonSlain: false, // 竜を討ったか
  runCfg: null,       // 今回の潜入の設定 (迷宮 + 日替わり修飾)
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
  eliteFloor: false,  // 現在のフロアが強敵階か (3F以降、5%の確率で発生)
};

const rand = (n) => Math.floor(Math.random() * n);

// ハプティクス (対応端末のみ)。パターン: 数値 or [待ち,振動,待ち,振動...]
function buzz(p) {
  if (navigator.vibrate) { try { navigator.vibrate(p); } catch {} }
}

// ---- 潜入中の戦利品トラッキング (全滅ペナルティ / Red Soul帰還で使う) ----
const inDungeon = () => G.state === "board" || G.state === "combat" || G.state === "over";
function runGainGold(g) { g = Math.round(g * ((G.runCfg && G.runCfg.goldMul) || 1)); G.gold += g; if (G.run && inDungeon()) G.run.gold += g; return g; }
function runGainSoulPts(s) { s = Math.round(s * ((G.runCfg && G.runCfg.soulMul) || 1)); G.soulPts += s; if (G.run && inDungeon()) G.run.soulPts += s; return s; }
function runGainItem(owner, item) { owner.items.push(item); if (G.run && inDungeon()) G.run.items.push({ owner, item }); }
function runGainSoul(soul) { G.souls.push(soul); if (G.run && inDungeon()) G.run.souls.push(soul); }

// 全滅して Red Soul を使わなかった場合: 今回の戦利品をすべて失う
function forfeitRun() {
  const r = G.run;
  if (!r) return;
  G.gold = Math.max(0, G.gold - r.gold);
  G.soulPts = Math.max(0, G.soulPts - r.soulPts);
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
  // 入手した魂を除去 (ストック or 宿し済みの両方を走査)
  for (const soul of r.souls) {
    const si = G.souls.indexOf(soul);
    if (si >= 0) { G.souls.splice(si, 1); continue; }
    for (const d of allDolls()) for (const part of PARTS) if (d.parts[part] === soul) { d.parts[part] = null; recalcDoll(d); }
  }
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
  logEl.scrollTop = logEl.scrollHeight;
  while (logEl.children.length > 80) logEl.removeChild(logEl.firstChild);
}

// 現在の迷宮設定
function curDungeon() { return DUNGEONS[G.dungeonIdx] || DUNGEONS[0]; }

// ===== 日替わり迷宮修飾 (日付シードで全員共通。実装はクライアントのみ) =====
const DAILY_MODS = [
  { id: 0, name: "平穏な日", desc: "特別な変化はない。" },
  { id: 1, name: "満月の夜", desc: "すべての死体があたたかい。", warmChance: 1 },
  { id: 2, name: "魂の豊穣", desc: "レアな魂が出やすい。", rankBonus: 1 },
  { id: 3, name: "瘴気の漂う日", desc: "敵が強いが Soul 1.5倍。", enemyMul: 1.25, soulMul: 1.5 },
  { id: 4, name: "静寂の刻", desc: "罠が消える。", trapRate: 0 },
  { id: 5, name: "黄金の日", desc: "ゴールドが 1.5倍。", goldMul: 1.5 },
  { id: 6, name: "亡者の行進", desc: "敵が増えるが良い戦利品。", enemyMul: 1.15, rankBonus: 0.6, soulMul: 1.2 },
  { id: 7, name: "元素の奔流", desc: "迷宮の属性が色濃く現れる。属性装備が鍵。", elemBias: 1 },
];
function dailySeed() { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); }
function getDailyMod() { return DAILY_MODS[dailySeed() % DAILY_MODS.length]; }

// 迷宮設定 + 日替わり修飾をマージした、今回の潜入の実効設定
function buildRunCfg() {
  const dn = { ...curDungeon() };
  const m = getDailyMod();
  if (m.warmChance != null) dn.warmChance = m.warmChance;
  if (m.trapRate != null) dn.trapRate = m.trapRate;
  dn.rankBonus = (dn.rankBonus || 0) + (m.rankBonus || 0);
  dn.soulMul = m.soulMul || 1;
  dn.goldMul = m.goldMul || 1;
  dn.enemyMul = m.enemyMul || 1;
  dn.elemBias = m.elemBias || 0;
  dn.modName = m.name;
  return dn;
}
function activeCfg() { return G.runCfg || curDungeon(); }

// 生存パーティが持つ職業ランクパッシブの最高Lv (隊全体効果の判定用。重複しない)
function partyPassiveLv(key) {
  let lv = 0;
  for (const p of G.party || []) if (p.alive) lv = Math.max(lv, pLv(p, key));
  return lv;
}

// 迷宮内の階に応じた敵の強さ倍率 (迷宮ベース × 階で微増 × 日替わり)
function enemyScale() {
  const cfg = activeCfg();
  return (cfg.enemyScale || 1) * (1 + (G.floor - 1) * 0.06) * (cfg.enemyMul || 1);
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

function updateTopbar() {
  const currency = `🔴${G.redSoul} 💰${G.gold} ✦${G.soulPts}`;
  if (G.state === "town") {
    floorInfo.textContent = currency;
    return;
  }
  floorInfo.textContent = `B${G.floor}F ${currency}`;
}

function newFloor() {
  // ダンジョンが自前で持つ出現プール (pool=浅階 / deepPool=深階) を使う
  const cfg = activeCfg();
  G.board = makeBoard(G.floor, cfg);
  // 強敵階: 全モンスターカードをこの迷宮グループ固有の強敵に置き換える
  if (G.eliteFloor) {
    const ek = eliteKey();
    for (let ey = 0; ey < ROWS; ey++) {
      for (let ex = 0; ex < COLS; ex++) {
        const ecell = G.board.cells[ey][ex];
        if (ecell.type === "monster") {
          ecell.monsterKey = ek;
          ecell.elite = true;
        }
      }
    }
  }
  if (G.floor > G.stats.deepest) G.stats.deepest = G.floor;
  // 酒場の噂を盤面に反映 (潜入直後の階のみ)
  if (G.activeRumor && G.activeRumor.floor === G.floor) applyRumorToBoard(G.board);
  G.px = G.board.start.x;
  G.py = G.board.start.y;
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

// 石床のタイル模様 (決定的な乱数で毎回同じ見た目)
function drawFloor() {
  vctx.fillStyle = "#121218";
  vctx.fillRect(0, 0, view.width, view.height);
  const T = 24;
  for (let ty = 0; ty < view.height / T; ty++) {
    for (let tx = 0; tx < view.width / T; tx++) {
      const n = (tx * 7 + ty * 13) % 5;
      vctx.fillStyle = n === 0 ? "#17171f" : n === 1 ? "#15151c" : "#131319";
      vctx.fillRect(tx * T, ty * T, T - 1, T - 1);
    }
  }
  // 中央が明るく周辺が暗いビネット (たいまつの灯り)
  const vg = vctx.createRadialGradient(view.width / 2, view.height / 2, 60, view.width / 2, view.height / 2, view.width * 0.62);
  vg.addColorStop(0, "rgba(255,190,90,0.07)");
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
  }
}

function renderBoard() {
  updateDescendBtn();
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
    } else {
      // 通常カード裏面: 深紅の布地 + 金の縁飾り + ダイヤ紋
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
      cell.type === "stairs" ? ICONS.stairs :
      cell.type === "start" ? ICONS.upstairs : null;
    if (icon) {
      // アイコンの足元影
      vctx.fillStyle = "rgba(0,0,0,0.35)";
      vctx.beginPath();
      vctx.ellipse(cx, cy + 14, 13, 3.5, 0, 0, Math.PI * 2);
      vctx.fill();
      drawSprite(vctx, icon, cx, cy, 3);
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
          startBattle(spawnCardEnemies(cell.monsterKey, G.floor, enemyScale()), cell);
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
    case "start":
      askReturnFromStairs();
      break;
  }
}

// 登り階段 (入口/降りてきたマス): 街へ戻るか選ぶ
function askReturnFromStairs() {
  showChoice("登り階段だ。街へ戻る？", [
    { label: "🏚 街へ戻る", fn: () => returnToTown() },
    { label: "✋ 探索を続ける", fn: () => { renderBoard(); } },
  ], ICONS.upstairs, { banner: "↑ 登り階段 ↑", accent: "#7fd0ff" });
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
  if (!cell.corpseWarm) {
    // 風化した死体: 調べるか立ち去るかを選ぶ (宝箱と同じポップアップ)
    showChoice(`風化した死体（${clsLabel}）が横たわっている。調べてみるか？`, [
      { label: "🔍 調べる", fn: () => investigateCorpse(cell, clsKey, clsLabel) },
      { label: "🚶 立ち去る", fn: () => { log("死体には触れず、立ち去った。", "sys"); renderBoard(); } },
    ], ICONS.corpse, { banner: "— 風化した死体 —", accent: "#8c866f" });
    return;
  }
  // あたたかい死体: 回収するか立ち去るか選べる。立ち去れば死体は残る。
  showChoice(`まだあたたかい死体（${clsLabel}）。魂が宿っている。`, [
    { label: "✦ 魂を回収する", fn: () => collectSoul(cell, clsKey, clsLabel) },
    { label: "🚶 立ち去る", fn: () => { log("死体に手を触れず、立ち去った。", "sys"); renderBoard(); } },
  ], ICONS.corpseWarm, { banner: "✦ あたたかい死体 ✦", accent: SOUL_CLASSES[clsKey].glow });
}

// 現在のダンジョンに出るアンデッド種のキー (なければ全体から、最終的に地下牢の骸)
function undeadKeyForDungeon() {
  const cfg = activeCfg();
  const local = [...(cfg.pool || []), ...(cfg.deepPool || [])]
    .filter((k) => MONSTERS[k] && MONSTERS[k].race === "undead");
  if (local.length) return local[rand(local.length)];
  const all = Object.keys(MONSTERS).filter((k) => MONSTERS[k].race === "undead" && !MONSTERS[k].elite);
  return all.length ? all[rand(all.length)] : "d01_skeleton";
}

// 風化した死体を調べる: 20%で死体が起き上がりアンデッド戦、それ以外は装備 or 魂
function investigateCorpse(cell, clsKey, clsLabel) {
  if (Math.random() < 0.20) {
    // 死体が起き上がる: アンデッドとの戦闘 (勝てば battleCell が cleared)
    log("風化した死体が、軋みながら起き上がった！", "dmg");
    SFX.die(); buzz([0, 40, 60, 40]);
    startBattle(spawnCardEnemies(undeadKeyForDungeon(), G.floor, enemyScale()), cell);
    return;
  }
  cell.cleared = true;
  // 50%: 装備品が見つかる
  if (Math.random() < 0.5) {
    const id = pickItemByLv(lootLvAt());
    const who = G.party.find((p) => p.alive && p.items.length < MAX_ITEMS)
      || G.party.find((p) => p.items.length < MAX_ITEMS);
    if (who && ITEMS[id]) {
      const it = cloneItem(id);
      runGainItem(who, it);
      codexSeeItem(id);
      log(`風化した死体の傍らに ${it.name} が遺されていた。`, "win");
      showItemGet(it, who, () => renderBoard());
      return;
    }
    // 所持品に空きがなければ魂にフォールバック
  }
  // 残り: 職能の記憶を宿した魂
  const dn = activeCfg();
  const lvl = 1 + (dn.soulLevelBonus || 0) + Math.floor(G.floor / 3);
  const soul = makeSoul(clsKey, lvl, null, rollSoulRank(dn.rankBonus));
  acquireSoul(soul, `風化した死体（${clsLabel}）の残りかすに、まだ職能の記憶が宿っていた。`);
}

function collectSoul(cell, clsKey, clsLabel) {
  cell.cleared = true;
  const dn = activeCfg();
  const lvl = 1 + (dn.soulLevelBonus || 0) + (Math.random() < 0.3 ? 1 : 0) + Math.floor(G.floor / 3);
  // 部位はランダム、ランクは抽選 (深い迷宮ほどレア魂が出やすい)
  const soul = makeSoul(clsKey, lvl, null, rollSoulRank(dn.rankBonus));
  maybeDropEmptySoul(0.07); // まれに「空の魂」も見つかる
  acquireSoul(soul, `まだあたたかい死体（${clsLabel}）に宿っていた魂だ。`);
}

// 一定確率で「空の魂」を手の空いた人業へ。入手したらログ表示
function maybeDropEmptySoul(chance) {
  if (Math.random() >= chance) return false;
  const who = G.party.find((m) => m.alive && m.items.length < MAX_ITEMS);
  if (!who) return false;
  const it = cloneItem(EMPTY_SOUL_ID);
  if (!it) return false;
  runGainItem(who, it);
  codexSeeItem(EMPTY_SOUL_ID);
  log(`希少な「空の魂」を見つけた！ (${who.name})`, "win");
  setTimeout(() => showToast("✦ 空の魂 を入手"), 300);
  return true;
}

// 魂の入手処理 (共通): ストック追加・クエスト進捗・ランクに応じた演出
function acquireSoul(soul, sourceLine) {
  runGainSoul(soul);
  G.stats.soulsFound++;
  questProgress("soul", null, 1);
  const rank = SOUL_RANKS[soul.rank] || SOUL_RANKS[1];
  const rare = rank.order >= 1;
  SFX.itemget(); buzz(rare ? [0, 40, 50, 40, 50, 150] : [0, 30, 60, 30]);
  log(`${soulName(soul)} を手に入れた！`, "win");
  if (rank.order >= 4) { flashScreen("#ffcf4a"); SFX.victory(); } // ランク5の魂は特別な瞬間
  if (rank.order >= 1) setTimeout(() => showToast(`🌟 ${rank.label}魂を発見！`), 300);
  showEvent({
    sprite: soulSprite(soul.clsKey), title: soulName(soul),
    accent: rank.color || SOUL_CLASSES[soul.clsKey].glow,
    banner: rare ? `★ ${rank.label}魂 ★` : "✦ 魂を回収 ✦", sparkle: true,
    lines: [sourceLine, "人業の館で同じ部位に宿せる。"],
    onClose: () => renderBoard(),
  });
}

// ---- 選択肢プロンプト ----
// ゴールド発見などと同じ中央オーバーレイカードに、イラスト+タイトル+選択肢を表示
function showChoice(title, options, icon, { banner = "✦ 発見 ✦", accent = "#c9a227", lines = [] } = {}) {
  G.prompt = true;
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
  autosave(true);
}

// 階段: 降りるか選ぶ。最深階の階段はボスへの扉
function askDescend(cell) {
  const dn = curDungeon();
  const boss = G.floor >= dn.floors;
  showChoice(
    boss ? `この奥に「${dn.name}」の主が待つ。挑む？` : `下り階段を見つけた。地下 ${G.floor + 1} 階へ降りる？`,
    [
      { label: boss ? "⚔ 主に挑む" : "▼ 降りる", danger: boss, fn: () => {
        if (boss) { log("迷宮の主が立ちはだかる！", "dmg"); startBattle(spawnBossEnemies(dn.boss, dn.bossScale * enemyScale()), cell); }
        else descend();
      } },
      { label: "✋ まだ探索する", fn: () => { renderBoard(); } },
    ],
    ICONS.stairs,
    boss ? { banner: "⚠ 迷宮の主 ⚠", accent: "#d4504e" } : { banner: "✦ 発見 ✦" }
  );
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
// 適正レベルの盗賊系で約95% (上限)、それ以外で70〜80% になるよう調整している。
// cRank: 宝箱ランク (1-5)。床罠は1扱い
function disarmNeed(cRank = 1) {
  const cfg = activeCfg();
  const L = 2 + (cfg.soulLevelBonus || 0) * 2.4;        // 適正な魂レベルの目安 (強化込み)
  const f = 1 + (L - 1) * 0.12;                          // souls.js の lvlFactor と同式
  const q = 1 + ((cfg.rank || 1) - 1) * 0.14;            // ダンジョンランク: 深部は高ランク魂が前提
  const c = 1 + ((cRank || 1) - 1) * 0.16;               // 宝箱ランク: 上等な箱ほど狡猾な錠前
  return 14 * f * q * c;
}

function disarmChance(m, cRank = 1) {
  return Math.max(0.05, Math.min(0.95, disarmPower(m) / disarmNeed(cRank)));
}

// 宝箱ランク (1-5) を取得。セルに未設定ならその場で抽選して保存する
// (出現%表示と実際の判定がぶれないよう、同じ宝箱では固定)
function chestRankOf(cell) {
  if (cell && cell.cRank) return cell.cRank;
  const cfg = activeCfg();
  const floors = Math.max(1, cfg.floors || 3);
  const depth = floors > 1 ? Math.min(1, (G.floor - 1) / (floors - 1)) : 0;
  const r = rollChestRank(depth, cfg.rank || 1);
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
function rollChest(cell, allowDanger, done, opener, cRankIn) {
  const cRank = cRankIn || (allowDanger ? chestRankOf(cell) : 1);
  if (allowDanger) {
    if (Math.random() < 0.06 + G.floor * 0.03) {
      // ミミック: 演出 → 戦闘
      SFX.trap(); buzz([0, 60, 40, 60]);
      log("宝箱はミミックだった！", "dmg");
      showEvent({
        sprite: MONSTERS.kobold, title: "ミミックだ！", accent: "#d4504e", banner: "⚠ 危険 ⚠",
        lines: ["宝箱は怪物だった！", "戦闘になる！"], btnLabel: "戦う",
        onClose: () => startBattle(spawnMimic(activeCfg().rank || 1, enemyScale()), cell),
      });
      return;
    }
    // 黒い宝箱: 一段上のレベル帯の品が眠るが、開けると呪いの危険を伴う (任意の賭け)
    if (Math.random() < 0.10) {
      askCursedChest(done);
      return;
    }
    // 罠フェーズ: 70%で罠。解除/発動/罠なしの演出を経て中身へ
    chestTrapPhase(opener, () => chestContents(cell, done, cRank), cRank, done);
    return;
  }
  chestContents(cell, done, cRank);
}

// 罠フェーズ (盤面・戦闘後の宝箱共通): 70%の確率で罠が仕掛けられている。
// 迷宮ランクに応じた罠を抽選し、開けた者が解除を試みる (難度はダンジョンランク×宝箱ランク)。
// 成功または罠なしならその旨を告げてから contents() へ進む。
// abort: テレポーター/警報で中身を失った時の終了処理 (省略時は盤面へ)。
// excludeKinds: 出現させない罠の型 (踏破演出など、戦闘で続きが途切れる場面で使う)
function chestTrapPhase(opener, contents, cRank = 1, abort, excludeKinds) {
  if (Math.random() < 0.70) {
    const trap = pickTrap(activeCfg().rank || 1, Math.random, excludeKinds);
    const who = opener || bestDisarmer();
    if (who && Math.random() < disarmChance(who, cRank)) {
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
  showEvent({
    sprite: ICONS.trap, title: `${trap.name}！`, lines, accent: "#d4504e", banner: "⚠ 危険 ⚠",
    onClose: () => {
      if (wiped) { gameOver(); return; }
      if (fallen.length) SFX.die();
      imprintFallen();
      fin.proceed(); // 痛手は負ったが、先へ進める (宝箱なら中身は手に入る)
    },
  });
}

// 宝箱の中身 (ゴールド/空の魂/装備品)。cRank: 宝箱ランク (1-5、高いほど豪華)
function chestContents(cell, done, cRank = 1) {
  const rankMul = 1 + ((cRank || 1) - 1) * 0.3;
  // 中身の抽選 (ダンジョンレベルに応じる): ゴールド50% / ゴールド以外のアイテム50%
  if (Math.random() < 0.5) {
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
  // アイテム: まれに「空の魂」(魂合成の素材)、通常は宝箱ランク→アイテムランク
  if (Math.random() < 0.18) {
    const who = G.party.find((m) => m.alive && m.items.length < MAX_ITEMS);
    if (who) {
      const it = cloneItem(EMPTY_SOUL_ID);
      runGainItem(who, it); codexSeeItem(EMPTY_SOUL_ID);
      log(`宝箱から希少な「空の魂」を入手！ (${who.name})`, "win");
      showItemGet(it, who, done); return;
    }
  }
  // 宝: 装備/アイテム (迷宮のアイテムレベル帯から抽選。高ランクの宝箱は一段上の帯)
  const got = giveItem(pickItemByLv(Math.min(200, lootLvAt() + ((cRank || 1) - 1) * 4)));
  if (got) { showItemGet(got.item, got.who, done); return; } // 演出後に done
  SFX.chest();
  if (done) done();
}

// 黒い宝箱: 開ければ一段上のレベル帯の装備が出るが、50%で呪いがふきだす。
// 「開けない」が常に選べる、純粋なリスクとリターンの賭け
function askCursedChest(done) {
  const openIt = () => {
    const giveLoot = () => {
      const got = giveItem(pickItemByLv(Math.min(200, lootLvAt() + 14)));
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
// after: 終了後に呼ぶ (ボス撃破時は踏破演出へつなぐ)
function battleChest(drops, after) {
  const done = () => { if (after) after(); else if (G.state === "board") renderBoard(); };
  const cRank = chestRankOf(null);
  const contents = () => {
    if (drops && drops.length) giveDropsFromChest(drops, 0, done);
    else rollChest(null, false, done, null, cRank);
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
  runGainItem(who, d.item);
  SFX.chest();
  log(`宝箱から ${d.name}の落とした ${d.item.name} を手に入れた！`, d.rare ? "win" : "sys");
  if (d.rare) setTimeout(() => showToast(`🌟レアドロップ ${d.item.name}`), 500);
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
  if (G.eliteFloor) {
    log("…強敵の気配がする。", "dmg");
  } else {
    log("階段を降りていく…", "sys");
  }
  // 暗転 → 階数タイトル → 明転 の演出
  G.prompt = true;
  const ov = el("div", G.eliteFloor ? "floor-trans floor-trans-elite" : "floor-trans");
  ov.appendChild(el("div", "ft-floor", `B${G.floor}F`));
  ov.appendChild(el("div", "ft-sub", G.eliteFloor ? "— 禍々しき気配 —" : "— さらに深く潜る —"));
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
  const isElite = enemies.some((e) => e.mon && e.mon.elite);
  if (cfg.element) {
    const ch = cfg.elemBias ? 0.9 : 0.5;
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
    const amb = 0.08 * (vig >= 2 ? 0 : vig === 1 ? 0.5 : 1);
    const pre = 0.08 + (partyPassiveLv("initiative") ? 0.15 : 0);
    const r = Math.random();
    if (r < amb) opening = "ambush";
    else if (r < amb + pre) opening = "preempt";
  }
  if (opening === "preempt") { log("先手を取った！", "win"); showToast("⚡ 先制攻撃！"); }
  else if (opening === "ambush") { log("奇襲された！", "dmg"); showToast("⚠ 奇襲された！"); buzz([0, 60, 40, 60]); }
  // ランク帯ごとの戦闘テーマ (ボス・強敵は専用曲)。図鑑への記録は「倒した時」に行う (endBattle)
  playBgm(battleBgm(isBoss || isElite));
  G.battle = new Battle(G.party, enemies, log, { opening });
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
    const baseX = (view.width / (row.list.length + 1)) * (i + 1);
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
    drawSprite(vctx, e.mon, baseX + ox, baseY + oy, size, alpha);
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
    if (t > 1) continue;
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
    if (t > 1) continue;
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
    if (t > 1) continue;
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
    if (actor.spells.length) row.appendChild(btn("✦ 呪文", () => showSpells(actor)));
    else row.appendChild(btn("✦ 呪文", () => log("呪文を使えない", "sys")));
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
  combatMenu.appendChild(el("div", "who", `${actor.name} の呪文 (MP ${actor.mp})`));
  const list = el("div", "target-list");
  for (const key of actor.spells) {
    const sp = SPELLS[key];
    const cost = spellCost(actor, sp); // 省詠唱 (chant) 持ちは消費が軽い
    const b = btn(`${sp.name} (MP${cost}) - ${sp.desc}`, () => { act("spell", key); });
    if (actor.mp < cost) { b.disabled = true; b.style.opacity = "0.4"; } // MP不足は押せない
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

// 結果オブジェクトを演出 (踏み込み → 着弾 → 余韻)
function animateResult(res, done) {
  const t0 = performance.now();
  const WIND = (res.side === "enemy" ? 170 : 90) * spdMul();
  const TOTAL = WIND + 360 * spdMul();
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
  for (const h of res.hits) {
    if (h.target.side === "enemy") {
      const pos = G.enemyPos[h.target.uid];
      if (!pos || h.miss) continue;
      if (res.action === "spell" && res.spellKind !== "heal" && res.spellKind !== "phys") {
        fx.magic.push({ x: pos.cx, y: pos.cy, t0: now, color: magicColor(res) });
      } else if (res.action === "attack" || res.spellKind === "phys") {
        fx.slashes.push({ x: pos.cx, y: pos.cy, t0: now });
      }
      fx.flash[h.target.uid] = { t0: now };
      if (h.dmg != null) fx.floats.push({ x: pos.cx, y: pos.cy - 18, text: String(h.dmg) + (h.crit ? "!" : ""), color: h.crit ? "#ffd84a" : "#fff", t0: now });
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
        // レベルドレイン: 対象のいずれかの魂のレベルを永続的に1下げる
        if (h.drain && h.target.parts) {
          const souls = PARTS.map((p) => h.target.parts[p]).filter((s) => s && s.level > 1);
          if (souls.length) {
            const s = souls[rand(souls.length)];
            s.level--;
            recalcDoll(h.target);
            h.target.hp = Math.min(h.target.hp, h.target.maxhp);
            log(`${h.target.name}の${SOUL_CLASSES[s.clsKey].label}の魂が喰われ、Lv${s.level} に堕ちた…！`, "dmg");
            setTimeout(() => showToast(`☠ レベルドレイン: ${SOUL_CLASSES[s.clsKey].label}の魂 Lv-1`), 300);
          }
        }
      }
    }
  }
  if (partyHit) { fx.screen = { color: "#d4504e", t0: now }; buzz([0, 50, 50, 50]); shakeScreen(true); }
  if (anyDeath) setTimeout(() => SFX.die(), 200);
}

function endBattle() {
  const b = G.battle;
  // オート戦闘は戦闘ごとに解除 (次の戦闘に持ち越さない)
  G.autoCombat = false;
  if (G._autoTimer) { clearTimeout(G._autoTimer); G._autoTimer = null; }
  renderCombat();
  if (b.result === "win") {
    // 倒した敵から Soul(魂) を回収する。Soul が経験値の役割を兼ね、館での魂の強化に使う
    // 金運 (goldLuck) / 魂寄せ (soulLure) は戦闘報酬を底上げする (隊内最高Lvのみ)
    const { soul, gold } = b.rewards();
    const gl = partyPassiveLv("goldLuck"), sl = partyPassiveLv("soulLure");
    const goldGot = runGainGold(Math.round(gold * (gl >= 2 ? 1.30 : gl === 1 ? 1.15 : 1)));
    const soulGot = runGainSoulPts(Math.round(soul * (sl >= 2 ? 1.20 : sl === 1 ? 1.10 : 1)));
    applyVictoryPassives();
    updateTopbar();
    log(`勝利！ ${goldGot} ゴールド と ✦${soulGot} Soul を得た。`, "win");
    SFX.victory();
    // 討伐クエストの進捗 + 戦績 + 図鑑記録 (倒した敵を集計)。
    // 戦利品はここでは抽選のみ。実物は勝利後の宝箱から取り出す
    const drops = [];
    for (const e of b.enemies) {
      if (e.alive) continue;
      questProgress("kill", e.key);
      G.stats.kills++;
      recordMonsterKill(e.key, G.dungeonIdx); // 図鑑は「倒した時」に記録
      const d = rollMonsterDrop(e);
      if (d) drops.push(d);
    }
    // 宝箱は1つしか現れないので中身も1品まで: 複数体が同時に落とした時はレア優先で1つに絞る
    // (同種2体が同じ品を落とし、1つの宝箱からアイテムが2つ出てしまうのを防ぐ)
    let drop = drops.find((d) => d.rare) || drops[0] || null;
    // 強敵討伐ボーナス: 高ランクアイテムの確定ドロップ
    const wasElite = b.enemies.some((e) => !e.alive && e.mon && e.mon.elite);
    if (wasElite) {
      const eliteLv = Math.min(200, lootLvAt() + 20); // 適正帯より2ランク上のアイテム
      const eid = pickItemByLv(eliteLv);
      if (ITEMS[eid]) drop = { key: "elite", name: "強敵", id: eid, item: cloneItem(eid), rare: true };
    }
    // soulClass を持つ敵 (人型・騎士など) はまれに魂を落とす (レアドロップ)
    for (const e of b.enemies) {
      const sc = e.alive ? null : (e.mon && e.mon.soulClass) || (MONSTERS[e.key] && MONSTERS[e.key].soulClass);
      if (!sc) continue;
      const soulChance = wasElite ? 0.40 : 0.08; // 強敵は魂ドロップ率が大幅上昇
      if (Math.random() < soulChance) {
        const dn = activeCfg();
        const s = makeSoul(sc, 1 + (dn.soulLevelBonus || 0) + (G.floor >= 2 ? 1 : 0), null, rollSoulRank(dn.rankBonus || 0));
        runGainSoul(s);
        G.stats.soulsFound++;
        questProgress("soul", null, 1);
        const rk = SOUL_RANKS[s.rank] || SOUL_RANKS[1];
        log(`${e.name}が ${soulName(s)} を落とした！`, "win");
        setTimeout(() => showToast(`${rk.order >= 2 ? "🌟" : "✦"} ${soulName(s)} を入手`), 600);
      }
    }
    const wasBoss = b.enemies.some((e) => e.boss);
    if (wasBoss) { flashScreen("#ffd84a"); buzz([0, 60, 50, 60, 50, 250]); } // 主討伐は特別な瞬間
    else if (wasElite) { flashScreen("#d4504e"); buzz([0, 80, 50, 80, 50, 300]); setTimeout(() => showToast("☠ 強敵討伐！"), 400); }
    if (G.battleCell) G.battleCell.cleared = true;
    // 主討伐の確定処理 (踏破記録・章進行・戦利品確定) は演出より先に行い、
    // 直後の finishToBoard の保存に乗せる。演出中に中断されても踏破は失われない
    const clearInfo = wasBoss ? commitDungeonClear() : null;
    finishToBoard();
    // 勝利の余韻: まず勝利ポップアップ(Gold/Soul)を表示し、閉じてから宝箱を出す。
    // 宝箱はドロップ品があれば必ず、なければ50%で出現。強敵・ボスは宝箱確定。
    const afterVictory = () => {
      const after = clearInfo ? () => showDungeonClearedPopup(clearInfo) : null;
      if (drop || wasElite || Math.random() < 0.5) {
        setTimeout(() => battleChest(drop ? [drop] : [], after), 200);
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
      btnLabel: "つぎへ", onClose: afterVictory,
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
  // 赤い魂を使う: 戦利品を失わず街へ即時帰還 (人業は復活せず連れ帰りを待つ)
  if (G.redSoul >= GUARDIAN_COST) {
    opts.push({ label: `🔴 赤い魂 ×${GUARDIAN_COST} を使う（戦利品を守り即時帰還）`, fn: () => {
      G.redSoul -= GUARDIAN_COST;
      G.run = null; // 戦利品を確定 (没収しない)
      SFX.levelup(); buzz([0, 30, 40, 30]);
      log("赤い魂が戦利品を守った。死した人業は連れ帰りを待つ。", "win");
      goTown();
    } });
  }
  // あきらめる: 今回の戦利品をすべて失い、救出を待つ
  opts.push({ label: "🏚 あきらめる（戦利品を失い救出を待つ）", danger: true, fn: () => {
    forfeitRun();
    log("今回の探索で得たものはすべて失われた…", "dmg");
    goTown();
  } });

  const lootLine = `戦利品 💰${r.gold} ✦${r.soulPts}・装備${r.items.length}・魂${r.souls.length}`
    + (G.redSoul >= GUARDIAN_COST ? "" : `（赤い魂は ${GUARDIAN_COST} 必要・所持 ${G.redSoul}）`);
  showChoice(lootLine, opts, ICONS.corpse, { banner: "💀 全滅 💀", accent: "#d4504e" });
}

// 迷宮の主を撃破した瞬間の確定処理。演出 (showDungeonClearedPopup) とは分離し、
// 勝利確定と同時に保存されるため、演出中に中断されても踏破・章進行は失われない
function commitDungeonClear() {
  const idx = G.dungeonIdx;
  G.stats.bossKills++;
  questProgress("boss", null, 1);
  G.dragonSlain = G.dragonSlain || idx === DUNGEONS.length - 1;
  // 新迷宮の解放は王宮の勅命ループが担う: 勅命対象を踏破 → 王宮で報告 → 次章拝命で解放
  const isStoryTarget = G.msq && G.msq.state === "active" && idx + 1 === G.msq.n;
  if (isStoryTarget) G.msq.state = "report";
  G.run = null; // クリア = 戦利品確定
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
    `;
    partyEl.appendChild(card);
  });
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

// ================= 街 (拠点) =================
const townEl = document.getElementById("town-screen");
const townBtn = document.getElementById("town-btn");
const descendBtn = document.getElementById("descend-btn");

function updateDescendBtn() {
  if (!descendBtn) return;
  if (G.state !== "board" || !G.board) {
    descendBtn.disabled = true;
    return;
  }
  const stairCell = findRevealedStairs();
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
  { key: "shop", icon: "🏪", name: "商店", desc: "装備・道具の売買" },
  { key: "inn", icon: "🛏", name: "宿屋「がろう」", desc: "魂を休め、傷を癒す" },
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
    head.appendChild(el("div", "tw-back ghost", ""));
  }
  head.appendChild(el("div", "tw-title", title));
  const cur = el("div", "tw-cur");
  cur.appendChild(el("span", "tw-c-gold", `💰${G.gold}`));
  cur.appendChild(el("span", "tw-c-soul", `✦${G.soulPts}`));
  cur.appendChild(el("span", "tw-c-red", `🔴${G.redSoul}`));
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
  renderTownHub();
}

let townBandOpen = null; // 迷宮選択で開いている層域 (null = 選択中の迷宮の層域)

function renderTownHub() {
  townEl.appendChild(townHeader("辺境の街 ロアダル", false));

  const intro = el("div", "tw-intro");
  intro.appendChild(el("div", "tw-introt", "百の迷宮と 魂の王 — Hundred Labyrinths: Rise of the Soul King"));
  intro.appendChild(el("div", "tw-intros", `踏破した迷宮 ${clearedDungeonCount()} / ${DUNGEONS.length}`));
  townEl.appendChild(intro);

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
    // 迷宮の選択 (解放済みのみ。クリアで深い迷宮が増える)
    // 本日の迷宮 (日替わり修飾)
    const dm = getDailyMod();
    const dmBox = el("div", "tw-daily");
    dmBox.appendChild(el("div", "tw-dailyt", `🌙 本日の迷宮: ${dm.name}`));
    dmBox.appendChild(el("div", "tw-dailyd", dm.desc));
    townEl.appendChild(dmBox);

    // 迷宮の選択 — 10迷宮ごとの「層域」アコーディオン (数が増えても一覧が伸びすぎない)
    townEl.appendChild(el("div", "tw-h", "潜る迷宮を選ぶ"));
    townEl.appendChild(el("div", "tw-dunhelp", "★踏破済みの迷宮には何度でも再挑戦できる — 戦利品・魂・図鑑集めに。"));
    const clearedCnt = clearedDungeonCount();
    // 勅命の対象迷宮 (攻略中の章のみ ❗ を付ける)
    const targetIdx = G.msq && G.msq.state === "active" && G.msq.n >= 1 ? G.msq.n - 1 : -1;
    const bandCount = Math.ceil(DUNGEONS.length / 10);
    const openBand = (townBandOpen != null) ? townBandOpen : Math.floor(G.dungeonIdx / 10);
    const maxBand = Math.floor((G.unlockedDungeons - 1) / 10); // 解放済み迷宮が属する最後の層域
    for (let b = 0; b < bandCount; b++) {
      const s = b * 10, e = Math.min(DUNGEONS.length, s + 10);
      if (b > maxBand) {
        // 未到達の層域は次のひとつだけ「封印中」として見せる
        if (b === maxBand + 1) {
          const lockBox = el("div", "tw-band lockedband");
          lockBox.appendChild(el("div", "tw-bandh", `🔒 第${b + 1}層域 — 迷宮 ${s + 1}〜${e} (封印中)`));
          townEl.appendChild(lockBox);
        }
        continue;
      }
      const det = el("details", "tw-band");
      if (b === openBand) det.open = true;
      const sum = el("summary", "tw-bandh");
      const clearedIn = Math.max(0, Math.min(clearedCnt - s, e - s));
      sum.textContent = `${clearedIn >= e - s ? "★ " : ""}第${b + 1}層域 — 迷宮 ${s + 1}〜${e} (踏破 ${clearedIn}/${e - s})`;
      det.appendChild(sum);
      det.addEventListener("toggle", () => {
        if (det.open) townBandOpen = b;
        else if (townBandOpen === b) townBandOpen = null;
      });
      const dlist = el("div", "tw-mlist");
      for (let i = s; i < e; i++) {
        const dn = DUNGEONS[i];
        const unlocked = i < G.unlockedDungeons;
        const cleared = i < clearedCnt;
        const row = el("div", "tw-dungeon" + (i === G.dungeonIdx ? " sel" : "") + (unlocked ? "" : " locked") + (cleared ? " cleared" : ""));
        const info = el("div", "tw-chipi");
        info.appendChild(el("div", "tw-chipn", unlocked ? `${i + 1}. ${dn.name}` : `🔒 ？？？`));
        const elTag = dn.element && ELEMENTS[dn.element] ? ` ・${ELEMENTS[dn.element].label}の気配` : "";
        info.appendChild(el("div", "tw-chipc", unlocked ? `全${dn.floors}階 ・ 敵ランク${dn.rank}${elTag}` : `前の迷宮を踏破し、王宮で勅命を受けると解放`));
        row.appendChild(info);
        if (unlocked) {
          // 踏破状態バッジ (★踏破済=再挑戦可 / ❗勅命=攻略対象 / 未踏破)
          const st = el("div", "tw-dunst" + (cleared ? " done" : i === targetIdx ? " quest" : ""));
          st.textContent = cleared ? "★ 踏破済" : i === targetIdx ? "❗ 勅命" : "未踏破";
          row.appendChild(st);
          row.addEventListener("click", () => { G.dungeonIdx = i; SFX.select(); renderTown(); });
        }
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
    s.appendChild(spriteCanvas(soulSprite(dom.clsKey), 2));
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

// ---- 人業の館: 4つのメニュー (編成 / 魂を宿す / 魂の強化・管理 / 人業作成・管理) ----
const MANSION_MENU = [
  { key: "party", icon: "🛡", name: "パーティ編成", desc: "迷宮へ連れて行く6体を選ぶ" },
  { key: "altar", icon: "⛓", name: "魂を宿す", desc: "5部位に魂を宿す" },
  { key: "enhance", icon: "✦", name: "魂強化", desc: "Soulで魂を鍛える" },
  { key: "synth", icon: "🌀", name: "魂合成", desc: "Soulで魂を作る" },
  { key: "fuse", icon: "⚗", name: "魂融合", desc: "同種2体を融合してランクアップ" },
  { key: "break", icon: "💥", name: "魂分解", desc: "魂を砕いてSoulに" },
  { key: "manage", icon: "🏚", name: "人業 作成 / 管理", desc: "空の人業を購入・解体" },
];

function renderMansion() {
  const sub = G.town.sub;
  if (sub === "party") return renderMansionParty();
  if (sub === "altar") return renderAltar();
  if (sub === "enhance") return renderMansionEnhance();
  if (sub === "synth") return renderMansionSynth();
  if (sub === "fuse") return renderMansionFuse();
  if (sub === "break") return renderMansionBreak();
  if (sub === "manage") return renderMansionManage();

  townEl.appendChild(townHeader("人業の館"));
  townEl.appendChild(el("div", "tw-lead", "人型の器「人業（Doll）」を仕立て、5部位に魂を宿して鍛える訓練所。"));
  const tutM = G.msq && G.msq.n === 0 && G.msq.state === "active";
  const grid = el("div", "tw-grid");
  for (const m of MANSION_MENU) {
    // 第0章中は「作成/管理」のみ。空の人形がいる間は「魂を宿す」も開放 (戻れないと詰むため)
    const locked = tutM && m.key !== "manage" && !(m.key === "altar" && allDolls().some((d) => d.isEmpty));
    const c = el("div", "tw-fac" + (locked ? " locked" : ""));
    c.appendChild(el("div", "tw-faci", locked ? "🔒" : m.icon));
    c.appendChild(el("div", "tw-facn", m.name));
    c.appendChild(el("div", "tw-facd", m.desc));
    if (!locked) c.addEventListener("click", () => { SFX.select(); G.town.sub = m.key; altarSel = null; renderTown(); });
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
    if (d.isEmpty) { log("空の人形はまだ編成できない。「魂を宿す」で5部位に魂を宿し、人業を生成しよう。", "sys"); SFX.ng(); return; }
    if (G.party.length >= 6) { log("編成は満員だ (6体まで)。", "sys"); return; }
    G.reserve.splice(G.reserve.indexOf(d), 1); G.party.push(d); SFX.select(); renderTown();
  })));
  townEl.appendChild(rl);
}

// 編成行 (タップでトグル)
function rosterRow(d, onClick) {
  const row = el("div", "tw-mrow" + (d.alive ? "" : " dead"));
  const s = el("span", "tw-chips");
  if (d.dominant) { s.style.color = SOUL_CLASSES[d.dominant.clsKey].glow; s.appendChild(spriteCanvas(soulSprite(d.dominant.clsKey), 2)); }
  row.appendChild(s);
  const info = el("div", "tw-chipi");
  info.appendChild(el("div", "tw-chipn", d.name + (d.alive ? "" : " †")));
  info.appendChild(el("div", "tw-chipc", d.isEmpty ? `空の人形 ・ 魂 ${dollSouls(d).length}/5` : `${d.cls} Lv${d.jobLv || 1}`));
  row.appendChild(info);
  row.appendChild(el("div", "tw-chiphp",
    d.isEmpty ? "編成不可" :
    d.alive ? `HP ${d.hp}/${d.maxhp}` : `⏳${fmtRemain(Math.max(0, (d.reviveAt || Date.now()) - Date.now()))}`));
  row.addEventListener("click", onClick);
  return row;
}

// 館サブ: 魂の強化・管理 (ストックの魂を一覧、Soulで鍛える)
function renderMansionEnhance() {
  townEl.appendChild(townHeader("魂強化", "mansion"));
  townEl.appendChild(el("div", "tw-lead", `✦${G.soulPts} Soul で、ストックの魂や人業に宿した魂を鍛えられる。`));

  // 宿している魂 (人業ごと)
  for (const d of allDolls()) {
    const souls = dollSouls(d);
    if (!souls.length) continue;
    townEl.appendChild(el("div", "tw-h", `${d.name} に宿した魂`));
    const list = el("div", "tw-soullist");
    for (const part of PARTS) {
      const s = d.parts[part];
      if (!s) continue;
      list.appendChild(soulEnhanceRow(s, () => { recalcDoll(d); d.hp = Math.min(d.hp, d.maxhp); }, d));
    }
    townEl.appendChild(list);
  }

  // ストックの魂
  townEl.appendChild(el("div", "tw-h", `魂ストック (${G.souls.length})`));
  const stock = el("div", "tw-soullist");
  if (!G.souls.length) stock.appendChild(el("div", "tw-empty", "ストックに魂がない。迷宮で集めよう。"));
  for (const s of G.souls) stock.appendChild(soulEnhanceRow(s, null));
  townEl.appendChild(stock);
}

// 魂1つの強化行 (ステータス + ✦で鍛える + 限界突破)。owner = 魂を宿している人業 (ストックなら null)
function soulEnhanceRow(s, afterLevel, owner) {
  const rank = SOUL_RANKS[s.rank] || SOUL_RANKS[1];
  const r = el("div", "tw-soulrow" + (rank.order >= 1 ? " rare" : ""));
  if (rank.color) r.style.borderColor = rank.color;
  const o = el("span", "tw-chips"); o.style.color = SOUL_CLASSES[s.clsKey].glow; o.appendChild(spriteCanvas(soulSprite(s.clsKey), 2));
  r.appendChild(o);
  const info = el("div", "tw-chipi");
  const nm = el("div", "tw-souln", soulName(s));
  if (rank.color) nm.style.color = rank.color;
  info.appendChild(nm);
  info.appendChild(el("div", "tw-soulst", `Lv ${s.level} / 上限 ${s.cap}`));
  // タップでステータスと強化時の伸びをポップアップ表示
  info.style.cursor = "pointer";
  info.addEventListener("click", () => { SFX.select(); showSoulInfo(s); });
  r.appendChild(info);

  const acts = el("div", "tw-soulacts");
  if (s.level < s.cap) {
    // 鍛える (Lv+1)
    const cost = soulTrainCost(s.level);
    const b = btn(`✦${cost}`, () => {
      if (G.soulPts < cost) { log("Soul が足りない。", "sys"); return; }
      const before = owner ? (owner.spells || []).slice() : null;
      G.soulPts -= cost; s.level++;
      if (afterLevel) afterLevel();
      SFX.levelup(); buzz([0, 30, 40, 30]);
      log(`${SOUL_CLASSES[s.clsKey].label}の魂が Lv${s.level} に成長した！`, "win");
      if (owner) notifyNewSkills(owner, before);
      renderTown();
    });
    b.className = "tw-small primary";
    if (G.soulPts < cost) b.disabled = true;
    acts.appendChild(b);
  } else if (s.cap < soulHardCap(s)) {
    info.children[1].textContent = `Lv ${s.level}（上限）`;
  }
  // 限界突破 (同部位・同職の魂を素材に上限+5)。押すと必要素材をポップアップで確認
  if (s.cap < soulHardCap(s)) {
    const need = breakthroughNeed(s);
    const have = fodderCount(s);
    const bb = btn(have >= need ? `限界突破 (魂×${need})` : `限界突破 (魂${have}/${need})`, () => askBreakthrough(s, afterLevel));
    bb.className = "tw-small";
    acts.appendChild(bb);
  } else {
    acts.appendChild(el("div", "tw-chiphp", "極"));
  }
  r.appendChild(acts);
  return r;
}

// 魂の詳細ポップアップ: 現在のステータスと、強化 (Lv+1) でどれだけ伸びるか
function showSoulInfo(s) {
  const cur = soulStats(s);
  const lines = [`Lv ${s.level} / 上限 ${s.cap}`, `現在: ${soulStatText(cur) || "—"}`];
  if (s.level < s.cap) {
    const nxt = soulStats({ ...s, level: s.level + 1 });
    const d = {};
    for (const k in cur) d[k] = Math.round((nxt[k] - cur[k]) * 10) / 10;
    lines.push(`✦${soulTrainCost(s.level)} で Lv${s.level + 1} に強化すると:`);
    lines.push(soulStatText(d) || "変化なし");
  } else if (s.cap < soulHardCap(s)) {
    lines.push("レベル上限に到達。限界突破でさらに鍛えられる。");
  } else {
    lines.push("極まった魂。これ以上は鍛えられない。");
  }
  const rank = SOUL_RANKS[s.rank] || SOUL_RANKS[1];
  showEvent({
    sprite: soulSprite(s.clsKey), title: soulName(s),
    accent: rank.color || SOUL_CLASSES[s.clsKey].glow,
    banner: "✦ 魂の力 ✦", btnLabel: "閉じる", lines,
  });
}

// 魂の成長で職業スキルが新たに解放されたら、お知らせポップアップを出す。
// before = 強化前の習得スキル一覧 (recalcDoll 済みの owner.spells と比較する)
function notifyNewSkills(d, before) {
  if (!before) return;
  const gained = (d.spells || []).filter((k) => !before.includes(k));
  if (gained.length) showSkillUnlockPopup(d, gained);
}

// 新スキル習得のお知らせカード: 使えるようになった技の名前と説明を一覧する
function showSkillUnlockPopup(d, keys) {
  const accent = "#ffcf4a";
  const wrap = el("div", "confirm-overlay");
  const card = el("div", "ig-card cdx-detail");
  card.style.borderColor = accent;
  card.style.boxShadow = `0 0 40px ${accent}55`;
  const ban = el("div", "ig-banner", "✦ 新スキル習得 ✦");
  ban.style.color = accent;
  card.appendChild(ban);
  const art = el("div", "ig-art");
  const spriteK = (d.jobKey ? d.jobKey.split("+")[0] : d.clsKey) || "fighter";
  art.appendChild(spriteCanvas(soulSprite(spriteK), 9));
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
  const ok = btn("閉じる", () => wrap.remove());
  ok.className = "btn primary ig-ok";
  card.appendChild(ok);
  wrap.appendChild(card);
  wrap.addEventListener("click", (e) => { if (e.target === wrap) wrap.remove(); });
  document.body.appendChild(wrap);
}

// 限界突破の確認ポップアップ: 必要な素材 (同部位・同職の魂) の種類と数を示す
function askBreakthrough(s, afterLevel) {
  const need = breakthroughNeed(s);
  const have = fodderCount(s);
  const matName = `${SOUL_CLASSES[s.clsKey].label}の魂（${PART_LABEL[s.part]}）`;
  const rank = SOUL_RANKS[s.rank] || SOUL_RANKS[1];
  const opts = [];
  if (have >= need) opts.push({ label: `🌟 突破する (魂×${need} を消費)`, fn: () => doBreakthrough(s, afterLevel) });
  opts.push({ label: have >= need ? "やめる" : "閉じる (素材が足りない)", fn: () => {} });
  showChoice(`${soulName(s)} の限界突破`, opts, soulSprite(s.clsKey), {
    banner: "🌟 限界突破 🌟", accent: rank.color || SOUL_CLASSES[s.clsKey].glow,
    lines: [
      `必要な素材: ${matName} × ${need}（ランク不問）`,
      `ストックの所持数: ${have} 個`,
      `成功するとレベル上限 +5（${s.cap} → ${Math.min(soulHardCap(s), s.cap + 5)}）`,
      "素材はレベルの低い魂から消費される。",
    ],
  });
}

// 限界突破に必要な素材(同部位・同職の魂)数。Lv/ランク/突破回数が高いほど増える
function breakthroughNeed(s) {
  const rank = SOUL_RANKS[s.rank] || SOUL_RANKS[1];
  const step = Math.floor((s.cap - rank.cap) / 5); // これまでの突破回数 (0始まり)
  return 1 + step + rank.order + Math.floor(s.level / 10);
}
// ストックにある「同部位・同職」の魂の数 (自分自身は除く)
function fodderCount(target) {
  return G.souls.filter((x) => x !== target && x.part === target.part && x.clsKey === target.clsKey).length;
}
function doBreakthrough(s, afterLevel) {
  const need = breakthroughNeed(s);
  const fodder = G.souls.filter((x) => x !== s && x.part === s.part && x.clsKey === s.clsKey);
  if (fodder.length < need) { log("素材の魂が足りない。", "sys"); return; }
  // 消費する魂を need 個取り除く (低Lvから消費)
  fodder.sort((a, b) => a.level - b.level);
  const consume = fodder.slice(0, need);
  for (const c of consume) { const i = G.souls.indexOf(c); if (i >= 0) G.souls.splice(i, 1); }
  s.cap = Math.min(soulHardCap(s), s.cap + 5);
  if (afterLevel) afterLevel();
  SFX.itemget(); buzz([0, 40, 50, 40]);
  log(`${soulName(s)} が限界突破！ レベル上限 ${s.cap} に。(魂 ${need} 個を消費)`, "win");
  showToast(`🌟 限界突破: 上限 Lv${s.cap}`);
  renderTown();
}

// 魂合成: 職業×部位 を選び、Soul と「空の魂」を払って Lv1(ランク1)の魂を作る
// 空の魂コストはレア度に依存: common=1, rare=5, epic=10, legend=20
const SOUL_SYNTH_SOUL_COST = 200;
const EMPTY_SOUL_ID = "emptySoul";
let synthSel = { clsKey: "fighter", part: "head" };
// パーティ全員の所持から「空の魂」の総数を数える
function emptySoulCount() { return allDolls().reduce((a, d) => a + d.items.filter((it) => it && it.id === EMPTY_SOUL_ID).length, 0); }
// 「空の魂」をN個消費 (誰かの所持から取り除く)。成功なら true
function consumeEmptySouls(n) {
  let rem = n;
  for (const d of allDolls()) {
    while (rem > 0) {
      const i = d.items.findIndex((it) => it && it.id === EMPTY_SOUL_ID);
      if (i < 0) break;
      d.items.splice(i, 1); rem--;
    }
    if (rem <= 0) return true;
  }
  return rem <= 0;
}
function renderMansionSynth() {
  townEl.appendChild(townHeader("魂合成", "mansion"));

  // 発見済み職業のみ選択可 (コモン6種は常に開放)
  const knownKeys = Object.keys(SOUL_CLASSES).filter((k) =>
    SOUL_CLASSES[k].rarity === "common" || (G.codex.job && G.codex.job[k]));
  if (!SOUL_CLASSES[synthSel.clsKey] || !knownKeys.includes(synthSel.clsKey)) synthSel.clsKey = knownKeys[0] || "fighter";

  const rarity = SOUL_CLASSES[synthSel.clsKey].rarity;
  const emptyCost = RARITY_SYNTH_COST[rarity];
  const rarityLabel = { common: "コモン", rare: "レア", epic: "エピック", legend: "レジェンド" }[rarity];
  townEl.appendChild(el("div", "tw-lead",
    `✦${SOUL_SYNTH_SOUL_COST} Soul と「空の魂」×${emptyCost} を捧げ、Lv1の魂を生む。\n所持: ✦${G.soulPts} ・ 空の魂 ${emptySoulCount()}個\n(R4以上はダンジョンでは入手不可。融合で作成)`));

  // 職業選択 (発見済みのみ)
  townEl.appendChild(el("div", "tw-h", "職業"));
  const cls = el("div", "tw-dolltabs");
  for (const k of knownKeys) {
    const b = btn(SOUL_CLASSES[k].label, () => { synthSel.clsKey = k; renderTown(); });
    b.className = "tw-dolltab" + (synthSel.clsKey === k ? " active" : "");
    b.style.borderColor = SOUL_CLASSES[k].color;
    cls.appendChild(b);
  }
  townEl.appendChild(cls);

  // レア度表示
  townEl.appendChild(el("div", "tw-h", `レア度: ${rarityLabel} (空の魂 ×${emptyCost})`));

  // 部位選択
  townEl.appendChild(el("div", "tw-h", "部位"));
  const prt = el("div", "tw-dolltabs");
  for (const p of PARTS) {
    const b = btn(PART_LABEL[p], () => { synthSel.part = p; renderTown(); });
    b.className = "tw-dolltab" + (synthSel.part === p ? " active" : "");
    prt.appendChild(b);
  }
  townEl.appendChild(prt);

  // プレビュー + 作成
  const preview = makeSoul(synthSel.clsKey, 1, synthSel.part, 1);
  const box = el("div", "tw-summary");
  box.style.borderColor = SOUL_CLASSES[synthSel.clsKey].color;
  box.appendChild(el("div", "tw-sumc", soulName(preview)));
  const st = soulStats(preview);
  box.appendChild(el("div", "tw-sumst", soulStatText(st)));
  townEl.appendChild(box);

  const canMake = G.soulPts >= SOUL_SYNTH_SOUL_COST && emptySoulCount() >= emptyCost;
  const mk = btn(`🌀 魂を作る (✦${SOUL_SYNTH_SOUL_COST} + 空の魂×${emptyCost})`, () => {
    if (G.soulPts < SOUL_SYNTH_SOUL_COST) { log("Soul が足りない。", "sys"); return; }
    if (!consumeEmptySouls(emptyCost)) { log(`「空の魂」が ${emptyCost} 個必要。ダンジョンで探そう。`, "sys"); return; }
    G.soulPts -= SOUL_SYNTH_SOUL_COST;
    const s = makeSoul(synthSel.clsKey, 1, synthSel.part, 1);
    G.souls.push(s);
    SFX.itemget(); buzz([0, 30, 60, 30]);
    log(`${soulName(s)} を合成した。`, "win");
    showToast(`🌀 ${soulName(s)} を作成`);
    renderTown();
  });
  mk.className = "btn primary tw-add";
  if (!canMake) mk.disabled = true;
  townEl.appendChild(mk);
}

// 魂融合: 同じ職業・部位・ランクの魂を2つ選んで融合。ランクアップ or ランク5強化
let fuseSel = [null, null]; // 選択中の魂インデックス (G.souls[] のインデックス)
function renderMansionFuse() {
  townEl.appendChild(townHeader("魂融合", "mansion"));
  townEl.appendChild(el("div", "tw-lead",
    "同じ職業・部位・ランクで、どちらもLvMaxの魂を2つ融合する。\nランク1-4: ランクが1つ上昇。ランク5: ステータス強化(+1)。"));

  // ストックの魂一覧
  const list = el("div", "tw-soullist");
  if (!G.souls.length) {
    list.appendChild(el("div", "tw-empty", "ストックに魂がない。"));
  } else {
    G.souls.forEach((s, idx) => {
      const rank = SOUL_RANKS[s.rank] || SOUL_RANKS[1];
      const atMax = s.level >= s.cap;
      const sel = fuseSel[0] === idx || fuseSel[1] === idx;
      const r = el("div", "tw-soulrow" + (sel ? " selected" : "") + (rank.order >= 1 ? " rare" : ""));
      if (rank.color) r.style.borderColor = rank.color;
      if (sel) r.style.outline = "2px solid #ffcf4a";
      const o = el("span", "tw-chips"); o.style.color = SOUL_CLASSES[s.clsKey] ? SOUL_CLASSES[s.clsKey].glow : "#fff";
      o.appendChild(spriteCanvas(soulSprite(s.clsKey), 2));
      r.appendChild(o);
      const info = el("div", "tw-chipi");
      const nm = el("div", "tw-souln", soulName(s)); if (rank.color) nm.style.color = rank.color;
      info.appendChild(nm);
      info.appendChild(el("div", "tw-soulst", atMax ? "✓ Lv MAX" : `Lv ${s.level}/${s.cap} (Max未到達)`));
      r.appendChild(info);
      const b = btn(sel ? "✓ 選択中" : "選ぶ", () => {
        if (fuseSel[0] === idx) { fuseSel[0] = null; }
        else if (fuseSel[1] === idx) { fuseSel[1] = null; }
        else if (fuseSel[0] === null) { fuseSel[0] = idx; }
        else if (fuseSel[1] === null) { fuseSel[1] = idx; }
        else { fuseSel[0] = fuseSel[1]; fuseSel[1] = idx; }
        renderTown();
      });
      b.className = "tw-small" + (sel ? " primary" : "");
      r.appendChild(b);
      list.appendChild(r);
    });
  }
  townEl.appendChild(list);

  // 融合ボタン
  const canFuse = fuseSel[0] !== null && fuseSel[1] !== null && fuseSel[0] !== fuseSel[1];
  const fuseBtn = btn("⚗ 融合する", () => {
    const s1 = G.souls[fuseSel[0]];
    const s2 = G.souls[fuseSel[1]];
    const result = fuseSouls(s1, s2);
    if (!result) {
      log("この2つは融合できない。(同じ職業・部位・ランク・Lv MAXが必要)", "sys"); return;
    }
    // 素材の2体をストックから除去
    const idxs = [fuseSel[0], fuseSel[1]].sort((a, b) => b - a);
    for (const i of idxs) G.souls.splice(i, 1);
    // 部位に宿っていた場合は外す (融合不可だが念のため)
    G.souls.push(result.soul);
    fuseSel = [null, null];
    SFX.itemget(); buzz([0, 40, 60, 40, 60, 200]);
    if (result.type === "rankup") {
      const rk = SOUL_RANKS[result.soul.rank] || SOUL_RANKS[1];
      log(`魂が融合し、${soulName(result.soul)} になった！`, "win");
      flashScreen(rk.color || "#7fd0ff");
      showToast(`⚗ ランクアップ！ ${soulName(result.soul)}`);
    } else {
      log(`${soulName(result.soul)} のステータスが強化された！ (${result.soul.fusionBonus} 回)`, "win");
      flashScreen("#ffcf4a");
      showToast(`⚗ 強化！ +${result.soul.fusionBonus}`);
    }
    renderTown();
  });
  fuseBtn.className = "btn primary tw-add";
  if (!canFuse) fuseBtn.disabled = true;
  townEl.appendChild(fuseBtn);
}

// その魂を現Lvまで鍛えるのに要した Soul の総量 (各Lvの強化費 × ランク係数)
function soulInvested(s) {
  let total = 20; // 基礎価値
  for (let lv = 1; lv < s.level; lv++) total += soulTrainCost(lv);
  total = Math.round(total * ((SOUL_RANKS[s.rank] || SOUL_RANKS[1]).mul));
  return total;
}
// 分解で得られる Soul (投入量の半分)
function soulBreakRefund(s) { return Math.max(1, Math.floor(soulInvested(s) / 2)); }

// 魂分解: ストックの魂を砕いて Soul を得る (Lvが高いほど多い)
function renderMansionBreak() {
  townEl.appendChild(townHeader("魂分解", "mansion"));
  townEl.appendChild(el("div", "tw-lead", "ストックの魂を砕いて Soul を取り戻す。レベルが高い魂ほど多く得られる。"));
  const list = el("div", "tw-soullist");
  if (!G.souls.length) list.appendChild(el("div", "tw-empty", "ストックに魂がない。(宿している魂は外してから)"));
  G.souls.forEach((s) => {
    const rank = SOUL_RANKS[s.rank] || SOUL_RANKS[1];
    const r = el("div", "tw-soulrow" + (rank.order >= 1 ? " rare" : ""));
    if (rank.color) r.style.borderColor = rank.color;
    const o = el("span", "tw-chips"); o.style.color = SOUL_CLASSES[s.clsKey].glow; o.appendChild(spriteCanvas(soulSprite(s.clsKey), 2));
    r.appendChild(o);
    const info = el("div", "tw-chipi");
    const nm = el("div", "tw-souln", soulName(s)); if (rank.color) nm.style.color = rank.color;
    info.appendChild(nm);
    info.appendChild(el("div", "tw-soulst", `分解で ✦${soulBreakRefund(s)} を得る`));
    r.appendChild(info);
    const b = btn(`💥 分解`, () => confirmBreakSoul(s));
    b.className = "tw-small danger";
    r.appendChild(b);
    list.appendChild(r);
  });
  townEl.appendChild(list);
}

function confirmBreakSoul(s) {
  const refund = soulBreakRefund(s);
  showConfirm({
    title: `${soulName(s)} を分解する？`,
    lines: [`✦${refund} Soul を得る。`, "分解した魂は戻らない。"],
    okLabel: "💥 分解する",
    onOk: () => {
      const i = G.souls.indexOf(s);
      if (i < 0) return;
      G.souls.splice(i, 1);
      G.soulPts += refund;
      SFX.crit(); buzz([0, 40, 40, 40]);
      log(`${soulName(s)} を分解し ✦${refund} を得た。`, "win");
      renderTown();
    },
  });
}

// 館サブ: 人業の作成・管理 (購入・解体)
function renderMansionManage() {
  townEl.appendChild(townHeader("人業 作成 / 管理", "mansion"));
  townEl.appendChild(el("div", "tw-lead", "空の人業を仕立て、不要な人業は解体して魂を回収できる。"));

  const list = el("div", "tw-mlist");
  allDolls().forEach((d) => {
    const inParty = G.party.includes(d);
    const row = el("div", "tw-mrow" + (d.alive ? "" : " dead"));
    const s = el("span", "tw-chips");
    if (d.dominant) { s.style.color = SOUL_CLASSES[d.dominant.clsKey].glow; s.appendChild(spriteCanvas(soulSprite(d.dominant.clsKey), 2)); }
    row.appendChild(s);
    const info = el("div", "tw-chipi");
    info.appendChild(el("div", "tw-chipn", d.name + (d.alive ? "" : " †") + (d.isEmpty ? "（未生成）" : inParty ? "" : " (控え)")));
    info.appendChild(el("div", "tw-chipc", d.isEmpty
      ? `魂 ${dollSouls(d).length}/5 — 5部位に宿すと人業として生成できる`
      : `${d.cls} Lv${d.jobLv || 1} ・ 魂 ${dollSouls(d).length}/5`));
    row.appendChild(info);
    const ren = btn("名前を変える", () => showRenameInput(d));
    ren.className = "tw-small";
    row.appendChild(ren);
    list.appendChild(row);
  });
  townEl.appendChild(list);

  const cost = emptyDollCost();
  const add = btn(`＋ 空の人業を購入 (🔴${cost})`, () => buyEmptyDoll());
  add.className = "btn tw-add";
  if (G.redSoul < cost) add.disabled = true;
  townEl.appendChild(add);
  townEl.appendChild(el("div", "tw-note",
    `空の人業: 1体目 🔴30 / 2体目 🔴50 / 3体目以降 🔴100`));
}

// 空の人業の価格 (購入回数で段階的に上昇)
function emptyDollCost() {
  const n = G.dollsPurchased;
  return n === 0 ? 30 : n === 1 ? 50 : 100;
}

function buyEmptyDoll() {
  const cost = emptyDollCost();
  if (G.redSoul < cost) { log("Red Soul が足りない。", "sys"); return; }
  if (G.reserve.length >= 12) { log("控えが満員で、これ以上は仕立てられない。", "sys"); return; }
  G.redSoul -= cost;
  G.dollsPurchased++;
  // 購入した器は「空の人形」として控えに残る (消えない)。
  // 5部位に魂を宿して生成するまでパーティ編成はできない。
  const d = makeDoll("空の人形");
  d.isEmpty = true;
  recalcDoll(d);
  d.hp = d.maxhp; d.mp = d.maxmp;
  G.reserve.push(d);
  SFX.itemget(); buzz([0, 30, 60, 30]);
  log(`空の人業を購入した (🔴${cost})。5部位に魂を宿して生成しよう。`, "win");
  altarSel = { doll: d, part: null };
  G.town.facility = "mansion"; G.town.sub = "altar";
  autosave(true);
  renderTown();
}

function confirmDisband(d) {
  const lines = ["宿した魂はストックに戻る。", "装備していた品も外れる。"];
  showConfirm({
    title: `${d.name} を解体する？`,
    lines,
    okLabel: "🔨 解体する",
    onOk: () => {
      // 魂をストックへ返す
      for (const part of PARTS) { if (d.parts[part]) { G.souls.push(d.parts[part]); d.parts[part] = null; } }
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
function showNameInput({ title, desc, placeholder, defaultValue = "", confirmLabel = "決定", onConfirm }) {
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
  const list = el("div", "ig-choices");
  const okBtn = btn(confirmLabel, () => {
    const name = inp.value.trim();
    if (!name) { inp.focus(); return; }
    wrap.remove();
    onConfirm(name);
  });
  okBtn.classList.add("primary");
  list.appendChild(okBtn);
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

// 5部位封印完了→人業生成ポップアップ
function showGenerateDollPopup(d) {
  showNameInput({
    title: "人業を生成しますか？",
    desc: "五つの魂が揃い、人業が目覚めようとしている。名前を与えよ。",
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

// ---- 魂を宿す間 (人業の館の奥): 5部位に魂を宿す ----
function renderAltar() {
  const dolls = allDolls();
  if (!altarSel || !dolls.includes(altarSel.doll)) altarSel = { doll: dolls[0] || null, part: null };
  if (!dolls.length) { townEl.appendChild(townHeader("魂を宿す間", "mansion")); townEl.appendChild(el("div", "tw-empty", "人業がいない。")); return; }
  const d = altarSel.doll;

  townEl.appendChild(townHeader("魂を宿す間", "mansion"));

  // 人業セレクタ
  const sel = el("div", "tw-dolltabs");
  dolls.forEach((dd) => {
    const label = dd.isEmpty ? `${dd.name}（未生成）` : dd.name;
    const t = btn(label, () => { altarSel = { doll: dd, part: null }; renderTown(); });
    t.className = "tw-dolltab" + (dd === d ? " active" : "") + (dd.isEmpty ? " pending" : "");
    sel.appendChild(t);
  });
  townEl.appendChild(sel);

  // 空の人形: 5部位すべて揃えば生成できる (揃うまでは編成不可のまま控えに残る)
  if (d.isEmpty) {
    if (PARTS.every((p) => d.parts[p])) {
      const gen = btn("✦ 人業を生成する (名前を与える)", () => showGenerateDollPopup(d));
      gen.className = "btn primary tw-add";
      townEl.appendChild(gen);
    } else {
      townEl.appendChild(el("div", "tw-note",
        `空の人形 — 魂 ${dollSouls(d).length}/5。5部位すべてに魂を宿すと人業として生成され、パーティに編成できるようになる。`));
    }
  }

  // 職業・スキル サマリ (クリックで職業図鑑ポップアップ)
  const sum = el("div", "tw-summary");
  const dom = d.dominant;
  sum.style.borderColor = dom ? SOUL_CLASSES[dom.clsKey].color : "#34344a";
  if (d.jobKey) {
    sum.style.cursor = "pointer";
    sum.title = "職業図鑑を表示";
    sum.addEventListener("click", () => showCodexJobDetail(d.jobKey, d.jobRank));
  }
  sum.appendChild(el("div", "tw-sumc", d.cls));
  const tierTxt = d.jobRank
    ? `キャラLv ${d.jobLv || 0}（魂の平均・スキル解放 Lv${d.jobRank * 10} まで）`
    : "同職3部位未満 — 職業未発現";
  sum.appendChild(el("div", "tw-sumt", tierTxt));
  sum.appendChild(el("div", "tw-sumst",
    `HP${d.maxhp} MP${d.maxmp} ATK${d.atk} VIT${d.vit} AGI${d.agi} INT${d.int} PIE${d.pie} LUK${d.luk}`));
  if (d.spells.length) { const sk = skillChips(d.spells, "習得:"); sk.classList.add("tw-sumsk"); sum.appendChild(sk); }
  if (d.passives.length) sum.appendChild(el("div", "tw-sumsk", d.passives.join(" / ")));
  if (d.jobKey) sum.appendChild(el("div", "tw-sumhint", "▶ 職業図鑑"));
  townEl.appendChild(sum);

  // 5部位
  const body = el("div", "tw-parts");
  for (const part of PARTS) {
    const slot = el("div", "tw-part" + (altarSel.part === part ? " sel" : ""));
    slot.appendChild(el("div", "tw-partl", PART_LABEL[part]));
    const soul = d.parts[part];
    const orb = el("div", "tw-partorb");
    if (soul) {
      orb.style.color = SOUL_CLASSES[soul.clsKey].glow;
      orb.appendChild(spriteCanvas(soulSprite(soul.clsKey), 3));
      slot.appendChild(orb);
      const p2 = el("div", "tw-parts2", `${SOUL_CLASSES[soul.clsKey].label}Lv${soul.level}`);
      const rkc = (SOUL_RANKS[soul.rank] || SOUL_RANKS[1]).color;
      if (rkc) p2.style.color = rkc;
      slot.appendChild(p2);
    } else {
      orb.appendChild(el("div", "tw-partempty", "空"));
      slot.appendChild(orb);
      slot.appendChild(el("div", "tw-parts2", "—"));
    }
    slot.addEventListener("click", () => {
      altarSel = { doll: d, part: altarSel.part === part ? null : part };
      renderTown();
    });
    body.appendChild(slot);
  }
  townEl.appendChild(body);

  // 選択した部位への操作 (取り外し / ストックから封印)
  if (altarSel.part) {
    const part = altarSel.part;
    const cur = d.parts[part];
    // 宿している魂は Soul を使って鍛えられる
    if (cur) {
      townEl.appendChild(el("div", "tw-h", `「${PART_LABEL[part]}」の魂を鍛える`));
      const trainBox = el("div", "tw-trainbox");
      const curSt = soulStats(cur);
      if (cur.level >= cur.cap) {
        trainBox.appendChild(el("div", "tw-trainn", soulName(cur)));
        trainBox.appendChild(el("div", "tw-soulst", soulStatText(curSt)));
        trainBox.appendChild(el("div", "tw-note", `上限 Lv${cur.cap}。館の「魂強化」で限界突破を。`));
      } else {
        const tc = soulTrainCost(cur.level);
        const nextSt = soulStats({ ...cur, level: cur.level + 1 });
        const _stKeys = ["hp", "mp", "atk", "vit", "agi", "int", "pie", "luk"];
        const _stLbl = { hp: "HP", mp: "MP", atk: "ATK", vit: "VIT", agi: "AGI", int: "INT", pie: "PIE", luk: "LUK" };
        const deltaStr = _stKeys
          .filter((k) => (nextSt[k] || 0) - (curSt[k] || 0) > 0.001)
          .map((k) => `${_stLbl[k]}+${Math.round(((nextSt[k] || 0) - (curSt[k] || 0)) * 10) / 10}`)
          .join(" ");
        trainBox.appendChild(el("div", "tw-trainn", `${soulName(cur)}　Lv${cur.level} → Lv${cur.level + 1}`));
        trainBox.appendChild(el("div", "tw-soulst", soulStatText(curSt)));
        if (deltaStr) trainBox.appendChild(el("div", "tw-souldn", `↑ ${deltaStr}`));
        const tb = btn(`✦ Soul ${tc} で鍛える`, () => trainSoul(d, part));
        tb.className = "tw-small primary";
        if (G.soulPts < tc) tb.disabled = true;
        trainBox.appendChild(tb);
      }
      townEl.appendChild(trainBox);
      const un = btn(`${PART_LABEL[part]} の魂を外す`, () => {
        G.souls.push(d.parts[part]); d.parts[part] = null; recalcDoll(d); d.hp = Math.min(d.hp, d.maxhp); SFX.select(); renderTown();
      });
      un.className = "btn danger tw-un";
      townEl.appendChild(un);
    }
    townEl.appendChild(el("div", "tw-h", `「${PART_LABEL[part]}」に宿す魂を選ぶ`));
    const stock = el("div", "tw-soullist");
    // 魂は対応する部位にしか宿せない
    const candidates = G.souls
      .map((s, si) => ({ s, si }))
      .filter(({ s }) => (s.part || "head") === part);
    if (!candidates.length) stock.appendChild(el("div", "tw-empty", `この部位の魂がない。迷宮で（${PART_LABEL[part]}）の魂を探そう。`));
    for (const { s, si } of candidates) {
      const rank = SOUL_RANKS[s.rank] || SOUL_RANKS[1];
      const r = el("div", "tw-soulrow" + (rank.order >= 1 ? " rare" : ""));
      if (rank.color) r.style.borderColor = rank.color;
      const o = el("span", "tw-chips"); o.style.color = SOUL_CLASSES[s.clsKey].glow; o.appendChild(spriteCanvas(soulSprite(s.clsKey), 2));
      r.appendChild(o);
      const info = el("div", "tw-chipi");
      const nm = el("div", "tw-souln", soulName(s));
      if (rank.color) nm.style.color = rank.color;
      info.appendChild(nm);
      const st = soulStats(s);
      info.appendChild(el("div", "tw-soulst", soulStatText(st)));
      r.appendChild(info);
      r.addEventListener("click", () => sealFromStock(d, part, si));
      stock.appendChild(r);
    }
    townEl.appendChild(stock);
  } else {
    townEl.appendChild(el("div", "tw-note", "部位をタップして、宿す魂を選ぶ。"));
  }
}

function sealFromStock(d, part, stockIdx) {
  const s = G.souls[stockIdx];
  if (!s) return;
  // 既存の魂はストックへ戻す
  if (d.parts[part]) G.souls.push(d.parts[part]);
  G.souls.splice(stockIdx, 1);
  sealSoul(d, part, s);
  d.hp = Math.min(d.hp, d.maxhp); d.mp = Math.min(d.mp, d.maxmp);
  SFX.select(); buzz(15);
  log(`${PART_LABEL[part]}に ${soulName(s)} を宿した。`, "win");
  // 空の人形: 5部位すべて揃ったら生成ポップアップ
  if (d.isEmpty && PARTS.every(p => d.parts[p])) {
    showGenerateDollPopup(d);
    return;
  }
  renderTown();
}

// 魂を1レベル上げるのに要する Soul (レベルが高いほど高い)
function soulTrainCost(level) { return 15 + level * 12; }

function trainSoul(d, part) {
  const s = d.parts[part];
  if (!s || s.level >= s.cap) return;
  const cost = soulTrainCost(s.level);
  if (G.soulPts < cost) { log("Soul が足りない。", "sys"); return; }
  const before = (d.spells || []).slice();
  G.soulPts -= cost;
  s.level++;
  recalcDoll(d);
  d.hp = Math.min(d.hp, d.maxhp);
  SFX.levelup(); buzz([0, 30, 40, 30]);
  log(`${SOUL_CLASSES[s.clsKey].label}の魂が Lv${s.level} に成長した！ (✦${cost})`, "win");
  notifyNewSkills(d, before);
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
    // サブクエストは「その迷宮 (と、指定があればその階)」でのみ進む
    if (q.dunIdx != null && G.dungeonIdx !== q.dunIdx) continue;
    if (q.floorReq != null && G.floor !== q.floorReq) continue;
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
    const undiscovered = Object.keys(HYBRIDS).filter((k) => !(G.codex.job && G.codex.job[k]));
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
  townEl.appendChild(el("div", "tw-lead", "迷宮帰りの傭兵がたむろする。依頼の受注と噂話はここで。(編成は人業の館)"));

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

  // --- 酒場の依頼人 (サブクエスト): 選択中の迷宮の階ごとに1件 ---
  const sdn = curDungeon();
  townEl.appendChild(el("div", "tw-h", `酒場の依頼人 — ${sdn.name}`));
  townEl.appendChild(el("div", "tw-note", "選んだ迷宮の階ごとに、事情を抱えた誰かが待っている。果たした依頼は酒場から消える。"));
  const sql = el("div", "tw-mlist");
  for (const def of dungeonSubQuests(G.dungeonIdx)) {
    const st = G.subQuests[def.id];
    if (st && st.state === "claimed") continue;
    const row = el("div", "tw-quest" + (st && st.state === "done" ? " done" : ""));
    const info = el("div", "tw-chipi");
    info.appendChild(el("div", "tw-chipn", `🕯 B${def.floor}F 「${def.name}」`));
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
  if (![...sql.children].length) sql.appendChild(el("div", "tw-empty", "この迷宮の依頼は、すべて果たされた。"));
  townEl.appendChild(sql);
}

function claimQuest(q) {
  q.state = "claimed";
  G.gold += q.reward.gold;
  let msg = `報酬 💰${q.reward.gold}`;
  if (q.reward.soulPts) { G.soulPts += q.reward.soulPts; msg += ` ✦${q.reward.soulPts}`; }
  if (q.reward.redSoul) { G.redSoul += q.reward.redSoul; msg += ` 🔴${q.reward.redSoul}`; }
  if (q.reward.soul) {
    const s = makeSoul(q.reward.soul, 2);
    G.souls.push(s);
    msg += ` と ${soulName(s)}`;
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
  const allSouls = () => {
    const out = [...(G.souls || [])];
    for (const d of allDolls()) if (d.parts) for (const p of PARTS) if (d.parts[p]) out.push(d.parts[p]);
    return out;
  };
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
    (v) => `${v === 4 ? "ランク5の" : "ランク2以上の"}魂を手に入れる`, (v) => allSouls().some((s) => (SOUL_RANKS[s.rank] || SOUL_RANKS[1]).order >= v));

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
// 章テキスト/報酬は story.js (10幕構成・各章=迷宮1つ)。
// G.msq = { n: 章 (1-100), state: "active"(攻略中) | "report"(報告可) | "offer"(次章待ち) | "end" }

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
  showStoryScene(`第${n}章 完遂`, msqReportLines(n), rwText, () => {
    G.gold += r.gold;
    G.soulPts += r.soulPts;
    G.redSoul += r.redSoul || 0;
    SFX.itemget(); buzz([0, 30, 60, 30]);
    log(`勅命「第${n}章」の完遂を報告した。`, "win");
    updateTopbar();
    if (n >= 100) {
      G.msq = { n: 101, state: "end" };
      flashScreen("#ffd84a");
      setTimeout(() => showStoryScene("終章 — 最後の魂繰り", EPILOGUE, null, () => renderTown(), "物語を閉じる"), 400);
      return;
    }
    autosave(true);
    acceptMainQuest(); // 踏破報告と同時に次の勅命を自動拝命
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
  showStoryScene(`第${ms.n}章 「${ACTS[actOf(ms.n) - 1].title}」`, msqOrderLines(ms.n), null, () => {
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
  "「先代の魂繰りが遺した人業が三体、武具庫で埃を被っておる。見習いの魂が入ったままだがな。──くれてやろう。」",
  "「それと赤い魂を百。先日回収された盗賊の魂を五つ──頭、両の腕、胴、足の分だ。」",
  "「人業の館へゆけ。空の器を仕立て、五つの魂を封じ、四体目の同胞をおのれの手で生み出すのだ。」",
  "「それがそなたの最初の勅命である。果たしたら、戻って報告せよ。」",
];
const TUT_FINALE = [
  "「…ほう。良い面構えの人業ではないか。初仕事にしては上出来よ。」",
  "「覚えておけ、魂繰り。人業は道具ではない。死者に与えられた、二度目の生だ。」",
  "「粗末に扱えば、魂は器の中で錆びる。労り、鍛え、共に深淵を渡れ。」",
  "「これでそなたも一人前。次は、まことの勅命を授けよう。」",
];

// 着任の謁見: 見習いの人業3体 + 赤い魂100 + 盗賊の魂×5部位 を下賜する
function grantTutorialGift() {
  const ms = G.msq;
  if (!ms || ms.granted) return;
  ms.granted = true;
  const mk = (name, clsKey, gear) => {
    const d = makeDoll(name);
    for (const p of PARTS) d.parts[p] = makeSoul(clsKey, 1, p);
    for (const id of gear) {
      const it = cloneItem(id);
      if (it) { d.items.push(it); equipItem(d, it); codexSeeItem(id); }
    }
    d.items.push(cloneItem("herb")); codexSeeItem("herb");
    recalcDoll(d);
    d.hp = d.maxhp; d.mp = d.maxmp;
    G.party.push(d);
  };
  mk("ガルド", "fighter", ["shortSword", "leatherArmor"]);
  mk("セリア", "priest", ["warHammer", "cap"]);
  mk("ゼノ", "mage", ["magicStaff", "robe"]);
  G.redSoul += 100;
  for (const p of PARTS) G.souls.push(makeSoul("thief", 1, p));
  codexSweepJobs();
  SFX.itemget(); buzz([0, 30, 60, 30]);
  log("見習いの人業3体・🔴100・盗賊の魂×5 を拝受した。", "win");
  showToast("👑 人業3体と赤い魂を拝受した");
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
  if (ms.n === 0 && ms.state === "active") return !ms.granted || allDolls().filter((d) => !d.isEmpty).length >= 4;
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
        showStoryScene("勅命 「人業の生成」", TUT_INTRO, "下賜: 見習いの人業3体 + 🔴100 + 盗賊の魂×5", () => grantTutorialGift()));
      b.className = "btn tw-add tw-msq";
      townEl.appendChild(b);
    } else if (allDolls().filter((d) => !d.isEmpty).length >= 4) {
      const b = btn("👑 報告する — 「人業の生成」完遂", () => reportTutorialQuest());
      b.className = "btn tw-add tw-msq";
      townEl.appendChild(b);
    } else {
      const box = el("div", "tw-rumor");
      box.appendChild(el("div", "tw-rumors", "勅命 「人業の生成」"));
      box.appendChild(el("div", "tw-rumort", "人業の館で空の人業を仕立て (🔴30)、盗賊の魂を五部位に封じよ。"));
      box.appendChild(el("div", "tw-note", "4体目の人業が立ち上がったら、王宮へ戻り報告せよ。"));
      townEl.appendChild(box);
      const re = btn("👑 勅命を聞き直す", () => showStoryScene("勅命 「人業の生成」", TUT_INTRO, null, null));
      re.className = "btn tw-add";
      townEl.appendChild(re);
    }
  } else if (ms.state === "active") {
    const tdn = DUNGEONS[ms.n - 1];
    const box = el("div", "tw-rumor");
    box.appendChild(el("div", "tw-rumors", `第${ms.n}章 「${ACTS[actOf(ms.n) - 1].title}」`));
    box.appendChild(el("div", "tw-rumort", `勅命: 「${tdn.name}」を踏破し、その主を討て。`));
    box.appendChild(el("div", "tw-note", "果たしたら王宮へ戻り、報告せよ。"));
    townEl.appendChild(box);
    const re = btn("👑 勅命を聞き直す", () => showStoryScene(`第${ms.n}章 「${ACTS[actOf(ms.n) - 1].title}」`, msqOrderLines(ms.n), null, null));
    re.className = "btn tw-add";
    townEl.appendChild(re);
  } else if (ms.state === "report") {
    const b = btn(`👑 報告する — 「${DUNGEONS[ms.n - 1].name}」踏破`, () => reportMainQuest());
    b.className = "btn tw-add tw-msq";
    townEl.appendChild(b);
  } else if (ms.state === "offer") {
    const b = btn(`👑 謁見する — 新たな勅命 (第${ms.n + 1}章)`, () => acceptMainQuest());
    b.className = "btn tw-add tw-msq";
    townEl.appendChild(b);
  }

  // 図鑑
  townEl.appendChild(el("div", "tw-h", "王宮書庫 — 図鑑"));
  const row = el("div", "tw-grid");
  const itemBtn = el("div", "tw-fac");
  itemBtn.appendChild(el("div", "tw-faci", "⚔"));
  itemBtn.appendChild(el("div", "tw-facn", "アイテム図鑑"));
  itemBtn.appendChild(el("div", "tw-facd", `発見 ${Object.keys(G.codex.item).length} 種`));
  itemBtn.addEventListener("click", () => { G.town.facility = "codexItem"; renderCodexItem(); });
  row.appendChild(itemBtn);
  const dunBtn = el("div", "tw-fac");
  dunBtn.appendChild(el("div", "tw-faci", "🐉"));
  dunBtn.appendChild(el("div", "tw-facn", "モンスター図鑑"));
  dunBtn.appendChild(el("div", "tw-facd", `発見 ${Object.keys(G.codex.mon).filter((k) => MONSTERS[k]).length} 種`));
  dunBtn.addEventListener("click", () => { G.town.facility = "codexDungeon"; renderCodexDungeon(); });
  row.appendChild(dunBtn);
  const jobBtn = el("div", "tw-fac");
  jobBtn.appendChild(el("div", "tw-faci", "📜"));
  jobBtn.appendChild(el("div", "tw-facn", "職業図鑑"));
  jobBtn.appendChild(el("div", "tw-facd", `発現 ${Object.keys(G.codex.job).filter((k) => SOUL_CLASSES[k]).length} 種`));
  jobBtn.addEventListener("click", () => { G.town.facility = "codexJob"; renderCodexJob(); });
  row.appendChild(jobBtn);
  townEl.appendChild(row);

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
  recRow("踏破した迷宮", `${clearedDungeonCount()} / ${DUNGEONS.length}`);
  townEl.appendChild(rec);

  // 勲章 (実績): 一覧は別室「勲章の間」へ。受領できる勲章があれば印を出す
  const claimable = ACHIEVEMENTS.filter((a) => !G.ach[a.id] && a.cond()).length;
  townEl.appendChild(el("div", "tw-h", "王の勲章 — 実績"));
  const arow = el("div", "tw-grid");
  const achBtn = el("div", "tw-fac");
  achBtn.appendChild(el("div", "tw-faci", "🏅"));
  achBtn.appendChild(el("div", "tw-facn", "勲章の間"));
  achBtn.appendChild(el("div", "tw-facd", `受領 ${Object.keys(G.ach).length} / ${ACHIEVEMENTS.length}`));
  if (claimable) achBtn.appendChild(el("div", "tw-facb", `❗ 受領可 ${claimable}`));
  achBtn.addEventListener("click", () => { G.town.facility = "codexAch"; renderCodexAch(); });
  arow.appendChild(achBtn);
  townEl.appendChild(arow);
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
// 撃破時の戦利品抽選 (通常30% / レア4%)。ここでは抽選のみで、
// 実物は勝利後の宝箱から取り出す (giveDropsFromChest)
function rollMonsterDrop(enemy) {
  const mon = MONSTERS[enemy.key];
  if (!mon) return null;
  let dropId = null, rare = false;
  const ap = partyPassiveLv("appraise") ? 1.15 : 1; // 目利き: ドロップ率+15%
  if (mon.dropRare && Math.random() < 0.04 * ap) { dropId = mon.dropRare; rare = true; }
  else if (mon.dropNormal && Math.random() < 0.30 * ap) { dropId = mon.dropNormal; rare = false; }
  if (!dropId) return null;
  const it = cloneItem(dropId);
  if (!it) return null;
  return { key: enemy.key, name: enemy.name, id: dropId, item: it, rare };
}
function codexSeeItem(id) { if (id) G.codex.item[id] = true; }

// ---- 職業図鑑の記録 ----
// 人業に職業が発現した時点で「発見」とし、スキル解放の
// 到達レベル (ランク上限でキャップしたキャラLv = 宿した魂の平均レベル) の
// 最高値を {lv} に、到達した職業ランクの最高値を {rank} に記録する。
// 図鑑はランク別に称号を列挙し、スキル表は到達Lvまでの技だけ内容を開示する。
function codexSeeJobs(doll) {
  if (!doll || !doll.parts) return;
  const rec = (key, lv, rank) => {
    const e = G.codex.job[key];
    const prevLv = e && typeof e === "object" ? (e.lv || 0) : 0;
    const prevRank = e && typeof e === "object" ? (e.rank || 0) : 0;
    G.codex.job[key] = { lv: Math.max(prevLv, lv), rank: Math.max(prevRank, rank) };
  };
  const jr = jobRankOf(doll);
  if (!jr) return;
  const lv = Math.min(jr.rank * 10, charLevelOf(doll));
  rec(jr.clsKey, lv, jr.rank);
  const counts = {};
  for (const p of PARTS) { const s = doll.parts[p]; if (s) counts[s.clsKey] = (counts[s.clsKey] || 0) + 1; }
  const hy = findHybrid(counts);
  if (hy) rec(hy.key, lv, jr.rank);
}
// 全人業を走査して職業図鑑を更新する。封印・強化の経路が多岐にわたるため、
// 個別フックではなくオートセーブのたびに全走査する (件数は僅少)。
function codexSweepJobs() {
  if (!G.codex || !G.codex.job) return;
  for (const d of [...(G.party || []), ...(G.reserve || [])]) codexSeeJobs(d);
}

let codexItemTab = "weapon"; // アイテム図鑑の選択中タブ (分類)
let codexWeaponCat = "all";  // 武器タブのサブカテゴリ (長剣/短剣/弓/杖…)

function renderCodexItem() {
  townEl.innerHTML = "";
  townEl.appendChild(townHeader("アイテム図鑑", "palace"));
  const seenIds = Object.keys(G.codex.item).filter((id) => ITEMS[id]);
  townEl.appendChild(el("div", "tw-note", `発見済み ${seenIds.length} 種`));

  // 分類タブ (商店と同じ区分 + その他/貴重品)
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
  const grid = el("div", "cdx-grid");
  for (const id of ids) {
    const it = ITEMS[id];
    const c = el("div", "cdx-card");
    if (it.rank) c.style.borderColor = RANK_COLOR[it.rank];
    const art = el("div", "cdx-art"); art.appendChild(spriteCanvas(it, 3)); c.appendChild(art);
    c.appendChild(el("div", "cdx-name", it.name));
    c.addEventListener("click", () => { SFX.select(); showCodexItemDetail(id); });
    grid.appendChild(c);
  }
  if (!ids.length) grid.appendChild(el("div", "tw-empty", "この区分の品はまだ手にしていない。"));
  townEl.appendChild(grid);
}

// 図鑑: アイテム詳細を宝箱出現時と同じ大きさでメイン画面に表示
function showCodexItemDetail(id) {
  const it = ITEMS[id];
  if (!it) return;
  const wrap = el("div", "confirm-overlay");
  const card = el("div", "ig-card cdx-detail");
  const rc = it.rank ? RANK_COLOR[it.rank] : null;
  if (rc) { card.style.borderColor = rc; card.style.boxShadow = `0 0 40px ${rc}66`; }
  const ban = el("div", "ig-banner", it.rank ? `${RANK_NAME[it.rank]}級アイテム` : "アイテム");
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
  const ban = el("div", "ig-banner", `${RACE_LABEL[m.race] || "魔物"}${m.rank ? "・" + RANK_NAME[m.rank] + "級" : ""}`);
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

  // ドロップ (実際に落とすまで ？？？)
  const dropBox = el("div", "cdx-drops");
  dropBox.appendChild(el("div", "cdx-h", "落とすもの"));
  const dropRow = (label, itemId, revealed, cls) => {
    const r = el("div", "cdx-drow");
    r.appendChild(el("span", "cdx-dlabel " + cls, label));
    if (revealed && ITEMS[itemId]) {
      const ic = el("span", "cdx-di"); ic.appendChild(spriteCanvas(ITEMS[itemId], 2)); r.appendChild(ic);
      r.appendChild(el("span", "cdx-dn", ITEMS[itemId].name));
    } else {
      r.appendChild(el("span", "cdx-dn dim", "？？？"));
    }
    return r;
  };
  dropBox.appendChild(dropRow("通常", m.dropNormal, e.normal, "normal"));
  dropBox.appendChild(dropRow("レア", m.dropRare, e.rare, "rare"));
  card.appendChild(dropBox);

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

let codexDungeonIdx = 0; // モンスター図鑑の選択中ダンジョン
function renderCodexDungeon() {
  townEl.innerHTML = "";
  townEl.appendChild(townHeader("モンスター図鑑", "palace"));
  // 解放済みのダンジョンのみ閲覧可能
  const unlocked = Math.max(1, G.unlockedDungeons || 1);
  if (codexDungeonIdx >= unlocked) codexDungeonIdx = 0;

  // ダンジョン選択タブ (未解放のダンジョンは一切表示しない)
  const tabs = el("div", "tw-dolltabs shop-tabs cdx-tabs");
  for (let i = 0; i < unlocked && i < DUNGEONS.length; i++) {
    const b = btn(DUNGEONS[i].short, () => { codexDungeonIdx = i; renderCodexDungeon(); });
    b.className = "tw-dolltab" + (codexDungeonIdx === i ? " active" : "");
    tabs.appendChild(b);
  }
  townEl.appendChild(tabs);

  const dn = DUNGEONS[codexDungeonIdx];
  townEl.appendChild(el("div", "tw-note", `${dn.name} — 出現する魔物 (未討伐は ？？？)`));

  const roster = dungeonRoster(dn);
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
  const hyKn = Object.keys(HYBRIDS).filter((k) => G.codex.job[k]);
  if (!baseKn.length && !hyKn.length) {
    townEl.appendChild(el("div", "tw-empty", "まだ職業が発現していない。同じ職業の魂を3部位以上に宿すと、職業が発現する。"));
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
    for (const k of bs) list.appendChild(jobRow(jobRankName(k, r), soulSprite(k), SOUL_CLASSES[k].glow, () => showCodexJobDetail(k, r)));
    for (const k of hy) {
      const bk = k.split("+")[0];
      list.appendChild(jobRow(jobRankName(k, r), soulSprite(bk), SOUL_CLASSES[bk].glow, () => showCodexJobDetail(k, r)));
    }
    townEl.appendChild(list);
  }
  townEl.appendChild(el("div", "tw-note", "魂の組み合わせ次第で、いまだ知られぬ職業が眠っているという……"));
}

// 職業図鑑: 詳細カード (解説/活用/発現条件/パッシブ/スキル表)。
// rank = 図鑑で選んだ位階。称号・発現条件・パッシブ・スキルはこのランク視点で表示する。
function showCodexJobDetail(key, rank) {
  const isHybrid = !!HYBRIDS[key];
  const baseK = isHybrid ? key.split("+")[0] : key;
  if (!SOUL_CLASSES[baseK]) return;
  const rec = G.codex.job[key];
  rank = Math.max(1, Math.min(5, rank || (rec && rec.rank) || 1));
  const color = SOUL_CLASSES[baseK].glow;
  const wrap = el("div", "confirm-overlay");
  const card = el("div", "ig-card cdx-detail");
  card.style.borderColor = color;
  card.style.boxShadow = `0 0 40px ${color}44`;
  const ban = el("div", "ig-banner", `ランク${rank}`);
  ban.style.color = color;
  card.appendChild(ban);
  const art = el("div", "ig-art");
  art.appendChild(spriteCanvas(soulSprite(baseK), 9));
  card.appendChild(art);

  const line = (name, desc) => {
    const r = el("div", "cdx-drow");
    r.appendChild(el("span", "cdx-dn", name));
    if (desc) r.appendChild(el("span", "cdx-skd", desc));
    return r;
  };

  card.appendChild(el("div", "ig-name", jobRankName(key, rank)));
  if (isHybrid) {
    const h = HYBRIDS[key];
    card.appendChild(el("div", "cdx-elem", `${h.name}系 (${SOUL_CLASSES[baseK].label}×3 + ${SOUL_CLASSES[key.split("+")[1]].label}×2)`));
    if (h.desc) card.appendChild(el("div", "ig-desc", h.desc));
    if (h.tips) card.appendChild(el("div", "ig-desc cdx-tips", "活用: " + h.tips));
  } else {
    const lore = JOB_LORE[key] || {};
    card.appendChild(el("div", "cdx-elem", `${SOUL_CLASSES[key].label}系`));
    if (lore.desc) card.appendChild(el("div", "ig-desc", lore.desc));
    if (lore.tips) card.appendChild(el("div", "ig-desc cdx-tips", "活用: " + lore.tips));
  }

  // 発現の条件 (この位階に到達するための魂の組み合わせと品質)
  const cbox = el("div", "cdx-drops");
  cbox.appendChild(el("div", "cdx-h", "発現の条件"));
  cbox.appendChild(el("div", "cdx-dun", `・${jobRankCondText(key, rank)}`));
  if (rank >= 2) cbox.appendChild(el("div", "cdx-dun dim", "・5部位すべて同職かつ同ランク: 職業ボーナス (全ステ倍率上昇)"));
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
  townEl.appendChild(townHeader("宿屋「がろう」"));
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
  else { SFX.select(); buzz(15); log(`${d.name} の帰還を早めた (-20分)。`, "sys"); }
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
  townEl.appendChild(el("div", "tw-lead", "赤く脈打つ魂「Red Soul」を授かる祠。空の人業を購い、絶望の淵で加護をもたらす。"));

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
    `・空の人業の購入 (人業の館)\n・死亡人業の帰還を早める (🔴1で-20分)\n・全滅時、🔴${GUARDIAN_COST} で戦利品を守って帰還`));
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
let shopMember = 0; // 取引する編成メンバーの index
const sellPrice = (it) => Math.max(1, Math.floor((it.price || 10) / 2));

// 商店: 上=在庫 (内部スクロール) / 下=取引相手の選択と所持品。
// ページ全体は縦スクロールさせず、在庫リストだけが内部でスクロールする。
function renderShop() {
  townEl.classList.add("shop-mode");
  townEl.appendChild(townHeader("ボルタック商店"));

  if (shopMember >= G.party.length) shopMember = 0;
  const who = G.party[shopMember] || null;

  // 本日の無料配布: 空の魂 ×1 (1日1回)
  const claimed = G.lastEmptyClaim === dailySeed();
  const free = btn(claimed ? "🎁 本日の「空の魂」は受領済み" : "🎁 本日の無料配布: 空の魂 ×1 を受け取る", () => {
    if (G.lastEmptyClaim === dailySeed()) return;
    const w = G.party[shopMember] || G.party.find((m) => m.items.length < MAX_ITEMS);
    if (!w || w.items.length >= MAX_ITEMS) { log("所持品に空きがない。", "sys"); return; }
    w.items.push(cloneItem(EMPTY_SOUL_ID));
    G.lastEmptyClaim = dailySeed();
    codexSeeItem(EMPTY_SOUL_ID);
    SFX.itemget(); buzz([0, 30, 60, 30]);
    log(`本日の無料配布「空の魂」を受け取った (${w.name})。`, "win");
    renderTown();
  });
  free.className = "btn tw-add shop-free";
  if (claimed) free.disabled = true;
  townEl.appendChild(free);

  // カテゴリタブ (売却は下の所持品タップで行う)
  const tabs = el("div", "tw-dolltabs shop-tabs");
  for (const t of SHOP_TABS) {
    const b = btn(t.label, () => { shopTab = t.key; renderTown(); });
    b.className = "tw-dolltab" + (shopTab === t.key ? " active" : "");
    tabs.appendChild(b);
  }
  townEl.appendChild(tabs);

  // 在庫 (内部スクロール領域)
  const tabDef = SHOP_TABS.find((t) => t.key === shopTab) || SHOP_TABS[0];
  const stock = el("div", "shop-stock");
  let any = false;
  for (const id of Object.keys(G.shopStock)) {
    const it = ITEMS[id];
    if (!it || !tabDef.slots.includes(it.slot)) continue;
    const count = G.shopStock[id];
    if (count <= 0) continue;
    any = true;
    const price = it.price || 30;
    const r = el("div", "tw-shoprow");
    const ic = el("span", "tw-chips"); ic.appendChild(spriteCanvas(it, 2)); r.appendChild(ic);
    const info = el("div", "tw-chipi");
    info.appendChild(el("div", "tw-chipn", `${it.name} 在庫 : ${count}`));
    info.appendChild(el("div", "tw-chipc", it.desc || ""));
    r.appendChild(info);
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
      o.appendChild(spriteCanvas(soulSprite(m.dominant.clsKey), 2));
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
        cellEl.appendChild(el("span", "shop-price", `💰${sellPrice(it)}`));
        cellEl.title = it.name;
        cellEl.addEventListener("click", () => showSellPrompt(who, it));
      }
      bag.appendChild(cellEl);
    }
    dock.appendChild(bag);
  } else {
    dock.appendChild(el("div", "tw-empty", "編成に人業がいない。"));
  }
  townEl.appendChild(dock);
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
  card.appendChild(el("div", "ig-name", it.name + (it.cursed ? " 🔒" : "")));
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
  log(`${it.name} を売った (+💰${price})。商店に並んだ。`, "win");
  showToast(`💰+${price} ${it.name} を売却`);
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
  // 魂未封印で極端に弱い人業がいたら注意 (任意続行)
  SFX.stairs();
  townEl.classList.add("hidden");
  G.town.facility = null; G.town.sub = null;
  G.floor = 1; // 迷宮は常に1階から (街に戻ると入り直し)
  G.eliteFloor = false; // 1Fは強敵階にならない
  G.runCfg = buildRunCfg(); // 迷宮 + 日替わり修飾を確定
  G.stats.runs++;
  // 今回の戦利品トラッキングを初期化
  G.run = { gold: 0, soulPts: 0, items: [], souls: [] };
  // 表示中の噂を確定し、この迷宮で現実化させる
  if (G.rumor) { G.activeRumor = { ...G.rumor, floor: G.floor }; G.rumor = null; }
  G.state = "board";
  playBgm(fieldBgm());
  if (townBtn) townBtn.classList.remove("hidden");
  if (descendBtn) { descendBtn.classList.remove("hidden"); descendBtn.disabled = true; }
  newFloor();
  renderBoard();
}

// 街へ無事帰還 (戦利品は保持)。keepRun=true で run を確定 (戦利品維持)
function returnToTown() {
  G.state = "town";
  G.battle = null; G.battleCell = null;
  G.eliteFloor = false;
  combatMenu.classList.add("hidden");
  if (townBtn) townBtn.classList.add("hidden");
  if (descendBtn) { descendBtn.classList.add("hidden"); descendBtn.disabled = true; }
  G.maxFloorReached = Math.max(G.maxFloorReached, G.floor);
  G.run = null; // 無事帰還 = 戦利品は確定 (BGMは renderTown が施設に応じて切替)
  updateTopbar();
  log("街へ帰還した。", "sys");
  G.town.facility = null; G.town.sub = null;
  renderTown();
}

function confirmReturnToTown() {
  if (G.state !== "board" || G.anim || G.walking || G.prompt || G.statusOpen || G.settingsOpen) return;
  showConfirm({
    title: "街へ帰還する？",
    lines: ["今いる階の探索は中断される。", "集めた魂・お金・アイテムは持ち帰れる。"],
    okLabel: "🏚 帰還する",
    onOk: returnToTown,
  });
}

// ---- 個別ステータス / 装備画面 ----
const statusEl = document.getElementById("status-screen");
const statusBtn = document.getElementById("status-btn");
let stSel = null; // 詳細表示中のアイテム { item, from:"equip"|"bag", key }
let stSoulSel = null; // 魂タブで詳細表示中の魂 (uid)

function openStatus(idx = 0) {
  if (G.state !== "board" && G.state !== "town") return;
  if (G.anim || G.walking || G.prompt) return;
  if (G.settingsOpen) closeSettings();
  G.statusOpen = true;
  G.statusIdx = idx;
  G.statusTab = "main"; // 初期表示は統合画面 (ステータス/装備/所持品)
  stSel = null;
  stSoulSel = null;
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

function renderStatus() {
  autosave(); // 装備変更・呪文使用などのたびに保存
  const p = G.party[G.statusIdx];
  statusEl.innerHTML = "";

  // ===== ヘッダ: 肖像 + 名前 + 属性-種族-職業 + 前後/閉じる =====
  const head = el("div", "st-head");
  const port = el("div", "st-port small");
  port.appendChild(spriteCanvas(HERO, 4));
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
    const b = btn(`🔴1 で帰還を早める (-20分)`, () => tryHastenRescue(p));
    b.className = "btn primary";
    if (G.redSoul < 1) b.disabled = true;
    box.appendChild(b);
    statusEl.appendChild(box);
  }

  // 2. 能力値 (6列1行)
  const ab = el("div", "st-attrs6");
  for (const k of ATTR_KEYS) {
    const cell = el("div", "st-attr6");
    cell.appendChild(el("span", "st-attrk", ATTR_LABEL[k]));
    cell.appendChild(el("span", "st-attrv", String(Math.round(p[k] || 0))));
    cell.title = ATTR_NAME[k];
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
    row.appendChild(el("span", "st-ename", it ? it.name + (it.cursed ? " 🔒" : "") : SLOT_LABEL[slot]));
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

  // アイテム選択中は情報パネル
  if (stSel) statusEl.appendChild(renderItemDetail(p, stSel));

  // 野営呪文 (ある場合のみ)。消費MPは省詠唱 (chant) 込みの実コストで表示する
  const campSpells = (p.spells || []).filter((k) => SPELLS[k] && SPELLS[k].kind === "heal");
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
    statusEl.appendChild(el("div", "tw-note", "回復・蘇生は対象を選んで使う。"));
  }
}

// 所持品リストの1行
function invRow(p, it, sel) {
  const selected = stSel && stSel.from === "bag" && stSel.item === it;
  const row = el("div", "st-invrow" + (selected ? " sel" : ""));
  const ic = el("span", "st-iicon"); ic.appendChild(spriteCanvas(it, 2)); row.appendChild(ic);
  row.appendChild(el("span", "st-iname", it.name + (it.cursed ? " 🔒" : "")));
  row.addEventListener("click", () => { stSel = { item: it, from: "bag", index: sel.index }; renderStatus(); });
  return row;
}

// 戦闘外で回復系呪文を唱える。対象の味方を選び、HP回復/蘇生する
function campCast(caster, spellKey) {
  const sp = SPELLS[spellKey];
  if (caster.mp < spellCost(caster, sp)) { log("MPが足りない。", "sys"); return; }
  const wrap = el("div", "confirm-overlay");
  const card = el("div", "ig-card confirm-card");
  card.style.borderColor = "#46c08f";
  card.appendChild(el("div", "ig-banner", `✦ ${sp.name} ✦`));
  card.appendChild(el("div", "ig-name", "誰に唱える？"));
  const list = el("div", "ig-choices");
  for (const t of G.party) {
    const canRevive = sp.revive && !t.alive;
    if (!t.alive && !canRevive) continue;
    const label = `${t.name} (HP ${t.hp}/${t.maxhp})${t.alive ? "" : " †"}`;
    const b = btn(label, () => {
      wrap.remove();
      caster.mp -= spellCost(caster, sp);
      // 蘇生は revivePct(最大HP割合) を優先。それ以外は power 回復 (術者の PIE で伸びる)
      const power = sp.power + Math.round((caster.pie || 0) * 0.5);
      const heal = sp.revivePct ? Math.round(t.maxhp * sp.revivePct) : power + rand(Math.ceil(power * 0.3));
      if (!t.alive && sp.revive) { t.alive = true; t.ailment = null; t.reviveAt = null; t._dead = false; t.hp = Math.max(1, Math.min(t.maxhp, heal)); log(`${sp.name}！ ${t.name}が蘇った (HP ${t.hp})`, "heal"); }
      else { t.hp = Math.min(t.maxhp, t.hp + heal); log(`${sp.name}！ ${t.name}のHPが ${heal} 回復`, "heal"); }
      SFX.heal(); buzz(15);
      renderStatus(); renderParty();
    });
    list.appendChild(b);
  }
  list.appendChild(btn("やめる", () => wrap.remove()));
  card.appendChild(list);
  wrap.appendChild(card);
  wrap.addEventListener("click", (e) => { if (e.target === wrap) wrap.remove(); });
  document.body.appendChild(wrap);
}

// 魂タブ (人業の5部位と封じた魂の成長を表示)
function renderSoulTab(p) {
  const wrap = el("div", "st-soultab");
  const dom = p.dominant;
  const head = el("div", "st-soulsum");
  head.style.borderColor = dom ? SOUL_CLASSES[dom.clsKey].color : "#34344a";
  head.appendChild(el("div", "st-soulc", p.cls));
  head.appendChild(el("div", "st-soultt",
    p.jobRank ? `キャラLv ${p.jobLv || 0}（魂の平均・スキル解放 Lv${p.jobRank * 10} まで）` : "同職3部位未満 — 職業未発現"));
  wrap.appendChild(head);

  for (const part of PARTS) {
    const s = p.parts[part];
    const selected = s && stSoulSel === s.uid;
    const row = el("div", "st-soulrow2" + (selected ? " sel" : ""));
    row.appendChild(el("div", "st-soulpart", PART_LABEL[part]));
    const orb = el("span", "tw-chips");
    if (s) { orb.style.color = SOUL_CLASSES[s.clsKey].glow; orb.appendChild(spriteCanvas(soulSprite(s.clsKey), 2)); }
    row.appendChild(orb);
    if (s) {
      const rank = SOUL_RANKS[s.rank] || SOUL_RANKS[1];
      if (rank.color) row.style.borderColor = rank.color;
      const info = el("div", "st-soulinfo");
      const nm = el("div", "st-souln2", soulName(s));
      if (rank.color) nm.style.color = rank.color;
      info.appendChild(nm);
      // 成長・限界突破は館「魂強化」で
      info.appendChild(el("div", "st-soulstat",
        s.level >= s.cap ? `Lv ${s.level}（上限）— 館で限界突破` : `Lv ${s.level} / ${s.cap} ・ 強化は館で ✦${soulTrainCost(s.level)}`));
      row.appendChild(info);
      // タップで魂の詳細 (ステータス + 基本/上位スキル) を開閉
      row.addEventListener("click", () => { stSoulSel = selected ? null : s.uid; renderStatus(); });
      wrap.appendChild(row);
      if (selected) wrap.appendChild(renderSoulDetail(s));
    } else {
      row.appendChild(el("div", "st-soulinfo dim", "（魂なし）"));
      wrap.appendChild(row);
    }
  }
  return wrap;
}

// パッシブの加算オブジェクトを表示用ラベルに ("ATK+2" など)
const PASSIVE_LABEL = { atk: "ATK", vit: "VIT", agi: "AGI", int: "INT", pie: "PIE", luk: "LUK", hp: "HP", mp: "MP", crit: "会心" };
function passiveLabel(add) {
  if (!add) return "—";
  return Object.keys(add).map((k) => k === "crit" ? `会心+${Math.round(add[k] * 100)}%` : `${PASSIVE_LABEL[k] || k}+${add[k]}`).join(" / ");
}

// 魂のステータス寄与を「HP+7 ATK+2.4 …」形式で列挙 (0は省略)
function soulStatText(st, sep = " ") {
  const keys = ["hp", "mp", "atk", "vit", "agi", "int", "pie", "luk"];
  const lbl = { hp: "HP", mp: "MP", atk: "ATK", vit: "VIT", agi: "AGI", int: "INT", pie: "PIE", luk: "LUK" };
  return keys.filter((k) => st[k]).map((k) => `${lbl[k]}+${st[k]}`).join(sep);
}

// 魂の詳細パネル: ステータスと、覚える基本スキル/上位スキル
function renderSoulDetail(s) {
  const def = SOUL_CLASSES[s.clsKey];
  const rank = SOUL_RANKS[s.rank] || SOUL_RANKS[1];
  const d = el("div", "st-souldetail");
  if (rank.color) d.style.borderColor = rank.color;

  // ステータス
  const st = soulStats(s);
  d.appendChild(el("div", "st-sdh", "ステータス"));
  d.appendChild(el("div", "st-sdstat", soulStatText(st, "　")));
  d.appendChild(el("div", "st-sdnote", `レベル上限 ${s.cap}（融合でランクアップすると上限が上昇）`));
  if (rank.order >= 1) d.appendChild(el("div", "st-sdnote", `${rank.label}魂 (能力 ×${rank.mul})`));

  // この魂(職業×部位)のパッシブ表を表示。s.level で発動済みを強調。
  // アクションスキルは魂ではなく職業に帰属する (職業図鑑参照)。
  d.appendChild(el("div", "st-sdh", `パッシブスキル（${PART_LABEL[s.part]}・常時発動）`));
  const tbl = (PART_SKILLS[s.clsKey] && PART_SKILLS[s.clsKey][s.part]) || [];
  for (const e of tbl) {
    const on = s.level >= e.lvl;
    d.appendChild(el("div", "st-sdskill" + (on ? " on" : ""), `${on ? "★" : "○"} Lv${e.lvl}: ${passiveLabel(e.add)}`));
  }
  return d;
}

// ===== 属性攻撃/属性防御の表示ヘルパ =====
// 各属性の [強い相手, 弱い相手] (表示用)。光↔闇は相互有利で弱点なし
const ELEM_ADV = {
  fire: ["wind", "water"], wind: ["earth", "fire"], earth: ["water", "wind"], water: ["fire", "earth"],
  light: ["dark", null], dark: ["light", null],
};
function elemName(el) { return (ELEMENTS[el] || ELEMENTS.none).label; }
// "火属性攻撃+1 ◯" のような短い表記。e = {el, lv}
function elemStatText(kind, e) {
  if (!e || !e.el) return null;
  return `${elemName(e.el)}属性${kind}+${Math.min(2, e.lv)} ${e.lv >= 2 ? "◎" : "◯"}`;
}
// 相性のくわしい説明行
function elemAdvText(kind, e) {
  if (!e || !e.el || !ELEM_ADV[e.el]) return null;
  const [adv, weak] = ELEM_ADV[e.el];
  const pct = e.lv >= 2 ? 100 : 50;
  if (kind === "攻撃") {
    return `${elemName(adv)}の魔物へのダメージ+${pct}%` + (weak ? ` / ${elemName(weak)}へは-${pct}%` : "");
  }
  return `${elemName(adv)}属性の攻撃を-${pct}%` + (weak ? ` / ${elemName(weak)}属性からは+${pct}%` : "");
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
  const parts = [];
  if (it.pct) {
    const fp = (label, v) => { if (v) parts.push(`${label}${v > 0 ? "+" : ""}${Math.round(v * 100)}%`); };
    fp("ATK", it.pct.atk); fp("VIT", it.pct.vit); fp("AGI", it.pct.agi);
    fp("INT", it.pct.int); fp("PIE", it.pct.pie); fp("LUK", it.pct.luk);
    fp("HP", it.pct.hp); fp("MP", it.pct.mp);
  } else {
    const f = (label, v) => { if (v) parts.push(`${label} ${v > 0 ? "+" : ""}${v}`); };
    f("ATK", it.atk); f("VIT", it.vit); f("AGI", it.agi);
    f("INT", it.int); f("PIE", it.pie); f("LUK", it.luk);
    f("HP", it.hp); f("MP", it.mp);
  }
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
const CAT_LABEL = { weapon: "武器", shield: "盾", body: "防具", head: "頭防具", hands: "小手", feet: "足防具", acc: "装飾品", use: "消耗品", misc: "その他（戦利品）", mat: "貴重品" };
// アイテムの分類表記 (武器はサブカテゴリつき: 「武器（長剣）」)
function itemCatText(it) {
  if (it.slot === "weapon" && it.cat) return `武器（${WEAPON_CAT_LABEL[it.cat] || "その他"}）`;
  return CAT_LABEL[it.slot] || "";
}

// ウィザードリィ風の情報テキスト行
function detailLines(it) {
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
    if (it.pct) {
      const fp = (label, v) => { if (v) mod.push(`${label}${v >= 0 ? "+" : ""}${Math.round(v * 100)}%`); };
      fp("ATK", it.pct.atk); fp("VIT", it.pct.vit); fp("AGI", it.pct.agi);
      fp("INT", it.pct.int); fp("PIE", it.pct.pie); fp("LUK", it.pct.luk);
      fp("HP", it.pct.hp); fp("MP", it.pct.mp);
    } else {
      const f = (label, v) => { if (v) mod.push(`${label}${v >= 0 ? "+" : ""}${v}`); };
      f("ATK", it.atk); f("VIT", it.vit); f("AGI", it.agi);
      f("INT", it.int); f("PIE", it.pie); f("LUK", it.luk);
      f("HP", it.hp); f("MP", it.mp);
    }
    if (it.crit) mod.push(`会心+${Math.round(it.crit * 100)}%`);
    if (mod.length) L.push(mod.join(" / "));
  }
  // 属性攻撃/属性防御 (短い表記 + 相性の説明)
  const ea = it.eAtk ? elemStatText("攻撃", it.eAtk) : null;
  if (ea) L.push(`${ea} — ${elemAdvText("攻撃", it.eAtk)}`);
  const ed = it.eDef ? elemStatText("防御", it.eDef) : null;
  if (ed) L.push(`${ed} — ${elemAdvText("防御", it.eDef)}`);
  if (isEquippable(it)) L.push(equipClassText(it));
  if (it.align) L.push(`${it.align}属性。`);
  return L;
}

function renderItemDetail(p, sel) {
  const d = el("div", "st-detail");
  d.appendChild(el("div", "st-h center", "情報"));
  if (!sel) { d.appendChild(el("div", "st-ddesc", "アイテムを選んでください。")); return d; }
  const it = sel.item;
  const top = el("div", "st-dtop");
  top.appendChild(spriteCanvas(it, 6));
  const dt = el("div", "st-dtext");
  dt.appendChild(el("div", "st-dname", it.name + (it.cursed ? " 🔒呪" : "")));
  for (const line of detailLines(it)) dt.appendChild(el("div", "st-dstat", line));
  if (isEquippable(it) && G.party.length > 1) dt.appendChild(equipPartyChips(it));
  top.appendChild(dt);
  d.appendChild(top);
  d.appendChild(el("div", "st-ddesc", it.desc || ""));

  const acts = el("div", "st-acts");
  if (sel.from === "bag") {
    if (it.slot === "use") {
      acts.appendChild(btn("使う", () => useItem(p, sel.index)));
    } else if (it.slot === "mat" || it.slot === "misc") {
      // 貴重品/戦利品: 装備も使用もできない (売却・譲渡のみ)
    } else {
      const can = canEquip(p, it);
      const b = btn(can ? "装備する" : "装備不可", () => { if (can) doEquip(p, it); });
      if (!can) b.disabled = true;
      acts.appendChild(b);
    }
    acts.appendChild(makeDanger("捨てる", () => dropItem(p, sel.index)));
    // 他のメンバーへ渡す (生存者が2人以上いるときのみ)
    if (G.party.filter((m) => m.alive).length > 1) {
      acts.appendChild(btn("渡す", () => transferItem(p, sel.index)));
    }
  } else if (sel.from === "equip") {
    const b = makeDanger("外す", () => doUnequip(p, sel.key));
    if (it.cursed) { b.disabled = true; b.textContent = "外せない(呪)"; }
    acts.appendChild(b);
  }
  d.appendChild(acts);
  return d;
}

function makeDanger(label, fn) { const b = btn(label, fn); b.classList.add("danger"); return b; }
function clsLabel(k) { return (SOUL_CLASSES[k] || {}).label || k; }

// 装備可能条件のバッジ表示 (36職対応: 職業名列挙→条件バッジ方式)
function equipClassText(it) {
  if (it.forJob) {
    const lbl = (SOUL_CLASSES[it.forJob] || {}).label || it.forJob;
    const seen = (k) => G.codex && G.codex.job && G.codex.job[k];
    return `〈${seen(it.forJob) ? lbl : "？"}〉専用`;
  }
  if (it.classes) {
    const seen = (k) => G.codex && G.codex.job && G.codex.job[k];
    return "装備可: " + it.classes.map((k) => (seen(k) ? clsLabel(k) : "？")).join("・");
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
function equipPartyChips(it) {
  const row = el("div", "eq-cls-chips");
  for (const m of G.party) {
    const ok = canEquip(m, it);
    const c = el("span", "eq-cls-chip " + (ok ? "ok" : "ng"), m.name.slice(0, 1) + (ok ? "○" : "×"));
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

  // 現在装備中 → 外す
  if (cur) {
    const un = btn(cur.cursed ? `${cur.name} は呪われて外せない` : `（外す） ${cur.name}`, () => {
      if (cur.cursed) return;
      wrap.remove();
      const r = unequipItem(p, slotKey);
      if (r.msg) log(r.msg, "sys");
      SFX.select(); renderStatus(); renderParty();
    });
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
    // 装備中の品と付け替える(または両手武器で盾が外れる)場合だけ、現在との増減を出す
    const tk = slotKeyFor(c.it, p);
    const dropShield = c.it.slot === "weapon" && c.it.twoHanded && p.equip.shield;
    const dropWeapon = c.it.slot === "shield" && p.equip.weapon && p.equip.weapon.twoHanded;
    if ((tk && p.equip[tk]) || dropShield || dropWeapon) tx.appendChild(equipCompareEl(p, c.it));
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

// アイテムを入手 (空きのあるメンバーへ)。満杯なら拾えない。{item, who} を返す
function giveItem(id) {
  const it = cloneItem(id);
  if (!it) return null;
  const who = G.party.find((m) => m.items.length < MAX_ITEMS);
  if (!who) { log(`${it.name}を見つけたが、誰も持てない…`, "sys"); return null; }
  runGainItem(who, it);
  codexSeeItem(id);
  log(`${it.name} を手に入れた！ (${who.name})`, "win");
  return { item: it, who };
}

// ---- アイテム入手演出 (イラスト込みの感動的な表示) ----
const itemGetEl = document.getElementById("item-get");

function showItemGet(item, who, onClose) {
  G.prompt = true; // 入力をブロック
  SFX.itemget();
  buzz([0, 30, 60, 30]);
  itemGetEl.innerHTML = "";
  const card = el("div", "ig-card");
  const rc = item.rank ? RANK_COLOR[item.rank] : null;
  if (rc) { card.style.borderColor = rc; card.style.boxShadow = `0 0 40px ${rc}66`; }
  const ban = el("div", "ig-banner", item.rank >= 4 ? `★ ${RANK_NAME[item.rank]}級アイテム発見！ ★` : "✦ アイテム発見！ ✦");
  if (rc) ban.style.color = rc;
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
  card.appendChild(el("div", "ig-name", item.name));
  const stat = statLines(item);
  if (stat) card.appendChild(el("div", "ig-stat", stat));
  if (isEquippable(item)) card.appendChild(el("div", "ig-class", equipClassText(item)));
  card.appendChild(el("div", "ig-desc", item.desc || ""));
  card.appendChild(el("div", "ig-who", `${who.name} が手に入れた`));
  const ok = btn("受け取る", () => closeItemGet(onClose));
  ok.className = "btn primary ig-ok";
  card.appendChild(ok);
  itemGetEl.appendChild(card);
  itemGetEl.classList.remove("hidden");
  // 画面どこでも閉じられる
  itemGetEl.onclick = (e) => { if (e.target === itemGetEl) closeItemGet(onClose); };
}

function closeItemGet(onClose) {
  itemGetEl.classList.add("hidden");
  itemGetEl.innerHTML = "";
  G.prompt = false;
  if (onClose) onClose();
  else renderBoard();
  autosave(true);
}

// ---- 汎用イベント表示 (宝箱の中身・罠・泉など) ----
// アイテム獲得演出と同じオーバーレイ/カードデザインで表示する
function showEvent({ sprite, title, lines = [], accent = "#c9a227", btnLabel = "つぎへ", banner = "✦ イベント ✦", sparkle = false, onClose }) {
  G.prompt = true;
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
  itemGetEl.onclick = (e) => { if (e.target === itemGetEl) closeItemGet(onClose); };
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
  palace: "palace", codexMon: "palace", codexItem: "palace", codexDungeon: "palace", codexJob: "palace", // 図鑑は王宮の間
  shrine: "shrine",
};
let openingActive = false; // オープニング演出中は専用テーマ
// 探索BGM: 迷宮のランク帯 (1-10) ごとに専用テーマ (墓地/坑道/砦/森/神殿/灼洞/氷廊/尖塔/冥門/玄室)
function fieldBgm() {
  const r = Math.max(1, Math.min(10, activeCfg().rank || 1));
  return r === 1 ? "field" : `field${r}`;
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
const SAVE_KEY = "dos-save-v2";
// 保存する G のフィールド (アニメーション等の一時状態は除外)
const SAVE_FIELDS = [
  "state", "floor", "maxFloorReached", "dungeonIdx", "unlockedDungeons", "board", "px", "py", "eliteFloor",
  "gold", "soulPts", "redSoul", "dollsPurchased", "pendingDoll",
  "party", "reserve", "souls", "shopStock", "lastEmptyClaim", "run", "town",
  "quests", "dailyQuests", "subQuests", "msq", "ach", "fastAnim", "rumor", "rumorCooldown", "activeRumor", "codex", "story", "dragonSlain", "runCfg", "stats",
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

// 旧セーブのカタログアイテムに %型ステータス (.pct) を再注入する。
// refSerialize の参照共有を壊さないよう、saved item オブジェクトを in-place で変更する。
function reinjectItemPct() {
  const visited = new Set();
  function inject(it) {
    if (!it || visited.has(it)) return;
    visited.add(it);
    const tmpl = ITEMS[it.id];
    if (!tmpl || !tmpl.pct || it.pct) return;
    it.pct = tmpl.pct;
    for (const k of ["atk", "vit", "agi", "int", "pie", "luk", "hp", "mp"]) {
      if (tmpl.pct[k] != null) delete it[k];
    }
    if (tmpl.weight && !it.weight) it.weight = tmpl.weight;
  }
  for (const m of G.party) {
    for (const it of m.items) inject(it);
    for (const k of Object.keys(m.equip)) inject(m.equip[k]);
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
  reinjectItemPct();
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
  // 旧セーブの魂に cap を補完 (記憶廃止 + レベル上限導入の移行)
  // 無効な clsKey (廃止された混成職など) を持つ魂は除去
  for (const s of (G.souls || [])) ensureSoul(s);
  G.souls = (G.souls || []).filter((s) => s && SOUL_CLASSES[s.clsKey]);
  for (const d of [...(G.party || []), ...(G.reserve || [])]) {
    for (const p of PARTS) {
      if (d.parts && d.parts[p]) {
        ensureSoul(d.parts[p]);
        if (!SOUL_CLASSES[d.parts[p].clsKey]) d.parts[p] = null;
      }
    }
    try { recalcDoll(d); } catch {}
  }
  if (!G.stats) G.stats = { runs: 0, deepest: 0, kills: 0, deaths: 0, soulsFound: 0, bossKills: 0 };
  if (!G.ach) G.ach = {}; // 勲章 (後付け)
  if (!G.subQuests) G.subQuests = {}; // サブクエスト (後付け)
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
    if (townBtn) townBtn.classList.remove("hidden");
    if (descendBtn) descendBtn.classList.remove("hidden");
    if (!G.board) newFloor();
    renderBoard();
    return;
  }
  if (G.state === "combat") {
    if (townBtn) townBtn.classList.remove("hidden");
    if (descendBtn) descendBtn.classList.remove("hidden");
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
  G.souls = [];
  G.redSoul = 0;
  G.unlockedDungeons = 0; // 勅命 (第1章) を受けるまで、迷宮の場所は明かされない
  G.shopStock = { ...SHOP_INIT_STOCK };
  // 第0章「人業の生成」: 王宮で謁見 → 下賜品を受ける (granted) → 館で4体目を仕立て → 報告
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
