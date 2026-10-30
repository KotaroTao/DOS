import assert from 'node:assert/strict';
import {refSerialize,refDeserialize,applySavePatch} from '../../src/savegraph.js';
import {resolveCloudTurn} from '../../src/cloud-battle.js';
import {Battle} from '../../src/combat.js';
import {makeDoll} from '../../src/souls.js';
import {ITEMS} from '../../src/items.js';
import {rngState,reseedRng} from '../../src/rng.js';
const inventory=Array.from({length:6561},()=>({...ITEMS.u_styptic_salve}));
assert(inventory[0].id);
reseedRng(17);
const p=Object.assign(makeDoll('検証'),{hp:50,maxhp:100,mp:100,agi:1000,items:inventory});
const foe={uid:9,key:'bs_ghoul',side:'enemy',alive:true,hp:100,maxhp:100,atk:1,vit:10,agi:1,int:10,pie:10,luk:8,lv:1,element:'none'};
const battle=new Battle([p],[foe],()=>{});battle.chooseAction('spell','DIOS');battle.chooseTarget(p);
const state={state:'combat',battle,party:[p],reserve:[],inventory,souls:[],rng:rngState(),codex:{mon:{},fresh:{mon:{}}},events:{},world:{},order:{picks:[]},run:{items:[{owner:p,item:inventory[3]}]}};
const old=refSerialize(state), compact=refSerialize(state,{compact:true});
const restored=refDeserialize(JSON.parse(JSON.stringify(compact)));
assert.deepEqual(restored,refDeserialize(old));
assert.equal(restored.party[0].items,restored.inventory);
assert.equal(restored.battle.pending.target,restored.party[0]);
assert.equal(restored.run.items[0].item,restored.inventory[3]);
assert.notEqual(restored.inventory[0],restored.inventory[1]);
restored.inventory[0].name='変更';assert.notEqual(restored.inventory[0].name,restored.inventory[1].name);
const baseline=resolveCloudTurn(refDeserialize(old),'commit');
const smaller=resolveCloudTurn(refDeserialize(compact),'commit',{compact:true});
for(const key of ['packet','nextPacket'])assert.deepEqual(refDeserialize(smaller[key]),refDeserialize(baseline[key]));
applySavePatch(restored,refDeserialize(smaller.packet));applySavePatch(restored,refDeserialize(smaller.nextPacket));
assert.equal(restored.inventory.length,6561);assert.equal(restored.party[0].items,restored.inventory);
const bytes=x=>Buffer.byteLength(JSON.stringify(x));
assert(bytes(compact)<bytes(old)/4);assert(bytes(smaller)<bytes(baseline)/4);
for(const bad of [
 {root:{$r:0},format:2,heap:[{t:9}],templates:[]},
 {root:{$r:0},format:2,heap:[{t:0,r:[9]}],templates:[{o:{},keys:['x']}]},
 {root:{$r:0},format:2,heap:[{t:0,r:[0]}],templates:[{o:{},keys:['__proto__']}]},
 {root:{$r:0},format:2,heap:[{t:0}],templates:[{o:{bad:{}},keys:[]}]}
])assert.throws(()=>refDeserialize(bad));
const cycle={};cycle.self=cycle;
const c=refDeserialize(refSerialize(cycle,{compact:true}));assert.equal(c.self,c);
console.log({saveBefore:bytes(old),saveAfter:bytes(compact),battleBefore:bytes(baseline),battleAfter:bytes(smaller)});
console.log('圧縮記録: 個数・個体・共有参照・循環・戦闘結果・乱数一致と不正入力拒否 OK');
// 装備候補の印は、回復薬の説明を読み出さず、空き枠と候補の変更を拾う。
const {equipHintSignature}=await import('../../src/autoequip.js');
const medicine={slot:'use',get desc(){throw Error('道具の説明を装備判定で読んだ');}};
const hintDoll={equip:{},items:Array(6561).fill(medicine)};
const hint=equipHintSignature([hintDoll]);
assert(hint.length<100);
hintDoll.items.pop();assert.notEqual(equipHintSignature([hintDoll]),hint);
const gear={slot:'weapon',atk:1};hintDoll.items.push(gear);
const before=equipHintSignature([hintDoll]);gear.atk=2;assert.notEqual(equipHintSignature([hintDoll]),before);
gear.locked=true;assert(!equipHintSignature([hintDoll]).includes('atk'));
console.log('装備の印: 道具の説明を除外・空き枠/候補/強化/ロックの変更検知 OK');

assert.throws(()=>refDeserialize({root:{$r:0},format:2,heap:Array.from({length:40000},()=>({t:0})),templates:[{o:{text:'x'.repeat(1024)},keys:[]}]}),/展開が大きすぎ/);
