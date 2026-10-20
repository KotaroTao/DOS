// node tools/performance/media-cache-check.mjs
// 再起動・版更新・通信失敗・同時表示で、絵の保存と再取得を確認する。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../../sw.js', import.meta.url), 'utf8');
const origin = 'https://example.test/DOS/';
const stored = new Map();
const urlOf = value => new URL(typeof value === 'string' ? value : value.url, origin).href;
const cache = {
  async match(request, options = {}) {
    const url = new URL(urlOf(request));
    if (options.ignoreSearch) url.search = '';
    return stored.get(url.href)?.clone();
  },
  async put(request, response) { stored.set(urlOf(request), response.clone()); },
};
let requests = 0, offline = false, badStatus = false;
function worker(version, revisions = {}) {
  const listeners = {};
  const context = vm.createContext({
    URL, Response, Headers, Map, Set, Promise,
    self: { location: new URL(origin + 'sw.js'), addEventListener(type, fn) { listeners[type] = fn; } },
    caches: { open: async () => cache },
    fetch: async () => {
      requests++;
      // 同時リクエストが重なる時間を作る。
      await new Promise(resolve => setTimeout(resolve, 10));
      if (offline) throw new Error('offline');
      return new Response(badStatus ? 'missing' : version, { status: badStatus ? 404 : 200 });
    },
  });
  vm.runInContext(source.replace('const CACHE = "dos-dev";', `const CACHE = "${version}";`).replace('const MEDIA_REVISIONS = {};', `const MEDIA_REVISIONS = ${JSON.stringify(revisions)};`), context);
  return async (path = 'art/jobs/fighter_1.webp') => {
    let response;
    const background = [];
    listeners.fetch({ request: { method: 'GET', url: urlOf(path) },
      respondWith(promise) { response = promise; }, waitUntil(promise) { background.push(promise); } });
    return { response: await response, done: Promise.all(background) };
  };
}
let serve = worker('dos-first');
const concurrent = await Promise.all(Array.from({ length: 6 }, () => serve()));
for (const result of concurrent) { assert.equal(await result.response.text(), 'dos-first'); await result.done; }
assert.equal(requests, 1, '同時表示で同じ絵を重複取得した');
serve = worker('dos-first');
let result = await serve('art/jobs/fighter_1.webp?preview=1');
await result.done;
assert.equal(await result.response.text(), 'dos-first');
assert.equal(requests, 1, '再起動で確認済みの絵を再取得した');
offline = true;
serve = worker('dos-next');
await assert.rejects(serve(), /offline/);
assert.equal(requests, 2);
assert.equal(await stored.get(urlOf('art/jobs/fighter_1.webp')).clone().text(), 'dos-first', '旧版を現在の版として保存し直した');
offline = false;
badStatus = true;
result = await serve();
assert.equal(result.response.status, 404);
await result.done;
assert.equal(requests, 3);
badStatus = false;
result = await serve();
assert.equal(await result.response.text(), 'dos-next', '更新前の画像を表示した');
await result.done;
assert.equal(requests, 4, '失敗後に再取得しなかった');
serve = worker('dos-next');
result = await serve();
await result.done;
assert.equal(await result.response.text(), 'dos-next');
assert.equal(requests, 4, '新しい版でも毎回取得した');
offline = true;
result = await serve();
assert.equal(await result.response.text(), 'dos-next', '現在の版の取得済み画像はオフラインでも表示する');
const missing = 'art/jobs/priest_1.webp';
await assert.rejects(serve(missing), /offline/);
offline = false;
result = await serve(missing);
assert.equal(await result.response.text(), 'dos-next');
await result.done;
assert.equal(requests, 6);
console.log('合格: 同時表示6件→通信1回、再起動→通信0回、版更新・オフライン・404後の再取得・初回取得');

// 内容が同じ絵は、コードだけ更新された時にもオフラインで利用できる。
const hashedPath = 'art/title/wide.webp', hashKey = './' + hashedPath;
serve = worker('dos-hash-first', { [hashKey]: 'sha-image-a' });
result = await serve(hashedPath); await result.done;
const count = requests;
offline = true;
serve = worker('dos-hash-next', { [hashKey]: 'sha-image-a' });
result = await serve(hashedPath);
assert.equal(await result.response.text(), 'dos-hash-first');
assert.equal(requests, count, '同じ内容の画像をコード更新で再取得した');
serve = worker('dos-hash-new-art', { [hashKey]: 'sha-image-b' });
await assert.rejects(serve(hashedPath), /offline/);
offline = false;
result = await serve(hashedPath); await result.done;
assert.equal(await result.response.text(), 'dos-hash-new-art');
console.log('合格: 画像別ハッシュで変更なしは更新後もオフライン表示、変更ありは再取得');
