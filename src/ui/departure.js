// ===== 出撃シート — 門の選択・隊の備え (その場で直す)・迷宮の異変・初回の注意・奈落の支度 =====
// 担当: WP-D。game.js は import しない (ctx.js の UI / game / ops を通す)。
// 提供する契約: UI.openDeparture({ page }) … 中央の門 (どのタブからでも)。page:"abyss" で奈落の支度を開く
//
//   ┌ ━━ 出 撃 ━━ ─────────────────────────┐
//   │ 第1層 墓地                     踏破 0/5  │ 門は 56px の行。勅命の迷宮を最初から選ぶ
//   │ (●) 忘れられた地下墓地  全3階 ・闇  勅命 │
//   │ ▒▒ 第2層 ― 大門は鎖で封じられている     │ 公開範囲 (CONTENT_LIMIT) の先は「準備中」
//   │ ◆ 隊の備え [肖像][肖像][肖像]   入替 ›  │
//   │ ⚠ フィモンが深手     [宿で休む ●48]      │ 直し方はその場に (別の札は出さない)
//   │ ◆ 迷宮の異変 [異変ごと|鎮まるのを待つ]  │ §7 M1 (抽選はこのシートで一度だけ)
//   │ [ ◆ 門をくぐる ― B1F ◆ ]                │ 56px の決め手
//   └──────────────────────────────────────┘

import { UI, game, ops, registerUI } from "./ctx.js";
import { el, sheet, button, setText, portrait, segmented, toast, confirm as kitConfirm } from "./kit.js";
import { ELEMENTS } from "../dungeons/index.js";
import { iconCanvas } from "../townart.js";

const G = () => game.G;
const sfx = (k) => { try { if (game.SFX && game.SFX[k]) game.SFX[k](); } catch (e) { /* 音が無くても動く */ } };
const PER_LAYER = 5;

let cur = null; // 開いているシート { h, page, accept }

function openCount() {
  const g = G();
  return Math.min(g.unlockedDungeons || 0, game.CONTENT_LIMIT || 5);
}
function cleared() { try { return game.clearedDungeonCount ? game.clearedDungeonCount() : 0; } catch (e) { return 0; } }
function questIdx() { const g = G(); return g.msq && g.msq.state === "active" && g.msq.n >= 1 ? g.msq.n - 1 : -1; }

// ---- 門の一覧 ----
function gateIcon(kind) {
  const w = el("span", "dp-gate-ic");
  try { const c = iconCanvas(kind); if (c) w.appendChild(c); } catch (e) { /* 演出のみ */ }
  return w;
}
function renderGates(b) {
  const g = G();
  const open = openCount();
  const D = game.DUNGEONS || [];
  const done = cleared();
  const qi = questIdx();
  if (g.dungeonIdx >= open) g.dungeonIdx = Math.max(0, open - 1);
  const maxBand = Math.floor((open - 1) / PER_LAYER);
  const selBand = Math.floor(g.dungeonIdx / PER_LAYER);
  for (let band = 0; band <= maxBand; band++) {
    const s = band * PER_LAYER, e = Math.min(D.length, s + PER_LAYER);
    const appeared = Math.max(0, Math.min(open - s, e - s));
    if (!appeared) continue;
    const lv = (game.LAYER_VISUALS || [])[band];
    const det = el("details", "dp-layer");
    if (band === selBand || maxBand === 0) det.open = true;
    const sum = el("summary", "dp-layer-h");
    sum.appendChild(el("span", "dp-layer-n", `第${band + 1}層`));
    sum.appendChild(el("span", "dp-layer-name", lv ? lv.name : ""));
    const clearedIn = Math.max(0, Math.min(done - s, appeared));
    sum.appendChild(el("span", "dp-layer-p" + (clearedIn >= e - s ? " done" : ""), `踏破 ${clearedIn}/${e - s}`));
    if (lv && lv.accent) det.style.setProperty("--layer", lv.accent);
    det.appendChild(sum);
    const list = el("div", "dp-gates");
    list.setAttribute("role", "radiogroup");
    // 背の低い画面 (高さ 760px 未満) では選んでいる門だけを見せ、ほかは「ほかの門」で開く (巻かずに収めるため)
    const fold = !cur.showAll && typeof innerHeight === "number" && innerHeight < 760 && appeared > 1;
    for (let i = s; i < s + appeared; i++) {
      if (fold && i !== g.dungeonIdx) continue;
      const dn = D[i];
      const isDone = i < done;
      const sel = i === g.dungeonIdx;
      const r = el("button", "dp-gate" + (sel ? " sel" : "") + (isDone ? " done" : "") + (i === qi ? " quest" : ""));
      r.type = "button";
      r.setAttribute("role", "radio");
      r.setAttribute("aria-checked", sel ? "true" : "false");
      r.appendChild(el("span", "dp-radio"));
      const ic = gateIcon(sel ? "gateOpen" : isDone ? "gateDone" : "gate");
      ic.appendChild(el("span", "dp-gate-no", String(i + 1)));
      r.appendChild(ic);
      const info = el("span", "dp-gate-i");
      info.appendChild(el("span", "dp-gate-n", dn.name));
      const meta = [`全${dn.floors}階`];
      if (dn.element && ELEMENTS[dn.element] && dn.element !== "none") meta.push(`${ELEMENTS[dn.element].label}の気配`);
      if (dn.boss) meta.push("層の主が待つ");
      info.appendChild(el("span", "dp-gate-c", meta.join(" ・ ")));
      r.appendChild(info);
      r.appendChild(el("span", "dp-gate-st" + (isDone ? " done" : i === qi ? " quest" : ""), isDone ? "★ 踏破" : i === qi ? "勅命" : "未踏破"));
      r.addEventListener("click", () => {
        if (g.dungeonIdx === i) return;
        g.dungeonIdx = i;
        sfx("select");
        if (game.autosave) game.autosave();
        refresh();
      });
      list.appendChild(r);
    }
    if (fold) {
      const more = el("button", "dp-gate dp-more");
      more.type = "button";
      more.appendChild(el("span", "dp-more-t", `ほかの門を選ぶ (${appeared - 1})`));
      more.appendChild(el("span", "dp-more-c", "▾"));
      more.addEventListener("click", () => { sfx("select"); cur.showAll = true; refresh(); });
      list.appendChild(more);
    }
    det.appendChild(list);
    b.appendChild(det);
  }
  // 公開範囲の最後まで来たら、次の層を「準備中」として見せる (鎖で封じられた大門)
  const limit = game.CONTENT_LIMIT || 5;
  if ((g.unlockedDungeons || 0) >= limit && limit < D.length) {
    const nl = (game.LAYER_VISUALS || [])[(game.CONTENT_NEXT_LAYER || 2) - 1];
    const sealed = el("div", "dp-gate dp-sealed");
    sealed.appendChild(gateIcon("gateSealed"));
    const info = el("span", "dp-gate-i");
    info.appendChild(el("span", "dp-gate-n", `第${game.CONTENT_NEXT_LAYER || 2}層 ― ${nl ? nl.name : ""}`));
    info.appendChild(el("span", "dp-gate-c", "大門は鎖で封じられている"));
    sealed.appendChild(info);
    sealed.appendChild(el("span", "dp-gate-st sealed", "準備中"));
    b.appendChild(sealed);
  }
  // 無限迷宮「奈落」(解放後のみ)
  if (game.featureUnlocked && game.featureUnlocked("infinite")) {
    const rec = game.abyssRecords ? game.abyssRecords() : { bestDepth: 0, bestScore: 0 };
    const r = el("button", "dp-gate dp-abyss");
    r.type = "button";
    r.appendChild(gateIcon("abyss"));
    const info = el("span", "dp-gate-i");
    info.appendChild(el("span", "dp-gate-n", "無限迷宮「奈落」"));
    info.appendChild(el("span", "dp-gate-c", rec.bestDepth ? `最深 B${rec.bestDepth}F ・ 最高 ${rec.bestScore.toLocaleString()}点` : "どこまでも潜れる。深さに果てはない。"));
    r.appendChild(info);
    r.appendChild(el("span", "dp-gate-st", "支度 ›"));
    r.addEventListener("click", () => { sfx("select"); cur.page = "abyss"; refresh(); });
    b.appendChild(r);
  }
}

// ---- 隊の備え ----
function sec(t, s) {
  const h = el("div", "dg-sec");
  h.appendChild(el("i", "dg-sec-mark"));
  h.appendChild(setText(el("span", "dg-sec-t"), t));
  if (s) h.appendChild(setText(el("span", "dg-sec-s"), s));
  return h;
}
async function runFix(fix) {
  const g = G();
  if (!fix) return;
  sfx("select");
  if (fix.act === "rest") { ops.restParty(); return; }
  if (fix.act === "hasten") {
    let c = null;
    try { c = ops.counts(); } catch (e) { c = null; }
    const ok = await kitConfirm({ banner: "今すぐ連れ帰る", danger: false, title: "砕けた人業を今すぐ連れ帰る", lines: [`赤い魂 🔴${c ? c.hastenCost : "?"} (20分ごとに1つ)`], okLabel: "連れ帰る" });
    if (ok) ops.hastenAll();
    return;
  }
  if (fix.act === "equip") { if (UI.autoEquip) UI.autoEquip("all"); return; } // 結果 (元に戻す付き) は隊の側が知らせる
  // 別の画面へ: シートを閉じてから
  close();
  if (fix.act === "shop") setTimeout(() => { if (UI.openShop) UI.openShop("buy"); }, 0);
  if (fix.act === "party") setTimeout(() => { if (UI.openParty) UI.openParty(0, { context: "town" }); }, 0);
  void g;
}
function renderReady(b) {
  const g = G();
  // 1行: 「隊の備え」+ 肖像 (HP の細線つき) + 入替 ›
  const strip = el("div", "dp-party");
  const lab = el("div", "dp-party-l");
  lab.appendChild(el("span", "dp-party-t", "パーティの備え"));
  lab.appendChild(el("span", "dp-party-n", `${g.party.length}/6`));
  strip.appendChild(lab);
  g.party.forEach((d, i) => {
    const p = portrait(d, { size: 48, hp: true, row: i < 3 ? "前" : "後", onTap: () => { close(); setTimeout(() => UI.openParty && UI.openParty(i), 0); } });
    strip.appendChild(p);
  });
  const swap = el("button", "dp-swap");
  swap.type = "button";
  swap.appendChild(el("span", null, "入替"));
  swap.appendChild(el("span", "dp-swap-c", "›"));
  swap.addEventListener("click", () => { sfx("select"); close(); setTimeout(() => UI.openParty && UI.openParty(0), 0); });
  strip.appendChild(swap);
  b.appendChild(strip);
  let res = null;
  try { res = game.preDiveIssues ? game.preDiveIssues() : null; } catch (e) { res = null; }
  const items = (res && res.items) || [];
  if (!items.length) return;
  for (const it of items) {
    const r = el("div", "dp-issue t-" + (it.tone || "warn"));
    r.appendChild(el("i", "dp-issue-mark"));
    r.appendChild(setText(el("span", "dp-issue-t"), it.text));
    if (it.fix) {
      const f = it.fix;
      r.appendChild(button({ label: f.label, cost: f.cost || null, kind: it.tone === "bad" ? "primary" : "secondary", size: "sm", disabled: f.ok === false, onTap: async () => { await runFix(f); if (cur && cur.h && !cur.h.closed) refresh(); } }));
    }
    b.appendChild(r);
  }
}

// ---- 迷宮の異変 (§7 M1) ----
function renderMutator(b) {
  const g = G();
  const m = game.townMutatorFor ? game.townMutatorFor(g.dungeonIdx) : null;
  cur.hasMut = !!m;
  if (!m) return;
  const box = el("div", "dp-mut");
  if (m.accent) box.style.setProperty("--mut", m.accent);
  const h = el("div", "dp-mut-h");
  h.appendChild(el("span", "dp-mut-k", "迷宮の異変"));
  h.appendChild(el("span", "dp-mut-n", `「${m.name}」`));
  box.appendChild(h);
  box.appendChild(setText(el("div", "dp-mut-l bad"), `危険 ― ${m.risk}`));
  box.appendChild(setText(el("div", "dp-mut-l good"), `見返り ― ${m.gain}`));
  // 既定は「異変ごと潜る」(左)。選んだ向きは迷宮を切り替えてもシートを閉じるまで保つ
  box.appendChild(segmented([
    { key: "accept", label: "異変ごと潜る" },
    { key: "wait", label: "鎮まるのを待つ" },
  ], cur.accept ? "accept" : "wait", (k) => { cur.accept = k === "accept"; sfx("select"); refreshFooter(); }));
  b.appendChild(box);
}

// ---- 初めての注意 (短い注記。初めて潜る前だけ) ----
function renderBriefing(b) {
  const g = G();
  if (g.dungeonBriefed) return;
  const box = el("div", "dp-brief");
  box.appendChild(el("div", "dp-brief-h", "警備兵の忠告 ― 初めて潜る前に"));
  for (const ln of (game.DUNGEON_BRIEFING || [])) box.appendChild(setText(el("div", "dp-brief-l"), ln));
  b.appendChild(box);
}

// ---- 奈落の支度 ----
let abyssMods = [], abyssWeekly = false;
function renderAbyssPage(b) {
  const rec = game.abyssRecords ? game.abyssRecords() : { bestDepth: 0, bestScore: 0, runs: 0, weekly: {}, recent: [] };
  const back = el("button", "dp-back");
  back.type = "button";
  back.appendChild(el("span", "dp-back-c", "‹"));
  back.appendChild(el("span", null, "門の選択へ"));
  back.addEventListener("click", () => { sfx("select"); cur.page = "gates"; refresh(); });
  b.appendChild(back);
  b.appendChild(sec("そなたの記録", "この端末に残る"));
  const t = el("div", "dg-tally");
  const cell = (v, l) => { const c = el("div", "dg-tally-c"); c.appendChild(el("div", "dg-tally-n", String(v))); c.appendChild(el("div", "dg-tally-l", l)); return c; };
  t.appendChild(cell(`B${rec.bestDepth || 0}F`, "最深"));
  t.appendChild(cell((rec.bestScore || 0).toLocaleString(), "最高スコア"));
  t.appendChild(cell(rec.runs || 0, "挑戦"));
  b.appendChild(t);
  b.appendChild(sec("挑戦の型"));
  b.appendChild(segmented([{ key: "normal", label: "通常 (毎回変わる)" }, { key: "weekly", label: "今週の挑戦" }], abyssWeekly ? "weekly" : "normal", (k) => { abyssWeekly = k === "weekly"; sfx("select"); refresh(); }));
  const wk = game.weekSeedId ? game.weekSeedId() : 0;
  b.appendChild(el("div", "dg-note", abyssWeekly ? `今週は全員が同じ変異列に挑む (シード #${wk} ・ 自己最深 ${rec.weekly && rec.weekly[wk] ? "B" + rec.weekly[wk] + "F" : "未挑戦"})。` : "潜るたびに変異が変わる。気軽に最深を更新しにいける。"));
  const mul = game.abyssScoreMul ? game.abyssScoreMul(abyssMods) : 1;
  b.appendChild(sec("誓約 (任意)", `スコア ×${mul.toFixed(2)}`));
  for (const m of (game.ABYSS_MODS || [])) {
    const on = abyssMods.includes(m.id);
    const r = el("button", "dg-toggle" + (on ? " on" : ""));
    r.type = "button";
    r.setAttribute("role", "switch");
    r.setAttribute("aria-checked", on ? "true" : "false");
    const tx = el("span", "dg-toggle-t");
    tx.appendChild(el("span", "dg-toggle-l", `${m.name} ×${m.scoreMul}`));
    tx.appendChild(el("span", "dg-toggle-s", m.desc));
    r.appendChild(tx);
    const sw = el("span", "dg-switch"); sw.appendChild(el("i")); r.appendChild(sw);
    r.addEventListener("click", () => { abyssMods = on ? abyssMods.filter((x) => x !== m.id) : [...abyssMods, m.id]; sfx("select"); refresh(); });
    b.appendChild(r);
  }
  if ((rec.recent || []).length) {
    b.appendChild(sec("直近の挑戦"));
    for (const r of rec.recent.slice(0, 5)) b.appendChild(el("div", "dg-line", `${r.weekly ? "今週" : "通常"} ・ B${r.depth}F ・ ${r.score.toLocaleString()}点${r.mods.length ? ` ・ 誓約${r.mods.length}` : ""} ・ ${r.reason === "wipe" ? "全滅" : "撤退"}`));
  }
}

// ---- 足元 (決め手) ----
function footerSpec() {
  const g = G();
  if (cur && cur.page === "abyss") {
    const mul = game.abyssScoreMul ? game.abyssScoreMul(abyssMods) : 1;
    return [{ label: "奈落へ降りる", sub: `スコア ×${mul.toFixed(2)}`, kind: "primary", size: "lg", onTap: () => { close(); if (game.departAbyss) game.departAbyss(abyssMods, abyssWeekly); } }];
  }
  const D = game.DUNGEONS || [];
  const dn = D[g.dungeonIdx];
  const alive = g.party.some((p) => p.alive);
  const again = g.dungeonIdx < cleared();
  const m = cur && cur.accept && cur.hasMut;
  return [{
    label: alive ? (m ? "異変ごと門をくぐる ― B1F" : again ? "ふたたび門をくぐる ― B1F" : "門をくぐる ― B1F") : "動ける人業がいない",
    sub: dn ? `「${dn.name}」` : "",
    kind: m ? "danger" : "primary", size: "lg", disabled: !alive,
    onTap: () => depart(),
  }];
}
function refreshFooter() {
  if (!cur || !cur.h || cur.h.closed) return;
  const foot = cur.h.foot;
  foot.textContent = "";
  for (const it of footerSpec()) {
    const b = button(it);
    b.classList.add("dp-cta");
    foot.appendChild(b);
  }
  foot.classList.remove("hidden");
}
function depart() {
  const g = G();
  if (!cur) return;
  const accept = !!(cur.accept && cur.hasMut);
  const idx = g.dungeonIdx;
  sfx("select");
  close();
  if (game.departNow) game.departNow({ idx, accept });
}

function body(b) {
  if (cur.page === "abyss") { renderAbyssPage(b); return; }
  renderGates(b);
  renderReady(b);
  renderMutator(b);
  renderBriefing(b);
}
function refresh() {
  if (!cur || !cur.h || cur.h.closed) return;
  const scroll = cur.h.body ? cur.h.body.scrollTop : 0;
  cur.h.update({ banner: cur.page === "abyss" ? "奈落の支度" : "出 撃", body });
  refreshFooter();
  if (cur.h.body) cur.h.body.scrollTop = scroll;
}
function close() {
  if (cur && cur.h && !cur.h.closed) cur.h.close("close");
  cur = null;
}

export function openDeparture(opts = {}) {
  const g = G();
  if (!g || g.state !== "town") return null;
  if ((g.unlockedDungeons || 0) < 1) { toast("王の勅命を受けるまで、迷宮の在処は明かされない", { tone: "info" }); return null; }
  // 踏破の報告が済むまで門は開かない (王宮へ案内するシートを出す)
  if (game.blockForReport && game.blockForReport()) return null;
  if (cur && cur.h && !cur.h.closed) { if (opts.page) { cur.page = opts.page; refresh(); } return cur.h; }
  const page = opts.page === "abyss" && game.featureUnlocked && game.featureUnlocked("infinite") ? "abyss" : "gates";
  if (page === "abyss") { abyssMods = []; abyssWeekly = false; }
  // 勅命の迷宮を最初から選んでおく (攻略中の章のみ)
  // (街に戻って最初に開いた時だけ。広場などで選び直した迷宮はそのまま尊重する)
  const qi = questIdx();
  if (!g._departPre && qi >= 0 && qi < openCount()) g.dungeonIdx = qi;
  g._departPre = true;
  cur = { page, accept: true, hasMut: false, h: null, showAll: false };
  cur.h = sheet.open({
    kind: "info", banner: page === "abyss" ? "奈落の支度" : "出 撃", className: "dp-sheet",
    accent: "#8e6fd0",
    body,
    footer: [],
    onClose: () => { cur = null; },
    // 戻る: 奈落の頁なら門の選択へ、門の選択なら閉じる
    onBack: (h) => { if (cur && cur.page === "abyss" && !opts.page) { cur.page = "gates"; refresh(); } else h.close("back"); },
  });
  refreshFooter();
  return cur.h;
}

export function install() {
  registerUI({ openDeparture });
}
