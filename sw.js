// オフライン対応キャッシュ (PWA / アプリ化用)
// 取得戦略は network-first: オンライン時は常に最新を取得し、
// 取得できた時だけキャッシュ更新。オフライン時のみキャッシュを使う。
const CACHE = "dos-v33";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.webmanifest",
  "./icon.svg",
  "./src/game.js",
  "./src/items.js",
  "./src/board.js",
  "./src/sprites.js",
  "./src/combat.js",
  "./src/souls.js",
  "./src/audio.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return; // 他オリジンは介入しない

  // network-first: まずネットワーク、失敗時にキャッシュへフォールバック
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request).then((hit) => hit || caches.match("./index.html")))
  );
});
