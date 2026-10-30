"""起動ロゴの表示時間・フェード・クリック透過防止を実画面で確認する。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width, height in [(1180, 820), (390, 844)]:
        page = browser.new_page(viewport={'width': width, 'height': height}, service_workers='block')
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.add_init_script("""
          window.brandTimes = {};
          document.addEventListener('load', e => {
            if(e.target.matches?.('#studio-splash img')) brandTimes.loaded = performance.now();
          }, true);
          new MutationObserver(() => {
            if(document.querySelector('#studio-splash.studio-fading')) brandTimes.fade ??= performance.now();
          }).observe(document, {subtree:true, attributes:true, childList:true});
        """)
        page.goto('http://localhost:8000/', wait_until='commit')
        splash = page.locator('#studio-splash')
        splash.wait_for(state='visible')
        page.wait_for_function('document.querySelector("#studio-splash img").naturalWidth > 0')
        page.locator('.image-loading').first.wait_for(state='attached')
        assert page.evaluate("""() => {
          const booting = document.body.classList.contains('booting');
          document.body.classList.add('booting');
          const hidden = getComputedStyle(document.querySelector('.image-loading')).display === 'none';
          if (!booting) document.body.classList.remove('booting');
          return hidden;
        }""")
        assert page.evaluate('document.elementFromPoint(innerWidth/2,innerHeight/2).closest("#studio-splash") !== null')
        page.wait_for_function('document.querySelector("#studio-splash")?.classList.contains("studio-fading")', timeout=15000)
        assert page.locator('.image-loading').first.is_hidden()
        assert page.locator('.ttl-overlay').count() == 1
        assert page.evaluate('brandTimes.fade - brandTimes.loaded >= 4900')
        splash.wait_for(state='detached')
        assert page.evaluate("""() => {
          const lamp = document.querySelector('.image-loading');
          const state = lamp.dataset.state;
          lamp.dataset.state = 'loading';
          const restored = getComputedStyle(lamp).display !== 'none';
          lamp.dataset.state = state;
          return restored;
        }""")
        assert not errors, errors
        page.reload(wait_until='commit')
        page.wait_for_function('document.querySelector(".ttl-overlay") && !document.body.matches(".booting,.screen-loading,.scene-preparing")')
        page.mouse.click(width / 2, height / 2)
        splash.wait_for(state='detached', timeout=1000)
        assert page.locator('.ttl-overlay').count() == 1
        assert page.locator('.ttl-name:not(.hidden)').count() == 0
        assert not errors, errors
        print(f'PASS {width}x{height}: 5秒表示、フェード、クリックで即時スキップ、タイトルへのクリック透過なし')
        page.close()
    page = browser.new_page(service_workers='block', reduced_motion='reduce')
    page.route('**/art/branding/dead-sea-games.webp', lambda route: route.abort())
    page.goto('http://localhost:8000/', wait_until='commit')
    page.locator('#studio-splash span').wait_for(state='visible')
    page.keyboard.press('Enter')
    page.locator('#studio-splash').wait_for(state='detached', timeout=15000)
    assert page.locator('.ttl-overlay').count() == 1
    print('PASS: 画像失敗時の代替文字・キーボードスキップ・動きを減らす設定')
    browser.close()
