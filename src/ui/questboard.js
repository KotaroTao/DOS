// ===== 酒場の依頼 — 受注中 / 掲示板・依頼人 の札と、依頼の詳細シート =====
// 担当: WP-A (酒場のページ facilities.js と、街の広場 hub.js の「酒場の依頼」の段で共用)。
// 依頼の中身・状態は game.js (questLists / acceptQuest / abandonQuest / claimQuest / deliverQuest) と src/quests.js。
//   フリークエスト (掲示板) … 受けられるのは同時に game.FREE_CAP 件まで。達成して報告するか、放棄すると枠が空く
//   固定クエスト (依頼人)   … 一度きり。フリーと合わせて game.FREE_CAP 件の枠に数える。達成前なら放棄でき、酒場に戻る
// 札をタップ = 詳細シート (依頼人の口上・目的・報酬・操作)。札の右の釦で、報告する / 納品する は1タップで。
// 受注だけは札の「受ける」も詳細シートを開き、内容を確かめてから「依頼を受ける / 受けない」を選ぶ。
// game.js は import しない (ctx.js の UI / game を通す)。

import { UI, game } from "./ctx.js";
import { el, setText, glyphText, sheet, button, itemTile, toast, confirm } from "./kit.js";
import { ITEMS } from "../items.js";
import { MONSTERS, crispCanvas } from "../sprites.js";
import { npcOf, npcBondLabel } from "../quests.js";
import { SFX } from "../audio.js";
import { openItem } from "./facilities.js";

const sfx = (k) => { try { if (SFX[k]) SFX[k](); } catch (e) { /* noop */ } };
const G = () => game.G;
const RAR_LABEL = { common: "コモン", rare: "レア", epic: "エピック", legend: "レジェンド" };
const TYPE_MARK = { kill: "⚔", soul: "✦", chest: "◆", floor: "▼", clear: "★", deliver: "◇" };

export function lists() {
  try { return game.questLists ? game.questLists() : { active: [], offers: [], freeCount: 0, cap: 5 }; } catch (e) { setTimeout(() => { throw e; }); return { active: [], offers: [], freeCount: 0, cap: 5 }; }
}
const cap = () => (game.FREE_CAP || 5);
const full = () => lists().freeCount >= cap();
const deliverSt = (q) => (q.type === "deliver" && game.deliveryStatus ? game.deliveryStatus(q) : null);
// 納品の品の在りか: 手持ち / 商店の棚 / どちらにも無い (掲示板の依頼も受注中の依頼も同じ言い方)
const haveLabel = (st) => (st.holder ? "（持っている）" : st.inShop ? "（商店に売っている）" : "（持っていない）");
const buyLabel = (st) => `購入（金貨${st.price}）して納品`;
// 納品の依頼で、いま納められるか (手持ちがある / 商店で買える)
const canDeliver = (q) => { const st = deliverSt(q); return !!st && (!!st.holder || !!st.canBuy); };
const isOpenDeliver = (q) => q.type === "deliver" && (q.state === "active" || q.state === "offer");

// 報酬の一行 (💰 ✦ 🔴 🔥 は通貨の印になる)
export function rewardText(q) {
  const r = q.reward || {};
  if (r.deliver) return "職業の魂 (ランダム)";
  const p = [];
  if (r.gold) p.push(`💰${r.gold}`);
  if (r.soulPts) p.push(`✦${r.soulPts}`);
  if (r.red) p.push(`🔴${r.red}`);
  if (r.embers) p.push(`🔥${r.embers}`);
  for (const [rar, n] of (r.souls || [])) p.push(`職業の魂 (${RAR_LABEL[rar] || rar})×${n}`);
  for (const [id, n] of (r.items || [])) p.push(`${(ITEMS[id] || {}).name || id}×${n}`);
  return p.join("  ");
}
function progressText(q) {
  if (q.state === "done") return "達成 ― 報告できる";
  if (q.state !== "active") return null;
  if (q.type === "deliver") {
    const st = deliverSt(q) || {};
    return haveLabel(st) + (st.holder ? (st.holder.name ? ` ${st.holder.name}` : "") : st.inShop && !st.canBuy ? " 金貨が足りない" : "");
  }
  if (q.type === "clear") return "未踏破";
  if (q.type === "floor") return `地下${q.goal}階 ・ いま ${q.progress ? `地下${q.progress}階` : "未到達"}`;
  return `${q.progress || 0} / ${q.goal}`;
}
// 札の左の印: 納品 = 品の絵 / 討伐 = 魔物の絵 / ほか = 記号
export function markOf(q, size = 40) {
  const box = el("span", "qb-mark t-" + (q.type || "x"));
  try {
    if (q.type === "deliver" && ITEMS[q.itemId]) { box.appendChild(itemTile(ITEMS[q.itemId], { size })); return box; }
    const mk = q.type === "kill" && q.keys && MONSTERS[q.keys[0]];
    if (mk) { box.appendChild(crispCanvas(mk, size - 4)); return box; }
  } catch (e) { /* 絵が無くても札は出す */ }
  box.appendChild(el("span", "qb-mark-c", TYPE_MARK[q.type] || "◆"));
  return box;
}

// ---- 操作 ----
// 納品を1タップで進める: 手持ちがあれば納品 / 商会で買えるなら確認のシート1枚を経て買って納品 / どちらも無ければ品の詳細。
// 掲示板の依頼 (受ける前) もその場で納められる (受注の枠は使わない)
export async function runDelivery(q) {
  const it = q && ITEMS[q.itemId];
  if (!it) return;
  const st = deliverSt(q);
  sfx("select");
  if (st && st.holder) return game.deliverQuest(q);
  if (st && st.canBuy) {
    const gold = G().gold;
    const ok = await confirm({ banner: "購入して納品", title: `「${it.name}」を買って納める`, danger: false, okLabel: buyLabel(st),
      lines: [`商会の棚から 💰${st.price} で買い求め、そのまま納品します。`, `所持金 💰${gold} → 💰${gold - st.price}`] });
    if (ok) game.deliverQuest(q, { buy: true });
    return;
  }
  openItem(q.itemId);
}
function accept(q) {
  if (full()) {
    sfx("ng");
    toast(`受けられる依頼は ${cap()}件まで。達成して報告するか、放棄してから`, { tone: "bad" });
    return false;
  }
  return game.acceptQuest(q.uid);
}
async function abandon(q) {
  const ok = await confirm({ banner: "依頼の放棄", title: `「${q.name}」を放棄する`, okLabel: "放棄する",
    lines: ["受注の枠が1つ空く。", q.progress ? `進み (${q.progress}/${q.goal}) は失われる。` : q.fixed ? "依頼人の頼みは酒場に戻り、また受けられる。" : "この依頼は掲示板から消える。"] });
  if (ok) game.abandonQuest(q.uid);
  return ok;
}
// 札の右の釦 (無ければ null)
function actionBtn(q) {
  if (isOpenDeliver(q)) {
    const st = deliverSt(q) || {};
    if (st.holder) return button({ label: "納品する", kind: "primary", size: "sm", onTap: (e) => { if (e) e.stopPropagation(); runDelivery(q); } });
    if (st.inShop) {
      const b = button({ label: buyLabel(st), kind: "primary", size: "sm", disabled: !st.canBuy, title: st.canBuy ? null : "金貨が足りない",
        onTap: (e) => { if (e) e.stopPropagation(); runDelivery(q); } });
      b.classList.add("qb-buy");
      return b;
    }
  }
  if (q.state === "offer") {
    const off = full();
    return button({ label: "受ける", kind: off ? "secondary" : "primary", size: "sm", disabled: false,
      onTap: (e) => { if (e) e.stopPropagation(); sfx("select"); openQuestSheet(q.uid); } });
  }
  if (q.state === "done") return button({ label: "報告する", kind: "primary", size: "sm", onTap: (e) => { if (e) e.stopPropagation(); game.claimQuest(q.uid); } });
  return null;
}
const isReady = (q) => q.state === "done" || (isOpenDeliver(q) && !!(deliverSt(q) || {}).holder);

// ---- 札 (酒場の一覧) ----
export function questCard(q) {
  const card = el("div", "qb-card" + (q.fixed ? " fixed" : "") + (isReady(q) ? " ready" : "") + (q.state === "offer" ? " offer" : ""));
  card.setAttribute("role", "button");
  card.tabIndex = 0;
  card.appendChild(markOf(q));
  const info = el("div", "qb-i");
  const top = el("div", "qb-top");
  if (q.fixed) top.appendChild(el("span", "qb-tag", "依頼人"));
  if (q.fresh) top.appendChild(el("span", "qb-new", "新"));
  top.appendChild(setText(el("span", "qb-n"), q.name));
  info.appendChild(top);
  info.appendChild(setText(el("div", "qb-d"), q.desc || ""));
  const pt = progressText(q);
  const sub = el("div", "qb-s" + (isReady(q) ? " ok" : ""));
  if (pt) sub.appendChild(document.createTextNode(pt));
  else { const r = el("span", "qb-rw"); r.appendChild(glyphText(rewardText(q))); sub.appendChild(r); }
  info.appendChild(sub);
  // 掲示板の納品の依頼: 報酬の下に品の在りか
  if (!pt && q.type === "deliver") { const st = deliverSt(q); if (st) info.appendChild(el("div", "qb-have" + (st.holder ? " ok" : st.inShop ? " shop" : ""), haveLabel(st))); }
  card.appendChild(info);
  const b = actionBtn(q);
  if (b) card.appendChild(b);
  card.addEventListener("click", () => { sfx("select"); openQuestSheet(q.uid); });
  return card;
}

// ---- 詳細シート ----
export function openQuestSheet(uid) {
  const q0 = game.questByUid ? game.questByUid(uid) : null;
  if (!q0) return null;
  let h = null;
  const cur = () => (game.questByUid ? game.questByUid(uid) : null);
  const body = (root) => {
    const q = cur() || q0;
    const box = el("div", "qb-sheet");
    const who = q.fixed ? q.giver : npcOf(q.npc);
    const wh = el("div", "qb-who");
    wh.appendChild(markOf(q, 48));
    const wt = el("div", "qb-who-t");
    wt.appendChild(setText(el("div", "qb-who-n"), who ? who.name : "依頼人"));
    let bond = null;
    try { if (!q.fixed) bond = npcBondLabel((game.questState().npcs || {})[q.npc] || 0); } catch (e) { /* noop */ }
    if (who && who.title) wt.appendChild(setText(el("div", "qb-who-k"), who.title + (q.fixed ? " ・ 一度きりの依頼" : " ・ 掲示板の依頼") + (bond ? ` ・ ${bond}` : "")));
    wh.appendChild(wt);
    box.appendChild(wh);
    const tx = el("div", "qb-text");
    const lines = q.fixed ? (q.def.lines || []) : [!q.fixed && who ? who.line : null, q.text].filter(Boolean);
    for (const l of lines) tx.appendChild(setText(el("p"), l));
    box.appendChild(tx);
    const facts = el("div", "qb-facts");
    const fact = (k, v, cls = "") => { const r = el("div", "qb-f" + (cls ? " " + cls : "")); r.appendChild(el("span", "qb-f-k", k)); const vv = el("span", "qb-f-v"); vv.appendChild(glyphText(v)); r.appendChild(vv); facts.appendChild(r); };
    fact("目的", q.desc || "");
    if (q.note) fact("手がかり", q.note);
    const pt = progressText(q);
    if (pt) fact("進み", pt, isReady(q) ? "ok" : "");
    else if (q.type === "deliver" && q.state === "offer") { const st = deliverSt(q); if (st) fact("品", haveLabel(st) + (st.holder && st.holder.name ? ` ${st.holder.name}` : ""), st.holder ? "ok" : ""); }
    fact("報酬", rewardText(q));
    if (q.fixed && q.def.opens && q.state === "offer") fact("道", "受けると、地図に新たな迷宮が記される");
    if (q.state === "offer") fact("受注", `${lists().freeCount} / ${cap()} 件` + (full() ? " ・ 枠が空いていない" : ""), full() ? "bad" : "");
    box.appendChild(facts);
    root.appendChild(box);
  };
  const footer = () => {
    const q = cur();
    const close = { label: q && q.state === "offer" ? "受けない" : "閉じる", kind: "ghost", onTap: (s) => s.close() };
    if (!q) return [close];
    const out = [];
    // 納品の依頼は、受ける前でもその場で納められる
    if (isOpenDeliver(q)) {
      const st = deliverSt(q) || {};
      if (st.holder) out.push({ label: "納品する", kind: "primary", size: "lg", onTap: (s) => { s.close(); runDelivery(q); } });
      else if (st.inShop) out.push({ label: buyLabel(st), kind: "primary", size: "lg", disabled: !st.canBuy, sub: st.canBuy ? null : "金貨が足りない", onTap: (s) => { s.close(); runDelivery(q); } });
      else if (q.state === "active") out.push({ label: "品を見る", kind: "secondary", onTap: () => openItem(q.itemId) });
    }
    if (q.state === "offer") out.push({ label: "依頼を受ける", kind: canDeliver(q) ? "secondary" : "primary", size: canDeliver(q) ? "md" : "lg", disabled: full(),
      sub: full() ? `受注は${cap()}件まで` : null, onTap: (s) => { if (accept(q)) { s.close(); toast(`依頼「${q.name}」を受けた`); } } });
    else if (q.state === "done") out.push({ label: "報告する", kind: "primary", size: "lg", onTap: (s) => { s.close(); game.claimQuest(q.uid); } });
    if (q.fixed ? q.state === "active" : (q.state === "active" || q.state === "done")) out.push({ label: "放棄する", kind: "danger", size: "sm", onTap: async (s) => { if (await abandon(q)) s.close(); } });
    out.push(close);
    return out;
  };
  // 一度見た固定クエストは「新」を消す
  try { if (q0.fixed && q0.state === "offer") { const s = game.questState(); s.seen[uid] = 1; } } catch (e) { /* noop */ }
  h = sheet.open({ kind: "info", banner: q0.fixed ? "依頼人の頼み" : "掲示板の依頼", title: q0.name, body, footer: footer(), className: "qb-sheet-w",
    onClose: () => { if (game.renderTown) game.renderTown(); } });
  return h;
}

// ---- 街の広場の小さな札 (「次にすべきこと」と同じ並び) ----
export function questChip(q) {
  const ready = isReady(q);
  const b = el("button", "hb-dlv-c hb-q" + (ready ? " ready" : ""));
  b.type = "button";
  const top = el("span", "hb-dlv-top");
  top.appendChild(markOf(q, 24));
  top.appendChild(setText(el("span", "hb-dlv-n"), q.name));
  b.appendChild(top);
  const bot = el("span", "hb-dlv-bot");
  if (q.state === "done") {
    bot.appendChild(el("span", "hb-dlv-s", "達成"));
    bot.appendChild(el("span", "hb-dlv-go", "報告する"));
  } else if (q.type === "deliver") {
    const st = deliverSt(q) || {};
    if (st.holder) { bot.appendChild(el("span", "hb-dlv-s", "持っている")); bot.appendChild(el("span", "hb-dlv-go", "納品する")); }
    else if (st.inShop) {
      bot.appendChild(el("span", "hb-dlv-s", st.canBuy ? "商店に売っている" : "金不足"));
      const c = el("span", "hb-dlv-go" + (st.canBuy ? "" : " off"));
      c.appendChild(glyphText(`💰${st.price}`));
      bot.appendChild(c);
    } else bot.appendChild(el("span", "hb-dlv-s", "納品 ・ 持っていない"));
  } else {
    bot.appendChild(setText(el("span", "hb-dlv-s"), q.type === "floor" ? `地下${q.goal}階へ` : q.type === "clear" ? "踏破する" : `${q.progress || 0}/${q.goal}`));
  }
  b.appendChild(bot);
  b.setAttribute("aria-label", `酒場の依頼 ${q.name}`);
  b.addEventListener("click", () => {
    if (q.state === "done") { sfx("select"); return game.claimQuest(q.uid); }
    if (q.type === "deliver" && ready) return runDelivery(q);
    sfx("select");
    openQuestSheet(q.uid);
  });
  return b;
}
// 街に並べる依頼 (報告できるもの → 納品できるもの → 依頼人 → 掲示板の受注中)
export function hubQuests() {
  const L = lists();
  const score = (q) => (q.state === "done" ? 0 : isReady(q) ? 1 : q.fixed ? 2 : 3);
  return [...L.active].sort((a, b) => score(a) - score(b));
}
export { isReady };
