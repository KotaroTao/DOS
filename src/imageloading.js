// 表示に必要な画像だけをまとめ、画面左下の館の灯で知らせる。
import { CANDLE_IMAGE } from "./loadingcandle.js";

const entries = new Map(), imagePromises = new WeakMap();
let lamp = null, timer = 0, scheduled = false, waitingSince = null;
const LAMP_DELAY = 400;
const scenes = new WeakMap();
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
  // 同じ描画内の要求をまとめる。通常の画像待ちでは画面を覆わない。
  queueMicrotask(() => { scheduled = false; update(); });
}
function update() {
  clearTimeout(timer); timer = 0;
  let pending = false, failed = false, initialScene = false;
  const now = Date.now();
  for (const [key, entry] of entries) {
    let shown = now - entry.used < 300;
    for (const [node, used] of entry.liveOwners) {
      if (now - used < 300 && visible(node)) shown = true;
      if (now - used >= 1000) entry.liveOwners.delete(node);
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
      initialScene ||= entry.state === "pending" && [...entry.owners.keys()].some(node => node.classList?.contains("ttl-overlay") && !node.dataset.sceneReady);
      failed ||= entry.state === "error";
    }
  }
  const booting = document.body.classList.contains("booting");
  document.body.classList.toggle("screen-loading", booting || initialScene);
  if (pending || booting) waitingSince ??= now;
  else waitingSince = null;
  const state = document.hidden ? "idle" : booting || pending && now - waitingSince >= LAMP_DELAY ? "loading" : failed ? "error" : "idle";
  if (state !== "idle") ensureLamp();
  if (lamp && lamp.dataset.state !== state) {
    lamp.dataset.state = state;
    lamp.lastElementChild.textContent = state === "loading" ? "画像を読み込んでいます" : state === "error" ? "画像を読み込めませんでした" : "";
  }
  if (!document.hidden && (pending || [...entries.values()].some(entry => entry.liveOwners.size || now - entry.used < 1000))) timer = setTimeout(update, 120);
}
// 背景だけを遷移の待ち合わせ対象にする。肖像や品の画像は操作を止めない。
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
    const waits = [...root.querySelectorAll("canvas")].map(node => scenes.get(node)).filter(state => state?.pending);
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
    const content = document.createElement("div");
    content.className = "scene-next";
    while (root.firstChild) content.appendChild(root.firstChild);
    content.inert = true;
    root.append(content, snapshot);
    snapshot.scrollTop = oldScroll;
    let timeout;
    const release = () => {
      clearTimeout(timeout);
      if (snapshot.parentNode !== root) return;
      snapshot.remove();
      content.inert = false;
      content.replaceWith(...content.childNodes);
    };
    // 回線が途切れても画面を閉じ込めない。失敗時はすぐに操作へ戻す。
    timeout = setTimeout(release, 8000);
    Promise.allSettled(waits.map(state => state.ready)).then(() => requestAnimationFrame(release));
  };
}
// owner は表示する Canvas/要素。毎フレーム描く画像は省略して、その間だけ灯を出す。
export function watchIllustration(key, ready, owner = null, live = false) {
  if (!key || !ready || typeof document === "undefined") return;
  let entry = entries.get(key);
  if (!entry || entry.ready !== ready) {
    entry = { ready, state: "pending", owners: entry?.owners || new Map(), liveOwners: entry?.liveOwners || new Map(), used: 0, created: Date.now() };
    entries.set(key, entry);
    Promise.resolve(ready).then(ok => { entry.state = ok === false ? "error" : "ready"; schedule(); },
      () => { entry.state = "error"; schedule(); });
  }
  if (owner && live) entry.liveOwners.set(owner, Date.now());
  else if (owner) entry.owners.set(owner, entry.owners.get(owner) || false);
  else entry.used = Date.now();
  schedule();
}
export function watchImage(image, owner = null, live = false) {
  if (!image || !image.addEventListener) return;
  if (image.complete && image.naturalWidth > 0) return;
  let ready = imagePromises.get(image);
  if (!ready) {
    ready = new Promise(resolve => {
      if (image.complete && image.src) { resolve(image.naturalWidth > 0); return; }
      const finish = ok => {
        image.removeEventListener("load", loaded); image.removeEventListener("error", failed);
        resolve(ok);
      };
      const loaded = () => finish(image.naturalWidth > 0), failed = () => finish(false);
      image.addEventListener("load", loaded); image.addEventListener("error", failed);
    });
    imagePromises.set(image, ready);
  }
  watchIllustration(image, ready, owner, live);
}
// DOM の挿絵・肖像も、表示されたものだけを対象にする。裏の先読みは対象外。
if (typeof document !== "undefined" && typeof MutationObserver !== "undefined") {
  const scan = node => {
    if (node.nodeType !== 1 || node.closest?.(".image-loading, .scene-hold")) return;
    if (node.matches("img[src]") && !node.src.startsWith("data:")) watchImage(node, node);
    for (const image of node.querySelectorAll("img[src]")) {
      if (!image.src.startsWith("data:") && !image.closest(".image-loading, .scene-hold")) watchImage(image, image);
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
    if (!document.body.classList.contains("screen-loading") && !document.body.classList.contains("booting")) return;
    if (document.getElementById("boot-notice")) return;
    event.preventDefault(); event.stopImmediatePropagation();
  }, true);
  scan(document.documentElement);
  schedule();
}
