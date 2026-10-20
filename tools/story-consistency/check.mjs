// 取り逃し・後戻り・覚醒前後で、物語が未体験の出来事を語らないことを確かめる。
import assert from 'node:assert/strict';
import { STORY_CELLS, IRENE_BEATS, BOSS_MEMORIES, REPORTS } from '../../src/story.js';
import { ARCHIVE_STORIES, archiveSceneLines, archiveStories } from '../../src/archive-stories.js';
import { MONSTER_LORE, monsterLoreFor } from '../../src/dungeons/monlore.js';

const raw = id => ARCHIVE_STORIES.find(s => s.id === id);
const state = (found = {}, awake = false) => ({world:{found, reported:{}, beats:awake ? {irene_sera_wake:1} : {}}});
const ctx = g => ({found:k=>!!g.world.found[k], beat:k=>!!g.world.beats[k], reported:()=>false, open:()=>false});
const all = Object.fromEntries(Object.keys(STORY_CELLS).map(k=>[k,1]));
const before = state(all), after = state(all,true);
let cases = 0;
// 発見だけの脚の読み返しには、ほかの部品を回収した断定を置かない。
for (let mask=0;mask<8;mask++) {
  const found = {w16_legs:1};
  ['w04_arm','w12_torso','w07_sera'].forEach((k,i)=>{if(mask & (1<<i))found[k]=1;});
  const g = state(found);
  const lines = archiveStories(g).find(s=>s.id==='w16_legs').lines.join('');
  assert(!/これで.*(?:そろ|一人の形)/.test(lines), '脚だけの発見で全身の回収を断定しない');
  assert(!/あとは脚だけ/.test(IRENE_BEATS.find(b=>b.id==='irene_torso').lines.join('')), '脚を先に回収しても矛盾しない');
  cases++;
}
const voiced = ['irene_lineage','irene_order','irene_bell','irene_rain','irene_rest','irene_names','irene_candle','irene_why','irene_onlyonce','irene_lastpage','irene_vessel','irene_enough','irene_hands','irene_tomorrow'];
for (const id of voiced) {
  const old = JSON.stringify(raw(id));
  const asleep = archiveSceneLines(raw(id),before).join('');
  const awake = archiveSceneLines(raw(id),after).join('');
  assert.notEqual(asleep,awake,`${id}: 覚醒前の段落がある`);
  assert(!/セラ(?:が|は|も)[^。]{0,70}(?:言った|笑った|座|声を|手を|並び|知って)/.test(asleep),`${id}: 未覚醒の発言や行動を出さない`);
  assert.equal(JSON.stringify(raw(id)),old,'読み返しが本文台帳を書き換えない');
  cases++;
}
// 同じ報告でも、任意の手掛かりを見つける前後で未読の内容を語らない。
const optionalReports = {
  w07:'w07_names', w08:'w08_banner', w11:'w11_hut', w12:'w12_torso',
  w15:'w15_mural', w18:'w18_blade', w19:'w19_husks', w22:'w22_coat',
  w23:'w23_names', w27:'w27_crest', w28:'w28_note', w31:'w31_bell',
  w35:'w35_lamps', w36:'w36_nook', w38:'w38_lamp', w39:'w39_tags',
  w40:'w40_eyes', w43:'w43_jars', w44:'w44_glass', w47:'w47_ledger'
};
for (const [id,need] of Object.entries(optionalReports)) {
  const scene = raw('report_'+id), g = state({...all},true);
  g.world.reported[id]=1;
  const snapshot=JSON.stringify(scene);
  const known=archiveStories(g).find(s=>s.id===scene.id).lines;
  delete g.world.found[need];
  const unknown=archiveStories(g).find(s=>s.id===scene.id).lines;
  assert.notDeepEqual(unknown,known,`${id}: 手掛かり未発見の報告には別の本文がある`);
  assert.equal(JSON.stringify(scene),snapshot,`${id}: 読み返しても本文台帳は変えない`);
  cases++;
}
assert(!/師の帰りが必要/.test(raw('irene_sera').lines.join('')),'読み物でも帰還を復活の絶対条件にしない');
assert(!/自分の足で進もう/.test(raw('w16_legs').lines.join('')),'読み物でも分離した脚を歩かせない');
for (const [id,lore] of Object.entries(MONSTER_LORE)) {
  assert.equal(monsterLoreFor(id,before),lore.by.startsWith('セラ')?null:lore,`${id}: 覚醒前の語り手`);
  assert.equal(monsterLoreFor(id,after),lore,`${id}: 覚醒後に伝承が読める`);
  cases++;
}
const torso = STORY_CELLS.w12_torso.lines.join('');
assert(!/書きつけ|書付|紙|頼む/.test(torso),'事故で流された胴に事故後の手紙を置かない');
assert(/片方の腕/.test(torso),'胴と一緒に回収する腕を明記');
assert(!/溶けかけた氷/.test(STORY_CELLS.w26_splint.lines.join('')),'一年前の添え木は温かい沼に残さない');
assert(!/昨夜.*根の断/.test(REPORTS.w13.lines(ctx(before)).join('')),'過去の切断を現在の出来事にしない');
assert(/封じ|金の輪/.test(BOSS_MEMORIES.w49.lines.join('')),'王を引き戻す仕掛けを止めた因果がある');
assert.equal(REPORTS.w42.need,'w42_dawn','町への到着前に帰還路と住民の報告をしない');
const snapshot=JSON.stringify(after);archiveStories(after);assert.equal(JSON.stringify(after),snapshot,'読み返しが進行を変えない');
console.log(`物語の整合性: ${cases} ケースと因果・状態保全 OK`);
