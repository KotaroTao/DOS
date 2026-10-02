// ===== 動きの語彙 (§4 モーション仕様) =====
// 場所が変わる = 闇 (暗転) / 掘り下げる = 横に滑る / 重ねる = 下から昇る / 褒美 = 金の閃き / 危険 = 赤・揺れ。
// 時間と緩急は ui.css の --t-* と同じ値を持つ。視差を減らす設定 (OS) では移動をやめ、短い濃淡だけにする。

export const T = {
  tap: 80,
  fast: 140,
  base: 200,
  tab: 160,
  page: 260,
  pageBack: 200,
  sheet: 280,
  sceneOut: 420,
  sceneHold: 120,
  sceneIn: 360,
  celebrate: 360,
  countUp: 400,
  deltaFloat: 900,
  reduced: 120,
};

export const EASE = {
  out: "ease-out",
  base: "cubic-bezier(.2,.7,.2,1)",
  page: "cubic-bezier(.2,.8,.2,1)",
  sheet: "cubic-bezier(.16,1,.3,1)",
  in: "cubic-bezier(.4,0,1,1)",
  inout: "ease-in-out",
  back: "cubic-bezier(.34,1.56,.64,1)",
};

// 視差を減らす設定 (OS)。途中で切り替わっても追従する
let _reduced = false;
try {
  const mq = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
  if (mq) {
    _reduced = !!mq.matches;
    const on = (e) => { _reduced = !!e.matches; };
    if (typeof mq.addEventListener === "function") mq.addEventListener("change", on);
    else if (typeof mq.addListener === "function") mq.addListener(on);
  }
} catch (e) { _reduced = false; }
export function reduced() { return _reduced; }

// Web Animations の薄い包み。使えない環境 (古い端末・DOMスタブ) では即座に終わる Promise を返す
export function animate(el, frames, opts = {}) {
  if (!el || typeof el.animate !== "function") return Promise.resolve();
  try {
    const a = el.animate(frames, { fill: "both", ...opts });
    return a.finished ? a.finished.then(() => { try { a.cancel(); } catch (e) { /* noop */ } }, () => {}) : Promise.resolve();
  } catch (e) {
    return Promise.resolve();
  }
}

// 濃淡だけの短い出入り (視差を減らす設定の代替)
function fadeIn(el, ms = T.reduced) { return animate(el, [{ opacity: 0 }, { opacity: 1 }], { duration: ms, easing: EASE.out }); }

// タブの切り替え: 160ms のクロスフェード + タブの方向へ 6px 流れる
export function tabTransition(el, dir = 0) {
  if (_reduced) return fadeIn(el);
  const dx = dir > 0 ? 6 : dir < 0 ? -6 : 0;
  return animate(el, [
    { opacity: 0, transform: `translateX(${dx}px)` },
    { opacity: 1, transform: "translateX(0)" },
  ], { duration: T.tab, easing: EASE.base });
}

// 頁の出入り: push = 右 24px から滑り込む / pop = 左から戻る (短め)
// fn を渡すと描き替えてから動かす (pageTransition(el, "push", () => render()))
export function pageTransition(el, dir = "push", fn) {
  if (typeof fn === "function") fn();
  if (_reduced) return fadeIn(el);
  const push = dir !== "pop";
  return animate(el, [
    { opacity: 0, transform: `translateX(${push ? 24 : -16}px)` },
    { opacity: 1, transform: "translateX(0)" },
  ], { duration: push ? T.page : T.pageBack, easing: EASE.page });
}

// 同じ階層での描き替え (画面の種類だけ変わる)
export function softFade(el) {
  return _reduced ? fadeIn(el) : animate(el, [{ opacity: 0.4 }, { opacity: 1 }], { duration: T.base, easing: EASE.base });
}

// シートの出入り (下から昇る / 沈む)。celebrate は中央で弾む
export function sheetIn(card, backdrop, kind = "info") {
  if (backdrop) animate(backdrop, [{ opacity: 0 }, { opacity: 1 }], { duration: _reduced ? T.reduced : T.base, easing: EASE.out });
  if (!card) return Promise.resolve();
  if (_reduced) return fadeIn(card);
  if (kind === "celebrate") {
    return animate(card, [
      { opacity: 0, transform: "scale(.92)" },
      { opacity: 1, transform: "scale(1.02)", offset: 0.7 },
      { opacity: 1, transform: "scale(1)" },
    ], { duration: T.celebrate, easing: EASE.out });
  }
  return animate(card, [
    { transform: "translateY(100%)" },
    { transform: "translateY(0)" },
  ], { duration: T.sheet, easing: EASE.sheet });
}
export function sheetOut(card, backdrop, kind = "info") {
  if (backdrop) animate(backdrop, [{ opacity: 1 }, { opacity: 0 }], { duration: _reduced ? T.reduced : T.base, easing: EASE.in });
  if (!card) return Promise.resolve();
  if (_reduced || kind === "celebrate") {
    return animate(card, [{ opacity: 1 }, { opacity: 0 }], { duration: _reduced ? T.reduced : T.base, easing: EASE.in });
  }
  return animate(card, [
    { transform: "translateY(0)" },
    { transform: "translateY(100%)" },
  ], { duration: T.base, easing: EASE.in });
}

// 揺れ (強制の決断で「戻る」を押したとき等)。視差を減らす設定では揺らさない
export function shake(el) {
  if (!el || _reduced) return Promise.resolve();
  return animate(el, [
    { transform: "translateX(0)" }, { transform: "translateX(-6px)" }, { transform: "translateX(5px)" },
    { transform: "translateX(-3px)" }, { transform: "translateX(0)" },
  ], { duration: 260, easing: "ease-out", composite: "add" });
}

// 場所の移動: 闇へ溶けて (420ms) → 闇に留まり (120ms) 描き替え → 闇から現れる (360ms)。
// 燐光 (embers) が 600ms 漂う。fn は闇の底で同期的に呼ぶ (描き替え・状態遷移)。完了で resolve
export function sceneTransition(fn, { color = "#000", embers = true } = {}) {
  if (typeof document === "undefined" || !document.body) {
    if (typeof fn === "function") fn();
    return Promise.resolve();
  }
  const veil = document.createElement("div");
  veil.className = "ui-scene-veil";
  veil.style.background = color;
  if (embers && !_reduced) {
    for (let i = 0; i < 14; i++) {
      const s = document.createElement("i");
      s.className = "ui-ember";
      s.style.left = (8 + Math.random() * 84).toFixed(1) + "%";
      s.style.animationDelay = (Math.random() * 0.5).toFixed(2) + "s";
      s.style.setProperty("--dx", ((Math.random() - 0.5) * 40).toFixed(0) + "px");
      veil.appendChild(s);
    }
  }
  document.body.appendChild(veil);
  const out = _reduced ? T.reduced : T.sceneOut;
  const hold = _reduced ? 0 : T.sceneHold;
  const inn = _reduced ? T.reduced : T.sceneIn;
  return animate(veil, [{ opacity: 0 }, { opacity: 1 }], { duration: out, easing: EASE.inout })
    .then(() => { try { if (typeof fn === "function") fn(); } catch (e) { setTimeout(() => { throw e; }); } })
    .then(() => new Promise((r) => setTimeout(r, hold)))
    .then(() => animate(veil, [{ opacity: 1 }, { opacity: 0 }], { duration: inn, easing: EASE.inout }))
    .then(() => { veil.remove(); });
}

// 金の閃き (褒美)。視差を減らす設定では 15% まで
export function goldFlash(color = "#f3d58b") {
  if (typeof document === "undefined" || !document.body) return;
  const f = document.createElement("div");
  f.className = "ui-flash";
  f.style.background = color;
  document.body.appendChild(f);
  const peak = _reduced ? 0.15 : 0.45;
  animate(f, [{ opacity: 0 }, { opacity: peak, offset: 0.3 }, { opacity: 0 }], { duration: 520, easing: "ease-out" })
    .then(() => f.remove());
}

// 数の繰り上がり (count-up)。視差を減らす設定では即座に最終値
export function countUp(node, from, to, ms = T.countUp, fmt = (v) => String(v)) {
  if (!node) return;
  if (_reduced || typeof requestAnimationFrame !== "function" || from === to) { node.textContent = fmt(to); return; }
  const t0 = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - t0) / ms);
    const e = 1 - Math.pow(1 - k, 3);
    node.textContent = fmt(Math.round(from + (to - from) * e));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// 能力値の上に ▲+2 が浮かぶ
export function deltaFloat(anchor, text, tone = "up") {
  if (!anchor || typeof document === "undefined") return;
  const r = anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : null;
  if (!r) return;
  const f = document.createElement("div");
  f.className = "ui-delta-float " + tone;
  f.textContent = text;
  f.style.left = (r.left + r.width / 2) + "px";
  f.style.top = r.top + "px";
  document.body.appendChild(f);
  if (_reduced) { setTimeout(() => f.remove(), 700); return; }
  animate(f, [
    { opacity: 0, transform: "translate(-50%, 0)" },
    { opacity: 1, transform: "translate(-50%, -10px)", offset: 0.2 },
    { opacity: 0, transform: "translate(-50%, -34px)" },
  ], { duration: T.deltaFloat, easing: "ease-out" }).then(() => f.remove());
}
