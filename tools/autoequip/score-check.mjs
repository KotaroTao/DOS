// 同じ能力変化を部位で別採点せず、往復・分割しても評価がぶれないことを確認。
import assert from 'node:assert/strict';
import { recalc } from '../../src/items.js';
import { previewStats, statsDelta, planBestEquip, applyPlan } from '../../src/autoequip.js';
import { gearScore } from '../../src/ui/itemview.js';
const p={jobKey:'warrior',base:{hp:1500,mp:100,atk:390,vit:500,agi:140,int:100,pie:100,luk:140},equip:{},items:[],spells:[],passiveMap:{}};
const weapon={slot:'weapon',cat:'ls',scale:{atk:2.5}};
const guard={slot:'acc',eff:{guard:.1,regen:.1},hp:30};
const ring={slot:'acc',atk:8,hp:74};
const a={weapon,acc1:guard}, b={weapon,acc1:ring};
const score=(a,b)=>gearScore(p,statsDelta(previewStats(p,a),previewStats(p,b)));
const weak={weapon:{...weapon,scale:{atk:2.51}}};
assert(score(a,weak)<0,'わずかな攻撃力と引き換えに守りと再生を失う武器を勧めない');
const delta=statsDelta(previewStats(p,a),previewStats(p,b));
assert.equal(gearScore(p,{...delta,weapon:true}),gearScore(p,delta),'同じ増減を武器交換だけで過大評価しない');
assert(Math.abs(score(a,b)+score(b,a))<=.1,'往復の評価が逆符号になる');
const c={...b,body:{slot:'body',hp:500}};
assert(Math.abs(score(a,b)+score(b,c)-score(a,c))<=.2,'HPが変わっても再生の評価が一貫する');
p.equip=a;p.items=[ring];recalc(p);
const plan=planBestEquip([p],{canEquip:()=>true,score:gearScore});
assert(plan.moves.length<16,'同じ装備を往復しない');
if(plan.moves.length){applyPlan(plan);assert.equal(planBestEquip([p],{canEquip:()=>true,score:gearScore}).moves.length,0,'適用後に逆の変更を勧めない');}
console.log('装備評価: 部位共通・往復・分割・再計算の一貫性 OK');
