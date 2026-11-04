"""商会の装備カードとロック装備の武魂着脱・付け替えを確認。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width in [320, 390, 768, 1280]:
        page = browser.new_page(viewport={'width': width, 'height': 1000}, service_workers='block')
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto('http://localhost:8000/?testDungeon=w18&testPlace=town')
        page.wait_for_function('window.__game?.G.party.length>0')
        page.locator('#studio-splash').wait_for(state='detached')
        page.evaluate('''async()=>{
          const {game,UI}=await import('/src/ui/ctx.js'),{ITEMS}=await import('/src/items.js'),b=await import('/src/bukon.js');
          const G=game.G;G.testTutorial=null;G.testUnlock=['enchant','bukonFusion'];G.tut={done:{enchant:1,bukonFusion:1}};G.bukonGift=true;G.bukonStock={};
          UI.prepareEnchantTutorial();UI.openShop('enchant');
          const d=game.allDolls().find(x=>String(x.uid)===document.querySelector('.wpc-character.selected').dataset.dollUid);
          const it=game.cloneItem(Object.values(ITEMS).find(x=>x.slot==='weapon'&&!x.cursed).id,50);
          it.rar='lr';it.locked=true;it.bukon=[{k:'flat_hp',lv:1},{k:'flat_atk',lv:1}];d.equip.weapon=it;
          b.stockAdd(G,{k:'flat_mp',lv:1});window.gearTest={it,b};UI.prepareEnchantTutorial();UI.openShop('enchant');
        }''')
        card = page.locator('.bk-equipment [data-slot="weapon"]')
        assert card.locator('.bk-name-line').count() == 2
        assert card.locator('.pt-slot-power,.pt-slot-s').count() == 0
        assert card.locator('.bk-name-line .bk-gem').count() == 2
        assert card.evaluate('(x)=>x.getBoundingClientRect().right<=innerWidth')
        card.click()
        detail = page.locator('.ui-sheet-wrap:not(.closing) .bk-sheet')
        detail.get_by_role('button', name='外す', exact=True).first.click()
        assert page.evaluate('gearTest.it.locked&&gearTest.it.bukon.length===1')
        detail.locator('.bk-copy-rows .bk-stock-row').filter(has=page.get_by_role('button', name='HP加算 +10', exact=True)).get_by_role('button', name='宿す', exact=True).click()
        assert page.evaluate('gearTest.it.locked&&gearTest.it.bukon.length===2')
        assert page.locator('.bk-panel .wpc-lhead,.bk-panel .ec-afx-acts').count() == 0
        detail.get_by_role('button', name='閉じる', exact=True).first.click()
        page.evaluate('''async()=>{
          const {game,UI}=await import('/src/ui/ctx.js');
          const source={...gearTest.it,bukon:[{k:'flat_mp',lv:1,fusionUnlocked:true}]};
          const other=game.allDolls().find(d=>d.equip?.weapon!==gearTest.it);
          other.equip.weapon=source;gearTest.source=source;gearTest.soul=source.bukon[0];
          UI.openShop('enchant');
        }''')
        page.locator('.bk-equipment [data-slot="weapon"]').click()
        detail = page.locator('.ui-sheet-wrap:not(.closing) .bk-sheet')
        assert detail.get_by_text('別の装備から一括移植',exact=True).count() == 0
        row=detail.locator('.bk-copy-rows .bk-other-owner').first
        assert row.locator('.bk-installed-note').count()==1
        assert '宿し先' not in row.inner_text()
        assert row.evaluate('(r)=>Array.from(r.children).every(x=>Math.abs(x.getBoundingClientRect().top-r.firstElementChild.getBoundingClientRect().top)<2)')
        lock=row.get_by_role('button',name='ロック',exact=True)
        before=lock.bounding_box()
        color=lock.evaluate('(x)=>getComputedStyle(x).backgroundColor')
        lock.click()
        assert lock.get_attribute('aria-pressed')=='true'
        assert lock.bounding_box()['width']==before['width']
        assert lock.bounding_box()['height']==before['height']
        assert lock.evaluate('(x)=>getComputedStyle(x).backgroundColor')!=color
        lock.click()

        detail.locator('.bk-copy-rows .bk-stock-row').filter(has=page.get_by_role('button',name='MP加算 +5',exact=True)).filter(has=page.get_by_role('button',name='宿す',exact=True)).get_by_role('button',name='宿す',exact=True).first.click()
        assert page.evaluate('gearTest.source.bukon.length===0&&gearTest.it.bukon.includes(gearTest.soul)&&gearTest.soul.fusionUnlocked')
        assert page.evaluate('''async()=>{
          const {game}=await import('/src/ui/ctx.js');
          const before=gearTest.it.bukon.length;
          return !game.bukonAction('move',gearTest.it,{it:gearTest.source,soul:gearTest.soul})&&gearTest.it.bukon.length===before;
        }''')
        assert not errors, errors
        print(width, 'OK 武魂名の縦表示・能力非表示・ロック維持で着脱と他の人業から付け替え')
        page.close()
    browser.close()
