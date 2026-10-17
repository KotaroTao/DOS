// 未開示の無効・低ダメージの節約・戦闘停滞の回帰検査。
import assert from 'node:assert/strict';
import { Battle, SPELLS, setElemKnown } from '../../src/combat.js';
import { decideAuto, setResistKnown, autoCombatStalled, resetAutoProgress } from '../../src/autotactics.js';
import { makeDoll } from '../../src/souls.js';
import { zeroResists } from '../../src/resistance.js';
import { bindRngState, rngState } from '../../src/rng.js';
import { applySavePatch, refSerialize, refDeserialize } from '../../src/savegraph.js';
const added={
 AUTO_FIRE:{kind:'atk',target:'enemy',power:50,element:'fire'},
 AUTO_PARA:{kind:'debuff',target:'enemy',para:.8},
 AUTO_POISON:{kind:'debuff',target:'enemy',poison:{chance:.8,pct:.1}},
 AUTO_HIT:{kind:'phys',target:'enemy',power:2,para:.8},
 AUTO_MIX:{kind:'debuff',target:'enemy',para:.8,sleepChance:.8},
 AUTO_WIDE:{kind:'atk',target:'all-enemy',power:50,element:'fire'},
 AUTO_MULTI:{kind:'phys',target:'enemy',power:2,hits:8,acc:1},
 AUTO_HEALHIT:{kind:'atk',target:'enemy',power:50,partyHeal:50},
 AUTO_DEATH:{kind:'debuff',target:'enemy',instakill:{chance:1}},
};
for(const [k,sp] of Object.entries(added))SPELLS[k]={name:k,mp:10,...sp};
const actor=(mods={})=>Object.assign(makeDoll('検証'),{jobLv:40,level:40,hp:1000,maxhp:1000,mp:1000,maxmp:1000,atk:100,vit:50,agi:40,int:100,pie:100,luk:8,soulMp:0,tactic:'all',spells:[],passiveMap:{},...mods});
let uid=10000;
const foe=(mods={})=>({uid:++uid,name:'未開示の敵',key:'bs_review',mon:{race:'humanoid'},side:'enemy',lv:40,hp:10000,maxhp:10000,atk:100,vit:50,agi:30,resists:zeroResists(),element:'none',alive:true,...mods});
const setup=(am={},es=[foe()])=>{const a=actor(am),b=new Battle([a],es,()=>{});return {a,b,e:es[0]};};
const pick=(x)=>{const dbg=[];return {plan:decideAuto(x.b,x.a,dbg),dbg};};
const candidate=(x,k)=>pick(x).dbg.find(c=>c.spellKey===k);
setElemKnown(()=>false);setResistKnown(()=>false);
try{
 let x=setup({spells:['AUTO_FIRE']},[foe({physResist:100})]);assert.equal(pick(x).plan.spellKey,'AUTO_FIRE');
 x=setup({spells:['AUTO_FIRE']},[foe({magResist:100})]);assert.equal(pick(x).plan.action,'attack');
 x=setup({spells:['AUTO_FIRE','AUTO_PARA'],tactic:'bal'},[foe({physResist:100,magResist:100,resists:{...zeroResists(),paralyze:100}})]);
 assert(pick(x).plan.idle,'全て無効ならMPを使わず防御');
 for(const killsKnown of [false,true]){
  setResistKnown(()=>killsKnown);
  x=setup({spells:['AUTO_PARA','AUTO_HIT'],tactic:'bal'},[foe({resists:{...zeroResists(),paralyze:100}})]);
  assert(!candidate(x,'AUTO_PARA'));assert(candidate(x,'AUTO_HIT').dmg>0);assert.equal(candidate(x,'AUTO_HIT').stat,0);
 }
 setResistKnown(()=>false);
 x=setup({spells:['AUTO_MIX'],tactic:'bal'},[foe({resists:{...zeroResists(),paralyze:100}})]);assert(candidate(x,'AUTO_MIX').stat>0,'複合効果の有効な方を残す');
 const partial=setup({spells:['AUTO_PARA'],tactic:'bal'},[foe({resists:{...zeroResists(),paralyze:80}})]);
 const none=setup({spells:['AUTO_PARA'],tactic:'bal'});
 assert.equal(candidate(partial,'AUTO_PARA').stat,candidate(none,'AUTO_PARA').stat,'部分抵抗は未開示のまま');
 for(const tactic of ['all','bal','life','save','blade']){
  x=setup({spells:['AUTO_FIRE'],tactic},[foe({vit:1e8})]);
  assert.equal(pick(x).plan.action,'attack',`${tactic}: 1ダメージのためだけにMPを使わない`);
  assert.equal(x.a.mp,1000);
 }
 x=setup({spells:['AUTO_FIRE','AUTO_MULTI']},[foe({vit:1e8})]);assert.equal(pick(x).plan.spellKey,'AUTO_MULTI','1段1ダメージでも連撃の合計で削れる');
 x=setup({spells:['AUTO_FIRE'],atk:1},[foe({vit:1e8,hp:1})]);
 assert.equal(pick(x).plan.spellKey,'AUTO_FIRE','1ダメージの呪文で確実にとどめ');assert(pick(x).plan.effectiveAttack);
 x=setup({spells:['AUTO_HEALHIT'],hp:10},[foe({vit:1e8})]);assert.equal(pick(x).plan.spellKey,'AUTO_HEALHIT','有効な回復の追加効果は残す');
 x=setup({spells:['AUTO_HIT'],tactic:'bal'},[foe({vit:1e8})]);assert(candidate(x,'AUTO_HIT').stat>0,'1ダメージでも状態異常は別評価');
 x=setup({spells:['AUTO_PARA'],tactic:'bal'},[foe({vit:1e8,resists:{...zeroResists(),paralyze:100}})]);assert(!candidate(x,'AUTO_PARA'));
 // ほぼ削れない別の敵より、削れる敵を優先する。
 const wall=foe({vit:1e8}),soft=foe();x=setup({},[wall,soft]);assert.equal(pick(x).plan.target,soft);
 // 未開示の不利相性で1まで落ちる場合だけ実値で下げ、有利属性の先読みはしない。
 x=setup({spells:['AUTO_FIRE'],int:0},[foe({affinity:{weak:[],resist:['fire']},vit:260})]);
 const k=x.b.estSpell(x.a,SPELLS.AUTO_FIRE,x.e),v=x.b.estSpell(x.a,SPELLS.AUTO_FIRE,x.e,{actual:true});
 assert(k>v);assert(v<=2);assert.equal(candidate(x,'AUTO_FIRE').raw,v);
 x=setup({spells:['AUTO_FIRE']},[foe({affinity:{weak:['fire'],resist:[]}})]);
 assert.equal(candidate(x,'AUTO_FIRE').raw,x.b.estSpell(x.a,SPELLS.AUTO_FIRE,x.e),'未開示の弱点で加点しない');
 // 金属を通常攻撃・会心で倒す選択肢は残る。
 x=setup({spells:['AUTO_MULTI']},[foe({metal:3,hp:100000})]);assert(pick(x).plan.effectiveAttack);
 // 3ターンの停滞。ターン内の再描画で数えを進めない。
 x=setup({},[foe({vit:1e8,hp:10000,maxhp:10000})]);
 assert(!autoCombatStalled(x.b));
 for(let n=1;n<=3;n++){x.b._roundNo++;x.e.hp--;assert.equal(autoCombatStalled(x.b),n===3);assert(!autoCombatStalled(x.b),'同じターンは重ねない');}
 resetAutoProgress(x.b);assert(!autoCombatStalled(x.b),'再開したオートは数え直す');
 // 有効な攻撃の連続ミス・金属への会心待ちでは止めない。
 for(const mods of [{vit:0},{metal:3,hp:100000,maxhp:100000}]){
  x=setup({},[foe(mods)]);assert(!autoCombatStalled(x.b));
  for(let n=0;n<8;n++){x.b._roundNo++;assert(!autoCombatStalled(x.b));}
 }
 // HPが十分減る・敵を倒す・編成が変わる場合は停滞をリセットする。
 for(const change of ['damage','kill','summon']){
  x=setup({},[foe({vit:1e8}),foe({vit:1e8})]);autoCombatStalled(x.b);
  x.b._roundNo++;autoCombatStalled(x.b);x.b._roundNo++;autoCombatStalled(x.b);
  if(change==='damage')x.e.hp-=100;
  if(change==='kill')x.e.alive=false;
  if(change==='summon')x.b.enemies.push(foe({vit:1e8}));
  x.b._roundNo++;assert(!autoCombatStalled(x.b),change);
 }
 // クラウドの応答はBattleの同一性を保ち、観測も途切れない。観測は保存データに入らない。
 x=setup({},[foe({vit:1e8})]);autoCombatStalled(x.b);
 const state={party:[x.a],battle:x.b},before=JSON.stringify(refSerialize(state));
 x.b._roundNo++;autoCombatStalled(x.b);
 const packet=refDeserialize(refSerialize({snapshot:state}));applySavePatch(state,packet);
 x.b._roundNo++;assert(!autoCombatStalled(x.b));x.b._roundNo++;assert(autoCombatStalled(x.b));
 assert(!before.includes('weak')&&!before.includes('autoProgress'));
 bindRngState({seed:12345,pos:0});const rngBefore=JSON.stringify(rngState()),stateBefore=JSON.stringify(refSerialize(state));
 for(let n=0;n<10;n++)decideAuto(x.b,x.a);
 assert.equal(JSON.stringify(rngState()),rngBefore);assert.equal(JSON.stringify(refSerialize(state)),stateBefore,'判断は読み取り専用');
 console.log('未開示の無効/部分抵抗/属性、5作戦のMP節約、とどめ/連撃/会心/追加効果、停滞3ターン/誤停止防止/再開/クラウド/乱数非消費を確認');
}finally{for(const k of Object.keys(added))delete SPELLS[k];setElemKnown(null);setResistKnown(null);}
