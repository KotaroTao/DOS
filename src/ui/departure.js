// ===== 出撃シート — 門の選択・隊の備え (その場で直す)・迷宮の異変・初回の注意・奈落の支度 =====
// 担当: WP-D。game.js は import しない (ctx.js の UI / game / ops を通す)。
// 提供する契約: UI.openDeparture({ page }) … 中央の門 (どのタブからでも)。page:"abyss" で奈落の支度を開く
//
//   ┌ ━━ 出 撃 ━━ ─────────────────────────┐
//   │ ┌ 迷宮の顔 (迷宮ごとの情景) ─────────┐ │ 上半分 = 選んでいる迷宮: 情景・名・説明
//   │ │ 朽ちた骸の修道院            目標  │ │ 推奨Lv・全階数・発見した魔物 n/m・受注中の依頼 n件・固有クエスト n/m (押すと詳細のポップアップ)
//   │ └───────────────────────┘ │ 迷宮の掟・格上の注意
//   │ (●) 忘れられた地下墓地 推奨Lv1・全5階 踏破 │ 門は 5 行ぶん見せ、6 つ目からは一覧を縦に巻く
//   │ ▒▒ まだ地図にない迷宮 ― 解放の手がかり  │ 台帳 (world.js) の unlock を満たすと現れる
//   │ 潜り始める階 [B1F|B5F]                  │ 到達した帰還魔法陣の階から潜れる
//   │ ◆ 隊の備え [肖像][肖像][肖像]   入替 ›  │
//   │ ⚠ フィモンが深手     [宿で休む ●48]      │ 直し方はその場に (別の札は出さない)
//   ├──────────────────────────────────────┤
//   │ [ ◆ 門をくぐる ― B1F ◆ ]                │ 階選択・隊の備えと共に下部へ固定
//   │ 迷宮の掟・異変・備えの注意は本文で巻く   │ 説明が増えても操作欄を隠さない
//   └──────────────────────────────────────┘

import { UI, game, ops, registerUI } from "./ctx.js";
import { el, sheet, button, setText, portrait, segmented, toast, confirm as kitConfirm } from "./kit.js";
import { ELEMENTS } from "../dungeons/index.js";
import { iconCanvas } from "../townart.js";
import { drawDungeonVista } from "../backdrops.js";
import { dungeonQuestSheet, dungeonActiveQuestSheet } from "./questboard.js";

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
// ---- 迷宮の顔 (上半分): 選んでいる迷宮の情景・説明・記録 ----
const VISTA_W = 480, VISTA_H = 320; // 戦闘背景と同じ 3:2 で描き、表示枠 (横長) で上下を切る
let vistaLoop = 0;
function vistaCanvas(dn) {
  const cv = document.createElement("canvas");
  cv.width = VISTA_W; cv.height = VISTA_H;
  cv.className = "dp-vista-cv";
  const ctx = cv.getContext("2d");
  const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
  const draw = () => { try { drawDungeonVista(ctx, VISTA_W, VISTA_H, dn, now()); } catch (e) { /* 演出のみ */ } };
  draw();
  // 霧・灯火・粒子のゆらぎ (約15fps)。シートを閉じる/迷宮を選び直すと止まる
  const id = ++vistaLoop;
  let last = 0;
  const tick = (t) => {
    if (id !== vistaLoop || !cv.isConnected && last) return;
    if (!(typeof document !== "undefined" && document.hidden) && t - last > 66) { last = t; if (cv.isConnected) draw(); }
    requestAnimationFrame(tick);
  };
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(tick);
  return cv;
}
function gateStatus(dn, i) {
  const w = wst();
  const isDone = !!(w.cleared && w.cleared[dn.id]);
  const dg = dangerOf(dn);
  if (dg && dg.cls !== "easy") return { text: dg.text, cls: dg.cls };
  if (isDone) return { text: "★ 踏破", cls: "done" };
  if (i === questIdx()) return { text: "目標", cls: "quest" };
  return { text: "未踏破", cls: "" };
}
// onTap を渡すと押せる札になる (詳細のポップアップを開く。右に › の印)
function fact(label, value, cls, onTap = null) {
  const f = el(onTap ? "button" : "span", "dp-fact" + (cls ? " " + cls : "") + (onTap ? " tap" : ""));
  f.appendChild(el("span", "dp-fact-l", label));
  f.appendChild(el("span", "dp-fact-v", value));
  if (onTap) {
    f.type = "button";
    f.setAttribute("aria-label", `${label} ${value} ― 詳しく見る`);
    f.appendChild(el("span", "dp-fact-c", "›"));
    f.addEventListener("click", onTap);
  }
  return f;
}
function renderHero(b) {
  const g = G();
  const dn = (game.DUNGEONS || [])[g.dungeonIdx];
  if (!dn) return;
  const hero = el("div", "dp-hero");
  const pic = el("div", "dp-vista");
  pic.appendChild(vistaCanvas(dn));
  const cap = el("div", "dp-vista-cap");
  const band = game.levelBand ? game.levelBand(dn) : [1, 1];
  const ttl = el("div", "dp-hero-t");
  ttl.appendChild(el("div", "dp-hero-n", dn.name));
  const sub = [`推奨Lv${band[0]}${band[1] > band[0] ? `〜${band[1]}` : ""}`, `全${dn.floors}階`];
  if (dn.boss) sub.push("主が待つ");
  else if (dn.element && ELEMENTS[dn.element] && dn.element !== "none") sub.push(`${ELEMENTS[dn.element].label}の気配`);
  ttl.appendChild(el("div", "dp-hero-s", sub.join(" ・ ")));
  cap.appendChild(ttl);
  const st = gateStatus(dn, g.dungeonIdx);
  cap.appendChild(el("span", "dp-gate-st" + (st.cls ? " " + st.cls : ""), st.text));
  pic.appendChild(cap);
  hero.appendChild(pic);
  if (dn.about) hero.appendChild(setText(el("div", "dp-hero-about"), dn.about));
  if (dn.id === "w04" && !game.worldState?.().reported.w03) {
    hero.appendChild(setText(el("div", "pt-note"), "取水口は推奨Lv18〜21。まずは回廊を抜け、修道院で師の足跡を追おう。支度が整えば、先に取水口へ向かうこともできる。"));
  }
  // 記録: 発見した魔物 / その迷宮の魔物 (雑魚・強敵・主)、固有クエストの報告済み / 総数
  const facts = el("div", "dp-facts");
  let f = null;
  try { f = game.dungeonFacts ? game.dungeonFacts(dn) : null; } catch (e) { f = null; }
  if (f) {
    // 押すと詳細: 発見した魔物 = その迷宮の魔物の札 (図鑑) / 固有クエスト = 依頼人の頼みの一覧 (状態・現れる条件)
    const di = g.dungeonIdx;
    facts.appendChild(fact("発見した魔物", `${f.monSeen}/${f.monTotal}`, f.monTotal && f.monSeen >= f.monTotal ? "full" : "",
      f.monTotal && UI.dungeonMonSheet ? () => UI.dungeonMonSheet(di) : null));
    // 受注中の依頼 = この迷宮を対象にしている依頼 (名の横の「依頼」の印と同じ数え方)。押すと札の一覧
    let qs = [];
    try { qs = game.questsTargeting ? game.questsTargeting(dn) : []; } catch (e) { qs = []; }
    facts.appendChild(fact("受注中の依頼", qs.length ? `${qs.length}件` : "なし", qs.length ? "" : "none",
      qs.length ? () => dungeonActiveQuestSheet(dn, { onChange: () => refresh() }) : null));
    facts.appendChild(fact("固有クエスト", f.fqTotal ? `${f.fqDone}/${f.fqTotal}` : "なし", f.fqTotal && f.fqDone >= f.fqTotal ? "full" : !f.fqTotal ? "none" : "",
      f.fqTotal ? () => dungeonQuestSheet(dn, { onChange: () => refresh() }) : null));
  }
  hero.appendChild(facts);
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
    hero.appendChild(box);
  }
  // 名のある強敵 (縄張り = この迷宮の強敵階に出る)。名・目撃・討伐・首級・懸賞
  const named = game.namedHere ? game.namedHere(dn) : [];
  if (named.length) {
    const box = el("div", "dp-mut dp-trait dp-named");
    box.style.setProperty("--mut", "#e0604a");
    const h = el("div", "dp-mut-h");
    h.appendChild(el("span", "dp-mut-k", "名のある強敵"));
    h.appendChild(el("span", "dp-mut-n", named.map((n) => `⚔ ${n.name}`).join("　")));
    box.appendChild(h);
    for (const n of named) {
      const st = [];
      st.push(n.kills ? `討伐 ${n.kills}` : n.seen ? `目撃 ${n.seenAt ? n.seenAt + " " : ""}B${n.seen.floor}F` : "まだ姿を見せていない (3F以降の強敵階に出る)");
      if (n.trophy) st.push("首級 ✓");
      else if (n.kills) st.push("首級を取り戻せる");
      if (n.bounty === "active") st.push("懸賞を受けている (強敵階が出やすい)");
      else if (n.bounty === "done") st.push("懸賞を果たした (酒場で報告)");
      else if (n.posted) st.push("酒場に懸賞あり");
      box.appendChild(setText(el("div", "dp-mut-l"), `${named.length > 1 ? n.name + ": " : ""}${st.join(" ・ ")}`));
    }
    hero.appendChild(box);
  }
  const dg = dangerOf(dn);
  if (dg && dg.note) {
    const r = el("div", "dp-issue t-" + (dg.cls === "reckless" ? "bad" : "warn"));
    r.appendChild(el("i", "dp-issue-mark"));
    r.appendChild(setText(el("span", "dp-issue-t"), `${dg.text} ― ${dg.note}`));
    hero.appendChild(r);
  }
  b.appendChild(hero);
}

// ---- 門の一覧 (迷宮の地図: 台帳の並び。5 行ぶん見せ、6 つ目からは縦に巻く) ----
function renderGates(b) {
  const g = G();
  const D = game.DUNGEONS || [];
  const w = wst();
  const qi = questIdx();
  if (!isOpen(g.dungeonIdx)) g.dungeonIdx = Math.max(0, D.findIndex((d, i) => isOpen(i)));
  renderHero(b);
  const opened = D.map((d, i) => i).filter(isOpen);
  const ch = game.currentChapter ? game.currentChapter() : null;
  const list = el("div", "dp-gates");
  list.setAttribute("role", "radiogroup");
  list.setAttribute("aria-label", "迷宮の地図");
  for (const i of opened) {
    const dn = D[i];
    const isDone = !!(w.cleared && w.cleared[dn.id]);
    const sel = i === g.dungeonIdx;
    const r = el("button", "dp-gate" + (sel ? " sel" : "") + (isDone ? " done" : "") + (i === qi ? " quest" : ""));
    r.type = "button";
    r.setAttribute("role", "radio");
    r.setAttribute("aria-checked", sel ? "true" : "false");
    r.appendChild(el("span", "dp-radio"));
    r.appendChild(gateIcon(sel ? "gateOpen" : isDone ? "gateDone" : "gate"));
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
    const st = gateStatus(dn, i);
    r.appendChild(el("span", "dp-gate-st" + (st.cls ? " " + st.cls : ""), st.text));
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
  // 選んだ迷宮を見たら「新」の印を消す
  if (w.fresh && D[g.dungeonIdx]) delete w.fresh[D[g.dungeonIdx].id];
  // まだ地図にない迷宮: 解放の手がかり (章の迷宮のみ。手の届く手がかりだけ — 条件の迷宮が地図にある / 宝物庫。多くても3つ)
  const near = (d) => {
    const u = d.unlock || {};
    if (u.reported) return isOpen(D.findIndex((x) => x.id === u.reported));
    if (u.all) return u.all.some((id) => isOpen(D.findIndex((x) => x.id === id)));
    if (u.story) return (game.STORY_CELLS && game.STORY_CELLS[u.story]) ? isOpen(D.findIndex((x) => x.id === game.STORY_CELLS[u.story].dungeon)) : true;
    return true;
  };
  const locked = D.filter((d, i) => !isOpen(i) && (!ch || ch.dungeons.includes(d.id)) && near(d)).slice(0, 3);
  const sealedRow = (title, note, tag) => {
    const sealed = el("div", "dp-gate dp-sealed");
    sealed.appendChild(gateIcon("gateSealed"));
    const info = el("span", "dp-gate-i");
    if (title) info.appendChild(el("span", "dp-gate-n", title));
    info.appendChild(el("span", "dp-gate-c dp-hint", note));
    sealed.appendChild(info);
    sealed.appendChild(el("span", "dp-gate-st sealed", tag));
    list.appendChild(sealed);
  };
  for (const dn of locked) sealedRow(null, dn.hint || "まだ地図にない迷宮。手がかりを探せ", "未発見");
  // 章の結びまで語り終えた: 次章を「準備中」として見せる (鎖で封じられた大門)
  if (game.contentSealed && game.contentSealed() && ch) sealedRow(ch.next || "次の章", ch.nextNote || "その先へ続く道は、まだ封じられている", "準備中");
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
    list.appendChild(r);
  }
  // 一覧の巻き位置は選び直しても保つ。初めて開いた時は選んでいる門が見える位置へ
  list.addEventListener("scroll", () => { if (cur) cur.listScroll = list.scrollTop; }, { passive: true });
  b.appendChild(list);
  const restore = () => {
    if (!cur || !list.isConnected) return;
    if (cur.listScroll != null) list.scrollTop = cur.listScroll;
    else {
      const selEl = list.querySelector(".dp-gate.sel");
      if (selEl && selEl.offsetTop + selEl.offsetHeight > list.clientHeight) list.scrollTop = selEl.offsetTop - list.clientHeight / 2 + selEl.offsetHeight / 2;
    }
  };
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(restore);
}

// ---- 潜り始める階 (到達した帰還魔法陣の階から) ----
function renderStartFloor(b) {
  const g = G();
  const dn = (game.DUNGEONS || [])[g.dungeonIdx];
  if (!dn) return;
  const floors = game.startFloorsOf ? game.startFloorsOf(dn) : [1];
  if (!floors.includes(cur.from)) cur.from = 1;
  if (floors.length > 1) {
    const row = el("div", "dp-from");
    row.appendChild(el("span", "dp-from-l", "潜り始める階"));
    row.appendChild(segmented(floors.map((f) => ({ key: String(f), label: `B${f}F` })), String(cur.from), (k) => { cur.from = Number(k) || 1; sfx("select"); refresh(); }));
    b.appendChild(row);
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
}
// 備えの注意は本文でスクロールさせ、階選択・パーティ欄の高さを保つ。
function renderReadyIssues(b) {
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

// 入場の消費予告。人業ごとの残量を表示し、不足分を街で補える。
function renderStability(b, explain = true) {
  const status = game.stabilityStatus();
  b.appendChild(sec("魂の安定度", "入場時 −10／人"));
  if (explain) b.appendChild(el("div","dp-brief-l","上限100。入場時に10消費し、3分ごとに1回復。控えやゲームを閉じている間も回復します。探索中の追加消費はありません。"));
  for (const d of status) {
    const line=el("div","dp-stability-row");
    const wait=d.value<10 ? ` ・ 入場まで約${Math.ceil(d.waitMs/60000)}分` : "";
    line.appendChild(el("span",d.value<10 ? "dp-stability-low" : "",`${d.name} ${d.value} → ${d.value<10 ? "不足" : d.after}${wait}`));
    if(d.value<100)line.appendChild(button({label:"回復",kind:"secondary",size:"sm",onTap:()=>UI.openStability?.(G().party.find(p=>p.uid===d.uid),()=>refresh())}));
    b.appendChild(line);
  }
}

// ---- 迷宮の異変 (§7 M1) — 本文で説明と切り替えを表示 ----
function mutatorStrip() {
  const g = G();
  const m = game.townMutatorFor ? game.townMutatorFor(g.dungeonIdx) : null;
  cur.hasMut = !!m;
  if (!m) return null;
  const box = el("div", "dp-mut dp-mut-foot" + (cur.accept ? " on" : ""));
  if (m.accent) box.style.setProperty("--mut", m.accent);
  const tx = el("div", "dp-mut-tx");
  const h = el("div", "dp-mut-h");
  h.appendChild(el("span", "dp-mut-k", "迷宮の異変"));
  h.appendChild(el("span", "dp-mut-n", `「${m.name}」`));
  tx.appendChild(h);
  tx.appendChild(setText(el("div", "dp-mut-l bad"), `危険 ― ${m.risk}`));
  tx.appendChild(setText(el("div", "dp-mut-l good"), `見返り ― ${m.gain}`));
  box.appendChild(tx);
  // 既定は「異変ごと潜る」。選んだ向きは迷宮を切り替えてもシートを閉じるまで保つ
  const sw = el("button", "dp-mut-sw");
  sw.type = "button";
  sw.setAttribute("role", "switch");
  sw.setAttribute("aria-checked", cur.accept ? "true" : "false");
  sw.appendChild(el("span", "dp-mut-sw-l", cur.accept ? "異変ごと潜る" : "鎮まるのを待つ"));
  const knob = el("span", "dg-switch"); knob.appendChild(el("i")); sw.appendChild(knob);
  sw.addEventListener("click", () => { cur.accept = !cur.accept; sfx("select"); refresh(); });
  box.appendChild(sw);
  return box;
}

// ---- 初めての注意 (出撃画面と分け、全文を読めるポップアップで表示) ----
function openBriefing(go) {
  sheet.open({
    kind:"info", banner:"門衛の忠告", title:"魂の安定度",
    className:"dp-brief-sheet", accent:"#78bdd1",
    body:(b)=>{
      const picture=el("div","dp-gatekeeper");
      const illustration=document.createElement("img");
      illustration.src=new URL("../../art/tutorial/gatekeeper.png",import.meta.url).href;
      illustration.alt="槍と灯りを持つ門衛が、石造りの迷宮の入口に立っている";
      illustration.width=1852;illustration.height=849;
      picture.appendChild(illustration);b.appendChild(picture);
      b.appendChild(el("div","dp-brief-h","門衛 ― 迷宮の入口を守る者"));
      for(const text of ["人業が迷宮に入ると、魂と器の結びつきが揺らぎます。その状態を示すのが『魂の安定度』です。",
        "安定度の上限は100です。入場時に人業ごとに10消費します。階を降りても、長く探索しても、追加では消費しません。",
        "安定度は3分ごとに1回復します。控えの人業も、ゲームを閉じている間も同じです。魂が不安定になった人業を休ませ、別の人業を出立させましょう。",
        "街では赤い魂1を捧げると、安定度が1回復します。安定度が10未満の人業がいる場合は、入場前に回復するか、人業を入れ替えてください。",
        ...(!G().dungeonBriefed ? game.DUNGEON_BRIEFING || [] : [])])b.appendChild(setText(el("div","dp-brief-l"),text));
      renderStability(b, false);
    },
    footer:[{label:"迷宮に入る",kind:"primary",onTap:h=>{h.close("ok");go();}},
      {label:"支度に戻る",kind:"ghost",onTap:h=>h.close("cancel")}],
  });
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
  // 潜れる深さ (主を倒した層の底まで。層ごとに10階、層の最後の階に主が門番として立つ)
  const cap = game.abyssMaxDepth ? game.abyssMaxDepth() : Infinity;
  b.appendChild(el("div", "dg-note", Number.isFinite(cap)
    ? `奈落は10階で一つの層。層の最後の階には、その層の主が門番として立つ。いま潜れるのは B${cap}F まで — 迷宮で次の層の主を討つと、その先が開く。`
    : "奈落は10階で一つの層。層の最後の階には、その層の主が門番として立つ。底は、もう無い。"));
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
    return [{ label: "奈落へ降りる", sub: `スコア ×${mul.toFixed(2)} ・ 安定度 −10／人`, disabled:!g.party.some(d=>d.alive)||game.stabilityStatus().some(d=>d.value<10), kind: "primary", size: "lg", onTap: () => checkWoes(() => { const go=()=>{close();game.departAbyss?.(abyssMods,abyssWeekly);};if(!G().stabilityBriefed)openBriefing(go);else go(); }) }];
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
    sub: dn ? `「${dn.name}」 ・ 安定度 −10／人` : "",
    kind: m ? "danger" : "primary", size: "lg", disabled: !alive || game.stabilityStatus().some(d=>d.value<10),
    onTap: () => depart(),
  }];
}
function refreshFooter() {
  if (!cur || !cur.h || cur.h.closed) return;
  const foot = cur.h.foot;
  foot.textContent = "";
  if (cur.page !== "abyss") {
    const ready = el("div", "dp-ready");
    renderStartFloor(ready);
    renderReady(ready);
    foot.appendChild(ready);
  }
  for (const it of footerSpec()) {
    const b = button(it);
    b.classList.add("dp-cta");
    foot.appendChild(b);
  }
  foot.classList.remove("hidden");
}
// 修復・宿泊の後も念押しを更新し、潜る操作は別に選んでもらう。
function checkWoes(go) {
  const read = () => game.departWoes ? game.departWoes() : null;
  const initial = read();
  if (!initial || (!initial.list.length && !(initial.broken || []).length)) { go(); return; }
  const spec = () => {
    const w = read();
    const broken = w.broken || [];
    const lines = broken.map((d) => `${d.name} ― ${d.rescuing ? "迷宮からの連れ帰りを待っている" : `魂が砕けている ・ 修復 💰${d.cost}`}`);
    if (w.list.length && broken.length) lines.push("傷や消耗が残っている人業");
    for (const d of w.list) {
      const p = [];
      if (d.ail) p.push(d.ail);
      if (d.hp < d.maxhp) p.push(`HP ${d.hp}/${d.maxhp}`);
      if (d.mp < d.maxmp) p.push(`MP ${d.mp}/${d.maxmp}`);
      lines.push(`${d.name} ― ${p.join(" ・ ")}`);
    }
    lines.push(`所持金貨 💰${G().gold || 0}`);
    lines.push(broken.length || w.list.length
      ? "修復や宿泊はこの場で行える。支度を整えてから、潜るかどうかを選べる。"
      : "支度が整った。門をくぐる準備はいいか？");
    const update = (h) => { refresh(); h.update(spec()); };
    const footer = [];
    if (broken.length) {
      const d = broken.find((d) => !d.rescuing);
      const ok = d && (G().gold || 0) >= d.cost;
      footer.push({ label: "人業の館で修復する", sub: d
        ? `${d.name} ・ 💰${d.cost}${ok ? " ・ 1人を修復" : " ・ 金貨が足りない"}`
        : "迷宮から連れ帰られると修復できる", kind: "primary", disabled: !ok,
        onTap: (h) => {
          const doll = G().party.find((p) => p.uid === d.uid);
          if (game.repairDoll) game.repairDoll(doll);
          update(h);
        } });
    }
    if (w.innOpen && w.list.length) {
      const ok = (G().gold || 0) >= w.cost;
      footer.push({ label: "宿屋で休む", sub: `💰${w.cost} ・ ${ok ? "生きている人業のHP・MPと状態異常を回復" : "金貨が足りない"}`, kind: "primary", disabled: !ok,
        onTap: (h) => { if (ops.restParty) ops.restParty(); update(h); } });
    }
    const woes = broken.length || w.list.length;
    const alive = G().party.some((d) => d.alive);
    footer.push({ label: alive ? (woes ? "このまま潜る" : "迷宮に潜る") : "動ける人業がいない", kind: woes ? "danger" : "primary", disabled: !alive,
      onTap: (h) => { h.close("ok", { silent: true }); go(); } });
    footer.push({ label: "出撃画面に戻る", kind: "ghost", onTap: (h) => h.close("cancel") });
    return {
      title: broken.length ? "魂が砕けた人業がいる" : w.list.length ? "傷や消耗が残っている人業がいる" : "支度が整った",
      lines, footer,
    };
  };
  sfx("select");
  sheet.open({ kind: "choice", banner: "出撃前の確認", accent: "#c98a2a", className: "ui-confirm dp-woes", ...spec() });
}

function depart() {
  if (!cur) return;
  checkWoes(()=>{if(!G().stabilityBriefed || !G().dungeonBriefed)openBriefing(departGo);else departGo();});
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
  if (cur.page === "abyss") { renderAbyssPage(b); renderStability(b); return; }
  renderGates(b);
  const m = mutatorStrip();
  if (m) b.appendChild(m);
  renderStability(b);
  renderReadyIssues(b);
}
function refresh() {
  if (!cur || !cur.h || cur.h.closed) return;
  const scroll = cur.h.body ? cur.h.body.scrollTop : 0;
  cur.h.update({ banner: cur.page === "abyss" ? "奈落の支度" : "出 撃", body });
  if (cur.h.el) cur.h.el.classList.toggle("dp-full", cur.page !== "abyss");
  refreshFooter();
  if (cur.h.body) cur.h.body.scrollTop = scroll;
}
function close() {
  vistaLoop++;
  if (cur && cur.h && !cur.h.closed) cur.h.close("close");
  cur = null;
}

export function openDeparture(opts = {}) {
  const g = G();
  if (!g || g.state !== "town") return null;
  if (openCount() < 1) { toast("王の勅命を果たすまで、迷宮のありかは明かされない", { tone: "info" }); return null; }
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
  cur = { page, accept: true, hasMut: false, h: null, listScroll: null, from: fl0[fl0.length - 1] || 1 };
  cur.h = sheet.open({
    kind: "info", banner: page === "abyss" ? "奈落の支度" : "出 撃", className: "dp-sheet",
    accent: "#8e6fd0",
    body,
    footer: [],
    onClose: () => { if(cur?.timer)clearInterval(cur.timer);cur = null; vistaLoop++; },
    // 戻る: 奈落のページなら門の選択へ、門の選択なら閉じる
    onBack: (h) => { if (cur && cur.page === "abyss" && !opts.page) { cur.page = "gates"; refresh(); } else h.close("back"); },
  });
  if (cur.h.el) cur.h.el.classList.toggle("dp-full", page !== "abyss");
  refreshFooter();
  const live=cur;
  live.timer=setInterval(()=>{if(cur!==live||live.h.closed){clearInterval(live.timer);return;}if(sheet.top()===live.h)refresh();},5000);
  return cur.h;
}

export function install() {
  registerUI({ openDeparture });
}
