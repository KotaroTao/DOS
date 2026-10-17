// 気配断ち: 習得・端数を保つ標的抽選・隊列/挑発・全体攻撃/標的固定を確認。
import assert from 'node:assert/strict';
import { Battle } from '../../src/combat.js';
import { makeDoll, jobLevelPassives, PASSIVES } from '../../src/souls.js';
import { useMathRandom } from '../../src/rng.js';
useMathRandom(); Math.random=()=>.5;
const near=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const member=(lv=0)=>Object.assign(makeDoll('気配の検証'),{
  atk:100,vit:60,agi:100,int:100,pie:100,luk:8,hp:100000,maxhp:100000,
  mp:1000,maxmp:1000,passiveMap:lv?{stealthStep:lv}:{},
});
const foe=()=>({uid:100000,name:'検証の敵',side:'enemy',alive:true,
  hp:1e9,maxhp:1e9,atk:100,vit:30,agi:30,int:100,pie:30,luk:8,lv:40,
  element:'none',mon:{race:'humanoid'},spells:[]});
assert.equal(PASSIVES.stealthStep.label,'気配断ち');
assert.equal(PASSIVES.stealthStep.scope,'self');
for(const [level,expected] of [[14,0],[15,1],[49,1],[50,2],[99,2],[100,3]]) {
  assert.equal(jobLevelPassives('shadow',level).stealthStep||0,expected);
}
for(let lv=0;lv<=3;lv++) {
  const a=member(lv),other=member(),b=new Battle([a,other],[foe()],()=>{});
  const factor=[1,.8,.65,.5][lv],chance=factor/(factor+1);
  near(b._targetWeight(a),3*factor);
  near(b._targetWeight(other),3);
  // 実際の抽選を境界の両側で確認。20%・35%も丸めず効く。
  Math.random=()=>chance-1e-9;assert.equal(b._pickPartyTarget(),a);
  Math.random=()=>chance+1e-9;assert.equal(b._pickPartyTarget(),other);
  // 一人だけなら、気配を断っていても必ず標的になる。
  other.alive=false;
  for(const r of [0,.5,.999999]){Math.random=()=>r;assert.equal(b._pickPartyTarget(),a);}
  other.alive=true;
  // 挑発の重みと乗算し、溜めた大技の引き受けは変えない。
  a.buffs.taunt=3;near(b._targetWeight(a),9*factor);assert.equal(b._tauntHolder(),a);
  a.buffs.taunt=1;
  // 槍ぶすまの既に固定された狙いは、次の抽選で逃れない。
  b.focus=true;b._focusT=a;Math.random=()=>.999999;assert.equal(b._pickPartyTarget(),a);
  b.focus=false;
  // 全体ブレス・全体呪文は全員に当たり、気配断ちで傷は減らない。
  Math.random=()=>.5;
  for(const kind of ['breath','spell']) {
    const res=b._exec({actor:b.enemies[0],action:'breath',kind});
    assert.equal(res.hits.length,2);
    assert.equal(res.hits[0].dmg,res.hits[1].dmg);
    assert(res.hits.every(h=>h.dmg>0));
  }
}
{
  const party=[member(),member(),member(),member(2)],b=new Battle(party,[foe()],()=>{});
  near(b._targetWeight(party[3]),.65); // 後列は基礎1、前列は基礎3
  near(b._targetWeight(party[0]),3);
  party[3].passiveMap={stealthStep:2,taunt:1};near(b._targetWeight(party[3]),1.95);
}
console.log('気配断ち: Lv15/50/100・標的重み20/35/50%軽減・本人のみ・端数・隊列/挑発・一人/標的固定・全体ブレス/呪文 OK');
