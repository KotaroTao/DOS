"""商会・技の鑑定結果で武魂差分の並びとアイコンを確認。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for skill in [False, True]:
        for width in [320, 937]:
            page = browser.new_page(viewport={'width': width, 'height': 1000}, service_workers='block', reduced_motion='reduce')
            errors = []
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.goto('http://localhost:8000/?testDungeon=w18&testPlace=town')
            page.wait_for_function('window.__game?.G.party.length>0')
            page.locator('#studio-splash').wait_for(state='detached')
            page.evaluate('''async skill=>{
              const {game,UI,ops}=await import('/src/ui/ctx.js');
              const G=game.G;G.testTutorial=null;G.testUnlock=['enchant'];G.tut={done:{enchant:1}};G.gold=1e9;G.inventory.splice(0);G.bukonGift=true;
              const d=G.party[0];const old=game.cloneItem('shortSword',1);old.bukon=[{k:'flat_hp',lv:2}];d.equip.weapon=old;
              const it=game.cloneItem('shortSword',99);it.bukon=[{k:'flat_hp',lv:1}];it.unidentified=true;G.inventory.push(it);
              UI.canEquipReason=()=>null;UI.bestWearer=()=>d;UI.gearScore=()=>100;
              if(skill){d.passiveMap.kantei=4;game.doIdentifySkill=(m,it)=>{delete it.unidentified;return true;};UI.openTryIdentifyAll();}
              else UI.identifyAllAndReveal();
            }''', skill)
            if skill:
                page.locator('.ui-sheet-wrap:not(.closing) .ap-sheet').get_by_role('button', name='早送り').click()
            rows = page.locator('.ui-sheet-wrap:not(.closing) .wpc-prow .eq-bukon-change')
            rows.first.wait_for(state='visible')
            assert rows.count() == 2
            assert [x.replace('\u200b', '') for x in rows.all_text_contents()] == ['得るHP加算 +10', '失うHP加算 +20']
            for row in rows.all():
                assert row.locator('.bk-gem').count() == 1
                assert row.evaluate('x=>x.children.length===3&&x.children[1].classList.contains("bk-gem")')
                assert row.evaluate('x=>x.getBoundingClientRect().right<=innerWidth')
            assert rows.nth(1).bounding_box()['y'] > rows.first.bounding_box()['y']
            assert not errors, errors
            print('技' if skill else '商会', width, 'OK 得る・失うの順、宝石と武魂名を一行ずつ表示')
            page.close()
    browser.close()
