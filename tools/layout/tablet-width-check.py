"""タッチ端末の幅上限を、マウス併用・表示領域変更・復帰後にも確認する。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for touch in [True, False]:
        # hover/pointer はマウス相当のまま、iPadのタッチ対応を再現する。
        page = browser.new_page(viewport={'width': 1024, 'height': 768}, service_workers='block')
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
        for width, height in [(1024,768),(1366,1024),(768,1024),(390,844),(500,700),(1024,768)]:
            page.set_viewport_size({'width': width, 'height': height})
            page.evaluate("window.dispatchEvent(new Event('pageshow'))")
            page.wait_for_timeout(100)
            limit = min(width, 520) if touch else (min(1440, width - 32) if width >= 1100 else 640 if width >= 1000 else min(width, 520))
            for selector in ['#app', '#town-shell', '.ui-sheet']:
                actual = page.locator(selector).evaluate('(el) => el.getBoundingClientRect().width')
                assert 0 < actual <= limit + 1, (touch, width, selector, actual, limit)
            assert page.locator('#app').evaluate('(el) => el.getBoundingClientRect().width') == limit
        print(f'タッチ対応={touch}: マウス併用・6回の幅変更で上限を維持')
        page.close()
    browser.close()
