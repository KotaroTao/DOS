// 物語の絵の確認ページと進み具合を書き出す (build.py が呼ぶ。手で回してもよい)。
//
//   node tools/storyart/review.mjs            art/story-review/review/status.md と全章の chapterN.md・dungeons.md
//   node tools/storyart/review.mjs 5 dungeons 指定した章・由来だけ (status.md はいつも書き直す)
//
// chapterN.md は GitHub でそのまま絵が見える確認ページ: 場面ごとに出荷する絵 (無ければ原画)・状態・本文 (一覧とゲーム内)・指示。
// ユーザーは PR からこのページを開いて、絵と本文を見比べて承認する。手で直さない (書き出し直すと消える)。
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { readBrief, fixFor } from "./brief.mjs";
import { ROOT, exists, SCENES, scenePaths, gameText, archiveText } from "./scenes.mjs";
import { WORLD } from "../../src/dungeons/world.js";
import { CHAPTERS } from "../../src/story.js";

const OUT = "art/story-review/review";
const brief = readBrief();
const hold = new Set(JSON.parse(readFileSync(ROOT + "tools/storyart/hold.json", "utf8")).hold);
const CH = (n) => (n === 0 ? "序章" : `第${n}章` + ((CHAPTERS.find((c) => c.no === n) || {}).title ? `「${CHAPTERS.find((c) => c.no === n).title}」` : ""));

function stateOf(id) {
  const p = scenePaths(id);
  const key = p.master.slice("art/story-review/".length, -4);
  const fixes = fixFor(brief, p.master);
  if (hold.has(key)) return { label: "保留 (直し待ち)", p, fixes };
  if (exists(p.shipped)) return { label: fixes.some((f) => !f.optional) ? "出荷済み・修正待ち" : fixes.length ? "出荷済み (任意の修正あり)" : "出荷済み", p, fixes };
  if (exists(p.master)) return { label: "原画のみ (未変換)", p, fixes };
  return { label: brief.scenes[id] ? "未着手 (指示あり)" : "未着手", p, fixes };
}
const rel = (p) => "../../../" + p; // art/story-review/review/ から
const quote = (lines) => lines.map((l) => "> " + l.replace(/\n/g, " ")).join("\n>\n");

function scenePage(ids, heading, small) {
  const parts = [`# ${heading}`, "", "書き出し: `node tools/storyart/review.mjs` (手で直さない)。絵は出荷する WebP、まだ無ければ原画。",
    exists(`${OUT}/${small}`) ? `ゲームで小さく出た時の見え方 (384×256): [${small}](${small})` : "", ""];
  for (const id of ids) {
    const { label, p, fixes } = stateOf(id);
    const a = archiveText(id), g = gameText(id), sp = brief.scenes[id];
    const img = exists(p.shipped) ? p.shipped : exists(p.master) ? p.master : null;
    parts.push(`<a name="${id}"></a>`, "", `## ${id}「${a?.title || ""}」 ── ${label}`, "");
    parts.push(img ? `<img src="${rel(img)}" width="576" alt="${id}">` : "_(絵はまだ無い)_", "");
    if (a) parts.push("**ストーリー一覧の本文**", "", quote(a.lines), "");
    if (g) parts.push(`**ゲーム内 (${g.where})**`, "", quote(g.lines), "");
    if (sp) parts.push("**指示書 (4章)**", "", ...sp.notes.map((n) => "- " + n), "");
    for (const f of fixes) parts.push(`**修正 ${f.key === "B" ? "(任意)" : f.key}**`, "", ...f.notes.map((n) => "- " + n), "");
  }
  return parts.join("\n") + "\n";
}

export function writeReview(only = null) {
  mkdirSync(ROOT + OUT, { recursive: true });
  const chapters = [...new Set(SCENES.map((s) => s.chapter))].sort((a, b) => a - b);
  const want = (k) => !only || only.includes(String(k));
  const written = [];
  for (const n of chapters) {
    if (!want(n)) continue;
    const ids = SCENES.filter((s) => s.chapter === n).map((s) => s.id);
    writeFileSync(ROOT + `${OUT}/chapter${n}.md`, scenePage(ids, `${CH(n)} の絵`, `chapter${n}-small.jpg`));
    written.push(`${OUT}/chapter${n}.md`);
  }
  if (want("dungeons")) {
    const ids = WORLD.map((d) => "lore_" + d.id);
    writeFileSync(ROOT + `${OUT}/dungeons.md`, scenePage(ids, "踏破した迷宮の由来の絵", "dungeons-small.jpg"));
    written.push(`${OUT}/dungeons.md`);
  }
  // 進み具合 (全体)
  const rows = ["# 物語の絵の進み具合", "", "書き出し: `node tools/storyart/review.mjs` (build.py も書き直す。手で直さない)。", "",
    "| 章 | 場面 | 題 | 状態 | 確認ページ |", "|---|---|---|---|---|"];
  const tally = {};
  for (const s of SCENES) {
    const { label } = stateOf(s.id);
    tally[label] = (tally[label] || 0) + 1;
    rows.push(`| ${CH(s.chapter)} | \`${s.id}\` | ${s.title} | ${label} | [見る](chapter${s.chapter}.md#${s.id}) |`);
  }
  rows.push("", "| 由来 | 迷宮 | 名前 | 状態 | |", "|---|---|---|---|---|");
  for (const d of WORLD) {
    const { label } = stateOf("lore_" + d.id);
    rows.push(`| 由来 | \`${d.id}\` | ${d.name} | ${label === "未着手" ? "未着手 (情景・手がかりの絵で代用)" : label} | [見る](dungeons.md#lore_${d.id}) |`);
  }
  rows.splice(4, 0, "場面: " + Object.entries(tally).map(([k, v]) => `${k} ${v}`).join(" ・ "), "");
  writeFileSync(ROOT + `${OUT}/status.md`, rows.join("\n") + "\n");
  written.push(`${OUT}/status.md`);
  return written;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const only = process.argv.slice(2);
  for (const f of writeReview(only.length ? only : null)) console.log(f);
}
