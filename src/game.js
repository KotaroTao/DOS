// メインゲーム: カードボード探索 ⇄ 戦闘 (モンスターメーカー風)
import { makeBoard, COLS, ROWS } from "./board.js";
import { MONSTERS, HERO, ICONS, drawSprite } from "./sprites.js";
import { createParty, spawnCardEnemies, spawnBossEnemies, Battle, gainExp, SPELLS } from "./combat.js";
import { initAudio, SFX, playBgm, toggleMute, isMuted } from "./audio.js";

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
  anim: null,         // { x, y, t0, dur, done }
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
const CARD_W = 48, CARD_H = 42, GAP = 2;
const OX = Math.floor((480 - (COLS * CARD_W + (COLS - 1) * GAP)) / 2);
const OY = Math.floor((320 - (ROWS * CARD_H + (ROWS - 1) * GAP)) / 2);
const SPR = 3; // スプライト拡大率

function cellRect(x, y) {
  return { x: OX + x * (CARD_W + GAP), y: OY + y * (CARD_H + GAP), w: CARD_W, h: CARD_H };
}

function renderBoard() {
  // 草原風の市松背景
  for (let ty = 0; ty < 320 / 16; ty++) {
    for (let tx = 0; tx < 480 / 16; tx++) {
      vctx.fillStyle = (tx + ty) % 2 ? "#1e3a1e" : "#234223";
      vctx.fillRect(tx * 16, ty * 16, 16, 16);
    }
  }

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const cell = G.board.cells[y][x];
      const r = cellRect(x, y);
      let scaleX = 1;
      let showBack = !cell.revealed;
      if (G.anim && G.anim.x === x && G.anim.y === y) {
        const t = Math.min(1, (performance.now() - G.anim.t0) / G.anim.dur);
        scaleX = Math.abs(Math.cos(t * Math.PI));
        showBack = t < 0.5;
      }
      drawCard(r, cell, scaleX, showBack);
      // 移動可能な隣接マスをハイライト
      if (G.state === "board" && !G.anim && isStep(x, y)) {
        vctx.strokeStyle = "rgba(120,220,255,0.85)";
        vctx.lineWidth = 2;
        vctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
      }
    }
  }

  // プレイヤー
  const pr = cellRect(G.px, G.py);
  drawSprite(vctx, HERO, pr.x + pr.w / 2, pr.y + pr.h / 2, SPR);

  renderParty();
}

// めくった壁の中身: マス内に石壁を描く (ローカル座標 0..w, 0..h)
function drawWallFace(w, h) {
  vctx.fillStyle = "#3a3a44";
  vctx.fillRect(0, 0, w, h);
  vctx.strokeStyle = "#23232b";
  vctx.lineWidth = 1;
  const bh = h / 3;
  for (let i = 0; i < 3; i++) {
    const yy = i * bh;
    vctx.strokeRect(0, yy, w, bh);
    const off = i % 2 ? w / 2 : 0;
    vctx.beginPath();
    vctx.moveTo(off, yy);
    vctx.lineTo(off, yy + bh);
    vctx.stroke();
  }
  vctx.strokeStyle = "#55555f";
  vctx.lineWidth = 2;
  vctx.strokeRect(1, 1, w - 2, h - 2);
}

function drawCard(r, cell, scaleX, showBack) {
  vctx.save();
  vctx.translate(r.x + r.w / 2, r.y + r.h / 2);
  vctx.scale(Math.max(0.02, scaleX), 1);
  vctx.translate(-r.w / 2, -r.h / 2);

  if (showBack) {
    // カード裏面: 金の装飾
    vctx.fillStyle = "#6b4d12";
    vctx.fillRect(0, 0, r.w, r.h);
    vctx.strokeStyle = "#c9a227";
    vctx.lineWidth = 2;
    vctx.strokeRect(2, 2, r.w - 4, r.h - 4);
    vctx.strokeStyle = "#9c7d1c";
    vctx.lineWidth = 1;
    vctx.beginPath();
    vctx.arc(r.w / 2, r.h / 2, 14, 0, Math.PI * 2);
    vctx.stroke();
    vctx.fillStyle = "#c9a227";
    vctx.font = "bold 16px monospace";
    vctx.textAlign = "center";
    vctx.textBaseline = "middle";
    vctx.fillText("?", r.w / 2, r.h / 2 + 1);
  } else if (cell.type === "wall") {
    // めくった壁: マス内に石壁を表示 (通行不可)
    drawWallFace(r.w, r.h);
  } else {
    // 表面: 羊皮紙
    const cleared = cell.cleared && cell.type !== "stairs" && cell.type !== "start";
    vctx.fillStyle = cleared ? "#9a916f" : "#d9d0b0";
    vctx.fillRect(0, 0, r.w, r.h);
    vctx.strokeStyle = "#7a7050";
    vctx.lineWidth = 2;
    vctx.strokeRect(1, 1, r.w - 2, r.h - 2);

    const cx = r.w / 2, cy = r.h / 2;
    if (cell.type === "monster" && !cell.cleared) {
      drawSprite(vctx, MONSTERS[cell.monsterKey], cx, cy, 3);
    } else if (cell.type === "chest" && !cell.cleared) {
      drawSprite(vctx, ICONS.chest, cx, cy, 3);
    } else if (cell.type === "trap" && !cell.cleared) {
      drawSprite(vctx, ICONS.trap, cx, cy, 3);
    } else if (cell.type === "fountain" && !cell.cleared) {
      drawSprite(vctx, ICONS.fountain, cx, cy, 3);
    } else if (cell.type === "stairs") {
      drawSprite(vctx, ICONS.stairs, cx, cy, 3);
    } else if (cell.type === "start") {
      drawSprite(vctx, ICONS.start, cx, cy, 3);
    }
    // クリア済みは踏破マーク
    if (cleared && cell.type !== "empty") {
      vctx.fillStyle = "rgba(40,40,30,0.35)";
      vctx.fillRect(0, 0, r.w, r.h);
    }
  }
  vctx.restore();
}

// ---- 移動とカードめくり ----
// (x,y) が移動先候補か: 隣接していて「未公開(めくれる)」または「公開済みで壁でない」
function isStep(x, y) {
  const d = Math.abs(x - G.px) + Math.abs(y - G.py);
  if (d !== 1) return false;
  const cell = G.board.cells[y][x];
  return !cell.revealed || cell.type !== "wall";
}

function tryMove(dx, dy) {
  moveTo(G.px + dx, G.py + dy);
}

// 隣接マスへ。未公開ならめくり、壁でなければ進む。タイルクリックと方向キー共通
function moveTo(nx, ny) {
  if (G.state !== "board" || G.anim) return;
  if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) return;
  if (Math.abs(nx - G.px) + Math.abs(ny - G.py) !== 1) return;
  const cell = G.board.cells[ny][nx];
  // 公開済みの壁: 通れない
  if (cell.revealed && cell.type === "wall") { SFX.miss(); return; }
  G.prevPos = { x: G.px, y: G.py };

  if (!cell.revealed) {
    SFX.flip();
    // めくる演出 → 中身を解決
    G.anim = { x: nx, y: ny, t0: performance.now(), dur: 280 };
    const tick = () => {
      renderBoard();
      if (performance.now() - G.anim.t0 >= G.anim.dur) {
        G.anim = null;
        cell.revealed = true;
        if (cell.type === "wall") {
          // 壁が出た: めくるが進めない
          SFX.miss();
          log("壁が現れた。通れない。", "sys");
          renderBoard();
        } else {
          SFX.step();
          G.px = nx; G.py = ny;
          renderBoard();
          resolveCell(cell);
        }
      } else {
        requestAnimationFrame(tick);
      }
    };
    // めくりの途中で表面を見せるため先に revealed 扱いで描く
    cell.revealed = true;
    requestAnimationFrame(tick);
  } else {
    SFX.step();
    G.px = nx; G.py = ny;
    renderBoard();
    resolveCell(cell);
  }
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
      cell.cleared = true;
      SFX.chest();
      const g = 10 + G.floor * 10 + rand(25);
      G.gold += g;
      updateTopbar();
      log(`宝箱だ！ ${g} ゴールドを手に入れた。`, "win");
      renderBoard();
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
      log(`罠だ！ ${v.name}に ${dmg} ダメージ`, "dmg");
      if (v.hp === 0) {
        v.alive = false;
        SFX.die();
        log(`${v.name}は倒れた…`, "dmg");
        if (!G.party.some((p) => p.alive)) { gameOver(); return; }
      }
      renderBoard();
      break;
    }
    case "fountain": {
      if (cell.cleared) break;
      cell.cleared = true;
      SFX.heal();
      for (const p of G.party) {
        if (!p.alive) continue;
        p.hp = Math.min(p.maxhp, p.hp + Math.ceil(p.maxhp * 0.4));
        p.mp = Math.min(p.maxmp, p.mp + Math.ceil(p.maxmp * 0.5));
      }
      log("癒しの泉だ！ パーティのHPとMPが回復した。", "heal");
      renderBoard();
      break;
    }
    case "stairs":
      if (G.floor >= MAX_FLOOR) {
        log("階段の前に巨大な影が…！", "dmg");
        startBattle(spawnBossEnemies(), cell);
      } else {
        descend();
      }
      break;
  }
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
  // 素早い敵はここで先制行動する
  G.battle = new Battle(G.party, enemies, log, (k) => SFX[k] && SFX[k]());
  if (G.battle.result) { endBattle(); return; }
  renderCombat();
}

function renderCombat() {
  const b = G.battle;
  vctx.fillStyle = "#07060a";
  vctx.fillRect(0, 0, view.width, view.height);
  const grad = vctx.createRadialGradient(view.width / 2, view.height * 0.4, 30, view.width / 2, view.height * 0.4, view.width * 0.7);
  grad.addColorStop(0, "#1a1322");
  grad.addColorStop(1, "#07060a");
  vctx.fillStyle = grad;
  vctx.fillRect(0, 0, view.width, view.height);

  const living = b.enemies;
  const n = living.length;
  const slotW = view.width / (n + 1);
  living.forEach((e, i) => {
    const cx = slotW * (i + 1);
    const cy = view.height * 0.42;
    const size = e.mon.boss ? 14 : 9;
    drawSprite(vctx, e.mon, cx, cy, size, e.alive ? 1 : 0.18);
    vctx.fillStyle = e.alive ? "#e7e3d4" : "#5a5a66";
    vctx.font = "10px monospace";
    vctx.textAlign = "center";
    vctx.fillText(e.name + (e.asleep ? " 💤" : ""), cx, cy + 78);
    const bw = 56, bh = 5, bx = cx - bw / 2, by = cy + 84;
    vctx.fillStyle = "#2a2a3a";
    vctx.fillRect(bx, by, bw, bh);
    vctx.fillStyle = e.alive ? "#d4504e" : "#333";
    vctx.fillRect(bx, by, bw * Math.max(0, e.hp / e.maxhp), bh);
  });

  renderParty();
  renderCombatMenu();
}

function renderCombatMenu() {
  const b = G.battle;
  combatMenu.innerHTML = "";
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
      list.appendChild(btn(label, () => { b.chooseTarget(t); afterAction(); }));
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

function act(action, spellKey) {
  G.battle.chooseAction(action, spellKey);
  afterAction();
}

function afterAction() {
  const b = G.battle;
  if (b.result) { endBattle(); return; }
  renderCombat();
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
  for (const p of G.party) {
    const card = document.createElement("div");
    card.className = "pc" + (p.alive ? "" : " dead");
    card.innerHTML = `
      <div class="name">${p.name}</div>
      <div class="cls">${p.cls} Lv${p.level}</div>
      <div class="bar hp"><i style="width:${(p.hp / p.maxhp) * 100}%"></i></div>
      <div class="nums">HP ${p.hp}/${p.maxhp}</div>
      ${p.maxmp > 0 ? `<div class="bar mp"><i style="width:${(p.mp / p.maxmp) * 100}%"></i></div>
      <div class="nums">MP ${p.mp}/${p.maxmp}</div>` : ""}
    `;
    partyEl.appendChild(card);
  }
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

// タイルクリックで移動: 画面座標 → セル → 隣接なら進む
view.addEventListener("click", (e) => {
  if (G.state !== "board" || G.anim) return;
  const rect = view.getBoundingClientRect();
  const sx = (e.clientX - rect.left) * (view.width / rect.width);
  const sy = (e.clientY - rect.top) * (view.height / rect.height);
  const cx = Math.floor((sx - OX) / (CARD_W + GAP));
  const cy = Math.floor((sy - OY) / (CARD_H + GAP));
  if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) return;
  // セル内 (隙間クリックは無視)
  const r = cellRect(cx, cy);
  if (sx > r.x + r.w || sy > r.y + r.h) return;
  moveTo(cx, cy);
});

document.addEventListener("keydown", (e) => {
  if (e.key === "m" || e.key === "M") { updateMuteBtn(toggleMute()); return; }
  if (G.state !== "board") return;
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
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}
init();
