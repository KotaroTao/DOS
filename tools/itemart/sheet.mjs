// 装備の絵 ({palette, art}) を並べた見本 PNG を書く (Node の標準機能だけ)
//   sheet(path, sprites, {s: 倍率, cols: 列数, bg: 背景})  palette の値は "#rrggbb" か "rgba(r,g,b,a)"
import { writePNG } from "../hdart/png.mjs";
function rgbaOf(s) {
  if (!s) return null;
  if (s[0] === "#") return [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16), 1];
  const m = s.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const v = m[1].split(",").map(Number);
  return [v[0], v[1], v[2], v[3] == null ? 1 : v[3]];
}
export function sheet(path, sprites, { s = 4, cols = 8, bg = "#211d24", pad = 4 } = {}) {
  const cw = 24 + pad * 2, ch = 24 + pad * 2;
  const rows = Math.ceil(sprites.length / cols);
  const W = cw * cols * s, H = ch * rows * s;
  const px = new Uint8Array(W * H * 4);
  const b = rgbaOf(bg);
  for (let i = 0; i < W * H; i++) { px[i * 4] = b[0]; px[i * 4 + 1] = b[1]; px[i * 4 + 2] = b[2]; px[i * 4 + 3] = 255; }
  sprites.forEach((a, i) => {
    const ox = (i % cols) * cw + pad, oy = Math.floor(i / cols) * ch + pad;
    // 枠 (升目の区切り)
    for (let y = 0; y < ch * s; y++) for (let x = 0; x < cw * s; x++) {
      if (x !== 0 && y !== 0) continue;
      const p = (((Math.floor(i / cols) * ch) * s + y) * W + (i % cols) * cw * s + x) * 4;
      px[p] = 60; px[p + 1] = 54; px[p + 2] = 66;
    }
    const pal = {};
    for (const k in a.palette) pal[k] = rgbaOf(a.palette[k]);
    a.art.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const c = row[x];
        if (c === "." || c === " ") continue;
        const col = pal[c];
        if (!col) continue;
        for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) {
          const p = (((oy + y) * s + dy) * W + (ox + x) * s + dx) * 4;
          const al = col[3];
          px[p] = Math.round(px[p] * (1 - al) + col[0] * al);
          px[p + 1] = Math.round(px[p + 1] * (1 - al) + col[1] * al);
          px[p + 2] = Math.round(px[p + 2] * (1 - al) + col[2] * al);
        }
      }
    });
  });
  writePNG(path, W, H, px);
}
