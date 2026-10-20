// 実行経路を通して、HPの実効量・供給元・保存再開・クラウドの集計を確認する。
import assert from 'node:assert/strict';
import { Battle, SPELLS } from '../../src/combat.js';
import { makeDoll } from '../../src/souls.js';
import { MONSTERS } from '../../src/sprites.js';
import { DUNGEON_MONSTERS } from '../../src/dungeons/index.js';
import { reseedRng, rngState } from '../../src/rng.js';
import { refSerialize, refDeserialize } from '../../src/savegraph.js';
import { resolveCloudBattle } from '../../src/cloud-battle.js';
Object.assign(MONSTERS, DUNGEON_MONSTERS);
const clone = s => refDeserialize(refSerialize(s));
function setup() {
  reseedRng(54321);
  const party = [0,1,2].map(i => Object.assign(makeDoll('同じ名前'), { uid:100+i, jobKey:'fighter', hp:1000,maxhp:1000,mp:100000,maxmp:100000,atk:150,vit:30,agi:1000-i,int:120,pie:130,luk:8 }));
  const foe = { uid:900,name:'検証の敵',key:'bs_ghoul',mon:MONSTERS.bs_ghoul,side:'enemy',alive:true,hp:100000,maxhp:100000,atk:80,vit:30,agi:1,int:40,pie:40,luk:8,lv:1,element:'none',spells:[] };
  const b = new Battle(party,[foe],()=>{});
  return {b,party,foe};
}
{
  const {b,party:[a,c],foe}=setup();
  foe.hp=17; b._physical(a,foe,{acc:1});
  assert.equal(b.performanceReport().members[0].damage,17,'余剰ダメージを除外');
  a.hp=8; a.alive=true; b._physical({...foe,alive:true,hp:10000},a,{acc:1});
  assert.equal(b.performanceReport().members[0].taken,8,'被ダメージの余剰を除外');
  c.hp=998; b._perkHeal(c,.5,a); b._perkHeal(c,.5,a);
  assert.equal(b.performanceReport().members[0].healing,2,'満タン超過・空回復を除外し供給元へ');
  assert.equal(b.performanceReport().members[1].healing,0,'同名でも混ざらない');
  const report=b.performanceReport(); report.members[0].damage=999;
  assert.equal(b.performanceReport().members[0].damage,17,'結果は独立した値');
}
{
  const {b,party:[a,c],foe}=setup();
  foe.hp=17;foe.endure=true;b._physical(a,foe,{acc:1});
  assert.equal(foe.hp,1);assert.equal(b.performanceReport().members[0].damage,16,'敵が不屈で耐えたHP1は除外');
  c.hp=8;c._evSave=true;b._physical(foe,c,{acc:1});
  assert.equal(c.hp,1);assert.equal(b.performanceReport().members[1].taken,7,'味方が耐えた分も除外');
  assert.equal(b.performanceReport().members[1].healing,0,'不屈を回復に数えない');
}
{
  const {b,party:[a,c],foe}=setup();
  a.hp=100; a.lifesteal=.5; const hit=b._physical(a,foe,{acc:1});
  assert.equal(b.performanceReport().members[0].healing,a.hp-100,'吸収の自己回復');
  assert.equal(b.performanceReport().members[0].damage,hit.dmg);
  const before=foe.hp; b._retaliate(c,foe,'atk',.6,'反射',false);
  assert.equal(b.performanceReport().members[1].damage,before-foe.hp,'反撃の供給元');
}
{
  const {b,party:[a,c,d],foe}=setup();
  const regen = {name:'検証の再生',regen:{pct:.1,turns:3}};
  b._applyRegen(a,d,regen); b._applyRegen(c,d,regen);
  d.hp=990; const before=d.hp; b._startRound();
  const report=b.performanceReport();
  assert.equal(d.hp,1000); assert.equal(report.members[0].healing+report.members[1].healing,1000-before,'重複再生の実効量');
  assert.equal(report.members[2].healing,0,'再生を受けた者へ加算しない');
  assert.equal(report.members[0].healing,5); assert.equal(report.members[1].healing,5);
  foe.ailment='poison'; b._setPerformanceSource(foe,'poison',a); const hp=foe.hp;
  b._startRound(); assert.equal(b.performanceReport().members[0].damage,hp-foe.hp,'毒の付与者へ加算');
}
{
  const {b,party:[a,c],foe}=setup();
  c.alive=false;c.hp=0;
  const revive=Object.entries(SPELLS).find(([,s])=>s.revive && s.target==='ally');
  assert(revive,'蘇生技が存在する');
  b._cast(a,{spellKey:revive[0],target:c},{hits:[]});
  assert(c.hp>0);assert.equal(b.performanceReport().members[0].healing,c.hp,'蘇生で戻したHP');
  const itemTarget=a;itemTarget.hp=900;
  const item={name:'検証の薬',use:{heal:200}};a.items.push(item);
  b._useItem(a,{item,target:itemTarget},{hits:[]});
  assert.equal(b.performanceReport().members[0].healing,c.hp+100,'道具での実効回復');
}
{
  const {b,party,foe}=setup();
  b.chooseAction('attack'); b.chooseTarget(foe);
  const state={state:'combat',battle:b,party,reserve:[],souls:[],rng:[...rngState()],codex:{mon:{}},floor:1,dungeonIdx:0,gold:0,soulPts:0};
  const first=clone(state),second=clone(state);
  const packet=resolveCloudBattle(first,'commit'); resolveCloudBattle(second,'commit');
  assert(first.battle.performanceReport().members.some(m=>m.damage>0));
  assert.deepEqual(first.battle.performanceReport(),second.battle.performanceReport());
  assert.deepEqual(first.rng,second.rng);
  assert.deepEqual(packet.snapshot.battle.performance,first.battle.performance);
  const saved=clone(first);Object.setPrototypeOf(saved.battle,Battle.prototype);saved.battle.log=()=>{};
  assert.equal(saved.party[0],saved.battle.party[0]);
  const total=saved.battle.performance.members[0].damage;
  saved.battle._physical(saved.party[0],saved.battle.enemies[0],{acc:1});
  assert(saved.battle.performance.members[0].damage>total,'保存復帰後も累計');
  assert(!new Battle(party,[{...foe,alive:true,hp:100000}],()=>{}).performance.members.some(m=>m.damage),'新戦闘はゼロから');
  delete saved.battle.performance;
  assert.equal(saved.battle.performanceReport().partial,true,'更新前の戦闘は部分集計');
}
console.log('キャラ別の実効ダメージ・被ダメージ・回復・吸収・反撃・重複再生・毒・蘇生・道具・同名・保存復帰・クラウド・旧セーブ: OK');
