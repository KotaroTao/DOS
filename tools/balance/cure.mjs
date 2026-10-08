// 限定治療・複数治療・全体治療、対象選択、オートと戦闘外の全回復を確認する。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { Battle, SPELLS, AIL_KINDS, spellCureKinds, canSpellCure, cureBySpell, healsHp, spellHealRaw, healOnTarget } from '../../src/combat.js';
import { makeDoll, SOUL_KEYS, jobSkillTable } from '../../src/souls.js';
import { decideAuto } from '../../src/autotactics.js';
import { skillDetailLines } from '../../src/ui/itemview.js';
const member = () => Object.assign(makeDoll('治療検証'), {hp:1000,maxhp:1000,mp:1000,maxmp:1000,pie:50});
const foe = () => ({uid:100000,name:'敵',side:'enemy',alive:true,hp:1000,maxhp:1000,atk:50,vit:10,agi:10,int:10,pie:10,luk:10,lv:1,effects:[]});
const setAil = (t, kind) => {
  t.ailment = ['poison','paralyze','stone'].includes(kind) ? kind : null;
  t.asleep = kind === 'sleep'; t.mind = ['charm','confuse'].includes(kind) ? kind : null;
};
assert.deepEqual(spellCureKinds(SPELLS.CURE), ['poison']);
assert(!SPELLS.CURE.purge);
const names = new Set();
for (const sp of Object.values(SPELLS)) { assert(!names.has(sp.name), sp.name); names.add(sp.name); }
let checks = 0;
for (const [key,sp] of Object.entries(SPELLS)) {
  if (!sp.cure && sp.kind !== 'cure') continue;
  for (const kind of AIL_KINDS) {
    const a=member(),t=member(),untouched=member();
    const b=new Battle([a,t,untouched],[foe()],()=>{});
    setAil(t,kind); setAil(untouched,kind);
    const actual = sp.target === 'self' ? a : t;
    setAil(actual,kind);
    const covered=spellCureKinds(sp).includes(kind);
    assert.equal(canSpellCure(sp,actual),covered,key+' '+kind);
    b._exec({actor:a,action:'spell',spellKey:key,target:t});
    assert.equal(canSpellCure({cure:true},actual),!covered,key+' '+kind);
    if(sp.target!=='all-ally') assert(canSpellCure({cure:true},untouched),key+' 単体の範囲');
    checks++;
  }
}
{
  const t=member();Object.assign(t,{ailment:'poison',_poisonPct:.1,asleep:true,mind:'confuse',_ailN:{poison:2,sleep:3,mind:4}});
  assert(cureBySpell(SPELLS.CURE,t));
  assert.equal(t._poisonPct,null);assert(t.asleep);assert.equal(t.mind,'confuse');
  assert.deepEqual(t._ailN,{sleep:3,mind:4});
}
{
  const a=member(),t=member();const b=new Battle([a,t],[foe()],()=>{});
  t.ailment='paralyze';t.effects=[{stat:'atk',mult:.8,turns:3}];
  assert.deepEqual(b._allyTargets(SPELLS.CURE),[]);
  a.spells=['CURE'];a.tactic='life';
  assert.notEqual(decideAuto(b,a).spellKey,'CURE');
  b._exec({actor:a,action:'spell',spellKey:'CURE',target:t});
  assert.equal(t.ailment,'paralyze');assert.equal(t.effects.length,1);
  t.ailment='poison';assert(b._allyTargets(SPELLS.CURE).includes(t));
}
// 標準の回復・治療 (2026-10 作り直し) の効果と、どの職でも決まった習得Lvの幅に収まること
const STD_RANGE={DIOS:[1,5],DIAL:[25,40],MADIOS:[60,80],DIOSALL:[20,30],DIALALL:[40,60],MADIOSALL:[80,120],REVIVE:[40,60],RESURRECT:[80,100],
  CURE:[3,10],RECOVER:[10,20],AWAKE:[20,30],STONECURE:[30,50],PURIFY:[60,100],CUREALL:[3,10],RECOVERALL:[10,20],AWAKEALL:[20,30],STONECUREALL:[30,50],PURIFYALL:[60,100]};
const STD_KINDS={CURE:['poison'],RECOVER:['paralyze'],AWAKE:['sleep','confuse','charm'],STONECURE:['stone'],PURIFY:AIL_KINDS};
for(const [k,kinds] of Object.entries(STD_KINDS)){
  assert.deepEqual([...spellCureKinds(SPELLS[k])].sort(),[...kinds].sort(),k);
  assert.deepEqual([...spellCureKinds(SPELLS[k+'ALL'])].sort(),[...kinds].sort(),k+'ALL');
  assert.equal(SPELLS[k].target,'ally');assert.equal(SPELLS[k+'ALL'].target,'all-ally');
}
let stdRows=0;
for(const job of SOUL_KEYS) for(const row of jobSkillTable(job)) {
  const r=STD_RANGE[row.skill]; if(!r)continue;
  assert(row.lvl>=r[0]&&row.lvl<=r[1],`${job} ${SPELLS[row.skill].name} Lv${row.lvl} (幅 ${r[0]}〜${r[1]})`);stdRows++;
}
assert(stdRows>80,'標準の技の習得が少なすぎる');
assert(skillDetailLines(SPELLS.CURE).some(x=>x.includes('毒・猛毒')));
assert(!skillDetailLines(SPELLS.CURE).some(x=>x.includes('石化')));
// game.js全体のDOM初期化を避け、実際の戦闘外関数をそのまま実行する。
const source=fs.readFileSync(new URL('../../src/game.js',import.meta.url),'utf8');
const extract = name => {const start=source.indexOf(`function ${name}(`);assert(start>=0,name);return source.slice(start,source.indexOf('\n}',start)+2);};
const context=vm.createContext({spellCureKinds,canSpellCure,cureBySpell,spellHeals:healsHp,spellHealRaw,healOnTarget,campHealPower:()=>10,CAMP_HEAL:new WeakMap(),rand:()=>0,log:()=>{},HEAL_CAST_EPS:.001});
vm.runInContext(['planHealAllDP','planHealAllGreedy','campApplyAliveMeasured'].map(extract).join('\n'),context);
const act = key => ({key,sp:SPELLS[key],cost:SPELLS[key].mp,pow:0,heals:false,cures:true,all:SPELLS[key].target==='all-ally'});
const casters=[{p:{mp:100},acts:['CURE','RECOVER','STONECURE'].map(act)}];
const plan=context.planHealAllDP([0,0,0],['poison','paralyze','stone'],casters);
assert(plan);assert.equal(plan.steps.length,3);
for (const step of plan.steps) assert(spellCureKinds(step.k.sp).includes(['poison','paralyze','stone'][step.t]));
assert.equal(context.planHealAllDP([0],['stone'],[{p:{mp:100},acts:[act('CURE')]}]),null);
assert.equal(context.planHealAllGreedy([0],['stone'],[{p:{mp:100},acts:[act('CURE')]}]),null);
const group=[{p:{mp:100},acts:['HERMIT_YAKUSOUARAI','AWAKEALL'].map(act)}];
assert.equal(context.planHealAllGreedy([0,0],['poison','stone'],group).length,1);
assert.equal(context.planHealAllGreedy([0,0],['poison','confuse'],group).length,2);
const t=member();t.ailment='stone';
assert.equal(context.campApplyAliveMeasured(member(),SPELLS.CURE,t),false);assert.equal(t.ailment,'stone');
t.ailment='poison';t._poisonPct=.1;
assert(context.campApplyAliveMeasured(member(),SPELLS.CURE,t));assert.equal(t.ailment,null);assert.equal(t._poisonPct,null);
console.log(`全治療技×6異常 (${checks}条件)・単体/全体・対象選択・オート・習得段階・表示・戦闘外の実処理と全回復計画を確認`);
