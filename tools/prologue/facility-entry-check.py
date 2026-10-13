"""全手ほどきが街で待ち、対象施設を実クリックして初めて開始する。localhost:8000。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width':390,'height':844})
    page.goto('http://localhost:8000/?testDungeon=w01&testPlace=town')
    page.wait_for_function('window.__game?.G.party.length > 0')
    tutorials = page.evaluate("async()=>{const {_TUTS}=await import('/src/ui/tutorial.js');return _TUTS.map(d=>({key:d.key,facility:d.facility||(d.who==='irene'?'party':d.who)}));}")
    page.close()
    for tutorial in tutorials:
        page = browser.new_page(viewport={'width':390,'height':844})
        errors=[]
        page.on('pageerror', lambda e: errors.append(str(e)))
        key, facility = tutorial['key'], tutorial['facility']
        page.goto('http://localhost:8000/?testScene=tutorial:'+key)
        page.wait_for_function('window.__game?.G.testTutorial')
        page.add_style_tag(content='.test-play-banner{display:none!important}')
        if key in ['createFourth', 'createSixth', 'repairSoul']:
            page.evaluate("async()=>{const {UI}=await import('/src/ui/ctx.js');UI.tutorialAfterReturn();}")
        page.wait_for_timeout(800)
        assert page.evaluate('__game.G.town.tab') == 'hub', key
        assert not page.evaluate('__game.G.tut.cur'), key
        assert page.locator('.tut-intro,.iv-scene,.sc-scene').count() == 0, key
        target = '.hb-tile-tavern' if facility == 'tavern' else '.ui-tab[data-key="'+facility+'"]'
        page.locator(target).click()
        page.wait_for_function('(key)=>__game.G.tut.cur===key', arg=key, timeout=8000)
        assert not errors, (key, errors)
        print(key+': 街 → '+facility+'クリック → 開始', flush=True)
        page.close()
    browser.close()
