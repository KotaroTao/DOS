"""全主の初回記憶・再閲覧・旧討伐記録・廃止した再戦からの復帰を確認する。localhost:8000で実行。"""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
source = (ROOT / 'src/game.js').read_text().replace(
    'window.__game = { G,',
    'window.__game = { G, bossMemories: { playBossMemory, abortRematch },', 1)
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox', '--disable-dev-shm-usage'])
    context = browser.new_context(viewport={'width':390,'height':900}, service_workers='block', reduced_motion='reduce')
    context.route('https://**/*', lambda route: route.abort())
    context.route('**/src/game.js', lambda route: route.fulfill(body=source, content_type='text/javascript'))
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://localhost:8000/?testDungeon=w03&testPlace=town', wait_until='domcontentloaded')
    page.wait_for_function('window.__game?.G.party.length>0')
    result = page.evaluate('''async () => {
      const {game, UI} = await import('/src/ui/ctx.js');
      const {sheet} = await import('/src/ui/kit.js');
      const {WORLD} = await import('/src/dungeons/world.js');
      const {BOSS_MEMORIES, IRENE_BEATS} = await import('/src/story.js');
      const {storyEntries} = await import('/src/journal.js');
      const {ARCHIVE_STORIES} = await import('/src/archive-stories.js');
      const check = (ok, message) => { if (!ok) throw Error(message); };
      const {G, bossMemories} = __game;
      sheet.closeAll(); G.prompt=false; G.state='town';
      G.msq.prologue={phase:'done'};G.msq.n=1;
      G.world={open:{w03:1},cleared:{},reported:{},found:{},beats:{}};
      let shown, completed=0;
      const chain=UI.playStoryChain;
      UI.playStoryChain=(pages, done)=>{shown={pages,done}};
      for(const d of WORLD.filter(d=>d.boss)) {
        check(!bossMemories.playBossMemory(d.id), d.id+' 未討伐で語らない');
        G.world.cleared[d.id]=1;
        check(bossMemories.playBossMemory(d.id,()=>completed++),d.id+' 初回討伐後に語る');
        check(shown.pages[0].photo && shown.pages[0].lines.length>=4,d.id+' 本文と専用挿絵');
        check(!G.world.beats['mem_'+d.id],d.id+' 中断時は未読');
        check(bossMemories.playBossMemory(d.id,()=>completed++),d.id+' 中断後に再表示');
        shown.done();
        check(G.world.beats['mem_'+d.id],d.id+' 読了保存');
        check(!bossMemories.playBossMemory(d.id),d.id+' 二度目の討伐では語り直さない');
      }
      check(completed===24,'全24主の読了');
      UI.playStoryChain=chain;
      check(!game.featureUnlocked('rematch'),'再戦の解放を廃止');
      check(!game.departRematch && !game.rematchList,'再戦開始の窓口を廃止');
      // 旧版の再戦途中から、隊・元の迷宮・階を戻し報酬を付けない。
      const d=G.party[0], hp=d.hp, mp=d.mp, idx=G.dungeonIdx, gold=G.gold, soul=G.soulPts;
      G.rematch={savedIdx:idx,savedFloor:3,snap:[{p:d,hp,mp,alive:d.alive,ailment:d.ailment,pct:d._poisonPct}]};
      G.state='combat';d.hp=0;d.alive=false;
      await bossMemories.abortRematch();
      check(G.state==='town'&&!G.rematch&&d.hp===hp&&d.mp===mp&&d.alive,'旧再戦の隊を復元');
      check(G.dungeonIdx===idx&&G.floor===3&&G.gold===gold&&G.soulPts===soul,'旧再戦で報酬・行き先を変えない');
      // 既存の討伐記録だけでも、追加した記憶を開く。未討伐は伏せる。
      G.world.beats=Object.fromEntries(IRENE_BEATS.map(b=>[b.id,1]));
      G.world.cleared={ws1:1};G.world.reported={};G.world.report=null;G.stats.bossIds={};G.prompt=false;
      const ids=storyEntries(G).filter(s=>s.id.startsWith('mem_')).map(s=>s.id);
      check(ids.length===1&&ids[0]==='mem_ws1','旧セーブは討伐済みの主だけ閲覧');
      const {_TUTS}=await import("/src/ui/tutorial.js");
      G.tut.cur=null;_TUTS.forEach(t=>G.tut.done[t.key]=true);G.insightNotified=Number.MAX_SAFE_INTEGER;
      window.memorySnapshot=()=>JSON.stringify({cleared:G.world.cleared,reported:G.world.reported,found:G.world.found,beats:G.world.beats,bossIds:G.stats.bossIds,bossKills:G.stats.bossKills,gold:G.gold,soul:G.soulPts,red:G.redSoul,party:G.party.map(d=>({hp:d.hp,mp:d.mp,alive:d.alive,primary:d.primary,equip:d.equip}))});
      window.memoryBefore=memorySnapshot();
      window.memoryUI={game,UI,sheet};
      UI.openDeparture({page:'rematch'});
      return {firstDefeats:completed,legacy:ids,archiveCount:ARCHIVE_STORIES.filter(s=>s.id.startsWith('mem_')).length};
    }''')
    page.wait_for_selector('.dp-gate')
    assert page.get_by_text('闘技場跡 ― 宿敵の再戦',exact=True).count() == 0
    page.evaluate('memoryUI.sheet.closeAll();window.memoryBefore=memorySnapshot();memoryUI.UI.openStoryArchive()')
    page.get_by_role('button', name='待ち続けた指輪', exact=True).click()
    page.wait_for_selector('.jr-detail img')
    page.wait_for_function('document.querySelector(".jr-detail img")?.naturalWidth===1536')
    page.screenshot(path='/tmp/dos-boss-memory-mobile.png')
    assert page.evaluate('memorySnapshot()===memoryBefore'), '閲覧で報酬や進行を変えない'
    page.get_by_role('button', name='一覧に戻る', exact=True).last.click()
    page.get_by_role('button', name='待ち続けた指輪', exact=True).click()
    assert page.evaluate('memorySnapshot()===memoryBefore'), '再閲覧で報酬や進行を変えない'
    page.set_viewport_size({'width':1280,'height':900})
    page.evaluate('memoryUI.sheet.closeAll();memoryUI.UI.openStoryArchive()')
    page.locator('.pc-list-row').filter(has_text='待ち続けた指輪').click()
    page.wait_for_function('document.querySelector(".pc-detail img")?.naturalWidth===1536')
    page.screenshot(path='/tmp/dos-boss-memory-desktop.png')
    assert page.evaluate('memorySnapshot()===memoryBefore'), 'PCの再閲覧で報酬や進行を変えない'
    assert page.evaluate('''()=>{const n=document.querySelector('.pc-detail');return n.scrollWidth<=n.clientWidth+1}'''), 'PC本文の横はみ出しなし'
    assert not errors, errors
    print('OK',result,'初回・中断・二回目・旧セーブ・再戦廃止・390/1280pxでの専用挿絵と再閲覧')
    browser.close()
