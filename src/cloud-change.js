// 参照グラフそのものを更新する。品・戦闘対象の共有参照は復元時に維持する。
const forbidden = key => ["__proto__", "prototype", "constructor"].includes(key);
const json = JSON.stringify;
// 品の辞書に挿入があると後続の番号がずれる。同じ項目を順序を保って探し、隙間だけを置き換える。
// DBのJSONキー順には依存せず、重複した項目は一致点に使わない。
function templateSplices(a, b, path) {
  const ordered = value => Array.isArray(value) ? value.map(ordered)
    : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map(key => [key, ordered(value[key])])) : value;
  const before = a.map(value => json(ordered(value))), after = b.map(value => json(ordered(value)));
  const positions = new Map(), counts = new Map();
  for (let i = 0; i < before.length; i++) {
    const found = positions.get(before[i]);
    positions.set(before[i], { index: i, count: (found?.count || 0) + 1 });
  }
  for (const signature of after) counts.set(signature, (counts.get(signature) || 0) + 1);
  const matches = [];
  for (let i = 0; i < after.length; i++) {
    const found = positions.get(after[i]);
    if (found?.count === 1 && counts.get(after[i]) === 1) matches.push({ a: found.index, b: i });
  }
  // 前後で順序を保つ一致点を O(n log n) で選ぶ。
  const tails = [], previous = [];
  for (let i = 0; i < matches.length; i++) {
    let lo = 0, hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (matches[tails[mid]].a < matches[i].a) lo = mid + 1;
      else hi = mid;
    }
    previous[i] = lo ? tails[lo - 1] : -1;
    tails[lo] = i;
  }
  const anchors = [];
  let cursor = tails.at(-1);
  while (cursor !== undefined && cursor >= 0) { anchors.push(matches[cursor]); cursor = previous[cursor]; }
  anchors.reverse();
  anchors.push({ a: a.length, b: b.length });
  const ops = [];
  let ai = 0, bi = 0;
  for (const mark of anchors) {
    if (mark.a > ai || mark.b > bi) ops.push(["splice", path, bi, mark.a - ai, b.slice(bi, mark.b)]);
    ai = mark.a + 1; bi = mark.b + 1;
  }
  return ops;
}

export function createCloudChange(base, next) {
  if (!base) return { snapshot: next };
  const visit = (a, b, path) => {
    if (json(a) === json(b)) return [];
    const whole = [["set", path, b]];
    if (!a || !b || typeof a !== "object" || typeof b !== "object" || Array.isArray(a) !== Array.isArray(b)) return whole;
    let ops = [];
    if (Array.isArray(b)) {
      const n = Math.min(a.length, b.length);
      for (let i = 0; i < n; i++) ops.push(...visit(a[i], b[i], [...path, i]));
      if (a.length !== b.length) ops.push(["splice", path, n, a.length - n, b.slice(n)]);
      if (path.at(-1) === "templates" && a.length > 16 && b.length > 16) {
        const anchored = templateSplices(a, b, path);
        if (json(anchored).length < json(ops).length) ops = anchored;
      }
    } else {
      for (const key of Object.keys(a)) if (!(key in b)) ops.push(["del", [...path, key]]);
      for (const key of Object.keys(b)) ops.push(...(key in a ? visit(a[key], b[key], [...path, key]) : [["set", [...path, key], b[key]]]));
    }
    return ops.length < 20000 && json(ops).length < json(whole).length ? ops : whole;
  };
  const change = visit(base, next, []);
  if (!change.length) return null;
  return json({ change }).length < json({ snapshot: next }).length ? { change } : { snapshot: next };
}
export function applyCloudChange(base, ops) {
  const fail = () => { throw Object.assign(new Error("記録の差分が不正です"), { status: 400 }); };
  if (!base || !Array.isArray(ops) || ops.length > 20000) return fail();
  let root = JSON.parse(json(base));
  for (const entry of ops) {
    if (!Array.isArray(entry)) return fail();
    const [op, path, value, count, added] = entry;
    if (!["set", "del", "splice"].includes(op) || !Array.isArray(path) || path.length > 100 || path.some(k => typeof k !== "string" && !Number.isSafeInteger(k) || forbidden(k))) return fail();
    let target = root;
    for (const key of path.slice(0, op === "splice" ? path.length : -1)) {
      if (!target || typeof target !== "object" || !Object.hasOwn(target, key)) return fail();
      target = target[key];
    }
    if (op === "splice") {
      if (!Array.isArray(target) || !Number.isSafeInteger(value) || value < 0 || value > target.length || !Number.isSafeInteger(count) || count < 0 || count > target.length - value || !Array.isArray(added) || added.length + target.length - count > 100000) return fail();
      const tail = target.slice(value + count); target.length = value;
      for (const item of added) target.push(item);
      for (const item of tail) target.push(item);
    } else if (!path.length) {
      if (op !== "set") return fail();
      root = value;
    } else {
      if (!target || typeof target !== "object") return fail();
      const key = path.at(-1);
      if (Array.isArray(target) && (!Number.isSafeInteger(key) || key < 0 || key >= target.length)) return fail();
      if (op === "del") { if (!Object.hasOwn(target, key) || Array.isArray(target)) return fail(); delete target[key]; }
      else target[key] = value;
    }
  }
  if (new TextEncoder().encode(json(root)).length > 16 * 1024 * 1024) return fail();
  return root;
}
