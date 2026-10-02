// ===== 商会 — 売る・鑑定 (隊全体・控え込み) / 買う (最良の装備者へ・買って装備) =====
// 担当: WP-C。街シェルの「商会」タブを描く。
//   売る・鑑定: まとめて鑑定 / まとめて売る (ops の一括操作。除外の内訳つき) + 全員の持ち物 (控え込み)
//   買う      : 分類のチップ1列 (武器だけ下に種別の列) + 棚の行 (最良の装備者との増減・買って装備・▾ 渡す先)
// 最後に開いた区分・分類は prefs (dos-ui) に覚える。
// 提供する契約: UI.openShop(seg, {cat}) / UI.unidCount() / UI.junkList(opts) / UI.shopBuy(id, who, {equip})
//              UI.confirmSellJunk() / UI.confirmIdentifyAll() (帰還の報告・提案からも同じ確認で呼べる)
// game.js は import しない (ctx.js の UI / game / ops を通す。kit.js・itemview.js は自由に使ってよい)。

import { UI, game, ops, registerUI } from "./ctx.js";
import { el, button, segmented, chips, whisper, sheet, toast, setText, glyph, longPress } from "./kit.js";
import { getPref, setPref, remember } from "./prefs.js";
import { statLines, isEquippable } from "./itemview.js";
import {
  itemSheet, wearPlan, deltaFor, deltaEl, nameSpan, goldEl, caretIcon, equipTo, floatGold, ownerOf, equipCandidates, shopOpen, isUpgrade,
  openDollChooser, equipPick, dollIcon,
} from "./loot.js";
import { ITEMS, ITEM_CATS, WEAPON_CATS, WEAPON_CAT_LABEL, MAX_ITEMS, canEquip, itemName } from "../items.js";
import { RARITIES, rarityKey } from "../rarity.js";
import { spriteCanvas } from "../sprites.js";

const G = () => game.G || {};
const sfx = (k) => { try { if (game.SFX && game.SFX[k]) game.SFX[k](); } catch (e) { /* 音は演出のみ */ } };
const allDolls = () => (game.allDolls ? game.allDolls() : [...(G().party || []), ...(G().reserve || [])]);
const isReserve = (d) => (G().reserve || []).includes(d);

// 画面の状態 (区分・分類は prefs に覚える。鑑定の結果はこの街滞在のあいだだけ)
const view = { sellPage: 0, buyPage: 0 };
const segOf = () => (getPref("shopSeg") === "buy" ? "buy" : "sell");
const catOf = () => getPref("shopBuyCat", "rec") || "rec";
const wcatOf = () => remember("seg", "shopWeapon") || "all";

// 「装備の候補か」の見立ては重い (人業ごとに仮の再計算) ので、同じ同期の処理の中だけ覚えておく
const upCache = new Map();
let upCacheArmed = false;
function isUp(it) {
  if (!upCacheArmed) { upCacheArmed = true; Promise.resolve().then(() => { upCache.clear(); upCacheArmed = false; }); }
  let v = upCache.get(it);
  if (v === undefined) { v = isUpgrade(it); upCache.set(it, v); }
  return v;
}

// ---------------------------------------------------------------- 数え上げ
// 未鑑定の品 (隊と控えの全員の所持品)
export function unidList() {
  const out = [];
  for (const d of allDolls()) for (const it of (d.items || [])) if (it && it.unidentified) out.push({ doll: d, item: it, cost: game.appraiseCost(it) });
  return out;
}
export function unidCount() { return unidList().length; }
// 誰かが装備している品か (持ち主の装備だけでなく、隊と控えの全員の装備を見る = 念のための二重の守り)
function wornByAnyone(it) {
  for (const d of allDolls()) for (const k in (d.equip || {})) if (d.equip[k] === it) return true;
  return false;
}
function baseJunk(opts) {
  const base = typeof ops.junkList === "function" ? ops.junkList(opts) : [];
  return base.filter((j) => j && j.item && !j.item.cursed && !j.item.unidentified && !wornByAnyone(j.item));
}
// 売却候補: ops と同じ集合 (呪い・未鑑定・装備中・SR/LR・未奉納の蒐集品・道具を除く) から、
// さらに「誰かの今の装備に勝る品」(装備の候補) を既定で残す。{ keepUpgrades: false } で ops と同じ集合
export function junkList(opts = {}) {
  const base = baseJunk(opts);
  if (opts && opts.keepUpgrades === false) return base;
  return base.filter((j) => !isUp(j.item));
}
// 装備の候補として残す品 (売却候補のうち、誰かの今の装備に勝るもの)
function upgradeKeeps() {
  return baseJunk().filter((j) => isUp(j.item));
}
// 一覧どおりに売る: ops の集合と全く同じなら ops.sellJunkAll、違えば同じ中身の sellSubset
export function sellJunk(list) {
  const opsList = typeof ops.junkList === "function" ? ops.junkList() : [];
  const same = opsList.length === list.length && opsList.every((j) => list.some((x) => x.item === j.item));
  return same && ops.sellJunkAll ? ops.sellJunkAll() : sellSubset(list);
}
// 選んだ売却候補だけを売る。中身は ops.sellJunkAll と同じ (売値 sellPrice・商会の棚に積む・図鑑に記す・記録とトーストは1回)
function sellSubset(list) {
  const g = G();
  let n = 0, gold = 0;
  for (const { doll, item, price } of list) {
    const idx = doll.items.indexOf(item);
    if (idx < 0 || item.cursed || item.unidentified) continue;
    doll.items.splice(idx, 1);
    g.gold += price; gold += price;
    if (item.id) g.shopStock[item.id] = (g.shopStock[item.id] || 0) + 1;
    if (game.codexSeeItem) game.codexSeeItem(item.id);
    n++;
  }
  if (n) {
    sfx("select");
    try { if (game.buzz) game.buzz(10); } catch (e) { /* noop */ }
    if (game.log) game.log(`まとめて売却: ${n}点を売った (+💰${gold})。商店に並んだ。`, "win");
    toast(`${n}点を売却 (+💰${gold})`);
  }
  if (game.renderTown) game.renderTown();
  return { ok: n > 0, n, gold };
}
// 所持金で鑑定できる数 (安い順。ops.identifyAll と同じ順序)
function affordable(list) {
  let gold = G().gold || 0, n = 0, cost = 0;
  for (const c of list.map((x) => x.cost).sort((a, b) => a - b)) { if (gold < c) break; gold -= c; cost += c; n++; }
  return { n, cost };
}
// まとめて売るから外れる品と、その理由
const EXCL = [
  { key: "upgrade", label: "装備の候補", note: "誰かの今の装備に勝る品 (▲)。装備するか、確認の画面で売ることもできる" },
  { key: "rare", label: "スーパーレア・レジェンドレア", note: "逸品は一点ずつ確かめて売る" },
  { key: "misc", label: "未奉納の蒐集品", note: "宝物庫へ奉納すると褒賞が得られる" },
  { key: "cursed", label: "呪われた品", note: "" },
  { key: "unid", label: "未鑑定の品", note: "先に鑑定すれば売値がつく" },
  { key: "use", label: "道具", note: "薬草などは迷宮で役に立つ" },
];
export function exclusions() {
  const g = { upgrade: [], rare: [], misc: [], cursed: [], unid: [], use: [] };
  for (const d of allDolls()) {
    for (const it of (d.items || [])) {
      if (!it) continue;
      if (it.cursed) { g.cursed.push({ doll: d, item: it }); continue; }
      if (it.unidentified) { g.unid.push({ doll: d, item: it }); continue; }
      const w = game.sellWarnings ? game.sellWarnings(it) : [];
      if (w.length) { (it.slot === "misc" ? g.misc : g.rare).push({ doll: d, item: it }); continue; }
      if (it.slot === "use") { g.use.push({ doll: d, item: it }); continue; }
      if (isUp(it)) g.upgrade.push({ doll: d, item: it });
    }
  }
  let equipped = 0;
  for (const d of allDolls()) for (const k in (d.equip || {})) if (d.equip[k]) equipped++;
  return { groups: g, equipped };
}
function keepReason(it) {
  if (it.cursed) return "cursed";
  if (it.unidentified) return "unid";
  if (game.sellWarnings && game.sellWarnings(it).length) return it.slot === "misc" ? "misc" : "rare";
  if (it.slot === "use") return "use";
  return null;
}

// ---------------------------------------------------------------- 小さな部品
// 札に載せる数の短い表記 (1万以上は「2.9万」)
const shortN = (n) => (n >= 100000 ? `${Math.round(n / 10000)}万` : n >= 10000 ? `${(n / 10000).toFixed(1)}万` : String(n));
// 品の札 (絵・レア度の縁・NEW・未鑑定の封印・値段)。押せば品シート
function cell(it, d, { price = true, onTap } = {}) {
  const rk = rarityKey(it);
  const c = el("button", "wpc-cell" + (rk ? " rar-" + rk : "") + (it.unidentified ? " unid" : ""));
  c.type = "button";
  if (rk) c.style.setProperty("--edge", RARITIES[rk].color);
  const art = el("span", "wpc-cell-art");
  art.appendChild(spriteCanvas(it, 3));
  c.appendChild(art);
  if (it.isNew) c.appendChild(el("span", "wpc-cell-new", "NEW"));
  if (it.unidentified) c.appendChild(el("span", "wpc-cell-seal", "?"));
  else if (keepReason(it) && it.slot !== "use") c.appendChild(el("span", "wpc-cell-keep"));
  else if (isUp(it)) c.appendChild(el("span", "wpc-cell-up", "▲"));
  if (price) {
    const p = el("span", "wpc-cell-p" + (it.unidentified ? " unid" : ""));
    if (it.unidentified) { p.appendChild(el("i", "wpc-cell-k", "鑑")); p.appendChild(document.createTextNode(shortN(game.appraiseCost(it)))); }
    else { p.appendChild(glyph("gold")); p.appendChild(document.createTextNode(shortN(game.sellPrice(it)))); }
    c.appendChild(p);
  }
  c.setAttribute("aria-label", `${itemName(it)}${it.unidentified ? " 未鑑定" : ""}`);
  const open = onTap || (() => { sfx("select"); itemSheet(it, { owner: d, context: "sell" }); });
  c.addEventListener("click", open);
  longPress(c, () => itemSheet(it, { owner: d, context: d ? "bag" : "view" }));
  return c;
}
// 品の札を並べた帯 (確認シート・除外の内訳で使う)
function tileStrip(list, { max = 24 } = {}) {
  const w = el("div", "wpc-strip");
  for (const x of list.slice(0, max)) w.appendChild(cell(x.item, x.doll, { price: false, onTap: () => itemSheet(x.item, { owner: x.doll, context: "bag" }) }));
  if (list.length > max) w.appendChild(el("span", "wpc-strip-more", `ほか ${list.length - max}点`));
  return w;
}

// 番人のひとこと (状況で選ぶ)
function keeperLine(seg) {
  const shell = (game.FAC_SHELL && game.FAC_SHELL.shop) || { lines: [] };
  const ls = shell.lines || [];
  let line = ls.length ? ls[((G().stats && G().stats.runs) || 0) % ls.length] : "";
  if (seg === "sell" && unidCount() > 0) line = "未鑑定の品か。正体を知るのは、金を払ってからだ。";
  else if (seg === "buy") line = "黒鉄は嘘をつかん。値札もな。";
  return whisper("merchant", line, { who: shell.who || "黒鉄商会 ヴォス" });
}

// ---------------------------------------------------------------- 一括の確認
// まとめて鑑定 (確認 → ops.identifyAll。鑑定した品は NEW 印をつけ、結果を一覧に出す)
export function confirmIdentifyAll() {
  const list = unidList();
  if (!list.length) { toast("未鑑定の品はない", { tone: "info" }); return null; }
  const total = list.reduce((a, x) => a + x.cost, 0);
  const aff = affordable(list);
  const g = G();
  const body = el("div", "wpc-cbody");
  body.appendChild(tileStrip(list));
  const lines = [aff.n < list.length
    ? `所持金 ${g.gold} で鑑定できるのは ${aff.n}点 (安い順)。残り ${list.length - aff.n}点は次の機会に。`
    : `未鑑定 ${list.length}点を、すべて鑑定する (所持 ${g.gold})。`, "商会の鑑定は必ず正体がわかる。"];
  let h = null;
  const run = () => {
    h.close("ok", { silent: true });
    const before = list.map((x) => x.item);
    const r = ops.identifyAll ? ops.identifyAll() : { n: 0 };
    const got = before.filter((it) => !it.unidentified);
    for (const it of got) it.isNew = true;
    if (r && r.spent) floatGold(r.spent, "dn");
    if (game.renderTown && G().state === "town") game.renderTown();
    if (got.length) openRevealSheet(got);
    return r;
  };
  h = sheet.open({
    kind: "choice", banner: "まとめて鑑定", accent: "#7fd0ff", title: `未鑑定 ${aff.n < list.length ? `${aff.n} / ${list.length}` : list.length}点を鑑定する`,
    lines, body, className: "wpc-confirm",
    footer: [
      { label: "鑑定する", kind: "primary", size: "lg", cost: { kind: "gold", n: aff.n < list.length ? aff.cost : total }, disabled: !aff.n, onTap: run },
      { label: "やめる", kind: "ghost", onTap: (x) => x.close("cancel") },
    ],
  });
  return h;
}

// まとめて売る (確認 → 売る)。売る品の一覧と、残す品の内訳を見せる。
// 装備の候補 (誰かの今の装備に勝る品) は既定で残し、切り替えで一緒に売れる。
// 残す品が無い (= ops と同じ集合) なら ops.sellJunkAll、あれば同じ中身の sellSubset で選んだ品だけを売る
export function confirmSellJunk() {
  let withUp = false;
  const ups = upgradeKeeps();
  const pick = () => (withUp ? junkList({ keepUpgrades: false }) : junkList());
  if (!pick().length && !ups.length) { toast("まとめて売れる品はない", { tone: "info" }); return null; }
  let h = null;
  const run = () => {
    const list = pick();
    if (!list.length) return;
    h.close("ok", { silent: true });
    const r = sellJunk(list);
    if (r && r.gold) floatGold(r.gold, "up");
  };
  const build = () => {
    const list = pick();
    const gold = list.reduce((a, x) => a + x.price, 0);
    const ex = exclusions();
    const body = el("div", "wpc-cbody");
    if (list.length) body.appendChild(tileStrip(list));
    else body.appendChild(el("div", "wpc-empty", "売る品がない。"));
    if (ups.length) {
      // 装備の候補も売るか (切り替え)
      const tg = el("button", "wpc-toggle" + (withUp ? " on" : ""));
      tg.type = "button";
      tg.setAttribute("aria-pressed", withUp ? "true" : "false");
      const tx = el("span", "wpc-toggle-t");
      tx.appendChild(el("span", "wpc-toggle-l", `装備の候補 ${ups.length}点も売る`));
      tx.appendChild(el("span", "wpc-toggle-s", "誰かの今の装備に勝る品 (▲)"));
      tg.appendChild(tx);
      tg.appendChild(el("span", "wpc-switch"));
      tg.addEventListener("click", () => { withUp = !withUp; sfx("select"); refill(); });
      body.appendChild(tg);
    }
    const kept = EXCL.filter((e) => e.key !== "upgrade" || !withUp).map((e) => [e, ex.groups[e.key].length]).filter(([, n]) => n);
    if (kept.length) {
      const k = el("div", "wpc-keepnote");
      k.appendChild(el("span", "wpc-keep-lab", "残す品"));
      k.appendChild(document.createTextNode(kept.map(([e, n]) => `${e.label} ${n}`).join(" ・ ")));
      body.appendChild(k);
    }
    return { body, list, gold };
  };
  const opts = () => {
    const b = build();
    return {
      title: `${b.list.length}点を売る`, body: b.body,
      footer: [
        { label: "売る", kind: "primary", size: "lg", cost: { kind: "gold", n: b.gold }, disabled: !b.list.length, onTap: run },
        { label: "やめる", kind: "ghost", onTap: (x) => x.close("cancel") },
      ],
    };
  };
  const refill = () => { if (h && !h.closed) h.update(opts()); };
  h = sheet.open({
    kind: "choice", banner: "まとめて売る", accent: "#c9a227",
    lines: ["売った品は商会の棚に並ぶ (買い戻せる)。装備中の品は売らない。"], className: "wpc-confirm",
    ...opts(),
  });
  return h;
}

// 除外の内訳
function openExclusions() {
  const ex = exclusions();
  const body = el("div", "wpc-exlist");
  let any = false;
  for (const e of EXCL) {
    const list = ex.groups[e.key];
    const sec = el("section", "wpc-exsec" + (list.length ? "" : " none"));
    const hd = el("div", "wpc-exh");
    hd.appendChild(el("span", "wpc-exh-t", e.label));
    hd.appendChild(el("span", "wpc-exh-n", `${list.length}点`));
    sec.appendChild(hd);
    if (e.note) sec.appendChild(el("div", "wpc-exnote", e.note));
    if (list.length) { any = true; sec.appendChild(tileStrip(list)); }
    body.appendChild(sec);
  }
  const eq = el("div", "wpc-exnote foot", `装備中の品 ${ex.equipped}点は、もとより売り物に含めない。`);
  body.appendChild(eq);
  return sheet.open({
    kind: "info", banner: "まとめて売るの対象外", title: any ? "これらの品は残す" : "残す品はない",
    body, className: "wpc-exsheet",
    footer: [{ label: "閉じる", kind: "primary", onTap: (x) => x.close() }],
  });
}

// ---------------------------------------------------------------- 買う
// 袋に空きのある、生きている人業 (隊 → 控え)
function defaultBuyer() {
  const g = G();
  const party = (g.party || []).filter((d) => d.alive && d.items.length < MAX_ITEMS);
  if (party.length) return party[0];
  return equipCandidates().find((d) => d.items.length < MAX_ITEMS) || null;
}
// 棚の品を買う。equip なら買ったその場で装備させる。成功で true
export function shopBuy(id, who, { equip = false } = {}) {
  const g = G();
  const tmpl = ITEMS[id];
  if (!tmpl) return false;
  if (!shopOpen()) { toast("商会は閉ざされている", { tone: "info" }); return false; }
  who = who || defaultBuyer();
  if (!who) { sfx("ng"); toast("持てる者がいない (持ち物がいっぱい)", { tone: "bad" }); return false; }
  const price = game.buyPrice(tmpl);
  if ((g.gold || 0) < price) { sfx("ng"); toast("金貨が足りない", { tone: "bad" }); return false; }
  if (who.items.length >= MAX_ITEMS) { sfx("ng"); toast(`${who.name} の持ち物がいっぱいだ`, { tone: "bad" }); return false; }
  const delta = equip ? deltaFor(who, tmpl) : null;
  const it = game.buyItem ? game.buyItem(id, price, who) : null;
  if (!it) return false;
  floatGold(price, "dn");
  if (equip && isEquippable(it) && canEquip(who, it)) {
    const ok = equipTo(who, it, { quiet: true });
    const t = toast(ok ? `${it.name} を買い、${who.name} が装備した` : `${it.name} を買った → ${who.name} の袋 (入れ替えられない)`, { tone: ok ? "good" : "gold", icon: it });
    if (t && ok && delta) t.el.querySelector(".ui-toast-t").appendChild(deltaEl(delta));
  } else {
    toast(`${it.name} を買った → ${who.name} の袋`, { tone: "gold", icon: it });
  }
  return true;
}

// 棚の並び順: 武器は種別順、ほかは分類順 → 安い順 → 名前
function catOrder(it) {
  if (it.cat) { const i = WEAPON_CATS.findIndex((c) => c.key === it.cat); return i < 0 ? 99 : i; }
  const i = ITEM_CATS.findIndex((c) => c.slots.includes(it.slot)); return i < 0 ? 99 : i;
}
function stockIds() {
  const g = G();
  return Object.keys(g.shopStock || {}).filter((id) => ITEMS[id] && g.shopStock[id] > 0);
}
// おすすめ: 隊 (と控え) の誰かが得をする棚の品を、得の大きい順に
function recList() {
  const out = [];
  for (const id of stockIds()) {
    const it = ITEMS[id];
    if (!isEquippable(it)) continue;
    const plan = wearPlan(it);
    if (plan.target && plan.delta && plan.score > 0) out.push({ id, plan });
  }
  out.sort((a, b) => b.plan.score - a.plan.score);
  return out;
}
function listFor(cat, wcat) {
  if (cat === "rec") return recList().map((x) => x.id);
  const def = ITEM_CATS.find((c) => c.key === cat) || ITEM_CATS[0];
  return stockIds().filter((id) => {
    const it = ITEMS[id];
    if (!def.slots.includes(it.slot)) return false;
    if (def.key === "weapon" && wcat !== "all" && it.cat !== wcat) return false;
    return true;
  }).sort((a, b) => {
    const ia = ITEMS[a], ib = ITEMS[b];
    return catOrder(ia) - catOrder(ib) || game.sellPrice(ia) - game.sellPrice(ib) || ia.name.localeCompare(ib.name);
  });
}

// 棚の1行 (高さ一定): [絵] 名前 / 種別・在庫・最良の装備者との増減 … [値段 / 買って装備|買う] [▾ 人業を選ぶ]
function stockRow(id) {
  const g = G();
  const it = ITEMS[id];
  const price = game.buyPrice(it);
  const n = g.shopStock[id] || 0;
  const rk = rarityKey(it);
  const plan = isEquippable(it) ? wearPlan(it) : null;
  const upgrade = !!(plan && plan.target && plan.delta && plan.score > 0 && plan.target.items.length < MAX_ITEMS);
  const buyer = upgrade ? plan.target : defaultBuyer();
  const row = el("div", "wpc-srow" + (upgrade ? " up" : "") + (rk ? " rar-" + rk : ""));
  if (rk) row.style.setProperty("--edge", RARITIES[rk].color);
  const info = el("button", "wpc-srow-info");
  info.type = "button";
  const ic = el("span", "wpc-srow-ic");
  ic.appendChild(spriteCanvas(it, 3));
  info.appendChild(ic);
  const tx = el("span", "wpc-srow-t");
  const l1 = el("span", "wpc-srow-l1");
  l1.appendChild(nameSpan(it, "wpc-srow-nm"));
  l1.appendChild(el("span", "wpc-srow-n", `×${n}`));
  tx.appendChild(l1);
  const l3 = el("span", "wpc-srow-l3");
  const kind = it.slot === "weapon" ? (WEAPON_CAT_LABEL[it.cat] || "武器") : ((ITEM_CATS.find((c) => c.slots.includes(it.slot)) || {}).label || "");
  l3.appendChild(el("span", "wpc-srow-kind", kind));
  if (upgrade) {
    l3.appendChild(deltaEl(plan.delta));
    l3.appendChild(el("span", "wpc-srow-who", plan.target.name));
  } else if (plan) {
    l3.appendChild(el("span", "wpc-dim", plan.scores.some((s) => s.can) ? "今の装備が勝る" : "装備できる者がいない"));
  } else {
    const s = statLines(it);
    l3.appendChild(setText(el("span", "wpc-dim"), s || (it.slot === "misc" ? "宝物庫に奉納できる" : "")));
  }
  tx.appendChild(l3);
  info.appendChild(tx);
  info.addEventListener("click", () => { sfx("select"); itemSheet(it, { context: "stock", stockId: id, price, target: plan && plan.target ? plan.target : buyer }); });
  row.appendChild(info);

  const act = el("div", "wpc-buy");
  const short = (g.gold || 0) < price;
  const main = el("button", "wpc-buy-main" + (upgrade ? " eq" : "") + (short ? " short" : ""));
  main.type = "button";
  main.appendChild(goldEl(shortN(price), "wpc-buy-p"));
  main.appendChild(el("span", "wpc-buy-l", upgrade ? "買って装備" : "買う"));
  main.disabled = short || !buyer || n <= 0;
  main.setAttribute("aria-label", `${it.name} を ${price} で${upgrade ? "買って " + plan.target.name + " に装備" : "買う"}`);
  // 最良の装備者へ買って装備 (元に戻せる) / 装備でなければ袋へ
  main.addEventListener("click", () => { if (upgrade) equipPick(plan.target, it, { buyId: id }); else shopBuy(id, buyer, { equip: false }); });
  act.appendChild(main);
  const more = el("button", "wpc-buy-more");
  more.type = "button";
  more.setAttribute("aria-label", "人業を選んで買う");
  more.appendChild(caretIcon());
  more.addEventListener("click", () => openBuyChooser(id));
  act.appendChild(more);
  row.appendChild(act);
  return row;
}

// ▾ 人業を選んで買う: 装備品は「押せば買って装備」の肖像の札 (+ 下に「買うだけ」)。道具などは袋へ入れる相手
function openBuyChooser(id) {
  const it = ITEMS[id];
  if (!it) return null;
  if (!isEquippable(it)) return openDollChooser(it, { mode: "bag", buyId: id, title: "買う" });
  const buyer = defaultBuyer();
  const plan = wearPlan(it);
  const bagTo = plan.target && plan.target.items.length < MAX_ITEMS ? plan.target : buyer;
  return openDollChooser(it, {
    mode: "equip", buyId: id, title: "買って装備",
    footer: bagTo ? [{ label: "買うだけ", sub: `${bagTo.name} の袋へ`, kind: "secondary", cost: { kind: "gold", n: game.buyPrice(it) },
      onTap: (h) => { if (shopBuy(id, bagTo, { equip: false })) h.close("done"); } }] : [],
  });
}

// 鑑定の結果 (まとめて鑑定のあと): 正体が知れた品。押せば品シート / 「装備」で人業を選ぶ
function openRevealSheet(items) {
  const body = el("div", "wpc-picklist wpc-reveal");
  let h = null;
  for (const it of items) {
    const o = ownerOf(it);
    if (!o) continue;
    const r = el("div", "wpc-prow");
    const main = el("button", "wpc-prow-main");
    main.type = "button";
    const ic = el("span", "wpc-srow-ic" + (rarityKey(it) ? " rar-" + rarityKey(it) : ""));
    if (rarityKey(it)) ic.style.setProperty("--edge", RARITIES[rarityKey(it)].color);
    ic.appendChild(spriteCanvas(it, 3));
    main.appendChild(ic);
    const tx = el("span", "wpc-prow-t");
    tx.appendChild(nameSpan(it, "wpc-prow-title"));
    const sub = el("span", "wpc-prow-sub");
    const plan = isEquippable(it) ? wearPlan(it, { owner: o.doll }) : null;
    const up = plan && plan.target && plan.delta && plan.score > 0;
    if (up) { sub.appendChild(deltaEl(plan.delta)); sub.appendChild(el("span", "wpc-srow-who", plan.target.name)); }
    else sub.appendChild(document.createTextNode(`${o.doll.name} の持ち物 ・ 売値 ${game.sellPrice(it)}`));
    tx.appendChild(sub);
    main.appendChild(tx);
    main.addEventListener("click", () => itemSheet(it, { owner: o.doll, context: "sell" }));
    r.appendChild(main);
    if (isEquippable(it) && o.where === "bag") {
      const eb = button({ label: "装備", kind: up ? "primary" : "secondary", size: "sm", onTap: () => openDollChooser(it, { owner: o.doll }) });
      eb.classList.add("wpc-prow-act");
      r.appendChild(eb);
    }
    body.appendChild(r);
  }
  const ups = items.filter((it) => isUp(it)).length;
  h = sheet.open({
    kind: "info", banner: "鑑定の結果", accent: "#7fd0ff",
    title: `${items.length}点の正体が知れた`, lines: ups ? [`装備すると強くなる品が ${ups}点 ある (▲)`] : [],
    body, className: "wpc-pick wpc-revealsheet",
    footer: [{ label: "閉じる", kind: "primary", onTap: (x) => x.close() }],
  });
  return h;
}

// ---------------------------------------------------------------- 描画
// ページ全体は流さない (商会タブはスクロールなし)。一覧の箱の高さに収まる行数で頁を切り、‹ n/m › で送る
function rerender({ top = false } = {}) {
  if (game.renderTown) game.renderTown();
  if (top) {
    const r = UI.shell && UI.shell.contentRoot ? UI.shell.contentRoot() : null;
    if (r) r.scrollTop = 0;
  }
}

// 頁送りの札 (‹ 1/3 ›)。頁が1つなら出さない
function pager(page, pages, onGo) {
  const w = el("div", "wpc-pager");
  if (pages <= 1) return w;
  const prev = el("button", "wpc-pg", "‹");
  prev.type = "button"; prev.setAttribute("aria-label", "前の頁");
  prev.disabled = page <= 0;
  prev.addEventListener("click", () => onGo(page - 1));
  const cur = el("span", "wpc-pg-n", `${page + 1} / ${pages}`);
  const next = el("button", "wpc-pg", "›");
  next.type = "button"; next.setAttribute("aria-label", "次の頁");
  next.disabled = page >= pages - 1;
  next.addEventListener("click", () => onGo(page + 1));
  w.appendChild(prev); w.appendChild(cur); w.appendChild(next);
  return w;
}

// 一覧の箱に、行を頁ごとに描く。1行目を描いて高さを測り、収まる行数を決める
function fillPaged(box, head, items, renderRow, pageKey, gap = 6) {
  box.textContent = "";
  if (!items.length) return;
  const first = renderRow(items[0]);
  box.appendChild(first);
  const rowH = first.offsetHeight || 64;
  const H = box.clientHeight;
  const per = Math.max(1, Math.floor((H + gap) / (rowH + gap)));
  const pages = Math.max(1, Math.ceil(items.length / per));
  const page = Math.min(Math.max(0, view[pageKey] || 0), pages - 1);
  view[pageKey] = page;
  box.textContent = "";
  for (const x of items.slice(page * per, page * per + per)) box.appendChild(renderRow(x));
  const go = (pg) => { view[pageKey] = Math.max(0, Math.min(pages - 1, pg)); sfx("select"); rerender(); };
  const old = head.querySelector(".wpc-pager");
  const pg = pager(page, pages, go);
  if (old) old.replaceWith(pg); else head.appendChild(pg);
  // 左右に払っても頁を送る (横に流れる品の帯の上では送らない)
  if (pages > 1) {
    let x0 = null, y0 = null, skip = false;
    box.addEventListener("pointerdown", (e) => {
      const strip = e.target && e.target.closest ? e.target.closest(".wpc-drow-tiles") : null;
      skip = !!(strip && strip.scrollWidth > strip.clientWidth + 2);
      x0 = e.clientX; y0 = e.clientY;
    });
    box.addEventListener("pointerup", (e) => {
      if (x0 == null || skip) { x0 = null; return; }
      const dx = e.clientX - x0, dy = e.clientY - y0;
      x0 = null;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 2) go(page + (dx < 0 ? 1 : -1));
    });
  }
}

// 人業ごとの持ち物の行 (高さ一定): 見出し (名・控え・数・売値) + 品の札の帯 (はみ出せば横に流れる)
function dollRow(d) {
  const sec = el("section", "wpc-drow" + (isReserve(d) ? " reserve" : "") + (d.alive ? "" : " dead"));
  const hd = el("div", "wpc-drow-h");
  hd.appendChild(dollIcon(d));
  hd.appendChild(el("span", "wpc-doll-nm", d.name));
  if (isReserve(d)) hd.appendChild(el("span", "wpc-tag", "控え"));
  if (!d.alive) hd.appendChild(el("span", "wpc-tag dead", "砕けている"));
  hd.appendChild(el("span", "wpc-doll-cnt", `${d.items.length}/${MAX_ITEMS}`));
  const sv = d.items.filter((it) => !it.unidentified).reduce((a, it) => a + game.sellPrice(it), 0);
  if (d.items.length) {
    const s = el("span", "wpc-doll-sum");
    s.appendChild(goldEl(shortN(sv)));
    hd.appendChild(s);
  }
  sec.appendChild(hd);
  const tiles = el("div", "wpc-drow-tiles");
  if (d.items.length) for (const it of d.items) tiles.appendChild(cell(it, d));
  else tiles.appendChild(el("span", "wpc-bag-empty", "持ち物なし"));
  sec.appendChild(tiles);
  return sec;
}

function renderSell(wrap) {
  const unid = unidList();
  const junk = junkList();
  const aff = affordable(unid);
  const unidTotal = unid.reduce((a, x) => a + x.cost, 0);
  const junkGold = junk.reduce((a, x) => a + x.price, 0);
  const upN = upgradeKeeps().length;

  // ---- まとめての札 (2つの決め手を横に並べる) ----
  const card = el("section", "wpc-bulk");
  const row = el("div", "wpc-bulk-row2");
  const cheapest = unid.length ? Math.min(...unid.map((x) => x.cost)) : 0;
  const idSub = !unid.length ? "未鑑定なし"
    : !aff.n ? `金貨不足 (💰${shortN(cheapest)}〜)`
    : aff.n < unid.length ? `${aff.n}/${unid.length}点 ・ 💰${shortN(aff.cost)}` : `${unid.length}点 ・ 💰${shortN(unidTotal)}`;
  const idBtn = button({ label: "まとめて鑑定", sub: idSub, kind: unid.length && aff.n ? "primary" : "secondary", disabled: !aff.n, onTap: () => confirmIdentifyAll() });
  idBtn.dataset.bulk = "identify";
  row.appendChild(idBtn);
  const sellSub = junk.length ? `${junk.length}点 ・ 💰+${shortN(junkGold)}` : (upN ? `装備候補${upN}点は残す` : "売れる品なし");
  const sellBtn = button({ label: "まとめて売る", sub: sellSub, kind: junk.length ? "primary" : "secondary", disabled: !junk.length && !upN, onTap: () => confirmSellJunk() });
  sellBtn.dataset.bulk = "sell";
  row.appendChild(sellBtn);
  card.appendChild(row);
  const ex = exclusions();
  const kept = EXCL.map((e) => [e, ex.groups[e.key].length]).filter(([, n]) => n);
  const exb = el("button", "wpc-exbtn");
  exb.type = "button";
  const exl = el("span", "wpc-exbtn-t");
  exl.appendChild(el("span", "wpc-keep-dot"));
  const short = { upgrade: "装備候補▲", rare: "SR・LR", misc: "未奉納", cursed: "呪い", unid: "未鑑定", use: "道具" };
  exl.appendChild(document.createTextNode(kept.length
    ? `残す: ${kept.map(([e, n]) => `${short[e.key]}${n}`).join("・")}`
    : "SR・LR・未奉納・呪い・未鑑定・道具・装備中は売らない"));
  exb.appendChild(exl);
  exb.appendChild(el("span", "wpc-exbtn-more", "内訳"));
  exb.addEventListener("click", () => { sfx("select"); openExclusions(); });
  card.appendChild(exb);
  wrap.appendChild(card);

  // ---- 全員の持ち物 (隊 → 控え)。箱に収まる人数で頁を切る ----
  const dolls = allDolls().filter((d) => d && !d.isEmpty);
  const nItems = dolls.reduce((a, d) => a + d.items.length, 0);
  const head = el("div", "wpc-lhead");
  head.appendChild(el("span", "wpc-lhead-t", `持ち物 ${nItems}点`));
  head.appendChild(el("span", "wpc-lhead-s", "押せば売る・鑑定・装備"));
  wrap.appendChild(head);
  const box = el("div", "wpc-list sell");
  wrap.appendChild(box);
  return () => {
    if (!nItems) { box.appendChild(el("div", "wpc-empty big", "持ち物は空だ。迷宮で拾った品はここで鑑定し、売って金に換える。")); return; }
    fillPaged(box, head, dolls, dollRow, "sellPage");
  };
}

function renderBuy(wrap) {
  const cat = catOf();
  const wcat = wcatOf();
  const ids = listFor(cat, wcat);
  const head = el("div", "wpc-lhead");
  head.appendChild(el("span", "wpc-lhead-t", cat === "rec" ? `おすすめ ${ids.length}点` : `棚 ${ids.length}点`));
  if (cat === "weapon") {
    // 武器の種別は1列のチップを増やさず、小さな選び札で絞る
    const label = wcat === "all" ? "すべて" : (WEAPON_CATS.find((c) => c.key === wcat) || {}).label || "すべて";
    const kb = el("button", "wpc-kindbtn");
    kb.type = "button";
    kb.appendChild(el("span", "wpc-kindbtn-l", "種別"));
    kb.appendChild(el("span", "wpc-kindbtn-v", label));
    kb.appendChild(caretIcon("wpc-caret in"));
    kb.addEventListener("click", () => openWeaponKind());
    head.appendChild(kb);
  }
  wrap.appendChild(head);
  const box = el("div", "wpc-list buy");
  wrap.appendChild(box);
  return () => {
    if (!ids.length) {
      box.appendChild(el("div", "wpc-empty big", cat === "rec" ? "いまの隊の装備に勝る品は、棚に並んでいない。" : "この種類の品は売り切れだ。"));
      return;
    }
    fillPaged(box, head, ids, stockRow, "buyPage");
  };
}

// 武器の種別を選ぶ (小さなシート)
function openWeaponKind() {
  const cur = wcatOf();
  const body = el("div", "wpc-kindgrid");
  let h = null;
  for (const c of [{ key: "all", label: "すべて" }, ...WEAPON_CATS]) {
    const n = listFor("weapon", c.key).length;
    const b = button({ label: c.label, sub: `${n}点`, kind: c.key === cur ? "primary" : "secondary", disabled: !n && c.key !== "all",
      onTap: () => { remember("seg", "shopWeapon", c.key); view.buyPage = 0; h.close("pick", { silent: true }); sfx("select"); rerender(); } });
    body.appendChild(b);
  }
  h = sheet.open({ kind: "choice", banner: "武器の種別", body, className: "wpc-pick", footer: [{ label: "閉じる", kind: "ghost", onTap: (x) => x.close() }] });
  return h;
}

function render(root) {
  upCache.clear(); // 描くたびに見立て直す (装備の付け替え直後でも正しく)
  const seg = segOf();
  const wrap = el("div", "wpc-shop seg-" + seg);
  wrap.appendChild(keeperLine(seg));
  const bar = el("div", "wpc-bar");
  const unid = unidCount();
  bar.appendChild(segmented(
    [{ key: "sell", label: "売る・鑑定", badge: unid || null }, { key: "buy", label: "買う" }],
    seg, (k) => { setPref("shopSeg", k); sfx("select"); rerender({ top: true }); },
  ));
  if (seg === "buy") {
    const rec = recList().length;
    const cat = catOf();
    const items = [{ key: "rec", label: "おすすめ", badge: rec || null }, ...ITEM_CATS.map((c) => ({ key: c.key, label: c.label }))];
    const cc = chips(items, cat, (k) => { setPref("shopBuyCat", k); view.buyPage = 0; sfx("select"); rerender({ top: true }); });
    cc.classList.add("wpc-cats");
    bar.appendChild(cc);
  }
  wrap.appendChild(bar);
  const fill = seg === "buy" ? renderBuy(wrap) : renderSell(wrap);
  root.appendChild(wrap);
  // 置いてから高さを測って頁を切る
  try { fill(); } catch (e) { setTimeout(() => { throw e; }); }
}

// 商会を開く (seg: "sell" | "buy"、cat: 買うの分類)
export function openShop(seg, { cat } = {}) {
  if (seg === "sell" || seg === "buy") setPref("shopSeg", seg);
  if (cat) { setPref("shopBuyCat", cat); view.buyPage = 0; }
  const g = G();
  if (!g || g.state !== "town") return false;
  const t = g.town || {};
  if (t.tab === "shop" && !t.facility && !t.page) { rerender({ top: true }); return true; }
  return UI.shell && UI.shell.setTab ? UI.shell.setTab("shop") : false;
}

export function install() {
  registerUI({
    openShop,
    unidCount,
    junkList,
    // まとめて売る (確認なし)。既定は装備の候補を残す。{ keepUpgrades:false } で ops と同じ集合 (装備中の品は二重に守る)
    sellJunkAll: (opts) => sellJunk(junkList(opts)),
    shopBuy,
    confirmSellJunk,
    confirmIdentifyAll,
    shopExclusions: exclusions,
    renderShopInto: (root) => render(root),
  });
  if (UI.shell && UI.shell.registerTab) {
    UI.shell.registerTab("shop", { render: (root) => render(root), title: "黒鉄商会" });
  }
  // 画面の大きさが変われば頁の切り方も変わる (商会を開いている時だけ描き直す)
  if (typeof addEventListener === "function") {
    let tm = null;
    addEventListener("resize", () => {
      clearTimeout(tm);
      tm = setTimeout(() => {
        const g = G();
        if (g && g.state === "town" && g.town && g.town.tab === "shop" && !g.town.facility && !g.town.page && game.renderTown) game.renderTown();
      }, 150);
    });
  }
}
