// ===== 王宮 — 勅命 / 図鑑 / 勲章 / 宝物庫 (区分ごとに印) =====
// 担当: WP-A。王宮タブ (UI.shell.registerTab("palace", …))。宰相のささやき → 区分 (記憶する) → 中身。
// どの区分も1画面に収める (頁は縦にスクロールさせない)。長い一覧は収まる数ずつ「‹ 1/3 ›」でめくり、詳細はシート。
//   勅命   … 勅命の札 (報告/拝命/出撃/謁見 をその場で) + 王の言葉を聞き直す + 王の記録 (戦績) と「伝える」
//   図鑑   … 魔物 (迷宮の札) / 品 (分類の札) / 職業 → 3列の札をめくる → 詳細のシート。持っている品は UI.itemSheet (その場で装備)
//   勲章   … まとめて拝受。拝受できる札を先に、2列の札をめくる
//   宝物庫 … 新種をまとめて奉納・褒賞 (次の節目)・奉納台帳 (ランク帯の札 → 帯のシート)
// 提供: UI.openPalace(seg) (seg = "decree" | "codex" | "ach" | "treasury" | "codex:mon|item|job")
//       UI.codexMonSheet(key) / UI.codexItemSheet(id) / UI.codexJobSheet(key, rank, heading)
// game.js は import しない (ctx.js の UI / game / ops を通す)。

import { UI, game, ops, registerUI } from "./ctx.js";
import { el, setText, glyph, svgIcon, sheet, button, segmented, chips, itemTile, bar, autoPage } from "./kit.js";
import { remember, getPref, setPref } from "./prefs.js";
import { softFade } from "./motion.js";
import { statLines, itemCatText, showSkillPopup } from "./itemview.js";
import { MONSTERS, spriteCanvas } from "../sprites.js";
import { ITEMS, ITEM_CATS, WEAPON_CATS, WEAPON_CAT_LABEL } from "../items.js";
import { RANK_COLOR, RANK_NAME } from "../content.js";
import { DUNGEONS, ELEMENTS, RACE_LABEL, monsterTraits } from "../dungeons/index.js";
import { SPELLS } from "../combat.js";
import {
  SOUL_CLASSES, jobSprite, jobRankName, jobLoreFor, jobRankCondText, SOUL_STAT_UP, JOB_GEAR,
  jobPassiveTable, rankThresholds, soulLevelCap, jobSkillTable, passiveName, passiveDesc,
} from "../souls.js";
import { rarityColor } from "../rarity.js";
import { SFX } from "../audio.js";
import { keeperRow, sectionHead, pagedGrid, findOwned, openItem } from "./facilities.js";

const sfx = (k) => { try { if (SFX[k]) SFX[k](); } catch (e) { /* noop */ } };
const G = () => game.G;
const SEGS = ["decree", "codex", "ach", "treasury"];

function curSeg() { const s = remember("seg", "palace"); return SEGS.includes(s) ? s : "decree"; }
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

// ================= 図鑑 =================
function unknownCard() {
  const c = el("div", "pl-card unknown");
  const a = el("span", "pl-card-art");
  a.appendChild(el("span", "pl-card-q", "？"));
  c.appendChild(a);
  c.appendChild(el("span", "pl-card-n", "？？？"));
  return c;
}
function codexCard(sprite, name, { color = null, onTap = null, sub = null, owned = false } = {}) {
  const c = el("button", "pl-card" + (owned ? " owned" : ""));
  c.type = "button";
  if (color) c.style.setProperty("--edge", color);
  const a = el("span", "pl-card-art");
  try { a.appendChild(spriteCanvas(sprite, 4)); } catch (e) { /* 演出のみ */ }
  c.appendChild(a);
  const n = el("span", "pl-card-n", name);
  if (color) n.style.color = color;
  c.appendChild(n);
  if (sub) c.appendChild(el("span", "pl-card-s", sub));
  if (owned) c.appendChild(el("span", "pl-card-own", "所持"));
  c.setAttribute("aria-label", name + (owned ? " (所持)" : ""));
  if (onTap) c.addEventListener("click", () => { sfx("select"); onTap(); });
  return c;
}
const CARD_H = 104;

function renderCodexMon(box) {
  const g = G();
  const unlocked = Math.max(1, g.unlockedDungeons || 1);
  let idx = Number(remember("codex", "dungeon"));
  if (!Number.isFinite(idx) || idx >= unlocked || idx < -1) idx = 0;
  const items = [];
  for (let i = 0; i < unlocked && i < DUNGEONS.length; i++) items.push({ key: String(i), label: DUNGEONS[i].short || DUNGEONS[i].name });
  items.push({ key: "-1", label: "その他" });
  const cap = el("div", "pl-codex-cap");
  let area = null;
  const draw = () => {
    const isOther = idx === -1;
    const roster = isOther ? (game.CODEX_OTHER || []).filter((k) => MONSTERS[k]) : (game.dungeonRoster ? game.dungeonRoster(DUNGEONS[idx]) : []);
    const seen = roster.filter((k) => g.codex.mon[k]).length;
    cap.textContent = isOther ? `その他 — 宝箱に潜む魔物　記録 ${seen}/${roster.length}` : `${DUNGEONS[idx].name}　記録 ${seen}/${roster.length}`;
    pagedGrid(area, roster, (key) => {
      const m = MONSTERS[key];
      if (!g.codex.mon[key]) return unknownCard();
      return codexCard(m, m.name, { color: m.rank ? RANK_COLOR[m.rank] : null, sub: m.boss ? "主" : null, onTap: () => codexMonSheet(key) });
    }, { cols: 3, cellH: CARD_H, key: "mon:" + idx, empty: el("div", "wa-empty", "記録なし。") });
  };
  box.appendChild(chips(items, String(idx), (k) => { idx = Number(k); remember("codex", "dungeon", idx); draw(); }));
  box.appendChild(cap);
  area = fillArea(box);
  draw();
}

function renderCodexItem(box) {
  const g = G();
  const seenIds = Object.keys(g.codex.item).filter((id) => ITEMS[id]);
  let cat = remember("codex", "itemCat") || "weapon";
  if (!ITEM_CATS.some((c) => c.key === cat)) cat = "weapon";
  let wcat = remember("codex", "weaponCat") || "all";
  const sub = el("div", "pl-codex-sub");
  const cap = el("div", "pl-codex-cap");
  let area = null;
  const draw = () => {
    sub.textContent = "";
    const def = ITEM_CATS.find((c) => c.key === cat) || ITEM_CATS[0];
    const slots = new Set(def.slots || []);
    let ids = seenIds.filter((id) => slots.has(ITEMS[id].slot));
    if (def.key === "weapon") {
      sub.appendChild(chips([{ key: "all", label: "すべて" }, ...WEAPON_CATS.map((w) => ({ key: w.key, label: w.label }))], wcat, (k) => { wcat = k; remember("codex", "weaponCat", k); draw(); }));
      if (wcat !== "all") ids = ids.filter((id) => ITEMS[id].cat === wcat);
    }
    ids.sort((a, b) => (ITEMS[a].lv || 0) - (ITEMS[b].lv || 0) || a.localeCompare(b));
    cap.textContent = `${def.label}　発見 ${ids.length} 種　(所持している品はその場で装備できる)`;
    pagedGrid(area, ids, (id) => {
      const it = ITEMS[id];
      return codexCard(it, it.name, { color: (game.itemRankColor && game.itemRankColor(it)) || rarityColor(it), owned: !!findOwned(id), onTap: () => openItem(id) });
    }, { cols: 3, cellH: CARD_H, key: "item:" + cat + ":" + wcat, empty: el("div", "wa-empty", "この区分の品は、まだ手にしていない。") });
  };
  box.appendChild(chips(ITEM_CATS.map((c) => ({ key: c.key, label: c.label })), cat, (k) => { cat = k; remember("codex", "itemCat", k); draw(); }));
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
  pagedGrid(area, list, ({ k, r }) => codexCard(jobSprite(k, r), jobRankName(k, r), { color: SOUL_CLASSES[k].glow, sub: `R${r}`, onTap: () => codexJobSheet(k, r) }),
    { cols: 3, cellH: CARD_H, key: "job", empty: el("div", "wa-empty", "まだ職業を見つけていない。迷宮で魂を吸収すると職業が記される。") });
}

// 図鑑の記録の数 (魔物・品・職業)。区分の印 (前回見た時から増えた数) に使う。見た数は端末に覚える (dos-ui)
function codexTotals() {
  const g = G();
  return {
    mon: Object.keys(g.codex.mon).filter((k) => MONSTERS[k]).length,
    item: Object.keys(g.codex.item).filter((k) => ITEMS[k]).length,
    job: Object.keys(g.codex.job).filter((k) => SOUL_CLASSES[k]).length,
  };
}
function codexNewCount() {
  const t = codexTotals();
  const seen = getPref("codexSeen", null);
  if (!seen || typeof seen !== "object") { setPref("codexSeen", t); return 0; }
  return Math.max(0, t.mon - (seen.mon || 0)) + Math.max(0, t.item - (seen.item || 0)) + Math.max(0, t.job - (seen.job || 0));
}
function renderCodex(body) {
  const sub = ["mon", "item", "job"].includes(remember("seg", "codex")) ? remember("seg", "codex") : "mon";
  const { mon: mons, item: items, job: jobs } = codexTotals();
  setPref("codexSeen", { mon: mons, item: items, job: jobs });
  const box = el("div", "pl-codex");
  const draw = (k) => {
    box.textContent = "";
    if (k === "mon") renderCodexMon(box);
    else if (k === "item") renderCodexItem(box);
    else renderCodexJob(box);
  };
  body.appendChild(segmented([
    { key: "mon", label: `魔物 ${mons}` }, { key: "item", label: `品 ${items}` }, { key: "job", label: `職業 ${jobs}` },
  ], sub, (k) => { sfx("select"); draw(k); softFade(box); }, { prefKey: "codex" }));
  body.appendChild(box);
  draw(sub);
}

// ---- 図鑑の詳細 (シート) ----
function infoBlock(title, rows) {
  const b = el("div", "pl-info");
  if (title) b.appendChild(el("div", "pl-info-h", title));
  for (const r of rows) b.appendChild(r.nodeType ? r : setText(el("div", "pl-info-r"), r));
  return b;
}
function pairRow(name, desc, { dim = false, onTap = null } = {}) {
  const r = el(onTap ? "button" : "div", "pl-pair" + (dim ? " dim" : "") + (onTap ? " tap" : ""));
  if (onTap) { r.type = "button"; r.addEventListener("click", onTap); }
  r.appendChild(setText(el("span", "pl-pair-n"), name));
  if (desc) r.appendChild(setText(el("span", "pl-pair-d"), desc));
  return r;
}

export function codexMonSheet(key) {
  const m = MONSTERS[key];
  if (!m) return null;
  const e = game.codexMonEntry ? game.codexMonEntry(key) : { kills: 0, dungeons: {} };
  const rc = m.rank ? RANK_COLOR[m.rank] : null;
  const elm = ELEMENTS[m.element] || ELEMENTS.none;
  const isOther = (game.CODEX_OTHER || []).includes(key);
  const body = el("div", "pl-detail");
  const tag = el("div", "pl-detail-tags");
  const et = el("span", "pl-tag", `属性 ${elm.label}`);
  et.style.color = elm.color;
  tag.appendChild(et);
  tag.appendChild(el("span", "pl-tag", `討伐 ${e.kills || 0}`));
  if (m.boss) tag.appendChild(el("span", "pl-tag gold", "迷宮の主"));
  body.appendChild(tag);
  if (m.desc) body.appendChild(setText(el("div", "pl-detail-desc"), m.desc));
  body.appendChild(setText(el("div", "pl-detail-stats"), `HP ${m.maxhp}　ATK ${m.atk}　VIT ${m.def}　AGI ${m.spd}　✦${m.soul}　💰${m.gold}`));
  const traits = monsterTraits(m);
  body.appendChild(infoBlock("特徴・スキル", traits.length ? traits.map((t) => pairRow(t.label, t.desc)) : [pairRow("特筆すべき特徴はない", null, { dim: true })]));
  const idxs = Object.keys(e.dungeons || {}).map(Number).filter((i) => DUNGEONS[i]);
  body.appendChild(infoBlock("出現した迷宮", idxs.length ? idxs.map((i) => pairRow(DUNGEONS[i].name)) : [pairRow("記録なし", null, { dim: true })]));
  return sheet.open({
    kind: "info", banner: isOther ? "その他" : `${RACE_LABEL[m.race] || "魔物"}${m.rank ? "・" + RANK_NAME[m.rank] + "級" : ""}`,
    accent: rc, art: m, artScale: 8, title: m.name, body, className: "pl-detail-sheet",
    footer: [{ label: "閉じる", kind: "ghost", onTap: (h) => h.close() }],
  });
}

export function codexItemSheet(id) {
  const it = ITEMS[id];
  if (!it) return null;
  const rc = (game.itemRankColor && game.itemRankColor(it)) || rarityColor(it);
  const body = el("div", "pl-detail");
  body.appendChild(setText(el("div", "pl-detail-cat"), itemCatText(it)));
  const st = statLines(it);
  if (st) body.appendChild(setText(el("div", "pl-detail-stats"), st));
  if (it.desc) body.appendChild(setText(el("div", "pl-detail-desc"), it.desc));
  return sheet.open({
    kind: "info", banner: game.itemGradeText ? game.itemGradeText(it, "品") : "品", accent: rc, art: it, artScale: 9,
    title: it.name, titleColor: rc, body, className: "pl-detail-sheet",
    footer: [{ label: "閉じる", kind: "ghost", onTap: (h) => h.close() }],
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
  body.appendChild(setText(el("div", "pl-detail-cat"), `${SOUL_CLASSES[key].label}系 ・ ランク${rank}`));
  const lore = jobLoreFor(key, rank);
  if (lore.desc) body.appendChild(setText(el("div", "pl-detail-desc"), lore.desc));
  if (lore.tips) body.appendChild(setText(el("div", "pl-detail-desc tips"), "活用: " + lore.tips));
  // 発現の条件
  const upPct = Math.round((SOUL_STAT_UP[SOUL_CLASSES[key].rarity] || 0.01) * 100);
  body.appendChild(infoBlock("発現の条件", [pairRow(jobRankCondText(key, rank)), pairRow(`魂を1つ吸収するごと、全能力 基礎値×${upPct}% UP`, null, { dim: true })]));
  // 装備適性
  const gg = JOB_GEAR[key];
  if (gg) {
    const armor = gg.armor === "heavy" ? "重装可" : gg.armor === "light" ? "軽装まで" : "布装のみ";
    body.appendChild(infoBlock("装備適性", [
      pairRow("武器", gg.weapons ? gg.weapons.map((w) => WEAPON_CAT_LABEL[w] || w).join("・") : "—"),
      pairRow("防具", armor), pairRow("盾", gg.shield ? "装備できる" : "装備できない"),
    ]));
  }
  // パッシブ: 上位の位階に呑まれた同系統の下位Lvは省く
  const pTbl = jobPassiveTable(key);
  const claimed = {};
  const actives = [];
  for (let r = Math.min(rank, 5); r >= 2; r--) {
    const e = pTbl[r - 2];
    if (!e || !Object.entries(e.grants).some(([k, lv]) => lv > (claimed[k] || 0))) continue;
    for (const k in e.grants) claimed[k] = Math.max(claimed[k] || 0, e.grants[k]);
    actives.unshift(e);
  }
  body.appendChild(infoBlock("パッシブ", actives.length ? actives.map((e) => pairRow(e.name, e.desc)) : [pairRow("なし (ランク2以上で発現)", null, { dim: true })]));
  // スキル表: このランクのLv上限まで。到達したLvのものだけ開示
  const reached = (rec && typeof rec === "object" && rec.lv) || 0;
  const capCount = (rankThresholds(SOUL_CLASSES[key].rarity)[rank - 1]) || 1;
  const lvCap = Math.max(soulLevelCap(key, capCount), reached);
  const rows = [];
  for (const e of jobSkillTable(key)) {
    if (e.lvl > lvCap) continue;
    const lv = `Lv${e.lvl}`;
    if (e.passive) {
      rows.push(reached >= e.lvl ? pairRow(`${lv} ${passiveName(e.passive, e.plv || 1)}`, `[パッシブ] ${passiveDesc(e.passive, e.plv || 1)}`) : pairRow(`${lv} ？？？`, null, { dim: true }));
    } else {
      const sp = SPELLS[e.skill];
      rows.push(reached >= e.lvl && sp ? pairRow(`${lv} ${sp.name}`, `${sp.desc} (MP${sp.mp})`, { onTap: () => showSkillPopup(e.skill) }) : pairRow(`${lv} ？？？`, null, { dim: true }));
    }
  }
  body.appendChild(infoBlock("技", rows.length ? rows : [pairRow("—", null, { dim: true })]));
  return sheet.open({
    kind: "info", banner: `ランク${rank}`, accent: color, art: jobSprite(key, rank), artScale: 12,
    title: jobRankName(key, rank), titleColor: color, body, className: "pl-detail-sheet",
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
  const total = (game.ACHIEVEMENTS || []).length;
  const got = Object.keys(g.ach || {}).length;
  // 進み具合とまとめて拝受を1段に
  const top = el("div", "pl-top");
  const prog = el("div", "pl-prog");
  prog.appendChild(el("div", "pl-prog-t", `受領 ${got} / ${total}`));
  prog.appendChild(bar(got, total, { tone: "gold" }));
  top.appendChild(prog);
  const all = button({ label: ready ? `まとめて拝受 ${ready}` : "拝受できる勲章なし", kind: ready ? "primary" : "ghost", size: "sm", disabled: !ready, onTap: () => ops.claimAllAchievements() });
  all.classList.add("pl-top-b");
  top.appendChild(all);
  body.appendChild(top);
  const area = fillArea(body);
  pagedGrid(area, cards, (c) => {
    const card = el("div", "pl-ach" + (c.ready ? " ready" : c.allDone ? " done" : ""));
    card.appendChild(el("span", "pl-medal" + (c.ready ? " ready" : c.allDone ? " done" : "")));
    const t = el("div", "pl-ach-t");
    t.appendChild(setText(el("div", "pl-ach-n"), c.a.name));
    t.appendChild(setText(el("div", "pl-ach-d"), c.a.desc));
    const meta = el("div", "pl-ach-m");
    if (c.total > 1) meta.appendChild(el("span", "pl-ach-tier", `段 ${c.tier}/${c.total}`));
    if (c.allDone) meta.appendChild(el("span", "pl-ach-got", "受領済"));
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
// 奉納台帳のランク帯ひとつをシートで (各10種。奉納済みは札、未奉納は ？)
function bandSheet(r, ids) {
  const ts = game.treasuryState();
  const body = el("div", "pl-band-sheet");
  const slots = el("div", "pl-band-slots");
  for (const id of ids) {
    if (ts.donated[id]) {
      const t = itemTile(ITEMS[id], { size: 56, onTap: () => openItem(id) });
      t.setAttribute("aria-label", ITEMS[id].name);
      slots.appendChild(t);
    } else { const s = el("span", "pl-band-q"); s.textContent = "？"; slots.appendChild(s); }
  }
  body.appendChild(slots);
  const cnt = ids.filter((id) => ts.donated[id]).length;
  return sheet.open({ kind: "info", banner: `奉納台帳 R${r}`, title: `${cnt} / ${ids.length} 種`, body, className: "pl-band-card",
    footer: [{ label: "閉じる", kind: "ghost", onTap: (h) => h.close() }] });
}
// 褒賞のはしご (すべて) をシートで
function ladderSheet() {
  const ts = game.treasuryState();
  const total = game.totalDonatedKinds ? game.totalDonatedKinds() : 0;
  const body = el("div", "pl-ladder");
  for (const m of game.TREASURY_MILESTONES || []) body.appendChild(rung(m, ts, total, true));
  return sheet.open({ kind: "info", banner: "宝物庫の褒賞", title: `奉納 ${total} / 100 種`, body, className: "pl-ladder-card",
    footer: [{ label: "閉じる", kind: "ghost", onTap: (h) => h.close() }] });
}
function rung(m, ts, total, inSheet = false) {
  const claimed = !!ts.claimed["m" + m.n];
  const reached = total >= m.n;
  const r = el("div", "pl-rung" + (claimed ? " done" : reached ? " ready" : ""));
  r.appendChild(el("span", "pl-rung-n", `${m.n}種`));
  r.appendChild(setText(el("span", "pl-rung-l"), game.milestoneLabel ? game.milestoneLabel(m) : ""));
  if (claimed) r.appendChild(el("span", "pl-rung-s", "受領済"));
  else if (reached) r.appendChild(button({ label: "受け取る", kind: "primary", size: "sm", onTap: () => { if (inSheet && UI.sheet) UI.sheet.closeAll(); game.claimTreasury(m.n); } }));
  else r.appendChild(el("span", "pl-rung-s", `あと ${m.n - total}`));
  return r;
}
function renderTreasury(body) {
  const ts = game.treasuryState();
  const total = game.totalDonatedKinds ? game.totalDonatedKinds() : 0;
  const news = ops.donatableList ? ops.donatableList() : [];
  // 進み具合とまとめて奉納を1段に
  const top = el("div", "pl-top");
  const prog = el("div", "pl-prog");
  prog.appendChild(el("div", "pl-prog-t", `奉納 ${total} / 100 種`));
  prog.appendChild(bar(total, 100, { tone: "gold" }));
  top.appendChild(prog);
  const all = button({ label: news.length ? `新種を奉納 ${news.length}` : "新種なし", kind: news.length ? "primary" : "ghost", size: "sm", disabled: !news.length,
    onTap: () => { const r = ops.donateAllNew(); if (r && r.rewardReady && game.claimNextTreasury) game.claimNextTreasury(); } });
  all.classList.add("pl-top-b");
  top.appendChild(all);
  body.appendChild(top);

  // 手持ちの新種 (同じ種類は1点だけ)。札をタップ = 品の詳細 (持ち主の荷から)
  body.appendChild(sectionHead("手持ちの新種", { note: news.length ? `${news.length}種` : "なし" }));
  const row = el("div", "pl-tr-new");
  if (news.length) {
    for (const h of news) {
      const t = itemTile(h.item, { size: 44, onTap: () => openItem(h.item.id, { instance: h.item, owner: h.doll }) });
      t.setAttribute("aria-label", `${h.item.name} (${h.doll.name})`);
      row.appendChild(t);
    }
  } else {
    const held = game.heldCollectibles ? game.heldCollectibles().length : 0;
    row.appendChild(el("div", "pl-tr-none", held ? "手持ちはすべて奉納済みの種類 (重なった品は商会で売れる)" : "迷宮で蒐集品を集めよう"));
  }
  body.appendChild(row);

  // 褒賞: 受け取れる段と次の節目 (すべては一覧のシート)
  const allBtn = el("button", "pl-link");
  allBtn.type = "button";
  allBtn.appendChild(document.createTextNode("すべて"));
  allBtn.appendChild(svgIcon("chevron", "pl-link-ic"));
  allBtn.addEventListener("click", () => { sfx("select"); ladderSheet(); });
  body.appendChild(sectionHead("褒賞", { note: "奉納した種類の節目", right: allBtn }));
  const lad = el("div", "pl-ladder");
  const ms = game.TREASURY_MILESTONES || [];
  const show = ms.filter((m) => !ts.claimed["m" + m.n]).slice(0, 2);
  for (const m of show) lad.appendChild(rung(m, ts, total));
  if (!show.length) lad.appendChild(el("div", "pl-tr-none", "すべての褒賞を受け取った。"));
  body.appendChild(lad);

  // 奉納台帳: ランク帯の札 (タップで帯のシート)
  body.appendChild(sectionHead("奉納台帳", { note: "ランク帯ごと・各10種" }));
  const byRank = game.collectiblesByRank ? game.collectiblesByRank() : {};
  const led = el("div", "pl-ledger");
  for (let r = 1; r <= 10; r++) {
    const ids = byRank[r] || [];
    const cnt = ids.filter((id) => ts.donated[id]).length;
    const b = el("button", "pl-band" + (ids.length && cnt >= ids.length ? " full" : cnt ? " some" : ""));
    b.type = "button";
    b.appendChild(el("span", "pl-band-r", `R${r}`));
    b.appendChild(el("span", "pl-band-c", `${cnt}/${ids.length}`));
    const fill = el("i", "pl-band-fill");
    fill.style.width = (ids.length ? (cnt / ids.length) * 100 : 0).toFixed(0) + "%";
    b.appendChild(fill);
    b.setAttribute("aria-label", `奉納台帳 R${r} ${cnt}/${ids.length}`);
    b.addEventListener("click", () => { sfx("select"); bandSheet(r, ids); });
    led.appendChild(b);
  }
  body.appendChild(led);
}

// ================= タブ =================
function renderPalace(root) {
  const g = G();
  if (!g) return;
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
    { key: "codex", label: "図鑑", badge: seg !== "codex" ? (codexNewCount() || null) : null },
    { key: "ach", label: "勲章", badge: counts && counts.ach ? counts.ach : null },
    { key: "treasury", label: "宝物庫", badge: counts && (counts.donatable || counts.treasuryReady) ? true : null },
  ];
  const body = el("div", "pl-body");
  const draw = (k) => {
    body.textContent = "";
    body.scrollTop = 0;
    body.className = "pl-body ui-autopage s-" + k;
    if (k === "codex") renderCodex(body);
    else if (k === "ach") renderAch(body);
    else if (k === "treasury") renderTreasury(body);
    else renderDecree(body);
  };
  const segEl = segmented(segs, seg, (k) => {
    sfx("select");
    draw(k);
    softFade(body);
    if (k === "codex") { const bd = segEl.children[1] && segEl.children[1].querySelector(".ui-badge"); if (bd) bd.remove(); } // 新しい記録は見た
  }, { prefKey: "palace" });
  segEl.classList.add("pl-seg");
  wrap.appendChild(segEl);
  wrap.appendChild(body);
  draw(seg);
  autoPage(body); // 縦スクロールの代わりに頁送り (収まれば出ない)
}

// 王宮タブを開く (seg を指定すればその区分。"codex:item" のように図鑑の区分も指定できる)
export function openPalace(seg) {
  if (seg) {
    const [s, sub] = String(seg).split(":");
    if (SEGS.includes(s)) remember("seg", "palace", s);
    if (sub) remember("seg", "codex", sub);
  }
  const g = G();
  if (!g || g.state !== "town" || !UI.shell) return false;
  const t = g.town;
  if (t.tab === "palace" && !t.page && !t.facility) { game.renderTown(); return true; }
  return UI.shell.setTab("palace");
}

export function install() {
  registerUI({ openPalace, codexMonSheet, codexItemSheet, codexJobSheet });
  // タブの印: 王の用 (報告・拝命・謁見) は「!」、無ければ拝受できる勲章の数、奉納・褒賞だけなら点
  const tabBadge = (c) => {
    if (game.palaceCallReady && game.palaceCallReady()) return "!";
    if (!c) return null;
    return c.ach || (c.donatable || c.treasuryReady ? true : null);
  };
  if (UI.shell) UI.shell.registerTab("palace", { title: "王宮", render: (root) => renderPalace(root), badge: tabBadge });
}
