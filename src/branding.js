// 起動時だけ表示する制作ロゴ。タイトルの準備と並行して約5秒間見せる。
(() => {
  const splash = document.getElementById("studio-splash");
  const logo = splash.querySelector("img");
  let elapsed = false, skipped = false, closing = false, timer;
  function remove() {
    clearTimeout(timer);
    observer.disconnect();
    document.removeEventListener("keydown", keydown, true);
    splash.remove();
    document.body.classList.remove("studio-branding");
  }
  function update() {
    if (closing) return;
    // 読込失敗・記録復旧の操作をロゴで隠さない。
    const recovery = document.querySelector("#boot-notice, .cloud-gate:not([hidden]), #local-save-gate") ||
      document.querySelector('#media-splash[data-state="error"]');
    if (recovery) { closing = true; remove(); return; }
    if (!elapsed && !skipped) return;
    if (document.body.matches(".booting, .screen-loading, .scene-preparing")) return;
    closing = true;
    clearTimeout(timer);
    if (skipped) { remove(); return; }
    splash.classList.add("studio-fading");
    splash.addEventListener("transitionend", remove, { once: true });
    timer = setTimeout(remove, 700);
  }
  function skip(event) {
    event.preventDefault(); event.stopImmediatePropagation();
    skipped = true;
    if (closing) remove();
    else update();
  }
  function keydown(event) {
    if (["Enter", " ", "Escape"].includes(event.key)) skip(event);
    else { event.preventDefault(); event.stopImmediatePropagation(); }
  }
  splash.addEventListener("click", skip);
  document.addEventListener("keydown", keydown, true);
  const observer = new MutationObserver(update);
  observer.observe(document.body, { attributes: true, childList: true, subtree: true, attributeFilter: ["class", "data-state", "hidden"] });
  let started = false;
  function start() {
    if (started) return;
    started = true;
    timer = setTimeout(() => { elapsed = true; update(); }, 5000);
  }
  logo.addEventListener("load", start, { once: true });
  logo.addEventListener("error", () => { logo.hidden = true; start(); }, { once: true });
  if (logo.complete) {
    if (!logo.naturalWidth) logo.hidden = true;
    start();
  }
})();
