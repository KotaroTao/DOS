// 種つき乱数 (docs/infinite-labyrinth.md 12章、2026-10)
//
// ゲームの結果を決める乱数 (遊びの乱数) はすべてここの random() を使う。
// 乱数の位置 (状態) は G.rng としてセーブに入るので、読み込み直しても同じ結果になる
// (行動を確定 → 保存 → 演出 の順。演出の途中で閉じて読み込み直しても結果は変わらない)。
//
// 演出の乱数 (粒子・揺れ・台詞の選び方など、保存しないもの) は Math.random (または fxRandom) を使い、
// ここの random() を消費しない — 演出が遊びの乱数を消費すると、速さの設定・画面の大きさで結果が変わる。
//
// 生成器は sfc32 (32bit × 4 の状態)。状態は数の配列で、random() はその配列を書き換える。
// G.rng はこの配列そのものを指す (bindRngState) ので、保存のたびに写す手間は要らない。

const U32 = 4294967296;

let S = seedState(freshSeed());
let follow = false; // 検証ツール用: true なら Math.random に従う (useMathRandom)

function freshSeed() {
  try {
    const c = globalThis.crypto;
    if (c && c.getRandomValues) return c.getRandomValues(new Uint32Array(1))[0] >>> 0;
  } catch {}
  return (Math.random() * U32) >>> 0;
}

// 種1つから状態を作る (splitmix32 で4つに広げ、最初の数を捨てて混ぜる)
function seedState(seed) {
  let x = seed >>> 0;
  const next = () => {
    x = (x + 0x9e3779b9) >>> 0;
    let z = x;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
    return (z ^ (z >>> 16)) >>> 0;
  };
  const st = [next(), next(), next(), next()];
  if (!(st[0] | st[1] | st[2] | st[3])) st[3] = 1;
  for (let i = 0; i < 12; i++) step(st);
  return st;
}

function step(st) {
  let a = st[0] | 0, b = st[1] | 0, c = st[2] | 0, d = st[3] | 0;
  const t = (((a + b) | 0) + d) | 0;
  d = (d + 1) | 0;
  a = b ^ (b >>> 9);
  b = (c + (c << 3)) | 0;
  c = (c << 21) | (c >>> 11);
  c = (c + t) | 0;
  st[0] = a >>> 0; st[1] = b >>> 0; st[2] = c >>> 0; st[3] = d >>> 0;
  return (t >>> 0) / U32;
}

// 遊びの乱数: [0, 1)
export function random() {
  return follow ? Math.random() : step(S);
}
// 0 〜 n−1 の整数
export function randInt(n) { return Math.floor(random() * n); }
// 演出の乱数 (保存しない・遊びの乱数を消費しない)
export const fxRandom = () => Math.random();

const valid = (st) => Array.isArray(st) && st.length === 4
  && st.every((v) => Number.isInteger(v) && v >= 0 && v < U32) && (st[0] | st[1] | st[2] | st[3]) !== 0;

// いまの状態 (G.rng に入れる配列。random() が書き換え続ける)
export function rngState() { return S; }
// 読み込んだ状態を使う。壊れている・無い (旧セーブ) なら新しい種から始める。戻り値を G.rng に入れる
export function bindRngState(st) {
  S = valid(st) ? st : seedState(freshSeed());
  return S;
}
// 種を決めて始め直す (新しく始める時・検証)
// (同じ配列を書き換えるので、G.rng の参照はそのまま)
export function reseedRng(seed = freshSeed()) {
  const st = seedState(seed);
  for (let i = 0; i < 4; i++) S[i] = st[i];
  return S;
}

// 検証ツール用: random() を Math.random に従わせる (ツールが Math.random を差し替えて結果を固定するため)。
// ゲームでは呼ばない
export function useMathRandom(on = true) { follow = !!on; }
