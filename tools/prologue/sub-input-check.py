"""サブ魂の手ほどきで、光る候補以外の魂・技とスクロールを受け付ける。"""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    for width in [390,1280]:
        page=b.new_page(viewport={'width':width,'height':844},reduced_motion='reduce');errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto('http://localhost:8000/?testScene=tutorial:sub1')
        page.wait_for_function('window.__game?.G.party.length>0')
        page.add_style_tag(content='.test-play-banner{display:none!important}')
        # 余り魂を複数用意し、最初に光る候補とは別の魂を選ぶ。
        page.evaluate("async()=>{const {game}=await import('/src/ui/ctx.js');game.addSoulInstance('priest');game.addSoulInstance('thief');}")
        for _ in range(30):
            page.wait_for_timeout(150)
            if page.locator('.sp-pick-sheet .sp-srow').count():break
            skip=page.locator('.iv-scene:not(.out) .iv-skip:visible,.sc-scene:not(.out) .sc-skip:visible')
            if skip.count():skip.first.click();continue
            glow=page.locator('.tut-glow:visible')
            if glow.count():glow.first.click()
        picker=page.locator('.sp-pick-sheet').last
        candidates=picker.locator('.sp-srow:not(.cur):not(.taken) .sp-srow-main:not(:disabled)')
        assert candidates.count()>=2
        chosen=candidates.last
        expected=chosen.locator('..').get_attribute('data-job')
        assert 'tut-glow' not in (chosen.get_attribute('class') or '')
        assert picker.locator('.ui-sheet-body').evaluate("e=>e.dispatchEvent(new Event('touchstart',{bubbles:true,cancelable:true}))")
        chosen.click()
        page.locator('.ui-confirm .ui-sheet-foot .k-primary').click()
        page.wait_for_timeout(250)
        skills=page.locator('.sp-pick-sheet .ui-row')
        skills.last.wait_for()
        skills.last.click()
        for _ in range(30):
            page.wait_for_timeout(150)
            if page.evaluate('!!__game.G.tut.done.sub1'):break
            skip=page.locator('.iv-scene:not(.out) .iv-skip:visible,.sc-scene:not(.out) .sc-skip:visible')
            if skip.count():skip.first.click();continue
            glow=page.locator('.tut-glow:visible')
            if glow.count():glow.first.click()
        assert page.evaluate('!!__game.G.tut.done.sub1')
        assert page.evaluate('expected=>{const d=__game.G.party.find(d=>d.subs?.length);return __game.G.souls.find(s=>s.uid===d.subs[0].uid).clsKey===expected}',expected)
        assert not errors,errors
        print(str(width)+'px: 光る候補以外の魂・技を選択、タッチスクロール、確認、手ほどき完了 OK')
        page.close()
    b.close()
