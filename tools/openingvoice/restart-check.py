"""記録消去後の語りを検証。先にルートで HTTP サーバーを8000番で起動する。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    # OS の音声に依存せず、再生要求が操作後に届くことを検査する。
    page.add_init_script('''
      window.spoken = [];
      window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
      Object.defineProperty(window, 'speechSynthesis', { value: {
        getVoices: () => [{name: 'Daniel', lang: 'en-GB', localService: true}],
        addEventListener() {}, removeEventListener() {}, cancel() {},
        speak(u) {
          spoken.push({text: u.text, active: navigator.userActivation.isActive});
          if (navigator.userActivation.isActive) u.onstart();
          else u.onerror({error: 'not-allowed'});
        }
      }});
    ''')
    page.goto('http://localhost:8000/')
    page.locator('.ttl-btns > .ttl-btn.primary').click()
    page.locator('.ttl-name input').fill('最初の弟子')
    page.locator('.ttl-name button[type=submit]').click()
    page.locator('.op-overlay').wait_for()
    assert page.evaluate('spoken.length === 1 && spoken[0].active')
    page.reload()
    page.locator('.ttl-btns > .ttl-btn.primary').wait_for()
    page.get_by_text('はじめから', exact=True).click()
    page.locator('.ttl-name input').fill('新しい弟子')
    page.locator('.ttl-name button[type=submit]').click()
    # 取消では既存の記録が残る。
    before = page.evaluate('localStorage.getItem("dos-save-v7")')
    page.get_by_text('やめる', exact=True).click()
    assert page.evaluate('localStorage.getItem("dos-save-v7")') == before
    page.get_by_text('はじめから', exact=True).click()
    page.locator('.ttl-name button[type=submit]').click()
    with page.expect_navigation():
        page.get_by_text('消して始める', exact=True).click()
    page.get_by_text('物語を始める', exact=True).wait_for()
    page.wait_for_timeout(16000)  # 旧実装の音声開始待ちの期限を越えても序章を進めない。
    assert page.locator('.op-overlay').count() == 0
    assert page.evaluate('spoken.length') == 0
    assert page.evaluate('localStorage.getItem("dos-save-v7")') is None
    page.get_by_text('物語を始める', exact=True).click()
    page.locator('.op-overlay').wait_for()
    assert page.evaluate('spoken.length === 1 && spoken[0].active')
    assert page.evaluate('spoken[0].text') == 'One night, the earth of the kingdom split apart.'
    assert page.evaluate('window.__game.G.apprenticeName') == '新しい弟子'
    assert page.locator('.ttl-name:not(.hidden)').count() == 0
    page.locator('.op-skip').click()
    page.locator('.op-overlay').wait_for(state='detached')
    page.reload()
    page.locator('.ttl-btns > .ttl-btn.primary').click()
    page.wait_for_timeout(1000)
    assert page.locator('.op-overlay').count() == 0
    assert page.evaluate('spoken.length') == 0
    assert not errors, errors
    browser.close()
    print('初回開始・取消・記録消去・開始待ち・語りの再生許可・名前引継ぎ・スキップ・続きから OK')
