// 物語の絵1枚ぶんの「制作の依頼」を組み立てる (Codex は描く前に必ずこれを回し、出力どおりに作る)。
//
//   node tools/storyart/prompt.mjs <場面ID>          新しい場面 / 修正 (出荷済みで修正の項目があれば修正)
//   node tools/storyart/prompt.mjs lore_<迷宮ID>     踏破した迷宮の由来の絵
//   node tools/storyart/prompt.mjs ref:<シート名>     人物・小道具の基準シート (便0)
//   node tools/storyart/prompt.mjs --chapter 5       その章で絵が要る場面をまとめて (--out で art/story-review/review/prompts-chapter5.md へ)
//   node tools/storyart/prompt.mjs --check           指示書と本文の食い違いを調べる (CI も回す)
//
// 出力: 保存先・参照画像 (渡す順)・本文 (一覧とゲーム内)・描くもの/描かないもの・画像生成にそのまま貼る英語の指示。
// 指示の正本は docs/art/codex-story-art-brief.md (読み取りは brief.mjs)。ここで指示を書き足さない。
import { writeFileSync, mkdirSync } from "node:fs";
import { readBrief, fixFor } from "./brief.mjs";
import { ROOT, exists, SCENES, sceneById, scenePaths, gameText, archiveText } from "./scenes.mjs";
import { WORLD } from "../../src/dungeons/world.js";

const brief = readBrief();
const SERA_REF = "docs/art/sera/sera-r1-final.png";
const THRONE = "art/story-review/chapter3/report_w12.png";
const MANSION = ["art/story-review/chapter2/irene_roots.png", "art/story-review/chapter1/irene_familiar.png"];

// 英語の指示に出てくる人物・小道具 → 基準シート (2-4)
const CAST = [
  ["ordo", /\bordo\b/i],
  ["apprentice", /\bapprentice\b/i],
  ["irene", /\birene\b/i],
  ["sera", /\bsera\b/i],
  ["king", /(?<!priest-|frost |the frost )\bking\b/i],
  ["morden", /\bchancellor|\bmorden\b/i],
  ["morden-chest", /door in his own chest|chest door.*(morden|chancellor)|(morden|chancellor).*chest door/i],
  ["dolls", /party dolls?|warrior doll|blank (smooth )?round (wooden )?heads?/i],
  ["ancients", /\bisaak\b|frost king|throne of ice|first soul-binder|the founder|old doll-maker/i],
  ["props", /white candle|candlestick|lantern|palm-up|palm-and-flame|lamp-on-palm|goblet/i],
];
// シートができていればシート、まだなら指示書の「元にする絵」(承認後のシートを元にするものは、その元へたどる)
function sheetRefs(name, seen = new Set()) {
  const sh = brief.sheets[name];
  if (!sh || seen.has(name)) return [];
  seen.add(name);
  if (exists(sh.file)) return [sh.file];
  if (sh.after) return sheetRefs(sh.after.replace(/\.png$/, ""), seen);
  return sh.sources;
}

function refsFor({ text, kind = "", id = "", chapter = 0, master = null }) {
  const out = [], note = [];
  const add = (p, why) => { if (p && !out.some((r) => r.path === p)) out.push({ path: p, why, ok: exists(p) }); };
  if (master) add(master, "直す元の絵 (いちばん先に渡す)");
  // 「No apprentice in this memory.」のような打ち消しの文は数えない
  text = text.replace(/[^.]*\b(no|without|not)\b[^.]*\b(apprentice|party|dolls?|sera|irene|ordo|king|chancellor|morden)\b[^.]*\./gi, "");
  for (const [name, re] of CAST) {
    if (!re.test(text)) continue;
    if (name === "ordo" && chapter >= 5) for (const p of sheetRefs("ordo-states")) add(p, "師オルドの章ごとの姿");
    const refs = sheetRefs(name);
    if (!refs.length) note.push(`基準シート ${name}.png はまだ無く、元にする絵もない (正典の文だけで描く)`);
    for (const p of refs) add(p, `基準: ${name}`);
    if (name === "sera") add(SERA_REF, "セラの原画 (必ず)");
  }
  if (/報告/.test(kind) || id.startsWith("report_")) add(THRONE, "玉座の間の造り");
  if (/館の語り/.test(kind) || /mansion/i.test(text)) for (const p of MANSION) add(p, "館の造り");
  return { refs: out, note };
}

const quote = (lines) => lines.map((l) => "> " + l).join("\n");
const save = (master, shipped) => [
  `- 原画 (PNG・1536×1024): \`${master}\``,
  `- 出荷 (WebP): \`${shipped}\` ← 自分で作らない。\`python3 tools/storyart/build.py\` が作って登録する`,
].join("\n");
const refList = ({ refs, note }) => [
  ...refs.map((r, i) => `${i + 1}. \`${r.path}\` — ${r.why}${r.ok ? "" : " **(見つからない)**"}`),
  ...note.map((n) => `- ※ ${n}`),
].join("\n") || "- (なし)";

function texts(id) {
  const a = archiveText(id), g = gameText(id);
  return [
    a ? `### 本文 (ストーリー一覧)\n${quote(a.lines)}` : "",
    g ? `### 本文 (ゲーム内・${g.where})\n${quote(g.lines)}` : "",
  ].filter(Boolean).join("\n\n");
}

export function promptFor(id, { fix = null } = {}) {
  if (id.startsWith("ref:")) {
    const sh = brief.sheets[id.slice(4)];
    if (!sh) throw new Error(`基準シート ${id.slice(4)} は指示書 2-4 に無い`);
    const r = refsFor({ text: "" });
    for (const p of sh.sources) r.refs.push({ path: p, why: "元にする絵", ok: exists(p) });
    return [`# 基準シート ${sh.name}.png (便0)`, `## 保存先\n- \`${sh.file}\` (出荷しない・登録しない)`,
      `## 参照画像\n${refList(r)}`, `## 中身\n${sh.content}`,
      "## 画像生成に貼る英語の指示\n```text\n" + [brief.style, brief.sheet, "(Then describe the subject in English from 2-1 / 2-2 of the brief.)"].join("\n") + "\n```"].join("\n\n");
  }
  const p = scenePaths(id);
  if (!p) throw new Error(`場面「${id}」は src/archive-stories.js にも迷宮の由来にも無い`);
  const s = sceneById(id), chapter = s?.chapter ?? 0;
  const shipped = exists(p.shipped);
  const fixes = fix ?? (shipped ? fixFor(brief, p.master) : []);
  const head = `# ${id}「${archiveText(id)?.title || ""}」 ${chapter ? `第${chapter}章` : id.startsWith("lore_") ? "踏破した迷宮の由来" : "序章"}`;
  if (fixes.length) { // 修正
    const f = fixes[0];
    const en = f.prompt ? `${brief.fixLead} ${f.prompt}` : null;
    const r = refsFor({ text: f.prompt || f.notes.join(" "), kind: s?.title, id, chapter, master: p.master });
    return [head + ` ── 修正 (${f.key === "B" ? "任意" : f.key})`, `## 保存先 (同じ名前で上書き)\n${save(p.master, p.shipped)}`,
      `## 参照画像 (この順に渡す)\n${refList(r)}`, texts(id), `## 直すこと (指示書 3章)\n${f.notes.map((n) => "- " + n).join("\n")}`,
      en ? "## 画像生成に貼る英語の指示\n```text\n" + [brief.style, en].join("\n") + "\n```"
        : "## 英語の指示\n指示書に英語の指示が無い (任意の修正)。上の「直すこと」を英語にして、次の前置きの後に書く:\n```text\n" + [brief.style, brief.fixLead].join("\n") + "\n```"].join("\n\n");
  }
  if (id.startsWith("lore_")) {
    const d = WORLD.find((w) => w.id === id.slice(5)), row = brief.lore[id.slice(5)];
    const r = refsFor({ text: row?.content || "", id });
    return [head, `## 保存先\n${save(p.master, p.shipped)}`, `## 参照画像\n${refList(r)}`, texts(id),
      `## 描く中身 (指示書 5章)\n- ${row ? row.content : "指示書の表に無い。本文の3段落を一枚にする"}\n- 掟: ${d?.trait?.name || "なし"}\n- その迷宮の章より先の秘密を描かない。人物は入れなくてよい`,
      "## 英語の指示\n上の中身を英語にして、次の前置きの後に書く:\n```text\n" + brief.style + "\n```"].join("\n\n");
  }
  const sp = brief.scenes[id];
  if (!sp) return [head, shipped ? "出荷済み。直す項目は指示書に無い。" : "**指示書 4章にこの場面の指示が無い** (Claude に指示を足してもらう)", texts(id)].join("\n\n");
  const r = refsFor({ text: sp.prompt, kind: sp.kind, id, chapter });
  return [head + ` ── 新規 (${sp.kind})`, `## 保存先\n${save(p.master, p.shipped)}`, `## 参照画像 (この順に渡す)\n${refList(r)}`,
    texts(id), `## 描くもの・描かないもの (指示書 4章)\n${sp.notes.map((n) => "- " + n).join("\n")}`,
    "## 画像生成に貼る英語の指示\n```text\n" + [brief.style, sp.prompt].join("\n") + "\n```"].join("\n\n");
}

// 絵が要る場面 (出荷済みで修正の項目も無いものは除く)
export function pending(chapter) {
  return SCENES.filter((s) => s.chapter === chapter).map((s) => s.id).filter((id) => {
    const p = scenePaths(id);
    return !exists(p.shipped) || fixFor(brief, p.master).some((f) => !f.optional);
  });
}

// 指示書と本文・置き場所の食い違い
export function briefProblems() {
  const out = [];
  for (const s of SCENES) {
    const p = scenePaths(s.id);
    if (!exists(p.shipped) && !brief.scenes[s.id]) out.push(`場面「${s.id}」(第${s.chapter}章) に絵も指示も無い — 指示書 4章に指示を足す`);
  }
  for (const [id, sp] of Object.entries(brief.scenes)) {
    const s = sceneById(id);
    if (!s) out.push(`指示書 4章の「${id}」は archive-stories.js の場面に無い`);
    else if (sp.chapter && sp.chapter !== s.chapter) out.push(`指示書 4章の「${id}」は第${sp.chapter}章の節にあるが、場面は第${s.chapter}章`);
    if (!sp.prompt) out.push(`指示書 4章の「${id}」に英語の指示 (\`\`\`text) が無い`);
  }
  for (const f of brief.fixes) {
    if (!f.masters.length) out.push(`指示書 3章 ${f.key}「${f.title}」に原画のパスが無い`);
    for (const m of f.masters) if (!exists(m)) out.push(`指示書 3章 ${f.key} の原画 ${m} が無い`);
  }
  for (const sh of Object.values(brief.sheets)) for (const p of sh.sources) if (!exists(p)) out.push(`指示書 2-4 ${sh.name} の元にする絵 ${p} が無い`);
  for (const id of Object.keys(brief.lore)) if (!WORLD.some((w) => w.id === id)) out.push(`指示書 5章の迷宮「${id}」は world.js に無い`);
  if (!brief.style) out.push("指示書 1-1 の前置き (```text) が読めない");
  return out;
}

const args = process.argv.slice(2);
if (import.meta.url === `file://${process.argv[1]}`) {
  if (args[0] === "--check") {
    const bad = briefProblems();
    for (const b of bad) console.error("✗ " + b);
    if (bad.length) process.exit(1);
    console.log(`指示書と本文は一致 (新規 ${Object.keys(brief.scenes).length}・修正 ${brief.fixes.length}・基準シート ${Object.keys(brief.sheets).length})`);
  } else if (args[0] === "--chapter") {
    const n = +args[1], ids = pending(n);
    const md = [`# 第${n}章で絵が要る場面 (${ids.length})`, ...ids.map((id) => promptFor(id))].join("\n\n---\n\n") + "\n";
    if (args.includes("--out")) {
      mkdirSync(ROOT + "art/story-review/review", { recursive: true });
      writeFileSync(ROOT + `art/story-review/review/prompts-chapter${n}.md`, md);
      console.log(`art/story-review/review/prompts-chapter${n}.md (${ids.length}場面)`);
    } else process.stdout.write(md);
  } else if (args.length) {
    const fix = args.includes("--new") ? [] : null;
    for (const id of args.filter((a) => !a.startsWith("--"))) process.stdout.write(promptFor(id, { fix }) + "\n\n");
  } else {
    console.log("使い方: node tools/storyart/prompt.mjs <場面ID> | lore_<迷宮ID> | ref:<シート名> | --chapter N [--out] | --check");
  }
}
