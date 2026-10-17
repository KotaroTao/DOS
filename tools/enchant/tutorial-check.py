"""付呪の実操作・取消・保存再開と、通常資産の保全。localhost:8000。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 390, 'height': 700}, reduced_motion='reduce')
    page.set_default_timeout(30000)
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://localhost:8000/?testScene=tutorial:enchant')
    page.wait_for_function('window.__game?.G.testTutorial === "enchant"')
    page.add_style_tag(content='.test-play-banner{display:none!important}')
    # 既存の巻物や在庫があっても、練習では表示・消費しない。金貨0、袋満杯でも始められる。
    before = page.evaluate('''async () => {
      const {game}=await import('/src/ui/ctx.js');
      const G=__game.G;
      G.gold=0; G.afxPages=[{k:'A04',r:0.2}];
      G.inventory=Array.from({length:50},()=>game.cloneItem('shortSword',50));
      window.assets=()=>JSON.stringify({gold:G.gold,items:G.inventory,stock:G.shopStock,afx:G.shopAfx,pages:G.afxPages,stats:G.stats.enchant});
      return assets();
    }''')
    page.locator('.ui-tab[data-key="shop"].tut-glow').click()
    page.locator('.tut-intro .ui-sheet-foot button').click()
    page.locator('.ec-srcs .wpc-srow-info.tut-glow').click()
    page.locator('.ec-extract.tut-glow').click()
    # 確認を取り消せる。品と巻物は変わらない。
    page.locator('.ui-confirm .ui-btn.k-ghost').click()
    assert page.evaluate('__game.G.tut.base.enchantPractice.source !== null')
    page.locator('.ec-extract.tut-glow').click()
    page.locator('.ui-confirm .ui-btn.k-danger').click()
    page.wait_for_function('__game.G.tut.step === 1')
    assert page.evaluate('__game.G.tut.base.enchantPractice.page.k') == 'A03'
    assert page.evaluate('assets()') == before
    # 保存と同じJSON往復を行い、途中から再開する。素材は再配布されない。
    page.evaluate('''async()=>{
      const {UI}=await import('/src/ui/ctx.js');
      __game.G.tut=JSON.parse(JSON.stringify(__game.G.tut));
      UI.openShop('enchant'); UI.tutorialResume();
    }''')
    page.locator('.ec-prow .wpc-buy-main.tut-glow').click()
    page.locator('.ec-write.tut-glow').click()
    assert '費用はかからない' in page.locator('.ui-confirm').inner_text().replace('\u200b','')
    page.locator('.ui-confirm .ui-btn.k-ghost').click()
    assert page.evaluate('__game.G.tut.base.enchantPractice.page.k') == 'A03'
    page.locator('.ec-write.tut-glow').click()
    page.locator('.ui-confirm .ui-btn.k-primary').click()
    page.wait_for_function('__game.G.tut.done.enchant === true')
    assert page.evaluate('assets()') == before
    assert not page.evaluate('__game.G.tut.base.enchantPractice')
    page.get_by_role('button', name='心得た', exact=True).click()
    # 既存記録: 未習得なら案内し、既に書き込み済みなら済み扱い。
    result = page.evaluate('''async()=>{
      const {UI,game}=await import('/src/ui/ctx.js');
      const G=__game.G;
      G.testPlay=false; G.testUnlock=[]; G.tut.affixReturned=true;
      delete G.tut.done.enchant; G.stats.enchant={written:0};
      const fresh=UI.tutorialPending()?.key;
      G.stats.enchant.written=1;
      const used=UI.tutorialPending();
      return {fresh,used,done:G.tut.done.enchant};
    }''')
    assert result == {'fresh':'enchant','used':None,'done':True}, result
    page.goto('http://localhost:8000/?testScene=tutorial:extremeAffix')
    page.wait_for_function('window.__game?.G.testTutorial === "extremeAffix"')
    page.add_style_tag(content='.test-play-banner{display:none!important}')
    page.locator('.ui-tab[data-key="shop"].tut-glow').click()
    intro = page.locator('.tut-intro')
    text = intro.inner_text().replace('\u200b', '')
    assert '拾った時から極をいくつも持つ品' in text
    assert '極がまだ付いていない装備だけ' in text
    intro.locator('.ui-sheet-foot button').click()
    page.wait_for_function('__game.G.tut.done.extremeAffix === true')
    assert not errors, errors
    print('OK: 写し取り・書き込み・確認の取消・途中保存再開・金貨0/袋満杯・通常資産保全・既存記録の案内')
    browser.close()
