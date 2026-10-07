// 図鑑の開放・抵抗値の境界・複合技・全体技の候補と選択を実際のオートで確認。
import assert from 'node:assert/strict';
import { Battle, SPELLS } from '../../src/combat.js';
import { decideAuto, setResistKnown } from '../../src/autotactics.js';
import { makeDoll } from '../../src/souls.js';
import { zeroResists } from '../../src/resistance.js';
import { game } from '../../src/ui/ctx.js';
import { enemyReveal } from '../../src/ui/itemview.js';
const specs = {
  TEST_SLEEP: { kind:'debuff', target:'enemy', sleepChance:.5 },
  TEST_PARA: { kind:'debuff', target:'enemy', para:.5 },
  TEST_MIX: { kind:'debuff', target:'enemy', poison:{chance:.5,pct:.05}, para:.5 },
  TEST_ALL: { kind:'sleep', target:'all-enemy' },
  TEST_HIT: { kind:'phys', target:'enemy', power:10, para:.5 },
  TEST_SEAL: { kind:'debuff', target:'enemy', seal:{chance:.5,turns:3} },
  TEST_DEATH: { kind:'atk', target:'enemy', power:10, instakill:{chance:.5} },
};
for (const [key,sp] of Object.entries(specs)) SPELLS[key]={name:'検証の技',mp:1,...sp};
game.G={codex:{mon:{}}};
setResistKnown(e=>enemyReveal(e).lore);
const actor=()=>Object.assign(makeDoll('検証の人業'),{hp:1000,maxhp:1000,mp:1000,maxmp:1000,jobLv:40,level:40,atk:1,vit:1,agi:20,spells:Object.keys(specs),tactic:'bal'});
const foe=(key,mods={})=>({uid:key==='test_a'?100:101,key,name:'検証の敵',mon:{rank:4,race:'humanoid'},side:'enemy',lv:40,hp:10000,maxhp:10000,atk:1000,vit:100,agi:20,alive:true,ability:'poison',resists:{...zeroResists(),...mods}});
function choose(enemies, keys=Object.keys(specs)) {
 const a=actor();a.spells=keys;
 const b=new Battle([a],enemies,()=>{}),dbg=[];
 return {action:decideAuto(b,a,dbg),dbg,b,a};
}
const has=(r,key)=>r.dbg.some(c=>c.spellKey===key);
try {
 const e=foe('test_a',{paralyze:100,sleep:100,poison:100,seal:100,death:100});
 for (const kills of [0,5,9]) {
  game.G.codex.mon.test_a={kills};
  const r=choose([e]);assert(has(r,'TEST_PARA'));assert(has(r,'TEST_SLEEP'));assert(has(r,'TEST_MIX'));
 }
 const unknownHigh=choose([e]);
 const unknownLow=choose([foe('test_a')]);
 assert.deepEqual(unknownHigh.dbg.map(c=>[c.spellKey,c.score]),unknownLow.dbg.map(c=>[c.spellKey,c.score]));
 game.G.codex.mon.test_a={kills:10};
 const known=choose([e]);
 for (const key of Object.keys(specs)) assert(!has(known,key),key);
 for (const resist of [0,49,50,80,100]) {
  const r=choose([foe('test_a',{paralyze:resist})]);
  assert.equal(has(r,'TEST_PARA'),resist<50);assert.equal(has(r,'TEST_HIT'),resist<50);
 }
 const lowSleep=choose([foe('test_a',{paralyze:49,sleep:0,poison:100,seal:100,death:100})]);
 assert(lowSleep.dbg.find(c=>c.spellKey==='TEST_SLEEP').score > lowSleep.dbg.find(c=>c.spellKey==='TEST_PARA').score);
 assert.equal(choose([foe('test_a',{paralyze:49,sleep:0})],['TEST_SLEEP','TEST_PARA']).action.spellKey,'TEST_SLEEP');
 assert.equal(choose([foe('test_a',{paralyze:0,sleep:49})],['TEST_SLEEP','TEST_PARA']).action.spellKey,'TEST_PARA');
 const mix=choose([foe('test_a',{poison:100,paralyze:0})]);assert(has(mix,'TEST_MIX'));
 assert(!has(choose([foe('test_a',{poison:50,paralyze:80})]),'TEST_MIX'));
 game.G.codex.mon.test_b={kills:10};
 assert(has(choose([foe('test_a',{sleep:100}),foe('test_b',{sleep:0})]),'TEST_ALL'));
 assert(!has(choose([foe('test_a',{sleep:100}),foe('test_b',{sleep:50})]),'TEST_ALL'));
 game.G.codex.mon.test_b.kills=9;
 assert(has(choose([foe('test_a',{sleep:100}),foe('test_b',{sleep:100})]),'TEST_ALL'));
 for (const type of ['boss','elite','named']) {
  const t=foe('test_b',{paralyze:100});t.mon[type]=true;
  game.G.codex.mon.test_b.kills=0;assert(has(choose([t]),'TEST_PARA'));
  game.G.codex.mon.test_b.kills=1;assert(!has(choose([t]),'TEST_PARA'));
 }
 // オートの見積もりだけを変え、未開放でも実際の付与では抵抗100を守る。
 game.G.codex.mon.test_a.kills=0;
 const r=choose([foe('test_a',{paralyze:100})]);assert.equal(r.b.estRate(r.a,r.b.enemies[0],.5,'paralyze'),0);
 console.log('図鑑0/5/9/10体・主/強敵1体、抵抗0/49/50/80/100、複合技・全体技・未開放時の情報遮断を確認');
} finally {
 for(const key of Object.keys(specs))delete SPELLS[key];
 setResistKnown(null);delete game.G;
}
