// ===== 街の施設 — 酒場・赤い魂の祠 (ページ) / 宿屋 (シート) / 番人のささやき / 通貨の説明 / 共通の小部品 =====
// 担当: WP-A。酒場と祠は街タブの1段下のページ (ヘッダの ‹ で街へ戻る)。宿屋は街の札から1タップで泊まり、詳細はシート。
// 長い一覧は残りの高さの箱の中で縦にスクロールする (scrollGrid)。
// 番人は見出しの下の1行 (胸像の小窓 + ひとこと。タップで胸像のシート)。その街滞在で初めて訪れた時だけ、
// その行が大きな胸像と吹き出しになって挨拶する (次に描き直す時は1行に畳む)。
// 酒場の依頼の札・シートは questboard.js。品 (納品の依頼・宝物庫・図鑑) を選ぶと、持っている品は UI.itemSheet (WP-C) でその場で装備・譲渡できる。
// 提供: UI.keeperWhisper(key) / UI.keeperSheet(key) / UI.currencySheet(kind) / UI.openInn() / ページ "tavern" "shrine"
// game.js は import しない (ctx.js の UI / game / ops を通す)。

import { UI, game, ops, registerUI } from "./ctx.js";
import { el, setText, glyph, svgIcon, sheet, button, whisper, itemTile, portrait, bar, toast, confirm, segmented } from "./kit.js";
import { questCard, dungeonGroups, lists as qbLists, isReady as qbReady } from "./questboard.js";
import { getPref, setPref } from "./prefs.js";
import { keeperCanvas, vignetteCanvas } from "../townart.js";
import { ITEMS } from "../items.js";
import { SFX } from "../audio.js";

const sfx = (k) => { try { if (SFX[k]) SFX[k](); } catch (e) { /* noop */ } };
const G = () => game.G;

// ---------- 共通の小部品 ----------
// 金の菱の見出し (右に小さな付記・操作を置ける)
export function sectionHead(title, { note = null, right = null, cls = "" } = {}) {
  const h = el("div", "wa-h" + (cls ? " " + cls : ""));
  h.appendChild(el("i", "wa-dia"));
  h.appendChild(setText(el("span", "wa-h-t"), title));
  if (note != null) h.appendChild(setText(el("span", "wa-h-n"), String(note)));
  h.appendChild(el("span", "wa-h-rule"));
  if (right) h.appendChild(right);
  return h;
}
// 鎖で閉ざされた行 (未解放の機能)
export function lockedRow(title, sub) {
  const r = el("div", "wa-locked");
  r.appendChild(svgIcon("chain", "wa-locked-ic"));
  const t = el("div", "wa-locked-t");
  t.appendChild(setText(el("div", "wa-locked-h"), title));
  if (sub) t.appendChild(setText(el("div", "wa-locked-s"), sub));
  r.appendChild(t);
  return r;
}
// 施設が開いているか (第0章の間は王宮/館のみ)
export function facilityOpen(key) {
  let a = null;
  try { a = game.tutorialAllowed ? game.tutorialAllowed() : null; } catch (e) { a = null; }
  return !a || a.includes(key);
}
export function lockedToast() { sfx("ng"); toast("王命を果たすまで閉ざされている", { tone: "info" }); }

// 格子の一覧 (図鑑・酒場など)。area は DOM に繋がった、残りの高さを占める箱 (flex:1)。
// すべての札を並べ、収まらなければ area の内側で縦にスクロールする。
// スクロールの位置は key ごとに覚える (この起動の間。描き直しても同じところを見せる)
const scrollMemo = {};
// 覚えたスクロールの位置を忘れる (prefix で始まる key / 省略ですべて)。画面・区分・分類に入り直したら先頭から
export function resetPages(prefixes = null) {
  for (const k of Object.keys(scrollMemo)) if (!prefixes || prefixes.some((p) => k.startsWith(p))) delete scrollMemo[k];
}
export function scrollGrid(area, items, makeCell, { cols = 3, cellH = 104, gap = 8, key = "", empty = null } = {}) {
  area.textContent = "";
  area.classList.add("wa-parea");
  if (!items.length) { if (empty) area.appendChild(empty); return; }
  const grid = el("div", "wa-pgrid");
  grid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
  grid.style.gridAutoRows = cellH == null ? "auto" : cellH + "px";
  grid.style.gap = gap + "px";
  for (const it of items) grid.appendChild(makeCell(it));
  area.appendChild(grid);
  if (scrollMemo[key]) area.scrollTop = scrollMemo[key];
  area.onscroll = () => { scrollMemo[key] = area.scrollTop; };
}

// 品をひらく: 持っている品 (誰かの荷・装備) なら UI.itemSheet (その場で装備・譲渡)、無ければ図鑑の詳細
export function findOwned(itemId) {
  const g = G();
  const dolls = [...(g.party || []), ...(g.reserve || [])];
  for (const d of dolls) {
    const i = (d.items || []).findIndex((it) => it && it.id === itemId && !it.unidentified);
    if (i >= 0) return { doll: d, item: d.items[i], index: i, context: "bag" };
  }
  for (const d of dolls) {
    for (const k in (d.equip || {})) { const it = d.equip[k]; if (it && it.id === itemId) return { doll: d, item: it, slot: k, context: "equip" }; }
  }
  return null;
}
export function openItem(itemId, { instance = null, owner = null, context = "bag" } = {}) {
  sfx("select");
  const own = instance && owner ? { doll: owner, item: instance, index: (owner.items || []).indexOf(instance), context } : findOwned(itemId);
  if (own && UI.itemSheet) return UI.itemSheet(own.item, { owner: own.doll, context: own.context, index: own.index, slot: own.slot });
  if (UI.codexItemSheet) return UI.codexItemSheet(itemId);
  return null;
}

// ---------- 番人のささやき ----------
function visitStamp() {
  const g = G();
  return String((g && g.stats && g.stats.runs) || 0);
}
// その街滞在で初めて訪れた施設か (覚えるのは端末の dos-ui)
function firstVisit(key) {
  const seen = { ...(getPref("keeperSeen") || {}) };
  const st = visitStamp();
  if (seen[key] === st) return false;
  seen[key] = st;
  setPref("keeperSeen", seen);
  return true;
}
// 物語の上でその場にいない番人 (FAC_SHELL の absent) は胸像も台詞も出さない
function keeperAbsent(shell) {
  try { return !!(shell.absent && shell.absent()); } catch (e) { return false; }
}
function keeperLine(shell) {
  const g = G();
  const ls = shell.lines || [];
  if (!ls.length) return "";
  return ls[((g && g.stats && g.stats.runs) || 0) % ls.length];
}
// 胸像のシート (台詞の一覧)
export function keeperSheet(key) {
  const shell = (game.FAC_SHELL || {})[key];
  if (!shell || !shell.keeper || keeperAbsent(shell)) return null;
  const body = el("div", "kp-sheet");
  const fr = el("div", "kp-sheet-bust");
  try { const c = keeperCanvas(shell.keeper); if (c) fr.appendChild(c); } catch (e) { /* 演出のみ */ }
  body.appendChild(fr);
  const ls = el("div", "kp-sheet-lines");
  for (const l of shell.lines || []) ls.appendChild(setText(el("div", "kp-sheet-line"), `「${l}」`));
  body.appendChild(ls);
  return sheet.open({ kind: "info", banner: shell.who || "", body, className: "kp-sheet-card",
    footer: [{ label: "閉じる", kind: "ghost", onTap: (h) => h.close() }] });
}
// 初訪問の挨拶: その街滞在で初めて訪れた時だけ、ささやきの行が大きな胸像と吹き出しになる。
// 直後の描き直し (1.5秒以内) の間も大きいまま。次に描き直した時は1行に畳む (めくる格子は描く時に残りの高さを測るので、
// どちらの大きさでも画面に収まる)
let _expanded = { key: null, at: 0 };
export function dismissGreet() { /* 互換 (浮かぶ挨拶は廃止。何もしない) */ }
function expandNow(key) {
  if (_expanded.key === key && Date.now() - _expanded.at < 1500) return true;
  if (!firstVisit(key)) return false;
  _expanded = { key, at: Date.now() };
  return true;
}
// 見出しの下の1行 (48px)。key = FAC_SHELL の鍵
export function keeperRow(key) {
  const shell = (game.FAC_SHELL || {})[key];
  if (!shell || !shell.keeper || keeperAbsent(shell)) return null;
  const line = keeperLine(shell);
  const open = () => { sfx("select"); keeperSheet(key); };
  if (expandNow(key)) {
    const box = el("button", "kp-full");
    box.type = "button";
    box.setAttribute("aria-label", `${shell.who}「${line}」`);
    const fr = el("span", "kp-full-bust");
    try { const c = keeperCanvas(shell.keeper); if (c) fr.appendChild(c); } catch (e) { /* 演出のみ */ }
    box.appendChild(fr);
    const say = el("span", "kp-full-say");
    say.appendChild(setText(el("span", "kp-full-who"), shell.who || ""));
    say.appendChild(setText(el("span", "kp-full-line"), `「${line}」`));
    box.appendChild(say);
    box.addEventListener("click", open);
    return box;
  }
  const w = whisper(shell.keeper, line, { who: shell.who, onTap: open });
  w.classList.add("kp-whisper");
  return w;
}

// ---------- 通貨の説明 (ヘッダの通貨の札をタップ) ----------
const CUR = {
  gold: { name: "金貨", key: "gold", desc: ["宿屋・鑑定・装備の売買などに使う。", "迷宮の宝箱・戦闘・アイテム売却などで手に入る。"] },
  soul: { name: "✦Soul", key: "soulPts", desc: ["魂を強化するための力。人業ではなく魂に刻まれる。", "迷宮で敵を倒すと得られ、全滅しても失われない。"] },
  red: { name: "赤い魂", key: "redSoul", desc: ["人業の器を仕立てる、全滅で迷宮に残された人業の連れ帰りを早める、全滅の時に戦利品を守る——に使う。", "赤い魂の祠で授かる。"] },
  ember: { name: "魂の残火", key: "embers", desc: ["魂のLv上限を1つ上げる。", "要る数は職業のレア度で変わる (コモン1・レア2・エピック3・レジェンド5)。", "あたたかい死体の魂を回収すると必ず、風化した死体を調べると半分の確率で得る (深い迷宮ほど数が多い)。"] },
};
export function currencySheet(kind) {
  const info = CUR[kind] || CUR.gold;
  const g = G() || {};
  const inTown = g.state === "town";
  const body = el("div", "cur-sheet");
  const big = el("div", "cur-big c-" + kind);
  big.appendChild(glyph(kind));
  big.appendChild(el("span", "cur-big-v", String(g[info.key] || 0)));
  body.appendChild(big);
  for (const d of info.desc) body.appendChild(setText(el("div", "ui-sheet-line"), d));
  const footer = [];
  if (inTown && kind === "red" && facilityOpen("shrine")) {
    footer.push({ label: "赤い魂の祠へ", kind: "primary", onTap: (h) => { h.close(); UI.shell.openPage("shrine"); } });
  } else if (inTown && kind === "gold" && facilityOpen("shop")) {
    footer.push({ label: "商会へ", kind: "secondary", onTap: (h) => { h.close(); if (UI.openShop) UI.openShop(); } });
  } else if (inTown && kind === "soul" && facilityOpen("mansion") && (g.party || []).length) {
    footer.push({ label: "パーティで魂を強化", kind: "secondary", onTap: (h) => { h.close(); if (UI.openTab) UI.openTab("party"); } });
  }
  footer.push({ label: "閉じる", kind: "ghost", onTap: (h) => h.close() });
  return sheet.open({ kind: "info", banner: info.name, body, footer, className: "cur-sheet-card" });
}
// 横並びの通貨の札 (32px の見た目・44px の押せる場所)。街の夜景の上で使う
export function currencyBar({ cls = "" } = {}) {
  const g = G() || {};
  const wrap = el("div", "wa-cur" + (cls ? " " + cls : ""));
  for (const kind of ["gold", "soul", "red", "ember"]) {
    const v = g[CUR[kind].key] || 0;
    if (kind === "ember" && v <= 0) continue;
    const c = el("button", "wa-cur-c c-" + kind);
    c.type = "button";
    c.appendChild(glyph(kind));
    c.appendChild(el("span", "wa-cur-v", String(v)));
    c.setAttribute("aria-label", `${CUR[kind].name} ${v}`);
    c.addEventListener("click", () => { sfx("select"); currencySheet(kind); });
    wrap.appendChild(c);
  }
  return wrap;
}

// ---------- 宿屋 (シート) ----------
export function innStatus() {
  const g = G();
  const cost = game.innCost ? game.innCost() : 0;
  const need = (g.party || []).filter((p) => p.alive && (p.hp < p.maxhp || p.mp < p.maxmp));
  return { cost, need, afford: g.gold >= cost };
}
// 宿で休む (1タップ)。泊まれない時 (誰も要らない・金貨が足りない) は詳細のシートを開く
export function restOrDetail() {
  if (!facilityOpen("inn")) return lockedToast();
  const st = innStatus();
  if (st.need.length && st.afford) return ops.restParty();
  return openInn();
}
let innSheet = null;
export function openInn() {
  if (!facilityOpen("inn")) return lockedToast();
  if (innSheet && !innSheet.closed) return innSheet;
  const shell = (game.FAC_SHELL || {}).inn || {};
  const fill = (root) => {
    const st = innStatus();
    const g = G();
    const head = el("div", "inn-head");
    const art = el("div", "inn-art");
    try { const v = vignetteCanvas("inn"); if (v) art.appendChild(v); } catch (e) { /* 演出のみ */ }
    head.appendChild(art);
    const k = el("div", "inn-keeper");
    const b = el("span", "inn-bust");
    try { const c = keeperCanvas(shell.keeper || "innkeeper"); if (c) b.appendChild(c); } catch (e) { /* 演出のみ */ }
    k.appendChild(b);
    k.appendChild(setText(el("span", "inn-say"), `「${keeperLine(shell) || "眠りな。"}」`));
    head.appendChild(k);
    root.appendChild(head);
    root.appendChild(setText(el("div", "ui-sheet-line inn-lead"), "一晩の休息で、生きている人業のHP・MPが全快し、毒や麻痺も癒える。"));
    const list = el("div", "inn-party");
    for (const p of g.party || []) {
      const r = el("div", "inn-row" + (p.alive ? "" : " dead"));
      if (UI.partyPortraitCanvas) {
        const fr = el("span", "inn-port");
        try { fr.appendChild(UI.partyPortraitCanvas(p, 40)); } catch (e) { /* 絵が無くても動く */ }
        r.appendChild(fr);
      } else r.appendChild(portrait(p, { size: 48, hp: false }));
      const t = el("div", "inn-row-t");
      t.appendChild(setText(el("div", "inn-row-n"), p.name));
      if (p.alive) {
        t.appendChild(bar(p.hp, p.maxhp, { tone: "hp" }));
        t.appendChild(el("div", "inn-row-v", `HP ${p.hp}/${p.maxhp}　MP ${p.mp}/${p.maxmp}`));
      } else {
        t.appendChild(el("div", "inn-row-v", "砕けている — 宿では癒えない"));
      }
      r.appendChild(t);
      list.appendChild(r);
    }
    if (!(g.party || []).length) list.appendChild(el("div", "wa-empty", "パーティに人業がいない。"));
    root.appendChild(list);
    const note = !st.need.length ? "皆、すこぶる元気だ。" : !st.afford ? `金貨が足りない (宿賃 ${st.cost})。` : `${st.need.length}体が休息を必要としている。`;
    root.appendChild(setText(el("div", "inn-note" + (st.need.length && st.afford ? " ok" : "")), note));
  };
  const footer = () => {
    const st = innStatus();
    return [
      { label: "泊まる", kind: "primary", size: "lg", cost: { kind: "gold", n: st.cost }, disabled: !st.need.length || !st.afford,
        onTap: (h) => { const r = ops.restParty(); if (r && r.ok) h.close(); else h.update({ footer: footer() }); } },
      { label: "閉じる", kind: "ghost", onTap: (h) => h.close() },
    ];
  };
  innSheet = sheet.open({ kind: "info", banner: "宿屋「白狼」", body: fill, footer: footer(), className: "inn-sheet", onClose: () => { innSheet = null; } });
  return innSheet;
}

// ---------- 酒場 (ページ) ----------
// 区分: 掲示板 (受けた依頼・報告 + 依頼人の頼み + 帰還ごとに貼り替わる依頼) / 噂と顔ぶれ (噂話・居合わせる者たち)
// 受注中の依頼と掲示板の依頼は1つの一覧にまとめ、迷宮ごとに 報告できる → 受注中 → 未受注 の順に並べる (ユーザーの指示)
let tavernSeg = null;
const questOrder = (q) => (q.state === "offer" ? 2 : qbReady(q) ? 0 : 1);
function questGroup(group) {
  const box = el("section", "fc-qgroup");
  const heading = el("h3", "fc-qgroup-head");
  heading.appendChild(el("span", "fc-qgroup-name", group.name));
  heading.appendChild(el("span", "fc-qgroup-count", `${group.quests.length}件`));
  box.setAttribute("aria-label", group.name);
  box.appendChild(heading);
  for (const q of [...group.quests].sort((a, b) => questOrder(a) - questOrder(b))) box.appendChild(questCard(q, { mark: true }));
  return box;
}
function tavernSegments() {
  const L = qbLists();
  const ready = L.active.filter(qbReady).length;
  const fresh = L.offers.filter((q) => q.fresh).length;
  return [
    { key: "board", label: "掲示板", badge: (ready + fresh) || null },
    { key: "talk", label: "噂と顔ぶれ" },
  ];
}
function renderTavern(root) {
  if (!facilityOpen("tavern")) { root.appendChild(lockedRow("酒場「沈まぬ灯」", game.featureNote?.("tavern"))); return; }
  if (legacyJumped()) return;
  const wrap = el("div", "wa-page wa-fit fc-tavern");
  root.appendChild(wrap);
  const kr = keeperRow("tavern");
  if (kr) wrap.appendChild(kr);
  if (tavernSeg !== "talk") tavernSeg = "board"; // 旧来の "active" (受注) も掲示板へ
  const segs = tavernSegments();
  const body = el("div", "fc-tav-body");
  wrap.appendChild(segmented(segs, tavernSeg, (k) => { tavernSeg = k; drawSeg(); }));
  wrap.appendChild(body);
  const drawSeg = () => {
    body.textContent = "";
    if (tavernSeg === "talk") return renderTalk(body);
    const L = qbLists();
    const area = el("div", "fc-qarea");
    body.appendChild(sectionHead("掲示板", { note: `受注 ${L.freeCount}/${L.cap} ・ 貼り紙は帰還のたびに貼り替わる` }));
    body.appendChild(area);
    const empty = el("div", "wa-empty", "受けている依頼も貼り紙もない。迷宮から戻れば、新たな依頼が貼られる。");
    scrollGrid(area, dungeonGroups([...L.active, ...L.offers]), questGroup, { cols: 1, cellH: null, gap: 14, key: "tav-board", empty });
  };
  drawSeg();
  if (tavernSeg === "board") setTimeout(() => UI.tutorialEvent?.("tavernBoard"), 0);
}
// 噂話と居合わせる者たち
function renderTalk(wrap) {
  const g = G();
  // 酒場の噂話 (game.js FEATURES.rumor の報告で情報屋が動く)
  wrap.appendChild(sectionHead("酒場の噂話"));
  const rumorOpen = game.featureUnlocked && game.featureUnlocked("rumor");
  if (!rumorOpen) {
    wrap.appendChild(lockedRow("まだ噂は回ってこない", `情報屋が腰を上げるのは、名の知れた操霊師が現れてから (${game.featureNote ? game.featureNote("rumor") : "踏破を王に報告すると開く"})。`));
  } else if (g.rumor) {
    const rb = el("div", "fc-rumor");
    rb.appendChild(setText(el("div", "fc-rumor-s"), `— ${g.rumor.speaker} —`));
    rb.appendChild(setText(el("div", "fc-rumor-t"), g.rumor.text));
    rb.appendChild(setText(el("div", "wa-note"), g.rumor.info ? "盤面に現れる話ではない。だが、備えあれば憂いなし。" : "この噂は、次に潜る迷宮で現実になる。"));
    wrap.appendChild(rb);
  } else {
    const left = (g.rumorCooldown || 0) - Date.now();
    if (left > 0) {
      wrap.appendChild(lockedRow("しばらく待て", `情報屋はまだ動いていない。あと約 ${Math.ceil(left / 60000)} 分。`));
    } else {
      const price = game.rumorPrice ? game.rumorPrice() : (game.RUMOR_PRICE || 100);
      const dn = game.curDungeon ? game.curDungeon() : null;
      const rb = button({ label: "噂を聞く", sub: price ? `情報屋は「${dn ? dn.name : "—"}」を読む` : `今回は情報屋のおごり ・「${dn ? dn.name : "—"}」を読む`, kind: "primary", cost: price ? { kind: "gold", n: price } : null, disabled: g.gold < price, onTap: () => game.listenRumor() });
      rb.classList.add("fc-rumor-btn");
      wrap.appendChild(rb);
    }
  }

  // 3) 居合わせる者たち (帰還ごとに入れ替わる)。収まる人数ずつめくる
  if ((!g.tavernCrowd || !g.tavernCrowd.length) && game.rollTavernCrowd) game.rollTavernCrowd();
  wrap.appendChild(sectionHead("居合わせる者たち", { note: "帰還のたびに入れ替わる" }));
  const area = el("div", "fc-crowd");
  wrap.appendChild(area);
  scrollGrid(area, g.tavernCrowd || [], (m) => {
    const r = el("div", "fc-voice");
    const h = el("div", "fc-voice-h");
    h.appendChild(setText(el("span", "fc-voice-n"), m.name));
    h.appendChild(setText(el("span", "fc-voice-k"), m.type));
    r.appendChild(h);
    r.appendChild(setText(el("div", "fc-voice-t"), m.line));
    return r;
  }, { cols: 1, cellH: 104, gap: 6, key: "crowd" });
}

// ---------- 赤い魂の祠 (ページ) ----------
function renderShrine(root) {
  if (legacyJumped()) return;
  const g = G();
  const wrap = el("div", "wa-page wa-fit fc-shrine");
  root.appendChild(wrap);
  const kr = keeperRow("shrine");
  if (kr) wrap.appendChild(kr);
  const hero = el("div", "fc-red");
  const art = el("div", "fc-red-art");
  try { const v = vignetteCanvas("shrine"); if (v) art.appendChild(v); } catch (e) { /* 演出のみ */ }
  hero.appendChild(art);
  const cnt = el("div", "fc-red-cnt");
  cnt.appendChild(glyph("red"));
  cnt.appendChild(el("span", "fc-red-v", String(g.redSoul)));
  cnt.appendChild(el("span", "fc-red-l", "所持する赤い魂"));
  hero.appendChild(cnt);
  wrap.appendChild(hero);

  // 広告動画 (シミュレート)
  const left = game.adCooldownLeft ? game.adCooldownLeft() : 0;
  const ad = button({ label: left > 0 ? "祈りは届いている…" : "広告動画を見る", sub: left > 0 ? `あと ${Math.ceil(left / 1000)} 秒` : "赤い魂を授かる", kind: "primary",
    cost: { kind: "red", n: "+10" }, disabled: left > 0, onTap: () => game.watchShrineAd() });
  ad.classList.add("fc-ad");
  wrap.appendChild(ad);
  if (left > 0) {
    // 待ち時間の表示だけを1秒ごとに書き替える (画面は描き直さない)
    const t = setInterval(() => {
      if (!ad.isConnected) { clearInterval(t); return; }
      const l = game.adCooldownLeft();
      if (l <= 0) { clearInterval(t); game.renderTown(); return; }
      const s = ad.querySelector(".ui-btn-s");
      if (s) s.textContent = `あと ${Math.ceil(l / 1000)} 秒`;
    }, 1000);
  }

  wrap.appendChild(sectionHead("赤い魂を授かる", { note: "体験版・無償" }));
  const packs = el("div", "fc-packs");
  for (const p of game.RED_PACKS || []) {
    const r = el("button", "fc-pack");
    r.type = "button";
    const n = el("span", "fc-pack-n");
    n.appendChild(glyph("red"));
    n.appendChild(document.createTextNode(String(p.n)));
    r.appendChild(n);
    r.appendChild(el("span", "fc-pack-tag" + (p.tag ? "" : " plain"), p.tag || "授かる"));
    r.setAttribute("aria-label", `赤い魂 ${p.n} を授かる`);
    r.addEventListener("click", () => game.buyRedPack(p.n));
    packs.appendChild(r);
  }
  wrap.appendChild(packs);

  wrap.appendChild(sectionHead("赤い魂の使い道"));
  const uses = el("div", "fc-uses wa-scroll");
  const use = (t, s) => { const r = el("div", "fc-use"); r.appendChild(el("i", "wa-dia")); const tx = el("div"); tx.appendChild(setText(el("div", "fc-use-t"), t)); tx.appendChild(setText(el("div", "fc-use-s"), s)); r.appendChild(tx); uses.appendChild(r); };
  use("人業の器を仕立てる", "人業の館で (最初の3体は無料)");
  use("迷宮に残された人業を早く連れ帰る", "全滅の時。🔴1 で連れ帰りまでの時間を 20 分縮める");
  use("全滅の時に戦利品を守る", `🔴${game.GUARDIAN_COST || 20} で拾った品を失わずに帰還する`);
  wrap.appendChild(uses);
}

// ページを開いたまま旧来の入口 (G.town.facility = …) へ跳ばされた時は、ページを閉じてそちらを描く
function legacyJumped() {
  const t = G() && G().town;
  if (!t || !t.facility) return false;
  queueMicrotask(() => { if (t.facility && t.page) { t.page = null; game.renderTown(); } });
  return true;
}

export function install() {
  registerUI({
    keeperWhisper: (key) => keeperRow(key),
    keeperSheet,
    currencySheet,
    openInn,
    restOrDetail,
  });
  if (UI.shell) {
    UI.shell.registerPage("tavern", { title: "酒場「沈まぬ灯」", parentTab: "hub", render: (root) => renderTavern(root) });
    // 酒場を区分つきで開く (手ほどき「酒場の噂話」は "talk")
    registerUI({ openTavern: (seg = null) => { tavernSeg = seg; UI.shell.openPage("tavern", { parentTab: "hub" }); } });
    UI.shell.registerPage("shrine", { title: "赤い魂の祠", parentTab: "hub", render: (root) => renderShrine(root) });
  }
  // 街シェルの見出しの通貨の札 (キット) をタップした時は、祠への案内つきの説明を出す
  try {
    const head = typeof document !== "undefined" ? document.querySelector("#town-shell .ts-head") : null;
    if (head && head.addEventListener) {
      head.addEventListener("click", (e) => {
        const c = e.target && e.target.closest ? e.target.closest(".ui-cur-c") : null;
        if (!c) return;
        e.stopPropagation(); e.preventDefault();
        const kind = ["gold", "soul", "red", "ember"].find((k) => c.classList.contains("c-" + k)) || "gold";
        sfx("select");
        currencySheet(kind);
      }, true);
    }
  } catch (e) { /* 演出のみ */ }
}
