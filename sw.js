// オフライン対応キャッシュ (PWA / アプリ化用)
// 戦略: バージョン一括キャッシュ (atomic versioned cache)。
// install 時に全アセットを同一バージョンで先読みし、fetch は同バージョンの
// キャッシュから返す。これにより「新しい game.js + 古い souls.js」のような
// モジュール混在 (export 不一致で白画面) が構造的に起きない。
// 新デプロイは CACHE 名の変更で検出され、ページ側が自動リロードする。
const CACHE = "dos-v283";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.webmanifest",
  "./icon.svg",
  "./src/game.js",
  "./src/joblore.js",
  "./src/items.js",
  "./src/board.js",
  "./src/traps.js",
  "./src/sprites.js",
  "./src/combat.js",
  "./src/souls.js",
  "./src/content.js",
  "./src/audio.js",
  "./src/opening.js",
  "./src/subquests.js",
  "./src/tavern.js",
  "./src/story.js",
  "./src/abyss.js",
  "./src/dungeons/schema.js",
  "./src/dungeons/common.js",
  "./src/dungeons/index.js",
  "./src/dungeons/d01.js",
  "./src/dungeons/d02.js",
  "./src/dungeons/d03.js",
  "./src/dungeons/d04.js",
  "./src/dungeons/bestiary.js",
  "./src/dungeons/generator.js",
  "./src/catalog/defs.js",
  "./src/catalog/index.js",
  "./src/catalog/weapons.js",
  "./src/catalog/armor.js",
  "./src/catalog/gear.js",
  "./src/catalog/misc.js",
  "./src/catalog/legends.js",
  "./src/catalog/exclusives.js",
  "./src/catalog/lr.js",
  "./src/catalog/ranks/r01.js",
  "./src/catalog/ranks/r02.js",
  "./src/catalog/ranks/r03.js",
  "./src/catalog/ranks/r04.js",
  "./src/catalog/ranks/r05.js",
  "./src/catalog/ranks/r06.js",
  "./src/catalog/ranks/r07.js",
  "./src/catalog/ranks/r08.js",
  "./src/catalog/ranks/r09.js",
  "./src/catalog/ranks/r10.js",
  "./src/catalog/ranks/r11.js",
  "./src/catalog/ranks/r12.js",
  "./src/catalog/ranks/r13.js",
  "./src/catalog/ranks/r14.js",
  "./src/catalog/ranks/r15.js",
  "./src/catalog/ranks/r16.js",
  "./src/catalog/ranks/r17.js",
  "./src/catalog/ranks/r18.js",
  "./src/catalog/ranks/r19.js",
  "./src/catalog/ranks/r20.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      // 先読みは必ずネットワークから取得し、HTTPキャッシュの古いファイル混入を防ぐ
      .then((c) => Promise.all(ASSETS.map((u) => fetch(u, { cache: "no-cache" }).then((res) => {
        if (!res.ok) throw new Error("precache failed: " + u);
        return c.put(u, res);
      }))))
      .then(() => self.skipWaiting())
  );
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

  // 同一バージョンのキャッシュを最優先 (整合性保証)。
  // キャッシュ外のリクエストのみネットワークへ。オフライン時は index にフォールバック
  e.respondWith(
    caches.open(CACHE).then((c) =>
      c.match(e.request, { ignoreSearch: true }).then((hit) =>
        hit ||
        fetch(e.request)
          .then((res) => { c.put(e.request, res.clone()).catch(() => {}); return res; })
          .catch(() => c.match("./index.html"))
      )
    )
  );
});
