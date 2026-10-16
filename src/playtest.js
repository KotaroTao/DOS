// 序盤の試遊記録。通常のセーブ・戦闘集計とは別に、この端末だけに保存する。
import { TEST_BUILD } from "./telemetry.js";
const KEY = "dos-playtests-v1";
const LIMIT = 600;
let session = null, context = () => ({}), timer = null, last = 0, inputAt = 0, visible = true;
let storageError = false, inspecting = false;
const labels = { firstBattle: "初戦闘", sixDolls: "6人編成", rareFound: "最初のレア魂の入手", rareHome: "最初のレア魂の持ち帰り", subUnlocked: "サブ魂の解放", subEquipped: "初めてサブ魂を装着", subBattle: "サブ魂を伴う初戦闘", firstBoss: "最初の主討伐" };
export function playtestRecords() {
  try { const a = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(a) ? a.filter(s => s?.v === 1 && Array.isArray(s.events)) : []; }
  catch { return []; }
}
function save() {
  if (!session) return;
  try {
    const all = playtestRecords().filter(s => s.id !== session.id);
    all.push(session);
    localStorage.setItem(KEY, JSON.stringify(all.slice(-20)));
    storageError = false;
  } catch { storageError = true; }
}
function tick() {
  if (!session || session.endedAt) return;
  const now = performance.now();
  const dt = Math.max(0, now - last); last = now;
  session.elapsedMs += dt;
  if (visible && !inspecting) session.activeMs += context().automatic ? dt : Math.max(0, Math.min(dt, 120000 - (Date.now() - inputAt) + dt));
}
export function playtestEvent(type, detail = {}, milestone = null) {
  if (!session || session.endedAt || (milestone && session.milestones[milestone])) return;
  tick();
  if (type === "出撃") {
    const id = context().dungeon || "不明";
    session.attempts[id] = (session.attempts[id] || 0) + 1;
    detail = { ...detail, attempt: session.attempts[id] };
  }
  const event = { type, elapsedMs: Math.round(session.elapsedMs), activeMs: Math.round(session.activeMs), context: JSON.parse(JSON.stringify(context())), detail };
  if (milestone) {
    session.milestones[milestone] = event;
  }
  if (type === "試遊者メモ") session.notes.push(event);
  session.counts[type] = (session.counts[type] || 0) + 1;
  if (session.events.length < LIMIT) session.events.push(event);
  else session.omittedEvents = (session.omittedEvents || 0) + 1;
  save();
}
export function finishPlaytest(reason = "ホームへ戻る") {
  if (!session || session.endedAt) return;
  playtestEvent("終了", { reason });
  session.endedAt = new Date().toISOString(); session.endReason = reason;
  clearInterval(timer); save();
}
export function startPlaytest(readContext, { skippedDungeon = false } = {}) {
  if (session && !session.endedAt) finishPlaytest("新しい試遊");
  // 再読み込みではゲーム自体が最初に戻るため、別の試遊として残す。
  const previous = playtestRecords();
  for (const s of previous) if (!s.endedAt) { s.endedAt = s.updatedAt || s.startedAt; s.endReason = "中断（再読み込み・画面を閉じた等）"; }
  try { localStorage.setItem(KEY, JSON.stringify(previous)); } catch { storageError = true; }
  context = readContext;
  session = { v: 1, id: crypto.randomUUID(), build: TEST_BUILD, startedAt: new Date().toISOString(), elapsedMs: 0, activeMs: 0, skippedDungeon, viewport: { width: innerWidth, height: innerHeight }, milestones: {}, attempts: {}, counts: {}, notes: [], events: [] };
  last = performance.now(); inputAt = Date.now(); visible = document.visibilityState === "visible";
  let phase = null, saves = 0;
  const sample = () => {
    tick(); const c = context();
    if (c.subUnlocked) playtestEvent("到達", {}, "subUnlocked");
    if (c.party?.length >= 6) playtestEvent("到達", {}, "sixDolls");
    if (c.party?.some(p => p.subs?.length)) playtestEvent("到達", {}, "subEquipped");
    if (c.phase !== phase) { phase = c.phase; playtestEvent("進行", { phase }); }
    session.updatedAt = new Date().toISOString(); if (++saves % 5 === 0) save();
  };
  document.addEventListener("visibilitychange", () => { tick(); visible = document.visibilityState === "visible"; save(); });
  for (const kind of ["pointerdown", "keydown"]) document.addEventListener(kind, () => { tick(); inputAt = Date.now(); }, true);
  document.addEventListener("click", e => {
    if (e.target.closest?.('.iv-skip, [data-action="skip"]:not(.op-skip)')) playtestEvent("説明のスキップ操作");
  }, true);
  window.addEventListener("pagehide", () => { tick(); save(); });
  timer = setInterval(sample, 1000);
  playtestEvent("開始", { skippedDungeon }); sample();
}
const time = ms => `${Math.floor(ms / 60000)}分${Math.floor(ms / 1000) % 60}秒`;
export function playtestText(s) {
  const lines = ["序盤の試遊記録", `開始: ${s.startedAt} / 版: ${s.build}`, `終了: ${s.endReason || "試遊中・未終了"}`, `画面: ${s.viewport ? s.viewport.width + "×" + s.viewport.height : "不明"}`, `探索省略: ${s.skippedDungeon ? "あり（時間評価から除外）" : "なし"}`, `経過: ${time(s.elapsedMs)} / 操作中: ${time(s.activeMs)}`, "操作中＝表示中、2分以内に操作（またはオート進行）。記録画面の閲覧時間を除く。", "到達点（操作中 / 経過）"];
  for (const [key, label] of Object.entries(labels)) { const e = s.milestones[key]; lines.push(`${label}: ${e ? time(e.activeMs) + " / " + time(e.elapsedMs) : "未到達"}`); }
  const count = type => s.counts?.[type] ?? s.events.filter(e => e.type === type).length;
  lines.push("試遊者メモ");
  for (const e of s.notes || []) lines.push(`[${time(e.activeMs)} / ${time(e.elapsedMs)}] ${e.detail.kind}: ${e.detail.text}`);
  lines.push(`同じ迷宮への2回目以降の出撃: ${Object.values(s.attempts || {}).reduce((n, a) => n + Math.max(0, a - 1), 0)}（再挑戦・再訪を含む）`);
  lines.push(`出撃 ${count("出撃")} / 全滅・断念 ${count("全滅・断念")} / 戦闘 ${count("戦闘開始")} / 説明のスキップ操作 ${count("説明のスキップ操作")}`, "時系列（操作中 / 経過）");
  for (const e of s.events) lines.push(`[${time(e.activeMs)} / ${time(e.elapsedMs)}] ${e.type} ${JSON.stringify(e.detail)} ${JSON.stringify(e.context)}`);
  if (s.omittedEvents) lines.push(`記録上限で省略した出来事: ${s.omittedEvents}（到達点は別に保持）`);
  return lines.join("\n");
}
function node(tag, text) { const e = document.createElement(tag); if (text) e.textContent = text; return e; }
export function showPlaytestRecords() {
  if (document.querySelector(".playtest-records")) return;
  tick(); inspecting = true; save();
  const dialog = node("dialog"); dialog.className = "playtest-records";
  dialog.setAttribute("aria-label", "試遊の記録");
  const title = node("h2", "試遊の記録"), status = node("p"); status.setAttribute("role", "status");
  const select = node("select"); select.setAttribute("aria-label", "確認する試遊");
  const all = playtestRecords().reverse();
  // 保存できなかった時も、その場で書き出せるようにする。
  if (session) { const i = all.findIndex(s => s.id === session.id); if (i >= 0) all.splice(i, 1); all.unshift(session); }
  for (const [i, s] of all.entries()) { const opt = node("option", `${s.startedAt} ${s.skippedDungeon ? "探索省略" : "最初から"}`); opt.value = i; select.append(opt); }
  const output = node("textarea"); output.readOnly = true; output.setAttribute("aria-label", "記録の内容");
  const refresh = () => { output.value = all[+select.value] ? playtestText(all[+select.value]) : "試遊の記録はありません。タイトルのテストプレイで、序章「最初から」を選ぶと自動で記録します。"; status.textContent = storageError ? "端末に保存できません。この画面から記録を書き出してください。" : "この端末に最大20回分を保存します。外部へ自動送信しません。"; };
  select.onchange = refresh;
  const controls = node("div"); controls.className = "playtest-controls";
  const button = (label, fn) => { const b = node("button", label); b.type = "button"; b.onclick = fn; return b; };
  if (session && !session.endedAt) {
    const kind = node("select"); kind.setAttribute("aria-label", "メモの種類");
    for (const t of ["迷った・分からない", "工夫して強くなった", "感想・その他"]) kind.append(node("option", t));
    const memo = node("textarea"); memo.maxLength = 2000; memo.placeholder = "何に迷ったか／何を変え、どう強くなったか"; memo.setAttribute("aria-label", "試遊のメモ");
    const add = button("メモを記録", () => {
      if (!memo.value.trim()) { status.textContent = "メモを入力してください。"; return; }
      playtestEvent("試遊者メモ", { kind: kind.value, text: memo.value.trim() }); memo.value = ""; refresh();
    });
    dialog.append(node("p", "いま進行中の試遊へのメモ"), kind, memo, add);
  }
  const download = (json) => {
    const s = all[+select.value]; if (!s) return;
    const blob = new Blob([json ? JSON.stringify(s, null, 2) : playtestText(s)], { type: json ? "application/json" : "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob), a = node("a"); a.href = url; a.download = `dos-playtest-${s.id}.${json ? "json" : "txt"}`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  controls.append(button("テキスト保存", () => download(false)), button("JSON保存", () => download(true)), button("閉じる", () => dialog.close()));
  dialog.prepend(title, status, select); dialog.append(output, controls);
  dialog.addEventListener("close", () => { tick(); inspecting = false; dialog.remove(); save(); });
  dialog.addEventListener("keydown", e => e.stopPropagation());
  dialog.addEventListener("click", e => e.stopPropagation());
  document.body.append(dialog); refresh(); dialog.showModal();
}

// 物語のウィンドウ捕捉より先に、記録画面のキーを受け止める。入力の既定動作は保つ。
window.addEventListener("keydown", e => {
  const dialog = e.target?.closest?.(".playtest-records");
  if (!dialog) return;
  e.stopImmediatePropagation();
  if (e.key === "Escape") { e.preventDefault(); dialog.close(); }
}, true);
