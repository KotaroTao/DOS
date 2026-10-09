// ===== 遠征の画面 (第六章「氷結回廊」の結びで開く) =====
// 控えの一覧 (隊の「人業 n」) から: 「遠征に出す」→ 行き先と長さを選ぶシート / 遠征中の札 (残り・呼び戻す) /
// 帰ってきた遠征の報告「遠征から帰ってきた」(街で手の空いた時に1枚にまとめる — 物語の知らせ queueStoryNotice と同じ待ち方)。
// game.js は import しない (ctx.js の game / UI を通す)。数の決まりは src/expedition.js、状態と付与は game.js の「遠征」。

import { UI, game, registerUI } from "./ctx.js";
import { el, button, sheet, segmented, toast, confirm, glyph, uiBlocked } from "./kit.js";
import { sceneActive } from "./irene.js";
import { rarityKey, RARITIES } from "../rarity.js";
import { expDurLabel } from "../expedition.js";

const G_ = () => game.G;
const sfx = (k) => { try { const S = game.SFX; if (S && S[k]) S[k](); } catch (e) { /* 音は演出のみ */ } };
const fmt = (n) => Math.round(n || 0).toLocaleString("ja-JP");
const unlocked = () => !!(game.featureUnlocked && game.featureUnlocked("expedition"));

// 通貨の小さな札 (✦ / 金貨)
function gain(kind, n) {
  const s = el("span", "ex-gain ex-" + kind);
  s.appendChild(glyph(kind));
  s.appendChild(el("span", "ex-gain-v", fmt(n)));
  s.setAttribute("aria-label", `${kind === "soul" ? "✦Soul" : "金貨"} ${fmt(n)}`);
  return s;
}
function portrait(d, size) {
  const f = el("span", "ex-port");
  try { if (UI.partyPortraitCanvas) f.appendChild(UI.partyPortraitCanvas(d, size)); } catch (e) { /* 絵が無くても動く */ }
  return f;
}

// ================= 控えの札に添えるもの (party.js の reserveRow が使う) =================
// 遠征中なら { line, actions } (状態の行と、呼び戻す / 報告を聞く の札)。遠征に出ていなければ null
export function expeditionStatus(d, onChange) {
  if (!unlocked() || !game.expeditionOf) return null;
  const e = game.expeditionOf(d);
  if (!e) return null;
  const cfg = game.worldById ? game.worldById(e.dungeon) : null;
  const where = cfg ? cfg.name : e.dungeon;
  const line = el("div", "ex-stat");
  line.appendChild(el("span", "ex-stat-tag", "遠征中"));
  if (e.done) line.appendChild(el("span", "ex-stat-t", `「${where}」から帰ってきた`));
  else line.appendChild(el("span", "ex-stat-t", `「${where}」 ・ 残り${expDurLabel(game.expeditionLeftMin(e) * 60000)}${e.back ? " ・ 途中で引き返しそう" : ""}`));
  const act = e.done
    ? button({ label: "報告を聞く", kind: "primary", size: "sm", onTap: () => { if (onChange) onChange(); showReport(); } })
    : button({ label: "呼び戻す", kind: "secondary", size: "sm", onTap: () => recall(d, onChange) });
  return { line, actions: [act] };
}
// 控えの札の「遠征に出す」(送れない理由があれば暗く。押せば理由を知らせる)
export function expeditionButton(d, onOpen) {
  if (!unlocked() || !game.expeditionBlock || d.primary == null) return null;
  if (game.expeditionOf(d)) return null;
  const why = game.expeditionBlock(d);
  const b = button({ label: "遠征に出す", kind: "secondary", size: "sm", onTap: () => {
    if (why) { sfx("ng"); toast(why, { tone: "bad" }); return; }
    sfx("select"); if (onOpen) onOpen(); openSend(d);
  } });
  b.classList.add("ex-send-b");
  if (why) b.classList.add("ng");
  b.title = why || "踏破した迷宮へ、ひとりで送り出す";
  return b;
}
// 控えの一覧の見出しに添える「遠征 n/3」
export function expeditionCount() {
  if (!unlocked() || !game.expeditions) return null;
  const n = game.expeditions().length;
  return el("div", "ex-count", `遠征に出ている人業 ${n}/${game.EXP_MAX} ― 踏破した迷宮へ、控えの人業をひとりで送り出せる (実プレイ時間で進む)`);
}

function recall(d, onChange) {
  const e = game.expeditionOf(d);
  if (!e || e.done) return;
  const cfg = game.worldById ? game.worldById(e.dungeon) : null;
  confirm({
    banner: "呼び戻す", title: `${d.name}を呼び戻しますか？`,
    lines: [`「${cfg ? cfg.name : e.dungeon}」からすぐに戻ります。持ち帰るのは、経った時間の分の戦果だけです。`,
      `残り ${expDurLabel(game.expeditionLeftMin(e) * 60000)}`],
    okLabel: "呼び戻す", cancelLabel: "まだ待つ", danger: false,
  }).then((ok) => {
    if (!ok || !game.recallExpedition(d)) return;
    if (onChange) onChange();
    showReport();
  });
}

// ================= 遠征に出す: 行き先と長さを選ぶ =================
let pickHours = 2;
function openSend(d) {
  const G = G_();
  const targets = game.expeditionTargets(d);
  if (!targets.length) { sfx("ng"); toast("踏破した迷宮がまだ無い", { tone: "bad" }); return; }
  // 既定の行き先: 引き返さない中でいちばん深い迷宮
  let pick = (targets.find((t) => !t.back) || targets[targets.length - 1]).id;
  let h = null;
  const redraw = () => { const y = h.body.scrollTop; h.update({}); h.body.scrollTop = y; }; // 選び直しても、本文の位置はそのまま
  const body = (root) => {
    const lv = d.jobLv || 1;
    const top = el("div", "ex-who");
    top.appendChild(portrait(d, 44));
    const tx = el("div", "ex-who-tx");
    tx.appendChild(el("div", "ex-who-n", d.name));
    const stable = game.vesselStable && game.vesselStable(d);
    tx.appendChild(el("div", "ex-who-s", `${d.cls} Lv${lv} ・ ${stable ? "師の器 (安定度を消費しない)" : `魂の安定度 ${d.stability} → ${Math.max(0, d.stability - game.STABILITY_ENTRY_COST)}`}`));
    top.appendChild(tx);
    root.appendChild(top);

    root.appendChild(el("div", "ex-h", "長さ (実プレイ時間)"));
    root.appendChild(segmented(game.EXP_HOURS.map((x) => ({ key: String(x), label: `${x}時間` })), String(pickHours), (k) => { pickHours = +k; redraw(); }));

    const pv = game.expeditionPreview(d, pick, pickHours);
    if (pv) {
      const box = el("div", "ex-pv" + (pv.back ? " back" : ""));
      const dest = targets.find((t) => t.id === pick);
      box.appendChild(el("div", "ex-pv-h", `見込み ― 「${dest ? dest.name : pick}」へ`));
      box.appendChild(el("div", "ex-pv-l", pv.back
        ? `推奨Lv ${pv.rec} に Lv${lv} では届かない。${expDurLabel(pv.ms)}で引き返し、戦果は3割ほど。`
        : `${expDurLabel(pv.ms)}で戻る (推奨Lv ${pv.rec} ・ ${d.name} Lv${lv})`));
      const g = el("div", "ex-pv-g");
      g.appendChild(gain("soul", pv.soul));
      g.appendChild(gain("gold", pv.gold));
      box.appendChild(g);
      box.appendChild(el("div", "ex-pv-l dim", `メイン魂に経験値 ${fmt(pv.exp)}${pv.soulP ? " ・ まれに収集品や職業の魂" : " ・ まれに収集品"}`));
      if (pv.soulMul < 1) box.appendChild(el("div", "ex-pv-l dim", "推奨Lv を大きく超えているので、迷宮と同じく ✦ が減る。"));
      root.appendChild(box);
    }
    root.appendChild(el("div", "ex-h", "行き先 (踏破した迷宮)"));
    const list = el("div", "ex-list");
    for (const t of targets) {
      const r = el("button", "ex-dest" + (t.id === pick ? " on" : "") + (t.back ? " back" : ""));
      r.type = "button";
      r.setAttribute("aria-pressed", t.id === pick ? "true" : "false");
      const l1 = el("span", "ex-dest-l1");
      l1.appendChild(el("span", "ex-dest-n", t.name));
      if (t.side) l1.appendChild(el("span", "ex-dest-side", "寄り道"));
      r.appendChild(l1);
      const l2 = el("span", "ex-dest-l2");
      l2.appendChild(el("span", "ex-dest-lv", `推奨Lv ${t.lv === t.lvTo ? t.lv : `${t.lv}〜${t.lvTo}`}`));
      const note = t.back ? ["warn", "格上 ― 引き返すおそれ"]
        : t.gap > 0 ? ["mid", "やや格上 ― 戦果が少し減る"]
        : t.soulMul < 1 ? ["low", "格下 ― ✦ が減る"] : ["ok", "ちょうどよい"];
      l2.appendChild(el("span", "ex-dest-tag " + note[0], note[1]));
      r.appendChild(l2);
      r.addEventListener("click", () => { pick = t.id; sfx("select"); redraw(); });
      list.appendChild(r);
    }
    root.appendChild(list);

    root.appendChild(el("p", "ex-note", "遠征中の人業は、隊に入れることも、魂や装備を付け替えることもできません。いつでも呼び戻せます (経った時間の分だけの戦果)。"));
  };
  const go = () => {
    const pv = game.expeditionPreview(d, pick, pickHours);
    const send = () => { if (game.sendExpedition(d, pick, pickHours)) { if (h) h.close("sent"); toast(`${d.name}が遠征に出た`, { tone: "good" }); } };
    if (pv && pv.back) {
      confirm({ banner: "格上の迷宮", title: "途中で引き返しそうです", lines: [`推奨Lv ${pv.rec} の迷宮に Lv${d.jobLv || 1} では、半分の時間で引き返し、戦果は3割ほどです。それでも送り出しますか？`],
        okLabel: "送り出す", cancelLabel: "やめる", danger: false }).then((ok) => { if (ok) send(); });
    } else send();
  };
  h = sheet.open({
    kind: "info", banner: "遠征に出す", className: "ex-sheet",
    body, footer: [
      { label: "送り出す", kind: "primary", onTap: () => go() },
      { label: "やめる", kind: "ghost", onTap: (hh) => hh.close() },
    ],
  });
  return h;
}

// ================= 遠征から帰ってきた (報告) =================
let reportTimer = null, reportTries = 0, reportOpen = false;
function busy() {
  if (uiBlocked() || sceneActive() || UI.tutorialActive?.() || UI.tutorialPending?.()) return true;
  if (typeof document !== "undefined" && document.querySelector(".sc-scene")) return true;
  const G = G_();
  if (G && G.town?.tab === "party" && game.pendingIreneBeat?.()) return true;
  return false;
}
export function queueExpeditionReport() {
  if (reportTimer || reportOpen) return;
  reportTries = 0;
  const tick = () => {
    reportTimer = null;
    const G = G_();
    if (!G || G.state !== "town" || !unlocked() || !game.expeditionDone || !game.expeditionDone().length) return;
    if (busy()) { if (++reportTries < 40) reportTimer = setTimeout(tick, 1500); return; }
    showReport();
  };
  reportTimer = setTimeout(tick, 900);
}
function reportRow(r) {
  const row = el("div", "ex-rep" + (r.back ? " back" : ""));
  const top = el("div", "ex-rep-top");
  top.appendChild(portrait(r.doll, 44));
  const tx = el("div", "ex-rep-tx");
  tx.appendChild(el("div", "ex-rep-n", r.name));
  const how = r.back ? `途中で引き返した (${expDurLabel(r.actual)})` : r.recalled ? `呼び戻した (${expDurLabel(r.actual)})` : `${expDurLabel(r.dur)}の遠征`;
  tx.appendChild(el("div", "ex-rep-w", `「${r.dungeon}」 ・ ${how}`));
  top.appendChild(tx);
  row.appendChild(top);
  const g = el("div", "ex-pv-g");
  g.appendChild(gain("soul", r.soul));
  g.appendChild(gain("gold", r.gold + (r.sold || 0)));
  row.appendChild(g);
  if (r.lvTo > r.lvFrom) row.appendChild(el("div", "ex-rep-lv", `メイン魂 Lv${r.lvFrom} → Lv${r.lvTo}`));
  for (const x of r.items) {
    const li = el("div", "ex-rep-it");
    li.appendChild(el("span", "ex-rep-k", "収集品"));
    const nm = el("span", "ex-rep-item", x.item.name);
    const rk = RARITIES[rarityKey(x.item)];
    if (rk && rk.color) nm.style.color = rk.color;
    li.appendChild(nm);
    if (x.who !== r.doll) li.appendChild(el("span", "ex-rep-k", `(${x.who.name}の袋へ)`));
    row.appendChild(li);
  }
  if (r.sold) row.appendChild(el("div", "ex-rep-it dim", `袋がいっぱいで、収集品を金貨 ${fmt(r.sold)} に替えた`));
  for (const s of r.souls) {
    const li = el("div", "ex-rep-it soul");
    li.appendChild(el("span", "ex-rep-k", "職業の魂"));
    const n = el("span", "ex-rep-soul", `${s.label}の魂${s.echo ? " ×2" : ""}`);
    if (s.glow) n.style.color = s.glow;
    li.appendChild(n);
    row.appendChild(li);
  }
  if (r.back) row.appendChild(el("div", "ex-rep-it dim", "推奨Lv に届かず、引き返してきた。もう少し育ててから送り出そう。"));
  return row;
}
export function showReport() {
  if (reportOpen || !game.claimExpeditions) return;
  const rows = game.claimExpeditions();
  if (!rows.length) return;
  reportOpen = true;
  sfx("itemget");
  const soul = rows.reduce((a, r) => a + r.soul, 0), gold = rows.reduce((a, r) => a + r.gold + (r.sold || 0), 0);
  sheet.open({
    kind: "info", banner: "遠征から帰ってきた", className: "ex-sheet ex-report", accent: "#8fc4d8",
    title: rows.length > 1 ? `${rows.length}人が帰ってきた` : `${rows[0].name}が帰ってきた`,
    body: (b) => {
      for (const r of rows) b.appendChild(reportRow(r));
      if (rows.length > 1) {
        const tot = el("div", "ex-tot");
        tot.appendChild(el("span", "ex-tot-l", "合わせて"));
        tot.appendChild(gain("soul", soul));
        tot.appendChild(gain("gold", gold));
        b.appendChild(tot);
      }
      b.appendChild(el("p", "ex-note", "持ち帰った ✦Soul と金貨は、もう手元にある。控えの一覧から、また送り出せる。"));
    },
    footer: [{ label: "受け取った", kind: "primary", onTap: (h) => h.close() }],
    onClose: () => {
      reportOpen = false;
      const G = G_(); if (G && G.state === "town" && game.renderTown) game.renderTown();
      // 魂の Lv が上がった人業は、戦闘後・魂の強化と同じレベルアップの画面で見せる
      const ups = rows.map((r) => r.levelUp).filter(Boolean);
      if (ups.length && UI.celebrateLevelUp) UI.celebrateLevelUp(ups);
    },
  });
}

export function install() {
  registerUI({ queueExpeditionReport, showExpeditionReport: showReport, openExpeditionSend: openSend });
}
