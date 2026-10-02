// タイトル画面 — 起動のたびに最初に出る「顔」
//
// 一枚絵「百の迷宮の門」(titleart.js) を低解像度で描き、整数倍で拡大して全面に敷く。
// その上に DOM で 鋳造された金と鉄のロゴ、目覚めの合図、メニューを重ねる。
//
// メニュー (はじめから / つづきから とセーブ概要) は最初から見えていて、1タップで本編へ入る
// (そのタップで音声も解禁される)。メニュー以外をタップすると目覚めの演出だけを見せる:
//   目覚めの鐘: 門が脈打ち、巨像の眼が灯り、鴉が飛び立つ
// showTitle({ hasSave, summary, onStart, onNewGame? })
//   summary: { head, lines[], sprites[] } — つづきからのカードに出す
//   onNewGame (任意): セーブがあっても「はじめから」を選べるようにする。渡されなければ隠す
import { spriteCanvas } from "./sprites.js";
import { SFX } from "./audio.js";
import { pickRes } from "./pxpaint.js";
import { TitleScene } from "./titleart.js";
import { glyphText } from "./ui/kit.js";

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

export function showTitle({ hasSave = false, summary = null, onStart, onNewGame = null } = {}) {
  const wrap = div("ttl-overlay");
  if (REDUCED) wrap.classList.add("ttl-still");
  const cv = document.createElement("canvas");
  cv.className = "ttl-scene";
  cv.setAttribute("aria-hidden", "true");
  wrap.appendChild(cv);
  wrap.appendChild(div("ttl-veil"));   // 周辺減光と粒子感
  wrap.appendChild(div("ttl-flash"));  // 目覚めの閃光

  // ---- ロゴ ----
  const ui = div("ttl-ui");
  const logo = div("ttl-logo");
  logo.setAttribute("role", "heading");
  logo.setAttribute("aria-level", "1");
  logo.setAttribute("aria-label", "百の迷宮と 魂の王");
  const pre = div("ttl-pre");
  pre.append(div("ttl-rule l"), div("ttl-pre-t", "百の迷宮と"), div("ttl-rule r"));
  const main = div("ttl-main");
  main.dataset.t = "魂の王";
  main.appendChild(div("ttl-main-t", "魂の王"));
  const en = div("ttl-en", "HUNDRED LABYRINTHS · RISE OF THE SOUL KING");
  logo.append(pre, main, en);
  ui.appendChild(logo);
  ui.appendChild(div("ttl-space"));

  // ---- 下段: 目覚めの合図 → メニュー ----
  const low = div("ttl-low");
  const tap = div("ttl-tap");
  tap.append(div("ttl-tap-j", "画面をタップ"), div("ttl-tap-e", "TOUCH TO AWAKEN"));
  low.appendChild(tap);

  const menu = div("ttl-menu " + (hasSave && summary ? "has-save" : "no-save"));
  if (hasSave && summary) {
    const sc = div("ttl-save");
    sc.appendChild(div("ttl-save-k", "冒険の記録"));
    if (summary.head) sc.appendChild(div("ttl-save-h", summary.head));
    if (summary.sprites && summary.sprites.length) {
      const row = div("ttl-party");
      for (const sp of summary.sprites.slice(0, 6)) {
        const s = document.createElement("span");
        s.className = "ttl-pm";
        try { s.appendChild(spriteCanvas(sp, 3)); } catch {}
        row.appendChild(s);
      }
      sc.appendChild(row);
    }
    const ls = div("ttl-save-ls");
    // 通貨は絵文字ではなく小さな硬貨・魂玉の印で
    for (const ln of summary.lines || []) { const d = div("ttl-save-l"); d.appendChild(glyphText(ln)); ls.appendChild(d); }
    sc.appendChild(ls);
    menu.appendChild(sc);
  }
  const btns = div("ttl-btns");
  const mkBtn = (label, sub, cls) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "ttl-btn " + cls;
    b.append(div("ttl-btn-t", label));
    if (sub) b.append(div("ttl-btn-s", sub));
    return b;
  };
  let goBtn, newBtn = null;
  if (hasSave) {
    goBtn = mkBtn("つづきから", "CONTINUE", "primary");
    btns.appendChild(goBtn);
    if (typeof onNewGame === "function") {
      newBtn = mkBtn("はじめから", "NEW GAME", "");
      btns.appendChild(newBtn);
    }
  } else {
    goBtn = mkBtn("はじめから", "NEW GAME", "primary");
    btns.appendChild(goBtn);
    const dis = mkBtn("つづきから", "記録なし", "off");
    dis.disabled = true;
    btns.appendChild(dis);
  }
  menu.appendChild(btns);
  menu.appendChild(div("ttl-note", hasSave ? "進行は自動で保存されています" : "ホーム画面に追加すると、オフラインでも遊べます"));
  low.appendChild(menu);
  ui.appendChild(low);
  wrap.appendChild(ui);

  // 「はじめから」(セーブあり) の確認
  const confirmBox = div("ttl-confirm hidden");
  confirmBox.append(div("ttl-confirm-t", "いまの記録を消して、最初から始めますか？"), div("ttl-confirm-s", "消した記録は二度と戻りません。"));
  const cRow = div("ttl-confirm-row");
  const cYes = mkBtn("消して始める", null, "danger");
  const cNo = mkBtn("やめる", null, "");
  cRow.append(cNo, cYes);
  confirmBox.appendChild(cRow);
  wrap.appendChild(confirmBox);

  // ---- 一枚絵 ----
  let scene = null, resKey = "", lastTs = 0, building = 0;
  const layoutScene = async () => {
    const vw = Math.max(1, wrap.clientWidth || innerWidth), vh = Math.max(1, wrap.clientHeight || innerHeight);
    const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
    const r = pickRes(vw, vh, dpr, { maxArea: 150000, maxW: 480 });
    const cssW = r.w * r.cssScale, cssH = r.h * r.cssScale;
    const offY = (vh - cssH) / 2, offX = (vw - cssW) / 2;
    // ロゴの下端とメニューの上端・左端を絵の座標へ (主題をその間に収める)
    const wr = wrap.getBoundingClientRect();
    const lb = logo.getBoundingClientRect().bottom - wr.top;
    const mr = menu.getBoundingClientRect();
    const mt = mr.top - wr.top;
    const toArt = (y) => (y - offY) / r.cssScale;
    const top = Math.max(0, toArt(lb));
    const bot = Math.min(r.h, toArt(mt > lb + 40 ? mt : vh * 0.8));
    const ml = (mr.left - wr.left - offX) / r.cssScale;
    const key = `${r.w}x${r.h}:${Math.round(top / 4)}:${Math.round(bot / 4)}:${Math.round(ml / 4)}`;
    if (key === resKey && scene) return;
    resKey = key;
    const token = ++building;
    const next = await TitleScene.create(r.w, r.h, { top, bot, ml }, REDUCED);
    if (token !== building || closed) return; // より新しい配置が来た / 閉じた
    const wasAwake = scene && scene.awakeAt >= 0;
    scene = next;
    if (wasAwake) scene.awakeAt = 0;
    cv.width = r.w; cv.height = r.h;
    cv.style.width = cssW + "px"; cv.style.height = cssH + "px";
    cv.style.left = offX + "px"; cv.style.top = offY + "px";
    const gx = (scene.A.gx * r.cssScale + offX) / vw * 100, gy = (scene.A.vp.y * r.cssScale + offY) / vh * 100;
    wrap.style.setProperty("--gate-x", gx.toFixed(1) + "%");
    wrap.style.setProperty("--gate-y", gy.toFixed(1) + "%");
    scene.draw(g, performance.now(), 16);
  };
  const g = cv.getContext("2d");
  let closed = false;

  let awake = false, raf = 0;
  const loop = (ts) => {
    if (closed) return;
    raf = requestAnimationFrame(loop);
    if (ts - lastTs < 32) return; // 約30fps (低解像度の絵には十分)
    const dt = lastTs ? Math.min(100, ts - lastTs) : 16;
    lastTs = ts;
    if (scene) scene.draw(g, ts, dt);
  };
  let rsT = 0;
  const onResize = () => { clearTimeout(rsT); rsT = setTimeout(() => { if (!closed) layoutScene().catch((e) => console.error(e)); }, 180); };

  const close = (cb) => {
    if (closed) return;
    closed = true;
    removeEventListener("keydown", onKey, true);
    removeEventListener("resize", onResize);
    wrap.classList.add("ttl-out");
    // 門の奥へ吸い込まれるように暗転してから本編へ
    setTimeout(() => { cancelAnimationFrame(raf); if (cb) cb(); }, REDUCED ? 60 : 520);
    setTimeout(() => wrap.remove(), REDUCED ? 400 : 1500);
  };
  const start = () => { sfx("stairs"); close(onStart); };
  // メニューは最初から見えている。「つづきから/はじめから」は1タップで始まる (そのタップで音声も目覚める)。
  // それ以外の場所をタップすると、目覚めの演出 (鐘・門の脈動・鴉) だけを見せる
  const wake = () => {
    if (awake) return;
    awake = true;
    wrap.classList.add("ttl-awake");
    sfx("select");
    if (scene && !REDUCED) scene.wake(performance.now());
  };
  goBtn.addEventListener("click", (e) => { e.stopPropagation(); start(); });
  if (newBtn) newBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    sfx("select");
    confirmBox.classList.remove("hidden");
    wrap.classList.add("ttl-confirming");
  });
  cNo.addEventListener("click", (e) => { e.stopPropagation(); sfx("select"); confirmBox.classList.add("hidden"); wrap.classList.remove("ttl-confirming"); });
  cYes.addEventListener("click", (e) => { e.stopPropagation(); sfx("stairs"); close(onNewGame); });
  confirmBox.addEventListener("click", (e) => e.stopPropagation());
  wrap.addEventListener("click", () => { if (!awake) wake(); });
  const onKey = (e) => {
    if (closed) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault(); e.stopPropagation();
      if (!confirmBox.classList.contains("hidden")) return;
      const a = document.activeElement;
      if (a && a.classList && a.classList.contains("ttl-btn") && wrap.contains(a)) { a.click(); return; }
      start();
    } else e.stopPropagation(); // タイトル表示中はゲームへの入力を通さない
  };
  addEventListener("keydown", onKey, true);
  addEventListener("resize", onResize);

  document.body.appendChild(wrap);
  // 一枚絵は数百 ms かかることがあるので、ロゴの入りを先に見せてから描く
  requestAnimationFrame(() => setTimeout(async () => {
    if (closed) return;
    try { await layoutScene(); } catch (e) { console.error(e); }
    if (closed) return;
    wrap.classList.add("ttl-ready");
    try { goBtn.focus({ preventScroll: true }); } catch {}
    if (!REDUCED) raf = requestAnimationFrame(loop);
  }, 30));
}
