"""初訪問の挨拶から三体の説明まで同じ会話で続くことを確認。localhost:8000。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width, greeted, skip in [(390, False, False), (1280, False, False), (390, False, True), (390, True, False)]:
        page = browser.new_page(viewport={'width': width, 'height': 844}, reduced_motion='reduce', service_workers='block')
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto('http://localhost:8000/?testScene=prologue:three')
        page.wait_for_function('window.__game?.G.msq.prologue?.phase === "three"')
        page.add_style_tag(content='.test-play-banner{display:none!important}')
        page.evaluate('(greeted)=>__game.G.irene.greeted=greeted', greeted)
        page.locator('.ui-tab[data-key="party"]').click()
        page.wait_for_selector('.iv-scene')
        page.wait_for_function('document.querySelector(".iv-art img")?.naturalWidth === 1536')
        assert page.locator('.iv-dots i').count() == (1 if greeted else 3)
        page.evaluate('window.firstIreneScene=document.querySelector(".iv-scene")')
        if skip:
            page.locator('.iv-skip').click()
        else:
            if not greeted:
                for expected in ['こちらの三体', 'では、王さま']:
                    page.locator('.iv-say').click()
                    assert expected in page.locator('.iv-say').inner_text()
                    assert page.evaluate('firstIreneScene===document.querySelector(".iv-scene")&&!firstIreneScene.classList.contains("out")')
            page.locator('.iv-say').click()
        page.wait_for_selector('.iv-scene', state='detached')
        page.wait_for_selector('.tut-glow')
        assert page.evaluate('__game.G.irene.greeted && __game.G.tut.cur === "createThree"')
        # 光る操作を実際に押し、三体の名前を与えて仕立てまで完了させる。
        for _ in range(40):
            if page.evaluate('!!__game.G.tut.done.createThree'):
                break
            page.locator('.tut-glow:visible').first.click()
            page.wait_for_timeout(350)
        assert page.evaluate('__game.G.tut.done.createThree && __game.G.party.length === 3')
        page.wait_for_selector('.iv-scene:not(.out)')
        for expected in ['三体とも、目を開けましたね。', '近くの森の古屋に', '古屋は二階建てです。']:
            assert expected in page.locator('.iv-say').inner_text()
            page.locator('.iv-say').click()
        page.wait_for_selector('.iv-scene', state='detached')
        assert page.evaluate('__game.G.msq.prologue.phase === "forest" && __game.G.world.open.w00_forest')
        assert not page.locator('.ui-celebrate:visible').count()
        assert not errors, errors
        print(f'{width}px 挨拶済み={greeted} スキップ={skip}: 会話から三体の仕立てまで成功', flush=True)
        page.close()
    browser.close()
