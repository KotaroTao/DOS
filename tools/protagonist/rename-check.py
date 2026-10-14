"""手帳・街の改名、取消、保存復元、無限迷宮・戦闘の確認。localhost:8000。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    context = browser.new_context(viewport={'width':390,'height':844}, reduced_motion='reduce', service_workers='block')
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://localhost:8000/?testDungeon=w01')
    page.wait_for_function('window.__game?.G.board')
    # 試遊では名前が付く。名前のない旧記録は明示的に用意する。
    page.evaluate('__game.G.apprenticeName = ""')
    page.evaluate("localStorage.setItem('dos-save-v7', __game.inf.saveJSON())")
    page.goto('http://localhost:8000/')
    page.get_by_role('button', name='つづきから').click()
    page.locator('.ttl-overlay').wait_for(state='detached')
    page.evaluate('__game.UI.openDungeonMenu()')
    assert page.locator('.dg-menu .ui-sheet-body > :first-child').get_attribute('class') == 'player-name-card'
    assert page.locator('.player-name-value').inner_text() == '名前未設定'

    def edit(value):
        page.get_by_role('button', name='プレイヤー名を編集', exact=True).click()
        page.get_by_label('プレイヤー名', exact=True).fill(value)

    edit('捨てる名前')
    page.get_by_role('button', name='やめる', exact=True).click()
    page.locator('.player-name-sheet').wait_for(state='detached')
    assert page.evaluate('__game.G.apprenticeName') == ''
    edit('　 ')
    page.get_by_role('button', name='保存する', exact=True).click()
    assert page.get_by_role('alert').inner_text().replace('\u200b','') == '名前を入力してください。'
    inp = page.get_by_label('プレイヤー名', exact=True)
    inp.fill('あ' * 13)
    inp.press('Enter')
    assert '12文字以内' in page.get_by_role('alert').inner_text().replace('\u200b','')
    inp.fill('リュカ')
    inp.dispatch_event('keydown', {'key':'Enter','isComposing':True})
    assert page.evaluate('__game.G.apprenticeName') == ''
    before = page.evaluate('JSON.stringify([__game.G.gold,__game.G.redSoul,__game.G.floor,__game.G.px,__game.G.py,__game.G.rng])')
    inp.press('Enter')
    page.locator('.player-name-sheet').wait_for(state='detached')
    assert page.locator('.player-name-value').inner_text() == 'リュカ'
    assert before == page.evaluate('JSON.stringify([__game.G.gold,__game.G.redSoul,__game.G.floor,__game.G.px,__game.G.py,__game.G.rng])')
    assert page.locator('.dg-menu').is_visible()
    assert page.evaluate("async()=>{const {storyText}=await import('/src/protagonist.js');return storyText('{弟子名:様}',__game.G)}") == 'リュカ様'
    assert page.locator('.player-name-text').evaluate('(e)=>e.clientWidth>150')
    page.screenshot(path='/tmp/notebook-player-name.png')
    page.reload()
    page.get_by_role('button', name='つづきから').wait_for()
    assert page.evaluate('__game.G.apprenticeName') == 'リュカ'
    print('手帳の最上部・旧セーブ・取消・IME・制限・即時反映・無料・再開: OK')

    # 街でも設定から改名できる。
    page.get_by_role('button', name='つづきから').click()
    page.locator('.ttl-overlay').wait_for(state='detached')
    page.evaluate("__game.G.state='town'; __game.UI.settingsSheet()")
    edit('セイン')
    page.get_by_role('button', name='保存する', exact=True).click()
    page.locator('.player-name-sheet').wait_for(state='detached')
    assert page.locator('.stg-sheet .player-name-value').inner_text() == 'セイン'
    page.reload()
    page.get_by_role('button', name='つづきから').wait_for()
    assert page.evaluate('__game.G.apprenticeName') == 'セイン'
    print('街の設定・何度でも変更・保存: OK')

    page.goto('http://localhost:8000/?testInf=76')
    page.wait_for_function('window.__game?.G.abyss')
    page.evaluate('__game.UI.openDungeonMenu()')
    edit('あいうえおかきくけこさし')
    page.get_by_role('button', name='保存する', exact=True).click()
    page.locator('.player-name-sheet').wait_for(state='detached')
    page.set_viewport_size({'width':320,'height':640})
    assert page.locator('.player-name-card').evaluate('(e)=>e.scrollWidth<=e.clientWidth')
    page.get_by_role('button',name='探索に戻る',exact=True).click()
    page.locator('.dg-menu').wait_for(state='detached')
    # 戦闘中の手帳と同じ状態分岐。編集を閉じても親の手帳が一時停止を保つ。
    page.evaluate("__game.G.state='combat'; __game.UI.openDungeonMenu()")
    # 見識の解放案内など、手帳の下に残るシートも含めた深さを保つ。
    parent_depth = page.evaluate("async()=>{const {sheetDepth}=await import('/src/ui/kit.js');return sheetDepth()}")
    edit('戦いの灯')
    page.get_by_role('button',name='保存する',exact=True).click()
    page.locator('.player-name-sheet').wait_for(state='detached')
    assert page.evaluate('__game.G.apprenticeName') == '戦いの灯'
    assert page.get_by_role('button',name='戦闘に戻る',exact=True).is_visible()
    assert page.evaluate("async()=>{const {sheetDepth}=await import('/src/ui/kit.js');return sheetDepth()}") == parent_depth
    print('無限迷宮・12文字・320px・戦闘中の一時停止維持: OK')
    assert not errors, errors
    browser.close()
