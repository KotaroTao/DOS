// ===== 付呪 — 追加つき装備の初持ち帰りで開く。手ほどきは商会の練習用の品で行う =====
// 仕組みは src/infaffix.js の「付呪」と game.js の enchant* / extractAffix / writeAffix / eraseAffix。
//   商会の区分「付呪」: 特性の巻物 (写し取った特性) と、特性の付いた品 (手元・商会の棚) を並べる
//   ・特性の付いた品を押す → 特性を1つ選んで「写し取る」(元の品は消える。棚の品は買値を払う) か「消す」(手元の品だけ。巻物は戻らない)
//   ・特性の巻物を押す → 書き込む品を選ぶ (書ける数・費用・書けない理由) → 確かめて書き込む
// 提供する契約: UI.renderEnchantList(wrap) → 描く関数
// game.js は import しない (ctx.js の UI / game を通す)。

import { gearFilter, matchesGearFilter, gearFilterButton, gearFilterSummary } from "./gearfilter.js";
import { UI, game, registerUI } from "./ctx.js";
import { el, sheet, toast, setText, confirm, button } from "./kit.js";
import { nameSpan, goldEl, dollIcon } from "./loot.js";
import { SLOT_LABEL, itemName } from "../items.js";
import { RARITIES, rarityKey } from "../rarity.js";
import { spriteCanvas } from "../sprites.js";
import { AFX_TIERS, afxDef, pageText, pageFitsSlot, pageFromAffix, pageValue, applyAffixes, enchantBlock, enchantRoom, ENCHANT_SLOTS } from "../infaffix.js";

const G = () => game.G || {};
const sfx = (k, ...a) => { try { if (game.SFX && game.SFX[k]) game.SFX[k](...a); } catch (e) { /* 音は演出のみ */ } };
const goldNumber = n => Number(n).toLocaleString("ja-JP");
// 詳細を閉じた後も一覧の用途と場所を保つ。練習中の品には適用しない。
const enchantView = { kind: "all", place: "all" };
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
  return "共有の袋";
}
function selectField(label, options, value, onChange) {
  const field = el("label", "rf-field");
  field.appendChild(el("span", "", label));
  const input = el("select", "rf-select");
  input.setAttribute("aria-label", label);
  for (const [key, text] of options) {
    const option = el("option", "", text); option.value = key; input.appendChild(option);
  }
  input.value = options.some(([key]) => key === value) ? value : options[0][0];
  input.addEventListener("change", () => onChange(input.value));
  field.appendChild(input);
  return field;
}
function sourceHead(it, where) {
  const head = el("div", "ec-item-head");
  const art = el("span", "ec-item-art");
  try { art.appendChild(spriteCanvas(it, 2)); } catch (e) { /* 絵は飾り */ }
  head.appendChild(art);
  head.appendChild(nameSpan(it, "rf-name"));
  head.appendChild(el("span", "rf-where", where));
  return head;
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
  for (const a of (it.afx || [])) {
    const effect = el("span", "ec-effect");
    effect.appendChild(afxTag(a.k));
    effect.appendChild(setText(el("span", "ec-val"), it.afxText?.find(t => t.k === a.k)?.text || ""));
    l.appendChild(effect);
  }
  return l;
}

// ---------------------------------------------------------------- 特性の付いた品のシート (写し取る / 消す)
function openSourceSheet(src, onDone, { extractOnly = false } = {}) {
  let h = null;
  const it = src.it;
  const body = (b) => {
    b.appendChild(sourceHead(it, whereText(src) + (src.shelf ? ` ・ 買値 💰${goldNumber(game.buyPrice ? game.buyPrice(it) : 0)}` : "")));
    b.appendChild(setText(el("div", "ec-warning"), "写し取ると元の品は消え、ほかの特性も失われる。残せるのは1つの特性だけ。"));
    if (!src.shelf && !src.practice && !extractOnly) b.appendChild(setText(el("div", "rf-note"), "「消す」は選んだ特性だけを消す。品は残るが、巻物にはならず戻せない。"));
    const why = src.practice ? null : game.extractBlock ? game.extractBlock(src) : "写し取れない";
    if (why) b.appendChild(el("div", "ec-why ec-source-block", why));
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
      const extract = button({ label: src.shelf ? "買い取って写し取る" : "写し取る", kind: "primary", size: "sm", disabled: !!why, onTap: () => doExtract(i) });
      extract.classList.add("ec-extract"); acts.appendChild(extract);
      if (!src.shelf && !src.practice && !extractOnly) acts.appendChild(button({ label: "消す", kind: "ghost", size: "sm", onTap: () => doErase(i) }));
      box.appendChild(acts);
      list.appendChild(box);
    });
    b.appendChild(list);
  };
  async function doExtract(i) {
    const name = afxName(it.afx[i].k);
    const ok = await confirm({
      banner: "写し取る", title: `「${name}」を写し取る`,
      lines: [src.shelf ? `${itemName(it)} を買値 💰${goldNumber(game.buyPrice ? game.buyPrice(it) : 0)} で買い取り、特性を写し取る。` : `写し取ると、${itemName(it)} は崩れて消える。`, "ほかの術は失われる。"],
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
  h = sheet.open({ kind: "info", banner: extractOnly ? "巻物にする" : "特性の付いた品", body, className: "ec-sheet ec-source-sheet", footer: [{ label: "閉じる", kind: "ghost", onTap: (x) => x.close() }] });
  return h;
}

// 品の詳細からの写し取り。商会の棚や練習用の品は扱わない。
export function openAffixExtract(it, onDone) {
  if (!G().tut?.done?.enchant) return null;
  const holder = game.itemHolder?.(it);
  const src = { it, ...holder, shelf: false };
  const why = game.extractBlock?.(src) || (!holder ? "手元にない品は写し取れない" : null);
  if (why) { toast(why, { tone: "info", noLog: true }); return null; }
  return openSourceSheet(src, onDone, { extractOnly: true });
}

// 買う一覧から、棚の追加つき1点を購入と同時に巻物へ写す。
export function openShelfAffixExtract(id, onDone) {
  if (!G().tut?.done?.enchant) return null;
  const it = game.shopAfxItem?.(id);
  if (!it) { toast("その追加つきの品は売り切れた", { tone: "info", noLog: true }); return null; }
  const src = { it, doll: null, key: null, shelf: true };
  const why = game.extractBlock?.(src);
  if (why) { toast(why, { tone: "info", noLog: true }); return null; }
  return openSourceSheet(src, onDone, { extractOnly: true });
}

// ---------------------------------------------------------------- 特性の巻物 → 書き込む品を選ぶ
function openWriteSheet(page, onDone) {
  let h = null;
  let scope = "all", onlyReady = false;
  const body = (b) => {
    const head = el("div", "ec-page-head");
    head.appendChild(afxTag(page.k, "big"));
    head.appendChild(setText(el("span", "ec-afx-t"), pageText(page)));
    b.appendChild(head);
    const practice = enchantPracticeState();
    b.appendChild(el("div", "ec-write-note", practice ? "練習用の品に書き込む。巻物と金貨は使わない。" : `所持金貨 ${goldNumber(G().gold || 0)} ・ 巻物は使い切り。書く値と費用を品ごとに確認する。`));
    const controls = el("div", "ec-target-controls");
    if (!practice) {
      controls.appendChild(selectField("書き込み先", [["all", "すべて"], ["equipped", "装備中"], ["bag", "共有の袋"],
        ...(game.allDolls ? game.allDolls() : []).filter(d => d && !d.isEmpty).map(d => [`doll:${d.uid}`, `${d.name}の装備`])], scope, value => { scope = value; fillTargets(); box.scrollTop = 0; }));
      const field = el("label", "ec-ready");
      const input = el("input"); input.type = "checkbox"; input.checked = onlyReady;
      input.addEventListener("change", () => { onlyReady = input.checked; fillTargets(); box.scrollTop = 0; });
      field.append(input, el("span", "", "書き込める品だけ")); controls.appendChild(field);
      b.appendChild(controls);
    }
    const count = el("div", "wpc-lhead ec-target-count"); b.appendChild(count);
    const box = el("div", "wpc-list ec-list ec-target-list"); b.appendChild(box);
    function fillTargets() {
      box.textContent = "";
      const targets = (practice ? [{ it: practice.target, practice: true }] : game.enchantTargets ? game.enchantTargets() : [])
        .filter(x => pageFitsSlot(page, x.it))
        .filter(x => practice || scope === "all" || (scope === "bag" ? !x.key : scope === "equipped" ? !!x.key : `doll:${x.doll?.uid}` === scope));
      const infos = targets.map(x => {
        const why = x.practice ? enchantBlock(x.it, page, rarityKey(x.it)) : null;
        return { x, info: x.practice ? { why, block: why, cost: 0, room: enchantRoom(x.it, rarityKey(x.it)), text: pageText(page, x.it) } : game.enchantInfo(x.it, page) };
      });
      infos.sort((a, b2) => Number(!!a.info.block) - Number(!!b2.info.block));
      const n = infos.filter(y => !y.info.block).length;
      setText(count, `書き込める品 ${n}点 ／ 対象 ${infos.length}点`);
      const shown = onlyReady ? infos.filter(y => !y.info.block) : infos;
      if (!shown.length) box.appendChild(el("div", "wpc-empty", onlyReady ? "書き込める品が無い。チェックを外すと、書けない理由を確認できる。" : "この対象に、この特性を書ける部位の装備品は無い。書き込み先を変えるか、未鑑定の品を先に鑑定する。"));
      for (const { x, info } of shown) {
        const sub = el("span", "wpc-srow-l3 ec-sub");
        const r = info.room;
        sub.appendChild(el("span", "ec-room", `特性 ${r.used}/${r.slots}`));
        sub.appendChild(el("span", "wpc-srow-kind", whereText(x)));
        if (!info.why) {
          if (info.overwrite) sub.appendChild(setText(el("span", "ec-before"), `変更前：${info.beforeText}`));
          sub.appendChild(setText(el("span", "ec-val" + (info.lower ? " ec-lower" : "")), `${info.overwrite ? "変更後：" : "書き込む効果："}${info.text}`));
          if (info.lower) sub.appendChild(el("span", "ec-why", "上書きで効果が低下する"));
        }
        if (info.block) sub.appendChild(el("span", "ec-why", info.block));
        let right = null;
        if (!info.why) {
          right = el("div", "wpc-buy");
          const main = el("button", "wpc-buy-main ec-write" + (info.block ? " short" : ""));
          main.type = "button"; main.disabled = !!info.block;
          main.setAttribute("aria-label", `${info.overwrite ? "上書きする" : "書き込む"}：${itemName(x.it)}（${whereText(x)}）`);
          main.appendChild(goldEl(goldNumber(info.cost), "wpc-buy-p"));
          main.appendChild(el("span", "wpc-buy-l", info.overwrite ? "上書きする" : "書き込む"));
          main.addEventListener("click", () => doWrite(x, info)); right.appendChild(main);
        }
        const row = itemRow(x.it, sub, info.block ? null : () => doWrite(x, info), right);
        if (info.block) row.classList.add("off");
        if (x.doll && x.key) { const ic = dollIcon(x.doll, 1.2); ic.classList.add("ec-holder"); row.querySelector(".wpc-srow-l1").appendChild(ic); }
        box.appendChild(row);
      }
    }
    fillTargets();
  };
  async function doWrite(x, info) {
    if (!x.practice) info = game.enchantInfo(x.it, page);
    if (info.block) { sfx("ng"); toast(info.block, { tone: "bad", noLog: true }); return; }
    const lines = info.overwrite
      ? [itemName(x.it), `変更前: ${info.beforeText}`, `変更後: ${info.text}`, "元の特性は失われ、巻物は使い切りになる。"]
      : [`${itemName(x.it)} に書き込む: ${info.text}`, "書いた特性は消せるが、巻物は戻らない。"];
    if (info.lower) lines.unshift("注意：上書きすると能力・効果が低下します。");
    lines.push(x.practice ? "練習のため費用はかからない。所持品と金貨は変わらない。" : `費用 💰${goldNumber(info.cost)} (所持 💰${goldNumber(G().gold || 0)})`);
    const ok = await confirm({ banner: "付呪", title: info.overwrite ? `同じ特性「${afxName(page.k)}」があります。上書きしますか？` : `「${afxName(page.k)}」を書き込む`, lines, okLabel: info.overwrite ? "上書きする" : "書き込む", danger: !!info.lower });
    if (!ok) return;
    let written = false;
    if (x.practice) {
      const p = enchantPracticeState();
      if (!p || p.target !== x.it || p.page !== page || enchantBlock(x.it, page, rarityKey(x.it))) return;
      x.it.afx = [{ k: page.k, v: pageValue(page, x.it) }]; applyAffixes(x.it);
      p.page = null; p.written = true; written = true;
      UI.tutorialEvent?.("enchantWritten"); game.autosave?.(true);
    } else written = !!game.writeAffix?.(x.it, page, info.confirmation);
    if (written) {
      if (h && !h.closed) h.close("done", { silent: true });
      if (onDone) onDone();
    }
  }
  sfx("select");
  h = sheet.open({ kind: "info", banner: "特性の巻物を書き込む", body, className: "ec-sheet ec-write-sheet", footer: [{ label: "閉じる", kind: "ghost", onTap: (x) => x.close() }] });
  return h;
}

// ---------------------------------------------------------------- 商会の区分「付呪」
export function renderEnchantList(wrap) {
  const intro = el("details", "rf-intro ec-guide");
  intro.open = !!enchantPracticeState();
  intro.appendChild(el("summary", null, "付呪の手引き（写し取り・書き込み）"));
  intro.appendChild(setText(el("div", "rf-intro-t"), ENCHANT_NOTE));
  if (enchantPracticeState()) intro.appendChild(setText(el("div", "rf-intro-s"), "手ほどき中：商会の練習用の品を使います。所持品と金貨は変わりません。"));
  intro.appendChild(setText(el("div", "rf-intro-s"), enchantPracticeState()
    ? "特性の値の上限は、書く品のレア度で決まる。実際の費用は、書く品の買値と術の格・何枠目かで決まる。"
    : "特性の値の上限は、書く品のレア度で決まる。極・発動する特性・属攻・属防は、付呪では1つの品にそれぞれ1つまで。状態異常の追加効果は、枠の範囲で自由に組み合わせられる。費用は書く品の買値と術の格・何枠目かで決まる。"));
  wrap.appendChild(intro);
  const practice = enchantPracticeState();
  const controls = el("div", "rf-controls ec-controls");
  const kindField = selectField("一覧", [["all", "すべて"], ["pages", "巻物を書き込む"], ["sources", "品から写し取る・消す"]], practice ? "all" : enchantView.kind, value => {
    enchantView.kind = value; placeField.querySelector("select").disabled = value === "pages"; fill(); box.scrollTop = 0;
  });
  const placeField = selectField("品の場所", [["all", "すべて"], ["bag", "共有の袋"], ["equipped", "装備中"], ["shelf", "商会の棚"]], practice ? "all" : enchantView.place, value => { enchantView.place = value; fill(); box.scrollTop = 0; });
  kindField.querySelector("select").disabled = !!practice;
  placeField.querySelector("select").disabled = !!practice || enchantView.kind === "pages";
  controls.append(kindField, placeField);
  if (!practice) wrap.appendChild(controls);
  const head = el("div", "wpc-lhead");
  head.appendChild(el("span", "wpc-lhead-t", "付呪"));
  const gs = el("span", "wpc-lhead-s");
  setText(gs, `所持金貨 ${goldNumber(G().gold || 0)}`);
  head.appendChild(gs);
  wrap.appendChild(head);
  const box = el("div", "wpc-list ec-list");
  wrap.appendChild(box);
  const redo = () => { if (game.renderTown) game.renderTown(); };
  const filterBar = el("div", "ec-filter");
  head.appendChild(filterBar);
  const summary = el("div", "ec-filter-summary");
  wrap.insertBefore(summary, box);
  // 基礎性能を含めず、巻物と装備に付いた特性だけを共通の候補にする。
  const filterItem = texts => ({ slot: "weapon", afxText: texts });
  const pageItem = page => filterItem([{ k: page.k, name: afxDef(page.k)?.name || "？", text: pageText(page) }]);
  const sourceItem = x => filterItem(x.it.afxText || []);
  const prefKey = "enchantFilter";
  const fill = () => {
    box.textContent = "";
    const practice = enchantPracticeState();
    const pages = practice ? (practice.page ? [practice.page] : []) : game.afxPagesState ? game.afxPagesState() : [];
    const srcs = practice ? (practice.source ? [{ it: practice.source, practice: true }] : []) : game.enchantSources ? game.enchantSources() : [];
    const items = [...pages.map(pageItem), ...srcs.map(sourceItem)];
    // 手ほどきの練習用の品は、記憶した条件で隠さない。
    const f = practice ? { elements: [], effects: [] } : gearFilter(prefKey);
    filterBar.replaceChildren(); summary.replaceChildren();
    if (!practice) {
      filterBar.appendChild(gearFilterButton(items, fill, prefKey, { affixOnly: true }));
      summary.appendChild(gearFilterSummary(items, fill, prefKey));
    }
    const shownPages = pages.filter(p => matchesGearFilter(pageItem(p), f));
    const shownSources = srcs.filter(x => matchesGearFilter(sourceItem(x), f)).filter(x => practice || enchantView.place === "all" ||
      (enchantView.place === "shelf" ? x.shelf : enchantView.place === "equipped" ? !!x.key : !x.key && !x.shelf));
    setText(gs, `所持金貨 ${goldNumber(G().gold || 0)}`);
    const pg = el("section", "rf-grp ec-pages");
    pg.appendChild(el("div", "wpc-drow-h ec-h", `特性の巻物 ${shownPages.length} / ${pages.length}本`));
    if (!shownPages.length) pg.appendChild(el("div", "wpc-empty", pages.length ? "条件に合う巻物はない。絞り込みの条件を外してください。" : "まだ巻物が無い。一覧を「品から写し取る・消す」にして、特性の付いた品から写し取る。"));
    for (const page of shownPages) {
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
    if (practice || enchantView.kind !== "sources") box.appendChild(pg);
    const sg = el("section", "rf-grp ec-srcs");
    sg.appendChild(el("div", "wpc-drow-h ec-h", `特性の付いた品 ${shownSources.length} / ${srcs.length}点`));
    if (!shownSources.length) sg.appendChild(el("div", "wpc-empty", srcs.length ? "条件に合う品はない。品の場所や絞り込みの条件を変えてください。" : "特性の付いた品が無い。無限迷宮で拾った品は、持ち帰ると商会の棚に並ぶ。"));
    for (const x of shownSources) {
      const sub = afxSummary(x.it);
      sub.appendChild(el("span", "wpc-srow-kind", whereText(x) + (x.shelf ? ` 💰${goldNumber(game.buyPrice ? game.buyPrice(x.it) : 0)}` : "")));
      const why = x.practice ? null : game.extractBlock?.(x);
      if (why) sub.appendChild(el("span", "ec-why", why));
      const action = el("div", "wpc-buy");
      const check = el("button", "wpc-buy-main"); check.type = "button";
      check.appendChild(el("span", "wpc-buy-l", "特性を選ぶ"));
      check.setAttribute("aria-label", `${itemName(x.it)}の特性を選ぶ（${whereText(x)}）`);
      check.addEventListener("click", () => openSourceSheet(x, redo)); action.appendChild(check);
      sg.appendChild(itemRow(x.it, sub, () => openSourceSheet(x, redo), action));
    }
    if (practice || enchantView.kind !== "pages") box.appendChild(sg);
  };
  return fill;
}

export function install() {
  registerUI({ renderEnchantList, prepareEnchantTutorial, enchantPracticeState, openAffixExtract, openShelfAffixExtract });
}
