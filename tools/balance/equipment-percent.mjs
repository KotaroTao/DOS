// 全目録・新規/既存品・武魂と固有効果・最適装備の評価を同じ条件で確認する。
import assert from 'node:assert/strict';
import { ITEMS, recalc, itemAtQuality, SLOTS, registerAffixes, fightPower } from '../../src/items.js';
import { CATALOG_ITEMS } from '../../src/catalog/index.js';
import { EQUIPMENT_DEFENSE_TARGETS, retuneEquipment } from '../../src/equipmentbalance.js';
import { elementValues, elementalReduction, elementAttack } from '../../src/combatrules.js';
import { equipmentCombatState, equipmentIncoming } from '../../src/equipmentscore.js';
import { applyAffixes, gearPerks } from '../../src/infaffix.js';
import { makeDoll } from '../../src/souls.js';
import { previewStats, statsDelta, equipmentTraitTexts, planBestEquip } from '../../src/autoequip.js';
import { gearScore, specialLines, equipPreviewDelta, ailDetailLines } from '../../src/ui/itemview.js';
import { Battle, SPELLS, setElemKnown } from '../../src/combat.js';
import { equipPrice } from '../../src/pricing.js';
import { W } from '../../src/catalog/defs.js';
import { themeOf } from '../../src/itemart/theme.js';
Object.assign(ITEMS,CATALOG_ITEMS);registerAffixes(applyAffixes,gearPerks);setElemKnown(null);
const near=(a,b,msg='')=>assert(Math.abs(a-b)<1e-8,`${msg}: ${a}/${b}`);
const equipment=Object.values(ITEMS).filter(it=>['weapon','body','head','hands','feet','shield','acc'].includes(it.slot));
assert.equal(equipment.length,2050);assert.equal(Object.keys(EQUIPMENT_DEFENSE_TARGETS).length,274);
let attack=0,defense=0;
for(const it of equipment){
 const before=JSON.stringify(it);retuneEquipment(it);assert.equal(JSON.stringify(it),before,it.id+' 二重適用なし');
 assert.equal(it.equipmentBalanceVersion,1,it.id);
 if(it.eAtk){attack++;assert.equal(it.eAtk.lv,undefined);for(const v of Object.values(elementValues(it.eAtk)))assert(v>0&&v%5===0,it.id+' 属攻');if(it.slot==='weapon')assert(it.element,it.id+' 付与属性');}
 if(it.eDef){defense++;assert.equal(it.eDef.lv,undefined);for(const v of Object.values(elementValues(it.eDef,'defense')))assert(v>0&&v%10===0,it.id+' 耐性力');}
 for(const q of [0,50,100]){
  const copy=itemAtQuality({...structuredClone(it),q,bukon:[{k:'flat_hp',lv:7}]});
  assert.equal(copy.q,q);assert.equal(copy.bukon[0].lv,7);assert.deepEqual(copy.eDef,it.eDef);assert.deepEqual(copy.eAtk,it.eAtk);assert.equal(copy.element,it.element);
  assert.equal(copy.desc,it.desc);assert.equal(itemAtQuality(copy).price,copy.price,it.id+' 再読込の価格安定');
 }
 for(const o of Array.isArray(it.onHit)?it.onHit:it.onHit?[it.onHit]:[]) near(o.chance*20,Math.round(o.chance*20),it.id+' 付与力5%刻み');
 assert(!/[◯◎]/.test(it.desc || ''),it.id+' 旧段階表記なし');
}
assert.equal(attack,469);assert.equal(defense,274);
for(const [id,k] of [['a_sr1_wardenmail','dark'],['s_tidewall','fire'],['a_sr8_wardenplate','water'],['lr_l10_rodplate','wind'],['s_r8_dragonemperorshield','fire'],['g_dragonscale_grips','fire']])assert(elementValues(ITEMS[id].eDef,'defense')[k]>0,id+' 由来に合う守り');
for(const id of ['lr_l1_shroudofstillness','lr_l3_silentcanary','lr_l8_frostcrown'])assert(!ITEMS[id].eff?.ailmentImmune,id+' 専門耐性');
assert(ITEMS.lr_cleanse.eff.ailmentImmune,'最終帯の万能耐性を維持');
assert.equal(themeOf(ITEMS.a_sr1_wardenmail).el,'light','闇を防ぐ墓守の加護の色は元の聖光を保つ');
const legacyArmor=itemAtQuality({...structuredClone(ITEMS.a_sr1_wardenmail),q:50,eDef:{el:'light',lv:2},element:'fire',desc:'古い説明',bukon:[{k:'flat_hp',lv:7}]});
assert.deepEqual(legacyArmor.eDef,ITEMS.a_sr1_wardenmail.eDef);assert.equal(legacyArmor.element,undefined);assert.equal(legacyArmor.bukon[0].lv,7);
const oldWard={slot:'body',rar:'r',lv:50,afx:[{k:'D07',v:.2}]};applyAffixes(oldWard);assert.equal(oldWard.eDef.el,'fire');assert.equal(oldWard.eDef.pct,50,'旧耐火も名前どおりの百分率にする');
const explicit=W('percent_input','割合の検査剣','ls',20,{eAtk:{el:'fire',pct:25},desc:'百分率で属性を定義した、検証専用の一本。炎の力を刃に宿す。'});assert.deepEqual(explicit.eAtk,{el:'fire',pct:25});
const make=()=>{const p=makeDoll('装備検査');p.base={hp:1000,mp:100,atk:100,vit:50,agi:100,int:100,pie:100,luk:8};p.spells=[];p.passiveMap={};recalc(p);return p;};
const score=(p,from,to)=>gearScore(p,statsDelta(previewStats(p,from),previewStats(p,to)));
{
 const p=make(),plain={slot:'weapon',element:'none'},fire={slot:'weapon',element:'fire'},amp={slot:'acc',eAtk:{el:'fire',pct:50}};
 near(score(p,{weapon:plain},{weapon:plain,acc1:amp}),0,'無属性の剣に属攻を加点しない');
 assert(score(p,{weapon:fire},{weapon:fire,acc1:amp})>0,'属性が乗る刃に加点');
 const fireSpell=Object.keys(SPELLS).find(k=>SPELLS[k].kind==='atk'&&SPELLS[k].element==='fire');p.spells=[fireSpell];p.clsKey="mage";
 assert(score(p,{weapon:plain},{weapon:plain,acc1:amp})>0,'習得した火の呪文に加点');
 p.spells=[Object.keys(SPELLS).find(k=>SPELLS[k].kind==='atk'&&SPELLS[k].element==='water')];
 near(score(p,{weapon:plain},{weapon:plain,acc1:amp}),0,'使わない属性は加点しない');
 const strong={slot:'body',eDef:{el:'fire',pct:400}},excess={slot:'body',eDef:{el:'fire',pct:800}};
 near(score(p,{body:strong},{body:excess}),0,'属性軽減80%を超えた分は加点しない');
 const immune={slot:'body',eff:{ailmentImmune:true}},poison={slot:'acc',aRes:{poison:.5}};
 near(score(p,{body:immune},{body:immune,acc1:poison}),0,'万能耐性と専門耐性を二重加点しない');
 const lucky=make();lucky.base.luk=500;recalc(lucky);
 near(score(lucky,{body:{crit:.6}},{body:{crit:.65}}),0,'LUK込み会心80%を超える分は加点しない');
 assert(score(p,{weapon:plain},{weapon:{...plain,eff:{multistrike:2}}})>0,'二連撃の固有効果を評価');
 p.clsKey='fighter';
 const proc=p=>({slot:'weapon',onHit:{k:'paralyze',chance:p}});
 assert(score(p,{weapon:proc(3)},{weapon:proc(4)})>0,'付与力300%超も高耐性の敵には価値がある');
 near(score(p,{weapon:proc(30)},{weapon:proc(31)}),0,'想定する全耐性で飽和した付与力は加点しない');
 // 館の比較と最適装備が同じ値を返す。
 p.equip.weapon=plain;recalc(p);const item={id:'compare_amp',slot:'acc',eAtk:{el:'water',pct:30}};
 near(gearScore(p,equipPreviewDelta(p,'acc1',item)),score(p,p.equip,{...p.equip,acc1:item}),'比較の一致');
 const plainFire={slot:'weapon',element:'fire',name:'火の剣'},wrong={id:'wrong',slot:'acc',eAtk:{el:'earth',pct:80}},right={id:'right',slot:'acc',eAtk:{el:'fire',pct:30}};
 p.clsKey="fighter";p.spells=[];p.equip.weapon=plainFire;recalc(p);p.items=[wrong,right];
 const plan=planBestEquip([p],{canEquip:()=>true,score:gearScore});assert(plan.moves.some(m=>m.item===right));assert(!plan.moves.some(m=>m.item===wrong),'数字だけ大きい未使用属性を選ばない');
}
{
 const p=make();for(const slot of SLOTS)p.equip[slot]={slot:slot.startsWith('acc')?'acc':slot,rar:'lr',resists:{physResist:40,magResist:40},eDef:{values:Object.fromEntries(['fire','water','wind','earth','light','dark'].map(k=>[k,400]))},bukon:[{k:'res_physResist',lv:4},{k:'res_poison',lv:7},{k:'crit',lv:7}]};
 p.equip.body.eff={guard:.6};recalc(p);const b=new Battle([p],[],()=>{});assert.equal(p.physResist,80);assert.equal(p.resists.poison,95);assert.equal(b.peekStats(p).crit,.8);
 near(equipmentIncoming(equipmentCombatState(p)),.1,'固有効果と武魂を重ねても恒常90%');
 assert(equipmentTraitTexts(p.equip).some(t=>t.includes('武魂')),'付け替えで失う武魂の説明');
 const before=JSON.stringify(p.equip);previewStats(p,p.equip);assert.equal(JSON.stringify(p.equip),before,'プレビューで実物を変えない');
}
assert(ailDetailLines({onHit:{k:'poison',chance:3,pct:.05}}).some(t=>t.includes('300%')&&t.includes('一回')),'付与力として表示');
assert(specialLines(ITEMS.a_sr1_wardenmail).some(t=>t.includes('闇耐性力')));
console.log(`OK 全${equipment.length}装備・属攻${attack}/属防${defense}点の来歴別調整・5/10%刻み・既存品/品質/武魂・最適装備の属性選択と実上限・比較一致`);
