// 職業アイコンを rank1-5 横並びの PNG に書き出す確認用ツール (本番では未使用)
import zlib from "node:zlib";
import fs from "node:fs";
import { jobSprite } from "../src/souls.js";

function crc32(buf) {
  let c, table = crc32.t;
  if (!table) {
    table = crc32.t = [];
    for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0; }
  }
  c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const t = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([t, data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function writePNG(path, w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8bit RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const idat = zlib.deflateSync(raw);
  fs.writeFileSync(path, Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]));
}

function parseColor(s) {
  if (s.startsWith("rgba")) {
    const [r, g, b, a] = s.slice(5, -1).split(",").map((x) => parseFloat(x));
    return [r, g, b, Math.round(a * 255)];
  }
  const p = parseInt(s.slice(1), 16);
  return [(p >> 16) & 255, (p >> 8) & 255, p & 255, 255];
}

const job = process.argv[2] || "fighter";
const SCALE = 14, PAD = 8, BG = [22, 20, 28, 255];

const sprs = [1, 2, 3, 4, 5].map((r) => jobSprite(job, r));
const gw = sprs[0].art.reduce((m, a) => Math.max(m, a.length), 0);
const gh = sprs[0].art.length;
const cellW = gw * SCALE + PAD * 2;
const cellH = gh * SCALE + PAD * 2 + 16;
const W = cellW * 5, H = cellH;
const rgba = Buffer.alloc(W * H * 4);
for (let i = 0; i < W * H; i++) { rgba[i * 4] = BG[0]; rgba[i * 4 + 1] = BG[1]; rgba[i * 4 + 2] = BG[2]; rgba[i * 4 + 3] = 255; }

function px(x, y, c) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  const a = c[3] / 255;
  rgba[i] = Math.round(rgba[i] * (1 - a) + c[0] * a);
  rgba[i + 1] = Math.round(rgba[i + 1] * (1 - a) + c[1] * a);
  rgba[i + 2] = Math.round(rgba[i + 2] * (1 - a) + c[2] * a);
  rgba[i + 3] = 255;
}

sprs.forEach((spr, idx) => {
  const ox = idx * cellW + PAD, oy = PAD + 12;
  for (let y = 0; y < spr.art.length; y++) {
    const row = spr.art[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === "." || ch === " ") continue;
      const col = spr.palette[ch];
      if (!col) continue;
      const c = parseColor(col);
      for (let dy = 0; dy < SCALE; dy++) for (let dx = 0; dx < SCALE; dx++) px(ox + x * SCALE + dx, oy + y * SCALE + dy, c);
    }
  }
});

const out = `tools/preview_${job}.png`;
writePNG(out, W, H, rgba);
console.log("wrote", out, W + "x" + H);

// ASCII プレビュー (rank3 を代表表示)
const a = jobSprite(job, 3).art;
console.log("\n--- " + job + " (rank3) ascii ---");
for (const row of a) console.log(row.replace(/\./g, "  ").replace(/[^ ]/g, "##").replace(/##/g, (m) => m));
