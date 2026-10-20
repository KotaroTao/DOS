// 表示前の通信ゼロ・種類をまたぐ同時取得数・失敗後の再試行・保存への影響を確認。
import assert from "node:assert/strict";
import { lazyPhoto } from "../../src/photoload.js";
import { MONSTER_PHOTOS, registerMonsterPhotos, restoreMonsterPhotos } from "../../src/monsterphotos.js";
import { refSerialize, refDeserialize } from "../../src/savegraph.js";
let requests = 0, active = 0, peak = 0;
const waiting = [];
globalThis.Image = class {
  set src(value) {
    this.url = value; requests++; active++; peak = Math.max(peak, active);
    waiting.push(this);
  }
};
const finish = (ok = true, width = 384) => {
  const image = waiting.shift(); assert(image);
  active--; image.naturalWidth = width; image.naturalHeight = 384;
  return (ok ? image.onload : image.onerror)();
};
const sprites = Array.from({ length: 15 }, (_, i) => lazyPhoto("image" + i, { width: 384, height: 384 }));
assert.equal(requests, 0);
const promises = sprites.map(s => s.photo.load());
assert.equal(requests, 6); assert.equal(sprites[0].photo.load(), promises[0]);
for (let i = 0; i < 15; i++) { await finish(); await Promise.resolve(); }
assert.deepEqual(await Promise.all(promises), Array(15).fill(true));
assert.equal(peak, 6); assert.equal(requests, 15);
await sprites[0].photo.load(); assert.equal(requests, 15);
const broken = lazyPhoto("broken", { width: 384, height: 384 });
let result = broken.photo.load(); finish(false); assert.equal(await result, false);
await broken.photo.load(); assert.equal(requests, 16);
const now = Date.now; Date.now = () => now() + 31000;
result = broken.photo.load(); finish(); assert.equal(await result, true); Date.now = now;
const wrong = lazyPhoto("wrong", { width: 384, height: 384 });
result = wrong.photo.load(); finish(true, 1); assert.equal(await result, false);
const id = Object.keys(MONSTER_PHOTOS)[0];
const monsters = { [id]: { art: ["x"], palette: { x: "#fff" }, atk: 123 } };
const before = requests;
registerMonsterPhotos(monsters); registerMonsterPhotos(monsters);
assert.equal(requests, before); assert.equal(monsters[id].atk, 123);
assert.equal(monsters[id].fallback, undefined);
const snapshot = refSerialize(monsters);
assert(!JSON.stringify(snapshot).includes('"img"')); assert.equal(requests, before);
const enemy = { key: id, mon: refDeserialize(snapshot)[id] };
restoreMonsterPhotos([enemy], monsters);
assert.equal(enemy.mon.photo, monsters[id].photo); assert.equal(requests, before);
console.log("表示前の通信0件・15枚を最大6枚ずつ取得・共有取得・失敗/寸法不一致・再表示時の回復・魔物の登録/保存/サーバー復帰: OK");
