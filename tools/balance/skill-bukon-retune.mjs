// 武魂との併用で会心率が上限でも、職業の会心威力・条件・予測が働くことを確認。
import assert from 'node:assert/strict';
import {Battle,SPELLS,COUNTER_K,REFLECT_K,stanceMulOf,stanceCtrK} from '../../src/combat.js';
import {makeDoll,PASSIVES} from '../../src/souls.js';
import {JOBKIT_PERKS} from '../../src/jobkit/index.js';
import {useMathRandom} from '../../src/rng.js';
useMathRandom();Math.random=()=>0;
const member=pm=>Object.assign(makeDoll('検証'),{level:40,atk:100,vit:100,int:100,pie:100,agi:100,luk:8,hp:1e7,maxhp:1e7,mp:1e6,maxmp:1e6,soulMp:0,passiveMap:pm,critBonus:.8,spellCritBonus:.8});
const foe=()=>({uid:888,name:'検証の敵',side:'enemy',alive:true,hp:1e9,maxhp:1e9,atk:100,vit:0,agi:1,int:0,pie:0,luk:0,level:40,lv:40,element:'none',spells:[]});
const fixture=(pm={},gear=0)=>{const a=member(pm),t=foe(),b=new Battle([a],[t],()=>{});a.critDamageBonus=a.spellCritDamageBonus=gear;return {a,t,b};};
const near=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);
for(const [key,values] of [['samuraiIchibun',[.1,.2,.3]],['samuraiNukimi',[.15,.25,.4]],['shadowIchishi',[.15,.25,.4]]])for(let lv=1;lv<=3;lv++)for(const gear of [0,.5,2]){
 const {a,t,b}=fixture({[key]:lv},gear),base=fixture({},gear),bonus=values[lv-1];
 near(b._physicalCritMul(a,{tgt:t,on:['phys']}),1+gear+bonus);
 const opt={sureHit:true,critBonus:1,basic:true};
 const predicted=b.estPhys(a,t,opt)/base.b.estPhys(base.a,base.t,opt);
 near(predicted,(1+gear+bonus)/(1+gear));
 const normal=base.b._physical(base.a,base.t,opt).dmg,changed=b._physical(a,t,opt).dmg;
 assert(Math.abs(changed-normal*(1+gear+bonus)/(1+gear))<=2,'物理実測も同じ倍率');
 near(b._physicalCritMul(a,{tgt:t,on:['spell']}),1+gear);
 if(key==='samuraiNukimi'){b._roundNo=2;near(b._physicalCritMul(a,{tgt:t,on:['phys']}),1+gear);}
 if(key==='shadowIchishi'){t.hp=t.maxhp*.89;near(b._physicalCritMul(a,{tgt:t,on:['phys']}),1+gear);t.hp=t.maxhp*.9;near(b._physicalCritMul(a,{tgt:t,on:['phys']}),1+gear+bonus);}
 if(key==='samuraiIchibun')near(b.peekStats(a).critMul,1.85*(1+gear+bonus));
}
for(const [key,values] of [['spellCrit',[.1,.2,.3]],['arcanistShinen',[.1,.15,.2,.3]]])for(let lv=1;lv<=values.length;lv++)for(const gear of [0,.5,2]){
 const {a,t,b}=fixture({[key]:lv},gear),base=fixture({},gear),bonus=values[lv-1],sp=SPELLS.SHADOWBOLT;
 near(b._spellCritChance(a,sp),.8);near(b._spellCritMul(a),1.5*(1+gear+bonus));near(b.peekStats(a).spellCritMul,b._spellCritMul(a));
 const expected=(1+.8*(1.5*(1+gear+bonus)-1))/(1+.8*(1.5*(1+gear)-1));
 near(b.estSpell(a,sp,t)/base.b.estSpell(base.a,sp,base.t),expected);
 const hp=t.hp,bhp=base.t.hp;b._cast(a,{spellKey:'SHADOWBOLT',target:t},{hits:[]});base.b._cast(base.a,{spellKey:'SHADOWBOLT',target:base.t},{hits:[]});
 assert(Math.abs((hp-t.hp)-(bhp-base.t.hp)*(1+gear+bonus)/(1+gear))<=2,'呪文実測も同じ倍率');
}
{
 const {a,b}=fixture({spellCrit:3,arcanistShinen:4},2);near(b._spellCritMul(a),1.5*3.6);
}
assert.deepEqual(COUNTER_K,[0,.5,.75,1]);assert.equal(REFLECT_K,8);
assert.deepEqual(JOBKIT_PERKS.guardianHoufuku.fx[0].ret.k,[5,10,15]);
for(let lv=1;lv<=3;lv++){
 const {a,t,b}=fixture({guardianHoufuku:lv});const before=t.hp;b._perkHurt(a,t,1,'phys');assert.equal(before-t.hp,Math.round(b._evit(a)*[5,10,15][lv-1]));
 const counter=fixture({counter:lv});counter.a.critBonus=0;Math.random=()=>.99;const hp=counter.t.hp;counter.b._tryCounter(counter.a,counter.t);assert(counter.t.hp<hp);Math.random=()=>0;
}
for(const [key,mul] of [['HANGEKI',2],['GONOSEN',1.8],['FUDOUJIN',3]]){
 assert.equal(stanceMulOf(SPELLS[key]),mul);const {a,b}=fixture();b._cast(a,{spellKey:key,target:a},{hits:[]});near(stanceCtrK(a),mul);
}
{
 const {a,t,b}=fixture({reflect:1});a._barrierLeft=1;const hp=t.hp;b._execInner({actor:t,action:'breath',kind:'spell'});assert.equal(hp-t.hp,a.int*8);
}
for(const [key,field,power] of [['SEAL','seal',1.2],['SEALALL','seal',.9],['MIWAKU','charm',1],['KUGUTSU','charm',1.1],['KEISEI','charm',.7],['GENWAKU','confuse',1.1],['KYOURAN','confuse',.8]]){
 const sp=SPELLS[key];assert.equal(field==='seal'?sp.seal.chance:sp[field],power);
 const {a,t,b}=fixture();t.resists={seal:40,charm:40,confuse:40};near(b._rate(a,t,power,field),Math.min(.95,power*.6));
}
assert.deepEqual(PASSIVES.necroLegion.lv,["自分の手番の終わりに、ランダムな敵へ INT×5 の固定ダメージを1回 (金属の魔物には効かない)","自分の手番の終わりに、ランダムな敵へ INT×5 の固定ダメージを2回 (金属の魔物には効かない)","自分の手番の終わりに、ランダムな敵へ INT×5 の固定ダメージを3回 (金属の魔物には効かない)"]);
console.log('採用案：反撃6種・会心5種の全Lv/装備3段階/条件/実測と予測/表示・状態異常7種・据置きを確認');
