// ===== 物語 — 報告 → 解放 → 勅命を1つの連なった語りに (playStoryChain) =====
// 担当: WP-A。玉座の間の一幕: 上下に黒い帯 (映画の画角)、奥に玉座の間の情景、老王の肖像、台詞が墨のように滲み出る。
//   1回目のタップ = 残りの台詞を一度に出す / 次のタップ = 次の頁 / 最後の頁は「御意」で閉じる。
//   戻る操作も同じ順 (全文 → 次の頁 → 閉じる)。
// pages: [{ title, lines[], reward?, kicker?, btnLabel?, enter?(), leave?() }]
//   enter = 頁を開く直前 / leave = 頁を離れる時 (次の頁へ進む・閉じる)。状態の変化はここで行い、順番は呼び出し側が決める。
// done(): すべて閉じた後 (最後の頁の leave の後)。描き直し・トーストは呼び出し側。
// 提供: UI.playStoryChain(pages, done) (.scene = true で旧来の showStoryScene が委ねる)
// game.js は import しない (ctx.js の UI / game を通す)。

import { game, registerUI } from "./ctx.js";
import { el, setText, button } from "./kit.js";
import { nav } from "./nav.js";
import { animate, reduced } from "./motion.js";
import { spriteCanvas } from "../sprites.js";
import { KING_PORTRAIT, vignetteCanvas } from "../townart.js";
import { SFX } from "../audio.js";

const sfx = (k) => { try { if (SFX[k]) SFX[k](); } catch (e) { /* noop */ } };

// 行の種類で書式を変える: 「…」= 王の台詞 / 宰相… = 宰相の台詞 / ── = 勅命の要旨 / それ以外 = 地の文
function lineKind(t) {
  if (/^宰相/.test(t)) return "minister";
  if (/^──/.test(t)) return "decree";
  if (/^「/.test(t)) return "king";
  return "narr";
}

let active = null; // 同時に1つだけ (重ねて呼ばれたら、前の語りの後ろに続ける)

export function playStoryChain(pages, done) {
  const list = (pages || []).filter(Boolean);
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
  try { const v = vignetteCanvas("palace"); if (v) bg.appendChild(v); } catch (e) { /* 演出のみ */ }
  wrap.appendChild(bg);
  wrap.appendChild(el("div", "sc-veil"));
  wrap.appendChild(el("div", "sc-bar top"));
  wrap.appendChild(el("div", "sc-bar bot"));

  const stage = el("div", "sc-stage");
  const head = el("div", "sc-head");
  const pf = el("div", "sc-portrait");
  try { pf.appendChild(spriteCanvas(KING_PORTRAIT, 10.5, 12)); } catch (e) { /* 演出のみ */ }
  head.appendChild(pf);
  head.appendChild(el("div", "sc-who", "老王"));
  stage.appendChild(head);
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
      const rw = setText(el("div", "sc-reward"), p.reward);
      rw.style.animationDelay = delay.toFixed(2) + "s";
      delay += 0.3;
      page.appendChild(rw);
    }
    page.scrollTop = 0;
    // 頁の印 (● ○ ○)
    dots.textContent = "";
    if (list.length > 1) for (let j = 0; j < list.length; j++) dots.appendChild(el("i", j === k ? "on" : j < k ? "past" : ""));
    // 最後の頁だけ「御意」
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
    // 最後の頁: 「御意」を光らせて促す
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

  // 戻る操作: 全文 → 次の頁 → (最後の頁なら) 閉じる
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
