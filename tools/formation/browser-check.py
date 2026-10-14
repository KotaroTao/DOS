"""隊列専用画面の実操作・保存・狭い表示と控えへの入口を確認する。localhost:8000。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width, height, count in [(320, 568, 6), (390, 844, 6), (844, 390, 5), (1280, 800, 1)]:
        page = browser.new_page(viewport={'width': width, 'height': height}, service_workers='block')
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto('http://localhost:8000/?testDungeon=w01&testPlace=town')
        page.wait_for_function('window.__game?.G.party.length > 0')
        page.evaluate('''async (count) => {
          const {UI, game}=await import('/src/ui/ctx.js');
          __game.G.party.splice(count);
          __game.G.irene.greeted=true;
          __game.G.tut.done.prologueFormation=true;
          UI.enterMansion();
          window.membersBefore=[...__game.G.party];
          window.saveCalls=0;
          game.autosave=()=>{window.saveCalls++;};
        }''', count)
        page.locator('.pt-mansion-manage').click()
        screen = page.locator('.pt-formation-sheet')
        screen.wait_for(state='visible')
        assert screen.locator('.pt-formation-card').count() == 6
        assert screen.locator('button.pt-formation-card').count() == count
        assert screen.locator('.pt-head,.pt-side,.pt-equip-actions,.pt-stability,.pt-port-hp').count() == 0
        assert screen.locator('.pt-formation-card.selected').count() == 1
        screen.locator('.selected').click()
        assert screen.locator('.selected').count() == 0
        cards = screen.locator('button.pt-formation-card')
        cards.first.focus()
        page.keyboard.press('Enter')
        assert screen.locator('.selected').count() == 1
        if count > 1:
            cards.nth(count-1).click()
            assert page.evaluate('''()=>__game.G.party[0]===membersBefore[membersBefore.length-1]
              && __game.G.party[__game.G.party.length-1]===membersBefore[0] && saveCalls===1''')
            assert screen.locator('.selected').count() == 0
            cards.first.click()
            cards.nth(count-1).click()
            assert page.evaluate('()=>__game.G.party.every((d,i)=>d===membersBefore[i]) && saveCalls===2')
        assert screen.locator('.ui-sheet-body').evaluate('(e)=>e.scrollWidth<=e.clientWidth+1')
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        for i in range(count):
            assert cards.nth(i).bounding_box()['width'] >= 44
            assert cards.nth(i).bounding_box()['height'] >= 44
        screen.get_by_role('button', name='閉じる', exact=True).click()
        page.wait_for_timeout(400)
        page.locator('.pt-mansion-links .pt-bench').first.click()
        assert page.locator('.pt-res-sheet').is_visible()
        assert not errors, errors
        print(f'{width}×{height}: {count}体・操作・保存・控え入口・横幅 OK', flush=True)
        page.close()
    browser.close()
