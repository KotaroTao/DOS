// メインゲーム: カードボード探索 ⇄ 戦闘 (モンスターメーカー風)
import { makeBoard, COLS, ROWS } from "./board.js";
import { MONSTERS, HERO, ICONS, drawSprite } from "./sprites.js";
import { createParty, spawnCardEnemies, spawnBossEnemies, spawnMimic, Battle, gainExp, SPELLS, cloneItem } from "./combat.js";
import { initAudio, SFX, playBgm, toggleMute, isMuted } from "./audio.js";
import { spriteCanvas } from "./sprites.js";
import { ITEMS, SLOTS, SLOT_LABEL, SLOT_ICONS, MAX_ITEMS, recalc, equip as equipItem, unequip as unequipItem, canEquip } from "./items.js";
import {
  PARTS, PART_LABEL, SOUL_CLASSES, makeSoul, makeDoll, soulName, soulSprite,
  dollSouls, dominantClass, recalcDoll, sealSoul, createStartingRoster, SOUL_MAX_LEVEL, soulExpToNext,
  markFallen, clearFallen, memoryTitle, ATTR_KEYS, ATTR_LABEL, ATTR_NAME,
  SOUL_RANKS, rollSoulRank, soulStats,
} from "./souls.js";

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
  maxFloorReached: 1, // 到達した最深階 (街から再開する基準)
  board: null,
  px: 0, py: 0,
  gold: 200,          // 初期所持金 (宿屋・商店用)
  soulPts: 0,         // Soul(魂): 敵/死体から得る。館で魂のレベルアップに使う
  redSoul: 100,       // Red Soul(赤い魂): プレミアム通貨 (空の人業購入・加護)
  dollsPurchased: 0,  // 空の人業を購入した回数 (価格の段階に使う)
  party: [],          // 迷宮に連れて行く人業 (最大6体)
  reserve: [],        // 酒場で待機中の人業
  souls: [],          // 未封印の魂ストック
  shopStock: null,    // 商店の在庫 { itemId: 個数 } (初回 setupNewGame で初期化)
  run: null,          // 今回の潜入で得た戦利品 { gold, soulPts, items:[{owner,item}], souls:[] }
  town: { facility: null, sub: null }, // 街UIの現在地 (sub: 館などのサブメニュー)
  quests: [],         // 受注可能/進行中のクエスト
  rumor: null,        // 酒場で表示中の噂 (次回潜入で現実化)
  activeRumor: null,  // 潜入時に確定した、この迷宮で適用する噂
  codex: { mon: {}, item: {} }, // 図鑑 (遭遇したモンスター/入手したアイテム)
  story: 0,           // 王宮ストーリーの進行段階
  dragonSlain: false, // 竜を討ったか
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
function runGainGold(g) { G.gold += g; if (G.run && inDungeon()) G.run.gold += g; }
function runGainSoulPts(s) { G.soulPts += s; if (G.run && inDungeon()) G.run.soulPts += s; }
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

// 砕けた人業の魂に「記憶」を刻む (全パーティを走査、一度の死で一度だけ)。
// あわせて時間経過の復活タイマーもセットする
function imprintFallen() {
  for (const d of G.party) {
    if (d.isDoll && !d.alive) {
      const msgs = markFallen(d);
      for (const m of msgs) log(m, "sys");
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

function log(msg, cls = "sys") {
  const div = document.createElement("div");
  div.className = "l-" + cls;
  div.textContent = msg;
  logEl.appendChild(div);
  logEl.scrollTop = logEl.scrollHeight;
  while (logEl.children.length > 80) logEl.removeChild(logEl.firstChild);
}

function updateTopbar() {
  floorInfo.textContent = G.state === "town" ? `街 💰${G.gold}` : `B${G.floor}F 💰${G.gold}`;
}

function newFloor() {
  G.board = makeBoard(G.floor);
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
      // 到達可能マスをハイライト: 隣接(1歩)は明るいグロー、遠隔は薄い枠
      if (reachable && reachable.has(x + "," + y)) {
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
    // 表面: 羊皮紙 (グラデーション + テクスチャ感)
    const cleared = cell.cleared && cell.type !== "stairs" && cell.type !== "start";
    const fg = vctx.createLinearGradient(0, 0, 0, r.h);
    if (cleared) { fg.addColorStop(0, "#a59c78"); fg.addColorStop(1, "#8d8462"); }
    else { fg.addColorStop(0, "#e8e0c2"); fg.addColorStop(1, "#cfc5a2"); }
    vctx.fillStyle = fg;
    vctx.fillRect(0, 0, r.w, r.h);
    vctx.strokeStyle = "#6e6448";
    vctx.lineWidth = 2;
    vctx.strokeRect(1, 1, r.w - 2, r.h - 2);
    vctx.strokeStyle = "rgba(110,100,72,0.35)";
    vctx.lineWidth = 1;
    vctx.strokeRect(3.5, 3.5, r.w - 7, r.h - 7);

    const cx = r.w / 2, cy = r.h / 2;
    const icon =
      cell.type === "monster" && !cell.cleared ? MONSTERS[cell.monsterKey] :
      cell.type === "chest" && !cell.cleared ? ICONS.chest :
      cell.type === "trap" && !cell.cleared ? ICONS.trap :
      cell.type === "fountain" && !cell.cleared ? ICONS.fountain :
      cell.type === "corpse" && !cell.cleared ? (cell.corpseWarm ? ICONS.corpseWarm : ICONS.corpse) :
      cell.type === "stairs" ? ICONS.stairs :
      cell.type === "start" ? ICONS.upstairs : null;
    if (icon) {
      // あたたかい死体はうっすら発光させて「魂が宿る」ことを示す
      if (cell.type === "corpse" && cell.corpseWarm && !cell.cleared) {
        vctx.save();
        const pulse = 0.4 + 0.3 * Math.sin(performance.now() * 0.004 + cx);
        vctx.globalAlpha = pulse;
        const g = vctx.createRadialGradient(cx, cy, 2, cx, cy, 20);
        g.addColorStop(0, "rgba(155,232,255,0.9)");
        g.addColorStop(1, "rgba(155,232,255,0)");
        vctx.fillStyle = g;
        vctx.fillRect(cx - 22, cy - 22, 44, 44);
        vctx.restore();
      }
      // アイコンの足元影
      vctx.fillStyle = "rgba(60,50,30,0.3)";
      vctx.beginPath();
      vctx.ellipse(cx, cy + 14, 13, 3.5, 0, 0, Math.PI * 2);
      vctx.fill();
      drawSprite(vctx, icon, cx, cy, 3);
    }
    // クリア済みは踏破マーク
    if (cleared && cell.type !== "empty") {
      vctx.fillStyle = "rgba(40,40,30,0.35)";
      vctx.fillRect(0, 0, r.w, r.h);
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
        startBattle(spawnCardEnemies(cell.monsterKey, G.floor), cell);
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

// 死体: 「まだあたたかい死体」からのみ魂を回収できる (死体の職業に応じた魂)
function resolveCorpse(cell) {
  const clsKey = cell.corpseClass || "fighter";
  const clsLabel = SOUL_CLASSES[clsKey].label;
  if (!cell.corpseWarm) {
    // 風化した死体: 魂(オブジェクト)は失われているが、残り滓から Soul を得られる
    cell.cleared = true;
    const essence = 6 + G.floor * 3 + rand(6);
    runGainSoulPts(essence);
    log(`風化した死体（${clsLabel}）から ✦${essence} Soul を集めた。`, "win");
    showEvent({
      sprite: ICONS.corpse, title: `風化した死体（${clsLabel}）`, accent: "#8c866f", banner: "— 亡骸 —",
      lines: ["宿っていた魂はとうに抜け落ちている。", `残り滓から ✦${essence} Soul を集めた。`],
      onClose: () => renderBoard(),
    });
    return;
  }
  // あたたかい死体: 回収するか立ち去るか選べる。立ち去れば死体は残る。
  showChoice(`まだあたたかい死体（${clsLabel}）。魂が宿っている。`, [
    { label: "✦ 魂を回収する", fn: () => collectSoul(cell, clsKey, clsLabel) },
    { label: "🚶 立ち去る", fn: () => { log("死体に手を触れず、立ち去った。", "sys"); renderBoard(); } },
  ], ICONS.corpseWarm, { banner: "✦ あたたかい死体 ✦", accent: SOUL_CLASSES[clsKey].glow });
}

function collectSoul(cell, clsKey, clsLabel) {
  cell.cleared = true;
  const lvl = 1 + (Math.random() < 0.3 ? 1 : 0) + (G.floor >= 3 ? 1 : 0);
  // 部位はランダム、ランクは抽選 (優秀/偉大/伝説は激レア)
  const soul = makeSoul(clsKey, lvl, null, rollSoulRank());
  acquireSoul(soul, `まだあたたかい死体（${clsLabel}）に宿っていた魂だ。`);
}

// 魂の入手処理 (共通): ストック追加・クエスト進捗・ランクに応じた演出
function acquireSoul(soul, sourceLine) {
  runGainSoul(soul);
  questProgress("soul", null, 1);
  const rank = SOUL_RANKS[soul.rank || "normal"];
  const rare = rank.order >= 1;
  SFX.itemget(); buzz(rare ? [0, 40, 50, 40, 50, 150] : [0, 30, 60, 30]);
  log(`${soulName(soul)} を手に入れた！`, "win");
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

// 階段: 降りるか選ぶ
function askDescend(cell) {
  const boss = G.floor >= MAX_FLOOR;
  showChoice(
    boss ? "下り階段だ。奥に巨大な気配…降りる？" : `下り階段を見つけた。地下 ${G.floor + 1} 階へ降りる？`,
    [
      { label: boss ? "⚔ 意を決して降りる" : "▼ 降りる", danger: boss, fn: () => {
        if (boss) { log("階段の先に巨大な影が…！", "dmg"); startBattle(spawnBossEnemies(), cell); }
        else descend();
      } },
      { label: "✋ まだ探索する", fn: () => { renderBoard(); } },
    ],
    ICONS.stairs,
    boss ? { banner: "⚠ 不穏な気配 ⚠", accent: "#d4504e" } : { banner: "✦ 発見 ✦" }
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
      onClose: () => startBattle(spawnMimic(G.floor), cell),
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
  // 通常: 宝 (ゴールド or 装備/アイテム)
  if (Math.random() < 0.6) {
    const got = giveItem(randomLoot(G.floor));
    if (got) { showItemGet(got.item, got.who, done); return; } // 演出後に done
    SFX.chest();
    if (done) done();
  } else {
    SFX.chest();
    const g = 10 + G.floor * 12 + rand(30);
    runGainGold(g);
    updateTopbar();
    log(`宝箱から ${g} ゴールドを手に入れた！`, "win");
    showEvent({
      sprite: ICONS.gold, title: "ゴールド発見！", accent: "#e8c24a", banner: "✦ 宝箱の中身 ✦", sparkle: true,
      lines: [`${g} ゴールドを手に入れた！`], onClose: done || (() => renderBoard()),
    });
  }
}

// 戦闘勝利後の宝箱 (必ず出現)。罠やミミックはなしで安全に開封
function battleChest() {
  showChoice("宝箱が現れた！ 開ける？", [
    { label: "🔓 開ける", fn: () => rollChest(null, false, () => { if (G.state === "board") renderBoard(); }) },
    { label: "✋ 開けない", fn: () => { renderBoard(); } },
  ], ICONS.chest, { banner: "⚔ 勝利 ⚔" });
}

// 階層に応じた宝のテーブル
function randomLoot(floor) {
  const common = ["herb", "antidote", "manaDrop", "dagger", "cap", "leatherBoots", "powerRing", "guardAmulet", "woodShield"];
  const rare = ["shortSword", "warHammer", "magicStaff", "leatherArmor", "ironHelm", "swiftRing", "lifeAmulet", "kiteShield"];
  const epic = ["battleAxe", "plateArmor", "ironGreaves", "cursedBlade"];
  const r = Math.random();
  if (floor >= 2 && r < 0.18) return epic[rand(epic.length)];
  if (r < 0.45) return rare[rand(rare.length)];
  return common[rand(common.length)];
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

// 軽量トースト通知 (レベルアップなどの祝福演出)
function showToast(text) {
  const t = el("div", "toast", text);
  document.body.appendChild(t);
  setTimeout(() => t.classList.add("show"), 20);
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 400); }, 2200);
}

// ---- 戦闘 ----
function startBattle(enemies, cell) {
  G.battleCell = cell;
  G.state = "combat";
  
  combatMenu.classList.remove("hidden");
  log(`${enemies.map((e) => e.name).join("・")} が現れた！`, "dmg");
  // ボス戦は専用テーマ。図鑑にも遭遇を記録
  playBgm(enemies.some((e) => e.mon.boss) ? "boss" : "battle");
  for (const e of enemies) codexSeeMonster(e.key);
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
    const size = e.mon.boss ? 14 : 9;
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
    combatMenu.appendChild(el("div", "who", `▶ ${actor.name} のターン ・ 敵タップで攻撃`));
    const row = el("div", "row");
    row.appendChild(btn("⚔ 攻撃", () => act("attack")));
    if (actor.spells.length) row.appendChild(btn("✦ 呪文", () => showSpells(actor)));
    else row.appendChild(btn("✦ 呪文", () => log("呪文を使えない", "sys")));
    row.appendChild(btn("🛡 防御", () => act("defend")));
    row.appendChild(btn("🏃 逃走", () => act("run")));
    combatMenu.appendChild(row);
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
function combatStep() {
  const b = G.battle;
  if (b.result) { endBattle(); return; }
  if (b.phase === "input") { G.animating = false; renderCombat(); return; }
  if (b.phase === "enemy") {
    G.animating = true;
    combatMenu.innerHTML = "";
    renderCombatCanvas();
    autosave(true); // 敵の手番を確定 (やり直し不可)
    // 一瞬の間を置いてから敵が動く (ドラクエ風)
    setTimeout(() => {
      const res = b.enemyAct();
      animateResult(res, postResolve);
    }, 260);
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
  if (b.result) { G.animating = false; setTimeout(endBattle, 300); return; }
  b.advance();
  autosave(true);
  setTimeout(combatStep, 150);
}

// 結果オブジェクトを演出 (踏み込み → 着弾 → 余韻)
function animateResult(res, done) {
  const t0 = performance.now();
  const WIND = res.side === "enemy" ? 170 : 90;
  const TOTAL = WIND + 360;
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
  const n = res.spellName || "";
  if (n.includes("ハリト")) return "#ff8a3c"; // 炎系
  if (res.spellKind === "sleep") return "#9ad1ff";
  return "#b06bff";
}

// 着弾の瞬間: 効果音・エフェクト生成・ダメージ表示
function applyImpact(res) {
  const fx = G.fx;
  const now = performance.now();
  if (res.action === "defend") { SFX.select(); return; }
  if (res.action === "sleep" || res.action === "run") { SFX.miss(); return; }

  // 効果音 + 振動
  if (res.action === "spell") {
    if (res.spellKind === "heal") SFX.heal();
    else if (res.spellName && res.spellName.includes("ハリト")) SFX.fire();
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
      if (res.action === "spell" && res.spellKind !== "heal") {
        fx.magic.push({ x: pos.cx, y: pos.cy, t0: now, color: magicColor(res) });
      } else if (res.action === "attack") {
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
      } else if (!h.miss) {
        partyHit = true;
        G.partyFx.set(h.target, "hit");
        fx.floats.push({ x: view.width / 2, y: view.height - 26, text: String(h.dmg), color: "#ff6b6b", t0: now });
        if (h.died) anyDeath = true;
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
    const { exp, gold } = b.rewards();
    runGainGold(gold);
    // 倒した敵から Soul(魂) を得る (館で魂のレベルアップに使える)
    const essence = b.enemies.reduce((a, e) => a + (e.alive ? 0 : Math.max(1, Math.round(e.exp * 0.6))), 0);
    runGainSoulPts(essence);
    updateTopbar();
    log(`勝利！ ${gold} ゴールド と ✦${essence} Soul を得た。`, "win");
    const alive = G.party.filter((x) => x.alive);
    let lvDelay = 0;
    for (const p of alive) {
      const msgs = gainExp(p, Math.floor(exp / alive.length));
      msgs.forEach((m) => log(m, "win"));
      if (msgs.length) {
        SFX.levelup();
        buzz([0, 30, 40, 30, 40, 120]);
        const lvl = p.level;
        setTimeout(() => showToast(`⬆ LEVEL UP!  ${p.name} は Lv${lvl} になった！`), 400 + lvDelay);
        lvDelay += 1000;
      }
    }
    SFX.victory();
    // 討伐クエストの進捗 (倒した敵を集計)
    for (const e of b.enemies) { if (!e.alive) questProgress("kill", e.key); }
    // 人型の敵はまれに魂を落とす (レアドロップ)
    const HUMANOID_SOUL = { kobold: "fighter", orc: "knight", skeleton: "thief", wraith: "mage" };
    for (const e of b.enemies) {
      if (e.alive || !HUMANOID_SOUL[e.key]) continue;
      if (Math.random() < 0.08) {
        const s = makeSoul(HUMANOID_SOUL[e.key], 1 + (G.floor >= 2 ? 1 : 0), null, rollSoulRank());
        runGainSoul(s);
        questProgress("soul", null, 1);
        const rk = SOUL_RANKS[s.rank || "normal"];
        log(`${e.name}が ${soulName(s)} を落とした！`, "win");
        setTimeout(() => showToast(`${rk.order >= 2 ? "🌟" : "✦"} ${soulName(s)} を入手`), 600);
      }
    }
    const wasBoss = b.enemies.some((e) => e.mon.boss);
    if (wasBoss) G.dragonSlain = true;
    if (G.battleCell) G.battleCell.cleared = true;
    finishToBoard();
    if (wasBoss) { victory(); return; }
    // 勝利後は必ず宝箱が出現
    setTimeout(battleChest, 350);
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

  const r = G.run || { gold: 0, soulPts: 0, items: [], souls: [] };
  combatMenu.classList.remove("hidden");
  combatMenu.innerHTML = "";
  combatMenu.appendChild(el("div", "who", "💀 全滅"));
  combatMenu.appendChild(el("div", "who", `今回の戦利品: 💰${r.gold} ✦${r.soulPts} ・ 装備/アイテム ${r.items.length} ・ 魂 ${r.souls.length}`));

  // 共通: 街へ戻る (死亡人業は連れ帰りを待つ)
  const goTown = () => { if (townBtn) townBtn.classList.add("hidden"); combatMenu.classList.add("hidden"); returnToTown(); };

  // Red Soul の加護: 戦利品を守って帰還 (人業は復活せず、連れ帰りを待つ)
  if (G.redSoul >= GUARDIAN_COST) {
    const guard = btn(`🔴 赤い魂 ×${GUARDIAN_COST} で戦利品を守って帰還`, () => {
      G.redSoul -= GUARDIAN_COST;
      G.run = null; // 戦利品を確定 (没収しない)
      SFX.levelup(); buzz([0, 30, 40, 30]);
      log("赤い魂が戦利品を守った。死した人業は連れ帰りを待つ。", "win");
      goTown();
    });
    guard.className = "btn primary";
    combatMenu.appendChild(guard);
  }
  // そのまま撤退: 今回の戦利品をすべて失う
  const retreat = btn("🏚 撤退する (今回の戦利品を失う)", () => {
    forfeitRun();
    log("今回の探索で得たものはすべて失われた…", "dmg");
    goTown();
  });
  retreat.className = "btn danger";
  combatMenu.appendChild(retreat);
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
      <div class="name">${p.name}${p.ailment === "poison" ? ' <span class="ail">☠</span>' : ""}</div>
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
  const f = G.town.facility;
  if (f === "mansion") return renderMansion();
  if (f === "altar") return renderAltar();
  if (f === "tavern") return renderTavern();
  if (f === "inn") return renderInn();
  if (f === "shop") return renderShop();
  if (f === "palace") return renderPalace();
  if (f === "shrine") return renderShrine();
  if (f === "codexMon") return renderCodexMon();
  if (f === "codexItem") return renderCodexItem();
  renderTownHub();
}

function renderTownHub() {
  townEl.appendChild(townHeader("辺境の街 ロアダル", false));

  const intro = el("div", "tw-intro");
  intro.appendChild(el("div", "tw-introt", "魂の迷宮 — Dungeon of Souls"));
  intro.appendChild(el("div", "tw-intros", `深淵 B${G.maxFloorReached}F まで到達`));
  townEl.appendChild(intro);

  // 施設グリッド
  const grid = el("div", "tw-grid");
  for (const fac of FACILITIES) {
    const c = el("div", "tw-fac");
    c.appendChild(el("div", "tw-faci", fac.icon));
    c.appendChild(el("div", "tw-facn", fac.name));
    c.appendChild(el("div", "tw-facd", fac.desc));
    c.addEventListener("click", () => { SFX.select(); G.town.facility = fac.key; renderTown(); });
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
  if (!G.party.length) list.appendChild(el("div", "tw-empty", "人業がいない。館で仕立てよう。"));
  roster.appendChild(list);
  townEl.appendChild(roster);

  // 迷宮へ
  const dive = btn(`🕳 迷宮へ降りる (B${G.maxFloorReached}F)`, tryEnterDungeon);
  dive.className = "btn primary tw-dive";
  townEl.appendChild(dive);
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
  { key: "enhance", icon: "✦", name: "魂の強化 / 管理", desc: "Soulで魂を鍛える・確認" },
  { key: "manage", icon: "🏚", name: "人業 作成 / 管理", desc: "空の人業を購入・解体" },
];

function renderMansion() {
  const sub = G.town.sub;
  if (sub === "party") return renderMansionParty();
  if (sub === "altar") return renderAltar();
  if (sub === "enhance") return renderMansionEnhance();
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
  townEl.appendChild(townHeader("魂の強化 / 管理", "mansion"));
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

// 魂1つの強化行 (ステータス + ✦で鍛えるボタン)
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
  const st = soulStats(s);
  info.appendChild(el("div", "tw-soulst", `HP+${st.hp} ${st.mp ? `MP+${st.mp} ` : ""}攻+${st.atk} 防+${st.def} 速+${st.spd}`));
  r.appendChild(info);
  if (s.level >= SOUL_MAX_LEVEL) {
    r.appendChild(el("div", "tw-chiphp", "MAX"));
  } else {
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
    r.appendChild(b);
  }
  return r;
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
  const memSouls = dollSouls(d).filter((s) => s.memory > 0);
  const lines = ["宿した魂はストックに戻る。", "装備していた品も外れる。"];
  if (!d.alive && memSouls.length) lines.push(`砕けた ${memSouls.length} つの魂は「記憶」を宿し、より強く蘇る。`);
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
  const tierTxt = d.tier === "advanced" ? "5部位一致 — 上位スキル解放" : d.tier === "basic" ? "3部位以上 — 基本スキル" : "2部位以下 — スキルなし";
  sum.appendChild(el("div", "tw-sumt", tierTxt));
  sum.appendChild(el("div", "tw-sumst", `HP${d.maxhp} MP${d.maxmp} 攻${d.atk} 防${d.def} 速${d.spd}`));
  if (d.spells.length) sum.appendChild(el("div", "tw-sumsk", "習得: " + d.spells.map((k) => SPELLS[k] ? SPELLS[k].name : k).join("・")));
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
      const p2 = el("div", "tw-parts2" + (soul.memory > 0 ? " mem" : ""), `${soul.memory > 0 ? "✦" : ""}${SOUL_CLASSES[soul.clsKey].label}Lv${soul.level}`);
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
      if (cur.level >= SOUL_MAX_LEVEL) {
        trainBox.appendChild(el("div", "tw-note", `${soulName(cur)} は最大レベルだ。`));
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
      info.appendChild(el("div", "tw-soulst",
        `HP+${st.hp} ${st.mp ? `MP+${st.mp} ` : ""}攻+${st.atk} 防+${st.def} 速+${st.spd}`));
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
  if (!s || s.level >= SOUL_MAX_LEVEL) return;
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
const QUEST_DEFS = [
  { id: "q_slime", name: "ぬめる脅威", desc: "スライムを 3体 倒す", type: "kill", key: "slime", goal: 3, reward: { gold: 80 } },
  { id: "q_bat", name: "夜翼の駆除", desc: "ジャイアントバットを 3体 倒す", type: "kill", key: "bat", goal: 3, reward: { gold: 100 } },
  { id: "q_souls", name: "魂の回収者", desc: "死体から魂を 3個 回収する", type: "soul", goal: 3, reward: { gold: 150 } },
  { id: "q_b2", name: "深淵への一歩", desc: "地下2階に到達する", type: "floor", goal: 2, reward: { gold: 150, soul: "priest" } },
  { id: "q_skel", name: "骸の掃除", desc: "スケルトンを 2体 倒す", type: "kill", key: "skeleton", goal: 2, reward: { gold: 180, soul: "knight" } },
  { id: "q_dragon", name: "竜殺し", desc: "深淵の主ドラゴンを討つ", type: "kill", key: "dragon", goal: 1, reward: { gold: 1000 } },
];

function initQuests() {
  G.quests = QUEST_DEFS.map((q) => ({ ...q, state: "avail", progress: 0 }));
}

// 進行中クエストへ進捗を加算。達成したら通知
function questProgress(type, key, n = 1) {
  for (const q of G.quests) {
    if (q.state !== "active" || q.type !== type) continue;
    if (q.type === "kill" && q.key !== key) continue;
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

  // --- クエスト掲示板 ---
  townEl.appendChild(el("div", "tw-h", "依頼の掲示板"));
  const ql = el("div", "tw-mlist");
  for (const q of G.quests) {
    if (q.state === "claimed") continue;
    const row = el("div", "tw-quest" + (q.state === "done" ? " done" : ""));
    const info = el("div", "tw-chipi");
    info.appendChild(el("div", "tw-chipn", "📜 " + q.name));
    info.appendChild(el("div", "tw-chipc", q.desc));
    const rw = [`💰${q.reward.gold}`];
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
    ql.appendChild(row);
  }
  if (![...ql.children].length) ql.appendChild(el("div", "tw-empty", "依頼はすべて果たされた。"));
  townEl.appendChild(ql);
}

function claimQuest(q) {
  q.state = "claimed";
  G.gold += q.reward.gold;
  let msg = `報酬 💰${q.reward.gold}`;
  if (q.reward.soul) {
    const s = makeSoul(q.reward.soul, 2);
    G.souls.push(s);
    msg += ` と ${soulName(s)}`;
  }
  SFX.itemget(); buzz([0, 30, 60, 30]);
  log(`「${q.name}」を報告した。${msg} を受け取った！`, "win");
  showToast(`✅ ${q.name} — ${msg}`);
  renderTown();
}

// ---- 王宮: 勅命 (メインストーリー) + 図鑑 ----
const STORY_EVENTS = [
  {
    title: "王の勅命",
    cond: () => true,
    text: [
      "「よくぞ参った、魂繰りの者よ。」",
      "「この地の底に巣食う迷宮は、死者の魂を喰らい肥え続けておる。」",
      "「人業の軍を率い、深淵の主を討て。報酬は望むままに。」",
    ],
    reward: { gold: 100 },
  },
  {
    title: "深淵のざわめき",
    cond: () => G.maxFloorReached >= 2,
    text: [
      "「地下2階まで達したか。見事なものよ。」",
      "「だが斥候によれば、さらに下の層では骸が独りでに立ち上がるという。」",
      "「気をつけよ。新しき魂ほど、迷宮は欲しがる。」",
    ],
    reward: { gold: 200 },
  },
  {
    title: "竜の影",
    cond: () => G.maxFloorReached >= 3,
    text: [
      "「最深部に巨大な竜の気配があるそうだな。」",
      "「あれこそ迷宮の主。喰らった魂で幾百年を生きた怪物だ。」",
      "「これを討てば、そなたの名はこの国の歴史に刻まれよう。」",
    ],
    reward: { gold: 300, soul: "fighter" },
  },
  {
    title: "魂の解放",
    cond: () => G.dragonSlain,
    text: [
      "「……討ったか。本当に、討ちおったか！」",
      "「迷宮に囚われし幾千の魂は、これで安らかに巡るだろう。」",
      "「礼を言うぞ、英雄よ。この国はそなたの剣に救われた。」",
    ],
    reward: { gold: 2000 },
  },
];

function renderPalace() {
  townEl.appendChild(townHeader("王宮"));
  townEl.appendChild(el("div", "tw-lead", "玉座の間。王の勅命を聞き、書庫で迷宮の記録を紐解ける。"));

  // ストーリー進行
  townEl.appendChild(el("div", "tw-h", "玉座の間 — 勅命"));
  const ev = STORY_EVENTS[G.story];
  if (ev && ev.cond()) {
    const b = btn(`👑 謁見する 「${ev.title}」`, () => playStoryEvent(ev));
    b.className = "btn primary tw-add";
    townEl.appendChild(b);
  } else if (ev) {
    townEl.appendChild(el("div", "tw-note",
      G.story === 1 ? "「地下2階に到達したら、また参れ」" :
      G.story === 2 ? "「地下3階に到達したら、また参れ」" :
      "「深淵の主を討ち果たしたら、また参れ」"));
  } else {
    townEl.appendChild(el("div", "tw-note", "「そなたに語るべきことは、もう何もない。良き旅を。」"));
  }

  // 図鑑
  townEl.appendChild(el("div", "tw-h", "王宮書庫 — 図鑑"));
  const row = el("div", "tw-grid");
  const monBtn = el("div", "tw-fac");
  monBtn.appendChild(el("div", "tw-faci", "🐉"));
  monBtn.appendChild(el("div", "tw-facn", "モンスター図鑑"));
  monBtn.appendChild(el("div", "tw-facd", `${Object.keys(G.codex.mon).length}/${Object.keys(MONSTERS).length} 種`));
  monBtn.addEventListener("click", () => { G.town.facility = "codexMon"; renderCodexMon(); });
  row.appendChild(monBtn);
  const itemBtn = el("div", "tw-fac");
  itemBtn.appendChild(el("div", "tw-faci", "⚔"));
  itemBtn.appendChild(el("div", "tw-facn", "アイテム図鑑"));
  itemBtn.appendChild(el("div", "tw-facd", `${Object.keys(G.codex.item).length}/${Object.keys(ITEMS).length} 種`));
  itemBtn.addEventListener("click", () => { G.town.facility = "codexItem"; renderCodexItem(); });
  row.appendChild(itemBtn);
  townEl.appendChild(row);
}

function playStoryEvent(ev) {
  G.prompt = true;
  const wrap = el("div", "confirm-overlay");
  const card = el("div", "ig-card story-card");
  card.style.borderColor = "#c9a227";
  card.style.boxShadow = "0 0 50px #c9a22755";
  const bn = el("div", "ig-banner", "👑 " + ev.title + " 👑");
  bn.style.color = "#ffd84a";
  card.appendChild(bn);
  for (const t of ev.text) card.appendChild(el("div", "story-line", t));
  const rw = [`💰${ev.reward.gold}`];
  if (ev.reward.soul) rw.push(`${SOUL_CLASSES[ev.reward.soul].label}の魂`);
  card.appendChild(el("div", "story-reward", "下賜: " + rw.join(" + ")));
  const ok = btn("拝命する", () => {
    wrap.remove();
    G.prompt = false;
    G.gold += ev.reward.gold;
    if (ev.reward.soul) G.souls.push(makeSoul(ev.reward.soul, 2));
    G.story++;
    SFX.itemget(); buzz([0, 30, 60, 30]);
    log(`勅命「${ev.title}」を拝命した。`, "win");
    renderTown();
  });
  ok.className = "btn primary ig-ok";
  card.appendChild(ok);
  wrap.appendChild(card);
  document.body.appendChild(wrap);
}

// ---- 図鑑 (王宮書庫) ----
function codexSeeMonster(key) { if (key) G.codex.mon[key] = true; }
function codexSeeItem(id) { if (id) G.codex.item[id] = true; }

function renderCodexMon() {
  townEl.innerHTML = "";
  townEl.appendChild(townHeader("モンスター図鑑", "palace"));
  const grid = el("div", "cdx-grid");
  for (const key of Object.keys(MONSTERS)) {
    const m = MONSTERS[key];
    const seen = G.codex.mon[key];
    const c = el("div", "cdx-card" + (seen ? "" : " unknown"));
    const art = el("div", "cdx-art");
    if (seen) art.appendChild(spriteCanvas(m, 3));
    else art.appendChild(el("div", "cdx-q", "?"));
    c.appendChild(art);
    c.appendChild(el("div", "cdx-name", seen ? m.name : "？？？"));
    if (seen) c.appendChild(el("div", "cdx-stat", `HP${m.maxhp} 攻${m.atk} 防${m.def} 速${m.spd}`));
    grid.appendChild(c);
  }
  townEl.appendChild(grid);
}

function renderCodexItem() {
  townEl.innerHTML = "";
  townEl.appendChild(townHeader("アイテム図鑑", "palace"));
  const grid = el("div", "cdx-grid");
  for (const id of Object.keys(ITEMS)) {
    const it = ITEMS[id];
    const seen = G.codex.item[id];
    const c = el("div", "cdx-card" + (seen ? "" : " unknown"));
    const art = el("div", "cdx-art");
    if (seen) art.appendChild(spriteCanvas(it, 3));
    else art.appendChild(el("div", "cdx-q", "?"));
    c.appendChild(art);
    c.appendChild(el("div", "cdx-name", seen ? it.name : "？？？"));
    if (seen && it.desc) c.appendChild(el("div", "cdx-stat", it.desc));
    grid.appendChild(c);
  }
  townEl.appendChild(grid);
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
  clearFallen(d);
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
// 商店タブ: スロット種別ごとに切り替え
const SHOP_TABS = [
  { key: "use", label: "道具", slots: ["use"] },
  { key: "weapon", label: "武器", slots: ["weapon"] },
  { key: "shield", label: "盾", slots: ["shield"] },
  { key: "body", label: "防具", slots: ["body"] },
  { key: "gear", label: "頭/小手/足", slots: ["head", "hands", "feet"] },
  { key: "acc", label: "装飾", slots: ["acc"] },
  { key: "sell", label: "売る", slots: null },
];
let shopTab = "weapon";
const sellPrice = (it) => Math.max(1, Math.floor((it.price || 10) / 2));

function renderShop() {
  townEl.appendChild(townHeader("ボルタック商店"));

  const tabs = el("div", "tw-dolltabs");
  for (const t of SHOP_TABS) {
    const b = btn(t.label, () => { shopTab = t.key; renderTown(); });
    b.className = "tw-dolltab" + (shopTab === t.key ? " active" : "");
    tabs.appendChild(b);
  }
  townEl.appendChild(tabs);

  if (shopTab === "sell") return renderShopSell();

  const tabDef = SHOP_TABS.find((t) => t.key === shopTab);
  const buy = el("div", "tw-shoplist");
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
    if (G.gold < price) b.disabled = true;
    r.appendChild(b);
    buy.appendChild(r);
  }
  if (!any) buy.appendChild(el("div", "tw-empty", "この種類の在庫は売り切れだ。"));
  townEl.appendChild(buy);
  townEl.appendChild(el("div", "tw-note", "買うと在庫が減る。売った品は在庫に並ぶ (売値は1/2)。"));
}

function renderShopSell() {
  const sell = el("div", "tw-shoplist");
  let any = false;
  // 編成中の人業の所持品 (装備中は除く) を売却対象に
  for (const m of G.party) {
    m.items.forEach((it) => {
      any = true;
      const price = sellPrice(it);
      const r = el("div", "tw-shoprow");
      const ic = el("span", "tw-chips"); ic.appendChild(spriteCanvas(it, 2)); r.appendChild(ic);
      const info = el("div", "tw-chipi");
      info.appendChild(el("div", "tw-chipn", it.name));
      info.appendChild(el("div", "tw-chipc", `${m.name} の所持品`));
      r.appendChild(info);
      const b = btn(`💰${price} で売る`, () => sellItem(m, it, price));
      b.className = "tw-small";
      r.appendChild(b);
      sell.appendChild(r);
    });
  }
  if (!any) sell.appendChild(el("div", "tw-empty", "売れる品がない (装備中の品は外してから)。"));
  townEl.appendChild(sell);
  townEl.appendChild(el("div", "tw-note", "売った装備・道具は商店の在庫に並ぶ。"));
}

function sellItem(owner, it, price) {
  const idx = owner.items.indexOf(it);
  if (idx < 0) return;
  owner.items.splice(idx, 1);
  G.gold += price;
  // 在庫に積む (ボルタック方式)
  if (it.id) G.shopStock[it.id] = (G.shopStock[it.id] || 0) + 1;
  codexSeeItem(it.id);
  SFX.select();
  log(`${it.name} を売った (+💰${price})。商店に並んだ。`, "win");
  renderTown();
}

function buyItem(id, price) {
  if (G.gold < price) { log("お金が足りない。", "sys"); return; }
  if ((G.shopStock[id] || 0) <= 0) { log("在庫切れだ。", "sys"); return; }
  const who = G.party.find((m) => m.alive && m.items.length < MAX_ITEMS);
  if (!who) { log("所持品に空きがない。", "sys"); return; }
  const it = cloneItem(id);
  if (!it) return;
  G.gold -= price;
  G.shopStock[id]--;
  who.items.push(it);
  codexSeeItem(id);
  SFX.select();
  log(`${it.name} を購入した (${who.name})。`, "win");
  renderTown();
}

// ---- 街 ⇄ 迷宮 の出入り ----
function tryEnterDungeon() {
  if (!G.party.some((p) => p.alive)) { log("動ける人業がいない。", "sys"); return; }
  // 魂未封印で極端に弱い人業がいたら注意 (任意続行)
  SFX.stairs();
  townEl.classList.add("hidden");
  G.town.facility = null;
  G.floor = G.maxFloorReached;
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
  playBgm("town");
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

  // ===== ヘッダ: 肖像 + 名前 + 属性-種族-職業 + 前後/閉じる + タブ =====
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

  // タブ: ステータス(統合) / 魂
  const tabs = el("div", "st-tabbar");
  const tMain = btn("ステータス", () => { G.statusTab = "main"; stSel = null; renderStatus(); });
  tMain.className = "st-tab2" + (G.statusTab !== "soul" ? " active" : "");
  tabs.appendChild(tMain);
  if (p.isDoll) {
    const tSoul = btn("魂", () => { G.statusTab = "soul"; renderStatus(); });
    tSoul.className = "st-tab2" + (G.statusTab === "soul" ? " active" : "");
    tabs.appendChild(tSoul);
  }
  statusEl.appendChild(tabs);

  if (G.statusTab === "soul" && p.isDoll) { statusEl.appendChild(renderSoulTab(p)); return; }

  // ===== 統合タブ: 上から ステータス → 装備 → 所持品 =====
  // 1. ステータス
  statusEl.appendChild(renderStatTab(p));

  // アイテム選択中は情報パネル (装備/使う/捨てる等の操作) を直下に表示
  if (stSel) statusEl.appendChild(renderItemDetail(p, stSel));

  // 2. 装備 (8スロット)
  statusEl.appendChild(el("div", "st-h", "装備"));
  const eqList = el("div", "st-eqlist");
  for (const slot of SLOTS) {
    const it = p.equip[slot];
    const row = el("div", "st-eqrow" + (stSel && stSel.from === "equip" && stSel.key === slot ? " sel" : "") + (it ? "" : " empty"));
    const si = el("span", "st-sicon"); si.appendChild(spriteCanvas(SLOT_ICONS[slot] || SLOT_ICONS.weapon, 2)); row.appendChild(si);
    const ii = el("span", "st-iicon"); if (it) ii.appendChild(spriteCanvas(it, 2)); row.appendChild(ii);
    row.appendChild(el("span", "st-ename", it ? it.name + (it.cursed ? " 🔒" : "") : SLOT_LABEL[slot]));
    if (it) row.addEventListener("click", () => { stSel = { item: it, from: "equip", key: slot }; renderStatus(); });
    eqList.appendChild(row);
  }
  statusEl.appendChild(eqList);

  // 3. 所持品
  statusEl.appendChild(el("div", "st-h", `所持品 (持ち ${p.items.length}/${MAX_ITEMS})`));
  const invList = el("div", "st-invlist");
  p.items.forEach((it, i) => invList.appendChild(invRow(p, it, { from: "bag", index: i })));
  if (!invList.children.length) invList.appendChild(el("div", "st-empty", "(なし)"));
  statusEl.appendChild(invList);
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
    <div class="st-line">こうげき <b>${p.atk}</b>　ぼうぎょ <b>${p.def}</b></div>
    <div class="st-line">すばやさ <b>${p.spd}</b>　AC <b>${p.ac}</b></div>
    ${p.spells && p.spells.length ? `<div class="st-line">習得: ${p.spells.map((k) => SPELLS[k] ? SPELLS[k].name : k).join("・")}</div>` : ""}
    <div class="st-line ${p.ailment ? "st-bad" : ""}">状態: ${p.ailment === "poison" ? "毒" : (p.alive ? "正常" : "戦闘不能")}</div>`;
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

  // ウィザードリィ風の能力値 (STR/IQ/PIE/VIT/AGI/LUK)
  if (p.isDoll && p.attrs) {
    const ab = el("div", "st-attrs");
    for (const k of ATTR_KEYS) {
      const cell = el("div", "st-attr");
      cell.appendChild(el("span", "st-attrk", ATTR_LABEL[k]));
      cell.appendChild(el("span", "st-attrv", String(p.attrs[k])));
      cell.title = ATTR_NAME[k];
      ab.appendChild(cell);
    }
    info.appendChild(ab);
  }

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
      const heal = sp.power + rand(Math.ceil(sp.power * 0.3));
      if (!t.alive && sp.revive) { t.alive = true; t.ailment = null; t.reviveAt = null; clearFallen(t); t.hp = Math.min(t.maxhp, heal); log(`${sp.name}！ ${t.name}が蘇った (HP ${t.hp})`, "heal"); }
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
    p.tier === "advanced" ? "5部位一致 — 上位スキル解放" :
    p.tier === "basic" ? "3部位以上 — 基本スキル習得" : "2部位以下 — スキル未解放"));
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
      else if (s.memory > 0) nm.classList.add("mem");
      info.appendChild(nm);
      // 経験値バー
      const bar = el("div", "st-soulbar");
      const ratio = s.level >= SOUL_MAX_LEVEL ? 1 : s.exp / soulExpToNext(s.level);
      const i = el("i"); i.style.width = Math.round(ratio * 100) + "%"; i.style.background = SOUL_CLASSES[s.clsKey].color;
      bar.appendChild(i);
      info.appendChild(bar);
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

// 魂の詳細パネル: ステータスと、覚える基本スキル/上位スキル
function renderSoulDetail(s) {
  const def = SOUL_CLASSES[s.clsKey];
  const rank = SOUL_RANKS[s.rank || "normal"];
  const d = el("div", "st-souldetail");
  if (rank.color) d.style.borderColor = rank.color;

  // ステータス
  const st = soulStats(s);
  d.appendChild(el("div", "st-sdh", "ステータス"));
  d.appendChild(el("div", "st-sdstat",
    `HP +${st.hp}　MP +${st.mp}　こうげき +${st.atk}　ぼうぎょ +${st.def}　すばやさ +${st.spd}`));
  if (s.memory > 0) d.appendChild(el("div", "st-sdnote", `戦いの記憶 ×${s.memory} (能力 +${Math.min(5, s.memory) * 8}%)`));
  if (rank.order >= 1) d.appendChild(el("div", "st-sdnote", `${rank.label}魂 (能力 ×${rank.mul})`));

  // スキル名の表示 (呪文 or パッシブ)
  const skillLabel = (sk) => {
    const sp = SPELLS[sk.key];
    return `${sp ? sp.name : sk.key}${sp ? `（${sp.desc}）` : ""} — 魂Lv${sk.lvl}で習得`;
  };
  const learned = (sk) => s.level >= sk.lvl;

  // 基本スキル (同職3部位以上で解放)
  d.appendChild(el("div", "st-sdh", "基本スキル（同職の魂 3部位以上）"));
  const basics = [];
  if (def.passive) basics.push({ passive: true, label: def.passive.label });
  for (const sk of def.basic) basics.push({ label: skillLabel(sk), on: learned(sk) });
  if (!basics.length) d.appendChild(el("div", "st-sdnote", "（なし）"));
  for (const b of basics) {
    const line = el("div", "st-sdskill" + (b.passive || b.on ? " on" : ""), (b.passive || b.on ? "✦ " : "○ ") + b.label);
    d.appendChild(line);
  }

  // 上位スキル (同職5部位 / 伝説魂なら3部位)
  d.appendChild(el("div", "st-sdh", "上位スキル（同職の魂 5部位" + (rank.order >= 3 ? " ※伝説は3部位" : "") + "）"));
  if (!def.advanced.length) d.appendChild(el("div", "st-sdnote", "（なし）"));
  for (const sk of def.advanced) {
    d.appendChild(el("div", "st-sdskill adv" + (learned(sk) ? " on" : ""), (learned(sk) ? "★ " : "○ ") + skillLabel(sk)));
  }
  return d;
}

function statLines(it) {
  const parts = [];
  if (it.atk) parts.push(`こうげき ${it.atk > 0 ? "+" : ""}${it.atk}`);
  if (it.def) parts.push(`ぼうぎょ ${it.def > 0 ? "+" : ""}${it.def}`);
  if (it.spd) parts.push(`すばやさ ${it.spd > 0 ? "+" : ""}${it.spd}`);
  if (it.hp) parts.push(`HP ${it.hp > 0 ? "+" : ""}${it.hp}`);
  if (it.mp) parts.push(`MP ${it.mp > 0 ? "+" : ""}${it.mp}`);
  if (it.use && it.use.heal) parts.push(`HP +${it.use.heal}`);
  if (it.use && it.use.mp) parts.push(`MP +${it.use.mp}`);
  if (it.use && it.use.cure) parts.push(`毒を治す`);
  return parts.join("　");
}

// 部位カテゴリ表記
const CAT_LABEL = { weapon: "武器", shield: "盾", body: "防具", head: "頭防具", hands: "小手", feet: "足防具", acc: "装飾品", use: "消耗品" };

// ウィザードリィ風の情報テキスト行
function detailLines(it) {
  const L = [];
  L.push(CAT_LABEL[it.slot] || "");
  if (it.slot === "weapon") {
    const seg = [];
    if (it.hit != null) seg.push(`命中${it.hit >= 0 ? "+" : ""}${it.hit}`);
    if (it.dice) seg.push(`${it.dice}ダメージ`);
    if (it.swings != null) seg.push(`最低攻撃回数: ${it.swings}`);
    if (seg.length) L.push(seg.join(" / "));
    const mod = [];
    if (it.def) mod.push(`ぼうぎょ${it.def >= 0 ? "+" : ""}${it.def}`);
    if (it.spd) mod.push(`すばやさ${it.spd >= 0 ? "+" : ""}${it.spd}`);
    if (it.mp) mod.push(`MP${it.mp >= 0 ? "+" : ""}${it.mp}`);
    if (mod.length) L.push(mod.join(" / "));
  } else if (it.slot === "use") {
    if (it.use && it.use.heal) L.push(`HPを ${it.use.heal} 回復`);
    if (it.use && it.use.mp) L.push(`MPを ${it.use.mp} 回復`);
    if (it.use && it.use.cure) L.push("毒を治す");
  } else {
    const mod = [];
    if (it.def) mod.push(`ぼうぎょ${it.def >= 0 ? "+" : ""}${it.def}`);
    if (it.atk) mod.push(`こうげき${it.atk >= 0 ? "+" : ""}${it.atk}`);
    if (it.spd) mod.push(`すばやさ${it.spd >= 0 ? "+" : ""}${it.spd}`);
    if (it.hp) mod.push(`HP${it.hp >= 0 ? "+" : ""}${it.hp}`);
    if (it.mp) mod.push(`MP${it.mp >= 0 ? "+" : ""}${it.mp}`);
    if (it.def) mod.push(`AC ${-it.def >= 0 ? "+" : ""}${-it.def}`);
    if (mod.length) L.push(mod.join(" / "));
  }
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
  card.appendChild(el("div", "ig-banner", "✦ アイテム発見！ ✦"));
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
// 現在のシーンに合ったBGM名
function sceneBgm() {
  if (G.state === "town") return "town";
  if (G.state === "combat") return (G.battle && G.battle.enemies.some((e) => e.mon.boss)) ? "boss" : "battle";
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
const SAVE_KEY = "dos-save-v1";
// 保存する G のフィールド (アニメーション等の一時状態は除外)
const SAVE_FIELDS = [
  "state", "floor", "maxFloorReached", "board", "px", "py",
  "gold", "soulPts", "redSoul", "dollsPurchased",
  "party", "reserve", "souls", "shopStock", "run", "town",
  "quests", "rumor", "activeRumor", "codex", "story", "dragonSlain",
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
function autosave(force = false) {
  if (!G.party || !G.party.length) return;
  const now = Date.now();
  if (!force && now - _lastSave < 200) return;
  _lastSave = now;
  try {
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

// 保存データを読み込み、G を復元する。成功なら true
function loadGame() {
  let raw;
  try { raw = localStorage.getItem(SAVE_KEY); } catch { return false; }
  if (!raw) return false;
  let snap;
  try { snap = refDeserialize(JSON.parse(raw)); } catch (e) { return false; }
  if (!snap || !snap.party || !snap.party.length) return false;
  for (const k of SAVE_FIELDS) if (k in snap) G[k] = snap[k];
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
  for (const d of [...(G.party || []), ...(G.reserve || [])]) {
    try { recalcDoll(d); } catch {}
  }
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
  if (b.phase === "enemy") { combatStep(); return; }
  // input / target = まだ選択中 → メニュー/対象選択を再表示 (renderCombat 済み)
}

// アプリが裏に回る/閉じられる瞬間に確実に保存
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") autosave(true); });
window.addEventListener("pagehide", () => autosave(true));
window.addEventListener("beforeunload", () => autosave(true));

// 新規プレイの初期化: 人業ロスター・魂ストック・初期装備を整える
function setupNewGame() {
  const { dolls, souls } = createStartingRoster();
  // 初期装備 (器を最低限戦えるようにする)
  const gearByName = {
    ガロ: ["shortSword", "leatherArmor"],
    サリア: ["magicStaff", "robe"],
    ミナ: ["warHammer", "cap"],
  };
  for (const d of dolls) {
    for (const id of (gearByName[d.name] || [])) {
      const it = cloneItem(id);
      if (it) { d.items.push(it); equipItem(d, it); codexSeeItem(id); }
    }
    d.items.push(cloneItem("herb"));
    codexSeeItem("herb");
    recalcDoll(d);
    d.hp = d.maxhp; d.mp = d.maxmp;
  }
  G.party = dolls;
  G.souls = souls;
  G.shopStock = { ...SHOP_INIT_STOCK };
  initQuests();
}

// ---- 起動 ----
function init() {
  // 早期にフックを公開 (起動失敗の誤検出/デバッグ用)
  window.__game = { G, edgeOpen, COLS, ROWS, autosave, loadGame, clearSave };

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
