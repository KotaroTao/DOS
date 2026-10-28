// Lv差補正・抵抗値・付与条件・表示用の予測と実判定を照合する。
import assert from 'node:assert/strict';
import { Battle, SPELLS, lvRate, spellAilments, LV_HALF } from '../../src/combat.js';
import { makeDoll } from '../../src/souls.js';
import { zeroResists } from '../../src/resistance.js';
import { useMathRandom } from '../../src/rng.js';
useMathRandom();
const a=Object.assign(makeDoll('検証の人業'),{jobLv:100,level:100,hp:10000,maxhp:10000,mp:10000,maxmp:10000});
const e={uid:9999,name:'検証の敵',side:'enemy',key:'ev_rate',mon:{race:'humanoid'},alive:true,hp:1e7,maxhp:1e7,atk:1,vit:1,agi:1,lv:100,resists:zeroResists()};
const b=new Battle([a],[e],()=>{});
const near=(v,w)=>assert(Math.abs(v-w)<1e-10,`${v} != ${w}`);
assert.equal(LV_HALF,12);
for(const [diff,expected] of [[-24,.6],[-12,.6],[0,.6],[12,.6]])near(lvRate(.6,100+diff,100),expected);
assert(lvRate(.6,96,100)>.47,'4Lv差で半減しない');
assert.equal(lvRate(.6,1,200),.6);assert.equal(lvRate(.6,200,1),.6);
assert.equal(lvRate(0,200,1),0);
const cases=[
 ['poison',{poison:{chance:.6,pct:.1}},t=>t.ailment==='poison'],
 ['paralyze',{para:.6},t=>t.ailment==='paralyze'],
 ['sleep',{sleepChance:.6},t=>t.asleep],
 ['charm',{charm:.6},t=>t.mind==='charm'],
 ['confuse',{confuse:.6},t=>t.mind==='confuse'],
 ['seal',{seal:{chance:.6,turns:3}},t=>b._bm(t,'seal')<1],
 ['flinch',{flinchChance:.6},t=>t._flinch],
 ['death',{instakill:{chance:.6}},t=>!t.alive],
];
const reset=()=>{e.alive=true;e.hp=e.maxhp;e.asleep=false;e.mind=null;e.ailment=null;e._flinch=false;e._poisonPct=null;e.effects=[];e._ailN=null;e.boss=false;delete e.metal;delete a.gearMisc;a.passiveMap={};b._recalcBuffs(e);};
const savedRandom=Math.random;
try {
 for(const [kind,sp,applied] of cases)for(const diff of [-12,0,12])for(const resist of [0,40,100]){
  reset();a.jobLv=100+diff;e.resists={...zeroResists(),[kind]:resist};
  const expected=(kind==='flinch'?.6:lvRate(.6,a.jobLv,100))*(1-resist/100);
  near(b.spellStatusChances(a,sp,e)[0].rate,expected);
  near(b.spellStatusChances(a,sp,e,false)[0].rate,kind==='flinch'?.6:lvRate(.6,a.jobLv,100));
  // 閾値のすぐ上下の乱数で、表示した1回の成功率と実際の付与が一致する。
  for(const success of [false,true]){
   reset();Math.random=()=>success?Math.max(0,expected-1e-6):Math.min(.999999,expected+1e-6);
   b._inflict(a,e,sp,[]);
   assert.equal(!!applied(e),success&&expected>0,`${kind} 差${diff} 抵抗${resist}`);
  }
 }
 reset();a.jobLv=80;e.resists={...zeroResists(),sleep:100};a.gearMisc={binder:true};
 near(b.spellStatusChances(a,{sleepChance:.6},e,false)[0].rate,.9);
 assert.equal(b.spellStatusChances(a,{sleepChance:.6},e)[0].rate,0,'縛り目も無効耐性は抜けない');
 near(b.spellStatusChances(a,{instakill:{chance:.6}},e)[0].rate,lvRate(.6,80,100));
 reset();e.boss=true;
 assert.equal(b.spellStatusChances(a,{instakill:{chance:1}},e)[0].rate,0);
 assert.equal(b.spellStatusChances(a,{flinchChance:1},e)[0].rate,0);
 reset();e.metal=1;
 for(const [,sp] of cases)assert.equal(b.spellStatusChances(a,sp,e,false)[0].rate,0);
 reset();e.ailment='poison';e.asleep=true;e.mind='charm';
 for(const sp of [{para:1},{sleepChance:1},{charm:1},{confuse:1},{poison:{chance:1,pct:.05}}])assert.equal(b.spellStatusChances(a,sp,e)[0].rate,0);
 reset();assert.equal(b.spellStatusChances(a,{instakill:{chance:1,races:['dragon']}},e)[0].rate,0);
 // 同じ枠を使う複合効果は、先の付与成功を後の確率から差し引く。
 for(const [sp,checks] of [[{poison:{chance:.5,pct:.1},para:.6},[['poison',.5],['paralyze',.3]]],[{charm:.4,confuse:.6},[['charm',.4],['confuse',.36]]]]){
  reset();a.jobLv=100;e.resists=zeroResists();
  const rates=b.spellStatusChances(a,sp,e);
  for(const [kind,expected] of checks)near(rates.find(r=>r.kind===kind).rate,expected);
  let seed=27182;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const counts={};
  for(let i=0;i<6000;i++){reset();b._inflict(a,e,sp,[]);const kind=e.ailment||e.mind;counts[kind]=(counts[kind]||0)+1;}
  for(const [kind,expected] of checks)assert(Math.abs((counts[kind]||0)/6000-expected)<.025,kind);
 }
 reset();e.physResist=100;assert.equal(b.spellStatusChances(a,{kind:'phys',para:1},e)[0].rate,0);delete e.physResist;
 e.magResist=100;assert.equal(b.spellStatusChances(a,{kind:'atk',instakill:{chance:1}},e)[0].rate,0);delete e.magResist;
 // 全技の予測は読み取り専用。未知の抵抗を調べても乱数を消費しない。
 Math.random=()=>{throw new Error('成功率表示が乱数を消費した');};
 const before=JSON.stringify([a,e]);
 for(const sp of Object.values(SPELLS))for(const known of [true,false]){
  const rates=b.spellStatusChances(a,sp,e,known);
  assert.equal(rates.length,spellAilments(sp).length);
  for(const r of rates)assert(Number.isFinite(r.rate)&&r.rate>=0&&r.rate<=1);
 }
 assert.equal(JSON.stringify([a,e]),before);
} finally {Math.random=savedRandom;}
console.log('Lv差補正なし・付与力と最終上限、8種×Lv差×抵抗値の予測と実判定、主/金属/付与済み/種族制限/縛り目、全技の読み取り専用予測を確認');
