// 盤面生成: 壁は「マスの辺」に置く迷路 (縦6 x 横8)
// 各マスは通行可能。隣との境界に壁があるかで移動可否が決まる。
// 完全迷路なのでどのマスへもいずれかのルートで到達できる。
//
// セル: { type, revealed, cleared, walls:{n,e,s,w}, monsterKey? }
// type: start | empty | monster | chest | trap | fountain | stairs
// walls: その辺に壁があれば true (隣接セルと共有)

export const COLS = 8;
export const ROWS = 6;

const MONSTER_POOL = {
  1: ["slime", "bat", "kobold"],
  2: ["kobold", "skeleton", "orc"],
  3: ["skeleton", "orc", "wraith"],
};

const DIRS = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };
const OPP = { n: "s", e: "w", s: "e", w: "n" };
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// 成長木法 (ランダム選択 = Prim風) で完全迷路を掘る。
// 常に最新を選ぶと長い廊下、ランダムに選ぶと分岐が多い迷路になる。
function carve(sx, sy) {
  const cells = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({ walls: { n: true, e: true, s: true, w: true } }))
  );
  const visited = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  const active = [[sx, sy]];
  visited[sy][sx] = true;
  while (active.length) {
    // 70%ランダム・30%最新 で分岐多めにしつつ廊下も残す
    const idx = Math.random() < 0.7
      ? Math.floor(Math.random() * active.length)
      : active.length - 1;
    const [x, y] = active[idx];
    const opts = [];
    for (const d in DIRS) {
      const nx = x + DIRS[d][0], ny = y + DIRS[d][1];
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      if (!visited[ny][nx]) opts.push([d, nx, ny]);
    }
    if (!opts.length) { active.splice(idx, 1); continue; }
    const [d, nx, ny] = pick(opts);
    cells[y][x].walls[d] = false;
    cells[ny][nx].walls[OPP[d]] = false;
    visited[ny][nx] = true;
    active.push([nx, ny]);
  }
  return cells;
}

// 壁を考慮した最短歩数 (スタートから)
function bfsDist(cells, sx, sy) {
  const dist = Array.from({ length: ROWS }, () => Array(COLS).fill(-1));
  dist[sy][sx] = 0;
  const q = [[sx, sy]];
  while (q.length) {
    const [x, y] = q.shift();
    for (const d in DIRS) {
      if (cells[y][x].walls[d]) continue; // 壁で塞がれている
      const nx = x + DIRS[d][0], ny = y + DIRS[d][1];
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      if (dist[ny][nx] >= 0) continue;
      dist[ny][nx] = dist[y][x] + 1;
      q.push([nx, ny]);
    }
  }
  return dist;
}

// 開いている辺の数 (1なら行き止まり)
function openCount(cell) {
  return ["n", "e", "s", "w"].filter((d) => !cell.walls[d]).length;
}

export function makeBoard(floor) {
  const sx = 0, sy = Math.floor(ROWS / 2);
  // 階段を必ず「10歩より遠く」に置けるよう、最遠マスが10歩超になる迷路を引く
  let grid, dist, maxD;
  for (let attempt = 0; attempt < 60; attempt++) {
    grid = carve(sx, sy);
    dist = bfsDist(grid, sx, sy);
    maxD = Math.max(...dist.flat());
    if (maxD > 10) break;
  }

  // 全マスに基礎データを付与
  const cells = grid.map((row, y) =>
    row.map((c, x) => ({
      type: "empty",
      revealed: false,
      cleared: true,
      walls: c.walls,
    }))
  );
  cells[sy][sx].type = "start";
  cells[sy][sx].revealed = true;

  // 階段: スタートから10歩より遠いマスから選ぶ (行き止まりとは限らない)
  const far = [];
  let best = { x: sx, y: sy, d: 0 };
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const d = dist[y][x];
      if (d > 10) far.push({ x, y });
      if (d > best.d) best = { x, y, d };
    }
  }
  const st = far.length ? pick(far) : best;
  cells[st.y][st.x].type = "stairs";
  cells[st.y][st.x].cleared = false;

  // イベントは行き止まり (開いた辺が1つ) にのみ50%
  const pool = MONSTER_POOL[floor] || MONSTER_POOL[3];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const c = cells[y][x];
      if (c.type !== "empty") continue;
      if (openCount(c) !== 1) continue;
      if (Math.random() >= 0.5) continue;
      const r = Math.random();
      if (r < 0.5) { c.type = "monster"; c.monsterKey = pick(pool); c.cleared = false; }
      else if (r < 0.7) { c.type = "chest"; c.cleared = false; }
      else if (r < 0.85) { c.type = "trap"; c.cleared = false; }
      else { c.type = "fountain"; c.cleared = false; }
    }
  }

  return { cells, start: { x: sx, y: sy }, floor };
}
