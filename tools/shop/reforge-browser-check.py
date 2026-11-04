"""鍛え直しと武魂の共通装備欄・品質・人業切替・確認時の無課金を実画面で確認。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width, height in [(320,568), (390,844), (844,390), (1440,900)]:
        page = browser.new_page(viewport={'width':width,'height':height}, service_workers='block', reduced_motion='reduce')
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto('http://localhost:8000/?testDungeon=w45&testPlace=town')
        page.wait_for_function('window.__game?.G.party.length>0')
        page.locator('#studio-splash').wait_for(state='detached')
        page.evaluate('''async()=>{
          const {game,UI}=await import('/src/ui/ctx.js');
          const {_TUTS}=await import('/src/ui/tutorial.js');
          const {SLOTS}=await import('/src/items.js');
          Object.assign(window,{api:game,ui:UI}); const g=game.G;g.tut.cur=null;
          _TUTS.forEach(t=>g.tut.done[t.key]=true);g.irene.greeted=true;g.insightNotified=Number.MAX_SAFE_INTEGER;
          g.testUnlock=['forge','enchant'];g.bukonGift=true;g.gold=1234567;
          game.allDolls().forEach((d,i)=>{for(const k of SLOTS)d.equip[k]=null;
            d.equip.weapon=game.cloneItem('shortSword',20+i*10);d.equip.weapon.rar='r';d.equip.weapon.bukon=[{k:'flat_hp',lv:1}];});
          window.signature=()=>JSON.stringify({gold:g.gold,rng:g.rng,equip:game.allDolls().map(d=>d.equip)});
          window.before=signature(); UI.openShop('enchant');
        }''')
        cells=page.locator('.bk-equipment .pt-slot')
        slots=cells.count()
        assert page.locator('.pt-slot-t .bk-name-line').count() or 'HP' in page.locator('.bk-equipment').inner_text()
        page.evaluate("ui.openShop('forge')")
        assert cells.count()==slots
        assert not page.locator('.rf-controls, .rf-guide, .rf-list').count()
        page.locator('.wpc-character').first.click()
        assert '品質 20' in cells.first.inner_text().replace('\u200b',''), cells.first.inner_text()
        assert 'HP' not in cells.first.locator('.pt-slot-t').inner_text()
        assert cells.first.locator('.bk-socket').count()==2
        assert cells.nth(1).is_disabled()
        assert cells.first.evaluate('(e)=>e.getBoundingClientRect().right<=innerWidth')
        page.locator('.wpc-character').nth(1).click()
        assert '品質 30' in cells.first.inner_text().replace('\u200b','')
        assert page.evaluate('before===signature()')
        cells.first.click()
        panel=page.locator('.ui-sheet-wrap:not(.closing) .rf-sheet')
        assert panel.count()==1
        assert page.evaluate('before===signature()'), '確認だけで課金・抽選された'
        page.screenshot(path=f'/tmp/reforge-equipment-{width}.png')
        assert not errors, errors
        page.close()
    browser.close()
print('鍛え直しの共通装備欄: 4画面幅で確認済み')
