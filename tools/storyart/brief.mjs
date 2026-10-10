// 指示書 docs/art/codex-story-art-brief.md を読み、絵ごとの指示を取り出す (prompt.mjs・review.mjs・検査が使う)。
// 指示の正本は指示書の Markdown。ここは書式を読むだけで、指示を二重に持たない。
//   新しい場面 (4章):  **<場面ID>「題」** (種類) → 箇条書き → ```text 英語の指示 ```
//   修正 (3章 A):      **A-n. … 「題」** `原画のパス` … → 箇条書き → ```text ...except: … ```
//   修正 (3章 B):      | 場面 `原画のパス` | 直すこと |
//   (直し終えた修正は、見出し・行の末尾に「(済)」)
//   基準シート (2-4):  | 名前.png | 中身 | 元にする絵 |
//   由来 (5章):        | 優先 | <迷宮ID> 名前 | 描く中身 |
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PROLOGUE } from "./register.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
export const BRIEF = "docs/art/codex-story-art-brief.md";

// 直し終えた修正の項目には、見出し (A) か行 (B) の末尾に「(済)」を付ける
const DONE = /[(（]済[)）]/;
const block = (lines, i) => { // i 行目から最初の ```text ... ``` の中身と、終わりの行
  for (let j = i; j < lines.length; j++) {
    if (/^\*\*|^#{2,3} /.test(lines[j]) && j > i) return null;
    if (lines[j].trim() === "```text") {
      const k = lines.indexOf("```", j + 1);
      return { text: lines.slice(j + 1, k).join("\n").trim(), end: k };
    }
  }
  return null;
};
const bullets = (lines, i) => {
  const out = [];
  for (let j = i + 1; j < lines.length && !/^\*\*|^#{2,3} |^```/.test(lines[j]); j++) if (/^- /.test(lines[j])) out.push(lines[j].slice(2));
  return out;
};
const ticks = (s) => [...s.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
// `art/story-review/chapter2/a.png`・`b.png` の b.png は直前のパスのフォルダにある
const masterPaths = (s) => {
  let dir = "";
  return ticks(s).filter((p) => p.endsWith(".png")).map((p) => {
    if (p.includes("/")) { dir = p.slice(0, p.lastIndexOf("/") + 1); return p; }
    return dir + p;
  }).filter((p) => p.startsWith("art/story-review/"));
};
const section = (lines, head) => { // "## n." / "### n-n." の見出しから次の同格以上の見出しまで
  const a = lines.findIndex((l) => l.startsWith(head));
  if (a < 0) return [a, a];
  const lv = head.match(/^#+/)[0].length;
  let b = lines.findIndex((l, j) => j > a && /^#+ /.test(l) && l.match(/^#+/)[0].length <= lv);
  return [a, b < 0 ? lines.length : b];
};

export function readBrief(src = readFileSync(ROOT + BRIEF, "utf8")) {
  const L = src.split("\n");
  const textIn = (head) => { const [a] = section(L, head); return a < 0 ? null : block(L, a + 1)?.text; };
  const brief = {
    style: textIn("### 1-1."),              // 全便共通の前置き
    sheet: textIn("### 2-4."),              // 基準シートの前置き
    fixLead: (L.join("\n").match(/`(Edit the attached illustration\.[^`]+)`/) || [])[1] || "",
    scenes: {}, fixes: [], sheets: {}, lore: {},
  };
  // 4章: 新しい場面
  {
    const [a, b] = section(L, "## 4.");
    let chapter = null;
    for (let i = a; i < b; i++) {
      const ch = L[i].match(/^### 第(.)章/);
      if (ch) chapter = "一二三四五六七八九".indexOf(ch[1]) + 1 || null;
      const m = L[i].match(/^\*\*([a-z][a-z0-9_]*)「(.+?)」\*\*\s*\((.+?)\)/i);
      if (!m) continue;
      const t = block(L, i + 1);
      brief.scenes[m[1]] = { id: m[1], title: m[2], kind: m[3], chapter, notes: bullets(L, i), prompt: t?.text || "" };
    }
  }
  // 3章: 修正 (A は英語の指示つき、B は表)
  {
    const [a, b] = section(L, "## 3.");
    for (let i = a; i < b; i++) {
      const m = L[i].match(/^\*\*(A-\d+)\.\s*(.+?)\*\*(.*)$/);
      if (m) {
        const t = block(L, i + 1);
        brief.fixes.push({ key: m[1], title: m[2], masters: masterPaths(m[3]),
          notes: bullets(L, i), prompt: (t?.text || "").replace(/^\.\.\.\s*/, ""), optional: false, done: DONE.test(L[i]) });
        continue;
      }
      // 「序章 arrival `…png`」「第三章 report_w12」「踏破後 lore_w01」 (パスが無ければ置き場所の決まりで補う)
      const row = L[i].match(/^\|\s*(序章|第(.)章|踏破後)\s+([a-z][a-z0-9_]*)(.*?)\|\s*(.+?)\s*\|\s*$/i);
      if (row) {
        const n = "一二三四五六七八九".indexOf(row[2]) + 1;
        const given = masterPaths(row[4]);
        const prologue = Object.entries(PROLOGUE).find(([, id]) => id === row[3]);
        const guess = row[1] === "序章" ? (prologue ? `art/story-review/prologue/${prologue[0]}.png` : null)
          : row[1] === "踏破後" ? `art/story-review/dungeons/${row[3]}.png` : `art/story-review/chapter${n}/${row[3]}.png`;
        brief.fixes.push({ key: "B", title: `${row[1]} ${row[3]}`, masters: given.length ? given : [guess].filter(Boolean),
          notes: [row[5]], prompt: "", optional: true, done: DONE.test(L[i]) });
      }
    }
  }
  // 2-4: 基準シート
  {
    const [a, b] = section(L, "### 2-4.");
    for (let i = a; i < b; i++) {
      const row = L[i].match(/^\|\s*([a-z-]+)\.png\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*$/);
      if (row) brief.sheets[row[1]] = { name: row[1], file: `docs/art/story-refs/${row[1]}.png`, content: row[2],
        sources: ticks(row[3]).filter((p) => /\.png$/.test(p)), after: /承認後/.test(row[3]) ? row[3].replace(/\s*\(承認後\)/, "") : null };
    }
  }
  // 5章: 由来の絵
  {
    const [a, b] = section(L, "## 5.");
    for (let i = a; i < b; i++) {
      const row = L[i].match(/^\|\s*(\d)\s*\|\s*(w[s]?\d+)\s+(.+?)\s*\|\s*(.+?)\s*\|\s*$/);
      if (row) brief.lore[row[2]] = { id: row[2], name: row[3], priority: +row[1], content: row[4] };
    }
  }
  return brief;
}

// 修正の項目を、原画のパスから引く
export const fixFor = (brief, master, { all = false } = {}) => brief.fixes.filter((f) => f.masters.includes(master) && (all || !f.done));
