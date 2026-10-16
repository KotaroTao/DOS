"""探索省略の入口・未読イベント順・踏破/報告・全迷宮・セーブ保護。localhost:8000。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox', '--disable-dev-shm-usage'])
    page = browser.new_page(viewport={'width': 390, 'height': 844}, service_workers='block', reduced_motion='reduce')
    page.route('https://**/*', lambda route: route.abort())
    page.set_default_timeout(120000)
    page.add_init_script("const later=window.setTimeout;window.setTimeout=(f,t,...a)=>later(f,String(f).includes('起動がタイムアウト')?120000:t,...a)")
    page.add_init_script("window.requestAnimationFrame=f=>setTimeout(()=>f(performance.now()),100);window.cancelAnimationFrame=clearTimeout")
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    def visit(query):
        page.goto('http://localhost:8000/' + query, wait_until='domcontentloaded')
        page.wait_for_function('window.__game?.G && !document.body.classList.contains("booting")')
    visit('?testDungeon=w01&testPlace=town')
    saved = page.evaluate('localStorage["dos-save-v7"] = __game.inf.saveJSON()')
    visit('')
    page.get_by_role('button', name='テストプレイ', exact=False).click()
    page.get_by_label('テストする内容', exact=True).select_option('flow')
    assert page.get_by_label('場面', exact=True).locator('option').count() == 15
    page.get_by_label('場面', exact=True).select_option('prologue:forest')
    page.locator('.ttl-test button').last.click()
    page.wait_for_function('window.__game?.G.testSkipDungeon')
    assert 'testSkipDungeon=1' in page.url
    assert page.evaluate('__game.G.party.length') == 3
    # 読了前は踏破も手がかりも未確定。出撃は本番の条件判定を使う。
    page.evaluate('''async()=>{
      const {UI}=await import('/src/ui/ctx.js');
      window.pendingStories=[];
      UI.playStoryChain=(pages,done)=>pendingStories.push({pages,done});
      const result=__game.world.departNow();
      if(!result.ok)throw Error(JSON.stringify(result));
    }''')
    page.wait_for_function('pendingStories.length>0')
    assert not page.evaluate('!!__game.G.world.found.forest_doll')
    assert not page.evaluate('!!__game.G.world.cleared.w00_forest')
    page.evaluate('''()=>{const s=pendingStories.shift();s.pages.forEach(p=>{p.enter?.();p.leave?.();});s.done?.();}''')
    assert page.evaluate('__game.G.world.found.forest_doll && __game.G.world.cleared.w00_forest === 1')
    assert page.evaluate('__game.G.msq.prologue.phase') == 'fourth'
    assert page.get_by_role('button', name='まだ探索する', exact=True).count() == 0
    page.get_by_role('button', name='街へ凱旋する', exact=True).click()
    page.wait_for_function('__game.G.state==="town"')
    page.wait_for_function('window.__game.UI.tutorialPending?.()?.key === "createFourth"')
    print('OK: タイトルの入口・読了後のみ発見/踏破・帰還後に四体目の手ほどき')
    # 全迷宮で未発見の物語を階順に読み、主の記憶を最後に再生する。
    visit('?testScene=prologue:abbey&testSkipDungeon=1')
    result = page.evaluate('''async()=>{
      const {G,UI,ev,world:W}=__game;
      const {STORY_CELLS,BOSS_MEMORIES,BOSS_PRELUDES}=await import('/src/story.js');
      const {testTutorials}=await import('/src/ui/tutorial.js');
      const checks=[];
      UI.playStoryChain=(pages,done)=>{window.seen.push(...pages.map(p=>p.title));pages.forEach(p=>{p.enter?.();p.leave?.();});done?.();};
      for(const [idx,cfg] of W.DUNGEONS.entries()){
        UI.closeAll?.(); G.state='town';G.prompt=false;G.dungeonIdx=idx;
        G.msq.prologue.phase=cfg.tutorial?'forest':cfg.id==='w02'?'corridor':'done';
        G.world={open:{[cfg.id]:true},cleared:{},reported:{},found:{},beats:{},gates:{}};
        G.party.forEach(d=>{d.stability=100;d.stabilityAt=Date.now();});
        G.tut={done:Object.fromEntries(testTutorials.map(t=>[t.id.slice(9),true]))};
        window.seen=[];
        const expected=Object.values(STORY_CELLS).filter(d=>d.dungeon===cfg.id&&(!d.prologue||cfg.tutorial||cfg.id==='w02')).sort((a,b)=>a.floor-b.floor).map(d=>d.title);
        if(cfg.boss&&BOSS_PRELUDES[cfg.id]?.first)expected.push(BOSS_PRELUDES[cfg.id].first.title);
        if(BOSS_MEMORIES[cfg.id])expected.push(BOSS_MEMORIES[cfg.id].title);
        const bosses=G.stats.bossKills;
        ev.enterDungeon(null,1);
        if(JSON.stringify(seen)!==JSON.stringify(expected))throw Error(cfg.id+':'+JSON.stringify({seen,expected}));
        if(G.world.cleared[cfg.id]!==1||G.floor!==cfg.floors||!G.run.secured)throw Error(cfg.id+':踏破');
        if(G.stats.bossKills!==bosses+Number(!!cfg.boss))throw Error(cfg.id+':主の戦績');
        if(W.reportMissingClue(cfg.id))throw Error(cfg.id+':手がかり不足');
        if(!cfg.side&&!cfg.tutorial&&G.world.report!==cfg.id)throw Error(cfg.id+':報告待ち');
        G.state='town';G.prompt=false;window.seen=[];
        G.party.forEach(d=>{d.stability=100;d.stabilityAt=Date.now();});
        ev.enterDungeon(null,1);
        if(seen.length||G.world.cleared[cfg.id]!==2)throw Error(cfg.id+':再訪で読了済みの物語を繰り返す');
        checks.push(cfg.id);
      }
      return checks;
    }''')
    print(f'OK: 全{len(result)}迷宮の手がかり順・主の記憶・踏破・報告待ち')
    assert page.evaluate('localStorage["dos-save-v7"]') == saved
    page.get_by_role('button', name='終了してホームへ', exact=True).click()
    page.wait_for_selector('.ttl-overlay')
    assert 'test' not in page.url
    assert page.evaluate('localStorage["dos-save-v7"]') == saved
    # 通常の試遊は探索を維持し、省略フラグ単独ではテストにも入らない。
    visit('?testScene=prologue:forest')
    page.evaluate('__game.ev.enterDungeon(null,1)')
    assert not page.evaluate('__game.G.testSkipDungeon || !!__game.G.world.cleared.w00_forest')
    visit('?testSkipDungeon=1')
    assert not page.evaluate('!!__game.G.testPlay')
    assert not errors, errors
    print('OK: 通常セーブ保護・終了・既存モード・通常プレイ隔離')
    browser.close()
