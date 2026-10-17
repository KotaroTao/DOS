// 既存装備の会心4種・品質/付呪の1品上限・合計倍率上限なし・最終会心100%を確認。
import assert from 'node:assert/strict';
import { CATALOG_ITEMS } from '../../src/catalog/index.js';
import { ITEMS, SLOTS, itemAtQuality, recalc, registerAffixes } from '../../src/items.js';
import { CRITICAL_KEYS, ITEM_CRITICAL_CAP, CRITICAL_BANDS, applyNativeCritical, criticalProfile } from '../../src/equipmentcrit.js';
import { applyAffixes, affixPower, afxBase, enchantBlock, pageText } from '../../src/infaffix.js';
import { equipPrice, equipScore, priceForScore, repriceEquipment } from '../../src/pricing.js';
import { Battle, SPELLS, gearCritMul, setElemKnown } from '../../src/combat.js';
import { makeDoll } from '../../src/souls.js';
import { MONSTERS } from '../../src/sprites.js';
import { DUNGEON_MONSTERS } from '../../src/dungeons/index.js';
import { useMathRandom } from '../../src/rng.js';
Object.assign(ITEMS,CATALOG_ITEMS);Object.assign(MONSTERS,DUNGEON_MONSTERS);registerAffixes(applyAffixes);repriceEquipment(ITEMS);setElemKnown(null);useMathRandom();
const near=(a,b,e=1e-7)=>assert(Math.abs(a-b)<e,`${a} != ${b}`);
const totals={};let equipment=0,affected=0;
for(const it of Object.values(ITEMS)){
 if(!['weapon','body','shield','head','hands','feet','acc'].includes(it.slot))continue;
 equipment++;
 const active=CRITICAL_KEYS.filter(k=>it[k]);
 if(active.length){affected++;totals[it.rar||'c']=(totals[it.rar||'c']||0)+1;}
 assert(active.length<=2,it.id+' 項目数');
 if(it.slot==='weapon')assert(active.length,it.id+' 全武器に会心性能');
 const before=JSON.stringify(it);applyNativeCritical(it);assert.equal(JSON.stringify(it),before,it.id+' 冪等');
 for(const q of [0,50,100]){
  const out=itemAtQuality({...it,q});
  for(const k of CRITICAL_KEYS)assert((out[k]||0)>=0&&(out[k]||0)<=ITEM_CRITICAL_CAP[k],it.id+'/'+q+'/'+k);
  assert.equal(itemAtQuality(out).price,out.price,it.id+' 品質の価格を再構築');
 }
}
for(const [rar,band] of Object.entries(CRITICAL_BANDS))for(const lv of [1,200])for(const [key,cat,scale,twoHanded] of [
 ['crit','dg',{agi:1},false],['critDamage','ax',{atk:1},true],['spellCrit','st',{int:1},false],['spellCritDamage','st',{int:1},true]]){
 const it={slot:'weapon',cat,scale,twoHanded,rar,lv};applyNativeCritical(it);
 near(it[key],band[key.endsWith('Damage')?'damage':'rate'][lv===1?0:1]);
}
assert.deepEqual(criticalProfile({slot:'acc',luk:100,eff:{goldUp:.5}}),[],'探索専用品に攻撃性能を付けない');
assert.deepEqual(criticalProfile({slot:'shield',sk:'kite',vit:100}),[],'守りの盾を維持');
for(const [key,k] of [['crit','A09'],['critDamage','A10'],['spellCrit','A11'],['spellCritDamage','A12']]){
 const native={slot:'weapon',lv:200,price:100,q:50,[key]:ITEM_CRITICAL_CAP[key]},a={k,v:k==='A09'||k==='A11'?.05:.3};
 const plainPrice=equipPrice(native),it={...native,afx:[a]};applyAffixes(it);
 near(it[key],ITEM_CRITICAL_CAP[key]);near(affixPower(it,it.afx),0);assert.equal(it.price,plainPrice,'上限に届いた追加を価格に加点しない');
 assert(enchantBlock(native,{k,v:a.v},'lr').includes('上限'));assert(pageText({k,v:a.v},native).includes('+0%'));
}
{
 const it={slot:'weapon',lv:200,crit:.2,price:100,afx:[{k:'K07',v:.06}]};applyAffixes(it);
 near(it.crit,.2);near(it.afxPts,-5*afxBase(it)/25);
 assert(it.afxFx.some(x=>x.c.t==='take'&&x.c.v===-.05),'率が上限でも博打の代償は維持');
}
const d=makeDoll('会心の集計');
for(const s of SLOTS)d.equip[s]={crit:.2,critDamage:1,spellCrit:.2,spellCritDamage:1};recalc(d);
near(d.critBonus,1.6);near(d.spellCritBonus,1.6);near(d.critDamageBonus,8);near(d.spellCritDamageBonus,8);
near(gearCritMul(d),9);near(gearCritMul(d,true),9);
// 同じ実物を複数部位へ参照しても1つだけ数える。外すと補正が残らない。
d.equip.shield=d.equip.weapon;recalc(d);near(d.critDamageBonus,7);
for(const s of SLOTS)d.equip[s]=null;recalc(d);assert.equal(d.spellCritBonus,0);assert.equal(gearCritMul(d),1);
const a=Object.assign(makeDoll('会心検査'),{level:50,atk:200,int:200,pie:100,agi:100,luk:20,hp:1e9,maxhp:1e9,mp:1e9,maxmp:1e9,critBonus:2,spellCritBonus:2});
const t={uid:999,name:'敵',key:'bs_ghoul',mon:MONSTERS.bs_ghoul,side:'enemy',alive:true,hp:1e12,maxhp:1e12,atk:80,vit:60,agi:30,int:40,pie:40,luk:8,lv:40,element:'none',spells:[]};
const b=new Battle([a],[t],()=>{});Math.random=()=>.999;
assert.equal(b.peekStats(a).crit,1);assert.equal(b.peekStats(a).spellCrit,1);
const key=Object.keys(SPELLS).find(k=>SPELLS[k].kind==='atk'&&SPELLS[k].target==='enemy'&&!SPELLS[k].gravity&&!SPELLS[k].hits),sp=SPELLS[key];
assert.equal(b._spellCritChance(a,sp),1);assert.equal(b._spellCritChance(a,{...sp,gravity:true}),0);
for(let i=0;i<100;i++)assert(b._physical(a,t,{acc:1}).crit,'上限100%なら乱数がほぼ1でも会心');
Math.random=()=>.5;
const physical=()=>b._physical(a,t,{acc:1}).dmg;
const spell=()=>b._exec({actor:a,action:'spell',spellKey:key,target:t}).hits.reduce((s,h)=>s+(h.dmg||0),0);
const plain=physical(),plainSpell=spell();
a.critDamageBonus=3;a.spellCritDamageBonus=4;
near(physical()/plain,4,.02);near(spell()/plainSpell,5,.02);
const ps=b.peekStats(a);near(ps.critMul,1.85*4);near(ps.spellCritMul,1.5*5);
near(b.estSpell(a,sp,t)/b.estSpell({...a,spellCritDamageBonus:0},sp,t),5);
console.log(`全${equipment}装備、会心つき${affected}品 ${JSON.stringify(totals)}：レア度別の両端・品質・上限・価格・付呪・8品の加算・100%の実会心・無制限の倍率 OK`);
