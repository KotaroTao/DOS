// 記録の排他・原本の比較・退避失敗時の保全を確認する。
import assert from "node:assert/strict";
import { LocalSaveSession, LOCAL_SAVE_KEY as KEY, LOCAL_RECOVERY_KEY as BACKUP } from "../../src/local-save.js";
const values = new Map([[KEY, "最初の記録"]]);
let fail = false;
const storage = {
  get length() { return values.size; }, key: i => [...values.keys()][i],
  getItem: k => values.get(k) ?? null,
  setItem: (k, v) => { if (fail) throw new Error("保存先が満杯"); values.set(k, v); },
  removeItem: k => values.delete(k),
};
const held = new Set();
const locks = { async request(k, opts, fn) {
  if (held.has(k)) return fn(null);
  held.add(k); try { return await fn({ name: k }); } finally { held.delete(k); }
} };
let conflicts = 0;
const session = () => new LocalSaveSession({ storage, locks, onConflict: () => conflicts++ });
const a = session(), b = session();
assert(await a.acquire()); assert(!await b.acquire());
assert(!b.write("古い画面")); assert.equal(storage.getItem(KEY), "最初の記録");
a.keepRecovery(); assert.equal(storage.getItem(BACKUP), "最初の記録");
assert(a.write("進んだ記録")); assert.equal(a.raw, "進んだ記録");
a.release(); await new Promise(resolve => setImmediate(resolve));
assert(await b.acquire()); assert.equal(b.raw, "進んだ記録");
assert(!a.write("閉じた画面")); assert.equal(storage.getItem(KEY), "進んだ記録");
assert(b.quarantine()); assert(b.quarantine());
assert.equal([...values.keys()].filter(k => k.includes("-damaged-")).length, 1, "同じ原本を再読込で増やさない");
assert.equal(storage.getItem(KEY), "進んだ記録");
fail = true;
assert.throws(() => b.write("保存失敗")); assert.equal(b.raw, "進んだ記録");
b.keepRecovery(); assert.equal(storage.getItem(BACKUP), "最初の記録");
fail = false;
storage.setItem(KEY, "外部の更新");
assert(!b.write("古い更新")); assert(!b.write(null)); assert.equal(conflicts, 1);
assert.equal(storage.getItem(KEY), "外部の更新");
b.release(); await new Promise(resolve => setImmediate(resolve));
const c = session(); assert(await c.acquire()); fail = true;
assert.throws(() => c.quarantine()); assert.equal(storage.getItem(KEY), "外部の更新");
fail = false; storage.setItem("dos-prefs", "音の好み");
assert(c.eraseAll()); assert.equal(storage.getItem(KEY), null);
assert.equal(storage.getItem(BACKUP), null);
assert(![...values.keys()].some(k => k.includes("-damaged-")));
assert.equal(storage.getItem("dos-prefs"), "音の好み"); c.release();
await assert.rejects(new LocalSaveSession({ storage, locks: null }).acquire(), /ブラウザ/);
console.log("同時起動の排他・解放後の再開・古い保存/削除の拒否・復旧用記録・重複退避の防止・保存先満杯・非対応環境の保全: OK");
