// ===== 付呪 — 追加つき装備の初持ち帰りで開く。手ほどきは商会の練習用の品で行う =====
// 仕組みは src/infaffix.js の「付呪」と game.js の enchant* / extractAffix / writeAffix / eraseAffix。
//   商会の区分「付呪」: 特性の巻物 (写し取った特性) と、特性の付いた品 (手元・商会の棚) を並べる
//   ・特性の付いた品を押す → 特性を1つ選んで「写し取る」(元の品は消える。棚の品は買値を払う) か「消す」(手元の品だけ。巻物は戻らない)
//   ・特性の巻物を押す → 書き込む品を選ぶ (書ける数・費用・書けない理由) → 確かめて書き込む
// 提供する契約: UI.renderEnchantList(wrap) → 描く関数
// game.js は import しない (ctx.js の UI / game を通す)。

import { UI, game, registerUI } from "./ctx.js";
import { el, sheet, toast, setText, glyph, confirm, button } from "./kit.js";
import { nameSpan, goldEl, dollIcon } from "./loot.js";
import { SLOT_LABEL, itemName } from "../items.js";
import { RARITIES, rarityKey } from "../rarity.js";
import { spriteCanvas } from "../sprites.js";
import { AFX_TIERS, afxDef, pageText, pageFitsSlot, pageFromAffix, pageValue, applyAffixes, enchantBlock, enchantRoom, ENCHANT_SLOTS } from "../infaffix.js";

const G = () => game.G || {};
const sfx = (k, ...a) => { try { if (game.SFX && game.SFX[k]) game.SFX[k](...a); } catch (e) { /* 音は演出のみ */ } };
const shortN = (n) => (n >= 100000 ? `${Math.round(n / 1000)}k` : String(n));
const tierOf = (k) => { const d = afxDef(k); return d ? AFX_TIERS[d.tier] : AFX_TIERS.c; };
const afxName = (k) => { const d = afxDef(k); return d ? d.name.replace(/の$/, "") : "？"; };
export const ENCHANT_NOTE = `迷宮で拾った品の追加の能力・特性を1つ選んで「特性の巻物」に写し取り (元の品は消える)、好きな装備に書き込める。書ける数はレア度で決まる: ${Object.entries(ENCHANT_SLOTS).map(([k, n]) => `${RARITIES[k] ? RARITIES[k].label : k}${n}`).join("・")}。`;

// 練習の品・巻物は G.tut.base にだけ保存する。袋・棚・金貨・使用実績には触れない。
export function enchantPracticeState() {
  const t = G().tut;
  return t?.cur === "enchant" && !t.done?.enchant ? t.base?.enchantPractice || null : null;
}
export function prepareEnchantTutorial() {
  const t = G().tut;
  if (!t || t.cur !== "enchant") return;
  t.base ||= {};
  if (t.base.enchantPractice) return;
  const source = game.cloneItem("shortSword", 50), target = game.cloneItem("shortSword", 50);
  source.afx = [{ k: "A03", v: pageValue({ k: "A03", r: 0.2 }, source) }];
  applyAffixes(source);
  t.base.enchantPractice = { source, target, page: null, written: false };
}

// 特性の名の札 (格の印と名。格で色を分ける)
function afxTag(k, cls = "") {
  const t = tierOf(k);
  const d = afxDef(k);
  return el("span", "ec-tag t-" + (d ? d.tier : "c") + (cls ? " " + cls : ""), `${t.mark}${afxName(k)}`);
}
function whereText(x) {
  if (x.practice) return "商会の練習用（持ち帰り不可）";
  if (x.shelf) return "商会の棚";
  if (x.key) return `${x.doll.name} が装備中（${SLOT_LABEL[x.key] || ""}）`;
  return "持ち物";
}
function itemRow(it, sub, onTap, right = null) {
  const rk = rarityKey(it);
  const row = el("div", "wpc-srow ec-row" + (rk ? " rar-" + rk : ""));
  if (rk) row.style.setProperty("--edge", RARITIES[rk].color);
  const info = el("button", "wpc-srow-info");
  info.type = "button";
  const ic = el("span", "wpc-srow-ic");
  try { ic.appendChild(spriteCanvas(it, 3)); } catch (e) { /* 絵は飾り */ }
  info.appendChild(ic);
  const tx = el("span", "wpc-srow-t");
  const l1 = el("span", "wpc-srow-l1");
  l1.appendChild(nameSpan(it, "wpc-srow-nm"));
  tx.appendChild(l1);
  if (sub) tx.appendChild(sub);
  info.appendChild(tx);
  if (onTap) info.addEventListener("click", onTap);
  row.appendChild(info);
  if (right) row.appendChild(right);
  return row;
}
function afxSummary(it) {
  const l = el("span", "wpc-srow-l3 ec-tags");
  for (const a of (it.afx || [])) l.appendChild(afxTag(a.k));
  return l;
}

// ---------------------------------------------------------------- 特性の付いた品のシート (写し取る / 消す)
function openSourceSheet(src, onDone) {
  let h = null;
  const it = src.it;
  const body = (b) => {
    const head = el("div", "rf-head");
    head.appendChild(nameSpan(it, "rf-name"));
    head.appendChild(el("span", "rf-where", whereText(src) + (src.shelf ? ` ・ 買値 💰${shortN(game.buyPrice ? game.buyPrice(it) : 0)}` : "")));
    b.appendChild(head);
    const list = el("div", "ec-afx");
    const texts = it.afxText || [];
    (it.afx || []).forEach((a, i) => {
      const box = el("section", "ec-afx-row");
      const top = el("div", "ec-afx-top");
      top.appendChild(afxTag(a.k));
      const t = texts.find((x) => x.k === a.k);
      top.appendChild(setText(el("span", "ec-afx-t"), t ? t.text : ""));
      box.appendChild(top);
      const acts = el("div", "ec-afx-acts");
      const why = src.practice ? null : game.extractBlock ? game.extractBlock(src) : "写し取れない";
      const extract = button({ label: src.shelf ? "買い取って写し取る" : "写し取る", kind: "primary", size: "sm", disabled: !!why, onTap: () => doExtract(i) });
      extract.classList.add("ec-extract"); acts.appendChild(extract);
      if (!src.shelf && !src.practice) acts.appendChild(button({ label: "消す", kind: "ghost", size: "sm", onTap: () => doErase(i) }));
      box.appendChild(acts);
      if (why) box.appendChild(el("div", "rf-block", why));
      list.appendChild(box);
    });
    b.appendChild(list);
    b.appendChild(setText(el("div", "rf-note"), "写し取ると、この品は崩れて消える。写せるのは1つの品から1つだけ。写した特性は「特性の巻物」になり、好きな装備に書き込める。"));
    if (!src.shelf && !src.practice) b.appendChild(setText(el("div", "rf-note"), "「消す」はこの品から特性を消すだけで、巻物にはならない。"));
  };
  async function doExtract(i) {
    const name = afxName(it.afx[i].k);
    const ok = await confirm({
      banner: "写し取る", title: `「${name}」を写し取る`,
      lines: [src.shelf ? `${itemName(it)} を買値 💰${shortN(game.buyPrice ? game.buyPrice(it) : 0)} で買い取り、特性を写し取る。` : `写し取ると、${itemName(it)} は崩れて消える。`, "ほかの術は失われる。"],
      okLabel: "写し取る",
    });
    if (!ok) return;
    let page;
    if (src.practice) {
      const p = enchantPracticeState();
      if (!p || p.source !== it) return;
      page = pageFromAffix(it, it.afx[i]);
      if (!page) return;
      p.page = page; p.source = null;
      UI.tutorialEvent?.("enchantExtracted"); game.autosave?.(true);
    } else page = game.extractAffix ? game.extractAffix(src, i) : null;
    if (!page) return;
    if (h && !h.closed) h.close("done", { silent: true });
    if (onDone) onDone();
  }
  async function doErase(i) {
    const name = afxName(it.afx[i].k);
    const ok = await confirm({ banner: "特性を消す", title: `「${name}」を消す`, lines: [`${itemName(it)} から特性を消す。巻物にはならず、戻せない。`], okLabel: "消す" });
    if (!ok) return;
    if (game.eraseAffix && game.eraseAffix(it, i)) {
      toast(`「${name}」を消した`, { tone: "info", noLog: true });
      if (!it.afx || !it.afx.length) { if (h && !h.closed) h.close("done", { silent: true }); }
      else if (h && !h.closed) h.update({ body });
      if (onDone) onDone();
    }
  }
  sfx("select");
  h = sheet.open({ kind: "info", banner: "特性の付いた品", art: it, artScale: 6, body, className: "ec-sheet", footer: [{ label: "閉じる", kind: "ghost", onTap: (x) => x.close() }] });
  return h;
}

// ---------------------------------------------------------------- 特性の巻物 → 書き込む品を選ぶ
function openWriteSheet(page, onDone) {
  let h = null;
  const body = (b) => {
    const head = el("div", "ec-page-head");
    head.appendChild(afxTag(page.k, "big"));
    head.appendChild(setText(el("span", "ec-afx-t"), pageText(page)));
    b.appendChild(head);
    const d = afxDef(page.k);
    if (d && d.kind === "B") b.appendChild(setText(el("div", "rf-note"), "能力値の特性は、書き込む品のランクに合わせて値が変わる (下の一覧の値)。"));
    const practice = enchantPracticeState();
    const targets = (practice ? [{ it: practice.target, practice: true }] : game.enchantTargets ? game.enchantTargets() : []).filter((x) => pageFitsSlot(page, x.it));
    const infos = targets.map((x) => {
      const why = x.practice ? enchantBlock(x.it, page, rarityKey(x.it)) : null;
      return { x, info: x.practice ? { why, block: why, cost: 0, room: enchantRoom(x.it, rarityKey(x.it)), text: pageText(page, x.it) } : game.enchantInfo(x.it, page) };
    });
    infos.sort((a, b2) => (a.info.why ? 1 : 0) - (b2.info.why ? 1 : 0));
    const n = infos.filter((y) => !y.info.why).length;
    b.appendChild(el("div", "wpc-lhead", `書き込める品 ${n}点`));
    const box = el("div", "wpc-list ec-list");
    if (!infos.length) box.appendChild(el("div", "wpc-empty", "この特性を書ける部位の装備品が無い。未鑑定の品は、先に鑑定する。"));
    for (const { x, info } of infos) {
      const sub = el("span", "wpc-srow-l3 ec-sub");
      const r = info.room;
      sub.appendChild(el("span", "ec-room", `特性 ${r.used}/${r.slots}`));
      sub.appendChild(el("span", "wpc-srow-kind", whereText(x)));
      if (!info.why) sub.appendChild(setText(el("span", "ec-val"), info.text));
      else sub.appendChild(el("span", "ec-why", info.why));
      let right = null;
      if (!info.why) {
        right = el("div", "wpc-buy");
        const main = el("button", "wpc-buy-main ec-write" + (info.block ? " short" : ""));
        main.type = "button";
        main.appendChild(goldEl(shortN(info.cost), "wpc-buy-p"));
        main.appendChild(el("span", "wpc-buy-l", "書き込む"));
        main.addEventListener("click", () => doWrite(x, info));
        right.appendChild(main);
      }
      const row = itemRow(x.it, sub, info.why ? null : () => doWrite(x, info), right);
      if (info.why) row.classList.add("off");
      if (x.doll && x.key) { const ic = dollIcon(x.doll, 1.2); ic.classList.add("ec-holder"); row.querySelector(".wpc-srow-l1").appendChild(ic); }
      box.appendChild(row);
    }
    b.appendChild(box);
  };
  async function doWrite(x, info) {
    if (info.block) { sfx("ng"); toast(info.block, { tone: "bad", noLog: true }); return; }
    const lines = [`${itemName(x.it)} に書き込む: ${info.text}`, x.practice ? "練習のため費用はかからない。所持品と金貨は変わらない。" : `費用 💰${shortN(info.cost)} (所持 💰${shortN(G().gold || 0)})`, "書いた特性は消せるが、巻物は戻らない。"];
    const ok = await confirm({ banner: "付呪", title: `「${afxName(page.k)}」を書き込む`, lines, okLabel: "書き込む", danger: false });
    if (!ok) return;
    let written = false;
    if (x.practice) {
      const p = enchantPracticeState();
      if (!p || p.target !== x.it || p.page !== page || enchantBlock(x.it, page, rarityKey(x.it))) return;
      x.it.afx = [{ k: page.k, v: pageValue(page, x.it) }]; applyAffixes(x.it);
      p.page = null; p.written = true; written = true;
      UI.tutorialEvent?.("enchantWritten"); game.autosave?.(true);
    } else written = !!game.writeAffix?.(x.it, page);
    if (written) {
      if (h && !h.closed) h.close("done", { silent: true });
      if (onDone) onDone();
    }
  }
  sfx("select");
  h = sheet.open({ kind: "info", banner: "特性の巻物を書き込む", body, className: "ec-sheet", footer: [{ label: "閉じる", kind: "ghost", onTap: (x) => x.close() }] });
  return h;
}

// ---------------------------------------------------------------- 商会の区分「付呪」
export function renderEnchantList(wrap) {
  const intro = el("section", "rf-intro");
  intro.appendChild(setText(el("div", "rf-intro-t"), ENCHANT_NOTE));
  if (enchantPracticeState()) intro.appendChild(setText(el("div", "rf-intro-s"), "手ほどき中：商会の練習用の品を使います。所持品と金貨は変わりません。"));
  intro.appendChild(setText(el("div", "rf-intro-s"), enchantPracticeState()
    ? "特性の値の上限は、書く品のレア度で決まる。実際の費用は、書く品の買値と術の格・何枠目かで決まる。"
    : "特性の値の上限は、書く品のレア度で決まる。極・発動する特性・属攻・属防・追加効果は、付呪では1つの品にそれぞれ1つまで。費用は書く品の買値と術の格・何枠目かで決まる。"));
  wrap.appendChild(intro);
  const head = el("div", "wpc-lhead");
  head.appendChild(el("span", "wpc-lhead-t", "付呪"));
  const gs = el("span", "wpc-lhead-s");
  gs.appendChild(glyph("gold"));
  gs.appendChild(document.createTextNode(` ${shortN(G().gold || 0)}`));
  head.appendChild(gs);
  wrap.appendChild(head);
  const box = el("div", "wpc-list ec-list");
  wrap.appendChild(box);
  const redo = () => { if (game.renderTown) game.renderTown(); };
  return () => {
    box.textContent = "";
    const practice = enchantPracticeState();
    const pages = practice ? (practice.page ? [practice.page] : []) : game.afxPagesState ? game.afxPagesState() : [];
    const pg = el("section", "rf-grp ec-pages");
    pg.appendChild(el("div", "wpc-drow-h ec-h", `特性の巻物 ${pages.length}本`));
    if (!pages.length) pg.appendChild(el("div", "wpc-empty", "まだ巻物が無い。下の「特性の付いた品」から写し取る。"));
    for (const page of pages) {
      const row = el("div", "wpc-srow ec-prow");
      const info = el("button", "wpc-srow-info");
      info.type = "button";
      const tx = el("span", "wpc-srow-t");
      const l1 = el("span", "wpc-srow-l1");
      l1.appendChild(afxTag(page.k));
      tx.appendChild(l1);
      tx.appendChild(setText(el("span", "wpc-srow-l3 ec-val"), pageText(page)));
      if (page.from) tx.appendChild(el("span", "wpc-srow-kind", `${page.from} から写した`));
      info.appendChild(tx);
      info.addEventListener("click", () => openWriteSheet(page, redo));
      row.appendChild(info);
      const act = el("div", "wpc-buy");
      const b = el("button", "wpc-buy-main");
      b.type = "button";
      b.appendChild(el("span", "wpc-buy-l", "書き込む"));
      b.addEventListener("click", () => openWriteSheet(page, redo));
      act.appendChild(b);
      row.appendChild(act);
      pg.appendChild(row);
    }
    box.appendChild(pg);
    const srcs = practice ? (practice.source ? [{ it: practice.source, practice: true }] : []) : game.enchantSources ? game.enchantSources() : [];
    const sg = el("section", "rf-grp ec-srcs");
    sg.appendChild(el("div", "wpc-drow-h ec-h", `特性の付いた品 ${srcs.length}点`));
    if (!srcs.length) sg.appendChild(el("div", "wpc-empty", "特性の付いた品が無い。無限迷宮で拾った品は、持ち帰ると商会の棚に並ぶ。"));
    for (const x of srcs) {
      const sub = afxSummary(x.it);
      sub.appendChild(el("span", "wpc-srow-kind", whereText(x) + (x.shelf ? ` 💰${shortN(game.buyPrice ? game.buyPrice(x.it) : 0)}` : "")));
      sg.appendChild(itemRow(x.it, sub, () => openSourceSheet(x, redo)));
    }
    box.appendChild(sg);
  };
}

export function install() {
  registerUI({ renderEnchantList, prepareEnchantTutorial, enchantPracticeState });
}
