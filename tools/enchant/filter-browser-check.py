"""付呪の即時特性検索・効果表示・条件記憶・狭い画面での折り返し。localhost:8000。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width, height in [(320, 568), (390, 844), (844, 390), (1280, 800)]:
        page = browser.new_page(viewport={'width': width, 'height': height}, service_workers='block')
        page.route('https://fonts.googleapis.com/**', lambda r: r.fulfill(content_type='text/css', body=''))
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto('http://localhost:8000/?testDungeon=w45&testPlace=town&testUnlock=enchant')
        page.wait_for_function('window.__game?.G.party.length > 0')
        page.add_style_tag(content='.test-play-banner{display:none!important}')
        page.evaluate('''async () => {
          const {game,UI}=await import('/src/ui/ctx.js');
          const {applyAffixes}=await import('/src/infaffix.js');
          const {setPref}=await import('/src/ui/prefs.js');
          const {_TUTS}=await import('/src/ui/tutorial.js');
          window.api=game;window.ui=UI;const g=game.G;
          g.irene.greeted=true;g.tut.cur=null;_TUTS.forEach(t=>g.tut.done[t.key]=true);
          g.insightNotified=Number.MAX_SAFE_INTEGER;g.gold=1e8;
          g.inventory=[];g.shopAfx={};g.shopStock={};
          for (const afx of [[{k:'A07',v:1.4}], [{k:'A07',v:4},{k:'A03',v:3}], [{k:'A03',v:5}], [{k:'J02',v:0.3}]]) {
            const it=game.cloneItem('shortSword',50);it.afx=afx;applyAffixes(it);g.inventory.push(it);
          }
          g.shopStock.shortSword=1;g.shopAfx.shortSword=[{k:'A07',v:6}];
          g.afxPages=[{k:'A07',r:0.2,lv:1},{k:'A03',r:0.2,lv:1}];
          setPref('enchantFilter',{});setPref('shopGearFilter',{effects:['magic']});
          UI.openShop('enchant');
        }''')
        sources = page.locator('.ec-srcs .ec-row')
        assert sources.count() == 5
        assert 'PIE+2' in sources.nth(0).inner_text().replace('\u200b', '')
        page.locator('.ec-filter .gf-open').click()
        panel = page.locator('.gf-sheet')
        panel.locator('.gf-search').fill('PIE')
        panel.locator('[data-filter-key="afx:A07"]').click()
        assert sources.count() == 3
        assert page.locator('.ec-pages .ec-prow').count() == 1
        assert panel.locator('.gf-search').input_value() == 'PIE'
        panel.locator('.gf-search').fill('STR')
        panel.locator('[data-filter-key="afx:A03"]').click()
        assert sources.count() == 4
        panel.locator('.gf-mode input').check()
        assert sources.count() == 1
        assert page.locator('.ec-pages .ec-prow').count() == 0
        panel.locator('.ui-sheet-foot').get_by_role('button', name='すべて解除', exact=True).click()
        assert sources.count() == 5
        assert page.locator('.ec-pages .ec-prow').count() == 2
        panel.locator('[data-filter-key="afx:A03"]').click()
        panel.locator('.gf-search').fill('PIE')
        panel.locator('[data-filter-key="afx:A07"]').click()
        # 選択した条件の札で解除すると、その場で巻物も戻る。
        panel.locator('.gf-picked').get_by_role('button', name='追加：力 ×', exact=True).click()
        assert sources.count() == 3
        panel.locator('.ui-sheet-foot').get_by_role('button', name='閉じる', exact=True).click()
        page.wait_for_timeout(400)
        page.evaluate("ui.openShop('enchant')")
        assert sources.count() == 3
        assert page.evaluate("JSON.parse(localStorage.getItem('dos-ui')).shopGearFilter.effects[0]==='magic'")
        page.locator('.ec-filter-summary').get_by_role('button', name='すべて解除', exact=True).click()
        assert sources.count() == 5
        if width <= 600:
            assert page.locator('.ec-list').evaluate('(e)=>e.clientHeight') >= 180
        # 効果の長文も表示し、一覧の内側を縦にスクロールする。
        sources.last.scroll_into_view_if_needed()
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        assert page.locator('.ec-list').evaluate('(e)=>e.scrollWidth<=e.clientWidth')
        assert sources.last.locator('.ec-val').evaluate('(e)=>e.scrollWidth<=e.clientWidth+1')
        page.screenshot(path=f'/tmp/enchant-filter-{width}.png')
        # 練習の品は前回の絞り込みでは隠れない。
        page.evaluate('''async()=>{
          const {setPref}=await import('/src/ui/prefs.js');
          setPref('enchantFilter',{effects:['afx:J02']});
          api.G.tut.cur='enchant';delete api.G.tut.done.enchant;
          api.G.tut.base={};ui.prepareEnchantTutorial();ui.openShop('enchant');
        }''')
        assert sources.count() == 1
        assert page.locator('.ec-filter .gf-open').count() == 0
        assert not errors, errors
        print(f'{width}x{height}: 即時反映・AND/OR・解除・巻物/棚/持ち物・数値表示・折り返し・練習 OK', flush=True)
        page.close()
    browser.close()
