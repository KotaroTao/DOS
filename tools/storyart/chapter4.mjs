import assert from "node:assert/strict";
import { mkdir, readFile, copyFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { ARCHIVE_STORIES } from "../../src/archive-stories.js";

const root = new URL("../../", import.meta.url);
const review = new URL("art/story-review/chapter4/", root);
const production = new URL("art/story/chapter4/", root);
const manifest = JSON.parse(await readFile(new URL("manifest.json", review), "utf8"));
const stories = ARCHIVE_STORIES.filter(s => s.chapter === 4);
assert.deepEqual(manifest.images.map(s => s.id), stories.map(s => s.id));
await mkdir(production, { recursive: true });
for (const entry of manifest.images) {
  const saved = new URL(entry.file, review);
  // 生成元がない別の環境でも、保存済み原画から一覧を再作成できる。
  try {
    await copyFile(entry.source, saved);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    await readFile(saved);
  }
  const png = await readFile(saved);
  assert.equal(png.readUInt32BE(16), entry.width);
  assert.equal(png.readUInt32BE(20), entry.height);
  await copyFile(saved, new URL(entry.file, production));
}
const escape = value => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const scenes = stories.map(s => ({ id:s.id, title:s.title, group:s.group, image:s.image, lines:s.lines }));
await writeFile(new URL("scenes.json", review), JSON.stringify(scenes, null, 2) + "\n");
const articles = stories.map(s => `<article id="${escape(s.id)}">
  <h2>${escape(s.title)}</h2><div class="scene">
  <figure><a href="${escape(s.id)}.png"><img src="${escape(s.id)}.png" width="1536" height="1024" alt="${escape(s.title)}の場面" loading="lazy"></a><figcaption>${escape(s.id)}</figcaption></figure>
  <div>${s.lines.map(line => `<p>${escape(line)}</p>`).join("")}</div></div></article>`).join("\n");
const html = `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>DOS 第四章「王都の地下」原画・本文一覧</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#131416;color:#e9e6e1;font-family:system-ui,sans-serif;line-height:1.85;letter-spacing:0}
header,main{max-width:1240px;margin:auto;padding:24px}header{border-bottom:1px solid #45474b}h1{font-size:24px;margin:0 0 16px}h2{font-size:20px;margin:0 0 16px}nav{display:flex;flex-wrap:wrap;gap:8px 20px}nav a{color:#a8d8da}article{padding:28px 0;border-bottom:1px solid #45474b;scroll-margin-top:20px}.scene{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:28px}figure{margin:0}img{display:block;width:100%;height:auto;aspect-ratio:3/2}figcaption{font-size:13px;color:#bdbab5;margin-top:8px}p{margin:0 0 14px}a{color:#a8d8da}@media(max-width:760px){header,main{padding:16px}.scene{grid-template-columns:minmax(0,1fr);gap:16px}}
</style></head>
<body><header><h1>第四章「王都の地下」</h1><nav>${stories.map(s => `<a href="#${escape(s.id)}">${escape(s.title)}</a>`).join("")}</nav></header>
<main>${articles}</main></body></html>`;
await writeFile(new URL("index.html", review), html);
console.log(`第四章の原画${manifest.images.length}枚を反映。一覧: ${fileURLToPath(new URL("index.html", review))}`);
