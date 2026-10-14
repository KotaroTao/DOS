"""localhost:8000で小さな入力画面・IME確定・連続決定・取消を確認する。"""
from playwright.sync_api import sync_playwright, expect

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    context = browser.new_context(viewport={'width': 390, 'height': 844},
        screen={'width': 390, 'height': 844}, is_mobile=True, has_touch=True,
        reduced_motion='reduce', service_workers='block')
    context.add_init_script("Object.defineProperty(screen.orientation, 'type', {value:'portrait-primary'})")
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://localhost:8000/?testDungeon=w01&testPlace=town')
    page.wait_for_function('window.__game?.G.party.length > 0')

    for width, height in [(320, 240), (390, 300), (430, 360)]:
        page.set_viewport_size({'width': width, 'height': height})
        page.evaluate('''async () => {
            const {nameSheet} = await import('/src/ui/party.js');
            window.names = []; window.cancelled = 0;
            window.nameHandle = nameSheet({banner:'人業を仕立てる', title:'魂を宿す人業に、名を',
                desc:'名はあとから変えられる。', random:()=>'別の名',
                onOk:v=>names.push(v), onCancel:()=>cancelled++});
        }''')
        field = page.get_by_label('名前', exact=True)
        field.fill('変換中')
        field.dispatch_event('keydown', {'key': 'Enter', 'isComposing': True})
        field.dispatch_event('keydown', {'key': 'Enter', 'keyCode': 229})
        assert page.evaluate('names.length') == 0
        expect(field).to_be_visible()
        expect(page.locator('#rotate-guard')).to_be_hidden()
        # 連打と、閉じかけのボタンからの再実行をまとめて確認。
        field.evaluate('''e => {
            e.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true}));
            e.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true}));
            nameHandle.opts.footer[0].onTap(nameHandle);
        }''')
        assert page.evaluate('names') == ['変換中']
        page.locator('.pt-name-sheet').wait_for(state='detached')
        assert page.evaluate('cancelled') == 0
        page.evaluate('''async () => {
            const {nameSheet} = await import('/src/ui/party.js');
            window.nameHandle = nameSheet({value:'取り消す名', onOk:v=>names.push(v), onCancel:()=>cancelled++});
        }''')
        page.get_by_role('button', name='やめる', exact=True).click()
        # 取消後の遅延イベントからも決定させない。
        page.evaluate('nameHandle.opts.footer[0].onTap(nameHandle)')
        page.locator('.pt-name-sheet').wait_for(state='detached')
        assert page.evaluate('[names.length, cancelled]') == [1, 1]

        page.evaluate('__game.UI.settingsSheet()')
        page.get_by_role('button', name='プレイヤー名を編集', exact=True).click()
        page.get_by_label('プレイヤー名', exact=True).fill('保存する名')
        page.get_by_role('button', name='保存する', exact=True).click()
        page.locator('.player-name-sheet').wait_for(state='detached')
        assert page.evaluate('__game.G.apprenticeName') == '保存する名'
        page.evaluate("async()=>{const {sheet}=await import('/src/ui/kit.js');sheet.closeAll()}")
        page.locator('.stg-sheet').wait_for(state='detached')

        page.evaluate('__game.UI.openHelp()')
        search = page.get_by_role('searchbox')
        search.fill('魂')
        page.set_viewport_size({'width': width, 'height': 844})
        page.wait_for_timeout(300)  # 街のresize描画が走っても、編集中のシートは残る。
        expect(search).to_have_value('魂')
        page.evaluate("async()=>{const {sheet}=await import('/src/ui/kit.js');sheet.closeAll()}")
        page.locator('.jr-sheet').wait_for(state='detached')
    print('人業のIME・連続決定・取消、低い画面での改名・検索維持: OK')

    page.goto('http://localhost:8000/')
    page.get_by_role('button', name='はじめから').click()
    dialog = page.get_by_role('dialog', name='弟子の名前', exact=True)
    field = dialog.get_by_role('textbox')
    # 濁点が分かれた文字でも、保存時と同じNFCで12文字と数える。
    field.fill('か\u3099' * 12)
    dialog.get_by_role('button', name='旅を始める').click()
    page.wait_for_function('window.__game?.G.apprenticeName === "が".repeat(12)')
    expect(page.locator('.op-scene')).to_be_visible()
    assert not errors, errors
    print('新規入力の濁点・12文字・オープニング開始: OK')
    browser.close()
