#!/usr/bin/env node
// 魔物の原画 (PNG) → ドット絵 {palette, art} に変換し、src/dungeons/monart.js の登録欄へ書き込む。
// 依存なし (Node 標準の zlib だけで PNG を読む)。ゲーム本体からは読み込まれない開発用の道具。
//
//   node tools/monart.mjs <魔物id> <原画.png> [オプション]      … 1体ずつ変換して登録
//   node tools/monart.mjs --dir <フォルダ> [--layer <n>] [オプション]
//                                                             … フォルダ内の「<魔物id>.png」をまとめて変換して登録
//                                                               (--layer を付けるとその層の原画待ち (ART_WANTED) だけを対象にする)
//   node tools/monart.mjs --list <層>                         … その層の原画待ちの一覧 (id・名前・格・差し替え済みか)
//     --h <n>         仕上がりの高さ (ドット)。既定 96、層ボス/強敵は 120 (--h を指定すると全員それに揃える)
//     --colors <n>    色数 (透明を除く)。既定 16
//     --tol <n>       背景抜きの許容差 (0-255)。既定 40。原画に透過があれば背景抜きはしない
//     --keep-bg       背景を抜かない
//     --dry           書き込まずに結果だけ表示する
//     --preview       ASCII の下見を表示する
//
// 処理: 背景抜き (四隅の色から塗りつぶし) → 余白を詰める → 面積平均で縮小 (1ドット=1画素)
//       → 中央値分割で減色 → 暗い順に記号を振る。
// 原画が JPEG なら、先に PNG に書き出してから渡すこと。
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MONART = path.join(ROOT, "src/dungeons/monart.js");

// ---------- 引数 ----------
const argv = process.argv.slice(2);
const opt = { h: 0, colors: 16, tol: 40, keepBg: false, dry: false, preview: false, dir: null, layer: 0, list: 0 };
const pos = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--h") opt.h = +argv[++i];
  else if (a === "--colors") opt.colors = +argv[++i];
  else if (a === "--tol") opt.tol = +argv[++i];
  else if (a === "--keep-bg") opt.keepBg = true;
  else if (a === "--dry") opt.dry = true;
  else if (a === "--preview") opt.preview = true;
  else if (a === "--dir") opt.dir = argv[++i];
  else if (a === "--layer") opt.layer = +argv[++i];
  else if (a === "--list") opt.list = +argv[++i];
  else pos.push(a);
}
const USAGE = "使い方: node tools/monart.mjs <魔物id> <原画.png> [--h 96] [--colors 16] [--tol 40] [--keep-bg] [--dry] [--preview]\n" +
  "        node tools/monart.mjs --dir <フォルダ> [--layer 3] [同上のオプション]\n" +
  "        node tools/monart.mjs --list <層>";
const single = !opt.dir && !opt.list;
if ((single && pos.length < 2) || (opt.h && !(opt.h > 4)) || !(opt.colors >= 2 && opt.colors <= 60)) {
  console.error(USAGE);
  process.exit(1);
}

// ---------- PNG を読む (8bit / 非インターレース) ----------
function readPng(file) {
  const buf = fs.readFileSync(file);
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("PNG ではない: " + file);
  let off = 8, w = 0, h = 0, depth = 0, ctype = 0, interlace = 0, plte = null, trns = null;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString("ascii", off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") { w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]; ctype = data[9]; interlace = data[12]; }
    else if (type === "PLTE") plte = data;
    else if (type === "tRNS") trns = data;
    else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    off += 12 + len;
  }
  if (interlace) throw new Error("インターレースPNGには未対応 (書き出し直してほしい)");
  if (depth !== 8) throw new Error(`ビット深度 ${depth} には未対応 (8bit で書き出してほしい)`);
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ctype];
  if (!ch) throw new Error("未対応の色形式: " + ctype);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const px = Buffer.alloc(stride * h);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const out = px.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? out[x - ch] : 0, b = prev[x], c = x >= ch ? prev[x - ch] : 0;
      let v = line[x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[x] = v & 255;
    }
    prev = out;
  }
  // RGBA に揃える
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    let r, g, b, al = 255;
    if (ctype === 0) { r = g = b = px[i]; }
    else if (ctype === 4) { r = g = b = px[i * 2]; al = px[i * 2 + 1]; }
    else if (ctype === 2) { r = px[i * 3]; g = px[i * 3 + 1]; b = px[i * 3 + 2]; }
    else if (ctype === 6) { r = px[i * 4]; g = px[i * 4 + 1]; b = px[i * 4 + 2]; al = px[i * 4 + 3]; }
    else { const k = px[i]; r = plte[k * 3]; g = plte[k * 3 + 1]; b = plte[k * 3 + 2]; if (trns && k < trns.length) al = trns[k]; }
    rgba.set([r, g, b, al], i * 4);
  }
  const hasAlpha = ctype === 4 || ctype === 6 || (ctype === 3 && !!trns);
  return { w, h, rgba, hasAlpha };
}

// ---------- 背景抜き: 四隅から似た色を塗りつぶして透明にする ----------
function removeBackground(img, tol) {
  const { w, h, rgba } = img;
  const seen = new Uint8Array(w * h);
  const corners = [0, w - 1, (h - 1) * w, h * w - 1];
  const dist = (i, c) => Math.max(Math.abs(rgba[i * 4] - c[0]), Math.abs(rgba[i * 4 + 1] - c[1]), Math.abs(rgba[i * 4 + 2] - c[2]));
  for (const s of corners) {
    if (seen[s]) continue;
    const c = [rgba[s * 4], rgba[s * 4 + 1], rgba[s * 4 + 2]];
    const stack = [s];
    while (stack.length) {
      const i = stack.pop();
      if (seen[i] || dist(i, c) > tol) continue;
      seen[i] = 1; rgba[i * 4 + 3] = 0;
      const x = i % w, y = (i / w) | 0;
      if (x > 0) stack.push(i - 1);
      if (x < w - 1) stack.push(i + 1);
      if (y > 0) stack.push(i - w);
      if (y < h - 1) stack.push(i + w);
    }
  }
}

// ---------- 余白を詰める ----------
function trim(img) {
  const { w, h, rgba } = img;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (rgba[(y * w + x) * 4 + 3] < 32) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (x1 < 0) throw new Error("絵が空になった (背景抜きの許容差 --tol を下げてみてほしい)");
  const nw = x1 - x0 + 1, nh = y1 - y0 + 1, out = new Uint8ClampedArray(nw * nh * 4);
  for (let y = 0; y < nh; y++) out.set(rgba.subarray(((y + y0) * w + x0) * 4, ((y + y0) * w + x1 + 1) * 4), y * nw * 4);
  return { w: nw, h: nh, rgba: out };
}

// ---------- 面積平均で縮小 (透過を考慮した加重平均。被覆が半分未満は透明) ----------
function downscale(img, th) {
  const s = img.h / th;
  const tw = Math.max(1, Math.round(img.w / s));
  const out = [];
  for (let ty = 0; ty < th; ty++) {
    const row = [];
    for (let tx = 0; tx < tw; tx++) {
      const sx0 = tx * s, sx1 = Math.min(img.w, (tx + 1) * s), sy0 = ty * s, sy1 = Math.min(img.h, (ty + 1) * s);
      let r = 0, g = 0, b = 0, a = 0, area = 0;
      for (let y = Math.floor(sy0); y < Math.ceil(sy1); y++) {
        const wy = Math.min(y + 1, sy1) - Math.max(y, sy0);
        for (let x = Math.floor(sx0); x < Math.ceil(sx1); x++) {
          const wx = Math.min(x + 1, sx1) - Math.max(x, sx0);
          const k = wx * wy, i = (y * img.w + x) * 4, al = img.rgba[i + 3] / 255;
          r += img.rgba[i] * al * k; g += img.rgba[i + 1] * al * k; b += img.rgba[i + 2] * al * k; a += al * k; area += k;
        }
      }
      row.push(a / area < 0.5 ? null : [r / a, g / a, b / a]);
    }
    out.push(row);
  }
  return out;
}

// ---------- 中央値分割で減色 ----------
function medianCut(colors, k) {
  let boxes = [colors];
  while (boxes.length < k) {
    let bi = -1, bestRange = 0, bestCh = 0;
    boxes.forEach((bx, i) => {
      if (bx.length < 2) return;
      for (let c = 0; c < 3; c++) {
        let lo = 255, hi = 0;
        for (const p of bx) { if (p[c] < lo) lo = p[c]; if (p[c] > hi) hi = p[c]; }
        if (hi - lo > bestRange) { bestRange = hi - lo; bi = i; bestCh = c; }
      }
    });
    if (bi < 0 || bestRange < 4) break;
    const bx = boxes[bi].sort((p, q) => p[bestCh] - q[bestCh]);
    const mid = bx.length >> 1;
    boxes.splice(bi, 1, bx.slice(0, mid), bx.slice(mid));
  }
  return boxes.map((bx) => {
    const m = [0, 0, 0];
    for (const p of bx) { m[0] += p[0]; m[1] += p[1]; m[2] += p[2]; }
    return m.map((v) => Math.round(v / bx.length));
  });
}

// ---------- 変換 ----------
const lum = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
const GLYPHS = "ABCDEFGHIJKLMNPQRSTUVWXYZabcdefghijklmnpqrstuvwxyz0123456789";
const hex = (c) => "#" + c.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("");
function convert(file, h) {
  const img = readPng(path.resolve(file));
  if (!img.hasAlpha && !opt.keepBg) removeBackground(img, opt.tol);
  const cropped = trim(img);
  const grid = downscale(cropped, h);
  const opaque = grid.flat().filter(Boolean);
  const pal = medianCut(opaque, opt.colors).sort((a, b) => lum(a) - lum(b));
  const nearest = (c) => {
    let bi = 0, bd = Infinity;
    pal.forEach((p, i) => { const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2; if (d < bd) { bd = d; bi = i; } });
    return bi;
  };
  const used = new Set();
  let art = grid.map((row) => row.map((c) => { if (!c) return "."; const i = nearest(c); used.add(i); return GLYPHS[i]; }).join(""));
  art = art.map((r) => r.replace(/\.+$/, "")); // 右側の透明は詰める (行長は不揃いでよい)
  const palette = {};
  pal.forEach((p, i) => { if (used.has(i)) palette[GLYPHS[i]] = hex(p); });
  return { palette, art };
}

// 魔物の辞書 (id の確認・層ボス/強敵の判定・一覧表示に使う)。bestiary.js は monart.js も読み込む
const { BESTIARY } = await import(pathToFileURL(path.join(ROOT, "src/dungeons/bestiary.js")).href);
const { ART_WANTED, MONSTER_ART } = await import(pathToFileURL(MONART).href + "?t=" + Date.now());
const bigMon = (id) => !!(BESTIARY[id] && (BESTIARY[id].boss || BESTIARY[id].elite));
const heightFor = (id) => opt.h || (bigMon(id) ? 120 : 96);
const kindOf = (m) => (m.boss ? "層ボス" : m.elite ? "強敵" : "通常");

// ---------- 一覧 ----------
if (opt.list) {
  const ids = ART_WANTED[opt.list];
  if (!ids) { console.error(`第${opt.list}層の原画待ち (ART_WANTED) は登録されていない`); process.exit(1); }
  let done = 0;
  console.log(`第${opt.list}層の原画待ち (${ids.length}体)  ※ 原画のファイル名は「<id>.png」にすると --dir でまとめて変換できる`);
  for (const id of ids) {
    const m = BESTIARY[id];
    const ok = !!MONSTER_ART[id];
    if (ok) done++;
    console.log(`  ${ok ? "済" : "未"}  ${id.padEnd(20)} ${kindOf(m).padEnd(3, "　")} rank${m.rank}  ${m.name}`);
  }
  console.log(`差し替え済み ${done} / ${ids.length}`);
  process.exit(0);
}

// ---------- 変換する組を決める ----------
const jobs = [];
if (opt.dir) {
  const dir = path.resolve(opt.dir);
  const files = fs.readdirSync(dir).filter((f) => /\.png$/i.test(f));
  const want = opt.layer ? new Set(ART_WANTED[opt.layer] || []) : null;
  if (opt.layer && !want.size) { console.error(`第${opt.layer}層の原画待ち (ART_WANTED) は登録されていない`); process.exit(1); }
  for (const f of files) {
    const id = f.replace(/\.png$/i, "");
    if (!BESTIARY[id]) { console.warn(`… ${f}: 魔物 id「${id}」は存在しないので飛ばす`); continue; }
    if (want && !want.has(id)) { console.warn(`… ${f}: 第${opt.layer}層の原画待ちではないので飛ばす`); continue; }
    jobs.push([id, path.join(dir, f)]);
  }
  if (!jobs.length) { console.error("変換できる原画 (<魔物id>.png) が見つからなかった"); process.exit(1); }
  if (want) {
    const missing = [...want].filter((id) => !jobs.some(([j]) => j === id) && !MONSTER_ART[id]);
    if (missing.length) console.log(`まだ原画のない魔物 (${missing.length}体): ${missing.join(", ")}`);
  }
} else {
  const [monId, srcPath] = pos;
  if (!BESTIARY[monId]) { console.error(`魔物 id「${monId}」は存在しない (図鑑の id を確かめてほしい)`); process.exit(1); }
  jobs.push([monId, srcPath]);
}

const results = {};
for (const [id, file] of jobs) {
  const a = convert(file, heightFor(id));
  const width = Math.max(...a.art.map((r) => r.length));
  console.log(`${id} (${BESTIARY[id].name}): ${width}×${a.art.length} ドット / ${Object.keys(a.palette).length} 色`);
  if (opt.preview) for (const r of a.art) console.log(r.padEnd(width, ".").replace(/\./g, " "));
  results[id] = a;
}

if (opt.dry) process.exit(0);

// ---------- monart.js の登録欄を書き直す ----------
const all = { ...MONSTER_ART, ...results };
const body = Object.keys(all).sort().map((id) => {
  const a = all[id];
  return `  ${JSON.stringify(id)}: {\n    palette: ${JSON.stringify(a.palette)},\n    art: [\n${a.art.map((r) => "      " + JSON.stringify(r) + ",").join("\n")}\n    ],\n  },`;
}).join("\n");
const src = fs.readFileSync(MONART, "utf8");
const re = /\/\/ <<MONSTER_ART>>[\s\S]*?\/\/ <<\/MONSTER_ART>>/;
if (!re.test(src)) throw new Error("monart.js の登録欄 (<<MONSTER_ART>>) が見つからない");
fs.writeFileSync(MONART, src.replace(re, `// <<MONSTER_ART>>\nexport const MONSTER_ART = {\n${body}\n};\n// <</MONSTER_ART>>`));
console.log(`src/dungeons/monart.js に ${Object.keys(results).length} 体を書き込んだ (sw.js の CACHE を上げるのを忘れずに)`);
