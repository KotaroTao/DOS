// 無心の境地: 本人との攻防だけに強化無視を適用し、敵の状態・他の仲間へ波及しないことを検査。
import assert from 'node:assert/strict';
import { Battle, SPELLS } from '../../src/combat.js';
import { makeDoll, PASSIVES, jobLevelPassives } from '../../src/souls.js';
import { stageMul } from '../../src/buffstage.js';
import { useMathRandom } from '../../src/rng.js';
import { refSerialize, refDeserialize } from '../../src/savegraph.js';
useMathRandom(); Math.random=()=>.5;
const near=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const member=(lv=0)=>Object.assign(makeDoll('無心の検証'),{
  atk:2000,vit:100,agi:100,int:1000,pie:1000,luk:0,hp:1e7,maxhp:1e7,
  mp:10000,maxmp:10000,passiveMap:lv?{hermitIori:lv}:{},
});
let uid=100000;
const foe=()=>({uid:uid++,name:'検証の敵',side:'enemy',alive:true,hp:1e7,maxhp:1e7,
  atk:2000,vit:500,agi:100,int:1000,pie:2000,luk:0,lv:40,
  element:'none',mon:{race:'humanoid'},spells:[]});
const setup=(lv,stage)=>{
  const a=member(lv),other=member(),e=foe(),b=new Battle([a,other],[e],()=>{});
  for(const k of ['atk','vit','agi','int','pie']) if(stage) b._applyStage(e,k,stage,5,'検証の強化');
  return {a,other,e,b};
};
assert.equal(PASSIVES.hermitIori.label,'無心の境地'); assert.equal(PASSIVES.hermitIori.scope,'self');
for(const [level,lv] of [[59,0],[60,1],[104,1],[105,2],[154,2],[155,3]]) assert.equal(jobLevelPassives('hermit',level).hermitIori||0,lv);
for(let lv=0;lv<=3;lv++) for(let stage=-3;stage<=3;stage++) {
  const {a,other,e,b}=setup(lv,stage), effective=stage>0?Math.max(0,stage-lv):stage, control=setup(0,effective);
  const saved=JSON.stringify(e.effects),buffs=JSON.stringify(e.buffs);
  for(const k of ['atk','vit','agi','int','pie']) {
    near(b._bm(e,k,a),stageMul(effective)); near(b._bm(e,k,other),stageMul(stage)); near(b._bm(e,k),stageMul(stage));
  }
  near(b._eatk(e,a),control.b._eatk(control.e)); near(b._evit(e,a),control.b._evit(control.e));
  // 本人の攻防のAGI判定も、敵の強化を減らした対照戦闘と一致する。
  near(b._missP(e,a),control.b._missP(control.e,control.a)); near(b._missP(a,e),control.b._missP(control.a,control.e));
  // 実際の通常攻撃と見積もりの両方に、VIT・STRの強化無視を適用。
  near(b.estPhys(a,e,{acc:1}),control.b.estPhys(control.a,control.e,{acc:1}));
  near(b._physical(a,e,{acc:1}).dmg,control.b._physical(control.a,control.e,{acc:1}).dmg);
  near(b._physical(e,a,{acc:1}).dmg,control.b._physical(control.e,control.a,{acc:1}).dmg);
  // 呪文の敵VITによる軽減も、本人が使った場合だけ差し引く。
  near(b.estSpell(a,SPELLS.HALITO,e),control.b.estSpell(control.a,SPELLS.HALITO,control.e));
  const cast=(x)=>x.b._exec({actor:x.a,action:'spell',spellKey:'HALITO',target:x.e}).hits[0].dmg;
  near(cast({a,b,e}),cast(control));
  assert.equal(JSON.stringify(e.effects),saved); assert.equal(JSON.stringify(e.buffs),buffs);
}
// 敵の全体ブレス・全体呪文は対象別に計算。無心を持たない仲間の被害は元の強化どおり。
for(let lv=1;lv<=3;lv++) for(const kind of ['breath','spell']) {
  const x=setup(lv,3),c=setup(0,3-lv),baseline=setup(0,3);
  const cast=({b,e})=>b._exec({actor:e,action:'breath',kind}).hits;
  const hits=cast(x),ref=cast(c),normal=cast(baseline);
  near(hits[0].dmg,ref[0].dmg); near(hits[1].dmg,normal[1].dmg); assert(hits[0].dmg<hits[1].dmg);
}
// 写し身が使うINT/PIE基準の呪文も、同じ敵の同じ技で対象別に適用。
for(const spellKey of ['MAHALITO','HOLYLIGHT']) {
  for(let lv=1;lv<=3;lv++) {
    const x=setup(lv,3),c=setup(0,3-lv),baseline=setup(0,3);
    const cast=({b,e,a})=>b._exec({actor:e,action:'mimic',spellKey,target:a}).hits[0].dmg;
    near(cast(x),cast(c)); assert(cast(x)<cast(baseline));
  }
}
{
  const {a,other,e,b}=setup(3,3);
  // 属性耐性・溜め・挑発・魔法壁・防御は能力の段ではない。元の効果を保つ。
  for(const [k,v] of [['charge',2],['r_fire',.7],['taunt',3]]) { b._applyMod(e,k,v,3,'対象外'); near(b._bm(e,k,a),v); }
  const before=b._physical(a,e,{acc:1}).dmg; e._defending=true; const guarded=b._physical(a,e,{acc:1}).dmg; assert(guarded<before);
  // 本人が受ける強化と、段ではない敵の倍率を維持する。
  b._applyStage(a,'atk',2,3,'味方の加護'); near(b._bm(a,'atk',e),1.5);
  e.buffs.atk*=1.2; near(b._bm(e,'atk',a),1.2); near(b._bm(e,'atk',other),1.75*1.2);
  // 保存後も敵の段と本人だけの効果を復元する。
  const copy=Object.assign(Object.create(Battle.prototype),refDeserialize(refSerialize(b))); copy.log=()=>{};
  near(copy._bm(copy.enemies[0],'atk',copy.party[0]),1.2); near(copy._bm(copy.enemies[0],'atk',copy.party[1]),1.75*1.2);
}
console.log('無心の境地: Lv60/105/155・全5能力±3段・本人のみ・物理/呪文/ブレス/写し身・命中回避・見積もり・対象外・保存 OK');
