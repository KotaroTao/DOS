// 補給枠の永続化と、到達率に不完全な標本を混ぜないことを確認。
import assert from 'node:assert/strict';
import { infRecovery, infSupplyLeft, infSpendSupply, infUseCount } from '../../src/infsupplies.js';
const ab = {};
assert.equal(infSupplyLeft(ab, 5), 3);
assert.equal(infSpendSupply(ab, 5, 2), true);
assert.equal(infSupplyLeft(ab, 5), 1);
assert.equal(infSpendSupply(ab, 5, 2), false);
assert.equal(infSpendSupply(ab, 5, -1), false);
assert.equal(infSpendSupply(ab, 5, 0.5), false);
const saved = JSON.parse(JSON.stringify(ab));
assert.equal(infSupplyLeft(saved, 5), 1);
assert.equal(infSupplyLeft(saved, 10), 3);
assert.equal(infSpendSupply(saved, 5, 1), true);
assert.equal(infSupplyLeft(saved, 5), 0);
assert.equal(infSupplyLeft(saved, 10), 3);
for (const u of [{mp:30},{heal:30},{revive:0.3},{cure:['poison']},{full:true},{mpFull:true}]) assert(infRecovery(u));
assert(!infRecovery({float:3}));assert(!infRecovery({recall:true}));
assert.equal(infUseCount(Array.from({length:50},()=>({slot:'use'}))),50);
// 本編とは別の補正。50/100階の境目で飛ばず、100階以降は深くなるほど増す。
const {infEnemyMul}=await import('../../src/abyss.js');
assert.equal(infEnemyMul(1),.7);assert(Math.abs(infEnemyMul(50)-.8)<1e-10);
assert(Math.abs(infEnemyMul(100)-.95)<1e-10);
assert(Math.abs(infEnemyMul(150)-1.25)<1e-10);
for(let f=2;f<301;f++)assert(Math.abs(infEnemyMul(f)-infEnemyMul(f-1))<.007);
console.log('無限迷宮: 深さ補正の連続性 OK');

// 旧記録の共通武魂は街へ一度だけ退避し、以後の入手分を混ぜない。
const {stockRows,stockAdd}=await import('../../src/bukon.js');
const old={bukonStock:{'flat_hp:1':'9007199254740993'},bukonProtected:{'flat_hp:1':true},abyss:{v:2,home:{}}};
assert.deepEqual(stockRows(old),[]);
assert.equal(old.abyss.home.bukonStock['flat_hp:1'],'9007199254740993');
assert.equal(old.abyss.home.bukonProtected['flat_hp:1'],true);
stockAdd(old,{k:'flat_hp',lv:1},2);
const restored=JSON.parse(JSON.stringify(old));
assert.equal(stockRows(restored)[0].count,'2');
assert.equal(restored.abyss.home.bukonStock['flat_hp:1'],'9007199254740993');
assert(!stockRows(restored)[0].protected);
console.log('無限迷宮: 旧共通武魂の保全・今回分の分離・再読込・大きな個数 OK');
