// カードボードの生成 (壁つき迷路 + 行き止まりイベント)
// セル: { type, revealed, cleared, monsterKey }
// type: wall | start | empty | monster | chest | trap | fountain | stairs
//
// ルール:
// - 迷路状に壁を配置する
// - 行き止まりには 50% で何らかのイベント (モンスター/宝箱/罠/泉)
// - 行き止まり以外にはイベントを置かない
// - 階段は各階に1つ。行き止まりとは限らないが、スタートから10歩より遠い場所にのみ出現

export const COLS = 9;
export const ROWS = 7;

const MONSTER_POOL = {
  1: ["slime", "bat", "kobold"],
  2: ["kobold", "skeleton", "orc"],
  3: ["skeleton", "orc", "wraith"],
};

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// 再帰的バックトラッカー: 偶数座標をノードとして通路を掘る (0=通路, 1=壁)
function carveMaze(cols, rows, sx, sy) {
  const g = Array.from({ length: rows }, () => Array(cols).fill(1));
  g[sy][sx] = 0;
  const stack = [[sx, sy]];
  const seen = new Set([sx + "," + sy]);
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const dirs = [[2, 0], [-2, 0], [0, 2], [0, -2]].sort(() => Math.random() - 0.5);
    let moved = false;
    for (const [dx, dy] of dirs) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      if (seen.has(nx + "," + ny)) continue;
      seen.add(nx + "," + ny);
      g[ny][nx] = 0;
      g[y + dy / 2][x + dx / 2] = 0;
      stack.push([nx, ny]);
      moved = true;
      break;
    }
    if (!moved) stack.pop();
  }
  return g;
}

// スタートからの歩数 (壁以外を通る最短距離)
function bfsDist(g, sx, sy) {
  const dist = Array.from({ length: ROWS }, () => Array(COLS).fill(-1));
  dist[sy][sx] = 0;
  const q = [[sx, sy]];
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      if (g[ny][nx] === 1 || dist[ny][nx] >= 0) continue;
      dist[ny][nx] = dist[y][x] + 1;
      q.push([nx, ny]);
    }
  }
  return dist;
}

export function makeBoard(floor) {
  const sx = 0, sy = 2; // スタートは左側の固定ノード
  const g = carveMaze(COLS, ROWS, sx, sy);
  const dist = bfsDist(g, sx, sy);

  // 通路セルの基礎データ
  // 壁も含めてすべて裏向きカード。めくって中身が判明する
  const cells = Array.from({ length: ROWS }, (_, y) =>
    Array.from({ length: COLS }, (_, x) =>
      g[y][x] === 1
        ? { type: "wall", revealed: false, cleared: false }
        : { type: "empty", revealed: false, cleared: true }
    )
  );
  cells[sy][sx] = { type: "start", revealed: true, cleared: true };

  // 階段: スタートから10歩より遠い通路セルからランダムに選ぶ
  const farCells = [];
  let best = { x: sx, y: sy, d: 0 };
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const d = dist[y][x];
      if (d <= 0) continue;
      if (d > 10) farCells.push({ x, y });
      if (d > best.d) best = { x, y, d };
    }
  }
  const st = farCells.length ? pick(farCells) : best; // 万一なければ最遠セル
  cells[st.y][st.x] = { type: "stairs", revealed: false, cleared: false };

  // 行き止まり (通路の隣接が1つだけ) に 50% でイベント
  const pool = MONSTER_POOL[floor] || MONSTER_POOL[3];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const c = cells[y][x];
      if (c.type !== "empty") continue;
      let open = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
        if (g[ny][nx] === 0) open++;
      }
      if (open !== 1) continue;       // 行き止まりのみ
      if (Math.random() >= 0.5) continue; // 50%
      const r = Math.random();
      if (r < 0.5) cells[y][x] = { type: "monster", monsterKey: pick(pool), revealed: false, cleared: false };
      else if (r < 0.7) cells[y][x] = { type: "chest", revealed: false, cleared: false };
      else if (r < 0.85) cells[y][x] = { type: "trap", revealed: false, cleared: false };
      else cells[y][x] = { type: "fountain", revealed: false, cleared: false };
    }
  }

  return { cells, start: { x: sx, y: sy }, floor };
}
