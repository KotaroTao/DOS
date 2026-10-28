import assert from 'node:assert/strict';
import { WORLD } from '../../src/dungeons/world.js';
import { FIXED_BY_ID } from '../../src/quests.js';
import { depthLimit, mutatorEligible, challengeEntryBlock, applyChallengeEnemies } from '../../src/progression.js';
import { Battle, spawnBossEnemies } from '../../src/combat.js';
import { MONSTERS } from '../../src/sprites.js';
import { BESTIARY } from '../../src/dungeons/bestiary.js';
Object.assign(MONSTERS, BESTIARY);
const makeEnemy = key => spawnBossEnemies(key)[0];
const ids = ['ws7','ws13','ws21','ws24','ws26','ws29','ws31'];
for (const id of ids) {
 const d=WORLD.find(d=>d.id===id); assert(d.challenge); assert.equal(d.floors,15); assert(d.boss);
 const q=Object.values(FIXED_BY_ID).find(q=>q.opens?.includes(id));
 assert(q, id); assert(q.reward.souls.every(([rar])=>rar==='legend'), id);
}
assert.equal(depthLimit(()=>false),50);
for(const n of [100,150,200,250,300])assert.equal(depthLimit(k=>k===`infinite${n}`),n);
assert(depthLimit(k=>k==='infiniteDeep')>300);
for(const d of WORLD)assert.equal(mutatorEligible(d,true),!d.noSpecial && d.layer>=9);
assert(!mutatorEligible(WORLD.find(d=>d.id==='w26'),false));
assert(challengeEntryBlock(WORLD.find(d=>d.id==='ws7'),[{name:'検査',primary:1}],[{uid:1,clsKey:'paladin'}]));
assert.equal(challengeEntryBlock(WORLD.find(d=>d.id==='ws7'),[{name:'検査',primary:1}],[{uid:1,clsKey:'fighter'}]),'');
const base=makeEnemy('bs_fossildragon'); const old={...base};
const enemies=applyChallengeEnemies([base,makeEnemy('bs_fossildragon')],{giant:true});
assert.equal(enemies.length,1);for(const k of ['maxhp','hp','atk','vit','agi','int','pie','luk'])if(typeof old[k]==='number')assert.equal(base[k],old[k]*5,k);
applyChallengeEnemies(enemies,{giant:true});assert.equal(base.maxhp,old.maxhp*5);
for(const rule of ['magic','physical']) {
 const [e]=applyChallengeEnemies([makeEnemy('bs_fossildragon')],{challengeRule:rule});
 const b=new Battle([], [e],()=>{}, {challengeRule:rule});
 const immune=rule==='magic'?'physResist':'magResist';
 assert.equal(b._resistCut(e,1000,immune).dmg,0);
 assert.equal(b._passiveCorrection(e,{side:'party'},'none',rule==='magic'?'magic':'phys'),2);
}
console.log('OK 高難度7迷宮・15階と主・レジェンド報酬・深さ段階・異変対象・入場制限・巨体5倍の冪等性・無効と2倍');
