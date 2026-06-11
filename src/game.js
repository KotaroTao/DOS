// メインゲーム: カードボード探索 ⇄ 戦闘 (モンスターメーカー風)
import { makeBoard, COLS, ROWS } from "./board.js";
import { MONSTERS, HERO, ICONS, drawSprite } from "./sprites.js";
import { spawnCardEnemies, spawnBossEnemies, spawnMimic, Battle, SPELLS, cloneItem } from "./combat.js";
import { initAudio, SFX, playBgm, toggleMute, isMuted } from "./audio.js";
import { spriteCanvas } from "./sprites.js";
import {
  ITEMS, SLOTS, SLOT_LABEL, SLOT_ICONS, MAX_ITEMS, recalc, equip as equipItem, unequip as unequipItem, canEquip, slotKeyFor,
  ITEM_CATS, WEAPON_CATS, WEAPON_CAT_LABEL, lvToRank,
} from "./items.js";
import { RANK_NAME, RANK_COLOR } from "./content.js";
import { dungeonSubQuests } from "./subquests.js";
import { ACTS, actOf, msqOrderLines, msqReportLines, msqReward, EPILOGUE } from "./story.js";
import { CATALOG_ITEMS } from "./catalog/index.js";
import { DUNGEONS, DUNGEON_MONSTERS, RACE_LABEL, ELEMENTS } from "./dungeons/index.js";
import {
  PARTS, PART_LABEL, SOUL_CLASSES, makeSoul, makeDoll, soulName, soulSprite,
  dollSouls, dominantClass, recalcDoll, sealSoul,
  ATTR_KEYS, ATTR_LABEL, ATTR_NAME,
  SOUL_RANKS, rollSoulRank, soulStats, soulHardCap, ensureSoul,
  JOB_RANKS, jobRankOf, PART_SKILLS, HYBRIDS, findHybrid, JOB_LORE, FLAG_DESC,
  jobSkillTable, jobLevelOf, passiveText,
} from "./souls.js";
import { showOpening } from "./opening.js";

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

const MAX_FLOOR = 3;

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
  // 入手したアイテム/装備を所有者から除去 (装備中なら外す)
  for (const { owner, item } of r.items) {
    const bi = owner.items.indexOf(item);
    if (bi >= 0) { owner.items.splice(bi, 1); continue; }
    for (const slot of SLOTS) if (owner.equip[slot] === item) { owner.equip[slot] = null; recalcDoll ? recalcDoll(owner) : recalc(owner); }
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

// 迷宮内の階に応じた敵の強さ倍率 (迷宮ベース × 階で微増 × 日替わり)
function enemyScale() {
  const cfg = activeCfg();
  return (cfg.enemyScale || 1) * (1 + (G.floor - 1) * 0.06) * (cfg.enemyMul || 1);
}

function updateTopbar() {
  if (G.state === "town") { floorInfo.textContent = `街 💰${G.gold}`; return; }
  floorInfo.textContent = `${curDungeon().short} B${G.floor}F 💰${G.gold}`;
}

function newFloor() {
  // ダンジョンが自前で持つ出現プール (pool=浅階 / deepPool=深階) を使う
  const cfg = activeCfg();
  G.board = makeBoard(G.floor, cfg);
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
}

function renderBoard() {
  drawFloor();

  // 到達可能マスを事前計算 (静止中のみ)
  const reachable = (G.state === "board" && !G.anim && !G.walking)
    ? getReachableCells() : null;

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
    // カード裏面: 深紅の布地 + 金の縁飾り + ダイヤ紋
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
  if (G.state !== "board" || G.anim || G.walking || G.prompt || G.statusOpen) return;
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
        log(`⚔ ${name} のカードだ！`, "dmg");
        startBattle(spawnCardEnemies(cell.monsterKey, G.floor, enemyScale()), cell);
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
      SFX.trap(); buzz([0, 60, 40, 60]);
      const victims = G.party.filter((p) => p.alive);
      const v = victims[rand(victims.length)];
      const dmg = 4 + G.floor * 3 + rand(7);
      v.hp = Math.max(0, v.hp - dmg);
      const lines = [`${v.name}に ${dmg} ダメージ！`];
      log(`罠だ！ ${v.name}に ${dmg} ダメージ`, "dmg");
      let died = false;
      if (v.hp === 0) {
        v.alive = false; died = true;
        log(`${v.name}は倒れた…`, "dmg");
        lines.push(`${v.name}は倒れた…`);
      }
      showEvent({
        sprite: ICONS.trap, title: "罠だ！", lines, accent: "#d4504e", banner: "⚠ 危険 ⚠",
        onClose: () => {
          if (died) { SFX.die(); imprintFallen(); if (!G.party.some((p) => p.alive)) { gameOver(); return; } }
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
      lines: ["全員のHPとMPが完全に回復した！", `淀みから ✦${bonus} Soul を掬い上げた。`],
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
  const all = Object.keys(MONSTERS).filter((k) => MONSTERS[k].race === "undead");
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
  acquireSoul(soul, `風化した死体（${clsLabel}）の残滓に、まだ職能の記憶が宿っていた。`);
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
  const rank = SOUL_RANKS[soul.rank || "normal"];
  const rare = rank.order >= 1;
  SFX.itemget(); buzz(rare ? [0, 40, 50, 40, 50, 150] : [0, 30, 60, 30]);
  log(`${soulName(soul)} を手に入れた！`, "win");
  if (rank.order >= 3) { flashScreen("#ffcf4a"); SFX.victory(); } // 伝説の魂は特別な瞬間
  if (rank.order >= 2) setTimeout(() => showToast(`🌟 ${rank.label}魂を発見！`), 300);
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
function showChoice(title, options, icon, { banner = "✦ 発見 ✦", accent = "#c9a227" } = {}) {
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

// 宝箱: 開けるか選ぶ (リスクあり: 罠 / ミミック)
function askOpenChest(cell) {
  showChoice("宝箱が現れた！ 開ける？", [
    { label: "🔓 開ける", fn: () => openChest(cell) },
    { label: "✋ 開けない", fn: () => { renderBoard(); } },
  ], ICONS.chest);
}

function openChest(cell) {
  if (cell) cell.cleared = true;
  questProgress("chest", null, 1); // 盤面の宝箱を開けた (サブクエスト用)
  rollChest(cell, true, () => { if (G.state === "board") renderBoard(); });
}

// 宝箱の中身を解決。allowDanger=falseなら罠/ミミックなし。doneは安全終了時のコールバック
function rollChest(cell, allowDanger, done) {
  const roll = Math.random();
  const danger = allowDanger ? 0.15 + G.floor * 0.07 : 0;
  if (roll < danger * 0.5) {
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
  if (roll < danger) {
    // 毒針の罠: パーティ全員にダメージ + 一部に毒
    SFX.trap(); buzz([0, 60, 40, 60]);
    const dmg = 6 + G.floor * 4 + rand(8);
    let poisoned = false;
    for (const p of G.party) {
      if (!p.alive) continue;
      p.hp = Math.max(0, p.hp - dmg);
      if (p.hp === 0) { p.alive = false; log(`${p.name}は倒れた…`, "dmg"); }
      else if (Math.random() < 0.5) { p.ailment = "poison"; poisoned = true; }
    }
    log(`宝箱は罠だった！ 全員に ${dmg} ダメージ`, "dmg");
    const wiped = !G.party.some((p) => p.alive);
    showEvent({
      sprite: ICONS.trap, title: "毒針の罠！", accent: "#d4504e", banner: "⚠ 危険 ⚠",
      lines: [`全員に ${dmg} ダメージ！`, ...(poisoned ? ["毒に侵された者も…"] : [])],
      onClose: () => { if (wiped) { gameOver(); return; } if (done) done(); },
    });
    return;
  }
  // 黒い宝箱: 一段上のレベル帯の品が眠るが、開けると呪いの危険を伴う (任意の賭け)
  if (allowDanger && roll >= danger && Math.random() < 0.10) {
    askCursedChest(done);
    return;
  }
  // 中身の抽選 (ダンジョンレベルに応じる): ゴールド50% / ゴールド以外のアイテム50%
  if (Math.random() < 0.5) {
    SFX.chest();
    const dRank = activeCfg().rank || 1;
    const g = runGainGold(Math.round((10 + G.floor * 12 + rand(30)) * (1 + (dRank - 1) * 0.5)));
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
  // 宝: 装備/アイテム (迷宮のアイテムレベル帯から抽選)
  const got = giveItem(pickItemByLv(lootLvAt()));
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

// 戦闘勝利後の宝箱 (出現判定は endBattle 側)。罠やミミックはなしで安全に開封。
// 敵がアイテムを落としていれば中身はそれ。なければダンジョンレベル準拠の抽選。
// after: 終了後に呼ぶ (ボス撃破時は踏破演出へつなぐ)
function battleChest(drops, after) {
  const done = () => { if (after) after(); else if (G.state === "board") renderBoard(); };
  showChoice("宝箱が現れた！ 開ける？", [
    { label: "🔓 開ける", fn: () => {
      if (drops && drops.length) giveDropsFromChest(drops, 0, done);
      else rollChest(null, false, done);
    } },
    { label: "✋ 開けない", fn: done },
  ], ICONS.chest, { banner: "⚔ 勝利 ⚔" });
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
  log("階段を降りていく…", "sys");
  // 暗転 → 階数タイトル → 明転 の演出
  G.prompt = true;
  const ov = el("div", "floor-trans");
  ov.appendChild(el("div", "ft-floor", `B${G.floor}F`));
  ov.appendChild(el("div", "ft-sub", "— さらに深く潜る —"));
  document.body.appendChild(ov);
  setTimeout(() => {
    newFloor();
    renderBoard();
    autosave(true); // 新フロアを保存
  }, 600); // 完全に暗転したタイミングで盤面を切替
  setTimeout(() => {
    ov.classList.add("out");
    setTimeout(() => { ov.remove(); G.prompt = false; }, 500);
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
  // 迷宮の属性気配: 属性持ち迷宮では雑魚敵が迷宮属性を帯びやすい (主は固有属性のまま)
  const cfg = activeCfg();
  if (cfg.element) {
    const ch = cfg.elemBias ? 0.9 : 0.5;
    for (const e of enemies) if (!e.boss && Math.random() < ch) e.element = cfg.element;
  }
  G.battleCell = cell;
  G.state = "combat";

  combatMenu.classList.remove("hidden");
  log(`${enemies.map((e) => e.name).join("・")} が現れた！`, "dmg");
  // ボス戦は専用テーマ。図鑑への記録は「倒した時」に行う (endBattle)
  playBgm(enemies.some((e) => e.boss) ? "boss" : "battle");
  G.battle = new Battle(G.party, enemies, log);
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

  const living = b.enemies;
  const n = living.length;
  const slotW = view.width / (n + 1);
  G.enemyPos = {};
  living.forEach((e, i) => {
    const baseX = slotW * (i + 1);
    const baseY = view.height * 0.40;
    G.enemyPos[e.uid] = { cx: baseX, cy: baseY };
    let ox = 0, oy = 0, alpha = e.alive ? 1 : 0.18;
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
    const size = e.boss ? 14 : 9;
    // 入力/ターゲット選択中: タップで攻撃できる敵に金のリングとマーカーを表示
    const tappable = !G.animating && e.alive && (b.phase === "target" || b.phase === "input");
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
        vctx.fillText("▼", baseX, baseY - size * 6.2);
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
    // 名前プレート (ダークピル)
    const label = e.name + (e.asleep ? " 💤" : "");
    vctx.font = "10px monospace";
    vctx.textAlign = "center";
    const tw = vctx.measureText(label).width;
    vctx.fillStyle = "rgba(8,8,14,0.75)";
    vctx.strokeStyle = e.alive ? "rgba(160,140,180,0.4)" : "rgba(90,90,102,0.3)";
    vctx.lineWidth = 1;
    const px = baseX - tw / 2 - 7, py2 = baseY + 70, pw = tw + 14, ph = 14;
    vctx.beginPath();
    vctx.roundRect ? vctx.roundRect(px, py2, pw, ph, 7) : vctx.rect(px, py2, pw, ph);
    vctx.fill();
    vctx.stroke();
    vctx.fillStyle = e.alive ? "#e7e3d4" : "#5a5a66";
    vctx.fillText(label, baseX, py2 + 10);
    // HPバー (グラデーション + 枠)
    const bw = 56, bh = 6, bx = baseX - bw / 2, by = baseY + 88;
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

// キャンバス座標(sx,sy)に最も近い生存中の敵を返す (一定距離以内のみ)
function nearestEnemyAt(sx, sy) {
  const b = G.battle;
  if (!b) return null;
  let best = null, bestD = 1e9;
  for (const e of b.enemies) {
    if (!e.alive) continue;
    const pos = G.enemyPos[e.uid];
    if (!pos) continue;
    const d = Math.hypot(sx - pos.cx, sy - pos.cy);
    if (d < bestD) { bestD = d; best = e; }
  }
  return bestD < 70 ? best : null;
}

function renderCombatMenu() {
  const b = G.battle;
  combatMenu.innerHTML = "";
  if (G.animating) return; // アニメーション中は操作不可
  if (b.phase === "input") {
    const actor = b.current;
    highlightActor(actor);
    // オート戦闘: 全員が手近な敵を通常攻撃し続ける (周回用)。タップで解除
    if (G.autoCombat) {
      combatMenu.appendChild(el("div", "who", `▶ ${actor.name} (オート戦闘中)`));
      const stop = btn("⏹ オート解除", () => { G.autoCombat = false; if (G._autoTimer) { clearTimeout(G._autoTimer); G._autoTimer = null; } renderCombatMenu(); });
      stop.className = "btn";
      combatMenu.appendChild(stop);
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
    combatMenu.appendChild(el("div", "who", `▶ ${actor.name} のターン ・ 敵タップで攻撃`));
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
    const list = el("div", "target-list");
    for (const t of b.targetOptions()) {
      const label = t.side === "enemy"
        ? `${t.name} (HP ${t.hp})`
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
    const b = btn(`${sp.name} (MP${sp.mp}) - ${sp.desc}`, () => { act("spell", key); });
    if (actor.mp < sp.mp) b.style.opacity = "0.4";
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
    combatMenu.innerHTML = "";
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
    combatMenu.innerHTML = "";
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
  combatMenu.innerHTML = "";
  const res = G.battle.commit();
  animateResult(res, postResolve);
}

// 行動の結果を演出し、終わったら次へ
function postResolve() {
  const b = G.battle;
  // 聖者の祝福が発動したら派手に知らせる
  if (b._blessingFired && !b._blessingShown) {
    b._blessingShown = true;
    SFX.levelup(); buzz([0, 40, 50, 40, 50, 200]); shakeScreen(true);
    showToast("🕊 聖者の祝福！ 全員復活");
    renderParty();
  }
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
  renderCombat();
  if (b.result === "win") {
    // 倒した敵から Soul(魂) を回収する。Soul が経験値の役割を兼ね、館での魂の強化に使う
    const { soul, gold } = b.rewards();
    const goldGot = runGainGold(gold);
    const soulGot = runGainSoulPts(soul);
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
    // soulClass を持つ敵 (人型・騎士など) はまれに魂を落とす (レアドロップ)
    for (const e of b.enemies) {
      const sc = e.alive ? null : (e.mon && e.mon.soulClass) || (MONSTERS[e.key] && MONSTERS[e.key].soulClass);
      if (!sc) continue;
      if (Math.random() < 0.08) {
        const dn = activeCfg();
        const s = makeSoul(sc, 1 + (dn.soulLevelBonus || 0) + (G.floor >= 2 ? 1 : 0), null, rollSoulRank(dn.rankBonus || 0));
        runGainSoul(s);
        G.stats.soulsFound++;
        questProgress("soul", null, 1);
        const rk = SOUL_RANKS[s.rank || "normal"];
        log(`${e.name}が ${soulName(s)} を落とした！`, "win");
        setTimeout(() => showToast(`${rk.order >= 2 ? "🌟" : "✦"} ${soulName(s)} を入手`), 600);
      }
    }
    const wasBoss = b.enemies.some((e) => e.boss);
    if (wasBoss) { flashScreen("#ffd84a"); buzz([0, 60, 50, 60, 50, 250]); } // 主討伐は特別な瞬間
    if (G.battleCell) G.battleCell.cleared = true;
    finishToBoard();
    // 勝利の余韻: まず勝利ポップアップ(Gold/Soul)を表示し、閉じてから宝箱を出す。
    // 宝箱はドロップ品があれば必ず、なければ50%で出現。ボスは宝箱のあとに踏破演出へ
    const afterVictory = () => {
      const after = wasBoss ? onDungeonCleared : null;
      if (drops.length || Math.random() < 0.5) {
        setTimeout(() => battleChest(drops, after), 200);
        return;
      }
      if (after) after();
    };
    showEvent({
      banner: "⚔ 勝利 ⚔", title: "戦いに勝利した！", accent: "#ffd84a", sparkle: true,
      lines: [`獲得 ゴールド 💰${goldGot}`, `回収した Soul ✦${soulGot}`],
      btnLabel: "つぎへ", onClose: afterVictory,
    });
    return;
  } else if (b.result === "flee") {
    // 逃走: 元のマスへ戻る (カードは表のまま)
    if (G.prevPos) { G.px = G.prevPos.x; G.py = G.prevPos.y; }
    finishToBoard();
  } else if (b.result === "lose") {
    gameOver();
  }
}

function finishToBoard() {
  imprintFallen(); // 戦闘で砕けた人業の魂に記憶を刻む
  for (const p of G.party) p._defending = false;
  G.battle = null;
  G.battleCell = null;
  G.state = "board";
  combatMenu.classList.add("hidden");

  playBgm("field");
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
  const goTown = () => { if (townBtn) townBtn.classList.add("hidden"); combatMenu.classList.add("hidden"); returnToTown(); };

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

// 迷宮の主を撃破: 踏破を記録し、戦利品を持って街へ凱旋 (次の迷宮は王宮の勅命で解放)
function onDungeonCleared() {
  const idx = G.dungeonIdx;
  const dn = DUNGEONS[idx];
  G.stats.bossKills++;
  questProgress("boss", null, 1);
  G.dragonSlain = G.dragonSlain || idx === DUNGEONS.length - 1;
  // 新迷宮の解放は王宮の勅命ループが担う: 勅命対象を踏破 → 王宮で報告 → 次章拝命で解放
  const isStoryTarget = G.msq && G.msq.state === "active" && idx + 1 === G.msq.n;
  if (isStoryTarget) G.msq.state = "report";
  G.run = null; // クリア = 戦利品確定

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
  const art = el("div", "ig-art"); art.appendChild(spriteCanvas(ICONS.stairs, 9)); card.appendChild(art);
  card.appendChild(el("div", "ig-name", dn.name));
  for (const ln of lines) card.appendChild(el("div", "ig-desc", ln));
  const ok = btn("街へ凱旋する", () => {
    itemGetEl.classList.add("hidden"); itemGetEl.innerHTML = "";
    G.prompt = false;
    if (townBtn) townBtn.classList.add("hidden");
    returnToTown();
  });
  ok.className = "btn primary ig-ok";
  card.appendChild(ok);
  itemGetEl.appendChild(card);
  itemGetEl.classList.remove("hidden");
}

function victory() {
  G.state = "over";
  playBgm(null);
  buzz([0, 40, 50, 40, 50, 40, 50, 200]);
  log("おめでとう！ あなたは地下迷宮を制覇した！", "win");

  combatMenu.classList.remove("hidden");
  combatMenu.innerHTML = "";
  // 凱旋: 王宮で最終ストーリーが待つ
  const home = btn("🏚 街へ凱旋する (王宮で報告を)", () => {
    combatMenu.classList.add("hidden");
    returnToTown();
  });
  home.className = "btn primary";
  combatMenu.appendChild(home);
  combatMenu.appendChild(btn("もう一度挑戦する", () => location.reload()));

  // 金貨の紙吹雪が舞い続ける勝利画面
  const t0 = performance.now();
  const parts = [];
  for (let i = 0; i < 70; i++) {
    parts.push({
      x: Math.random() * view.width,
      y: -20 - Math.random() * view.height,
      vy: 0.6 + Math.random() * 1.4,
      vx: (Math.random() - 0.5) * 0.5,
      r: 2 + Math.random() * 3,
      sp: Math.random() * Math.PI * 2, // 回転位相
      gold: Math.random() < 0.8,
    });
  }
  const tick = () => {
    if (G.state !== "over") return;
    const now = performance.now();
    vctx.fillStyle = "#07060a";
    vctx.fillRect(0, 0, view.width, view.height);
    // 背後の金色グロー
    const g = vctx.createRadialGradient(view.width / 2, view.height / 2, 20, view.width / 2, view.height / 2, view.width / 2);
    g.addColorStop(0, "rgba(201,162,39,0.18)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    vctx.fillStyle = g;
    vctx.fillRect(0, 0, view.width, view.height);
    // 金貨たち
    for (const p of parts) {
      p.y += p.vy; p.x += p.vx;
      if (p.y > view.height + 10) { p.y = -10; p.x = Math.random() * view.width; }
      const wob = Math.abs(Math.sin(now * 0.004 + p.sp)); // コインの回転 (横幅が伸縮)
      vctx.fillStyle = p.gold ? "#f2d24e" : "#fff0a0";
      vctx.beginPath();
      vctx.ellipse(p.x, p.y, p.r * (0.3 + wob * 0.7), p.r, 0, 0, Math.PI * 2);
      vctx.fill();
    }
    // タイトル (ゆっくり明滅)
    const pulse = 0.85 + Math.sin(now * 0.003) * 0.15;
    vctx.save();
    vctx.globalAlpha = pulse;
    vctx.fillStyle = "#ffd84a";
    vctx.font = "bold 30px monospace";
    vctx.textAlign = "center";
    vctx.shadowColor = "#c9a227";
    vctx.shadowBlur = 18;
    vctx.fillText("★ 迷宮制覇 ★", view.width / 2, view.height / 2 - 14);
    vctx.restore();
    vctx.fillStyle = "#e7e3d4";
    vctx.font = "13px monospace";
    vctx.textAlign = "center";
    vctx.fillText(`ドラゴンを倒した！ 獲得 ${G.gold} ゴールド`, view.width / 2, view.height / 2 + 24);
    const survivors = G.party.filter((p) => p.alive).length;
    vctx.fillStyle = "#9b97a8";
    vctx.font = "11px monospace";
    vctx.fillText(`生還者 ${survivors}/${G.party.length} 人`, view.width / 2, view.height / 2 + 46);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
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
      <div class="name">${p.name}${p.ailment ? ` <span class="ail">${AIL_ICON[p.ailment] || "☠"}</span>` : ""}</div>
      <div class="cls">${p.cls} Lv${p.level}</div>
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
let altarSel = null; // 訓練所で選択中 { doll, part }

const FACILITIES = [
  { key: "mansion", icon: "🏚", name: "人業の館", desc: "人業を仕立て、魂を宿す" },
  { key: "tavern", icon: "🍺", name: "酒場「沈まぬ灯」", desc: "編成とクエスト" },
  { key: "shop", icon: "🏪", name: "商店", desc: "装備・道具の売買" },
  { key: "inn", icon: "🛏", name: "宿屋「臥牢」", desc: "魂を休め、傷を癒す" },
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
  playBgm(sceneBgm()); // 施設ごとのBGMへ切替 (同じ曲なら鳴らし直さない)
  townEl.classList.remove("shop-mode"); // 商店専用レイアウトを解除 (商店なら再付与)
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
  renderTownHub();
}

let townBandOpen = null; // 迷宮選択で開いている層域 (null = 選択中の迷宮の層域)

function renderTownHub() {
  townEl.appendChild(townHeader("辺境の街 ロアダル", false));

  const intro = el("div", "tw-intro");
  intro.appendChild(el("div", "tw-introt", "魂の迷宮 — Dungeon of Souls"));
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
      const clearedIn = Math.max(0, Math.min(clearedDungeonCount() - s, e - s));
      sum.textContent = `第${b + 1}層域 — 迷宮 ${s + 1}〜${e} (踏破 ${clearedIn}/${e - s})`;
      det.appendChild(sum);
      det.addEventListener("toggle", () => {
        if (det.open) townBandOpen = b;
        else if (townBandOpen === b) townBandOpen = null;
      });
      const dlist = el("div", "tw-mlist");
      for (let i = s; i < e; i++) {
        const dn = DUNGEONS[i];
        const unlocked = i < G.unlockedDungeons;
        const row = el("div", "tw-dungeon" + (i === G.dungeonIdx ? " sel" : "") + (unlocked ? "" : " locked"));
        const info = el("div", "tw-chipi");
        info.appendChild(el("div", "tw-chipn", unlocked ? `${i + 1}. ${dn.name}` : `🔒 ？？？`));
        const elTag = dn.element && ELEMENTS[dn.element] ? ` ・${ELEMENTS[dn.element].label}の気配` : "";
        info.appendChild(el("div", "tw-chipc", unlocked ? `全${dn.floors}階 ・ ${i === 0 ? "弱い敵・罠少なめ" : "敵が強く良い戦利品"}${elTag}` : `前の迷宮を踏破し、王宮で勅命を受けると解放`));
        row.appendChild(info);
        if (unlocked) row.addEventListener("click", () => { G.dungeonIdx = i; SFX.select(); renderTown(); });
        dlist.appendChild(row);
      }
      det.appendChild(dlist);
      townEl.appendChild(det);
    }
  }

  // データ削除 (はじめから) — 誤タップ防止に二重確認
  const reset = btn("🗑 はじめから (全データ削除)", confirmReset);
  reset.className = "tw-small danger tw-reset";
  townEl.appendChild(reset);

  // 迷宮へ (常に1階から) — スクロール位置に関わらず押せるよう画面下部に固定表示
  if (G.unlockedDungeons >= 1) {
    const divebar = el("div", "tw-divebar");
    const dive = btn(`🕳 「${curDungeon().name}」へ潜る (B1F)`, tryEnterDungeon);
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
  info.appendChild(el("div", "tw-chipc", d.cls));
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
  { key: "break", icon: "💥", name: "魂分解", desc: "魂を砕いてSoulに" },
  { key: "manage", icon: "🏚", name: "人業 作成 / 管理", desc: "空の人業を購入・解体" },
];

function renderMansion() {
  const sub = G.town.sub;
  if (sub === "party") return renderMansionParty();
  if (sub === "altar") return renderAltar();
  if (sub === "enhance") return renderMansionEnhance();
  if (sub === "synth") return renderMansionSynth();
  if (sub === "break") return renderMansionBreak();
  if (sub === "manage") return renderMansionManage();

  townEl.appendChild(townHeader("人業の館"));
  townEl.appendChild(el("div", "tw-lead", "人型の器「人業（Doll）」を仕立て、5部位に魂を宿して鍛える訓練所。"));
  const grid = el("div", "tw-grid");
  for (const m of MANSION_MENU) {
    const c = el("div", "tw-fac");
    c.appendChild(el("div", "tw-faci", m.icon));
    c.appendChild(el("div", "tw-facn", m.name));
    c.appendChild(el("div", "tw-facd", m.desc));
    c.addEventListener("click", () => { SFX.select(); G.town.sub = m.key; altarSel = null; renderTown(); });
    grid.appendChild(c);
  }
  townEl.appendChild(grid);
}

// 館サブ: パーティ編成 (編成 ⇄ 控え の入れ替え)
function renderMansionParty() {
  townEl.appendChild(townHeader("パーティ編成", "mansion"));
  townEl.appendChild(el("div", "tw-lead", "迷宮へ連れて行く人業は最大6体。タップで編成⇄控えを入れ替え。"));

  townEl.appendChild(el("div", "tw-h", `編成 (${G.party.length}/6) — タップで控えへ`));
  const pl = el("div", "tw-mlist");
  if (!G.party.length) pl.appendChild(el("div", "tw-empty", "誰もいない。控えから加えよう。"));
  G.party.forEach((d) => pl.appendChild(rosterRow(d, () => {
    G.party.splice(G.party.indexOf(d), 1); G.reserve.push(d); SFX.select(); renderTown();
  })));
  townEl.appendChild(pl);

  townEl.appendChild(el("div", "tw-h", `控え (${G.reserve.length}) — タップで編成へ`));
  const rl = el("div", "tw-mlist");
  if (!G.reserve.length) rl.appendChild(el("div", "tw-empty", "控えはいない。"));
  G.reserve.forEach((d) => rl.appendChild(rosterRow(d, () => {
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
  info.appendChild(el("div", "tw-chipc", d.cls));
  row.appendChild(info);
  row.appendChild(el("div", "tw-chiphp",
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
      list.appendChild(soulEnhanceRow(s, () => { recalcDoll(d); d.hp = Math.min(d.hp, d.maxhp); }));
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

// 魂1つの強化行 (ステータス + ✦で鍛える + 限界突破)
function soulEnhanceRow(s, afterLevel) {
  const rank = SOUL_RANKS[s.rank || "normal"];
  const r = el("div", "tw-soulrow" + (rank.order >= 1 ? " rare" : ""));
  if (rank.color) r.style.borderColor = rank.color;
  const o = el("span", "tw-chips"); o.style.color = SOUL_CLASSES[s.clsKey].glow; o.appendChild(spriteCanvas(soulSprite(s.clsKey), 2));
  r.appendChild(o);
  const info = el("div", "tw-chipi");
  const nm = el("div", "tw-souln", soulName(s));
  if (rank.color) nm.style.color = rank.color;
  info.appendChild(nm);
  info.appendChild(el("div", "tw-soulst", `Lv ${s.level} / 上限 ${s.cap}`));
  r.appendChild(info);

  const acts = el("div", "tw-soulacts");
  if (s.level < s.cap) {
    // 鍛える (Lv+1)
    const cost = soulTrainCost(s.level);
    const b = btn(`✦${cost}`, () => {
      if (G.soulPts < cost) { log("Soul が足りない。", "sys"); return; }
      G.soulPts -= cost; s.level++;
      if (afterLevel) afterLevel();
      SFX.levelup(); buzz([0, 30, 40, 30]);
      log(`${SOUL_CLASSES[s.clsKey].label}の魂が Lv${s.level} に成長した！`, "win");
      renderTown();
    });
    b.className = "tw-small primary";
    if (G.soulPts < cost) b.disabled = true;
    acts.appendChild(b);
  } else if (s.cap < soulHardCap(s)) {
    info.children[1].textContent = `Lv ${s.level}（上限）`;
  }
  // 限界突破 (同部位・同職の魂を素材に上限+5)
  if (s.cap < soulHardCap(s)) {
    const need = breakthroughNeed(s);
    const have = fodderCount(s);
    const bb = btn(`限界突破 (魂×${need})`, () => doBreakthrough(s, afterLevel));
    bb.className = "tw-small";
    if (have < need) { bb.disabled = true; bb.textContent = `限界突破 (魂${have}/${need})`; }
    acts.appendChild(bb);
  } else {
    acts.appendChild(el("div", "tw-chiphp", "極"));
  }
  r.appendChild(acts);
  return r;
}

// 限界突破に必要な素材(同部位・同職の魂)数。Lv/ランク/突破回数が高いほど増える
function breakthroughNeed(s) {
  const rank = SOUL_RANKS[s.rank || "normal"];
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

// 魂合成: 職業×部位 を選び、大量の Soul と「空の魂」を払って Lv1(通常)の魂を作る
const SOUL_SYNTH_COST = 200;
const EMPTY_SOUL_ID = "emptySoul";
let synthSel = { clsKey: "fighter", part: "head" };
// パーティ全員の所持から「空の魂」の総数を数える
function emptySoulCount() { return allDolls().reduce((a, d) => a + d.items.filter((it) => it && it.id === EMPTY_SOUL_ID).length, 0); }
// 「空の魂」を1つ消費 (誰かの所持から取り除く)。成功なら true
function consumeEmptySoul() {
  for (const d of allDolls()) {
    const i = d.items.findIndex((it) => it && it.id === EMPTY_SOUL_ID);
    if (i >= 0) { d.items.splice(i, 1); return true; }
  }
  return false;
}
function renderMansionSynth() {
  townEl.appendChild(townHeader("魂合成", "mansion"));
  townEl.appendChild(el("div", "tw-lead",
    `✦${SOUL_SYNTH_COST} Soul と「空の魂」×1 を捧げ、職業と部位を選んで通常ランクの魂を生む。\n(所持 ✦${G.soulPts} ・ 空の魂 ${emptySoulCount()}個 / 優秀以上はダンジョンでのみ入手)`));

  // 職業選択
  townEl.appendChild(el("div", "tw-h", "職業"));
  const cls = el("div", "tw-dolltabs");
  for (const k of Object.keys(SOUL_CLASSES)) {
    const b = btn(SOUL_CLASSES[k].label, () => { synthSel.clsKey = k; renderTown(); });
    b.className = "tw-dolltab" + (synthSel.clsKey === k ? " active" : "");
    b.style.borderColor = SOUL_CLASSES[k].color;
    cls.appendChild(b);
  }
  townEl.appendChild(cls);

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
  const preview = makeSoul(synthSel.clsKey, 1, synthSel.part, "normal");
  const box = el("div", "tw-summary");
  box.style.borderColor = SOUL_CLASSES[synthSel.clsKey].color;
  box.appendChild(el("div", "tw-sumc", soulName(preview)));
  const st = soulStats(preview);
  box.appendChild(el("div", "tw-sumst", soulStatText(st)));
  townEl.appendChild(box);

  const canMake = G.soulPts >= SOUL_SYNTH_COST && emptySoulCount() >= 1;
  const mk = btn(`🌀 魂を作る (✦${SOUL_SYNTH_COST} + 空の魂×1)`, () => {
    if (G.soulPts < SOUL_SYNTH_COST) { log("Soul が足りない。", "sys"); return; }
    if (!consumeEmptySoul()) { log("「空の魂」がない。ダンジョンで探そう。", "sys"); return; }
    G.soulPts -= SOUL_SYNTH_COST;
    const s = makeSoul(synthSel.clsKey, 1, synthSel.part, "normal");
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

// その魂を現Lvまで鍛えるのに要した Soul の総量 (各Lvの強化費 × ランク係数)
function soulInvested(s) {
  let total = 20; // 基礎価値
  for (let lv = 1; lv < s.level; lv++) total += soulTrainCost(lv);
  total = Math.round(total * (SOUL_RANKS[s.rank || "normal"].mul));
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
    const rank = SOUL_RANKS[s.rank || "normal"];
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
    info.appendChild(el("div", "tw-chipn", d.name + (d.alive ? "" : " †") + (inParty ? "" : " (控え)")));
    info.appendChild(el("div", "tw-chipc", `${d.cls} ・ 魂 ${dollSouls(d).length}/5`));
    row.appendChild(info);
    const edit = btn("魂を宿す", () => { altarSel = { doll: d, part: null }; G.town.sub = "altar"; renderTown(); });
    edit.className = "tw-small";
    row.appendChild(edit);
    const del = btn("解体", () => confirmDisband(d));
    del.className = "tw-small danger";
    row.appendChild(del);
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

let _dollNameSeq = 0;
function buyEmptyDoll() {
  const cost = emptyDollCost();
  if (G.redSoul < cost) { log("Red Soul が足りない。", "sys"); return; }
  if (G.party.length >= 6 && G.reserve.length >= 12) { log("これ以上は仕立てられない。", "sys"); return; }
  G.redSoul -= cost;
  G.dollsPurchased++;
  const name = "人業" + "ＡＢＣＤＥＦＧＨＩＪＫＬ".charAt(_dollNameSeq++ % 12);
  const d = makeDoll(name);
  recalcDoll(d);
  d.hp = d.maxhp; d.mp = d.maxmp;
  // 編成に空きがあれば編成へ、なければ酒場の控えへ
  if (G.party.length < 6) G.party.push(d);
  else { G.reserve.push(d); log(`${d.name} は酒場で待機する。`, "sys"); }
  SFX.itemget(); buzz([0, 30, 60, 30]);
  log(`空の人業「${d.name}」を購入した (🔴${cost})。魂を宿そう。`, "win");
  altarSel = { doll: d, part: null };
  G.town.facility = "mansion"; G.town.sub = "altar";
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

// ---- 魂を宿す間 (人業の館の奥): 5部位に魂を宿す ----
function renderAltar() {
  const dolls = allDolls();
  if (!altarSel || !dolls.includes(altarSel.doll)) altarSel = { doll: dolls[0], part: null };
  if (!dolls.length) { townEl.appendChild(townHeader("魂を宿す間", "mansion")); townEl.appendChild(el("div", "tw-empty", "人業がいない。")); return; }
  const d = altarSel.doll;

  townEl.appendChild(townHeader("魂を宿す間", "mansion"));

  // 人業セレクタ
  const sel = el("div", "tw-dolltabs");
  dolls.forEach((dd) => {
    const t = btn(dd.name, () => { altarSel = { doll: dd, part: null }; renderTown(); });
    t.className = "tw-dolltab" + (dd === d ? " active" : "");
    sel.appendChild(t);
  });
  townEl.appendChild(sel);

  // 職業・スキル サマリ
  const sum = el("div", "tw-summary");
  const dom = d.dominant;
  sum.style.borderColor = dom ? SOUL_CLASSES[dom.clsKey].color : "#34344a";
  sum.appendChild(el("div", "tw-sumc", d.cls));
  const tierTxt = d.jobRank
    ? `職業Lv ${d.jobLv || 0}・ランク ${d.jobRank}/5（スキル解放 Lv${d.jobRank * 10} まで）${d.hybrid ? "（混成職）" : ""}`
    : "同職3部位未満 — 職業未発現";
  sum.appendChild(el("div", "tw-sumt", tierTxt));
  sum.appendChild(el("div", "tw-sumst",
    `HP${d.maxhp} MP${d.maxmp} ATK${d.atk} VIT${d.vit} AGI${d.agi} INT${d.int} PIE${d.pie} LUK${d.luk}`));
  if (d.spells.length) { const sk = skillChips(d.spells, "習得:"); sk.classList.add("tw-sumsk"); sum.appendChild(sk); }
  if (d.passives.length) sum.appendChild(el("div", "tw-sumsk", d.passives.join(" / ")));
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
      const rkc = SOUL_RANKS[soul.rank || "normal"].color;
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
      if (cur.level >= cur.cap) {
        trainBox.appendChild(el("div", "tw-note", `${soulName(cur)} は上限 Lv${cur.cap}。館の「魂強化」で限界突破を。`));
      } else {
        const tc = soulTrainCost(cur.level);
        trainBox.appendChild(el("div", "tw-trainn", `${soulName(cur)} → Lv${cur.level + 1}`));
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
      const rank = SOUL_RANKS[s.rank || "normal"];
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
  log(`${d.name} の${PART_LABEL[part]}に ${soulName(s)} を宿した。`, "win");
  renderTown();
}

// 魂を1レベル上げるのに要する Soul (レベルが高いほど高い)
function soulTrainCost(level) { return 15 + level * 12; }

function trainSoul(d, part) {
  const s = d.parts[part];
  if (!s || s.level >= s.cap) return;
  const cost = soulTrainCost(s.level);
  if (G.soulPts < cost) { log("Soul が足りない。", "sys"); return; }
  G.soulPts -= cost;
  s.level++;
  recalcDoll(d);
  d.hp = Math.min(d.hp, d.maxhp);
  SFX.levelup(); buzz([0, 30, 40, 30]);
  log(`${SOUL_CLASSES[s.clsKey].label}の魂が Lv${s.level} に成長した！ (✦${cost})`, "win");
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
  const floor = G.maxFloorReached;
  const speaker = RUMOR_SPEAKERS[rand(RUMOR_SPEAKERS.length)];
  const roll = Math.random();
  if (roll < 0.45) {
    // あたたかい死体 (職業指定) の予兆
    const clsKey = ["fighter", "knight", "thief", "mage", "priest", "bishop"][rand(6)];
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
  else if (r.type === "soulRich") { for (let i = 0; i < 3; i++) setCorpse(["fighter","knight","thief","mage","priest","bishop"][rand(6)]); }
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
  if (!G.rumor) G.rumor = rollRumor();
  townEl.appendChild(el("div", "tw-h", "酒場の噂話"));
  const rb = el("div", "tw-rumor");
  rb.appendChild(el("div", "tw-rumors", `― ${G.rumor.speaker} ―`));
  rb.appendChild(el("div", "tw-rumort", G.rumor.text));
  rb.appendChild(el("div", "tw-note", "この噂は、次に潜る迷宮で現実になる。"));
  townEl.appendChild(rb);
  const reroll = btn("🍺 別の噂を聞く", () => { G.rumor = rollRumor(); SFX.select(); renderTown(); });
  reroll.className = "btn tw-add";
  townEl.appendChild(reroll);

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
  const push = (id, name, desc, cond, gold, redSoul) => {
    const reward = {};
    if (gold) reward.gold = gold;
    if (redSoul) reward.redSoul = redSoul;
    ACHIEVEMENTS.push({ id, name, desc, cond, reward });
  };
  // 段階表: rows = [しきい値, 称号, gold, redSoul][]
  const tiers = (idOf, rows, descOf, condOf) =>
    rows.forEach(([v, name, gold, redSoul]) => push(idOf(v), name, descOf(v), () => condOf(v), gold, redSoul));
  const allDolls = () => [...(G.party || []), ...(G.reserve || [])];
  const allSouls = () => {
    const out = [...(G.souls || [])];
    for (const d of allDolls()) if (d.parts) for (const p of PARTS) if (d.parts[p]) out.push(d.parts[p]);
    return out;
  };
  const monSeen = () => Object.keys(G.codex.mon).filter((k) => MONSTERS[k]).length;
  const itemSeen = () => Object.keys(G.codex.item).filter((k) => ITEMS[k]).length;
  const hybSeen = () => Object.keys(G.codex.job).filter((k) => HYBRIDS[k]).length;

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
    [1, "主殺し", 100], [5, "玉座荒らし", 300, 5], [10, "玉座の簒奪者", 500, 10], [20, "主喰らい", 1000, 15],
    [30, "深淵の死神", 1500, 25], [50, "王なき迷宮", 3000, 40], [100, "全ての主を屠る者", 8000, 80],
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
    [100, "千魂の器", 1000, 15], [250, "魂の蒐集家", 2000, 20], [500, "魂の大河", 4000, 35], [1000, "魂の海", 8000, 60],
  ], (v) => `魂を ${v}個 回収する`, (v) => G.stats.soulsFound >= v);

  // 喪失 (5) — 敗北の数だけ強くなる
  tiers((v) => `death${v}`, [
    [1, "初めての喪失", 50], [10, "不撓不屈", 0, 20], [25, "砕けても なお", 500, 25],
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
    [10, "目利き見習い", 150], [25, "道具屋の常連", 300], [50, "蒐集家", 400], [100, "蔵の主", 800, 10],
    [150, "宝物庫の主", 1500, 15], [250, "伝説の蒐集家", 3000, 30], [350, "全てを手にした者", 8000, 60],
  ], (v) => `アイテム図鑑 ${v}種`, (v) => itemSeen() >= v);

  // 混成職の発現 (8)
  tiers((v) => `hyb${v}`, [
    [1, "最初の混成", 100], [3, "魂の配合師", 200], [5, "混成の探求者", 300], [10, "職業の織り手", 600, 10],
    [15, "魂の錬金術師", 1000, 15], [20, "異端の指導者", 1500, 20], [25, "万職の祖", 2000, 30], [30, "全職業の支配者", 3000, 50],
  ], (v) => `混成職を ${v}種 発現させる`, (v) => hybSeen() >= v);

  // 蓄財 (4) — 受領時にも所持金を再判定する
  tiers((v) => `gold${v}`, [
    [1000, "小金持ち", 0, 5], [5000, "商人の財布", 0, 10], [20000, "貴族の財", 0, 20], [100000, "王より富める者", 0, 50],
  ], (v) => `所持金 ${v}G を貯める`, (v) => G.gold >= v);

  // Soul・赤い魂の貯蔵 (4)
  tiers((v) => `sp${v}`, [[500, "魂の貯蔵庫", 100], [5000, "魂の泉", 1000, 15]],
    (v) => `✦Soul を ${v} 貯める`, (v) => G.soulPts >= v);
  tiers((v) => `rs${v}`, [[100, "赤の収集者", 500], [500, "緋色の王", 3000]],
    (v) => `赤い魂を ${v} 集める`, (v) => G.redSoul >= v);

  // 育成: 職業ランク / 職業Lv / 魂レベル / 魂ランク (14)
  tiers((v) => `jrank${v}`, [[3, "位階を昇る者", 300, 5], [4, "高位の魂繰り", 800, 10], [5, "極みに至る者", 2000, 30]],
    (v) => `職業ランク ${v} の人業を持つ`, (v) => allDolls().some((d) => (d.jobRank || 0) >= v));
  tiers((v) => `jlv${v}`, [
    [10, "駆け出しの職人", 150], [20, "熟練の域", 400, 5], [30, "達人の域", 800, 10],
    [40, "名人の域", 1500, 20], [50, "神域", 3000, 40],
  ], (v) => `職業Lv ${v} に到達する`, (v) => allDolls().some((d) => (d.jobLv || 0) >= v));
  tiers((v) => `slv${v}`, [
    [20, "魂を磨く者", 200], [50, "魂を鍛える者", 800, 10], [70, "限界の先へ", 1500, 20], [100, "魂の極致", 3000, 40],
  ], (v) => `Lv${v} の魂を育てる`, (v) => allSouls().some((s) => (s.level || 1) >= v));
  tiers((v) => `srank${v}`, [[2, "偉大なる魂", 300, 5], [3, "伝説との邂逅", 1000, 20]],
    (v) => `${v === 3 ? "伝説の" : "偉大な"}魂を手に入れる`, (v) => allSouls().some((s) => SOUL_RANKS[s.rank || "normal"].order >= v));

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
    ms.state = "offer";
    autosave(true);
    renderTown();
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
  mk("見習い戦士", "fighter", ["shortSword", "leatherArmor"]);
  mk("見習い僧侶", "priest", ["warHammer", "cap"]);
  mk("見習い魔術師", "mage", ["magicStaff", "robe"]);
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
    G.msq.state = "offer";
    updateTopbar();
    autosave(true);
    renderTown();
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
  if (ms.n === 0 && ms.state === "active") return !ms.granted || allDolls().length >= 4;
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
      b.className = "btn primary tw-add";
      townEl.appendChild(b);
    } else if (allDolls().length >= 4) {
      const b = btn("👑 報告する — 「人業の生成」完遂", () => reportTutorialQuest());
      b.className = "btn primary tw-add";
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
    b.className = "btn primary tw-add";
    townEl.appendChild(b);
  } else if (ms.state === "offer") {
    const b = btn(`👑 謁見する — 新たな勅命 (第${ms.n + 1}章)`, () => acceptMainQuest());
    b.className = "btn primary tw-add";
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
  jobBtn.appendChild(el("div", "tw-facd", `発現 ${Object.keys(G.codex.job).filter((k) => SOUL_CLASSES[k] || HYBRIDS[k]).length} 種`));
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

  // 勲章 (実績): 達成済みは受領でき、未達成は条件のみ見える。
  // 件数が多いため「受領可 → 未達成 → 受領済」の順に並べる
  const claimable = ACHIEVEMENTS.filter((a) => !G.ach[a.id] && a.cond()).length;
  townEl.appendChild(el("div", "tw-h", `王の勲章 — 実績 (${Object.keys(G.ach).length}/${ACHIEVEMENTS.length})${claimable ? ` ・ 受領可 ${claimable}` : ""}`));
  const al = el("div", "tw-mlist");
  const achOrd = (a) => (G.ach[a.id] ? 2 : a.cond() ? 0 : 1);
  const achSorted = [...ACHIEVEMENTS].sort((a, b) => achOrd(a) - achOrd(b));
  for (const a of achSorted) {
    const got = !!G.ach[a.id];
    const ready = !got && a.cond();
    const row = el("div", "tw-quest" + (ready ? " done" : ""));
    if (got) row.style.opacity = "0.55";
    const info = el("div", "tw-chipi");
    info.appendChild(el("div", "tw-chipn", `${got ? "🏅" : ready ? "✨" : "🔘"} ${a.name}`));
    info.appendChild(el("div", "tw-chipc", a.desc));
    const rw = [];
    if (a.reward.gold) rw.push(`💰${a.reward.gold}`);
    if (a.reward.redSoul) rw.push(`🔴${a.reward.redSoul}`);
    info.appendChild(el("div", "tw-chipc", "下賜: " + rw.join(" + ")));
    row.appendChild(info);
    if (ready) {
      const b = btn("拝受する", () => claimAchievement(a));
      b.className = "tw-small primary";
      row.appendChild(b);
    } else if (got) {
      row.appendChild(el("div", "tw-chiphp", "受領済"));
    }
    al.appendChild(row);
  }
  townEl.appendChild(al);
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
  if (mon.dropRare && Math.random() < 0.04) { dropId = mon.dropRare; rare = true; }
  else if (mon.dropNormal && Math.random() < 0.30) { dropId = mon.dropNormal; rare = false; }
  if (!dropId) return null;
  const it = cloneItem(dropId);
  if (!it) return null;
  return { key: enemy.key, name: enemy.name, id: dropId, item: it, rare };
}
function codexSeeItem(id) { if (id) G.codex.item[id] = true; }

// ---- 職業図鑑の記録 ----
// 人業に職業 (基本職/混成職) が発現した時点で「発見」とし、スキル解放の
// 到達レベル (ランク上限でキャップした職業Lv) の最高値を {lv} に記録する。
// 図鑑のスキル表は、この到達Lvまでの技だけ内容を開示する。
function codexSeeJobs(doll) {
  if (!doll || !doll.parts) return;
  const rec = (key, lv) => {
    const e = G.codex.job[key];
    const prev = e && typeof e === "object" ? (e.lv || 0) : 0;
    G.codex.job[key] = { lv: Math.max(prev, lv) };
  };
  const jr = jobRankOf(doll);
  if (!jr) return;
  const cap = jr.rank * 10;
  rec(jr.clsKey, Math.min(cap, jobLevelOf(doll, [jr.clsKey])));
  const counts = {};
  for (const p of PARTS) { const s = doll.parts[p]; if (s) counts[s.clsKey] = (counts[s.clsKey] || 0) + 1; }
  const hy = findHybrid(counts);
  if (hy) rec(hy.key, Math.min(cap, jobLevelOf(doll, [hy.baseK, hy.subK])));
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

  // ダンジョン選択タブ
  const tabs = el("div", "tw-dolltabs shop-tabs cdx-tabs");
  for (let i = 0; i < DUNGEONS.length; i++) {
    const open = i < unlocked;
    const b = btn(open ? DUNGEONS[i].short : "？？", () => { if (open) { codexDungeonIdx = i; renderCodexDungeon(); } });
    b.className = "tw-dolltab" + (codexDungeonIdx === i ? " active" : "");
    if (!open) b.disabled = true;
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
// 人業に発現したことのある職業 (基本職/混成職) のみ表示。未発見は一切載せない。
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
  townEl.appendChild(el("div", "tw-note", "人業に発現した職業のみ、ここに記される。"));
  if (baseKn.length) {
    townEl.appendChild(el("div", "tw-h", "基本職"));
    const list = el("div", "cdx-sklist");
    for (const k of baseKn) list.appendChild(jobRow(SOUL_CLASSES[k].label, soulSprite(k), SOUL_CLASSES[k].glow, () => showCodexJobDetail(k)));
    townEl.appendChild(list);
  }
  if (hyKn.length) {
    townEl.appendChild(el("div", "tw-h", `混成職 — 発現 ${hyKn.length} 種`));
    const list = el("div", "cdx-sklist");
    for (const k of hyKn) {
      const bk = k.split("+")[0];
      list.appendChild(jobRow(HYBRIDS[k].name, soulSprite(bk), SOUL_CLASSES[bk].glow, () => showCodexJobDetail(k)));
    }
    townEl.appendChild(list);
  }
  townEl.appendChild(el("div", "tw-note", "魂の組み合わせ次第で、いまだ知られぬ混成職が眠っているという……"));
}

// 職業図鑑: 詳細カード (基本職=解説/活用/ランク表、混成職=構成/専用スキル)
function showCodexJobDetail(key) {
  const isHybrid = !!HYBRIDS[key];
  const baseK = isHybrid ? key.split("+")[0] : key;
  if (!SOUL_CLASSES[baseK]) return;
  const color = SOUL_CLASSES[baseK].glow;
  const wrap = el("div", "confirm-overlay");
  const card = el("div", "ig-card cdx-detail");
  card.style.borderColor = color;
  card.style.boxShadow = `0 0 40px ${color}44`;
  const ban = el("div", "ig-banner", isHybrid ? "混成職" : "基本職");
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

  if (isHybrid) {
    const h = HYBRIDS[key];
    const subK = key.split("+")[1];
    card.appendChild(el("div", "ig-name", h.name));
    card.appendChild(el("div", "cdx-elem", `${SOUL_CLASSES[baseK].label}の魂×3 + ${SOUL_CLASSES[subK].label}の魂×2`));
    if (h.desc) card.appendChild(el("div", "ig-desc", h.desc));
    if (h.passive) {
      const pbox = el("div", "cdx-drops");
      pbox.appendChild(el("div", "cdx-h", "常時効果"));
      pbox.appendChild(line(h.passive.label || "常時効果", passiveText(h.passive)));
      card.appendChild(pbox);
    }
  } else {
    const cls = SOUL_CLASSES[key];
    const lore = JOB_LORE[key] || {};
    card.appendChild(el("div", "ig-name", cls.label));
    if (lore.desc) card.appendChild(el("div", "ig-desc", lore.desc));
    if (lore.tips) card.appendChild(el("div", "ig-desc cdx-tips", "活用: " + lore.tips));
    if (cls.passive) {
      const pbox = el("div", "cdx-drops");
      pbox.appendChild(el("div", "cdx-h", "職業パッシブ (3部位以上で発現)"));
      pbox.appendChild(line(cls.passive.label, passiveText(cls.passive)));
      card.appendChild(pbox);
    }
  }

  // 職業スキル表 (職業Lvで習得)。実際に到達したLvまでの技だけ開示する
  const reached = (G.codex.job[key] && typeof G.codex.job[key] === "object" && G.codex.job[key].lv) || 0;
  const sbox = el("div", "cdx-drops");
  sbox.appendChild(el("div", "cdx-h", "職業スキル (職業Lvで習得・ランクが解放上限)"));
  for (const e of jobSkillTable(key)) {
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

  // 職業ランク (位階): ランクN → 職業Lv N*10 までのスキルを解放
  const rbox = el("div", "cdx-drops");
  if (isHybrid) {
    rbox.appendChild(el("div", "cdx-h", "職業ランク"));
    rbox.appendChild(el("div", "cdx-dun", `・ベース職 (${SOUL_CLASSES[baseK].label}) の魂の品質に従う`));
    rbox.appendChild(el("div", "cdx-dun", "・ランクN で職業Lv N×10 までのスキルを解放"));
  } else {
    rbox.appendChild(el("div", "cdx-h", "職業ランク (魂の品質で決まる位階)"));
    (JOB_RANKS[key] || []).forEach((rk, i) => {
      const fx = [`スキル解放 Lv${(i + 1) * 10} まで`];
      if (rk.passive) fx.push(passiveText(rk.passive));
      if (rk.flag && FLAG_DESC[rk.flag]) fx.push(FLAG_DESC[rk.flag]);
      rbox.appendChild(line(`ランク${i + 1} ${rk.name}`, fx.join(" / ")));
    });
  }
  card.appendChild(rbox);

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
  townEl.appendChild(townHeader("宿屋「臥牢」"));
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
    info.appendChild(el("div", "tw-chipn", `${it.name} ×${count}`));
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
  G.runCfg = buildRunCfg(); // 迷宮 + 日替わり修飾を確定
  G.stats.runs++;
  // 今回の戦利品トラッキングを初期化
  G.run = { gold: 0, soulPts: 0, items: [], souls: [] };
  // 表示中の噂を確定し、この迷宮で現実化させる
  if (G.rumor) { G.activeRumor = { ...G.rumor, floor: G.floor }; G.rumor = null; }
  G.state = "board";
  playBgm("field");
  if (townBtn) townBtn.classList.remove("hidden");
  newFloor();
  renderBoard();
}

// 街へ無事帰還 (戦利品は保持)。keepRun=true で run を確定 (戦利品維持)
function returnToTown() {
  G.state = "town";
  G.battle = null; G.battleCell = null;
  combatMenu.classList.add("hidden");
  if (townBtn) townBtn.classList.add("hidden");
  G.maxFloorReached = Math.max(G.maxFloorReached, G.floor);
  G.run = null; // 無事帰還 = 戦利品は確定
  updateTopbar();
  log("街へ帰還した。", "sys");
  G.town.facility = null; G.town.sub = null;
  renderTown();
}

function confirmReturnToTown() {
  if (G.state !== "board" || G.anim || G.walking || G.prompt || G.statusOpen) return;
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
  idn.appendChild(el("div", "st-sub", p.isDoll ? `人業 ・ ${p.cls} ・ 魂Lv${p.level}` : `${p.align} - ${p.race} - ${p.cls} Lv${p.level}`));
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

  // 野営呪文 (ある場合のみ)
  const campSpells = (p.spells || []).filter((k) => SPELLS[k] && SPELLS[k].kind === "heal");
  if (p.isDoll && p.alive && campSpells.length) {
    statusEl.appendChild(el("div", "st-h2", "呪文 (野営)"));
    const sl = el("div", "st-camp");
    for (const k of campSpells) {
      const sp = SPELLS[k];
      const b = btn(`${sp.name} (MP${sp.mp})`, () => campCast(p, k));
      b.className = "tw-small";
      if (p.mp < sp.mp) b.disabled = true;
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

// ステータスタブ (詳細なステータスシート)
function renderStatTab(p) {
  const info = el("div", "st-statsheet");
  // 上段: 肖像 + 基本情報 (横並び)
  const top = el("div", "st-stattop");
  const port = el("div", "st-port");
  port.appendChild(spriteCanvas(HERO, 6));
  top.appendChild(port);
  const meta = el("div", "st-meta");
  const line1 = p.isDoll
    ? `<div class="st-line">人業 <b>${p.cls}</b>　魂 <b>${dollSouls(p).length}/5</b></div>`
    : `<div class="st-line">属性 <b>${p.align}</b>　種族 <b>${p.race}</b></div>
       <div class="st-line">職業 <b>${p.cls}</b>　レベル <b>${p.level}</b></div>`;
  meta.innerHTML = `
    ${line1}
    <div class="st-line">HP <b>${p.hp}/${p.maxhp}</b>　MP <b>${p.mp}/${p.maxmp}</b></div>
    <div class="st-line">属性攻撃 ${elemStatChip(p.elemAtk)}　属性防御 ${elemStatChip(p.elemDef)}</div>
    <div class="st-line ${p.ailment ? "st-bad" : ""}">状態: ${p.ailment ? (AIL_NAME[p.ailment] || p.ailment) : (p.alive ? "正常" : "戦闘不能")}</div>`;
  if (p.spells && p.spells.length) meta.appendChild(skillChips(p.spells, "習得:"));
  top.appendChild(meta);
  info.appendChild(top);

  // 死亡中: 街へ連れ帰られるまでの残り時間と、Red Soulによる短縮
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
    info.appendChild(box);
  }

  // 六大ステータス (ATK/VIT/AGI/INT/PIE/LUK)。装備・魂込みの実効値で、武具によって変動する
  const ab = el("div", "st-attrs");
  for (const k of ATTR_KEYS) {
    const cell = el("div", "st-attr");
    cell.appendChild(el("span", "st-attrk", ATTR_LABEL[k]));
    cell.appendChild(el("span", "st-attrv", String(Math.round(p[k] || 0))));
    cell.title = ATTR_NAME[k];
    ab.appendChild(cell);
  }
  info.appendChild(ab);

  // 野営呪文 (戦闘外の回復/治療/蘇生)。MPを消費して使える
  const campSpells = (p.spells || []).filter((k) => SPELLS[k] && SPELLS[k].kind === "heal");
  if (p.isDoll && p.alive && campSpells.length) {
    info.appendChild(el("div", "st-h2", "呪文 (野営)"));
    const sl = el("div", "st-camp");
    for (const k of campSpells) {
      const sp = SPELLS[k];
      const b = btn(`${sp.name} (MP${sp.mp})`, () => campCast(p, k));
      b.className = "tw-small";
      if (p.mp < sp.mp) b.disabled = true;
      sl.appendChild(b);
    }
    info.appendChild(sl);
    info.appendChild(el("div", "tw-note", "回復・蘇生は対象を選んで使う。"));
  }
  return info;
}

// 戦闘外で回復系呪文を唱える。対象の味方を選び、HP回復/蘇生する
function campCast(caster, spellKey) {
  const sp = SPELLS[spellKey];
  if (caster.mp < sp.mp) { log("MPが足りない。", "sys"); return; }
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
      caster.mp -= sp.mp;
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
    p.jobRank ? `職業Lv ${p.jobLv || 0}・ランク ${p.jobRank}/5（スキル解放 Lv${p.jobRank * 10} まで）${p.hybrid ? `（混成職「${p.hybrid}」）` : ""}` : "同職3部位未満 — 職業未発現"));
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
      const rank = SOUL_RANKS[s.rank || "normal"];
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
  const rank = SOUL_RANKS[s.rank || "normal"];
  const d = el("div", "st-souldetail");
  if (rank.color) d.style.borderColor = rank.color;

  // ステータス
  const st = soulStats(s);
  d.appendChild(el("div", "st-sdh", "ステータス"));
  d.appendChild(el("div", "st-sdstat", soulStatText(st, "　")));
  d.appendChild(el("div", "st-sdnote", `レベル上限 ${s.cap}（限界突破で最大 ${soulHardCap(s)}）`));
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
  const fx = (obj) => Object.entries(obj).map(([k, v]) => `${ATTR_LABEL[k] || k.toUpperCase()} ×${v}`).join("・");
  if (sp.buff) lines.push(`強化: ${fx(sp.buff)}`);
  if (sp.debuff) lines.push(`弱体: ${fx(sp.debuff)}`);
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
    def: fake.def - p.def,
    spd: fake.spd - p.spd,
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
  if (d) for (const [label, k] of [["こうげき", "atk"], ["ぼうぎょ", "def"], ["すばやさ", "spd"], ["HP", "hp"], ["MP", "mp"]]) {
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
    if (it.slot === "weapon") {
      const seg = [];
      if (it.hit != null) seg.push(`命中${it.hit >= 0 ? "+" : ""}${it.hit}`);
      if (it.dice) seg.push(`${it.dice}ダメージ`);
      if (it.swings != null) seg.push(`最低攻撃回数: ${it.swings}`);
      if (seg.length) L.push(seg.join(" / "));
    }
    // 六大ステ (ATK/VIT/AGI/INT/PIE/LUK) への補正
    const mod = [];
    const f = (label, v) => { if (v) mod.push(`${label}${v >= 0 ? "+" : ""}${v}`); };
    f("ATK", it.atk); f("VIT", it.vit); f("AGI", it.agi);
    f("INT", it.int); f("PIE", it.pie); f("LUK", it.luk);
    f("HP", it.hp); f("MP", it.mp);
    if (it.crit) mod.push(`会心+${Math.round(it.crit * 100)}%`);
    if (mod.length) L.push(mod.join(" / "));
  }
  // 属性攻撃/属性防御 (短い表記 + 相性の説明)
  const ea = it.eAtk ? elemStatText("攻撃", it.eAtk) : null;
  if (ea) L.push(`${ea} — ${elemAdvText("攻撃", it.eAtk)}`);
  const ed = it.eDef ? elemStatText("防御", it.eDef) : null;
  if (ed) L.push(`${ed} — ${elemAdvText("防御", it.eDef)}`);
  if (it.classes) L.push("装備可: " + it.classes.map(clsLabel).join("/"));
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
function clsLabel(k) { return ({ fighter: "戦", knight: "騎", thief: "盗", mage: "魔", priest: "僧", bishop: "導" })[k] || k; }

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
  for (const it of p.items) if (itemFitsSlot(it, slotKey) && canEquip(p, it)) cands.push({ it, owner: p, where: "self" });
  for (const d of allDolls()) {
    if (d === p) continue;
    for (const it of d.items) if (itemFitsSlot(it, slotKey) && canEquip(p, it)) cands.push({ it, owner: d, where: "bag" });
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
  const { it, owner, where, srcSlot } = c;
  if (owner !== p) {
    // 他キャラから取り上げる
    if (where === "bag") { const i = owner.items.indexOf(it); if (i >= 0) owner.items.splice(i, 1); }
    else if (where === "equip") { owner.equip[srcSlot] = null; recalcDoll(owner); }
    p.items.push(it); // いったん p の所持品へ
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

// ---- 入力 ----
// 最初のユーザー操作で音声を起動 (ブラウザの自動再生制限対策)
let audioReady = false;
// 街の施設ごとのBGM (未掲載の施設は広場の曲。図鑑の間は王宮の一部)
const FACILITY_BGM = {
  mansion: "mansion", altar: "mansion",
  tavern: "tavern", shop: "shop", inn: "inn", shrine: "shrine",
  palace: "palace", codexMon: "palace", codexItem: "palace", codexDungeon: "palace", codexJob: "palace",
};
let openingActive = false; // オープニング上映中は専用曲を流す
// 現在のシーンに合ったBGM名
function sceneBgm() {
  if (openingActive) return "opening";
  if (G.state === "town") return FACILITY_BGM[G.town.facility] || "town";
  if (G.state === "combat") return (G.battle && G.battle.enemies.some((e) => e.boss)) ? "boss" : "battle";
  if (G.state === "board") return "field";
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
  // 戦闘中: 敵スプライトを直接タップ
  if (G.state === "combat" && G.battle && !G.animating) {
    const b = G.battle;
    const enemy = nearestEnemyAt(sx, sy);
    // ターゲット選択フェーズ: タップで対象決定
    if (b.phase === "target" && enemy) {
      if (b.pending && b.pending.action !== "attack" && b.targetOptions().every((t) => t.side !== "enemy")) return;
      SFX.select(); buzz(10); b.chooseTarget(enemy); runCommitted();
      return;
    }
    // 入力フェーズ: どこをタップしても通常攻撃。敵の上なら対象指定、
    // 何もないところなら最寄り/先頭の敵を自動で狙う。
    if (b.phase === "input") {
      const tgt = enemy || b.livingEnemies()[0];
      if (!tgt) return;
      const r = b.chooseAction("attack");
      if (r && r.invalid) { renderCombatMenu(); return; }
      SFX.select(); buzz(10); b.chooseTarget(tgt); runCommitted();
      return;
    }
    return;
  }
  if (G.state !== "board" || G.anim || G.walking || G.prompt || G.statusOpen) return;
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
  if (G.state !== "board" || G.prompt || G.statusOpen) { stopSwipe(); return; }
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
  if (e.key === "Escape" && G.statusOpen) { closeStatus(); return; }
  if (G.state !== "board" || G.prompt || G.statusOpen) return;
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
function updateMuteBtn(m) { if (muteBtn) muteBtn.textContent = m ? "🔇" : "🔊"; }
if (muteBtn) {
  muteBtn.addEventListener("click", () => { ensureAudio(); updateMuteBtn(toggleMute()); });
}

// ================= オートセーブ (ウィザードリィ3風: 常時保存・やり直し不可) =================
// 一度選択した行動は取り消せない。タスクキルされても直前の状態 (戦闘なら確定済みの
// 行動が実行される直前) から再開する。
// v2: 全コンテンツ再編 (隠しレベル1-200 / 迷宮100 / 魂cap拡張)。v1セーブとは互換しない
const SAVE_KEY = "dos-save-v2";
// 保存する G のフィールド (アニメーション等の一時状態は除外)
const SAVE_FIELDS = [
  "state", "floor", "maxFloorReached", "dungeonIdx", "unlockedDungeons", "board", "px", "py",
  "gold", "soulPts", "redSoul", "dollsPurchased",
  "party", "reserve", "souls", "shopStock", "lastEmptyClaim", "run", "town",
  "quests", "dailyQuests", "subQuests", "msq", "ach", "fastAnim", "rumor", "activeRumor", "codex", "story", "dragonSlain", "runCfg", "stats",
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
  // 一時状態はリセット
  G.anim = null; G.flipAnim = null; G.heroAnim = null; G.walking = false; G.prompt = false;
  G.fx = null; G.animating = false; G.enemyPos = {}; G.partyFx = new Map(); G.wallFlash = null;
  G.statusOpen = false;
  // クラス/参照の再リンク (Battleのメソッド・敵のmon・派生値)
  if (G.battle) {
    Object.setPrototypeOf(G.battle, Battle.prototype);
    G.battle.log = log;
    for (const e of (G.battle.enemies || [])) if (e.key && MONSTERS[e.key]) e.mon = MONSTERS[e.key];
  }
  // 旧セーブの魂に cap を補完 (記憶廃止 + レベル上限導入の移行)
  for (const s of (G.souls || [])) ensureSoul(s);
  for (const d of [...(G.party || []), ...(G.reserve || [])]) {
    for (const p of PARTS) if (d.parts && d.parts[p]) ensureSoul(d.parts[p]);
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
  // 職業図鑑 (後付け): 旧形式 (true) を {lv} へ移行し、現在の人業から復元する
  if (!G.codex.job) G.codex.job = {};
  for (const k in G.codex.job) if (typeof G.codex.job[k] !== "object") G.codex.job[k] = { lv: 0 };
  delete G.codex.soul; // 魂図鑑は廃止 (スキルが職業帰属になったため)
  codexSweepJobs();
  return true;
}

// 復元した状態に応じて画面を再構築 (やり直し不可の再開)
function resumeFromState() {
  if (!G.state || G.state === "town") {
    G.state = "town";
    if (townBtn) townBtn.classList.add("hidden");
    renderTown();
    return;
  }
  if (G.state === "board") {
    if (townBtn) townBtn.classList.remove("hidden");
    if (!G.board) newFloor();
    renderBoard();
    return;
  }
  if (G.state === "combat") {
    if (townBtn) townBtn.classList.remove("hidden");
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
    log("魂の迷宮へようこそ。人業に魂を宿し、深淵へ挑め。", "sys");
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
      G.statusOpen = false; G.prompt = false; G.anim = null; G.walking = false;
      if (statusEl) statusEl.classList.add("hidden");
      renderTown();
    } catch (e2) { /* これ以上は何もしない (セーブは温存) */ }
  }
  autosave(true);

  // 初回起動 (新規ゲーム) のみ: オープニングを流してから街へ
  if (!loaded) {
    G.prompt = true;
    openingActive = true;
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
