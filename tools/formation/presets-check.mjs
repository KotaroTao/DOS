// 保存・切り替え・実物共有・容量・検査失敗時の不変性を検証する。
import assert from 'node:assert/strict';
import { saveFormation, renameFormation, applyFormation, syncFormationItems, planFormation } from '../../src/formations.js';
import { makeDoll, makeSoulInstance, setSharedSouls, recalcDoll, soulLearnedSkills } from '../../src/souls.js';
import { ITEMS, SLOTS, bagCount, unequip, equip, shareInventory } from '../../src/items.js';
import { refSerialize, refDeserialize } from '../../src/savegraph.js';
const g = { state: 'town', party: [makeDoll('一'), makeDoll('二')], reserve: [makeDoll('控え')], souls: [], inventory: [] };
for (const [i, cls] of ['fighter', 'mage', 'priest', 'thief'].entries()) g.souls.push(makeSoulInstance(cls, 1, 10));
setSharedSouls(g.souls);
g.party.forEach((d,i) => { d.primary = g.souls[i].uid; recalcDoll(d); d.hp=3; d.mp=1; });
g.reserve[0].primary=g.souls[2].uid; recalcDoll(g.reserve[0]);
shareInventory(g);
const blade = structuredClone(Object.values(ITEMS).find(i => i.slot === 'weapon' && !i.classes && !i.cursed && !i.unidentified && !i.twoHanded));
assert.ok(blade);
blade.lv=1;
g.party[0].equip.weapon=blade;
const subSoul=g.souls[3], skill=soulLearnedSkills(subSoul)[0];
g.party[0].subs=[{ uid: subSoul.uid, picks: [{skill}], picked:true }];
assert.ok(saveFormation(g,0,'火の迷宮対策').ok);
assert.ok(saveFormation(g,9,'育成用').ok);
assert.deepEqual(blade.formationNames,['火の迷宮対策','育成用']);
// サブの技の配列を独立保存し、強化は実物を共有する。
g.party[0].subs[0].picks.length=0;
assert.equal(g.formations[0].members[0].subs[0].picks.length,1);
blade.q=91;
assert.equal(g.formations[9].members[0].equip.weapon.q,91);
assert.ok(unequip(g.party[0],'weapon').ok);
assert.equal(bagCount(g.inventory),0);
for(let n=0;n<50;n++) g.inventory.push({id:'herb',slot:'use'});
assert.equal(g.inventory.length,51);
assert.equal(bagCount(g.inventory),50);
// 複数登録の片方だけの解除は容量を増やさない。
assert.ok(saveFormation(g,9,null,true).ok);
const snapshot=refSerialize(g);
assert.equal(saveFormation(g,0,null,true).ok,false);
assert.deepEqual(refSerialize(g),snapshot);
assert.equal(saveFormation(g,0).ok,false);
assert.deepEqual(refSerialize(g),snapshot);
assert.ok(renameFormation(g,0,'水攻・火防').ok);
assert.deepEqual(blade.formationNames,['水攻・火防']);
// 袋が満杯でも登録装備は取り出せ、空欄・順番・魂・技を復元する。
g.party.reverse();
g.party[1].primary=null; g.party[1].subs=[];
assert.ok(applyFormation(g,0).ok);
assert.equal(g.party[0].name,'一');
assert.equal(g.party[0].equip.weapon,blade);
assert.equal(g.party[0].subs[0].picks[0].skill,skill);
assert.equal(g.party[0].hp,3);
assert.equal(g.party[0].stability,100);
assert.ok(unequip(g.party[0],'weapon').ok);
assert.equal(bagCount(g.inventory),50);
// ロック・呪い・消失した魂では全件を変更しない。
const lock = { ...blade, formationNames:undefined, locked:true };
g.party[0].equip.weapon=lock;
let before=refSerialize(g);
assert.equal(applyFormation(g,0).ok,false);
assert.deepEqual(refSerialize(g),before);
lock.locked=false; lock.cursed=true;
before=refSerialize(g);
assert.equal(applyFormation(g,0).ok,false); assert.deepEqual(refSerialize(g),before);
g.party[0].equip.weapon=null;
const soul=g.souls.pop(); before=refSerialize(g);
assert.equal(applyFormation(g,0).ok,false); assert.deepEqual(refSerialize(g),before);
g.souls.push(soul);
assert.equal(planFormation(g,0,{subSlots:0}).ok,false);
assert.equal(planFormation(g,0,{soulChange:false}).ok,true);
// 共有参照はローカル/クラウド共通の保存形式で往復しても保つ。
assert.ok(applyFormation(g,0).ok);
const loaded=refDeserialize(refSerialize(g)); setSharedSouls(loaded.souls); syncFormationItems(loaded);
assert.equal(loaded.party[0].equip.weapon,loaded.formations[0].members[0].equip.weapon);
assert.equal(loaded.party[0].items,loaded.inventory);
assert.ok(saveFormation(loaded,0,null,true).ok); // 装備中なら満杯でも登録解除可
assert.equal(loaded.party[0].equip.weapon.formationNames,undefined);
assert.equal(unequip(loaded.party[0],'weapon').ok,false); // 通常枠へ戻る時は満杯
// 控えからの参加、隊を外れる人業、魂・装備の受け渡し。
setSharedSouls(g.souls);
g.inventory.splice(0,1);
g.party=[g.reserve[0],...g.party];g.reserve=[];
assert.ok(saveFormation(g,1).ok);
g.reserve=[g.party.shift()];
assert.ok(applyFormation(g,1).ok);
assert.equal(g.party.length,3);assert.equal(g.reserve.length,0);
// 未装備も復元し、外れる通常装備の空きを事前検査する。
assert.ok(saveFormation(g,2).ok);
const extra={...blade,formationNames:undefined,slot:'head',classes:null,cursed:false,locked:false};
g.party[0].equip.head=extra;
while(bagCount(g.inventory)<50)g.inventory.push({slot:'use'});
before=refSerialize(g);assert.equal(applyFormation(g,2).ok,false);assert.deepEqual(refSerialize(g),before);
g.inventory.splice(g.inventory.findIndex(i=>i.slot==='use'),1);
assert.ok(applyFormation(g,2).ok);assert.equal(g.party[0].equip.head,null);assert.ok(g.inventory.includes(extra));
console.log('保存10枠・名前・実物共有・借用・順序・控え・容量・ロック/呪い・原子的適用・保存往復 OK');
