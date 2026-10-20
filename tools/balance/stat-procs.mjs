// 武器の成長を受けない追撃・反撃: 実ダメージ、段階、耐性、発動制限を確認する。
import assert from 'node:assert/strict';
import { Battle, SPELLS, reflectPow, KAESHI_K, REFLECT_K } from '../../src/combat.js';
import { makeDoll, passiveDesc } from '../../src/souls.js';
import { MONSTERS } from '../../src/sprites.js';
import { DUNGEON_MONSTERS } from '../../src/dungeons/index.js';
import { useMathRandom } from '../../src/rng.js';
Object.assign(MONSTERS, DUNGEON_MONSTERS);
useMathRandom(); Math.random = () => 0;
let uid = 100000, cases = 0;
function fixture(stat = 100, level = 100, extra = {}) {
  const a = Object.assign(makeDoll('追撃の検証'), { level, atk: stat, int: stat, pie: stat, vit: stat,
    agi: 100, hp: 1e9, maxhp: 1e9, mp: 10000, maxmp: 10000, passiveMap: {} });
  const e = { uid: uid++, name: '検証の敵', key: 'bs_ghoul', mon: MONSTERS.bs_ghoul, side: 'enemy',
    alive: true, hp: 1e9, maxhp: 1e9, atk: 100, vit: 0, agi: 1, int: 100, pie: 100, luk: 8,
    level, lv: level, element: 'none', spells: [], ...extra };
  const b = new Battle([a], [e], () => {});
  return {a,e,b};
}
function damage(e, fn) { const hp = e.hp; fn(); cases++; return hp - e.hp; }
for (const level of [20,100,200]) for (const stat of [100,992]) {
  // 固定ダメージは魔法耐性・防御に依らず、金属には発動しない。
  for (const lv of [1,2,3]) for (const resist of [0,75,100]) {
    const {a,e,b} = fixture(stat,level,{magResist:resist,vit:10000});
    a.passiveMap = {necroLegion:lv}; const res = {hits:[]};
    assert.equal(damage(e,()=>b._necroLegion(a,res)), Math.round(stat*5)*lv);
    assert.equal(res.hits.length,lv); assert.equal(a.mp,10000);
    a.passiveMap = {dkEnchant:lv}; res.hits=[];
    assert.equal(damage(e,()=>b._afterBasic(a,e,{dmg:1},res)), Math.round(stat*[0,8,12,16][lv]));
    assert.equal(res.hits.length,1); assert.equal(a.mp,10000);
  }
  for (const [key,k,run] of [
    ['twinArts',6,(b,a,e)=>b._afterBasic(a,e,{dmg:1},{hits:[]})],
    ['openSpell',12,(b)=>b._openingStrikes()],
    ['divineCounter',3,(b,a,e)=>b._tryCounter(a,e)],
  ]) for (const resist of [0,50,100]) {
    const {a,e,b}=fixture(stat,level,{magResist:resist}); a.passiveMap={[key]:1};
    assert.equal(damage(e,()=>run(b,a,e)),Math.round(Math.round(stat*k)*(1-resist/100)));
    assert.equal(a.mp,10000);
  }
  for (const [key,ks,kind] of [
    ['darkknightKaeshiba',[1.5,2.25,3],'phys'],
    ['guardianHoufuku',[1.5,2.5,3.5],'phys'],
    ['wardenJusogaeshi',[2,2.5,3],'spell'],
  ]) for (let lv=1;lv<=3;lv++) {
    const {a,e,b}=fixture(stat,level); a.passiveMap={[key]:lv};
    assert.equal(damage(e,()=>b._perkHurt(a,e,100,kind)),Math.round(stat*ks[lv-1]),key);
    assert.equal(damage(e,()=>b._perkHurt(a,e,100,kind)),Math.round(stat*ks[lv-1]),'受けるたび発動');
  }
  for (let lv=1;lv<=3;lv++) {
    const {a,e,b}=fixture(stat,level);a.passiveMap={inquisitorShinmonNirami:lv};
    b._roundNo=2;e.hp=1e8;
    assert.equal(damage(e,()=>b._enemyHealed(e,e.hp-1)),Math.round(stat*[0,5,8,12][lv]));
    assert.equal(damage(e,()=>b._enemyHealed(e,e.hp-1)),0,'同じ敵は1ターン1回');
    b._roundNo++;
    assert.equal(damage(e,()=>b._enemyHealed(e,e.hp)),0,'実際に回復していない時は不発');
  }
  for (const k of [...KAESHI_K,REFLECT_K]) {
    const {a,e,b}=fixture(stat,level,{magResist:50});
    assert.equal(damage(e,()=>b._retaliate(a,e,'int',k,'検証',true)),Math.round(Math.round(stat*k)*.5));
  }
}
// 強化した連続追撃で倒しても、死者を殴り続けず次の敵へ移る。
{
 const {a,e,b}=fixture(100);a.passiveMap={necroLegion:3};e.hp=100;
 const e2={...e,uid:uid++,name:'次の敵',hp:100};b.enemies.push(e2);
 const res={hits:[]};b._necroLegion(a,res);
 assert.equal(res.hits.length,2);assert.equal(res.hits[0].target,e);assert.equal(res.hits[1].target,e2);
 assert(res.hits.every(h=>h.died));assert.equal(b.result,'win');cases++;
}
{
 const {a,e,b}=fixture();a.passiveMap={necroLegion:3};a.alive=false;
 assert.equal(damage(e,()=>b._necroLegion(a,{hits:[]})),0,'倒れた術者からは発動しない');
}
for (const key of ['necroLegion','dkEnchant']) {
  const {a,e,b}=fixture(992,100,{key:'metal',mon:{metal:true},metal:true});a.passiveMap={[key]:3};
  assert.equal(damage(e,()=>key==='necroLegion'?b._necroLegion(a,{hits:[]}):b._afterBasic(a,e,{dmg:1},{hits:[]})),0);
}
// 外れた通常攻撃では追撃せず、物理無効なら魔力付与も不発。
for (const h of [{miss:true},{immune:true}]) {
  const {a,e,b}=fixture();a.passiveMap=h.immune?{dkEnchant:3}:{dkEnchant:3,twinArts:1};
  assert.equal(damage(e,()=>b._afterBasic(a,e,h,{hits:[]})),0);
}
{
 const {a,e,b}=fixture(400);a.pie=500;
 b._cast(a,{spellKey:'WARDEN_UTSUSHIGAESHI',target:null},{hits:[]});
 assert.equal(reflectPow(a),2000,'映し返しは唱えた者の高い方の能力×4');
 assert(SPELLS.WARDEN_UTSUSHIGAESHI.desc.includes('×4'));
 for (const [key,lv,text] of [['necroLegion',3,'INT×5'],['dkEnchant',3,'INT×16'],['twinArts',1,'INT×6'],
   ['openSpell',1,'INT×12'],['reflect',1,'INT×3'],['divineCounter',1,'PIE×3'],
   ['guardianHoufuku',3,'VIT×3.5'],['arcthiefKaeshi',4,'INT×5'],['inquisitorShinmonNirami',3,'PIE×12']])
   assert(passiveDesc(key,lv).includes(text),`${key}: 説明と実装の倍率`);
}
console.log(`能力依存の追撃・反撃 ${cases}条件: Lv20/100/200・能力100/992・各段階・耐性・無料追撃・反応回数・金属無効・説明を確認`);
