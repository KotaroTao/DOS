// カードボードの生成 (モンスターメーカー風)
// セル: { type, revealed, cleared, monsterKey }
// type: start | empty | monster | chest | trap | fountain | stairs

export const COLS = 7;
export const ROWS = 5;

const MONSTER_POOL = {
  1: ["slime", "bat", "kobold"],
  2: ["kobold", "skeleton", "orc"],
  3: ["skeleton", "orc", "wraith"],
};

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function makeBoard(floor) {
  const cells = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => null)
  );

  const start = { x: 0, y: Math.floor(ROWS / 2) };
  cells[start.y][start.x] = { type: "start", revealed: true, cleared: true };

  // 階段は右側 1/3 のどこかに隠す
  let sx, sy;
  do {
    sx = COLS - 1 - Math.floor(Math.random() * Math.floor(COLS / 3));
    sy = Math.floor(Math.random() * ROWS);
  } while (cells[sy][sx]);
  cells[sy][sx] = { type: "stairs", revealed: false, cleared: false };

  const pool = MONSTER_POOL[floor] || MONSTER_POOL[3];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (cells[y][x]) continue;
      const r = Math.random();
      let cell;
      if (r < 0.38) cell = { type: "monster", monsterKey: pick(pool), revealed: false, cleared: false };
      else if (r < 0.65) cell = { type: "empty", revealed: false, cleared: true };
      else if (r < 0.78) cell = { type: "chest", revealed: false, cleared: false };
      else if (r < 0.90) cell = { type: "trap", revealed: false, cleared: false };
      else cell = { type: "fountain", revealed: false, cleared: false };
      cells[y][x] = cell;
    }
  }

  return { cells, start, floor };
}
