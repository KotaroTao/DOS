// ===== 「戻る」の一本化 (§3.2) =====
// ヘッダの ‹ ・ Escape ・ Android/ブラウザの戻る は、すべて nav.back() に集まる。
//
// 履歴 (history API) の扱い: 戻る操作を受けるための「番兵」履歴を常に1枚だけ積んでおく。
//   [base] [guard] ← いまここ
// 戻るを押すと base へ移り popstate が来る → nav.back() で処理し、すぐに番兵を積み直す。
// UI 側で閉じた時は履歴に触れない (history.back() の非同期と push の競合・二重 pop が起きない)。
// 街の根で何も閉じるものが無い時だけ「もう一度で閉じる」を出し、2秒間は番兵を積み直さない
// (その間にもう一度押せばアプリを閉じられる)。2秒経つか、何か操作すれば再び番兵を積む。
//
// 処理の順:
//   1) 積み重ね (stack): 開いているシート・ページ (上から)
//   2) 登録された handler (game.js の旧画面アダプタなど。prio の小さい順)。true を返せば消費
//   3) どれも消費しなければ「根」

const stack = [];          // { id, onBack }
const handlers = [];       // { prio, fn }
let rootToast = null;      // (text) => void  … kit が登録
let inited = false;
let exitArmedUntil = 0;
let rearmTimer = null;

const hasHistory = () => typeof history !== "undefined" && history && typeof history.pushState === "function";
const GUARD = { dos: "guard" };
const BASE = { dos: "base" };

function rearm() {
  if (!hasHistory()) return;
  if (rearmTimer) { clearTimeout(rearmTimer); rearmTimer = null; }
  exitArmedUntil = 0;
  try {
    if (!history.state || history.state.dos !== "guard") history.pushState(GUARD, "");
  } catch (e) { /* 履歴が使えない環境 */ }
}

function onPopState(e) {
  const st = e && e.state;
  if (st && st.dos === "guard") return; // 進む操作で番兵へ戻っただけ
  // 「もう一度で閉じる」の猶予中にもう一度押された: 残っている自前の履歴を越えて、そのまま閉じる
  if (exitArmedUntil && Date.now() < exitArmedUntil) {
    if (st && st.dos === "base") { try { history.back(); } catch (e) { /* noop */ } }
    return;
  }
  const consumed = back();
  if (consumed) { rearm(); return; }
  // 根: 2秒以内にもう一度押せば閉じられる (この間は番兵を積まない)
  exitArmedUntil = Date.now() + 2000;
  if (rootToast) rootToast("もう一度で閉じる");
  if (rearmTimer) clearTimeout(rearmTimer);
  rearmTimer = setTimeout(rearm, 2000);
}

export const nav = {
  // 起動時に一度。番兵を積み、popstate を受ける
  init() {
    if (inited) return;
    inited = true;
    if (!hasHistory() || typeof addEventListener !== "function") return;
    try {
      if (!history.state || history.state.dos !== "guard") {
        history.replaceState(BASE, "");
        history.pushState(GUARD, "");
      }
    } catch (e) { /* noop */ }
    addEventListener("popstate", onPopState);
    // 何か操作したら番兵を積み直す (「もう一度で閉じる」の猶予を打ち切る)。
    // 最初の操作でも積み直す: 操作前に積んだ履歴を飛ばすブラウザの介入への保険
    let gestured = false;
    const touch = () => {
      if (!gestured) {
        // 最初の操作で番兵を積み直す (ユーザー操作なしで積んだ履歴は「戻る」で飛ばされることがあるため)
        gestured = true;
        try { history.replaceState(BASE, ""); history.pushState(GUARD, ""); exitArmedUntil = 0; } catch (e) { /* noop */ }
        return;
      }
      if (exitArmedUntil || !history.state || history.state.dos !== "guard") rearm();
    };
    addEventListener("pointerdown", touch, true);
    addEventListener("keydown", touch, true);
    // アプリが前面へ戻った時も番兵を確かめる (iOS/Android の復帰)
    addEventListener("pageshow", () => { if (!history.state || history.state.dos !== "guard") rearm(); });
  },

  // 積み重ねに載せる (シート・ページ)。返り値を remove に渡す
  push(entry) {
    const e = { id: entry && entry.id || "entry", onBack: entry && entry.onBack };
    stack.push(e);
    if (exitArmedUntil) rearm();
    return e;
  },
  remove(entry) {
    const i = stack.lastIndexOf(entry);
    if (i >= 0) stack.splice(i, 1);
  },
  // 互換: UI 側で閉じた (履歴には触れない)
  pop(entry) { nav.remove(entry); },
  depth() { return stack.length; },
  top() { return stack[stack.length - 1] || null; },

  // 文脈ごとの「戻る」処理を登録する。fn() が true を返せば消費、"root" を返せば根として扱う
  handle(fn, prio = 50) {
    handlers.push({ prio, fn });
    handlers.sort((a, b) => a.prio - b.prio);
    return () => { const i = handlers.findIndex((h) => h.fn === fn); if (i >= 0) handlers.splice(i, 1); };
  },

  setRootToast(fn) { rootToast = fn; },

  // 戻る。何かを閉じた/処理したなら true。根なら false
  back() { return back(); },

  // 「戻る」1回分の履歴を UI 側から起こす (ヘッダの ‹ は nav.back() を直接呼べばよいので通常は不要)
  goBack() { back(); },
};

function back() {
  const top = stack[stack.length - 1];
  if (top) {
    try { if (typeof top.onBack === "function") top.onBack(); else nav.remove(top); } catch (e) { setTimeout(() => { throw e; }); }
    return true;
  }
  for (const h of handlers.slice()) {
    let r = false;
    try { r = h.fn(); } catch (e) { setTimeout(() => { throw e; }); r = true; }
    if (r === "root") return false; // 根として扱わせる (タイトル画面など)
    if (r) return true;
  }
  return false;
}
