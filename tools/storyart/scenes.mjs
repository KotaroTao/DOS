// 物語の場面の置き場所と本文 (ストーリー一覧の書き下ろし + ゲーム内の台詞) を引く。prompt.mjs・review.mjs が使う。
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ARCHIVE_STORIES } from "../../src/archive-stories.js";
import { STORY_CELLS, REPORTS, BOSS_MEMORIES, IRENE_BEATS, CHAPTER_END, MINE_PASS } from "../../src/story.js";
import { DUNGEON_LORE } from "../../src/journal.js";
import { WORLD } from "../../src/dungeons/world.js";
import { PROLOGUE } from "./register.mjs";

export const ROOT = fileURLToPath(new URL("../../", import.meta.url));
export const exists = (p) => existsSync(ROOT + p);
export const SCENES = ARCHIVE_STORIES;
export const sceneById = (id) => ARCHIVE_STORIES.find((s) => s.id === id) || null;
const prologueName = (id) => (Object.entries(PROLOGUE).find(([, v]) => v === id) || [])[0];

// 原画 (PNG) と出荷 (WebP) の置き場所。章 0 = 序章
export function scenePaths(id) {
  if (id.startsWith("lore_")) return { master: `art/story-review/dungeons/${id}.png`, shipped: `art/story/dungeons/${id}.webp` };
  const s = sceneById(id);
  if (!s) return null;
  if (s.chapter === 0) {
    const name = prologueName(id) || id;
    return { master: `art/story-review/prologue/${name}.png`, shipped: `art/story/${name}.webp` };
  }
  return { master: `art/story-review/chapter${s.chapter}/${id}.png`, shipped: `art/story/chapter${s.chapter}/${id}.webp` };
}

// ゲーム内の台詞 (分岐する台詞は、手がかりを見つけた側で読む)
const ALL = new Proxy({}, { get: () => () => true });
const linesOf = (x) => (typeof x?.lines === "function" ? x.lines(ALL) : x?.lines) || [];
export function gameText(id) {
  let src = null;
  if (STORY_CELLS[id]) src = { where: "師の手がかり STORY_CELLS." + id, ...STORY_CELLS[id] };
  else if (id.startsWith("report_") && REPORTS[id.slice(7)]) src = { where: "王への報告 REPORTS." + id.slice(7), ...REPORTS[id.slice(7)] };
  else if (id.startsWith("mem_") && BOSS_MEMORIES[id.slice(4)]) src = { where: "主の記憶 BOSS_MEMORIES." + id.slice(4), ...BOSS_MEMORIES[id.slice(4)] };
  else if (/^ch\d+_end$/.test(id) && CHAPTER_END[+id.slice(2, -4)]) src = { where: "章の結び CHAPTER_END[" + id.slice(2, -4) + "]", ...CHAPTER_END[+id.slice(2, -4)] };
  else if (id === "minePass") src = { where: "坑口の通行証 MINE_PASS", ...MINE_PASS };
  else { const b = IRENE_BEATS.find((x) => x.id === id); if (b) src = { where: "館の語り IRENE_BEATS." + id, ...b }; }
  return src ? { where: src.where, title: src.title || "", lines: linesOf(src) } : null;
}

export function archiveText(id) {
  if (id.startsWith("lore_")) {
    const d = WORLD.find((w) => w.id === id.slice(5)), lore = DUNGEON_LORE[id.slice(5)];
    return d ? { title: d.name, chapter: null, lines: [d.about, ...(lore?.lines || [])].filter(Boolean) } : null;
  }
  const s = sceneById(id);
  return s ? { title: s.title, chapter: s.chapter, lines: s.lines } : null;
}
