// 収集品の固有の絵 (src/catalog/miscart.js) の見本と検査。
//   node tools/miscart.mjs                       … ゲームに入っている全収集品 (misc.js の並び) を見本 PNG に
//   node tools/miscart.mjs <file.mjs> [id ...]   … 下書き (export default { id: { pal, art } }) を見本 PNG に
//   オプション: --out <png> (既定: OS の一時フォルダ/miscart.png)  --s <倍率> (既定 4)  --cols <列数> (既定 10)
// 見本は 1 枠ごとに「等倍で s 倍」+ 下に「ゲームの小さな札に近い 2 倍」を並べる。並び順は標準出力に出す。
// 検査: 24 行 × 24 文字 / 使う文字がすべてパレットにある / 色は #rrggbb / 黒縁 k がある / 同じ絵が二つ無い。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { writePNG } from "./hdart/png.mjs";
import { ITEM_PALETTE as MISC_PALETTE } from "../src/catalog/defs.js";

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const OUT = opt("--out", path.join(os.tmpdir(), "miscart.png"));
const S = Number(opt("--s", 4));
const COLS = Number(opt("--cols", 10));

let entries; // [{ id, name, palette, art }]
if (args[0] && args[0].endsWith(".mjs") || args[0] && args[0].endsWith(".js")) {
  const mod = await import(pathToFileURL(path.resolve(args[0])).href);
  const data = mod.default || mod.MISC_ART;
  const only = args.slice(1);
  entries = Object.entries(data).filter(([id]) => !only.length || only.includes(id))
    .map(([id, a]) => ({ id, name: "", palette: { ...MISC_PALETTE, ...(a.pal || {}) }, art: a.art }));
} else {
  const { MISC } = await import("../src/catalog/misc.js");
  entries = MISC.filter((i) => i.slot === "misc").map((i) => ({ id: i.id, name: i.name, palette: i.palette, art: i.art }));
}

// --- 検査 ---
let bad = 0;
const seen = new Map();
for (const e of entries) {
  const errs = [];
  if (!Array.isArray(e.art) || e.art.length !== 24) errs.push("行数 " + (e.art && e.art.length));
  (e.art || []).forEach((r, y) => {
    if (r.length !== 24) errs.push(`行${y} の幅 ${r.length}`);
    for (const c of r) if (c !== "." && !e.palette[c]) errs.push(`未定義の色 "${c}" (行${y})`);
  });
  for (const k in e.palette) {
    const v = e.palette[k];
    if (v && !/^#[0-9a-fA-F]{6}$/.test(v) && !/^rgba\(/.test(v)) errs.push(`色の書式 ${k}=${v}`);
  }
  if (!(e.art || []).some((r) => r.includes("k"))) errs.push("黒縁 k が無い");
  const sig = (e.art || []).join("\n");
  if (seen.has(sig)) errs.push("絵が " + seen.get(sig) + " と同じ");
  seen.set(sig, e.id);
  if (errs.length) { bad++; console.log("✗", e.id, errs.slice(0, 6).join(" / ")); }
}

// --- 見本 ---
const hex = (s) => {
  if (s.startsWith("rgba")) { const m = s.match(/[\d.]+/g).map(Number); return [m[0], m[1], m[2], m[3]]; }
  return [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16), 1];
};
const cw = 24 * S + 16, chh = 24 * S + 24 * 2 + 24;
const rows = Math.ceil(entries.length / COLS);
const W = cw * COLS, H = chh * rows;
const px = new Uint8Array(W * H * 4);
const BG = [26, 28, 34];
for (let i = 0; i < W * H; i++) { px[i * 4] = BG[0]; px[i * 4 + 1] = BG[1]; px[i * 4 + 2] = BG[2]; px[i * 4 + 3] = 255; }
function put(x, y, c) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const p = (y * W + x) * 4, a = c[3];
  px[p] = Math.round(px[p] * (1 - a) + c[0] * a); px[p + 1] = Math.round(px[p + 1] * (1 - a) + c[1] * a); px[p + 2] = Math.round(px[p + 2] * (1 - a) + c[2] * a);
}
function blit(e, ox, oy, s) {
  e.art.forEach((row, y) => { for (let x = 0; x < row.length; x++) {
    const ch = row[x]; if (ch === "." || !e.palette[ch]) continue; const col = hex(e.palette[ch]);
    for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) put(ox + x * s + dx, oy + y * s + dy, col);
  } });
}
entries.forEach((e, i) => {
  const ox = (i % COLS) * cw + 8, oy = Math.floor(i / COLS) * chh + 8;
  blit(e, ox, oy, S);
  blit(e, ox, oy + 24 * S + 8, 2);
});
writePNG(OUT, W, H, px);
entries.forEach((e, i) => console.log(String(i + 1).padStart(3), e.id, e.name));
console.log(bad ? `検査で ${bad} 件の問題` : "検査 OK", "/ 見本:", OUT);
if (bad) process.exitCode = 1;
