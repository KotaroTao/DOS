"""初回の魂強化と、序盤の無料回収・修道院以降の費用をブラウザーで確認。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':390,'height':844})
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('http://localhost:8000/?testDungeon=w01&testPlace=town')
    page.wait_for_function('window.__game?.G.party.length > 0')
    print(page.evaluate('''async()=>{
      const {game,UI,ops}=await import('/src/ui/ctx.js');
      const {_TUTS}=await import('/src/ui/tutorial.js');
      const {soulByUid,soulLevelCapOf}=await import('/src/souls.js');
      const {refSerialize,refDeserialize}=await import('/src/savegraph.js');
      const G=game.G, checks=[];
      const check=(ok,msg)=>{if(!ok)throw Error(msg);checks.push(msg);};
      G.testPlay=false; G.tut={done:Object.fromEntries(_TUTS.filter(t=>t.key!=='trainSoul').map(t=>[t.key,true]))};
      G.msq.prologue={phase:'crypt',gifts:{}}; G.irene.greeted=true;
      game.pendingIreneBeat=()=>null;
      G.soulPts=0;
      G.party.forEach(d=>{const s=soulByUid(d.primary);s.level=1;s.exp=0;});
      const soul=soulByUid(G.party[0].primary), cost=game.soulTrainCost(1);
      // 蓄積expの分を差し引いた実費ぴったりで発火する。
      soul.exp=3; G.soulPts=cost-4;
      check(!UI.tutorialAfterReturn()&&!G.tut.trainPending,'1Lvに足りなければ案内しない');
      G.soulPts++;
      check(UI.tutorialAfterReturn()&&G.tut.trainPending,'蓄積expを差し引いて1Lv分に達した初帰還で案内');
      check(G.town.tab==='hub'&&!G.tut.cur,'館へ勝手に移動しない');
      G.tut=refDeserialize(refSerialize(G.tut));
      check(G.tut.trainPending,'訪問待ちを保存できる');
      window.trainingBefore={uid:soul.uid,level:soul.level,points:G.soulPts,cost:cost-3};
      return checks;
    }'''))
    page.add_style_tag(content='.test-play-banner{display:none!important}')
    for _ in range(70):
        page.wait_for_timeout(350)
        if page.evaluate('!!__game.G.tut.done.trainSoul'):break
        skip=page.locator('.iv-skip:visible,.sc-skip:visible')
        if skip.count():skip.evaluate_all('(bs)=>bs[0]?.click()');continue
        glow=page.locator('.tut-glow:visible')
        if glow.count():glow.first.click()
    print(page.evaluate('''async()=>{
      const {game,UI,ops}=await import('/src/ui/ctx.js');
      const {soulByUid}=await import('/src/souls.js');
      const G=game.G,b=trainingBefore;
      if(!G.tut.done.trainSoul||soulByUid(b.uid).level!==b.level+1||G.soulPts!==b.points-b.cost)throw Error('実際の強化・費用');
      G.soulPts=10000;
      if(UI.tutorialAfterReturn())throw Error('強化案内が再発');
      return '館で実際に1Lv強化・通常費用を消費・再帰還で再発しない';
    }'''))
    page.close()
    page=browser.new_page(viewport={'width':390,'height':844})
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('http://localhost:8000/?testDungeon=w01&testPlace=town')
    page.wait_for_function('window.__game?.G.party.length > 0')
    print(page.evaluate('''async()=>{
      const {game,ops}=await import('/src/ui/ctx.js');
      const {refSerialize,refDeserialize}=await import('/src/savegraph.js');
      const G=game.G,checks=[];
      const check=(ok,msg)=>{if(!ok)throw Error(msg);checks.push(msg);};
      const d=G.party[0];G.redSoul=0;
      for(const id of ['w00_forest','w01','w02','w03','w04']){
        G.dungeonIdx=game.DUNGEONS.findIndex(d=>d.id===id);
        const free=['w00_forest','w01','w02'].includes(id);
        check(game.guardianCost()===(free?0:20),id+'の全滅保護費用');
        d.alive=false;d.hp=0;d.reviveAt=Date.now()+40*60*1000;delete d.rescueFree;
        check(game.hastenCostOf(d)===(free?0:2),id+'の回収費用');
        if(free){
          check(game.canHastenRescue(),id+'は赤い魂0でも回収可能');
          game.tryHastenRescue(d);
          check(!d.reviveAt&&G.redSoul===0,id+'の個別回収で赤い魂を消費しない');
        }else{
          game.tryHastenRescue(d);
          check(!!d.reviveAt&&G.redSoul===0,id+'は赤い魂不足なら回収しない');
        }
      }
      // 回収元の料金を保存し、選択迷宮が変わっても無料分だけを回収できる。
      G.party.forEach(d=>{d.alive=true;d.reviveAt=null;});
      const a=G.party[0],b=G.party[1];
      for(const d of [a,b]){d.alive=false;d.reviveAt=Date.now()+40*60*1000;}
      a.rescueFree=refDeserialize(refSerialize({free:true})).free;b.rescueFree=false;
      const r=ops.hastenAll();
      check(r.ok&&r.spent===0&&r.arrived===1&&!a.reviveAt&&!!b.reviveAt,'無料と有料の混在を赤い魂0で一括回収');
      G.redSoul=2;
      const paid=ops.hastenAll();
      check(paid.ok&&paid.spent===2&&!b.reviveAt&&G.redSoul===0,'修道院以降の一括回収は通常の費用');
      return checks;
    }'''))
    page.close()
    for dungeon,red,cost in [('w01',0,0),('w02',0,0),('w03',20,20)]:
        page=browser.new_page(viewport={'width':390,'height':844})
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto('http://localhost:8000/?testDungeon='+dungeon+'&testPlace=town')
        page.wait_for_function('window.__game?.G.party.length > 0')
        page.evaluate("async ({dungeon,red})=>{\n          const {game}=await import('/src/ui/ctx.js');\n          const {G,ev,inf}=__game;\n          G.dungeonIdx=game.DUNGEONS.findIndex(d=>d.id===dungeon);\n          ev.enterDungeon(null,1);G.redSoul=red;\n          G.party.forEach(d=>{d.alive=false;d.hp=0;});\n          inf.gameOver();\n        }",{'dungeon':dungeon,'red':red})
        button=page.locator('.rs-wipe-sheet .ui-sheet-foot .ui-btn.k-primary')
        button.click()
        page.wait_for_function('__game.G.state === "town"')
        assert page.evaluate('__game.G.party.every(d=>d.alive&&d.hp>=1)')
        assert page.evaluate('__game.G.redSoul')==red-cost
        print(dungeon+'の全滅画面から帰還・復活・費用を確認')
        page.close()
    assert not errors,errors
    browser.close()
