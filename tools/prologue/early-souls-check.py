"""序盤短縮・修道院のレア保証・案内順・旧探索セーブの継続を実ブラウザで確認。"""
from playwright.sync_api import sync_playwright

BASE = 'http://localhost:8000/'
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox', '--disable-dev-shm-usage'])
    def fresh(width=390):
        context = browser.new_context(viewport={'width': width, 'height': 844}, service_workers='block', reduced_motion='reduce')
        context.route('https://**/*', lambda route: route.abort())
        page = context.new_page()
        page.goto(BASE + '?testScene=prologue:abbey', wait_until='domcontentloaded')
        page.wait_for_function('window.__game?.G.msq?.prologue')
        return context, page

    context, page = fresh()
    result = page.evaluate('''async () => {
      const {game,UI}=await import('/src/ui/ctx.js');
      const {WORLD,worldById,poolAt,gateFloors}=await import('/src/dungeons/world.js');
      const {STORY_CELLS}=await import('/src/story.js');
      const {SOUL_CLASSES}=await import('/src/souls.js');
      const {refSerialize,refDeserialize}=await import('/src/savegraph.js');
      const {G,ev,inf}=__game, checks=[];
      const check=(ok,msg)=>{if(!ok)throw Error(msg);checks.push(msg);};
      for(const [id,floors] of [['w00_forest',2],['w01',3],['w02',5],['w03',10]]) {
        const d=worldById(id);check(d.floors===floors,id+'の階数');
        const seen=new Set(Array.from({length:floors},(_,i)=>poolAt(d,i+1)).flat());
        check(d.bands.flat().every(k=>seen.has(k)),id+'の全魔物に出番');
        for(const c of Object.values(STORY_CELLS).filter(c=>c.dungeon===id))check(c.floor<=floors,id+'の手がかりが到達範囲');
        check(Math.abs(d.floors*d.rewardMul-({w00_forest:3,w01:5,w02:10,w03:15}[id]))<1e-8,id+'の育ち・支度金を補正');
      }
      check(gateFloors(worldById('w02')).length===0,'回廊はB5Fで踏破');
      check(JSON.stringify(gateFloors(worldById('w03')))==='[5]','修道院はB5Fから帰還');
      const reset=()=>{
        G.state='town';G.prompt=false;G.abyss=null;G.rematch=null;G.dungeonIdx=WORLD.findIndex(d=>d.id==='w03');
        G.msq.prologue.phase='abbey';G.world.reported={w01:1,w02:1};G.world.cleared={w01:1,w02:1};G.world.report=null;
        G.tut={earlySoulVersion:1,done:{repairSoul:true,trainSoul:true,shopAppraise:true}};
        G.party.forEach(d=>{d.stability=100;d.stabilityAt=Date.now();});
        UI.closeAll?.();ev.enterDungeon(null,1);
      };
      reset();G.tut.done.soulChange=true;G.tut.abbeyRareReturned=true;
      check(!game.featureUnlocked('sub1'),'レア魂を持ち帰り付け替えを学んでも踏破前はサブ魂を開かない');
      G.world.reported.w03=1;
      check(game.featureUnlocked('sub1'),'踏破記録のない既存の修道院報告も解放として扱う');
      delete G.tut.abbeyRareReturned;
      check(inf.grantSoulQuiet('fighter').rarity==='rare','修道院を先に報告しても初回の魂はレア');
      reset();G.floor=2;ev.newFloor();
      check(G.board.cells.flat().filter(c=>c.abbeyFirstSoul&&c.corpseWarm&&c.revealed&&SOUL_CLASSES[c.corpseClass].rarity==='rare').length===1,'B2Fに発見済みのレアの死体を配置');
      const got=inf.grantSoulQuiet('fighter','検証');
      check(got.rarity==='rare'&&G.run.abbeyRareSoul,'死体・戦闘・出来事の共通受取で初回をレアへ');
      const uid=G.run.abbeyRareSoul;
      check(inf.grantSoulQuiet('fighter').rarity==='common','二個目からは通常抽選');
      const saved=refDeserialize(JSON.parse(JSON.stringify(refSerialize({run:G.run,tut:G.tut,souls:G.souls}))));
      check(saved.run.abbeyRareSoul===uid&&saved.souls.some(s=>s.uid===uid),'入手済み保証を保存できる');
      const run=G.run;G.souls.splice(G.souls.findIndex(s=>s.uid===uid),1);
      inf.returnToTown({outcome:'wipe',run,forfeited:{souls:run.souls}});
      check(!G.tut.abbeyRareReturned&&!game.featureUnlocked('sub1'),'没収帰還ではサブ魂を開かない');
      G.party.forEach(d=>{d.stability=100;d.stabilityAt=Date.now();});ev.enterDungeon(null,1);
      check(inf.grantSoulQuiet('fighter').rarity==='rare','失った後の出撃でも初回レアを保証');
      // 未鑑定・強化などの別案内は済ませ、魂の案内だけを見る。
      game.pendingIreneBeat=()=>null;
      inf.returnToTown({outcome:'return'});
      check(G.tut.abbeyRareReturned&&UI.tutorialPending()?.key==='soulChange','無事に持ち帰ったら付け替えが先');
      check(!G.tut.fusionPending&&!game.featureUnlocked('sub1'),'付け替え前はサブ魂と融合の案内を開かない');
      G.tut.done.soulChange=true;
      check(!game.featureUnlocked('sub1')&&UI.tutorialPending()?.key!=='sub1','途中帰還で付け替えを学んでもサブ魂を案内しない');
      G.world.cleared.w03=1;
      check(game.featureUnlocked('sub1')&&UI.tutorialPending()?.key==='sub1','修道院踏破後、報告前にサブ魂が開き館を案内する');
      delete G.tut.abbeyRareReturned;G.tut.done.soulChange=false;
      check(game.featureUnlocked('sub1'),'踏破後はレア魂の持ち帰り・付け替えの習得を解放条件にしない');
      G.tut.done.soulChange=true;G.tut.abbeyRareReturned=true;
      G.tut.done.sub1=true;delete G.lastRun.soulTutorialHandled;UI.tutorialAfterReturn();
      check(!G.tut.fusionPending,'同じ帰還を再処理しても融合を始めない');
      G.party.forEach(d=>{d.stability=100;d.stabilityAt=Date.now();});ev.enterDungeon(null,1);
      check(inf.grantSoulQuiet('fighter').rarity==='common','持ち帰り後はレア保証を繰り返さない');
      inf.returnToTown({outcome:'return'});
      check(G.tut.fusionPending&&UI.tutorialPending()?.key==='fusion','次に魂を持ち帰った帰還で融合を案内');
      reset();G.tut.done.sub1=true;
      check(game.featureUnlocked('sub1'),'すでに教わったサブ魂は踏破記録がなくても保持する');
      G.tut.done.sub1=false;G.tut.sub1Legacy=true;
      check(game.featureUnlocked('sub1'),'旧版から引き継いだサブ魂の枠を保持する');
      return checks;
    }''')
    print('\n'.join(result), flush=True)
    context.close()

    # メインに使う経路と、一覧を閉じてレア魂をサブに使う経路を実際の操作で確認。
    for width, use_main in [(390, False), (1280, True)]:
        context, page = fresh(width)
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.add_style_tag(content='.test-play-banner{display:none!important}')
        page.evaluate('''async()=>{
          const {game,UI}=await import('/src/ui/ctx.js');const {G,ev,inf}=__game;
          game.pendingIreneBeat=()=>null;G.irene.greeted=true;
          G.tut={earlySoulVersion:1,done:{repairSoul:true,trainSoul:true,shopAppraise:true}};
          ev.enterDungeon(null,1);inf.grantSoulQuiet('samurai');G.world.cleared.w03=1;inf.returnToTown({outcome:'clear'});
        }''')
        main_chosen=False
        seen=[]
        for _ in range(140):
            page.wait_for_timeout(180)
            key=page.evaluate('__game.G.tut.cur')
            if key and (not seen or seen[-1]!=key):seen.append(key)
            if page.evaluate('!!__game.G.tut.done.sub1'):break
            skip=page.locator('.iv-scene:not(.out) .iv-skip:visible,.sc-scene:not(.out) .sc-skip:visible')
            if skip.count():skip.first.click();page.wait_for_timeout(450);continue
            picker=page.locator('.sp-pick-sheet:visible')
            if key=='soulChange' and picker.count():
                if use_main:
                    target=picker.locator('.sp-srow[data-job="samurai"] .sp-srow-main')
                    if not main_chosen and target.count():target.click();main_chosen=True;continue
                else:
                    picker.locator('.ui-sheet-foot .ui-btn').last.click();continue
            glow=page.locator('.tut-glow:visible')
            if glow.count():
                try:glow.first.click(timeout=2500)
                except Exception:
                    print('操作停止', key, page.evaluate('document.body.innerText.slice(-3500)'),flush=True)
                    page.screenshot(path='/tmp/dos-early-souls-blocked.png')
                    raise
        assert page.evaluate('__game.G.tut.done.sub1'),page.evaluate('document.body.innerText.slice(-2400)')
        assert 'soulChange' in seen and 'sub1' in seen and 'fusion' not in seen,seen
        assert not page.evaluate('__game.G.tut.fusionPending')
        assert page.evaluate('__game.G.party.some(d=>d.subs?.some(Boolean))')
        if use_main:
            assert main_chosen
            assert page.evaluate('async()=>{const {soulByUid}=await import("/src/souls.js");return __game.G.party.some(d=>soulByUid(d.primary)?.clsKey==="samurai")}')
        assert not errors,errors
        print(f'{width}px: 修道院踏破後に付け替え→サブ魂の実操作、融合は次の帰還へ',flush=True)
        context.close()

    # 実際の通常ロードで旧版の深い階と、既に開いたサブ魂を保持する。
    for dungeon, floor, old_floors in [('w01',4,5),('w02',7,10),('w03',12,15)]:
        context, page = fresh()
        page.evaluate('''async({dungeon,floor})=>{
          const {G,ev,inf}=__game;const {worldById}=await import('/src/dungeons/world.js');
          const {makeBoard}=await import('/src/board.js');
          G.msq.prologue.phase='done';G.dungeonIdx=__game.world.DUNGEONS.findIndex(d=>d.id===dungeon);
          G.world.open[dungeon]=1;G.world.reported={w01:1,w02:1,w03:1};delete G.world.found.w02_broken_doll;
          ev.enterDungeon(null,1);G.floor=floor;G.board=makeBoard(floor,{...worldById(dungeon),floors:dungeon==='w01'?5:dungeon==='w02'?10:15});
          delete G.run.earlyLayout;delete G.tut.earlySoulVersion;delete G.tut.sub1Legacy;G.tut.done.sub1=false;
          localStorage.setItem('dos-save-v7',inf.saveJSON());
        }''',{'dungeon':dungeon,'floor':floor})
        page.goto(BASE,wait_until='domcontentloaded');page.wait_for_function('window.__game?.G.party.length===6')
        assert page.evaluate('__game.G.floor')==floor
        assert page.evaluate('__game.activeCfg().floors')==old_floors
        assert page.evaluate('async()=>{const {game}=await import("/src/ui/ctx.js");return game.featureUnlocked("sub1")}')
        if dungeon=='w02':
            page.evaluate('__game.G.floor=10;__game.ev.newFloor()')
            # 旧序章の途中だった記録の手がかりも、元の最深部で拾える。
            page.evaluate('__game.G.msq.prologue.phase="corridor";__game.ev.newFloor()')
            assert page.evaluate('__game.G.board.cells.flat().some(c=>c.storyKey==="w02_broken_doll")')
        page.evaluate('async()=>{const {game}=await import("/src/ui/ctx.js");game.returnToTown({outcome:"return"})}')
        assert page.evaluate('__game.activeCfg().floors')==({'w01':3,'w02':5,'w03':10}[dungeon])
        print(dungeon+': 旧探索を保持、帰還後は短縮版、既存のサブ魂は保持',flush=True)
        context.close()
    # 直前の公開版のセーブも通常ロードし、未使用の枠は新条件、開始済み・装着済みは継続する。
    for state in ['unlearned', 'started', 'equipped']:
        context, page = fresh()
        page.evaluate('''async(state)=>{
          const {G,inf}=__game;
          G.state='town';G.world.reported={w01:1,w02:1};G.world.cleared={w01:1,w02:1};
          G.tut={earlySoulVersion:1,abbeyRareReturned:true,done:{soulChange:true},cur:state==='started'?'sub1':null,step:0,ev:{},base:{}};
          if(state==='equipped') {
            const soul=inf.addSoulInstance('samurai');
            G.party[0].subs=[{uid:soul.uid,picks:[]}];inf.recalcAllDolls();
          }
          localStorage.setItem('dos-save-v7',inf.saveJSON());
        }''', state)
        page.goto(BASE,wait_until='domcontentloaded');page.wait_for_function('window.__game?.G.party.length===6')
        assert page.evaluate('async()=>{const {game}=await import("/src/ui/ctx.js");return game.featureUnlocked("sub1")}') == (state != 'unlearned'), state
        if state == 'equipped':
            assert page.evaluate('__game.G.party[0].subs.length') == 1
        print(state+': 現行版セーブを読み込み、未踏破の解放条件・使用済みの引き継ぎを確認',flush=True)
        context.close()
    browser.close()
