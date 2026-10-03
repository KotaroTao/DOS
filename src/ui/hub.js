// ===== 街 (広場) — 夜景・帰還の報告・いまの目標・次にすべきこと・酒場/宿屋/祠の札・隊の札 =====
// 担当: WP-A。街タブの描画 (UI.shell.registerTab("hub", …))。見出しは夜景に重ねる (シェルの見出しは出さない)。
// 画面は1枚に収める (縦にスクロールさせない)。背の低い端末では「次にすべきこと・街の札」の段だけが内側で流れる。
//   夜景       … 生かしたまま使い回す (api.keep)。名所の札は 44px 以上の押せる場所。帰還の報告がある時は細い帯に畳む
//   帰還の報告 … UI.renderRunReport(host) (WP-D)。無ければ出さない
//   いまの目標 … その場で果たせる操作つき (謁見する / 仕立てる / 王に報告する / 拝命する / 出撃)
//   次にすべきこと … 優先順に最大3つ (3列の札)。1タップで実行 (売る・赤い魂を使うものは確認のシートを1枚)。
//                   UI.registerSuggestion(fn) で他のパッケージも足せる
//   酒場/宿屋/祠 … 宿屋の札は1タップで泊まる (詳細は長押し・泊まれない時はシート)
//   隊の札     … タップでその人業の隊の画面 (UI.openParty(idx))
// 提供: UI.registerSuggestion(fn) / UI.renderHub(root) (旧来の renderTownHub が委ねる)
// game.js は import しない (ctx.js の UI / game / ops を通す)。

import { UI, game, ops, registerUI } from "./ctx.js";
import { el, setText, glyph, svgIcon, button, portrait, longPress, itemTile } from "./kit.js";
import { createTownScene, townSpots, vignetteCanvas } from "../townart.js";
import { SFX } from "../audio.js";
import { ITEMS } from "../items.js";
import { currencyBar, sectionHead, facilityOpen, lockedToast, restOrDetail, openInn, innStatus, dismissGreet, runDelivery } from "./facilities.js";

const sfx = (k) => { try { if (SFX[k]) SFX[k](); } catch (e) { /* noop */ } };
const G = () => game.G;

// ---------- 次にすべきこと (提案) ----------
// 提案: { key, prio, label, short?, sub?, cost?:{kind,n}, icon?:"gold"|"soul"|"red"|svgKey, tone?, run(), hold?() }
// prio が小さいほど先 (砕けた人業 -2 > 連れ帰り -1 > 勅命 0 > 手負い 20 > 未鑑定 30 > 売れる品 40 > より良い装備 50 > 魂融合 55 > 鍛錬 60 > 勲章 70 > 奉納 80)
// 札は3列に並ぶので label は短く (5字ほど。長い時は3枚並びで使う short を添える)、詳しくは sub に
const extra = []; // 他のパッケージが登録した提案の源 (fn(counts) → 提案 | 提案[] | null)
export function registerSuggestion(fn) { if (typeof fn === "function" && !extra.includes(fn)) extra.push(fn); }
// 帰還の報告の札が受け持つ操作 (報告がある間は「次にすべきこと」に重ねて出さない)
// 砕けた人業の修復・連れ帰りは最優先なので、報告があっても「次にすべきこと」の先頭に出す
const REPORT_KEYS = new Set(["rest", "identify", "sell", "autoEquip"]);

function confirmThen({ banner, title, lines, okLabel, run }) {
  if (!UI.confirm) return run();
  UI.confirm({ banner, title, lines, okLabel, danger: false }).then((ok) => { if (ok) run(); });
}

function builtinSuggestions(c) {
  const g = G();
  const out = [];
  if (!c) return out;
  // 砕けた人業 (街にある器): 人業の館で砕けた魂を修復する (館を開き、砕けた人業を選んだ状態にする)。何よりも先に出す
  if (c.repairable) {
    const all = game.allDolls ? game.allDolls() : (g.party || []);
    const d = all.find((x) => x && x.isDoll && !x.alive && !x.reviveAt) || null;
    out.push({ key: "repair", prio: -2, label: "魂を修復", sub: `砕けた人業 ${c.repairable}`, cost: { kind: "gold", n: c.repairCost || 0 }, tone: "red", icon: "red",
      run: () => { if (UI.openParty) UI.openParty(d, { context: "town" }); } });
  }
  // 全滅で迷宮に残された器: 赤い魂で今すぐ連れ帰る (確認のシート)
  if (c.rescuing && c.hastenCost > 0 && g.redSoul >= 1) {
    const pay = Math.min(c.hastenCost, g.redSoul);
    out.push({ key: "hasten", prio: -1, label: "連れ帰る", sub: `連れ帰り待ち ${c.rescuing}`, cost: { kind: "red", n: pay }, tone: "red", icon: "red",
      run: () => confirmThen({ banner: "今すぐ連れ帰る", title: `赤い魂 ${pay} を捧げ、迷宮に残された人業を連れ帰りますか？`,
        lines: [c.hastenCost > g.redSoul ? `全員の連れ帰りには 🔴${c.hastenCost} が要る。足りる分だけ早める。` : "1つにつき連れ帰りまでの時間を20分縮める (押す回数ぶんと同じ値段)。", "届いた器は、館で金貨を払って修復する。"],
        okLabel: "連れ帰る", run: () => ops.hastenAll() }) });
  }
  // 手負い: 宿で休む (1タップ)
  if (c.hurt && facilityOpen("inn") && g.gold >= c.innCost) {
    out.push({ key: "rest", prio: 20, label: "宿で休む", sub: `手負い ${c.hurt}`, cost: { kind: "gold", n: c.innCost }, icon: "rest", run: () => ops.restParty() });
  }
  // 未鑑定: まとめて鑑定 (商会 (WP-C) の確かめのシート → 正体を明かすシート。無ければ1タップ・安い順に所持金の続く限り)
  // 鑑定の心得のある者がいれば、まず隊の技で試みる (商会の「まとめて鑑定」は試せない品が残った時)
  let unid = c.unid || 0;
  try { if (UI.unidCount) unid = UI.unidCount() || 0; } catch (e) { unid = c.unid || 0; }
  let tryId = null;
  try { tryId = UI.tryIdentifyInfo ? UI.tryIdentifyInfo() : null; } catch (e) { tryId = null; }
  if (tryId) {
    out.push({ key: "identify", prio: 30, label: "鑑定を試みる", short: "鑑定する", sub: `${tryId.n}点 ・ ${tryId.top.m.name}`, icon: "seal",
      run: () => UI.openTryIdentifyAll() });
  } else if (unid && facilityOpen("shop")) {
    out.push({ key: "identify", prio: 30, label: "まとめて鑑定", short: "鑑定する", sub: `未鑑定 ${unid}`, cost: { kind: "gold", n: c.unidCost }, icon: "seal",
      run: () => (UI.confirmIdentifyAll ? UI.confirmIdentifyAll() : (UI.identifyAll || ops.identifyAll)()) });
  }
  // 売れる品: まとめて売る (商会 (WP-C) の確かめのシート: 装備の候補を残す守りつき)
  let junk = null;
  try { junk = UI.junkList ? UI.junkList() : null; } catch (e) { junk = null; }
  const junkN = junk ? junk.length : (c.junk || 0);
  const junkGold = junk ? junk.reduce((a2, j) => a2 + (j.price || 0), 0) : (c.junkGold || 0);
  if (junkN && facilityOpen("shop")) {
    out.push({ key: "sell", prio: 40, label: "まとめて売る", short: "売り払う", sub: `${junkN}点`, cost: { kind: "gold", n: "+" + junkGold }, icon: "coin",
      run: () => (UI.confirmSellJunk ? UI.confirmSellJunk() : confirmThen({ banner: "まとめて売る", title: `${junkN}点を売り、金貨 ${junkGold} を得ますか？`,
        lines: ["装備中・呪い・未鑑定・SR/LR・未奉納の収集品・道具は売らない。", "売った品は商会の棚に並ぶ (買い戻せる)。"],
        okLabel: "売る", run: () => (UI.sellJunkAll || ops.sellJunkAll)() })) });
  }
  // より良い装備 (WP-B の最適装備)
  let better = 0;
  try { better = UI.betterGearCount ? (UI.betterGearCount() || 0) : 0; } catch (e) { better = 0; }
  if (better > 0 && facilityOpen("mansion") && UI.autoEquip) {
    out.push({ key: "autoEquip", prio: 50, label: "最適装備", sub: `より良い品 ${better}`, icon: "party", run: () => UI.autoEquip("all") });
  }
  // 魂融合できる魂 (同じ職の魂が余っている)。タップで融合させる魂を選ぶシート、長押しで隊の魂の区分
  let fl = [];
  try { fl = UI.fusableList ? (UI.fusableList() || []) : []; } catch (e) { fl = []; }
  if (fl.length && facilityOpen("mansion") && UI.openFusePicker) {
    const f = fl[0];
    const idx = (g.party || []).indexOf(f.doll);
    out.push({ key: "fuse", prio: 55, label: "魂融合", sub: `${f.name} ×${f.n}`, icon: "soul",
      run: () => UI.openFusePicker(f.uid),
      hold: () => { if (UI.openParty) UI.openParty(f.doll || Math.max(0, idx), { seg: "soul" }); } });
  }
  // 鍛えられる魂 (1タップで1段。長押しで隊の魂の画面)。隊のレベルが揃うよう、いちばん低いLvの魂だけを勧める
  // (その魂に ✦ が足りなければ、高いLvの魂を先に鍛えはしない)
  let tl = [];
  try { tl = UI.trainableList ? (UI.trainableList() || []) : []; } catch (e) { tl = []; }
  const t = tl.find((x) => x.lowest !== false);
  if (t && facilityOpen("mansion")) {
    const idx = (g.party || []).indexOf(t.doll);
    // 1段鍛える (WP-B の train は新たな技もトーストで知らせる)。長押しで隊の魂の区分 (上限まで鍛えるなど)
    out.push({ key: "train", prio: 60, label: "魂を強化", sub: `${t.doll ? t.doll.name : ""} Lv${t.level}→${t.level + 1}`, cost: { kind: "soul", n: t.cost }, icon: "soul",
      run: () => (typeof t.train === "function" ? t.train(1) : ops.trainTimes(t.uid, 1)),
      hold: () => { if (UI.openParty) UI.openParty(t.doll || Math.max(0, idx), { seg: "soul" }); } });
  }
  // 勲章: 王宮の勲章の区分へ (どれを受け取るかは勲章の画面で選ぶ楽しみとして残す)
  if (c.ach) out.push({ key: "ach", prio: 70, label: "勲章を拝受", sub: `${c.ach} 個`, icon: "medal", run: () => { if (UI.openPalace) UI.openPalace("ach"); } });
  // 宝物庫: 収集品を奉納 → 王宮の宝物庫へ (奉納する品はそこで確かめてから納める) / 褒賞だけ残っている
  if (c.donatable) {
    out.push({ key: "donate", prio: 80, label: "収集品を奉納", sub: `${c.donatable} 種`, icon: "treasury",
      run: () => { if (UI.openPalace) UI.openPalace("treasury"); } });
  } else if (c.treasuryReady) {
    out.push({ key: "treasury", prio: 80, label: "褒賞を受け取る", short: "褒賞を拝受", sub: "宝物庫", icon: "treasury", run: () => game.claimNextTreasury && game.claimNextTreasury() });
  }
  // 納品依頼は街の広場に常に札を並べる (deliveries) ので、ここには出さない
  return out;
}

export function suggestions(max = 3, { exclude = null } = {}) {
  let c = null;
  try { c = ops.counts ? ops.counts() : null; } catch (e) { c = null; }
  const all = builtinSuggestions(c);
  for (const fn of extra) {
    try {
      const r = fn(c);
      if (Array.isArray(r)) all.push(...r.filter(Boolean)); else if (r) all.push(r);
    } catch (e) { setTimeout(() => { throw e; }); }
  }
  const seen = new Set();
  return all.filter((s) => s && typeof s.run === "function" && !(exclude && exclude.has(s.key)) && !seen.has(s.key) && seen.add(s.key))
    .sort((a, b) => (a.prio || 99) - (b.prio || 99)).slice(0, max);
}

// 提案の札の印 (SVG の線画 or 通貨の印)
const SUG_SVG = {
  rest: '<path d="M4 18V8"/><path d="M4 14h16v4"/><path d="M20 14v-2a3 3 0 0 0-3-3h-6v5"/><circle cx="7.5" cy="11" r="1.6"/>',
  seal: '<circle cx="12" cy="10" r="5.5"/><path d="M12 7.6v2.6l1.8 1.2"/><path d="M9 15l-1.5 6 4.5-2.4 4.5 2.4L15 15"/>',
  coin: '<ellipse cx="12" cy="7" rx="7" ry="3"/><path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7"/><path d="M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5"/>',
  medal: '<path d="M8 3l4 6 4-6"/><circle cx="12" cy="15" r="5.5"/><path d="M12 12.2l.9 1.9 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3Z"/>',
  treasury: '<rect x="3.5" y="9" width="17" height="11" rx="1"/><path d="M3.5 13h17"/><path d="M5 9c0-3 3-5 7-5s7 2 7 5"/><path d="M11 12h2v3h-2z"/>',
  tavern: '<path d="M6 4h9v15a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1Z"/><path d="M15 8h2.5a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H15"/><path d="M6 8h9"/>',
};
function sugIcon(k) {
  if (!k) return null;
  if (k === "gold" || k === "soul" || k === "red") return glyph(k);
  if (SUG_SVG[k]) {
    const sv = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    sv.setAttribute("viewBox", "0 0 24 24");
    sv.setAttribute("aria-hidden", "true");
    sv.setAttribute("class", "hb-sug-ic");
    sv.innerHTML = SUG_SVG[k];
    return sv;
  }
  try { return svgIcon(k, "hb-sug-ic"); } catch (e) { return null; }
}

function sugChip(s, narrow) {
  const b = el("button", "hb-sug" + (s.tone ? " t-" + s.tone : ""));
  b.type = "button";
  const top = el("span", "hb-sug-top");
  const ic = sugIcon(s.icon || (s.cost && s.cost.kind));
  if (ic) { const w = el("span", "hb-sug-icw"); w.appendChild(ic); top.appendChild(w); }
  // 3枚並びの狭い札では短い名 (short) を使い、2行に折れないようにする
  top.appendChild(setText(el("span", "hb-sug-l"), (narrow && s.short) || s.label));
  b.appendChild(top);
  const bot = el("span", "hb-sug-bot");
  if (s.sub) bot.appendChild(setText(el("span", "hb-sug-s"), s.sub));
  if (s.cost != null) {
    const c = el("span", "hb-sug-cost");
    if (typeof s.cost === "object") { c.appendChild(glyph(s.cost.kind || "gold")); c.appendChild(document.createTextNode(String(s.cost.n))); }
    else c.appendChild(document.createTextNode(String(s.cost)));
    bot.appendChild(c);
  }
  if (bot.childElementCount) b.appendChild(bot);
  b.setAttribute("aria-label", [s.label, s.sub].filter(Boolean).join(" "));
  b.addEventListener("click", () => { sfx("select"); s.run(); });
  if (s.hold) longPress(b, () => s.hold());
  return b;
}

// ---------- 夜景 ----------
const SPOTS = [
  { k: "palace", label: "王宮" },
  { k: "mansion", label: "人業の館" },
  { k: "tavern", label: "酒場" },
  { k: "shop", label: "商会" },
  { k: "shrine", label: "祠" },
  { k: "crypt", label: "迷宮の口" },
];
function spotGo(k) {
  if (k === "crypt") return UI.shell.openGate();
  if (k === "palace") { sfx("select"); return UI.openPalace(game.palaceCallReady && game.palaceCallReady() ? "decree" : null); }
  if (k === "mansion") return UI.shell.setTab("party");
  if (k === "shop") return UI.shell.setTab("shop");
  if (!facilityOpen(k)) return lockedToast();
  sfx("select");
  if (k === "inn") return openInn();
  if (k === "tavern" || k === "shrine") return UI.shell.openPage(k);
}
function spotOpen(k) {
  if (k === "crypt") return (G().unlockedDungeons || 0) >= 1;
  if (k === "palace") return true;
  return facilityOpen(k);
}

// 夜景の箱は低く切り詰める。絵 (240x170) は下端に揃えた「舞台」に敷き、名所の札は舞台の座標で置く (切れても位置がずれない)
function hero(api, { collapsed = false, width = 390 } = {}) {
  const g = G();
  const h = el("div", "tw-hero hb-hero" + (collapsed ? " collapsed" : ""));
  const stage = el("div", "hb-stage");
  // 箱の高さ (画面の高さの約31%) と、絵の切り出し位置。名所の札の帯 (いちばん上の札 〜 いちばん下の札の根元) が
  // 見出し (⚙・通貨) の下から、いまの目標の札 (背の高い端末では 16px 重なる) の上までに収まるようにする
  let spots = {};
  try { spots = townSpots(); } catch (e) { spots = {}; }
  const ys = SPOTS.map((s) => spots[s.k] && spots[s.k].y).filter((y) => typeof y === "number");
  const yTop = ys.length ? Math.min(...ys) : 0.39, yBot = ys.length ? Math.max(...ys) : 0.72;
  const vh = (typeof innerHeight === "number" && innerHeight) || 844;
  const overlap = vh < 700 ? 0 : 16;
  const stageH = width * 170 / 240;
  const topBand = 84 - stageH * yTop;                      // いちばん上の札 (高さ約32px) を見出しの下へ
  const minH = topBand + stageH * yBot + 6 + overlap;      // いちばん下の札の根元まで見せる
  const want = vh * 0.31 - (vh < 700 ? 40 : 0);
  const heroH = collapsed ? 56 : Math.round(Math.min(stageH, Math.max(140, want, minH), 270));
  const top = collapsed ? -stageH * 0.5 : Math.max(heroH - stageH, topBand);
  h.style.height = heroH + "px";
  stage.style.top = Math.round(Math.min(0, top)) + "px";
  try { const sc = api.keep("townScene", createTownScene); if (sc) stage.appendChild(sc); } catch (e) { /* 演出のみ: 失敗しても街は使える */ }
  h.appendChild(stage);
  // 見出し (夜景に重ねる): ⚙ ・ 題 ・ 通貨
  const bar = el("div", "hb-bar");
  const gear = el("button", "hb-gear");
  gear.type = "button";
  gear.setAttribute("aria-label", "設定");
  gear.appendChild(svgIcon("gear", "hb-gear-ic"));
  gear.addEventListener("click", () => { sfx("select"); if (UI.openSettings) UI.openSettings(); });
  bar.appendChild(gear);
  if (collapsed) bar.appendChild(el("div", "hb-bar-t", "ロアダル"));
  bar.appendChild(currencyBar({ cls: "hb-cur" }));
  h.appendChild(bar);
  if (collapsed) return h;
  const ttl = el("div", "hb-title");
  ttl.appendChild(el("div", "hb-title-k", "辺境の街"));
  ttl.appendChild(el("div", "hb-title-n", "ロアダル"));
  h.appendChild(ttl);
  // 名所の札
  const call = !!(game.palaceCallReady && game.palaceCallReady());
  for (const s of SPOTS) {
    const p = spots[s.k];
    if (!p) continue;
    if (s.k === "crypt" && (g.unlockedDungeons || 0) < 1) continue;
    const open = spotOpen(s.k);
    const b = el("button", "hb-spot hb-spot-" + s.k + (open ? "" : " locked") + (s.k === "palace" && call ? " call" : ""));
    b.type = "button";
    b.style.left = (p.x * 100).toFixed(2) + "%";
    b.style.top = (p.y * 100).toFixed(2) + "%";
    const l = el("span", "hb-spot-l");
    if (!open) l.appendChild(svgIcon("chain", "hb-spot-lock"));
    if (s.k === "palace" && call) l.appendChild(el("i", "hb-spot-dia"));
    l.appendChild(document.createTextNode(s.label));
    b.appendChild(l);
    b.setAttribute("aria-label", s.label + (open ? "" : " (閉ざされている)"));
    b.addEventListener("click", () => spotGo(s.k));
    stage.appendChild(b);
  }
  return h;
}

// ---------- いまの目標 ----------
function objectiveCard(o) {
  const c = el("div", "hb-goal k-" + (o.kind || "palace"));
  const seal = el("div", "hb-goal-seal");
  seal.appendChild(el("span", null, "命"));
  c.appendChild(seal);
  const tx = el("div", "hb-goal-tx");
  tx.appendChild(el("div", "hb-goal-k", "いまの目標"));
  tx.appendChild(setText(el("div", "hb-goal-t"), o.text));
  if (o.sub) tx.appendChild(setText(el("div", "hb-goal-s"), o.sub));
  c.appendChild(tx);
  const b = button({ label: o.act, kind: "primary", size: "sm", icon: o.kind === "gate" ? "gate" : null, onTap: () => { sfx("select"); o.run(); } });
  b.classList.add("hb-goal-go");
  b.appendChild(svgIcon("chevron", "hb-goal-chev"));
  c.appendChild(b);
  return c;
}

// ---------- 酒場・宿屋・祠の札 ----------
function tile(key, name, sub, { onTap, onHold, badge = null, locked = false, cls = "" } = {}) {
  const t = el("button", "hb-tile hb-tile-" + key + (locked ? " locked" : "") + (cls ? " " + cls : ""));
  t.type = "button";
  const a = el("span", "hb-tile-art");
  try { const v = vignetteCanvas(key); if (v) a.appendChild(v); } catch (e) { /* 演出のみ */ }
  t.appendChild(a);
  const cap = el("span", "hb-tile-cap");
  const nm = el("span", "hb-tile-n");
  if (locked) nm.appendChild(svgIcon("chain", "hb-tile-lock"));
  nm.appendChild(document.createTextNode(name));
  cap.appendChild(nm);
  if (sub) cap.appendChild(sub.nodeType ? sub : setText(el("span", "hb-tile-s"), sub));
  t.appendChild(cap);
  if (badge) t.appendChild(el("span", "hb-tile-badge", badge));
  t.setAttribute("aria-label", name + (locked ? " (閉ざされている)" : ""));
  t.addEventListener("click", () => { if (locked) return lockedToast(); if (onTap) onTap(); });
  if (onHold && !locked) longPress(t, onHold);
  return t;
}
function tiles() {
  const g = G();
  const wrap = el("div", "hb-tiles");
  const tav = facilityOpen("tavern");
  const deliverable = (g.deliveryQuests || []).filter((q) => q && game.deliveryHolder && game.deliveryHolder(q.itemId)).length;
  wrap.appendChild(tile("tavern", "酒場", tav ? (deliverable ? `納品できる品 ${deliverable}` : "噂・納品の依頼") : "閉ざされている",
    { locked: !tav, badge: tav && deliverable ? String(deliverable) : null, onTap: () => { sfx("select"); UI.shell.openPage("tavern"); } }));
  const innOk = facilityOpen("inn");
  let innSub = "閉ざされている";
  let innCls = "";
  if (innOk) {
    const st = innStatus();
    if (!st.need.length) innSub = "皆、すこぶる元気";
    else {
      const s = el("span", "hb-tile-s hb-inn-cost");
      s.appendChild(document.createTextNode(st.afford ? "泊まる " : "宿賃 "));
      s.appendChild(glyph("gold"));
      s.appendChild(document.createTextNode(String(st.cost)));
      innSub = s;
      innCls = st.afford ? "ready" : "";
    }
  }
  wrap.appendChild(tile("inn", "宿屋", innSub, { locked: !innOk, cls: innCls, onTap: () => { sfx("select"); restOrDetail(); }, onHold: () => openInn() }));
  const sh = facilityOpen("shrine");
  wrap.appendChild(tile("shrine", "赤い魂の祠", sh ? "赤い魂を授かる" : "閉ざされている",
    { locked: !sh, onTap: () => { sfx("select"); UI.shell.openPage("shrine"); } }));
  return wrap;
}

// ---------- 納品依頼 (酒場が開いていれば街に常に並べる。手持ち/商会の品はその場で納品) ----------
// 「次にすべきこと」と同じ並びの札 (最大3列)。札をタップ = 納品 / 買って納品 (確認1枚) / 品の詳細
function deliveryChip(q) {
  const it = ITEMS[q.itemId];
  const st = (game.deliveryStatus && game.deliveryStatus(q)) || { holder: null, inShop: false, price: 0, canBuy: false };
  const ready = !!(st.holder || st.canBuy);
  const b = el("button", "hb-dlv-c" + (ready ? " ready" : ""));
  b.type = "button";
  const top = el("span", "hb-dlv-top");
  try { top.appendChild(itemTile(it, { size: 44 })); } catch (e) { /* 絵が無くても札は出す */ }
  top.appendChild(game.itemNameEl ? game.itemNameEl("span", "hb-dlv-n", it) : el("span", "hb-dlv-n", it.name));
  b.appendChild(top);
  const bot = el("span", "hb-dlv-bot");
  if (st.holder) {
    bot.appendChild(el("span", "hb-dlv-s", "手持ち"));
    bot.appendChild(el("span", "hb-dlv-go", "納品する"));
  } else if (st.inShop) {
    bot.appendChild(el("span", "hb-dlv-s", st.canBuy ? "商会" : "金不足"));
    const c = el("span", "hb-dlv-go" + (st.canBuy ? "" : " off"));
    c.appendChild(glyph("gold"));
    c.appendChild(document.createTextNode(String(st.price)));
    bot.appendChild(c);
  } else {
    bot.appendChild(el("span", "hb-dlv-s", "未入手"));
  }
  b.appendChild(bot);
  b.setAttribute("aria-label", `納品依頼 ${it.name}`);
  b.addEventListener("click", () => runDelivery(q));
  return b;
}
function deliveries() {
  const g = G();
  if (!facilityOpen("tavern")) return null;
  if (game.ensureDeliveryQuests) game.ensureDeliveryQuests();
  const qs = (g.deliveryQuests || []).filter((q) => q && ITEMS[q.itemId]);
  const box = el("div", "hb-dlv");
  box.appendChild(sectionHead("納品依頼", { note: "潜るたびに入れ替わる" }));
  if (qs.length) {
    const list = el("div", "hb-sug-list n" + Math.min(3, qs.length));
    for (const q of qs.slice(0, 3)) list.appendChild(deliveryChip(q));
    box.appendChild(list);
  } else {
    box.appendChild(el("div", "wa-empty hb-dlv-empty", "今は納品依頼がない。迷宮に潜れば、新たな品が求められる。"));
  }
  return box;
}

// ---------- 隊の札 ----------
function partyStrip() {
  const g = G();
  const box = el("div", "hb-party");
  const canOpen = facilityOpen("mansion");
  const more = el("button", "hb-more");
  more.type = "button";
  more.appendChild(document.createTextNode("パーティを見る"));
  more.appendChild(svgIcon("chevron", "hb-more-ic"));
  more.addEventListener("click", () => UI.shell.setTab("party"));
  box.appendChild(sectionHead("パーティ", { note: `${(g.party || []).length}/6`, right: canOpen && (g.party || []).length ? more : null }));
  if (!(g.party || []).length) {
    const e = el("div", "hb-party-empty");
    const ms = g.msq || {};
    const granted = !(ms.n === 0 && ms.state === "active" && !ms.granted);
    e.appendChild(setText(el("div", "hb-party-empty-t"), granted ? "人業がいない。器に魂を宿して、人業を仕立てよう。" : "人業がいない。まずは王宮で、王に謁見しよう。"));
    if (granted && canOpen) e.appendChild(button({ label: "人業を仕立てる", kind: "secondary", size: "sm", onTap: () => game.goMakeDoll() }));
    box.appendChild(e);
    return box;
  }
  const row = el("div", "hb-party-row n" + g.party.length);
  g.party.forEach((d, i) => {
    const c = el("button", "hb-pc" + (d.alive ? "" : " dead") + (i >= 3 ? " back" : ""));
    c.type = "button";
    // 肖像は隊の画面と同じ描き方 (UI.partyPortraitCanvas)。無ければキットの肖像
    if (UI.partyPortraitCanvas) {
      const fr = el("span", "hb-pc-fr");
      try { fr.appendChild(UI.partyPortraitCanvas(d, 40)); } catch (e) { /* 絵が無くても動く */ }
      if (!d.alive) fr.appendChild(el("span", "hb-pc-dead", "†"));
      c.appendChild(fr);
    } else c.appendChild(portrait(d, { size: 48, hp: false }));
    c.appendChild(el("span", "hb-pc-n", d.name));
    if (d.alive) {
      const r = Math.max(0, Math.min(1, d.hp / Math.max(1, d.maxhp)));
      const hp = el("span", "hb-pc-hp" + (r < 0.34 ? " low" : r < 1 ? " hurt" : ""));
      const f = el("i"); f.style.width = (r * 100).toFixed(1) + "%"; hp.appendChild(f);
      c.appendChild(hp);
    } else if (d.reviveAt && game.reviveTimerEl) {
      c.appendChild(game.reviveTimerEl("span", "hb-pc-rv", "連れ帰り ", d));
    } else {
      c.appendChild(el("span", "hb-pc-rv", "要修復"));
    }
    c.setAttribute("aria-label", `${d.name} ${d.cls || ""} ${d.alive ? `HP ${d.hp}/${d.maxhp}` : "砕けている"}`);
    c.addEventListener("click", () => { sfx("select"); if (UI.openParty) UI.openParty(i); });
    row.appendChild(c);
  });
  box.appendChild(row);
  return box;
}

// ---------- 街タブの描画 (1画面に収める) ----------
export function renderHub(root, api) {
  const g = G();
  if (!g || !root) return;
  dismissGreet();
  const a = api || { keep: (k, f) => (UI.shell && UI.shell.keep ? UI.shell.keep(k, f) : f()) };
  const wrap = el("div", "hb wa-fit");
  // 帰還の報告 (WP-D)。ある時は夜景を細い帯に畳んで場所を譲る
  const host = el("div", "hb-report");
  let node = null;
  try { node = UI.renderRunReport ? UI.renderRunReport(host) : null; } catch (e) { node = null; setTimeout(() => { throw e; }); }
  if (node && node.nodeType && node.parentNode !== host) host.appendChild(node);
  const hasReport = host.childElementCount > 0;
  wrap.appendChild(hero(a, { collapsed: hasReport, width: root.clientWidth || 390 }));
  if (hasReport) {
    wrap.appendChild(host);
    // 報告を閉じたら (×) 夜景を広げて描き直す
    host.addEventListener("click", (e) => {
      if (!e.target.closest || !e.target.closest(".rr-x")) return;
      queueMicrotask(() => { if (!host.querySelector(".rr-card") && game.renderTown) game.renderTown(); });
    });
  }
  // いまの目標
  const o = game.objectiveInfo ? game.objectiveInfo() : null;
  if (o) wrap.appendChild(objectiveCard(o));
  // 次にすべきこと + 街の札 (背の低い端末ではこの段だけが内側で流れる)
  const mid = el("div", "hb-mid");
  const sg = suggestions(3, { exclude: hasReport ? REPORT_KEYS : null });
  if (sg.length) {
    const box = el("div", "hb-sugs");
    box.appendChild(sectionHead("次にすべきこと"));
    const list = el("div", "hb-sug-list n" + sg.length);
    for (const s of sg) list.appendChild(sugChip(s, sg.length >= 3));
    box.appendChild(list);
    mid.appendChild(box);
  }
  const dv = deliveries();
  if (dv) mid.appendChild(dv);
  // 納品依頼の段がある時は「街」の見出しを省いて札の高さを守る (札は絵と名で何かわかる)
  const fac = el("div", "hb-fac" + (dv ? " nohead" : ""));
  if (!dv) fac.appendChild(sectionHead("街"));
  fac.appendChild(tiles());
  mid.appendChild(fac);
  wrap.appendChild(mid);
  // 隊
  wrap.appendChild(partyStrip());
  root.appendChild(wrap);
  growTiles(mid);
}

// 背の高い画面で余った高さは街の札を背高にして埋める (札と隊のあいだに空白の帯を残さない)
function growTiles(mid) {
  if (!mid || !mid.isConnected) return;
  const tl = mid.querySelectorAll(".hb-tile");
  const last = mid.lastElementChild;
  if (!tl.length || !last) return;
  const used = last.getBoundingClientRect().bottom - mid.getBoundingClientRect().top;
  const spare = Math.floor(mid.clientHeight - used - 2);
  if (spare < 8) return;
  const h0 = tl[0].getBoundingClientRect().height;
  const h = Math.min(144, Math.round(h0 + spare));
  if (h <= h0) return;
  for (const t of tl) t.style.height = h + "px";
}

export function install() {
  // Phase 0 のスタブに積まれていた提案の源を引き継ぐ
  for (const fn of (UI._suggestions || [])) registerSuggestion(fn);
  registerUI({ registerSuggestion, renderHub: (root) => renderHub(root), suggestions });
  if (UI.shell) UI.shell.registerTab("hub", { title: "街", header: false, render: (root, api) => renderHub(root, api) });
}
