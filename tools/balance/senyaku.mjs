// 仙薬の割合・持続・重複・通常の強化との共存・道具回復量を確認。
import assert from 'node:assert/strict';
import { Battle, luckCritBonus } from '../../src/combat.js';
import { makeDoll, PASSIVES } from '../../src/souls.js';
import { refSerialize, refDeserialize } from '../../src/savegraph.js';
const keys=['atk','vit','agi','int','pie','luk'];
const member=(lv=0)=>Object.assign(makeDoll('仙薬の検証'),{atk:100,vit:100,agi:100,int:100,pie:100,luk:100,hp:1000,maxhp:1000,mp:1000,maxmp:1000,passiveMap:lv?{hermitSenyaku:lv}:{}});
let uid=100000;
const foe=()=>({uid:uid++,name:'検証の敵',side:'enemy',alive:true,hp:1e7,maxhp:1e7,atk:10,vit:10,agi:10,int:10,pie:10,luk:0,lv:40,element:'none',mon:{race:'humanoid'},spells:[]});
const near=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);
for(let lv=1;lv<=4;lv++){
 const a=member(lv),other=member(),b=new Battle([a,other],[foe()],()=>{}),rate=1+lv*.05,turns=lv>=3?3:2;
 for(const p of [a,other]){
  for(const k of keys)near(b._bm(p,k),rate);
  assert.equal(p.effects.filter(e=>e.stat==='allStats').length,1);
  assert.equal(p.effects.find(e=>e.stat==='allStats').turns,turns);
  assert.equal(p.maxhp,1000);assert.equal(p.maxmp,1000);
  assert.equal(b.peekStats(p).stats.luk,Math.round(100*rate));
  near(b.peekStats(p).crit,.06+luckCritBonus(100*rate));
 }
 assert(PASSIVES.hermitSenyaku.lv[lv-1].includes(`${lv*5}%`));
 assert(PASSIVES.hermitSenyaku.lv[lv-1].includes(`${turns}ターン`));
 // 通常の能力強化と別枠にし、仙薬の期限で通常の強化まで消さない。
 b._applyMod(other,'atk',1.25,5,'検証');near(b._bm(other,'atk'),1.25*rate);
 const restored=refDeserialize(JSON.parse(JSON.stringify(refSerialize(other.effects))));
 other.effects=restored;b._recalcBuffs(other);near(b._bm(other,'int'),rate);
 for(let n=1;n<turns;n++){b._tickEffects();near(b._bm(a,'int'),rate);}
 b._tickEffects();for(const k of keys)near(b._bm(a,k),1);near(b._bm(other,'atk'),1.25);
}
{
 const low=member(1),high=member(4),other=member(),b=new Battle([low,high,other],[foe()],()=>{});
 near(b._bm(other,'int'),1.2);assert.equal(other.effects.filter(e=>e.stat==='allStats').length,1);
 // 新たな戦闘でも持続をリセットし、持ち越して積み上げない。
 b._tickEffects();new Battle([low,high,other],[foe()],()=>{});
 assert.equal(other.effects.filter(e=>e.stat==='allStats').length,1);assert.equal(other.effects.find(e=>e.stat==='allStats').turns,3);
}
{
 const dead=member(4),other=member();dead.alive=false;dead.hp=0;
 const b=new Battle([dead,other],[foe()],()=>{});near(b._bm(other,'int'),1);
}
{
 const a=member(4),other=member(),b=new Battle([a,other],[foe()],()=>{});
 a.hp=100;a.mp=100;
 const item={id:'check_senyaku',name:'検査用の薬',slot:'use',use:{heal:100,mp:50}};
 a.items.push(item);b._useItem(a,{item,owner:a,target:a},{hits:[]});
 assert.equal(a.hp,200);assert.equal(a.mp,150);
 // 効果解除でも割合が残らない。
 a.effects=[];b._recalcBuffs(a);for(const k of keys)near(b._bm(a,k),1);
}
console.log('仙薬: Lv1〜4の6能力・2/3ターン・最高Lvのみ・強化併用・保存・戦闘ごとの更新・死亡者除外・道具回復を確認');
