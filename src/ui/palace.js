// ===== 王宮 — 勅命 / 図鑑 / 勲章 / 宝物庫 (区分ごとに印) =====
// 担当: WP-A。王宮タブ (UI.shell.registerTab("palace", …))。宰相のささやき → 区分 (記憶する) → 中身。
// どの区分も1画面に収める (ページは縦にスクロールさせない)。長い一覧は収まる数ずつ「‹ 1/3 ›」でめくり、詳細はシート。
//   勅命   … 勅命の札 (報告/拝命/出撃/謁見 をその場で) + 王の言葉を聞き直す + 王の記録 (戦績) と「伝える」
//   図鑑   … 敵 (迷宮の札) / アイテム (分類の札・売却額の安い順) / 職業 → 3列の札をめくる → 詳細のシート
//   勲章   … まとめて拝受。拝受できる札を先に、2列の札をめくる
//   宝物庫 … 収集品を奉納 (品の詳細のシート → 奉納する。奉納済みの品は売却額の金貨に)・次の褒賞・奉納台帳 (図鑑と同じ札。総数は伏せる)
// 提供: UI.openPalace(seg) (seg = "decree" | "codex" | "ach" | "treasury" | "codex:mon|item|job")
//       UI.openCodexSheet({ dungeonIdx }) (迷宮の中の図鑑。手帳から)
//       UI.dungeonMonSheet(dungeonIdx) (出撃シートの「発見した魔物」から。その迷宮の魔物の札)
//       UI.codexMonSheet(key) / UI.codexItemSheet(id) / UI.codexJobSheet(key, rank, heading)
// game.js は import しない (ctx.js の UI / game / ops を通す)。

import { UI, game, ops, registerUI } from "./ctx.js";
import { el, setText, glyph, svgIcon, sheet, button, segmented, chips, itemTile, scrollBox, badge } from "./kit.js";
import { remember } from "./prefs.js";
import { softFade } from "./motion.js";
import { statLines, itemCatText, showSkillPopup, showPassivePopup, tagRow, traitTagKinds, affinityRow, spellTagKinds, revealSteps, monKills, revealLock } from "./itemview.js";
import { MONSTERS, ICONS, spriteCanvas } from "../sprites.js";
import { EVENTS, EVENT_MAP, EVENT_GROUPS, EV_TIERS, eventWhereText, onceKey, LORE_PAGES } from "../events.js";
import { ITEMS, ITEM_CATS, WEAPON_CATS, WEAPON_CAT_LABEL, SHIELD_KINDS, SHIELD_KIND_LABEL, shieldKind, itemName } from "../items.js";
import { RANK_COLOR, RANK_NAME } from "../content.js";
import { DUNGEONS, ELEMENTS, RACE_LABEL, monsterTraits, isFloating, resistHpMul, METAL_TIERS } from "../dungeons/index.js";
import { SPELLS, spellMpLabel } from "../combat.js";
import {
  SOUL_CLASSES, jobSprite, jobRankName, jobLoreFor, jobRankCondText, SOUL_STAT_UP, JOB_GEAR,
  awakenPerkOf, rankThresholds, soulLevelCap, jobSkillTable, passiveName, passiveDesc, JOB_AFFINITY,
} from "../souls.js";
import { rarityColor } from "../rarity.js";
import { SFX } from "../audio.js";
import { keeperRow, sectionHead, scrollGrid, openItem, resetPages } from "./facilities.js";

const sfx = (k) => { try { if (SFX[k]) SFX[k](); } catch (e) { /* noop */ } };
const G = () => game.G;
const SEGS = ["decree", "codex", "ach", "treasury"];

function curSeg() { const s = remember("seg", "palace"); return SEGS.includes(s) ? s : "decree"; }
// 図鑑は前回の位置を覚えない: 入るたび・区分を替えるたびに既定 (敵=最初の迷宮 / アイテム=武器・すべて / 見聞=共通、どれも1ページ目) へ戻す
// 迷宮の手帳から開いた図鑑だけは、敵の既定がいま潜っている迷宮になる (codexHome)
const codexHome = { dungeon: 0 };
const CODEX_PAGES = ["mon:", "item:", "job", "ev:"];
function resetCodexView(sub = "mon") {
  remember("seg", "codex", sub);
  remember("codex", "dungeon", codexHome.dungeon);
  remember("codex", "itemCat", "weapon");
  remember("codex", "weaponCat", "all");
  remember("codex", "evGroup", "0");
  resetPages(CODEX_PAGES);
}
// openPalace(seg) で区分を指定して入るときの印 (街の夜景・タブから入るときは勅命へ戻す)
let pendingSeg = false;
// 残りの高さを占める箱 (めくる格子の置き場)
function fillArea(parent, cls = "") {
  const a = el("div", "pl-area" + (cls ? " " + cls : ""));
  parent.appendChild(a);
  return a;
}

// ================= 勅命 =================
function renderDecree(body) {
  const d = game.decreeInfo ? game.decreeInfo() : null;
  const o = game.objectiveInfo ? game.objectiveInfo() : null;
  const card = el("div", "pl-decree k-" + (d ? d.kind : "none"));
  const band = el("div", "pl-decree-band");
  band.appendChild(el("span", "pl-decree-seal", "勅"));
  band.appendChild(setText(el("span", "pl-decree-head"), d ? d.head : ""));
  card.appendChild(band);
  if (d) {
    card.appendChild(setText(el("div", "pl-decree-t"), d.text));
    if (d.note) card.appendChild(setText(el("div", "pl-decree-n"), d.note));
  }
  const acts = el("div", "pl-decree-acts");
  if (o) {
    const b = button({ label: o.act, kind: "primary", size: "lg", icon: o.kind === "gate" ? "gate" : null, onTap: () => { sfx("select"); o.run(); } });
    b.classList.add("pl-decree-go");
    acts.appendChild(b);
  }
  if (d && d.replay) {
    const r = el("button", "pl-replay");
    r.type = "button";
    r.appendChild(document.createTextNode("王の言葉を聞き直す"));
    r.appendChild(svgIcon("chevron", "pl-replay-ic"));
    r.addEventListener("click", () => { sfx("select"); game.replayDecree(); });
    acts.appendChild(r);
  }
  if (acts.childElementCount) card.appendChild(acts);
  body.appendChild(card);

  // 王の記録 (戦績): 4列の小さな札
  const share = el("button", "pl-share");
  share.type = "button";
  share.appendChild(document.createTextNode("伝える"));
  share.addEventListener("click", () => game.sharePalaceRecord());
  body.appendChild(sectionHead("王の記録", { right: share }));
  const rec = el("div", "pl-records");
  for (const [k, v] of (game.palaceRecords ? game.palaceRecords() : [])) {
    const c = el("div", "pl-rec");
    c.appendChild(el("span", "pl-rec-k", k));
    c.appendChild(el("span", "pl-rec-v", v));
    rec.appendChild(c);
  }
  body.appendChild(rec);
}

// ================= 新着の印 =================
// 図鑑の新着は G.codex.fresh (game.js が記録した時に立てる) — 札・迷宮/分類の札・区分・王宮の区分に印を出し、
// 札の詳細を開くと消える。勲章 (拝受できる) と宝物庫 (奉納できる新種・受け取れる褒賞) は、片付けると消える。
// 札を開いた時に上の階層の印を数え直す (描いた区分ごとに1つの関数を覚えておく)
const refresh = { top: null, sub: null, list: null };
function refreshBadges() { for (const k in refresh) if (refresh[k]) { try { refresh[k](); } catch (e) { /* 印のみ */ } } }
// 札/区分のボタンの印を付け替える (n: 数 / true = 点 / 0・null = 消す)
function setBadge(host, n) {
  if (!host) return;
  const old = host.querySelector(":scope > .ui-badge");
  if (old) old.remove();
  if (n) host.appendChild(badge(n));
}
// segmented / chips の i 番目のボタン
const segBtn = (segEl, i) => segEl && segEl.children[i];
const chipBtn = (chipsEl, i) => { const inner = chipsEl && chipsEl.querySelector(".ui-chips-in"); return inner && inner.children[i]; };
function freshOf(kind) {
  const c = G() && G().codex;
  const f = c && c.fresh && c.fresh[kind];
  return f && typeof f === "object" ? f : {};
}
const isFreshMon = (k) => !!(freshOf("mon")[k] && G().codex.mon[k] && MONSTERS[k]);
const isFreshItem = (id) => !!(freshOf("item")[id] && G().codex.item[id] && ITEMS[id]);
const isFreshJob = (k, r) => !!(freshOf("job")[k + ":" + r] && SOUL_CLASSES[k]);
function freshCounts() {
  const g = G();
  const mon = Object.keys(freshOf("mon")).filter(isFreshMon).length;
  const item = Object.keys(freshOf("item")).filter(isFreshItem).length;
  const job = Object.keys(freshOf("job")).filter((kr) => {
    const [k, r] = kr.split(":");
    const rec = g.codex.job[k];
    return isFreshJob(k, r) && rec && Number(r) <= Math.max(1, rec.rank || 1);
  }).length;
  const ev = Object.keys(evFresh()).filter((id) => EVENT_MAP[id]).length;
  return { mon, item, job, ev, total: mon + item + job + ev };
}
// 見聞録 (迷宮の出来事) の記録と新着
function evRec() { const g = G(); return (g && g.events) || { seen: {}, picks: {}, fresh: {}, flags: {}, once: {} }; }
function evFresh() { const f = evRec().fresh; return f && typeof f === "object" ? f : {}; }
const isFreshEv = (id) => !!(evFresh()[id] && EVENT_MAP[id]);
function markSeenEv(id, card) {
  const f = evFresh();
  if (!f[id]) return;
  delete f[id];
  if (card) { const m = card.querySelector(".pl-card-new"); if (m) m.remove(); card.classList.remove("fresh"); }
  refreshBadges();
}
// 詳細を開いた = 見た。印を消して数え直す
function markSeen(kind, key, card) {
  const f = freshOf(kind);
  if (!f[key]) return;
  delete f[key];
  if (card) { const m = card.querySelector(".pl-card-new"); if (m) m.remove(); card.classList.remove("fresh"); }
  refreshBadges();
}
const newMark = () => el("span", "pl-card-new", "新");

// ================= 図鑑 =================
function unknownCard() {
  const c = el("div", "pl-card unknown");
  const a = el("span", "pl-card-art");
  a.appendChild(el("span", "pl-card-q", "？"));
  c.appendChild(a);
  c.appendChild(el("span", "pl-card-n", "？？？"));
  return c;
}
function codexCard(sprite, name, { color = null, onTap = null, sub = null, price = null, kills = null, fresh = false } = {}) {
  const c = el("button", "pl-card" + (fresh ? " fresh" : ""));
  c.type = "button";
  if (color) c.style.setProperty("--edge", color);
  const a = el("span", "pl-card-art");
  try { a.appendChild(spriteCanvas(sprite, 4)); } catch (e) { /* 演出のみ */ }
  c.appendChild(a);
  const n = el("span", "pl-card-n", name);
  if (color) n.style.color = color;
  c.appendChild(n);
  if (kills != null) c.appendChild(el("span", "pl-card-k" + (kills ? "" : " none"), `討伐 ${kills}体`)); // 敵の札: 名の下に討伐数
  if (sub) c.appendChild(el("span", "pl-card-s", sub));
  if (price != null) {
    const p = el("span", "pl-card-p");
    p.appendChild(glyph("gold"));
    p.appendChild(document.createTextNode(String(price)));
    c.appendChild(p);
  }
  if (fresh) c.appendChild(newMark());
  c.setAttribute("aria-label", name + (price != null ? ` (売却額 ${price})` : "") + (kills != null ? ` (討伐 ${kills}体)` : "") + (fresh ? " (新着)" : ""));
  if (onTap) c.addEventListener("click", () => { sfx("select"); onTap(c); });
  return c;
}
// 遭遇したが、まだ討っていない迷宮の主: 名前だけ明かす (姿・能力は1体討つまで伏せる)
// 名のある強敵の札: 名は最初から出す。討つまでは絵を伏せ、縄張りと目撃・首級を添える
function namedCard(key, m, n) {
  const g = G();
  const killed = !!g.codex.mon[key];
  const sub = n ? (n.trophy ? "首級 ✓" : killed ? "首級なし" : n.seen ? `目撃 ${n.seenAt}` : (n.homes || []).join("・") || "名のある強敵") : "名のある強敵";
  if (killed) return codexCard(m, m.name, { color: "#ff7a5a", sub, kills: monKills(key), fresh: isFreshMon(key), onTap: (c) => { codexMonSheet(key); markSeen("mon", key, c); } });
  const c = el("button", "pl-card unknown boss-unk");
  c.type = "button";
  const a = el("span", "pl-card-art");
  a.appendChild(el("span", "pl-card-q", "？"));
  c.appendChild(a);
  c.appendChild(el("span", "pl-card-n", m.name));
  c.appendChild(el("span", "pl-card-k none", "討伐 0体"));
  c.appendChild(el("span", "pl-card-s", sub));
  c.setAttribute("aria-label", `${m.name} (${sub})`);
  c.addEventListener("click", () => { sfx("select"); codexMonSheet(key); });
  return c;
}
function bossNameCard(key, m) {
  const c = el("button", "pl-card unknown boss-unk");
  c.type = "button";
  const a = el("span", "pl-card-art");
  a.appendChild(el("span", "pl-card-q", "？"));
  c.appendChild(a);
  c.appendChild(el("span", "pl-card-n", m.name));
  c.appendChild(el("span", "pl-card-k none", "討伐 0体"));
  c.appendChild(el("span", "pl-card-s", "主"));
  c.setAttribute("aria-label", `${m.name} (討伐 0体)`);
  c.addEventListener("click", () => { sfx("select"); codexMonSheet(key); });
  return c;
}
const CARD_H = 104;
const MON_CARD_H = 118; // 敵の札は名の下に討伐数の1行ぶん高い

// 迷宮の魔物の札: 討った敵は姿と名、まだの敵は「？？？」(迷宮の主は遭遇した後だけ名を出す)。名のある強敵は namedCard
function monCard(key, namedBy = null) {
  const g = G();
  const m = MONSTERS[key];
  if (namedBy && m.named) return namedCard(key, m, namedBy[key]);
  if (!g.codex.mon[key]) return m.boss && g.codex.met && g.codex.met[key] ? bossNameCard(key, m) : unknownCard();
  return codexCard(m, m.name, { color: m.rank ? RANK_COLOR[m.rank] : null, sub: m.boss ? "主" : m.elite ? "強敵" : null, kills: monKills(key), fresh: isFreshMon(key),
    onTap: (c) => { codexMonSheet(key); markSeen("mon", key, c); } });
}

// 出撃シートの「発見した魔物」から開く: その迷宮に出る魔物 (雑魚・強敵・主) の札。札をタップ = 図鑑の詳細
export function dungeonMonSheet(dungeonIdx) {
  const g = G();
  const dn = DUNGEONS[dungeonIdx];
  if (!g || !dn) return null;
  const roster = game.dungeonRoster ? game.dungeonRoster(dn) : [];
  const namedBy = Object.fromEntries((game.namedHere ? game.namedHere(dn) : []).map((n) => [n.id, n]));
  const seen = roster.filter((k) => g.codex.mon[k]).length;
  const box = el("div", "pl-dmon");
  box.appendChild(el("div", "pl-codex-cap", `発見した魔物 ${seen}/${roster.length} ・ 討った敵は札から詳しく見られる`));
  const grid = el("div", "wa-pgrid pl-dmon-grid");
  grid.style.gridTemplateColumns = "repeat(3, minmax(0, 1fr))";
  grid.style.gridAutoRows = MON_CARD_H + "px";
  grid.style.gap = "8px";
  for (const key of roster) grid.appendChild(monCard(key, namedBy));
  if (!roster.length) box.appendChild(el("div", "wa-empty", "記録なし。"));
  else box.appendChild(grid);
  sfx("select");
  return sheet.open({
    kind: "info", banner: "発見した魔物", title: dn.name, body: box, className: "pl-dmon-sheet",
    footer: [{ label: "閉じる", kind: "ghost", onTap: (h) => h.close() }],
  });
}

// 敵の図鑑はダンジョン単位: 地図に現れた迷宮ごとの札 (台帳の並び) + その他。札の中身は、その迷宮に出る雑魚・強敵・主
const dunOpen = (i) => { try { return game.worldOpenIdx ? game.worldOpenIdx(i) : i < Math.max(1, G().unlockedDungeons || 1); } catch (e) { return i === 0; } };
function renderCodexMon(box) {
  const g = G();
  const opened = DUNGEONS.map((d, i) => i).filter(dunOpen);
  if (!opened.length) opened.push(0);
  let idx = Number(remember("codex", "dungeon"));
  // 名のある強敵 (縄張りが地図に現れた者)。区分 -2
  const named = game.namedList ? game.namedList() : [];
  const namedBy = Object.fromEntries(named.map((n) => [n.id, n]));
  if (!Number.isFinite(idx) || (idx !== -1 && !(idx === -2 && named.length) && !opened.includes(idx))) idx = opened[0];
  const items = [];
  if (named.length) items.push({ key: "-2", label: "名のある強敵" });
  for (const i of opened) items.push({ key: String(i), label: DUNGEONS[i].name });
  items.push({ key: "-1", label: "その他" });
  const rosterOf = (i) => i === -2 ? named.map((n) => n.id) : i === -1 ? (game.CODEX_OTHER || []).filter((k) => MONSTERS[k]) : (game.dungeonRoster ? game.dungeonRoster(DUNGEONS[i]) : []);
  const freshIn = (i) => rosterOf(i).filter(isFreshMon).length || null;
  for (const it of items) it.badge = freshIn(Number(it.key));
  const cap = el("div", "pl-codex-cap");
  let area = null;
  const draw = () => {
    const isOther = idx === -1, isNamed = idx === -2;
    const roster = rosterOf(idx);
    const seen = roster.filter((k) => g.codex.mon[k]).length;
    cap.textContent = isNamed ? `名のある強敵 — 縄張りの迷宮の強敵階に出る。初めて討てば首級　討伐 ${seen}/${roster.length}`
      : isOther ? `その他 — 宝箱や出来事に潜む敵・まれに紛れ込む者　記録 ${seen}/${roster.length}` : `${DUNGEONS[idx].name}　記録 ${seen}/${roster.length}`;
    scrollGrid(area, roster, (key) => isNamed ? namedCard(key, MONSTERS[key], namedBy[key]) : monCard(key),
      { cols: 3, cellH: MON_CARD_H, key: "mon:" + idx, empty: el("div", "wa-empty", "記録なし。") });
  };
  const ch = chips(items, String(idx), (k) => { idx = Number(k); remember("codex", "dungeon", idx); resetPages(["mon:"]); draw(); });
  refresh.list = () => items.forEach((it, i) => setBadge(chipBtn(ch, i), freshIn(Number(it.key))));
  box.appendChild(ch);
  box.appendChild(cap);
  area = fillArea(box);
  draw();
}

// 図鑑の札に載せる売却額 (商会で売るときの値と同じ)
const sellOf = (it) => (game.sellPrice ? game.sellPrice(it) : Math.max(1, Math.floor((it.price || 10) / 2)));

function renderCodexItem(box) {
  const g = G();
  const seenIds = Object.keys(g.codex.item).filter((id) => ITEMS[id]);
  let cat = remember("codex", "itemCat") || "weapon";
  if (!ITEM_CATS.some((c) => c.key === cat)) cat = "weapon";
  let wcat = remember("codex", "weaponCat") || "all";
  const sub = el("div", "pl-codex-sub");
  const cap = el("div", "pl-codex-cap");
  let area = null, wch = null;
  // 分類ごとの新着の数 (武器は種別ごとにも)
  const idsOfCat = (key) => { const d = ITEM_CATS.find((c) => c.key === key); const slots = new Set((d && d.slots) || []); return seenIds.filter((id) => slots.has(ITEMS[id].slot)); };
  const freshCat = (key) => idsOfCat(key).filter(isFreshItem).length || null;
  const wItems = [{ key: "all", label: "すべて" }, ...WEAPON_CATS.map((w) => ({ key: w.key, label: w.label }))];
  const freshW = (wk) => idsOfCat("weapon").filter((id) => isFreshItem(id) && (wk === "all" || ITEMS[id].cat === wk)).length || null;
  // 盾はジャンル (大盾・円盾・小盾・宝珠・聖典) ごとにも分ける。区分の記憶は武器の種別と共用 (分類を替えると「すべて」に戻る)
  const sItems = [{ key: "all", label: "すべて" }, ...SHIELD_KINDS.map((k) => ({ key: k.key, label: k.label }))];
  const freshS = (sk) => idsOfCat("shield").filter((id) => isFreshItem(id) && (sk === "all" || shieldKind(ITEMS[id]) === sk)).length || null;
  const draw = () => {
    sub.textContent = "";
    wch = null;
    const def = ITEM_CATS.find((c) => c.key === cat) || ITEM_CATS[0];
    let ids = idsOfCat(def.key);
    if (def.key === "weapon") {
      wch = chips(wItems.map((w) => ({ ...w, badge: freshW(w.key) })), wcat, (k) => { wcat = k; remember("codex", "weaponCat", k); resetPages(["item:"]); draw(); });
      sub.appendChild(wch);
      if (wcat !== "all") ids = ids.filter((id) => ITEMS[id].cat === wcat);
    } else if (def.key === "shield") {
      if (!sItems.some((x) => x.key === wcat)) wcat = "all";
      wch = chips(sItems.map((x) => ({ ...x, badge: freshS(x.key) })), wcat, (k) => { wcat = k; remember("codex", "weaponCat", k); resetPages(["item:"]); draw(); });
      sub.appendChild(wch);
      if (wcat !== "all") ids = ids.filter((id) => shieldKind(ITEMS[id]) === wcat);
    }
    // 売却額の安い順 (同額は隠しレベル → id)
    ids.sort((a, b) => sellOf(ITEMS[a]) - sellOf(ITEMS[b]) || (ITEMS[a].lv || 0) - (ITEMS[b].lv || 0) || a.localeCompare(b));
    cap.textContent = `${def.label}　発見 ${ids.length} 種　(売却額の安い順)`;
    const cards = new Map(); // 詳細で前後へ送ったら、その札の新着の印も消す
    const seen = (id) => markSeen("item", id, cards.get(id) || null);
    scrollGrid(area, ids, (id) => {
      const it = ITEMS[id];
      const c = codexCard(it, it.name, { color: (game.itemRankColor && game.itemRankColor(it)) || rarityColor(it), price: sellOf(it), fresh: isFreshItem(id),
        onTap: () => { codexItemSheet(id); seen(id); } });
      cards.set(id, c);
      return c;
    }, { cols: 3, cellH: CARD_H, key: "item:" + cat + ":" + wcat, empty: el("div", "wa-empty", "この区分のアイテムは、まだ手にしていない。") });
  };
  const ch = chips(ITEM_CATS.map((c) => ({ key: c.key, label: c.label, badge: freshCat(c.key) })), cat, (k) => { cat = k; wcat = "all"; remember("codex", "itemCat", k); remember("codex", "weaponCat", "all"); resetPages(["item:"]); draw(); });
  refresh.list = () => {
    ITEM_CATS.forEach((c, i) => setBadge(chipBtn(ch, i), freshCat(c.key)));
    if (wch) wItems.forEach((w, i) => setBadge(chipBtn(wch, i), freshW(w.key)));
  };
  box.appendChild(ch);
  box.appendChild(sub);
  box.appendChild(cap);
  area = fillArea(box);
  draw();
}

function renderCodexJob(box) {
  const g = G();
  const known = Object.keys(SOUL_CLASSES).filter((k) => g.codex.job[k]);
  const attained = (k) => Math.max(1, (g.codex.job[k] && g.codex.job[k].rank) || 1);
  // 位階の高い順に、到達した位階の称号を札にする
  const list = [];
  for (let r = 5; r >= 1; r--) for (const k of known) if (attained(k) >= r) list.push({ k, r });
  box.appendChild(el("div", "pl-codex-cap", "人業に発現した職業を、到達した位階 (ランク) ごとに記す。"));
  const area = fillArea(box);
  refresh.list = null;
  scrollGrid(area, list, ({ k, r }) => codexCard(jobSprite(k, r), jobRankName(k, r), { color: SOUL_CLASSES[k].glow, sub: `R${r}`, fresh: isFreshJob(k, r),
    onTap: (c) => { codexJobSheet(k, r); markSeen("job", k + ":" + r, c); } }),
    { cols: 3, cellH: CARD_H, key: "job", empty: el("div", "wa-empty", "まだ職業を見つけていない。迷宮で魂を吸収すると職業が記される。") });
}

// 見聞録: 迷宮で出会った出来事 (共通 / 層ごと)。出会っていない出来事は「？？？」
// 層の欄は、その層の迷宮が解放されてから出す (まだ行けない層の名を先に明かさない)。
// 解放より先に記録がある層 (古いセーブ等) は出す
function evGroupsOpen(rec) {
  // 層の欄は、その層の景色の迷宮が地図に現れてから出す
  const layers = new Set(DUNGEONS.filter((d, i) => dunOpen(i)).map((d) => d.layer));
  return EVENT_GROUPS.filter((x) => !x.layer || layers.has(x.layer)
    || EVENTS.some((e) => (e.layer || 0) === x.layer && rec.seen[e.id]));
}
const EV_STUB = { countCells: () => 0, monName: () => "古強者", eliteKeyHere: () => null, sense: () => false, layer: 1 };
function evIcon(e) { return (e.icon && e.icon.startsWith("mon:") ? MONSTERS[e.icon.slice(4)] : ICONS[e.icon]) || ICONS.event; }
function renderCodexEvents(box) {
  const rec = evRec();
  const groups = evGroupsOpen(rec);
  let gk = remember("codex", "evGroup") || "0";
  if (!groups.some((x) => x.key === gk)) gk = "0";
  const listOf = (k) => { const L = Number(k); return EVENTS.filter((e) => (e.layer || 0) === L); };
  const freshIn = (k) => listOf(k).filter((e) => isFreshEv(e.id)).length || null;
  const cap = el("div", "pl-codex-cap");
  let area = null;
  const draw = () => {
    const list = listOf(gk);
    const seen = list.filter((e) => rec.seen[e.id]).length;
    cap.textContent = `${(EVENT_GROUPS.find((x) => x.key === gk) || {}).name || ""}の出来事　見聞 ${seen}/${list.length}`;
    scrollGrid(area, list, (e) => {
      if (!rec.seen[e.id]) return unknownCard();
      const t = EV_TIERS[e.tier];
      return codexCard(evIcon(e), e.name, { color: t.accent, sub: t.label, fresh: isFreshEv(e.id),
        onTap: (c) => { codexEventSheet(e.id); markSeenEv(e.id, c); } });
    }, { cols: 3, cellH: CARD_H, key: "ev:" + gk, empty: el("div", "wa-empty", "記録なし。") });
  };
  const ch = chips(groups.map((x) => ({ key: x.key, label: x.label, badge: freshIn(x.key) })), gk, (k) => { gk = k; remember("codex", "evGroup", k); resetPages(["ev:"]); draw(); });
  refresh.list = () => groups.forEach((x, i) => setBadge(chipBtn(ch, i), freshIn(x.key)));
  box.appendChild(ch);
  box.appendChild(cap);
  area = fillArea(box);
  draw();
}
export function codexEventSheet(id) {
  const e = EVENT_MAP[id];
  if (!e) return null;
  const rec = evRec();
  const t = EV_TIERS[e.tier];
  const body = el("div", "pl-detail");
  const tag = el("div", "pl-detail-tags");
  const tt = el("span", "pl-tag", t.name);
  tt.style.color = t.accent;
  tag.appendChild(tt);
  tag.appendChild(el("span", "pl-tag", `遭遇 ${rec.seen[id] || 0}`));
  body.appendChild(tag);
  let intro = [];
  try { intro = e.intro(EV_STUB, {}) || []; } catch (err) { intro = []; }
  for (const ln of intro) body.appendChild(setText(el("div", "pl-detail-desc"), ln));
  body.appendChild(infoBlock("現れる所", [pairRow(eventWhereText(e))]));
  if (e.gift) {
    // 極: 選択肢は無く、踏めば恒久の恵みを授かる
    const got = !!(rec.once && rec.once[onceKey(e, e.layer)]);
    body.appendChild(infoBlock("恒久の恵み", [pairRow(e.boon, got ? "授かった" : "まだ", { dim: !got })]));
  } else {
    const picks = Object.entries((rec.picks && rec.picks[id]) || {});
    body.appendChild(infoBlock("選んだ道", picks.length ? picks.map(([k, n]) => pairRow(k, `${n}回`)) : [pairRow("まだ選んだことはない", null, { dim: true })]));
  }
  // 操霊師の遺書: 読んだページ
  if (id === "c30") {
    const lore = (rec.flags && rec.flags.lore) || {};
    const ls = Object.keys(lore).filter((k) => lore[k]).sort();
    if (ls.length) for (const L of ls) body.appendChild(infoBlock(`第${L}層のページ`, (LORE_PAGES[L] || LORE_PAGES[0]).map((x) => setText(el("div", "pl-detail-desc"), x))));
  }
  return sheet.open({
    kind: "info", banner: t.banner, accent: t.accent, art: evIcon(e), artScale: 6, title: e.name, body, className: "pl-detail-sheet",
    footer: [{ label: "閉じる", kind: "ghost", onTap: (h) => h.close() }],
  });
}

// 図鑑の記録の数 (敵・アイテム・職業・見聞)
function codexTotals() {
  const g = G();
  return {
    mon: Object.keys(g.codex.mon).filter((k) => MONSTERS[k]).length,
    item: Object.keys(g.codex.item).filter((k) => ITEMS[k]).length,
    job: Object.keys(g.codex.job).filter((k) => SOUL_CLASSES[k]).length,
    ev: Object.keys((g.events && g.events.seen) || {}).filter((k) => EVENT_MAP[k]).length,
  };
}
function renderCodex(body) {
  const sub = ["mon", "item", "job", "ev"].includes(remember("seg", "codex")) ? remember("seg", "codex") : "mon";
  const { mon: mons, item: items, job: jobs, ev: evs } = codexTotals();
  const fc = freshCounts();
  const box = el("div", "pl-codex");
  const draw = (k) => {
    box.textContent = "";
    if (k === "mon") renderCodexMon(box);
    else if (k === "item") renderCodexItem(box);
    else if (k === "ev") renderCodexEvents(box);
    else renderCodexJob(box);
  };
  const segEl = segmented([
    { key: "mon", label: `敵 ${mons}`, badge: fc.mon || null }, { key: "item", label: `アイテム ${items}`, badge: fc.item || null }, { key: "job", label: `職業 ${jobs}`, badge: fc.job || null },
    { key: "ev", label: `見聞 ${evs}`, badge: fc.ev || null },
  ], sub, (k) => { sfx("select"); resetCodexView(k); draw(k); softFade(box); }, { prefKey: "codex" });
  segEl.classList.add("pl-codex-seg"); // 4区分 (見聞録つき) を1行に収める
  refresh.sub = () => { const c = freshCounts(); ["mon", "item", "job", "ev"].forEach((k, i) => setBadge(segBtn(segEl, i), c[k] || null)); };
  body.appendChild(segEl);
  body.appendChild(box);
  draw(sub);
}

// 迷宮の中で開く図鑑 (手帳の「図鑑」から)。王宮の図鑑と同じ中身 (敵/アイテム/職業/見聞) を背の高いシートに収める。
// 敵はいま潜っている迷宮の札から開く (dungeonIdx)
export function openCodexSheet({ dungeonIdx = null } = {}) {
  const g = G();
  if (!g) return null;
  codexHome.dungeon = Number.isInteger(dungeonIdx) && dungeonIdx >= 0 && dunOpen(dungeonIdx) ? dungeonIdx : 0;
  resetCodexView("mon");
  const box = el("div", "pl-body cx-body");
  refresh.top = refresh.sub = refresh.list = null;
  const h = sheet.open({
    kind: "info", banner: "図鑑", className: "cx-sheet", body: box,
    footer: [{ label: "閉じる", kind: "ghost", onTap: (s) => s.close() }],
    onClose: () => { refresh.sub = refresh.list = null; codexHome.dungeon = 0; },
  });
  renderCodex(box); // シートが画面に出てから描く (めくる格子が残りの高さを測るため)
  scrollBox(box);
  return h;
}

// ---- 図鑑の詳細 (シート) ----
function infoBlock(title, rows) {
  const b = el("div", "pl-info");
  if (title) b.appendChild(el("div", "pl-info-h", title));
  for (const r of rows) b.appendChild(r.nodeType ? r : setText(el("div", "pl-info-r"), r));
  return b;
}
function pairRow(name, desc, { dim = false, onTap = null, tags = null } = {}) {
  const r = el(onTap ? "button" : "div", "pl-pair" + (dim ? " dim" : "") + (onTap ? " tap" : ""));
  if (onTap) { r.type = "button"; r.addEventListener("click", onTap); }
  const n = setText(el("span", "pl-pair-n"), name);
  const tg = tags && tagRow(tags);
  if (tg) n.appendChild(tg);
  r.appendChild(n);
  if (desc) r.appendChild(setText(el("span", "pl-pair-d"), desc));
  return r;
}

export function codexMonSheet(key) {
  const m = MONSTERS[key];
  if (!m) return null;
  // 記録は読むだけ (開いただけで討伐の記録を作らない — まだ討っていない主も開ける)
  const rec = G() && G().codex && G().codex.mon ? G().codex.mon[key] : null;
  const e = rec && typeof rec === "object" ? rec : { kills: 0, dungeons: {} };
  const rc = m.rank ? RANK_COLOR[m.rank] : null;
  const elm = ELEMENTS[m.element] || ELEMENTS.none;
  const isOther = (game.CODEX_OTHER || []).includes(key);
  const body = el("div", "pl-detail");
  // 倒した数に応じて段階的に明かす (戦闘中の「敵の姿」と同じ。迷宮の主は1体討てば全て)
  const kills = monKills(key);
  const R = revealSteps(m);
  const statsOpen = kills >= R.stats, loreOpen = kills >= R.lore;
  const tag = el("div", "pl-detail-tags");
  if (statsOpen) {
    const et = el("span", "pl-tag", `属性 ${elm.label}`);
    et.style.color = elm.color;
    tag.appendChild(et);
  }
  tag.appendChild(el("span", "pl-tag", `討伐数 ${kills}体`));
  if (m.boss) tag.appendChild(el("span", "pl-tag gold", "迷宮の主"));
  if (m.named) tag.appendChild(el("span", "pl-tag gold", "名のある強敵"));
  body.appendChild(tag);
  if (statsOpen) {
    const aff = affinityRow(m.element, "pl-aff");
    if (aff) body.appendChild(aff);
  }
  if (loreOpen && m.desc) body.appendChild(setText(el("div", "pl-detail-desc"), m.desc));
  // 金属の魔物: 能力値は出た階で組み直すので、HP と「普通の戦闘の何倍の✦Soul か」だけを示す
  const mt = m.metal ? METAL_TIERS[m.metal] : null;
  if (statsOpen && mt) body.appendChild(setText(el("div", "pl-detail-stats"), `HP ${mt.hpRank ? "多め" : mt.hp}　✦ その階の戦闘1回の約${mt.soulMul}倍　逃走 ${Math.round(mt.flee * 100)}%/手番`));
  else if (statsOpen) body.appendChild(setText(el("div", "pl-detail-stats"), `HP ${Math.max(1, Math.round(m.maxhp * resistHpMul(m)))}　ATK ${m.atk}　VIT ${m.def}　AGI ${m.spd}　✦${m.soul}　💰${m.gold}`));
  else body.appendChild(revealLock(R.stats, "属性・HP"));
  if (loreOpen) {
    const traits = monsterTraits(m);
    body.appendChild(infoBlock("特徴・スキル", traits.length ? traits.map((t) => pairRow(t.label, t.desc, { tags: traitTagKinds(t.key, m.element) })) : [pairRow("特筆すべき特徴はない", null, { dim: true })]));
  } else body.appendChild(revealLock(R.lore, "特徴・スキル・説明文"));
  // 名のある強敵: 縄張り・目撃・首級・懸賞
  const ni = m.named && game.namedInfo ? game.namedInfo(key) : null;
  if (ni) {
    const tro = ni.trophyId && ITEMS[ni.trophyId] ? ITEMS[ni.trophyId].name : "";
    const bountyTxt = { offer: "酒場に懸賞あり", active: "受けている", done: "果たした (酒場で報告)", claimed: "報告済み" }[ni.bounty] || (ni.posted ? "酒場に懸賞あり" : "縄張りの迷宮が地図に現れると酒場に出る");
    body.appendChild(infoBlock("名のある強敵", [
      pairRow("縄張り", (ni.homes || []).join("・") || "—"),
      pairRow("目撃", ni.seen ? `${ni.seenAt ? ni.seenAt + " " : ""}B${ni.seen.floor}F` : "まだ姿を見せていない"),
      pairRow("首級", ni.trophy ? `${tro} ✓` : kills > 0 ? `${tro} (いま手元にない — 次に討てばまた落とす)` : "初めて討てば手に入る"),
      pairRow("懸賞", bountyTxt),
    ]));
  }
  const idxs = Object.keys(e.dungeons || {}).map(Number).filter((i) => DUNGEONS[i]);
  body.appendChild(infoBlock("出現した迷宮", idxs.length ? idxs.map((i) => pairRow(DUNGEONS[i].name)) : [pairRow("記録なし", null, { dim: true })]));
  return sheet.open({
    kind: "info", banner: isOther ? "その他" : `${RACE_LABEL[m.race] || "敵"}${m.rank ? "・" + RANK_NAME[m.rank] + "級" : ""}`,
    accent: rc, art: kills > 0 || !(m.boss || m.named) ? m : null, artScale: 8, float: isFloating(m, key), title: m.name, body, className: "pl-detail-sheet",
    footer: [{ label: "閉じる", kind: "ghost", onTap: (h) => h.close() }],
  });
}

// o: { item (所持品の実体), heading (見出し 例: 鑑定成功した！), headingColor, badge (見出しの右の札 例: 初ゲット！), footer, onClose }
function codexItemView(it, o) {
  const rc = (game.itemRankColor && game.itemRankColor(it)) || rarityColor(it);
  const body = el("div", "pl-detail");
  if (o.heading) {
    const hd = setText(el("div", "pl-detail-heading"), o.heading);
    hd.style.color = o.headingColor || rc;
    if (o.badge) hd.appendChild(el("span", "first-get", o.badge));
    body.appendChild(hd);
  }
  // 所持品の実体が未鑑定なら正体は伏せる (名・性能・説明は鑑定するまで見せない)
  const unid = !!(o.item && o.item.unidentified);
  if (unid) {
    body.appendChild(setText(el("div", "pl-detail-cat"), "未鑑定 ― 正体はまだわからない"));
    body.appendChild(setText(el("div", "pl-detail-desc"), it.idHardFail ? "鑑定の心得では見抜けなかった。商会 (有料) でなら鑑定できる。" : "商会 (有料) か、鑑定の心得がある仲間に見てもらおう。"));
  } else {
    body.appendChild(setText(el("div", "pl-detail-cat"), itemCatText(it)));
    const st = statLines(it);
    if (st) body.appendChild(setText(el("div", "pl-detail-stats"), st));
    if (it.desc) body.appendChild(setText(el("div", "pl-detail-desc"), it.desc));
  }
  return {
    banner: unid ? "未鑑定の品" : game.itemGradeText ? game.itemGradeText(it, "品") : "品", accent: rc, art: it, artScale: 9,
    title: unid ? itemName(it) : it.name, titleColor: rc, body,
  };
}
export function codexItemSheet(id, o = {}) {
  const it = o.item || ITEMS[id];
  if (!it) return null;
  return sheet.open({
    kind: "info", ...codexItemView(it, o), className: "pl-detail-sheet",
    footer: o.footer || [{ label: "閉じる", kind: "ghost", onTap: (hh) => hh.close() }],
    onClose: o.onClose,
  });
}

export function codexJobSheet(key, rank, heading) {
  if (!SOUL_CLASSES[key]) return null;
  const g = G();
  const rec = g.codex.job[key];
  rank = Math.max(1, Math.min(5, rank || (rec && rec.rank) || 1));
  const color = SOUL_CLASSES[key].glow;
  const body = el("div", "pl-detail");
  if (heading) {
    const hd = setText(el("div", "pl-detail-heading"), heading);
    hd.style.color = color;
    body.appendChild(hd);
  }
  body.appendChild(setText(el("div", "pl-detail-cat"), `${SOUL_CLASSES[key].label}系`));
  const lore = jobLoreFor(key, rank);
  if (lore.desc) body.appendChild(setText(el("div", "pl-detail-desc"), lore.desc));
  if (lore.tips) body.appendChild(setText(el("div", "pl-detail-desc tips"), "活用: " + lore.tips));
  // 発現の条件
  const upPct = Math.round((SOUL_STAT_UP[SOUL_CLASSES[key].rarity] || 0.01) * 100);
  body.appendChild(infoBlock("発現の条件", [pairRow(jobRankCondText(key, rank)), pairRow(`魂を1つ吸収するごと、全能力 基礎値×${upPct}% UP`, null, { dim: true })]));
  // 装備適性 + 得意属性 (その属性の物理技・呪文を多く覚える)
  const gg = JOB_GEAR[key];
  const aff = JOB_AFFINITY[key] || [];
  const affRow = aff.length ? pairRow("得意属性", null, { tags: aff.map((e) => "el:" + e) }) : null;
  if (gg) {
    const armor = gg.armor === "heavy" ? "重装可" : gg.armor === "light" ? "軽装まで" : "布装のみ";
    body.appendChild(infoBlock("装備適性", [
      pairRow("武器", gg.weapons ? gg.weapons.map((w) => WEAPON_CAT_LABEL[w] || w).join("・") : "—"),
      pairRow("防具", armor), pairRow("盾", gg.shields && gg.shields.length ? gg.shields.map((k) => SHIELD_KIND_LABEL[k] || k).join("・") : "持てない (両手武器で攻める)"), affRow,
    ].filter(Boolean)));
  } else if (affRow) {
    body.appendChild(infoBlock("得意属性", [affRow]));
  }
  // ランクのパッシブ (ランク2で目覚め、3・4・5で強まる。Lvで覚えるパッシブは下の技の表に並ぶ)
  const rkRows = [];
  for (let r = 2; r <= 5; r++) {
    const pk = awakenPerkOf(key, r);
    if (!pk) continue;
    rkRows.push(r <= rank
      ? pairRow(`ランク${r} ${pk.name}`, `[パッシブ] ${pk.desc}`, { onTap: () => showPassivePopup(pk.key, pk.lv) })
      : pairRow(`ランク${r} ？？？`, null, { dim: true }));
  }
  body.appendChild(infoBlock("ランクのパッシブ", rkRows.length ? rkRows : [pairRow("—", null, { dim: true })]));
  // スキル表: このランクのLv上限まで。到達したLvのものだけ開示
  const reached = (rec && typeof rec === "object" && rec.lv) || 0;
  const capCount = (rankThresholds(SOUL_CLASSES[key].rarity)[rank - 1]) || 1;
  const lvCap = Math.max(soulLevelCap(key, capCount), reached);
  const rows = [];
  for (const e of jobSkillTable(key)) {
    if (e.lvl > lvCap) continue;
    const lv = `Lv${e.lvl}`;
    if (e.passive) {
      rows.push(reached >= e.lvl ? pairRow(`${lv} ${passiveName(e.passive, e.plv || 1)}`, `[パッシブ] ${passiveDesc(e.passive, e.plv || 1)}`, { onTap: () => showPassivePopup(e.passive, e.plv || 1) }) : pairRow(`${lv} ？？？`, null, { dim: true }));
    } else {
      const sp = SPELLS[e.skill];
      rows.push(reached >= e.lvl && sp ? pairRow(`${lv} ${sp.name}`, `${sp.desc} (${spellMpLabel(sp)})`, { onTap: () => showSkillPopup(e.skill), tags: spellTagKinds(sp) }) : pairRow(`${lv} ？？？`, null, { dim: true }));
    }
  }
  body.appendChild(infoBlock("技", rows.length ? rows : [pairRow("—", null, { dim: true })]));
  return sheet.open({
    kind: "info", banner: `ランク${rank}`, accent: color, art: jobSprite(key, rank), artScale: 12,
    title: jobRankName(key, rank), titleColor: color, body, className: "pl-detail-sheet", // 職業詳細は縦スクロールで1ページに
    footer: [{ label: "閉じる", kind: "ghost", onTap: (h) => h.close() }],
  });
}

// ================= 勲章 =================
function rewardEl(rw) {
  const s = el("span", "pl-reward");
  const add = (kind, n) => { if (!n) return; const p = el("span"); p.appendChild(glyph(kind)); p.appendChild(document.createTextNode(String(n))); s.appendChild(p); };
  add("gold", rw.gold); add("red", rw.redSoul); add("soul", rw.soulPts);
  return s;
}
function renderAch(body) {
  const g = G();
  const cards = game.achievementCards ? game.achievementCards() : [];
  const ready = cards.filter((c) => c.ready).length;
  const got = Object.keys(g.ach || {}).length;
  // 受領数・勲位とまとめて拝受を1段に。勲章の総数・段の総数は見せない (段はどの系統も尽きない)
  const top = el("div", "pl-top");
  const prog = el("div", "pl-prog");
  const pt = el("div", "pl-prog-t", `受領した勲章 ${got}`);
  const rank = game.medalRank ? game.medalRank(got) : null;
  if (rank) pt.appendChild(el("span", "pl-prog-s", `勲位 ${rank.name}・次まで ${rank.next}`));
  prog.appendChild(pt);
  top.appendChild(prog);
  const all = button({ label: ready ? `まとめて拝受 ${ready}` : "拝受できる勲章なし", kind: ready ? "primary" : "ghost", size: "sm", disabled: !ready, onTap: () => ops.claimAllAchievements() });
  all.classList.add("pl-top-b");
  top.appendChild(all);
  body.appendChild(top);
  const area = fillArea(body);
  scrollGrid(area, cards, (c) => {
    const card = el("div", "pl-ach" + (c.ready ? " ready" : c.allDone ? " done" : ""));
    card.appendChild(el("span", "pl-medal" + (c.ready ? " ready" : c.allDone ? " done" : "")));
    if (c.ready) card.appendChild(newMark()); // 拝受すると消える
    // 秘された勲章: 達成するまで名も条件も褒美も伏せる
    const hidden = c.a.secret && !c.ready && !c.allDone;
    const t = el("div", "pl-ach-t");
    t.appendChild(setText(el("div", "pl-ach-n"), hidden ? "秘された勲章" : c.a.name));
    // いまの値 (回数・種類) を添えて、次の段までの道のりを見せる
    const now = !hidden && !c.ready && c.now != null ? `（いま ${c.now}）` : "";
    t.appendChild(setText(el("div", "pl-ach-d"), hidden ? "その条件は、まだ闇の中にある" : c.a.desc + now));
    const meta = el("div", "pl-ach-m");
    if (c.total > 1) meta.appendChild(el("span", "pl-ach-tier", `段 ${c.tier}`));
    if (c.allDone) meta.appendChild(el("span", "pl-ach-got", "受領済"));
    else if (hidden) meta.appendChild(el("span", "pl-reward", "？"));
    else meta.appendChild(rewardEl(c.a.reward));
    if (c.ready) {
      const b = button({ label: "拝受", kind: "primary", size: "sm", onTap: () => game.claimAchievement(c.a) });
      b.classList.add("pl-ach-b");
      meta.appendChild(b);
    }
    t.appendChild(meta);
    card.appendChild(t);
    return card;
  }, { cols: 2, cellH: 104, key: "ach" });
}

// ================= 宝物庫 =================
// 収集品にランクは無く、全部で何種あるかも見せない (台帳は図鑑と同じく、奉納した品の札だけを並べる)
const LEDGER_H = 96; // 台帳の札 (図鑑の札を少し詰める: 小さな画面でも1段とめくりが収まるように)
function nextMilestone(ts) { return (game.TREASURY_MILESTONES || []).find((m) => !ts.claimed["m" + m.n]) || null; }
function rung(m, total) {
  const reached = total >= m.n;
  const r = el("div", "pl-rung" + (reached ? " ready" : ""));
  r.appendChild(el("span", "pl-rung-n", `${m.n}種`));
  r.appendChild(setText(el("span", "pl-rung-l"), game.milestoneLabel ? game.milestoneLabel(m) : ""));
  if (reached) r.appendChild(button({ label: "受け取る", kind: "primary", size: "sm", onTap: () => game.claimTreasury(m.n) }));
  else r.appendChild(el("span", "pl-rung-s", `あと ${m.n - total}`));
  return r;
}
// 「収集品を奉納」: 奉納する品の詳細を並べたシート → 「奉納する」で奉納 (節目に届けばそのまま褒賞へ)
// 初めての種類は台帳に記され、奉納済みの種類・重なった品は売却と同じ金貨に換わる
export function donateSheet() {
  const list = ops.donatableList ? ops.donatableList() : [];
  if (!list.length) return null;
  sfx("select");
  const ts = game.treasuryState();
  const total = game.totalDonatedKinds ? game.totalDonatedKinds() : 0;
  const kinds = list.filter((h) => !h.dup).length;
  const gold = list.reduce((a, h) => a + (h.dup ? h.gold : 0), 0);
  const after = total + kinds;
  const next = (game.TREASURY_MILESTONES || []).find((m) => !ts.claimed["m" + m.n] && after >= m.n);
  return sheet.open({
    kind: "info", banner: "宝物庫に奉納", title: `収集品 ${list.length} 点`, className: "pl-donate-card",
    body: (scroll) => {
      if (kinds) scroll.appendChild(el("div", "pl-dn-lead", `初めての ${kinds} 種は台帳に記される。（奉納 ${total} → ${after} 種）`));
      if (gold) scroll.appendChild(el("div", "pl-dn-lead", `奉納済みの品は、売却と同じ金貨 ${gold} を受け取る。`));
      const items = el("div", "pl-dn-list");
      for (const h of list) {
        const def = ITEMS[h.item.id] || h.item;
        const it = el("div", "pl-dn" + (h.dup ? " dup" : ""));
        it.appendChild(itemTile(h.item, { size: 44, isNew: !h.dup, onTap: () => openItem(h.item.id, { instance: h.item, owner: h.doll, context: "donate" }) }));
        const tx = el("div", "pl-dn-tx");
        const nm = el("div", "pl-dn-n", itemName(h.item));
        const col = (game.itemRankColor && game.itemRankColor(h.item)) || rarityColor(h.item);
        if (col) nm.style.color = col;
        tx.appendChild(nm);
        const m = el("div", "pl-dn-m");
        if (h.dup) { m.appendChild(document.createTextNode("奉納済み ・ ")); m.appendChild(glyph("gold")); m.appendChild(document.createTextNode(String(h.gold))); }
        else m.appendChild(document.createTextNode("台帳に記される"));
        m.appendChild(document.createTextNode(` ・ ${h.doll ? h.doll.name + " の荷" : "手持ち"}`));
        tx.appendChild(m);
        if (!h.dup && def.desc) tx.appendChild(setText(el("div", "pl-dn-d"), def.desc));
        it.appendChild(tx);
        items.appendChild(it);
      }
      scroll.appendChild(items);
      if (next) scroll.appendChild(el("div", "pl-dn-goal", `◆ ${next.n}種の節目に届く ― 褒賞「${game.milestoneLabel ? game.milestoneLabel(next) : ""}」`));
    },
    footer: [
      { label: "奉納する", kind: "primary", onTap: (h) => {
        h.close();
        const res = ops.donateAllNew();
        if (res && res.rewardReady && game.claimNextTreasury) game.claimNextTreasury();
      } },
      { label: "やめる", kind: "ghost", onTap: (h) => h.close() },
    ],
  });
}
function renderTreasury(body) {
  const ts = game.treasuryState();
  const total = game.totalDonatedKinds ? game.totalDonatedKinds() : 0;
  const list = ops.donatableList ? ops.donatableList() : [];
  const next = nextMilestone(ts);

  // 手持ちの収集品 (初めての種類に「新」) + まとめて奉納。札をタップ = 品の詳細 (持ち主の荷から)
  const kinds = list.filter((h) => !h.dup).length;
  body.appendChild(sectionHead("奉納できる収集品", { note: list.length ? (kinds ? `新たに ${kinds} 種` : `${list.length} 点・奉納済みの品は金貨に`) : "なし" }));
  const row = el("div", "pl-tr-new" + (list.length ? "" : " empty"));
  if (list.length) {
    const strip = el("div", "pl-tr-strip");
    for (const h of list) {
      const t = itemTile(h.item, { size: 44, isNew: !h.dup, onTap: () => openItem(h.item.id, { instance: h.item, owner: h.doll, context: "donate" }) });
      t.setAttribute("aria-label", `${h.item.name} (${h.doll.name})${h.dup ? " 奉納済み" : ""}`);
      strip.appendChild(t);
    }
    row.appendChild(strip);
    const all = button({ label: `奉納する ${list.length}`, kind: "primary", size: "sm", onTap: () => donateSheet() });
    all.classList.add("pl-tr-b");
    row.appendChild(all);
  } else row.appendChild(el("div", "pl-tr-none", "迷宮で収集品を集めよう"));
  body.appendChild(row);

  // 次の褒賞 (ひとつだけ)
  body.appendChild(sectionHead("次の褒賞", { note: "奉納した種類の節目" }));
  const lad = el("div", "pl-ladder");
  if (next) lad.appendChild(rung(next, total));
  else lad.appendChild(el("div", "pl-tr-none", "すべての褒賞を受け取った。"));
  body.appendChild(lad);

  // 奉納台帳: 図鑑と同じく、奉納した品の札だけ (売却額の安い順)。総数は伏せる
  const ids = Object.keys(ts.donated).filter((id) => ITEMS[id] && ITEMS[id].slot === "misc");
  ids.sort((a, b) => sellOf(ITEMS[a]) - sellOf(ITEMS[b]) || (ITEMS[a].lv || 0) - (ITEMS[b].lv || 0) || a.localeCompare(b));
  body.appendChild(sectionHead("奉納台帳", { note: `${ids.length} 種` }));
  const area = fillArea(body, "pl-ledger-area");
  const fresh = ts.fresh || {}; // 奉納したばかりで、まだ開いていない札に「新」 (開いたら消す)
  scrollGrid(area, ids, (id) => {
    const it = ITEMS[id];
    return codexCard(it, it.name, { color: (game.itemRankColor && game.itemRankColor(it)) || rarityColor(it), price: sellOf(it), fresh: !!fresh[id],
      onTap: (c) => {
        if (fresh[id]) {
          delete fresh[id];
          if (game.autosave) game.autosave();
          c.classList.remove("fresh");
          const m = c.querySelector(".pl-card-new"); if (m) m.remove();
        }
        codexItemSheet(id);
      } });
  }, { cols: 3, cellH: LEDGER_H, key: "ledger", empty: el("div", "wa-empty", "まだ何も奉納していない。") });
}

// ================= タブ =================
function renderPalace(root, api) {
  const g = G();
  if (!g) return;
  // 他のタブ・街から入ってきた: 区分の指定が無ければ勅命から
  if (api && api.entered && !pendingSeg) { remember("seg", "palace", "decree"); resetCodexView(); resetPages(); }
  pendingSeg = false;
  const wrap = el("div", "wa-page wa-fit pl");
  root.appendChild(wrap); // 先に繋ぐ (めくる格子が残りの高さを測るため)
  const kr = keeperRow("palace");
  if (kr) wrap.appendChild(kr);
  let counts = null;
  try { counts = ops.counts ? ops.counts() : null; } catch (e) { counts = null; }
  const call = !!(game.palaceCallReady && game.palaceCallReady());
  const seg = curSeg();
  const segs = [
    { key: "decree", label: "勅命", badge: call ? true : null },
    { key: "codex", label: "図鑑", badge: freshCounts().total || null },
    { key: "ach", label: "勲章", badge: counts && counts.ach ? counts.ach : null },
    { key: "treasury", label: "宝物庫", badge: counts && (counts.donatable || counts.treasuryReady) ? true : null },
  ];
  const body = el("div", "pl-body");
  refresh.top = refresh.sub = refresh.list = null;
  const draw = (k) => {
    body.textContent = "";
    if (k !== "codex") refresh.sub = refresh.list = null;
    body.scrollTop = 0;
    body.className = "pl-body ui-autopage s-" + k;
    if (k === "codex") renderCodex(body);
    else if (k === "ach") renderAch(body);
    else if (k === "treasury") renderTreasury(body);
    else renderDecree(body);
  };
  const segEl = segmented(segs, seg, (k) => {
    sfx("select");
    resetPages(); // 区分を替えたら、どの格子も1ページ目から
    if (k === "codex") resetCodexView(); // 図鑑を押したら 敵 / 最初の迷宮 から
    draw(k);
    softFade(body);
  }, { prefKey: "palace" });
  refresh.top = () => setBadge(segBtn(segEl, 1), freshCounts().total || null);
  segEl.classList.add("pl-seg");
  wrap.appendChild(segEl);
  wrap.appendChild(body);
  draw(seg);
  scrollBox(body); // 収まらなければ内側で縦にスクロール
}

// 王宮タブを開く (seg を指定すればその区分。"codex:item" のように図鑑の区分も指定できる)
export function openPalace(seg) {
  if (seg) {
    const [s, sub] = String(seg).split(":");
    if (SEGS.includes(s)) remember("seg", "palace", s);
    resetPages();
    if (s === "codex") resetCodexView(["mon", "item", "job", "ev"].includes(sub) ? sub : "mon");
  }
  const g = G();
  if (!g || g.state !== "town" || !UI.shell) return false;
  pendingSeg = !!seg;
  const t = g.town;
  if (t.tab === "palace" && !t.page && !t.facility) { game.renderTown(); pendingSeg = false; return true; }
  const ok = UI.shell.setTab("palace");
  pendingSeg = false;
  return ok;
}

export function install() {
  registerUI({ openPalace, openCodexSheet, dungeonMonSheet, codexMonSheet, codexItemSheet, codexJobSheet, codexEventSheet });
  // タブの印: 王の用 (報告・拝命・謁見) は「!」、無ければ拝受できる勲章の数、奉納・褒賞だけなら点
  const tabBadge = (c) => {
    if (game.palaceCallReady && game.palaceCallReady()) return "!";
    if (!c) return null;
    return c.ach || (c.donatable || c.treasuryReady ? true : null);
  };
  if (UI.shell) UI.shell.registerTab("palace", { title: "王宮", render: (root, api) => renderPalace(root, api), badge: tabBadge });
}
