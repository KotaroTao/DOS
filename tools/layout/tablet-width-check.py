"""タッチ端末の幅上限を、マウス併用・表示領域変更・復帰後にも確認する。"""
import os
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    engine = os.environ.get('DOS_TEST_BROWSER', 'chromium')
    browser = p.webkit.launch() if engine == 'webkit' else p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for touch in [True, False]:
        # hover/pointer はマウス相当のまま、iPadのタッチ対応を再現する。
        page = browser.new_page(viewport={'width': 1024, 'height': 768}, service_workers='block')
        page.route('http://localhost:8000/', lambda r:r.fulfill(body='<!doctype html><html></html>', content_type='text/html'))
        page.goto('http://localhost:8000/', wait_until='domcontentloaded')
        page.set_content('''<link rel="stylesheet" href="styles.css">
          <link rel="stylesheet" href="ui.css"><link rel="stylesheet" href="desktop.css">
          <div id="app"></div><div id="town-shell"><div id="town-screen"></div></div>
          <div class="ui-sheet-wrap"><div class="ui-sheet"></div></div>''')
        page.evaluate('''async touch => {
          Object.defineProperty(navigator, 'maxTouchPoints', {value: touch ? 5 : 0});
          await import('./src/desktop.js?tablet-width-check');
        }''', touch)
        page.locator('#app').wait_for(state='attached')
        for width, height in [(820,1180),(1024,768),(1366,1024),(768,1024),(390,844),(500,700),(1024,768)]:
            page.set_viewport_size({'width': width, 'height': height})
            page.evaluate("window.dispatchEvent(new Event('pageshow'))")
            page.wait_for_timeout(100)
            limit = min(width, 520) if touch else (min(1440, width - 32) if width >= 1100 else 640 if width >= 1000 else min(width, 520))
            for selector in ['#app', '#town-shell', '.ui-sheet']:
                actual = page.locator(selector).evaluate('(el) => el.getBoundingClientRect().width')
                assert 0 < actual <= limit + 1, (touch, width, selector, actual, limit)
            assert page.locator('#app').evaluate('(el) => el.getBoundingClientRect().width') == limit
        # 共通幅の変数が無効な場合でも、幅と上限が同時に外れない。
        page.evaluate("document.documentElement.style.setProperty('--game-width', 'initial')")
        for selector in ['#app', '#town-shell', '.ui-sheet']:
            actual = page.locator(selector).evaluate('(el) => el.getBoundingClientRect().width')
            assert 0 < actual <= limit + 1, ('幅の変数が無効', touch, selector, actual, limit)
        print(f'{engine} タッチ対応={touch}: マウス併用・幅変更・幅変数の無効化でも上限を維持')
        page.close()
    # 実際の街・館を、サイズ変更と復帰通知の後にも確認する。
    page = browser.new_page(viewport={'width':820,'height':1180}, has_touch=True, service_workers='block')
    page.route('https://**', lambda r:r.abort())
    page.goto('http://localhost:8000/?testDungeon=w02&testPlace=town', wait_until='domcontentloaded')
    page.wait_for_function('window.__game?.G.party.length > 0')
    page.evaluate('''async () => {
      const {UI,game}=await import('/src/ui/ctx.js');
      game.G.irene.greeted=true; game.G.tut.cur=null;
      const {_TUTS}=await import('/src/ui/tutorial.js'); _TUTS.forEach(t=>game.G.tut.done[t.key]=true);
      UI.shell.setTab('hub');
    }''')
    for invalid in [False,True]:
        if invalid: page.evaluate("document.documentElement.style.setProperty('--game-width','initial')")
        for width,height in [(820,1180),(1180,820),(390,844),(820,1000),(820,1180)]:
            page.set_viewport_size({'width':width,'height':height})
            for tab in ['hub','party','hub']:
                page.evaluate('''async tab => {
                  const {UI}=await import('/src/ui/ctx.js'); UI.shell.setTab(tab);
                  window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));
                  document.dispatchEvent(new Event('visibilitychange'));
                }''', tab)
                page.wait_for_timeout(350)
                page.evaluate('''() => {
                  for(const id of ['app','town-shell']) {
                    const el=document.getElementById(id), r=el.getBoundingClientRect();
                    if(Math.abs(r.width-Math.min(innerWidth,520))>1 || r.left < -1 || r.right>innerWidth+1)
                      throw Error(id+'の幅・中央配置 '+JSON.stringify(r));
                  }
                }''')
    print(f'{engine}: 実画面の街・館・復帰通知と変数無効化で幅520pxを維持')
    page.close()
    browser.close()
