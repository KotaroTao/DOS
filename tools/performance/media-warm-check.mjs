// SWの導入で全画像を集めず、許可された物語と表示した絵だけを保存する。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
const source = readFileSync(new URL("../../sw.js", import.meta.url), "utf8");
const origin = "https://example.test/DOS/", stored = new Map(), calls = [], listeners = {};
const urlOf = v => new URL(typeof v === "string" ? v : v.url, origin).href;
const cache = {
  async keys() { return [...stored.keys()].map(url => ({ url })); },
  async match(v) { return stored.get(urlOf(v))?.clone(); },
  async put(v, value) { stored.set(urlOf(v), value.clone()); },
  async delete(v) { return stored.delete(urlOf(v)); },
};
const ctx = vm.createContext({ URL, Response, Headers, Map, Set, Promise,
  self: { location: new URL(origin + "sw.js"), clients: { claim: async () => {} }, addEventListener: (k, f) => { listeners[k] = f; } },
  caches: { open: async () => cache, keys: async () => [], delete: async () => true },
  fetch: async request => { calls.push(urlOf(request)); return new Response("image"); },
});
vm.runInContext(source.replace('const CACHE = "dos-dev";', 'const CACHE = "dos-review";'), ctx);
let done;
listeners.activate({ waitUntil: p => { done = p; } }); await done;
await vm.runInContext("warming", ctx);
assert.deepEqual(calls, [], "初回の導入で未表示の画像を取得した");
const story = vm.runInContext("MEDIA_ASSETS.find(isStory)", ctx);
assert(story);
listeners.message({ data: { type: "story-media", urls: [story] }, waitUntil: p => { done = p; } });
await done;
assert.deepEqual(calls, [urlOf(story)]);
listeners.message({ data: { type: "story-media", urls: [story] }, waitUntil: p => { done = p; } });
await done; assert.equal(calls.length, 1);
assert(stored.has(urlOf(story)));
console.log("SW初回の未表示画像取得0件・現在の物語だけ先読み・再通知で重複取得なし・保存済み画像を維持: OK");
