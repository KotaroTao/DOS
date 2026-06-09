// 擬似3D(ワイヤー＋面塗り)のファーストパーソン描画 + ミニマップ
import { DIRS } from "./dungeon.js";

const MAX_DEPTH = 5;

// 各奥行きの投影半径(画面中心からの割合)
function projHalf(W, H, d) {
  const f = Math.pow(0.56, d);
  return { x: (W / 2) * f, y: (H / 2) * f };
}

export function renderView(ctx, dungeon, px, py, dir) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const cx = W / 2, cy = H / 2;

  // 背景(天井/床)
  const ceil = ctx.createLinearGradient(0, 0, 0, cy);
  ceil.addColorStop(0, "#0c0c16");
  ceil.addColorStop(1, "#1a1a28");
  ctx.fillStyle = ceil;
  ctx.fillRect(0, 0, W, cy);
  const floor = ctx.createLinearGradient(0, cy, 0, H);
  floor.addColorStop(0, "#241f17");
  floor.addColorStop(1, "#0d0b08");
  ctx.fillStyle = floor;
  ctx.fillRect(0, cy, W, cy);

  const f = DIRS[dir];                       // 前方
  const r = { dx: -f.dy, dy: f.dx };         // 右方向

  const cellAt = (depth, side) =>
    dungeon.cell(px + f.dx * depth + r.dx * side, py + f.dy * depth + r.dy * side);

  // 前方が壁で塞がる最初の奥行きを求める
  let stop = MAX_DEPTH;
  for (let d = 1; d <= MAX_DEPTH; d++) {
    if (cellAt(d, 0) === 1) { stop = d; break; }
  }

  const proj = [];
  for (let d = 0; d <= MAX_DEPTH + 1; d++) proj.push(projHalf(W, H, d));

  // 奥から手前へ描く(painter's algorithm)
  for (let d = stop; d >= 0; d--) {
    const o = proj[d], inr = proj[d + 1];
    const shade = Math.max(0.18, 1 - d * 0.18);

    // 左右の側壁スライス(この奥行きセルの左/右が壁なら)
    if (d < stop) {
      if (cellAt(d, -1) === 1) drawSideWall(ctx, cx, cy, o, inr, -1, shade);
      if (cellAt(d, 1) === 1) drawSideWall(ctx, cx, cy, o, inr, 1, shade);
    }
  }

  // 正面の壁 or 階段
  const front = cellAt(stop, 0);
  const p = proj[stop];
  const shade = Math.max(0.2, 1 - stop * 0.18);
  if (front === 1) {
    drawFrontWall(ctx, cx, cy, p, shade);
  }

  // 階段(ゴール)が前方に見えるか
  for (let d = 0; d <= stop; d++) {
    if (cellAt(d, 0) === 2) {
      drawStairs(ctx, cx, cy, proj[d], proj[d + 1]);
      break;
    }
  }

  // 暗いビネット
  const vg = ctx.createRadialGradient(cx, cy, H * 0.2, cx, cy, H * 0.75);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
}

function wallColor(base, shade) {
  const c = Math.round(base * shade);
  return `rgb(${c + 18},${c + 14},${c + 6})`;
}

function drawSideWall(ctx, cx, cy, o, inr, side, shade) {
  const sx = side; // -1 左, 1 右
  const xO = cx + sx * o.x, xI = cx + sx * inr.x;
  ctx.beginPath();
  ctx.moveTo(xO, cy - o.y);
  ctx.lineTo(xI, cy - inr.y);
  ctx.lineTo(xI, cy + inr.y);
  ctx.lineTo(xO, cy + o.y);
  ctx.closePath();
  ctx.fillStyle = wallColor(120, shade * 0.82);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawFrontWall(ctx, cx, cy, p, shade) {
  ctx.fillStyle = wallColor(120, shade);
  ctx.fillRect(cx - p.x, cy - p.y, p.x * 2, p.y * 2);
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - p.x, cy - p.y, p.x * 2, p.y * 2);
  // レンガ目地
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  const rows = 4;
  for (let i = 1; i < rows; i++) {
    const yy = cy - p.y + (p.y * 2 * i) / rows;
    ctx.beginPath();
    ctx.moveTo(cx - p.x, yy);
    ctx.lineTo(cx + p.x, yy);
    ctx.stroke();
  }
}

function drawStairs(ctx, cx, cy, o, inr) {
  const steps = 5;
  ctx.fillStyle = "#c9a227";
  for (let i = 0; i < steps; i++) {
    const t0 = i / steps, t1 = (i + 0.6) / steps;
    const y0 = cy + inr.y + (o.y - inr.y) * t0;
    const y1 = cy + inr.y + (o.y - inr.y) * t1;
    const x = inr.x + (o.x - inr.x) * t0;
    ctx.fillStyle = i % 2 ? "#9c7d1c" : "#c9a227";
    ctx.fillRect(cx - x, y0, x * 2, Math.max(2, y1 - y0));
  }
  ctx.fillStyle = "#fff3c0";
  ctx.font = "bold 12px monospace";
  ctx.textAlign = "center";
  ctx.fillText("階段 ↓", cx, cy - inr.y - 4);
}

export function renderMinimap(ctx, dungeon, px, py, dir, seen) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const n = dungeon.size;
  const cs = Math.floor(Math.min(W, H) / n);
  ctx.fillStyle = "#07070d";
  ctx.fillRect(0, 0, W, H);
  const ox = (W - cs * n) / 2, oy = (H - cs * n) / 2;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (seen && !seen[y][x]) continue;
      const v = dungeon.grid[y][x];
      ctx.fillStyle = v === 1 ? "#2c2c3d" : v === 2 ? "#c9a227" : "#12121c";
      ctx.fillRect(ox + x * cs, oy + y * cs, cs, cs);
    }
  }
  // プレイヤー
  ctx.fillStyle = "#6b8cff";
  const pxs = ox + px * cs + cs / 2, pys = oy + py * cs + cs / 2;
  const d = DIRS[dir];
  ctx.beginPath();
  ctx.moveTo(pxs + d.dx * cs * 0.5, pys + d.dy * cs * 0.5);
  ctx.lineTo(pxs - d.dx * cs * 0.4 - d.dy * cs * 0.35, pys - d.dy * cs * 0.4 + d.dx * cs * 0.35);
  ctx.lineTo(pxs - d.dx * cs * 0.4 + d.dy * cs * 0.35, pys - d.dy * cs * 0.4 - d.dx * cs * 0.35);
  ctx.closePath();
  ctx.fill();
}
