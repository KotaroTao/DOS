// 固定依頼の候補だけを覚え、解放・再読込・報告の進行を覚え込まないことを比較する。
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DUNGEONS,DUNGEON_MONSTERS,METAL_TIERS} from '../../src/dungeons/index.js';
import {MONSTERS} from '../../src/sprites.js';
import {FIXED_QUESTS} from '../../src/quests.js';
Object.assign(MONSTERS,DUNGEON_MONSTERS);
const source=readFileSync(new URL('../../src/game.js',import.meta.url),'utf8');
const block=(text,name)=>{const found=text.match(new RegExp('function '+name+'\\([^\\n]*\\) \\{[\\s\\S]*?\\n\\}'));assert(found,'関数がない: '+name);return found[0];};
const legacy=`function fixedQuestHome(def) {
  const g = def.goal || {};
  const firstOpen = (ids) => ids.find((id) => worldOpenId(id)) || ids[0] || null;
  if (def.bounty) return firstOpen([...((def.appear && def.appear.openAny) || []), def.ref].filter(Boolean));
  if (g.dungeon) return g.dungeon;
  if (def.opens && def.opens.length) return def.opens[0];
  if (g.type !== "kill" || !g.keys) return null;
  return firstOpen(DUNGEONS.filter((d) => {
    const roster = new Set(dungeonRoster(d));
    return g.keys.some((k) => roster.has(k) || metalInLayer(k, d.layer));
  }).map((d) => d.id));
}`;
let reference=legacy;
if(process.argv.includes('--reference'))reference=block(readFileSync(process.argv[process.argv.indexOf('--reference')+1],'utf8'),'fixedQuestHome');
let world={open:{},cleared:{},reported:{}},rosterCalls=0,worldReads=0;
const env={DUNGEONS,MONSTERS,METAL_TIERS,fixedQuestHomeCandidates:new WeakMap(),
 worldState:()=>{worldReads++;return world;},worldOpenId:id=>{worldReads++;return !!world.open[id];}};
const build=(body,extra={})=>{const args={...env,...extra};return new Function(...Object.keys(args),'return ('+body+');')(...Object.values(args));};
const roster=build(block(source,'dungeonRoster')),metal=build(block(source,'metalInLayer'));
env.dungeonRoster=d=>{rosterCalls++;return roster(d);};env.metalInLayer=metal;
const before=build(reference),after=build(block(source,'fixedQuestHome'));
let cases=0;
const patterns=[[],DUNGEONS.filter((_,i)=>i%2===0),DUNGEONS.filter((_,i)=>i%2),DUNGEONS.slice().reverse(),DUNGEONS.slice(0,4)];
for(const pattern of patterns){
 world={open:Object.fromEntries(pattern.map(d=>[d.id,1])),cleared:{},reported:{}};
 const saved=JSON.stringify(world);
 for(const def of FIXED_QUESTS){assert.equal(after(def),before(def),def.id);cases++;}
 assert.equal(JSON.stringify(world),saved,'候補の選択が進行を変更した');
 // 同じ解放表を直接変更しても、新しく開いた土地を反映する。
 for(const d of DUNGEONS.slice(0,8))world.open[d.id]=!world.open[d.id];
 for(const def of FIXED_QUESTS){assert.equal(after(def),before(def),def.id+' 変更後');cases++;}
}
rosterCalls=0;for(const def of FIXED_QUESTS)before(def);const oldRosters=rosterCalls;
rosterCalls=0;for(const def of FIXED_QUESTS)after(def);const newRosters=rosterCalls;
assert(oldRosters>0);assert.equal(newRosters,0,'固定候補を再探索した');
const count=source.match(/function worldOpenCount\(\) \{[^\n]*\}/);assert(count);
worldReads=0;const total=build(count[0])();assert.equal(total,DUNGEONS.filter(d=>world.open[d.id]).length);assert.equal(worldReads,1,'地図を繰り返し正規化した');
console.log(JSON.stringify({definitions:FIXED_QUESTS.length,cases,exactHomes:true,progressUnchanged:true,rosterCalls:{before:oldRosters,after:newRosters},worldReadsForCount:worldReads}));
