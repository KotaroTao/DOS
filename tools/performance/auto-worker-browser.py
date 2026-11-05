"""実Workerと同期版の作戦・対象・入力不変を比較する。"""
import os
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROME_BIN','/usr/bin/chromium'),args=['--no-sandbox'])
 page=b.new_page();page.goto('http://localhost:8000/effects-lab.html')
 print(page.evaluate('''async()=>{
 const {Battle,SPELLS,setElemKnown,setPartyHitBonus,setPartyEvadeBonus,setPartyBreathBonus,setPartyAilBonus}=await import('/src/combat.js');
 const {makeDoll,setSkillGate}=await import('/src/souls.js');
 const {decideAuto,setResistKnown,TACTICS}=await import('/src/autotactics.js');
 const {planAuto,autoPlannerStats}=await import('/src/auto-planner.js');
 const {refSerialize,refDeserialize}=await import('/src/savegraph.js');const {rngState}=await import('/src/rng.js');
 let cases=0;
 const compact=p=>JSON.stringify({...p,target:p.target?[p.target.side,p.target.uid]:null,targetUid:undefined,targetSide:undefined});
 for(const tac of TACTICS)for(const known of [false,true])for(const injured of [false,true,'revive']){
  const party=Array.from({length:6},(_,i)=>Object.assign(makeDoll('検査'+i),{uid:100+i,level:100,jobLv:100,atk:100,int:200,pie:180,agi:100,vit:100,hp:injured?100:10000,maxhp:10000,mp:10000,maxmp:10000,spells:['ZANKOU','DIOS','MAHALITO','GOKUENRAN','HYOUGA','TORNADO','RAIJIN','CHOUHATSU'],tactic:tac.key}));
  for(const a of party)a.spells.push(...Object.entries(SPELLS).filter(([k,s])=>['buff','debuff','revive','cure','mana'].includes(s.kind)).slice(0,24).map(([k])=>k));
  if(injured==='revive'){party[3].alive=false;party[3].hp=0;}
  party[1].autoOff=['GOKUENRAN'];party[2].skillOff=['DIOS'];
  const enemies=Array.from({length:3},(_,i)=>({uid:300+i,side:'enemy',alive:true,key:'test',mon:{race:'undead'},hp:10000,maxhp:10000,atk:150,agi:30,vit:100,lv:100,element:'fire'}));
  const battle=new Battle(party,enemies,()=>{}),actor=party[0];
  setElemKnown(()=>known);setResistKnown(()=>known);setPartyHitBonus(.02);setPartyEvadeBonus(.01);setPartyBreathBonus(.05);setPartyAilBonus({paralyze:.05});setSkillGate(k=>k!=='RAIJIN');
  const before=JSON.stringify(refSerialize(battle)),random=JSON.stringify(rngState());
  const expected=decideAuto(battle,actor),actual=await planAuto(battle,actor,()=>known,()=>{throw Error('Workerから同期処理へ戻った');});
  if(compact(actual)!==compact(expected))throw Error(tac.key+' '+known+' '+injured+' '+compact(actual)+' != '+compact(expected));
  if(JSON.stringify(refSerialize(battle))!==before||JSON.stringify(rngState())!==random)throw Error('入力か乱数が変化');
  if(actual.target&&![...party,...enemies].includes(actual.target))throw Error('対象が本体参照へ戻っていない');cases++;
 }
 // 袋と読込中の絵を増やしても、作戦の入力が膨らまず、元の保存は欠けない。
 const party=Array.from({length:3},(_,i)=>Object.assign(makeDoll('袋の検査'),{uid:600+i,hp:1000,maxhp:1000,mp:100,maxmp:100,atk:100,agi:100,tactic:'blade'}));
 const enemy={uid:900,side:'enemy',alive:true,key:'test',mon:{race:'undead'},hp:10000,maxhp:10000,atk:1,agi:1,vit:10,lv:1};
 const b=new Battle(party,[enemy],()=>{}),a=party[0];
 const weapon={...(Object.values((await import('/src/items.js')).ITEMS).find(i=>i.slot==='weapon'))};a.equip.weapon=weapon;
 const expected=await planAuto(b,a,()=>true,()=>{throw Error('同期復帰');}),nodes=autoPlannerStats.nodes;
 const bag=Array.from({length:6000},(_,i)=>({uid:i,key:'保存検査',name:'袋の品'+i,mods:{atk:i%4},description:'作戦には不要な説明'.repeat(8)}));
 bag[0]=weapon;
 for(const p of party)p.items=bag;
 // 除外は値を読む前に行い、素材の読込状態にも触れない。
 Object.defineProperty(enemy.mon,'photo',{enumerable:true,configurable:true,get(){throw Error('作戦が絵を読み込んだ');}});
 const actual=await planAuto(b,a,()=>true,()=>{throw Error('大きな袋で同期復帰');});
 if(compact(actual)!==compact(expected)||autoPlannerStats.nodes!==nodes||party.some(p=>p.items!==bag))throw Error('袋の除外で作戦か本体が変化');
 delete enemy.mon.photo;
 for(const compact of [false,true]){
  const restored=refDeserialize(refSerialize({battle:b,party,bag},{compact}));
  if(restored.bag.length!==6000||restored.party.some(p=>p.items!==restored.bag)||restored.battle.party!==restored.party||restored.party[0].equip.weapon!==restored.bag[0])throw Error('通常の保存から所持品や共有参照が欠けた');
 }
 const payload={nodes,withBag:autoPlannerStats.nodes,bagItems:bag.length,fullNodes:refSerialize({battle:b,actor:a}).heap.length};
 const original=window.Worker;window.Worker=class{constructor(){throw Error('検査用のWorker不可');}};
 try{const fallback=await import('/src/auto-planner.js?fallback-test');let calls=0;
  const plan=await fallback.planAuto(null,null,null,()=>{calls++;return {action:'defend'};});
  if(calls!==1||plan.action!=='defend')throw Error('Worker不可時の復帰');
 }finally{window.Worker=original;}
 return {cases,payload,...autoPlannerStats};
 }'''));b.close()
