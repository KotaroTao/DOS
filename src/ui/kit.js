// ===== UI キット (§5 部品) =====
// 黒鉄の板・くすぶした金の縁・明朝の見出し。押せる場所は最低 44×44。絵文字はボタンに置かず、
// 通貨は小さな硬貨/魂玉の印 (.ui-g-*) に、その他の絵文字は取り除く (glyphText)。
// シートは #ui-layer に積み重なり (z 80+n)、トーストは最大3つ。戻る操作は nav に集まる。

import { game } from "./ctx.js";
import { nav } from "./nav.js";
import { sheetIn, sheetOut, shake as shakeEl, animate, T, EASE, reduced } from "./motion.js";
import { remember } from "./prefs.js";
import { spriteCanvas, crispCanvas } from "../sprites.js";
import { dollBust, SOUL_CLASSES } from "../souls.js";
import { rarityKey, RARITIES } from "../rarity.js";
import { keeperCanvas, iconCanvas } from "../townart.js";
import { isFloating } from "../dungeons/schema.js";

const hasDOM = () => typeof document !== "undefined" && typeof document.createElement === "function";

// ---- DOM ヘルパ (game.js から移設) ----
export function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
export function btn(label, onClick) {
  const b = document.createElement("button");
  b.className = "btn";
  b.textContent = label;
  b.addEventListener("click", onClick);
  return b;
}

// 長押し検出: ~450ms 押し続けたら onHold を呼び、その直後のクリックは抑制する。
// タッチ/マウス両対応。指が大きく動いたら(スクロール扱い)キャンセルする。(game.js の attachLongPress を移設)
export function longPress(elm, onHold, ms = 450) {
  let timer = null, fired = false, sx = 0, sy = 0;
  const clear = () => { if (timer) { clearTimeout(timer); timer = null; } };
  const start = (x, y) => {
    fired = false; sx = x; sy = y;
    clear();
    timer = setTimeout(() => { fired = true; onHold(); }, ms);
  };
  const move = (x, y) => { if (timer && (Math.abs(x - sx) > 10 || Math.abs(y - sy) > 10)) clear(); };
  elm.addEventListener("pointerdown", (e) => start(e.clientX, e.clientY));
  elm.addEventListener("pointermove", (e) => move(e.clientX, e.clientY));
  elm.addEventListener("pointerup", clear);
  elm.addEventListener("pointercancel", clear);
  elm.addEventListener("pointerleave", clear);
  // 長押しが発火していたら通常クリック(スキル発動など)を握り潰す
  elm.addEventListener("click", (e) => { if (fired) { e.preventDefault(); e.stopPropagation(); fired = false; } }, true);
  return elm;
}

// ---- 絵文字 → 印 ----
// 💰/🔴/🔥 と「✦数字」は通貨の印に、それ以外の絵文字 (Extended_Pictographic) は取り除く。
// ★☆✦◆▲▼◎◯† などの記号は文字として残す。
const KEEP = new Set(["★", "☆", "✦", "✧", "✝", "☾", "♪", "♫", "◆", "◇", "◎", "◯", "○", "●", "▲", "▼", "△", "▽", "▶", "◀", "†", "‡", "※", "♦"]);
let EP_RE = null;
try { EP_RE = new RegExp("\\p{Extended_Pictographic}", "u"); } catch (e) { EP_RE = /[\u{1F000}-\u{1FAFF}☀-➿⭐⤴⤵⏩-⏺]/u; }
const CUR = { "💰": "gold", "🔴": "red", "🔥": "ember" };

export function glyph(kind) {
  const g = el("i", "ui-g ui-g-" + kind);
  g.setAttribute("aria-hidden", "true");
  return g;
}

// 文字列を「文字 + 印」の断片にする
export function glyphText(text) {
  const frag = document.createDocumentFragment();
  if (text == null) return frag;
  const s = String(text);
  let buf = "";
  const flush = () => { if (buf) { frag.appendChild(document.createTextNode(buf)); buf = ""; } };
  const chars = Array.from(s);
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (CUR[c]) { flush(); frag.appendChild(glyph(CUR[c])); continue; }
    if (c === "✦" && /[0-9+]/.test(chars[i + 1] || "")) { flush(); frag.appendChild(glyph("soul")); continue; }
    if (c === "️" || c === "‍") continue;
    if (!KEEP.has(c) && EP_RE.test(c)) {
      // 取り除いた絵文字の後ろの空白も詰める
      if (chars[i + 1] === " " && (!buf || buf.endsWith(" "))) i++;
      continue;
    }
    buf += c;
  }
  flush();
  // 先頭・末尾の空白、連続空白を詰める
  const first = frag.firstChild, last = frag.lastChild;
  if (first && first.nodeType === 3) first.nodeValue = first.nodeValue.replace(/^\s+/, "");
  if (last && last.nodeType === 3) last.nodeValue = last.nodeValue.replace(/\s+$/, "");
  for (const n of frag.childNodes) if (n.nodeType === 3) n.nodeValue = n.nodeValue.replace(/\s{2,}/g, " ");
  return frag;
}
// 絵文字を取り除いた素の文字列 (判定・aria 用)
export function plainText(text) {
  if (text == null) return "";
  let out = "";
  for (const c of Array.from(String(text))) {
    if (CUR[c] || c === "️" || c === "‍") continue;
    if (!KEEP.has(c) && EP_RE.test(c)) continue;
    out += c;
  }
  return out.replace(/\s{2,}/g, " ").trim();
}
export function setText(node, text) {
  node.textContent = "";
  node.appendChild(glyphText(text));
  return node;
}

// ---- SVG の線画アイコン (戦闘コマンドと同じ作法: 24x24・線1.7) ----
export const SVG = {
  gear: '<circle cx="12" cy="12" r="3.1"/><path d="M9.6 5.7 L9.6 2.9 14.4 2.9 14.4 5.7 A6.8 6.8 0 0 1 17.3 7.7 L19.9 6.9 21.4 11.5 18.8 12.4 A6.8 6.8 0 0 1 17.7 15.7 L19.3 17.9 15.4 20.8 13.8 18.6 A6.8 6.8 0 0 1 10.2 18.6 L8.6 20.8 4.7 17.9 6.3 15.7 A6.8 6.8 0 0 1 5.2 12.4 L2.6 11.5 4.1 6.9 6.7 7.7 A6.8 6.8 0 0 1 9.6 5.7Z"/>',
  back: '<path d="M15 4.5 7.5 12l7.5 7.5"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  chevron: '<path d="M9 5l7 7-7 7"/>',
  town: '<path d="M2.5 20.5h19"/><path d="M4 20.5v-8.2l4-3.6 4 3.6v8.2"/><path d="M12 20.5V9.6l4-4.4 4 4.4v10.9"/><path d="M16 5.2V2.4"/><path d="M7 20.5v-3.4h2v3.4"/><path d="M15 12.4h2M15 15.6h2"/>',
  party: '<path d="M5.6 20.5v-8.3a6.4 6.4 0 0 1 12.8 0v8.3"/><path d="M5.6 13.4h12.8"/><path d="M12 13.4v7.1"/><path d="M8.4 16.6h1.8M13.8 16.6h1.8"/><path d="M12 5.8C12 4 13.4 2.8 15.4 2.6"/>',
  shop: '<path d="M12 3.2v17.3M7.6 20.5h8.8"/><path d="M4.4 6.8h15.2"/><path d="M4.4 6.8 2 12.6h4.8Z"/><path d="M19.6 6.8 17.2 12.6H22Z"/><path d="M2 12.6a2.4 2.4 0 0 0 4.8 0M17.2 12.6a2.4 2.4 0 0 0 4.8 0"/>',
  palace: '<path d="M3.8 18.2 2.8 7.6l5.4 4.3L12 4.8l3.8 7.1 5.4-4.3-1 10.6Z"/><path d="M4 21h16"/><path d="M12 13.4v1.6"/>',
  gate: '<path d="M4.5 20.5V11a7.5 7.5 0 0 1 15 0v9.5"/><path d="M8 20.5V11.5a4 4 0 0 1 8 0v9"/><path d="M2.5 20.5h19"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="1.6"/><path d="M8.2 10.5V7.6a3.8 3.8 0 0 1 7.6 0v2.9"/><path d="M12 14.4v2.6"/>',
  unlock: '<rect x="5" y="10.5" width="14" height="10" rx="1.6"/><path d="M8.2 10.5V7.6a3.8 3.8 0 0 1 7.4-1.2"/><path d="M12 14.4v2.6"/>',
  chain: '<path d="M10 14.2 7.4 16.8a3 3 0 0 1-4.2-4.2l2.8-2.8a3 3 0 0 1 4.2 0"/><path d="M14 9.8l2.6-2.6a3 3 0 0 1 4.2 4.2L18 14.2a3 3 0 0 1-4.2 0"/><path d="M9.4 14.6l5.2-5.2"/>',
};
export function svgIcon(kind, cls = "ui-ic") {
  const ns = "http://www.w3.org/2000/svg";
  const sv = document.createElementNS(ns, "svg");
  sv.setAttribute("viewBox", "0 0 24 24");
  sv.setAttribute("aria-hidden", "true");
  sv.setAttribute("class", cls);
  sv.innerHTML = SVG[kind] || "";
  return sv;
}

// ---- 入力の封じ (§5 uiBlocked) ----
// 選択肢・シート・ステータス・設定のいずれかが開いている間は、盤面の入力と待機アニメを止める
export function uiBlocked() {
  const G = game.G;
  return !!(G && (G.prompt || G.statusOpen || G.settingsOpen)) || stack.length > 0;
}

// ---- 揺れ ----
export function shake(node) { return shakeEl(node); }

// ================= シート (#ui-layer に積み重なる) =================
const stack = []; // 開いているシート (下から)
export function sheetDepth() { return stack.length; }
export function topSheet() { return stack[stack.length - 1] || null; }

function uiLayer() {
  let l = document.getElementById("ui-layer");
  if (!l) { l = el("div"); l.id = "ui-layer"; document.body.appendChild(l); }
  return l;
}

function renderFooter(foot, items, h) {
  foot.textContent = "";
  for (const it of items) {
    if (!it) continue;
    if (it.nodeType) { foot.appendChild(it); continue; }
    const b = button({ ...it, onTap: () => { if (it.onTap) it.onTap(h); } });
    foot.appendChild(b);
  }
}

// sheet.open({ title, banner, accent, art, lines, body, footer, kind, dismissible, onClose, onBack, className })
//   kind: "info" (下から昇る・閉じられる) | "choice" (決断) | "celebrate" (中央の祝祭カード)
//   footer: [{label, kind, sub, cost, onTap(h)} | Node]  (onTap 内で h.close() を呼ぶ)
//   onBack: 戻る操作の処理 (省略時: dismissible なら閉じる、でなければ揺らす)
//   返り値: { close(reason), update(opts), el, body, foot }
export const sheet = {
  open(opts = {}) {
    if (!hasDOM()) return { close() {}, update() {}, el: null };
    const kind = opts.kind || "info";
    const dismissible = opts.dismissible !== false;
    const wrap = el("div", "ui-sheet-wrap k-" + kind);
    wrap.style.zIndex = String(81 + stack.length);
    const backdrop = el("div", "ui-backdrop");
    wrap.appendChild(backdrop);
    const card = el("div", "ui-sheet k-" + kind + (kind === "celebrate" ? " ig-card" : "") + (opts.className ? " " + opts.className : ""));
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "true");
    card.tabIndex = -1;
    if (opts.accent) card.style.setProperty("--sheet-accent", opts.accent);
    wrap.appendChild(card);

    const h = { el: card, wrap, opts, kind, closed: false, navEntry: null };
    const grab = kind !== "celebrate" ? el("div", "ui-grab") : null;
    if (grab) { grab.appendChild(el("i")); card.appendChild(grab); }
    const head = el("div", "ui-sheet-head");
    const scroll = el("div", "ui-sheet-body");
    const foot = el("div", "ui-sheet-foot");
    card.appendChild(head); card.appendChild(scroll); card.appendChild(foot);
    h.body = scroll; h.foot = foot; h.head = head;

    const fill = (o) => {
      head.textContent = ""; scroll.textContent = "";
      if (o.banner) {
        const bn = setText(el("div", "ui-sheet-banner"), o.banner);
        head.appendChild(bn);
      }
      if (o.art) {
        const floats = o.float != null ? o.float : (!o.art.nodeType && o.art.maxhp != null && isFloating(o.art));
        const art = el("div", "ui-art" + (o.sparkle ? " sparkle" : "") + (floats ? " float" : ""));
        art.appendChild(o.art.nodeType ? o.art : spriteCanvas(o.art, o.artScale || 9));
        if (o.sparkle) {
          for (let i = 0; i < 6; i++) {
            const s = el("span", "ig-spark");
            s.style.setProperty("--a", (i * 60) + "deg");
            s.style.animationDelay = (i * 0.08) + "s";
            art.appendChild(s);
          }
        }
        scroll.appendChild(art);
      }
      if (o.title) {
        const t = setText(el("div", "ui-sheet-title"), o.title);
        if (o.titleColor) t.style.color = o.titleColor;
        scroll.appendChild(t);
      }
      for (const ln of (o.lines || [])) scroll.appendChild(setText(el("div", "ui-sheet-line"), ln));
      if (o.body) {
        if (typeof o.body === "function") o.body(scroll, h);
        else scroll.appendChild(o.body);
      }
      if (Array.isArray(o.footer)) renderFooter(foot, o.footer, h);
      else if (o.footer && o.footer.nodeType) { foot.textContent = ""; foot.appendChild(o.footer); }
      foot.classList.toggle("hidden", !foot.childElementCount);
    };
    fill(opts);
    // 縦スクロールを出さない: 収まらない中身はページに分けて ‹ 1/2 › で送る (fitPages)
    const pager = el("div", "ui-sheet-pager hidden");
    card.insertBefore(pager, foot);
    h.pager = pager;
    h.host = card;
    h.page = 0;
    // pageEnd: ページに分かれたら最後のページを見せ続ける (記録など。手でページを送るまで、割り直しても最後へ寄せる)
    h.pageEnd = !!opts.pageEnd;

    h.update = (o) => { h.opts = { ...h.opts, ...o }; h.page = 0; fill(h.opts); schedulePages(h); };
    h.close = (reason = "close", { silent = false } = {}) => {
      if (h.closed) return;
      h.closed = true;
      const i = stack.indexOf(h);
      if (i >= 0) stack.splice(i, 1);
      if (h.navEntry) nav.remove(h.navEntry);
      wrap.classList.add("closing");
      wrap.style.pointerEvents = "none";
      sheetOut(card, backdrop, kind).then(() => wrap.remove());
      // 保険: アニメーションが終わらなくても消す
      setTimeout(() => { if (wrap.isConnected) wrap.remove(); }, 600);
      if (!silent && typeof h.opts.onClose === "function") h.opts.onClose(reason);
    };
    h.back = () => {
      if (h.closed) return;
      if (typeof h.opts.onBack === "function") return h.opts.onBack(h);
      if (dismissible) return h.close("back");
      shakeEl(card);
    };

    backdrop.addEventListener("click", () => {
      if (h.closed) return;
      if (typeof h.opts.onBackdrop === "function") return h.opts.onBackdrop(h);
      if (dismissible) h.close("backdrop");
      else shakeEl(card);
    });

    // 下へ引けば閉じる (閉じられるシートのみ・グラブと見出し)
    if (grab && dismissible) attachDragClose(card, [grab, head], () => h.back());

    // フォーカスを閉じ込める (Tab がシートの外へ出ない)
    wrap.addEventListener("keydown", (e) => {
      if (e.key !== "Tab") return;
      const f = [...card.querySelectorAll("button:not([disabled]), [tabindex='0'], input, select")];
      if (!f.length) { e.preventDefault(); card.focus(); return; }
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    stack.push(h);
    h.navEntry = nav.push({ id: "sheet", onBack: () => h.back() });
    uiLayer().appendChild(wrap);
    sheetIn(card, backdrop, kind);
    if (opts.paged !== false) watchPages(h);
    try {
      const pri = card.querySelector(".ui-btn.k-primary:not([disabled])") || card.querySelector(".ui-sheet-foot button:not([disabled])");
      (pri || card).focus({ preventScroll: true });
    } catch (e) { /* noop */ }
    return h;
  },
  depth: sheetDepth,
  top: topSheet,
  // すべて閉じる (状態の復元時など)。onClose は呼ばない
  closeAll() { for (const h of stack.slice().reverse()) h.close("reset", { silent: true }); },
};

// ================= シートのページ送り (縦スクロールの代わり) =================
// 中身がシートの高さを超えたら、上から順に「入る分」ずつページに割り、他のページの要素は隠す (要素は動かさない)。
// 1つでページより高い箱は、その子へ降りて割る (箱の見出し = 最初の小さな子は、続きのページにも出す)。
// 中身が後から変わったら (ResizeObserver) 割り直す。ページは ‹ › ・左右のスワイプ・←→キーで送る
const PG_ATTR = "data-pg";
function pgReset(body) {
  for (const n of body.querySelectorAll("[" + PG_ATTR + "], .ui-pg-off")) { n.removeAttribute(PG_ATTR); n.classList.remove("ui-pg-off"); }
}
function pgUnits(box, avail, out, heads, depth, boxes) {
  for (const c of box.children) {
    if (c.nodeType !== 1) continue;
    const cs = getComputedStyle(c);
    if (cs.display === "none" || cs.position === "absolute" || cs.position === "fixed") continue;
    const r = c.getBoundingClientRect();
    if (r.height > avail && depth < 4 && c.childElementCount > 1) {
      const kids = [...c.children];
      const head = kids[0].getBoundingClientRect().height < 64 ? kids[0] : null;
      const sub = [];
      boxes.push(c);
      pgUnits(c, avail, sub, heads, depth + 1, boxes);
      if (head) { const i = sub.indexOf(head); if (i >= 0) sub.splice(i, 1); heads.push({ head, units: sub }); }
      out.push(...sub);
    } else out.push(c);
  }
}
function fitPages(h) {
  if (h.closed || !h.body || !h.body.isConnected || !h.body.clientHeight) return;
  const body = h.body, pager = h.pager;
  h._pgBusy = true;
  pgReset(body);
  pager.classList.add("hidden");
  h.host.classList.remove("is-paged");
  if (body.scrollHeight <= body.clientHeight + 2) { h.pages = 1; h._pgBusy = false; return; }
  pager.classList.remove("hidden"); // 送りの段のぶん本文は低くなる
  h.host.classList.add("is-paged");
  const cs = getComputedStyle(body);
  const avail = (body.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)) * 0.97;
  const units = [], heads = [], boxes = [];
  pgUnits(body, avail, units, heads, 0, boxes);
  h._pgBoxes = boxes;
  let page = 0, start = null;
  for (const u of units) {
    const r = u.getBoundingClientRect();
    if (start == null) start = r.top;
    else if (r.bottom - start > avail && r.top > start + 1) { page++; start = r.top; }
    u.setAttribute(PG_ATTR, String(page));
  }
  for (const { head, units: us } of heads) {
    const ps = new Set(us.map((u) => u.getAttribute(PG_ATTR)));
    head.setAttribute(PG_ATTR, [...ps].join(" "));
  }
  h.pages = page + 1;
  if (h.pages <= 1) { pgReset(body); pager.classList.add("hidden"); h.host.classList.remove("is-paged"); h._pgBusy = false; return; }
  showPage(h, h.pageEnd ? h.pages - 1 : Math.min(h.page || 0, h.pages - 1));
  h._pgBusy = false;
}
function showPage(h, n) {
  h.page = Math.max(0, Math.min(h.pages - 1, n));
  for (const u of h.body.querySelectorAll("[" + PG_ATTR + "]")) {
    const on = u.getAttribute(PG_ATTR).split(" ").includes(String(h.page));
    u.classList.toggle("ui-pg-off", !on);
  }
  // 割られた箱は、中身が全部隠れたページでは箱ごと隠す (内側の箱から)
  for (const box of (h._pgBoxes || []).slice().reverse()) {
    const any = box.querySelector("[" + PG_ATTR + "]:not(.ui-pg-off)");
    box.classList.toggle("ui-pg-off", !any);
  }
  const pager = h.pager;
  pager.textContent = "";
  const prev = el("button", "ui-pg-b prev"); prev.type = "button"; prev.setAttribute("aria-label", "前のページ"); prev.textContent = "‹";
  const next = el("button", "ui-pg-b next"); next.type = "button"; next.setAttribute("aria-label", "次のページ"); next.textContent = "›";
  prev.disabled = h.page <= 0; next.disabled = h.page >= h.pages - 1;
  prev.addEventListener("click", () => turnPage(h, -1));
  next.addEventListener("click", () => turnPage(h, 1));
  const dots = el("div", "ui-pg-n");
  for (let i = 0; i < h.pages; i++) dots.appendChild(el("i", i === h.page ? "on" : ""));
  dots.appendChild(setText(el("span"), `${h.page + 1} / ${h.pages}`));
  pager.appendChild(prev); pager.appendChild(dots); pager.appendChild(next);
}
function turnPage(h, d) {
  if (!h.pages || h.pages <= 1) return;
  const n = Math.max(0, Math.min(h.pages - 1, h.page + d));
  if (n === h.page) return;
  h.pageEnd = false;
  showPage(h, n);
  if (!reduced()) animate(h.body, [{ opacity: 0.35, transform: `translateX(${d * 14}px)` }, { opacity: 1, transform: "none" }], { duration: 160, fill: "none" });
}
function schedulePages(h) {
  if (h._pgRaf) return;
  const raf = typeof requestAnimationFrame === "function" ? requestAnimationFrame : (f) => setTimeout(f, 16);
  h._pgRaf = raf(() => { h._pgRaf = null; try { fitPages(h); } catch (e) { h._pgBusy = false; } });
}
function watchPages(h) {
  schedulePages(h);
  if (typeof ResizeObserver === "function") {
    const ro = new ResizeObserver(() => { if (!h._pgBusy && !h.closed) schedulePages(h); });
    ro.observe(h.body);
    const inner = () => { for (const c of h.body.children) ro.observe(c); };
    inner();
    if (typeof MutationObserver === "function") new MutationObserver(() => { inner(); if (!h._pgBusy && !h.closed) schedulePages(h); }).observe(h.body, { childList: true });
  }
  // 左右のスワイプでページを送る
  let x0 = null, y0 = 0;
  h.body.addEventListener("pointerdown", (e) => { x0 = e.clientX; y0 = e.clientY; });
  h.body.addEventListener("pointerup", (e) => {
    if (x0 == null) return;
    const dx = e.clientX - x0, dy = e.clientY - y0; x0 = null;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) turnPage(h, dx < 0 ? 1 : -1);
  });
  if (h.wrap) h.wrap.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") turnPage(h, 1);
    else if (e.key === "ArrowLeft") turnPage(h, -1);
  });
}
// 画面の中の箱 (タブの本文など) にも同じページ送りを付ける。pager は box の直後に置く。
// box は高さが決まっている (flex で伸び縮みする) こと。中身を描き直したら自動で割り直す
export function autoPage(box, { pagerClass = "" } = {}) {
  if (!hasDOM() || !box) return null;
  const pager = el("div", "ui-sheet-pager ui-box-pager hidden" + (pagerClass ? " " + pagerClass : ""));
  box.after(pager);
  const h = { body: box, pager, host: box, page: 0, closed: false };
  box.classList.add("ui-autopage");
  watchPages(h);
  return h;
}

function attachDragClose(card, handles, onClose) {
  let y0 = null, dy = 0, t0 = 0;
  const down = (e) => {
    y0 = e.clientY; dy = 0; t0 = Date.now();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
  };
  const move = (e) => {
    if (y0 == null) return;
    dy = Math.max(0, e.clientY - y0);
    card.style.transform = dy ? `translateY(${dy}px)` : "";
  };
  const up = () => {
    if (y0 == null) return;
    const v = dy / Math.max(1, Date.now() - t0);
    const d = dy;
    y0 = null; dy = 0;
    card.style.transform = "";
    if (d > 80 || (d > 24 && v > 0.6)) onClose();
    else if (d) animate(card, [{ transform: `translateY(${d}px)` }, { transform: "translateY(0)" }], { duration: T.base, easing: EASE.sheet, fill: "none" });
  };
  for (const h of handles) {
    h.style.touchAction = "none";
    h.addEventListener("pointerdown", down);
    h.addEventListener("pointermove", move);
    h.addEventListener("pointerup", up);
    h.addEventListener("pointercancel", up);
  }
}

// ================= トースト (最大3・2.2秒) =================
// 置き場は2つ: 通常 (z 85: 階の暗転より下) と最前面 (top: タイトル画面などの上にも出す)
const toastBoxes = {};
function toasts(top = false) {
  const k = top ? "top" : "base";
  if (toastBoxes[k] && toastBoxes[k].isConnected) return toastBoxes[k];
  const box = el("div", "ui-toasts" + (top ? " top" : ""));
  box.setAttribute("aria-live", "polite");
  uiLayer().appendChild(box);
  return (toastBoxes[k] = box);
}
// toast(text, { tone:"gold"|"good"|"bad"|"info", icon:Node|item, rarity, action:{label, fn}, ms, top })
export function toast(text, opts = {}) {
  if (!hasDOM()) return null;
  const box = toasts(!!opts.top);
  const rk = opts.rarity || (opts.icon && !opts.icon.nodeType ? rarityKey(opts.icon) : null);
  const t = el("div", "ui-toast t-" + (opts.tone || "gold") + (rk ? " rar-" + rk : "") + (opts.action ? " has-act" : ""));
  if (rk && RARITIES[rk]) t.style.setProperty("--toast-edge", RARITIES[rk].color);
  if (opts.icon) {
    const ic = el("span", "ui-toast-ic");
    ic.appendChild(opts.icon.nodeType ? opts.icon : spriteCanvas(opts.icon, 2));
    t.appendChild(ic);
  }
  t.appendChild(setText(el("span", "ui-toast-t"), text));
  let timer = null;
  const dismiss = () => {
    if (timer) { clearTimeout(timer); timer = null; }
    if (!t.isConnected || t.classList.contains("out")) return;
    t.classList.add("out");
    setTimeout(() => t.remove(), 320);
  };
  if (opts.action) {
    const a = el("button", "ui-toast-act");
    setText(a, opts.action.label);
    a.addEventListener("click", (e) => { e.stopPropagation(); dismiss(); try { opts.action.fn(); } catch (err) { setTimeout(() => { throw err; }); } });
    t.appendChild(a);
    // 上へ払えば消える
    let y0 = null;
    t.addEventListener("pointerdown", (e) => { y0 = e.clientY; });
    t.addEventListener("pointerup", (e) => { if (y0 != null && y0 - e.clientY > 24) dismiss(); y0 = null; });
  }
  box.appendChild(t);
  // 4つ目からは古いものを押し出す
  const live = [...box.children].filter((c) => !c.classList.contains("out"));
  while (live.length > 3) { const old = live.shift(); old.classList.add("out"); setTimeout(() => old.remove(), 320); }
  requestAnimationFrame(() => t.classList.add("show"));
  timer = setTimeout(dismiss, opts.ms || (opts.action ? 4000 : 2200));
  return { el: t, dismiss };
}
nav.setRootToast((text) => toast(text, { tone: "info", ms: 2000, top: true }));

// ================= ボタン・行・区分・チップ =================
// button({ label, sub, icon, kind:"primary"|"secondary"|"danger"|"ghost", size:"md"|"lg"|"sm", onTap, onHold, badge, cost, disabled })
export function button(o = {}) {
  const b = el("button", "ui-btn k-" + (o.kind || "secondary") + " s-" + (o.size || "md"));
  b.type = "button";
  if (o.icon) {
    const ic = typeof o.icon === "string" ? (SVG[o.icon] ? svgIcon(o.icon, "ui-btn-ic") : glyph(o.icon)) : o.icon;
    b.appendChild(ic);
  }
  const tx = el("span", "ui-btn-t");
  tx.appendChild(setText(el("span", "ui-btn-l"), o.label || ""));
  if (o.sub) tx.appendChild(setText(el("span", "ui-btn-s"), o.sub));
  b.appendChild(tx);
  if (o.cost != null) {
    const c = el("span", "ui-cost");
    if (typeof o.cost === "object") { c.appendChild(glyph(o.cost.kind || "gold")); c.appendChild(document.createTextNode(String(o.cost.n))); }
    else c.appendChild(glyphText(String(o.cost)));
    b.appendChild(c);
  }
  if (o.badge) b.appendChild(badge(o.badge));
  if (o.disabled) b.disabled = true;
  if (o.title) b.title = o.title;
  b.setAttribute("aria-label", plainText(o.label || "") + (o.sub ? " " + plainText(o.sub) : ""));
  if (o.onTap) b.addEventListener("click", (e) => o.onTap(e));
  if (o.onHold) longPress(b, o.onHold);
  return b;
}

// row({ icon, title, sub, right, chevron, onTap, onHold, tone })
export function row(o = {}) {
  const r = el(o.onTap ? "button" : "div", "ui-row" + (o.tone ? " t-" + o.tone : "") + (o.onTap ? " tap" : ""));
  if (o.onTap) r.type = "button";
  if (o.icon) {
    const ic = el("span", "ui-row-ic");
    ic.appendChild(o.icon.nodeType ? o.icon : spriteCanvas(o.icon, 2));
    r.appendChild(ic);
  }
  const tx = el("span", "ui-row-t");
  tx.appendChild(setText(el("span", "ui-row-title"), o.title || ""));
  if (o.sub) tx.appendChild(o.sub.nodeType ? o.sub : setText(el("span", "ui-row-sub"), o.sub));
  r.appendChild(tx);
  if (o.right) {
    const rt = el("span", "ui-row-r");
    rt.appendChild(o.right.nodeType ? o.right : glyphText(String(o.right)));
    r.appendChild(rt);
  }
  if (o.chevron) r.appendChild(svgIcon("chevron", "ui-row-chev"));
  if (o.onTap) r.addEventListener("click", (e) => o.onTap(e));
  if (o.onHold) longPress(r, o.onHold);
  return r;
}

// segmented(items:[{key,label,badge}], active, onChange, { prefKey }) … 44px の区分。prefKey で記憶する
export function segmented(items, active, onChange, { prefKey = null } = {}) {
  if (prefKey && active == null) active = remember("seg", prefKey) || (items[0] && items[0].key);
  const wrap = el("div", "ui-seg");
  wrap.setAttribute("role", "tablist");
  for (const it of items) {
    const b = el("button", "ui-seg-b" + (it.key === active ? " on" : ""));
    b.type = "button";
    b.setAttribute("role", "tab");
    b.setAttribute("aria-selected", it.key === active ? "true" : "false");
    b.appendChild(setText(el("span"), it.label));
    if (it.badge) b.appendChild(badge(it.badge));
    b.addEventListener("click", () => {
      if (prefKey) remember("seg", prefKey, it.key);
      for (const x of wrap.children) { x.classList.toggle("on", x === b); x.setAttribute("aria-selected", x === b ? "true" : "false"); }
      if (onChange) onChange(it.key);
    });
    wrap.appendChild(b);
  }
  return wrap;
}

// chips(items:[{key,label,badge}], active, onChange) … 1列の横スクロール (端は闇に溶ける)
export function chips(items, active, onChange) {
  const wrap = el("div", "ui-chips");
  const inner = el("div", "ui-chips-in");
  for (const it of items) {
    const c = el("button", "ui-chip" + (it.key === active ? " on" : ""));
    c.type = "button";
    c.appendChild(setText(el("span"), it.label));
    if (it.badge) c.appendChild(badge(it.badge));
    c.addEventListener("click", () => {
      for (const x of inner.children) x.classList.toggle("on", x === c);
      if (onChange) onChange(it.key);
    });
    inner.appendChild(c);
  }
  wrap.appendChild(inner);
  requestAnimationFrame(() => { const on = inner.querySelector(".on"); if (on && on.scrollIntoView) { try { on.scrollIntoView({ block: "nearest", inline: "center" }); } catch (e) { /* noop */ } } });
  return wrap;
}

// ================= 品・肖像・数値 =================
// itemTile(item, { size:44|56, price, isNew, onTap, onHold })
export function itemTile(item, o = {}) {
  const size = o.size || 44;
  const t = el(o.onTap ? "button" : "div", "ui-tile s" + size + (item ? "" : " empty"));
  if (o.onTap) t.type = "button";
  if (item) {
    const rk = rarityKey(item);
    if (rk) { t.classList.add("rar-" + rk); t.style.setProperty("--tile-edge", RARITIES[rk].color); }
    t.appendChild(spriteCanvas(item, size >= 56 ? 3 : 2));
    if (item.unidentified) t.appendChild(el("span", "ui-tile-seal", "?"));
    if (o.isNew || item.isNew) t.appendChild(el("span", "ui-tile-new"));
    if (o.price != null) t.appendChild(setText(el("span", "ui-tile-price"), String(o.price)));
    t.title = item.name || "";
  }
  if (o.onTap) t.addEventListener("click", (e) => o.onTap(e));
  if (o.onHold) longPress(t, o.onHold);
  return t;
}

// portrait(doll, { size:48|52|64, hp:true, row:true, onTap, onHold })
export function portrait(d, o = {}) {
  const size = o.size || 52;
  const p = el(o.onTap ? "button" : "div", "ui-port s" + size + (d && !d.alive ? " dead" : "") + (o.selected ? " sel" : ""));
  if (o.onTap) p.type = "button";
  if (d) {
    const cls = d.dominant && SOUL_CLASSES[d.dominant.clsKey];
    if (cls && cls.glow) p.style.setProperty("--glow", cls.glow);
    const fr = el("span", "ui-port-fr");
    try { fr.appendChild(crispCanvas(dollBust(d), Math.round(size * 0.8))); } catch (e) { /* 絵が無くても動く */ }
    p.appendChild(fr);
    if (!d.alive) p.appendChild(el("span", "ui-port-dead", "†"));
    if (o.hp !== false && d.maxhp) {
      const r = Math.max(0, Math.min(1, (d.hp || 0) / Math.max(1, d.maxhp)));
      const hp = el("span", "ui-port-hp" + (r < 0.34 && d.alive ? " low" : ""));
      const f = el("i"); f.style.width = (r * 100).toFixed(1) + "%"; hp.appendChild(f);
      p.appendChild(hp);
    }
    if (o.row) p.appendChild(el("span", "ui-port-row", o.row === true ? "" : String(o.row)));
    p.title = d.name || "";
  } else {
    p.classList.add("empty");
    p.appendChild(el("span", "ui-port-plus", "＋"));
  }
  if (o.onTap) p.addEventListener("click", (e) => o.onTap(e));
  if (o.onHold) longPress(p, o.onHold);
  return p;
}

// statDelta({atk:+4, agi:-1, …}) → 「ATK+4 AGI-1」(▲緑 / ▼赤)
const DELTA_LABEL = { atk: "ATK", vit: "VIT", agi: "AGI", int: "INT", pie: "PIE", luk: "LUK", hp: "HP", mp: "MP", crit: "会心" };
export function statDelta(d = {}, { compact = true } = {}) {
  const w = el("span", "ui-delta");
  let any = false;
  for (const k of Object.keys(DELTA_LABEL)) {
    const v = d[k];
    if (!v || typeof v !== "number") continue;
    any = true;
    const s = el("span", v > 0 ? "up" : "dn", `${compact ? "" : (v > 0 ? "▲" : "▼")}${DELTA_LABEL[k]}${v > 0 ? "+" : ""}${v}${k === "crit" ? "%" : ""}`);
    w.appendChild(s);
  }
  if (!any) w.appendChild(el("span", "eq", "変化なし"));
  return w;
}

// bar(value, max, { tone:"hp"|"mp"|"soul"|"gold" })
export function bar(value, max, { tone = "hp" } = {}) {
  const b = el("span", "ui-bar t-" + tone);
  const f = el("i");
  f.style.width = (Math.max(0, Math.min(1, (value || 0) / Math.max(1, max || 1))) * 100).toFixed(1) + "%";
  b.appendChild(f);
  return b;
}

// badge(n|true) … 16px の赤金の印 (true = 点)
export function badge(n) {
  const b = el("span", "ui-badge" + (n === true ? " dot" : ""));
  if (n !== true) b.textContent = typeof n === "number" && n > 99 ? "99+" : String(n);
  return b;
}

// ================= 見出し・番人のひとこと・タブバー =================
// header({ left:"gear"|"back", title, sub, onBack, onGear, backLabel, currencies:true })
export function header(o = {}) {
  const h = el("header", "ui-header");
  const left = el("button", "ui-hbtn");
  left.type = "button";
  if (o.left === "back") {
    left.appendChild(svgIcon("back", "ui-hbtn-ic"));
    if (o.backLabel) left.appendChild(setText(el("span", "ui-hbtn-l"), o.backLabel));
    left.setAttribute("aria-label", o.backLabel ? `${plainText(o.backLabel)}へ戻る` : "戻る");
    left.addEventListener("click", () => (o.onBack ? o.onBack() : nav.back()));
  } else {
    left.appendChild(svgIcon("gear", "ui-hbtn-ic"));
    left.setAttribute("aria-label", "設定");
    left.addEventListener("click", () => { if (o.onGear) o.onGear(); });
  }
  h.appendChild(left);
  const t = el("div", "ui-htitle");
  t.appendChild(setText(el("span", "ui-htitle-t"), o.title || ""));
  if (o.sub) t.appendChild(setText(el("span", "ui-htitle-s"), o.sub));
  h.appendChild(t);
  if (o.currencies !== false) h.appendChild(currencyChips({ onTap: o.onCurrency }));
  return h;
}

// 所持の通貨 (金貨 / ✦Soul / 赤い魂 / 残火)。タップで説明のシート
const CUR_INFO = {
  gold: { name: "金貨", key: "gold", desc: ["宿屋・鑑定・装備の売買などに使う。", "迷宮の宝箱・戦闘・アイテム売却などで手に入る。"] },
  soul: { name: "✦Soul", key: "soulPts", desc: ["魂を強化するための力 (経験値)。", "迷宮で敵を倒すと得られ、全滅しても失われない。"] },
  red: { name: "赤い魂", key: "redSoul", desc: ["人業の仕立てや、全滅で迷宮に残された人業の連れ帰りを早めるのに使う。", "赤い魂の祠で授かる。"] },
  ember: { name: "魂の残火", key: "embers", desc: ["魂のLv上限を1上げる。", "要る数は職業のレア度で変わる (コモン1・レア2・エピック3・レジェンド5)。", "死体の魂を回収すると得ることがある。"] },
};
export function currencyChips({ onTap } = {}) {
  const G = game.G || {};
  const wrap = el("div", "ui-cur");
  const add = (kind) => {
    const info = CUR_INFO[kind];
    const v = G[info.key] || 0;
    if (kind === "ember" && v <= 0) return;
    const c = el("button", "ui-cur-c c-" + kind);
    c.type = "button";
    c.appendChild(glyph(kind));
    c.appendChild(el("span", "ui-cur-v", String(v)));
    c.setAttribute("aria-label", `${info.name} ${v}`);
    c.addEventListener("click", () => {
      if (onTap) return onTap(kind);
      sheet.open({ kind: "info", banner: info.name, title: `${info.name}　${(game.G || {})[info.key] || 0}`, lines: info.desc,
        footer: [{ label: "閉じる", onTap: (h) => h.close() }] });
    });
    wrap.appendChild(c);
  };
  add("gold"); add("soul"); add("red"); add("ember");
  return wrap;
}

// whisper(keeperKey, line, { who, onTap }) … 48px の行に胸像の小窓 + 一行
export function whisper(keeperKey, line, o = {}) {
  const w = el(o.onTap ? "button" : "div", "ui-whisper");
  if (o.onTap) w.type = "button";
  const bust = el("span", "ui-whisper-bust");
  try { const c = keeperCanvas(keeperKey); if (c) bust.appendChild(c); } catch (e) { /* 演出のみ */ }
  w.appendChild(bust);
  const tx = el("span", "ui-whisper-t");
  if (o.who) tx.appendChild(setText(el("span", "ui-whisper-who"), o.who));
  tx.appendChild(setText(el("span", "ui-whisper-line"), line ? `「${line}」` : ""));
  w.appendChild(tx);
  if (o.onTap) w.addEventListener("click", o.onTap);
  return w;
}

// tabbar(tabs:[{key,label,icon,badge,locked,center}], active, onChange)
//   中央 (center:true) は 72px の門 (16px 浮く)。鎖の印 = 閉ざされたタブ
export function tabbar(tabs, active, onChange) {
  const bar = el("nav", "ui-tabbar");
  bar.setAttribute("role", "tablist");
  bar.setAttribute("aria-label", "街の区画");
  for (const t of tabs) {
    const b = el("button", "ui-tab" + (t.center ? " center" : ""));
    b.type = "button";
    b.dataset.key = t.key;
    b.setAttribute("role", "tab");
    const icw = el("span", "ui-tab-icw");
    if (t.center) {
      const medal = el("span", "ui-gate-medal");
      let ic = null;
      try { ic = iconCanvas(t.icon || "dive"); } catch (e) { ic = null; }
      if (ic) { ic.classList.add("ui-gate-ic"); medal.appendChild(ic); }
      else medal.appendChild(svgIcon("gate", "ui-tab-ic"));
      icw.appendChild(medal);
    } else {
      icw.appendChild(svgIcon(t.icon || "town", "ui-tab-ic"));
    }
    icw.appendChild(svgIcon("chain", "ui-tab-lock"));
    b.appendChild(icw);
    const lb = el("span", "ui-tab-l");
    if (t.center) { lb.appendChild(el("i", "ui-tab-dia")); lb.appendChild(document.createTextNode(t.label)); lb.appendChild(el("i", "ui-tab-dia")); }
    else lb.textContent = t.label;
    if (!t.center && t.label.length >= 4) lb.classList.add("long");
    b.appendChild(lb);
    b.appendChild(el("span", "ui-tab-badge"));
    b.addEventListener("click", () => { if (onChange) onChange(t.key, b); });
    bar.appendChild(b);
  }
  updateTabbar(bar, tabs, active);
  return bar;
}
// 既存のタブバーの状態だけ更新する (作り直さない)
export function updateTabbar(bar, tabs, active) {
  for (const t of tabs) {
    const b = bar.querySelector(`.ui-tab[data-key="${t.key}"]`);
    if (!b) continue;
    const on = t.key === active;
    b.classList.toggle("on", on);
    b.classList.toggle("locked", !!t.locked);
    b.setAttribute("aria-selected", on ? "true" : "false");
    b.setAttribute("aria-label", t.label + (t.locked ? " (閉ざされている)" : ""));
    const bd = b.querySelector(".ui-tab-badge");
    const v = t.locked ? null : t.badge;
    bd.className = "ui-tab-badge" + (v ? (v === true ? " dot" : "") : " hidden");
    bd.textContent = v && v !== true ? (typeof v === "number" && v > 99 ? "99+" : String(v)) : "";
  }
}

// ================= 確認 =================
// confirm({ title, lines, okLabel, cancelLabel, danger, banner }) → Promise<boolean>
export function confirm(o = {}) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v, h) => { if (done) return; done = true; if (h) h.close(v ? "ok" : "cancel", { silent: true }); resolve(v); };
    const h = sheet.open({
      kind: "choice",
      banner: o.banner || "確認",
      accent: o.danger === false ? null : "#c43a2f",
      title: o.title, lines: o.lines || [],
      className: "ui-confirm",
      footer: [
        { label: o.okLabel || "実行する", kind: o.danger === false ? "primary" : "danger", size: "lg", onTap: (s) => finish(true, s) },
        { label: o.cancelLabel || "やめる", kind: "ghost", onTap: (s) => finish(false, s) },
      ],
      onBack: (s) => finish(false, s),
      onBackdrop: (s) => finish(false, s),
      onClose: () => finish(false, null),
    });
    if (!h || !h.el) resolve(false);
  });
}

// ================= 通知の祝祭カード (中央) =================
// celebrate({ banner, title, art, lines, accent, okLabel, onClose }) … ig-card の見た目を流用
export function celebrate(o = {}) {
  return sheet.open({
    kind: "celebrate", sparkle: o.sparkle !== false, ...o,
    footer: o.footer || [{ label: o.okLabel || "受け取る", kind: "primary", size: "lg", onTap: (h) => h.close("ok") }],
  });
}

export { reduced };
