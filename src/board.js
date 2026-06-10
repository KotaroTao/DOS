// 盤面生成: 壁は「マスの辺」に置く迷路 (縦6 x 横8)
// 各マスは通行可能。隣との境界に壁があるかで移動可否が決まる。
// 完全迷路なのでどのマスへもいずれかのルートで到達できる。
//
// セル: { type, revealed, cleared, walls:{n,e,s,w}, monsterKey? }
// type: start | empty | monster | chest | trap | fountain | stairs
// walls: その辺に壁があれば true (隣接セルと共有)

export const COLS = 8;
export const ROWS = 6;

// 死体に宿る職業の候補 (魂の職業と対応)
const SOUL_CLASS_KEYS = ["fighter", "knight", "thief", "mage", "priest", "bishop"];

const MONSTER_POOL = {
  1: ["slime", "bat", "kobold"],
  2: ["kobold", "skeleton", "orc"],
  3: ["skeleton", "orc", "wraith"],
};

const DIRS = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };
const OPP = { n: "s", s: "n", e: "w", w: "e" };
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

// 不変条件を保証する:
//  1. 壁は隣接マスと対称 (片側だけ壁という"すり抜け"を防ぐ)
//  2. 外周は必ず壁
//  3. 4方を壁に囲まれたマスは作らない (最低1方向は開ける)
function ensureInvariants(cells) {
  // 壁の対称化 + 外周封鎖
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const c = cells[y][x];
      for (const d in DIRS) {
        const nx = x + DIRS[d][0], ny = y + DIRS[d][1];
        if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) {
          c.walls[d] = true; // 盤外: 必ず壁
        } else {
          // どちらかが壁なら両側を壁に揃える (すり抜け禁止)
          const wall = c.walls[d] || cells[ny][nx].walls[OPP[d]];
          c.walls[d] = wall;
          cells[ny][nx].walls[OPP[d]] = wall;
        }
      }
    }
  }
  // 全方位閉塞マスを解消: 盤内の隣へ1辺開ける
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (openCount(cells[y][x]) > 0) continue;
      const cand = [];
      for (const d in DIRS) {
        const nx = x + DIRS[d][0], ny = y + DIRS[d][1];
        if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
        cand.push([d, nx, ny]);
      }
      const [d, nx, ny] = pick(cand);
      cells[y][x].walls[d] = false;
      cells[ny][nx].walls[OPP[d]] = false;
    }
  }
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

  // 壁の対称性・外周封鎖・全方位閉塞マスの排除を保証
  ensureInvariants(cells);

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
  // 回復の泉は 1階層に最大1つ (0 の場合もある)
  const pool = MONSTER_POOL[floor] || MONSTER_POOL[3];
  let fountainCount = 0;
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const c = cells[y][x];
      if (c.type !== "empty") continue;
      if (openCount(c) !== 1) continue;
      if (Math.random() >= 0.5) continue;
      const r = Math.random();
      if (r < 0.42) { c.type = "monster"; c.monsterKey = pick(pool); c.cleared = false; }
      else if (r < 0.60) { c.type = "chest"; c.cleared = false; }
      else if (r < 0.80) {
        // 死体: 職業つき。一部は「まだあたたかい死体」で魂が手に入る (光る)
        c.type = "corpse"; c.cleared = false;
        c.corpseClass = pick(SOUL_CLASS_KEYS);
        c.corpseWarm = Math.random() < 0.38;
      }
      else if (r < 0.90) { c.type = "trap"; c.cleared = false; }
      else if (fountainCount < 1) { c.type = "fountain"; c.cleared = false; fountainCount++; }
      else { c.type = "monster"; c.monsterKey = pick(pool); c.cleared = false; } // 泉が満杯ならモンスターに
    }
  }

  return { cells, start: { x: sx, y: sy }, floor };
}
