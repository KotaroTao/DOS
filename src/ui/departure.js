// ===== 出撃シート — 門の選択・隊の備え (その場で直す)・迷宮の異変・初回の注意・奈落の支度 =====
// 担当: WP-D。game.js は import しない (ctx.js の UI / game / ops を通す)。
// 提供する契約: UI.openDeparture({ page }) … 中央の門 (どのタブからでも)。page:"abyss" で奈落の支度を開く
//
//   ┌ ━━ 出 撃 ━━ ─────────────────────────┐
//   │ 迷宮の地図 第1章「師の灯」     踏破 0/5  │ 門は 56px の行。物語の目標の迷宮を最初から選ぶ
//   │ (●) 忘れられた地下墓地 推奨Lv1〜2・全5階 目標 │ 推奨Lvより遥かに格上なら「危険」「無謀」の札
//   │ ▒▒ まだ地図にない迷宮 ― 解放の手がかり  │ 台帳 (world.js) の unlock を満たすと現れる
//   │ 潜り始める階 [B1F|B5F 陣]               │ 到達した帰還魔法陣の階から潜れる
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

let cur = null; // 開いているシート { h, page, accept }

function openCount() {
  const D = game.DUNGEONS || [];
  return D.filter((d, i) => isOpen(i)).length;
}
function isOpen(i) { try { return game.worldOpenIdx ? game.worldOpenIdx(i) : i < (G().unlockedDungeons || 0); } catch (e) { return false; } }
function wst() { try { return game.worldState ? game.worldState() : {}; } catch (e) { return {}; } }
function cleared() { try { return game.clearedDungeonCount ? game.clearedDungeonCount() : 0; } catch (e) { return 0; } }
// 物語の目標の迷宮 (目標の札が指す迷宮。出撃シートで「目標」と印を付ける)
function questIdx() {
  try { const g = game.storyGoal ? game.storyGoal() : null; return g && g.kind === "dive" ? (game.DUNGEONS || []).indexOf(g.d) : -1; } catch (e) { return -1; }
}
// 推奨Lvと隊のLvの差 → 危うさの札 { cls, text, note }
function dangerOf(dn) {
  const band = game.levelBand ? game.levelBand(dn) : [1, 1];
  const pl = game.partyLevel ? game.partyLevel() : 1;
  const gap = band[0] - pl;
  if (gap >= 8) return { cls: "reckless", text: "無謀", note: `推奨Lv${band[0]}〜 ・ パーティLv${pl}。格上の敵には状態異常も即死も、ほとんど効かない。` };
  if (gap >= 4) return { cls: "danger", text: "危険", note: `推奨Lv${band[0]}〜 ・ パーティLv${pl}。敵の状態異常が効きやすく、こちらの術は効きにくい。` };
  if (pl - band[1] >= 8) return { cls: "easy", text: "易しい", note: null };
  return null;
}

// ---- 門の一覧 (迷宮の地図: 台帳の並び。地図にない迷宮は、解放の手がかりだけを見せる) ----
function gateIcon(kind) {
  const w = el("span", "dp-gate-ic");
  try { const c = iconCanvas(kind); if (c) w.appendChild(c); } catch (e) { /* 演出のみ */ }
  return w;
}
function renderGates(b) {
  const g = G();
  const D = game.DUNGEONS || [];
  const w = wst();
  const qi = questIdx();
  if (!isOpen(g.dungeonIdx)) g.dungeonIdx = Math.max(0, D.findIndex((d, i) => isOpen(i)));
  const opened = D.map((d, i) => i).filter(isOpen);
  const det = el("div", "dp-layer dp-map");
  const sum = el("div", "dp-layer-h");
  sum.appendChild(el("span", "dp-layer-n", "迷宮の地図"));
  const ch = game.currentChapter ? game.currentChapter() : null;
  sum.appendChild(el("span", "dp-layer-name", ch ? `第${["", "一", "二", "三", "四", "五"][ch.no] || ch.no}章「${ch.title}」` : ""));
  sum.appendChild(el("span", "dp-layer-p" + (cleared() >= D.length ? " done" : ""), `踏破 ${cleared()}/${D.length}`));
  det.appendChild(sum);
  const list = el("div", "dp-gates");
  list.setAttribute("role", "radiogroup");
  // 背の低い画面 (高さ 760px 未満) では選んでいる門だけを見せ、ほかは「ほかの門」で開く (巻かずに収めるため)
  const fold = !cur.showAll && typeof innerHeight === "number" && innerHeight < 760 && opened.length > 1;
  for (const i of opened) {
    if (fold && i !== g.dungeonIdx) continue;
    const dn = D[i];
    const isDone = !!(w.cleared && w.cleared[dn.id]);
    const sel = i === g.dungeonIdx;
    const dg = dangerOf(dn);
    const r = el("button", "dp-gate" + (sel ? " sel" : "") + (isDone ? " done" : "") + (i === qi ? " quest" : ""));
    r.type = "button";
    r.setAttribute("role", "radio");
    r.setAttribute("aria-checked", sel ? "true" : "false");
    r.appendChild(el("span", "dp-radio"));
    const ic = gateIcon(sel ? "gateOpen" : isDone ? "gateDone" : "gate");
    r.appendChild(ic);
    const info = el("span", "dp-gate-i");
    const nm = el("span", "dp-gate-n", dn.name);
    if (w.fresh && w.fresh[dn.id] && !isDone) nm.appendChild(el("span", "dp-new", "新"));
    // 受けている依頼の対象の迷宮: 依頼の印 (2件以上なら件数も)
    { const qc = game.questHereCount ? game.questHereCount(dn) : 0; if (qc) nm.appendChild(el("span", "dp-qmark", qc > 1 ? `依頼×${qc}` : "依頼")); }
    info.appendChild(nm);
    const band = game.levelBand ? game.levelBand(dn) : [1, 1];
    const meta = [`推奨Lv${band[0]}${band[1] > band[0] ? `〜${band[1]}` : ""}`, `全${dn.floors}階`];
    if (dn.boss) meta.push("主が待つ");
    else if (dn.element && ELEMENTS[dn.element] && dn.element !== "none") meta.push(`${ELEMENTS[dn.element].label}の気配`);
    if (game.storyCellPending && game.storyCellPending(dn)) meta.push("師の手がかり");
    { const qn = game.questHereNote ? game.questHereNote(dn) : null; if (qn) meta.push(qn); }
    info.appendChild(el("span", "dp-gate-c", meta.join(" ・ ")));
    r.appendChild(info);
    const st = dg && dg.cls !== "easy" ? dg.text : isDone ? "★ 踏破" : i === qi ? "目標" : "未踏破";
    r.appendChild(el("span", "dp-gate-st" + (dg && dg.cls !== "easy" ? " " + dg.cls : isDone ? " done" : i === qi ? " quest" : ""), st));
    r.addEventListener("click", () => {
      if (g.dungeonIdx === i) return;
      g.dungeonIdx = i;
      cur.from = 1;
      sfx("select");
      if (game.autosave) game.autosave();
      refresh();
    });
    list.appendChild(r);
  }
  if (fold) {
    const more = el("button", "dp-gate dp-more");
    more.type = "button";
    more.appendChild(el("span", "dp-more-t", `ほかの門を選ぶ (${opened.length - 1})`));
    more.appendChild(el("span", "dp-more-c", "▾"));
    more.addEventListener("click", () => { sfx("select"); cur.showAll = true; refresh(); });
    list.appendChild(more);
  }
  det.appendChild(list);
  b.appendChild(det);
  // 選んだ迷宮を見たら「新」の印を消す
  if (w.fresh && D[g.dungeonIdx]) delete w.fresh[D[g.dungeonIdx].id];
  // まだ地図にない迷宮: 解放の手がかり (章の迷宮のみ。開いている章の分だけ)
  if (!fold || cur.showAll) {
    // 手の届く手がかりだけ (条件の迷宮が地図にある / 宝物庫)。多くても3つ
    const near = (d) => {
      const u = d.unlock || {};
      if (u.reported) return isOpen(D.findIndex((x) => x.id === u.reported));
      if (u.all) return u.all.some((id) => isOpen(D.findIndex((x) => x.id === id)));
      if (u.story) return (game.STORY_CELLS && game.STORY_CELLS[u.story]) ? isOpen(D.findIndex((x) => x.id === game.STORY_CELLS[u.story].dungeon)) : true;
      return true;
    };
    const locked = D.filter((d, i) => !isOpen(i) && (!ch || ch.dungeons.includes(d.id)) && near(d)).slice(0, 3);
    for (const dn of locked) {
      const sealed = el("div", "dp-gate dp-sealed");
      sealed.appendChild(gateIcon("gateSealed"));
      const info = el("span", "dp-gate-i");
      info.appendChild(el("span", "dp-gate-n", "まだ地図にない迷宮"));
      info.appendChild(el("span", "dp-gate-c dp-hint", dn.hint || "手がかりを探せ"));
      sealed.appendChild(info);
      sealed.appendChild(el("span", "dp-gate-st sealed", "未発見"));
      b.appendChild(sealed);
    }
  }
  // 章の結びまで語り終えた: 次章を「準備中」として見せる (鎖で封じられた大門)
  if (game.contentSealed && game.contentSealed() && ch) {
    const sealed = el("div", "dp-gate dp-sealed");
    sealed.appendChild(gateIcon("gateSealed"));
    const info = el("span", "dp-gate-i");
    info.appendChild(el("span", "dp-gate-n", ch.next || "次の章"));
    info.appendChild(el("span", "dp-gate-c", ch.nextNote || "その先へ続く道は、まだ封じられている"));
    sealed.appendChild(info);
    sealed.appendChild(el("span", "dp-gate-st sealed", "準備中"));
    b.appendChild(sealed);
  }
  renderStartFloor(b);
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

// ---- 潜り始める階 (到達した帰還魔法陣の階から) と、格上の迷宮の注意 ----
function renderStartFloor(b) {
  const g = G();
  const dn = (game.DUNGEONS || [])[g.dungeonIdx];
  if (!dn) return;
  const floors = game.startFloorsOf ? game.startFloorsOf(dn) : [1];
  if (!floors.includes(cur.from)) cur.from = 1;
  if (floors.length > 1) {
    const row = el("div", "dp-from");
    row.appendChild(el("span", "dp-from-l", "潜り始める階"));
    row.appendChild(segmented(floors.map((f) => ({ key: String(f), label: f === 1 ? "B1F" : `B${f}F 陣` })), String(cur.from), (k) => { cur.from = Number(k) || 1; sfx("select"); refresh(); }));
    b.appendChild(row);
  }
  // 迷宮の掟 (その迷宮だけの決まりごと。world.js の trait)
  const tr = game.dungeonTrait ? game.dungeonTrait(dn) : null;
  if (tr) {
    const box = el("div", "dp-mut dp-trait");
    if (tr.accent) box.style.setProperty("--mut", tr.accent);
    const h = el("div", "dp-mut-h");
    h.appendChild(el("span", "dp-mut-k", "迷宮の掟"));
    h.appendChild(el("span", "dp-mut-n", `${tr.sym ? tr.sym + " " : ""}「${tr.name}」`));
    box.appendChild(h);
    for (const ln of tr.lines || []) box.appendChild(setText(el("div", "dp-mut-l"), ln));
    b.appendChild(box);
  }
  const dg = dangerOf(dn);
  if (dg && dg.note) {
    const r = el("div", "dp-issue t-" + (dg.cls === "reckless" ? "bad" : "warn"));
    r.appendChild(el("i", "dp-issue-mark"));
    r.appendChild(setText(el("span", "dp-issue-t"), `${dg.text} ― ${dg.note}`));
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
    const ok = await kitConfirm({ banner: "今すぐ連れ帰る", danger: false, title: "迷宮に残された人業を今すぐ連れ帰る", lines: [`赤い魂 🔴${c ? c.hastenCost : "?"} (20分ごとに1つ)`, "届いた器は、館で金貨を払って修復する。"], okLabel: "連れ帰る" });
    if (ok) ops.hastenAll();
    return;
  }

  if (fix.act === "equip") { if (UI.autoEquip) UI.autoEquip("all"); return; } // 結果 (元に戻す付き) は隊の側が知らせる
  // 別の画面へ: シートを閉じてから
  close();
  if (fix.act === "shop") setTimeout(() => { if (UI.openShop) UI.openShop("buy"); }, 0);
  // 砕けた人業: 人業の館で、その人業を選んだ状態から修復する
  if (fix.act === "repair") setTimeout(() => { if (UI.openParty) UI.openParty((g.party || []).find((d) => d.uid === fix.uid) || null, { context: "town" }); }, 0);
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
    return [{ label: "奈落へ降りる", sub: `スコア ×${mul.toFixed(2)}`, kind: "primary", size: "lg", onTap: () => checkWoes(() => { close(); if (game.departAbyss) game.departAbyss(abyssMods, abyssWeekly); }) }];
  }
  const D = game.DUNGEONS || [];
  const dn = D[g.dungeonIdx];
  const alive = g.party.some((p) => p.alive);
  const w = wst();
  const again = !!(dn && w.cleared && w.cleared[dn.id]);
  const m = cur && cur.accept && cur.hasMut;
  const fl = `B${(cur && cur.from) || 1}F`;
  return [{
    label: alive ? (m ? `異変ごと門をくぐる ― ${fl}` : again ? `ふたたび門をくぐる ― ${fl}` : `門をくぐる ― ${fl}`) : "動ける人業がいない",
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
// 門をくぐる前の念押し: HP/MPが減っている・状態異常の者がいれば、ポップアップで知らせてから潜る。
// 宿が開いていれば「宿で休んでから潜る」(宿賃は宿屋と同じ) も選べる。go() = 実際に潜る
function checkWoes(go) {
  let w = null;
  try { w = game.departWoes ? game.departWoes() : null; } catch (e) { w = null; }
  if (!w || !w.list.length) { go(); return; }
  const lines = w.list.map((d) => {
    const p = [];
    if (d.ail) p.push(d.ail);
    if (d.hp < d.maxhp) p.push(`HP ${d.hp}/${d.maxhp}`);
    if (d.mp < d.maxmp) p.push(`MP ${d.mp}/${d.maxmp}`);
    return `${d.name} ― ${p.join(" ・ ")}`;
  });
  const ail = w.list.some((d) => d.ail);
  const hurt = w.list.some((d) => d.hp < d.maxhp || d.mp < d.maxmp);
  const what = ail && hurt ? "傷も異常も" : ail ? "状態異常が" : "HP・MPが";
  const footer = [];
  if (w.innOpen) {
    const ok = (G().gold || 0) >= w.cost;
    footer.push({ label: "宿で休んでから潜る", sub: ok ? `💰${w.cost} ・ 全快して門をくぐる` : `💰${w.cost} ・ お金が足りない`, kind: "primary", size: "lg", disabled: !ok,
      onTap: (h) => { h.close("ok", { silent: true }); const r = ops.restParty ? ops.restParty() : null; if (r && r.ok) go(); } });
  }
  footer.push({ label: "このまま潜る", kind: w.innOpen ? "danger" : "primary", size: w.innOpen ? undefined : "lg", onTap: (h) => { h.close("ok", { silent: true }); go(); } });
  footer.push({ label: "やめる", kind: "ghost", onTap: (h) => h.close("cancel") });
  sfx("select");
  sheet.open({
    kind: "choice", banner: "念押し", accent: "#c98a2a",
    title: `${what}癒えていない者がいる`,
    lines: [...lines, "迷宮の中では宿に泊まれない。このまま門をくぐるか？"],
    className: "ui-confirm dp-woes",
    footer,
  });
}
function depart() {
  if (!cur) return;
  checkWoes(departGo);
}
function departGo() {
  const g = G();
  if (!cur) return;
  const accept = !!(cur.accept && cur.hasMut);
  const idx = g.dungeonIdx;
  const from = cur.from || 1;
  sfx("select");
  close();
  if (game.departNow) game.departNow({ idx, accept, from });
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
  if (openCount() < 1) { toast("王の勅命を果たすまで、迷宮の在処は明かされない", { tone: "info" }); return null; }
  // 踏破の報告が済むまで門は開かない (王宮へ案内するシートを出す)
  if (game.blockForReport && game.blockForReport()) return null;
  if (game.blockForTutorial && game.blockForTutorial()) return null;
  if (cur && cur.h && !cur.h.closed) { if (opts.page) { cur.page = opts.page; refresh(); } return cur.h; }
  const page = opts.page === "abyss" && game.featureUnlocked && game.featureUnlocked("infinite") ? "abyss" : "gates";
  if (page === "abyss") { abyssMods = []; abyssWeekly = false; }
  // 勅命の迷宮を最初から選んでおく (攻略中の章のみ)
  // (街に戻って最初に開いた時だけ。広場などで選び直した迷宮はそのまま尊重する)
  const qi = questIdx();
  if (!g._departPre && qi >= 0 && isOpen(qi)) g.dungeonIdx = qi;
  g._departPre = true;
  // 潜り始める階: 既定は到達した最深の帰還魔法陣 (無ければ B1F)
  const dn0 = (game.DUNGEONS || [])[g.dungeonIdx];
  const fl0 = dn0 && game.startFloorsOf ? game.startFloorsOf(dn0) : [1];
  cur = { page, accept: true, hasMut: false, h: null, showAll: false, from: fl0[fl0.length - 1] || 1 };
  cur.h = sheet.open({
    kind: "info", banner: page === "abyss" ? "奈落の支度" : "出 撃", className: "dp-sheet",
    accent: "#8e6fd0",
    body,
    footer: [],
    onClose: () => { cur = null; },
    // 戻る: 奈落のページなら門の選択へ、門の選択なら閉じる
    onBack: (h) => { if (cur && cur.page === "abyss" && !opts.page) { cur.page = "gates"; refresh(); } else h.close("back"); },
  });
  refreshFooter();
  return cur.h;
}

export function install() {
  registerUI({ openDeparture });
}
