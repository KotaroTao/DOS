"""localhost:8000で縦持ちの名前入力と、端末回転時の案内を確認する。"""
from playwright.sync_api import sync_playwright, expect

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    context = browser.new_context(
        viewport={'width': 390, 'height': 844}, screen={'width': 390, 'height': 844},
        is_mobile=True, has_touch=True, reduced_motion='reduce', service_workers='block')
    # 表示領域の縮小とは独立して、実際の端末の向きを再現する。
    context.add_init_script('''
        window.deviceOrientation = 'portrait-primary';
        Object.defineProperty(screen.orientation, 'type', {get: () => window.deviceOrientation});
    ''')
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://localhost:8000/')
    page.get_by_role('button', name='はじめから').click()
    dialog = page.get_by_role('dialog', name='弟子の名前', exact=True)
    field = dialog.get_by_role('textbox')
    field.focus()
    # Android のキーボードがレイアウト領域も縮める状況。
    page.set_viewport_size({'width': 390, 'height': 300})
    page.wait_for_function('matchMedia("(orientation: landscape)").matches')
    expect(page.locator('#rotate-guard')).to_be_hidden()
    expect(dialog).to_be_visible()
    field.fill('リュカ')
    dialog.get_by_role('button', name='旅を始める').click()
    page.wait_for_function('window.__game?.G.apprenticeName === "リュカ"')
    expect(page.locator('.op-scene')).to_be_visible()
    expect(page.locator('#rotate-guard')).to_be_hidden()

    for orientation in ['landscape-primary', 'landscape-secondary', 'portrait-secondary', 'portrait-primary']:
        page.evaluate('''type => {
            window.deviceOrientation = type;
            screen.orientation.dispatchEvent(new Event('change'));
        }''', orientation)
        if orientation.startswith('landscape'):
            expect(page.locator('#rotate-guard')).to_be_visible()
            expect(page.locator('#ui-layer')).to_have_css('visibility', 'hidden')
            expect(page.locator('#app')).to_have_css('visibility', 'hidden')
        else:
            expect(page.locator('#rotate-guard')).to_be_hidden()
            expect(page.locator('#ui-layer')).to_have_css('visibility', 'visible')
            expect(page.locator('#app')).to_have_css('visibility', 'visible')
    assert not errors, errors
    context.close()

    # Screen Orientation API がない端末でも、ロック未対応の早期 return 前に判定する。
    for legacy in [True, False]:
        context = browser.new_context(
            viewport={'width': 390, 'height': 300}, screen={'width': 390, 'height': 844},
            is_mobile=True, has_touch=True, service_workers='block')
        context.add_init_script('''
            Object.defineProperty(screen, 'orientation', {value: undefined});
            Object.defineProperty(window, 'orientation', {value: %s, writable: true});
        ''' % ('0' if legacy else 'undefined'))
        page = context.new_page()
        page.goto('http://localhost:8000/')
        expect(page.locator('#rotate-guard')).to_be_hidden()
        if legacy:
            page.evaluate("window.orientation = -90; window.dispatchEvent(new Event('orientationchange'))")
        else:
            page.evaluate('''() => {
                Object.defineProperty(screen, 'width', {value: 844});
                Object.defineProperty(screen, 'height', {value: 390});
                window.dispatchEvent(new Event('resize'));
            }''')
        expect(page.locator('#rotate-guard')).to_be_visible()
        context.close()

    # 横向きでも PC と背の高いタブレットは案内の対象外。
    for width, height, mobile in [(900, 400, False), (1024, 768, True)]:
        context = browser.new_context(viewport={'width': width, 'height': height},
                                      is_mobile=mobile, has_touch=mobile, service_workers='block')
        page = context.new_page()
        page.goto('http://localhost:8000/')
        expect(page.locator('#rotate-guard')).to_be_hidden()
        context.close()
    browser.close()
    print('縦持ちの入力・オープニング開始・回転・旧API・PC/タブレット: OK')
