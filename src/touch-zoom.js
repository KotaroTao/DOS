// Safariはviewportの拡大禁止を無視するため、起動直後から連続タップも抑止する。
// touchendを止めると通常のclickも消えるので、2回目以降の操作を一度だけ補う。
(() => {
  let start = null, last = null;
  const reset = () => { start = null; last = null; };
  document.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) { reset(); return; }
    const t = e.touches[0];
    start = { id: t.identifier, x: t.clientX, y: t.clientY, time: e.timeStamp };
  }, { passive: true, capture: true });
  document.addEventListener("touchmove", (e) => {
    const t = e.touches[0];
    if (!start || e.touches.length !== 1 || t.identifier !== start.id ||
        Math.hypot(t.clientX - start.x, t.clientY - start.y) > 10) reset();
  }, { passive: true, capture: true });
  document.addEventListener("touchcancel", reset, { passive: true, capture: true });
  document.addEventListener("touchend", (e) => {
    const t = e.changedTouches[0], began = start;
    start = null;
    if (!began || e.touches.length || !t || t.identifier !== began.id ||
        e.timeStamp - began.time > 350 ||
        Math.hypot(t.clientX - began.x, t.clientY - began.y) > 10) {
      last = null;
      return;
    }
    const previous = last;
    last = { x: t.clientX, y: t.clientY, time: e.timeStamp };
    if (!previous || e.timeStamp - previous.time > 350 ||
        Math.hypot(t.clientX - previous.x, t.clientY - previous.y) > 32) return;
    // 入力欄のフォーカス・選択はブラウザに任せる。CSSでも連続タップ拡大を抑える。
    const target = e.target;
    if (!(target instanceof Element) || target.closest("input, textarea, select, [contenteditable]")) return;
    if (e.defaultPrevented || !e.cancelable) return;
    e.preventDefault();
    if (target.isConnected && !target.closest(":disabled")) {
      // 盤面はクリック座標から移動先を決めるため、指を離した位置も引き継ぐ。
      target.dispatchEvent(new MouseEvent("click", {
        bubbles: true, cancelable: true, composed: true, view: window, detail: 1,
        clientX: t.clientX, clientY: t.clientY, screenX: t.screenX, screenY: t.screenY,
      }));
    }
  }, { passive: false, capture: true });
})();
