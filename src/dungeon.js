// ダンジョン(迷路)生成とマップ管理
// セル値: 1 = 壁 / 0 = 通路 / 2 = 階段(ゴール)

export const DIRS = [
  { name: "北", dx: 0, dy: -1 },
  { name: "東", dx: 1, dy: 0 },
  { name: "南", dx: 0, dy: 1 },
  { name: "西", dx: -1, dy: 0 },
];

// 簡易な決定的乱数 (mulberry32)
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Dungeon {
  constructor(size = 15, seed = Date.now()) {
    this.size = size % 2 === 0 ? size + 1 : size; // 奇数に
    this.rand = rng(seed);
    this.grid = this.generate();
    this.placeGoal();
  }

  // 再帰的バックトラッカーで迷路生成
  generate() {
    const n = this.size;
    const g = Array.from({ length: n }, () => Array(n).fill(1));
    const inb = (x, y) => x > 0 && y > 0 && x < n - 1 && y < n - 1;
    const stack = [[1, 1]];
    g[1][1] = 0;
    while (stack.length) {
      const [x, y] = stack[stack.length - 1];
      const dirs = [[2, 0], [-2, 0], [0, 2], [0, -2]];
      // シャッフル
      for (let i = dirs.length - 1; i > 0; i--) {
        const j = Math.floor(this.rand() * (i + 1));
        [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
      }
      let moved = false;
      for (const [dx, dy] of dirs) {
        const nx = x + dx, ny = y + dy;
        if (inb(nx, ny) && g[ny][nx] === 1) {
          g[ny][nx] = 0;
          g[y + dy / 2][x + dx / 2] = 0;
          stack.push([nx, ny]);
          moved = true;
          break;
        }
      }
      if (!moved) stack.pop();
    }
    // 通路を少し増やして行き止まりを減らす
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (g[i][j] === 1 && inb(j, i) && this.rand() < 0.06) g[i][j] = 0;
      }
    }
    return g;
  }

  // スタートから最も遠い通路に階段を置く
  placeGoal() {
    const n = this.size;
    const dist = Array.from({ length: n }, () => Array(n).fill(-1));
    const q = [[1, 1]];
    dist[1][1] = 0;
    let far = [1, 1];
    while (q.length) {
      const [x, y] = q.shift();
      for (const d of DIRS) {
        const nx = x + d.dx, ny = y + d.dy;
        if (this.grid[ny] && this.grid[ny][nx] === 0 && dist[ny][nx] < 0) {
          dist[ny][nx] = dist[y][x] + 1;
          if (dist[ny][nx] > dist[far[1]][far[0]]) far = [nx, ny];
          q.push([nx, ny]);
        }
      }
    }
    this.goal = far;
    this.grid[far[1]][far[0]] = 2;
  }

  cell(x, y) {
    if (y < 0 || x < 0 || y >= this.size || x >= this.size) return 1;
    return this.grid[y][x];
  }

  isWall(x, y) {
    return this.cell(x, y) === 1;
  }

  isGoal(x, y) {
    return this.cell(x, y) === 2;
  }
}
