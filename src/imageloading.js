// 表示に必要な画像だけをまとめ、画面左下の館の灯で知らせる。
import { CANDLE_IMAGE } from "./loadingcandle.js";

const entries = new Map(), imagePromises = new WeakMap();
let lamp = null, timer = 0, scheduled = false, waitingSince = null;
const LAMP_DELAY = 400;
let reloadHandler = () => location.reload();
let reloading = false;
export function setIllustrationReload(handler) { reloadHandler = handler; }
async function reloadIllustrations(event) {
  if (reloading) return;
  reloading = true;
  const button = event.currentTarget;
  button.disabled = true;
  try { await reloadHandler(); }
  finally { reloading = false; button.disabled = false; }
}
const scenes = new WeakMap();
let redrawn = false, blockingNow = false, screenSince = null;
const SCREEN_DELAY = 200;
function visible(node) {
  if (!node?.isConnected || !node.getClientRects?.().length) return false;
  const rect = node.getBoundingClientRect();
  if (rect.bottom <= 0 || rect.right <= 0 || rect.top >= innerHeight || rect.left >= innerWidth) return false;
  if (node.closest(".scene-next")) return true;
  return !node.closest('[hidden], .hidden') && getComputedStyle(node).visibility !== "hidden";
}
function ensureLamp() {
  if (lamp || !document.body) return;
  lamp = document.querySelector(".image-loading");
  if (lamp) return;
  lamp = document.createElement("div");
  lamp.className = "image-loading";
  lamp.dataset.state = "idle";
  lamp.setAttribute("role", "status");
  lamp.setAttribute("aria-live", "polite");
  for (const part of ["body", "flame"]) {
    const image = document.createElement("img");
    image.src = CANDLE_IMAGE; image.alt = "";
    image.className = `image-loading-${part}`;
    image.setAttribute("aria-hidden", "true");
    lamp.appendChild(image);
  }
  const label = document.createElement("span");
  label.className = "image-loading-label";
  lamp.appendChild(label);
  document.body.appendChild(lamp);
}
function schedule() {
  if (scheduled || typeof document === "undefined") return;
  scheduled = true;
  // 同じ描画内の要求をまとめ、ブラウザが描く前に待機表示を決める。
  queueMicrotask(() => { scheduled = false; update(); });
}
function update() {
  clearTimeout(timer); timer = 0;
  let pending = false, failed = false, blocking = false, screenPending = false, screenFailed = false;
  const now = Date.now();
  for (const [key, entry] of entries) {
    let shown = now - entry.used < 300;
    for (const [node, used] of entry.liveOwners) {
      if (now - used < 300 && visible(node)) shown = true;
      if (!node.isConnected || now - used >= 1000) entry.liveOwners.delete(node);
    }
    for (const [node, seen] of entry.owners) {
      if (visible(node)) { shown = true; entry.owners.set(node, true); }
      else if (!node.isConnected && (seen || now - entry.created > 1000)) entry.owners.delete(node);
    }
    // 到着済みの画像のために待ち時間を足さない。
    if (entry.state === "ready" || !entry.owners.size && !entry.liveOwners.size && now - entry.used >= 1000) {
      entries.delete(key); continue;
    }
    if (shown) {
      pending ||= entry.state === "pending";
      failed ||= entry.state === "error";
      const title = [...entry.owners.keys()].some(node => node.classList?.contains("ttl-overlay") && !node.dataset.sceneReady);
      if (entry.blocking || title) blocking ||= entry.state !== "ready";
      if (entry.screen || title) {
        screenPending ||= entry.state === "pending";
        screenFailed ||= entry.state === "error";
      }
    }
  }
  const booting = document.body.classList.contains("booting");
  const wasBlocking = blockingNow;
  blockingNow = blocking || booting;
  if (blockingNow) redrawn = false;
  if (!redrawn && !blockingNow && wasBlocking) {
    redrawn = true;
    document.dispatchEvent(new Event("illustrations-ready"));
    // 描き直しで別の画像が必要になれば、次のmicrotaskで確認してから幕を開く。
    if (scheduled) { blockingNow = wasBlocking; return; }
  }
  // 小さな画像待ちは全画面を覆わない。区切りの短い待機も画面を明滅させない。
  if (screenPending) screenSince ??= now;
  else screenSince = null;
  document.body.classList.toggle("screen-loading", booting || screenFailed || screenPending && now - screenSince >= SCREEN_DELAY);
  const splash = document.getElementById("media-splash");
  if (splash) {
    const state = screenFailed ? "error" : "loading";
    if (splash.dataset.state !== state) splash.dataset.state = state;
    const message = screenFailed ? "画像を読み込めませんでした。接続を確かめて再試行してください。" : "";
    const label = splash.querySelector(".media-message"), retry = splash.querySelector(".media-retry");
    if (label.textContent !== message) label.textContent = message;
    if (retry.hidden === screenFailed) retry.hidden = !screenFailed;
  }
  if (pending || booting) waitingSince ??= now;
  else waitingSince = null;
  const state = document.hidden ? "idle" : booting || pending && now - waitingSince >= LAMP_DELAY ? "loading" : failed ? "error" : "idle";
  // 起動用の灯も引き継ぐ。画像が即座に届いた場合でも消し忘れない。
  if (!lamp) lamp = document.querySelector(".image-loading");
  if (state !== "idle") ensureLamp();
  if (lamp && lamp.dataset.state !== state) {
    lamp.dataset.state = state;
    lamp.querySelector(".image-loading-label").textContent = state === "loading" ? "画像を読み込んでいます" : state === "error" ? "画像を読み込めませんでした" : "";
  }
  if (failed) {
    ensureLamp();
    if (lamp && !lamp.querySelector(".image-loading-retry")) {
      const retry = document.createElement("button");
      retry.type = "button"; retry.className = "image-loading-retry";
      retry.textContent = "画像を再読み込み";
      retry.addEventListener("click", reloadIllustrations);
      lamp.insertBefore(retry, lamp.querySelector(".image-loading-label"));
    }
  }
  if (!document.hidden && (pending || [...entries.values()].some(entry => entry.liveOwners.size || now - entry.used < 1000))) timer = setTimeout(update, 120);
}
// 表示待ちの間は入力と自動進行を止める。
export function mediaBusy() {
  return typeof document !== "undefined" && (blockingNow || document.body?.classList.contains("booting"));
}
// 階の準備はCanvasの表示・非表示によらず待つ。完了した要求はupdateで取り除く。
export function holdIllustrations(key, ready, { screen = true } = {}) {
  watchIllustration(key, ready, document.body, false, { blocking: true, screen });
}
export function sceneReady(owner, ready) {
  const state = { pending: true, ready: Promise.resolve(ready) };
  scenes.set(owner, state);
  state.ready.then(() => { state.pending = false; }, () => { state.pending = false; });
}
// 描き替える前の画面を一時的に保持する。Canvasの画素も写し、待機中の二重操作を防ぐ。
export function preserveScene(root) {
  if (!root?.children.length) return () => {};
  const previous = root.querySelector(".scene-hold") || root;
  // 控え室へ移す生きたCanvasもあるため、配置は描き替えより前に写す。
  const snapshot = previous.cloneNode(true);
  const originals = previous.querySelectorAll("canvas"), copies = snapshot.querySelectorAll("canvas");
  const oldScroll = previous.scrollTop;
  return () => {
    for (const image of root.querySelectorAll("img[src]")) watchImage(image, image);
    const waits = [...root.querySelectorAll("canvas, img")].filter(visible).map(node => scenes.get(node)).filter(state => state?.pending);
    if (!waits.length || !root.isConnected) return;
    // 画素のコピーは背景を待つ時だけ行う。
    originals.forEach((canvas, i) => {
      if (canvas.width && canvas.height) copies[i].getContext("2d")?.drawImage(canvas, 0, 0);
    });
    snapshot.removeAttribute("id");
    snapshot.classList.add("scene-hold");
    for (const node of snapshot.querySelectorAll("[id]")) node.removeAttribute("id");
    snapshot.inert = true;
    snapshot.setAttribute("aria-hidden", "true");
    // 古い画面は見せるだけ。新しい画面のボタンへ入力を通さない。
    // DOMの移し替えで内側の一覧が先頭へ戻るブラウザでも、表示位置を保つ。
    const keepScroll = () => {
      const positions = [...root.querySelectorAll("*")].filter(node => node.scrollTop || node.scrollLeft)
        .map(node => [node, node.scrollTop, node.scrollLeft]);
      return () => { for (const [node, top, left] of positions) { node.scrollTop = top; node.scrollLeft = left; } };
    };
    const restoreScroll = keepScroll();
    const content = document.createElement("div");
    content.className = "scene-next";
    while (root.firstChild) content.appendChild(root.firstChild);
    content.inert = true;
    root.append(content, snapshot);
    restoreScroll();
    snapshot.scrollTop = oldScroll;
    const release = () => {
      if (snapshot.parentNode !== root) return;
      const restore = keepScroll();
      snapshot.remove();
      content.inert = false;
      content.replaceWith(...content.childNodes);
      restore();
    };
    // 遅延や失敗だけで空の次画面へ進めない。タブ移動と左下の再試行は利用できる。
    Promise.allSettled(waits.map(state => state.ready)).then(results => {
      if (results.every(result => result.status === "fulfilled" && result.value !== false)) requestAnimationFrame(release);
    });
  };
}
// owner は表示する Canvas/要素。毎フレーム描く画像は省略して、その間だけ灯を出す。
export function watchIllustration(key, ready, owner = null, live = false, { blocking = false, screen = false } = {}) {
  if (!key || !ready || typeof document === "undefined") return;
  let entry = entries.get(key);
  if (!entry || entry.ready !== ready) {
    entry = { ready, state: "pending", owners: entry?.owners || new Map(), liveOwners: entry?.liveOwners || new Map(), used: 0, created: Date.now() };
    entries.set(key, entry);

    const deadline = setTimeout(() => { entry.state = "error"; schedule(); }, 30000);
    Promise.resolve(ready).then(ok => { clearTimeout(deadline); entry.state = ok === false ? "error" : "ready"; schedule(); },
      () => { clearTimeout(deadline); entry.state = "error"; schedule(); });
  }
  if (owner && !live && owner !== document.body && scenes.get(owner)?.ready !== ready) sceneReady(owner, ready);
  entry.blocking ||= blocking; entry.screen ||= screen;
  if (owner && live) entry.liveOwners.set(owner, Date.now());
  else if (owner) entry.owners.set(owner, entry.owners.get(owner) || false);
  else entry.used = Date.now();
  schedule();
}
export function watchImage(image, owner = null, live = false) {
  if (!image || !image.addEventListener) return;
  if (image.complete && image.naturalWidth > 0 && imagePromises.get(image)?.decoded) return;
  let ready = imagePromises.get(image);
  if (!ready) {
    ready = new Promise(resolve => {
      if (image.complete && image.src) {
        if (!image.naturalWidth) { resolve(false); return; }
        Promise.resolve(image.decode?.()).then(() => resolve(true), () => resolve(false)); return;
      }
      const finish = async ok => {
        image.removeEventListener("load", loaded); image.removeEventListener("error", failed);
        if (ok) { try { await image.decode?.(); } catch { ok = false; } }
        resolve(ok);
      };
      const loaded = () => finish(image.naturalWidth > 0), failed = () => finish(false);
      image.addEventListener("load", loaded); image.addEventListener("error", failed);
    });
    imagePromises.set(image, ready);
    ready.then(ok => { ready.decoded = ok; });
  }
  watchIllustration(image, ready, owner, live);
}
// DOM の挿絵・肖像も、表示されたものだけを対象にする。裏の先読みは対象外。
if (typeof document !== "undefined" && typeof MutationObserver !== "undefined") {
  const scan = node => {
    if (node.nodeType !== 1 || node.closest?.(".image-loading, .scene-hold, #media-splash")) return;
    if (node.matches("img[src]") && !node.src.startsWith("data:")) watchImage(node, node);
    for (const image of node.querySelectorAll("img[src]")) {
      if (!image.src.startsWith("data:") && !image.closest(".image-loading, .scene-hold, #media-splash")) watchImage(image, image);
    }
  };
  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === "attributes") {
        if (record.attributeName === "src") { imagePromises.delete(record.target); scan(record.target); }
      } else for (const node of record.addedNodes) scan(node);
    }
    schedule();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["src", "class", "hidden", "style"] });
  document.addEventListener("visibilitychange", schedule);
  document.addEventListener("scroll", schedule, { capture: true, passive: true });
  window.addEventListener("resize", schedule, { passive: true });
  document.addEventListener("keydown", event => {
    if (!mediaBusy()) return;
    if (document.getElementById("boot-notice") || event.target.closest?.("#media-splash, .image-loading-retry, .cloud-gate, #local-save-gate")) return;
    event.preventDefault(); event.stopImmediatePropagation();
  }, true);
  document.getElementById("media-splash")?.querySelector(".media-retry")?.addEventListener("click", reloadIllustrations);
  scan(document.documentElement);
  schedule();
}
