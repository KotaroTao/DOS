"""実セーブを通常起動で読み直し、0体の段階・加入待ち・鑑定待ちを検証する。"""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    for key,phase,count in [('createThree','three',0),('createFourth','fourth',3),('createFifth','fifth',4),('createSixth','sixth',5),('prologueAppraise','appraise',6)]:
        context=browser.new_context(service_workers='block')
        page=context.new_page(); errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto('http://localhost:8000/?testScene=tutorial:'+key)
        page.wait_for_function('window.__game?.G.msq?.prologue')
        page.evaluate("localStorage.setItem('dos-save-v7',__game.inf.saveJSON())")
        page.goto('http://localhost:8000/')
        page.wait_for_function('window.__game?.G.msq?.prologue')
        assert page.evaluate('__game.G.msq.prologue.phase')==phase
        assert page.evaluate('__game.G.party.length')==count
        if key=='prologueAppraise':
            assert page.evaluate('__game.G.party[0].items.includes(__game.G.msq.prologue.staff)&&__game.G.msq.prologue.staff.q===50')
        print(key, '通常起動で保存状態を復元')
        assert not errors,errors
        context.close()
    browser.close()
