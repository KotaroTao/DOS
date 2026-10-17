// 全176特性×5レア度の共通下限・段階上限、ドロップ・付呪を確認。
import assert from 'node:assert/strict';
import { AFX, afxDef, affixRange, AFFIX_RARITY_MAX, afxBase, rollAffixes, applyAffixes, pageFromAffix, pageValue, pageText, enchantBlock, ENCHANT_SLOTS, gearPerks } from '../../src/infaffix.js';
import { RARITY_KEYS } from '../../src/rarity.js';
import { ITEMS, registerAffixes, itemAtQuality } from '../../src/items.js';
import { CATALOG_ITEMS } from '../../src/catalog/index.js';
import { equipPrice, repriceEquipment } from '../../src/pricing.js';
Object.assign(ITEMS,CATALOG_ITEMS);registerAffixes(applyAffixes);repriceEquipment(ITEMS);
const near=(a,b,eps=1e-7)=>assert(Math.abs(a-b)<=eps,`${a} != ${b}`);
let seed=22446;const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
for(const d of AFX){let last=d.r[1];for(const rar of RARITY_KEYS){
 const [lo,hi]=affixRange(d,{rar});near(lo,d.r[0]);assert(hi>=last-1e-9,d.id+' 段階的な上限');last=hi;
 const fixed=d.kind==='fixB'||d.r[0]===d.r[1],expected=fixed?d.r[1]:d.r[1]*AFFIX_RARITY_MAX[rar];
 if(d.kind==='B'||fixed)near(hi,expected);else assert(hi<=expected+1e-9&&expected-hi<(d.step||.001)+1e-7,d.id+'/'+rar);
}}
assert.deepEqual(affixRange('A09',{rar:'lr'}),[.01,.10]);assert.deepEqual(affixRange('A10',{rar:'lr'}),[.10,.60]);
assert.deepEqual(affixRange('J12',{rar:'lr'}),[.03,.10]);assert.deepEqual(affixRange('F01',{rar:'lr'}),[.05,.24]);
assert.deepEqual(affixRange('A03',{rar:'c'}),[.15,.25]);assert.deepEqual(affixRange('A03',{rar:'lr'}),[.15,.50]);
assert.deepEqual(affixRange('B01',{rar:'lr'}),[.25,.70]);
let drops=0,lrFive=false;
for(const rar of RARITY_KEYS)for(const slot of ['weapon','body','head','hands','feet','shield','acc'])for(const depth of [1,25,50,75,100,200,1000])for(let i=0;i<100;i++){
 const it={slot,lv:200,price:100,rar,depth},B=afxBase(it),afx=rollAffixes(it,depth,rng);assert(afx?.length,rar+'/'+slot+'/'+depth);
 assert(afx.length<=(rar==='lr'?5:4));if(afx.length===5)lrFive=true;
 for(const a of afx){const d=afxDef(a.k),[lo,hi]=affixRange(d,it),v=d.kind==='B'?a.v/B:a.v;
  assert(v>=lo-1e-7&&v<=hi+1e-7,`${rar}/${a.k}/${v} 範囲 ${lo}〜${hi}`);
  if(d.step)near(a.v/d.step,Math.round(a.v/d.step));
 }
 drops++;
}
assert(lrFive,'LRの5枠を維持');
// 合計容量を設けず、枠数だけで制限する。旧品の大きな保存値も書込を妨げない。
for(const rar of RARITY_KEYS)for(const depth of [0,201,1001]){
 const it={slot:'body',lv:193,rar,depth,price:100,name:'枠数検査',afx:[]},count=ENCHANT_SLOTS[rar];
 const keys=['B01','B02','B03','B04','B05'];
 for(const k of keys.slice(0,count)){
  const page={k,r:affixRange(k,it)[1],depth};assert.equal(enchantBlock(it,page,rar),null,k+'/'+rar);
  it.afx.push({k,v:pageValue(page,it)});
 }
 assert(enchantBlock(it,{k:'B06',r:.7,depth},rar).includes('いっぱい'));
}

const over={slot:'body',lv:200,rar:'r',price:100,afx:[{k:'A03',v:1e9}]};
assert.equal(enchantBlock(over,{k:'A04',r:.25},'r'),null,'既存の能力値の合計による書込制限なし');
// 上限の高い巻物を低レアへ移しても対象の上限まで。高レアへ移しても弱い巻物を底上げしない。
const deep={lv:200,depth:1000,rar:'lr',name:'深いLR'},shallow={lv:200,rar:'c',name:'C'};
for(const [k,v] of [['A09',.10],['A10',.60],['J12',.10],['F01',.24]]){
 const page=pageFromAffix(deep,{k,v});near(pageValue(page,shallow),affixRange(k,shallow)[1]);
 const weak=pageFromAffix(shallow,{k,v:afxDef(k).r[0]});near(pageValue(weak,deep),afxDef(k).r[0]);
}
const strong=pageFromAffix(deep,{k:'A03',v:afxBase(deep)*.5});near(pageValue(strong,shallow),19);
near(pageValue(strong,{...deep,rar:'c'}),Math.round(afxBase(deep)*.25*100)/100);
assert(pageText(strong).includes(String(Math.round(afxBase(deep)*.5))));
// 旧品の抽選値は読み込み・品質変更でも増やさず、価格は同じ実効値で再構築。
const tmpl=Object.values(ITEMS).find(it=>it.rar==='lr'&&it.slot==='body');
const legacy={...tmpl,depth:1000,q:50,afx:[{k:'A03',v:10},{k:'J12',v:.04}]};
const a=itemAtQuality(legacy),b=itemAtQuality(JSON.parse(JSON.stringify(a)));
assert.deepEqual(b.afx,legacy.afx);assert.equal(a.price,b.price);assert.equal(b.price,equipPrice(b));
// 基準を超える強い1特性を合計上限で削らず、複数品を無制限に足すこともしない。
for(const [t,v] of [['take',.5],['evade',.08],['crit',.2]]){
 const one=gearPerks([{c:{t,v},label:'LR'}]);near(one[0].c.v,v);
 const many=gearPerks(Array.from({length:8},()=>({c:{t,v},label:'LR'})));
 assert(many.reduce((s,x)=>s+x.c.v,0)<=v+.005);
}
console.log(`全176種×5レア度・${drops}ドロップ・共通下限/最大2倍・刻み・5枠・付呪全枠/深度/移植上限・旧品保存/価格・LRの実効上限 OK`);
