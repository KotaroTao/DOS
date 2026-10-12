// ブラウザー検証専用。通しの到達率ではなく、固定編成の10階連戦と補給の比較。
window.runInfStress = async ({seed, endFloor, rank=3, limit=3}) => {
  const {game}=await import('/src/ui/ctx.js');
  const {Battle,cloneItem}=await import('/src/combat.js');
  const {decideAuto,setResistKnown}=await import('/src/autotactics.js');
  const {SOUL_CLASSES,rankThresholds,soulLevelCap,setSharedSouls,recalcDoll}=await import('/src/souls.js');
  const {ITEMS,useHelps}=await import('/src/items.js');
  const {planBestEquip,applyPlan}=await import('/src/autoequip.js');
  const {infLevel,rollInfRule}=await import('/src/abyss.js');
  const {reseedRng,random}=await import('/src/rng.js');
  const {tlSetOn}=await import('/src/telemetry.js');
  const G=__game.G, inf=__game.inf, sim=window.__stress;
  tlSetOn(false);reseedRng(seed);setResistKnown(()=>true);
  G.state='town';G.abyss=null;G.party=[];G.reserve=[];G.inventory=[];G.souls=[];setSharedSouls(G.souls);
  G.events={once:{},flags:{}};
  const jobs=['fighter','knight','samurai','priest','mage','thief'];
  if(!inf.enterAbyss(jobs))throw Error('出撃できない');
  const level=Math.round(infLevel(endFloor));
  for(const s of G.souls){s.count=rankThresholds(SOUL_CLASSES[s.clsKey].rarity)[rank-1];s.level=level;s.capBonus=Math.max(0,level-soulLevelCap(s.clsKey,s.count));s.exp=0;}
  inf.recalcAllDolls();
  for(const d of G.party)d.tactic=d.jobKey==='priest'?'life':'bal';
  G.floor=endFloor-10;G.abyss.depth=G.floor;G.abyss.rule=null;G.specialFloor=null;G.mutator=null;G.run=sim.newRun();
  // 区間末の推奨Lvを持つ隊へ、区間入口で拾える品50点から最適装備。途中の装備更新はしない。
  for(let i=0;i<50;i++){const it=cloneItem(inf.pickLoot());if(it){inf.markDungeonLoot(it);G.inventory.push(it);}}
  applyPlan(planBestEquip(G.party));G.inventory.length=0;
  for(const d of G.party){d.hp=d.maxhp;d.mp=d.maxmp;d.alive=true;}
  G.gold=1000000;
  const initial=G.party.map(d=>({job:d.jobKey,hp:d.maxhp,mp:d.maxmp,atk:d.atk,vit:d.vit,agi:d.agi,equip:Object.values(d.equip).filter(Boolean).map(it=>it.id)}));
  const out={seed,endFloor,rank,limit,level,initial,reached:endFloor-10,cleared:endFloor-10,battles:0,rounds:0,enemyActs:0,zeroDamage:0,bought:0,used:0,purchases:{},checkpoints:[],rules:[],result:'complete'};
  const totals=()=>({hp:G.party.reduce((n,d)=>n+(d.alive?d.hp:0),0)/G.party.reduce((n,d)=>n+d.maxhp,0),mp:G.party.reduce((n,d)=>n+(d.alive?d.mp:0),0)/G.party.reduce((n,d)=>n+d.maxmp,0),dead:G.party.filter(d=>!d.alive).length});
  // 一番足りない資源を優先し、同じ効き目なら安い品を選ぶ。蘇生を最優先。
  function option(it, reserve=false){
    const u=it.use||{};let best=null;
    for(const t of G.party){
      const targets=u.all?G.party:[t];let score=0;
      for(const d of targets){
        if(u.revive){if(!d.alive)score+=10;continue;}
        if(!d.alive)continue;
        if(u.heal||u.full)score+=Math.min(Math.max(0,d.maxhp-d.hp),u.full?d.maxhp:u.heal)/d.maxhp;
        if(u.mp||u.mpFull)score+=1.5*Math.min(Math.max(0,d.maxmp-d.mp),u.mpFull?d.maxmp:u.mp)/Math.max(1,d.maxmp);
        if(u.cure&&d.ailment&&useHelps(it,d))score+=0.7;
      }
      if(reserve&&(u.mp||u.mpFull))score=targets.reduce((n,d)=>n+Math.min(d.maxmp,u.mpFull?d.maxmp:u.mp)/Math.max(1,d.maxmp),0);
      if(!best||score>best.score)best={it,t,score};
    }
    return best;
  }
  function useHeld(){
    for(let j=0;j<50;j++){
      const best=G.inventory.map(it=>option(it)).sort((a,b)=>b.score-a.score)[0];
      if(!best||best.score<0.3)break;
      const before=G.inventory.length;game.useItem(G.party[0],G.inventory.indexOf(best.it),best.it.use?.all?undefined:best.t);
      if(G.inventory.length===before)break;out.used++;
    }
  }
  function shop(initial=false){
    useHeld();
    const cap=initial?3:limit;
    for(let i=0;i<cap;i++){
      const opts=inf.infTraderWares().map(id=>ITEMS[id]).filter(it=>!it.use?.float).map(it=>option(it,initial));
      opts.sort((a,b)=>b.score-a.score||game.buyPrice(a.it)-game.buyPrice(b.it));
      const best=opts[0];if(!best||best.score<0.05)break;
      // 無制限は比較用だけ購入済み数を戻す。金貨・個別購入・使用効果は実際の処理。
      if(limit>3&&!initial)G.abyss.supplyBought[G.floor]=0;
      const it=inf.infBuy(best.it.id);if(!it)break;
      out.bought++;out.purchases[it.id]=(out.purchases[it.id]||0)+1;
      if(!initial){
        const before=G.inventory.length;game.useItem(G.party[0],G.inventory.indexOf(it),it.use?.all?undefined:best.t);
        if(G.inventory.length===before)throw Error('購入した道具を使えない '+it.id);
        out.used++;
      }
    }
  }
  shop(true);
  for(let f=endFloor-9;f<=endFloor;f++){
    G.floor=f;G.abyss.depth=f;G.state='board';out.reached=f;
    if((f-1)%5===0){G.abyss.rule=rollInfRule(random,f,G.abyss.rule);out.rules.push(G.abyss.rule);}
    for(let encounter=0;encounter<3+(f%5===0?1:0);encounter++){
      G.state='board';useHeld();
      const boss=encounter===3;
      if(boss)shop();
      const cfg=inf.abyssCfg(), pool=cfg.pool;
      const foes=boss?inf.infBossFoes(inf.infFoeKey(7)):inf.spawnCardEnemies(pool[Math.floor(random()*pool.length)],f,inf.enemyScale(),{});
      const hp0=totals().hp;
      __game.startBattle(foes,{type:boss?'stairs':'monster',monsterKey:foes[0].key});
      const b=G.battle;if(!(b instanceof Battle))throw Error('戦闘が始まらない');
      b.advance();let acts=0;
      while(!b.result&&acts++<1200&&b._roundNo<=60){
        if(b.phase==='input'){
          const c=decideAuto(b,b.current),r=b.chooseAction(c.action,c.spellKey);
          if(r.invalid)throw Error('不正なオート行動 '+JSON.stringify(c));
          if(r.needTarget)b.chooseTarget(c.target);b.commit();
        }else if(b.phase==='enemy'){out.enemyActs++;b.enemyAct();}
        else if(b.phase==='stunned')b.stunnedAct();
        else throw Error('未知の段階 '+b.phase);
        if(!b.result)b.advance();
      }
      out.battles++;out.rounds+=b._roundNo;if(totals().hp>=hp0)out.zeroDamage++;
      if(b.result!=='win'){out.result=b.result||'timeout';out.failedFloor=f;out.boss=boss;out.foes=b.enemies.map(e=>e.name);out.end=totals();return out;}
      sim.applyVictoryPassives();
      // 戦闘だけの異常・防御を解く。探索移動と罠、出来事、成長はこの比較には含めない。
      for(const d of G.party){d._defending=false;d.asleep=false;d.mind=null;}
      G.battle=null;G.battleCell=null;G.state='board';
    }
    out.cleared=f;
    if(f%5===0)out.checkpoints.push({floor:f,...totals(),held:G.inventory.length,bought:out.bought,used:out.used});
  }
  out.end=totals();return out;
};
