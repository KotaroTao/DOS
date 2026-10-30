// 公開時にService Workerと同じ版を入れ、通知前に切り替わった更新も検出する。
export const APP_VERSION = "dos-dev";

// 通常の冒険は保存を終えてから公開済みの版へ切り替える。試遊は確認を残す。
export function watchGameUpdates({ serviceWorker, testPlay = false, applyUpdate }) {
  if (!serviceWorker) return;
  const hadController = !!serviceWorker.controller;
  let notice = null;
  const notify = (differentVersion = false) => {
    // 初回導入では、既に読み込んだ版のまま続けられる。
    if ((!hadController && !differentVersion) || notice) return;
    notice = document.createElement("aside");
    notice.className = "game-update-notice";
    notice.setAttribute("aria-label", "ゲームの更新");
    const message = document.createElement("p");
    message.setAttribute("role", "status");
    message.textContent = testPlay
      ? "新しい版があります。このまま試遊を続けられます。更新すると試遊の進行は失われ、開始時点に戻ります。"
      : "新しい版があります。記録の保存を待って、自動で更新します。";
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = testPlay ? "試遊を終了して更新" : "保存して更新";
    let applying = false;
    const apply = async () => {
      if (applying) return;
      if (testPlay && !confirm("試遊の進行は保存されません。試遊を終了して更新しますか？")) return;
      applying = true; button.disabled = true;
      try {
        const result = await applyUpdate();
        if (result === false) message.textContent = "保存を確認できるまで更新を待っています。保存できたら自動で更新します。";
      }
      catch { message.textContent = "更新できませんでした。接続と記録の保存を確かめてから、もう一度お試しください。"; }
      finally { applying = false; button.disabled = false; }
    };
    button.addEventListener("click", apply);
    // 操作を冒険側のショートカットへ渡さない。自動進行は止めない。
    for (const type of ["click", "keydown", "keyup", "pointerdown", "pointerup", "touchstart", "touchend"]) {
      notice.addEventListener(type, e => e.stopPropagation());
    }
    const later = document.createElement("button");
    later.type = "button"; later.textContent = "あとで";
    later.addEventListener("click", () => { notice.hidden = true; });
    if (testPlay) notice.append(message, button, later);
    else notice.append(message, button);
    document.body.append(notice);
    if (!testPlay) {
      // 接続準備中・保存失敗では画面を保ち、送信の完了後に再試行する。
      apply();
      const retry = setInterval(() => { if (document.visibilityState !== "hidden") apply(); }, 3000);
      window.addEventListener("pagehide", () => clearInterval(retry), { once: true });
    }
  };
  const checkVersion = () => {
    const controller = serviceWorker.controller;
    if (APP_VERSION === "dos-dev" || !controller?.postMessage) return;
    const channel = new MessageChannel();
    const close = () => { channel.port1.close(); channel.port2.close(); };
    const timer = setTimeout(close, 5000);
    channel.port1.onmessage = e => {
      clearTimeout(timer); close();
      if (e.data?.type === "game-version" && typeof e.data.version === "string" && e.data.version !== APP_VERSION) notify(true);
    };
    controller.postMessage({ type: "game-version" }, [channel.port2]);
  };
  serviceWorker.addEventListener("controllerchange", () => { notify(); checkVersion(); });
  serviceWorker.register("sw.js", { updateViaCache: "none" }).then(reg => {
    const observe = sw => {
      if (!sw) return;
      const changed = () => {
        if (sw.state === "activated" && serviceWorker.controller) { notify(); checkVersion(); }
      };
      sw.addEventListener("statechange", changed);
      changed();
    };
    // registerの返答より前に導入が始まった場合も監視する。
    observe(reg.installing); observe(reg.waiting);
    reg.addEventListener("updatefound", () => observe(reg.installing));
    const check = () => {
      if (document.visibilityState === "hidden") return;
      checkVersion();
      reg.update?.().catch(() => {});
    };
    check();
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    const timer = setInterval(check, 15000);
    window.addEventListener("pagehide", () => clearInterval(timer), { once: true });
  }).catch(() => {});
}
