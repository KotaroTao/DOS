// メインゲーム: ダンジョン探索 ⇄ 戦闘 の統合
import { Dungeon, DIRS } from "./dungeon.js";
import { renderView, renderMinimap } from "./render3d.js";
import { drawSprite } from "./sprites.js";
import { createParty, spawnEnemies, Battle, gainExp, SPELLS } from "./combat.js";

const view = document.getElementById("view");
const vctx = view.getContext("2d");
const mini = document.getElementById("minimap");
const mctx = mini.getContext("2d");
const logEl = document.getElementById("log");
const partyEl = document.getElementById("party");
const movePad = document.getElementById("move-pad");
const combatMenu = document.getElementById("combat-menu");
const floorInfo = document.getElementById("floor-info");

const MAX_FLOOR = 3;

const G = {
  state: "dungeon",   // dungeon | combat | over
  floor: 1,
  dungeon: null,
  px: 1, py: 1, dir: 1,
  seen: null,
  party: createParty(),
  battle: null,
  stepsSinceFight: 0,
};

function log(msg, cls = "sys") {
  const div = document.createElement("div");
  div.className = "l-" + cls;
  div.textContent = msg;
  logEl.appendChild(div);
  logEl.scrollTop = logEl.scrollHeight;
  while (logEl.children.length > 80) logEl.removeChild(logEl.firstChild);
}

function newFloor() {
  G.dungeon = new Dungeon(13 + G.floor * 2, Date.now() + G.floor);
  G.px = 1; G.py = 1; G.dir = 1;
  G.seen = Array.from({ length: G.dungeon.size }, () => Array(G.dungeon.size).fill(false));
  markSeen();
  floorInfo.textContent = "B" + G.floor + "F";
  log(`地下 ${G.floor} 階に降り立った。`, "sys");
}

function markSeen() {
  const n = G.dungeon.size;
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const x = G.px + dx, y = G.py + dy;
      if (x >= 0 && y >= 0 && x < n && y < n) G.seen[y][x] = true;
    }
  }
}

function renderDungeon() {
  renderView(vctx, G.dungeon, G.px, G.py, G.dir);
  renderMinimap(mctx, G.dungeon, G.px, G.py, G.dir, G.seen);
  renderParty();
}

// ---- 移動 ----
function move(forward) {
  if (G.state !== "dungeon") return;
  const d = DIRS[G.dir];
  const s = forward ? 1 : -1;
  const nx = G.px + d.dx * s, ny = G.py + d.dy * s;
  if (G.dungeon.isWall(nx, ny)) { log("壁だ。進めない。", "sys"); renderDungeon(); return; }
  G.px = nx; G.py = ny;
  markSeen();
  renderDungeon();

  if (G.dungeon.isGoal(G.px, G.py)) {
    startBattle(true);
    return;
  }
  G.stepsSinceFight++;
  if (G.stepsSinceFight >= 2 && Math.random() < 0.22) {
    startBattle(false);
  }
}

function turn(delta) {
  if (G.state !== "dungeon") return;
  G.dir = (G.dir + delta + 4) % 4;
  renderDungeon();
}

// ---- 戦闘 ----
function startBattle(boss) {
  G.stepsSinceFight = 0;
  const enemies = spawnEnemies(G.floor, boss);
  G.battle = new Battle(G.party, enemies, log);
  G.state = "combat";
  movePad.classList.add("hidden");
  combatMenu.classList.remove("hidden");
  if (boss) log("⚔ ボスが立ちはだかる！", "win");
  else log(`⚔ ${enemies.map((e) => e.name).join("・")} が現れた！`, "dmg");
  renderCombat();
}

function renderCombat() {
  const b = G.battle;
  // 戦闘背景
  vctx.fillStyle = "#07060a";
  vctx.fillRect(0, 0, view.width, view.height);
  const grad = vctx.createRadialGradient(view.width / 2, view.height * 0.4, 30, view.width / 2, view.height * 0.4, view.width * 0.7);
  grad.addColorStop(0, "#1a1322");
  grad.addColorStop(1, "#07060a");
  vctx.fillStyle = grad;
  vctx.fillRect(0, 0, view.width, view.height);

  // 敵スプライト配置
  const living = b.enemies;
  const n = living.length;
  const slotW = view.width / (n + 1);
  living.forEach((e, i) => {
    const cx = slotW * (i + 1);
    const cy = view.height * 0.42;
    const size = e.mon.boss ? 14 : 9;
    drawSprite(vctx, e.mon, cx, cy, size, e.alive ? 1 : 0.18);
    // 名前とHP
    vctx.fillStyle = e.alive ? "#e7e3d4" : "#5a5a66";
    vctx.font = "10px monospace";
    vctx.textAlign = "center";
    vctx.fillText(e.name + (e.asleep ? " 💤" : ""), cx, cy + 78);
    // HPバー
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
    const actor = b.currentActor();
    highlightActor(actor);
    const who = el("div", "who", `▶ ${actor.name} の行動 (Lv${actor.level})`);
    combatMenu.appendChild(who);
    const row = el("div", "row");
    row.appendChild(btn("⚔ 攻撃", () => act("attack")));
    if (actor.spells.length) row.appendChild(btn("✦ 呪文", () => showSpells(actor)));
    else row.appendChild(btn("✦ 呪文", () => log("呪文を使えない", "sys")));
    row.appendChild(btn("🛡 防御", () => act("defend")));
    row.appendChild(btn("🏃 逃走", () => act("run")));
    combatMenu.appendChild(row);
  } else if (b.phase === "target") {
    const who = el("div", "who", "対象を選択");
    combatMenu.appendChild(who);
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
    log(`勝利！ 経験値 ${exp} / ${gold} ゴールド を得た。`, "win");
    for (const p of G.party) {
      if (!p.alive) continue;
      gainExp(p, Math.floor(exp / G.party.filter((x) => x.alive).length))
        .forEach((m) => log(m, "win"));
    }
    const wasBoss = b.enemies.some((e) => e.mon.boss);
    finishToDungeon();
    if (wasBoss) descend();
  } else if (b.result === "flee") {
    finishToDungeon();
  } else if (b.result === "lose") {
    G.state = "over";
    log("パーティは全滅した… ゲームオーバー", "dmg");
    movePad.classList.add("hidden");
    combatMenu.classList.remove("hidden");
    combatMenu.innerHTML = "";
    combatMenu.appendChild(el("div", "who", "💀 ゲームオーバー"));
    combatMenu.appendChild(btn("最初からやり直す", () => location.reload()));
  }
}

function finishToDungeon() {
  for (const p of G.party) p._defending = false;
  G.battle = null;
  G.state = "dungeon";
  combatMenu.classList.add("hidden");
  movePad.classList.remove("hidden");
  renderParty();
  renderDungeon();
}

function descend() {
  if (G.floor >= MAX_FLOOR) {
    victory();
    return;
  }
  G.floor++;
  log("階段を降りていく…", "sys");
  newFloor();
  renderDungeon();
}

function victory() {
  G.state = "over";
  vctx.fillStyle = "#07060a";
  vctx.fillRect(0, 0, view.width, view.height);
  vctx.fillStyle = "#c9a227";
  vctx.font = "bold 28px monospace";
  vctx.textAlign = "center";
  vctx.fillText("★ 迷宮制覇 ★", view.width / 2, view.height / 2 - 10);
  vctx.fillStyle = "#e7e3d4";
  vctx.font = "13px monospace";
  vctx.fillText("ドラゴンを倒し、財宝を手にした！", view.width / 2, view.height / 2 + 24);
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
movePad.addEventListener("click", (e) => {
  const act = e.target.closest("[data-act]")?.dataset.act;
  if (!act) return;
  if (act === "forward") move(true);
  else if (act === "back") move(false);
  else if (act === "turnL") turn(-1);
  else if (act === "turnR") turn(1);
});

document.addEventListener("keydown", (e) => {
  if (G.state !== "dungeon") return;
  switch (e.key) {
    case "ArrowUp": case "w": move(true); break;
    case "ArrowDown": case "s": move(false); break;
    case "ArrowLeft": case "a": turn(-1); break;
    case "ArrowRight": case "d": turn(1); break;
    default: return;
  }
  e.preventDefault();
});

// ---- 起動 ----
function init() {
  log("ようこそ、地下迷宮へ。階段を見つけて深部のドラゴンを討て！", "sys");
  newFloor();
  renderDungeon();

  // PWA: Service Worker 登録(オフライン対応 / アプリ化の足がかり)
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}
init();
