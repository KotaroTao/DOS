"""試遊の全手ほどき・解放説明の掲載、検索・開始、通常記録の保護。localhost:8000。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox', '--disable-dev-shm-usage'])
    page = browser.new_page(viewport={'width': 390, 'height': 844}, service_workers='block', reduced_motion='reduce')
    page.route('https://**/*', lambda route: route.abort())
    page.set_default_timeout(120000)
    page.add_init_script("window.requestAnimationFrame=f=>setTimeout(()=>f(performance.now()),100);window.cancelAnimationFrame=clearTimeout")
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))

    def visit(query=''):
        page.goto('http://localhost:8000/' + query, wait_until='domcontentloaded')
        page.wait_for_function('window.__game?.G && !document.body.classList.contains("booting")')

    def open_tests(mode='tutorial'):
        page.get_by_role('button', name='テストプレイ', exact=False).click()
        page.get_by_label('テストする内容', exact=True).select_option(mode)

    def ids():
        return page.get_by_label('場面', exact=True).locator('option').evaluate_all('(os)=>os.map(o=>o.value)')

    visit('?testDungeon=w01&testPlace=town')
    saved = page.evaluate('localStorage["dos-save-v7"] = __game.inf.saveJSON()')
    expected = page.evaluate('''async () => {
      const {UNLOCKS} = await import('/src/story.js');
      const {testTutorials} = await import('/src/ui/tutorial.js');
      return {actions: testTutorials.map(t=>t.id), unlocks: Object.entries(UNLOCKS).filter(([k,d])=>d.lines?.length).map(([k,d])=>({id:'unlock:'+k,title:d.title}))};
    }''')
    visit()
    open_tests()
    all_ids = ids()
    assert len(all_ids) == len(set(all_ids)), '同じ場面を重複掲載しない'
    assert all_ids == expected['actions'] + [s['id'] for s in expected['unlocks']], '台帳の全手ほどき・本文のある解放説明を掲載'
    groups = page.get_by_label('場面の種類・章', exact=True)
    groups.select_option('操作の手ほどき')
    assert ids() == expected['actions']
    groups.select_option('機能の解放')
    assert ids() == [s['id'] for s in expected['unlocks']]
    # 説明が空の旧IDは、操作の手ほどきから確認できる。
    assert 'unlock:soulChange' not in ids()
    # 従来のストーリー側からも、同じURLの解放説明を選べる。
    page.get_by_label('テストする内容', exact=True).select_option('story')
    assert set(s['id'] for s in expected['unlocks']).issubset(ids())
    # タイトルの選択から付呪を実際に開始する。
    page.get_by_label('テストする内容', exact=True).select_option('tutorial')
    page.get_by_label('場面を探す', exact=True).fill('付呪')
    assert ids() == ['tutorial:enchant', 'unlock:enchant']
    page.get_by_label('場面', exact=True).select_option('unlock:enchant')
    page.locator('.ttl-test button').last.click()
    page.wait_for_selector('.sc-title')
    assert '付呪' in page.locator('.sc-title').inner_text()
    assert page.evaluate('__game.G.testPlay && !__game.G.testTutorial')
    assert page.evaluate('localStorage["dos-save-v7"]') == saved
    # 全解放説明が、操作誘導を誤起動せず会話として再生される。
    for scene in expected['unlocks']:
        visit('?testScene=' + scene['id'])
        page.wait_for_selector('.sc-title')
        title = page.locator('.sc-title').inner_text().replace('\u200b', '')
        assert title == scene['title'], (scene['id'], title)
        assert page.evaluate('__game.G.testPlay && !__game.G.testTutorial')
        assert page.evaluate('localStorage["dos-save-v7"]') == saved
    # 既存の操作形式の手ほどきも、同じチュートリアル一覧から開始できる。
    visit()
    open_tests()
    page.get_by_label('場面を探す', exact=True).fill('魂を強化')
    assert ids() == ['tutorial:trainSoul']
    page.locator('.ttl-test button').last.click()
    page.wait_for_function('window.__game?.G.testTutorial === "trainSoul"')
    pending = page.evaluate('async()=>{const {UI}=await import("/src/ui/ctx.js");return UI.tutorialPending?.()?.key}')
    assert pending == 'trainSoul'
    assert page.evaluate('localStorage["dos-save-v7"]') == saved
    assert not errors, errors
    print(f'OK: 操作の手ほどき{len(expected["actions"])}件・解放説明{len(expected["unlocks"])}件、分類・検索・全説明の再生・操作形式の開始・通常記録の保護', flush=True)
    browser.close()
