"""試遊の入口・序章の連続進行・全迷宮の配置・通常セーブ保護を確認。localhost:8000。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox', '--disable-dev-shm-usage'])
    page = browser.new_page(viewport={'width': 390, 'height': 844}, service_workers='block', reduced_motion='reduce')
    page.route('https://**/*', lambda route: route.abort())
    page.set_default_timeout(120000)
    # 検査環境のモジュール読込が遅い場合だけ、既存の5秒の起動監視に猶予を与える。
    page.add_init_script("const later=window.setTimeout;window.setTimeout=(f,t,...a)=>later(f,String(f).includes('起動がタイムアウト')?120000:t,...a)")
    # 描画負荷だけを抑え、制限のある検査環境でも操作を確認する。
    page.add_init_script("window.requestAnimationFrame=f=>setTimeout(()=>f(performance.now()),100);window.cancelAnimationFrame=clearTimeout")
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    def visit(query):
        page.goto('http://localhost:8000/' + query, wait_until='domcontentloaded')
        page.wait_for_function('window.__game?.G && !document.body.classList.contains("booting")', timeout=120000)
    visit('?testDungeon=w01&testPlace=town')
    # 本物の形式の通常セーブを用意し、以後の試遊が一文字も変えないことを確かめる。
    saved = page.evaluate('localStorage["dos-save-v7"] = __game.inf.saveJSON()')
    print('通常記録を準備')
    visit('')
    page.get_by_role('button', name='テストプレイ', exact=False).click()
    selects = page.locator('.ttl-test select')
    assert selects.nth(0).input_value() == 'prologue'
    assert selects.nth(1).locator('option').count() == 5
    selects.nth(0).select_option('dungeon')
    expected = page.evaluate('__game.world.DUNGEONS.map(d=>d.id)')
    actual = selects.nth(2).locator('option').evaluate_all('(options)=>options.map(o=>o.value)')
    assert sorted(actual) == sorted(expected)
    assert actual[0] == 'w00_forest'
    selects.nth(2).select_option('w00_forest')
    page.locator('.ttl-test input').first.fill('999')
    page.locator('.ttl-test button').last.click()
    page.wait_for_function('window.__game?.G.testPlay && __game.G.state === "board"')
    assert page.evaluate('__game.G.floor') == 3
    print('タイトルから森の最深部へ起動')
    for scene, count, phase in [('prologue:start', 0, None), ('opening', 0, None), ('prologue:forest', 3, 'forest'), ('prologue:crypt', 4, 'crypt'), ('prologue:corridor', 5, 'corridor'), ('prologue:abbey', 6, 'abbey')]:
        visit('?testScene=' + scene)
        print(scene)
        assert page.evaluate('__game.G.party.length') == count, scene
        assert page.evaluate('__game.G.msq.prologue?.phase || null') == phase, scene
        assert page.evaluate('!!__game.G.testStoryFlow'), scene
        assert page.evaluate('localStorage["dos-save-v7"]') == saved, scene
    # 森の手がかりから四体目の手ほどきへ、本番の処理でつながる。
    visit('?testScene=prologue:forest')
    page.evaluate('''async () => {
      const {UI}=await import('/src/ui/ctx.js');
      UI.playStoryChain=(pages, done)=>{for(const p of pages){p.enter?.();p.leave?.();}done?.();};
      const {G,ev,world:W}=__game;
      ev.enterDungeon(null,3);
      const cell=G.board.cells.flat().find(c=>c.storyKey==='forest_doll');
      if(!cell)throw Error('森の人業が配置されていない');
      W.runStoryCell(cell); W.commitDungeonClear(false);
      G.state='town'; G.prompt=false;
      W.resumeFromState();
    }''')
    assert page.evaluate('__game.G.msq.prologue.phase') == 'fourth'
    pending = page.evaluate('''async()=>{const {UI}=await import('/src/ui/ctx.js');return UI.tutorialPending?.()}''')
    assert pending and pending['key'] == 'createFourth', '通し試遊で次の手ほどきが止まる'
    # 各迷宮の最初・最深部に入れる。台帳に迷宮が増えても自動で対象になる。
    visit('?testDungeon=w01&testPlace=town')
    count = page.evaluate('''() => {
      const {G,ev,world:W}=__game;
      for(const [idx,d] of W.DUNGEONS.entries())for(const floor of [1,d.floors]) {
        G.state='town';G.prompt=false;G.dungeonIdx=idx;G.world.open[d.id]=true;
        G.party.forEach(d=>{d.stability=100;d.stabilityAt=Date.now();});
        ev.enterDungeon(null,floor);
        if(G.floor!==floor||!G.board?.cells.length)throw Error(d.id+':'+floor);
      }
      return W.DUNGEONS.length;
    }''')
    assert page.evaluate('localStorage["dos-save-v7"]') == saved
    page.locator('.test-play-banner button').click()
    page.wait_for_selector('.ttl-overlay')
    assert 'test' not in page.url
    assert page.evaluate('localStorage["dos-save-v7"]') == saved
    assert not errors, errors
    print(f'OK: 序章6入口・森から四体目への進行・全{count}迷宮の入口/最深部・通常セーブ保護')
    browser.close()
