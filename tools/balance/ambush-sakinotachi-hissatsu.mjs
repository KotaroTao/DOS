// 待ち伏せ・先の太刀・必殺・斬鉄: 各ランクと、実処理/見積もりの境界を確認する。
import assert from 'node:assert/strict';
import { Battle, SPELLS, physicalCritMul, gearCritMul, openingRates, setElemKnown } from '../../src/combat.js';
import { makeDoll, passivesUpTo, jobLevelPassives, PASSIVES } from '../../src/souls.js';
import { useMathRandom } from '../../src/rng.js';
useMathRandom(); Math.random = () => .5; setElemKnown(null);
const near = (a,b) => assert(Math.abs(a-b)<1e-8, `${a} != ${b}`);
const member = (passiveMap={}) => Object.assign(makeDoll('検証の人業'), {
  level:40,jobLv:40,atk:1000,vit:60,agi:100,int:1000,pie:100,luk:8,
  hp:100000,maxhp:100000,mp:100000,maxmp:100000,passiveMap,critBonus:0,
});
const foe = () => ({uid:100000,name:'検証の敵',side:'enemy',alive:true,
  hp:1e9,maxhp:1e9,atk:20,vit:30,agi:30,int:30,pie:30,luk:8,lv:40,
  element:'none',mon:{race:'humanoid'},spells:[],});
assert.equal(PASSIVES.hunterSaihai.label,'待ち伏せ');
assert.equal(PASSIVES.initiative.label,'先の太刀');
assert(!jobLevelPassives('samurai',19).initiative);
assert.equal(jobLevelPassives('samurai',20).initiative,1);
for(let rank=1;rank<=5;rank++) {
  const lv=Math.max(0,rank-1), bonus=[0,.05,.10,.15,.20][lv];
  assert.equal(passivesUpTo('hunter',rank).hunterSaihai||0,lv);
  near(openingRates(.08,.08,lv).pre,.08+bonus);
  near(openingRates(0,0,lv).pre,bonus);
  // 奇襲率が極端に高くても先制率の固定加算を保つ。1000個の均等な乱数で検査。
  if(lv) {
    const {pre,amb}=openingRates(0,2,lv);
    near(pre,bonus); near(amb+pre,1);
    let first=0;
    for(let i=0;i<1000;i++){const r=(i+.5)/1000;if(r>=amb&&r<amb+pre)first++;}
    assert.equal(first,bonus*1000);
  }
}
near(openingRates(.95,.8,4).pre,1);
near(openingRates(.95,.8,4).amb,0);

// 先の太刀: 個々の敵の行動前/行動後を見分け、次のターンで戻る。
{
  const a=member({initiative:1}),t=foe(),u={...foe(),uid:100001};
  const b=new Battle([a],[t,u],()=>{});
  const sum=tgt=>b._perkSum(a,'deal',{tgt,on:['phys']});
  near(sum(t),.15); near(sum(u),.15);
  assert.equal(b._perkSum(a,'deal',{tgt:t,on:['spell']}),0);
  const estBefore=b.estPhys(a,t,{acc:1}), rawBefore=b._physical(a,t,{acc:1}).dmg;
  b._exec({actor:t,action:'defend'});t._defending=false;
  near(sum(t),0);near(sum(u),.15);
  const estAfter=b.estPhys(a,t,{acc:1}),rawAfter=b._physical(a,t,{acc:1}).dmg;
  near(estBefore/estAfter,1.15);
  assert(Math.abs(rawBefore-rawAfter*1.15)<=1);
  b._startRound();near(sum(t),.15);
  b.current=t;t._nailed=true;b.enemyAct();near(sum(t),0);
  b._startRound();near(sum(t),.15);
  // 行動済みの印は保存往復で残り、新しい戦闘では消える。
  b._exec({actor:t,action:'defend'});
  assert.equal(JSON.parse(JSON.stringify(t))._actedRound,b._roundNo);
  const next=new Battle([a],[t],()=>{});
  near(next._perkSum(a,'deal',{tgt:t,on:['phys']}),.15);
}

// 必殺: 物理会心倍率を乗算。通常の打撃と攻撃呪文は増えず、即死もしない。
for(let lv=0;lv<=4;lv++) {
  const mul=1+([0,.20,.30,.40,.50][lv]);
  const sample=(critical=false,spell=false,gear=0,eye=0)=>{
    const a=member(lv?{shadowHissatsu:lv,vitalEye:eye}:{vitalEye:eye});
    a.critDamageBonus=gear;
    const t=foe(),b=new Battle([a],[t],()=>{});
    const estimate=spell?b.estSpell(a,SPELLS.HOLYRAY,t):b.estPhys(a,t,{acc:1,critBonus:critical?1:0});
    const res=spell?b._exec({actor:a,action:'spell',spellKey:'HOLYRAY',target:t})
      :b._physical(a,t,{acc:1,critBonus:critical?1:0});
    return {dmg:spell?res.hits[0].dmg:res.dmg,estimate,a,b,t};
  };
  const normal=sample(),critical=sample(true),geared=sample(true,false,.3,2);
  near(physicalCritMul(critical.a),mul);
  assert.equal(critical.dmg,Math.floor(normal.dmg*1.85*mul));
  assert.equal(geared.dmg,Math.floor(normal.dmg*1.85*1.3*mul*1.45));
  near(geared.b.peekStats(geared.a).critMul,1.85*1.3*mul*1.45);
  near(gearCritMul(critical.a,true),1);
  // 実ダメージとオート予測を、同じ通常/会心の比率で比較。
  assert(critical.estimate>normal.estimate);
  const {a,b,t}=sample();
  Math.random=()=>0;
  b._rankOnHit(a,t,1,false);
  assert(t.hp>0,'必殺による確率即死は廃止');
  Math.random=()=>.5;
  const clean=member(),target=foe(),plain=new Battle([clean],[target],()=>{});
  const spellHit=plain._exec({actor:clean,action:'spell',spellKey:'HOLYRAY',target});
  assert.equal(sample(false,true).dmg,spellHit.hits[0].dmg,'必殺は攻撃呪文に乗らない');
}
for(let lv=1;lv<=4;lv++) {
  const a=member({samuraiZantetsu:lv}),b=new Battle([a],[foe()],()=>{});
  near(b._physPierce(a),lv*.1);
}
console.log('待ち伏せ: 各ランクの固定加算・奇襲との境界、先の太刀: 行動/手番喪失/次ターン/保存、必殺: 会心/装備/急所読み/表示/即死廃止、斬鉄10〜40% OK');
