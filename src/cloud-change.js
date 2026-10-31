// 参照グラフそのものを更新する。品・戦闘対象の共有参照は復元時に維持する。
const forbidden = key => ["__proto__", "prototype", "constructor"].includes(key);
const json = JSON.stringify;
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
