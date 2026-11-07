// 街の一括参照は進行表を繰り返し正規化せず、地図の変更を次の呼び出しへ反映する。
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DUNGEONS, DUNGEON_MONSTERS, dungeonLevelRaw} from '../../src/dungeons/index.js';
import {NAMED_IDS, NAMED_FOES, bountyId} from '../../src/dungeons/named.js';
import {MONSTERS} from '../../src/sprites.js';
import {refGold, refSoul} from '../../src/levelcurve.js';
import {STORY_CELLS, LATE_CLUES} from '../../src/story.js';
Object.assign(MONSTERS, DUNGEON_MONSTERS);
const source = readFileSync(new URL('../../src/game.js', import.meta.url), 'utf8');
const referenceArg = process.argv.indexOf('--reference');
const reference = referenceArg < 0 ? null : readFileSync(process.argv[referenceArg + 1], 'utf8');
function block(text, name) {
  const start = text.indexOf('function ' + name + '(');
  assert(start >= 0, '関数がない: ' + name);
  const line = text.slice(start, text.indexOf('\n', start));
  return line.endsWith('}') ? line : text.slice(start, text.indexOf('\n}', start) + 2);
}
let world, reads = 0, cases = 0;
const named = {seen: {}, trophy: {}}, quest = {fixed: {}};
const env = {DUNGEONS, MONSTERS, NAMED_IDS, NAMED_FOES, bountyId, dungeonLevelRaw, refGold, refSoul,
  worldState: () => { reads++; return world; },
  worldOpenId: id => { reads++; return !!world.open[id]; },
  worldOpenIdx: i => { reads++; return !!world.open[DUNGEONS[i].id]; },
  namedState: () => named, questState: () => quest, codexKills: () => 3,
  worldById: id => DUNGEONS.find(d => d.id === id),
  FIXED_BY_ID: {}, fixedQuestAppears: () => true,
  namedInfo: id => id, cloudEnabled: () => true, testPlayActive: false,
  G: {tut: {}}, unlockedSubSlots: () => 0, chaptersDone: () => 0, featureUnlocked: () => false,
  LOOT_IDS: ['low', 'high', 'shelf'], ITEMS: {low: {lv: 1}, high: {lv: 9999}, shelf: {lv: 1}}, SHOP_INIT_STOCK: {shelf: 1},
};
const build = (text, name, extra = {}) => {
  const vars = {...env, ...extra};
  return new Function(...Object.keys(vars), 'return (' + block(text, name) + ');')(...Object.values(vars));
};
env.questUnit = build(source, 'questUnit');
env.questDeepUnit = cfg => env.questUnit(cfg, Math.max(1, Math.ceil((cfg.floors || 1) * .8)));
const functions = ['questFrontUnit', 'namedInfo', 'namedList', 'eligibleDeliveryItemIds', 'tavernHintAllowed'];
const current = Object.fromEntries(functions.map(name => [name, build(source, name)]));
const prior = reference && Object.fromEntries(functions.map(name => [name, build(reference, name)]));
const lookupReads = {};
const patterns = [[], DUNGEONS.slice(0, 4), DUNGEONS.filter((_, i) => i % 2), DUNGEONS.slice().reverse()];
const alias = {roots:'w10', undercity:'w14', furnace:'w18', frost:'w22', swamp:'w26', storm:'w30', arena:'w34', cavern:'w38'};
function check(name, args, expected) {
  reads = 0;
  const result = current[name](...args);
  assert.deepEqual(result, expected, name + JSON.stringify(args));
  assert.equal(reads, 1, name + ' が進行表を繰り返し正規化した');
  if (prior) {
    reads = 0;
    assert.deepEqual(result, prior[name](...args), name + ' の変更前との相違');
    lookupReads[name] = {beforeMax: Math.max(lookupReads[name]?.beforeMax || 0, reads), after: 1};
  }
  cases++;
}
for (const pattern of patterns) {
  world = {open: Object.fromEntries(pattern.map(d => [d.id, 1])), cleared: {}, reported: {}, found: {}, beats: {}};
  for (let mutation = 0; mutation < 2; mutation++) {
    // 同じ表の直接変更も、別のworldへの交換も、次の参照で読み直す。
    if (mutation) for (const d of DUNGEONS.slice(0, 10)) world.open[d.id] = !world.open[d.id];
    const snapshot = JSON.stringify(world);
    const open = DUNGEONS.filter(d => world.open[d.id]);
    const deepest = open.reduce((a, d) => !a || (d.lvTo || 0) > (a.lvTo || 0) ? d : a, null) || DUNGEONS[0];
    check('questFrontUnit', [], env.questDeepUnit(deepest));
    check('eligibleDeliveryItemIds', [], ['low']);
    const expected = NAMED_IDS.filter(id => MONSTERS[id] && open.some(d => d.elites?.includes(id)));
    check('namedList', [], expected);
    for (const id of NAMED_IDS) {
      const homes = open.filter(d => d.elites?.includes(id)).map(d => d.name);
      const result = current.namedInfo(id);
      assert.deepEqual(result.homes, homes);
      if (prior) assert.deepEqual(result, prior.namedInfo(id));
      reads = 0; current.namedInfo(id); assert.equal(reads, 1); cases++;
    }
    for (const d of DUNGEONS) check('tavernHintAllowed', ['open:' + d.id], !!world.open[d.id]);
    for (const [req, id] of Object.entries(alias)) check('tavernHintAllowed', [req], !!world.open[id]);
    for (const req of ['metal', 'metal2', 'fort'])
      check('tavernHintAllowed', [req], open.some(d => d.layer >= (req === 'metal' ? 3 : 4)));
    assert.equal(JSON.stringify(world), snapshot, '参照が進行を変更した');
  }
}
// すでに取得したwを、対象迷宮の最終確認にも使う (受注で道を開く例外も維持)。
const appears = build(source, 'fixedQuestAppears', {fixedQuestHome: d => d.home});
world = {open: {}, reported: {}, cleared: {}, found: {}};
for (const [def, expected] of [[{home:'w01'}, false], [{home:'w01', opens:['w01']}, true], [{}, true]]) {
  reads = 0; assert.equal(appears(def), expected); assert.equal(reads, 1); cases++;
}
world.open.w01 = 1;
assert.equal(appears({home:'w01'}), true);
// 正規化を省略した生のG.worldへ置き換えず、旧セーブの補完と未報告の復元を維持する。
for (const name of functions) {
  const run = text => {
    const G = {world: {open: {w01: 1}, cleared: {w01: 1}}};
    const normalize = build(source, 'worldState', {G, STORY_CELLS, LATE_CLUES});
    const extra = {worldState: normalize, worldOpenId: id => !!normalize().open[id],
      worldOpenIdx: i => !!normalize().open[DUNGEONS[i].id]};
    const result = build(text, name, extra)(...(name === 'namedInfo' ? [NAMED_IDS[0]] : name === 'tavernHintAllowed' ? ['metal'] : []));
    assert.equal(G.world.report, 'w01');
    for (const key of ['open', 'cleared', 'reported', 'found', 'beats', 'gates', 'fresh', 'told']) assert.equal(typeof G.world[key], 'object');
    assert.equal(G.world.boonsIntro, 0);
    return {result, world: G.world};
  };
  const result = run(source);
  if (reference) assert.deepEqual(result, run(reference), name + ' の旧セーブ補完が異なる');
  cases++;
}
console.log(JSON.stringify({cases, exactResults: true, progressUnchanged: true, readsPerBulkLookup: 1, referenceCompared: !!prior, lookupReads}));
