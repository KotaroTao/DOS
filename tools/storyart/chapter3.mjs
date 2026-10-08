import { mkdir, readFile, copyFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { ARCHIVE_STORIES } from "../../src/archive-stories.js";

const root = new URL("../../", import.meta.url);
const review = new URL("art/story-review/chapter3/", root);
const production = new URL("art/story/chapter3/", root);
await mkdir(review, { recursive: true });
await mkdir(production, { recursive: true });
const manifest = JSON.parse(await readFile(new URL("manifest.json", review), "utf8"));
for (const entry of manifest.images) {
  await copyFile(entry.source, new URL(entry.file, review));
  await copyFile(entry.source, new URL(entry.file, production));
}

// 正本の本文と画像を並べ、未制作の場面にはゲームと同じ図版を表示する。
const escape = value => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const stories = [...ARCHIVE_STORIES].sort((a, b) => a.chapter - b.chapter);
const cards = stories.map(s => `<article id="${escape(s.id)}" data-chapter="${s.chapter}">
  <h2>${escape(s.title)}</h2><div class="scene">
  <figure>${s.image ? `<a href="../../../${escape(s.image)}"><img src="../../../${escape(s.image)}" width="1536" height="1024" alt="${escape(s.title)}" loading="lazy"></a>` : `<div class="fallback" data-scene="${escape(s.id)}"></div>`}<figcaption>${escape(s.group)} · ${escape(s.id)}</figcaption></figure>
  <div>${s.lines.map(line => `<p>${escape(line)}</p>`).join("")}</div></div></article>`).join("\n");
const html = `<!doctype html>
<html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>DOS ストーリー原画・本文一覧</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#131416;color:#e9e6e1;font-family:system-ui,sans-serif;line-height:1.85;letter-spacing:0}
header,main{max-width:1240px;margin:auto;padding:24px}header{border-bottom:1px solid #45474b}h1{font-size:24px;margin:0 0 16px}h2{font-size:20px;margin:0 0 16px}nav{display:flex;flex-wrap:wrap;gap:12px}nav a{color:#a8d8da;padding:4px 0}article{padding:28px 0;border-bottom:1px solid #45474b;scroll-margin-top:20px}.scene{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:28px}figure{margin:0}img,canvas{display:block;width:100%;height:auto}figcaption{font-size:13px;color:#bdbab5;margin-top:8px}p{margin:0 0 14px}a{color:#a8d8da}[hidden]{display:none!important}label{display:block;margin-top:16px}select{font:inherit;color:inherit;background:#25272a;border:1px solid #62656a;padding:4px 12px;max-width:100%}@media(max-width:760px){header,main{padding:16px}.scene{grid-template-columns:minmax(0,1fr);gap:16px}}
</style>
<header><h1>DOS ストーリー原画・本文一覧</h1><nav>${[0,1,2,3].map(ch => `<a href="#${stories.find(s => s.chapter === ch).id}">${escape(stories.find(s => s.chapter === ch).group)}</a>`).join("")}</nav>
<label>章 <select id="chapter"><option value="all">全${stories.length}場面</option>${[0,1,2,3].map(ch => `<option value="${ch}" ${ch===3 ? "selected" : ""}>${escape(stories.find(s => s.chapter === ch).group)}</option>`).join("")}</select></label></header>
<main>${cards}</main>
<script type="module">
import { ARCHIVE_STORIES } from "../../../src/archive-stories.js";
import { archiveArt } from "../../../src/archive-art.js";
for (const box of document.querySelectorAll("[data-scene]")) {
  const story = ARCHIVE_STORIES.find(s => s.id === box.dataset.scene);
  const canvas = archiveArt(story.illustration);
  if (canvas) { canvas.setAttribute("aria-label", story.title); box.append(canvas); }
}
const select = document.querySelector("#chapter");
function filter() { for (const article of document.querySelectorAll("article")) article.hidden = select.value !== "all" && article.dataset.chapter !== select.value; }
select.addEventListener("change", filter);
for (const link of document.querySelectorAll("nav a")) link.addEventListener("click", () => { select.value = document.querySelector(link.getAttribute("href")).dataset.chapter; filter(); });
filter();
</script></html>`;
await writeFile(new URL("index.html", review), html);
console.log(`第三章の原画${manifest.images.length}枚を反映。一覧: ${fileURLToPath(new URL("index.html", review))}`);
