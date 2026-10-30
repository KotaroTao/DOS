// セーブの共有参照を保つ。戦闘の対象と隊・魂は同じオブジェクトへ復元する。
export function refSerialize(root, { compact = false } = {}) {
  const heap = [], map = new Map(), templates = [], shapes = new Map();
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
      const o = {}, node = { o }; heap.push(node);
      for (const k of Object.keys(v)) if (typeof v[k] !== "function") o[k] = enc(v[k]);
      if (compact) {
        // 同じ品も別の個体のまま。共有するのは保存上の不変な値の型だけ。
        const base = {}, keys = [], refs = [];
        for (const k of Object.keys(o)) {
          if (o[k] && typeof o[k] === "object") { keys.push(k); refs.push(o[k].$r); }
          else base[k] = o[k];
        }
        const shape = { o: base, keys }, signature = JSON.stringify(shape);
        let t = shapes.get(signature);
        if (t === undefined) { t = templates.length; templates.push(shape); shapes.set(signature, t); }
        delete node.o; node.t = t;
        if (refs.length) node.r = refs;
      }
    }
    return { $r: idx };
  }
  const result = { root: enc(root), heap };
  if (compact) { result.format = 2; result.templates = templates; }
  return result;
}

export function refDeserialize(data) {
  if (!data || !Array.isArray(data.heap) || data.heap.length > 100000) throw new Error("記録の形式が不正です");
  const heap = data.heap;
  if (data.format === 2 && (!Array.isArray(data.templates) || data.templates.length > 100000)) throw new Error("記録の型が不正です");
  const templateCosts = new Map(); let expandedBytes = 0;
  const template = n => {
    const t = data.templates?.[n.t];
    if (data.format !== 2 || !Number.isInteger(n.t) || n.t < 0 || !t || !t.o || typeof t.o !== "object" || Array.isArray(t.o) || !Array.isArray(t.keys)
      || (n.r?.length || 0) !== t.keys.length) throw new Error("記録の型が不正です");
    return t;
  };
  const objs = heap.map((n) => {
    if (n && Array.isArray(n.a)) return [];
    if (n && "t" in n) {
      const t = template(n);
      // 小さな要求から巨大な展開を作らせない。展開後の値は32MiBまで。
      if (!templateCosts.has(n.t)) templateCosts.set(n.t, new TextEncoder().encode(JSON.stringify(t)).length + t.keys.length * 32 + 16);
      expandedBytes += templateCosts.get(n.t);
      if (expandedBytes > 32 * 1024 * 1024) throw new Error("記録の展開が大きすぎます");
      return {};
    }
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
    else if ("t" in n) {
      const t = template(n);
      for (const k of Object.keys(t.o)) {
        if (["__proto__", "prototype", "constructor"].includes(k) || (t.o[k] !== null && typeof t.o[k] === "object")) throw new Error("記録のキーが不正です");
        objs[i][k] = t.o[k];
      }
      for (let j = 0; j < t.keys.length; j++) {
        const k = t.keys[j];
        if (typeof k !== "string" || ["__proto__", "prototype", "constructor"].includes(k)) throw new Error("記録のキーが不正です");
        objs[i][k] = dec({ $r: n.r[j] });
      }
    } else for (const k of Object.keys(n.o)) {
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
  // 旧サーバーは共通の袋をparty/reserve経由でだけ返す。その袋も同時に反映する。
  // 元のinventoryと複製された人業の袋をshareInventoryで合成すると品が増殖する。
  if (!Array.isArray(snap.inventory)) {
    const dolls = [...(snap.party || []), ...(snap.reserve || [])];
    const bag = dolls[0]?.items;
    if (Array.isArray(bag) && dolls.every(d => d.items === bag)) snap.inventory = bag;
  }
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
  const graph = JSON.parse(raw);
  const saved = refDeserialize(graph);
  applySavePatch(saved, refDeserialize(packet));
  return JSON.stringify(refSerialize(saved, { compact: graph.format === 2 }));
}
