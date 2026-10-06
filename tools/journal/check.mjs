// 読み物の解放・章順・参照元からの独立・通常の進行状態の保全を確認する。
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { ARCHIVE_STORIES } from "../../src/archive-stories.js";
import { ARCHIVE_FOCUS } from "../../src/archive-art.js";
import { storyEntries } from "../../src/journal.js";
import { WORLD } from "../../src/dungeons/world.js";
import { STORY_CELLS, REPORTS, BOSS_MEMORIES, IRENE_BEATS, CHAPTER_END } from "../../src/story.js";

const sw = readFileSync(new URL("../../sw.js", import.meta.url), "utf8");
for (const s of ARCHIVE_STORIES.filter(s => s.image)) {
  assert(existsSync(new URL("../../" + s.image, import.meta.url)), `${s.id} の承認済み画像`);
  assert(sw.includes('"./' + s.image + '"'), `${s.id} のオフライン登録`);
  assert.equal(s.imageWidth / s.imageHeight, 1.5);
}
assert.equal(ARCHIVE_STORIES.filter(s => s.image).length, 3);
const byId = new Map(ARCHIVE_STORIES.map(s => [s.id, s]));
assert.equal(byId.size, ARCHIVE_STORIES.length, "ストーリーのIDが重複しない");
for (const s of ARCHIVE_STORIES) {
  assert(s.lines.length >= 3, `${s.id} の本文`);
  assert(ARCHIVE_FOCUS.includes(s.illustration.focus), `${s.id} の専用図版`);
  assert.equal(s.illustration.id, s.id);
}
assert.deepEqual(storyEntries({}).map(s => s.id), ["opening"], "未体験の場面は見せない");
assert.deepEqual(storyEntries({ msq:{granted:true}, irene:{greeted:true} }).map(s => s.id),
  ["opening", "arrival", "irene_meeting", "irene_lamp"], "挨拶の後は出会いと灯を読める");
assert(!byId.get("irene_reveal").available({ irene:{greeted:true}, world:{found:{w04_arm:true}} }),
  "腕の発見だけでは、まだ館で語られていない正体を明かさない");
assert(!byId.get("irene_torso").available({ world:{found:{w12_torso:true}} }),
  "館での再会と迷宮での発見を区別する");
assert(!byId.get("irene_trust").available({ irene:{greeted:true,visits:99} }),
  "来館数だけで未読の親しさの会話を明かさない");
assert(byId.get("first_vessel").available({ dollsPurchased:1, party:[] }), "控えに移っても最初の誕生は読める");

const g = { msq:{n:1}, irene:{greeted:true,seen:{m_bond3:true,m_bond5:true}}, dollsPurchased:6,
  stats:{runs:1}, tut:{done:{repairSoul:true}}, treasury:{claimed:{m3:true}},
  world:{found:{},reported:{},beats:{},cleared:{}} };
for (const id of Object.keys(STORY_CELLS)) {
  g.world.found[id] = true;
  assert(byId.get(id)?.available({ world:{found:{[id]:true}} }), `${id} の発見で解放`);
  assert(!byId.get(id).available({}));
}
for (const id of Object.keys(REPORTS)) {
  g.world.reported[id] = true;
  assert(byId.get(`report_${id}`)?.available({ world:{reported:{[id]:true}} }));
}
for (const id of Object.keys(BOSS_MEMORIES)) g.world.beats[`mem_${id}`] = true;
for (const s of IRENE_BEATS) g.world.beats[s.id] = true;
for (const id of Object.keys(CHAPTER_END)) g.world.beats[`ch${id}_end`] = true;
for (const d of WORLD) g.world.cleared[d.id] = true;
const before = JSON.stringify(g), all = storyEntries(g), stories = all.filter(s => !s.id.startsWith("lore_"));
assert.equal(stories.length, ARCHIVE_STORIES.length, "すべての体験済みの場面を収録");
assert.equal(all.filter(s => s.id.startsWith("lore_")).length, WORLD.length, "踏破迷宮のタブも保持");
for (let i = 1; i < stories.length; i++) assert(stories[i].chapter >= stories[i-1].chapter, "序章から第三章の順");
assert.equal(JSON.stringify(g), before, "読むための一覧生成で進行や報酬を変えない");
const oldLines = [...Object.values(STORY_CELLS), ...Object.values(REPORTS), ...Object.values(BOSS_MEMORIES),
  ...IRENE_BEATS, ...Object.values(CHAPTER_END)].flatMap(s => Array.isArray(s.lines) ? s.lines : []);
assert(!ARCHIVE_STORIES.flatMap(s => s.lines).some(line => oldLines.includes(line)), "既存の会話本文を流用しない");
console.log(`読み物${stories.length}場面: 解放条件・専用図版・章順・本文・状態保全 OK`);
