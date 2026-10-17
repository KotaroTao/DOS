// 表示に必要な画像だけをまとめ、画面左下の館の灯で知らせる。
import { CANDLE_IMAGE } from "./loadingcandle.js";

const entries = new Map(), imagePromises = new WeakMap();
let lamp = null, timer = 0;
function visible(node) {
  if (!node?.isConnected || !node.getClientRects?.().length) return false;
  const rect = node.getBoundingClientRect();
  if (rect.bottom <= 0 || rect.right <= 0 || rect.top >= innerHeight || rect.left >= innerWidth) return false;
  return !node.closest('[hidden], .hidden') && getComputedStyle(node).visibility !== "hidden";
}
function ensureLamp() {
  if (lamp || !document.body) return;
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
  if (!entries.size && (!lamp || lamp.dataset.state === "idle")) return;
  if (!timer && typeof document !== "undefined") timer = setTimeout(update, 120);
}
function update() {
  timer = 0;
  let pending = false, failed = false;
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
    if (entry.state === "ready" || !entry.owners.size && !entry.liveOwners.size && now - entry.used >= 1000) {
      entries.delete(key); continue;
    }
    if (shown) {
      pending ||= entry.state === "pending";
      failed ||= entry.state === "error";
    }
  }
  const state = document.hidden ? "idle" : pending ? "loading" : failed ? "error" : "idle";
  if (state !== "idle") ensureLamp();
  if (lamp && lamp.dataset.state !== state) {
    lamp.dataset.state = state;
    lamp.lastElementChild.textContent = state === "loading" ? "画像を読み込んでいます" : state === "error" ? "画像を読み込めませんでした" : "";
  }
  if (!document.hidden && (pending || [...entries.values()].some(entry => entry.liveOwners.size || now - entry.used < 1000))) schedule();
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
  if (image.complete && image.naturalWidth > 0) {
    if (entries.delete(image)) schedule();
    return;
  }
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
    if (node.nodeType !== 1 || node.closest?.(".image-loading")) return;
    if (node.matches("img[src]") && !node.src.startsWith("data:")) watchImage(node, node);
    for (const image of node.querySelectorAll("img[src]")) {
      if (!image.src.startsWith("data:") && !image.closest(".image-loading")) watchImage(image, image);
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
  scan(document.documentElement);
}
