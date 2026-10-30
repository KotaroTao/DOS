// 開幕呪撃: 消費の境界・不発条件・無効な敵への発動を確認。
import assert from 'node:assert/strict';
import { Battle } from '../../src/combat.js';
import { makeDoll, passiveDesc } from '../../src/souls.js';
function fixture(maxmp, mp, extra = {}) {
  const a = Object.assign(makeDoll('開幕の検証'), { int:100, maxmp, mp, passiveMap:{}, spellCostMul:0.5 });
  const t = { uid:999, name:'検証の敵', side:'enemy', alive:true, hp:1e7, maxhp:1e7, vit:0, agi:1, int:0, level:40, element:'none', ...extra };
  const b = new Battle([a],[t],()=>{});
  a.passiveMap={openSpell:1,chant:2,arcthiefKanjou:3};
  return {a,t,b};
}
for (const [maxmp,cost] of [[0,1],[1,1],[19,1],[20,1],[21,2],[100,5],[101,6],[1000,50]]) {
  for (const mp of [cost-1,cost,cost+10]) {
    const {a,t,b}=fixture(maxmp,mp); const hp=t.hp;
    b._openingStrikes();
    assert.equal(a.mp,mp>=cost?mp-cost:mp);
    assert.equal(b.openingResults.length,mp>=cost?1:0);
    assert.equal(t.hp<hp,mp>=cost);
  }
}
for (const condition of ['ambush','dead','noTarget','unlearned']) {
  const {a,t,b}=fixture(100,100);
  if(condition==='ambush') b.opening='ambush';
  if(condition==='dead') a.alive=false;
  if(condition==='noTarget') t.alive=false;
  if(condition==='unlearned') a.passiveMap={};
  b._openingStrikes(); assert.equal(a.mp,100); assert.equal(b.openingResults.length,0);
}
{
  const {a,t,b}=fixture(100,5,{magResist:100});const hp=t.hp;
  b._openingStrikes(); assert.equal(a.mp,0); assert.equal(t.hp,hp);
  assert.equal(b.openingResults.length,1); assert(b.openingResults[0].hits[0].immune);
}
assert(passiveDesc('openSpell',1).includes('最大MPの5%'));
console.log('開幕呪撃: 最大MP5%・切り上げ・MP不足・奇襲・対象不在・無効・軽減なし・表示を確認');
