// オープニング — 新規ゲーム開始時に一度だけ流れる導入
//
// 六幕の一枚絵 (openingart.js) を、上下を闇で切った映画の画角で映す。
// 各幕はカメラがゆっくりと滑り (多層の視差)、語りは一文字ずつ墨がにじむように現れる。
// 幕と幕のあいだは闇へ溶けて切り替わり、最後に題字を掲げて街へ送り出す。
//
// 操作: タップ / Enter = 語りを早送り → 次の幕へ。長押し・「スキップ」・Esc = 全体をとばす。
// showOpening(done) — 閉じたあと done() を一度だけ呼ぶ
import { SFX } from "./audio.js";
import { pickRes } from "./pxpaint.js";
import { SCENES, setReduced } from "./openingart.js";
import { phraseBreaks } from "./ui/phrase.js";

const REDUCED = (() => {
  try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
})();

function div(cls, text) {
  const e = document.createElement("div");
  e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
const sfx = (k) => { try { SFX[k] && SFX[k](); } catch {} };
const ease = (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);

// 語りの一行は文字列、または { em, ruby } (物語の肝となる語を一行に据えて大きく掲げる)
const lineText = (ln) => (typeof ln === "string" ? ln : ln.em);

// 一文字ごとの現れる時刻 (ms)。句読点で息をつく
function charTimes(lines) {
  const out = [];
  let t = 0;
  for (const ln of lines) {
    const row = [];
    const em = typeof ln !== "string";
    if (em) t += 420; // 掲げる語の前に、ひと呼吸おく
    for (const ch of lineText(ln)) {
      row.push(t);
      t += 62;
      if (ch === "、") t += 160;
      else if (ch === "。" || ch === "」") t += 380;
      else if (ch === "—") t += 70;
    }
    if (em) { t += 380; row.push(t); t += 700; } // 末尾 = 読み (ruby) の現れる時刻
    out.push(row);
    t += 520; // 行間の間
  }
  return { rows: out, total: Math.max(0, t - 520) };
}

export function showOpening(onDone) {
  setReduced(REDUCED);
  const wrap = div("op-overlay");
  if (REDUCED) wrap.classList.add("op-still");
  const frame = div("op-frame");
  const cv = document.createElement("canvas");
  cv.className = "op-scene";
  cv.setAttribute("aria-hidden", "true");
  frame.appendChild(cv);
  wrap.appendChild(frame);
  wrap.appendChild(div("op-veil"));
  const black = div("op-black");
  wrap.appendChild(black);

  const cap = div("op-cap");
  const capN = div("op-cap-n"), capT = div("op-cap-t");
  cap.append(capN, capT);
  wrap.appendChild(cap);

  const text = div("op-text");
  text.setAttribute("aria-live", "polite");
  wrap.appendChild(text);
  const next = div("op-next");
  next.append(div("op-next-d"));
  wrap.appendChild(next);

  const pips = div("op-pips");
  const pipEls = SCENES.map(() => { const p = div("op-pip"); pips.appendChild(p); return p; });
  wrap.appendChild(pips);

  const skip = document.createElement("button");
  skip.type = "button";
  skip.className = "op-skip";
  skip.innerHTML = "<span>スキップ</span><b>≫</b>";
  wrap.appendChild(skip);
  const hold = div("op-hold");
  hold.append(div("op-hold-r"), div("op-hold-t", "長押しでスキップ"));
  wrap.appendChild(hold);

  // 終幕の題字
  const title = div("op-title");
  const tPre = div("ttl-pre");
  tPre.append(div("ttl-rule l"), div("ttl-pre-t", "百の迷宮と"), div("ttl-rule r"));
  const tMain = div("ttl-main");
  tMain.dataset.t = "魂の王";
  tMain.appendChild(div("ttl-main-t", "魂の王"));
  const tEn = div("ttl-en");
  tEn.append(div("ttl-en-line", "HUNDRED LABYRINTHS"), div("ttl-en-line", "RISE OF THE SOUL KING"));
  title.append(tPre, tMain, tEn);
  wrap.appendChild(title);
  wrap.appendChild(div("op-begin", "物語を始める"));

  const g = cv.getContext("2d");
  const textStart = 900; // 幕が明けてから語り出すまで
  let res = null, shot = null, shotFor = -1;
  let idx = 0, t0 = 0, typedAll = false, times = null, autoT = 0, phase = "in"; // in / play / out / title / closed
  let raf = 0, last = 0;

  // 画角 (上下の闇の帯) を決め、絵の解像度を選ぶ
  const layout = () => {
    const vw = Math.max(1, wrap.clientWidth || innerWidth), vh = Math.max(1, wrap.clientHeight || innerHeight);
    const portrait = vh / vw > 1.2;
    const top = Math.round(portrait ? vh * 0.07 : vh * 0.055);
    const bh = Math.round(portrait ? vh * 0.58 : vh * 0.69);
    wrap.style.setProperty("--op-top", top + "px");
    wrap.style.setProperty("--op-bh", bh + "px");
    wrap.classList.toggle("op-portrait", portrait);
    const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
    const r = pickRes(vw, bh, dpr, { maxArea: 120000, maxW: 440 });
    const cssW = r.w * r.cssScale, cssH = r.h * r.cssScale;
    cv.style.width = cssW + "px"; cv.style.height = cssH + "px";
    cv.style.left = Math.round((vw - cssW) / 2) + "px"; cv.style.top = Math.round((bh - cssH) / 2) + "px";
    const changed = !res || res.w !== r.w || res.h !== r.h;
    res = r;
    if (changed) { cv.width = r.w; cv.height = r.h; shotFor = -1; }
  };
  const ensureShot = () => {
    if (shotFor === idx && shot) return;
    try { shot = SCENES[idx].build(res.w, res.h); } catch (e) { console.error(e); shot = null; }
    shotFor = idx;
  };

  // 語りが下の「次へ」の印・珠に被るなら、収まるまで文字を少しずつ詰める (横長の画面・長い幕)
  const fitText = () => {
    text.style.fontSize = "";
    const base = parseFloat(getComputedStyle(text).fontSize) || 16;
    let f = base;
    for (let i = 0; i < 12; i++) {
      const room = Math.min(pips.getBoundingClientRect().top, next.getBoundingClientRect().top) - 4 - text.getBoundingClientRect().top;
      const h = text.offsetHeight;
      if (room <= 0 || h <= room || f <= base * 0.7) break;
      f = Math.max(base * 0.7, f * Math.max(0.95, room / h));
      text.style.fontSize = f.toFixed(2) + "px";
    }
  };

  const renderText = () => {
    const sc = SCENES[idx];
    text.innerHTML = "";
    text.classList.remove("op-done");
    times = charTimes(sc.lines);
    const delay = (ms) => ((textStart + ms) / 1000).toFixed(3) + "s";
    sc.lines.forEach((ln, i) => {
      const em = typeof ln !== "string";
      const row = div(em ? "op-ln op-em" : "op-ln");
      const word = em ? div("op-em-w") : row;
      const brk = phraseBreaks(lineText(ln)); // 文節の切れ目にだけ折り返しの候補 (<wbr>) を置く
      [...lineText(ln)].forEach((ch, j) => {
        if (brk.has(j)) word.appendChild(document.createElement("wbr"));
        const s = document.createElement("span");
        s.className = "op-ch";
        s.textContent = ch;
        s.style.animationDelay = delay(times.rows[i][j]);
        word.appendChild(s);
      });
      if (em) {
        row.appendChild(word);
        if (ln.ruby) {
          const r = div("op-em-r", ln.ruby);
          r.style.animationDelay = delay(times.rows[i][times.rows[i].length - 1]);
          row.appendChild(r);
        }
      }
      text.appendChild(row);
    });
    fitText();
    capN.textContent = sc.cap; capT.textContent = sc.title;
    pipEls.forEach((p, i) => { p.classList.toggle("on", i === idx); p.classList.toggle("done", i < idx); });
  };

  const elapsed = () => performance.now() - t0;
  const progress = () => {
    if (typedAll) return 1;
    const e = elapsed() - textStart;
    return times && times.total > 0 ? Math.max(0, Math.min(1, e / times.total)) : 1;
  };

  const enterScene = () => {
    phase = "in";
    wrap.classList.remove("op-typed");
    cap.classList.remove("show");
    ensureShot();
    renderText();
    t0 = performance.now();
    typedAll = false;
    black.classList.remove("on");
    setTimeout(() => { if (phase !== "closed") cap.classList.add("show"); }, 500);
    phase = "play";
    clearTimeout(autoT);
    const hold = Math.max(5200, SCENES[idx].lines.map(lineText).join("").length * 45);
    autoT = setTimeout(() => { if (phase === "play" && !SCENES[idx].last) advance(true); }, textStart + times.total + hold);
  };

  const completeText = () => {
    typedAll = true;
    text.classList.add("op-done");
    wrap.classList.add("op-typed");
    if (SCENES[idx].last) showTitleCard();
  };
  // 最後の幕: 語り終えてから題字を掲げるまで、語りを読み切れるだけ待つ (タップで待たずに掲げる)
  const TITLE_WAIT = 4800;
  let titleShown = false, titleT = 0;
  const raiseTitle = () => {
    clearTimeout(titleT);
    if (phase === "closed" || phase === "title") return;
    phase = "title";
    wrap.classList.add("op-final");
    sfx("stairs");
  };
  const showTitleCard = () => {
    if (titleShown) return;
    titleShown = true;
    titleT = setTimeout(raiseTitle, REDUCED ? 2400 : TITLE_WAIT);
  };

  const advance = (auto = false) => {
    if (phase !== "play") return;
    if (!typedAll && progress() < 1) { completeText(); return; }
    if (!typedAll) completeText();
    if (SCENES[idx].last) { if (!titleShown) showTitleCard(); else raiseTitle(); return; }
    phase = "out";
    clearTimeout(autoT);
    black.classList.add("on");
    cap.classList.remove("show");
    text.classList.add("op-leave");
    setTimeout(() => {
      if (phase === "closed") return;
      text.classList.remove("op-leave");
      idx++;
      ensureShot(); // 闇の間に次の幕を描く
      enterScene();
    }, REDUCED ? 120 : 760);
    void auto;
  };

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    phase = "closed";
    clearTimeout(autoT); clearTimeout(titleT);
    removeEventListener("keydown", onKey, true);
    removeEventListener("resize", onResize);
    wrap.classList.add("op-out");
    setTimeout(() => { cancelAnimationFrame(raf); wrap.remove(); if (onDone) onDone(); }, REDUCED ? 200 : 900);
  };

  // ---- 描画ループ (約30fps) ----
  const loop = (ts) => {
    if (closed) return;
    raf = requestAnimationFrame(loop);
    if (ts - last < 32) return;
    last = ts;
    if (!shot) return;
    const sc = SCENES[idx];
    const e = elapsed();
    const dur = Math.max(9000, (times ? times.total : 0) + textStart + 4500);
    const u = REDUCED ? 0 : ease(Math.min(1, e / dur));
    const cam = { x: sc.pan.x[0] + (sc.pan.x[1] - sc.pan.x[0]) * u, y: sc.pan.y[0] + (sc.pan.y[1] - sc.pan.y[0]) * u };
    const p = progress();
    if (p >= 1 && !typedAll && phase === "play") { typedAll = true; wrap.classList.add("op-typed"); if (sc.last) showTitleCard(); }
    shot.draw(g, REDUCED ? 3000 : e, cam, p);
  };

  // ---- 入力 ----
  let pressT = 0, pressAt = 0, longFired = false;
  const down = (ev) => {
    if (ev.target === skip || skip.contains(ev.target)) return;
    pressAt = performance.now(); longFired = false;
    clearTimeout(pressT);
    hold.classList.add("on");
    pressT = setTimeout(() => { longFired = true; hold.classList.remove("on"); sfx("select"); close(); }, 900);
  };
  const up = () => { clearTimeout(pressT); hold.classList.remove("on"); };
  wrap.addEventListener("pointerdown", down);
  wrap.addEventListener("pointerup", up);
  wrap.addEventListener("pointercancel", up);
  wrap.addEventListener("pointerleave", up);
  wrap.addEventListener("click", (ev) => {
    if (closed || longFired) return;
    if (ev.target === skip || skip.contains(ev.target)) return;
    if (phase === "title") { sfx("select"); close(); return; }
    advance();
  });
  skip.addEventListener("click", (ev) => { ev.stopPropagation(); sfx("select"); close(); });
  const onKey = (e) => {
    if (closed) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault(); e.stopPropagation();
      if (phase === "title") close(); else advance();
    } else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
    else e.stopPropagation(); // オープニング中はゲームへの入力を通さない
  };
  addEventListener("keydown", onKey, true);
  let rsT = 0;
  const onResize = () => { clearTimeout(rsT); rsT = setTimeout(() => { if (!closed) { layout(); ensureShot(); fitText(); } }, 200); };
  addEventListener("resize", onResize);

  document.body.appendChild(wrap);
  black.classList.add("on", "instant");
  requestAnimationFrame(() => setTimeout(() => {
    if (closed) return;
    layout();
    black.classList.remove("instant");
    enterScene();
    raf = requestAnimationFrame(loop);
  }, 40));
}
