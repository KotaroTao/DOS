"""商会の装備カードとロック装備の武魂着脱・移植を確認。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width in [320, 937]:
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
        assert page.evaluate('''async()=>{
          const {game}=await import('/src/ui/ctx.js');const source={...gearTest.it,bukon:[{k:'flat_mp',lv:1}]};game.G.inventory.push(source);
          return game.bukonAction('transfer',gearTest.it,{source})&&source.locked&&gearTest.it.locked&&source.bukon===undefined&&gearTest.it.bukon.length===3;
        }''')
        assert not errors, errors
        print(width, 'OK 武魂名の縦表示・能力非表示・ロック維持で着脱と移植')
        page.close()
    browser.close()
