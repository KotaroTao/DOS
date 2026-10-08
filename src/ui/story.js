// ===== 物語 — 報告 → 解放 → 勅命を1つの連なった語りに (playStoryChain) =====
// 担当: WP-A。玉座の間の一幕: 上下に黒い帯 (映画の画角)、奥に玉座の間の情景、老王の肖像、台詞が墨のようににじみ出る。
//   1回目のタップ = 残りの台詞を一度に出す / 次のタップ = 次のページ / 最後のページは「御意」で閉じる。
//   戻る操作も同じ順 (全文 → 次のページ → 閉じる)。
// pages: [{ title, lines[], reward?, kicker?, btnLabel?, art?, who?, place?, enter?(), leave?() }]
//   place = 背景の情景 (townart の vignetteCanvas の鍵。既定 "palace"。最初のページのものを使う)
//   art = 物語の一枚絵の鍵 (src/storyart.js)。あれば肖像の代わりに絵を掲げ、背景もその絵を沈めて敷く
//   photo = 描き下ろしの絵のパス (archive-stories.js storyImage。3:2)。あれば art より優先して掲げる (ストーリー一覧と同じ絵)
//   who = 語り手 "king" (既定・老王の肖像) | "irene" (館の主の肖像) | "none" (肖像なし・地の文)
//         | { name, sub?, art?() } (酒場の依頼人など: 枠に art() の絵 (依頼の魔物・品など) を掲げ、名と肩書きを添える)
//   reward = 受け取るものの一覧 [{ job:"fighter" } | { cur:"gold"|"soul"|"red"|"ember", n } | { item: 品, n }] (文字列でも可)
//            各札に tag (「心付け」など小さな添え書き) を付けられる
//   enter = ページを開く直前 / leave = ページを離れる時 (次のページへ進む・閉じる)。状態の変化はここで行い、順番は呼び出し側が決める。
// done(): すべて閉じた後 (最後のページの leave の後)。描き直し・トーストは呼び出し側。
// 提供: UI.playStoryChain(pages, done) (.scene = true で旧来の showStoryScene が委ねる)
// game.js は import しない (ctx.js の UI / game を通す)。

import { game, registerUI } from "./ctx.js";
import { el, setText, button, glyph } from "./kit.js";
import { nav } from "./nav.js";
import { animate, reduced } from "./motion.js";
import { spriteCanvas, crispCanvas } from "../sprites.js";
import { SOUL_CLASSES, soulIcon } from "../souls.js";
import { KING_PORTRAIT, vignetteCanvas } from "../townart.js";
import { storyArt, ART_W, ART_H } from "../storyart.js";
import { IRENE_ART } from "./irene.js";
import { SFX } from "../audio.js";

const sfx = (k) => { try { if (SFX[k]) SFX[k](); } catch (e) { /* noop */ } };

// 行の種類で書式を変える: 「…」= 語り手 (王) の台詞 / イレーヌ「…」/ セラ「…」/ 宰相… = 宰相の台詞 /
// ──『…』= 手紙・手記 / ── = 要旨 / それ以外 = 地の文
function lineKind(t) {
  if (/^宰相/.test(t)) return "minister";
  if (/^イレーヌ「/.test(t)) return "irene";
  if (/^セラ「/.test(t)) return "sera";
  if (/^──『/.test(t)) return "letter";
  if (/^──/.test(t)) return "decree";
  if (/^「/.test(t)) return "king";
  return "narr";
}

// 受け取るもの: 見出し + 1点ずつの札 (魂は職の胸像、通貨は印と数)
const CUR_NAME = { gold: "金貨", soul: "✦Soul", red: "赤い魂", ember: "魂の残火" };
function rewardBox(reward) {
  const box = el("div", "sc-reward");
  box.appendChild(el("div", "sc-rw-h", "受け取るもの"));
  if (!Array.isArray(reward)) { box.appendChild(setText(el("div", "sc-rw-t"), reward)); return box; }
  const list = el("div", "sc-rw-list");
  for (const r of reward) {
    const it = el("div", "sc-rw-i");
    const ic = el("span", "sc-rw-ic");
    let name;
    if (r.item) {
      try { ic.appendChild(spriteCanvas(r.item, 2)); } catch (e) { /* 絵が無くても動く */ }
      name = r.item.name;
    } else if (r.job) {
      try { ic.appendChild(crispCanvas(soulIcon(r.job), 28)); } catch (e) { /* 絵が無くても動く */ }
      name = `${(SOUL_CLASSES[r.job] || {}).label || r.job}の魂`;
    } else {
      ic.appendChild(glyph(r.cur));
      name = CUR_NAME[r.cur] || r.cur;
    }
    it.appendChild(ic);
    it.appendChild(el("span", "sc-rw-n", name));
    if (r.n != null) it.appendChild(el("span", "sc-rw-q", `×${r.n}`));
    if (r.tag) { it.classList.add("tagged"); it.appendChild(el("span", "sc-rw-tag", r.tag)); }
    list.appendChild(it);
  }
  box.appendChild(list);
  return box;
}

let active = null;

// 描き下ろしの絵 (3:2) の表示の大きさ: 一枚絵と同じ幅を上限に、縦は画面の4割まで
const PHOTO_ASPECT = 1.5;
function photoSize() {
  const vw = typeof innerWidth === "number" ? innerWidth : 390, vh = typeof innerHeight === "number" ? innerHeight : 844;
  const w = Math.max(160, Math.min(440, vw - 40, Math.round(vh * 0.4 * PHOTO_ASPECT)));
  return { w, h: Math.round(w / PHOTO_ASPECT) };
}
function photoImg(src, cls) {
  const img = el("img", cls);
  img.src = new URL("../../" + src, import.meta.url).href;
  img.alt = ""; img.draggable = false; img.decoding = "async";
  return img;
} // 同時に1つだけ (重ねて呼ばれたら、前の語りの後ろに続ける)

// 長いページは、画面に収まる分ずつに分ける (縦に巻かせない)。一枚絵のあるページは文字の場所が狭い。
// 分けたページは題・絵・語り手を引き継ぎ、enter は最初の分・leave と受け取るもの・決め手の文言は最後の分に付ける
function splitPages(pages) {
  const vw = typeof innerWidth === "number" ? innerWidth : 390, vh = typeof innerHeight === "number" ? innerHeight : 844;
  const dpr = (typeof devicePixelRatio === "number" && devicePixelRatio > 0) ? devicePixelRatio : 1;
  const cpl = Math.max(12, Math.floor((Math.min(vw, 480) - 48) / 14.2)); // 1行に入る字数 (14px)
  const artH = () => { const room = Math.min(440, vw - 40); return Math.round(ART_H * Math.max(1, Math.floor(room * dpr / ART_W)) / dpr); };
  const out = [];
  for (const p of pages) {
    const lines = p.lines || [];
    const head = p.photo ? photoSize().h + 10 : p.art ? artH() + 10 : (p.who === "none" ? 0 : 150);
    const room = (pRw) => vh * 0.91 - 40 - head - 70 - 110 - (pRw ? 96 : 0);
    const cost = (t) => Math.ceil(t.length * 1.12 / cpl) * 26 + 8; // 文節で折る分 (phrase.js) 行末が少し余る
    // 受け取るものの札が付く最後の分は、後ろから札の分だけ狭い枠に詰める。残りを前から詰める
    // (前から詰めて溢れた行を送ると、最初の分が1行だけになることがある)
    let tail = null, body = lines;
    if (p.reward && lines.length) {
      tail = [];
      let u = 0;
      for (let i = lines.length - 1; i >= 0; i--) {
        const c = cost(lines[i]);
        if (tail.length && u + c > room(true)) break;
        tail.unshift(lines[i]); u += c;
      }
      body = lines.slice(0, lines.length - tail.length);
    }
    const chunks = [];
    let cur = [], used = 0;
    for (const t of body) {
      const c = cost(t);
      if (cur.length && used + c > room(false)) { chunks.push(cur); cur = []; used = 0; }
      cur.push(t); used += c;
    }
    if (cur.length) chunks.push(cur);
    if (tail) chunks.push(tail);
    if (!chunks.length) chunks.push([]);
    chunks.forEach((ls, i) => {
      const first = i === 0, lastOne = i === chunks.length - 1;
      out.push({ ...p, lines: ls, enter: first ? p.enter : null, leave: lastOne ? p.leave : null, reward: lastOne ? p.reward : null, btnLabel: lastOne ? p.btnLabel : null });
    });
  }
  return out;
}

export function playStoryChain(pages, done) {
  const list = splitPages((pages || []).filter(Boolean));
  if (!list.length || typeof document === "undefined" || !document.body) { if (done) done(); return null; }
  if (active) { // 語りの最中にもう一つ: 今の語りが閉じてから続けて語る
    const prev = active.done;
    active.done = () => { if (prev) prev(); playStoryChain(list, done); };
    return active;
  }
  const G = game.G;
  if (G) G.prompt = true;

  const wrap = el("div", "sc-scene");
  wrap.setAttribute("role", "dialog");
  wrap.setAttribute("aria-modal", "true");
  wrap.tabIndex = -1;
  const bg = el("div", "sc-bg");
  let palaceBg = null;
  // 背景の情景: 既定は玉座の間。最初のページの place で替えられる (酒場の依頼は "tavern")
  try { palaceBg = vignetteCanvas((list[0] && list[0].place) || "palace"); } catch (e) { palaceBg = null; }
  wrap.appendChild(bg);
  wrap.appendChild(el("div", "sc-veil"));
  wrap.appendChild(el("div", "sc-bar top"));
  wrap.appendChild(el("div", "sc-bar bot"));

  const stage = el("div", "sc-stage");
  const head = el("div", "sc-head");
  const pf = el("div", "sc-portrait");
  head.appendChild(pf);
  const whoEl = el("div", "sc-who", "老王");
  head.appendChild(whoEl);
  stage.appendChild(head);
  const artBox = el("div", "sc-art hidden");
  stage.appendChild(artBox);
  // 語り手の肖像 (ページごとに替わる時だけ描き直す)
  let curWho = null, curArt = null;
  const setWho = (who) => {
    if (who === curWho) return;
    curWho = who;
    pf.textContent = "";
    pf.classList.toggle("mark", typeof who === "object");
    whoEl.classList.toggle("npc", typeof who === "object");
    if (who && typeof who === "object") {
      try { const a = who.art && who.art(); if (a) pf.appendChild(a); } catch (e) { /* 絵が無くても名は出す */ }
      whoEl.textContent = "";
      whoEl.appendChild(setText(el("span", "sc-who-n"), who.name || ""));
      if (who.sub) whoEl.appendChild(setText(el("span", "sc-who-k"), who.sub));
    } else if (who === "irene") {
      const img = el("img", "sc-pf-img");
      img.src = IRENE_ART; img.alt = ""; img.draggable = false; img.decoding = "async";
      pf.appendChild(img);
      whoEl.textContent = "イレーヌ";
    } else {
      try { pf.appendChild(spriteCanvas(KING_PORTRAIT, 10.5, 12)); } catch (e) { /* 演出のみ */ }
      whoEl.textContent = "老王";
    }
  };
  // 一枚絵: 整数倍で拡大してくっきり見せる (幅は舞台の内側に収まる最大の倍率)
  const setArt = (key, photo) => {
    if ((photo || key) === curArt) return;
    curArt = photo || key;
    artBox.textContent = "";
    bg.textContent = "";
    if (photo) {
      artBox.classList.remove("hidden");
      wrap.classList.add("has-art");
      const { w, h } = photoSize();
      const img = photoImg(photo, "sc-photo");
      img.width = w; img.height = h;
      img.style.width = w + "px"; img.style.height = h + "px";
      artBox.appendChild(img);
      bg.appendChild(photoImg(photo, "sc-photo-bg"));
      return;
    }
    const c = key ? storyArt(key) : null;
    artBox.classList.toggle("hidden", !c);
    wrap.classList.toggle("has-art", !!c);
    if (c) {
      const dpr = (typeof devicePixelRatio === "number" && devicePixelRatio > 0) ? devicePixelRatio : 1;
      const room = Math.min(440, (typeof innerWidth === "number" ? innerWidth : 390) - 40);
      const k = Math.max(1, Math.floor(room * dpr / ART_W)) / dpr;
      c.style.width = Math.round(ART_W * k) + "px";
      c.style.height = Math.round(ART_H * k) + "px";
      artBox.appendChild(c);
      const b = storyArt(key);
      if (b) bg.appendChild(b);
    } else if (palaceBg) bg.appendChild(palaceBg);
  };
  const kicker = el("div", "sc-kicker");
  const title = el("div", "sc-title");
  stage.appendChild(kicker);
  stage.appendChild(title);
  const page = el("div", "sc-page");
  stage.appendChild(page);
  const foot = el("div", "sc-foot");
  const dots = el("div", "sc-dots");
  const tip = el("div", "sc-tip");
  const okBox = el("div", "sc-ok");
  foot.appendChild(dots);
  foot.appendChild(okBox);
  foot.appendChild(tip);
  stage.appendChild(foot);
  wrap.appendChild(stage);

  const st = { i: -1, revealed: false, timer: null, closed: false, done };
  active = st;
  const last = () => st.i >= list.length - 1;

  const reveal = () => {
    if (st.revealed) return;
    st.revealed = true;
    if (st.timer) { clearTimeout(st.timer); st.timer = null; }
    wrap.classList.add("revealed");
    tip.textContent = last() ? "" : "タップで次へ";
  };

  const show = (k) => {
    const prev = list[st.i];
    if (prev && prev.leave) { try { prev.leave(); } catch (e) { setTimeout(() => { throw e; }); } }
    st.i = k;
    const p = list[k];
    if (p.enter) { try { p.enter(); } catch (e) { setTimeout(() => { throw e; }); } }
    st.revealed = false;
    wrap.classList.remove("revealed");
    const who = p.who || "king";
    const pic = !!(p.photo || p.art);
    setArt(p.art || null, p.photo || null);
    head.classList.toggle("hidden", pic || who === "none");
    if (!pic && who !== "none") setWho(who);
    kicker.textContent = p.kicker ? `✦ ${p.kicker} ✦` : "✦ 玉座の間 ✦";
    setText(title, p.title || "");
    page.textContent = "";
    const body = el("div", "sc-lines");
    let delay = 0.2;
    for (const t of p.lines || []) {
      const ln = setText(el("div", "sc-line k-" + lineKind(t)), t);
      ln.style.animationDelay = delay.toFixed(2) + "s";
      delay += Math.min(1.5, 0.42 + t.length * 0.02);
      body.appendChild(ln);
    }
    page.appendChild(body);
    if (p.reward) {
      const rw = rewardBox(p.reward);
      rw.style.animationDelay = delay.toFixed(2) + "s";
      delay += 0.3;
      page.appendChild(rw);
    }
    page.scrollTop = 0;
    // ページの印 (● ○ ○)
    dots.textContent = "";
    if (list.length > 1) for (let j = 0; j < list.length; j++) dots.appendChild(el("i", j === k ? "on" : j < k ? "past" : ""));
    // 最後のページだけ「御意」
    okBox.textContent = "";
    if (last()) {
      const ok = button({ label: p.btnLabel || "御意", kind: "primary", size: "lg", onTap: (e) => { if (e) e.stopPropagation(); finish(); } });
      ok.classList.add("sc-okb");
      ok.style.animationDelay = delay.toFixed(2) + "s";
      okBox.appendChild(ok);
    }
    tip.textContent = "タップで全文を表示";
    if (st.timer) clearTimeout(st.timer);
    st.timer = setTimeout(reveal, reduced() ? 0 : (delay + 0.35) * 1000);
    if (k > 0 && !reduced()) animate(page, [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: 260, easing: "ease-out", fill: "none" });
  };

  const advance = () => {
    if (st.closed) return;
    if (!st.revealed) { reveal(); sfx("select"); return; }
    if (!last()) { sfx("select"); show(st.i + 1); return; }
    // 最後のページ: 「御意」を光らせて促す
    const ok = okBox.querySelector("button");
    if (ok) animate(ok, [{ filter: "brightness(1)" }, { filter: "brightness(1.6)" }, { filter: "brightness(1)" }], { duration: 420, fill: "none" });
  };

  const finish = () => {
    if (st.closed) return;
    st.closed = true;
    if (st.timer) clearTimeout(st.timer);
    nav.remove(entry);
    removeEventListener("keydown", onKey, true);
    const p = list[st.i];
    if (p && p.leave) { try { p.leave(); } catch (e) { setTimeout(() => { throw e; }); } }
    if (active === st) active = null;
    if (G) G.prompt = false;
    sfx("select");
    wrap.classList.add("out");
    const rm = () => { if (wrap.isConnected) wrap.remove(); };
    setTimeout(rm, reduced() ? 140 : 480);
    const cb = st.done;
    if (cb) { try { cb(); } catch (e) { setTimeout(() => { throw e; }); } }
  };

  // 戻る操作: 全文 → 次のページ → (最後のページなら) 閉じる
  const entry = nav.push({ id: "story", onBack: () => { if (!st.revealed) reveal(); else if (!last()) show(st.i + 1); else finish(); } });
  const onKey = (e) => {
    if (st.closed) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault(); e.stopPropagation();
      if (st.revealed && last()) finish(); else advance();
    }
  };
  addEventListener("keydown", onKey, true);
  wrap.addEventListener("click", (e) => { if (e.target.closest && e.target.closest(".sc-okb")) return; advance(); });

  document.body.appendChild(wrap);
  show(0);
  try { wrap.focus({ preventScroll: true }); } catch (e) { /* noop */ }
  return { close: finish, el: wrap };
}
playStoryChain.scene = true;

export function install() {
  registerUI({ playStoryChain });
}
