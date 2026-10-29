// セーブの共有参照を保つ。戦闘の対象と隊・魂は同じオブジェクトへ復元する。
export function refSerialize(root) {
  const heap = [], map = new Map();
  function enc(v) {
    if (v == null) return null;
    if (typeof v !== "object") return typeof v === "function" ? null : v;
    if (map.has(v)) return { $r: map.get(v) };
    const idx = heap.length;
    map.set(v, idx);
    if (Array.isArray(v)) {
      const a = []; heap.push({ a });
      for (const x of v) a.push(enc(x));
    } else {
      const o = {}; heap.push({ o });
      for (const k of Object.keys(v)) if (typeof v[k] !== "function") o[k] = enc(v[k]);
    }
    return { $r: idx };
  }
  return { root: enc(root), heap };
}

export function refDeserialize(data) {
  if (!data || !Array.isArray(data.heap) || data.heap.length > 100000) throw new Error("記録の形式が不正です");
  const heap = data.heap;
  const objs = heap.map((n) => {
    if (n && Array.isArray(n.a)) return [];
    if (n && n.o && typeof n.o === "object" && !Array.isArray(n.o)) return {};
    throw new Error("記録の形式が不正です");
  });
  const dec = (v) => {
    if (v !== null && typeof v === "object") {
      if (!Number.isInteger(v.$r) || v.$r < 0 || v.$r >= objs.length) throw new Error("記録の参照が不正です");
      return objs[v.$r];
    }
    return v;
  };
  heap.forEach((n, i) => {
    if (n.a) for (const x of n.a) objs[i].push(dec(x));
    else for (const k of Object.keys(n.o)) {
      if (["__proto__", "prototype", "constructor"].includes(k)) throw new Error("記録のキーが不正です");
      objs[i][k] = dec(n.o[k]);
    }
  });
  return dec(data.root);
}

// 演出・開いている画面が握っている人業の参照を、サーバーの返答でも保つ。
export function applySavePatch(game, packet) {
  const map = new Map(), done = new Set();
  // 戦闘サーバーは安定度を変更しない。通信待ち中に進んだ自然回復を古い値で戻さない。
  const recovery = new Map([...(game.party || []), ...(game.reserve || [])]
    .filter(d => Number.isFinite(d.stability) && Number.isFinite(d.stabilityAt))
    .map(d => [d, {stability:d.stability, stabilityAt:d.stabilityAt}]));
  const snap = packet.snapshot;
  const link = (xs, ys) => {
    for (const x of xs || []) {
      const y = (ys || []).find((y) => y.uid === x.uid && y.side === x.side);
      if (y) map.set(x, y);
    }
  };
  link(snap.party, game.party); link(snap.reserve, game.reserve); link(snap.souls, game.souls);
  link(snap.battle?.enemies, game.battle?.enemies);
  if (snap.battle && game.battle) map.set(snap.battle, game.battle);
  function copy(x) {
    if (!x || typeof x !== "object") return x;
    let y = map.get(x);
    if (!y) { y = Array.isArray(x) ? [] : {}; map.set(x, y); }
    if (done.has(x)) return y;
    done.add(x);
    if (Array.isArray(y)) y.length = 0;
    else for (const k of Object.keys(y)) if (!(k in x) && typeof y[k] !== "function") delete y[k];
    for (const k of Object.keys(x)) y[k] = copy(x[k]);
    return y;
  }
  for (const k of Object.keys(snap)) game[k] = copy(snap[k]);
  for (const [d, value] of recovery) Object.assign(d, value);
  return { result: copy(packet.result), logs: packet.logs || [], modFeed: copy(packet.modFeed || []) };
}

// サーバー確定済みの記録だけへ差分を反映する。端末での未送信の変更は混ぜない。
export function acknowledgedSave(raw, packet) {
  if (!raw) return null;
  const saved = refDeserialize(JSON.parse(raw));
  applySavePatch(saved, refDeserialize(packet));
  return JSON.stringify(refSerialize(saved));
}
