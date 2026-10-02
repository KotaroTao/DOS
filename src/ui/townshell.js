// ===== 街シェル: 見出し + 中身 + 下のタブバー (§3.1) =====
//   [見出し: ⚙/‹ ・ 題 ・ 通貨]   (新しい画面のときだけ。旧画面は自前の見出しを持つ)
//   [中身 (#town-screen)]         ← game.js の townEl はここを指す
//   [タブバー: 街 | 隊 | ◆迷宮◆ | 商会 | 王宮]
//
// 旧画面アダプタ: G.town.facility が立っている間は、旧い施設の描画関数 (renderMansion など) を
// そのまま中身へ描き、見出しは隠し、その施設が属するタブを点す。タブは既定で旧画面を描く
// (街→renderTownHub / 隊→renderMansion / 商会→renderShop / 王宮→renderPalace)。
// 各パッケージは registerTab / registerPage で新しい描画に差し替える (legacy:false)。
//
// 夜景のような重い生きた絵は keep(key, factory) で一度だけ作り、描き替えの間は「控え室」へ退避して
// 生かしたまま次の描画で戻す (createTownScene を描くたびに作り直さない)。

import { UI, game, ops, registerUI } from "./ctx.js";
import { el, tabbar, updateTabbar, header, toast } from "./kit.js";
import { nav } from "./nav.js";
import { tabTransition, pageTransition, softFade } from "./motion.js";
import { setPref } from "./prefs.js";
import { SFX } from "../audio.js";

export const TABS = [
  { key: "hub", label: "街", icon: "town" },
  { key: "party", label: "隊", icon: "party" },
  { key: "gate", label: "迷宮", icon: "dive", center: true },
  { key: "shop", label: "商会", icon: "shop" },
  { key: "palace", label: "王宮", icon: "palace" },
];
const TAB_INDEX = { hub: 0, party: 1, gate: 2, shop: 3, palace: 4 };
const TAB_TITLE = { hub: "街", party: "隊", shop: "商会", palace: "王宮" };

// 旧施設 → 属するタブ
export const FAC_TAB = {
  mansion: "party", altar: "party",
  shop: "shop",
  palace: "palace", treasury: "palace", codexAch: "palace", codexItem: "palace", codexDungeon: "palace", codexMon: "palace", codexJob: "palace",
  tavern: "hub", inn: "hub", shrine: "hub", abyss: "hub",
};
// タブの根になる旧施設 (null = 広場)
const LEGACY_ROOT = { hub: null, party: "mansion", shop: "shop", palace: "palace" };
// 旧施設の親 (戻る先)。無いものはタブの根/広場へ
const LEGACY_PARENT = {
  altar: "mansion",
  treasury: "palace", codexAch: "palace", codexItem: "palace", codexDungeon: "palace", codexMon: "palace", codexJob: "palace",
};

export function townTabOf(facility) { return facility ? (FAC_TAB[facility] || "hub") : "hub"; }

// 旧セーブの街の現在地 {facility, sub} にタブ/頁を補う (loadGame から)
export function migrateTown(t) {
  if (!t || typeof t !== "object") t = {};
  if (t.facility === undefined) t.facility = null;
  if (t.sub === undefined) t.sub = null;
  if (!t.tab || !(t.tab in TAB_INDEX) || t.tab === "gate") t.tab = townTabOf(t.facility);
  if (t.page === undefined) t.page = null;
  return t;
}

const tabDefs = {};   // key → { render(root, api), badge(counts), locked(), legacy, title, header:false=見出しを出さない }
const pageDefs = {};  // key → { render(root, api), title, parentTab, header:false }
const kept = new Map();
let shell = null, head = null, content = null, bar = null, parking = null;
let lastKey = "", lastTab = "hub", lastDepth = 0;

// ---- DOM の用意 (index.html に無ければ作る) ----
export function mount() {
  if (content && content.isConnected) return content;
  if (typeof document === "undefined") return null;
  try {
    content = document.getElementById("town-screen");
    shell = document.getElementById("town-shell");
    if (!shell) {
      shell = document.createElement("div");
      shell.id = "town-shell";
      shell.className = "hidden";
      if (content && content.parentNode) content.parentNode.insertBefore(shell, content);
      else (document.getElementById("app") || document.body).appendChild(shell);
    }
    if (!content) { content = document.createElement("div"); content.id = "town-screen"; }
    head = shell.querySelector(".ts-head");
    if (!head) { head = el("div", "ts-head hidden"); shell.insertBefore(head, shell.firstChild); }
    if (content.parentNode !== shell) shell.appendChild(content);
    parking = shell.querySelector(".ts-park");
    if (!parking) { parking = el("div", "ts-park"); parking.setAttribute("aria-hidden", "true"); shell.appendChild(parking); }
    bar = shell.querySelector(".ui-tabbar");
    if (!bar) {
      bar = tabbar(tabState(), lastTab, onTabTap);
      bar.classList.add("ts-tabbar");
      shell.appendChild(bar);
    }
    // 中身を隠したら (迷宮へ入る等) シェルごと隠す
    if (typeof MutationObserver === "function") {
      new MutationObserver(() => {
        const hid = content.classList.contains("hidden");
        if (hid !== shell.classList.contains("hidden")) shell.classList.toggle("hidden", hid);
      }).observe(content, { attributes: true, attributeFilter: ["class"] });
    }
  } catch (e) { /* DOM の無い環境 (検証用スタブ) */ }
  return content;
}
export function contentRoot() { return mount() || content; }

// ---- 登録 ----
export function registerTab(key, def) {
  const merged = { ...(tabDefs[key] || {}), ...def };
  if (def && def.render && def.legacy === undefined) merged.legacy = false; // 描画を渡したら旧画面ではない
  tabDefs[key] = merged;
}
export function registerPage(key, def) { pageDefs[key] = { ...(pageDefs[key] || {}), ...def }; }

// ---- 生かしておく絵 (夜景など) ----
export function keep(key, factory) {
  let n = kept.get(key);
  if (!n && typeof factory === "function") {
    n = factory();
    if (n) kept.set(key, n);
  }
  return n || null;
}
function parkKept() {
  if (!parking || !content) return;
  for (const n of kept.values()) if (n && n.parentNode && content.contains(n)) parking.appendChild(n);
}

// ---- タブの状態 ----
function allowedList() { try { return game.tutorialAllowed ? game.tutorialAllowed() : null; } catch (e) { return null; } }
function isLocked(key) {
  const def = tabDefs[key];
  if (def && typeof def.locked === "function") return !!def.locked();
  const G = game.G;
  const allowed = allowedList();
  if (key === "gate") return !G || (G.unlockedDungeons || 0) < 1;
  if (key === "party") return !!allowed && !allowed.includes("mansion");
  if (key === "shop") return !!allowed && !allowed.includes("shop");
  return false;
}
const LOCK_MSG = { gate: "王の勅命を受けるまで、迷宮の在処は明かされない", default: "王命を果たすまで閉ざされている" };
function lockedToast(key) {
  try { SFX.ng(); } catch (e) { /* noop */ }
  toast(LOCK_MSG[key] || LOCK_MSG.default, { tone: "info" });
}

function badgeOf(key, counts) {
  const def = tabDefs[key];
  if (def && typeof def.badge === "function") { try { return def.badge(counts); } catch (e) { return null; } }
  if (!counts) return null;
  if (key === "party") return counts.dead || (counts.trainable ? true : null);
  if (key === "shop") return counts.unid || null;
  if (key === "palace") {
    let call = false;
    try { call = game.palaceCallReady ? game.palaceCallReady() : false; } catch (e) { call = false; }
    return call ? "!" : (counts.ach || (counts.treasuryReady ? true : null));
  }
  return null;
}

function tabState(active) {
  let counts = null;
  try { counts = typeof ops.counts === "function" ? ops.counts() : null; } catch (e) { counts = null; }
  return TABS.map((t) => ({ ...t, locked: game.G ? isLocked(t.key) : false, badge: game.G ? badgeOf(t.key, counts) : null }));
}

// いまのタブ (旧施設が立っていればその施設のタブ)
function resolveTab() {
  const t = game.G.town;
  if (t.page && pageDefs[t.page]) return (t.tab = pageDefs[t.page].parentTab || t.tab || "hub");
  if (t.facility) return (t.tab = townTabOf(t.facility));
  const def = tabDefs[t.tab];
  if (t.tab && t.tab !== "hub" && def && def.render && !def.legacy) return t.tab;
  return (t.tab = "hub");
}
// 深さ (タブの根 = 0、頁/施設の中 = 1、その奥 = 2)
function currentDepth() {
  const t = game.G.town;
  if (t.page) return 1;
  const f = t.facility;
  if (!f) return 0;
  if (f === "mansion") return t.sub ? 1 : 0;
  if (LEGACY_PARENT[f]) return 1;
  return FAC_TAB[f] === "hub" ? 1 : 0;
}
function screenKey() {
  const t = game.G.town;
  return `${t.tab}|${t.facility || ""}|${t.sub || ""}|${t.page || ""}`;
}

// ---- 描画 ----
function showHeader(opts) {
  if (!head) return;
  head.textContent = "";
  if (!opts) { head.classList.add("hidden"); shell.classList.remove("has-head"); return; }
  head.appendChild(header(opts));
  head.classList.remove("hidden");
  shell.classList.add("has-head");
}

const api = {
  root: () => content,
  setTab: (k, o) => setTab(k, o),
  openPage: (k, o) => openPage(k, o),
  closePage: () => closePage(),
  refresh: (o) => refresh(o),
  keep,
};

// game.renderTown() から呼ばれる。中身だけを描き替え、スクロール位置と夜景を保つ
export function refresh() {
  if (!mount() || !game.G) return;
  const G = game.G;
  if (!G.town) G.town = migrateTown({});
  const tab = resolveTab();
  const depth = currentDepth();
  const key = screenKey();
  const same = key === lastKey;
  const keepScroll = same ? content.scrollTop : 0;
  shell.classList.remove("hidden");
  content.classList.remove("hidden");
  parkKept();
  content.innerHTML = "";
  content.classList.remove("shop-mode"); // 商店専用レイアウトを解除 (商店なら再付与)
  const t = G.town;
  const page = t.page && pageDefs[t.page];
  const def = tabDefs[tab];
  if (page) {
    const parent = page.parentTab || tab;
    showHeader(page.header === false ? null : { left: "back", title: page.title || "", backLabel: TAB_TITLE[parent] || "街", onBack: () => nav.back() });
    page.render(content, api);
  } else if (!t.facility && def && def.render && !def.legacy) {
    showHeader(def.header === false ? null : { left: "gear", title: def.title || TAB_TITLE[tab] || "", onGear: () => game.openSettings && game.openSettings() });
    def.render(content, api);
  } else {
    showHeader(null);
    if (game.renderTownLegacy) game.renderTownLegacy();
  }
  updateBar(tab);
  content.scrollTop = keepScroll;
  if (!same && lastKey) {
    if (tab !== lastTab) tabTransition(content, (TAB_INDEX[tab] || 0) - (TAB_INDEX[lastTab] || 0));
    else if (depth > lastDepth) pageTransition(content, "push");
    else if (depth < lastDepth) pageTransition(content, "pop");
    else softFade(content);
  }
  if (tab !== lastTab) setPref("tab", tab);
  lastKey = key; lastTab = tab; lastDepth = depth;
}

// タブバーの点灯・印・鎖だけを更新 (作り直さない)
export function updateBar(active) {
  if (!bar || !game.G) return;
  updateTabbar(bar, tabState(), active || game.G.town.tab || "hub");
}

function onTabTap(key) {
  if (key === "gate") return openGate();
  setTab(key);
}

// タブを切り替える。同じタブをもう一度押すと、そのタブの根 (と先頭) へ戻る
export function setTab(key, { silent = false } = {}) {
  const G = game.G;
  if (!G || G.state !== "town") return false;
  if (key === "gate") return openGate();
  if (isLocked(key)) { lockedToast(key); return false; }
  const t = G.town;
  const cur = resolveTab();
  const def = tabDefs[key] || { legacy: true };
  const isLegacy = !def.render || !!def.legacy;
  const rootFac = isLegacy ? (LEGACY_ROOT[key] || null) : null;
  const atRoot = !t.page && (t.facility || null) === rootFac && !t.sub;
  if (key === cur && atRoot) {
    // 根でもう一度押した: 先頭へ
    try { content.scrollTo({ top: 0, behavior: "smooth" }); } catch (e) { content.scrollTop = 0; }
    return true;
  }
  if (!silent) { try { SFX.select(); } catch (e) { /* noop */ } }
  t.page = null;
  t.facility = rootFac;
  t.sub = null;
  t.tab = key;
  if (game.resetTownSelection) game.resetTownSelection();
  if (game.renderTown) game.renderTown();
  return true;
}

// 中央の門: 出撃 (Phase 0 は UI.openDeparture のスタブ = 選んでいる迷宮へ潜る)
export function openGate() {
  if (isLocked("gate")) { lockedToast("gate"); return false; }
  try { SFX.select(); } catch (e) { /* noop */ }
  if (typeof UI.openDeparture === "function") UI.openDeparture();
  else if (game.tryEnterDungeon) game.tryEnterDungeon();
  return true;
}

// 頁 (酒場・祠・奈落など、タブの1段下)。登録が無ければ同名の旧施設を開く
export function openPage(key, { parentTab } = {}) {
  const G = game.G;
  if (!G) return;
  if (pageDefs[key]) {
    G.town.page = key;
    if (parentTab) pageDefs[key].parentTab = parentTab;
  } else {
    G.town.facility = key;
    G.town.sub = null;
  }
  if (game.renderTown) game.renderTown();
}
export function closePage() {
  const G = game.G;
  if (!G) return;
  G.town.page = null;
  if (game.renderTown) game.renderTown();
}

// 「戻る」: 頁 → 施設の中 → タブの根 → 街。街の根なら false (nav が「もう一度で閉じる」)
export function back() {
  const G = game.G;
  if (!G || G.state !== "town") return false;
  const t = G.town;
  if (t.page) { closePage(); return true; }
  const f = t.facility;
  if (f) {
    if (f === "mansion" && t.sub) { t.sub = null; if (game.resetTownSelection) game.resetTownSelection(); game.renderTown(); return true; }
    const parent = LEGACY_PARENT[f];
    if (parent) { t.facility = parent; t.sub = null; if (game.resetTownSelection) game.resetTownSelection(); game.renderTown(); return true; }
    if (townTabOf(f) === "hub") { t.facility = null; t.sub = null; game.renderTown(); return true; }
    setTab("hub", { silent: true });
    return true;
  }
  if (resolveTab() !== "hub") { setTab("hub", { silent: true }); return true; }
  return false;
}

export function hide() { if (mount()) { content.classList.add("hidden"); shell.classList.add("hidden"); } }
export function isOpen() { return !!(shell && !shell.classList.contains("hidden")); }

// 既定の登録: 4つのタブは旧画面を描く。UI の窓口 (シェル操作) も置く
export function install() {
  for (const k of ["hub", "party", "shop", "palace"]) if (!tabDefs[k]) tabDefs[k] = { legacy: true, title: TAB_TITLE[k] };
  registerUI({
    shell: { setTab, openPage, closePage, refresh, registerTab, registerPage, keep, back, contentRoot, updateBar, openGate },
    openTab: (k) => setTab(k),
    // スタブ (WP-C / WP-A が差し替える)
    openShop: () => setTab("shop"),
    openPalace: () => setTab("palace"),
  });
  nav.handle(() => back(), 60);
  mount();
}
