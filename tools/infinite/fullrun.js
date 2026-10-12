// 実ゲームの探索・報酬・育成を使う通し試験。未知の札の中身は経路選択に使わない。
window.runFull=async({seed,end=100,profile="chapter8"})=>{
 const {game}=await import('/src/ui/ctx.js');
 const {decideAuto}=await import('/src/autotactics.js');
 const {EVENT_MAP}=await import('/src/events.js');
 const {rollStartSouls}=await import('/src/abyss.js');
 const {reseedRng}=await import('/src/rng.js');
 const {tlSetOn}=await import('/src/telemetry.js');
 const {planBestEquip,applyPlan}=await import('/src/autoequip.js');
 const {SOUL_CLASSES,jobStatsOf,soulLearnedPassives,subPickCap,toggleSubPick}=await import('/src/souls.js');
 const {ITEMS,useHelps}=await import('/src/items.js');
 const G=__game.G,I=__game.inf,S=__full;
 const out={seed,reached:1,result:'complete',battles:0,rounds:0,enemyActs:0,steps:0,bought:0,used:0,checkpoints:[],choices:[],jobs:[],lastBattles:[]};
 const snap=()=>({floor:G.floor,lv:G.party.map(d=>d.jobLv),jobs:G.party.map(d=>d.jobKey),hp:G.party.map(d=>d.alive?d.hp/d.maxhp:0),mp:G.party.map(d=>d.mp/d.maxmp),gold:G.gold,soul:G.soulPts,held:G.inventory.length,souls:G.souls.length});
 window.__fullChoose=(title,opts)=>{
  const choices=opts.filter(x=>x&&!x.disabled);
  let c;
  if(title.includes('黒い泉'))c=choices.find(x=>x.label.includes('近寄らない'));
  c ||= choices.find(x=>x.primary&&!x.cancel);
  c ||= choices.find(x=>!x.cancel&&!x.danger&&!/戻る|立ち去る/.test(x.label));
  c ||= choices.find(x=>x.cancel)||choices[0];
  if(!c)throw Error('選択肢なし '+title);
  if(out.choices.length<100)out.choices.push({floor:G.floor,title,choice:c.label});
  G.prompt=false;c.fn();
 };
 const sink={mode:'board',note(){},gold(){},lost(){},interrupt(){},loot(it,who,next){if(next)__fullQueue.push(next);}};
 window.__fullResults=spec=>{const next=()=>{G.prompt=false;spec.onDone?.();};if(spec.chest?.openers.length)spec.chest.open(spec.chest.openers[0].uid,sink,next);else next();};
 const drain=()=>{for(let n=0;__fullQueue.length&&n<100;n++){if(G.state==='combat'||G.state==='simLost')break;__fullQueue.shift()();}if(__fullQueue.length>100)throw Error('画面の連鎖が多すぎる');};
 tlSetOn(false);G.events={once:{},flags:{},seen:{},picks:{},fresh:[]};for(const e of Object.values(EVENT_MAP))if(e.gift&&(profile==='all'||(profile==='chapter8'&&/^w[0-9]+$/.test(e.dungeonId)&&Number(e.dungeonId.slice(1))<=33)))G.events.once[e.id]=true;reseedRng(seed);
 const priority=['priest','samurai','knight','mage','thief','fighter','monk','bishop','sage','ranger','paladin'];
 const picks=[];
 for(let i=0;i<6;i++){const opts=rollStartSouls(picks);opts.sort((a,b)=>(priority.indexOf(a)<0?99:priority.indexOf(a))-(priority.indexOf(b)<0?99:priority.indexOf(b)));picks.push(opts[0]);}
 picks.sort((a,b)=>Number(["priest","mage","bishop","sage"].includes(a))-Number(["priest","mage","bishop","sage"].includes(b)));out.jobs=picks;if(!I.enterAbyss(picks))throw Error('出撃できない');
 for(const d of G.party)d.tactic=d.jobKey==='priest'?'life':'save';
 function equip(){applyPlan(planBestEquip(G.party));}
 function option(it,reserve=false){
  const u=it.use||{};let best={it,score:0};
  for(const t of G.party){let score=0;for(const d of u.all?G.party:[t]){
   if(u.revive){if(!d.alive)score+=10;continue;}if(!d.alive)continue;
   score+=Math.min(d.maxhp-d.hp,u.full?d.maxhp:(u.heal||0))/d.maxhp;
   score+=1.5*Math.min(reserve?d.maxmp:d.maxmp-d.mp,u.mpFull?d.maxmp:(u.mp||0))/Math.max(1,d.maxmp);
   if(u.cure&&d.ailment&&useHelps(it,d))score+=1;
  }if(score>best.score)best={it,t,score};}return best;
 }
 function useHeld(){for(let n=0;n<50;n++){const b=G.inventory.filter(it=>it.use).map(it=>option(it)).sort((a,b)=>b.score-a.score)[0];if(!b||b.score<0.4)break;const old=G.inventory.length;game.useItem(G.party[0],G.inventory.indexOf(b.it),b.it.use.all?undefined:b.t);if(old===G.inventory.length)break;out.used++;} }
 function care(){useHeld();if(G.party.some(d=>!d.alive||d.hp<d.maxhp*.65||d.ailment))S.healAll();drain();}
 function rest(){
  if(G.floor%5||G.state!=='board')return;
  // 回復役を保ち、拾った上位職をメインに育てる。
  const healers=new Set(['priest','bishop','paladin','sage','pope','saint']);
  const grade=s=>({common:1,rare:2,epic:3,legend:4}[SOUL_CLASSES[s.clsKey].rarity]||1)*100+s.count*2;
  for(const d of G.party){
   const old=S.soulByUid(d.primary),healer=healers.has(old.clsKey);
   const choices=G.souls.filter(s=>healers.has(s.clsKey)===healer&&!game.infSoulChangeBlock(d,s.uid)).sort((a,b)=>grade(b)-grade(a));
   const best=choices[0];if(best&&grade(best)>grade(old)+10){__game.ops.trainTimes(best.uid,Math.max(0,old.level-best.level));if(best.level>=old.level*.8){I.infSwapSoul(d,best.uid);d.tactic=healer?'life':'bal';}}
  }
  const held=new Set(G.party.flatMap(d=>[d.primary,...(d.subs||[]).map(s=>s.uid)]));
  for(const s of G.souls){if(held.has(s.uid))continue;const dolls=G.party.filter(d=>d.alive&&(d.subs||[]).length<2).sort((a,b)=>(a.subs||[]).length-(b.subs||[]).length);const d=dolls.find(d=>!I.infSubBlock(d,(d.subs||[]).length,s.uid));if(d){I.infSetSub(d,(d.subs||[]).length,s.uid);held.add(s.uid);}}
  for(let n=0;n<200;n++){
   const souls=G.party.map(d=>S.soulByUid(d.primary)).sort((a,b)=>a.level-b.level);let changed=false;
   for(const s of souls){if(s.level>=S.soulLevelCapOf(s)){if(S.raiseSoulCap(s.uid)===false)S.raiseSoulCap(s.uid,{by:'soul'});}const r=__game.ops.trainTimes(s.uid,1);if(r.ok){changed=true;break;}}
   if(!changed)break;
  }
  G.party.sort((a,b)=>(b.vit+b.maxhp*.15)-(a.vit+a.maxhp*.15));for(const d of G.party)for(const sub of d.subs||[]){const s=S.soulByUid(sub.uid),learned=soulLearnedPassives(s);const want=['afterMp','afterHeal','manaFlow','fieldRegen','popePrayer','poisonFloor','trapEye','dualWield'].filter(k=>learned[k]);if(want.length){sub.picks=[];sub.picked=true;for(const k of want.slice(0,subPickCap(s)))toggleSubPick(sub,'passive',k);}}I.recalcAllDolls();equip();const worn=new Set(G.party.flatMap(d=>Object.values(d.equip||{})));for(const it of [...G.inventory])if(!it.use&&!worn.has(it))I.infSell(G.party[0],it,null,true);
  care();for(let n=0;n<3;n++){
   const reserve=!G.party.some(d=>!d.alive||d.mp<d.maxmp*.7||d.hp<d.maxhp*.7);
   const b=I.infTraderWares().map(k=>ITEMS[k]).filter(it=>it.use&&!it.use.float&&game.buyPrice(it)<=G.gold).map(it=>option(it,reserve)).sort((a,b)=>b.score-a.score||game.buyPrice(a.it)-game.buyPrice(b.it))[0];
   if(!b||b.score<=0)break;const it=I.infBuy(b.it.id);if(!it)break;out.bought++;if(!reserve)care();
  }
 }
 async function battle(){
  const b=G.battle;out.lastBattles.push({...snap(),foes:b.enemies.map(e=>e.key)});if(out.lastBattles.length>8)out.lastBattles.shift();out.battles++;b.advance();let n=0;
  while(!b.result&&n++<1500&&b._roundNo<80){if(b.phase==='input'){const c=decideAuto(b,b.current),r=b.chooseAction(c.action,c.spellKey);if(r.invalid)throw Error('不正な行動');if(r.needTarget)b.chooseTarget(c.target);b.commit();}else if(b.phase==='enemy'){out.enemyActs++;b.enemyAct();}else if(b.phase==='stunned')b.stunnedAct();else throw Error('不明な戦闘段階 '+b.phase);if(!b.result)b.advance();}
  out.rounds+=b._roundNo;
  if(!b.result){out.result='timeout';return false;}
  if(b.result==='lose'){out.result='lose';out.foes=b.enemies.map(e=>({key:e.key,hp:e.hp,atk:e.atk}));return false;}
  __game.rematch.endBattle();drain();equip();return true;
 }
 let lastFloor=0;const visited=new Set();let bagMark=-1;
 for(let n=0;n<30000;n++){
  out.reached=Math.max(out.reached,G.floor);
  if(G.floor>=end){out.result='reached';break;}
  if(G.state==='simLost'||!G.party.some(d=>d.alive)){out.result='lose';break;}
  if(G.state==='combat'){if(!await battle())break;continue;}
  drain();if(G.state!=='board')continue;
  if(lastFloor!==G.floor){lastFloor=G.floor;visited.clear();if(G.floor%5===0)out.checkpoints.push(snap());rest();}
  care();if(G.inventory.length!==bagMark){equip();bagMark=G.inventory.length;}if(G.state!=='board')continue;
  // 既知の壁をたどり、最寄りの未公開札へ。階段を見つけてもこの階の探索を済ませる。
  const cells=G.board.cells.flatMap((row,y)=>row.map((c,x)=>({...c,x,y})));const unknown=cells.filter(c=>!c.revealed).map(c=>({c,p:S.findPath(c.x,c.y)})).filter(x=>x.p.length).sort((a,b)=>a.p.length-b.p.length);
  let path=unknown[0]?.p;
  if(!path){const stairs=cells.find(c=>c.type==='stairs');if(!stairs)throw Error('階段なし');path=S.findPath(stairs.x,stairs.y);
   if(!path.length){rest();if(G.floor%5===0&&G.abyss.guardFloor!==G.floor){I.fightAbyssGuard();continue;}I.descend();continue;}}
  const p=path[0];out.steps++;S.step(p.x,p.y);drain();
  if(n===29999)out.result='stepLimit';
 }
 out.final=snap();return out;
};
