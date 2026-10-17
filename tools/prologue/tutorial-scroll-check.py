"""スマートフォンで商会の手ほどきをスワイプし、末尾まで読めることを確認。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for key in ['buyEquipment', 'shopAppraise', 'enchant']:
        page = browser.new_page(viewport={'width': 390, 'height': 600}, is_mobile=True, has_touch=True)
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto('http://localhost:8000/?testScene=tutorial:' + key)
        page.add_style_tag(content='.test-play-banner{display:none!important}')
        page.locator('.ui-tab[data-key="shop"].tut-glow').click()
        body = page.locator('.tut-intro .ui-sheet-body')
        body.wait_for()
        page.wait_for_timeout(700)
        assert body.evaluate('(e)=>e.scrollHeight > e.clientHeight'), '長文をスクロールする条件'
        # 実際のタッチ入力を送る。scrollTopの直接代入では入力制限を検証できない。
        cdp = page.context.new_cdp_session(page)
        box = body.bounding_box()
        x, y = box['x'] + box['width'] / 2, box['y'] + box['height'] - 25
        for _ in range(8):
            cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x, 'y': y}]})
            for step in range(1, 9):
                cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x, 'y': y - step * (box['height'] - 50) / 8}]})
                page.wait_for_timeout(25)
            cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
            page.wait_for_timeout(200)
        assert body.evaluate('(e)=>e.scrollTop > 0 && e.scrollHeight-e.clientHeight-e.scrollTop < 3'), key + ': 末尾までスワイプ'
        assert page.locator('.tut-intro .ui-sheet-foot button').is_visible()
        assert not page.evaluate('(key)=>!!__game.G.tut.done[key]', key), '読むだけでは完了しない'
        page.locator('.tut-intro .ui-sheet-foot button').click()
        page.wait_for_timeout(500)
        assert page.locator('.tut-intro').count() == 0, '説明のあとに次へ進める'
        assert not errors, errors
        print(key + ': タッチ操作で末尾まで読め、次へ進める', flush=True)
        page.close()
    browser.close()
