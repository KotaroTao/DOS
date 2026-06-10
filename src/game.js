// メインゲーム: カードボード探索 ⇄ 戦闘 (モンスターメーカー風)
import { makeBoard, COLS, ROWS } from "./board.js";
import { MONSTERS, HERO, ICONS, drawSprite } from "./sprites.js";
import { createParty, spawnCardEnemies, spawnBossEnemies, spawnMimic, Battle, gainExp, SPELLS, cloneItem } from "./combat.js";
import { initAudio, SFX, playBgm, toggleMute, isMuted } from "./audio.js";
import { spriteCanvas } from "./sprites.js";
import { ITEMS, SLOTS, SLOT_LABEL, SLOT_ICONS, MAX_ITEMS, recalc, equip as equipItem, unequip as unequipItem, canEquip } from "./items.js";

const view = document.getElementById("view");
const vctx = view.getContext("2d");
const logEl = document.getElementById("log");
const partyEl = document.getElementById("party");
const movePad = document.getElementById("move-pad");
const combatMenu = document.getElementById("combat-menu");
const floorInfo = document.getElementById("floor-info");

const MAX_FLOOR = 3;

const G = {
  state: "board",     // board | combat | over
  floor: 1,
  board: null,
  px: 0, py: 0,
  gold: 0,
  party: createParty(),
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
  statusTab: "equip", // ステータス画面のタブ "equip" | "stat"
};

const rand = (n) => Math.floor(Math.random() * n);

function log(msg, cls = "sys") {
  const div = document.createElement("div");
  div.className = "l-" + cls;
  div.textContent = msg;
  logEl.appendChild(div);
  logEl.scrollTop = logEl.scrollHeight;
  while (logEl.children.length > 80) logEl.removeChild(logEl.firstChild);
}

function updateTopbar() {
  floorInfo.textContent = `B${G.floor}F 💰${G.gold}`;
}

function newFloor() {
  G.board = makeBoard(G.floor);
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
      cell.type === "stairs" ? ICONS.stairs :
      cell.type === "start" ? ICONS.start : null;
    if (icon) {
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
        if (onDone) onDone();
      } else {
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
  };

  if (!cell.revealed) {
    SFX.flip();
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
      SFX.trap();
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
          if (died) { SFX.die(); if (!G.party.some((p) => p.alive)) { gameOver(); return; } }
          renderBoard();
        },
      });
      break;
    }
    case "fountain": {
      if (cell.cleared) break;
      cell.cleared = true;
      SFX.heal();
      let cured = false;
      for (const p of G.party) {
        if (!p.alive) continue;
        p.hp = Math.min(p.maxhp, p.hp + Math.ceil(p.maxhp * 0.4));
        p.mp = Math.min(p.maxmp, p.mp + Math.ceil(p.maxmp * 0.5));
        if (p.ailment) cured = true;
        p.ailment = null; // 毒も浄化
      }
      log("癒しの泉だ！ HPとMPが回復し、毒も癒えた。", "heal");
      showEvent({
        sprite: ICONS.fountain, title: "癒しの泉", accent: "#5fb8d6", banner: "✦ 恵み ✦", sparkle: true,
        lines: ["パーティのHPとMPが回復した！", ...(cured ? ["毒も浄化された。"] : [])],
        onClose: () => renderBoard(),
      });
      break;
    }
    case "stairs":
      askDescend(cell);
      break;
  }
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
    SFX.trap();
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
    SFX.trap();
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
    G.gold += g;
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
  G.floor++;
  log("階段を降りていく…", "sys");
  newFloor();
  renderBoard();
}

// ---- 戦闘 ----
function startBattle(enemies, cell) {
  G.battleCell = cell;
  G.state = "combat";
  movePad.classList.add("hidden");
  combatMenu.classList.remove("hidden");
  log(`${enemies.map((e) => e.name).join("・")} が現れた！`, "dmg");
  playBgm("battle");
  G.battle = new Battle(G.party, enemies, log);
  G.fx = null;
  G.animating = false;
  G.enemyPos = {};
  if (G.partyFx) G.partyFx.clear();
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

function renderCombatMenu() {
  const b = G.battle;
  combatMenu.innerHTML = "";
  if (G.animating) return; // アニメーション中は操作不可
  if (b.phase === "input") {
    const actor = b.current;
    highlightActor(actor);
    combatMenu.appendChild(el("div", "who", `▶ ${actor.name} のターン (Lv${actor.level} / 素早さ${actor.spd})`));
    const row = el("div", "row");
    row.appendChild(btn("⚔ 攻撃", () => act("attack")));
    if (actor.spells.length) row.appendChild(btn("✦ 呪文", () => showSpells(actor)));
    else row.appendChild(btn("✦ 呪文", () => log("呪文を使えない", "sys")));
    row.appendChild(btn("🛡 防御", () => act("defend")));
    row.appendChild(btn("🏃 逃走", () => act("run")));
    combatMenu.appendChild(row);
  } else if (b.phase === "target") {
    combatMenu.appendChild(el("div", "who", "対象を選択"));
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
  if (G.battle.phase === "target") { renderCombatMenu(); return; }
  runCommitted();
}

// 予約済みの味方行動を実行 → 演出 → 次の手番
function runCommitted() {
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

  // 効果音
  if (res.action === "spell") {
    if (res.spellKind === "heal") SFX.heal();
    else if (res.spellName && res.spellName.includes("ハリト")) SFX.fire();
    else SFX.spell();
  } else {
    const anyHit = res.hits.some((h) => !h.miss);
    if (!anyHit) SFX.miss();
    else if (res.hits.some((h) => h.crit)) SFX.crit();
    else SFX.hit();
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
  if (partyHit) fx.screen = { color: "#d4504e", t0: now };
  if (anyDeath) setTimeout(() => SFX.die(), 200);
}

function endBattle() {
  const b = G.battle;
  renderCombat();
  if (b.result === "win") {
    const { exp, gold } = b.rewards();
    G.gold += gold;
    updateTopbar();
    log(`勝利！ 経験値 ${exp} / ${gold} ゴールド を得た。`, "win");
    const alive = G.party.filter((x) => x.alive);
    for (const p of alive) {
      const msgs = gainExp(p, Math.floor(exp / alive.length));
      msgs.forEach((m) => log(m, "win"));
      if (msgs.length) SFX.levelup();
    }
    SFX.victory();
    const wasBoss = b.enemies.some((e) => e.mon.boss);
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
  for (const p of G.party) p._defending = false;
  G.battle = null;
  G.battleCell = null;
  G.state = "board";
  combatMenu.classList.add("hidden");
  movePad.classList.remove("hidden");
  playBgm("field");
  renderBoard();
}

function gameOver() {
  G.state = "over";
  playBgm(null);
  SFX.gameover();
  log("パーティは全滅した… ゲームオーバー", "dmg");
  movePad.classList.add("hidden");
  combatMenu.classList.remove("hidden");
  combatMenu.innerHTML = "";
  combatMenu.appendChild(el("div", "who", "💀 ゲームオーバー"));
  combatMenu.appendChild(btn("最初からやり直す", () => location.reload()));
}

function victory() {
  G.state = "over";
  playBgm(null);
  vctx.fillStyle = "#07060a";
  vctx.fillRect(0, 0, view.width, view.height);
  vctx.fillStyle = "#c9a227";
  vctx.font = "bold 28px monospace";
  vctx.textAlign = "center";
  vctx.fillText("★ 迷宮制覇 ★", view.width / 2, view.height / 2 - 10);
  vctx.fillStyle = "#e7e3d4";
  vctx.font = "13px monospace";
  vctx.fillText(`ドラゴンを倒した！ 獲得 ${G.gold} ゴールド`, view.width / 2, view.height / 2 + 24);
  log("おめでとう！ あなたは地下迷宮を制覇した！", "win");
  movePad.classList.add("hidden");
  combatMenu.classList.remove("hidden");
  combatMenu.innerHTML = "";
  combatMenu.appendChild(btn("もう一度挑戦する", () => location.reload()));
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

// ---- 個別ステータス / 装備画面 ----
const statusEl = document.getElementById("status-screen");
const statusBtn = document.getElementById("status-btn");
let stSel = null; // 詳細表示中のアイテム { item, from:"equip"|"bag", key }

function openStatus(idx = 0) {
  if (G.state !== "board" || G.anim || G.walking || G.prompt) return;
  G.statusOpen = true;
  G.statusIdx = idx;
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

function renderStatus() {
  const p = G.party[G.statusIdx];
  statusEl.innerHTML = "";

  // ===== ヘッダ: 肖像 + 名前 + 属性-種族-職業 + 前後/閉じる + タブ =====
  const head = el("div", "st-head");
  const port = el("div", "st-port small");
  port.appendChild(spriteCanvas(HERO, 4));
  head.appendChild(port);
  const idn = el("div", "st-idn");
  idn.appendChild(el("div", "st-name", p.name + (p.alive ? "" : " †")));
  idn.appendChild(el("div", "st-sub", `${p.align} - ${p.race} - ${p.cls} Lv${p.level}`));
  head.appendChild(idn);
  const nav = el("div", "st-nav");
  const prev = btn("◀", () => { G.statusIdx = (G.statusIdx + G.party.length - 1) % G.party.length; stSel = null; renderStatus(); }); prev.className = "st-navb";
  const next = btn("▶", () => { G.statusIdx = (G.statusIdx + 1) % G.party.length; stSel = null; renderStatus(); }); next.className = "st-navb";
  const close = btn("✕", closeStatus); close.className = "st-navb";
  nav.appendChild(prev); nav.appendChild(next); nav.appendChild(close);
  head.appendChild(nav);
  statusEl.appendChild(head);

  // タブ
  const tabs = el("div", "st-tabbar");
  const tEquip = btn("所持品・装備", () => { G.statusTab = "equip"; renderStatus(); });
  tEquip.className = "st-tab2" + (G.statusTab !== "stat" ? " active" : "");
  const tStat = btn("ステータス", () => { G.statusTab = "stat"; renderStatus(); });
  tStat.className = "st-tab2" + (G.statusTab === "stat" ? " active" : "");
  tabs.appendChild(tEquip); tabs.appendChild(tStat);
  statusEl.appendChild(tabs);

  if (G.statusTab === "stat") { statusEl.appendChild(renderStatTab(p)); return; }

  // ===== 装備タブ: 所持品 / 装備中 / 情報 =====
  const layout = el("div", "st-eqlayout");

  // 所持品 (装備中の品は所持品から外れ、右の「装備中」にのみ表示される)
  const invCol = el("div", "st-col");
  invCol.appendChild(el("div", "st-h", `所持品 (持ち ${p.items.length}/${MAX_ITEMS})`));
  const invList = el("div", "st-invlist");
  p.items.forEach((it, i) => invList.appendChild(invRow(p, it, { from: "bag", index: i })));
  if (!invList.children.length) invList.appendChild(el("div", "st-empty", "(なし)"));
  invCol.appendChild(invList);
  layout.appendChild(invCol);

  // 装備中 8スロット
  const eqCol = el("div", "st-col");
  eqCol.appendChild(el("div", "st-h center", "装備中"));
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
  eqCol.appendChild(eqList);
  layout.appendChild(eqCol);

  statusEl.appendChild(layout);

  // 情報パネル
  statusEl.appendChild(renderItemDetail(p, stSel));
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
  const port = el("div", "st-port");
  port.appendChild(spriteCanvas(HERO, 6));
  info.appendChild(port);
  const meta = el("div", "st-meta");
  meta.innerHTML = `
    <div class="st-line">属性 <b>${p.align}</b>　種族 <b>${p.race}</b></div>
    <div class="st-line">職業 <b>${p.cls}</b>　レベル <b>${p.level}</b></div>
    <div class="st-line">HP <b>${p.hp}/${p.maxhp}</b>　MP <b>${p.mp}/${p.maxmp}</b></div>
    <div class="st-line">こうげき <b>${p.atk}</b>　ぼうぎょ <b>${p.def}</b></div>
    <div class="st-line">すばやさ <b>${p.spd}</b>　AC <b>${p.ac}</b></div>
    <div class="st-line">経験値 ${p.exp} / 次まで ${p.level * 30 - p.exp}</div>
    <div class="st-line ${p.ailment ? "st-bad" : ""}">状態: ${p.ailment === "poison" ? "毒" : (p.alive ? "正常" : "戦闘不能")}</div>`;
  info.appendChild(meta);
  return info;
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
  who.items.push(it);
  log(`${it.name} を手に入れた！ (${who.name})`, "win");
  return { item: it, who };
}

// ---- アイテム入手演出 (イラスト込みの感動的な表示) ----
const itemGetEl = document.getElementById("item-get");

function showItemGet(item, who, onClose) {
  G.prompt = true; // 入力をブロック
  SFX.itemget();
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
  if (any && !G.party.some((p) => p.alive)) { gameOver(); return true; }
  return false;
}

if (statusBtn) statusBtn.addEventListener("click", () => { if (G.statusOpen) closeStatus(); else openStatus(G.statusIdx || 0); });

// ---- 入力 ----
// 最初のユーザー操作で音声を起動 (ブラウザの自動再生制限対策)
let audioReady = false;
function ensureAudio() {
  if (audioReady) return;
  audioReady = true;
  initAudio();
  playBgm(G.state === "combat" ? "battle" : "field");
}
document.addEventListener("pointerdown", ensureAudio, { once: true });

movePad.addEventListener("click", (e) => {
  const act = e.target.closest("[data-act]")?.dataset.act;
  if (!act) return;
  SFX.select();
  if (act === "up") tryMove(0, -1);
  else if (act === "down") tryMove(0, 1);
  else if (act === "left") tryMove(-1, 0);
  else if (act === "right") tryMove(1, 0);
});

// タイルクリックで移動: 隣接なら1歩、離れていれば経路探索して自動で歩く
view.addEventListener("click", (e) => {
  if (G.state !== "board" || G.anim || G.walking || G.prompt || G.statusOpen) return;
  const rect = view.getBoundingClientRect();
  const sx = (e.clientX - rect.left) * (view.width / rect.width);
  const sy = (e.clientY - rect.top) * (view.height / rect.height);
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

// ---- 起動 ----
function init() {
  log("ようこそ、地下迷宮へ。カードをめくり、深部のドラゴンを討て！", "sys");
  newFloor();
  renderBoard();

  if ("serviceWorker" in navigator) {
    // updateViaCache:none で sw.js を常に最新チェック。更新があれば即時反映してリロード
    navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then((reg) => {
      reg.addEventListener("updatefound", () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener("statechange", () => {
          if (sw.state === "activated" && navigator.serviceWorker.controller) {
            location.reload(); // 新バージョンが有効化されたら読み直す
          }
        });
      });
    }).catch(() => {});
  }

  // デバッグ/テスト用フック (壁判定の検証に使用)
  window.__game = { G, edgeOpen, COLS, ROWS };
}
init();
