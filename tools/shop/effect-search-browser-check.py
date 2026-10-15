"""商会の武器種別と特殊効果検索、在庫別判定、館と別の条件記憶。localhost:8000。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    for width,height in [(390,844),(320,568),(844,390)]:
        page=browser.new_page(viewport={'width':width,'height':height},service_workers='block')
        # 外部フォントの応答待ちを除き、ゲームの操作を確認する。
        page.route('https://fonts.googleapis.com/**',lambda route:route.fulfill(content_type='text/css',body=''))
        errors=[]
        page.on('pageerror',lambda e:(errors.append(str(e)),print(str(e),flush=True)))
        page.goto('http://localhost:8000/?testDungeon=w05&testPlace=town')
        page.wait_for_function('window.__game?.G.party.length === 6')
        page.add_style_tag(content='.test-play-banner{display:none!important}')
        page.evaluate('''async()=>{
          const {UI,game}=await import('/src/ui/ctx.js');
          const {setPref}=await import('/src/ui/prefs.js');
          const {_TUTS}=await import('/src/ui/tutorial.js');
          window.api=game;window.ui=UI;const g=game.G;
          g.irene.greeted=true;g.tut.cur=null;_TUTS.forEach(t=>g.tut.done[t.key]=true);
          g.gold=10000000;g.insightNotified=Number.MAX_SAFE_INTEGER;
          g.shopStock={w_funeral_blade:1,w_r4_magicsword:1,shortSword:2,w_rainmaker_bow:1};
          g.shopAfx={shortSword:[{k:'J08',v:0.05}]};
          setPref('gearFilter',{elements:['eDef:fire'],effects:[],allEffects:false});
          setPref('shopGearFilter',{});setPref('shopDollUid',g.party[0].uid);
          ui.openShop('buy',{cat:'weapon'});
        }''')
        assert page.locator('.wpc-srow').count()==5
        page.locator('.wpc-kindbtn').click()
        page.locator('.wpc-kindgrid').get_by_role('button',name='長剣',exact=False).click()
        assert page.locator('.wpc-srow').count()==4
        page.locator('.wpc-lhead .gf-open').click()
        panel=page.locator('.gf-sheet')
        panel.locator('.gf-search').fill('魔法ダメージ')
        effect=panel.locator('[data-filter-key="magic"]')
        assert effect.count()==1
        assert '2' in effect.inner_text()
        effect.click()
        panel.get_by_role('button',name='2点を表示',exact=True).click()
        page.wait_for_timeout(650)
        assert page.locator('.wpc-srow').count()==2
        assert '魔法属性' in page.locator('.wpc-shop > .gf-summary').inner_text()
        assert page.evaluate("JSON.parse(localStorage.getItem('dos-ui')).gearFilter.elements[0]==='eDef:fire'")
        assert page.evaluate("JSON.parse(localStorage.getItem('dos-ui')).shopGearFilter.effects[0]==='magic'")
        # 選択者を切り替えても検索条件は保ち、通常の棚の品は変わらない。
        page.locator('.wpc-character').nth(1).click()
        assert page.locator('.wpc-srow').count()==2
        page.locator('.wpc-kindbtn').click()
        page.locator('.wpc-kindgrid').get_by_role('button',name='弓',exact=False).click()
        assert page.locator('.wpc-srow').count()==1
        assert '雨乞い' in page.locator('.wpc-srow').inner_text()
        page.screenshot(path=f'/tmp/shop-effect-search-{width}.png')
        # 分類を変えて0件になっても条件と解除を表示する。
        page.evaluate("ui.openShop('buy',{cat:'body'})")
        assert page.locator('.wpc-srow').count()==0
        assert '魔法属性' in page.locator('.wpc-shop > .gf-summary').inner_text()
        page.locator('.wpc-shop > .gf-summary').get_by_role('button',name='すべて解除',exact=True).click()
        page.evaluate("async()=>{const {remember}=await import('/src/ui/prefs.js');remember('seg','shopWeapon','ls');ui.openShop('buy',{cat:'weapon'})}")
        # 追加品の吸血だけを検索し、同じIDの通常品を混ぜない。
        page.locator('.wpc-lhead .gf-open').click()
        panel=page.locator('.gf-sheet')
        panel.locator('.gf-search').fill('吸血')
        panel.locator('[data-filter-key="eff:lifesteal"]').click()
        panel.get_by_role('button',name='1点を表示',exact=True).click()
        page.wait_for_timeout(650)
        assert page.locator('.wpc-srow').count()==1
        assert page.locator('.wpc-srow.afx').count()==1
        # 絞り込み後の購入で在庫と所持金が更新され、売り切れなら条件を残す。
        gold=page.evaluate('api.G.gold')
        page.locator('.wpc-srow.afx .wpc-buy-main').click()
        assert page.evaluate('api.G.gold')<gold
        assert page.evaluate('api.G.shopStock.shortSword')==1
        assert page.locator('.wpc-srow').count()==0
        assert '吸血' in page.locator('.wpc-shop > .gf-summary').inner_text()
        page.locator('.wpc-shop > .gf-summary').get_by_role('button',name='すべて解除',exact=True).click()
        assert page.locator('.wpc-srow').count()==3
        # 館は元の条件のまま。手ほどき用に商会条件を解除する入口も確認。
        page.evaluate('''async()=>{
          const {setPref,getPref}=await import('/src/ui/prefs.js');
          if(getPref('gearFilter').elements[0]!=='eDef:fire')throw Error('館の条件が上書きされた');
          setPref('shopGearFilter',{effects:['magic'],elements:[]});
          ui.openShop('buy',{cat:'rec',clearFilters:true});
          if(getPref('shopGearFilter').effects?.length)throw Error('購入の手ほどきで条件を解除できない');
        }''')
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        assert not errors,errors
        print(f'{width}x{height}: 魔法ダメージ検索・武器種別・追加品の分離・購入・条件記憶 OK',flush=True)
        page.close()
    browser.close()
