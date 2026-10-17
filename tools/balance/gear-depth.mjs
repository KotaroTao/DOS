// 深度成長・会心4種・付呪素材の深度・評価と価格の回帰検査。
import assert from 'node:assert/strict';
import { itemDepthMul, infEnemyMul } from '../../src/itemdepth.js';
import { lvPow } from '../../src/levelcurve.js';
import { AFX, afxDef, afxBase, rollAffixes, applyAffixes, affixPower, affixRange, pageFromAffix, pageValue, pageText, enchantBlock } from '../../src/infaffix.js';
import { ITEMS, SLOTS, itemAtQuality, recalc, registerAffixes } from '../../src/items.js';
import { CATALOG_ITEMS } from '../../src/catalog/index.js';
import { equipScore, equipPrice, priceForScore, repriceEquipment } from '../../src/pricing.js';
import { Battle, SPELLS, setElemKnown } from '../../src/combat.js';
import { makeDoll } from '../../src/souls.js';
import { MONSTERS } from '../../src/sprites.js';
import { DUNGEON_MONSTERS } from '../../src/dungeons/index.js';
import { useMathRandom } from '../../src/rng.js';
Object.assign(ITEMS, CATALOG_ITEMS);Object.assign(MONSTERS,DUNGEON_MONSTERS);
registerAffixes(applyAffixes);repriceEquipment(ITEMS);setElemKnown(null);useMathRandom();
let seed=9201;const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};Math.random=rng;
const near=(a,b,eps=1e-7)=>assert(Math.abs(a-b)<=eps,`${a} != ${b}`);
const specimen=(id,depth,afx=[])=>itemAtQuality({...ITEMS[id],depth,q:50,afx});
for(const it of [{},{depth:1},{depth:199},{depth:200},{depth:Infinity}])assert.equal(itemDepthMul(it),1);
let previous=1;
for(const d of [201,250,500,1000,10000,1000000]){
 const m=itemDepthMul({depth:d});assert(m>previous);previous=m;
 near(m,lvPow(d)/lvPow(200)*infEnemyMul(d)/infEnemyMul(200));
 const B=afxBase({lv:200,depth:d});near(B,76*m);
 for(const slot of new Set(SLOTS.map(k=>k.startsWith('acc')?'acc':k))){
  const tmpl=Object.values(ITEMS).find(it=>it.slot===slot&&it.lv>=190&&!it.cursed&&it.price>0);
  const it=specimen(tmpl.id,d,[{k:'A03',v:B*.2},{k:'A09',v:.037},{k:'A10',v:.23},{k:'A11',v:.019},{k:'A12',v:.17}]);
  assert(Number.isFinite(it.price)&&it.price>0);assert.equal(it.price,equipPrice(it));near(it.critDamage,Math.min(1,(tmpl.critDamage||0)+.23));
  near(it.spellCrit,Math.min(.2,(tmpl.spellCrit||0)+.019));near(it.spellCritDamage,Math.min(1,(tmpl.spellCritDamage||0)+.17));
  const again=itemAtQuality(JSON.parse(JSON.stringify(it)),50);
  for(const k of ['atk','vit','agi','hp','mp','crit','critDamage','spellCrit','spellCritDamage','price','equipPts'])assert.equal(again[k],it[k],`${slot}/${d}/${k}`);
  const noAfx=specimen(tmpl.id,d);assert(it.price>noAfx.price);
  near(it.equipPts,equipScore(noAfx)+affixPower(it,it.afx));
 }
}
// 装備係数は固定、実数が伸びる。魔杖・信仰杖・複合杖も参照先に加算。
for(const key of ['strength','dagger','bow','faith','dualstaff','arcane']){
 const tmpl=Object.values(ITEMS).find(it=>it.weaponProfile===key&&it.lv>=150);
 const a=specimen(tmpl.id,200),b=specimen(tmpl.id,1000);
 assert.deepEqual(a.scale,b.scale);assert(equipScore(b)>equipScore(a));
 assert(Object.keys(a.scale).some(k=>(b[k]||0)>(a[k]||0)));
}
const forged=specimen('dagger',1000,[{k:'A03',v:100}]);
const f=itemAtQuality({...forged,forge:3});assert(f.price>forged.price);assert.equal(f.price,equipPrice(f));assert.equal(itemAtQuality(f).price,f.price);
// 上限値・刻み・枠数。格や枠数は100階以降にさらに増えない。
const values=Object.fromEntries(['A09','A10','A11','A12'].map(k=>[k,new Set()]));
for(let i=0;i<50000;i++){
 const depth=i%2?20:1000,it={slot:'weapon',lv:200,price:10,rar:'lr',depth};
 const afx=rollAffixes(it,depth,rng);assert(afx.length<=5);
 for(const a of afx){const d=afxDef(a.k);if(d.kind==='B')assert(a.v<=affixRange(d,it)[1]*afxBase(it)+1e-6);
  else assert(a.v>=affixRange(d,it)[0]-1e-6&&a.v<=affixRange(d,it)[1]+1e-6,a.k);
  if(values[a.k]){values[a.k].add(a.v);near(a.v/d.step,Math.round(a.v/d.step));}
 }
}
// 両端を含む全刻みを、実際のドロップ抽選へ制御した乱数を渡して検査する。
for(const rar of ['c','uc','r','sr','lr'])for(const k of Object.keys(values)){
 const d=afxDef(k),band=affixRange(d,{rar}),count=Math.round((band[1]-band[0])/d.step),cand=AFX.filter(x=>x.tier===d.tier&&x.slots.some(s=>['all','w'].includes(s)));
 for(let j=0;j<=count;j++){
  const r=(j+.5)/(count+1),seq=[.99,d.tier==='u'?49/93.4:80.5/93.4,(cand.indexOf(d)+.5)/cand.length,r/1.3,r/1.3,r/1.3];
  const afx=rollAffixes({slot:'weapon',lv:200,price:10,rar},1000,()=>seq.length?seq.shift():rng());
  assert.equal(afx[0].k,k);near(afx[0].v,band[0]+j*d.step);
 }
}
// 巻物と品の浅い方の深度で実数を決定。深い素材を浅い品へ移しても底上げしない。
const deep={lv:200,rar:'lr',depth:1000,name:'検査の品'},shallow={lv:200,rar:'lr',name:'検査の品'},a={k:'A03',v:afxBase(deep)*.2};
const dp=pageFromAffix(deep,a),sp=pageFromAffix(shallow,{k:'A03',v:afxBase(shallow)*.2});
near(pageValue(dp,deep),Math.round(a.v*100)/100);near(pageValue(dp,shallow),15.2);near(pageValue(sp,deep),15.2);
assert(pageText(dp).includes(String(Math.round(a.v))));
assert(enchantBlock({...deep,slot:'weapon'},pageFromAffix(shallow,{k:'K01',v:22.8}),'lr').includes('深度'));
assert.equal(enchantBlock({...deep,slot:'weapon'},pageFromAffix(deep,{k:'K01',v:afxBase(deep)*.3}),'lr'),null);
near(affixPower({lv:100},[{k:'K01',v:7.5}]),7.5);
near(affixPower(deep,[{k:'A10',v:.2}])/affixPower(shallow,[{k:'A10',v:.2}]),itemDepthMul(deep));
// 価格は全部位で深い性能点にも単調。旧260Lvの打ち切りを越えて逆算。
for(const slot of ['weapon','body','head','feet','hands','shield','acc']){
 let p=0;for(const score of [1,10,100,1000,10000,1e6,1e10,1e15]){const v=priceForScore(slot,score);assert(Number.isFinite(v)&&v>p);p=v;}
}
// 装備の共有参照を二重集計しない。外すと会心補正が消え、上限も適用される。
const doll=makeDoll('会心検査');doll.equip.weapon={crit:.037,critDamage:.3,spellCrit:.019,spellCritDamage:.2};doll.equip.shield=doll.equip.weapon;recalc(doll);
near(doll.critBonus,.037);near(doll.critDamageBonus,.3);near(doll.spellCritBonus,.019);near(doll.spellCritDamageBonus,.2);
for(const s of SLOTS)doll.equip[s]={critDamage:.3,spellCrit:.1,spellCritDamage:.3};recalc(doll);
near(doll.critDamageBonus,2.4);near(doll.spellCritBonus,.8);near(doll.spellCritDamageBonus,2.4);
for(const s of SLOTS)doll.equip[s]=null;recalc(doll);assert.equal(doll.critDamageBonus,0);assert.equal(doll.spellCritBonus,0);
// 実戦ダメージ・確率・オート予測。物理と魔法を混同しない。
const actor=()=>Object.assign(makeDoll('術者'),{level:50,atk:200,int:200,pie:100,agi:100,luk:20,hp:1e9,maxhp:1e9,mp:1e9,maxmp:1e9,critBonus:0});
const foe=()=>({uid:9999,name:'敵',key:'bs_ghoul',mon:MONSTERS.bs_ghoul,side:'enemy',alive:true,hp:1e12,maxhp:1e12,atk:80,vit:60,agi:30,int:40,pie:40,luk:8,lv:40,element:'none',spells:[]});
{
 const a=actor(),t=foe(),b=new Battle([a],[t],()=>{}),r=Math.random;Math.random=()=>.5;
 const ps=b.peekStats(a);assert.equal(ps.spellCrit,0);assert.equal(ps.critMul,1.85);assert.equal(ps.spellCritMul,1.5);
 const plain=b._physical(a,t,{acc:1,critBonus:1}).dmg;
 a.critDamageBonus=.3;const boosted=b._physical(a,t,{acc:1,critBonus:1}).dmg;near(boosted/plain,1.3,.02);
 a.critDamageBonus=0;a.spellCritDamageBonus=.3;assert.equal(b._physical(a,t,{acc:1,critBonus:1}).dmg,plain);
 a.spellCritDamageBonus=0;
 const key=Object.keys(SPELLS).find(k=>SPELLS[k].kind==='atk'&&SPELLS[k].target==='enemy'&&!SPELLS[k].gravity&&!SPELLS[k].hits),sp=SPELLS[key];
 a.spellCritBonus=.5;assert.equal(b._spellCritChance(a,sp),.5);a.spellCritBonus=100;assert.equal(b._spellCritChance(a,sp),1);
 assert.equal(b._spellCritChance(a,{...sp,gravity:true}),0);assert.equal(b._spellCritChance(a,{...sp,critBonus:1}),1);
 const spell=()=>b._exec({actor:a,action:'spell',spellKey:key,target:t}).hits.reduce((s,h)=>s+(h.dmg||0),0);
 const sd=spell();a.spellCritDamageBonus=.3;near(spell()/sd,1.3,.02);
 a.spellCritBonus=.05;Math.random=r;
 const expected=b.estSpell(a,sp,t);let damage=0,crits=0;
 for(let i=0;i<20000;i++){a.mp=1e9;t.hp=t.maxhp;t.alive=true;const res=b._exec({actor:a,action:'spell',spellKey:key,target:t});damage+=res.hits.reduce((s,h)=>s+(h.dmg||0),0);crits+=res.hits.filter(h=>h.crit).length;}
 near(crits/20000,.05,.007);near(damage/20000/expected,1,.03);
}
console.log('深度200→100万、全部位と6武器型、再構築/鍛造、会心4種の全刻み、5万ドロップ、付呪深度、評価/価格、上限、会心2万実戦と予測 OK');
