// 全出来事の実際の選択肢を通し、訪問・立ち去り・実行を区別する。
import assert from 'node:assert/strict';
import { EVENTS, runEvent, eventFightWon } from '../../src/events.js';
import { useMathRandom } from '../../src/rng.js';
useMathRandom();
let choicesTested = 0;
function fixture(ok) {
  const member = {uid:'a', name:'検証の器', hp:50, maxhp:100, mp:10, maxmp:100, ailment:'poison', atk:100, int:100, pie:100, luk:100};
  const state = {opts:[], seen:0, picked:0, flags:{}, floor:{mods:[]}, run:{mods:[]}, fight:null};
  const A = {
    layer:1, aliveList:()=>[member], deadList:()=>[{...member, alive:false}],
    randomAlive:()=>member, best:()=>member, appraiser:()=>member,
    check:()=>({ok,who:member,p:0.5}), checkDisarm:()=>({ok,who:member,p:0.5}),
    canPayGold:()=>true, canPaySoul:()=>true, goldCost:x=>x, soulCost:x=>x,
    innCost:()=>10, repairCost:()=>10, embers:()=>100, price:()=>10,
    countCells:()=>10, monsterKeysLeft:()=>['bs_ghoul'], eliteKeyHere:()=> 'bs_ghoul',
    monName:()=> '古強者', poolKey:()=> 'bs_ghoul', itemNameOf:()=> '品', wares:()=>['herb','manaDrop'],
    flags:()=>state.flags, floorEv:()=>state.floor, runEv:()=>state.run,
    sense:()=>true, icon:()=>null,
    choice:(_title,opts)=>{state.opts=opts;},
    seen:(_e,cell)=>{if (!cell.evSeen) {cell.evSeen=true; state.seen++;}},
    picked:()=>{state.picked++;},
    done:(cell,next)=>{cell.cleared=true; next?.();},
    fight:(cell,_spec,tag)=>{state.fight=cell; cell.evFight={tag};},
    alarm:(_title,_lines,_icon,next)=>next?.(),
    gift:(_title,_lines,_icon,_options,next)=>next?.(),
    story:(_title,_lines,next)=>next?.(),
  };
  for (const k of ['back','toast','log','sfx','flash','refresh','recalcPermanent','payGold','paySoul','payEmber','healAll','hurtAll','hurtAllCur','hurtOne','ail','ailAll','cureAll','mpAll','revive','gold','soul','ember','giveGoldRaw','giveSoulRaw','revealStairs','revealWhere','warmCorpse','skipFloors','warpToStairs','removeMonsters','clearMonsters','clearPoison','reviveMonsters','floodHalf','purgeBeasts','placeChest','trap','reopen','refight']) A[k]=()=>{};
  for (const k of ['item','itemMinRar','soulDrop','collectible']) A[k]=(_o,_from,next)=>next?.();
  A.giveItemId=(_id,next)=>next?.();
  A.chestHere=(_cell,_o,next)=>next?.();
  A.openChestAt=()=>{};
  return {A,state};
}
for (const ok of [false,true]) {
  Math.random=()=>ok?0:0.999;
  for (const event of EVENTS) {
    const {A,state}=fixture(ok), cell={evId:event.id};
    runEvent(A,cell);
    assert(cell.evVisited,event.id);
    if(event.gift) {
      assert.equal(state.seen,1,event.id);
      runEvent(A,cell); assert.equal(state.seen,1,'極の再表示: '+event.id);
      continue;
    }
    assert.equal(state.seen,0,'踏んだだけ: '+event.id);
    assert.equal(state.picked,0,'選ぶ前: '+event.id);
    for(let i=0;i<state.opts.length;i++) {
      const f=fixture(ok), c={evId:event.id}; runEvent(f.A,c);
      const option=f.state.opts[i];
      option.fn();
      assert.equal(f.state.seen,option.cancel?0:1,event.id+'/'+option.label);
      assert.equal(f.state.picked,option.cancel?0:1,event.id+'/'+option.label);
      if(f.state.fight) eventFightWon(f.A,c,()=>{});
      choicesTested++;
    }
  }
}
console.log(`全${EVENTS.length}出来事・${choicesTested}選択/分岐: 訪問は未登録・立ち去りは未登録・実行と極の恵みで登録 OK`);
