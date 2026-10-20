// 今の有効打を捨てる退行と、図鑑の進展による実際の攻めの改善を確認する。
import assert from 'node:assert/strict';
import { Battle, SPELLS, setElemKnown } from '../../src/combat.js';
import { decideAuto, setResistKnown } from '../../src/autotactics.js';
import { makeDoll } from '../../src/souls.js';
import { game } from '../../src/ui/ctx.js';
import { enemyReveal } from '../../src/ui/itemview.js';
import { reseedRng } from '../../src/rng.js';

const specs = {
  INT_FIRE: { kind:'atk', target:'enemy', power:100, element:'fire' },
  INT_ICE: { kind:'atk', target:'enemy', power:100, element:'ice' },
  INT_HIT: { kind:'phys', target:'enemy', power:3, acc:1 },
  INT_WIDE: { kind:'atk', target:'all-enemy', power:100, element:'fire' },
  INT_POISON: { kind:'debuff', target:'enemy', poison:{chance:1,pct:.1} },
  INT_SCATTER: { kind:'phys', target:'all-enemy', power:100, scatter:2, acc:1 },
};
for (const [k,sp] of Object.entries(specs)) SPELLS[k] = { name:'検証の技', mp:1, ...sp };
let uid=50000;
const doll=(mods={})=>Object.assign(makeDoll('検証'),{atk:10,int:100,pie:1,agi:100,vit:100,luk:8,
  level:40,jobLv:40,hp:10000,maxhp:10000,mp:1000,maxmp:1000,soulMp:0,passiveMap:{},spells:[],tactic:'all',...mods});
const foe=(mods={})=>({uid:uid++,key:'int_test',name:'検証の敵',mon:{race:'humanoid'},side:'enemy',alive:true,
  hp:10000,maxhp:10000,atk:20,vit:10,agi:10,lv:40,element:'none',...mods});
const setup=(mods={},enemies=[foe()],others=[])=>{const a=doll(mods),b=new Battle([a,...others],enemies,()=>{});return {a,b};};
const pick=x=>{const dbg=[];const plan=decideAuto(x.b,x.a,dbg);return {plan,dbg};};
const actual=(x,p)=>p.spellKey ? x.b.estSpell(x.a,SPELLS[p.spellKey],p.target,{actual:true}) : x.b.estBasic(x.a,p.target,{actual:true});
game.G={codex:{mon:{int_test:{kills:0}}}};
setElemKnown(e=>enemyReveal(e).stats);setResistKnown(e=>enemyReveal(e).lore);
try {
  // 後の味方が同じターンに倒せても、弱い通常攻撃へ落とさない。
  for(const tactic of ['all','bal','life']) {
    const x=setup({spells:['INT_FIRE'],tactic},[foe({hp:500})],[doll({atk:2000})]);
    assert.equal(pick(x).plan.spellKey,'INT_FIRE',tactic);
  }
  // 単体/全体、物理技、敵HPでの頭打ちを同じ尺度で比べる。
  assert.equal(pick(setup({spells:['INT_FIRE','INT_WIDE']},[foe(),foe()])).plan.spellKey,'INT_WIDE');
  assert.equal(pick(setup({atk:300,int:1,spells:['INT_FIRE','INT_HIT']})).plan.spellKey,'INT_HIT');
  assert.equal(pick(setup({spells:['INT_WIDE'],tactic:'bal'},[foe({hp:1})])).plan.action,'attack','過剰な攻撃にMPを使わない');
  {
    const x=setup({atk:1000,spells:['INT_SCATTER']},[foe({hp:10}),foe({hp:10})]);
    const c=pick(x).dbg.find(c=>c.spellKey==='INT_SCATTER');
    assert(Math.abs(c.raw-15)<1e-8,'乱撃2発を2体への確実なとどめと見積もらない');
  }
  // 同じ敵・同じ技でも、通常敵5体で開く属性の記録により選択が変わる。
  const elem=setup({spells:['INT_ICE','INT_FIRE']},[foe({affinity:{weak:['fire'],resist:['ice']}})]);
  const unknown=pick(elem).plan;assert.equal(unknown.spellKey,'INT_ICE');
  game.G.codex.mon.int_test.kills=4;assert.equal(pick(elem).plan.spellKey,'INT_ICE');
  game.G.codex.mon.int_test.kills=5;
  const known=pick(elem).plan;assert.equal(known.spellKey,'INT_FIRE');
  assert(actual(elem,known)>actual(elem,unknown)*2,'開示された弱点を突いて実効ダメージを増やす');
  // 部分的な物理/魔法抵抗は10体で開く。未開示時に実値を先読みしない。
  for(const type of ['physResist','magResist']) {
    game.G.codex.mon.int_test.kills=9;
    const x=setup({spells:['INT_FIRE']},[foe({[type]:80})]);
    const magic=x.b.estSpell(x.a,SPELLS.INT_FIRE,x.b.enemies[0],{resistKnown:false});
    x.a.atk=magic*(type==='physResist'?1.3:0.8);
    const before=pick(x).plan;
    assert.equal(before.action,type==='physResist'?'attack':'spell');
    const scores=pick(x).dbg.map(c=>c.score);
    x.b.enemies[0][type]=0;assert.deepEqual(pick(x).dbg.map(c=>c.score),scores,'非開示の部分抵抗で採点を変えない');
    x.b.enemies[0][type]=80;
    game.G.codex.mon.int_test.kills=10;
    const after=pick(x).plan;
    assert.equal(after.action,type==='physResist'?'spell':'attack');
    assert(actual(x,after)>actual(x,before)*2,'開示された抵抗を避けて実効ダメージを増やす');
  }
  {
    game.G.codex.mon.int_test.kills=10;
    const x=setup({spells:['INT_POISON']},[foe({hp:100000,maxhp:100000})]);
    assert.equal(pick(x).plan.spellKey,'INT_POISON','全力も3ターンの毒の有効打を使う');
    game.G.codex.mon.int_test.kills=9;
    x.a.spells=['INT_FIRE'];x.b.enemies[0].magWeak=3;const scores=pick(x).dbg.map(c=>c.score);
    x.b.enemies[0].magWeak=1;assert.deepEqual(pick(x).dbg.map(c=>c.score),scores);
  }
  // 慧眼は図鑑未開示でも既存の特性どおりに選べる。
  game.G.codex.mon.int_test.kills=0;elem.a.gearMisc={insight:1};assert.equal(pick(elem).plan.spellKey,'INT_FIRE');
  // 実行系でも比較する。同じ乱数種・同じ敵で、図鑑の充実後は短い手数で倒す。
  function fight(kills,seed) {
    game.G.codex.mon.int_test.kills=kills;reseedRng(seed);
    const x=setup({spells:['INT_ICE','INT_FIRE']},[foe({hp:1600,maxhp:1600,affinity:{weak:['fire'],resist:['ice']}})]);
    let actions=0,spent=0;x.b.advance();
    while(!x.b.result&&actions<40) {
      if(x.b.phase==='input') {
        const p=pick(x).plan,mp=x.a.mp,r=x.b.chooseAction(p.action,p.spellKey);
        assert(!r.invalid);if(r.needTarget)x.b.chooseTarget(p.target);x.b.commit();actions++;spent+=mp-x.a.mp;
      } else if(x.b.phase==='enemy')x.b.enemyAct();
      else if(x.b.phase==='stunned')x.b.stunnedAct();
      if(!x.b.result)x.b.advance();
    }
    assert.equal(x.b.result,'win');return {actions,spent};
  }
  let before=0,after=0;
  for(let seed=1;seed<=10;seed++){const u=fight(0,seed),k=fight(5,seed);assert(k.actions<u.actions);assert(k.spent<u.spent);before+=u.actions;after+=k.actions;}
  console.log(`有効打の退行、単体/全体/物理/乱撃/過剰ダメージ、図鑑4→5・9→10体、未開示の部分抵抗・弱点の非参照、慧眼を確認。実戦10戦の行動数: 図鑑未開示${before}→属性開示${after}`);
} finally {for(const k of Object.keys(specs))delete SPELLS[k];setElemKnown(null);setResistKnown(null);delete game.G;}
