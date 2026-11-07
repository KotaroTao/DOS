import { watchIllustration } from "./imageloading.js";
// タイトル画面 — 起動のたびに最初に出る「顔」
//
// 一枚絵「百の迷宮の門」を全面に敷く。描き下ろしの原画 (titlekeyart.js の台帳) があれば titlepaint.js が
// 画面の解像度のまま滑らかに動かし、無ければ titleart.js のドット絵を低解像度で描いて整数倍で拡大する。
// その上に DOM で 鋳造された金と鉄のロゴ、目覚めの合図、メニューを重ねる。
//
// メニューは最初から見え、新規は名前入力、再開は1タップで本編へ入る
// (そのタップで音声も解禁される)。メニュー以外をタップすると目覚めの演出だけを見せる:
//   目覚めの鐘: 門が脈打ち、巨像の眼が灯り、鴉が飛び立つ
// showTitle({ hasSave, summary, onStart, onNewGame? })
//   summary: { head, lines[], sprites[] } — つづきからのカードに出す
//   onNewGame (任意): セーブがある時に「データ削除」を選べるようにする。渡されなければ隠す
import { normalizeName, NAME_LIMIT } from "./protagonist.js";
import { spriteCanvas } from "./sprites.js";
import { SFX } from "./audio.js";
import { pickRes } from "./pxpaint.js";
import { TitleScene } from "./titleart.js";
import { PaintedTitle, hasPaintedTitle } from "./titlepaint.js";
import { glyphText } from "./ui/kit.js";
import { showLegal } from "./legal.js";
import { cloudEnabled } from "./cloud-save.js";

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

export function showTitle({ hasSave = false, summary = null, onStart, entry = false, autoStart = false, onLogin = null, onNewGame = null, startName = "" } = {}) {
  const readyName = hasSave ? "" : normalizeName(startName);
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
  const en = div("ttl-en");
  en.append(div("ttl-en-line", "HUNDRED LABYRINTHS"), div("ttl-en-line", "RISE OF THE SOUL KING"));
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
      newBtn = mkBtn("データ削除", "", "danger");
      btns.appendChild(newBtn);
    }
  } else {
    goBtn = mkBtn(readyName ? "物語を始める" : "冒険を始める", "NEW GAME", "primary");
    btns.appendChild(goBtn);
  }
  if (onLogin) {
    const login = mkBtn("ログイン", "登録済みの方", "");
    login.onclick = e => { e.stopPropagation(); close(onLogin); };
    btns.appendChild(login);
  }
  menu.appendChild(btns);
  menu.appendChild(div("ttl-note", cloudEnabled() ? (entry ? "メール登録なしでも遊べます。オンライン接続が必要です" : "冒険の記録に接続済み") : hasSave ? "進行は自動で保存されています" : "ホーム画面に追加すると、オフラインでも遊べます"));
  const legalLinks = div("ttl-legal");
  for (const kind of ["terms", "privacy"]) {
    const legal = mkBtn(kind === "terms" ? "利用規約" : "プライバシーポリシー", null, "");
    legal.onclick = e => { e.stopPropagation(); showLegal(kind); };
    legalLinks.appendChild(legal);
  }
  menu.appendChild(legalLinks);
  low.appendChild(menu);
  ui.appendChild(low);
  wrap.appendChild(ui);

  // データ削除は名前入力を挟まず、取消を既定とする確認を表示する。
  const confirmBox = div("ttl-confirm hidden");
  confirmBox.setAttribute("role", "alertdialog");
  confirmBox.setAttribute("aria-modal", "true");
  confirmBox.setAttribute("aria-label", "データ削除の確認");
  confirmBox.append(div("ttl-confirm-t", "この記録を消して、最初から始めますか？"), div("ttl-confirm-s", "消した記録は二度と戻りません。"));
  const cRow = div("ttl-confirm-row");
  const cYes = mkBtn("消して始める", null, "danger");
  const cNo = mkBtn("やめる", null, "");
  cRow.append(cNo, cYes);
  confirmBox.appendChild(cRow);
  wrap.appendChild(confirmBox);

  // 新しい冒険の名前を決める。
  let pendingName = "";
  const nameBox = document.createElement("form");
  nameBox.className = "ttl-confirm ttl-name hidden";
  nameBox.setAttribute("role", "dialog");
  nameBox.setAttribute("aria-modal", "true");
  nameBox.setAttribute("aria-label", "弟子の名前");
  nameBox.append(div("ttl-confirm-t", "オルドの弟子として、旅を始める"));
  const nameLabel = document.createElement("label");
  nameLabel.className = "ttl-test-field";
  const nameInput = document.createElement("input");
  nameInput.type = "text"; nameInput.autocomplete = "off";
  nameInput.maxLength = NAME_LIMIT * 2;
  nameInput.setAttribute("aria-describedby", "apprentice-name-help");
  nameLabel.append(div("", "弟子の名前"), nameInput);
  const nameHelp = div("ttl-note", `1〜${NAME_LIMIT}文字。あなた自身の名前です。人業の名前は、館で別につけます。`);
  nameHelp.id = "apprentice-name-help";
  const nameError = div("ttl-confirm-s", "");
  nameError.setAttribute("role", "alert");
  const nameRow = div("ttl-confirm-row");
  const nameBack = mkBtn("戻る", null, ""); nameBack.type = "button";
  const nameGo = mkBtn("旅を始める", null, "primary"); nameGo.type = "submit";
  nameRow.append(nameBack, nameGo);
  nameBox.append(nameLabel, nameHelp, nameError, nameRow);
  wrap.appendChild(nameBox);
  const askName = () => {
    nameError.textContent = "";
    nameBox.classList.remove("hidden"); wrap.classList.add("ttl-confirming");
    nameInput.focus();
  };
  const hideName = () => {
    nameBox.classList.add("hidden"); wrap.classList.remove("ttl-confirming");
    (hasSave ? newBtn : goBtn)?.focus();
  };
  nameBack.addEventListener("click", hideName);
  nameBox.addEventListener("click", e => e.stopPropagation());
  nameBox.addEventListener("submit", e => {
    e.preventDefault(); e.stopPropagation();
    if (e.isComposing) return;
    pendingName = normalizeName(nameInput.value);
    if (!pendingName) { nameError.textContent = "名前を入力してください。"; nameInput.focus(); return; }
    if (Array.from(nameInput.value.normalize("NFC").trim()).length > NAME_LIMIT) {
      nameError.textContent = `名前は${NAME_LIMIT}文字以内で入力してください。`; nameInput.focus(); return;
    }
    nameInput.value = pendingName;
    if (hasSave) {
      nameBox.classList.add("hidden"); confirmBox.classList.remove("hidden"); cNo.focus();
    } else { sfx("stairs"); close(() => onStart(pendingName), true); }
  });

  // ---- 一枚絵 ----
  // 描き下ろしの原画があれば画面の解像度のまま滑らかに (titlepaint.js)、無ければドット絵 (titleart.js)
  let scene = null, resKey = "", lastTs = 0, building = 0;
  const painted = hasPaintedTitle();
  const layoutPainted = async (vw, vh) => {
    const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    const wr = wrap.getBoundingClientRect();
    const band = { top: logo.getBoundingClientRect().bottom - wr.top, bot: menu.getBoundingClientRect().top - wr.top };
    const pick = vw / vh < 1 ? "tall" : "wide";
    const key = `hd:${vw}x${vh}:${dpr}:${Math.round(band.top / 8)}:${Math.round(band.bot / 8)}`;
    if (key === resKey && scene) return;
    resKey = key;
    const token = ++building;
    // 縦横の向きが変わった時だけ原画を選び直す (同じ原画なら配置だけ直す)
    let next = scene && scene.pick === pick ? scene : null;
    if (!next) {
      const ready = PaintedTitle.create(vw, vh, REDUCED);
      watchIllustration(wrap, ready, wrap);
      next = await ready; next.pick = pick;
    }
    if (token !== building || closed) return;
    const wasAwake = scene && scene.awakeAt >= 0;
    scene = next;
    if (wasAwake) scene.awakeAt = 0;
    scene.layout(vw, vh, dpr, band);
    cv.classList.add("hd"); wrap.classList.add("ttl-hd");
    cv.width = Math.round(vw * dpr); cv.height = Math.round(vh * dpr);
    cv.style.width = vw + "px"; cv.style.height = vh + "px";
    cv.style.left = "0px"; cv.style.top = "0px";
    const gp = scene.gatePoint();
    wrap.style.setProperty("--gate-x", (gp.x / vw * 100).toFixed(1) + "%");
    wrap.style.setProperty("--gate-y", (gp.y / vh * 100).toFixed(1) + "%");
    scene.draw(g, performance.now(), 16);
    wrap.dataset.sceneReady = "true";
  };
  const layoutScene = async () => {
    const vw = Math.max(1, wrap.clientWidth || innerWidth), vh = Math.max(1, wrap.clientHeight || innerHeight);
    if (painted) {
      try { return await layoutPainted(vw, vh); } catch (e) {
        console.error(e); // 原画が読めなくても旧イラストへ戻さない。
        scene = null; resKey = "";
        g.clearRect(0, 0, cv.width, cv.height);
        return;
      }
    }
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
    wrap.dataset.sceneReady = "true";
  };
  const g = cv.getContext("2d");
  let closed = false;

  let awake = false, raf = 0;
  const loop = (ts) => {
    if (closed) return;
    raf = requestAnimationFrame(loop);
    if (ts - lastTs < (painted ? 15 : 32)) return; // ドット絵は約30fps で十分。原画は粒を滑らかに
    const dt = lastTs ? Math.min(100, ts - lastTs) : 16;
    lastTs = ts;
    if (scene) scene.draw(g, ts, dt);
  };
  let rsT = 0;
  const onResize = () => { clearTimeout(rsT); rsT = setTimeout(() => { if (!closed) layoutScene().catch((e) => console.error(e)); }, 180); };

  const close = (cb, immediate = false) => {
    if (closed) return;
    closed = true;
    removeEventListener("keydown", onKey, true);
    removeEventListener("resize", onResize);
    wrap.classList.add("ttl-depart");
    cancelAnimationFrame(raf);
    const ready = immediate && cb ? cb() : null;
    // 新規開始は音声の再生許可を保つため同期で渡し、再開は暗転を待つ。
    setTimeout(async () => {
      const ok = await (immediate ? ready : cb?.());
      if (ok === false) return;
      // 準備後は幕を直接外す。タイトルを透かしたり描き直したりしない。
      wrap.remove();
    }, REDUCED ? 60 : 520);
  };
  const start = () => {
    if (entry) { sfx("stairs"); close(onStart); return; }
    // 記録消去後は名前を引き継ぎ、この操作の中で語りを始める。
    if (readyName) { sfx("stairs"); close(() => onStart(readyName), true); return; }
    if (!hasSave) { askName(); return; }
    sfx("stairs"); close(onStart);
  };
  // 新規は名前入力へ、再開はそのまま本編へ (タップで音声も目覚める)。
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
    confirmBox.classList.remove("hidden"); wrap.classList.add("ttl-confirming"); cNo.focus();
  });
  cNo.addEventListener("click", (e) => { e.stopPropagation(); sfx("select"); confirmBox.classList.add("hidden"); wrap.classList.remove("ttl-confirming"); newBtn?.focus(); });
  cYes.addEventListener("click", (e) => { e.stopPropagation(); sfx("stairs"); close(() => onNewGame(pendingName)); });
  confirmBox.addEventListener("click", (e) => e.stopPropagation());
  wrap.addEventListener("click", () => { if (!awake) wake(); });
  const onKey = (e) => {
    if (document.querySelector(".legal-dialog[open]")) return;
    if (closed) return;
    if (!nameBox.classList.contains("hidden")) {
      e.stopPropagation();
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === "Tab") {
        const fields = [nameInput, nameBack, nameGo];
        const i = fields.indexOf(document.activeElement);
        e.preventDefault(); fields[(i + (e.shiftKey ? 2 : 1)) % fields.length].focus();
      }
      if (e.key === "Escape") { e.preventDefault(); hideName(); }
      if (e.key === "Enter" && e.target === nameInput) { e.preventDefault(); nameBox.requestSubmit(); }
      return;
    }
    if (!confirmBox.classList.contains("hidden")) {
      e.stopPropagation();
      if (e.key === "Escape") { e.preventDefault(); cNo.click(); }
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (document.activeElement === cYes) cYes.click(); else cNo.click(); }
      return;
    }
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
  if (autoStart) queueMicrotask(start);
  // 一枚絵は数百 ms かかることがあるので、ロゴの入りを先に見せてから描く
  requestAnimationFrame(() => setTimeout(async () => {
    if (closed) return;
    try { await layoutScene(); } catch (e) { console.error(e); }
    if (closed) return;
    wrap.classList.add("ttl-ready");
    try { if (!wrap.classList.contains("ttl-confirming") && !wrap.contains(document.activeElement)) goBtn.focus({ preventScroll: true }); } catch {}
    if (!REDUCED) raf = requestAnimationFrame(loop);
  }, 30));
}
