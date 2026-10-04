// 正面向きの品 (盾・鎧・頭・足・小手・装飾) の共通の道具
import { Grid } from "./core.js";

export const CX = 11.5; // 左右対称の軸 (x = 11 と 12 の間)

// 正面の光: 左が明るく右が暗い、上が明るく下が暗い
export const lit = (x, y, base, kx = 1.6, ky = 0.6) => base + ((CX - x) / 11.5) * kx + ((11.5 - y) / 11.5) * ky;
export const clampT = (t) => Math.max(0, Math.min(4, Math.round(t)));

// 形 (inside(x, y)) を塗る。縁 (rim 升) は trimMat、中は fill(x, y) → [素材, 階調]
export function shape(g, inside, rim, trimMat, fill) {
  const isIn = (x, y) => x >= 0 && y >= 0 && x < 24 && y < 24 && inside(x + 0.5, y + 0.5);
  for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) {
    if (!isIn(x, y)) continue;
    let edge = 99;
    for (let d = 1; d <= rim; d++) {
      if (!isIn(x - d, y) || !isIn(x + d, y) || !isIn(x, y - d) || !isIn(x, y + d)) { edge = d; break; }
    }
    if (edge <= rim && trimMat) {
      // 縁: 左上は明るく、右下は暗く
      const ul = !isIn(x - 1, y) || !isIn(x, y - 1);
      const dr = !isIn(x + 1, y) || !isIn(x, y + 1);
      let t = lit(x, y, 2, 1.4, 0.8);
      if (edge === 1 && ul && !dr) t += 1;
      if (edge === 1 && dr) t -= 1;
      if (edge > 1) t -= 0.6;
      g.set(x, y, trimMat, clampT(t));
    } else {
      const f = fill(x, y);
      if (f) g.set(x, y, f[0], clampT(f[1]));
    }
  }
}

// 手前の品と奥の品を重ねる: 奥を描いてから、手前の形の周り 1升を黒で縁取って手前を重ねる
export function layered(g, drawBack, drawFront) {
  drawBack(g);
  const f = new Grid();
  f.mats = g.mats;
  drawFront(f);
  for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) {
    if (f.get(x, y)) continue;
    const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => f.get(x + dx, y + dy));
    if (near && g.get(x, y)) g.ink(x, y);
  }
  for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) { const p = f.get(x, y); if (p) g.c[y * 24 + x] = p; }
}

