// 公開更新は知らせるだけにし、遊んでいる画面を勝手に読み直さない。
export function watchGameUpdates({ serviceWorker, testPlay = false, applyUpdate }) {
  if (!serviceWorker) return;
  const hadController = !!serviceWorker.controller;
  let notice = null;
  const notify = () => {
    // 初回導入では、既に読み込んだ版のまま続けられる。
    if (!hadController || notice) return;
    notice = document.createElement("aside");
    notice.className = "game-update-notice";
    notice.setAttribute("aria-label", "ゲームの更新");
    const message = document.createElement("p");
    message.setAttribute("role", "status");
    message.textContent = testPlay
      ? "新しい版があります。このまま試遊を続けられます。更新すると試遊の進行は失われ、開始時点に戻ります。"
      : "新しい版があります。このまま冒険を続けられます。更新する時は記録の保存を待ってタイトルへ戻ります。";
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = testPlay ? "試遊を終了して更新" : "保存して更新";
    let applying = false;
    button.addEventListener("click", async () => {
      if (applying) return;
      if (testPlay && !confirm("試遊の進行は保存されません。試遊を終了して更新しますか？")) return;
      applying = true; button.disabled = true;
      try { await applyUpdate(); }
      catch { message.textContent = "更新できませんでした。接続と記録の保存を確かめてから、もう一度お試しください。"; }
      finally { applying = false; button.disabled = false; }
    });
    // 操作を冒険側のショートカットへ渡さない。自動進行は止めない。
    for (const type of ["click", "keydown", "keyup", "pointerdown", "pointerup", "touchstart", "touchend"]) {
      notice.addEventListener(type, e => e.stopPropagation());
    }
    const later = document.createElement("button");
    later.type = "button"; later.textContent = "あとで";
    later.addEventListener("click", () => { notice.hidden = true; });
    notice.append(message, button, later); document.body.append(notice);
  };
  serviceWorker.addEventListener("controllerchange", notify);
  serviceWorker.register("sw.js", { updateViaCache: "none" }).then(reg => {
    reg.addEventListener("updatefound", () => {
      const sw = reg.installing;
      if (!sw) return;
      sw.addEventListener("statechange", () => {
        if (sw.state === "activated" && serviceWorker.controller) notify();
      });
    });
  }).catch(() => {});
}
