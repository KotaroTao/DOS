import assert from "node:assert/strict";
import { recoverStability, STABILITY_RECOVERY_MS } from "../../src/stability.js";
import { refSerialize, refDeserialize, applySavePatch } from "../../src/savegraph.js";
import { CloudSaveClient } from "../../src/cloud-save.js";
import { resolveCloudBattle } from "../../src/cloud-battle.js";
import { Battle } from "../../src/combat.js";
import { makeDoll, makeSoulInstance } from "../../src/souls.js";
import { bindRngState, rngState, reseedRng } from "../../src/rng.js";

const clone = (s) => refDeserialize(refSerialize(s));
const storage = () => {
  const data = new Map();
  return { getItem: (k) => data.get(k) || null, setItem: (k, v) => data.set(k, v), removeItem: (k) => data.delete(k) };
};
const auth = { access_token: "test-token", refresh_token: "test-refresh", expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: "test-user" } };
const config = { url: "https://test.invalid", anonKey: "public-test-key", protocol: 1 };

// 共有参照と循環、危険なキー・壊れた参照の拒否。
{
  const soul = { uid: 1 }, root = { soul, party: [{ soul }] }; root.self = root;
  const copy = clone(root);
  assert.equal(copy.self, copy); assert.equal(copy.party[0].soul, copy.soul);
  assert.throws(() => refDeserialize({ root: { $r: 3 }, heap: [] }));
  assert.throws(() => refDeserialize(JSON.parse('{"root":{"$r":0},"heap":[{"o":{"__proto__":1}}]}')));
}

function battleState(seed = 1234, enemyFirst = false) {
  reseedRng(seed);
  const p = Object.assign(makeDoll("検証の人業"), { hp: 100, maxhp: 100, atk: 30, vit: 10, agi: enemyFirst ? 1 : 1000, int: 10, pie: 10, luk: 8 });
  const e = { uid: 900, key: "bs_ghoul", name: "検証の敵", side: "enemy", hp: 100, maxhp: 100, atk: 20, vit: 10, agi: enemyFirst ? 1000 : 1, int: 10, pie: 10, luk: 8, lv: 1, alive: true, element: "none" };
  const b = new Battle([p], [e], () => {});
  return { state: "combat", party: [p], reserve: [], souls: [], rng: rngState(), battle: b,
    codex: { mon: {}, fresh: { mon: {} } }, world: {}, events: {}, order: { picks: [] },
    gold: 100, soulPts: 100, floor: 1, dungeonIdx: 0, run: { gold: 50, soulPts: 50 } };
}

// 同じ保存済み行動は、終了・再読込を挟んでも同じ結果と乱数位置になる。
for (let seed = 1; seed <= 30; seed++) {
  const initial = battleState(seed);
  assert.equal(initial.battle.phase, "input");
  initial.battle.chooseAction("attack"); initial.battle.chooseTarget(initial.battle.enemies[0]);
  const first = clone(initial), restarted = clone(initial);
  resolveCloudBattle(first, "commit"); resolveCloudBattle(restarted, "commit");
  assert.equal(first.battle.enemies[0].hp, restarted.battle.enemies[0].hp);
  assert.deepEqual(first.rng, restarted.rng);
  assert.equal(first.battle._acted, true);
  assert.throws(() => resolveCloudBattle(first, "commit"));
  const packet = resolveCloudBattle(first, "advance");
  assert.equal(first.battle._acted, false);
  assert.throws(() => resolveCloudBattle(first, "advance"));
  assert.equal(packet.snapshot.battle.party[0], packet.snapshot.party[0]);
}

// 保存結果の反映でも、演出が握っている人業・敵・戦闘の参照を維持する。
{
  const game = battleState(), original = game.party[0], foe = game.battle.enemies[0], battle = game.battle;
  game.battle.chooseAction("attack"); game.battle.chooseTarget(foe);
  const server = clone(game), packet = resolveCloudBattle(server, "commit");
  const received = applySavePatch(game, clone(packet));
  assert.equal(game.party[0], original); assert.equal(game.battle, battle); assert.equal(game.battle.enemies[0], foe);
  assert.equal(received.result.actor, original); assert.equal(received.result.hits[0].target, foe);
  assert.equal(game.party[0].hp, server.party[0].hp); assert.deepEqual(game.rng, server.rng);
}

// 応答待ち中の自然回復は、行動結果と次の手番のどちらでも巻き戻さない。
{
  const game = battleState(), p = game.party[0], base = 1000000;
  const reserve = makeDoll("控えの検証"); game.reserve.push(reserve);
  for (const d of [p, reserve]) { d.stability = 0; d.stabilityAt = base; }
  game.battle.chooseAction("attack"); game.battle.chooseTarget(game.battle.enemies[0]);
  const server = clone(game), commit = resolveCloudBattle(server, "commit");
  for (const d of [p, reserve]) recoverStability(d, base + STABILITY_RECOVERY_MS);
  const received = applySavePatch(game, clone(commit));
  assert.equal(received.result.actor, p);
  for (const d of [p, reserve]) {
    assert.equal(d.stability, 1); assert.equal(d.stabilityAt, base + STABILITY_RECOVERY_MS);
  }
  const advance = resolveCloudBattle(server, "advance");
  for (const d of [p, reserve]) recoverStability(d, base + 2 * STABILITY_RECOVERY_MS);
  applySavePatch(game, clone(advance));
  for (const d of [p, reserve]) {
    assert.equal(d.stability, 2); assert.equal(d.stabilityAt, base + 2 * STABILITY_RECOVERY_MS);
  }
}

// 敵の一手で死亡した状態を保存。演出せずに読み込んでも生き返らない。
{
  const state = battleState(42, true); state.party[0].hp = 1; state.battle.current.atk = 10000;
  const packet = resolveCloudBattle(state, "enemy");
  assert.equal(packet.snapshot.party[0].alive, false);
  assert.equal(clone(state).party[0].alive, false);
  assert.equal(state.battle.result, "lose");
}

// 窃盗とドレインの損失は、着弾の演出をしなくても保存済みになる。
for (const ability of ["goldSteal", "soulSteal", "drain"]) {
  let seen = false;
  for (let seed = 1; seed <= 300 && !seen; seed++) {
    const s = battleState(seed, true); s.battle.current.ability = ability;
    if (ability === "drain") {
      const soul = makeSoulInstance("fighter", 1, 5); s.souls.push(soul); s.party[0].primary = soul.uid;
    }
    const packet = resolveCloudBattle(s, "enemy");
    const h = packet.result.hits.find((h) => ability === "drain" ? h.drain : h.steal === ability);
    if (!h) continue;
    seen = true;
    assert(packet.result._persistedConsequences);
    if (ability === "drain") assert.equal(clone(s).souls[0].level, 4);
    else {
      const key = ability === "goldSteal" ? "gold" : "soulPts";
      assert.equal(s[key], 100 - h.persistedSteal); assert.equal(s.run[key], 50 - h.persistedSteal);
      assert.equal(clone(s)[key], s[key]);
    }
  }
  assert(seen, ability + " の実際の敵行動が発動しませんでした");
}

// 返答だけを失った通信を再送しても、IDも内容も同じで、更新は1回。
{
  const disk = storage(), bodies = []; let revision = 0, applied = 0, lost = true, last = null;
  const fetcher = async (url, options) => {
    const body = JSON.parse(options.body); bodies.push(body);
    if (!last || last.commandId !== body.commandId) {
      assert.equal(body.revision, revision); applied++; revision++; last = body;
    }
    if (lost) { lost = false; throw new Error("返答だけを喪失"); }
    return Response.json({ revision });
  };
  let retries = 0;
  const c = new CloudSaveClient(config, { storage: disk, fetcher, onFailure: async () => { retries++; } });
  c.auth = auth; c.sessionId = "session";
  await c.save(refSerialize({ state: "town", party: [], souls: [] }));
  assert.equal(applied, 1); assert.equal(retries, 1); assert.deepEqual(bodies[0], bodies[1]);
  assert.equal(c.revision, 1); assert.equal(disk.getItem("dos-cloud-pending:test-user"), null); assert.equal(c.busy, false);
}

// 送信中に終了した場合は、次の起動で同じ要求を回収する。
{
  const disk = storage(); let request = null;
  const c = new CloudSaveClient(config, { storage: disk, fetcher: async (url, opts) => { request = JSON.parse(opts.body); throw new Error("終了"); } });
  c.auth = auth; c.sessionId = "session";
  await assert.rejects(c.battle("commit"));
  assert(disk.getItem("dos-cloud-pending:test-user"));
  const reopened = new CloudSaveClient(config, { storage: disk, fetcher: async (url, opts) => {
    assert.deepEqual(JSON.parse(opts.body), request); return Response.json({ revision: 1 });
  } });
  reopened.auth = auth; reopened.sessionId = "session";
  await reopened.recover(); assert.equal(reopened.revision, 1); assert.equal(disk.getItem("dos-cloud-pending:test-user"), null);
}

// 同時に予約しても版番号は順に進む。途中の失敗を飛ばして次へ進めない。
{
  const revisions = [];
  const c = new CloudSaveClient(config, { storage: storage(), fetcher: async (url, opts) => {
    const b = JSON.parse(opts.body); revisions.push(b.revision); return Response.json({ revision: b.revision + 1 });
  } });
  c.auth = auth; c.sessionId = "session";
  await Promise.all([c.save({ first: true }), c.save({ second: true }), c.battle("enemy")]);
  assert.deepEqual(revisions, [0, 1, 2]); assert.equal(c.revision, 3);
}
// 記録1の旧形式の送信待ちを同じ要求で回収できる。
{
  const disk = storage(), sent = new Map();
  for (const slot of [1]) {
    const c = new CloudSaveClient(config, { storage: disk, slot, fetcher: async (url, opts) => {
      const body = JSON.parse(opts.body);
      assert.equal(body.slot ?? 1, slot);
      sent.set(slot, body); throw new Error("終了");
    } });
    c.auth = auth; c.sessionId = "session";
    await assert.rejects(c.save({ slot }));
  }
  for (const slot of [1]) {
    const c = new CloudSaveClient(config, { storage: disk, slot, fetcher: async (url, opts) => {
      assert.deepEqual(JSON.parse(opts.body), sent.get(slot));
      return Response.json({ revision: 1 });
    } });
    c.auth = auth; c.sessionId = "session";
    await c.recover();
    const key = n => "dos-cloud-pending:test-user" + (n === 1 ? "" : ":slot:" + n);
    assert.equal(disk.getItem(key(slot)), null);
    for (let n = 1; n < slot; n++) assert(disk.getItem(key(n)));
  }
}
console.log("クラウド保存: 共有参照・30種の再開・死亡・再送・送信待ち回収・直列更新 OK");
