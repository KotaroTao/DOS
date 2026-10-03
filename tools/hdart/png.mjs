import zlib from "node:zlib";
import fs from "node:fs";
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
function crc(buf) { let c = -1; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }
function chunk(t, d) { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); }
// rgba: Uint8Array w*h*4
export function writePNG(path, w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1); }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
  fs.writeFileSync(path, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ih), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
}
const hex = s => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
// sheet of sprites {palette, art}, scale s, bg color, with label-less grid
export function sheet(path, sprites, s = 3, cols = 4, bg = "#1a1c22") {
  const cw = Math.max(...sprites.map(a => Math.max(...a.art.map(r => r.length)))) + 8;
  const ch = Math.max(...sprites.map(a => a.art.length)) + 8;
  const rows = Math.ceil(sprites.length / cols);
  const W = cw * cols * s, H = ch * rows * s;
  const px = new Uint8Array(W * H * 4); const b = hex(bg);
  for (let i = 0; i < W * H; i++) { px[i * 4] = b[0]; px[i * 4 + 1] = b[1]; px[i * 4 + 2] = b[2]; px[i * 4 + 3] = 255; }
  sprites.forEach((a, i) => {
    const ox = (i % cols) * cw + 4, oy = Math.floor(i / cols) * ch + 4;
    const pal = {}; for (const k in a.palette) pal[k] = hex(a.palette[k]);
    a.art.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const c = row[x]; if (c === ".") continue; const col = pal[c];
      for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) { const p = (((oy + y) * s + dy) * W + (ox + x) * s + dx) * 4; px[p] = col[0]; px[p + 1] = col[1]; px[p + 2] = col[2]; } } });
  });
  writePNG(path, W, H, px);
}
