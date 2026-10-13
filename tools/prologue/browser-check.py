"""序章の報酬・進行・保存・迷宮制限・鑑定・安定度の回帰確認。localhost:8000で実行。"""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width':390,'height':844})
    errors=[]
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://localhost:8000/?testDungeon=w01&testPlace=town')
    page.wait_for_function('window.__game?.G.party.length > 0')
    print(page.evaluate('''async () => {
      const {game,UI} = await import('/src/ui/ctx.js');
      const {setSharedSouls,soulByUid} = await import('/src/souls.js');
      const {refSerialize,refDeserialize} = await import('/src/savegraph.js');
      const {makeBoard} = await import('/src/board.js');
      const {eligibleEvents} = await import('/src/events.js');
      const {worldById,strengthAt} = await import('/src/dungeons/world.js');
      const {spawnCardEnemies} = await import('/src/combat.js');
      const G=__game.G, W=__game.world, ev=__game.ev, out=[];
      const check=(ok,msg)=>{if(!ok)throw Error(msg);out.push(msg);};
      // 語りを閉じた時の本番コールバックを実行。画面操作そのものは下で別に確認する。
      UI.playStoryChain=(pages,done)=>{for(const p of pages){p.enter?.();p.leave?.();}done?.();};
      UI.tutorialAfterReport=()=>false;
      G.party=[];G.reserve=[];G.souls=[];setSharedSouls(G.souls);G.dollsPurchased=0;
      G.world={};G.gold=0;G.redSoul=0;G.tut={done:{}};G.msq={n:0,state:'active',granted:false};
      W.grantTutorialGift();W.grantTutorialGift();
      check(G.souls.map(s=>s.clsKey).join(',')==='fighter,priest,thief','王の魂は初回三職のみ・二重受領なし');
      const make=job=>{const soul=G.souls.find(s=>s.clsKey===job&&!game.soulWorn(s.uid));return W.finalizeBuyDoll(soul.uid,job);};
      for(const k of ['fighter','priest','thief'])check(!!make(k),k+'を無料で作成');
      game.completePrologueTutorial('createThree');
      check(W.prologuePhase()==='forest'&&G.world.open.w00_forest&&!G.world.open.w01,'三体で森のみ開放');
      const enter=(id,floor=1)=>{G.state='town';G.dungeonIdx=W.DUNGEONS.findIndex(d=>d.id===id);G.prompt=false;ev.enterDungeon(null,floor);};
      const find=key=>{const cell=G.board.cells.flat().find(c=>c.storyKey===key);check(!!cell,key+'を配置');W.runStoryCell(cell);};
      G.party.forEach(d=>{d.stability=100;d.stabilityAt=Date.now();});G.stabilityBriefed=false;
      enter('w00_forest',3);find('forest_doll');W.commitDungeonClear(false);G.state='town';
      check(!G.world.report&&G.party.every(d=>d.stability===100)&&!G.stabilityBriefed,'森は報告・安定度消費・門衛説明なし');
      game.preparePrologueDoll();game.preparePrologueDoll();check(G.souls.filter(s=>s.clsKey==='mage').length===1,'イレーヌの魔導士の魂は一つだけ');make('mage');game.completePrologueTutorial('createFourth');W.prologueAudience();
      check(G.party.length===4&&G.gold===500&&W.prologuePhase()==='shop'&&!G.world.open.w01,'四体で金貨500・購入の手ほどきまで地下墓地は閉鎖');
      game.completePrologueTutorial('buyEquipment');
      check(W.prologuePhase()==='crypt'&&G.world.open.w01&&!G.world.open.w02,'購入の手ほどき完了で地下墓地を解放');
      W.prologueAudience();check(G.gold===500,'依頼の報酬は二重受領しない');
      enter('w01',5);find('w01_lantern');W.commitDungeonClear(false);G.state='town';W.reportMainQuest();
      check(W.prologuePhase()==='fifth'&&!G.world.open.w02&&!G.souls.some(s=>s.clsKey==='knight'),'王の褒美は人業のみ・回廊はまだ閉鎖');
      for(let i=0;i<25;i++)if(!__game.quest.rollQuestBoard().every(q=>q.type!=='soul'&&q.dungeon!=='w00_forest'))throw Error('達成不能な序章の依頼');
      check(true,'死体のない序章で達成不能な魂回収依頼を出さない');
      game.preparePrologueDoll();game.preparePrologueDoll();make('knight');game.completePrologueTutorial('createFifth');
      check(W.prologuePhase()==='formation'&&!G.world.open.w02,'五体作成後は隊列の手ほどきを先に行う');
      [G.party[1],G.party[4]]=[G.party[4],G.party[1]];
      game.completePrologueTutorial('prologueFormation');W.prologueAudience();
      check(G.party.length===5&&G.world.open.w02&&G.souls.filter(s=>s.clsKey==='knight').length===1,'イレーヌから騎士一体・五体で回廊を拝命');
      enter('w02',4);find('w02_sigil');check(!G.world.open.w04,'序章中に寄り道を先行開放しない');
      G.floor=5;ev.descend();check(G.floor===6&&G.party.every(d=>d.stability===100),'回廊5→6階も安定度を消費しない');
      G.floor=10;ev.newFloor();find('w02_broken_doll');W.commitDungeonClear(false);G.state='town';
      game.preparePrologueDoll();make('bishop');game.completePrologueTutorial('createSixth');game.preparePrologueAppraisal();game.preparePrologueAppraisal();
      const staff=game.prologueAppraisalItem(), bishop=G.party.find(d=>soulByUid(d.primary)?.clsKey==='bishop');
      check(G.party.length===6&&G.party[0].items.filter(it=>it===staff).length===1&&staff.unidentified&&staff.q===50,'六体目は司教・品質50の練習品を一度だけ授与');
      const save=refDeserialize(JSON.parse(JSON.stringify(refSerialize({msq:G.msq,party:G.party}))));
      check(save.party[0].items.includes(save.msq.prologue.staff),'保存往復でも練習品の同一参照を保持');
      const chance=game.identifyChance(bishop,staff);
      const {useMathRandom}=await import('/src/rng.js');
      const oldRandom=Math.random;useMathRandom();Math.random=()=>0.999999;
      check(chance>0&&chance<1,'表示成功率は従来式で100%未満');
      check(game.doIdentifySkill(bishop,staff,{quiet:true})&&!staff.unidentified&&staff.name==='魔法の杖'&&staff.q===50,'チュートリアル鑑定は成功し品質50の魔法の杖になる');
      const ordinary=__game.equipLv.cloneItem('magicStaff',50);ordinary.unidentified=true;
      check(!game.doIdentifySkill(bishop,ordinary,{quiet:true})&&ordinary.idHardFail,'通常の品には成功保証を適用しない');
      Math.random=oldRandom;
      game.completePrologueTutorial('prologueAppraise');W.prologueAudience();
      check(W.prologuePhase()==='abbey'&&G.world.reported.w02&&G.world.open.w03&&!G.world.open.w04,'鑑定後に六体で修道院へ向かう依頼を受ける');
      G.party.forEach(d=>{d.stability=100;d.stabilityAt=Date.now();});enter('w03');
      check(G.party.every(d=>d.stability===70)&&G.stabilityBriefed,'修道院の入場で全員30消費');
      check(W.prologuePhase()==='done'&&G.world.open.w04,'修道院の入場で従来ストーリーへ接続');
      G.floor=4;ev.descend();check(G.party.every(d=>d.stability===70),'4→5階は消費なし');
      ev.descend();check(G.party.every(d=>d.stability===40),'5→6階で全員30消費');
      G.floor=10;ev.descend();check(G.party.every(d=>d.stability===10),'10→11階で全員30消費');
      for(const id of ['w00_forest','w01','w02']){
        const cfg=worldById(id);let monsters=new Set();
        for(let trial=0;trial<80;trial++)for(let f=1;f<=cfg.floors;f++){
          const b=makeBoard(f,cfg);for(const c of b.cells.flat()){
            if(c.type==='corpse'||c.type==='event'||(cfg.noTraps&&c.type==='trap')||(cfg.noChests&&c.type==='chest'))throw Error(id+'に禁止マス:'+c.type);
            if(c.monsterKey)monsters.add(c.monsterKey);
          }
        }
        check(eligibleEvents({dungeonId:id,abyss:false}).length===0,id+'はランダムイベントなし');
        if(cfg.tutorial){check(monsters.size===3,'森は指定の虫三種だけ');for(const key of monsters)check(spawnCardEnemies(key,3,strengthAt(cfg,3)).every(e=>e.hp<=3&&e.atk===1),'森の敵は非常に弱い:'+key);}
        check(true,id+'の全階×80回で禁止マスなし');
      }
      return out;
    }'''))
    assert not errors,errors
    browser.close()
